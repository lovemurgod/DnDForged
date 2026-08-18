let sharedSpellCache = null;
let pSpellPromise = null;
let racesDataCache = null;

const AOE_LABEL_MAP = {
    'Y': 'Cylinder',
    'R': 'Circle / Radius',
    'Cone': 'Cone',
    'Line': 'Line',
    'Sphere': 'Sphere',
    'Cube': 'Cube',
    'Wall': 'Wall',
    'Hemisphere': 'Hemisphere',
    'Single Target': 'Single Target',
    'Multiple Targets': 'Multiple Targets'
};

async function fetchAllRaces() {
    if (racesDataCache) return racesDataCache;
    try {
        const res = await fetch('/data/races.json');
        const json = await res.json();
        racesDataCache = json.race || [];
        return racesDataCache;
    } catch(e) {
        return [];
    }
}

if (typeof window !== 'undefined') {
    window.VTTSpellManager = window.VTTSpellManager || {
        loadSpells: () => loadSpells(),
        cleanSpellBodyHtml: (html) => cleanSpellBodyHtml(html),
        getSpellCache: () => sharedSpellCache,
        setSpellCache: (cache) => { sharedSpellCache = cache; },
        getSpellMetaStrings: (sp, slKey) => getSpellMetaStrings(sp, slKey),
        renderAndInjectSpell: (spellName, containerEl, fallbackDesc, sp, slKey) => renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey),
        renderSpellRowHtml: (sp, slKey, idx, options) => renderSpellRowHtml(sp, slKey, idx, options),
        ensureSpellIsParsed: (sp) => ensureSpellIsParsed(sp),
        postSpellToChat: (sp, slKey, creatureName, visibility) => postSpellToChat(sp, slKey, creatureName, visibility),
        promptUpcastLevel: (baseLvl, callback) => promptUpcastLevel(baseLvl, callback),
        rollSpell: (sp, slKey, casterObj, options) => rollSpell(sp, slKey, casterObj, options)
    };
}

export async function loadSpells() {
    if (sharedSpellCache) return sharedSpellCache;
    if (pSpellPromise) return pSpellPromise;
    pSpellPromise = fetch('/data/spells-normalized.json')
        .then(res => res.json())
        .then(spells => {
            sharedSpellCache = spells;
            if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.setSpellCache) {
                window.vttPlayerSheetAPI.setSpellCache(spells);
            }
            return spells;
        }).catch(async err => {
            if (window.DataUtil && window.DataUtil.spell) {
                const spells = await window.DataUtil.spell.pLoadAll();
                sharedSpellCache = spells;
                if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.setSpellCache) {
                    window.vttPlayerSheetAPI.setSpellCache(spells);
                }
                return spells;
            }
            pSpellPromise = null;
            throw err;
        });
    return pSpellPromise;
}

export function cleanSpellBodyHtml(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    // Wrap in table/tbody if html contains <tr> so browser DOM parser preserves <tr> and <td> nodes
    if (typeof html === 'string' && (html.includes('<tr') || html.includes('<td') || html.includes('<th'))) {
        temp.innerHTML = `<table><tbody>${html}</tbody></table>`;
    } else {
        temp.innerHTML = html;
    }

    // 1. Remove existing .spell-meta containers
    temp.querySelectorAll('.spell-meta').forEach(el => el.remove());

    // 2. Remove title header rows and source wrappers
    temp.querySelectorAll('.ve-stats__th-name, .rd-spell__name, h1.ve-stats__h-name, tr.text-sub-header, .ve-stats__wrp-h-source').forEach(el => {
        const row = el.closest('tr') || el;
        if (temp.contains(row)) row.remove();
    });

    // 3. Remove divider rows and source footers
    temp.querySelectorAll('tr.ve-h-divider, tr.rd__b-divider, .vtt-spell-source-footer, .ve-rd__stats-name-page').forEach(el => {
        const row = el.closest('tr') || el;
        if (temp.contains(row)) row.remove();
    });

    // 4. Target table rows (tr) containing level/school subtitle, metadata headers, or page source footers
    const trs = Array.from(temp.querySelectorAll('tr'));
    trs.forEach(tr => {
        if (!temp.contains(tr)) return;
        const text = (tr.textContent || '').trim();

        // Level/School subtitle row (e.g. "3rd-level evocation", "Evocation Cantrip", "Level 1 Abjuration")
        const hasI = tr.querySelector('i') !== null;
        const isLevelSchool = hasI && (
            /(?:abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)/i.test(text) ||
            /(?:\d+(?:st|nd|rd|th)-level|cantrip|level\s*\d+)/i.test(text)
        ) && !text.includes('You ') && !text.includes('This spell');

        // Metadata row (Casting Time, Range, Components, Duration)
        const isMetaHeader = /(?:Casting Time|Range|Components|Duration)\s*:/i.test(text);

        // Page source footer row (e.g. "PHB p255", "PHB'14 ʟ p255", "p255")
        const isPageFooter = tr.classList.contains('ve-text-right') || (/p\d+/i.test(text) && !text.includes('You ') && text.length < 80);

        if (isLevelSchool || isMetaHeader || isPageFooter) {
            tr.remove();
        }
    });

    // 5. Check standalone block elements (td, div, p) for stray metadata headers, level/school titles, or page footers
    const blocks = Array.from(temp.querySelectorAll('td, div, p'));
    blocks.forEach(el => {
        if (!temp.contains(el)) return;
        const text = (el.textContent || '').trim();

        const isMetaHeader = /(?:Casting Time|Range|Components|Duration)\s*:/i.test(text) && !text.includes('You ') && text.length < 150;
        const isPageFooter = (/p\d+/i.test(text) && (text.includes('PHB') || text.includes('ʟ') || text.includes('Page')) && text.length < 40);
        const isLevelSchool = el.querySelector('i') && (
            /(?:abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)/i.test(text) ||
            /(?:\d+(?:st|nd|rd|th)-level|cantrip|level\s*\d+)/i.test(text)
        ) && !text.includes('You ') && text.length < 100;

        if (isMetaHeader || isPageFooter || isLevelSchool) {
            const row = el.closest('tr');
            if (row && temp.contains(row)) row.remove();
            else if (temp.contains(el)) el.remove();
        }
    });

    // 6. Convert table structures to clean div elements
    let cleanedHtml = temp.innerHTML;
    cleanedHtml = cleanedHtml.replace(/<\/?table[^>]*>/g, '')
                             .replace(/<\/?tbody[^>]*>/g, '')
                             .replace(/<\/?tr[^>]*>/g, '')
                             .replace(/<\/?td[^>]*>/g, '<div>')
                             .replace(/<\/td>/g, '</div>');

    // 7. Clean up redundant line breaks and empty container spacing
    cleanedHtml = cleanedHtml.replace(/<div>\s*(?:<br\s*\/?>\s*)*/ig, '<div>');
    cleanedHtml = cleanedHtml.replace(/(?:<br\s*\/?>\s*)+/g, '<br>');
    cleanedHtml = cleanedHtml.replace(/^(?:\s*<br\s*\/?>)+|(?:\s*<br\s*\/?>)+$/ig, '');

    return cleanedHtml.trim();
}

window.cleanSpellBodyHtml = cleanSpellBodyHtml;

export function getSpellMetaStrings(sp, slKey) {
    if (!sp || typeof sp !== 'object') return {};
    
    let school = sp.school || '';
    let levelVal = sp.level !== undefined ? sp.level : '';
    let level = '';
    if (levelVal !== undefined && levelVal !== null && levelVal !== '') {
        let levelNum = Number(levelVal);
        if (!isNaN(levelNum)) {
            level = levelNum === 0 ? 'Cantrip' : `Level ${levelNum}`;
        } else {
            level = String(levelVal);
        }
    } else if (slKey) {
        if (slKey === 'cantrip') level = 'Cantrip';
        else if (typeof slKey === 'string' && slKey.startsWith('level')) {
            const num = slKey.replace('level', '');
            level = `Level ${num}`;
        } else {
            level = String(slKey);
        }
    }

    let time = sp.castingTime || sp.time || '';
    let range = sp.range || '';
    let components = sp.components || '';
    let duration = sp.duration || '';

    return { school, level, time, range, components, duration };
}

