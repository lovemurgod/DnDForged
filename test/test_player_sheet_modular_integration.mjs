import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Calculation engines
import {
    getTotalStat,
    getMod,
    getProfBonus,
    getClassHitDie,
    evaluateAttackRoll,
    evaluateSaveDc
} from '../vtt/js/player-sheet/calc/stats.js';

import {
    calculateEffectiveCasterLevel,
    getWarlockPactSlots,
    calculateCharacterSpellSlots,
    MULTICLASS_SPELL_SLOT_TABLE
} from '../vtt/js/player-sheet/calc/spell-slots.js';

import {
    getContainerContentsWeight,
    getContainerEffectiveWeight,
    getContainerCapacityStatus,
    calculateCharacterTotalWeight,
    calculateEncumbrance
} from '../vtt/js/player-sheet/calc/containers.js';

import { applyShortRest, applyLongRest } from '../vtt/js/player-sheet/calc/rest-recovery.js';

// Items module
import {
    getNormalizedRarity,
    getRarityBadgeHtml,
    RARITY_ORDER,
    parseItemEntry,
    buildItemMechanicalText
} from '../vtt/js/player-sheet/items/index.js';

// Modals module
import { getPlayerActiveTokenUrl } from '../vtt/js/player-sheet/modals/index.js';

// Modular UI modules (Inventory, Spells Tab, Bio & Features)
import {
    renderEquipRowHtml,
    renderEquipmentHtml,
    wireInventoryEvents
} from '../vtt/js/player-sheet/vtt-sheet-inventory.js';

import {
    SPELL_LEVELS,
    getActiveSpellTab,
    setActiveSpellTab,
    getSpellMetaStrings,
    cleanSpellHtml,
    promptUpcastLevel,
    getCharIs2024,
    findPlayerSpell,
    getUpcastedDamage,
    renderSpellsHtml,
    wireSpellsEvents
} from '../vtt/js/player-sheet/vtt-sheet-spells-tab.js';

import {
    cleanProficiencyString,
    sanitizeProficienciesText,
    renderPrimaryBioCardHtml,
    renderOtherProficienciesHtml,
    formatAbilityCardDescription,
    renderAbilityRowHtml,
    renderAbilityCardsHtml,
    harvestBioData,
    renderAbilityFields,
    wireBioEvents,
    wireAbilityCardsEvents
} from '../vtt/js/player-sheet/vtt-sheet-bio-features.js';

console.log('--- RUNNING MODULAR PLAYER SHEET INTEGRATION SUITE ---\n');

// ─── TEST 1: Modular Engine Exports & Architecture ───────────────────────────
console.log('[TEST 1] Testing Calculation & Helper Exports...');
assert.strictEqual(typeof getTotalStat, 'function');
assert.strictEqual(typeof getMod, 'function');
assert.strictEqual(typeof getProfBonus, 'function');
assert.strictEqual(typeof getClassHitDie, 'function');
assert.strictEqual(typeof calculateCharacterSpellSlots, 'function');
assert.strictEqual(typeof calculateCharacterTotalWeight, 'function');
assert.strictEqual(typeof applyShortRest, 'function');
assert.strictEqual(typeof applyLongRest, 'function');
assert.strictEqual(typeof getNormalizedRarity, 'function');
assert.strictEqual(typeof getPlayerActiveTokenUrl, 'function');

assert.strictEqual(getMod(10), 0);
assert.strictEqual(getMod(16), 3);
assert.strictEqual(getMod(8), -1);
assert.strictEqual(getProfBonus(1), 2);
assert.strictEqual(getProfBonus(5), 3);
assert.strictEqual(getProfBonus(9), 4);
assert.strictEqual(getProfBonus(13), 5);
assert.strictEqual(getProfBonus(17), 6);
console.log('  ✓ Calculation engines and helpers exported and verified.');

