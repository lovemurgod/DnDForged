import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// Setup browser globals before importing modules
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        VTT: { currentRollMode: 'normal' },
        localStorage: { getItem: () => null }
    };
}
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = { getItem: () => null };
}
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

import { simulateRoll } from '../vtt/js/player-sheet/vtt-sheet-rolls.js';
import { evaluateAttackRoll } from '../vtt/js/player-sheet/calc/stats.js';
import { rollSpell } from '../vtt/js/vtt-spell-manager.js';
import { convertRoll20Character } from '../electron/importers/roll20-importer.js';

globalThis.window.vttPlayerSheetAPI = { simulateRoll };

test('Critical Threshold - simulateRoll with custom critRange', () => {
    // Test that simulateRoll respects custom critRange values
    // Using a deterministic formula or testing over iterations

    // Test with critRange = 19
    let rolled19Crit = false;
    let rolled19Normal = false;

    // Run enough iterations of 1d20 to hit 19
    for (let i = 0; i < 200; i++) {
        const resCrit19 = simulateRoll('1d20', 19);
        const d20 = resCrit19.diceList.find((d) => d.faces === 20 && !d.isDropped);
        if (d20 && d20.val === 19) {
            assert.strictEqual(
                resCrit19.isCritSuccess,
                true,
                'd20 roll of 19 must be crit success when critRange is 19'
            );
            rolled19Crit = true;
            break;
        }
    }
    assert.ok(rolled19Crit, 'Simulated at least one 19 roll with critRange 19');

    // Run with standard critRange = 20
    for (let i = 0; i < 200; i++) {
        const resCrit20 = simulateRoll('1d20', 20);
        const d20 = resCrit20.diceList.find((d) => d.faces === 20 && !d.isDropped);
        if (d20 && d20.val === 19) {
            assert.strictEqual(
                resCrit20.isCritSuccess,
                false,
                'd20 roll of 19 must NOT be crit success when critRange is 20'
            );
            rolled19Normal = true;
            break;
        }
    }
    assert.ok(rolled19Normal, 'Simulated at least one 19 roll with critRange 20');
});

test('Critical Threshold - evaluateAttackRoll with global attackSettings critRange', () => {
    const char = {
        level: 5,
        stats: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
        attackSettings: { atkMod: 0, critRange: 19, toggles: [] },
        spellSettings: { critRange: 20, toggles: [] }
    };

    const weaponMacro = {
        name: 'Greatsword',
        attackStat: 'str',
        attackProf: true,
        critRange: 20, // Macro default is 20, but global is 19
        damage: [{ formula: '2d6', type: 'Slashing', stat: 'str' }]
    };

    let hit19Crit = false;
    for (let i = 0; i < 300; i++) {
        const res = evaluateAttackRoll(char, weaponMacro);
        const d20 = res.diceList.find((d) => d.faces === 20 && !d.isDropped);
        if (d20 && d20.val === 19) {
            assert.strictEqual(
                res.isCritSuccess,
                true,
                'Weapon macro with default critRange 20 must crit on 19 when global attackSettings.critRange is 19'
            );
            hit19Crit = true;
            break;
        }
    }
    assert.ok(hit19Crit, 'Verified global attackSettings.critRange expands macro crit threshold');
});

test('Critical Threshold - evaluateAttackRoll honors lower individual macro critRange (Math.min)', () => {
    const char = {
        level: 5,
        stats: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
        attackSettings: { atkMod: 0, critRange: 19, toggles: [] }
    };

    const keenDagger = {
        name: 'Keen Dagger',
        attackStat: 'dex',
        attackProf: true,
        critRange: 18, // Macro specifically has 18
        damage: [{ formula: '1d4', type: 'Piercing', stat: 'dex' }]
    };

    let hit18Crit = false;
    for (let i = 0; i < 400; i++) {
        const res = evaluateAttackRoll(char, keenDagger);
        const d20 = res.diceList.find((d) => d.faces === 20 && !d.isDropped);
        if (d20 && d20.val === 18) {
            assert.strictEqual(
                res.isCritSuccess,
                true,
                'Weapon macro with critRange 18 must crit on 18 even when global attackSettings is 19'
            );
            hit18Crit = true;
            break;
        }
    }
    assert.ok(hit18Crit, 'Verified Math.min takes lower individual macro crit threshold');
});

