/**
 * Automated Test Suite for Player Sheet Calculation Engines
 * Tests:
 * 1. Stat calculations & modifiers
 * 2. 5e & 2024 Multiclass Spell Slot Table & Pact Magic Engine
 * 3. Container base tare weight, effective weight, capacity tracking & encumbrance
 * 4. Short Rest and Long Rest recovery engine
 */

import assert from 'node:assert';
import { getTotalStat, getMod, getProfBonus } from '../vtt/js/player-sheet/calc/stats.js';
import {
    calculateEffectiveCasterLevel,
    calculateCharacterSpellSlots,
    getWarlockPactSlots
} from '../vtt/js/player-sheet/calc/spell-slots.js';
import {
    getContainerContentsWeight,
    getContainerEffectiveWeight,
    getContainerCapacityStatus,
    calculateCharacterTotalWeight,
    calculateEncumbrance
} from '../vtt/js/player-sheet/calc/containers.js';
import { applyShortRest, applyLongRest } from '../vtt/js/player-sheet/calc/rest-recovery.js';

console.log('--- RUNNING PLAYER SHEET CALCULATION ENGINES TEST SUITE ---\n');

// =========================================================================
// TEST 1: Stat Math, Modifiers & Proficiency
// =========================================================================
console.log('[TEST 1] Testing Stat Math, Modifiers & Proficiency...');
{
    const char = {
        stats: { str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 18 },
        statMods: { str: 2, dex: 0, con: -1, int: 0, wis: 0, cha: 0 }
    };

    assert.strictEqual(getTotalStat(char, 'str'), 18, 'STR 16 + 2 = 18');
    assert.strictEqual(getTotalStat(char, 'con'), 11, 'CON 12 - 1 = 11');
    assert.strictEqual(getTotalStat(char, 'wis'), 8, 'WIS 8 + 0 = 8');

    assert.strictEqual(getMod(18), 4, 'Score 18 yields +4 modifier');
    assert.strictEqual(getMod(10), 0, 'Score 10 yields +0 modifier');
    assert.strictEqual(getMod(8), -1, 'Score 8 yields -1 modifier');
    assert.strictEqual(getMod(1), -5, 'Score 1 yields -5 modifier');

    assert.strictEqual(getProfBonus(1), 2, 'Lvl 1 prof is +2');
    assert.strictEqual(getProfBonus(4), 2, 'Lvl 4 prof is +2');
    assert.strictEqual(getProfBonus(5), 3, 'Lvl 5 prof is +3');
    assert.strictEqual(getProfBonus(9), 4, 'Lvl 9 prof is +4');
    assert.strictEqual(getProfBonus(17), 6, 'Lvl 17 prof is +6');
    console.log('  ✓ Stats, ability modifiers, and proficiency bonuses calculate accurately.');
}

