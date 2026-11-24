import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'http';
import {
    extractSubdomain,
    TUNNEL_ROOT_DOMAINS,
    SERVER_INTERNAL_SECRET
} from '../server/state.js';
import { adminRouter } from '../server/routes/admin.js';

test('Online Tunnel Remediation: Subdomain Extraction', async (t) => {
    await t.test('filters out trycloudflare.com ephemeral subdomains', () => {
        assert.equal(extractSubdomain('fluffy-panther-1234.trycloudflare.com'), null);
        assert.equal(extractSubdomain('random-abc-99.trycloudflare.com:443'), null);
        assert.equal(extractSubdomain('trycloudflare.com'), null);
    });

    await t.test('filters out other known tunnel providers', () => {
        assert.equal(extractSubdomain('game-session.localtunnel.me'), null);
        assert.equal(extractSubdomain('test.ngrok.io'), null);
        assert.equal(extractSubdomain('test.ngrok.app'), null);
        assert.equal(extractSubdomain('test.ngrok-free.app'), null);
    });

    await t.test('preserves valid campaign subdomains for custom / forgedvtt.com domains', () => {
        assert.equal(extractSubdomain('cosmic.forgedvtt.com'), 'cosmic');
        assert.equal(extractSubdomain('strahd.forgedvtt.com:5050'), 'strahd');
        assert.equal(extractSubdomain('tavern.localhost'), 'tavern');
    });

    await t.test('ignores apex, localhost, and internal keywords', () => {
        assert.equal(extractSubdomain('localhost'), null);
        assert.equal(extractSubdomain('127.0.0.1'), null);
        assert.equal(extractSubdomain('www.forgedvtt.com'), null);
        assert.equal(extractSubdomain('api.forgedvtt.com'), null);
        assert.equal(extractSubdomain(''), null);
        assert.equal(extractSubdomain(null), null);
    });
});

test('Online Tunnel Remediation: GET /api/server/data-dir Sanitization', async (t) => {
    const app = express();
    app.use(express.json());
    app.use('/api', adminRouter);

    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    t.after(() => {
        server.close();
    });

    await t.test('loopback request receives full activeDataDir', async () => {
        const res = await fetch(`${baseUrl}/api/server/data-dir`);
        assert.equal(res.ok, true);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(typeof data.activeDataDir === 'string');
        assert.ok(data.activeDataDir.length > 0);
    });

    await t.test('remote proxy request (CF-Connecting-IP) receives sanitized response without activeDataDir', async () => {
        const res = await fetch(`${baseUrl}/api/server/data-dir`, {
            headers: {
                'CF-Connecting-IP': '198.51.100.24'
            }
        });
        assert.equal(res.ok, true);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.activeDataDir, undefined, 'activeDataDir must not be disclosed to remote callers');
    });

    await t.test('remote proxy request (X-Forwarded-For) receives sanitized response without activeDataDir', async () => {
        const res = await fetch(`${baseUrl}/api/server/data-dir`, {
            headers: {
                'X-Forwarded-For': '203.0.113.50, 127.0.0.1'
            }
        });
        assert.equal(res.ok, true);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.activeDataDir, undefined);
    });

    await t.test('remote request with authorized internal secret receives full activeDataDir', async () => {
        const res = await fetch(`${baseUrl}/api/server/data-dir`, {
            headers: {
                'CF-Connecting-IP': '198.51.100.24',
                'x-server-secret': SERVER_INTERNAL_SECRET
            }
        });
        assert.equal(res.ok, true);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(typeof data.activeDataDir === 'string');
    });
});
