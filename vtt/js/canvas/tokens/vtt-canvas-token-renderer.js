/**
 * vtt-canvas-token-renderer.js
 * Token rendering, DOM overlay sync, YouTube ping-pong video player,
 * auras, visual ping/damage burst animations, and token path motion interpolation.
 */

import { CONDITION_ICONS } from './vtt-canvas-token-rollers.js';
import { getSafeVttUrl } from '../../vtt-utils.js';
import { loadPlayerTokenPrefs } from './vtt-canvas-token-config.js';
import { spawnProceduralCombatFX } from './vtt-canvas-procedural-fx.js';

// Module-level context for animation loops and renderer utilities
const tokenRendererContext = {
    renderAll: () => {},
    tokens: {},
    vtt: {},
    getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50, tokenRadius: 25 })
};

function getRenderAll() {
    return (
        tokenRendererContext.renderAll ||
        (typeof window !== 'undefined' && window.VTT?.canvasEngine?.renderAll) ||
        (() => {})
    );
}

function getTokens() {
    return tokenRendererContext.tokens || (typeof window !== 'undefined' && window.VTT?.canvasEngine?.tokens) || {};
}

function getVtt() {
    return tokenRendererContext.vtt || (typeof window !== 'undefined' ? window.VTT : {});
}

// Global state for ping-pong controllers and visual effects
const requestAnimFrame = (cb) => {
    if (typeof requestAnimationFrame !== 'undefined') return requestAnimationFrame(cb);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(cb);
    }
    return setTimeout(cb, 16);
};

let activePings = [];
let pingAnimFrame = null;
let activeDamageFX = [];
let damageFXAnimFrame = null;
let activeTokenShudders = {};
let processedAnimKeys = new Set();
let tokenAnimations = {};
let tokenAnimFrame = null;

// ==========================================
// YouTube Dual-Player Ping-Pong Controller
// ==========================================
// ==========================================
const ytPingPongControllers = {};

function cleanupAllYouTubePingPong() {
    Object.keys(ytPingPongControllers).forEach((id) => {
        try {
            if (ytPingPongControllers[id]?.destroy) ytPingPongControllers[id].destroy();
        } catch (e) {}
        delete ytPingPongControllers[id];
    });
}

function cleanupYouTubePingPongForId(id) {
    if (ytPingPongControllers[id]) {
        try {
            if (ytPingPongControllers[id]?.destroy) ytPingPongControllers[id].destroy();
        } catch (e) {}
        delete ytPingPongControllers[id];
    }
}

function cleanupMediaElement(node) {
    if (!node) return;
    const id = node.id?.startsWith('asset_node_') ? node.id.substring(11) : null;
    if (id && typeof cleanupYouTubePingPongForId === 'function') {
        cleanupYouTubePingPongForId(id);
    }
    if (node.tagName === 'VIDEO') {
        try {
            node.pause();
            node.removeAttribute('src');
            node.load();
        } catch (e) {}
    } else if (node.tagName === 'IFRAME') {
        try {
            node.src = 'about:blank';
        } catch (e) {}
    }
    node.querySelectorAll?.('video')?.forEach((v) => {
        try {
            v.pause();
            v.removeAttribute('src');
            v.load();
        } catch (e) {}
    });
    node.querySelectorAll?.('iframe')?.forEach((f) => {
        try {
            f.src = 'about:blank';
        } catch (e) {}
    });
    try {
        node.remove();
    } catch (e) {}
}

function ensureYouTubeIframeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (window._ytIframeApiPromise) return window._ytIframeApiPromise;

    window._ytIframeApiPromise = new Promise((resolve) => {
        const checkExisting = () => {
            if (window.YT && window.YT.Player) {
                resolve(window.YT);
                return true;
            }
            return false;
        };

        if (checkExisting()) return;

        const prevOnReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof prevOnReady === 'function') {
                try {
                    prevOnReady();
                } catch (e) {}
            }
            resolve(window.YT);
        };

        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScript = document.getElementsByTagName('script')[0] || document.head;
            firstScript.parentNode.insertBefore(tag, firstScript);
        }

        let checkCount = 0;
        const interval = setInterval(() => {
            checkCount++;
            if (checkExisting() || checkCount > 35) {
                clearInterval(interval);
                resolve(window.YT || null);
            }
        }, 100);
    });

    return window._ytIframeApiPromise;
}

function initDualYouTubePlayer(container, rawUrl, id) {
    if (ytPingPongControllers[id]) {
        try {
            ytPingPongControllers[id].destroy();
        } catch (e) {}
        delete ytPingPongControllers[id];
    }

    const ytMatch = rawUrl
        ? rawUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)
        : null;
    if (!ytMatch || !ytMatch[1]) return;
    const videoId = ytMatch[1];

    container.innerHTML = '';
    container.dataset.rawImg = rawUrl;
    container.style.position = 'absolute';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';

    const wrapA = document.createElement('div');
    wrapA.id = `yt_wrap_a_${id}`;
    wrapA.style.cssText =
        'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:1;transition:opacity 0.3s ease;overflow:hidden;';
    const targetA = document.createElement('div');
    targetA.id = `yt_player_a_${id}`;
    // Scale by 1.10 and center to crop out YouTube top title header and bottom watermark
    targetA.style.cssText =
        'width:100%;height:100%;pointer-events:none;transform:scale(1.1);transform-origin:center center;';
    wrapA.appendChild(targetA);
    container.appendChild(wrapA);

    const wrapB = document.createElement('div');
    wrapB.id = `yt_wrap_b_${id}`;
    wrapB.style.cssText =
        'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:0;transition:opacity 0.3s ease;overflow:hidden;';
    const targetB = document.createElement('div');
    targetB.id = `yt_player_b_${id}`;
    targetB.style.cssText =
        'width:100%;height:100%;pointer-events:none;transform:scale(1.1);transform-origin:center center;';
    wrapB.appendChild(targetB);
    container.appendChild(wrapB);

    let playerA = null;
    let playerB = null;
    let activePlayer = 'A';
    let prewarmed = false;
    let pollTimer = null;
    let isDestroyed = false;
    let startMonitoring = () => {};

    let isPaused = false;
    const controller = {
        rawUrl,
        pause: () => {
            isPaused = true;
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            try {
                if (activePlayer === 'A' && playerA && typeof playerA.pauseVideo === 'function') playerA.pauseVideo();
                else if (activePlayer === 'B' && playerB && typeof playerB.pauseVideo === 'function')
                    playerB.pauseVideo();
            } catch (e) {}
        },
        resume: () => {
            if (isDestroyed) return;
            isPaused = false;
            try {
                if (activePlayer === 'A' && playerA && typeof playerA.playVideo === 'function') playerA.playVideo();
                else if (activePlayer === 'B' && playerB && typeof playerB.playVideo === 'function')
                    playerB.playVideo();
            } catch (e) {}
            startMonitoring();
        },
        destroy: () => {
            isDestroyed = true;
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            try {
                if (playerA && typeof playerA.destroy === 'function') playerA.destroy();
            } catch (e) {}
            try {
                if (playerB && typeof playerB.destroy === 'function') playerB.destroy();
            } catch (e) {}
            playerA = null;
            playerB = null;
            container.innerHTML = '';
        }
    };
    ytPingPongControllers[id] = controller;

    ensureYouTubeIframeApi().then((YT) => {
        if (isDestroyed) return;
        if (!YT || !YT.Player) {
            // Fallback to standard single iframe with crop wrapper if API is blocked or offline
            container.innerHTML = `<div style="width:100%;height:100%;overflow:hidden;position:relative;"><iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&showinfo=0&playlist=${videoId}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" style="width:100%;height:100%;pointer-events:none;border:none;transform:scale(1.1);transform-origin:center center;"></iframe></div>`;
            return;
        }

        const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : undefined;
        const pVars = {
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            ...(origin ? { origin } : {})
        };

        let readyCount = 0;
        const onReadyCheck = () => {
            readyCount++;
            if (readyCount === 2) {
                startMonitoring();
            }
        };

        playerA = new YT.Player(`yt_player_a_${id}`, {
            width: '100%',
            height: '100%',
            videoId: videoId,
            playerVars: { ...pVars, autoplay: 1 },
            events: {
                onReady: (e) => {
                    try {
                        e.target.mute();
                        e.target.playVideo();
                    } catch (err) {}
                    onReadyCheck();
                },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.ENDED && activePlayer === 'A') {
                        doSwapToB();
                    }
                }
            }
        });

        playerB = new YT.Player(`yt_player_b_${id}`, {
            width: '100%',
            height: '100%',
            videoId: videoId,
            playerVars: { ...pVars, autoplay: 0 },
            events: {
                onReady: (e) => {
                    try {
                        e.target.mute();
                    } catch (err) {}
                    onReadyCheck();
                },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.ENDED && activePlayer === 'B') {
                        doSwapToA();
                    }
                }
            }
        });

        function doSwapToB() {
            if (isDestroyed || activePlayer !== 'A') return;
            activePlayer = 'B';
            prewarmed = false;
            wrapB.style.zIndex = '2';
            wrapB.style.opacity = '1';
            wrapA.style.zIndex = '1';
            wrapA.style.opacity = '0';
            try {
                playerB.playVideo();
                setTimeout(() => {
                    if (activePlayer === 'B' && playerA && typeof playerA.seekTo === 'function') {
                        try {
                            playerA.seekTo(0, false);
                        } catch (e) {}
                    }
                }, 350);
            } catch (err) {}
        }

        function doSwapToA() {
            if (isDestroyed || activePlayer !== 'B') return;
            activePlayer = 'A';
            prewarmed = false;
            wrapA.style.zIndex = '2';
            wrapA.style.opacity = '1';
            wrapB.style.zIndex = '1';
            wrapB.style.opacity = '0';
            try {
                playerA.playVideo();
                setTimeout(() => {
                    if (activePlayer === 'A' && playerB && typeof playerB.seekTo === 'function') {
                        try {
                            playerB.seekTo(0, false);
                        } catch (e) {}
                    }
                }, 350);
            } catch (err) {}
        }

        startMonitoring = function () {
            if (pollTimer) clearInterval(pollTimer);
            if (isDestroyed || isPaused) return;
            pollTimer = setInterval(() => {
                if (isDestroyed || isPaused) {
                    if (pollTimer) {
                        clearInterval(pollTimer);
                        pollTimer = null;
                    }
                    return;
                }
                try {
                    if (
                        activePlayer === 'A' &&
                        playerA &&
                        typeof playerA.getCurrentTime === 'function' &&
                        typeof playerA.getDuration === 'function'
                    ) {
                        const cur = playerA.getCurrentTime() || 0;
                        const dur = playerA.getDuration() || 0;
                        if (dur > 0) {
                            const lead = Math.max(0.2, Math.min(0.5, dur * 0.1));
                            if (cur >= dur - lead && !prewarmed) {
                                prewarmed = true;
                                try {
                                    playerB.seekTo(0, true);
                                    playerB.playVideo();
                                } catch (err) {}
                            }
                            if (cur >= dur - 0.08) {
                                doSwapToB();
                            }
                        }
                    } else if (
                        activePlayer === 'B' &&
                        playerB &&
                        typeof playerB.getCurrentTime === 'function' &&
                        typeof playerB.getDuration === 'function'
                    ) {
                        const cur = playerB.getCurrentTime() || 0;
                        const dur = playerB.getDuration() || 0;
                        if (dur > 0) {
                            const lead = Math.max(0.2, Math.min(0.5, dur * 0.1));
                            if (cur >= dur - lead && !prewarmed) {
                                prewarmed = true;
                                try {
                                    playerA.seekTo(0, true);
                                    playerA.playVideo();
                                } catch (err) {}
                            }
                            if (cur >= dur - 0.08) {
                                doSwapToA();
                            }
                        }
                    }
                } catch (err) {}
            }, 50);
        };
    });
}

