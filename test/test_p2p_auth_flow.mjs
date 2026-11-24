import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Cloudflare Quick Tunnel Spawner Isolation', async (t) => {
    await t.test('electron/main.js passes --config "" for quick tunnels', () => {
        const mainContent = fs.readFileSync(path.join(rootDir, 'electron', 'main.js'), 'utf8');
        assert.ok(
            mainContent.includes("tunnelArgs.push('tunnel', '--config', '', '--url'"),
            'electron/main.js must inject --config "" when starting Quick Tunnels'
        );
    });

    await t.test('launcher.js passes --config "" for quick tunnels', () => {
        const launcherContent = fs.readFileSync(path.join(rootDir, 'launcher.js'), 'utf8');
        assert.ok(
            launcherContent.includes("tunnelArgs.push('tunnel', '--config', '', '--url'"),
            'launcher.js must inject --config "" when starting Quick Tunnels'
        );
    });
});

test('Frontend P2P Gateway Parameter Forwarding', async (t) => {
    const authContent = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'bootstrap', 'vtt-auth.js'), 'utf8');

    await t.test('bypasses campaignsLoaded check when isP2PMode is active', () => {
        assert.ok(
            authContent.includes('if (!isP2PMode && !campaignsLoaded)'),
            'vtt-auth.js must not block P2P players from joining when campaignsLoaded is false'
        );
    });

    await t.test('constructs p2pOptions and forwards to onStartSocketConnection', () => {
        assert.ok(
            authContent.includes('const p2pOptions = isP2PMode ? {'),
            'vtt-auth.js must construct p2pOptions'
        );
        assert.ok(
            authContent.includes('callbacks.onStartSocketConnection?.(campaignId, username, role, null, p2pOptions)'),
            'vtt-auth.js must pass p2pOptions to onStartSocketConnection on standard join'
        );
        assert.ok(
            authContent.includes('callbacks.onStartSocketConnection?.(campaignId, username, role, pw, p2pOptions)'),
            'vtt-auth.js must pass p2pOptions to onStartSocketConnection on GM password join'
        );
    });

    await t.test('unblocks join button when switching to P2P tab', () => {
        assert.ok(
            authContent.includes('btnJoin.disabled = !campaignsLoaded && !isP2PMode;'),
            'btnJoin should not be disabled in finally block if isP2PMode is active'
        );
    });
});
