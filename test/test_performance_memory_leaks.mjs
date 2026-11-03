import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Initialize minimal DOM environment for lifecycle tests
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
    <div id="vtt-canvas-viewport"></div>
    <div id="canvas-container">
        <canvas id="vtt-canvas-grid"></canvas>
        <canvas id="vtt-canvas-portals"></canvas>
        <canvas id="vtt-canvas-fog"></canvas>
        <canvas id="vtt-canvas-interaction"></canvas>
        <canvas id="vtt-canvas-weather"></canvas>
    </div>
    <div id="vtt-html-overlays"></div>
    <div id="vtt-map-html-overlays"></div>
    <div id="vtt-map-bg-container"></div>
</body>
</html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(dom.window.document, 'hidden', { value: false, configurable: true, writable: true });

dom.window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy(
        {
            canvas: this,
            filter: 'none'
        },
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
                    return () => ({ addColorStop() {} });
                }
                return () => {};
            },
            set(target, prop, value) {
                target[prop] = value;
                return true;
            }
        }
    );
};

const storage = {};
globalThis.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => {
        storage[k] = String(v);
    },
    removeItem: (k) => {
        delete storage[k];
    }
};

globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Import performance and memory subsystems
import { createImageCache, vttImageCache } from '../vtt/js/canvas/vtt-canvas-cache.js';
import { initCanvasLifecycle, teardownMapTransientState } from '../vtt/js/canvas/vtt-canvas-lifecycle.js';
import { initVttWeather } from '../vtt/js/vtt-weather.js';

test('Memory Leak Remediation: Bounded LRU Image Cache', async (t) => {
    await t.test('Enforces bounded capacity and evicts oldest items', () => {
        const cache = createImageCache({ maxEntries: 3 });

        cache.set('img1', { id: 1, complete: true });
        cache.set('img2', { id: 2, complete: true });
        cache.set('img3', { id: 3, complete: true });

        assert.equal(cache.stats().size, 3);
        assert.equal(cache.has('img1'), true);

        // Access img1, making it most-recently used (order becomes img2, img3, img1)
        const hit = cache.get('img1');
        assert.equal(hit.id, 1);
        assert.equal(cache.stats().hits, 1);

        // Insert 4th item; oldest item (img2) must be evicted
        cache.set('img4', { id: 4, complete: true });
        assert.equal(cache.stats().size, 3);
        assert.equal(cache.has('img2'), false, 'img2 should have been evicted as the oldest entry');
        assert.equal(cache.has('img1'), true, 'img1 was refreshed and should remain');
        assert.equal(cache.has('img3'), true);
        assert.equal(cache.has('img4'), true);
        assert.equal(cache.stats().evictions, 1);
    });

    await t.test('Sweep removes unreferenced stale map images while keeping active ones', () => {
        const cache = createImageCache({ maxEntries: 10 });

        cache.set('map1_bg.webp', { complete: true });
        cache.set('token_goblin.webp', { complete: true });
        cache.set('map2_bg.webp', { complete: true });
        cache.set('token_dragon.webp', { complete: true });

        assert.equal(cache.stats().size, 4);

        // Active tokens on Map 2
        const map2ActiveUrls = new Set(['map2_bg.webp', 'token_dragon.webp']);

        const swept = cache.sweep(map2ActiveUrls);
        assert.equal(swept, 2, 'Should have swept 2 assets belonging to Map 1');
        assert.equal(cache.stats().size, 2);
        assert.equal(cache.has('map1_bg.webp'), false);
        assert.equal(cache.has('token_goblin.webp'), false);
        assert.equal(cache.has('map2_bg.webp'), true);
        assert.equal(cache.has('token_dragon.webp'), true);
    });

    await t.test('Singleton vttImageCache exists and is bounded to 150 entries', () => {
        assert.ok(vttImageCache, 'vttImageCache singleton must exist');
        assert.equal(vttImageCache.stats().maxEntries, 150);
    });
});

