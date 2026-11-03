/**
 * Automated Test Suite: Socket Event Parity & Static Assets Routing
 * Verifies:
 * 1. Initiative visibility settings sync ('initiative:settings') persists to campaign database and broadcasts to room.
 * 2. Non-GM users cannot mutate initiative settings.
 * 3. Inter-map portal event aliases ('map:switch' -> 'map:switch-gm', 'player:map_override' -> 'map:switch-player').
 * 4. Client switchMapTo correctly emits modernized event names ('map:switch-gm' / 'map:switch-player').
 * 5. Static '/img' route fallback in server.js resolves correctly.
 */

import { EventEmitter } from 'events';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runSocketParityTests() {
    console.log('--- STARTING SOCKET EVENT PARITY & ASSET ROUTING TESTS ---\n');

    // Dynamically import server socket and state modules
    const { initSocketServer } = await import('../server/socket.js');
    const { campaigns } = await import('../server/state.js');

    // Setup dummy test campaign in in-memory state
    const testCampaignId = 'socket_test_camp_' + Date.now();
    campaigns[testCampaignId] = {
        id: testCampaignId,
        name: 'Socket Test Campaign',
        initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false },
        activeMapId: 'map_1',
        activeGMMapId: 'map_1',
        playerMapOverrides: {},
        maps: {
            map_1: { id: 'map_1', name: 'Map 1', tokens: { token_player: { id: 'token_player', name: 'Hero', isPlayer: true, characterId: 'char_1' } } },
            map_2: { id: 'map_2', name: 'Map 2', tokens: { token_player: { id: 'token_player', name: 'Hero', isPlayer: true, characterId: 'char_1' } } }
        },
        characters: {
            char_1: { id: 'char_1', characterName: 'Hero', owner: 'Alice' }
        }
    };

    // Build mock Socket.IO server
    let connectionHandler = null;
    const roomBroadcasts = [];

    const mockIo = {
        sockets: {
            adapter: { rooms: new Map([[testCampaignId, new Set(['sock_gm_1', 'sock_player_1'])]]) },
            sockets: new Map()
        },
        on: (event, handler) => {
            if (event === 'connection') connectionHandler = handler;
        },
        to: (room) => ({
            emit: (ev, payload) => {
                roomBroadcasts.push({ room, event: ev, payload });
            }
        }),
        emit: (ev, payload) => {
            roomBroadcasts.push({ room: 'GLOBAL', event: ev, payload });
        }
    };

    initSocketServer(mockIo);
    assert.strictEqual(typeof connectionHandler, 'function', 'initSocketServer must register a connection listener on io');

    // Helper to create mock client socket
    function createMockSocket(id, role, username) {
        const sock = new EventEmitter();
        sock.id = id;
        sock.role = role;
        sock.username = username;
        sock.campaignId = testCampaignId;
        sock.handshake = { headers: {} };
        sock.to = (room) => ({
            emit: (ev, payload) => {
                roomBroadcasts.push({ room, event: ev, payload });
            }
        });
        sock.join = () => {};
        sock.leave = () => {};
        return sock;
    }

    const gmSocket = createMockSocket('sock_gm_1', 'GM', 'DM_Bob');
    const playerSocket = createMockSocket('sock_player_1', 'player', 'Alice');
    mockIo.sockets.sockets.set('sock_gm_1', gmSocket);
    mockIo.sockets.sockets.set('sock_player_1', playerSocket);

    connectionHandler(gmSocket);
    connectionHandler(playerSocket);

    console.log('[Test 1] Testing initiative:settings handler on GM socket...');
    // 1a. GM toggles initiative visibility to true
    roomBroadcasts.length = 0;
    gmSocket.emit('initiative:settings', { visible: true });

    assert.strictEqual(campaigns[testCampaignId].initiative.isVisible, true, 'campaign.initiative.isVisible must be true');
    const broadcast1 = roomBroadcasts.find(b => b.room === testCampaignId && b.event === 'initiative:settings');
    assert.ok(broadcast1, 'initiative:settings must be broadcast to the campaign room');
    assert.strictEqual(broadcast1.payload.visible, true, 'Broadcast payload must indicate visible: true');
    console.log('  ✓ GM initiative:settings correctly updates database and broadcasts to room.');

    // 1b. GM toggles initiative visibility to false
    roomBroadcasts.length = 0;
    gmSocket.emit('initiative:settings', { visible: false });
    assert.strictEqual(campaigns[testCampaignId].initiative.isVisible, false, 'campaign.initiative.isVisible must be false');
    const broadcast2 = roomBroadcasts.find(b => b.room === testCampaignId && b.event === 'initiative:settings');
    assert.ok(broadcast2 && broadcast2.payload.visible === false, 'Broadcast payload must indicate visible: false');
    console.log('  ✓ GM initiative:settings correctly toggles to false.');

    // 1c. Player tries to alter initiative:settings (unauthorized)
    roomBroadcasts.length = 0;
    playerSocket.emit('initiative:settings', { visible: true });
    assert.strictEqual(campaigns[testCampaignId].initiative.isVisible, false, 'Player must NOT be able to alter initiative visibility');
    assert.strictEqual(roomBroadcasts.length, 0, 'No broadcast should occur when player attempts initiative:settings');
    console.log('  ✓ Player initiative:settings mutation safely rejected.');

    console.log('\n[Test 2] Testing Map Switching & Inter-Map Portal Aliases...');
    // 2a. GM modern event: map:switch-gm
    gmSocket.emit('map:switch-gm', { mapId: 'map_2' });
    assert.strictEqual(campaigns[testCampaignId].activeGMMapId, 'map_2', 'activeGMMapId must be updated by map:switch-gm');
    console.log('  ✓ map:switch-gm updates activeGMMapId.');

    // 2b. GM legacy/portal event alias: map:switch
    gmSocket.emit('map:switch', { mapId: 'map_1' });
    assert.strictEqual(campaigns[testCampaignId].activeGMMapId, 'map_1', 'activeGMMapId must be updated by legacy alias map:switch');
    console.log('  ✓ map:switch alias successfully resolves and updates activeGMMapId.');

    // 2c. Player modern event: map:switch-player
    playerSocket.emit('map:switch-player', { mapId: 'map_2' });
    assert.strictEqual(campaigns[testCampaignId].playerMapOverrides['Alice'], 'map_2', 'playerMapOverrides must be updated by map:switch-player');
    console.log('  ✓ map:switch-player updates playerMapOverrides.');

    // 2d. Player legacy/portal event alias: player:map_override
    playerSocket.emit('player:map_override', { mapId: 'map_1' });
    assert.strictEqual(campaigns[testCampaignId].playerMapOverrides['Alice'], 'map_1', 'playerMapOverrides must be updated by legacy alias player:map_override');
    console.log('  ✓ player:map_override alias successfully resolves and updates playerMapOverrides.');

    console.log('\n[Test 3] Testing vtt-canvas.js switchMapTo implementation...');
    const canvasCode = fs.readFileSync(path.join(rootDir, 'vtt/js/vtt-canvas.js'), 'utf8');
    assert.ok(canvasCode.includes("vtt.socket.emit('map:switch-gm'"), "vtt-canvas.js must emit 'map:switch-gm' for GM");
    assert.ok(canvasCode.includes("vtt.socket.emit('map:switch-player'"), "vtt-canvas.js must emit 'map:switch-player' for player");
    assert.ok(!canvasCode.includes("vtt.socket.emit('map:switch',"), "vtt-canvas.js should not emit bare 'map:switch'");
    assert.ok(!canvasCode.includes("vtt.socket.emit('player:map_override',"), "vtt-canvas.js should not emit bare 'player:map_override'");
    console.log('  ✓ vtt-canvas.js switchMapTo verified to emit standardized socket events.');

    console.log('\n[Test 4] Testing server.js static route for /img...');
    const serverCode = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
    assert.ok(serverCode.includes("['/img', '/vtt/img']"), "server.js must register static route for ['/img', '/vtt/img']");
    console.log('  ✓ server.js registers static route for /img and /vtt/img.');

    // Cleanup test campaign
    delete campaigns[testCampaignId];

    console.log('\n======================================================');
    console.log('🎉 ALL SOCKET PARITY & ROUTING TESTS PASSED CLEANLY!');
    console.log('======================================================');
}

runSocketParityTests().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