export function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey) {
    if (!containerEl) return;
    let meta = getSpellMetaStrings(sp || { name: spellName }, slKey);
    
    let metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
    if (meta.level) metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${meta.level}</div>`;
    if (meta.school) metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${meta.school}</div>`;
    if (meta.time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${meta.time}</div>`;
    if (meta.range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${meta.range}</div>`;
    if (meta.components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${meta.components}</div>`;
    if (meta.duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${meta.duration}</div>`;
    metaHtml += '</div>';

    let rawBody = sp?.description || fallbackDesc || '';
    if (typeof cleanSpellBodyHtml === 'function') {
        rawBody = cleanSpellBodyHtml(rawBody);
    }
    if (typeof window.injectDiceChips === 'function') {
        rawBody = window.injectDiceChips(rawBody);
    }

    if (!rawBody && !meta.school && !meta.time && !meta.range && !meta.components && !meta.duration) {
        containerEl.innerHTML = fallbackDesc ? `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>` : `<em>Could not find full text for ${spellName}</em>`;
    } else {
        containerEl.innerHTML = metaHtml + rawBody;
    }
}

export function renderSpellRowHtml(sp, slKey, idx, options = {}) {
    if (!sp) return '';
    const allowEdit = options.allowEdit !== false;
    const isAllTab = !!options.isAllTab;
    const prefix = options.classPrefix || 'pc-spell-';
    
    const spName = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp?.name || 'Unknown');
    const isPrepared = typeof sp === 'object' && sp !== null ? sp.prepared !== false : true;
    const opacity = (!isPrepared && slKey !== 'cantrip' && slKey !== 'legacy') ? 'opacity: 0.6;' : '';
    let badges = '';
    const spText = typeof sp === 'object' && sp !== null ? JSON.stringify(sp).toLowerCase() : String(spName).toLowerCase();
    let isConcentration = typeof sp === 'object' && sp !== null ? sp.concentration : undefined;
    let isRitual = typeof sp === 'object' && sp !== null ? sp.ritual : undefined;

    if (isConcentration === undefined) {
        isConcentration = !!(
            (typeof sp === 'object' && sp !== null && sp.concentration) ||
            (typeof sp === 'object' && sp !== null && typeof sp.duration === 'string' && sp.duration.toLowerCase().includes('concentration')) ||
            (typeof sp === 'object' && sp !== null && Array.isArray(sp.duration) && sp.duration.some(d => d.concentration)) ||
            spText.includes("concentration")
        );
    }
    if (isRitual === undefined) {
        isRitual = !!(
            (typeof sp === 'object' && sp !== null && sp.ritual) ||
            (typeof sp === 'object' && sp !== null && sp.meta && sp.meta.ritual) ||
            (typeof sp === 'object' && sp !== null && typeof sp.components === 'string' && sp.components.toLowerCase().includes('r')) ||
            spText.includes("ritual")
        );
    }

    if (isConcentration) {
        badges += `<span class="badge badge-c" style="background:#f44336; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Concentration">C</span>`;
    }
    if (isRitual) {
        badges += `<span class="badge badge-r" style="background:#2196f3; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Ritual">R</span>`;
    }

    const attrName = spName.toLowerCase().replace(/"/g, '&quot;');
    const editBtnHtml = allowEdit ? `<button class="btn btn-xxs btn-secondary ${prefix}edit" data-level="${slKey}" data-idx="${idx}"><i class="fa-solid fa-pen"></i></button>` : '';

    return `
        <div class="spell-row ${prefix === 'cs-spell-' ? 'cs-spell-item' : 'pc-spell-item'} glassmorphism" data-spell-name="${attrName}" data-level="${slKey}" data-idx="${idx}" data-prepared="${isPrepared}" draggable="${allowEdit}" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s; ${opacity}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:6px;">
                    ${allowEdit ? `<div class="${prefix}drag-handle" data-level="${slKey}" data-idx="${idx}" title="Click and drag to reorder spell" style="cursor:grab; padding:2px 6px 2px 2px; opacity:0.6; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="if(!this.dataset.disabled){this.style.opacity='1'; this.style.color='var(--color-gold-base)';}" onmouseout="if(!this.dataset.disabled){this.style.opacity='0.6'; this.style.color='inherit';}">
                        <i class="fa-solid fa-grip-vertical" style="font-size:0.85rem;"></i>
                    </div>` : ''}
                    <div class="${prefix}prep-toggle" data-level="${slKey}" data-idx="${idx}" style="cursor: pointer; color: var(--color-gold-base); font-size: 0.8rem; display: ${slKey === 'cantrip' || slKey === 'legacy' ? 'none' : 'block'};">
                        <i class="${isPrepared ? 'fa-solid' : 'fa-regular'} fa-circle"></i>
                    </div>
                    <div class="${prefix}expand-btn" title="Expand Details" style="cursor: pointer; color: var(--color-text-muted); font-size: 0.7rem;">
                        <i class="fa-solid fa-scroll"></i>
                        <i class="fa-solid fa-chevron-right" style="transition:transform 0.2s;"></i>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <div class="${prefix}post-chat" data-level="${slKey}" data-idx="${idx}" style="cursor:pointer;" title="Post Spellcard to Chat">
                            <i class="fa-solid fa-wand-magic-sparkles text-gradient-gold"></i>
                        </div>
                        <div class="${prefix}ping-macro" data-level="${slKey}" data-idx="${idx}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary);" title="Roll Spell">
                            <span class="${prefix}name">${spName}</span>${badges}
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    ${editBtnHtml}
                </div>
            </div>
            <div class="${prefix}details" style="display: none; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.8rem;">
                <div class="${prefix}desc"><em>Loading spell details...</em></div>
            </div>
        </div>
    `;
}

export async function ensureSpellIsParsed(sp) {
    if (!sp || typeof sp !== 'object') return null;
    if (sp.macroPopulated) return sp;
    
    const spells = await loadSpells();
    if (spells && sp.name) {
        const spData = spells.find(s => s.name.toLowerCase().trim() === sp.name.toLowerCase().trim());
        if (spData) {
            if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.parseSpellToMacro) {
                window.vttPlayerSheetAPI.parseSpellToMacro(spData, sp);
            }
            sp.macroPopulated = true;
        }
    }
    return sp;
}

export function postSpellToChat(sp, slKey, creatureName = 'Creature', visibility = 'public') {
    if (!sp) return;
    const meta = getSpellMetaStrings(sp, slKey);

    let metaHtml = '';
    if (meta.level || meta.school || meta.time || meta.range || meta.components || meta.duration) {
        metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
        if (meta.level) metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${meta.level}</div>`;
        if (meta.school) metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${meta.school}</div>`;
        if (meta.time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${meta.time}</div>`;
        if (meta.range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${meta.range}</div>`;
        if (meta.components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${meta.components}</div>`;
        if (meta.duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${meta.duration}</div>`;
        metaHtml += '</div>';
    }

    let bodyText = sp.description || '';
    if (typeof cleanSpellBodyHtml === 'function') {
        bodyText = cleanSpellBodyHtml(bodyText);
    }
    if (typeof window.injectDiceChips === 'function') {
        bodyText = window.injectDiceChips(bodyText);
    }

    const spName = sp.name || 'Spell';
    const msgObj = {
        text: `pings ${spName}`,
        abilityCard: {
            creatureName: creatureName,
            abilityName: spName,
            text: metaHtml + bodyText,
            ...meta
        }
    };

    const vttObj = activeVtt || window.VTT || window.vtt;
    const socket = vttObj?.socket;
    const username = vttObj?.username || '';

    if (socket) {
        if (visibility === 'private' || visibility === 'gm') {
            msgObj.to = username;
            socket.emit('chat:whisper', msgObj);
        } else {
            socket.emit('chat:msg', msgObj);
        }
    } else {
        console.error('[SpellManager] Socket not found for postSpellToChat');
    }
}

export function promptUpcastLevel(baseLvl, callback) {
    if (typeof ensureSpellModalsExist === 'function') ensureSpellModalsExist();
    const modal = document.getElementById('modal-spell-upcast-prompt');
    const select = document.getElementById('upcast-prompt-level');
    if (!modal || !select) {
        if (callback) callback(baseLvl);
        return;
    }
    select.innerHTML = '';
    for (let i = baseLvl; i <= 9; i++) {
        select.innerHTML += `<option value="${i}">${i}${i===1?'st':i===2?'nd':i===3?'rd':'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
    }
    modal.classList.remove('vtt-hidden');
    
    const handleCast = () => {
        cleanup();
        if (callback) callback(parseInt(select.value) || baseLvl);
    };
    const handleCancel = () => {
        cleanup();
        if (callback) callback(null);
    };
    const cleanup = () => {
        modal.classList.add('vtt-hidden');
        document.getElementById('upcast-prompt-cast')?.removeEventListener('click', handleCast);
        document.getElementById('upcast-prompt-cancel')?.removeEventListener('click', handleCancel);
    };
    
    document.getElementById('upcast-prompt-cast')?.addEventListener('click', handleCast);
    document.getElementById('upcast-prompt-cancel')?.addEventListener('click', handleCancel);
}

export function rollSpell(sp, slKey, casterObj = {}, options = {}) {
    if (!sp) return;
    const type = options.type || 'roll'; // 'roll', 'attack', 'save', 'damage'
    const customCastLvl = options.castLvl !== undefined ? options.castLvl : null;
    const visibility = options.visibility || 'public';
    const casterName = casterObj.name || 'Caster';

    // 1. Resolve caster statistics & ability mods
    const getAbilityMod = (ab) => {
        if (!ab) return 0;
        const key = ab.toLowerCase();
        const score = casterObj[key] !== undefined ? casterObj[key] : (casterObj.stats ? casterObj.stats[key] : 10);
        return Math.floor(((parseInt(score) || 10) - 10) / 2);
    };

    const getProfBonus = (crOrLvl) => {
        const val = parseFloat(crOrLvl) || 0;
        if (val < 5) return 2;
        if (val < 9) return 3;
        if (val < 13) return 4;
        if (val < 17) return 5;
        if (val < 21) return 6;
        if (val < 25) return 7;
        if (val < 29) return 8;
        return 9;
    };

    const crOrLvl = casterObj.cr ? (casterObj.cr.cr || casterObj.cr) : (casterObj.level || 1);
    const pb = casterObj.proficiencyBonus !== undefined ? casterObj.proficiencyBonus : getProfBonus(crOrLvl);

    // Spellcasting ability determination
    let abilityToUse = sp.ability || (casterObj.spellcastingAbility ? casterObj.spellcastingAbility.toLowerCase() : null);
    if (!abilityToUse && casterObj.spellcasting && Array.isArray(casterObj.spellcasting) && casterObj.spellcasting.length > 0) {
        abilityToUse = casterObj.spellcasting[0].ability;
    }
    if (!abilityToUse) abilityToUse = 'int';
    abilityToUse = abilityToUse.toLowerCase();
    const spellCastingMod = getAbilityMod(abilityToUse);

    const baseLvl = slKey === 'cantrip' || slKey === 'legacy' ? 0 : parseInt(String(slKey).replace('level', '')) || 0;
    const castLvl = customCastLvl !== null ? customCastLvl : baseLvl;

    let atkRoll = null;
    let saveInfo = null;
    let dmgRolls = [];

    // 2. Attack Roll (ONLY IF SPELL HAS AN ATTACK)
    const isAttackSpell = Boolean(
        (sp.attackStat && sp.attackStat !== 'none' && sp.attackStat !== '') ||
        sp.attackBonus ||
        sp.isAttack
    );

    if ((type === 'roll' || type === 'attack') && isAttackSpell) {
        let formula = "1d20";
        if (sp.attackBonus) {
            const bonusStr = String(sp.attackBonus).trim();
            formula += bonusStr.startsWith('+') || bonusStr.startsWith('-') ? bonusStr : ` + ${bonusStr}`;
        } else if (sp.atkMod !== undefined) {
            const sign = sp.atkMod >= 0 ? '+' : '';
            formula += ` ${sign}${sp.atkMod}`;
        } else {
            const mod = sp.attackStat === 'spell' || !sp.attackStat ? spellCastingMod : getAbilityMod(sp.attackStat);
            formula += ` + ${mod}`;
            if (sp.attackProf !== false) formula += ` + ${pb}`;
            if (sp.attackExtra) formula += ` + ${sp.attackExtra}`;
        }
        if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.simulateRoll) {
            atkRoll = window.vttPlayerSheetAPI.simulateRoll(formula);
        } else {
            const r = Math.floor(Math.random() * 20) + 1;
            atkRoll = { total: r, rolls: [r], formula };
        }
    }

    // 3. Save DC (ONLY IF SPELL HAS A SAVE)
    if ((type === 'roll' || type === 'save') && sp.saveAbility) {
        let dc = 10;
        if (sp.saveDcCustom) {
            dc = sp.saveDcCustom;
        } else if (sp.dc !== undefined) {
            dc = sp.dc;
        } else {
            const stat = sp.saveDcStat === 'spell' || !sp.saveDcStat ? spellCastingMod : getAbilityMod(sp.saveDcStat);
            const prof = sp.saveDcProf !== false ? pb : 0;
            dc = 8 + prof + stat + (sp.saveDcExtra || 0);
        }
        saveInfo = { ability: sp.saveAbility.toUpperCase(), dc: dc };
    }

    // 4. Damage Calculation (Cantrip scaling & Upcasting)
    if ((type === 'roll' || type === 'damage') && sp.damageList && sp.damageList.length > 0) {
        let dList = JSON.parse(JSON.stringify(sp.damageList));
        let casterLvl = casterObj.level || (casterObj.casterLevel !== undefined ? casterObj.casterLevel : (casterObj.spellcasterLevel || 1));

        if (baseLvl === 0 && sp.cantripScale) {
            let cCount = casterLvl >= 17 ? 4 : casterLvl >= 11 ? 3 : casterLvl >= 5 ? 2 : 1;
            for (let d of dList) {
                if (d.formula && d.formula.match(/(?:\d+\s*)?[dD]\s*\d+/)) {
                    d.formula = d.formula.replace(/^(\d+)\s*([dD]\s*\d+)/, (m, countStr, die) => {
                        const count = parseInt(countStr);
                        if (count === 0) {
                            const extraDice = cCount - 1;
                            return extraDice > 0 ? `${extraDice}${die}` : '0';
                        }
                        return `${cCount * count}${die}`;
                    });
                }
            }
        } else if (castLvl > baseLvl && sp.upcastBonus) {
            const step = sp.upcastScaleStep || 1;
            const extra = Math.floor((castLvl - baseLvl) / step);
            if (extra > 0) {
                const upcastMatch = sp.upcastBonus.match(/(?:(\d+)\s*)?[dD]\s*(\d+)/);
                if (upcastMatch) {
                    const diceCount = upcastMatch[1] ? parseInt(upcastMatch[1]) : 1;
                    const uSize = "d" + upcastMatch[2];
                    let merged = false;
                    for (let d of dList) {
                        const diceRegex = new RegExp(`(?:(\\d+)\\s*)?[dD]\\s*${upcastMatch[2]}\\b`, 'i');
                        let mMatch = d.formula.match(diceRegex);
                        if (mMatch) {
                            const baseCount = mMatch[1] ? parseInt(mMatch[1]) : 1;
                            d.formula = d.formula.replace(diceRegex, `${baseCount + (diceCount * extra)}${uSize}`);
                            merged = true;
                            break;
                        }
                    }
                    if (!merged) {
                        dList[0].formula += ` + ${diceCount * extra}${uSize}`;
                    }
                } else if (!isNaN(parseInt(sp.upcastBonus))) {
                    dList[0].formula += ` + ${parseInt(sp.upcastBonus) * extra}`;
                }
            }
        }

        let isCrit = atkRoll && atkRoll.isCritSuccess;
        dList.forEach(d => {
            let dform = d.formula || '';
            if (isCrit) {
                dform = dform.replace(/(?:(\d+)\s*)?[dD]\s*(\d+)/gi, (m, count, faces) => `${(count ? parseInt(count) : 1) * 2}d${faces}`);
            }
            if (d.stat && d.stat !== 'none' && d.stat !== '') {
                const mod = d.stat === 'spell' ? spellCastingMod : getAbilityMod(d.stat);
                dform += ` ${mod >= 0 ? '+' : ''}${mod}[${d.stat.toUpperCase()}]`;
            }
            if (d.custom && d.custom.trim() !== '') {
                let c = d.custom.trim();
                let cleanC = c.startsWith('+') || c.startsWith('-') ? c : '+' + c;
                dform += ` ${cleanC}[Custom]`;
            }
            if (d.prof) dform += ` + ${pb}[Prof]`;
            if (d.extra) dform += ` + ${d.extra}[Extra]`;
            
            let res = null;
            if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.simulateRoll) {
                res = window.vttPlayerSheetAPI.simulateRoll(dform);
            }
            dmgRolls.push({ formula: dform, type: d.type || 'Damage', roll: res });
        });
    }

    // 5. Build standardized macroCard payload
    const meta = getSpellMetaStrings(sp, slKey);
    let cardTitle = sp.name;
    if (castLvl && castLvl > baseLvl) cardTitle += ` (Level ${castLvl})`;
    if (type === 'attack') cardTitle += ' (Spell Attack)';
    else if (type === 'save') cardTitle += ' (Spell Save)';
    else if (type === 'damage') cardTitle += ' (Damage)';

    const card = {
        charName: casterName,
        macroName: cardTitle,
        description: sp.macroDescription || '',
        atkRoll: atkRoll,
        saveInfo: saveInfo,
        saveDc: saveInfo ? saveInfo.dc : undefined,
        saveAbility: saveInfo ? saveInfo.ability : undefined,
        dmgRolls: dmgRolls
    };

    const vttObj = activeVtt || window.VTT || window.vtt;
    const socket = vttObj?.socket;
    const username = vttObj?.username || '';

    if (socket) {
        const payload = { macroCard: card };
        if (visibility === 'private' || visibility === 'gm') {
            payload.to = username;
            socket.emit('chat:whisper', payload);
        } else {
            socket.emit('chat:msg', payload);
        }
    }
}

let activeVtt = null;

export function initVttSpellManager(vtt) {
    activeVtt = vtt;
    let spellCache = null;
    let activeSpellEditContext = { char: null, onSave: null };
    let spellBulkSelection = new Set();
    let classSet = new Set();
    let subclassSet = new Set();
    let modalSpellDamageRows = [];

    let currentChar = null;
    let saveAndEmit = null;
    let renderSheetData = null;

    function parseSpellToMacro(spData, newSpell) {
        if (!spData) return;

        newSpell.school = spData.school || newSpell.school || '';
        newSpell.castingTime = spData.castingTime || newSpell.castingTime || '';
        newSpell.range = spData.range || newSpell.range || '';
        newSpell.components = spData.components || newSpell.components || '';
        newSpell.duration = spData.duration || newSpell.duration || '';

        if (spData.concentration !== undefined) newSpell.concentration = !!spData.concentration;
        else if (spData.duration && Array.isArray(spData.duration) && spData.duration.some(d => d.concentration)) newSpell.concentration = true;
        else if (spData.meta?.concentration) newSpell.concentration = true;
        else if (newSpell.concentration === undefined) newSpell.concentration = false;

        if (spData.ritual !== undefined) newSpell.ritual = !!spData.ritual;
        else if (spData.meta?.ritual) newSpell.ritual = true;
        else if (newSpell.ritual === undefined) newSpell.ritual = false;

        newSpell.description = spData.descriptionHtml || spData.description || newSpell.description || '';

        if (spData.damageList && Array.isArray(spData.damageList) && spData.damageList.length > 0) {
            newSpell.damageList = JSON.parse(JSON.stringify(spData.damageList));
        }

        if (spData.saveAbility) {
            newSpell.saveAbility = spData.saveAbility.substring(0, 3).toUpperCase();
            newSpell.saveDcStat = "spell";
        }

        if (spData.attackStat && spData.attackStat !== 'none') {
            newSpell.attackStat = spData.attackStat;
            newSpell.attackProf = spData.attackStat === 'spell';
        }

        if (spData.upcastBonus) {
            newSpell.upcastBonus = spData.upcastBonus;
        }
        if (spData.upcastScaleStep) {
            newSpell.upcastScaleStep = spData.upcastScaleStep;
        }

        if (!spData.entries) return;

        const text = JSON.stringify(spData.entries).toLowerCase();

        if (text.includes("spell attack") || text.includes("{@atk ms}") || text.includes("{@atk rs}") || text.includes("{@atk ms,rs}")) {
            newSpell.attackStat = "spell";
            newSpell.attackProf = true;
            newSpell.attackExtra = 0;
            newSpell.attackBonus = "";
        } else if (newSpell.attackStat === undefined) {
            newSpell.attackStat = "none";
            newSpell.attackProf = false;
        }

        const saveMatch = text.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/);
        if (saveMatch && !newSpell.saveAbility) {
            newSpell.saveDcStat = "spell";
            newSpell.saveDcExtra = 0;
            newSpell.saveDcCustom = null;
            newSpell.saveAbility = saveMatch[1].substring(0, 3).toUpperCase();
        } else if (newSpell.saveDcStat === undefined) {
            newSpell.saveDcStat = "none";
            newSpell.saveAbility = "";
        }

        if (!newSpell.damageList || newSpell.damageList.length === 0) {
            const dmgRegex = /\{@damage\s+(\d+)d(\d+)[^}]*\}(?:\s*([a-z]+)\s+damage)?/gi;
            let match;
            const damageList = [];
            while ((match = dmgRegex.exec(text)) !== null) {
                let formula = "";
                let type = match[3] ? match[3].charAt(0).toUpperCase() + match[3].slice(1) : "";
                if (spData.level === 0) {
                    formula = `1d${match[2]}`;
                    newSpell.cantripScale = true;
                    damageList.push({ formula, type, id: 'dmg_' + Date.now() + Math.random() });
                    break;
                } else {
                    formula = match[1] + 'd' + match[2];
                    damageList.push({ formula, type, id: 'dmg_' + Date.now() + Math.random() });
                }
            }
            if (damageList.length > 0) newSpell.damageList = damageList;
        }

        if (!newSpell.damageList || newSpell.damageList.length === 0) {
            const rawMatch = text.match(/(\d+)d(\d+)(?:[^a-z]*([a-z]+)\s+damage)?/i);
            if (rawMatch) {
                let formula = "";
                let type = rawMatch[3] ? rawMatch[3].charAt(0).toUpperCase() + rawMatch[3].slice(1) : "";
                if (spData.level === 0) {
                    formula = `1d${rawMatch[2]}`;
                    newSpell.cantripScale = true;
                } else {
                    formula = rawMatch[1] + 'd' + rawMatch[2];
                }
                newSpell.damageList = [{ formula, type, id: 'dmg_' + Date.now() + Math.random() }];
            }
        }

        if (spData.level === 0) {
            newSpell.cantripScale = true;
            if (newSpell.damageList && newSpell.damageList.length > 0) {
                const baseList = [];
                const seenTypes = new Set();
                for (let d of newSpell.damageList) {
                    const normType = (d.type || '').toLowerCase();
                    if (!seenTypes.has(normType)) {
                        seenTypes.add(normType);
                        let baseFormula = d.formula || '';
                        baseFormula = baseFormula.replace(/(\d+)\s*([dD]\s*\d+)/, (m, count, die) => {
                            const c = parseInt(count);
                            return c > 1 ? `1${die}` : m;
                        });
                        baseList.push({ ...d, formula: baseFormula });
                    }
                }
                const spName = (spData.name || '').toLowerCase();
                if (spName.includes('booming blade')) {
                    newSpell.damageList = [
                        { formula: '0d8', type: 'Thunder', id: 'dmg_bb_hit', label: 'Hit Extra Damage' },
                        { formula: '1d8', type: 'Thunder', id: 'dmg_bb_move', label: 'Movement Damage' }
                    ];
                } else if (spName.includes('green-flame blade')) {
                    newSpell.damageList = [
                        { formula: '0d8', type: 'Fire', id: 'dmg_gfb_hit', label: 'Hit Extra Damage' },
                        { formula: '1d8', type: 'Fire', id: 'dmg_gfb_sec', label: 'Secondary Target Damage' }
                    ];
                } else if (baseList.length > 0) {
                    newSpell.damageList = baseList;
                }
            }
        }

        if (window.Renderer && spData.entries) {
            try {
                const temp = document.createElement('div');
                temp.innerHTML = window.Renderer.get().render({ entries: spData.entries });
                newSpell.description = temp.textContent || temp.innerText || "";
            } catch (e) { }
        }

        if (spData.entriesHigherLevel) {
            const hl = JSON.stringify(spData.entriesHigherLevel).toLowerCase();
            let hlMatch = hl.match(/\{@scaledamage [^|]+\|[^|]+\|([^}]+)\}/);
            if (hlMatch) {
                newSpell.upcastBonus = hlMatch[1];
            } else {
                hlMatch = hl.match(/increases by (?:\{@damage )?(\d+d\d+)/);
                if (hlMatch) {
                    newSpell.upcastBonus = hlMatch[1];
                } else {
                    hlMatch = hl.match(/(\d+)d(\d+)/);
                    if (hlMatch) {
                        newSpell.upcastBonus = hlMatch[1] + 'd' + hlMatch[2];
                    }
                }
            }
        }
    }

    function ensureSpellModalsExist() {
        if (document.getElementById('pc-spell-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <!-- Spell Modal Overlay -->
            <div id="pc-spell-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            
            <!-- Main Add Spell Modal -->
            <div id="pc-spell-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:920px; max-width:95vw; height:85vh; display:flex; flex-direction:column; box-shadow:0 6px 20px rgba(0,0,0,0.7);">
                <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3);">
                    <h3 style="margin:0; color:var(--color-gold-base); font-size:1.1rem; display:flex; align-items:center; gap:8px;" id="pc-spell-modal-title"><i class="fa-solid fa-book-bookmark"></i> Add Spell</h3>
                    <button id="modal-spell-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                
                <input type="hidden" id="modal-spell-level" value="">
                <input type="hidden" id="modal-spell-idx" value="-1">

                <div style="display:flex; border-bottom:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.2);">
                    <button class="btn btn-xs pc-spell-modal-tab active" data-tab="search" style="flex:1; border-radius:0; border:none; border-bottom:2px solid var(--color-gold-base); background:transparent; color:var(--color-text-primary); padding:8px 12px; font-weight:600;"><i class="fa-solid fa-database"></i> Search Spell Database</button>
                    <button class="btn btn-xs pc-spell-modal-tab" data-tab="custom" style="flex:1; border-radius:0; border:none; border-bottom:2px solid transparent; background:transparent; color:var(--color-text-muted); padding:8px 12px; font-weight:600;"><i class="fa-solid fa-wand-magic"></i> Custom Spell Editor</button>
                </div>

                <!-- Search Tab (2-Column Split Layout) -->
                <div id="pc-spell-tab-search" style="padding:14px; overflow:hidden; flex:1; display:flex; gap:16px;">
                    <!-- Left Column: Search & Selection -->
                    <div style="flex:1; display:flex; flex-direction:column; gap:10px; min-width:320px; overflow:hidden;">
                        <!-- Row 1: Full-Width Search Bar -->
                        <div style="position:relative; width:100%;">
                            <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--color-text-muted); font-size:0.85rem;"></i>
                            <input type="text" id="modal-spell-search-input" placeholder="Search 930+ spells by name..." style="width:100%; padding-left:30px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary); height:34px; font-size:0.85rem;">
                        </div>

                        <!-- Row 2: Sort & Filter Buttons -->
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <select id="modal-spell-sort" style="flex:1; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary); height:32px; font-size:0.8rem; padding:0 8px; font-weight:600; cursor:pointer;" title="Sort Spells">
                                <option value="name_asc">Sort: Name (A → Z)</option>
                                <option value="name_desc">Sort: Name (Z → A)</option>
                                <option value="level_asc">Sort: Level (0 → 9)</option>
                                <option value="level_desc">Sort: Level (9 → 0)</option>
                                <option value="school_asc">Sort: School (A → Z)</option>
                                <option value="time">Sort: Casting Time</option>
                                <option value="range">Sort: Range</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" id="modal-spell-filter-btn" style="white-space:nowrap; display:flex; align-items:center; gap:6px; height:32px;"><i class="fa-solid fa-sliders"></i> Filters</button>
                        </div>

                        <!-- Row 3: Spell Level & School Dropdowns (Side-by-Side) -->
                        <div style="display:flex; gap:8px; align-items:center;">
                            <select id="modal-spell-quick-level" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px; padding:4px 8px; font-size:0.8rem; height:32px;">
                                <option value="">Any Level</option>
                                <option value="0">Cantrip</option>
                                <option value="1">1st Level</option>
                                <option value="2">2nd Level</option>
                                <option value="3">3rd Level</option>
                                <option value="4">4th Level</option>
                                <option value="5">5th Level</option>
                                <option value="6">6th Level</option>
                                <option value="7">7th Level</option>
                                <option value="8">8th Level</option>
                                <option value="9">9th Level</option>
                            </select>
                            <select id="modal-spell-quick-school" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px; padding:4px 8px; font-size:0.8rem; height:32px;">
                                <option value="">Any School</option>
                                <option value="Abjuration">Abjuration</option>
                                <option value="Conjuration">Conjuration</option>
                                <option value="Divination">Divination</option>
                                <option value="Enchantment">Enchantment</option>
                                <option value="Evocation">Evocation</option>
                                <option value="Illusion">Illusion</option>
                                <option value="Necromancy">Necromancy</option>
                                <option value="Transmutation">Transmutation</option>
                            </select>
                        </div>

                        <!-- Row 4: Class Pill & Checkboxes -->
                        <div id="modal-spell-quick-pills" style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.78rem; align-items:center;">
                            <button id="pill-class-toggle" data-active="true" style="background:rgba(212,175,55,0.2); border:1px solid var(--color-gold-base); color:var(--color-gold-base); border-radius:12px; padding:3px 10px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-user-shield"></i> <span id="pill-class-label">All Classes</span>
                            </button>
                            <label style="display:flex; align-items:center; gap:4px; margin:0; cursor:pointer; color:var(--color-text-muted); font-size:0.78rem;">
                                <input type="checkbox" id="modal-spell-quick-conc"> Conc
                            </label>
                            <label style="display:flex; align-items:center; gap:4px; margin:0; cursor:pointer; color:var(--color-text-muted); font-size:0.78rem;">
                                <input type="checkbox" id="modal-spell-quick-rit"> Ritual
                            </label>
                        </div>

                        <!-- Advanced Filters Drawer -->
                        <div id="modal-spell-advanced-drawer" class="vtt-hidden" style="background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px; display:flex; flex-direction:column; gap:8px; font-size:0.8rem;">
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                <div>
                                    <label style="display:block; font-size:0.7rem; color:var(--color-text-muted);">Class</label>
                                    <select id="modal-spell-filter-class" style="width:100%;"><option value="">Any Class</option></select>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.7rem; color:var(--color-text-muted);">Subclass</label>
                                    <select id="modal-spell-filter-subclass" style="width:100%;"><option value="">Any Subclass</option></select>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.7rem; color:var(--color-text-muted);">Race / Species</label>
                                    <select id="modal-spell-filter-race" style="width:100%;"><option value="">Any Race / Species</option></select>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.7rem; color:var(--color-text-muted);">Condition Applied</label>
                                    <select id="modal-spell-filter-condition" style="width:100%;"><option value="">Any Condition</option></select>
                                </div>
                                <div style="grid-column: span 2;">
                                    <label style="display:block; font-size:0.7rem; color:var(--color-text-muted);">Area of Effect</label>
                                    <select id="modal-spell-filter-area" style="width:100%;"><option value="">Any Area Shape</option></select>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                                <button class="btn btn-xs btn-secondary" id="modal-spell-filter-reset">Reset Filters</button>
                            </div>
                        </div>

                        <!-- Results List -->
                        <div id="modal-spell-search-results" style="border:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.3); border-radius:4px; flex:1; overflow-y:auto; padding:4px;">
                            <div style="padding:12px; text-align:center; color:var(--color-text-muted);">Loading spells...</div>
                        </div>
                    </div>

                    <!-- Right Column: Live Spell Preview Pane -->
                    <div id="modal-spell-preview-pane" style="flex:1.15; min-width:340px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); border-radius:6px; display:flex; flex-direction:column; overflow:hidden;">
                        <div style="padding:16px; flex:1; overflow-y:auto;" id="modal-spell-preview-content">
                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--color-text-muted); text-align:center; padding:24px;">
                                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:2rem; margin-bottom:12px; opacity:0.4; color:var(--color-gold-base);"></i>
                                <div style="font-size:0.9rem; font-weight:600; color:var(--color-text-primary);">Select a spell to preview</div>
                                <div style="font-size:0.75rem; margin-top:4px; max-width:240px;">Click any spell in the left list to view its description, stats, damage, and tags.</div>
                            </div>
                        </div>
                        <div id="modal-spell-preview-footer" class="vtt-hidden" style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.3); display:flex; justify-content:flex-end;">
                            <button class="btn btn-primary btn-sm" id="btn-import-single-spell" style="display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-plus"></i> Add Spell to Sheet</button>
                        </div>
                    </div>
                </div>

                <!-- Custom Tab -->
                <div id="pc-spell-tab-custom" class="vtt-hidden" style="padding:16px; overflow-y:auto; flex:1;">
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:2;">
                            <label>Spell Name</label>
                            <input type="text" id="modal-spell-name" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>School</label>
                            <select id="modal-spell-school" style="width:100%;">
                                <option value="">None</option>
                                <option value="Abjuration">Abjuration</option>
                                <option value="Conjuration">Conjuration</option>
                                <option value="Divination">Divination</option>
                                <option value="Enchantment">Enchantment</option>
                                <option value="Evocation">Evocation</option>
                                <option value="Illusion">Illusion</option>
                                <option value="Necromancy">Necromancy</option>
                                <option value="Transmutation">Transmutation</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Casting Time</label>
                            <input type="text" id="modal-spell-time" placeholder="e.g. 1 action" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Range</label>
                            <input type="text" id="modal-spell-range" placeholder="e.g. 120 feet" style="width:100%;">
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <div class="form-group" style="flex:1;">
                            <label>Components</label>
                            <input type="text" id="modal-spell-components" placeholder="e.g. V, S, M" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Duration</label>
                            <input type="text" id="modal-spell-duration" placeholder="e.g. 1 round" style="width:100%;">
                        </div>
                    </div>
                    <div style="display:flex; gap:16px; margin-bottom:12px; align-items:center;">
                        <div class="form-group" style="display:flex; align-items:center; gap:6px;">
                            <input type="checkbox" id="modal-spell-concentration" style="margin:0;">
                            <label for="modal-spell-concentration" style="margin:0; font-size:0.85rem; cursor:pointer;">Concentration (C)</label>
                        </div>
                        <div class="form-group" style="display:flex; align-items:center; gap:6px;">
                            <input type="checkbox" id="modal-spell-ritual" style="margin:0;">
                            <label for="modal-spell-ritual" style="margin:0; font-size:0.85rem; cursor:pointer;">Ritual (R)</label>
                        </div>
                    </div>
                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                        <div class="form-group" style="flex:1;">
                            <label>Cast Frequency / Usage</label>
                            <select id="modal-spell-uses-type" style="width:100%;">
                                <option value="slot">Standard (Slot-Based)</option>
                                <option value="at_will">At Will</option>
                                <option value="long_rest">Per Long Rest (Daily)</option>
                                <option value="short_rest">Per Short Rest</option>
                                <option value="short_long">Per Short/Long Rest</option>
                                <option value="custom">Custom Frequency</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Max Uses (per Rest/Day)</label>
                            <input type="number" id="modal-spell-uses-max" placeholder="e.g. 1, 3" min="0" style="width:100%;">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:12px;">
                        <label>Spell Description (Optional)</label>
                        <textarea id="modal-spell-desc" style="width:100%; min-height:80px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:8px; font-family:var(--font-primary); font-size:0.8rem;"></textarea>
                    </div>
                    <h4 style="margin:8px 0; color:var(--color-gold-base);">Attack & Macro Settings</h4>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Macro Description (Optional Chat Text)</label>
                        <input type="text" id="modal-spell-macro-desc" placeholder="e.g. You hurl a mote of fire." style="width:100%;">
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Attack Roll</label>
                            <select id="modal-spell-atk-stat" style="width:100%;">
                                <option value="none">None</option>
                                <option value="spell">Spellcasting Stat</option>
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Proficient</label>
                            <div style="padding-top:4px;"><input type="checkbox" id="modal-spell-atk-prof"></div>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Extra Atk Bonus</label>
                            <input type="number" id="modal-spell-atk-extra" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Custom Bonus</label>
                            <input type="text" id="modal-spell-atk-custom" placeholder="e.g. 1d4+2" style="width:100%;">
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Save DC Stat</label>
                            <select id="modal-spell-save-dc-stat" style="width:100%;">
                                <option value="none">None</option>
                                <option value="spell">Spellcasting Stat</option>
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                                <option value="custom">Custom Fixed</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Extra DC Bonus</label>
                            <input type="number" id="modal-spell-save-dc-extra" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Fixed DC</label>
                            <input type="number" id="modal-spell-save-dc-custom" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Save Type (Target)</label>
                            <select id="modal-spell-save-ability" style="width:100%;">
                                <option value="">None</option>
                                <option value="STR">STR Save</option>
                                <option value="DEX">DEX Save</option>
                                <option value="CON">CON Save</option>
                                <option value="INT">INT Save</option>
                                <option value="WIS">WIS Save</option>
                                <option value="CHA">CHA Save</option>
                            </select>
                        </div>
                    </div>
                    <div id="modal-spell-damage-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
                    <button class="btn btn-secondary btn-xxs" id="btn-add-spell-damage" style="margin-bottom:8px;">+ Add Damage Row</button>
                    <div class="form-group" style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="modal-spell-cantrip-scale">
                        <label style="margin:0;">Enable Cantrip Player Level Scaling</label>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:2;">
                            <label>Upcast Formula (Dice/Bonus)</label>
                            <input type="text" id="modal-spell-upcast" placeholder="e.g. 1d8 or 1d6" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Upcast Interval</label>
                            <select id="modal-spell-upcast-step" style="width:100%;">
                                <option value="1">Every 1 Level (Standard)</option>
                                <option value="2">Every 2 Levels (Alternate)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2);">
                    <div id="modal-spell-selection-count" style="font-size:0.8rem; color:var(--color-text-muted);">0 spells selected</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="btn btn-danger btn-sm vtt-hidden" id="modal-spell-delete" style="margin-right:16px;">Delete Spell</button>
                        <button class="btn btn-secondary btn-sm" id="modal-spell-cancel">Cancel</button>
                        <button class="btn btn-primary btn-sm" id="modal-spell-save">Bulk Add Selected (0)</button>
                    </div>
                </div>
            </div>

            <!-- Filter Modal -->
            <div id="pc-spell-filter-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1001; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Filter Spells</h3>
                    <button id="modal-spell-filter-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <div class="form-group">
                        <label>Level</label>
                        <select id="modal-spell-filter-level" style="width:100%;">
                            <option value="">Any Level</option>
                            <option value="0">Cantrip</option>
                            <option value="1">1st Level</option>
                            <option value="2">2nd Level</option>
                            <option value="3">3rd Level</option>
                            <option value="4">4th Level</option>
                            <option value="5">5th Level</option>
                            <option value="6">6th Level</option>
                            <option value="7">7th Level</option>
                            <option value="8">8th Level</option>
                            <option value="9">9th Level</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>School</label>
                        <select id="modal-spell-filter-school" style="width:100%;">
                            <option value="">Any School</option>
                            <option value="A">Abjuration</option>
                            <option value="C">Conjuration</option>
                            <option value="D">Divination</option>
                            <option value="E">Enchantment</option>
                            <option value="V">Evocation</option>
                            <option value="I">Illusion</option>
                            <option value="N">Necromancy</option>
                            <option value="T">Transmutation</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Class</label>
                        <select id="modal-spell-filter-class" style="width:100%;">
                            <option value="">Any Class</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Subclass</label>
                        <select id="modal-spell-filter-subclass" style="width:100%;">
                            <option value="">Any Subclass</option>
                        </select>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.2);">
                    <button class="btn btn-secondary btn-sm" id="modal-spell-filter-clear">Clear Filters</button>
                    <button class="btn btn-primary btn-sm" id="modal-spell-filter-apply">Apply Filters</button>
                </div>
            </div>
            
            <!-- Spell Settings Modal -->
            <div id="pc-spell-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:500px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Spell Settings & Toggles</h3>
                    <button id="modal-spell-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; gap:12px;">
                        <div class="form-group" style="flex:1;">
                            <label>Spellcasting Ability</label>
                            <select id="modal-settings-ability" style="width:100%;">
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label>Add'l Atk Mod</label>
                            <input type="number" id="modal-settings-atk" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label>Add'l DC Mod</label>
                            <input type="number" id="modal-settings-dc" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label>Add'l Dmg Mod</label>
                            <input type="number" id="modal-settings-dmg" value="0" style="width:100%;">
                        </div>
                    </div>
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0;">Toggles</h4>
                            <button id="btn-add-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                        </div>
                        <div id="modal-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                            <input type="hidden" id="modal-toggle-idx" value="-1">
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                <input type="text" id="modal-toggle-name" placeholder="Name (e.g. Bless)" style="flex:1; min-width:120px;">
                                <input type="text" id="modal-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1; min-width:100px;">
                                <select id="modal-toggle-target" style="flex:1; min-width:120px;">
                                    <option value="both">Both</option>
                                    <option value="atk">Attack</option>
                                    <option value="dc">DC (Static Only)</option>
                                    <option value="dmg">Damage</option>
                                </select>
                                <select id="modal-toggle-type" style="flex:1; min-width:120px;">
                                    <option value="">None (Base Damage)</option>
                                    <option value="Slashing">Slashing</option>
                                    <option value="Piercing">Piercing</option>
                                    <option value="Bludgeoning">Bludgeoning</option>
                                    <option value="Fire">Fire</option>
                                    <option value="Cold">Cold</option>
                                    <option value="Lightning">Lightning</option>
                                    <option value="Thunder">Thunder</option>
                                    <option value="Poison">Poison</option>
                                    <option value="Acid">Acid</option>
                                    <option value="Necrotic">Necrotic</option>
                                    <option value="Radiant">Radiant</option>
                                    <option value="Force">Force</option>
                                    <option value="Psychic">Psychic</option>
                                    <option value="Healing">Healing</option>
                                </select>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button id="modal-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                                <button id="modal-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                            </div>
                        </div>
                        <div id="modal-settings-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Toggles injected here -->
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
            </div>
            
            <!-- Attack Settings Modal -->
            <div id="pc-attack-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:500px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Attack Settings & Toggles</h3>
                    <button id="modal-attack-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <div class="form-group" style="flex:1; min-width:100px;">
                            <label>Global Atk Mod</label>
                            <input type="number" id="modal-attack-settings-atk" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:100px;">
                            <label>Global Dmg Mod</label>
                            <input type="number" id="modal-attack-settings-dmg" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:100px;">
                            <label>Global DC Mod</label>
                            <input type="number" id="modal-attack-settings-dc" value="0" style="width:100%;">
                        </div>
                    </div>
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0;">Toggles</h4>
                            <button id="btn-add-attack-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                        </div>
                        <div id="modal-attack-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                            <input type="hidden" id="modal-attack-toggle-idx" value="-1">
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                <input type="text" id="modal-attack-toggle-name" placeholder="Name (e.g. Sharpshooter)" style="flex:1; min-width:120px;">
                                <input type="text" id="modal-attack-toggle-formula" placeholder="Formula (e.g. +2)" style="flex:1; min-width:100px;">
                                <select id="modal-attack-toggle-target" style="flex:1; min-width:120px;">
                                    <option value="both">Both</option>
                                    <option value="atk">Attack</option>
                                    <option value="dmg">Damage</option>
                                    <option value="dc">DC (Static Only)</option>
                                </select>
                                <select id="modal-attack-toggle-type" style="flex:1; min-width:120px;">
                                    <option value="">None (Base Damage)</option>
                                    <option value="Slashing">Slashing</option>
                                    <option value="Piercing">Piercing</option>
                                    <option value="Bludgeoning">Bludgeoning</option>
                                    <option value="Fire">Fire</option>
                                    <option value="Cold">Cold</option>
                                    <option value="Lightning">Lightning</option>
                                    <option value="Thunder">Thunder</option>
                                    <option value="Poison">Poison</option>
                                    <option value="Acid">Acid</option>
                                    <option value="Necrotic">Necrotic</option>
                                    <option value="Radiant">Radiant</option>
                                    <option value="Force">Force</option>
                                    <option value="Psychic">Psychic</option>
                                    <option value="Healing">Healing</option>
                                </select>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button id="modal-attack-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                                <button id="modal-attack-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                            </div>
                        </div>
                        <div id="modal-attack-settings-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Toggles injected here -->
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-attack-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>

            <!-- Upcast Prompt Modal -->
            <div id="modal-spell-upcast-prompt" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:300px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <h4 style="margin:0 0 12px 0; color:var(--color-gold-base);">Cast Spell</h4>
                <div class="form-group" style="margin-bottom:16px;">
                    <label>Cast at what level?</label>
                    <select id="upcast-prompt-level" style="width:100%; padding:6px;"></select>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="upcast-prompt-cancel" class="btn btn-sm btn-secondary">Cancel</button>
                    <button id="upcast-prompt-cast" class="btn btn-sm btn-primary">Cast</button>
                </div>
            </div>
            
            <!-- Delete Prompt Modal -->
            <div id="modal-spell-delete-prompt" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1002; width:300px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <h4 style="margin:0 0 12px 0; color:var(--color-gold-base);">Delete Spell</h4>
                <div class="form-group" style="margin-bottom:16px;">
                    <label style="color:var(--color-text-primary);">Are you sure you want to delete this spell?</label>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="delete-prompt-cancel" class="btn btn-sm btn-secondary">Cancel</button>
                    <button id="delete-prompt-confirm" class="btn btn-sm btn-danger">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupSpellModalListeners();
        setupSpellSettingsListeners();
        setupAttackSettingsListeners();
    }

    function updateBulkAddButton() {
        const count = spellBulkSelection.size;
        const countEl = document.getElementById('modal-spell-selection-count');
        const saveEl = document.getElementById('modal-spell-save');
        if (countEl) countEl.textContent = `${count} spells selected`;
        if (saveEl) saveEl.textContent = `Bulk Add Selected (${count})`;
    }

    let activePreviewSpell = null;

    function renderSpellPreview(sp) {
        activePreviewSpell = sp;
        const contentEl = document.getElementById('modal-spell-preview-content');
        const footerEl = document.getElementById('modal-spell-preview-footer');
        if (!contentEl || !sp) return;

        if (footerEl) footerEl.classList.remove('vtt-hidden');

        let classesBadge = sp.classes?.length ? sp.classes.map(c => `<span style="background:rgba(212,175,55,0.15); border:1px solid var(--color-gold-base); color:var(--color-gold-base); padding:1px 6px; border-radius:10px; font-size:0.7rem; font-weight:600;">${c}</span>`).join(' ') : '';
        let tagsBadge = '';
        if (sp.areaTags?.length) tagsBadge += sp.areaTags.map(t => `<span style="background:rgba(100,150,255,0.15); border:1px solid rgba(100,150,255,0.4); color:#90caf9; padding:1px 6px; border-radius:10px; font-size:0.7rem;">${AOE_LABEL_MAP[t] || t}</span>`).join(' ');
        if (sp.miscTags?.length) tagsBadge += sp.miscTags.map(t => `<span style="background:rgba(150,255,150,0.15); border:1px solid rgba(150,255,150,0.4); color:#a5d6a7; padding:1px 6px; border-radius:10px; font-size:0.7rem;">${t}</span>`).join(' ');
        if (sp.conditionInflict?.length) tagsBadge += sp.conditionInflict.map(t => `<span style="background:rgba(255,100,100,0.15); border:1px solid rgba(255,100,100,0.4); color:#ef9a9a; padding:1px 6px; border-radius:10px; font-size:0.7rem;">${t}</span>`).join(' ');

        let atkHtml = (sp.attackStat && sp.attackStat !== 'none') ? `<span style="background:rgba(33,150,243,0.2); border:1px solid #64b5f6; color:#90caf9; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;"><i class="fa-solid fa-crosshairs"></i> Spell Attack</span>` : '';
        let saveHtml = sp.saveAbility ? `<span style="background:rgba(156,39,176,0.2); border:1px solid #ba68c8; color:#e1bee7; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;"><i class="fa-solid fa-shield"></i> DC ${sp.saveAbility.toUpperCase()} Save</span>` : '';
        let dmgHtml = sp.damage ? `<span style="background:rgba(233,30,99,0.2); border:1px solid #f48fb1; color:#f48fb1; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;"><i class="fa-solid fa-burst"></i> ${sp.damage}</span>` : '';
        let upcastHtml = sp.upcastBonus ? `<span style="background:rgba(76,175,80,0.2); border:1px solid #81c784; color:#a5d6a7; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;"><i class="fa-solid fa-circle-arrow-up"></i> Upcast: +${sp.upcastBonus} ${sp.upcastScaleStep && sp.upcastScaleStep > 1 ? `every ${sp.upcastScaleStep} lvls` : 'per lvl'}</span>` : '';

        contentEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="border-bottom:1px solid var(--color-border-subtle); padding-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <h3 style="margin:0; color:var(--color-gold-base); font-size:1.15rem;">${sp.name}</h3>
                        <span style="font-size:0.7rem; color:var(--color-text-muted); background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${sp.source} p.${sp.page || 0}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:2px;">
                        ${sp.level === 0 ? 'Cantrip' : `Level ${sp.level}`} • ${sp.school}
                    </div>
                </div>

                <div class="spell-meta-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:6px; background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; font-size:0.75rem; border:1px solid rgba(255,255,255,0.05);">
                    <div><i class="fa-solid fa-clock" style="color:var(--color-gold-base); width:14px;"></i> <strong>Time:</strong> ${sp.castingTime}</div>
                    <div><i class="fa-solid fa-ruler" style="color:var(--color-gold-base); width:14px;"></i> <strong>Range:</strong> ${sp.range}</div>
                    <div><i class="fa-solid fa-hand-sparkles" style="color:var(--color-gold-base); width:14px;"></i> <strong>Comp:</strong> ${sp.components}</div>
                    <div><i class="fa-solid fa-stopwatch" style="color:var(--color-gold-base); width:14px;"></i> <strong>Duration:</strong> ${sp.duration}</div>
                    <div><i class="fa-solid fa-brain" style="color:${sp.concentration ? '#ff9800' : 'var(--color-text-muted)'}; width:14px;"></i> <strong>Conc:</strong> ${sp.concentration ? 'Yes' : 'No'}</div>
                    <div><i class="fa-solid fa-book-open" style="color:${sp.ritual ? '#4caf50' : 'var(--color-text-muted)'}; width:14px;"></i> <strong>Ritual:</strong> ${sp.ritual ? 'Yes' : 'No'}</div>
                </div>

                ${(classesBadge || tagsBadge) ? `<div style="display:flex; flex-wrap:wrap; gap:4px;">${classesBadge} ${tagsBadge}</div>` : ''}

                ${(atkHtml || saveHtml || dmgHtml || upcastHtml) ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin:2px 0;">${atkHtml} ${saveHtml} ${dmgHtml} ${upcastHtml}</div>` : ''}

                <div style="font-size:0.8rem; line-height:1.4; color:var(--color-text-primary); border-top:1px solid var(--color-border-subtle); padding-top:8px;" class="spell-preview-description">
                    ${sp.descriptionHtml || sp.description || '<em>No description available.</em>'}
                </div>
            </div>
        `;
    }

    function populateFilterDropdowns() {
        if (!spellCache) return;
        const classSet = new Set();
        const subclassSet = new Set();
        const raceSet = new Set();
        const condSet = new Set();
        const areaSet = new Set();

        spellCache.forEach(sp => {
            if (sp.classes) sp.classes.forEach(c => classSet.add(c));
            if (sp.subclasses) sp.subclasses.forEach(sc => subclassSet.add(sc.name));
            if (sp.races) sp.races.forEach(r => raceSet.add(typeof r === 'string' ? r : r.name));
            if (sp.conditionInflict) sp.conditionInflict.forEach(c => condSet.add(c));
            if (sp.areaTags) sp.areaTags.forEach(a => areaSet.add(a));
        });

        const populateSelect = (id, set, labelMap = null) => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = select.options[0].outerHTML;
            const items = Array.from(set).map(val => ({ value: val, label: labelMap ? (labelMap[val] || val) : val }));
            items.sort((a, b) => a.label.localeCompare(b.label));
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.value;
                opt.textContent = item.label;
                select.appendChild(opt);
            });
        };

        populateSelect('modal-spell-filter-class', classSet);
        populateSelect('modal-spell-filter-subclass', subclassSet);
        populateSelect('modal-spell-filter-condition', condSet);
        populateSelect('modal-spell-filter-area', areaSet, AOE_LABEL_MAP);

        fetchAllRaces().then(races => {
            if (races && races.length) {
                races.forEach(r => {
                    if (r.name && !r._isCopy) raceSet.add(r.name);
                });
            }
            populateSelect('modal-spell-filter-race', raceSet);
        });
    }

    function renderSpellSearchList() {
        const container = document.getElementById('modal-spell-search-results');
        if (!container) return;
        if (!spellCache) {
            container.innerHTML = '<div style="padding:12px; text-align:center; color:var(--color-text-muted);">Loading spells...</div>';
            loadSpells().then(spells => {
                spellCache = spells;
                populateFilterDropdowns();
                renderSpellSearchList();
            });
            return;
        }

        const searchStr = document.getElementById('modal-spell-search-input')?.value.toLowerCase().trim() || '';
        const quickLvl = document.getElementById('modal-spell-quick-level')?.value || '';
        const quickSch = document.getElementById('modal-spell-quick-school')?.value || '';
        const quickConc = document.getElementById('modal-spell-quick-conc')?.checked || false;
        const quickRit = document.getElementById('modal-spell-quick-rit')?.checked || false;

        const filterCls = document.getElementById('modal-spell-filter-class')?.value || '';
        const filterSub = document.getElementById('modal-spell-filter-subclass')?.value || '';
        const filterRace = document.getElementById('modal-spell-filter-race')?.value || '';
        const filterCond = document.getElementById('modal-spell-filter-condition')?.value || '';
        const filterArea = document.getElementById('modal-spell-filter-area')?.value || '';
        const sortBy = document.getElementById('modal-spell-sort')?.value || 'name_asc';

        const filtered = spellCache.filter(sp => {
            if (searchStr && !(sp.name || '').toLowerCase().includes(searchStr)) return false;
            if (quickLvl !== '' && String(sp.level) !== String(quickLvl)) return false;
            if (quickSch !== '' && sp.school !== quickSch) return false;
            if (quickConc && !sp.concentration) return false;
            if (quickRit && !sp.ritual) return false;

            if (filterCls && (!sp.classes || !sp.classes.includes(filterCls))) return false;
            if (filterSub && (!sp.subclasses || !sp.subclasses.some(s => s.name === filterSub))) return false;
            if (filterRace) {
                const hasTag = sp.races && sp.races.some(r => (typeof r === 'string' ? r : r.name) === filterRace);
                const hasText = (sp.descriptionHtml || sp.description || '').toLowerCase().includes(filterRace.toLowerCase());
                if (!hasTag && !hasText) return false;
            }
            if (filterCond && (!sp.conditionInflict || !sp.conditionInflict.includes(filterCond))) return false;
            if (filterArea && (!sp.areaTags || !sp.areaTags.includes(filterArea))) return false;
            return true;
        });

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name_desc': return (b.name || '').localeCompare(a.name || '');
                case 'level_asc': return (a.level - b.level) || (a.name || '').localeCompare(b.name || '');
                case 'level_desc': return (b.level - a.level) || (a.name || '').localeCompare(b.name || '');
                case 'school_asc': return (a.school || '').localeCompare(b.school || '') || (a.name || '').localeCompare(b.name || '');
                case 'time': return (a.castingTime || '').localeCompare(b.castingTime || '') || (a.name || '').localeCompare(b.name || '');
                case 'range': return (a.range || '').localeCompare(b.range || '') || (a.name || '').localeCompare(b.name || '');
                case 'name_asc':
                default:
                    return (a.name || '').localeCompare(b.name || '');
            }
        });

        const displaySpells = filtered.slice(0, 250);
        if (displaySpells.length === 0) {
            container.innerHTML = '<div style="padding:16px; text-align:center; color:var(--color-text-muted); font-size:0.85rem;">No spells found matching filters.</div>';
            return;
        }

        let html = '';
        displaySpells.forEach(sp => {
            const isSelected = spellBulkSelection.has(sp.name);
            const isPreviewActive = activePreviewSpell && activePreviewSpell.id === sp.id;
            html += `
                <div class="spell-result-row ${isPreviewActive ? 'active-preview' : ''}" data-id="${sp.id}" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; background:${isPreviewActive ? 'rgba(212,175,55,0.15)' : 'transparent'}; border-left:${isPreviewActive ? '3px solid var(--color-gold-base)' : '3px solid transparent'}; font-size:0.8rem;">
                    <input type="checkbox" class="spell-bulk-cb" data-name="${sp.name.replace(/"/g, '&quot;')}" ${isSelected ? 'checked' : ''} style="cursor:pointer; flex-shrink:0; width:16px; height:16px; margin:0 4px 0 0;">
                    <div class="spell-row-info" style="display:flex; flex-direction:column; flex:1; min-width:0;">
                        <span style="font-weight:600; font-size:0.85rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${sp.name}</span>
                        <span style="font-size:0.7rem; color:var(--color-text-muted);">${sp.level === 0 ? 'Cantrip' : 'Lvl ' + sp.level} • ${sp.school} • ${sp.source}</span>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="font-size:0.7rem; color:var(--color-text-muted); opacity:0.6; flex-shrink:0;"></i>
                </div>
            `;
        });
        if (filtered.length > 250) {
            html += `<div style="padding:8px; text-align:center; font-size:0.75rem; color:var(--color-text-muted);">Showing 250 of ${filtered.length} results. Please refine search.</div>`;
        }
        container.innerHTML = html;

        container.querySelectorAll('.spell-result-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('spell-bulk-cb')) return;
                const spId = row.dataset.id;
                const spObj = spellCache.find(s => s.id === spId);
                if (spObj) {
                    renderSpellPreview(spObj);
                    container.querySelectorAll('.spell-result-row').forEach(r => {
                        r.style.background = 'transparent';
                        r.style.borderLeft = '3px solid transparent';
                    });
                    row.style.background = 'rgba(212,175,55,0.15)';
                    row.style.borderLeft = '3px solid var(--color-gold-base)';
                }
            });
        });

        container.querySelectorAll('.spell-bulk-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const name = e.currentTarget.dataset.name;
            if (e.currentTarget.checked) {
                spellBulkSelection.add(name);
            } else {
                spellBulkSelection.delete(name);
            }
            updateBulkAddButton();
        }));
    }

    function openSpellModal(level, idx = -1, customChar = null, onSaveCallback = null) {
        ensureSpellModalsExist();
        activeSpellEditContext = { char: customChar || currentChar, onSave: onSaveCallback };
        const lvlInput = document.getElementById('modal-spell-level');
        const idxInput = document.getElementById('modal-spell-idx');
        if (lvlInput) lvlInput.value = level;
        if (idxInput) idxInput.value = idx;

        const tabSearch = document.getElementById('pc-spell-tab-search');
        const tabCustom = document.getElementById('pc-spell-tab-custom');
        const btnSearch = document.querySelector('.pc-spell-modal-tab[data-tab="search"]');
        const btnCustom = document.querySelector('.pc-spell-modal-tab[data-tab="custom"]');

        const char = activeSpellEditContext.char;
        if (idx >= 0 && char) {
            const sp = char.spells[level][idx];
            const spData = spellCache ? spellCache.find(s => (s.name || '').toLowerCase().trim() === (sp.name || '').toLowerCase().trim()) : null;

            document.getElementById('pc-spell-modal-title').textContent = "Edit Spell";
            document.getElementById('modal-spell-name').value = sp.name || '';
            let desc = sp.description || (spData ? (spData.descriptionHtml || '') : '');
            if (desc.includes('<p>') || desc.includes('<div>')) {
                const temp = document.createElement('div');
                temp.innerHTML = desc;
                desc = temp.textContent || temp.innerText || desc;
            }
            document.getElementById('modal-spell-desc').value = desc.trim();
            
            const schoolEl = document.getElementById('modal-spell-school');
            if (schoolEl) {
                let sch = sp.school || (spData ? spData.school : '');
                const schoolMap = { 'A': 'Abjuration', 'C': 'Conjuration', 'D': 'Divination', 'E': 'Enchantment', 'V': 'Evocation', 'I': 'Illusion', 'N': 'Necromancy', 'T': 'Transmutation' };
                schoolEl.value = schoolMap[sch] || sch;
            }
            const timeEl = document.getElementById('modal-spell-time');
            if (timeEl) timeEl.value = sp.castingTime || (spData ? spData.castingTime : '');
            const rangeEl = document.getElementById('modal-spell-range');
            if (rangeEl) rangeEl.value = sp.range || (spData ? spData.range : '');
            const compEl = document.getElementById('modal-spell-components');
            if (compEl) compEl.value = sp.components || (spData ? spData.components : '');
            const durEl = document.getElementById('modal-spell-duration');
            if (durEl) durEl.value = sp.duration || (spData ? spData.duration : '');

            const concEl = document.getElementById('modal-spell-concentration');
            if (concEl) {
                concEl.checked = sp.concentration !== undefined ? !!sp.concentration : !!(spData?.concentration);
            }
            const ritEl = document.getElementById('modal-spell-ritual');
            if (ritEl) {
                ritEl.checked = sp.ritual !== undefined ? !!sp.ritual : !!(spData?.ritual);
            }

            const usesTypeEl = document.getElementById('modal-spell-uses-type');
            if (usesTypeEl) usesTypeEl.value = sp.usesType || (sp.uses === 'at_will' ? 'at_will' : (sp.usesMax ? 'long_rest' : 'slot'));
            const usesMaxEl = document.getElementById('modal-spell-uses-max');
            if (usesMaxEl) usesMaxEl.value = sp.usesMax !== undefined ? sp.usesMax : '';

            const macroDescEl = document.getElementById('modal-spell-macro-desc');
            if (macroDescEl) macroDescEl.value = sp.macroDescription || '';

            document.getElementById('modal-spell-atk-stat').value = sp.attackStat || (spData?.attackStat || 'none');
            document.getElementById('modal-spell-atk-prof').checked = sp.attackProf !== undefined ? !!sp.attackProf : (spData?.attackStat === 'spell');
            document.getElementById('modal-spell-atk-extra').value = sp.attackExtra || 0;
            document.getElementById('modal-spell-atk-custom').value = sp.attackBonus || '';
            document.getElementById('modal-spell-save-dc-stat').value = sp.saveDcStat || (spData?.saveAbility ? 'spell' : 'none');
            document.getElementById('modal-spell-save-dc-extra').value = sp.saveDcExtra || 0;
            document.getElementById('modal-spell-save-dc-custom').value = sp.saveDcCustom ?? '';
            document.getElementById('modal-spell-save-ability').value = sp.saveAbility || (spData ? (spData.saveAbility || '').substring(0, 3).toUpperCase() : '');

            let dmgList = sp.damageList || (spData ? spData.damageList : []);
            if (!dmgList || dmgList.length === 0) {
                if (sp.damage) dmgList = [{ formula: sp.damage, type: sp.damageType || '' }];
            }
            modalSpellDamageRows = JSON.parse(JSON.stringify(dmgList || []));

            const cantripScaleEl = document.getElementById('modal-spell-cantrip-scale');
            if (cantripScaleEl) cantripScaleEl.checked = sp.cantripScale === undefined ? level === 'cantrip' : sp.cantripScale;

            const deleteBtn = document.getElementById('modal-spell-delete');
            if (deleteBtn) {
                deleteBtn.classList.remove('vtt-hidden');
                deleteBtn.dataset.level = level;
                deleteBtn.dataset.idx = idx;
            }

            const upcastEl = document.getElementById('modal-spell-upcast');
            if (upcastEl) upcastEl.value = sp.upcastBonus || '';
            const upcastStepEl = document.getElementById('modal-spell-upcast-step');
            if (upcastStepEl) upcastStepEl.value = String(sp.upcastScaleStep || spData?.upcastScaleStep || 1);

            if (tabSearch) tabSearch.classList.add('vtt-hidden');
            if (tabCustom) tabCustom.classList.remove('vtt-hidden');
            if (btnSearch) { btnSearch.classList.remove('active'); btnSearch.style.borderBottomColor = 'transparent'; btnSearch.style.color = 'var(--color-text-muted)'; }
            if (btnCustom) { btnCustom.classList.add('active'); btnCustom.style.borderBottomColor = 'var(--color-gold-base)'; btnCustom.style.color = 'var(--color-text-primary)'; }
            const saveBtn = document.getElementById('modal-spell-save');
            if (saveBtn) saveBtn.textContent = "Save Changes";
        } else {
            spellBulkSelection.clear();
            const titleEl = document.getElementById('pc-spell-modal-title');
            if (titleEl) titleEl.textContent = "Add Spell";
            const nameInput = document.getElementById('modal-spell-name');
            if (nameInput) nameInput.value = '';
            const schoolInput = document.getElementById('modal-spell-school');
            if (schoolInput) schoolInput.value = '';
            const descInput = document.getElementById('modal-spell-desc');
            if (descInput) descInput.value = '';
            const concInput = document.getElementById('modal-spell-concentration');
            if (concInput) concInput.checked = false;
            const ritInput = document.getElementById('modal-spell-ritual');
            if (ritInput) ritInput.checked = false;
            const macroDescInput = document.getElementById('modal-spell-macro-desc');
            if (macroDescInput) macroDescInput.value = '';

            const atkStatInput = document.getElementById('modal-spell-atk-stat');
            if (atkStatInput) atkStatInput.value = 'none';
            const atkProfInput = document.getElementById('modal-spell-atk-prof');
            if (atkProfInput) atkProfInput.checked = false;
            const atkExtraInput = document.getElementById('modal-spell-atk-extra');
            if (atkExtraInput) atkExtraInput.value = '0';
            const atkCustomInput = document.getElementById('modal-spell-atk-custom');
            if (atkCustomInput) atkCustomInput.value = '';
            const saveDcStatInput = document.getElementById('modal-spell-save-dc-stat');
            if (saveDcStatInput) saveDcStatInput.value = 'none';
            const saveDcExtraInput = document.getElementById('modal-spell-save-dc-extra');
            if (saveDcExtraInput) saveDcExtraInput.value = '0'; const saveDcCustomInput = document.getElementById('modal-spell-save-dc-custom');
            if (saveDcCustomInput) saveDcCustomInput.value = '';
            const saveAbilityInput = document.getElementById('modal-spell-save-ability');
            if (saveAbilityInput) saveAbilityInput.value = '';
            modalSpellDamageRows = [];

            const cantripScaleEl = document.getElementById('modal-spell-cantrip-scale');
            if (cantripScaleEl) cantripScaleEl.checked = level === 'cantrip';

            const deleteBtn = document.getElementById('modal-spell-delete');
            if (deleteBtn) deleteBtn.classList.add('vtt-hidden');

            const upcastInput = document.getElementById('modal-spell-upcast');
            if (upcastInput) upcastInput.value = '';

            if (tabCustom) tabCustom.classList.add('vtt-hidden');
            if (tabSearch) tabSearch.classList.remove('vtt-hidden');
            if (btnCustom) { btnCustom.classList.remove('active'); btnCustom.style.borderColor = 'transparent'; btnCustom.style.color = 'var(--color-text-muted)'; }
            if (btnSearch) { btnSearch.classList.add('active'); btnSearch.style.borderColor = 'var(--color-gold-base)'; btnSearch.style.color = 'var(--color-text-primary)'; }
            const saveBtn = document.getElementById('modal-spell-save');
            if (saveBtn) saveBtn.textContent = "Add Spells";

            const lvlMap = { cantrip: '0', level1: '1', level2: '2', level3: '3', level4: '4', level5: '5', level6: '6', level7: '7', level8: '8', level9: '9' };
            const startingLvl = lvlMap[level] || '';
            const qlvl = document.getElementById('modal-spell-quick-level');
            if (qlvl) qlvl.value = startingLvl;
            const qsch = document.getElementById('modal-spell-quick-school');
            if (qsch) qsch.value = '';
            const qconc = document.getElementById('modal-spell-quick-conc');
            if (qconc) qconc.checked = false;
            const qrit = document.getElementById('modal-spell-quick-rit');
            if (qrit) qrit.checked = false;

            const primaryClass = char?.classes?.[0]?.name || char?.class || '';
            const pillToggle = document.getElementById('pill-class-toggle');
            const pillLabel = document.getElementById('pill-class-label');
            const classSelect = document.getElementById('modal-spell-filter-class');

            if (primaryClass && classSelect) {
                classSelect.value = primaryClass;
                if (pillLabel) pillLabel.textContent = `${primaryClass} Spells`;
                if (pillToggle) {
                    pillToggle.dataset.active = "true";
                    pillToggle.dataset.class = primaryClass;
                    pillToggle.style.background = "rgba(212,175,55,0.2)";
                    pillToggle.style.color = "var(--color-gold-base)";
                    pillToggle.style.borderColor = "var(--color-gold-base)";
                }
            } else {
                if (classSelect) classSelect.value = '';
                if (pillLabel) pillLabel.textContent = "All Classes";
                if (pillToggle) {
                    pillToggle.dataset.active = "false";
                    pillToggle.dataset.class = "";
                    pillToggle.style.background = "rgba(0,0,0,0.3)";
                    pillToggle.style.color = "var(--color-text-muted)";
                    pillToggle.style.borderColor = "var(--color-border-subtle)";
                }
            }

            const sInp = document.getElementById('modal-spell-search-input');
            if (sInp) sInp.value = '';

            activePreviewSpell = null;
            const previewContent = document.getElementById('modal-spell-preview-content');
            if (previewContent) {
                previewContent.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--color-text-muted); text-align:center; padding:24px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="font-size:2rem; margin-bottom:12px; opacity:0.4; color:var(--color-gold-base);"></i>
                        <div style="font-size:0.9rem; font-weight:600; color:var(--color-text-primary);">Select a spell to preview</div>
                        <div style="font-size:0.75rem; margin-top:4px; max-width:240px;">Click any spell in the left list to view its description, stats, damage, and tags.</div>
                    </div>
                `;
            }
            document.getElementById('modal-spell-preview-footer')?.classList.add('vtt-hidden');
            updateBulkAddButton();
            renderSpellSearchList();
        }

        renderModalSpellDamage();
        const modal = document.getElementById('pc-spell-modal');
        const overlay = document.getElementById('pc-spell-overlay');
        if (modal) modal.classList.remove('vtt-hidden');
        if (overlay) overlay.classList.remove('vtt-hidden');
    }

    function closeSpellModal() {
        document.getElementById('pc-spell-overlay')?.classList.add('vtt-hidden');
        document.getElementById('pc-spell-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-spell-filter-modal')?.classList.add('vtt-hidden');
        document.getElementById('modal-spell-delete-prompt')?.classList.add('vtt-hidden');
    }

    function renderModalSpellDamage() {
        const list = document.getElementById('modal-spell-damage-list');
        if (!list) return;
        const dmgTypes = ["Slashing", "Piercing", "Bludgeoning", "Fire", "Cold", "Lightning", "Thunder", "Poison", "Acid", "Necrotic", "Radiant", "Force", "Psychic", "Healing"];
        const statOptions = [
            { val: '', label: 'Stat (None)' },
            { val: 'spell', label: 'Spellcasting Stat' },
            { val: 'str', label: 'STR' },
            { val: 'dex', label: 'DEX' },
            { val: 'con', label: 'CON' },
            { val: 'int', label: 'INT' },
            { val: 'wis', label: 'WIS' },
            { val: 'cha', label: 'CHA' }
        ];

        list.innerHTML = modalSpellDamageRows.map((d, i) => `
            <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                <input type="text" class="modal-spell-dmg-formula" data-idx="${i}" value="${d.formula || ''}" placeholder="Formula (1d8)" style="width:26%; padding:4px; font-size:0.8rem;">
                <select class="modal-spell-dmg-type" data-idx="${i}" style="width:22%; padding:4px; font-size:0.8rem;">
                    <option value="">Type</option>
                    ${dmgTypes.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <select class="modal-spell-dmg-stat" data-idx="${i}" style="width:26%; padding:4px; font-size:0.8rem;">
                    ${statOptions.map(s => `<option value="${s.val}" ${(d.stat || '').toLowerCase() === s.val.toLowerCase() ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>
                <input type="text" class="modal-spell-dmg-custom" data-idx="${i}" value="${d.custom || ''}" placeholder="Mod (+2)" style="width:18%; padding:4px; font-size:0.8rem;">
                <button class="btn btn-xs btn-secondary modal-spell-dmg-del" data-idx="${i}" style="width:8%; padding:4px 2px;" title="Delete Row"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

        document.querySelectorAll('.modal-spell-dmg-formula').forEach(el => el.addEventListener('change', (e) => modalSpellDamageRows[e.target.dataset.idx].formula = e.target.value));
        document.querySelectorAll('.modal-spell-dmg-type').forEach(el => el.addEventListener('change', (e) => modalSpellDamageRows[e.target.dataset.idx].type = e.target.value));
        document.querySelectorAll('.modal-spell-dmg-stat').forEach(el => el.addEventListener('change', (e) => modalSpellDamageRows[e.target.dataset.idx].stat = e.target.value));
        document.querySelectorAll('.modal-spell-dmg-custom').forEach(el => el.addEventListener('change', (e) => modalSpellDamageRows[e.target.dataset.idx].custom = e.target.value));
        document.querySelectorAll('.modal-spell-dmg-del').forEach(el => el.addEventListener('click', (e) => {
            modalSpellDamageRows.splice(e.currentTarget.dataset.idx, 1);
            renderModalSpellDamage();
        }));
    }

    function setupSpellModalListeners() {
        document.getElementById('pc-spell-overlay')?.addEventListener('click', closeSpellModal);
        document.getElementById('modal-spell-close')?.addEventListener('click', closeSpellModal);
        document.getElementById('modal-spell-cancel')?.addEventListener('click', closeSpellModal);

        document.querySelectorAll('.pc-spell-modal-tab').forEach(btn => btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            const tabSearch = document.getElementById('pc-spell-tab-search');
            const tabCustom = document.getElementById('pc-spell-tab-custom');
            const btnSearch = document.querySelector('.pc-spell-modal-tab[data-tab="search"]');
            const btnCustom = document.querySelector('.pc-spell-modal-tab[data-tab="custom"]');

            if (tab === 'search') {
                if (tabCustom) tabCustom.classList.add('vtt-hidden');
                if (tabSearch) tabSearch.classList.remove('vtt-hidden');
                if (btnCustom) { btnCustom.classList.remove('active'); btnCustom.style.borderBottomColor = 'transparent'; btnCustom.style.color = 'var(--color-text-muted)'; }
                if (btnSearch) { btnSearch.classList.add('active'); btnSearch.style.borderBottomColor = 'var(--color-gold-base)'; btnSearch.style.color = 'var(--color-text-primary)'; }
                const saveBtn = document.getElementById('modal-spell-save');
                if (saveBtn) saveBtn.textContent = 'Bulk Add Selected (0)';
            } else {
                if (tabSearch) tabSearch.classList.add('vtt-hidden');
                if (tabCustom) tabCustom.classList.remove('vtt-hidden');
                if (btnSearch) { btnSearch.classList.remove('active'); btnSearch.style.borderBottomColor = 'transparent'; btnSearch.style.color = 'var(--color-text-muted)'; }
                if (btnCustom) { btnCustom.classList.add('active'); btnCustom.style.borderBottomColor = 'var(--color-gold-base)'; btnCustom.style.color = 'var(--color-text-primary)'; }
                const saveBtn = document.getElementById('modal-spell-save');
                if (saveBtn) saveBtn.textContent = document.getElementById('modal-spell-idx').value >= 0 ? 'Save Changes' : 'Add Custom Spell';
            }
        }));

        // Pill Class Toggle Button
        document.getElementById('pill-class-toggle')?.addEventListener('click', () => {
            const pillToggle = document.getElementById('pill-class-toggle');
            const pillLabel = document.getElementById('pill-class-label');
            const classSelect = document.getElementById('modal-spell-filter-class');
            const pClass = pillToggle?.dataset?.class || '';
            const isActive = pillToggle?.dataset?.active === "true";

            if (isActive) {
                pillToggle.dataset.active = "false";
                pillToggle.style.background = "rgba(0,0,0,0.3)";
                pillToggle.style.color = "var(--color-text-muted)";
                pillToggle.style.borderColor = "var(--color-border-subtle)";
                if (pillLabel) pillLabel.textContent = "All Classes";
                if (classSelect) classSelect.value = '';
            } else if (pClass) {
                pillToggle.dataset.active = "true";
                pillToggle.style.background = "rgba(212,175,55,0.2)";
                pillToggle.style.color = "var(--color-gold-base)";
                pillToggle.style.borderColor = "var(--color-gold-base)";
                if (pillLabel) pillLabel.textContent = `${pClass} Spells`;
                if (classSelect) classSelect.value = pClass;
            }
            renderSpellSearchList();
        });

        // Quick, Sort & Advanced Filter listeners
        ['modal-spell-quick-level', 'modal-spell-quick-school', 'modal-spell-quick-conc', 'modal-spell-quick-rit', 'modal-spell-search-input', 'modal-spell-sort', 'modal-spell-filter-class', 'modal-spell-filter-subclass', 'modal-spell-filter-race', 'modal-spell-filter-condition', 'modal-spell-filter-area'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', renderSpellSearchList);
            document.getElementById(id)?.addEventListener('change', renderSpellSearchList);
        });

        // Filter Drawer Toggle Button
        document.getElementById('modal-spell-filter-btn')?.addEventListener('click', () => {
            const drawer = document.getElementById('modal-spell-advanced-drawer');
            if (drawer) drawer.classList.toggle('vtt-hidden');
        });

        // Filter Reset Button
        document.getElementById('modal-spell-filter-reset')?.addEventListener('click', () => {
            ['modal-spell-filter-class', 'modal-spell-filter-subclass', 'modal-spell-filter-race', 'modal-spell-filter-condition', 'modal-spell-filter-area'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const pillToggle = document.getElementById('pill-class-toggle');
            const pillLabel = document.getElementById('pill-class-label');
            if (pillToggle) {
                pillToggle.dataset.active = "false";
                pillToggle.style.background = "rgba(0,0,0,0.3)";
                pillToggle.style.color = "var(--color-text-muted)";
                pillToggle.style.borderColor = "var(--color-border-subtle)";
                if (pillLabel) pillLabel.textContent = "All Classes";
            }
            renderSpellSearchList();
        });

        // Single Add Spell Button from Live Preview Pane
        document.getElementById('btn-import-single-spell')?.addEventListener('click', (e) => {
            if (!activePreviewSpell) return;
            const char = activeSpellEditContext && activeSpellEditContext.char ? activeSpellEditContext.char : currentChar;
            if (!char) return;
            const lvlMapInverse = { 0: 'cantrip', 1: 'level1', 2: 'level2', 3: 'level3', 4: 'level4', 5: 'level5', 6: 'level6', 7: 'level7', 8: 'level8', 9: 'level9' };
            const targetLevel = document.getElementById('modal-spell-level').value;
            const levelKey = lvlMapInverse[activePreviewSpell.level] || targetLevel || 'cantrip';

            if (!char.spells) char.spells = {};
            if (!char.spells[levelKey]) char.spells[levelKey] = [];

            if (!char.spells[levelKey].find(s => s.name === activePreviewSpell.name)) {
                const newSpell = { id: 'sp_' + Date.now() + Math.random(), name: activePreviewSpell.name, description: '', prepared: false };
                parseSpellToMacro(activePreviewSpell, newSpell);
                char.spells[levelKey].push(newSpell);

                if (activeSpellEditContext && activeSpellEditContext.onSave) {
                    activeSpellEditContext.onSave(char);
                } else if (typeof saveAndEmit === 'function' && typeof renderSheetData === 'function') {
                    saveAndEmit(char);
                    renderSheetData(char);
                }

                const btn = e.currentTarget;
                const origText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Added to Sheet!';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-success');
                setTimeout(() => {
                    btn.innerHTML = origText;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-primary');
                }, 1800);
            } else {
                alert(`${activePreviewSpell.name} is already added to this character!`);
            }
        });

        document.getElementById('modal-spell-delete')?.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            if (level && idx !== undefined) {
                const promptModal = document.getElementById('modal-spell-delete-prompt');
                if (promptModal) {
                    promptModal.classList.remove('vtt-hidden');
                    const confirmBtn = document.getElementById('delete-prompt-confirm');
                    if (confirmBtn) {
                        confirmBtn.dataset.level = level;
                        confirmBtn.dataset.idx = idx;
                    }
                }
            }
        });

        document.getElementById('delete-prompt-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-spell-delete-prompt')?.classList.add('vtt-hidden');
        });

        document.getElementById('delete-prompt-confirm')?.addEventListener('click', (e) => {
            const char = activeSpellEditContext && activeSpellEditContext.char ? activeSpellEditContext.char : currentChar;
            if (!char) return;
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            if (level && idx !== undefined) {
                if (char.spells && char.spells[level]) {
                    char.spells[level].splice(idx, 1);
                }
                document.getElementById('modal-spell-delete-prompt')?.classList.add('vtt-hidden');
                closeSpellModal();
                if (activeSpellEditContext && activeSpellEditContext.onSave) {
                    activeSpellEditContext.onSave(char);
                } else {
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            }
        });

        document.getElementById('btn-add-spell-damage')?.addEventListener('click', () => {
            modalSpellDamageRows.push({ id: 'dmg_' + Date.now(), formula: '1d8', type: '', stat: '', custom: '' });
            renderModalSpellDamage();
        });

        document.getElementById('modal-spell-save')?.addEventListener('click', () => {
            const char = activeSpellEditContext && activeSpellEditContext.char ? activeSpellEditContext.char : currentChar;
            if (!char) return;
            const isCustomTab = !document.getElementById('pc-spell-tab-custom').classList.contains('vtt-hidden');
            const targetLevel = document.getElementById('modal-spell-level').value;

            if (isCustomTab) {
                const level = targetLevel;
                const idx = parseInt(document.getElementById('modal-spell-idx').value);
                const name = document.getElementById('modal-spell-name').value.trim();
                const description = document.getElementById('modal-spell-desc').value;
                const school = document.getElementById('modal-spell-school')?.value || '';
                const castingTime = document.getElementById('modal-spell-time')?.value || '';
                const range = document.getElementById('modal-spell-range')?.value || '';
                const components = document.getElementById('modal-spell-components')?.value || '';
                const duration = document.getElementById('modal-spell-duration')?.value || '';
                const concentration = document.getElementById('modal-spell-concentration') ? document.getElementById('modal-spell-concentration').checked : false;
                const ritual = document.getElementById('modal-spell-ritual') ? document.getElementById('modal-spell-ritual').checked : false;
                const macroDescription = document.getElementById('modal-spell-macro-desc')?.value || '';
                const attackStat = document.getElementById('modal-spell-atk-stat').value;
                const attackProf = document.getElementById('modal-spell-atk-prof').checked;
                const attackExtra = parseInt(document.getElementById('modal-spell-atk-extra').value) || 0;
                const attackBonus = document.getElementById('modal-spell-atk-custom').value;
                const saveDcStat = document.getElementById('modal-spell-save-dc-stat').value;
                const saveDcExtra = parseInt(document.getElementById('modal-spell-save-dc-extra').value) || 0;
                const saveDcCustom = document.getElementById('modal-spell-save-dc-custom').value !== '' ? parseInt(document.getElementById('modal-spell-save-dc-custom').value) : null;
                const saveAbility = document.getElementById('modal-spell-save-ability').value;
                const damageList = modalSpellDamageRows;
                const cantripScale = document.getElementById('modal-spell-cantrip-scale') ? document.getElementById('modal-spell-cantrip-scale').checked : false;
                const upcastBonus = document.getElementById('modal-spell-upcast').value;
                const upcastScaleStep = parseInt(document.getElementById('modal-spell-upcast-step')?.value) || 1;
                const usesType = document.getElementById('modal-spell-uses-type')?.value || 'slot';
                const usesMaxRaw = document.getElementById('modal-spell-uses-max')?.value.trim();
                const usesMax = usesMaxRaw !== undefined && usesMaxRaw !== '' ? (parseInt(usesMaxRaw) || 0) : undefined;
                const usesRemaining = usesMax !== undefined ? usesMax : undefined;

                if (!name) return alert("Spell name is required.");
                if (!char.spells) char.spells = {};
                if (!char.spells[level]) char.spells[level] = [];

                if (idx >= 0) {
                    char.spells[level][idx] = { ...char.spells[level][idx], name, description, school, castingTime, range, components, duration, concentration, ritual, macroDescription, attackStat, attackProf, attackExtra, attackBonus, saveDcStat, saveDcExtra, saveDcCustom, saveAbility, damageList, cantripScale, upcastBonus, upcastScaleStep, usesType, usesMax, usesRemaining };
                } else {
                    char.spells[level].push({ id: 'sp_' + Date.now() + Math.random(), name, description, school, castingTime, range, components, duration, concentration, ritual, macroDescription, prepared: false, attackStat, attackProf, attackExtra, attackBonus, saveDcStat, saveDcExtra, saveDcCustom, saveAbility, damageList, cantripScale, upcastBonus, upcastScaleStep, usesType, usesMax, usesRemaining });
                }
            } else {
                if (spellBulkSelection.size === 0) return alert("No spells selected.");
                const lvlMapInverse = { 0: 'cantrip', 1: 'level1', 2: 'level2', 3: 'level3', 4: 'level4', 5: 'level5', 6: 'level6', 7: 'level7', 8: 'level8', 9: 'level9' };

                Array.from(spellBulkSelection).forEach(spellName => {
                    const spData = spellCache.find(s => s.name === spellName);
                    if (spData) {
                        const levelKey = lvlMapInverse[spData.level] || targetLevel;
                        if (!char.spells) char.spells = {};
                        if (!char.spells[levelKey]) char.spells[levelKey] = [];
                        if (!char.spells[levelKey].find(s => s.name === spellName)) {
                            const newSpell = { id: 'sp_' + Date.now() + Math.random(), name: spellName, description: '', prepared: false };
                            parseSpellToMacro(spData, newSpell);
                            char.spells[levelKey].push(newSpell);
                        }
                    }
                });
            }

            closeSpellModal();
            if (activeSpellEditContext && activeSpellEditContext.onSave) {
                activeSpellEditContext.onSave(char);
            } else {
                saveAndEmit(char);
                renderSheetData(char);
            }
        });
    }

    function renderTogglesList() {
        const list = document.getElementById('modal-settings-toggles-list');
        if (!list) return;
        const char = currentChar;
        if (!char || !char.spellSettings || !char.spellSettings.toggles) {
            list.innerHTML = '';
            return;
        }

        let html = '';
        char.spellSettings.toggles.forEach((t, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                        <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                        <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${t.target.toUpperCase()}</span>
                        ${t.dmgType ? `<span style="color:var(--color-text-subtle); font-size:0.7rem; border:1px solid currentColor; border-radius:4px; padding:1px 3px;">${t.dmgType}</span>` : ''}
                        <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-xxs btn-secondary toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-secondary toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        list.querySelectorAll('.toggle-enable-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.spellSettings.toggles[idx].enabled = e.currentTarget.checked;
            if (saveAndEmit && currentChar) saveAndEmit(currentChar);
            if (renderSheetData && currentChar) renderSheetData(currentChar);
        }));

        list.querySelectorAll('.toggle-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.spellSettings.toggles[idx];
            document.getElementById('modal-toggle-idx').value = idx;
            document.getElementById('modal-toggle-name').value = t.name;
            document.getElementById('modal-toggle-formula').value = t.formula;
            document.getElementById('modal-toggle-target').value = t.target;
            document.getElementById('modal-toggle-type').value = t.dmgType || '';
            document.getElementById('modal-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.add('vtt-hidden');
        }));

        list.querySelectorAll('.toggle-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this toggle?")) {
                const idx = e.currentTarget.dataset.idx;
                char.spellSettings.toggles.splice(idx, 1);
                if (saveAndEmit && currentChar) saveAndEmit(currentChar);
                if (renderSheetData && currentChar) renderSheetData(currentChar);
                renderTogglesList();
            }
        }));
    }

    function renderAttackTogglesList() {
        const list = document.getElementById('modal-attack-settings-toggles-list');
        if (!list) return;
        const char = currentChar;
        if (!char || !char.attackSettings || !char.attackSettings.toggles) {
            list.innerHTML = '';
            return;
        }

        let html = '';
        char.attackSettings.toggles.forEach((t, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="attack-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                        <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                        <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${t.target.toUpperCase()}</span>
                        ${t.dmgType ? `<span style="color:var(--color-text-subtle); font-size:0.7rem; border:1px solid currentColor; border-radius:4px; padding:1px 3px;">${t.dmgType}</span>` : ''}
                        <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-xxs btn-secondary attack-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-secondary attack-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        list.querySelectorAll('.attack-toggle-enable-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.attackSettings.toggles[idx].enabled = e.currentTarget.checked;
            if (saveAndEmit && currentChar) saveAndEmit(currentChar);
            if (renderSheetData && currentChar) renderSheetData(currentChar);
        }));

        list.querySelectorAll('.attack-toggle-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.attackSettings.toggles[idx];
            document.getElementById('modal-attack-toggle-idx').value = idx;
            document.getElementById('modal-attack-toggle-name').value = t.name;
            document.getElementById('modal-attack-toggle-formula').value = t.formula;
            document.getElementById('modal-attack-toggle-target').value = t.target;
            document.getElementById('modal-attack-toggle-type').value = t.dmgType || '';
            document.getElementById('modal-attack-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.add('vtt-hidden');
        }));

        list.querySelectorAll('.attack-toggle-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this toggle?")) {
                const idx = e.currentTarget.dataset.idx;
                char.attackSettings.toggles.splice(idx, 1);
                if (saveAndEmit && currentChar) saveAndEmit(currentChar);
                if (renderSheetData && currentChar) renderSheetData(currentChar);
                renderAttackTogglesList();
            }
        }));
    }

    function setupAttackSettingsListeners() {
        document.getElementById('modal-attack-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-attack-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-attack-toggle')?.addEventListener('click', () => {
            document.getElementById('modal-attack-toggle-idx').value = '-1';
            document.getElementById('modal-attack-toggle-name').value = '';
            document.getElementById('modal-attack-toggle-formula').value = '';
            document.getElementById('modal-attack-toggle-target').value = 'both';
            document.getElementById('modal-attack-toggle-type').value = '';
            document.getElementById('modal-attack-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.add('vtt-hidden');
        });

        document.getElementById('modal-attack-toggle-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-attack-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-attack-toggle-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-attack-toggle-idx').value);
            const name = document.getElementById('modal-attack-toggle-name').value.trim();
            const formula = document.getElementById('modal-attack-toggle-formula').value.trim();
            const target = document.getElementById('modal-attack-toggle-target').value;
            const dmgType = document.getElementById('modal-attack-toggle-type').value;
            if (!name || !formula) return alert("Name and Formula are required.");

            const t = { id: 'atk_tgl_' + Date.now(), name, formula, target, dmgType, enabled: true };
            if (idx >= 0) {
                currentChar.attackSettings.toggles[idx] = t;
            } else {
                currentChar.attackSettings.toggles.push(t);
            }
            document.getElementById('modal-attack-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.remove('vtt-hidden');
            if (saveAndEmit && currentChar) saveAndEmit(currentChar);
            if (renderSheetData && currentChar) renderSheetData(currentChar);
            renderAttackTogglesList();
        });

        document.getElementById('modal-attack-settings-save')?.addEventListener('click', () => {
            currentChar.attackSettings.atkMod = parseInt(document.getElementById('modal-attack-settings-atk').value) || 0;
            currentChar.attackSettings.dmgMod = parseInt(document.getElementById('modal-attack-settings-dmg').value) || 0;
            currentChar.attackSettings.dcMod = parseInt(document.getElementById('modal-attack-settings-dc').value) || 0;
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-attack-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });
    }

    function setupSpellSettingsListeners() {
        document.getElementById('modal-spell-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-spell-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-toggle')?.addEventListener('click', () => {
            document.getElementById('modal-toggle-idx').value = '-1';
            document.getElementById('modal-toggle-name').value = '';
            document.getElementById('modal-toggle-formula').value = '';
            document.getElementById('modal-toggle-target').value = 'both';
            document.getElementById('modal-toggle-type').value = '';
            document.getElementById('modal-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.add('vtt-hidden');
        });

        document.getElementById('modal-toggle-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-toggle-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-toggle-idx').value);
            const name = document.getElementById('modal-toggle-name').value.trim();
            const formula = document.getElementById('modal-toggle-formula').value.trim();
            const target = document.getElementById('modal-toggle-target').value;
            const dmgType = document.getElementById('modal-toggle-type').value;
            if (!name || !formula) return alert("Name and Formula are required.");

            const t = { id: 'tgl_' + Date.now(), name, formula, target, dmgType, enabled: true };
            if (idx >= 0) {
                currentChar.spellSettings.toggles[idx] = t;
            } else {
                currentChar.spellSettings.toggles.push(t);
            }
            document.getElementById('modal-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.remove('vtt-hidden');
            if (saveAndEmit && currentChar) saveAndEmit(currentChar);
            if (renderSheetData && currentChar) renderSheetData(currentChar);
            renderTogglesList();
        });

        document.getElementById('modal-settings-save')?.addEventListener('click', () => {
            currentChar.spellSettings.ability = document.getElementById('modal-settings-ability').value;
            currentChar.spellSettings.atkMod = parseInt(document.getElementById('modal-settings-atk').value) || 0;
            currentChar.spellSettings.dcMod = parseInt(document.getElementById('modal-settings-dc').value) || 0;
            currentChar.spellSettings.dmgMod = parseInt(document.getElementById('modal-settings-dmg').value) || 0;
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-spell-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });
    }

    // Expose global API
    window.VTTSpellManager = {
        init: (ctx) => {
            currentChar = ctx.currentChar;
            saveAndEmit = ctx.saveAndEmit;
            renderSheetData = ctx.renderSheetData;
            spellCache = ctx.spellCache;
            if (ctx.spellCache) sharedSpellCache = ctx.spellCache;
        },
        openModal: (level, idx, customChar, onSaveCallback) => {
            openSpellModal(level, idx, customChar, onSaveCallback);
        },
        openSpellModal: (level, idx, customChar, onSaveCallback) => {
            openSpellModal(level, idx, customChar, onSaveCallback);
        },
        getSpellCache: () => sharedSpellCache || spellCache,
        setSpellCache: (cache) => { 
            sharedSpellCache = cache; 
            spellCache = cache; 
            if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.setSpellCache) {
                window.vttPlayerSheetAPI.setSpellCache(cache);
            }
        },
        loadSpells: () => loadSpells(),
        parseSpellToMacro: (spData, newSpell) => parseSpellToMacro(spData, newSpell),
        cleanSpellBodyHtml: (html) => cleanSpellBodyHtml(html),
        getSpellMetaStrings: (sp, slKey) => getSpellMetaStrings(sp, slKey),
        renderAndInjectSpell: (spellName, containerEl, fallbackDesc, sp, slKey) => renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey),
        renderSpellRowHtml: (sp, slKey, idx, options) => renderSpellRowHtml(sp, slKey, idx, options),
        ensureSpellIsParsed: (sp) => ensureSpellIsParsed(sp),
        postSpellToChat: (sp, slKey, creatureName, visibility) => postSpellToChat(sp, slKey, creatureName, visibility),
        promptUpcastLevel: (baseLvl, callback) => promptUpcastLevel(baseLvl, callback),
        rollSpell: (sp, slKey, casterObj, options) => rollSpell(sp, slKey, casterObj, options),
        ensureSpellModalsExist: () => ensureSpellModalsExist(),
        renderTogglesList: () => renderTogglesList(),
        renderAttackTogglesList: () => renderAttackTogglesList()
    };
    window.vttSpellManagerAPI = window.VTTSpellManager;
    window.openSpellModal = openSpellModal;
}
