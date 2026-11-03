// DnDForged Canvas Mass Actions & Damage Resolutions Subsystem
// Handles bulk rolls, resistance/immunity evaluation, composite damage, mass attack distributions, and mass context menu

import {
    CONDITION_ICONS,
    getPcRollFormula,
    getTokenSaveMod,
    rollSavingThrowToken,
    postSaveResolutionChatCard,
    rollFromToken,
    showAddCustomConditionModal
} from './vtt-canvas-token-rollers.js';

export function _hasResistanceType(arr, dmgType, attackMeta = {}) {
    if (!arr || !Array.isArray(arr) || !dmgType) return false;
    const targetType = dmgType.toLowerCase().trim();
    const isMagic = !!(attackMeta.isMagic || attackMeta.isSpell);
    const isSilvered = !!attackMeta.isSilvered;
    const isAdamantine = !!attackMeta.isAdamantine;

    return arr.some((r) => {
        if (!r) return false;
        // 1. Plain string defense e.g. "fire", "slashing"
        if (typeof r === 'string') {
            return r.toLowerCase().trim() === targetType;
        }

        // 2. Structured defense object { types, bypasses, note }
        if (typeof r === 'object' && Array.isArray(r.types)) {
            const matchesType = r.types.some((t) => String(t).toLowerCase().trim() === targetType);
            if (!matchesType) return false;

            // Check bypasses
            const bypasses = Array.isArray(r.bypasses) ? r.bypasses : [];
            if (bypasses.length > 0) {
                if (bypasses.includes('magic') && isMagic) return false;
                if (bypasses.includes('silver') && isSilvered) return false;
                if (bypasses.includes('adamantine') && isAdamantine) return false;
            }
            return true;
        }

        // 3. Legacy 5etools raw object { resist: [...], note: "..." }
        const legacySub = r.resist || r.immune || r.vulnerable;
        if (typeof r === 'object' && legacySub) {
            const note = (r.note || r.special || '').toLowerCase();
            const bypasses = [];
            if (note.includes('nonmagical') || note.includes('non-magical')) bypasses.push('magic');
            if (note.includes('silver')) bypasses.push('silver');
            if (note.includes('adamant')) bypasses.push('adamantine');

            if (bypasses.length > 0) {
                if (bypasses.includes('magic') && isMagic) return false;
                if (bypasses.includes('silver') && isSilvered) return false;
                if (bypasses.includes('adamantine') && isAdamantine) return false;
            }
            return _hasResistanceType(legacySub, dmgType, attackMeta);
        }

        return false;
    });
}

export function syncTokensHpToCharacters(affectedTokens, options = {}) {
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {}, tokens = {} } = options;

    if (!affectedTokens || affectedTokens.length === 0 || !vtt.campaignState?.characters) return;
    const updatedChars = new Set();

    affectedTokens.forEach((token) => {
        if (!token || !token.characterId) return;
        const char = vtt.campaignState.characters[token.characterId];
        if (!char) return;

        let modified = false;
        if (token.hp !== undefined && char.hpCurrent !== token.hp) {
            char.hpCurrent = token.hp;
            modified = true;
        }
        if (token.maxHp !== undefined && char.hpMax !== token.maxHp) {
            char.hpMax = token.maxHp;
            modified = true;
        }
        if (token.tempHp !== undefined && (char.tempHp ?? 0) !== (token.tempHp ?? 0)) {
            char.tempHp = token.tempHp ?? 0;
            modified = true;
        }

        if (modified) {
            updatedChars.add(char);
            Object.values(tokens).forEach((t) => {
                if (t.id !== token.id && t.characterId === char.id) {
                    t.hp = char.hpCurrent;
                    t.maxHp = char.hpMax;
                    t.tempHp = char.tempHp;
                }
            });
        }
    });

    if (updatedChars.size > 0 && vtt.socket) {
        updatedChars.forEach((char) => {
            vtt.socket.emit('character:update', { character: char });

            if (typeof window !== 'undefined' && window.VTT?.playerSheet?.syncLiveHp) {
                window.VTT.playerSheet.syncLiveHp(char.id, char.hpCurrent, char.hpMax, char.tempHp);
            }
        });
    }
}

export function applyDamageToTokens(tokenIds, amount, type, mode, attackMeta = {}, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        currentMapId = null,
        syncHpFn = syncTokensHpToCharacters,
        renderAll = () => { },
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        triggerDamageFXAnimation = null,
        triggerHealingFXAnimation = null
    } = options;

    if (!tokenIds || tokenIds.length === 0) return;

    let appliedCount = 0;
    const affectedTokens = [];
    let lastDeductedAmount = 0;

    tokenIds.forEach((tokenId) => {
        const token = tokens[tokenId];
        if (!token) return;

        let finalAmount = amount;

        if (mode !== 'heal' && type !== 'untyped' && token.monsterData) {
            const md = token.monsterData;
            let multiplier = 1;

            if (md.immune && _hasResistanceType(md.immune, type, attackMeta)) multiplier = 0;
            else if (md.vulnerable && _hasResistanceType(md.vulnerable, type, attackMeta)) multiplier = 2;
            else if (md.resist && _hasResistanceType(md.resist, type, attackMeta)) multiplier = 0.5;

            finalAmount = Math.floor(finalAmount * multiplier);
        } else if (
            mode !== 'heal' &&
            type !== 'untyped' &&
            token.isPlayer &&
            token.characterId &&
            vtt.campaignState?.characters?.[token.characterId]
        ) {
            const char = vtt.campaignState.characters[token.characterId];
            let multiplier = 1;
            if (char.immune && _hasResistanceType(char.immune, type, attackMeta)) multiplier = 0;
            else if (char.vulnerable && _hasResistanceType(char.vulnerable, type, attackMeta)) multiplier = 2;
            else if (char.resist && _hasResistanceType(char.resist, type, attackMeta)) multiplier = 0.5;
            finalAmount = Math.floor(finalAmount * multiplier);
        }

        if (mode === 'half') {
            finalAmount = Math.floor(finalAmount / 2);
        }

        if (mode === 'heal') {
            if (token.hp !== undefined) {
                const maxHp = token.maxHp !== undefined ? token.maxHp : 9999;
                const prevHp = token.hp;
                token.hp = Math.min(token.hp + finalAmount, maxHp);
                const healed = token.hp - prevHp;
                if (healed > 0) {
                    lastDeductedAmount = healed;
                    appliedCount++;
                    affectedTokens.push(token);

                    if (typeof triggerHealingFXAnimation === 'function') {
                        const { drawW, drawH } = getTokenDrawDimensions(token);
                        triggerHealingFXAnimation(
                            token.x + drawW / 2,
                            token.y + drawH / 2,
                            Math.max(drawW, drawH) / 2,
                            healed,
                            { tokenId: token.id }
                        );
                    }
                }
            }
        } else {
            if (token.hp !== undefined) {
                let tempDamage = 0;
                if (token.tempHp && token.tempHp > 0) {
                    tempDamage = Math.min(token.tempHp, finalAmount);
                    token.tempHp -= tempDamage;
                    finalAmount -= tempDamage;
                }
                const totalDeducted = tempDamage + (finalAmount > 0 ? Math.min(token.hp, finalAmount) : 0);
                if (finalAmount > 0) {
                    token.hp = Math.max(0, token.hp - finalAmount);
                }
                lastDeductedAmount = totalDeducted;
                appliedCount++;
                affectedTokens.push(token);

                if (typeof triggerDamageFXAnimation === 'function') {
                    const { drawW, drawH } = getTokenDrawDimensions(token);
                    triggerDamageFXAnimation(
                        token.x + drawW / 2,
                        token.y + drawH / 2,
                        Math.max(drawW, drawH) / 2,
                        [type || 'untyped'],
                        { amount: totalDeducted > 0 ? totalDeducted : amount, tokenId: token.id }
                    );
                }
            }
        }
    });

    if (appliedCount > 0) {
        syncHpFn(affectedTokens, { vtt, tokens });
        if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
            window.emitTokenUpdates(tokens);
        }
        renderAll();

        if (vtt.socket) {
            if (mode === 'heal') {
                vtt.socket.emit('tokens:heal_fx', {
                    mapId: currentMapId,
                    tokenIds: affectedTokens.map((t) => t.id),
                    amount: affectedTokens.length === 1 ? lastDeductedAmount : null
                });
            } else {
                vtt.socket.emit('tokens:damage_fx', {
                    mapId: currentMapId,
                    tokenIds: affectedTokens.map((t) => t.id),
                    damageTypes: [type || 'untyped'],
                    amount: affectedTokens.length === 1 ? lastDeductedAmount : null
                });
            }
        }
    }
}

