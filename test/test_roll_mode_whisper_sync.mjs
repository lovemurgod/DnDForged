import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getVisibilitySetting,
    rollAndPostToChat,
    parseActionMacro,
    wireInitiativeRoll
} from '../vtt/js/creature-sheet/creature-roller.js';
import { simulateRoll } from '../vtt/js/player-sheet/vtt-sheet-rolls.js';
import { rollFromToken } from '../vtt/js/canvas/tokens/vtt-canvas-token-rollers.js';

test('Global Roll Mode & Whisper - simulateRoll respects window.VTT.currentRollMode when char is not overriding', () => {
    globalThis.window = {
        VTT: {
            currentRollMode: 'adv',
            whisperGM: false
        }
    };

    const rollAdv = simulateRoll('1d20 + 3', 20, null);
    assert.equal(rollAdv.rollMode, 'adv', 'Should inherit adv from window.VTT.currentRollMode');
    assert.equal(rollAdv.diceList.length, 2, 'Should roll 2 dice for adv');

    globalThis.window.VTT.currentRollMode = 'dis';
    const rollDis = simulateRoll('1d20 + 3', 20, null);
    assert.equal(rollDis.rollMode, 'dis', 'Should inherit dis from window.VTT.currentRollMode');
    assert.equal(rollDis.diceList.length, 2, 'Should roll 2 dice for dis');

    delete globalThis.window;
});

test('Keyboard Modifiers - Shift+Click overrides normal or dis mode to Advantage in simulateRoll', () => {
    globalThis.window = {
        VTT: {
            currentRollMode: 'dis'
        }
    };

    const shiftEvent = { shiftKey: true };
    const roll = simulateRoll('1d20 + 4', 20, shiftEvent);
    assert.equal(roll.rollMode, 'adv', 'Shift key should force advantage');
    assert.equal(roll.diceList.length, 2, 'Advantage should roll 2d20');
    assert.ok(
        roll.diceList.some((d) => d.discarded || d.isDropped),
        'Dropped die should exist'
    );

    delete globalThis.window;
});

test('Keyboard Modifiers - Ctrl+Click overrides adv mode to Disadvantage in simulateRoll', () => {
    globalThis.window = {
        VTT: {
            currentRollMode: 'adv'
        }
    };

    const ctrlEvent = { ctrlKey: true };
    const roll = simulateRoll('1d20 + 4', 20, ctrlEvent);
    assert.equal(roll.rollMode, 'dis', 'Ctrl key should force disadvantage');
    assert.equal(roll.diceList.length, 2, 'Disadvantage should roll 2d20');
    assert.ok(
        roll.diceList.some((d) => d.discarded || d.isDropped),
        'Dropped die should exist'
    );

    delete globalThis.window;
});

test('Creature Sheet Initiative - wireInitiativeRoll handles Shift+Click for Advantage and registers kept score', () => {
    let emittedEvent = null;
    let emittedData = null;
    let addedInitiative = null;

    globalThis.window = {
        VTT: {
            username: 'DM',
            currentRollMode: 'normal',
            whisperGM: false,
            socket: {
                emit: (event, data) => {
                    emittedEvent = event;
                    emittedData = data;
                }
            },
            chatEngine: {
                addToInitiative: (name, score, tokenId, img) => {
                    addedInitiative = { name, score, tokenId, img };
                }
            }
        }
    };

    // Minimal DOM button mock
    const clickListeners = [];
    const mockButton = {
        addEventListener: (event, handler) => {
            if (event === 'click') clickListeners.push(handler);
        }
    };
    const mockPanel = {
        querySelectorAll: (sel) => (sel === '.cs-roll-initiative-btn' ? [mockButton] : [])
    };

    const mockMonster = {
        name: 'Goblin',
        dex: 14 // +2 mod
    };

    wireInitiativeRoll(mockPanel, mockMonster, {
        getContentEl: () => mockPanel,
        getLinkedTokenId: () => 'token-gob-1'
    });

    assert.equal(clickListeners.length, 1, 'Initiative click listener should be registered');

    // Trigger click with Shift key pressed (Advantage)
    clickListeners[0]({ shiftKey: true });

    assert.equal(emittedEvent, 'chat:msg', 'Should emit chat message');
    assert.ok(emittedData.roll, 'Roll data must be attached');
    assert.equal(emittedData.roll.rolls.length, 2, 'Advantage should roll 2 dice in wireInitiativeRoll');
    assert.ok(emittedData.roll.formula.includes('2d20kh1'), 'Formula should use keep highest');
    assert.ok(addedInitiative, 'addToInitiative should be invoked');
    assert.equal(addedInitiative.name, 'Goblin');
    assert.equal(addedInitiative.score, emittedData.roll.total, 'Initiative score should match roll total');

    delete globalThis.window;
});

test('Creature Sheet Initiative - respects global GM whisper toggle', () => {
    let emittedEvent = null;
    let emittedData = null;

    globalThis.window = {
        VTT: {
            username: 'DM',
            currentRollMode: 'normal',
            whisperGM: true, // Global whisper active
            socket: {
                emit: (event, data) => {
                    emittedEvent = event;
                    emittedData = data;
                }
            },
            chatEngine: {
                addToInitiative: () => {}
            }
        }
    };

    const clickListeners = [];
    const mockButton = {
        addEventListener: (event, handler) => {
            if (event === 'click') clickListeners.push(handler);
        }
    };
    const mockPanel = {
        querySelectorAll: (sel) => (sel === '.cs-roll-initiative-btn' ? [mockButton] : [])
    };

    const mockMonster = {
        name: 'Skeleton',
        dex: 12,
        whisperToGM: false // monster property is false, but global whisper is true
    };

    wireInitiativeRoll(mockPanel, mockMonster, {
        getContentEl: () => mockPanel,
        getVisibilitySetting: () => getVisibilitySetting({ getMonster: () => mockMonster })
    });

    clickListeners[0]({ shiftKey: false, ctrlKey: false });

    assert.ok(emittedData, 'Emitted payload should exist');
    assert.equal(emittedData.whisperToGM, true, 'Should route as GM whisper when global whisperGM is active');

    delete globalThis.window;
});

test('Canvas Token Roller - rollFromToken respects global GM whisper toggle', () => {
    let emittedEvent = null;
    let emittedData = null;

    const mockVtt = {
        username: 'DM',
        role: 'player',
        socket: {
            emit: (event, data) => {
                emittedEvent = event;
                emittedData = data;
            }
        }
    };

    globalThis.window = {
        VTT: {
            whisperGM: true
        }
    };

    rollFromToken('1d20 + 2', 'Token Init', 'tok-123', 0, { vtt: mockVtt });

    assert.equal(emittedEvent, 'chat:msg');
    assert.ok(emittedData);
    assert.equal(
        emittedData.whisperToGM,
        true,
        'rollFromToken should set whisperToGM: true when global whisper is active'
    );

    delete globalThis.window;
});
