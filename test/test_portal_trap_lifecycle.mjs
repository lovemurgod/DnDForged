import test from 'node:test';
import assert from 'node:assert/strict';
import {
    checkTokenMoveTriggers,
    calcSpatialPortalDestination,
    isTokenCollidingWithPortal
} from '../vtt/js/canvas/vtt-canvas-portals.js';
import { isPointInsideGeometry, findEarliestPathIntersection } from '../vtt/js/canvas/vtt-canvas-traps.js';

test('isPointInsideGeometry detects hit-testing across all geometry shapes', () => {
    // Rect
    assert.equal(isPointInsideGeometry({ x: 10, y: 10 }, 'rect', { x: 0, y: 0, w: 20, h: 20 }), true);
    assert.equal(isPointInsideGeometry({ x: 30, y: 10 }, 'rect', { x: 0, y: 0, w: 20, h: 20 }), false);

    // Circle
    assert.equal(isPointInsideGeometry({ x: 105, y: 105 }, 'circle', { cx: 100, cy: 100, r: 10 }), true);
    assert.equal(isPointInsideGeometry({ x: 120, y: 100 }, 'circle', { cx: 100, cy: 100, r: 10 }), false);

    // Polygon
    const poly = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 }
    ];
    assert.equal(isPointInsideGeometry({ x: 25, y: 25 }, 'polygon', { points: poly }), true);
    assert.equal(isPointInsideGeometry({ x: 75, y: 25 }, 'polygon', { points: poly }), false);
});

test('findEarliestPathIntersection returns accurate collision entry point', () => {
    const from = { x: 0, y: 50 };
    const to = { x: 100, y: 50 };
    const rectGeom = { x: 40, y: 0, w: 20, h: 100 };

    const hit = findEarliestPathIntersection(from, to, 'rect', rectGeom);
    assert.ok(hit, 'Path passing through rect must collide');
    assert.equal(hit.x, 40, 'Collision point must be on rect boundary');
    assert.equal(hit.y, 50);
});

test('calcSpatialPortalDestination computes exit coordinates snapped to grid facing', () => {
    const portalA = {
        id: 'p_a',
        shape: 'circle',
        geom: { cx: 100, cy: 100, r: 25 },
        facingAngle: 0
    };
    const portalB = {
        id: 'p_b',
        shape: 'circle',
        geom: { cx: 500, cy: 500, r: 25 },
        facingAngle: 90 // Facing downwards (+Y)
    };

    const from = { x: 50, y: 100 };
    const to = { x: 100, y: 100 };
    const token = { id: 'tok_1', size: 1 };
    const options = {
        grid: { size: 50, scale: 1 },
        getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
    };

    const dest = calcSpatialPortalDestination(portalA, portalB, from, to, null, token, options);
    assert.ok(dest, 'Destination must be calculated');
    assert.ok(typeof dest.x === 'number' && typeof dest.y === 'number');
});

test('checkTokenMoveTriggers detects armed trap and dispatches trigger payload', () => {
    globalThis.window = {
        vttPlayerSheetAPI: {
            simulateRoll: (f) => ({ total: 7, formula: f })
        }
    };

    const trap = {
        id: 'trap_spikes',
        name: 'Spike Pit',
        shape: 'rect',
        geom: { x: 200, y: 200, w: 50, h: 50 },
        isRevealed: false,
        isSpent: false,
        triggerAuto: true,
        repeatTrigger: false,
        saveAbility: 'DEX',
        saveDc: 15,
        damage: '2d6',
        damageType: 'piercing'
    };

    let emittedTrapEvent = null;
    let trapsUpdateEmitted = false;

    const mockSocket = {
        emit(event, payload) {
            if (event === 'trap:trigger') emittedTrapEvent = payload;
            if (event === 'traps:update') trapsUpdateEmitted = true;
        }
    };

    const context = {
        vtt: { socket: mockSocket, campaignState: {} },
        currentMapId: 'map_1',
        traps: [trap],
        portals: [],
        tokens: {},
        getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
    };

    const token = { id: 'tok_1', name: 'Valeros', x: 200, y: 200 };
    const originalPos = { x: 100, y: 200 };

    try {
        const result = checkTokenMoveTriggers(token, originalPos, context);
        assert.ok(result, 'Trigger must return result');
        assert.equal(result.triggered, true);
        assert.equal(result.action, 'trap');
        assert.equal(trap.isRevealed, true, 'Triggered trap must be marked revealed');
        assert.equal(trapsUpdateEmitted, true, 'traps:update must be broadcast');
        assert.ok(emittedTrapEvent, 'trap:trigger socket event must be emitted');
        assert.equal(emittedTrapEvent.saveDc, 15);
        assert.equal(emittedTrapEvent.damageType, 'piercing');
    } finally {
        delete globalThis.window;
    }
});

