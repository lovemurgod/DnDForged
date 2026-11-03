// DnDForged Canvas Token Context Menu Subsystem
// Handles right-click token action menus, Z-ordering, stat-based rolls, conditions, token selector art, and lighting presets

import {
    CONDITION_ICONS,
    getPcRollFormula,
    rollFromToken,
    showAddCustomConditionModal
} from './vtt-canvas-token-rollers.js';
import { showApplyDamageModal } from './vtt-canvas-mass-actions.js';
import { applyTokenLightingPreset } from '../vtt-canvas-lighting.js';

export function changeTokenZOrder(tokenId, action, options = {}) {
    const { tokens = {}, renderAll = () => {} } = options;

    const tokenList = Object.values(tokens);
    if (tokenList.length <= 1) return;

    const selectedToken = tokens[tokenId];
    if (!selectedToken) return;

    const otherZIndexes = tokenList.filter((t) => t.id !== tokenId).map((t) => t.zIndex || 0);

    const maxZ = otherZIndexes.length > 0 ? Math.max(...otherZIndexes) : 0;
    const minZ = otherZIndexes.length > 0 ? Math.min(...otherZIndexes) : 0;

    if (action === 'front') {
        selectedToken.zIndex = maxZ + 1;
    } else if (action === 'back') {
        selectedToken.zIndex = minZ - 1;
    } else if (action === 'front-one' || action === 'back-one') {
        const sortedTokens = [...tokenList].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        const curIdx = sortedTokens.findIndex((t) => t.id === tokenId);
        if (action === 'front-one') {
            if (curIdx < sortedTokens.length - 1) {
                const targetToken = sortedTokens[curIdx + 1];
                const temp = selectedToken.zIndex || 0;
                selectedToken.zIndex = targetToken.zIndex || 0;
                targetToken.zIndex = temp;
                if (selectedToken.zIndex === targetToken.zIndex) {
                    selectedToken.zIndex += 1;
                }
            }
        } else {
            if (curIdx > 0) {
                const targetToken = sortedTokens[curIdx - 1];
                const temp = selectedToken.zIndex || 0;
                selectedToken.zIndex = targetToken.zIndex || 0;
                targetToken.zIndex = temp;
                if (selectedToken.zIndex === targetToken.zIndex) {
                    selectedToken.zIndex -= 1;
                }
            }
        }
    }

    if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
        window.emitTokenUpdates(tokens);
    }
    renderAll();
}