test('Performance Remediation: Tab-Visibility Lifecycle Manager', async (t) => {
    await t.test('Correctly halts and resumes animations on document visibilitychange', () => {
        let pauseCalled = false;
        let resumeCalled = false;
        let renderAllCalled = false;

        const lifecycle = initCanvasLifecycle({
            onPause: () => {
                pauseCalled = true;
            },
            onResume: () => {
                resumeCalled = true;
            },
            renderAll: () => {
                renderAllCalled = true;
            }
        });

        assert.equal(lifecycle.isCanvasVisible(), true);

        // Simulate tab hidden
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        lifecycle.handleVisibilityChange();

        assert.equal(lifecycle.isCanvasVisible(), false);
        assert.equal(pauseCalled, true);
        assert.equal(resumeCalled, false);

        // Simulate tab restored to visible
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        lifecycle.handleVisibilityChange();

        assert.equal(lifecycle.isCanvasVisible(), true);
        assert.equal(resumeCalled, true);
        assert.equal(renderAllCalled, true);

        lifecycle.destroy();
    });
});

test('Memory Leak Remediation: Map Transition Deep Teardown', async (t) => {
    await t.test('teardownMapTransientState releases media decoders and removes overlay DOM nodes', () => {
        const htmlOverlays = document.getElementById('vtt-html-overlays');
        const bgContainer = document.getElementById('vtt-map-bg-container');

        // Create mock video element with paused tracking
        const video = document.createElement('video');
        video.id = 'asset_node_video1';
        video.src = 'blob:http://localhost/video-stream';
        let pauseInvoked = false;
        let loadInvoked = false;
        video.pause = () => {
            pauseInvoked = true;
        };
        video.load = () => {
            loadInvoked = true;
        };
        htmlOverlays.appendChild(video);

        // Create mock iframe element
        const iframe = document.createElement('iframe');
        iframe.id = 'asset_node_yt1';
        iframe.src = 'https://www.youtube.com/embed/test';
        bgContainer.appendChild(iframe);

        // Create token UI element
        const tokenUi = document.createElement('div');
        tokenUi.id = 'token_ui_hero1';
        htmlOverlays.appendChild(tokenUi);

        // Create mock context menu
        const ctxMenu = document.createElement('div');
        ctxMenu.id = 'vtt-token-context-menu';
        document.body.appendChild(ctxMenu);

        // Set up test cache
        const testCache = createImageCache({ maxEntries: 10 });
        testCache.set('old_map.webp', { complete: true });
        testCache.set('new_map.webp', { complete: true });

        let animationCancelCalled = false;

        const result = teardownMapTransientState({
            vtt: {
                campaignState: {
                    maps: {
                        map_next: {
                            id: 'map_next',
                            mapImage: 'new_map.webp',
                            tokens: {}
                        }
                    }
                }
            },
            newMapId: 'map_next',
            imageCache: testCache,
            cancelActiveAnimations: () => {
                animationCancelCalled = true;
            }
        });

        // Verify media elements released
        assert.equal(pauseInvoked, true, 'Video playback must be paused');
        assert.equal(loadInvoked, true, 'Video.load() must be called to release decoders');
        assert.equal(video.src, '', 'Video src must be emptied');
        assert.equal(iframe.src, 'about:blank', 'Iframe src must be reset');
        assert.equal(document.getElementById('asset_node_video1'), null);
        assert.equal(document.getElementById('asset_node_yt1'), null);
        assert.equal(document.getElementById('token_ui_hero1'), null);
        assert.equal(document.getElementById('vtt-token-context-menu'), null);

        // Verify animations cancelled and cache swept
        assert.equal(animationCancelCalled, true);
        assert.equal(testCache.has('old_map.webp'), false, 'Stale old_map image must be swept');
        assert.equal(testCache.has('new_map.webp'), true, 'New map image must be retained');
        assert.equal(result.sweptCount, 1);
        assert.equal(result.mediaCleanedCount, 2);
    });
});

test('Performance Remediation: Weather Engine Lifecycle Hooks', async (t) => {
    await t.test('Weather engine supports pause(), resume(), and clean destroy()', () => {
        const weather = initVttWeather({ role: 'GM' });
        assert.ok(weather, 'Weather engine should initialize');
        assert.ok(typeof weather.pause === 'function', 'Weather engine must have pause() method');
        assert.ok(typeof weather.resume === 'function', 'Weather engine must have resume() method');
        assert.ok(typeof weather.destroy === 'function', 'Weather engine must have destroy() method');

        assert.equal(weather.isPaused(), false);
        weather.pause();
        assert.equal(weather.isPaused(), true);

        weather.resume();
        assert.equal(weather.isPaused(), false);

        assert.doesNotThrow(() => {
            weather.destroy();
        }, 'destroy() should clean up listeners without error');
    });
});
