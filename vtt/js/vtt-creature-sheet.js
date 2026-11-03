// ForgeDVTT Creature Sheet — Master Orchestrator Module
// Decomposed into modular ES subsystems under js/creature-sheet/
import {
    STANDARD_DAMAGE_TYPES,
    toSpellTitleCase,
    cleanTags,
    flattenEntriesToText,
    parse5eMarkup,
    injectDiceChips,
    calcDiceAverage,
    entryToPlainText,
    formatRawEntry,
    isPassiveAbility,
    buildTypeString,
    sizeCode,
    buildSpeedString,
    formatSkillName,
    buildSavesHtml,
    buildSkillsHtml,
    formatDefenseEntry,
    formatDamageList,
    buildImmunityHtml,
    getProfBonus,
    getModifier,
    formatModifier,
    parseAc,
    capitalize,
    escapeMassRollHtml,
    normalizeMonsterDamages,
    evaluateDiceHelper
} from './creature-sheet/creature-parser.js';

import {
    resolveSpellcastingType,
    get5eSlotsForCaster,
    showVttPrompt,
    syncSlotsState,
    wireSpellSlots,
    ensureSpellcastingFromTraits,
    findExistingSpell,
    ensureNpcSpells,
    getMaxSlotsForLevel,
    getSpellFromMonster,
    renderSingleSpellRowHtml,
    buildSpellcastingHtml,
    getCleanedSpellBody,
    renderAndInjectSpell,
    extractSpellcastingStats,
    ensureCreatureUpcastModal,
    promptCreatureUpcastLevel,
    getUpcastBonus,
    parseSpellMacro,
    expendNpcSpellResource,
    rollNpcSpell,
    extractSpellContext,
    ensureSpellIsParsed,
    setupCsSpellListeners,
    saveAndRenderNpcSpells
} from './creature-sheet/creature-spells.js';

import {
    getVisibilitySetting,
    rollAndPostToChat,
    postAbilityToChat,
    parseActionMacro,
    showMassRollDialog,
    executeMassRolls,
    wireInitiativeRoll,
    wireAbilityScoreClicks
} from './creature-sheet/creature-roller.js';

import {
    defenseToEditableRows,
    editableRowsToDefenses,
    parseDefenseTextInput,
    openCreatureDefenseConfigModal,
    openEditModal,
    saveCompanionEdits
} from './creature-sheet/creature-editor.js';

import {
    setupPanelResizing,
    generateArcaneTokenDataUrl,
    getMonsterImageUrl,
    getLinkedTokenHp,
    wireHpControls,
    wireTabs,
    wireCollapsibleHandlers,
    extractLairTitle,
    buildAbilityEntryHtml,
    buildAbilitySection,
    buildLegendarySection,
    buildVariantSection,
    saveMonsterData,
    renderStatBlock
} from './creature-sheet/creature-renderer.js';

// Export subsystem utilities for external Consumers
export {
    STANDARD_DAMAGE_TYPES,
    toSpellTitleCase,
    cleanTags,
    flattenEntriesToText,
    parse5eMarkup,
    injectDiceChips,
    calcDiceAverage,
    entryToPlainText,
    formatRawEntry,
    isPassiveAbility,
    buildTypeString,
    sizeCode,
    buildSpeedString,
    formatSkillName,
    buildSavesHtml,
    buildSkillsHtml,
    formatDefenseEntry,
    formatDamageList,
    buildImmunityHtml,
    getProfBonus,
    getModifier,
    formatModifier,
    parseAc,
    capitalize,
    escapeMassRollHtml,
    normalizeMonsterDamages,
    evaluateDiceHelper,
    resolveSpellcastingType,
    get5eSlotsForCaster,
    showVttPrompt,
    syncSlotsState,
    wireSpellSlots,
    ensureSpellcastingFromTraits,
    findExistingSpell,
    ensureNpcSpells,
    getMaxSlotsForLevel,
    getSpellFromMonster,
    renderSingleSpellRowHtml,
    buildSpellcastingHtml,
    getCleanedSpellBody,
    renderAndInjectSpell,
    extractSpellcastingStats,
    ensureCreatureUpcastModal,
    promptCreatureUpcastLevel,
    getUpcastBonus,
    parseSpellMacro,
    expendNpcSpellResource,
    rollNpcSpell,
    extractSpellContext,
    ensureSpellIsParsed,
    setupCsSpellListeners,
    saveAndRenderNpcSpells,
    getVisibilitySetting,
    rollAndPostToChat,
    postAbilityToChat,
    parseActionMacro,
    showMassRollDialog,
    executeMassRolls,
    wireInitiativeRoll,
    wireAbilityScoreClicks,
    defenseToEditableRows,
    editableRowsToDefenses,
    parseDefenseTextInput,
    openCreatureDefenseConfigModal,
    openEditModal,
    saveCompanionEdits,
    setupPanelResizing,
    generateArcaneTokenDataUrl,
    getMonsterImageUrl,
    getLinkedTokenHp,
    wireHpControls,
    wireTabs,
    wireCollapsibleHandlers,
    extractLairTitle,
    buildAbilityEntryHtml,
    buildAbilitySection,
    buildLegendarySection,
    buildVariantSection,
    saveMonsterData,
    renderStatBlock
};

