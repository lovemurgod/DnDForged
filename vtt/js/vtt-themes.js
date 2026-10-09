/**
 * ForgeD VTT - Theme & Colorblind Accessibility Engine
 * Manages 11 rich atmospheric visual presets, 5 scientific colorblind accessibility modes,
 * WebGL 3D dice skin auto-synchronization, and real-time GM atmospheric broadcasts.
 */

export const THEMES = {
    classic: {
        id: 'classic',
        name: 'Classic Forge',
        category: 'Core Fantasy',
        description: 'Deep obsidian navy and warm forged gold with glassmorphism.',
        font: "'Open Sans', sans-serif",
        fontBadge: 'Open Sans',
        defaultDice: 'obsidian_gold',
        swatches: ['#0d1117', '#161b22', '#d4af37', '#e6edf3'],
        accentColor: '#d4af37'
    },
    jungle: {
        id: 'jungle',
        name: 'Jungle Canopy',
        category: 'Wilderness',
        description: 'Deep moss canopy, ancient bark, and bioluminescent emerald accents.',
        font: "'MedievalSharp', cursive, serif",
        fontBadge: 'MedievalSharp',
        defaultDice: 'jade_emerald',
        swatches: ['#09140c', '#122316', '#00e676', '#a7f3d0'],
        accentColor: '#00e676'
    },
    gothic: {
        id: 'gothic',
        name: 'Gothic Cathedral',
        category: 'Dark Fantasy',
        description: 'Cathedral shadows, dried crimson blood, and wrought iron silver.',
        font: "'Cinzel Decorative', 'Cinzel', serif",
        fontBadge: 'Cinzel Decorative',
        defaultDice: 'amethyst_void',
        swatches: ['#0d0b10', '#181320', '#e53935', '#f3e8ff'],
        accentColor: '#e53935'
    },
    celestial: {
        id: 'celestial',
        name: 'Celestial Astral',
        category: 'Cosmic',
        description: 'Deep cosmic void, astral starlight cyan, and ethereal pale gold.',
        font: "'Orbitron', sans-serif",
        fontBadge: 'Orbitron',
        defaultDice: 'sapphire_frost',
        swatches: ['#070a17', '#0f1730', '#00e5ff', '#ffd700'],
        accentColor: '#00e5ff'
    },
    hellscape: {
        id: 'hellscape',
        name: 'Hellscape Brimstone',
        category: 'Infernal',
        description: 'Scorched obsidian rock, molten lava orange, and sulfur yellow.',
        font: "'Rye', cursive",
        fontBadge: 'Rye',
        defaultDice: 'ruby_ember',
        swatches: ['#120806', '#22110c', '#ff5722', '#ffc107'],
        accentColor: '#ff5722'
    },
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Cyberpunk Arcane',
        category: 'Magitech',
        description: 'Neon magenta, electric cyan circuits, and glowing hex-grid runes.',
        font: "'Rajdhani', sans-serif",
        fontBadge: 'Rajdhani',
        defaultDice: 'sapphire_frost',
        swatches: ['#0b0718', '#160f30', '#ff007f', '#00f0ff'],
        accentColor: '#ff007f'
    },
    parchment: {
        id: 'parchment',
        name: 'Vintage Tome',
        category: 'Archival',
        description: 'Aged vellum, warm sepia, archival ink, and classic leather trim.',
        font: "'Alegreya', serif",
        fontBadge: 'Alegreya',
        defaultDice: 'classic_ivory',
        swatches: ['#1b1611', '#2c231a', '#d4af37', '#e8dfd1'],
        accentColor: '#d4af37'
    },
    abyssal: {
        id: 'abyssal',
        name: 'Abyssal Depths',
        category: 'Eldritch',
        description: 'Oceanic trench deep blue, kraken twilight, and bioluminescent sea-green.',
        font: "'Syne', sans-serif",
        fontBadge: 'Syne',
        defaultDice: 'abyssal_trench',
        swatches: ['#040f17', '#081d2a', '#00b4d8', '#72efdd'],
        accentColor: '#00b4d8'
    },
    feywild: {
        id: 'feywild',
        name: 'Feywild Enclave',
        category: 'Enchanted',
        description: 'Twilight violet, enchanted rose mist, and shimmering fairy turquoise.',
        font: "'Cinzel', serif",
        fontBadge: 'Cinzel',
        defaultDice: 'amethyst_void',
        swatches: ['#12091c', '#221235', '#f06292', '#80deea'],
        accentColor: '#f06292'
    },
    frostpeak: {
        id: 'frostpeak',
        name: 'Frostpeak Tundra',
        category: 'Glacial',
        description: 'Glacial slate, razor-sharp ice blue, and diamond frostbite borders.',
        font: "'Exo 2', sans-serif",
        fontBadge: 'Exo 2',
        defaultDice: 'sapphire_frost',
        swatches: ['#08121a', '#10222f', '#48cae4', '#e0f7fa'],
        accentColor: '#48cae4'
    },
    solaris: {
        id: 'solaris',
        name: 'Solaris Citadel',
        category: 'Radiant',
        description: 'Sunburst gold, radiant desert amber, and gleaming solar temple glow.',
        font: "'Cinzel', serif",
        fontBadge: 'Cinzel',
        defaultDice: 'solar_flare',
        swatches: ['#171106', '#2b1f0a', '#ffb703', '#fff3cd'],
        accentColor: '#ffb703'
    }
};

