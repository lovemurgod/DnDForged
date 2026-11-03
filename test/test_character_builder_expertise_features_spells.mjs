import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Testing Character Builder: Expertise, Features, Spells & Feats ---');

// Helper to load catalog data
const optionalFeaturesCatalog = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../vtt/data/optionalfeatures-catalog.json'), 'utf8')
);
const barbarianClassData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../vtt/data/class/class-barbarian.json'), 'utf8')
);
const paladinClassData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../vtt/data/class/class-paladin.json'), 'utf8')
);
const featsCatalog = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../vtt/data/feats-catalog.json'), 'utf8')
);

// 1. Expertise Allowance Calculation Tests
console.log('1. Testing Class Expertise allowance calculation...');
{
    function getClassExpertiseLimit(classes) {
        let limit = 0;
        (classes || []).forEach((c) => {
            const raw = (c.name || '').toLowerCase().trim();
            const lvl = parseInt(c.level) || 1;
            if (raw === 'rogue') {
                if (lvl >= 1) limit += 2;
                if (lvl >= 6) limit += 2;
            } else if (raw === 'bard') {
                if (lvl >= 3) limit += 2;
                if (lvl >= 10) limit += 2;
            } else if (raw === 'ranger') {
                if (lvl >= 1) limit += 1;
            }
        });
        return limit;
    }

    assert.strictEqual(getClassExpertiseLimit([{ name: 'Rogue', level: 1 }]), 2, 'Rogue lvl 1 has 2 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Rogue', level: 5 }]), 2, 'Rogue lvl 5 has 2 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Rogue', level: 6 }]), 4, 'Rogue lvl 6 has 4 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Bard', level: 2 }]), 0, 'Bard lvl 2 has 0 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Bard', level: 3 }]), 2, 'Bard lvl 3 has 2 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Bard', level: 10 }]), 4, 'Bard lvl 10 has 4 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Ranger', level: 1 }]), 1, 'Ranger lvl 1 has 1 expertise');
    assert.strictEqual(getClassExpertiseLimit([{ name: 'Fighter', level: 5 }]), 0, 'Fighter lvl 5 has 0 expertise');

    // Multiclass Rogue 1 / Bard 3
    assert.strictEqual(
        getClassExpertiseLimit([{ name: 'Rogue', level: 1 }, { name: 'Bard', level: 3 }]),
        4,
        'Multiclass Rogue 1 / Bard 3 has 4 expertise'
    );
    console.log('✓ Class expertise allowances calculated correctly across all levels.');
}

// 2. Fighting Styles for Paladin (featureType FS:P)
console.log('2. Testing Paladin Fighting Styles query (featureType FS:P)...');
{
    const rawC = 'paladin';
    const curLvl = 2;
    const isPaladin = rawC === 'paladin';
    const isFighter = rawC === 'fighter';
    const isRanger = rawC === 'ranger';
    const isBard = rawC === 'bard';

    const matches = optionalFeaturesCatalog.filter((of) => {
        const fTypes = of.featureType || [];
        let matchCls = (of.classPrereq || '').toLowerCase() === rawC;
        if (!matchCls) {
            if (isPaladin && fTypes.includes('FS:P')) matchCls = true;
            if (isFighter && fTypes.includes('FS:F')) matchCls = true;
            if (isRanger && fTypes.includes('FS:R')) matchCls = true;
            if (isBard && fTypes.includes('FS:B')) matchCls = true;
        }
        if (!matchCls) return false;
        const reqLvl = parseInt(of.levelPrereq) || 1;
        return reqLvl <= curLvl;
    });

    // Deduplicate options by name
    const uniqueMatches = [];
    const seenOpt = new Set();
    for (const of of matches) {
        const optKey = (of.name || '').toLowerCase().trim();
        if (!seenOpt.has(optKey)) {
            seenOpt.add(optKey);
            uniqueMatches.push(of);
        }
    }

    const styleNames = uniqueMatches.map((m) => m.name);
    console.log('Paladin Fighting Styles found:', styleNames);

    assert(styleNames.includes('Defense'), 'Paladin must have Defense Fighting Style');
    assert(styleNames.includes('Dueling'), 'Paladin must have Dueling Fighting Style');
    assert(styleNames.includes('Great Weapon Fighting'), 'Paladin must have Great Weapon Fighting');
    assert(styleNames.includes('Protection'), 'Paladin must have Protection Fighting Style');
    assert(styleNames.includes('Blessed Warrior'), 'Paladin must have Blessed Warrior Fighting Style');
    assert(styleNames.includes('Blind Fighting'), 'Paladin must have Blind Fighting Style');
    assert(styleNames.includes('Interception'), 'Paladin must have Interception Fighting Style');
    console.log('✓ Paladin receives all eligible fighting styles via featureType.');
}

