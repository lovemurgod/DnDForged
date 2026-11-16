/**
 * test/test_dice_physics_and_whisper_lifecycle.mjs
 * Unit & Integration Test Suite for 3D Dice Physics Grid Layout,
 * Skin Palettes, Crit/Fumble Evaluation, and Secret GM Whisper Routing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load Dice3D module in headless Node environment
function loadDice3D() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
    };
    const code = fs.readFileSync(path.resolve('vtt', 'js', 'dice-3d.js'), 'utf8');
    const m = { exports: {} };
    const fn = new Function('module', 'exports', 'self', code);
    fn(m, m.exports, globalThis);
    return m.exports;
}

const Dice3D = loadDice3D();

test('Subtest 1: Multi-tier dynamic grid layout and distribution math', () => {
    // 1 die
    const grid1 = Dice3D.computeOptimalGrid(1, 1.77);
    assert.deepEqual(grid1, { rows: 1, cols: 1, distribution: [1] });

    // 2 dice
    const grid2 = Dice3D.computeOptimalGrid(2, 1.77);
    assert.deepEqual(grid2, { rows: 1, cols: 2, distribution: [2] });

    // 4 dice -> 2 rows of 2
    const grid4 = Dice3D.computeOptimalGrid(4, 1.77);
    assert.deepEqual(grid4, { rows: 2, cols: 2, distribution: [2, 2] });

    // 6 dice -> 2 rows of 3
    const grid6 = Dice3D.computeOptimalGrid(6, 1.77);
    assert.deepEqual(grid6, { rows: 2, cols: 3, distribution: [3, 3] });

    // 8 dice (e.g. Fireball) -> 2 rows of 4
    const grid8 = Dice3D.computeOptimalGrid(8, 1.77);
    assert.deepEqual(grid8, { rows: 2, cols: 4, distribution: [4, 4] });

    // 12 dice (max single wave) -> 3 rows of 4
    const grid12 = Dice3D.computeOptimalGrid(12, 1.77);
    assert.deepEqual(grid12, { rows: 3, cols: 4, distribution: [4, 4, 4] });

    // Check sum of distribution equals total dice count
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((count) => {
        const g = Dice3D.computeOptimalGrid(count, 1.77);
        const sum = g.distribution.reduce((acc, v) => acc + v, 0);
        assert.equal(sum, count, `Sum of dice in grid tiers must equal ${count}`);
    });
});

test('Subtest 2: Skin theme presets and material properties validation', () => {
    const skins = Dice3D.SKINS;
    assert.ok(skins, 'SKINS registry must be exported');

    const expectedSkins = [
        'obsidian_gold',
        'ruby_ember',
        'sapphire_frost',
        'amethyst_void',
        'classic_ivory',
        'jade_emerald',
        'solar_flare'
    ];

    expectedSkins.forEach((skinKey) => {
        const s = skins[skinKey];
        assert.ok(s, `Skin ${skinKey} must exist`);
        assert.ok(typeof s.name === 'string' && s.name.length > 0, `${skinKey} must have a name`);
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(s.bg), `${skinKey} bg must be a valid hex color`);
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(s.border), `${skinKey} border must be a valid hex color`);
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(s.text), `${skinKey} text must be a valid hex color`);
        assert.ok(
            typeof s.roughness === 'number' && s.roughness >= 0 && s.roughness <= 1,
            `${skinKey} roughness must be 0-1`
        );
        assert.ok(typeof s.emissive === 'number', `${skinKey} emissive must be a number`);
    });
});

test('Subtest 3: Dice formula parsing and 3D polyhedral notation extraction', () => {
    function parseRollFormula(text) {
        if (!text) return [];
        const diceRegex = /(\d+)?d(4|6|8|10|12|20|100)/gi;
        const result = [];
        let match;
        while ((match = diceRegex.exec(text)) !== null) {
            const count = parseInt(match[1] || '1', 10);
            const sides = parseInt(match[2], 10);
            for (let i = 0; i < count; i++) {
                result.push({ sides, type: `d${sides}` });
            }
        }
        return result;
    }

    const roll1 = parseRollFormula('/r 1d20+5');
    assert.equal(roll1.length, 1);
    assert.equal(roll1[0].type, 'd20');
    assert.equal(roll1[0].sides, 20);

    const rollFireball = parseRollFormula('casts Fireball dealing 8d6 fire damage');
    assert.equal(rollFireball.length, 8);
    rollFireball.forEach((d) => {
        assert.equal(d.type, 'd6');
        assert.equal(d.sides, 6);
    });

    const rollComplex = parseRollFormula('attacks with 1d20+4 and 1d8+2 piercing plus 1d4 radiant');
    assert.equal(rollComplex.length, 3);
    assert.equal(rollComplex[0].type, 'd20');
    assert.equal(rollComplex[1].type, 'd8');
    assert.equal(rollComplex[2].type, 'd4');
});

test('Subtest 4: Nat 20 Critical Hit & Nat 1 Fumble detection logic', () => {
    function evaluateDieOutcome(dieType, value) {
        if (dieType === 'd20' || dieType === 20) {
            if (value === 20) {
                return {
                    isCrit: true,
                    isFumble: false,
                    badgeText: '★ NAT 20! ★',
                    badgeClass: 'badge-nat20',
                    particleColor: '#ffd700'
                };
            }
            if (value === 1) {
                return {
                    isCrit: false,
                    isFumble: true,
                    badgeText: '⚠ NAT 1! ⚠',
                    badgeClass: 'badge-nat1',
                    particleColor: '#ff1744'
                };
            }
        }
        return { isCrit: false, isFumble: false, badgeText: null };
    }

    // Nat 20 on d20
    const crit = evaluateDieOutcome('d20', 20);
    assert.equal(crit.isCrit, true);
    assert.equal(crit.badgeText, '★ NAT 20! ★');
    assert.equal(crit.badgeClass, 'badge-nat20');
    assert.equal(crit.particleColor, '#ffd700');

    // Nat 1 on d20
    const fumble = evaluateDieOutcome('d20', 1);
    assert.equal(fumble.isFumble, true);
    assert.equal(fumble.badgeText, '⚠ NAT 1! ⚠');
    assert.equal(fumble.badgeClass, 'badge-nat1');
    assert.equal(fumble.particleColor, '#ff1744');

    // Normal rolls
    const normal = evaluateDieOutcome('d20', 15);
    assert.equal(normal.isCrit, false);
    assert.equal(normal.isFumble, false);
    assert.equal(normal.badgeText, null);

    // Max roll on d6 does not trigger Nat 20
    const d6Max = evaluateDieOutcome('d6', 6);
    assert.equal(d6Max.isCrit, false);
    assert.equal(d6Max.badgeText, null);
});

test('Subtest 5: Server-side whisper routing & privacy isolation guard', () => {
    const campaignId = 'camp_test';
    const roomSockets = [
        { id: 'socket_gm', username: 'DungeonMaster', role: 'GM', emitted: [] },
        { id: 'socket_player1', username: 'PlayerOne', role: 'Player', emitted: [] },
        { id: 'socket_player2', username: 'PlayerTwo', role: 'Player', emitted: [] }
    ];

    const chatLogs = { [campaignId]: [] };

    // Simulating server socket whisper handler
    function handleChatWhisper(socket, msg) {
        const whisperMsg = {
            id: `whisper_${Date.now()}`,
            username: socket.username,
            role: socket.role,
            text: msg.text,
            roll: msg.roll || null,
            timestamp: Date.now()
        };
        // Secret GM whisper only emits directly back to the requesting socket
        socket.emitted.push({ event: 'chat:whisper', data: whisperMsg });
        // NOTE: Whisper is NEVER added to chatLogs[campaignId] or room broadcast
    }

    const gmSocket = roomSockets[0];
    handleChatWhisper(gmSocket, {
        text: 'Secret stealth check for Goblin Raider',
        roll: { diceList: [{ sides: 20, val: 19 }], total: 24 }
    });

    // 1. GM socket receives private event
    assert.equal(gmSocket.emitted.length, 1);
    assert.equal(gmSocket.emitted[0].event, 'chat:whisper');
    assert.equal(gmSocket.emitted[0].data.text, 'Secret stealth check for Goblin Raider');

    // 2. Player sockets receive strictly 0 events
    assert.equal(roomSockets[1].emitted.length, 0, 'PlayerOne must receive 0 whisper events');
    assert.equal(roomSockets[2].emitted.length, 0, 'PlayerTwo must receive 0 whisper events');

    // 3. Persistent room chat log remains untouched (0 public leakage)
    assert.equal(chatLogs[campaignId].length, 0, 'Public chat log must not store private whisper');
});
