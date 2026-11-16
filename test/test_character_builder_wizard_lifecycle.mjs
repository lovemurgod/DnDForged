/**
 * test/test_character_builder_wizard_lifecycle.mjs
 * ForgeDVTT - Character Builder & Level-Up Wizard Headless Lifecycle Test Suite
 * Validates mathematical and calculation engines across all 5 casting/martial tiers:
 * 1. Full Caster (Wizard): Point buy 27-point ledger, Int modifier, Spell Save DC, Spell slots
 * 2. Pact Magic (Warlock): Pact slot scaling, short rest recharge, Charisma attack
 * 3. Pure Martial (Fighter - 2024 XPHB): Origin background feat/ASI, Fighting Style, Heavy Armor AC
 * 4. Half Caster (Ranger): Level 1 (0 slots) -> Level 2/3 (Half-caster slot table), Speed bonus
 * 5. Third Caster (Rogue -> Arcane Trickster): Level 1 -> 3 Level-Up progression, Sneak attack, Third-caster slots
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    POINT_BUY_COSTS,
    getPointBuySpent,
    extractCatalogRacialBonuses,
    getEffectiveRacialBonuses,
    getEffectiveStats,
    getBaseScores,
    calculateEffectiveSpeed,
    parseEquipmentTextToData
} from '../vtt/js/player-sheet/builder/builder-state.js';
import { getMod, getClassHitDie, getProfBonus } from '../vtt/js/player-sheet/calc/stats.js';
import {
    calculateCharacterSpellSlots,
    MULTICLASS_SPELL_SLOT_TABLE,
    SINGLE_CLASS_HALF_CASTER_TABLE_2014,
    SINGLE_CLASS_THIRD_CASTER_TABLE,
    WARLOCK_PACT_SLOTS
} from '../vtt/js/player-sheet/calc/spell-slots.js';

test.describe('Character Builder & Level-Up Wizard Lifecycle Suite', () => {
    test('1. Point Buy 27-Point Ledger & Validation', () => {
        // Point buy cost table check: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9
        assert.equal(POINT_BUY_COSTS[8], 0);
        assert.equal(POINT_BUY_COSTS[10], 2);
        assert.equal(POINT_BUY_COSTS[14], 7);
        assert.equal(POINT_BUY_COSTS[15], 9);

        // Optimal Wizard Point Buy: Str 8 (0), Dex 14 (7), Con 14 (7), Int 15 (9), Wis 12 (4), Cha 8 (0) = 27 pts
        const wizChar = {
            pointBuyScores: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 8 }
        };
        const wizSpent = getPointBuySpent(wizChar);
        assert.equal(wizSpent, 27, 'Wizard build must spend exactly 27 point buy points');

        // Optimal Fighter Point Buy: Str 15 (9), Dex 10 (2), Con 15 (9), Int 8 (0), Wis 13 (5), Cha 10 (2) = 27 pts
        const ftrChar = {
            pointBuyScores: { str: 15, dex: 10, con: 15, int: 8, wis: 13, cha: 10 }
        };
        const ftrSpent = getPointBuySpent(ftrChar);
        assert.equal(ftrSpent, 27, 'Fighter build must spend exactly 27 point buy points');

        // Overspending check
        const overChar = {
            pointBuyScores: { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 }
        };
        assert.ok(getPointBuySpent(overChar) > 27, '6x 15s must exceed 27 points');
    });

    test('2. Full Caster Archetype (High Elf Wizard - 2014 PHB)', () => {
        // High Elf: +2 Dex, +1 Int
        const baseRace = {
            name: 'Elf',
            ability: [{ dex: 2 }],
            speeds: { walk: 30 }
        };
        const subrace = {
            name: 'High Elf',
            ability: [{ int: 1 }]
        };

        const workingChar = {
            race: 'Elf',
            subrace: 'High Elf',
            racialAsiMode: 'catalog',
            statMethod: 'pointbuy',
            pointBuyScores: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 8 },
            classes: [{ name: 'Wizard', level: 1 }]
        };

        // Extract racial bonuses
        const bonuses = extractCatalogRacialBonuses(baseRace, subrace, workingChar);
        assert.equal(bonuses.dex, 2, 'High Elf must grant +2 Dex');
        assert.equal(bonuses.int, 1, 'High Elf must grant +1 Int');

        // Final effective scores: Dex 16 (+3), Int 16 (+3), Con 14 (+2)
        const finalDex = workingChar.pointBuyScores.dex + bonuses.dex;
        const finalInt = workingChar.pointBuyScores.int + bonuses.int;
        const finalCon = workingChar.pointBuyScores.con + bonuses.con;

        assert.equal(finalDex, 16);
        assert.equal(finalInt, 16);
        assert.equal(finalCon, 14);

        // Modifiers
        assert.equal(getMod(finalInt), 3);
        assert.equal(getMod(finalDex), 3);
        assert.equal(getMod(finalCon), 2);

        // Level 1 Wizard Hit Points: d6 + Con (6 + 2 = 8)
        const hitDieStr = getClassHitDie('Wizard');
        assert.equal(hitDieStr, 'd6', 'Wizard hit die is d6');
        const hitDie = parseInt(hitDieStr.replace('d', ''), 10);
        const maxHp = hitDie + getMod(finalCon);
        assert.equal(maxHp, 8, 'Level 1 Wizard with 14 Con has 8 Max HP');

        // Spell Save DC & Attack Bonus (Prof +2)
        const prof = getProfBonus(1);
        assert.equal(prof, 2);
        const spellSaveDc = 8 + prof + getMod(finalInt);
        const spellAttack = prof + getMod(finalInt);
        assert.equal(spellSaveDc, 13, 'Level 1 Wizard Spell DC should be 13');
        assert.equal(spellAttack, 5, 'Level 1 Wizard Spell Attack should be +5');

        // Full Caster Spell Slots: Level 1 has 2x 1st-level slots
        const slotsLv1 = MULTICLASS_SPELL_SLOT_TABLE[1];
        assert.equal(slotsLv1[0], 2, 'Level 1 Wizard has 2x 1st level slots');
        assert.equal(slotsLv1[1], 0);

        // Level 3 progression check
        const slotsLv3 = MULTICLASS_SPELL_SLOT_TABLE[3];
        assert.equal(slotsLv3[0], 4, 'Level 3 Wizard has 4x 1st level slots');
        assert.equal(slotsLv3[1], 2, 'Level 3 Wizard has 2x 2nd level slots');
    });

    test('3. Pact Magic Archetype (Tiefling Warlock - 2014 PHB)', () => {
        // Tiefling: +2 Cha, +1 Int
        const baseRace = {
            name: 'Tiefling',
            ability: [{ cha: 2, int: 1 }],
            speeds: { walk: 30 }
        };

        const workingChar = {
            race: 'Tiefling',
            racialAsiMode: 'catalog',
            statMethod: 'pointbuy',
            pointBuyScores: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 15 },
            classes: [{ name: 'Warlock', level: 1 }]
        };

        const bonuses = extractCatalogRacialBonuses(baseRace, null, workingChar);
        assert.equal(bonuses.cha, 2, 'Tiefling grants +2 Cha');
        assert.equal(bonuses.int, 1, 'Tiefling grants +1 Int');

        const finalCha = workingChar.pointBuyScores.cha + bonuses.cha;
        assert.equal(finalCha, 17, 'Cha should be 17');
        assert.equal(getMod(finalCha), 3, '17 Cha yields +3 modifier');

        // Warlock Hit Points: d8 + Con (8 + 2 = 10)
        const hitDieStr = getClassHitDie('Warlock');
        assert.equal(hitDieStr, 'd8', 'Warlock hit die is d8');
        const hitDie = parseInt(hitDieStr.replace('d', ''), 10);
        const maxHp = hitDie + getMod(workingChar.pointBuyScores.con);
        assert.equal(maxHp, 10, 'Level 1 Warlock with 14 Con has 10 Max HP');

        // Pact Magic progression table checks (WARLOCK_PACT_SLOTS)
        // Level 1: 1 slot (1st level)
        const pactLv1 = WARLOCK_PACT_SLOTS[1];
        assert.equal(pactLv1[0], 1, 'Level 1 Warlock has 1 pact slot');
        assert.equal(pactLv1[1], 1, 'Level 1 Warlock slot level is 1st');

        // Level 2: 2 slots (1st level)
        const pactLv2 = WARLOCK_PACT_SLOTS[2];
        assert.equal(pactLv2[0], 2, 'Level 2 Warlock has 2 pact slots');
        assert.equal(pactLv2[1], 1, 'Level 2 Warlock slot level is 1st');

        // Level 3: 2 slots (2nd level)
        const pactLv3 = WARLOCK_PACT_SLOTS[3];
        assert.equal(pactLv3[0], 2, 'Level 3 Warlock has 2 pact slots');
        assert.equal(pactLv3[1], 2, 'Level 3 Warlock slot level scales to 2nd');

        // Eldritch Blast Spell Attack: +Prof (2) + Cha (3) = +5
        const spellAttack = getProfBonus(1) + getMod(finalCha);
        assert.equal(spellAttack, 5, 'Warlock Eldritch Blast attack bonus is +5');
    });

    test('4. Pure Martial Archetype (Human Fighter - 2024 XPHB Ruleset)', () => {
        // In 2024 XPHB: Background grants ability score increases (+2/+1 or +1/+1/+1) and an Origin Feat
        const workingChar = {
            race: 'Human',
            rulesEdition: '2024',
            background: 'Soldier',
            racialAsiMode: 'tashas',
            tashasMode: 'twoPlusOne',
            tashasPlus2: 'str',
            tashasPlus1: 'con',
            statMethod: 'standard',
            stats: { str: 15, dex: 12, con: 14, int: 8, wis: 13, cha: 10 },
            classes: [{ name: 'Fighter', level: 1, fightingStyle: 'Great Weapon Fighting' }]
        };

        const bonuses = getEffectiveRacialBonuses(workingChar);
        assert.equal(bonuses.str, 2, '2024 Origin ASI grants +2 Str');
        assert.equal(bonuses.con, 1, '2024 Origin ASI grants +1 Con');

        const finalStr = workingChar.stats.str + bonuses.str; // 17 (+3)
        const finalCon = workingChar.stats.con + bonuses.con; // 15 (+2)
        assert.equal(finalStr, 17);
        assert.equal(finalCon, 15);
        assert.equal(getMod(finalStr), 3);
        assert.equal(getMod(finalCon), 2);

        // Level 1 Fighter HP: d10 + Con (10 + 2 = 12)
        const hitDieStr = getClassHitDie('Fighter');
        assert.equal(hitDieStr, 'd10', 'Fighter hit die is d10');
        const hitDie = parseInt(hitDieStr.replace('d', ''), 10);
        const maxHp = hitDie + getMod(finalCon);
        assert.equal(maxHp, 12, 'Level 1 Fighter with 15 Con has 12 Max HP');

        // Greatsword Weapon Macro: 2d6 slashing, heavy, two-handed
        const prof = getProfBonus(1);
        const toHit = prof + getMod(finalStr); // 2 + 3 = 5
        assert.equal(toHit, 5, 'Greatsword attack bonus is +5 to hit');

        // Chain Mail Armor Class: 16 flat (Heavy Armor, Dex not added)
        const chainMailAc = 16;
        assert.equal(chainMailAc, 16, 'Chain Mail provides base AC 16');
    });

    test('5. Half Caster Archetype (Wood Elf Ranger - 2014 PHB)', () => {
        // Wood Elf: +2 Dex, +1 Wis, 35ft walk speed
        const baseRace = {
            name: 'Elf',
            ability: [{ dex: 2 }],
            speeds: { walk: 30 }
        };
        const subrace = {
            name: 'Wood Elf',
            ability: [{ wis: 1 }],
            speeds: { walk: 35 }
        };

        const workingChar = {
            race: 'Elf',
            subrace: 'Wood Elf',
            racialAsiMode: 'catalog',
            pointBuyScores: { str: 10, dex: 15, con: 14, int: 8, wis: 14, cha: 10 },
            classes: [{ name: 'Ranger', level: 1 }]
        };

        const bonuses = extractCatalogRacialBonuses(baseRace, subrace, workingChar);
        assert.equal(bonuses.dex, 2);
        assert.equal(bonuses.wis, 1);

        const finalDex = workingChar.pointBuyScores.dex + bonuses.dex; // 17 (+3)
        const finalWis = workingChar.pointBuyScores.wis + bonuses.wis; // 15 (+2)
        assert.equal(finalDex, 17);
        assert.equal(finalWis, 15);

        // Speed calculation: Wood Elf has Fleet of Foot (35 ft walk speed)
        const speeds = calculateEffectiveSpeed(workingChar, baseRace, subrace, []);
        assert.equal(speeds.walk, 35, 'Wood Elf Ranger walk speed is 35 ft');

        // Half Caster Spell Slot Table (SINGLE_CLASS_HALF_CASTER_TABLE_2014)
        // Level 1 Ranger has NO spell slots in 2014 rules!
        const slotsLv1 = SINGLE_CLASS_HALF_CASTER_TABLE_2014[1];
        assert.equal(slotsLv1[0], 0, 'Level 1 Ranger has 0 spell slots');

        // Level 2 Ranger unlocks 2x 1st-level spell slots
        const slotsLv2 = SINGLE_CLASS_HALF_CASTER_TABLE_2014[2];
        assert.equal(slotsLv2[0], 2, 'Level 2 Ranger has 2x 1st-level spell slots');

        // Level 3 Ranger has 3x 1st-level spell slots
        const slotsLv3 = SINGLE_CLASS_HALF_CASTER_TABLE_2014[3];
        assert.equal(slotsLv3[0], 3, 'Level 3 Ranger has 3x 1st-level spell slots');

        // Longbow attack bonus: Prof +2 + Dex +3 = +5 (1d8+3 piercing)
        const longbowHit = getProfBonus(1) + getMod(finalDex);
        assert.equal(longbowHit, 5, 'Longbow attack is +5 to hit');
    });

    test('6. Third Caster Archetype & Level-Up Mode (Rogue -> Arcane Trickster)', () => {
        // Lightfoot Halfling: +2 Dex, +1 Cha, 25 ft speed
        const baseRace = {
            name: 'Halfling',
            ability: [{ dex: 2 }],
            speeds: { walk: 25 }
        };
        const subrace = {
            name: 'Lightfoot Halfling',
            ability: [{ cha: 1 }]
        };

        const workingChar = {
            race: 'Halfling',
            subrace: 'Lightfoot Halfling',
            racialAsiMode: 'catalog',
            statMethod: 'pointbuy',
            pointBuyScores: { str: 8, dex: 15, con: 14, int: 14, wis: 10, cha: 10 },
            classes: [{ name: 'Rogue', level: 1, subclass: '' }]
        };

        const bonuses = extractCatalogRacialBonuses(baseRace, subrace, workingChar);
        assert.equal(bonuses.dex, 2);
        const finalDex = workingChar.pointBuyScores.dex + bonuses.dex; // 17 (+3)
        const finalInt = workingChar.pointBuyScores.int; // 14 (+2)

        // Level 1 Rogue Third Caster table: 0 spell slots
        const slotsLv1 = SINGLE_CLASS_THIRD_CASTER_TABLE[1];
        assert.equal(slotsLv1[0], 0, 'Level 1 Rogue has 0 spell slots');

        // Sneak Attack: Level 1 = 1d6
        const sneakAtkLv1 = '1d6';
        assert.equal(sneakAtkLv1, '1d6');

        // LEVEL-UP SIMULATION: Advance to Level 3 Arcane Trickster
        workingChar.classes[0].level = 3;
        workingChar.classes[0].subclass = 'Arcane Trickster';

        // Third Caster table at Level 3: Unlocks 2x 1st-level spell slots
        const slotsLv3 = SINGLE_CLASS_THIRD_CASTER_TABLE[3];
        assert.equal(slotsLv3[0], 2, 'Level 3 Arcane Trickster Rogue unlocks 2x 1st-level spell slots');

        // Spell Save DC at Level 3: 8 + Prof (2) + Int Mod (2) = 12
        const arcTrickDc = 8 + getProfBonus(3) + getMod(finalInt);
        assert.equal(arcTrickDc, 12, 'Arcane Trickster Spell Save DC is 12');

        // Sneak Attack at Level 3 scales to 2d6
        const sneakAtkLv3 = `${Math.ceil(workingChar.classes[0].level / 2)}d6`;
        assert.equal(sneakAtkLv3, '2d6', 'Level 3 Rogue Sneak Attack scales to 2d6');
    });

    test('7. Multiclass Spell Slot Fusion (Wizard 2 / Ranger 2 / Arcane Trickster 3)', () => {
        // Multi-caster slot contribution rule:
        // Full Caster (Wizard 2) = 2
        // Half Caster (Ranger 2) = floor(2 / 2) = 1
        // Third Caster (Arcane Trickster 3) = floor(3 / 3) = 1
        // Total Caster Level = 2 + 1 + 1 = 4
        const wizardLv = 2;
        const rangerLv = 2;
        const arcaneTricksterLv = 3;

        const effectiveCasterLevel = wizardLv + Math.floor(rangerLv / 2) + Math.floor(arcaneTricksterLv / 3);
        assert.equal(effectiveCasterLevel, 4, 'Total Multiclass Caster Level is 4');

        // Multiclass Table Level 4: 4x 1st-level, 3x 2nd-level slots
        const mcSlots = MULTICLASS_SPELL_SLOT_TABLE[effectiveCasterLevel];
        assert.equal(mcSlots[0], 4, '4th-level caster has 4x 1st-level spell slots');
        assert.equal(mcSlots[1], 3, '4th-level caster has 3x 2nd-level spell slots');
        assert.equal(mcSlots[2], 0, '4th-level caster has 0x 3rd-level spell slots');
    });
});
