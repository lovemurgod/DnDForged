import { renderAuraList } from './vtt-canvas-token-config.js';
import { LIGHTING_PRESETS } from '../vtt-canvas-lighting.js';

export { renderAuraList };

export function setupTokenEditModal(tokenModalState, options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        grid = { size: 50, scale: 1 },
        renderAll = () => {},
        parseMonsterVision = null
    } = options;

    const getTokens = () => (typeof options.getTokens === 'function' ? options.getTokens() : options.tokens || {});
    const getGrid = () => (typeof options.getGrid === 'function' ? options.getGrid() : options.grid || grid);

    const modal = document.getElementById('modal-token-edit');
    if (!modal) return;
    const cancel = document.getElementById('btn-token-edit-cancel');
    const submit = document.getElementById('btn-token-edit-submit');
    const btnDelete = document.getElementById('btn-token-edit-delete');
    const btnAddAura = document.getElementById('btn-token-add-aura');
    const tokenEditSizeSelect = document.getElementById('token-edit-size');
    const tokenEditCustomSizeFields = document.getElementById('token-edit-custom-size-fields');
    const tokenEditCustomWidth = document.getElementById('token-edit-custom-width');
    const tokenEditCustomHeight = document.getElementById('token-edit-custom-height');

    const updateCustomSizeVisibility = () => {
        if (tokenEditSizeSelect.value === 'custom') {
            tokenEditCustomSizeFields.classList.remove('vtt-hidden');
        } else {
            tokenEditCustomSizeFields.classList.add('vtt-hidden');
        }
    };
    tokenEditSizeSelect.addEventListener('change', updateCustomSizeVisibility);

    const tokenEditLightEnabledCb = document.getElementById('token-edit-light-enabled');
    const tokenLightSettingsPanel = document.getElementById('token-light-settings');
    tokenEditLightEnabledCb.addEventListener('change', () => {
        if (tokenEditLightEnabledCb.checked) {
            tokenLightSettingsPanel.classList.remove('vtt-hidden');
        } else {
            tokenLightSettingsPanel.classList.add('vtt-hidden');
        }
    });

    // 5e Light Presets & FX in Token Edit modal
    const tokenLightPresetSelect = document.getElementById('token-edit-light-preset');
    const tokenLightFxSelect = document.getElementById('token-edit-light-fx');
    const tokenLightFxOptionsPanel = document.getElementById('token-edit-light-fx-options');
    const tokenLightColor2GroupEl = document.getElementById('token-edit-light-color2-group');

    if (tokenLightPresetSelect) {
        tokenLightPresetSelect.addEventListener('change', () => {
            const pId = tokenLightPresetSelect.value;
            if (pId && pId !== 'custom' && LIGHTING_PRESETS[pId]) {
                const p = LIGHTING_PRESETS[pId];
                document.getElementById('token-edit-light-bright').value = p.bright;
                document.getElementById('token-edit-light-dim').value = p.dim;
                document.getElementById('token-edit-light-angle').value = p.angle;
                document.getElementById('token-edit-light-color').value = p.color;
                if (tokenLightFxSelect) tokenLightFxSelect.value = p.animationType || 'none';
                if (document.getElementById('token-edit-light-speed'))
                    document.getElementById('token-edit-light-speed').value = p.animationSpeed || 1.0;
                if (document.getElementById('token-edit-light-intensity'))
                    document.getElementById('token-edit-light-intensity').value = p.animationIntensity || 0.1;
                if (document.getElementById('token-edit-light-color2'))
                    document.getElementById('token-edit-light-color2').value = p.animationColor2 || '#ffe082';

                if (tokenLightFxOptionsPanel)
                    tokenLightFxOptionsPanel.classList.toggle('vtt-hidden', (p.animationType || 'none') === 'none');
                if (tokenLightColor2GroupEl)
                    tokenLightColor2GroupEl.classList.toggle('vtt-hidden', p.animationType !== 'color_shift');
            }
        });
    }

    if (tokenLightFxSelect) {
        tokenLightFxSelect.addEventListener('change', () => {
            const val = tokenLightFxSelect.value;
            if (tokenLightFxOptionsPanel) tokenLightFxOptionsPanel.classList.toggle('vtt-hidden', val === 'none');
            if (tokenLightColor2GroupEl) tokenLightColor2GroupEl.classList.toggle('vtt-hidden', val !== 'color_shift');
        });
    }

    // Visual FX Tab switching logic
    const tabBtnOverlay = document.getElementById('tab-btn-fx-overlay');
    const tabBtnVignette = document.getElementById('tab-btn-fx-vignette');
    const tabBtnShadow = document.getElementById('tab-btn-fx-shadow');

    const panelOverlay = document.getElementById('panel-fx-overlay');
    const panelVignette = document.getElementById('panel-fx-vignette');
    const panelShadow = document.getElementById('panel-fx-shadow');

    const switchFxTab = (activeTab, activePanel) => {
        [tabBtnOverlay, tabBtnVignette, tabBtnShadow].forEach((t) => t.classList.remove('active'));
        [panelOverlay, panelVignette, panelShadow].forEach((p) => p.classList.add('vtt-hidden'));

        activeTab.classList.add('active');
        activePanel.classList.remove('vtt-hidden');
    };

    tabBtnOverlay.addEventListener('click', () => switchFxTab(tabBtnOverlay, panelOverlay));
    tabBtnVignette.addEventListener('click', () => switchFxTab(tabBtnVignette, panelVignette));
    tabBtnShadow.addEventListener('click', () => switchFxTab(tabBtnShadow, panelShadow));

    // Visual FX UI Bindings: Color Overlay
    const overlayEnabledCb = document.getElementById('token-edit-fx-overlay-enabled');
    const overlayDetails = document.getElementById('fx-overlay-details');
    const overlayOpacitySlider = document.getElementById('token-edit-fx-overlay-opacity');
    const valOverlayOpacity = document.getElementById('val-fx-overlay-opacity');
    const overlayColorInput = document.getElementById('token-edit-fx-overlay-color');
    const overlaySwatches = document.querySelectorAll('.fx-overlay-swatches .swatch');

    // Visual FX UI Bindings: Vignette Frame
    const vignetteEnabledCb = document.getElementById('token-edit-fx-vignette-enabled');
    const vignetteDetails = document.getElementById('fx-vignette-details');
    const vignetteOpacitySlider = document.getElementById('token-edit-fx-vignette-opacity');
    const valVignetteOpacity = document.getElementById('val-fx-vignette-opacity');
    const vignetteColorInput = document.getElementById('token-edit-fx-vignette-color');
    const vignetteSwatches = document.querySelectorAll('.fx-vignette-swatches .swatch');

    // Visual FX UI Bindings: Floor Shadow
    const shadowEnabledCb = document.getElementById('token-edit-fx-shadow-enabled');
    const shadowDetails = document.getElementById('fx-shadow-details');
    const shadowBlurInput = document.getElementById('token-edit-fx-shadow-blur');
    const shadowOffsetInput = document.getElementById('token-edit-fx-shadow-offset');
    const shadowColorInput = document.getElementById('token-edit-fx-shadow-color');
    const shadowOpacitySlider = document.getElementById('token-edit-fx-shadow-opacity');
    const valShadowOpacity = document.getElementById('val-fx-shadow-opacity');

    // FX Details Toggle bindings
    const bindFxDetailToggle = (enabledCb, detailsDiv) => {
        enabledCb.addEventListener('change', () => {
            if (enabledCb.checked) {
                detailsDiv.classList.remove('vtt-hidden');
            } else {
                detailsDiv.classList.add('vtt-hidden');
            }
        });
    };
    bindFxDetailToggle(overlayEnabledCb, overlayDetails);
    bindFxDetailToggle(vignetteEnabledCb, vignetteDetails);
    bindFxDetailToggle(shadowEnabledCb, shadowDetails);

    // FX Sliders readouts sync
    overlayOpacitySlider.addEventListener('input', () => {
        valOverlayOpacity.textContent = `${Math.round(overlayOpacitySlider.value * 100)}%`;
    });
    vignetteOpacitySlider.addEventListener('input', () => {
        valVignetteOpacity.textContent = `${Math.round(vignetteOpacitySlider.value * 100)}%`;
    });
    shadowOpacitySlider.addEventListener('input', () => {
        valShadowOpacity.textContent = `${Math.round(shadowOpacitySlider.value * 100)}%`;
    });

    // FX Swatches sync row helpers
    const syncFxSwatchesRow = (swatchesList, pickerInput) => {
        swatchesList.forEach((sw) => {
            sw.addEventListener('click', () => {
                swatchesList.forEach((s) => s.classList.remove('active'));
                sw.classList.add('active');
                pickerInput.value = sw.dataset.color;
            });
        });
        pickerInput.addEventListener('input', () => {
            const hex = pickerInput.value.toLowerCase();
            swatchesList.forEach((sw) => {
                if (sw.dataset.color.toLowerCase() === hex) {
                    sw.classList.add('active');
                } else {
                    sw.classList.remove('active');
                }
            });
        });
    };
    syncFxSwatchesRow(overlaySwatches, overlayColorInput);
    syncFxSwatchesRow(vignetteSwatches, vignetteColorInput);

    btnAddAura.addEventListener('click', () => {
        const auras = tokenModalState.tempAurasList || (tokenModalState.tempAurasList = []);
        auras.forEach((a) => (a.isExpanded = false));
        auras.push({
            name: '',
            enabled: true,
            range: 10,
            shape: 'circle',
            style: 'both',
            opacity: 0.3,
            color: '#d4af37',
            isExpanded: true
        });
        renderAuraList(auras, options);

        const listContainer = document.getElementById('token-auras-list');
        setTimeout(() => {
            listContainer.scrollTop = listContainer.scrollHeight;
        }, 50);
    });

    const handleSave = (saveDefaults) => {
        const liveTokens = getTokens();
        const tokenId = tokenModalState.selectedTokenIdForEdit;
        if (!tokenId || !liveTokens[tokenId]) return;

        const name = document.getElementById('token-edit-name').value.trim();
        const hp = parseInt(document.getElementById('token-edit-hp').value) || 0;
        const maxHp = parseInt(document.getElementById('token-edit-max-hp').value) || 0;
        const tempHp = parseInt(document.getElementById('token-edit-temp-hp').value) || 0;
        const hpBarVisibleOverride = document.getElementById('token-edit-hp-visible').value;
        const hpNumVisibleOverride = document.getElementById('token-edit-hp-num-visible').value;
        const sizeSelection = document.getElementById('token-edit-size').value;
        const rawSight = parseInt(document.getElementById('token-edit-sight').value);
        const targetTok = liveTokens[tokenId];
        const sightRange = !isNaN(rawSight) ? rawSight : targetTok?.isPlayer ? 60 : 5;

        const lightEnabled = document.getElementById('token-edit-light-enabled').checked;
        const lightBright = parseInt(document.getElementById('token-edit-light-bright').value) || 0;
        const lightDim = parseInt(document.getElementById('token-edit-light-dim').value) || 0;
        const lightColor = document.getElementById('token-edit-light-color').value;

        // Save basic fields
        liveTokens[tokenId].name = name;
        liveTokens[tokenId].hp = hp;
        liveTokens[tokenId].maxHp = maxHp;
        liveTokens[tokenId].tempHp = tempHp;
        liveTokens[tokenId].hpBarVisibleOverride = hpBarVisibleOverride;
        liveTokens[tokenId].hpNumVisibleOverride = hpNumVisibleOverride;
        if (sizeSelection === 'custom') {
            const customWidth = parseInt(tokenEditCustomWidth.value) || 1;
            const customHeight = parseInt(tokenEditCustomHeight.value) || 1;
            liveTokens[tokenId].size = Math.max(customWidth, customHeight);
            liveTokens[tokenId].customWidth = customWidth;
            liveTokens[tokenId].customHeight = customHeight;
        } else {
            const size = parseFloat(sizeSelection) || 1;
            liveTokens[tokenId].size = size;
            delete liveTokens[tokenId].customWidth;
            delete liveTokens[tokenId].customHeight;
        }

        const targetToken = liveTokens[tokenId];
        if (targetToken.isAsset || Number.isFinite(targetToken.pixelWidth)) {
            const widthUnits = targetToken.customWidth || targetToken.size || 1;
            const heightUnits = targetToken.customHeight || targetToken.size || 1;
            const liveGrid = getGrid();
            const gridPx = (liveGrid.size || 50) * (liveGrid.scale || 1.0);
            targetToken.pixelWidth = widthUnits * gridPx;
            targetToken.pixelHeight = heightUnits * gridPx;
        }
        liveTokens[tokenId].sightRange = sightRange;
        liveTokens[tokenId].lightEnabled = lightEnabled;
        liveTokens[tokenId].lightBright = lightBright;
        liveTokens[tokenId].lightDim = lightDim;
        liveTokens[tokenId].lightColor = lightColor;
        liveTokens[tokenId].lightAngle = parseInt(document.getElementById('token-edit-light-angle')?.value) || 360;
        liveTokens[tokenId].lightRotation = parseInt(document.getElementById('token-edit-light-rotation')?.value) || 0;
        liveTokens[tokenId].lightAnimationType = document.getElementById('token-edit-light-fx')?.value || 'none';
        liveTokens[tokenId].lightAnimationSpeed =
            parseFloat(document.getElementById('token-edit-light-speed')?.value) || 1.0;
        liveTokens[tokenId].lightAnimationIntensity =
            parseFloat(document.getElementById('token-edit-light-intensity')?.value) || 0.1;
        liveTokens[tokenId].lightAnimationColor2 = document.getElementById('token-edit-light-color2')?.value || '#ffe082';

        const auras = tokenModalState.tempAurasList || [];
        liveTokens[tokenId].auras = auras.map((a) => {
            const { isExpanded, ...clean } = a;
            return clean;
        });

        if (auras.length > 0) {
            liveTokens[tokenId].auraEnabled = true;
            liveTokens[tokenId].auraRange = auras[0].range;
            liveTokens[tokenId].auraShape = auras[0].shape;
            liveTokens[tokenId].auraStyle = auras[0].style;
            liveTokens[tokenId].auraOpacity = auras[0].opacity;
            liveTokens[tokenId].auraColor = auras[0].color;
        } else {
            liveTokens[tokenId].auraEnabled = false;
        }

        liveTokens[tokenId].fxOverlayEnabled = overlayEnabledCb.checked;
        liveTokens[tokenId].fxOverlayOpacity = parseFloat(overlayOpacitySlider.value) || 0.3;
        liveTokens[tokenId].fxOverlayColor = overlayColorInput.value;

        liveTokens[tokenId].fxVignetteEnabled = vignetteEnabledCb.checked;
        liveTokens[tokenId].fxVignetteOpacity = parseFloat(vignetteOpacitySlider.value) || 0.6;
        liveTokens[tokenId].fxVignetteColor = vignetteColorInput.value;

        liveTokens[tokenId].fxShadowEnabled = shadowEnabledCb.checked;
        liveTokens[tokenId].fxShadowBlur = parseInt(shadowBlurInput.value) || 12;
        liveTokens[tokenId].fxShadowOffset = parseInt(shadowOffsetInput.value) || 4;
        liveTokens[tokenId].fxShadowColor = shadowColorInput.value;
        liveTokens[tokenId].fxShadowOpacity = parseFloat(shadowOpacitySlider.value) || 0.7;

        if (vtt.role === 'GM') {
            const layer = document.getElementById('token-edit-layer').value;
            liveTokens[tokenId].layer = layer;
        }

        const editedToken = liveTokens[tokenId];
        if (editedToken && editedToken.characterId) {
            const chars = vtt.campaignState?.characters;
            if (chars && chars[editedToken.characterId]) {
                const char = chars[editedToken.characterId];
                char.hpCurrent = editedToken.hp;
                char.hpMax = editedToken.maxHp;
                char.tempHp = editedToken.tempHp ?? 0;

                if (saveDefaults) {
                    char.tokenSize = editedToken.size;
                    if (editedToken.customWidth) char.tokenCustomWidth = editedToken.customWidth;
                    else delete char.tokenCustomWidth;
                    if (editedToken.customHeight) char.tokenCustomHeight = editedToken.customHeight;
                    else delete char.tokenCustomHeight;

                    char.tokenSight = editedToken.sightRange;
                    char.tokenAuras = editedToken.auras;
                    char.fxOverlayEnabled = editedToken.fxOverlayEnabled;
                    char.fxOverlayOpacity = editedToken.fxOverlayOpacity;
                    char.fxOverlayColor = editedToken.fxOverlayColor;
                    char.fxVignetteEnabled = editedToken.fxVignetteEnabled;
                    char.fxVignetteOpacity = editedToken.fxVignetteOpacity;
                    char.fxVignetteColor = editedToken.fxVignetteColor;
                    char.fxShadowEnabled = editedToken.fxShadowEnabled;
                    char.fxShadowBlur = editedToken.fxShadowBlur;
                    char.fxShadowOffset = editedToken.fxShadowOffset;
                    char.fxShadowColor = editedToken.fxShadowColor;
                    char.fxShadowOpacity = editedToken.fxShadowOpacity;
                    char.tokenLightEnabled = editedToken.lightEnabled;
                    char.tokenLightBright = editedToken.lightBright;
                    char.tokenLightDim = editedToken.lightDim;
                    char.tokenLightColor = editedToken.lightColor;
                    char.tokenLightAngle = editedToken.lightAngle;
                    char.tokenLightRotation = editedToken.lightRotation;
                    char.tokenLightAnimationType = editedToken.lightAnimationType;
                    char.tokenLightAnimationSpeed = editedToken.lightAnimationSpeed;
                    char.tokenLightAnimationIntensity = editedToken.lightAnimationIntensity;
                    char.tokenLightAnimationColor2 = editedToken.lightAnimationColor2;
                }

                if (vtt.socket) {
                    vtt.socket.emit('character:update', { character: char });
                }
                if (window.VTT?.playerSheet?.syncLiveHp) {
                    window.VTT.playerSheet.syncLiveHp(char.id, char.hpCurrent, char.hpMax, char.tempHp);
                }
            }
        } else if (saveDefaults && editedToken && (editedToken.monsterData || !editedToken.isPlayer)) {
            const wantsToSave = confirm(
                `"${editedToken.name}" is a Bestiary creature. Would you like to save it as a Custom NPC in your Campaign Library so these token defaults (size, sight, light, auras, effects) are preserved?`
            );
            if (wantsToSave) {
                const newId = `npc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const cleanMonster = editedToken.monsterData
                    ? JSON.parse(JSON.stringify(editedToken.monsterData))
                    : { name: editedToken.name };
                cleanMonster.name = editedToken.name;

                const newChar = {
                    id: newId,
                    name: editedToken.name,
                    isCustomNpc: true,
                    isGeneric: true,
                    isPlayer: false,
                    hpCurrent: editedToken.hp,
                    hpMax: editedToken.maxHp,
                    tempHp: editedToken.tempHp || 0,
                    tokenSize: editedToken.size,
                    tokenCustomWidth: editedToken.customWidth,
                    tokenCustomHeight: editedToken.customHeight,
                    tokenSight: editedToken.sightRange,
                    tokenImages: [{ url: editedToken.img || 'favicon.svg', name: 'Default Token', isDefault: true }],
                    activeTokenIndex: 0,
                    tokenAuras: editedToken.auras,
                    fxOverlayEnabled: editedToken.fxOverlayEnabled,
                    fxOverlayOpacity: editedToken.fxOverlayOpacity,
                    fxOverlayColor: editedToken.fxOverlayColor,
                    fxVignetteEnabled: editedToken.fxVignetteEnabled,
                    fxVignetteOpacity: editedToken.fxVignetteOpacity,
                    fxVignetteColor: editedToken.fxVignetteColor,
                    fxShadowEnabled: editedToken.fxShadowEnabled,
                    fxShadowBlur: editedToken.fxShadowBlur,
                    fxShadowOffset: editedToken.fxShadowOffset,
                    fxShadowColor: editedToken.fxShadowColor,
                    fxShadowOpacity: editedToken.fxShadowOpacity,
                    tokenLightEnabled: editedToken.lightEnabled,
                    tokenLightBright: editedToken.lightBright,
                    tokenLightDim: editedToken.lightDim,
                    tokenLightColor: editedToken.lightColor,
                    tokenLightAngle: editedToken.lightAngle,
                    tokenLightRotation: editedToken.lightRotation,
                    tokenLightAnimationType: editedToken.lightAnimationType,
                    tokenLightAnimationSpeed: editedToken.lightAnimationSpeed,
                    tokenLightAnimationIntensity: editedToken.lightAnimationIntensity,
                    tokenLightAnimationColor2: editedToken.lightAnimationColor2,
                    monsterData: cleanMonster
                };

                if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
                vtt.campaignState.characters[newId] = newChar;

                editedToken.characterId = newId;
                editedToken.isCustomNpc = true;
                editedToken.isPlayer = false;

                if (vtt.socket) {
                    vtt.socket.emit('character:update', { character: newChar });
                }
                if (window.VTT?.dataBridge?.renderCustomNpcList) {
                    window.VTT.dataBridge.renderCustomNpcList();
                }
            }
        }

        if (typeof window !== 'undefined' && window.emitTokenUpdates) {
            window.emitTokenUpdates(liveTokens);
        }

        if (saveDefaults && typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(`Token defaults saved for "${liveTokens[tokenId]?.name || 'token'}"`, 'success');
        }

        modal.classList.add('vtt-hidden');
        renderAll();
    };

    submit.addEventListener('click', () => handleSave(false));
    const btnSaveDefaults = document.getElementById('btn-token-edit-save-defaults');
    if (btnSaveDefaults) {
        btnSaveDefaults.addEventListener('click', () => handleSave(true));
    }

    const btnSyncSight = document.getElementById('btn-token-sync-sight');
    if (btnSyncSight) {
        btnSyncSight.addEventListener('click', () => {
            const tokenId = tokenModalState.selectedTokenIdForEdit;
            if (!tokenId) return;
            const liveTokens = getTokens();
            const t = liveTokens[tokenId];
            if (!t) return;
            let calculatedSight = 0;
            const char =
                t.characterId && vtt.campaignState?.characters?.[t.characterId]
                    ? vtt.campaignState.characters[t.characterId]
                    : null;
            const isPC = char && !char.isCompanion && !char.isCustomNpc && !char.monsterData;
            const parseVision =
                options.parseMonsterVision || (typeof window !== 'undefined' ? window.parseMonsterVision : null);

            if (char) {
                if (
                    char.senses &&
                    typeof char.senses === 'object' &&
                    !Array.isArray(char.senses) &&
                    (char.senses.darkvision ||
                        char.senses.devilSight ||
                        char.senses.blindsight ||
                        char.senses.truesight)
                ) {
                    calculatedSight = Math.max(
                        parseInt(char.senses.darkvision) || 0,
                        parseInt(char.senses.devilSight) || 0,
                        parseInt(char.senses.blindsight) || 0,
                        parseInt(char.senses.truesight) || 0
                    );
                } else if (char.monsterData && parseVision) {
                    calculatedSight = parseVision(char.monsterData);
                } else if (char.tokenSight !== undefined && char.tokenSight > 0) {
                    calculatedSight = parseInt(char.tokenSight) || 0;
                }
            } else if (t.monsterData && parseVision) {
                calculatedSight = parseVision(t.monsterData);
            }

            if (calculatedSight <= 0) {
                calculatedSight = isPC ? 60 : 5;
            }
            document.getElementById('token-edit-sight').value = calculatedSight;
        });
    }

    cancel.addEventListener('click', () => modal.classList.add('vtt-hidden'));

    btnDelete.addEventListener('click', () => {
        const tokenId = tokenModalState.selectedTokenIdForEdit;
        if (!tokenId) return;
        const liveTokens = getTokens();
        delete liveTokens[tokenId];
        if (window.VTT?.chatEngine) {
            window.VTT.chatEngine.removeFromInitiative(tokenId);
        }

        if (typeof window !== 'undefined' && window.emitTokenUpdates) {
            window.emitTokenUpdates(liveTokens);
        }
        modal.classList.add('vtt-hidden');
        renderAll();
    });
}

export function openTokenEditModal(tokenId, tokenModalState, options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        isTokenControlledByPlayer = () => true
    } = options;
    const liveTokens = typeof options.getTokens === 'function' ? options.getTokens() : options.tokens || {};

    if (!isTokenControlledByPlayer(liveTokens[tokenId])) {
        return;
    }

    tokenModalState.selectedTokenIdForEdit = tokenId;
    const token = liveTokens[tokenId];
    if (!token) return;

    document.getElementById('token-edit-title').textContent = `Edit Token: ${token.name}`;
    document.getElementById('token-edit-name').value = token.name;
    document.getElementById('token-edit-hp').value = token.hp;
    document.getElementById('token-edit-max-hp').value = token.maxHp;
    document.getElementById('token-edit-temp-hp').value = token.tempHp !== undefined ? token.tempHp : 0;
    document.getElementById('token-edit-hp-visible').value = token.hpBarVisibleOverride || 'default';
    document.getElementById('token-edit-hp-num-visible').value = token.hpNumVisibleOverride || 'default';
    if (token.customWidth || token.customHeight) {
        document.getElementById('token-edit-size').value = 'custom';
        document.getElementById('token-edit-custom-width').value = token.customWidth || token.size || 1;
        document.getElementById('token-edit-custom-height').value = token.customHeight || token.size || 1;
        document.getElementById('token-edit-custom-size-fields').classList.remove('vtt-hidden');
    } else {
        document.getElementById('token-edit-size').value = token.size;
        document.getElementById('token-edit-custom-width').value = token.size || 1;
        document.getElementById('token-edit-custom-height').value = token.size || 1;
        document.getElementById('token-edit-custom-size-fields').classList.add('vtt-hidden');
    }
    document.getElementById('token-edit-sight').value =
        token.sightRange !== undefined ? token.sightRange : token.isPlayer ? 60 : 5;
    document.getElementById('token-edit-sight').disabled = false;
    document.getElementById('token-edit-sight').title =
        "Sight distance in feet. Click 'Sync Sheet' to pull from sheet senses.";
    document.getElementById('token-edit-sight').style.opacity = '1';

    const btnSaveDefaults = document.getElementById('btn-token-edit-save-defaults');
    if (btnSaveDefaults) {
        const isBestiary = !token.characterId && (token.monsterData || !token.isPlayer);
        if (isBestiary) {
            btnSaveDefaults.innerHTML = '<i class="fa-solid fa-file-export"></i> Save as Custom NPC Defaults';
            btnSaveDefaults.title = 'Promote this Bestiary monster to a Custom NPC with these token defaults';
        } else {
            btnSaveDefaults.innerHTML = '<i class="fa-solid fa-save"></i> Save Token Defaults';
            btnSaveDefaults.title = 'Save these settings as defaults for this sheet';
        }
    }

    const isLightEnabled = token.lightEnabled || false;
    document.getElementById('token-edit-light-enabled').checked = isLightEnabled;
    document.getElementById('token-edit-light-bright').value = token.lightBright !== undefined ? token.lightBright : 20;
    document.getElementById('token-edit-light-dim').value = token.lightDim !== undefined ? token.lightDim : 40;
    document.getElementById('token-edit-light-color').value = token.lightColor || '#ffaa00';
    const tokenLightAngleEl = document.getElementById('token-edit-light-angle');
    const tokenLightRotEl = document.getElementById('token-edit-light-rotation');
    if (tokenLightAngleEl) tokenLightAngleEl.value = token.lightAngle !== undefined ? token.lightAngle : 360;
    if (tokenLightRotEl) tokenLightRotEl.value = token.lightRotation !== undefined ? token.lightRotation : 0;

    const tokenLightPresetEl = document.getElementById('token-edit-light-preset');
    if (tokenLightPresetEl) tokenLightPresetEl.value = 'custom';
    const tokenLightFxEl = document.getElementById('token-edit-light-fx');
    const tokenLightSpeedEl = document.getElementById('token-edit-light-speed');
    const tokenLightIntensityEl = document.getElementById('token-edit-light-intensity');
    const tokenLightColor2El = document.getElementById('token-edit-light-color2');
    const tokenLightFxOptions = document.getElementById('token-edit-light-fx-options');
    const tokenLightColor2Group = document.getElementById('token-edit-light-color2-group');

    const animType = token.lightAnimationType || 'none';
    if (tokenLightFxEl) tokenLightFxEl.value = animType;
    if (tokenLightSpeedEl)
        tokenLightSpeedEl.value = token.lightAnimationSpeed !== undefined ? token.lightAnimationSpeed : 1.0;
    if (tokenLightIntensityEl)
        tokenLightIntensityEl.value = token.lightAnimationIntensity !== undefined ? token.lightAnimationIntensity : 0.1;
    if (tokenLightColor2El) tokenLightColor2El.value = token.lightAnimationColor2 || '#ffe082';

    if (tokenLightFxOptions) tokenLightFxOptions.classList.toggle('vtt-hidden', animType === 'none');
    if (tokenLightColor2Group) tokenLightColor2Group.classList.toggle('vtt-hidden', animType !== 'color_shift');

    if (isLightEnabled) {
        document.getElementById('token-light-settings').classList.remove('vtt-hidden');
    } else {
        document.getElementById('token-light-settings').classList.add('vtt-hidden');
    }

    let parsedAuras = [];
    if (token.auras && Array.isArray(token.auras)) {
        parsedAuras = token.auras.map((a) => ({ ...a }));
    } else if (token.auraEnabled) {
        parsedAuras = [
            {
                range: token.auraRange !== undefined ? token.auraRange : 10,
                shape: token.auraShape || 'circle',
                style: token.auraStyle || 'both',
                opacity: token.auraOpacity !== undefined ? token.auraOpacity : 0.3,
                color: token.auraColor || '#d4af37'
            }
        ];
    }

    tokenModalState.tempAurasList = parsedAuras.map((a, i) => ({
        ...a,
        enabled: a.enabled !== undefined ? a.enabled : true,
        name: a.name || '',
        isExpanded: i === 0
    }));

    renderAuraList(tokenModalState.tempAurasList, options);

    // FX fields
    const overlayEnabledCb = document.getElementById('token-edit-fx-overlay-enabled');
    const overlayDetails = document.getElementById('fx-overlay-details');
    const overlayOpacitySlider = document.getElementById('token-edit-fx-overlay-opacity');
    const valOverlayOpacity = document.getElementById('val-fx-overlay-opacity');
    const overlayColorInput = document.getElementById('token-edit-fx-overlay-color');
    const overlaySwatches = document.querySelectorAll('.fx-overlay-swatches .swatch');

    const overlayEnabled = !!token.fxOverlayEnabled;
    overlayEnabledCb.checked = overlayEnabled;
    if (overlayEnabled) overlayDetails.classList.remove('vtt-hidden');
    else overlayDetails.classList.add('vtt-hidden');

    const overlayOpacity = token.fxOverlayOpacity !== undefined ? token.fxOverlayOpacity : 0.3;
    overlayOpacitySlider.value = overlayOpacity;
    valOverlayOpacity.textContent = `${Math.round(overlayOpacity * 100)}%`;

    const overlayColor = token.fxOverlayColor || '#007bff';
    overlayColorInput.value = overlayColor;
    overlaySwatches.forEach((sw) => {
        if (sw.dataset.color.toLowerCase() === overlayColor.toLowerCase()) {
            sw.classList.add('active');
        } else {
            sw.classList.remove('active');
        }
    });

    const vignetteEnabledCb = document.getElementById('token-edit-fx-vignette-enabled');
    const vignetteDetails = document.getElementById('fx-vignette-details');
    const vignetteOpacitySlider = document.getElementById('token-edit-fx-vignette-opacity');
    const valVignetteOpacity = document.getElementById('val-fx-vignette-opacity');
    const vignetteColorInput = document.getElementById('token-edit-fx-vignette-color');
    const vignetteSwatches = document.querySelectorAll('.fx-vignette-swatches .swatch');

    const vignetteEnabled = !!token.fxVignetteEnabled;
    vignetteEnabledCb.checked = vignetteEnabled;
    if (vignetteEnabled) vignetteDetails.classList.remove('vtt-hidden');
    else vignetteDetails.classList.add('vtt-hidden');

    const vignetteOpacity = token.fxVignetteOpacity !== undefined ? token.fxVignetteOpacity : 0.6;
    vignetteOpacitySlider.value = vignetteOpacity;
    valVignetteOpacity.textContent = `${Math.round(vignetteOpacity * 100)}%`;

    const vignetteColor = token.fxVignetteColor || '#000000';
    vignetteColorInput.value = vignetteColor;
    vignetteSwatches.forEach((sw) => {
        if (sw.dataset.color.toLowerCase() === vignetteColor.toLowerCase()) {
            sw.classList.add('active');
        } else {
            sw.classList.remove('active');
        }
    });

    const shadowEnabledCb = document.getElementById('token-edit-fx-shadow-enabled');
    const shadowDetails = document.getElementById('fx-shadow-details');
    const shadowBlurInput = document.getElementById('token-edit-fx-shadow-blur');
    const shadowOffsetInput = document.getElementById('token-edit-fx-shadow-offset');
    const shadowColorInput = document.getElementById('token-edit-fx-shadow-color');
    const shadowOpacitySlider = document.getElementById('token-edit-fx-shadow-opacity');
    const valShadowOpacity = document.getElementById('val-fx-shadow-opacity');

    const shadowEnabled = !!token.fxShadowEnabled;
    shadowEnabledCb.checked = shadowEnabled;
    if (shadowEnabled) shadowDetails.classList.remove('vtt-hidden');
    else shadowDetails.classList.add('vtt-hidden');

    shadowBlurInput.value = token.fxShadowBlur !== undefined ? token.fxShadowBlur : 12;
    shadowOffsetInput.value = token.fxShadowOffset !== undefined ? token.fxShadowOffset : 4;

    const shadowColor = token.fxShadowColor || '#000000';
    shadowColorInput.value = shadowColor;

    const shadowOpacity = token.fxShadowOpacity !== undefined ? token.fxShadowOpacity : 0.7;
    shadowOpacitySlider.value = shadowOpacity;
    valShadowOpacity.textContent = `${Math.round(shadowOpacity * 100)}%`;

    const tabBtnOverlay = document.getElementById('tab-btn-fx-overlay');
    const panelOverlay = document.getElementById('panel-fx-overlay');
    const tabBtnVignette = document.getElementById('tab-btn-fx-vignette');
    const panelVignette = document.getElementById('panel-fx-vignette');
    const tabBtnShadow = document.getElementById('tab-btn-fx-shadow');
    const panelShadow = document.getElementById('panel-fx-shadow');

    [tabBtnOverlay, tabBtnVignette, tabBtnShadow].forEach((t) => t.classList.remove('active'));
    [panelOverlay, panelVignette, panelShadow].forEach((p) => p.classList.add('vtt-hidden'));
    tabBtnOverlay.classList.add('active');
    panelOverlay.classList.remove('vtt-hidden');

    if (vtt.role === 'GM') {
        document.getElementById('token-edit-layer').value = token.layer || 'token';
    }

    document.getElementById('modal-token-edit').classList.remove('vtt-hidden');
}
