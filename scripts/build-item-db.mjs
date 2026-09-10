import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const dataDir = path.join(rootDir, '5etools-src', 'data');
const itemsFile = path.join(dataDir, 'items.json');
const baseItemsFile = path.join(dataDir, 'items-base.json');
const magicVariantsFile = path.join(dataDir, 'magicvariants.json');
const fluffFile = path.join(dataDir, 'fluff-items.json');

const catalogPath = path.join(dataDir, 'items-catalog.json');
const partitionsDir = path.join(dataDir, 'items-normalized');

const ITEM_TYPE_MAP = {
    'M': 'Melee Weapon',
    'R': 'Ranged Weapon',
    'LA': 'Light Armor',
    'MA': 'Medium Armor',
    'HA': 'Heavy Armor',
    'S': 'Shield',
    'W': 'Wondrous Item',
    'P': 'Potion',
    'SC': 'Scroll',
    'RG': 'Ring',
    'RD': 'Rod',
    'WD': 'Wand',
    'ST': 'Staff',
    'A': 'Ammunition',
    'EXP': 'Explosive',
    'G': 'Adventuring Gear',
    'T': 'Tool',
    'AT': 'Artisan Tool',
    'GS': 'Gaming Set',
    'INS': 'Musical Instrument',
    'TAH': 'Tack and Harness',
    'TG': 'Trade Good',
    'OTH': 'Other'
};

const PROPERTY_MAP = {
    'A': 'Ammunition',
    'F': 'Finesse',
    'H': 'Heavy',
    'L': 'Light',
    'LD': 'Loading',
    'R': 'Reach',
    'T': 'Thrown',
    '2H': 'Two-Handed',
    'V': 'Versatile',
    'S': 'Special'
};

const DMG_TYPE_MAP = {
    'S': 'slashing',
    'P': 'piercing',
    'B': 'bludgeoning',
    'C': 'cold',
    'F': 'fire',
    'L': 'lightning',
    'T': 'thunder',
    'A': 'acid',
    'I': 'poison',
    'N': 'necrotic',
    'R': 'radiant',
    'O': 'force',
    'Y': 'psychic'
};

function cleanTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\{@(?:spell|item|creature|condition|sense|skill|action|background|race|class|feat|table|hazard)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@(?:dice|damage|d20)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@b\s+([^}]+)\}/gi, '**$1**')
        .replace(/\{@i\s+([^}]+)\}/gi, '*$1*')
        .replace(/\{@u\s+([^}]+)\}/gi, '$1')
        .replace(/\{@s\s+([^}]+)\}/gi, '~~$1~~')
        .replace(/\{@note\s+([^}]+)\}/gi, '*Note: $1*')
        .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@5etools\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@[a-zA-Z0-9_-]+\s+([^}]+)\}/g, '$1');
}

