/**
 * test/helpers/vtt-environment.mjs
 * Explicit headless DOM and HTML5 Canvas environment manager for ForgeDVTT tests.
 * Provides explicit setup and teardown lifecycles to prevent cross-test global pollution.
 */

import { JSDOM } from 'jsdom';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ForgeDVTT Test Harness</title></head>
<body>
    <div id="vtt-canvas-viewport">
        <div id="canvas-container">
            <canvas id="vtt-canvas-grid"></canvas>
            <canvas id="vtt-canvas-portals"></canvas>
            <canvas id="vtt-canvas-fog"></canvas>
            <canvas id="vtt-canvas-interaction"></canvas>
            <canvas id="vtt-canvas-weather"></canvas>
        </div>
    </div>
    <div id="vtt-html-overlays"></div>
    <div id="vtt-map-html-overlays"></div>
    <div id="vtt-map-bg-container"></div>
    <div id="vtt-chat-panel"></div>
    <div id="token-tooltip-container"></div>
    <div id="selection-box" style="display:none;"></div>
</body>
</html>`;

let originalGlobals = null;
let activeDom = null;

/**
 * Creates a robust 2D Canvas context mock with no-op functions and gradient stubs.
 * @param {HTMLCanvasElement} canvas
 * @returns {object}
 */
export function createMockCanvas2DContext(canvas) {
    const gradientStub = {
        addColorStop: () => {}
    };

    return new Proxy(
        {
            canvas: canvas || { width: 800, height: 600 },
            fillStyle: '#000000',
            strokeStyle: '#000000',
            lineWidth: 1,
            globalAlpha: 1.0,
            globalCompositeOperation: 'source-over',
            filter: 'none',
            font: '12px sans-serif',
            textAlign: 'start',
            textBaseline: 'alphabetic',
            shadowColor: 'transparent',
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0
        },
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
                    return () => gradientStub;
                }
                if (prop === 'measureText') {
                    return (text) => ({ width: String(text || '').length * 8 });
                }
                if (prop === 'getImageData') {
                    return (x, y, w, h) => ({
                        data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
                        width: w,
                        height: h
                    });
                }
                // Default function stub for canvas 2D draw / transform methods
                return () => {};
            },
            set(target, prop, value) {
                target[prop] = value;
                return true;
            }
        }
    );
}

/**
 * Set up a clean headless DOM environment and mount browser globals onto globalThis.
 * @param {object} options
 * @param {string} [options.html] Custom HTML string (defaults to standard VTT viewport)
 * @param {string} [options.url] Custom URL (defaults to http://localhost:5050/vtt.html)
 * @param {object} [options.localStorageData] Initial localStorage key-value map
 * @returns {JSDOM} The initialized JSDOM instance
 */
export function setupVttEnvironment(options = {}) {
    if (originalGlobals) {
        // Clean up previous un-teardown state if called repeatedly
        teardownVttEnvironment();
    }

    originalGlobals = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        localStorage: globalThis.localStorage,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        cancelAnimationFrame: globalThis.cancelAnimationFrame,
        ResizeObserver: globalThis.ResizeObserver,
        HTMLCanvasElement: globalThis.HTMLCanvasElement
    };

    const dom = new JSDOM(options.html || DEFAULT_HTML, {
        url: options.url || 'http://localhost:5050/vtt.html',
        pretendToBeVisual: true
    });
    activeDom = dom;

    const { window } = dom;

    // Attach mock canvas 2D context
    window.HTMLCanvasElement.prototype.getContext = function (contextType) {
        if (contextType === '2d') {
            if (!this._mock2dCtx) {
                this._mock2dCtx = createMockCanvas2DContext(this);
            }
            return this._mock2dCtx;
        }
        return null;
    };

    // In-memory localStorage mock
    const storageStore = new Map(Object.entries(options.localStorageData || {}));
    const mockLocalStorage = {
        getItem: (k) => (storageStore.has(k) ? storageStore.get(k) : null),
        setItem: (k, v) => storageStore.set(k, String(v)),
        removeItem: (k) => storageStore.delete(k),
        clear: () => storageStore.clear(),
        get length() {
            return storageStore.size;
        },
        key: (idx) => Array.from(storageStore.keys())[idx] ?? null
    };

    Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        configurable: true,
        writable: true
    });

    // Animation frame stubs
    window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);

    // ResizeObserver stub
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

    // Mount to globalThis safely (using defineProperty to respect non-writable or getter-only globals)
    const globalsToMount = {
        window,
        document: window.document,
        localStorage: mockLocalStorage,
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        ResizeObserver: window.ResizeObserver,
        HTMLCanvasElement: window.HTMLCanvasElement
    };

    // If window.navigator is needed, safely define on globalThis
    if (
        window.navigator &&
        (!globalThis.navigator || Object.getOwnPropertyDescriptor(globalThis, 'navigator')?.configurable)
    ) {
        try {
            Object.defineProperty(globalThis, 'navigator', {
                value: window.navigator,
                configurable: true,
                writable: true
            });
        } catch (_) {}
    }

    for (const [key, value] of Object.entries(globalsToMount)) {
        try {
            Object.defineProperty(globalThis, key, {
                value,
                configurable: true,
                writable: true
            });
        } catch (_) {
            globalThis[key] = value;
        }
    }

    return dom;
}

/**
 * Teardown the headless DOM environment and restore globalThis to its pre-test state.
 */
export function teardownVttEnvironment() {
    if (!originalGlobals) return;

    for (const [key, value] of Object.entries(originalGlobals)) {
        if (key === 'navigator') continue; // Do not attempt to overwrite native Node navigator
        try {
            if (value === undefined) {
                delete globalThis[key];
            } else {
                Object.defineProperty(globalThis, key, {
                    value,
                    configurable: true,
                    writable: true
                });
            }
        } catch (_) {}
    }

    if (activeDom && activeDom.window) {
        try {
            activeDom.window.close();
        } catch (_) {}
    }

    activeDom = null;
    originalGlobals = null;
}
