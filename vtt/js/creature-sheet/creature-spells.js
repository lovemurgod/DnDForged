// ForgeDVTT Creature Sheet — Spells Subsystem
// Handles creature spell slots, spellcasting trait extraction, slot matrix parsing, spell cards, and upcasting.

import {
    toSpellTitleCase,
    injectDiceChips,
    formatRawEntry,
    evaluateDiceHelper,
    getProfBonus,
    parse5eMarkup
} from './creature-parser.js';

export function resolveSpellcastingType(sc, m = null) {
    if (!sc) return 'slot';
    const t = (sc.type || '').toLowerCase();
    if (t === 'slot' || t === 'pact' || t === 'innate' || t === 'custom') {
        return t;
    }
    const scName = sc.name || '';
    const headerText = Array.isArray(sc.headerEntries) ? sc.headerEntries.join(' ') : sc.header || '';
    const hasWillOrDaily = Boolean(
        (sc.will && sc.will.length > 0) ||
        (sc.daily && Object.keys(sc.daily).length > 0) ||
        (sc.atWill && sc.atWill.length > 0) ||
        (sc.innateObj?.will && sc.innateObj.will.length > 0) ||
        (sc.innateObj?.daily && Object.keys(sc.innateObj.daily).length > 0)
    );
    const hasSlotsMatrix = Boolean(
        sc.spellsByLevel ||
        (sc.spells &&
            Object.keys(sc.spells).some(
                (k) =>
                    k !== '0' &&
                    (Array.isArray(sc.spells[k])
                        ? sc.spells[k].length > 0
                        : sc.spells[k]?.slots || sc.spells[k]?.spells?.length)
            )) ||
        (sc.spellsObj &&
            Object.keys(sc.spellsObj).some(
                (k) => k !== 'cantrip' && Array.isArray(sc.spellsObj[k]) && sc.spellsObj[k].length > 0
            ))
    );

    if (
        t === 'innate' ||
        /innate|psionic/i.test(scName) ||
        /innate\s+spellcasting/i.test(headerText) ||
        (hasWillOrDaily && !hasSlotsMatrix)
    ) {
        return 'innate';
    }
    if (
        t === 'pact' ||
        /pact\s+magic/i.test(scName) ||
        (/warlock/i.test(headerText) && /short\s+or\s+long\s+rest/i.test(headerText))
    ) {
        return 'pact';
    }
    return 'slot';
}

export function get5eSlotsForCaster(type, level) {
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

export function showVttPrompt(title, defaultValue, callback) {
    if (typeof window !== 'undefined' && typeof window.showVttPrompt === 'function' && window.showVttPrompt !== showVttPrompt) {
        return window.showVttPrompt(title, defaultValue, callback);
    }
    if (typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
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
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
        cleanup();
        callback(null);
    });

    okBtn.addEventListener('click', () => {
        const val = input.value.trim();
        cleanup();
        callback(val);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = input.value.trim();
            cleanup();
            callback(val);
        } else if (e.key === 'Escape') {
            cleanup();
            callback(null);
        }
    });
}