function cleanTagsForHtml(text) {
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

function renderEntriesToHtml(entries) {
    if (!entries || !Array.isArray(entries)) return '';
    const parts = [];
    for (const entry of entries) {
        if (typeof entry === 'string') {
            parts.push(`<p>${cleanTagsForHtml(entry)}</p>`);
        } else if (typeof entry === 'object' && entry !== null) {
            if (entry.type === 'entries' || entry.name) {
                const title = entry.name ? `<strong>${cleanTagsForHtml(entry.name)}.</strong> ` : '';
                const subText = entry.entries ? renderEntriesToHtml(entry.entries) : '';
                parts.push(`<div class="item-subentry">${title}${subText}</div>`);
            } else if (entry.type === 'list' && Array.isArray(entry.items)) {
                const lis = entry.items.map(it => `<li>${typeof it === 'string' ? cleanTagsForHtml(it) : renderEntriesToHtml([it])}</li>`).join('');
                parts.push(`<ul>${lis}</ul>`);
            } else if (entry.type === 'table' && Array.isArray(entry.rows)) {
                let ths = '';
                if (Array.isArray(entry.colLabels)) {
                    ths = `<tr>${entry.colLabels.map(l => `<th>${cleanTagsForHtml(l)}</th>`).join('')}</tr>`;
                }
                const trs = entry.rows.map(row => {
                    const tds = Array.isArray(row) ? row.map(cell => `<td>${cleanTagsForHtml(cell)}</td>`).join('') : `<td>${cleanTagsForHtml(row)}</td>`;
                    return `<tr>${tds}</tr>`;
                }).join('');
                parts.push(`<table class="item-table"><thead>${ths}</thead><tbody>${trs}</tbody></table>`);
            }
        }
    }
    return parts.join('\n');
}

function renderEntriesToMarkdown(entries) {
    if (!entries || !Array.isArray(entries)) return '';
    const parts = [];
    for (const entry of entries) {
        if (typeof entry === 'string') {
            parts.push(cleanTags(entry));
        } else if (typeof entry === 'object' && entry !== null) {
            if (entry.type === 'entries' || entry.name) {
                const title = entry.name ? `**${cleanTags(entry.name)}.** ` : '';
                const subText = entry.entries ? renderEntriesToMarkdown(entry.entries) : '';
                parts.push(`${title}${subText}`);
            } else if (entry.type === 'list' && Array.isArray(entry.items)) {
                const lis = entry.items.map(it => `- ${typeof it === 'string' ? cleanTags(it) : renderEntriesToMarkdown([it])}`).join('\n');
                parts.push(lis);
            } else if (entry.type === 'table' && Array.isArray(entry.rows)) {
                let tableMd = '';
                if (Array.isArray(entry.colLabels)) {
                    tableMd += '| ' + entry.colLabels.map(l => cleanTags(l)).join(' | ') + ' |\n';
                    tableMd += '| ' + entry.colLabels.map(() => '---').join(' | ') + ' |\n';
                }
                tableMd += entry.rows.map(row => {
                    const cells = Array.isArray(row) ? row.map(c => cleanTags(c)).join(' | ') : cleanTags(row);
                    return '| ' + cells + ' |';
                }).join('\n');
                parts.push(tableMd);
            }
        }
    }
    return parts.join('\n\n');
}

function flattenEntriesText(entries) {
    if (!entries || !Array.isArray(entries)) return '';
    let text = '';
    for (const e of entries) {
        if (typeof e === 'string') text += ' ' + e;
        else if (e && typeof e === 'object') {
            if (e.entries) text += ' ' + flattenEntriesText(e.entries);
            if (e.items) text += ' ' + flattenEntriesText(e.items);
        }
    }
    return text;
}

function extractExtraDamage(entries, baseDmgType) {
    const text = flattenEntriesText(entries);
    const extraRows = [];
    // Match patterns like:
    // "deals an extra 2d6 Fire damage"
    // "deals an extra {@damage 2d6} fire damage"
    // "takes an extra {@damage 2d10} radiant damage"
    // "deals an extra 3d6 damage of the weapon's type"
    const regex = /([^.]+?(?:deals|takes)\s+(?:an\s+)?extra\s+(?:\{@damage\s+([^}|]+)(?:\|[^}]*)?\}|(\d+d\d+(?:\s*[+-]\s*\d+)?))\s+([a-zA-Z]+)?(?:\s+damage)?(?:[^.]*?\.)?)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const sentence = match[1] || '';
        const formula = (match[2] || match[3] || '').trim();
        let rawType = (match[4] || '').trim().toLowerCase();
        if (rawType === 'of' || rawType === "weapon's" || !rawType) {
            rawType = baseDmgType || 'damage';
        }
        const fullType = DMG_TYPE_MAP[rawType.toUpperCase()] || rawType;
        const niceType = fullType.charAt(0).toUpperCase() + fullType.slice(1);

        // Determine context-sensitive label
        let label = 'Extra';
        const sentLower = sentence.toLowerCase();
        if (sentLower.includes('undead') && sentLower.includes('fiend')) label = 'vs Fiend/Undead';
        else if (sentLower.includes('undead')) label = 'vs Undead';
        else if (sentLower.includes('dragon')) label = 'vs Dragon';
        else if (sentLower.includes('giant')) label = 'vs Giant';
        else if (sentLower.includes('ablaze') || sentLower.includes('flame') || sentLower.includes('command word')) label = 'Flame Tongue';
        else if (sentLower.includes('cold') || sentLower.includes('frost')) label = 'Frost Brand';

        if (formula && !extraRows.some(r => r.formula === formula && r.type.toLowerCase() === niceType.toLowerCase() && r.label === label)) {
            extraRows.push({
                formula,
                stat: '',
                type: niceType,
                label
            });
        }
    }
    return extraRows;
}

