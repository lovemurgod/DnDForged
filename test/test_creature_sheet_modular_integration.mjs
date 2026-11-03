// Test Suite: Creature Sheet Modular Subsystems & Lifecycle Integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ─── Setup Headless DOM & Global Environment ──────────────────────────────
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
    <div id="creature-sheet-panel" class="creature-panel">
        <button id="creature-sheet-minimize-btn"></button>
        <div id="vtt-creature-sheet-panel">
            <div id="cs-tab-spells"></div>
            <div id="cs-tab-stats"></div>
        </div>
    </div>
    <select id="config-roll-visibility">
        <option value="public" selected>Public</option>
        <option value="private">GM Secret</option>
    </select>
</body>
</html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;

const storage = {};
globalThis.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => {
        storage[k] = String(v);
    },
    removeItem: (k) => {
        delete storage[k];
    }
};

// ─── Import Subsystem Modules ─────────────────────────────────────────────
import {
    parse5eMarkup,
    injectDiceChips,
    calcDiceAverage,
    entryToPlainText,
    evaluateDiceHelper,
    getProfBonus,
    getModifier,
    formatModifier,
    parseAc,
    buildSpeedString,
    STANDARD_DAMAGE_TYPES
} from '../vtt/js/creature-sheet/creature-parser.js';

import {
    resolveSpellcastingType,
    get5eSlotsForCaster,
    ensureSpellcastingFromTraits,
    ensureNpcSpells,
    expendNpcSpellResource,
    getMaxSlotsForLevel
} from '../vtt/js/creature-sheet/creature-spells.js';

import { parseActionMacro, rollAndPostToChat, getVisibilitySetting } from '../vtt/js/creature-sheet/creature-roller.js';

import {
    defenseToEditableRows,
    editableRowsToDefenses,
    parseDefenseTextInput
} from '../vtt/js/creature-sheet/creature-editor.js';

import { initVttCreatureSheet } from '../vtt/js/vtt-creature-sheet.js';

// ─── 1. Creature Parser Tests ─────────────────────────────────────────────
test('Creature Parser Subsystem', async (t) => {
    await t.test('parse5eMarkup expands standard 5e tag syntax', () => {
        const mw = parse5eMarkup('{@atk mw} {@hit 7} to hit, reach 5 ft.');
        assert.ok(mw.includes('<strong>Melee Weapon Attack:</strong>'));
        assert.ok(mw.includes('+7 to hit'));

        const dmg = parse5eMarkup('Hit: {@damage 2d6 + 4} slashing damage.');
        assert.ok(dmg.includes('2d6 + 4'));

        const dc = parse5eMarkup('The target must make a {@dc 15} {@actSave con} saving throw.');
        assert.ok(dc.includes('<strong>DC 15</strong>'));
        assert.ok(dc.includes('<strong>CON Saving Throw:</strong>'));

        const recharge = parse5eMarkup('Breath Weapon {@recharge 5}');
        assert.ok(recharge.includes('<strong>(Recharge 5–6)</strong>'));
    });

    await t.test('injectDiceChips embeds clickable dice roll buttons and DC chips', () => {
        const raw = 'Hit: 14 (3d8 + 1) piercing damage. DC 16 Dexterity save.';
        const injected = injectDiceChips(raw);
        assert.ok(injected.includes('class="dice-chip"'));
        assert.ok(injected.includes('data-formula="3d8+1"'));
        assert.ok(injected.includes('class="dice-chip dc-chip"'));
        assert.ok(injected.includes('data-dc="16"'));
    });

    await t.test('calcDiceAverage computes mathematical dice averages', () => {
        assert.strictEqual(calcDiceAverage('1d6'), 3);
        assert.strictEqual(calcDiceAverage('1d8+2'), 6);
        assert.strictEqual(calcDiceAverage('2d6+3'), 10);
        assert.strictEqual(calcDiceAverage('8d6'), 28);
    });

    await t.test('entryToPlainText flattens nested entries and itemSub structures', () => {
        const complex = [
            'Basic text',
            {
                type: 'list',
                items: [
                    { type: 'item', name: 'Item Alpha', entry: 'Detail Alpha' },
                    { type: 'itemSub', name: 'Sub Beta', entries: ['Detail Beta'] }
                ]
            }
        ];
        const flat = entryToPlainText(complex);
        assert.ok(flat.includes('Basic text'));
        assert.ok(flat.includes('Item Alpha: Detail Alpha'));
        assert.ok(flat.includes('Sub Beta: Detail Beta'));
    });

    await t.test('evaluateDiceHelper computes rolls, breakdowns and crits', () => {
        const standard = evaluateDiceHelper('1d20+5');
        assert.ok(standard.total >= 6 && standard.total <= 25);
        assert.ok(Array.isArray(standard.diceList));
        assert.strictEqual(standard.diceList.length, 1);

        const crit = evaluateDiceHelper('2d6+3', true);
        assert.ok(crit.total >= 7 && crit.total <= 27);
        // On crit, 2d6 becomes 4d6 (4 dice total)
        assert.strictEqual(crit.diceList.length, 4);
    });

    await t.test('stat formatters calculate correct values', () => {
        assert.strictEqual(getProfBonus('0'), 2);
        assert.strictEqual(getProfBonus('5'), 3);
        assert.strictEqual(getProfBonus('13'), 5);
        assert.strictEqual(getProfBonus('25'), 8);

        assert.strictEqual(getModifier(10), 0);
        assert.strictEqual(getModifier(18), 4);
        assert.strictEqual(getModifier(8), -1);

        assert.strictEqual(formatModifier(3), '+3');
        assert.strictEqual(formatModifier(-2), '-2');

        const speed = buildSpeedString({ walk: 30, fly: 60, canHover: true });
        assert.ok(speed.includes('30 ft.'));
        assert.ok(speed.includes('Fly 60 ft. (hover)'));

        const ac = parseAc({ ac: [{ value: 18, from: ['natural armor'] }] });
        assert.strictEqual(ac.value, 18);
        assert.ok(ac.from.includes('natural armor'));
    });
});