// ==========================================
// Token Auras Floor Pass
// ==========================================
export function renderTokenAurasPass(ctxFloor, tokens, grid, vtt, activeLayer, options = {}) {
    if (!ctxFloor) return;
    const isRectInViewport = options.isRectInViewport || (() => true);
    const isPointVisible = options.isPointVisible || (() => true);
    const getTokenDrawDimensions =
        options.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50, tokenRadius: 25 }));

    if (typeof options.renderTraps === 'function') {
        options.renderTraps(ctxFloor);
    }

    // 2.0 Draw Token Auras Pass (Floor Projection Mode)
    Object.entries(tokens)
        .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
        .forEach(([id, token]) => {
            let auras = [];
            if (token.auras && Array.isArray(token.auras)) {
                auras = token.auras;
            } else if (token.auraEnabled) {
                auras = [
                    {
                        range: token.auraRange !== undefined ? token.auraRange : 10,
                        shape: token.auraShape || 'circle',
                        style: token.auraStyle || 'both',
                        opacity: token.auraOpacity !== undefined ? token.auraOpacity : 0.3,
                        color: token.auraColor || '#d4af37'
                    }
                ];
            }

            if (auras.length === 0) return;

            const tokenLayer = token.layer || 'token';
            if (tokenLayer === 'map') return;
            if (tokenLayer === 'gm' && vtt.role !== 'GM') return;

            const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(token);
            const tx = token.x + drawW / 2;
            const ty = token.y + drawH / 2;

            // Viewport Frustum Culling for Auras: Skip calculations & drawing if outside screen
            let maxAuraFeet = 10;
            auras.forEach((a) => {
                if (a.enabled === false) return;
                const r = parseFloat(a.range) || 10;
                if (r > maxAuraFeet) maxAuraFeet = r;
            });
            const maxAuraPx = (maxAuraFeet / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1.0);
            const totalRadius = tokenRadius + maxAuraPx;
            if (!isRectInViewport(tx - totalRadius, ty - totalRadius, totalRadius * 2, totalRadius * 2, 100)) {
                return;
            }

            // Respect Fog of War / Player Line of Sight
            if (vtt.role !== 'GM' && !isPointVisible(tx, ty)) {
                return;
            }

            auras.forEach((aura) => {
                if (aura.enabled === false) return;
                const auraRange = parseFloat(aura.range) || 10;
                const auraRangePx = (auraRange / grid.feetPerSquare) * grid.size * grid.scale;
                const auraShape = aura.shape || 'circle';
                const auraColor = aura.color || '#d4af37';
                const auraOpacity = parseFloat(aura.opacity) || 0.3;
                const auraStyle = aura.style || 'both';

                ctxFloor.save();

                // Respect visual transparency/dimming based on VTT active layers
                if (tokenLayer === 'gm') {
                    ctxFloor.globalAlpha = 0.5;
                }
                if (vtt.role === 'GM' && activeLayer !== tokenLayer) {
                    ctxFloor.globalAlpha = tokenLayer === 'gm' ? 0.25 : 0.6;
                }

                ctxFloor.beginPath();
                if (auraShape === 'circle') {
                    const radiusPx = tokenRadius + auraRangePx;
                    ctxFloor.arc(tx, ty, radiusPx, 0, Math.PI * 2);
                } else {
                    // square
                    const x1 = token.x - auraRangePx;
                    const y1 = token.y - auraRangePx;
                    const w = drawW + 2 * auraRangePx;
                    const h = drawH + 2 * auraRangePx;
                    if (ctxFloor.roundRect) {
                        ctxFloor.roundRect(x1, y1, w, h, 8);
                    } else {
                        ctxFloor.rect(x1, y1, w, h);
                    }
                }

                const baseAlpha = ctxFloor.globalAlpha;

                // Draw Fill
                if (auraStyle === 'both' || auraStyle === 'fill') {
                    ctxFloor.fillStyle = auraColor;
                    ctxFloor.globalAlpha = baseAlpha * auraOpacity;
                    ctxFloor.fill();
                }

                // Draw Border with glowing effect
                if (auraStyle === 'both' || auraStyle === 'border') {
                    ctxFloor.strokeStyle = auraColor;
                    ctxFloor.globalAlpha = baseAlpha * Math.min(1.0, auraOpacity + 0.35);
                    ctxFloor.lineWidth = 2.5;
                    ctxFloor.shadowColor = auraColor;
                    ctxFloor.shadowBlur = 6;
                    ctxFloor.stroke();
                }

                ctxFloor.restore();
            });
        });
}