function parseAttachedSpells(raw) {
    if (!raw) return null;
    const rawList = [];
    function collect(obj) {
        if (!obj) return;
        if (typeof obj === 'string') {
            rawList.push(obj);
        } else if (Array.isArray(obj)) {
            for (const item of obj) collect(item);
        } else if (typeof obj === 'object') {
            for (const k in obj) collect(obj[k]);
        }
    }
    collect(raw);
    if (!rawList.length) return null;

    const seenNames = new Set();
    const result = [];
    for (const item of rawList) {
        const str = typeof item === 'string' ? item : (item.name || String(item));
        const [spellWithUpcast] = str.split('|');
        const [rawName, upcastStr] = spellWithUpcast.split('#');
        const cleanName = rawName.trim();
        const castLevel = upcastStr ? parseInt(upcastStr) : null;
        const key = cleanName.toLowerCase() + (castLevel ? '#' + castLevel : '');
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        result.push({
            name: cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            cleanName: cleanName.toLowerCase(),
            castLevel: castLevel || null
        });
    }
    return result.length ? result : null;
}

function matchesCondition(base, req) {
    if (!req || typeof req !== 'object') return false;
    for (const k in req) {
        const val = req[k];
        if (k === 'type' && typeof val === 'string') {
            const reqType = val.split('|')[0];
            if (base.type !== reqType) return false;
        } else if (k === 'weapon') {
            const isWeap = base.type === 'M' || base.type === 'R' || !!base.weaponCategory;
            if (val ? !isWeap : isWeap) return false;
        } else if (k === 'armor') {
            const isArm = base.type === 'LA' || base.type === 'MA' || base.type === 'HA' || !!base.armor;
            if (val ? !isArm : isArm) return false;
        } else if (k === 'property') {
            const props = Array.isArray(base.property) ? base.property.map(p => (typeof p === 'string' ? p : (p.name || p.uid || '')).split('|')[0]) : [];
            if (!props.includes(val)) return false;
        } else if (k === 'dmgType') {
            if (base.dmgType !== val) return false;
        } else if (k === 'weaponCategory') {
            if (base.weaponCategory !== val) return false;
        } else if (k === 'name') {
            if (typeof val === 'string') {
                if ((base.name || '').toLowerCase() !== val.toLowerCase()) return false;
            } else if (val && typeof val === 'object' && val.regex) {
                if (!new RegExp(val.regex, 'i').test(base.name || '')) return false;
            } else if (val === true && !base.name) {
                return false;
            }
        } else if (typeof val === 'boolean') {
            if (!!base[k] !== val) return false;
        } else if (typeof val === 'string') {
            if (String(base[k] || '').toLowerCase() !== val.toLowerCase()) return false;
        } else if (base[k] !== val) {
            return false;
        }
    }
    return true;
}

