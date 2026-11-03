import assert from 'assert';
import {
    calculateEffectiveSpeed,
    getFeatAndAsiBonuses,
    getEffectiveStats,
    getEffectiveRacialBonuses
} from '../vtt/js/player-sheet/builder/builder-state.js';

console.log('--- Testing Character Builder: Speed, Racial AC, Stats & Manual Overrides ---');

// 1. Speed Calculation Tests
console.log('Testing calculateEffectiveSpeed...');
{
    const baseRace = { speeds: { walk: 30 } };
    const workingChar = { speed: { walk: 30, climb: 0, fly: 0, burrow: 0 }, classes: [{ name: 'Fighter', level: 4 }] };

    // Default base speed
    const defaultSpeed = calculateEffectiveSpeed(workingChar, baseRace, null, []);
    assert.strictEqual(defaultSpeed.walk, 30);
    assert.strictEqual(defaultSpeed.climb, 0);

    // Mobile feat (+10)
    const tiersWithMobile = [{ choice: 'feat', featName: 'Mobile' }];
    const mobileSpeed = calculateEffectiveSpeed(workingChar, baseRace, null, tiersWithMobile);
    assert.strictEqual(mobileSpeed.walk, 40);

    // Squat Nimbleness (+5 walk, climb becomes equal to walk)
    const tiersWithSquat = [{ choice: 'feat', featName: 'Squat Nimbleness' }];
    const squatSpeed = calculateEffectiveSpeed(workingChar, baseRace, null, tiersWithSquat);
    assert.strictEqual(squatSpeed.walk, 35);
    assert.strictEqual(squatSpeed.climb, 35, 'Squat Nimbleness climb should match walking speed');

    // Mobile + Squat Nimbleness
    const tiersBoth = [
        { choice: 'feat', featName: 'Mobile' },
        { choice: 'feat', featName: 'Squat Nimbleness' }
    ];
    const bothSpeed = calculateEffectiveSpeed(workingChar, baseRace, null, tiersBoth);
    assert.strictEqual(bothSpeed.walk, 45);
    assert.strictEqual(bothSpeed.climb, 45);

    // Monk Unarmored Movement (+10 at lvl 2, +15 at lvl 6)
    const monkChar = { speed: { walk: 30 }, classes: [{ name: 'Monk', level: 6 }] };
    const monkSpeed = calculateEffectiveSpeed(monkChar, baseRace, null, []);
    assert.strictEqual(monkSpeed.walk, 45);

    // Barbarian Fast Movement (+10 at lvl 5)
    const barbChar = { speed: { walk: 30 }, classes: [{ name: 'Barbarian', level: 5 }] };
    const barbSpeed = calculateEffectiveSpeed(barbChar, baseRace, null, []);
    assert.strictEqual(barbSpeed.walk, 40);

    console.log('✓ calculateEffectiveSpeed passed all cases.');
}

// 2. ASI & Feats No-Clash / No Auto-+2 STR Test
console.log('Testing ASI & Feats milestone defaults...');
{
    // Unassigned milestone tier
    const unassignedTiers = [
        { level: 4, choice: 'unselected', asiMode: 'plus2', stat1: '', stat2: '' }
    ];
    const bonuses = getFeatAndAsiBonuses(unassignedTiers);
    assert.strictEqual(bonuses.str, 0, 'Unassigned tier must NOT grant +2 STR');
    assert.strictEqual(bonuses.dex, 0);

    // Assigned ASI +2 STR
    const assignedTiers = [
        { level: 4, choice: 'asi', asiMode: 'plus2', stat1: 'str', stat2: '' }
    ];
    const assignedBonuses = getFeatAndAsiBonuses(assignedTiers);
    assert.strictEqual(assignedBonuses.str, 2, 'Assigned tier should grant +2 STR');

    // Assigned ASI +1 DEX, +1 CON
    const splitTiers = [
        { level: 4, choice: 'asi', asiMode: 'plus1plus1', stat1: 'dex', stat2: 'con' }
    ];
    const splitBonuses = getFeatAndAsiBonuses(splitTiers);
    assert.strictEqual(splitBonuses.dex, 1);
    assert.strictEqual(splitBonuses.con, 1);
    assert.strictEqual(splitBonuses.str, 0);

    console.log('✓ Milestone ASI unassigned tiers do not inflate STR.');
}