export function applyCardDamageToToken(token, dmgRolls, multiplier = 1.0, options = {}) {
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {} } = options;
    if (!token || !dmgRolls || dmgRolls.length === 0 || multiplier <= 0) return 0;
    let totalDeducted = 0;

    dmgRolls.forEach((dr) => {
        const rawAmount = dr.roll ? dr.roll.total : parseInt(dr.formula) || 0;
        if (rawAmount <= 0) return;
        const type = dr.type || 'untyped';
        const attackMeta = {
            isMagic: !!dr.isMagic,
            isSilvered: !!dr.isSilvered,
            isAdamantine: !!dr.isAdamantine,
            isSpell: !!dr.isSpell
        };

        let finalAmount = rawAmount;

        // Vulnerability, resistance, immunity check
        if (type !== 'untyped' && token.monsterData) {
            const md = token.monsterData;
            let mult = 1;
            if (md.immune && _hasResistanceType(md.immune, type, attackMeta)) mult = 0;
            else if (md.vulnerable && _hasResistanceType(md.vulnerable, type, attackMeta)) mult = 2;
            else if (md.resist && _hasResistanceType(md.resist, type, attackMeta)) mult = 0.5;
            finalAmount = Math.floor(finalAmount * mult);
        } else if (
            type !== 'untyped' &&
            token.isPlayer &&
            token.characterId &&
            vtt.campaignState?.characters?.[token.characterId]
        ) {
            const char = vtt.campaignState.characters[token.characterId];
            let mult = 1;
            if (char.immune && _hasResistanceType(char.immune, type, attackMeta)) mult = 0;
            else if (char.vulnerable && _hasResistanceType(char.vulnerable, type, attackMeta)) mult = 2;
            else if (char.resist && _hasResistanceType(char.resist, type, attackMeta)) mult = 0.5;
            finalAmount = Math.floor(finalAmount * mult);
        }

        finalAmount = Math.floor(finalAmount * multiplier);

        if (token.hp !== undefined && finalAmount > 0) {
            let tempDamage = 0;
            if (token.tempHp && token.tempHp > 0) {
                tempDamage = Math.min(token.tempHp, finalAmount);
                token.tempHp -= tempDamage;
                finalAmount -= tempDamage;
            }
            if (finalAmount > 0) {
                token.hp = Math.max(0, token.hp - finalAmount);
            }
            totalDeducted += tempDamage + finalAmount;
        }
    });

    return totalDeducted;
}

export function applyCompositeDamageToTokens(tokenIds, dmgRolls, multiplier = 1.0, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        currentMapId = null,
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        triggerDamageFXAnimation = () => { },
        syncHpFn = syncTokensHpToCharacters,
        renderAll = () => { }
    } = options;

    if (!tokenIds || tokenIds.length === 0 || !tokens) return;
    const damageTypes = (dmgRolls || []).map((dr) => dr.type || 'untyped').filter(Boolean);
    let anyApplied = false;
    const affectedTokens = [];

    tokenIds.forEach((tokenId) => {
        const token = tokens[tokenId];
        if (!token) return;

        const deducted = applyCardDamageToToken(token, dmgRolls, multiplier, { vtt });
        if (deducted > 0) {
            anyApplied = true;
            affectedTokens.push(token);
        }

        const { drawW, drawH } = getTokenDrawDimensions(token);
        triggerDamageFXAnimation(
            token.x + drawW / 2,
            token.y + drawH / 2,
            Math.max(drawW, drawH) / 2,
            damageTypes.length > 0 ? damageTypes : ['untyped'],
            { amount: deducted, tokenId: token.id }
        );
    });

    if (anyApplied) {
        syncHpFn(affectedTokens, { vtt, tokens });
        if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
            window.emitTokenUpdates(tokens);
        }
        renderAll();
    }

    if (vtt.socket) {
        vtt.socket.emit('tokens:damage_fx', {
            mapId: currentMapId,
            tokenIds,
            damageTypes: damageTypes.length > 0 ? damageTypes : ['untyped']
        });
    }
}

function escapeTokenHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function promptMassAttackDistribution(massAttackCard, selectedIds, onConfirm, onCancel, options = {}) {
    if (typeof document === 'undefined') return;
    const { tokens = {}, getTokenAC = (t) => t?.ac ?? 10 } = options;

    const existing = document.getElementById('vtt-distribute-attacks-backdrop');
    if (existing) existing.remove();

    const attacks = massAttackCard.attacks || [];
    const targetTokens = selectedIds.map((id) => tokens[id]).filter(Boolean);
    if (targetTokens.length === 0) return;

    function calcDistribution() {
        const indices = attacks.map((a) => a.index);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const map = {};
        targetTokens.forEach((t) => {
            map[t.id] = [];
        });
        indices.forEach((atkIdx, idx) => {
            const tId = targetTokens[idx % targetTokens.length].id;
            map[tId].push(atkIdx);
        });
        return targetTokens.map((t) => ({
            tokenId: t.id,
            attackIndices: map[t.id]
        }));
    }

    let currentDist = calcDistribution();

    const backdrop = document.createElement('div');
    backdrop.id = 'vtt-distribute-attacks-backdrop';
    backdrop.className = 'vtt-modal-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'vtt-mass-roll-dialog';
    dialog.style.width = '420px';

    function renderRows() {
        return currentDist
            .map((d) => {
                const token = tokens[d.tokenId];
                if (!token) return '';
                const ac = getTokenAC(token) ?? 10;
                const avatar = token.img || token.avatar || 'img/tokens/unknown.png';
                const count = d.attackIndices.length;
                const badges = d.attackIndices.map((i) => `#${i}`).join(', ');
                return `
                <div class="distribute-token-row">
                    <div class="distribute-token-info">
                        <img src="${avatar}" class="distribute-token-avatar" alt="${escapeTokenHtml(token.name || 'Token')}">
                        <span class="distribute-token-name" title="${escapeTokenHtml(token.name || 'Token')}">${escapeTokenHtml(token.name || 'Token')}</span>
                        <span class="distribute-token-ac">AC ${ac}</span>
                    </div>
                    <span class="distribute-count-badge" title="Attacks: ${badges}">
                        ${count} Attack${count === 1 ? '' : 's'} (${badges})
                    </span>
                </div>
            `;
            })
            .join('');
    }

    dialog.innerHTML = `
        <div class="mass-roll-header">
            <div class="mass-roll-title">
                <i class="fa-solid fa-crosshairs"></i>
                <span>Distribute Attacks?</span>
            </div>
            <button type="button" class="mass-roll-close" id="btn-distribute-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mass-roll-body">
            <div class="mass-roll-creature-info">
                ${attacks.length} attacks distributed randomly and evenly across ${targetTokens.length} selected targets.
            </div>
            <div class="distribute-token-list scroll-styled" id="distribute-token-list-container">
                ${renderRows()}
            </div>
        </div>
        <div class="mass-roll-footer">
            <button type="button" class="btn-mass-roll-cancel" id="btn-distribute-reroll" title="Shuffle attack assignments">
                <i class="fa-solid fa-shuffle"></i> Shuffle
            </button>
            <button type="button" class="btn-mass-roll-cancel" id="btn-distribute-cancel">Cancel</button>
            <button type="button" class="btn-mass-roll-confirm" id="btn-distribute-confirm">
                <i class="fa-solid fa-play"></i> Apply & Process
            </button>
        </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function closeDialog() {
        window.removeEventListener('keydown', onKeyDown);
        backdrop.remove();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialog();
            if (typeof onCancel === 'function') onCancel();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            doConfirm();
        }
    }

    function doConfirm() {
        closeDialog();
        if (typeof onConfirm === 'function') {
            onConfirm(currentDist);
        }
    }

    window.addEventListener('keydown', onKeyDown);
    dialog.querySelector('#btn-distribute-close').addEventListener('click', () => {
        closeDialog();
        if (typeof onCancel === 'function') onCancel();
    });
    dialog.querySelector('#btn-distribute-cancel').addEventListener('click', () => {
        closeDialog();
        if (typeof onCancel === 'function') onCancel();
    });
    dialog.querySelector('#btn-distribute-reroll').addEventListener('click', () => {
        currentDist = calcDistribution();
        dialog.querySelector('#distribute-token-list-container').innerHTML = renderRows();
    });
    dialog.querySelector('#btn-distribute-confirm').addEventListener('click', doConfirm);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeDialog();
            if (typeof onCancel === 'function') onCancel();
        }
    });
}

export function processMassAttackFromChat(massAttackCard, msgId, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        selectedTokenIds = new Set(),
        executeMassAttackResolutionFn = executeMassAttackResolution,
        promptMassAttackDistributionFn = promptMassAttackDistribution
    } = options;

    if (vtt.role !== 'GM' || !massAttackCard) return;
    const selectedIds = Array.from(selectedTokenIds);

    if (selectedIds.length === 0) {
        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
            JqueryUtil.doToast({
                type: 'warning',
                content: 'No tokens selected. Select target token(s) on canvas first.'
            });
        }
        if (msgId && typeof document !== 'undefined') {
            const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
            const btn = msgEl?.querySelector('.btn-mass-attack-process');
            if (btn) btn.disabled = false;
        }
        return;
    }

    const attacks = massAttackCard.attacks || [];
    if (attacks.length === 0) return;

    if (selectedIds.length === 1) {
        const singleTokenId = selectedIds[0];
        const distribution = [
            {
                tokenId: singleTokenId,
                attackIndices: attacks.map((a) => a.index)
            }
        ];
        executeMassAttackResolutionFn(massAttackCard, distribution, msgId, options);
        return;
    }

    promptMassAttackDistributionFn(
        massAttackCard,
        selectedIds,
        (distribution) => {
            executeMassAttackResolutionFn(massAttackCard, distribution, msgId, options);
        },
        () => {
            if (msgId && typeof document !== 'undefined') {
                const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
                const btn = msgEl?.querySelector('.btn-mass-attack-process');
                if (btn) btn.disabled = false;
            }
        },
        options
    );
}

export function executeMassAttackResolution(massAttackCard, distribution, msgId, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        currentMapId = null,
        getTokenAC = (t) => t?.ac ?? 10,
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        triggerDamageFXAnimation = () => { },
        syncHpFn = syncTokensHpToCharacters,
        renderAll = () => { },
        getResolvedCreatureMonsterData = (t) => t?.monsterData || null
    } = options;

    const attacks = massAttackCard.attacks || [];
    const attackMap = {};
    attacks.forEach((a) => {
        attackMap[a.index] = a;
    });

    let anyChanged = false;
    const affectedIds = [];
    const affectedTokens = [];
    const allDamageTypes = new Set();
    const saveRiderTokens = [];

    distribution.forEach((d) => {
        const token = tokens[d.tokenId];
        if (!token) return;
        const targetAC = getTokenAC(token) ?? 10;
        let tokenTookDamage = false;
        let totalDeductedForToken = 0;

        d.attackIndices.forEach((atkIdx) => {
            const attack = attackMap[atkIdx];
            if (!attack) return;

            let hit = false;
            if (attack.atkRoll) {
                hit = attack.atkRoll.isCritSuccess || (!attack.atkRoll.isCritFail && attack.atkRoll.total >= targetAC);
            } else {
                hit = true;
            }

            let deducted = 0;
            if (hit) {
                const dmgRolls = attack.dmgRolls || [];
                const hitDamages = dmgRolls.filter((dr) => !dr.saveRider);
                const riderDamages = dmgRolls.filter((dr) => dr.saveRider);

                hitDamages.forEach((dr) => {
                    if (dr.type) allDamageTypes.add(dr.type);
                });

                if (hitDamages.length > 0) {
                    deducted = applyCardDamageToToken(token, hitDamages, 1.0, { vtt });
                    if (deducted > 0) {
                        anyChanged = true;
                        tokenTookDamage = true;
                        totalDeductedForToken += deducted;
                    }
                }

                if (attack.saveInfo && attack.saveInfo.dc) {
                    saveRiderTokens.push({
                        token,
                        attackIndex: attack.index,
                        saveInfo: attack.saveInfo,
                        riderDamages: riderDamages
                    });
                }
            }

            attack.resolution = {
                tokenId: token.id,
                tokenName: token.name || 'Token',
                hit: hit,
                damageDealt: deducted
            };
        });

        if (tokenTookDamage) {
            affectedTokens.push(token);
            affectedIds.push(token.id);
            const { drawW, drawH } = getTokenDrawDimensions(token);
            triggerDamageFXAnimation(
                token.x + drawW / 2,
                token.y + drawH / 2,
                Math.max(drawW, drawH) / 2,
                allDamageTypes.size > 0 ? Array.from(allDamageTypes) : ['untyped'],
                { amount: totalDeductedForToken, tokenId: token.id }
            );
        }
    });

    if (anyChanged) {
        syncHpFn(affectedTokens, { vtt, tokens });
        if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
            window.emitTokenUpdates(tokens);
        }
        renderAll();
    }

    if (affectedIds.length > 0 && vtt.socket) {
        vtt.socket.emit('tokens:damage_fx', {
            mapId: currentMapId,
            tokenIds: affectedIds,
            damageTypes: allDamageTypes.size > 0 ? Array.from(allDamageTypes) : ['untyped']
        });
    }

    const hitsCount = attacks.filter((a) => a.resolution?.hit).length;
    const totalDamageDealt = attacks.reduce((sum, a) => sum + (a.resolution?.damageDealt || 0), 0);
    const summary = {
        hitsCount,
        totalDamageDealt,
        saveRidersTriggered: saveRiderTokens.length > 0
    };

    massAttackCard.resolved = { timestamp: Date.now() };
    massAttackCard.summary = summary;

    if (vtt.socket && msgId) {
        vtt.socket.emit('chat:mass_attack_resolved', {
            id: msgId,
            massAttackCard: massAttackCard,
            resolution: { timestamp: Date.now() },
            attacks: attacks,
            summary: summary
        });
    }

    if (saveRiderTokens.length > 0) {
        const results = [];
        let sIdx = 0;

        function rollNextRider() {
            if (sIdx < saveRiderTokens.length) {
                const item = saveRiderTokens[sIdx];
                const token = item.token;
                const saveInfo = item.saveInfo;
                const ability = (saveInfo.ability || 'CON').toUpperCase();
                const dc = parseInt(saveInfo.dc) || 10;
                const abKey = ability.toLowerCase();

                let formula = '';
                if (token.isPlayer && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
                    const char = vtt.campaignState.characters[token.characterId];
                    formula = getPcRollFormula(char, 'save', abKey);
                } else {
                    const mData = getResolvedCreatureMonsterData(token);
                    if (mData && mData.save && mData.save[abKey] !== undefined) {
                        const mod = parseInt(mData.save[abKey]) || 0;
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    } else if (mData && mData[abKey] !== undefined) {
                        const mod = Math.floor(((mData[abKey] || 10) - 10) / 2);
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    } else {
                        const mod = getTokenSaveMod(token, ability, { vtt, getResolvedCreatureMonsterData });
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    }
                }

                const label = `${token.name || 'Token'} (Attack #${item.attackIndex}): ${ability} Saving Throw (DC ${dc})`;
                const rollOutput = rollSavingThrowToken(formula, label, token.id, { vtt });
                const passed = rollOutput.total >= dc;

                results.push({
                    tokenId: token.id,
                    tokenName: `${token.name || 'Token'} (Attack #${item.attackIndex})`,
                    attackIndex: item.attackIndex,
                    d20: rollOutput.d20,
                    mod: rollOutput.mod,
                    total: rollOutput.total,
                    passed,
                    formula: rollOutput.formula,
                    dmgRolls: item.riderDamages || []
                });

                sIdx++;
                setTimeout(rollNextRider, 150);
            } else {
                const firstSave = saveRiderTokens[0]?.saveInfo || {};
                postSaveResolutionChatCard(
                    {
                        dc: parseInt(firstSave.dc) || 10,
                        ability: (firstSave.ability || 'CON').toUpperCase(),
                        results,
                        cardData: {
                            dmgRolls: []
                        }
                    },
                    { vtt }
                );
            }
        }

        rollNextRider();
    }
}

