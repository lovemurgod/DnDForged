// DnDForged Token Display Preferences & Live Mockups
// Coordinates player and GM token HUD settings (bars, names, flight, conditions, temp HP)

import {
    DEFAULT_PLAYER_TOKEN_PREFS,
    DEFAULT_GM_TOKEN_PREFS,
    VISIBILITY_TIERS,
    loadPlayerTokenPrefs,
    savePlayerTokenPrefs,
    loadGmTokenPrefs,
    saveGmTokenPrefs
} from './vtt-canvas-token-config.js';

export function setupPlayerTokenSettingsControls(prefsState, options = {}) {
    if (typeof document === 'undefined') return;
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {}, renderAll = () => {} } = options;

    const controls = [
        { id: 'token-pref-monster-hp-visible', key: 'monsterHpBarVisible', type: 'select' },
        { id: 'token-pref-monster-hp-num-visible', key: 'monsterHpNumVisible', type: 'checkbox' },
        { id: 'token-pref-monster-name-visible', key: 'monsterNameVisible', type: 'select' },
        { id: 'token-pref-player-hp-visible', key: 'playerHpBarVisible', type: 'select' },
        { id: 'token-pref-player-hp-num-visible', key: 'playerHpNumVisible', type: 'checkbox' },
        { id: 'token-pref-player-name-visible', key: 'playerNameVisible', type: 'select' },
        { id: 'token-pref-temp-hp-visible', key: 'tempHpBarVisible', type: 'select' },
        { id: 'token-pref-temp-hp-num-visible', key: 'tempHpNumVisible', type: 'checkbox' },
        { id: 'token-pref-bar-position', key: 'barPosition', type: 'select' },
        { id: 'token-pref-name-position', key: 'namePosition', type: 'select' },
        { id: 'token-pref-nameplate-fit', key: 'nameplateFitWidth', type: 'checkbox' },
        { id: 'token-pref-bar-height', key: 'barHeight', type: 'number' },
        { id: 'token-pref-temp-hp-style', key: 'tempHpBarStyle', type: 'select' },
        { id: 'token-pref-flight-position', key: 'flightPosition', type: 'select' },
        { id: 'token-pref-condition-position', key: 'conditionPosition', type: 'select' },
        { id: 'token-pref-condition-orientation', key: 'conditionOrientation', type: 'select' },
        { id: 'token-pref-damage-fx-enabled', key: 'damageFxEnabled', type: 'checkbox' }
    ];

    controls.forEach((c) => {
        const el = document.getElementById(c.id);
        if (!el) return;
        el.addEventListener('change', () => {
            let val;
            if (c.type === 'checkbox') val = el.checked;
            else if (c.type === 'number') val = parseInt(el.value, 10) || 8;
            else val = el.value;

            prefsState.playerTokenPrefs[c.key] = val;
            savePlayerTokenPrefs(prefsState.playerTokenPrefs);
            syncPlayerTokenSettingsUI(prefsState, options);
            renderAll();
        });
    });

    // Preset buttons
    const btnTactical = document.getElementById('btn-token-preset-tactical');
    if (btnTactical) {
        btnTactical.addEventListener('click', () => {
            prefsState.playerTokenPrefs.barPosition = 'below';
            prefsState.playerTokenPrefs.namePosition = 'above';
            prefsState.playerTokenPrefs.nameplateFitWidth = true;
            prefsState.playerTokenPrefs.barHeight = 12;
            prefsState.playerTokenPrefs.flightPosition = 'outside-tl';
            prefsState.playerTokenPrefs.conditionPosition = 'outside-tr';
            prefsState.playerTokenPrefs.conditionOrientation = 'horizontal';
            prefsState.playerTokenPrefs.tempHpBarStyle = 'stacked';
            savePlayerTokenPrefs(prefsState.playerTokenPrefs);
            syncPlayerTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }

    const btnMinimal = document.getElementById('btn-token-preset-minimal');
    if (btnMinimal) {
        btnMinimal.addEventListener('click', () => {
            prefsState.playerTokenPrefs.monsterHpBarVisible = 'hover';
            prefsState.playerTokenPrefs.monsterNameVisible = 'hover';
            prefsState.playerTokenPrefs.playerHpBarVisible = 'hover';
            prefsState.playerTokenPrefs.playerNameVisible = 'hover';
            prefsState.playerTokenPrefs.barPosition = 'bottom';
            prefsState.playerTokenPrefs.namePosition = 'top';
            prefsState.playerTokenPrefs.nameplateFitWidth = true;
            prefsState.playerTokenPrefs.barHeight = 6;
            prefsState.playerTokenPrefs.flightPosition = 'inside-tl';
            prefsState.playerTokenPrefs.conditionPosition = 'inside-tr';
            prefsState.playerTokenPrefs.conditionOrientation = 'horizontal';
            savePlayerTokenPrefs(prefsState.playerTokenPrefs);
            syncPlayerTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }

    const btnClassic = document.getElementById('btn-token-preset-classic');
    if (btnClassic) {
        btnClassic.addEventListener('click', () => {
            prefsState.playerTokenPrefs.barPosition = 'bottom';
            prefsState.playerTokenPrefs.namePosition = 'top';
            prefsState.playerTokenPrefs.nameplateFitWidth = true;
            prefsState.playerTokenPrefs.barHeight = 8;
            prefsState.playerTokenPrefs.flightPosition = 'inside-tl';
            prefsState.playerTokenPrefs.conditionPosition = 'inside-tr';
            prefsState.playerTokenPrefs.conditionOrientation = 'horizontal';
            savePlayerTokenPrefs(prefsState.playerTokenPrefs);
            syncPlayerTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }

    const btnReset = document.getElementById('btn-token-preset-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            prefsState.playerTokenPrefs = { ...DEFAULT_PLAYER_TOKEN_PREFS };
            savePlayerTokenPrefs(prefsState.playerTokenPrefs);
            syncPlayerTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }

    const tabConfigBtn = document.querySelector('.tab-header[data-tab="tab-config"]');
    if (tabConfigBtn) {
        tabConfigBtn.addEventListener('click', () => {
            syncPlayerTokenSettingsUI(prefsState, options);
            if (vtt.role === 'GM') {
                syncGmTokenSettingsUI(prefsState, options);
            }
        });
    }
}

export function syncPlayerTokenSettingsUI(prefsState, options = {}) {
    if (typeof document === 'undefined') return;
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {}, campaignSettings = {} } = options;

    prefsState.playerTokenPrefs = loadPlayerTokenPrefs();
    const rolePrefix = vtt.role === 'GM' ? 'gm' : 'player';

    const visibilityMappings = [
        {
            selectId: 'token-pref-monster-hp-visible',
            checkboxId: 'token-pref-monster-hp-num-visible',
            prefVisibleKey: 'monsterHpBarVisible',
            prefNumKey: 'monsterHpNumVisible',
            gmVisibleKey: `${rolePrefix}MonsterHpBarVisible`,
            gmNumKey: `${rolePrefix}MonsterHpNumVisible`
        },
        {
            selectId: 'token-pref-monster-name-visible',
            checkboxId: null,
            prefVisibleKey: 'monsterNameVisible',
            prefNumKey: null,
            gmVisibleKey: `${rolePrefix}MonsterNameVisible`,
            gmNumKey: null
        },
        {
            selectId: 'token-pref-player-hp-visible',
            checkboxId: 'token-pref-player-hp-num-visible',
            prefVisibleKey: 'playerHpBarVisible',
            prefNumKey: 'playerHpNumVisible',
            gmVisibleKey: `${rolePrefix}PlayerHpBarVisible`,
            gmNumKey: `${rolePrefix}PlayerHpNumVisible`
        },
        {
            selectId: 'token-pref-player-name-visible',
            checkboxId: null,
            prefVisibleKey: 'playerNameVisible',
            prefNumKey: null,
            gmVisibleKey: `${rolePrefix}PlayerNameVisible`,
            gmNumKey: null
        },
        {
            selectId: 'token-pref-temp-hp-visible',
            checkboxId: 'token-pref-temp-hp-num-visible',
            prefVisibleKey: 'tempHpBarVisible',
            prefNumKey: 'tempHpNumVisible',
            gmVisibleKey: `${rolePrefix}TempHpBarVisible`,
            gmNumKey: `${rolePrefix}TempHpNumVisible`
        }
    ];

    let anyLocked = false;

    visibilityMappings.forEach((mapping) => {
        const selectEl = document.getElementById(mapping.selectId);
        const gmSetting = campaignSettings[mapping.gmVisibleKey] ?? 'always';
        const gmTier = VISIBILITY_TIERS[gmSetting] ?? 2;

        if (selectEl) {
            Array.from(selectEl.options).forEach((opt) => {
                const optVal = opt.value;
                if (optVal === 'default') {
                    opt.textContent = `Table Default (${gmSetting === 'always' ? 'Always' : gmSetting === 'hover' ? 'Hover' : 'Never'})`;
                } else if (optVal === 'always') {
                    if (gmTier < 2) {
                        opt.disabled = true;
                        opt.textContent = 'Always Visible (🔒 GM Locked)';
                        anyLocked = true;
                    } else {
                        opt.disabled = false;
                        opt.textContent = 'Always Visible';
                    }
                } else if (optVal === 'hover') {
                    if (gmTier < 1) {
                        opt.disabled = true;
                        opt.textContent = 'On Hover Only (🔒 GM Locked)';
                        anyLocked = true;
                    } else {
                        opt.disabled = false;
                        opt.textContent = 'On Hover Only';
                    }
                } else if (optVal === 'never') {
                    opt.disabled = false;
                    opt.textContent = 'Never Visible';
                }
            });

            let currentVal = prefsState.playerTokenPrefs[mapping.prefVisibleKey] || 'default';
            if (currentVal !== 'default') {
                const curTier = VISIBILITY_TIERS[currentVal] ?? 2;
                if (curTier > gmTier) {
                    currentVal = gmSetting;
                    prefsState.playerTokenPrefs[mapping.prefVisibleKey] = currentVal;
                    savePlayerTokenPrefs(prefsState.playerTokenPrefs);
                }
            }
            selectEl.value = currentVal;
        }

        if (mapping.checkboxId) {
            const cbEl = document.getElementById(mapping.checkboxId);
            if (cbEl) {
                const gmNumAllowed = campaignSettings[mapping.gmNumKey] !== false;
                const parentLabel = cbEl.closest('label');
                if (!gmNumAllowed) {
                    cbEl.disabled = true;
                    cbEl.checked = false;
                    if (parentLabel) {
                        parentLabel.style.opacity = '0.4';
                        parentLabel.title = '🔒 Numbers disabled by GM';
                    }
                    anyLocked = true;
                } else {
                    cbEl.disabled = false;
                    if (parentLabel) {
                        parentLabel.style.opacity = '1';
                        parentLabel.title = 'Show numeric HP values';
                    }
                    const prefVal = prefsState.playerTokenPrefs[mapping.prefNumKey];
                    cbEl.checked = prefVal !== false;
                }
            }
        }
    });

    const directSelects = [
        { id: 'token-pref-bar-position', key: 'barPosition', fallback: 'bottom' },
        { id: 'token-pref-name-position', key: 'namePosition', fallback: 'top' },
        { id: 'token-pref-bar-height', key: 'barHeight', fallback: '8' },
        { id: 'token-pref-temp-hp-style', key: 'tempHpBarStyle', fallback: 'stacked' },
        { id: 'token-pref-flight-position', key: 'flightPosition', fallback: 'inside-tl' },
        { id: 'token-pref-condition-position', key: 'conditionPosition', fallback: 'inside-tr' },
        { id: 'token-pref-condition-orientation', key: 'conditionOrientation', fallback: 'horizontal' }
    ];

    directSelects.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el) {
            const val =
                prefsState.playerTokenPrefs[item.key] !== undefined
                    ? String(prefsState.playerTokenPrefs[item.key])
                    : item.fallback;
            el.value = val;
        }
    });

    const fitCb = document.getElementById('token-pref-nameplate-fit');
    if (fitCb) {
        fitCb.checked = prefsState.playerTokenPrefs.nameplateFitWidth !== false;
    }

    const damageFxCb = document.getElementById('token-pref-damage-fx-enabled');
    if (damageFxCb) {
        damageFxCb.checked = prefsState.playerTokenPrefs.damageFxEnabled !== false;
    }

    const indicator = document.getElementById('token-gm-limit-indicator');
    if (indicator) {
        if (anyLocked) {
            indicator.innerHTML =
                '<i class="fa-solid fa-lock" style="color:var(--color-gold-base);"></i> GM Ceiling Enforced';
        } else {
            indicator.textContent = 'Table Ceilings Active';
        }
    }

    updateTokenPreviewMockup(prefsState);
}

export function updateTokenPreviewMockup(prefsState) {
    if (typeof document === 'undefined') return;
    const wrapper = document.getElementById('token-preview-mockup-wrapper');
    if (!wrapper) return;

    const prefs = prefsState.playerTokenPrefs || {};
    const barPos = prefs.barPosition || 'bottom';
    const namePos = prefs.namePosition || 'top';
    const barHeight = Number(prefs.barHeight || 8);
    const flightPos = prefs.flightPosition || 'inside-tl';
    const condPos = prefs.conditionPosition || 'inside-tr';
    const condOrientation = prefs.conditionOrientation || 'horizontal';
    const nameFit = prefs.nameplateFitWidth !== false;
    const tempStyle = prefs.tempHpBarStyle || 'stacked';

    const hpPct = 64;

    let nameStyle = nameFit
        ? 'position:absolute; left:4px; right:4px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:10px; font-weight:bold; padding:2px 4px; border-radius:4px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; z-index:4;'
        : 'position:absolute; left:50%; transform:translateX(-50%); width:max-content; max-width:140px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:10px; font-weight:bold; padding:2px 4px; border-radius:4px; text-align:center; white-space:nowrap; overflow:visible; text-overflow:clip; pointer-events:none; z-index:4;';
    let barStyle = `position:absolute; left:4px; right:4px; height:${barHeight}px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:${Math.min(4, Math.floor(barHeight / 2))}px; overflow:hidden; z-index:2;`;
    let tempWrapperStyle = `position:absolute; left:4px; right:4px; height:${barHeight}px; overflow:hidden; z-index:3;`;
    let numStyle = `position:absolute; left:50%; transform:translateX(-50%); color:white; font-size:${Math.min(10, Math.max(8, barHeight - 1))}px; line-height:${barHeight}px; font-weight:bold; text-shadow:0 0 2px black, 0 0 3px black; white-space:nowrap; pointer-events:none; z-index:5;`;

    if (namePos === 'above' && barPos === 'above') {
        barStyle += `top: -${barHeight + 3}px; bottom:auto;`;
        tempWrapperStyle += `top: -${barHeight + 3}px; bottom:auto;`;
        nameStyle += `top: -${barHeight + 22}px; bottom:auto;`;
        numStyle += `top: -${barHeight + 3}px; bottom:auto;`;
    } else if (namePos === 'below' && barPos === 'below') {
        barStyle += `top: calc(100% + 4px); bottom:auto;`;
        tempWrapperStyle += `top: calc(100% + 4px); bottom:auto;`;
        nameStyle += `top: calc(100% + ${barHeight + 7}px); bottom:auto;`;
        numStyle += `top: calc(100% + 4px); bottom:auto;`;
    } else if (namePos === 'top' && barPos === 'top') {
        nameStyle += `top: 3px; bottom:auto;`;
        barStyle += `top: 22px; bottom:auto;`;
        tempWrapperStyle += `top: 22px; bottom:auto;`;
        numStyle += `top: 22px; bottom:auto;`;
    } else if (namePos === 'bottom' && barPos === 'bottom') {
        barStyle += `bottom: 3px; top:auto;`;
        tempWrapperStyle += `bottom: 3px; top:auto;`;
        nameStyle += `bottom: ${barHeight + 6}px; top:auto;`;
        numStyle += `bottom: 3px; top:auto;`;
    } else {
        if (namePos === 'above') nameStyle += 'top: -20px; bottom:auto;';
        else if (namePos === 'top') nameStyle += 'top: 3px; bottom:auto;';
        else if (namePos === 'bottom') nameStyle += 'bottom: 3px; top:auto;';
        else if (namePos === 'below') nameStyle += 'top: calc(100% + 4px); bottom:auto;';

        if (barPos === 'above') {
            barStyle += `top: -${barHeight + 3}px; bottom:auto;`;
            tempWrapperStyle += `top: -${barHeight + 3}px; bottom:auto;`;
            numStyle += `top: -${barHeight + 3}px; bottom:auto;`;
        } else if (barPos === 'top') {
            barStyle += `top: 3px; bottom:auto;`;
            tempWrapperStyle += `top: 3px; bottom:auto;`;
            numStyle += `top: 3px; bottom:auto;`;
        } else if (barPos === 'bottom') {
            barStyle += `bottom: 3px; top:auto;`;
            tempWrapperStyle += `bottom: 3px; top:auto;`;
            numStyle += `bottom: 3px; top:auto;`;
        } else if (barPos === 'below') {
            barStyle += `top: calc(100% + 4px); bottom:auto;`;
            tempWrapperStyle += `top: calc(100% + 4px); bottom:auto;`;
            numStyle += `top: calc(100% + 4px); bottom:auto;`;
        }
    }

    let flightStyle =
        'position:absolute; width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); color:white; display:flex; align-items:center; justify-content:center; gap:2px; box-shadow:0 2px 4px rgba(0,0,0,0.8); z-index:6;';
    if (flightPos === 'outside-tl') flightStyle += 'top: -12px; left: -12px;';
    else if (flightPos === 'outside-bl') flightStyle += 'bottom: -12px; left: -12px;';
    else flightStyle += 'top: 3px; left: 3px;';

    let condStyle = 'position:absolute; gap:3px; z-index:6; display:flex; pointer-events:none;';
    if (condPos === 'outside-tr')
        condStyle += `top: -12px; right: -12px; flex-direction:${condOrientation === 'vertical' ? 'column' : 'row'}; align-items:flex-start;`;
    else if (condPos === 'outside-br')
        condStyle += `bottom: -12px; right: -12px; flex-direction:${condOrientation === 'vertical' ? 'column' : 'row'}; align-items:flex-end;`;
    else
        condStyle += `top: 3px; right: 3px; flex-direction:${condOrientation === 'vertical' ? 'column' : 'row'}; align-items:flex-end;`;

    let hpFillStyle = `height:100%; width:${hpPct}%; background-color:var(--color-success-base); border-radius:2px; transition:width 0.3s ease;`;
    let tempFillStyle = `height:100%; width:35%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;`;

    if (tempStyle === 'appended') {
        barStyle += 'right:auto; width:calc(0.7 * (100% - 8px));';
        tempWrapperStyle +=
            'left:calc(4px + 0.7 * (100% - 8px)); width:calc(0.3 * (100% - 8px)); right:auto; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:3px;';
        tempFillStyle =
            'height:100%; width:100%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    } else if (tempStyle === 'split') {
        barStyle += 'right:auto; width:calc(0.5 * (100% - 8px));';
        tempWrapperStyle +=
            'left:50%; width:calc(0.5 * (100% - 8px)); right:auto; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:3px;';
        tempFillStyle =
            'height:100%; width:50%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    } else if (tempStyle === 'layered') {
        tempWrapperStyle += `bottom: ${barHeight + 6}px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:3px;`;
        tempFillStyle =
            'height:100%; width:50%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    } else {
        tempFillStyle =
            'height:100%; width:35%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    }

    wrapper.innerHTML = `
        <div style="position:relative; width:80px; height:80px; border-radius:50%; border:2px solid var(--color-gold-base); box-shadow:0 0 10px rgba(0,0,0,0.8), inset 0 0 8px rgba(0,0,0,0.6); background:radial-gradient(circle, #3a4454 0%, #151820 100%);">
            <div style="${nameStyle}">Acolyte</div>
            <div style="${flightStyle}">
                <i class="fa-solid fa-feather" style="font-size:8px;"></i>
                <span style="font-size:8px; font-weight:bold;">15</span>
            </div>
            <div style="${condStyle}">
                <div style="background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; color:white; font-size:8px;"><i class="fa-solid fa-brain"></i></div>
                <div style="background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; color:white; font-size:8px;"><i class="fa-solid fa-biohazard"></i></div>
            </div>
            <div style="${barStyle}">
                <div style="${hpFillStyle}"></div>
            </div>
            <div style="${tempWrapperStyle}">
                <div style="${tempFillStyle}"></div>
            </div>
            <div style="${numStyle}">18/28 (+10)</div>
        </div>
    `;
}

export function setupGmTokenSettingsControls(prefsState, options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        campaignSettings = {},
        syncHpSettingsInputs = () => {},
        renderAll = () => {}
    } = options;

    if (vtt.role !== 'GM') return;

    const directSelects = [
        { id: 'config-gm-bar-position', key: 'barPosition', type: 'select' },
        { id: 'config-gm-name-position', key: 'namePosition', type: 'select' },
        { id: 'config-gm-nameplate-fit', key: 'nameplateFitWidth', type: 'checkbox' },
        { id: 'config-gm-bar-height', key: 'barHeight', type: 'number' },
        { id: 'config-gm-temp-hp-style', key: 'tempHpBarStyle', type: 'select' },
        { id: 'config-gm-flight-position', key: 'flightPosition', type: 'select' },
        { id: 'config-gm-condition-position', key: 'conditionPosition', type: 'select' },
        { id: 'config-gm-condition-orientation', key: 'conditionOrientation', type: 'select' }
    ];

    directSelects.forEach((c) => {
        const el = document.getElementById(c.id);
        if (!el) return;
        el.addEventListener('change', () => {
            let val;
            if (c.type === 'checkbox') val = el.checked;
            else if (c.type === 'number') val = parseInt(el.value, 10) || 8;
            else val = el.value;

            prefsState.gmTokenPrefs[c.key] = val;
            saveGmTokenPrefs(prefsState.gmTokenPrefs);
            syncGmTokenSettingsUI(prefsState, options);
            renderAll();
        });
    });

    const btnTactical = document.getElementById('btn-gm-token-preset-tactical');
    if (btnTactical) {
        btnTactical.addEventListener('click', () => {
            prefsState.gmTokenPrefs.barPosition = 'below';
            prefsState.gmTokenPrefs.namePosition = 'above';
            prefsState.gmTokenPrefs.nameplateFitWidth = true;
            prefsState.gmTokenPrefs.barHeight = 12;
            prefsState.gmTokenPrefs.flightPosition = 'outside-tl';
            prefsState.gmTokenPrefs.conditionPosition = 'outside-tr';
            prefsState.gmTokenPrefs.conditionOrientation = 'horizontal';
            prefsState.gmTokenPrefs.tempHpBarStyle = 'stacked';
            saveGmTokenPrefs(prefsState.gmTokenPrefs);
            syncGmTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }

    const btnMinimal = document.getElementById('btn-gm-token-preset-minimal');
    if (btnMinimal) {
        btnMinimal.addEventListener('click', () => {
            campaignSettings.gmMonsterHpBarVisible = 'hover';
            campaignSettings.gmMonsterNameVisible = 'hover';
            campaignSettings.gmPlayerHpBarVisible = 'hover';
            campaignSettings.gmPlayerNameVisible = 'hover';
            prefsState.gmTokenPrefs.barPosition = 'bottom';
            prefsState.gmTokenPrefs.namePosition = 'top';
            prefsState.gmTokenPrefs.nameplateFitWidth = true;
            prefsState.gmTokenPrefs.barHeight = 6;
            prefsState.gmTokenPrefs.flightPosition = 'inside-tl';
            prefsState.gmTokenPrefs.conditionPosition = 'inside-tr';
            prefsState.gmTokenPrefs.conditionOrientation = 'horizontal';
            saveGmTokenPrefs(prefsState.gmTokenPrefs);
            syncGmTokenSettingsUI(prefsState, options);
            syncHpSettingsInputs();
            if (vtt.socket) {
                vtt.socket.emit('settings:update', { settings: campaignSettings });
            }
            renderAll();
        });
    }

    const btnClassic = document.getElementById('btn-gm-token-preset-classic');
    if (btnClassic) {
        btnClassic.addEventListener('click', () => {
            prefsState.gmTokenPrefs.barPosition = 'bottom';
            prefsState.gmTokenPrefs.namePosition = 'top';
            prefsState.gmTokenPrefs.nameplateFitWidth = true;
            prefsState.gmTokenPrefs.barHeight = 8;
            prefsState.gmTokenPrefs.flightPosition = 'inside-tl';
            prefsState.gmTokenPrefs.conditionPosition = 'inside-tr';
            prefsState.gmTokenPrefs.conditionOrientation = 'horizontal';
            saveGmTokenPrefs(prefsState.gmTokenPrefs);
            syncGmTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }

    const btnReset = document.getElementById('btn-gm-token-preset-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            prefsState.gmTokenPrefs = { ...DEFAULT_GM_TOKEN_PREFS };
            saveGmTokenPrefs(prefsState.gmTokenPrefs);
            syncGmTokenSettingsUI(prefsState, options);
            renderAll();
        });
    }
}

export function syncGmTokenSettingsUI(prefsState, options = {}) {
    if (typeof document === 'undefined') return;
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {} } = options;
    if (vtt.role !== 'GM') return;
    prefsState.gmTokenPrefs = loadGmTokenPrefs();

    const directSelects = [
        { id: 'config-gm-bar-position', key: 'barPosition', fallback: 'bottom' },
        { id: 'config-gm-name-position', key: 'namePosition', fallback: 'top' },
        { id: 'config-gm-bar-height', key: 'barHeight', fallback: '8' },
        { id: 'config-gm-temp-hp-style', key: 'tempHpBarStyle', fallback: 'stacked' },
        { id: 'config-gm-flight-position', key: 'flightPosition', fallback: 'inside-tl' },
        { id: 'config-gm-condition-position', key: 'conditionPosition', fallback: 'inside-tr' },
        { id: 'config-gm-condition-orientation', key: 'conditionOrientation', fallback: 'horizontal' }
    ];

    directSelects.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el) {
            const val =
                prefsState.gmTokenPrefs[item.key] !== undefined
                    ? String(prefsState.gmTokenPrefs[item.key])
                    : item.fallback;
            el.value = val;
        }
    });

    const gmFitCb = document.getElementById('config-gm-nameplate-fit');
    if (gmFitCb) {
        gmFitCb.checked = prefsState.gmTokenPrefs.nameplateFitWidth !== false;
    }

    updateGmTokenPreviewMockup(prefsState);
}