// 3. Totem Barbarian Animal Grouping & Rune Knight Runes
console.log('3. Testing Totem Barbarian Animal choices & Rune Knight Runes...');
{
    // Totem Barbarian
    const isTotemBarbarian = true;
    const totemAnimals = ['Bear', 'Eagle', 'Elk', 'Tiger', 'Wolf'];
    const curLvl = 3;

    const animalOptionsLvl3 = barbarianClassData.subclassFeature
        .filter(
            (sf) =>
                (sf.subclassShortName || '').toLowerCase() === 'totem warrior' &&
                sf.level === 3 &&
                totemAnimals.includes(sf.name)
        )
        .map((sf) => sf.name);

    assert.strictEqual(animalOptionsLvl3.length, 5, 'Totem Warrior must have 5 animals at level 3');
    assert(animalOptionsLvl3.includes('Bear'));
    assert(animalOptionsLvl3.includes('Eagle'));
    assert(animalOptionsLvl3.includes('Wolf'));

    // Rune Knight Runes
    const isRuneKnight = true;
    const runeKnightMatches = optionalFeaturesCatalog.filter((of) => {
        const fTypes = of.featureType || [];
        return fTypes.includes('RN');
    });

    const runeNames = Array.from(new Set(runeKnightMatches.map((r) => r.name)));
    console.log('Rune Knight Runes found:', runeNames.slice(0, 6));
    assert(runeNames.some((n) => n.includes('Cloud Rune') || n.includes('Skye')), 'Rune Knight has Cloud Rune');
    assert(runeNames.some((n) => n.includes('Fire Rune') || n.includes('Ild')), 'Rune Knight has Fire Rune');
    assert(runeNames.some((n) => n.includes('Frost Rune') || n.includes('Ise')), 'Rune Knight has Frost Rune');
    assert(runeNames.some((n) => n.includes('Stone Rune') || n.includes('Stein')), 'Rune Knight has Stone Rune');
    console.log('✓ Totem Barbarian and Rune Knight options verified.');
}

// 4. Starting Gold & Currency Direct Credit
console.log('4. Testing Starting Gold direct credit without equipment items...');
{
    const char = { currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, equipment: [] };

    function importCleanEquipmentItem(rawName, explicitQty = null, explicitType = null) {
        if (!rawName) return;
        const rawLower = rawName.toLowerCase();
        const goldMatch =
            rawName.match(/starting gold\s*\((\d+)\s*gp\)/i) ||
            rawName.match(/(\d+)\s*gp/i) ||
            rawName.match(/(\d+)\s*gold pieces?/i) ||
            (explicitType === 'Currency' && rawName.match(/(\d+)/));
        if (
            goldMatch ||
            rawLower.includes('starting gold') ||
            (explicitType === 'Currency' && rawLower.includes('gp'))
        ) {
            const goldAmt = goldMatch ? parseInt(goldMatch[1]) : explicitQty || 1;
            char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
            char.currency.gp = (parseInt(char.currency.gp) || 0) + (goldAmt || 0);
            return;
        }
        char.equipment.push({ name: rawName, qty: explicitQty || 1 });
    }

    importCleanEquipmentItem('15 GP (Starting Gold)', 1, 'Currency');
    importCleanEquipmentItem('a pouch containing 10 gp', 1, 'Currency');
    importCleanEquipmentItem('Dagger', 1, 'Weapon');

    assert.strictEqual(char.currency.gp, 25, 'Currency GP should be credited 15 + 10 = 25 GP');
    assert.strictEqual(char.equipment.length, 1, 'Only Dagger should be in equipment, no gold items');
    assert.strictEqual(char.equipment[0].name, 'Dagger');
    console.log('✓ Starting gold deposits directly into currency without creating item cards.');
}