export function processCardFullResolution(cardData, selectedIds, options = {}) {
    if (!selectedIds || selectedIds.length === 0) return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        currentMapId = null,
        getTokenAC = (t) => t?.ac ?? 10,
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        triggerDamageFXAnimation = () => { },
        syncHpFn = syncTokensHpToCharacters,
        renderAll = () => { },
        getResolvedCreatureMonsterData = (t) => t?.monsterData || null
    } = options;

    const dmgRolls = cardData.dmgRolls || [];
    const hasAttack = !!cardData.atkRoll;
    const saveObj =
        cardData.saveInfo || (cardData.saveDc ? { dc: cardData.saveDc, ability: cardData.saveAbility } : null);

    const atkHitMap = {};
    if (hasAttack) {
        const atkRoll = cardData.atkRoll;
        selectedIds.forEach((id) => {
            const token = tokens[id];
            if (!token) return;
            const ac = getTokenAC(token) ?? 10;
            const hit = atkRoll.isCritSuccess || (!atkRoll.isCritFail && atkRoll.total >= ac);
            atkHitMap[id] = hit;
        });
    }

    const hitTargetIds = hasAttack ? selectedIds.filter((id) => atkHitMap[id]) : selectedIds;

    if (hasAttack && hitTargetIds.length === 0) {
        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
            JqueryUtil.doToast({
                type: 'info',
                content: `Attack (${cardData.atkRoll.total}) missed selected token(s).`
            });
        }
        return;
    }

    if (hasAttack) {
        const hitDmgRolls = dmgRolls.filter((dr) => !dr.saveRider);
        if (hitDmgRolls.length > 0) {
            let anyChanged = false;
            const affectedIds = [];
            const affectedTokens = [];
            const hitDamageTypes = hitDmgRolls.map((dr) => dr.type || 'untyped').filter(Boolean);

            hitTargetIds.forEach((id) => {
                const token = tokens[id];
                if (!token) return;
                const deducted = applyCardDamageToToken(token, hitDmgRolls, 1.0, { vtt });
                if (deducted > 0) {
                    anyChanged = true;
                    affectedTokens.push(token);
                }
                affectedIds.push(token.id);

                const { drawW, drawH } = getTokenDrawDimensions(token);
                triggerDamageFXAnimation(
                    token.x + drawW / 2,
                    token.y + drawH / 2,
                    Math.max(drawW, drawH) / 2,
                    hitDamageTypes.length > 0 ? hitDamageTypes : ['untyped'],
                    { amount: deducted, tokenId: token.id }
                );
            });

            if (anyChanged) {
                syncHpFn(affectedTokens, { vtt, tokens });
                if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
            }

            if (affectedIds.length > 0 && vtt.socket) {
                vtt.socket.emit('tokens:damage_fx', {
                    mapId: currentMapId,
                    tokenIds: affectedIds,
                    damageTypes: hitDamageTypes.length > 0 ? hitDamageTypes : ['untyped']
                });
            }
        }
    }

    if (saveObj) {
        const ability = (saveObj.ability || 'DEX').toUpperCase();
        const dc = parseInt(saveObj.dc) || 10;
        const abKey = ability.toLowerCase();
        const targetIds = hitTargetIds;

        let riderDmgRolls = dmgRolls.filter((dr) => dr.saveRider);
        if (!hasAttack && riderDmgRolls.length === 0) {
            riderDmgRolls = dmgRolls;
        }

        const results = [];
        let index = 0;

        function rollNextToken() {
            if (index < targetIds.length) {
                const id = targetIds[index];
                const token = tokens[id];
                if (token) {
                    let formula = '';
                    if (token.isPlayer && token.characterId && vtt.campaignState?.characters?.[token.characterId]) {
                        const char = vtt.campaignState.characters[token.characterId];
                        formula = getPcRollFormula(char, 'save', abKey);
                    } else {
                        const mData = getResolvedCreatureMonsterData(token);
                        if (mData && mData.save && mData.save[abKey] !== undefined) {
                            const mod = parseInt(mData.save[abKey]) || 0;
                            formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                        } else if (mData && mData[abKey] !== undefined) {
                            const mod = Math.floor(((mData[abKey] || 10) - 10) / 2);
                            formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                        } else {
                            const mod = getTokenSaveMod(token, ability, { vtt, getResolvedCreatureMonsterData });
                            formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                        }
                    }

                    const label = `${token.name || 'Token'}: ${ability} Saving Throw`;
                    const rollOutput = rollSavingThrowToken(formula, label, token.id, { vtt });
                    const passed = rollOutput.total >= dc;
                    results.push({
                        tokenId: token.id,
                        tokenName: token.name || 'Token',
                        d20: rollOutput.d20,
                        mod: rollOutput.mod,
                        total: rollOutput.total,
                        passed,
                        formula: rollOutput.formula,
                        dmgRolls: riderDmgRolls
                    });
                }
                index++;
                setTimeout(rollNextToken, 150);
            } else {
                postSaveResolutionChatCard(
                    {
                        dc,
                        ability,
                        results,
                        cardData: {
                            ...cardData,
                            dmgRolls: riderDmgRolls
                        }
                    },
                    { vtt }
                );
            }
        }

        rollNextToken();
    } else if (!hasAttack) {
        applyCompositeDamageToTokens(selectedIds, dmgRolls, 1.0, options);
    }
}

