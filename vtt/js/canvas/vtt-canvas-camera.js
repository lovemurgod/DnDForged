/**
 * vtt-canvas-camera.js
 * Camera panning, zoom levels, zoom HUD controls, container CSS transforms,
 * grid coordinate calculation, and map background media attachments.
 */

import { cleanupMediaElement } from './tokens/vtt-canvas-token-renderer.js';

let cameraAnimFrame = null;

export function cancelCameraAnimation() {
    if (cameraAnimFrame) {
        cancelAnimationFrame(cameraAnimFrame);
        cameraAnimFrame = null;
    }
}

export function panTo(targetX, targetY, targetZoom = null, duration = 350, context = {}) {
    cancelCameraAnimation();
    const viewport = context.viewport;
    if (!viewport) return;
    const vr = viewport.getBoundingClientRect();
    const viewCenterW = vr.width / 2;
    const viewCenterH = vr.height / 2;

    const startPanX = context.panX;
    const startPanY = context.panY;
    const startZoom = context.zoom;
    const finalZoom = targetZoom !== null ? Math.min(5.0, Math.max(0.1, targetZoom)) : context.zoom;

    const endPanX = viewCenterW - targetX * finalZoom;
    const endPanY = viewCenterH - targetY * finalZoom;

    if (duration <= 0) {
        context.panX = endPanX;
        context.panY = endPanY;
        context.zoom = finalZoom;
        if (context.updateContainerTransform) context.updateContainerTransform();
        if (context.renderAll) context.renderAll();
        return;
    }

    const startTime = performance.now();
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = easeOutCubic(progress);

        context.panX = startPanX + (endPanX - startPanX) * ease;
        context.panY = startPanY + (endPanY - startPanY) * ease;
        context.zoom = startZoom + (finalZoom - startZoom) * ease;

        if (context.updateContainerTransform) context.updateContainerTransform();
        if (context.renderAll) context.renderAll();

        if (progress < 1.0) {
            cameraAnimFrame = requestAnimationFrame(step);
        } else {
            cameraAnimFrame = null;
        }
    }
    cameraAnimFrame = requestAnimationFrame(step);
}

export function setZoom(targetZoom, anchorX = null, anchorY = null, animate = false, context = {}) {
    cancelCameraAnimation();
    const clampedZoom = Math.min(5.0, Math.max(0.1, targetZoom));
    if (Math.abs(context.zoom - clampedZoom) < 0.001) return;

    const viewport = context.viewport;
    if (!viewport) return;
    const vr = viewport.getBoundingClientRect();
    const mouseX = anchorX !== null ? anchorX : vr.width / 2;
    const mouseY = anchorY !== null ? anchorY : vr.height / 2;

    const canvasTargetX = (mouseX - context.panX) / context.zoom;
    const canvasTargetY = (mouseY - context.panY) / context.zoom;

    if (animate) {
        panTo(canvasTargetX, canvasTargetY, clampedZoom, 200, context);
    } else {
        context.zoom = clampedZoom;
        context.panX = mouseX - canvasTargetX * context.zoom;
        context.panY = mouseY - canvasTargetY * context.zoom;
        if (context.updateContainerTransform) context.updateContainerTransform();
        if (context.renderAll) context.renderAll();
    }
}

export function stepZoom(deltaPercent, context = {}) {
    const nextZoom = Math.round(((context.zoom ?? 1) + deltaPercent) * 100) / 100;
    setZoom(nextZoom, null, null, false, context);
}

export function centerOnTokenOrMap(context = {}) {
    const tokens = context.tokens || {};
    const selectedTokenIds = context.selectedTokenIds || new Set();
    const getTokenDrawDimensions = context.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50 }));
    const isTokenControlledByPlayer = context.isTokenControlledByPlayer || (() => false);
    const vtt = context.vtt || {};
    const grid = context.grid || { size: 50, scale: 1.0 };
    const currentMapId = context.currentMapId;

    let targetX = 0;
    let targetY = 0;
    let foundTarget = false;

    // 1. Centroid of selected tokens
    if (selectedTokenIds.size > 0) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        selectedTokenIds.forEach((id) => {
            const t = tokens[id];
            if (t) {
                const dims = getTokenDrawDimensions(t);
                sumX += t.x + (dims.drawW || 50) / 2;
                sumY += t.y + (dims.drawH || 50) / 2;
                count++;
            }
        });
        if (count > 0) {
            targetX = sumX / count;
            targetY = sumY / count;
            foundTarget = true;
        }
    }

    // 2. Controlled player character token
    if (!foundTarget && vtt.role !== 'GM') {
        for (const id in tokens) {
            const t = tokens[id];
            if (t && isTokenControlledByPlayer(t)) {
                const dims = getTokenDrawDimensions(t);
                targetX = t.x + (dims.drawW || 50) / 2;
                targetY = t.y + (dims.drawH || 50) / 2;
                foundTarget = true;
                break;
            }
        }
    }

    // 3. Map center fallback
    if (!foundTarget) {
        const currentMap = vtt.campaignState?.maps?.[currentMapId];
        const bgContainer = typeof document !== 'undefined' ? document.getElementById('vtt-map-bg-container') : null;
        const mapW = currentMap?.gridWidth
            ? currentMap.gridWidth * (grid.size || 50) * (grid.scale || 1.0)
            : parseInt(bgContainer?.dataset?.naturalWidth, 10) || 1000;
        const mapH = currentMap?.gridHeight
            ? currentMap.gridHeight * (grid.size || 50) * (grid.scale || 1.0)
            : parseInt(bgContainer?.dataset?.naturalHeight, 10) || 800;
        targetX = mapW / 2;
        targetY = mapH / 2;
    }

    panTo(targetX, targetY, null, 350, context);
}