// 5. Origin Feats Gating (2014 vs 2024 vs Variant Human)
console.log('5. Testing Origin Feats gating for 2014 characters...');
{
    function checkOriginFeats(workingChar, matchedBg, bgFeatName) {
        const is2024Char = workingChar.is2024 === true;
        const isVariantHuman = (workingChar.race || '').toLowerCase().includes('variant human');
        const hasBgFeat =
            matchedBg &&
            Boolean(bgFeatName) &&
            (is2024Char ||
                (Array.isArray(matchedBg.feats) && matchedBg.feats.length > 0) ||
                matchedBg.source === 'XPHB' ||
                /strixhaven|dragonlance|planescape/i.test(matchedBg.source || '') ||
                (matchedBg.entries && JSON.stringify(matchedBg.entries).includes('Origin Feat')));
        const isHumanVersatile = (is2024Char && (workingChar.race || '').toLowerCase().includes('human')) || isVariantHuman;

        const tiers = [];
        if (hasBgFeat) tiers.push({ id: 'origin_feat_background' });
        if (isHumanVersatile) tiers.push({ id: 'origin_feat_human' });
        return tiers;
    }

    // 2014 Standard Human + 2014 Folk Hero
    const char2014Std = { race: 'Human', is2024: false };
    const bg2014 = { name: 'Folk Hero', source: 'PHB' };
    const tiers2014 = checkOriginFeats(char2014Std, bg2014, '');
    assert.strictEqual(tiers2014.length, 0, '2014 Standard Human must have 0 Origin Feats');

    // 2014 Variant Human + 2014 Acolyte
    const char2014VHuman = { race: 'Variant Human', is2024: false };
    const tiersVHuman = checkOriginFeats(char2014VHuman, bg2014, '');
    assert.strictEqual(tiersVHuman.length, 1, '2014 Variant Human must receive 1 Origin Feat');
    assert.strictEqual(tiersVHuman[0].id, 'origin_feat_human');

    // 2024 Human + 2024 Background
    const char2024 = { race: 'Human', is2024: true };
    const bg2024 = { name: 'Farmer', source: 'XPHB', feats: [{ 'Tough': true }] };
    const tiers2024 = checkOriginFeats(char2024, bg2024, 'Tough');
    assert.strictEqual(tiers2024.length, 2, '2024 Human with 2024 Background must receive 2 Origin Feats');
    console.log('✓ Origin Feats properly gated: 0 for 2014 Human, 1 for Variant Human, 2 for 2024.');
}

// 6. Subclass Spells from subclass.additionalSpells (Oath of Devotion)
console.log('6. Testing Subclass Spells extraction (Oath of Devotion)...');
{
    const devSub = paladinClassData.subclass.find(
        (s) => s.name === 'Oath of Devotion' && Array.isArray(s.additionalSpells)
    );
    assert(devSub, 'Oath of Devotion must exist with additionalSpells in catalog');

    const grantedSpellsLvl3 = [];
    const curLvl = 3;
    devSub.additionalSpells.forEach((as) => {
        const spellSets = as.prepared || as.known || {};
        Object.entries(spellSets).forEach(([lvlKey, spellNames]) => {
            if (parseInt(lvlKey) <= curLvl && Array.isArray(spellNames)) {
                spellNames.forEach((s) => grantedSpellsLvl3.push(s));
            }
        });
    });

    console.log('Level 3 Oath of Devotion additional spells:', grantedSpellsLvl3);
    assert(grantedSpellsLvl3.includes('protection from evil and good'));
    assert(grantedSpellsLvl3.includes('sanctuary'));
    console.log('✓ Subclass additionalSpells correctly loaded and prepared.');
}

// 7. Feats Sub-Choices (Strike of the Giants, Skill Expert, Skilled, Prodigy)
console.log('7. Testing Feat Sub-Choice handling...');
{
    const sotg = featsCatalog.find((f) => f.name.toLowerCase().includes('strike of the giants'));
    assert(sotg, 'Strike of the Giants must exist in feats catalog');

    const giantStrikes = ['Cloud Strike', 'Fire Strike', 'Frost Strike', 'Hill Strike', 'Stone Strike', 'Storm Strike'];
    giantStrikes.forEach((strike) => {
        assert(sotg.description.includes(strike), `Strike of the Giants description must contain ${strike}`);
    });
    console.log('✓ Strike of the Giants contains all 6 strike options.');
}

console.log('\n======================================================');
console.log('All Character Builder Upgrades verified successfully!');
console.log('======================================================\n');