export function syncSlotsState(level, curVal, maxVal, ctx) {
    const currentMonster = ctx.getMonster ? ctx.getMonster() : null;
    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;

    if (currentMonster) {
        currentMonster.slots = currentMonster.slots || {};
        currentMonster.slots[level] = { current: curVal, max: maxVal };
        currentMonster.spellSlots = currentMonster.spellSlots || {};
        currentMonster.spellSlots[level] = { current: curVal, max: maxVal };
    }
    if (linkedTokenId && typeof window !== 'undefined' && window.VTT && window.VTT.socket) {
        const canvasEngine = window.VTT.canvasEngine;
        if (canvasEngine) {
            const allTokens = canvasEngine.getTokens();
            const currentMapId =
                (canvasEngine.currentMap && canvasEngine.currentMap.id) ||
                (typeof canvasEngine.getCurrentMapId === 'function' ? canvasEngine.getCurrentMapId() : null);
            if (allTokens[linkedTokenId]) {
                allTokens[linkedTokenId].spellSlots = allTokens[linkedTokenId].spellSlots || {};
                allTokens[linkedTokenId].spellSlots[level] = { current: curVal, max: maxVal };
                window.VTT.socket.emit('token:update', { mapId: currentMapId, token: allTokens[linkedTokenId] });
            }
        }
    }
    if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
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

export function wireSpellSlots(panel, m, ctx) {
    const contentEl =
        panel || (ctx.getContentEl ? ctx.getContentEl() : document.getElementById('vtt-creature-sheet-panel'));
    if (!contentEl) return;

    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;

    let savedSlots = {};
    if (linkedTokenId && typeof window !== 'undefined' && window.VTT?.canvasEngine) {
        const token = window.VTT.canvasEngine.getTokens()[linkedTokenId];
        if (token && token.spellSlots) {
            savedSlots = token.spellSlots;
        }
    }
    if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
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

    currentInputs.forEach((input) => {
        const level = input.dataset.level;
        const maxInput = contentEl.querySelector(`.cs-spell-slot-input[data-type="max"][data-level="${level}"]`);
        const defaultMax = maxInput ? parseInt(maxInput.value) || 0 : parseInt(input.dataset.max) || 0;

        if (savedSlots[level] !== undefined) {
            const s = savedSlots[level];
            input.value = typeof s === 'object' && s.current !== undefined ? s.current : s;
        } else {
            input.value = defaultMax;
        }

        input.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 0;
            const currentMax = maxInput ? parseInt(maxInput.value) || 0 : defaultMax;
            val = Math.max(0, val);
            e.target.value = val;

            syncSlotsState(level, val, currentMax, ctx);
        });
    });

    maxInputs.forEach((input) => {
        const level = input.dataset.level;
        const curInput = contentEl.querySelector(`.cs-spell-slot-input[data-type="current"][data-level="${level}"]`);

        if (
            savedSlots[level] !== undefined &&
            typeof savedSlots[level] === 'object' &&
            savedSlots[level].max !== undefined
        ) {
            input.value = savedSlots[level].max;
        }

        input.addEventListener('change', (e) => {
            let maxVal = parseInt(e.target.value);
            if (isNaN(maxVal)) maxVal = 0;
            maxVal = Math.max(0, maxVal);
            e.target.value = maxVal;

            let curVal = curInput ? parseInt(curInput.value) || 0 : 0;
            if (curVal > maxVal) {
                curVal = maxVal;
                if (curInput) curInput.value = curVal;
            }

            syncSlotsState(level, curVal, maxVal, ctx);
        });
    });

    // Reset Slots & Usages Button
    contentEl.querySelectorAll('.cs-btn-reset-slots, #cs-reset-slots-btn').forEach((resetBtn) => {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentInputs.forEach((curInput) => {
                const level = curInput.dataset.level;
                const maxInput = contentEl.querySelector(
                    `.cs-spell-slot-input[data-type="max"][data-level="${level}"]`
                );
                const maxVal = maxInput ? parseInt(maxInput.value) || 0 : parseInt(curInput.dataset.max) || 0;
                curInput.value = maxVal;
                syncSlotsState(level, maxVal, maxVal, ctx);
            });
            const currentMonster = ctx.getMonster ? ctx.getMonster() : m;
            if (currentMonster) {
                currentMonster.dailyUsages = {};
                if (currentMonster.spells) {
                    for (let lk in currentMonster.spells) {
                        if (Array.isArray(currentMonster.spells[lk])) {
                            currentMonster.spells[lk].forEach((sp) => {
                                if (sp.usesMax !== undefined) sp.usesRemaining = sp.usesMax;
                            });
                        }
                    }
                }
                if (ctx.saveMonsterData) ctx.saveMonsterData(currentMonster);
                saveAndRenderNpcSpells(currentMonster, null, ctx);
            }
        });
    });

    // Listen for external token slot updates
    if (vtt && vtt.socket) {
        vtt.socket.on('token:updated', (data) => {
            if (linkedTokenId && data.tokens && data.tokens[linkedTokenId]) {
                const updatedSlots = data.tokens[linkedTokenId].spellSlots;
                if (updatedSlots) {
                    currentInputs.forEach((input) => {
                        const level = input.dataset.level;
                        if (updatedSlots[level] !== undefined) {
                            const s = updatedSlots[level];
                            const curVal = typeof s === 'object' && s.current !== undefined ? s.current : s;
                            if (input.value !== curVal.toString()) {
                                input.value = curVal;
                            }
                        }
                    });
                    maxInputs.forEach((input) => {
                        const level = input.dataset.level;
                        if (
                            updatedSlots[level] !== undefined &&
                            typeof updatedSlots[level] === 'object' &&
                            updatedSlots[level].max !== undefined
                        ) {
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

export function ensureSpellcastingFromTraits(m) {
    if (!m) return;
    if (
        m.spellcasting &&
        m.spellcasting.length > 0 &&
        m.spellcasting.some((sc) => sc.spellsByLevel || sc.atWill || sc.daily)
    ) {
        return;
    }
    if (!m.trait || !Array.isArray(m.trait) || m.trait.length === 0) return;

    const scTraits = m.trait.filter((t) => {
        if (!t || !t.name) return false;
        const name = t.name.toLowerCase();
        if (
            name.includes('magic weapon') ||
            name.includes('magic resistance') ||
            name.includes('magic absorption') ||
            name.includes('magic item') ||
            name.includes('magic sensitivity') ||
            name.includes('magic awareness')
        ) {
            return false;
        }
        return /(?:innate\s+)?spellcasting|psionics/i.test(t.name);
    });
    if (scTraits.length === 0) return;

    m.spellcasting = m.spellcasting && Array.isArray(m.spellcasting) ? m.spellcasting : [];

    scTraits.forEach((trait) => {
        if (m.spellcasting.some((sc) => sc.name === trait.name)) return;

        const entries = trait.entries || [];
        const flatEntries = entries.map((e) => formatRawEntry(e)).join('\n');
        const isInnate = /innate|psionic/i.test(trait.name) || /innate\s+spellcasting/i.test(flatEntries);

        const scBlock = {
            name: trait.name,
            headerEntries: entries.filter((e) => typeof e === 'string' && !/^•|^-\s|^\d\/day|^at will/i.test(e.trim())),
            spellsObj: {}
        };

        if (isInnate) {
            scBlock.type = 'innate';
            scBlock.innateObj = { will: [], daily: {} };

            entries.forEach((e) => {
                if (typeof e !== 'string') return;
                const line = e.trim();
                if (/^at\s+will\s*:/i.test(line)) {
                    const spells = line
                        .replace(/^at\s+will\s*:/i, '')
                        .split(',')
                        .map((s) => s.trim().replace(/^\{@spell ([^|}]+).*?\}/, '$1'))
                        .filter(Boolean);
                    spells.forEach((sName) => {
                        const clean = toSpellTitleCase(sName);
                        scBlock.innateObj.will.push({ name: clean, dailyKey: 'will' });
                    });
                } else {
                    const dailyMatch = line.match(/^(\d+)\/day(?:\s+each)?\s*:/i);
                    if (dailyMatch) {
                        const freq = dailyMatch[1];
                        const spells = line
                            .replace(/^(\d+)\/day(?:\s+each)?\s*:/i, '')
                            .split(',')
                            .map((s) => s.trim().replace(/^\{@spell ([^|}]+).*?\}/, '$1'))
                            .filter(Boolean);
                        scBlock.innateObj.daily[freq] = scBlock.innateObj.daily[freq] || [];
                        spells.forEach((sName) => {
                            const clean = toSpellTitleCase(sName);
                            scBlock.innateObj.daily[freq].push({
                                name: clean,
                                dailyKey: `${freq}e`,
                                usesMax: parseInt(freq)
                            });
                        });
                    }
                }
            });
        } else {
            scBlock.type = 'slot';
            scBlock.spellsByLevel = {};

            entries.forEach((e) => {
                if (typeof e !== 'string') return;
                const line = e.trim();
                const cantripMatch = line.match(/^cantrips?\s*(?:\(at will\))?\s*:/i);
                if (cantripMatch) {
                    const spells = line
                        .replace(/^cantrips?\s*(?:\(at will\))?\s*:/i, '')
                        .split(',')
                        .map((s) => s.trim().replace(/^\{@spell ([^|}]+).*?\}/, '$1'))
                        .filter(Boolean);
                    scBlock.spellsObj.cantrip = spells.map((sName) => ({ name: toSpellTitleCase(sName), level: 0 }));
                    return;
                }
                const slotMatch = line.match(/^(\d+)(?:st|nd|rd|th)\s+level\s*\((?:(\d+)\s+slots?|at will)\)\s*:/i);
                if (slotMatch) {
                    const lvl = slotMatch[1];
                    const slots = parseInt(slotMatch[2]) || 0;
                    const spells = line
                        .replace(/^(\d+)(?:st|nd|rd|th)\s+level\s*\([^)]+\)\s*:/i, '')
                        .split(',')
                        .map((s) => s.trim().replace(/^\{@spell ([^|}]+).*?\}/, '$1'))
                        .filter(Boolean);
                    const slKey = `level${lvl}`;
                    scBlock.spellsByLevel[lvl] = { slots, spells: [] };
                    scBlock.spellsObj[slKey] = spells.map((sName) => ({
                        name: toSpellTitleCase(sName),
                        level: parseInt(lvl)
                    }));
                }
            });
        }

        m.spellcasting.push(scBlock);
    });
}

export function findExistingSpell(name, id, m) {
    if (!m) return null;
    const rawName =
        typeof name === 'string'
            ? name
            : typeof name?.name === 'string'
              ? name.name
              : typeof name?.spell === 'string'
                ? name.spell
                : String(name?.name || name || '');
    const cleanName = String(rawName || '').toLowerCase().trim();
    const spellNameMatches = (s) => {
        if (!s) return false;
        if (id && s.id === id) return true;
        const sRawName =
            typeof s === 'string'
                ? s
                : typeof s.name === 'string'
                  ? s.name
                  : typeof s.name?.name === 'string'
                    ? s.name.name
                    : typeof s.name?.spell === 'string'
                      ? s.name.spell
                      : String(s.name?.name || s.name || s || '');
        return cleanName && sRawName && String(sRawName).toLowerCase().trim() === cleanName;
    };

    if (m.spellcasting) {
        for (const blk of m.spellcasting) {
            if (blk.spellsObj) {
                for (let lk in blk.spellsObj) {
                    const found = (blk.spellsObj[lk] || []).find(spellNameMatches);
                    if (found) return found;
                }
            }
            const willList = blk.innateObj?.will || blk.will || blk.atWill;
            if (Array.isArray(willList)) {
                const found = willList.find(spellNameMatches);
                if (found) return found;
            }
            const dailyObj = blk.innateObj?.daily || blk.daily;
            if (dailyObj && typeof dailyObj === 'object') {
                for (let dk in dailyObj) {
                    if (Array.isArray(dailyObj[dk])) {
                        const found = dailyObj[dk].find(spellNameMatches);
                        if (found) return found;
                    }
                }
            }
        }
    }
    if (m.spells) {
        for (let lk in m.spells) {
            const found = (m.spells[lk] || []).find(spellNameMatches);
            if (found) return found;
        }
    }
    return null;
}

export function ensureNpcSpells(m) {
    if (!m) return {};
    ensureSpellcastingFromTraits(m);

    let spells = {
        cantrip: [],
        level1: [],
        level2: [],
        level3: [],
        level4: [],
        level5: [],
        level6: [],
        level7: [],
        level8: [],
        level9: []
    };
    m.dailyUsages = m.dailyUsages || {};

    if (m.spellcasting && Array.isArray(m.spellcasting)) {
        m.spellcasting.forEach((sc, blockIdx) => {
            const blockId = sc.id || `sc_${blockIdx}`;
            sc.id = blockId;
            sc.spellsObj = sc.spellsObj || {
                cantrip: [],
                level1: [],
                level2: [],
                level3: [],
                level4: [],
                level5: [],
                level6: [],
                level7: [],
                level8: [],
                level9: []
            };

            // Cantrips
            const rawCantrips =
                (sc.spellsByLevel && sc.spellsByLevel['0'] && Array.isArray(sc.spellsByLevel['0'].spells) && sc.spellsByLevel['0'].spells.length > 0)
                    ? sc.spellsByLevel['0'].spells
                    : (sc.spells && sc.spells['0'] && Array.isArray(sc.spells['0'].spells) && sc.spells['0'].spells.length > 0)
                        ? sc.spells['0'].spells
                        : (sc.spells && Array.isArray(sc.spells['0']) && sc.spells['0'].length > 0)
                            ? sc.spells['0']
                            : (sc.spellsObj && Array.isArray(sc.spellsObj.cantrip))
                                ? sc.spellsObj.cantrip
                                : [];

            rawCantrips.forEach((spName, sIdx) => {
                const cleanNameStr =
                    typeof spName === 'string'
                        ? spName.replace(/{@spell ([^|}]+).*?}/, '$1')
                        : typeof spName?.name === 'string'
                          ? spName.name
                          : typeof spName?.spell === 'string'
                            ? spName.spell
                            : String(spName?.name || spName?.spell || 'Unknown');
                const spellId = typeof spName === 'object' ? spName?.id : null;
                const existing = findExistingSpell(cleanNameStr, spellId, m);
                const spObj = existing || {
                    id: spellId || `sp_${blockId}_0_${sIdx}`,
                    name: toSpellTitleCase(cleanNameStr),
                    level: 0,
                    blockId: blockId,
                    ...(typeof spName === 'object' ? spName : {})
                };
                spells.cantrip.push(spObj);
                if (!sc.spellsObj.cantrip.some((s) => (s.id && s.id === spObj.id) || (s.name && s.name.toLowerCase() === spObj.name.toLowerCase()))) {
                    sc.spellsObj.cantrip.push(spObj);
                }
            });

            // Leveled spells (1-9)
            for (let i = 1; i <= 9; i++) {
                const slKey = `level${i}`;
                const iStr = i.toString();
                const rawLeveled =
                    (sc.spellsByLevel && sc.spellsByLevel[iStr] && Array.isArray(sc.spellsByLevel[iStr].spells) && sc.spellsByLevel[iStr].spells.length > 0)
                        ? sc.spellsByLevel[iStr].spells
                        : (sc.spells && sc.spells[iStr] && Array.isArray(sc.spells[iStr].spells) && sc.spells[iStr].spells.length > 0)
                            ? sc.spells[iStr].spells
                            : (sc.spells && Array.isArray(sc.spells[iStr]) && sc.spells[iStr].length > 0)
                                ? sc.spells[iStr]
                                : (sc.spellsObj && Array.isArray(sc.spellsObj[slKey]))
                                    ? sc.spellsObj[slKey]
                                    : [];

                rawLeveled.forEach((spName, sIdx) => {
                    const cleanNameStr =
                        typeof spName === 'string'
                            ? spName.replace(/{@spell ([^|}]+).*?}/, '$1')
                            : typeof spName?.name === 'string'
                              ? spName.name
                              : typeof spName?.spell === 'string'
                                ? spName.spell
                                : String(spName?.name || spName?.spell || 'Unknown');
                    const spellId = typeof spName === 'object' ? spName?.id : null;
                    const existing = findExistingSpell(cleanNameStr, spellId, m);
                    const spObj = existing || {
                        id: spellId || `sp_${blockId}_${i}_${sIdx}`,
                        name: toSpellTitleCase(cleanNameStr),
                        level: i,
                        blockId: blockId,
                        ...(typeof spName === 'object' ? spName : {})
                    };
                    spells[slKey].push(spObj);
                    if (!sc.spellsObj[slKey].some((s) => (s.id && s.id === spObj.id) || (s.name && s.name.toLowerCase() === spObj.name.toLowerCase()))) {
                        sc.spellsObj[slKey].push(spObj);
                    }
                });
            }

            // Innate Spells (At will & daily)
            const willList = sc.innateObj?.will || sc.will || sc.atWill;
            if (Array.isArray(willList)) {
                willList.forEach((sp, sIdx) => {
                    const sName =
                        typeof sp === 'string'
                            ? sp.replace(/{@spell ([^|}]+).*?}/, '$1')
                            : typeof sp?.name === 'string'
                              ? sp.name
                              : String(sp?.name || 'Unknown');
                    const existing = findExistingSpell(sName, sp?.id, m);
                    const spObj = existing || {
                        id: sp?.id || `sp_${blockId}_will_${sIdx}`,
                        name: toSpellTitleCase(sName),
                        dailyKey: 'will',
                        blockId: blockId,
                        ...(typeof sp === 'object' ? sp : {})
                    };
                    spells.cantrip.push(spObj);
                });
            }

            const dailyObj = sc.innateObj?.daily || sc.daily;
            if (dailyObj && typeof dailyObj === 'object') {
                for (let dk in dailyObj) {
                    const freq = parseInt(dk) || 1;
                    const dList = dailyObj[dk];
                    if (Array.isArray(dList)) {
                        dList.forEach((sp, sIdx) => {
                            const sName =
                                typeof sp === 'string'
                                    ? sp.replace(/{@spell ([^|}]+).*?}/, '$1')
                                    : typeof sp?.name === 'string'
                                      ? sp.name
                                      : String(sp?.name || 'Unknown');
                            const existing = findExistingSpell(sName, sp?.id, m);
                            const spObj = existing || {
                                id: sp?.id || `sp_${blockId}_daily_${dk}_${sIdx}`,
                                name: toSpellTitleCase(sName),
                                dailyKey: `${freq}e`,
                                usesMax: freq,
                                blockId: blockId,
                                ...(typeof sp === 'object' ? sp : {})
                            };
                            spells.level1.push(spObj);
                        });
                    }
                }
            }
        });
    }

    m.spells = spells;
    return m.spells;
}

