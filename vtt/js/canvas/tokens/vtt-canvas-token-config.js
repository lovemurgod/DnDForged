// DnDForged Token Configuration, Modal & Preferences Subsystem
// Manages token properties, multi-aura editing, HP/name visibility preferences, and splash showcase

export const DEFAULT_PLAYER_TOKEN_PREFS = {
    monsterHpBarVisible: 'default',
    monsterHpNumVisible: 'default',
    monsterNameVisible: 'default',
    playerHpBarVisible: 'default',
    playerHpNumVisible: 'default',
    playerNameVisible: 'default',
    tempHpBarVisible: 'default',
    tempHpNumVisible: 'default',
    tempHpBarStyle: 'stacked',
    barPosition: 'bottom', // 'above' | 'top' | 'bottom' | 'below'
    namePosition: 'top', // 'above' | 'top' | 'bottom' | 'below'
    nameplateFitWidth: true, // true: fit token width with ellipsis | false: natural expansion
    barHeight: 8, // 6 | 8 | 12
    flightPosition: 'inside-tl', // 'inside-tl' | 'outside-tl' | 'outside-bl'
    conditionPosition: 'inside-tr', // 'inside-tr' | 'outside-tr' | 'outside-br'
    conditionOrientation: 'horizontal', // 'horizontal' | 'vertical'
    damageFxEnabled: true // enable elemental canvas bursts & token shudder
};

export const DEFAULT_GM_TOKEN_PREFS = {
    barPosition: 'bottom', // 'above' | 'top' | 'bottom' | 'below'
    namePosition: 'top', // 'above' | 'top' | 'bottom' | 'below'
    nameplateFitWidth: true, // true: fit token width with ellipsis | false: natural expansion
    barHeight: 8, // 6 | 8 | 12
    tempHpBarStyle: 'stacked', // 'stacked' | 'layered' | 'appended' | 'split'
    flightPosition: 'inside-tl', // 'inside-tl' | 'outside-tl' | 'outside-bl'
    conditionPosition: 'inside-tr', // 'inside-tr' | 'outside-tr' | 'outside-br'
    conditionOrientation: 'horizontal', // 'horizontal' | 'vertical'
    damageFxEnabled: true
};

export const VISIBILITY_TIERS = { never: 0, hover: 1, always: 2 };

export function loadPlayerTokenPrefs(storageKey = 'vtt_token_display_preferences') {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                return { ...DEFAULT_PLAYER_TOKEN_PREFS, ...JSON.parse(raw) };
            }
        }
    } catch (e) {
        console.warn('Failed to load token display preferences:', e);
    }
    return { ...DEFAULT_PLAYER_TOKEN_PREFS };
}

export function savePlayerTokenPrefs(prefs, storageKey = 'vtt_token_display_preferences') {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(prefs));
        }
    } catch (e) {
        console.warn('Failed to save token display preferences:', e);
    }
}

export function loadGmTokenPrefs(storageKey = 'vtt_gm_token_display_preferences') {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                return { ...DEFAULT_GM_TOKEN_PREFS, ...JSON.parse(raw) };
            }
        }
    } catch (e) {
        console.warn('Failed to load GM token display preferences:', e);
    }
    return { ...DEFAULT_GM_TOKEN_PREFS };
}

export function saveGmTokenPrefs(prefs, storageKey = 'vtt_gm_token_display_preferences') {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(prefs));
        }
    } catch (e) {
        console.warn('Failed to save GM token display preferences:', e);
    }
}

export function getEffectiveVisibility(playerPref, gmSetting) {
    const gmLimit = gmSetting ?? 'always';
    const maxTier = VISIBILITY_TIERS[gmLimit] ?? 2;
    if (!playerPref || playerPref === 'default') {
        return gmLimit;
    }
    const prefTier = VISIBILITY_TIERS[playerPref] ?? maxTier;
    const effectiveTier = Math.min(prefTier, maxTier);
    for (const [k, v] of Object.entries(VISIBILITY_TIERS)) {
        if (v === effectiveTier) return k;
    }
    return 'never';
}

