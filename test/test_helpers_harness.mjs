/**
 * test/test_helpers_harness.mjs
 * Verification suite for the test/helpers/ infrastructure:
 * factories.mjs, vtt-environment.mjs, and mock-socket.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMockToken,
    createMockCharacter,
    createMockMap,
    createMockWall,
    createMockCampaign,
    createMockVtt,
    generateTestId
} from './helpers/factories.mjs';

import { setupVttEnvironment, teardownVttEnvironment, createMockCanvas2DContext } from './helpers/vtt-environment.mjs';

import { createMockSocket, MockSocket } from './helpers/mock-socket.mjs';

test('Harness Infrastructure: Factories & Fixtures', async (t) => {
    await t.test('generateTestId produces unique sequential identifiers', () => {
        const id1 = generateTestId('test');
        const id2 = generateTestId('test');
        assert.notEqual(id1, id2);
        assert.ok(id1.startsWith('test_'));
        assert.ok(id2.startsWith('test_'));
    });

    await t.test('createMockToken returns schema-compliant tabletop token', () => {
        const token = createMockToken({ name: 'Skeleton Archer', hp: 20, maxHp: 20, ac: 13 });
        assert.equal(token.name, 'Skeleton Archer');
        assert.equal(token.hp, 20);
        assert.equal(token.maxHp, 20);
        assert.equal(token.ac, 13);
        assert.equal(token.baseAc, 12);
        assert.equal(token.x, 100);
        assert.equal(token.y, 100);
        assert.equal(token.layer, 'token');
        assert.equal(token.rotation, 0);
        assert.equal(token.flipX, false);
        assert.equal(token.flipY, false);
        assert.ok(Array.isArray(token.conditions));
    });

    await t.test('createMockCharacter returns valid 5e character sheet', () => {
        const char = createMockCharacter({
            characterName: 'Elminster',
            stats: { str: 8, dex: 14, con: 12, int: 20, wis: 16, cha: 14 }
        });
        assert.equal(char.characterName, 'Elminster');
        assert.equal(char.stats.int, 20);
        assert.equal(char.stats.str, 8);
        assert.equal(char.level, 1);
        assert.equal(char.proficiencyBonus, 2);
        assert.ok(Array.isArray(char.classes));
        assert.ok(Array.isArray(char.proficiencies.languages));
        assert.ok(char.proficiencies.languages.includes('Common'));
    });

    await t.test('createMockMap and createMockWall produce valid map geometry', () => {
        const map = createMockMap({ name: 'Crypt of Shadows' });
        assert.equal(map.name, 'Crypt of Shadows');
        assert.equal(map.gridSize, 50);
        assert.equal(map.gridType, 'square');
        assert.ok(Array.isArray(map.walls));

        const wall = createMockWall({ p1: { x: 50, y: 50 }, p2: { x: 150, y: 50 }, door: 1 });
        assert.equal(wall.door, 1);
        assert.deepEqual(wall.p1, { x: 50, y: 50 });
        assert.deepEqual(wall.p2, { x: 150, y: 50 });
    });

    await t.test('createMockCampaign and createMockVtt configure full tabletop context', () => {
        const camp = createMockCampaign({ name: 'Curse of Strahd' });
        assert.equal(camp.name, 'Curse of Strahd');
        assert.equal(camp.gmUsername, 'GM');
        assert.ok(camp.activeMapId);
        assert.ok(camp.maps[camp.activeMapId]);

        const vtt = createMockVtt({ role: 'player', username: 'Alice' });
        assert.equal(vtt.role, 'player');
        assert.equal(vtt.username, 'Alice');
        assert.equal(typeof vtt.socket.emit, 'function');
    });
});

test('Harness Infrastructure: Headless VTT Environment Lifecycle', async (t) => {
    t.after(() => {
        teardownVttEnvironment();
    });

    await t.test('setupVttEnvironment attaches window, document, and canvas proxies', () => {
        const dom = setupVttEnvironment({
            localStorageData: { 'forgedvtt-theme': 'dark' }
        });

        assert.ok(globalThis.window, 'window must be mounted');
        assert.ok(globalThis.document, 'document must be mounted');
        assert.ok(globalThis.localStorage, 'localStorage must be mounted');

        assert.equal(globalThis.localStorage.getItem('forgedvtt-theme'), 'dark');
        globalThis.localStorage.setItem('test-key', '123');
        assert.equal(globalThis.localStorage.getItem('test-key'), '123');

        // Test Canvas 2D Mock Context
        const canvas = globalThis.document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        assert.ok(ctx, 'Canvas 2D context must be returned');

        // Verify gradient and text methods do not crash
        const grad = ctx.createLinearGradient(0, 0, 100, 100);
        assert.equal(typeof grad.addColorStop, 'function');
        grad.addColorStop(0, 'black');
        grad.addColorStop(1, 'white');

        const metrics = ctx.measureText('Hello World');
        assert.ok(metrics.width > 0);
    });

    await t.test('teardownVttEnvironment cleanly removes globals', () => {
        teardownVttEnvironment();
        // Since node execution environment does not have native browser window/document
        assert.equal(globalThis.window, undefined);
        assert.equal(globalThis.document, undefined);
        assert.equal(globalThis.localStorage, undefined);
    });
});

test('Harness Infrastructure: MockSocket Communication', async (t) => {
    await t.test('records emitted events and supports room targeting', () => {
        const socket = createMockSocket();

        socket.emit('token:move', { id: 'tok_1', x: 200, y: 250 });
        socket.to('campaign_1').emit('chat:message', { text: 'Attack roll: 18' });
        socket.broadcast.emit('initiative:sync', { round: 2 });

        assert.equal(socket.emitted.length, 3);

        const moveEvent = socket.getLastEmitted('token:move');
        assert.ok(moveEvent);
        assert.equal(moveEvent.data.id, 'tok_1');
        assert.equal(moveEvent.data.x, 200);

        const chatEvent = socket.getLastEmitted('chat:message');
        assert.ok(chatEvent);
        assert.equal(chatEvent.targetRoom, 'campaign_1');
        assert.equal(chatEvent.isBroadcast, true);

        const initEvent = socket.getLastEmitted('initiative:sync');
        assert.ok(initEvent);
        assert.equal(initEvent.isBroadcast, true);
    });

    await t.test('simulateServerBroadcast dispatches to registered listeners', () => {
        const socket = createMockSocket();
        let receivedData = null;

        socket.on('map:updated', (payload) => {
            receivedData = payload;
        });

        socket.simulateServerBroadcast('map:updated', { mapId: 'map_crypt', name: 'Crypt' });
        assert.deepEqual(receivedData, { mapId: 'map_crypt', name: 'Crypt' });
    });

    await t.test('acknowledgment callbacks are supported on emit', async () => {
        const socket = createMockSocket();
        const ackResult = await new Promise((resolve) => {
            socket.emit('token:select', { id: 'tok_1' }, (response) => {
                resolve(response);
            });
        });
        assert.deepEqual(ackResult, { success: true });
    });
});
