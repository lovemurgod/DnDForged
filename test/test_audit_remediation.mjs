import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { JSDOM } from 'jsdom';
import '../vtt/js/network/vtt-p2p-host-engine.js';
import '../vtt/js/network/vtt-p2p-adapter.js';

const { VttP2PHostEngine, VttP2PAdapter } = globalThis;

test('P2P Host Engine handles tokens:update and maptools:update with player filtering', async () => {
    const dispatched = [];
    const sentToPeers = [];
    let persisted = 0;

    globalThis.VTT = {
        campaignState: {
            id: 'camp_1',
            activeMapId: 'map_1',
            activeGMMapId: 'map_1',
            maps: {
                map_1: {
                    id: 'map_1',
                    tokens: { t1: { id: 't1', name: 'Hero', hp: 20, layer: 'token' } },
                    traps: [],
                    portals: []
                }
            }
        }
    };
    globalThis.__persistStaticCampaign = () => {
        persisted++;
    };

    const adapter = {
        isHost: true,
        username: 'GM',
        role: 'GM',
        peers: new Map([
            [
                'p1',
                {
                    id: 'p1',
                    username: 'Alice',
                    role: 'Player',
                    joined: true,
                    conn: { open: true, send: (pkt) => sentToPeers.push(JSON.parse(pkt)) }
                }
            ]
        ]),
        _sendToPeer: (_peer, pkt) => sentToPeers.push(JSON.parse(pkt)),
        _persistHostCampaignState: () => {
            persisted++;
        },
        _dispatch: (evt, payload) => dispatched.push({ evt, payload })
    };

    const handledTokens = VttP2PHostEngine.processEvent({
        adapter,
        event: 'tokens:update',
        args: [{ tokens: { t1: { id: 't1', name: 'Hero', hp: 12, layer: 'token' }, t2: { id: 't2', layer: 'gm' } } }],
        senderPeer: null
    });
    assert.equal(handledTokens, true);
    assert.equal(globalThis.VTT.campaignState.maps.map_1.tokens.t1.hp, 12);
    assert.ok(dispatched.some((d) => d.evt === 'token:updated' && d.payload.tokens.t2));
    const peerTokMsg = sentToPeers.find((m) => m.event === 'token:updated');
    assert.ok(peerTokMsg);
    assert.equal(peerTokMsg.args[0].tokens.t2, undefined);

    const handledMapTools = VttP2PHostEngine.processEvent({
        adapter,
        event: 'maptools:update',
        args: [
            {
                mapId: 'map_1',
                traps: [
                    { id: 'tr1', hidden: true },
                    { id: 'tr2', isRevealed: true }
                ],
                portals: [
                    { id: 'pt1', isSecret: true },
                    { id: 'pt2', isSecret: false }
                ]
            }
        ],
        senderPeer: null
    });
    assert.equal(handledMapTools, true);
    assert.equal(globalThis.VTT.campaignState.maps.map_1.traps.length, 2);
    const peerTraps = sentToPeers.find((m) => m.event === 'traps:updated');
    const peerPortals = sentToPeers.find((m) => m.event === 'portals:updated');
    assert.equal(peerTraps.args[0].traps.length, 1);
    assert.equal(peerTraps.args[0].traps[0].id, 'tr2');
    assert.equal(peerPortals.args[0].portals.length, 1);
    assert.equal(peerPortals.args[0].portals[0].id, 'pt2');
    assert.ok(persisted >= 2);
});

test('P2P Adapter streamAssetToPeers sends start & chunks on assetsChannel and accepts SVG/audio MIMEs', async () => {
    const host = new VttP2PAdapter({ isHost: true, username: 'GM', role: 'GM' });

    const assetPackets = [];
    const eventPackets = [];
    const unjoinedPackets = [];

    host.peers.set('p_joined', {
        id: 'p_joined',
        joined: true,
        assetsChannel: { readyState: 'open', bufferedAmount: 0, send: (p) => assetPackets.push(JSON.parse(p)) },
        eventsChannel: { readyState: 'open', send: (p) => eventPackets.push(JSON.parse(p)) }
    });
    host.peers.set('p_unjoined', {
        id: 'p_unjoined',
        joined: false,
        assetsChannel: { readyState: 'open', bufferedAmount: 0, send: (p) => unjoinedPackets.push(p) }
    });

    await host.streamAssetToPeers('svg_1', Buffer.from('<svg></svg>').toString('base64'), 'image/svg+xml', {
        originalUrl: 'forgedvtt-asset://svg_1'
    });

    assert.equal(eventPackets.length, 0);
    assert.equal(unjoinedPackets.length, 0);
    assert.equal(assetPackets[0].type, 'asset-start');
    assert.equal(assetPackets[0].mimeType, 'image/svg+xml');
    assert.equal(assetPackets[1].type, 'asset-chunk');

    // Verify client accepts image/svg+xml and audio/mpeg headers
    const client = new VttP2PAdapter({ isHost: false, username: 'Alice', role: 'Player' });
    client._handleIncomingData(
        JSON.stringify({ type: 'asset-start', id: 'a_svg', totalChunks: 1, totalBytes: 16, mimeType: 'image/svg+xml' })
    );
    client._handleIncomingData(
        JSON.stringify({ type: 'asset-start', id: 'a_aud', totalChunks: 1, totalBytes: 16, mimeType: 'audio/mpeg' })
    );
    assert.ok(client._assetTransfers.has('a_svg'));
    assert.ok(client._assetTransfers.has('a_aud'));
    client.disconnect();
    host.disconnect();
});

