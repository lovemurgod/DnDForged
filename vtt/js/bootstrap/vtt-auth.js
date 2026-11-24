/**
 * vtt-auth.js
 * User authentication, campaign picker, Remember-Me persistence,
 * and GM password gate dialog for ForgeDVTT.
 */

export function showLoginError(msg) {
    if (typeof document === 'undefined') return;
    const loginErrorBanner = document.getElementById('login-error-banner');
    const loginErrorText = document.getElementById('login-error-text');
    if (loginErrorBanner && loginErrorText) {
        loginErrorText.textContent = msg;
        loginErrorBanner.classList.remove('vtt-hidden');
    } else if (typeof alert === 'function') {
        alert(msg);
    }
}

export function clearLoginError() {
    if (typeof document === 'undefined') return;
    const loginErrorBanner = document.getElementById('login-error-banner');
    if (loginErrorBanner) {
        loginErrorBanner.classList.add('vtt-hidden');
    }
}

export function restoreRememberedCredentials() {
    if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isPresentationMode = urlParams?.get('mode') === 'presentation' || urlParams?.get('presentation') === 'true';
    if (isPresentationMode) {
        if (typeof window !== 'undefined' && window.VTT) {
            window.VTT.isPresentationMode = true;
            window.VTT.role = 'Player';
            window.VTT.username = 'Presentation Display';
        }
        document.body.classList.add('vtt-presentation-mode');
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.classList.add('vtt-hidden');
        return;
    }

    const rememberCb = document.getElementById('login-remember');
    const usernameInput = document.getElementById('login-username');
    const roleSelect = document.getElementById('login-role');

    const savedRemember = localStorage.getItem('vtt_remember');
    if (savedRemember !== null && rememberCb) {
        rememberCb.checked = savedRemember === 'true';
    }
    if (rememberCb && rememberCb.checked) {
        const savedUser = localStorage.getItem('vtt_username');
        const savedRole = localStorage.getItem('vtt_role');
        if (savedUser && usernameInput) usernameInput.value = savedUser;
        if (savedRole && roleSelect) roleSelect.value = savedRole;
    }
}

export function resetBtnJoin() {
    if (typeof document === 'undefined') return;
    const btnJoin = document.getElementById('btn-join-game');
    const btnSubmitGmPassword = document.getElementById('btn-submit-gm-password');
    if (btnJoin) {
        btnJoin.disabled = false;
        btnJoin.innerHTML = '<i class="fa-solid fa-door-open"></i> Enter Tabletop';
    }
    if (btnSubmitGmPassword) {
        btnSubmitGmPassword.disabled = false;
        btnSubmitGmPassword.innerHTML = '<i class="fa-solid fa-unlock"></i> Validate';
    }
}

export async function fetchActiveCampaigns(campaignSelect) {
    if (!campaignSelect) {
        throw new Error('Campaign selector is unavailable.');
    }
    if (typeof fetch === 'undefined') {
        throw new Error('Campaign service is unavailable.');
    }

    const res = await fetch('/api/campaigns', {
        headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'ngrok-skip-browser-warning': 'true'
        }
    });
    if (!res.ok) {
        throw new Error(`Campaign request failed with status ${res.status}.`);
    }

    const contentType = res.headers?.get?.('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('Campaign response was not JSON.');
    }

    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.campaigns;
    if (
        !Array.isArray(list) ||
        list.some(
            (campaign) =>
                !campaign ||
                !['string', 'number'].includes(typeof campaign.id) ||
                !String(campaign.id).trim() ||
                typeof campaign.name !== 'string' ||
                !campaign.name.trim()
        )
    ) {
        throw new Error('Campaign response has an invalid format.');
    }

    const activeSubdomain = !Array.isArray(data) ? data.activeSubdomain : null;
    campaignSelect.innerHTML = '';
    if (list.length === 0) {
        const opt = document.createElement('option');
        opt.value = 'default';
        opt.textContent = 'Default Campaign';
        campaignSelect.appendChild(opt);
    } else {
        list.forEach((campaign) => {
            const opt = document.createElement('option');
            opt.value = String(campaign.id);
            opt.textContent = campaign.name;
            opt.title = campaign.name;
            campaignSelect.appendChild(opt);
        });
        if (activeSubdomain) {
            const matchedOpt = Array.from(campaignSelect.options).find((o) => o.value === activeSubdomain);
            if (matchedOpt) {
                campaignSelect.value = activeSubdomain;
            }
        }
    }
    campaignSelect.title = campaignSelect.options[campaignSelect.selectedIndex]?.text || '';
}

