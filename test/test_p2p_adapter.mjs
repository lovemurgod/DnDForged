import test from 'node:test';
import assert from 'node:assert/strict';
import '../vtt/js/network/vtt-p2p-host-engine.js';
import '../vtt/js/network/vtt-p2p-adapter.js';

const { VttP2PAdapter, VttP2PHostEngine, DEFAULT_ICE_SERVERS } = globalThis;
import { p2pBridge, DEFAULT_STUN_SERVERS } from '../server/p2p-bridge.js';

test('[P2P Adapter] Default ICE and STUN servers are configured with Google and Cloudflare', () => {
    assert.ok(Array.isArray(DEFAULT_ICE_SERVERS));
    assert.strictEqual(DEFAULT_ICE_SERVERS.length, 3);
    assert.ok(DEFAULT_ICE_SERVERS.some((s) => s.urls.includes('google.com')));
    assert.ok(DEFAULT_ICE_SERVERS.some((s) => s.urls.includes('cloudflare.com')));

    assert.ok(Array.isArray(DEFAULT_STUN_SERVERS));
    assert.ok(DEFAULT_STUN_SERVERS.some((s) => s.includes('google.com')));
    assert.ok(DEFAULT_STUN_SERVERS.some((s) => s.includes('cloudflare.com')));
});

test('[P2P Adapter] Instance initialization and Socket.io interface emulation', () => {
    const adapter = new VttP2PAdapter({
        isHost: true,
        role: 'GM',
        username: 'DungeonMaster',
        campaignId: 'camp_curse_of_strahd'
    });

    assert.strictEqual(adapter.isHost, true);
    assert.strictEqual(adapter.role, 'GM');
    assert.strictEqual(adapter.username, 'DungeonMaster');
    assert.strictEqual(adapter.campaignId, 'camp_curse_of_strahd');
    assert.strictEqual(adapter.connected, false);
    assert.ok(adapter.id.startsWith('p2p_'));
    assert.ok(adapter.io);
    assert.strictEqual(typeof adapter.on, 'function');
    assert.strictEqual(typeof adapter.off, 'function');
    assert.strictEqual(typeof adapter.once, 'function');
    assert.strictEqual(typeof adapter.emit, 'function');
});

test('[P2P Adapter] Event bus dispatching, once, and off behavior', () => {
    const adapter = new VttP2PAdapter();
    let regularCount = 0;
    let onceCount = 0;

    const handler = (data) => {
        regularCount += data.inc;
    };

    adapter.on('token:moved', handler);
    adapter.once('dice:roll', () => {
        onceCount++;
    });

    adapter._dispatch('token:moved', { inc: 2 });
    adapter._dispatch('token:moved', { inc: 3 });
    assert.strictEqual(regularCount, 5);

    adapter._dispatch('dice:roll');
    adapter._dispatch('dice:roll');
    assert.strictEqual(onceCount, 1);

    adapter.off('token:moved', handler);
    adapter._dispatch('token:moved', { inc: 10 });
    assert.strictEqual(regularCount, 5);
});

test('[P2P Adapter] Base64 encoding and decoding for manual invite text', () => {
    const originalText = JSON.stringify({
        room: 'DUNGEON-42',
        sdp: { type: 'offer', sdp: 'v=0\r\no=- 42 2 IN IP4 127.0.0.1' },
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 5050 typ host'
    });

    const encoded = VttP2PAdapter.encodeBase64(originalText);
    assert.ok(typeof encoded === 'string');
    assert.ok(encoded.length > 0);

    const decoded = VttP2PAdapter.decodeBase64(encoded);
    assert.strictEqual(decoded, originalText);
});

