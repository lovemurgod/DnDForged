import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    _hasResistanceType,
    applyCardDamageToToken,
    applyCompositeDamageToTokens,
    changeMassTokenZOrder,
    syncTokensHpToCharacters
} from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

import { getPcRollFormula, getTokenSaveMod, rollFromToken } from '../vtt/js/canvas/tokens/vtt-canvas-token-rollers.js';

import { changeTokenZOrder } from '../vtt/js/canvas/tokens/vtt-canvas-token-menu.js';

describe('Canvas Mass Actions & Token Rolls: Defenses & Damage Resolutions', () => {
    it('_hasResistanceType evaluates string, structured, and bypassed resistances', () => {
        // Plain string resistance
        const plainResist = ['fire', 'cold'];
        assert.strictEqual(_hasResistanceType(plainResist, 'fire'), true);
        assert.strictEqual(_hasResistanceType(plainResist, 'acid'), false);

        // Structured defense with nonmagical bypass
        const structuredBypass = [
            {
                types: ['slashing', 'bludgeoning'],
                bypasses: ['magic']
            }
        ];
        // Non-magical attack: resistance applies
        assert.strictEqual(_hasResistanceType(structuredBypass, 'slashing', { isMagic: false }), true);
        // Magical attack: resistance is bypassed
        assert.strictEqual(_hasResistanceType(structuredBypass, 'slashing', { isMagic: true }), false);

        // Silvered bypass
        const silverBypass = [
            {
                types: ['slashing'],
                bypasses: ['silver']
            }
        ];
        assert.strictEqual(_hasResistanceType(silverBypass, 'slashing', { isSilvered: false }), true);
        assert.strictEqual(_hasResistanceType(silverBypass, 'slashing', { isSilvered: true }), false);

        // Legacy 5etools object with note
        const legacyResist = [
            {
                resist: ['bludgeoning', 'piercing', 'slashing'],
                note: 'from nonmagical attacks'
            }
        ];
        assert.strictEqual(_hasResistanceType(legacyResist, 'slashing', { isMagic: false }), true);
        assert.strictEqual(_hasResistanceType(legacyResist, 'slashing', { isMagic: true }), false);
    });

    it('applyCardDamageToToken respects immunities, resistances, vulnerabilities, and temp HP', () => {
        const token = {
            id: 'tok-1',
            hp: 50,
            maxHp: 50,
            tempHp: 10,
            monsterData: {
                immune: ['poison'],
                resist: ['fire'],
                vulnerable: ['cold']
            }
        };

        // 1. Poison attack (immune): deals 0 damage, tempHp untouched
        let deducted = applyCardDamageToToken(token, [{ roll: { total: 20 }, type: 'poison' }]);
        assert.strictEqual(deducted, 0);
        assert.strictEqual(token.tempHp, 10);
        assert.strictEqual(token.hp, 50);

        // 2. Fire attack (resist: 20 dmg -> 10 dmg): absorbs 10 tempHp, 0 to main HP
        deducted = applyCardDamageToToken(token, [{ roll: { total: 20 }, type: 'fire' }]);
        assert.strictEqual(deducted, 10);
        assert.strictEqual(token.tempHp, 0);
        assert.strictEqual(token.hp, 50);

        // 3. Cold attack (vulnerable: 10 dmg -> 20 dmg): tempHp is 0, deals 20 to hp -> 30 hp
        deducted = applyCardDamageToToken(token, [{ roll: { total: 10 }, type: 'cold' }]);
        assert.strictEqual(deducted, 20);
        assert.strictEqual(token.hp, 30);
    });

    it('applyCompositeDamageToTokens applies multiple damage rolls across multiple tokens', () => {
        const tokens = {
            t1: { id: 't1', hp: 30, maxHp: 30, x: 0, y: 0 },
            t2: { id: 't2', hp: 40, maxHp: 40, x: 100, y: 100 }
        };

        const dmgRolls = [
            { roll: { total: 10 }, type: 'slashing' },
            { roll: { total: 5 }, type: 'fire' }
        ];

        let updateEmitted = false;
        applyCompositeDamageToTokens(['t1', 't2'], dmgRolls, 1.0, {
            tokens,
            vtt: { socket: null },
            syncHpFn: () => {},
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
            triggerDamageFXAnimation: () => {},
            renderAll: () => {
                updateEmitted = true;
            }
        });

        // 15 total damage to each token
        assert.strictEqual(tokens.t1.hp, 15);
        assert.strictEqual(tokens.t2.hp, 25);
        assert.strictEqual(updateEmitted, true);
    });
});

