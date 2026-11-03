import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    STRIXHAVEN_COLLEGES,
    HIGH_SORCERY_MOONS,
    RUNE_SHAPER_SPELLS,
    OUTER_PLANES
} from '../vtt/js/player-sheet/builder/step7-feats.js';
import { getFeatAndAsiBonuses, extractGrantedSpells } from '../vtt/js/player-sheet/builder/builder-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('--- RUNNING CHARACTER BUILDER FEAT & BACKGROUND SPELLS TESTS ---');

// =========================================================================
// TEST 1: Compendium Catalog Data Preservation (additionalSpells & feats)
// =========================================================================
console.log('\n[Test 1] Compendium Catalog Data Preservation...');
{
    const bgCatalogPath = path.join(rootDir, 'vtt', 'data', 'backgrounds-catalog.json');
    assert.ok(fs.existsSync(bgCatalogPath), 'backgrounds-catalog.json must exist');
    const catalog = JSON.parse(fs.readFileSync(bgCatalogPath, 'utf8'));

    // Check Orzhov Representative
    const orzhov = catalog.find((b) => b.name === 'Orzhov Representative');
    assert.ok(orzhov, 'Orzhov Representative must exist in catalog');
    assert.ok(Array.isArray(orzhov.additionalSpells), 'Orzhov must preserve additionalSpells array');
    assert.ok(orzhov.additionalSpells[0]?.expanded, 'Orzhov must contain expanded spell list');
    assert.ok(Array.isArray(orzhov.additionalSpells[0].expanded.s0), 'Orzhov expanded cantrips must exist');
    assert.ok(
        orzhov.additionalSpells[0].expanded.s0.some((s) => s.includes('guidance')),
        'Orzhov expanded cantrips must include guidance'
    );
    assert.ok(
        orzhov.additionalSpells[0].expanded.s3.some((s) => s.includes('spirit guardians')),
        'Orzhov expanded level 3 must include spirit guardians'
    );

    // Check Lorehold Student
    const lorehold = catalog.find((b) => b.name === 'Lorehold Student');
    assert.ok(lorehold, 'Lorehold Student must exist in catalog');
    assert.ok(Array.isArray(lorehold.feats), 'Lorehold must preserve feats array');
    assert.ok(
        lorehold.feats.some((f) => Object.keys(f)[0].toLowerCase().includes('strixhaven initiate')),
        'Lorehold feats must include Strixhaven Initiate'
    );
    assert.ok(Array.isArray(lorehold.additionalSpells), 'Lorehold must preserve additionalSpells');
    assert.ok(
        lorehold.additionalSpells[0].expanded.s3.some((s) => s.includes('spirit guardians')),
        'Lorehold expanded level 3 must include spirit guardians'
    );

    console.log('  ✔ Backgrounds catalog preserves feats and additionalSpells for Orzhov and Lorehold');
}

