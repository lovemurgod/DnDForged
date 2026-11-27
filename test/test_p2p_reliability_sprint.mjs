import test from 'node:test';
import assert from 'node:assert/strict';
import '../vtt/js/network/vtt-p2p-host-engine.js';
import '../vtt/js/network/vtt-p2p-adapter.js';

const { VttP2PAdapter, VttP2PHostEngine } = globalThis;

function createMockIndexedDB({ failMode = null } = {}) {
    const storeData = new Map();
    const objectStoreNames = {
        contains: (name) => name === 'kv' || name === 'static_assets'
    };

    const db = {
        objectStoreNames,
        close: () => {},
        transaction: (storeName) => {
            const tx = {
                error: null,
                oncomplete: null,
                onerror: null,
                onabort: null,
                objectStore: () => ({
                    get: (key) => {
                        const req = {
                            result: storeData.get(`${storeName}:${key}`),
                            error: null,
                            onsuccess: null,
                            onerror: null
                        };
                        queueMicrotask(() => req.onsuccess?.());
                        return req;
                    },
                    put: (val, key) => {
                        const req = { error: null, onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                            if (failMode === 'quota') {
                                const err = new Error('Storage quota exceeded');
                                err.name = 'QuotaExceededError';
                                tx.error = err;
                                req.error = err;
                                tx.onerror?.();
                                return;
                            }
                            if (failMode === 'abort') {
                                tx.error = new Error('Transaction aborted');
                                tx.onabort?.();
                                return;
                            }
                            const k = key ?? val?.id;
                            storeData.set(`${storeName}:${k}`, val);
                            req.onsuccess?.();
                            tx.oncomplete?.();
                        });
                        return req;
                    },
                    getAll: () => {
                        const req = { result: [], error: null, onsuccess: null, onerror: null };
                        queueMicrotask(() => req.onsuccess?.());
                        return req;
                    }
                })
            };
            return tx;
        }
    };

    return {
        storeData,
        indexedDB: {
            open: () => {
                const req = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
                queueMicrotask(() => req.onsuccess?.());
                return req;
            }
        }
    };
}

test('[Priority 1] Static persistence reports transaction completion, flush, and IndexedDB errors', async () => {
    const prevWindow = globalThis.window;
    const prevIdb = globalThis.indexedDB;
    const prevShowToast = globalThis.showToast;
    const prevStaticFlag = globalThis.__FORGEDVTT_STATIC_WEB__;
    const prevFetch = globalThis.fetch;

    const toasts = [];
    const events = [];
    let mockEnv = createMockIndexedDB();

    globalThis.window = globalThis;
    globalThis.__FORGEDVTT_STATIC_WEB__ = true;
    globalThis.indexedDB = mockEnv.indexedDB;
    globalThis.showToast = (msg, type) => toasts.push({ msg, type });
    globalThis.dispatchEvent = (ev) => events.push(ev);
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, init) {
            this.type = type;
            this.detail = init?.detail;
        }
    };

    try {
        await import(`../vtt/js/network/vtt-static-shim.js?t=${Date.now()}`);

        // 1. Successful debounced persist + explicit flush
        const camp = { id: 'camp_p1', name: 'Test Campaign' };
        const p = globalThis.__persistStaticCampaign(camp);
        const flushed = await globalThis.__flushStaticCampaign();
        assert.strictEqual(flushed.ok, true);
        const pResult = await p;
        assert.strictEqual(pResult.ok, true);
        assert.strictEqual(globalThis.__getStaticPersistenceStatus().lastError, null);
        assert.ok(mockEnv.storeData.get('kv:campaigns')?.camp_p1);

        // 2. Simulated QuotaExceededError on IndexedDB write
        mockEnv = createMockIndexedDB({ failMode: 'quota' });
        globalThis.indexedDB = mockEnv.indexedDB;
        // Reset cached IDB promise by simulating close or re-importing? Wait: openStaticIdb caches _staticIdbPromise.
        // We can test failure by importing a fresh shim instance with failing indexedDB.
        globalThis.indexedDB = createMockIndexedDB({ failMode: 'quota' }).indexedDB;
        await import(`../vtt/js/network/vtt-static-shim.js?t=${Date.now()}_fail`);

        await assert.rejects(async () => {
            const failP = globalThis.__persistStaticCampaign({ id: 'camp_fail', name: 'Fail' });
            await globalThis.__flushStaticCampaign();
            await failP;
        }, /quota/i);

        assert.ok(toasts.some((t) => t.type === 'error' && /quota/i.test(t.msg)));
        assert.ok(events.some((e) => e.type === 'forgedvtt:persistence-error'));
        assert.ok(/quota/i.test(globalThis.__getStaticPersistenceStatus().lastError || ''));
    } finally {
        globalThis.window = prevWindow;
        globalThis.indexedDB = prevIdb;
        globalThis.showToast = prevShowToast;
        globalThis.__FORGEDVTT_STATIC_WEB__ = prevStaticFlag;
        globalThis.fetch = prevFetch;
    }
});