// ==========================================
// Full Tokens Layer Drawing & DOM Overlay Pass
// ==========================================
export function renderTokensLayer(context = {}) {
    Object.assign(tokenRendererContext, context);
    const {
        tokens = {},
        tokenAnimations: anims = tokenAnimations,
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50, tokenRadius: 25 }),
        selectedTokenIds = new Set(),
        activeDragTokenId = null,
        dragTargetId = null,
        hoverTokenId = null,
        isRectInViewport = () => true,
        vtt = {},
        activeLayer = 'token',
        panX = 0,
        panY = 0,
        zoom = 1,
        grid = { size: 50, scale: 1 },
        ctxInteraction = null,
        isGmViewing = vtt.role === 'GM',
        isTokenControlledByPlayer = () => false,
        isPointVisible = () => true,
        canvasToScreen = (cx, cy) => ({ x: cx, y: cy }),
        getCategoryColor = () => '#dc3545',
        getTokenCategory = () => 'monster',
        loadPlayerTokenPrefs = () => ({}),
        loadGmTokenPrefs = () => ({}),
        getEffectiveVisibility = (pref, gm) => pref || gm,
        getEffectiveNumberVisible = (pref, gm) => pref && gm,
        renderAll = () => {},
        openTokenEditModal = () => {},
        openPushPlayersModal = () => {},
        startTouchTokenDrag = () => {},
        moveTouchTokenDrag = () => {},
        endTouchTokenDrag = () => {},
        cancelTokenDrag = () => {},
        campaignSettings = {},
        currentMapId = '',
        showGmTokenTooltip = () => {},
        hideGmTokenTooltip = () => {},
        tokenDragOriginalPositions = {},
        imageCache = {},
        activeTool = 'select',
        getTokenRotationHandlePos = () => null,
        hoveredRotateTokenId = null,
        activeRotateTokenId = null
    } = context;

    const playerTokenPrefs =
        context.playerTokenPrefs || (typeof loadPlayerTokenPrefs === 'function' ? loadPlayerTokenPrefs() : {});
    const gmTokenPrefs = context.gmTokenPrefs || (typeof loadGmTokenPrefs === 'function' ? loadGmTokenPrefs() : {});

    // 2. Draw Tokens Layer
    // Partition visible vs off-screen tokens before sorting to eliminate O(N log N) sort overhead for culled tokens
    const visibleTokens = [];

    for (const id in tokens) {
        const token = tokens[id];
        if (!token) continue;
        const shudder = getTokenShudderOffset(id);
        const basePos = tokenAnimations[id]?.currentPos || { x: token.x, y: token.y };
        const renderPos = { x: basePos.x + shudder.x, y: basePos.y + shudder.y };
        const { drawW, drawH } = getTokenDrawDimensions(token);

        const isInteracting =
            selectedTokenIds.has(id) || id === activeDragTokenId || id === dragTargetId || id === hoverTokenId;
        if (!isInteracting && !isRectInViewport(renderPos.x, renderPos.y, drawW, drawH, 200)) {
            const offNode = document.getElementById('asset_node_' + id);
            if (offNode) {
                offNode.style.display = 'none';
                if (offNode.tagName === 'VIDEO' && !offNode.paused) {
                    try {
                        offNode.pause();
                    } catch (e) {}
                }
                if (ytPingPongControllers[id]?.pause) {
                    try {
                        ytPingPongControllers[id].pause();
                    } catch (e) {}
                }
            }
            const offUiNode = document.getElementById('token_ui_' + id);
            if (offUiNode) offUiNode.style.display = 'none';
            continue;
        }

        visibleTokens.push([id, token]);
    }

    visibleTokens
        .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
        .forEach(([id, token], sortedIndex) => {
            const shudder = getTokenShudderOffset(id);
            const basePos = tokenAnimations[id]?.currentPos || { x: token.x, y: token.y };
            const renderPos = { x: basePos.x + shudder.x, y: basePos.y + shudder.y };
            const { drawW, drawH } = getTokenDrawDimensions(token);

            const tokenLayer = token.layer || 'token';
            const cleanImgUrl = token.img ? token.img.split('?')[0].toLowerCase() : '';
            const isGif = token.isGif || cleanImgUrl.endsWith('.gif') || (token.img && token.img.includes('.gif'));
            const isYoutube = token.img && (token.img.includes('youtube.com') || token.img.includes('youtu.be'));
            const needsIframe = !isYoutube && token.img && token.img.trim().startsWith('<iframe');
            const isActuallyVideo =
                !isGif &&
                !isYoutube &&
                !needsIframe &&
                ((token.isVideo && !isGif) ||
                    (cleanImgUrl && cleanImgUrl.match(/\.(mp4|webm|ogg|m4v|mov)$/i)) ||
                    (token.img && token.img.includes('pinimg.com/videos')));

            const htmlOverlayLayer = document.getElementById('vtt-html-overlays');
            const underGridOverlayLayer = document.getElementById('vtt-map-html-overlays');

            // Map layer assets ALWAYS go to under-grid container, other tokens go to main overlay
            const targetOverlay = tokenLayer === 'map' ? underGridOverlayLayer : htmlOverlayLayer;

            if (targetOverlay) {
                let node = document.getElementById('asset_node_' + id);

                const needsImg = token.img && !isYoutube && !needsIframe && !isActuallyVideo;
                const needsVideo = token.img && !isYoutube && !needsIframe && isActuallyVideo;
                const needsDiv = !token.img;
                const neededTag = isYoutube
                    ? 'DIV'
                    : needsIframe
                      ? 'IFRAME'
                      : needsImg
                        ? 'IMG'
                        : needsVideo
                          ? 'VIDEO'
                          : 'DIV';

                // If node exists but is in wrong container or wrong tag, remove and recreate
                if (node && (node.parentElement !== targetOverlay || node.tagName !== neededTag)) {
                    cleanupMediaElement(node);
                    node = null;
                }

                if (!node) {
                    if (isYoutube) {
                        node = document.createElement('div');
                        node.id = 'asset_node_' + id;
                        node.style.position = 'absolute';
                        node.style.pointerEvents = 'none';
                        targetOverlay.appendChild(node);
                        initDualYouTubePlayer(node, token.img, id);
                    } else if (needsIframe) {
                        node = document.createElement('iframe');
                        node.setAttribute('src', token.img);
                        node.dataset.rawImg = token.img;
                        node.frameBorder = '0';
                        node.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                    } else if (needsImg) {
                        node = document.createElement('img');
                        node.draggable = false;
                        node.onerror = () => {
                            if (node.dataset.failed) return;
                            node.dataset.failed = 'true';
                            const initial = (token.name || 'C').charAt(0).toUpperCase();
                            const color = token.color || (token.isPlayer ? '#007bff' : '#dc3545');
                            node.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${encodeURIComponent(color)}" stroke="%23ffffff" stroke-width="4"/><text x="50" y="65" font-size="44" font-family="sans-serif" font-weight="bold" fill="%23ffffff" text-anchor="middle">${initial}</text></svg>`;
                        };
                        node.setAttribute('src', getSafeVttUrl(token.img));
                    } else if (needsVideo) {
                        node = document.createElement('video');
                        node.setAttribute('src', getSafeVttUrl(token.img));
                        node.muted = true;
                        node.defaultMuted = true;
                        node.autoplay = true;
                        node.loop = true;
                        node.playsInline = true;
                        node.preload = 'auto';
                        node.setAttribute('muted', '');
                        node.setAttribute('autoplay', '');
                        node.setAttribute('loop', '');
                        node.setAttribute('playsinline', '');
                        node.setAttribute('preload', 'auto');
                        node.onerror = () => {
                            if (node.dataset.failed) return;
                            node.dataset.failed = 'true';
                            console.warn('[VTT Video] Video failed to load, falling back to avatar/image:', token.img);
                            const fallbackImg = document.createElement('img');
                            fallbackImg.id = node.id;
                            fallbackImg.style.position = 'absolute';
                            fallbackImg.style.pointerEvents = 'none';
                            const initial = (token.name || 'C').charAt(0).toUpperCase();
                            const color = token.color || (token.isPlayer ? '#007bff' : '#dc3545');
                            fallbackImg.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${encodeURIComponent(color)}" stroke="%23ffffff" stroke-width="4"/><text x="50" y="65" font-size="44" font-family="sans-serif" font-weight="bold" fill="%23ffffff" text-anchor="middle">${initial}</text></svg>`;
                            if (node.parentNode) node.parentNode.replaceChild(fallbackImg, node);
                        };
                    } else {
                        node = document.createElement('div');
                    }
                    node.id = 'asset_node_' + id;
                    node.style.position = 'absolute';
                    node.style.pointerEvents = 'none';
                    if (!isYoutube) targetOverlay.appendChild(node);
                    if (needsVideo) {
                        const isHiddenFromPlayer =
                            (tokenLayer === 'gm' && vtt.role !== 'GM') ||
                            (token.isVisible === false && vtt.role !== 'GM') ||
                            (token.hidden && vtt.role !== 'GM');
                        const isGamePaused = Boolean(vtt.isPaused || window.VTT?.isPaused);
                        const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
                        if (!isHiddenFromPlayer && !isGamePaused && !isTabHidden) {
                            node.play().catch(() => {});
                        }
                    }
                } else if (isYoutube) {
                    if (node.dataset.rawImg !== token.img) {
                        initDualYouTubePlayer(node, token.img, id);
                    }
                } else if (needsIframe) {
                    if (node.dataset.rawImg !== token.img) {
                        node.dataset.rawImg = token.img;
                        node.setAttribute('src', token.img);
                    }
                } else if (
                    token.img &&
                    (node.dataset.lastAttemptedImg !== token.img || !node.dataset.failed) &&
                    node.getAttribute('src') !== getSafeVttUrl(token.img) &&
                    node.src !== getSafeVttUrl(token.img)
                ) {
                    node.dataset.lastAttemptedImg = token.img;
                    delete node.dataset.failed;
                    if (node.tagName === 'IMG') {
                        node.onerror = () => {
                            if (node.dataset.failed) return;
                            node.dataset.failed = 'true';
                            const initial = (token.name || 'C').charAt(0).toUpperCase();
                            const color = token.color || (token.isPlayer ? '#007bff' : '#dc3545');
                            node.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${encodeURIComponent(color)}" stroke="%23ffffff" stroke-width="4"/><text x="50" y="65" font-size="44" font-family="sans-serif" font-weight="bold" fill="%23ffffff" text-anchor="middle">${initial}</text></svg>`;
                        };
                    }
                    node.setAttribute('src', getSafeVttUrl(token.img));
                    if (node.tagName === 'VIDEO') {
                        node.muted = true;
                        node.defaultMuted = true;
                        node.preload = 'auto';
                        node.load();
                        node.play().catch(() => {});
                    }
                }
                const shouldPauseMedia =
                    (tokenLayer === 'gm' && vtt.role !== 'GM') ||
                    (token.isVisible === false && vtt.role !== 'GM') ||
                    (token.hidden && vtt.role !== 'GM') ||
                    Boolean(vtt.isPaused || window.VTT?.isPaused) ||
                    (typeof document !== 'undefined' && document.visibilityState === 'hidden');

                if (node && node.tagName === 'VIDEO') {
                    if (shouldPauseMedia) {
                        if (!node.paused)
                            try {
                                node.pause();
                            } catch (e) {}
                    } else if (node.paused) {
                        node.play().catch(() => {});
                    }
                } else if (isYoutube && ytPingPongControllers[id]) {
                    if (shouldPauseMedia) {
                        try {
                            ytPingPongControllers[id].pause();
                        } catch (e) {}
                    } else {
                        try {
                            ytPingPongControllers[id].resume();
                        } catch (e) {}
                    }
                }

                if (needsDiv) {
                    node.style.backgroundColor = token.color || '#333333';
                }

                // Sync position and size, ensuring display is restored if previously culled
                node.style.display = 'block';
                node.style.left = `${renderPos.x}px`;
                node.style.top = `${renderPos.y}px`;
                node.style.width = `${drawW}px`;
                node.style.height = `${drawH}px`;
                node.style.zIndex = sortedIndex;

                // Apply circular clipping if it is a standard Token
                if (!token.isAsset) {
                    node.style.borderRadius = '50%';
                    node.style.objectFit = 'cover';
                    if (!token.isBorderless) {
                        const borderColor = token.isPlayer ? 'rgba(0, 123, 255, 0.8)' : 'rgba(220, 53, 69, 0.8)';
                        node.style.border = `2px solid ${borderColor}`;
                        node.style.boxSizing = 'border-box';
                    } else {
                        node.style.border = 'none';
                    }
                } else {
                    node.style.borderRadius = '0';
                    node.style.objectFit = 'fill';
                    node.style.border = 'none';
                }

                // Apply flip and rotation transform
                let transformStr = '';
                if (token.rotation) transformStr += `rotate(${token.rotation}deg) `;
                if (token.flipX) transformStr += 'scaleX(-1) ';
                if (token.flipY) transformStr += 'scaleY(-1)';
                transformStr = transformStr.trim();
                node.style.transform = transformStr || 'none';

                // Render customizable Floor Shadow via CSS
                if (token.fxShadowEnabled) {
                    const sBlur = token.fxShadowBlur !== undefined ? token.fxShadowBlur : 12;
                    const sOffset = token.fxShadowOffset !== undefined ? token.fxShadowOffset : 4;
                    const sColor = token.fxShadowColor || '#000000';
                    const sOpacity = token.fxShadowOpacity !== undefined ? token.fxShadowOpacity : 0.7;

                    let shadowColorRgba = 'rgba(0,0,0,0.7)';
                    if (sColor.startsWith('#')) {
                        const r = parseInt(sColor.slice(1, 3), 16) || 0;
                        const g = parseInt(sColor.slice(3, 5), 16) || 0;
                        const b = parseInt(sColor.slice(5, 7), 16) || 0;
                        shadowColorRgba = `rgba(${r}, ${g}, ${b}, ${sOpacity})`;
                    }
                    node.style.filter = `drop-shadow(${sOffset}px ${sOffset}px ${sBlur}px ${shadowColorRgba})`;
                } else {
                    node.style.filter = 'none';
                }

                // Hide if on wrong layer or explicitly hidden
                if (
                    (tokenLayer === 'gm' && vtt.role !== 'GM') ||
                    (token.isVisible === false && vtt.role !== 'GM') ||
                    (token.hidden && vtt.role !== 'GM')
                ) {
                    node.style.display = 'none';
                    if (node.tagName === 'VIDEO' && !node.paused) {
                        try {
                            node.pause();
                        } catch (e) {}
                    }
                } else {
                    node.style.display = 'block';
                    node.style.opacity = tokenLayer === 'gm' && vtt.role === 'GM' ? '0.5' : '1.0';
                }
            }

            // Skip rendering Map Layer assets on this canvas (drawn on Grid canvas)
            // UNLESS the asset is hovered, dragged, or selected, in which case we draw the selection glow here.
            if (tokenLayer === 'map') {
                if (
                    vtt.role === 'GM' &&
                    activeLayer === 'map' &&
                    (id === activeDragTokenId || id === hoverTokenId || selectedTokenIds.has(id))
                ) {
                    const { drawW, drawH } = getTokenDrawDimensions(token);
                    ctxInteraction.save();
                    if (token.rotation) {
                        const cx = token.x + drawW / 2;
                        const cy = token.y + drawH / 2;
                        ctxInteraction.translate(cx, cy);
                        ctxInteraction.rotate((token.rotation * Math.PI) / 180);
                        ctxInteraction.translate(-cx, -cy);
                    }
                    ctxInteraction.strokeStyle = 'var(--color-gold-base)';
                    ctxInteraction.lineWidth = 3;
                    ctxInteraction.shadowColor = 'var(--color-gold-light)';
                    ctxInteraction.shadowBlur = 8;
                    ctxInteraction.strokeRect(token.x - 2, token.y - 2, drawW + 4, drawH + 4);
                    ctxInteraction.restore();
                }
                const uiNode = document.getElementById('token_ui_' + id);
                if (uiNode) uiNode.style.display = 'none';
                return;
            }

            // GM Layer tokens and invisible tokens are hidden from players
            if ((tokenLayer === 'gm' || token.isVisible === false || token.hidden) && vtt.role !== 'GM') {
                const uiNode = document.getElementById('token_ui_' + id);
                if (uiNode) uiNode.style.display = 'none';
                return;
            }

            const { tokenRadius } = getTokenDrawDimensions(token);
            const tx = renderPos.x + drawW / 2;
            const ty = renderPos.y + drawH / 2;

            // Draw ghost token if currently dragging this token
            if (id === dragTargetId) {
                const originalPos = tokenDragOriginalPositions[id];
                if (originalPos) {
                    ctxInteraction.save();
                    ctxInteraction.globalAlpha = 0.4;
                    const cachedImg = token.img
                        ? typeof imageCache?.get === 'function'
                            ? imageCache.get(token.img)
                            : imageCache[token.img]
                        : null;
                    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
                        ctxInteraction.save();
                        if (!token.isAsset) {
                            ctxInteraction.beginPath();
                            ctxInteraction.arc(
                                originalPos.x + drawW / 2,
                                originalPos.y + drawH / 2,
                                tokenRadius,
                                0,
                                Math.PI * 2
                            );
                            ctxInteraction.clip();
                        }
                        if (token.rotation || token.flipX || token.flipY) {
                            ctxInteraction.save();
                            const cx = originalPos.x + drawW / 2;
                            const cy = originalPos.y + drawH / 2;
                            ctxInteraction.translate(cx, cy);
                            if (token.rotation) ctxInteraction.rotate((token.rotation * Math.PI) / 180);
                            if (token.flipX || token.flipY)
                                ctxInteraction.scale(token.flipX ? -1 : 1, token.flipY ? -1 : 1);
                            ctxInteraction.drawImage(cachedImg, -drawW / 2, -drawH / 2, drawW, drawH);
                            ctxInteraction.restore();
                        } else {
                            ctxInteraction.drawImage(cachedImg, originalPos.x, originalPos.y, drawW, drawH);
                        }
                        ctxInteraction.restore();
                    } else {
                        ctxInteraction.fillStyle = token.color || '#333333';
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(
                            originalPos.x + drawW / 2,
                            originalPos.y + drawH / 2,
                            tokenRadius,
                            0,
                            Math.PI * 2
                        );
                        ctxInteraction.fill();
                    }
                    if (!token.isAsset && !token.isBorderless) {
                        ctxInteraction.strokeStyle = token.isPlayer
                            ? 'rgba(0, 123, 255, 0.8)'
                            : 'rgba(220, 53, 69, 0.8)';
                        ctxInteraction.lineWidth = 2;
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(
                            originalPos.x + drawW / 2,
                            originalPos.y + drawH / 2,
                            tokenRadius - 1,
                            0,
                            Math.PI * 2
                        );
                        ctxInteraction.stroke();
                    }
                    ctxInteraction.restore();
                }
            }

            ctxInteraction.save();

            // Set visual transparency/dimming based on layers state
            if (tokenLayer === 'gm') {
                ctxInteraction.globalAlpha = 0.5; // GM layer is translucent
            }
            if (vtt.role === 'GM' && activeLayer !== tokenLayer) {
                // Dim inactive layers for clarity
                ctxInteraction.globalAlpha = tokenLayer === 'gm' ? 0.25 : 0.6;
            }

            // Draw selection glow outline if hovered, dragged, or multi-selected
            const isTokenSelected = selectedTokenIds.has(id);
            if (id === activeDragTokenId || id === hoverTokenId || isTokenSelected) {
                ctxInteraction.save();
                ctxInteraction.strokeStyle = isTokenSelected ? 'var(--color-gold-base)' : 'rgba(212, 175, 55, 0.6)';
                ctxInteraction.lineWidth = isTokenSelected ? 4.5 : 3;
                ctxInteraction.shadowColor = 'var(--color-gold-light)';
                ctxInteraction.shadowBlur = isTokenSelected ? 12 : 8;

                const rad = ((token.rotation || 0) * Math.PI) / 180;
                if (token.rotation) {
                    ctxInteraction.translate(tx, ty);
                    ctxInteraction.rotate(rad);
                    ctxInteraction.translate(-tx, -ty);
                }

                if (token.isAsset) {
                    ctxInteraction.strokeRect(renderPos.x - 2, renderPos.y - 2, drawW + 4, drawH + 4);
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius + (isTokenSelected ? 3.5 : 2), 0, Math.PI * 2);
                    ctxInteraction.stroke();
                }

                if (isTokenSelected) {
                    // Draw inner white-gold dashed ring for a highly polished UI feel
                    ctxInteraction.save();
                    ctxInteraction.strokeStyle = '#ffffff';
                    ctxInteraction.lineWidth = 1;
                    ctxInteraction.setLineDash([4, 4]);

                    if (token.isAsset) {
                        ctxInteraction.strokeRect(renderPos.x, renderPos.y, drawW, drawH);
                    } else {
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(tx, ty, tokenRadius + 1, 0, Math.PI * 2);
                        ctxInteraction.stroke();
                    }
                    ctxInteraction.restore();
                }

                ctxInteraction.restore();
            }

            // Draw Rotation Handle for selected tokens/assets
            if (
                isTokenSelected &&
                activeTool === 'select' &&
                (vtt.role === 'GM' || tokenLayer !== 'gm') &&
                isTokenControlledByPlayer(token)
            ) {
                const handleInfo = getTokenRotationHandlePos(token);
                if (handleInfo) {
                    ctxInteraction.save();

                    // Stem line
                    ctxInteraction.beginPath();
                    ctxInteraction.strokeStyle = 'var(--color-gold-base)';
                    ctxInteraction.lineWidth = 2;
                    ctxInteraction.moveTo(handleInfo.topCenterX, handleInfo.topCenterY);
                    ctxInteraction.lineTo(handleInfo.x, handleInfo.y);
                    ctxInteraction.stroke();

                    // Handle circle
                    const isHovered = hoveredRotateTokenId === token.id || activeRotateTokenId === token.id;
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(handleInfo.x, handleInfo.y, 7, 0, Math.PI * 2);
                    ctxInteraction.fillStyle = isHovered ? '#ffe875' : '#ffffff';
                    ctxInteraction.fill();
                    ctxInteraction.strokeStyle = 'var(--color-gold-base)';
                    ctxInteraction.lineWidth = 2;
                    ctxInteraction.stroke();

                    // Rotation arrow icon
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(handleInfo.x, handleInfo.y, 3.5, -Math.PI * 0.7, Math.PI * 0.7);
                    ctxInteraction.strokeStyle = '#222222';
                    ctxInteraction.lineWidth = 1.5;
                    ctxInteraction.stroke();

                    ctxInteraction.restore();
                }
            }

            // Render Color Overlay FX
            if (token.fxOverlayEnabled) {
                ctxInteraction.save();
                const oColor = token.fxOverlayColor || '#007bff';
                const oOpacity = token.fxOverlayOpacity !== undefined ? token.fxOverlayOpacity : 0.3;

                ctxInteraction.globalAlpha = oOpacity;
                ctxInteraction.fillStyle = oColor;
                if (token.isAsset) {
                    ctxInteraction.fillRect(renderPos.x, renderPos.y, drawW, drawH);
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius, 0, Math.PI * 2);
                    ctxInteraction.fill();
                }
                ctxInteraction.restore();
            }

            // Render Vignette Frame FX
            if (token.fxVignetteEnabled) {
                ctxInteraction.save();
                const vColor = token.fxVignetteColor || '#000000';
                const vOpacity = token.fxVignetteOpacity !== undefined ? token.fxVignetteOpacity : 0.6;

                const grad = ctxInteraction.createRadialGradient(tx, ty, tokenRadius * 0.4, tx, ty, tokenRadius);

                let vigColorRgba = 'rgba(0,0,0,0.6)';
                if (vColor.startsWith('#')) {
                    const r = parseInt(vColor.slice(1, 3), 16) || 0;
                    const g = parseInt(vColor.slice(3, 5), 16) || 0;
                    const b = parseInt(vColor.slice(5, 7), 16) || 0;
                    vigColorRgba = `rgba(${r}, ${g}, ${b}, ${vOpacity})`;
                }

                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, vigColorRgba);

                ctxInteraction.fillStyle = grad;
                if (token.isAsset) {
                    ctxInteraction.fillRect(renderPos.x, renderPos.y, drawW, drawH);
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius, 0, Math.PI * 2);
                    ctxInteraction.fill();
                }
                ctxInteraction.restore();
            }

            ctxInteraction.restore(); // Restores context globalAlpha and clipping path

            // Render token border frame
            if (!isActuallyVideo) {
                ctxInteraction.strokeStyle = token.isPlayer ? 'rgba(0, 123, 255, 0.8)' : 'rgba(220, 53, 69, 0.8)';
                if (token.isAsset || token.isBorderless) ctxInteraction.strokeStyle = 'transparent'; // No border for freeform image assets or borderless tokens
                ctxInteraction.lineWidth = 2;
                if (token.isAsset || token.isBorderless) {
                    // No default border for assets or borderless tokens
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius - 1, 0, Math.PI * 2);
                    ctxInteraction.stroke();
                }
            }

            // ── Dying glow: red pulsing ring when linked player HP = 0 ──
            if (token.isPlayer && token.maxHp > 0 && token.hp <= 0) {
                ctxInteraction.save();
                ctxInteraction.shadowBlur = 18;
                ctxInteraction.shadowColor = 'rgba(220, 53, 69, 1)';
                ctxInteraction.strokeStyle = 'rgba(220, 53, 69, 0.9)';
                ctxInteraction.lineWidth = 3;
                ctxInteraction.beginPath();
                ctxInteraction.arc(tx, ty, tokenRadius + 3, 0, Math.PI * 2);
                ctxInteraction.stroke();
                ctxInteraction.restore();
            }

            // --- DOM Overlay Sync for Token UI ---
            if (htmlOverlayLayer) {
                const uiNodeId = 'token_ui_' + id;
                let uiNode = document.getElementById(uiNodeId);

                const { drawW, drawH } = getTokenDrawDimensions(token);
                // Only render UI if the token is visible (visibility by fog handled via CSS z-index)
                const isVisible = !(
                    (tokenLayer === 'gm' || token.isVisible === false || token.hidden) &&
                    vtt.role !== 'GM'
                );

                if (isVisible) {
                    if (!uiNode) {
                        uiNode = document.createElement('div');
                        uiNode.id = uiNodeId;
                        uiNode.className = 'token-ui-container';
                        uiNode.style.position = 'absolute';
                        uiNode.style.pointerEvents = 'none';
                        uiNode.style.overflow = 'visible';
                        uiNode.style.transformOrigin = 'top left';
                        uiNode.style.zIndex = '1000';

                        // Internal structure
                        uiNode.innerHTML = `
                            <div class="token-name-tag" style="position:absolute; top:4px; left:4px; right:4px; transform:none; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:12px; font-weight:bold; font-family:var(--font-primary); padding:2px 6px; border-radius:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 8px); pointer-events:none; z-index:4;"></div>
                            <div class="token-condition-container" style="display:none; position:absolute; top:4px; right:4px; flex-direction:column; align-items:flex-end; gap:2px; width:auto; max-width:calc(100% - 8px); pointer-events:none; z-index:5;"></div>
                            <div class="token-hp-bar-bg" style="position:absolute; bottom:4px; left:4px; right:4px; height:8px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:4px; display:none; overflow:hidden; z-index:2;">
                                <div class="token-hp-bar-fill" style="height:100%; background-color:var(--color-success-base); border-radius:2px; transition:width 0.3s ease;"></div>
                            </div>
                            <div class="token-temp-hp-fill-wrapper" style="position:absolute; bottom:4px; left:4px; right:4px; height:8px; display:none; overflow:hidden; z-index:3;">
                                <div class="token-temp-hp-fill" style="height:100%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;"></div>
                            </div>
                            <div class="token-hp-number" style="position:absolute; bottom:14px; left:50%; transform:translateX(-50%); color:white; font-size:10px; font-weight:bold; text-shadow:0 0 2px black, 0 0 3px black; display:none; white-space:nowrap; pointer-events:none; z-index:5;"></div>
                            <div class="token-flight-container" style="display:none; position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); color:white; font-family:var(--font-primary); width:24px; height:24px; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:6;">
                                <i class="fa-solid fa-feather" style="font-size:10px; margin-bottom:1px; line-height:1;"></i>
                                <span class="flight-altitude" style="font-size:9px; line-height:1; font-weight:bold;"></span>
                            </div>
                            <div class="token-health-bar-container" style="display:none;"></div>
                            <div class="token-health-text" style="display:none;"></div>
                        `;
                        htmlOverlayLayer.appendChild(uiNode);
                    }

                    // 1. Position Container using hardware-accelerated transform
                    const { drawW, drawH } = getTokenDrawDimensions(token);
                    const currentZoom = Math.max(0.1, zoom || 1);

                    // Billboard Screen-Space sizing helper: guarantees exact physical display pixels on screen
                    const getScreenPx = (targetScreenPx) => targetScreenPx / currentZoom;

                    uiNode.style.transform = `translate3d(${renderPos.x}px, ${renderPos.y}px, 0)`;
                    uiNode.style.width = `${drawW}px`;
                    uiNode.style.height = `${drawH}px`;

                    const isHovered = id === hoverTokenId;

                    // Smooth Macro-Zoom Opacity Fade (zoom < 0.25 smoothly fades to 0.10, reveals 100% on hover)
                    let overlayOpacity = 1.0;
                    if (currentZoom < 0.25) {
                        overlayOpacity = isHovered ? 1.0 : Math.max(0, Math.min(1, (currentZoom - 0.1) / (0.25 - 0.1)));
                    }
                    uiNode.style.opacity = `${overlayOpacity}`;
                    uiNode.style.display = overlayOpacity > 0.02 ? 'block' : 'none';

                    const isGM = vtt.role === 'GM';
                    const targetType = token.isPlayer ? 'Player' : 'Monster';
                    const activePrefs = isGM ? gmTokenPrefs : playerTokenPrefs;

                    let showName = false;
                    let showBar = false;
                    let showNum = false;
                    let showTempBar = false;
                    let showTempNum = false;

                    if (isGM) {
                        const gmNameVisible = campaignSettings[`gm${targetType}NameVisible`] ?? 'always';
                        showName = gmNameVisible === 'always' || (gmNameVisible === 'hover' && isHovered);

                        let gmBarVisible = campaignSettings[`gm${targetType}HpBarVisible`] ?? 'always';
                        if (token.hpBarVisibleOverride && token.hpBarVisibleOverride !== 'default') {
                            gmBarVisible = token.hpBarVisibleOverride;
                        }
                        showBar = gmBarVisible === 'always' || (gmBarVisible === 'hover' && isHovered);

                        let gmNumVisible = campaignSettings[`gm${targetType}HpNumVisible`] ?? true;
                        if (token.hpNumVisibleOverride && token.hpNumVisibleOverride !== 'default') {
                            gmNumVisible = token.hpNumVisibleOverride === 'always';
                        }
                        showNum = showBar && gmNumVisible;

                        const gmTempBarVisible = campaignSettings.gmTempHpBarVisible ?? 'always';
                        showTempBar = gmTempBarVisible === 'always' || (gmTempBarVisible === 'hover' && isHovered);

                        const gmTempNumVisible = campaignSettings.gmTempHpNumVisible ?? true;
                        showTempNum = showTempBar && gmTempNumVisible;
                    } else {
                        // Effective visibility resolution with GM ceiling for players
                        const gmNameVisible = campaignSettings[`player${targetType}NameVisible`] ?? 'always';
                        const prefNameKey = targetType === 'Player' ? 'playerNameVisible' : 'monsterNameVisible';
                        const effectiveNameVisible = getEffectiveVisibility(
                            playerTokenPrefs[prefNameKey],
                            gmNameVisible
                        );
                        showName = effectiveNameVisible === 'always' || (effectiveNameVisible === 'hover' && isHovered);

                        const gmBarVisible = campaignSettings[`player${targetType}HpBarVisible`] ?? 'always';
                        const prefBarKey = targetType === 'Player' ? 'playerHpBarVisible' : 'monsterHpBarVisible';
                        let effectiveBarVisible = getEffectiveVisibility(playerTokenPrefs[prefBarKey], gmBarVisible);
                        if (token.hpBarVisibleOverride && token.hpBarVisibleOverride !== 'default') {
                            effectiveBarVisible = token.hpBarVisibleOverride;
                        }
                        showBar = effectiveBarVisible === 'always' || (effectiveBarVisible === 'hover' && isHovered);

                        const gmNumVisible = campaignSettings[`player${targetType}HpNumVisible`] ?? true;
                        const prefNumKey = targetType === 'Player' ? 'playerHpNumVisible' : 'monsterHpNumVisible';
                        let effectiveNumSetting = getEffectiveNumberVisible(playerTokenPrefs[prefNumKey], gmNumVisible);
                        if (token.hpNumVisibleOverride && token.hpNumVisibleOverride !== 'default') {
                            effectiveNumSetting = token.hpNumVisibleOverride === 'always';
                        }
                        showNum = showBar && effectiveNumSetting;

                        const gmTempBarVisible = campaignSettings.playerTempHpBarVisible ?? 'always';
                        const effectiveTempBarVisible = getEffectiveVisibility(
                            playerTokenPrefs.tempHpBarVisible,
                            gmTempBarVisible
                        );
                        showTempBar =
                            effectiveTempBarVisible === 'always' || (effectiveTempBarVisible === 'hover' && isHovered);

                        const gmTempNumVisible = campaignSettings.playerTempHpNumVisible ?? true;
                        const effectiveTempNumSetting = getEffectiveNumberVisible(
                            playerTokenPrefs.tempHpNumVisible,
                            gmTempNumVisible
                        );
                        showTempNum = showTempBar && effectiveTempNumSetting;
                    }

                    // HUD Layout Preferences
                    const barPos = activePrefs.barPosition || 'bottom';
                    const namePos = activePrefs.namePosition || 'top';
                    const barHeight = Number(activePrefs.barHeight || 8);
                    const flightPos = activePrefs.flightPosition || 'inside-tl';
                    const condPos = activePrefs.conditionPosition || 'inside-tr';
                    const nameplateFitWidth = activePrefs.nameplateFitWidth !== false;
                    const condOrientation = activePrefs.conditionOrientation || 'horizontal';

                    // 2. Name Tag
                    const nameNode = uiNode.querySelector('.token-name-tag');
                    if (nameNode.textContent !== token.name) {
                        nameNode.textContent = token.name;
                    }
                    const effectiveNameFontSize = Math.round(getScreenPx(12));
                    const effectiveNameMaxWidth = Math.round(getScreenPx(180));
                    nameNode.style.fontSize = `${effectiveNameFontSize}px`;
                    nameNode.style.left = '50%';
                    nameNode.style.right = 'auto';
                    nameNode.style.width = 'max-content';
                    nameNode.style.maxWidth = `${effectiveNameMaxWidth}px`;
                    nameNode.style.transform = 'translateX(-50%)';
                    nameNode.style.overflow = 'hidden';
                    nameNode.style.textOverflow = 'ellipsis';
                    nameNode.style.whiteSpace = 'nowrap';
                    nameNode.style.padding = `${Math.round(getScreenPx(2))}px ${Math.round(getScreenPx(6))}px`;
                    nameNode.style.borderRadius = `${Math.round(getScreenPx(4))}px`;

                    const effectiveBarHeight = Math.round(getScreenPx(7));
                    const nameGap = Math.round(getScreenPx(4));

                    if (namePos === 'above' && barPos === 'above') {
                        nameNode.style.top = `-${effectiveBarHeight + Math.round(getScreenPx(24))}px`;
                        nameNode.style.bottom = 'auto';
                    } else if (namePos === 'below' && barPos === 'below') {
                        nameNode.style.top = `calc(100% + ${effectiveBarHeight + Math.round(getScreenPx(7))}px)`;
                        nameNode.style.bottom = 'auto';
                    } else if (namePos === 'top' && barPos === 'top') {
                        nameNode.style.top = `${Math.round(getScreenPx(22))}px`;
                        nameNode.style.bottom = 'auto';
                    } else if (namePos === 'bottom' && barPos === 'bottom') {
                        nameNode.style.top = 'auto';
                        nameNode.style.bottom = `${effectiveBarHeight + Math.round(getScreenPx(7))}px`;
                    } else {
                        if (namePos === 'above') {
                            nameNode.style.top = `-${Math.round(getScreenPx(20))}px`;
                            nameNode.style.bottom = 'auto';
                        } else if (namePos === 'top') {
                            nameNode.style.top = `${nameGap}px`;
                            nameNode.style.bottom = 'auto';
                        } else if (namePos === 'bottom') {
                            nameNode.style.top = 'auto';
                            nameNode.style.bottom = `${nameGap}px`;
                        } else if (namePos === 'below') {
                            nameNode.style.top = `calc(100% + ${nameGap}px)`;
                            nameNode.style.bottom = 'auto';
                        }
                    }

                    if (showName) {
                        nameNode.style.display = 'block';
                    } else {
                        nameNode.style.display = 'none';
                    }

                    // 3. Health Bar & Text
                    const hpContainer = uiNode.querySelector('.token-hp-bar-bg');
                    const hpText = uiNode.querySelector('.token-hp-number');
                    const hpFill = uiNode.querySelector('.token-hp-bar-fill');
                    const tempHpWrapper = uiNode.querySelector('.token-temp-hp-fill-wrapper');
                    const tempHpFill = uiNode.querySelector('.token-temp-hp-fill');

                    if (token.maxHp > 0) {
                        const tempHp = token.tempHp || 0;

                        if (showBar) {
                            hpContainer.style.display = 'block';

                            let hpColor = 'var(--color-success-base)';
                            const rawHpPct = token.hp / token.maxHp;
                            hpFill.classList.remove('injured', 'danger');
                            if (rawHpPct < 0.25) {
                                hpColor = 'var(--color-danger-base)';
                                hpFill.classList.add('danger');
                            } else if (rawHpPct < 0.5) {
                                hpColor = 'var(--color-gold-base)';
                                hpFill.classList.add('injured');
                            }
                            hpFill.style.backgroundColor = hpColor;

                            // Bar & Temp Wrapper base geometry
                            let barTopStyle = 'auto';
                            let barBottomStyle = 'auto';

                            if (namePos === 'above' && barPos === 'above') {
                                barTopStyle = `-${effectiveBarHeight + Math.round(getScreenPx(4))}px`;
                            } else if (namePos === 'below' && barPos === 'below') {
                                barTopStyle = `calc(100% + ${Math.round(getScreenPx(4))}px)`;
                            } else if (namePos === 'top' && barPos === 'top') {
                                barTopStyle = `${Math.round(getScreenPx(22))}px`;
                            } else if (namePos === 'bottom' && barPos === 'bottom') {
                                barBottomStyle = `${Math.round(getScreenPx(4))}px`;
                            } else {
                                if (barPos === 'above')
                                    barTopStyle = `-${effectiveBarHeight + Math.round(getScreenPx(4))}px`;
                                else if (barPos === 'top') barTopStyle = `${Math.round(getScreenPx(4))}px`;
                                else if (barPos === 'bottom') barBottomStyle = `${Math.round(getScreenPx(4))}px`;
                                else if (barPos === 'below')
                                    barTopStyle = `calc(100% + ${Math.round(getScreenPx(4))}px)`;
                            }

                            const barSidePad = Math.round(getScreenPx(4));
                            hpContainer.style.left = `${barSidePad}px`;
                            hpContainer.style.right = `${barSidePad}px`;
                            hpContainer.style.width = 'auto';
                            hpContainer.style.top = barTopStyle;
                            hpContainer.style.bottom = barBottomStyle;
                            hpContainer.style.height = `${effectiveBarHeight}px`;
                            hpContainer.style.borderRadius = `${Math.min(4, Math.floor(effectiveBarHeight / 2))}px`;

                            tempHpWrapper.style.left = `${barSidePad}px`;
                            tempHpWrapper.style.right = `${barSidePad}px`;
                            tempHpWrapper.style.width = 'auto';
                            tempHpWrapper.style.top = barTopStyle;
                            tempHpWrapper.style.bottom = barBottomStyle;
                            tempHpWrapper.style.height = `${effectiveBarHeight}px`;
                            tempHpWrapper.style.borderRadius = `${Math.min(4, Math.floor(effectiveBarHeight / 2))}px`;

                            let style = activePrefs.tempHpBarStyle || campaignSettings.tempHpBarStyle || 'stacked';
                            if (style !== 'stacked' && showTempBar && tempHp > 0) {
                                tempHpWrapper.style.background = 'rgba(0,0,0,0.85)';
                                tempHpWrapper.style.border = '1px solid var(--color-border-subtle)';
                                tempHpWrapper.style.borderRadius = `${Math.min(4, Math.floor(effectiveBarHeight / 2))}px`;
                            } else {
                                tempHpWrapper.style.background = 'none';
                                tempHpWrapper.style.border = 'none';
                                tempHpWrapper.style.borderRadius = '0';
                            }

                            if (style === 'appended' && showTempBar && tempHp > 0) {
                                const totalMax = token.maxHp + tempHp;
                                const maxHpPct = Math.max(0, token.maxHp / totalMax);
                                const tempHpPct = Math.max(0, tempHp / totalMax);

                                hpContainer.style.right = 'auto';
                                hpContainer.style.width = `calc(${maxHpPct} * (100% - 8px))`;
                                const hpFillPct = Math.max(0, token.hp / token.maxHp);
                                hpFill.style.width = `${hpFillPct * 100}%`;

                                tempHpWrapper.style.left = `calc(4px + ${maxHpPct} * (100% - 8px))`;
                                tempHpWrapper.style.width = `calc(${tempHpPct} * (100% - 8px))`;
                                tempHpWrapper.style.right = 'auto';
                                tempHpFill.style.width = '100%';
                            } else if (style === 'split' && showTempBar && tempHp > 0) {
                                hpContainer.style.right = 'auto';
                                hpContainer.style.width = `calc(0.5 * (100% - 8px))`;
                                const hpFillPct = Math.max(0, Math.min(1, token.hp / token.maxHp));
                                hpFill.style.width = `${hpFillPct * 100}%`;

                                tempHpWrapper.style.left = `calc(50%)`;
                                tempHpWrapper.style.width = `calc(0.5 * (100% - 8px))`;
                                tempHpWrapper.style.right = 'auto';
                                const tempFillPct = Math.max(0, Math.min(1, tempHp / token.maxHp));
                                tempHpFill.style.width = `${tempFillPct * 100}%`;
                            } else if (style === 'layered' && showTempBar && tempHp > 0) {
                                const hpPct = Math.max(0, Math.min(1, token.hp / token.maxHp));
                                const tempPct = Math.max(0, Math.min(1, tempHp / token.maxHp));
                                hpFill.style.width = `${hpPct * 100}%`;

                                if (barBottomStyle !== 'auto') {
                                    const baseBottom = parseInt(barBottomStyle, 10) || 4;
                                    tempHpWrapper.style.bottom = `${baseBottom + effectiveBarHeight + 3}px`;
                                    tempHpWrapper.style.top = 'auto';
                                } else {
                                    if (barTopStyle.includes('calc')) {
                                        tempHpWrapper.style.top = `calc(100% + ${effectiveBarHeight + 7}px)`;
                                    } else {
                                        const baseTop = parseInt(barTopStyle, 10) || 4;
                                        tempHpWrapper.style.top = `${baseTop - effectiveBarHeight - 3}px`;
                                    }
                                    tempHpWrapper.style.bottom = 'auto';
                                }
                                tempHpFill.style.width = `${tempPct * 100}%`;
                            } else {
                                // Stacked or no temp HP
                                const hpPct = Math.max(0, Math.min(1, token.hp / token.maxHp));
                                const tempPct = Math.max(0, Math.min(1, tempHp / token.maxHp));
                                hpFill.style.width = `${hpPct * 100}%`;
                                tempHpFill.style.width = `${tempPct * 100}%`;
                            }

                            if (tempHp > 0 && showTempBar) {
                                tempHpWrapper.style.display = 'block';
                            } else {
                                tempHpWrapper.style.display = 'none';
                            }

                            // HP Text
                            if (showNum || (tempHp > 0 && showTempNum)) {
                                hpText.style.display = 'block';
                                let hpString = '';
                                if (showNum) {
                                    hpString += `${token.hp} / ${token.maxHp}`;
                                }
                                if (tempHp > 0 && showTempNum) {
                                    if (hpString !== '') hpString += ` `;
                                    hpString += `(+${tempHp})`;
                                }
                                if (hpText.textContent !== hpString) {
                                    hpText.textContent = hpString;
                                }
                                const effectiveHpFontSize = Math.round(getScreenPx(10));
                                hpText.style.top = barTopStyle;
                                hpText.style.bottom = barBottomStyle;
                                hpText.style.lineHeight = `${effectiveBarHeight}px`;
                                hpText.style.fontSize = `${effectiveHpFontSize}px`;
                                hpText.style.textShadow = '0 0 2px black, 0 0 3px black, 0 0 4px black';
                            } else {
                                hpText.style.display = 'none';
                            }
                        } else {
                            hpContainer.style.display = 'none';
                            tempHpWrapper.style.display = 'none';
                            hpText.style.display = 'none';
                        }
                    } else {
                        hpContainer.style.display = 'none';
                        hpText.style.display = 'none';
                        tempHpWrapper.style.display = 'none';
                    }

                    // 4. Conditions
                    const condContainer = uiNode.querySelector('.token-condition-container');
                    const hasConditions = token.conditions && token.conditions.length > 0;
                    if (hasConditions) {
                        const condBadgeSize = Math.round(getScreenPx(20));
                        const condFontSize = Math.round(getScreenPx(11));

                        const maxVisibleConditions = 3;
                        let visibleConditions = token.conditions;
                        let overflowCount = 0;
                        if (token.conditions.length > maxVisibleConditions) {
                            visibleConditions = token.conditions.slice(0, maxVisibleConditions - 1);
                            overflowCount = token.conditions.length - (maxVisibleConditions - 1);
                        }

                        let iconsHtml = visibleConditions
                            .map((c) => {
                                if (c.isCustom) {
                                    return `<div title="${c.name}" style="background: ${c.color || 'var(--color-gold-base)'}; border: 2px solid white; border-radius: 50%; width: ${condBadgeSize}px; height: ${condBadgeSize}px; min-width: ${condBadgeSize}px; min-height: ${condBadgeSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 4px black; cursor: help; pointer-events: auto;">&nbsp;</div>`;
                                }
                                const iconClass = CONDITION_ICONS[c.name] || 'fa-circle-exclamation';
                                return `<div title="${c.name}" style="background: rgba(0,0,0,0.85); border: 1px solid var(--color-gold-base); border-radius: 50%; width: ${condBadgeSize}px; height: ${condBadgeSize}px; min-width: ${condBadgeSize}px; min-height: ${condBadgeSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: ${condFontSize}px; text-shadow: 1px 1px 2px black; pointer-events: auto; cursor: help;">
                                        <i class="fa-solid ${iconClass}"></i>
                                    </div>`;
                            })
                            .join('');

                        if (overflowCount > 0) {
                            const remainingNames = token.conditions
                                .slice(maxVisibleConditions - 1)
                                .map((c) => c.name)
                                .join(', ');
                            iconsHtml += `<div title="${remainingNames}" style="background: rgba(0,0,0,0.85); border: 1px solid var(--color-gold-base); border-radius: 50%; width: ${condBadgeSize}px; height: ${condBadgeSize}px; min-width: ${condBadgeSize}px; min-height: ${condBadgeSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--color-gold-base); font-size: ${condFontSize}px; font-weight: bold; pointer-events: auto; cursor: help;">+${overflowCount}</div>`;
                        }

                        if (condContainer.innerHTML !== iconsHtml) condContainer.innerHTML = iconsHtml;
                        condContainer.style.display = 'flex';

                        const condOffsetOutside = `-${Math.round(getScreenPx(18))}px`;
                        const condOffsetInside = `${Math.round(getScreenPx(4))}px`;

                        if (condPos === 'outside-tr') {
                            condContainer.style.top = condOffsetOutside;
                            condContainer.style.right = condOffsetOutside;
                            condContainer.style.bottom = 'auto';
                            condContainer.style.left = 'auto';
                            condContainer.style.flexDirection = condOrientation === 'vertical' ? 'column' : 'row';
                            condContainer.style.alignItems = 'flex-start';
                        } else if (condPos === 'outside-br') {
                            condContainer.style.bottom = condOffsetOutside;
                            condContainer.style.right = condOffsetOutside;
                            condContainer.style.top = 'auto';
                            condContainer.style.left = 'auto';
                            condContainer.style.flexDirection = condOrientation === 'vertical' ? 'column' : 'row';
                            condContainer.style.alignItems = 'flex-end';
                        } else {
                            // 'inside-tr'
                            condContainer.style.top = condOffsetInside;
                            condContainer.style.right = condOffsetInside;
                            condContainer.style.bottom = 'auto';
                            condContainer.style.left = 'auto';
                            condContainer.style.flexDirection = condOrientation === 'vertical' ? 'column' : 'row';
                            condContainer.style.alignItems = 'flex-end';
                        }
                    } else {
                        condContainer.style.display = 'none';
                    }

                    // 5. Flight
                    const flightContainer = uiNode.querySelector('.token-flight-container');
                    const altitude = token.flightHeight || token.altitude || 0;
                    if (altitude !== 0) {
                        const flightBadgeSize = Math.round(getScreenPx(24));
                        const flightIconSize = Math.round(getScreenPx(10));
                        const flightFontSize = Math.round(getScreenPx(9));
                        flightContainer.style.width = `${flightBadgeSize}px`;
                        flightContainer.style.height = `${flightBadgeSize}px`;

                        const flightIcon = flightContainer.querySelector('i');
                        if (flightIcon) flightIcon.style.fontSize = `${flightIconSize}px`;

                        const altSpan = flightContainer.querySelector('.flight-altitude');
                        if (altSpan) {
                            altSpan.style.fontSize = `${flightFontSize}px`;
                            const altStr = altitude > 0 ? `+${altitude}` : `${altitude}`;
                            if (altSpan.textContent !== altStr) altSpan.textContent = altStr;
                        }
                        flightContainer.style.display = 'flex';

                        const flightOffsetOutside = `-${Math.round(getScreenPx(18))}px`;
                        const flightOffsetInside = `${Math.round(getScreenPx(4))}px`;

                        if (flightPos === 'outside-tl') {
                            flightContainer.style.top = flightOffsetOutside;
                            flightContainer.style.left = flightOffsetOutside;
                            flightContainer.style.bottom = 'auto';
                            flightContainer.style.right = 'auto';
                        } else if (flightPos === 'outside-bl') {
                            flightContainer.style.bottom = flightOffsetOutside;
                            flightContainer.style.left = flightOffsetOutside;
                            flightContainer.style.top = 'auto';
                            flightContainer.style.right = 'auto';
                        } else {
                            // 'inside-tl'
                            flightContainer.style.top = flightOffsetInside;
                            flightContainer.style.left = flightOffsetInside;
                            flightContainer.style.bottom = 'auto';
                            flightContainer.style.right = 'auto';
                        }
                    } else {
                        flightContainer.style.display = 'none';
                    }
                } else if (uiNode) {
                    uiNode.style.display = 'none';
                }
            }
            // Draw 8-Way Resize Handles & Bounding Box for Assets / Maps
            const isResizable = token.isAsset || token.layer === 'map' || token.isBackground;
            if (
                isResizable &&
                isTokenSelected &&
                activeTool === 'select' &&
                (vtt.role === 'GM' || tokenLayer !== 'gm')
            ) {
                ctxInteraction.save();
                const currentZoom = Math.max(0.05, zoom || 1);
                const shudder = getTokenShudderOffset(id);
                const basePos = tokenAnimations[id]?.currentPos || { x: token.x, y: token.y };
                const renderPos = { x: basePos.x + shudder.x, y: basePos.y + shudder.y };
                const { drawW, drawH } = getTokenDrawDimensions(token);

                // Billboard handle dimensions (constant physical pixels on screen)
                const handleSize = 8 / currentZoom;
                const halfHandle = handleSize / 2;
                const lineW = 1.5 / currentZoom;

                const cx = renderPos.x + drawW / 2;
                const cy = renderPos.y + drawH / 2;
                if (token.rotation) {
                    ctxInteraction.translate(cx, cy);
                    ctxInteraction.rotate(((token.rotation || 0) * Math.PI) / 180);
                    ctxInteraction.translate(-cx, -cy);
                }

                // Accent bounding outline
                ctxInteraction.strokeStyle = 'rgba(212, 175, 55, 0.9)';
                ctxInteraction.lineWidth = lineW;
                ctxInteraction.setLineDash([5 / currentZoom, 4 / currentZoom]);
                ctxInteraction.strokeRect(renderPos.x, renderPos.y, drawW, drawH);
                ctxInteraction.setLineDash([]);

                // 8 Resize Handles (4 corners + 4 edge centers)
                const handlePositions = [
                    { x: renderPos.x, y: renderPos.y }, // nw
                    { x: renderPos.x + drawW / 2, y: renderPos.y }, // n
                    { x: renderPos.x + drawW, y: renderPos.y }, // ne
                    { x: renderPos.x + drawW, y: renderPos.y + drawH / 2 }, // e
                    { x: renderPos.x + drawW, y: renderPos.y + drawH }, // se
                    { x: renderPos.x + drawW / 2, y: renderPos.y + drawH }, // s
                    { x: renderPos.x, y: renderPos.y + drawH }, // sw
                    { x: renderPos.x, y: renderPos.y + drawH / 2 } // w
                ];

                for (const h of handlePositions) {
                    ctxInteraction.fillStyle = '#ffffff';
                    ctxInteraction.strokeStyle = '#d4af37';
                    ctxInteraction.lineWidth = lineW;
                    ctxInteraction.beginPath();
                    ctxInteraction.rect(h.x - halfHandle, h.y - halfHandle, handleSize, handleSize);
                    ctxInteraction.fill();
                    ctxInteraction.stroke();
                }

                ctxInteraction.restore();
            }
        });
}

