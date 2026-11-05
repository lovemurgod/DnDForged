// DnDForged Token Rolling & Saving Throws Subsystem
// Handles ability/skill/save roll formulas, d20 saving throw resolutions, condition modals, and chat cards

export const CONDITION_ICONS = {
    Advantage: 'fa-circle-up',
    Blinded: 'fa-eye-slash',
    Charmed: 'fa-heart',
    Concentration: 'fa-brain',
    Dead: 'fa-skull-crossbones',
    Deafened: 'fa-ear-deaf',
    Disadvantage: 'fa-circle-down',
    Dodge: 'fa-people-arrows',
    Exhaustion: 'fa-battery-empty',
    Frightened: 'fa-ghost',
    Grappled: 'fa-hand-fist',
    Hidden: 'fa-user-ninja',
    Incapacitated: 'fa-ban',
    Invisible: 'fa-mask',
    Paralyzed: 'fa-bolt',
    Petrified: 'fa-gem',
    Poisoned: 'fa-biohazard',
    Prone: 'fa-person-falling',
    Raging: 'fa-face-angry',
    Restrained: 'fa-link',
    Shielded: 'fa-user-shield',
    Stunned: 'fa-star',
    Targeted: 'fa-crosshairs',
    Unconscious: 'fa-skull'
};

export function getPcRollFormula(char, rollType, key) {
    if (!char) return '1d20';
    let baseMod = 0;
    let toggles = [];
    let globalMod = 0;
    const profBonus = Math.floor(((char.level || 1) - 1) / 4) + 2;

    const getMod = (score) => Math.floor(((score || 10) - 10) / 2);
    const stats = char.stats || {};

    if (rollType === 'initiative') {
        baseMod = getMod(stats.dex || 10);
        toggles = (char.skillToggles || []).filter(
            (t) => t.enabled && (t.target === 'all' || t.target === 'initiative')
        );
        globalMod = char.globalAbilityMod || '0';
    } else if (rollType === 'ability' || rollType === 'skill') {
        let abKey = key;
        if (rollType === 'skill') {
            const ALL_SKILLS = [
                { name: 'Acrobatics', ability: 'dex' },
                { name: 'Animal Handling', ability: 'wis' },
                { name: 'Arcana', ability: 'int' },
                { name: 'Athletics', ability: 'str' },
                { name: 'Deception', ability: 'cha' },
                { name: 'History', ability: 'int' },
                { name: 'Insight', ability: 'wis' },
                { name: 'Intimidation', ability: 'cha' },
                { name: 'Investigation', ability: 'int' },
                { name: 'Medicine', ability: 'wis' },
                { name: 'Nature', ability: 'int' },
                { name: 'Perception', ability: 'wis' },
                { name: 'Performance', ability: 'cha' },
                { name: 'Persuasion', ability: 'cha' },
                { name: 'Religion', ability: 'int' },
                { name: 'Sleight of Hand', ability: 'dex' },
                { name: 'Stealth', ability: 'dex' },
                { name: 'Survival', ability: 'wis' }
            ];
            const skillDef = ALL_SKILLS.find(
                (s) => s.name.toLowerCase() === (key || '').toLowerCase() || s.name.replace(/ /g, '_') === key
            );
            abKey = skillDef ? skillDef.ability : 'str';
            baseMod = getMod(stats[abKey] || 10);
            if (char.skills && skillDef && char.skills[skillDef.name]) baseMod += profBonus;
            if (char.expertise && skillDef && char.expertise[skillDef.name]) baseMod += profBonus;
            const customMod =
                char.skillMods && skillDef && char.skillMods[skillDef.name]
                    ? parseInt(char.skillMods[skillDef.name])
                    : 0;
            if (!isNaN(customMod)) baseMod += customMod;
        } else {
            baseMod = getMod(stats[key] || 10);
        }
        toggles = (char.skillToggles || []).filter((t) => t.enabled && (t.target === 'all' || t.target === key));
        globalMod = char.globalAbilityMod || '0';
    } else if (rollType === 'save') {
        baseMod = getMod(stats[key] || 10);
        if (char.saves && char.saves[key]) baseMod += profBonus;
        const customMod = char.saveMods && char.saveMods[key] ? parseInt(char.saveMods[key]) : 0;
        if (!isNaN(customMod)) baseMod += customMod;
        toggles = (char.saveToggles || []).filter((t) => t.enabled && (t.target === 'all' || t.target === key));
        globalMod = char.globalSaveMod || '0';
    }

    let toggleFormulaStr = '';
    toggles.forEach((t) => {
        if (!t || !t.formula) return;
        toggleFormulaStr += t.formula.startsWith('+') || t.formula.startsWith('-') ? t.formula : '+' + t.formula;
    });

    let modStr = baseMod >= 0 ? '+' + baseMod : String(baseMod);
    if (globalMod !== '0' && globalMod !== 0) {
        let gStr = String(globalMod);
        if (gStr.includes('d')) {
            modStr += gStr.startsWith('+') || gStr.startsWith('-') ? gStr : '+' + gStr;
        } else {
            const m = parseInt(globalMod) || 0;
            const newMod = baseMod + m;
            modStr = newMod >= 0 ? '+' + newMod : String(newMod);
        }
    }

    return `1d20${modStr}${toggleFormulaStr}`;
}

