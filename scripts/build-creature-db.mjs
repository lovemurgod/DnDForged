import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const dataDir = path.join(rootDir, '5etools-src', 'data');
const bestiaryDir = path.join(dataDir, 'bestiary');
const indexPath = path.join(bestiaryDir, 'index.json');
const templatePath = path.join(bestiaryDir, 'template.json');
const spellsCatalogPath = path.join(dataDir, 'spells-catalog.json');
const spellsNormalizedDir = path.join(dataDir, 'spells-normalized');
const outputDir = path.join(dataDir, 'bestiary-normalized');
const catalogPath = path.join(dataDir, 'bestiary-catalog.json');
const legGroupsPath = path.join(bestiaryDir, 'legendarygroups.json');

const EDITION_2024_SOURCES = new Set(['XMM', 'XPHB', 'FRAiF', 'NF', 'EFA']);

// CR to Proficiency Bonus mapping
function crToPb(crStr) {
    if (!crStr) return 2;
    const crClean = String(crStr).trim();
    if (crClean === '1/8' || crClean === '1/4' || crClean === '1/2' || crClean === '0') return 2;
    const num = parseFloat(crClean);
    if (isNaN(num) || num <= 4) return 2;
    if (num <= 8) return 3;
    if (num <= 12) return 4;
    if (num <= 16) return 5;
    if (num <= 20) return 6;
    if (num <= 24) return 7;
    if (num <= 28) return 8;
    return 9;
}

function crToNumber(cr) {
    if (!cr) return 0;
    if (typeof cr === 'object') cr = cr.cr || 0;
    const str = String(cr).trim();
    if (str === '1/8') return 0.125;
    if (str === '1/4') return 0.25;
    if (str === '1/2') return 0.5;
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

const SIZE_MAP = {
    'T': 'Tiny',
    'S': 'Small',
    'M': 'Medium',
    'L': 'Large',
    'H': 'Huge',
    'G': 'Gargantuan'
};

function cleanTags(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/\{@damage ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@dice ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@hit ([^}|]+)[^}]*\}/g, '+$1')
        .replace(/\{@dc ([^}|]+)[^}]*\}/g, 'DC $1')
        .replace(/\{@spell ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@condition ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@status ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@item ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@creature ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@skill ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@sense ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@b ([^}]+)\}/g, '<strong>$1</strong>')
        .replace(/\{@i ([^}]+)\}/g, '<em>$1</em>')
        .replace(/\{@note ([^}]+)\}/g, '<em>$1</em>')
        .replace(/\{@scaledamage [^|]+\|[^|]+\|([^}]+)\}/g, '$1')
        .replace(/\{@scaledice [^|]+\|[^|]+\|([^}]+)\}/g, '$1')
        .replace(/\{@filter ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@link ([^}|]+)[^}]*\}/g, '$1')
        .replace(/\{@chance ([^}|]+)[^}]*\}/g, '$1%')
        .replace(/\{@recharge ([^}|]+)[^}]*\}/g, '(Recharge $1)')
        .replace(/\{@\w+ ([^}|]+)[^}]*\}/g, '$1');
}

