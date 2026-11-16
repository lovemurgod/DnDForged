import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Checks whether a parsed JSON manifest represents a Roll20 character export
 * (typically exported via the 5etools Better20 browser extension).
 */
export function isRoll20CharacterJson(data) {
    if (!data || typeof data !== 'object') return false;
    // Better20 exports contain { schema_version: 1, character: { attributes, attribs: [...] } }
    if (data.schema_version !== undefined && data.character && Array.isArray(data.character.attribs)) {
        return true;
    }
    // Alternate format: character root with attribs
    if (data.character && Array.isArray(data.character.attribs) && data.character.attributes) {
        return true;
    }
    return false;
}

/**
 * Normalizes Roll20 image URLs:
 * 1. Decodes URL-encoded components (e.g. %3A, %2F).
 * 2. Rewrites direct Amazon S3 bucket URLs (which yield HTTP 403 AccessDenied) to Roll20's active CDN domain (files.d20.io).
 */
export function normalizeRoll20ImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let decoded = rawUrl.trim();
    try {
        if (decoded.includes('%3A') || decoded.includes('%2F')) {
            decoded = decodeURIComponent(decoded);
        }
    } catch {}

    // Rewrite Amazon S3 direct bucket URL to Roll20 CDN domain
    decoded = decoded.replace(/^https?:\/\/s3\.amazonaws\.com\/files\.d20\.io\//i, 'https://files.d20.io/');

    return decoded;
}

/**
 * Downloads a remote image asset and caches it into the campaign's uploads directory.
 * Returns the local asset path (/assets/campaigns/<campaignId>/uploads/<filename>) or null on failure.
 * Strict offline integrity: No remote URLs are returned if the download fails.
 * Deduplicates files based on content MD5 hash.
 */
export async function downloadAssetToLocal(url, uploadsDir, campaignId) {
    const targetUrl = normalizeRoll20ImageUrl(url);
    if (!targetUrl || !targetUrl.startsWith('http')) return null;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DnDForged/1.0',
                Referer: 'https://app.roll20.net/'
            }
        });
        clearTimeout(timeout);
        if (!res.ok) return null;

        const contentType = res.headers.get('content-type') || '';
        let ext = '.png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('webp')) ext = '.webp';
        else if (contentType.includes('gif')) ext = '.gif';
        else if (targetUrl.includes('.jpg') || targetUrl.includes('.jpeg')) ext = '.jpg';
        else if (targetUrl.includes('.webp')) ext = '.webp';
        else if (targetUrl.includes('.gif')) ext = '.gif';

        const buffer = Buffer.from(await res.arrayBuffer());
        if (!buffer || buffer.length === 0) return null;

        const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
        const fileName = `roll20_${hash}${ext}`;
        const filePath = path.join(uploadsDir, fileName);

        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, buffer);
        }
        return `/assets/campaigns/${campaignId}/uploads/${fileName}`;
    } catch {
        return null;
    }
}

let itemCatalogCache = null;
let itemCatalogMap = null;

export function loadItemCatalog() {
    if (itemCatalogCache) return itemCatalogCache;
    const candidates = [
        path.join(process.cwd(), 'vtt', 'data', 'items-catalog.json'),
        path.join(process.cwd(), 'data', 'items-catalog.json')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                itemCatalogCache = JSON.parse(fs.readFileSync(p, 'utf8'));
                itemCatalogMap = new Map();
                for (const it of itemCatalogCache) {
                    const norm = it.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!itemCatalogMap.has(norm)) {
                        itemCatalogMap.set(norm, it);
                    }
                }
                return itemCatalogCache;
            } catch {}
        }
    }
    return [];
}

export function findCatalogItem(rawName) {
    if (!rawName) return null;
    loadItemCatalog();
    if (!itemCatalogMap) return null;

    const clean = rawName
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*\d+(\.\d+)?\s*(gp|pp|sp|cp|ep|k|g)\b/gi, '')
        .trim();

    const norm1 = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (itemCatalogMap.has(norm1)) return itemCatalogMap.get(norm1);

    const normRaw = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (itemCatalogMap.has(normRaw)) return itemCatalogMap.get(normRaw);

    // Common D&D aliases and prefixes
    if (norm1.includes('holywater')) {
        const hw = itemCatalogCache.find((i) => i.name.toLowerCase().startsWith('holy water'));
        if (hw) return hw;
    }
    if (norm1.includes('scrollcase')) {
        const sc = itemCatalogCache.find(
            (i) => i.name.toLowerCase().includes('map or scroll case') || i.name.toLowerCase().includes('case, map')
        );
        if (sc) return sc;
    }
    if (norm1.includes('eversmoking')) {
        const es = itemCatalogCache.find((i) => i.name.toLowerCase().includes('eversmoking bottle'));
        if (es) return es;
    }

    return null;
}

export function inferSpellAbilityFromClasses(clsList) {
    for (const c of clsList) {
        const n = (c.name || '').toLowerCase();
        if (n.includes('wizard') || n.includes('artificer')) return 'INT';
        if (n.includes('cleric') || n.includes('druid') || n.includes('ranger')) return 'WIS';
        if (n.includes('bard') || n.includes('paladin') || n.includes('sorcerer') || n.includes('warlock'))
            return 'CHA';
    }
    return 'INT';
}