export function handleCardAction(cardData, action, options = {}) {
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {}, selectedTokenIds = new Set() } = options;

    if (vtt.role !== 'GM') return;
    const selectedIds = Array.from(selectedTokenIds);
    if (selectedIds.length === 0) {
        if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
            JqueryUtil.doToast({
                type: 'warning',
                content: 'No tokens selected. Select target token(s) first.'
            });
        }
        return;
    }

    const dmgRolls = cardData.dmgRolls || [];

    if (action === 'full') {
        applyCompositeDamageToTokens(selectedIds, dmgRolls, 1.0, options);
    } else if (action === 'half') {
        applyCompositeDamageToTokens(selectedIds, dmgRolls, 0.5, options);
    } else if (action === 'process') {
        processCardFullResolution(cardData, selectedIds, options);
    }
}

export function changeMassTokenZOrder(tokenIds, action, options = {}) {
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        renderAll = () => { }
    } = options;

    const tokenList = Object.values(tokens);
    if (tokenList.length === 0 || tokenIds.length === 0) return;

    const selectedSet = new Set(tokenIds);
    const selectedTokens = tokenIds.map((id) => tokens[id]).filter(Boolean);
    if (selectedTokens.length === 0) return;

    const otherZIndexes = tokenList.filter((t) => !selectedSet.has(t.id)).map((t) => t.zIndex || 0);

    const maxZ = otherZIndexes.length > 0 ? Math.max(...otherZIndexes) : 0;
    const minZ = otherZIndexes.length > 0 ? Math.min(...otherZIndexes) : 0;

    selectedTokens.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    if (action === 'front') {
        selectedTokens.forEach((t, i) => {
            t.zIndex = maxZ + 1 + i;
        });
    } else if (action === 'back') {
        const startZ = minZ - selectedTokens.length;
        selectedTokens.forEach((t, i) => {
            t.zIndex = startZ + i;
        });
    }

    if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
        window.emitTokenUpdates(tokens);
    }
    renderAll();
}

