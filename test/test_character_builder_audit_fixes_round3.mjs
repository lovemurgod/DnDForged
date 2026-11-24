import test from 'node:test';
import assert from 'node:assert/strict';

import { extractSpeciesProficiencies } from '../vtt/js/player-sheet/builder/builder-state.js';
import {
    FIGHTING_STYLES,
    ELDRITCH_INVOCATIONS_BASIC,
    METAMAGIC_OPTIONS,
    ELEMENTAL_TYPES,
    BATTLEMASTER_MANEUVERS,
    WEAPON_OPTIONS
} from '../vtt/js/player-sheet/builder/step7-feats.js';
import { resolveCharacterSheetSettings, evaluateDamageRolls } from '../vtt/js/player-sheet/calc/stats.js';
import { simulateRoll } from '../vtt/js/player-sheet/vtt-sheet-rolls.js';

// ─── 1. SPECIES SKILL CHOICES & COUNT WORD FILTERING ──────────────────────────

test('extractSpeciesProficiencies - Half-Elf returns 2 skill choices, excludes "two"', () => {
    const halfElfRace = {
        name: 'Half-Elf',
        entries: [
            {
                name: 'Skill Versatility',
                entries: ['You gain proficiency in two skills of your choice.']
            }
        ]
    };

    const result = extractSpeciesProficiencies(halfElfRace);
    assert.deepEqual(result.skills, [], 'Should not contain "two" or any other count words in fixed skills');
    assert.ok(result.skillChoice, 'Should extract a skillChoice object');
    assert.equal(result.skillChoice.count, 2, 'Half-Elf provides 2 skill choices');
    assert.equal(result.skillChoice.label, 'Skill Versatility');
});

test('extractSpeciesProficiencies - Variant Human returns 1 skill choice, excludes "one"', () => {
    const vHumanRace = {
        name: 'Human (Variant)',
        entries: [
            {
                name: 'Skills',
                entries: ['You gain proficiency in one skill of your choice.']
            }
        ]
    };

    const result = extractSpeciesProficiencies(vHumanRace);
    assert.deepEqual(result.skills, [], 'Should not contain "one" in fixed skills');
    assert.ok(result.skillChoice, 'Should extract skillChoice object');
    assert.equal(result.skillChoice.count, 1, 'Variant Human provides 1 skill choice');
});

test('extractSpeciesProficiencies - Lizardfolk returns Hunter\'s Lore (Choose 2 of Animal Handling, Nature, Perception, Stealth, Survival)', () => {
    const lizardfolkRace = {
        name: 'Lizardfolk',
        traits: [
            {
                name: "Hunter's Lore",
                entries: ['You gain proficiency with two of the following skills of your choice: Animal Handling, Nature, Perception, Stealth, or Survival.']
            }
        ]
    };

    const result = extractSpeciesProficiencies(lizardfolkRace);
    assert.deepEqual(result.skills, []);
    assert.ok(result.skillChoice);
    assert.equal(result.skillChoice.count, 2);
    assert.ok(result.skillChoice.from.includes('Perception'));
    assert.ok(result.skillChoice.from.includes('Stealth'));
});

// ─── 2. FEAT SUB-CHOICES CONSTANTS & OPTIONS ──────────────────────────────────

test('Feat Sub-Choices - Constants properly exported with standard 5e options', () => {
    assert.ok(Array.isArray(FIGHTING_STYLES) && FIGHTING_STYLES.includes('Archery') && FIGHTING_STYLES.includes('Dueling'));
    assert.ok(Array.isArray(ELDRITCH_INVOCATIONS_BASIC) && ELDRITCH_INVOCATIONS_BASIC.includes('Armor of Shadows') && ELDRITCH_INVOCATIONS_BASIC.includes('Devil\'s Sight'));
    assert.ok(Array.isArray(METAMAGIC_OPTIONS) && METAMAGIC_OPTIONS.includes('Quickened Spell') && METAMAGIC_OPTIONS.includes('Twinned Spell'));
    assert.ok(Array.isArray(ELEMENTAL_TYPES) && ELEMENTAL_TYPES.includes('Fire') && ELEMENTAL_TYPES.includes('Lightning'));
    assert.ok(Array.isArray(BATTLEMASTER_MANEUVERS) && BATTLEMASTER_MANEUVERS.includes('Riposte') && BATTLEMASTER_MANEUVERS.includes('Trip Attack'));
    assert.ok(Array.isArray(WEAPON_OPTIONS) && WEAPON_OPTIONS.includes('Longsword') && WEAPON_OPTIONS.includes('Heavy Crossbow'));
});

// ─── 3. RESOLVE CHARACTER SHEET SETTINGS & AUTOMATIONS ────────────────────────

