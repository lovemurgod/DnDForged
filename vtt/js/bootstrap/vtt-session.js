/**
 * vtt-session.js
 * Resilient Socket.io connection lifecycle, module preloading,
 * campaign state synchronization, and table access allowlist management.
 */

import { resetBtnJoin, showLoginError, clearLoginError } from './vtt-auth.js';
import { getPlayerMapOverride } from '../vtt-utils.js';

export function preloadVttModules() {
    return (async () => {
        try {
            const _v = '1.0.6'; // Versioned cache key
            const [
                canvasMod,
                creatureMod,
                spellMod,
                playerMod,
                chatMod,
                dataMod,
                handoutsMod,
                popoutMod,
                mobileMod,
                themesMod,
                dockMod,
                weatherMod,
                rollTablesMod
            ] = await Promise.all([
                import(`../vtt-canvas.js?v=${_v}`),
                import(`../vtt-creature-sheet.js?v=${_v}`),
                import(`../vtt-spell-manager.js?v=${_v}`),
                import(`../vtt-player-sheet.js?v=${_v}`),
                import(`../vtt-chat.js?v=${_v}`),
                import(`../vtt-data-bridge.js?v=${_v}`),
                import(`../vtt-handouts.js?v=${_v}`),
                import(`../vtt-sheet-popout.js?v=${_v}`),
                import(`../vtt-mobile-adapter.js?v=${_v}`),
                import(`../vtt-themes.js?v=${_v}`),
                import(`../vtt-sheet-dock.js?v=${_v}`),
                import(`../vtt-weather.js?v=${_v}`),
                import(`../vtt-roll-tables.js?v=${_v}`)
            ]);

            return {
                initVttCanvas: canvasMod.initVttCanvas,
                initVttCreatureSheet: creatureMod.initVttCreatureSheet,
                initVttSpellManager: spellMod.initVttSpellManager,
                initVttPlayerSheet: playerMod.initVttPlayerSheet,
                initVttChat: chatMod.initVttChat,
                initVttDataBridge: dataMod.initVttDataBridge,
                initVttHandouts: handoutsMod.initVttHandouts,
                SheetWindowManager: popoutMod.SheetWindowManager,
                initVttMobileAdapter: mobileMod.initVttMobileAdapter,
                initVttThemes: themesMod.initVttThemes,
                initVttSheetDock: dockMod.initVttSheetDock,
                initVttWeather: weatherMod.initVttWeather,
                initVttRollTables: rollTablesMod.initVttRollTables
            };
        } catch (err) {
            console.error('VTT Module Import Error:', err);
            throw err;
        }
    })();
}

