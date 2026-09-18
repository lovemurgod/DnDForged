import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrewEntities } from './brew-data-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const dataDir = path.join(rootDir, '5etools-src', 'data');

function cleanTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\{@(?:spell|item|creature|condition|sense|skill|action|background|race|class|feat|table|hazard)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@(?:dice|damage|d20)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@b\s+([^}]+)\}/gi, '<strong>$1</strong>')
        .replace(/\{@i\s+([^}]+)\}/gi, '<em>$1</em>')
        .replace(/\{@u\s+([^}]+)\}/gi, '<u>$1</u>')
        .replace(/\{@s\s+([^}]+)\}/gi, '<s>$1</s>')
        .replace(/\{@note\s+([^}]+)\}/gi, '<em>Note: $1</em>')
        .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@5etools\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@[a-zA-Z0-9_-]+\s+([^}]+)\}/g, '$1');
}

function cleanTagsPlain(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\{@(?:spell|item|creature|condition|sense|skill|action|background|race|class|feat|table|hazard)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@(?:dice|damage|d20)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@b\s+([^}]+)\}/gi, '$1')
        .replace(/\{@i\s+([^}]+)\}/gi, '$1')
        .replace(/\{@u\s+([^}]+)\}/gi, '$1')
        .replace(/\{@s\s+([^}]+)\}/gi, '$1')
        .replace(/\{@note\s+([^}]+)\}/gi, 'Note: $1')
        .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@5etools\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@[a-zA-Z0-9_-]+\s+([^}]+)\}/g, '$1');
}

function renderEntriesToText(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') return cleanTagsPlain(entries);
    if (Array.isArray(entries)) {
        return entries.map(e => renderEntriesToText(e)).filter(Boolean).join('\n\n');
    }
    if (typeof entries === 'object' && entries !== null) {
        if (entries.type === 'list' && Array.isArray(entries.items)) {
            return entries.items.map(it => '- ' + renderEntriesToText(it)).join('\n');
        }
        let txt = entries.name ? `**${cleanTagsPlain(entries.name)}**` : '';
        if (entries.entry) txt += (txt ? ' ' : '') + renderEntriesToText(entries.entry);
        if (entries.entries) txt += (txt ? '\n\n' : '') + renderEntriesToText(entries.entries);
        else if (entries.items) txt += (txt ? '\n' : '') + renderEntriesToText(entries.items);
        return txt;
    }
    return '';
}

function renderEntriesToHtml(entries) {
    if (!entries || !Array.isArray(entries)) return '';
    const parts = [];
    for (const entry of entries) {
        if (typeof entry === 'string') {
            parts.push(`<p>${cleanTags(entry)}</p>`);
        } else if (typeof entry === 'object' && entry !== null) {
            if (entry.type === 'entries' || entry.name) {
                const title = entry.name ? `<strong>${cleanTags(entry.name)}.</strong> ` : '';
                const subText = entry.entries ? renderEntriesToHtml(entry.entries) : '';
                parts.push(`<div class="compendium-subentry">${title}${subText}</div>`);
            } else if (entry.type === 'list' && Array.isArray(entry.items)) {
                const lis = entry.items.map(it => `<li>${typeof it === 'string' ? cleanTags(it) : renderEntriesToHtml([it])}</li>`).join('');
                parts.push(`<ul>${lis}</ul>`);
            } else if (entry.type === 'table' && Array.isArray(entry.rows)) {
                let ths = '';
                if (Array.isArray(entry.colLabels)) {
                    ths = `<tr>${entry.colLabels.map(l => `<th>${cleanTags(l)}</th>`).join('')}</tr>`;
                }
                const trs = entry.rows.map(row => {
                    const tds = Array.isArray(row) ? row.map(cell => `<td>${cleanTags(cell)}</td>`).join('') : `<td>${cleanTags(row)}</td>`;
                    return `<tr>${tds}</tr>`;
                }).join('');
                parts.push(`<table class="compendium-table"><thead>${ths}</thead><tbody>${trs}</tbody></table>`);
            }
        }
    }
    return parts.join('\n');
}

function extractPlainText(entries) {
    if (!entries) return '';
    let str = '';
    for (const e of entries) {
        if (typeof e === 'string') str += e + ' ';
        else if (typeof e === 'object' && e !== null) {
            if (e.name) str += e.name + '. ';
            if (e.entries) str += extractPlainText(e.entries) + ' ';
            if (e.items) str += extractPlainText(e.items) + ' ';
        }
    }
    return str;
}

function detectActionType(text, featureName) {
    const lower = (featureName + ' ' + text).toLowerCase();
    if (lower.match(/(?:as a|using a|with your|as your|with a)\s+bonus action/i) || lower.match(/\bbonus action:/i) || lower.includes('second wind')) return 'bonus';
    if (lower.match(/(?:as a|using a|with your|as your|with a)\s+reaction/i) || lower.match(/\breaction:/i)) return 'reaction';
    if (lower.match(/(?:as an|take an|using an|as a magic|take the magic)\s+action/i) || lower.match(/\baction:/i) || lower.includes('present your holy symbol')) return 'action';
    return 'passive';
}

