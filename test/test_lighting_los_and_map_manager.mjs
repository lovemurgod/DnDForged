import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { hasMapManagerDataChanged, buildMapThumbnailMarkup } from '../vtt/js/canvas/vtt-canvas-map-manager.js';

import { renderFogOfWarLayer } from '../vtt/js/canvas/vtt-canvas-fog.js';
import { computeVisibilityPolygon } from '../vtt/js/canvas/vtt-canvas-visibility.js';

test('Map Manager: Socket Sync Fingerprint Caching & Performance', async (t) => {
    const fakeCamp = {
        maps: {
            m1: { id: 'm1', name: 'Dungeon Room 1', folder: 'Dungeons' },
            m2: { id: 'm2', name: 'Dungeon Room 2', folder: 'Dungeons' }
        },
        mapOrder: ['m1', 'm2'],
        activeMapId: 'm1',
        activeGMMapId: 'm1',
        playerMapOverrides: {}
    };

    await t.test('hasMapManagerDataChanged produces fingerprint on initial check', () => {
        const fp1 = hasMapManagerDataChanged(fakeCamp, '');
        assert.ok(fp1, 'Fingerprint should be non-empty string');
        assert.equal(typeof fp1, 'string');
    });

    await t.test(
        'hasMapManagerDataChanged returns false when fingerprint is unchanged (prevents socket re-render loops)',
        () => {
            const fp1 = hasMapManagerDataChanged(fakeCamp, '');
            const fp2 = hasMapManagerDataChanged(fakeCamp, fp1);
            assert.equal(fp2, false, 'Should return false when campaign state fingerprint matches lastFingerprint');
        }
    );

    await t.test('hasMapManagerDataChanged detects when active map or map list updates', () => {
        const fp1 = hasMapManagerDataChanged(fakeCamp, '');
        const updatedCamp = {
            ...fakeCamp,
            activeMapId: 'm2'
        };
        const fp2 = hasMapManagerDataChanged(updatedCamp, fp1);
        assert.ok(fp2, 'Should return new fingerprint when activeMapId changes');
        assert.notEqual(fp2, fp1);
    });

    await t.test('buildMapThumbnailMarkup uses lazy data-src for videos to prevent mass network preloading', () => {
        const videoMap = { id: 'v1', name: 'Animated Tavern' };
        const markup = buildMapThumbnailMarkup(videoMap, 'https://example.com/map.mp4', true, false);
        assert.ok(markup.includes('data-src="https://example.com/map.mp4'), 'Should use data-src for lazy loading');
        assert.ok(markup.includes('preload="none"'), 'Should set preload to none');
    });
});

test('Map Manager HTML & UI Element Alignment', async (t) => {
    const htmlPath = path.resolve('vtt/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    await t.test('Inline folder creator elements match JS identifiers', () => {
        assert.ok(htmlContent.includes('id="map-folder-inline-creator"'), 'Folder creator container ID must match');
        assert.ok(htmlContent.includes('id="input-map-new-folder"'), 'Input folder name ID must match');
        assert.ok(htmlContent.includes('id="btn-map-save-new-folder"'), 'Save button ID must match');
        assert.ok(htmlContent.includes('id="btn-map-cancel-new-folder"'), 'Cancel button ID must match');
        assert.ok(htmlContent.includes('id="btn-map-add-folder"'), '+ New button ID must match');
    });

    await t.test('Map creation panel includes comprehensive grid & scene controls', () => {
        assert.ok(htmlContent.includes('id="new-map-grid-width"'), 'Grid width input must exist');
        assert.ok(htmlContent.includes('id="new-map-grid-height"'), 'Grid height input must exist');
        assert.ok(htmlContent.includes('id="new-map-grid-size"'), 'Cell size input must exist');
        assert.ok(htmlContent.includes('id="new-map-grid-color"'), 'Grid color input must exist');
        assert.ok(htmlContent.includes('id="new-map-grid-opacity"'), 'Grid opacity input must exist');
        assert.ok(htmlContent.includes('id="new-map-fog-of-war"'), 'Fog of war toggle must exist');
        assert.ok(htmlContent.includes('id="new-map-daylight-mode"'), 'Daylight mode toggle must exist');
    });
});