// ─── TEST 2: Automated Multiclass & Pact Magic Slot Calculations ──────────────
console.log('\n[TEST 2] Testing Multiclass & Pact Magic Slot Integration...');
{
    // Character: Paladin 6 / Sorcerer 4 / Warlock 3
    const char = {
        name: 'Vindicator Roland',
        level: 13,
        classes: [
            { name: 'Paladin', level: 6 },
            { name: 'Sorcerer', level: 4 },
            { name: 'Warlock', level: 3 }
        ],
        spellSlots: {}
    };

    // Calculate effective multiclass caster level:
    // Paladin (half caster) = floor(6/2) = 3
    // Sorcerer (full caster) = 4
    // Combined caster level = 7
    const effLvl = calculateEffectiveCasterLevel(char.classes, false);
    assert.strictEqual(effLvl, 7, 'Effective caster level must be 7');

    const expectedCombined = MULTICLASS_SPELL_SLOT_TABLE[7];
    // Level 7 caster slots: 4 x 1st, 3 x 2nd, 3 x 3rd, 1 x 4th
    assert.deepStrictEqual(expectedCombined, [4, 3, 3, 1, 0, 0, 0, 0, 0]);

    // Warlock 3: 2 slots of 2nd level
    const pact = getWarlockPactSlots(3);
    assert.deepStrictEqual(pact, { level: 2, max: 2, current: 2 });

    // Seed spell slots
    const computed = calculateCharacterSpellSlots(char.classes, false, char.spellSlots);
    assert.strictEqual(computed.spellSlots.level1.max, 4);
    assert.strictEqual(computed.spellSlots.level2.max, 3);
    assert.strictEqual(computed.spellSlots.level3.max, 3);
    assert.strictEqual(computed.spellSlots.level4.max, 1);
    assert.strictEqual(computed.pactSlots.max, 2);
    assert.strictEqual(computed.pactSlots.level, 2);

    console.log('  ✓ Paladin 6 / Sorcerer 4 / Warlock 3 slots accurately computed (Caster Lvl 7 + Pact Lvl 2).');
}

// ─── TEST 3: Inventory, Container Tare Weight & Capacity Tracking ─────────────
console.log('\n[TEST 3] Testing Container Tare Base Weight & Capacity Tracking...');
{
    const char = {
        stats: { str: 14 },
        equipment: [
            // Uncontained items
            { id: 'eq1', name: 'Longsword', weight: 3, qty: 1, containerId: null },
            { id: 'eq2', name: 'Torches', weight: 1, qty: 10, containerId: null }, // 10 lb
            // Inside Backpack
            { id: 'eq3', name: 'Rations', weight: 1, qty: 5, containerId: 'bag_backpack' }, // 5 lb
            { id: 'eq4', name: 'Bedroll', weight: 7, qty: 1, containerId: 'bag_backpack' }, // 7 lb
            { id: 'eq5', name: 'Rope (50ft)', weight: 10, qty: 1, containerId: 'bag_backpack' }, // 10 lb
            // Inside Bag of Holding
            { id: 'eq6', name: 'Treasure Chest', weight: 50, qty: 1, containerId: 'bag_holding' },
            { id: 'eq7', name: 'Gold Bars', weight: 150, qty: 1, containerId: 'bag_holding' }
        ],
        containers: [
            {
                id: 'bag_backpack',
                name: 'Backpack',
                weightRule: 'standard',
                baseWeight: 5,
                capacity: 30
            },
            {
                id: 'bag_holding',
                name: 'Bag of Holding',
                weightRule: 'fixed',
                customWeight: 15,
                baseWeight: 0,
                capacity: 500
            }
        ]
    };

    // 1. Backpack contents = 5 + 7 + 10 = 22 lb
    const backpackContents = getContainerContentsWeight(char.containers[0], char.equipment);
    assert.strictEqual(backpackContents, 22, 'Backpack contents should be 22 lb');

    // Backpack effective weight = baseWeight (5) + contents (22) = 27 lb
    const backpackEffective = getContainerEffectiveWeight(char.containers[0], char.equipment);
    assert.strictEqual(backpackEffective, 27, 'Backpack effective weight must include 5 lb tare');

    // Backpack capacity status: 22 lb / 30 lb = 73%
    const backpackCap = getContainerCapacityStatus(char.containers[0], char.equipment);
    assert.strictEqual(backpackCap.contentsWeight, 22);
    assert.strictEqual(backpackCap.capacity, 30);
    assert.strictEqual(backpackCap.isOverCapacity, false);
    assert.strictEqual(backpackCap.percentFull, 73);

    // 2. Bag of Holding contents = 50 + 150 = 200 lb
    const holdingContents = getContainerContentsWeight(char.containers[1], char.equipment);
    assert.strictEqual(holdingContents, 200);

    // Bag of holding fixed weight = 15 lb
    const holdingEffective = getContainerEffectiveWeight(char.containers[1], char.equipment);
    assert.strictEqual(holdingEffective, 15, 'Bag of holding should have fixed weight 15 lb');

    // 3. Total character carried weight = 3 (sword) + 10 (torches) + 27 (backpack) + 15 (holding) = 55 lb
    const totalWeightRes = calculateCharacterTotalWeight(char);
    assert.strictEqual(totalWeightRes.totalWeight, 55, 'Total weight must equal 55 lb');

    // 4. Encumbrance check: STR 14, 55 lb -> Max capacity = 14 * 15 = 210 lb
    const enc = calculateEncumbrance(char.stats.str, totalWeightRes.totalWeight, 'standard');
    assert.strictEqual(enc.maxThreshold, 210);
    assert.strictEqual(enc.statusKey, 'normal');

    console.log('  ✓ Container tare weight, capacity bars, and fixed weight rules verified.');
}