function detectFormula(entries, featureName, className, level) {
    const text = extractPlainText(entries);
    const raw = typeof entries === 'string' ? entries : JSON.stringify(entries || []);
    const combined = featureName + ' ' + text + ' ' + raw;

    // 1. Second Wind
    if (featureName === 'Second Wind') {
        const cName = className || 'Fighter';
        return {
            formula: `1d10 + @classes.${cleanId(cName)}.level`,
            formulaConfig: {
                baseDice: '1d10',
                scalingMod: 'classLevel',
                modClass: cName,
                extraBonus: 0
            }
        };
    }

    // 2. Channel Divinity: Radiance of the Dawn
    if (featureName.includes('Radiance of the Dawn')) {
        const cName = className || 'Cleric';
        return {
            formula: `2d10 + @classes.${cleanId(cName)}.level`,
            formulaConfig: {
                baseDice: '2d10',
                scalingMod: 'classLevel',
                modClass: cName,
                extraBonus: 0
            }
        };
    }

    // 3. Regex for: (dice) + (your <className> level | your level)
    const classLvlRegex = /(?:\{@(?:dice|damage)\s+([0-9]+d[0-9]+)\}|([0-9]+d[0-9]+))\s*(?:\+|plus)\s*(?:your\s+)?([a-zA-Z]+)?\s*level/i;
    const matchCls = combined.match(classLvlRegex);
    if (matchCls) {
        const dice = matchCls[1] || matchCls[2];
        const specifiedClass = matchCls[3] ? matchCls[3].trim() : '';
        const targetClass = (specifiedClass && specifiedClass.toLowerCase() !== 'character') 
            ? specifiedClass.charAt(0).toUpperCase() + specifiedClass.slice(1).toLowerCase() 
            : (className || '');
        
        const isTotalLevel = !specifiedClass || specifiedClass.toLowerCase() === 'character' || !targetClass;
        const modKey = isTotalLevel ? '@level' : `@classes.${cleanId(targetClass)}.level`;
        
        return {
            formula: `${dice} + ${modKey}`,
            formulaConfig: {
                baseDice: dice,
                scalingMod: isTotalLevel ? 'level' : 'classLevel',
                modClass: isTotalLevel ? '' : targetClass,
                extraBonus: 0
            }
        };
    }

    // 4. Regex for: (dice) + (your <ability> modifier)
    const abModRegex = /(?:\{@(?:dice|damage)\s+([0-9]+d[0-9]+)\}|([0-9]+d[0-9]+))\s*(?:\+|plus)\s*(?:your\s+)?(strength|dexterity|constitution|intelligence|wisdom|charisma)\s*modifier/i;
    const matchAb = combined.match(abModRegex);
    if (matchAb) {
        const dice = matchAb[1] || matchAb[2];
        const abMap = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
        const stat = abMap[matchAb[3].toLowerCase()] || 'STR';
        return {
            formula: `${dice} + @${stat.toLowerCase()}`,
            formulaConfig: {
                baseDice: dice,
                scalingMod: stat,
                modClass: '',
                extraBonus: 0
            }
        };
    }

    // 5. Regex for: (dice) + (your proficiency bonus | PB)
    const pbRegex = /(?:\{@(?:dice|damage)\s+([0-9]+d[0-9]+)\}|([0-9]+d[0-9]+))\s*(?:\+|plus)\s*(?:your\s+)?proficiency\s*bonus/i;
    const matchPb = combined.match(pbRegex);
    if (matchPb) {
        const dice = matchPb[1] || matchPb[2];
        return {
            formula: `${dice} + @pb`,
            formulaConfig: {
                baseDice: dice,
                scalingMod: 'PB',
                modClass: '',
                extraBonus: 0
            }
        };
    }

    // 6. Generic {@dice XdY} or {@damage XdY} in text (if single prominent roll)
    const genericDice = combined.match(/\{@(?:dice|damage)\s+([0-9]+d[0-9]+(?:\s*[+\-]\s*[0-9]+)?)\}/i);
    if (genericDice) {
        const f = genericDice[1].trim();
        const baseDiceMatch = f.match(/^([0-9]+d[0-9]+)/i);
        const extraMatch = f.match(/[+\-]\s*([0-9]+)/);
        return {
            formula: f,
            formulaConfig: {
                baseDice: baseDiceMatch ? baseDiceMatch[1] : f,
                scalingMod: 'none',
                modClass: '',
                extraBonus: extraMatch ? parseInt(extraMatch[0].replace(/\s+/g, '')) : 0
            }
        };
    }

    return { formula: '', formulaConfig: null };
}

