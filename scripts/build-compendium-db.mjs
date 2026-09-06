import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    if (lower.includes('as a bonus action') || lower.includes('bonus action:')) return 'bonus';
    if (lower.includes('as a reaction') || lower.includes('reaction:')) return 'reaction';
    if (lower.includes('as an action') || lower.includes('action:')) return 'action';
    return 'passive';
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
    if (featureName === 'Channel Divinity') {
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

// ─── 1. Races / Species ────────────────────────────────────────────────────────
function buildRaces() {
    console.log('📦 Normalizing Races & Species...');
    const racesFile = path.join(dataDir, 'races.json');
    if (!fs.existsSync(racesFile)) return;

    const data = JSON.parse(fs.readFileSync(racesFile, 'utf8'));
    const rawList = data.race || [];
    const allRaces = [];
    const seen = new Set();

    for (const r of rawList) {
        const name = (r.name || '').trim();
        const source = (r.source || 'PHB').trim();
        if (!name) continue;

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const size = Array.isArray(r.size) ? r.size.join('/') : (r.size || 'Medium');
        let speed = '30 ft';
        if (typeof r.speed === 'number') speed = `${r.speed} ft`;
        else if (typeof r.speed === 'object' && r.speed !== null) {
            speed = Object.entries(r.speed).map(([k, v]) => `${k !== 'walk' ? k + ' ' : ''}${v} ft`).join(', ');
        }

        const traits = renderEntriesToHtml(r.entries || []);

        allRaces.push({
            id: `race_${cleanId(name)}_${cleanId(source)}`,
            name,
            source,
            page: r.page || 0,
            size,
            speed,
            traitsHtml: traits
        });
    }

    allRaces.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog
    const catalog = allRaces.map(r => ({ id: r.id, name: r.name, source: r.source, page: r.page, size: r.size, speed: r.speed }));
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
    console.log(`✅ Races catalog: ${catalog.length} entries across ${grouped.size} partitions.`);
}

// ─── 2. Feats ─────────────────────────────────────────────────────────────────
function buildFeats() {
    console.log('📦 Normalizing Feats...');
    const featsFile = path.join(dataDir, 'feats.json');
    if (!fs.existsSync(featsFile)) return;

    const data = JSON.parse(fs.readFileSync(featsFile, 'utf8'));
    const rawList = data.feat || [];
    const allFeats = [];
    const seen = new Set();

    for (const f of rawList) {
        const name = (f.name || '').trim();
        const source = (f.source || 'PHB').trim();
        if (!name) continue;

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
            entriesHtml
        });
    }

    allFeats.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog
    const catalog = allFeats.map(f => ({ id: f.id, name: f.name, source: f.source, page: f.page, prerequisite: f.prerequisite }));
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
function buildBackgrounds() {
    console.log('📦 Normalizing Backgrounds...');
    const bgFile = path.join(dataDir, 'backgrounds.json');
    if (!fs.existsSync(bgFile)) return;

    const data = JSON.parse(fs.readFileSync(bgFile, 'utf8'));
    const rawList = data.background || [];
    const allBg = [];
    const seen = new Set();

    for (const b of rawList) {
        const name = (b.name || '').trim();
        const source = (b.source || 'PHB').trim();
        if (!name) continue;

        const key = `${name.toLowerCase()}|${source.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let skills = 'None';
        if (Array.isArray(b.skillProficiencies)) {
            skills = b.skillProficiencies.map(sp => {
                if (typeof sp === 'string') return sp;
                const keys = Object.keys(sp).filter(k => sp[k] === true);
                if (keys.length) return keys.join(', ');
                if (sp.choose) return `Choose ${sp.choose.count || 1} from ${sp.choose.from.join(', ')}`;
                return '';
            }).filter(Boolean).join(', ') || 'None';
        }

        const entriesHtml = renderEntriesToHtml(b.entries || []);

        allBg.push({
            id: `bg_${cleanId(name)}_${cleanId(source)}`,
            name,
            source,
            page: b.page || 0,
            skills,
            entriesHtml
        });
    }

    allBg.sort((a, b) => a.name.localeCompare(b.name));

    // Catalog
    const catalog = allBg.map(b => ({ id: b.id, name: b.name, source: b.source, page: b.page, skills: b.skills }));
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
    console.log(`✅ Backgrounds catalog: ${catalog.length} entries across ${grouped.size} partitions.`);
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
            if (data.class) rawClasses.push(...data.class);
            if (data.subclass) rawSubclasses.push(...data.subclass);
            if (data.classFeature) rawClassFeatures.push(...data.classFeature);
            if (data.subclassFeature) rawSubclassFeatures.push(...data.subclassFeature);
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }

    console.log(`Loaded ${rawClasses.length} classes, ${rawSubclasses.length} subclasses, ${rawClassFeatures.length} class features, ${rawSubclassFeatures.length} subclass features.`);

    // 1. Process Class Features
    const processedClassFeatures = rawClassFeatures.map(cf => {
        const plainText = extractPlainText(cf.entries);
        const actionType = detectActionType(plainText, cf.name);
        const cnt = detectCounter(plainText, cf.name, cf.level || 1);
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
            entriesHtml: renderEntriesToHtml(cf.entries || []),
            rawEntries: cf.entries || []
        };
    });

    // 2. Process Subclass Features
    const processedSubclassFeatures = rawSubclassFeatures.map(sf => {
        const plainText = extractPlainText(sf.entries);
        const actionType = detectActionType(plainText, sf.name);
        const cnt = detectCounter(plainText, sf.name, sf.level || 1);
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