export function resolveRoll20Expression(raw, ctx) {
    if (!raw || typeof raw !== 'string') return raw || '';
    let str = raw.trim();

    const varMap = {
        pb: ctx.pb,
        level: ctx.level,
        strength_mod: ctx.mods.str,
        dexterity_mod: ctx.mods.dex,
        constitution_mod: ctx.mods.con,
        intelligence_mod: ctx.mods.int,
        wisdom_mod: ctx.mods.wis,
        charisma_mod: ctx.mods.cha,
        spell_save_dc: ctx.spellSaveDc,
        spell_attack_mod: ctx.spellAtkMod
    };

    (ctx.classes || []).forEach((c, idx) => {
        if (idx > 0) varMap[`multiclass${idx}_lvl`] = c.level;
    });

    // Replace @{var}
    str = str.replace(/@\{([a-zA-Z0-9_-]+)\}/g, (match, vName) => {
        const low = vName.toLowerCase();
        return varMap[low] !== undefined ? varMap[low] : match;
    });

    // Replace ?{prompt|default}
    str = str.replace(/\?\{[^|}]+\|([^,}|]+)[^}]*\}/g, '$1');
    str = str.replace(/\?\{[^}]+\}/g, '1');

    // Replace [[ math ]]
    str = str.replace(/\[\[\s*([^\]]+)\s*\]\]/g, (match, inner) => {
        try {
            const sanitized = inner
                .replace(/ceil/gi, 'Math.ceil')
                .replace(/floor/gi, 'Math.floor')
                .replace(/round/gi, 'Math.round')
                .replace(/[^0-9+*/().Mathceilorund -]/g, '');
            const val = new Function(`return (${sanitized})`)();
            return !isNaN(val) ? val : match;
        } catch {
            return match;
        }
    });

    // Secondary pass for nested brackets like ([[3]]-1)d8 or (4)d8
    str = str.replace(/\(\s*([0-9+*/(). -]+)\s*\)d(\d+)/g, (match, mathExpr, die) => {
        try {
            const val = new Function(`return (${mathExpr})`)();
            return !isNaN(val) ? `${val}d${die}` : match;
        } catch {
            return match;
        }
    });

    // Strip remaining standalone [[ ]] or ( ) around pure numbers
    str = str.replace(/\[\[\s*(\d+)\s*\]\]/g, '$1');
    str = str.replace(/^\s*\(\s*(\d+)\s*\)\s*$/, '$1');

    // Normalize + and spaces
    str = str
        .replace(/\s*\+\s*/g, ' + ')
        .replace(/\s*-\s*/g, ' - ')
        .trim();
    return str;
}

/**
 * Converts a Roll20/Better20 character JSON export into a native DnDForged character object.
 */
