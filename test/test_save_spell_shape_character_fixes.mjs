// Automated Verification Suite for:
// 1. NPC Spellcasting formatting (object / string spell names)
// 2. Saving throws chatcard resolution damage application & sync
// 3. Persistent shapes center/anchor selection and deletion
// 4. Character sheet auto-open on character creation

import assert from 'node:assert';
import fs from 'node:fs';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;

console.log('--- Starting Verification Suite: Save, Spell, Shape, and Character Fixes ---');

// =========================================================================
// Suite 1: NPC Spellcasting List Formatting
// =========================================================================
console.log('\n[Suite 1] NPC Spellcasting formatting with object & string spells');
{
    const modSpells = await import('../vtt/js/creature-sheet/creature-spells.js');
    const { findExistingSpell, ensureNpcSpells } = modSpells;

    // Test 1.1: findExistingSpell doesn't crash when passed an object or string
    const mockMonster = {
        spellcasting: [
            {
                id: 'sc_0',
                spellsObj: {
                    cantrip: [{ id: 'sp_1', name: 'Fire Bolt' }],
                    level1: [{ id: 'sp_2', name: 'Shield' }]
                }
            }
        ]
    };

    assert.strictEqual(findExistingSpell('fire bolt', null, mockMonster)?.id, 'sp_1');
    assert.strictEqual(findExistingSpell({ name: 'Shield' }, null, mockMonster)?.id, 'sp_2');
    assert.strictEqual(findExistingSpell({ spell: 'Fire Bolt' }, null, mockMonster)?.id, 'sp_1');
    assert.strictEqual(findExistingSpell(null, null, mockMonster), null);
    assert.strictEqual(findExistingSpell(undefined, null, mockMonster), null);
    assert.strictEqual(findExistingSpell({}, null, mockMonster), null);

    // Test 1.2: ensureNpcSpells handles 5etools bestiary formatted spells with {@spell ...} and objects
    const complexMonster = {
        name: 'Mage NPC',
        cr: '6',
        spellcasting: [
            {
                name: 'Spellcasting',
                type: 'spellcasting',
                spellsByLevel: {
                    '0': {
                        spells: ['{@spell light}', { name: 'Mage Hand' }]
                    },
                    '1': {
                        spells: ['{@spell magic missile}', { name: 'Shield' }]
                    }
                }
            }
        ]
    };

    const resultSpells = ensureNpcSpells(complexMonster);
    assert.ok(resultSpells.cantrip.length >= 2, 'Cantrips parsed successfully');
    assert.strictEqual(resultSpells.cantrip[0].name, 'Light');
    assert.strictEqual(resultSpells.cantrip[1].name, 'Mage Hand');
    assert.ok(resultSpells.level1.length >= 2, 'Level 1 spells parsed successfully');
    assert.strictEqual(resultSpells.level1[0].name, 'Magic Missile');
    assert.strictEqual(resultSpells.level1[1].name, 'Shield');

    console.log('✓ Suite 1 passed: NPC spellcasting correctly formats object and string spells without toLowerCase error.');
}

// =========================================================================
// Suite 2: Saving Throw Chatcard Resolution Damage Application
// =========================================================================
console.log('\n[Suite 2] Saving Throw chatcard resolution damage application');
{
    const modRollers = await import('../vtt/js/canvas/tokens/vtt-canvas-token-rollers.js');
    const { resolveSaveFromChat } = modRollers;

    let appliedDamage = 0;
    let appliedMultiplier = 0;
    let syncedTokens = null;

    const mockTokens = {
        tok_1: { id: 'tok_1', name: 'Goblin 1', hp: 20, maxHp: 20, x: 100, y: 100 },
        tok_2: { id: 'tok_2', name: 'Goblin 2', hp: 20, maxHp: 20, x: 200, y: 200 }
    };

    const mockSaveCard = {
        cardData: {
            dmgRolls: [{ total: 10, formula: '2d6+3', type: 'fire' }]
        },
        results: [
            { tokenId: 'tok_1', passed: true },  // Succeeded
            { tokenId: 'tok_2', passed: false }  // Failed
        ]
    };

    const options = {
        vtt: { role: 'GM', socket: { emit: () => {} } },
        tokens: mockTokens,
        currentMapId: 'map_1',
        applyCardDamageToToken: (token, dmgRolls, mult) => {
            appliedDamage += dmgRolls[0].total * mult;
            appliedMultiplier = mult;
            token.hp -= dmgRolls[0].total * mult;
            return dmgRolls[0].total * mult;
        },
        syncTokensHpToCharacters: (affected) => {
            syncedTokens = affected;
        },
        getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
        triggerDamageFXAnimation: () => {},
        renderAll: () => {}
    };

    // Test with applyHalf = true (pass = 50% dmg, fail = 100% dmg)
    resolveSaveFromChat(mockSaveCard, true, 'msg_1', options);

    assert.strictEqual(mockTokens.tok_1.hp, 15, 'Succeeded token took half damage (5 dmg)');
    assert.strictEqual(mockTokens.tok_2.hp, 10, 'Failed token took full damage (10 dmg)');
    assert.strictEqual(syncedTokens?.length, 2, 'Both tokens were included in character HP sync');

    console.log('✓ Suite 2 passed: resolveSaveFromChat successfully applies half/full damage and syncs HP.');
}

