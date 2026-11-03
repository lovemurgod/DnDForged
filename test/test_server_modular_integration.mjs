/**
 * Automated Modular Server Integration & Smoke Test Suite
 * Verifies that the modular server.js entrypoint boots properly and all routes
 * (admin, compendium, campaigns, assets, media, static VTT) respond accurately.
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const TEST_PORT = 5099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchUrl(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runSmokeTests() {
    console.log('--- STARTING MODULAR SERVER INTEGRATION & SMOKE TESTS ---\n');

    console.log(`[Setup] Spawning node server.js on port ${TEST_PORT}...`);
    const rootDir = fs.existsSync('server.js')
        ? process.cwd()
        : path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
    const serverProcess = spawn('node', [path.join(rootDir, 'server.js')], {
        cwd: rootDir,
        env: { ...process.env, PORT: String(TEST_PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverOutput = '';
    serverProcess.stdout.on('data', (d) => {
        serverOutput += d.toString();
    });
    serverProcess.stderr.on('data', (d) => {
        const str = d.toString();
        serverOutput += str;
        if (str.includes('Error') && !str.includes('Notice')) {
            console.error('[Server Error Output]:', str);
        }
    });

    let processExited = false;
    let processExitCode = null;
    serverProcess.on('exit', (code) => {
        processExited = true;
        processExitCode = code;
    });

    // Wait for server to boot
    let booted = false;
    for (let i = 0; i < 50; i++) {
        if (processExited) {
            throw new Error(`Server exited prematurely with code ${processExitCode}. Output:\n${serverOutput}`);
        }
        await sleep(300);
        try {
            const res = await fetchUrl('/');
            if (res.statusCode === 200) {
                booted = true;
                break;
            }
        } catch (e) {
            // still starting
        }
    }

    if (!booted) {
        serverProcess.kill('SIGTERM');
        throw new Error(`Server failed to start within 15 seconds. Output:\n${serverOutput}`);
    }
    console.log('✓ Server booted successfully.\n');

    try {
        // 1. Static HTML & UI endpoints
        console.log('[Test 1] Testing Static HTML endpoints...');
        const rootRes = await fetchUrl('/');
        if (rootRes.statusCode !== 200 || !rootRes.body.includes('<html')) {
            throw new Error(`GET / failed with status ${rootRes.statusCode}`);
        }
        console.log('  ✓ GET / returns 200 HTML');

        const vttRes = await fetchUrl('/vtt.html');
        if (vttRes.statusCode !== 200 || !vttRes.body.includes('<html')) {
            throw new Error(`GET /vtt.html failed with status ${vttRes.statusCode}`);
        }
        console.log('  ✓ GET /vtt.html returns 200 HTML');

        const sheetRes = await fetchUrl('/sheet.html');
        if (sheetRes.statusCode !== 200 || !sheetRes.body.includes('<html')) {
            throw new Error(`GET /sheet.html failed with status ${sheetRes.statusCode}`);
        }
        console.log('  ✓ GET /sheet.html returns 200 HTML');

        // 2. Admin Router endpoints
        console.log('\n[Test 2] Testing Admin Router endpoints...');
        const dataDirRes = await fetchUrl('/api/server/data-dir');
        if (dataDirRes.statusCode !== 200) {
            throw new Error(`GET /api/server/data-dir failed with ${dataDirRes.statusCode}`);
        }
        const dataDirJson = JSON.parse(dataDirRes.body);
        if (!dataDirJson.success || !dataDirJson.activeDataDir) {
            throw new Error(`GET /api/server/data-dir returned unexpected JSON: ${dataDirRes.body}`);
        }
        console.log(`  ✓ GET /api/server/data-dir: activeDataDir = ${dataDirJson.activeDataDir}`);

        const gmAuthRes = await fetchUrl('/api/gm-auth-required');
        if (gmAuthRes.statusCode !== 200) {
            throw new Error(`GET /api/gm-auth-required failed with ${gmAuthRes.statusCode}`);
        }
        console.log('  ✓ GET /api/gm-auth-required returns 200 OK');

        // 3. Campaigns Router endpoints
        console.log('\n[Test 3] Testing Campaigns Router endpoints...');
        const campRes = await fetchUrl('/api/campaigns');
        if (campRes.statusCode !== 200) {
            throw new Error(`GET /api/campaigns failed with ${campRes.statusCode}`);
        }
        const campJson = JSON.parse(campRes.body);
        if (!Array.isArray(campJson.campaigns)) {
            throw new Error(`GET /api/campaigns did not return campaigns array`);
        }
        console.log(`  ✓ GET /api/campaigns returns ${campJson.campaigns.length} campaigns`);

        const chatRes = await fetchUrl('/api/chat');
        if (chatRes.statusCode !== 200) {
            throw new Error(`GET /api/chat failed with ${chatRes.statusCode}`);
        }
        const chatJson = JSON.parse(chatRes.body);
        if (!Array.isArray(chatJson)) {
            throw new Error(`GET /api/chat did not return array`);
        }
        console.log(`  ✓ GET /api/chat returns array with ${chatJson.length} entries`);

        // 4. Compendium Router endpoints
        console.log('\n[Test 4] Testing Compendium Router endpoints...');
        const spellsRes = await fetchUrl('/api/spells/catalog');
        if (spellsRes.statusCode !== 200) {
            throw new Error(`GET /api/spells/catalog failed with ${spellsRes.statusCode}`);
        }
        console.log('  ✓ GET /api/spells/catalog returns 200 OK (Gzip/Catalog cache)');

        const itemsRes = await fetchUrl('/api/items/catalog');
        if (itemsRes.statusCode !== 200) {
            throw new Error(`GET /api/items/catalog failed with ${itemsRes.statusCode}`);
        }
        console.log('  ✓ GET /api/items/catalog returns 200 OK');

        const bestiaryRes = await fetchUrl('/api/bestiary/catalog');
        if (bestiaryRes.statusCode !== 200) {
            throw new Error(`GET /api/bestiary/catalog failed with ${bestiaryRes.statusCode}`);
        }
        console.log('  ✓ GET /api/bestiary/catalog returns 200 OK');

        const disabledSourcesRes = await fetchUrl('/api/sources/disabled');
        if (disabledSourcesRes.statusCode !== 200) {
            throw new Error(`GET /api/sources/disabled failed with ${disabledSourcesRes.statusCode}`);
        }
        console.log('  ✓ GET /api/sources/disabled returns 200 OK');

        // 5. Assets Router endpoints
        console.log('\n[Test 5] Testing Assets Router endpoints...');
        const assetsRes = await fetchUrl('/api/assets');
        if (assetsRes.statusCode !== 200) {
            throw new Error(`GET /api/assets failed with ${assetsRes.statusCode}`);
        }
        const assetsJson = JSON.parse(assetsRes.body);
        if (!assetsJson.name || !Array.isArray(assetsJson.children)) {
            throw new Error(`GET /api/assets did not return valid asset tree`);
        }
        console.log(`  ✓ GET /api/assets returns asset tree root (${assetsJson.children.length} items)`);

        // 6. Media Router endpoints
        console.log('\n[Test 6] Testing Media Router endpoints...');
        const mediaRes = await fetchUrl('/api/resolve-media-url?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        if (mediaRes.statusCode !== 200) {
            throw new Error(`GET /api/resolve-media-url failed with ${mediaRes.statusCode}`);
        }
        const mediaJson = JSON.parse(mediaRes.body);
        if (!mediaJson.isYoutube || !mediaJson.isVideo) {
            throw new Error(`GET /api/resolve-media-url returned unexpected: ${mediaRes.body}`);
        }
        console.log('  ✓ GET /api/resolve-media-url identifies YouTube video correctly');

        // 7. Socket.IO Handshake endpoint
        console.log('\n[Test 7] Testing Socket.IO Handshake...');
        const socketRes = await fetchUrl('/socket.io/?EIO=4&transport=polling');
        if (socketRes.statusCode !== 200) {
            throw new Error(`GET /socket.io polling failed with ${socketRes.statusCode}`);
        }
        if (!socketRes.body.includes('sid')) {
            throw new Error(`Socket.IO polling did not return session ID`);
        }
        console.log('  ✓ Socket.IO polling handshake returns active session ID');

        console.log('\n======================================================');
        console.log('🎉 ALL MODULAR SERVER INTEGRATION TESTS PASSED CLEANLY!');
        console.log('======================================================\n');
    } finally {
        serverProcess.kill('SIGTERM');
    }
}

runSmokeTests().catch((err) => {
    console.error('\n❌ INTEGRATION TEST FAILED:', err);
    process.exit(1);
});