export async function convertRoll20Character(rawJson, campaignId, options = {}) {
    const { sourceManager, uploadsDir } = options;
    const charRoot = rawJson.character || rawJson;
    const rawAttrs = charRoot.attributes || {};
    const rawAttribs = charRoot.attribs || [];

    // 1. Build flat attribute dictionary and repeating tables
    const attrMap = {};
    const repeating = {
        inventory: {},
        attack: {},
        traits: {},
        proficiencies: {},
        tool: {},
        hd: {},
        savemod: {},
        skillmod: {},
        acmod: {},
        tohitmod: {},
        damagemod: {},
        resource: {},
        spells: {}
    };

    for (const a of rawAttribs) {
        if (!a || !a.name) continue;
        attrMap[a.name] = a.current;
        if (a.max !== undefined && a.max !== '') {
            attrMap[`${a.name}_max`] = a.max;
        }

        const repMatch = a.name.match(/^repeating_([a-zA-Z0-9-]+)_([a-zA-Z0-9-]+)_(.+)$/);
        if (repMatch) {
            const [, cat, rowId, field] = repMatch;
            if (cat.startsWith('spell-')) {
                const lvl = cat.replace('spell-', '');
                if (!repeating.spells[lvl]) repeating.spells[lvl] = {};
                if (!repeating.spells[lvl][rowId]) repeating.spells[lvl][rowId] = { id: rowId };
                repeating.spells[lvl][rowId][field] = a.current;
                if (a.max) repeating.spells[lvl][rowId][`${field}_max`] = a.max;
            } else if (repeating[cat] !== undefined) {
                if (!repeating[cat][rowId]) repeating[cat][rowId] = { id: rowId };
                repeating[cat][rowId][field] = a.current;
                if (a.max) repeating[cat][rowId][`${field}_max`] = a.max;
            }
        }
    }

    // 2. Character Name
    const charName = (rawAttrs.name || attrMap['character_name'] || 'Imported Character').trim();

    // 3. Ability Scores (Default to 10 if omitted by Roll20)
    function getScore(name) {
        const val = attrMap[name] !== undefined ? attrMap[name] : attrMap[`${name}_base`];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            const n = parseInt(val);
            if (!isNaN(n)) return n;
        }
        return 10;
    }

    const stats = {
        str: getScore('strength'),
        dex: getScore('dexterity'),
        con: getScore('constitution'),
        int: getScore('intelligence'),
        wis: getScore('wisdom'),
        cha: getScore('charisma')
    };

    // 4. Classes and Multiclassing
    const classes = [];
    const primaryClassName = (attrMap['class'] || 'Adventurer').trim();
    const primarySubclass = (attrMap['subclass'] || '').trim();
    let primaryLevel = parseInt(attrMap['base_level']);
    if (isNaN(primaryLevel) || primaryLevel <= 0) {
        primaryLevel = parseInt(attrMap['level']) || 1;
    }
    classes.push({ name: primaryClassName, subclass: primarySubclass, level: primaryLevel });

    for (let i = 1; i <= 8; i++) {
        const mcName = attrMap[`multiclass${i}`];
        if (mcName && String(mcName).trim()) {
            const mcSub = attrMap[`multiclass${i}_subclass`] || '';
            const mcLvl = parseInt(attrMap[`multiclass${i}_lvl`]) || 1;
            classes.push({ name: String(mcName).trim(), subclass: String(mcSub).trim(), level: mcLvl });
        }
    }
    const totalLevel = classes.reduce((sum, c) => sum + (c.level || 0), 0) || 1;
    const classString = classes.map((c) => c.name).join(' / ');

    // Spellcasting ability & proficiency bonus
    const pb = Math.ceil(totalLevel / 4) + 1;
    let spellAbility = 'INT';
    const saRaw = (attrMap['spellcasting_ability'] || '').toLowerCase();
    if (saRaw.includes('wis')) spellAbility = 'WIS';
    else if (saRaw.includes('cha')) spellAbility = 'CHA';
    else if (saRaw.includes('int')) spellAbility = 'INT';
    else spellAbility = inferSpellAbilityFromClasses(classes);

    const statMods = {
        str: Math.floor((stats.str - 10) / 2),
        dex: Math.floor((stats.dex - 10) / 2),
        con: Math.floor((stats.con - 10) / 2),
        int: Math.floor((stats.int - 10) / 2),
        wis: Math.floor((stats.wis - 10) / 2),
        cha: Math.floor((stats.cha - 10) / 2)
    };

    const spellMod = statMods[spellAbility.toLowerCase()] || 0;
    const spellSaveDc = 8 + pb + spellMod;
    const spellAtkMod = pb + spellMod;

    const evalCtx = {
        level: totalLevel,
        pb: pb,
        mods: statMods,
        spellSaveDc: spellSaveDc,
        spellAtkMod: spellAtkMod,
        classes: classes
    };

    // 5. HP & AC
    const hpMax = parseInt(attrMap['hp_max'] || attrMap['hp']) || 10;
    const hpCurrent = parseInt(attrMap['hp']) || hpMax;
    const tempHp = parseInt(attrMap['hp_temp']) || 0;
    const ac = parseInt(attrMap['ac']) || 10;

    // 6. Speed
    let walkSpeed = 30;
    if (attrMap['speed']) {
        const parsedSpeed = parseInt(attrMap['speed']);
        if (!isNaN(parsedSpeed) && parsedSpeed > 0) walkSpeed = parsedSpeed;
    }
    const speed = { walk: walkSpeed, climb: 0, fly: 0, burrow: 0 };

    // 7. Saves
    function isProf(val) {
        if (val === undefined || val === null) return false;
        const s = String(val).trim().toLowerCase();
        return s === '1' || s.includes('pb') || s === 'true';
    }

    const saves = {
        str: isProf(attrMap['strength_save_prof']),
        dex: isProf(attrMap['dexterity_save_prof']),
        con: isProf(attrMap['constitution_save_prof']),
        int: isProf(attrMap['intelligence_save_prof']),
        wis: isProf(attrMap['wisdom_save_prof']),
        cha: isProf(attrMap['charisma_save_prof'])
    };

    // 8. Skills & Expertise
    const skillList = [
        { key: 'acrobatics', name: 'Acrobatics' },
        { key: 'animal_handling', name: 'Animal Handling' },
        { key: 'arcana', name: 'Arcana' },
        { key: 'athletics', name: 'Athletics' },
        { key: 'deception', name: 'Deception' },
        { key: 'history', name: 'History' },
        { key: 'insight', name: 'Insight' },
        { key: 'intimidation', name: 'Intimidation' },
        { key: 'investigation', name: 'Investigation' },
        { key: 'medicine', name: 'Medicine' },
        { key: 'nature', name: 'Nature' },
        { key: 'perception', name: 'Perception' },
        { key: 'performance', name: 'Performance' },
        { key: 'persuasion', name: 'Persuasion' },
        { key: 'religion', name: 'Religion' },
        { key: 'sleight_of_hand', name: 'Sleight of Hand' },
        { key: 'stealth', name: 'Stealth' },
        { key: 'survival', name: 'Survival' }
    ];

    const skills = {};
    const expertise = {};

    for (const sk of skillList) {
        const raw = attrMap[`${sk.key}_prof`];
        if (raw !== undefined && raw !== null) {
            const strVal = String(raw).trim();
            if (strVal === '2' || strVal.includes('*2')) {
                skills[sk.name] = 2;
                skills[sk.key] = 2;
                expertise[sk.name] = true;
                expertise[sk.key] = true;
            } else if (strVal === '1' || strVal.includes('pb') || strVal.toLowerCase() === 'true') {
                skills[sk.name] = 1;
                skills[sk.key] = 1;
            }
        }
    }

    // 8b. Proficiencies & Tools
    const languageItems = [];
    const armorItems = [];
    const weaponItems = [];

    Object.values(repeating.proficiencies).forEach((prof) => {
        const pName = (prof.name || '').trim();
        if (!pName) return;
        const low = pName.toLowerCase();
        if (low.includes('armor') || low.includes('shield')) {
            armorItems.push(pName);
        } else if (
            low.includes('weapon') ||
            low.includes('sword') ||
            low.includes('dagger') ||
            low.includes('club') ||
            low.includes('spear') ||
            low.includes('mace') ||
            low.includes('warhammer') ||
            low.includes('bow') ||
            low.includes('crossbow') ||
            low.includes('firearm')
        ) {
            weaponItems.push(pName);
        } else {
            languageItems.push(pName);
        }
    });

    const proficiencies = {
        languages: languageItems.join(', '),
        armor: armorItems.join(', '),
        weapons: weaponItems.join(', ')
    };

    const tools = {};
    Object.values(repeating.tool).forEach((t) => {
        const tName = (t.toolname || '').trim();
        if (!tName) return;
        const low = tName.toLowerCase();
        let ab = 'dex';
        if (low.includes('herbalism') || low.includes('navigator')) {
            ab = 'wis';
        } else if (
            low.includes('smith') ||
            low.includes('tinker') ||
            low.includes('mason') ||
            low.includes('brewer') ||
            low.includes('chess') ||
            low.includes('game') ||
            low.includes('alchemist')
        ) {
            ab = 'int';
        } else if (low.includes('vehicle') || low.includes('land') || low.includes('water')) {
            ab = 'str';
        }

        const isExp = String(t.toolbonus || '').includes('*2') || String(t.toolbonus_base || '').includes('*2');
        tools[tName] = {
            ability: ab,
            show: true,
            prof: true,
            exp: isExp
        };
    });

    // 9. Currency
    const currency = {
        cp: parseInt(attrMap['cp']) || 0,
        sp: parseInt(attrMap['sp']) || 0,
        ep: parseInt(attrMap['ep']) || 0,
        gp: parseInt(attrMap['gp']) || 0,
        pp: parseInt(attrMap['pp']) || 0
    };

    // 10. Roleplaying Notes & Bio
    const rpParts = [];
    if (attrMap['personality_traits']) rpParts.push(`### Personality Traits\n${attrMap['personality_traits']}`);
    if (attrMap['ideals']) rpParts.push(`### Ideals\n${attrMap['ideals']}`);
    if (attrMap['bonds']) rpParts.push(`### Bonds\n${attrMap['bonds']}`);
    if (attrMap['flaws']) rpParts.push(`### Flaws\n${attrMap['flaws']}`);
    if (attrMap['backstory']) rpParts.push(`### Backstory\n${attrMap['backstory']}`);
    if (attrMap['allies_and_organizations'])
        rpParts.push(`### Allies & Organizations\n${attrMap['allies_and_organizations']}`);
    if (attrMap['character_appearance']) rpParts.push(`### Appearance\n${attrMap['character_appearance']}`);

    let extraBio = '';
    if (typeof rawAttrs.bio === 'string' && rawAttrs.bio.trim()) {
        extraBio = rawAttrs.bio.trim();
    } else if (typeof charRoot.blobBio === 'string' && charRoot.blobBio.trim()) {
        try {
            extraBio = decodeURIComponent(charRoot.blobBio).trim();
        } catch {
            extraBio = charRoot.blobBio.trim();
        }
    }
    if (extraBio) rpParts.push(`### Additional Notes\n${extraBio}`);

    let notes = '';
    if (typeof rawAttrs.gmnotes === 'string') {
        notes = rawAttrs.gmnotes;
    } else if (typeof charRoot.blobGmNotes === 'string') {
        try {
            notes = decodeURIComponent(charRoot.blobGmNotes);
        } catch {
            notes = charRoot.blobGmNotes;
        }
    }

    const bio = {
        height: attrMap['height'] || '',
        age: attrMap['age'] || '',
        weight: attrMap['weight'] || '',
        backstory: rpParts.join('\n\n'),
        notes: notes
    };

    // 11. Actions & Combat Macros (repeating_attack)
    function parseStat(formula) {
        if (!formula) return 'none';
        const f = String(formula).toLowerCase();
        if (f.includes('str')) return 'str';
        if (f.includes('dex')) return 'dex';
        if (f.includes('con')) return 'con';
        if (f.includes('int')) return 'int';
        if (f.includes('wis')) return 'wis';
        if (f.includes('cha')) return 'cha';
        return 'none';
    }

    const macros = [];
    Object.values(repeating.attack).forEach((atk) => {
        const atkName = (atk.atkname || 'Attack').trim();

        // Skip blank Roll20 header / category rows (e.g. "Level 1", "Level 2")
        const hasDmg = Boolean(atk.dmgbase || atk.dmg2base || (atk.damage_dice && atk.damage_dice !== ''));
        const rawBonus = (atk.atkbonus || '').trim();
        const hasNumericAtk =
            rawBonus !== '' && rawBonus !== '-' && !rawBonus.startsWith('DC') && !isNaN(parseInt(rawBonus));
        const hasSave = Boolean(atk.saveattr || (atk.savedc && !atk.savedc.includes('@{spell_save_dc}')));
        const hasDesc = Boolean(atk.atk_desc && atk.atk_desc.trim());

        if (!hasDmg && !hasNumericAtk && !hasSave && !hasDesc) {
            return;
        }

        let bonus = '';
        if (hasNumericAtk) {
            const parsed = parseInt(rawBonus);
            bonus = parsed >= 0 ? `+${parsed}` : `${parsed}`;
        }

        const magicBonus = parseInt(atk.atkmagic) || 0;

        const dmgList = [];
        if (atk.dmgbase) {
            let formula = resolveRoll20Expression(atk.dmgbase, evalCtx);
            if (magicBonus > 0 && !formula.includes(`+ ${magicBonus}`) && !formula.includes(`+${magicBonus}`)) {
                formula += ` + ${magicBonus}`;
            }
            dmgList.push({
                id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                formula: formula,
                type: (atk.dmgtype || '').trim()
            });
        }
        if (atk.dmg2base) {
            const formula2 = resolveRoll20Expression(atk.dmg2base, evalCtx);
            dmgList.push({
                id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                formula: formula2,
                type: (atk.dmg2type || '').trim()
            });
        }

        let saveAbility = '';
        if (atk.saveattr && parseStat(atk.saveattr) !== 'none') {
            saveAbility = parseStat(atk.saveattr);
        }

        let saveDc = '';
        if (atk.savedc) {
            const resolvedDc = resolveRoll20Expression(atk.savedc, evalCtx);
            const parsedDc = parseInt(resolvedDc);
            saveDc = !isNaN(parsedDc)
                ? String(parsedDc)
                : rawBonus.startsWith('DC')
                  ? rawBonus.replace('DC', '').trim()
                  : '';
        } else if (rawBonus.startsWith('DC')) {
            saveDc = rawBonus.replace('DC', '').trim();
        }

        macros.push({
            id: `mac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: atkName,
            attackBonus: bonus,
            attackExtra: magicBonus,
            attackStat: parseStat(atk.atkattr_base),
            attackProf: hasNumericAtk || parseStat(atk.atkattr_base) !== 'none',
            damage: dmgList,
            range: resolveRoll20Expression(atk.atkrange || '', evalCtx),
            critRange: parseInt(atk.atkcritrange) || 20,
            saveAbility: saveAbility,
            saveDcBase: saveDc,
            description: (atk.atk_desc || '').trim()
        });
    });

    // 12. Ability Cards & Class Resources (Strict 1:1 Direct Import)
    const abilityCards = [];
    const resourceMap = {};

    function addResource(name, curVal, maxVal) {
        const cleanName = (name || '').trim();
        if (!cleanName) return;
        const low = cleanName.toLowerCase();
        const isShort =
            low.includes('channel divinity') ||
            low.includes('bard') ||
            low.includes('ki') ||
            low.includes('surge') ||
            low.includes('wild shape') ||
            low.includes('short');

        let cur = 0;
        let max = 0;
        if (curVal !== undefined && curVal !== null && curVal !== '') {
            cur = parseInt(curVal) || 0;
        }
        if (maxVal !== undefined && maxVal !== null && maxVal !== '') {
            max = parseInt(maxVal);
            if (isNaN(max)) max = cur;
        } else {
            max = cur;
        }

        resourceMap[low] = {
            displayName: cleanName,
            current: cur,
            max: max,
            reset: isShort ? 'short' : 'long'
        };
    }

    // Direct 1:1 extraction from dual-column repeating_resource
    Object.values(repeating.resource).forEach((res) => {
        if (res.resource_left_name) {
            addResource(res.resource_left_name, res.resource_left, res.resource_left_max);
        }
        if (res.resource_right_name) {
            addResource(res.resource_right_name, res.resource_right, res.resource_right_max);
        }
        if (res.resource_name) {
            addResource(res.resource_name, res.resource_count, res.resource_count_max);
        }
    });

    // Also check standard Roll20 class_resource / other_resource
    if (attrMap['class_resource_name']) {
        addResource(attrMap['class_resource_name'], attrMap['class_resource'], attrMap['class_resource_max']);
    }
    if (attrMap['other_resource_name']) {
        addResource(attrMap['other_resource_name'], attrMap['other_resource'], attrMap['other_resource_max']);
    }

    const normalizeKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    function levDist(a, b) {
        const m = a.length,
            n = b.length;
        if (Math.abs(m - n) > 2) return 99;
        const d = [];
        for (let i = 0; i <= m; i++) d[i] = [i];
        for (let j = 0; j <= n; j++) d[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            }
        }
        return d[m][n];
    }

    Object.values(repeating.traits).forEach((trait) => {
        const tName = trait.name || 'Feature';
        const key = tName.trim().toLowerCase();
        const normKey = normalizeKey(key);

        let matchedKey = null;
        if (resourceMap[key]) {
            matchedKey = key;
        } else {
            matchedKey = Object.keys(resourceMap).find((rk) => {
                const rkNorm = normalizeKey(rk);
                if (!rkNorm || !normKey) return false;
                if (normKey === rkNorm || normKey.includes(rkNorm) || rkNorm.includes(normKey)) return true;
                if (normKey.length >= 5 && rkNorm.length >= 5 && levDist(normKey, rkNorm) <= 2) return true;
                return false;
            });
        }

        const matchedRes = matchedKey ? resourceMap[matchedKey] : null;
        const hasCounter = !!matchedRes && matchedRes.max > 0;

        abilityCards.push({
            id: `ab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: tName,
            desc: trait.description || '',
            description: trait.description || '',
            source: [trait.source, trait.source_type].filter(Boolean).join(' - ') || 'Feature',
            hasCounter: hasCounter,
            usesCurrent: hasCounter ? matchedRes.current : 0,
            usesMax: hasCounter ? matchedRes.max : 0,
            resetType: hasCounter ? matchedRes.reset : 'none'
        });

        if (matchedKey) delete resourceMap[matchedKey];
    });

    // Any leftover resources without a matching trait card get dedicated counter cards
    Object.entries(resourceMap).forEach(([name, res]) => {
        if (res.max > 0) {
            abilityCards.push({
                id: `ab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name: res.displayName,
                desc: `Resource tracker: ${res.displayName}`,
                description: `Resource tracker: ${res.displayName}`,
                source: 'Resource',
                hasCounter: true,
                usesCurrent: res.current,
                usesMax: res.max,
                resetType: res.reset
            });
        }
    });

    // 13. Global Modifiers & Sheet Toggles
    const saveToggles = [];
    Object.values(repeating.savemod).forEach((mod) => {
        if (mod.global_save_roll || mod.global_save_name) {
            saveToggles.push({
                name: mod.global_save_name || 'Save Bonus',
                formula: mod.global_save_roll || '0',
                target: 'all',
                enabled: String(mod.global_save_active_flag) === '1'
            });
        }
    });

    const skillToggles = [];
    Object.values(repeating.skillmod).forEach((mod) => {
        if (mod.global_skill_roll || mod.global_skill_name) {
            skillToggles.push({
                name: mod.global_skill_name || 'Skill Bonus',
                formula: mod.global_skill_roll || '0',
                target: 'all',
                enabled: String(mod.global_skill_active_flag) === '1'
            });
        }
    });

    const acToggles = [];
    Object.values(repeating.acmod).forEach((mod) => {
        if (mod.global_ac_val || mod.global_ac_name) {
            acToggles.push({
                name: mod.global_ac_name || 'AC Bonus',
                formula: String(mod.global_ac_val || '0'),
                enabled: String(mod.global_ac_active_flag) === '1'
            });
        }
    });

    const attackToggles = [];
    Object.values(repeating.tohitmod).forEach((mod) => {
        if (mod.global_attack_roll || mod.global_attack_name) {
            attackToggles.push({
                name: mod.global_attack_name || 'Attack Bonus',
                formula: mod.global_attack_roll || '0',
                target: 'atk',
                enabled: String(mod.global_attack_active_flag) === '1'
            });
        }
    });
    Object.values(repeating.damagemod).forEach((mod) => {
        if (mod.global_damage_damage || mod.global_damage_name) {
            attackToggles.push({
                name: mod.global_damage_name || 'Damage Bonus',
                formula: mod.global_damage_damage || '0',
                target: 'dmg',
                enabled: String(mod.global_damage_active_flag) === '1'
            });
        }
    });

    // 14. Categorized Inventory Containers
    const containers = [
        {
            id: 'cnt_weapons',
            name: 'Weapons & Ammunition',
            icon: 'fa-sword',
            weightRule: 'standard',
            baseWeight: 0,
            capacity: null,
            collapsed: false
        },
        {
            id: 'cnt_armor',
            name: 'Armor & Shields',
            icon: 'fa-shield-halved',
            weightRule: 'standard',
            baseWeight: 0,
            capacity: null,
            collapsed: false
        },
        {
            id: 'cnt_consumables',
            name: 'Potions & Consumables',
            icon: 'fa-flask',
            weightRule: 'standard',
            baseWeight: 0,
            capacity: null,
            collapsed: false
        },
        {
            id: 'cnt_backpack',
            name: 'Backpack & Gear',
            icon: 'fa-box-archive',
            weightRule: 'standard',
            baseWeight: 0,
            capacity: null,
            collapsed: false
        }
    ];

    const equipment = [];
    for (const item of Object.values(repeating.inventory)) {
        const iName = (item.itemname || 'Item').trim();
        const mods = (item.itemmodifiers || '').toLowerCase();
        const props = (item.itemproperties || '').toLowerCase();
        const nLow = iName.toLowerCase();
        let targetCnt = 'cnt_backpack';

        if (
            mods.includes('potion') ||
            mods.includes('scroll') ||
            mods.includes('ammunition') ||
            nLow.includes('potion') ||
            nLow.includes('scroll') ||
            nLow.includes('elixir') ||
            nLow.includes('bolt') ||
            nLow.includes('arrow')
        ) {
            targetCnt = 'cnt_consumables';
        } else if (
            mods.includes('armor') ||
            mods.includes('shield') ||
            nLow.includes('armor') ||
            nLow.includes('shield') ||
            nLow.includes('plate') ||
            nLow.includes('mail') ||
            nLow.includes('leather')
        ) {
            targetCnt = 'cnt_armor';
        } else if (
            mods.includes('weapon') ||
            props.includes('finesse') ||
            props.includes('versatile') ||
            item.hasattack === 1 ||
            item.hasattack === '1' ||
            nLow.includes('sword') ||
            nLow.includes('blade') ||
            nLow.includes('dagger') ||
            nLow.includes('bow') ||
            nLow.includes('axe') ||
            nLow.includes('glaive') ||
            nLow.includes('staff') ||
            nLow.includes('spear')
        ) {
            targetCnt = 'cnt_weapons';
        }

        let desc = (item.itemcontent || '').trim();
        let weight = parseFloat(item.itemweight) || 0;

        // If description is empty on Roll20, enrich from items catalog
        if (!desc) {
            const match = findCatalogItem(iName);
            if (match) {
                desc = match.descriptionMarkdown || match.descriptionHtml || '';
                if (weight === 0 && match.weight) {
                    weight = parseFloat(match.weight) || 0;
                }
            }
        }

        equipment.push({
            id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: iName,
            qty: parseInt(item.itemcount) || 1,
            weight: weight,
            containerId: targetCnt,
            description: desc
        });
    }

    // 15. Spells & Spell Slots
    const spells = {
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

    Object.entries(repeating.spells).forEach(([lvlKey, group]) => {
        const targetKey = lvlKey === 'cantrip' ? 'cantrip' : `level${lvlKey}`;
        if (!spells[targetKey]) return;

        Object.values(group).forEach((sp) => {
            const spName = (sp.spellname || 'Spell').trim();
            const desc = sp.spelldescription || '';
            const school = sp.spellschool || '';
            const time = sp.spellcastingtime || '1 action';
            const range = sp.spellrange || '';
            const duration = sp.spellduration || '';

            const isPrepared = lvlKey === 'cantrip' || (sp.spellprepared !== '0' && sp.spellprepared !== 0);

            // Direct 1:1 Spell Combat Mechanics
            const attackTypeRaw = (sp.spellattack || '').trim();
            const isAttack = Boolean(
                attackTypeRaw === 'Melee' ||
                attackTypeRaw === 'Ranged' ||
                (attackTypeRaw !== '' && !['none', 'none ', '0'].includes(attackTypeRaw.toLowerCase()))
            );

            let saveAbility = '';
            if (sp.spellsave && typeof sp.spellsave === 'string' && sp.spellsave.trim()) {
                saveAbility = sp.spellsave.trim().substring(0, 3).toUpperCase();
            }

            const damageList = [];
            const addSpellMod =
                String(sp.spelldmgmod || '')
                    .trim()
                    .toLowerCase() === 'yes';

            const dmg1 = (sp.spelldamage || '').trim();
            const type1 = (sp.spelldamagetype || '').trim();
            if (dmg1) {
                const entry = { formula: dmg1, type: type1 };
                if (addSpellMod) entry.stat = 'spell';
                damageList.push(entry);
            }
            const dmg2 = (sp.spelldamage2 || '').trim();
            const type2 = (sp.spelldamagetype2 || '').trim();
            if (dmg2) {
                damageList.push({ formula: dmg2, type: type2 });
            }

            // Direct 1:1 Healing Formula
            const healDmg = (sp.spellhealing || '').trim();
            if (healDmg) {
                const entry = { formula: healDmg, type: 'Healing' };
                if (addSpellMod) entry.stat = 'spell';
                damageList.push(entry);
            }

            let upcastBonus = '';
            if (sp.spellhldie) {
                const upDie = sp.spellhldietype
                    ? sp.spellhldietype.startsWith('d')
                        ? sp.spellhldietype
                        : `d${parseInt(sp.spellhldietype) || 6}`
                    : 'd6';
                upcastBonus = `${sp.spellhldie}${upDie}`;
            }

            spells[targetKey].push({
                id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name: spName,
                level: lvlKey === 'cantrip' ? 0 : parseInt(lvlKey) || 1,
                school: school,
                castingTime: time,
                range: range,
                target: (sp.spelltarget || '').trim(),
                prepared: isPrepared,
                isAttack: isAttack,
                attackStat: isAttack ? 'spell' : 'none',
                attackProf: isAttack,
                saveAbility: saveAbility,
                saveDcStat: saveAbility ? 'spell' : 'none',
                damage: dmg1,
                damageType: type1,
                damageList: damageList,
                cantripScale: lvlKey === 'cantrip' && damageList.length > 0,
                upcastBonus: upcastBonus,
                components: [sp.spellcomp_v ? 'V' : '', sp.spellcomp_s ? 'S' : '', sp.spellcomp_m ? 'M' : '']
                    .filter(Boolean)
                    .join(', '),
                materials: sp.spellcomp_materials || '',
                duration: duration,
                concentration: !!sp.spellconcentration,
                ritual: !!sp.spellritual,
                description: desc,
                higherLevels: sp.spellathigherlevels || ''
            });
        });
    });

    const spellSlots = {
        level1: { current: 0, max: 0 },
        level2: { current: 0, max: 0 },
        level3: { current: 0, max: 0 },
        level4: { current: 0, max: 0 },
        level5: { current: 0, max: 0 },
        level6: { current: 0, max: 0 },
        level7: { current: 0, max: 0 },
        level8: { current: 0, max: 0 },
        level9: { current: 0, max: 0 }
    };

    for (let i = 1; i <= 9; i++) {
        const total = parseInt(attrMap[`lvl${i}_slots_total`]) || 0;
        const expended = parseInt(attrMap[`lvl${i}_slots_expended`]) || 0;
        spellSlots[`level${i}`] = {
            max: total,
            current: Math.max(0, total - expended)
        };
    }

    // Warlock Pact Magic slots
    const pactTotal = parseInt(attrMap['pact_magic_slots_total'] || attrMap['warlock_spell_slots']) || 0;
    const pactExpended = parseInt(attrMap['pact_magic_slots_expended']) || 0;
    if (pactTotal > 0) {
        const warlock = classes.find((c) => (c.name || '').toLowerCase() === 'warlock');
        const wLvl = warlock ? warlock.level : 1;
        const pactSlotLvl = Math.min(5, Math.ceil(wLvl / 2));
        const key = `level${pactSlotLvl}`;
        spellSlots[key].max = Math.max(spellSlots[key].max, pactTotal);
        spellSlots[key].current = Math.max(spellSlots[key].current, pactTotal - pactExpended);
    }

    // Hit Dice Spent (multiclass repeating_hd support + single class fallback)
    const hitDiceSpent = { d6: 0, d8: 0, d10: 0, d12: 0 };
    const hdEntries = Object.values(repeating.hd);

    if (hdEntries.length > 0) {
        for (const hd of hdEntries) {
            const dieType = hd.type ? `d${parseInt(hd.type)}` : null;
            if (dieType && hitDiceSpent[dieType] !== undefined) {
                const size = parseInt(hd.size) || 0;
                const available = hd.available !== undefined && hd.available !== '' ? parseInt(hd.available) : size;
                const consumed =
                    parseInt(hd.consumed) !== undefined && !isNaN(parseInt(hd.consumed))
                        ? parseInt(hd.consumed)
                        : Math.max(0, size - available);
                hitDiceSpent[dieType] = Math.max(0, consumed);
            }
        }
    } else if (attrMap['hit_dice']) {
        const remainingHd = parseInt(attrMap['hit_dice']);
        if (!isNaN(remainingHd) && remainingHd < totalLevel) {
            const pClass = (classes[0]?.name || '').toLowerCase();
            let dieKey = 'd8';
            if (pClass.includes('barbarian')) dieKey = 'd12';
            else if (pClass.includes('fighter') || pClass.includes('paladin') || pClass.includes('ranger'))
                dieKey = 'd10';
            else if (pClass.includes('sorcerer') || pClass.includes('wizard')) dieKey = 'd6';
            hitDiceSpent[dieKey] = Math.max(0, totalLevel - remainingHd);
        }
    }

    // 16. Token Dimensions, Sight, & Assets
    let tokenSize = 1;
    let tokenSight = 60;
    let defaultToken = null;
    if (charRoot.blobDefaultToken) {
        try {
            defaultToken =
                typeof charRoot.blobDefaultToken === 'string'
                    ? JSON.parse(charRoot.blobDefaultToken)
                    : charRoot.blobDefaultToken;
            if (defaultToken && defaultToken.width) {
                tokenSize = Math.max(1, Math.round(defaultToken.width / 70));
            }
        } catch {}
    }

    // Darkvision parsing
    const allTraitsText = Object.values(repeating.traits)
        .map((t) => `${t.name} ${t.description}`)
        .join(' ')
        .toLowerCase();
    const dvMatch =
        allTraitsText.match(/darkvision\s*(?:of\s*)?(\d+)/i) || allTraitsText.match(/(\d+)\s*ft\.?\s*darkvision/i);
    if (dvMatch) {
        tokenSight = parseInt(dvMatch[1]) || 60;
    }

    // Asset image caching (strictly local - no remote URL fallback)
    let localAvatar = null;
    const avatarUrl = rawAttrs.avatar || charRoot.avatar;
    if (uploadsDir && campaignId && avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) {
        localAvatar = await downloadAssetToLocal(avatarUrl, uploadsDir, campaignId);
    }

    const tokenImages = [];
    let activeSideIndex = 0;

    const rawSides = defaultToken?.sides;
    let sideUrls = [];
    if (typeof rawSides === 'string' && rawSides.trim()) {
        sideUrls = rawSides
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    if (defaultToken && defaultToken.currentSide !== undefined) {
        const parsedCurrentSide = parseInt(defaultToken.currentSide);
        if (!isNaN(parsedCurrentSide) && parsedCurrentSide >= 0) {
            activeSideIndex = parsedCurrentSide;
        }
    }

    if (sideUrls.length > 0) {
        if (activeSideIndex >= sideUrls.length) {
            activeSideIndex = 0;
        }
        for (let i = 0; i < sideUrls.length; i++) {
            const rawSideUrl = sideUrls[i];
            let localSidePath = null;
            if (uploadsDir && campaignId) {
                localSidePath = await downloadAssetToLocal(rawSideUrl, uploadsDir, campaignId);
            }
            if (localSidePath) {
                tokenImages.push({
                    url: localSidePath,
                    name: i === activeSideIndex ? 'Default Token' : `Side ${i + 1}`,
                    isDefault: i === activeSideIndex
                });
            }
        }
    } else if (defaultToken?.imgsrc) {
        let localTokenPath = null;
        if (uploadsDir && campaignId) {
            localTokenPath = await downloadAssetToLocal(defaultToken.imgsrc, uploadsDir, campaignId);
        }
        if (localTokenPath) {
            tokenImages.push({
                url: localTokenPath,
                name: 'Default Token',
                isDefault: true
            });
        }
    }

    let activeTokenImage = null;
    if (tokenImages.length > 0) {
        const defaultIdx = tokenImages.findIndex((t) => t.isDefault);
        if (defaultIdx !== -1) {
            activeSideIndex = defaultIdx;
        } else if (activeSideIndex >= tokenImages.length) {
            activeSideIndex = 0;
            if (tokenImages[0]) tokenImages[0].isDefault = true;
        }
        activeTokenImage = tokenImages[activeSideIndex]?.url || tokenImages[0]?.url || null;
    } else {
        activeSideIndex = 0;
    }

    // Generate fresh DnDForged character ID
    const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    return {
        id: charId,
        name: charName,
        avatar: localAvatar || null,
        tokenImage: activeTokenImage,
        class: classString,
        classes: classes,
        level: totalLevel,
        race: (attrMap['race'] || '').trim(),
        subrace: (attrMap['subrace'] || '').trim(),
        background: (attrMap['background'] || '').trim(),
        stats: stats,
        hpMax: hpMax,
        hpCurrent: hpCurrent,
        baseHpMax: hpMax,
        tempHp: tempHp,
        ac: ac,
        baseAc: ac,
        speed: speed,
        saves: saves,
        skills: skills,
        expertise: expertise,
        proficiencies: proficiencies,
        tools: tools,
        hitDiceSpent: hitDiceSpent,
        currency: currency,
        equipment: equipment,
        containers: containers,
        spells: spells,
        spellSlots: spellSlots,
        spellAbility: spellAbility,
        dcAbility: spellAbility,
        spellSettings: {
            ability: spellAbility,
            atkMod: parseInt(attrMap['spell_attack_mod']) || 0,
            dcMod: parseInt(attrMap['spell_dc_mod']) || 0,
            dmgMod: 0,
            critRange: 20,
            toggles: []
        },
        inspiration:
            attrMap['inspiration'] === 'on' || attrMap['inspiration'] === '1' || attrMap['inspiration'] === true,
        toHit: '',
        macros: macros,
        abilityCards: abilityCards,
        saveToggles: saveToggles,
        skillToggles: skillToggles,
        acToggles: acToggles,
        attackSettings: { atkMod: 0, critRange: 20, toggles: attackToggles },
        tokenImages: tokenImages,
        activeTokenIndex: activeSideIndex,
        tokenSize: tokenSize,
        tokenSight: tokenSight,
        deathSaves: {
            successes: parseInt(attrMap['deathsave_successes']) || 0,
            failures: parseInt(attrMap['deathsave_failures']) || 0
        },
        bio: bio
    };
}
