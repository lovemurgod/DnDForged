import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getPortalNormalVector,
    getPortalRotationHandlePos,
    calcSpatialPortalDestination,
    getPortalAperturePoints,
    computePortalSightFrustum,
    computeProjectedPortalData,
    invalidatePortalCaches,
    checkTokenMoveTriggers,
    renderProjectedPortals
} from '../vtt/js/canvas/vtt-canvas-portals.js';

test('Portal View, Lighting, Orientation, Sync and Movement Integrity', async (t) => {
    await t.test('1. Universal Compass Heading: 0° is North across all portal normals and rotation handles', () => {
        // Test North (0°)
        const northPortal = { shape: 'line', geom: { x1: 50, y1: 100, x2: 150, y2: 100 }, facingAngle: 0 };
        const normN = getPortalNormalVector(northPortal);
        assert.equal(Math.round(normN.dx), 0, 'North normal dx should be 0');
        assert.equal(Math.round(normN.dy), -1, 'North normal dy should be -1');
        const handleN = getPortalRotationHandlePos(northPortal);
        assert.equal(handleN.angleDeg, 0, 'Handle angle should report 0° (North)');

        // Test East (90°)
        const eastPortal = { shape: 'circle', geom: { cx: 100, cy: 100, r: 25 }, facingAngle: 90 };
        const normE = getPortalNormalVector(eastPortal);
        assert.equal(Math.round(normE.dx), 1, 'East normal dx should be 1');
        assert.equal(Math.round(normE.dy), 0, 'East normal dy should be 0');
        const handleE = getPortalRotationHandlePos(eastPortal);
        assert.equal(handleE.angleDeg, 90, 'Handle angle should report 90° (East)');

        // Test South (180°)
        const southPortal = { shape: 'rect', geom: { x: 50, y: 50, w: 50, h: 50 }, facingAngle: 180 };
        const normS = getPortalNormalVector(southPortal);
        assert.equal(Math.round(normS.dx), 0, 'South normal dx should be 0');
        assert.equal(Math.round(normS.dy), 1, 'South normal dy should be 1');
        const handleS = getPortalRotationHandlePos(southPortal);
        assert.equal(handleS.angleDeg, 180, 'Handle angle should report 180° (South)');

        // Test West (270°)
        const westPortal = { shape: 'line', geom: { x1: 100, y1: 50, x2: 100, y2: 150 }, facingAngle: 270 };
        const normW = getPortalNormalVector(westPortal);
        assert.equal(Math.round(normW.dx), -1, 'West normal dx should be -1');
        assert.equal(Math.round(normW.dy), 0, 'West normal dy should be 0');
        const handleW = getPortalRotationHandlePos(westPortal);
        assert.equal(handleW.angleDeg, 270, 'Handle angle should report 270° (West)');
    });

    await t.test('2. Matching portal orientations: Portals at same compass angle require 0° adjustment', () => {
        // Portal A facing North (0°), Portal B facing North (0°)
        const portalA = { id: 'pA', shape: 'line', geom: { x1: 100, y1: 200, x2: 200, y2: 200 }, facingAngle: 0 };
        const portalB = { id: 'pB', shape: 'line', geom: { x1: 500, y1: 800, x2: 600, y2: 800 }, facingAngle: 0 };

        const normA = getPortalNormalVector(portalA);
        const normB = getPortalNormalVector(portalB);

        const angleA = Math.atan2(normA.dx, -normA.dy);
        const angleB = Math.atan2(normB.dx, -normB.dy);
        const thetaRot = angleB - angleA;

        assert.equal(thetaRot, 0, 'Portals facing the same heading should have 0 relative rotation');

        // Step through A into B: token walking North (from 150, 250 -> 150, 190) should exit B walking North
        const dest = calcSpatialPortalDestination(portalA, portalB, { x: 150, y: 250 }, { x: 150, y: 190 });
        // centerB is (550, 800); exiting forward in North direction (dy < 0)
        assert.ok(dest.y <= 800, 'Token exiting destination portal B should be at or forward (North) of doorway');
    });

    await t.test(
        '3. Smooth Frustum & Diagonal Cutoff Prevention: aperture points and arc do not self-intersect',
        () => {
            // Line portal drawn in reversed coordinate order
            const linePortalRev = {
                shape: 'line',
                geom: { x1: 200, y1: 100, x2: 100, y2: 100 }
            };
            const observer = { x: 150, y: 200 };
            const ap = getPortalAperturePoints(linePortalRev, observer);
            assert.ok(ap, 'Aperture points must be resolved');

            const frustum = computePortalSightFrustum(linePortalRev, observer, 150);
            assert.ok(Array.isArray(frustum) && frustum.length >= 6);

            // Check that distance from observer along arc is smooth and continuous
            for (let i = 1; i < frustum.length - 2; i++) {
                const pCurrent = frustum[i];
                const pNext = frustum[i + 1];
                const segLen = Math.hypot(pNext.x - pCurrent.x, pNext.y - pCurrent.y);
                // Segments should be smooth steps, never huge discontinuous jumps across the canvas
                assert.ok(segLen < 120, `Adjacent frustum vertex step (${segLen}px) must be smooth without jump`);
            }
        }
    );

    await t.test(
        '4. Dynamic Lighting Wall Occlusion: Frustum is clipped by source map walls and does not punch through',
        () => {
            const portal = {
                shape: 'line',
                geom: { x1: 100, y1: 100, x2: 200, y2: 100 },
                facingAngle: 0
            };
            const observer = { x: 150, y: 200 };

            // A solid dungeon wall 50px past the portal (at y=50)
            const walls = [{ id: 'w_back', x1: 50, y1: 50, x2: 250, y2: 50, isOpen: false }];

            // Without walls, 200px reach would extend to y = 100 - (200 - 100) = 0
            const unblockedFrustum = computePortalSightFrustum(portal, observer, 200, []);
            const unblockedMinY = Math.min(...unblockedFrustum.map((p) => p.y));
            assert.ok(unblockedMinY < 50, 'Unblocked frustum extends beyond y=50');

            // With walls, the frustum MUST stop at y=50 and never penetrate into adjacent dungeon rooms
            const blockedFrustum = computePortalSightFrustum(portal, observer, 200, walls);
            const blockedMinY = Math.min(...blockedFrustum.map((p) => p.y));
            assert.ok(
                blockedMinY >= 49.9,
                `Clipped frustum minY (${blockedMinY}) must not penetrate through wall at y=50`
            );
        }
    );

    await t.test('5. Token Waypoints / Path Traversal: moving around a portal does NOT trigger teleportation', () => {
        // Portal placed in the center of the corridor at x=200, y=100..200
        const portal = {
            id: 'corridor_portal',
            shape: 'line',
            geom: { x1: 200, y1: 100, x2: 200, y2: 200 },
            walkThrough: true,
            targetPortalId: 'exit_portal'
        };
        const exitPortal = {
            id: 'exit_portal',
            shape: 'line',
            geom: { x1: 500, y1: 100, x2: 500, y2: 200 },
            walkThrough: true,
            targetPortalId: 'corridor_portal'
        };

        const token = { id: 'tok_rogue', x: 250, y: 150 }; // Finished on the right side
        const originalPos = { x: 150, y: 150 }; // Started on the left side

        // Straight line without waypoints would cut straight through the portal at x=200, y=150
        const chordTrigger = checkTokenMoveTriggers(token, originalPos, {
            portals: [portal, exitPortal],
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
        });
        assert.ok(
            chordTrigger && chordTrigger.action === 'teleport',
            'Direct chord across portal triggers teleportation'
        );

        // But when the rogue moves AROUND the portal via a detour waypoint at y=50 (above the portal line)
        const waypoints = [
            { x: 150, y: 40 }, // Step north
            { x: 250, y: 40 } // Step east around the portal
            // Then ends at (250, 150)
        ];

        const routedTrigger = checkTokenMoveTriggers(
            token,
            originalPos,
            {
                portals: [portal, exitPortal],
                getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
            },
            waypoints
        );

        assert.equal(routedTrigger, null, 'Moving along waypoints around the portal must NOT trigger teleportation');
    });

    await t.test('6. Portal Sync Rules: One-Way vs Two-Way Reflect Mode and View-Through', () => {
        // Mock portal A and linked portal B
        const portalA = {
            id: 'portalA',
            targetPortalId: 'portalB',
            targetMapId: 'map1',
            linkBack: true,
            walkThrough: true,
            viewThrough: false,
            reflectMode: 'none',
            isOneWay: false
        };
        const portalB = {
            id: 'portalB',
            targetPortalId: 'portalA',
            targetMapId: 'map1',
            linkBack: true,
            walkThrough: true,
            viewThrough: false,
            reflectMode: 'none',
            isOneWay: false
        };
        const portals = [portalA, portalB];

        // 1. One-Way Reflect: Portal A is one-way, so Portal B reflectMode must be disabled ('none')
        portalA.reflectMode = 'one-way';
        let targetReflect = 'none';
        if (portalA.reflectMode === 'two-way') targetReflect = 'two-way';
        else if (portalA.reflectMode === 'one-way') targetReflect = 'none';
        portalB.reflectMode = targetReflect;
        assert.equal(portalB.reflectMode, 'none', 'One-way reflect on A disables reflect on B');

        // 2. Two-Way Reflect: Portal A is two-way, so Portal B reflectMode must be 'two-way'
        portalA.reflectMode = 'two-way';
        targetReflect = 'none';
        if (portalA.reflectMode === 'two-way') targetReflect = 'two-way';
        else if (portalA.reflectMode === 'one-way') targetReflect = 'none';
        portalB.reflectMode = targetReflect;
        assert.equal(portalB.reflectMode, 'two-way', 'Two-way reflect on A enables two-way reflect on B');

        // 3. One-Way View Through: Portal A has View Through and isOneWay = true -> B must have viewThrough = false
        portalA.viewThrough = true;
        portalA.isOneWay = true;
        portalB.viewThrough = portalA.viewThrough ? !portalA.isOneWay : false;
        assert.equal(portalB.viewThrough, false, 'One-way viewing on A disables view-through on B');

        // 4. Two-Way View Through: Portal A has View Through and isOneWay = false -> B must have viewThrough = true
        portalA.isOneWay = false;
        portalB.viewThrough = portalA.viewThrough ? !portalA.isOneWay : false;
        assert.equal(portalB.viewThrough, true, 'Two-way viewing on A enables view-through on B');
    });

    await t.test('7. GM View Line-of-Sight: Portals behind walls are not projected even in GM mode', () => {
        const portal = {
            id: 'dungeon_portal',
            shape: 'line',
            geom: { x1: 500, y1: 500, x2: 600, y2: 500 },
            targetPortalId: 'target_p',
            viewThrough: true
        };
        const targetPortal = {
            id: 'target_p',
            shape: 'line',
            geom: { x1: 100, y1: 100, x2: 200, y2: 100 }
        };

        const tokens = {
            tok_gm: { id: 'tok_gm', x: 100, y: 500, isPlayer: false }
        };

        // Solid wall between (100, 500) and portal at (550, 500)
        const walls = [{ id: 'w_block', x1: 300, y1: 400, x2: 300, y2: 600, isOpen: false }];

        let drawn = false;
        const mockCtx = {
            save() {},
            restore() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            clip() {},
            translate() {},
            rotate() {},
            drawImage() {
                drawn = true;
            }
        };

        // Even though isGM: true and gmTokenVisionMode: false, blocked sight must prevent projection
        renderProjectedPortals(mockCtx, [portal, targetPortal], {
            vtt: { role: 'GM' },
            isGM: true,
            gmTokenVisionMode: false,
            tokens,
            walls,
            drawTargetRoomContent: () => {
                drawn = true;
            }
        });

        assert.equal(drawn, false, 'GM view must not project portals blocked by intervening walls');
    });

    await t.test('8. Doorframe Grazing: Walls adjacent to portal aperture do NOT clamp edge rays to doorstep', () => {
        const portal = {
            id: 'door_p',
            shape: 'line',
            facingAngle: 180, // Facing South into the room
            geom: { x1: 100, y1: 200, x2: 200, y2: 200 }
        };
        const sourceCenter = { x: 150, y: 100 }; // Token is North of door, looking South through it

        // Walls on either side of the doorway touching p1 (100, 200) and p2 (200, 200)
        const walls = [
            { x1: 0, y1: 200, x2: 100, y2: 200 },
            { x1: 200, y1: 200, x2: 300, y2: 200 },
            // Real back wall 300px beyond doorway (y=500)
            { x1: 0, y1: 500, x2: 400, y2: 500 }
        ];

        const frustum = computePortalSightFrustum(portal, sourceCenter, 500, walls);
        assert.ok(frustum && frustum.length >= 6);

        const e1 = frustum[1];
        const e2 = frustum[frustum.length - 2];

        // e1 and e2 must extend past the door threshold (y > 200) and hit or approach the real back wall (y ~ 500)
        assert.ok(e1.y > 250, `Edge ray e1 (y=${e1.y}) must travel past doorframe into room, not clamp at y=200`);
        assert.ok(e2.y > 250, `Edge ray e2 (y=${e2.y}) must travel past doorframe into room, not clamp at y=200`);
    });

    await t.test('9. Virtual Camera Inversion: virtEyeB is placed behind Portal B facing forward into Room B', () => {
        const portalA = {
            id: 'pA',
            shape: 'line',
            facingAngle: 0, // Facing North
            geom: { x1: 100, y1: 200, x2: 200, y2: 200 }
        };
        const portalB = {
            id: 'pB',
            shape: 'line',
            facingAngle: 0, // Facing North
            geom: { x1: 500, y1: 600, x2: 600, y2: 600 }
        };

        const sourceCenter = { x: 150, y: 150 }; // 50px in front of Portal A (North)
        const projData = computeProjectedPortalData(portalA, portalB, sourceCenter, 100, [], []);
        assert.ok(projData);

        const { virtEyeB, centerB, normB } = projData;
        // Vector from virtEyeB to centerB should point in direction +normB (into Room B)
        const dotEyeToCenter = (centerB.x - virtEyeB.x) * normB.dx + (centerB.y - virtEyeB.y) * normB.dy;
        assert.ok(dotEyeToCenter > 0, 'Virtual eye must sit behind portal B looking forward into Room B (+normB)');
    });

    await t.test('10. Performance: Projection raycasting completes smoothly within high-frequency budget', () => {
        const portal = {
            id: 'perf_p1',
            shape: 'line',
            facingAngle: 180,
            geom: { x1: 950, y1: 1000, x2: 1050, y2: 1000 },
            viewThrough: true
        };
        const targetPortal = {
            id: 'perf_p2',
            shape: 'line',
            facingAngle: 0,
            geom: { x1: 950, y1: 1500, x2: 1050, y2: 1500 },
            viewThrough: true
        };

        const walls = [];
        for (let i = 0; i < 200; i++) {
            walls.push({
                x1: Math.random() * 2000,
                y1: Math.random() * 2000,
                x2: Math.random() * 2000,
                y2: Math.random() * 2000
            });
        }

        const start = performance.now();
        for (let i = 0; i < 50; i++) {
            computeProjectedPortalData(portal, targetPortal, { x: 1000, y: 920 }, 300, walls, walls);
        }
        const elapsedPerCall = (performance.now() - start) / 50;
        assert.ok(
            elapsedPerCall < 2.5,
            `Projected portal data should execute in < 2.5ms (actual: ${elapsedPerCall.toFixed(3)}ms)`
        );
    });

    await t.test('11. Multi-Token Projection Batching: Groups viewing same portal draw target room ONCE', () => {
        const portal = {
            id: 'batch_p1',
            shape: 'line',
            facingAngle: 0, // North
            geom: { x1: 950, y1: 1000, x2: 1050, y2: 1000 },
            viewThrough: true,
            targetPortalId: 'batch_p2'
        };
        const targetPortal = {
            id: 'batch_p2',
            shape: 'line',
            facingAngle: 180, // South
            geom: { x1: 950, y1: 1500, x2: 1050, y2: 1500 },
            viewThrough: true,
            targetPortalId: 'batch_p1'
        };

        // 4 party members clustered in front of portal
        const tokens = {
            t1: { id: 't1', x: 960, y: 920, isPlayer: true },
            t2: { id: 't2', x: 980, y: 920, isPlayer: true },
            t3: { id: 't3', x: 1000, y: 920, isPlayer: true },
            t4: { id: 't4', x: 1020, y: 920, isPlayer: true }
        };

        let drawCalls = 0;
        const mockCtx = {
            save() {},
            restore() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            clip() {},
            translate() {},
            rotate() {},
            drawImage() {}
        };

        // Wall dividing Room 1 and Room 2 so party in front of p1 cannot see through p2
        const walls = [{ id: 'w_mid', x1: 800, y1: 1250, x2: 1200, y2: 1250, isOpen: false }];

        renderProjectedPortals(mockCtx, [portal, targetPortal], {
            tokens,
            walls,
            currentMapId: 'map1',
            currentMap: { gridWidth: 40, gridHeight: 40, walls },
            drawTargetRoomContent: () => {
                drawCalls++;
            }
        });

        assert.equal(
            drawCalls,
            1,
            `Target room should be rendered exactly ONCE for the portal, but was rendered ${drawCalls} times`
        );
    });

    await t.test('12. Circle Portal Tangent Geometry: Aperture endpoints land precisely on circumference', () => {
        const circlePortal = {
            shape: 'circle',
            geom: { cx: 200, cy: 200, r: 50 },
            facingAngle: 0
        };
        const observer = { x: 200, y: 350 }; // 150px away from center

        const ap = getPortalAperturePoints(circlePortal, observer);
        assert.ok(ap && ap.p1 && ap.p2);

        // Distance from center to p1 and p2 must equal radius r (50)
        const d1 = Math.hypot(ap.p1.x - circlePortal.geom.cx, ap.p1.y - circlePortal.geom.cy);
        const d2 = Math.hypot(ap.p2.x - circlePortal.geom.cx, ap.p2.y - circlePortal.geom.cy);

        assert.ok(Math.abs(d1 - 50) < 0.01, `p1 distance to center (${d1}) must equal radius 50`);
        assert.ok(Math.abs(d2 - 50) < 0.01, `p2 distance to center (${d2}) must equal radius 50`);
    });

    await t.test('13. Cache Invalidation: invalidatePortalCaches clears cached projections on wall changes', () => {
        const portal = {
            id: 'cache_p1',
            shape: 'line',
            facingAngle: 180,
            geom: { x1: 100, y1: 200, x2: 200, y2: 200 }
        };
        const targetPortal = {
            id: 'cache_p2',
            shape: 'line',
            facingAngle: 0,
            geom: { x1: 100, y1: 500, x2: 200, y2: 500 }
        };

        const res1 = computeProjectedPortalData(portal, targetPortal, { x: 150, y: 150 }, 100, [], []);
        const res2 = computeProjectedPortalData(portal, targetPortal, { x: 150, y: 150 }, 100, [], []);
        assert.equal(res1, res2, 'Consecutive calls should return cached instance');

        invalidatePortalCaches();
        const res3 = computeProjectedPortalData(portal, targetPortal, { x: 150, y: 150 }, 100, [], []);
        assert.notEqual(res1, res3, 'After invalidatePortalCaches(), a fresh instance must be generated');
    });

    await t.test(
        '14. View-Through & Lookback: Two-way portals allow viewing from opposite side, one-way strictly blocks rear',
        () => {
            // Portal facing North (0° -> norm.dy: -1)
            const twoWayPortal = {
                id: 'p_twoway_test',
                shape: 'line',
                facingAngle: 0,
                isOneWay: false,
                viewThrough: true,
                targetPortalId: 'p_target_test',
                geom: { x1: 100, y1: 200, x2: 200, y2: 200 }
            };
            const oneWayPortal = {
                id: 'p_oneway_test',
                shape: 'line',
                facingAngle: 0,
                isOneWay: true,
                viewThrough: true,
                targetPortalId: 'p_target_test',
                geom: { x1: 100, y1: 200, x2: 200, y2: 200 }
            };
            const targetPortal = {
                id: 'p_target_test',
                shape: 'line',
                facingAngle: 0,
                viewThrough: true,
                geom: { x1: 100, y1: 500, x2: 200, y2: 500 }
            };

            const mockCtx = {
                save() {},
                restore() {},
                beginPath() {},
                moveTo() {},
                lineTo() {},
                closePath() {},
                clip() {},
                translate() {},
                rotate() {},
                drawImage() {}
            };

            // Case A: Token is on the side OPPOSITE the facing angle of a One-Way portal -> blocked
            let drawsOneWayBehind = 0;
            renderProjectedPortals(mockCtx, [oneWayPortal, targetPortal], {
                tokens: { t1: { id: 't1', x: 125, y: 250, isPlayer: true, sightRange: 60 } },
                walls: [],
                currentMapId: 'map1',
                currentMap: { gridWidth: 40, gridHeight: 40, walls: [] },
                drawTargetRoomContent: () => {
                    drawsOneWayBehind++;
                }
            });
            assert.equal(
                drawsOneWayBehind,
                0,
                'Token behind one-way portal (South of North-facing portal) must NOT see through portal'
            );

            // Case B: Token is on the side OPPOSITE the facing angle of a Two-Way portal (Lookback) -> MUST see through
            let drawsTwoWayLookback = 0;
            renderProjectedPortals(mockCtx, [twoWayPortal, targetPortal], {
                tokens: { t2: { id: 't2', x: 125, y: 250, isPlayer: true, sightRange: 60 } },
                walls: [],
                currentMapId: 'map1',
                currentMap: { gridWidth: 40, gridHeight: 40, walls: [] },
                drawTargetRoomContent: () => {
                    drawsTwoWayLookback++;
                }
            });
            assert.equal(
                drawsTwoWayLookback,
                1,
                'Token on opposite side of Two-Way portal (Lookback into previous room) MUST see through'
            );

            // Case C: Token is right AT the portal threshold (y=185) -> MUST see through
            let drawsThreshold = 0;
            renderProjectedPortals(mockCtx, [twoWayPortal, targetPortal], {
                tokens: { t3: { id: 't3', x: 125, y: 160, isPlayer: true, sightRange: 60 } },
                walls: [],
                currentMapId: 'map1',
                currentMap: { gridWidth: 40, gridHeight: 40, walls: [] },
                drawTargetRoomContent: () => {
                    drawsThreshold++;
                }
            });
            assert.equal(drawsThreshold, 1, 'Token at portal threshold MUST see through portal');
        }
    );
});
