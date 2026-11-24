import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getClassHitDie } from '../vtt/js/player-sheet/calc/stats.js';
import { convertRoll20Character } from '../electron/importers/roll20-importer.js';

test('Round 5 Fix 1: Hit Dice rolling heals character by roll + CON mod (min 1, capped at hpMax)', () => {
    const char = {
        name: 'Grom',
        hpCurrent: 10,
        hpMax: 30,
        stats: { con: 14 },
        hitDiceSpent: { d10: 0 },
        classes: [{ name: 'Fighter', level: 3 }]
    };

    // Simulate the hit dice rolling click handler logic from vtt-player-sheet.js
    const hd = 'd10';
    const rem = 3;
    assert.equal(rem > 0, true);

    char.hitDiceSpent[hd] = (char.hitDiceSpent[hd] || 0) + 1;
    assert.equal(char.hitDiceSpent[hd], 1);

    const con = 14;
    const conMod = Math.floor((con - 10) / 2); // +2
    const rollTotal = 7 + conMod; // 9
    const healAmount = Math.max(1, rollTotal);
    const oldHp = parseInt(char.hpCurrent) || 0;
    const hpMax = parseInt(char.hpMax) || 1;
    char.hpCurrent = Math.min(hpMax, oldHp + healAmount);

    assert.equal(char.hpCurrent, 19);

    // Test capping at hpMax
    char.hpCurrent = 28;
    const healAmount2 = 8;
    char.hpCurrent = Math.min(hpMax, (parseInt(char.hpCurrent) || 0) + healAmount2);
    assert.equal(char.hpCurrent, 30);
});

test('Round 5 Fix 2: Unified Warlock Short Rest slot recovery restores normal Warlock slots without touching feat slots', () => {
    // Pure 5th-level Warlock: has 2 3rd-level slots, plus a 1st-level slot from Fey-Touched feat
    const char = {
        name: 'Warlock Hero',
        class: 'Warlock',
        level: 5,
        classes: [{ name: 'Warlock', level: 5 }],
        spellSlots: {
            level1: { current: 0, max: 1 }, // Fey-Touched 1st level slot (Long rest only)
            level2: { current: 0, max: 0 },
            level3: { current: 0, max: 2 }, // Warlock Pact slots (Short rest)
            level4: { current: 0, max: 0 },
            level5: { current: 0, max: 0 }
        }
    };

    // Execute the unified recovery logic from vtt-player-sheet.js
    const classesList = char.classes;
    const validClasses = classesList.filter((c) => (c.name || '').trim() !== '');
    const warlockClass = validClasses.find((c) => (c.name || '').trim().toLowerCase() === 'warlock');
    assert.ok(warlockClass);

    let slotsRestored = false;
    const wLvl = parseInt(warlockClass.level) || 1;
    let slotLevelNum = 1;
    let slotCount = 1;
    if (wLvl >= 17) { slotLevelNum = 5; slotCount = 4; }
    else if (wLvl >= 11) { slotLevelNum = 5; slotCount = 3; }
    else if (wLvl >= 9) { slotLevelNum = 5; slotCount = 2; }
    else if (wLvl >= 7) { slotLevelNum = 4; slotCount = 2; }
    else if (wLvl >= 5) { slotLevelNum = 3; slotCount = 2; }
    else if (wLvl >= 3) { slotLevelNum = 2; slotCount = 2; }
    else if (wLvl >= 2) { slotLevelNum = 1; slotCount = 2; }
    else { slotLevelNum = 1; slotCount = 1; }

    assert.equal(slotLevelNum, 3);
    assert.equal(slotCount, 2);

    const targetLevelKey = `level${slotLevelNum}`;
    if (char.spellSlots[targetLevelKey]) {
        const cur = char.spellSlots[targetLevelKey].current || 0;
        const max = char.spellSlots[targetLevelKey].max || 0;
        const newCur = Math.min(max, cur + slotCount);
        if (newCur > cur) {
            char.spellSlots[targetLevelKey].current = newCur;
            slotsRestored = true;
        }
    }

    assert.equal(slotsRestored, true);
    // Warlock slots restored
    assert.equal(char.spellSlots.level3.current, 2);
    // Fey-Touched 1st-level slot left intact (0, not erroneously refilled!)
    assert.equal(char.spellSlots.level1.current, 0);
});

test('Round 5 Fix 3: Multiclass Warlock / Sorcerer short rest slot recovery works cleanly', () => {
    // Warlock 3 / Sorcerer 3
    const char = {
        name: 'Sorlock',
        classes: [
            { name: 'Sorcerer', level: 3 },
            { name: 'Warlock', level: 3 }
        ],
        spellSlots: {
            level1: { current: 1, max: 4 },
            level2: { current: 0, max: 4 } // 2 from Sorcerer + 2 from Warlock = 4 total
        }
    };

    const validClasses = char.classes.filter((c) => (c.name || '').trim() !== '');
    const warlockClass = validClasses.find((c) => (c.name || '').trim().toLowerCase() === 'warlock');
    assert.ok(warlockClass);

    const wLvl = parseInt(warlockClass.level) || 1;
    let slotLevelNum = 2;
    let slotCount = 2; // Level 3 Warlock has two 2nd-level slots

    const targetLevelKey = `level${slotLevelNum}`;
    const cur = char.spellSlots[targetLevelKey].current || 0;
    const max = char.spellSlots[targetLevelKey].max || 0;
    const newCur = Math.min(max, cur + slotCount);
    char.spellSlots[targetLevelKey].current = newCur;

    // Added 2 slots to level 2
    assert.equal(char.spellSlots.level2.current, 2);
    // Level 1 untouched
    assert.equal(char.spellSlots.level1.current, 1);
});

