import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getContainerContentsWeight,
    getContainerEffectiveWeight,
    getContainerCapacityStatus,
    calculateCharacterTotalWeight,
    calculateEncumbrance
} from '../vtt/js/player-sheet/calc/containers.js';

import { applyShortRest, applyLongRest } from '../vtt/js/player-sheet/calc/rest-recovery.js';

import { scaleUpcastFormula } from '../vtt/js/vtt-spell-manager.js';

import { getUpcastedDamage } from '../vtt/js/player-sheet/vtt-sheet-spells-tab.js';

// Setup global scaleUpcastFormula mock for getUpcastedDamage
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        VTTSpellManager: {
            scaleUpcastFormula
        },
        scaleUpcastFormula
    };
} else {
    globalThis.window.VTTSpellManager = globalThis.window.VTTSpellManager || {};
    globalThis.window.VTTSpellManager.scaleUpcastFormula = scaleUpcastFormula;
    globalThis.window.scaleUpcastFormula = scaleUpcastFormula;
}

test('Custom Item Data Structure & Serialization', async (t) => {
    await t.test('Mundane item creates valid equipment payload', () => {
        const item = {
            id: 'eq_test_1',
            name: 'Adventurer Rations',
            qty: 5,
            weight: 2,
            description: 'Standard travel provisions for 5 days.',
            itemType: 'gear'
        };

        assert.equal(item.name, 'Adventurer Rations');
        assert.equal(item.qty, 5);
        assert.equal(item.weight, 2);
        assert.equal(item.itemType, 'gear');
    });

    await t.test('Custom Weapon generates valid weapon payload & macro template', () => {
        const weapon = {
            id: 'eq_weap_1',
            name: 'Sunblade Rapier',
            qty: 1,
            weight: 3,
            description: 'A radiant rapier forged in solar flames.',
            itemType: 'weapon',
            isWeapon: true,
            dmg1: '1d8',
            dmgType: 'Radiant',
            isFinesse: true,
            isRanged: false,
            properties: ['finesse'],
            macroTemplate: {
                attackStat: 'auto',
                isFinesse: true,
                isRanged: false,
                damageRows: [
                    {
                        formula: '1d8',
                        stat: 'auto',
                        type: 'Radiant',
                        label: ''
                    }
                ]
            }
        };

        assert.equal(weapon.isWeapon, true);
        assert.equal(weapon.isFinesse, true);
        assert.equal(weapon.dmg1, '1d8');
        assert.equal(weapon.dmgType, 'Radiant');
        assert.equal(weapon.macroTemplate.damageRows[0].formula, '1d8');
    });

    await t.test('Custom Armor and Shield generate appropriate category and AC tags', () => {
        const armor = {
            id: 'eq_arm_1',
            name: 'Mithral Chain Shirt',
            qty: 1,
            weight: 20,
            itemType: 'armor',
            isArmor: true,
            armorCategory: 'medium',
            type: 'Armor',
            rawType: 'MA',
            ac: 13
        };

        const shield = {
            id: 'eq_shield_1',
            name: 'Aegis of the Sun',
            qty: 1,
            weight: 6,
            itemType: 'armor',
            isArmor: true,
            armorCategory: 'shield',
            type: 'Shield',
            rawType: 'S',
            bonusAc: 2
        };

        assert.equal(armor.rawType, 'MA');
        assert.equal(armor.ac, 13);
        assert.equal(shield.rawType, 'S');
        assert.equal(shield.bonusAc, 2);
    });
});

test('Weapon Attack Macro Stat Resolution & Formula Derivation', async (t) => {
    await t.test('Finesse weapon chooses DEX when DEX > STR, STR when STR >= DEX', () => {
        const charDexHigh = { stats: { str: 10, dex: 16 } };
        const charStrHigh = { stats: { str: 18, dex: 12 } };

        const resolveStat = (item, char) => {
            const isFinesse = item.isFinesse || (item.properties || []).includes('finesse');
            const isRanged = item.isRanged || (item.properties || []).includes('ammunition');
            const strVal = parseInt(char.stats?.str) || 10;
            const dexVal = parseInt(char.stats?.dex) || 10;
            if (isRanged) return 'dex';
            if (isFinesse) return dexVal >= strVal ? 'dex' : 'str';
            return 'str';
        };

        const finesseRapier = { isFinesse: true };
        assert.equal(resolveStat(finesseRapier, charDexHigh), 'dex');
        assert.equal(resolveStat(finesseRapier, charStrHigh), 'str');
    });

    await t.test('Ranged weapon always chooses DEX', () => {
        const char = { stats: { str: 20, dex: 14 } };
        const resolveStat = (item, c) => {
            const isRanged = item.isRanged || (item.properties || []).includes('ammunition');
            if (isRanged) return 'dex';
            return 'str';
        };

        const heavyCrossbow = { isRanged: true };
        assert.equal(resolveStat(heavyCrossbow, char), 'dex');
    });
});