export function getTokenSaveMod(t, ability, options = {}) {
    if (!t || !ability) return 0;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        getResolvedCreatureMonsterData = (tok) => tok?.monsterData || null
    } = options;

    const ab = ability.toLowerCase();
    let totalMod = 0;

    if (t.characterId && vtt?.campaignState?.characters?.[t.characterId]) {
        const char = vtt.campaignState.characters[t.characterId];
        const score =
            (char.stats && char.stats[ab]) ||
            (char.abilities && (char.abilities[ab]?.score || char.abilities[ab])) ||
            10;
        const statMod = (char.statMods && char.statMods[ab]) || 0;
        const baseMod = Math.floor((score + statMod - 10) / 2);
        const isProf = char.saves ? !!char.saves[ab] : char.abilities?.[ab]?.saveProf || false;
        const level = char.level || 1;
        const pb = Math.floor((level - 1) / 4) + 2;
        const globalMod = char.globalSaveMod || 0;
        const customMod = (char.saveMods && char.saveMods[ab]) || 0;
        totalMod = baseMod + (isProf ? pb : 0) + globalMod + customMod;
    } else {
        const m = getResolvedCreatureMonsterData(t);
        if (m && m.save && m.save[ab] !== undefined) {
            totalMod = parseInt(m.save[ab]);
        } else if (m && m[ab] !== undefined) {
            totalMod = Math.floor((m[ab] - 10) / 2);
        } else {
            const score = t.abilities?.[ab]?.score || t.abilities?.[ab] || 10;
            totalMod = Math.floor((score - 10) / 2);
        }
    }
    return isNaN(totalMod) ? 0 : totalMod;
}

export function rollSavingThrowToken(formula, label, tokenId, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        simulateRollFn = (typeof window !== 'undefined' && window.vttPlayerSheetAPI?.simulateRoll) || null
    } = options;

    let rollResult = simulateRollFn ? simulateRollFn(formula, 20) : null;
    let d20 = 0;
    let finalModifier = 0;
    let total = 0;

    if (rollResult && rollResult.diceList && rollResult.diceList.length > 0) {
        total = rollResult.total;
        const d20Obj = rollResult.diceList.find((d) => d.faces === 20) || rollResult.diceList[0];
        d20 = d20Obj ? d20Obj.val : 10;
        finalModifier = total - d20;
    } else {
        const regex = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i;
        const match = formula.match(regex);
        let diceList = [];
        let subtotal = 0;
        if (match) {
            const count = parseInt(match[1]) || 1;
            const faces = parseInt(match[2]) || 20;
            const sign = match[3] || '+';
            const modifier = match[4] ? parseInt(match[4]) : 0;
            for (let i = 0; i < count; i++) {
                const val = Math.floor(Math.random() * faces) + 1;
                diceList.push({ faces, val });
                subtotal += val;
            }
            finalModifier = sign === '-' ? -modifier : modifier;
            total = subtotal + finalModifier;
            d20 = diceList[0]?.val || 10;
        } else {
            d20 = Math.floor(Math.random() * 20) + 1;
            diceList.push({ faces: 20, val: d20 });
            total = d20;
        }

        rollResult = {
            formula,
            count: 1,
            faces: 20,
            diceList,
            modifier: finalModifier,
            total,
            breakdownStr: `[${d20}]${finalModifier >= 0 ? '+' : ''}${finalModifier}`,
            compactBreakdown: `[${d20}]${finalModifier >= 0 ? '+' : ''}${finalModifier}`,
            isCritSuccess: d20 === 20,
            isCritFail: d20 === 1
        };
    }

    const rollVisibility =
        (typeof document !== 'undefined' ? document.getElementById('config-roll-visibility')?.value : 'public') ||
        'public';
    const msgText = `[${label}] rolls **${formula}**`;

    if (rollVisibility === 'private' && vtt.role === 'GM') {
        vtt.socket?.emit('chat:whisper', {
            to: vtt.username,
            text: msgText,
            roll: rollResult
        });
    } else {
        vtt.socket?.emit('chat:msg', {
            text: msgText,
            roll: rollResult
        });
    }

    return { total, d20, mod: finalModifier, formula, rollResult };
}

