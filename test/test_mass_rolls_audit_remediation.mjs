import test from 'node:test';
import assert from 'node:assert/strict';

import {
    _hasResistanceType,
    resolveTokenAC,
    executeMassAttackResolution,
    applyDamageToTokens,
    applyCardDamageToToken,
    promptCustomModifierModal,
    promptQuickSplitModal,
    clusterTokensByProximity
} from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

import { resolveSaveFromChat } from '../vtt/js/canvas/tokens/vtt-canvas-token-rollers.js';
import { executeMassRolls } from '../vtt/js/creature-sheet/creature-roller.js';
import { getTokenAC } from '../vtt/js/canvas/vtt-canvas-tooltips-notes.js';

test('Mass Rolls Audit Remediation: Combat Math, Defenses, and Pipeline Verification', async (t) => {
    await t.test('1. String-based defenses correctly resolve in _hasResistanceType', () => {
        const attackMeta = { isMagic: false };

        // Comma-separated string
        assert.equal(_hasResistanceType('fire, cold, poison', 'cold', attackMeta), true);
        assert.equal(_hasResistanceType('fire, cold, poison', 'fire', attackMeta), true);
        assert.equal(_hasResistanceType('fire, cold, poison', 'poison', attackMeta), true);
        assert.equal(_hasResistanceType('fire, cold, poison', 'acid', attackMeta), false);

        // Single string
        assert.equal(_hasResistanceType('slashing', 'slashing', attackMeta), true);
        // Single defense object (not wrapped in array)
        assert.equal(_hasResistanceType({ types: ['fire'] }, 'fire', attackMeta), true);
        assert.equal(_hasResistanceType({ resist: ['cold'] }, 'cold', attackMeta), true);
        assert.equal(_hasResistanceType('slashing', 'piercing', attackMeta), false);
    });

    await t.test('2. Player Character AC calculation incorporates baseAc, acMod, and active acToggles', () => {
        const mockVtt = {
            campaignState: {
                characters: {
                    pc_wizard: {
                        id: 'pc_wizard',
                        name: 'Mage',
                        ac: 12,
                        baseAc: 12,
                        acMod: 1, // Cover or general mod
                        acToggles: [
                            { name: 'Shield Spell', formula: '+5', enabled: true },
                            { name: 'Haste', formula: '+2', enabled: false }
                        ]
                    }
                }
            }
        };

        const token = {
            id: 'tok_wizard',
            characterId: 'pc_wizard',
            name: 'Mage'
        };

        // Base 12 + acMod 1 + Shield (+5) = 18
        const ac = resolveTokenAC(token, { vtt: mockVtt });
        assert.equal(ac, 18, 'resolveTokenAC must include acMod and active acToggles');

        const tooltipAc = getTokenAC(token, { campaignState: mockVtt.campaignState });
        assert.equal(tooltipAc, 18, 'getTokenAC must include acMod and active acToggles');
    });

    await t.test('3. executeMassRolls preserves weapon metadata (isMagic, isSilvered, isAdamantine, isSpell)', async () => {
        const emittedMessages = [];
        const mockCtx = {
            getVtt: () => ({
                username: 'GM',
                socket: {
                    emit(evt, data) {
                        emittedMessages.push({ evt, data });
                    }
                }
            }),
            getVisibilitySetting: () => 'public',
            getMonster: () => ({
                name: 'Solar',
                str: 26,
                dex: 22
            })
        };

        const preParsedMacro = {
            isAttack: true,
            attackBonus: 15,
            isMagic: true,
            isSpell: true,
            damages: [
                { formula: '4d6+8', type: 'Slashing', isMagic: true, isSpell: true },
                { formula: '6d8', type: 'Radiant', isMagic: true, isSpell: true }
            ]
        };

        executeMassRolls({
            count: 2,
            rollMode: 'normal',
            abilityName: 'Greatsword',
            rawEntries: [],
            abilityText: 'Melee Weapon Attack',
            charName: 'Solar',
            preParsedMacro,
            ctx: mockCtx
        });

        // executeMassRolls spaces out rolls with 150ms intervals
        await new Promise((resolve) => setTimeout(resolve, 450));

        // Last emitted message is the massAttackCard
        const massMsg = emittedMessages.find((m) => m.data?.massAttackCard);
        assert.ok(massMsg, 'massAttackCard message must be emitted');

        const card = massMsg.data.massAttackCard;
        assert.equal(card.attacks.length, 2);
        assert.equal(card.attacks[0].dmgRolls[0].isMagic, true, 'isMagic metadata must be preserved');
        assert.equal(card.attacks[0].dmgRolls[0].isSpell, true, 'isSpell metadata must be preserved');
        assert.equal(card.attacks[0].dmgRolls[1].isMagic, true, 'isMagic metadata must be preserved');
        assert.equal(card.attacks[0].dmgRolls[1].isSpell, true, 'isSpell metadata must be preserved');
    });

    await t.test('4. Full overkill damage is counted consistently across damage application paths', () => {
        const token1 = { id: 'tok_low_hp', hp: 3, maxHp: 10, tempHp: 0 };
        const tokens = { tok_low_hp: token1 };

        applyDamageToTokens(['tok_low_hp'], 25, 'slashing', 'full', {}, { tokens });

        assert.equal(token1.hp, 0, 'HP must be 0');

        const token2 = { id: 'tok_card_test', hp: 4, maxHp: 10, tempHp: 0 };
        const deducted = applyCardDamageToToken(token2, [{ formula: '30', roll: { total: 30 }, type: 'slashing' }]);

        assert.equal(token2.hp, 0, 'HP must be 0');
        assert.equal(deducted, 30, 'applyCardDamageToToken must count full overkill');
    });

    await t.test('5. damage_equal checks target-specific AC and distributes only among hit targets', () => {
        const tokens = {
            paladin_tok: {
                id: 'paladin_tok',
                name: 'Paladin',
                hp: 100,
                maxHp: 100,
                ac: 22,
                monsterData: { ac: 22 }
            },
            goblin_tok: {
                id: 'goblin_tok',
                name: 'Goblin',
                hp: 50,
                maxHp: 50,
                ac: 10,
                monsterData: { ac: 10 }
            }
        };

        const massAttackCard = {
            attacks: [
                // Attack 0: aimed at Paladin (index 0). Total 14 vs AC 22 -> MISS
                {
                    index: 0,
                    atkRoll: { total: 14, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 20 } }]
                },
                // Attack 1: aimed at Goblin (index 1). Total 14 vs AC 10 -> HIT
                {
                    index: 1,
                    atkRoll: { total: 14, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 20 } }]
                }
            ]
        };

        executeMassAttackResolution(massAttackCard, 'damage_equal', 'msg_test', {
            tokens,
            targetTokenIds: ['paladin_tok', 'goblin_tok'],
            syncTokensHpToCharacters: () => { },
            renderAll: () => { }
        });

        // Paladin was missed by the attack aimed at them, so Paladin must NOT take damage!
        assert.equal(tokens.paladin_tok.hp, 100, 'Paladin (missed) must retain 100 HP');
        // Goblin was hit, so Goblin receives the hitting damage
        assert.equal(tokens.goblin_tok.hp, 30, 'Goblin (hit) takes the damage');
        assert.equal(massAttackCard.attacks[0].resolution.hit, false);
        assert.equal(massAttackCard.attacks[1].resolution.hit, true);
    });

    await t.test('6. damage_random assigns attack to a target first, then evaluates against that target AC', () => {
        const tokens = {
            high_ac: { id: 'high_ac', name: 'HighAC', hp: 100, maxHp: 100, ac: 30, monsterData: { ac: 30 } }
        };

        const massAttackCard = {
            attacks: [
                {
                    index: 0,
                    atkRoll: { total: 15, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'fire', roll: { total: 25 } }]
                }
            ]
        };

        executeMassAttackResolution(massAttackCard, 'damage_random', 'msg_rnd', {
            tokens,
            targetTokenIds: ['high_ac'],
            syncTokensHpToCharacters: () => { },
            renderAll: () => { }
        });

        // Attack roll 15 against AC 30 must miss
        assert.equal(massAttackCard.attacks[0].resolution.hit, false);
        assert.equal(tokens.high_ac.hp, 100);
    });

    await t.test('7. resolveSaveFromChat deduplicates multi-hit tokens in affected arrays', () => {
        let syncedTokens = null;
        let emittedFxIds = null;

        const tokens = {
            tok_target: { id: 'tok_target', hp: 30, maxHp: 30, tempHp: 0 }
        };

        const mockVtt = {
            role: 'GM',
            socket: {
                emit(evt, data) {
                    if (evt === 'tokens:damage_fx') {
                        emittedFxIds = data.tokenIds;
                    }
                }
            }
        };

        const saveResolveCard = {
            cardData: {
                dmgRolls: [{ type: 'poison', roll: { total: 10 } }]
            },
            results: [
                { tokenId: 'tok_target', passed: false, dmgRolls: [{ type: 'poison', roll: { total: 10 } }] },
                { tokenId: 'tok_target', passed: false, dmgRolls: [{ type: 'poison', roll: { total: 10 } }] }
            ]
        };

        resolveSaveFromChat(saveResolveCard, false, 'msg_save_1', {
            vtt: mockVtt,
            tokens,
            applyCardDamageToToken: (t, rolls, mult) => {
                t.hp = Math.max(0, t.hp - 10);
                return 10;
            },
            syncTokensHpToCharacters: (list) => {
                syncedTokens = list;
            }
        });

        // Target took 10 + 10 = 20 damage -> 10 HP
        assert.equal(tokens.tok_target.hp, 10);
        // syncedTokens must contain 1 unique entry for tok_target, NOT 2 duplicates
        assert.equal(syncedTokens.length, 1, 'affectedTokens must be deduplicated');
        assert.equal(emittedFxIds.length, 1, 'emittedFx tokenIds must be deduplicated');
    });

    await t.test('8. promptCustomModifierModal and promptQuickSplitModal are exported functions', () => {
        assert.equal(typeof promptCustomModifierModal, 'function');
        assert.equal(typeof promptQuickSplitModal, 'function');
    });

    await t.test('9. damage_equal triggers save riders strictly for each hitting attack target without N x M duplication', async () => {
        const tokens = {
            tok_a: { id: 'tok_a', name: 'Target A', hp: 50, maxHp: 50, ac: 10, monsterData: { ac: 10 } },
            tok_b: { id: 'tok_b', name: 'Target B', hp: 50, maxHp: 50, ac: 10, monsterData: { ac: 10 } }
        };

        const massAttackCard = {
            attacks: [
                {
                    index: 1,
                    atkRoll: { total: 18, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 10 } }, { type: 'poison', roll: { total: 6 }, saveRider: true }],
                    saveInfo: { dc: 13, ability: 'CON' }
                },
                {
                    index: 2,
                    atkRoll: { total: 18, isCritSuccess: false, isCritFail: false },
                    dmgRolls: [{ type: 'piercing', roll: { total: 10 } }, { type: 'poison', roll: { total: 6 }, saveRider: true }],
                    saveInfo: { dc: 13, ability: 'CON' }
                }
            ]
        };

        let cardPosted = null;
        const mockSocket = {
            emit(evt, data) {
                if (data?.saveResolveCard) {
                    cardPosted = data.saveResolveCard;
                }
            }
        };

        executeMassAttackResolution(massAttackCard, 'damage_equal', 'msg_rider_test', {
            tokens,
            targetTokenIds: ['tok_a', 'tok_b'],
            vtt: { role: 'GM', socket: mockSocket },
            syncHpFn() { },
            renderAll() { },
            triggerDamageFXAnimation() { }
        });

        // Riders are rolled asynchronously with 150ms delays
        await new Promise((resolve) => setTimeout(resolve, 450));

        assert.ok(cardPosted, 'postSaveResolutionChatCard must be called');
        // Exactly 2 attacks hit across 2 targets -> exactly 2 save results, NOT 4 (which was the N x M bug)
        assert.equal(cardPosted.results.length, 2, 'Exactly 2 saves must be rolled for 2 hitting attacks');
        assert.equal(cardPosted.results[0].tokenId, 'tok_a', 'Attack 1 save must target tok_a');
        assert.equal(cardPosted.results[1].tokenId, 'tok_b', 'Attack 2 save must target tok_b');
    });

    await t.test('10. clusterTokensByProximity clusters 2D tokens strictly by map proximity without mixing separate clusters', () => {
        // Interleaved list of tokens: 3 in West room, 3 in East room
        const tok_w1 = { id: 'w1', x: 10, y: 10, width: 50, height: 50 };
        const tok_w2 = { id: 'w2', x: 20, y: 10, width: 50, height: 50 };
        const tok_w3 = { id: 'w3', x: 15, y: 25, width: 50, height: 50 };

        const tok_e1 = { id: 'e1', x: 500, y: 500, width: 50, height: 50 };
        const tok_e2 = { id: 'e2', x: 510, y: 500, width: 50, height: 50 };
        const tok_e3 = { id: 'e3', x: 505, y: 520, width: 50, height: 50 };

        const mixedList = [tok_w1, tok_e1, tok_w2, tok_e2, tok_w3, tok_e3];
        const squads = clusterTokensByProximity(mixedList, 2);

        assert.equal(squads.length, 2, 'Must create 2 squads');
        assert.equal(squads[0].length, 3, 'Squad 1 must have 3 tokens');
        assert.equal(squads[1].length, 3, 'Squad 2 must have 3 tokens');

        // Squad 1 must be the West cluster (sorted west to east)
        const squad1Ids = new Set(squads[0].map((t) => t.id));
        assert.ok(squad1Ids.has('w1') && squad1Ids.has('w2') && squad1Ids.has('w3'), 'Squad 1 must contain all West tokens');

        // Squad 2 must be the East cluster
        const squad2Ids = new Set(squads[1].map((t) => t.id));
        assert.ok(squad2Ids.has('e1') && squad2Ids.has('e2') && squad2Ids.has('e3'), 'Squad 2 must contain all East tokens');
    });

    await t.test('11. clusterTokensByProximity handles edge cases (single token, k >= n, k <= 1)', () => {
        const t1 = { id: 't1', x: 0, y: 0 };
        assert.equal(clusterTokensByProximity([t1], 3).length, 1);
        assert.equal(clusterTokensByProximity([], 2).length, 1);
        assert.equal(clusterTokensByProximity([t1], 1).length, 1);

        const list = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }];
        const result = clusterTokensByProximity(list, 5);
        assert.equal(result.length, 2, 'Cannot exceed number of tokens');
    });
});