function renderEntriesToHtml(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') return `<p>${cleanTags(entries)}</p>`;
    if (!Array.isArray(entries)) entries = [entries];

    let html = '';
    entries.forEach(entry => {
        if (typeof entry === 'string') {
            html += `<p>${cleanTags(entry)}</p>`;
        } else if (typeof entry === 'object' && entry !== null) {
            if (entry.type === 'entries') {
                const nameStr = entry.name ? `<strong><em>${cleanTags(entry.name)}.</em></strong> ` : '';
                html += `<div>${nameStr}${renderEntriesToHtml(entry.entries)}</div>`;
            } else if (entry.type === 'list') {
                const items = (entry.items || []).map(item => {
                    if (typeof item === 'string') return `<li>${cleanTags(item)}</li>`;
                    if (item.type === 'item') {
                        const nameStr = item.name ? `<strong><em>${cleanTags(item.name)}.</em></strong> ` : '';
                        return `<li>${nameStr}${renderEntriesToHtml(item.entry || item.entries)}</li>`;
                    }
                    return `<li>${renderEntriesToHtml(item)}</li>`;
                }).join('');
                html += `<ul>${items}</ul>`;
            } else if (entry.type === 'table') {
                let caption = entry.caption ? `<caption>${cleanTags(entry.caption)}</caption>` : '';
                let headers = (entry.colLabels || []).map(l => `<th>${cleanTags(l)}</th>`).join('');
                let rows = (entry.rows || []).map(r => {
                    let cells = r.map(c => `<td>${cleanTags(typeof c === 'object' ? (c.entry || JSON.stringify(c)) : String(c))}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');
                html += `<table style="width:100%; border-collapse:collapse; margin:8px 0;">${caption}<thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
            }
        }
    });

    return html;
}

function flattenEntriesToText(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') return entries;
    if (Array.isArray(entries)) {
        return entries.map(e => flattenEntriesToText(e)).join('\n');
    }
    if (typeof entries === 'object' && entries !== null) {
        let text = '';
        if (entries.name) text += entries.name + ': ';
        if (entries.entries) text += flattenEntriesToText(entries.entries);
        if (entries.items) text += entries.items.map(i => flattenEntriesToText(i)).join('; ');
        return text;
    }
    return String(entries);
}

// Load normalized spells into lookup maps
function loadSpellsLookup() {
    console.log('📖 Loading spells database...');
    let raw = [];
    if (fs.existsSync(spellsNormalizedDir)) {
        const files = fs.readdirSync(spellsNormalizedDir).filter(f => f.endsWith('.json'));
        files.forEach(f => {
            try {
                const list = JSON.parse(fs.readFileSync(path.join(spellsNormalizedDir, f), 'utf8'));
                if (Array.isArray(list)) raw.push(...list);
            } catch(e) {}
        });
    } else if (fs.existsSync(spellsCatalogPath)) {
        raw = JSON.parse(fs.readFileSync(spellsCatalogPath, 'utf8'));
    }

    if (raw.length === 0) {
        console.warn('⚠️ No spells found in spells-normalized directory or spells-catalog.json');
        return { byId: new Map(), byNameSource: new Map(), byName: new Map() };
    }
    const byId = new Map();
    const byNameSource = new Map();
    const byName = new Map();

    raw.forEach(sp => {
        byId.set(sp.id, sp);
        const nameLower = (sp.name || '').trim().toLowerCase();
        const srcLower = (sp.source || '').trim().toLowerCase();
        byNameSource.set(`${nameLower}|${srcLower}`, sp);
        if (!byName.has(nameLower) || sp.source === 'PHB' || sp.source === 'XPHB') {
            byName.set(nameLower, sp);
        }
    });

    console.log(`✅ Loaded ${raw.length} spells into lookup cache.`);
    return { byId, byNameSource, byName };
}

function findSpell(spellRef, spellsLookup) {
    if (!spellRef) return null;
    let rawStr = typeof spellRef === 'string' ? spellRef : (spellRef.name || '');
    // Extract name and optional source from tag like {@spell magic missile|phb} or {@spell Fire Bolt|XPHB}
    let tagMatch = rawStr.match(/\{@spell\s+([^|}]+)(?:\|([^|}]+))?/i);
    let name = tagMatch ? tagMatch[1].trim() : rawStr.replace(/[*†‡]/g, '').trim();
    let source = tagMatch && tagMatch[2] ? tagMatch[2].trim() : (spellRef.source || '');

    const nameLower = name.toLowerCase();
    const srcLower = source.toLowerCase();

    if (srcLower && spellsLookup.byNameSource.has(`${nameLower}|${srcLower}`)) {
        return spellsLookup.byNameSource.get(`${nameLower}|${srcLower}`);
    }
    if (spellsLookup.byName.has(nameLower)) {
        return spellsLookup.byName.get(nameLower);
    }
    return null;
}

function toSpellTitleCase(str) {
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

// Parse attack/save/damage macro structure from an action/trait
function parseActionMacroData(entryName, rawEntries, charName) {
    const rawString = flattenEntriesToText(rawEntries);
    const macro = {
        isAttack: false,
        attackType: null, // 'mw', 'rw', 'mw/rw', 'ms', 'rs'
        attackBonus: null,
        reach: null,
        range: null,
        targets: null,
        save: null, // { dc, ability }
        damages: [],
        recharge: null
    };

    // Recharge check
    const rechargeMatch = entryName.match(/\(Recharge\s+(\d+(?:–|-)\d+|\d+)\)/i) || rawString.match(/\{@recharge\s*(\d+)?\}/i);
    if (rechargeMatch) {
        macro.recharge = rechargeMatch[1] || '6';
    }

    // Attack detection
    const atkMatch = rawString.match(/\{@hit ([\+\-]?\d+)\}/i) || rawString.match(/([\+\-]\d+)\s+to hit/i);
    if (atkMatch) {
        macro.isAttack = true;
        macro.attackBonus = parseInt(atkMatch[1], 10) || 0;

        if (/melee\s+or\s+ranged\s+weapon\s+attack/i.test(rawString)) macro.attackType = 'mw/rw';
        else if (/melee\s+weapon\s+attack/i.test(rawString)) macro.attackType = 'mw';
        else if (/ranged\s+weapon\s+attack/i.test(rawString)) macro.attackType = 'rw';
        else if (/melee\s+spell\s+attack/i.test(rawString)) macro.attackType = 'ms';
        else if (/ranged\s+spell\s+attack/i.test(rawString)) macro.attackType = 'rs';

        const reachM = rawString.match(/reach\s+(\d+)\s*ft/i);
        if (reachM) macro.reach = parseInt(reachM[1], 10);

        const rangeM = rawString.match(/range\s+([\d\/]+)\s*ft/i);
        if (rangeM) macro.range = rangeM[1] + ' ft.';

        const targetM = rawString.match(/(?:reach|range)[^,]+,\s*([^.]+)\./i);
        if (targetM) macro.targets = targetM[1].trim();
    }

    // Save DC detection
    const saveMatch = rawString.match(/\{@dc (\d+)\}/i) || rawString.match(/(?:save\s+DC|DC)\s*(\d+)(?:\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))?/i);
    if (saveMatch) {
        const dc = parseInt(saveMatch[1], 10);
        let ability = saveMatch[2] ? saveMatch[2].substring(0, 3).toUpperCase() : null;
        if (!ability) {
            const abM = rawString.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
            if (abM) ability = abM[1].substring(0, 3).toUpperCase();
        }
        macro.save = { dc, ability: ability || 'Save' };
    }

    // Damage formulas
    const dmgRegex = /\{@damage ([^\}]+)\}(?:.*?([\w]+)\s+damage)?/gi;
    let match;
    const VALID_TYPES = new Set(['Fire', 'Cold', 'Lightning', 'Thunder', 'Poison', 'Acid', 'Necrotic', 'Radiant', 'Force', 'Psychic', 'Slashing', 'Piercing', 'Bludgeoning', 'Healing']);
    
    while ((match = dmgRegex.exec(rawString)) !== null) {
        const formula = match[1].trim();
        let type = match[2] ? (match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()) : 'Slashing';
        if (!VALID_TYPES.has(type)) type = 'Slashing';
        macro.damages.push({ formula, type });
    }

    // Fallback for non-tagged damage text like "5 (1d6 + 2) slashing damage"
    if (macro.damages.length === 0) {
        const fallbackRegex = /\d+\s*\(([^)]+)\)\s+([a-zA-Z]+)\s+damage/gi;
        while ((match = fallbackRegex.exec(rawString)) !== null) {
            const formula = match[1].trim();
            let type = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
            if (!VALID_TYPES.has(type)) type = 'Slashing';
            macro.damages.push({ formula, type });
        }
    }

    return macro;
}

