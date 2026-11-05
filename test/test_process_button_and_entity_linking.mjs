import test from 'node:test';
import assert from 'node:assert/strict';

import {
    resolveTokenAC,
    processCardFullResolution,
    handleCardAction,
    syncTokensHpToCharacters
} from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

import {
    getTokenAC,
    getResolvedCreatureMonsterData
} from '../vtt/js/canvas/vtt-canvas-tooltips-notes.js';

test('Process Button & Entity Linking: Generic vs Named HP sync and Card Resolution', async (t) => {
    await t.test('Generic creature damage does NOT mutate campaign character template or sibling tokens', () => {
        const goblinTemplate = {
            id: 'char_goblin',
            name: 'Goblin',
            isGeneric: true,
            hpCurrent: 7,
            hpMax: 7,
            tempHp: 0
        };

        const vtt = {
            campaignState: {
                characters: {
                    char_goblin: goblinTemplate
                }
            },
            socket: {
                emit: () => { }
            }
        };

        const tokens = {
            goblin_1: {
                id: 'goblin_1',
                name: 'Goblin 1',
                isGeneric: true,
                sourceCharacterId: 'char_goblin',
                characterId: null,
                hp: 2, // Damaged token
                maxHp: 7,
                tempHp: 0
            },
            goblin_2: {
                id: 'goblin_2',
                name: 'Goblin 2',
                isGeneric: true,
                sourceCharacterId: 'char_goblin',
                characterId: null,
                hp: 7, // Unaffected sibling token
                maxHp: 7,
                tempHp: 0
            }
        };

        syncTokensHpToCharacters([tokens.goblin_1], { vtt, tokens });

        assert.equal(goblinTemplate.hpCurrent, 7, 'Generic template HP must remain untouched');
        assert.equal(tokens.goblin_2.hp, 7, 'Sibling generic token HP must remain untouched');
        assert.equal(tokens.goblin_1.hp, 2, 'Damaged token retains its canvas HP');
    });

    await t.test('Named creature damage DOES sync to campaign character and sibling tokens', () => {
        const strahdCharacter = {
            id: 'char_strahd',
            name: 'Strahd von Zarovich',
            isGeneric: false,
            hpCurrent: 144,
            hpMax: 144,
            tempHp: 0
        };

        const vtt = {
            campaignState: {
                characters: {
                    char_strahd: strahdCharacter
                }
            },
            socket: {
                emitted: [],
                emit(evt, data) {
                    this.emitted.push({ evt, data });
                }
            }
        };

        const tokens = {
            strahd_token1: {
                id: 'strahd_token1',
                name: 'Strahd von Zarovich',
                isGeneric: false,
                characterId: 'char_strahd',
                hp: 120, // Took 24 damage
                maxHp: 144,
                tempHp: 0
            },
            strahd_token2: {
                id: 'strahd_token2',
                name: 'Strahd von Zarovich (Illusion)',
                isGeneric: false,
                characterId: 'char_strahd',
                hp: 144,
                maxHp: 144,
                tempHp: 0
            }
        };

        syncTokensHpToCharacters([tokens.strahd_token1], { vtt, tokens });

        assert.equal(strahdCharacter.hpCurrent, 120, 'Named character sheet must be updated');
        assert.equal(tokens.strahd_token2.hp, 120, 'Sibling token of named character must be synced');
        assert.equal(vtt.socket.emitted.length, 1);
        assert.equal(vtt.socket.emitted[0].evt, 'character:update');
    });

    await t.test('handleCardAction returns false when no tokens are selected', () => {
        const vtt = { role: 'GM' };
        const cardData = {
            atkRoll: { total: 18 },
            dmgRolls: [{ type: 'fire', roll: { total: 10 } }]
        };

        const result = handleCardAction(cardData, 'process', {
            vtt,
            selectedTokenIds: new Set()
        });

        assert.equal(result, false, 'handleCardAction should return false when no tokens selected');
    });

    await t.test('processCardFullResolution evaluates hit, marks card resolved, and emits chat:macro_resolved', () => {
        const emittedSocketEvents = [];
        const vtt = {
            role: 'GM',
            socket: {
                emit(evt, data) {
                    emittedSocketEvents.push({ evt, data });
                }
            }
        };

        const tokens = {
            goblin_1: {
                id: 'goblin_1',
                name: 'Goblin 1',
                hp: 15,
                maxHp: 15,
                ac: 12
            }
        };

        const cardData = {
            atkRoll: { total: 16, isCritSuccess: false, isCritFail: false },
            dmgRolls: [{ type: 'fire', roll: { total: 8 } }]
        };

        const handled = processCardFullResolution(cardData, ['goblin_1'], {
            vtt,
            tokens,
            msgId: 'msg_test_123',
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.equal(handled, true);
        assert.equal(tokens.goblin_1.hp, 7, 'Goblin took 8 damage');
        assert.ok(cardData.resolved, 'Card must be marked as resolved');
        assert.match(cardData.resolved.summary, /Hit! Dealt 8 DMG to Goblin 1/);

        const macroResolvedEvent = emittedSocketEvents.find((e) => e.evt === 'chat:macro_resolved');
        assert.ok(macroResolvedEvent, 'chat:macro_resolved socket event should be emitted');
        assert.equal(macroResolvedEvent.data.id, 'msg_test_123');
        assert.match(macroResolvedEvent.data.resolution.summary, /Hit! Dealt 8 DMG/);
    });

    await t.test('processCardFullResolution evaluates miss, marks card resolved without damage, and emits chat:macro_resolved', () => {
        const emittedSocketEvents = [];
        const vtt = {
            role: 'GM',
            socket: {
                emit(evt, data) {
                    emittedSocketEvents.push({ evt, data });
                }
            }
        };

        const tokens = {
            knight_1: {
                id: 'knight_1',
                name: 'Knight',
                hp: 50,
                maxHp: 50,
                ac: 18
            }
        };

        const cardData = {
            atkRoll: { total: 14, isCritSuccess: false, isCritFail: false },
            dmgRolls: [{ type: 'slashing', roll: { total: 12 } }]
        };

        const handled = processCardFullResolution(cardData, ['knight_1'], {
            vtt,
            tokens,
            msgId: 'msg_test_miss',
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.equal(handled, true);
        assert.equal(tokens.knight_1.hp, 50, 'Knight took no damage on miss');
        assert.ok(cardData.resolved, 'Card must be marked as resolved');
        assert.match(cardData.resolved.summary, /Attack \(14\) missed selected token\(s\)/);

        const macroResolvedEvent = emittedSocketEvents.find((e) => e.evt === 'chat:macro_resolved');
        assert.ok(macroResolvedEvent, 'chat:macro_resolved socket event should be emitted');
        assert.equal(macroResolvedEvent.data.id, 'msg_test_miss');
        assert.match(macroResolvedEvent.data.resolution.summary, /missed selected token/);
    });

    await t.test('handleCardAction with "full" and "half" damage resolves card and emits chat:macro_resolved', () => {
        const emittedSocketEvents = [];
        const vtt = {
            role: 'GM',
            socket: {
                emit(evt, data) {
                    emittedSocketEvents.push({ evt, data });
                }
            }
        };

        const tokens = {
            t1: { id: 't1', name: 'Orc', hp: 30, maxHp: 30 }
        };

        const cardDataFull = {
            dmgRolls: [{ type: 'fire', roll: { total: 10 } }]
        };

        const handledFull = handleCardAction(cardDataFull, 'full', {
            vtt,
            tokens,
            selectedTokenIds: new Set(['t1']),
            msgId: 'msg_full_dmg',
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.equal(handledFull, true);
        assert.equal(tokens.t1.hp, 20, 'Orc took 10 full damage');
        assert.match(cardDataFull.resolved.summary, /Full Damage \(10 HP\) applied to Orc/);

        const cardDataHalf = {
            dmgRolls: [{ type: 'cold', roll: { total: 10 } }]
        };

        const handledHalf = handleCardAction(cardDataHalf, 'half', {
            vtt,
            tokens,
            selectedTokenIds: new Set(['t1']),
            msgId: 'msg_half_dmg',
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.equal(handledHalf, true);
        assert.equal(tokens.t1.hp, 15, 'Orc took 5 half damage (10 * 0.5)');
        assert.match(cardDataHalf.resolved.summary, /Half Damage \(5 HP\) applied to Orc/);
    });

    await t.test('resolveTokenAC and getTokenAC parse string AC and nested structure formats', () => {
        // String direct AC
        assert.equal(resolveTokenAC({ ac: '17' }), 17);
        assert.equal(getTokenAC({ ac: '17' }), 17);

        // Monster data primaryAc string
        assert.equal(resolveTokenAC({ monsterData: { primaryAc: '19 (full plate)' } }), 19);
        assert.equal(getTokenAC({ monsterData: { primaryAc: '19 (full plate)' } }), 19);

        // Monster data array of AC objects
        assert.equal(resolveTokenAC({ monsterData: { ac: [{ ac: '15', from: ['natural armor'] }] } }), 15);
        assert.equal(getTokenAC({ monsterData: { ac: [{ ac: '15' }] } }), 15);

        // Fallback to linked character sheet AC
        const mockContext = {
            campaignState: {
                characters: {
                    char_ez: { id: 'char_ez', ac: '16' }
                }
            }
        };
        assert.equal(resolveTokenAC({ characterId: 'char_ez' }, { vtt: mockContext }), 16);
        assert.equal(getTokenAC({ characterId: 'char_ez' }, mockContext), 16);
    });
});