export function broadcastViewToPlayers(context = {}) {
    const vtt = context.vtt || {};
    if (vtt.role !== 'GM' || !vtt.socket) return;
    const viewport = context.viewport;
    if (!viewport) return;
    const vr = viewport.getBoundingClientRect();
    const centerCanvasX = (vr.width / 2 - context.panX) / context.zoom;
    const centerCanvasY = (vr.height / 2 - context.panY) / context.zoom;

    vtt.socket.emit('map:panTo', {
        mapId: context.currentMapId,
        x: centerCanvasX,
        y: centerCanvasY,
        zoom: context.zoom
    });

    if (typeof window !== 'undefined' && window.VTT?.chatEngine?.appendSystemMessage) {
        window.VTT.chatEngine.appendSystemMessage('Synced tabletop camera view to all players.');
    }
}

export function setupZoomHudControls(context = {}) {
    if (typeof document === 'undefined') return;
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const zoomSlider = document.getElementById('vtt-zoom-slider');
    const badgeContainer = document.getElementById('vtt-zoom-badge-container');
    const zoomBadge = document.getElementById('vtt-zoom-badge');
    const zoomInput = document.getElementById('vtt-zoom-input');
    const btnGmBroadcast = document.getElementById('btn-gm-broadcast-view');

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', (e) => {
            e.stopPropagation();
            stepZoom(0.1, context);
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', (e) => {
            e.stopPropagation();
            stepZoom(-0.1, context);
        });
    }

    if (zoomSlider) {
        zoomSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                setZoom(val / 100, null, null, false, context);
            }
        });
    }

    if (badgeContainer && zoomBadge && zoomInput) {
        badgeContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            zoomBadge.classList.add('vtt-hidden');
            zoomInput.classList.remove('vtt-hidden');
            zoomInput.value = Math.round((context.zoom || 1) * 100);
            zoomInput.focus();
            zoomInput.select();
        });

        const commitInputZoom = () => {
            if (zoomInput.classList.contains('vtt-hidden')) return;
            let val = parseInt(zoomInput.value, 10);
            if (isNaN(val)) val = Math.round((context.zoom || 1) * 100);
            val = Math.min(500, Math.max(10, val));
            setZoom(val / 100, null, null, false, context);
            zoomInput.classList.add('vtt-hidden');
            zoomBadge.classList.remove('vtt-hidden');
            zoomBadge.textContent = `${val}%`;
        };

        zoomInput.addEventListener('blur', commitInputZoom);
        zoomInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                commitInputZoom();
            } else if (e.key === 'Escape') {
                zoomInput.classList.add('vtt-hidden');
                zoomBadge.classList.remove('vtt-hidden');
            }
        });
    }

    if (btnGmBroadcast) {
        btnGmBroadcast.addEventListener('click', (e) => {
            e.stopPropagation();
            broadcastViewToPlayers(context);
        });
    }
}

export function updateContainerTransform(container, panX, panY, zoom) {
    if (container) {
        container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }
    if (typeof document === 'undefined') return;
    const zoomPercent = Math.round(zoom * 100);
    const zoomEl = document.getElementById('val-zoom');
    if (zoomEl) zoomEl.textContent = `${zoomPercent}%`;
    const zoomBadge = document.getElementById('vtt-zoom-badge');
    if (zoomBadge) zoomBadge.textContent = `${zoomPercent}%`;
    const zoomSlider = document.getElementById('vtt-zoom-slider');
    if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = zoomPercent;
    const zoomInput = document.getElementById('vtt-zoom-input');
    if (zoomInput && document.activeElement !== zoomInput) zoomInput.value = zoomPercent;
}

