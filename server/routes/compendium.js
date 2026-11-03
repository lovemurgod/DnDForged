import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import {
    DATA_DIR,
    VTT_DATA_DIR,
    extractSubdomain,
    getDisabledSourcesSet,
    loadCustomEntities,
    extractEntityArray
} from '../state.js';

export const compendiumRouter = express.Router();

// --- Spells Caches & Handlers ---
let gzippedSpellsCatalogBuf = null;
let spellsCatalogEtag = null;
let rawSpellsCatalogData = null;
let rawSpellsCatalogMtime = 0;
let gzippedSpellsCatalogMtime = 0;

function getRawSpellsCatalog() {
    const catPath = path.join(VTT_DATA_DIR, 'spells-catalog.json');
    if (fs.existsSync(catPath)) {
        try {
            const stat = fs.statSync(catPath);
            if (!rawSpellsCatalogData || stat.mtimeMs !== rawSpellsCatalogMtime) {
                rawSpellsCatalogMtime = stat.mtimeMs;
                rawSpellsCatalogData = JSON.parse(fs.readFileSync(catPath, 'utf8'));
            }
            return rawSpellsCatalogData;
        } catch (e) {}
    }
    return [];
}

export function loadGzippedSpellsCatalog() {
    try {
        const catPath = path.join(VTT_DATA_DIR, 'spells-catalog.json');
        if (fs.existsSync(catPath)) {
            const stat = fs.statSync(catPath);
            if (!gzippedSpellsCatalogBuf || stat.mtimeMs !== gzippedSpellsCatalogMtime) {
                gzippedSpellsCatalogMtime = stat.mtimeMs;
                const raw = fs.readFileSync(catPath);
                gzippedSpellsCatalogBuf = zlib.gzipSync(raw, { level: 9 });
                spellsCatalogEtag = `W/"${gzippedSpellsCatalogBuf.length}-${stat.mtimeMs}"`;
            }
        }
    } catch (e) {
        console.error('Error loading gzipped spells catalog cache:', e);
    }
}
loadGzippedSpellsCatalog();

const spellPartitionCache = new Map();

