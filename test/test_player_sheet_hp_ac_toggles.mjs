/**
 * Test Suite: Player Sheet HP & AC Toggles Engine & Integration
 */

import assert from 'assert';
import {
    calculateEffectiveHp,
    parseAcFormula,
    calculateEffectiveAc,
    getTotalStat,
    getMod
} from '../vtt/js/player-sheet/calc/stats.js';

import {
    renderHpTogglesList,
    ensureHpSettingsModalExists,
    openHpSettingsModal,
    setupHpSettingsListeners,
    renderAcTogglesList,
    ensureAcSettingsModalExists,
    openAcSettingsModal,
    setupAcSettingsListeners
} from '../vtt/js/player-sheet/modals/settings-modal.js';

import * as modalsIndex from '../vtt/js/player-sheet/modals/index.js';

console.log('--- RUNNING PLAYER SHEET HP & AC TOGGLES TEST SUITE ---\n');

// ─── TEST 1: HP Toggles & Current/Max HP Synchronization ───────────────────────
console.log('[TEST 1] Testing HP Toggles & Current/Max HP Delta Engine...');
{
    const char = {
        name: 'Aelar',
        baseHpMax: 40,
        hpMax: 40,
        hpCurrent: 35,
        hpToggles: [
            { id: 't1', name: 'Aid (2nd level)', formula: '+5', enabled: false },
            { id: 't2', name: "Heroes' Feast", formula: '+10', enabled: false }
        ]
    };

    // Initial check
    assert.strictEqual(char.hpMax, 40);
    assert.strictEqual(char.hpCurrent, 35);

    // 1. Enable Aid (+5 Max HP)
    char.hpToggles[0].enabled = true;
    const res1 = calculateEffectiveHp(char);
    assert.strictEqual(res1.hpMax, 45, 'Max HP should increase to 45 with Aid (+5)');
    assert.strictEqual(res1.hpCurrent, 40, 'Current HP should increase by +5 (35 -> 40)');
    assert.strictEqual(char.hpMax, 45);
    assert.strictEqual(char.hpCurrent, 40);

    // 2. Enable Heroes' Feast (+10 Max HP)
    char.hpToggles[1].enabled = true;
    const res2 = calculateEffectiveHp(char);
    assert.strictEqual(res2.hpMax, 55, 'Max HP should increase to 55 with both Aid and Heroes Feast (+15 total)');
    assert.strictEqual(res2.hpCurrent, 50, 'Current HP should increase by +10 (40 -> 50)');

    // 3. Disable Aid (+5) -> Max HP drops from 55 to 50
    char.hpToggles[0].enabled = false;
    const res3 = calculateEffectiveHp(char);
    assert.strictEqual(res3.hpMax, 50, 'Max HP should decrease to 50 when Aid disabled');
    assert.strictEqual(res3.hpCurrent, 45, 'Current HP should decrease by -5 (50 -> 45)');

    // 4. Clamping check: suppose character is at 50/50, and Heroes' Feast (+10) is removed
    char.hpCurrent = 50;
    char.hpToggles[1].enabled = false;
    const res4 = calculateEffectiveHp(char);
    assert.strictEqual(res4.hpMax, 40, 'Max HP should return to base 40');
    assert.strictEqual(res4.hpCurrent, 40, 'Current HP should be clamped to new Max HP of 40');

    // 5. Negative modifier / curse toggle
    char.hpToggles.push({ id: 't3', name: 'Curse of Frailty', formula: '-5', enabled: true });
    const res5 = calculateEffectiveHp(char);
    assert.strictEqual(res5.hpMax, 35, 'Max HP should drop to 35 with -5 curse');
    assert.strictEqual(res5.hpCurrent, 35, 'Current HP should adjust to 35');

    // 6. Minimum clamp: Max HP should never drop below 1
    char.hpToggles.push({ id: 't4', name: 'Massive Drain', formula: '-100', enabled: true });
    const res6 = calculateEffectiveHp(char);
    assert.strictEqual(res6.hpMax, 1, 'Max HP should clamp to at least 1');
    assert.ok(res6.hpCurrent >= 0 && res6.hpCurrent <= 1, 'Current HP clamped to [0, 1]');

    console.log('  ✓ HP toggle activation, delta adjustments, and bounds clamping verified.');
}