test('[Priority 2] P2P RPC transfer size limits, memory budgets, and cleanup', () => {
    const adapter = new VttP2PAdapter({ isHost: true, username: 'GM' });
    const peerA = { id: 'peer_a', joined: true };
    const peerB = { id: 'peer_b', joined: true };

    // 1. Oversized totalChunks (> 1024) rejected
    adapter._handleIncomingData({ type: 'rpc-start', id: 'rpc_huge_chunks', totalChunks: 5000 }, peerA);
    assert.strictEqual(adapter._rpcTransfers.has('rpc_huge_chunks'), false);

    // 2. Oversized totalBytes (> 16 MB) rejected
    adapter._handleIncomingData(
        { type: 'rpc-start', id: 'rpc_huge_bytes', totalChunks: 10, totalBytes: 20 * 1024 * 1024 },
        peerA
    );
    assert.strictEqual(adapter._rpcTransfers.has('rpc_huge_bytes'), false);

    // 3. Per-peer memory budget (16 MB): two 10 MB transfers from same peer -> second rejected
    adapter._handleIncomingData(
        { type: 'rpc-start', id: 'rpc_a1', totalChunks: 640, totalBytes: 10 * 1024 * 1024 },
        peerA
    );
    assert.strictEqual(adapter._rpcTransfers.has('rpc_a1'), true);
    adapter._handleIncomingData(
        { type: 'rpc-start', id: 'rpc_a2', totalChunks: 640, totalBytes: 10 * 1024 * 1024 },
        peerA
    );
    assert.strictEqual(adapter._rpcTransfers.has('rpc_a2'), false);

    // 4. Oversized single chunk (> 32 KB) aborts transfer
    adapter._handleIncomingData({ type: 'rpc-start', id: 'rpc_bad_chunk', totalChunks: 2, totalBytes: 1024 }, peerB);
    assert.strictEqual(adapter._rpcTransfers.has('rpc_bad_chunk'), true);
    adapter._handleIncomingData({ type: 'rpc-chunk', id: 'rpc_bad_chunk', index: 0, data: 'x'.repeat(40000) }, peerB);
    assert.strictEqual(adapter._rpcTransfers.has('rpc_bad_chunk'), false);

    // 5. Malformed payloads do not crash
    adapter._handleIncomingData('{bad json', peerB);
    adapter._handleIncomingData({ type: 'rpc-start', id: '', totalChunks: -1 }, peerB);
    adapter._handleIncomingData({ type: 'rpc-chunk', id: 'missing', index: 0, data: 'abc' }, peerB);

    // 6. Valid chunked RPC reassembles and dispatches
    let dispatched = null;
    adapter.on('chat:msg', (msg) => {
        dispatched = msg;
    });
    const full = JSON.stringify({ type: 'event', event: 'chat:msg', args: [{ text: 'Hello P2P' }] });
    const mid = Math.floor(full.length / 2);
    adapter._handleIncomingData({ type: 'rpc-start', id: 'rpc_ok', totalChunks: 2, totalBytes: full.length }, peerB);
    adapter._handleIncomingData({ type: 'rpc-chunk', id: 'rpc_ok', index: 0, data: full.slice(0, mid) }, peerB);
    adapter._handleIncomingData({ type: 'rpc-chunk', id: 'rpc_ok', index: 1, data: full.slice(mid) }, peerB);
    assert.strictEqual(dispatched?.text, 'Hello P2P');
    assert.strictEqual(adapter._rpcTransfers.has('rpc_ok'), false);

    // 7. Peer disconnect cleans up pending transfers
    adapter._cleanupPeerTransfers('peer_a');
    assert.strictEqual(adapter._rpcTransfers.has('rpc_a1'), false);
    adapter.disconnect();
});

