// ForgeDVTT Creature Sheet — Roller Subsystem
// Handles dice rolls, action macros, spell attack/damage parsing, chat posting, mass rolls, initiative, and ability checks.

import { STANDARD_DAMAGE_TYPES, evaluateDiceHelper, escapeMassRollHtml } from './creature-parser.js';
import { parseSpellMacro } from './creature-spells.js';

export { parseSpellMacro };

export function getVisibilitySetting(ctx = {}) {
    if (typeof document === 'undefined') return 'public';
    const el = document.getElementById('config-roll-visibility');
    return el ? el.value : 'public';
}

export function rollAndPostToChat(formula, label, ctx = {}) {
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;
    if (!vtt || !vtt.socket) return;

    const regex = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i;
    const match = formula.match(regex);
    if (!match) {
        postAbilityToChat(label, formula, ctx);
        return;
    }

    let count = parseInt(match[1]);
    const faces = parseInt(match[2]);
    const sign = match[3] || '+';
    const modifier = match[4] ? parseInt(match[4]) : 0;

    let isAdvantage = false;
    let isDisadvantage = false;
    let rollMode = typeof window !== 'undefined' && window.VTT ? window.VTT.currentRollMode : 'normal';
    const evt = typeof window !== 'undefined' ? window.event : null;

    if (count === 1 && faces === 20) {
        if (evt && evt.shiftKey) rollMode = 'adv';
        else if (evt && evt.ctrlKey) rollMode = 'dis';
        if (rollMode === 'adv') isAdvantage = true;
        if (rollMode === 'dis') isDisadvantage = true;
    }

    if (isAdvantage || isDisadvantage) {
        count = 2; // Roll 2d20
    }

    const diceList = [];
    for (let i = 0; i < count; i++) {
        const val = Math.floor(Math.random() * faces) + 1;
        diceList.push({ faces, val });
    }

    let subtotal = 0;
    let droppedIndex = -1;

    if (isAdvantage) {
        if (diceList[0].val >= diceList[1].val) {
            subtotal = diceList[0].val;
            droppedIndex = 1;
        } else {
            subtotal = diceList[1].val;
            droppedIndex = 0;
        }
    } else if (isDisadvantage) {
        if (diceList[0].val <= diceList[1].val) {
            subtotal = diceList[0].val;
            droppedIndex = 1;
        } else {
            subtotal = diceList[1].val;
            droppedIndex = 0;
        }
    } else {
        for (let d of diceList) {
            subtotal += d.val;
        }
    }

    if (droppedIndex !== -1) {
        diceList[droppedIndex].discarded = true;
    }

    const finalModifier = sign === '-' ? -modifier : modifier;
    const total = subtotal + finalModifier;

    const rollResult = {
        formula:
            isAdvantage || isDisadvantage ? `2d20${rollMode === 'adv' ? 'kh1' : 'kl1'}${sign}${modifier}` : formula,
        count,
        faces,
        diceList,
        modifier: finalModifier,
        total
    };
    const visibility = ctx.getVisibilitySetting ? ctx.getVisibilitySetting() : getVisibilitySetting();
    const modeText = isAdvantage ? ' (Advantage)' : isDisadvantage ? ' (Disadvantage)' : '';

    if (visibility === 'private') {
        vtt.socket.emit('chat:whisper', {
            to: vtt.username,
            text: `[${label}] rolls **${formula}**${modeText}`,
            roll: rollResult
        });
    } else {
        vtt.socket.emit('chat:msg', {
            text: `[${label}] rolls **${formula}**${modeText}`,
            roll: rollResult
        });
    }
}

export function postAbilityToChat(abilityName, text, ctx = {}) {
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;
    if (!vtt || !vtt.socket) return;
    const currentMonster = ctx.getMonster ? ctx.getMonster() : null;
    const visibility = ctx.getVisibilitySetting ? ctx.getVisibilitySetting() : getVisibilitySetting();
    const msgText = `**[${currentMonster?.name || 'Creature'}] ${abilityName}**`;

    if (visibility === 'private') {
        vtt.socket.emit('chat:whisper', { to: vtt.username, text: msgText });
    } else {
        vtt.socket.emit('chat:msg', { text: msgText });
    }
}