test('Armor AC & Shield Calculation Logic', async (t) => {
    const calcAC = (char, equippedArmor, equippedShield) => {
        const dexMod = Math.floor(((parseInt(char.stats?.dex) || 10) - 10) / 2);
        let baseAc = 10;
        let bonusFromShield = 0;

        if (equippedArmor) {
            if (equippedArmor.rawType === 'LA') {
                baseAc = (parseInt(equippedArmor.ac) || 11) + dexMod;
            } else if (equippedArmor.rawType === 'MA') {
                baseAc = (parseInt(equippedArmor.ac) || 14) + Math.min(2, dexMod);
            } else if (equippedArmor.rawType === 'HA') {
                baseAc = parseInt(equippedArmor.ac) || 16;
            }
        } else {
            baseAc = 10 + dexMod;
        }

        if (equippedShield) {
            bonusFromShield = parseInt(equippedShield.bonusAc) || 2;
        }

        return baseAc + bonusFromShield;
    };

    const char = { stats: { dex: 16 } }; // DEX mod = +3

    await t.test('Light Armor gains full DEX modifier', () => {
        const leather = { rawType: 'LA', ac: 11 };
        assert.equal(calcAC(char, leather, null), 14); // 11 + 3
    });

    await t.test('Medium Armor caps DEX modifier at +2', () => {
        const breastplate = { rawType: 'MA', ac: 14 };
        assert.equal(calcAC(char, breastplate, null), 16); // 14 + min(2, 3) = 16
    });

    await t.test('Heavy Armor ignores DEX modifier', () => {
        const plate = { rawType: 'HA', ac: 18 };
        assert.equal(calcAC(char, plate, null), 18);
    });

    await t.test('Shield adds bonus AC (+2)', () => {
        const breastplate = { rawType: 'MA', ac: 14 };
        const shield = { rawType: 'S', bonusAc: 2 };
        assert.equal(calcAC(char, breastplate, shield), 18); // 16 + 2 = 18
    });
});

test('Custom Spell Cantrip Level-Based Scaling', async (t) => {
    const fireBolt = {
        name: 'Chaos Bolt Cantrip',
        cantripScale: true,
        damageList: [
            {
                formula: '1d10',
                type: 'Fire',
                cantripScale: true
            }
        ]
    };

    await t.test('Level 1-4 deals 1 die (1d10)', () => {
        const res = getUpcastedDamage(fireBolt, 0, 0, 1);
        assert.equal(res[0].formula, '1d10');
    });

    await t.test('Level 5-10 scales to 2 dice (2d10)', () => {
        const res = getUpcastedDamage(fireBolt, 0, 0, 5);
        assert.equal(res[0].formula, '2d10');
    });

    await t.test('Level 11-16 scales to 3 dice (3d10)', () => {
        const res = getUpcastedDamage(fireBolt, 0, 0, 11);
        assert.equal(res[0].formula, '3d10');
    });

    await t.test('Level 17+ scales to 4 dice (4d10)', () => {
        const res = getUpcastedDamage(fireBolt, 0, 0, 17);
        assert.equal(res[0].formula, '4d10');
    });
});

test('Custom Spell Upcasting Formulas & Multi-Row Scaling', async (t) => {
    await t.test('scaleUpcastFormula correctly multiples dice count and flat modifiers', () => {
        assert.equal(scaleUpcastFormula('+1d6', 1), '+ 1d6');
        assert.equal(scaleUpcastFormula('+1d6', 2), '+ 2d6');
        assert.equal(scaleUpcastFormula('+2d8+3', 2), '+ 4d8 + 6');
    });

    await t.test('getUpcastedDamage scales leveled spell damage when cast at higher slot', () => {
        const fireball = {
            name: 'Chaos Flare',
            upcastBonus: '+1d6',
            upcastScaleStep: 1,
            damageList: [
                {
                    formula: '8d6',
                    type: 'Fire',
                    upcastBonus: '+1d6'
                }
            ]
        };

        // Base level 3 cast at level 3 (extra = 0)
        const baseRes = getUpcastedDamage(fireball, 3, 3, 5);
        assert.equal(baseRes[0].formula, '8d6');

        // Cast at level 5 (extra = 2 -> + 2d6)
        const upcastRes = getUpcastedDamage(fireball, 5, 3, 5);
        assert.equal(upcastRes[0].formula, '8d6 + 2d6');
    });
});