export function updateGmTokenPreviewMockup(prefsState) {
    if (typeof document === 'undefined') return;
    const wrapper = document.getElementById('gm-token-preview-mockup-wrapper');
    if (!wrapper) return;

    const prefs = prefsState.gmTokenPrefs || {};
    const barPos = prefs.barPosition || 'bottom';
    const namePos = prefs.namePosition || 'top';
    const barHeight = Number(prefs.barHeight || 8);
    const flightPos = prefs.flightPosition || 'inside-tl';
    const condPos = prefs.conditionPosition || 'inside-tr';
    const condOrientation = prefs.conditionOrientation || 'horizontal';
    const nameFit = prefs.nameplateFitWidth !== false;
    const tempStyle = prefs.tempHpBarStyle || 'stacked';

    const hpPct = 63;

    let nameStyle = nameFit
        ? 'position:absolute; left:4px; right:4px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:10px; font-weight:bold; padding:2px 4px; border-radius:4px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; z-index:4;'
        : 'position:absolute; left:50%; transform:translateX(-50%); width:max-content; max-width:140px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:10px; font-weight:bold; padding:2px 4px; border-radius:4px; text-align:center; white-space:nowrap; overflow:visible; text-overflow:clip; pointer-events:none; z-index:4;';
    let barStyle = `position:absolute; left:4px; right:4px; height:${barHeight}px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:${Math.min(4, Math.floor(barHeight / 2))}px; overflow:hidden; z-index:2;`;
    let tempWrapperStyle = `position:absolute; left:4px; right:4px; height:${barHeight}px; overflow:hidden; z-index:3;`;
    let numStyle = `position:absolute; left:50%; transform:translateX(-50%); color:white; font-size:${Math.min(10, Math.max(8, barHeight - 1))}px; line-height:${barHeight}px; font-weight:bold; text-shadow:0 0 2px black, 0 0 3px black; white-space:nowrap; pointer-events:none; z-index:5;`;

    if (namePos === 'above' && barPos === 'above') {
        barStyle += `top: -${barHeight + 3}px; bottom:auto;`;
        tempWrapperStyle += `top: -${barHeight + 3}px; bottom:auto;`;
        nameStyle += `top: -${barHeight + 22}px; bottom:auto;`;
        numStyle += `top: -${barHeight + 3}px; bottom:auto;`;
    } else if (namePos === 'below' && barPos === 'below') {
        barStyle += `top: calc(100% + 4px); bottom:auto;`;
        tempWrapperStyle += `top: calc(100% + 4px); bottom:auto;`;
        nameStyle += `top: calc(100% + ${barHeight + 7}px); bottom:auto;`;
        numStyle += `top: calc(100% + 4px); bottom:auto;`;
    } else if (namePos === 'top' && barPos === 'top') {
        nameStyle += `top: 3px; bottom:auto;`;
        barStyle += `top: 22px; bottom:auto;`;
        tempWrapperStyle += `top: 22px; bottom:auto;`;
        numStyle += `top: 22px; bottom:auto;`;
    } else if (namePos === 'bottom' && barPos === 'bottom') {
        barStyle += `bottom: 3px; top:auto;`;
        tempWrapperStyle += `bottom: 3px; top:auto;`;
        nameStyle += `bottom: ${barHeight + 6}px; top:auto;`;
        numStyle += `bottom: 3px; top:auto;`;
    } else {
        if (namePos === 'above') nameStyle += 'top: -20px; bottom:auto;';
        else if (namePos === 'top') nameStyle += 'top: 3px; bottom:auto;';
        else if (namePos === 'bottom') nameStyle += 'bottom: 3px; top:auto;';
        else if (namePos === 'below') nameStyle += 'top: calc(100% + 4px); bottom:auto;';

        if (barPos === 'above') {
            barStyle += `top: -${barHeight + 3}px; bottom:auto;`;
            tempWrapperStyle += `top: -${barHeight + 3}px; bottom:auto;`;
            numStyle += `top: -${barHeight + 3}px; bottom:auto;`;
        } else if (barPos === 'top') {
            barStyle += `top: 3px; bottom:auto;`;
            tempWrapperStyle += `top: 3px; bottom:auto;`;
            numStyle += `top: 3px; bottom:auto;`;
        } else if (barPos === 'bottom') {
            barStyle += `bottom: 3px; top:auto;`;
            tempWrapperStyle += `bottom: 3px; top:auto;`;
            numStyle += `bottom: 3px; top:auto;`;
        } else if (barPos === 'below') {
            barStyle += `top: calc(100% + 4px); bottom:auto;`;
            tempWrapperStyle += `top: calc(100% + 4px); bottom:auto;`;
            numStyle += `top: calc(100% + 4px); bottom:auto;`;
        }
    }

    let flightStyle =
        'position:absolute; width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); color:white; display:flex; align-items:center; justify-content:center; gap:2px; box-shadow:0 2px 4px rgba(0,0,0,0.8); z-index:6;';
    if (flightPos === 'outside-tl') flightStyle += 'top: -12px; left: -12px;';
    else if (flightPos === 'outside-bl') flightStyle += 'bottom: -12px; left: -12px;';
    else flightStyle += 'top: 3px; left: 3px;';

    let condStyle = 'position:absolute; gap:3px; z-index:6; display:flex; pointer-events:none;';
    if (condPos === 'outside-tr')
        condStyle += `top: -12px; right: -12px; flex-direction:${condOrientation === 'vertical' ? 'column' : 'row'}; align-items:flex-start;`;
    else if (condPos === 'outside-br')
        condStyle += `bottom: -12px; right: -12px; flex-direction:${condOrientation === 'vertical' ? 'column' : 'row'}; align-items:flex-end;`;
    else
        condStyle += `top: 3px; right: 3px; flex-direction:${condOrientation === 'vertical' ? 'column' : 'row'}; align-items:flex-end;`;

    let hpFillStyle = `height:100%; width:${hpPct}%; background-color:var(--color-gold-base); border-radius:2px; transition:width 0.3s ease;`;
    let tempFillStyle = `height:100%; width:30%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;`;

    if (tempStyle === 'appended') {
        barStyle += 'right:auto; width:calc(0.7 * (100% - 8px));';
        tempWrapperStyle +=
            'left:calc(4px + 0.7 * (100% - 8px)); width:calc(0.3 * (100% - 8px)); right:auto; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:3px;';
        tempFillStyle =
            'height:100%; width:100%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    } else if (tempStyle === 'split') {
        barStyle += 'right:auto; width:calc(0.5 * (100% - 8px));';
        tempWrapperStyle +=
            'left:50%; width:calc(0.5 * (100% - 8px)); right:auto; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:3px;';
        tempFillStyle =
            'height:100%; width:50%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    } else if (tempStyle === 'layered') {
        tempWrapperStyle += `bottom: ${barHeight + 6}px; background:rgba(0,0,0,0.85); border:1px solid var(--color-border-subtle); border-radius:3px;`;
        tempFillStyle =
            'height:100%; width:50%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    } else {
        tempFillStyle =
            'height:100%; width:30%; background-color:var(--color-temphp-base, #007bff); border-radius:2px;';
    }

    wrapper.innerHTML = `
        <div style="position:relative; width:80px; height:80px; border-radius:50%; border:2px solid var(--color-danger-base, #c92a2a); box-shadow:0 0 10px rgba(0,0,0,0.8), inset 0 0 8px rgba(0,0,0,0.6); background:radial-gradient(circle, #442a2a 0%, #1a1010 100%);">
            <div style="${nameStyle}">Orc Raider</div>
            <div style="${flightStyle}">
                <i class="fa-solid fa-feather" style="font-size:8px;"></i>
                <span style="font-size:8px; font-weight:bold;">20</span>
            </div>
            <div style="${condStyle}">
                <div style="background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; color:white; font-size:8px;"><i class="fa-solid fa-fire"></i></div>
                <div style="background:rgba(0,0,0,0.85); border:1px solid var(--color-gold-base); border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; color:white; font-size:8px;"><i class="fa-solid fa-skull"></i></div>
            </div>
            <div style="${barStyle}">
                <div style="${hpFillStyle}"></div>
            </div>
            <div style="${tempWrapperStyle}">
                <div style="${tempFillStyle}"></div>
            </div>
            <div style="${numStyle}">22/35 (+8)</div>
        </div>
    `;
}