export function getMaxSlotsForLevel(m, slKey, sc = null) {
    if (!slKey || slKey === 'cantrip') return 0;
    const lvlNum = slKey.replace('level', '');

    if (sc) {
        if (sc.spellsByLevel && sc.spellsByLevel[lvlNum] && sc.spellsByLevel[lvlNum].slots !== undefined) {
            return parseInt(sc.spellsByLevel[lvlNum].slots) || 0;
        }
        if (sc.spells && sc.spells[lvlNum] && sc.spells[lvlNum].slots !== undefined) {
            return parseInt(sc.spells[lvlNum].slots) || 0;
        }
        if (sc.slots && sc.slots[slKey] && sc.slots[slKey].max !== undefined) {
            return parseInt(sc.slots[slKey].max) || 0;
        }
    }

    if (m.spellcasting) {
        for (const blk of m.spellcasting) {
            if (blk.spellsByLevel && blk.spellsByLevel[lvlNum] && blk.spellsByLevel[lvlNum].slots !== undefined) {
                return parseInt(blk.spellsByLevel[lvlNum].slots) || 0;
            }
            if (blk.spells && blk.spells[lvlNum] && blk.spells[lvlNum].slots !== undefined) {
                return parseInt(blk.spells[lvlNum].slots) || 0;
            }
            if (blk.slots && blk.slots[slKey] && blk.slots[slKey].max !== undefined) {
                return parseInt(blk.slots[slKey].max) || 0;
            }
        }
    }

    if (m.slots && m.slots[slKey]) {
        return typeof m.slots[slKey] === 'object' ? m.slots[slKey].max || 0 : parseInt(m.slots[slKey]) || 0;
    }
    if (m.spellSlots && m.spellSlots[slKey]) {
        return typeof m.spellSlots[slKey] === 'object'
            ? m.spellSlots[slKey].max || 0
            : parseInt(m.spellSlots[slKey]) || 0;
    }

    return 0;
}