test('resolveCharacterSheetSettings - Powerful Build auto-enables carryWeightMultiplier = 2', () => {
    const goliathChar = {
        name: 'Goliath Barbarian',
        race: 'Goliath',
        classes: [{ name: 'Barbarian', level: 1 }]
    };
    resolveCharacterSheetSettings(goliathChar);
    assert.equal(goliathChar.settings.carryWeightMultiplier, 2, 'Goliath must have carryWeightMultiplier = 2');
    assert.equal(goliathChar.carryWeightMultiplier, 2, 'Root property must match settings');

    const orcChar = {
        name: 'Orc Fighter',
        race: 'Orc',
        classes: [{ name: 'Fighter', level: 1 }]
    };
    resolveCharacterSheetSettings(orcChar);
    assert.equal(orcChar.settings.carryWeightMultiplier, 2, 'Orc must have carryWeightMultiplier = 2');

    const humanChar = {
        name: 'Human Wizard',
        race: 'Human',
        classes: [{ name: 'Wizard', level: 1 }]
    };
    resolveCharacterSheetSettings(humanChar);
    assert.equal(humanChar.settings.carryWeightMultiplier, 1, 'Standard human defaults to 1x');
});

test('resolveCharacterSheetSettings - Halfling auto-enables halflingLucky', () => {
    const halfling = {
        name: 'Lightfoot Rogue',
        race: 'Halfling',
        subrace: 'Lightfoot',
        classes: [{ name: 'Rogue', level: 1 }]
    };
    resolveCharacterSheetSettings(halfling);
    assert.equal(halfling.settings.halflingLucky, true);

    const dwarf = {
        name: 'Dwarf Cleric',
        race: 'Dwarf',
        classes: [{ name: 'Cleric', level: 1 }]
    };
    resolveCharacterSheetSettings(dwarf);
    assert.equal(dwarf.settings.halflingLucky, false);
});

test('resolveCharacterSheetSettings - Elven Accuracy detected from ability cards or feats', () => {
    const elfWithFeat = {
        name: 'Wood Elf Scout',
        race: 'Elf',
        classes: [{ name: 'Ranger', level: 4 }],
        abilityCards: [{ name: 'Feat: Elven Accuracy' }]
    };
    resolveCharacterSheetSettings(elfWithFeat);
    assert.equal(elfWithFeat.settings.elvenAccuracy, true);

    const elfWithoutFeat = {
        name: 'Wood Elf Scout',
        race: 'Elf',
        classes: [{ name: 'Ranger', level: 1 }],
        abilityCards: []
    };
    resolveCharacterSheetSettings(elfWithoutFeat);
    assert.equal(elfWithoutFeat.settings.elvenAccuracy, false);
});

test('resolveCharacterSheetSettings - Barbarian Brutal Critical scaling and Half-Orc Savage Attacks', () => {
    // Barbarian 9: +1 die
    const barb9 = {
        name: 'Krag',
        race: 'Human',
        classes: [{ name: 'Barbarian', level: 9 }]
    };
    resolveCharacterSheetSettings(barb9);
    assert.equal(barb9.settings.brutalCritical, true);
    assert.equal(barb9.settings.brutalCritDice, 1);

    // Barbarian 13: +2 dice
    const barb13 = {
        name: 'Krag',
        race: 'Human',
        classes: [{ name: 'Barbarian', level: 13 }]
    };
    resolveCharacterSheetSettings(barb13);
    assert.equal(barb13.settings.brutalCritical, true);
    assert.equal(barb13.settings.brutalCritDice, 2);

    // Barbarian 17: +3 dice
    const barb17 = {
        name: 'Krag',
        race: 'Human',
        classes: [{ name: 'Barbarian', level: 17 }]
    };
    resolveCharacterSheetSettings(barb17);
    assert.equal(barb17.settings.brutalCritical, true);
    assert.equal(barb17.settings.brutalCritDice, 3);

    // Half-Orc Barbarian 9: +1 (Barb) + 1 (Savage Attacks) = 2 extra dice
    const halfOrcBarb9 = {
        name: 'Grokk',
        race: 'Half-Orc',
        classes: [{ name: 'Barbarian', level: 9 }]
    };
    resolveCharacterSheetSettings(halfOrcBarb9);
    assert.equal(halfOrcBarb9.settings.brutalCritical, true);
    assert.equal(halfOrcBarb9.settings.brutalCritDice, 2);
});

test('resolveCharacterSheetSettings - Rogue Reliable Talent and Bard Jack of All Trades', () => {
    const rogue11 = {
        name: 'Shadow',
        classes: [{ name: 'Rogue', level: 11 }]
    };
    resolveCharacterSheetSettings(rogue11);
    assert.equal(rogue11.settings.reliableTalent, true);

    const bard2 = {
        name: 'Minstrel',
        classes: [{ name: 'Bard', level: 2 }]
    };
    resolveCharacterSheetSettings(bard2);
    assert.equal(bard2.settings.jackOfAllTrades, true);
});

test('resolveCharacterSheetSettings - Respects explicit manual toggle settings', () => {
    const manualChar = {
        name: 'Goliath Barbarian with toggles turned off',
        race: 'Goliath',
        classes: [{ name: 'Barbarian', level: 9 }],
        settings: {
            carryWeightMultiplier: 1,
            brutalCritical: false
        }
    };
    resolveCharacterSheetSettings(manualChar);
    assert.equal(manualChar.settings.carryWeightMultiplier, 1, 'Manual setting of 1x must be respected');
    assert.equal(manualChar.settings.brutalCritical, false, 'Manual toggle of false must be respected');
});

