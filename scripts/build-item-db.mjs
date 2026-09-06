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
                parts.push(`<div class="item-subentry">${title}${subText}</div>`);
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
                parts.push(`<table class="item-table"><thead>${ths}</thead><tbody>${trs}</tbody></table>`);
            }
        }
    }
    return parts.join('\n');
}

export function buildItemsDatabase() {
    console.log('📦 Reading 5etools items data...');
    const allItems = [];
    const seen = new Set();

    function processItemList(list) {
        if (!Array.isArray(list)) return;
        for (const it of list) {
            const name = (it.name || '').trim();
            const source = (it.source || 'PHB').trim();
            if (!name) continue;

            const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);

            let typeDisplay = 'Adventuring Gear';
            if (it.wondrous) typeDisplay = 'Wondrous Item';
            else if (it.type && ITEM_TYPE_MAP[it.type]) typeDisplay = ITEM_TYPE_MAP[it.type];
            else if (it.weaponCategory) typeDisplay = `${it.weaponCategory} Weapon`;
            else if (it.armor) typeDisplay = 'Armor';

            const rarity = (it.rarity || 'none').toLowerCase();
            const reqAttune = it.reqAttune ? (typeof it.reqAttune === 'string' ? it.reqAttune : 'Requires Attunement') : false;
            const weight = typeof it.weight === 'number' ? it.weight : null;
            const value = typeof it.value === 'number' ? `${(it.value / 100).toFixed(it.value % 100 === 0 ? 0 : 2)} gp` : (it.value || null);

            let ac = null;
            if (it.ac !== undefined) ac = it.ac;

            let dmg1 = it.dmg1 || null;
            let dmgType = it.dmgType ? (it.dmgType.toLowerCase() === 's' ? 'slashing' : it.dmgType.toLowerCase() === 'p' ? 'piercing' : it.dmgType.toLowerCase() === 'b' ? 'bludgeoning' : it.dmgType) : null;

            const propertyList = (it.property || []).map(p => PROPERTY_MAP[p] || p);

            const descriptionHtml = renderEntriesToHtml(it.entries || it.additionalEntries || []);

            allItems.push({
                id: `it_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${source.toLowerCase()}`,
                name,
                source,
                page: it.page || 0,
                type: typeDisplay,
                rarity,
                reqAttune,
                weight,
                value,
                ac,
                dmg1,
                dmgType,
                properties: propertyList,
                descriptionHtml
            });
        }
    }

    if (fs.existsSync(baseItemsFile)) {
        const baseData = JSON.parse(fs.readFileSync(baseItemsFile, 'utf8'));
        processItemList(baseData.baseitem);
    }

    if (fs.existsSync(itemsFile)) {
        const itemsData = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));
        processItemList(itemsData.item);
    }

    allItems.sort((a, b) => a.name.localeCompare(b.name));

    // 1. Generate lightweight catalog for search & autocomplete
    const catalog = allItems.map(it => ({
        id: it.id,
        name: it.name,
        source: it.source,
        page: it.page,
        type: it.type,
        rarity: it.rarity,
        reqAttune: !!it.reqAttune,
        weight: it.weight,
        value: it.value,
        ac: it.ac,
        dmg1: it.dmg1,
        dmgType: it.dmgType
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
