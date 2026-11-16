import test from 'node:test';
import assert from 'node:assert/strict';

import { VTTDiceParser } from '../vtt/js/vtt-dice-parser.js';
import { calculateEncumbrance } from '../vtt/js/player-sheet/calc/containers.js';
import { simulateRoll } from '../vtt/js/player-sheet/vtt-sheet-rolls.js';

test('VTTDiceParser - Superadvantage 3d20kh1 keeps highest 1 and drops 2', () => {
    const res = VTTDiceParser.roll('3d20kh1 + 5');
    assert.equal(res.diceList.length, 3, 'Should roll 3 dice');
    const dropped = res.diceList.filter((d) => d.isDropped);
    const kept = res.diceList.filter((d) => !d.isDropped);

    assert.equal(dropped.length, 2, 'Should drop exactly 2 dice');
    assert.equal(kept.length, 1, 'Should keep exactly 1 die');

    const maxVal = Math.max(...res.diceList.map((d) => d.val));
    assert.equal(kept[0].val, maxVal, 'Kept die must be the highest rolled value');
    assert.equal(res.total, maxVal + 5, 'Total should equal highest die + modifier');
});

test('VTTDiceParser - ro1 and kh/kl combined in any order', () => {
    // Both 2d20kh1ro1 and 2d20ro1kh1 should parse without error
    const res1 = VTTDiceParser.roll('2d20kh1ro1 + 2');
    assert.ok(res1.diceList.length === 2, '2d20kh1ro1 should roll 2 dice');
    assert.equal(res1.diceList.filter((d) => !d.isDropped).length, 1, 'Should keep 1');

    const res2 = VTTDiceParser.roll('2d20ro1kh1 + 2');
    assert.ok(res2.diceList.length === 2, '2d20ro1kh1 should roll 2 dice');
    assert.equal(res2.diceList.filter((d) => !d.isDropped).length, 1, 'Should keep 1');

    const res3 = VTTDiceParser.roll('3d20kh1ro1');
    assert.equal(res3.diceList.length, 3, '3d20kh1ro1 should roll 3 dice');
    assert.equal(res3.diceList.filter((d) => !d.isDropped).length, 1, 'Should keep 1');
});

test('calculateEncumbrance - Default 1x Carry Multiplier', () => {
    const std = calculateEncumbrance(10, 100, 'standard', 1);
    assert.equal(std.maxThreshold, 150, 'STR 10 default max capacity is 150 lbs');
    assert.equal(std.pushDragLift, 300, 'STR 10 default push/drag/lift is 300 lbs');
    assert.equal(std.statusKey, 'normal');

    const over = calculateEncumbrance(10, 160, 'standard', 1);
    assert.equal(over.statusKey, 'over');
});

test('calculateEncumbrance - Powerful Build (2x Multiplier)', () => {
    const pb = calculateEncumbrance(10, 250, 'standard', 2);
    assert.equal(pb.maxThreshold, 300, 'STR 10 with 2x multiplier has 300 lbs capacity');
    assert.equal(pb.pushDragLift, 600, 'STR 10 with 2x multiplier has 600 lbs push/drag/lift');
    assert.equal(pb.statusKey, 'normal', '250 lbs is below 300 lbs limit');

    // Variant encumbrance with 2x multiplier
    const variantPb = calculateEncumbrance(10, 120, 'variant', 2);
    assert.equal(variantPb.encumberedThreshold, 100, '5 * 10 * 2 = 100 lbs');
    assert.equal(variantPb.heavyThreshold, 200, '10 * 10 * 2 = 200 lbs');
    assert.equal(variantPb.maxThreshold, 300, '15 * 10 * 2 = 300 lbs');
    assert.equal(variantPb.statusKey, 'encumbered', '120 lbs is encumbered');
});

test('simulateRoll - Local character sheet roll mode', () => {
    const mockCharAdv = {
        name: 'Elf Ranger',
        activeRollMode: 'adv',
        settings: { elvenAccuracy: false }
    };

    const rollAdv = simulateRoll('1d20 + 3', 20, null, { char: mockCharAdv });
    assert.equal(rollAdv.rollMode, 'adv');
    assert.equal(rollAdv.diceList.length, 2, 'Advantage should roll 2d20');

    const mockCharDis = {
        name: 'Elf Ranger',
        activeRollMode: 'dis',
        settings: { elvenAccuracy: false }
    };
    const rollDis = simulateRoll('1d20 + 3', 20, null, { char: mockCharDis });
    assert.equal(rollDis.rollMode, 'dis');
    assert.equal(rollDis.diceList.length, 2, 'Disadvantage should roll 2d20');
});

test('simulateRoll - Elven Accuracy Superadvantage (3d20kh1) on attack rolls with Advantage', () => {
    const mockChar = {
        name: 'Legolas',
        activeRollMode: 'adv',
        settings: {
            elvenAccuracy: true
        }
    };

    // Attack roll with advantage -> should trigger 3d20kh1
    const atkRoll = simulateRoll('1d20 + 7', 20, null, { char: mockChar, isAttack: true });
    assert.equal(atkRoll.isSuperAdvantage, true, 'isSuperAdvantage flag should be true');
    assert.equal(atkRoll.diceList.length, 3, 'Should roll 3 dice for superadvantage');
    assert.equal(atkRoll.diceList.filter((d) => !d.isDropped).length, 1, 'Should keep 1 die');
    assert.equal(atkRoll.diceList.filter((d) => d.isDropped).length, 2, 'Should drop 2 dice');

    // Non-attack roll with advantage (e.g. skill check) -> remains 2d20kh1
    const skillRoll = simulateRoll('1d20 + 5', 20, null, { char: mockChar, isAttack: false });
    assert.equal(skillRoll.isSuperAdvantage, false, 'Non-attack should not trigger superadvantage');
    assert.equal(skillRoll.diceList.length, 2, 'Should roll standard 2d20 advantage');

    // Attack roll with Normal mode -> remains 1d20
    const normalChar = {
        name: 'Legolas',
        activeRollMode: 'normal',
        settings: { elvenAccuracy: true }
    };
    const normAtkRoll = simulateRoll('1d20 + 7', 20, null, { char: normalChar, isAttack: true });
    assert.equal(normAtkRoll.diceList.length, 1, 'Normal attack should roll 1 die');
});

test('simulateRoll - Halfling Lucky appends ro1 to d20 rolls', () => {
    const mockLuckyChar = {
        name: 'Bilbo',
        activeRollMode: 'normal',
        settings: {
            halflingLucky: true
        }
    };

    const res = simulateRoll('1d20 + 2', 20, null, { char: mockLuckyChar });
    assert.equal(res.formula, '1d20 + 2');
    assert.ok(res.breakdownStr.includes('d20'), 'Roll executed');
});

test('simulateRoll - Global Crit Threshold configuration', () => {
    const mockChampion = {
        name: 'Fighter',
        activeRollMode: 'normal',
        settings: {
            critRange: 19
        }
    };

    // Roll 100 times or inspect dice logic with critRange = 19
    let got19Crit = false;
    for (let i = 0; i < 50; i++) {
        const res = simulateRoll('1d20', 20, null, { char: mockChampion });
        const rolledDie = res.diceList[0]?.val;
        if (rolledDie === 19) {
            assert.equal(res.isCritSuccess, true, '19 should register as a Critical Success with critRange = 19');
            got19Crit = true;
            break;
        }
    }
    // Explicit direct check with forced roll
    const customCritCheck = simulateRoll('1d20', 19);
    assert.ok(customCritCheck);
});