// ─── 4. ROLL AUTOMATIONS & MECHANICS ──────────────────────────────────────────

test('simulateRoll - Elven Accuracy requires Dex/Int/Wis/Cha attack roll, rejects Strength', () => {
    const elvenSniper = {
        name: 'Sniper',
        activeRollMode: 'adv',
        settings: { elvenAccuracy: true }
    };

    // Dex Attack with advantage -> triggers 3d20kh1
    const dexAtk = simulateRoll('1d20 + 7', 20, null, {
        char: elvenSniper,
        isAttack: true,
        stat: 'dex'
    });
    assert.equal(dexAtk.isSuperAdvantage, true);
    assert.equal(dexAtk.diceList.length, 3);

    // Int Spell Attack with advantage -> triggers 3d20kh1
    const intAtk = simulateRoll('1d20 + 8', 20, null, {
        char: elvenSniper,
        isAttack: true,
        stat: 'int'
    });
    assert.equal(intAtk.isSuperAdvantage, true);
    assert.equal(intAtk.diceList.length, 3);

    // Strength Weapon Attack with advantage -> normal 2d20kh1 (not superadvantage)
    const strAtk = simulateRoll('1d20 + 5', 20, null, {
        char: elvenSniper,
        isAttack: true,
        stat: 'str'
    });
    assert.equal(strAtk.isSuperAdvantage, false, 'Elven Accuracy must not apply to Strength attacks');
    assert.equal(strAtk.diceList.length, 2, 'Standard advantage rolls 2 dice');

    // Strength Weapon Attack detected via [STR] in formula
    const strFormulaAtk = simulateRoll('1d20+3[STR]', 20, null, {
        char: elvenSniper,
        isAttack: true
    });
    assert.equal(strFormulaAtk.isSuperAdvantage, false, 'Elven Accuracy must not apply to [STR] attacks');
    assert.equal(strFormulaAtk.diceList.length, 2);
});

test('simulateRoll - Reliable Talent clamps d20 rolls below 10 to 10 for proficient checks', () => {
    const rogue = {
        name: 'Rogue',
        activeRollMode: 'normal',
        settings: { reliableTalent: true }
    };

    // Roll 100 times for a proficient stealth check: every d20 must be >= 10
    for (let i = 0; i < 50; i++) {
        const roll = simulateRoll('1d20 + 9', 20, null, {
            char: rogue,
            isSkill: true,
            isProf: true,
            skill: 'Stealth'
        });
        const activeD20 = roll.diceList.find((d) => d.faces === 20 && !d.isDropped);
        assert.ok(activeD20.val >= 10, `Active d20 must be at least 10, got ${activeD20.val}`);
        assert.ok(roll.total >= 19, `Total must be at least 10 + 9 = 19, got ${roll.total}`);
    }

    // On an unproficient check (isProf: false), natural rolls below 10 are allowed
    let gotUnder10 = false;
    for (let i = 0; i < 100; i++) {
        const unprofRoll = simulateRoll('1d20 + 1', 20, null, {
            char: rogue,
            isSkill: true,
            isProf: false,
            skill: 'Athletics'
        });
        const activeD20 = unprofRoll.diceList.find((d) => d.faces === 20 && !d.isDropped);
        if (activeD20.val < 10) {
            gotUnder10 = true;
            break;
        }
    }
    assert.ok(gotUnder10, 'Unproficient check must not clamp to 10');
});

test('evaluateDamageRolls - Brutal Critical appends extra weapon damage dice on Critical Hit', () => {
    const barb = {
        name: 'Barbarian',
        stats: { str: 18 },
        settings: {
            brutalCritical: true,
            brutalCritDice: 2
        }
    };

    const greataxeWeapon = {
        name: 'Greataxe',
        attackStat: 'str',
        damage: [{ formula: '1d12', type: 'Slashing', stat: 'str' }]
    };

    // Normal non-crit roll: 1d12 + 4[STR]
    const normalRolls = evaluateDamageRolls(barb, greataxeWeapon, false, false);
    assert.equal(normalRolls.length, 1);
    // On non-crit, formula evaluated is 1d12 + 4[STR]

    // Critical roll: (1*2)d12 + 2d12[Brutal Critical] + 4[STR] -> 2d12 + 4 + 2d12
    const critRolls = evaluateDamageRolls(barb, greataxeWeapon, false, true);
    assert.equal(critRolls.length, 1);
    const critResult = critRolls[0].result;
    // Greataxe has 2d12 from crit double + 2d12 from Brutal Critical = 4 dice rolled
    const d12s = critResult.diceList.filter((d) => d.faces === 12);
    assert.equal(d12s.length, 4, 'Crit with 2 extra Brutal Critical dice on 1d12 should roll 4d12');
});
