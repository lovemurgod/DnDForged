// Test Suite: Creature, Custom NPC, and Companion Audit Fixes & Improvements
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
globalThis.MutationObserver = dom.window.MutationObserver;

// Mock prompt helper
globalThis.window.showVttPrompt = (msg, def, cb) => cb(def);

import {
    getLinkedTokenHp,
    wireHpControls,
    renderStatBlock
} from '../vtt/js/creature-sheet/creature-renderer.js';

import {
    DND_5E_SKILLS,
    openEditModal,
    saveCompanionEdits
} from '../vtt/js/creature-sheet/creature-editor.js';

import {
    formatDefenseEntry,
    entryToPlainText
} from '../vtt/js/creature-sheet/creature-parser.js';

import {
    wireInitiativeRoll,
    getVisibilitySetting
} from '../vtt/js/creature-sheet/creature-roller.js';

import { initVttSheetDock } from '../vtt/js/vtt-sheet-dock.js';

test('DND_5E_SKILLS exports 18 standard 5e skills with keys, names, and ability scores', () => {
    assert.equal(DND_5E_SKILLS.length, 18);
    const keys = DND_5E_SKILLS.map((s) => s.key);
    assert.ok(keys.includes('stealth'));
    assert.ok(keys.includes('perception'));
    assert.ok(keys.includes('athletics'));
    assert.ok(keys.includes('arcana'));
    assert.ok(keys.includes('acrobatics'));

    const stealth = DND_5E_SKILLS.find((s) => s.key === 'stealth');
    assert.equal(stealth.ability, 'dex');
    assert.equal(stealth.name, 'Stealth');
});

test('Adamantine bypass formatting in formatDefenseEntry renders "aren\'t adamantine"', () => {
    const defense = {
        types: ['bludgeoning', 'piercing', 'slashing'],
        bypasses: ['adamantine']
    };
    const rendered = formatDefenseEntry(defense);
    assert.ok(rendered.includes("attacks that aren't adamantine"), `Expected "aren't adamantine" but got: ${rendered}`);
    assert.ok(!rendered.includes("aren't silvered"), `Should not contain "aren't silvered"`);
});

test('getLinkedTokenHp: Named vs Generic HP resolution', () => {
    // 1. Named character (isGeneric is false/undefined): must return char.hpCurrent
    const mockCtxNamed = {
        getLinkedTokenId: () => 'token_instance_1',
        getLinkedCharacterId: () => 'companion_1'
    };
    globalThis.window.VTT = {
        canvasEngine: {
            getTokens: () => ({
                token_instance_1: { hp: 10, maxHp: 30 }
            })
        },
        campaignState: {
            characters: {
                companion_1: { isGeneric: false, hpCurrent: 25, hpMax: 30 }
            }
        }
    };
    const namedHp = getLinkedTokenHp({ hp: { average: 30 } }, mockCtxNamed);
    assert.equal(namedHp, 25, 'Named companion must read from campaignState character hpCurrent');

    // 2. Generic token (isGeneric: true): must return token instance hp
    globalThis.window.VTT.campaignState.characters.generic_template = {
        isGeneric: true,
        hpCurrent: 18,
        hpMax: 18
    };
    const mockCtxGeneric = {
        getLinkedTokenId: () => 'token_instance_1',
        getLinkedCharacterId: () => 'generic_template'
    };
    const genericTokenHp = getLinkedTokenHp({ hp: { average: 18 } }, mockCtxGeneric);
    assert.equal(genericTokenHp, 10, 'Generic token instance must read from canvasEngine token hp');

    // 3. Generic template opened with no active token: returns null (so renderer falls back to template average)
    const mockCtxGenericNoToken = {
        getLinkedTokenId: () => null,
        getLinkedCharacterId: () => 'generic_template'
    };
    const genericTemplateHp = getLinkedTokenHp({ hp: { average: 18 } }, mockCtxGenericNoToken);
    assert.equal(genericTemplateHp, null, 'Generic template without active token returns null from getLinkedTokenHp');
});