export function showTokenContextMenu(tokenId, clientX, clientY, options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        selectedTokenIds = new Set(),
        campaignSettings = {},
        isMobileViewport = () => false,
        triggerSplashForSelection = () => {},
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        snapToGrid = (x, y) => ({ x, y }),
        renderAll = () => {},
        changeTokenZOrderFn = changeTokenZOrder,
        applyLightingPresetFn = applyTokenLightingPreset
    } = options;

    const oldMenu = document.getElementById('vtt-token-context-menu');
    if (oldMenu) oldMenu.remove();

    const token = tokens[tokenId];
    if (!token) return;

    let monsterData = token.monsterData;
    if (!monsterData && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
        const char = vtt.campaignState.characters[token.characterId];
        if ((char.isCompanion || char.isCustomNpc || char.monsterData) && char.monsterData) {
            monsterData = char.monsterData;
        }
    }

    const menu = document.createElement('div');
    menu.id = 'vtt-token-context-menu';
    menu.className = 'vtt-token-context-menu';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    const abilities = [
        { key: 'str', label: 'Strength' },
        { key: 'dex', label: 'Dexterity' },
        { key: 'con', label: 'Constitution' },
        { key: 'int', label: 'Intelligence' },
        { key: 'wis', label: 'Wisdom' },
        { key: 'cha', label: 'Charisma' }
    ];

    const skills = [
        { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
        { key: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
        { key: 'arcana', label: 'Arcana', ability: 'int' },
        { key: 'athletics', label: 'Athletics', ability: 'str' },
        { key: 'deception', label: 'Deception', ability: 'cha' },
        { key: 'history', label: 'History', ability: 'int' },
        { key: 'insight', label: 'Insight', ability: 'wis' },
        { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
        { key: 'investigation', label: 'Investigation', ability: 'int' },
        { key: 'medicine', label: 'Medicine', ability: 'wis' },
        { key: 'nature', label: 'Nature', ability: 'int' },
        { key: 'perception', label: 'Perception', ability: 'wis' },
        { key: 'performance', label: 'Performance', ability: 'cha' },
        { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
        { key: 'religion', label: 'Religion', ability: 'int' },
        { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
        { key: 'stealth', label: 'Stealth', ability: 'dex' },
        { key: 'survival', label: 'Survival', ability: 'wis' }
    ];

    let html = `
        <div class="vtt-token-menu-header">
            <i class="fa-solid fa-dice-d20"></i> ${token.name}
        </div>
        <div class="vtt-token-menu-item" id="menu-ctx-splash-art">
            <span><i class="fa-solid fa-expand item-icon"></i> Splash Art</span>
            <span style="font-size: 0.7rem; opacity: 0.7; font-family: monospace; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; margin-left: auto;">Shift+X</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-apply-damage">
            <span><i class="fa-solid fa-heart-crack item-icon"></i> Apply Damage</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-roll-init">
            <span><i class="fa-solid fa-swords item-icon"></i> Roll Initiative</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
    `;

    // 1. Ability Checks Submenu
    html += `
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-arrows-to-eye item-icon"></i> Ability Checks</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `;
    abilities.forEach((ab) => {
        const score = monsterData ? monsterData[ab.key] || 10 : 10;
        const mod = Math.floor((score - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const badgeStr = monsterData ? `<span class="modifier-badge">${modStr}</span>` : '';
        html += `
            <div class="vtt-submenu-item menu-roll-ability" data-ability="${ab.key}" data-label="${ab.label}">
                <span>${ab.label}</span>
                ${badgeStr}
            </div>
        `;
    });
    html += `
                </div>
            </div>
        </div>
    `;

    // 2. Saving Throws Submenu
    html += `
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-shield-halved item-icon"></i> Saving Throws</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `;
    abilities.forEach((ab) => {
        let mod = 0;
        if (monsterData) {
            const score = monsterData[ab.key] || 10;
            mod = Math.floor((score - 10) / 2);
            if (monsterData.save && monsterData.save[ab.key] !== undefined) {
                mod = parseInt(monsterData.save[ab.key]);
            }
        }
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const badgeStr = monsterData ? `<span class="modifier-badge">${modStr}</span>` : '';
        html += `
            <div class="vtt-submenu-item menu-roll-save" data-ability="${ab.key}" data-label="${ab.label}">
                <span>${ab.label}</span>
                ${badgeStr}
            </div>
        `;
    });
    html += `
                </div>
            </div>
        </div>
    `;

    // 3. Skill Checks Submenu
    html += `
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-wand-magic-sparkles item-icon"></i> Skill Checks</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `;
    skills.forEach((sk) => {
        let mod = 0;
        if (monsterData) {
            const score = monsterData[sk.ability] || 10;
            mod = Math.floor((score - 10) / 2);
            if (monsterData.skill && monsterData.skill[sk.key] !== undefined) {
                mod = parseInt(monsterData.skill[sk.key]);
            }
        }
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const badgeStr = monsterData ? `<span class="modifier-badge">${modStr}</span>` : '';
        html += `
            <div class="vtt-submenu-item menu-roll-skill" data-skill="${sk.key}" data-label="${sk.label}">
                <span>${sk.label}</span>
                ${badgeStr}
            </div>
        `;
    });
    html += `
                </div>
            </div>
        </div>
    `;

    // 3.4 Elevation
    const elevation = token.flightHeight || 0;
    html += `
        <div class="vtt-token-menu-item" style="cursor: default; display: flex; justify-content: space-between; align-items: center; padding-right: 8px;">
            <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Elevation</span>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button class="menu-btn-flight-dec" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                <input type="number" class="menu-input-flight" value="${elevation}" step="5" style="width: 40px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; text-align: center; border-radius: 4px; font-size: 12px; height: 20px; padding: 0;">
                <button class="menu-btn-flight-inc" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
        </div>
    `;

    // 3.5 Conditions Submenu
    html += `
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-heart-pulse item-icon"></i> Conditions</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-condition-gallery-container">
                    <div class="vtt-condition-gallery">
    `;

    const sortedConditions = Object.keys(CONDITION_ICONS).sort();
    const activeConditionsSet = new Set((token.conditions || []).map((c) => c.name));

    sortedConditions.forEach((condName) => {
        const iconClass = CONDITION_ICONS[condName];
        const isActive = activeConditionsSet.has(condName);

        html += `
            <button type="button" class="vtt-cond-tile menu-toggle-condition${isActive ? ' is-active' : ''}" data-cond="${condName}" title="${condName}">
                <i class="fa-solid ${iconClass}"></i>
            </button>
        `;
    });

    html += `
                    </div>
                    <div class="vtt-cond-footer-actions">
                        <button type="button" class="vtt-cond-action-btn btn-add-custom menu-add-custom-condition">
                            <i class="fa-solid fa-plus"></i> Add Custom Condition...
                        </button>
                        <button type="button" class="vtt-cond-action-btn btn-clear-all menu-clear-all-conditions">
                            <i class="fa-solid fa-trash-can"></i> Clear All Conditions
                        </button>
                    </div>
    `;

    if (token.conditions && token.conditions.some((c) => c.isCustom)) {
        html += `<div class="vtt-cond-custom-list">`;
        token.conditions.forEach((c, idx) => {
            if (c.isCustom) {
                html += `
                    <div class="vtt-cond-custom-chip menu-toggle-custom-condition" data-custom-idx="${idx}" title="Click to remove custom condition '${c.name}'">
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${c.color || 'var(--color-gold-base)'}; display: inline-block;"></span>
                            <span>${c.name}</span>
                        </span>
                        <i class="fa-solid fa-xmark" style="font-size: 10px;"></i>
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    html += `
                </div>
            </div>
        </div>
    `;

    // 3.6 Token Selector
    const charId = token.characterId || token.sourceCharacterId;
    const charSheet = charId && vtt.campaignState?.characters ? vtt.campaignState.characters[charId] : null;

    const availableTokens = [];
    const seenUrls = new Set();

    const addAvailableToken = (url, idx, isDefault = false, label = '') => {
        if (!url || typeof url !== 'string') return;
        const trimmed = url.trim();
        if (!trimmed || seenUrls.has(trimmed)) return;
        seenUrls.add(trimmed);
        availableTokens.push({
            url: trimmed,
            idx: idx,
            isDefault: isDefault,
            label: label
        });
    };

    const getMonsterTokenUrl = (monster) => {
        if (!monster) return null;
        if (monster.tokenImg) return monster.tokenImg;
        if (monster.tokenUrl) return monster.tokenUrl;
        if (monster.imgUrl) return monster.imgUrl;
        if (typeof window !== 'undefined' && window.Renderer?.monster?.getTokenUrl) {
            try {
                const rUrl = window.Renderer.monster.getTokenUrl(monster);
                if (rUrl) return rUrl;
            } catch (e) {}
        }
        if (monster.hasToken || monster.source || monster.name) {
            const cleanName =
                typeof window !== 'undefined' && window.Parser?.nameToTokenName
                    ? window.Parser.nameToTokenName(monster.name)
                    : (monster.name || '').replace(/"/g, '').trim();
            const source = monster.source || 'MM';
            return `img/bestiary/tokens/${source}/${cleanName}.webp`;
        }
        return vtt.generateArcaneToken ? vtt.generateArcaneToken(monster?.name || 'Creature', 'monster') : null;
    };

    let defaultTokenUrl = null;
    if (charSheet && (charSheet.isCompanion || charSheet.isCustomNpc || charSheet.monsterData)) {
        defaultTokenUrl = getMonsterTokenUrl(charSheet.monsterData || {});
    } else if (token.monsterData) {
        defaultTokenUrl = getMonsterTokenUrl(token.monsterData);
    } else if (charSheet && !charSheet.isPlayer && charSheet.monster) {
        defaultTokenUrl = getMonsterTokenUrl(charSheet.monster);
    }

    if (defaultTokenUrl) {
        addAvailableToken(defaultTokenUrl, -1, true, 'Default Token');
    }

    if (charSheet && charSheet.tokenImages && Array.isArray(charSheet.tokenImages)) {
        charSheet.tokenImages.forEach((imgObj, idx) => {
            const url = typeof imgObj === 'string' ? imgObj : imgObj?.url || '';
            addAvailableToken(
                url,
                idx,
                false,
                typeof imgObj === 'object' && imgObj?.name ? imgObj.name : 'Gallery Token'
            );
        });
    }

    if (token.tokenImages && Array.isArray(token.tokenImages)) {
        token.tokenImages.forEach((imgObj, idx) => {
            const url = typeof imgObj === 'string' ? imgObj : imgObj?.url || '';
            addAvailableToken(
                url,
                idx,
                false,
                typeof imgObj === 'object' && imgObj?.name ? imgObj.name : 'Token Gallery'
            );
        });
    }

    if (charSheet) {
        if (charSheet.tokenImage) addAvailableToken(charSheet.tokenImage, -2, false, 'Sheet Token');
        if (charSheet.avatar) addAvailableToken(charSheet.avatar, -3, false, 'Avatar');
        if (charSheet.avatarUrl) addAvailableToken(charSheet.avatarUrl, -4, false, 'Avatar');
        if (charSheet.img) addAvailableToken(charSheet.img, -5, false, 'Sheet Image');
    }

    if (token.img) addAvailableToken(token.img, -6, false, 'Current Canvas Art');
    if (token.url) addAvailableToken(token.url, -7, false, 'Current URL');

    if (availableTokens.length > 0) {
        let galleryHtml = '';
        availableTokens.forEach((tData) => {
            let isActive = false;
            if (
                charSheet &&
                charSheet.activeTokenIndex !== undefined &&
                charSheet.activeTokenIndex !== null &&
                charSheet.activeTokenIndex >= 0
            ) {
                isActive = charSheet.activeTokenIndex === tData.idx || token.img === tData.url;
            } else {
                isActive = token.img === tData.url;
            }

            const cleanUrl = (tData.url || '').split('?')[0].toLowerCase();
            const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i) || tData.url.includes('pinimg.com/videos');
            const isYt = tData.url.includes('youtube.com') || tData.url.includes('youtu.be');

            const borderStyle = `border: 2px solid ${isActive ? 'var(--color-success-base)' : 'rgba(255,255,255,0.2)'};`;
            const titleAttr = `${tData.label || (tData.isDefault ? 'Default Token' : 'Custom Token')}`;

            if (isVideo) {
                galleryHtml += `
                    <div class="menu-token-selector-item" data-idx="${tData.idx}" data-url="${tData.url}" title="${titleAttr}" style="width: 48px; height: 48px; position: relative; border-radius: 4px; overflow: hidden; cursor: pointer; ${borderStyle} background: #000; flex-shrink: 0;">
                        <video src="${tData.url}" autoplay muted loop playsinline preload="metadata" onloadeddata="this.play().catch(()=>{})" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"></video>
                        <span style="position: absolute; bottom: 1px; right: 2px; font-size: 9px; pointer-events: none; opacity: 0.85;">▶</span>
                    </div>`;
            } else if (isYt) {
                galleryHtml += `
                    <div class="menu-token-selector-item" data-idx="${tData.idx}" data-url="${tData.url}" title="${titleAttr}" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; ${borderStyle} background: #222; flex-shrink: 0;">
                        <span style="font-size: 20px; pointer-events: none;">📺</span>
                    </div>`;
            } else {
                galleryHtml += `
                    <div class="menu-token-selector-item" data-idx="${tData.idx}" data-url="${tData.url}" title="${titleAttr}" style="width: 48px; height: 48px; position: relative; border-radius: 4px; overflow: hidden; cursor: pointer; ${borderStyle} flex-shrink: 0;">
                        <img src="${tData.url}" alt="${titleAttr}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" onerror="this.parentElement.style.display='none'">
                    </div>`;
            }
        });

        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-images item-icon"></i> Token Selector</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled" style="width: 250px; padding: 12px; cursor: default; max-height: 400px; display: flex; gap: 8px; flex-wrap: wrap;">
                        ${galleryHtml}
                    </div>
                </div>
            </div>
        `;
    }

    // Equip Light Submenu
    html += `
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-fire item-icon" style="color: #ff9d3b;"></i> Equip Light</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu" style="min-width: 220px;">
                <div class="vtt-token-submenu-list scroll-styled">
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="torch">
                        <span>🔥 Torch (20/40 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="lantern_hooded">
                        <span>🏮 Hooded Lantern (30/60 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="lantern_bullseye">
                        <span>🔦 Bullseye Lantern (60/120 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="candle">
                        <span>🕯️ Candle (5/10 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="spell_light">
                        <span>✨ Light Spell (20/40 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="campfire">
                        <span>🏕️ Campfire (30/60 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="darkvision">
                        <span>👁️ Darkvision (60 ft)</span>
                    </div>
                    <div class="vtt-token-menu-divider"></div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="extinguish">
                        <span style="color: var(--color-danger);"><i class="fa-solid fa-ban"></i> Extinguish Light</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 4. Transform options (All Users)
    html += `
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item" id="menu-flip-h">
            <span><i class="fa-solid fa-arrows-left-right item-icon"></i> Flip Horizontally</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-flip-v">
            <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Flip Vertically</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-reset-rotation">
            <span><i class="fa-solid fa-rotate-left item-icon"></i> Reset Rotation</span>
        </div>
    `;

    // 5. Z-ordering (GM Only)
    if (vtt.role === 'GM') {
        html += `
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item" id="menu-move-front">
                <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Front</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-move-back">
                <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Back</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-move-front-one">
                <span><i class="fa-solid fa-angle-up item-icon"></i> Move Front One</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-move-back-one">
                <span><i class="fa-solid fa-angle-down item-icon"></i> Move Back One</span>
            </div>
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Layer</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu" style="min-width: 180px;">
                    <div class="vtt-token-submenu-list scroll-styled">
                        <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="token">
                            <span><i class="fa-solid fa-users" style="width: 16px; text-align: center; margin-right: 8px;"></i> Token Layer</span>
                        </div>
                        <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="gm">
                            <span><i class="fa-solid fa-user-secret" style="width: 16px; text-align: center; margin-right: 8px;"></i> GM Layer</span>
                        </div>
                        <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="map">
                            <span><i class="fa-solid fa-map" style="width: 16px; text-align: center; margin-right: 8px;"></i> Map Layer</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-sync item-icon"></i> Convert</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu" style="min-width: 220px;">
                    <div class="vtt-token-submenu-list scroll-styled">
                        <div class="vtt-submenu-item" id="menu-ctx-convert-freeform">
                            <span><i class="fa-solid fa-image" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Freeform Asset</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-ctx-convert-borderless">
                            <span><i class="fa-solid fa-circle" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Borderless Token</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-ctx-convert-bordered">
                            <span><i class="fa-solid fa-ring" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Bordered Token</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="vtt-token-menu-item text-danger" id="menu-ctx-delete" style="color: var(--color-danger);">
                <span><i class="fa-solid fa-trash item-icon"></i> Delete</span>
            </div>
        `;
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);

    const isMobile = isMobileViewport();
    const mobileBackdrop = document.getElementById('vtt-mobile-backdrop');

    if (isMobile) {
        menu.classList.add('mobile-modal-mode');
        if (mobileBackdrop) {
            mobileBackdrop.classList.add('active');
        }
    }

    const cleanupContextMenu = () => {
        if (mobileBackdrop) {
            mobileBackdrop.classList.remove('active');
            mobileBackdrop.removeEventListener('click', cleanupContextMenu);
            mobileBackdrop.removeEventListener('touchend', cleanupContextMenu);
        }
    };

    if (isMobile && mobileBackdrop) {
        mobileBackdrop.addEventListener('click', cleanupContextMenu);
        mobileBackdrop.addEventListener('touchend', cleanupContextMenu);
    }

    const originalMenuRemove = menu.remove.bind(menu);
    menu.remove = function () {
        cleanupContextMenu();
        originalMenuRemove();
    };

    if (isMobile) {
        menu.style.left = '50%';
        menu.style.top = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
    } else {
        const menuRect = menu.getBoundingClientRect();
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        let adjustedX = clientX;
        let adjustedY = clientY;
        if (clientX + menuRect.width > screenW) {
            adjustedX = screenW - menuRect.width - 10;
        }
        if (clientY + menuRect.height > screenH) {
            adjustedY = screenH - menuRect.height - 10;
        }
        adjustedX = Math.max(10, adjustedX);
        adjustedY = Math.max(10, adjustedY);
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;
    }

    // Splash Art
    const btnSplash = menu.querySelector('#menu-ctx-splash-art');
    if (btnSplash) {
        btnSplash.addEventListener('click', () => {
            triggerSplashForSelection(tokenId);
            menu.remove();
        });
    }

    // Apply Damage
    const btnApplyDamage = menu.querySelector('#menu-apply-damage');
    if (btnApplyDamage) {
        btnApplyDamage.addEventListener('click', () => {
            showApplyDamageModal([tokenId], options);
            menu.remove();
        });
    }

    // Initiative
    menu.querySelector('#menu-roll-init').addEventListener('click', (e) => {
        let formula = '';
        let dexScore = 10;
        if (monsterData) {
            dexScore = monsterData.dex || 10;
            let mod = Math.floor((dexScore - 10) / 2);
            if (monsterData.initiative !== undefined) {
                if (typeof monsterData.initiative === 'number') mod = monsterData.initiative;
                else if (typeof monsterData.initiative?.bonus === 'number') mod = monsterData.initiative.bonus;
            }
            formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
        } else if (token.isPlayer && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
            const char = vtt.campaignState.characters[token.characterId];
            if (char.isCustomNpc || char.monsterData) {
                dexScore = char.monsterData?.dex || 10;
                let mod = Math.floor((dexScore - 10) / 2);
                if (char.monsterData?.initiative !== undefined) {
                    if (typeof char.monsterData.initiative === 'number') mod = char.monsterData.initiative;
                    else if (typeof char.monsterData.initiative?.bonus === 'number')
                        mod = char.monsterData.initiative.bonus;
                }
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            } else {
                dexScore = char.stats?.dex || 10;
                formula = getPcRollFormula(char, 'initiative');
            }
        } else {
            const input =
                typeof prompt === 'function' ? prompt(`Enter Initiative Modifier for ${token.name}:`, '0') : '0';
            if (input === null) {
                menu.remove();
                return;
            }
            let mod = parseInt(input) || 0;
            formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
        }

        let dexTiebreaker = 0;
        if (campaignSettings.initDexTiebreaker !== false) {
            dexTiebreaker = Math.round(dexScore) / 100;
        }

        const label = `${token.name}: Initiative`;
        const resultTotal = rollFromToken(formula, label, tokenId, dexTiebreaker, { vtt, optEvent: e });

        if (typeof window !== 'undefined' && window.VTT?.chatEngine) {
            window.VTT.chatEngine.addToInitiative(token.name, resultTotal, tokenId);
        }
        menu.remove();
    });

    // Abilities
    menu.querySelectorAll('.menu-roll-ability').forEach((item) => {
        item.addEventListener('click', (e) => {
            const abKey = item.dataset.ability;
            const abLabel = item.dataset.label;
            let formula = '';
            if (monsterData) {
                const score = monsterData[abKey] || 10;
                let mod = Math.floor((score - 10) / 2);
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            } else if (token.isPlayer && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
                const char = vtt.campaignState.characters[token.characterId];
                formula = getPcRollFormula(char, 'ability', abKey);
            } else {
                const input = typeof prompt === 'function' ? prompt(`Enter modifier for ${abLabel} Check:`, '0') : '0';
                if (input === null) {
                    menu.remove();
                    return;
                }
                let mod = parseInt(input) || 0;
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            }
            const label = `${token.name}: ${abLabel.toUpperCase()} Check`;
            rollFromToken(formula, label, tokenId, 0, { vtt, optEvent: e });
            menu.remove();
        });
    });

    // Saves
    menu.querySelectorAll('.menu-roll-save').forEach((item) => {
        item.addEventListener('click', (e) => {
            const abKey = item.dataset.ability;
            const abLabel = item.dataset.label;
            let formula = '';
            if (monsterData) {
                const score = monsterData[abKey] || 10;
                let mod = Math.floor((score - 10) / 2);
                if (monsterData.save && monsterData.save[abKey] !== undefined) {
                    mod = parseInt(monsterData.save[abKey]);
                }
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            } else if (token.isPlayer && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
                const char = vtt.campaignState.characters[token.characterId];
                formula = getPcRollFormula(char, 'save', abKey);
            } else {
                const input = typeof prompt === 'function' ? prompt(`Enter modifier for ${abLabel} Save:`, '0') : '0';
                if (input === null) {
                    menu.remove();
                    return;
                }
                let mod = parseInt(input) || 0;
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            }
            const label = `${token.name}: ${abLabel.toUpperCase()} Saving Throw`;
            rollFromToken(formula, label, tokenId, 0, { vtt, optEvent: e });
            menu.remove();
        });
    });

    // Skills
    menu.querySelectorAll('.menu-roll-skill').forEach((item) => {
        item.addEventListener('click', (e) => {
            const skKey = item.dataset.skill;
            const skLabel = item.dataset.label;
            let formula = '';
            if (monsterData) {
                const skillObj = skills.find((s) => s.key === skKey);
                const score = monsterData[skillObj.ability] || 10;
                let mod = Math.floor((score - 10) / 2);
                if (monsterData.skill && monsterData.skill[skKey] !== undefined) {
                    mod = parseInt(monsterData.skill[skKey]);
                }
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            } else if (token.isPlayer && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
                const char = vtt.campaignState.characters[token.characterId];
                formula = getPcRollFormula(char, 'skill', skKey);
            } else {
                const input = typeof prompt === 'function' ? prompt(`Enter modifier for ${skLabel} Check:`, '0') : '0';
                if (input === null) {
                    menu.remove();
                    return;
                }
                let mod = parseInt(input) || 0;
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            }
            const label = `${token.name}: ${skLabel} Check`;
            rollFromToken(formula, label, tokenId, 0, { vtt, optEvent: e });
            menu.remove();
        });
    });

    // Elevation events
    const updateFlight = (newHeight) => {
        const activeToken = tokens[tokenId];
        if (!activeToken) return;
        activeToken.flightHeight = newHeight;
        if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
            window.emitTokenUpdates(tokens);
        }
        renderAll();
    };

    const btnFlightDec = menu.querySelector('.menu-btn-flight-dec');
    const btnFlightInc = menu.querySelector('.menu-btn-flight-inc');
    const inputFlight = menu.querySelector('.menu-input-flight');
    if (btnFlightDec && btnFlightInc && inputFlight) {
        btnFlightDec.addEventListener('click', (e) => {
            e.stopPropagation();
            let val = parseInt(inputFlight.value) || 0;
            val -= 5;
            inputFlight.value = val;
            updateFlight(val);
        });
        btnFlightInc.addEventListener('click', (e) => {
            e.stopPropagation();
            let val = parseInt(inputFlight.value) || 0;
            val += 5;
            inputFlight.value = val;
            updateFlight(val);
        });
        inputFlight.addEventListener('change', (e) => {
            e.stopPropagation();
            updateFlight(parseInt(inputFlight.value) || 0);
        });
        inputFlight.addEventListener('click', (e) => e.stopPropagation());
    }

    menu.querySelectorAll('.menu-toggle-condition').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const activeToken = tokens[tokenId];
            if (!activeToken) return;

            const condName = item.dataset.cond;
            if (!activeToken.conditions) activeToken.conditions = [];
            const existingIdx = activeToken.conditions.findIndex((c) => c.name === condName);

            if (existingIdx !== -1) {
                activeToken.conditions.splice(existingIdx, 1);
                item.classList.remove('is-active');
            } else {
                activeToken.conditions.push({ name: condName });
                item.classList.add('is-active');
            }

            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        });
    });

    const btnClearAll = menu.querySelector('.menu-clear-all-conditions');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', (e) => {
            e.stopPropagation();
            const activeToken = tokens[tokenId];
            if (!activeToken) return;
            activeToken.conditions = [];
            menu.querySelectorAll('.menu-toggle-condition').forEach((t) => t.classList.remove('is-active'));
            const customList = menu.querySelector('.vtt-cond-custom-list');
            if (customList) customList.remove();
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        });
    }

    const btnAddCustom = menu.querySelector('.menu-add-custom-condition');
    if (btnAddCustom) {
        btnAddCustom.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.remove();
            showAddCustomConditionModal(tokenId, { tokens, renderAll });
        });
    }

    menu.querySelectorAll('.menu-toggle-custom-condition').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const activeToken = tokens[tokenId];
            if (!activeToken || !activeToken.conditions) return;
            const idx = parseInt(item.dataset.customIdx);
            activeToken.conditions.splice(idx, 1);
            item.remove();
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        });
    });

    menu.querySelectorAll('.menu-token-selector-item, .menu-token-selector-img').forEach((itemEl) => {
        itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = itemEl.dataset.url || itemEl.getAttribute('data-url');
            const idx = parseInt(itemEl.dataset.idx || itemEl.getAttribute('data-idx') || '-1', 10);

            const t = tokens[tokenId];
            if (!t || !url) return;

            t.url = url;
            t.img = url;

            const cleanUrl = url.split('?')[0].toLowerCase();
            const isGif = cleanUrl.endsWith('.gif') || url.includes('.gif');
            t.isGif = isGif;
            t.isVideo =
                !isGif &&
                (!!cleanUrl.match(/\.(mp4|webm|ogg)$/i) ||
                    url.includes('youtube.com') ||
                    url.includes('pinimg.com/videos'));

            const targetCharId = t.characterId || t.sourceCharacterId;
            if (targetCharId && vtt.campaignState?.characters) {
                const char = vtt.campaignState.characters[targetCharId];
                if (char) {
                    if (idx >= 0 && Array.isArray(char.tokenImages) && idx < char.tokenImages.length) {
                        char.activeTokenIndex = idx;
                    }
                    char.tokenSize = t.size;
                    char.tokenSight = t.sightRange;
                    char.tokenAuras = t.auras;
                    char.fxOverlayEnabled = t.fxOverlayEnabled;
                    char.fxOverlayOpacity = t.fxOverlayOpacity;
                    char.fxOverlayColor = t.fxOverlayColor;
                    char.fxVignetteEnabled = t.fxVignetteEnabled;
                    char.fxVignetteOpacity = t.fxVignetteOpacity;
                    char.fxVignetteColor = t.fxVignetteColor;
                    char.fxShadowEnabled = t.fxShadowEnabled;
                    char.fxShadowBlur = t.fxShadowBlur;
                    char.fxShadowOffset = t.fxShadowOffset;
                    char.fxShadowColor = t.fxShadowColor;
                    char.fxShadowOpacity = t.fxShadowOpacity;
                    char.tokenLightEnabled = t.lightEnabled;
                    char.tokenLightBright = t.lightBright;
                    char.tokenLightDim = t.lightDim;
                    char.tokenLightColor = t.lightColor;

                    if (vtt.socket) {
                        vtt.socket.emit('character:update', { id: targetCharId, character: char });
                    }
                }
            }

            if (typeof window !== 'undefined' && window.VTT?.chatEngine?.updateCombatantTokenArt) {
                window.VTT.chatEngine.updateCombatantTokenArt(tokenId, url, targetCharId);
            } else if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                window.VTT.chatEngine.refreshInitiative();
            }

            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    });

    menu.querySelectorAll('.menu-ctx-equip-light').forEach((item) => {
        item.addEventListener('click', () => {
            const targetToken = tokens[tokenId];
            if (!targetToken) return;
            const preset = item.dataset.preset;
            if (preset === 'extinguish') {
                targetToken.lightEnabled = false;
            } else {
                applyLightingPresetFn(targetToken, preset);
            }
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    });

    const btnFlipH = menu.querySelector('#menu-flip-h');
    if (btnFlipH) {
        btnFlipH.addEventListener('click', () => {
            const t = tokens[tokenId];
            if (t) {
                t.flipX = !t.flipX;
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
            }
            menu.remove();
        });
    }

    const btnFlipV = menu.querySelector('#menu-flip-v');
    if (btnFlipV) {
        btnFlipV.addEventListener('click', () => {
            const t = tokens[tokenId];
            if (t) {
                t.flipY = !t.flipY;
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
            }
            menu.remove();
        });
    }

    const btnResetRot = menu.querySelector('#menu-reset-rotation');
    if (btnResetRot) {
        btnResetRot.addEventListener('click', () => {
            const targetIds = selectedTokenIds.has(tokenId) ? Array.from(selectedTokenIds) : [tokenId];
            targetIds.forEach((id) => {
                const t = tokens[id];
                if (t) t.rotation = 0;
            });
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    }

    if (vtt.role === 'GM') {
        menu.querySelector('#menu-move-front').addEventListener('click', () => {
            changeTokenZOrderFn(tokenId, 'front', options);
            menu.remove();
        });
        menu.querySelector('#menu-move-back').addEventListener('click', () => {
            changeTokenZOrderFn(tokenId, 'back', options);
            menu.remove();
        });
        menu.querySelector('#menu-move-front-one').addEventListener('click', () => {
            changeTokenZOrderFn(tokenId, 'front-one', options);
            menu.remove();
        });
        menu.querySelector('#menu-move-back-one').addEventListener('click', () => {
            changeTokenZOrderFn(tokenId, 'back-one', options);
            menu.remove();
        });
        menu.querySelectorAll('.menu-ctx-move-layer').forEach((item) => {
            item.addEventListener('click', () => {
                const targetLayer = item.dataset.layer;
                const targetIds = selectedTokenIds.has(tokenId) ? Array.from(selectedTokenIds) : [tokenId];
                targetIds.forEach((id) => {
                    if (tokens[id]) {
                        tokens[id].layer = targetLayer;
                        selectedTokenIds.delete(id);
                        if (window.VTT?.chatEngine?.updateCombatantLayer) {
                            window.VTT?.chatEngine?.updateCombatantLayer?.(id, targetLayer);
                        }
                    }
                });
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        });
        menu.querySelector('#menu-ctx-convert-freeform').addEventListener('click', () => {
            const { drawW, drawH } = getTokenDrawDimensions(token);
            token.isAsset = true;
            token.isBorderless = false;
            token.pixelWidth = drawW;
            token.pixelHeight = drawH;
            token.imgRadius = '0';
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
        menu.querySelector('#menu-ctx-convert-borderless').addEventListener('click', () => {
            token.isAsset = false;
            token.isBorderless = true;
            const snap = snapToGrid(token.x, token.y, true);
            token.x = snap.x;
            token.y = snap.y;
            token.size = 1;
            if (token.assetType === 'video' || (token.url && token.url.split('?')[0].toLowerCase().endsWith('.gif'))) {
                token.imgRadius = '50%';
            }
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
        menu.querySelector('#menu-ctx-convert-bordered').addEventListener('click', () => {
            token.isAsset = false;
            token.isBorderless = false;
            const snap = snapToGrid(token.x, token.y, true);
            token.x = snap.x;
            token.y = snap.y;
            token.size = 1;
            if (token.assetType === 'video' || (token.url && token.url.split('?')[0].toLowerCase().endsWith('.gif'))) {
                token.imgRadius = '50%';
            }
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
        menu.querySelector('#menu-ctx-delete').addEventListener('click', () => {
            delete tokens[tokenId];
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    }
}