export function initVttCreatureSheet(vtt) {
    const panel = typeof document !== 'undefined' ? document.getElementById('creature-sheet-panel') : null;
    const minimizeBtn = typeof document !== 'undefined' ? document.getElementById('creature-sheet-minimize-btn') : null;
    const contentEl = typeof document !== 'undefined' ? document.getElementById('vtt-creature-sheet-panel') : null;

    if (!panel || !minimizeBtn || !contentEl) {
        console.warn('[CreatureSheet] Panel elements not found in DOM.');
    }

    if (panel) {
        setupPanelResizing(panel);
    }

    let currentMonster = null;
    let linkedTokenId = null;
    let linkedCharacterId = null;
    let isMinimized = false;
    let spellCache = null;

    // ─── Reactive Subsystem Context ──────────────────────────────────────────
    const creatureCtx = {
        getMonster: () => currentMonster,
        setMonster: (m) => {
            currentMonster = m;
        },
        getLinkedTokenId: () => linkedTokenId,
        setLinkedTokenId: (tId) => {
            linkedTokenId = tId;
        },
        getLinkedCharacterId: () => linkedCharacterId,
        setLinkedCharacterId: (cId) => {
            linkedCharacterId = cId;
        },
        getVtt: () => vtt,
        getPanel: () => panel,
        getContentEl: () => contentEl,
        minimizePanel,
        openPanel,
        renderStatBlock: (m) => renderStatBlock(m, contentEl, creatureCtx),
        saveAndRenderNpcSpells: (m, spellData) => saveAndRenderNpcSpells(m, spellData, creatureCtx),
        saveMonsterData: (m) => saveMonsterData(m, creatureCtx),
        getVisibilitySetting: () => getVisibilitySetting(creatureCtx),
        getMonsterImageUrl: (m) => getMonsterImageUrl(m, creatureCtx),
        openEditModal: (m, charId) => openEditModal(m, charId, creatureCtx),
        openCreatureDefenseConfigModal: (defenses, onApply) => openCreatureDefenseConfigModal(defenses, onApply)
    };

    // ─── Panel open / minimize / expand ──────────────────────────────────────
    function openPanel() {
        console.log('[vtt-creature-sheet] openPanel called');
        if (
            typeof window !== 'undefined' &&
            window.VTT &&
            window.VTT.playerSheet &&
            typeof window.VTT.playerSheet.minimizePanel === 'function'
        ) {
            window.VTT.playerSheet.minimizePanel();
            const playerPanel = document.getElementById('player-sheet-panel');
            if (playerPanel) playerPanel.style.zIndex = '50';
        }
        if (panel) {
            panel.style.zIndex = '55';
            panel.classList.add('open');
            panel.classList.remove('minimized');
        }
        isMinimized = false;
        if (minimizeBtn) {
            minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            minimizeBtn.title = 'Minimize Creature Sheet';
        }
        if (typeof window !== 'undefined' && window.VTT?.mobileAdapter?.syncCreatureSheetTopbar) {
            window.VTT.mobileAdapter.syncCreatureSheetTopbar();
        }
        console.log('[vtt-creature-sheet] openPanel completed');
    }

    function minimizePanel() {
        if (panel) {
            panel.classList.remove('open');
            panel.classList.add('minimized');
        }
        isMinimized = true;
        if (minimizeBtn) {
            minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            minimizeBtn.title = 'Expand Creature Sheet';
        }
    }

    function resetSheet() {
        currentMonster = null;
        linkedTokenId = null;
        linkedCharacterId = null;
        if (contentEl) {
            contentEl.innerHTML = `
                <div class="cs-placeholder">
                    <i class="fa-solid fa-dragon"></i>
                    <p>Right-click a token or click a monster in the Bestiary to open its stat block.</p>
                </div>
            `;
        }
        minimizePanel();
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            if (isMinimized) {
                openPanel();
            } else {
                minimizePanel();
            }
        });
    }

    // ─── Main entry: open a creature sheet ───────────────────────────────────
    async function openSheet(monsterData, tokenId, characterId) {
        console.log('[vtt-creature-sheet] openSheet called', { monsterData, tokenId, characterId });
        if (!monsterData) return;

        const activeCharId =
            characterId ||
            (tokenId && window.VTT?.canvasEngine?.getTokens()?.[tokenId]?.characterId) ||
            (tokenId && window.VTT?.canvasEngine?.getTokens()?.[tokenId]?.sourceCharacterId);
        const linkedChar =
            activeCharId && window.VTT?.campaignState?.characters
                ? window.VTT.campaignState.characters[activeCharId]
                : null;
        if (linkedChar && monsterData) {
            if (linkedChar.name && monsterData.name !== linkedChar.name) {
                monsterData.name = linkedChar.name;
            }
            normalizeMonsterDamages(monsterData);
        }

        if (window.VTT?.sheetDock && !window.VTT.sheetDock._internalCall) {
            window.VTT.sheetDock.openSheet({
                type: 'creature',
                monsterData,
                tokenId,
                characterId: activeCharId || characterId,
                name: monsterData.name,
                avatar: monsterData.tokenUrl || monsterData.img,
                isCompanion: Boolean(monsterData.isCompanion || linkedChar?.isCompanion),
                isCustomNpc: Boolean(monsterData.isCustomNpc || linkedChar?.isCustomNpc),
                isGeneric:
                    monsterData.isGeneric !== undefined
                        ? monsterData.isGeneric
                        : !(
                              monsterData.isCompanion ||
                              monsterData.isCustomNpc ||
                              linkedChar?.isCompanion ||
                              linkedChar?.isCustomNpc
                          )
            });
            return;
        }

        // Hydrate from single-creature API only if monsterData is an un-hydrated catalog summary and NOT a custom companion/NPC
        const lookupId = monsterData.id || monsterData.name;
        const isCustomOrCompanion = Boolean(
            characterId ||
            linkedCharacterId ||
            monsterData.isCompanion ||
            monsterData.isCustomNpc ||
            (characterId && window.VTT?.campaignState?.characters?.[characterId])
        );
        const isCatalogOnly =
            !isCustomOrCompanion &&
            Boolean(
                monsterData.source &&
                lookupId &&
                ((!monsterData.actions && !monsterData.action) ||
                    (monsterData.hasSpellcasting &&
                        (!monsterData.spellcasting || monsterData.spellcasting.length === 0)))
            );
        if (isCatalogOnly) {
            try {
                let full = null;
                if (typeof window !== 'undefined' && window.fetchFullCreature) {
                    full = await window.fetchFullCreature(monsterData.source, lookupId);
                }
                if (!full && typeof fetch === 'function') {
                    try {
                        const res = await fetch(
                            `/api/creature/${encodeURIComponent(monsterData.source)}/${encodeURIComponent(lookupId)}`
                        );
                        if (res.ok) full = await res.json();
                    } catch (e) {}
                }
                if (!full && typeof fetch === 'function') {
                    try {
                        let partRes = await fetch(
                            `/data/bestiary-normalized/bestiary-${monsterData.source.toLowerCase()}.json`
                        );
                        if (!partRes.ok)
                            partRes = await fetch(
                                `/vtt/data/bestiary-normalized/bestiary-${monsterData.source.toLowerCase()}.json`
                            );
                        if (partRes.ok) {
                            const partData = await partRes.json();
                            const cleanLookup = lookupId.toLowerCase();
                            full = partData.find(
                                (m) => m.id?.toLowerCase() === cleanLookup || m.name?.toLowerCase() === cleanLookup
                            );
                        }
                    } catch (e) {}
                }
                if (full) {
                    monsterData = Object.assign({}, full, monsterData, {
                        spellcasting: monsterData.spellcasting || full.spellcasting,
                        actions: monsterData.actions || monsterData.action || full.actions,
                        bonusActions: monsterData.bonusActions || monsterData.bonus || full.bonusActions,
                        reactions: monsterData.reactions || monsterData.reaction || full.reactions,
                        legendaryActions:
                            monsterData.legendaryActions || monsterData.legendary || full.legendaryActions,
                        legendaryActionsLair: monsterData.legendaryActionsLair ?? full.legendaryActionsLair,
                        legendaryGroup: monsterData.legendaryGroup || full.legendaryGroup,
                        lairActions:
                            monsterData.lairActions && monsterData.lairActions.length > 0
                                ? monsterData.lairActions
                                : full.lairActions,
                        lairHeader: monsterData.lairHeader || full.lairHeader,
                        lairActionsDesc: monsterData.lairActionsDesc || full.lairActionsDesc,
                        regionalEffects:
                            monsterData.regionalEffects && monsterData.regionalEffects.length > 0
                                ? monsterData.regionalEffects
                                : full.regionalEffects,
                        regionalEffectsHtml: monsterData.regionalEffectsHtml || full.regionalEffectsHtml,
                        mythicActions: monsterData.mythicActions || full.mythicActions,
                        traits: monsterData.traits || monsterData.trait || full.traits,
                        abilities: monsterData.abilities || full.abilities,
                        str: monsterData.str ?? full.str ?? full.abilities?.str?.score,
                        dex: monsterData.dex ?? full.dex ?? full.abilities?.dex?.score,
                        con: monsterData.con ?? full.con ?? full.abilities?.con?.score,
                        int: monsterData.int ?? full.int ?? full.abilities?.int?.score,
                        wis: monsterData.wis ?? full.wis ?? full.abilities?.wis?.score,
                        cha: monsterData.cha ?? full.cha ?? full.abilities?.cha?.score,
                        save: monsterData.save ?? monsterData.saves ?? full.save ?? full.saves,
                        saves: monsterData.saves ?? monsterData.save ?? full.saves ?? full.save,
                        skill: monsterData.skill ?? monsterData.skills ?? full.skill ?? full.skills,
                        skills: monsterData.skills ?? monsterData.skill ?? full.skills ?? full.skill,
                        immune: monsterData.immune ?? full.immune,
                        resist: monsterData.resist ?? full.resist,
                        vulnerable: monsterData.vulnerable ?? full.vulnerable,
                        conditionImmune: monsterData.conditionImmune ?? full.conditionImmune,
                        senses: monsterData.senses || full.senses,
                        speed: monsterData.speed || full.speed,
                        hp: monsterData.hp || full.hp,
                        ac: monsterData.ac || full.ac,
                        primaryAc: monsterData.primaryAc ?? full.primaryAc
                    });
                }
            } catch (err) {
                console.warn('[vtt-creature-sheet] Could not hydrate monsterData:', err);
            }
        }

        // Check if this sheet is already popped out into a separate window/tab
        const keyId =
            tokenId || characterId || (monsterData ? `${monsterData.name}_${monsterData.source || ''}` : null);
        let checkType = 'creature';
        if (characterId && window.VTT?.campaignState?.characters?.[characterId]) {
            const c = window.VTT.campaignState.characters[characterId];
            if (c.isCompanion) checkType = 'companion';
            else if (c.isCustomNpc) checkType = 'npc';
        }
        const sheetKey = window.SheetWindowManager ? window.SheetWindowManager.getSheetKey(checkType, keyId) : null;
        if (
            !vtt.isStandaloneSheet &&
            sheetKey &&
            window.SheetWindowManager &&
            window.SheetWindowManager.isSheetPoppedOut(sheetKey)
        ) {
            window.SheetWindowManager.focusPoppedOut(sheetKey);
            return;
        }

        currentMonster = monsterData;
        linkedTokenId = tokenId || null;
        linkedCharacterId = characterId || null;

        try {
            renderStatBlock(currentMonster, contentEl, creatureCtx);
            console.log('[vtt-creature-sheet] renderStatBlock successful');
        } catch (err) {
            console.error('[vtt-creature-sheet] renderStatBlock ERROR', err);
        }
        openPanel();
    }

    // ─── Event delegation for dice chips and ability name clicks ─────────────
    if (contentEl) {
        contentEl.addEventListener('click', async (e) => {
            const rollerTarget = e.target.closest('.dice-chip, .render-roller');
            if (rollerTarget) {
                if (rollerTarget.classList.contains('dc-chip')) {
                    const dcVal = rollerTarget.dataset.dc;
                    const visibility = getVisibilitySetting(creatureCtx);

                    const isSpellcasting = !!rollerTarget.closest('.cs-spellcasting-header');
                    const label = isSpellcasting ? 'Spellcasting DC' : 'Save DC';

                    const abilityCard = {
                        creatureName: currentMonster?.name || 'Creature',
                        abilityName: label,
                        text: `<div style="text-align: center; font-size: 1.8em; margin: 12px 0; color: var(--color-gold-base); font-weight: bold;">DC ${dcVal}</div>`
                    };

                    if (visibility === 'private' || visibility === 'gm') {
                        vtt.socket.emit('chat:whisper', { to: vtt.username, text: `pings ${label}`, abilityCard });
                    } else {
                        vtt.socket.emit('chat:msg', { text: `pings ${label}`, abilityCard });
                    }
                    e.stopPropagation();
                    return;
                }

                let formula = rollerTarget.dataset.formula;
                if (!formula && rollerTarget.classList.contains('render-roller')) {
                    formula = rollerTarget.textContent.trim();
                }
                const labelAttr = rollerTarget.dataset.label;
                const label = labelAttr
                    ? `${currentMonster?.name || 'Creature'}: ${labelAttr}`
                    : currentMonster?.name || 'Creature';
                if (formula) rollAndPostToChat(formula, label, creatureCtx);
                e.stopPropagation();
                return;
            }

            const infoEl = e.target.closest('.cs-ability-info-btn');
            if (infoEl) {
                const entry = infoEl.closest('.cs-ability-entry');
                if (!entry) return;
                const nameEl = entry.querySelector('.cs-ability-name');
                let abilityName = nameEl ? nameEl.textContent.trim() : 'Ability';
                if (abilityName === 'Ping') abilityName = 'Ability';

                const abilityText = entry.querySelector('.cs-ability-text')?.innerHTML.trim() || '';
                const visibility = getVisibilitySetting(creatureCtx);

                const abilityCard = {
                    creatureName: currentMonster?.name || 'Creature',
                    abilityName: abilityName,
                    text: abilityText
                };

                if (visibility === 'private' || visibility === 'gm') {
                    vtt.socket.emit('chat:whisper', { to: vtt.username, text: `pings ${abilityName}`, abilityCard });
                } else {
                    vtt.socket.emit('chat:msg', { text: `pings ${abilityName}`, abilityCard });
                }
                e.stopPropagation();
                return;
            }

            const nameEl = e.target.closest('.cs-ability-name');
            if (nameEl) {
                const entry = nameEl.closest('.cs-ability-entry');
                if (!entry) return;
                let abilityName = nameEl.textContent.trim();
                if (abilityName === 'Ping') abilityName = 'Ability';

                const abilityText = entry.querySelector('.cs-ability-text')?.innerHTML.trim() || '';
                const rawJsonEl = entry.querySelector('.cs-ability-raw');
                const macroJsonEl = entry.querySelector('.cs-ability-macro');
                let rawEntries = [];
                let preParsedMacro = null;
                if (rawJsonEl) {
                    try {
                        rawEntries = JSON.parse(decodeURIComponent(rawJsonEl.textContent));
                    } catch (err) {}
                }
                if (macroJsonEl && macroJsonEl.textContent) {
                    try {
                        preParsedMacro = JSON.parse(decodeURIComponent(macroJsonEl.textContent));
                    } catch (err) {}
                }
                const charName = currentMonster?.name || 'Creature';
                const macroCard = parseActionMacro(
                    abilityName,
                    rawEntries,
                    abilityText,
                    charName,
                    preParsedMacro,
                    null,
                    currentMonster
                );

                if (!macroCard.atkRoll && !macroCard.saveInfo && macroCard.dmgRolls.length === 0) {
                    const abilityCard = {
                        creatureName: currentMonster?.name || 'Creature',
                        abilityName: abilityName,
                        text: abilityText
                    };
                    const visibility = getVisibilitySetting(creatureCtx);
                    if (visibility === 'private' || visibility === 'gm') {
                        vtt.socket.emit('chat:whisper', { to: vtt.username, text: `uses ${abilityName}`, abilityCard });
                    } else {
                        vtt.socket.emit('chat:msg', { text: `uses ${abilityName}`, abilityCard });
                    }
                } else {
                    const visibility = getVisibilitySetting(creatureCtx);
                    const msgOut = {
                        text: `uses ${abilityName}`,
                        macroCard: macroCard,
                        creatureName: currentMonster?.name || 'Creature'
                    };
                    if (visibility === 'private' || visibility === 'gm') {
                        msgOut.to = vtt.username;
                        vtt.socket.emit('chat:whisper', msgOut);
                    } else {
                        vtt.socket.emit('chat:msg', msgOut);
                    }
                }
                e.stopPropagation();
                return;
            }
        });

        // ─── Mass Roll Context Menu & Workflow ────────────────────────────────
        contentEl.addEventListener('contextmenu', async (e) => {
            const nameEl = e.target.closest('.cs-ability-name');
            if (!nameEl) return;
            const entry = nameEl.closest('.cs-ability-entry');
            if (!entry) return;

            let abilityName = nameEl.textContent.trim();
            if (abilityName === 'Ping') abilityName = 'Ability';

            const abilityText = entry.querySelector('.cs-ability-text')?.innerHTML.trim() || '';
            const rawJsonEl = entry.querySelector('.cs-ability-raw');
            const macroJsonEl = entry.querySelector('.cs-ability-macro');
            let rawEntries = [];
            let preParsedMacro = null;
            if (rawJsonEl) {
                try {
                    rawEntries = JSON.parse(decodeURIComponent(rawJsonEl.textContent));
                } catch (err) {}
            }
            if (macroJsonEl && macroJsonEl.textContent) {
                try {
                    preParsedMacro = JSON.parse(decodeURIComponent(macroJsonEl.textContent));
                } catch (err) {}
            }
            const charName = currentMonster?.name || 'Creature';

            const probeMacro = parseActionMacro(
                abilityName,
                rawEntries,
                abilityText,
                charName,
                preParsedMacro,
                'normal',
                currentMonster
            );
            if (!probeMacro.atkRoll && (!probeMacro.dmgRolls || probeMacro.dmgRolls.length === 0)) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            let initialMode = 'normal';
            if (e.shiftKey) initialMode = 'adv';
            else if (e.ctrlKey) initialMode = 'dis';

            showMassRollDialog({
                abilityName,
                charName,
                initialMode,
                hasAttack: !!probeMacro.atkRoll,
                onConfirm: (count, rollMode) => {
                    executeMassRolls({
                        count,
                        rollMode,
                        abilityName,
                        rawEntries,
                        abilityText,
                        charName,
                        preParsedMacro,
                        ctx: creatureCtx
                    });
                }
            });
        });
    }

    // ─── Public API ───────────────────────────────────────────────────────────
    const api = {
        openSheet,
        saveAndRenderNpcSpells: (m, spellData) => saveAndRenderNpcSpells(m, spellData, creatureCtx),
        openPanel,
        minimizePanel,
        openEditModal: (m, charId) => openEditModal(m, charId, creatureCtx),
        resetSheet,
        getLinkedCharacterId: () => linkedCharacterId,
        getCurrentMonster: () => currentMonster,

        // Backward compatibility exports
        parse5eMarkup,
        injectDiceChips,
        evaluateDiceHelper,
        parseActionMacro: (a, r, t, c, p, o) => parseActionMacro(a, r, t, c, p, o, currentMonster),
        parseSpellMacro,
        rollAndPostToChat: (f, l) => rollAndPostToChat(f, l, creatureCtx),
        postAbilityToChat: (a, t) => postAbilityToChat(a, t, creatureCtx),
        showMassRollDialog,
        executeMassRolls: (args) => executeMassRolls({ ...args, ctx: creatureCtx }),
        renderStatBlock: (m) => renderStatBlock(m, contentEl, creatureCtx),
        ensureNpcSpells,
        getSpellFromMonster,
        expendNpcSpellResource: (m, sp, lvl) => expendNpcSpellResource(m, sp, lvl, creatureCtx),
        rollNpcSpell: (l, i, t, cl, ts, ro) => rollNpcSpell(l, i, t, cl, ts, ro, creatureCtx)
    };
    if (typeof window !== 'undefined') {
        window.vttCreatureSheetAPI = api;
    }
    return api;
}