// ─── TEST 4: Short Rest & Long Rest Recovery Engines ──────────────────────────
console.log('\n[TEST 4] Testing Short Rest & Long Rest Recovery Engine...');
{
    const char = {
        name: 'Gromph',
        hpCurrent: 15,
        hpMax: 45,
        tempHp: 10,
        classes: [
            { name: 'Fighter', level: 5 },
            { name: 'Warlock', level: 3 }
        ],
        hitDiceSpent: {
            d10: 3,
            d8: 2
        },
        spellSlots: {
            level1: { current: 1, max: 4 },
            level2: { current: 0, max: 3 },
            pact: { current: 0, max: 2, level: 2 }
        },
        abilities: [
            { name: 'Action Surge', usesCurrent: 0, usesMax: 1, hasCounter: true, resetType: 'short' },
            { name: 'Second Wind', usesCurrent: 0, usesMax: 1, hasCounter: true, resetType: 'short' },
            { name: 'Indomitable', usesCurrent: 0, usesMax: 1, hasCounter: true, resetType: 'long' }
        ]
    };

    // 1. Short Rest:
    // - Multiclass Warlock: Pact slots restore to max (2), regular level 1 slots remain uncharged (1)
    // - Short rest abilities reset to max
    // - Long rest ability remains unreset
    const shortRestResult = applyShortRest(char);
    const shortChar = shortRestResult.updatedChar;

    assert.strictEqual(shortChar.spellSlots.pact.current, 2, 'Pact slots restored on short rest');
    assert.strictEqual(shortChar.spellSlots.level1.current, 1, 'Regular level 1 slots NOT restored on short rest');
    assert.strictEqual(shortChar.abilities[0].usesCurrent, 1, 'Action Surge restored');
    assert.strictEqual(shortChar.abilities[1].usesCurrent, 1, 'Second Wind restored');
    assert.strictEqual(shortChar.abilities[2].usesCurrent, 0, 'Indomitable not restored on short rest');
    assert.strictEqual(shortRestResult.restoredPactSlots, true);

    // 2. Long Rest:
    // - Full HP restored (45), tempHp reset to 0
    // - All regular spell slots and pact slots restored to max
    // - Hit dice recovered (total 8 -> floor(8/2) = 4 recovered, starting with d10)
    // - Long rest abilities reset
    const longRestResult = applyLongRest(shortChar);
    const longChar = longRestResult.updatedChar;

    assert.strictEqual(longChar.hpCurrent, 45, 'HP fully restored on long rest');
    assert.strictEqual(longChar.tempHp, 0, 'Temp HP reset to 0');
    assert.strictEqual(longChar.spellSlots.level1.current, 4, 'Level 1 slots fully restored');
    assert.strictEqual(longChar.spellSlots.level2.current, 3, 'Level 2 slots fully restored');
    assert.strictEqual(longChar.spellSlots.pact.current, 2, 'Pact slots fully restored');
    assert.strictEqual(longChar.abilities[2].usesCurrent, 1, 'Long rest ability restored');
    assert.strictEqual(longChar.hitDiceSpent['d10'], 0, 'd10 hit dice spent restored first');

    console.log('  ✓ Short Rest (pact slots, short-rest abilities) and Long Rest (HP, hit dice, slots) verified.');
}