// ─── 2. Creature Spells Subsystem ─────────────────────────────────────────
test('Creature Spells Subsystem', async (t) => {
    await t.test('resolveSpellcastingType distinguishes caster types', () => {
        assert.strictEqual(resolveSpellcastingType({ type: 'innate' }), 'innate');
        assert.strictEqual(resolveSpellcastingType({ name: 'Innate Spellcasting' }), 'innate');
        assert.strictEqual(resolveSpellcastingType({ name: 'Pact Magic' }), 'pact');
        assert.strictEqual(
            resolveSpellcastingType({ name: 'Spellcasting', spellsByLevel: { 1: { slots: 4 } } }),
            'slot'
        );
    });

    await t.test('get5eSlotsForCaster provides SRD slot progression', () => {
        const lvl1 = get5eSlotsForCaster('slot', 1);
        assert.strictEqual(lvl1.level1, 2);

        const lvl5 = get5eSlotsForCaster('slot', 5);
        assert.strictEqual(lvl5.level1, 4);
        assert.strictEqual(lvl5.level2, 3);
        assert.strictEqual(lvl5.level3, 2);

        const pact = get5eSlotsForCaster('pact', 5);
        assert.strictEqual(pact.level3, 2);
    });

    await t.test('ensureSpellcastingFromTraits and ensureNpcSpells parses traits into structured spellbooks', () => {
        const monster = {
            name: 'Mage',
            trait: [
                {
                    name: 'Spellcasting',
                    entries: [
                        'The mage is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit).',
                        'Cantrips (at will): fire bolt, light, mage hand, prestidigitation',
                        '1st level (4 slots): detect magic, mage armor, magic missile, shield',
                        '2nd level (3 slots): misty step, suggestion',
                        '3rd level (3 slots): counterspell, fireball, fly'
                    ]
                }
            ]
        };

        ensureSpellcastingFromTraits(monster);
        assert.ok(Array.isArray(monster.spellcasting));
        assert.strictEqual(monster.spellcasting.length, 1);
        assert.strictEqual(monster.spellcasting[0].type, 'slot');

        const spells = ensureNpcSpells(monster);
        assert.ok(spells.cantrip.length >= 4);
        assert.ok(spells.level1.length >= 4);
        assert.ok(spells.level3.some((s) => s.name === 'Fireball'));
    });

    await t.test('expendNpcSpellResource decrements slot counts and daily frequency', () => {
        const monster = {
            name: 'Fey',
            dailyUsages: {},
            spellSlots: { level1: { current: 3, max: 4 } }
        };

        const innateSpell = { id: 'sp_innate_1', dailyKey: '3e', usesMax: 3 };
        expendNpcSpellResource(monster, innateSpell, 'cantrip', {
            getContentEl: () => document.getElementById('vtt-creature-sheet-panel')
        });
        assert.strictEqual(monster.dailyUsages['sp_innate_1'], 2);
    });
});