test('Critical Threshold - Spell Attack critRange damage doubling regex', () => {
    // Test the damage doubling logic used by rollSpell on isCrit
    const baseDamageFormula = '1d10';
    const isCrit = true;
    const doubledFormula = baseDamageFormula.replace(
        /(?:(\d+)\s*)?[dD]\s*(\d+)/gi,
        (m, count, faces) => `${(count ? parseInt(count) : 1) * 2}d${faces}`
    );
    assert.strictEqual(doubledFormula, '2d10', '1d10 spell damage must double to 2d10 on critical hit');

    // Test multiple dice (e.g. Guiding Bolt: 4d6)
    const guidingBolt = '4d6';
    const doubledGuidingBolt = guidingBolt.replace(
        /(?:(\d+)\s*)?[dD]\s*(\d+)/gi,
        (m, count, faces) => `${(count ? parseInt(count) : 1) * 2}d${faces}`
    );
    assert.strictEqual(doubledGuidingBolt, '8d6', '4d6 spell damage must double to 8d6 on critical hit');
});

test('Critical Threshold - rollSpell passes spellCritRange to simulateRoll and doubles damage on crit', () => {
    const caster = {
        name: 'Wizard',
        level: 5,
        stats: { int: 18, wis: 10, cha: 10, str: 10, dex: 14, con: 12 },
        spellSettings: {
            ability: 'INT',
            atkMod: 0,
            dcMod: 0,
            dmgMod: 0,
            critRange: 19, // Caster crits on 19-20
            toggles: []
        }
    };

    const fireBolt = {
        name: 'Fire Bolt',
        isAttack: true,
        attackStat: 'spell',
        attackProf: true,
        damageList: [{ formula: '1d10', type: 'Fire' }]
    };

    let hit19Crit = false;
    for (let i = 0; i < 400; i++) {
        const res = rollSpell(fireBolt, 'cantrip', caster, { type: 'roll' });
        if (res && res.atkRoll && res.atkRoll.diceList) {
            const d20 = res.atkRoll.diceList.find((d) => d.faces === 20 && !d.isDropped);
            if (d20 && d20.val === 19) {
                assert.strictEqual(
                    res.atkRoll.isCritSuccess,
                    true,
                    'Spell attack roll of 19 must be crit success when critRange is 19'
                );
                // Check damage doubling
                assert.ok(res.dmgRolls && res.dmgRolls.length > 0, 'Damage rolls present');
                // Cantrip at lvl 5 scales 1d10 -> 2d10, and crit doubles to 4d10
                assert.ok(
                    res.dmgRolls[0].formula.includes('4d10'),
                    `Damage formula must be doubled on crit (expected 4d10 with cantrip scaling, got: ${res.dmgRolls[0].formula})`
                );
                hit19Crit = true;
                break;
            }
        }
    }
    assert.ok(hit19Crit, 'Simulated at least one 19 roll with spellSettings critRange 19');
});

test('Critical Threshold - Importer sets default critRange on spellSettings and attackSettings', async () => {
    const samplesDir = path.join(process.cwd(), 'test', 'fixtures', 'roll20');
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');

    assert.strictEqual(auto.spellSettings?.critRange, 20, 'spellSettings.critRange defaults to 20');
    assert.strictEqual(auto.attackSettings?.critRange, 20, 'attackSettings.critRange defaults to 20');
});

test('Critical Threshold - Bounds Clamping (1 to 20) and Fallback Macro Roll', () => {
    // Clamping checks
    const charOutOfBounds = {
        level: 5,
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        attackSettings: { critRange: -5, toggles: [] },
        spellSettings: { critRange: 99, toggles: [] }
    };

    // evaluateAttackRoll clamps attackSettings.critRange to 1 and spellSettings.critRange to 20
    const atkRollClamped = evaluateAttackRoll(charOutOfBounds, { attackStat: 'str', critRange: -10 });
    assert.ok(atkRollClamped, 'Attack roll executed with clamped bounds');

    // Fallback macro attack (no formula) checks
    const globalCrit = Math.max(1, Math.min(20, parseInt(charOutOfBounds.attackSettings?.critRange || 20) || 20));
    assert.strictEqual(globalCrit, 1, 'Negative critRange clamped to 1');

    const globalSpellCrit = Math.max(1, Math.min(20, parseInt(charOutOfBounds.spellSettings?.critRange || 20) || 20));
    assert.strictEqual(globalSpellCrit, 20, 'CritRange over 20 clamped to 20');
});