test('wireHpControls disables modifying generic template HP when opened without token context', () => {
    const container = document.createElement('div');
    container.innerHTML = `
        <span id="cs-hp-current">18</span>
        <span id="cs-hp-max">18</span>
        <button id="cs-hp-minus" class="cs-hp-btn">-</button>
        <button id="cs-hp-plus" class="cs-hp-btn">+</button>
        <button id="cs-temp-hp-minus" class="cs-hp-btn">-</button>
        <button id="cs-temp-hp-plus" class="cs-hp-btn">+</button>
    `;

    const monster = { hp: { average: 18 } };
    const mockCtx = {
        getLinkedTokenId: () => null,
        getLinkedCharacterId: () => 'generic_char'
    };

    globalThis.window.VTT = {
        role: 'GM',
        campaignState: {
            characters: {
                generic_char: { isGeneric: true, hpCurrent: 18, hpMax: 18 }
            }
        },
        socket: {
            on: () => {},
            off: () => {},
            emit: () => {}
        }
    };

    wireHpControls(container, monster, 18, 18, mockCtx);

    const minusBtn = container.querySelector('#cs-hp-minus');
    const plusBtn = container.querySelector('#cs-hp-plus');
    assert.ok(minusBtn.disabled, 'Minus button should be disabled for generic templates without token context');
    assert.ok(plusBtn.disabled, 'Plus button should be disabled for generic templates without token context');
});

test('wireHpControls blocks unauthorized non-owner player from modifying HP', () => {
    const container = document.createElement('div');
    container.innerHTML = `
        <span id="cs-hp-current">25</span>
        <span id="cs-hp-max">30</span>
        <button id="cs-hp-minus" class="cs-hp-btn">-</button>
        <button id="cs-hp-plus" class="cs-hp-btn">+</button>
    `;

    const monster = { hp: { average: 30 } };
    const mockCtx = {
        getLinkedTokenId: () => 'tok_1',
        getLinkedCharacterId: () => 'comp_1'
    };

    globalThis.window.VTT = {
        role: 'Player',
        username: 'PlayerBob',
        campaignState: {
            characters: {
                comp_1: { assignedPlayers: ['PlayerAlice'], hpCurrent: 25, hpMax: 30 }
            }
        },
        canvasEngine: {
            getTokens: () => ({
                tok_1: { ownerUsername: 'PlayerAlice', hp: 25, maxHp: 30 }
            })
        },
        socket: {
            on: () => {},
            off: () => {},
            emit: () => {}
        }
    };

    wireHpControls(container, monster, 25, 30, mockCtx);

    const minusBtn = container.querySelector('#cs-hp-minus');
    const plusBtn = container.querySelector('#cs-hp-plus');
    assert.ok(minusBtn.disabled, 'HP modification button should be disabled for unauthorized player');
    assert.ok(plusBtn.disabled, 'HP modification button should be disabled for unauthorized player');
});

test('Creature Editor skills grid saves new skills into m.skill and removes deprecated m.skills', () => {
    const mockChar = {
        id: 'comp_custom_1',
        name: 'Trained Wolf',
        isCompanion: true,
        monsterData: {
            name: 'Wolf',
            str: 12,
            dex: 15,
            con: 12,
            int: 3,
            wis: 12,
            cha: 6,
            cr: '1/4',
            skill: { perception: '+3' },
            skills: { stealth: '+4' }
        }
    };

    let socketEmitted = null;
    const mockVtt = {
        campaignState: {
            characters: {
                comp_custom_1: mockChar
            }
        },
        socket: {
            emit: (ev, data) => {
                socketEmitted = { ev, data };
            }
        }
    };

    const ctx = {
        getVtt: () => mockVtt
    };

    openEditModal(mockChar.monsterData, 'comp_custom_1', ctx);

    const overlay = document.getElementById('cs-edit-modal-overlay');
    const content = document.getElementById('cs-edit-modal-content');
    assert.ok(overlay, 'Edit modal overlay should exist');
    assert.ok(content, 'Edit modal content should exist');

    // Check modal title is dynamic
    const titleEl = overlay.querySelector('h3');
    assert.equal(titleEl.textContent, 'Edit Companion');

    // Simulate editing skills: set stealth to +6, perception to +5
    const stealthVal = content.querySelector('.cs-edit-skill-val[data-skill="stealth"]');
    const perceptionVal = content.querySelector('.cs-edit-skill-val[data-skill="perception"]');
    assert.ok(stealthVal, 'Stealth skill input should exist in editor');
    assert.ok(perceptionVal, 'Perception skill input should exist in editor');

    stealthVal.value = '+6';
    perceptionVal.value = '+5';

    saveCompanionEdits(mockChar.monsterData, 'comp_custom_1', ctx);

    assert.ok(socketEmitted, 'character:update socket event should be emitted');
    assert.equal(socketEmitted.ev, 'character:update');
    assert.deepEqual(mockChar.monsterData.skill, {
        stealth: '+6',
        perception: '+5'
    });
    assert.equal(mockChar.monsterData.skills, undefined, 'Deprecated m.skills must be cleaned up');

    overlay.remove();
});