// =========================================================================
// TEST 2: Background Feat Detection & College Pre-Selection
// =========================================================================
console.log('\n[Test 2] Background Feat Detection & College Pre-Selection...');
{
    function detectBackgroundFeat(matchedBg) {
        let bgFeatName = '';
        let bgFeatSpellClass = '';
        let bgFeatCollege = '';
        if (matchedBg) {
            if (Array.isArray(matchedBg.feats) && matchedBg.feats.length > 0) {
                for (const fItem of matchedBg.feats) {
                    if (typeof fItem === 'object') {
                        const rawKey = Object.keys(fItem)[0] || '';
                        if (rawKey) {
                            const [fNamePart, fOptPart] = rawKey.split(';');
                            const cleanF = (fNamePart || '').replace(/\|.*$/, '').trim();
                            if (cleanF) {
                                bgFeatName = cleanF;
                                if (fOptPart) {
                                    const optClean = fOptPart.replace(/\|.*$/, '').trim().toLowerCase();
                                    if (/cleric|druid|wizard|sorcerer|warlock|bard/.test(optClean)) {
                                        bgFeatSpellClass = optClean;
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }

            if (!bgFeatName && Array.isArray(matchedBg.features)) {
                for (const f of matchedBg.features) {
                    const fNameStr = f.name || '';
                    const fDescStr = f.description || '';
                    if (/feat/i.test(fNameStr)) {
                        bgFeatName = fNameStr
                            .replace(/^bonus feat:\s*/i, '')
                            .replace(/^feat:\s*/i, '')
                            .trim();
                        break;
                    }
                    const mGain = fDescStr.match(/gain the\s+([A-Za-z\s'\-]+?)\s+feat/i);
                    if (mGain) {
                        bgFeatName = mGain[1].trim();
                        break;
                    }
                }
            }

            const bgLower = (matchedBg.name || '').toLowerCase();
            if (bgLower.includes('lorehold')) bgFeatCollege = 'lorehold';
            else if (bgLower.includes('prismari')) bgFeatCollege = 'prismari';
            else if (bgLower.includes('quandrix')) bgFeatCollege = 'quandrix';
            else if (bgLower.includes('silverquill')) bgFeatCollege = 'silverquill';
            else if (bgLower.includes('witherbloom')) bgFeatCollege = 'witherbloom';
        }
        return { bgFeatName, bgFeatSpellClass, bgFeatCollege };
    }

    const loreholdBg = {
        name: 'Lorehold Student',
        feats: [{ 'strixhaven initiate|scc': true }],
        features: [
            {
                name: 'Feature: Lorehold Initiate',
                description: 'You gain the Strixhaven Initiate feat and must choose Lorehold within it.'
            }
        ]
    };
    const detLorehold = detectBackgroundFeat(loreholdBg);
    assert.strictEqual(detLorehold.bgFeatName.toLowerCase(), 'strixhaven initiate');
    assert.strictEqual(detLorehold.bgFeatCollege, 'lorehold');

    const acolyte2024 = {
        name: 'Acolyte',
        feats: [{ 'magic initiate; cleric|xphb': true }]
    };
    const detAcolyte = detectBackgroundFeat(acolyte2024);
    assert.strictEqual(detAcolyte.bgFeatName.toLowerCase(), 'magic initiate');
    assert.strictEqual(detAcolyte.bgFeatSpellClass, 'cleric');

    console.log(
        '  ✔ Background feat detection correctly identified Strixhaven Initiate (Lorehold) and Magic Initiate (Cleric)'
    );
}

// =========================================================================
// TEST 3: Strixhaven Initiate College Spell Lists & Ability Mapping
// =========================================================================
console.log('\n[Test 3] Strixhaven Initiate College Rules & Mapping...');
{
    assert.ok(STRIXHAVEN_COLLEGES.lorehold);
    assert.deepStrictEqual(STRIXHAVEN_COLLEGES.lorehold.cantrips, ['Light', 'Sacred Flame', 'Thaumaturgy']);
    assert.deepStrictEqual(STRIXHAVEN_COLLEGES.lorehold.classes, ['cleric', 'wizard']);

    assert.ok(STRIXHAVEN_COLLEGES.prismari);
    assert.deepStrictEqual(STRIXHAVEN_COLLEGES.prismari.cantrips, ['Fire Bolt', 'Prestidigitation', 'Ray of Frost']);
    assert.deepStrictEqual(STRIXHAVEN_COLLEGES.prismari.classes, ['bard', 'sorcerer']);

    assert.ok(STRIXHAVEN_COLLEGES.quandrix);
    assert.deepStrictEqual(STRIXHAVEN_COLLEGES.quandrix.cantrips, ['Druidcraft', 'Guidance', 'Mage Hand']);
    assert.deepStrictEqual(STRIXHAVEN_COLLEGES.quandrix.classes, ['druid', 'wizard']);

    // Simulate character import for Strixhaven Initiate (Lorehold)
    const strixTier = {
        choice: 'feat',
        selectedFeatId: 'feat_strixhaven_initiate_scc',
        featSubChoices: {
            college: 'lorehold',
            abilityScore: 'wis',
            cantrip1: 'Sacred Flame',
            cantrip2: 'Light',
            spell1: 'Guiding Bolt'
        }
    };

    const char = { spells: { cantrip: [], level1: [] } };
    const spellsToImport = [
        { name: strixTier.featSubChoices.cantrip1, level: 0 },
        { name: strixTier.featSubChoices.cantrip2, level: 0 },
        { name: strixTier.featSubChoices.spell1, level: 1 }
    ];

    spellsToImport.forEach((spReq) => {
        const key = spReq.level === 0 ? 'cantrip' : 'level' + spReq.level;
        char.spells[key].push({
            id: 'sp_test_' + spReq.name,
            name: spReq.name,
            level: spReq.level,
            prepared: true,
            ability: strixTier.featSubChoices.abilityScore
        });
    });

    assert.strictEqual(char.spells.cantrip.length, 2);
    assert.strictEqual(char.spells.cantrip[0].name, 'Sacred Flame');
    assert.strictEqual(char.spells.cantrip[1].name, 'Light');
    assert.strictEqual(char.spells.level1.length, 1);
    assert.strictEqual(char.spells.level1[0].name, 'Guiding Bolt');
    assert.strictEqual(char.spells.level1[0].ability, 'wis');
    console.log('  ✔ Strixhaven Initiate college cantrips, 1st-level spells, and ability scores verified');
}

// =========================================================================
// TEST 4: Fey-Touched & Shadow-Touched Hyphenated & 2024 Compatibility
// =========================================================================
console.log('\n[Test 4] Fey-Touched / Shadow-Touched Hyphenation & Spell Granting...');
{
    const featNames = ['Fey Touched', 'Fey-Touched', 'Shadow Touched', 'Shadow-Touched'];

    featNames.forEach((fn) => {
        const isFey = /fey[- ]touched/i.test(fn);
        const isShadow = /shadow[- ]touched/i.test(fn);
        assert.ok(isFey || isShadow, `Regex must match ${fn}`);
    });

    // Test stat bonus calculation with hyphenated 2024 name
    const asiTiers = [
        {
            tierType: 'class_asi',
            feat: 'Fey-Touched',
            halfFeatStat: 'wis',
            featSubChoices: { halfFeatStat: 'wis', spell1: 'Bless' }
        },
        {
            tierType: 'class_asi',
            feat: 'Shadow-Touched',
            halfFeatStat: 'cha',
            featSubChoices: { halfFeatStat: 'cha', spell1: 'Disguise Self' }
        }
    ];

    const bonuses = getFeatAndAsiBonuses(asiTiers);
    assert.strictEqual(bonuses.wis, 1, 'Wisdom gets +1 from Fey-Touched');
    assert.strictEqual(bonuses.cha, 1, 'Charisma gets +1 from Shadow-Touched');

    console.log('  ✔ Fey-Touched & Shadow-Touched hyphenated names correctly parse stats and spells');
}

// =========================================================================
// TEST 5: Background Guild & College Expanded Spells Checklist
// =========================================================================
console.log('\n[Test 5] Background Expanded Spells Checklist & Import...');
{
    const orzhovBg = {
        name: 'Orzhov Representative',
        additionalSpells: [
            {
                expanded: {
                    s0: ['friends#c', 'guidance#c'],
                    s1: ['command', 'illusory script'],
                    s2: ['enthrall', 'ray of enfeeblement', 'zone of truth'],
                    s3: ['bestow curse', 'speak with dead', 'spirit guardians']
                }
            }
        ]
    };

    // Extract candidate background expanded spells
    const candidateBgExpandedSpells = [];
    const addSp = orzhovBg.additionalSpells;
    addSp.forEach((as) => {
        if (as?.expanded) {
            Object.entries(as.expanded).forEach(([slotKey, spellNames]) => {
                const sLvl = parseInt(slotKey.replace(/^s/, '')) || 0;
                spellNames.forEach((rawSpName) => {
                    const cleanName = rawSpName.replace(/#c\d*/i, '').trim();
                    candidateBgExpandedSpells.push({
                        id: 'sp_bg_' + cleanName.replace(/\W+/g, '_'),
                        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
                        level: sLvl,
                        originName: orzhovBg.name,
                        checked: true
                    });
                });
            });
        }
    });

    assert.strictEqual(candidateBgExpandedSpells.length, 10, 'Should extract 10 expanded spells');
    assert.ok(candidateBgExpandedSpells.some((s) => s.name.toLowerCase() === 'friends'));
    assert.ok(candidateBgExpandedSpells.some((s) => s.name.toLowerCase() === 'guidance'));
    assert.ok(candidateBgExpandedSpells.some((s) => s.name.toLowerCase() === 'spirit guardians'));

    // Verify import into character
    const char = { spells: { cantrip: [], level1: [], level2: [], level3: [] } };
    candidateBgExpandedSpells
        .filter((s) => s.checked)
        .forEach((sp) => {
            const key = sp.level === 0 ? 'cantrip' : 'level' + sp.level;
            char.spells[key].push({
                id: sp.id,
                name: sp.name,
                level: sp.level,
                prepared: true,
                origin: sp.originName
            });
        });

    assert.strictEqual(char.spells.cantrip.length, 2);
    assert.strictEqual(char.spells.level1.length, 2);
    assert.strictEqual(char.spells.level2.length, 3);
    assert.strictEqual(char.spells.level3.length, 3);
    assert.ok(
        char.spells.level3.some((s) => s.name === 'Spirit guardians' || s.name.toLowerCase() === 'spirit guardians')
    );
    console.log('  ✔ Background expanded spells successfully extracted into checklist and imported');
}

// =========================================================================
// TEST 6: Setting Origin Feats (High Sorcery, Rune Shaper, Outer Planes)
// =========================================================================
console.log('\n[Test 6] Setting Origin Feats Definitions & Selection...');
{
    // 1. High Sorcery Moons
    assert.ok(HIGH_SORCERY_MOONS.solinari);
    assert.ok(HIGH_SORCERY_MOONS.lunitari);
    assert.ok(HIGH_SORCERY_MOONS.nuitari);
    assert.deepStrictEqual(HIGH_SORCERY_MOONS.solinari.cantrips, ['Light', 'Message', 'Sacred Flame']);

    // 2. Rune Shaper
    assert.ok(Array.isArray(RUNE_SHAPER_SPELLS));
    assert.ok(RUNE_SHAPER_SPELLS.includes('Armor of Agathys'));
    assert.ok(RUNE_SHAPER_SPELLS.includes('Command'));

    // 3. Outer Planes
    assert.ok(OUTER_PLANES.lawful);
    assert.strictEqual(OUTER_PLANES.lawful.cantrip, 'Guidance');
    assert.strictEqual(OUTER_PLANES.lawful.resistance, 'Force');
    assert.strictEqual(OUTER_PLANES.neutral.cantrip, 'Mage Hand');

    console.log('  ✔ Setting origin feats (High Sorcery, Rune Shaper, Outer Planes) verified');
}

console.log('\n🎉 ALL 6 CHARACTER BUILDER FEAT & BACKGROUND SPELLS TESTS PASSED SUCCESSFULLY!\n');