// =========================================================================
// TEST 2: Automated 5e & 2024 Multiclass Spell Slot Table & Pact Magic Engine
// =========================================================================
console.log('\n[TEST 2] Testing Automated Multiclass & Pact Magic Slot Calculations...');
{
    // A: Single-class Wizard Level 5
    const wiz5 = [{ name: 'Wizard', level: 5 }];
    const wizSlots = calculateCharacterSpellSlots(wiz5);
    assert.strictEqual(wizSlots.totalCasterLevel, 5, 'Wizard 5 is 5th level caster');
    assert.strictEqual(wizSlots.spellSlots.level1.max, 4, 'Wizard 5 has 4 1st-level slots');
    assert.strictEqual(wizSlots.spellSlots.level2.max, 3, 'Wizard 5 has 3 2nd-level slots');
    assert.strictEqual(wizSlots.spellSlots.level3.max, 2, 'Wizard 5 has 2 3rd-level slots');
    assert.strictEqual(wizSlots.spellSlots.level4.max, 0, 'Wizard 5 has 0 4th-level slots');
    assert.strictEqual(wizSlots.pactSlots, null, 'Wizard 5 has no pact slots');

    // B: 2014 Half Caster: Paladin Level 4
    const pal4 = [{ name: 'Paladin', level: 4 }];
    const palSlots = calculateCharacterSpellSlots(pal4, false);
    assert.strictEqual(palSlots.totalCasterLevel, 2, '2014 Paladin 4 is 2nd level caster (floor(4/2))');
    assert.strictEqual(palSlots.spellSlots.level1.max, 3, 'Paladin 4 has 3 1st-level slots');

    // C: 2024 Half Caster: Paladin Level 1 (Starts at Level 1 in 2024 XPHB)
    const pal1_2024 = [{ name: 'Paladin', level: 1 }];
    const pal1Slots = calculateCharacterSpellSlots(pal1_2024, true);
    assert.strictEqual(pal1Slots.totalCasterLevel, 1, '2024 Paladin 1 is 1st level caster (ceil(1/2))');
    assert.strictEqual(pal1Slots.spellSlots.level1.max, 2, '2024 Paladin 1 has 2 1st-level slots');

    // D: Multiclass Full Casters: Wizard 3 / Cleric 2 (Combined 5th level caster)
    const multiclassWizClr = [
        { name: 'Wizard', level: 3 },
        { name: 'Cleric', level: 2 }
    ];
    const mcSlots = calculateCharacterSpellSlots(multiclassWizClr);
    assert.strictEqual(mcSlots.totalCasterLevel, 5, 'Wizard 3 / Cleric 2 = 5th level combined caster');
    assert.strictEqual(mcSlots.spellSlots.level1.max, 4);
    assert.strictEqual(mcSlots.spellSlots.level2.max, 3);
    assert.strictEqual(mcSlots.spellSlots.level3.max, 2);

    // E: Multiclass with Artificer: Artificer 3 / Wizard 2 (Artificer ceil(3/2) = 2 + Wizard 2 = 4)
    const artiWiz = [
        { name: 'Artificer', level: 3 },
        { name: 'Wizard', level: 2 }
    ];
    const artiSlots = calculateCharacterSpellSlots(artiWiz);
    assert.strictEqual(artiSlots.totalCasterLevel, 4, 'Artificer 3 (2) + Wizard 2 = 4th level caster');
    assert.strictEqual(artiSlots.spellSlots.level1.max, 4);
    assert.strictEqual(artiSlots.spellSlots.level2.max, 3);

    // F: Single-class Warlock Level 5
    const warlock5 = [{ name: 'Warlock', level: 5 }];
    const war5Slots = calculateCharacterSpellSlots(warlock5);
    assert.strictEqual(war5Slots.totalCasterLevel, 0, 'Warlock alone has 0 standard slots');
    assert.strictEqual(war5Slots.pactSlots.level, 3, 'Warlock 5 has 3rd level Pact slots');
    assert.strictEqual(war5Slots.pactSlots.max, 2, 'Warlock 5 has 2 Pact slots');

    // G: Multiclass Warlock 3 / Sorcerer 4 (Sorcerer standard slots + Warlock Pact slots)
    const warSorc = [
        { name: 'Sorcerer', level: 4 },
        { name: 'Warlock', level: 3 }
    ];
    const warSorcSlots = calculateCharacterSpellSlots(warSorc);
    assert.strictEqual(warSorcSlots.totalCasterLevel, 4, 'Sorcerer 4 is 4th level standard caster');
    assert.strictEqual(warSorcSlots.spellSlots.level1.max, 4, 'Sorcerer gives 4 1st-level slots');
    assert.strictEqual(warSorcSlots.spellSlots.level2.max, 3, 'Sorcerer gives 3 2nd-level slots');
    assert.strictEqual(warSorcSlots.pactSlots.level, 2, 'Warlock 3 gives 2nd-level Pact slots');
    assert.strictEqual(warSorcSlots.pactSlots.max, 2, 'Warlock 3 gives 2 Pact slots');
    console.log('  ✓ 5e and 2024 Multiclass Spell Slot Table & Pact Magic engine verified.');
}

