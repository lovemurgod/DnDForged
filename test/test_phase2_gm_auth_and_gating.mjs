import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

import { adminRouter } from '../server/routes/admin.js';
import { campaignsRouter } from '../server/routes/campaigns.js';
import { serverConfig, activeGmTokens } from '../server/state.js';
import { hashPassword } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Phase 2: Remote GM Login / Logout API & Token Enforcement', async (t) => {
    const app = express();
    app.use(express.json());
    app.use('/api', adminRouter);
    app.use('/api', campaignsRouter);

    const server = createServer(app);
    server.keepAliveTimeout = 60000;
    server.headersTimeout = 65000;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const originalCreds = serverConfig.gmCredentials;

    t.after(() => {
        serverConfig.gmCredentials = originalCreds;
        activeGmTokens.clear();
        server.close();
    });

    await t.test('rejects remote login (403) when no GM password is configured', async () => {
        serverConfig.gmCredentials = { username: 'GameMaster', salt: '', hash: '' };
        const res = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'GameMaster', password: '' })
        });
        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.success, false);
    });

    await t.test('rejects invalid username or password (401)', async () => {
        const { hash, salt } = hashPassword('SecretForge123!');
        serverConfig.gmCredentials = { username: 'GMCosmic', salt, hash };

        const wrongPw = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'GMCosmic', password: 'WrongPassword' })
        });
        assert.equal(wrongPw.status, 401);

        const wrongUser = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Player1', password: 'SecretForge123!' })
        });
        assert.equal(wrongUser.status, 401);
    });

    await t.test('issues valid GM token on login and revokes it on logout', async () => {
        const { hash, salt } = hashPassword('SecretForge123!');
        serverConfig.gmCredentials = { username: 'GMCosmic', salt, hash };

        const loginRes = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'gmcosmic', password: 'SecretForge123!' })
        });
        assert.equal(loginRes.status, 200);
        const loginData = await loginRes.json();
        assert.equal(loginData.success, true);
        assert.ok(typeof loginData.token === 'string' && loginData.token.length > 20);
        assert.equal(loginData.username, 'GMCosmic');

        // Verify token grants access to remote GM-protected route
        const dataDirRes = await fetch(`${baseUrl}/api/server/data-dir`, {
            headers: {
                'CF-Connecting-IP': '198.51.100.10',
                'x-gm-token': loginData.token
            }
        });
        const dataDirBody = await dataDirRes.json();
        assert.ok(typeof dataDirBody.activeDataDir === 'string');

        // Logout invalidates token
        const logoutRes = await fetch(`${baseUrl}/api/gm-logout`, {
            method: 'POST',
            headers: { 'x-gm-token': loginData.token }
        });
        assert.equal(logoutRes.status, 200);

        const postLogoutRes = await fetch(`${baseUrl}/api/campaigns/default`, {
            headers: {
                'CF-Connecting-IP': '198.51.100.10',
                'x-gm-token': loginData.token
            }
        });
        assert.equal(postLogoutRes.status, 403);
    });
});

test('Phase 2: Control Center Layout & Electron Online Security Gates', async (t) => {
    const html = fs.readFileSync(path.join(rootDir, 'electron', 'ui', 'index.html'), 'utf8');
    const mainJs = fs.readFileSync(path.join(rootDir, 'electron', 'main.js'), 'utf8');

    await t.test(
        'places gm-credentials-card inside #view-hosting while keeping #view-gm and #view-sources separate',
        () => {
            const hostingStart = html.indexOf('id="view-hosting"');
            const gmStart = html.indexOf('id="view-gm"');
            const sourcesStart = html.indexOf('id="view-sources"');
            const credCardIdx = html.indexOf('class="card gm-credentials-card');

            assert.ok(hostingStart !== -1 && gmStart !== -1 && sourcesStart !== -1);
            assert.ok(
                credCardIdx > hostingStart && credCardIdx < gmStart,
                'gm-credentials-card must reside in #view-hosting'
            );
            assert.ok(html.indexOf('gm-campaigns-card') > gmStart && html.indexOf('gm-campaigns-card') < sourcesStart);
        }
    );

    await t.test(
        'gates startTunnel, P2P start/regen, and clearPassword while tunnel is active in electron/main.js',
        () => {
            assert.ok(
                mainJs.includes('Set a GM Username and Password in Hosting & Server before starting an online tunnel.')
            );
            assert.ok(mainJs.includes('hasConfiguredGmCredentials()'));
            assert.ok(mainJs.includes('Stop the active online tunnel before removing the GM password.'));
        }
    );
});