export function parseActionMacro(
    abilityName,
    rawEntries,
    abilityText,
    charName,
    preParsedMacro,
    rollModeOverride = null,
    m = null
) {
    const mc = {
        charName: charName || 'Creature',
        macroName: abilityName,
        atkRoll: null,
        saveInfo: null,
        dmgRolls: []
    };

    const textToCheck = `${abilityName || ''} ${abilityText || ''} ${typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries || '')}`;
    const hasMagicWeaponsTrait =
        m?.trait && Array.isArray(m.trait) && m.trait.some((t) => /magic\s+weapons?/i.test(t.name || ''));
    const isMagicAttack = !!(
        preParsedMacro?.isMagic ||
        hasMagicWeaponsTrait ||
        /magic\s+weapon\s+attack|attacks?\s+are\s+magical/i.test(textToCheck)
    );
    const isSilveredAttack = !!(preParsedMacro?.isSilvered || /silvered/i.test(textToCheck));
    const isAdamantineAttack = !!(preParsedMacro?.isAdamantine || /adamantine/i.test(textToCheck));
    const isSpellAttack = !!(preParsedMacro?.isSpell || /spell\s+attack|cast\s+a\s+spell/i.test(textToCheck));

    // Zero-regex execution: Use pre-compiled macro schema if available
    if (preParsedMacro) {
        let isCrit = false;
        if (
            preParsedMacro.isAttack &&
            preParsedMacro.attackBonus !== null &&
            preParsedMacro.attackBonus !== undefined
        ) {
            const mod = preParsedMacro.attackBonus;
            const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            const evalRoll = evaluateDiceHelper(formula, false, rollModeOverride);
            mc.atkRoll = {
                formula: formula,
                total: evalRoll.total,
                breakdownStr: evalRoll.breakdownStr,
                diceList: evalRoll.diceList,
                isCritSuccess: evalRoll.isCritSuccess,
                isCritFail: evalRoll.isCritFail
            };
            isCrit = mc.atkRoll.isCritSuccess;
        }

        if (preParsedMacro.save && preParsedMacro.save.dc) {
            mc.saveInfo = {
                dc: preParsedMacro.save.dc,
                ability:
                    preParsedMacro.save.ability && preParsedMacro.save.ability !== 'Save'
                        ? preParsedMacro.save.ability
                        : null
            };
        }

        if (preParsedMacro.damages && Array.isArray(preParsedMacro.damages) && preParsedMacro.damages.length > 0) {
            preParsedMacro.damages.forEach((d) => {
                const evalRoll = evaluateDiceHelper(d.formula, isCrit);
                const rawType = (d.type || 'Slashing').trim();
                const type =
                    STANDARD_DAMAGE_TYPES.find((dt) => dt.toLowerCase() === rawType.toLowerCase()) ||
                    rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
                mc.dmgRolls.push({
                    type: type,
                    formula: evalRoll.formula || d.formula,
                    saveRider: !!d.saveRider,
                    isMagic: d.isMagic !== undefined ? !!d.isMagic : isMagicAttack,
                    isSilvered: d.isSilvered !== undefined ? !!d.isSilvered : isSilveredAttack,
                    isAdamantine: d.isAdamantine !== undefined ? !!d.isAdamantine : isAdamantineAttack,
                    isSpell: d.isSpell !== undefined ? !!d.isSpell : isSpellAttack,
                    roll: {
                        total: evalRoll.total,
                        formula: evalRoll.formula || d.formula,
                        breakdownStr: evalRoll.breakdownStr,
                        diceList: evalRoll.diceList
                    }
                });
            });
        }

        if (mc.atkRoll || mc.saveInfo || mc.dmgRolls.length > 0) {
            return mc;
        }
    }

    const rawString = typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries || '');
    let isCrit = false;

    // Parse Attack
    const atkMatch = rawString.match(/\{@hit ([\+\-]?\d+)\}/i) || rawString.match(/([\+\-]\d+) to hit/i);
    if (atkMatch) {
        const mod = parseInt(atkMatch[1]) || 0;
        const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
        const evalRoll = evaluateDiceHelper(formula, false, rollModeOverride);
        mc.atkRoll = {
            formula: formula,
            total: evalRoll.total,
            breakdownStr: evalRoll.breakdownStr,
            diceList: evalRoll.diceList,
            isCritSuccess: evalRoll.isCritSuccess,
            isCritFail: evalRoll.isCritFail
        };
        isCrit = mc.atkRoll.isCritSuccess;
    }

    // Parse Save DC (supports 2024 "Con DC 14", "{@actSave con} {@dc 17}", 2014 "DC 14 Constitution", etc.)
    let saveAbility = null;
    const actSaveM = rawString.match(/\{@actSave\s+([a-zA-Z]+)\}/i);
    if (actSaveM) {
        saveAbility = actSaveM[1].substring(0, 3).toUpperCase();
    }

    let saveDc = null;
    const dcTagM = rawString.match(/\{@dc\s+(\d+)\}/i);
    if (dcTagM) {
        saveDc = parseInt(dcTagM[1], 10);
    }

    const preDcM = rawString.match(
        /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b(?:\s+(?:saving\s+throw|save))?\s*(?:\{@dc\s+(\d+)\}|DC\s*(\d+))/i
    );
    if (preDcM) {
        if (!saveAbility) saveAbility = preDcM[1].substring(0, 3).toUpperCase();
        if (!saveDc) saveDc = parseInt(preDcM[2] || preDcM[3], 10);
    }

    const postDcM = rawString.match(
        /(?:save\s+DC|DC)\s*(\d+)(?:\s+or\s+higher)?\s+(?:\{@actSave\s+([a-zA-Z]+)\}|(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha))/i
    );
    if (postDcM) {
        if (!saveDc) saveDc = parseInt(postDcM[1], 10);
        if (!saveAbility) saveAbility = (postDcM[2] || postDcM[3]).substring(0, 3).toUpperCase();
    }

    if (!saveDc) {
        const genDcM = rawString.match(/(?:save\s+DC|DC)\s*(\d+)/i);
        if (genDcM) {
            saveDc = parseInt(genDcM[1], 10);
        }
    }

    if (saveDc && !saveAbility) {
        const abM =
            rawString.match(
                /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b\s+saving\s+throw/i
            ) ||
            rawString.match(
                /saving\s+throw\s+against\s+(?:the\s+)?\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b/i
            );
        if (abM) {
            saveAbility = abM[1].substring(0, 3).toUpperCase();
        }
    }

    if (saveDc) {
        const validAbilities = new Set(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
        const normalizedAbility = saveAbility && validAbilities.has(saveAbility) ? saveAbility : null;
        mc.saveInfo = { dc: saveDc, ability: normalizedAbility };
    }

    // Save rider boundary detection
    let saveStartIndex = -1;
    if (mc.saveInfo) {
        const saveKeywords = [
            /\{@actSave\b/i,
            /\{@dc\b/i,
            /\bDC\s*\d+/i,
            /\bsaving\s+throw\b/i,
            /\bsave\s+DC\b/i,
            /\bmust\s+(?:make|succeed)\b/i
        ];
        for (const kw of saveKeywords) {
            const pos = rawString.search(kw);
            if (pos !== -1) {
                if (saveStartIndex === -1 || pos < saveStartIndex) {
                    saveStartIndex = pos;
                }
            }
        }
    }

    // Parse Damages
    const dmgRegex = /\{@damage ([^\}]+)\}(?:.*?([\w]+)\s+damage)?/gi;
    let match;
    const usedDamageTypes = new Set();
    while ((match = dmgRegex.exec(rawString)) !== null) {
        const formula = match[1];
        let type = match[2] ? match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase() : 'Slashing';
        if (
            ![
                'Fire',
                'Cold',
                'Lightning',
                'Thunder',
                'Poison',
                'Acid',
                'Necrotic',
                'Radiant',
                'Force',
                'Psychic',
                'Slashing',
                'Piercing',
                'Bludgeoning',
                'Healing'
            ].includes(type)
        ) {
            type = 'Slashing';
        }
        let isRider = false;
        if (!mc.atkRoll && mc.saveInfo) {
            isRider = true;
        } else if (mc.atkRoll && mc.saveInfo && saveStartIndex !== -1) {
            isRider = match.index >= saveStartIndex;
        }
        const evalRoll = evaluateDiceHelper(formula, isCrit);
        const rolledFormula = evalRoll.formula || formula;
        mc.dmgRolls.push({
            type: type,
            formula: rolledFormula,
            saveRider: isRider,
            isMagic: isMagicAttack,
            isSilvered: isSilveredAttack,
            isAdamantine: isAdamantineAttack,
            isSpell: isSpellAttack,
            roll: {
                total: evalRoll.total,
                formula: rolledFormula,
                breakdownStr: evalRoll.breakdownStr,
                diceList: evalRoll.diceList
            }
        });
        usedDamageTypes.add(type);
    }

    // Fallback for non-tagged damage text like "5 (1d6 + 2) slashing damage"
    if (mc.dmgRolls.length === 0) {
        const fallbackDmgRegex = /\d+\s*\(([^)]+)\)\s+([a-zA-Z]+)\s+damage/gi;
        while ((match = fallbackDmgRegex.exec(rawString)) !== null) {
            const formula = match[1];
            let type = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
            let isRider = false;
            if (!mc.atkRoll && mc.saveInfo) {
                isRider = true;
            } else if (mc.atkRoll && mc.saveInfo && saveStartIndex !== -1) {
                isRider = match.index >= saveStartIndex;
            }
            const evalRoll = evaluateDiceHelper(formula, isCrit);
            const rolledFormula = evalRoll.formula || formula;
            mc.dmgRolls.push({
                type: type,
                formula: rolledFormula,
                saveRider: isRider,
                isMagic: isMagicAttack,
                isSilvered: isSilveredAttack,
                isAdamantine: isAdamantineAttack,
                roll: {
                    total: evalRoll.total,
                    formula: rolledFormula,
                    breakdownStr: evalRoll.breakdownStr,
                    diceList: evalRoll.diceList
                }
            });
        }
    }

    return mc;
}

