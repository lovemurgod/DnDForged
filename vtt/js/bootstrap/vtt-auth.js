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
                campaignsLoaded = true;
                campaignLoadError?.classList.add('vtt-hidden');
                clearLoginError();
            } catch (err) {
                console.warn('Could not query campaigns list:', err);
                campaignSelect.innerHTML = '';
                campaignSelect.title = '';
                campaignLoadError?.classList.remove('vtt-hidden');
            } finally {
                campaignSelect.disabled = !campaignsLoaded;
                if (btnJoin) {
                    btnJoin.disabled = !campaignsLoaded;
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
        if (!campaignsLoaded) {
            showLoginError('Campaigns must load successfully before you can join.');
            return;
        }
        let username = usernameInput ? usernameInput.value.trim() : '';
        const role = roleSelect ? roleSelect.value : 'GM';
        const campaignId = campaignSelect && campaignSelect.value ? campaignSelect.value : 'default';

        if (!username) {
            username = role === 'GM' ? 'Game Master' : 'Player 1';
            if (usernameInput) usernameInput.value = username;
        }
        usernameInput?.classList.remove('form-control--error');

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

        // If joining as GM, verify if server requires password verification
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
                            callbacks.onStartSocketConnection?.(campaignId, username, role, pw) || null;
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

        callbacks.onStartSocketConnection?.(campaignId, username, role);
    };

    btnJoin?.addEventListener('click', executeJoinGame);
    usernameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeJoinGame();
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (typeof window !== 'undefined') window.location.reload();
    });
}