function getSpellPartition(source) {
    const srcKey = (source || 'phb').toLowerCase();
    if (spellPartitionCache.has(srcKey)) {
        return spellPartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'spells-normalized', `spells-${srcKey}.json`);
    if (fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            spellPartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load spell partition for ${srcKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', 'spells', `${srcKey}.json`);
    if (fs.existsSync(customPartPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(customPartPath, 'utf8'));
            const list = extractEntityArray(parsed, 'spells');
            spellPartitionCache.set(srcKey, list);
            return list;
        } catch (err) {
            console.error(`Failed to load custom spell partition for ${srcKey}:`, err);
        }
    }
    return null;
}

compendiumRouter.get(
    [
        '/api/spells/catalog',
        '/data/spells-catalog.json',
        '/vtt/data/spells-catalog.json',
        '/5etools-src/data/spells-catalog.json'
    ],
    (req, res) => {
        const campId = req.query.campaignId || extractSubdomain(req.headers.host);
        const disabledSet = getDisabledSourcesSet(campId);
        const customSpells = loadCustomEntities('spells');

        if (disabledSet.size === 0 && customSpells.length === 0) {
            loadGzippedSpellsCatalog();
            if (!gzippedSpellsCatalogBuf) return res.status(404).send('Spells catalog not found');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('ETag', spellsCatalogEtag);
            return res.send(gzippedSpellsCatalogBuf);
        }

        const raw = getRawSpellsCatalog();
        const filtered = raw.filter((sp) => !disabledSet.has(String(sp.source || 'PHB').toUpperCase()));
        for (const cs of customSpells) {
            if (!disabledSet.has(String(cs.source).toUpperCase())) {
                const genId =
                    cs.id ||
                    `spell_${(cs.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(cs.source || 'mybrew').toLowerCase()}`;
                filtered.push({
                    id: genId,
                    name: cs.name || 'Unnamed Spell',
                    source: cs.source || 'MYBREW',
                    level: cs.level !== undefined ? parseInt(cs.level, 10) || 0 : 0,
                    school: cs.school || 'A',
                    time: cs.time || [{ number: 1, unit: 'action' }],
                    range: cs.range || { type: 'point' },
                    duration: cs.duration || [{ type: 'instant' }]
                });
            }
        }

        const buf = zlib.gzipSync(Buffer.from(JSON.stringify(filtered)));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send(buf);
    }
);

compendiumRouter.get('/api/spell/:source/:id', (req, res) => {
    const { source, id } = req.params;
    const partition = getSpellPartition(source);
    if (!partition) {
        return res.status(404).json({ error: `Spell source '${source}' not found` });
    }

    const cleanId = id.toLowerCase();
    const spell = partition.find(
        (sp) =>
            sp.id?.toLowerCase() === cleanId ||
            sp.name?.toLowerCase() === cleanId ||
            sp.id?.toLowerCase() === `sp_${cleanId}_${source.toLowerCase()}`
    );

    if (!spell) {
        return res.status(404).json({ error: `Spell '${id}' not found in source '${source}'` });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(spell);
});

compendiumRouter.get('/api/spell/partition/:source', (req, res) => {
    const { source } = req.params;
    const partition = getSpellPartition(source);
    if (!partition) {
        return res.status(404).json({ error: `Spell partition '${source}' not found` });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(partition);
});

// --- Items Caches & Handlers ---
let gzippedItemsCatalogBuf = null;
let itemsCatalogEtag = null;
let rawItemsCatalogData = null;
let rawItemsCatalogMtime = 0;
let gzippedItemsCatalogMtime = 0;

function getRawItemsCatalog() {
    const catPath = path.join(VTT_DATA_DIR, 'items-catalog.json');
    if (fs.existsSync(catPath)) {
        try {
            const stat = fs.statSync(catPath);
            if (!rawItemsCatalogData || stat.mtimeMs !== rawItemsCatalogMtime) {
                rawItemsCatalogMtime = stat.mtimeMs;
                rawItemsCatalogData = JSON.parse(fs.readFileSync(catPath, 'utf8'));
            }
            return rawItemsCatalogData;
        } catch (e) {}
    }
    return [];
}

export function loadGzippedItemsCatalog() {
    try {
        const catPath = path.join(VTT_DATA_DIR, 'items-catalog.json');
        if (fs.existsSync(catPath)) {
            const stat = fs.statSync(catPath);
            if (!gzippedItemsCatalogBuf || stat.mtimeMs !== gzippedItemsCatalogMtime) {
                gzippedItemsCatalogMtime = stat.mtimeMs;
                const raw = fs.readFileSync(catPath);
                gzippedItemsCatalogBuf = zlib.gzipSync(raw, { level: 9 });
                itemsCatalogEtag = `W/"${gzippedItemsCatalogBuf.length}-${stat.mtimeMs}"`;
            }
        }
    } catch (e) {
        console.error('Error loading gzipped items catalog cache:', e);
    }
}
loadGzippedItemsCatalog();

const itemPartitionCache = new Map();

function getItemPartition(source) {
    const srcKey = (source || 'phb').toLowerCase();
    if (itemPartitionCache.has(srcKey)) {
        return itemPartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'items-normalized', `items-${srcKey}.json`);
    if (fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            itemPartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load item partition for ${srcKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', 'items', `${srcKey}.json`);
    if (fs.existsSync(customPartPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(customPartPath, 'utf8'));
            const list = extractEntityArray(parsed, 'items');
            itemPartitionCache.set(srcKey, list);
            return list;
        } catch (err) {
            console.error(`Failed to load custom item partition for ${srcKey}:`, err);
        }
    }
    return null;
}

compendiumRouter.get(
    [
        '/api/items/catalog',
        '/data/items-catalog.json',
        '/vtt/data/items-catalog.json',
        '/5etools-src/data/items-catalog.json'
    ],
    (req, res) => {
        const campId = req.query.campaignId || extractSubdomain(req.headers.host);
        const disabledSet = getDisabledSourcesSet(campId);
        const customItems = loadCustomEntities('items');

        if (disabledSet.size === 0 && customItems.length === 0) {
            loadGzippedItemsCatalog();
            if (!gzippedItemsCatalogBuf) return res.status(404).send('Items catalog not found');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('ETag', itemsCatalogEtag);
            return res.send(gzippedItemsCatalogBuf);
        }

        const raw = getRawItemsCatalog();
        const filtered = raw.filter((it) => !disabledSet.has(String(it.source || 'PHB').toUpperCase()));
        for (const ci of customItems) {
            if (!disabledSet.has(String(ci.source).toUpperCase())) {
                const genId =
                    ci.id ||
                    `item_${(ci.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(ci.source || 'mybrew').toLowerCase()}`;
                filtered.push({
                    id: genId,
                    name: ci.name || 'Unnamed Item',
                    source: ci.source || 'MYBREW',
                    type: ci.type || ci.itemType || 'G',
                    rarity: ci.rarity || 'none',
                    value: ci.value || 0
                });
            }
        }

        const buf = zlib.gzipSync(Buffer.from(JSON.stringify(filtered)));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send(buf);
    }
);

compendiumRouter.get('/api/item/:source/:id', (req, res) => {
    const { source, id } = req.params;
    const partition = getItemPartition(source);
    if (!partition) {
        return res.status(404).json({ error: `Item source '${source}' not found` });
    }

    const cleanId = id.toLowerCase();
    const item = partition.find(
        (it) =>
            it.id?.toLowerCase() === cleanId ||
            it.name?.toLowerCase() === cleanId ||
            it.id?.toLowerCase() === `it_${cleanId}_${source.toLowerCase()}`
    );

    if (!item) {
        return res.status(404).json({ error: `Item '${id}' not found in source '${source}'` });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(item);
});

// --- Generic Compendium Partitions (Classes, Races, Feats, Backgrounds) ---
const compendiumPartitionCache = new Map();

function getCompendiumPartition(type, source) {
    let cleanType = (type || '').toLowerCase();
    if (cleanType === 'optionalfeature') cleanType = 'optionalfeatures';
    const srcKey = (source || 'phb').toLowerCase();
    const cacheKey = `${cleanType}:${srcKey}`;
    if (compendiumPartitionCache.has(cacheKey)) {
        return compendiumPartitionCache.get(cacheKey);
    }
    const partPath = path.join(VTT_DATA_DIR, `${cleanType}-normalized`, `${cleanType}-${srcKey}.json`);
    if (fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            compendiumPartitionCache.set(cacheKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load compendium partition ${cacheKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', cleanType, `${srcKey}.json`);
    if (fs.existsSync(customPartPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(customPartPath, 'utf8'));
            const list = extractEntityArray(parsed, cleanType);
            compendiumPartitionCache.set(cacheKey, list);
            return list;
        } catch (err) {
            console.error(`Failed to load custom compendium partition ${cacheKey}:`, err);
        }
    }
    return null;
}

function parseEquipmentTextToData(rawEquip) {
    if (!rawEquip) {
        return { fixedItems: [], fixedGold: 0, choiceSets: [] };
    }
    let fixedGold = 0;
    const fixedItems = [];

    if (Array.isArray(rawEquip)) {
        for (const entry of rawEquip) {
            if (typeof entry === 'string') {
                const sub = parseEquipmentTextToData(entry);
                fixedGold += sub.fixedGold;
                fixedItems.push(...sub.fixedItems);
            } else if (entry && typeof entry === 'object') {
                if (entry.special) {
                    const sub = parseEquipmentTextToData(entry.special);
                    fixedGold += sub.fixedGold;
                    fixedItems.push(...sub.fixedItems);
                } else if (entry.item) {
                    const qty = parseInt(entry.quantity, 10) || 1;
                    const name = typeof entry.item === 'string' ? entry.item.split('|')[0] : 'Item';
                    fixedItems.push({ name, quantity: qty, type: 'item' });
                }
            }
        }
        return { fixedItems, fixedGold, choiceSets: [] };
    }

    if (typeof rawEquip !== 'string') {
        return { fixedItems: [], fixedGold: 0, choiceSets: [] };
    }

    let clean = rawEquip.trim();
    const goldMatch = clean.match(/(?:(?:a\s+)?pouch\s+containing\s+)?(\d+)\s*(?:gp|gold(?:\s*pieces?)?)/i);
    if (goldMatch) {
        fixedGold = parseInt(goldMatch[1], 10) || 0;
        clean = clean.replace(goldMatch[0], '').replace(/,\s*,/g, ',').trim();
    }

    const parts = clean
        .split(/(?:,\s*(?:and\s+)?|;\s*|\s+and\s+(?:a|an|the)?\s*)/i)
        .map((s) => s.replace(/^[,\s\.]+|[,\s\.]+$/g, ''))
        .map((s) => s.replace(/^(?:a|an|the|one|set of)\s+/i, '').trim())
        .filter((s) => s.length > 1 && !/^\s*pouch\s*$/i.test(s));

    parts.forEach((part) => {
        const qtyMatch = part.match(/^(\d+)\s+(.*)/);
        if (qtyMatch) {
            fixedItems.push({ name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1], 10) || 1, type: 'item' });
        } else {
            fixedItems.push({ name: part, quantity: 1, type: 'item' });
        }
    });

    return { fixedItems, fixedGold, choiceSets: [] };
}

compendiumRouter.get(
    [
        '/api/compendium/:type/catalog',
        '/data/:type-catalog.json',
        '/vtt/data/:type-catalog.json',
        '/5etools-src/data/:type-catalog.json',
        '/api/:type(classes|races|feats|backgrounds)/catalog'
    ],
    (req, res) => {
        let type = req.params.type.replace(/-catalog\.json$/i, '').toLowerCase();
        if (type === 'optionalfeature') type = 'optionalfeatures';
        const campId = req.query.campaignId || extractSubdomain(req.headers.host);
        const disabledSet = getDisabledSourcesSet(campId);
        const customEntries = loadCustomEntities(type);

        const catPath = path.join(VTT_DATA_DIR, `${type}-catalog.json`);
        if (!fs.existsSync(catPath) && customEntries.length === 0) {
            return res.status(404).json({ error: `Compendium catalog '${type}' not found` });
        }

        let items = [];
        if (fs.existsSync(catPath)) {
            try {
                items = JSON.parse(fs.readFileSync(catPath, 'utf8'));
            } catch (e) {}
        }

        if (disabledSet.size > 0) {
            items = items.filter((it) => !disabledSet.has(String(it.source || 'PHB').toUpperCase()));
            if (type === 'classes') {
                items.forEach((cls) => {
                    if (Array.isArray(cls.subclasses)) {
                        cls.subclasses = cls.subclasses.filter(
                            (sc) => !disabledSet.has(String(sc.source || cls.source || 'PHB').toUpperCase())
                        );
                    }
                });
            }
        }

        for (const ce of customEntries) {
            if (!disabledSet.has(String(ce.source).toUpperCase())) {
                const srcCode = ce.source || 'MYBREW';
                const genId =
                    ce.id ||
                    `${type}_${(ce.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${srcCode.toLowerCase()}`;

                const hydrated = {
                    ...ce,
                    id: genId,
                    name: ce.name || 'Unnamed Entry',
                    source: srcCode
                };

                if (type === 'races') {
                    hydrated.raceName = ce.raceName || ce.name || 'Unnamed Race';
                    hydrated.subraceName = ce.subraceName || null;
                    hydrated.size = Array.isArray(ce.size) ? ce.size[0] : ce.size || 'M';
                    const walk =
                        typeof ce.speed === 'object'
                            ? ce.speed.walk || 30
                            : parseInt(ce.speed || ce.speedWalk, 10) || 30;
                    const fly = typeof ce.speed === 'object' ? ce.speed.fly || 0 : parseInt(ce.speedFly, 10) || 0;
                    const swim = typeof ce.speed === 'object' ? ce.speed.swim || 0 : parseInt(ce.speedSwim, 10) || 0;
                    const climb = typeof ce.speed === 'object' ? ce.speed.climb || 0 : parseInt(ce.speedClimb, 10) || 0;
                    const burrow =
                        typeof ce.speed === 'object' ? ce.speed.burrow || 0 : parseInt(ce.speedBurrow, 10) || 0;
                    hydrated.speed = `${walk} ft` + (fly ? `, fly ${fly} ft` : '') + (swim ? `, swim ${swim} ft` : '');
                    hydrated.speeds = { walk, fly, swim, climb, burrow };
                    hydrated.senses =
                        ce.senses && typeof ce.senses === 'object'
                            ? ce.senses
                            : {
                                  darkvision: parseInt(ce.darkvision, 10) || 0,
                                  blindsight: 0,
                                  truesight: 0,
                                  devilSight: 0
                              };
                    const rawTraits = ce.traits || ce.trait || ce.entries || [];
                    hydrated.traits = Array.isArray(rawTraits)
                        ? rawTraits.map((t, idx) => ({
                              id: t.id || `trait_${genId}_${idx}`,
                              name: t.name || 'Racial Trait',
                              source: srcCode,
                              raceName: hydrated.name,
                              actionType: t.actionType || 'passive',
                              description:
                                  t.description || (Array.isArray(t.entries) ? t.entries.join('\n\n') : t.text || ''),
                              hasCounter: !!t.hasCounter,
                              usesMax: t.usesMax || null,
                              resetType: t.resetType || null,
                              formula: t.formula || '',
                              formulaConfig: t.formulaConfig || null,
                              rawEntries: Array.isArray(t.entries) ? t.entries : [t.text || t.description || '']
                          }))
                        : [];
                    if (!hydrated.ability) {
                        const ai = ce.abilityIncreases || {};
                        hydrated.ability = [
                            {
                                str: ai.str !== undefined ? ai.str : ce.strMod || 0,
                                dex: ai.dex !== undefined ? ai.dex : ce.dexMod || 0,
                                con: ai.con !== undefined ? ai.con : ce.conMod || 0,
                                int: ai.int !== undefined ? ai.int : ce.intMod || 0,
                                wis: ai.wis !== undefined ? ai.wis : ce.wisMod || 0,
                                cha: ai.cha !== undefined ? ai.cha : ce.chaMod || 0
                            }
                        ];
                    }
                } else if (type === 'backgrounds') {
                    const rawSkills = ce.skillProficiencies || ce.skills || '';
                    let skillList = [];
                    if (Array.isArray(rawSkills)) {
                        skillList = rawSkills
                            .map((s) => (typeof s === 'string' ? s : Object.keys(s).filter((k) => k !== 'choose')))
                            .flat();
                    } else if (typeof rawSkills === 'string' && rawSkills.trim()) {
                        skillList = rawSkills
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                    }
                    hydrated.skills = typeof rawSkills === 'string' ? rawSkills : skillList.join(', ');
                    hydrated.skillsData = ce.skillsData || { fixed: skillList, choose: null };

                    const rawTools = ce.toolProficiencies || ce.tools || '';
                    let toolList = [];
                    if (Array.isArray(rawTools)) {
                        toolList = rawTools
                            .map((t) => (typeof t === 'string' ? t : Object.keys(t).filter((k) => k !== 'choose')))
                            .flat();
                    } else if (typeof rawTools === 'string' && rawTools.trim()) {
                        toolList = rawTools
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean);
                    }
                    hydrated.tools = typeof rawTools === 'string' ? rawTools : toolList.join(', ');
                    hydrated.toolsData = ce.toolsData || { fixed: toolList, choose: null };

                    const featEntry = Array.isArray(ce.entries) ? ce.entries.find((e) => e && e.name) : null;
                    const featName =
                        ce.featureName || featEntry?.name || ce.features?.[0]?.name || `Feature: ${hydrated.name}`;
                    const featDesc =
                        ce.featureDescription ||
                        ce.featureDesc ||
                        (Array.isArray(featEntry?.entries) ? featEntry.entries.join('\n\n') : featEntry?.text) ||
                        ce.features?.[0]?.description ||
                        ce.description ||
                        '';
                    hydrated.features =
                        Array.isArray(ce.features) && ce.features.length > 0
                            ? ce.features
                            : [
                                  {
                                      name: featName,
                                      description: featDesc
                                  }
                              ];
                    hydrated.description = featDesc;
                    const rawEquipment = ce.startingEquipment || ce.equipment || '';
                    hydrated.equipment =
                        typeof rawEquipment === 'string'
                            ? rawEquipment
                            : Array.isArray(rawEquipment)
                              ? rawEquipment
                                    .map((e) => e?.special || e?.item || (typeof e === 'string' ? e : ''))
                                    .filter(Boolean)
                                    .join(', ')
                              : '';
                    hydrated.equipmentData = ce.equipmentData || parseEquipmentTextToData(rawEquipment);
                }

                items.push(hydrated);
            }
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json(items);
    }
);

compendiumRouter.get('/api/compendium/:type/:source/:id', (req, res) => {
    const { type, source, id } = req.params;
    const partition = getCompendiumPartition(type, source);
    if (!partition) {
        return res.status(404).json({ error: `Compendium partition '${type}-${source}' not found` });
    }

    const cleanId = id.toLowerCase();
    const entry = partition.find((item) => item.id?.toLowerCase() === cleanId || item.name?.toLowerCase() === cleanId);

    if (!entry) {
        return res.status(404).json({ error: `Entry '${id}' not found in '${type}-${source}'` });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(entry);
});

// --- Handouts Handlers ---
const handoutPartitionCache = new Map();
let rawHandoutsCatalogData = null;

function getRawHandoutsCatalog() {
    if (rawHandoutsCatalogData) return rawHandoutsCatalogData;
    const catPath = path.join(VTT_DATA_DIR, 'handouts-catalog.json');
    if (fs.existsSync(catPath)) {
        try {
            rawHandoutsCatalogData = JSON.parse(fs.readFileSync(catPath, 'utf8'));
            return rawHandoutsCatalogData;
        } catch (e) {
            console.error('Error loading handouts catalog:', e);
        }
    }
    return [];
}

function getHandoutPartition(source) {
    const srcKey = (source || '').toLowerCase();
    if (handoutPartitionCache.has(srcKey)) {
        return handoutPartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'handouts-normalized', `handouts-${srcKey}.json`);
    if (fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            handoutPartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load handout partition for ${srcKey}:`, err);
        }
    }
    return null;
}

compendiumRouter.get(
    ['/api/handouts/catalog', '/data/handouts-catalog.json', '/vtt/data/handouts-catalog.json'],
    (req, res) => {
        const catalog = getRawHandoutsCatalog();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(catalog);
    }
);

compendiumRouter.get('/api/handouts/:source', (req, res) => {
    const { source } = req.params;
    const partition = getHandoutPartition(source);
    if (!partition) {
        return res.status(404).json({ error: `Handout source partition '${source}' not found` });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(partition);
});

// Endpoint to get disabled sources for campaign/global
compendiumRouter.get('/api/sources/disabled', (req, res) => {
    const campId = req.query.campaignId || extractSubdomain(req.headers.host);
    const disabledSet = getDisabledSourcesSet(campId);
    res.json({ disabledSources: Array.from(disabledSet) });
});

// --- Bestiary Caches & Handlers ---
let gzippedBestiaryCatalogBuf = null;
let bestiaryCatalogEtag = null;
let rawBestiaryCatalogData = null;
let rawBestiaryCatalogMtime = 0;
let gzippedBestiaryCatalogMtime = 0;

function getRawBestiaryCatalog() {
    const catPath = path.join(VTT_DATA_DIR, 'bestiary-catalog.json');
    if (fs.existsSync(catPath)) {
        try {
            const stat = fs.statSync(catPath);
            if (!rawBestiaryCatalogData || stat.mtimeMs !== rawBestiaryCatalogMtime) {
                rawBestiaryCatalogMtime = stat.mtimeMs;
                rawBestiaryCatalogData = JSON.parse(fs.readFileSync(catPath, 'utf8'));
            }
            return rawBestiaryCatalogData;
        } catch (e) {}
    }
    return [];
}

export function loadGzippedBestiaryCatalog() {
    try {
        const catPath = path.join(VTT_DATA_DIR, 'bestiary-catalog.json');
        if (fs.existsSync(catPath)) {
            const stat = fs.statSync(catPath);
            if (!gzippedBestiaryCatalogBuf || stat.mtimeMs !== gzippedBestiaryCatalogMtime) {
                gzippedBestiaryCatalogMtime = stat.mtimeMs;
                const raw = fs.readFileSync(catPath);
                gzippedBestiaryCatalogBuf = zlib.gzipSync(raw, { level: 9 });
                bestiaryCatalogEtag = `W/"${gzippedBestiaryCatalogBuf.length}-${stat.mtimeMs}"`;
            }
        }
    } catch (e) {
        console.error('Error loading gzipped bestiary catalog cache:', e);
    }
}
loadGzippedBestiaryCatalog();

compendiumRouter.get(
    [
        '/api/bestiary/catalog',
        '/data/bestiary-catalog.json',
        '/vtt/data/bestiary-catalog.json',
        '/5etools-src/data/bestiary-catalog.json'
    ],
    (req, res) => {
        const campId = req.query.campaignId || extractSubdomain(req.headers.host);
        const disabledSet = getDisabledSourcesSet(campId);
        const customMonsters = loadCustomEntities('bestiary');

        if (disabledSet.size === 0 && customMonsters.length === 0) {
            loadGzippedBestiaryCatalog();
            if (!gzippedBestiaryCatalogBuf) return res.status(404).send('Bestiary catalog not found');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('ETag', bestiaryCatalogEtag);
            return res.send(gzippedBestiaryCatalogBuf);
        }

        const raw = getRawBestiaryCatalog();
        const filtered = raw.filter((m) => !disabledSet.has(String(m.source || 'MM').toUpperCase()));
        for (const cm of customMonsters) {
            if (!disabledSet.has(String(cm.source).toUpperCase())) {
                const rawAc = Array.isArray(cm.ac) ? cm.ac[0] : cm.ac;
                const parsedAc =
                    typeof rawAc === 'object' && rawAc !== null
                        ? rawAc.ac || rawAc.value || 10
                        : parseInt(rawAc, 10) || 10;

                const parsedHp =
                    typeof cm.hp === 'object' && cm.hp !== null ? cm.hp.average || 10 : parseInt(cm.hp, 10) || 10;

                const genId =
                    cm.id ||
                    `creature_${(cm.name || 'unnamed').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(cm.source || 'mybrew').toLowerCase()}`;

                filtered.push({
                    id: genId,
                    name: cm.name || 'Unnamed Creature',
                    source: cm.source || 'MYBREW',
                    type:
                        typeof cm.type === 'object' && cm.type !== null
                            ? cm.type.type || 'humanoid'
                            : cm.type || 'humanoid',
                    cr: cm.cr !== undefined ? String(cm.cr) : '0',
                    crNumeric: cm.crNumeric !== undefined ? cm.crNumeric : parseFloat(cm.cr) || 0,
                    hp: parsedHp,
                    ac: parsedAc
                });
            }
        }

        const buf = zlib.gzipSync(Buffer.from(JSON.stringify(filtered)));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send(buf);
    }
);

const creaturePartitionCache = new Map();

function getCreaturePartition(source) {
    const srcKey = (source || 'mm').toLowerCase();
    if (creaturePartitionCache.has(srcKey)) {
        return creaturePartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'bestiary-normalized', `bestiary-${srcKey}.json`);
    if (fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            creaturePartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load bestiary partition for ${srcKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', 'bestiary', `${srcKey}.json`);
    if (fs.existsSync(customPartPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(customPartPath, 'utf8'));
            const list = extractEntityArray(parsed, 'bestiary');
            creaturePartitionCache.set(srcKey, list);
            return list;
        } catch (err) {
            console.error(`Failed to load custom bestiary partition for ${srcKey}:`, err);
        }
    }
    return null;
}

compendiumRouter.get('/api/creature/:source/:id', (req, res) => {
    const { source, id } = req.params;
    const partition = getCreaturePartition(source);
    if (!partition) {
        return res.status(404).json({ error: `Bestiary source '${source}' not found` });
    }

    const cleanId = decodeURIComponent(id || '').toLowerCase();
    const normalizedSlug = cleanId.replace(/[^a-z0-9]/g, '_');
    const creature = partition.find((m) => {
        const mId = (m.id || '').toLowerCase();
        const mName = (m.name || '').toLowerCase();
        return (
            mId === cleanId ||
            mName === cleanId ||
            mName === cleanId.replace(/_/g, ' ') ||
            mId === `creature_${normalizedSlug}_${source.toLowerCase()}` ||
            mId === `creature_${cleanId}_${source.toLowerCase()}`
        );
    });

    if (!creature) {
        return res.status(404).json({ error: `Creature '${id}' not found in source '${source}'` });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(creature);
});

// Invalidate all compendium caches (called on source reload)
export function invalidateCompendiumCaches() {
    rawSpellsCatalogData = null;
    rawItemsCatalogData = null;
    rawBestiaryCatalogData = null;
    rawHandoutsCatalogData = null;
    gzippedSpellsCatalogBuf = null;
    gzippedItemsCatalogBuf = null;
    gzippedBestiaryCatalogBuf = null;
    spellPartitionCache.clear();
    itemPartitionCache.clear();
    creaturePartitionCache.clear();
    compendiumPartitionCache.clear();
    handoutPartitionCache.clear();
    loadGzippedSpellsCatalog();
    loadGzippedItemsCatalog();
    loadGzippedBestiaryCatalog();
}
