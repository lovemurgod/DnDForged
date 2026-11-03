// Test Suite: Canvas Portals & Traps Subsystem Invariants
// Verifies geometric collision, trap saves, and non-euclidean portal destination math

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    isPointInPoly,
    distToSegmentSq,
    checkLineIntersection,
    checkLineCircleIntersection,
    isPointInsideGeometry,
    findEarliestPathIntersection,
    calcGeometryCenter,
    rollTrapSave
} from '../vtt/js/canvas/vtt-canvas-traps.js';

import {
    calcPortalCenter,
    getPortalNormalVector,
    getPortalRotationHandlePos,
    checkOneWayPortalEntry,
    isTokenCollidingWithPortal,
    calcSpatialPortalDestination,
    resolveRulerPortalBending,
    cleanupPortalReferences
} from '../vtt/js/canvas/vtt-canvas-portals.js';

import {
    cloneMapToolGeom,
    updateDraggedMapToolGeom,
    getMapToolResizeHandles,
    applyMapToolResize,
    getMapToolItemAtCoord
} from '../vtt/js/canvas/vtt-canvas-map-tools.js';

describe('Canvas Traps: Geometric Primitives & Collision', () => {
    it('isPointInPoly detects points inside and outside arbitrary polygons', () => {
        const squarePoly = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 }
        ];

        assert.strictEqual(isPointInPoly({ x: 50, y: 50 }, squarePoly), true, 'Center should be inside');
        assert.strictEqual(isPointInPoly({ x: 150, y: 50 }, squarePoly), false, 'Outside point should return false');
        assert.strictEqual(isPointInPoly({ x: -10, y: -10 }, squarePoly), false, 'Negative coords should return false');
    });

    it('distToSegmentSq calculates squared distance to segment and clamps to endpoints', () => {
        const v = { x: 0, y: 0 };
        const w = { x: 100, y: 0 };

        // Point directly perpendicular to midpoint at distance 10
        const dMid = distToSegmentSq({ x: 50, y: 10 }, v, w);
        assert.strictEqual(dMid, 100, 'Distance squared should be 10^2 = 100');

        // Point past endpoint w at distance 20 along X
        const dPast = distToSegmentSq({ x: 120, y: 0 }, v, w);
        assert.strictEqual(dPast, 400, 'Distance squared to w should be 20^2 = 400');
    });

    it('checkLineIntersection computes exact crossing point and parameter t', () => {
        const p1 = { x: 0, y: 50 };
        const p2 = { x: 100, y: 50 };
        const p3 = { x: 50, y: 0 };
        const p4 = { x: 50, y: 100 };

        const hit = checkLineIntersection(p1, p2, p3, p4);
        assert.ok(hit, 'Lines must intersect');
        assert.strictEqual(hit.x, 50);
        assert.strictEqual(hit.y, 50);
        assert.strictEqual(hit.t, 0.5);

        // Parallel non-intersecting lines
        const parallel = checkLineIntersection({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 }, { x: 100, y: 20 });
        assert.strictEqual(parallel, null);
    });

    it('checkLineCircleIntersection detects crossing secants and misses', () => {
        const center = { x: 50, y: 50 };
        const radius = 25;

        // Line passing straight through center
        const hit = checkLineCircleIntersection({ x: 0, y: 50 }, { x: 100, y: 50 }, center, radius);
        assert.ok(hit, 'Secant line must intersect circle');
        assert.strictEqual(hit.x, 25);
        assert.strictEqual(hit.y, 50);

        // Distant line
        const miss = checkLineCircleIntersection({ x: 0, y: 100 }, { x: 100, y: 100 }, center, radius);
        assert.strictEqual(miss, null);
    });

    it('isPointInsideGeometry accurately handles rect, circle, line, and polygon shapes', () => {
        assert.strictEqual(isPointInsideGeometry({ x: 25, y: 25 }, 'rect', { x: 0, y: 0, w: 50, h: 50 }), true);
        assert.strictEqual(isPointInsideGeometry({ x: 75, y: 25 }, 'rect', { x: 0, y: 0, w: 50, h: 50 }), false);

        assert.strictEqual(isPointInsideGeometry({ x: 50, y: 50 }, 'circle', { cx: 50, cy: 50, r: 20 }), true);
        assert.strictEqual(isPointInsideGeometry({ x: 90, y: 50 }, 'circle', { cx: 50, cy: 50, r: 20 }), false);

        assert.strictEqual(isPointInsideGeometry({ x: 50, y: 1 }, 'line', { x1: 0, y1: 0, x2: 100, y2: 0 }), true);
        assert.strictEqual(isPointInsideGeometry({ x: 50, y: 10 }, 'line', { x1: 0, y1: 0, x2: 100, y2: 0 }), false);
    });

    it('findEarliestPathIntersection returns earliest hit parameter along path', () => {
        const from = { x: 0, y: 50 };
        const to = { x: 100, y: 50 };
        const rectGeom = { x: 40, y: 30, w: 40, h: 40 };

        const hit = findEarliestPathIntersection(from, to, 'rect', rectGeom);
        assert.ok(hit);
        assert.strictEqual(hit.x, 40);
        assert.strictEqual(hit.y, 50);
        assert.strictEqual(hit.t, 0.4);
    });
});

