import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const dataDir = path.join(rootDir, '5etools-src', 'data');
const spellsDir = path.join(dataDir, 'spells');
const indexPath = path.join(spellsDir, 'index.json');
const sourcesPath = path.join(spellsDir, 'sources.json');
const outputPath = path.join(rootDir, '5etools-src', 'data', 'spells-normalized.json');

const SCHOOL_MAP = {
    'A': 'Abjuration',
    'C': 'Conjuration',
    'D': 'Divination',
    'E': 'Enchantment',
    'I': 'Illusion',
    'N': 'Necromancy',
    'T': 'Transmutation',
    'V': 'Evocation'
};

const AREA_TAG_MAP = {
    'S': 'Sphere',
    'C': 'Cone',
    'L': 'Line',
    'N': 'Cylinder',
    'Q': 'Cube',
    'H': 'Hemisphere',
    'W': 'Wall',
    'MT': 'Multiple Targets',
    'ST': 'Single Target'
};

const MISC_TAG_MAP = {
    'HL': 'Healing',
    'THP': 'Temp HP',
    'TP': 'Teleportation',
    'SMN': 'Summoning',
    'PRM': 'Permanent',
    'MAC': 'Modifies AC',
    'SCL': 'Scaling Damage',
    'SGT': 'Sight Required',
    'FEY': 'Fey',
    'UD': 'Undead'
};

function formatTime(timeList) {
    if (!timeList || !Array.isArray(timeList) || timeList.length === 0) return '1 action';
    return timeList.map(t => {
        const num = t.number || 1;
        let unit = t.unit || 'action';
        if (unit === 'bonus') unit = 'bonus action';
        else if (num > 1) unit = unit + 's';
        const cond = t.condition ? ` (${cleanTags(t.condition)})` : '';
        return `${num} ${unit}${cond}`;
    }).join(', ');
}

function formatRange(range) {
    if (!range) return 'Self';
    if (typeof range === 'string') return range;
    const type = range.type || '';
    if (type === 'self') return 'Self';
    if (type === 'touch') return 'Touch';
    if (type === 'sight') return 'Sight';
    if (type === 'unlimited') return 'Unlimited';
    if (range.distance) {
        const dist = range.distance.amount ? `${range.distance.amount} ${range.distance.type || 'feet'}` : (range.distance.type || '');
        if (type === 'point') return dist;
        return `Self (${dist} ${type})`;
    }
    return 'Self';
}

function formatComponents(comp) {
    if (!comp) return 'None';
    if (typeof comp === 'string') return comp;
    const parts = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m) {
        if (typeof comp.m === 'string') parts.push(`M (${cleanTags(comp.m)})`);
        else if (typeof comp.m === 'object' && comp.m.text) parts.push(`M (${cleanTags(comp.m.text)})`);
        else parts.push('M');
    }
    return parts.join(', ') || 'None';
}

function formatDuration(durList) {
    if (!durList || !Array.isArray(durList) || durList.length === 0) return 'Instantaneous';
    return durList.map(d => {
        if (d.type === 'instant') return 'Instantaneous';
        if (d.type === 'permanent') return 'Permanent';
        if (d.type === 'special') return 'Special';
        if (d.duration) {
            const conc = d.concentration ? 'Concentration, up to ' : '';
            const num = d.duration.amount || 1;
            let unit = d.duration.type || 'minute';
            if (num > 1) unit = unit + 's';
            return `${conc}${num} ${unit}`;
        }
        return 'Instantaneous';
    }).join(', ');
}