export function getSpellFromMonster(
    m,
    level,
    idx,
    spellId = null,
    blockId = null,
    sectionKey = null,
    spellName = null
) {
    if (!m) return null;
    const cleanName = spellName
        ? String(spellName)
              .replace(/\{@spell ([^|}]+).*?\}/gi, '$1')
              .replace(/\s*\[.*?\]$/, '')
              .toLowerCase()
              .trim()
        : '';

    if (spellId && m.spellcasting) {
        for (const sc of m.spellcasting) {
            if (sc.innateObj) {
                const foundWill = (sc.innateObj.will || []).find((s) => s.id === spellId || s.spellId === spellId);
                if (foundWill) return foundWill;
                for (const k in sc.innateObj.daily) {
                    const foundDaily = (sc.innateObj.daily[k] || []).find(
                        (s) => s.id === spellId || s.spellId === spellId
                    );
                    if (foundDaily) return foundDaily;
                }
            }
            if (sc.spellsObj) {
                for (const k in sc.spellsObj) {
                    const found = (sc.spellsObj[k] || []).find((s) => s.id === spellId || s.spellId === spellId);
                    if (found) return found;
                }
            }
        }
    }

    if (blockId && m.spellcasting) {
        const sc = m.spellcasting.find((b) => b.id === blockId);
        if (sc) {
            if (sectionKey === 'will' && sc.innateObj?.will && idx !== null && sc.innateObj.will[idx]) {
                return sc.innateObj.will[idx];
            }
            if (
                sectionKey &&
                sc.innateObj?.daily?.[sectionKey] &&
                idx !== null &&
                sc.innateObj.daily[sectionKey][idx]
            ) {
                return sc.innateObj.daily[sectionKey][idx];
            }
            if (sc.spellsObj?.[level] && idx !== null && sc.spellsObj[level][idx]) {
                return sc.spellsObj[level][idx];
            }
        }
    }

    if (m.spells && m.spells[level] && idx !== null && m.spells[level][idx]) {
        return m.spells[level][idx];
    }

    if (cleanName) {
        return findExistingSpell(cleanName, spellId, m);
    }

    return null;
}

export function renderSingleSpellRowHtml(
    sp,
    slKey,
    idx,
    allowEdit = false,
    blockId = '',
    spellId = '',
    sectionKey = ''
) {
    const spId = spellId || sp?.id || sp?.spellId || '';
    let rawHtml = '';
    if (typeof window !== 'undefined' && window.VTTSpellManager && window.VTTSpellManager.renderSpellRowHtml) {
        rawHtml = window.VTTSpellManager.renderSpellRowHtml(sp, slKey, idx, { allowEdit, classPrefix: 'cs-spell-' });
    } else if (
        typeof window !== 'undefined' &&
        window.vttPlayerSheetAPI &&
        window.vttPlayerSheetAPI.renderSpellRowHtml
    ) {
        rawHtml = window.vttPlayerSheetAPI.renderSpellRowHtml(sp, slKey, idx, false);
        rawHtml = rawHtml.replace(/pc-spell-/g, 'cs-spell-');
        if (!allowEdit) {
            rawHtml = rawHtml.replace(/<button class="[^"]*cs-spell-edit[^"]*"[\s\S]*?<\/button>/gi, '');
            rawHtml = rawHtml.replace(/<div class="cs-spell-drag-handle"[\s\S]*?<\/div>/gi, '');
        }
    } else {
        let spName = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp?.name || sp?.spell || 'Unknown');
        spName = toSpellTitleCase(spName);
        return `<div class="cs-spell-item" data-block-id="${blockId}" data-spell-id="${spId}" data-section-key="${sectionKey}" data-level="${slKey}" data-idx="${idx}">${spName}</div>`;
    }

    if (rawHtml) {
        rawHtml = rawHtml.replace(
            /(class="[^"]*cs-spell-item[^"]*")/i,
            `$1 data-block-id="${blockId}" data-spell-id="${spId}" data-section-key="${sectionKey}"`
        );
        rawHtml = rawHtml.replace(
            /(class="[^"]*cs-spell-edit[^"]*")/i,
            `$1 data-block-id="${blockId}" data-spell-id="${spId}" data-section-key="${sectionKey}"`
        );
    }
    return rawHtml;
}

