import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure document is defined for Node test environment
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        createElement: () => ({ style: {} }),
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
    };
}

import { initCanvasLifecycle } from '../vtt/js/canvas/vtt-canvas-lifecycle.js';
import {
    buildMapThumbnailMarkup,
    observeCardThumbnail,
    attachThumbnailHoverPreview,
    cleanupMapGridMedia
} from '../vtt/js/canvas/vtt-canvas-map-manager.js';

test('Map Manager Performance Fix: Lifecycle Multi-Reason Pausing & Resuming', async (t) => {
    await t.test('pause("map_manager") halts canvas loops and resume("map_manager") restarts them', () => {
        let pauseCount = 0;
        let resumeCount = 0;
        let renderAllCount = 0;

        const lifecycle = initCanvasLifecycle({
            onPause: () => {
                pauseCount++;
            },
            onResume: () => {
                resumeCount++;
            },
            renderAll: () => {
                renderAllCount++;
            }
        });

        assert.equal(lifecycle.isCanvasVisible(), true);

        // Map manager opens
        lifecycle.pause('map_manager');
        assert.equal(lifecycle.isCanvasVisible(), false);
        assert.equal(pauseCount, 1);
        assert.equal(resumeCount, 0);

        // Map manager closes
        lifecycle.resume('map_manager');
        assert.equal(lifecycle.isCanvasVisible(), true);
        assert.equal(resumeCount, 1);
        assert.equal(renderAllCount, 1);
    });

    await t.test('Multi-reason pause stacking prevents premature resume if tab is hidden', () => {
        let pauseCount = 0;
        let resumeCount = 0;

        const lifecycle = initCanvasLifecycle({
            onPause: () => {
                pauseCount++;
            },
            onResume: () => {
                resumeCount++;
            }
        });

        // Tab hidden + Map manager opened
        lifecycle.pause('visibility');
        lifecycle.pause('map_manager');
        assert.equal(pauseCount, 1);
        assert.equal(lifecycle.isCanvasVisible(), false);

        // Closing map manager while tab is still hidden must NOT resume canvas
        lifecycle.resume('map_manager');
        assert.equal(resumeCount, 0);
        assert.equal(lifecycle.isCanvasVisible(), false);

        // Finally tab becomes visible again
        lifecycle.resume('visibility');
        assert.equal(resumeCount, 1);
        assert.equal(lifecycle.isCanvasVisible(), true);
    });
});

test('Map Manager Performance Fix: Video Thumbnails Display Placeholders & Prevent Auto-Seeking', () => {
    const videoMap = { id: 'm_anim', name: 'Animated Dragon Lair' };
    const markup = buildMapThumbnailMarkup(videoMap, 'https://example.com/dungeon.mp4', true, false, '1.5rem');

    assert.ok(markup.includes('<video class="map-thumb-video"'), 'Must generate map-thumb-video');
    assert.ok(markup.includes('data-src="https://example.com/dungeon.mp4#t=0.001"'), 'Must store target in data-src');
    assert.ok(markup.includes('display: none;'), 'Video element must be default hidden to avoid decoder allocation');
    assert.ok(markup.includes('preload="none"'), 'Video must not preload automatically');
    assert.ok(markup.includes('map-thumb-video-placeholder'), 'Must provide visual placeholder icon for video map');
});

test('Map Manager Performance Fix: Static Images Lazy-Load with Placeholder', () => {
    const staticMap = { id: 'm_static', name: 'Ravenloft Crypt' };
    const markup = buildMapThumbnailMarkup(staticMap, 'https://example.com/map_huge.webp', false, false, '1.5rem');

    assert.ok(markup.includes('map-thumb-img'), 'Must have map-thumb-img class');
    assert.ok(markup.includes('data-src="https://example.com/map_huge.webp"'), 'Must use data-src for deferral');
    assert.ok(markup.includes('map-thumb-img-placeholder'), 'Must provide image placeholder icon');
});

test('Map Manager Performance Fix: cleanupMapGridMedia Teardown Unloads Hardware Decoders & Observers', () => {
    let paused = false;
    let loaded = false;
    let disconnected = false;

    const fakeVideo = {
        tagName: 'VIDEO',
        src: 'https://example.com/dungeon.mp4',
        pause() {
            paused = true;
        },
        removeAttribute(attr) {
            if (attr === 'src') this.src = '';
        },
        load() {
            loaded = true;
        }
    };

    const fakeContainer = {
        _thumbnailObserver: {
            disconnect() {
                disconnected = true;
            }
        },
        querySelectorAll(selector) {
            if (selector === 'video') return [fakeVideo];
            return [];
        }
    };

    cleanupMapGridMedia(fakeContainer);

    assert.equal(paused, true, 'Video must be paused');
    assert.equal(fakeVideo.src, '', 'Video src must be cleared');
    assert.equal(loaded, true, 'Video load() must be called to release GPU decoders');
    assert.equal(disconnected, true, 'Observer must be disconnected');
    assert.equal(fakeContainer._thumbnailObserver, null, 'Observer reference must be cleared');
});

test('Map Manager Performance Fix: Hover-Only Video Preview Playback Lifecycle', async () => {
    let playCalled = false;
    let pauseCalled = false;
    let currentTime = 5.0;

    const listeners = {};
    const fakeVideo = {
        src: '',
        dataset: { src: 'https://example.com/test.mp4' },
        style: { display: 'none' },
        play() {
            playCalled = true;
            return Promise.resolve();
        },
        pause() {
            pauseCalled = true;
        },
        get currentTime() {
            return currentTime;
        },
        set currentTime(v) {
            currentTime = v;
        }
    };

    const fakePlaceholder = { style: { display: 'flex' } };

    const fakeThumbWrap = {
        querySelector(sel) {
            if (sel === 'video.map-thumb-video') return fakeVideo;
            if (sel === '.map-thumb-video-placeholder') return fakePlaceholder;
            return null;
        },
        addEventListener(evt, fn) {
            listeners[evt] = fn;
        }
    };

    attachThumbnailHoverPreview(fakeThumbWrap);

    // Mouse enter: should attach src, show video, hide placeholder, and play
    listeners['mouseenter']();
    assert.equal(fakeVideo.src, 'https://example.com/test.mp4');
    assert.equal(fakeVideo.style.display, 'block');
    assert.equal(fakePlaceholder.style.display, 'none');
    assert.equal(playCalled, true);

    // Mouse leave: should pause, reset time, hide video, and restore placeholder
    listeners['mouseleave']();
    await Promise.resolve(); // Flush microtask queue for playPromise.then()
    assert.equal(pauseCalled, true);
    assert.equal(fakeVideo.currentTime, 0);
    assert.equal(fakeVideo.style.display, 'none');
    assert.equal(fakePlaceholder.style.display, 'flex');
});

test('Map Manager Performance Fix: CSS Neutralizes Backdrop-Filter & Glassmorphism Blur', () => {
    const cssContent = fs.readFileSync(path.join(__dirname, '../vtt/css/components/modals.css'), 'utf-8');

    assert.ok(cssContent.includes('.map-manager-modal-content'), 'Must define .map-manager-modal-content styling');
    assert.ok(
        cssContent.includes('backdrop-filter: none !important;'),
        '.map-manager-modal-content must strictly disable backdrop-filter blur'
    );
    assert.ok(
        cssContent.includes('-webkit-backdrop-filter: none !important;'),
        '.map-manager-modal-content must strictly disable -webkit-backdrop-filter blur'
    );
});
