// Test Suite: Companion Player Assignment, Temp HP Bar & Controls, and Attack Bypasses
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ─── Setup Headless DOM & Global Environment ──────────────────────────────
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
    <div id="vtt-creature-sheet-panel"></div>
</body>
</html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.HTMLElement = dom.window.HTMLElement;

// Mock prompt helper
globalThis.window.showVttPrompt = (msg, def, cb) => cb(def);

import {
    getLinkedTokenHp,
    getLinkedTokenTempHp,
    wireHpControls,
    renderStatBlock
} from '../vtt/js/creature-sheet/creature-renderer.js';

import { createAbilityRow, openEditModal } from '../vtt/js/creature-sheet/creature-editor.js';

import { parseActionMacro } from '../vtt/js/creature-sheet/creature-roller.js';

test('getLinkedTokenTempHp resolves correctly from token, character, or monster data', () => {
    // 1. Linked Token priority
    const mockCtxToken = {
        getLinkedTokenId: () => 'token_1',
        getLinkedCharacterId: () => 'char_1'
    };
    globalThis.window.VTT = {
        canvasEngine: {
            getTokens: () => ({
                token_1: { hp: 15, tempHp: 8 }
            })
        },
        campaignState: {
            characters: {
                char_1: { hpCurrent: 20, tempHp: 5 }
            }
        }
    };
    assert.equal(getLinkedTokenTempHp({}, mockCtxToken), 8);

    // 2. Linked Character priority (no token)
    const mockCtxChar = {
        getLinkedTokenId: () => null,
        getLinkedCharacterId: () => 'char_1'
    };
    assert.equal(getLinkedTokenTempHp({}, mockCtxChar), 5);

    // 3. Fallback to monsterData
    const mockCtxNone = {
        getLinkedTokenId: () => null,
        getLinkedCharacterId: () => null
    };
    assert.equal(getLinkedTokenTempHp({ tempHp: 12 }, mockCtxNone), 12);
    assert.equal(getLinkedTokenTempHp({}, mockCtxNone), 0);
});

test('wireHpControls absorbs damage in Temp HP first, then reduces current HP', () => {
    const container = document.createElement('div');
    container.innerHTML = `
        <div id="cs-hp-current">20</div>
        <div id="cs-hp-max">20</div>
        <div id="cs-temp-hp-current">10</div>
        <div id="cs-hp-bar"></div>
        <div id="cs-temp-hp-bar-wrap" style="display:block;"></div>
        <button id="cs-hp-minus">-</button>
        <button id="cs-hp-plus">+</button>
        <button id="cs-temp-hp-minus">-</button>
        <button id="cs-temp-hp-plus">+</button>
    `;

    let emittedChar = null;
    let emittedToken = null;
    const compChar = { id: 'comp_1', hpCurrent: 20, tempHp: 10 };
    const canvasToken = { id: 'token_1', hp: 20, tempHp: 10 };

    globalThis.window.VTT = {
        socket: {
            emit: (ev, data) => {
                if (ev === 'character:update') emittedChar = data.character;
                if (ev === 'token:update') emittedToken = data.token;
            },
            on: () => {}
        },
        canvasEngine: {
            getTokens: () => ({ token_1: canvasToken }),
            getCurrentMapId: () => 'map_1',
            renderAll: () => {}
        },
        campaignState: {
            characters: { comp_1: compChar }
        }
    };

    const ctx = {
        getLinkedTokenId: () => 'token_1',
        getLinkedCharacterId: () => 'comp_1',
        getContentEl: () => container
    };

    wireHpControls(container, {}, 20, 20, ctx, 10);

    const minusBtn = container.querySelector('#cs-hp-minus');
    const plusBtn = container.querySelector('#cs-hp-plus');
    const tempMinusBtn = container.querySelector('#cs-temp-hp-minus');
    const tempPlusBtn = container.querySelector('#cs-temp-hp-plus');

    // 1. Partial damage to Temp HP: 6 damage with 10 Temp HP
    // Current HP should remain 20, Temp HP should become 4
    globalThis.window.showVttPrompt = (msg, def, cb) => cb('6');
    minusBtn.click();

    assert.equal(container.querySelector('#cs-hp-current').textContent, '20');
    assert.equal(container.querySelector('#cs-temp-hp-current').textContent, '4');
    assert.equal(compChar.hpCurrent, 20);
    assert.equal(compChar.tempHp, 4);
    assert.equal(canvasToken.hp, 20);
    assert.equal(canvasToken.tempHp, 4);

    // 2. Damage exceeding Temp HP: 8 damage with 4 Temp HP remaining
    // Temp HP should drop to 0, current HP absorbs remaining 4 damage -> 16
    globalThis.window.showVttPrompt = (msg, def, cb) => cb('8');
    minusBtn.click();

    assert.equal(container.querySelector('#cs-hp-current').textContent, '16');
    assert.equal(container.querySelector('#cs-temp-hp-current').textContent, '0');
    assert.equal(container.querySelector('#cs-temp-hp-bar-wrap').style.display, 'none');
    assert.equal(compChar.hpCurrent, 16);
    assert.equal(compChar.tempHp, 0);

    // 3. Add Temp HP directly
    globalThis.window.showVttPrompt = (msg, def, cb) => cb('15');
    tempPlusBtn.click();

    assert.equal(container.querySelector('#cs-temp-hp-current').textContent, '15');
    assert.equal(container.querySelector('#cs-temp-hp-bar-wrap').style.display, 'block');
    assert.equal(compChar.tempHp, 15);

    // 4. Reduce Temp HP directly
    globalThis.window.showVttPrompt = (msg, def, cb) => cb('5');
    tempMinusBtn.click();

    assert.equal(container.querySelector('#cs-temp-hp-current').textContent, '10');
    assert.equal(compChar.tempHp, 10);

    // 5. Healing HP up to max
    globalThis.window.showVttPrompt = (msg, def, cb) => cb('10');
    plusBtn.click();

    assert.equal(container.querySelector('#cs-hp-current').textContent, '20');
    assert.equal(compChar.hpCurrent, 20);
    assert.equal(compChar.tempHp, 10); // Temp HP unaffected by heal
});

