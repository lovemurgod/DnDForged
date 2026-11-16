import test from 'node:test';
import assert from 'node:assert/strict';

import { setupPointerInteraction } from '../vtt/js/canvas/vtt-canvas-interaction.js';
import { setupKeyboardShortcuts } from '../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js';

function createMockElement() {
    const listeners = {};
    return {
        listeners,
        style: {},
        addEventListener(event, fn) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
        },
        removeEventListener(event, fn) {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter((f) => f !== fn);
            }
        },
        dispatchEvent(event) {
            const handlers = listeners[event.type] || [];
            handlers.forEach((h) => h(event));
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 1000, height: 1000 };
        }
    };
}

test('Group Move & Scaling Test Suite', async (t) => {
    await t.test('Multi-token drag and drop preserves selection and updates all token positions', () => {
        const mockCanvas = createMockElement();
        const globalListeners = {};
        const mockWindow = {
            addEventListener(event, fn) {
                if (!globalListeners[event]) globalListeners[event] = [];
                globalListeners[event].push(fn);
            },
            emit(event, payload) {
                (globalListeners[event] || []).forEach((fn) => fn(payload));
            }
        };

        const tokens = {
            tok1: { id: 'tok1', x: 100, y: 100, width: 50, height: 50, layer: 'token', isPlayer: true },
            tok2: { id: 'tok2', x: 200, y: 100, width: 50, height: 50, layer: 'token', isPlayer: true }
        };

        const emittedTokenUpdates = [];
        const ctx = {
            canvasInteraction: mockCanvas,
            tokens,
            activeTool: 'select',
            activeLayer: 'token',
            zoom: 1,
            panX: 0,
            panY: 0,
            grid: { size: 50, scale: 1 },
            selectedTokenIds: new Set(['tok1', 'tok2']),
            selectedTokenId: 'tok1',
            getTokenAtPoint: (mouse) => {
                if (mouse.x >= 100 && mouse.x <= 150 && mouse.y >= 100 && mouse.y <= 150) return tokens.tok1;
                if (mouse.x >= 200 && mouse.x <= 250 && mouse.y >= 100 && mouse.y <= 150) return tokens.tok2;
                return null;
            },
            isTokenControlledByPlayer: () => true,
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
            renderAll: () => {},
            emitTokenUpdates: (t) => emittedTokenUpdates.push({ ...t }),
            snapToGrid: (x, y) => ({ x: Math.round(x / 50) * 50, y: Math.round(y / 50) * 50 }),
            vtt: { role: 'GM', socket: { emit: () => {} } }
        };

        // Initialize pointer interaction in test context
        const originalWindow = globalThis.window;
        globalThis.window = mockWindow;
        try {
            setupPointerInteraction(ctx);

            // 1. Mouse down on tok1 (which is already part of the 2-token selection)
            mockCanvas.dispatchEvent({
                type: 'mousedown',
                button: 0,
                clientX: 125,
                clientY: 125,
                ctrlKey: false,
                shiftKey: false,
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            // Verify selection was NOT collapsed to single token!
            assert.equal(ctx.selectedTokenIds.size, 2, 'Selection should preserve all 2 selected tokens');
            assert.ok(ctx.selectedTokenIds.has('tok1') && ctx.selectedTokenIds.has('tok2'));
            assert.equal(ctx.dragTargetId, 'tok1', 'Clicked token should be drag target');

            // 2. Mouse move to shift position by +50, +50
            mockWindow.emit('mousemove', {
                clientX: 175,
                clientY: 175,
                shiftKey: false,
                altKey: false,
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            // Both tokens should have moved together
            assert.equal(tokens.tok1.x, 150, 'tok1 should move by +50');
            assert.equal(tokens.tok1.y, 150, 'tok1 should move by +50');
            assert.equal(tokens.tok2.x, 250, 'tok2 should move by +50 maintaining formation');
            assert.equal(tokens.tok2.y, 150, 'tok2 should move by +50 maintaining formation');

            // 3. Mouse up
            mockWindow.emit('mouseup', {
                button: 0,
                clientX: 175,
                clientY: 175,
                preventDefault: () => {}
            });

            assert.equal(ctx.dragTargetId, null, 'Drag target should be cleared');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    await t.test('Universal keyboard movement nudges objects across different layers', () => {
        const globalListeners = {};
        const mockWindow = {
            addEventListener(event, fn) {
                if (!globalListeners[event]) globalListeners[event] = [];
                globalListeners[event].push(fn);
            },
            emit(event, payload) {
                (globalListeners[event] || []).forEach((fn) => fn(payload));
            }
        };

        const tokens = {
            tok1: { id: 'tok1', x: 100, y: 100, layer: 'token' }
        };
        const walls = [
            { id: 'w1', x1: 50, y1: 50, x2: 150, y2: 50 },
            { id: 'w2', x1: 150, y1: 50, x2: 150, y2: 150 }
        ];
        const lights = [{ id: 'l1', x: 300, y: 300 }];
        const notes = [{ id: 'n1', x: 400, y: 400 }];

        let wallsUpdated = false;
        let lightsUpdated = false;
        let notesUpdated = false;

        const ctx = {
            tokens,
            walls,
            lights,
            notes,
            grid: { size: 50, scale: 1 },
            selectedTokenIds: new Set(),
            selectedWallIdxs: new Set([0, 1]),
            selectedLightIds: new Set(['l1']),
            selectedNoteIds: new Set(['n1']),
            activeLayer: 'lighting',
            isTokenControlledByPlayer: () => true,
            isDrawingControlledByPlayer: () => true,
            isShapeControlledByPlayer: () => true,
            renderAll: () => {},
            vtt: {
                role: 'GM',
                socket: {
                    emit: (evt) => {
                        if (evt === 'walls:update') wallsUpdated = true;
                        if (evt === 'lights:update') lightsUpdated = true;
                        if (evt === 'notes:update') notesUpdated = true;
                    }
                }
            }
        };

        const originalWindow = globalThis.window;
        globalThis.window = mockWindow;
        try {
            setupKeyboardShortcuts(ctx);

            // Press ArrowRight (dx = +50)
            mockWindow.emit('keydown', {
                key: 'ArrowRight',
                code: 'ArrowRight',
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                target: { tagName: 'BODY' },
                preventDefault: () => {}
            });

            // Verify walls shifted by +50 in x
            assert.equal(walls[0].x1, 100);
            assert.equal(walls[0].x2, 200);
            assert.equal(walls[1].x1, 200);
            assert.equal(walls[1].x2, 200);
            assert.ok(wallsUpdated, 'walls:update should be emitted');

            // Verify lights shifted by +50 in x
            assert.equal(lights[0].x, 350);
            assert.ok(lightsUpdated, 'lights:update should be emitted');

            // Verify notes shifted by +50 in x
            assert.equal(notes[0].x, 450);
            assert.ok(notesUpdated, 'notes:update should be emitted');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    await t.test('Group scaling scales art assets proportionally with aspect ratio locked', () => {
        const mockCanvas = createMockElement();
        const globalListeners = {};
        const mockWindow = {
            addEventListener(event, fn) {
                if (!globalListeners[event]) globalListeners[event] = [];
                globalListeners[event].push(fn);
            },
            emit(event, payload) {
                (globalListeners[event] || []).forEach((fn) => fn(payload));
            }
        };

        const tokens = {
            art1: { id: 'art1', x: 100, y: 100, width: 100, height: 100, isAsset: true, layer: 'map' },
            art2: { id: 'art2', x: 200, y: 100, width: 100, height: 100, isAsset: true, layer: 'map' }
        };

        const ctx = {
            canvasInteraction: mockCanvas,
            tokens,
            activeTool: 'select',
            activeLayer: 'map',
            zoom: 1,
            panX: 0,
            panY: 0,
            grid: { size: 50, scale: 1 },
            selectedTokenIds: new Set(['art1', 'art2']),
            isTokenControlledByPlayer: () => true,
            getTokenDrawDimensions: (t) => ({ drawW: t.width || 100, drawH: t.height || 100 }),
            renderAll: () => {},
            snapToGrid: (x, y) => ({ x: Math.round(x / 50) * 50, y: Math.round(y / 50) * 50 }),
            vtt: { role: 'GM', socket: { emit: () => {} } }
        };

        const originalWindow = globalThis.window;
        globalThis.window = mockWindow;
        try {
            setupPointerInteraction(ctx);

            // Group bounding box: minX: 100, minY: 100, maxX: 300, maxY: 200 (width: 200, height: 100)
            // SE corner handle is at (300, 200)
            mockCanvas.dispatchEvent({
                type: 'mousedown',
                button: 0,
                clientX: 300,
                clientY: 200,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            // Scale by dragging SE corner outwards by 2x: mouse to (500, 300)
            // dx = 500 - 100 = 400 -> scale = 400 / 200 = 2.0
            mockWindow.emit('mousemove', {
                clientX: 500,
                clientY: 300,
                shiftKey: false,
                altKey: true, // continuous free scale
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            // Verify both assets scaled proportionally
            assert.equal(tokens.art1.x, 100, 'art1 origin should stay at anchor');
            assert.equal(tokens.art1.width, 200, 'art1 width should double');
            assert.equal(tokens.art1.height, 200, 'art1 height should double');

            assert.equal(tokens.art2.x, 300, 'art2 origin should scale to 100 + 100*2 = 300');
            assert.equal(tokens.art2.width, 200, 'art2 width should double');
            assert.equal(tokens.art2.height, 200, 'art2 height should double');

            // Mouse up
            mockWindow.emit('mouseup', {
                button: 0,
                clientX: 500,
                clientY: 300,
                preventDefault: () => {}
            });
        } finally {
            globalThis.window = originalWindow;
        }
    });

    await t.test('Group scaling scales dynamic lighting walls proportionally', () => {
        const mockCanvas = createMockElement();
        const globalListeners = {};
        const mockWindow = {
            addEventListener(event, fn) {
                if (!globalListeners[event]) globalListeners[event] = [];
                globalListeners[event].push(fn);
            },
            emit(event, payload) {
                (globalListeners[event] || []).forEach((fn) => fn(payload));
            }
        };

        const walls = [
            { id: 'w1', x1: 100, y1: 100, x2: 200, y2: 100 },
            { id: 'w2', x1: 200, y1: 100, x2: 200, y2: 200 }
        ];

        let wallsEmitted = false;
        const ctx = {
            canvasInteraction: mockCanvas,
            walls,
            activeTool: 'select',
            activeLayer: 'lighting',
            zoom: 1,
            panX: 0,
            panY: 0,
            grid: { size: 50, scale: 1 },
            selectedWallIdxs: new Set([0, 1]),
            renderAll: () => {},
            snapToGrid: (x, y) => ({ x: Math.round(x / 50) * 50, y: Math.round(y / 50) * 50 }),
            vtt: {
                role: 'GM',
                socket: {
                    emit: (evt) => {
                        if (evt === 'walls:update') wallsEmitted = true;
                    }
                }
            }
        };

        const originalWindow = globalThis.window;
        globalThis.window = mockWindow;
        try {
            setupPointerInteraction(ctx);

            // BBox: minX: 100, minY: 100, maxX: 200, maxY: 200 (width: 100, height: 100)
            // SE corner handle is at (200, 200)
            mockCanvas.dispatchEvent({
                type: 'mousedown',
                button: 0,
                clientX: 200,
                clientY: 200,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            // Drag to double the room size: (300, 300)
            mockWindow.emit('mousemove', {
                clientX: 300,
                clientY: 300,
                shiftKey: false,
                altKey: true,
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            // Check scaled wall coordinates
            assert.equal(walls[0].x1, 100);
            assert.equal(walls[0].y1, 100);
            assert.equal(walls[0].x2, 300);
            assert.equal(walls[0].y2, 100);

            assert.equal(walls[1].x1, 300);
            assert.equal(walls[1].y1, 100);
            assert.equal(walls[1].x2, 300);
            assert.equal(walls[1].y2, 300);

            // Mouse up
            mockWindow.emit('mouseup', {
                button: 0,
                clientX: 300,
                clientY: 300,
                preventDefault: () => {}
            });

            assert.ok(wallsEmitted, 'walls:update should be emitted after group scale');
        } finally {
            globalThis.window = originalWindow;
        }
    });
});