test('[P2P Adapter] Binary chunk reassembly for battlemaps and token assets', async () => {
    const adapter = new VttP2PAdapter();
    const assetId = 'map_dragon_lair_highres';
    const sampleImageBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    let receivedAsset = null;
    adapter.on('asset:received', (data) => {
        receivedAsset = data;
    });

    // Simulate receiving asset-start
    adapter._handleIncomingData({
        type: 'asset-start',
        id: assetId,
        totalChunks: 2,
        totalBytes: sampleImageBase64.length,
        mimeType: 'image/png',
        meta: { name: 'Dragon Lair' }
    });

    const chunk1 = sampleImageBase64.slice(0, 40);
    const chunk2 = sampleImageBase64.slice(40);

    // Simulate receiving chunks out of order or sequentially
    adapter._handleIncomingData({
        type: 'asset-chunk',
        id: assetId,
        index: 1,
        data: chunk2
    });

    adapter._handleIncomingData({
        type: 'asset-chunk',
        id: assetId,
        index: 0,
        data: chunk1
    });

    assert.ok(receivedAsset);
    assert.strictEqual(receivedAsset.id, assetId);
    assert.strictEqual(receivedAsset.url, `data:image/png;base64,${sampleImageBase64}`);
    assert.strictEqual(receivedAsset.meta.name, 'Dragon Lair');
});

test('[P2P Adapter] Authoritative GM campaign sanitization prevents secret leaks to players', () => {
    const adapter = new VttP2PAdapter({ isHost: true, role: 'GM' });

    const rawCampaign = {
        id: 'camp_001',
        name: 'The Underdark Expedition',
        gmPasswordHash: 'secret_salt_hash_xyz',
        gmCredentials: { user: 'DM', salt: '123', hash: 'abc' },
        activeGMMapId: 'map_dm_secret_dungeon',
        activeMapId: 'map_surface',
        maps: {
            map_surface: {
                id: 'map_surface',
                name: 'Surface Camp',
                tokens: {
                    tok_hero1: { id: 'tok_hero1', name: 'Paladin', layer: 'token', isVisible: true },
                    tok_hidden_assassin: { id: 'tok_hidden_assassin', name: 'Stalker', layer: 'token', hidden: true },
                    tok_gm_note: { id: 'tok_gm_note', name: 'Ambush Trigger', layer: 'gm' }
                },
                portals: [
                    { id: 'port_1', name: 'Camp Exit', isSecret: false },
                    { id: 'port_secret', name: 'Hidden Tunnel', isSecret: true }
                ],
                traps: [{ id: 'trap_pit', damage: '2d6' }],
                notes: [{ title: 'DM Plot Twist' }]
            }
        }
    };

    const sanitized = adapter._sanitizeCampaignStateForPlayer(rawCampaign, 'PlayerBob');

    // Secrets stripped
    assert.strictEqual(sanitized.gmPasswordHash, undefined);
    assert.strictEqual(sanitized.gmCredentials, undefined);
    assert.strictEqual(sanitized.activeGMMapId, undefined);

    const map = sanitized.maps.map_surface;
    assert.ok(map);
    // Hidden and GM layer tokens removed
    assert.ok(map.tokens.tok_hero1);
    assert.strictEqual(map.tokens.tok_hidden_assassin, undefined);
    assert.strictEqual(map.tokens.tok_gm_note, undefined);

    // Traps and secret portals removed
    assert.deepStrictEqual(map.traps, []);
    assert.deepStrictEqual(map.notes, []);
    assert.strictEqual(map.portals.length, 1);
    assert.strictEqual(map.portals[0].name, 'Camp Exit');
});

