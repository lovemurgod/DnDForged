import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';

import { adminRouter, resetGmLoginRateLimits } from '../server/routes/admin.js';
import { campaignsRouter } from '../server/routes/campaigns.js';
import { serverConfig, activeGmTokens, campaigns } from '../server/state.js';
import { hashPassword } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Audit Remediation Security & Static Web Parity', async (t) => {
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api', adminRouter);
    app.use('/api', campaignsRouter);

    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const originalCreds = serverConfig.gmCredentials;
    const originalCampaignKeys = new Set(Object.keys(campaigns));

    t.after(() => {
        serverConfig.gmCredentials = originalCreds;
        activeGmTokens.clear();
        resetGmLoginRateLimits();
        for (const key of Object.keys(campaigns)) {
            if (!originalCampaignKeys.has(key)) {
                delete campaigns[key];
            }
        }
        server.close();
    });

    await t.test('POST /api/gm-login enforces per-IP rate limit (429 after 5 failed attempts)', async () => {
        resetGmLoginRateLimits();
        const { hash, salt } = hashPassword('CorrectHorseBattery99');
        serverConfig.gmCredentials = { username: 'GameMaster', salt, hash };

        for (let i = 0; i < 5; i++) {
            const res = await fetch(`${baseUrl}/api/gm-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'GameMaster', password: `WrongPass_${i}` })
            });
            assert.equal(res.status, 401, `Attempt ${i + 1} should return 401`);
        }

        const blockedRes = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'GameMaster', password: 'CorrectHorseBattery99' })
        });
        assert.equal(blockedRes.status, 429, '6th attempt within window must return 429');
        const blockedData = await blockedRes.json();
        assert.equal(blockedData.success, false);

        resetGmLoginRateLimits();
        const okRes = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'GameMaster', password: 'CorrectHorseBattery99' })
        });
        assert.equal(okRes.status, 200, 'Login succeeds again after rate limit reset');
    });

    await t.test('POST /api/server/restore ignores __proto__, constructor, and prototype keys', async () => {
        resetGmLoginRateLimits();
        const { hash, salt } = hashPassword('RestoreGuard123!');
        serverConfig.gmCredentials = { username: 'GameMaster', salt, hash };

        const loginRes = await fetch(`${baseUrl}/api/gm-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'GameMaster', password: 'RestoreGuard123!' })
        });
        const { token } = await loginRes.json();
        assert.ok(token, 'Must receive GM session token');

        const maliciousPayload = JSON.parse(
            '{"version":2,"campaigns":{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true}}}'
        );
        const restoreRes = await fetch(`${baseUrl}/api/server/restore`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(maliciousPayload)
        });
        assert.equal(restoreRes.status, 200);
        assert.equal({}.polluted, undefined, 'Object.prototype must not be polluted');
        assert.equal(Object.prototype.hasOwnProperty.call(campaigns, '__proto__'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(campaigns, 'constructor'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(campaigns, 'prototype'), false);
    });

    await t.test('web-api-bridge.js guards all GM and sourcebook methods for isStatic()', () => {
        const bridgeCode = fs.readFileSync(path.join(rootDir, 'electron', 'ui', 'web-api-bridge.js'), 'utf8');
        const requiredStaticMethods = [
            'setGmCredentials',
            'gmExportGranular',
            'gmImportGranular',
            'gmDeleteEntity',
            'sourcesBatchToggle',
            'sourcesTogglePartnered',
            'sourcesToggleUA',
            'sourcesSaveUiState',
            'sourcesApplyPreset',
            'sourcesResetCampaign',
            'sourcesGetDetails',
            'sourcesSaveDetails',
            'sourcesCreateCustom',
            'sourcesDeleteCustom',
            'sourcesSelectAsset',
            'sourcesAddFile',
            'sourcesExport',
            'sourcesSearchCompendium',
            'sourcesSearchGlobal',
            'sourcesGetEntityFull',
            'sourcesGetEntityFullData',
            'sourcesInspectBulk',
            'sourcesExecuteBulkImport',
            'sourcesImportFromUrl'
        ];
        for (const fnName of requiredStaticMethods) {
            const idx = bridgeCode.indexOf(`${fnName}:`);
            assert.notEqual(idx, -1, `Bridge must define ${fnName}`);
            const slice = bridgeCode.slice(idx, idx + 900);
            assert.ok(slice.includes('if (isStatic())'), `${fnName} must handle isStatic() locally`);
        }
    });

    await t.test('vtt-static-shim.js enforces GM password and resolves normalized compendium entries', async () => {
        const shimCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'network', 'vtt-static-shim.js'), 'utf8');
        const storage = new Map();
        const mockLocalStorage = {
            getItem: (k) => (storage.has(k) ? storage.get(k) : null),
            setItem: (k, v) => storage.set(k, String(v))
        };
        const fetchedUrls = [];
        const baseFetch = async (url) => {
            fetchedUrls.push(String(url));
            if (String(url) === 'data/spells-normalized/spells-phb.json') {
                return new Response(
                    JSON.stringify([{ id: 'sp_acid_splash_phb', name: 'Acid Splash', source: 'PHB', level: 0 }]),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
            return new Response('Not Found', { status: 404 });
        };

        const mockWindow = {
            __FORGEDVTT_STATIC_WEB__: true,
            location: { origin: 'https://forgedvtt.com' },
            fetch: baseFetch,
            crypto: crypto.webcrypto
        };
        const sandbox = {
            window: mockWindow,
            localStorage: mockLocalStorage,
            URL,
            Response,
            TextEncoder,
            Uint8Array
        };
        vm.runInNewContext(shimCode, sandbox);

        // Without stored GM credentials, auth is not required
        const noAuthRes = await mockWindow.fetch('/api/gm-auth-required?username=GameMaster');
        assert.deepEqual(await noAuthRes.json(), { required: false, hasPassword: false });

        // With stored SHA-256 GM credentials, auth IS required and verified
        const salt = '0123456789abcdef';
        const hashHex = crypto.createHash('sha256').update(`${salt}:StaticSecret42`).digest('hex');
        mockLocalStorage.setItem(
            'forgedvtt_static_gm_creds',
            JSON.stringify({
                username: 'GameMaster',
                salt,
                sha256Hash: hashHex,
                hasPassword: true
            })
        );

        const authRes = await mockWindow.fetch('/api/gm-auth-required?username=GameMaster');
        assert.deepEqual(await authRes.json(), { required: true, hasPassword: true });

        const okCheck = await mockWindow.__verifyStaticGmPassword('GameMaster', 'StaticSecret42');
        assert.equal(okCheck.ok, true);

        const badPassCheck = await mockWindow.__verifyStaticGmPassword('GameMaster', 'WrongPass');
        assert.equal(badPassCheck.ok, false);

        const badUserCheck = await mockWindow.__verifyStaticGmPassword('OtherUser', 'StaticSecret42');
        assert.equal(badUserCheck.ok, false);

        // Normalized compendium lookup
        const spellRes = await mockWindow.fetch('/api/compendium/spells/PHB/sp_acid_splash_phb');
        assert.equal(spellRes.status, 200);
        const spellJson = await spellRes.json();
        assert.equal(spellJson.name, 'Acid Splash');
        assert.ok(fetchedUrls.includes('data/spells-normalized/spells-phb.json'));
    });
});
