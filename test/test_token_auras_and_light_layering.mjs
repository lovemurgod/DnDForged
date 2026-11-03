import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { renderFogOfWarLayer, renderLightFloorWashPass } from '../vtt/js/canvas/vtt-canvas-fog.js';
import { renderTokenAurasPass } from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';
import { computeVisibilityPolygon } from '../vtt/js/canvas/vtt-canvas-visibility.js';

class MockContext2D {
    constructor() {
        this.savedStates = [];
        this.paths = [];
        this.currentPath = [];
        this.globalCompositeOperation = 'source-over';
        this.globalAlpha = 1.0;
        this.fillStyle = '';
        this.strokeStyle = '';
        this.lineWidth = 1;
        this.shadowColor = '';
        this.shadowBlur = 0;
        this.clipCalls = 0;
        this.fillCalls = 0;
        this.strokeCalls = 0;
        this.drawnImages = [];
        this.arcs = [];
        this.rects = [];
        this.clearedRects = [];
    }

    save() {
        this.savedStates.push({
            gco: this.globalCompositeOperation,
            ga: this.globalAlpha,
            fs: this.fillStyle,
            ss: this.strokeStyle
        });
    }

    restore() {
        const st = this.savedStates.pop();
        if (st) {
            this.globalCompositeOperation = st.gco;
            this.globalAlpha = st.ga;
            this.fillStyle = st.fs;
            this.strokeStyle = st.ss;
        }
    }

    clearRect(x, y, w, h) {
        this.clearedRects.push({ x, y, w, h });
    }

    fillRect() { }

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

    arc(x, y, radius, startAngle, endAngle) {
        this.arcs.push({ x, y, radius, startAngle, endAngle });
    }

    rect(x, y, w, h) {
        this.rects.push({ x, y, w, h });
    }

    clip() {
        this.clipCalls++;
    }

    fill() {
        this.fillCalls++;
    }

    stroke() {
        this.strokeCalls++;
    }

    scale() { }

    drawImage(img, x, y) {
        this.drawnImages.push({ x, y, gco: this.globalCompositeOperation });
    }

    createRadialGradient(x0, y0, r0, x1, y1, r1) {
        const stops = [];
        return {
            x0, y0, r0, x1, y1, r1,
            stops,
            addColorStop(offset, color) {
                stops.push({ offset, color });
            }
        };
    }

    createConicGradient() {
        return {
            addColorStop() { }
        };
    }
}

test('Layering Architecture: HTML & CSS Canvas Stacking Order', async (t) => {
    const htmlPath = path.resolve('vtt/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const cssPath = path.resolve('vtt/css/components/hud.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    await t.test('Floor effects canvas is present in HTML directly below grid and tokens', () => {
        assert.ok(htmlContent.includes('id="vtt-canvas-floor-effects"'), 'Floor effects canvas must exist in HTML');
        assert.ok(htmlContent.includes('style="z-index: 2; pointer-events: none;"'), 'Floor effects canvas must be z-index 2');
        assert.ok(htmlContent.includes('id="vtt-canvas-grid" style="z-index: 3;"'), 'Grid canvas must be z-index 3');
        assert.ok(htmlContent.includes('id="vtt-canvas-portals" style="z-index: 4;'), 'Portals canvas must be z-index 4');
        assert.ok(htmlContent.includes('id="vtt-html-overlays"'), 'Token overlays must exist');
    });

    await t.test('HUD CSS enforces correct stacking hierarchy', () => {
        assert.ok(cssContent.includes('#vtt-canvas-floor-effects'), 'CSS must define #vtt-canvas-floor-effects');
        assert.ok(cssContent.includes('z-index: 2;'), 'Floor effects canvas must have z-index: 2');
        assert.ok(cssContent.includes('z-index: 3;'), 'Grid must have z-index: 3');
        assert.ok(cssContent.includes('z-index: 4;'), 'Portals must have z-index: 4');
        assert.ok(cssContent.includes('z-index: 5;'), 'Tokens HTML overlay must have z-index: 5');
    });
});

test('Token Auras: Floor-Level Canvas Rendering', async (t) => {
    const mockCtxFloor = new MockContext2D();

    const tokens = {
        tok_paladin: {
            id: 'tok_paladin',
            x: 200,
            y: 200,
            auras: [
                {
                    name: 'Aura of Protection',
                    range: 10,
                    shape: 'circle',
                    style: 'both',
                    color: '#d4af37',
                    opacity: 0.35,
                    enabled: true
                }
            ]
        },
        tok_cleric: {
            id: 'tok_cleric',
            x: 400,
            y: 400,
            auras: [
                {
                    name: 'Spirit Guardians',
                    range: 15,
                    shape: 'square',
                    style: 'fill',
                    color: '#6a0dad',
                    opacity: 0.4,
                    enabled: true
                }
            ]
        }
    };

    const grid = { size: 50, scale: 1, feetPerSquare: 5 };
    const vtt = { role: 'GM' };

    await t.test('renderTokenAurasPass renders both circular and square auras to the floor context', () => {
        renderTokenAurasPass(mockCtxFloor, tokens, grid, vtt, 'token', {
            isRectInViewport: () => true,
            isPointVisible: () => true,
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50, tokenRadius: 25 })
        });

        assert.ok(mockCtxFloor.arcs.length >= 1, 'Circular aura must draw an arc on floor canvas');
        assert.ok(mockCtxFloor.rects.length >= 1, 'Square aura must draw a rect on floor canvas');
        assert.ok(mockCtxFloor.fillCalls >= 2, 'Both auras should have fill() called');
        assert.ok(mockCtxFloor.strokeCalls >= 1, 'Aura with style="both" should have stroke() called');
    });

    await t.test('renderTokenAurasPass gracefully handles null floor context', () => {
        assert.doesNotThrow(() => {
            renderTokenAurasPass(null, tokens, grid, vtt, 'token');
        });
    });
});

