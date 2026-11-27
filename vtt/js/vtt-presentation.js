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

const TV_CALIBRATED_ZOOM_KEY = 'vtt_tv_calibrated_zoom';

function readCalibratedZoom() {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TV_CALIBRATED_ZOOM_KEY) : null;
        if (!raw) return null;
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) && parsed >= 0.1 && parsed <= 5.0 ? parsed : null;
    } catch (_) {
        return null;
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
    let calibratedZoom = readCalibratedZoom();
    let isCalibrationOpen = false;
    let cursorIdleTimer = null;
    const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);
    let presentationBc = null;

    function applyCameraSync(data) {
        if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
        const canvasEngine = vtt.canvasEngine || (typeof window !== 'undefined' ? window.VTT?.canvasEngine : null);
        if (!canvasEngine || typeof canvasEngine.panTo !== 'function') return;
        const currentMapId = canvasEngine.getCurrentMapId ? canvasEngine.getCurrentMapId() : null;
        if (data.mapId && currentMapId && data.mapId !== currentMapId) {
            return;
        }
        const effectiveZoom = calibratedZoom !== null ? calibratedZoom : Number.isFinite(data.zoom) ? data.zoom : null;
        canvasEngine.panTo(data.x, data.y, effectiveZoom, 120);
    }

    function setCalibratedZoom(nextZoom) {
        if (nextZoom === null || nextZoom === undefined) {
            calibratedZoom = null;
            try {
                localStorage.removeItem(TV_CALIBRATED_ZOOM_KEY);
            } catch (_) {}
            return;
        }
        const clamped = Math.min(5.0, Math.max(0.1, Number(nextZoom) || 1.0));
        calibratedZoom = clamped;
        try {
            localStorage.setItem(TV_CALIBRATED_ZOOM_KEY, String(clamped));
        } catch (_) {}
        const canvasEngine = vtt.canvasEngine || (typeof window !== 'undefined' ? window.VTT?.canvasEngine : null);
        canvasEngine?.setZoom?.(clamped, null, null, false);
    }

    function setupTvErgonomics() {
        if (typeof document === 'undefined' || !document.body) return;

        // Auto-hide cursor after 3 seconds of inactivity
        const resetCursorTimer = () => {
            document.body.classList.remove('vtt-tv-cursor-hidden');
            if (cursorIdleTimer) clearTimeout(cursorIdleTimer);
            if (isCalibrationOpen) return;
            cursorIdleTimer = setTimeout(() => {
                if (!isCalibrationOpen) {
                    document.body.classList.add('vtt-tv-cursor-hidden');
                }
            }, 3000);
        };
        window.addEventListener('pointermove', resetCursorTimer, { passive: true });
        window.addEventListener('keydown', resetCursorTimer, { passive: true });
        resetCursorTimer();

        if (document.getElementById('vtt-tv-utility-pill')) return;
        const pill = document.createElement('div');
        pill.id = 'vtt-tv-utility-pill';
        pill.className = 'vtt-tv-utility-pill';
        pill.innerHTML = `
            <button type="button" id="btn-tv-fullscreen" title="Toggle Fullscreen">
                <i class="fa-solid fa-expand" aria-hidden="true"></i> Fullscreen
            </button>
            <button type="button" id="btn-tv-calibrate" title="Calibrate 1-Inch Physical Grid">
                <i class="fa-solid fa-ruler-combined" aria-hidden="true"></i> 1" Grid
            </button>
        `;
        document.body.appendChild(pill);

        const btnFs = document.getElementById('btn-tv-fullscreen');
        if (btnFs) {
            btnFs.onclick = () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen?.().catch(() => {});
                } else {
                    document.exitFullscreen?.().catch(() => {});
                }
            };
        }

        const btnCal = document.getElementById('btn-tv-calibrate');
        if (btnCal) {
            btnCal.onclick = () => openCalibrationModal(resetCursorTimer);
        }
    }

    function openCalibrationModal(resetCursorTimer) {
        if (typeof document === 'undefined' || document.getElementById('vtt-tv-cal-modal')) return;
        isCalibrationOpen = true;
        document.body.classList.remove('vtt-tv-cursor-hidden');

        const initialZoom = calibratedZoom !== null ? calibratedZoom : 1.0;
        const modal = document.createElement('div');
        modal.id = 'vtt-tv-cal-modal';
        modal.className = 'vtt-tv-cal-modal';
        modal.innerHTML = `
            <div class="vtt-tv-cal-card">
                <h3 style="margin: 0; font-size: 1rem;">Physical 1-Inch Grid Calibration</h3>
                <p style="margin: 0; font-size: 0.8rem; color: #94a3b8;">
                    Hold a physical mini or ruler against the TV and adjust until the square below measures 1 inch.
                    This locks TV zoom independently of the GM's laptop.
                </p>
                <div class="vtt-tv-cal-square-wrap">
                    <div id="vtt-tv-cal-square" class="vtt-tv-cal-square">1" Grid</div>
                </div>
                <label style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
                    <span>TV Zoom</span>
                    <input type="range" id="vtt-tv-cal-slider" min="0.1" max="5.0" step="0.05" value="${initialZoom}" style="flex: 1;">
                    <span id="vtt-tv-cal-val" style="min-width: 44px; text-align: right;">${Math.round(initialZoom * 100)}%</span>
                </label>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button type="button" id="btn-tv-cal-reset" class="btn btn-sm btn-secondary">Mirror GM Zoom</button>
                    <button type="button" id="btn-tv-cal-done" class="btn btn-sm btn-primary">Done</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const canvasEngine = vtt.canvasEngine || (typeof window !== 'undefined' ? window.VTT?.canvasEngine : null);
        const baseGridSize = canvasEngine?.getGrid?.()?.size || 50;
        const sq = document.getElementById('vtt-tv-cal-square');
        const slider = document.getElementById('vtt-tv-cal-slider');
        const valLabel = document.getElementById('vtt-tv-cal-val');
        const updateSquare = (z) => {
            const px = Math.round(baseGridSize * z);
            if (sq) {
                sq.style.width = `${px}px`;
                sq.style.height = `${px}px`;
            }
            if (valLabel) valLabel.textContent = `${Math.round(z * 100)}%`;
        };
        updateSquare(initialZoom);

        if (slider) {
            slider.oninput = () => {
                const z = parseFloat(slider.value);
                updateSquare(z);
                setCalibratedZoom(z);
            };
        }
        document.getElementById('btn-tv-cal-reset').onclick = () => {
            setCalibratedZoom(null);
            if (slider) slider.value = '1';
            updateSquare(1.0);
        };
        document.getElementById('btn-tv-cal-done').onclick = () => {
            modal.remove();
            isCalibrationOpen = false;
            resetCursorTimer?.();
        };
    }

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            presentationBc = new BroadcastChannel('forgedvtt_presentation_sync');
            presentationBc.unref?.();
            presentationBc.onmessage = (ev) => {
                const msg = ev?.data;
                if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
                if (msg.type === 'camSync' && (!isCameraLocked || msg.force)) {
                    applyCameraSync(msg.data);
                } else if (msg.type === 'camLock' && typeof msg.locked === 'boolean') {
                    isCameraLocked = msg.locked;
                } else if (msg.type === 'campaignSync' && msg.campaignState && typeof msg.campaignState === 'object') {
                    const canvasEngine = vtt.canvasEngine || window.VTT?.canvasEngine;
                    canvasEngine?.syncCampaignState?.(msg.campaignState);
                }
            };
        }
    } catch (_) {
        /* ignore BroadcastChannel unavailable */
    }

    if (socket) {
        socket.on('presentation:camSynced', (data) => {
            if ((isCameraLocked && !data?.force) || !data) return;
            applyCameraSync(data);
        });

        socket.on('presentation:camLocked', (data) => {
            if (data && typeof data.locked === 'boolean') {
                isCameraLocked = data.locked;
            }
        });
    }

    setupTvErgonomics();

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
        },
        getCalibratedZoom: () => calibratedZoom,
        setCalibratedZoom
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
    let lastKnownCamData = null;
    let isPresentationOpen = false;
    let presentationBc = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            presentationBc = new BroadcastChannel('forgedvtt_presentation_sync');
            presentationBc.unref?.();
        }
    } catch (_) {
        /* ignore BroadcastChannel unavailable */
    }

    const btnLaunch = typeof document !== 'undefined' ? document.getElementById('btn-launch-presentation') : null;
    const btnClose = typeof document !== 'undefined' ? document.getElementById('btn-close-presentation') : null;
    const btnCopyUrl = typeof document !== 'undefined' ? document.getElementById('btn-copy-presentation-url') : null;
    const btnPushView = typeof document !== 'undefined' ? document.getElementById('btn-push-presentation-view') : null;
    const chkCamSync =
        typeof document !== 'undefined' ? document.getElementById('config-presentation-camera-sync') : null;

    function getPresentationUrl() {
        const campaignId =
            vtt.campaignId || (typeof window !== 'undefined' ? window.VTT?.campaignId : 'default') || 'default';
        const urlObj = new URL('./', typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
        urlObj.searchParams.set('mode', 'presentation');
        urlObj.searchParams.set('campaign', campaignId);
        return urlObj.href;
    }

    function ensureTvSyncPill() {
        if (typeof document === 'undefined' || !document.body) return null;
        let pill = document.getElementById('vtt-tv-sync-pill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'vtt-tv-sync-pill';
            pill.className = 'vtt-tv-sync-pill vtt-hidden gm-only';
            pill.innerHTML = `
                <span class="tv-status-dot" aria-hidden="true"></span>
                <button type="button" id="btn-tv-pill-freeze" class="btn btn-xs btn-secondary" title="Toggle Live Mirror vs Frozen Prep">TV: Live</button>
                <button type="button" id="btn-tv-pill-push" class="btn btn-xs btn-primary" title="Push Current View to TV Now"><i class="fa-solid fa-crosshairs" aria-hidden="true"></i> Push</button>
                <button type="button" id="btn-tv-pill-copy" class="btn btn-xs btn-secondary" title="Copy TV Display URL"><i class="fa-solid fa-link" aria-hidden="true"></i></button>
            `;
            document.body.appendChild(pill);
            document.getElementById('btn-tv-pill-freeze').onclick = () => {
                const nextLive = chkCamSync ? !chkCamSync.checked : true;
                setTvLiveMirror(nextLive);
            };
            document.getElementById('btn-tv-pill-push').onclick = () => pushViewToTv();
            document.getElementById('btn-tv-pill-copy').onclick = () => copyPresentationUrl();
        }
        return pill;
    }

    function syncFreezeLabels() {
        const isLive = chkCamSync ? chkCamSync.checked : true;
        const pill = document.getElementById('vtt-tv-sync-pill');
        const btnFreeze = document.getElementById('btn-tv-pill-freeze');
        if (pill) pill.classList.toggle('is-frozen', !isLive);
        if (btnFreeze) btnFreeze.textContent = isLive ? 'TV: Live' : 'TV: Frozen';
    }

    function setTvLiveMirror(enabled) {
        if (chkCamSync) chkCamSync.checked = Boolean(enabled);
        const locked = !enabled;
        const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);
        if (socket) socket.emit('presentation:camLock', { locked });
        presentationBc?.postMessage({ type: 'camLock', locked });
        syncFreezeLabels();
    }

    function buildCamPayload(camData, force = false) {
        if (!camData) return null;
        const { panX, panY, zoom, currentMapId, viewportWidth, viewportHeight } = camData;
        return {
            mapId: currentMapId,
            x: (viewportWidth / 2 - panX) / zoom,
            y: (viewportHeight / 2 - panY) / zoom,
            zoom,
            force
        };
    }

    function pushViewToTv(camOverride = null) {
        const payload = buildCamPayload(camOverride || lastKnownCamData, true);
        if (!payload) return false;
        const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);
        if (socket) socket.emit('presentation:camSync', payload);
        presentationBc?.postMessage({ type: 'camSync', data: payload, force: true });
        return true;
    }

    async function copyPresentationUrl() {
        const url = getPresentationUrl();
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            }
            window.VTT?.chatEngine?.appendSystemMessage?.('TV Display URL copied to clipboard.');
        } catch (_) {}
        return url;
    }

    function updateUiState(isOpen) {
        isPresentationOpen = Boolean(isOpen);
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
        const pill = ensureTvSyncPill();
        if (pill) {
            pill.classList.toggle('vtt-hidden', !isOpen);
            syncFreezeLabels();
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

        // Web or Electron fallback (relative to current VTT base path so /play/, /vtt/, and subpaths all resolve)
        const urlObj = new URL('./', typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
        urlObj.searchParams.set('mode', 'presentation');
        urlObj.searchParams.set('campaign', campaignId);
        const url = urlObj.href;
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

    if (btnCopyUrl) {
        btnCopyUrl.onclick = (e) => {
            e.preventDefault();
            copyPresentationUrl();
        };
    }

    if (btnPushView) {
        btnPushView.onclick = (e) => {
            e.preventDefault();
            pushViewToTv();
        };
    }

    if (chkCamSync) {
        chkCamSync.onchange = () => {
            setTvLiveMirror(chkCamSync.checked);
        };
    }

    function onGmCameraMoved(camData) {
        lastKnownCamData = camData;
        if (chkCamSync && !chkCamSync.checked) return;
        const socket = vtt.socket || (typeof window !== 'undefined' ? window.VTT?.socket : null);
        if (!socket && !presentationBc) return;

        pendingCamData = camData;
        if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                if (!pendingCamData) return;
                const camPayload = buildCamPayload(pendingCamData, false);
                if (!camPayload) return;
                if (socket) {
                    socket.emit('presentation:camSync', camPayload);
                }
                presentationBc?.postMessage({ type: 'camSync', data: camPayload });
            }, 60);
        }
    }

    return {
        isGmHost: true,
        launchPresentation,
        closePresentation,
        onGmCameraMoved,
        pushViewToTv,
        setTvLiveMirror,
        getPresentationUrl
    };
}
