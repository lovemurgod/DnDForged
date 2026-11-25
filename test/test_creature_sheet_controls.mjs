import test from 'node:test';
import assert from 'node:assert/strict';

import { getVisibilitySetting, rollAndPostToChat, parseActionMacro } from '../vtt/js/creature-sheet/creature-roller.js';
import { evaluateDiceHelper } from '../vtt/js/creature-sheet/creature-parser.js';
import { parseSpellMacro, rollNpcSpell } from '../vtt/js/creature-sheet/creature-spells.js';
import { simulateRoll } from '../vtt/js/player-sheet/vtt-sheet-rolls.js';

test('Creature Sheet Controls - getVisibilitySetting honors m.whisperToGM', () => {
    const mockPublicMonster = { name: 'Goblin', whisperToGM: false };
    const mockWhisperMonster = { name: 'Goblin Boss', whisperToGM: true };

    const pubVis = getVisibilitySetting({ getMonster: () => mockPublicMonster });
    assert.equal(pubVis, 'public', 'Should default to public when whisperToGM is false');

    const whisperVis = getVisibilitySetting({ getMonster: () => mockWhisperMonster });
    assert.equal(whisperVis, 'gm', 'Should return gm when whisperToGM is true');
});

test('Creature Sheet Controls - rollAndPostToChat emits with whisperToGM when monster whisper is active', () => {
    const mockMonster = {
        name: 'Spy',
        whisperToGM: true,
        activeRollMode: 'normal'
    };

    let emittedEvent = null;
    let emittedData = null;

    const mockVtt = {
        username: 'DungeonMaster',
        socket: {
            emit: (event, data) => {
                emittedEvent = event;
                emittedData = data;
            }
        }
    };

    const ctx = {
        getMonster: () => mockMonster,
        getVtt: () => mockVtt,
        getVisibilitySetting: () => getVisibilitySetting({ getMonster: () => mockMonster })
    };

    rollAndPostToChat('1d20 + 4', 'Stealth Check', ctx);

    assert.equal(emittedEvent, 'chat:msg', 'Should emit to chat:msg with whisperToGM');
    assert.ok(emittedData, 'Emitted payload should exist');
    assert.equal(emittedData.whisperToGM, true, 'whisperToGM flag should be true');
    assert.ok(emittedData.text.includes('Stealth Check'), 'Text should mention Stealth Check');
    assert.equal(emittedData.roll.diceList.length, 1, 'Normal mode should roll 1 die');
});

test('Creature Sheet Controls - rollAndPostToChat rolls with Advantage when activeRollMode is adv', () => {
    const mockMonster = {
        name: 'Wolf',
        whisperToGM: false,
        activeRollMode: 'adv'
    };

    let emittedEvent = null;
    let emittedData = null;

    const mockVtt = {
        username: 'DungeonMaster',
        socket: {
            emit: (event, data) => {
                emittedEvent = event;
                emittedData = data;
            }
        }
    };

    const ctx = {
        getMonster: () => mockMonster,
        getVtt: () => mockVtt,
        getVisibilitySetting: () => 'public'
    };

    rollAndPostToChat('1d20 + 2', 'Bite Attack', ctx);

    assert.equal(emittedEvent, 'chat:msg', 'Should emit public chat:msg');
    assert.ok(emittedData.text.includes('(Advantage)'), 'Roll title text should include Advantage note');
    assert.equal(emittedData.roll.diceList.length, 2, 'Advantage should roll 2d20');
    assert.ok(emittedData.roll.formula.includes('2d20kh1'), 'Formula should use keep highest');
});

test('Creature Sheet Controls - rollAndPostToChat rolls with Disadvantage when activeRollMode is dis', () => {
    const mockMonster = {
        name: 'Zombie',
        whisperToGM: false,
        activeRollMode: 'dis'
    };

    let emittedData = null;
    const mockVtt = {
        username: 'DungeonMaster',
        socket: {
            emit: (event, data) => {
                emittedData = data;
            }
        }
    };

    const ctx = {
        getMonster: () => mockMonster,
        getVtt: () => mockVtt,
        getVisibilitySetting: () => 'public'
    };

    rollAndPostToChat('1d20 - 1', 'Slam Attack', ctx);

    assert.ok(emittedData.text.includes('(Disadvantage)'), 'Roll title text should include Disadvantage note');
    assert.equal(emittedData.roll.diceList.length, 2, 'Disadvantage should roll 2d20');
    assert.ok(emittedData.roll.formula.includes('2d20kl1'), 'Formula should use keep lowest');
});

test('Creature Sheet Controls - parseActionMacro honors m.activeRollMode on attack rolls', () => {
    const mockMonsterAdv = {
        name: 'Dragon',
        activeRollMode: 'adv'
    };

    const macroAdv = parseActionMacro(
        'Bite',
        ['{@atk mw} {@hit 10} {@damage 2d10 + 6}'],
        'Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage.',
        'Dragon',
        null,
        null,
        mockMonsterAdv
    );

    assert.ok(macroAdv.atkRoll, 'Should parse attack roll');
    assert.equal(macroAdv.atkRoll.diceList.length, 2, 'Should roll 2 dice for advantage');
    assert.ok(
        macroAdv.atkRoll.diceList.some((d) => d.dropped || d.isDropped),
        'Should have dropped die for advantage'
    );

    const mockMonsterDis = {
        name: 'Dragon',
        activeRollMode: 'dis'
    };

    const macroDis = parseActionMacro(
        'Bite',
        ['{@atk mw} {@hit 10} {@damage 2d10 + 6}'],
        'Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage.',
        'Dragon',
        null,
        null,
        mockMonsterDis
    );

    assert.ok(macroDis.atkRoll, 'Should parse attack roll');
    assert.equal(macroDis.atkRoll.diceList.length, 2, 'Should roll 2 dice for disadvantage');
    assert.ok(
        macroDis.atkRoll.diceList.some((d) => d.dropped || d.isDropped),
        'Should have dropped die for disadvantage'
    );
});