export function showApplyDamageModal(tokenIds, options = {}) {
    if (typeof document === 'undefined') return;
    const { applyDamageToTokensFn = applyDamageToTokens } = options;

    const oldModal = document.getElementById('vtt-apply-damage-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'vtt-apply-damage-modal';
    modal.className = 'vtt-modal';

    const damageTypes = [
        'acid',
        'bludgeoning',
        'cold',
        'fire',
        'force',
        'lightning',
        'necrotic',
        'piercing',
        'poison',
        'psychic',
        'radiant',
        'slashing',
        'thunder'
    ];

    modal.innerHTML = `
        <div class="vtt-modal-content" style="max-width: 300px;">
            <div class="vtt-modal-header">
                <h3><i class="fa-solid fa-heart-crack"></i> Apply Damage (${tokenIds.length} Token${tokenIds.length > 1 ? 's' : ''})</h3>
                <button class="vtt-modal-close"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="vtt-modal-body">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Damage Amount</label>
                    <input type="number" id="apply-damage-amount" class="vtt-input" value="0" min="0" style="width: 100%;" autofocus>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px;">Damage Type</label>
                    <select id="apply-damage-type" class="vtt-input" style="width: 100%;">
                        <option value="untyped">Untyped</option>
                        ${damageTypes.map((t) => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="vtt-btn vtt-btn-danger" id="btn-apply-full" style="flex: 1;"><i class="fa-solid fa-droplet"></i> Full</button>
                    <button class="vtt-btn vtt-btn-warning" id="btn-apply-half" style="flex: 1;"><i class="fa-solid fa-shield-halved"></i> Half</button>
                    <button class="vtt-btn vtt-btn-success" id="btn-apply-heal" style="flex: 1;"><i class="fa-solid fa-heart"></i> Heal</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const onEsc = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            window.removeEventListener('keydown', onEsc);
            modal.remove();
        }
    };
    window.addEventListener('keydown', onEsc);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            window.removeEventListener('keydown', onEsc);
            modal.remove();
        }
    });

    const closeBtn = modal.querySelector('.vtt-modal-close');
    closeBtn.addEventListener('click', () => {
        window.removeEventListener('keydown', onEsc);
        modal.remove();
    });

    const inputEl = modal.querySelector('#apply-damage-amount');
    const selectEl = modal.querySelector('#apply-damage-type');

    const applyFn = (mode) => {
        const amount = parseInt(inputEl.value) || 0;
        if (amount > 0) {
            applyDamageToTokensFn(tokenIds, amount, selectEl.value, mode, {}, options);
        }
        window.removeEventListener('keydown', onEsc);
        modal.remove();
    };

    modal.querySelector('#btn-apply-full').addEventListener('click', () => applyFn('full'));
    modal.querySelector('#btn-apply-half').addEventListener('click', () => applyFn('half'));
    modal.querySelector('#btn-apply-heal').addEventListener('click', () => applyFn('heal'));

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFn('full');
    });
}

export function showMassRollContextMenu(tokenIds, clientX, clientY, options = {}) {
    if (typeof document === 'undefined') return;
    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        tokens = {},
        selectedTokenIds = new Set(),
        campaignSettings = {},
        isMobileViewport = () => false,
        triggerSplashForSelection = () => { },
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        snapToGrid = (x, y) => ({ x, y }),
        renderAll = () => { },
        getResolvedCreatureMonsterData = (t) => t?.monsterData || null
    } = options;

    const oldMenu = document.getElementById('vtt-token-context-menu');
    if (oldMenu) oldMenu.remove();

    const targetTokens = tokenIds.map((id) => tokens[id]).filter(Boolean);
    if (targetTokens.length === 0) return;

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
            <i class="fa-solid fa-users"></i> ${tokenIds.length} Tokens Selected
        </div>
        <div class="vtt-token-menu-item" id="menu-ctx-splash-art">
            <span><i class="fa-solid fa-expand item-icon"></i> Splash Art (${tokenIds.length})</span>
            <span style="font-size: 0.7rem; opacity: 0.7; font-family: monospace; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; margin-left: auto;">Shift+X</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-apply-damage">
            <span><i class="fa-solid fa-heart-crack item-icon"></i> Apply Damage</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-roll-init">
            <span><i class="fa-solid fa-swords item-icon"></i> Roll Initiative for All</span>
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
        html += `
            <div class="vtt-submenu-item menu-roll-ability" data-ability="${ab.key}" data-label="${ab.label}">
                <span>${ab.label}</span>
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
        html += `
            <div class="vtt-submenu-item menu-roll-save" data-ability="${ab.key}" data-label="${ab.label}">
                <span>${ab.label}</span>
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
        html += `
            <div class="vtt-submenu-item menu-roll-skill" data-skill="${sk.key}" data-label="${sk.label}">
                <span>${sk.label}</span>
            </div>
        `;
    });
    html += `
                </div>
            </div>
        </div>
    `;

    // 4. Mass Elevation
    const baseElevation = targetTokens[0]?.flightHeight || 0;
    html += `
        <div class="vtt-token-menu-item" style="cursor: default; display: flex; justify-content: space-between; align-items: center; padding-right: 8px;">
            <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Elevation</span>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button class="menu-btn-flight-dec" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                <input type="number" class="menu-input-flight" value="${baseElevation}" step="5" style="width: 40px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; text-align: center; border-radius: 4px; font-size: 12px; height: 20px; padding: 0;">
                <button class="menu-btn-flight-inc" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
        </div>
    `;

    // 5. Mass Conditions Submenu
    html += `
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-heart-pulse item-icon"></i> Conditions</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-condition-gallery-container">
                    <div class="vtt-condition-gallery">
    `;

    const sortedConditions = Object.keys(CONDITION_ICONS).sort();
    sortedConditions.forEach((condName) => {
        const iconClass = CONDITION_ICONS[condName];
        const allHaveIt = targetTokens.every((t) => t.conditions && t.conditions.some((c) => c.name === condName));

        html += `
            <button type="button" class="vtt-cond-tile menu-toggle-mass-condition${allHaveIt ? ' is-active' : ''}" data-cond="${condName}" title="${condName}">
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
                </div>
            </div>
        </div>
    `;

    // 6. Transform options (All Users)
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

    // 7. Z-ordering & Layers & Conversions & Delete (GM Only)
    if (vtt.role === 'GM') {
        html += `
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item" id="menu-move-front">
                <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Front</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-move-back">
                <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Back</span>
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
                <span><i class="fa-solid fa-trash item-icon"></i> Delete (${tokenIds.length} Tokens)</span>
            </div>
        `;
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);

    const isMobileMass = isMobileViewport();
    const mobileBackdropMass = document.getElementById('vtt-mobile-backdrop');

    if (isMobileMass) {
        menu.classList.add('mobile-modal-mode');
        if (mobileBackdropMass) {
            mobileBackdropMass.classList.add('active');
        }
    }

    const cleanupMassContextMenu = () => {
        if (mobileBackdropMass) {
            mobileBackdropMass.classList.remove('active');
            mobileBackdropMass.removeEventListener('click', cleanupMassContextMenu);
            mobileBackdropMass.removeEventListener('touchend', cleanupMassContextMenu);
        }
    };

    if (isMobileMass && mobileBackdropMass) {
        mobileBackdropMass.addEventListener('click', cleanupMassContextMenu);
        mobileBackdropMass.addEventListener('touchend', cleanupMassContextMenu);
    }

    const originalMassMenuRemove = menu.remove.bind(menu);
    menu.remove = function () {
        cleanupMassContextMenu();
        originalMassMenuRemove();
    };

    if (isMobileMass) {
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

    const getResolvedMonsterData = (t) => {
        if (t.monsterData) return t.monsterData;
        if (t.characterId && vtt.campaignState?.characters?.[t.characterId]) {
            const char = vtt.campaignState.characters[t.characterId];
            if ((char.isCompanion || char.isCustomNpc || char.monsterData) && char.monsterData) return char.monsterData;
        }
        return null;
    };

    const getFallbackModIfNeeded = (tokensList, checkLabel) => {
        const hasStatless = tokensList.some(
            (t) =>
                !getResolvedMonsterData(t) &&
                !(t.isPlayer && t.characterId && vtt.campaignState?.characters?.[t.characterId])
        );
        if (!hasStatless) return 0;

        const input =
            typeof prompt === 'function'
                ? prompt(`Enter custom modifier for tokens lacking a stat block (for ${checkLabel}):`, '0')
                : '0';
        if (input === null) return null;
        return parseInt(input) || 0;
    };

    // Splash Art
    const btnSplashMulti = menu.querySelector('#menu-ctx-splash-art');
    if (btnSplashMulti) {
        btnSplashMulti.addEventListener('click', () => {
            triggerSplashForSelection();
            menu.remove();
        });
    }

    // Apply Damage
    const btnApplyDamage = menu.querySelector('#menu-apply-damage');
    if (btnApplyDamage) {
        btnApplyDamage.addEventListener('click', () => {
            showApplyDamageModal(tokenIds, options);
            menu.remove();
        });
    }

    // Initiative
    menu.querySelector('#menu-roll-init')?.addEventListener('click', () => {
        const fallbackMod = getFallbackModIfNeeded(targetTokens, 'Initiative');
        if (fallbackMod === null) {
            menu.remove();
            return;
        }

        targetTokens.forEach((t) => {
            let formula = '';
            let dexScore = 10;
            const mData = getResolvedMonsterData(t);
            if (mData) {
                dexScore = mData.dex || 10;
                let mod = Math.floor((dexScore - 10) / 2);
                if (mData.initiative !== undefined) {
                    if (typeof mData.initiative === 'number') mod = mData.initiative;
                    else if (typeof mData.initiative?.bonus === 'number') mod = mData.initiative.bonus;
                }
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            } else if (t.isPlayer && t.characterId && vtt.campaignState?.characters?.[t.characterId]) {
                const char = vtt.campaignState.characters[t.characterId];
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
                let mod = fallbackMod;
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            }

            let dexTiebreaker = 0;
            if (campaignSettings.initDexTiebreaker !== false) {
                dexTiebreaker = Math.round(dexScore) / 100;
            }

            const label = `${t.name}: Initiative`;
            const resultTotal = rollFromToken(formula, label, t.id, dexTiebreaker, { vtt });

            if (typeof window !== 'undefined' && window.VTT?.chatEngine) {
                window.VTT.chatEngine.addToInitiative(t.name, resultTotal, t.id);
            }
        });
        menu.remove();
    });

    // Abilities
    menu.querySelectorAll('.menu-roll-ability').forEach((item) => {
        item.addEventListener('click', () => {
            const abKey = item.dataset.ability;
            const abLabel = item.dataset.label;

            const fallbackMod = getFallbackModIfNeeded(targetTokens, `${abLabel} Check`);
            if (fallbackMod === null) {
                menu.remove();
                return;
            }

            targetTokens.forEach((t) => {
                let formula = '';
                const mData = getResolvedMonsterData(t);
                if (mData) {
                    const score = mData[abKey] || 10;
                    let mod = Math.floor((score - 10) / 2);
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (t.isPlayer && t.characterId && vtt.campaignState?.characters?.[t.characterId]) {
                    const char = vtt.campaignState.characters[t.characterId];
                    formula = getPcRollFormula(char, 'ability', abKey);
                } else {
                    let mod = fallbackMod;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${t.name}: ${abLabel.toUpperCase()} Check`;
                rollFromToken(formula, label, t.id, 0, { vtt });
            });
            menu.remove();
        });
    });

    // Saves
    menu.querySelectorAll('.menu-roll-save').forEach((item) => {
        item.addEventListener('click', () => {
            const abKey = item.dataset.ability;
            const abLabel = item.dataset.label;

            const fallbackMod = getFallbackModIfNeeded(targetTokens, `${abLabel} Save`);
            if (fallbackMod === null) {
                menu.remove();
                return;
            }

            targetTokens.forEach((t) => {
                let formula = '';
                const mData = getResolvedMonsterData(t);
                if (mData) {
                    const score = mData[abKey] || 10;
                    let mod = Math.floor((score - 10) / 2);
                    if (mData.save && mData.save[abKey] !== undefined) {
                        mod = parseInt(mData.save[abKey]);
                    }
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (t.isPlayer && t.characterId && vtt.campaignState?.characters?.[t.characterId]) {
                    const char = vtt.campaignState.characters[t.characterId];
                    formula = getPcRollFormula(char, 'save', abKey);
                } else {
                    let mod = fallbackMod;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${t.name}: ${abLabel.toUpperCase()} Saving Throw`;
                rollFromToken(formula, label, t.id, 0, { vtt });
            });
            menu.remove();
        });
    });

    // Skills
    menu.querySelectorAll('.menu-roll-skill').forEach((item) => {
        item.addEventListener('click', () => {
            const skKey = item.dataset.skill;
            const skLabel = item.dataset.label;

            const fallbackMod = getFallbackModIfNeeded(targetTokens, `${skLabel} Check`);
            if (fallbackMod === null) {
                menu.remove();
                return;
            }

            const skillObj = skills.find((s) => s.key === skKey);

            targetTokens.forEach((t) => {
                let formula = '';
                const mData = getResolvedMonsterData(t);
                if (mData) {
                    const score = mData[skillObj.ability] || 10;
                    let mod = Math.floor((score - 10) / 2);
                    if (mData.skill && mData.skill[skKey] !== undefined) {
                        mod = parseInt(mData.skill[skKey]);
                    }
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (t.isPlayer && t.characterId && vtt.campaignState?.characters?.[t.characterId]) {
                    const char = vtt.campaignState.characters[t.characterId];
                    formula = getPcRollFormula(char, 'skill', skKey);
                } else {
                    let mod = fallbackMod;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${t.name}: ${skLabel} Check`;
                rollFromToken(formula, label, t.id, 0, { vtt });
            });
            menu.remove();
        });
    });

    // Mass Elevation
    const updateMassFlight = (newHeight) => {
        let updated = false;
        targetTokens.forEach((t) => {
            t.flightHeight = newHeight;
            updated = true;
        });
        if (updated) {
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        }
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
            updateMassFlight(val);
        });
        btnFlightInc.addEventListener('click', (e) => {
            e.stopPropagation();
            let val = parseInt(inputFlight.value) || 0;
            val += 5;
            inputFlight.value = val;
            updateMassFlight(val);
        });
        inputFlight.addEventListener('change', (e) => {
            e.stopPropagation();
            updateMassFlight(parseInt(inputFlight.value) || 0);
        });
        inputFlight.addEventListener('click', (e) => e.stopPropagation());
    }

    // Mass Conditions Toggle
    menu.querySelectorAll('.menu-toggle-mass-condition').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const condName = item.dataset.cond;

            const allHaveIt = targetTokens.every((t) => t.conditions && t.conditions.some((c) => c.name === condName));

            targetTokens.forEach((t) => {
                if (!t.conditions) t.conditions = [];
                const existingIdx = t.conditions.findIndex((c) => c.name === condName);
                if (allHaveIt) {
                    if (existingIdx !== -1) t.conditions.splice(existingIdx, 1);
                } else {
                    if (existingIdx === -1) t.conditions.push({ name: condName });
                }
            });

            if (allHaveIt) {
                item.classList.remove('is-active');
            } else {
                item.classList.add('is-active');
            }

            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        });
    });

    // Mass Clear All Conditions
    const btnMassClearAll = menu.querySelector('.menu-clear-all-conditions');
    if (btnMassClearAll) {
        btnMassClearAll.addEventListener('click', (e) => {
            e.stopPropagation();
            targetTokens.forEach((t) => {
                t.conditions = [];
            });
            menu.querySelectorAll('.menu-toggle-mass-condition').forEach((t) => t.classList.remove('is-active'));
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        });
    }

    // Add Custom Condition Modal
    const btnAddCustom = menu.querySelector('.menu-add-custom-condition');
    if (btnAddCustom) {
        btnAddCustom.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.remove();
            showAddCustomConditionModal(tokenIds, { tokens, renderAll });
        });
    }

    // Transformations
    const btnFlipH = menu.querySelector('#menu-flip-h');
    if (btnFlipH) {
        btnFlipH.addEventListener('click', () => {
            targetTokens.forEach((t) => {
                t.flipX = !t.flipX;
            });
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    }

    const btnFlipV = menu.querySelector('#menu-flip-v');
    if (btnFlipV) {
        btnFlipV.addEventListener('click', () => {
            targetTokens.forEach((t) => {
                t.flipY = !t.flipY;
            });
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    }

    const btnResetRot = menu.querySelector('#menu-reset-rotation');
    if (btnResetRot) {
        btnResetRot.addEventListener('click', () => {
            targetTokens.forEach((t) => {
                t.rotation = 0;
            });
            if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
            menu.remove();
        });
    }

    // Z-Ordering, Layer Movement, Conversions, and Deletion (GM Only)
    if (vtt.role === 'GM') {
        const btnMoveFront = menu.querySelector('#menu-move-front');
        if (btnMoveFront) {
            btnMoveFront.addEventListener('click', () => {
                changeMassTokenZOrder(tokenIds, 'front', { vtt, tokens, renderAll });
                menu.remove();
            });
        }

        const btnMoveBack = menu.querySelector('#menu-move-back');
        if (btnMoveBack) {
            btnMoveBack.addEventListener('click', () => {
                changeMassTokenZOrder(tokenIds, 'back', { vtt, tokens, renderAll });
                menu.remove();
            });
        }

        menu.querySelectorAll('.menu-ctx-move-layer').forEach((item) => {
            item.addEventListener('click', () => {
                const targetLayer = item.dataset.layer;
                targetTokens.forEach((t) => {
                    t.layer = targetLayer;
                    if (window.VTT?.chatEngine?.updateCombatantLayer) {
                        window.VTT.chatEngine.updateCombatantLayer(t.id, targetLayer);
                    }
                });
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        });

        const btnConvertFreeform = menu.querySelector('#menu-ctx-convert-freeform');
        if (btnConvertFreeform) {
            btnConvertFreeform.addEventListener('click', () => {
                targetTokens.forEach((t) => {
                    const { drawW, drawH } = getTokenDrawDimensions(t);
                    t.isAsset = true;
                    t.isBorderless = false;
                    t.pixelWidth = drawW;
                    t.pixelHeight = drawH;
                    t.imgRadius = '0';
                });
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        }

        const btnConvertBorderless = menu.querySelector('#menu-ctx-convert-borderless');
        if (btnConvertBorderless) {
            btnConvertBorderless.addEventListener('click', () => {
                targetTokens.forEach((t) => {
                    t.isAsset = false;
                    t.isBorderless = true;
                    const snap = snapToGrid(t.x, t.y, true);
                    t.x = snap.x;
                    t.y = snap.y;
                    t.size = 1;
                    if (t.assetType === 'video' || (t.url && t.url.split('?')[0].toLowerCase().endsWith('.gif'))) {
                        t.imgRadius = '50%';
                    }
                });
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        }

        const btnConvertBordered = menu.querySelector('#menu-ctx-convert-bordered');
        if (btnConvertBordered) {
            btnConvertBordered.addEventListener('click', () => {
                targetTokens.forEach((t) => {
                    t.isAsset = false;
                    t.isBorderless = false;
                    const snap = snapToGrid(t.x, t.y, true);
                    t.x = snap.x;
                    t.y = snap.y;
                    t.size = 1;
                    if (t.assetType === 'video' || (t.url && t.url.split('?')[0].toLowerCase().endsWith('.gif'))) {
                        t.imgRadius = '50%';
                    }
                });
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        }

        const btnDelete = menu.querySelector('#menu-ctx-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                tokenIds.forEach((id) => {
                    delete tokens[id];
                    selectedTokenIds.delete(id);
                });
                if (vtt.socket && typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        }
    }
}
