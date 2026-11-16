/**
 * test/test_token_ui_pan_lifecycle.mjs
 * Headless Node unit test suite verifying Token HUD layer delta transforms
 * across live camera panning lifecycles (Right-Click, Middle-Click, Spacebar CAD Pan, Window Blur).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

class MockElement {
    constructor(id, tagName = 'div') {
        this.id = id;
        this.tagName = tagName.toUpperCase();
        this.style = {};
        this.classList = new Set();
        this.listeners = {};
    }

    addEventListener(event, handler) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
    }

    removeEventListener(event, handler) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }

    dispatchEvent(event) {
        const handlers = this.listeners[event.type] || [];
        handlers.forEach((h) => h(event));
    }
}

class MockEvent {
    constructor(type, props = {}) {
        this.type = type;
        this.defaultPrevented = false;
        this.propagationStopped = false;
        Object.assign(this, props);
    }

    preventDefault() {
        this.defaultPrevented = true;
    }

    stopPropagation() {
        this.propagationStopped = true;
    }
}

function setupMockEnvironment() {
    const elements = new Map();
    const tokenHudLayer = new MockElement('vtt-token-hud-layer');
    const canvasContainer = new MockElement('vtt-canvas-container');
    const canvasInteraction = new MockElement('vtt-canvas-interaction', 'canvas');
    canvasInteraction.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });

    elements.set('vtt-token-hud-layer', tokenHudLayer);
    elements.set('vtt-canvas-container', canvasContainer);
    elements.set('vtt-canvas-interaction', canvasInteraction);

    const windowListeners = {};
    const mockWindow = {
        addEventListener: (event, handler) => {
            if (!windowListeners[event]) windowListeners[event] = [];
            windowListeners[event].push(handler);
        },
        removeEventListener: (event, handler) => {
            if (!windowListeners[event]) return;
            windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
        },
        dispatchEvent: (event) => {
            const handlers = windowListeners[event.type] || [];
            handlers.forEach((h) => h(event));
        },
        VTT: { role: 'GM', username: 'DM_Tester' }
    };

    const mockDocument = {
        getElementById: (id) => elements.get(id) || null,
        activeElement: null,
        querySelector: () => null
    };

    globalThis.window = mockWindow;
    globalThis.document = mockDocument;

    return { tokenHudLayer, canvasContainer, canvasInteraction, mockWindow, mockDocument };
}

test('Token UI Live Pan Lifecycle - Right-Click Pan Delta Synchronization', async () => {
    const { tokenHudLayer, canvasInteraction, mockWindow } = setupMockEnvironment();

    const { setupPointerInteraction } = await import('../vtt/js/canvas/vtt-canvas-interaction.js');

    let renderAllCount = 0;
    const ctx = {
        panX: 100,
        panY: 50,
        zoom: 1.0,
        activeTool: 'select',
        currentMapId: 'map_test_1',
        tokens: {},
        renderAll: () => {
            renderAllCount++;
        },
        updateContainerTransform: () => {}
    };

    setupPointerInteraction(ctx);

    // 1. Right-click mousedown to initiate panning
    canvasInteraction.dispatchEvent(
        new MockEvent('mousedown', {
            button: 2,
            clientX: 200,
            clientY: 150
        })
    );

    assert.equal(ctx.isPanning, true, 'ctx.isPanning should be true after right-click mousedown');
    assert.equal(ctx.hasPanned, false, 'ctx.hasPanned should be false before move');
    assert.equal(ctx.panStartPanX, 100, 'ctx.panStartPanX should record initial panX');
    assert.equal(ctx.panStartPanY, 50, 'ctx.panStartPanY should record initial panY');

    // 2. Mousemove delta (+150px X, +75px Y)
    mockWindow.dispatchEvent(
        new MockEvent('mousemove', {
            clientX: 350,
            clientY: 225
        })
    );

    assert.equal(ctx.hasPanned, true, 'ctx.hasPanned should be true after mousemove');
    assert.equal(ctx.panX, 250, 'panX should update to 250 (100 + 150)');
    assert.equal(ctx.panY, 125, 'panY should update to 125 (50 + 75)');
    assert.equal(
        tokenHudLayer.style.transform,
        'translate3d(150px, 75px, 0)',
        '#vtt-token-hud-layer should carry exact hardware delta translate3d during pan'
    );

    // 3. Mouseup ends panning, clears layer transform, and calls renderAll
    mockWindow.dispatchEvent(new MockEvent('mouseup', { button: 2 }));

    assert.equal(ctx.isPanning, false, 'ctx.isPanning should reset to false on mouseup');
    assert.equal(
        tokenHudLayer.style.transform,
        '',
        '#vtt-token-hud-layer style.transform must be cleared to empty string on mouseup'
    );
    assert.ok(renderAllCount >= 1, 'renderAll() must be called to re-render permanent token UI coordinates');
});

test('Token UI Live Pan Lifecycle - Middle-Click Pan Delta Synchronization', async () => {
    const { tokenHudLayer, canvasInteraction, mockWindow } = setupMockEnvironment();

    const { setupPointerInteraction } = await import('../vtt/js/canvas/vtt-canvas-interaction.js');

    let renderAllCalled = false;
    const ctx = {
        panX: 0,
        panY: 0,
        zoom: 1.0,
        activeTool: 'select',
        currentMapId: 'map_test_1',
        tokens: {},
        renderAll: () => {
            renderAllCalled = true;
        },
        updateContainerTransform: () => {}
    };

    setupPointerInteraction(ctx);

    // Middle-click mousedown
    canvasInteraction.dispatchEvent(
        new MockEvent('mousedown', {
            button: 1,
            clientX: 500,
            clientY: 400
        })
    );

    assert.equal(ctx.isPanning, true, 'Middle click should initiate panning');

    // Move diagonally by -80px X, -60px Y
    mockWindow.dispatchEvent(
        new MockEvent('mousemove', {
            clientX: 420,
            clientY: 340
        })
    );

    assert.equal(
        tokenHudLayer.style.transform,
        'translate3d(-80px, -60px, 0)',
        'Middle-click drag should apply negative delta translate3d'
    );

    mockWindow.dispatchEvent(new MockEvent('mouseup', { button: 1 }));
    assert.equal(ctx.isPanning, false);
    assert.equal(tokenHudLayer.style.transform, '', 'Layer transform cleared on mouseup');
    assert.equal(renderAllCalled, true);
});

test('Token UI Live Pan Lifecycle - Spacebar CAD Pan Mode', async () => {
    const { tokenHudLayer, canvasInteraction, mockWindow } = setupMockEnvironment();

    const { setupPointerInteraction } = await import('../vtt/js/canvas/vtt-canvas-interaction.js');

    const ctx = {
        panX: 200,
        panY: 300,
        zoom: 1.0,
        activeTool: 'select',
        currentMapId: 'map_test_1',
        tokens: {},
        renderAll: () => {},
        updateContainerTransform: () => {}
    };

    setupPointerInteraction(ctx);

    // Press Spacebar
    mockWindow.dispatchEvent(new MockEvent('keydown', { code: 'Space', key: ' ' }));
    assert.equal(canvasInteraction.style.cursor, 'grab', 'Cursor changes to grab when Space is held');

    // Left click drag while Space is held
    canvasInteraction.dispatchEvent(
        new MockEvent('mousedown', {
            button: 0,
            clientX: 100,
            clientY: 100
        })
    );

    assert.equal(ctx.isPanning, true, 'Space + Left click mousedown should initiate panning');
    assert.equal(canvasInteraction.style.cursor, 'grabbing', 'Cursor changes to grabbing during Space drag');

    mockWindow.dispatchEvent(
        new MockEvent('mousemove', {
            clientX: 175,
            clientY: 125
        })
    );

    assert.equal(
        tokenHudLayer.style.transform,
        'translate3d(75px, 25px, 0)',
        'Space drag applies live delta translate3d'
    );

    // Release Spacebar
    mockWindow.dispatchEvent(new MockEvent('keyup', { code: 'Space', key: ' ' }));
    assert.equal(ctx.isPanning, false, 'Spacebar release aborts/commits panning');
    assert.equal(tokenHudLayer.style.transform, '', 'Layer transform cleared on Spacebar release');
});

test('Token UI Live Pan Lifecycle - Window Blur Cleanup', async () => {
    const { tokenHudLayer, canvasInteraction, mockWindow } = setupMockEnvironment();

    const { setupPointerInteraction } = await import('../vtt/js/canvas/vtt-canvas-interaction.js');

    const ctx = {
        panX: 50,
        panY: 50,
        zoom: 1.0,
        activeTool: 'select',
        currentMapId: 'map_test_1',
        tokens: {},
        renderAll: () => {},
        updateContainerTransform: () => {}
    };

    setupPointerInteraction(ctx);

    // Start pan and move
    canvasInteraction.dispatchEvent(new MockEvent('mousedown', { button: 2, clientX: 100, clientY: 100 }));
    mockWindow.dispatchEvent(new MockEvent('mousemove', { clientX: 180, clientY: 160 }));
    assert.equal(tokenHudLayer.style.transform, 'translate3d(80px, 60px, 0)');

    // Window loses focus
    mockWindow.dispatchEvent(new MockEvent('blur'));
    assert.equal(ctx.isPanning, false, 'ctx.isPanning resets to false on window blur');
    assert.equal(tokenHudLayer.style.transform, '', 'tokenHudLayer.style.transform cleared on window blur');
});