// Convert an ability entry into a normalized structured object
function normalizeAbilityEntry(entry, actionType, charName) {
    if (!entry) return null;
    if (typeof entry === 'string') {
        entry = { name: actionType === 'lair' ? 'Lair Action' : 'Ability', entries: [entry] };
    }
    const name = entry.name ? cleanTags(entry.name).replace(/\.$/, '').trim() : (actionType === 'lair' ? 'Lair Action' : 'Ability');
    const entries = entry.entries || (entry.items ? entry.items : []);
    const descriptionHtml = renderEntriesToHtml(entries);
    const macro = parseActionMacroData(name, entries, charName);

    return {
        id: `act_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substr(2, 4)}`,
        name,
        actionType, // 'action', 'bonus', 'reaction', 'trait', 'legendary', 'mythic', 'lair'
        descriptionHtml,
        macro
    };
}

// Normalize spellcasting data
function normalizeSpellcasting(monster, spellsLookup) {
    const spellcastingBlocks = [];
    const rawBlocks = [];

    // Collect blocks from monster.spellcasting
    if (monster.spellcasting && Array.isArray(monster.spellcasting)) {
        rawBlocks.push(...monster.spellcasting);
    }

    // Also check monster.trait for unnested spellcasting blocks
    if (monster.trait && Array.isArray(monster.trait)) {
        monster.trait.forEach(t => {
            if (!t || !t.name) return;
            const tName = t.name.toLowerCase();
            if (tName.includes('magic weapon') || tName.includes('magic resistance') || tName.includes('magic absorption') || tName.includes('magic sensitivity')) {
                return;
            }
            if (/(?:innate\s+)?spellcasting|psionics/i.test(t.name)) {
                if (!rawBlocks.some(b => b.name === t.name)) {
                    rawBlocks.push({
                        name: t.name,
                        headerEntries: t.entries || [],
                        fromTrait: true
                    });
                }
            }
        });
    }

    const pb = crToPb(monster.cr ? (monster.cr.cr || monster.cr) : '0');

    rawBlocks.forEach((raw, blockIdx) => {
        const blockName = raw.name || 'Spellcasting';
        const isBlockInnate = raw.type === 'innate' || /innate/i.test(blockName);
        const headerText = flattenEntriesToText(raw.headerEntries || raw.entries || []);
        const footerText = flattenEntriesToText(raw.footerEntries || []);

        // 1. Ability determination
        let ability = raw.ability ? String(raw.ability).toLowerCase() : null;
        if (!ability) {
            if (/charisma/i.test(headerText)) ability = 'cha';
            else if (/wisdom/i.test(headerText)) ability = 'wis';
            else if (/intelligence/i.test(headerText)) ability = 'int';
            else if (/constitution/i.test(headerText)) ability = 'con';
            else if (/dexterity/i.test(headerText)) ability = 'dex';
            else if (/strength/i.test(headerText)) ability = 'str';
            else ability = 'int'; // default fallback
        }
        const abScore = monster[ability] || 10;
        const abMod = Math.floor((abScore - 10) / 2);

        // 2. Spell Save DC
        let dc = raw.dc !== undefined ? parseInt(raw.dc, 10) : null;
        if (dc === null) {
            const dcMatch = headerText.match(/(?:spell\s+save\s+DC|save\s+DC|DC)\s*(\d+)/i);
            if (dcMatch) dc = parseInt(dcMatch[1], 10);
            else dc = 8 + pb + abMod;
        }

        // 3. Spell Attack Modifier
        let atkMod = raw.atkMod !== undefined ? parseInt(raw.atkMod, 10) : null;
        if (atkMod === null) {
            const atkMatch = headerText.match(/([+-]\d+)\s+to\s+hit\s+with\s+spell\s+attacks/i) || headerText.match(/\{@hit\s+([+-]?\d+)\}/i);
            if (atkMatch) atkMod = parseInt(atkMatch[1], 10);
            else atkMod = pb + abMod;
        }

        // 4. Caster Level
        let casterLevel = raw.casterLevel !== undefined ? parseInt(raw.casterLevel, 10) : null;
        if (casterLevel === null || (casterLevel === 0 && !isBlockInnate)) {
            const lvlMatch = headerText.match(/(\d+)(?:st|nd|rd|th)[-\s]level\s+spellcaster/i);
            if (lvlMatch) {
                casterLevel = parseInt(lvlMatch[1], 10);
            } else if (raw.spells) {
                // Infer from highest spell slot
                const slotLevels = Object.keys(raw.spells).map(k => parseInt(k, 10)).filter(n => !isNaN(n) && n > 0);
                if (slotLevels.length > 0) {
                    const maxSlot = Math.max(...slotLevels);
                    casterLevel = Math.max(1, maxSlot * 2 - 1);
                } else {
                    casterLevel = isBlockInnate ? 0 : 1;
                }
            } else {
                casterLevel = isBlockInnate ? 0 : 1;
            }
        }

        // Build embedded spell object with quick-roll data
        function buildEmbeddedSpell(spellRef, usageMeta = {}) {
            const normSpell = findSpell(spellRef, spellsLookup);
            let rawName = typeof spellRef === 'string' ? spellRef : (spellRef.name || 'Unknown Spell');
            const cleanName = rawName.replace(/\{@spell\s+([^|}]+).*?\}/i, '$1').replace(/[*†‡]/g, '').trim();

            if (normSpell) {
                return {
                    spellId: normSpell.id,
                    name: toSpellTitleCase(normSpell.name),
                    source: normSpell.source,
                    level: normSpell.level,
                    school: normSpell.school,
                    castingTime: normSpell.castingTime,
                    range: normSpell.range,
                    duration: normSpell.duration,
                    concentration: normSpell.concentration,
                    ritual: normSpell.ritual,
                    saveAbility: normSpell.saveAbility,
                    attackStat: normSpell.attackStat,
                    atkMod: normSpell.attackStat !== 'none' ? atkMod : null,
                    dc: normSpell.saveAbility ? dc : null,
                    damageList: normSpell.damageList || [],
                    components: normSpell.components,
                    ...usageMeta
                };
            }

            // Fallback if not found in spells-normalized.json
            return {
                spellId: `sp_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_unknown`,
                name: toSpellTitleCase(cleanName),
                source: 'PHB',
                level: usageMeta.level !== undefined ? usageMeta.level : 1,
                school: 'Evocation',
                castingTime: '1 action',
                range: 'Self',
                duration: 'Instantaneous',
                concentration: false,
                ritual: false,
                saveAbility: null,
                attackStat: 'none',
                atkMod: null,
                dc: null,
                damageList: [],
                components: 'V, S',
                ...usageMeta
            };
        }

        const spellsByLevel = {};
        const atWill = [];
        const daily = {};

        // Parse slotted spells
        if (raw.spells) {
            for (let lvlKey in raw.spells) {
                const lvlNum = parseInt(lvlKey, 10);
                const slotData = raw.spells[lvlKey];
                const slotsCount = typeof slotData === 'object' && slotData.slots !== undefined ? slotData.slots : (lvlNum === 0 ? 0 : 1);
                const rawList = Array.isArray(slotData) ? slotData : (slotData.spells || []);

                spellsByLevel[lvlKey] = {
                    slots: slotsCount,
                    spells: rawList.map(sp => buildEmbeddedSpell(sp, { level: lvlNum, type: 'slot' }))
                };
            }
        }

        // Parse at-will spells
        if (raw.will && Array.isArray(raw.will)) {
            raw.will.forEach(sp => {
                atWill.push(buildEmbeddedSpell(sp, { uses: 'at_will', type: 'at_will' }));
            });
        }

        // Parse daily spells (e.g. 1e, 2e, 3e, 1/day, etc.)
        if (raw.daily && typeof raw.daily === 'object') {
            for (let dayKey in raw.daily) {
                const usesMax = parseInt(dayKey, 10) || 1;
                daily[dayKey] = (raw.daily[dayKey] || []).map(sp =>
                    buildEmbeddedSpell(sp, { usesMax, usesRemaining: usesMax, dailyKey: dayKey, type: 'daily' })
                );
            }
        }

        // If from a trait that had text lines (like innate spellcasting lines)
        if (raw.fromTrait && Object.keys(spellsByLevel).length === 0 && atWill.length === 0 && Object.keys(daily).length === 0) {
            const lines = headerText.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                const cantripM = trimmed.match(/^(?:Cantrips\s*\([^)]*\)|At\s+will):\s*(.*)$/i);
                if (cantripM) {
                    cantripM[1].split(/,\s*/).forEach(s => {
                        if (s.trim()) atWill.push(buildEmbeddedSpell(s.trim(), { uses: 'at_will', type: 'at_will' }));
                    });
                    return;
                }
                const dailyM = trimmed.match(/^(\d+)\/day(?:\s+each)?:\s*(.*)$/i);
                if (dailyM) {
                    const count = dailyM[1];
                    const key = count + 'e';
                    daily[key] = daily[key] || [];
                    dailyM[2].split(/,\s*/).forEach(s => {
                        if (s.trim()) daily[key].push(buildEmbeddedSpell(s.trim(), { usesMax: parseInt(count, 10), dailyKey: key, type: 'daily' }));
                    });
                    return;
                }
                const slotM = trimmed.match(/^(\d+)(?:st|nd|rd|th)\s+level\s*\((?:(\d+)\s+slots?|at\s+will)\):\s*(.*)$/i);
                if (slotM) {
                    const lvl = slotM[1];
                    const slots = parseInt(slotM[2], 10) || 0;
                    spellsByLevel[lvl] = spellsByLevel[lvl] || { slots, spells: [] };
                    slotM[3].split(/,\s*/).forEach(s => {
                        if (s.trim()) spellsByLevel[lvl].spells.push(buildEmbeddedSpell(s.trim(), { level: parseInt(lvl, 10), type: 'slot' }));
                    });
                }
            });
        }

        spellcastingBlocks.push({
            id: `sc_${monster.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${blockIdx}`,
            name: blockName,
            type: raw.type || (isBlockInnate ? 'innate' : 'slot'),
            displayAs: raw.displayAs || 'action',
            ability,
            abilityMod: abMod,
            casterLevel,
            dc,
            atkMod,
            header: cleanTags(headerText),
            footer: cleanTags(footerText),
            spellsByLevel,
            atWill,
            daily,
            will: atWill.map(s => s.name)
        });
    });

    return spellcastingBlocks;
}