function cleanTags(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/{@damage ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@dice ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@hit ([^}|]+)[^}]*}/g, '+$1')
        .replace(/{@spell ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@condition ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@status ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@item ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@creature ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@b ([^}]+)}/g, '<strong>$1</strong>')
        .replace(/{@i ([^}]+)}/g, '<em>$1</em>')
        .replace(/{@note ([^}]+)}/g, '<em>$1</em>')
        .replace(/{@scaledamage [^|]+\|[^|]+\|([^}]+)}/g, '$1')
        .replace(/{@scaledice [^|]+\|[^|]+\|([^}]+)}/g, '$1')
        .replace(/{@filter ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@link ([^}|]+)[^}]*}/g, '$1')
        .replace(/{@chance ([^}|]+)[^}]*}/g, '$1%')
        .replace(/{@recharge ([^}|]+)[^}]*}/g, '(Recharge $1)')
        .replace(/{@\w+ ([^}|]+)[^}]*}/g, '$1');
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

function formatHigherLevel(higherLevelEntries) {
    if (!higherLevelEntries || !Array.isArray(higherLevelEntries) || higherLevelEntries.length === 0) return '';
    let html = '';
    higherLevelEntries.forEach(entry => {
        if (typeof entry === 'string') {
            html += `<p><strong><em>At Higher Levels.</em></strong> ${cleanTags(entry)}</p>`;
        } else if (typeof entry === 'object' && entry !== null) {
            const nameStr = entry.name ? `<strong><em>${cleanTags(entry.name)}.</em></strong> ` : '<strong><em>At Higher Levels.</em></strong> ';
            html += `<div class="spell-entries-higher-level">${nameStr}${renderEntriesToHtml(entry.entries)}</div>`;
        }
    });
    return html;
}

function expandTags(tagArr, tagMap) {
    if (!tagArr || !Array.isArray(tagArr)) return [];
    return tagArr.map(t => tagMap[t] || (t.charAt(0).toUpperCase() + t.slice(1))).filter(Boolean);
}

function capitalizeArray(arr) {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(str => typeof str === 'string' ? (str.charAt(0).toUpperCase() + str.slice(1)) : String(str));
}

function extractAttackStat(spell) {
    if (spell.spellAttack && Array.isArray(spell.spellAttack) && spell.spellAttack.length > 0) {
        return 'spell';
    }
    const descText = JSON.stringify(spell.entries || []);
    if (descText.includes('{@hit') || descText.includes('spell attack')) {
        return 'spell';
    }
    return 'none';
}

function extractUpcastInfo(spell) {
    let upcastBonus = '';
    let upcastScaleStep = 1;

    const descText = JSON.stringify(spell.entriesHigherLevel || spell.entries || []);
    const scaleMatch = descText.match(/\{@scale(?:damage|dice)\s+([^|}]+)\|([^|}]+)\|([^}]+)\}/i);
    if (scaleMatch) {
        upcastBonus = scaleMatch[3].trim();
        const levels = scaleMatch[2].trim();
        if (levels.includes(',')) {
            upcastScaleStep = 2;
        }
    } else if (spell.scalingLevelDice) {
        if (spell.scalingLevelDice.step) {
            upcastScaleStep = parseInt(spell.scalingLevelDice.step) || 1;
        }
        if (spell.scalingLevelDice.scaling) {
            const vals = Object.values(spell.scalingLevelDice.scaling);
            if (vals.length > 0) {
                upcastBonus = vals[0];
            }
        }
    }

    return { upcastBonus, upcastScaleStep };
}

function extractDamageList(spell) {
    const list = [];
    if (spell.damageInflict) {
        const descText = JSON.stringify(spell.entries || []);
        const diceMatches = descText.match(/{@damage ([^}]+)}/g) || [];
        diceMatches.forEach(m => {
            const formula = m.replace(/{@damage ([^}|]+)[^}]*}/, '$1');
            const type = spell.damageInflict[0] ? (spell.damageInflict[0].charAt(0).toUpperCase() + spell.damageInflict[0].slice(1)) : '';
            if (!list.some(d => d.formula === formula)) {
                list.push({ formula, type, stat: 'none' });
            }
        });
    }
    return list;
}

function extractSaveAbility(spell) {
    if (spell.savingThrow && spell.savingThrow.length > 0) {
        return spell.savingThrow[0].toLowerCase();
    }
    return '';
}