// ─── 3. Creature Roller Subsystem ─────────────────────────────────────────
test('Creature Roller Subsystem', async (t) => {
    await t.test('parseActionMacro extracts full attack and damage metadata', () => {
        const abilityName = 'Scimitar';
        const rawEntries = [
            '{@atk mw} {@hit 5} to hit, reach 5 ft., one target. Hit: 6 ({@damage 1d6 + 3}) slashing damage plus 7 ({@damage 2d6}) poison damage.'
        ];
        const macro = parseActionMacro(abilityName, rawEntries, '', 'Goblin Boss', null, 'normal');

        assert.ok(macro.atkRoll);
        assert.strictEqual(macro.atkRoll.formula, '1d20+5');
        assert.strictEqual(macro.dmgRolls.length, 2);
        assert.strictEqual(macro.dmgRolls[0].type, 'Slashing');
        assert.strictEqual(macro.dmgRolls[1].type, 'Poison');
    });

    await t.test('parseActionMacro detects save DC and rider effects', () => {
        const abilityName = 'Bite';
        const rawEntries = [
            '{@atk mw} {@hit 4} to hit. Hit: 5 ({@damage 1d6 + 2}) piercing damage, and the target must make a {@dc 11} {@actSave con} saving throw, taking 10 ({@damage 3d6}) poison damage on a failed save.'
        ];
        const macro = parseActionMacro(abilityName, rawEntries, '', 'Giant Spider', null, 'normal');

        assert.ok(macro.atkRoll);
        assert.ok(macro.saveInfo);
        assert.strictEqual(macro.saveInfo.dc, 11);
        assert.strictEqual(macro.saveInfo.ability, 'CON');
        assert.strictEqual(macro.dmgRolls.length, 2);
        assert.strictEqual(macro.dmgRolls[0].saveRider, false);
        assert.strictEqual(macro.dmgRolls[1].saveRider, true);
    });

    await t.test('rollAndPostToChat emits socket message based on roll visibility', () => {
        let lastEmitted = null;
        let lastEvent = null;
        const mockVtt = {
            username: 'TestGM',
            socket: {
                emit: (event, payload) => {
                    lastEvent = event;
                    lastEmitted = payload;
                }
            }
        };

        const ctx = {
            getVtt: () => mockVtt,
            getVisibilitySetting: () => 'public'
        };

        rollAndPostToChat('1d20+4', 'Initiative', ctx);
        assert.strictEqual(lastEvent, 'chat:msg');
        assert.ok(lastEmitted.text.includes('Initiative'));
        assert.ok(lastEmitted.roll);

        const privateCtx = {
            getVtt: () => mockVtt,
            getVisibilitySetting: () => 'private'
        };
        rollAndPostToChat('1d20+4', 'Secret Roll', privateCtx);
        assert.strictEqual(lastEvent, 'chat:whisper');
        assert.strictEqual(lastEmitted.to, 'TestGM');
    });
});

// ─── 4. Creature Editor Subsystem ─────────────────────────────────────────
test('Creature Editor Subsystem', async (t) => {
    await t.test('defenseToEditableRows and editableRowsToDefenses maintain round-trip fidelity', () => {
        const originalDefenses = [
            'fire',
            { types: ['bludgeoning', 'piercing'], bypasses: ['magic'], note: 'from nonmagical attacks' }
        ];

        const rows = defenseToEditableRows(originalDefenses);
        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].types[0], 'fire');
        assert.deepStrictEqual(rows[1].bypasses, ['magic']);

        const compiled = editableRowsToDefenses(rows);
        assert.strictEqual(compiled.length, 2);
        assert.strictEqual(compiled[0], 'fire');
        assert.deepStrictEqual(compiled[1].bypasses, ['magic']);
    });

    await t.test('parseDefenseTextInput converts comma-separated strings with bypass notes', () => {
        const input = 'fire, cold, bludgeoning from nonmagical attacks that are not silvered';
        const parsed = parseDefenseTextInput(input);
        assert.ok(Array.isArray(parsed));
        assert.ok(parsed.includes('fire'));
        assert.ok(parsed.includes('cold'));
    });
});

// ─── 5. Master Orchestrator Lifecycle ─────────────────────────────────────
test('Master Orchestrator Lifecycle', async (t) => {
    await t.test('initVttCreatureSheet establishes public API contract and window assignment', () => {
        const mockVtt = {
            socket: { emit: () => {}, on: () => {} },
            role: 'GM',
            username: 'GM'
        };

        const api = initVttCreatureSheet(mockVtt);
        assert.ok(api);
        assert.strictEqual(typeof api.openSheet, 'function');
        assert.strictEqual(typeof api.openPanel, 'function');
        assert.strictEqual(typeof api.minimizePanel, 'function');
        assert.strictEqual(typeof api.openEditModal, 'function');
        assert.strictEqual(typeof api.resetSheet, 'function');
        assert.strictEqual(typeof api.getCurrentMonster, 'function');

        assert.strictEqual(window.vttCreatureSheetAPI, api);
    });

    await t.test('openPanel and minimizePanel manipulate panel classList', () => {
        const mockVtt = { socket: { emit: () => {}, on: () => {} } };
        const api = initVttCreatureSheet(mockVtt);
        const panel = document.getElementById('creature-sheet-panel');

        api.openPanel();
        assert.ok(panel.classList.contains('open'));
        assert.ok(!panel.classList.contains('minimized'));

        api.minimizePanel();
        assert.ok(!panel.classList.contains('open'));
        assert.ok(panel.classList.contains('minimized'));
    });

    await t.test('resetSheet clears active monster and restores placeholder', () => {
        const mockVtt = { socket: { emit: () => {}, on: () => {} } };
        const api = initVttCreatureSheet(mockVtt);
        const contentEl = document.getElementById('vtt-creature-sheet-panel');

        api.resetSheet();
        assert.strictEqual(api.getCurrentMonster(), null);
        assert.ok(contentEl.innerHTML.includes('cs-placeholder'));
    });
});