test('Light Emission: Floor Washes Below Tokens', async (t) => {
    const mockCtxFloor = new MockContext2D();
    const mockCtxFog = new MockContext2D();
    const mockScratchCanvas = { width: 400, height: 400 };
    const mockCtxScratch = new MockContext2D();

    const tokens = {
        tok_torch_bearer: {
            id: 'tok_torch_bearer',
            x: 300,
            y: 300,
            lightEnabled: true,
            lightBright: 20,
            lightDim: 20,
            lightColor: '#ffaa33',
            lightAnimationType: 'none'
        }
    };

    const standaloneLights = [
        {
            id: 'wall_sconce_1',
            x: 600,
            y: 200,
            lightBright: 15,
            lightDim: 15,
            lightColor: '#00ddff',
            animationType: 'none'
        }
    ];

    const walls = [];
    const grid = { size: 50, scale: 1, feetPerSquare: 5 };

    await t.test('renderLightFloorWashPass paints colored radial gradients for token and standalone lights', () => {
        renderLightFloorWashPass(mockCtxFloor, 1000, 1000, {
            tokens,
            lights: standaloneLights,
            walls,
            grid,
            vtt: { role: 'GM' },
            computeVisPolyFn: computeVisibilityPolygon,
            getTokenCenter: (t) => ({ x: t.x + 25, y: t.y + 25 }),
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50, tokenRadius: 25 })
        });

        // 1 token light + 1 standalone light = 2 fill calls on floor context
        assert.equal(mockCtxFloor.fillCalls, 2, 'Floor context must receive 2 light color fills');
    });

    await t.test('renderFogOfWarLayer delegates light wash to ctxFloor and does not taint ctxFog with colored wash', () => {
        const floorCtx = new MockContext2D();
        const fogCtx = new MockContext2D();

        renderFogOfWarLayer(1000, 1000, {
            ctxFog: fogCtx,
            canvasFog: { width: 1000, height: 1000 },
            ctxFloor: floorCtx,
            scratchLightCanvas: mockScratchCanvas,
            ctxScratchLight: mockCtxScratch,
            tokens,
            lights: standaloneLights,
            walls,
            grid,
            vtt: { role: 'GM' },
            computeVisPolyFn: computeVisibilityPolygon,
            getTokenCenter: (t) => ({ x: t.x + 25, y: t.y + 25 }),
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50, tokenRadius: 25 })
        });

        // ctxFog punches holes with destination-out
        assert.ok(fogCtx.drawnImages.length >= 1, 'ctxFog must have drawn light scratch mask');
        const hasDestOut = fogCtx.drawnImages.some((img) => img.gco === 'destination-out');
        assert.ok(hasDestOut, 'ctxFog must use destination-out to carve holes in fog');

        // ctxFloor received the colored washes
        assert.equal(floorCtx.fillCalls, 2, 'ctxFloor must receive the colored washes');
    });

    await t.test('Light floor washes render even when Fog of War is disabled on the map', () => {
        const floorCtx = new MockContext2D();
        const fogCtx = new MockContext2D();

        const campaignState = {
            maps: {
                map_daylight: {
                    id: 'map_daylight',
                    lightingSettings: {
                        fogOfWar: false
                    }
                }
            }
        };

        renderFogOfWarLayer(1000, 1000, {
            ctxFog: fogCtx,
            canvasFog: { width: 1000, height: 1000 },
            ctxFloor: floorCtx,
            scratchLightCanvas: mockScratchCanvas,
            ctxScratchLight: mockCtxScratch,
            vtt: { role: 'GM', campaignState },
            currentMapId: 'map_daylight',
            tokens,
            lights: standaloneLights,
            walls,
            grid,
            computeVisPolyFn: computeVisibilityPolygon,
            getTokenCenter: (t) => ({ x: t.x + 25, y: t.y + 25 }),
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50, tokenRadius: 25 })
        });

        assert.equal(floorCtx.fillCalls, 2, 'Light floor washes must still be rendered when fogOfWar is false');
    });
});