// =========================================================================
// Suite 3: Persistent Shapes Selection and Deletion
// =========================================================================
console.log('\n[Suite 3] Persistent shapes center hit-testing, selection & deletion');
{
    const modShapes = await import('../vtt/js/canvas/vtt-canvas-shapes.js');
    const { getShapeComponentAtCoord, isShapeControlledByPlayer } = modShapes;

    const shapes = {
        shape_circle: {
            id: 'shape_circle',
            shape: 'circle',
            type: 'circle',
            layer: 'token',
            startPoint: { x: 200, y: 200 },
            endPoint: { x: 250, y: 200 }
        }
    };

    // Test 3.1: GM has control
    assert.strictEqual(isShapeControlledByPlayer(shapes.shape_circle, 'GM', 'admin'), true);

    // Test 3.2: Component hit detection within 16px radius of center (200, 200)
    const hitNearCenter = getShapeComponentAtCoord(205, 205, shapes, { role: 'GM', username: 'admin' });
    assert.ok(hitNearCenter, 'Detected shape hit near center point (within 16px)');
    assert.strictEqual(hitNearCenter.shapeId, 'shape_circle');
    assert.strictEqual(hitNearCenter.type, 'shape');

    // Test 3.3: Beyond 16px does not hit center handle in strict reference mode
    const missFarFromCenter = getShapeComponentAtCoord(230, 230, shapes, { role: 'GM', username: 'admin' });
    assert.strictEqual(missFarFromCenter, null, 'Misses handle beyond 16px (matches reference)');

    // Test 3.4: Deletion via deleteSelection in clipboard shortcuts
    const modShortcuts = await import('../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js');
    const { setupKeyboardShortcuts } = modShortcuts;

    let emittedUpdate = false;
    const ctx = {
        vtt: { role: 'GM', username: 'admin', socket: { emit: (ev) => { if (ev === 'shapes:update') emittedUpdate = true; } } },
        tokens: {},
        selectedTokenIds: new Set(),
        shapes: { ...shapes },
        selectedShapeIds: new Set(['shape_circle']),
        activeLayer: 'token',
        isShapeControlledByPlayer: (s) => isShapeControlledByPlayer(s, 'GM', 'admin'),
        renderAll: () => {}
    };

    const shortcuts = setupKeyboardShortcuts(ctx);
    shortcuts.deleteSelection();

    assert.strictEqual(ctx.shapes.shape_circle, undefined, 'Shape deleted from ctx.shapes');
    assert.strictEqual(emittedUpdate, true, 'shapes:update socket event emitted');

    console.log('✓ Suite 3 passed: Shapes accurately hit-test by handles/center and deleteSelection removes them.');
}

// =========================================================================
// Suite 4: Character Sheet Auto-Open on New Character
// =========================================================================
console.log('\n[Suite 4] Character Sheet auto-open on character creation');
{
    const html = fs.readFileSync('vtt/index.html', 'utf8');
    const dom = new JSDOM(html, { url: 'http://localhost:5050' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.sessionStorage = { getItem: () => null, setItem: () => {} };

    const vtt = {
        role: 'GM',
        username: 'DM',
        campaignState: { characters: {} },
        socket: { emit: () => {}, on: () => {} }
    };
    window.VTT = vtt;

    const modPs = await import('../vtt/js/vtt-player-sheet.js');
    const ps = modPs.initVttPlayerSheet(vtt);
    window.VTT.playerSheet = ps;

    const btnAdd = document.getElementById('btn-char-add');
    assert.ok(btnAdd, 'btn-char-add exists in DOM');

    // Simulate clicking the "New" button
    btnAdd.click();

    const charIds = Object.keys(vtt.campaignState.characters);
    assert.strictEqual(charIds.length, 1, 'Character created in campaignState');
    const newChar = vtt.campaignState.characters[charIds[0]];
    assert.ok(newChar.attackSettings, 'attackSettings initialized on new character');
    assert.strictEqual(newChar.attackSettings.atkMod, 0);

    const panel = document.getElementById('player-sheet-panel');
    assert.ok(panel.classList.contains('open'), 'player-sheet-panel has "open" class after creation');
    assert.strictEqual(panel.classList.contains('minimized'), false, 'player-sheet-panel is not minimized');

    console.log('✓ Suite 4 passed: Character sheet renders without error and opens automatically.');
}

console.log('\n======================================================');
console.log('ALL VERIFICATION SUITES PASSED SUCCESSFULLY!');
console.log('======================================================');

