import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure window & browser globals exist for module loading
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        simulateRoll: (f) => {
            return { total: 15, breakdownStr: '10 + 5', diceList: [{ val: 10, type: 20 }], isCritSuccess: false, isCritFail: false };
        },
        vttPlayerSheetAPI: {
            simulateRoll: (f) => ({ total: 8, breakdownStr: '8' })
        }
    };
}
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

import { rollSpell } from '../vtt/js/vtt-spell-manager.js';
import { processCardFullResolution } from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

test('Spell Save DC Guard: Kasimir Velikov Fire Bolt does not generate spurious saveInfo', () => {
    const bestiaryPath = path.join(__dirname, '../vtt/data/bestiary-normalized/bestiary-cos.json');
    const cosData = JSON.parse(fs.readFileSync(bestiaryPath, 'utf8'));
    const kasimir = cosData.find(c => c.name.includes('Kasimir Velikov'));
    assert.ok(kasimir, 'Kasimir Velikov exists in bestiary-cos.json');

    const sc = kasimir.spellcasting[0];
    const fireBolt = sc.spellsByLevel['0'].spells.find(s => s.name === 'Fire Bolt');
    assert.ok(fireBolt, 'Fire Bolt cantrip found on Kasimir');
    assert.equal(fireBolt.saveAbility, '');
    assert.equal(fireBolt.dc, null);

    let emittedCard = null;
    const mockCtx = {
        postMacroCard: (card) => {
            emittedCard = card;
        }
    };

    // Roll Fire Bolt
    const resultCard = rollSpell(fireBolt, 'cantrip', kasimir, {
        type: 'roll',
        castLvl: 0,
        postCardFn: (c) => { emittedCard = c; }
    });

    const card = emittedCard || resultCard;
    assert.ok(card, 'Card was returned/emitted');
    assert.ok(card.atkRoll, 'Fire Bolt has an attack roll');
    assert.equal(card.saveInfo, null, 'Fire Bolt must NOT have saveInfo');
    assert.equal(card.saveDc, undefined, 'Fire Bolt must NOT have saveDc');
    assert.equal(card.saveAbility, undefined, 'Fire Bolt must NOT have saveAbility');
});

test('Spell Save DC Guard: Strahd von Zarovich Ray of Frost does not generate spurious saveInfo', () => {
    const bestiaryPath = path.join(__dirname, '../vtt/data/bestiary-normalized/bestiary-cos.json');
    const cosData = JSON.parse(fs.readFileSync(bestiaryPath, 'utf8'));
    const strahd = cosData.find(c => c.name.includes('Strahd von Zarovich'));
    assert.ok(strahd, 'Strahd von Zarovich exists in bestiary-cos.json');

    const sc = strahd.spellcasting[0];
    const rayOfFrost = sc.spellsByLevel['0'].spells.find(s => s.name === 'Ray of Frost');
    assert.ok(rayOfFrost, 'Ray of Frost cantrip found on Strahd');

    let emittedCard = null;
    const resultCard = rollSpell(rayOfFrost, 'cantrip', strahd, {
        type: 'roll',
        castLvl: 0,
        postCardFn: (c) => { emittedCard = c; }
    });

    const card = emittedCard || resultCard;
    assert.ok(card, 'Card was returned/emitted');
    assert.ok(card.atkRoll, 'Ray of Frost has an attack roll');
    assert.equal(card.saveInfo, null, 'Ray of Frost must NOT have saveInfo');
    assert.equal(card.saveDc, undefined, 'Ray of Frost must NOT have saveDc');
});

test('Spell Save DC Guard: Fireball properly generates saveInfo', () => {
    const bestiaryPath = path.join(__dirname, '../vtt/data/bestiary-normalized/bestiary-cos.json');
    const cosData = JSON.parse(fs.readFileSync(bestiaryPath, 'utf8'));
    const kasimir = cosData.find(c => c.name.includes('Kasimir Velikov'));

    const sc = kasimir.spellcasting[0];
    const fireball = sc.spellsByLevel['3'].spells.find(s => s.name === 'Fireball');
    assert.ok(fireball, 'Fireball found on Kasimir');

    let emittedCard = null;
    const resultCard = rollSpell(fireball, 3, kasimir, {
        type: 'roll',
        castLvl: 3,
        postCardFn: (c) => { emittedCard = c; }
    });

    const card = emittedCard || resultCard;
    assert.ok(card, 'Card was returned/emitted');
    assert.equal(card.atkRoll, null, 'Fireball does not have an attack roll');
    assert.ok(card.saveInfo, 'Fireball must have saveInfo');
    assert.equal(card.saveInfo.ability, 'DEX', 'Fireball save ability is DEX');
    assert.equal(card.saveInfo.dc, 14, 'Kasimir Fireball DC is 14');
});

test('Spell Save DC Guard: Dual Attack + Save spell (Ice Knife style) preserves both', () => {
    const iceKnife = {
        name: 'Ice Knife',
        attackStat: 'spell',
        saveAbility: 'dexterity',
        saveDcStat: 'spell',
        damageList: [
            { formula: '1d10', type: 'Piercing' },
            { formula: '2d6', type: 'Cold', saveRider: true }
        ]
    };

    const caster = {
        name: 'Mage',
        int: 16,
        proficiencyBonus: 3,
        spellcastingAbility: 'int'
    };

    let emittedCard = null;
    const resultCard = rollSpell(iceKnife, 1, caster, {
        type: 'roll',
        castLvl: 1,
        postCardFn: (c) => { emittedCard = c; }
    });

    const card = emittedCard || resultCard;
    assert.ok(card, 'Card was returned/emitted');
    assert.ok(card.atkRoll, 'Ice knife has attack roll');
    assert.ok(card.saveInfo, 'Ice knife has saveInfo');
    assert.equal(card.saveInfo.ability, 'DEX');
    // DC = 8 + 3 (pb) + 3 (int) = 14
    assert.equal(card.saveInfo.dc, 14);
});

test('Process Button: Malformed legacy card with ability "SAVE" is filtered out and resolves damage directly vs AC', () => {
    let damageApplied = false;
    let savePromptTriggered = false;

    const mockCard = {
        macroName: 'Fire Bolt',
        atkRoll: { total: 16, isCritSuccess: false, isCritFail: false },
        saveInfo: { ability: 'SAVE', dc: 10 },
        saveDc: 10,
        saveAbility: 'SAVE',
        dmgRolls: [{ formula: '1d10', type: 'Fire', roll: { total: 8 } }]
    };

    const targetToken = {
        id: 'token-1',
        name: 'Goblin',
        x: 100,
        y: 100,
        hp: 15,
        maxHp: 15,
        ac: 13
    };

    const tokens = { 'token-1': targetToken };

    processCardFullResolution(mockCard, ['token-1'], {
        tokens,
        vtt: { role: 'GM' },
        currentMapId: 'map-1',
        resolveTokenAcFn: () => 13,
        syncHpFn: (affected) => {
            if (affected.length > 0) damageApplied = true;
        },
        triggerDamageFXAnimation: () => {}
    });

    assert.equal(targetToken.hp, 7, 'Target token took 8 damage from Fire Bolt (15 - 8 = 7)');
    assert.ok(damageApplied, 'Damage application was synced');
});