function loadSpellSourcesMap() {
    if (!fs.existsSync(sourcesPath)) return {};
    return JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
}

function extractSpellRefs(obj, spellRefs = []) {
    if (!obj) return spellRefs;
    if (typeof obj === 'string') {
        const cleaned = obj.replace(/{@spell ([^}|]+)[^}]*}/, '$1').trim();
        const parts = cleaned.split('|');
        const name = parts[0].trim();
        const source = parts[1] ? parts[1].trim() : '';
        if (name && name.length > 1) spellRefs.push({ name, source });
    } else if (Array.isArray(obj)) {
        obj.forEach(item => extractSpellRefs(item, spellRefs));
    } else if (typeof obj === 'object') {
        if (obj.spell) {
            extractSpellRefs(obj.spell, spellRefs);
        } else {
            for (let k in obj) {
                if (k !== 'name' && k !== 'source' && k !== 'ability' && k !== 'resourceName') {
                    extractSpellRefs(obj[k], spellRefs);
                }
            }
        }
    }
    return spellRefs;
}

function loadAdditionalSpellAssociations() {
    const assocMap = new Map();

    function getAssoc(spellName) {
        const k = spellName.toLowerCase().trim();
        if (!assocMap.has(k)) {
            assocMap.set(k, { subclasses: [], races: [], backgrounds: [], feats: [] });
        }
        return assocMap.get(k);
    }

    function processAdditionalSpells(addSpellsArr, targetObj, propName) {
        if (!Array.isArray(addSpellsArr)) return;
        addSpellsArr.forEach(spGroup => {
            const refs = extractSpellRefs(spGroup);
            refs.forEach(r => {
                const a = getAssoc(r.name);
                if (!a[propName].some(x => x.name === targetObj.name && x.source === targetObj.source)) {
                    a[propName].push(targetObj);
                }
            });
        });
    }

    // 1. Subclasses
    const classDir = path.join(dataDir, 'class');
    if (fs.existsSync(classDir)) {
        const classFiles = fs.readdirSync(classDir).filter(f => f.startsWith('class-') && f.endsWith('.json'));
        classFiles.forEach(f => {
            const content = JSON.parse(fs.readFileSync(path.join(classDir, f), 'utf8'));
            (content.subclass || []).forEach(sc => {
                const scObj = { name: sc.name, shortName: sc.shortName || sc.name, source: sc.source || 'PHB', className: sc.className, classSource: sc.classSource || 'PHB' };
                processAdditionalSpells(sc.additionalSpells, scObj, 'subclasses');
            });
        });
    }

    // 2. Races / Species
    const racesFile = path.join(dataDir, 'races.json');
    if (fs.existsSync(racesFile)) {
        const content = JSON.parse(fs.readFileSync(racesFile, 'utf8'));
        (content.race || []).forEach(r => {
            const rObj = { name: r.name, source: r.source || 'PHB' };
            processAdditionalSpells(r.additionalSpells, rObj, 'races');
        });
    }

    // 3. Backgrounds
    const bgFile = path.join(dataDir, 'backgrounds.json');
    if (fs.existsSync(bgFile)) {
        const content = JSON.parse(fs.readFileSync(bgFile, 'utf8'));
        (content.background || []).forEach(bg => {
            const bgObj = { name: bg.name, source: bg.source || 'PHB' };
            processAdditionalSpells(bg.additionalSpells, bgObj, 'backgrounds');
        });
    }

    // 4. Feats
    const featsFile = path.join(dataDir, 'feats.json');
    if (fs.existsSync(featsFile)) {
        const content = JSON.parse(fs.readFileSync(featsFile, 'utf8'));
        (content.feat || []).forEach(ft => {
            const ftObj = { name: ft.name, source: ft.source || 'PHB' };
            processAdditionalSpells(ft.additionalSpells, ftObj, 'feats');
        });
    }

    return assocMap;
}