// ==========================================
// Active Visual Pings & Damage FX Rendering
// ==========================================
export function renderActivePingsPass(ctxInteraction, pings = activePings) {
    // Render active pings
    if (activePings && activePings.length > 0) {
        const now = Date.now();
        activePings.forEach((p) => {
            const elapsed = now - p.startTime;
            if (elapsed >= p.duration) return;

            const progress = elapsed / p.duration;
            // Easing out sine wave for smooth expansion
            const easeOut = Math.sin((progress * Math.PI) / 2);
            const radius = 5 + easeOut * 80;
            const opacity = 1.0 - progress;

            ctxInteraction.save();
            const color = p.role === 'GM' ? '255, 60, 60' : '60, 160, 255';

            // Outer expanding ring
            ctxInteraction.beginPath();
            ctxInteraction.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctxInteraction.strokeStyle = `rgba(${color}, ${opacity})`;
            ctxInteraction.lineWidth = 4;
            ctxInteraction.stroke();

            // Inner static dot
            ctxInteraction.beginPath();
            ctxInteraction.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctxInteraction.fillStyle = `rgba(${color}, ${opacity})`;
            ctxInteraction.fill();

            // Username label
            if (p.username) {
                ctxInteraction.font = 'bold 13px var(--font-primary)';
                ctxInteraction.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctxInteraction.textAlign = 'center';
                ctxInteraction.shadowColor = 'rgba(0,0,0,1)';
                ctxInteraction.shadowBlur = 4;
                ctxInteraction.fillText(p.username, p.x, p.y - Math.max(radius, 20) - 8);
            }
            ctxInteraction.restore();
        });
    }
}