test('Creature Sheet Controls - evaluateDiceHelper handles rollModeOverride directly', () => {
    const rollAdv = evaluateDiceHelper('1d20 + 5', false, 'adv');
    assert.equal(rollAdv.diceList.length, 2, 'adv override should produce 2 dice');
    assert.ok(
        rollAdv.diceList.some((d) => d.dropped),
        'adv should flag dropped die'
    );

    const rollDis = evaluateDiceHelper('1d20 + 5', false, 'dis');
    assert.equal(rollDis.diceList.length, 2, 'dis override should produce 2 dice');
    assert.ok(
        rollDis.diceList.some((d) => d.dropped),
        'dis should flag dropped die'
    );
});

test('Player Sheet Controls - simulateRoll handles character activeRollMode', () => {
    const mockCharAdv = {
        name: 'Fighter',
        activeRollMode: 'adv'
    };

    const rollAdv = simulateRoll('1d20 + 6', 20, null, { char: mockCharAdv });
    assert.equal(rollAdv.rollMode, 'adv');
    assert.equal(rollAdv.diceList.length, 2, 'Should roll 2 dice with Adv');

    const mockCharDis = {
        name: 'Fighter',
        activeRollMode: 'dis'
    };

    const rollDis = simulateRoll('1d20 + 6', 20, null, { char: mockCharDis });
    assert.equal(rollDis.rollMode, 'dis');
    assert.equal(rollDis.diceList.length, 2, 'Should roll 2 dice with Dis');
});

test('Player Sheet Controls - simulateRoll triggers Elven Accuracy Superadvantage for .pc-macro-roll-all', () => {
    const mockChar = {
        name: 'Elven Ranger',
        activeRollMode: 'adv',
        settings: {
            elvenAccuracy: true
        }
    };

    // Simulate clicking the macro title (.pc-macro-roll-all)
    const mockElement = {
        closest: (sel) => (sel === '.pc-macro-roll-all' ? {} : null)
    };
    const mockEvent = {
        target: mockElement
    };

    const roll = simulateRoll('1d20 + 7', 20, mockEvent, { char: mockChar });
    assert.equal(roll.isSuperAdvantage, true, 'Should set isSuperAdvantage flag');
    assert.equal(roll.diceList.length, 3, 'Should roll 3 dice for Elven Accuracy');
    assert.equal(roll.diceList.filter((d) => d.isDropped).length, 2, 'Should drop 2 dice');
});

test('Creature Sheet Controls - parseSpellMacro honors rollModeOverride for spell attack', () => {
    const mockSpell = {
        name: 'Fire Bolt',
        spellAttack: true,
        entries: ['{@damage 1d10} fire damage']
    };
    const stats = { atk: 5, dc: 13 };

    const macroAdv = parseSpellMacro(mockSpell, stats, 'Mage', '', 'cantrip', 'adv');
    assert.ok(macroAdv.atkRoll, 'Should have atkRoll');
    assert.equal(macroAdv.atkRoll.diceList.length, 2, 'Should roll 2 dice for adv');
    assert.ok(
        macroAdv.atkRoll.diceList.some((d) => d.dropped),
        'Should flag dropped die'
    );

    const macroDis = parseSpellMacro(mockSpell, stats, 'Mage', '', 'cantrip', 'dis');
    assert.ok(macroDis.atkRoll, 'Should have atkRoll');
    assert.equal(macroDis.atkRoll.diceList.length, 2, 'Should roll 2 dice for dis');
    assert.ok(
        macroDis.atkRoll.diceList.some((d) => d.dropped),
        'Should flag dropped die'
    );
});

test('Creature Sheet Controls - rollNpcSpell forwards activeRollMode to VTTSpellManager.rollSpell', () => {
    const mockMonster = {
        name: 'Lich',
        activeRollMode: 'adv',
        spells: {
            cantrips: [{ name: 'Ray of Frost', level: 'cantrip' }]
        }
    };

    let receivedOptions = null;
    globalThis.window = {
        VTTSpellManager: {
            rollSpell: (sp, level, m, options) => {
                receivedOptions = options;
            }
        }
    };

    const ctx = {
        getMonster: () => mockMonster,
        getVisibilitySetting: () => 'public'
    };

    rollNpcSpell('cantrip', 0, 'roll', null, mockMonster.spells.cantrips[0], {}, ctx);

    assert.ok(receivedOptions, 'Options should be passed to rollSpell');
    assert.equal(receivedOptions.rollMode, 'adv', 'rollMode should be forwarded from activeRollMode');

    delete globalThis.window;
});