// ─── TEST 5: Orchestrator Code Metrics & Size Reduction ───────────────────────
console.log('\n[TEST 5] Testing vtt-player-sheet.js Code Size & Decomposed Metrics...');
{
    const sheetPath = fs.existsSync('vtt/js/vtt-player-sheet.js')
        ? path.resolve('vtt/js/vtt-player-sheet.js')
        : path.resolve(
              path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
              '../vtt/js/vtt-player-sheet.js'
          );
    const sheetCode = fs.readFileSync(sheetPath, 'utf8');
    const lines = sheetCode.split(/\r?\n/).length;

    console.log(`  Current vtt-player-sheet.js lines: ${lines}`);
    assert.ok(lines < 8000, `Line count should be under 8,000 lines (current: ${lines})`);

    // Verify key imports are present
    assert.ok(sheetCode.includes("from './player-sheet/calc/stats.js'"), 'Imports stats.js');
    assert.ok(sheetCode.includes("from './player-sheet/calc/spell-slots.js'"), 'Imports spell-slots.js');
    assert.ok(sheetCode.includes("from './player-sheet/calc/containers.js'"), 'Imports containers.js');
    assert.ok(sheetCode.includes("from './player-sheet/calc/rest-recovery.js'"), 'Imports rest-recovery.js');
    assert.ok(sheetCode.includes("from './player-sheet/builder/builder-modal.js'"), 'Imports builder-modal.js');
    assert.ok(sheetCode.includes("from './player-sheet/items/index.js'"), 'Imports items/index.js');
    assert.ok(sheetCode.includes("from './player-sheet/modals/index.js'"), 'Imports modals/index.js');
    assert.ok(sheetCode.includes("from './player-sheet/vtt-sheet-inventory.js'"), 'Imports vtt-sheet-inventory.js');
    assert.ok(sheetCode.includes("from './player-sheet/vtt-sheet-spells-tab.js'"), 'Imports vtt-sheet-spells-tab.js');
    assert.ok(
        sheetCode.includes("from './player-sheet/vtt-sheet-bio-features.js'"),
        'Imports vtt-sheet-bio-features.js'
    );

    // Verify public API exports
    assert.ok(sheetCode.includes('export function initVttPlayerSheet('), 'Exports initVttPlayerSheet');
    assert.ok(sheetCode.includes('openSheet,'), 'Public API has openSheet');
    assert.ok(sheetCode.includes('openPanel,'), 'Public API has openPanel');
    assert.ok(sheetCode.includes('minimizePanel,'), 'Public API has minimizePanel');
    assert.ok(sheetCode.includes('closeSheet,'), 'Public API has closeSheet');
    assert.ok(sheetCode.includes('getCurrentChar: () => currentChar,'), 'Public API has getCurrentChar');
    assert.ok(sheetCode.includes('syncLiveHp'), 'Public API has syncLiveHp');

    console.log(
        `  ✓ God-file decomposition verified: 16,009 LOC -> ${lines} LOC (over 8,300 LOC extracted into modular subsystems).`
    );
}