export function renderActiveDamageFXPass(ctxInteraction, fxList = null, renderDamageFXBurstFn = renderDamageFXBurst) {
    const list = fxList && fxList.length > 0 ? fxList : activeDamageFX;
    if (!ctxInteraction || !list || list.length === 0) return;
    const now = Date.now();
    const burstFn = typeof renderDamageFXBurstFn === 'function' ? renderDamageFXBurstFn : renderDamageFXBurst;
    list.forEach((fx) => {
        const elapsed = now - fx.startTime;
        if (elapsed >= fx.duration) return;
        const progress = elapsed / fx.duration;
        const opacity = Math.max(0, 1.0 - progress);

        ctxInteraction.save();
        (fx.types || ['untyped']).forEach((type, idx) => {
            burstFn(ctxInteraction, fx.x, fx.y, fx.radius, progress, opacity, type, idx);
        });
        ctxInteraction.restore();
    });
}

export function cleanupOrphanedTokenOverlays(tokens = {}) {
    // Cleanup orphaned token overlays across both overlay containers (main and under-grid map layer)
    const validTokenIds = new Set(Object.keys(tokens));
    const overlayContainers = [
        document.getElementById('vtt-html-overlays'),
        document.getElementById('vtt-map-html-overlays')
    ].filter(Boolean);

    overlayContainers.forEach((container) => {
        container.querySelectorAll('[id^="asset_node_"], [id^="token_ui_"]').forEach((node) => {
            let tokenId = '';
            if (node.id.startsWith('asset_node_')) tokenId = node.id.substring(11);
            else if (node.id.startsWith('token_ui_')) tokenId = node.id.substring(9);
            if (tokenId && !validTokenIds.has(tokenId)) {
                cleanupMediaElement(node);
            }
        });
    });
}

