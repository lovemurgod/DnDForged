// DnDForged Canvas Lifecycle & Memory Cleanup Manager
// Manages tab visibility pausing/resuming and map switch teardown to prevent memory leaks

import { vttImageCache } from './vtt-canvas-cache.js';

export function initCanvasLifecycle(options = {}) {
    const { onVisibilityChange = null, onPause = null, onResume = null, renderAll = null } = options;

    let isVisible = typeof document !== 'undefined' && typeof document.hidden === 'boolean' ? !document.hidden : true;

    function handleVisibilityChange() {
        if (typeof document === 'undefined') return;
        const nowHidden = !!document.hidden;
        const nowVisible = !nowHidden;
        const stateChanged = isVisible !== nowVisible;

        isVisible = nowVisible;

        if (stateChanged) {
            if (!isVisible) {
                if (typeof onPause === 'function') onPause();
            } else {
                if (typeof onResume === 'function') onResume();
                if (typeof renderAll === 'function') renderAll();
            }
            if (typeof onVisibilityChange === 'function') {
                onVisibilityChange(isVisible);
            }
        }
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function isCanvasVisible() {
        return isVisible;
    }

    function destroy() {
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    }

    return {
        isCanvasVisible,
        destroy,
        handleVisibilityChange // exposed for testing
    };
}

/**
 * Deep teardown of transient map state, DOM media decoders, running animations, and cache sweeping
 */
export function teardownMapTransientState(context = {}) {
    const { vtt = {}, newMapId = null, imageCache = vttImageCache, cancelActiveAnimations = null } = context;

    let mediaCleanedCount = 0;

    // 1. Cancel pending animations/RAFs
    if (typeof cancelActiveAnimations === 'function') {
        try {
            cancelActiveAnimations();
        } catch (e) {
            console.warn('[VTT Lifecycle] Error cancelling active animations:', e);
        }
    }

    // 2. Deep Teardown of Media Elements (<video>, <iframe>) across overlay containers
    if (typeof document !== 'undefined') {
        const containers = [
            document.getElementById('vtt-html-overlays'),
            document.getElementById('vtt-map-html-overlays'),
            document.getElementById('vtt-map-bg-container')
        ].filter(Boolean);

        containers.forEach((container) => {
            // Cleanup media nodes explicitly to release browser hardware video decoders and audio streams
            container.querySelectorAll('video, iframe').forEach((node) => {
                try {
                    if (node.tagName === 'VIDEO') {
                        node.pause();
                        node.removeAttribute('src');
                        node.src = '';
                        node.load();
                    } else if (node.tagName === 'IFRAME') {
                        node.src = 'about:blank';
                    }
                    node.remove();
                    mediaCleanedCount++;
                } catch (err) {
                    console.warn('[VTT Lifecycle] Error releasing media node:', err);
                    node.remove();
                }
            });

            // Cleanup token DOM overlays
            container.querySelectorAll('[id^="asset_node_"], [id^="token_ui_"]').forEach((node) => {
                node.remove();
            });
        });

        // Remove floating context menus and tooltips
        const tokenContextMenu = document.getElementById('vtt-token-context-menu');
        if (tokenContextMenu) tokenContextMenu.remove();

        const canvasContextMenu = document.querySelector('.context-menu');
        if (canvasContextMenu) canvasContextMenu.remove();
    }

    // 3. LRU Cache Sweeping: Retain only assets needed for the upcoming map
    let sweptCount = 0;
    if (newMapId && vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[newMapId]) {
        const targetMap = vtt.campaignState.maps[newMapId];
        const activeUrls = new Set();

        if (targetMap.mapImage) activeUrls.add(targetMap.mapImage.trim());
        if (targetMap.thumbnail) activeUrls.add(targetMap.thumbnail.trim());

        if (targetMap.tokens && typeof targetMap.tokens === 'object') {
            Object.values(targetMap.tokens).forEach((t) => {
                if (t && t.img) activeUrls.add(t.img.trim());
            });
        }

        if (imageCache && typeof imageCache.sweep === 'function') {
            sweptCount = imageCache.sweep(activeUrls);
        }
    }

    return {
        mediaCleanedCount,
        sweptCount
    };
}
