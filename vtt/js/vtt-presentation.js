/**
 * vtt-presentation.js
 * Presentation Window / Player-Facing Display Engine for ForgeDVTT.
 * Orchestrates window spawning, clean-mode bootstrap, party-vision sync,
 * and continuous camera mirroring with freeze/lock controls from the Settings panel.
 */

export function initVttPresentation(vtt = {}) {
    const isPresentationMode =
        Boolean(vtt.isPresentationMode) ||
        (typeof window !== 'undefined' && Boolean(window.VTT?.isPresentationMode)) ||
        (typeof location !== 'undefined' &&
            (new URLSearchParams(location.search).get('mode') === 'presentation' ||
                new URLSearchParams(location.search).get('presentation') === 'true'));

    if (isPresentationMode) {
        return initPresentationClient(vtt);
    } else {
        return initGmPresentationHost(vtt);
    }
}

/**
 * Initializes the Presentation Window (Player-Facing Display).
 * Runs inside the spawned presentation window.
 */
function initPresentationClient(vtt = {}) {
    if (typeof document !== 'undefined') {
        document.body.classList.add('vtt-presentation-mode');
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.classList.add('vtt-hidden');
        const interactionCanvas = document.getElementById('vtt-canvas-interaction');
        if (interactionCanvas) interactionCanvas.style.pointerEvents = 'none';
    }

    let isCameraLocked = false;
    const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);

    if (socket) {
        socket.on('presentation:camSynced', (data) => {
            if (isCameraLocked || !data) return;
            const canvasEngine = vtt.canvasEngine || (typeof window !== 'undefined' ? window.VTT?.canvasEngine : null);
            if (!canvasEngine || typeof canvasEngine.panTo !== 'function') return;

            const currentMapId = canvasEngine.getCurrentMapId ? canvasEngine.getCurrentMapId() : null;
            if (data.mapId && currentMapId && data.mapId !== currentMapId) {
                // Map change is handled automatically by campaign:state-sync
                return;
            }

            canvasEngine.panTo(data.x, data.y, data.zoom || null, 120);
        });

        socket.on('presentation:camLocked', (data) => {
            if (data && typeof data.locked === 'boolean') {
                isCameraLocked = data.locked;
            }
        });
    }

    // Force canvas re-render and recalculate viewport on window resize
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
            const canvasEngine = vtt.canvasEngine || window.VTT?.canvasEngine;
            if (canvasEngine?.renderAll) {
                canvasEngine.renderAll();
            }
        });
    }

    console.log('[ForgeDVTT] Presentation Window Display initialized.');

    return {
        isPresentationClient: true,
        isCameraLocked: () => isCameraLocked,
        setCameraLocked: (locked) => {
            isCameraLocked = Boolean(locked);
        }
    };
}

/**
 * Initializes the GM Host controls for the Presentation Window.
 * Binds UI controls in the Settings Panel (tab-config) and handles camera broadcast.
 */
function initGmPresentationHost(vtt = {}) {
    let popupRef = null;
    let popupMonitor = null;
    let throttleTimer = null;
    let pendingCamData = null;

    const btnLaunch = typeof document !== 'undefined' ? document.getElementById('btn-launch-presentation') : null;
    const btnClose = typeof document !== 'undefined' ? document.getElementById('btn-close-presentation') : null;
    const chkCamSync =
        typeof document !== 'undefined' ? document.getElementById('config-presentation-camera-sync') : null;

    function updateUiState(isOpen) {
        if (btnLaunch) {
            if (isOpen) {
                btnLaunch.innerHTML =
                    '<i class="fa-solid fa-arrow-up-right-from-square"></i> Focus Presentation Window';
                btnLaunch.classList.remove('btn-primary');
                btnLaunch.classList.add('btn-secondary');
            } else {
                btnLaunch.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Open Presentation Window';
                btnLaunch.classList.remove('btn-secondary');
                btnLaunch.classList.add('btn-primary');
            }
        }
        if (btnClose) {
            btnClose.classList.toggle('vtt-hidden', !isOpen);
        }
    }

    if (
        typeof window !== 'undefined' &&
        window.electronAPI &&
        typeof window.electronAPI.onPresentationStatusUpdate === 'function'
    ) {
        window.electronAPI.onPresentationStatusUpdate((data) => {
            if (data && data.isOpen === false) {
                updateUiState(false);
            }
        });
    }

    async function launchPresentation() {
        const campaignId =
            vtt.campaignId || (typeof window !== 'undefined' ? window.VTT?.campaignId : 'default') || 'default';

        if (
            typeof window !== 'undefined' &&
            window.electronAPI &&
            typeof window.electronAPI.openPresentationWindow === 'function'
        ) {
            try {
                await window.electronAPI.openPresentationWindow({ campaignId });
                updateUiState(true);
                return;
            } catch (err) {
                console.warn(
                    '[ForgeDVTT] electronAPI.openPresentationWindow failed, falling back to window.open:',
                    err
                );
            }
        }

        // Web or Electron fallback
        const url = `${window.location.origin}/vtt/index.html?mode=presentation&campaign=${encodeURIComponent(campaignId)}`;
        if (popupRef && !popupRef.closed) {
            popupRef.focus();
        } else {
            popupRef = window.open(
                url,
                'ForgeDVTT_Presentation',
                'width=1280,height=720,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no'
            );
            if (popupRef) {
                try {
                    popupRef.focus();
                } catch (_) {}
            }
        }

        if (popupMonitor) clearInterval(popupMonitor);
        popupMonitor = setInterval(() => {
            if (!popupRef || popupRef.closed) {
                clearInterval(popupMonitor);
                popupMonitor = null;
                popupRef = null;
                updateUiState(false);
            }
        }, 800);

        updateUiState(true);
    }

    async function closePresentation() {
        if (popupMonitor) {
            clearInterval(popupMonitor);
            popupMonitor = null;
        }
        if (
            typeof window !== 'undefined' &&
            window.electronAPI &&
            typeof window.electronAPI.closePresentationWindow === 'function'
        ) {
            try {
                await window.electronAPI.closePresentationWindow();
            } catch (err) {
                console.warn('[ForgeDVTT] electronAPI.closePresentationWindow failed:', err);
            }
        }
        if (popupRef && !popupRef.closed) {
            popupRef.close();
            popupRef = null;
        }
        updateUiState(false);
    }

    if (btnLaunch) {
        btnLaunch.onclick = (e) => {
            e.preventDefault();
            launchPresentation();
        };
    }

    if (btnClose) {
        btnClose.onclick = (e) => {
            e.preventDefault();
            closePresentation();
        };
    }

    if (chkCamSync) {
        chkCamSync.onchange = () => {
            const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);
            if (socket) {
                socket.emit('presentation:camLock', { locked: !chkCamSync.checked });
            }
        };
    }

    function onGmCameraMoved(camData) {
        if (chkCamSync && !chkCamSync.checked) return;
        const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);
        if (!socket) return;

        pendingCamData = camData;
        if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                if (!pendingCamData) return;
                const { panX, panY, zoom, currentMapId, viewportWidth, viewportHeight } = pendingCamData;
                const centerX = (viewportWidth / 2 - panX) / zoom;
                const centerY = (viewportHeight / 2 - panY) / zoom;

                socket.emit('presentation:camSync', {
                    mapId: currentMapId,
                    x: centerX,
                    y: centerY,
                    zoom: zoom
                });
            }, 60);
        }
    }

    return {
        isGmHost: true,
        launchPresentation,
        closePresentation,
        onGmCameraMoved
    };
}