// ==========================================
// Animation Loop: Pings & Damage FX
// ==========================================
function triggerPingAnimation(x, y, username, role) {
    activePings.push({
        x,
        y,
        username,
        role,
        startTime: Date.now(),
        duration: 3000
    });
    if (!pingAnimFrame) {
        animatePings();
    }
}

function animatePings() {
    const now = Date.now();
    activePings = activePings.filter((p) => now - p.startTime < p.duration);

    getRenderAll()();

    if (activePings.length > 0) {
        pingAnimFrame = requestAnimFrame(animatePings);
    } else {
        pingAnimFrame = null;
    }
}

function isDamageFxPrefEnabled() {
    try {
        const prefs = loadPlayerTokenPrefs();
        if (prefs && prefs.damageFxEnabled === false) return false;
    } catch (e) {}
    return true;
}

function triggerTokenShudder(tokenId, amplitude = 5, duration = 200) {
    if (!tokenId || !isDamageFxPrefEnabled()) return;
    activeTokenShudders[tokenId] = {
        startTime: Date.now(),
        duration,
        amplitude
    };
    if (!damageFXAnimFrame) {
        animateDamageFX();
    }
}

function getTokenShudderOffset(tokenId) {
    const s = activeTokenShudders[tokenId];
    if (!s) return { x: 0, y: 0 };
    const elapsed = Date.now() - s.startTime;
    if (elapsed >= s.duration) {
        delete activeTokenShudders[tokenId];
        return { x: 0, y: 0 };
    }
    const progress = elapsed / s.duration;
    // Damped harmonic decay
    const decay = (1.0 - progress) * (1.0 - progress);
    const angle = elapsed * 0.09;
    const dx = Math.sin(angle * 4.0) * s.amplitude * decay;
    const dy = Math.cos(angle * 5.0) * (s.amplitude * 0.6) * decay;
    return { x: dx, y: dy };
}

function triggerDamageFXAnimation(x, y, radius, damageTypes, meta = {}) {
    if (!isDamageFxPrefEnabled()) return;
    if (meta && meta.delayMs > 0) {
        const delayedMeta = { ...meta, delayMs: 0 };
        setTimeout(() => triggerDamageFXAnimation(x, y, radius, damageTypes, delayedMeta), meta.delayMs);
        return;
    }
    const types = Array.isArray(damageTypes) && damageTypes.length > 0 ? damageTypes : ['untyped'];

    // Spawn distinct procedural vector graphics directly on #vtt-html-overlays (500ms Hyper-Snappy)
    spawnProceduralCombatFX(x, y, radius, types, meta, false, false);

    activeDamageFX.push({
        x,
        y,
        radius: Math.max(18, radius || 25),
        types,
        amount: meta && meta.amount !== undefined && meta.amount !== null ? meta.amount : null,
        tokenId: meta && meta.tokenId ? meta.tokenId : null,
        startTime: Date.now(),
        duration: 500 // 500ms duration per user specification for hyper-snappy mass combat
    });
    if (meta && meta.tokenId) {
        triggerTokenShudder(meta.tokenId);
    }
    if (!damageFXAnimFrame) {
        animateDamageFX();
    }
}

function triggerHealingFXAnimation(x, y, radius, amount, meta = {}) {
    if (!isDamageFxPrefEnabled()) return;
    if (meta && meta.delayMs > 0) {
        const delayedMeta = { ...meta, delayMs: 0 };
        setTimeout(() => triggerHealingFXAnimation(x, y, radius, amount, delayedMeta), meta.delayMs);
        return;
    }
    const isTempHp = Boolean(meta && meta.isTempHp);
    const resolvedTypes = [isTempHp ? 'temphp' : 'heal'];
    const resolvedMeta = {
        amount: amount !== undefined && amount !== null ? amount : meta.amount || 0,
        tokenId: meta && meta.tokenId ? meta.tokenId : null,
        isHeal: !isTempHp,
        isTempHp: isTempHp,
        ...meta
    };

    // Spawn distinct procedural vector graphics directly on #vtt-html-overlays (500ms Hyper-Snappy)
    spawnProceduralCombatFX(x, y, radius, resolvedTypes, resolvedMeta, !isTempHp, isTempHp);

    activeDamageFX.push({
        x,
        y,
        radius: Math.max(18, radius || 25),
        types: resolvedTypes,
        amount: resolvedMeta.amount,
        tokenId: resolvedMeta.tokenId,
        isHeal: !isTempHp,
        isTempHp: isTempHp,
        startTime: Date.now(),
        duration: 500
    });
    // Healing and Temp HP do NOT shake the token (keeps positive feedback soothing)
    if (!damageFXAnimFrame) {
        animateDamageFX();
    }
}

function animateDamageFX() {
    const now = Date.now();
    activeDamageFX = activeDamageFX.filter((fx) => now - fx.startTime < fx.duration);

    let hasActiveShudders = false;
    for (const id in activeTokenShudders) {
        if (now - activeTokenShudders[id].startTime < activeTokenShudders[id].duration) {
            hasActiveShudders = true;
        } else {
            delete activeTokenShudders[id];
        }
    }

    getRenderAll()();

    if (activeDamageFX.length > 0 || hasActiveShudders) {
        damageFXAnimFrame = requestAnimFrame(animateDamageFX);
    } else {
        damageFXAnimFrame = null;
    }
}