// =========================================================================
// TEST 3: Container Base Weight, Capacity Tracking & Encumbrance
// =========================================================================
console.log('\n[TEST 3] Testing Container Tare Weight, Capacity & Encumbrance Engine...');
{
    const equipment = [
        { id: 'eq1', name: 'Rations', weight: 2, qty: 5, containerId: 'bag_backpack' }, // 10 lb
        { id: 'eq2', name: 'Rope', weight: 10, qty: 1, containerId: 'bag_backpack' }, // 10 lb
        { id: 'eq3', name: 'Longsword', weight: 3, qty: 1, containerId: null }, // 3 lb (unbagged)
        { id: 'eq4', name: 'Gold Bars', weight: 50, qty: 2, containerId: 'bag_holding' } // 100 lb
    ];

    // Standard container with 5 lb base (tare) weight and 30 lb capacity
    const backpack = {
        id: 'bag_backpack',
        name: 'Adventurer Backpack',
        weightRule: 'standard',
        baseWeight: 5,
        capacity: 30
    };

    // Fixed weight container (Bag of Holding): fixed 15 lb, holds up to 500 lb
    const bagOfHolding = {
        id: 'bag_holding',
        name: 'Bag of Holding',
        weightRule: 'fixed',
        customWeight: 15,
        capacity: 500
    };

    // Weightless container
    const pouch = {
        id: 'bag_pouch',
        name: 'Extra-dimensional Pouch',
        weightRule: 'weightless'
    };

    const bpContents = getContainerContentsWeight(backpack, equipment);
    assert.strictEqual(bpContents, 20, 'Backpack contents: 10 lb rations + 10 lb rope = 20 lb');

    const bpEffective = getContainerEffectiveWeight(backpack, equipment);
    assert.strictEqual(bpEffective, 25, 'Backpack effective weight: 5 lb base + 20 lb contents = 25 lb');

    const bohEffective = getContainerEffectiveWeight(bagOfHolding, equipment);
    assert.strictEqual(
        bohEffective,
        15,
        'Bag of Holding effective weight is fixed 15 lb regardless of 100 lb contents'
    );

    const pouchEffective = getContainerEffectiveWeight(pouch, equipment);
    assert.strictEqual(pouchEffective, 0, 'Weightless container effective weight is 0 lb');

    // Capacity checks
    const bpCapNormal = getContainerCapacityStatus(backpack, equipment);
    assert.strictEqual(bpCapNormal.isOverCapacity, false, '20 lb contents in 30 lb backpack is NOT over capacity');
    assert.strictEqual(bpCapNormal.percentFull, 67, '20/30 is 67% full');

    // Overload the backpack: add 15 lb boulder
    const overloadedEquipment = [
        ...equipment,
        { id: 'eq5', name: 'Heavy Boulder', weight: 15, qty: 1, containerId: 'bag_backpack' } // total contents 35 lb
    ];
    const bpCapOver = getContainerCapacityStatus(backpack, overloadedEquipment);
    assert.strictEqual(bpCapOver.isOverCapacity, true, '35 lb contents in 30 lb backpack IS over capacity');

    // Total character inventory weight calculation
    const testChar = {
        equipment,
        containers: [backpack, bagOfHolding],
        currency: { cp: 50, sp: 50, ep: 0, gp: 0, pp: 0 } // 100 coins = 2 lb
    };
    const totalCalc = calculateCharacterTotalWeight(testChar);
    // Unbagged (3 lb) + Backpack (25 lb) + Bag of Holding (15 lb) + Coins (2 lb) = 45 lb
    assert.strictEqual(totalCalc.unbaggedWeight, 3);
    assert.strictEqual(totalCalc.containersTotalWeight, 40); // 25 + 15
    assert.strictEqual(totalCalc.coinWeight, 2);
    assert.strictEqual(totalCalc.totalWeight, 45);

    // Encumbrance checks (STR 10 -> Carrying Capacity 150 lb, Variant Encumbered at >50 lb, Heavy at >100 lb)
    const stdNormal = calculateEncumbrance(10, 45, 'standard');
    assert.strictEqual(stdNormal.statusKey, 'normal');

    const stdOver = calculateEncumbrance(10, 155, 'standard');
    assert.strictEqual(stdOver.statusKey, 'over');

    const varNormal = calculateEncumbrance(10, 45, 'variant');
    assert.strictEqual(varNormal.statusKey, 'normal');

    const varEncumbered = calculateEncumbrance(10, 60, 'variant');
    assert.strictEqual(varEncumbered.statusKey, 'encumbered');

    const varHeavy = calculateEncumbrance(10, 110, 'variant');
    assert.strictEqual(varHeavy.statusKey, 'heavy');

    const varOver = calculateEncumbrance(10, 160, 'variant');
    assert.strictEqual(varOver.statusKey, 'over');
    console.log('  ✓ Container tare weight, capacity tracking, and encumbrance states verified.');
}