export function showMassRollDialog({ abilityName, charName, initialMode, hasAttack, onConfirm }) {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('vtt-mass-roll-backdrop');
    if (existing) {
        if (typeof existing._cleanup === 'function') existing._cleanup();
        existing.remove();
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'vtt-mass-roll-backdrop';
    backdrop.className = 'vtt-modal-backdrop';

    let currentCount = 2;
    let currentMode = initialMode || 'normal';

    const dialog = document.createElement('div');
    dialog.className = 'vtt-mass-roll-dialog';
    dialog.innerHTML = `
        <div class="mass-roll-header">
            <div class="mass-roll-title">
                <i class="fa-solid fa-dice-d20"></i>
                <span>Mass Roll: ${escapeMassRollHtml(abilityName)}</span>
            </div>
            <button type="button" class="mass-roll-close" id="btn-mass-roll-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mass-roll-body">
            <div class="mass-roll-creature-info">${escapeMassRollHtml(charName)}</div>
            
            <div>
                <div class="mass-roll-label">
                    <span>Number of Rolls</span>
                    <span id="mass-roll-count-display" style="color:var(--color-gold-light); font-family:var(--font-mono, monospace);">2</span>
                </div>
                <div class="mass-roll-count-row">
                    <button type="button" class="mass-roll-step-btn" id="mass-roll-minus">-</button>
                    <input type="number" class="mass-roll-input" id="mass-roll-input" value="2" min="1" max="50">
                    <button type="button" class="mass-roll-step-btn" id="mass-roll-plus">+</button>
                </div>
            </div>

            <div class="mass-roll-presets">
                <button type="button" class="mass-roll-preset-chip" data-count="2">2x</button>
                <button type="button" class="mass-roll-preset-chip" data-count="3">3x</button>
                <button type="button" class="mass-roll-preset-chip" data-count="4">4x</button>
                <button type="button" class="mass-roll-preset-chip" data-count="5">5x</button>
                <button type="button" class="mass-roll-preset-chip" data-count="8">8x</button>
                <button type="button" class="mass-roll-preset-chip" data-count="10">10x</button>
            </div>

            ${
                hasAttack
                    ? `
            <div>
                <div class="mass-roll-label">Roll Mode</div>
                <div class="mass-roll-mode-group" id="mass-roll-mode-group">
                    <button type="button" class="mass-roll-mode-btn ${currentMode === 'normal' ? 'active' : ''}" data-mode="normal">
                        <i class="fa-solid fa-dice"></i> Normal
                    </button>
                    <button type="button" class="mass-roll-mode-btn ${currentMode === 'adv' ? 'active' : ''}" data-mode="adv">
                        <i class="fa-solid fa-angles-up"></i> Advantage
                    </button>
                    <button type="button" class="mass-roll-mode-btn ${currentMode === 'dis' ? 'active' : ''}" data-mode="dis">
                        <i class="fa-solid fa-angles-down"></i> Disadvantage
                    </button>
                </div>
            </div>
            `
                    : ''
            }
        </div>
        <div class="mass-roll-footer">
            <button type="button" class="btn-mass-roll-cancel" id="btn-mass-roll-cancel">Cancel</button>
            <button type="button" class="btn-mass-roll-confirm" id="btn-mass-roll-confirm">
                <i class="fa-solid fa-dice-d20"></i> <span id="btn-mass-roll-confirm-label">Roll 2 Attacks</span>
            </button>
        </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const inputEl = dialog.querySelector('#mass-roll-input');
    const countDisplay = dialog.querySelector('#mass-roll-count-display');
    const confirmLabel = dialog.querySelector('#btn-mass-roll-confirm-label');

    function updateCount(val) {
        currentCount = Math.max(1, Math.min(50, parseInt(val) || 1));
        inputEl.value = currentCount;
        if (countDisplay) countDisplay.textContent = currentCount;
        if (confirmLabel) confirmLabel.textContent = `Roll ${currentCount} ${hasAttack ? 'Attacks' : 'Times'}`;
    }

    inputEl.focus();
    inputEl.select();

    inputEl.addEventListener('input', () => updateCount(inputEl.value));
    dialog.querySelector('#mass-roll-minus').addEventListener('click', () => updateCount(currentCount - 1));
    dialog.querySelector('#mass-roll-plus').addEventListener('click', () => updateCount(currentCount + 1));

    dialog.querySelectorAll('.mass-roll-preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const c = parseInt(chip.dataset.count) || 2;
            updateCount(c);
        });
    });

    if (hasAttack) {
        dialog.querySelectorAll('.mass-roll-mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                dialog.querySelectorAll('.mass-roll-mode-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
            });
        });
    }

    function cleanupListener() {
        if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeyDown);
    }
    backdrop._cleanup = cleanupListener;

    function closeDialog() {
        cleanupListener();
        backdrop.remove();
    }

    function doConfirm() {
        closeDialog();
        if (typeof onConfirm === 'function') {
            onConfirm(currentCount, currentMode);
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialog();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            doConfirm();
        }
    }

    if (typeof window !== 'undefined') window.addEventListener('keydown', onKeyDown);
    dialog.querySelector('#btn-mass-roll-close').addEventListener('click', closeDialog);
    dialog.querySelector('#btn-mass-roll-cancel').addEventListener('click', closeDialog);
    dialog.querySelector('#btn-mass-roll-confirm').addEventListener('click', doConfirm);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeDialog();
    });
}

export function executeMassRolls({
    count,
    rollMode,
    abilityName,
    rawEntries,
    abilityText,
    charName,
    preParsedMacro,
    ctx = {}
}) {
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;
    if (!vtt || !vtt.socket) return;
    const visibility = ctx.getVisibilitySetting ? ctx.getVisibilitySetting() : getVisibilitySetting(ctx);
    const attacks = [];
    let index = 0;

    function rollNext() {
        if (index < count) {
            const i = index + 1;
            const curM = ctx.getMonster ? ctx.getMonster() : null;
            const macroCard = parseActionMacro(
                abilityName,
                rawEntries,
                abilityText,
                charName,
                preParsedMacro,
                rollMode,
                curM
            );
            const msgOut = {
                text: `uses ${abilityName} (#${i})`,
                macroCard: macroCard,
                creatureName: charName
            };

            // [BEHAVIOR NOTE - INTENTIONAL DESIGN]:
            // Individual attack macro cards are intentionally emitted sequentially to chat to provide
            // granular rolling breakdown, discrete 3D dice physics trigger points, and standalone action history
            // before the consolidated summary Mass Attack Card is generated below.
            if (visibility === 'private' || visibility === 'gm') {
                msgOut.to = vtt.username;
                vtt.socket.emit('chat:whisper', msgOut);
            } else {
                vtt.socket.emit('chat:msg', msgOut);
            }

            attacks.push({
                index: i,
                atkRoll: macroCard.atkRoll
                    ? {
                          formula: macroCard.atkRoll.formula,
                          total: macroCard.atkRoll.total,
                          breakdownStr: macroCard.atkRoll.breakdownStr,
                          diceList: macroCard.atkRoll.diceList,
                          isCritSuccess: macroCard.atkRoll.isCritSuccess,
                          isCritFail: macroCard.atkRoll.isCritFail
                      }
                    : null,
                dmgRolls: (macroCard.dmgRolls || []).map((dr) => ({
                    type: dr.type,
                    formula: dr.formula,
                    saveRider: !!dr.saveRider,
                    isMagic: !!dr.isMagic,
                    isSilvered: !!dr.isSilvered,
                    isAdamantine: !!dr.isAdamantine,
                    isSpell: !!dr.isSpell,
                    roll: {
                        total: dr.roll?.total || 0,
                        formula: dr.roll?.formula || dr.formula,
                        breakdownStr: dr.roll?.breakdownStr || ''
                    }
                })),
                saveInfo: macroCard.saveInfo || null
            });

            index++;
            setTimeout(rollNext, 150);
        } else {
            const massAttackCard = {
                creatureName: charName,
                abilityName: abilityName,
                rollMode: rollMode,
                attacks: attacks,
                resolved: null,
                timestamp: Date.now()
            };

            // [BEHAVIOR NOTE - INTENTIONAL DESIGN]:
            // whisperToGM: true is intentional for MassAttackCard so GM retains exclusive orchestration
            // and target allocation controls over mass combat resolutions before results are broadcast.
            vtt.socket.emit('chat:msg', {
                whisperToGM: true,
                massAttackCard: massAttackCard
            });
        }
    }

    rollNext();
}