export const COLORBLIND_MODES = {
    none: {
        id: 'none',
        name: 'Standard Vision (Off)',
        description: 'Default vibrant tri-color palette (Emerald, Gold, Crimson) with Azure Temp HP.',
        preview: {
            success: 'hsl(145, 63%, 42%)',
            warning: 'hsl(43, 65%, 52%)',
            danger: 'hsl(354, 70%, 54%)',
            temphp: 'hsl(215, 90%, 55%)'
        }
    },
    protanopia: {
        id: 'protanopia',
        name: 'Protanopia (Red-Blind / Weak)',
        description: 'Calibrated Blue & Orange/Yellow contrast scale with dual-coded diagonal hatch patterns (HP ///, Temp HP \\\\\\).',
        preview: {
            success: '#0072b2',
            warning: '#f0e442',
            danger: '#d55e00',
            temphp: '#009e73'
        }
    },
    deuteranopia: {
        id: 'deuteranopia',
        name: 'Deuteranopia (Green-Blind / Weak)',
        description: 'Okabe-Ito Sky Blue & Amber contrast scale with high-visibility dual patterns (HP \\\\\\, Temp HP ///).',
        preview: {
            success: '#56b4e9',
            warning: '#e69f00',
            danger: '#d55e00',
            temphp: '#0072b2'
        }
    },
    tritanopia: {
        id: 'tritanopia',
        name: 'Tritanopia (Blue-Blind / Weak)',
        description: 'Teal-Cyan & Crimson contrast scale for blue-yellow vision deficiency (HP |||, Temp HP ≡).',
        preview: {
            success: '#009e73',
            warning: '#e69f00',
            danger: '#cc79a7',
            temphp: '#0072b2'
        }
    },
    achromatopsia: {
        id: 'achromatopsia',
        name: 'Achromatopsia (High Contrast)',
        description: 'Maximum luminance monochrome scale with solid border (HP) and dashed border (Temp HP).',
        preview: {
            success: '#ffffff',
            warning: '#9e9e9e',
            danger: '#333333',
            temphp: '#78909c'
        }
    }
};

