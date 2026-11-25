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
import { campaigns, serverConfig, activeGmTokens, VTT_DIR } from '../server/state.js';
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

    await t.test('GET /api/server/data-dir handles passwordless loopback vs protected host vs remote probes', async () => {
        const saved = serverConfig.gmCredentials;
        try {
            // 1. Passwordless loopback: allows /prep auto-unlock
            serverConfig.gmCredentials = { username: 'LocalGM', salt: '', hash: '' };
            const noPwLocal = await (await fetch(`${baseUrl}/api/server/data-dir`)).json();
            assert.equal(noPwLocal.success, true);
            assert.equal(noPwLocal.hasGmPassword, false);
            assert.equal(noPwLocal.passwordlessLoopback, true);
            assert.equal(typeof noPwLocal.activeDataDir, 'string');

            // 2. Protected loopback without token: denies bypass & does not leak username
            const { hash: pwHash, salt: pwSalt } = hashPassword('ProtectedLocal123!');
            serverConfig.gmCredentials = { username: 'SecretGM', salt: pwSalt, hash: pwHash };
            const pwLocalUnauth = await (await fetch(`${baseUrl}/api/server/data-dir`)).json();
            assert.equal(pwLocalUnauth.hasGmPassword, true);
            assert.equal(pwLocalUnauth.passwordlessLoopback, false);
            assert.equal(pwLocalUnauth.authenticated, false);
            assert.equal(pwLocalUnauth.gmUsername, '');

            // 3. Remote unauthenticated probe: reveals neither activeDataDir nor passwordlessLoopback
            const remoteProbe = await (
                await fetch(`${baseUrl}/api/server/data-dir`, {
                    headers: { 'CF-Connecting-IP': '198.51.100.42' }
                })
            ).json();
            assert.deepEqual(remoteProbe, { success: true });
        } finally {
            serverConfig.gmCredentials = saved;
        }
    });

    await t.test('GET /api/campaigns normalizes missing names and export-granular handles batch=true', async () => {
        const savedLegacy = campaigns.legacy_nameless_camp;
        campaigns.legacy_nameless_camp = { id: 'legacy_nameless_camp' };
        try {
            const listRes = await (await fetch(`${baseUrl}/api/campaigns`)).json();
            const found = listRes.campaigns.find((c) => c.id === 'legacy_nameless_camp');
            assert.ok(found, 'Must include legacy campaign entry');
            assert.equal(found.name, 'legacy_nameless_camp');

            const loginRes = await (
                await fetch(`${baseUrl}/api/gm-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'GMCosmic', password: 'HybridPrepPass123!' })
                })
            ).json();

            const batchRes = await fetch(`${baseUrl}/api/campaigns/default/export-granular?entityType=map&batch=true`, {
                headers: { 'x-gm-token': loginRes.token }
            });
            assert.equal(batchRes.status, 200);
            const batchJson = await batchRes.json();
            assert.equal(batchJson.success, true);
            assert.ok(batchJson.count >= 1);
            assert.ok(batchJson.fileName.endsWith('-map-batch.json'));
            assert.ok(batchJson.content.includes('forgedvtt-batch-v1'));
        } finally {
            if (savedLegacy === undefined) delete campaigns.legacy_nameless_camp;
            else campaigns.legacy_nameless_camp = savedLegacy;
        }
    });

    await t.test('POST /api/sources/inspect-bulk -> execute-bulk stages securely and cleans up', async () => {
        const loginRes = await (
            await fetch(`${baseUrl}/api/gm-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'GMCosmic', password: 'HybridPrepPass123!' })
            })
        ).json();
        const authHeaders = {
            'Content-Type': 'application/json',
            'x-gm-token': loginRes.token
        };

        const sampleBrew = {
            _meta: { sources: [{ json: 'TEST_HYBRID_BULK' }] },
            spell: [{ name: 'Stage Bolt', source: 'TEST_HYBRID_BULK', level: 1 }]
        };
        const inspRes = await fetch(`${baseUrl}/api/sources/inspect-bulk`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ files: [{ name: 'TEST_HYBRID_BULK.json', content: JSON.stringify(sampleBrew) }] })
        });
        assert.equal(inspRes.status, 200);
        const inspData = await inspRes.json();
        assert.equal(inspData.success, true);
        assert.equal(inspData.candidates.length, 1);
        assert.ok(inspData.candidates[0].stageToken);
        assert.equal(inspData.candidates[0].filePath, '');

        // Stale/unknown stageToken must be rejected cleanly
        const badExec = await fetch(`${baseUrl}/api/sources/execute-bulk`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ candidates: [{ ...inspData.candidates[0], stageToken: 'bogus_token' }] })
        });
        assert.equal(badExec.status, 400);

        const execRes = await fetch(`${baseUrl}/api/sources/execute-bulk`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ candidates: inspData.candidates, conflictDecisions: {} })
        });
        assert.equal(execRes.status, 200);
        const execData = await execRes.json();
        assert.equal(execData.success, true);
        assert.equal(execData.importedCount, 1);

        // Clean up imported custom source
        await fetch(`${baseUrl}/api/sources/custom`, {
            method: 'DELETE',
            headers: authHeaders,
            body: JSON.stringify({ category: 'spells', code: 'TEST_HYBRID_BULK' })
        });
    });

    await t.test('server.js wires /play, /prep, and sourcesRouter', () => {
        const serverJs = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
        assert.ok(serverJs.includes("'/play'"));
        assert.ok(serverJs.includes("'/prep'"));
        assert.ok(serverJs.includes('sourcesRouter'));
    });
});