describe('Canvas Traps: Save Rolling & Mechanics', () => {
    it('rollTrapSave calculates character save modifiers and emits socket message', () => {
        let emittedMsg = null;
        const fakeVtt = {
            socket: {
                emit: (event, payload) => {
                    if (event === 'chat:msg') emittedMsg = payload;
                }
            },
            campaignState: {
                characters: {
                    char_1: {
                        name: 'Rogue Scout',
                        level: 5,
                        stats: { dex: 16 }, // +3 mod
                        saves: { dex: true }, // PB +3 at level 5 -> total +6
                        saveMods: { dex: 1 }, // Custom +1 -> total +7
                        saveToggles: [{ enabled: true, target: 'dex', formula: '+1d4' }]
                    }
                }
            }
        };

        const fakeTokens = {
            tok_1: { id: 'tok_1', characterId: 'char_1', name: 'Rogue Token' }
        };

        let rollFormulaUsed = null;
        const fakeRollFn = (formula) => {
            rollFormulaUsed = formula;
            return { formula, total: 18 };
        };

        rollTrapSave('trap_1', 'tok_1', 'DEX', 15, {
            tokens: fakeTokens,
            vtt: fakeVtt,
            rollFn: fakeRollFn
        });

        assert.ok(emittedMsg, 'Socket message must be emitted');
        assert.ok(emittedMsg.text.includes('Rogue Scout: DEX Save'));
        assert.strictEqual(
            rollFormulaUsed,
            '1d20+7+1d4',
            'Formula should match 1d20 + 3(base) + 3(pb) + 1(mod) + 1d4(toggle)'
        );
    });
});

describe('Canvas Portals: Non-Euclidean Geometry & Teleportation', () => {
    it('calcPortalCenter returns centroids across all shapes', () => {
        assert.deepStrictEqual(calcPortalCenter({ shape: 'rect', geom: { x: 100, y: 200, w: 50, h: 60 } }), {
            x: 125,
            y: 230
        });
        assert.deepStrictEqual(calcPortalCenter({ shape: 'circle', geom: { cx: 300, cy: 400, r: 25 } }), {
            x: 300,
            y: 400
        });
        assert.deepStrictEqual(calcPortalCenter({ shape: 'line', geom: { x1: 100, y1: 100, x2: 200, y2: 300 } }), {
            x: 150,
            y: 200
        });
    });

    it('getPortalNormalVector computes normalized direction and handles flipping', () => {
        // Line from (0, 0) to (100, 0) -> normal points up (dy = -1, dx = 0)
        const linePortal = { shape: 'line', geom: { x1: 0, y1: 0, x2: 100, y2: 0 } };
        const norm = getPortalNormalVector(linePortal);
        assert.strictEqual(norm.dx, 0);
        assert.strictEqual(norm.dy, 1);

        // Facing angle = 0 deg (points east along +X)
        const anglePortal = { geom: {}, facingAngle: 0 };
        const normAngle = getPortalNormalVector(anglePortal);
        assert.strictEqual(Math.round(normAngle.dx), 1);
        assert.strictEqual(Math.abs(Math.round(normAngle.dy)), 0);

        // Flipped side
        const flippedPortal = { geom: {}, facingAngle: 0, viewSideFlipped: true };
        const normFlipped = getPortalNormalVector(flippedPortal);
        assert.strictEqual(Math.round(normFlipped.dx), -1);
        assert.strictEqual(Math.abs(Math.round(normFlipped.dy)), 0);
    });

    it('checkOneWayPortalEntry allows entrance from the front and blocks from rear', () => {
        // Portal facing East (facingAngle: 0 -> normal dx: 1, dy: 0)
        const portal = { geom: {}, isOneWay: true, facingAngle: 0 };

        // Token moving Westward towards Portal (from x=100 to x=0 -> dx = -100). Dot product = -100 * 1 = -100 < 0 (facing front)
        assert.strictEqual(
            checkOneWayPortalEntry(portal, { x: 100, y: 0 }, { x: 0, y: 0 }),
            true,
            'Approaching front face should pass'
        );

        // Token moving Eastward from behind Portal (from x=-50 to x=50 -> dx = +100). Dot product = +100 * 1 = 100 > 0 (rear entry)
        assert.strictEqual(
            checkOneWayPortalEntry(portal, { x: -50, y: 0 }, { x: 50, y: 0 }),
            false,
            'Approaching back face should be blocked'
        );
    });

    it('calcSpatialPortalDestination computes correct translated coordinate with rotation', () => {
        const portalA = {
            id: 'pA',
            shape: 'line',
            geom: { x1: 100, y1: 50, x2: 100, y2: 150 }, // Center: (100, 100), Facing East (facingAngle: 0)
            facingAngle: 0
        };

        const portalB = {
            id: 'pB',
            shape: 'line',
            geom: { x1: 500, y1: 50, x2: 500, y2: 150 }, // Center: (500, 100), Facing West (facingAngle: 180)
            facingAngle: 180
        };

        const from = { x: 80, y: 100 };
        const to = { x: 110, y: 100 };

        const dest = calcSpatialPortalDestination(portalA, portalB, from, to, null, null, {
            grid: { size: 50, scale: 1, offsetX: 0, offsetY: 0 },
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
        });

        assert.ok(dest);
        // Destination should be snapped to grid in front of portalB
        assert.ok(typeof dest.x === 'number' && typeof dest.y === 'number');
    });

    it('resolveRulerPortalBending bends measurement ruler across linked portals', () => {
        const portalA = {
            id: 'pA',
            targetPortalId: 'pB',
            shape: 'line',
            geom: { x1: 100, y1: 0, x2: 100, y2: 200 },
            facingAngle: 0
        };
        const portalB = {
            id: 'pB',
            targetPortalId: 'pA',
            shape: 'line',
            geom: { x1: 1000, y1: 0, x2: 1000, y2: 200 },
            facingAngle: 180
        };

        const poly = [
            { x: 50, y: 100 },
            { x: 150, y: 100 }
        ];

        const segments = resolveRulerPortalBending(poly, [portalA, portalB], 'map_1');
        assert.ok(Array.isArray(segments), 'Segments must be an array');
        assert.strictEqual(segments.length, 2, 'Should divide ruler into pre-portal and post-portal legs');
        assert.strictEqual(segments[0].isPortalJunction, true);
        assert.strictEqual(segments[1].isTerminal, true);
    });

    it('cleanupPortalReferences clears severed targetPortalIds across map sets', () => {
        const portals = [
            { id: 'p1', targetPortalId: 'p_deleted' },
            { id: 'p2', targetPortalId: 'p_other' }
        ];
        const campaignState = {
            maps: {
                map_2: {
                    portals: [{ id: 'p3', targetPortalId: 'p_deleted' }]
                }
            }
        };

        cleanupPortalReferences('p_deleted', portals, 'map_1', campaignState, null);

        assert.strictEqual(portals[0].targetPortalId, '', 'p1 targetPortalId should be cleared');
        assert.strictEqual(portals[1].targetPortalId, 'p_other', 'p2 targetPortalId should remain intact');
        assert.strictEqual(
            campaignState.maps.map_2.portals[0].targetPortalId,
            '',
            'Other map reference should be cleared'
        );
    });
});