export function initVttThemes(vtt) {
    let currentThemeId = localStorage.getItem('vtt_theme') || 'classic';
    let currentColorblindId = localStorage.getItem('vtt_colorblind_mode') || 'none';
    let syncDiceWithTheme = localStorage.getItem('vtt_theme_sync_dice') !== 'false'; // defaults to true

    // Initial DOM setup
    applyTheme(currentThemeId, false);
    applyColorblindMode(currentColorblindId);

    // Setup UI elements in Settings tab
    setupSettingsTabs();
    populateThemeSelector(currentThemeId);
    populateColorblindSelector(currentColorblindId);
    setupFontScaleControls();
    setupDiceSyncControls(syncDiceWithTheme);
    setupGmBroadcastControls(vtt);
    setupSocketListeners(vtt);

    const themeApi = {
        THEMES,
        COLORBLIND_MODES,
        getCurrentTheme: () => currentThemeId,
        getCurrentColorblindMode: () => currentColorblindId,
        getFontScale: () => parseFloat(localStorage.getItem('vtt_font_scale_v2')) || 1.0,
        setTheme: (id, syncDice = true) => applyTheme(id, syncDice),
        setColorblindMode: (id) => applyColorblindMode(id),
        setFontScale: (scale) => applyFontScale(scale, true),
        broadcastThemeToTable: (id) => broadcastTheme(vtt, id)
    };

    window.VTTThemes = themeApi;
    return themeApi;

    // --- Helper Functions ---

    function applyTheme(themeId, syncDice = true) {
        if (!THEMES[themeId]) themeId = 'classic';
        currentThemeId = themeId;

        // Apply HTML attribute for CSS rules
        document.documentElement.setAttribute('data-theme', themeId);
        localStorage.setItem('vtt_theme', themeId);

        // Update 3D Dice theme profile if engine available
        if (window.Dice3D) {
            if (typeof window.Dice3D.setThemeAudioProfile === 'function') {
                window.Dice3D.setThemeAudioProfile(themeId);
            }

            // If sync is enabled, update dice skin to match theme
            const isSyncEnabled = localStorage.getItem('vtt_theme_sync_dice') !== 'false';
            if (syncDice && isSyncEnabled) {
                const targetSkin = THEMES[themeId].defaultDice;
                if (targetSkin && window.Dice3D.SKINS && window.Dice3D.SKINS[targetSkin]) {
                    window.Dice3D.setSkin(targetSkin);
                    const diceSkinSelect = document.getElementById('config-3d-dice-skin');
                    if (diceSkinSelect) diceSkinSelect.value = targetSkin;
                }
            }
        }

        // Update live preview chip in settings panel
        updateThemePreviewChip(themeId);

        // Play subtle UI click
        if (window.Dice3D?.playUiClick) {
            window.Dice3D.playUiClick(700);
        }
    }

    function applyColorblindMode(modeId) {
        if (!COLORBLIND_MODES[modeId]) modeId = 'none';
        currentColorblindId = modeId;

        document.documentElement.setAttribute('data-colorblind', modeId);
        localStorage.setItem('vtt_colorblind_mode', modeId);

        updateColorblindPreview(modeId);

        if (window.Dice3D?.playUiClick) {
            window.Dice3D.playUiClick(620);
        }
    }

    function setupSettingsTabs() {
        const btnTabPref = document.getElementById('settings-subtab-preferences');
        const btnTabGm = document.getElementById('settings-subtab-gm');
        const panelPref = document.getElementById('settings-panel-preferences');
        const panelGm = document.getElementById('settings-panel-gm');

        if (!btnTabPref || !btnTabGm || !panelPref || !panelGm) return;

        btnTabPref.addEventListener('click', () => {
            btnTabPref.classList.add('active');
            btnTabGm.classList.remove('active');
            panelPref.classList.remove('vtt-hidden');
            panelGm.classList.add('vtt-hidden');
            if (window.Dice3D?.playUiClick) window.Dice3D.playUiClick(550);
        });

        btnTabGm.addEventListener('click', () => {
            btnTabGm.classList.add('active');
            btnTabPref.classList.remove('active');
            panelGm.classList.remove('vtt-hidden');
            panelPref.classList.add('vtt-hidden');
            if (window.Dice3D?.playUiClick) window.Dice3D.playUiClick(550);
        });
    }

    function populateThemeSelector(activeId) {
        const select = document.getElementById('config-visual-theme-select');
        if (!select) return;

        select.innerHTML = '';
        Object.values(THEMES).forEach(theme => {
            const opt = document.createElement('option');
            opt.value = theme.id;
            opt.textContent = `${theme.name} (${theme.category})`;
            if (theme.id === activeId) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            applyTheme(e.target.value, true);
        });

        updateThemePreviewChip(activeId);
    }

    function updateThemePreviewChip(themeId) {
        const theme = THEMES[themeId] || THEMES.classic;
        const chipContainer = document.getElementById('theme-preview-chip');
        if (!chipContainer) return;

        chipContainer.innerHTML = `
            <div class="theme-chip-swatches" title="Theme Color Palette">
                ${theme.swatches.map(c => `<span class="theme-swatch-dot" style="background:${c};"></span>`).join('')}
            </div>
            <div class="theme-chip-meta">
                <span class="theme-chip-font-badge" style="font-family:${theme.font};"><i class="fa-solid fa-font"></i> ${theme.fontBadge}</span>
                <span class="theme-chip-dice-badge"><i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${theme.defaultDice.replace('_', ' ')}</span>
            </div>
            <p class="theme-chip-desc text-muted">${theme.description}</p>
        `;
    }

    function populateColorblindSelector(activeId) {
        const select = document.getElementById('config-colorblind-select');
        if (!select) return;

        select.innerHTML = '';
        Object.values(COLORBLIND_MODES).forEach(mode => {
            const opt = document.createElement('option');
            opt.value = mode.id;
            opt.textContent = mode.name;
            if (mode.id === activeId) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            applyColorblindMode(e.target.value);
        });

        updateColorblindPreview(activeId);
    }

    function updateColorblindPreview(modeId) {
        const mode = COLORBLIND_MODES[modeId] || COLORBLIND_MODES.none;
        const previewContainer = document.getElementById('colorblind-preview-strip');
        if (!previewContainer) return;

        let hpPatternStyle = '';
        let tempHpPatternStyle = '';

        if (modeId === 'protanopia') {
            hpPatternStyle = 'background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.25) 4px, rgba(255, 255, 255, 0.25) 8px);';
            tempHpPatternStyle = 'background-image: repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.35) 4px, rgba(255, 255, 255, 0.35) 8px);';
        } else if (modeId === 'deuteranopia') {
            hpPatternStyle = 'background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.25) 5px, rgba(0, 0, 0, 0.25) 10px);';
            tempHpPatternStyle = 'background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.35) 4px, rgba(255, 255, 255, 0.35) 8px);';
        } else if (modeId === 'tritanopia') {
            hpPatternStyle = 'background-image: repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255, 255, 255, 0.25) 4px, rgba(255, 255, 255, 0.25) 8px);';
            tempHpPatternStyle = 'background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255, 255, 255, 0.35) 3px, rgba(255, 255, 255, 0.35) 6px);';
        } else if (modeId === 'achromatopsia') {
            hpPatternStyle = 'border: 1px solid #ffffff; background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255, 255, 255, 0.35) 3px, rgba(255, 255, 255, 0.35) 6px);';
            tempHpPatternStyle = 'border: 1px dashed #ffffff; background-image: repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255, 255, 255, 0.45) 3px, rgba(255, 255, 255, 0.45) 6px);';
        }

        previewContainer.innerHTML = `
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <div class="cb-preview-item">
                    <span class="cb-pill" style="background: ${mode.preview.success}; color: #fff;">
                        <i class="fa-solid fa-circle-check"></i> Healthy
                    </span>
                </div>
                <div class="cb-preview-item">
                    <span class="cb-pill" style="background: ${mode.preview.warning}; color: #000;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Wounded
                    </span>
                </div>
                <div class="cb-preview-item">
                    <span class="cb-pill" style="background: ${mode.preview.danger}; color: #fff;">
                        <i class="fa-solid fa-skull"></i> Critical
                    </span>
                </div>
                <div class="cb-preview-item">
                    <span class="cb-pill" style="background: ${mode.preview.temphp}; color: #fff;">
                        <i class="fa-solid fa-shield-heart"></i> Temp HP
                    </span>
                </div>
            </div>
            
            <div style="margin-top: 8px;">
                <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>Dual-Coded Token & Sheet HP Simulation:</span>
                    <span>HP (65%) + Temp HP (25%)</span>
                </div>
                <div style="display: flex; gap: 4px; align-items: center; height: 10px; background: rgba(0, 0, 0, 0.6); padding: 2px; border-radius: 4px; border: 1px solid var(--color-border-subtle);">
                    <div style="flex: 0 0 65%; height: 100%; border-radius: 2px; background-color: ${mode.preview.success}; ${hpPatternStyle}" title="Base HP Bar"></div>
                    <div style="flex: 0 0 25%; height: 100%; border-radius: 2px; background-color: ${mode.preview.temphp}; ${tempHpPatternStyle}" title="Temp HP Bar"></div>
                </div>
            </div>
        `;
    }

    function applyFontScale(scale, playSound = false) {
        const pct = Math.round(scale * 100);
        document.documentElement.style.setProperty('--vtt-font-scale', scale);
        document.documentElement.style.fontSize = `calc(15px * ${scale})`;
        localStorage.setItem('vtt_font_scale_v2', scale.toFixed(2));

        const badge = document.getElementById('config-font-scale-val');
        if (badge) badge.textContent = `${pct}%`;

        const slider = document.getElementById('config-font-scale-slider');
        if (slider && parseInt(slider.value, 10) !== pct) {
            slider.value = pct;
        }

        const presets = document.querySelectorAll('.font-scale-preset');
        presets.forEach(btn => {
            if (parseInt(btn.dataset.scale, 10) === pct) {
                btn.classList.add('active');
                btn.style.borderColor = 'var(--color-gold-base)';
                btn.style.color = 'var(--color-gold-light)';
            } else {
                btn.classList.remove('active');
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        });

        if (playSound && window.Dice3D?.playUiClick) {
            window.Dice3D.playUiClick(650);
        }
    }

    function setupFontScaleControls() {
        const slider = document.getElementById('config-font-scale-slider');
        const btnReset = document.getElementById('btn-reset-font-scale');
        const presets = document.querySelectorAll('.font-scale-preset');

        let savedScale = parseFloat(localStorage.getItem('vtt_font_scale_v2')) || 1.0;
        if (savedScale < 0.5 || savedScale > 2.2) savedScale = 1.0;

        applyFontScale(savedScale, false);

        if (slider) {
            slider.value = Math.round(savedScale * 100);
            slider.addEventListener('input', (e) => {
                const scaleVal = parseInt(e.target.value, 10) / 100;
                applyFontScale(scaleVal, true);
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                applyFontScale(1.0, true);
            });
        }

        presets.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPct = parseInt(btn.dataset.scale, 10);
                if (!isNaN(targetPct)) {
                    applyFontScale(targetPct / 100, true);
                }
            });
        });
    }

    function setupDiceSyncControls(isSyncInitially) {
        const syncCb = document.getElementById('config-dice-sync-theme');
        const diceSkinSelect = document.getElementById('config-3d-dice-skin');

        if (syncCb) {
            syncCb.checked = isSyncInitially;
            syncCb.addEventListener('change', (e) => {
                localStorage.setItem('vtt_theme_sync_dice', e.target.checked);
                if (e.target.checked) {
                    applyTheme(currentThemeId, true);
                }
            });
        }

        // When user manually picks a dice skin, disable auto-sync so their choice isn't overwritten
        if (diceSkinSelect && syncCb) {
            diceSkinSelect.addEventListener('change', () => {
                syncCb.checked = false;
                localStorage.setItem('vtt_theme_sync_dice', 'false');
            });
        }
    }

    function setupGmBroadcastControls(vtt) {
        const btnBroadcast = document.getElementById('btn-gm-broadcast-theme');
        if (btnBroadcast) {
            btnBroadcast.addEventListener('click', () => {
                broadcastTheme(vtt, currentThemeId);
            });
        }
    }

    function broadcastTheme(vtt, themeId) {
        if (vtt.role !== 'GM' || !vtt.socket) {
            if (window.VTT?.chatEngine?.appendSystemMessage) {
                window.VTT.chatEngine.appendSystemMessage("Only Game Masters can broadcast tabletop themes.");
            }
            return;
        }

        vtt.socket.emit('theme:broadcast', {
            themeId: themeId
        });

        const themeName = THEMES[themeId]?.name || themeId;
        if (window.VTT?.chatEngine?.appendSystemMessage) {
            window.VTT.chatEngine.appendSystemMessage(`Atmospheric Theme <strong>${themeName}</strong> broadcast to all players.`);
        }
    }

    function setupSocketListeners(vtt) {
        if (!vtt.socket) return;

        vtt.socket.on('theme:broadcasted', (data) => {
            if (vtt.role === 'GM') return; // GM already selected it
            const targetTheme = THEMES[data.themeId];
            if (!targetTheme) return;

            showBroadcastPrompt(targetTheme, data.gmName || 'The GM');
        });
    }

    function showBroadcastPrompt(theme, gmName) {
        // Remove existing prompt if any
        document.getElementById('vtt-theme-broadcast-banner')?.remove();

        const banner = document.createElement('div');
        banner.id = 'vtt-theme-broadcast-banner';
        banner.className = 'vtt-theme-broadcast-banner glassmorphism animated-fade-in';
        banner.innerHTML = `
            <div class="banner-icon">
                <i class="fa-solid fa-wand-magic-sparkles text-gradient-gold"></i>
            </div>
            <div class="banner-body">
                <strong>${gmName} shifted the tabletop atmosphere:</strong>
                <p>New theme: <strong style="color: ${theme.accentColor}">${theme.name}</strong></p>
            </div>
            <div class="banner-actions">
                <button id="btn-theme-banner-apply" class="btn btn-xs btn-primary">
                    <i class="fa-solid fa-check"></i> Apply
                </button>
                <button id="btn-theme-banner-dismiss" class="btn btn-xs btn-secondary">
                    Keep Mine
                </button>
            </div>
        `;

        document.body.appendChild(banner);

        document.getElementById('btn-theme-banner-apply')?.addEventListener('click', () => {
            applyTheme(theme.id, true);
            const select = document.getElementById('config-visual-theme-select');
            if (select) select.value = theme.id;
            banner.remove();
        });

        document.getElementById('btn-theme-banner-dismiss')?.addEventListener('click', () => {
            banner.remove();
        });

        // Auto-dismiss after 14 seconds
        setTimeout(() => {
            if (banner.parentElement) banner.remove();
        }, 14000);
    }
}