export function updateConnectionStatus(status, text) {
    if (typeof document === 'undefined') return;
    const connectionPill = document.getElementById('vtt-connection-status-pill');
    if (!connectionPill) return;
    if (status === 'hidden') {
        connectionPill.classList.add('vtt-hidden');
        connectionPill.classList.remove('connected');
        return;
    }
    connectionPill.classList.remove('vtt-hidden');
    if (status === 'reconnecting') {
        connectionPill.classList.remove('connected');
        connectionPill.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${text || 'Reconnecting to server...'}</span>`;
    } else if (status === 'connected') {
        connectionPill.classList.add('connected');
        connectionPill.innerHTML = `<i class="fa-solid fa-check"></i> <span>${text || 'Connected!'}</span>`;
        setTimeout(() => {
            if (connectionPill.classList.contains('connected')) {
                connectionPill.classList.add('vtt-hidden');
            }
        }, 2200);
    }
}

export function renderAllowlist(users) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('config-allowlist-users');
    if (!container) return;
    container.innerHTML = '';
    if (!users || users.length === 0) {
        container.innerHTML =
            '<span class="text-muted" style="font-size: 0.8rem;"><i>Allowlist is empty. Anyone can join.</i></span>';
        return;
    }
    users.forEach((u, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.background = 'rgba(255,255,255,0.05)';
        row.style.padding = '4px 8px';
        row.style.borderRadius = '4px';
        row.innerHTML = `<span style="font-size: 0.85rem;">${u}</span>
            <button class="btn btn-xxs btn-danger btn-remove-allowlist" onclick="removeAllowlistUser(${idx})"><i class="fa-solid fa-times"></i></button>`;
        container.appendChild(row);
    });
}

export function setupAllowlistGlobals() {
    if (typeof window === 'undefined') return;

    window.addAllowlistUser = function () {
        const ipt = document.getElementById('config-allowlist-input');
        if (!ipt) return;
        const val = ipt.value.trim();
        if (val && window.VTT && window.VTT.socket) {
            const newUsers = [...(window.VTT.campaignState?.allowedUsers || [])];
            if (!newUsers.includes(val)) {
                newUsers.push(val);
                window.VTT.socket.emit('allowlist:update', { allowedUsers: newUsers });
                ipt.value = '';
            }
        }
    };

    window.removeAllowlistUser = function (idx) {
        if (window.VTT && window.VTT.socket) {
            const newUsers = [...(window.VTT.campaignState?.allowedUsers || [])];
            newUsers.splice(idx, 1);
            window.VTT.socket.emit('allowlist:update', { allowedUsers: newUsers });
        }
    };
}

export function startSocketConnection(campaignId, username, role, gmPassword = null, ctx = {}) {
    const { moduleInitPromise, updateTabletopPauseUI } = ctx;

    // Show loading state
    const btnJoin = document.getElementById('btn-join-game');
    if (btnJoin) {
        btnJoin.disabled = true;
        btnJoin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
    }

    // Clean up previous socket if any
    if (window.VTT?.socket) {
        try {
            window.VTT.socket.disconnect();
        } catch (e) {}
    }

    // Initialise Resilient Socket connection with infinite auto-reconnect
    const ioFn = typeof io !== 'undefined' ? io : window.io || null;
    if (!ioFn) {
        console.error('Socket.io client library not loaded!');
        return;
    }

    const socket = ioFn({
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.3
    });

    let hasJoinedSession = false;
    let isCancelled = false;

    // Override emit to automatically inject whisperToGM state from the UI toggle
    const originalEmit = socket.emit;
    socket.emit = function (eventName, ...args) {
        if (eventName === 'chat:msg' && args.length > 0 && typeof args[0] === 'object') {
            if (window.VTT && window.VTT.whisperGM !== undefined && args[0].whisperToGM === undefined) {
                args[0].whisperToGM = window.VTT.whisperGM;
            }
        }
        return originalEmit.apply(this, [eventName, ...args]);
    };

    window.VTT.socket = socket;

    // Sync URL indicators
    const absoluteHost = window.location.origin;
    const elLocalUrl = document.getElementById('config-local-url');
    const elRemoteUrl = document.getElementById('config-remote-url');
    if (elLocalUrl) elLocalUrl.value = `${absoluteHost}/vtt.html`;
    if (elRemoteUrl) elRemoteUrl.value = `${absoluteHost}/vtt.html`;

    let connTimeout = setTimeout(() => {
        if (!socket.connected && !hasJoinedSession) {
            resetBtnJoin();
            if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                JqueryUtil.doToast({
                    type: 'warning',
                    content: `Connecting is taking longer than usual. Still attempting to reach server at ${absoluteHost}...`
                });
            }
        }
    }, 8000);

    socket.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected from server:', reason);
        if (!isCancelled && hasJoinedSession) {
            updateConnectionStatus('reconnecting', 'Connection paused — Reconnecting...');
        }
    });

    if (socket.io) {
        socket.io.on('reconnect_attempt', (attempt) => {
            if (!isCancelled && hasJoinedSession) {
                updateConnectionStatus('reconnecting', `Reconnecting... (Attempt ${attempt})`);
            }
        });

        socket.io.on('reconnect', () => {
            console.log('[Socket] Reconnected successfully to backend!');
            if (!isCancelled && hasJoinedSession) {
                updateConnectionStatus('connected', 'Reconnected!');
            }
        });
    }

    socket.on('connect_error', (err) => {
        if (isCancelled) return;
        console.warn('[Socket] connect_error:', err?.message || err);
        if (!hasJoinedSession) {
            clearTimeout(connTimeout);
            resetBtnJoin();
            showLoginError(`Connection error: ${err.message || 'Server offline'}. Retrying...`);
        } else {
            updateConnectionStatus('reconnecting', 'Reconnecting...');
        }
    });

    socket.on('connect', () => {
        if (isCancelled) return;
        clearTimeout(connTimeout);
        clearLoginError();
        console.log('Connected to VTT backend!');
        socket.emit('join', { campaignId, username, role, gmPassword });
    });

    const modalGmPassword = document.getElementById('modal-gm-password');
    const inputGmPassword = document.getElementById('input-gm-password');
    const gmPasswordError = document.getElementById('gm-password-error');

    socket.on('join_rejected', ({ reason, code }) => {
        if (isCancelled) return;
        clearTimeout(connTimeout);
        resetBtnJoin();
        if (modalGmPassword && !modalGmPassword.classList.contains('vtt-hidden')) {
            if (gmPasswordError) {
                gmPasswordError.textContent = reason || 'Invalid GM Password';
                gmPasswordError.style.display = 'block';
            }
            if (inputGmPassword) {
                inputGmPassword.select();
                inputGmPassword.focus();
            }
        } else {
            showLoginError(`Connection Rejected: ${reason || 'Unauthorized'}`);
        }
    });

    socket.on('allowlist:updated', ({ allowedUsers }) => {
        if (isCancelled) return;
        if (window.VTT.campaignState) {
            window.VTT.campaignState.allowedUsers = allowedUsers;
            renderAllowlist(allowedUsers);
        }
    });

    socket.on('game:pause_state', (pauseState) => {
        if (isCancelled) return;
        updateTabletopPauseUI?.(pauseState, true);
    });

    socket.on('joined', async ({ role: serverRole, userRole, campaignState, chatHistory, gmSessionToken }) => {
        if (isCancelled) return;
        hasJoinedSession = true;
        updateConnectionStatus('connected', 'Connected!');
        clearTimeout(connTimeout);
        resetBtnJoin();
        if (modalGmPassword) modalGmPassword.classList.add('vtt-hidden');
        window.VTT.campaignState = campaignState;
        if (gmSessionToken) {
            window.VTT.gmSessionToken = gmSessionToken;
        }

        // Authoritative server-validated role
        const authoritativeRole = userRole || serverRole || role || 'Player';
        window.VTT.role = authoritativeRole;

        const elUserRole2 = document.getElementById('display-user-role');
        if (elUserRole2) {
            elUserRole2.textContent = window.VTT.role;
            elUserRole2.className = `user-role-badge ${window.VTT.role.toLowerCase()}-badge`;
        }
        const dmScreenLink2 = document.getElementById('btn-dmscreen-link');
        if (window.VTT.role !== 'GM') {
            document.querySelectorAll('.gm-only').forEach((el) => el.classList.add('vtt-hidden'));
            document.querySelectorAll('.player-only').forEach((el) => el.classList.remove('vtt-hidden'));
            if (dmScreenLink2) dmScreenLink2.classList.add('vtt-hidden');
        } else {
            document.querySelectorAll('.gm-only').forEach((el) => el.classList.remove('vtt-hidden'));
            document.querySelectorAll('.player-only').forEach((el) => el.classList.add('vtt-hidden'));
            if (dmScreenLink2) dmScreenLink2.classList.remove('vtt-hidden');
        }

        renderAllowlist(campaignState?.allowedUsers || []);

        // Synchronize initial pause state on join
        if (campaignState && (campaignState.isPaused !== undefined || campaignState.pauseState)) {
            updateTabletopPauseUI?.(
                campaignState.pauseState || { isPaused: Boolean(campaignState.isPaused), source: 'gm' },
                false
            );
        }

        if (
            window.VTT._modulesInitializationState === 'initializing' ||
            window.VTT._modulesInitializationState === 'failed'
        ) {
            return;
        }

        document.getElementById('login-overlay')?.classList.add('vtt-hidden');
        document.getElementById('vtt-workspace')?.classList.remove('vtt-hidden');

        // IDEMPOTENCY GUARD: If modules are already initialized, do NOT re-run init!
        if (window.VTT._modulesInitialized || window.VTT._modulesInitializationState === 'initialized') {
            console.log(
                '[vtt.html] Session re-joined. Synchronizing campaign state and UI without re-binding listeners.'
            );
            if (window.VTT.canvasEngine?.syncCampaignState) {
                window.VTT.canvasEngine.syncCampaignState(campaignState);
            } else if (window.VTT.canvasEngine?.renderAll) {
                window.VTT.canvasEngine.renderAll();
            }
            if (window.VTT.chatEngine?.syncChatHistory && chatHistory) {
                window.VTT.chatEngine.syncChatHistory(chatHistory);
            } else if (window.VTT.chatEngine?.refreshInitiative) {
                window.VTT.chatEngine.refreshInitiative();
            }
            if (window.VTT.handoutsEngine?.syncHandouts && campaignState?.handouts) {
                window.VTT.handoutsEngine.syncHandouts(campaignState.handouts);
            }
            return;
        }
        window.VTT._modulesInitializationState = 'initializing';

        // Boot VTT Modules
        try {
            const mods = await moduleInitPromise;
            if (mods.initVttWeather) {
                window.VTT.weatherEngine = mods.initVttWeather(window.VTT);
                const weatherQualityEl = document.getElementById('config-weather-quality-select');
                if (weatherQualityEl) {
                    weatherQualityEl.value = window.VTT.weatherEngine.getQuality();
                    weatherQualityEl.addEventListener('change', (e) => {
                        window.VTT.weatherEngine.setQuality(e.target.value);
                    });
                }
            }
            if (mods.initVttCanvas) window.VTT.canvasEngine = mods.initVttCanvas(window.VTT);
            if (mods.initVttChat) window.VTT.chatEngine = mods.initVttChat(window.VTT, chatHistory);
            if (mods.initVttSpellManager) window.VTT.spellManager = mods.initVttSpellManager(window.VTT);
            if (mods.initVttPlayerSheet) window.VTT.playerSheet = mods.initVttPlayerSheet(window.VTT);
            if (mods.initVttCreatureSheet) window.VTT.creatureSheet = mods.initVttCreatureSheet(window.VTT);
            if (mods.initVttHandouts) window.VTT.handoutsEngine = mods.initVttHandouts(window.VTT);
            if (mods.initVttDataBridge) window.VTT.dataBridge = mods.initVttDataBridge(window.VTT);
            if (mods.SheetWindowManager) window.VTT.sheetWindowManager = mods.SheetWindowManager;
            if (mods.initVttMobileAdapter) window.VTT.mobileAdapter = mods.initVttMobileAdapter(window.VTT);
            if (mods.initVttThemes) window.VTT.themesEngine = mods.initVttThemes(window.VTT);
            if (mods.initVttSheetDock) window.VTT.sheetDock = mods.initVttSheetDock(window.VTT);
            if (mods.initVttRollTables) window.VTT.rollTablesEngine = mods.initVttRollTables(window.VTT);

            // Fail-safe initial sync of weather in case map was already loaded
            if (window.VTT.weatherEngine && window.VTT.campaignState?.maps) {
                const curMapId =
                    (window.VTT.canvasEngine?.getCurrentMapId && window.VTT.canvasEngine.getCurrentMapId()) ||
                    (window.VTT.role === 'GM'
                        ? window.VTT.campaignState.activeGMMapId || window.VTT.campaignState.activeMapId
                        : getPlayerMapOverride(window.VTT.campaignState, window.VTT.username) ||
                          window.VTT.campaignState.activeMapId);
                const curMap = window.VTT.campaignState.maps[curMapId];
                if (curMap?.weather) {
                    window.VTT.weatherEngine.setWeather(curMap.weather);
                }
            }

            // Setup dock callback: when an external tab asks to dock back into tabletop
            if (window.SheetWindowManager) {
                window.SheetWindowManager.onDock((sheetData) => {
                    console.log('[vtt.html] Docking sheet into main VTT:', sheetData);
                    if (!sheetData) return;
                    if (window.VTT.sheetDock?.openSheet) {
                        window.VTT.sheetDock.openSheet(sheetData);
                    } else if (sheetData.type === 'player' && sheetData.id && window.VTT.playerSheet) {
                        window.VTT.playerSheet.openSheet(sheetData.id);
                    } else if (window.VTT.creatureSheet) {
                        window.VTT.creatureSheet.openSheet(
                            sheetData.monsterData,
                            sheetData.tokenId,
                            sheetData.characterId
                        );
                    }
                });
            }

            console.log('Joined and VTT loaded!');
            const currentCampId = campaignState?.id || campaignId;
            if (window.loadBestiaryData) window.loadBestiaryData(currentCampId);
            if (window.VTTSpellManager?.invalidateSpellCache) {
                window.VTTSpellManager.invalidateSpellCache();
                window.VTTSpellManager.loadSpells?.(currentCampId);
            }
            window.VTT._modulesInitialized = true;
            window.VTT._modulesInitializationState = 'initialized';
        } catch (err) {
            window.VTT._modulesInitialized = false;
            window.VTT._modulesInitializationState = 'failed';
            console.error('VTT initialization failed:', err);
            const details = document.getElementById('vtt-init-error-details');
            if (details) {
                details.textContent = err instanceof Error ? err.stack || err.message : String(err);
            }
            const errorOverlay = document.getElementById('vtt-init-error');
            errorOverlay?.classList.remove('vtt-hidden');
            const reloadButton = document.getElementById('btn-vtt-init-reload');
            if (reloadButton) {
                reloadButton.onclick = () => window.location.reload();
                reloadButton.focus();
            }
        }
    });

    socket.on('sys_message', (msg) => {
        if (isCancelled) return;
        if (window.VTT.chatEngine) {
            window.VTT.chatEngine.appendSystemMessage(msg.text, msg.timestamp);
        }
    });

    // Private whisper (GM-only rolls from creature sheet)
    socket.on('chat:whisper', (msg) => {
        if (isCancelled) return;
        if (window.VTT.chatEngine) {
            window.VTT.chatEngine.appendWhisperMessage(msg);
        }
    });

    return () => {
        if (isCancelled) return;
        isCancelled = true;
        clearTimeout(connTimeout);
        socket.disconnect();
        if (window.VTT?.socket === socket) {
            window.VTT.socket = null;
        }
        resetBtnJoin();
    };
}