// Main compiler
function buildCreatureDatabase() {
    console.log('🚀 Starting Creature Database Compiler...');
    const spellsLookup = loadSpellsLookup();

    const legendaryGroupsMap = new Map();
    if (fs.existsSync(legGroupsPath)) {
        try {
            const legData = JSON.parse(fs.readFileSync(legGroupsPath, 'utf8'));
            (legData.legendaryGroup || []).forEach(lg => {
                const key = `${(lg.name || '').toLowerCase()}|${(lg.source || 'MM').toLowerCase()}`;
                legendaryGroupsMap.set(key, lg);
            });
            console.log(`🏰 Loaded ${legendaryGroupsMap.size} legendary groups.`);
        } catch (e) {
            console.warn('⚠️ Could not load legendarygroups.json:', e.message);
        }
    }

    if (!fs.existsSync(indexPath)) {
        throw new Error(`Bestiary index.json not found at ${indexPath}`);
    }

    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const allMonstersRaw = [];
    const sourceFilesMap = {};

    console.log(`📦 Reading raw 5etools bestiary files (${Object.keys(indexData).length} sources listed in index.json)...`);

    for (const sourceKey in indexData) {
        const fileName = indexData[sourceKey];
        const filePath = path.join(bestiaryDir, fileName);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Bestiary file not found: ${filePath}`);
            continue;
        }

        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const monsterList = content.monster || [];
        sourceFilesMap[sourceKey] = [];

        monsterList.forEach(m => {
            m.__prop = "monster";
            m.source = m.source || sourceKey;
            allMonstersRaw.push(m);
            sourceFilesMap[sourceKey].push(m);
        });
    }

    console.log(`📊 Loaded ${allMonstersRaw.length} raw monster entries.`);

    // Build raw monster lookup map for _copy resolution
    const monsterMap = new Map();
    allMonstersRaw.forEach(m => {
        const key = `${(m.name || '').toLowerCase()}|${(m.source || 'MM').toLowerCase()}`;
        monsterMap.set(key, m);
    });

    // Resolve _copy references recursively
    console.log('🔄 Resolving _copy references...');
    let copyCount = 0;

    function resolveCopy(m, depth = 0) {
        if (!m._copy || depth > 10) return m;
        const parentName = (m._copy.name || '').toLowerCase();
        const parentSource = (m._copy.source || 'MM').toLowerCase();
        const parentKey = `${parentName}|${parentSource}`;
        let parent = monsterMap.get(parentKey);

        if (!parent) {
            // Try matching just name with MM or any source
            for (const [k, v] of monsterMap.entries()) {
                if (k.startsWith(`${parentName}|`)) {
                    parent = v;
                    break;
                }
            }
        }

        if (parent) {
            if (parent._copy) resolveCopy(parent, depth + 1);
            // Deep clone parent
            const merged = JSON.parse(JSON.stringify(parent));
            // Overwrite with child properties
            for (const prop in m) {
                if (prop !== '_copy' && prop !== '_mod') {
                    merged[prop] = m[prop];
                }
            }
            delete merged._copy;
            delete merged._mod;
            copyCount++;
            return merged;
        }

        delete m._copy;
        return m;
    }

    allMonstersRaw.forEach((m, idx) => {
        if (m._copy) {
            allMonstersRaw[idx] = resolveCopy(m);
        }
    });

    console.log(`✅ Resolved ${copyCount} _copy inheritances.`);

    // Normalize all monsters
    console.log('⚡ Normalizing monsters into structured schema...');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const catalog = [];
    const normalizedBySource = {};
    const seenCreatures = new Set();

    allMonstersRaw.forEach(m => {
        const name = (m.name || 'Unnamed Creature').trim();
        const source = (m.source || 'MM').trim();
        const uniqueKey = `${name.toLowerCase()}|${source.toLowerCase()}`;

        if (seenCreatures.has(uniqueKey)) return;
        seenCreatures.add(uniqueKey);

        const edition = EDITION_2024_SOURCES.has(source) || m.srd52 || m.basicRules2024 ? '2024' : '2014';
        const id = `creature_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${source.toLowerCase()}`;

        // CR parsing
        const crStr = m.cr ? (typeof m.cr === 'object' ? (m.cr.cr || '0') : String(m.cr)) : '0';
        const crNum = crToNumber(crStr);
        const pb = crToPb(crStr);

        // Size parsing
        const rawSize = Array.isArray(m.size) ? m.size[0] : (m.size || 'M');
        const sizeCategory = String(rawSize).toUpperCase();
        const sizeFull = SIZE_MAP[sizeCategory] || 'Medium';

        // Type parsing
        let typeStr = 'Humanoid';
        let subTypeStr = '';
        if (typeof m.type === 'string') {
            typeStr = m.type;
        } else if (typeof m.type === 'object' && m.type !== null) {
            if (typeof m.type.type === 'string') {
                typeStr = m.type.type;
            } else if (m.type.choose && Array.isArray(m.type.choose)) {
                typeStr = m.type.choose.join(' or ');
            } else {
                typeStr = 'Humanoid';
            }
            if (m.type.tags && Array.isArray(m.type.tags)) {
                subTypeStr = m.type.tags.map(t => typeof t === 'string' ? t : (t.tag || JSON.stringify(t))).join(', ');
            }
        }
        if (typeof typeStr !== 'string') typeStr = String(typeStr || 'Humanoid');
        typeStr = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);

        // Alignment parsing
        let alignmentStr = 'Unaligned';
        if (Array.isArray(m.alignment)) {
            alignmentStr = m.alignment.map(a => typeof a === 'string' ? a : (a.alignment ? a.alignment.join(' ') : 'Unaligned')).join(' ');
        } else if (typeof m.alignment === 'string') {
            alignmentStr = m.alignment;
        }

        // AC parsing
        const acList = [];
        let primaryAc = 10;
        let acCond = '';
        if (Array.isArray(m.ac)) {
            m.ac.forEach((acItem, acIdx) => {
                if (typeof acItem === 'number') {
                    if (acIdx === 0) primaryAc = acItem;
                    acList.push({ value: acItem, condition: null });
                } else if (typeof acItem === 'object' && acItem !== null) {
                    const val = acItem.ac || 10;
                    if (acIdx === 0) {
                        primaryAc = val;
                        acCond = acItem.condition || '';
                    }
                    acList.push({ value: val, condition: acItem.condition || null });
                }
            });
        } else if (typeof m.ac === 'number') {
            primaryAc = m.ac;
            acList.push({ value: m.ac, condition: null });
        }

        // HP parsing
        let hpAvg = 10;
        let hpFormula = '2d8 + 2';
        if (m.hp) {
            if (typeof m.hp === 'number') {
                hpAvg = m.hp;
                hpFormula = `${m.hp}`;
            } else if (typeof m.hp === 'object') {
                hpAvg = m.hp.average || 10;
                hpFormula = m.hp.formula || `${hpAvg}`;
            }
        }

        // Speed parsing
        const speedObj = { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0, canHover: false };
        if (m.speed) {
            if (typeof m.speed === 'number') speedObj.walk = m.speed;
            else if (typeof m.speed === 'object') {
                if (m.speed.walk !== undefined) speedObj.walk = typeof m.speed.walk === 'number' ? m.speed.walk : (parseInt(m.speed.walk) || 30);
                if (m.speed.fly !== undefined) speedObj.fly = typeof m.speed.fly === 'number' ? m.speed.fly : (parseInt(m.speed.fly) || 0);
                if (m.speed.swim !== undefined) speedObj.swim = typeof m.speed.swim === 'number' ? m.speed.swim : (parseInt(m.speed.swim) || 0);
                if (m.speed.climb !== undefined) speedObj.climb = typeof m.speed.climb === 'number' ? m.speed.climb : (parseInt(m.speed.climb) || 0);
                if (m.speed.burrow !== undefined) speedObj.burrow = typeof m.speed.burrow === 'number' ? m.speed.burrow : (parseInt(m.speed.burrow) || 0);
                if (m.speed.canHover) speedObj.canHover = true;
            }
        }

        // Ability Scores & Mods
        function getAb(score) {
            const sc = typeof score === 'number' ? score : 10;
            return { score: sc, mod: Math.floor((sc - 10) / 2) };
        }
        const abilities = {
            str: getAb(m.str),
            dex: getAb(m.dex),
            con: getAb(m.con),
            int: getAb(m.int),
            wis: getAb(m.wis),
            cha: getAb(m.cha)
        };

        // Token image url (5etools convention preserving spaces and normalized ASCII)
        let tokenSource = source;
        let tokenName = name;
        if (m.token && typeof m.token === 'object') {
            if (m.token.name) tokenName = m.token.name;
            if (m.token.source) tokenSource = m.token.source;
        }
        const tokenCleanName = (tokenName || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/Æ/g, 'AE').replace(/æ/g, 'ae')
            .replace(/"/g, '')
            .trim();
        const tokenImg = `img/bestiary/tokens/${tokenSource}/${tokenCleanName}.webp`;

        // Normalize Spellcasting
        const spellcasting = normalizeSpellcasting(m, spellsLookup);
        const hasSpellcasting = spellcasting.length > 0;
        const mainSc = hasSpellcasting ? spellcasting[0] : null;

        // Normalize Actions, Bonus Actions, Reactions, Legendary, Traits
        const traits = (m.trait || []).map(t => normalizeAbilityEntry(t, 'trait', name)).filter(Boolean);
        const actions = (m.action || []).map(a => normalizeAbilityEntry(a, 'action', name)).filter(Boolean);
        const bonusActions = (m.bonus || []).map(b => normalizeAbilityEntry(b, 'bonus', name)).filter(Boolean);
        const reactions = (m.reaction || []).map(r => normalizeAbilityEntry(r, 'reaction', name)).filter(Boolean);
        const legendaryActions = {
            count: m.legendary ? (m.legendaryActions || 3) : 0,
            description: m.legendaryHeader ? cleanTags(flattenEntriesToText(m.legendaryHeader)) : 'The creature can take 3 legendary actions, choosing from the options below.',
            entries: (m.legendary || []).map(l => normalizeAbilityEntry(l, 'legendary', name)).filter(Boolean)
        };

        let rawLair = m.lairActions;
        if (!rawLair && m.legendaryGroup) {
            const lgKey = `${(m.legendaryGroup.name || '').toLowerCase()}|${(m.legendaryGroup.source || m.source || 'MM').toLowerCase()}`;
            const lg = legendaryGroupsMap.get(lgKey);
            if (lg && lg.lairActions) {
                rawLair = lg.lairActions;
            }
        }

        let lairActions = [];
        if (Array.isArray(rawLair)) {
            rawLair.forEach(item => {
                if (!item) return;
                if (typeof item === 'string') {
                    if (/when fighting inside its lair/i.test(item) || /on initiative count 20/i.test(item)) {
                        return;
                    }
                    lairActions.push(normalizeAbilityEntry({ name: 'Lair Action', entries: [item] }, 'lair', name));
                } else if (item.type === 'list' && Array.isArray(item.items)) {
                    item.items.forEach(li => {
                        const str = typeof li === 'string' ? li : (li.entries ? li.entries.join('\n') : JSON.stringify(li));
                        lairActions.push(normalizeAbilityEntry({ name: 'Lair Action', entries: [str] }, 'lair', name));
                    });
                } else if (typeof item === 'object') {
                    lairActions.push(normalizeAbilityEntry(item, 'lair', name));
                }
            });
            lairActions = lairActions.filter(Boolean);
        }

        // Full normalized creature payload
        const normalizedCreature = {
            id,
            name,
            source,
            edition,
            page: m.page || 0,
            isSrd: Boolean(m.srd || m.srd52),
            size: sizeFull,
            sizeCategory,
            type: typeStr,
            subtype: subTypeStr,
            alignment: alignmentStr,
            ac: acList,
            primaryAc,
            acCondition: acCond,
            hp: { average: hpAvg, formula: hpFormula },
            speed: speedObj,
            abilities,
            proficiencyBonus: pb,
            saves: m.save || {},
            skills: m.skill || {},
            senses: {
                passivePerception: m.passive || (10 + abilities.wis.mod),
                sensesString: m.senses ? (Array.isArray(m.senses) ? m.senses.join(', ') : String(m.senses)) : ''
            },
            languages: m.languages ? (Array.isArray(m.languages) ? m.languages : [String(m.languages)]) : [],
            cr: crStr,
            crNumeric: crNum,
            hasSpellcasting,
            spellcasting,
            traits,
            actions,
            bonusActions,
            reactions,
            legendaryActions,
            lairActions,
            hasToken: true,
            tokenUrl: tokenImg,
            tokenImg,
            fluff: m.fluff || null
        };

        // Catalog entry (compact summary)
        catalog.push({
            id,
            name,
            source,
            edition,
            page: m.page || 0,
            cr: crStr,
            crNumeric: crNum,
            size: sizeFull,
            sizeCategory,
            type: typeStr,
            subtype: subTypeStr,
            alignment: alignmentStr,
            ac: primaryAc,
            acCondition: acCond,
            hp: hpAvg,
            hpFormula: hpFormula,
            hasToken: true,
            tokenUrl: tokenImg,
            tokenImg,
            hasSpellcasting,
            casterLevel: mainSc ? mainSc.casterLevel : 0,
            spellAbility: mainSc ? mainSc.ability : null,
            spellSaveDc: mainSc ? mainSc.dc : null,
            spellAttackMod: mainSc ? mainSc.atkMod : null
        });

        // Group into per-source partition
        const srcKey = source.toLowerCase();
        if (!normalizedBySource[srcKey]) normalizedBySource[srcKey] = [];
        normalizedBySource[srcKey].push(normalizedCreature);
    });

    // Sort catalog by name
    catalog.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
    console.log(`📁 Master catalog generated: ${catalogPath} (${catalog.length} creatures)`);

    // Write source-partitioned files
    let totalPartitions = 0;
    for (const srcKey in normalizedBySource) {
        const partitionPath = path.join(outputDir, `bestiary-${srcKey}.json`);
        normalizedBySource[srcKey].sort((a, b) => a.name.localeCompare(b.name));
        fs.writeFileSync(partitionPath, JSON.stringify(normalizedBySource[srcKey], null, 2), 'utf8');
        totalPartitions++;
    }

    console.log(`📁 Successfully wrote ${totalPartitions} source-partitioned tables to ${outputDir}`);
    console.log(`🎉 Complete! Total normalized creatures: ${catalog.length}`);
}

buildCreatureDatabase();