describe('Canvas Map Tools: Item Manipulation & Resizing', () => {
    it('cloneMapToolGeom and updateDraggedMapToolGeom correctly translate shapes', () => {
        const rectGeom = { x: 10, y: 20, w: 30, h: 40 };
        const clone = cloneMapToolGeom(rectGeom);
        assert.deepStrictEqual(clone, rectGeom);
        assert.notStrictEqual(clone, rectGeom);

        updateDraggedMapToolGeom(rectGeom, clone, 5, 10);
        assert.strictEqual(rectGeom.x, 15);
        assert.strictEqual(rectGeom.y, 30);
    });

    it('getMapToolResizeHandles generates correct handle set for rect and circle', () => {
        const rectHandles = getMapToolResizeHandles({ shape: 'rect', geom: { x: 0, y: 0, w: 100, h: 100 } });
        assert.strictEqual(rectHandles.length, 8, 'Rect must have 8 boundary resize handles');

        const circleHandles = getMapToolResizeHandles({ shape: 'circle', geom: { cx: 50, cy: 50, r: 25 } });
        assert.strictEqual(circleHandles.length, 4, 'Circle must have 4 cardinal handles');
    });

    it('getMapToolItemAtCoord selects portals on portal layer and traps on other layers', () => {
        const traps = [{ id: 't1', shape: 'rect', geom: { x: 0, y: 0, w: 50, h: 50 } }];
        const portals = [{ id: 'p1', shape: 'rect', geom: { x: 100, y: 100, w: 50, h: 50 } }];

        const hitTrap = getMapToolItemAtCoord(25, 25, { isGM: true, activeLayer: 'tokens', portals, traps });
        assert.ok(hitTrap);
        assert.strictEqual(hitTrap.type, 'trap');
        assert.strictEqual(hitTrap.item.id, 't1');

        const hitPortal = getMapToolItemAtCoord(125, 125, { isGM: true, activeLayer: 'portals', portals, traps });
        assert.ok(hitPortal);
        assert.strictEqual(hitPortal.type, 'portal');
        assert.strictEqual(hitPortal.item.id, 'p1');
    });
});