test('wireInitiativeRoll emits chat:whisper when visibility is private or gm', () => {
    const container = document.createElement('div');
    container.innerHTML = `<button class="cs-roll-initiative-btn">+2</button>`;

    const monster = { name: 'Secret Assassin', dex: 14 };
    let emitted = null;

    globalThis.window.VTT = {
        username: 'GM_Dave',
        socket: {
            emit: (ev, data) => {
                emitted = { ev, data };
            }
        },
        campaignState: {
            settings: { initDexTiebreaker: false }
        }
    };

    const mockCtxPrivate = {
        getVisibilitySetting: () => 'private',
        getMonsterImageUrl: () => null
    };

    wireInitiativeRoll(container, monster, mockCtxPrivate);

    const initBtn = container.querySelector('.cs-roll-initiative-btn');
    assert.ok(initBtn, 'Initiative button should exist');
    initBtn.click();

    assert.ok(emitted, 'Socket emit should happen on initiative roll');
    assert.equal(emitted.ev, 'chat:whisper', 'Should whisper to GM when visibility is private');
    assert.equal(emitted.data.to, 'GM_Dave');
    assert.ok(emitted.data.text.includes('Secret Assassin'));
});

test('SheetDock preserves isGeneric for Custom NPCs and Companions, enabling instance chips', () => {
    const mockVtt = {
        campaignId: 'camp_1',
        campaignState: {
            characters: {
                npc_goblin: {
                    id: 'npc_goblin',
                    name: 'Goblin Scout',
                    isCustomNpc: true,
                    isGeneric: true,
                    hpMax: 22,
                    hpCurrent: 22,
                    monsterData: { name: 'Goblin Scout', hp: { average: 22 } }
                },
                comp_bear: {
                    id: 'comp_bear',
                    name: 'Barnaby the Bear',
                    isCompanion: true,
                    isGeneric: false,
                    hpMax: 34,
                    hpCurrent: 34,
                    monsterData: { name: 'Barnaby the Bear', hp: { average: 34 } }
                }
            }
        },
        canvasEngine: {
            getTokens: () => ({
                tok_gob_1: { id: 'tok_gob_1', sourceCharacterId: 'npc_goblin', name: 'Goblin Scout', hp: 22, maxHp: 22 },
                tok_gob_2: { id: 'tok_gob_2', sourceCharacterId: 'npc_goblin', name: 'Goblin Scout', hp: 15, maxHp: 22 },
                tok_bear: { id: 'tok_bear', characterId: 'comp_bear', name: 'Barnaby the Bear', hp: 34, maxHp: 34 }
            })
        },
        creatureSheet: {
            openSheet: () => {},
            minimizePanel: () => {}
        },
        playerSheet: {
            openSheet: () => {},
            minimizePanel: () => {}
        }
    };

    const dock = initVttSheetDock(mockVtt);

    // 1. Open Generic Custom NPC
    const genericTab = dock.openSheet({
        type: 'creature',
        characterId: 'npc_goblin',
        isCustomNpc: true,
        isGeneric: true,
        monsterData: mockVtt.campaignState.characters.npc_goblin.monsterData
    });

    assert.equal(genericTab.isGeneric, true, 'Generic Custom NPC tab must have isGeneric: true');
    assert.equal(genericTab.linkedTokenIds.length, 2, 'Should detect both goblin tokens on canvas');

    // Check DOM rendering of instance chips
    const instanceChips = dock.containerEl.querySelectorAll('.tab-instance-chip');
    assert.equal(instanceChips.length, 2, 'Should render 2 instance switcher chips in dock');
    assert.ok(instanceChips[0].textContent.includes('22 HP'), 'Chip #1 should display 22 HP');
    assert.ok(instanceChips[1].textContent.includes('15 HP'), 'Chip #2 should display 15 HP');
    assert.ok(!dock.containerEl.innerHTML.includes('[object Object]'), 'Instance chip must never contain [object Object]');

    // 2. Open Named Companion
    const namedTab = dock.openSheet({
        type: 'creature',
        characterId: 'comp_bear',
        isCompanion: true,
        isGeneric: false,
        monsterData: mockVtt.campaignState.characters.comp_bear.monsterData
    });

    assert.equal(namedTab.isGeneric, false, 'Named Companion tab must have isGeneric: false');
});