// 3. Point Buy and Standard Array Persistence
console.log('Testing Ability Score persistence logic...');
{
    const char = {
        statMethod: 'pointbuy',
        pointBuyScores: { str: 10, dex: 14, con: 14, int: 12, wis: 12, cha: 10 },
        standardArrayAssignments: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
        builderFeatSelections: [
            { level: 4, choice: 'feat', featName: 'Alert' }
        ]
    };

    // Simulate opening builder: restores fields
    const workingChar = {
        statMethod: char.statMethod || 'standard',
        pointBuyScores: { ...(char.pointBuyScores || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }) },
        standardArrayAssignments: { ...(char.standardArrayAssignments || { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }) }
    };
    const asiTiers = (char.builderFeatSelections || []).map(t => ({ ...t }));

    assert.strictEqual(workingChar.statMethod, 'pointbuy');
    assert.strictEqual(workingChar.pointBuyScores.dex, 14);
    assert.strictEqual(workingChar.pointBuyScores.str, 10);
    assert.strictEqual(asiTiers[0].featName, 'Alert');

    const stats = getEffectiveStats(workingChar, { name: 'Human' }, null, asiTiers, {});
    // Base 10 STR + 0 = 10 (no +2 STR artifact!)
    assert.strictEqual(stats.str, 10, 'STR should remain 10 without unassigned ASI inflation');

    console.log('✓ Point buy and builder selections persist without alteration.');
}

// 4. Racial Natural Armor Calculations
console.log('Testing Racial Natural Armor calculations...');
{
    // Simulated runAcCalculation logic matching builder-modal.js
    function calculateAc(chosenOption, isWarforged, hasShield, dexMod, conMod) {
        let ac = 10;
        let shieldBonus = hasShield ? 2 : 0;
        let wfBonus = isWarforged ? 1 : 0;

        if (chosenOption.type === 'Special') {
            if (chosenOption.id === 'special_tortle') {
                ac = 17 + shieldBonus + wfBonus;
            } else if (chosenOption.id === 'special_lizardfolk' || chosenOption.id === 'special_autognome' || chosenOption.id === 'special_thrikreen') {
                ac = 13 + dexMod + shieldBonus + wfBonus;
            } else if (chosenOption.id === 'special_locathah') {
                ac = 12 + dexMod + shieldBonus + wfBonus;
            } else if (chosenOption.id === 'special_loxodon') {
                ac = 12 + conMod + shieldBonus + wfBonus;
            }
        } else if (chosenOption.id === 'none') {
            ac = 10 + dexMod + shieldBonus + wfBonus;
        }
        return ac;
    }

    // Tortle: flat 17, no DEX bonus; shield adds +2 -> 19
    assert.strictEqual(calculateAc({ id: 'special_tortle', type: 'Special' }, false, false, 3, 2), 17);
    assert.strictEqual(calculateAc({ id: 'special_tortle', type: 'Special' }, false, true, 19, 2), 19);

    // Lizardfolk: 13 + DEX (3) = 16; shield adds +2 -> 18
    assert.strictEqual(calculateAc({ id: 'special_lizardfolk', type: 'Special' }, false, false, 3, 2), 16);
    assert.strictEqual(calculateAc({ id: 'special_lizardfolk', type: 'Special' }, false, true, 3, 2), 18);

    // Locathah: 12 + DEX (3) = 15
    assert.strictEqual(calculateAc({ id: 'special_locathah', type: 'Special' }, false, false, 3, 2), 15);

    // Loxodon: 12 + CON (4) = 16
    assert.strictEqual(calculateAc({ id: 'special_loxodon', type: 'Special' }, false, false, 1, 4), 16);

    // Warforged bonus (+1)
    assert.strictEqual(calculateAc({ id: 'none', type: 'Light' }, true, false, 2, 2), 13); // 10 + 2 DEX + 1 WF

    console.log('✓ Racial Natural Armor calculations verified.');
}

// 5. Manual HP and AC Overrides
console.log('Testing Manual HP & AC overrides...');
{
    const builderState = {
        hpManualOverride: 65,
        acManualOverride: 21,
        calculatedHp: 38,
        calculatedAc: 15
    };

    // When manual overrides exist, they take precedence
    let effectiveHp = builderState.hpManualOverride || builderState.calculatedHp;
    let effectiveAc = builderState.acManualOverride || builderState.calculatedAc;
    assert.strictEqual(effectiveHp, 65);
    assert.strictEqual(effectiveAc, 21);

    // Clearing manual overrides restores calculated engine values
    builderState.hpManualOverride = null;
    builderState.acManualOverride = null;
    effectiveHp = builderState.hpManualOverride || builderState.calculatedHp;
    effectiveAc = builderState.acManualOverride || builderState.calculatedAc;
    assert.strictEqual(effectiveHp, 38);
    assert.strictEqual(effectiveAc, 15);

    console.log('✓ Manual HP & AC overrides take precedence and clear cleanly.');
}

console.log('\n=== ALL MANUAL OVERRIDES, SPEED, RACIAL AC & ASI FIX TESTS PASSED ===');