export function postSaveResolutionChatCard(saveResolveData, options = {}) {
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {} } = options;
    if (!vtt.socket) return;
    vtt.socket.emit('chat:msg', {
        whisperToGM: true,
        saveResolveCard: {
            dc: saveResolveData.dc,
            ability: saveResolveData.ability,
            results: saveResolveData.results,
            cardData: saveResolveData.cardData,
            resolved: null,
            timestamp: Date.now()
        }
    });
}

export function resolveSaveFromChat(saveResolveCard, applyHalf, msgId, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        currentMapId = null,
        applyCardDamageToToken = () => 0,
        syncTokensHpToCharacters = () => {},
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        triggerDamageFXAnimation = () => {},
        renderAll = () => {}
    } = options;

    if (vtt.role !== 'GM' || !saveResolveCard) return;
    const cardData = saveResolveCard.cardData || {};
    const dmgRolls = cardData.dmgRolls || [];
    const damageTypes = dmgRolls.map((dr) => dr.type || 'untyped').filter(Boolean);
    const results = saveResolveCard.results || [];

    let anyChanged = false;
    const affectedIdsSet = new Set();
    const affectedTokensMap = new Map();

    results.forEach((r) => {
        const token = tokens[r.tokenId];
        if (!token) return;

        const targetDmgRolls = r.dmgRolls && r.dmgRolls.length > 0 ? r.dmgRolls : dmgRolls;
        const targetDamageTypes = targetDmgRolls.map((dr) => dr.type || 'untyped').filter(Boolean);

        const multiplier = r.passed ? (applyHalf ? 0.5 : 0) : 1.0;
        let deducted = 0;
        if (multiplier > 0 && targetDmgRolls.length > 0) {
            deducted = applyCardDamageToToken(token, targetDmgRolls, multiplier);
            if (deducted > 0) {
                anyChanged = true;
                affectedTokensMap.set(token.id, token);
            }
            affectedIdsSet.add(token.id);

            const { drawW, drawH } = getTokenDrawDimensions(token);
            triggerDamageFXAnimation(
                token.x + drawW / 2,
                token.y + drawH / 2,
                Math.max(drawW, drawH) / 2,
                targetDamageTypes.length > 0 ? targetDamageTypes : ['untyped']
            );
        }
        r.deductedHp = deducted;
    });

    if (anyChanged) {
        const uniqueAffectedTokens = Array.from(affectedTokensMap.values());
        syncTokensHpToCharacters(uniqueAffectedTokens);
        if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
            window.emitTokenUpdates(tokens);
        }
        renderAll();
    }

    if (affectedIdsSet.size > 0 && vtt.socket) {
        vtt.socket.emit('tokens:damage_fx', {
            mapId: currentMapId,
            tokenIds: Array.from(affectedIdsSet),
            damageTypes: damageTypes.length > 0 ? damageTypes : ['untyped']
        });
    }

    if (vtt.socket && msgId) {
        vtt.socket.emit('chat:save_resolved', {
            id: msgId,
            resolution: { applyHalf, timestamp: Date.now() },
            results
        });
    }
}

