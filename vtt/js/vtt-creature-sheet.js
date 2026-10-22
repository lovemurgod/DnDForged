// ForgeDVTT Creature Sheet — Left Side Panel Module
export function initVttCreatureSheet(vtt) {
    const panel = document.getElementById('creature-sheet-panel');
    const minimizeBtn = document.getElementById('creature-sheet-minimize-btn');
    const contentEl = document.getElementById('vtt-creature-sheet-panel');

    if (!panel || !minimizeBtn || !contentEl) {
        console.warn('[CreatureSheet] Panel elements not found in DOM.');
    }

    // ─── Draggable Border Resizing for Creature Sheet Panel ─────────────────
    if (panel) {
        const savedWidth = localStorage.getItem('vtt_cs_panel_width');
        if (savedWidth) {
            const parsed = parseInt(savedWidth, 10);
            if (!isNaN(parsed) && parsed >= 280) {
                panel.style.setProperty('--cs-panel-width', `${parsed}px`);
            }
        }

        let resizeHandle = panel.querySelector('.cs-resize-handle');
        if (!resizeHandle) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'cs-resize-handle';
            resizeHandle.title = 'Drag border to resize creature sheet (double-click to reset)';
            panel.appendChild(resizeHandle);
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 320;

        resizeHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            isResizing = true;
            startX = e.clientX;
            const currentComputed = panel.getBoundingClientRect().width;
            startWidth = currentComputed || 320;
            panel.classList.add('is-resizing');
            resizeHandle.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
        });

        resizeHandle.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            const deltaX = e.clientX - startX;
            let newWidth = startWidth + deltaX;
            const maxWidth = Math.min(window.innerWidth * 0.85, 1000);
            newWidth = Math.max(280, Math.min(newWidth, maxWidth));
            panel.style.setProperty('--cs-panel-width', `${Math.round(newWidth)}px`);
            if (window.VTT?.sheetDock?.updatePosition) window.VTT.sheetDock.updatePosition();
        });

        const stopResizing = (e) => {
            if (!isResizing) return;
            isResizing = false;
            panel.classList.remove('is-resizing');
            try {
                if (resizeHandle.hasPointerCapture(e.pointerId)) {
                    resizeHandle.releasePointerCapture(e.pointerId);
                }
            } catch (err) {}
            const currentComputed = Math.round(panel.getBoundingClientRect().width);
            if (currentComputed >= 280) {
                localStorage.setItem('vtt_cs_panel_width', currentComputed);
            }
            if (window.VTT?.sheetDock?.updatePosition) window.VTT.sheetDock.updatePosition();
        };

        resizeHandle.addEventListener('pointerup', stopResizing);
        resizeHandle.addEventListener('pointercancel', stopResizing);

        resizeHandle.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.style.setProperty('--cs-panel-width', '320px');
            localStorage.removeItem('vtt_cs_panel_width');
            if (window.VTT?.sheetDock?.updatePosition) window.VTT.sheetDock.updatePosition();
        });
    }

    let currentMonster = null;
    let linkedTokenId = null;
    let linkedCharacterId = null;
    let isMinimized = false;
    let spellCache = null;

    function toSpellTitleCase(str) {
        if (window.toSpellTitleCase) return window.toSpellTitleCase(str);
        if (!str || typeof str !== 'string') return str;
        const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with']);
        return str.split(/\s+/).map((word, index, arr) => {
            let clean = word.toLowerCase();
            if (clean.includes('/')) {
                return clean.split('/').map(part => {
                    if (!part) return part;
                    return part.charAt(0).toUpperCase() + part.slice(1);
                }).join('/');
            }
            if (clean.includes('-')) {
                return clean.split('-').map(part => {
                    if (!part) return part;
                    return part.charAt(0).toUpperCase() + part.slice(1);
                }).join('-');
            }
            if (index > 0 && index < arr.length - 1 && minorWords.has(clean)) {
                return clean;
            }
            return clean.charAt(0).toUpperCase() + clean.slice(1);
        }).join(' ');
    }

    function resolveSpellcastingType(sc, m = null) {
        if (!sc) return 'slot';
        const t = (sc.type || '').toLowerCase();
        if (t === 'slot' || t === 'pact' || t === 'innate' || t === 'custom') {
            return t;
        }
        const scName = sc.name || '';
        const headerText = Array.isArray(sc.headerEntries) ? sc.headerEntries.join(' ') : (sc.header || '');
        const hasWillOrDaily = Boolean(
            (sc.will && sc.will.length > 0) || 
            (sc.daily && Object.keys(sc.daily).length > 0) || 
            (sc.atWill && sc.atWill.length > 0) || 
            (sc.innateObj?.will && sc.innateObj.will.length > 0) || 
            (sc.innateObj?.daily && Object.keys(sc.innateObj.daily).length > 0)
        );
        const hasSlotsMatrix = Boolean(
            sc.spellsByLevel || 
            (sc.spells && Object.keys(sc.spells).some(k => k !== '0' && (Array.isArray(sc.spells[k]) ? sc.spells[k].length > 0 : sc.spells[k]?.slots || sc.spells[k]?.spells?.length))) ||
            (sc.spellsObj && Object.keys(sc.spellsObj).some(k => k !== 'cantrip' && Array.isArray(sc.spellsObj[k]) && sc.spellsObj[k].length > 0))
        );

        if (t === 'innate' || /innate|psionic/i.test(scName) || /innate\s+spellcasting/i.test(headerText) || (hasWillOrDaily && !hasSlotsMatrix)) {
            return 'innate';
        }
        if (t === 'pact' || /pact\s+magic/i.test(scName) || (/warlock/i.test(headerText) && /short\s+or\s+long\s+rest/i.test(headerText))) {
            return 'pact';
        }
        return 'slot';
    }

    function get5eSlotsForCaster(type, level) {
        const lvl = Math.max(0, Math.min(20, parseInt(level) || 0));
        if (lvl <= 0) return {};
        if (type === 'pact') {
            if (lvl === 1) return { level1: 1 };
            if (lvl === 2) return { level1: 2 };
            if (lvl <= 4) return { level2: 2 };
            if (lvl <= 6) return { level3: 2 };
            if (lvl <= 8) return { level4: 2 };
            if (lvl <= 10) return { level5: 2 };
            if (lvl <= 16) return { level5: 3 };
            return { level5: 4 };
        }
        const table = [
            {},
            { level1: 2 },
            { level1: 3 },
            { level1: 4, level2: 2 },
            { level1: 4, level2: 3 },
            { level1: 4, level2: 3, level3: 2 },
            { level1: 4, level2: 3, level3: 3 },
            { level1: 4, level2: 3, level3: 3, level4: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 2 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1, level8: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1, level8: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1, level8: 1, level9: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 3, level6: 1, level7: 1, level8: 1, level9: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 3, level6: 2, level7: 1, level8: 1, level9: 1 },
            { level1: 4, level2: 3, level3: 3, level4: 3, level5: 3, level6: 2, level7: 2, level8: 1, level9: 1 }
        ];
        return table[lvl] || {};
    }

    function showVttPrompt(title, defaultValue, callback) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const box = document.createElement('div');
        box.style.backgroundColor = '#1e1e1e';
        box.style.border = '1px solid var(--color-border-subtle, #444)';
        box.style.borderRadius = '8px';
        box.style.padding = '20px';
        box.style.width = '300px';
        box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap = '15px';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.margin = '0';
        titleEl.style.color = 'var(--color-gold-base, #ffd700)';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue || '';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.backgroundColor = 'rgba(0,0,0,0.3)';
        input.style.border = '1px solid var(--color-border-subtle, #444)';
        input.style.color = '#fff';
        input.style.borderRadius = '4px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        
        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'btn btn-primary btn-sm';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);

        box.appendChild(titleEl);
        box.appendChild(input);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        input.focus();
        input.select();

        const cleanup = () => {
            window.removeEventListener('keydown', onEsc);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        const submit = () => {
            cleanup();
            callback(input.value);
        };

        okBtn.addEventListener('click', submit);
        cancelBtn.addEventListener('click', () => {
            cleanup();
            callback(null);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                callback(null);
            }
        });

        const onEsc = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                callback(null);
            }
        };
        window.addEventListener('keydown', onEsc);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
        });
    }

    // ─── Panel open / minimize / expand ──────────────────────────────────────
    function openPanel() {
        console.log('[vtt-creature-sheet] openPanel called');
        if (window.VTT && window.VTT.playerSheet && typeof window.VTT.playerSheet.minimizePanel === 'function') {
            window.VTT.playerSheet.minimizePanel();
            const playerPanel = document.getElementById('player-sheet-panel');
            if (playerPanel) playerPanel.style.zIndex = "50";
        }
        panel.style.zIndex = "55";
        panel.classList.add('open');
        panel.classList.remove('minimized');
        isMinimized = false;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        minimizeBtn.title = 'Minimize Creature Sheet';
        if (window.VTT?.mobileAdapter?.syncCreatureSheetTopbar) {
            window.VTT.mobileAdapter.syncCreatureSheetTopbar();
        }
        console.log('[vtt-creature-sheet] openPanel completed');
    }

    function minimizePanel() {
        panel.classList.remove('open');
        panel.classList.add('minimized');
        isMinimized = true;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        minimizeBtn.title = 'Expand Creature Sheet';
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

    minimizeBtn.addEventListener('click', () => {
        if (isMinimized) {
            openPanel();
        } else {
            minimizePanel();
        }
    });

    const STANDARD_DAMAGE_TYPES = ['Slashing', 'Piercing', 'Bludgeoning', 'Fire', 'Cold', 'Lightning', 'Thunder', 'Poison', 'Acid', 'Psychic', 'Necrotic', 'Radiant', 'Force', 'Healing'];

    function normalizeMonsterDamages(m) {
        if (!m) return;
        const norm = (type) => {
            if (!type) return 'Slashing';
            const t = type.trim();
            return STANDARD_DAMAGE_TYPES.find(dt => dt.toLowerCase() === t.toLowerCase()) || (t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
        };
        const checkList = (arr) => {
            if (!Array.isArray(arr)) return;
            arr.forEach(item => {
                if (item?.macro?.damages && Array.isArray(item.macro.damages)) {
                    item.macro.damages.forEach(d => {
                        if (d.type) d.type = norm(d.type);
                    });
                }
            });
        };
        checkList(m.actions);
        checkList(m.bonusActions);
        checkList(m.reactions);
        checkList(m.traits);
        if (m.legendaryActions?.entries) checkList(m.legendaryActions.entries);
        if (Array.isArray(m.lairActions)) checkList(m.lairActions);
    }

    // ─── Main entry: open a creature sheet ───────────────────────────────────
    async function openSheet(monsterData, tokenId, characterId) {
        console.log('[vtt-creature-sheet] openSheet called', { monsterData, tokenId, characterId });
        if (!monsterData) return;

        const activeCharId = characterId || (tokenId && window.VTT?.canvasEngine?.getTokens()?.[tokenId]?.characterId) || (tokenId && window.VTT?.canvasEngine?.getTokens()?.[tokenId]?.sourceCharacterId);
        const linkedChar = (activeCharId && window.VTT?.campaignState?.characters) ? window.VTT.campaignState.characters[activeCharId] : null;
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
                isGeneric: monsterData.isGeneric !== undefined ? monsterData.isGeneric : !(monsterData.isCompanion || monsterData.isCustomNpc || linkedChar?.isCompanion || linkedChar?.isCustomNpc)
            });
            return;
        }

        // Hydrate from single-creature API only if monsterData is an un-hydrated catalog summary and NOT a custom companion/NPC
        const lookupId = monsterData.id || monsterData.name;
        const isCustomOrCompanion = Boolean(characterId || linkedCharacterId || monsterData.isCompanion || monsterData.isCustomNpc || (characterId && window.VTT?.campaignState?.characters?.[characterId]));
        const isCatalogOnly = !isCustomOrCompanion && Boolean(
            monsterData.source && lookupId && (
                (!monsterData.actions && !monsterData.action) || 
                (monsterData.hasSpellcasting && (!monsterData.spellcasting || monsterData.spellcasting.length === 0))
            )
        );
        if (isCatalogOnly) {
            try {
                let full = null;
                if (window.fetchFullCreature) {
                    full = await window.fetchFullCreature(monsterData.source, lookupId);
                }
                if (!full) {
                    try {
                        const res = await fetch(`/api/creature/${encodeURIComponent(monsterData.source)}/${encodeURIComponent(lookupId)}`);
                        if (res.ok) full = await res.json();
                    } catch (e) {}
                }
                if (!full) {
                    try {
                        let partRes = await fetch(`/data/bestiary-normalized/bestiary-${monsterData.source.toLowerCase()}.json`);
                        if (!partRes.ok) partRes = await fetch(`/vtt/data/bestiary-normalized/bestiary-${monsterData.source.toLowerCase()}.json`);
                        if (partRes.ok) {
                            const partData = await partRes.json();
                            const cleanLookup = lookupId.toLowerCase();
                            full = partData.find(m => m.id?.toLowerCase() === cleanLookup || m.name?.toLowerCase() === cleanLookup);
                        }
                    } catch (e) {}
                }
                if (full) {
                    monsterData = Object.assign({}, full, monsterData, {
                        spellcasting: monsterData.spellcasting || full.spellcasting,
                        actions: monsterData.actions || monsterData.action || full.actions,
                        bonusActions: monsterData.bonusActions || monsterData.bonus || full.bonusActions,
                        reactions: monsterData.reactions || monsterData.reaction || full.reactions,
                        legendaryActions: monsterData.legendaryActions || monsterData.legendary || full.legendaryActions,
                        legendaryActionsLair: monsterData.legendaryActionsLair ?? full.legendaryActionsLair,
                        legendaryGroup: monsterData.legendaryGroup || full.legendaryGroup,
                        lairActions: (monsterData.lairActions && monsterData.lairActions.length > 0) ? monsterData.lairActions : full.lairActions,
                        lairHeader: monsterData.lairHeader || full.lairHeader,
                        lairActionsDesc: monsterData.lairActionsDesc || full.lairActionsDesc,
                        regionalEffects: (monsterData.regionalEffects && monsterData.regionalEffects.length > 0) ? monsterData.regionalEffects : full.regionalEffects,
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
        const keyId = tokenId || characterId || (monsterData ? `${monsterData.name}_${monsterData.source || ''}` : null);
        let checkType = 'creature';
        if (characterId && window.VTT?.campaignState?.characters?.[characterId]) {
            const c = window.VTT.campaignState.characters[characterId];
            if (c.isCompanion) checkType = 'companion';
            else if (c.isCustomNpc) checkType = 'npc';
        }
        const sheetKey = window.SheetWindowManager ? window.SheetWindowManager.getSheetKey(checkType, keyId) : null;
        if (!vtt.isStandaloneSheet && sheetKey && window.SheetWindowManager && window.SheetWindowManager.isSheetPoppedOut(sheetKey)) {
            window.SheetWindowManager.focusPoppedOut(sheetKey);
            return;
        }

        currentMonster = monsterData;
        linkedTokenId = tokenId || null;
        linkedCharacterId = characterId || null;

        try {
            renderStatBlock(currentMonster);
            console.log('[vtt-creature-sheet] renderStatBlock successful');
        } catch (err) {
            console.error('[vtt-creature-sheet] renderStatBlock ERROR', err);
        }
        openPanel();
    }

    // ─── Stat block renderer ─────────────────────────────────────────────────
    function renderStatBlock(m) {
        const crStr = m.cr ? (typeof m.cr === 'object' ? m.cr.cr : m.cr) : '0';
        const typeStr = buildTypeString(m);
        const hpCurrent = linkedTokenId ? (getLinkedTokenHp() ?? (m.hp?.average || 0)) : (m.hp?.average || 0);
        const hpMax = m.hp?.average || 0;
        const hpFormula = m.hp?.formula || '';
        const ac = Array.isArray(m.ac) ? m.ac[0] : m.ac;
        const acValue = typeof ac === 'object' ? (ac.value ?? ac.ac ?? m.primaryAc ?? '—') : (ac ?? m.primaryAc ?? '—');
        const acFrom = (typeof ac === 'object' && ac.from) ? ` (${ac.from.join(', ')})` : '';
        const speed = buildSpeedString(m.speed);
        const profBonus = getProfBonus(crStr);

        const dexScore = m.dex ?? m.abilities?.dex?.score ?? 10;
        let initMod = Math.floor((dexScore - 10) / 2);
        if (m.initiative !== undefined) {
            if (typeof m.initiative === 'number') initMod = m.initiative;
            else if (typeof m.initiative?.bonus === 'number') initMod = m.initiative.bonus;
        }
        const initModStr = initMod >= 0 ? `+${initMod}` : `${initMod}`;

        const abilityScores = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

        const abilityGrid = abilityScores.map((ab, i) => {
            const score = m[ab] ?? m.abilities?.[ab]?.score ?? 10;
            const mod = Math.floor((score - 10) / 2);
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            return `
                <div class="cs-ability-cell" data-ability="${ab}" data-score="${score}" data-mod="${mod}">
                    <span class="cs-ability-label">${abilityLabels[i]}</span>
                    <span class="cs-ability-score">${score}</span>
                    <span class="cs-ability-mod">${modStr}</span>
                    <div class="cs-ability-actions">
                        <span class="cs-ability-action-btn cs-roll-check" title="Roll Check">Check</span>
                        <span class="cs-ability-action-btn cs-roll-save" title="Roll Save">Save</span>
                    </div>
                </div>
            `;
        }).join('');

        const saves = buildSavesHtml(m);
        const skills = buildSkillsHtml(m);
        const immunities = buildImmunityHtml(m);
        const traits = buildAbilitySection('Traits', m.traits || m.trait);
        const actions = buildAbilitySection('Actions', m.actions || m.action);
        const bonus = buildAbilitySection('Bonus Actions', m.bonusActions || m.bonus);
        const reactions = buildAbilitySection('Reactions', m.reactions || m.reaction);
        const legendary = buildLegendarySection(m);
        const variants = buildVariantSection(m);

        const isEditableCreature = Boolean(linkedCharacterId || m.isCustomNpc || m.isCompanion);
        ensureSpellcastingFromTraits(m);
        const hasSpells = isEditableCreature ||
                          (m.spellcasting && m.spellcasting.length > 0) || 
                          (m.spells && Object.values(m.spells).some(arr => Array.isArray(arr) && arr.length > 0)) ||
                          (m.slots && Object.keys(m.slots).length > 0) ||
                          (m.spellSlots && Object.keys(m.spellSlots).length > 0);
        let tabsHtml = '';
        let spellsHtml = '';

        if (hasSpells) {
            tabsHtml = `
                <div class="cs-tabs">
                    <div class="cs-tab-btn active" data-tab="stats">Stats</div>
                    <div class="cs-tab-btn" data-tab="spells">Spells</div>
                </div>
            `;
            try {
                spellsHtml = buildSpellcastingHtml(m);
            } catch (err) {
                console.error('[CreatureSheet] Error building spellcasting HTML:', err);
                spellsHtml = `<div class="alert alert-warning" style="padding:12px; background:rgba(255,165,0,0.15); border:1px solid orange; border-radius:4px; color:#ffcc00;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>Could not format spellcasting list: ${err.message}</div>`;
            }
        }

        let editBtnHtml = '';
        const activeCharId = linkedCharacterId || (linkedTokenId && window.VTT?.canvasEngine?.getTokens()?.[linkedTokenId]?.sourceCharacterId);
        const char = (activeCharId && window.VTT?.campaignState?.characters) ? window.VTT.campaignState.characters[activeCharId] : null;
        if (char && char.name && m.name !== char.name) {
            m.name = char.name;
        }
        if (char) {
            normalizeMonsterDamages(m);
        }
        if (char && (window.VTT.role === 'GM' || (char.assignedPlayers && (char.assignedPlayers.includes(window.VTT.username) || char.assignedPlayers.includes('*'))))) {
            editBtnHtml = `<button class="btn btn-xs btn-secondary cs-edit-btn" title="Edit ${char.isCompanion ? 'Companion' : 'NPC'}"><i class="fa-solid fa-pen"></i> <span>Edit</span></button>`;
        }

        const isCustomNpc = Boolean(char?.isCustomNpc || m.isCustomNpc);
        const isCompanion = Boolean(char?.isCompanion || m.isCompanion);
        const showGenericNamedToggle = Boolean(isCustomNpc || isCompanion);
        const isGeneric = char ? (char.isGeneric === true) : (m.isGeneric === true);

        const genericNamedToggleHtml = showGenericNamedToggle ? `
            <button id="cs-generic-named-toggle" class="btn btn-xs ${isGeneric ? 'btn-secondary' : 'btn-primary'}" title="Entity Type: ${isGeneric ? 'Generic (independent instanced tokens on canvas)' : 'Named (linked to central sheet)'}. Click to toggle." style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;">
                <i class="${isGeneric ? 'fa-solid fa-people-group' : 'fa-solid fa-street-view'}"></i>
                <span>${isGeneric ? 'Generic' : 'Named'}</span>
            </button>
        ` : '';

        const rollVisToggleHtml = `
            <button id="cs-roll-vis-toggle" class="btn btn-xs ${getVisibilitySetting() === 'private' ? 'btn-danger' : 'btn-secondary'}" title="Roll Visibility: ${getVisibilitySetting() === 'private' ? 'GM Secret' : 'Public'}. Click to toggle." style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;">
                <i class="${getVisibilitySetting() === 'private' ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}"></i>
                <span>${getVisibilitySetting() === 'private' ? 'GM Secret' : 'Public'}</span>
            </button>
        `;

        const popoutBtnHtml = !vtt.isStandaloneSheet ? `<button class="cs-popout-btn btn btn-icon btn-secondary btn-xs" id="cs-btn-popout" title="Open Sheet in New Tab"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>` : '';

        const tokenUrl = getMonsterImageUrl(m);
        const cleanUrl = (tokenUrl || '').split('?')[0].toLowerCase();
        const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
        const isYoutube = tokenUrl && (tokenUrl.includes('youtube.com/embed') || tokenUrl.includes('youtube.com/watch') || tokenUrl.includes('youtu.be/'));

        let portraitMediaHtml = '';
        if (isVideo) {
            portraitMediaHtml = `<video src="${tokenUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;"></video>`;
        } else if (isYoutube) {
            let ytUrl = tokenUrl;
            const ytMatch = tokenUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (ytMatch) {
                const videoId = ytMatch[1];
                ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
            }
            portraitMediaHtml = `<iframe src="${ytUrl}" frameborder="0" allow="autoplay; encrypted-media" style="width:100%; height:100%; pointer-events:none; border:none;"></iframe>`;
        } else {
            const safeName = (m.name || 'Creature').replace(/'/g, "\\'");
            const safeTokenUrl = typeof getSafeVttUrl === 'function' ? getSafeVttUrl(tokenUrl) : tokenUrl;
            portraitMediaHtml = `<img src="${safeTokenUrl}" alt="${m.name}" onerror="if (window.VTT?.generateArcaneToken) { this.src = window.VTT.generateArcaneToken('${safeName}', 'monster'); } else { this.src = 'favicon.svg'; }" style="width:100%; height:100%; object-fit:cover; display:block;">`;
        }

        contentEl.innerHTML = `
            <!-- Top Toolbar -->
            <div class="cs-top-toolbar">
                <div class="cs-top-toolbar-group">
                    ${genericNamedToggleHtml}
                    ${rollVisToggleHtml}
                </div>
                <div class="cs-top-toolbar-group">
                    ${editBtnHtml}
                    ${popoutBtnHtml}
                </div>
            </div>

            <!-- Header -->
            <div class="cs-header">
                <div class="cs-token-portrait">
                    ${portraitMediaHtml}
                </div>
                <div class="cs-header-info">
                    <h2 class="cs-creature-name">${m.name}</h2>
                    <p class="cs-creature-type">${typeStr}</p>
                    <div class="cs-header-meta">
                        <div class="cs-cr-badge">CR ${crStr}</div>
                    </div>
                </div>
            </div>

            ${tabsHtml}

            <div id="cs-tab-stats" class="cs-tab-content active">
                <!-- HP Row -->
                <div class="cs-hp-row">
                    <div class="cs-hp-label"><i class="fa-solid fa-heart"></i> HP</div>
                    <div class="cs-hp-controls">
                        <button class="cs-hp-btn" id="cs-hp-minus" title="Damage">−</button>
                        <div class="cs-hp-display">
                            <span id="cs-hp-current">${hpCurrent}</span>
                            <span class="cs-hp-divider">/</span>
                            <span id="cs-hp-max">${hpMax}</span>
                            ${hpFormula ? `<span class="cs-hp-formula">${injectDiceChips(hpFormula)}</span>` : ''}
                        </div>
                        <button class="cs-hp-btn" id="cs-hp-plus" title="Heal">+</button>
                    </div>
                    <div class="cs-hp-bar-wrap">
                        <div class="cs-hp-bar-fill" id="cs-hp-bar" style="width: ${hpMax > 0 ? Math.round(hpCurrent / hpMax * 100) : 100}%"></div>
                    </div>
                </div>

                <!-- Dedicated Combat Stats Row (AC & Initiative) -->
                <div class="cs-combat-stats-row">
                    <div class="cs-combat-stat-card">
                        <i class="fa-solid fa-shield-halved cs-combat-stat-icon"></i>
                        <div class="cs-combat-stat-content">
                            <span class="cs-combat-stat-label">Armor Class</span>
                            <span class="cs-combat-stat-value">${acValue}${acFrom}</span>
                        </div>
                    </div>
                    <div class="cs-combat-stat-card cs-combat-stat-btn cs-roll-initiative-btn" style="cursor: pointer;" title="Roll Initiative">
                        <i class="fa-solid fa-dice-d20 cs-combat-stat-icon" style="color: var(--color-gold-base);"></i>
                        <div class="cs-combat-stat-content">
                            <span class="cs-combat-stat-label">Initiative</span>
                            <span class="cs-combat-stat-value">${initModStr}</span>
                        </div>
                    </div>
                </div>

                <!-- Secondary Core Stats Pills -->
                <div class="cs-core-stats">
                    <div class="cs-stat-pill"><i class="fa-solid fa-shoe-prints"></i><span>${speed}</span></div>
                    <div class="cs-stat-pill"><i class="fa-solid fa-star"></i><span>Prof +${profBonus}</span></div>
                    ${m.passive !== undefined ? `<div class="cs-stat-pill"><i class="fa-solid fa-eye"></i><span>Passive ${m.passive}</span></div>` : ''}
                </div>

                <!-- Divider -->
                <div class="cs-section-divider"></div>

                <!-- Ability Scores Grid -->
                <div class="cs-ability-grid">${abilityGrid}</div>

                <!-- Divider -->
                <div class="cs-section-divider"></div>

                <!-- Saves & Skills -->
                ${saves ? `<div class="cs-info-row"><span class="cs-info-label">Saving Throws</span><span class="cs-info-value">${saves}</span></div>` : ''}
                ${skills ? `<div class="cs-info-row"><span class="cs-info-label">Skills</span><span class="cs-info-value">${skills}</span></div>` : ''}
                ${immunities}

                <!-- Divider -->
                <div class="cs-section-divider"></div>

                <!-- Global Collapse Control -->
                <div style="display: flex; justify-content: flex-end; padding: 6px 16px 2px 16px;">
                    <button id="cs-toggle-all-btn" class="btn btn-secondary btn-xxs" style="font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Expand or collapse all sections and cards">
                        <i class="fa-solid fa-angles-down"></i> <span>Expand All</span>
                    </button>
                </div>

                <!-- Traits / Actions / Reactions / Legendary -->
                ${traits}
                ${actions}
                ${bonus}
                ${reactions}
                ${legendary}
                ${variants}
            </div>

            ${hasSpells ? `<div id="cs-tab-spells" class="cs-tab-content">${spellsHtml}</div>` : ''}
            

        `;

        // Wire HP stepper buttons
        wireHpControls(hpCurrent, hpMax);

        // Wire ability score chips (for rolling ability checks)
        wireAbilityScoreClicks();

        // Wire Initiative Roll
        wireInitiativeRoll(m);

        // Wire Collapsible Sections and Cards
        wireCollapsibleHandlers();

        // Wire Tabs
        if (hasSpells) {
            wireTabs();
            wireSpellSlots();
            setupCsSpellListeners();
        }

        // Wire Edit Button
        const editBtn = contentEl.querySelector('.cs-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openEditModal(m, activeCharId);
            });
        }

        // Wire Pop-Out Button
        const popoutBtn = contentEl.querySelector('#cs-btn-popout');
        if (popoutBtn) {
            popoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.SheetWindowManager) {
                    let sheetType = 'creature';
                    const targetChar = activeCharId && window.VTT?.campaignState?.characters?.[activeCharId];
                    if (targetChar) {
                        if (targetChar.isCompanion) sheetType = 'companion';
                        else if (targetChar.isCustomNpc) sheetType = 'npc';
                    }
                    window.SheetWindowManager.openPopout({
                        type: sheetType,
                        tokenId: linkedTokenId,
                        characterId: linkedCharacterId || activeCharId,
                        name: currentMonster.name,
                        source: currentMonster.source,
                        monsterData: currentMonster
                    });
                    minimizePanel();
                }
            });
        }

        // Wire Roll Visibility Quick-Toggle Pill
        const visToggleBtn = contentEl.querySelector('#cs-roll-vis-toggle');
        if (visToggleBtn) {
            visToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentVis = getVisibilitySetting();
                const nextVis = currentVis === 'private' ? 'public' : 'private';
                const el = document.getElementById('config-roll-visibility');
                if (el) {
                    el.value = nextVis;
                    el.dispatchEvent(new Event('change'));
                }
                const isPrivate = nextVis === 'private';
                visToggleBtn.className = `btn btn-xs ${isPrivate ? 'btn-danger' : 'btn-secondary'}`;
                visToggleBtn.innerHTML = `<i class="${isPrivate ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}"></i> <span>${isPrivate ? 'GM Secret' : 'Public'}</span>`;
                visToggleBtn.title = `Roll Visibility: ${isPrivate ? 'GM Secret (only GM sees)' : 'Public (all see)'}. Click to toggle.`;
            });
        }

        // Wire Generic / Named Instancing Toggle
        const gnToggleBtn = contentEl.querySelector('#cs-generic-named-toggle');
        if (gnToggleBtn) {
            gnToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const targetChar = (activeCharId && window.VTT?.campaignState?.characters) ? window.VTT.campaignState.characters[activeCharId] : null;
                const currentIsGeneric = targetChar ? (targetChar.isGeneric === true) : (m.isGeneric === true);
                const nextIsGeneric = !currentIsGeneric;

                if (targetChar) {
                    targetChar.isGeneric = nextIsGeneric;
                    if (window.VTT?.socket) {
                        window.VTT.socket.emit('character:update', { character: targetChar });
                    }
                }
                m.isGeneric = nextIsGeneric;

                gnToggleBtn.className = `btn btn-xs ${nextIsGeneric ? 'btn-secondary' : 'btn-primary'}`;
                gnToggleBtn.innerHTML = `<i class="${nextIsGeneric ? 'fa-solid fa-people-group' : 'fa-solid fa-street-view'}"></i> <span>${nextIsGeneric ? 'Generic' : 'Named'}</span>`;
                gnToggleBtn.title = `Entity Type: ${nextIsGeneric ? 'Generic (independent instanced tokens on canvas)' : 'Named (linked to central sheet)'}. Click to toggle.`;
            });
        }
    }

    function wireInitiativeRoll(m) {
        const initBtns = contentEl.querySelectorAll('.cs-roll-initiative-btn');
        initBtns.forEach(btn => {
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
                if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.simulateRoll) {
                    rollData = window.vttPlayerSheetAPI.simulateRoll(formula);
                } else {
                    const r = Math.floor(Math.random() * 20) + 1;
                    rollData = { total: r + initMod, rolls: [r], modifier: initMod, formula };
                }

                let isTiebreaker = true;
                if (window.VTT?.campaignState?.settings?.initDexTiebreaker !== undefined) {
                    isTiebreaker = !!window.VTT.campaignState.settings.initDexTiebreaker;
                } else if (window.VTT?.canvasEngine?.getCampaignSettings) {
                    isTiebreaker = window.VTT.canvasEngine.getCampaignSettings().initDexTiebreaker !== false;
                }

                if (isTiebreaker && rollData && typeof rollData.total === 'number') {
                    const dexTiebreaker = Math.round(dexScore) / 100;
                    rollData.total = Math.round((rollData.total + dexTiebreaker) * 100) / 100;
                }

                if (window.VTT && window.VTT.socket) {
                    window.VTT.socket.emit('chat:msg', {
                        text: `[${m.name}] rolls **Initiative**`,
                        roll: rollData
                    });
                }

                if (window.VTT && window.VTT.chatEngine) {
                    const monsterImg = typeof getMonsterImageUrl === 'function' ? getMonsterImageUrl(m) : null;
                    let added = false;
                    if (linkedTokenId) {
                        window.VTT.chatEngine.addToInitiative(m.name, rollData.total, linkedTokenId, monsterImg);
                        added = true;
                    }
                    if (window.VTT.canvasEngine) {
                        const selectedIds = window.VTT.canvasEngine.getSelectedTokenIds();
                        const tokens = window.VTT.canvasEngine.getTokens();
                        selectedIds.forEach(tId => {
                            const t = tokens[tId];
                            if (t && (t.characterId === linkedCharacterId || t.name === m.name)) {
                                if (tId !== linkedTokenId) {
                                    window.VTT.chatEngine.addToInitiative(t.name, rollData.total, t.id, t.img || monsterImg);
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

    function wireTabs() {
        const btns = contentEl.querySelectorAll('.cs-tab-btn');
        const contents = contentEl.querySelectorAll('.cs-tab-content');
        
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                btns.forEach(b => b.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                contentEl.querySelector(`#cs-tab-${target}`).classList.add('active');
            });
        });
    }

    function wireSpellSlots() {
        let savedSlots = {};
        if (linkedTokenId && window.VTT?.canvasEngine) {
            const token = window.VTT.canvasEngine.getTokens()[linkedTokenId];
            if (token && token.spellSlots) {
                savedSlots = token.spellSlots;
            }
        }
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char && char.spellSlots) {
                for (let k in char.spellSlots) {
                    if (savedSlots[k] === undefined) {
                        const s = char.spellSlots[k];
                        savedSlots[k] = s;
                    }
                }
            }
        }

        const currentInputs = contentEl.querySelectorAll('.cs-spell-slot-input[data-type="current"]');
        const maxInputs = contentEl.querySelectorAll('.cs-spell-slot-input[data-type="max"]');

        currentInputs.forEach(input => {
            const level = input.dataset.level;
            const maxInput = contentEl.querySelector(`.cs-spell-slot-input[data-type="max"][data-level="${level}"]`);
            const defaultMax = maxInput ? (parseInt(maxInput.value) || 0) : (parseInt(input.dataset.max) || 0);

            if (savedSlots[level] !== undefined) {
                const s = savedSlots[level];
                input.value = typeof s === 'object' && s.current !== undefined ? s.current : s;
            } else {
                input.value = defaultMax;
            }

            input.addEventListener('change', (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                const currentMax = maxInput ? (parseInt(maxInput.value) || 0) : defaultMax;
                val = Math.max(0, val);
                e.target.value = val;

                syncSlotsState(level, val, currentMax);
            });
        });

        maxInputs.forEach(input => {
            const level = input.dataset.level;
            const curInput = contentEl.querySelector(`.cs-spell-slot-input[data-type="current"][data-level="${level}"]`);

            if (savedSlots[level] !== undefined && typeof savedSlots[level] === 'object' && savedSlots[level].max !== undefined) {
                input.value = savedSlots[level].max;
            }

            input.addEventListener('change', (e) => {
                let maxVal = parseInt(e.target.value);
                if (isNaN(maxVal)) maxVal = 0;
                maxVal = Math.max(0, maxVal);
                e.target.value = maxVal;

                let curVal = curInput ? (parseInt(curInput.value) || 0) : 0;
                if (curVal > maxVal) {
                    curVal = maxVal;
                    if (curInput) curInput.value = curVal;
                }

                syncSlotsState(level, curVal, maxVal);
            });
        });

        // Reset Slots & Usages Button
        contentEl.querySelectorAll('.cs-btn-reset-slots, #cs-reset-slots-btn').forEach(resetBtn => {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentInputs.forEach(curInput => {
                    const level = curInput.dataset.level;
                    const maxInput = contentEl.querySelector(`.cs-spell-slot-input[data-type="max"][data-level="${level}"]`);
                    const maxVal = maxInput ? (parseInt(maxInput.value) || 0) : (parseInt(curInput.dataset.max) || 0);
                    curInput.value = maxVal;
                    syncSlotsState(level, maxVal, maxVal);
                });
                if (currentMonster) {
                    currentMonster.dailyUsages = {};
                    if (currentMonster.spells) {
                        for (let lk in currentMonster.spells) {
                            if (Array.isArray(currentMonster.spells[lk])) {
                                currentMonster.spells[lk].forEach(sp => {
                                    if (sp.usesMax !== undefined) sp.usesRemaining = sp.usesMax;
                                });
                            }
                        }
                    }
                    saveMonsterData(currentMonster);
                    saveAndRenderNpcSpells(currentMonster);
                }
            });
        });

        // Listen for external token slot updates
        if (vtt.socket) {
            vtt.socket.on('token:updated', (data) => {
                if (linkedTokenId && data.tokens && data.tokens[linkedTokenId]) {
                    const updatedSlots = data.tokens[linkedTokenId].spellSlots;
                    if (updatedSlots) {
                        currentInputs.forEach(input => {
                            const level = input.dataset.level;
                            if (updatedSlots[level] !== undefined) {
                                const s = updatedSlots[level];
                                const curVal = typeof s === 'object' && s.current !== undefined ? s.current : s;
                                if (input.value !== curVal.toString()) {
                                    input.value = curVal;
                                }
                            }
                        });
                        maxInputs.forEach(input => {
                            const level = input.dataset.level;
                            if (updatedSlots[level] !== undefined && typeof updatedSlots[level] === 'object' && updatedSlots[level].max !== undefined) {
                                const maxVal = updatedSlots[level].max;
                                if (input.value !== maxVal.toString()) {
                                    input.value = maxVal;
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    function syncSlotsState(level, curVal, maxVal) {
        if (currentMonster) {
            currentMonster.slots = currentMonster.slots || {};
            currentMonster.slots[level] = { current: curVal, max: maxVal };
            currentMonster.spellSlots = currentMonster.spellSlots || {};
            currentMonster.spellSlots[level] = { current: curVal, max: maxVal };
        }
        if (linkedTokenId && window.VTT && window.VTT.socket) {
            const canvasEngine = window.VTT.canvasEngine;
            if (canvasEngine) {
                const allTokens = canvasEngine.getTokens();
                const currentMapId = (canvasEngine.currentMap && canvasEngine.currentMap.id) || (typeof canvasEngine.getCurrentMapId === 'function' ? canvasEngine.getCurrentMapId() : null);
                if (allTokens[linkedTokenId]) {
                    allTokens[linkedTokenId].spellSlots = allTokens[linkedTokenId].spellSlots || {};
                    allTokens[linkedTokenId].spellSlots[level] = { current: curVal, max: maxVal };
                    window.VTT.socket.emit('token:update', { mapId: currentMapId, token: allTokens[linkedTokenId] });
                }
            }
        }
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char) {
                char.spellSlots = char.spellSlots || {};
                char.spellSlots[level] = { current: curVal, max: maxVal };
                if (char.monsterData) {
                    char.monsterData.slots = char.monsterData.slots || {};
                    char.monsterData.slots[level] = { current: curVal, max: maxVal };
                }
                window.VTT.socket.emit('character:update', { character: char });
            }
        }
    }

    function saveMonsterData(m) {
        if (!m) m = currentMonster;
        if (!m) return;
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char) {
                char.monsterData = m;
                if (m.spells) char.spells = m.spells;
                window.VTT.socket?.emit('character:update', { character: char });
            }
        } else if (linkedTokenId && window.VTT?.canvasEngine) {
            const allTokens = window.VTT.canvasEngine.getTokens();
            const token = allTokens ? allTokens[linkedTokenId] : null;
            if (token) {
                token.monsterData = m;
                if (m.spells) token.spells = m.spells;
                const curMapId = window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
                window.VTT.socket?.emit('token:update', { mapId: curMapId, token: token });
            }
        } else if (window.VTT?.currentToken) {
            window.VTT.currentToken.monsterData = m;
            if (m.spells) window.VTT.currentToken.spells = m.spells;
            const curMapId = window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
            window.VTT.socket?.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
        }
    }

    function wireHpControls(initial, max) {
        let current = parseInt(initial) || 0;
        const maxHp = parseInt(max) || 0;
        const currentEl = document.getElementById('cs-hp-current');
        const barEl = document.getElementById('cs-hp-bar');

        function updateDOMOnly() {
            if (currentEl) currentEl.textContent = current;
            if (barEl && maxHp > 0) {
                const pct = Math.max(0, Math.min(100, Math.round(current / maxHp * 100)));
                barEl.style.width = `${pct}%`;
                barEl.className = 'cs-hp-bar-fill' + (pct <= 25 ? ' danger' : pct <= 50 ? ' injured' : '');
            }
        }

        function updateDisplay() {
            updateDOMOnly();
            
            // Sync to linked canvas token
            if (linkedTokenId && window.VTT && window.VTT.socket) {
                const canvasEngine = window.VTT.canvasEngine;
                if (canvasEngine) {
                    const allTokens = canvasEngine.getTokens();
                    const currentMapId = canvasEngine.getCurrentMapId();
                    if (allTokens[linkedTokenId]) {
                        allTokens[linkedTokenId].hp = current;
                        window.VTT.socket.emit('token:update', { mapId: currentMapId, token: allTokens[linkedTokenId] });
                        canvasEngine.renderAll();
                    }
                }
            }
            // Sync to linked character (Companion or Named NPC)
            if (linkedCharacterId && window.VTT && window.VTT.campaignState && window.VTT.campaignState.characters) {
                const comp = window.VTT.campaignState.characters[linkedCharacterId];
                if (comp && (!linkedTokenId || comp.isGeneric !== true)) {
                    comp.hpCurrent = current;
                    if (window.VTT.socket) {
                        window.VTT.socket.emit('character:update', { character: comp });
                    }
                }
            }
        }

        const minusBtn = document.getElementById('cs-hp-minus');
        const plusBtn = document.getElementById('cs-hp-plus');

        if (minusBtn) {
            minusBtn.addEventListener('click', () => {
                showVttPrompt('Damage amount:', '1', (val) => {
                    if (val === null) return;
                    const dmg = parseInt(val || '1');
                    if (!isNaN(dmg)) { current = Math.max(0, current - dmg); updateDisplay(); }
                });
            });
        }
        if (plusBtn) {
            plusBtn.addEventListener('click', () => {
                showVttPrompt('Heal amount:', '1', (val) => {
                    if (val === null) return;
                    const heal = parseInt(val || '1');
                    if (!isNaN(heal)) { current = Math.min(maxHp, current + heal); updateDisplay(); }
                });
            });
        }

        // Listen for external token HP updates
        if (vtt.socket) {
            vtt.socket.on('token:updated', (data) => {
                if (linkedTokenId && data.tokens && data.tokens[linkedTokenId]) {
                    const incomingHp = data.tokens[linkedTokenId].hp;
                    if (current !== incomingHp) {
                        current = incomingHp;
                        updateDOMOnly();
                    }
                }
            });
        }
    }

    function wireAbilityScoreClicks() {
        contentEl.querySelectorAll('.cs-ability-cell').forEach(cell => {
            const checkBtn = cell.querySelector('.cs-roll-check');
            const saveBtn = cell.querySelector('.cs-roll-save');
            const ab = (cell.dataset.ability || '').toUpperCase();

            if (checkBtn) {
                checkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mod = parseInt(cell.dataset.mod) || 0;
                    const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    const label = `${currentMonster?.name || 'Creature'}: ${ab} Check`;
                    rollAndPostToChat(formula, label);
                });
            }

            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let mod = parseInt(cell.dataset.mod) || 0;
                    if (currentMonster && currentMonster.save && currentMonster.save[cell.dataset.ability]) {
                        mod = parseInt(currentMonster.save[cell.dataset.ability]) || 0;
                    }
                    const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    const label = `${currentMonster?.name || 'Creature'}: ${ab} Saving Throw`;
                    rollAndPostToChat(formula, label);
                });
            }

            // Fallback: clicking the cell itself rolls ability check
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.cs-ability-actions')) return;
                const mod = parseInt(cell.dataset.mod) || 0;
                const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                const label = `${currentMonster?.name || 'Creature'}: ${ab} Check`;
                rollAndPostToChat(formula, label);
            });
        });
    }

    function wireCollapsibleHandlers() {
        // 1. Section Title Click (Collapse/Expand entire section category)
        contentEl.querySelectorAll('.cs-section-title').forEach(titleEl => {
            titleEl.addEventListener('click', () => {
                const section = titleEl.closest('.cs-section');
                if (section) {
                    section.classList.toggle('collapsed');
                }
            });
        });

        // 2. Card Header Click (Collapse/Expand individual card description)
        contentEl.querySelectorAll('.cs-ability-header').forEach(headerEl => {
            headerEl.addEventListener('click', (e) => {
                if (e.target.closest('.cs-macro-trigger') || e.target.closest('.cs-ability-info-btn') || e.target.closest('button') || e.target.closest('.dice-chip')) {
                    return;
                }
                const entry = headerEl.closest('.cs-ability-entry');
                if (entry) {
                    entry.classList.toggle('expanded');
                }
            });
        });

        // 3. Global Expand All / Collapse All Button
        const toggleAllBtn = contentEl.querySelector('#cs-toggle-all-btn');
        if (toggleAllBtn) {
            let isAllExpanded = false;
            toggleAllBtn.addEventListener('click', () => {
                isAllExpanded = !isAllExpanded;
                
                contentEl.querySelectorAll('.cs-section').forEach(sec => {
                    if (isAllExpanded) sec.classList.remove('collapsed');
                    else sec.classList.add('collapsed');
                });

                contentEl.querySelectorAll('.cs-ability-entry').forEach(card => {
                    if (isAllExpanded) card.classList.add('expanded');
                    else card.classList.remove('expanded');
                });

                const icon = toggleAllBtn.querySelector('i');
                const textSpan = toggleAllBtn.querySelector('span');
                if (isAllExpanded) {
                    if (icon) icon.className = 'fa-solid fa-angles-up';
                    if (textSpan) textSpan.textContent = 'Collapse All';
                } else {
                    if (icon) icon.className = 'fa-solid fa-angles-down';
                    if (textSpan) textSpan.textContent = 'Expand All';
                }
            });
        }
    }

    // ─── Ability sections builder ─────────────────────────────────────────────
    function buildAbilitySection(title, list) {
        if (!list || list.length === 0) return '';
        const rows = list.map(entry => buildAbilityEntryHtml(entry)).join('');
        return `
            <div class="cs-section">
                <h3 class="cs-section-title"><i class="fa-solid fa-bolt"></i> <span>${title}</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${rows}
                </div>
            </div>
        `;
    }

    function extractLairTitle(text) {
        if (!text || typeof text !== 'string') return '';
        const boldMatch = text.match(/^\{@b\s+([^}]+)\}\.?\s*(.*)/i) || text.match(/^\*\*([^*]+)\*\*\.?\s*(.*)/i);
        if (boldMatch) return cleanTags(boldMatch[1]).replace(/\.$/, '').trim();
        const spellMatch = text.match(/(?:casts?|uses?)\s+\{@spell\s+([^}|]+)/i);
        if (spellMatch) return `Cast ${spellMatch[1].trim()}`;
        const firstClause = text.split(/[.,;]/)[0].trim().replace(/^\{@[^}]+\}\s*/, '');
        let words = firstClause.split(/\s+/).filter(Boolean);
        if (words.length > 0) {
            if (/^(a|an|the|until)$/i.test(words[0])) words.shift();
            const stopWords = new Set(['from', 'in', 'of', 'at', 'on', 'to', 'within', 'with', 'by', 'around', 'into', 'for', 'a', 'an', 'the']);
            words = words.slice(0, 3);
            while (words.length > 1 && stopWords.has(words[words.length - 1].toLowerCase())) words.pop();
            const shortName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (shortName.length >= 3) return shortName;
        }
        return '';
    }

    function buildLegendarySection(m) {
        let html = '';
        const legEntries = Array.isArray(m.legendaryActions) 
            ? m.legendaryActions 
            : (Array.isArray(m.legendaryActions?.entries) ? m.legendaryActions.entries : (Array.isArray(m.legendary) ? m.legendary : []));
        if (legEntries && legEntries.length > 0) {
            const lairBadge = m.legendaryActionsLair ? ` <span class="badge" style="font-size:0.75rem; background:rgba(255,215,0,0.15); color:#ffd700; border:1px solid rgba(255,215,0,0.4); border-radius:3px; padding:1px 5px; margin-left:6px;">${m.legendaryActions?.count || 3} (${m.legendaryActionsLair} in Lair)</span>` : '';
            const legDesc = m.legendaryActions?.description ? `<p class="cs-legendary-desc">${m.legendaryActions.description}</p>` : (m.legendaryHeader ? `<p class="cs-legendary-desc">${cleanTags(flattenEntriesToText(m.legendaryHeader))}</p>` : '');
            const rows = legEntries.map(entry => buildAbilityEntryHtml(entry)).join('');
            html += `
                <div class="cs-section cs-legendary-section">
                    <h3 class="cs-section-title"><i class="fa-solid fa-crown"></i> <span>Legendary Actions</span>${lairBadge} <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                    <div class="cs-section-content">
                        ${legDesc}
                        ${rows}
                    </div>
                </div>
            `;
        }

        const mythicEntries = Array.isArray(m.mythicActions) 
            ? m.mythicActions 
            : (Array.isArray(m.mythicActions?.entries) ? m.mythicActions.entries : (Array.isArray(m.mythic) ? m.mythic : []));
        if (mythicEntries && mythicEntries.length > 0) {
            const mythicDesc = m.mythicActions?.description ? `<p class="cs-legendary-desc">${m.mythicActions.description}</p>` : (m.mythicHeader ? `<p class="cs-legendary-desc">${cleanTags(flattenEntriesToText(m.mythicHeader))}</p>` : '');
            const rows = mythicEntries.map(entry => buildAbilityEntryHtml(entry)).join('');
            html += `
                <div class="cs-section cs-mythic-section" style="margin-top:12px;">
                    <h3 class="cs-section-title"><i class="fa-solid fa-dragon"></i> <span>Mythic Actions</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                    <div class="cs-section-content">
                        ${mythicDesc}
                        ${rows}
                    </div>
                </div>
            `;
        }
        
        const lairActionEntries = Array.isArray(m.lairActions) 
            ? m.lairActions 
            : (Array.isArray(m.lairActions?.entries) ? m.lairActions.entries : []);
        if (lairActionEntries && lairActionEntries.length > 0) {
            const lairDesc = m.lairHeader || m.lairActions?.header || m.lairActionsDesc || (typeof m.lairActions === 'string' ? m.lairActions : '');
            const lairDescHtml = lairDesc ? `<p class="cs-legendary-desc">${parse5eMarkup(lairDesc)}</p>` : '';
            const rows = lairActionEntries.map(entry => {
                if (typeof entry === 'string') {
                    const fallbackName = extractLairTitle(entry) || 'Lair Effect';
                    return buildAbilityEntryHtml({
                        name: fallbackName,
                        entries: [entry],
                        descriptionHtml: `<p>${entry}</p>`,
                        actionType: 'lair'
                    });
                }
                if (entry && !entry.name) {
                    const firstText = (entry.entries && entry.entries[0]) ? (typeof entry.entries[0] === 'string' ? entry.entries[0] : JSON.stringify(entry.entries[0])) : (entry.entry ? String(entry.entry) : '');
                    const fallbackName = extractLairTitle(firstText) || 'Lair Action';
                    return buildAbilityEntryHtml({
                        ...entry,
                        name: fallbackName,
                        actionType: 'lair'
                    });
                }
                return buildAbilityEntryHtml(entry);
            }).join('');
            html += `
                <div class="cs-section cs-lair-section" style="margin-top:12px;">
                    <h3 class="cs-section-title"><i class="fa-solid fa-dungeon"></i> <span>Lair Actions</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                    <div class="cs-section-content">
                        ${lairDescHtml}
                        ${rows}
                    </div>
                </div>
            `;
        }

        const regionalEntries = m.regionalEffects || [];
        const regionalHtml = m.regionalEffectsHtml || '';
        if ((regionalEntries && regionalEntries.length > 0) || regionalHtml) {
            let content = '';
            if (regionalEntries && regionalEntries.length > 0) {
                content = regionalEntries.map(entry => buildAbilityEntryHtml(entry)).join('');
            } else {
                content = `<div class="cs-regional-text" style="font-size:0.85rem; line-height:1.4; color:var(--color-text-secondary);">${regionalHtml}</div>`;
            }
            html += `
                <div class="cs-section cs-regional-section" style="margin-top:12px;">
                    <h3 class="cs-section-title"><i class="fa-solid fa-mountain-sun"></i> <span>Regional Effects</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                    <div class="cs-section-content">
                        ${content}
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    function buildVariantSection(m) {
        const variantList = m.variants || (m.variant && Array.isArray(m.variant) ? m.variant : []);
        if (!variantList || variantList.length === 0) return '';

        const rows = variantList.map(v => {
            if (!v) return '';
            const name = v.name || 'Variant';
            const entries = v.entries || (v.entry ? [v.entry] : []);
            const descriptionHtml = v.descriptionHtml || (typeof v === 'string' ? `<p>${v}</p>` : '');
            
            return buildAbilityEntryHtml({
                name,
                entries,
                descriptionHtml,
                actionType: 'variant'
            });
        }).filter(Boolean).join('');

        return `
            <div class="cs-section cs-variant-section" style="margin-top:12px;">
                <h3 class="cs-section-title"><i class="fa-solid fa-masks-theater"></i> <span>Variant Traits</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${rows}
                </div>
            </div>
        `;
    }

    function ensureSpellcastingFromTraits(m) {
        if (!m) return;
        // If monster already has pre-normalized spellcasting data, do not overwrite or guess with regex
        if (m.spellcasting && m.spellcasting.length > 0 && m.spellcasting.some(sc => sc.spellsByLevel || sc.atWill || sc.daily)) {
            return;
        }
        if (!m.trait || !Array.isArray(m.trait) || m.trait.length === 0) return;
        
        const scTraits = m.trait.filter(t => {
            if (!t || !t.name) return false;
            const name = t.name.toLowerCase();
            if (name.includes('magic weapon') || name.includes('magic resistance') || name.includes('magic absorption') || name.includes('magic item') || name.includes('magic sensitivity') || name.includes('magic awareness')) {
                return false;
            }
            return /(?:innate\s+)?spellcasting|psionics/i.test(t.name);
        });
        if (scTraits.length === 0) return;

        m.spellcasting = m.spellcasting && Array.isArray(m.spellcasting) ? m.spellcasting : [];

        scTraits.forEach(trait => {
            if (m.spellcasting.some(sc => sc.name === trait.name)) return; // Avoid duplicate parsing

            const entries = trait.entries || [];
            const flatEntries = entries.map(e => formatRawEntry(e)).join('\n');

            let ability = 'int';
            if (/charisma/i.test(flatEntries)) ability = 'cha';
            else if (/wisdom/i.test(flatEntries)) ability = 'wis';
            else if (/intelligence/i.test(flatEntries)) ability = 'int';
            else if (/constitution/i.test(flatEntries)) ability = 'con';
            else if (/dexterity/i.test(flatEntries)) ability = 'dex';
            else if (/strength/i.test(flatEntries)) ability = 'str';

            let dc = undefined;
            const dcMatch = flatEntries.match(/save DC (\d+)/i);
            if (dcMatch) dc = parseInt(dcMatch[1]);

            let atkMod = undefined;
            const atkMatch = flatEntries.match(/([+-]\d+)\s+to hit/i);
            if (atkMatch) atkMod = parseInt(atkMatch[1]);

            const spells = {};
            const will = [];
            const daily = {};

            const lines = flatEntries.split('\n');
            const headerEntries = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                const cantripMatch = trimmed.match(/^(?:Cantrips\s*\([^)]*\)|At\s+will):\s*(.*)$/i);
                if (cantripMatch) {
                    const rawSpells = cantripMatch[1].split(/,\s*/);
                    rawSpells.forEach(s => {
                        const cleanName = s.replace(/{@spell ([^|}]+).*?}/, '$1').replace(/[*†‡]/g, '').trim();
                        if (cleanName) {
                            if (/at\s+will/i.test(trimmed) && !/cantrips/i.test(trimmed)) {
                                will.push(cleanName);
                            } else {
                                spells['0'] = spells['0'] || { slots: 0, spells: [] };
                                spells['0'].spells.push(cleanName);
                            }
                        }
                    });
                    return;
                }

                const dailyMatch = trimmed.match(/^(\d+)\/day(?:\s+each)?:\s*(.*)$/i);
                if (dailyMatch) {
                    const count = dailyMatch[1];
                    const rawSpells = dailyMatch[2].split(/,\s*/);
                    const key = count + 'e';
                    daily[key] = daily[key] || [];
                    rawSpells.forEach(s => {
                        const cleanName = s.replace(/{@spell ([^|}]+).*?}/, '$1').replace(/[*†‡]/g, '').trim();
                        if (cleanName) daily[key].push(cleanName);
                    });
                    return;
                }

                const levelMatch = trimmed.match(/^(\d+)(?:st|nd|rd|th)\s+level\s*\((?:(\d+)\s+slots?|at\s+will)\):\s*(.*)$/i);
                if (levelMatch) {
                    const lvlNum = levelMatch[1];
                    const numSlots = parseInt(levelMatch[2]) || 0;
                    const rawSpells = levelMatch[3].split(/,\s*/);
                    spells[lvlNum] = spells[lvlNum] || { slots: numSlots, spells: [] };
                    rawSpells.forEach(s => {
                        const cleanName = s.replace(/{@spell ([^|}]+).*?}/, '$1').replace(/[*†‡]/g, '').trim();
                        if (cleanName) spells[lvlNum].spells.push(cleanName);
                    });
                    return;
                }

                headerEntries.push(line);
            });

            const isBlockInnate = /innate|psionic/i.test(trait.name) || ((will.length > 0 || Object.keys(daily).length > 0) && Object.keys(spells).length === 0);
            const scBlock = {
                name: trait.name,
                type: isBlockInnate ? 'innate' : 'slot',
                ability,
                dc,
                atkMod,
                headerEntries: headerEntries.length > 0 ? headerEntries : [trait.name]
            };
            if (Object.keys(spells).length > 0) scBlock.spells = spells;
            if (will.length > 0) scBlock.will = will;
            if (Object.keys(daily).length > 0) scBlock.daily = daily;

            m.spellcasting.push(scBlock);
        });
    }

    function ensureNpcSpells(m) {
        if (!m) return {};
        ensureSpellcastingFromTraits(m);

        let spells = {
            cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: []
        };
        m.dailyUsages = m.dailyUsages || {};

        function findExistingSpell(name, id) {
            const cleanName = (name || '').toLowerCase().trim();
            if (m.spellcasting) {
                for (const blk of m.spellcasting) {
                    if (blk.spellsObj) {
                        for (let lk in blk.spellsObj) {
                            const found = (blk.spellsObj[lk] || []).find(s => (id && s.id === id) || (s.name && s.name.toLowerCase().trim() === cleanName));
                            if (found) return found;
                        }
                    }
                    if (blk.innateObj) {
                        if (blk.innateObj.will) {
                            const found = (blk.innateObj.will || []).find(s => (id && s.id === id) || (s.name && s.name.toLowerCase().trim() === cleanName));
                            if (found) return found;
                        }
                        if (blk.innateObj.daily) {
                            for (let dk in blk.innateObj.daily) {
                                const found = (blk.innateObj.daily[dk] || []).find(s => (id && s.id === id) || (s.name && s.name.toLowerCase().trim() === cleanName));
                                if (found) return found;
                            }
                        }
                    }
                }
            }
            if (m.spells) {
                for (let lk in m.spells) {
                    const found = (m.spells[lk] || []).find(s => (id && s.id === id) || (s.name && s.name.toLowerCase().trim() === cleanName));
                    if (found) return found;
                }
            }
            return null;
        }

        if (m.spellcasting && Array.isArray(m.spellcasting) && m.spellcasting.length > 0) {
            m.spellcasting.forEach((sc, scIdx) => {
                sc.id = sc.id || ('sc_' + scIdx + '_' + Date.now());
                const resolvedBlockType = resolveSpellcastingType(sc, m);
                const isBlockInnate = resolvedBlockType === 'innate';
                const abilityStr = (sc.ability || 'int').toLowerCase();
                const pb = getProfBonus(m.cr ? (m.cr.cr || m.cr) : '0');
                const abScore = m[abilityStr] || 10;
                const abMod = Math.floor((abScore - 10) / 2);
                const dcVal = sc.dc !== undefined ? sc.dc : (8 + pb + abMod);
                const atkVal = sc.atkMod !== undefined ? sc.atkMod : (pb + abMod);
                const casterLvlVal = sc.casterLevel !== undefined ? sc.casterLevel : (m.casterLevel || 0);

                const scSpells = {
                    cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: []
                };
                const scInnate = {
                    will: [],
                    daily: {}
                };

                if (sc.spellsByLevel) {
                    for (let lvl in sc.spellsByLevel) {
                        let levelKey = lvl === '0' ? 'cantrip' : 'level' + lvl;
                        let rawList = sc.spellsByLevel[lvl]?.spells || [];
                        rawList.forEach((sp, spIdx) => {
                            let name = toSpellTitleCase(typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown'));
                            let existing = findExistingSpell(name, typeof sp === 'object' ? sp.id : null);
                            let spObj = existing ? Object.assign({}, existing) : (typeof sp === 'object' ? Object.assign({}, sp) : { id: 'sp_' + scIdx + '_' + lvl + '_' + spIdx, name: name, prepared: true });
                            spObj.id = spObj.id || ('sp_' + scIdx + '_' + lvl + '_' + spIdx);
                            spObj.name = name;
                            spObj.spellcastingBlockId = sc.id;
                            spObj.spellcastingBlockName = sc.name || 'Spellcasting';
                            spObj.spellcastingType = resolvedBlockType;
                            spObj.ability = abilityStr;
                            spObj.dc = dcVal;
                            spObj.atkMod = atkVal;
                            spObj.casterLevel = casterLvlVal;
                            spObj.prepared = spObj.prepared !== undefined ? spObj.prepared : true;
                            if (isBlockInnate) {
                                if (levelKey === 'cantrip') {
                                    spObj.uses = 'at_will';
                                    spObj.innate = true;
                                    scInnate.will.push(spObj);
                                } else {
                                    spObj.innate = true;
                                    spObj.usesMax = 1;
                                    spObj.usesRemaining = m.dailyUsages[spObj.id] !== undefined ? m.dailyUsages[spObj.id] : 1;
                                    scInnate.daily['1e'] = scInnate.daily['1e'] || [];
                                    scInnate.daily['1e'].push(spObj);
                                }
                            } else {
                                if (!scSpells[levelKey].some(s => s.name === spObj.name)) scSpells[levelKey].push(spObj);
                                if (!spells[levelKey].some(s => s.name === spObj.name)) spells[levelKey].push(spObj);
                            }
                        });
                    }
                } else if (sc.spells) {
                    for (let lvl in sc.spells) {
                        let levelKey = lvl === '0' ? 'cantrip' : 'level' + lvl;
                        let rawList = Array.isArray(sc.spells[lvl]) ? sc.spells[lvl] : (sc.spells[lvl]?.spells || []);
                        rawList.forEach((sp, spIdx) => {
                            let name = toSpellTitleCase(typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown'));
                            let existing = findExistingSpell(name, typeof sp === 'object' ? sp.id : null);
                            let spObj = existing ? Object.assign({}, existing) : (typeof sp === 'object' ? Object.assign({}, sp) : { id: 'sp_' + scIdx + '_' + lvl + '_' + spIdx, name: name, prepared: true });
                            spObj.id = spObj.id || ('sp_' + scIdx + '_' + lvl + '_' + spIdx);
                            spObj.name = name;
                            spObj.spellcastingBlockId = sc.id;
                            spObj.spellcastingBlockName = sc.name || 'Spellcasting';
                            spObj.spellcastingType = resolvedBlockType;
                            spObj.ability = abilityStr;
                            spObj.dc = dcVal;
                            spObj.atkMod = atkVal;
                            spObj.casterLevel = casterLvlVal;
                            spObj.prepared = spObj.prepared !== undefined ? spObj.prepared : true;

                            if (isBlockInnate) {
                                if (levelKey === 'cantrip') {
                                    spObj.uses = 'at_will';
                                    spObj.innate = true;
                                    scInnate.will.push(spObj);
                                } else {
                                    spObj.innate = true;
                                    spObj.usesMax = 1;
                                    spObj.usesRemaining = m.dailyUsages[spObj.id] !== undefined ? m.dailyUsages[spObj.id] : 1;
                                    scInnate.daily['1e'] = scInnate.daily['1e'] || [];
                                    scInnate.daily['1e'].push(spObj);
                                }
                            } else {
                                if (scSpells[levelKey] && !scSpells[levelKey].some(s => s.name === name)) {
                                    scSpells[levelKey].push(spObj);
                                }
                                if (spells[levelKey] && !spells[levelKey].some(s => s.name === name)) {
                                    spells[levelKey].push(spObj);
                                }
                            }
                        });
                    }
                }

                if (sc.atWill && Array.isArray(sc.atWill)) {
                    sc.atWill.forEach((sp, spIdx) => {
                        let name = toSpellTitleCase(typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown'));
                        let existing = findExistingSpell(name, typeof sp === 'object' ? sp.id : null);
                        let spObj = existing ? Object.assign({}, existing) : Object.assign({}, typeof sp === 'object' ? sp : {}, {
                            id: sp.id || ('sp_will_' + scIdx + '_' + spIdx),
                            name: name,
                            uses: 'at_will',
                            innate: true,
                            prepared: true,
                            spellcastingBlockId: sc.id,
                            spellcastingBlockName: sc.name || (isBlockInnate ? 'Innate Spellcasting' : 'Spellcasting'),
                            spellcastingType: resolvedBlockType,
                            ability: abilityStr,
                            dc: dcVal,
                            atkMod: atkVal,
                            casterLevel: casterLvlVal
                        });
                        spObj.id = spObj.id || ('sp_will_' + scIdx + '_' + spIdx);
                        spObj.name = name;
                        spObj.uses = 'at_will';
                        spObj.innate = true;
                        spObj.spellcastingBlockId = sc.id;
                        spObj.spellcastingBlockName = sc.name || (isBlockInnate ? 'Innate Spellcasting' : 'Spellcasting');
                        spObj.spellcastingType = resolvedBlockType;
                        spObj.ability = abilityStr;
                        spObj.dc = dcVal;
                        spObj.atkMod = atkVal;
                        spObj.casterLevel = casterLvlVal;
                        scInnate.will.push(spObj);
                        if (!spells.cantrip.some(s => s.name === spObj.name)) spells.cantrip.push(spObj);
                    });
                } else if (sc.will) {
                    sc.will.forEach((sp, spIdx) => {
                        let name = toSpellTitleCase(typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown'));
                        let existing = findExistingSpell(name, typeof sp === 'object' ? sp.id : null);
                        let spObj = existing ? Object.assign({}, existing) : (typeof sp === 'object' ? Object.assign({}, sp) : { id: 'sp_will_' + scIdx + '_' + spIdx, name: name, prepared: true, innate: true, uses: 'at_will' });
                        spObj.id = spObj.id || ('sp_will_' + scIdx + '_' + spIdx);
                        spObj.name = name;
                        spObj.uses = 'at_will';
                        spObj.innate = true;
                        spObj.spellcastingBlockId = sc.id;
                        spObj.spellcastingBlockName = sc.name || (isBlockInnate ? 'Innate Spellcasting' : 'Spellcasting');
                        spObj.spellcastingType = resolvedBlockType;
                        spObj.ability = abilityStr;
                        spObj.dc = dcVal;
                        spObj.atkMod = atkVal;
                        spObj.casterLevel = casterLvlVal;

                        scInnate.will.push(spObj);
                        if (!spells.cantrip.some(s => s.name === name)) spells.cantrip.push(spObj);
                    });
                }

                if (sc.daily) {
                    for (let dailyKey in sc.daily) {
                        let usesMax = parseInt(dailyKey) || 1;
                        scInnate.daily[dailyKey] = scInnate.daily[dailyKey] || [];
                        sc.daily[dailyKey].forEach((sp, spIdx) => {
                            let name = toSpellTitleCase(typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown'));
                            let existing = findExistingSpell(name, typeof sp === 'object' ? sp.id : null);
                            let spId = (existing && existing.id) || (typeof sp === 'object' && sp.id) || ('sp_daily_' + scIdx + '_' + dailyKey + '_' + spIdx);
                            let usesRemaining = m.dailyUsages[spId] !== undefined ? m.dailyUsages[spId] : (existing?.usesRemaining !== undefined ? existing.usesRemaining : usesMax);
                            let spObj = existing ? Object.assign({}, existing) : (typeof sp === 'object' ? Object.assign({}, sp) : { id: spId, name: name, prepared: true, innate: true, usesMax, usesRemaining, dailyKey });
                            spObj.id = spObj.id || spId;
                            spObj.name = name;
                            spObj.usesMax = usesMax;
                            spObj.usesRemaining = usesRemaining;
                            spObj.dailyKey = dailyKey;
                            spObj.innate = true;
                            spObj.spellcastingBlockId = sc.id;
                            spObj.spellcastingBlockName = sc.name || (isBlockInnate ? 'Innate Spellcasting' : 'Spellcasting');
                            spObj.spellcastingType = resolvedBlockType;
                            spObj.ability = abilityStr;
                            spObj.dc = dcVal;
                            spObj.atkMod = atkVal;
                            spObj.casterLevel = casterLvlVal;

                            scInnate.daily[dailyKey].push(spObj);
                        });
                    }
                }

                // Preserve any user-added spells from sc.innateObj
                if (sc.innateObj) {
                    if (scInnate.will.length === 0 && sc.innateObj.will && sc.innateObj.will.length > 0) {
                        scInnate.will = sc.innateObj.will;
                    } else if (sc.innateObj.will) {
                        sc.innateObj.will.forEach(sp => {
                            if (!scInnate.will.some(s => s.id === sp.id || s.name === sp.name)) {
                                scInnate.will.push(sp);
                            }
                        });
                    }
                    if (sc.innateObj.daily) {
                        for (let dk in sc.innateObj.daily) {
                            if (!scInnate.daily[dk]) {
                                scInnate.daily[dk] = sc.innateObj.daily[dk];
                            } else {
                                sc.innateObj.daily[dk].forEach(sp => {
                                    if (!scInnate.daily[dk].some(s => s.id === sp.id || s.name === sp.name)) {
                                        scInnate.daily[dk].push(sp);
                                    }
                                });
                            }
                        }
                    }
                }

                // Preserve any user-added spells from sc.spellsObj
                if (sc.spellsObj) {
                    for (let lk in sc.spellsObj) {
                        if (Array.isArray(sc.spellsObj[lk])) {
                            scSpells[lk] = scSpells[lk] || [];
                            sc.spellsObj[lk].forEach(sp => {
                                if (!scSpells[lk].some(s => s.id === sp.id || (s.name && sp.name && s.name.toLowerCase().trim() === sp.name.toLowerCase().trim()))) {
                                    scSpells[lk].push(sp);
                                }
                                if (spells[lk] && !spells[lk].some(s => s.id === sp.id || (s.name && sp.name && s.name.toLowerCase().trim() === sp.name.toLowerCase().trim()))) {
                                    spells[lk].push(sp);
                                }
                            });
                        }
                    }
                }

                sc.spellsObj = scSpells;
                sc.innateObj = scInnate;
                sc.will = scInnate.will;
                sc.daily = scInnate.daily;
            });
        }

        // Merge any spells already in m.spells (ensures user-added custom spells and custom edits are preserved)
        if (m.spells && typeof m.spells === 'object') {
            for (let lk in m.spells) {
                if (Array.isArray(m.spells[lk])) {
                    m.spells[lk].forEach(spObj => {
                        if (!spells[lk]) spells[lk] = [];
                        const existingIdx = spells[lk].findIndex(s => (s.id && spObj.id && s.id === spObj.id) || (s.name && spObj.name && s.name.toLowerCase().trim() === spObj.name.toLowerCase().trim()));
                        if (existingIdx >= 0) {
                            if (spObj.macroPopulated) {
                                spells[lk][existingIdx] = Object.assign({}, spells[lk][existingIdx], spObj);
                            }
                        } else {
                            spells[lk].push(spObj);
                        }

                        // Also ensure it is present in the target block's spellsObj so it renders on the sheet
                        if (m.spellcasting && m.spellcasting.length > 0) {
                            const targetSc = (spObj.spellcastingBlockId ? m.spellcasting.find(b => b.id === spObj.spellcastingBlockId) : null) || m.spellcasting[0];
                            if (targetSc) {
                                targetSc.spellsObj = targetSc.spellsObj || {};
                                targetSc.spellsObj[lk] = targetSc.spellsObj[lk] || [];
                                const scExistingIdx = targetSc.spellsObj[lk].findIndex(s => (s.id && spObj.id && s.id === spObj.id) || (s.name && spObj.name && s.name.toLowerCase().trim() === spObj.name.toLowerCase().trim()));
                                if (scExistingIdx >= 0) {
                                    if (spObj.macroPopulated) {
                                        targetSc.spellsObj[lk][scExistingIdx] = Object.assign({}, targetSc.spellsObj[lk][scExistingIdx], spObj);
                                    }
                                } else {
                                    targetSc.spellsObj[lk].push(spObj);
                                }
                            }
                        }
                    });
                }
            }
        }

        // If no spellcasting block exists yet on an editable creature, create a default one
        if (!m.spellcasting || !Array.isArray(m.spellcasting) || m.spellcasting.length === 0) {
            const isEditableCreature = Boolean(linkedCharacterId || m.isCustomNpc || m.isCompanion);
            if (isEditableCreature || Object.values(spells).some(arr => arr.length > 0)) {
                const ab = (m.spellcastingAbility || 'int').toLowerCase();
                const pb = getProfBonus(m.cr ? (m.cr.cr || m.cr) : '0');
                const abScore = m[ab] || 10;
                const abMod = Math.floor((abScore - 10) / 2);
                m.spellcasting = [{
                    id: 'sc_default',
                    name: 'Spellcasting',
                    ability: ab,
                    dc: 8 + pb + abMod,
                    atkMod: pb + abMod,
                    spells: {}
                }];
                m.spellcasting[0].spellsObj = spells;
            }
        }

        if (window.VTTSpellManager && window.VTTSpellManager.getSpellCache) {
            const cache = window.VTTSpellManager.getSpellCache();
            if (cache && window.vttPlayerSheetAPI?.parseSpellToMacro) {
                const isMonster2024 = m.source === 'XMM' || m.source === 'XPHB' || m.source === 'XDMG' || !!m.is2024 || (typeof m.source === 'string' && m.source.startsWith('X'));
                const populateSpell = (spObj) => {
                    if (!spObj || spObj.macroPopulated || !spObj.name) return;
                    const cleanName = spObj.name.toLowerCase().replace(/\[.*?\]$/, '').trim();
                    const spSrc = (spObj.source || '').toLowerCase().trim();
                    let spData = null;
                    if (spSrc) {
                        spData = cache.find(s => (s.name || '').toLowerCase().trim() === cleanName && (s.source || '').toLowerCase().trim() === spSrc);
                    }
                    if (!spData) {
                        if (isMonster2024) {
                            spData = cache.find(s => (s.name || '').toLowerCase().trim() === cleanName && (s.source || '').toUpperCase() === 'XPHB') ||
                                     cache.find(s => (s.name || '').toLowerCase().trim() === cleanName && (s.source || '').toUpperCase() === 'PHB') ||
                                     cache.find(s => (s.name || '').toLowerCase().trim() === cleanName);
                        } else {
                            spData = cache.find(s => (s.name || '').toLowerCase().trim() === cleanName && (s.source || '').toUpperCase() === 'PHB') ||
                                     cache.find(s => {
                                         const src = (s.source || '').toUpperCase();
                                         return (s.name || '').toLowerCase().trim() === cleanName && src !== 'XPHB' && src !== 'XDMG' && src !== 'XMM';
                                     }) ||
                                     cache.find(s => (s.name || '').toLowerCase().trim() === cleanName && (s.source || '').toUpperCase() === 'XPHB') ||
                                     cache.find(s => (s.name || '').toLowerCase().trim() === cleanName);
                        }
                    }
                    if (spData) {
                        window.vttPlayerSheetAPI.parseSpellToMacro(spData, spObj, true);
                        spObj.macroPopulated = true;
                    }
                };

                for (let lk in spells) {
                    if (Array.isArray(spells[lk])) spells[lk].forEach(populateSpell);
                }
                if (m.spellcasting) {
                    m.spellcasting.forEach(sc => {
                        if (sc.innateObj?.will) sc.innateObj.will.forEach(populateSpell);
                        if (sc.innateObj?.daily) {
                            for (let dk in sc.innateObj.daily) {
                                (sc.innateObj.daily[dk] || []).forEach(populateSpell);
                            }
                        }
                    });
                }
            }
        }
        m.spells = spells;
        return m.spells;
    }

    function getMaxSlotsForLevel(m, slKey, sc = null) {
        if (!slKey || slKey === 'cantrip') return 0;
        const lvlNum = slKey.replace('level', '');
        
        if (sc) {
            if (sc.spellsByLevel && sc.spellsByLevel[lvlNum] && sc.spellsByLevel[lvlNum].slots !== undefined) {
                return parseInt(sc.spellsByLevel[lvlNum].slots) || 0;
            }
            if (sc.spells && sc.spells[lvlNum] && sc.spells[lvlNum].slots !== undefined) {
                return parseInt(sc.spells[lvlNum].slots) || 0;
            }
        }

        if (m.spellcasting) {
            for (let block of m.spellcasting) {
                if (block.spellsByLevel && block.spellsByLevel[lvlNum] && block.spellsByLevel[lvlNum].slots !== undefined) {
                    return parseInt(block.spellsByLevel[lvlNum].slots) || 0;
                }
                if (block.spells && block.spells[lvlNum] && block.spells[lvlNum].slots !== undefined) {
                    return parseInt(block.spells[lvlNum].slots) || 0;
                }
            }
        }
        if (m.slots && m.slots[slKey] !== undefined) {
            const val = m.slots[slKey];
            return typeof val === 'object' ? (parseInt(val.max) || 0) : (parseInt(val) || 0);
        }
        if (m.spellSlots && m.spellSlots[slKey] !== undefined) {
            const val = m.spellSlots[slKey];
            return typeof val === 'object' ? (parseInt(val.max) || 0) : (parseInt(val) || 0);
        }
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char && char.spellSlots && char.spellSlots[slKey]) {
                const val = char.spellSlots[slKey];
                return typeof val === 'object' ? (parseInt(val.max) || 0) : (parseInt(val) || 0);
            }
        }
        // Fallback: calculate standard slots from Caster Level for slot or pact blocks
        const scResolvedType = sc ? resolveSpellcastingType(sc, m) : null;
        if (sc && (scResolvedType === 'slot' || scResolvedType === 'pact') && (sc.casterLevel || m.casterLevel)) {
            const computed = get5eSlotsForCaster(scResolvedType, sc.casterLevel || m.casterLevel);
            if (computed[slKey] !== undefined) return computed[slKey];
        }
        if (m.spellcasting) {
            for (let block of m.spellcasting) {
                const bResolvedType = resolveSpellcastingType(block, m);
                if ((bResolvedType === 'slot' || bResolvedType === 'pact') && (block.casterLevel || m.casterLevel)) {
                    const computed = get5eSlotsForCaster(bResolvedType, block.casterLevel || m.casterLevel);
                    if (computed[slKey] !== undefined) return computed[slKey];
                }
            }
        }
        return 0;
    }

    function getSpellFromMonster(m, level, idx, spellId = null, blockId = null, sectionKey = null, spellName = null) {
        if (!m) return null;
        const cleanName = spellName ? String(spellName).replace(/\{@spell ([^|}]+).*?\}/gi, '$1').replace(/\s*\[.*?\]$/, '').toLowerCase().trim() : '';

        // 1. Match by spellId / s.spellId across all spellcasting blocks
        if (spellId && m.spellcasting) {
            for (const sc of m.spellcasting) {
                if (sc.innateObj) {
                    const foundWill = (sc.innateObj.will || []).find(s => s.id === spellId || s.spellId === spellId);
                    if (foundWill) return foundWill;
                    for (const k in sc.innateObj.daily) {
                        const foundDaily = (sc.innateObj.daily[k] || []).find(s => s.id === spellId || s.spellId === spellId);
                        if (foundDaily) return foundDaily;
                    }
                }
                if (sc.spellsObj) {
                    for (const k in sc.spellsObj) {
                        const foundSlot = (sc.spellsObj[k] || []).find(s => s.id === spellId || s.spellId === spellId);
                        if (foundSlot) return foundSlot;
                    }
                }
                if (sc.spellsByLevel) {
                    for (const k in sc.spellsByLevel) {
                        const foundSbl = (sc.spellsByLevel[k]?.spells || []).find(s => s.id === spellId || s.spellId === spellId);
                        if (foundSbl) return foundSbl;
                    }
                }
                if (sc.atWill) {
                    const foundAtWill = (sc.atWill || []).find(s => s.id === spellId || s.spellId === spellId);
                    if (foundAtWill) return foundAtWill;
                }
                if (sc.daily) {
                    for (const k in sc.daily) {
                        const foundDaily = (sc.daily[k] || []).find(s => typeof s === 'object' && (s.id === spellId || s.spellId === spellId));
                        if (foundDaily) return foundDaily;
                    }
                }
            }
        }

        // 2. Match by blockId + sectionKey / level + idx
        if (blockId && m.spellcasting) {
            const sc = m.spellcasting.find(b => b.id === blockId);
            if (sc) {
                if (sectionKey === 'will') {
                    if (sc.innateObj?.will?.[idx]) return sc.innateObj.will[idx];
                    if (sc.atWill?.[idx]) return sc.atWill[idx];
                    if (sc.will?.[idx]) return sc.will[idx];
                }
                if (sectionKey) {
                    if (sc.innateObj?.daily?.[sectionKey]?.[idx]) return sc.innateObj.daily[sectionKey][idx];
                    if (sc.daily?.[sectionKey]?.[idx]) return sc.daily[sectionKey][idx];
                }
                if (sc.innateObj) {
                    if (level === 'cantrip' && sc.innateObj?.will?.[idx]) return sc.innateObj.will[idx];
                    if (sc.innateObj?.daily) {
                        for (const k in sc.innateObj.daily) {
                            if (sc.innateObj.daily[k]?.[idx]) return sc.innateObj.daily[k][idx];
                        }
                    }
                }
                if (level) {
                    if (sc.spellsObj?.[level]?.[idx]) return sc.spellsObj[level][idx];
                    const lvlNum = level.replace('level', '');
                    if (sc.spellsByLevel?.[lvlNum]?.spells?.[idx]) return sc.spellsByLevel[lvlNum].spells[idx];
                    if (sc.spellsByLevel?.[level]?.spells?.[idx]) return sc.spellsByLevel[level].spells[idx];
                    if (sc.spells?.[lvlNum]?.[idx]) return sc.spells[lvlNum][idx];
                }
            }
        }

        // 3. Match across m.spells by level + idx
        if (level && idx !== null && idx !== undefined && idx >= 0) {
            if (m.spells?.[level]?.[idx]) return m.spells[level][idx];
            const lvlNum = level.replace('level', '');
            if (m.spells?.[lvlNum]?.[idx]) return m.spells[lvlNum][idx];
            if (level === 'cantrip' && m.spells?.['0']?.[idx]) return m.spells['0'][idx];
        }

        // 4. Match across any spellcasting block by level + idx
        if (m.spellcasting && idx !== null && idx !== undefined && idx >= 0) {
            for (const sc of m.spellcasting) {
                if (level && sc.spellsObj?.[level]?.[idx]) return sc.spellsObj[level][idx];
                const lvlNum = level ? level.replace('level', '') : null;
                if (lvlNum && sc.spellsByLevel?.[lvlNum]?.spells?.[idx]) return sc.spellsByLevel[lvlNum].spells[idx];
                if (level === 'cantrip') {
                    if (sc.innateObj?.will?.[idx]) return sc.innateObj.will[idx];
                    if (sc.atWill?.[idx]) return sc.atWill[idx];
                }
            }
        }

        // 5. Match by cleanName across all blocks and spells
        if (cleanName) {
            if (m.spellcasting) {
                for (const sc of m.spellcasting) {
                    if (sc.innateObj?.will) {
                        const found = sc.innateObj.will.find(s => (s.name || '').toLowerCase().trim() === cleanName);
                        if (found) return found;
                    }
                    if (sc.innateObj?.daily) {
                        for (const k in sc.innateObj.daily) {
                            const found = (sc.innateObj.daily[k] || []).find(s => (s.name || '').toLowerCase().trim() === cleanName);
                            if (found) return found;
                        }
                    }
                    if (sc.spellsObj) {
                        for (const k in sc.spellsObj) {
                            const found = (sc.spellsObj[k] || []).find(s => (s.name || '').toLowerCase().trim() === cleanName);
                            if (found) return found;
                        }
                    }
                    if (sc.spellsByLevel) {
                        for (const k in sc.spellsByLevel) {
                            const found = (sc.spellsByLevel[k]?.spells || []).find(s => (s.name || '').toLowerCase().trim() === cleanName);
                            if (found) return found;
                        }
                    }
                    if (sc.atWill) {
                        const found = (sc.atWill || []).find(s => (s.name || '').toLowerCase().trim() === cleanName);
                        if (found) return found;
                    }
                    if (sc.daily) {
                        for (const k in sc.daily) {
                            const found = (sc.daily[k] || []).find(s => typeof s === 'object' && (s.name || '').toLowerCase().trim() === cleanName);
                            if (found) return found;
                        }
                    }
                }
            }
            if (m.spells) {
                for (const k in m.spells) {
                    if (Array.isArray(m.spells[k])) {
                        const found = m.spells[k].find(s => (s.name || '').toLowerCase().trim() === cleanName);
                        if (found) return found;
                    }
                }
            }
        }
        return null;
    }

    function buildSpellcastingHtml(m) {
        const spellsObj = ensureNpcSpells(m);
        const allowEdit = Boolean(linkedCharacterId || m.isCustomNpc || m.isCompanion);
        const spellLevels = [
            { key: 'cantrip', label: 'Cantrips' },
            { key: 'level1', label: '1st Level' },
            { key: 'level2', label: '2nd Level' },
            { key: 'level3', label: '3rd Level' },
            { key: 'level4', label: '4th Level' },
            { key: 'level5', label: '5th Level' },
            { key: 'level6', label: '6th Level' },
            { key: 'level7', label: '7th Level' },
            { key: 'level8', label: '8th Level' },
            { key: 'level9', label: '9th Level' }
        ];

        let html = `<div style="display:flex; flex-direction:column; gap:14px;">`;
        
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle, rgba(255,255,255,0.1)); margin-bottom:4px;">
                <span style="font-size:0.95rem; font-weight:600; color:var(--color-gold-base);"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px;"></i>Spellcasting</span>
                <button class="btn btn-secondary btn-xxs cs-btn-reset-slots" id="cs-reset-slots-btn" title="Reset all spell slots & innate daily usages"><i class="fa-solid fa-rotate-left"></i> Reset Slots & Usages</button>
            </div>
        `;
        
        if (m.spellcasting && Array.isArray(m.spellcasting) && m.spellcasting.length > 0) {
            m.spellcasting.forEach((sc, scIdx) => {
                const scName = sc.name || 'Spellcasting';
                const abilityStr = (sc.ability || 'INT').toUpperCase();
                const pb = getProfBonus(m.cr ? (m.cr.cr || m.cr) : '0');
                const abScore = m[sc.ability ? sc.ability.toLowerCase() : 'int'] || 10;
                const abMod = Math.floor((abScore - 10) / 2);
                const dcVal = sc.dc !== undefined ? sc.dc : (8 + pb + abMod);
                const atkVal = sc.atkMod !== undefined ? sc.atkMod : (pb + abMod);
                const casterLvlVal = sc.casterLevel !== undefined ? sc.casterLevel : (m.casterLevel || 0);
                const resolvedBlockType = resolveSpellcastingType(sc, m);
                const isInnateType = resolvedBlockType === 'innate';
                const willList = sc.innateObj?.will || [];
                const dailyObj = sc.innateObj?.daily || {};
                const hasWill = willList.length > 0;
                const hasDaily = Object.keys(dailyObj).some(k => dailyObj[k] && dailyObj[k].length > 0);
                const hasWillOrDaily = hasWill || hasDaily;

                const scSpellsObj = sc.spellsObj || { cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: [] };
                const hasSlotsOrLeveledSpells = Boolean(
                    sc.spellsByLevel || 
                    (sc.spells && Object.keys(sc.spells).some(k => k !== '0' && (Array.isArray(sc.spells[k]) ? sc.spells[k].length > 0 : sc.spells[k]?.slots || sc.spells[k]?.spells?.length))) ||
                    spellLevels.some(sl => sl.key !== 'cantrip' && ((sc.spellsObj && sc.spellsObj[sl.key]?.length > 0) || getMaxSlotsForLevel(m, sl.key, sc) > 0))
                );

                // Distinct Casting Type Badges
                let typeBadge = '';
                if (/psionics/i.test(scName)) {
                    typeBadge = `<span class="badge" style="background:rgba(186,85,211,0.2); color:#dda0dd; border:1px solid rgba(186,85,211,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-brain" style="margin-right:3px;"></i>Psionics</span>`;
                } else if (resolvedBlockType === 'pact') {
                    typeBadge = `<span class="badge" style="background:rgba(147,112,219,0.2); color:#ba55d3; border:1px solid rgba(147,112,219,0.35); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-hand-sparkles" style="margin-right:3px;"></i>Pact Magic</span>`;
                } else if (isInnateType) {
                    typeBadge = `<span class="badge" style="background:rgba(30,144,255,0.15); color:#87cefa; border:1px solid rgba(30,144,255,0.25); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-sparkles" style="margin-right:3px;"></i>Innate</span>`;
                } else if (hasWillOrDaily && !hasSlotsOrLeveledSpells) {
                    typeBadge = `<span class="badge" style="background:rgba(30,144,255,0.15); color:#87cefa; border:1px solid rgba(30,144,255,0.25); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-sparkles" style="margin-right:3px;"></i>At-Will / Daily</span>`;
                } else {
                    typeBadge = `<span class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-base); border:1px solid rgba(212,175,55,0.25); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-layer-group" style="margin-right:3px;"></i>Slots</span>`;
                }

                // Distinct Action Cost Badges (e.g. 2024 / XMM action types)
                let actionBadge = '';
                if (sc.displayAs === 'bonus' || /bonus action/i.test(scName)) {
                    actionBadge = `<span class="badge" style="background:rgba(255,165,0,0.18); color:#ffaa00; border:1px solid rgba(255,165,0,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-bolt" style="margin-right:3px;"></i>Bonus Action</span>`;
                } else if (sc.displayAs === 'reaction' || /reaction/i.test(scName)) {
                    actionBadge = `<span class="badge" style="background:rgba(70,130,180,0.2); color:#87ceeb; border:1px solid rgba(70,130,180,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-shield-halved" style="margin-right:3px;"></i>Reaction</span>`;
                } else if (sc.displayAs === 'legendary') {
                    actionBadge = `<span class="badge" style="background:rgba(220,20,60,0.2); color:#ff6b81; border:1px solid rgba(220,20,60,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-crown" style="margin-right:3px;"></i>Legendary</span>`;
                }

                const hEntries = sc.headerEntries ? sc.headerEntries.map(e => formatRawEntry(e)).join('<br>') : '';
                const fEntries = sc.footerEntries ? '<br>' + sc.footerEntries.map(e => formatRawEntry(e)).join('<br>') : '';
                const desc = injectDiceChips(parse5eMarkup(hEntries + fEntries));

                html += `
                    <div class="cs-spellcasting-block" style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.25); border-left: 4px solid var(--color-gold-base); margin-bottom: 8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <strong style="color:var(--color-gold-light); font-size: 1.05rem;"><i class="fa-solid fa-hand-sparkles" style="margin-right:6px;"></i>${scName}</strong>
                                ${typeBadge}
                                ${actionBadge}
                            </div>
                            <div style="display:flex; align-items:center; gap:6px; font-size:0.78rem;">
                                <span style="background:rgba(212,175,55,0.15); color:var(--color-gold-base); padding:2px 8px; border-radius:4px; font-weight:600;">${abilityStr}</span>
                                ${dcVal ? `<span style="background:rgba(255,255,255,0.08); color:var(--color-text-primary); padding:2px 8px; border-radius:4px;">DC ${dcVal}</span>` : ''}
                                ${atkVal !== undefined && atkVal !== null ? `<span style="background:rgba(255,255,255,0.08); color:var(--color-text-primary); padding:2px 8px; border-radius:4px;">${atkVal >= 0 ? '+' : ''}${atkVal} Atk</span>` : ''}
                                ${casterLvlVal ? `<span style="background:rgba(255,255,255,0.08); color:var(--color-text-primary); padding:2px 8px; border-radius:4px;" title="Caster Level">CL ${casterLvlVal}</span>` : ''}
                            </div>
                        </div>
                        ${desc ? `<div style="font-size: 0.88rem; line-height: 1.4; color: var(--color-text-secondary); margin-bottom: 8px;">${desc}</div>` : ''}
                `;

                // At Will group: render if will spells exist, or if allowEdit on an innate/at-will block
                if (hasWill || (allowEdit && (isInnateType || !hasSlotsOrLeveledSpells))) {
                    html += `
                        <div class="cs-spell-page" data-block-id="${sc.id}" style="margin-bottom:8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                                <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base);"><i class="fa-solid fa-infinity" style="margin-right:4px;"></i> At Will</span>
                                ${allowEdit ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="cantrip" data-block-id="${sc.id}" data-section-key="will"><i class="fa-solid fa-plus"></i> Add Spell</button>` : ''}
                            </div>
                            <div style="display:flex; flex-direction:column; gap:8px;">
                                ${willList.length > 0 ? willList.map((sp, idx) => {
                                    const spLvl = sp.level !== undefined ? (sp.level === 0 ? 'cantrip' : 'level' + sp.level) : 'cantrip';
                                    return renderSingleSpellRowHtml(sp, spLvl, idx, allowEdit, sc.id, sp.id, 'will');
                                }).join('') : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No at-will spells added.</div>'}
                            </div>
                        </div>
                    `;
                }

                // Daily groups: render if daily spells exist, or if allowEdit on an innate/at-will block
                if (hasDaily || (allowEdit && (isInnateType || !hasSlotsOrLeveledSpells))) {
                    Object.keys(dailyObj).forEach(dayKey => {
                        const list = dailyObj[dayKey] || [];
                        const usesMax = parseInt(dayKey) || 1;
                        const labelDay = dayKey.endsWith('e') ? `${usesMax}/Day Each` : `${usesMax}/Day`;
                        html += `
                            <div class="cs-spell-page" data-block-id="${sc.id}" style="margin-bottom:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                                    <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base);"><i class="fa-solid fa-sun" style="margin-right:4px;"></i> ${labelDay}</span>
                                    ${allowEdit ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="level1" data-block-id="${sc.id}" data-section-key="${dayKey}"><i class="fa-solid fa-plus"></i> Add Spell</button>` : ''}
                                </div>
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    ${list.length > 0 ? list.map((sp, idx) => {
                                        const spId = sp.id || ('sp_daily_' + scIdx + '_' + dayKey + '_' + idx);
                                        const spLvl = sp.level !== undefined ? (sp.level === 0 ? 'cantrip' : 'level' + sp.level) : 'level1';
                                        const rowHtml = renderSingleSpellRowHtml(sp, spLvl, idx, allowEdit, sc.id, spId, dayKey);
                                        const curUsages = m.dailyUsages && m.dailyUsages[spId] !== undefined ? m.dailyUsages[spId] : usesMax;
                                        let boxesHtml = '';
                                        for (let u = 0; u < usesMax; u++) {
                                            const checked = u < curUsages;
                                            boxesHtml += `<i class="cs-innate-use-checkbox ${checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}" data-spell-id="${spId}" data-uses-max="${usesMax}" data-use-idx="${u}" style="cursor:pointer; color:var(--color-gold-base); font-size:1rem; margin-right:3px;" title="Daily Use ${u+1}/${usesMax}"></i>`;
                                        }
                                        return `
                                            <div style="display:flex; flex-direction:column; gap:2px;">
                                                <div style="display:flex; align-items:center; justify-content:flex-end; padding:0 8px;">
                                                    <span style="font-size:0.7rem; color:var(--color-text-muted); margin-right:6px;">Uses:</span>
                                                    ${boxesHtml}
                                                </div>
                                                ${rowHtml}
                                            </div>
                                        `;
                                    }).join('') : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No daily spells added.</div>'}
                                </div>
                            </div>
                        `;
                    });
                }

                // Leveled Spells block: render only if creature has slots or leveled spells, or if an editable creature is a slot caster
                if (hasSlotsOrLeveledSpells || (allowEdit && !hasWillOrDaily)) {
                    spellLevels.forEach(sl => {
                        const list = scSpellsObj[sl.key] || [];
                        if (list.length === 0 && !allowEdit && m.spellcasting.length > 1) return;

                        const maxSlots = getMaxSlotsForLevel(m, sl.key, sc);
                        const slotTrackerHtml = sl.key !== 'cantrip' ? `
                            <div class="cs-spell-level-slots" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; border:1px solid var(--color-border-subtle, #444);">
                                <span style="color:var(--color-text-muted);">Slots:</span>
                                <input type="number" class="cs-spell-slot-input" data-level="${sl.key}" data-block-id="${sc.id}" data-type="current" data-max="${maxSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Current Slots">
                                <span style="color:var(--color-text-muted);">/</span>
                                <input type="number" class="cs-spell-slot-input" data-level="${sl.key}" data-block-id="${sc.id}" data-type="max" value="${maxSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Max Slots">
                            </div>
                        ` : '';

                        html += `
                            <div class="cs-spell-page" data-block-id="${sc.id}" style="margin-bottom:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                        <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base);">${sl.label}</span>
                                        ${slotTrackerHtml}
                                    </div>
                                    ${allowEdit ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="${sl.key}" data-block-id="${sc.id}"><i class="fa-solid fa-plus"></i> Add Spell</button>` : ''}
                                </div>
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    ${list.length > 0 ? list.map((sp, idx) => renderSingleSpellRowHtml(sp, sl.key, idx, allowEdit, sc.id, sp.id || sp.spellId)).join('') : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No spells added.</div>'}
                                </div>
                            </div>
                        `;
                    });
                }

                html += `</div>`;
            });
        } else {
            spellLevels.forEach(sl => {
                const list = spellsObj[sl.key] || [];
                const maxSlots = getMaxSlotsForLevel(m, sl.key);
                const slotTrackerHtml = sl.key !== 'cantrip' ? `
                    <div class="cs-spell-level-slots" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; border:1px solid var(--color-border-subtle, #444);">
                        <span style="color:var(--color-text-muted);">Slots:</span>
                        <input type="number" class="cs-spell-slot-input" data-level="${sl.key}" data-type="current" data-max="${maxSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Current Slots">
                        <span style="color:var(--color-text-muted);">/</span>
                        <input type="number" class="cs-spell-slot-input" data-level="${sl.key}" data-type="max" value="${maxSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Max Slots">
                    </div>
                ` : '';

                html += `
                    <div class="cs-spell-page" style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base);">${sl.label}</span>
                                ${slotTrackerHtml}
                            </div>
                            ${allowEdit ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="${sl.key}"><i class="fa-solid fa-plus"></i> Add Spell</button>` : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${list.length > 0 ? list.map((sp, idx) => renderSingleSpellRowHtml(sp, sl.key, idx, allowEdit)).join('') : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No spells added.</div>'}
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        return html;
    }

    function renderSingleSpellRowHtml(sp, slKey, idx, allowEdit = false, blockId = '', spellId = '', sectionKey = '') {
        const spId = spellId || sp?.id || sp?.spellId || '';
        let rawHtml = '';
        if (window.VTTSpellManager && window.VTTSpellManager.renderSpellRowHtml) {
            rawHtml = window.VTTSpellManager.renderSpellRowHtml(sp, slKey, idx, { allowEdit, classPrefix: 'cs-spell-' });
        } else if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderSpellRowHtml) {
            rawHtml = window.vttPlayerSheetAPI.renderSpellRowHtml(sp, slKey, idx, false);
            rawHtml = rawHtml.replace(/pc-spell-/g, 'cs-spell-');
            if (!allowEdit) {
                rawHtml = rawHtml.replace(/<button class="[^"]*cs-spell-edit[^"]*"[\s\S]*?<\/button>/gi, '');
                rawHtml = rawHtml.replace(/<div class="cs-spell-drag-handle"[\s\S]*?<\/div>/gi, '');
            }
        } else {
            let spName = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown');
            spName = toSpellTitleCase(spName);
            return `<div class="cs-spell-item" data-block-id="${blockId}" data-spell-id="${spId}" data-section-key="${sectionKey}" data-level="${slKey}" data-idx="${idx}">${spName}</div>`;
        }

        if (rawHtml) {
            rawHtml = rawHtml.replace(/(class="[^"]*cs-spell-item[^"]*")/i, `$1 data-block-id="${blockId}" data-spell-id="${spId}" data-section-key="${sectionKey}"`);
            rawHtml = rawHtml.replace(/(class="[^"]*cs-spell-edit[^"]*")/i, `$1 data-block-id="${blockId}" data-spell-id="${spId}" data-section-key="${sectionKey}"`);
        }
        return rawHtml;
    }

    function formatRawEntry(e) {
        if (!e) return '';
        if (typeof e === 'string') {
            const trimmed = e.trim();
            if (trimmed.startsWith('{"type":') || trimmed.startsWith('{"name":') || trimmed.startsWith('{"items":')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && typeof parsed === 'object') return formatRawEntry(parsed);
                } catch (err) {}
            }
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return `<li style="margin-bottom: 4px;">${trimmed.substring(2)}</li>`;
            }
            return e;
        }
        if (Array.isArray(e)) return e.map(item => formatRawEntry(item)).join(' ');
        
        if (e.type === 'list') {
            const itemsHtml = (e.items || []).map(item => {
                if (typeof item === 'string') {
                    const t = item.trim();
                    if (t.startsWith('{"type":') || t.startsWith('{"name":')) {
                        try {
                            const parsed = JSON.parse(t);
                            if (parsed && typeof parsed === 'object') return formatRawEntry(parsed);
                        } catch (err) {}
                    }
                    return `<li style="margin-bottom: 4px;">${item}</li>`;
                }
                if (item.type === 'itemSub' || item.type === 'item') {
                    const nameStr = item.name ? `<strong><em>${item.name}.</em></strong> ` : '';
                    const entryStr = item.entry ? formatRawEntry(item.entry) : (item.entries ? formatRawEntry(item.entries) : '');
                    return `<li style="margin-bottom: 4px;">${nameStr}${entryStr}</li>`;
                }
                return `<li style="margin-bottom: 4px;">${formatRawEntry(item)}</li>`;
            }).join('');
            return `<ul style="margin: 8px 0; padding-left: 20px;">${itemsHtml}</ul>`;
        }
        
        if (e.type === 'itemSub' || e.type === 'item') {
            const nameStr = e.name ? `<strong><em>${e.name}.</em></strong> ` : '';
            const entryStr = e.entry ? formatRawEntry(e.entry) : (e.entries ? formatRawEntry(e.entries) : '');
            return `${nameStr}${entryStr}`;
        }
        
        if (e.type === 'entries') {
            const nameStr = e.name ? `<strong><em>${e.name}.</em></strong> ` : '';
            const entryStr = e.entries ? formatRawEntry(e.entries) : (e.entry ? formatRawEntry(e.entry) : '');
            return `<div style="margin-top: 8px;">${nameStr}${entryStr}</div>`;
        }

        if (e.type === 'inset') {
            const nameStr = e.name ? `<strong>${e.name}</strong><br>` : '';
            const entryStr = e.entries ? formatRawEntry(e.entries) : (e.entry ? formatRawEntry(e.entry) : '');
            return `<div style="margin: 8px 0; padding: 8px; border-left: 3px solid var(--color-gold-base); background: rgba(0,0,0,0.2);">${nameStr}${entryStr}</div>`;
        }
        
        if (e.type === 'table') {
            return `<div style="margin: 8px 0; font-style: italic; color: var(--color-text-muted);">[Table: ${e.caption || 'Data table omitted'}]</div>`;
        }
        
        if (e.type === 'inlineBlock') {
            const entryStr = e.entries ? formatRawEntry(e.entries) : (e.entry ? formatRawEntry(e.entry) : '');
            return `<span>${entryStr}</span>`;
        }

        if (e.entries) return formatRawEntry(e.entries);
        if (e.entry) return formatRawEntry(e.entry);
        return '';
    }

    function isPassiveAbility(name, rawEntries, cleanText, macro) {
        if (macro) {
            if (macro.isAttack || (macro.damages && macro.damages.length > 0) || macro.save || macro.recharge) return false;
        }
        const combined = (name + ' ' + (typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries)) + ' ' + cleanText).toLowerCase();
        if (/\{@atk\s/i.test(combined) || /\{@hit\s/i.test(combined) || /\bto hit\b/i.test(combined)) return false;
        if (/\{@dc\s/i.test(combined) || /\bsaving throw\b/i.test(combined) || /\bsave dc\b/i.test(combined)) return false;
        if (/\{@damage\s/i.test(combined) || /\b\d+d\d+\b/i.test(combined)) return false;
        if (/\{@recharge/i.test(combined) || /\brecharge\s+\d/i.test(combined)) return false;
        return true;
    }

    function buildAbilityEntryHtml(entry) {
        if (!entry) return '';
        if (typeof entry === 'string') {
            const extName = extractLairTitle(entry) || 'Effect';
            entry = { name: extName, entries: [entry], descriptionHtml: `<p>${entry}</p>` };
        }
        let rawEntries = entry.entries;
        if (!rawEntries && entry.entry) rawEntries = [entry.entry];
        if (!rawEntries) rawEntries = [];

        let name = entry.name || '';
        if (!name && rawEntries.length > 0) {
            const firstText = typeof rawEntries[0] === 'string' ? rawEntries[0] : JSON.stringify(rawEntries[0]);
            name = extractLairTitle(firstText) || '';
        }

        const textLines = rawEntries.map(e => formatRawEntry(e)).join(' ');
        const cleanText = parse5eMarkup(textLines);
        const displayText = entry.descriptionHtml ? injectDiceChips(parse5eMarkup(entry.descriptionHtml)) : injectDiceChips(cleanText);

        const parsedName = name ? parse5eMarkup(name) : '';
        const nameHtml = parsedName 
            ? parsedName 
            : `<span style="color:var(--color-primary); font-size:0.85em;"><i class="fa-solid fa-tower-broadcast"></i> Action</span>`;

        const rawJson = encodeURIComponent(JSON.stringify(rawEntries));
        const macroJson = entry.macro ? encodeURIComponent(JSON.stringify(entry.macro)) : '';
        const isPassive = isPassiveAbility(name, rawEntries, cleanText, entry.macro);

        const nameSectionHtml = isPassive ? `
            <div class="cs-ability-name cs-passive-trigger" title="Click to expand details" style="cursor: pointer; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;">
                ${nameHtml} <span class="badge" style="background: rgba(255,255,255,0.08); color: var(--color-text-muted); font-size: 0.65rem; padding: 1px 6px; border-radius: 10px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px;">Passive</span>
            </div>
        ` : `
            <div class="cs-ability-name cs-macro-trigger" title="Click to roll macro" style="cursor: pointer; flex: 0 0 auto;">
                ${nameHtml} <i class="fa-solid fa-dice-d20" style="font-size: 0.85em; opacity: 0.6; margin-left: 2px;"></i>
            </div>
        `;

        return `
            <div class="cs-ability-entry">
                <div class="cs-ability-header">
                    <i class="cs-card-chevron fa-solid fa-chevron-right"></i>
                    ${nameSectionHtml}
                    <div class="cs-ability-info-btn" title="Ping description to chat" style="cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; transition: background 0.2s, color 0.2s; margin-left: auto;">
                        <i class="fa-solid fa-comment-dots"></i>
                    </div>
                </div>
                <div class="cs-ability-text">${displayText}</div>
                <div class="cs-ability-raw" style="display:none;">${rawJson}</div>
                <div class="cs-ability-macro" style="display:none;">${macroJson}</div>
            </div>
        `;
    }

    // ─── 5etools Markup Parser ────────────────────────────────────────────────
    function parse5eMarkup(text) {
        if (!text) return '';
        let result = text;

        result = result.replace(/\{@atk\s+([^}]+)\}/gi, (match, type) => {
            const t = type.toLowerCase().trim();
            if (t === 'mw') return '<strong>Melee Weapon Attack:</strong>';
            if (t === 'rw') return '<strong>Ranged Weapon Attack:</strong>';
            if (t === 'mw,rw' || t === 'rw,mw') return '<strong>Melee or Ranged Weapon Attack:</strong>';
            if (t === 'ms') return '<strong>Melee Spell Attack:</strong>';
            if (t === 'rs') return '<strong>Ranged Spell Attack:</strong>';
            return '<strong>Attack:</strong>';
        });
        result = result.replace(/\{@atkr\s+([^}]+)\}/gi, (match, type) => {
            const t = type.toLowerCase().trim();
            if (t === 'm') return '<strong>Melee Attack:</strong>';
            if (t === 'r') return '<strong>Ranged Attack:</strong>';
            if (t === 'm,r' || t === 'r,m') return '<strong>Melee or Ranged Attack:</strong>';
            return '<strong>Attack:</strong>';
        });

        // Catch bare attack abbreviations that may have been previously stripped of tags
        result = result.replace(/(?:^|(?<=>)|(?<=\s))\b(mw|rw|ms|rs)\b(?:\s*[,:])?(?=[\s]+(?:reach|range|\+|-|\d|to hit))/gi, (match, type) => {
            const t = type.toLowerCase();
            if (t === 'mw') return '<strong>Melee Weapon Attack:</strong>';
            if (t === 'rw') return '<strong>Ranged Weapon Attack:</strong>';
            if (t === 'ms') return '<strong>Melee Spell Attack:</strong>';
            if (t === 'rs') return '<strong>Ranged Spell Attack:</strong>';
            return match;
        });

        result = result.replace(/\{@hit\s+([+\-]?\d+)\}(?:\s+to\s+hit)?/gi, (match, bonus) => {
            const sign = bonus.startsWith('+') || bonus.startsWith('-') ? '' : '+';
            return `${sign}${bonus} to hit`;
        });

        result = result.replace(/\{@h\}/gi, '<strong>Hit:</strong> ');
        result = result.replace(/\{@m\}/gi, '<strong>Miss:</strong> ');
        result = result.replace(/\{@hom\}/gi, '<strong>Hit or Miss:</strong> ');

        result = result.replace(/\{@damage\s+([^}]+)\}/gi, (match, contents) => {
            const parts = contents.split('|');
            return parts[0].trim();
        });

        result = result.replace(/\{@dc\s+(\d+)\}/gi, '<strong>DC $1</strong>');

        result = result.replace(/\{@recharge\s*(\d*)\}/gi, (match, num) => {
            const val = num ? `${num}–6` : '6';
            return `<strong>(Recharge ${val})</strong>`;
        });

        result = result.replace(/\{@actSave\s+([^}]+)\}/gi, (match, stat) => {
            return `<strong>${stat.toUpperCase()} Saving Throw:</strong>`;
        });
        result = result.replace(/\{@actSaveFail\}/gi, '<em>Failure:</em>');
        result = result.replace(/\{@actSaveSuccess\}/gi, '<em>Success:</em>');
        result = result.replace(/\{@actSaveSuccessOrFail\}/gi, '<em>Success or Failure:</em>');
        result = result.replace(/\{@actTrigger\}/gi, '<strong>Trigger:</strong>');
        result = result.replace(/\{@actResponse\}/gi, '<strong>Response:</strong>');
        
        result = result.replace(/\{@action\s+([^}]+)\}/gi, '<strong>$1</strong>');
        result = result.replace(/\{@condition\s+([^|}]+)[^}]*\}/gi, '<strong>$1</strong>');
        result = result.replace(/\{@variantrule\s+([^|}]+)[^}]*\}/gi, '<strong>$1</strong>');

        result = result.replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, contents) => {
            if (tag === 'b') return `<strong>${contents}</strong>`;
            if (tag === 'i') return `<em>${contents}</em>`;
            if (tag === 'u') return `<u>${contents}</u>`;
            if (tag === 's') return `<s>${contents}</s>`;
            if (tag === 'note') return `<em>Note: ${contents}</em>`;
            if (tag === 'chance') return `${contents}%`;

            const parts = contents.split('|');
            let displayText = parts[0].trim();
            if (parts.length >= 3) {
                const p2 = parts[2].trim();
                if (p2 && isNaN(p2)) {
                    displayText = p2;
                }
            }
            return displayText;
        });

        return result;
    }

    // ─── Dice chip injector ───────────────────────────────────────────────────
    function injectDiceChips(html) {
        if (!html) return '';
        let clean = html;

        // Strip any existing dice-chips back to their inner content to prevent nested buttons
        clean = clean.replace(/<button class="dice-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/gi, '$1');
        clean = clean.replace(/<button class="dice-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/gi, '$1');

        const parts = clean.split(/(<[^>]*>)/g);
        let inButton = false;
        let inAnchor = false;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            if (part.startsWith('<') && part.endsWith('>')) {
                const tagLower = part.toLowerCase();
                if (tagLower.startsWith('<button')) inButton = true;
                else if (tagLower.startsWith('</button')) inButton = false;
                else if (tagLower.startsWith('<a')) inAnchor = true;
                else if (tagLower.startsWith('</a')) inAnchor = false;
                continue;
            }

            if (!inButton && !inAnchor) {
                let text = part;
                text = text.replace(/(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?/gi, (match, count, faces, sign, mod) => {
                    let formula = `${count}d${faces}`;
                    if (sign && mod) formula += `${sign}${mod}`;
                    return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${match.trim()}</button>`;
                });
                text = text.replace(/\+(\d+)\s+to\s+hit/gi, (match, bonus) => {
                    const formula = `1d20+${bonus}`;
                    return `<button class="dice-chip" data-formula="${formula}" title="Roll attack: ${formula}">+${bonus} to hit</button>`;
                });
                text = text.replace(/DC\s+(\d+)/gi, (match, dcVal) => {
                    return `<button class="dice-chip dc-chip" data-dc="${dcVal}" style="border-color: var(--color-gold-base);" title="Ping DC ${dcVal} to Chat">DC ${dcVal}</button>`;
                });
                parts[i] = text;
            }
        }
        return parts.join('');
    }

    // ─── Builders for sub-sections ────────────────────────────────────────────
    function buildTypeString(m) {
        const size = m.size ? sizeCode(m.size) : '';
        const type = m.type ? (typeof m.type === 'object' ? (m.type.type || '') : m.type) : '';
        const tags = m.type?.tags ? (Array.isArray(m.type.tags) ? m.type.tags.join(', ') : m.type.tags) : (m.subtype || '');
        const subtype = tags ? ` (${tags})` : '';
        let align = '';
        if (m.alignment) {
            if (typeof Parser !== 'undefined' && Parser.alignmentListToFull) {
                try {
                    align = ', ' + Parser.alignmentListToFull(m.alignment).toLowerCase();
                } catch (e) {
                    align = ', ' + (Array.isArray(m.alignment) ? m.alignment.join(' ') : m.alignment);
                }
            } else {
                align = ', ' + (Array.isArray(m.alignment) ? m.alignment.join(' ') : m.alignment);
            }
        }
        return `${size} ${type}${subtype}${align}`.trim();
    }

    function sizeCode(s) {
        if (!s) return '';
        const raw = Array.isArray(s) ? s[0] : s;
        const letter = String(raw).trim().charAt(0).toUpperCase();
        const map = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
        return map[letter] || raw || '';
    }

    function buildSpeedString(speed) {
        if (!speed && speed !== 0) return '—';
        if (typeof speed === 'number') return `${speed} ft.`;
        if (typeof speed === 'string') {
            const s = speed.trim();
            if (!s) return '—';
            return /ft\.?$/i.test(s) ? s : `${s} ft.`;
        }
        if (typeof speed === 'object' && speed !== null) {
            const parts = [];
            
            const getSpeedVal = (v) => {
                if (v === undefined || v === null || v === false) return null;
                if (typeof v === 'number') return { val: v, cond: '' };
                if (typeof v === 'object' && v !== null) {
                    const num = typeof v.number === 'number' ? v.number : parseInt(v.number, 10);
                    return { val: !isNaN(num) ? num : null, cond: v.condition ? ` ${v.condition}` : '' };
                }
                const parsed = parseInt(v, 10);
                return { val: !isNaN(parsed) ? parsed : null, cond: '' };
            };

            const walkObj = getSpeedVal(speed.walk);
            const flyObj = getSpeedVal(speed.fly);
            const swimObj = getSpeedVal(speed.swim);
            const burrowObj = getSpeedVal(speed.burrow);
            const climbObj = getSpeedVal(speed.climb);
            const canHover = !!(speed.canHover || (flyObj && flyObj.cond && flyObj.cond.includes('hover')));

            if (walkObj && walkObj.val !== null) {
                if (walkObj.val > 0 || (!flyObj && !swimObj && !burrowObj && !climbObj)) {
                    parts.push(`${walkObj.val} ft.${walkObj.cond}`);
                } else if (walkObj.val === 0 && (flyObj || swimObj || burrowObj || climbObj)) {
                    parts.push(`0 ft.${walkObj.cond}`);
                }
            }
            if (flyObj && flyObj.val !== null && flyObj.val > 0) {
                let flyStr = `Fly ${flyObj.val} ft.`;
                if (canHover && !flyObj.cond.includes('hover')) {
                    flyStr += ' (hover)';
                } else if (flyObj.cond) {
                    flyStr += flyObj.cond;
                }
                parts.push(flyStr);
            }
            if (swimObj && swimObj.val !== null && swimObj.val > 0) {
                parts.push(`Swim ${swimObj.val} ft.${swimObj.cond}`);
            }
            if (burrowObj && burrowObj.val !== null && burrowObj.val > 0) {
                parts.push(`Burrow ${burrowObj.val} ft.${burrowObj.cond}`);
            }
            if (climbObj && climbObj.val !== null && climbObj.val > 0) {
                parts.push(`Climb ${climbObj.val} ft.${climbObj.cond}`);
            }

            if (parts.length > 0) return parts.join(', ');
            if (speed.choose) return `Choose: ${speed.choose}`;
            return '0 ft.';
        }
        return String(speed);
    }

    function formatSkillName(str) {
        if (!str) return '';
        let clean = str.replace(/([A-Z])/g, ' $1');
        return clean.split(/[\s_-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    function buildSavesHtml(m) {
        const savesObj = m.save || m.saves;
        if (!savesObj || Object.keys(savesObj).length === 0) return '';
        return Object.entries(savesObj).map(([k, v]) => {
            const ab = k.toUpperCase();
            const val = parseInt(v) || 0;
            const sign = val >= 0 ? '+' : '';
            const formula = `1d20${sign}${val}`;
            return `<button class="dice-chip" data-formula="${formula}" data-label="${ab} Saving Throw" title="Roll ${ab} Saving Throw">${ab} ${v}</button>`;
        }).join(' ');
    }

    function buildSkillsHtml(m) {
        const skillsObj = m.skill || m.skills;
        if (!skillsObj || Object.keys(skillsObj).length === 0) return '';
        return Object.entries(skillsObj).map(([k, v]) => {
            const skillName = formatSkillName(k);
            const val = parseInt(v) || 0;
            const sign = val >= 0 ? '+' : '';
            const formula = `1d20${sign}${val}`;
            return `<button class="dice-chip" data-formula="${formula}" data-label="${skillName} Check" title="Roll ${skillName} Check">${skillName} ${v}</button>`;
        }).join(' ');
    }

    function buildImmunityHtml(m) {
        const rows = [];
        if (m.immune && (Array.isArray(m.immune) ? m.immune.length > 0 : m.immune)) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Immunities</span><span class="cs-info-value">${formatDamageList(m.immune)}</span></div>`);
        if (m.resist && (Array.isArray(m.resist) ? m.resist.length > 0 : m.resist)) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Resistances</span><span class="cs-info-value">${formatDamageList(m.resist)}</span></div>`);
        if (m.vulnerable && (Array.isArray(m.vulnerable) ? m.vulnerable.length > 0 : m.vulnerable)) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Vulnerabilities</span><span class="cs-info-value">${formatDamageList(m.vulnerable)}</span></div>`);
        if (m.conditionImmune && (Array.isArray(m.conditionImmune) ? m.conditionImmune.length > 0 : m.conditionImmune)) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Cond. Immune</span><span class="cs-info-value">${formatDamageList(m.conditionImmune)}</span></div>`);
        
        let sensesFormatted = '';
        if (m.senses) {
            if (typeof m.senses === 'string') {
                sensesFormatted = m.senses;
            } else if (Array.isArray(m.senses)) {
                sensesFormatted = m.senses.join(', ');
            } else if (typeof m.senses === 'object') {
                const parts = [];
                if (m.senses.sensesString) parts.push(m.senses.sensesString);
                for (const [k, v] of Object.entries(m.senses)) {
                    if (k === 'sensesString' || k === 'passivePerception' || k === 'passive') continue;
                    parts.push(`${formatSkillName(k)} ${v}`);
                }
                const passive = m.senses.passivePerception || m.senses.passive || m.passive;
                if (passive) parts.push(`passive Perception ${passive}`);
                sensesFormatted = parts.join(', ');
            }
        } else if (m.passive) {
            sensesFormatted = `passive Perception ${m.passive}`;
        }
        if (sensesFormatted) {
            rows.push(`<div class="cs-info-row"><span class="cs-info-label">Senses</span><span class="cs-info-value">${sensesFormatted}</span></div>`);
        }
        if (m.languages) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Languages</span><span class="cs-info-value">${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages}</span></div>`);
        return rows.join('');
    }

    function formatDefenseEntry(item) {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (typeof item !== 'object') return String(item);
        
        // Structured object: { types: [...], bypasses: [...], note: "..." }
        if (Array.isArray(item.types) && item.types.length > 0) {
            const typeStr = item.types.join(', ');
            const parts = [];
            if (Array.isArray(item.bypasses) && item.bypasses.length > 0) {
                const hasMagic = item.bypasses.includes('magic') || item.bypasses.includes('nonmagical');
                const hasSilver = item.bypasses.includes('silver') || item.bypasses.includes('silvered');
                const hasAdamantine = item.bypasses.includes('adamantine');
                
                if (hasMagic && hasSilver) {
                    parts.push("from nonmagical attacks that aren't silvered");
                } else if (hasMagic && hasAdamantine) {
                    parts.push("from nonmagical attacks that aren't adamantine");
                } else if (hasMagic) {
                    parts.push("from nonmagical attacks");
                } else if (hasSilver) {
                    parts.push("from attacks that aren't silvered");
                } else if (hasAdamantine) {
                    parts.push("from attacks that aren't adamantine");
                } else {
                    parts.push(`except ${item.bypasses.join(', ')}`);
                }
            }
            if (item.note) {
                parts.push(item.note);
            }
            if (parts.length > 0) {
                return `${typeStr} (${parts.join('; ')})`;
            }
            return typeStr;
        }

        // Legacy 5etools object
        const innerList = item.immune || item.resist || item.vulnerable;
        const innerStr = Array.isArray(innerList) ? innerList.join(', ') : (innerList || '');
        if (item.note && innerStr) {
            return `${innerStr} (${item.note})`;
        } else if (item.note) {
            return item.note;
        } else if (innerStr) {
            return innerStr;
        }
        return JSON.stringify(item);
    }

    function formatDamageList(list) {
        if (!list) return '—';
        if (!Array.isArray(list)) return String(list);
        if (list.length === 0) return '—';
        return list.map(formatDefenseEntry).filter(Boolean).join('; ');
    }

    function getProfBonus(crStr) {
        const cr = parseFloat(crStr) || 0;
        if (cr < 5) return 2;
        if (cr < 9) return 3;
        if (cr < 13) return 4;
        if (cr < 17) return 5;
        if (cr < 21) return 6;
        if (cr < 25) return 7;
        if (cr < 29) return 8;
        return 9;
    }

    function generateArcaneTokenDataUrl(name, category = 'monster') {
        const cleanName = (name || 'Creature').trim();
        const words = cleanName.split(/\s+/).filter(Boolean);
        let initials = words.length > 1 ? (words[0][0] + words[1][0]) : cleanName.slice(0, 2);
        initials = (initials || 'C').toUpperCase();

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'favicon.svg';

        const colors = {
            monster: '#dc2626',
            npc: '#9333ea',
            companion: '#eab308',
            player: '#2563eb'
        };
        const primaryColor = colors[category] || colors.monster;

        ctx.save();
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.clip();

        const bgGrad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
        bgGrad.addColorStop(0, '#1c2436');
        bgGrad.addColorStop(0.7, '#0f1422');
        bgGrad.addColorStop(1, '#080c14');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 128, 128);

        ctx.beginPath();
        ctx.arc(64, 64, 48, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(64, 64, 53, 0, Math.PI * 2);
        ctx.strokeStyle = `${primaryColor}55`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(64, 64, 62, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 36px "Cinzel", "Georgia", "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillText(initials, 65, 66);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(initials, 64, 64);

        return canvas.toDataURL('image/png');
    }

    window.VTT = window.VTT || {};
    window.VTT.generateArcaneToken = generateArcaneTokenDataUrl;

    function getMonsterImageUrl(m) {
        if (!m) return generateArcaneTokenDataUrl('Creature', 'monster');

        // 1. If canvas token is linked, check token's explicit image/URL
        if (linkedTokenId && window.VTT?.canvasEngine) {
            const canvasTokens = window.VTT.canvasEngine.getTokens();
            const token = canvasTokens ? canvasTokens[linkedTokenId] : null;
            if (token) {
                if (token.img) return token.img;
                if (token.imgUrl) return token.imgUrl;
                if (token.src) return token.src;
                if (token.tokenUrl) return token.tokenUrl;
            }
        }

        // 2. If campaign character is linked, check character's custom token artwork / avatar
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char) {
                if (char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex !== -1) {
                    const idx = char.activeTokenIndex || 0;
                    if (idx >= 0 && idx < char.tokenImages.length && char.tokenImages[idx]?.url) {
                        return char.tokenImages[idx].url;
                    }
                }
                if (char.avatarUrl) return char.avatarUrl;
            }
        }

        // 3. Check direct tokenImg / tokenUrl / imgUrl properties on monster object
        if (m.tokenImg) return m.tokenImg;
        if (m.tokenUrl) return m.tokenUrl;
        if (m.imgUrl) return m.imgUrl;

        // 4. Use 5etools Renderer.monster.getTokenUrl(m) if available
        if (typeof window.Renderer !== 'undefined' && window.Renderer?.monster?.getTokenUrl) {
            try {
                const rUrl = window.Renderer.monster.getTokenUrl(m);
                if (rUrl) return rUrl;
            } catch (e) {
                console.warn('[CreatureSheet] Renderer.monster.getTokenUrl failed', e);
            }
        }

        // 5. Fallback path generator based on 5etools naming conventions
        if (m.hasToken || m.source || m.name) {
            const cleanName = typeof window.Parser !== 'undefined' ? window.Parser.nameToTokenName(m.name) : (m.name || '').replace(/"/g, '').trim();
            const source = m.source || 'MM';
            return `img/bestiary/tokens/${source}/${cleanName}.webp`;
        }

        return generateArcaneTokenDataUrl(m.name || 'Creature', 'monster');
    }

    function getLinkedTokenHp() {
        if (!linkedTokenId || !window.VTT?.canvasEngine) return null;
        const tokens = window.VTT.canvasEngine.getTokens();
        return tokens[linkedTokenId]?.hp ?? null;
    }

    function capitalize(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    // ─── Chat posting ─────────────────────────────────────────────────────────
    function rollAndPostToChat(formula, label) {
        if (!vtt.socket) return;

        const regex = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i;
        const match = formula.match(regex);
        if (!match) {
            postAbilityToChat(label, formula);
            return;
        }

        let count = parseInt(match[1]);
        const faces = parseInt(match[2]);
        const sign = match[3] || '+';
        const modifier = match[4] ? parseInt(match[4]) : 0;

        let isAdvantage = false;
        let isDisadvantage = false;
        let rollMode = window.VTT ? window.VTT.currentRollMode : 'normal';
        const evt = window.event;
        
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

        const rollResult = { formula: isAdvantage || isDisadvantage ? `2d20${rollMode==='adv'?'kh1':'kl1'}${sign}${modifier}` : formula, count, faces, diceList, modifier: finalModifier, total };
        const visibility = getVisibilitySetting();
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

    function postAbilityToChat(abilityName, text) {
        if (!vtt.socket) return;
        const visibility = getVisibilitySetting();
        const msgText = `**[${currentMonster?.name || 'Creature'}] ${abilityName}**`;

        if (visibility === 'private') {
            vtt.socket.emit('chat:whisper', { to: vtt.username, text: msgText });
        } else {
            vtt.socket.emit('chat:msg', { text: msgText });
        }
    }

    function getVisibilitySetting() {
        const el = document.getElementById('config-roll-visibility');
        return el ? el.value : 'public';
    }

    // ─── Event delegation for dice chips and ability name clicks ─────────────
    contentEl.addEventListener('click', async (e) => {
        const rollerTarget = e.target.closest('.dice-chip, .render-roller');
        if (rollerTarget) {
            if (rollerTarget.classList.contains('dc-chip')) {
                const dcVal = rollerTarget.dataset.dc;
                const visibility = getVisibilitySetting();
                
                const isSpellcasting = !!rollerTarget.closest('.cs-spellcasting-header');
                const label = isSpellcasting ? "Spellcasting DC" : "Save DC";
                
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
            const label = labelAttr ? `${currentMonster?.name || 'Creature'}: ${labelAttr}` : (currentMonster?.name || 'Creature');
            if (formula) rollAndPostToChat(formula, label);
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
            const visibility = getVisibilitySetting();

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
            const macroCard = parseActionMacro(abilityName, rawEntries, abilityText, charName, preParsedMacro);
            
            if (!macroCard.atkRoll && !macroCard.saveInfo && macroCard.dmgRolls.length === 0) {
                const abilityCard = {
                    creatureName: currentMonster?.name || 'Creature',
                    abilityName: abilityName,
                    text: abilityText
                };
                const visibility = getVisibilitySetting();
                if (visibility === 'private' || visibility === 'gm') {
                    vtt.socket.emit('chat:whisper', { to: vtt.username, text: `uses ${abilityName}`, abilityCard });
                } else {
                    vtt.socket.emit('chat:msg', { text: `uses ${abilityName}`, abilityCard });
                }
            } else {
                const visibility = getVisibilitySetting();
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

        if (e.target.closest('.cs-spell-expand-btn')) {
            const item = e.target.closest('.cs-spell-item');
            if (!item) return;
            const details = item.querySelector('.cs-spell-details');
            const nameEl = item.querySelector('.cs-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : (item.dataset.spellName || 'Spell');
            const descEl = details ? details.querySelector('.cs-spell-desc') : null;
            const btnEl = item.querySelector('.cs-spell-expand-btn');
            
            const level = item.dataset.level || item.querySelector('[data-level]')?.dataset.level;
            const idx = item.dataset.idx !== undefined ? parseInt(item.dataset.idx) : null;
            const blockId = item.dataset.blockId;
            const spellId = item.dataset.spellId;
            const sectionKey = item.dataset.sectionKey;
            
            const isMonster2024 = currentMonster?.source === 'XMM' || 
                                  currentMonster?.source === 'XPHB' || 
                                  currentMonster?.source === 'XDMG' || 
                                  !!currentMonster?.is2024 ||
                                  (typeof currentMonster?.source === 'string' && currentMonster.source.startsWith('X'));
            const spellOptions = { is2024: isMonster2024, caster: currentMonster };

            let sp = getSpellFromMonster(currentMonster, level, idx, spellId, blockId, sectionKey, spellName);
            if (!sp) {
                sp = { name: spellName, level: level, source: isMonster2024 ? 'XPHB' : 'PHB' };
            } else if (!sp.source || sp.source === 'MM' || sp.source === 'XMM') {
                sp.source = isMonster2024 ? 'XPHB' : 'PHB';
            }

            if (details) {
                const chevron = btnEl ? btnEl.querySelector('.fa-chevron-right') : null;
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    if (btnEl) btnEl.classList.add('expanded');
                    if (chevron) chevron.style.transform = 'rotate(90deg)';
                    
                    if (sp && window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                        try {
                            await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
                        } catch (err) {
                            console.warn('[VTTSpellManager] Error parsing spell:', err);
                        }
                    }
                    if (window.VTTSpellManager && window.VTTSpellManager.renderAndInjectSpell) {
                        window.VTTSpellManager.renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level, spellOptions);
                    } else if (typeof renderAndInjectSpell === 'function') {
                        renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level, spellOptions);
                    }
                } else {
                    details.style.display = 'none';
                    if (btnEl) btnEl.classList.remove('expanded');
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            }
        }

        function getCleanedSpellBody(html) {
            if (!html) return '';
            let cleaned = html;
            cleaned = cleaned.replace(/<div class="spell-meta"[^>]*>[\s\S]*?<\/div>/ig, '');
            return cleaned.trim();
        }

        function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp) {
            let metaHtml = '';
            let meta = window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.getSpellMetaStrings ? window.vttPlayerSheetAPI.getSpellMetaStrings(sp || { name: spellName }) : {};
            let level = meta.level || (sp?.level !== undefined ? sp.level : '');
            let school = meta.school || sp?.school || '';
            let time = meta.time || sp?.castingTime || '';
            let range = meta.range || sp?.range || '';
            let components = meta.components || sp?.components || '';
            let duration = meta.duration || sp?.duration || '';
            
            metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
            if (level !== undefined && level !== '') metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${level}</div>`;
            if (school) metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${school}</div>`;
            if (time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${time}</div>`;
            if (range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${range}</div>`;
            if (components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${components}</div>`;
            if (duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${duration}</div>`;
            metaHtml += '</div>';

            let rawBody = sp?.description || fallbackDesc || '';
            if (typeof injectDiceChips === 'function') {
                rawBody = injectDiceChips(rawBody);
            }
            
            if (!rawBody && !metaHtml) {
                containerEl.innerHTML = fallbackDesc ? `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>` : `<em>Could not find full text for ${spellName}</em>`;
            } else {
                containerEl.innerHTML = metaHtml + rawBody;
            }
        }
    });

    // ─── Mass Roll Context Menu & Workflow ────────────────────────────────────
    function escapeMassRollHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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
        
        // Probe whether this ability has an attack roll or damage roll
        const probeMacro = parseActionMacro(abilityName, rawEntries, abilityText, charName, preParsedMacro, 'normal');
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
                    preParsedMacro
                });
            }
        });
    });

    function showMassRollDialog({ abilityName, charName, initialMode, hasAttack, onConfirm }) {
        const existing = document.getElementById('vtt-mass-roll-backdrop');
        if (existing) existing.remove();

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

                ${hasAttack ? `
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
                ` : ''}
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

        dialog.querySelectorAll('.mass-roll-preset-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const c = parseInt(chip.dataset.count) || 2;
                updateCount(c);
            });
        });

        if (hasAttack) {
            dialog.querySelectorAll('.mass-roll-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    dialog.querySelectorAll('.mass-roll-mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentMode = btn.dataset.mode;
                });
            });
        }

        function closeDialog() {
            window.removeEventListener('keydown', onKeyDown);
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

        window.addEventListener('keydown', onKeyDown);
        dialog.querySelector('#btn-mass-roll-close').addEventListener('click', closeDialog);
        dialog.querySelector('#btn-mass-roll-cancel').addEventListener('click', closeDialog);
        dialog.querySelector('#btn-mass-roll-confirm').addEventListener('click', doConfirm);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog();
        });
    }

    function executeMassRolls({ count, rollMode, abilityName, rawEntries, abilityText, charName, preParsedMacro }) {
        if (!vtt.socket) return;
        const visibility = getVisibilitySetting();
        const attacks = [];
        let index = 0;

        function rollNext() {
            if (index < count) {
                const i = index + 1;
                const macroCard = parseActionMacro(abilityName, rawEntries, abilityText, charName, preParsedMacro, rollMode);
                const msgOut = {
                    text: `uses ${abilityName} (#${i})`,
                    macroCard: macroCard,
                    creatureName: charName
                };

                if (visibility === 'private' || visibility === 'gm') {
                    msgOut.to = vtt.username;
                    vtt.socket.emit('chat:whisper', msgOut);
                } else {
                    vtt.socket.emit('chat:msg', msgOut);
                }

                attacks.push({
                    index: i,
                    atkRoll: macroCard.atkRoll ? {
                        formula: macroCard.atkRoll.formula,
                        total: macroCard.atkRoll.total,
                        breakdownStr: macroCard.atkRoll.breakdownStr,
                        diceList: macroCard.atkRoll.diceList,
                        isCritSuccess: macroCard.atkRoll.isCritSuccess,
                        isCritFail: macroCard.atkRoll.isCritFail
                    } : null,
                    dmgRolls: (macroCard.dmgRolls || []).map(dr => ({
                        type: dr.type,
                        formula: dr.formula,
                        saveRider: !!dr.saveRider,
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
                // All N individual rolls finished rolling! Emit the GM-Only Mass Attack Summary Card!
                const massAttackCard = {
                    creatureName: charName,
                    abilityName: abilityName,
                    rollMode: rollMode,
                    attacks: attacks,
                    resolved: null,
                    timestamp: Date.now()
                };

                vtt.socket.emit('chat:msg', {
                    whisperToGM: true,
                    massAttackCard: massAttackCard
                });
            }
        }

        rollNext();
    }
    let currentEditCharId = null;
    let currentEditDefenses = null;

    function defenseToEditableRows(list) {
        if (!list) return [];
        const arr = Array.isArray(list) ? list : [list];
        const rows = [];
        arr.forEach(item => {
            if (!item) return;
            if (typeof item === 'string') {
                rows.push({
                    types: [item.trim().toLowerCase()],
                    bypasses: [],
                    note: ''
                });
            } else if (typeof item === 'object') {
                if (Array.isArray(item.types)) {
                    rows.push({
                        types: item.types.map(t => String(t).trim().toLowerCase()).filter(Boolean),
                        bypasses: Array.isArray(item.bypasses) ? item.bypasses.map(b => String(b).trim().toLowerCase()).filter(Boolean) : [],
                        note: item.note || ''
                    });
                } else {
                    const inner = item.immune || item.resist || item.vulnerable || [];
                    const types = (Array.isArray(inner) ? inner : [inner]).map(t => String(t).trim().toLowerCase()).filter(Boolean);
                    const note = item.note || '';
                    const bypasses = [];
                    if (/nonmagical/i.test(note)) bypasses.push('magic');
                    if (/silver/i.test(note)) bypasses.push('silver');
                    if (/adamantine/i.test(note)) bypasses.push('adamantine');
                    rows.push({ types, bypasses, note });
                }
            }
        });
        return rows;
    }

    function editableRowsToDefenses(rows) {
        if (!rows || !Array.isArray(rows)) return [];
        const list = [];
        rows.forEach(r => {
            const types = (r.types || []).map(t => t.trim().toLowerCase()).filter(Boolean);
            if (types.length === 0) return;
            const bypasses = (r.bypasses || []).map(b => b.trim().toLowerCase()).filter(Boolean);
            const note = (r.note || '').trim();
            if (bypasses.length > 0 || note) {
                list.push({ types, bypasses, note });
            } else {
                types.forEach(t => list.push(t));
            }
        });
        return list;
    }

    function parseDefenseTextInput(text, fallbackExisting = []) {
        if (!text || !text.trim()) return [];
        const entries = text.split(/;|\,(?![^\(]*\))/).map(s => s.trim()).filter(Boolean);
        const result = [];
        entries.forEach(entry => {
            const parenMatch = entry.match(/^([^\(]+)(?:\((.*)\))?$/);
            if (parenMatch) {
                const typePart = parenMatch[1].trim();
                const notePart = (parenMatch[2] || '').trim();
                const types = typePart.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                if (notePart) {
                    const bypasses = [];
                    if (/nonmagical/i.test(notePart)) bypasses.push('magic');
                    if (/silver/i.test(notePart)) bypasses.push('silver');
                    if (/adamantine/i.test(notePart)) bypasses.push('adamantine');
                    result.push({ types, bypasses, note: notePart });
                } else {
                    types.forEach(t => result.push(t));
                }
            } else {
                result.push(entry.toLowerCase());
            }
        });
        return result.length > 0 ? result : fallbackExisting;
    }

    function openCreatureDefenseConfigModal(currentDefenses, onApply) {
        let overlay = document.getElementById('cs-defenses-modal-overlay');
        if (overlay) overlay.remove();

        const ALL_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
        const BPS_TYPES = ['bludgeoning', 'piercing', 'slashing'];
        const ELEM_TYPES = ['acid', 'cold', 'fire', 'lightning', 'thunder'];

        const state = {
            resist: JSON.parse(JSON.stringify(currentDefenses.resist || [])),
            immune: JSON.parse(JSON.stringify(currentDefenses.immune || [])),
            vulnerable: JSON.parse(JSON.stringify(currentDefenses.vulnerable || []))
        };
        let activeTab = 'resist';

        overlay = document.createElement('div');
        overlay.id = 'cs-defenses-modal-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:10001; display:flex; justify-content:center; align-items:center;";

        const modal = document.createElement('div');
        modal.style.cssText = "width:620px; max-width:92vw; max-height:88vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-gold-base, #c5a059); border-radius:8px; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.9);";

        modal.innerHTML = `
            <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle, #333); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:8px 8px 0 0;">
                <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base); font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield-halved"></i> Configure Creature Defenses
                </h3>
                <button type="button" id="cs-def-close-btn" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="display:flex; border-bottom:1px solid var(--color-border-subtle, #333); background:rgba(0,0,0,0.2);">
                <button type="button" class="cs-def-tab-btn" data-tab="resist" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Resistances</button>
                <button type="button" class="cs-def-tab-btn" data-tab="immune" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Immunities</button>
                <button type="button" class="cs-def-tab-btn" data-tab="vulnerable" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Vulnerabilities</button>
            </div>
            <div id="cs-def-tab-content" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;"></div>
            <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle, #333); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:0 0 8px 8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="cs-def-add-row-btn" style="display:inline-flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-plus"></i> Add Defense Rule
                </button>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="cs-def-cancel-btn">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="cs-def-apply-btn">Apply Defenses</button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function updateTabStyles() {
            modal.querySelectorAll('.cs-def-tab-btn').forEach(btn => {
                const isActive = btn.dataset.tab === activeTab;
                btn.style.borderBottomColor = isActive ? 'var(--color-gold-base, #c5a059)' : 'transparent';
                btn.style.color = isActive ? 'var(--color-gold-base, #c5a059)' : 'var(--color-text-muted)';
                btn.style.background = isActive ? 'rgba(197, 160, 89, 0.1)' : 'transparent';
            });
        }

        function renderRows() {
            const container = modal.querySelector('#cs-def-tab-content');
            container.innerHTML = '';
            const rows = state[activeTab] || [];

            if (rows.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:32px 16px; color:var(--color-text-muted); font-size:0.85rem;">
                        No ${activeTab} configured yet.<br>Click <strong>"Add Defense Rule"</strong> below to create one.
                    </div>
                `;
                return;
            }

            rows.forEach((row, rIdx) => {
                const rowCard = document.createElement('div');
                rowCard.style.cssText = "background:rgba(255,255,255,0.03); border:1px solid var(--color-border-subtle, #333); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:10px;";

                const cardHeader = document.createElement('div');
                cardHeader.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
                cardHeader.innerHTML = `
                    <span style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Rule #${rIdx + 1}</span>
                    <button type="button" class="btn btn-danger btn-xxs cs-def-del-row" data-idx="${rIdx}" style="padding:2px 6px;" title="Delete this rule"><i class="fa-solid fa-trash"></i></button>
                `;
                rowCard.appendChild(cardHeader);

                const typesSection = document.createElement('div');
                typesSection.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted);">Damage Types:</span>
                        <div style="display:flex; gap:4px;">
                            <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-bps" data-idx="${rIdx}" style="font-size:0.7rem; padding:1px 5px;">BPS</button>
                            <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-elem" data-idx="${rIdx}" style="font-size:0.7rem; padding:1px 5px;">Elemental</button>
                            <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-clear" data-idx="${rIdx}" style="font-size:0.7rem; padding:1px 5px;">Clear</button>
                        </div>
                    </div>
                `;

                const chipsGrid = document.createElement('div');
                chipsGrid.style.cssText = "display:flex; flex-wrap:wrap; gap:4px;";
                ALL_TYPES.forEach(t => {
                    const isSelected = (row.types || []).map(x => x.toLowerCase()).includes(t);
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'cs-def-type-chip';
                    chip.dataset.type = t;
                    chip.dataset.idx = rIdx;
                    chip.textContent = t.charAt(0).toUpperCase() + t.slice(1);
                    chip.style.cssText = isSelected
                        ? "padding:2px 8px; font-size:0.75rem; border-radius:12px; border:1px solid var(--color-gold-base, #c5a059); background:var(--color-gold-base, #c5a059); color:#000; font-weight:600; cursor:pointer;"
                        : "padding:2px 8px; font-size:0.75rem; border-radius:12px; border:1px solid var(--color-border-subtle, #444); background:rgba(0,0,0,0.2); color:var(--color-text-muted); cursor:pointer;";
                    
                    chip.addEventListener('click', () => {
                        row.types = row.types || [];
                        const curIdx = row.types.findIndex(x => x.toLowerCase() === t);
                        if (curIdx >= 0) row.types.splice(curIdx, 1);
                        else row.types.push(t);
                        renderRows();
                    });
                    chipsGrid.appendChild(chip);
                });
                typesSection.appendChild(chipsGrid);
                rowCard.appendChild(typesSection);

                const bypassSection = document.createElement('div');
                bypassSection.style.cssText = "background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; display:flex; flex-direction:column; gap:4px;";
                const bypasses = (row.bypasses || []).map(b => b.toLowerCase());
                const isMagicBypass = bypasses.includes('magic') || bypasses.includes('nonmagical');
                const isSilverBypass = bypasses.includes('silver') || bypasses.includes('silvered');
                const isAdamBypass = bypasses.includes('adamantine');

                bypassSection.innerHTML = `
                    <span style="font-size:0.72rem; color:var(--color-gold-base); font-weight:600; text-transform:uppercase;">Bypassed by attacks that are:</span>
                    <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:2px;">
                        <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                            <input type="checkbox" class="cs-def-bypass-magic" data-idx="${rIdx}" ${isMagicBypass ? 'checked' : ''}> Magical (Nonmagical bypasses)
                        </label>
                        <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                            <input type="checkbox" class="cs-def-bypass-silver" data-idx="${rIdx}" ${isSilverBypass ? 'checked' : ''}> Silvered
                        </label>
                        <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                            <input type="checkbox" class="cs-def-bypass-adam" data-idx="${rIdx}" ${isAdamBypass ? 'checked' : ''}> Adamantine
                        </label>
                    </div>
                `;
                rowCard.appendChild(bypassSection);

                const noteSection = document.createElement('div');
                noteSection.innerHTML = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted); white-space:nowrap;">Note:</span>
                        <input type="text" class="vtt-input cs-def-note-input" data-idx="${rIdx}" value="${(row.note || '').replace(/"/g, '&quot;')}" placeholder="e.g. while in dim light or darkness" style="width:100%; font-size:0.75rem; padding:3px 6px;">
                    </div>
                `;
                rowCard.appendChild(noteSection);

                container.appendChild(rowCard);
            });

            container.querySelectorAll('.cs-def-del-row').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    state[activeTab].splice(idx, 1);
                    renderRows();
                });
            });

            container.querySelectorAll('.cs-def-preset-bps').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    const r = state[activeTab][idx];
                    r.types = [...new Set([...(r.types || []), ...BPS_TYPES])];
                    renderRows();
                });
            });

            container.querySelectorAll('.cs-def-preset-elem').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    const r = state[activeTab][idx];
                    r.types = [...new Set([...(r.types || []), ...ELEM_TYPES])];
                    renderRows();
                });
            });

            container.querySelectorAll('.cs-def-preset-clear').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    state[activeTab][idx].types = [];
                    renderRows();
                });
            });

            container.querySelectorAll('.cs-def-bypass-magic').forEach(cb => {
                cb.addEventListener('change', () => {
                    const idx = parseInt(cb.dataset.idx);
                    const r = state[activeTab][idx];
                    r.bypasses = r.bypasses || [];
                    r.bypasses = r.bypasses.filter(b => b !== 'magic' && b !== 'nonmagical');
                    if (cb.checked) r.bypasses.push('magic');
                });
            });

            container.querySelectorAll('.cs-def-bypass-silver').forEach(cb => {
                cb.addEventListener('change', () => {
                    const idx = parseInt(cb.dataset.idx);
                    const r = state[activeTab][idx];
                    r.bypasses = r.bypasses || [];
                    r.bypasses = r.bypasses.filter(b => b !== 'silver' && b !== 'silvered');
                    if (cb.checked) r.bypasses.push('silver');
                });
            });

            container.querySelectorAll('.cs-def-bypass-adam').forEach(cb => {
                cb.addEventListener('change', () => {
                    const idx = parseInt(cb.dataset.idx);
                    const r = state[activeTab][idx];
                    r.bypasses = r.bypasses || [];
                    r.bypasses = r.bypasses.filter(b => b !== 'adamantine');
                    if (cb.checked) r.bypasses.push('adamantine');
                });
            });

            container.querySelectorAll('.cs-def-note-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    const idx = parseInt(inp.dataset.idx);
                    state[activeTab][idx].note = inp.value;
                });
            });
        }

        modal.querySelectorAll('.cs-def-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                updateTabStyles();
                renderRows();
            });
        });

        modal.querySelector('#cs-def-add-row-btn').addEventListener('click', () => {
            state[activeTab] = state[activeTab] || [];
            state[activeTab].push({ types: [], bypasses: [], note: '' });
            renderRows();
        });

        const closeFn = () => overlay.remove();
        modal.querySelector('#cs-def-close-btn').addEventListener('click', closeFn);
        modal.querySelector('#cs-def-cancel-btn').addEventListener('click', closeFn);

        modal.querySelector('#cs-def-apply-btn').addEventListener('click', () => {
            onApply(state);
            closeFn();
        });

        updateTabStyles();
        renderRows();
    }

    function openEditModal(m, charId) {
        currentEditCharId = charId;
        currentEditDefenses = {
            resist: defenseToEditableRows(m.resist),
            immune: defenseToEditableRows(m.immune),
            vulnerable: defenseToEditableRows(m.vulnerable)
        };
        const char = window.VTT.campaignState.characters[charId];
        
        let overlay = document.getElementById('cs-edit-modal-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'cs-edit-modal-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:9999; display:flex; justify-content:center; align-items:center;";
        
        const modalContainer = document.createElement('div');
        modalContainer.style.cssText = "width: 500px; max-width: 90vw; max-height: 85vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-border, #444); border-radius: 8px; display:flex; flex-direction:column; box-shadow: 0 4px 16px rgba(0,0,0,0.8);";

        const header = document.createElement('div');
        header.style.cssText = "padding:12px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-dark); border-radius: 8px 8px 0 0;";
        header.innerHTML = `
            <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base);">Edit Companion</h3>
            <div>
                <button class="btn btn-sm btn-primary" id="cs-edit-save-btn">Save</button>
                <button class="btn btn-sm btn-secondary" id="cs-edit-cancel-btn">Cancel</button>
            </div>
        `;
        
        const content = document.createElement('div');
        content.id = 'cs-edit-modal-content';
        content.style.cssText = "flex:1; overflow-y:auto; padding:12px;";

        modalContainer.appendChild(header);
        modalContainer.appendChild(content);
        overlay.appendChild(modalContainer);
        document.body.appendChild(overlay);

        const name = char.name || m.name || '';
        
        if (!char.tokenImages) {
            char.tokenImages = [];
            char.activeTokenIndex = 0;
        } else if (typeof char.tokenImages === 'string') {
            char.tokenImages = [{ url: char.tokenImages, name: 'Imported Token' }];
            char.activeTokenIndex = 0;
        } else if (Array.isArray(char.tokenImages)) {
            char.tokenImages = char.tokenImages.map(t => typeof t === 'string' ? { url: t, name: 'Imported Token' } : (t && typeof t === 'object' ? t : { url: '', name: 'Unknown' }));
        } else {
            char.tokenImages = [];
            char.activeTokenIndex = 0;
        }
        if (typeof char.activeTokenIndex !== 'number') char.activeTokenIndex = 0;

        let defaultTokenUrl = m.tokenImg || m.tokenUrl || m.imgUrl;
        if (!defaultTokenUrl && typeof window.Renderer !== 'undefined' && window.Renderer.monster && window.Renderer.monster.getTokenUrl) {
            try { defaultTokenUrl = window.Renderer.monster.getTokenUrl(m); } catch (e) {}
        }
        if (!defaultTokenUrl && (m.source || m.name)) {
            const cleanName = typeof window.Parser !== 'undefined' ? window.Parser.nameToTokenName(m.name) : (m.name || '').replace(/"/g, '').trim();
            const source = m.source || 'MM';
            defaultTokenUrl = `img/bestiary/tokens/${source}/${cleanName}.webp`;
        }
        if (defaultTokenUrl && !char.defaultTokenDeleted) {
            const hasDefault = char.tokenImages.some(t => t?.isDefault || (typeof t === 'string' ? t : t?.url) === defaultTokenUrl);
            if (!hasDefault) {
                char.tokenImages.unshift({ url: defaultTokenUrl, name: 'Default Token', isDefault: true });
            }
        }

        const acObj = Array.isArray(m.ac) ? m.ac[0] : m.ac;
        const ac = (typeof acObj === 'object' && acObj !== null) 
            ? (acObj.value ?? acObj.ac ?? m.primaryAc ?? 10) 
            : (acObj || m.primaryAc || 10);
        const hpAvg = m.hp?.average || 0;
        const hpForm = m.hp?.formula || '';

        const saves = m.save || {};

        const rawSize = Array.isArray(m.size) ? m.size[0] : (m.size || 'M');
        const currSize = String(rawSize || 'M').trim().charAt(0).toUpperCase();

        const stdTypes = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];
        let typeCategory = 'humanoid';
        let customTypeValue = '';
        let tagsStr = '';

        if (typeof m.type === 'string') {
            const rawType = m.type.toLowerCase();
            if (stdTypes.includes(rawType)) {
                typeCategory = rawType;
            } else {
                typeCategory = 'custom';
                customTypeValue = m.type;
            }
        } else if (m.type && typeof m.type === 'object') {
            const rawType = (m.type.type || (Array.isArray(m.type.choose) ? m.type.choose[0] : '') || '').toLowerCase();
            if (stdTypes.includes(rawType)) {
                typeCategory = rawType;
            } else {
                typeCategory = 'custom';
                customTypeValue = m.type.type || '';
            }
            if (Array.isArray(m.type.tags)) {
                tagsStr = m.type.tags.map(t => typeof t === 'string' ? t : t?.tag || '').filter(Boolean).join(', ');
            } else if (typeof m.type.tags === 'string') {
                tagsStr = m.type.tags;
            }
        }

        let alignCategory = 'U';
        let customAlignValue = '';

        if (Array.isArray(m.alignment)) {
            if (m.alignment.length === 2 && typeof m.alignment[0] === 'string' && typeof m.alignment[1] === 'string') {
                const code = (m.alignment[0] + m.alignment[1]).toUpperCase();
                if (['LG', 'NG', 'CG', 'LN', 'CN', 'LE', 'NE', 'CE'].includes(code)) {
                    alignCategory = code;
                } else {
                    alignCategory = 'custom';
                    customAlignValue = m.alignment.join(' ');
                }
            } else if (m.alignment.length === 1 && typeof m.alignment[0] === 'string') {
                const code = m.alignment[0].toUpperCase();
                if (code === 'N' || code === 'NX' || code === 'NY') alignCategory = 'N';
                else if (code === 'U') alignCategory = 'U';
                else if (code === 'A') alignCategory = 'A';
                else {
                    alignCategory = 'custom';
                    customAlignValue = m.alignment[0];
                }
            } else if (m.alignment.length > 0) {
                alignCategory = 'custom';
                try {
                    customAlignValue = typeof Parser !== 'undefined' && Parser.alignmentListToFull ? Parser.alignmentListToFull(m.alignment) : JSON.stringify(m.alignment);
                } catch (e) {
                    customAlignValue = m.alignment.join(' ');
                }
            }
        } else if (typeof m.alignment === 'string') {
            const rawAlign = m.alignment.toLowerCase();
            const alignMap = {
                'lawful good': 'LG', 'neutral good': 'NG', 'chaotic good': 'CG',
                'lawful neutral': 'LN', 'true neutral': 'N', 'neutral': 'N', 'chaotic neutral': 'CN',
                'lawful evil': 'LE', 'neutral evil': 'NE', 'chaotic evil': 'CE',
                'unaligned': 'U', 'any alignment': 'A'
            };
            if (alignMap[rawAlign]) {
                alignCategory = alignMap[rawAlign];
            } else {
                alignCategory = 'custom';
                customAlignValue = m.alignment;
            }
        }
        
        let sensesValue = '';
        if (m.senses) {
            if (typeof m.senses === 'string') {
                sensesValue = m.senses;
            } else if (Array.isArray(m.senses)) {
                sensesValue = m.senses.join(', ');
            } else if (typeof m.senses === 'object') {
                const parts = [];
                if (m.senses.sensesString) parts.push(m.senses.sensesString);
                ['darkvision', 'blindsight', 'truesight', 'tremorsense', 'devilSight'].forEach(k => {
                    if (m.senses[k] && !m.senses.sensesString?.toLowerCase().includes(k.toLowerCase())) {
                        const name = k === 'devilSight' ? "devil's sight" : k;
                        parts.push(`${name} ${m.senses[k]} ft.`);
                    }
                });
                const passive = m.senses.passivePerception || m.senses.passive || m.passive;
                if (passive !== undefined && passive !== null && passive !== '') {
                    parts.push(`passive Perception ${passive}`);
                }
                if (parts.length > 0) {
                    sensesValue = parts.join(', ');
                } else {
                    sensesValue = Object.entries(m.senses)
                        .filter(([k]) => k !== 'sensesString' && k !== 'passivePerception' && k !== 'passive')
                        .map(([k, v]) => `${k} ${v}`)
                        .join(', ');
                }
            }
        } else if (m.passive) {
            sensesValue = `passive Perception ${m.passive}`;
        }

        let html = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Identity</h4>
                    <div style="display:flex; gap:12px; margin-bottom:8px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Name</label>
                            <input type="text" id="cs-edit-name" class="vtt-input" style="width:100%;" value="${name}">
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <label style="font-size:0.8rem;">Token Gallery <span style="font-weight:normal; color:var(--color-text-muted); margin-left:8px;">(Click active to deselect & use Bestiary art)</span></label>
                            <div style="display:flex; gap:4px;">
                                <input type="text" id="cs-edit-token-add-url" class="vtt-input vtt-input-sm" style="width:120px;" placeholder="Image URL">
                                <button class="btn btn-xs btn-secondary" id="cs-edit-token-add-btn"><i class="fa-solid fa-plus"></i></button>
                                <input type="file" id="cs-edit-token-file" style="display:none;" accept="image/*,video/*">
                                <button class="btn btn-xs btn-primary" id="cs-edit-token-upload-btn" title="Upload Media"><i class="fa-solid fa-upload"></i></button>
                            </div>
                        </div>
                        <div id="cs-edit-token-gallery" style="display:flex; gap:8px; flex-wrap:wrap; padding:8px; background:var(--color-bg-dark); border-radius:4px; min-height:80px;">
                        </div>
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Classification & Info</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Size</label>
                            <select id="cs-edit-size" class="vtt-input" style="width:100%;">
                                <option value="T" ${currSize === 'T' ? 'selected' : ''}>Tiny</option>
                                <option value="S" ${currSize === 'S' ? 'selected' : ''}>Small</option>
                                <option value="M" ${currSize === 'M' ? 'selected' : ''}>Medium</option>
                                <option value="L" ${currSize === 'L' ? 'selected' : ''}>Large</option>
                                <option value="H" ${currSize === 'H' ? 'selected' : ''}>Huge</option>
                                <option value="G" ${currSize === 'G' ? 'selected' : ''}>Gargantuan</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Creature Type</label>
                            <select id="cs-edit-type-select" class="vtt-input" style="width:100%;">
                                <option value="aberration" ${typeCategory === 'aberration' ? 'selected' : ''}>Aberration</option>
                                <option value="beast" ${typeCategory === 'beast' ? 'selected' : ''}>Beast</option>
                                <option value="celestial" ${typeCategory === 'celestial' ? 'selected' : ''}>Celestial</option>
                                <option value="construct" ${typeCategory === 'construct' ? 'selected' : ''}>Construct</option>
                                <option value="dragon" ${typeCategory === 'dragon' ? 'selected' : ''}>Dragon</option>
                                <option value="elemental" ${typeCategory === 'elemental' ? 'selected' : ''}>Elemental</option>
                                <option value="fey" ${typeCategory === 'fey' ? 'selected' : ''}>Fey</option>
                                <option value="fiend" ${typeCategory === 'fiend' ? 'selected' : ''}>Fiend</option>
                                <option value="giant" ${typeCategory === 'giant' ? 'selected' : ''}>Giant</option>
                                <option value="humanoid" ${typeCategory === 'humanoid' ? 'selected' : ''}>Humanoid</option>
                                <option value="monstrosity" ${typeCategory === 'monstrosity' ? 'selected' : ''}>Monstrosity</option>
                                <option value="ooze" ${typeCategory === 'ooze' ? 'selected' : ''}>Ooze</option>
                                <option value="plant" ${typeCategory === 'plant' ? 'selected' : ''}>Plant</option>
                                <option value="undead" ${typeCategory === 'undead' ? 'selected' : ''}>Undead</option>
                                <option value="custom" ${typeCategory === 'custom' ? 'selected' : ''}>Custom...</option>
                            </select>
                            <input type="text" id="cs-edit-type-custom" class="vtt-input" style="width:100%; margin-top:4px; display:${typeCategory === 'custom' ? 'block' : 'none'};" placeholder="e.g. Swarm of Insects" value="${customTypeValue}">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Subtype / Tags <span style="font-weight:normal; color:var(--color-text-muted);">(comma-separated)</span></label>
                            <input type="text" id="cs-edit-tags" class="vtt-input" style="width:100%;" value="${tagsStr}" placeholder="e.g. elf, shapechanger">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Alignment</label>
                            <select id="cs-edit-align-select" class="vtt-input" style="width:100%;">
                                <option value="LG" ${alignCategory === 'LG' ? 'selected' : ''}>Lawful Good</option>
                                <option value="NG" ${alignCategory === 'NG' ? 'selected' : ''}>Neutral Good</option>
                                <option value="CG" ${alignCategory === 'CG' ? 'selected' : ''}>Chaotic Good</option>
                                <option value="LN" ${alignCategory === 'LN' ? 'selected' : ''}>Lawful Neutral</option>
                                <option value="N" ${alignCategory === 'N' ? 'selected' : ''}>True Neutral</option>
                                <option value="CN" ${alignCategory === 'CN' ? 'selected' : ''}>Chaotic Neutral</option>
                                <option value="LE" ${alignCategory === 'LE' ? 'selected' : ''}>Lawful Evil</option>
                                <option value="NE" ${alignCategory === 'NE' ? 'selected' : ''}>Neutral Evil</option>
                                <option value="CE" ${alignCategory === 'CE' ? 'selected' : ''}>Chaotic Evil</option>
                                <option value="U" ${alignCategory === 'U' ? 'selected' : ''}>Unaligned</option>
                                <option value="A" ${alignCategory === 'A' ? 'selected' : ''}>Any Alignment</option>
                                <option value="custom" ${alignCategory === 'custom' ? 'selected' : ''}>Custom...</option>
                            </select>
                            <input type="text" id="cs-edit-align-custom" class="vtt-input" style="width:100%; margin-top:4px; display:${alignCategory === 'custom' ? 'block' : 'none'};" placeholder="e.g. Neutral Good (50%)" value="${customAlignValue}">
                        </div>
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Core Stats</h4>
                    <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:8px;">
                        ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => `
                            <div>
                                <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${ab}</label>
                                <input type="number" class="vtt-input cs-edit-stat" data-stat="${ab}" style="width:100%;" value="${m[ab] || 10}">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Combat</h4>
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">AC</label>
                            <input type="number" id="cs-edit-ac" class="vtt-input" style="width:100%;" value="${ac}">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">HP (Avg)</label>
                            <input type="number" id="cs-edit-hp-avg" class="vtt-input" style="width:100%;" value="${hpAvg}">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">HP Formula</label>
                            <input type="text" id="cs-edit-hp-form" class="vtt-input" style="width:100%;" value="${hpForm}" placeholder="e.g. 2d8+4">
                        </div>
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Speeds (ft.)</h4>
                    <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Walk</label>
                            <input type="number" id="cs-edit-speed-walk" class="vtt-input" style="width:100%;" value="${typeof m.speed === 'number' ? m.speed : (typeof m.speed?.walk === 'number' ? m.speed.walk : (parseInt(m.speed?.walk?.number ?? m.speed?.walk) ?? (m.speed?.walk === 0 ? 0 : 30)))}">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Fly</label>
                            <input type="number" id="cs-edit-speed-fly" class="vtt-input" style="width:100%;" value="${typeof m.speed?.fly === 'number' ? m.speed.fly : (parseInt(m.speed?.fly?.number ?? m.speed?.fly) || 0)}">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Swim</label>
                            <input type="number" id="cs-edit-speed-swim" class="vtt-input" style="width:100%;" value="${typeof m.speed?.swim === 'number' ? m.speed.swim : (parseInt(m.speed?.swim?.number ?? m.speed?.swim) || 0)}">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Climb</label>
                            <input type="number" id="cs-edit-speed-climb" class="vtt-input" style="width:100%;" value="${typeof m.speed?.climb === 'number' ? m.speed.climb : (parseInt(m.speed?.climb?.number ?? m.speed?.climb) || 0)}">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Burrow</label>
                            <input type="number" id="cs-edit-speed-burrow" class="vtt-input" style="width:100%;" value="${typeof m.speed?.burrow === 'number' ? m.speed.burrow : (parseInt(m.speed?.burrow?.number ?? m.speed?.burrow) || 0)}">
                        </div>
                    </div>
                    <div style="margin-top:6px;">
                        <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" id="cs-edit-speed-hover" ${!!(m.speed?.canHover || m.speed?.fly?.condition?.includes('hover')) ? 'checked' : ''}> Fly (hover)
                        </label>
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-secondary);">Defenses & Info</h4>
                        <button type="button" class="btn btn-secondary btn-xs" id="cs-btn-manage-defenses" style="display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-shield-halved"></i> Configure Defenses
                        </button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Immunities</label>
                            <input type="text" id="cs-edit-immune" class="vtt-input" style="width:100%;" value="${Array.isArray(m.immune) ? formatDamageList(m.immune) : m.immune || ''}" placeholder="e.g. fire, poison">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Resistances</label>
                            <input type="text" id="cs-edit-resist" class="vtt-input" style="width:100%;" value="${Array.isArray(m.resist) ? formatDamageList(m.resist) : m.resist || ''}" placeholder="e.g. bludgeoning">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Vulnerabilities</label>
                            <input type="text" id="cs-edit-vuln" class="vtt-input" style="width:100%;" value="${Array.isArray(m.vulnerable) ? formatDamageList(m.vulnerable) : m.vulnerable || ''}" placeholder="e.g. cold">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Condition Immunities</label>
                            <input type="text" id="cs-edit-cond" class="vtt-input" style="width:100%;" value="${Array.isArray(m.conditionImmune) ? formatDamageList(m.conditionImmune) : m.conditionImmune || ''}" placeholder="e.g. charmed">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Senses</label>
                            <input type="text" id="cs-edit-senses" class="vtt-input" style="width:100%;" value="${sensesValue.replace(/"/g, '&quot;')}" placeholder="e.g. darkvision 60 ft., passive Perception 15">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Languages</label>
                            <input type="text" id="cs-edit-lang" class="vtt-input" style="width:100%;" value="${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages || ''}" placeholder="e.g. Common, Draconic">
                        </div>
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Saving Throws (Modifiers)</h4>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                        ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => `
                            <div>
                                <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${ab}</label>
                                <input type="text" class="vtt-input cs-edit-save" data-ability="${ab}" style="width:100%;" value="${saves[ab] || ''}" placeholder="+0">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Traits</h4>
                    <div id="cs-edit-traits-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-trait">+ Add Trait</button>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Actions</h4>
                    <div id="cs-edit-actions-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-action">+ Add Action</button>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Bonus Actions</h4>
                    <div id="cs-edit-bonus-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-bonus">+ Add Bonus Action</button>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Reactions</h4>
                    <div id="cs-edit-reactions-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-reaction">+ Add Reaction</button>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Legendary Actions</h4>
                    <textarea id="cs-edit-legendary-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Legendary action description...">${typeof m.legendaryActions === 'object' && m.legendaryActions ? (m.legendaryActions.description || '') : (m.legendaryActions || '')}</textarea>
                    <div id="cs-edit-legendary-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-legendary">+ Add Legendary Action</button>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Lair Actions</h4>
                    <textarea id="cs-edit-lair-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Lair action description...">${m.lairHeader || m.lairActionsDesc || m.lairActions?.header || ''}</textarea>
                    <div id="cs-edit-lair-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-lair">+ Add Lair Action</button>
                </div>

                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-wand-magic-sparkles"></i> Spellcasting Sections</h4>
                        <button class="btn btn-xs btn-secondary" id="cs-edit-add-spellcasting-block"><i class="fa-solid fa-plus"></i> Add Block</button>
                    </div>
                    <div id="cs-edit-spellcasting-blocks-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                </div>
            </div>
        `;
        content.innerHTML = html;

        function calcDiceAverage(formula) {
            if (!formula) return 0;
            let avg = 0;
            const clean = formula.replace(/\s+/g, '');
            const tokens = clean.match(/([+-]?[0-9]*d[0-9]+)|([+-]?[0-9]+)/gi) || [];
            tokens.forEach(tok => {
                if (tok.toLowerCase().includes('d')) {
                    const sign = tok.startsWith('-') ? -1 : 1;
                    const stripped = tok.replace(/^[+-]/, '');
                    const parts = stripped.toLowerCase().split('d');
                    const count = parseInt(parts[0]) || 1;
                    const sides = parseInt(parts[1]) || 6;
                    avg += sign * Math.floor(count * (sides + 1) / 2);
                } else {
                    avg += parseInt(tok) || 0;
                }
            });
            return Math.max(0, avg);
        }

        function createAbilityRow(item = {}) {
            const row = document.createElement('div');
            row.className = 'cs-edit-ability-row';
            row.style.cssText = "display:flex; flex-direction:column; gap:6px; margin-bottom:10px; padding:10px; background:var(--color-bg-dark); border-radius:6px; border:1px solid var(--color-border);";

            function entryToPlainText(e) {
                if (!e) return '';
                if (typeof e === 'string') {
                    const trimmed = e.trim();
                    if (trimmed.startsWith('{"type":') || trimmed.startsWith('{"name":') || trimmed.startsWith('{"items":')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (parsed && typeof parsed === 'object') return entryToPlainText(parsed);
                        } catch (err) {}
                    }
                    return e;
                }
                if (Array.isArray(e)) {
                    return e.map(item => entryToPlainText(item)).join('\n');
                }
                if (e.type === 'list') {
                    return (e.items || []).map(item => {
                        if (typeof item === 'string') return `- ${item}`;
                        if (item && typeof item === 'object') {
                            const name = item.name ? `${item.name}: ` : '';
                            const text = item.entries ? (Array.isArray(item.entries) ? item.entries.map(x => entryToPlainText(x)).join(' ') : entryToPlainText(item.entries)) : (item.entry ? entryToPlainText(item.entry) : '');
                            return `- ${name}${text}`;
                        }
                        return `- ${item}`;
                    }).join('\n');
                }
                if (e.type === 'item' || e.type === 'itemSub') {
                    const name = e.name ? `${e.name}: ` : '';
                    const text = e.entries ? (Array.isArray(e.entries) ? e.entries.map(x => entryToPlainText(x)).join(' ') : entryToPlainText(e.entries)) : (e.entry ? entryToPlainText(e.entry) : '');
                    return `${name}${text}`;
                }
                if (e.entries) {
                    return (Array.isArray(e.entries) ? e.entries.map(x => entryToPlainText(x)).join('\n') : entryToPlainText(e.entries));
                }
                if (e.entry) return entryToPlainText(e.entry);
                return '';
            }

            let desc = '';
            if (item.entries && Array.isArray(item.entries)) {
                desc = item.entries.map(e => entryToPlainText(e)).filter(Boolean).join('\n');
            } else if (item.descriptionHtml) {
                desc = item.descriptionHtml;
            }

            let initAtk = '';
            let initDc = '';
            let initSaveAb = 'dex';
            let initDamages = [];

            if (item.macro) {
                if (item.macro.attackBonus !== undefined && item.macro.attackBonus !== null) {
                    const b = item.macro.attackBonus;
                    initAtk = b >= 0 ? `+${b}` : `${b}`;
                }
                if (item.macro.save && item.macro.save.dc !== undefined) {
                    initDc = `${item.macro.save.dc}`;
                    if (item.macro.save.ability) initSaveAb = item.macro.save.ability.toLowerCase();
                }
                if (item.macro.damages && Array.isArray(item.macro.damages)) {
                    initDamages = item.macro.damages.map(d => {
                        const rawType = (d.type || 'Slashing').trim();
                        const matched = STANDARD_DAMAGE_TYPES.find(dt => dt.toLowerCase() === rawType.toLowerCase()) || (rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase());
                        return { formula: d.formula || '', type: matched, saveRider: !!d.saveRider };
                    });
                }
            } else if (desc) {
                const atkMatch = desc.match(/(?:\{@hit\s+([+-]?\d+)\}|([+-]?\d+)\s+to\s+hit)/i);
                if (atkMatch) {
                    const val = parseInt(atkMatch[1] || atkMatch[2]);
                    if (!isNaN(val)) initAtk = val >= 0 ? `+${val}` : `${val}`;
                }
                const dcMatch = desc.match(/DC\s+(\d+)(?:\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i);
                if (dcMatch) {
                    initDc = dcMatch[1];
                    if (dcMatch[2]) {
                        initSaveAb = dcMatch[2].substring(0, 3).toLowerCase();
                    }
                }
                const saveBoundary = desc.search(/(?:saving\s+throw|save\s+DC|\{@actSave|\{@dc|\bDC\s*\d+|\bmust\s+(?:make|succeed)\b)/i);
                const dmgMatches = [...desc.matchAll(/(?:\{@damage\s+([^}]+)\}|(?:(?:(\d+)\s*\(([^)]+)\))|([1-9]\d*d\d+(?:\s*[+-]\s*\d+)?))\s*([a-zA-Z]+)?\s*damage)/gi)];
                dmgMatches.forEach(dm => {
                    const formula = (dm[1] || dm[3] || dm[4] || '').trim();
                    const rawType = (dm[5] || 'Slashing').trim();
                    const type = STANDARD_DAMAGE_TYPES.find(dt => dt.toLowerCase() === rawType.toLowerCase()) || 'Slashing';
                    const isRider = (saveBoundary !== -1 && dm.index >= saveBoundary);
                    if (formula) {
                        initDamages.push({ formula, type, saveRider: isRider });
                    }
                });
            }

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <input type="text" class="vtt-input edit-ab-name" value="${item.name || ''}" placeholder="Ability / Action Name" style="flex:1; font-weight:600;">
                    <button type="button" class="btn btn-xxs btn-danger edit-ab-del" title="Delete Ability"><i class="fa-solid fa-trash"></i></button>
                </div>
                <!-- Modular Modifier Bar -->
                <div class="edit-ab-modifier-bar" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px; font-size:0.8rem;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="color:var(--color-text-muted); font-size:0.75rem;">Atk Mod:</span>
                        <input type="text" class="vtt-input edit-ab-atk" value="${initAtk}" placeholder="+0" style="width:48px; text-align:center; padding:2px 4px; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="color:var(--color-text-muted); font-size:0.75rem;">Save DC:</span>
                        <input type="number" class="vtt-input edit-ab-dc" value="${initDc}" placeholder="DC" style="width:48px; text-align:center; padding:2px 4px; font-size:0.8rem;">
                        <select class="vtt-input edit-ab-save-ab" style="padding:2px 4px; font-size:0.8rem;">
                            ${['dex','con','wis','str','int','cha'].map(ab => `<option value="${ab}" ${initSaveAb === ab ? 'selected' : ''}>${ab.toUpperCase()}</option>`).join('')}
                        </select>
                    </div>
                    <div class="edit-ab-dmg-container" style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:200px;">
                        <div class="edit-ab-dmg-list" style="display:flex; flex-direction:column; gap:4px;"></div>
                        <button type="button" class="btn btn-xxs btn-secondary edit-ab-add-dmg" style="align-self:flex-start; font-size:0.75rem; padding:2px 6px;">
                            <i class="fa-solid fa-plus"></i> Add Dmg
                        </button>
                    </div>
                </div>
                <textarea class="vtt-input edit-ab-desc" style="width:100%; height:65px; resize:vertical; font-family:var(--font-body); font-size:0.85rem;" placeholder="Description (e.g. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage)...">${desc}</textarea>
            `;

            row.querySelector('.edit-ab-del').addEventListener('click', () => row.remove());

            const dmgList = row.querySelector('.edit-ab-dmg-list');
            const descArea = row.querySelector('.edit-ab-desc');
            const atkInput = row.querySelector('.edit-ab-atk');
            const dcInput = row.querySelector('.edit-ab-dc');
            const saveAbSelect = row.querySelector('.edit-ab-save-ab');

            const damageTypes = STANDARD_DAMAGE_TYPES;

            function createDmgRow(formula = '', type = 'Slashing', isRider = false) {
                const rawType = (type || 'Slashing').trim();
                const matchedType = damageTypes.find(t => t.toLowerCase() === rawType.toLowerCase()) || (rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase());
                const dRow = document.createElement('div');
                dRow.className = 'edit-ab-dmg-row';
                dRow.style.cssText = "display:flex; align-items:center; gap:4px;";
                dRow.innerHTML = `
                    <input type="text" class="vtt-input edit-ab-dmg-formula" value="${formula}" placeholder="e.g. 2d6 + 3" style="flex:1; min-width:70px; padding:2px 4px; font-size:0.8rem;">
                    <select class="vtt-input edit-ab-dmg-type" style="padding:2px 4px; font-size:0.8rem;">
                        ${damageTypes.map(t => `<option value="${t}" ${t.toLowerCase() === matchedType.toLowerCase() ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <label class="edit-ab-dmg-rider-label" style="display:flex; align-items:center; gap:3px; font-size:0.75rem; color:var(--color-text-muted); cursor:pointer; user-select:none; white-space:nowrap;" title="Check if this damage requires a saving throw (Save Rider)">
                        <input type="checkbox" class="edit-ab-dmg-rider" ${isRider ? 'checked' : ''} style="cursor:pointer; margin:0;">
                        <span>Rider</span>
                    </label>
                    <button type="button" class="btn btn-xxs btn-danger edit-ab-del-dmg" style="padding:2px 5px;"><i class="fa-solid fa-times"></i></button>
                `;
                dRow.querySelector('.edit-ab-del-dmg').addEventListener('click', () => {
                    dRow.remove();
                    syncDescFromInputs();
                });
                dRow.querySelector('.edit-ab-dmg-formula').addEventListener('input', () => syncDescFromInputs());
                dRow.querySelector('.edit-ab-dmg-type').addEventListener('change', () => syncDescFromInputs());
                dRow.querySelector('.edit-ab-dmg-rider').addEventListener('change', () => syncDescFromInputs());
                return dRow;
            }

            if (initDamages.length > 0) {
                initDamages.forEach(d => dmgList.appendChild(createDmgRow(d.formula, d.type, d.saveRider)));
            }

            row.querySelector('.edit-ab-add-dmg').addEventListener('click', () => {
                const hasDc = !!dcInput.value.trim();
                dmgList.appendChild(createDmgRow('1d6', 'Slashing', hasDc && dmgList.children.length > 0));
                syncDescFromInputs();
            });

            let isSyncing = false;

            // 1. Sync from Inputs -> Description Textarea
            function syncDescFromInputs() {
                if (isSyncing) return;
                isSyncing = true;
                try {
                    let text = descArea.value;

                    // Update Attack Mod
                    const atkVal = atkInput.value.trim();
                    if (atkVal) {
                        const parsedAtk = parseInt(atkVal.replace(/^\+/, ''));
                        if (!isNaN(parsedAtk)) {
                            const modStr = parsedAtk >= 0 ? `+${parsedAtk}` : `${parsedAtk}`;
                            if (/\{@hit\s+[+-]?\d+\}/i.test(text)) {
                                text = text.replace(/\{@hit\s+[+-]?\d+\}/gi, `{@hit ${parsedAtk}}`);
                            } else if (/\{@hitYourSpellAttack[^}]*\}/i.test(text)) {
                                text = text.replace(/\{@hitYourSpellAttack[^}]*\}/gi, `${modStr} to hit`);
                            } else if (/(?:your\s+spell\s+attack\s+modifier|[+-]?\d+)\s+to\s+hit/i.test(text)) {
                                text = text.replace(/(?:your\s+spell\s+attack\s+modifier|[+-]?\d+)\s+to\s+hit/gi, `${modStr} to hit`);
                            } else if (/\{@atk\s+[^}]+\}/i.test(text)) {
                                text = text.replace(/(\{@atk\s+[^}]+\}\s*)/i, `$1${modStr} to hit, `);
                            } else if (/(?:melee|ranged)\s+(?:weapon|spell)\s+attack:\s*/i.test(text)) {
                                text = text.replace(/((?:melee|ranged)\s+(?:weapon|spell)\s+attack:\s*)/i, `$1${modStr} to hit, `);
                            }
                        }
                    }

                    // Update Save DC & Ability
                    const dcVal = dcInput.value.trim();
                    const abVal = saveAbSelect.value.toUpperCase();
                    if (dcVal) {
                        const parsedDc = parseInt(dcVal);
                        if (!isNaN(parsedDc)) {
                            if (/DC\s+\d+(?:\s+(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i.test(text)) {
                                text = text.replace(/DC\s+\d+(?:\s+(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/gi, `DC ${parsedDc} ${abVal}`);
                            }
                        }
                    }

                    // Update Damages
                    const currentDmgRows = dmgList.querySelectorAll('.edit-ab-dmg-row');
                    if (currentDmgRows.length > 0) {
                        const hitParts = [];
                        const riderParts = [];
                        currentDmgRows.forEach(dr => {
                            const form = dr.querySelector('.edit-ab-dmg-formula').value.trim();
                            const rawTyp = dr.querySelector('.edit-ab-dmg-type').value.trim();
                            const isRider = dr.querySelector('.edit-ab-dmg-rider')?.checked || false;
                            const typ = damageTypes.find(t => t.toLowerCase() === rawTyp.toLowerCase()) || rawTyp;
                            if (form) {
                                const avg = calcDiceAverage(form);
                                if (isRider) riderParts.push({ form, typ, avg });
                                else hitParts.push({ form, typ, avg });
                            }
                        });

                        let formattedHit = '';
                        if (hitParts.length > 0) {
                            const primary = hitParts[0];
                            formattedHit = `${primary.avg} (${primary.form}) ${primary.typ.toLowerCase()} damage`;
                            if (hitParts.length > 1) {
                                const extra = hitParts.slice(1).map(p => `${p.avg} (${p.form}) ${p.typ.toLowerCase()} damage`).join(' plus ');
                                formattedHit += ` plus ${extra}`;
                            }
                        }

                        let formattedRider = '';
                        if (riderParts.length > 0) {
                            formattedRider = riderParts.map(p => `${p.avg} (${p.form}) ${p.typ.toLowerCase()} damage`).join(' plus ');
                        }

                        if (formattedHit) {
                            if (/\{@h\}[^.]*\.?/i.test(text)) {
                                text = text.replace(/\{@h\}[^.]*\.?/gi, `{@h}${formattedHit}.`);
                            } else if (/Hit:\s*[^.]*\.?/i.test(text)) {
                                text = text.replace(/Hit:\s*[^.]*\.?/gi, `Hit: ${formattedHit}.`);
                            }
                        }

                        if (formattedRider && dcVal) {
                            if (/taking\s+[^.]+\s+damage\s+on\s+a\s+failed\s+save/i.test(text)) {
                                text = text.replace(/taking\s+[^.]+\s+damage\s+on\s+a\s+failed\s+save/gi, `taking ${formattedRider} on a failed save`);
                            }
                        }
                    }

                    descArea.value = text;
                } finally {
                    isSyncing = false;
                }
            }

            // 2. Sync from Description Textarea -> Inputs
            function syncInputsFromDesc() {
                if (isSyncing) return;
                isSyncing = true;
                try {
                    const text = descArea.value;

                    // Parse Attack Mod
                    const atkMatch = text.match(/(?:\{@hit\s+([+-]?\d+)\}|([+-]?\d+)\s+to\s+hit)/i);
                    if (atkMatch) {
                        const val = parseInt(atkMatch[1] || atkMatch[2]);
                        if (!isNaN(val)) {
                            atkInput.value = val >= 0 ? `+${val}` : `${val}`;
                        }
                    }

                    // Parse Save DC & Ability
                    const dcMatch = text.match(/DC\s+(\d+)(?:\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i);
                    if (dcMatch) {
                        dcInput.value = dcMatch[1];
                        if (dcMatch[2]) {
                            const parsedAb = dcMatch[2].substring(0, 3).toLowerCase();
                            saveAbSelect.value = parsedAb;
                        }
                    }

                    // Parse Damages
                    const parsedDamages = [];
                    const saveBoundary = text.search(/(?:saving\s+throw|save\s+DC|\{@actSave|\{@dc|\bDC\s*\d+|\bmust\s+(?:make|succeed)\b)/i);
                    const dmgMatches = [...text.matchAll(/(?:\{@damage\s+([^}]+)\}|(?:(?:(\d+)\s*\(([^)]+)\))|([1-9]\d*d\d+(?:\s*[+-]\s*[^,.]+)?))\s*([a-zA-Z]+)?\s*damage)/gi)];
                    dmgMatches.forEach(dm => {
                        const formula = (dm[1] || dm[3] || dm[4] || '').trim();
                        let rawType = (dm[5] || 'Slashing').trim();
                        let type = damageTypes.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Slashing';
                        const isRider = (saveBoundary !== -1 && dm.index >= saveBoundary);
                        if (formula && !parsedDamages.some(pd => pd.formula === formula && pd.saveRider === isRider)) {
                            parsedDamages.push({ formula, type, saveRider: isRider });
                        }
                    });

                    if (parsedDamages.length > 0) {
                        dmgList.innerHTML = '';
                        parsedDamages.forEach(d => {
                            dmgList.appendChild(createDmgRow(d.formula, d.type, d.saveRider));
                        });
                    }
                } finally {
                    isSyncing = false;
                }
            }

            atkInput.addEventListener('input', syncDescFromInputs);
            dcInput.addEventListener('input', syncDescFromInputs);
            saveAbSelect.addEventListener('change', syncDescFromInputs);
            descArea.addEventListener('input', syncInputsFromDesc);

            return row;
        }

        // Populate lists
        function renderAbilityList(containerId, dataArray) {
            const container = content.querySelector('#' + containerId);
            if (!container) return;
            container.innerHTML = '';
            if (dataArray && Array.isArray(dataArray)) {
                dataArray.forEach(item => {
                    container.appendChild(createAbilityRow(item));
                });
            }
        }

        renderAbilityList('cs-edit-traits-list', m.traits || m.trait);
        renderAbilityList('cs-edit-actions-list', m.actions || m.action);
        renderAbilityList('cs-edit-bonus-list', m.bonusActions || m.bonus);
        renderAbilityList('cs-edit-reactions-list', m.reactions || m.reaction);
        renderAbilityList('cs-edit-legendary-list', Array.isArray(m.legendaryActions) ? m.legendaryActions : (m.legendaryActions?.entries || m.legendary));
        renderAbilityList('cs-edit-lair-list', Array.isArray(m.lairActions) ? m.lairActions : (Array.isArray(m.lairActions?.entries) ? m.lairActions.entries : []));

        // Render Spellcasting Blocks in Modal
        function renderModalSpellcastingBlocks() {
            const container = content.querySelector('#cs-edit-spellcasting-blocks-list');
            container.innerHTML = '';
            const blocks = m.spellcasting && Array.isArray(m.spellcasting) ? m.spellcasting : [];
            blocks.forEach((sc, idx) => {
                const card = document.createElement('div');
                card.className = 'cs-edit-sc-card';
                card.style.cssText = "display:flex; flex-direction:column; gap:6px; padding:10px; background:var(--color-bg-dark); border-radius:6px; border:1px solid rgba(212,175,55,0.3); margin-bottom:8px;";
                
                const currentType = resolveSpellcastingType(sc, m);
                const rechargeRule = sc.rechargeRule || (currentType === 'pact' ? 'short_rest' : 'long_rest');
                const abVal = (sc.ability || 'int').toLowerCase();
                const casterLvl = sc.casterLevel !== undefined ? sc.casterLevel : (m.casterLevel || 0);

                // Collect existing innate sections (0 = At Will, N = N/day)
                const initialSections = [];
                if (currentType === 'innate') {
                    if (sc.will || sc.atWill || sc.innateObj?.will) {
                        initialSections.push(0);
                    }
                    const dailyObj = sc.daily || sc.innateObj?.daily || {};
                    for (const k in dailyObj) {
                        const num = parseInt(k);
                        if (!isNaN(num) && !initialSections.includes(num)) {
                            initialSections.push(num);
                        }
                    }
                    initialSections.sort((a, b) => a - b);
                    if (initialSections.length === 0) initialSections.push(0);
                }

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <input type="text" class="vtt-input sc-edit-name" value="${sc.name || (currentType === 'innate' ? 'Innate Spellcasting' : 'Spellcasting')}" placeholder="Block Name (e.g. Innate Spellcasting, Fey Heritage)" style="flex:1; font-weight:600; color:var(--color-gold-base);">
                        <button class="btn btn-xxs btn-danger sc-edit-del" title="Delete Block"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Block Type</label>
                            <select class="vtt-input sc-edit-type" style="width:100%;">
                                <option value="innate" ${currentType === 'innate' ? 'selected' : ''}>Innate / Usage-Based</option>
                                <option value="slot" ${currentType === 'slot' ? 'selected' : ''}>Class / Slot-Based</option>
                                <option value="pact" ${currentType === 'pact' ? 'selected' : ''}>Pact Magic</option>
                                <option value="custom" ${currentType === 'custom' ? 'selected' : ''}>Custom</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Default Rest Rule</label>
                            <select class="vtt-input sc-edit-recharge" style="width:100%;">
                                <option value="long_rest" ${rechargeRule === 'long_rest' ? 'selected' : ''}>Long Rest (Daily)</option>
                                <option value="short_rest" ${rechargeRule === 'short_rest' ? 'selected' : ''}>Short Rest</option>
                                <option value="short_long" ${rechargeRule === 'short_long' ? 'selected' : ''}>Short/Long Rest</option>
                                <option value="at_will" ${rechargeRule === 'at_will' ? 'selected' : ''}>At Will</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Ability</label>
                            <select class="vtt-input sc-edit-ability" style="width:100%;">
                                ${['int','wis','cha','str','dex','con'].map(ab => `<option value="${ab}" ${abVal === ab ? 'selected' : ''}>${ab.toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Save DC</label>
                            <input type="number" class="vtt-input sc-edit-dc" value="${sc.dc !== undefined ? sc.dc : ''}" placeholder="Auto" style="width:100%;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Atk Bonus</label>
                            <input type="number" class="vtt-input sc-edit-atk" value="${sc.atkMod !== undefined ? sc.atkMod : ''}" placeholder="Auto" style="width:100%;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Caster Lvl</label>
                            <input type="number" class="vtt-input sc-edit-caster-level" value="${casterLvl}" placeholder="0" min="0" max="20" style="width:100%;">
                        </div>
                    </div>

                    <!-- Slot Preview / Calculation Area for Slot & Pact Blocks -->
                    <div class="sc-edit-slot-info-box" style="display:${(currentType === 'slot' || currentType === 'pact') ? 'block' : 'none'}; padding:6px 8px; background:rgba(0,0,0,0.25); border-radius:4px; border:1px solid rgba(255,255,255,0.08); font-size:0.78rem;">
                        <span style="color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-calculator" style="margin-right:4px;"></i>Spell Slots (Calculated from Caster Level):</span>
                        <div class="sc-edit-slot-preview-text" style="color:var(--color-text-secondary); margin-top:2px;"></div>
                    </div>

                    <!-- Innate Usage Sections Customization for Innate Blocks -->
                    <div class="sc-edit-innate-sections-box" style="display:${currentType === 'innate' ? 'block' : 'none'}; padding:8px; background:rgba(0,0,0,0.25); border-radius:4px; border:1px solid rgba(30,144,255,0.25);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:0.8rem; font-weight:600; color:#87cefa;"><i class="fa-solid fa-sparkles" style="margin-right:4px;"></i>Innate Usage Sections</span>
                            <button type="button" class="btn btn-xxs btn-secondary sc-edit-add-section-btn" style="border:1px solid rgba(30,144,255,0.4);"><i class="fa-solid fa-plus"></i> Add Section</button>
                        </div>
                        <div class="sc-edit-sections-list" style="display:flex; flex-direction:column; gap:4px;"></div>
                        <div style="font-size:0.72rem; color:var(--color-text-muted); margin-top:4px; font-style:italic;">
                            * 0 = At Will (default), 1–9 = Daily Usages (e.g. 1/Day, 3/Day). Spells are added and customized on the Spells tab.
                        </div>
                    </div>

                    <div style="margin-top:4px;">
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Description / Header Notes</label>
                        <textarea class="vtt-input sc-edit-desc" style="width:100%; height:40px; font-size:0.8rem;" placeholder="e.g. The creature is a 5th-level spellcaster...">${sc.headerEntries ? sc.headerEntries.join('\n') : ''}</textarea>
                    </div>
                `;

                const typeSelect = card.querySelector('.sc-edit-type');
                const casterLvlInput = card.querySelector('.sc-edit-caster-level');
                const slotInfoBox = card.querySelector('.sc-edit-slot-info-box');
                const slotPreviewText = card.querySelector('.sc-edit-slot-preview-text');
                const innateBox = card.querySelector('.sc-edit-innate-sections-box');
                const sectionsList = card.querySelector('.sc-edit-sections-list');
                const addSectionBtn = card.querySelector('.sc-edit-add-section-btn');

                function updateSlotPreview() {
                    const t = typeSelect.value;
                    const cl = parseInt(casterLvlInput.value) || 0;
                    if (t === 'slot' || t === 'pact') {
                        slotInfoBox.style.display = 'block';
                        const slots = get5eSlotsForCaster(t, cl);
                        const entries = Object.keys(slots);
                        if (entries.length === 0) {
                            slotPreviewText.textContent = cl > 0 ? "No spell slots at this level." : "Set Caster Level > 0 to auto-calculate spell slots.";
                        } else if (t === 'pact') {
                            const pactSlotKey = entries[0];
                            const pactLvlNum = pactSlotKey.replace('level', '');
                            const count = slots[pactSlotKey];
                            slotPreviewText.textContent = `${count} × Level ${pactLvlNum} spell slot${count > 1 ? 's' : ''} (Short Rest)`;
                        } else {
                            const parts = entries.map(k => {
                                const num = k.replace('level', '');
                                const suffix = num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th';
                                return `${num}${suffix}: ${slots[k]}`;
                            });
                            slotPreviewText.textContent = parts.join(' | ');
                        }
                    } else {
                        slotInfoBox.style.display = 'none';
                    }
                }

                function addSectionRow(usages = 0) {
                    const row = document.createElement('div');
                    row.className = 'sc-edit-section-row';
                    row.style.cssText = "display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);";
                    
                    const isAtWill = parseInt(usages) === 0;
                    row.innerHTML = `
                        <span style="font-size:0.75rem; color:var(--color-text-muted); width:70px;">Usage Count:</span>
                        <div style="display:flex; align-items:center; gap:6px; flex:1;">
                            <input type="number" class="vtt-input sc-edit-section-counter" value="${usages}" min="0" max="9" style="width:52px; text-align:center; padding:2px 4px; font-weight:bold;">
                            <span class="sc-edit-section-label" style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;">${isAtWill ? 'At Will (0)' : `${usages}/Day`}</span>
                        </div>
                        <button type="button" class="btn btn-xxs btn-danger sc-edit-section-del" title="Remove Section"><i class="fa-solid fa-trash"></i></button>
                    `;
                    
                    const counterInput = row.querySelector('.sc-edit-section-counter');
                    const labelSpan = row.querySelector('.sc-edit-section-label');
                    counterInput.addEventListener('input', () => {
                        const val = parseInt(counterInput.value) || 0;
                        labelSpan.textContent = val === 0 ? 'At Will (0)' : `${val}/Day`;
                    });

                    row.querySelector('.sc-edit-section-del').addEventListener('click', () => row.remove());
                    sectionsList.appendChild(row);
                }

                // Populate initial sections for innate blocks
                if (currentType === 'innate') {
                    initialSections.forEach(u => addSectionRow(u));
                }

                addSectionBtn.addEventListener('click', () => {
                    const currentRows = sectionsList.querySelectorAll('.sc-edit-section-counter');
                    const existingUsages = Array.from(currentRows).map(inp => parseInt(inp.value) || 0);
                    if (!existingUsages.includes(0)) {
                        addSectionRow(0); // 0 = At Will (default when creating a new block)
                    } else {
                        let next = 1;
                        while (existingUsages.includes(next) && next < 10) next++;
                        addSectionRow(next);
                    }
                });

                typeSelect.addEventListener('change', () => {
                    const isNowInnate = typeSelect.value === 'innate';
                    innateBox.style.display = isNowInnate ? 'block' : 'none';
                    if (isNowInnate && sectionsList.children.length === 0) {
                        addSectionRow(0); // 0 = At Will by default
                    }
                    updateSlotPreview();
                });

                casterLvlInput.addEventListener('input', updateSlotPreview);
                updateSlotPreview();

                card.querySelector('.sc-edit-del').addEventListener('click', () => card.remove());
                container.appendChild(card);
            });
        }
        renderModalSpellcastingBlocks();

        content.querySelector('#cs-edit-add-spellcasting-block').addEventListener('click', () => {
            m.spellcasting = m.spellcasting || [];
            m.spellcasting.push({ name: 'Innate Spellcasting', type: 'innate', ability: 'cha', casterLevel: 0, headerEntries: [], will: [] });
            renderModalSpellcastingBlocks();
        });

        // Add buttons
        function wireAddBtn(btnId, containerId) {
            content.querySelector('#' + btnId).addEventListener('click', () => {
                const row = createAbilityRow({});
                content.querySelector('#' + containerId).appendChild(row);
            });
        }
        wireAddBtn('cs-edit-add-trait', 'cs-edit-traits-list');
        wireAddBtn('cs-edit-add-action', 'cs-edit-actions-list');
        wireAddBtn('cs-edit-add-bonus', 'cs-edit-bonus-list');
        wireAddBtn('cs-edit-add-reaction', 'cs-edit-reactions-list');
        wireAddBtn('cs-edit-add-legendary', 'cs-edit-legendary-list');
        wireAddBtn('cs-edit-add-lair', 'cs-edit-lair-list');

        // Render Token Gallery
        function renderCompanionTokenGallery() {
            const gal = content.querySelector('#cs-edit-token-gallery');
            gal.innerHTML = '';
            if (char.tokenImages.length === 0) {
                gal.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No custom tokens.</span>';
                return;
            }
            char.tokenImages.forEach((imgObj, idx) => {
                const isActive = char.activeTokenIndex === idx;
                const url = imgObj.url || '';
                const cleanUrl = url.split('?')[0].toLowerCase();
                const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
                
                const wrapper = document.createElement('div');
                wrapper.style.cssText = `position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${isActive ? 'var(--color-success-base)' : 'transparent'}; cursor:pointer;`;
                
                const safeUrl = typeof window.getSafeVttUrl === 'function' ? window.getSafeVttUrl(url) : ((url && (url.includes('discordapp.com') || url.includes('discordapp.net'))) ? ('/api/proxy-discord?url=' + encodeURIComponent(url)) : url);
                let mediaEl;
                if (isVideo) {
                    mediaEl = document.createElement('video');
                    mediaEl.src = safeUrl;
                    mediaEl.muted = true;
                    mediaEl.loop = true;
                    mediaEl.autoplay = true;
                    mediaEl.playsInline = true;
                    mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
                } else {
                    mediaEl = document.createElement('img');
                    mediaEl.src = safeUrl;
                    mediaEl.title = imgObj.name || 'Token';
                    mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
                }
                wrapper.appendChild(mediaEl);

                if (isActive) {
                    const badge = document.createElement('div');
                    badge.style.cssText = 'position:absolute; top:2px; right:2px; background:var(--color-success-base); color:#fff; border-radius:50%; width:16px; height:16px; font-size:0.6rem; display:flex; align-items:center; justify-content:center;';
                    badge.innerHTML = '<i class="fa-solid fa-check"></i>';
                    wrapper.appendChild(badge);
                }

                const delBtn = document.createElement('button');
                delBtn.className = 'btn btn-danger btn-xxs';
                delBtn.style.cssText = 'position:absolute; bottom:2px; right:2px; padding:2px 4px;';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                wrapper.appendChild(delBtn);

                wrapper.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    if (char.activeTokenIndex === idx) {
                        char.activeTokenIndex = -1;
                    } else {
                        char.activeTokenIndex = idx;
                    }
                    renderCompanionTokenGallery();
                });
                
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const deletedToken = char.tokenImages[idx];
                    if (deletedToken?.isDefault || (defaultTokenUrl && (typeof deletedToken === 'string' ? deletedToken : deletedToken?.url) === defaultTokenUrl)) {
                        char.defaultTokenDeleted = true;
                    }
                    char.tokenImages.splice(idx, 1);
                    if (char.activeTokenIndex >= char.tokenImages.length) {
                        char.activeTokenIndex = Math.max(0, char.tokenImages.length - 1);
                    } else if (char.activeTokenIndex > idx) {
                        char.activeTokenIndex--;
                    }
                    renderCompanionTokenGallery();
                });
                
                gal.appendChild(wrapper);
                if (isVideo) mediaEl.play().catch(()=>{});
            });
        }
        renderCompanionTokenGallery();

        // Add URL wiring
        content.querySelector('#cs-edit-token-add-btn').addEventListener('click', () => {
            const urlInput = content.querySelector('#cs-edit-token-add-url');
            const rawUrl = urlInput.value.trim();
            if (rawUrl) {
                char.tokenImages.push({ url: rawUrl, name: 'URL Media' });
                char.activeTokenIndex = char.tokenImages.length - 1;
                urlInput.value = '';
                renderCompanionTokenGallery();
            }
        });

        // File Upload wiring
        const fileInput = content.querySelector('#cs-edit-token-file');
        const uploadBtn = content.querySelector('#cs-edit-token-upload-btn');
        
        uploadBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            
            const origHtml = uploadBtn.innerHTML;
            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            uploadBtn.disabled = true;

            try {
                const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    char.tokenImages.push({ url: data.url, name: file.name });
                    char.activeTokenIndex = char.tokenImages.length - 1;
                    renderCompanionTokenGallery();
                } else {
                    alert("Upload failed.");
                }
            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                uploadBtn.innerHTML = origHtml;
                uploadBtn.disabled = false;
                e.target.value = '';
            }
        });

        // Wiring Custom Type and Custom Alignment Toggles
        const typeSelect = content.querySelector('#cs-edit-type-select');
        const typeCustomInput = content.querySelector('#cs-edit-type-custom');
        typeSelect.addEventListener('change', () => {
            typeCustomInput.style.display = typeSelect.value === 'custom' ? 'block' : 'none';
        });

        const alignSelect = content.querySelector('#cs-edit-align-select');
        const alignCustomInput = content.querySelector('#cs-edit-align-custom');
        alignSelect.addEventListener('change', () => {
            alignCustomInput.style.display = alignSelect.value === 'custom' ? 'block' : 'none';
        });

        // Wiring Save/Cancel & backdrop dismissal with dirty tracking
        const getSnapshot = () => JSON.stringify(Array.from(content.querySelectorAll('input, select, textarea')).map(el => el.type === 'checkbox' ? el.checked : el.value));
        const initialSnapshot = getSnapshot();

        const closeEditModal = (force = false) => {
            if (!force && getSnapshot() !== initialSnapshot) {
                if (!confirm('Discard unsaved changes?')) return;
            }
            window.removeEventListener('keydown', onEsc);
            overlay.remove();
        };

        const onEsc = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                closeEditModal(false);
            }
        };
        window.addEventListener('keydown', onEsc);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeEditModal(false);
            }
        });

        const manageDefensesBtn = content.querySelector('#cs-btn-manage-defenses');
        if (manageDefensesBtn) {
            manageDefensesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openCreatureDefenseConfigModal(currentEditDefenses, (updated) => {
                    currentEditDefenses = updated;
                    const resInput = content.querySelector('#cs-edit-resist');
                    if (resInput) resInput.value = formatDamageList(editableRowsToDefenses(currentEditDefenses.resist));
                    const immInput = content.querySelector('#cs-edit-immune');
                    if (immInput) immInput.value = formatDamageList(editableRowsToDefenses(currentEditDefenses.immune));
                    const vulInput = content.querySelector('#cs-edit-vuln');
                    if (vulInput) vulInput.value = formatDamageList(editableRowsToDefenses(currentEditDefenses.vulnerable));
                });
            });
        }

        overlay.querySelector('#cs-edit-cancel-btn').onclick = () => closeEditModal(false);
        overlay.querySelector('#cs-edit-save-btn').onclick = () => {
            window.removeEventListener('keydown', onEsc);
            saveCompanionEdits(m);
        };
    }

    function saveCompanionEdits(m) {
        if (!currentEditCharId) return;
        const char = window.VTT.campaignState.characters[currentEditCharId];
        if (!char) return;
        
        const overlay = document.getElementById('cs-edit-modal-overlay');
        const content = document.getElementById('cs-edit-modal-content');
        if (!content) return;

        // Extract basic info
        const newName = content.querySelector('#cs-edit-name').value.trim();
        const newAc = parseInt(content.querySelector('#cs-edit-ac').value) || 10;
        const newHpAvg = parseInt(content.querySelector('#cs-edit-hp-avg').value) || 0;
        const newHpForm = content.querySelector('#cs-edit-hp-form').value.trim();

        char.name = newName;
        m.name = newName;

        // Classification & Info
        const newSize = content.querySelector('#cs-edit-size').value;
        m.size = [newSize];

        const typeSel = content.querySelector('#cs-edit-type-select').value;
        const typeCustom = content.querySelector('#cs-edit-type-custom').value.trim();
        const tagsRaw = content.querySelector('#cs-edit-tags').value.trim();
        
        let finalTypeStr = typeSel === 'custom' ? (typeCustom || 'humanoid') : typeSel;
        let tagsArr = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        if (tagsArr.length > 0) {
            m.type = { type: finalTypeStr, tags: tagsArr };
        } else {
            m.type = finalTypeStr;
        }

        const alignSel = content.querySelector('#cs-edit-align-select').value;
        const alignCustom = content.querySelector('#cs-edit-align-custom').value.trim();
        if (alignSel === 'custom') {
            m.alignment = alignCustom ? [alignCustom] : ['U'];
        } else if (alignSel === 'LG') m.alignment = ['L', 'G'];
        else if (alignSel === 'NG') m.alignment = ['N', 'G'];
        else if (alignSel === 'CG') m.alignment = ['C', 'G'];
        else if (alignSel === 'LN') m.alignment = ['L', 'N'];
        else if (alignSel === 'N') m.alignment = ['N'];
        else if (alignSel === 'CN') m.alignment = ['C', 'N'];
        else if (alignSel === 'LE') m.alignment = ['L', 'E'];
        else if (alignSel === 'NE') m.alignment = ['N', 'E'];
        else if (alignSel === 'CE') m.alignment = ['C', 'E'];
        else if (alignSel === 'U') m.alignment = ['U'];
        else if (alignSel === 'A') m.alignment = ['A'];
        // tokenImages and activeTokenIndex are already directly modified on 'char' via the gallery UI.

        char.ac = newAc;
        char.primaryAc = newAc;
        m.primaryAc = newAc;
        if (Array.isArray(m.ac)) {
            if (typeof m.ac[0] === 'object' && m.ac[0] !== null) {
                m.ac[0].value = newAc;
                m.ac[0].ac = newAc;
            } else {
                m.ac = [{ value: newAc, ac: newAc }];
            }
        } else if (typeof m.ac === 'object' && m.ac !== null) {
            m.ac.value = newAc;
            m.ac.ac = newAc;
        } else {
            m.ac = [{ value: newAc, ac: newAc }];
        }

        m.hp = m.hp || {};
        m.hp.average = newHpAvg;
        m.hp.formula = newHpForm;
        
        // Auto-scale current HP if max changed
        if (char.hpMax !== newHpAvg) {
            if (char.hpMax > 0) {
                const ratio = char.hpCurrent / char.hpMax;
                char.hpCurrent = Math.max(1, Math.floor(newHpAvg * ratio));
            } else {
                char.hpCurrent = newHpAvg;
            }
            char.hpMax = newHpAvg;
        }

        // Core Stats
        content.querySelectorAll('.cs-edit-stat').forEach(input => {
            const stat = input.dataset.stat;
            m[stat] = parseInt(input.value) || 10;
        });

        // Speeds
        const walkInput = content.querySelector('#cs-edit-speed-walk');
        const flyInput = content.querySelector('#cs-edit-speed-fly');
        const swimInput = content.querySelector('#cs-edit-speed-swim');
        const climbInput = content.querySelector('#cs-edit-speed-climb');
        const burrowInput = content.querySelector('#cs-edit-speed-burrow');
        const hoverInput = content.querySelector('#cs-edit-speed-hover');

        if (walkInput || flyInput || swimInput || climbInput || burrowInput) {
            const walkVal = walkInput ? parseInt(walkInput.value) : 30;
            const flyVal = flyInput ? parseInt(flyInput.value) : 0;
            const swimVal = swimInput ? parseInt(swimInput.value) : 0;
            const climbVal = climbInput ? parseInt(climbInput.value) : 0;
            const burrowVal = burrowInput ? parseInt(burrowInput.value) : 0;
            const canHover = hoverInput ? hoverInput.checked : false;

            const newSpeed = {
                walk: isNaN(walkVal) ? 30 : walkVal
            };
            if (!isNaN(flyVal) && flyVal > 0) newSpeed.fly = flyVal;
            if (!isNaN(swimVal) && swimVal > 0) newSpeed.swim = swimVal;
            if (!isNaN(climbVal) && climbVal > 0) newSpeed.climb = climbVal;
            if (!isNaN(burrowVal) && burrowVal > 0) newSpeed.burrow = burrowVal;
            if (canHover) newSpeed.canHover = true;

            m.speed = newSpeed;
            char.speed = newSpeed;
        }

        // Defenses & Info
        if (currentEditDefenses) {
            const immuneStr = content.querySelector('#cs-edit-immune').value.trim();
            const compiledImm = editableRowsToDefenses(currentEditDefenses.immune);
            if (immuneStr === '') {
                delete m.immune;
            } else if (immuneStr === formatDamageList(compiledImm)) {
                m.immune = compiledImm.length > 0 ? compiledImm : undefined;
                if (!m.immune) delete m.immune;
            } else {
                m.immune = parseDefenseTextInput(immuneStr, compiledImm);
                if (!m.immune || m.immune.length === 0) delete m.immune;
            }

            const resistStr = content.querySelector('#cs-edit-resist').value.trim();
            const compiledRes = editableRowsToDefenses(currentEditDefenses.resist);
            if (resistStr === '') {
                delete m.resist;
            } else if (resistStr === formatDamageList(compiledRes)) {
                m.resist = compiledRes.length > 0 ? compiledRes : undefined;
                if (!m.resist) delete m.resist;
            } else {
                m.resist = parseDefenseTextInput(resistStr, compiledRes);
                if (!m.resist || m.resist.length === 0) delete m.resist;
            }

            const vulnStr = content.querySelector('#cs-edit-vuln').value.trim();
            const compiledVuln = editableRowsToDefenses(currentEditDefenses.vulnerable);
            if (vulnStr === '') {
                delete m.vulnerable;
            } else if (vulnStr === formatDamageList(compiledVuln)) {
                m.vulnerable = compiledVuln.length > 0 ? compiledVuln : undefined;
                if (!m.vulnerable) delete m.vulnerable;
            } else {
                m.vulnerable = parseDefenseTextInput(vulnStr, compiledVuln);
                if (!m.vulnerable || m.vulnerable.length === 0) delete m.vulnerable;
            }
        }

        const condStr = content.querySelector('#cs-edit-cond').value.trim();
        if (condStr) m.conditionImmune = condStr.split(',').map(s => s.trim()); else delete m.conditionImmune;

        const sensesStr = content.querySelector('#cs-edit-senses').value.trim();
        if (sensesStr) {
            m.senses = sensesStr.split(',').map(s => s.trim());
            
            // Sync with token vision
            let maxSight = 0;
            if (window.parseMonsterVision) {
                maxSight = window.parseMonsterVision({ senses: m.senses });
            } else {
                const sightMatches = sensesStr.match(/(?:darkvision|blindsight|truesight|tremorsense|devil(?:'s)?\s*sight)\s*(\d+)/ig);
                if (sightMatches) {
                    sightMatches.forEach(sm => {
                        const num = parseInt(sm.match(/\d+/)?.[0] || 0);
                        if (num > maxSight) maxSight = num;
                    });
                }
            }
            char.tokenSight = maxSight > 0 ? maxSight : 5;
        } else {
            delete m.senses;
            char.tokenSight = 5;
        }

        const langStr = content.querySelector('#cs-edit-lang').value.trim();
        if (langStr) m.languages = langStr.split(',').map(s => s.trim()); else delete m.languages;

        // Saves
        const newSaves = {};
        content.querySelectorAll('.cs-edit-save').forEach(input => {
            const val = input.value.trim();
            if (val) {
                newSaves[input.dataset.ability] = val;
            }
        });
        if (Object.keys(newSaves).length > 0) {
            m.save = newSaves;
        } else {
            delete m.save;
        }

        function extractAbilityList(containerId) {
            const rows = content.querySelectorAll('#' + containerId + ' > div');
            const arr = [];
            rows.forEach(r => {
                const name = r.querySelector('.edit-ab-name')?.value.trim() || '';
                const desc = r.querySelector('.edit-ab-desc')?.value.trim() || '';
                const atkRaw = r.querySelector('.edit-ab-atk')?.value.trim() || '';
                const dcRaw = r.querySelector('.edit-ab-dc')?.value.trim() || '';
                const saveAb = r.querySelector('.edit-ab-save-ab')?.value.trim() || 'dex';

                const dmgRows = r.querySelectorAll('.edit-ab-dmg-row');
                const damages = [];
                dmgRows.forEach(dr => {
                    const formula = dr.querySelector('.edit-ab-dmg-formula')?.value.trim();
                    const rawType = dr.querySelector('.edit-ab-dmg-type')?.value.trim() || 'Slashing';
                    const isRider = dr.querySelector('.edit-ab-dmg-rider')?.checked || false;
                    const type = STANDARD_DAMAGE_TYPES.find(dt => dt.toLowerCase() === rawType.toLowerCase()) || (rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase());
                    if (formula) {
                        damages.push({ formula, type, saveRider: isRider });
                    }
                });

                if (name || desc || atkRaw || dcRaw || damages.length > 0) {
                    const abilityItem = {
                        name: name,
                        entries: desc ? desc.split('\n') : []
                    };

                    const macro = {};
                    let hasMacro = false;

                    const atkNum = atkRaw !== '' ? parseInt(atkRaw.replace(/^\+/, '')) : NaN;
                    if (!isNaN(atkNum)) {
                        macro.isAttack = true;
                        macro.attackBonus = atkNum;
                        hasMacro = true;
                    }

                    const dcNum = dcRaw !== '' ? parseInt(dcRaw) : NaN;
                    if (!isNaN(dcNum)) {
                        macro.save = {
                            dc: dcNum,
                            ability: saveAb.toLowerCase()
                        };
                        hasMacro = true;
                    }

                    if (damages.length > 0) {
                        macro.damages = damages;
                        hasMacro = true;
                    }

                    if (hasMacro) {
                        abilityItem.macro = macro;
                    }

                    arr.push(abilityItem);
                }
            });
            return arr.length > 0 ? arr : undefined;
        }

        const newTraits = extractAbilityList('cs-edit-traits-list');
        if (newTraits) m.traits = newTraits; else delete m.traits;
        delete m.trait;

        const newActions = extractAbilityList('cs-edit-actions-list');
        if (newActions) m.actions = newActions; else delete m.actions;
        delete m.action;

        const newBonus = extractAbilityList('cs-edit-bonus-list');
        if (newBonus) m.bonusActions = newBonus; else delete m.bonusActions;
        delete m.bonus;

        const newReactions = extractAbilityList('cs-edit-reactions-list');
        if (newReactions) m.reactions = newReactions; else delete m.reactions;
        delete m.reaction;

        const legDesc = content.querySelector('#cs-edit-legendary-desc').value.trim();
        const newLegendary = extractAbilityList('cs-edit-legendary-list');
        if (newLegendary || legDesc) {
            m.legendaryActions = { description: legDesc, entries: newLegendary || [] };
        } else {
            delete m.legendaryActions;
        }
        delete m.legendary;

        const lairDesc = content.querySelector('#cs-edit-lair-desc').value.trim();
        const newLair = extractAbilityList('cs-edit-lair-list');
        if (newLair && newLair.length > 0) {
            m.lairActions = newLair;
            if (lairDesc) {
                m.lairActionsDesc = lairDesc;
                m.lairHeader = lairDesc;
            } else {
                delete m.lairActionsDesc;
                delete m.lairHeader;
            }
        } else {
            delete m.lairActions;
            delete m.lairActionsDesc;
            delete m.lairHeader;
        }

        // Save back to char
        // Extract Spellcasting Blocks
        const scCards = content.querySelectorAll('#cs-edit-spellcasting-blocks-list .cs-edit-sc-card');
        const newSpellcasting = [];
        scCards.forEach((card, idx) => {
            const scName = card.querySelector('.sc-edit-name').value.trim() || 'Spellcasting';
            const scType = card.querySelector('.sc-edit-type')?.value || 'slot';
            const scRecharge = card.querySelector('.sc-edit-recharge')?.value || 'long_rest';
            const ability = card.querySelector('.sc-edit-ability').value;
            const dcRaw = card.querySelector('.sc-edit-dc').value.trim();
            const atkRaw = card.querySelector('.sc-edit-atk').value.trim();
            const clRaw = card.querySelector('.sc-edit-caster-level')?.value.trim();
            const descRaw = card.querySelector('.sc-edit-desc').value.trim();

            const existingBlock = (m.spellcasting && m.spellcasting[idx]) ? m.spellcasting[idx] : {};
            const casterLvlVal = clRaw !== undefined && clRaw !== '' ? (parseInt(clRaw) || 0) : 0;
            const block = {
                ...existingBlock,
                name: scName,
                type: scType,
                rechargeRule: scRecharge,
                ability: ability,
                casterLevel: casterLvlVal,
                headerEntries: descRaw ? descRaw.split('\n') : []
            };

            const prevType = resolveSpellcastingType(existingBlock, m);

            // If switching from innate to slot or slot to innate, restructure internal fields
            if (scType !== prevType) {
                if (scType === 'slot' || scType === 'pact') {
                    block.spells = block.spells || {};
                    if (block.will && Array.isArray(block.will) && block.will.length > 0) {
                        block.spells['0'] = block.spells['0'] || { spells: [] };
                        block.will.forEach(sp => {
                            const sList = Array.isArray(block.spells['0']) ? block.spells['0'] : block.spells['0'].spells;
                            if (sList && !sList.includes(sp)) sList.push(sp);
                        });
                        delete block.will;
                    }
                    if (block.daily && typeof block.daily === 'object') {
                        for (let dKey in block.daily) {
                            const dList = block.daily[dKey] || [];
                            block.spells['1'] = block.spells['1'] || { spells: [] };
                            const sList = Array.isArray(block.spells['1']) ? block.spells['1'] : block.spells['1'].spells;
                            dList.forEach(sp => {
                                if (sList && !sList.includes(sp)) sList.push(sp);
                            });
                        }
                        delete block.daily;
                    }
                }
            }

            if (scType === 'slot' || scType === 'pact') {
                // Automatically calculate standard spell slots from Caster Level
                const autoSlots = get5eSlotsForCaster(scType, casterLvlVal);
                m.slots = m.slots || {};
                m.spellSlots = m.spellSlots || {};
                char.spellSlots = char.spellSlots || {};
                for (let sl = 1; sl <= 9; sl++) {
                    const k = 'level' + sl;
                    const maxVal = autoSlots[k] || 0;
                    if (maxVal > 0) {
                        m.slots[k] = maxVal;
                        m.spellSlots[k] = { max: maxVal, current: maxVal };
                        char.spellSlots[k] = { max: maxVal, current: maxVal };
                    } else if (casterLvlVal > 0) {
                        delete m.slots[k];
                        delete m.spellSlots[k];
                        delete char.spellSlots[k];
                    }
                }
            } else if (scType === 'innate') {
                // Extract customized innate usage sections
                const sectionRows = card.querySelectorAll('.sc-edit-section-counter');
                const targetUsages = Array.from(sectionRows).map(inp => parseInt(inp.value) || 0);

                const oldWill = block.will || block.innateObj?.will || [];
                const oldDaily = block.daily || block.innateObj?.daily || {};

                block.will = [];
                block.daily = {};

                targetUsages.forEach(u => {
                    if (u === 0) {
                        block.will = oldWill;
                    } else {
                        const dKey = u + 'e';
                        block.daily[dKey] = oldDaily[dKey] || oldDaily['' + u] || [];
                    }
                });

                if (scType !== prevType && block.spells && typeof block.spells === 'object') {
                    for (let lvl in block.spells) {
                        const rawList = Array.isArray(block.spells[lvl]) ? block.spells[lvl] : (block.spells[lvl]?.spells || []);
                        if (lvl === '0') {
                            rawList.forEach(sp => { if (!block.will.includes(sp)) block.will.push(sp); });
                        } else {
                            block.daily['1e'] = block.daily['1e'] || [];
                            rawList.forEach(sp => { if (!block.daily['1e'].includes(sp)) block.daily['1e'].push(sp); });
                        }
                    }
                    delete block.spells;
                }

                block.innateObj = {
                    will: block.will,
                    daily: block.daily
                };
            }

            if (dcRaw !== '') block.dc = parseInt(dcRaw) || undefined; else delete block.dc;
            if (atkRaw !== '') block.atkMod = parseInt(atkRaw) || undefined; else delete block.atkMod;
            if (idx === 0) m.casterLevel = casterLvlVal;
            newSpellcasting.push(block);
        });
        m.spellcasting = newSpellcasting;
        m.spells = null;

        char.monsterData = m;

        // Sync to players
        window.VTT.socket.emit('character:update', { character: char });

        // Sync linked tokens on canvas
        if (window.VTT?.canvasEngine) {
            const tokens = window.VTT.canvasEngine.getTokens();
            let changed = false;
            Object.values(tokens).forEach(t => {
                if (t.characterId === char.id || (t.name === char.name && !t.isPlayer)) {
                    if (char.tokenSight !== undefined) {
                        t.sightRange = char.tokenSight;
                        changed = true;
                    }
                }
            });
            if (changed) {
                const curMapId = window.VTT.canvasEngine.getCurrentMapId();
                if (curMapId && window.VTT.socket) {
                    Object.values(tokens).forEach(t => {
                        if (t.characterId === char.id || (t.name === char.name && !t.isPlayer)) {
                            window.VTT.socket.emit('token:update', { mapId: curMapId, token: t });
                        }
                    });
                }
                window.VTT.canvasEngine.renderAll();
            }
        }

        // Update UI
        if (overlay) overlay.remove();
        renderStatBlock(m);
        saveAndRenderNpcSpells(m);
        
        // window.VTT.socket.emit('chat:msg', {
        //     text: `*Companion **${char.name}** was updated.*`
        // });
    }

    function evaluateDiceHelper(formula, isCrit = false, rollModeOverride = null) {
        if (!formula) return { total: 0, diceList: [], isCritSuccess: false, isCritFail: false, breakdownStr: '', formula: '' };
        if (isCrit) {
            formula = formula.replace(/(?:(\d+)\s*)?[dD]\s*(\d+)/gi, (m, count, faces) => `${(count ? parseInt(count) : 1) * 2}d${faces}`);
        }
        const cleanForm = formula.replace(/\s+/g, '').toLowerCase();
        let total = 0;
        let diceList = [];
        let isCritSuccess = false;
        let isCritFail = false;

        let rollMode = rollModeOverride || (window.VTT ? window.VTT.currentRollMode : 'normal');
        const evt = window.event;
        if (!rollModeOverride && evt) {
            if (evt.shiftKey) rollMode = 'adv';
            else if (evt.ctrlKey) rollMode = 'dis';
        }
        const isAdvantage = rollMode === 'adv';
        const isDisadvantage = rollMode === 'dis';
        
        const parts = cleanForm.split(/([+-])/);
        let sign = 1;
        let bdParts = [];

        for (let p of parts) {
            if (!p) continue;
            if (p === '+') { sign = 1; bdParts.push('+'); continue; }
            if (p === '-') { sign = -1; bdParts.push('-'); continue; }
            if (p.includes('d')) {
                const [countStr, faceStr] = p.split('d');
                let count = parseInt(countStr) || 1;
                const faces = parseInt(faceStr) || 20;

                let partDiceList = [];

                if (faces === 20 && count === 1 && (isAdvantage || isDisadvantage) && !isCrit) {
                    count = 2;
                    const roll1 = Math.floor(Math.random() * 20) + 1;
                    const roll2 = Math.floor(Math.random() * 20) + 1;
                    let keptRoll = roll1;
                    let droppedRoll = roll2;
                    
                    if (isAdvantage) {
                        if (roll2 > roll1) { keptRoll = roll2; droppedRoll = roll1; }
                    } else if (isDisadvantage) {
                        if (roll2 < roll1) { keptRoll = roll2; droppedRoll = roll1; }
                    }
                    
                    const keptObj = { val: keptRoll, type: 'd20' };
                    const droppedObj = { val: droppedRoll, type: 'd20', dropped: true };
                    
                    partDiceList.push(keptObj, droppedObj);
                    diceList.push(keptObj, droppedObj);
                    
                    if (keptRoll === 20) isCritSuccess = true;
                    if (keptRoll === 1) isCritFail = true;
                    total += sign * keptRoll;
                } else {
                    for (let i = 0; i < count; i++) {
                        const roll = Math.floor(Math.random() * faces) + 1;
                        if (faces === 20 && count === 1 && !isCrit) {
                            if (roll === 20) isCritSuccess = true;
                            if (roll === 1) isCritFail = true;
                        }
                        total += sign * roll;
                        const obj = { val: roll, type: `d${faces}` };
                        partDiceList.push(obj);
                        diceList.push(obj);
                    }
                }
                
                const partBd = partDiceList.map(d => d.dropped ? `(${d.val})` : d.val);
                bdParts.push(`[${partBd.join(', ')}]`);
            } else {
                const val = parseInt(p) || 0;
                total += sign * val;
                bdParts.push(val);
            }
        }

        return { total, diceList, isCritSuccess, isCritFail, breakdownStr: bdParts.join(' '), formula };
    }

    function extractSpellcastingStats(m) {
        let stats = { dc: 0, atk: 0, ability: 'INT', level: 1 };
        if (!m) return stats;
        
        let foundDc = false;
        let foundAtk = false;
        let foundLvl = false;
        
        if (m.spellcasting && m.spellcasting.length > 0) {
            for (let sc of m.spellcasting) {
                if (sc.headerEntries) {
                    const header = sc.headerEntries.join(' ');
                    const dcMatch = header.match(/DC\s+(\d+)/i);
                    if (dcMatch && !foundDc) {
                        stats.dc = parseInt(dcMatch[1]);
                        foundDc = true;
                    }
                    const atkMatch = header.match(/([\+\-]\d+)\s+to\s+hit/i);
                    if (atkMatch && !foundAtk) {
                        stats.atk = parseInt(atkMatch[1]);
                        foundAtk = true;
                    }
                    const abMatch = header.match(/ability\s+is\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
                    if (abMatch) {
                        stats.ability = abMatch[1].substring(0, 3).toUpperCase();
                    }
                    const lvlMatch = header.match(/(\d+)(?:st|nd|rd|th)-level spellcaster/i);
                    if (lvlMatch && !foundLvl) {
                        stats.level = parseInt(lvlMatch[1]);
                        foundLvl = true;
                    }
                }
            }
        }
        
        // Fallback calculation if explicit missing
        const crRaw = m.cr;
        let cr = 0;
        if (crRaw && crRaw.cr) cr = eval(crRaw.cr.replace('/', '.'));
        else if (typeof crRaw === 'string') cr = eval(crRaw.replace('/', '.'));
        const prof = Math.max(2, Math.floor((cr - 1) / 4) + 2);
        
        let abMod = 0;
        const abStatStr = stats.ability.toLowerCase();
        if (m[abStatStr]) {
            abMod = Math.floor((m[abStatStr] - 10) / 2);
        }
        
        if (!foundDc) stats.dc = 8 + prof + abMod;
        if (!foundAtk) stats.atk = prof + abMod;
        if (!foundLvl) {
            stats.level = cr > 0 ? Math.floor(cr) : 1;
            if (stats.level < 1) stats.level = 1;
        }
        
        return stats;
    }

    function ensureCreatureUpcastModal() {
        if (document.getElementById('modal-cs-upcast-prompt')) return;
        
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="modal-cs-upcast-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3020;"></div>
            <div id="modal-cs-upcast-prompt" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:300px; padding:16px; z-index:3025;">
                <h3 style="margin-top:0; color:var(--color-gold-base); font-size:1.1rem; border-bottom:1px solid var(--color-border-subtle); padding-bottom:8px;">Cast Spell</h3>
                <div style="margin-bottom:16px;">
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-muted);">Cast at Level</label>
                    <select id="cs-upcast-prompt-level" class="form-control" style="width:100%;"></select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-secondary btn-sm" id="cs-upcast-prompt-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="cs-upcast-prompt-cast">Cast</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    function promptCreatureUpcastLevel(baseLvl, callback) {
        ensureCreatureUpcastModal();
        const modal = document.getElementById('modal-cs-upcast-prompt');
        const overlay = document.getElementById('modal-cs-upcast-overlay');
        const select = document.getElementById('cs-upcast-prompt-level');
        select.innerHTML = '';
        for (let i = baseLvl; i <= 9; i++) {
            select.innerHTML += `<option value="${i}">${i}${i===1?'st':i===2?'nd':i===3?'rd':'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
        }
        modal.classList.remove('vtt-hidden');
        if (overlay) overlay.classList.remove('vtt-hidden');
        
        const cleanup = () => {
            modal.classList.add('vtt-hidden');
            if (overlay) overlay.classList.add('vtt-hidden');
            document.getElementById('cs-upcast-prompt-cast')?.removeEventListener('click', handleCast);
            document.getElementById('cs-upcast-prompt-cancel')?.removeEventListener('click', handleCancel);
            overlay?.removeEventListener('click', handleOverlayClick);
            window.removeEventListener('keydown', handleEsc);
        };
        const handleCast = () => {
            cleanup();
            callback(parseInt(select.value));
        };
        const handleCancel = () => {
            cleanup();
            callback(null);
        };
        const handleOverlayClick = (e) => {
            if (e.target === overlay) handleCancel();
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                handleCancel();
            }
        };
        
        document.getElementById('cs-upcast-prompt-cast')?.addEventListener('click', handleCast);
        document.getElementById('cs-upcast-prompt-cancel')?.addEventListener('click', handleCancel);
        overlay?.addEventListener('click', handleOverlayClick);
        window.addEventListener('keydown', handleEsc);
    }
    
    function getUpcastBonus(spData) {
        if (!spData.entriesHigherLevel) return null;
        const hl = JSON.stringify(spData.entriesHigherLevel).toLowerCase();
        let hlMatch = hl.match(/\{@scaledamage [^|]+\|[^|]+\|([^}]+)\}/);
        if (hlMatch) {
            return hlMatch[1];
        } else {
            hlMatch = hl.match(/increases by (?:\{@damage )?(\d+d\d+)/);
            if (hlMatch) {
                return hlMatch[1];
            } else {
                hlMatch = hl.match(/(\d+)d(\d+)/);
                if (hlMatch) {
                    return hlMatch[1] + 'd' + hlMatch[2];
                }
            }
        }
        return null;
    }

    function parseSpellMacro(spell, stats, charName, descHtml, castLvl) {
        const mc = {
            charName: charName || 'Creature',
            macroName: spell.name,
            atkRoll: null,
            saveInfo: null,
            dmgRolls: [],
            description: descHtml
        };
        
        // Parse Attack
        if (spell.spellAttack) {
            const mod = stats.atk;
            const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            const evalRoll = evaluateDiceHelper(formula);
            mc.atkRoll = {
                formula: formula,
                total: evalRoll.total,
                breakdownStr: evalRoll.breakdownStr,
                diceList: evalRoll.diceList,
                isCritSuccess: evalRoll.isCritSuccess,
                isCritFail: evalRoll.isCritFail
            };
        }
        
        // Parse Save DC
        if (spell.savingThrow && spell.savingThrow.length > 0) {
            mc.saveInfo = {
                dc: stats.dc,
                ability: spell.savingThrow[0].substring(0, 3).toUpperCase()
            };
            mc.target = `${mc.saveInfo.ability} Save DC ${mc.saveInfo.dc}`;
        }
        
        // Parse Damages
        const dmgRegex = /\{@damage ([^\}]+)\}(?:.*?([\w]+)\s+damage)?/gi;
        let rawString = JSON.stringify(spell.entries || []);
        let match;
        let isCrit = mc.atkRoll ? mc.atkRoll.isCritSuccess : false;
        
        // Quick extraction of damage types from the spell text nearby
        const typeRegex = /\{@damage [^\}]+\}\s+([a-zA-Z]+)\s+damage/gi;
        let typeMatches = [...rawString.matchAll(typeRegex)];
        let typeIdx = 0;
        
        // Cantrip Scaling Logic
        let cCount = 1;
        if (spell.level === 0) {
            if (stats.level >= 5) cCount = 2;
            if (stats.level >= 11) cCount = 3;
            if (stats.level >= 17) cCount = 4;
            
            // Do not scale dice count for these specific cantrips that scale by adding extra attacks/rays
            const noScaleDice = ['eldritch blast', 'magic stone'];
            if (noScaleDice.includes(spell.name.toLowerCase())) {
                cCount = 1;
            }
            
            // Strip out cantrip text that describes scaling to prevent duplicate damage fields
            rawString = rawString.replace(/This spell\\'s damage increases by.*?\]/g, '');
            rawString = rawString.replace(/This spell\\'s damage increases by.*?(?=")/g, '');
            rawString = rawString.replace(/\{\\"name\\":\\"Cantrip Upgrade\\".*?\}/g, '');
        }

        let upcastBonus = null;
        if (castLvl && castLvl > spell.level) {
            upcastBonus = getUpcastBonus(spell);
        }

        while ((match = dmgRegex.exec(rawString)) !== null) {
            let formula = match[1];
            
            if (cCount > 1) {
                if (formula.match(/(?:\d+\s*)?[dD]\s*\d+/)) {
                    formula = formula.replace(/(?:\d+\s*)?([dD]\s*\d+)/, `${cCount}$1`);
                }
            }

            // Upcast Logic
            if (upcastBonus && castLvl > spell.level) {
                const extra = castLvl - spell.level;
                const scaleFn = window.VTTSpellManager?.scaleUpcastFormula || window.scaleUpcastFormula;
                if (scaleFn) {
                    const scaledStr = scaleFn(upcastBonus, extra);
                    if (scaledStr) formula = `${formula} ${scaledStr}`.trim();
                } else {
                    const upcastMatch = upcastBonus.match(/(?:(\d+)\s*)?[dD]\s*(\d+)/);
                    if (upcastMatch) {
                        const diceCount = upcastMatch[1] ? parseInt(upcastMatch[1]) : 1;
                        const extraDice = diceCount * extra;
                        const uSize = "d" + upcastMatch[2];
                        formula += ` + ${extraDice}${uSize}`;
                    } else if (!isNaN(parseInt(upcastBonus))) {
                        formula += ` + ${parseInt(upcastBonus) * extra}`;
                    }
                }
            }
            
            let type = 'Damage';
            if (typeIdx < typeMatches.length) {
                 type = typeMatches[typeIdx][1].charAt(0).toUpperCase() + typeMatches[typeIdx][1].slice(1).toLowerCase();
                 typeIdx++;
            }
            const evalRoll = evaluateDiceHelper(formula, isCrit);
            mc.dmgRolls.push({
                type: type,
                formula: formula,
                isMagic: true,
                isSpell: true,
                roll: {
                    total: evalRoll.total,
                    formula: formula,
                    breakdownStr: evalRoll.breakdownStr,
                    diceList: evalRoll.diceList
                }
            });
        }
        
        return mc;
    }

    function parseActionMacro(abilityName, rawEntries, abilityText, charName, preParsedMacro, rollModeOverride = null) {
        const mc = {
            charName: charName || 'Creature',
            macroName: abilityName,
            atkRoll: null,
            saveInfo: null,
            dmgRolls: []
        };
        
        const textToCheck = `${abilityName || ''} ${abilityText || ''} ${typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries || '')}`;
        const hasMagicWeaponsTrait = currentMonster?.trait && Array.isArray(currentMonster.trait) && currentMonster.trait.some(t => /magic\s+weapons?/i.test(t.name || ''));
        const isMagicAttack = !!(preParsedMacro?.isMagic || hasMagicWeaponsTrait || /magic\s+weapon\s+attack|attacks?\s+are\s+magical/i.test(textToCheck));
        const isSilveredAttack = !!(preParsedMacro?.isSilvered || /silvered/i.test(textToCheck));
        const isAdamantineAttack = !!(preParsedMacro?.isAdamantine || /adamantine/i.test(textToCheck));

        // Zero-regex execution: Use pre-compiled macro schema if available
        if (preParsedMacro) {
            let isCrit = false;
            if (preParsedMacro.isAttack && preParsedMacro.attackBonus !== null && preParsedMacro.attackBonus !== undefined) {
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
                    ability: (preParsedMacro.save.ability && preParsedMacro.save.ability !== 'Save') ? preParsedMacro.save.ability : null
                };
            }

            if (preParsedMacro.damages && Array.isArray(preParsedMacro.damages) && preParsedMacro.damages.length > 0) {
                preParsedMacro.damages.forEach(d => {
                    const evalRoll = evaluateDiceHelper(d.formula, isCrit);
                    const rawType = (d.type || 'Slashing').trim();
                    const type = STANDARD_DAMAGE_TYPES.find(dt => dt.toLowerCase() === rawType.toLowerCase()) || (rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase());
                    mc.dmgRolls.push({
                        type: type,
                        formula: evalRoll.formula || d.formula,
                        saveRider: !!d.saveRider,
                        isMagic: d.isMagic !== undefined ? !!d.isMagic : isMagicAttack,
                        isSilvered: d.isSilvered !== undefined ? !!d.isSilvered : isSilveredAttack,
                        isAdamantine: d.isAdamantine !== undefined ? !!d.isAdamantine : isAdamantineAttack,
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
        
        const rawString = typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries);
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

        const preDcM = rawString.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b(?:\s+(?:saving\s+throw|save))?\s*(?:\{@dc\s+(\d+)\}|DC\s*(\d+))/i);
        if (preDcM) {
            if (!saveAbility) saveAbility = preDcM[1].substring(0, 3).toUpperCase();
            if (!saveDc) saveDc = parseInt(preDcM[2] || preDcM[3], 10);
        }

        const postDcM = rawString.match(/(?:save\s+DC|DC)\s*(\d+)(?:\s+or\s+higher)?\s+(?:\{@actSave\s+([a-zA-Z]+)\}|(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha))/i);
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
            const abM = rawString.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b\s+saving\s+throw/i) ||
                        rawString.match(/saving\s+throw\s+against\s+(?:the\s+)?\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b/i);
            if (abM) {
                saveAbility = abM[1].substring(0, 3).toUpperCase();
            }
        }

        if (saveDc) {
            const validAbilities = new Set(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
            const normalizedAbility = (saveAbility && validAbilities.has(saveAbility)) ? saveAbility : null;
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
            if (!['Fire', 'Cold', 'Lightning', 'Thunder', 'Poison', 'Acid', 'Necrotic', 'Radiant', 'Force', 'Psychic', 'Slashing', 'Piercing', 'Bludgeoning', 'Healing'].includes(type)) {
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
    function saveAndRenderNpcSpells(m) {
        if (!m) m = currentMonster;
        currentMonster = m;

        // Ensure spells dictionary and spellcasting blocks are synchronized
        ensureNpcSpells(m);

        // Persist monster spells to linked character, active token, or custom bestiary
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char) {
                char.monsterData = m;
                char.spells = m.spells;
                window.VTT.socket.emit('character:update', { character: char });
            }
        } else if (window.VTT?.currentToken) {
            window.VTT.currentToken.monsterData = m;
            window.VTT.currentToken.spells = m.spells;
            const curMapId = window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
            window.VTT.socket.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
        }

        const spellsHtml = buildSpellcastingHtml(m);
        const tabSpells = document.getElementById('cs-tab-spells');
        if (tabSpells) {
            tabSpells.innerHTML = spellsHtml;
            wireSpellSlots();
            setupCsSpellListeners();
        }
    }

    function setupCsSpellListeners() {
        const contentEl = document.getElementById('vtt-creature-sheet-panel');
        if (!contentEl) return;

        async function ensureSpellIsParsed(sp) {
            if (!sp) return null;
            const isMonster2024 = currentMonster?.source === 'XMM' || 
                                  currentMonster?.source === 'XPHB' || 
                                  currentMonster?.source === 'XDMG' || 
                                  !!currentMonster?.is2024 ||
                                  (typeof currentMonster?.source === 'string' && currentMonster.source.startsWith('X'));
            const spellOptions = { is2024: isMonster2024, caster: currentMonster };
            if (window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                return await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
            }
            return sp;
        }

        function extractSpellContext(el) {
            const row = el.closest('.cs-spell-item');
            const level = el.dataset.level || row?.dataset.level || 'cantrip';
            const idx = parseInt(el.dataset.idx !== undefined ? el.dataset.idx : row?.dataset.idx);
            const blockId = row?.dataset.blockId || el.dataset.blockId;
            const spellId = row?.dataset.spellId || el.dataset.spellId;
            const sectionKey = row?.dataset.sectionKey || el.dataset.sectionKey;
            const nameEl = row?.querySelector('.cs-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : (row?.dataset.spellName || '');
            let sp = getSpellFromMonster(currentMonster, level, idx, spellId, blockId, sectionKey, spellName);
            if (!sp && spellName) {
                sp = { name: spellName, level: level, source: currentMonster?.source };
            }
            return { level, idx, blockId, spellId, sectionKey, sp, row, spellName };
        }

        // Expand Spell Details
        contentEl.querySelectorAll('.cs-spell-expand-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const item = e.currentTarget.closest('.cs-spell-item');
            if (!item) return;
            const details = item.querySelector('.cs-spell-details');
            const nameEl = item.querySelector('.cs-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : (item.dataset.spellName || 'Spell');
            const descEl = details ? details.querySelector('.cs-spell-desc') : null;
            const btnEl = e.currentTarget;
            
            const level = item.dataset.level || item.querySelector('[data-level]')?.dataset.level;
            const idx = item.dataset.idx !== undefined ? parseInt(item.dataset.idx) : null;
            const blockId = item.dataset.blockId;
            const spellId = item.dataset.spellId;
            const sectionKey = item.dataset.sectionKey;
            
            const isMonster2024 = currentMonster?.source === 'XMM' || 
                                  currentMonster?.source === 'XPHB' || 
                                  currentMonster?.source === 'XDMG' || 
                                  !!currentMonster?.is2024 ||
                                  (typeof currentMonster?.source === 'string' && currentMonster.source.startsWith('X'));
            const spellOptions = { is2024: isMonster2024, caster: currentMonster };

            let sp = getSpellFromMonster(currentMonster, level, idx, spellId, blockId, sectionKey, spellName);
            if (!sp) {
                sp = { name: spellName, level: level, source: isMonster2024 ? 'XPHB' : 'PHB' };
            } else if (!sp.source || sp.source === 'MM' || sp.source === 'XMM') {
                sp.source = isMonster2024 ? 'XPHB' : 'PHB';
            }

            if (details) {
                const chevron = btnEl ? btnEl.querySelector('.fa-chevron-right') : null;
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    if (btnEl) btnEl.classList.add('expanded');
                    if (chevron) chevron.style.transform = 'rotate(90deg)';
                    
                    if (sp && window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                        try {
                            await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
                        } catch (err) {
                            console.warn('[VTTSpellManager] Error parsing spell:', err);
                        }
                    }
                    if (window.VTTSpellManager && window.VTTSpellManager.renderAndInjectSpell) {
                        window.VTTSpellManager.renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level, spellOptions);
                    } else if (typeof renderAndInjectSpell === 'function') {
                        renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level, spellOptions);
                    }
                } else {
                    details.style.display = 'none';
                    if (btnEl) btnEl.classList.remove('expanded');
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            }
        }));

        // Ping Macro / Post Chat
        contentEl.querySelectorAll('.cs-spell-ping-macro').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { level, idx, sp } = extractSpellContext(e.currentTarget);
            if (!sp) return;
            await ensureSpellIsParsed(sp);
            const isLeveled = level !== 'cantrip' && level !== 'legacy' && (sp.level === undefined || sp.level > 0);
            const upcastFn = window.VTTSpellManager?.promptUpcastLevel || window.vttPlayerSheetAPI?.promptUpcastLevel;
            if (isLeveled && upcastFn) {
                const baseLvl = parseInt(String(sp.level || level).replace('level', '')) || 1;
                upcastFn(baseLvl, (lvl, opts) => {
                    if (lvl) rollNpcSpell(level, idx, 'roll', lvl, sp, opts);
                }, { caster: currentMonster, spell: sp, levelKey: level });
            } else {
                rollNpcSpell(level, idx, 'roll', null, sp);
            }
        }));
        contentEl.querySelectorAll('.cs-spell-macro-attack').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { level, idx, sp } = extractSpellContext(e.currentTarget);
            if (!sp) return;
            await ensureSpellIsParsed(sp);
            rollNpcSpell(level, idx, 'attack', null, sp);
        }));
        contentEl.querySelectorAll('.cs-spell-macro-save').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { level, idx, sp } = extractSpellContext(e.currentTarget);
            if (!sp) return;
            await ensureSpellIsParsed(sp);
            rollNpcSpell(level, idx, 'save', null, sp);
        }));
        contentEl.querySelectorAll('.cs-spell-macro-damage').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { level, idx, sp } = extractSpellContext(e.currentTarget);
            if (!sp) return;
            await ensureSpellIsParsed(sp);
            const isLeveled = level !== 'cantrip' && level !== 'legacy' && (sp.level === undefined || sp.level > 0);
            const upcastFn = window.VTTSpellManager?.promptUpcastLevel || window.vttPlayerSheetAPI?.promptUpcastLevel;
            if (isLeveled && upcastFn) {
                const baseLvl = parseInt(String(sp.level || level).replace('level', '')) || 1;
                upcastFn(baseLvl, (lvl, opts) => {
                    if (lvl) rollNpcSpell(level, idx, 'damage', lvl, sp, opts);
                }, { caster: currentMonster, spell: sp, levelKey: level });
            } else {
                rollNpcSpell(level, idx, 'damage', null, sp);
            }
        }));
        contentEl.querySelectorAll('.cs-spell-post-chat').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { level, sp, spellName } = extractSpellContext(e.currentTarget);
            if (!sp && !spellName) return;
            const spellObj = sp || { name: spellName, level: level, source: currentMonster?.source };

            await ensureSpellIsParsed(spellObj);

            const visibility = typeof getVisibilitySetting === 'function' ? getVisibilitySetting() : 'public';
            if (window.VTTSpellManager && window.VTTSpellManager.postSpellToChat) {
                window.VTTSpellManager.postSpellToChat(spellObj, level, currentMonster?.name || 'Creature', visibility);
            } else {
                const meta = window.vttPlayerSheetAPI ? window.vttPlayerSheetAPI.getSpellMetaStrings(spellObj, level) : {};
                let bodyText = spellObj.description || '';
                if (typeof injectDiceChips === 'function') bodyText = injectDiceChips(bodyText);
                const msgObj = { text: `pings ${spellObj.name}`, abilityCard: { creatureName: currentMonster?.name || 'Creature', abilityName: spellObj.name, text: bodyText, ...meta } };
                if (visibility === 'private' || visibility === 'gm') { msgObj.to = vtt.username; vtt.socket.emit('chat:whisper', msgObj); }
                else { vtt.socket.emit('chat:msg', msgObj); }
            }
        }));

        // Add Spell Modal
        contentEl.querySelectorAll('.cs-btn-add-spell, .btn-add-spell').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!currentMonster) return;
            const level = e.currentTarget.dataset.level || 'cantrip';
            const blockId = e.currentTarget.dataset.blockId || null;
            const sectionKey = e.currentTarget.dataset.sectionKey || null;
            if (window.VTTSpellManager) {
                window.VTTSpellManager.openModal(level, -1, currentMonster, (updatedMonster) => {
                    currentMonster = updatedMonster;
                    saveAndRenderNpcSpells(currentMonster);
                }, {
                    blockId,
                    sectionKey
                });
            }
        }));

        // Edit Spell Modal
        contentEl.querySelectorAll('.cs-spell-edit').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!currentMonster) return;
            
            const { level, idx, blockId, spellId, sectionKey, sp } = extractSpellContext(e.currentTarget);
            if (!sp) return;
            await ensureSpellIsParsed(sp);
            
            if (window.VTTSpellManager) {
                window.VTTSpellManager.openModal(level, idx, currentMonster, (updatedMonster) => {
                    currentMonster = updatedMonster;
                    saveAndRenderNpcSpells(currentMonster);
                }, {
                    targetSpell: sp,
                    blockId,
                    sectionKey,
                    spellId,
                    onDelete: (monster, target) => {
                        if (blockId && monster.spellcasting) {
                            const sc = monster.spellcasting.find(b => b.id === blockId);
                            if (sc) {
                                if (sectionKey === 'will' && sc.innateObj?.will) {
                                    sc.innateObj.will = sc.innateObj.will.filter(s => s !== target && s.id !== target.id);
                                    if (sc.will) sc.will = sc.will.filter(s => (typeof s === 'string' ? s.toLowerCase() : s.id) !== (target.name?.toLowerCase() || target.id));
                                } else if (sectionKey && sc.innateObj?.daily?.[sectionKey]) {
                                    sc.innateObj.daily[sectionKey] = sc.innateObj.daily[sectionKey].filter(s => s !== target && s.id !== target.id);
                                    if (sc.daily?.[sectionKey]) sc.daily[sectionKey] = sc.daily[sectionKey].filter(s => (typeof s === 'string' ? s.toLowerCase() : s.id) !== (target.name?.toLowerCase() || target.id));
                                } else if (sc.spellsObj?.[level]) {
                                    sc.spellsObj[level] = sc.spellsObj[level].filter(s => s !== target && s.id !== target.id);
                                }
                            }
                        }
                        if (monster.spells?.[level]) {
                            monster.spells[level] = monster.spells[level].filter(s => s !== target && s.id !== target.id);
                        }
                    }
                });
            }
        }));

        contentEl.querySelectorAll('.cs-spell-prep-toggle').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { level, sp, row } = extractSpellContext(btn);
            if (!sp) return;
            
            sp.prepared = sp.prepared === false ? true : false;
            
            const icon = btn.querySelector('i');
            const itemRow = row || btn.closest('.cs-spell-item');
            if (sp.prepared) {
                if (icon) {
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                }
                if (itemRow) {
                    itemRow.dataset.prepared = 'true';
                    itemRow.style.opacity = '1';
                }
            } else {
                if (icon) {
                    icon.classList.remove('fa-solid');
                    icon.classList.add('fa-regular');
                }
                if (itemRow) {
                    itemRow.dataset.prepared = 'false';
                    if (level !== 'cantrip' && level !== 'legacy') {
                        itemRow.style.opacity = '0.6';
                    }
                }
            }

            if (linkedCharacterId && window.VTT?.campaignState?.characters) {
                const char = window.VTT.campaignState.characters[linkedCharacterId];
                if (char) {
                    char.monsterData = currentMonster;
                    window.VTT.socket.emit('character:update', { character: char });
                }
            } else if (window.VTT?.currentToken) {
                window.VTT.currentToken.monsterData = currentMonster;
                const curMapId = window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
                window.VTT.socket.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
            }
        }));

        contentEl.querySelectorAll('.cs-innate-use-checkbox').forEach(cb => cb.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const spId = e.currentTarget.dataset.spellId;
            const usesMax = parseInt(e.currentTarget.dataset.usesMax) || 1;
            const useIdx = parseInt(e.currentTarget.dataset.useIdx) || 0;
            if (!currentMonster || !spId) return;

            currentMonster.dailyUsages = currentMonster.dailyUsages || {};
            const cur = currentMonster.dailyUsages[spId] !== undefined ? currentMonster.dailyUsages[spId] : usesMax;
            
            let nextVal = (useIdx + 1 === cur) ? useIdx : (useIdx + 1);
            currentMonster.dailyUsages[spId] = Math.max(0, Math.min(usesMax, nextVal));

            const parent = e.currentTarget.closest('.cs-spell-page') || e.currentTarget.parentElement;
            if (parent) {
                parent.querySelectorAll(`.cs-innate-use-checkbox[data-spell-id="${spId}"]`).forEach((box, bIdx) => {
                    const checked = bIdx < currentMonster.dailyUsages[spId];
                    box.className = `cs-innate-use-checkbox ${checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}`;
                });
            }

            if (linkedCharacterId && window.VTT?.campaignState?.characters) {
                const char = window.VTT.campaignState.characters[linkedCharacterId];
                if (char) {
                    char.monsterData = currentMonster;
                    window.VTT.socket.emit('character:update', { character: char });
                }
            } else if (window.VTT?.currentToken) {
                window.VTT.currentToken.monsterData = currentMonster;
                const curMapId = window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
                window.VTT.socket.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
            }
        }));

        // Reset Slots & Daily Usages Button
        contentEl.querySelector('#cs-reset-slots-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!currentMonster) return;
            currentMonster.dailyUsages = {};

            contentEl.querySelectorAll('.cs-spell-slot-input[data-type="current"]').forEach(input => {
                const level = input.dataset.level;
                const maxInput = contentEl.querySelector(`.cs-spell-slot-input[data-type="max"][data-level="${level}"]`);
                const maxVal = maxInput ? (parseInt(maxInput.value) || 0) : (parseInt(input.dataset.max) || 0);
                input.value = maxVal;
                syncSlotsState(level, maxVal, maxVal);
            });

            saveAndRenderNpcSpells(currentMonster);
        });
    }

    function expendNpcSpellResource(m, sp, castLvl) {
        if (!m || !sp) return;
        const panel = document.getElementById('vtt-creature-sheet-panel') || document;
        // 1. Daily usage (innate spell)
        if (sp.dailyKey || sp.usesMax || (sp.id && m.dailyUsages && m.dailyUsages[sp.id] !== undefined)) {
            const usesMax = sp.usesMax || 1;
            m.dailyUsages = m.dailyUsages || {};
            const cur = m.dailyUsages[sp.id] !== undefined ? m.dailyUsages[sp.id] : usesMax;
            if (cur > 0) {
                m.dailyUsages[sp.id] = cur - 1;
                panel.querySelectorAll(`.cs-innate-use-checkbox[data-spell-id="${sp.id}"]`).forEach((box, bIdx) => {
                    const checked = bIdx < m.dailyUsages[sp.id];
                    box.className = `cs-innate-use-checkbox ${checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}`;
                });
                saveMonsterData(m);
            }
            return;
        }

        // 2. Leveled spell slot
        let lvlNum = null;
        if (typeof castLvl === 'number') lvlNum = castLvl;
        else if (typeof castLvl === 'string' && castLvl.startsWith('level')) lvlNum = parseInt(castLvl.replace('level', ''));
        else lvlNum = parseInt(castLvl);

        if (lvlNum && lvlNum >= 1 && lvlNum <= 9) {
            const lvlKey = 'level' + lvlNum;
            const curInput = panel.querySelector(`.cs-spell-slot-input[data-type="current"][data-level="${lvlKey}"]`);
            const maxInput = panel.querySelector(`.cs-spell-slot-input[data-type="max"][data-level="${lvlKey}"]`);
            const defaultMax = maxInput ? (parseInt(maxInput.value) || 0) : (parseInt(curInput?.dataset?.max) || 0);
            let curVal = curInput ? (parseInt(curInput.value) || 0) : ((m.spellSlots && m.spellSlots[lvlKey]?.current) || 0);
            if (curVal > 0) {
                curVal -= 1;
                if (curInput) curInput.value = curVal;
                syncSlotsState(lvlKey, curVal, defaultMax);
            }
        }
    }

    function rollNpcSpell(level, idx, type, customCastLvl = null, targetSpell = null, rollOpts = {}) {
        const m = currentMonster;
        if (!m) return;
        const sp = targetSpell || getSpellFromMonster(m, level, idx);
        if (!sp) return;
        const visibility = typeof getVisibilitySetting === 'function' ? getVisibilitySetting() : 'public';

        if (rollOpts && rollOpts.expend !== false && (type === 'roll' || type === 'damage')) {
            expendNpcSpellResource(m, sp, customCastLvl || level);
        }

        if (window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
            window.VTTSpellManager.rollSpell(sp, level, m, {
                type: type,
                castLvl: customCastLvl,
                visibility: visibility
            });
            return;
        }
    }

// ─── Public API ───────────────────────────────────────────────────────────
    const api = {
        openSheet,
        saveAndRenderNpcSpells,
        openPanel,
        minimizePanel,
        openEditModal,
        resetSheet,
        getLinkedCharacterId: () => linkedCharacterId,
        getCurrentMonster: () => currentMonster
    };
    window.vttCreatureSheetAPI = api;
    return api;
}