test('[Server P2P Bridge] Room lifecycle, peer registry, and synthetic socket creation', () => {
    // 1. Room generation and start
    const room = p2pBridge.startRoom();
    assert.ok(p2pBridge.active);
    assert.ok(typeof room.roomCode === 'string');
    assert.match(room.roomCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // 2. Peer tracking
    const peer1 = p2pBridge.registerPeer('peer_alpha', { username: 'Gimli', role: 'Player' });
    assert.strictEqual(p2pBridge.peers.size, 1);
    assert.strictEqual(peer1.username, 'Gimli');

    const status = p2pBridge.getStatus();
    assert.strictEqual(status.active, true);
    assert.strictEqual(status.peerCount, 1);
    assert.strictEqual(status.peers[0].username, 'Gimli');

    // 3. Synthetic socket creation
    const synthSocket = p2pBridge.createSyntheticSocket('peer_alpha', 'Gimli', 'Player');
    assert.strictEqual(synthSocket.id, 'p2p_peer_alpha');
    assert.strictEqual(synthSocket.isP2P, true);
    assert.strictEqual(synthSocket.username, 'Gimli');
    assert.strictEqual(synthSocket.role, 'Player');
    assert.strictEqual(typeof synthSocket.disconnect, 'function');

    // 4. Peer disconnect
    synthSocket.disconnect();
    assert.strictEqual(p2pBridge.peers.size, 0);

    // 5. Stop room
    const stopRes = p2pBridge.stopRoom();
    assert.strictEqual(stopRes.success, true);
    assert.strictEqual(p2pBridge.active, false);
});

test('[P2P Adapter] Host mid-session campaign:state-sync broadcast is sanitized per peer', () => {
    const host = new VttP2PAdapter({ isHost: true, role: 'GM' });

    const sentPackets = [];
    const mockPeer = {
        id: 'peer_player_1',
        username: 'PlayerLegolas',
        role: 'Player',
        eventsChannel: {
            readyState: 'open',
            send: (msg) => sentPackets.push(JSON.parse(msg))
        }
    };
    host.peers.set(mockPeer.id, mockPeer);

    const rawCampState = {
        id: 'camp_underdark',
        name: 'The Underdark',
        gmPasswordHash: 'secret_123',
        maps: {
            map_dungeon: {
                id: 'map_dungeon',
                name: 'Dungeon Level 1',
                tokens: {
                    tok_hero: { id: 'tok_hero', name: 'Ranger', layer: 'token', isVisible: true },
                    tok_gm_ambush: { id: 'tok_gm_ambush', name: 'Mind Flayer', layer: 'gm' }
                },
                traps: [{ id: 'trap_poison', dmg: '3d6' }],
                portals: [{ name: 'Secret Door', isSecret: true }]
            }
        }
    };

    // Host emits mid-session campaign:state-sync
    host.emit('campaign:state-sync', rawCampState);

    assert.strictEqual(sentPackets.length, 1);
    const packet = sentPackets[0];
    assert.strictEqual(packet.event, 'campaign:state-sync');

    const sanitized = packet.args[0];
    assert.strictEqual(sanitized.gmPasswordHash, undefined);

    const dungeon = sanitized.maps.map_dungeon;
    assert.ok(dungeon.tokens.tok_hero);
    assert.strictEqual(dungeon.tokens.tok_gm_ambush, undefined);
    assert.deepStrictEqual(dungeon.traps, []);
    assert.deepStrictEqual(dungeon.portals, []);
});

test('[P2P Adapter] Host suppresses GM-layer and hidden token movements from players', () => {
    const host = new VttP2PAdapter({ isHost: true, role: 'GM' });

    const sentPackets = [];
    const mockPeer = {
        id: 'peer_player_2',
        username: 'PlayerGimli',
        role: 'Player',
        eventsChannel: {
            readyState: 'open',
            send: (msg) => sentPackets.push(JSON.parse(msg))
        }
    };
    host.peers.set(mockPeer.id, mockPeer);

    // 1. Moving a GM-layer token must be suppressed
    host.emit('token:update', {
        mapId: 'map_01',
        token: { id: 'tok_gm_guard', name: 'Secret Guard', layer: 'gm', x: 100, y: 100 }
    });
    assert.strictEqual(sentPackets.length, 0);

    // 2. Moving a hidden token must be suppressed
    host.emit('token:update', {
        mapId: 'map_01',
        token: { id: 'tok_stealth', name: 'Invisible Rogue', layer: 'token', hidden: true }
    });
    assert.strictEqual(sentPackets.length, 0);

    // 3. Moving a visible player token MUST be broadcast
    host.emit('token:update', {
        mapId: 'map_01',
        token: { id: 'tok_visible', name: 'Fighter', layer: 'token', isVisible: true, x: 200, y: 200 }
    });
    assert.strictEqual(sentPackets.length, 1);
    assert.strictEqual(sentPackets[0].event, 'token:update');
    assert.strictEqual(sentPackets[0].args[0].token.name, 'Fighter');
});

test('[P2P Adapter] Incomplete asset chunk transfer TTL cleanup', () => {
    const adapter = new VttP2PAdapter();
    const assetId = 'map_abandoned_transfer';

    // Start transfer
    adapter._handleIncomingData({
        type: 'asset-start',
        id: assetId,
        totalChunks: 10,
        totalBytes: 640000,
        mimeType: 'image/jpeg'
    });

    assert.strictEqual(adapter._assetTransfers.has(assetId), true);
    const transfer = adapter._assetTransfers.get(assetId);
    assert.ok(transfer.timeoutId);

    // Disconnect must clear all transfer timers and purge memory
    adapter.disconnect();
    assert.strictEqual(adapter._assetTransfers.size, 0);
});

test('[P2P Host Engine] Enforces permissions, token visibility transitions, and rolltables state', () => {
    const campaign = {
        id: 'camp_p2p_engine',
        name: 'P2P Test Campaign',
        activeMapId: 'map_1',
        activeGMMapId: 'map_1',
        characters: {
            char_hero: { id: 'char_hero', name: 'Valeros', owner: 'Alice', assignedPlayers: ['Alice'] }
        },
        maps: {
            map_1: {
                id: 'map_1',
                name: 'Tavern',
                tokens: {
                    tok_hero: {
                        id: 'tok_hero',
                        name: 'Valeros',
                        owner: 'Alice',
                        layer: 'token',
                        hidden: false,
                        isVisible: true,
                        x: 100,
                        y: 100
                    },
                    tok_ambush: {
                        id: 'tok_ambush',
                        name: 'Goblin Assassin',
                        layer: 'token',
                        hidden: true,
                        isVisible: false,
                        x: 200,
                        y: 200
                    }
                },
                walls: [],
                lights: [],
                notes: [],
                traps: [],
                portals: [],
                drawings: {},
                shapes: {}
            }
        },
        initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false },
        rollTables: { tables: [], assetTables: [], decks: [] }
    };

    const prevVtt = globalThis.VTT;
    globalThis.VTT = { campaignState: campaign, chatHistory: [] };

    try {
        const host = new VttP2PAdapter({
            isHost: true,
            role: 'GM',
            username: 'DM',
            campaignId: 'camp_p2p_engine'
        });
        host.connected = true;

        const playerPackets = [];
        const alicePeer = {
            id: 'p2p_alice',
            joined: true,
            role: 'Player',
            username: 'Alice',
            eventsChannel: {
                readyState: 'open',
                send: (msg) => playerPackets.push(JSON.parse(msg))
            }
        };
        host.peers.set(alicePeer.id, alicePeer);

        // Player cannot execute GM-only events (blocked by _isPlayerAllowedEvent)
        host._handleIncomingData({ type: 'event', event: 'map:switch', args: [{ mapId: 'map_other' }] }, alicePeer);
        assert.strictEqual(campaign.activeMapId, 'map_1');

        // Player CAN update their own visible token
        playerPackets.length = 0;
        host._handleIncomingData(
            {
                type: 'event',
                event: 'token:update_delta',
                args: [{ mapId: 'map_1', tokenId: 'tok_hero', changes: { x: 250, y: 300 } }]
            },
            alicePeer
        );
        assert.strictEqual(campaign.maps.map_1.tokens.tok_hero.x, 250);
        assert.ok(playerPackets.some((p) => p.event === 'token:updated_delta' && p.args?.[0]?.changes?.x === 250));

        // GM reveals hidden token -> must emit token:added to players and token:updated_delta locally
        playerPackets.length = 0;
        let localDeltaCount = 0;
        host.on('token:updated_delta', () => {
            localDeltaCount++;
        });
        host.emit('token:update_delta', {
            mapId: 'map_1',
            tokenId: 'tok_ambush',
            changes: { hidden: false, isVisible: true }
        });
        assert.strictEqual(localDeltaCount, 1);
        assert.ok(playerPackets.some((p) => p.event === 'token:added' && p.args?.[0]?.tokenId === 'tok_ambush'));

        // GM hides it again -> must emit token:deleted to players
        playerPackets.length = 0;
        host.emit('token:update_delta', {
            mapId: 'map_1',
            tokenId: 'tok_ambush',
            changes: { hidden: true, isVisible: false }
        });
        assert.ok(playerPackets.some((p) => p.event === 'token:deleted' && p.args?.[0]?.tokenId === 'tok_ambush'));
    } finally {
        globalThis.VTT = prevVtt;
    }
});