export function rollFromToken(formula, label, tokenId, extraModifier = 0, options = {}) {
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {} } = options;
    if (!vtt.socket) return 0;

    const evt = options.optEvent || (typeof window !== 'undefined' ? window.event : null);
    const isShift =
        (evt && evt.shiftKey) ||
        (typeof window !== 'undefined' &&
            typeof window.VTT_isShiftPressed === 'function' &&
            window.VTT_isShiftPressed());
    const isCtrlOrAlt =
        (evt && (evt.ctrlKey || evt.altKey || evt.metaKey)) ||
        (typeof window !== 'undefined' && typeof window.VTT_isCtrlPressed === 'function' && window.VTT_isCtrlPressed());

    let rollMode =
        options.rollMode ||
        (typeof window !== 'undefined' && window.VTT ? window.VTT.currentRollMode : 'normal') ||
        'normal';
    if (isShift) rollMode = 'adv';
    else if (isCtrlOrAlt) rollMode = 'dis';

    const isAdvantage = rollMode === 'adv';
    const isDisadvantage = rollMode === 'dis';

    const regex = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i;
    const match = (formula || '').match(regex);
    let total = 0;
    let diceList = [];
    let finalModifier = 0;
    let displayFormula = formula;

    if (match) {
        let count = parseInt(match[1]) || 1;
        const faces = parseInt(match[2]) || 20;
        const sign = match[3] || '+';
        const modifier = match[4] ? parseInt(match[4]) : 0;
        finalModifier = sign === '-' ? -modifier : modifier;

        const isD20SingleRoll = count === 1 && faces === 20;

        if (isD20SingleRoll && (isAdvantage || isDisadvantage)) {
            count = 2;
            displayFormula = `2d20${isAdvantage ? 'kh1' : 'kl1'}${modifier ? `${sign}${modifier}` : ''}`;
        }

        for (let i = 0; i < count; i++) {
            const val = Math.floor(Math.random() * faces) + 1;
            diceList.push({ faces, val, isDropped: false, discarded: false });
        }

        let subtotal = 0;
        let droppedIndex = -1;

        if (isD20SingleRoll && isAdvantage) {
            if (diceList[0].val >= diceList[1].val) {
                subtotal = diceList[0].val;
                droppedIndex = 1;
            } else {
                subtotal = diceList[1].val;
                droppedIndex = 0;
            }
        } else if (isD20SingleRoll && isDisadvantage) {
            if (diceList[0].val <= diceList[1].val) {
                subtotal = diceList[0].val;
                droppedIndex = 1;
            } else {
                subtotal = diceList[1].val;
                droppedIndex = 0;
            }
        } else {
            for (const d of diceList) {
                subtotal += d.val;
            }
        }

        if (droppedIndex !== -1) {
            diceList[droppedIndex].isDropped = true;
            diceList[droppedIndex].discarded = true;
        }

        total = subtotal + finalModifier;
    }

    if (extraModifier) {
        total = Math.round((total + extraModifier) * 100) / 100;
    }

    const modeText = isAdvantage ? ' (Advantage)' : isDisadvantage ? ' (Disadvantage)' : '';

    let breakdownStr = '';
    if (diceList.length > 0) {
        const rollStrings = diceList.map((d) => (d.isDropped ? `<s>${d.val}</s>` : `${d.val}`));
        const modStr = finalModifier !== 0 ? ` ${finalModifier > 0 ? '+' : '-'} ${Math.abs(finalModifier)}` : '';
        breakdownStr = `[${rollStrings.join(', ')}]${modStr}`;
    }

    const rollResult = {
        formula: displayFormula,
        count: diceList.length || 1,
        faces: 20,
        diceList,
        modifier: finalModifier,
        total,
        breakdownStr,
        compactBreakdown: breakdownStr
    };

    const rollVisibility =
        (typeof document !== 'undefined' ? document.getElementById('config-roll-visibility')?.value : 'public') ||
        'public';
    const msgText = `[${label}] rolls **${displayFormula}**${modeText}`;

    if (rollVisibility === 'private' && vtt.role === 'GM') {
        vtt.socket.emit('chat:whisper', {
            to: vtt.username,
            text: msgText,
            roll: rollResult
        });
    } else {
        vtt.socket.emit('chat:msg', {
            text: msgText,
            roll: rollResult
        });
    }

    return total;
}