export function buildSpellcastingHtml(m, linkedCharacterId = null) {
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
            const scName = String(sc.name || 'Spellcasting');
            const abilityStr = String(sc.ability || 'INT').toUpperCase();
            const pb = getProfBonus(m.cr ? (m.cr.cr || m.cr) : '0');
            const abKey = sc.ability ? String(sc.ability).toLowerCase() : 'int';
            const abScore = m[abKey] || 10;
            const abMod = Math.floor((abScore - 10) / 2);
            const dcVal = sc.dc !== undefined ? sc.dc : 8 + pb + abMod;
            const atkVal = sc.atkMod !== undefined ? sc.atkMod : pb + abMod;
            const casterLvlVal = sc.casterLevel !== undefined ? sc.casterLevel : m.casterLevel || 0;
            const resolvedBlockType = resolveSpellcastingType(sc, m);
            const isInnateType = resolvedBlockType === 'innate';
            const willList = sc.innateObj?.will || sc.will || sc.atWill || [];
            const dailyObj = sc.innateObj?.daily || sc.daily || {};
            const hasWill = Array.isArray(willList) && willList.length > 0;
            const hasDaily =
                dailyObj && typeof dailyObj === 'object' &&
                Object.keys(dailyObj).some((k) => Array.isArray(dailyObj[k]) && dailyObj[k].length > 0);
            const hasWillOrDaily = hasWill || hasDaily;

            const scSpellsObj =
                sc.spellsObj ||
                (m.spellcasting.length === 1 ? spellsObj : null) || {
                    cantrip: [],
                    level1: [],
                    level2: [],
                    level3: [],
                    level4: [],
                    level5: [],
                    level6: [],
                    level7: [],
                    level8: [],
                    level9: []
                };
            const hasSlotsOrLeveledSpells = Boolean(
                sc.spellsByLevel ||
                    (sc.spells &&
                        Object.keys(sc.spells).some(
                            (k) =>
                                k !== '0' &&
                                (Array.isArray(sc.spells[k])
                                    ? sc.spells[k].length > 0
                                    : sc.spells[k]?.slots || sc.spells[k]?.spells?.length)
                        )) ||
                    spellLevels.some(
                        (sl) =>
                            sl.key !== 'cantrip' &&
                            ((sc.spellsObj && sc.spellsObj[sl.key]?.length > 0) ||
                                getMaxSlotsForLevel(m, sl.key, sc) > 0)
                    )
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

            // Distinct Action Cost Badges
            let actionBadge = '';
            if (sc.displayAs === 'bonus' || /bonus action/i.test(scName)) {
                actionBadge = `<span class="badge" style="background:rgba(255,165,0,0.18); color:#ffaa00; border:1px solid rgba(255,165,0,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-bolt" style="margin-right:3px;"></i>Bonus Action</span>`;
            } else if (sc.displayAs === 'reaction' || /reaction/i.test(scName)) {
                actionBadge = `<span class="badge" style="background:rgba(70,130,180,0.2); color:#87ceeb; border:1px solid rgba(70,130,180,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-shield-halved" style="margin-right:3px;"></i>Reaction</span>`;
            } else if (sc.displayAs === 'legendary') {
                actionBadge = `<span class="badge" style="background:rgba(220,20,60,0.2); color:#ff6b81; border:1px solid rgba(220,20,60,0.3); font-size:0.75rem; padding:2px 7px; border-radius:4px;"><i class="fa-solid fa-crown" style="margin-right:3px;"></i>Legendary</span>`;
            }

            const hEntries = sc.headerEntries ? sc.headerEntries.map((e) => formatRawEntry(e)).join('<br>') : '';
            const fEntries = sc.footerEntries ? '<br>' + sc.footerEntries.map((e) => formatRawEntry(e)).join('<br>') : '';
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

            // At Will group
            if (hasWill || (allowEdit && (isInnateType || !hasSlotsOrLeveledSpells))) {
                html += `
                    <div class="cs-spell-page" data-block-id="${sc.id}" style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                            <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base);"><i class="fa-solid fa-infinity" style="margin-right:4px;"></i> At Will</span>
                            ${allowEdit ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="cantrip" data-block-id="${sc.id}" data-section-key="will"><i class="fa-solid fa-plus"></i> Add Spell</button>` : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${
                                willList.length > 0
                                    ? willList
                                          .map((sp, idx) => {
                                              const spLvl = sp.level !== undefined ? (sp.level === 0 ? 'cantrip' : 'level' + sp.level) : 'cantrip';
                                              return renderSingleSpellRowHtml(sp, spLvl, idx, allowEdit, sc.id, sp.id, 'will');
                                          })
                                          .join('')
                                    : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No at-will spells added.</div>'
                            }
                        </div>
                    </div>
                `;
            }

            // Daily groups
            if (hasDaily || (allowEdit && (isInnateType || !hasSlotsOrLeveledSpells))) {
                Object.keys(dailyObj).forEach((dayKey) => {
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
                                ${
                                    list.length > 0
                                        ? list
                                              .map((sp, idx) => {
                                                  const spId = sp.id || `sp_daily_${scIdx}_${dayKey}_${idx}`;
                                                  const spLvl = sp.level !== undefined ? (sp.level === 0 ? 'cantrip' : 'level' + sp.level) : 'level1';
                                                  const rowHtml = renderSingleSpellRowHtml(sp, spLvl, idx, allowEdit, sc.id, spId, dayKey);
                                                  const curUsages =
                                                      m.dailyUsages && m.dailyUsages[spId] !== undefined
                                                          ? m.dailyUsages[spId]
                                                          : usesMax;
                                                  let boxesHtml = '';
                                                  for (let u = 0; u < usesMax; u++) {
                                                      const checked = u < curUsages;
                                                      boxesHtml += `<i class="cs-innate-use-checkbox ${checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}" data-spell-id="${spId}" data-uses-max="${usesMax}" data-use-idx="${u}" style="cursor:pointer; color:var(--color-gold-base); font-size:1rem; margin-right:3px;" title="Daily Use ${u + 1}/${usesMax}"></i>`;
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
                                              })
                                              .join('')
                                        : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No daily spells added.</div>'
                                }
                            </div>
                        </div>
                    `;
                });
            }

            // Leveled Spells block
            if (hasSlotsOrLeveledSpells || (allowEdit && !hasWillOrDaily)) {
                spellLevels.forEach((sl) => {
                    const list = scSpellsObj[sl.key] || [];
                    if (list.length === 0 && !allowEdit && m.spellcasting.length > 1) return;

                    const maxSlots = getMaxSlotsForLevel(m, sl.key, sc);
                    const curSlots =
                        m.slots?.[sl.key]?.current ??
                        m.spellSlots?.[sl.key]?.current ??
                        maxSlots;
                    const slotTrackerHtml =
                        sl.key !== 'cantrip' && maxSlots > 0
                            ? `
                        <div class="cs-spell-level-slots" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; border:1px solid var(--color-border-subtle, #444);">
                            <span style="color:var(--color-text-muted);">Slots:</span>
                            <input type="number" class="vtt-input cs-spell-slot-input" data-level="${sl.key}" data-block-id="${sc.id}" data-type="current" data-max="${maxSlots}" value="${curSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Current Slots">
                            <span style="color:var(--color-text-muted);">/</span>
                            <input type="number" class="vtt-input cs-spell-slot-input" data-level="${sl.key}" data-block-id="${sc.id}" data-type="max" value="${maxSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Max Slots">
                        </div>
                    `
                            : '';

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
                                ${
                                    list.length > 0
                                        ? list
                                              .map((sp, idx) =>
                                                  renderSingleSpellRowHtml(
                                                      sp,
                                                      sl.key,
                                                      idx,
                                                      allowEdit,
                                                      sc.id,
                                                      sp.id || sp.spellId
                                                  )
                                              )
                                              .join('')
                                        : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No spells added.</div>'
                                }
                            </div>
                        </div>
                    `;
                });
            }

            html += `</div>`;
        });
    } else {
        spellLevels.forEach((sl) => {
            const list = spellsObj[sl.key] || [];
            const maxSlots = getMaxSlotsForLevel(m, sl.key);
            const curSlots =
                m.slots?.[sl.key]?.current ??
                m.spellSlots?.[sl.key]?.current ??
                maxSlots;
            const slotTrackerHtml =
                sl.key !== 'cantrip' && maxSlots > 0
                    ? `
                <div class="cs-spell-level-slots" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; border:1px solid var(--color-border-subtle, #444);">
                    <span style="color:var(--color-text-muted);">Slots:</span>
                    <input type="number" class="vtt-input cs-spell-slot-input" data-level="${sl.key}" data-type="current" data-max="${maxSlots}" value="${curSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Current Slots">
                    <span style="color:var(--color-text-muted);">/</span>
                    <input type="number" class="vtt-input cs-spell-slot-input" data-level="${sl.key}" data-type="max" value="${maxSlots}" min="0" style="width:36px; padding:1px 4px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle, #555); color:#fff; border-radius:3px; font-size:0.85rem;" title="Max Slots">
                </div>
            `
                    : '';

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
                        ${
                            list.length > 0
                                ? list.map((sp, idx) => renderSingleSpellRowHtml(sp, sl.key, idx, allowEdit)).join('')
                                : '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; padding:2px 0;">No spells added.</div>'
                        }
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    return html;
}

export function getCleanedSpellBody(html) {
    if (!html) return '';
    let cleaned = html;
    cleaned = cleaned.replace(/<div class="spell-meta"[^>]*>[\s\S]*?<\/div>/gi, '');
    return cleaned.trim();
}

export function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, level = null, spellOptions = null) {
    if (!containerEl) return;
    let metaHtml = '';
    let meta =
        typeof window !== 'undefined' && window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.getSpellMetaStrings
            ? window.vttPlayerSheetAPI.getSpellMetaStrings(sp || { name: spellName })
            : {};
    let lvl = meta.level || (sp?.level !== undefined ? sp.level : '');
    let school = meta.school || sp?.school || '';
    let time = meta.time || sp?.castingTime || '';
    let range = meta.range || sp?.range || '';
    let components = meta.components || sp?.components || '';
    let duration = meta.duration || sp?.duration || '';

    metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
    if (lvl !== undefined && lvl !== '')
        metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${lvl}</div>`;
    if (school)
        metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${school}</div>`;
    if (time)
        metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${time}</div>`;
    if (range)
        metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${range}</div>`;
    if (components)
        metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${components}</div>`;
    if (duration)
        metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${duration}</div>`;
    metaHtml += '</div>';

    let rawBody = sp?.description || fallbackDesc || '';
    rawBody = injectDiceChips(rawBody);

    if (!rawBody && !metaHtml) {
        containerEl.innerHTML = fallbackDesc
            ? `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>`
            : `<em>Could not find full text for ${spellName}</em>`;
    } else {
        containerEl.innerHTML = metaHtml + rawBody;
    }
}

export function extractSpellcastingStats(m) {
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
                const abMatch = header.match(
                    /ability\s+is\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i
                );
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
    if (crRaw && crRaw.cr) {
        const str = String(crRaw.cr);
        if (str.includes('/')) {
            const p = str.split('/');
            cr = parseFloat(p[0]) / (parseFloat(p[1]) || 1);
        } else {
            cr = parseFloat(str) || 0;
        }
    } else if (typeof crRaw === 'string') {
        if (crRaw.includes('/')) {
            const p = crRaw.split('/');
            cr = parseFloat(p[0]) / (parseFloat(p[1]) || 1);
        } else {
            cr = parseFloat(crRaw) || 0;
        }
    } else if (typeof crRaw === 'number') {
        cr = crRaw;
    }
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

export function ensureCreatureUpcastModal() {
    if (typeof document === 'undefined') return;
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

export function promptCreatureUpcastLevel(baseLvl, callback) {
    if (typeof document === 'undefined') return;
    ensureCreatureUpcastModal();
    const modal = document.getElementById('modal-cs-upcast-prompt');
    const overlay = document.getElementById('modal-cs-upcast-overlay');
    const select = document.getElementById('cs-upcast-prompt-level');
    if (!modal || !select) return;

    select.innerHTML = '';
    for (let i = baseLvl; i <= 9; i++) {
        select.innerHTML += `<option value="${i}">${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
    }
    modal.classList.remove('vtt-hidden');
    if (overlay) overlay.classList.remove('vtt-hidden');

    const cleanup = () => {
        modal.classList.add('vtt-hidden');
        if (overlay) overlay.classList.add('vtt-hidden');
        document.getElementById('cs-upcast-prompt-cast')?.removeEventListener('click', handleCast);
        document.getElementById('cs-upcast-prompt-cancel')?.removeEventListener('click', handleCancel);
        overlay?.removeEventListener('click', handleOverlayClick);
        if (typeof window !== 'undefined') window.removeEventListener('keydown', handleEsc);
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
    if (typeof window !== 'undefined') window.addEventListener('keydown', handleEsc);
}

export function getUpcastBonus(spData) {
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

export function parseSpellMacro(spell, stats, charName, descHtml, castLvl) {
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
            const scaleFn =
                typeof window !== 'undefined' &&
                (window.VTTSpellManager?.scaleUpcastFormula || window.scaleUpcastFormula);
            if (scaleFn) {
                const scaledStr = scaleFn(upcastBonus, extra);
                if (scaledStr) formula = `${formula} ${scaledStr}`.trim();
            } else {
                const upcastMatch = upcastBonus.match(/(?:(\d+)\s*)?[dD]\s*(\d+)/);
                if (upcastMatch) {
                    const diceCount = upcastMatch[1] ? parseInt(upcastMatch[1]) : 1;
                    const extraDice = diceCount * extra;
                    const uSize = 'd' + upcastMatch[2];
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

export function expendNpcSpellResource(m, sp, castLvl, ctx = {}) {
    if (!m || !sp) return;
    const panel = ctx.getContentEl
        ? ctx.getContentEl()
        : typeof document !== 'undefined'
          ? document.getElementById('vtt-creature-sheet-panel') || document
          : null;
    if (!panel) return;

    // 1. Daily usage (innate spell)
    if (sp.dailyKey || sp.usesMax || (sp.id && m.dailyUsages && m.dailyUsages[sp.id] !== undefined)) {
        const usesMax = sp.usesMax || 1;
        const spId = sp.id;
        m.dailyUsages = m.dailyUsages || {};
        const cur = m.dailyUsages[spId] !== undefined ? m.dailyUsages[spId] : usesMax;
        if (cur > 0) {
            m.dailyUsages[spId] = cur - 1;
            const parent = panel.querySelector(`.cs-spell-page`) || panel;
            if (parent) {
                parent.querySelectorAll(`.cs-innate-use-checkbox[data-spell-id="${spId}"]`).forEach((box, bIdx) => {
                    const checked = bIdx < m.dailyUsages[spId];
                    box.className = `cs-innate-use-checkbox ${checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}`;
                });
            }
            if (ctx.saveMonsterData) ctx.saveMonsterData(m);
            return;
        }
    }

    // 2. Leveled spell slot
    let lvlNum = null;
    if (typeof castLvl === 'number') lvlNum = castLvl;
    else if (typeof castLvl === 'string' && castLvl.startsWith('level'))
        lvlNum = parseInt(castLvl.replace('level', ''));
    else lvlNum = parseInt(castLvl);

    if (lvlNum && lvlNum >= 1 && lvlNum <= 9) {
        const lvlKey = 'level' + lvlNum;
        const curInput = panel.querySelector(`.cs-spell-slot-input[data-type="current"][data-level="${lvlKey}"]`);
        const maxInput = panel.querySelector(`.cs-spell-slot-input[data-type="max"][data-level="${lvlKey}"]`);
        const defaultMax = maxInput ? parseInt(maxInput.value) || 0 : parseInt(curInput?.dataset?.max) || 0;
        let curVal = curInput ? parseInt(curInput.value) || 0 : (m.spellSlots && m.spellSlots[lvlKey]?.current) || 0;
        if (curVal > 0) {
            curVal -= 1;
            if (curInput) curInput.value = curVal;
            syncSlotsState(lvlKey, curVal, defaultMax, ctx);
        }
    }
}

export function rollNpcSpell(level, idx, type, customCastLvl = null, targetSpell = null, rollOpts = {}, ctx = {}) {
    const m = ctx.getMonster ? ctx.getMonster() : null;
    if (!m) return;
    const sp = targetSpell || getSpellFromMonster(m, level, idx);
    if (!sp) return;
    const visibility = ctx.getVisibilitySetting ? ctx.getVisibilitySetting() : 'public';

    if (rollOpts && rollOpts.expend !== false && (type === 'roll' || type === 'damage')) {
        expendNpcSpellResource(m, sp, customCastLvl || level, ctx);
    }

    if (typeof window !== 'undefined' && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
        window.VTTSpellManager.rollSpell(sp, level, m, {
            type: type,
            castLvl: customCastLvl,
            visibility: visibility
        });
        return;
    }
}

export function extractSpellContext(el, m) {
    const row = el.closest('.cs-spell-item');
    const level = el.dataset.level || row?.dataset.level || 'cantrip';
    const idx = parseInt(el.dataset.idx !== undefined ? el.dataset.idx : row?.dataset.idx);
    const blockId = row?.dataset.blockId || el.dataset.blockId;
    const spellId = row?.dataset.spellId || el.dataset.spellId;
    const sectionKey = row?.dataset.sectionKey || el.dataset.sectionKey;
    const nameEl = row?.querySelector('.cs-spell-name');
    const spellName = nameEl ? nameEl.textContent.trim() : row?.dataset.spellName || '';

    let sp = getSpellFromMonster(m, level, idx, spellId, blockId, sectionKey, spellName);
    if (!sp && spellName) {
        sp = { name: spellName, level: level, source: m?.source };
    }
    return { level, idx, blockId, spellId, sectionKey, sp, row, spellName };
}

export async function ensureSpellIsParsed(sp, m) {
    if (!sp) return null;
    const isMonster2024 =
        m?.source === 'XMM' ||
        m?.source === 'XPHB' ||
        m?.source === 'XDMG' ||
        !!m?.is2024 ||
        (typeof m?.source === 'string' && m.source.startsWith('X'));
    const spellOptions = { is2024: isMonster2024, caster: m };
    if (typeof window !== 'undefined' && window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
        return await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
    }
    return sp;
}

export function setupCsSpellListeners(panel, m, ctx) {
    const contentEl =
        panel || (ctx.getContentEl ? ctx.getContentEl() : document.getElementById('vtt-creature-sheet-panel'));
    if (!contentEl) return;

    // Expand Spell Details
    contentEl.querySelectorAll('.cs-spell-expand-btn').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const item = e.currentTarget.closest('.cs-spell-item');
            if (!item) return;
            const details = item.querySelector('.cs-spell-details');
            const nameEl = item.querySelector('.cs-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item.dataset.spellName || 'Spell';
            const descEl = details ? details.querySelector('.cs-spell-desc') : null;
            const btnEl = e.currentTarget;

            const level = item.dataset.level || item.querySelector('[data-level]')?.dataset.level;
            const idx = item.dataset.idx !== undefined ? parseInt(item.dataset.idx) : null;
            const blockId = item.dataset.blockId;
            const spellId = item.dataset.spellId;
            const sectionKey = item.dataset.sectionKey;

            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const isMonster2024 =
                curM?.source === 'XMM' ||
                curM?.source === 'XPHB' ||
                curM?.source === 'XDMG' ||
                !!curM?.is2024 ||
                (typeof curM?.source === 'string' && curM.source.startsWith('X'));
            const spellOptions = { is2024: isMonster2024, caster: curM };

            let sp = getSpellFromMonster(curM, level, idx, spellId, blockId, sectionKey, spellName);
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

                    if (
                        sp &&
                        typeof window !== 'undefined' &&
                        window.VTTSpellManager &&
                        window.VTTSpellManager.ensureSpellIsParsed
                    ) {
                        try {
                            await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
                        } catch (err) {
                            console.warn('[VTTSpellManager] Error parsing spell:', err);
                        }
                    }
                    if (
                        typeof window !== 'undefined' &&
                        window.VTTSpellManager &&
                        window.VTTSpellManager.renderAndInjectSpell
                    ) {
                        window.VTTSpellManager.renderAndInjectSpell(
                            spellName,
                            descEl,
                            sp?.description || '',
                            sp,
                            level,
                            spellOptions
                        );
                    } else {
                        renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level, spellOptions);
                    }
                } else {
                    details.style.display = 'none';
                    if (btnEl) btnEl.classList.remove('expanded');
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            }
        })
    );

    // Ping Macro / Post Chat
    contentEl.querySelectorAll('.cs-spell-ping-macro').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const { level, idx, sp } = extractSpellContext(e.currentTarget, curM);
            if (!sp) return;
            await ensureSpellIsParsed(sp, curM);
            const isLeveled = level !== 'cantrip' && level !== 'legacy' && (sp.level === undefined || sp.level > 0);
            const upcastFn =
                typeof window !== 'undefined' &&
                (window.VTTSpellManager?.promptUpcastLevel || window.vttPlayerSheetAPI?.promptUpcastLevel);
            if (isLeveled && upcastFn) {
                const baseLvl = parseInt(String(sp.level || level).replace('level', '')) || 1;
                upcastFn(
                    baseLvl,
                    (lvl, opts) => {
                        if (lvl) rollNpcSpell(level, idx, 'roll', lvl, sp, opts, ctx);
                    },
                    { caster: curM, spell: sp, levelKey: level }
                );
            } else {
                rollNpcSpell(level, idx, 'roll', null, sp, {}, ctx);
            }
        })
    );

    contentEl.querySelectorAll('.cs-spell-macro-attack').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const { level, idx, sp } = extractSpellContext(e.currentTarget, curM);
            if (!sp) return;
            await ensureSpellIsParsed(sp, curM);
            rollNpcSpell(level, idx, 'attack', null, sp, {}, ctx);
        })
    );

    contentEl.querySelectorAll('.cs-spell-macro-save').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const { level, idx, sp } = extractSpellContext(e.currentTarget, curM);
            if (!sp) return;
            await ensureSpellIsParsed(sp, curM);
            rollNpcSpell(level, idx, 'save', null, sp, {}, ctx);
        })
    );

    contentEl.querySelectorAll('.cs-spell-macro-damage').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const { level, idx, sp } = extractSpellContext(e.currentTarget, curM);
            if (!sp) return;
            await ensureSpellIsParsed(sp, curM);
            const isLeveled = level !== 'cantrip' && level !== 'legacy' && (sp.level === undefined || sp.level > 0);
            const upcastFn =
                typeof window !== 'undefined' &&
                (window.VTTSpellManager?.promptUpcastLevel || window.vttPlayerSheetAPI?.promptUpcastLevel);
            if (isLeveled && upcastFn) {
                const baseLvl = parseInt(String(sp.level || level).replace('level', '')) || 1;
                upcastFn(
                    baseLvl,
                    (lvl, opts) => {
                        if (lvl) rollNpcSpell(level, idx, 'damage', lvl, sp, opts, ctx);
                    },
                    { caster: curM, spell: sp, levelKey: level }
                );
            } else {
                rollNpcSpell(level, idx, 'damage', null, sp, {}, ctx);
            }
        })
    );

    contentEl.querySelectorAll('.cs-spell-post-chat').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const { level, sp, spellName } = extractSpellContext(e.currentTarget, curM);
            if (!sp && !spellName) return;
            const spellObj = sp || { name: spellName, level: level, source: curM?.source };

            await ensureSpellIsParsed(spellObj, curM);

            const visibility = ctx.getVisibilitySetting ? ctx.getVisibilitySetting() : 'public';
            const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;
            if (typeof window !== 'undefined' && window.VTTSpellManager && window.VTTSpellManager.postSpellToChat) {
                window.VTTSpellManager.postSpellToChat(spellObj, level, curM?.name || 'Creature', visibility);
            } else if (vtt && vtt.socket) {
                const meta =
                    typeof window !== 'undefined' && window.vttPlayerSheetAPI
                        ? window.vttPlayerSheetAPI.getSpellMetaStrings(spellObj, level)
                        : {};
                let bodyText = spellObj.description || '';
                bodyText = injectDiceChips(bodyText);
                const msgObj = {
                    text: `pings ${spellObj.name}`,
                    abilityCard: {
                        creatureName: curM?.name || 'Creature',
                        abilityName: spellObj.name,
                        text: bodyText,
                        ...meta
                    }
                };
                if (visibility === 'private' || visibility === 'gm') {
                    msgObj.to = vtt.username;
                    vtt.socket.emit('chat:whisper', msgObj);
                } else {
                    vtt.socket.emit('chat:msg', msgObj);
                }
            }
        })
    );

    // Add Spell Modal
    contentEl.querySelectorAll('.cs-btn-add-spell, .btn-add-spell').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            if (!curM) return;
            const level = e.currentTarget.dataset.level || 'cantrip';
            const blockId = e.currentTarget.dataset.blockId || null;
            const sectionKey = e.currentTarget.dataset.sectionKey || null;
            if (typeof window !== 'undefined' && window.VTTSpellManager) {
                window.VTTSpellManager.openModal(
                    level,
                    -1,
                    curM,
                    (updatedMonster) => {
                        if (ctx.setMonster) ctx.setMonster(updatedMonster);
                        saveAndRenderNpcSpells(updatedMonster, null, ctx);
                    },
                    {
                        blockId,
                        sectionKey
                    }
                );
            }
        })
    );

    // Edit Spell Modal
    contentEl.querySelectorAll('.cs-spell-edit').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            if (!curM) return;

            const { level, idx, blockId, spellId, sectionKey, sp } = extractSpellContext(e.currentTarget, curM);
            if (!sp) return;
            await ensureSpellIsParsed(sp, curM);

            if (typeof window !== 'undefined' && window.VTTSpellManager) {
                window.VTTSpellManager.openModal(
                    level,
                    idx,
                    curM,
                    (updatedMonster) => {
                        if (ctx.setMonster) ctx.setMonster(updatedMonster);
                        saveAndRenderNpcSpells(updatedMonster, null, ctx);
                    },
                    {
                        targetSpell: sp,
                        blockId,
                        sectionKey,
                        spellId,
                        onDelete: (monster, target) => {
                            if (blockId && monster.spellcasting) {
                                const sc = monster.spellcasting.find((b) => b.id === blockId);
                                if (sc) {
                                    if (sectionKey === 'will' && sc.innateObj?.will) {
                                        sc.innateObj.will = sc.innateObj.will.filter(
                                            (s) => s !== target && s.id !== target.id
                                        );
                                        if (sc.will)
                                            sc.will = sc.will.filter(
                                                (s) =>
                                                    (typeof s === 'string' ? s.toLowerCase() : s.id) !==
                                                    (target.name?.toLowerCase() || target.id)
                                            );
                                    } else if (sectionKey && sc.innateObj?.daily?.[sectionKey]) {
                                        sc.innateObj.daily[sectionKey] = sc.innateObj.daily[sectionKey].filter(
                                            (s) => s !== target && s.id !== target.id
                                        );
                                        if (sc.daily?.[sectionKey])
                                            sc.daily[sectionKey] = sc.daily[sectionKey].filter(
                                                (s) =>
                                                    (typeof s === 'string' ? s.toLowerCase() : s.id) !==
                                                    (target.name?.toLowerCase() || target.id)
                                            );
                                    } else if (sc.spellsObj?.[level]) {
                                        sc.spellsObj[level] = sc.spellsObj[level].filter(
                                            (s) => s !== target && s.id !== target.id
                                        );
                                    }
                                }
                            }
                            if (monster.spells?.[level]) {
                                monster.spells[level] = monster.spells[level].filter(
                                    (s) => s !== target && s.id !== target.id
                                );
                            }
                        }
                    }
                );
            }
        })
    );

    contentEl.querySelectorAll('.cs-spell-prep-toggle').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const { level, sp, row } = extractSpellContext(btn, curM);
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

            const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
            if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
                const char = window.VTT.campaignState.characters[linkedCharacterId];
                if (char) {
                    char.monsterData = curM;
                    window.VTT.socket.emit('character:update', { character: char });
                }
            } else if (typeof window !== 'undefined' && window.VTT?.currentToken) {
                window.VTT.currentToken.monsterData = curM;
                const curMapId =
                    window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
                window.VTT.socket.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
            }
        })
    );

    contentEl.querySelectorAll('.cs-innate-use-checkbox').forEach((cb) =>
        cb.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curM = ctx.getMonster ? ctx.getMonster() : m;
            const spId = e.currentTarget.dataset.spellId;
            const usesMax = parseInt(e.currentTarget.dataset.usesMax) || 1;
            const useIdx = parseInt(e.currentTarget.dataset.useIdx) || 0;
            if (!curM || !spId) return;

            curM.dailyUsages = curM.dailyUsages || {};
            const cur = curM.dailyUsages[spId] !== undefined ? curM.dailyUsages[spId] : usesMax;

            let nextVal = useIdx + 1 === cur ? useIdx : useIdx + 1;
            curM.dailyUsages[spId] = Math.max(0, Math.min(usesMax, nextVal));

            const parent = e.currentTarget.closest('.cs-spell-page') || e.currentTarget.parentElement;
            if (parent) {
                parent.querySelectorAll(`.cs-innate-use-checkbox[data-spell-id="${spId}"]`).forEach((box, bIdx) => {
                    const checked = bIdx < curM.dailyUsages[spId];
                    box.className = `cs-innate-use-checkbox ${checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}`;
                });
            }

            const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
            if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
                const char = window.VTT.campaignState.characters[linkedCharacterId];
                if (char) {
                    char.monsterData = curM;
                    window.VTT.socket.emit('character:update', { character: char });
                }
            } else if (typeof window !== 'undefined' && window.VTT?.currentToken) {
                window.VTT.currentToken.monsterData = curM;
                const curMapId =
                    window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
                window.VTT.socket.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
            }
        })
    );
}

export function saveAndRenderNpcSpells(m, spellData = null, ctx = {}) {
    const curM = m || (ctx.getMonster ? ctx.getMonster() : null);
    if (!curM) return;
    if (ctx.setMonster) ctx.setMonster(curM);

    ensureNpcSpells(curM);

    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
    if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
        const char = window.VTT.campaignState.characters[linkedCharacterId];
        if (char) {
            char.monsterData = curM;
            char.spells = curM.spells;
            window.VTT.socket.emit('character:update', { character: char });
        }
    } else if (typeof window !== 'undefined' && window.VTT?.currentToken) {
        window.VTT.currentToken.monsterData = curM;
        window.VTT.currentToken.spells = curM.spells;
        const curMapId =
            window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
        window.VTT.socket.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
    }

    const spellsHtml = buildSpellcastingHtml(curM, linkedCharacterId);
    if (typeof document !== 'undefined') {
        const tabSpells = document.getElementById('cs-tab-spells');
        if (tabSpells) {
            tabSpells.innerHTML = spellsHtml;
            wireSpellSlots(tabSpells, curM, ctx);
            setupCsSpellListeners(tabSpells, curM, ctx);
        }
    }
}