describe('Canvas Token Rolls: Formula Calculations & Stat Modifiers', () => {
    it('getPcRollFormula calculates base stats, proficiency, expertise, and toggle dice', () => {
        const char = {
            level: 5, // PB = +3
            stats: { str: 16, dex: 14, int: 10 }, // STR mod = +3, DEX mod = +2
            skills: { Athletics: true },
            expertise: { Athletics: true }, // PB doubled = +6 -> Total = 3 + 6 = +9
            skillToggles: [
                { enabled: true, target: 'all', formula: '+1d4' } // Guidance
            ]
        };

        // Athletics check (STR + prof + expertise + toggle)
        const formula = getPcRollFormula(char, 'skill', 'Athletics');
        assert.strictEqual(formula, '1d20+9+1d4');

        // Initiative (DEX mod + toggle)
        const initFormula = getPcRollFormula(char, 'initiative');
        assert.strictEqual(initFormula, '1d20+2+1d4');
    });

    it('getTokenSaveMod resolves PC saves with PB and monster save overrides', () => {
        // Monster with explicit save override
        const monsterToken = {
            monsterData: {
                dex: 12, // mod +1
                save: { dex: '+5' }
            }
        };
        assert.strictEqual(getTokenSaveMod(monsterToken, 'dex'), 5);

        // Monster without save override uses base score mod
        const rawMonster = {
            monsterData: {
                con: 16
            }
        };
        assert.strictEqual(getTokenSaveMod(rawMonster, 'con'), 3);

        // PC token with proficient save
        const pcToken = {
            characterId: 'char-123'
        };
        const mockVtt = {
            campaignState: {
                characters: {
                    'char-123': {
                        level: 5, // PB = +3
                        stats: { wis: 14 }, // mod = +2
                        saves: { wis: true } // +2 + 3 = +5
                    }
                }
            }
        };
        assert.strictEqual(getTokenSaveMod(pcToken, 'wis', { vtt: mockVtt }), 5);
    });

    it('rollFromToken formats result with correct dice rolls and modifiers', () => {
        const emitted = [];
        const mockSocket = {
            emit: (event, payload) => {
                emitted.push({ event, payload });
            }
        };
        const mockVtt = { socket: mockSocket, role: 'player' };

        const total = rollFromToken('1d20+5', 'Acrobatics', 'tok-1', 0, { vtt: mockVtt });
        assert.strictEqual(typeof total, 'number');
        assert.strictEqual(total >= 6 && total <= 25, true);
        assert.strictEqual(emitted.length, 1);
        assert.strictEqual(emitted[0].event, 'chat:msg');
        assert.strictEqual(emitted[0].payload.text.includes('[Acrobatics] rolls **1d20+5**'), true);
    });
});

describe('Canvas Token Z-Ordering: Stack Manipulation', () => {
    it('changeTokenZOrder moves single token front, back, front-one, and back-one', () => {
        const tokens = {
            t1: { id: 't1', zIndex: 1 },
            t2: { id: 't2', zIndex: 2 },
            t3: { id: 't3', zIndex: 3 }
        };

        // Move t1 to front (max is 3 -> 4)
        changeTokenZOrder('t1', 'front', { tokens });
        assert.strictEqual(tokens.t1.zIndex, 4);

        // Move t1 to back (min is 2 -> 1)
        changeTokenZOrder('t1', 'back', { tokens });
        assert.strictEqual(tokens.t1.zIndex, 1);

        // Move t1 front-one (swaps with t2)
        changeTokenZOrder('t1', 'front-one', { tokens });
        assert.strictEqual(tokens.t1.zIndex, 2);
        assert.strictEqual(tokens.t2.zIndex, 1);
    });

    it('changeMassTokenZOrder moves multiple selected tokens while preserving relative order', () => {
        const tokens = {
            t1: { id: 't1', zIndex: 1 },
            t2: { id: 't2', zIndex: 2 },
            t3: { id: 't3', zIndex: 3 },
            t4: { id: 't4', zIndex: 10 }
        };

        // Move t1 and t2 to front (max other is t4 at 10)
        // t1 gets 11, t2 gets 12
        changeMassTokenZOrder(['t1', 't2'], 'front', { tokens, vtt: {} });
        assert.strictEqual(tokens.t1.zIndex, 11);
        assert.strictEqual(tokens.t2.zIndex, 12);
        assert.strictEqual(tokens.t1.zIndex < tokens.t2.zIndex, true);
    });

    it('syncTokensHpToCharacters correctly synchronizes character via sourceCharacterId and characterId', () => {
        const charA = { id: 'char_a', hpCurrent: 50, hpMax: 50, tempHp: 0 };
        const charB = { id: 'char_b', hpCurrent: 30, hpMax: 30, tempHp: 0 };
        const vtt = {
            campaignState: {
                characters: {
                    char_a: charA,
                    char_b: charB
                }
            }
        };

        const tokens = {
            tok_1: { id: 'tok_1', characterId: 'char_a', hp: 35, maxHp: 50, tempHp: 5 },
            tok_2: { id: 'tok_2', sourceCharacterId: 'char_b', hp: 12, maxHp: 30, tempHp: 0 },
            tok_3: { id: 'tok_3', characterId: 'char_a', hp: 50, maxHp: 50, tempHp: 0 } // clone token of char_a
        };

        syncTokensHpToCharacters([tokens.tok_1, tokens.tok_2], { vtt, tokens });

        // charA should be updated from tok_1, and other char_a clone tok_3 should be synced
        assert.strictEqual(charA.hpCurrent, 35);
        assert.strictEqual(charA.tempHp, 5);
        assert.strictEqual(tokens.tok_3.hp, 35);
        assert.strictEqual(tokens.tok_3.tempHp, 5);

        // charB should be updated via sourceCharacterId from tok_2
        assert.strictEqual(charB.hpCurrent, 12);
        assert.strictEqual(charB.hpMax, 30);
    });
});