function renderDamageFXBurst(ctx, x, y, baseRadius, progress, opacity, damageType, index = 0) {
    // Dynamic ease-out expansion: explodes fast in first 150ms then gently expands as it fades
    const easeOut = 1.0 - Math.pow(1.0 - progress, 2.5);
    const r = baseRadius * (0.7 + easeOut * 0.7);
    const normType = (damageType || 'untyped').trim().toLowerCase();

    if (normType.includes('heal')) {
        // Healing: Soothing Emerald Bloom + Rising Verdant Sparkles
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.15);
        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.95})`);
        grad.addColorStop(0.35, `rgba(134, 239, 172, ${opacity * 0.85})`);
        grad.addColorStop(0.7, `rgba(34, 197, 94, ${opacity * 0.45})`);
        grad.addColorStop(1, 'rgba(21, 128, 61, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // 8 rising healing sparkles drifting upward in a soft spiral
        for (let i = 0; i < 8; i++) {
            const seed = i * 0.785;
            const spiralAng = seed + progress * 2.5;
            const dist = baseRadius * 0.65 * (0.3 + progress * 0.8);
            const px = x + Math.cos(spiralAng) * dist;
            const py = y + Math.sin(spiralAng) * (dist * 0.5) - progress * 32;
            const sparkR = Math.max(1, 3.5 * (1 - progress));
            ctx.fillStyle = i % 2 === 0 ? `rgba(255, 255, 255, ${opacity})` : `rgba(254, 240, 138, ${opacity * 0.9})`;
            ctx.beginPath();
            ctx.arc(px, py, sparkR, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (normType.includes('temphp') || normType.includes('temp_hp')) {
        // Temp HP: Protective Sapphire Ward Ring + Shimmering Barrier Brackets
        const ringR = r * 0.95;
        ctx.strokeStyle = `rgba(56, 189, 248, ${opacity * 0.95})`;
        ctx.lineWidth = 4 * (1 - progress * 0.4);
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.85})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, ringR * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            const bR = ringR * 1.1;
            const bx = x + Math.cos(ang) * bR;
            const by = y + Math.sin(ang) * bR;
            ctx.fillStyle = `rgba(186, 230, 253, ${opacity * 0.9})`;
            ctx.beginPath();
            ctx.arc(bx, by, 3 * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (normType.includes('fire')) {
        // 1. Fire: Blooming incandescent core + dancing ember sparks
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(255, 245, 180, ${opacity})`);
        grad.addColorStop(0.3, `rgba(255, 115, 36, ${opacity * 0.9})`);
        grad.addColorStop(0.75, `rgba(220, 38, 38, ${opacity * 0.5})`);
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // 8 glowing ember sparks drifting upward with slight horizontal wobble
        for (let i = 0; i < 8; i++) {
            const seed = i * 1.618;
            const ang = seed * Math.PI * 2;
            const speed = 0.7 + (i % 3) * 0.25;
            const dist = baseRadius * (0.3 + progress * 0.9 * speed);
            const px = x + Math.cos(ang) * dist + Math.sin(progress * 8 + i) * 3;
            const py = y + Math.sin(ang) * (dist * 0.6) - progress * 24 * speed;
            const sparkR = Math.max(1, 3 * (1 - progress));
            ctx.fillStyle = i % 2 === 0 ? `rgba(255, 235, 120, ${opacity})` : `rgba(255, 107, 53, ${opacity * 0.9})`;
            ctx.beginPath();
            ctx.arc(px, py, sparkR, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (normType.includes('cold') || normType.includes('ice')) {
        // 2. Cold: Glacial frost core + branching snowflake fractures with diamond tips
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        grad.addColorStop(0.4, `rgba(103, 232, 249, ${opacity * 0.85})`);
        grad.addColorStop(0.8, `rgba(2, 132, 199, ${opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(3, 105, 161, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // 6 crystalline frost arms with sub-barbs
        ctx.strokeStyle = `rgba(224, 242, 254, ${opacity * 0.95})`;
        ctx.lineWidth = 2.5 * (1 - progress * 0.3);
        for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3;
            const armLen = r * 1.15;
            const ex = x + Math.cos(ang) * armLen;
            const ey = y + Math.sin(ang) * armLen;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(ex, ey);

            const midX = x + Math.cos(ang) * (armLen * 0.55);
            const midY = y + Math.sin(ang) * (armLen * 0.55);
            const barbAng1 = ang + Math.PI / 4;
            const barbAng2 = ang - Math.PI / 4;
            const barbLen = armLen * 0.25;
            ctx.moveTo(midX, midY);
            ctx.lineTo(midX + Math.cos(barbAng1) * barbLen, midY + Math.sin(barbAng1) * barbLen);
            ctx.moveTo(midX, midY);
            ctx.lineTo(midX + Math.cos(barbAng2) * barbLen, midY + Math.sin(barbAng2) * barbLen);
            ctx.stroke();

            // Diamond ice shards at tips
            const tipR = 2.5 * (1 - progress * 0.5);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fillRect(ex - tipR, ey - tipR, tipR * 2, tipR * 2);
        }
    } else if (normType.includes('lightning') || normType.includes('electric')) {
        // 3. Lightning: High-intensity arc flash + 3 branching jagged bolts
        ctx.fillStyle = `rgba(254, 240, 138, ${opacity * 0.45})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2.8;
        for (let b = 0; b < 3; b++) {
            const baseAng = (b * Math.PI * 2) / 3 + 0.3;
            let cx = x;
            let cy = y;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const steps = 5;
            for (let s = 1; s <= steps; s++) {
                const dist = r * 1.25 * (s / steps);
                const jitter = Math.sin(s * 13 + progress * 20 + b * 7) * 0.5 * 14;
                const nx = x + Math.cos(baseAng) * dist - Math.sin(baseAng) * jitter;
                const ny = y + Math.sin(baseAng) * dist + Math.cos(baseAng) * jitter;
                ctx.lineTo(nx, ny);
                cx = nx;
                cy = ny;
            }
            ctx.stroke();
        }
        ctx.strokeStyle = `rgba(250, 204, 21, ${opacity * 0.65})`;
        ctx.lineWidth = 5;
    } else if (normType.includes('thunder')) {
        // 4. Thunder: Triple acoustic shockwave rings + radial sound compression dashes
        for (let i = 0; i < 3; i++) {
            const ringProgress = Math.max(0, Math.min(1, progress * 1.3 - i * 0.15));
            const ringR = baseRadius * (0.4 + ringProgress * 1.4);
            const ringOpacity = opacity * (1 - ringProgress);
            ctx.strokeStyle = `rgba(186, 230, 253, ${ringOpacity})`;
            ctx.lineWidth = 3.5 * (1 - ringProgress);
            ctx.beginPath();
            ctx.arc(x, y, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI) / 4;
            const d1 = r * 0.6;
            const d2 = r * 1.1;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(ang) * d1, y + Math.sin(ang) * d1);
            ctx.lineTo(x + Math.cos(ang) * d2, y + Math.sin(ang) * d2);
            ctx.stroke();
        }
    } else if (normType.includes('acid')) {
        // 5. Acid: Caustic sizzling puddle + effervescent popping bubbles
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(217, 249, 157, ${opacity * 0.9})`);
        grad.addColorStop(0.5, `rgba(132, 204, 22, ${opacity * 0.6})`);
        grad.addColorStop(1, 'rgba(77, 124, 15, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 7; i++) {
            const bAngle = i * 0.9 * Math.PI;
            const bDist = baseRadius * 0.7 * ((i % 4) / 4 + 0.2);
            const bx = x + Math.cos(bAngle) * bDist;
            const by = y + Math.sin(bAngle) * bDist + progress * 8;
            const bRadius = Math.max(1, (3.5 - (i % 2)) * (1.0 - Math.abs(progress - 0.4) * 1.5));
            ctx.strokeStyle = `rgba(254, 252, 232, ${opacity * 0.95})`;
            ctx.lineWidth = 1.5;
            ctx.fillStyle = `rgba(163, 230, 53, ${opacity * 0.7})`;
            ctx.beginPath();
            ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    } else if (normType.includes('poison')) {
        // 6. Poison: 5 swirling billowing toxic miasma smoke puffs
        for (let i = 0; i < 5; i++) {
            const puffAngle = (i * Math.PI * 2) / 5 + progress * 0.8;
            const puffDist = r * 0.55 * progress;
            const px = x + Math.cos(puffAngle) * puffDist;
            const py = y + Math.sin(puffAngle) * puffDist;
            const puffR = baseRadius * (0.45 + progress * 0.55);
            const pGrad = ctx.createRadialGradient(px, py, 0, px, py, puffR);
            pGrad.addColorStop(0, `rgba(74, 222, 128, ${opacity * 0.7})`);
            pGrad.addColorStop(0.6, `rgba(22, 101, 52, ${opacity * 0.4})`);
            pGrad.addColorStop(1, 'rgba(5, 46, 22, 0)');
            ctx.fillStyle = pGrad;
            ctx.beginPath();
            ctx.arc(px, py, puffR, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (normType.includes('radiant')) {
        // 7. Radiant: Sacred golden halo + 4-point holy starburst flare
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        grad.addColorStop(0.3, `rgba(254, 240, 138, ${opacity * 0.85})`);
        grad.addColorStop(0.7, `rgba(234, 179, 8, ${opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(202, 138, 4, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
        ctx.fill();

        const rayLen = r * 1.45;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.95})`;
        ctx.lineWidth = 3.5 * (1 - progress * 0.6);
        ctx.beginPath();
        ctx.moveTo(x, y - rayLen);
        ctx.lineTo(x, y + rayLen);
        ctx.moveTo(x - rayLen, y);
        ctx.lineTo(x + rayLen, y);
        ctx.stroke();

        ctx.lineWidth = 1.8 * (1 - progress * 0.6);
        ctx.strokeStyle = `rgba(253, 224, 71, ${opacity * 0.8})`;
        const diagLen = rayLen * 0.55;
        ctx.beginPath();
        ctx.moveTo(x - diagLen, y - diagLen);
        ctx.lineTo(x + diagLen, y + diagLen);
        ctx.moveTo(x - diagLen, y + diagLen);
        ctx.lineTo(x + diagLen, y - diagLen);
        ctx.stroke();
    } else if (normType.includes('necrotic')) {
        // 8. Necrotic: Obsidian void core + 5 writhing dark soul tendrils
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(15, 10, 25, ${opacity * 0.95})`);
        grad.addColorStop(0.4, `rgba(88, 28, 135, ${opacity * 0.8})`);
        grad.addColorStop(0.8, `rgba(147, 51, 234, ${opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(59, 7, 100, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(192, 132, 252, ${opacity * 0.85})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) {
            const tAng = (i * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            const c1x = x + Math.cos(tAng) * (r * 0.5) + Math.sin(progress * 10 + i) * 8;
            const c1y = y + Math.sin(tAng) * (r * 0.5) + Math.cos(progress * 10 + i) * 8;
            const endX = x + Math.cos(tAng) * (r * 1.25);
            const endY = y + Math.sin(tAng) * (r * 1.25);
            ctx.quadraticCurveTo(c1x, c1y, endX, endY);
            ctx.stroke();
        }
    } else if (normType.includes('force')) {
        // 9. Force: Double concentric dimensional distortion rings + 6 kinetic pulse beads
        for (let i = 0; i < 2; i++) {
            const ringR = r * (i === 0 ? 1.0 : 0.65);
            ctx.strokeStyle =
                i === 0 ? `rgba(232, 121, 249, ${opacity * 0.95})` : `rgba(192, 132, 252, ${opacity * 0.8})`;
            ctx.lineWidth = (4 - i * 1.5) * (1 - progress * 0.4);
            ctx.beginPath();
            ctx.arc(x, y, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
            const beadAng = (i * Math.PI) / 3 + progress * 2.0;
            const bx = x + Math.cos(beadAng) * r;
            const by = y + Math.sin(beadAng) * r;
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
            ctx.beginPath();
            ctx.arc(bx, by, 2.5 * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (normType.includes('psychic')) {
        // 10. Psychic: 2 concentric undulating telepathic brain-wave sine curves
        ctx.strokeStyle = `rgba(244, 114, 182, ${opacity * 0.9})`;
        ctx.lineWidth = 3.0 * (1 - progress * 0.3);
        for (let w = 0; w < 2; w++) {
            const waveR = r * (0.65 + w * 0.45);
            ctx.beginPath();
            const pts = 36;
            for (let p = 0; p <= pts; p++) {
                const th = (p / pts) * Math.PI * 2;
                const waveOffset = Math.sin(th * 6 + progress * 12 + w * 2) * 4;
                const rad = waveR + waveOffset;
                const wx = x + Math.cos(th) * rad;
                const wy = y + Math.sin(th) * rad;
                if (p === 0) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            }
            ctx.closePath();
            ctx.stroke();
        }
    } else if (normType.includes('slashing')) {
        // 11. Slashing: Fast curved blade slice arc with trailing crimson motion blur
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 0.8);
        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.95})`);
        grad.addColorStop(0.35, `rgba(239, 68, 68, ${opacity * 0.7})`);
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
        ctx.fill();

        const slashProgress = Math.min(1.0, progress * 2.2);
        const startX = x - r * 0.85;
        const startY = y - r * 0.65;
        const endX = x + r * 0.85;
        const endY = y + r * 0.65;
        const curEndX = startX + (endX - startX) * slashProgress;
        const curEndY = startY + (endY - startY) * slashProgress;
        const ctrlX = x + r * 0.25;
        const ctrlY = y - r * 0.15;

        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 3.5 * (1 - progress * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, curEndX, curEndY);
        ctx.stroke();

        ctx.strokeStyle = `rgba(220, 38, 38, ${opacity * 0.75})`;
        ctx.lineWidth = 6 * (1 - progress * 0.6);
        ctx.beginPath();
        ctx.moveTo(startX, startY + 2);
        ctx.quadraticCurveTo(ctrlX, ctrlY + 2, curEndX, curEndY + 2);
        ctx.stroke();
    } else if (normType.includes('piercing')) {
        // 12. Piercing: Pinpoint puncture spark + penetrating thrust line + cone shockwave
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, 6 * (1 - progress)), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(248, 250, 252, ${opacity * 0.95})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.9, y - r * 0.9);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 0.85})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.75, Math.PI * 0.1, Math.PI * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 1.1, Math.PI * 0.15, Math.PI * 0.55);
        ctx.stroke();
    } else if (normType.includes('bludgeoning')) {
        // 13. Bludgeoning: Concussive heavy compression shockwave + kinetic debris flecks
        ctx.strokeStyle = `rgba(241, 245, 249, ${opacity * 0.9})`;
        ctx.lineWidth = 5 * (1 - progress * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 6; i++) {
            const dAng = (i * Math.PI) / 3 + 0.2;
            const dDist = r * 0.4 + progress * r * 0.85;
            const dx = x + Math.cos(dAng) * dDist;
            const dy = y + Math.sin(dAng) * dDist;
            const debrisR = Math.max(1, 3 * (1 - progress));
            ctx.fillStyle = i % 2 === 0 ? `rgba(255, 255, 255, ${opacity})` : `rgba(148, 163, 184, ${opacity * 0.8})`;
            ctx.beginPath();
            ctx.arc(dx, dy, debrisR, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // 14. Untyped / Generic physical fallback: Dual cross-slash (X strike) with crimson sparks
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.9})`);
        grad.addColorStop(0.35, `rgba(239, 68, 68, ${opacity * 0.8})`);
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 245, 245, ${opacity})`;
        ctx.lineWidth = 3 * (1 - progress * 0.4);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.65, y - r * 0.65);
        ctx.lineTo(x + r * 0.65, y + r * 0.65);
        ctx.moveTo(x + r * 0.65, y - r * 0.65);
        ctx.lineTo(x - r * 0.65, y + r * 0.65);
        ctx.stroke();
    }
}