test('[P2P Adapter] Normalizes room codes and streams requested assets over WebRTC data channels', async () => {
    assert.strictEqual(VttP2PAdapter.normalizeRoomCode(' ab12 cd34 '), 'AB12-CD34');

    const host = new VttP2PAdapter({ isHost: true, role: 'GM', username: 'DM', campaignId: 'camp_1' });
    const player = new VttP2PAdapter({ isHost: false, role: 'Player', username: 'Bob', campaignId: 'camp_1' });

    const assetRawUrl = 'forgedvtt-asset://unit-test-map';
    const sampleBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const prevAssetStore = globalThis.__staticAssetStore;
    globalThis.__staticAssetStore = {
        async getBlob(url) {
            if (url === assetRawUrl) {
                return new Blob([sampleBytes], { type: 'image/png' });
            }
            return null;
        }
    };

    try {
        // Wire bi-directional mock channels between player and host
        const hostSidePeer = {
            id: player.id,
            joined: true,
            username: 'Bob',
            role: 'Player',
            eventsChannel: {
                readyState: 'open',
                bufferedAmount: 0,
                send: (msg) => player._handleIncomingData(JSON.parse(msg))
            },
            assetsChannel: {
                readyState: 'open',
                bufferedAmount: 0,
                send: (msg) => player._handleIncomingData(JSON.parse(msg))
            }
        };
        host.peers.set(player.id, hostSidePeer);

        player.connected = true;
        player.hostPeer = {
            open: true,
            eventsChannel: {
                readyState: 'open',
                send: (msg) => host._handleIncomingData(msg, hostSidePeer)
            }
        };

        let receivedEvent = null;
        player.on('asset:received', (evt) => {
            receivedEvent = evt;
        });

        player.requestAsset(assetRawUrl);

        for (let i = 0; i < 40 && !receivedEvent; i++) {
            await new Promise((r) => setTimeout(r, 25));
        }

        assert.ok(receivedEvent, 'Player must receive streamed asset');
        assert.strictEqual(receivedEvent.id !== undefined, true);
        assert.strictEqual(receivedEvent.originalUrl, assetRawUrl);
        assert.ok(receivedEvent.url.startsWith('data:image/png;base64,') || receivedEvent.url.startsWith('blob:'));
        assert.strictEqual(player.resolveAssetUrl(assetRawUrl), receivedEvent.blobUrl || receivedEvent.url);
    } finally {
        globalThis.__staticAssetStore = prevAssetStore;
    }

    // Verify p2pBridge.syncPeers tracks peer additions and removals
    p2pBridge.startRoom({ roomCode: 'TEST-9999' });
    const synced = p2pBridge.syncPeers([{ id: 'peer_1', username: 'Aragorn', role: 'Player' }]);
    assert.strictEqual(synced.peerCount, 1);
    assert.strictEqual(synced.peers[0].username, 'Aragorn');
    const emptied = p2pBridge.syncPeers([]);
    assert.strictEqual(emptied.peerCount, 0);
    p2pBridge.stopRoom();
});
