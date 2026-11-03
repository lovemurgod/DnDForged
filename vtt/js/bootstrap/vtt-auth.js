/**
 * vtt-auth.js
 * User authentication, campaign picker, Remember-Me persistence,
 * and GM password gate dialog for ForgeDVTT.
 */

import { vttAuthHeaders } from './vtt-globals.js';

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
    if (!campaignSelect || typeof fetch === 'undefined') return;
    try {
        const res = await fetch('/api/campaigns', {
            headers: {
                'Bypass-Tunnel-Reminder': 'true',
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.indexOf('application/json') !== -1) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : data.campaigns || [];
                const activeSubdomain = !Array.isArray(data) ? data.activeSubdomain : null;

                campaignSelect.innerHTML = '';
                if (list.length === 0) {
                    const opt = document.createElement('option');
                    opt.value = 'default';
                    opt.textContent = 'Default Campaign';
                    campaignSelect.appendChild(opt);
                } else {
                    list.forEach((c) => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = c.name;
                        opt.title = c.name;
                        campaignSelect.appendChild(opt);
                    });
                    if (activeSubdomain) {
                        const matchedOpt = Array.from(campaignSelect.options).find((o) => o.value === activeSubdomain);
                        if (matchedOpt) {
                            campaignSelect.value = activeSubdomain;
                        }
                    }
                    campaignSelect.title = campaignSelect.options[campaignSelect.selectedIndex]?.text || '';
                    campaignSelect.addEventListener('change', () => {
                        campaignSelect.title = campaignSelect.options[campaignSelect.selectedIndex]?.text || '';
                    });
                }
            }
        }
    } catch (e) {
        console.warn('Could not query campaigns list, defaulting', e);
    }
}

export function setupLoginHandlers(callbacks = {}) {
    if (typeof document === 'undefined') return;

    const btnJoin = document.getElementById('btn-join-game');
    const usernameInput = document.getElementById('login-username');
    const roleSelect = document.getElementById('login-role');
    const campaignSelect = document.getElementById('login-campaign');
    const btnCreateCamp = document.getElementById('btn-create-campaign');
    const rememberCb = document.getElementById('login-remember');

    usernameInput?.addEventListener('input', clearLoginError);
    roleSelect?.addEventListener('change', clearLoginError);
    campaignSelect?.addEventListener('change', clearLoginError);

    // Restore saved credentials
    restoreRememberedCredentials();

    // Query active campaigns list on backend
    if (campaignSelect) {
        fetchActiveCampaigns(campaignSelect);
    }

    // Create campaign modal handling
    const modalCreate = document.getElementById('modal-create-campaign');
    const newCampName = document.getElementById('new-campaign-name');
    if (btnCreateCamp) btnCreateCamp.addEventListener('click', () => modalCreate?.classList.remove('vtt-hidden'));
    document
        .getElementById('btn-modal-cancel')
        ?.addEventListener('click', () => modalCreate?.classList.add('vtt-hidden'));
    document.getElementById('btn-modal-submit')?.addEventListener('click', async () => {
        const name = newCampName?.value?.trim();
        if (!name) return alert('Please enter a campaign name');
        try {
            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: vttAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const camp = await res.json();
                const opt = document.createElement('option');
                opt.value = camp.id;
                opt.textContent = camp.name;
                campaignSelect?.appendChild(opt);
                if (campaignSelect) campaignSelect.value = camp.id;
                if (newCampName) newCampName.value = '';
                modalCreate?.classList.add('vtt-hidden');
            }
        } catch (e) {
            alert('Error creating campaign: ' + e.message);
        }
    });

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
            modalGmPassword?.classList.add('vtt-hidden');
            resetBtnJoin();
        });
    }

    const executeJoinGame = async () => {
        clearLoginError();
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
                const checkRes = await fetch(`/api/gm-auth-required?username=${encodeURIComponent(username)}`);
                if (checkRes.ok) {
                    const authInfo = await checkRes.json();
                    if (authInfo.required && authInfo.hasPassword) {
                        // Prompt the "Password?" dialogue box
                        if (modalGmPassword) {
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
                                    btnSubmitGmPassword.innerHTML =
                                        '<i class="fa-solid fa-spinner fa-spin"></i> Validating...';
                                }
                                callbacks.onStartSocketConnection?.(campaignId, username, role, pw);
                            };

                            if (btnSubmitGmPassword) btnSubmitGmPassword.onclick = submitHandler;
                            if (inputGmPassword) {
                                inputGmPassword.onkeydown = (e) => {
                                    if (e.key === 'Enter') submitHandler();
                                };
                            }
                            return;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not check GM auth requirement:', e);
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