export function wireInitiativeRoll(panel, m, ctx = {}) {
    const contentEl = panel || (ctx.getContentEl ? ctx.getContentEl() : document);
    if (!contentEl) return;
    const initBtns = contentEl.querySelectorAll('.cs-roll-initiative-btn');
    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;

    initBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const dexScore = m.dex || 10;
            let initMod = Math.floor((dexScore - 10) / 2);
            if (m.initiative !== undefined) {
                if (typeof m.initiative === 'number') initMod = m.initiative;
                else if (typeof m.initiative?.bonus === 'number') initMod = m.initiative.bonus;
            }
            const modStr = initMod >= 0 ? `+${initMod}` : `${initMod}`;
            const formula = `1d20${modStr}`;

            let rollData = null;
            if (typeof window !== 'undefined' && window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.simulateRoll) {
                rollData = window.vttPlayerSheetAPI.simulateRoll(formula);
            } else {
                const r = Math.floor(Math.random() * 20) + 1;
                rollData = { total: r + initMod, rolls: [r], modifier: initMod, formula };
            }

            let isTiebreaker = true;
            if (typeof window !== 'undefined' && window.VTT?.campaignState?.settings?.initDexTiebreaker !== undefined) {
                isTiebreaker = !!window.VTT.campaignState.settings.initDexTiebreaker;
            } else if (typeof window !== 'undefined' && window.VTT?.canvasEngine?.getCampaignSettings) {
                isTiebreaker = window.VTT.canvasEngine.getCampaignSettings().initDexTiebreaker !== false;
            }

            if (isTiebreaker && rollData && typeof rollData.total === 'number') {
                const dexTiebreaker = Math.round(dexScore) / 100;
                rollData.total = Math.round((rollData.total + dexTiebreaker) * 100) / 100;
            }

            if (typeof window !== 'undefined' && window.VTT && window.VTT.socket) {
                const visibility = ctx.getVisibilitySetting ? ctx.getVisibilitySetting() : getVisibilitySetting();
                if (visibility === 'private' || visibility === 'gm') {
                    window.VTT.socket.emit('chat:whisper', {
                        to: window.VTT.username,
                        text: `[${m.name}] rolls **Initiative**`,
                        roll: rollData
                    });
                } else {
                    window.VTT.socket.emit('chat:msg', {
                        text: `[${m.name}] rolls **Initiative**`,
                        roll: rollData
                    });
                }
            }

            if (typeof window !== 'undefined' && window.VTT && window.VTT.chatEngine) {
                const monsterImg = ctx.getMonsterImageUrl ? ctx.getMonsterImageUrl(m) : null;
                let added = false;
                if (linkedTokenId) {
                    window.VTT.chatEngine.addToInitiative(m.name, rollData.total, linkedTokenId, monsterImg);
                    added = true;
                }
                if (window.VTT.canvasEngine) {
                    const selectedIds = window.VTT.canvasEngine.getSelectedTokenIds();
                    const tokens = window.VTT.canvasEngine.getTokens();
                    selectedIds.forEach((tId) => {
                        const t = tokens[tId];
                        if (t && (t.characterId === linkedCharacterId || t.name === m.name)) {
                            if (tId !== linkedTokenId) {
                                window.VTT.chatEngine.addToInitiative(
                                    t.name,
                                    rollData.total,
                                    t.id,
                                    t.img || monsterImg
                                );
                                added = true;
                            }
                        }
                    });
                }
                if (!added) {
                    window.VTT.chatEngine.addToInitiative(m.name, rollData.total, null, monsterImg);
                }
            }
        });
    });
}