test('Handout parseMediaUrl allows forgedvtt-asset:// and resolves via getSafeVttUrl with data-raw-src', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/play/' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.window.__FORGEDVTT_STATIC_WEB__ = true;
    globalThis.window.__resolveStaticAssetUrl = (u) => (u === 'forgedvtt-asset://a1' ? 'blob:static/a1' : null);

    const { parseMediaUrl } = await import('../vtt/js/vtt-handouts.js');
    const html = parseMediaUrl('forgedvtt-asset://a1');
    assert.match(html, /src="blob:static\/a1"/);
    assert.match(html, /data-raw-src="forgedvtt-asset:\/\/a1"/);

    delete globalThis.window;
    delete globalThis.document;
});

test('Static shim BroadcastChannel aligns on { type: "campaigns-updated" }', async () => {
    const posted = [];
    class FakeBroadcastChannel {
        constructor(name) {
            this.name = name;
            this.onmessage = null;
        }
        postMessage(msg) {
            posted.push(msg);
        }
    }
    const mockWindow = {
        __FORGEDVTT_STATIC_WEB__: true,
        location: { origin: 'https://example.test' },
        fetch: async () => new Response('{}', { status: 200 })
    };
    const shimCode = fs.readFileSync(path.join(process.cwd(), 'vtt', 'js', 'network', 'vtt-static-shim.js'), 'utf8');
    vm.runInNewContext(shimCode, {
        window: mockWindow,
        BroadcastChannel: FakeBroadcastChannel,
        localStorage: { getItem: () => null },
        URL,
        Response,
        setTimeout,
        clearTimeout
    });

    mockWindow.__persistStaticCampaign({ id: 'camp_bc', name: 'Test' });
    await new Promise((r) => setTimeout(r, 260));

    assert.ok(
        posted.some((m) => m.type === 'campaigns-updated' && m.senderId === 'play' && m.campaignId === 'camp_bc')
    );
});

test('Static shim resolves desktop-folder /assets/* and /vtt-uploads/* paths via __resolveStaticAssetUrl', () => {
    const mockWindow = {
        __FORGEDVTT_STATIC_WEB__: true,
        location: { origin: 'https://example.test' },
        fetch: async () => new Response('{}', { status: 200 })
    };
    const shimCode = fs.readFileSync(path.join(process.cwd(), 'vtt', 'js', 'network', 'vtt-static-shim.js'), 'utf8');
    vm.runInNewContext(shimCode, {
        window: mockWindow,
        localStorage: { getItem: () => null },
        URL,
        Response,
        setTimeout,
        clearTimeout
    });

    const placeholder = mockWindow.__resolveStaticAssetUrl('/assets/Tokens/Bandit%20Captain.png');
    assert.ok(placeholder.startsWith('data:image/svg+xml'));
    const uploadPlaceholder = mockWindow.__resolveStaticAssetUrl('/vtt-uploads/hero_token.webp');
    assert.ok(uploadPlaceholder.startsWith('data:image/svg+xml'));
});

test('Express /api/campaigns/import extracts uploaded .zip campaign archives', async () => {
    const { campaignsRouter } = await import('../server/routes/campaigns.js');
    const { campaigns } = await import('../server/state.js');

    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'forged-zip-src-'));
    const zipPath = path.join(os.tmpdir(), `forged-test-${Date.now()}.zip`);
    const campId = `zip_camp_${Date.now()}`;
    try {
        fs.writeFileSync(
            path.join(tmpSrc, 'campaign.json'),
            JSON.stringify({ campaign: { id: campId, name: 'ZIP Imported Campaign', maps: {} } }),
            'utf8'
        );
        fs.mkdirSync(path.join(tmpSrc, 'uploads'), { recursive: true });
        fs.writeFileSync(path.join(tmpSrc, 'uploads', 'map.txt'), 'ok', 'utf8');

        const tarBin =
            process.platform === 'win32'
                ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
                : 'tar';
        execFileSync(tarBin, ['-a', '-c', '-f', zipPath, '-C', tmpSrc, '.']);

        const app = express();
        app.use(express.json());
        app.use('/api', campaignsRouter);

        const server = await new Promise((resolve) => {
            const s = app.listen(0, '127.0.0.1', () => resolve(s));
        });
        try {
            const port = server.address().port;
            const fd = new FormData();
            fd.append('file', new Blob([fs.readFileSync(zipPath)], { type: 'application/zip' }), 'export.zip');
            const res = await fetch(`http://127.0.0.1:${port}/api/campaigns/import`, { method: 'POST', body: fd });
            assert.equal(res.status, 200);
            const json = await res.json();
            assert.equal(json.success, true);
            assert.equal(json.campaign.name, 'ZIP Imported Campaign');
            delete campaigns[json.campaign.id];
        } finally {
            server.close();
        }
    } finally {
        fs.rmSync(tmpSrc, { recursive: true, force: true });
        fs.rmSync(zipPath, { force: true });
    }
});
