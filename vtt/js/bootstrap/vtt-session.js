/**
 * vtt-session.js
 * Resilient Socket.io connection lifecycle, module preloading,
 * campaign state synchronization, and table access allowlist management.
 */

import { resetBtnJoin, showLoginError, clearLoginError } from './vtt-auth.js';
import { getPlayerMapOverride, escapeHtml } from '../vtt-utils.js';

export function preloadVttModules() {
    return (async () => {
        try {
            const _v = '1.0.9'; // Versioned cache key
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
                rollTablesMod,
                presentationMod,
                creatureSelectorMod
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
                import(`../vtt-roll-tables.js?v=${_v}`),
                import(`../vtt-presentation.js?v=${_v}`),
                import(`../modals/creature-selector-modal.js?v=${_v}`)
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
                initVttRollTables: rollTablesMod.initVttRollTables,
                initVttPresentation: presentationMod.initVttPresentation,
                openCreatureSelectorModal: creatureSelectorMod.openCreatureSelectorModal
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
        row.innerHTML = `<span style="font-size: 0.85rem;">${escapeHtml(u)}</span>
            <button type="button" class="btn btn-xxs btn-danger btn-remove-allowlist"><i class="fa-solid fa-times"></i></button>`;
        const rmBtn = row.querySelector('.btn-remove-allowlist');
        if (rmBtn) {
            rmBtn.addEventListener('click', () => {
                if (typeof window.removeAllowlistUser === 'function') {
                    window.removeAllowlistUser(idx);
                }
            });
        }
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

    let socket;
    const isPresentationMirror = ctx.p2pMode === 'presentation-mirror';
    if (ctx.isP2P) {
        if (typeof window.VttP2PAdapter === 'undefined') {
            console.error('VttP2PAdapter client library not loaded!');
            resetBtnJoin();
            showLoginError('P2P Adapter library missing. Please reload.');
            return () => {};
        }

        const isHost = role === 'GM';
        socket = new window.VttP2PAdapter({
            isHost,
            role,
            username,
            campaignId,
            gmPassword
        });

        if (isHost && ctx.isP2P && !isPresentationMirror) {
            const manualCard = document.getElementById('config-manual-p2p-card');
            const offerOut = document.getElementById('config-manual-offer-output');
            const btnNewOffer = document.getElementById('btn-config-new-offer');
            const btnApplyAns = document.getElementById('btn-config-apply-answer');
            const ansInput = document.getElementById('config-manual-answer-input');
            if (manualCard) manualCard.classList.remove('vtt-hidden');
            const wireManualOfferFlow = () => {
                socket
                    .createHostManualOffer()
                    .then((offerStr) => {
                        if (offerOut) offerOut.value = offerStr;
                        navigator.clipboard?.writeText(offerStr).catch(() => {});
                        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                            JqueryUtil.doToast({
                                type: 'info',
                                content: 'P2P Host Invite ready! Share it from Settings -> Manual WebRTC Pair.'
                            });
                        }
                    })
                    .catch((err) => {
                        console.error('[P2P] Host offer generation failed:', err);
                        showLoginError(`Failed to generate P2P Offer: ${err.message}`);
                    });
            };
            if (btnNewOffer) {
                btnNewOffer.onclick = () => wireManualOfferFlow();
            }
            if (btnApplyAns && ansInput) {
                btnApplyAns.onclick = async () => {
                    const rawAns = ansInput.value.trim();
                    if (!rawAns) return;
                    try {
                        await socket.applyHostManualAnswer(rawAns);
                        ansInput.value = '';
                        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                            JqueryUtil.doToast({
                                type: 'success',
                                content: 'Peer Answer applied! Connecting player...'
                            });
                        }
                    } catch (err) {
                        alert(`Invalid Player Answer: ${err.message}`);
                    }
                };
            }
            if (ctx.p2pMode === 'manual') {
                wireManualOfferFlow();
                setTimeout(() => socket._dispatch('connect'), 10);
            }
        }
        if (isPresentationMirror) {
            // Static web local Presentation Window mirrors opener/BroadcastChannel without PeerJS
            setTimeout(async () => {
                let camp = window.opener?.VTT?.campaignState || null;
                if (!camp && typeof fetch === 'function') {
                    try {
                        const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`);
                        if (res.ok) camp = await res.json();
                    } catch (_) {
                        /* ignore */
                    }
                }
                socket.connected = true;
                socket._dispatch('joined', {
                    role: 'Player',
                    userRole: 'Player',
                    campaignState: camp || { id: campaignId, name: 'Presentation Campaign' },
                    chatHistory: []
                });
            }, 30);
        } else if (ctx.p2pMode === 'manual') {
            if (!isHost && ctx.p2pData) {
                socket
                    .createPlayerManualAnswer(ctx.p2pData)
                    .then((answerStr) => {
                        const ansGroup = document.getElementById('login-p2p-answer-group');
                        const ansOut = document.getElementById('login-p2p-answer-output');
                        if (ansOut) ansOut.value = answerStr;
                        if (ansGroup) ansGroup.classList.remove('vtt-hidden');
                        navigator.clipboard?.writeText(answerStr).catch(() => {});
                        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                            JqueryUtil.doToast({
                                type: 'info',
                                content: 'P2P Answer generated below! Copy and send it back to the GM.'
                            });
                        }
                    })
                    .catch((err) => {
                        console.error('[P2P] Manual answer failed:', err);
                        resetBtnJoin();
                        showLoginError(`Invalid P2P Offer text: ${err.message}`);
                    });
            }
        } else {
            const roomCode = (ctx.p2pCode || '').trim().toUpperCase();
            if (roomCode) {
                socket.connectWithRoomCode(roomCode).catch((err) => {
                    console.warn('[P2P] Room code connection failed:', err);
                    if (isHost) {
                        // Allow GM to enter tabletop solo/offline even if public broker is unreachable
                        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                            JqueryUtil.doToast({
                                type: 'warning',
                                content: `P2P Broker unavailable (${err.message}). Entered local/solo GM mode; use Manual WebRTC Pair in Settings if needed.`
                            });
                        }
                        socket.connected = true;
                        socket._dispatch('connect');
                    } else {
                        resetBtnJoin();
                        const staticFallbackMsg = window.__FORGEDVTT_STATIC_WEB__
                            ? `P2P Connection failed (${err.message}). Try Serverless Invite Text or configure a TURN relay in /prep.`
                            : `P2P Connection failed (${err.message}). Switch to Web Server tab to connect via Cloudflare.`;
                        showLoginError(staticFallbackMsg);
                    }
                });
            } else if (isHost) {
                // Solo/offline GM fallback when no room code was supplied
                socket.connected = true;
                setTimeout(() => socket._dispatch('connect'), 10);
            } else {
                resetBtnJoin();
                showLoginError('Please enter a P2P Room Code or paste a Serverless Invite.');
                return () => {};
            }
        }
    } else {
        // Initialise Resilient Socket connection with infinite auto-reconnect
        const ioFn = typeof io !== 'undefined' ? io : window.io || null;
        if (!ioFn) {
            console.error('Socket.io client library not loaded!');
            resetBtnJoin();
            showLoginError('Socket.io client library missing. Switch to Direct P2P or reload.');
            return () => {};
        }

        socket = ioFn({
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.3
        });
    }

    let hasJoinedSession = false;
    let isCancelled = false;

    // Override emit to automatically inject whisperToGM state from the UI toggle
    const originalEmit = socket.emit;
    socket.emit = function (eventName, ...args) {
        if (eventName === 'chat:msg' && args.length > 0 && typeof args[0] === 'object') {
            if (window.VTT && window.VTT.whisperGM) {
                args[0].whisperToGM = true;
            } else if (window.VTT && window.VTT.whisperGM !== undefined && args[0].whisperToGM === undefined) {
                args[0].whisperToGM = Boolean(window.VTT.whisperGM);
            }
        }
        return originalEmit.apply(this, [eventName, ...args]);
    };

    window.VTT.socket = socket;

    // Sync URL indicators (preserving current path/subpath)
    const absoluteHost = window.location.origin;
    const currentPlayBase = window.location.href.split(/[?#]/)[0];
    const elLocalUrl = document.getElementById('config-local-url');
    const elRemoteUrl = document.getElementById('config-remote-url');
    if (elLocalUrl) elLocalUrl.value = currentPlayBase;
    if (elRemoteUrl) {
        if (ctx.isP2P && ctx.p2pCode) {
            const inv = new URL(currentPlayBase);
            inv.searchParams.set('p2p', ctx.p2pCode);
            elRemoteUrl.value = inv.href;
        } else {
            elRemoteUrl.value = currentPlayBase;
        }
    }

    let connTimeout = setTimeout(() => {
        if (ctx.isP2P && ctx.p2pMode === 'manual' && role !== 'GM') {
            // Player is waiting for GM to apply manual WebRTC answer
            return;
        }
        if (!socket.connected && !hasJoinedSession) {
            resetBtnJoin();
            if (ctx.isP2P) {
                const msg = window.__FORGEDVTT_STATIC_WEB__
                    ? 'Direct P2P connection timed out (Symmetric NAT / firewall). Use Serverless Invite Text or a custom TURN relay.'
                    : 'Direct P2P connection timed out (Symmetric NAT restriction). Switch to the Web Server tab to connect via Cloudflare/LAN.';
                if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                    JqueryUtil.doToast({
                        type: 'warning',
                        content: msg
                    });
                }
                showLoginError(msg);
            } else {
                if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                    JqueryUtil.doToast({
                        type: 'warning',
                        content: `Connecting is taking longer than usual. Still attempting to reach server at ${absoluteHost}...`
                    });
                }
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

    const modalGmPassword = document.getElementById('modal-gm-password');
    const inputGmPassword = document.getElementById('input-gm-password');
    const gmPasswordError = document.getElementById('gm-password-error');

    const handleJoinRejected = ({ reason }) => {
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
    };

    socket.on('connect', async () => {
        if (isCancelled) return;
        clearTimeout(connTimeout);
        clearLoginError();
        if (
            role === 'GM' &&
            typeof window !== 'undefined' &&
            window.__FORGEDVTT_STATIC_WEB__ &&
            typeof window.__verifyStaticGmPassword === 'function'
        ) {
            try {
                const authCheck = await window.__verifyStaticGmPassword(username, gmPassword);
                if (!authCheck.ok) {
                    if (typeof socket.disconnect === 'function') socket.disconnect();
                    handleJoinRejected({ reason: authCheck.error || 'Invalid GM Password' });
                    return;
                }
            } catch (err) {
                if (typeof socket.disconnect === 'function') socket.disconnect();
                handleJoinRejected({ reason: err?.message || 'GM password verification failed.' });
                return;
            }
        }
        console.log('Connected to VTT backend!');
        socket.emit('join', { campaignId, username, role, gmPassword });
    });

    socket.on('join_rejected', handleJoinRejected);

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

    socket.on(
        'joined',
        async ({ role: serverRole, userRole, campaignState, chatHistory, gmSessionToken, playerSessionToken }) => {
            if (isCancelled) return;
            hasJoinedSession = true;
            updateConnectionStatus('connected', 'Connected!');
            clearTimeout(connTimeout);
            resetBtnJoin();
            if (modalGmPassword) modalGmPassword.classList.add('vtt-hidden');
            window.VTT.campaignState = campaignState;
            window.VTT.campaignId = campaignState?.id || campaignId;
            if (gmSessionToken) {
                window.VTT.gmSessionToken = gmSessionToken;
                try {
                    sessionStorage.setItem('forgedvtt_gm_token_vtt', gmSessionToken);
                } catch (_) {}
            }
            if (playerSessionToken) {
                window.VTT.playerSessionToken = playerSessionToken;
                try {
                    sessionStorage.setItem('forgedvtt_player_token', playerSessionToken);
                    if (typeof document !== 'undefined') {
                        document.cookie = `forgedvtt_player_token=${encodeURIComponent(playerSessionToken)}; path=/; SameSite=Lax`;
                    }
                } catch (_) {}
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
                if (mods.initVttPresentation) window.VTT.presentationEngine = mods.initVttPresentation(window.VTT);

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

                // Relay socket emits from popped-out P2P/Static sheet windows & forward live updates
                if (window.SheetWindowManager?.onSocketRelay) {
                    window.SheetWindowManager.onSocketRelay(({ event, args }) => {
                        if (event && window.VTT.socket) {
                            window.VTT.socket.emit(event, ...(Array.isArray(args) ? args : []));
                        }
                    });
                    for (const fwdEvt of [
                        'character:updated',
                        'character:deleted',
                        'token:updated_delta',
                        'chat:msg',
                        'campaign:state-sync'
                    ]) {
                        socket.on(fwdEvt, (...args) => {
                            window.SheetWindowManager.broadcast({ action: 'SHEET_SOCKET_EVENT', event: fwdEvt, args });
                        });
                    }
                }

                // Honor ?openSheet=1&characterId=... deep-links from /prep
                const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                const openSheetCharId = sp?.get('characterId');
                if (sp?.get('openSheet') === '1' && openSheetCharId) {
                    const ch = window.VTT.campaignState?.characters?.[openSheetCharId];
                    if (ch) {
                        if (ch.monsterData && window.VTT.creatureSheet?.openSheet) {
                            window.VTT.creatureSheet.openSheet(ch.monsterData, null, ch.id);
                        } else if (window.VTT.playerSheet?.openSheet) {
                            window.VTT.playerSheet.openSheet(ch.id);
                        }
                    }
                }
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
        }
    );

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