export function setupHpSettingsControls(options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        campaignSettings = {},
        renderAll = () => {}
    } = options;

    if (vtt.role !== 'GM') return;

    const controls = [
        { id: 'config-player-monster-hp-visible', key: 'playerMonsterHpBarVisible', type: 'select' },
        { id: 'config-player-monster-hp-num-visible', key: 'playerMonsterHpNumVisible', type: 'checkbox' },
        { id: 'config-player-monster-name-visible', key: 'playerMonsterNameVisible', type: 'select' },
        { id: 'config-player-player-hp-visible', key: 'playerPlayerHpBarVisible', type: 'select' },
        { id: 'config-player-player-hp-num-visible', key: 'playerPlayerHpNumVisible', type: 'checkbox' },
        { id: 'config-player-player-name-visible', key: 'playerPlayerNameVisible', type: 'select' },
        { id: 'config-player-temp-hp-visible', key: 'playerTempHpBarVisible', type: 'select' },
        { id: 'config-player-temp-hp-num-visible', key: 'playerTempHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-monster-hp-visible', key: 'gmMonsterHpBarVisible', type: 'select' },
        { id: 'config-gm-monster-hp-num-visible', key: 'gmMonsterHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-monster-name-visible', key: 'gmMonsterNameVisible', type: 'select' },
        { id: 'config-gm-player-hp-visible', key: 'gmPlayerHpBarVisible', type: 'select' },
        { id: 'config-gm-player-hp-num-visible', key: 'gmPlayerHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-player-name-visible', key: 'gmPlayerNameVisible', type: 'select' },
        { id: 'config-gm-temp-hp-visible', key: 'gmTempHpBarVisible', type: 'select' },
        { id: 'config-gm-temp-hp-num-visible', key: 'gmTempHpNumVisible', type: 'checkbox' },
        { id: 'config-temp-hp-style', key: 'tempHpBarStyle', type: 'select' }
    ];

    controls.forEach((c) => {
        const el = document.getElementById(c.id);
        if (!el) return;
        el.addEventListener('change', () => {
            const val = c.type === 'checkbox' ? el.checked : el.value;
            campaignSettings[c.key] = val;

            vtt.socket?.emit('settings:update', { settings: campaignSettings });
            renderAll();
        });
    });
}

