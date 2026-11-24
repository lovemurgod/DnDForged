import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import http from 'http';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import express from 'express';
import { fileURLToPath } from 'url';

import {
    serverConfig,
    campaigns,
    activeGmTokens,
    activePlayerTokens,
    generatePlayerSessionToken,
    isAuthorizedGmOrSecret
} from '../server/state.js';
import { adminRouter, resetGmLoginRateLimits } from '../server/routes/admin.js';
import { assetsRouter } from '../server/routes/assets.js';
import { sourcesRouter } from '../server/routes/sources.js';
import { safeFetchPublicUrl } from '../server/routes/media.js';
import { initSocketServer } from '../server/socket.js';
import { hashPassword } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Comprehensive Audit Remediation Suite', async (t) => {
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api', adminRouter);
    app.use('/api', assetsRouter);
    app.use('/api', sourcesRouter);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const originalCreds = serverConfig.gmCredentials;

    t.after(() => {
        serverConfig.gmCredentials = originalCreds;
        activeGmTokens.clear();
        activePlayerTokens.clear();
        resetGmLoginRateLimits();
        server.close();
    });

    await t.test('Loopback passwordless auto-auth blocks cross-site browser requests', () => {
        serverConfig.gmCredentials = { username: 'GameMaster', salt: '', hash: '' };
        const crossSiteReq = {
            ip: '127.0.0.1',
            headers: {
                origin: 'https://evil-site.example',
                'sec-fetch-site': 'cross-site'
            }
        };
        assert.equal(isAuthorizedGmOrSecret(crossSiteReq), false);

        const localOriginReq = {
            ip: '127.0.0.1',
            headers: {
                origin: 'http://localhost:5050',
                'sec-fetch-site': 'same-origin'
            }
        };
        assert.equal(isAuthorizedGmOrSecret(localOriginReq), true);
    });

    await t.test('POST /api/assets/upload enforces session auth and blocks SVG/HTML for non-GMs', async () => {
        const boundary = '----ForgeAuditBoundary' + Date.now();
        const svgBody = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="file"; filename="xss.svg"\r\n`,
            `Content-Type: image/svg+xml\r\n\r\n`,
            `<svg onload="alert(1)"></svg>\r\n`,
            `--${boundary}--\r\n`
        ].join('');

        // Unauthenticated remote upload -> 403
        const unauthRes = await fetch(`${baseUrl}/api/assets/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'x-forwarded-for': '198.51.100.77'
            },
            body: svgBody
        });
        assert.equal(unauthRes.status, 403);

        // Authenticated player uploading .svg -> 400
        const pToken = generatePlayerSessionToken({ campaignId: 'default', username: 'Alice' });
        const svgPlayerRes = await fetch(`${baseUrl}/api/assets/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'x-forwarded-for': '198.51.100.77',
                'x-player-token': pToken
            },
            body: svgBody
        });
        assert.equal(svgPlayerRes.status, 400);

        // Authenticated player uploading .png -> 200 (sandboxed into /assets/players/)
        const pngBody = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="file"; filename="hero_portrait.png"\r\n`,
            `Content-Type: image/png\r\n\r\n`,
            `PNG_BINARY_STUB\r\n`,
            `--${boundary}--\r\n`
        ].join('');
        const pngPlayerRes = await fetch(`${baseUrl}/api/assets/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'x-forwarded-for': '198.51.100.77',
                'x-player-token': pToken
            },
            body: pngBody
        });
        assert.equal(pngPlayerRes.status, 200);
        const pngJson = await pngPlayerRes.json();
        assert.ok(pngJson.url.startsWith('/assets/players/'));
    });

    await t.test('safeFetchPublicUrl blocks private/loopback/metadata SSRF hosts', async () => {
        await assert.rejects(
            () => safeFetchPublicUrl('http://127.0.0.1:5050/api/campaigns'),
            /prohibited IP address/i
        );
        await assert.rejects(
            () => safeFetchPublicUrl('http://169.254.169.254/latest/meta-data/'),
            /prohibited IP address/i
        );
    });

    await t.test('Socket.IO enforces token ownership, map_sync sanitization, remote Presentation allowlist, and GM rate limit', () => {
        resetGmLoginRateLimits();
        const { hash, salt } = hashPassword('SocketGuard99!');
        serverConfig.gmCredentials = { username: 'GameMaster', salt, hash };

        campaigns.test_sec_camp = {
            id: 'test_sec_camp',
            name: 'Security Test Campaign',
            gmUsername: 'GameMaster',
            allowedUsers: ['Alice'],
            activeMapId: 'map_public',
            activeGMMapId: 'map_secret',
            maps: {
                map_public: {
                    id: 'map_public',
                    name: 'Public Courtyard',
                    tokens: {
                        tok_alice: { id: 'tok_alice', owner: 'Alice', layer: 'token', x: 10, y: 10 },
                        tok_boss: { id: 'tok_boss', owner: 'GameMaster', layer: 'gm', isVisible: false, hidden: true, x: 50, y: 50 }
                    },
                    portals: [
                        { id: 'p_open', isSecret: false },
                        { id: 'p_secret', isSecret: true }
                    ],
                    traps: [{ id: 'trap_hidden', hidden: true }],
                    notes: [{ id: 'n1', isPublic: false, author: 'GameMaster', text: 'GM Secret' }]
                },
                map_secret: {
                    id: 'map_secret',
                    name: 'Secret Dungeon',
                    tokens: {
                        tok_dm_secret: { id: 'tok_dm_secret', owner: 'GameMaster', layer: 'gm', hidden: true }
                    },
                    portals: [],
                    traps: [],
                    notes: []
                }
            },
            characters: {}
        };

        let onConnection = null;
        const mockIo = {
            sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
            on: (evt, fn) => {
                if (evt === 'connection') onConnection = fn;
            },
            to: () => ({ emit: () => {} }),
            emit: () => {}
        };
        initSocketServer(mockIo);

        // 1. Remote Presentation Display is rejected by allowlist
        const presSock = new EventEmitter();
        presSock.handshake = { address: '127.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.55' } };
        presSock.join = () => {};
        presSock.to = () => ({ emit: () => {} });
        presSock.disconnect = () => {};
        let presRejected = null;
        presSock.on('join_rejected', (d) => (presRejected = d));
        onConnection(presSock);
        presSock.emit('join', { campaignId: 'test_sec_camp', username: 'Presentation Display', role: 'Player' });
        assert.ok(presRejected?.reason?.includes('allowed list'), 'Remote Presentation Display must not bypass allowlist');

        // 2. Socket.IO GM password brute force triggers RATE_LIMITED after 5 failures
        for (let i = 0; i < 6; i++) {
            const s = new EventEmitter();
            s.handshake = { address: '127.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.99' } };
            s.join = () => {};
            s.disconnect = () => {};
            let rej = null;
            s.on('join_rejected', (d) => (rej = d));
            onConnection(s);
            s.emit('join', { campaignId: 'test_sec_camp', username: 'GameMaster', role: 'GM', gmPassword: 'Wrong' });
            if (i === 5) {
                assert.equal(rej?.code, 'RATE_LIMITED', '6th failed Socket.IO GM login must be RATE_LIMITED');
            }
        }
        resetGmLoginRateLimits();

        // 3. Join as Alice
        const aliceSock = new EventEmitter();
        aliceSock.id = 'sock_alice';
        aliceSock.handshake = { address: '127.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.10' } };
        aliceSock.join = () => {};
        aliceSock.to = () => ({ emit: () => {} });
        aliceSock.disconnect = () => {};
        let aliceJoined = null;
        let fullMapData = null;
        aliceSock.on('joined', (d) => (aliceJoined = d));
        aliceSock.on('map:full_data', (d) => (fullMapData = d));
        onConnection(aliceSock);
        aliceSock.emit('join', { campaignId: 'test_sec_camp', username: 'Alice', role: 'Player' });
        assert.ok(aliceJoined?.playerSessionToken, 'Joined player receives playerSessionToken');

        // Attempt token:update spoof on GM boss token
        aliceSock.emit('token:update', {
            mapId: 'map_public',
            token: { id: 'tok_boss', owner: 'Alice', layer: 'token', x: 999 }
        });
        assert.equal(campaigns.test_sec_camp.maps.map_public.tokens.tok_boss.owner, 'GameMaster');
        assert.equal(campaigns.test_sec_camp.maps.map_public.tokens.tok_boss.x, 50);

        // Attempt token:add overwrite on tok_boss
        aliceSock.emit('token:add', {
            mapId: 'map_public',
            tokenId: 'tok_boss',
            token: { id: 'tok_boss', owner: 'Alice' }
        });
        assert.equal(campaigns.test_sec_camp.maps.map_public.tokens.tok_boss.owner, 'GameMaster');

        // Attempt token:update_delta privilege escalation on Alice's own token
        aliceSock.emit('token:update_delta', {
            mapId: 'map_public',
            tokenId: 'tok_alice',
            changes: { x: 25, layer: 'gm', owner: 'GameMaster', hidden: true }
        });
        assert.equal(campaigns.test_sec_camp.maps.map_public.tokens.tok_alice.x, 25);
        assert.equal(campaigns.test_sec_camp.maps.map_public.tokens.tok_alice.layer, 'token');
        assert.equal(campaigns.test_sec_camp.maps.map_public.tokens.tok_alice.owner, 'Alice');

        // Attempt map:request_sync on map_secret -> receives sanitized map_public instead
        aliceSock.emit('map:request_sync', { mapId: 'map_secret' });
        assert.equal(fullMapData.mapId, 'map_public');
        assert.equal(fullMapData.map.tokens.tok_boss, undefined, 'GM boss token must be stripped');
        assert.equal(fullMapData.map.traps.length, 0, 'Hidden traps must be stripped');
        assert.equal(fullMapData.map.portals.length, 1, 'Secret portals must be stripped');

        delete campaigns.test_sec_camp;
    });

    await t.test('Electron VTT preload omits host admin IPCs & main.js guards navigation', () => {
        const vttPreload = fs.readFileSync(path.join(rootDir, 'electron', 'vtt-preload.cjs'), 'utf8');
        assert.ok(vttPreload.includes('openPresentationWindow'));
        assert.equal(vttPreload.includes('setGmCredentials'), false);
        assert.equal(vttPreload.includes('restoreBackup'), false);
        assert.equal(vttPreload.includes('gmDeleteCampaign'), false);

        const mainJs = fs.readFileSync(path.join(rootDir, 'electron', 'main.js'), 'utf8');
        assert.ok(mainJs.includes("vtt-preload.cjs"));
        assert.ok(mainJs.includes("will-navigate"));
        assert.ok(mainJs.includes("setWindowOpenHandler"));
        assert.ok(mainJs.includes("TUNNEL_TOKEN"));
    });

    await t.test('StaticStorageDriver & web-api-bridge contracts match dashboard expectations', async () => {
        const driverCode = fs.readFileSync(
            path.join(rootDir, 'electron', 'ui', 'static-storage-driver.js'),
            'utf8'
        );
        const store = new Map();
        const mockWindow = {
            crypto: crypto.webcrypto,
            localStorage: {
                getItem: (k) => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v))
            },
            fetch: async () => new Response('[]', { status: 200 })
        };
        vm.runInNewContext(driverCode, {
            window: mockWindow,
            localStorage: mockWindow.localStorage,
            fetch: mockWindow.fetch,
            Response,
            TextEncoder,
            Uint8Array
        });

        const drv = mockWindow.__staticStorageDriver;
        assert.match(drv.p2pRoomCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Room code uses 8-char Crockford Base32');

        await drv.init();
        const allSrc = await drv.getAllSources();
        assert.equal(allSrc.success, true);
        assert.ok(Array.isArray(allSrc.categories[0].sources));

        await drv.createCustomSource({
            category: 'bestiary',
            code: 'CUSTOM1',
            name: 'Homebrew Book',
            data: { monster: [{ name: 'Void Drake', source: 'CUSTOM1' }] }
        });
        const details = drv.getSourceDetails({ category: 'bestiary', code: 'CUSTOM1' });
        assert.equal(details.success, true);
        assert.equal(details.source.isCustom, true);
        assert.ok(details.rawJson.includes('Void Drake'), 'createCustomSource must retain data payload');

        const inspected = drv.inspectImportFiles([
            { name: 'dragons.json', content: JSON.stringify({ _meta: { sources: [{ json: 'DRAG' }] }, monster: [{ name: 'Red' }] }) }
        ]);
        assert.equal(inspected.candidates[0].detectedCategory, 'bestiary');
        assert.equal(inspected.candidates[0].detectedSource, 'DRAG');
        assert.equal(inspected.candidates[0].entryCount, 1);

        const batchExp = drv.exportGranular({ campaignId: 'default', entityType: 'map', batch: true });
        assert.equal(batchExp.success, true);
        assert.equal(batchExp.count, 1);
    });

    await t.test('VttP2PAdapter enforces host role allowlist, kicks rejected peers, chunks packets, and destroys peer', () => {
        const p2pCode = fs.readFileSync(
            path.join(rootDir, 'vtt', 'js', 'network', 'vtt-p2p-adapter.js'),
            'utf8'
        );
        const mockWindow = {
            VTT: {
                campaignState: {
                    id: 'default',
                    gmUsername: 'GameMaster',
                    allowedUsers: ['Alice'],
                    maps: {
                        m1: { tokens: { boss: { id: 'boss', owner: 'GameMaster', layer: 'token' } } }
                    }
                },
                chatHistory: []
            },
            location: { hash: '' }
        };
        vm.runInNewContext(p2pCode, {
            window: mockWindow,
            localStorage: { getItem: () => null },
            setTimeout,
            clearTimeout
        });

        const host = new mockWindow.VttP2PAdapter({ isHost: true, role: 'GM', username: 'GameMaster' });
        let kicked = false;
        const badPeer = {
            id: 'peer_bad',
            conn: { open: true, send: () => {}, close: () => { kicked = true; } }
        };
        host.peers.set('peer_bad', badPeer);

        // Player pretending to be GM on P2P join is rejected and disconnected
        host._handleIncomingData(
            JSON.stringify({ type: 'event', event: 'join', args: [{ username: 'Mallory', role: 'GM' }] }),
            badPeer
        );
        assert.equal(badPeer.joined, undefined);

        // Authorized player Alice cannot emit GM-only map:delete
        const sent = [];
        const alicePeer = {
            id: 'peer_alice',
            conn: { open: true, send: (m) => sent.push(m), close: () => {} }
        };
        host.peers.set('peer_alice', alicePeer);
        host._handleIncomingData(
            JSON.stringify({ type: 'event', event: 'join', args: [{ username: 'Alice', role: 'Player' }] }),
            alicePeer
        );
        assert.equal(alicePeer.joined, true);
        let mapDeleteDispatched = false;
        host.on('map:delete', () => {
            mapDeleteDispatched = true;
        });
        host._handleIncomingData(
            JSON.stringify({ type: 'event', event: 'map:delete', args: [{ mapId: 'm1' }] }),
            alicePeer
        );
        assert.equal(mapDeleteDispatched, false, 'Player peer must not dispatch GM-only map:delete');

        // Asset transfer with unsafe SVG mime is rejected
        host._handleIncomingData(
            JSON.stringify({ type: 'asset-start', id: 'a1', totalChunks: 1, totalBytes: 50, mimeType: 'image/svg+xml' }),
            alicePeer
        );
        assert.equal(host._assetTransfers.has('a1'), false);

        // PeerJS instance is destroyed on disconnect
        let destroyed = false;
        host._peer = { destroy: () => { destroyed = true; } };
        host.disconnect();
        assert.equal(destroyed, true);
        void kicked;
    });

    await t.test('Build & docs align to 1.5.0 release assets and complete SRD static data/sheet files', () => {
        const docsPlayData = path.join(rootDir, 'docs', 'play', 'data');
        assert.ok(fs.existsSync(path.join(docsPlayData, 'class', 'index.json')), 'docs/play/data/class/index.json must exist');
        assert.ok(fs.existsSync(path.join(docsPlayData, 'charcreationoptions.json')), 'charcreationoptions.json must exist');

        const playSheetHtml = fs.readFileSync(path.join(rootDir, 'docs', 'play', 'sheet.html'), 'utf8');
        assert.ok(playSheetHtml.includes('<base href="/play/">'));
        assert.ok(playSheetHtml.includes('__FORGEDVTT_STATIC_WEB__'));
        assert.ok(playSheetHtml.includes('js/network/vtt-static-shim.js'));
        assert.equal(playSheetHtml.includes('/socket.io/socket.io.js'), false);

        const builderCfg = JSON.parse(fs.readFileSync(path.join(rootDir, 'electron-builder-srd.json'), 'utf8'));
        assert.equal(builderCfg.executableName, 'ForgeDVTT');
        assert.equal(builderCfg.win.executableName, 'ForgeDVTT');

        const serverJs = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
        assert.ok(serverJs.includes('1.5.0/ForgeDVTT-Setup-1.5.0.exe'));
        assert.ok(serverJs.includes("'/play/sheet.html'"));
    });

    await t.test('vtt-static-shim.js rewrites /data/ paths and shims creature/spell/tables endpoints', async () => {
        const shimCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'network', 'vtt-static-shim.js'), 'utf8');
        const fetched = [];
        const baseFetch = async (url) => {
            fetched.push(String(url));
            if (String(url) === 'data/bestiary-normalized/bestiary-mm.json') {
                return new Response(JSON.stringify([{ id: 'goblin_mm', name: 'Goblin', source: 'MM' }]), { status: 200 });
            }
            if (String(url) === 'data/spells-catalog.json') {
                return new Response(JSON.stringify([{ id: 'fireball', name: 'Fireball', source: 'PHB' }]), { status: 200 });
            }
            return new Response('ok', { status: 200 });
        };
        const mockWindow = {
            __FORGEDVTT_STATIC_WEB__: true,
            location: { origin: 'https://forgedvtt.com' },
            fetch: baseFetch,
            crypto: crypto.webcrypto
        };
        vm.runInNewContext(shimCode, {
            window: mockWindow,
            localStorage: { getItem: () => null },
            URL,
            Response,
            TextEncoder,
            Uint8Array,
            setTimeout,
            clearTimeout
        });

        assert.equal(typeof mockWindow.__persistStaticCampaign, 'function');
        const creatureRes = await mockWindow.fetch('/api/creature/MM/goblin_mm');
        assert.equal((await creatureRes.json()).name, 'Goblin');

        await mockWindow.fetch('/data/spells-catalog.json');
        assert.ok(fetched.includes('data/spells-catalog.json'), 'Must rewrite root-relative /data/ to relative data/');

        const tablesRes = await mockWindow.fetch('/api/tables/catalog');
        assert.deepEqual(await tablesRes.json(), { tables: [], decks: [] });
    });
});