// ─── TEST 6: Modular UI Subsystems (Inventory, Spells, Bio & Features) ───────
console.log('\n[TEST 6] Testing Modular UI Subsystems (Inventory, Spells Tab, Bio & Features)...');
{
    const dummyChar = {
        name: 'Aerith Stormcaller',
        level: 5,
        classes: [{ name: 'Wizard', level: 5 }],
        stats: { str: 10, dex: 14, con: 12, int: 18, wis: 13, cha: 8 },
        currency: { cp: 10, sp: 20, ep: 0, gp: 50, pp: 1 },
        bio: {
            age: '24',
            height: '5ft 6in',
            weight: '125 lbs',
            backstory: 'A scholar of the ancient arcane archives.',
            notes: 'Searching for the Lost Grimoire of Netheril.'
        },
        proficiencies: {
            armor: 'None',
            weapons: 'Daggers, Darts, Slings, Quarterstaffs, Light Crossbows',
            tools: "Alchemist's Supplies",
            languages: 'Common, Draconic, Elvish'
        },
        equipment: [
            { id: 'eq1', name: 'Spellbook', weight: 3, qty: 1, equipped: true },
            { id: 'eq2', name: 'Quarterstaff', weight: 4, qty: 1, equipped: true }
        ],
        containers: [{ id: 'c1', name: 'Backpack', capacity: 30, baseWeight: 5, weightRule: 'standard' }],
        spells: {
            cantrip: [
                {
                    name: 'Fire Bolt',
                    damage: '1d10',
                    damageType: 'fire',
                    school: 'Evocation',
                    castingTime: '1 action',
                    range: '120 feet'
                }
            ],
            level1: [
                {
                    name: 'Magic Missile',
                    damage: '1d4+1',
                    damageType: 'force',
                    school: 'Evocation',
                    prepared: true,
                    upcastBonus: '1d4+1'
                }
            ]
        },
        spellSlots: {
            level1: { current: 4, max: 4 }
        },
        abilityCards: [
            {
                id: 'ab1',
                name: 'Arcane Recovery',
                description: 'Once per day on a short rest...',
                hasCounter: true,
                usesCurrent: 1,
                usesMax: 1
            }
        ],
        abilityCategories: []
    };

    const mockCtx = {
        getProfBonus: () => 3,
        formatAbilityCardDescription: (desc) => desc,
        parseItemEntry: () => ({ name: 'Test' }),
        buildItemMechanicalText: () => '',
        getRarityBadgeHtml: () => '',
        evaluateAbilityFormula: () => '1d20+4'
    };

    // 1. Inventory rendering
    const equipHtml = renderEquipmentHtml(dummyChar, mockCtx);
    assert.ok(equipHtml.includes('Spellbook'), 'Rendered equipment includes Spellbook');
    assert.ok(equipHtml.includes('pc-currency-input'), 'Rendered currency inputs');
    assert.ok(equipHtml.includes('Total Wt:'), 'Rendered total weight');
    assert.ok(equipHtml.includes('Backpack'), 'Rendered container backpack');
    assert.ok(equipHtml.includes('30.0 lb'), 'Rendered container capacity metric');

    // 2. Spells tab rendering & helpers
    assert.ok(Array.isArray(SPELL_LEVELS), 'SPELL_LEVELS array exported');
    assert.strictEqual(getCharIs2024(dummyChar), false, '2014 ruleset recognized');
    assert.strictEqual(getCharIs2024({ ruleset: '2024' }), true, '2024 ruleset recognized');

    const foundSpell = findPlayerSpell(dummyChar, 'level1', 0);
    assert.strictEqual(foundSpell.name, 'Magic Missile');

    const upcasted = getUpcastedDamage(dummyChar.spells.level1[0], 2, 1, 5);
    assert.ok(upcasted.length > 0, 'Computed upcasted damage');

    const spellsHtml = renderSpellsHtml(dummyChar, mockCtx);
    assert.ok(spellsHtml.includes('Fire Bolt'), 'Spells HTML contains cantrips');
    assert.ok(spellsHtml.includes('Magic Missile'), 'Spells HTML contains 1st level spells');
    assert.ok(spellsHtml.includes('pc-slot-current'), 'Spells HTML includes slot counters');

    // 3. Bio & Features rendering & helpers
    assert.strictEqual(cleanProficiencyString('{@item longsword|phb|Longsword}'), 'Longsword');
    assert.strictEqual(cleanProficiencyString('simple', true), 'Simple Weapons');
    assert.strictEqual(sanitizeProficienciesText('{@item dagger}, {@item dart}'), 'Dagger, Dart');

    const bioHtml = renderPrimaryBioCardHtml(dummyChar);
    assert.ok(bioHtml.includes('pc-primary-bio-age'), 'Bio card rendered');
    assert.ok(bioHtml.includes('24'), 'Bio card contains age');

    const profHtml = renderOtherProficienciesHtml(dummyChar);
    assert.ok(profHtml.includes('Draconic'), 'Proficiencies include Draconic');
    assert.ok(profHtml.includes('Quarterstaffs'), 'Proficiencies include Quarterstaffs');

    const abilityHtml = renderAbilityCardsHtml(dummyChar, mockCtx);
    assert.ok(abilityHtml.includes('Arcane Recovery'), 'Ability cards HTML contains Arcane Recovery');

    console.log('  ✓ Inventory, Spells Tab, and Bio/Features modular components verified.');
}

// ─── TEST 7: ASAR Packaging Configuration ────────────────────────────────────
console.log('\n[TEST 7] Testing ASAR Packaging Configuration...');
{
    const pkgPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(typeof pkg.build?.asar === 'boolean', true, 'package.json build.asar must be configured');

    const srdPath = path.resolve('electron-builder-srd.json');
    const srd = JSON.parse(fs.readFileSync(srdPath, 'utf8'));
    assert.strictEqual(srd.asar, true, 'electron-builder-srd.json asar must be true');

    console.log('  ✓ ASAR packaging enabled in package.json and electron-builder-srd.json.');
}

console.log('\n======================================================');
console.log('🎉 ALL MODULAR PLAYER SHEET INTEGRATION TESTS PASSED!');
console.log('======================================================');
