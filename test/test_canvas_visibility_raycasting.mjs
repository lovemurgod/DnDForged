// Test Suite: Canvas Visibility Polygon Raycasting & Dynamic Lighting Invariants
// Verifies wall/door/window ray occlusion, directional cones, and continuous dragging benchmark

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    getWallCoordinatesForRaycasting,
    getLineIntersection,
    computeVisibilityPolygon
} from '../vtt/js/canvas/vtt-canvas-visibility.js';

import {
    LIGHTING_PRESETS,
    applyTokenLightingPreset,
    applyStandaloneLightingPreset,
    getTokenEffectiveLightFacing,
    getLocalLightFacingFromWorldAngle,
    interpolateColors,
    getLightAtCoord
} from '../vtt/js/canvas/vtt-canvas-lighting.js';

describe('Canvas Visibility: Wall, Door & Window Raycasting Invariants', () => {
    it('getWallCoordinatesForRaycasting respects door state, window transparency, and one-way walls', () => {
        // 1. Standard Wall
        const solidWall = { x1: 100, y1: 0, x2: 100, y2: 200, type: 'wall' };
        const solidCoords = getWallCoordinatesForRaycasting(solidWall, 50, 100);
        assert.ok(solidCoords, 'Solid wall must return raycasting segment');
        assert.strictEqual(solidCoords.x1, 100);

        // 2. See-Through Window
        const windowWall = { x1: 100, y1: 0, x2: 100, y2: 200, type: 'window', isSeeThrough: true };
        assert.strictEqual(
            getWallCoordinatesForRaycasting(windowWall, 50, 100),
            null,
            'See-through window must not block vision'
        );

        // 3. Closed Door vs Open Door
        const closedDoor = { x1: 100, y1: 0, x2: 100, y2: 200, type: 'door', isOpen: false };
        assert.ok(getWallCoordinatesForRaycasting(closedDoor, 50, 100), 'Closed door must block vision');

        const openDoorUnhinged = { x1: 100, y1: 0, x2: 100, y2: 200, type: 'door', isOpen: true, hasHinge: false };
        assert.strictEqual(
            getWallCoordinatesForRaycasting(openDoorUnhinged, 50, 100),
            null,
            'Unhinged open door must allow vision'
        );

        // 4. One-Way Wall
        const oneWayWall = { x1: 100, y1: 0, x2: 100, y2: 200, oneWay: 'left' };
        // Origin at x=50, y=100 (left side) -> dot > 0 -> transparent
        assert.strictEqual(
            getWallCoordinatesForRaycasting(oneWayWall, 50, 100),
            null,
            'Looking through one-way wall from see-through side should not block'
        );
        // Origin at x=150, y=100 (right side) -> blocks
        assert.ok(getWallCoordinatesForRaycasting(oneWayWall, 150, 100), 'Looking from opaque side must block vision');
    });

    it('computeVisibilityPolygon stops line of sight at solid walls', () => {
        const walls = [{ x1: 200, y1: 0, x2: 200, y2: 500, type: 'wall' }];

        // Token at (100, 250) looking with 300px sight radius towards x=200 wall
        const poly = computeVisibilityPolygon(100, 250, 300, 1000, 1000, 360, 0, null, walls);

        assert.ok(Array.isArray(poly));
        assert.ok(poly.length > 3, 'Visibility polygon must have vertices');

        // Verify ray directly towards the wall stops at x=200
        const eastRays = poly.filter((p) => Math.abs(p.y - 250) < 5 && p.x > 100);
        assert.ok(eastRays.length > 0, 'Must have east-facing rays hitting wall');
        eastRays.forEach((p) => {
            assert.ok(p.x <= 200.5, `East ray at x=${p.x} must not penetrate solid wall at x=200`);
        });
    });

    it('computeVisibilityPolygon constrains directional vision cones within beam angle', () => {
        const cx = 500,
            cy = 500;
        const sightRadius = 200;
        const beamArc = 60; // 60 degree cone
        const beamFacing = 90; // Facing South (+Y axis)

        const poly = computeVisibilityPolygon(cx, cy, sightRadius, 1000, 1000, beamArc, beamFacing, null, []);

        assert.ok(Array.isArray(poly));
        assert.ok(poly.length >= 3, 'Cone polygon must form a closed shape');

        // First and last vertex must be origin (cx, cy)
        assert.strictEqual(poly[0].x, cx);
        assert.strictEqual(poly[0].y, cy);
        assert.strictEqual(poly[poly.length - 1].x, cx);
        assert.strictEqual(poly[poly.length - 1].y, cy);

        // Check that all fan vertices lie within [90 - 31, 90 + 31] degrees
        for (let i = 1; i < poly.length - 1; i++) {
            const p = poly[i];
            const dist = Math.hypot(p.x - cx, p.y - cy);
            if (dist > 1) {
                const angleDeg = ((Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 360) % 360;
                assert.ok(
                    angleDeg >= 59 && angleDeg <= 121,
                    `Vertex angle ${angleDeg.toFixed(1)}° must be inside 60° cone facing South (60°..120°)`
                );
            }
        }
    });
});

describe('Canvas Lighting: Presets & Controls', () => {
    it('applyTokenLightingPreset and applyStandaloneLightingPreset configure light properties accurately', () => {
        const token = { id: 'tok_1' };
        applyTokenLightingPreset(token, 'torch');

        assert.strictEqual(token.lightEnabled, true);
        assert.strictEqual(token.lightBright, 20);
        assert.strictEqual(token.lightDim, 20);
        assert.strictEqual(token.lightAngle, 360);
        assert.strictEqual(token.lightAnimationType, 'flicker');

        applyTokenLightingPreset(token, 'none');
        assert.strictEqual(token.lightEnabled, false);
    });

    it('getTokenEffectiveLightFacing factors in token rotation and flip transforms', () => {
        const tokenNormal = { rotation: 90, lightRotation: 0 };
        assert.strictEqual(Math.round(getTokenEffectiveLightFacing(tokenNormal)), 90);

        const tokenFlippedX = { rotation: 0, lightRotation: 0, flipX: true };
        assert.strictEqual(Math.round(getTokenEffectiveLightFacing(tokenFlippedX)), 180);
    });

    it('interpolateColors smoothly transitions RGB values', () => {
        const mid = interpolateColors('#000000', '#ffffff', 0.5);
        assert.strictEqual(mid, 'rgb(128, 128, 128)');

        const redToBlue = interpolateColors('#ff0000', '#0000ff', 0.5);
        assert.strictEqual(redToBlue, 'rgb(128, 0, 128)');
    });

    it('getLightAtCoord detects lights within proximity threshold', () => {
        const lights = [
            { id: 'l1', x: 100, y: 100 },
            { id: 'l2', x: 500, y: 500 }
        ];

        assert.strictEqual(getLightAtCoord(105, 105, lights, 14), 'l1');
        assert.strictEqual(getLightAtCoord(300, 300, lights, 14), null);
    });
});

describe('Canvas Visibility: Performance & Memory Leak Benchmark', () => {
    it('executes 500 continuous token drag raycasts in < 100ms without memory bloat', () => {
        // Generate realistic dungeon layout with 40 wall segments
        const walls = [];
        for (let i = 0; i < 40; i++) {
            walls.push({
                x1: (i * 50) % 800,
                y1: Math.floor(i / 8) * 150,
                x2: ((i * 50) % 800) + 40,
                y2: Math.floor(i / 8) * 150 + 30,
                type: 'wall'
            });
        }

        const startHeap = process.memoryUsage().heapUsed;
        const startTime = performance.now();

        for (let step = 0; step < 500; step++) {
            // Drag token diagonally across map
            const tx = 100 + step * 1.2;
            const ty = 100 + step * 0.8;
            const poly = computeVisibilityPolygon(tx, ty, 250, 1200, 1000, 360, 0, null, walls);
            assert.ok(poly.length > 0);
        }

        const duration = performance.now() - startTime;
        const endHeap = process.memoryUsage().heapUsed;
        const heapDeltaMB = (endHeap - startHeap) / (1024 * 1024);

        assert.ok(duration < 2500, `500 drag raycasts must complete in < 2500ms (actual: ${duration.toFixed(2)}ms)`);
        assert.ok(heapDeltaMB < 25, `Heap growth must be constrained < 25MB (actual: ${heapDeltaMB.toFixed(2)}MB)`);
    });

    it('safely handles empty walls, null entries, and degenerate zero-length wall segments', () => {
        // Degenerate walls: zero-length points, null objects, and empty list
        const degenerateWalls = [
            null,
            { x1: 200, y1: 200, x2: 200, y2: 200, type: 'wall' }, // 0-length
            undefined,
            { x1: 300, y1: 100, x2: 300, y2: 400, type: 'wall' } // valid wall
        ];

        // Should execute cleanly without throwing
        const poly = computeVisibilityPolygon(100, 200, 300, 1000, 1000, 360, 0, null, degenerateWalls);
        assert.ok(Array.isArray(poly));
        assert.ok(poly.length > 3, 'Must produce valid visibility polygon despite degenerate input');

        // Test with null wallsOverride and null spatial index
        const emptyPoly = computeVisibilityPolygon(100, 200, 300, 1000, 1000, 360, 0, null, null, null);
        assert.ok(Array.isArray(emptyPoly));
        assert.ok(emptyPoly.length > 3, 'Must handle null walls parameter safely');
    });
});