export function wireAbilityScoreClicks(panel, m, ctx = {}) {
    const contentEl = panel || (ctx.getContentEl ? ctx.getContentEl() : document);
    if (!contentEl) return;

    contentEl.querySelectorAll('.cs-ability-cell').forEach((cell) => {
        const checkBtn = cell.querySelector('.cs-roll-check');
        const saveBtn = cell.querySelector('.cs-roll-save');
        const ab = (cell.dataset.ability || '').toUpperCase();
        const curM = ctx.getMonster ? ctx.getMonster() : m;

        if (checkBtn) {
            checkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mod = parseInt(cell.dataset.mod) || 0;
                const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                const label = `${curM?.name || 'Creature'}: ${ab} Check`;
                rollAndPostToChat(formula, label, ctx);
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                let mod = parseInt(cell.dataset.mod) || 0;
                if (curM && curM.save && curM.save[cell.dataset.ability]) {
                    mod = parseInt(curM.save[cell.dataset.ability]) || 0;
                }
                const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                const label = `${curM?.name || 'Creature'}: ${ab} Saving Throw`;
                rollAndPostToChat(formula, label, ctx);
            });
        }

        cell.addEventListener('click', (e) => {
            if (e.target.closest('.cs-ability-actions')) return;
            const mod = parseInt(cell.dataset.mod) || 0;
            const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            const label = `${curM?.name || 'Creature'}: ${ab} Check`;
            rollAndPostToChat(formula, label, ctx);
        });
    });
}