test('[Priority 3] P2P data-channel backpressure pauses on high bufferedAmount and aborts on close', async () => {
    const adapter = new VttP2PAdapter({ isHost: true, username: 'GM' });
    const listeners = new Map();
    const sent = [];

    const mockChannel = {
        readyState: 'open',
        bufferedAmount: 0,
        bufferedAmountLowThreshold: 0,
        addEventListener: (ev, fn) => {
            if (!listeners.has(ev)) listeners.set(ev, new Set());
            listeners.get(ev).add(fn);
        },
        removeEventListener: (ev, fn) => {
            listeners.get(ev)?.delete(fn);
        },
        send: (data) => {
            sent.push(data);
            // Simulate buffer filling up only on the first chunk
            if (sent.length === 2) {
                mockChannel.bufferedAmount = 512 * 1024;
            }
        }
    };

    const peer = {
        id: 'peer_slow',
        joined: true,
        eventsChannel: mockChannel,
        assetsChannel: mockChannel
    };

    // Large RPC (> 16 KB) triggers chunked send with backpressure
    const largePayload = JSON.stringify({ type: 'event', event: 'big:sync', args: [{ blob: 'a'.repeat(35000) }] });
    const sendPromise = adapter._sendToPeer(peer, largePayload);

    // Wait a tick for rpc-start + chunk 0 to send and pause on bufferedAmount
    await new Promise((r) => setTimeout(r, 20));
    const countWhilePaused = sent.length;
    assert.ok(
        countWhilePaused >= 1 && countWhilePaused < 4,
        `Expected send to pause under backpressure, sent=${countWhilePaused}`
    );

    // Drain buffer and emit bufferedamountlow
    mockChannel.bufferedAmount = 0;
    for (const fn of listeners.get('bufferedamountlow') || []) fn();

    await sendPromise;
    assert.ok(sent.length >= 4, 'Expected remaining RPC chunks to finish after drain');

    // Now test channel closure during backpressure
    sent.length = 0;
    mockChannel.bufferedAmount = 512 * 1024;
    const assetPromise = adapter._streamAssetToPeer(peer, 'asset_1', 'b'.repeat(40000), 'image/png');
    await new Promise((r) => setTimeout(r, 20));
    mockChannel.readyState = 'closed';
    for (const fn of listeners.get('close') || []) fn();
    await assetPromise;
    assert.ok(sent.length <= 1, 'Expected asset stream to abort cleanly on channel close');
    adapter.disconnect();
});

test('[Priority 4] Initiative update permissions enforce ownership and field allowlist', () => {
    const adapter = new VttP2PAdapter({ isHost: true, username: 'GM' });
    const emitted = [];
    adapter._broadcastToPeers = (msg) => emitted.push(JSON.parse(msg));

    globalThis.VTT = {
        campaignState: {
            activeMapId: 'map1',
            characters: {
                char_alice: { id: 'char_alice', name: 'Alice', owner: 'Alice' },
                char_bob: { id: 'char_bob', name: 'Bob', owner: 'Bob' }
            },
            initiative: {
                currentRound: 3,
                activeTurnIndex: 1,
                isVisible: true,
                combatants: [
                    {
                        id: 'init_alice',
                        characterId: 'char_alice',
                        name: 'Alice',
                        score: 12,
                        layer: 'token',
                        isPlayer: true
                    },
                    { id: 'init_bob', characterId: 'char_bob', name: 'Bob', score: 15, layer: 'token', isPlayer: true },
                    {
                        id: 'init_dragon',
                        characterId: null,
                        name: 'Ancient Dragon',
                        score: 20,
                        layer: 'gm',
                        isPlayer: false
                    }
                ]
            }
        }
    };

    const alicePeer = { id: 'p_alice', username: 'Alice', role: 'Player', joined: true };

    // 1. Alice can update her own score & name, but GM-controlled fields are ignored
    const handled = VttP2PHostEngine.processEvent({
        adapter,
        event: 'initiative:update',
        args: [
            {
                initiative: {
                    currentRound: 99,
                    activeTurnIndex: 0,
                    isVisible: false,
                    combatants: [
                        {
                            id: 'init_alice',
                            characterId: 'char_alice',
                            score: 22,
                            name: 'Alice <b>The Bold</b>',
                            layer: 'gm',
                            isPlayer: false,
                            tokenId: 'hijack_tok',
                            img: 'evil.png'
                        },
                        // Unauthorized: Bob's combatant
                        { id: 'init_bob', characterId: 'char_bob', score: -5 },
                        // Unauthorized: GM NPC matched by name
                        { name: 'Ancient Dragon', score: -10 },
                        // Unauthorized: GM NPC with spoofed characterId
                        { id: 'init_dragon', characterId: 'char_alice', score: -10 },
                        // Unauthorized: arbitrary insertion
                        { id: 'init_fake', characterId: 'char_alice', name: 'Fake', score: 50 }
                    ]
                }
            }
        ],
        senderPeer: alicePeer
    });

    assert.strictEqual(handled, true);
    const campInit = globalThis.VTT.campaignState.initiative;
    assert.strictEqual(campInit.currentRound, 3);
    assert.strictEqual(campInit.activeTurnIndex, 1);
    assert.strictEqual(campInit.isVisible, true);
    assert.strictEqual(campInit.combatants.length, 3);

    const aliceCombatant = campInit.combatants.find((c) => c.id === 'init_alice');
    assert.strictEqual(aliceCombatant.score, 22);
    assert.strictEqual(aliceCombatant.name, 'Alice The Bold');
    assert.strictEqual(aliceCombatant.layer, 'token');
    assert.strictEqual(aliceCombatant.isPlayer, true);
    assert.strictEqual(aliceCombatant.tokenId, undefined);

    const bobCombatant = campInit.combatants.find((c) => c.id === 'init_bob');
    assert.strictEqual(bobCombatant.score, 15);
    const dragonCombatant = campInit.combatants.find((c) => c.id === 'init_dragon');
    assert.strictEqual(dragonCombatant.score, 20);
});