// ==========================================
// Animation Loop: Token Path Interpolation
// ==========================================
function processTokenAnimReqs(tokensObj) {
    let startAnim = false;
    const now = Date.now();
    for (const id in tokensObj) {
        if (tokensObj[id]?._animReq) {
            const req = tokensObj[id]._animReq;
            const animKey = `${id}_${req.timestamp || 0}`;

            if (processedAnimKeys.has(animKey) || now - (req.timestamp || 0) > 1500) {
                delete tokensObj[id]._animReq;
                continue;
            }

            processedAnimKeys.add(animKey);
            if (processedAnimKeys.size > 200) {
                processedAnimKeys = new Set(Array.from(processedAnimKeys).slice(-100));
            }

            let totalDist = 0;
            let segments = [];
            const t = tokensObj[id];
            let adjustedWaypoints = [];
            if (req.waypoints && req.waypoints.length > 0 && t) {
                const getDim =
                    tokenRendererContext.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50, tokenRadius: 25 }));
                const { drawW, drawH } = getDim(t);
                adjustedWaypoints = req.waypoints.map((wp) => ({
                    x: wp.x - drawW / 2,
                    y: wp.y - drawH / 2
                }));
            }
            const points = [{ x: req.startX, y: req.startY }, ...adjustedWaypoints, { x: req.endX, y: req.endY }];
            for (let i = 0; i < points.length - 1; i++) {
                const dx = points[i + 1].x - points[i].x;
                const dy = points[i + 1].y - points[i].y;
                const dist = Math.hypot(dx, dy);
                segments.push({ start: points[i], end: points[i + 1], dist: dist });
                totalDist += dist;
            }
            tokenAnimations[id] = {
                ...req,
                startTime: now,
                segments,
                totalDist,
                currentPos: { x: req.startX, y: req.startY }
            };
            startAnim = true;
            delete tokensObj[id]._animReq;
        }
    }
    if (startAnim && !tokenAnimFrame) {
        tokenAnimFrame = requestAnimFrame(animateTokens);
    }
}

function animateTokens() {
    let hasActive = false;
    const now = Date.now();
    const tokens = getTokens();
    for (const id in tokenAnimations) {
        const anim = tokenAnimations[id];
        const t = tokens[id];
        if (!t) {
            delete tokenAnimations[id];
            continue;
        }

        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        if (anim.totalDist === 0) {
            anim.currentPos = { x: anim.endX, y: anim.endY };
            delete tokenAnimations[id];
            continue;
        }

        const targetDist = progress * anim.totalDist;
        let currentDist = 0;
        let currentPos = { x: anim.endX, y: anim.endY };

        for (let i = 0; i < anim.segments.length; i++) {
            const seg = anim.segments[i];
            if (currentDist + seg.dist >= targetDist) {
                const segProgress = seg.dist === 0 ? 1 : (targetDist - currentDist) / seg.dist;
                currentPos = {
                    x: seg.start.x + (seg.end.x - seg.start.x) * segProgress,
                    y: seg.start.y + (seg.end.y - seg.start.y) * segProgress
                };
                break;
            }
            currentDist += seg.dist;
        }

        anim.currentPos = currentPos;

        if (progress >= 1) {
            anim.currentPos = { x: anim.endX, y: anim.endY };
            delete tokenAnimations[id];
        } else {
            hasActive = true;
        }
    }

    if (hasActive) {
        getRenderAll()();
        tokenAnimFrame = requestAnimFrame(animateTokens);
    } else {
        tokenAnimFrame = null;
        getRenderAll()();
    }
}

// ==========================================
// Token Category Classification
// ==========================================
function getTokenCategory(token) {
    if (!token) return 'bestiary';
    const vtt = getVtt();
    let char = null;
    if (vtt.campaignState && vtt.campaignState.characters && token.characterId) {
        char = vtt.campaignState.characters[token.characterId];
    }
    if (char) {
        if (char.isCompanion || token.isCompanion) return 'companion';
        if (char.isCustomNpc || token.isCustomNpc) return 'customNpc';
        if (char.isPlayer || token.isPlayer) return 'player';
    } else {
        if (token.isCompanion) return 'companion';
        if (token.isCustomNpc) return 'customNpc';
        if (token.isPlayer) return 'player';
    }
    return 'bestiary';
}

function getCategoryColor(category) {
    switch (category) {
        case 'player':
            return '#2563eb'; // Solid Blue
        case 'companion':
            return '#f59e0b'; // Solid Yellow
        case 'customNpc':
            return '#8b5cf6'; // Solid Purple
        case 'bestiary':
        default:
            return '#dc3545'; // Solid Red
    }
}

function isTokenResizableAsset(token) {
    return !!(token && (token.isAsset || token.layer === 'map' || token.isBackground));
}

function getTokenResizeHandles(token, getTokenDrawDimensions = null) {
    if (!token || !isTokenResizableAsset(token)) return null;
    const dims = getTokenDrawDimensions
        ? getTokenDrawDimensions(token)
        : { drawW: token.pixelWidth || 50, drawH: token.pixelHeight || 50 };
    const { drawW, drawH } = dims;
    const renderPos = { x: token.x, y: token.y };
    const cx = renderPos.x + drawW / 2;
    const cy = renderPos.y + drawH / 2;

    const baseHandles = {
        nw: { id: 'nw', x: renderPos.x, y: renderPos.y, cursor: 'nwse-resize' },
        n: { id: 'n', x: renderPos.x + drawW / 2, y: renderPos.y, cursor: 'ns-resize' },
        ne: { id: 'ne', x: renderPos.x + drawW, y: renderPos.y, cursor: 'nesw-resize' },
        e: { id: 'e', x: renderPos.x + drawW, y: renderPos.y + drawH / 2, cursor: 'ew-resize' },
        se: { id: 'se', x: renderPos.x + drawW, y: renderPos.y + drawH, cursor: 'nwse-resize' },
        s: { id: 's', x: renderPos.x + drawW / 2, y: renderPos.y + drawH, cursor: 'ns-resize' },
        sw: { id: 'sw', x: renderPos.x, y: renderPos.y + drawH, cursor: 'nesw-resize' },
        w: { id: 'w', x: renderPos.x, y: renderPos.y + drawH / 2, cursor: 'ew-resize' }
    };

    if (token.rotation) {
        const rad = ((token.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedHandles = {};
        for (const [key, h] of Object.entries(baseHandles)) {
            const dx = h.x - cx;
            const dy = h.y - cy;
            rotatedHandles[key] = {
                id: h.id,
                x: cx + (dx * cos - dy * sin),
                y: cy + (dx * sin + dy * cos),
                cursor: h.cursor
            };
        }
        return rotatedHandles;
    }
    return baseHandles;
}

function getTokenResizeHandleAt(token, mouse, zoom = 1.0, getTokenDrawDimensions = null) {
    const handles = getTokenResizeHandles(token, getTokenDrawDimensions);
    if (!handles || !mouse) return null;
    const currentZoom = Math.max(0.05, zoom || 1);
    const threshold = Math.max(12 / currentZoom, 10);
    for (const [key, h] of Object.entries(handles)) {
        if (Math.hypot(mouse.x - h.x, mouse.y - h.y) <= threshold) {
            return h;
        }
    }
    return null;
}

function applyTokenResize(token, origGeom, handle, mouse, e, grid = {}, snapToGrid = null, currentMap = null) {
    if (!token || !origGeom || !handle) return;
    const handleId = typeof handle === 'string' ? handle : handle.id;
    const gridPx = (grid.size || 50) * (grid.scale || 1.0);
    const doSnap = !(e && e.altKey);

    let mx = mouse.x;
    let my = mouse.y;

    const origX1 = origGeom.x;
    const origW = origGeom.pixelWidth;
    const origH = origGeom.pixelHeight;
    const origX2 = origX1 + origW;
    const origY1 = origGeom.y;
    const origY2 = origY1 + origH;

    const rad = ((token.rotation || 0) * Math.PI) / 180;
    const hasRotation = Math.abs(token.rotation || 0) > 0.001;

    // If rotated, unrotate mouse point around original center
    if (hasRotation) {
        const cx = (origX1 + origX2) / 2;
        const cy = (origY1 + origY2) / 2;
        const unrotRad = -rad;
        const cos = Math.cos(unrotRad);
        const sin = Math.sin(unrotRad);
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        mx = cx + (dx * cos - dy * sin);
        my = cy + (dx * sin + dy * cos);
    }

    if (doSnap && snapToGrid && !hasRotation) {
        const snapped = snapToGrid(mx, my, false);
        mx = snapped.x;
        my = snapped.y;
    }

    const minDim = 20;

    let newX1 = origX1;
    let newX2 = origX2;
    let newY1 = origY1;
    let newY2 = origY2;

    if (handleId.includes('w')) {
        newX1 = Math.min(mx, origX2 - minDim);
    }
    if (handleId.includes('e')) {
        newX2 = Math.max(mx, origX1 + minDim);
    }
    if (handleId.includes('n')) {
        newY1 = Math.min(my, origY2 - minDim);
    }
    if (handleId.includes('s')) {
        newY2 = Math.max(my, origY1 + minDim);
    }

    let newW = newX2 - newX1;
    let newH = newY2 - newY1;

    // Shift key: lock aspect ratio
    if (e && e.shiftKey && origW > 0 && origH > 0) {
        const aspect = origW / origH;
        if (handleId === 'e' || handleId === 'w') {
            newH = newW / aspect;
            const deltaH = newH - origH;
            newY1 = origY1 - deltaH / 2;
            newY2 = origY2 + deltaH / 2;
        } else if (handleId === 'n' || handleId === 's') {
            newW = newH * aspect;
            const deltaW = newW - origW;
            newX1 = origX1 - deltaW / 2;
            newX2 = origX2 + deltaW / 2;
        } else {
            if (newW / newH > aspect) {
                newW = newH * aspect;
            } else {
                newH = newW / aspect;
            }
            if (handleId.includes('w')) newX1 = newX2 - newW;
            else newX2 = newX1 + newW;
            if (handleId.includes('n')) newY1 = newY2 - newH;
            else newY2 = newY1 + newH;
        }
    }

    if (hasRotation) {
        const origCx = (origX1 + origX2) / 2;
        const origCy = (origY1 + origY2) / 2;
        const newUnrotCx = (newX1 + newX2) / 2;
        const newUnrotCy = (newY1 + newY2) / 2;
        const deltaCx = newUnrotCx - origCx;
        const deltaCy = newUnrotCy - origCy;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const worldCx = origCx + (deltaCx * cos - deltaCy * sin);
        const worldCy = origCy + (deltaCx * sin + deltaCy * cos);
        token.x = Math.round(worldCx - newW / 2);
        token.y = Math.round(worldCy - newH / 2);
    } else {
        token.x = Math.round(newX1);
        token.y = Math.round(newY1);
    }

    token.pixelWidth = Math.round(newW);
    token.pixelHeight = Math.round(newH);

    const customW = Math.max(1, Math.round((token.pixelWidth / gridPx) * 100) / 100);
    const customH = Math.max(1, Math.round((token.pixelHeight / gridPx) * 100) / 100);
    token.customWidth = customW;
    token.customHeight = customH;
    token.size = Math.max(customW, customH);

    if (currentMap && (token.layer === 'map' || token.isBackground)) {
        const maxExtentW = Math.max(token.pixelWidth, (token.x || 0) + token.pixelWidth);
        const maxExtentH = Math.max(token.pixelHeight, (token.y || 0) + token.pixelHeight);
        currentMap.gridWidth = Math.max(1, Math.round((maxExtentW / gridPx) * 100) / 100);
        currentMap.gridHeight = Math.max(1, Math.round((maxExtentH / gridPx) * 100) / 100);
    }
}

export {
    ytPingPongControllers,
    cleanupAllYouTubePingPong,
    cleanupYouTubePingPongForId,
    cleanupMediaElement,
    ensureYouTubeIframeApi,
    triggerPingAnimation,
    animatePings,
    activeTokenShudders,
    triggerTokenShudder,
    getTokenShudderOffset,
    spawnProceduralCombatFX,
    triggerDamageFXAnimation,
    triggerHealingFXAnimation,
    animateDamageFX,
    renderDamageFXBurst,
    processTokenAnimReqs,
    animateTokens,
    getTokenCategory,
    getCategoryColor,
    isTokenResizableAsset,
    getTokenResizeHandles,
    getTokenResizeHandleAt,
    applyTokenResize
};