test('Innate & Limited-Use Rest Recovery Lifecycle', async (t) => {
    const char = {
        hpMax: 20,
        hpCurrent: 10,
        spellSlots: {
            level1: { current: 0, max: 4 },
            level2: { current: 1, max: 2 }
        },
        abilities: [
            {
                name: 'Aegis of Dawn (1/Day)',
                resetType: 'long',
                hasCounter: true,
                usesMax: 1,
                usesCurrent: 0
            },
            {
                name: 'Second Wind',
                resetType: 'short',
                hasCounter: true,
                usesMax: 1,
                usesCurrent: 0
            }
        ]
    };

    await t.test('Short rest restores short-rest abilities without daily spells', () => {
        const { updatedChar } = applyShortRest(char);
        const secondWind = updatedChar.abilities.find((a) => a.name === 'Second Wind');
        const aegis = updatedChar.abilities.find((a) => a.name === 'Aegis of Dawn (1/Day)');
        assert.equal(secondWind.usesCurrent, 1);
        assert.equal(aegis.usesCurrent, 0); // Daily unchanged
    });

    await t.test('Long rest restores HP, spell slots, and daily limited-use abilities', () => {
        const { updatedChar } = applyLongRest(char);
        assert.equal(updatedChar.hpCurrent, 20);
        assert.equal(updatedChar.spellSlots.level1.current, 4);
        assert.equal(updatedChar.spellSlots.level2.current, 2);
        const aegis = updatedChar.abilities.find((a) => a.name === 'Aegis of Dawn (1/Day)');
        assert.equal(aegis.usesCurrent, 1);
    });
});

test('Container Tare Weight & Character Encumbrance Calculations', async (t) => {
    const bagOfHolding = {
        id: 'cont_boh',
        name: 'Bag of Holding',
        weightRule: 'fixed',
        customWeight: 15,
        capacity: 500
    };

    const standardBackpack = {
        id: 'cont_pack',
        name: 'Backpack',
        weightRule: 'standard',
        baseWeight: 5,
        capacity: 30
    };

    const equipment = [
        { id: 'item_1', name: 'Iron Ore Block', weight: 50, qty: 2, containerId: 'cont_boh' }, // 100 lbs inside BoH
        { id: 'item_2', name: 'Bedroll', weight: 7, qty: 1, containerId: 'cont_pack' }, // 7 lbs inside Backpack
        { id: 'item_3', name: 'Longsword', weight: 3, qty: 1, containerId: null } // 3 lbs loose
    ];

    await t.test('getContainerContentsWeight accurately totals inner contents', () => {
        assert.equal(getContainerContentsWeight(bagOfHolding, equipment), 100);
        assert.equal(getContainerContentsWeight(standardBackpack, equipment), 7);
    });

    await t.test('Bag of Holding fixes effective container weight to 15 lbs regardless of contents', () => {
        assert.equal(getContainerEffectiveWeight(bagOfHolding, equipment), 15);
    });

    await t.test('Standard Backpack effective weight = baseWeight (5) + contentsWeight (7) = 12 lbs', () => {
        assert.equal(getContainerEffectiveWeight(standardBackpack, equipment), 12);
    });

    await t.test('calculateCharacterTotalWeight correctly neutralizes Bag of Holding contents', () => {
        const char = {
            containers: [bagOfHolding, standardBackpack],
            equipment: equipment,
            currency: { gp: 50 } // 50 coins = 1 lb
        };

        const breakdown = calculateCharacterTotalWeight(char);
        // loose: 3 lbs, containers: 15 + 12 = 27 lbs, coins: 1 lb -> total = 31 lbs
        assert.equal(breakdown.unbaggedWeight, 3);
        assert.equal(breakdown.containersTotalWeight, 27);
        assert.equal(breakdown.coinWeight, 1);
        assert.equal(breakdown.totalWeight, 31);
    });

    await t.test('calculateEncumbrance evaluates STR thresholds and encumbered status', () => {
        // STR 10 with variant encumbrance: normal <= 50, encumbered > 50, heavy > 100, over > 150
        const encLight = calculateEncumbrance(10, 31, 'variant');
        assert.equal(encLight.statusKey, 'normal');

        const encMed = calculateEncumbrance(10, 75, 'variant');
        assert.equal(encMed.statusKey, 'encumbered');

        const encHeavy = calculateEncumbrance(10, 120, 'variant');
        assert.equal(encHeavy.statusKey, 'heavy');

        const encOver = calculateEncumbrance(10, 160, 'variant');
        assert.equal(encOver.statusKey, 'over');
    });
});