export function getEffectiveNumberVisible(playerPref, gmSetting) {
    const gmAllowed = gmSetting !== false;
    if (!gmAllowed) return false;
    if (playerPref === 'default' || playerPref === undefined) return true;
    return !!playerPref;
}

export function renderAuraList(tempAurasList, options = {}) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('token-auras-list');
    if (!container) return;

    container.innerHTML = '';

    if (!tempAurasList || tempAurasList.length === 0) {
        container.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 20px; font-style: italic; background: rgba(0,0,0,0.1); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.06);">
                No active auras configured for this token.
            </div>
        `;
        return;
    }

    tempAurasList.forEach((aura, idx) => {
        if (aura.enabled === undefined) aura.enabled = true;
        const isEnabled = aura.enabled !== false;
        const auraName = aura.name || '';
        const range = aura.range !== undefined ? aura.range : 10;
        const shape = aura.shape || 'circle';
        const style = aura.style || 'both';
        const opacity = aura.opacity !== undefined ? aura.opacity : 0.3;
        const color = aura.color || '#d4af37';
        const isExpanded = !!aura.isExpanded;

        const card = document.createElement('div');
        card.className = 'aura-item-card glass-flat';
        card.style.border = '1px solid rgba(255,255,255,0.06)';
        card.style.borderRadius = '6px';
        card.style.padding = '10px';
        card.style.background = isEnabled ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
        card.style.opacity = isEnabled ? '1' : '0.7';
        card.dataset.index = idx;

        card.innerHTML = `
            <div class="aura-item-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; font-size: 0.75rem; color: var(--color-text-muted); ${isExpanded ? 'transform: rotate(90deg);' : ''}"></i>
                    <label class="aura-toggle-wrapper" style="margin: 0; display: flex; align-items: center; cursor: pointer;" title="${isEnabled ? 'Disable Aura' : 'Enable Aura'}">
                        <input type="checkbox" class="aura-enable-toggle" ${isEnabled ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-gold-base);">
                    </label>
                    <span class="aura-title-text" style="font-size: 0.8rem; font-weight: bold; color: ${isEnabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${auraName ? `<strong>${auraName}</strong>` : `Aura ${idx + 1}`}: <span style="font-weight: normal; opacity: 0.85;">${range}ft ${shape.charAt(0).toUpperCase() + shape.slice(1)}</span>
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                    <span class="swatch-preview" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 1px solid rgba(255,255,255,0.2); opacity: ${isEnabled ? '1' : '0.4'};"></span>
                    <button type="button" class="btn-delete-aura btn btn-icon btn-danger btn-xxs" style="padding: 2px 4px; font-size: 0.7rem; border-radius: 4px;" title="Delete Aura">
                        <i class="fa-solid fa-trash pointer-events-none"></i>
                    </button>
                </div>
            </div>
            
            <div class="aura-item-details ${isExpanded ? '' : 'vtt-hidden'}" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Label / Name (e.g. Spirit Guardians)</label>
                    <input type="text" class="aura-name-input" placeholder="e.g. Spirit Guardians, Paladin Aura" value="${auraName}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                </div>
                <div class="flex-row">
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Range (ft)</label>
                        <input type="number" class="aura-range-input" min="5" max="150" step="5" value="${range}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                    </div>
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Shape</label>
                        <select class="aura-shape-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                            <option value="circle" ${shape === 'circle' ? 'selected' : ''}>Circle (Radial)</option>
                            <option value="square" ${shape === 'square' ? 'selected' : ''}>Square (Bounding Box)</option>
                        </select>
                    </div>
                </div>
                <div class="flex-row" style="margin-top: 8px;">
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Render Style</label>
                        <select class="aura-style-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                            <option value="both" ${style === 'both' ? 'selected' : ''}>Filled & Border</option>
                            <option value="fill" ${style === 'fill' ? 'selected' : ''}>Fill Only</option>
                            <option value="border" ${style === 'border' ? 'selected' : ''}>Border Only</option>
                        </select>
                    </div>
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Opacity</label>
                        <input type="range" class="aura-opacity-slider" min="0.05" max="1.0" step="0.05" value="${opacity}" style="width: 100%;">
                    </div>
                </div>
                <div class="form-group" style="margin-top: 8px; margin-bottom: 0;">
                    <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Color</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="color" class="aura-color-picker" value="${color}" style="width: 28px; height: 28px; border: none; padding: 0; background: none; cursor: pointer;">
                        <div class="aura-swatches" style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${['#d4af37', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#ffffff']
                                .map(
                                    (c) => `
                                <span class="swatch ${c.toLowerCase() === color.toLowerCase() ? 'active' : ''}" data-color="${c}" style="width: 18px; height: 18px; border-radius: 4px; background: ${c}; cursor: pointer; border: 1px solid rgba(255,255,255,0.2);"></span>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event binding
        const header = card.querySelector('.aura-item-header');
        const details = card.querySelector('.aura-item-details');
        const chevron = card.querySelector('.aura-chevron');
        const toggle = card.querySelector('.aura-enable-toggle');
        const btnDelete = card.querySelector('.btn-delete-aura');

        header.addEventListener('click', (e) => {
            if (e.target.closest('.aura-toggle-wrapper') || e.target.closest('.btn-delete-aura')) return;
            const expanded = details.classList.toggle('vtt-hidden');
            aura.isExpanded = !expanded;
            chevron.style.transform = !expanded ? 'rotate(90deg)' : '';
        });

        toggle.addEventListener('change', (e) => {
            aura.enabled = toggle.checked;
            renderAuraList(tempAurasList, options);
        });

        btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            tempAurasList.splice(idx, 1);
            renderAuraList(tempAurasList, options);
        });

        const nameInput = card.querySelector('.aura-name-input');
        const rangeInput = card.querySelector('.aura-range-input');
        const shapeSelect = card.querySelector('.aura-shape-select');
        const styleSelect = card.querySelector('.aura-style-select');
        const opacitySlider = card.querySelector('.aura-opacity-slider');
        const colorPicker = card.querySelector('.aura-color-picker');
        const titleText = card.querySelector('.aura-title-text');
        const swatchPreview = card.querySelector('.swatch-preview');

        const updateAuraTitle = () => {
            const r = aura.range !== undefined ? aura.range : 10;
            const s = aura.shape || 'circle';
            const n = aura.name || '';
            titleText.innerHTML = `${n ? `<strong>${n}</strong>` : `Aura ${idx + 1}`}: <span style="font-weight: normal; opacity: 0.85;">${r}ft ${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
        };

        nameInput.addEventListener('input', () => {
            aura.name = nameInput.value.trim();
            updateAuraTitle();
        });
        rangeInput.addEventListener('input', () => {
            aura.range = Math.max(5, parseInt(rangeInput.value) || 5);
            updateAuraTitle();
        });
        shapeSelect.addEventListener('change', () => {
            aura.shape = shapeSelect.value;
            updateAuraTitle();
        });
        styleSelect.addEventListener('change', () => {
            aura.style = styleSelect.value;
        });
        opacitySlider.addEventListener('input', () => {
            aura.opacity = parseFloat(opacitySlider.value) || 0.3;
        });
        colorPicker.addEventListener('input', () => {
            aura.color = colorPicker.value;
            swatchPreview.style.background = colorPicker.value;
            card.querySelectorAll('.aura-swatches .swatch').forEach((sw) => {
                sw.classList.toggle('active', sw.dataset.color.toLowerCase() === colorPicker.value.toLowerCase());
            });
        });

        card.querySelectorAll('.aura-swatches .swatch').forEach((sw) => {
            sw.addEventListener('click', () => {
                const c = sw.dataset.color;
                aura.color = c;
                colorPicker.value = c;
                swatchPreview.style.background = c;
                card.querySelectorAll('.aura-swatches .swatch').forEach((s) => s.classList.remove('active'));
                sw.classList.add('active');
            });
        });

        container.appendChild(card);
    });
}