export function updateCoordinateDisplay(mouse, grid) {
    if (typeof document === 'undefined') return;
    const coordXEl = document.getElementById('val-coord-x');
    const coordYEl = document.getElementById('val-coord-y');
    if (!coordXEl || !coordYEl) return;
    if (!mouse || !grid) {
        coordXEl.textContent = '0';
        coordYEl.textContent = '0';
        return;
    }
    const unitSize = (grid.size || 50) * (grid.scale || 1.0);
    if (unitSize <= 0) return;
    const gridX = Math.floor((mouse.x - (grid.offsetX || 0)) / unitSize);
    const gridY = Math.floor((mouse.y - (grid.offsetY || 0)) / unitSize);
    coordXEl.textContent = gridX;
    coordYEl.textContent = gridY;
}

export async function setMapBackground(url, context = {}) {
    if (typeof document === 'undefined') return;
    const bgContainer = document.getElementById('vtt-map-bg-container');
    if (!bgContainer) return;

    if (!url) {
        bgContainer.querySelectorAll?.('video, iframe')?.forEach((el) => cleanupMediaElement(el));
        bgContainer.innerHTML = '';
        bgContainer.classList.add('vtt-hidden');
        bgContainer.removeAttribute('data-natural-width');
        bgContainer.removeAttribute('data-natural-height');
        context.renderAll?.();
        return;
    }

    if (url.includes('pin.it') || url.includes('pinterest.com/pin/')) {
        try {
            if (typeof window !== 'undefined' && window.VTT && typeof window.VTT.resolveMediaUrl === 'function') {
                const res = await window.VTT.resolveMediaUrl(url);
                if (res?.resolvedUrl) url = res.resolvedUrl;
            }
        } catch (e) {
            console.warn('[setMapBackground] Error resolving URL:', e);
        }
    }

    const viewport = context.viewport || document.getElementById('vtt-canvas-viewport');
    const setBackgroundDimensions = (width, height) => {
        if (!width || !height) return;
        bgContainer.dataset.naturalWidth = String(width);
        bgContainer.dataset.naturalHeight = String(height);
        if (viewport) {
            const w = viewport.clientWidth;
            const h = viewport.clientHeight;
            context.panX = (w - width) / 2;
            context.panY = (h - height) / 2;
            context.zoom = 1.0;
            context.updateContainerTransform?.();
            context.renderAll?.();
        }
    };

    bgContainer.querySelectorAll?.('video, iframe')?.forEach((el) => cleanupMediaElement(el));
    bgContainer.innerHTML = '';
    bgContainer.classList.remove('vtt-hidden');
    bgContainer.style.pointerEvents = 'none';
    bgContainer.removeAttribute('data-natural-width');
    bgContainer.removeAttribute('data-natural-height');

    if (url.trim().startsWith('<iframe')) {
        bgContainer.innerHTML = url;
        const iframe = bgContainer.querySelector('iframe');
        if (iframe) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.pointerEvents = 'none';
            iframe.style.border = 'none';
        }
        setTimeout(() => setBackgroundDimensions(1000, 1000), 500);
        return;
    }

    const isVideo = url.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || url.includes('pinimg.com/videos');
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');

    let mediaEl;
    if (isYoutube) {
        mediaEl = document.createElement('iframe');
        let ytUrl = url;
        const ytMatch = url.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
        );
        if (ytMatch) {
            const videoId = ytMatch[1];
            ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
        }
        mediaEl.src = ytUrl;
        mediaEl.style.width = '100%';
        mediaEl.style.height = '100%';
        mediaEl.style.border = 'none';
        mediaEl.style.pointerEvents = 'none';
        bgContainer.appendChild(mediaEl);
        setTimeout(() => setBackgroundDimensions(1000, 1000), 500);
    } else if (isVideo) {
        mediaEl = document.createElement('video');
        mediaEl.src = url;
        mediaEl.autoplay = true;
        mediaEl.loop = true;
        mediaEl.muted = true;
        mediaEl.playsInline = true;
        mediaEl.style.width = '100%';
        mediaEl.style.height = '100%';
        mediaEl.style.objectFit = 'fill';
        bgContainer.appendChild(mediaEl);
        mediaEl.play().catch(() => {});
        mediaEl.onloadedmetadata = () => {
            setBackgroundDimensions(mediaEl.videoWidth, mediaEl.videoHeight);
        };
    } else {
        mediaEl = document.createElement('img');
        mediaEl.src = url;
        mediaEl.draggable = false;
        mediaEl.style.width = '100%';
        mediaEl.style.height = '100%';
        mediaEl.style.objectFit = 'fill';
        bgContainer.appendChild(mediaEl);
        mediaEl.onload = () => {
            setBackgroundDimensions(mediaEl.naturalWidth || mediaEl.width, mediaEl.naturalHeight || mediaEl.height);
        };
    }
}