// ─── TEST 2: AC Formula Parsing & Ability Token Resolution ────────────────────
console.log('\n[TEST 2] Testing AC Formula Parsing Engine...');
{
    const char = {
        stats: {
            str: 10, // mod 0
            dex: 14, // mod +2
            con: 12, // mod +1
            int: 16, // mod +3
            wis: 8, // mod -1
            cha: 18 // mod +4
        }
    };

    // Flat integers
    assert.strictEqual(parseAcFormula('+2', char), 2);
    assert.strictEqual(parseAcFormula('+5', char), 5);
    assert.strictEqual(parseAcFormula('-2', char), -2);
    assert.strictEqual(parseAcFormula('3', char), 3);

    // Ability tokens
    assert.strictEqual(parseAcFormula('+int', char), 3, 'INT 16 (+3) should yield +3');
    assert.strictEqual(parseAcFormula('+dex', char), 2, 'DEX 14 (+2) should yield +2');
    assert.strictEqual(parseAcFormula('+cha', char), 4, 'CHA 18 (+4) should yield +4');
    assert.strictEqual(parseAcFormula('+wis', char), -1, 'WIS 8 (-1) should yield -1');

    // Case insensitivity & compound tokens
    assert.strictEqual(parseAcFormula('+INT', char), 3);
    assert.strictEqual(parseAcFormula('+dex + 2', char), 4, 'DEX (+2) + 2 should yield 4');

    // Invalid / empty formula
    assert.strictEqual(parseAcFormula('', char), 0);
    assert.strictEqual(parseAcFormula(null, char), 0);

    console.log('  ✓ AC formula parsing (flat integers & ability score modifiers) verified.');
}

// ─── TEST 3: Effective AC Calculation with Toggles ─────────────────────────────
console.log('\n[TEST 3] Testing Effective AC Calculation Engine...');
{
    const char = {
        name: 'MageBlade',
        baseAc: 15,
        acMod: 0,
        stats: {
            dex: 14, // +2
            int: 16 // +3
        },
        acToggles: [
            { id: 'ac1', name: 'Shield Spell', formula: '+5', enabled: false },
            { id: 'ac2', name: 'Bladesong', formula: '+int', enabled: false },
            { id: 'ac3', name: 'Half Cover', formula: '+2', enabled: false }
        ]
    };

    // Initial AC
    assert.strictEqual(calculateEffectiveAc(char), 15);

    // 1. Enable Shield (+5) -> AC = 15 + 5 = 20
    char.acToggles[0].enabled = true;
    assert.strictEqual(calculateEffectiveAc(char), 20);
    assert.strictEqual(char.ac, 20);

    // 2. Enable Bladesong (+int = +3) -> AC = 15 + 5 + 3 = 23
    char.acToggles[1].enabled = true;
    assert.strictEqual(calculateEffectiveAc(char), 23);
    assert.strictEqual(char.ac, 23);

    // 3. Enable Half Cover (+2) -> AC = 15 + 5 + 3 + 2 = 25
    char.acToggles[2].enabled = true;
    assert.strictEqual(calculateEffectiveAc(char), 25);

    // 4. Disable Shield (+5) -> AC = 15 + 3 + 2 = 20
    char.acToggles[0].enabled = false;
    assert.strictEqual(calculateEffectiveAc(char), 20);

    // 5. Global acMod (+1 from magic ring) -> AC = 15 + 1 + 3 + 2 = 21
    char.acMod = 1;
    assert.strictEqual(calculateEffectiveAc(char), 21);

    // 6. Disable all toggles -> AC = 15 + 1 = 16
    char.acToggles.forEach((t) => (t.enabled = false));
    assert.strictEqual(calculateEffectiveAc(char), 16);

    console.log('  ✓ Effective AC calculation with multiple active toggles and modifiers verified.');
}

// ─── TEST 4: Export Contract & Modal Subsystem Integrity ───────────────────────
console.log('\n[TEST 4] Testing Modal Export Contract & Subsystem Integrity...');
{
    // Verify modal functions exported from settings-modal.js
    assert.strictEqual(typeof renderHpTogglesList, 'function');
    assert.strictEqual(typeof ensureHpSettingsModalExists, 'function');
    assert.strictEqual(typeof openHpSettingsModal, 'function');
    assert.strictEqual(typeof setupHpSettingsListeners, 'function');

    assert.strictEqual(typeof renderAcTogglesList, 'function');
    assert.strictEqual(typeof ensureAcSettingsModalExists, 'function');
    assert.strictEqual(typeof openAcSettingsModal, 'function');
    assert.strictEqual(typeof setupAcSettingsListeners, 'function');

    // Verify re-exported from modals/index.js barrel
    assert.strictEqual(typeof modalsIndex.renderHpTogglesList, 'function');
    assert.strictEqual(typeof modalsIndex.ensureHpSettingsModalExists, 'function');
    assert.strictEqual(typeof modalsIndex.openHpSettingsModal, 'function');
    assert.strictEqual(typeof modalsIndex.setupHpSettingsListeners, 'function');

    assert.strictEqual(typeof modalsIndex.renderAcTogglesList, 'function');
    assert.strictEqual(typeof modalsIndex.ensureAcSettingsModalExists, 'function');
    assert.strictEqual(typeof modalsIndex.openAcSettingsModal, 'function');
    assert.strictEqual(typeof modalsIndex.setupAcSettingsListeners, 'function');

    console.log('  ✓ Modal export contract & barrel exports verified.');
}

console.log('\n======================================================');
console.log('🎉 ALL HP & AC TOGGLE TESTS PASSED CLEANLY!');
console.log('======================================================\n');