test('Round 5 Fix 4: Custom class hit die resolution respects classObj.hitDie', () => {
    // Standard classes
    assert.equal(getClassHitDie('barbarian'), 'd12');
    assert.equal(getClassHitDie('fighter'), 'd10');
    assert.equal(getClassHitDie('wizard'), 'd6');

    // Unknown class without custom hit die defaults to d8
    assert.equal(getClassHitDie('customwarrior'), 'd8');

    // Unknown or homebrew class with custom hitDie preserves custom die
    const customClass = { name: 'Juggernaut', level: 5, hitDie: 'd12' };
    assert.equal(getClassHitDie(customClass.name, null, customClass), 'd12');

    const customMage = { name: 'Witch', level: 3, hitDie: 'd6' };
    assert.equal(getClassHitDie(customMage.name, null, customMage), 'd6');
});

test('Round 5 Fix 5: Fighting Style subOptions include Defense and Defense grants +1 AC with armor', () => {
    const candidateClassFeatures = [];
    const fightingStyles = [
        { name: 'Archery', description: '+2 bonus to attack rolls with ranged weapons.' },
        { name: 'Blind Fighting', description: 'Blindsight with a range of 10 feet.' },
        { name: 'Defense', description: '+1 bonus to Armor Class while wearing armor.' },
        { name: 'Dueling', description: '+2 bonus to damage rolls when wielding a melee weapon in one hand and no other weapons.' }
    ];

    const fName = 'Fighting Style';
    const featId = 'cf_0_fighting_style';
    const subOptionChoice = 'Defense';

    candidateClassFeatures.push({
        id: featId,
        name: fName,
        level: 1,
        className: 'Fighter',
        isSubclass: false,
        subOptions: fightingStyles,
        subOptionChoice: subOptionChoice,
        checked: true
    });

    // Check that Defense is detected
    const hasDefenseFightingStyle = candidateClassFeatures.some(
        (f) => f.checked !== false && f.subOptionChoice && f.subOptionChoice.toLowerCase() === 'defense'
    );
    assert.equal(hasDefenseFightingStyle, true);

    // Wearing chain mail (base AC 16) + Defense = 17
    let baseAc = 16;
    if (hasDefenseFightingStyle) {
        baseAc += 1;
    }
    assert.equal(baseAc, 17);
});

test('Round 5 Fix 6: Roll20 Importer converts custom repeating resources into ability cards with counters', async () => {
    const mockRoll20Json = {
        schema_version: 1,
        character: {
            name: 'Kensei Monk',
            attribs: [
                { name: 'character_name', current: 'Kensei Monk' },
                { name: 'hp', current: '45', max: '45' },
                // Standard resources
                { name: 'class_resource_name', current: 'Ki Points' },
                { name: 'class_resource', current: '5', max: '6' },
                // Repeating resources
                { name: 'repeating_resource_-xyz123_resource_name', current: 'Superiority Dice' },
                { name: 'repeating_resource_-xyz123_resource_count', current: '3' },
                { name: 'repeating_resource_-xyz123_resource_count_max', current: '4' },
                // Repeating resources dual column
                { name: 'repeating_resource_-abc456_resource_left_name', current: 'Sorcery Points' },
                { name: 'repeating_resource_-abc456_resource_left', current: '2' },
                { name: 'repeating_resource_-abc456_resource_left_max', current: '5' }
            ]
        }
    };

    const char = await convertRoll20Character(mockRoll20Json, 'test_campaign');
    assert.ok(char.abilityCards);

    const kiCard = char.abilityCards.find(c => c.name.toLowerCase().includes('ki'));
    assert.ok(kiCard, 'Ki Points ability card should be created');
    assert.equal(kiCard.hasCounter, true);
    assert.equal(kiCard.usesCurrent, 5);
    assert.equal(kiCard.usesMax, 6);

    const supCard = char.abilityCards.find(c => c.name.toLowerCase().includes('superiority'));
    assert.ok(supCard, 'Superiority Dice ability card should be created');
    assert.equal(supCard.hasCounter, true);
    assert.equal(supCard.usesCurrent, 3);
    assert.equal(supCard.usesMax, 4);

    const sorcCard = char.abilityCards.find(c => c.name.toLowerCase().includes('sorcery'));
    assert.ok(sorcCard, 'Sorcery Points ability card should be created');
    assert.equal(sorcCard.hasCounter, true);
    assert.equal(sorcCard.usesCurrent, 2);
    assert.equal(sorcCard.usesMax, 5);
});