test('createAbilityRow renders Attack Bypasses and preserves checkboxes', () => {
    // 1. Default non-magical action
    const normalItem = {
        name: 'Bite',
        entries: ['Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage.']
    };
    const row1 = createAbilityRow(normalItem);
    const magicCb1 = row1.querySelector('.edit-ab-is-magic');
    const silverCb1 = row1.querySelector('.edit-ab-is-silvered');
    const adamCb1 = row1.querySelector('.edit-ab-is-adamantine');

    assert.ok(magicCb1, 'Magical checkbox rendered');
    assert.ok(silverCb1, 'Silvered checkbox rendered');
    assert.ok(adamCb1, 'Adamantine checkbox rendered');
    assert.equal(magicCb1.checked, false);
    assert.equal(silverCb1.checked, false);
    assert.equal(adamCb1.checked, false);

    // 2. Action with existing macro bypasses
    const bypassedItem = {
        name: 'Moonlight Bite',
        entries: ['Melee Weapon Attack: +6 to hit. Hit: 8 (1d8 + 4) radiant damage.'],
        macro: {
            attackBonus: 6,
            isMagic: true,
            isSilvered: true,
            isAdamantine: false
        }
    };
    const row2 = createAbilityRow(bypassedItem);
    const magicCb2 = row2.querySelector('.edit-ab-is-magic');
    const silverCb2 = row2.querySelector('.edit-ab-is-silvered');
    const adamCb2 = row2.querySelector('.edit-ab-is-adamantine');

    assert.equal(magicCb2.checked, true, 'isMagic checked from macro');
    assert.equal(silverCb2.checked, true, 'isSilvered checked from macro');
    assert.equal(adamCb2.checked, false, 'isAdamantine unchecked from macro');
});

test('parseActionMacro propagates isMagic, isSilvered, and isAdamantine to attack and damages', () => {
    const item = {
        name: 'Blessed Claws',
        entries: ['Melee Weapon Attack: +5 to hit. Hit: 7 (1d6 + 4) slashing damage.'],
        macro: {
            isAttack: true,
            attackBonus: 5,
            isMagic: true,
            isSilvered: true,
            isAdamantine: false,
            damages: [{ formula: '1d6+4', type: 'Slashing' }]
        }
    };

    const parsed = parseActionMacro(item.name, item.entries, '', 'Creature', item.macro);
    assert.ok(parsed, 'Macro parsed');
    assert.equal(parsed.dmgRolls.length, 1);
    assert.equal(parsed.dmgRolls[0].isMagic, true);
    assert.equal(parsed.dmgRolls[0].isSilvered, true);
    assert.equal(parsed.dmgRolls[0].isAdamantine, false);
});

test('renderStatBlock renders Assign button in header for GM when companion character is active', () => {
    const container = document.createElement('div');
    container.id = 'vtt-creature-sheet-panel';
    document.body.appendChild(container);

    const companionChar = {
        id: 'comp_123',
        name: 'Wolf Companion',
        isCompanion: true,
        assignedPlayers: ['player1'],
        tempHp: 5
    };

    globalThis.window.VTT = {
        role: 'GM',
        username: 'GM',
        campaignState: {
            characters: {
                comp_123: companionChar
            }
        }
    };

    const ctx = {
        getLinkedCharacterId: () => 'comp_123',
        getLinkedTokenId: () => null,
        getContentEl: () => container,
        getVtt: () => globalThis.window.VTT
    };

    const monster = {
        name: 'Wolf Companion',
        hp: { average: 22 },
        ac: 13,
        speed: { walk: 40 }
    };

    renderStatBlock(monster, container, ctx);

    const assignBtn = container.querySelector('#cs-assign-players-btn');
    assert.ok(assignBtn, 'Assign players button rendered in header for GM');
    assert.ok(assignBtn.title.includes('Companion'), 'Tooltip indicates assigning players to companion');

    const tempBar = container.querySelector('#cs-temp-hp-bar');
    assert.ok(tempBar, 'Temp HP bar rendered');
    assert.equal(container.querySelector('#cs-temp-hp-current').textContent, '5', 'Temp HP initialized to 5');
});