test('[Priority 5] P2P host identity verification handles verified, missing, mismatched, and manual modes', () => {
    // 1. Verified match
    const clientOk = new VttP2PAdapter({ isHost: false, expectedHostKey: 'pk_secret_123' });
    let joinedCount = 0;
    clientOk.on('joined', () => joinedCount++);
    clientOk._handleIncomingData({
        type: 'event',
        event: 'joined',
        args: [{ role: 'Player', hostKey: 'pk_secret_123' }]
    });
    assert.strictEqual(joinedCount, 1);
    assert.strictEqual(clientOk.hostIdentityVerified, true);

    // 2. Missing hostKey when expectedHostKey is set
    const clientMissing = new VttP2PAdapter({ isHost: false, expectedHostKey: 'pk_secret_123' });
    let missingReason = null;
    clientMissing.on('join_rejected', (d) => {
        missingReason = d.reason;
    });
    clientMissing._handleIncomingData({ type: 'event', event: 'joined', args: [{ role: 'Player', hostKey: null }] });
    assert.ok(/did not provide/i.test(missingReason));
    assert.strictEqual(clientMissing.hostIdentityVerified, false);

    // 3. Mismatched hostKey
    const clientMismatch = new VttP2PAdapter({ isHost: false, expectedHostKey: 'pk_secret_123' });
    let mismatchReason = null;
    clientMismatch.on('join_rejected', (d) => {
        mismatchReason = d.reason;
    });
    clientMismatch._handleIncomingData({
        type: 'event',
        event: 'joined',
        args: [{ role: 'Player', hostKey: 'wrong_key' }]
    });
    assert.ok(/mismatch/i.test(mismatchReason));
    assert.strictEqual(clientMismatch.hostIdentityVerified, false);

    // 4. Manual/unverified mode (no expectedHostKey)
    const clientManual = new VttP2PAdapter({ isHost: false, expectedHostKey: null });
    let manualJoined = false;
    clientManual.on('joined', () => {
        manualJoined = true;
    });
    clientManual._handleIncomingData({ type: 'event', event: 'joined', args: [{ role: 'Player', hostKey: null }] });
    assert.strictEqual(manualJoined, true);
    assert.strictEqual(clientManual.hostIdentityVerified, false);
});

test('[ICE Config] localStorage and explicit ICE entries enforce stun:/turns: validation', () => {
    const prevStorage = globalThis.localStorage;
    try {
        globalThis.localStorage = {
            getItem: (k) =>
                k === 'forgedvtt_ice_servers'
                    ? JSON.stringify([
                          { urls: 'turn:insecure.example.com:3478' },
                          { urls: 'javascript:alert(1)' },
                          { urls: 'turns:secure.example.com:5349', username: 'u', credential: 'p' },
                          { urls: 'stun:stun.l.google.com:19302' }
                      ])
                    : null
        };

        const adapter = new VttP2PAdapter({
            iceServers: [{ urls: 'turn:bad-explicit.example.com:3478' }]
        });
        const allUrls = adapter.iceServers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
        assert.ok(allUrls.includes('turns:secure.example.com:5349'));
        assert.ok(allUrls.includes('stun:stun.l.google.com:19302'));
        assert.ok(!allUrls.some((u) => u.startsWith('turn:')));
        assert.ok(!allUrls.some((u) => u.startsWith('javascript:')));
    } finally {
        globalThis.localStorage = prevStorage;
    }
});
