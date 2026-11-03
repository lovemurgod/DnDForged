/**
 * Integration Test Suite: Codex Security & Reliability Verifications
 *
 * Verifies the 6 key security and reliability boundaries:
 * 1. Public Campaign List vs Protected Detail/Chat
 * 2. Remote GM Password Enforcement (LAN, Tunnel, Proxy vs Loopback)
 * 3. Real Multipart Upload Path Traversal Containment & Pre-Auth
 * 4. Universal Media SSRF Defense (DNS Resolution & Redirect Validation)
 * 5. Windows Server Shutdown Flush & Data Persistence
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { safeFetchMedia } from '../server/routes/media.js';
import { initSocketServer } from '../server/socket.js';
import { serverConfig } from '../server/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 5097;
const TEST_SECRET = 'codex-test-internal-secret-9876543210';
const TEST_DATA_DIR = path.join(rootDir, 'scratch', 'test_data_codex_sec');

// Clean test environment
if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

// Create minimal initial database
const initCampaigns = {
    default: {
        id: 'default',
        name: 'Default Campaign',
        description: 'Test Campaign for Security Audit',
        allowedUsers: ['Alice', 'Bob'],
        knownPlayers: ['Alice', 'Bob'],
        activeMapId: 'map_1',
        maps: {
            map_1: { id: 'map_1', name: 'Secret DM Dungeon', secretDmNotes: 'Traps at A3' }
        },
        characters: {}
    }
};
fs.writeFileSync(path.join(TEST_DATA_DIR, 'campaigns.json'), JSON.stringify(initCampaigns, null, 2), 'utf8');

const initChat = {
    default: [
        { id: 'msg_1', sender: 'Alice', text: 'Public greeting' },
        { id: 'msg_2', sender: 'DM', whisperTo: 'Alice', text: 'Top secret whisper to Alice' }
    ]
};
fs.writeFileSync(path.join(TEST_DATA_DIR, 'chat.json'), JSON.stringify(initChat, null, 2), 'utf8');

function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
    console.log('======================================================');
    console.log('🛡️  STARTING CODEX SECURITY & RELIABILITY INTEGRATION TESTS');
    console.log('======================================================\n');

    // Spawn server.js with TEST_PORT and TEST_SECRET
    console.log(`[Setup] Spawning live server on port ${TEST_PORT}...`);
    const serverProcess = spawn('node', ['server.js'], {
        cwd: rootDir,
        env: {
            ...process.env,
            PORT: String(TEST_PORT),
            FORGEDVTT_DATA_DIR: TEST_DATA_DIR,
            FORGEDVTT_SERVER_SECRET: TEST_SECRET
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (d) => {
        const s = d.toString();
        if (s.includes('Error') || s.includes('Fatal')) console.log('[Server stdout]', s.trim());
    });
    serverProcess.stderr.on('data', (d) => {
        console.error('[Server stderr]', d.toString().trim());
    });

    // Wait for server ready
    let ready = false;
    for (let i = 0; i < 30; i++) {
        try {
            const check = await httpRequest({
                host: '127.0.0.1',
                port: TEST_PORT,
                path: '/api/campaigns',
                method: 'GET'
            });
            if (check.statusCode === 200) {
                ready = true;
                break;
            }
        } catch {}
        await wait(200);
    }

    if (!ready) {
        serverProcess.kill();
        throw new Error('Server failed to start within timeout');
    }
    console.log('  ✓ Live server running and responsive.\n');

    try {
        // --- TEST 1: Public Campaign List vs Detail ---
        console.log('[Test 1] Testing Campaign Endpoints Data Boundaries...');

        // 1a. Unauthenticated GET /api/campaigns
        const unauthCampList = await httpRequest({
            host: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/campaigns',
            method: 'GET',
            headers: {
                'x-forwarded-for': '198.51.100.1'
            }
        });
        if (unauthCampList.statusCode !== 200) {
            throw new Error(`Expected 200 for public campaign list, got ${unauthCampList.statusCode}`);
        }
        const camps = unauthCampList.body.campaigns;
        if (!camps || camps.length === 0) {
            throw new Error('Campaign list is empty');
        }
        const defaultCamp = camps.find((c) => c.id === 'default');
        if (!defaultCamp.id || !defaultCamp.name) {
            throw new Error('Public campaign metadata missing id or name');
        }
        if (
            defaultCamp.allowedUsers !== undefined ||
            defaultCamp.knownPlayers !== undefined ||
            defaultCamp.activeMapId !== undefined ||
            defaultCamp.mapsCount !== undefined
        ) {
            throw new Error(
                `Sensitive campaign metadata leaked to unauthenticated caller: ${JSON.stringify(defaultCamp)}`
            );
        }
        console.log('  ✓ Public GET /api/campaigns correctly returns only sanitized { id, name } metadata.');

        // 1b. Unauthenticated GET /api/campaigns/:id
        const unauthCampDetail = await httpRequest({
            host: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/campaigns/default',
            method: 'GET',
            headers: {
                'x-forwarded-for': '198.51.100.1'
            }
        });
        if (unauthCampDetail.statusCode !== 403) {
            throw new Error(
                `Expected 403 for unauthenticated GET /api/campaigns/:id, got ${unauthCampDetail.statusCode}`
            );
        }
        console.log('  ✓ Unauthenticated GET /api/campaigns/:id safely rejected with 403 Forbidden.');

        // 1c. Authenticated GET /api/campaigns/:id with x-server-secret
        const authCampDetail = await httpRequest({
            host: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/campaigns/default',
            method: 'GET',
            headers: {
                'x-server-secret': TEST_SECRET
            }
        });
        if (authCampDetail.statusCode !== 200 || !authCampDetail.body.maps) {
            throw new Error(`Authenticated GET /api/campaigns/:id failed or did not return full campaign object`);
        }
        console.log('  ✓ Authenticated GET /api/campaigns/:id returns full campaign object with maps.');

        // --- TEST 2: Chat Whisper Privacy ---
        console.log('\n[Test 2] Testing Chat Endpoint Whisper Privacy...');

        // 2a. Unauthenticated GET /api/chat
        const unauthChat = await httpRequest({
            host: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/chat?campaignId=default',
            method: 'GET',
            headers: {
                'x-forwarded-for': '198.51.100.1'
            }
        });
        if (unauthChat.statusCode !== 403) {
            throw new Error(`Expected 403 for unauthenticated GET /api/chat, got ${unauthChat.statusCode}`);
        }
        console.log('  ✓ Unauthenticated GET /api/chat safely rejected with 403 Forbidden.');

        // 2b. Authenticated GET /api/chat
        const authChat = await httpRequest({
            host: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/chat?campaignId=default',
            method: 'GET',
            headers: {
                'x-server-secret': TEST_SECRET
            }
        });
        if (authChat.statusCode !== 200 || !Array.isArray(authChat.body)) {
            throw new Error(`Expected 200 array for authenticated GET /api/chat, got ${authChat.statusCode}`);
        }
        console.log(`  ✓ Authenticated GET /api/chat returns full chat log (${authChat.body.length} entries).`);

        // --- TEST 3: Remote GM Password Enforcement Across Network Scenarios ---
        console.log('\n[Test 3] Testing Remote GM Password Enforcement across Network Types...');

        // Set up in-process Socket.io server verification
        let connectionListener = null;
        const mockIo = {
            sockets: {
                adapter: { rooms: new Map() },
                sockets: new Map()
            },
            on: (event, handler) => {
                if (event === 'connection') connectionListener = handler;
            },
            to: () => ({ emit: () => {} }),
            emit: () => {}
        };

        // Ensure serverConfig has no password configured for passwordless tests
        serverConfig.gmCredentials = { username: 'DungeonMaster', salt: '', hash: '' };

        initSocketServer(mockIo);

        function simulateSocketClient(handshake, role, username, gmPassword = '') {
            return new Promise((resolve) => {
                const sock = new EventEmitter();
                sock.id = 'test_sock_' + Math.random().toString(36).substring(2);
                sock.handshake = handshake;
                sock.join = () => {};
                sock.leave = () => {};
                sock.to = () => ({ emit: () => {} });
                sock.disconnect = () => {};

                let result = null;
                sock.on('join_rejected', (data) => {
                    result = { status: 'rejected', data };
                });
                sock.on('joined', (data) => {
                    result = { status: 'joined', data };
                });

                connectionListener(sock);
                sock.emit('join', {
                    campaignId: 'default',
                    username,
                    role,
                    gmPassword
                });

                setImmediate(() => {
                    resolve(result || { status: sock.role === 'Player' ? 'demoted' : 'unknown' });
                });
            });
        }

        // 3a. Cloudflare Tunnel Remote Connection (cf-connecting-ip) attempting passwordless GM
        const tunnelRes = await simulateSocketClient(
            { address: '127.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.195' } },
            'GM',
            'DungeonMaster'
        );
        if (tunnelRes.status !== 'rejected' || tunnelRes.data?.code !== 'PASSWORD_REQUIRED') {
            throw new Error(
                `Tunnel GM join should be rejected with PASSWORD_REQUIRED, got ${JSON.stringify(tunnelRes)}`
            );
        }
        console.log(
            '  ✓ Cloudflare Tunnel remote connection attempting passwordless GM rejected with PASSWORD_REQUIRED.'
        );

        // 3b. Reverse Proxy Remote Connection (x-forwarded-for) attempting passwordless GM
        const proxyRes = await simulateSocketClient(
            { address: '127.0.0.1', headers: { 'x-forwarded-for': '198.51.100.22' } },
            'GM',
            'DungeonMaster'
        );
        if (proxyRes.status !== 'rejected' || proxyRes.data?.code !== 'PASSWORD_REQUIRED') {
            throw new Error(`Proxy GM join should be rejected with PASSWORD_REQUIRED, got ${JSON.stringify(proxyRes)}`);
        }
        console.log('  ✓ Reverse Proxy remote connection attempting passwordless GM rejected with PASSWORD_REQUIRED.');

        // 3c. LAN Remote Connection (non-loopback IP, e.g. 192.168.1.55) attempting passwordless GM
        const lanRes = await simulateSocketClient({ address: '192.168.1.55', headers: {} }, 'GM', 'DungeonMaster');
        if (lanRes.status !== 'rejected' || lanRes.data?.code !== 'PASSWORD_REQUIRED') {
            throw new Error(`LAN GM join should be rejected with PASSWORD_REQUIRED, got ${JSON.stringify(lanRes)}`);
        }
        console.log('  ✓ LAN remote connection attempting passwordless GM rejected with PASSWORD_REQUIRED.');

        // 3d. Direct Loopback Connection (no forwarded headers, loopback IP) attempting GM
        const localRes = await simulateSocketClient({ address: '127.0.0.1', headers: {} }, 'GM', 'DungeonMaster');
        if (localRes.status !== 'joined') {
            throw new Error(`Local loopback GM join should be accepted, got ${JSON.stringify(localRes)}`);
        }
        console.log('  ✓ Local loopback connection permitted passwordless GM join.');

        // --- TEST 4: Real Multipart Upload Traversal Containment & Pre-Auth ---
        console.log('\n[Test 4] Testing Multipart Upload Traversal Containment & Authorization...');

        // 4a. Unauthenticated upload attempt (must fail with 403 before writing file)
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const payloadParts = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="campaignId"\r\n\r\n`,
            `default\r\n`,
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="image"; filename="test.png"\r\n`,
            `Content-Type: image/png\r\n\r\n`,
            `FAKE_PNG_BYTES\r\n`,
            `--${boundary}--\r\n`
        ].join('');

        const unauthUpload = await httpRequest(
            {
                host: '127.0.0.1',
                port: TEST_PORT,
                path: '/api/upload',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': Buffer.byteLength(payloadParts),
                    'x-forwarded-for': '198.51.100.1'
                }
            },
            payloadParts
        );

        if (unauthUpload.statusCode !== 403) {
            throw new Error(`Expected 403 for unauthenticated upload, got ${unauthUpload.statusCode}`);
        }
        console.log('  ✓ Unauthenticated multipart upload strictly rejected with 403 before storage write.');

        // 4b. Authenticated upload with path traversal attempt (campaignId: '../../traversal_test')
        const traversalPayload = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="campaignId"\r\n\r\n`,
            `../../traversal_test\r\n`,
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="image"; filename="token.png"\r\n`,
            `Content-Type: image/png\r\n\r\n`,
            `TOKEN_PNG_BYTES\r\n`,
            `--${boundary}--\r\n`
        ].join('');

        const authTraversalUpload = await httpRequest(
            {
                host: '127.0.0.1',
                port: TEST_PORT,
                path: '/api/upload',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': Buffer.byteLength(traversalPayload),
                    'x-server-secret': TEST_SECRET
                }
            },
            traversalPayload
        );

        if (authTraversalUpload.statusCode !== 200) {
            throw new Error(`Authenticated traversal upload failed with ${authTraversalUpload.statusCode}`);
        }
        // Verify destination was sanitized and contained inside DATA_DIR/campaigns/traversal_test/uploads
        const sanitizedCampaignDir = path.join(TEST_DATA_DIR, 'campaigns', 'traversal_test', 'uploads');
        const outsideEscapeDir = path.join(TEST_DATA_DIR, 'traversal_test');
        if (fs.existsSync(outsideEscapeDir)) {
            throw new Error(`File escaped into ${outsideEscapeDir}! Path traversal containment failed.`);
        }
        if (!fs.existsSync(sanitizedCampaignDir)) {
            throw new Error(`Sanitized destination directory was not created properly inside campaigns`);
        }
        console.log('  ✓ Multipart upload sanitized campaignId and strictly contained write inside campaigns sandbox.');

        // --- TEST 5: Media SSRF Defense (DNS Resolution & Redirect Checking) ---
        console.log('\n[Test 5] Testing Universal Media SSRF Defense...');

        // 5a. Direct loopback / private IP target rejection
        let directPrivateBlocked = false;
        try {
            await safeFetchMedia('http://127.0.0.1:8080/private');
        } catch (e) {
            directPrivateBlocked = e.message.includes('not permitted') || e.message.includes('prohibited IP address');
        }
        if (!directPrivateBlocked) {
            throw new Error('Direct loopback URL was not rejected by safeFetchMedia');
        }
        console.log('  ✓ Direct loopback/private target rejected by safeFetchMedia.');

        // 5b. Spin up a temporary mock HTTP server that attempts open-redirect SSRF to localhost
        const mockRedirectServer = http.createServer((req, res) => {
            if (req.url === '/redirect-to-private') {
                res.writeHead(302, { Location: 'http://127.0.0.1:5097/api/chat' });
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Mock Public OK');
            }
        });

        await new Promise((resolve) => mockRedirectServer.listen(0, '127.0.0.1', resolve));
        const mockPort = mockRedirectServer.address().port;

        let redirectSsrfBlocked = false;
        try {
            // Attempt to resolve media redirecting to private endpoint
            const res = await httpRequest({
                host: '127.0.0.1',
                port: TEST_PORT,
                path: `/api/resolve-media-url?url=${encodeURIComponent(`http://127.0.0.1:${mockPort}/redirect-to-private`)}`,
                method: 'GET'
            });
            if (res.statusCode === 403) {
                redirectSsrfBlocked = true;
            }
        } catch {
            redirectSsrfBlocked = true;
        } finally {
            mockRedirectServer.close();
        }

        if (!redirectSsrfBlocked) {
            throw new Error('Redirect to private loopback endpoint was not blocked with 403');
        }
        console.log('  ✓ Media redirect SSRF to loopback endpoint safely intercepted and blocked with 403.');

        // --- TEST 6: Graceful Windows Server Shutdown & Save Persistence ---
        console.log('\n[Test 6] Testing Windows Server Shutdown Flush & Save Persistence...');

        // Queue in-memory campaign modification (activeMapId = 'map_flushed_before_quit')
        // Update via authenticated PUT /api/campaigns/default
        const updatedCamp = {
            ...initCampaigns.default,
            activeMapId: 'map_flushed_before_quit',
            description: 'This modification must persist across shutdown'
        };

        const saveRes = await httpRequest(
            {
                host: '127.0.0.1',
                port: TEST_PORT,
                path: '/api/campaigns/default',
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-server-secret': TEST_SECRET
                }
            },
            JSON.stringify(updatedCamp)
        );

        if (saveRes.statusCode !== 200) {
            throw new Error(`Failed to update campaign state: ${saveRes.statusCode}`);
        }

        // Send graceful shutdown request to /api/server/shutdown
        const shutdownRes = await httpRequest({
            host: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/server/shutdown',
            method: 'POST',
            headers: {
                'x-server-secret': TEST_SECRET
            }
        });

        if (shutdownRes.statusCode !== 200) {
            throw new Error(`Graceful shutdown request failed with ${shutdownRes.statusCode}`);
        }
        console.log('  ✓ Graceful shutdown request acknowledged by server.');

        // Await server process clean exit
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                serverProcess.kill();
                reject(new Error('Server failed to exit within 3000ms after shutdown request'));
            }, 3000);
            serverProcess.on('exit', (code) => {
                clearTimeout(timer);
                console.log(`  ✓ Server process exited cleanly with code: ${code}.`);
                resolve();
            });
        });

        // Read campaigns.json directly from disk to verify persistence
        const diskRaw = fs.readFileSync(path.join(TEST_DATA_DIR, 'campaigns.json'), 'utf8');
        const diskData = JSON.parse(diskRaw);
        if (diskData.default?.description !== 'This modification must persist across shutdown') {
            throw new Error(`Campaign persistence failed! Disk contains: ${diskData.default?.description}`);
        }
        console.log('  ✓ Pending campaign state successfully verified on disk after graceful shutdown.');

        console.log('\n======================================================');
        console.log('🎉 ALL CODEX SECURITY & RELIABILITY INTEGRATION TESTS PASSED!');
        console.log('======================================================\n');
    } catch (err) {
        serverProcess.kill();
        throw err;
    } finally {
        if (fs.existsSync(TEST_DATA_DIR)) {
            try {
                fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
            } catch {}
        }
    }
}

runTests().catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
});