export function showAddCustomConditionModal(targetTokenIds, options = {}) {
    if (typeof document === 'undefined') return;
    const { tokens = {}, renderAll = () => {} } = options;

    const tokenIdsArr = Array.isArray(targetTokenIds) ? targetTokenIds : [targetTokenIds];
    const oldModal = document.getElementById('vtt-add-custom-condition-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'vtt-add-custom-condition-modal';
    modal.className = 'vtt-modal';

    const presetColors = [
        '#ff4444',
        '#ff8800',
        '#ffcc00',
        '#00C851',
        '#33b5e5',
        '#2BBBAD',
        '#4285F4',
        '#aa66cc',
        '#ffbb33',
        '#007E33',
        '#CC0000',
        '#ffffff'
    ];

    modal.innerHTML = `
        <div class="vtt-modal-content" style="max-width: 320px;">
            <div class="vtt-modal-header">
                <h3><i class="fa-solid fa-paintbrush"></i> Custom Condition (${tokenIdsArr.length} Token${tokenIdsArr.length > 1 ? 's' : ''})</h3>
                <button class="vtt-modal-close"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="vtt-modal-body">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Label</label>
                    <input type="text" id="custom-condition-label" class="vtt-input" placeholder="e.g. Bleeding" style="width: 100%;" autofocus>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Color</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;" id="custom-condition-presets">
                        ${presetColors.map((c) => `<div class="preset-color" data-color="${c}" style="width: 24px; height: 24px; border-radius: 50%; background: ${c}; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s;"></div>`).join('')}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label>Custom:</label>
                        <input type="color" id="custom-condition-color" value="#ff4444" style="cursor: pointer;">
                    </div>
                </div>
            </div>
            <div class="vtt-modal-footer">
                <button class="vtt-btn vtt-btn-secondary" id="btn-cancel-custom-condition">Cancel</button>
                <button class="vtt-btn vtt-btn-primary" id="btn-apply-custom-condition">Add Condition</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    const inputLabel = modal.querySelector('#custom-condition-label');
    const inputColor = modal.querySelector('#custom-condition-color');
    const btnClose = modal.querySelector('.vtt-modal-close');
    const btnCancel = modal.querySelector('#btn-cancel-custom-condition');
    const btnApply = modal.querySelector('#btn-apply-custom-condition');
    const presets = modal.querySelectorAll('.preset-color');

    let selectedColor = presetColors[0];
    const updateSelection = () => {
        presets.forEach((p) => {
            p.style.borderColor = p.dataset.color === selectedColor ? 'var(--color-gold-base)' : 'transparent';
            p.style.transform = p.dataset.color === selectedColor ? 'scale(1.2)' : 'scale(1)';
        });
        if (inputColor) inputColor.value = selectedColor;
    };
    updateSelection();

    presets.forEach((p) => {
        p.addEventListener('click', () => {
            selectedColor = p.dataset.color;
            updateSelection();
        });
    });

    if (inputColor) {
        inputColor.addEventListener('input', (e) => {
            selectedColor = e.target.value;
            presets.forEach((p) => {
                p.style.borderColor = 'transparent';
                p.style.transform = 'scale(1)';
            });
        });
    }

    const onEsc = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) close();
    };
    const close = () => {
        window.removeEventListener('keydown', onEsc);
        modal.remove();
    };
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    window.addEventListener('keydown', onEsc);

    if (btnClose) btnClose.addEventListener('click', close);
    if (btnCancel) btnCancel.addEventListener('click', close);

    const apply = () => {
        const label = inputLabel ? inputLabel.value.trim() : '';
        if (!label) {
            if (typeof alert === 'function') alert('Please enter a condition label.');
            return;
        }
        let updated = false;
        tokenIdsArr.forEach((tokenId) => {
            const activeToken = tokens[tokenId];
            if (activeToken) {
                if (!activeToken.conditions) activeToken.conditions = [];
                activeToken.conditions.push({
                    name: label,
                    color: selectedColor,
                    isCustom: true
                });
                updated = true;
            }
        });
        if (updated) {
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        }
        close();
    };

    if (btnApply) btnApply.addEventListener('click', apply);
    if (inputLabel) {
        inputLabel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') apply();
        });
        inputLabel.select();
    }
}
