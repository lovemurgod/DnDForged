/**
 * test_socket_event_parity.mjs
 * Automated Test Suite: Socket Event Parity & Static Assets Routing
 * Standardized with node:test and test/helpers/ infrastructure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createMockCampaign, createMockToken, createMockCharacter } from './helpers/factories.mjs';
import { MockSocket } from './helpers/mock-socket.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Socket Event Parity & Asset Routing', async (t) => {
    const { initSocketServer } = await import('../server/socket.js');
    const { campaigns } = await import('../server/state.js');

    const testCampaign = createMockCampaign({
        name: 'Socket Test Campaign',
        activeMapId: 'map_1',
        activeGMMapId: 'map_1',
        maps: {
            map_1: {
                id: 'map_1',
                name: 'Map 1',
                tokens: {
                    token_player: createMockToken({
                        id: 'token_player',
                        name: 'Hero',
                        isPlayer: true,
                        characterId: 'char_1'
                    })
                }
            },
            map_2: {
                id: 'map_2',
                name: 'Map 2',
                tokens: {
                    token_player: createMockToken({
                        id: 'token_player',
                        name: 'Hero',
                        isPlayer: true,
                        characterId: 'char_1'
                    })
                }
            }
        },
        characters: {
            char_1: createMockCharacter({ id: 'char_1', characterName: 'Hero', owner: 'Alice' })
        }
    });

    const testCampaignId = testCampaign.id;
    campaigns[testCampaignId] = testCampaign;

    t.after(() => {
        delete campaigns[testCampaignId];
    });

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
    assert.strictEqual(
        typeof connectionHandler,
        'function',
        'initSocketServer must register a connection listener on io'
    );

    function createClientSocket(id, role, username) {
        const sock = new MockSocket({ id });
        sock.role = role;
        sock.username = username;
        sock.campaignId = testCampaignId;
        sock.handshake = { headers: {} };
        sock.to = (room) => ({
            emit: (ev, payload) => {
                roomBroadcasts.push({ room, event: ev, payload });
            }
        });
        return sock;
    }

    const gmSocket = createClientSocket('sock_gm_1', 'GM', 'DM_Bob');
    const playerSocket = createClientSocket('sock_player_1', 'player', 'Alice');
    mockIo.sockets.sockets.set('sock_gm_1', gmSocket);
    mockIo.sockets.sockets.set('sock_player_1', playerSocket);

    connectionHandler(gmSocket);
    connectionHandler(playerSocket);

    await t.test('1. GM initiative:settings correctly updates state and broadcasts to room', () => {
        roomBroadcasts.length = 0;
        gmSocket.emit('initiative:settings', { visible: true });

        assert.strictEqual(
            campaigns[testCampaignId].initiative.isVisible,
            true,
            'campaign.initiative.isVisible must be true'
        );
        const broadcast1 = roomBroadcasts.find((b) => b.room === testCampaignId && b.event === 'initiative:settings');
        assert.ok(broadcast1, 'initiative:settings must be broadcast to the campaign room');
        assert.strictEqual(broadcast1.payload.visible, true, 'Broadcast payload must indicate visible: true');

        // Toggle back to false
        roomBroadcasts.length = 0;
        gmSocket.emit('initiative:settings', { visible: false });
        assert.strictEqual(
            campaigns[testCampaignId].initiative.isVisible,
            false,
            'campaign.initiative.isVisible must be false'
        );
        const broadcast2 = roomBroadcasts.find((b) => b.room === testCampaignId && b.event === 'initiative:settings');
        assert.ok(broadcast2 && broadcast2.payload.visible === false, 'Broadcast payload must indicate visible: false');
    });

    await t.test('2. Player initiative:settings mutation is safely rejected', () => {
        roomBroadcasts.length = 0;
        playerSocket.emit('initiative:settings', { visible: true });
        assert.strictEqual(
            campaigns[testCampaignId].initiative.isVisible,
            false,
            'Player must NOT be able to alter initiative visibility'
        );
        assert.strictEqual(
            roomBroadcasts.length,
            0,
            'No broadcast should occur when player attempts initiative:settings'
        );
    });

    await t.test('3. Map switching and inter-map portal aliases resolve properly', () => {
        // GM modern event: map:switch-gm
        gmSocket.emit('map:switch-gm', { mapId: 'map_2' });
        assert.strictEqual(
            campaigns[testCampaignId].activeGMMapId,
            'map_2',
            'activeGMMapId must be updated by map:switch-gm'
        );

        // GM legacy/portal event alias: map:switch
        gmSocket.emit('map:switch', { mapId: 'map_1' });
        assert.strictEqual(
            campaigns[testCampaignId].activeGMMapId,
            'map_1',
            'activeGMMapId must be updated by legacy alias map:switch'
        );

        // Player modern event: map:switch-player
        playerSocket.emit('map:switch-player', { mapId: 'map_2' });
        assert.strictEqual(
            campaigns[testCampaignId].playerMapOverrides['Alice'],
            'map_2',
            'playerMapOverrides must be updated by map:switch-player'
        );

        // Player legacy/portal event alias: player:map_override
        playerSocket.emit('player:map_override', { mapId: 'map_1' });
        assert.strictEqual(
            campaigns[testCampaignId].playerMapOverrides['Alice'],
            'map_1',
            'playerMapOverrides must be updated by legacy alias player:map_override'
        );
    });

    await t.test('4. vtt-canvas.js switchMapTo emits standardized socket events', () => {
        const canvasCode = fs.readFileSync(path.join(rootDir, 'vtt/js/vtt-canvas.js'), 'utf8');
        assert.ok(
            canvasCode.includes("vtt.socket.emit('map:switch-gm'"),
            "vtt-canvas.js must emit 'map:switch-gm' for GM"
        );
        assert.ok(
            canvasCode.includes("vtt.socket.emit('map:switch-player'"),
            "vtt-canvas.js must emit 'map:switch-player' for player"
        );
        assert.ok(
            !canvasCode.includes("vtt.socket.emit('map:switch',"),
            "vtt-canvas.js should not emit bare 'map:switch'"
        );
        assert.ok(
            !canvasCode.includes("vtt.socket.emit('player:map_override',"),
            "vtt-canvas.js should not emit bare 'player:map_override'"
        );
    });

    await t.test('5. server.js registers static routes for /img and /vtt/img', () => {
        const serverCode = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
        assert.ok(
            serverCode.includes("['/img', '/vtt/img']"),
            "server.js must register static route for ['/img', '/vtt/img']"
        );
    });
});