// =========================================================================
// TEST 4: Rest & Recovery Engine (Short Rest & Long Rest)
// =========================================================================
console.log('\n[TEST 4] Testing Rest & Recovery Calculations...');
{
    const baseChar = {
        hpMax: 40,
        hpCurrent: 15,
        tempHp: 5,
        classes: [
            { name: 'Wizard', level: 3 },
            { name: 'Warlock', level: 2 }
        ],
        spellSlots: {
            level1: { current: 1, max: 4 },
            level2: { current: 0, max: 2 },
            pact: { current: 0, max: 2, level: 1 }
        },
        abilities: [
            { name: 'Second Wind', resetType: 'short', hasCounter: true, usesMax: 1, usesCurrent: 0 },
            { name: 'Action Surge', resetType: 'short', hasCounter: true, usesMax: 1, usesCurrent: 1 },
            { name: 'Arcane Recovery', resetType: 'long', hasCounter: true, usesMax: 1, usesCurrent: 0 }
        ],
        hitDiceSpent: { d6: 2, d8: 1 } // Spent 3 hit dice total (Wizard d6, Warlock d8)
    };

    // A: Short Rest
    const shortRestResult = applyShortRest(baseChar);
    assert.strictEqual(shortRestResult.restoredPactSlots, true, 'Short rest restores Warlock Pact slots');
    assert.strictEqual(shortRestResult.updatedChar.spellSlots.pact.current, 2, 'Pact slots restored to 2');
    assert.strictEqual(
        shortRestResult.updatedChar.spellSlots.level1.current,
        1,
        'Standard 1st level slots untouched by short rest'
    );
    assert.strictEqual(shortRestResult.updatedChar.abilities[0].usesCurrent, 1, 'Short rest ability reset');
    assert.strictEqual(
        shortRestResult.updatedChar.abilities[2].usesCurrent,
        0,
        'Long rest ability NOT reset by short rest'
    );

    // B: Long Rest
    const longRestResult = applyLongRest(baseChar);
    assert.strictEqual(longRestResult.updatedChar.hpCurrent, 40, 'HP restored to max (40)');
    assert.strictEqual(longRestResult.updatedChar.tempHp, 0, 'Temp HP reset to 0');
    assert.strictEqual(longRestResult.updatedChar.spellSlots.level1.current, 4, '1st level slots restored to max (4)');
    assert.strictEqual(longRestResult.updatedChar.spellSlots.level2.current, 2, '2nd level slots restored to max (2)');
    assert.strictEqual(longRestResult.updatedChar.spellSlots.pact.current, 2, 'Pact slots restored to max (2)');
    assert.strictEqual(longRestResult.updatedChar.abilities[0].usesCurrent, 1, 'Short rest ability restored');
    assert.strictEqual(longRestResult.updatedChar.abilities[2].usesCurrent, 1, 'Long rest ability restored');

    // Total hit dice = 3 + 2 = 5. Half total = floor(5 / 2) = 2 hit dice recovered.
    // Started with spent d6: 2, spent d8: 1.
    // Largest d8 recovered first: d8 becomes 0 spent, d6 recovers 1 (remaining 1 spent).
    assert.strictEqual(longRestResult.restoredHitDice, 2, 'Recovered half total hit dice (2)');
    assert.strictEqual(longRestResult.updatedChar.hitDiceSpent.d8, 0, 'd8 hit die recovered');
    assert.strictEqual(longRestResult.updatedChar.hitDiceSpent.d6, 1, 'd6 hit die spent reduced from 2 to 1');
    console.log('  ✓ Short Rest and Long Rest recovery engine verified.');
}

console.log('\n======================================================');
console.log('🎉 ALL CALCULATION ENGINE TESTS PASSED CLEANLY!');
console.log('======================================================\n');