export function setupLoginHandlers(callbacks = {}) {
    if (typeof document === 'undefined') return;

    const btnJoin = document.getElementById('btn-join-game');
    const usernameInput = document.getElementById('login-username');
    const roleSelect = document.getElementById('login-role');
    const campaignSelect = document.getElementById('login-campaign');
    const rememberCb = document.getElementById('login-remember');
    const campaignLoadError = document.getElementById('campaign-load-error');
    const btnRetryCampaigns = document.getElementById('btn-retry-campaigns');
    let cancelGmPasswordConnection = null;
    let campaignsLoaded = false;
    let campaignLoadPromise = null;

    usernameInput?.addEventListener('input', clearLoginError);
    roleSelect?.addEventListener('change', clearLoginError);
    campaignSelect?.addEventListener('change', () => {
        clearLoginError();
        campaignSelect.title = campaignSelect.options[campaignSelect.selectedIndex]?.text || '';
    });

    // Restore saved credentials
    restoreRememberedCredentials();

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    let isP2PMode = false;

    const loadCampaigns = () => {
        if (!campaignSelect) return Promise.resolve(false);
        if (campaignLoadPromise) return campaignLoadPromise;

        campaignsLoaded = false;
        campaignSelect.disabled = true;
        campaignSelect.innerHTML = '';
        campaignLoadError?.classList.add('vtt-hidden');
        if (btnJoin) {
            btnJoin.disabled = true;
            btnJoin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading campaigns...';
        }
        if (btnRetryCampaigns) btnRetryCampaigns.disabled = true;

        campaignLoadPromise = (async () => {
            try {
                await fetchActiveCampaigns(campaignSelect);
                const reqCamp = urlParams?.get('campaign');
                if (reqCamp && Array.from(campaignSelect.options).some((o) => o.value === reqCamp)) {
                    campaignSelect.value = reqCamp;
                }
                campaignsLoaded = true;
                campaignLoadError?.classList.add('vtt-hidden');
                clearLoginError();
            } catch (err) {
                console.warn('Could not query campaigns list:', err);
                const isStaticOrP2p = Boolean(
                    (typeof window !== 'undefined' && window.__FORGEDVTT_STATIC_WEB__) ||
                    urlParams?.get('p2p')
                );
                if (isStaticOrP2p) {
                    campaignSelect.innerHTML = '';
                    const opt = document.createElement('option');
                    opt.value = urlParams?.get('campaign') || 'default';
                    opt.textContent = 'P2P Session Campaign';
                    campaignSelect.appendChild(opt);
                    campaignsLoaded = true;
                    campaignLoadError?.classList.add('vtt-hidden');
                    clearLoginError();
                } else {
                    campaignSelect.innerHTML = '';
                    campaignSelect.title = '';
                    campaignLoadError?.classList.remove('vtt-hidden');
                }
            } finally {
                campaignSelect.disabled = !campaignsLoaded && !isP2PMode;
                if (btnJoin) {
                    btnJoin.disabled = !campaignsLoaded && !isP2PMode;
                    btnJoin.innerHTML = '<i class="fa-solid fa-door-open"></i> Enter Tabletop';
                }
                if (btnRetryCampaigns) btnRetryCampaigns.disabled = false;
                campaignLoadPromise = null;
            }
            return campaignsLoaded;
        })();
        return campaignLoadPromise;
    };

    btnRetryCampaigns?.addEventListener('click', () => {
        loadCampaigns();
    });
    loadCampaigns();

    // P2P Connection Mode Setup
    const tabServer = document.getElementById('tab-login-server');
    const tabP2P = document.getElementById('tab-login-p2p');
    const p2pGroup = document.getElementById('login-p2p-group');
    const p2pCodeInput = document.getElementById('login-p2p-code');
    const p2pManualInput = document.getElementById('login-p2p-manual');

    const setConnectionMode = (p2p) => {
        isP2PMode = p2p;
        const hintText = document.getElementById('login-connection-hint-text');
        if (p2p) {
            tabP2P?.classList.add('active');
            tabP2P?.classList.remove('btn-secondary');
            tabP2P?.classList.add('btn-primary');
            tabServer?.classList.remove('active');
            tabServer?.classList.add('btn-secondary');
            tabServer?.classList.remove('btn-primary');
            p2pGroup?.classList.remove('vtt-hidden');
            if (btnJoin && !btnJoin.innerHTML.includes('fa-spinner')) {
                btnJoin.disabled = false;
            }
            if (hintText) {
                hintText.innerHTML = '<i class="fa-solid fa-bolt" style="margin-right: 4px; color: #f59e0b;"></i> <strong>Direct P2P:</strong> Low-latency direct connection between machines. Free & unlimited bandwidth. Best on home Wi-Fi/desktop.';
            }
            if (p2pCodeInput) p2pCodeInput.focus();
        } else {
            tabServer?.classList.add('active');
            tabServer?.classList.remove('btn-secondary');
            tabServer?.classList.add('btn-primary');
            tabP2P?.classList.remove('active');
            tabP2P?.classList.add('btn-secondary');
            tabP2P?.classList.remove('btn-primary');
            p2pGroup?.classList.add('vtt-hidden');
            if (btnJoin && !campaignsLoaded) {
                btnJoin.disabled = true;
            }
            if (hintText) {
                hintText.innerHTML = '<i class="fa-solid fa-shield-halved" style="margin-right: 4px; color: #38bdf8;"></i> <strong>Web Server:</strong> Standard host connection. Highly reliable across all networks, mobile data, and strict firewalls.';
            }
        }
    };

    tabServer?.addEventListener('click', () => setConnectionMode(false));
    tabP2P?.addEventListener('click', () => setConnectionMode(true));

    if (urlParams?.get('p2p')) {
        setConnectionMode(true);
        if (p2pCodeInput) p2pCodeInput.value = urlParams.get('p2p').toUpperCase();
    } else if (typeof window !== 'undefined' && window.__FORGEDVTT_STATIC_WEB__) {
        // Static web hosting has no Socket.IO server: default cleanly to Direct P2P mode
        setConnectionMode(true);
        if (tabServer) tabServer.classList.add('vtt-hidden');
    }
    const isPresentationMode = urlParams?.get('mode') === 'presentation' || urlParams?.get('presentation') === 'true';
    if (isPresentationMode) {
        if (typeof window !== 'undefined' && window.VTT) {
            window.VTT.isPresentationMode = true;
            window.VTT.role = 'Player';
            window.VTT.username = 'Presentation Display';
        }
        document.body.classList.add('vtt-presentation-mode');
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.classList.add('vtt-hidden');

        const executePresentationJoin = () => {
            const targetCampaign = urlParams.get('campaign') || urlParams.get('campaignId') || campaignSelect?.value || 'default';
            if (typeof window !== 'undefined' && window.VTT) {
                window.VTT.campaignId = targetCampaign;
            }
            callbacks.onStartSocketConnection?.(targetCampaign, 'Presentation Display', 'Player');
        };

        if (campaignLoadPromise) {
            campaignLoadPromise.then(executePresentationJoin).catch(executePresentationJoin);
        } else {
            executePresentationJoin();
        }
        return;
    }

    const modalGmPassword = document.getElementById('modal-gm-password');
    const inputGmPassword = document.getElementById('input-gm-password');
    const btnToggleLoginPw = document.getElementById('btn-toggle-login-pw');
    const btnSubmitGmPassword = document.getElementById('btn-submit-gm-password');
    const btnCancelGmPassword = document.getElementById('btn-cancel-gm-password');
    const gmPasswordError = document.getElementById('gm-password-error');

    if (btnToggleLoginPw && inputGmPassword) {
        btnToggleLoginPw.addEventListener('click', () => {
            if (inputGmPassword.type === 'password') {
                inputGmPassword.type = 'text';
                btnToggleLoginPw.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                inputGmPassword.type = 'password';
                btnToggleLoginPw.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    }

    if (btnCancelGmPassword) {
        btnCancelGmPassword.addEventListener('click', () => {
            cancelGmPasswordConnection?.();
            cancelGmPasswordConnection = null;
            modalGmPassword?.classList.add('vtt-hidden');
            resetBtnJoin();
        });
    }

    const executeJoinGame = async () => {
        clearLoginError();
        if (!isP2PMode && !campaignsLoaded) {
            showLoginError('Campaigns must load successfully before you can join.');
            return;
        }
        let username = usernameInput ? usernameInput.value.trim() : '';
        const role = roleSelect ? roleSelect.value : 'GM';
        const campaignId =
            (!isP2PMode || role === 'GM') && campaignSelect && campaignSelect.value
                ? campaignSelect.value
                : (role === 'GM' && urlParams?.get('campaign')) || 'default';

        if (!username) {
            username = role === 'GM' ? 'Game Master' : 'Player 1';
            if (usernameInput) usernameInput.value = username;
        }
        usernameInput?.classList.remove('form-control--error');

        const p2pOptions = isP2PMode ? {
            isP2P: true,
            p2pCode: (p2pCodeInput?.value || '').trim().toUpperCase(),
            p2pMode: (p2pManualInput?.value || '').trim() ? 'manual' : 'broker',
            p2pData: (p2pManualInput?.value || '').trim() || null
        } : { isP2P: false };

        if (rememberCb && rememberCb.checked) {
            localStorage.setItem('vtt_remember', 'true');
            localStorage.setItem('vtt_username', username);
            localStorage.setItem('vtt_role', role);
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem('vtt_remember', 'false');
            localStorage.removeItem('vtt_username');
            localStorage.removeItem('vtt_role');
        }

        if (typeof window !== 'undefined' && window.VTT) {
            window.VTT.username = username;
            window.VTT.role = role;
            window.VTT.campaignId = campaignId;
        }

        // Sync connection details to DOM displays
        const selectedOpt = campaignSelect?.options[campaignSelect.selectedIndex];
        const campName = selectedOpt ? selectedOpt.text : campaignId || 'Default Campaign';
        const elCampName = document.getElementById('display-campaign-name');
        if (elCampName) elCampName.textContent = campName;
        const elUserRole = document.getElementById('display-user-role');
        if (elUserRole) {
            elUserRole.textContent = role;
            elUserRole.className = `user-role-badge ${role.toLowerCase()}-badge`;
        }
        const elUsername = document.getElementById('display-username');
        if (elUsername) elUsername.textContent = username;

        // Hide GM only features for players
        const dmScreenLink1 = document.getElementById('btn-dmscreen-link');
        if (role !== 'GM') {
            document.querySelectorAll('.gm-only').forEach((el) => el.classList.add('vtt-hidden'));
            document.querySelectorAll('.player-only').forEach((el) => el.classList.remove('vtt-hidden'));
            if (dmScreenLink1) dmScreenLink1.classList.add('vtt-hidden');
        } else {
            document.querySelectorAll('.gm-only').forEach((el) => el.classList.remove('vtt-hidden'));
            document.querySelectorAll('.player-only').forEach((el) => el.classList.add('vtt-hidden'));
            if (dmScreenLink1) dmScreenLink1.classList.remove('vtt-hidden');
        }

        // If joining as GM, verify if server or static web store requires password verification
        if (role === 'GM') {
            try {
                if (typeof fetch === 'undefined') {
                    throw new Error('GM verification service is unavailable.');
                }
                const checkRes = await fetch(`/api/gm-auth-required?username=${encodeURIComponent(username)}`);
                if (!checkRes.ok) {
                    throw new Error(`GM verification request failed with status ${checkRes.status}.`);
                }
                const authInfo = await checkRes.json();
                if (!authInfo || typeof authInfo.required !== 'boolean' || typeof authInfo.hasPassword !== 'boolean') {
                    throw new Error('GM verification response has an invalid format.');
                }
                if (authInfo.required && authInfo.hasPassword) {
                    if (!modalGmPassword || !btnSubmitGmPassword) {
                        throw new Error('GM password dialog is unavailable.');
                    }
                    modalGmPassword.classList.remove('vtt-hidden');
                    if (inputGmPassword) {
                        inputGmPassword.value = '';
                        inputGmPassword.focus();
                    }
                    if (gmPasswordError) gmPasswordError.style.display = 'none';

                    const submitHandler = () => {
                        const pw = inputGmPassword ? inputGmPassword.value : '';
                        if (btnSubmitGmPassword) {
                            btnSubmitGmPassword.disabled = true;
                            btnSubmitGmPassword.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validating...';
                        }
                        cancelGmPasswordConnection =
                            callbacks.onStartSocketConnection?.(campaignId, username, role, pw, p2pOptions) || null;
                    };

                    btnSubmitGmPassword.onclick = submitHandler;
                    if (inputGmPassword) {
                        inputGmPassword.onkeydown = (e) => {
                            if (e.key === 'Enter') submitHandler();
                        };
                    }
                    return;
                }
            } catch (e) {
                console.warn('Could not check GM auth requirement:', e);
                showLoginError('Unable to verify GM requirements right now. Please try again.');
                return;
            }
        }

        callbacks.onStartSocketConnection?.(campaignId, username, role, null, p2pOptions);
    };

    btnJoin?.addEventListener('click', executeJoinGame);
    usernameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeJoinGame();
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (typeof window !== 'undefined') window.location.reload();
    });
}
