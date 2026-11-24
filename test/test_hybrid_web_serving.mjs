import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

import { adminRouter } from '../server/routes/admin.js';
import { campaignsRouter } from '../server/routes/campaigns.js';
import { sourcesRouter } from '../server/routes/sources.js';
import { serverConfig, activeGmTokens, VTT_DIR } from '../server/state.js';
import { hashPassword } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Full Hybrid Web Serving: /play, /prep, Sources & Export/Backup APIs', async (t) => {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api', adminRouter);
    app.use('/api', campaignsRouter);
    app.use('/api', sourcesRouter);

    const prepDir = path.join(rootDir, 'electron', 'ui');
    app.get(['/prep', '/prep/'], (req, res) => {
        if (req.path === '/prep') return res.redirect(302, '/prep/');
        return res.sendFile(path.join(prepDir, 'index.html'));
    });
    app.use('/prep', express.static(prepDir));
    app.get(['/play', '/play/', '/vtt.html'], (_req, res) => res.sendFile(path.join(VTT_DIR, 'index.html')));

    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const originalCreds = serverConfig.gmCredentials;

    const { hash, salt } = hashPassword('HybridPrepPass123!');
    serverConfig.gmCredentials = { username: 'GMCosmic', salt, hash };

    t.after(() => {
        serverConfig.gmCredentials = originalCreds;
        activeGmTokens.clear();
        server.close();
    });

    await t.test('serves /play and /vtt.html with VTT client HTML', async () => {
        const playRes = await fetch(`${baseUrl}/play`);
        assert.equal(playRes.status, 200);
        const playHtml = await playRes.text();
        assert.ok(playHtml.includes('ForgeD VTT'));

        const vttRes = await fetch(`${baseUrl}/vtt.html`);
        assert.equal(vttRes.status, 200);
        await vttRes.text();
    });

    await t.test('serves /prep/ with Control Center HTML and web-api-bridge.js', async () => {
        const redirectRes = await fetch(`${baseUrl}/prep`, { redirect: 'manual' });
        assert.equal(redirectRes.status, 302);
        assert.equal(redirectRes.headers.get('location'), '/prep/');

        const prepRes = await fetch(`${baseUrl}/prep/`);
        assert.equal(prepRes.status, 200);
        const prepHtml = await prepRes.text();
        assert.ok(prepHtml.includes('web-api-bridge.js'));
        assert.ok(prepHtml.includes('prep-login-overlay'));

        const bridgeRes = await fetch(`${baseUrl}/prep/web-api-bridge.js`);
        assert.equal(bridgeRes.status, 200);
        const bridgeJs = await bridgeRes.text();
        assert.ok(bridgeJs.includes('__FORGEDVTT_WEB_PREP__'));
    });

    await t.test('blocks unauthenticated remote calls to /api/sources, export, and backup', async () => {
        const headers = { 'CF-Connecting-IP': '198.51.100.42' };

        const srcRes = await fetch(`${baseUrl}/api/sources`, { headers });
        assert.equal(srcRes.status, 403);

        const expRes = await fetch(`${baseUrl}/api/campaigns/default/export`, { headers });
        assert.equal(expRes.status, 403);

        const bakRes = await fetch(`${baseUrl}/api/server/backup`, { headers });
        assert.equal(bakRes.status, 403);
    });

    await t.test('authenticated GM token unlocks sources, campaign export, and server backup', async () => {
        const loginRes = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'GMCosmic', password: 'HybridPrepPass123!' })
        });
        assert.equal(loginRes.status, 200);
        const { token } = await loginRes.json();
        assert.ok(token);

        const authHeaders = {
            'CF-Connecting-IP': '198.51.100.42',
            'x-gm-token': token
        };

        // 1. Sources GET
        const srcRes = await fetch(`${baseUrl}/api/sources`, { headers: authHeaders });
        assert.equal(srcRes.status, 200);
        const srcData = await srcRes.json();
        assert.ok(srcData && Array.isArray(srcData.categories));

        // 2. Campaign Export
        const expRes = await fetch(`${baseUrl}/api/campaigns/default/export`, { headers: authHeaders });
        assert.equal(expRes.status, 200);
        const expData = await expRes.json();
        assert.equal(expData.success, true);
        assert.ok(expData.fileName.endsWith('.json'));
        assert.ok(expData.content.includes('forgedvtt-campaign-v1'));

        // 3. Server Backup
        const bakRes = await fetch(`${baseUrl}/api/server/backup`, { headers: authHeaders });
        assert.equal(bakRes.status, 200);
        const bakData = await bakRes.json();
        assert.equal(bakData.success, true);
        assert.ok(bakData.fileName.startsWith('ForgeDVTT-Backup-'));
        assert.ok(bakData.content.includes('forgedvtt-backup-v1'));
    });

    await t.test('server.js wires /play, /prep, and sourcesRouter', () => {
        const serverJs = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
        assert.ok(serverJs.includes("'/play'"));
        assert.ok(serverJs.includes("'/prep'"));
        assert.ok(serverJs.includes('sourcesRouter'));
    });
});