function buildNormalizedDatabase() {
    console.log('📦 Reading 5etools spell sources & index...');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const sourcesData = loadSpellSourcesMap();
    const additionalAssocMap = loadAdditionalSpellAssociations();
    const allSpells = [];
    const seenSet = new Set();

    for (const sourceKey in indexData) {
        const file = indexData[sourceKey];
        const filePath = path.join(spellsDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const spellList = content.spell || [];

        spellList.forEach(sp => {
            const spellName = (sp.name || '').trim();
            const spellSource = (sp.source || sourceKey || 'PHB').trim();
            const uniqueKey = `${spellName.toLowerCase()}|${spellSource.toLowerCase()}`;

            if (seenSet.has(uniqueKey)) return;
            seenSet.add(uniqueKey);

            const schoolFull = SCHOOL_MAP[sp.school] || sp.school || 'Evocation';
            const castingTime = formatTime(sp.time);
            const range = formatRange(sp.range);
            const components = formatComponents(sp.components);
            const duration = formatDuration(sp.duration);
            const isConc = Array.isArray(sp.duration) ? sp.duration.some(d => d.concentration) : false;
            const isRitual = sp.meta?.ritual || false;
            
            const baseEntriesHtml = renderEntriesToHtml(sp.entries);
            const higherLevelHtml = formatHigherLevel(sp.entriesHigherLevel);
            const descriptionHtml = baseEntriesHtml + (higherLevelHtml ? `<br>${higherLevelHtml}` : '');

            const damageList = extractDamageList(sp);
            const saveAbility = extractSaveAbility(sp);
            const attackStat = extractAttackStat(sp);
            const { upcastBonus, upcastScaleStep } = extractUpcastInfo(sp);

            // Base class lists from sources.json
            const srcEntry = (sourcesData[spellSource] && sourcesData[spellSource][spellName]) ? sourcesData[spellSource][spellName] : null;
            const classesList = srcEntry && srcEntry.class ? srcEntry.class.map(c => c.name) : [];
            const variantClassesList = srcEntry && srcEntry.classVariant ? srcEntry.classVariant.map(c => c.name) : [];
            const combinedClasses = Array.from(new Set([...classesList, ...variantClassesList])).sort();

            // Subclasses, Races, Backgrounds, Feats from additionalAssocMap
            const assoc = additionalAssocMap.get(spellName.toLowerCase()) || { subclasses: [], races: [], backgrounds: [], feats: [] };

            const normalized = {
                id: `sp_${spellName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${spellSource.toLowerCase()}`,
                name: spellName,
                source: spellSource,
                page: sp.page || 0,
                level: sp.level !== undefined ? sp.level : 0,
                school: schoolFull,
                castingTime,
                range,
                components,
                duration,
                concentration: isConc,
                ritual: isRitual,
                descriptionHtml,
                higherLevelHtml,
                classes: combinedClasses,
                subclasses: assoc.subclasses,
                races: assoc.races,
                backgrounds: assoc.backgrounds,
                feats: assoc.feats,
                damageList,
                saveAbility,
                attackStat,
                upcastBonus,
                upcastScaleStep,
                scalingLevelDice: sp.scalingLevelDice || null,
                conditionInflict: capitalizeArray(sp.conditionInflict),
                affectsCreatureType: capitalizeArray(sp.affectsCreatureType),
                areaTags: expandTags(sp.areaTags, AREA_TAG_MAP),
                miscTags: expandTags(sp.miscTags, MISC_TAG_MAP)
            };

            allSpells.push(normalized);
        });
    }

    allSpells.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(outputPath, JSON.stringify(allSpells, null, 2), 'utf8');
    console.log(`✅ Fully expanded spell database successfully generated! Total spells: ${allSpells.length}`);
    console.log(`📁 Output path: ${outputPath}`);
}

buildNormalizedDatabase();