test('Dynamic Lighting: Line-of-Sight Occlusion & Wall Isolation', async (t) => {
    // Setup a 1000x1000 canvas with a solid vertical wall at x = 500 from y = 0 to y = 1000
    // Room A: x from 0 to 500 (Player token at x = 200, y = 500)
    // Room B: x from 500 to 1000 (Light source at x = 800, y = 500)
    const dividingWall = { x1: 500, y1: 0, x2: 500, y2: 1000 };
    const walls = [dividingWall];

    // Mock 2D Context
    class MockContext {
        constructor() {
            this.savedStates = [];
            this.paths = [];
            this.currentPath = [];
            this.globalCompositeOperation = 'source-over';
            this.clipCalls = 0;
            this.drawnImages = [];
        }
        save() {
            this.savedStates.push({
                gco: this.globalCompositeOperation
            });
        }
        restore() {
            const st = this.savedStates.pop();
            if (st) this.globalCompositeOperation = st.gco;
        }
        clearRect() {}
        fillRect() {}
        beginPath() {
            this.currentPath = [];
            this.paths.push(this.currentPath);
        }
        moveTo(x, y) {
            this.currentPath.push({ op: 'moveTo', x, y });
        }
        lineTo(x, y) {
            this.currentPath.push({ op: 'lineTo', x, y });
        }
        closePath() {
            this.currentPath.push({ op: 'closePath' });
        }
        clip() {
            this.clipCalls++;
        }
        fill() {}
        scale() {}
        drawImage(img, x, y) {
            this.drawnImages.push({ x, y, gco: this.globalCompositeOperation });
        }
        createRadialGradient() {
            return {
                addColorStop: () => {}
            };
        }
        createConicGradient() {
            return {
                addColorStop: () => {}
            };
        }
    }

    const mockCtxFog = new MockContext();
    const mockCanvasFog = { width: 1000, height: 1000 };
    const mockCtxScratch = new MockContext();
    const mockScratchCanvas = { width: 400, height: 400 };

    const playerToken = {
        id: 'tok_player_1',
        x: 175,
        y: 475,
        isPlayer: true,
        sightRange: 60
    };

    const lightInRoomB = {
        id: 'light_torch_room_b',
        x: 800,
        y: 500,
        lightBright: 30,
        lightDim: 30,
        lightColor: '#ff9d3b'
    };

    await t.test('Player in Room A has LOS blocked at x = 500 dividing wall', () => {
        const poly = computeVisibilityPolygon(200, 500, 1500, 1000, 1000, 360, 0, null, null, walls);
        assert.ok(poly && poly.length > 2);
        // All vertices in Room A's LOS should have x <= 500.01 (cannot penetrate Room B)
        const maxX = Math.max(...poly.map((p) => p.x));
        assert.ok(maxX <= 500.1, `Player LOS maxX (${maxX}) must not penetrate past wall at x=500`);
    });

    await t.test('Light in Room B has its illuminated radius stopped at x = 500 dividing wall', () => {
        const poly = computeVisibilityPolygon(800, 500, 600, 1000, 1000, 360, 0, null, null, walls);
        assert.ok(poly && poly.length > 2);
        // All vertices in Room B's light polygon should have x >= 499.9
        const minX = Math.min(...poly.map((p) => p.x));
        assert.ok(minX >= 499.9, `Room B light minX (${minX}) must not penetrate into Room A`);
    });

    await t.test('renderFogOfWarLayer restricts light rendering to active player LOS polygons in player mode', () => {
        const result = renderFogOfWarLayer(1000, 1000, {
            ctxFog: mockCtxFog,
            canvasFog: mockCanvasFog,
            scratchLightCanvas: mockScratchCanvas,
            ctxScratchLight: mockCtxScratch,
            vtt: { role: 'PLAYER' },
            tokens: { tok_player_1: playerToken },
            lights: [lightInRoomB],
            walls: walls,
            wallsVersion: 1,
            grid: { size: 50, scale: 1, feetPerSquare: 5 },
            getTokenCenter: (t) => ({ x: t.x + 25, y: t.y + 25 }),
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50, tokenRadius: 25 }),
            isTokenControlledByPlayer: () => true,
            computeVisPolyFn: computeVisibilityPolygon
        });

        assert.ok(result, 'Result should be returned');
        assert.ok(Array.isArray(result), 'Result should be an array');
        assert.ok(result.playerLosPolygons, 'Should include playerLosPolygons');
        assert.equal(result.playerLosPolygons.length, 1, 'Should have 1 player LOS polygon');

        // Verify player LOS is contained within Room A
        const playerLos = result.playerLosPolygons[0];
        const maxLosX = Math.max(...playerLos.map((p) => p.x));
        assert.ok(maxLosX <= 500.1, 'Player LOS must be strictly bounded by dividing wall');

        // In player mode, clip() was called to constrain lighting to player LOS
        assert.ok(mockCtxFog.clipCalls >= 1, 'ctxFog must have clipped to player LOS');
    });

    await t.test('When no players have LOS to an illuminated room, tokens in that room are not visible', () => {
        // Point in Room A: visible
        const ptInRoomA = { x: 220, y: 500 };
        // Point in Room B (lit by torch, but blocked by wall): NOT visible to player in Room A
        const ptInRoomB = { x: 800, y: 500 };

        const playerLos = computeVisibilityPolygon(200, 500, 1500, 1000, 1000, 360, 0, null, null, walls);
        const torchLitPoly = computeVisibilityPolygon(800, 500, 600, 1000, 1000, 360, 0, null, null, walls);

        const isPointInPolygon = (pt, poly) => {
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const xi = poly[i].x,
                    yi = poly[i].y;
                const xj = poly[j].x,
                    yj = poly[j].y;
                const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
                if (intersect) inside = !inside;
            }
            return inside;
        };

        const isVisibleToPlayer = (pt) => {
            // Check direct unlit vision or (in LOS and in lit area)
            const inLos = isPointInPolygon(pt, playerLos);
            const inLight = isPointInPolygon(pt, torchLitPoly);
            return inLos && inLight;
        };

        assert.equal(isVisibleToPlayer(ptInRoomB), false, 'Point in Room B must NOT be visible to player in Room A');
    });
});