test('checkTokenMoveTriggers rejects spent traps when repeatTrigger is false', () => {
    const spentTrap = {
        id: 'trap_spikes_spent',
        name: 'Spent Trap',
        shape: 'rect',
        geom: { x: 200, y: 200, w: 50, h: 50 },
        isRevealed: true,
        isSpent: true,
        repeatTrigger: false
    };

    let emittedTrapEvent = null;
    const context = {
        vtt: {
            socket: {
                emit(e, p) {
                    if (e === 'trap:trigger') emittedTrapEvent = p;
                }
            },
            campaignState: {}
        },
        currentMapId: 'map_1',
        traps: [spentTrap],
        portals: [],
        tokens: {},
        getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
    };

    const token = { id: 'tok_1', x: 200, y: 200 };
    const originalPos = { x: 100, y: 200 };

    const result = checkTokenMoveTriggers(token, originalPos, context);
    assert.equal(result, null, 'Spent non-repeating trap must not trigger');
    assert.equal(emittedTrapEvent, null);
});

test('checkTokenMoveTriggers blocks transit if _portalTransitLock is active', () => {
    const portal = {
        id: 'p_1',
        name: 'Portal 1',
        shape: 'circle',
        geom: { cx: 200, cy: 200, r: 30 },
        walkThrough: true,
        targetPortalId: 'p_2'
    };

    const token = {
        id: 'tok_1',
        x: 175,
        y: 175,
        _portalTransitLock: Date.now() + 5000 // In-flight transit lock active
    };
    const originalPos = { x: 100, y: 175 };

    const context = {
        vtt: { socket: { emit() {} }, campaignState: {} },
        currentMapId: 'map_1',
        traps: [],
        portals: [portal],
        tokens: {},
        getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
    };

    const result = checkTokenMoveTriggers(token, originalPos, context);
    assert.equal(result, null, 'Active transit lock must prevent portal trigger oscillation');
});

test('checkTokenMoveTriggers executes intra-map teleportation and sets transit lock', () => {
    const portalA = {
        id: 'portal_a',
        shape: 'circle',
        geom: { cx: 200, cy: 200, r: 25 },
        walkThrough: true,
        targetMapId: 'map_1',
        targetPortalId: 'portal_b',
        facingAngle: 0
    };
    const portalB = {
        id: 'portal_b',
        shape: 'circle',
        geom: { cx: 600, cy: 400, r: 25 },
        walkThrough: true,
        targetMapId: 'map_1',
        targetPortalId: 'portal_a',
        facingAngle: 180
    };

    let pannedCoords = null;
    let tokenUpdatesBroadcasted = false;

    const token = { id: 'tok_hero', x: 175, y: 175, name: 'Hero' };
    const originalPos = { x: 100, y: 175 };

    const context = {
        vtt: {
            socket: { emit() {} },
            campaignState: {
                maps: {
                    map_1: { id: 'map_1', portals: [portalA, portalB] }
                }
            }
        },
        currentMapId: 'map_1',
        traps: [],
        portals: [portalA, portalB],
        tokens: { tok_hero: token },
        selectedTokenIds: new Set(),
        getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
        snapToGrid: (x, y) => ({ x, y }),
        panTo: (x, y) => {
            pannedCoords = { x, y };
        },
        emitTokenUpdates: () => {
            tokenUpdatesBroadcasted = true;
        },
        renderAll: () => {}
    };

    const result = checkTokenMoveTriggers(token, originalPos, context);
    assert.ok(result, 'Portal trigger must resolve');
    assert.equal(result.triggered, true);
    assert.equal(result.action, 'teleport');
    assert.ok(token._portalTransitLock > Date.now(), 'Token must have future transit lock timestamp');
    assert.ok(tokenUpdatesBroadcasted, 'emitTokenUpdates must be called');
    assert.ok(pannedCoords, 'panTo must center camera on destination');
});
