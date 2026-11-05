import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveTokenAC,
    processCardFullResolution,
    executeMassAttackResolution
} from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

test('Mass Attack & Single Action Resolution: AC Evaluation and Group Distribution', async (t) => {
    await t.test('resolveTokenAC correctly resolves AC from monsterData, characters, and direct property', () => {
        // Direct AC
        assert.equal(resolveTokenAC({ id: 't1', ac: 16 }), 16);

        // Monster primaryAc string
        assert.equal(resolveTokenAC({ id: 't2', monsterData: { primaryAc: '18 (plate)' } }), 18);

        // Monster ac number
        assert.equal(resolveTokenAC({ id: 't3', monsterData: { ac: 15 } }), 15);

        // Monster ac array
        assert.equal(resolveTokenAC({ id: 't4', monsterData: { ac: [{ ac: 17 }] } }), 17);

        // Player character from campaignState
        const mockVtt = {
            campaignState: {
                characters: {
                    'char_paladin': { id: 'char_paladin', ac: 19 }
                }
            }
        };
        assert.equal(resolveTokenAC({ id: 't5', characterId: 'char_paladin' }, { vtt: mockVtt }), 19);

        // Player character from campaignState (sourceCharacterId fallback)
        const mockVtt2 = {
            campaignState: {
                characters: {
                    'char_companion': { id: 'char_companion', ac: 16 }
                }
            }
        };
        assert.equal(resolveTokenAC({ id: 't5b', sourceCharacterId: 'char_companion' }, { vtt: mockVtt2 }), 16);

        // Fallback default
        assert.equal(resolveTokenAC({ id: 't6' }), 10);
    });

    await t.test('processCardFullResolution evaluates attack roll against target AC (miss deals 0 damage, hit deals damage)', () => {
        const tokens = {
            'knight': {
                id: 'knight',
                name: 'Knight',
                hp: 30,
                maxHp: 30,
                monsterData: { ac: 18 }
            },
            'goblin': {
                id: 'goblin',
                name: 'Goblin',
                hp: 15,
                maxHp: 15,
                monsterData: { ac: 12 }
            }
        };

        // Attack roll = 15. Should hit Goblin (AC 12) and miss Knight (AC 18).
        const cardData = {
            atkRoll: {
                total: 15,
                isCritSuccess: false,
                isCritFail: false,
                formula: '1d20+5'
            },
            dmgRolls: [
                {
                    type: 'slashing',
                    formula: '1d8+3',
                    roll: { total: 8 }
                }
            ]
        };

        processCardFullResolution(cardData, ['knight', 'goblin'], {
            tokens,
            syncTokensHpToCharacters: () => {},
            renderAll: () => {}
        });

        assert.equal(tokens['knight'].hp, 30, 'Knight with AC 18 should not take damage from an attack roll of 15');
        assert.equal(tokens['goblin'].hp, 7, 'Goblin with AC 12 should take 8 damage from an attack roll of 15');
    });

    await t.test('processCardFullResolution with all misses deals 0 damage', () => {
        const tokens = {
            'knight': {
                id: 'knight',
                name: 'Knight',
                hp: 30,
                maxHp: 30,
                monsterData: { ac: 18 }
            }
        };

        const cardData = {
            atkRoll: {
                total: 11,
                isCritSuccess: false,
                isCritFail: false,
                formula: '1d20+3'
            },
            dmgRolls: [
                {
                    type: 'bludgeoning',
                    roll: { total: 10 }
                }
            ]
        };

        processCardFullResolution(cardData, ['knight'], {
            tokens,
            syncTokensHpToCharacters: () => {},
            renderAll: () => {}
        });

        assert.equal(tokens['knight'].hp, 30, 'Knight should take 0 damage on a miss');
    });

    await t.test('executeMassAttackResolution with "attacks_equal" distributes attacks evenly and checks AC', () => {
        const tokens = {
            'target_a': { id: 'target_a', name: 'Target A', hp: 40, maxHp: 40, monsterData: { ac: 10 } },
            'target_b': { id: 'target_b', name: 'Target B', hp: 40, maxHp: 40, monsterData: { ac: 20 } }
        };

        const massAttackCard = {
            attacks: [
                // Attack 0 -> target_a (AC 10). Roll 12 -> Hit! 10 damage.
                {
                    index: 0,
                    atkRoll: { total: 12, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 10 } }]
                },
                // Attack 1 -> target_b (AC 20). Roll 14 -> Miss! (14 < 20). 10 damage.
                {
                    index: 1,
                    atkRoll: { total: 14, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 10 } }]
                },
                // Attack 2 -> target_a (AC 10). Roll 15 -> Hit! 6 damage.
                {
                    index: 2,
                    atkRoll: { total: 15, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 6 } }]
                },
                // Attack 3 -> target_b (AC 20). Roll 22 -> Hit! (22 >= 20). 8 damage.
                {
                    index: 3,
                    atkRoll: { total: 22, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 8 } }]
                }
            ]
        };

        executeMassAttackResolution(massAttackCard, 'attacks_equal', 'msg_1', {
            tokens,
            targetTokenIds: ['target_a', 'target_b'],
            syncTokensHpToCharacters: () => {},
            renderAll: () => {}
        });

        // target_a took attack 0 (10 dmg) + attack 2 (6 dmg) = 16 damage -> HP 24
        assert.equal(tokens['target_a'].hp, 24);
        // target_b missed attack 1 (0 dmg), hit attack 3 (8 dmg) = 8 damage -> HP 32
        assert.equal(tokens['target_b'].hp, 32);

        assert.equal(massAttackCard.summary.hitsCount, 3);
        assert.equal(massAttackCard.summary.totalDamageDealt, 24);
    });

    await t.test('executeMassAttackResolution with "damage_equal" pools hit damage and divides equally preserving damage types and resistances', () => {
        const tokens = {
            'fire_resistant_tok': {
                id: 'fire_resistant_tok',
                name: 'Tiefling',
                hp: 50,
                maxHp: 50,
                ac: 12,
                monsterData: { ac: 12, resist: ['fire'] }
            },
            'normal_tok': {
                id: 'normal_tok',
                name: 'Human',
                hp: 50,
                maxHp: 50,
                ac: 12,
                monsterData: { ac: 12 }
            }
        };

        const massAttackCard = {
            attacks: [
                // Hit: 20 fire damage
                {
                    index: 0,
                    atkRoll: { total: 18, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'fire', roll: { total: 20 } }]
                },
                // Hit: 20 slashing damage
                {
                    index: 1,
                    atkRoll: { total: 16, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'slashing', roll: { total: 20 } }]
                }
            ]
        };

        executeMassAttackResolution(massAttackCard, 'damage_equal', 'msg_2', {
            tokens,
            targetTokenIds: ['fire_resistant_tok', 'normal_tok'],
            syncTokensHpToCharacters: () => {},
            renderAll: () => {}
        });

        // Total fire damage = 20 -> 10 fire per target
        // Total slashing damage = 20 -> 10 slashing per target
        // normal_tok takes 10 fire + 10 slashing = 20 damage -> HP 30
        assert.equal(tokens['normal_tok'].hp, 30);
        // fire_resistant_tok takes floor(10 * 0.5) = 5 fire + 10 slashing = 15 damage -> HP 35
        assert.equal(tokens['fire_resistant_tok'].hp, 35);
    });

    await t.test('executeMassAttackResolution with "damage_random" assigns each hitting attack package to a random target', () => {
        const tokens = {
            't1': { id: 't1', name: 'T1', hp: 100, maxHp: 100, ac: 10, monsterData: { ac: 10 } },
            't2': { id: 't2', name: 'T2', hp: 100, maxHp: 100, ac: 10, monsterData: { ac: 10 } }
        };

        const massAttackCard = {
            attacks: [
                {
                    index: 0,
                    atkRoll: { total: 15, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'acid', roll: { total: 25 } }]
                },
                {
                    index: 1,
                    atkRoll: { total: 15, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'acid', roll: { total: 15 } }]
                }
            ]
        };

        executeMassAttackResolution(massAttackCard, 'damage_random', 'msg_3', {
            tokens,
            targetTokenIds: ['t1', 't2'],
            syncTokensHpToCharacters: () => {},
            renderAll: () => {}
        });

        const totalRemaining = tokens['t1'].hp + tokens['t2'].hp;
        // Total dealt = 25 + 15 = 40. Total HP should be 200 - 40 = 160.
        assert.equal(totalRemaining, 160);
        assert.equal(massAttackCard.summary.hitsCount, 2);
        assert.equal(massAttackCard.summary.totalDamageDealt, 40);
    });
});