export function buildItemsDatabase() {
    console.log('📦 Reading 5etools items data...');
    const allItems = [];
    const seen = new Set();

    // Load fluff dictionary if present
    const fluffMap = new Map();
    if (fs.existsSync(fluffFile)) {
        try {
            const fluffData = JSON.parse(fs.readFileSync(fluffFile, 'utf8'));
            if (Array.isArray(fluffData.itemFluff)) {
                for (const f of fluffData.itemFluff) {
                    const k = (f.name + '|' + (f.source || '')).toLowerCase();
                    if (f.entries) fluffMap.set(k, f.entries);
                    if (f._copy && f._copy.name) {
                        const copyK = (f._copy.name + '|' + (f._copy.source || f.source || '')).toLowerCase();
                        if (fluffMap.has(copyK) && !fluffMap.has(k)) {
                            fluffMap.set(k, fluffMap.get(copyK));
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Could not read fluff-items.json:', e.message);
        }
    }

    function formatValue(val) {
        if (typeof val === 'number') {
            return `${(val / 100).toFixed(val % 100 === 0 ? 0 : 2)} gp`;
        }
        return val || null;
    }

    function processItem(it) {
        const name = (it.name || '').trim();
        const source = (it.source || 'PHB').trim();
        if (!name) return;

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);

        let typeDisplay = 'Adventuring Gear';
        if (it.wondrous) typeDisplay = 'Wondrous Item';
        else if (it.type && ITEM_TYPE_MAP[it.type]) typeDisplay = ITEM_TYPE_MAP[it.type];
        else if (it.weaponCategory) typeDisplay = `${it.weaponCategory.charAt(0).toUpperCase() + it.weaponCategory.slice(1)} Weapon`;
        else if (it.armor) typeDisplay = 'Armor';

        const rarity = (it.rarity || 'none').toLowerCase();
        const reqAttune = it.reqAttune ? (typeof it.reqAttune === 'string' ? it.reqAttune : 'Requires Attunement') : false;
        const weight = typeof it.weight === 'number' ? it.weight : null;
        const value = formatValue(it.value);

        let ac = null;
        if (it.ac !== undefined && it.ac !== null) {
            ac = it.ac;
        } else if (it.bonusAc) {
            const bVal = parseInt(it.bonusAc);
            if (!isNaN(bVal)) ac = bVal;
        }

        const bonusAc = it.bonusAc || null;
        const bonusWeapon = it.bonusWeapon || null;

        const dmg1 = it.dmg1 || null;
        const dmg2 = it.dmg2 || null;

        let dmgType = null;
        if (it.dmgType) {
            const rawDt = String(it.dmgType).trim().toUpperCase();
            dmgType = DMG_TYPE_MAP[rawDt] || it.dmgType.toLowerCase();
        }

        const rawProps = it.property || [];
        const propertyList = rawProps.map(p => {
            const pStr = typeof p === 'string' ? p : (p.uid || p.name || '');
            const baseP = pStr.split('|')[0];
            return PROPERTY_MAP[baseP] || PROPERTY_MAP[pStr] || baseP;
        });

        const isWeapon = !!(dmg1 || it.weaponCategory || it.type === 'M' || it.type === 'R');
        const isArmor = !!(ac !== null || bonusAc || it.armor || it.type === 'LA' || it.type === 'MA' || it.type === 'HA' || it.type === 'S');

        const packContents = it.packContents || null;
        const attachedSpells = parseAttachedSpells(it.attachedSpells);

        // Clean template tags {=bonusWeapon} etc in entries
        function processEntries(entriesList) {
            if (!entriesList || !Array.isArray(entriesList)) return [];
            return entriesList.map(entry => {
                if (typeof entry === 'string') {
                    let s = entry;
                    if (bonusWeapon) s = s.replace(/\{=bonusWeapon\}/g, bonusWeapon);
                    if (bonusAc) s = s.replace(/\{=bonusAc\}/g, bonusAc);
                    return s;
                } else if (entry && typeof entry === 'object') {
                    const copy = { ...entry };
                    if (copy.entries) copy.entries = processEntries(copy.entries);
                    return copy;
                }
                return entry;
            });
        }

        const rawEntries = it.entries || it.additionalEntries || [];
        const processedEntries = processEntries(rawEntries);

        // Retrieve fluff if available
        const fluffKey = (name + '|' + source).toLowerCase();
        const baseFluffKey = (name + '|phb').toLowerCase();
        const fluffEntries = fluffMap.get(fluffKey) || fluffMap.get(baseFluffKey) || [];

        const descriptionHtml = renderEntriesToHtml(processedEntries);

        // Build complete Markdown description
        const descParts = [];
        const attuneStr = reqAttune ? (typeof reqAttune === 'string' ? ` (${reqAttune})` : ' (requires attunement)') : '';
        descParts.push(`*${typeDisplay}${rarity !== 'none' ? `, ${rarity}` : ''}${attuneStr}*`);

        const metaParts = [];
        if (ac !== null && ac !== undefined) {
            let acStr = String(ac);
            if (it.rawType === 'LA') acStr += ' + Dex modifier';
            else if (it.rawType === 'MA') acStr += ' + Dex modifier (max 2)';
            metaParts.push(`**Armor Class:** ${acStr}`);
        }
        if (dmg1) {
            const dt = dmgType || 'slashing';
            let dmg = `**Damage:** ${dmg1} ${dt}`;
            if (dmg2) dmg += ` (or ${dmg2} ${dt} versatile)`;
            metaParts.push(dmg);
        }
        if (propertyList.length > 0) {
            metaParts.push(`**Properties:** ${propertyList.join(', ')}`);
        }
        if (weight !== null && weight !== undefined) {
            metaParts.push(`**Weight:** ${weight} lb`);
        }
        if (value) {
            metaParts.push(`**Value:** ${value}`);
        }
        if (metaParts.length > 0) {
            descParts.push(metaParts.join(' | '));
        }
        descParts.push('---');

        const entryMd = renderEntriesToMarkdown(processedEntries);
        if (entryMd) descParts.push(entryMd);

        if (fluffEntries.length > 0) {
            const fluffMd = renderEntriesToMarkdown(fluffEntries);
            if (fluffMd && !entryMd.includes(fluffMd)) {
                descParts.push(fluffMd);
            }
        }

        const descriptionMarkdown = descParts.join('\n\n');

        // Pre-compile Zero-Parsing Macro Template for Weapons
        let macroTemplate = null;
        if (isWeapon) {
            let bonusVal = 0;
            if (bonusWeapon) {
                bonusVal = parseInt(bonusWeapon) || 0;
            } else {
                const m = name.match(/\+(\d+)/);
                if (m) bonusVal = parseInt(m[1]) || 0;
            }

            const isFinesse = propertyList.some(p => p.toLowerCase().includes('finesse'));
            const isRanged = it.type === 'R' || (typeDisplay || '').toLowerCase().includes('ranged') || propertyList.some(p => p.toLowerCase().includes('ammunition'));

            let rangeStr = '5 ft';
            const rangeProp = rawProps.find(p => typeof p === 'string' && (p.toLowerCase().startsWith('range') || p.toLowerCase().startsWith('thrown')));
            if (rangeProp) rangeStr = rangeProp.replace(/^(?:range|thrown)\s*\(([^)]+)\)/i, '$1 ft');
            else if (propertyList.some(p => p.toLowerCase().includes('reach'))) rangeStr = '10 ft';

            const damageRows = [];
            const primaryFormula = dmg1 || '1d6';
            const primaryType = (dmgType || 'slashing').charAt(0).toUpperCase() + (dmgType || 'slashing').slice(1);

            damageRows.push({
                formula: primaryFormula,
                stat: 'auto', // resolved to STR or DEX based on character stats
                extra: bonusVal,
                type: primaryType
            });

            // Extract secondary magic damages (e.g. Flame Tongue 2d6 Fire, Frost Brand 1d6 Cold)
            const extraDmgRows = extractExtraDamage(processedEntries, dmgType);
            for (const ed of extraDmgRows) {
                damageRows.push(ed);
            }

            macroTemplate = {
                name,
                attackStat: isRanged ? 'dex' : (isFinesse ? 'auto' : 'str'),
                isFinesse,
                isRanged,
                attackProf: true,
                attackExtra: bonusVal,
                critRange: 20,
                range: rangeStr,
                target: '1 target',
                damageRows,
                versatile: dmg2 || null
            };
        }

        allItems.push({
            id: `it_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${source.toLowerCase()}`,
            name,
            source,
            page: it.page || 0,
            type: typeDisplay,
            rawType: it.type || null,
            rarity,
            reqAttune,
            weight,
            value,
            ac,
            bonusAc,
            dmg1,
            dmg2,
            dmgType,
            bonusWeapon,
            properties: propertyList,
            isWeapon,
            isArmor,
            packContents,
            attachedSpells,
            macroTemplate,
            descriptionMarkdown,
            descriptionHtml
        });
    }

    let baseItems = [];
    if (fs.existsSync(baseItemsFile)) {
        const baseData = JSON.parse(fs.readFileSync(baseItemsFile, 'utf8'));
        baseItems = baseData.baseitem || [];
        baseItems.forEach(it => processItem(it));
    }

    if (fs.existsSync(itemsFile)) {
        const itemsData = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));
        (itemsData.item || []).forEach(it => processItem(it));
        (itemsData.itemGroup || []).forEach(it => processItem(it));
    }

    // ─── Expand Magic Variants into standalone entries ───────────────────────
    if (fs.existsSync(magicVariantsFile) && baseItems.length > 0) {
        console.log('✨ Expanding magic item variants...');
        const variantData = JSON.parse(fs.readFileSync(magicVariantsFile, 'utf8'));
        const variants = variantData.magicvariant || [];

        let variantCount = 0;
        for (const variant of variants) {
            const rawReqs = variant.requires || [];
            const reqs = Array.isArray(rawReqs) ? rawReqs : (rawReqs ? [rawReqs] : []);
            if (!reqs.length) continue;

            const rawExcludes = variant.excludes || variant.exclude || [];
            const excludes = Array.isArray(rawExcludes) ? rawExcludes : (rawExcludes ? [rawExcludes] : []);
            const inherits = variant.inherits || {};

            const matchingBases = baseItems.filter(base => {
                if (excludes.length && excludes.some(ex => matchesCondition(base, ex))) return false;
                return reqs.some(req => matchesCondition(base, req));
            });

            for (const base of matchingBases) {
                const prefix = inherits.namePrefix || '';
                const suffix = inherits.nameSuffix || '';

                let varName = '';
                if (prefix || suffix) {
                    varName = `${prefix}${base.name}${suffix}`.trim();
                } else if (variant.name) {
                    const cleanVarTitle = variant.name.replace(/\s*\(\*\)/g, '').trim();
                    varName = `${cleanVarTitle} (${base.name})`;
                } else {
                    continue;
                }

                const bonusWeapon = inherits.bonusWeapon || variant.bonusWeapon || null;
                const bonusAc = inherits.bonusAc || variant.bonusAc || null;

                let finalAc = base.ac !== undefined ? base.ac : null;
                if (bonusAc && finalAc !== null) {
                    const bVal = parseInt(bonusAc);
                    if (!isNaN(bVal)) finalAc += bVal;
                } else if (bonusAc && finalAc === null) {
                    const bVal = parseInt(bonusAc);
                    if (!isNaN(bVal)) finalAc = bVal;
                }

                // Merge entries: variant entries first, followed by base item entries
                const combinedEntries = [
                    ...(inherits.entries || variant.entries || []),
                    ...(base.entries || [])
                ];

                const combinedProps = [
                    ...(base.property || []),
                    ...(inherits.property || [])
                ];

                const varItem = {
                    ...base,
                    ...inherits,
                    name: varName,
                    source: inherits.source || variant.source || base.source || 'DMG',
                    page: inherits.page || variant.page || base.page || 0,
                    rarity: inherits.rarity || variant.rarity || base.rarity || 'rare',
                    reqAttune: inherits.reqAttune !== undefined ? inherits.reqAttune : (variant.reqAttune !== undefined ? variant.reqAttune : base.reqAttune),
                    weight: base.weight !== undefined ? base.weight : (inherits.weight || 0),
                    value: inherits.value !== undefined ? inherits.value : base.value,
                    ac: finalAc,
                    bonusAc: bonusAc,
                    bonusWeapon: bonusWeapon,
                    dmg1: base.dmg1 || null,
                    dmg2: base.dmg2 || null,
                    dmgType: base.dmgType || null,
                    property: combinedProps,
                    entries: combinedEntries,
                    attachedSpells: inherits.attachedSpells || variant.attachedSpells || base.attachedSpells || null,
                    _isVariant: true
                };

                processItem(varItem);
                variantCount++;
            }
        }
        console.log(`✨ Generated ${variantCount} variant item combinations!`);
    }

    allItems.sort((a, b) => a.name.localeCompare(b.name));

    // 1. Generate full-featured search catalog
    const catalog = allItems.map(it => ({
        id: it.id,
        name: it.name,
        source: it.source,
        page: it.page,
        type: it.type,
        rawType: it.rawType,
        rarity: it.rarity,
        reqAttune: !!it.reqAttune,
        weight: it.weight,
        value: it.value,
        ac: it.ac,
        bonusAc: it.bonusAc,
        dmg1: it.dmg1,
        dmg2: it.dmg2,
        dmgType: it.dmgType,
        bonusWeapon: it.bonusWeapon,
        properties: it.properties,
        isWeapon: it.isWeapon,
        isArmor: it.isArmor,
        packContents: it.packContents,
        attachedSpells: it.attachedSpells,
        macroTemplate: it.macroTemplate,
        descriptionMarkdown: it.descriptionMarkdown,
        descriptionHtml: it.descriptionHtml
    }));

    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
    console.log(`📁 Items search catalog generated: ${catalogPath} (${catalog.length} items)`);

    // 2. Strict Source Partitions: output items-normalized/items-<source>.json
    if (!fs.existsSync(partitionsDir)) {
        fs.mkdirSync(partitionsDir, { recursive: true });
    }

    const sourcePartitions = new Map();
    for (const it of allItems) {
        const srcKey = (it.source || 'phb').toLowerCase();
        if (!sourcePartitions.has(srcKey)) {
            sourcePartitions.set(srcKey, []);
        }
        sourcePartitions.get(srcKey).push(it);
    }

    for (const [srcKey, itemsList] of sourcePartitions.entries()) {
        const partFile = path.join(partitionsDir, `items-${srcKey}.json`);
        fs.writeFileSync(partFile, JSON.stringify(itemsList, null, 2), 'utf8');
    }

    console.log(`📁 Successfully wrote ${sourcePartitions.size} source-partitioned item tables to ${partitionsDir}`);
    console.log(`✅ Complete! Total normalized items: ${allItems.length}`);
}

buildItemsDatabase();