export function setupHpSettingsControls(options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        campaignSettings = {},
        syncPlayerTokenSettingsUI = () => {},
        syncGmTokenSettingsUI = () => {},
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
        { id: 'config-player-stat-tooltip-visible', key: 'playerStatTooltipVisible', type: 'select' },
        { id: 'config-gm-monster-hp-visible', key: 'gmMonsterHpBarVisible', type: 'select' },
        { id: 'config-gm-monster-hp-num-visible', key: 'gmMonsterHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-monster-name-visible', key: 'gmMonsterNameVisible', type: 'select' },
        { id: 'config-gm-player-hp-visible', key: 'gmPlayerHpBarVisible', type: 'select' },
        { id: 'config-gm-player-hp-num-visible', key: 'gmPlayerHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-player-name-visible', key: 'gmPlayerNameVisible', type: 'select' },
        { id: 'config-gm-temp-hp-visible', key: 'gmTempHpBarVisible', type: 'select' },
        { id: 'config-gm-temp-hp-num-visible', key: 'gmTempHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-stat-tooltip-visible', key: 'gmStatTooltipVisible', type: 'select' },
        { id: 'config-temp-hp-style', key: 'tempHpBarStyle', type: 'select' },
        { id: 'config-init-dex-tiebreaker', key: 'initDexTiebreaker', type: 'checkbox' }
    ];

    controls.forEach((c) => {
        const el = document.getElementById(c.id);
        if (!el) return;
        el.addEventListener('change', () => {
            const val = c.type === 'checkbox' ? el.checked : el.value;
            campaignSettings[c.key] = val;

            if (vtt.socket) {
                vtt.socket.emit('settings:update', { settings: campaignSettings });
            }
            syncPlayerTokenSettingsUI();
            syncGmTokenSettingsUI();
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
        { id: 'config-player-stat-tooltip-visible', key: 'playerStatTooltipVisible', type: 'select' },
        { id: 'config-gm-monster-hp-visible', key: 'gmMonsterHpBarVisible', type: 'select' },
        { id: 'config-gm-monster-hp-num-visible', key: 'gmMonsterHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-monster-name-visible', key: 'gmMonsterNameVisible', type: 'select' },
        { id: 'config-gm-player-hp-visible', key: 'gmPlayerHpBarVisible', type: 'select' },
        { id: 'config-gm-player-hp-num-visible', key: 'gmPlayerHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-player-name-visible', key: 'gmPlayerNameVisible', type: 'select' },
        { id: 'config-gm-temp-hp-visible', key: 'gmTempHpBarVisible', type: 'select' },
        { id: 'config-gm-temp-hp-num-visible', key: 'gmTempHpNumVisible', type: 'checkbox' },
        { id: 'config-gm-stat-tooltip-visible', key: 'gmStatTooltipVisible', type: 'select' },
        { id: 'config-temp-hp-style', key: 'tempHpBarStyle', type: 'select' },
        { id: 'config-init-dex-tiebreaker', key: 'initDexTiebreaker', type: 'checkbox' }
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

export function isSplashOverlayOpen() {
    if (typeof document === 'undefined') return false;
    const overlay = document.getElementById('vtt-splash-overlay');
    return overlay && !overlay.classList.contains('vtt-hidden');
}

export function closeSplashOverlay() {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('vtt-splash-overlay');
    if (!overlay) return;
    overlay.classList.add('vtt-hidden');
    const content = document.getElementById('vtt-splash-content');
    if (content) content.innerHTML = '';
}

export function showSplashOverlay(items) {
    if (typeof document === 'undefined') return;
    if (!items || !Array.isArray(items) || items.length === 0) return;

    const overlay = document.getElementById('vtt-splash-overlay');
    const content = document.getElementById('vtt-splash-content');
    if (!overlay || !content) return;

    content.innerHTML = '';

    if (items.length === 1) {
        const item = items[0];
        const card = document.createElement('div');
        card.className = 'vtt-splash-card';

        const mediaWrap = document.createElement('div');
        mediaWrap.className = `vtt-splash-media-wrap ${item.isCircle ? 'is-token-circle' : ''}`;

        const url = item.img || '';
        const isVideo = url.match(/\.(mp4|webm|ogg)($|\?)/i) || item.assetType === 'video';
        const ytMatch = url.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
        );

        if (ytMatch) {
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&controls=1`;
            iframe.allow = 'autoplay; encrypted-media; fullscreen';
            mediaWrap.appendChild(iframe);
        } else if (isVideo) {
            const video = document.createElement('video');
            video.src = url;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            mediaWrap.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = url;
            img.alt = item.name || 'Showcase Artwork';
            mediaWrap.appendChild(img);
        }

        const nameLabel = document.createElement('div');
        nameLabel.className = 'vtt-splash-label';
        nameLabel.textContent = item.name || '';

        card.appendChild(mediaWrap);
        card.appendChild(nameLabel);
        content.appendChild(card);
    } else {
        const grid = document.createElement('div');
        grid.className = 'vtt-splash-grid';

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'vtt-splash-grid-card';

            const mediaWrap = document.createElement('div');
            mediaWrap.className = `vtt-splash-grid-media-wrap ${item.isCircle ? 'is-token-circle' : ''}`;

            const url = item.img || '';
            const isVideo = url.match(/\.(mp4|webm|ogg)($|\?)/i) || item.assetType === 'video';

            if (isVideo) {
                const video = document.createElement('video');
                video.src = url;
                video.autoplay = true;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;
                mediaWrap.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = url;
                img.alt = item.name || 'Token';
                mediaWrap.appendChild(img);
            }

            const nameLabel = document.createElement('div');
            nameLabel.className = 'vtt-splash-grid-label';
            nameLabel.textContent = item.name || '';

            card.appendChild(mediaWrap);
            card.appendChild(nameLabel);
            grid.appendChild(card);
        });

        content.appendChild(grid);
    }

    overlay.classList.remove('vtt-hidden');
}

export function triggerSplashForSelection(specificTokenId = null, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        selectedTokenIds = new Set(),
        hoverTokenId = null
    } = options;

    let targetList = [];

    if (specificTokenId && tokens[specificTokenId]) {
        targetList = [tokens[specificTokenId]];
    } else if (selectedTokenIds.size > 0) {
        selectedTokenIds.forEach((id) => {
            if (tokens[id]) targetList.push(tokens[id]);
        });
    } else if (hoverTokenId && tokens[hoverTokenId]) {
        targetList = [tokens[hoverTokenId]];
    }

    if (targetList.length === 0) return;

    const items = [];
    targetList.forEach((t) => {
        if (!t || !t.img) return;
        const displayName = t.name || (t.isAsset ? 'Asset' : 'Token');
        const isCircle = !t.isAsset && !t.isBorderless;
        items.push({
            id: t.id,
            name: displayName,
            img: t.img,
            isAsset: !!t.isAsset,
            isPlayer: !!t.isPlayer,
            isCircle: isCircle,
            assetType: t.assetType || null
        });
    });

    if (items.length === 0) return;

    if (vtt.role === 'GM') {
        if (vtt.dataBridge && vtt.dataBridge.emitSplashShow) {
            vtt.dataBridge.emitSplashShow({ items });
        }
    }

    showSplashOverlay(items);
}
