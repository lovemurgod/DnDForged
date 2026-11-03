/**
 * vtt-pause.js
 * Tabletop game pause state, GM play/pause controls, player safety X-Card triggers,
 * and central pause overlay banners for ForgeDVTT.
 */

export function updateTabletopPauseUI(pauseState, showToast = true) {
    if (typeof window === 'undefined') return;

    const isPaused = Boolean(pauseState?.isPaused);
    const source = pauseState?.source || 'gm';
    const pausedBy = pauseState?.by || (source === 'xcard' ? 'Player' : 'GM');

    if (window.VTT) {
        window.VTT.isPaused = isPaused;
        window.VTT.pauseState = pauseState || { isPaused, source, by: pausedBy };
    }

    if (typeof document === 'undefined') return;

    // 1. Update GM Play/Pause button on desktop toolbar
    const btnGmPause = document.getElementById('btn-game-pause');
    if (btnGmPause) {
        const icon = btnGmPause.querySelector('i');
        if (isPaused) {
            btnGmPause.classList.add('paused');
            btnGmPause.title = 'Resume Game (GM)';
            if (icon) icon.className = 'fa-solid fa-play';
        } else {
            btnGmPause.classList.remove('paused');
            btnGmPause.title = 'Pause Game (GM)';
            if (icon) icon.className = 'fa-solid fa-pause';
        }
    }

    // 2. Update Mobile Menu items
    const mobPause = document.getElementById('mobile-tool-pause');
    if (mobPause) {
        const mobIcon = mobPause.querySelector('i');
        const mobLabel = mobPause.querySelector('span');
        if (isPaused) {
            mobPause.classList.add('paused');
            if (mobIcon) mobIcon.className = 'fa-solid fa-play';
            if (mobLabel) mobLabel.textContent = 'Resume Game';
        } else {
            mobPause.classList.remove('paused');
            if (mobIcon) mobIcon.className = 'fa-solid fa-pause';
            if (mobLabel) mobLabel.textContent = 'Pause Game';
        }
    }

    // 3. Update Player X-Card buttons
    const btnXcard = document.getElementById('btn-game-xcard');
    if (btnXcard) {
        if (isPaused && source === 'xcard') {
            btnXcard.classList.add('active-paused');
        } else {
            btnXcard.classList.remove('active-paused');
        }
    }
    const mobXcard = document.getElementById('mobile-tool-xcard');
    if (mobXcard) {
        if (isPaused && source === 'xcard') {
            mobXcard.classList.add('active-paused');
        } else {
            mobXcard.classList.remove('active-paused');
        }
    }

    // 4. Update Central Pause / X-Card Watermark Overlay
    const overlay = document.getElementById('vtt-pause-overlay');
    const iconEl = document.getElementById('vtt-pause-icon');
    const titleEl = document.getElementById('vtt-pause-title');
    const subEl = document.getElementById('vtt-pause-subtitle');

    if (overlay) {
        if (isPaused) {
            overlay.classList.remove('vtt-hidden', 'fade-out');
            overlay.classList.add('active');

            if (source === 'xcard') {
                overlay.classList.remove('theme-gm');
                overlay.classList.add('theme-xcard');
                if (iconEl) iconEl.className = 'fa-solid fa-xmark';
                if (titleEl) titleEl.textContent = 'GAME PAUSED (X-CARD)';
                if (subEl) subEl.textContent = 'Token movement paused • Please check in with the table';
                if (showToast && typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                    JqueryUtil.doToast({
                        type: 'danger',
                        content: `⚠️ X-Card triggered by ${pausedBy} — Game Paused`
                    });
                }
            } else {
                overlay.classList.remove('theme-xcard');
                overlay.classList.add('theme-gm');
                if (iconEl) iconEl.className = 'fa-solid fa-pause';
                if (titleEl) titleEl.textContent = 'GAME PAUSED BY GM';
                if (subEl) subEl.textContent = 'Only the GM can move tokens • Players may pan & inspect sheets';
                if (showToast && typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                    JqueryUtil.doToast({
                        type: 'warning',
                        content: 'Game Paused by GM'
                    });
                }
            }
        } else {
            overlay.classList.remove('active');
            overlay.classList.add('fade-out');
            setTimeout(() => {
                if (window.VTT && !window.VTT.isPaused) {
                    overlay.classList.add('vtt-hidden');
                    overlay.classList.remove('fade-out', 'theme-xcard', 'theme-gm');
                }
            }, 400);

            if (showToast && typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                JqueryUtil.doToast({
                    type: 'success',
                    content: 'Game Resumed by GM'
                });
            }
        }
    }

    // 5. Notify canvas engine
    if (window.VTT?.canvasEngine?.setGamePauseState) {
        window.VTT.canvasEngine.setGamePauseState(isPaused);
    }
}

export function setupPauseAndXCardControls() {
    if (typeof document === 'undefined') return;

    // GM Play/Pause Button (desktop)
    const btnGmPause = document.getElementById('btn-game-pause');
    if (btnGmPause) {
        btnGmPause.addEventListener('click', () => {
            if (window.VTT?.role !== 'GM') return;
            const currentlyPaused = Boolean(window.VTT?.isPaused);
            const socket = window.VTT?.socket;
            if (socket) {
                socket.emit('game:set_pause', { paused: !currentlyPaused, source: 'gm' });
            }
        });
    }

    // GM Play/Pause Button (mobile)
    const mobPause = document.getElementById('mobile-tool-pause');
    if (mobPause) {
        mobPause.addEventListener('click', () => {
            if (window.VTT?.role !== 'GM') return;
            const currentlyPaused = Boolean(window.VTT?.isPaused);
            const socket = window.VTT?.socket;
            if (socket) {
                socket.emit('game:set_pause', { paused: !currentlyPaused, source: 'gm' });
            }
        });
    }

    // Player X-Card Button (desktop)
    const btnXcard = document.getElementById('btn-game-xcard');
    if (btnXcard) {
        btnXcard.addEventListener('click', () => {
            const socket = window.VTT?.socket;
            if (socket) {
                socket.emit('game:set_pause', { paused: true, source: 'xcard' });
            }
        });
    }

    // Player X-Card Button (mobile)
    const mobXcard = document.getElementById('mobile-tool-xcard');
    if (mobXcard) {
        mobXcard.addEventListener('click', () => {
            const socket = window.VTT?.socket;
            if (socket) {
                socket.emit('game:set_pause', { paused: true, source: 'xcard' });
            }
        });
    }
}