function detectCounter(text, featureName, level) {
    const lower = (featureName + ' ' + text).toLowerCase();
    
    // Specific known class/subclass features
    if (featureName === 'Action Surge') {
        return { hasCounter: true, usesMax: (level >= 17 ? 2 : 1), resetType: 'short' };
    }
    if (featureName === 'Second Wind') {
        return { hasCounter: true, usesMax: (level >= 10 ? 3 : (level >= 4 ? 2 : 1)), resetType: 'short' };
    }
    if (featureName === 'Rage') {
        let rUses = 2;
        if (level >= 17) rUses = 6;
        else if (level >= 12) rUses = 5;
        else if (level >= 6) rUses = 4;
        else if (level >= 3) rUses = 3;
        return { hasCounter: true, usesMax: rUses, resetType: 'long' };
    }
    if (featureName === 'Indomitable') {
        let iUses = 1;
        if (level >= 17) iUses = 3;
        else if (level >= 13) iUses = 2;
        return { hasCounter: true, usesMax: iUses, resetType: 'long' };
    }
    if (featureName === 'Channel Divinity' || featureName.startsWith('Channel Divinity:') || lower.includes('use your channel divinity')) {
        let cdUses = 1;
        if (level >= 18) cdUses = 3;
        else if (level >= 6) cdUses = 2;
        return { hasCounter: true, usesMax: cdUses, resetType: 'short' };
    }
    if (featureName === 'Bardic Inspiration') {
        return { hasCounter: true, usesMax: 'CHA', resetType: (level >= 5 ? 'short' : 'long') };
    }
    if (featureName === 'Combat Superiority' || featureName === 'Superiority Dice') {
        let sDice = 4;
        if (level >= 15) sDice = 6;
        else if (level >= 7) sDice = 5;
        return { hasCounter: true, usesMax: sDice, resetType: 'short' };
    }
    if (featureName === 'Wild Shape') {
        return { hasCounter: true, usesMax: 2, resetType: 'short' };
    }
    if (featureName === 'Ki' || featureName === 'Focus Points') {
        return { hasCounter: true, usesMax: level, resetType: 'short' };
    }
    if (featureName === 'Sorcery Points') {
        return { hasCounter: true, usesMax: level, resetType: 'long' };
    }
    if (featureName === 'Lay on Hands') {
        return { hasCounter: true, usesMax: level * 5, resetType: 'long' };
    }

    // General 5e phrasing heuristics
    if (lower.match(/(?:finish|complete) a (?:short or long|short) rest before you can use (?:it|this (?:feature|trait|action)) again/)) {
        return { hasCounter: true, usesMax: 1, resetType: 'short' };
    }
    if (lower.match(/(?:finish|complete) a long rest before you can use (?:it|this (?:feature|trait|action)) again/)) {
        return { hasCounter: true, usesMax: 1, resetType: 'long' };
    }
    if (lower.match(/once you use this (?:feature|trait|action), you can't (?:do so|use it) again until you finish a (?:short or long|short) rest/)) {
        return { hasCounter: true, usesMax: 1, resetType: 'short' };
    }
    if (lower.match(/once you use this (?:feature|trait|action), you can't (?:do so|use it) again until you finish a long rest/)) {
        return { hasCounter: true, usesMax: 1, resetType: 'long' };
    }

    // Proficiency bonus times per rest
    const pbMatch = lower.match(/(?:number of times equal to|equal to) your proficiency bonus.*?regain (?:all|any) expended uses (?:when you finish|after) a (short or long|long|short) rest/);
    if (pbMatch) {
        return { hasCounter: true, usesMax: 'PB', resetType: pbMatch[1].includes('short') ? 'short' : 'long' };
    }

    // Ability modifier times per rest
    const modMatch = lower.match(/(?:number of times equal to|equal to) your (charisma|wisdom|intelligence|constitution|dexterity|strength) modifier.*?regain (?:all|any) expended uses (?:when you finish|after) a (short or long|long|short) rest/);
    if (modMatch) {
        const modMap = { charisma: 'CHA', wisdom: 'WIS', intelligence: 'INT', constitution: 'CON', dexterity: 'DEX', strength: 'STR' };
        return { hasCounter: true, usesMax: modMap[modMatch[1]], resetType: modMatch[2].includes('short') ? 'short' : 'long' };
    }

    // Number of times per rest
    const numMatch = lower.match(/you can use this feature (twice|three times|four times).*?regain.*?(short or long|long|short) rest/);
    if (numMatch) {
        const countMap = { twice: 2, 'three times': 3, 'four times': 4 };
        return { hasCounter: true, usesMax: countMap[numMatch[1]] || 2, resetType: numMatch[2].includes('short') ? 'short' : 'long' };
    }

    return { hasCounter: false, usesMax: null, resetType: null };
}

function cleanId(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// ─── 1. Races / Species Trait Unpacking ───────────────────────────────────────
function getRaceEntries(r, allRaces, visited = new Set()) {
    if (!r) return [];
    const rKey = `${(r.name || '').toLowerCase()}|${(r.source || '').toLowerCase()}`;
    if (visited.has(rKey)) return [];
    visited.add(rKey);

    if (r.entries && r.entries.length > 0) return JSON.parse(JSON.stringify(r.entries));
    if (r._copy) {
        const base = allRaces.find(x => x.name === r._copy.name && (!r._copy.source || x.source === r._copy.source));
        if (base && base !== r) {
            let entries = getRaceEntries(base, allRaces, visited);
            if (r._copy._mod && Array.isArray(r._copy._mod.entries)) {
                for (const mod of r._copy._mod.entries) {
                    if (mod.mode === 'replaceArr' && mod.replace && mod.items) {
                        const idx = entries.findIndex(e => e && e.name === mod.replace);
                        if (idx !== -1) entries[idx] = mod.items;
                        else entries.push(mod.items);
                    } else if (mod.mode === 'appendArr' && mod.items) {
                        if (Array.isArray(mod.items)) entries.push(...mod.items);
                        else entries.push(mod.items);
                    }
                }
            }
            return entries;
        }
    }
    return [];
}

function getSubraceEntries(s, allSubraces, visited = new Set()) {
    if (!s) return [];
    const sKey = `${(s.name || '').toLowerCase()}|${(s.raceName || '').toLowerCase()}|${(s.source || '').toLowerCase()}`;
    if (visited.has(sKey)) return [];
    visited.add(sKey);

    if (s.entries && s.entries.length > 0) return JSON.parse(JSON.stringify(s.entries));
    if (s._copy) {
        const base = allSubraces.find(x => x.name === s._copy.name && (!s._copy.source || x.source === s._copy.source));
        if (base && base !== s) {
            let entries = getSubraceEntries(base, allSubraces, visited);
            if (s._copy._mod && Array.isArray(s._copy._mod.entries)) {
                for (const mod of s._copy._mod.entries) {
                    if (mod.mode === 'replaceArr' && mod.replace && mod.items) {
                        const idx = entries.findIndex(e => e && e.name === mod.replace);
                        if (idx !== -1) entries[idx] = mod.items;
                        else entries.push(mod.items);
                    } else if (mod.mode === 'appendArr' && mod.items) {
                        if (Array.isArray(mod.items)) entries.push(...mod.items);
                        else entries.push(mod.items);
                    }
                }
            }
            return entries;
        }
    }
    return [];
}

function unpackRaceTraits(race, allRaces) {
    const entries = getRaceEntries(race, allRaces);
    const traits = [];
    const generalParts = [];

    for (const entry of entries) {
        if (typeof entry === 'string') {
            generalParts.push(cleanTagsPlain(entry));
            continue;
        }
        if (typeof entry === 'object' && entry !== null) {
            const traitName = entry.name ? cleanTagsPlain(entry.name) : '';
            const traitEntries = entry.entries || (entry.items ? entry.items : []);
            const traitText = renderEntriesToText(traitEntries).trim();

            if (traitName) {
                const plain = traitName + ' ' + traitText;
                const actionType = detectActionType(plain, traitName);
                const cnt = detectCounter(plain, traitName, 1);
                const fmla = detectFormula(traitEntries, traitName, '', 1);

                traits.push({
                    id: `trait_${cleanId(race.name)}_${cleanId(traitName)}_${cleanId(race.source)}`,
                    name: traitName,
                    source: race.source,
                    raceName: race.name,
                    actionType,
                    description: traitText,
                    hasCounter: cnt.hasCounter,
                    usesMax: cnt.usesMax,
                    resetType: cnt.resetType,
                    formula: fmla.formula || '',
                    formulaConfig: fmla.formulaConfig || null,
                    rawEntries: traitEntries
                });
            } else if (traitText) {
                generalParts.push(traitText);
            }
        }
    }

    const generalDesc = generalParts.join('\n\n');
    return { traits, generalDesc };
}

function unpackSubraceTraits(subrace, allSubraces) {
    const entries = getSubraceEntries(subrace, allSubraces);
    const traits = [];
    const generalParts = [];

    for (const entry of entries) {
        if (typeof entry === 'string') {
            generalParts.push(cleanTagsPlain(entry));
            continue;
        }
        if (typeof entry === 'object' && entry !== null) {
            const traitName = entry.name ? cleanTagsPlain(entry.name) : '';
            const traitEntries = entry.entries || (entry.items ? entry.items : []);
            const traitText = renderEntriesToText(traitEntries).trim();

            if (traitName) {
                const plain = traitName + ' ' + traitText;
                const actionType = detectActionType(plain, traitName);
                const cnt = detectCounter(plain, traitName, 1);
                const fmla = detectFormula(traitEntries, traitName, '', 1);

                traits.push({
                    id: `trait_${cleanId(subrace.raceName || '')}_${cleanId(subrace.name)}_${cleanId(traitName)}_${cleanId(subrace.source)}`,
                    name: traitName,
                    source: subrace.source,
                    raceName: subrace.raceName || subrace.name,
                    subraceName: subrace.name,
                    actionType,
                    description: traitText,
                    hasCounter: cnt.hasCounter,
                    usesMax: cnt.usesMax,
                    resetType: cnt.resetType,
                    formula: fmla.formula || '',
                    formulaConfig: fmla.formulaConfig || null,
                    rawEntries: traitEntries
                });
            } else if (traitText) {
                generalParts.push(traitText);
            }
        }
    }

    const generalDesc = generalParts.join('\n\n');
    return { traits, generalDesc };
}

function buildRaces() {
    console.log('📦 Normalizing Races & Species with Unpacked Traits...');
    const racesFile = path.join(dataDir, 'races.json');
    if (!fs.existsSync(racesFile)) return;

    const data = JSON.parse(fs.readFileSync(racesFile, 'utf8'));
    const rawList = [...(data.race || []), ...getBrewEntities('race')];
    const rawSubList = [...(data.subrace || []), ...getBrewEntities('subrace')];
    const allRaces = [];
    const seen = new Set();

    // 1. Unpack traits on all primary races and store back in data.race
    for (const r of rawList) {
        const name = (r.name || '').trim();
        const source = (r.source || 'PHB').trim();
        if (!name) continue;

        const { traits, generalDesc } = unpackRaceTraits(r, rawList);
        r.traits = traits;
        r.description = generalDesc || traits.map(t => `**${t.name}**: ${t.description}`).join('\n\n');

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (!seen.has(key)) {
            seen.add(key);

            const size = Array.isArray(r.size) ? r.size.join('/') : (r.size || 'Medium');
            let speed = '30 ft';
            if (typeof r.speed === 'number') speed = `${r.speed} ft`;
            else if (typeof r.speed === 'object' && r.speed !== null) {
                speed = Object.entries(r.speed).map(([k, v]) => `${k !== 'walk' ? k + ' ' : ''}${v} ft`).join(', ');
            }

            const traitsHtml = renderEntriesToHtml(r.entries || []);

            allRaces.push({
                id: `race_${cleanId(name)}_${cleanId(source)}`,
                name,
                source,
                page: r.page || 0,
                size,
                speed,
                traitsHtml,
                traits,
                description: r.description
            });
        }
    }

    // 2. Unpack traits on all subraces and combine with base race traits
    for (const s of rawSubList) {
        const subName = (s.name || '').trim();
        const raceName = (s.raceName || '').trim();
        const source = (s.source || 'PHB').trim();
        if (!subName || !raceName) continue;

        const baseRace = rawList.find(x => x.name.toLowerCase() === raceName.toLowerCase() && (!s.raceSource || x.source.toLowerCase() === s.raceSource.toLowerCase()));
        const baseTraits = baseRace?.traits || [];

        const { traits: subTraits, generalDesc: subDesc } = unpackSubraceTraits(s, rawSubList);
        
        // Merge base traits and subrace traits (avoid duplicate trait names)
        const combinedTraits = [...baseTraits];
        for (const st of subTraits) {
            const existingIdx = combinedTraits.findIndex(t => t.name.toLowerCase() === st.name.toLowerCase());
            if (existingIdx !== -1) {
                combinedTraits[existingIdx] = st;
            } else {
                combinedTraits.push(st);
            }
        }

        s.traits = combinedTraits;
        s.description = subDesc || combinedTraits.map(t => `**${t.name}**: ${t.description}`).join('\n\n');

        const displayName = `${raceName} (${subName})`;
        const key = `${displayName.toLowerCase()}|${source.toLowerCase()}`;
        if (!seen.has(key)) {
            seen.add(key);

            const size = Array.isArray(s.size) ? s.size.join('/') : (s.size || baseRace?.size || 'Medium');
            let speed = '30 ft';
            if (typeof s.speed === 'number') speed = `${s.speed} ft`;
            else if (typeof s.speed === 'object' && s.speed !== null) {
                speed = Object.entries(s.speed).map(([k, v]) => `${k !== 'walk' ? k + ' ' : ''}${v} ft`).join(', ');
            } else if (baseRace?.speed) {
                speed = typeof baseRace.speed === 'number' ? `${baseRace.speed} ft` : '30 ft';
            }

            allRaces.push({
                id: `race_${cleanId(raceName)}_${cleanId(subName)}_${cleanId(source)}`,
                name: displayName,
                raceName,
                subraceName: subName,
                source,
                page: s.page || baseRace?.page || 0,
                size,
                speed,
                traitsHtml: renderEntriesToHtml(s.entries || []),
                traits: combinedTraits,
                description: s.description
            });
        }
    }

    // Save enriched data back to races.json
    fs.writeFileSync(racesFile, JSON.stringify(data, null, 2), 'utf8');

    allRaces.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog with pre-unpacked traits and descriptions
    const catalog = allRaces.map(r => ({ 
        id: r.id, 
        name: r.name, 
        source: r.source, 
        page: r.page, 
        size: r.size, 
        speed: r.speed,
        traits: r.traits,
        description: r.description
    }));
    fs.writeFileSync(path.join(dataDir, 'races-catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

    // Partitions
    const partDir = path.join(dataDir, 'races-normalized');
    if (!fs.existsSync(partDir)) fs.mkdirSync(partDir, { recursive: true });

    const grouped = new Map();
    for (const r of allRaces) {
        const srcKey = r.source.toLowerCase();
        if (!grouped.has(srcKey)) grouped.set(srcKey, []);
        grouped.get(srcKey).push(r);
    }
    for (const [srcKey, list] of grouped.entries()) {
        fs.writeFileSync(path.join(partDir, `races-${srcKey}.json`), JSON.stringify(list, null, 2), 'utf8');
    }
    console.log(`✅ Races catalog: ${catalog.length} entries (with ${catalog.reduce((acc, r) => acc + (r.traits?.length || 0), 0)} pre-unpacked traits) across ${grouped.size} partitions.`);
}

// ─── 2. Feats ─────────────────────────────────────────────────────────────────
function buildFeats() {
    console.log('📦 Normalizing Feats...');
    const featsFile = path.join(dataDir, 'feats.json');
    if (!fs.existsSync(featsFile)) return;

    const data = JSON.parse(fs.readFileSync(featsFile, 'utf8'));
    const rawList = [...(data.feat || []), ...getBrewEntities('feat')];
    const allFeats = [];
    const seen = new Set();

    for (const f of rawList) {
        const name = (f.name || '').trim();
        const source = (f.source || 'PHB').trim();
        if (!name) continue;

        const desc = renderEntriesToText(f.entries || []);
        const plain = (f.name || '') + ' ' + desc;
        const actionType = detectActionType(plain, f.name);
        const cnt = detectCounter(plain, f.name, 1);
        const fmla = detectFormula(f.entries, f.name, '', 1);

        f.description = desc;
        f.actionType = actionType;
        f.hasCounter = cnt.hasCounter;
        f.usesMax = cnt.usesMax;
        f.resetType = cnt.resetType;
        f.formula = fmla.formula || '';
        f.formulaConfig = fmla.formulaConfig || null;

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let prereq = 'None';
        if (Array.isArray(f.prerequisite)) {
            prereq = f.prerequisite.map(p => {
                const parts = [];
                if (p.level) parts.push(`Level ${p.level.level || p.level}`);
                if (p.ability) parts.push(...p.ability.map(a => Object.entries(a).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' or ')));
                if (p.spellcasting) parts.push('Spellcasting ability');
                if (p.proficiency) parts.push(...p.proficiency.map(pr => Object.entries(pr).map(([k, v]) => `${v} proficiency`).join(' ')));
                if (p.race) parts.push(p.race.map(rc => rc.name).join(' or '));
                return parts.join(', ');
            }).filter(Boolean).join('; ') || 'None';
        }

        const entriesHtml = renderEntriesToHtml(f.entries || []);

        allFeats.push({
            id: `feat_${cleanId(name)}_${cleanId(source)}`,
            name,
            source,
            page: f.page || 0,
            prerequisite: prereq,
            entriesHtml,
            description: desc,
            actionType,
            hasCounter: cnt.hasCounter,
            usesMax: cnt.usesMax,
            resetType: cnt.resetType,
            formula: fmla.formula || '',
            formulaConfig: fmla.formulaConfig || null
        });
    }

    fs.writeFileSync(featsFile, JSON.stringify(data, null, 2), 'utf8');

    allFeats.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog with descriptions & pre-computed mechanics
    const catalog = allFeats.map(f => ({ 
        id: f.id, 
        name: f.name, 
        source: f.source, 
        page: f.page, 
        prerequisite: f.prerequisite,
        description: f.description,
        actionType: f.actionType,
        hasCounter: f.hasCounter,
        usesMax: f.usesMax,
        resetType: f.resetType,
        formula: f.formula,
        formulaConfig: f.formulaConfig
    }));
    fs.writeFileSync(path.join(dataDir, 'feats-catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

    // Partitions
    const partDir = path.join(dataDir, 'feats-normalized');
    if (!fs.existsSync(partDir)) fs.mkdirSync(partDir, { recursive: true });

    const grouped = new Map();
    for (const f of allFeats) {
        const srcKey = f.source.toLowerCase();
        if (!grouped.has(srcKey)) grouped.set(srcKey, []);
        grouped.get(srcKey).push(f);
    }
    for (const [srcKey, list] of grouped.entries()) {
        fs.writeFileSync(path.join(partDir, `feats-${srcKey}.json`), JSON.stringify(list, null, 2), 'utf8');
    }
    console.log(`✅ Feats catalog: ${catalog.length} entries across ${grouped.size} partitions.`);
}

// ─── 3. Backgrounds ───────────────────────────────────────────────────────────
function parseBackgroundSkills(b) {
    const fixed = [];
    let choose = null;
    if (Array.isArray(b.skillProficiencies)) {
        for (const sp of b.skillProficiencies) {
            if (typeof sp === 'string') {
                fixed.push(sp.charAt(0).toUpperCase() + sp.slice(1).toLowerCase());
            } else if (typeof sp === 'object' && sp !== null) {
                if (sp.choose) {
                    choose = {
                        count: sp.choose.count || 1,
                        from: (sp.choose.from || []).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
                    };
                }
                for (const [k, v] of Object.entries(sp)) {
                    if (k !== 'choose' && v === true) {
                        fixed.push(k.charAt(0).toUpperCase() + k.slice(1).toLowerCase());
                    }
                }
            }
        }
    }
    return { fixed: Array.from(new Set(fixed)), choose };
}

function formatToolName(str) {
    if (!str) return '';
    return str
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .replace(/Tool(s?)\b/gi, 'Tools')
        .replace(/Supplie(s?)\b/gi, 'Supplies')
        .replace(/Kit(s?)\b/gi, 'Kit');
}

function parseBackgroundTools(b) {
    const fixed = [];
    let choose = null;
    if (Array.isArray(b.toolProficiencies)) {
        for (const tp of b.toolProficiencies) {
            if (typeof tp === 'string') {
                fixed.push(formatToolName(tp));
            } else if (typeof tp === 'object' && tp !== null) {
                if (tp.choose) {
                    choose = {
                        count: tp.choose.count || 1,
                        from: (tp.choose.from || []).map(formatToolName)
                    };
                }
                for (const [k, v] of Object.entries(tp)) {
                    if (k !== 'choose' && v === true) {
                        fixed.push(formatToolName(k));
                    } else if (k.startsWith('any')) {
                        const label = k === 'anyMusicalInstrument' ? 'Musical Instrument of your choice'
                            : (k === 'anyArtisansTool' ? 'Artisan\'s Tools of your choice'
                            : formatToolName(k));
                        choose = choose || { count: v === true ? 1 : (v || 1), from: [label] };
                    }
                }
            }
        }
    }
    return { fixed: Array.from(new Set(fixed)), choose };
}

function cleanItemName(str) {
    if (!str) return '';
    return str.replace(/\|[^}]+$/g, '').replace(/\{@item\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1').trim();
}

function parseItemEntry(entry) {
    if (typeof entry === 'string') {
        return { name: cleanItemName(entry), quantity: 1, type: 'item' };
    }
    if (typeof entry === 'object' && entry !== null) {
        if (entry.value !== undefined) {
            const gp = Math.floor(entry.value / 100);
            return { name: `${gp} gp`, quantity: 1, type: 'currency', gp };
        }
        let name = entry.displayName || cleanItemName(entry.item) || entry.special || 'Special Item';
        let gp = 0;
        if (entry.containsValue) {
            gp = Math.floor(entry.containsValue / 100);
        }
        return {
            name,
            quantity: entry.quantity || 1,
            type: entry.special ? 'special' : 'item',
            containedGp: gp
        };
    }
    return null;
}

function parseBackgroundEquipment(b) {
    const raw = b.startingEquipment || [];
    const fixedItems = [];
    let fixedGold = 0;
    const choiceSets = [];

    for (const group of raw) {
        if (Array.isArray(group)) {
            for (const it of group) {
                const p = parseItemEntry(it);
                if (p) {
                    if (p.type === 'currency') fixedGold += p.gp;
                    else {
                        if (p.containedGp) fixedGold += p.containedGp;
                        fixedItems.push(p);
                    }
                }
            }
        } else if (typeof group === 'object' && group !== null) {
            if (group._) {
                for (const it of group._) {
                    const p = parseItemEntry(it);
                    if (p) {
                        if (p.type === 'currency') fixedGold += p.gp;
                        else {
                            if (p.containedGp) fixedGold += p.containedGp;
                            fixedItems.push(p);
                        }
                    }
                }
            }
            
            const optKeys = Object.keys(group).filter(k => k !== '_' && k.length <= 2);
            if (optKeys.length > 0) {
                const options = [];
                for (const k of optKeys) {
                    const list = Array.isArray(group[k]) ? group[k] : [group[k]];
                    const items = [];
                    let gold = 0;
                    for (const it of list) {
                        const p = parseItemEntry(it);
                        if (p) {
                            if (p.type === 'currency') gold += p.gp;
                            else {
                                if (p.containedGp) gold += p.containedGp;
                                items.push(p);
                            }
                        }
                    }
                    const label = items.length > 0 
                        ? items.map(i => (i.quantity > 1 ? `${i.quantity}x ` : '') + i.name).join(', ') + (gold > 0 ? ` + ${gold} gp` : '')
                        : `${gold} gp`;
                    options.push({ key: k.toUpperCase(), label, items, gold });
                }
                choiceSets.push({ options });
            }
        }
    }

    return { fixedItems, fixedGold, choiceSets };
}

function extractBackgroundFeatures(b) {
    const features = [];
    if (!b.entries || !Array.isArray(b.entries)) return features;

    for (const entry of b.entries) {
        if (typeof entry === 'object' && entry !== null && entry.name) {
            const isFeat = (entry.data && entry.data.isFeature) ||
                entry.name.toLowerCase().startsWith('feature:') ||
                entry.name.toLowerCase().startsWith('feature -') ||
                entry.name.toLowerCase().includes('specialty');
            if (isFeat) {
                const cleanName = cleanTagsPlain(entry.name).replace(/^Feature:\s*/i, 'Feature: ');
                const text = renderEntriesToText(entry.entries || entry.items || []);
                features.push({
                    name: cleanName,
                    description: text.trim()
                });
            }
        }
    }
    if (features.length === 0 && Array.isArray(b.feats)) {
        for (const fObj of b.feats) {
            if (typeof fObj === 'object' && fObj !== null) {
                for (const k of Object.keys(fObj)) {
                    const featName = k.replace(/\|.*$/, '').replace(/;/g, ' -')
                        .split(' ')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
                    features.push({
                        name: `Bonus Feat: ${featName}`,
                        description: `This background grants the ${featName} feat.`
                    });
                }
            }
        }
    }
    if (features.length === 0) {
        for (const entry of b.entries) {
            if (typeof entry === 'object' && entry !== null && entry.name) {
                const lower = entry.name.toLowerCase();
                if (!lower.includes('suggested characteristics') && 
                    !lower.includes('personality trait') && 
                    !lower.includes('ideal') && 
                    !lower.includes('bond') && 
                    !lower.includes('flaw') && 
                    !lower.includes('proficiency') && 
                    !lower.includes('ability score') &&
                    !lower.includes('equipment')) {
                    features.push({
                        name: cleanTagsPlain(entry.name),
                        description: renderEntriesToText(entry.entries || []).trim()
                    });
                }
            }
        }
    }
    return features;
}

function buildBackgrounds() {
    console.log('📦 Normalizing Backgrounds with Skills, Tools & Equipment...');
    const bgFile = path.join(dataDir, 'backgrounds.json');
    if (!fs.existsSync(bgFile)) return;

    const data = JSON.parse(fs.readFileSync(bgFile, 'utf8'));
    const rawList = [...(data.background || []), ...getBrewEntities('background')];
    const allBg = [];
    const seen = new Set();

    for (const b of rawList) {
        const name = (b.name || '').trim();
        const source = (b.source || 'PHB').trim();
        if (!name) continue;

        const desc = renderEntriesToText(b.entries || []);
        const plain = (b.name || '') + ' ' + desc;
        const actionType = detectActionType(plain, b.name);
        const cnt = detectCounter(plain, b.name, 1);
        const fmla = detectFormula(b.entries, b.name, '', 1);

        const skillsData = parseBackgroundSkills(b);
        const toolsData = parseBackgroundTools(b);
        const equipmentData = parseBackgroundEquipment(b);
        const features = extractBackgroundFeatures(b);

        b.description = desc;
        b.actionType = actionType;
        b.hasCounter = cnt.hasCounter;
        b.usesMax = cnt.usesMax;
        b.resetType = cnt.resetType;
        b.formula = fmla.formula || '';
        b.formulaConfig = fmla.formulaConfig || null;

        b.skillsData = skillsData;
        b.toolsData = toolsData;
        b.equipmentData = equipmentData;
        b.features = features;

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let skills = skillsData.fixed.join(', ');
        if (skillsData.choose) {
            skills += (skills ? '; ' : '') + `Choose ${skillsData.choose.count} from ${skillsData.choose.from.join(', ')}`;
        }
        if (!skills) skills = 'None';

        let tools = toolsData.fixed.join(', ');
        if (toolsData.choose) {
            tools += (tools ? '; ' : '') + `Choose ${toolsData.choose.count} from ${toolsData.choose.from.join(', ')}`;
        }
        if (!tools) tools = 'None';

        const entriesHtml = renderEntriesToHtml(b.entries || []);

        allBg.push({
            id: `bg_${cleanId(name)}_${cleanId(source)}`,
            name,
            source,
            page: b.page || 0,
            skills,
            tools,
            skillsData,
            toolsData,
            equipmentData,
            features,
            entriesHtml,
            description: desc,
            actionType,
            hasCounter: cnt.hasCounter,
            usesMax: cnt.usesMax,
            resetType: cnt.resetType,
            formula: fmla.formula || '',
            formulaConfig: fmla.formulaConfig || null
        });
    }

    fs.writeFileSync(bgFile, JSON.stringify(data, null, 2), 'utf8');

    allBg.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog with pre-parsed skillsData, toolsData, equipmentData, features
    const catalog = allBg.map(b => ({ 
        id: b.id, 
        name: b.name, 
        source: b.source, 
        page: b.page, 
        skills: b.skills,
        tools: b.tools,
        skillsData: b.skillsData,
        toolsData: b.toolsData,
        equipmentData: b.equipmentData,
        features: b.features,
        description: b.description,
        actionType: b.actionType,
        hasCounter: b.hasCounter,
        usesMax: b.usesMax,
        resetType: b.resetType,
        formula: b.formula,
        formulaConfig: b.formulaConfig
    }));
    fs.writeFileSync(path.join(dataDir, 'backgrounds-catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

    // Partitions
    const partDir = path.join(dataDir, 'backgrounds-normalized');
    if (!fs.existsSync(partDir)) fs.mkdirSync(partDir, { recursive: true });

    const grouped = new Map();
    for (const b of allBg) {
        const srcKey = b.source.toLowerCase();
        if (!grouped.has(srcKey)) grouped.set(srcKey, []);
        grouped.get(srcKey).push(b);
    }
    for (const [srcKey, list] of grouped.entries()) {
        fs.writeFileSync(path.join(partDir, `backgrounds-${srcKey}.json`), JSON.stringify(list, null, 2), 'utf8');
    }
    console.log(`✅ Backgrounds catalog: ${catalog.length} entries with pre-computed skills, tools, equipment, features across ${grouped.size} partitions.`);
}

// ─── 4. Classes & Subclasses (with full feature trees & usage counters) ────────
function buildClasses() {
    console.log('📦 Normalizing Classes, Subclasses & Feature Trees...');
    const classDir = path.join(dataDir, 'class');
    if (!fs.existsSync(classDir)) return;

    const rawClasses = [];
    const rawSubclasses = [];
    const rawClassFeatures = [];
    const rawSubclassFeatures = [];

    for (const file of fs.readdirSync(classDir)) {
        if (!file.startsWith('class-') || !file.endsWith('.json')) continue;
        const filePath = path.join(classDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            let modified = false;

            if (data.classFeature) {
                data.classFeature.forEach(cf => {
                    const plainText = extractPlainText(cf.entries);
                    cf.actionType = detectActionType(plainText, cf.name);
                    const cnt = detectCounter(plainText, cf.name, cf.level || 1);
                    cf.hasCounter = cnt.hasCounter;
                    cf.usesMax = cnt.usesMax;
                    cf.resetType = cnt.resetType;
                    const fmla = detectFormula(cf.entries, cf.name, cf.className, cf.level || 1);
                    cf.formula = fmla.formula || '';
                    cf.formulaConfig = fmla.formulaConfig || null;
                });
                modified = true;
                rawClassFeatures.push(...data.classFeature);
            }

            if (data.subclassFeature) {
                data.subclassFeature.forEach(sf => {
                    const plainText = extractPlainText(sf.entries);
                    sf.actionType = detectActionType(plainText, sf.name);
                    const cnt = detectCounter(plainText, sf.name, sf.level || 1);
                    sf.hasCounter = cnt.hasCounter;
                    sf.usesMax = cnt.usesMax;
                    sf.resetType = cnt.resetType;
                    const fmla = detectFormula(sf.entries, sf.name, sf.className, sf.level || 1);
                    sf.formula = fmla.formula || '';
                    sf.formulaConfig = fmla.formulaConfig || null;
                });
                modified = true;
                rawSubclassFeatures.push(...data.subclassFeature);
            }

            if (data.class) rawClasses.push(...data.class);
            if (data.subclass) rawSubclasses.push(...data.subclass);

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }

    // Ingest Partnered and UA classes, subclasses, and features
    const brewClassFeatures = getBrewEntities('classFeature');
    brewClassFeatures.forEach(cf => {
        const plainText = extractPlainText(cf.entries);
        cf.actionType = detectActionType(plainText, cf.name);
        const cnt = detectCounter(plainText, cf.name, cf.level || 1);
        cf.hasCounter = cnt.hasCounter;
        cf.usesMax = cnt.usesMax;
        cf.resetType = cnt.resetType;
        const fmla = detectFormula(cf.entries, cf.name, cf.className, cf.level || 1);
        cf.formula = fmla.formula || '';
        cf.formulaConfig = fmla.formulaConfig || null;
    });
    rawClassFeatures.push(...brewClassFeatures);

    const brewSubclassFeatures = getBrewEntities('subclassFeature');
    brewSubclassFeatures.forEach(sf => {
        const plainText = extractPlainText(sf.entries);
        sf.actionType = detectActionType(plainText, sf.name);
        const cnt = detectCounter(plainText, sf.name, sf.level || 1);
        sf.hasCounter = cnt.hasCounter;
        sf.usesMax = cnt.usesMax;
        sf.resetType = cnt.resetType;
        const fmla = detectFormula(sf.entries, sf.name, sf.className, sf.level || 1);
        sf.formula = fmla.formula || '';
        sf.formulaConfig = fmla.formulaConfig || null;
    });
    rawSubclassFeatures.push(...brewSubclassFeatures);

    rawClasses.push(...getBrewEntities('class'));
    rawSubclasses.push(...getBrewEntities('subclass'));

    console.log(`Loaded ${rawClasses.length} classes, ${rawSubclasses.length} subclasses, ${rawClassFeatures.length} class features, ${rawSubclassFeatures.length} subclass features.`);

    // 1. Process Class Features
    const processedClassFeatures = rawClassFeatures.map(cf => {
        const plainText = extractPlainText(cf.entries);
        const actionType = cf.actionType || detectActionType(plainText, cf.name);
        const cnt = (cf.hasCounter !== undefined) ? { hasCounter: cf.hasCounter, usesMax: cf.usesMax, resetType: cf.resetType } : detectCounter(plainText, cf.name, cf.level || 1);
        const fmla = cf.formulaConfig ? { formula: cf.formula, formulaConfig: cf.formulaConfig } : detectFormula(cf.entries, cf.name, cf.className, cf.level || 1);
        return {
            id: `cf_${cleanId(cf.className)}_${cleanId(cf.classSource)}_${cleanId(cf.name)}_${cf.level}`,
            name: cf.name,
            source: cf.source,
            page: cf.page || 0,
            className: cf.className,
            classSource: cf.classSource,
            level: cf.level || 1,
            actionType,
            hasCounter: cnt.hasCounter,
            usesMax: cnt.usesMax,
            resetType: cnt.resetType,
            formula: fmla.formula || '',
            formulaConfig: fmla.formulaConfig || null,
            entriesHtml: renderEntriesToHtml(cf.entries || []),
            rawEntries: cf.entries || []
        };
    });

    // 2. Process Subclass Features
    const processedSubclassFeatures = rawSubclassFeatures.map(sf => {
        const plainText = extractPlainText(sf.entries);
        const actionType = sf.actionType || detectActionType(plainText, sf.name);
        const cnt = (sf.hasCounter !== undefined) ? { hasCounter: sf.hasCounter, usesMax: sf.usesMax, resetType: sf.resetType } : detectCounter(plainText, sf.name, sf.level || 1);
        const fmla = sf.formulaConfig ? { formula: sf.formula, formulaConfig: sf.formulaConfig } : detectFormula(sf.entries, sf.name, sf.className, sf.level || 1);
        return {
            id: `scf_${cleanId(sf.className)}_${cleanId(sf.subclassShortName)}_${cleanId(sf.subclassSource)}_${cleanId(sf.name)}_${sf.level}`,
            name: sf.name,
            source: sf.source,
            page: sf.page || 0,
            className: sf.className,
            classSource: sf.classSource,
            subclassShortName: sf.subclassShortName,
            subclassSource: sf.subclassSource,
            level: sf.level || 1,
            actionType,
            hasCounter: cnt.hasCounter,
            usesMax: cnt.usesMax,
            resetType: cnt.resetType,
            formula: fmla.formula || '',
            formulaConfig: fmla.formulaConfig || null,
            entriesHtml: renderEntriesToHtml(sf.entries || []),
            rawEntries: sf.entries || []
        };
    });

    // Subclass Feature query helper (direct match or _copy fallback)
    function getSubclassFeatures(className, classSource, shortName, source) {
        return processedSubclassFeatures.filter(sf =>
            (sf.className || '').toLowerCase() === className.toLowerCase() &&
            (sf.classSource || '').toLowerCase() === classSource.toLowerCase() &&
            (sf.subclassShortName || '').toLowerCase() === shortName.toLowerCase() &&
            (sf.subclassSource || '').toLowerCase() === source.toLowerCase()
        );
    }

    // 3. Process Subclasses and attach their Subclass Features
    const processedSubclasses = rawSubclasses.map(sc => {
        const scName = sc.name || '';
        const shortName = sc.shortName || scName;
        const className = sc.className || '';
        const classSource = sc.classSource || 'PHB';
        const scSource = sc.source || 'PHB';

        let features = getSubclassFeatures(className, classSource, shortName, scSource);
        
        // If 0 features and has _copy, inherit features from copied target
        if (features.length === 0 && sc._copy) {
            const cp = sc._copy;
            const targetClass = cp.className || className;
            const targetClassSrc = cp.classSource || 'PHB';
            const targetShort = cp.shortName || shortName;
            const targetSrc = cp.source || scSource;
            features = getSubclassFeatures(targetClass, targetClassSrc, targetShort, targetSrc);
        }

        features.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

        return {
            id: `subclass_${cleanId(className)}_${cleanId(shortName)}_${cleanId(scSource)}`,
            name: scName,
            shortName,
            source: scSource,
            page: sc.page || 0,
            className,
            classSource,
            features
        };
    });

    // 4. Process Classes and attach their Class Features & Subclasses
    const allClasses = [];
    const seen = new Set();

    for (const c of rawClasses) {
        const name = (c.name || '').trim();
        const source = (c.source || 'PHB').trim();
        if (!name) continue;

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const hitDie = c.hd ? `d${c.hd.faces || 8}` : 'd8';

        const features = processedClassFeatures.filter(cf =>
            (cf.className || '').toLowerCase() === name.toLowerCase() &&
            (cf.classSource || '').toLowerCase() === source.toLowerCase()
        ).sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

        // Get subclasses for this class and deduplicate by name (prefer native source or higher feature count)
        const rawClassSubclasses = processedSubclasses.filter(sc =>
            (sc.className || '').toLowerCase() === name.toLowerCase() &&
            (sc.classSource || '').toLowerCase() === source.toLowerCase()
        );

        const scByName = new Map();
        for (const sc of rawClassSubclasses) {
            const lowName = sc.name.toLowerCase();
            if (!scByName.has(lowName)) {
                scByName.set(lowName, sc);
            } else {
                const existing = scByName.get(lowName);
                const isNative = sc.source.toLowerCase() === source.toLowerCase();
                const wasNative = existing.source.toLowerCase() === source.toLowerCase();
                if ((isNative && !wasNative) || (sc.features.length > existing.features.length)) {
                    scByName.set(lowName, sc);
                }
            }
        }

        const subclasses = Array.from(scByName.values()).sort((a, b) => a.name.localeCompare(b.name));

        allClasses.push({
            id: `class_${cleanId(name)}_${cleanId(source)}`,
            name,
            source,
            page: c.page || 0,
            hitDie,
            primaryAbility: c.primaryAbility ? Object.keys(c.primaryAbility).join(', ').toUpperCase() : 'None',
            features,
            subclasses
        });
    }

    allClasses.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog
    const catalog = allClasses.map(c => ({
        id: c.id,
        name: c.name,
        source: c.source,
        page: c.page,
        hitDie: c.hitDie,
        featuresCount: c.features.length,
        subclassesCount: c.subclasses.length,
        subclasses: c.subclasses.map(s => ({
            id: s.id,
            name: s.name,
            shortName: s.shortName,
            source: s.source,
            featuresCount: s.features.length
        }))
    }));
    fs.writeFileSync(path.join(dataDir, 'classes-catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

    // Partitions
    const partDir = path.join(dataDir, 'classes-normalized');
    if (!fs.existsSync(partDir)) fs.mkdirSync(partDir, { recursive: true });

    const grouped = new Map();
    for (const c of allClasses) {
        const srcKey = c.source.toLowerCase();
        if (!grouped.has(srcKey)) grouped.set(srcKey, []);
        grouped.get(srcKey).push(c);
    }
    for (const [srcKey, list] of grouped.entries()) {
        fs.writeFileSync(path.join(partDir, `classes-${srcKey}.json`), JSON.stringify(list, null, 2), 'utf8');
    }
    console.log(`✅ Classes catalog: ${catalog.length} classes across ${grouped.size} partitions.`);
}

console.log('🚀 Starting Compendium Compilers...');
buildRaces();
buildFeats();
buildBackgrounds();
buildClasses();
console.log('🎉 All compendium databases successfully compiled!');