export function syncHpSettingsInputs(options = {}) {
    if (typeof document === 'undefined') return;
    const { campaignSettings = {} } = options;
    const controls = [
        { id: 'config-player-monster-hp-visible', key: 'playerMonsterHpBarVisible', type: 'select' },
        { id: 'config-player-monster-hp-num-visible', key: 'playerMonsterHpNumVisible', type: 'checkbox' },
        { id: 'config-player-monster-name-visible', key: 'playerMonsterNameVisible', type: 'select' },
        { id: 'config-player-player-hp-visible', key: 'playerPlayerHpBarVisible', type: 'select' },
        { id: 'config-player-player-hp-num-visible', key: 'playerPlayerHpNumVisible', type: 'checkbox' },
        { id: 'config-player-player-name-visible', key: 'playerPlayerNameVisible', type: 'select' },
        { id: 'config-player-temp-hp-visible', key: 'playerTempHpBarVisible', type: 'select' },
        { id: 'config-player-temp-hp-num-visible', key: 'playerTempHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-monster-hp-visible', key: 'gmMonsterHpBarVisible', type: 'select' },
        { id: 'config-gm-monster-hp-num-visible', key: 'gmMonsterHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-monster-name-visible', key: 'gmMonsterNameVisible', type: 'select' },
        { id: 'config-gm-player-hp-visible', key: 'gmPlayerHpBarVisible', type: 'select' },
        { id: 'config-gm-player-hp-num-visible', key: 'gmPlayerHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-player-name-visible', key: 'gmPlayerNameVisible', type: 'select' },
        { id: 'config-gm-temp-hp-visible', key: 'gmTempHpBarVisible', type: 'select' },
        { id: 'config-gm-temp-hp-num-visible', key: 'gmTempHpNumVisible', type: 'checkbox' },
        { id: 'config-temp-hp-style', key: 'tempHpBarStyle', type: 'select' }
    ];

    controls.forEach((c) => {
        const el = document.getElementById(c.id);
        if (!el) return;
        const val = campaignSettings[c.key];
        if (val !== undefined) {
            if (c.type === 'checkbox') el.checked = !!val;
            else el.value = val;
        }
    });
}

export function setupSettingsAccordionBehavior() {
    if (typeof document === 'undefined') return;
    const accordions = document.querySelectorAll('#tab-config .config-accordion-section');
    accordions.forEach((acc) => {
        acc.addEventListener('toggle', () => {
            if (acc.open) {
                accordions.forEach((other) => {
                    if (other !== acc && other.open) {
                        other.open = false;
                    }
                });
            }
        });
    });
}
