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
    extractEntityArray,
    onDatabaseDirectoryChanged
} from '../state.js';

export const compendiumRouter = express.Router();

/**
 * Validates that a compendium route parameter contains only safe alphanumeric/hyphen/underscore characters
 * and prevents directory traversal attacks.
 */
export function isValidCompendiumParam(param) {
    if (!param || typeof param !== 'string') return false;
    if (param.includes('\0') || param.includes('..') || param.includes('/') || param.includes('\\')) {
        return false;
    }
    return /^[a-zA-Z0-9_\-]+$/.test(param);
}

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
    if (!isValidCompendiumParam(source)) return null;
    const srcKey = (source || 'phb').toLowerCase();
    if (spellPartitionCache.has(srcKey)) {
        return spellPartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'spells-normalized', `spells-${srcKey}.json`);
    if (path.resolve(partPath).startsWith(path.resolve(VTT_DATA_DIR)) && fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            spellPartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load spell partition for ${srcKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', 'spells', `${srcKey}.json`);
    if (path.resolve(customPartPath).startsWith(path.resolve(DATA_DIR)) && fs.existsSync(customPartPath)) {
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
    if (!isValidCompendiumParam(source)) {
        return res.status(400).json({ error: 'Invalid source parameter' });
    }
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
    if (!isValidCompendiumParam(source)) {
        return res.status(400).json({ error: 'Invalid source parameter' });
    }
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
    if (!isValidCompendiumParam(source)) return null;
    const srcKey = (source || 'phb').toLowerCase();
    if (itemPartitionCache.has(srcKey)) {
        return itemPartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'items-normalized', `items-${srcKey}.json`);
    if (path.resolve(partPath).startsWith(path.resolve(VTT_DATA_DIR)) && fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            itemPartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load item partition for ${srcKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', 'items', `${srcKey}.json`);
    if (path.resolve(customPartPath).startsWith(path.resolve(DATA_DIR)) && fs.existsSync(customPartPath)) {
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
    if (!isValidCompendiumParam(source)) {
        return res.status(400).json({ error: 'Invalid source parameter' });
    }
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
    if (!isValidCompendiumParam(type) || !isValidCompendiumParam(source)) return null;
    let cleanType = (type || '').toLowerCase();
    if (cleanType === 'optionalfeature') cleanType = 'optionalfeatures';
    const srcKey = (source || 'phb').toLowerCase();
    const cacheKey = `${cleanType}:${srcKey}`;
    if (compendiumPartitionCache.has(cacheKey)) {
        return compendiumPartitionCache.get(cacheKey);
    }
    const partPath = path.join(VTT_DATA_DIR, `${cleanType}-normalized`, `${cleanType}-${srcKey}.json`);
    if (path.resolve(partPath).startsWith(path.resolve(VTT_DATA_DIR)) && fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            compendiumPartitionCache.set(cacheKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load compendium partition ${cacheKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', cleanType, `${srcKey}.json`);
    if (path.resolve(customPartPath).startsWith(path.resolve(DATA_DIR)) && fs.existsSync(customPartPath)) {
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
    if (!isValidCompendiumParam(type) || !isValidCompendiumParam(source)) {
        return res.status(400).json({ error: 'Invalid type or source parameter' });
    }
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
    if (!isValidCompendiumParam(source)) return null;
    const srcKey = (source || '').toLowerCase();
    if (handoutPartitionCache.has(srcKey)) {
        return handoutPartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'handouts-normalized', `handouts-${srcKey}.json`);
    if (path.resolve(partPath).startsWith(path.resolve(VTT_DATA_DIR)) && fs.existsSync(partPath)) {
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
    if (!isValidCompendiumParam(source)) {
        return res.status(400).json({ error: 'Invalid source parameter' });
    }
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
    if (!isValidCompendiumParam(source)) return null;
    const srcKey = (source || 'mm').toLowerCase();
    if (creaturePartitionCache.has(srcKey)) {
        return creaturePartitionCache.get(srcKey);
    }
    const partPath = path.join(VTT_DATA_DIR, 'bestiary-normalized', `bestiary-${srcKey}.json`);
    if (path.resolve(partPath).startsWith(path.resolve(VTT_DATA_DIR)) && fs.existsSync(partPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(partPath, 'utf8'));
            creaturePartitionCache.set(srcKey, data);
            return data;
        } catch (err) {
            console.error(`Failed to load bestiary partition for ${srcKey}:`, err);
        }
    }
    const customPartPath = path.join(DATA_DIR, 'sources', 'bestiary', `${srcKey}.json`);
    if (path.resolve(customPartPath).startsWith(path.resolve(DATA_DIR)) && fs.existsSync(customPartPath)) {
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
    if (!isValidCompendiumParam(source)) {
        return res.status(400).json({ error: 'Invalid source parameter' });
    }
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

// --- Tables Compendium Handlers ---
let rawTablesCatalogData = null;
let rawTablesFullList = null;
let tablesCatalogEtag = null;

function cleanCompendiumText(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') {
        if (typeof str === 'number' || typeof str === 'boolean') return String(str);
        if (typeof str === 'object') {
            if (str.entry) return cleanCompendiumText(str.entry);
            if (str.exact) return String(str.exact);
            if (str.min !== undefined && str.max !== undefined) return `${str.min}–${str.max}`;
            if (str.roll) return cleanCompendiumText(str.roll);
            return '';
        }
    }
    return str.replace(/\{@([a-zA-Z0-9_-]+)\s+([^}]+)\}/g, (m, tag, body) => {
        const parts = body.split('|');
        if (tag === 'card') return parts[0] || '';
        if (parts.length >= 3 && parts[2] && parts[2].length > 4 && !/^[A-Z0-9_-]+$/.test(parts[2])) return parts[2];
        return parts[0] || '';
    });
}

function loadTablesData() {
    if (rawTablesCatalogData && rawTablesFullList) return;
    try {
        const tablesPath = path.join(VTT_DATA_DIR, 'generated', 'gendata-tables.json');
        if (!fs.existsSync(tablesPath)) {
            rawTablesCatalogData = [];
            rawTablesFullList = [];
            return;
        }
        const stat = fs.statSync(tablesPath);
        const raw = JSON.parse(fs.readFileSync(tablesPath, 'utf8'));
        const rawList = Array.isArray(raw?.table) ? raw.table : [];

        // Ensure official Flesh Warping (Demon Ichor) table is indexed
        const hasFleshWarping = rawList.some((t) => (t.name || '').toLowerCase().includes('flesh warping'));
        if (!hasFleshWarping) {
            rawList.push({
                name: 'Flesh Warping (Demon Ichor)',
                source: 'BGDIA',
                dice: '1d100',
                chapter: { name: 'Avernus - Demon Ichor Hazard' },
                colLabels: ['{@dice d100}', 'Effect'],
                rows: [
                    [
                        '01-05',
                        "The color of the target's hair, eyes, and skin becomes blue, red, yellow, or patterned."
                    ],
                    ['06-10', "The target's eyes push out of its head at the end of stalks."],
                    ['11-15', "The target's hands grow claws, which can be used as daggers."],
                    [
                        '16-20',
                        "One of the target's legs grows longer than the other, reducing its walking speed by 10 feet."
                    ],
                    [
                        '21-25',
                        "The target's eyes become beacons, filling a 15-foot cone with dim light when they are open."
                    ],
                    [
                        '26-30',
                        "A pair of wings, either feathered or leathery, sprout from the target's back, granting it a flying speed of 30 feet."
                    ],
                    ['31-35', "The target's ears tear free from its head and scurry away; the target is deafened."],
                    ['36-40', "Two of the target's teeth turn into tusks."],
                    [
                        '41-45',
                        "The target's skin becomes scabby, granting it a +1 bonus to AC but reducing its Charisma by 2 (to a minimum of 1)."
                    ],
                    [
                        '46-50',
                        "The target's arms and legs switch places, preventing the target from moving unless it crawls."
                    ],
                    [
                        '51-55',
                        "The target's arms become tentacles with fingers on the ends, increasing its reach by 5 feet."
                    ],
                    [
                        '56-60',
                        "The target's legs grow incredibly long and springy, increasing its walking speed by 10 feet."
                    ],
                    ['61-65', 'The target grows a whiplike tail, which it can use as a whip.'],
                    ['66-70', "The target's eyes turn black, and it gains darkvision out to a range of 120 feet."],
                    ['71-75', 'The target swells, tripling its weight.'],
                    ['76-80', 'The target becomes thin and skeletal, halving its weight.'],
                    ['81-85', "The target's head doubles in size."],
                    ['86-90', "The target's ears become wings, giving it a flying speed of 5 feet."],
                    [
                        '91-95',
                        "The target's body becomes unusually brittle, causing the target to have vulnerability to bludgeoning, piercing, and slashing damage."
                    ],
                    [
                        '96-00',
                        'The target grows another head, causing it to have advantage on saving throws against being charmed, frightened, or stunned.'
                    ]
                ]
            });
        }

        // Auto-index rollable tables from items.json (e.g. Robe of Useful Items, Bag of Tricks, Wand of Wonder)
        const itemsPath = path.join(VTT_DATA_DIR, 'items.json');
        if (fs.existsSync(itemsPath)) {
            try {
                const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
                const itemList = Array.isArray(itemsData?.item) ? itemsData.item : [];
                for (const it of itemList) {
                    if (!it.entries || !Array.isArray(it.entries)) continue;
                    for (const entry of it.entries) {
                        if (
                            entry &&
                            typeof entry === 'object' &&
                            entry.type === 'table' &&
                            Array.isArray(entry.rows) &&
                            entry.rows.length > 0
                        ) {
                            const baseName = cleanCompendiumText(
                                entry.caption || entry.name || entry.data?.genTables?.tableName || `${it.name} Effects`
                            ).trim();
                            const finalTableName = baseName.toLowerCase().includes((it.name || '').toLowerCase())
                                ? baseName
                                : `${it.name} — ${baseName}`;

                            // Prevent duplicate entries if already in rawList
                            const alreadyExists = rawList.some(
                                (t) => (t.name || '').toLowerCase() === finalTableName.toLowerCase()
                            );
                            if (!alreadyExists) {
                                let diceFormula = '1d20';
                                if (Array.isArray(entry.colLabels) && entry.colLabels.length > 0) {
                                    const firstCol = cleanCompendiumText(entry.colLabels[0]).trim();
                                    if (/^d\d+/i.test(firstCol)) {
                                        diceFormula = `1${firstCol.toLowerCase()}`;
                                    } else if (/^\d+d\d+/i.test(firstCol)) {
                                        diceFormula = firstCol.toLowerCase();
                                    } else {
                                        diceFormula = `1d${entry.rows.length}`;
                                    }
                                } else {
                                    diceFormula = `1d${entry.rows.length}`;
                                }

                                rawList.push({
                                    name: finalTableName,
                                    source: (it.source || 'DMG').toUpperCase(),
                                    dice: diceFormula,
                                    chapter: { name: `Magic Items - ${it.name}` },
                                    colLabels: entry.colLabels || ['Roll', 'Effect'],
                                    rows: entry.rows
                                });
                            }
                        }
                    }
                }
            } catch (itemErr) {
                console.error('Error auto-indexing item tables:', itemErr);
            }
        }

        rawTablesFullList = rawList;

        rawTablesCatalogData = rawList.map((tbl, idx) => {
            let diceLabel = '1d20';
            if (Array.isArray(tbl.colLabels) && tbl.colLabels.length > 0) {
                const firstCol = cleanCompendiumText(tbl.colLabels[0]).trim();
                if (/^d\d+/i.test(firstCol) || /^\d+d\d+/i.test(firstCol)) {
                    diceLabel = firstCol;
                } else if (Array.isArray(tbl.rows) && tbl.rows.length > 0) {
                    diceLabel = `1d${tbl.rows.length}`;
                }
            } else if (Array.isArray(tbl.rows) && tbl.rows.length > 0) {
                diceLabel = `1d${tbl.rows.length}`;
            }

            return {
                id: `ctable_${idx}`,
                name: tbl.name || tbl.caption || `Table #${idx + 1}`,
                source: (tbl.source || 'PHB').toUpperCase(),
                dice: diceLabel,
                rowCount: Array.isArray(tbl.rows) ? tbl.rows.length : 0,
                chapter: tbl.chapter?.name || ''
            };
        });

        tablesCatalogEtag = `W/"${rawTablesCatalogData.length}-${stat.mtimeMs}"`;
    } catch (err) {
        console.error('Error loading compendium tables:', err);
        rawTablesCatalogData = [];
        rawTablesFullList = [];
    }
}

compendiumRouter.get(['/api/tables/catalog', '/data/tables-catalog.json'], (req, res) => {
    loadTablesData();
    const campId = req.query.campaignId || extractSubdomain(req.headers.host);
    const disabledSet = getDisabledSourcesSet(campId);

    let catalog = rawTablesCatalogData.filter((t) => !disabledSet.has(t.source));

    if (req.query.q) {
        const query = req.query.q.toLowerCase().trim();
        catalog = catalog.filter(
            (t) =>
                (t.name && t.name.toLowerCase().includes(query)) || (t.source && t.source.toLowerCase().includes(query))
        );
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!req.query.q) {
        res.setHeader('Cache-Control', 'public, max-age=600');
        if (tablesCatalogEtag) res.setHeader('ETag', tablesCatalogEtag);
    } else {
        res.setHeader('Cache-Control', 'no-cache');
    }
    res.json(catalog);
});

compendiumRouter.get('/api/tables/:id', (req, res) => {
    loadTablesData();
    const id = req.params.id;
    const match = id.match(/^ctable_(\d+)$/);
    if (!match) {
        return res.status(400).json({ error: 'Invalid table ID format' });
    }

    const idx = parseInt(match[1], 10);
    const tbl = rawTablesFullList[idx];
    if (!tbl) {
        return res.status(404).json({ error: 'Table not found' });
    }

    const colLabels = Array.isArray(tbl.colLabels)
        ? tbl.colLabels.map((c) => cleanCompendiumText(c))
        : ['Roll', 'Result'];

    const rows = Array.isArray(tbl.rows)
        ? tbl.rows.map((row) => {
              if (Array.isArray(row)) {
                  return row.map((cell) => cleanCompendiumText(cell));
              }
              return [cleanCompendiumText(row)];
          })
        : [];

    let dice = '1d20';
    if (colLabels.length > 0 && (/^d\d+/i.test(colLabels[0]) || /^\d+d\d+/i.test(colLabels[0]))) {
        dice = colLabels[0];
    } else if (rows.length > 0) {
        dice = `1d${rows.length}`;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
        id: `ctable_${idx}`,
        name: tbl.name || tbl.caption || `Table #${idx + 1}`,
        source: (tbl.source || 'PHB').toUpperCase(),
        dice,
        colLabels,
        rows
    });
});

// --- Card Decks Compendium Handlers ---
let compendiumDecksCache = null;

function loadCompendiumDecksData() {
    if (compendiumDecksCache) return compendiumDecksCache;

    const decks = [];

    // 1. Curse of Strahd Tarokka Deck
    try {
        const cosPath = path.join(VTT_DATA_DIR, 'adventure', 'adventure-cos.json');
        if (fs.existsSync(cosPath)) {
            const adv = JSON.parse(fs.readFileSync(cosPath, 'utf8'));
            const appE = adv.data?.find((d) => (d.name || '').includes('Appendix E'));
            if (appE && Array.isArray(appE.entries)) {
                const highDeckSec = appE.entries.find((e) => e.name === 'High Deck');
                const commonDeckSec = appE.entries.find((e) => e.name === 'Common Deck');

                const cards = [];

                // Extract High Deck
                if (highDeckSec) {
                    const tableEntry = highDeckSec.entries?.find((e) => e.type === 'table');
                    if (tableEntry && Array.isArray(tableEntry.rows)) {
                        tableEntry.rows.forEach((row, idx) => {
                            const name = cleanCompendiumText(row[0]).trim();
                            const desc = cleanCompendiumText(row[1]).trim();
                            cards.push({
                                id: `card_tarokka_high_${idx + 1}`,
                                name,
                                suit: 'High Deck',
                                number: idx + 1,
                                description: desc
                            });
                        });
                    }
                }

                // Extract Common Deck Suits
                if (commonDeckSec && Array.isArray(commonDeckSec.entries)) {
                    commonDeckSec.entries.forEach((sec) => {
                        const suitName = sec.name; // Swords, Stars, Coins, Glyphs
                        const suitTable = sec.entries?.find((e) => e.type === 'table');
                        if (suitTable && Array.isArray(suitTable.rows)) {
                            suitTable.rows.forEach((row, rIdx) => {
                                const rank = cleanCompendiumText(row[0]).trim();
                                const name = cleanCompendiumText(row[1]).trim();
                                const desc = cleanCompendiumText(row[2]).trim();
                                cards.push({
                                    id: `card_tarokka_${(suitName || 'common').toLowerCase()}_${rIdx + 1}`,
                                    name: `${rank} (${name})`,
                                    cardTitle: name,
                                    rank,
                                    suit: suitName,
                                    number: rIdx + 1,
                                    description: desc
                                });
                            });
                        }
                    });
                }

                if (cards.length > 0) {
                    decks.push({
                        id: 'cdeck_tarokka',
                        name: 'Curse of Strahd Tarokka Deck',
                        source: 'COS',
                        cardCount: cards.length,
                        description:
                            'The ancient 54-card fortune-telling deck used by the Vistani in Barovia to divine fates and locations.',
                        theme: 'tarokka',
                        cards
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error compiling Tarokka deck:', err);
    }

    // 2. Deck of Many Things
    decks.push({
        id: 'cdeck_many_things',
        name: 'Deck of Many Things',
        source: 'DMG',
        cardCount: 22,
        description:
            'A legendary wondrous artifact containing 22 cards of immense, reality-altering fortunes and cataclysms.',
        theme: 'many_things',
        cards: [
            {
                id: 'domt_sun',
                name: 'The Sun',
                suit: 'Fate',
                number: 1,
                description:
                    'You gain 50,000 XP, and a wondrous item (which the DM determines randomly) appears in your hands.'
            },
            {
                id: 'domt_moon',
                name: 'The Moon',
                suit: 'Fate',
                number: 2,
                description: 'You are granted the ability to cast the Wish spell 1d3 times.'
            },
            {
                id: 'domt_star',
                name: 'The Star',
                suit: 'Fate',
                number: 3,
                description: 'Increase one of your ability scores by 2. The score can exceed 20 but cannot exceed 24.'
            },
            {
                id: 'domt_comet',
                name: 'The Comet',
                suit: 'Fate',
                number: 4,
                description:
                    'If you single-handedly defeat the next hostile monster or group of monsters you encounter, you gain experience points enough to gain one level. Otherwise, this card has no effect.'
            },
            {
                id: 'domt_fates',
                name: 'The Fates',
                suit: 'Fate',
                number: 5,
                description:
                    "Reality's fabric unravels and spins anew, allowing you to avoid or erase one event as if it never happened. You can use this effect immediately or at any time before you die."
            },
            {
                id: 'domt_throne',
                name: 'The Throne',
                suit: 'Fate',
                number: 6,
                description:
                    'You gain proficiency in the Persuasion skill, and you double your proficiency bonus on checks made with that skill. In addition, you gain rightful ownership of a small keep somewhere in the world.'
            },
            {
                id: 'domt_key',
                name: 'The Key',
                suit: 'Fate',
                number: 7,
                description:
                    'A rare or rarer magic weapon with which you are proficient appears in your hands. The DM chooses the weapon.'
            },
            {
                id: 'domt_knight',
                name: 'The Knight',
                suit: 'Fate',
                number: 8,
                description:
                    'You gain the service of a 4th-level fighter follower who appears in an unoccupied space within 30 feet of you. The follower is of the same race as you and serves you loyally.'
            },
            {
                id: 'domt_gem',
                name: 'The Gem',
                suit: 'Fate',
                number: 9,
                description:
                    'Twenty-five gems worth 2,000 gp each, or fifty gems worth 1,000 gp each, appear at your feet.'
            },
            {
                id: 'domt_jester',
                name: 'The Jester',
                suit: 'Fate',
                number: 10,
                description: 'You gain 10,000 XP, or you can draw two additional cards.'
            },
            {
                id: 'domt_rogue',
                name: 'The Rogue',
                suit: 'Fate',
                number: 11,
                description:
                    "A nonplayer character of the DM's choice becomes secretly hostile toward you, plotting your ruin."
            },
            {
                id: 'domt_void',
                name: 'The Void',
                suit: 'Fate',
                number: 12,
                description:
                    "This black card spells disaster. Your soul is drawn from your body and contained in an object in a place of the DM's choice. Your body becomes incapacitated."
            },
            {
                id: 'domt_skull',
                name: 'The Skull',
                suit: 'Fate',
                number: 13,
                description:
                    'You summon an avatar of death—a ghostly humanoid skeleton clad in a tattered black robe and carrying a spectral scythe. It appears in an unoccupied space within 10 feet of you and attacks you, warning that no one may help you.'
            },
            {
                id: 'domt_ruin',
                name: 'The Ruin',
                suit: 'Fate',
                number: 14,
                description:
                    'All forms of wealth that you carry or own, other than magic items, are immediately lost. Portable property vanishes; businesses, buildings, and land you own are lost in a way that alters reality the least.'
            },
            {
                id: 'domt_euryale',
                name: 'The Euryale',
                suit: 'Fate',
                number: 15,
                description:
                    "The card's medusa-like face curses you. You take a -2 penalty on saving throws while cursed. Only a god or the magic of The Fates card can end this curse."
            },
            {
                id: 'domt_flames',
                name: 'The Flames',
                suit: 'Fate',
                number: 16,
                description:
                    'A powerful fiend becomes your sworn enemy, seeking to torment and ruin you before killing you.'
            },
            {
                id: 'domt_donjon',
                name: 'The Donjon',
                suit: 'Fate',
                number: 17,
                description:
                    'You disappear and become entombed in a state of suspended animation in an extradimensional sphere. Everything you were wearing and carrying remains behind in the space you occupied.'
            },
            {
                id: 'domt_talon',
                name: 'The Talon',
                suit: 'Fate',
                number: 18,
                description:
                    'Every magic item you are wearing or carrying is instantly disintegrated. Artifacts in your possession vanish elsewhere.'
            },
            {
                id: 'domt_idiot',
                name: 'The Idiot',
                suit: 'Fate',
                number: 19,
                description:
                    'Permanently reduce your Intelligence by 1d4 + 1 (to a minimum score of 1). You can draw one additional card beyond your declared draws.'
            },
            {
                id: 'domt_vizier',
                name: 'The Vizier',
                suit: 'Fate',
                number: 20,
                description:
                    'At any one time you choose within one year of drawing this card, you can ask a question in meditation and mentally receive a truthful answer to that question.'
            },
            {
                id: 'domt_balance',
                name: 'The Balance',
                suit: 'Fate',
                number: 21,
                description:
                    'Your mind suffers a wrenching alteration, causing your alignment to change to its diametric opposite.'
            },
            {
                id: 'domt_fool',
                name: 'The Fool',
                suit: 'Fate',
                number: 22,
                description: 'You lose 10,000 XP, discard this card, and must draw one additional card from the deck.'
            }
        ]
    });

    // 3. Deck of Illusions
    decks.push({
        id: 'cdeck_illusions',
        name: 'Deck of Illusions',
        source: 'DMG',
        cardCount: 34,
        description:
            'A magical deck of cards made from parchment. When a card is drawn and thrown to the ground, an illusion of one or more creatures materializes.',
        theme: 'illusions',
        cards: [
            {
                id: 'doi_1',
                name: 'Red Dragon',
                suit: 'Ace of Hearts',
                description: 'Illusion of a terrifying Red Dragon roaring with spectral flame.'
            },
            {
                id: 'doi_2',
                name: 'Knight and Four Guards',
                suit: 'King of Hearts',
                description: 'Illusion of a heavily armored Knight accompanied by four armed guards.'
            },
            {
                id: 'doi_3',
                name: 'Succubus or Incubus',
                suit: 'Queen of Hearts',
                description: 'Illusion of an alluring Fiend with bat-like wings.'
            },
            {
                id: 'doi_4',
                name: 'Druid',
                suit: 'Jack of Hearts',
                description: 'Illusion of an elder Druid wielding a staff of gnarled oak.'
            },
            {
                id: 'doi_5',
                name: 'Cloud Giant',
                suit: '10 of Hearts',
                description: 'Illusion of a towering Cloud Giant shrouded in mist.'
            },
            {
                id: 'doi_6',
                name: 'Ettin',
                suit: '9 of Hearts',
                description: 'Illusion of a bickering, two-headed Ettin wielding massive clubs.'
            },
            {
                id: 'doi_7',
                name: 'Bugbear',
                suit: '8 of Hearts',
                description: 'Illusion of a stealthy Bugbear stalker ready to pounce.'
            },
            {
                id: 'doi_8',
                name: 'Goblin',
                suit: '2 of Hearts',
                description: 'Illusion of a snickering Goblin raider with a rusty shortbow.'
            },
            {
                id: 'doi_9',
                name: 'Beholder',
                suit: 'Ace of Diamonds',
                description: 'Illusion of a floating Beholder with ten writhing eye stalks.'
            },
            {
                id: 'doi_10',
                name: 'Archmage and Apprentice',
                suit: 'King of Diamonds',
                description: 'Illusion of an Archmage in starry robes followed by an eager Apprentice.'
            },
            {
                id: 'doi_11',
                name: 'Night Hag',
                suit: 'Queen of Diamonds',
                description: 'Illusion of a cackling Night Hag carrying a soul bag.'
            },
            {
                id: 'doi_12',
                name: 'Assassin',
                suit: 'Jack of Diamonds',
                description: 'Illusion of a cloaked Assassin coated in venomous daggers.'
            },
            {
                id: 'doi_13',
                name: 'Fire Giant',
                suit: '10 of Diamonds',
                description: 'Illusion of an imposing Fire Giant in forged plate mail.'
            },
            {
                id: 'doi_14',
                name: 'Ogre Mage (Oni)',
                suit: '9 of Diamonds',
                description: 'Illusion of a horned Oni floating above the ground with a massive naginata.'
            },
            {
                id: 'doi_15',
                name: 'Gnoll',
                suit: '8 of Diamonds',
                description: 'Illusion of a bloodthirsty hyena-headed Gnoll warrior.'
            },
            {
                id: 'doi_16',
                name: 'Kobold',
                suit: '2 of Diamonds',
                description: 'Illusion of a scuttling reptilian Kobold holding a sling.'
            },
            {
                id: 'doi_17',
                name: 'Lich',
                suit: 'Ace of Spades',
                description: 'Illusion of a withered undead Lich crowned with dark sorcery.'
            },
            {
                id: 'doi_18',
                name: 'Priest and Two Acolytes',
                suit: 'King of Spades',
                description: 'Illusion of a high Priest chanting prayers with two kneeling Acolytes.'
            },
            {
                id: 'doi_19',
                name: 'Medusa',
                suit: 'Queen of Spades',
                description: 'Illusion of a serpentine Medusa with eyes of petrifying glare.'
            },
            {
                id: 'doi_20',
                name: 'Veteran',
                suit: 'Jack of Spades',
                description: 'Illusion of a battle-scarred Veteran warrior.'
            },
            {
                id: 'doi_21',
                name: 'Frost Giant',
                suit: '10 of Spades',
                description: 'Illusion of a Frost Giant barbarian carrying a greataxe of glacial ice.'
            },
            {
                id: 'doi_22',
                name: 'Troll',
                suit: '9 of Spades',
                description: 'Illusion of a regenerating, mossy Troll.'
            },
            {
                id: 'doi_23',
                name: 'Hobgoblin',
                suit: '8 of Spades',
                description: 'Illusion of a disciplined Hobgoblin captain.'
            },
            { id: 'doi_24', name: 'Goblin', suit: '2 of Spades', description: 'Illusion of a nervous Goblin sentry.' },
            {
                id: 'doi_25',
                name: 'Iron Golem',
                suit: 'Ace of Clubs',
                description: 'Illusion of an impenetrable Iron Golem emanating heated fumes.'
            },
            {
                id: 'doi_26',
                name: 'Bandit Captain and Three Bandits',
                suit: 'King of Clubs',
                description: 'Illusion of a swashbuckling Bandit Captain and three scoundrels.'
            },
            {
                id: 'doi_27',
                name: 'Erinyes',
                suit: 'Queen of Clubs',
                description: 'Illusion of a winged fiendish Erinyes with an infernal bow.'
            },
            {
                id: 'doi_28',
                name: 'Berserker',
                suit: 'Jack of Clubs',
                description: 'Illusion of a frenzied tribal Berserker.'
            },
            {
                id: 'doi_29',
                name: 'Hill Giant',
                suit: '10 of Clubs',
                description: 'Illusion of a gluttonous Hill Giant clubbing the dirt.'
            },
            {
                id: 'doi_30',
                name: 'Ogre',
                suit: '9 of Clubs',
                description: 'Illusion of a lumbering Ogre in animal hides.'
            },
            { id: 'doi_31', name: 'Orc', suit: '8 of Clubs', description: 'Illusion of a war-painted Orc warrior.' },
            {
                id: 'doi_32',
                name: 'Kobold',
                suit: '2 of Clubs',
                description: 'Illusion of a terrified Kobold cowering behind a buckler.'
            },
            {
                id: 'doi_33',
                name: 'The Character (You)',
                suit: 'Joker 1',
                description: 'An illusory exact double of the character who drew this card.'
            },
            {
                id: 'doi_34',
                name: 'The Character (You)',
                suit: 'Joker 2',
                description: 'An illusory exact double of the character who drew this card.'
            }
        ]
    });

    compendiumDecksCache = decks;
    return compendiumDecksCache;
}

compendiumRouter.get('/api/decks/catalog', (req, res) => {
    const decks = loadCompendiumDecksData();
    const campId = req.query.campaignId || extractSubdomain(req.headers.host);
    const disabledSet = getDisabledSourcesSet(campId);

    const catalog = decks
        .filter((d) => {
            if (req.query.source) return d.source.toLowerCase() === req.query.source.toLowerCase();
            return true;
        })
        .map((d) => ({
            id: d.id,
            name: d.name,
            source: d.source,
            cardCount: d.cardCount,
            description: d.description,
            theme: d.theme
        }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(catalog);
});

compendiumRouter.get('/api/decks/:id', (req, res) => {
    const decks = loadCompendiumDecksData();
    const id = req.params.id;
    const deck = decks.find((d) => d.id === id);
    if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(deck);
});

// Invalidate all compendium caches (called on source reload)
export function invalidateCompendiumCaches() {
    rawSpellsCatalogData = null;
    rawItemsCatalogData = null;
    rawBestiaryCatalogData = null;
    rawHandoutsCatalogData = null;
    rawTablesCatalogData = null;
    rawTablesFullList = null;
    compendiumDecksCache = null;
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

onDatabaseDirectoryChanged(() => {
    invalidateCompendiumCaches();
});
