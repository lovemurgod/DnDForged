import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { setupLoginHandlers } from '../vtt/js/bootstrap/vtt-auth.js';
import { startSocketConnection } from '../vtt/js/bootstrap/vtt-session.js';

function installGlobals(dom, values = {}) {
    const keys = ['window', 'document', 'localStorage', 'fetch', 'io', 'alert'];
    const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const globals = {
        window: dom.window,
        document: dom.window.document,
        localStorage: dom.window.localStorage,
        ...values
    };

    Object.entries(globals).forEach(([key, value]) => {
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value
        });
    });

    return () => {
        previous.forEach((descriptor, key) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        });
        dom.window.close();
    };
}

function makeFakeSocket() {
    const handlers = new Map();
    const events = [];
    let disconnectCount = 0;
    const socket = {
        connected: false,
        io: { on() {} },
        on(name, handler) {
            handlers.set(name, handler);
            return this;
        },
        emit(name, ...args) {
            events.push({ name, args });
            return this;
        },
        disconnect() {
            disconnectCount += 1;
            this.connected = false;
        }
    };

    return {
        socket,
        events,
        trigger(name, ...args) {
            return handlers.get(name)?.(...args);
        },
        get disconnectCount() {
            return disconnectCount;
        }
    };
}

test('VTT login removes campaign creation but retains campaign selection and Electron creation', () => {
    const vttHtml = fs.readFileSync(path.join(process.cwd(), 'vtt', 'index.html'), 'utf8');
    const vttAuth = fs.readFileSync(path.join(process.cwd(), 'vtt', 'js', 'bootstrap', 'vtt-auth.js'), 'utf8');
    const electronHtml = fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', 'index.html'), 'utf8');
    const electronDashboard = fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', 'dashboard.js'), 'utf8');

    assert.match(vttHtml, /id="login-campaign"/);
    assert.doesNotMatch(vttHtml, /btn-create-campaign|modal-create-campaign|new-campaign-name/);
    assert.doesNotMatch(vttAuth, /btn-create-campaign|modal-create-campaign|method:\s*'POST'/);
    assert.match(electronHtml, /id="btn-gm-new-campaign"/);
    assert.match(
        electronDashboard,
        /btnCreateModalSubmit\.addEventListener\('click', async \(\) => \{[\s\S]*?api\.gmCreateCampaign/
    );
});

test('canceling GM password verification cancels its pending connection callback', async () => {
    const dom = new JSDOM(
        `<!doctype html><body>
        <div id="login-error-banner" class="vtt-hidden"><span id="login-error-text"></span></div>
        <input id="login-username" value="Game Master">
        <select id="login-role"><option value="GM" selected>GM</option></select>
        <select id="login-campaign"><option value="default" selected>Default</option></select>
        <input id="login-remember" type="checkbox">
        <button id="btn-join-game"></button>
        <div id="modal-gm-password" class="vtt-hidden">
            <input id="input-gm-password" type="password">
            <div id="gm-password-error"></div>
            <button id="btn-submit-gm-password"></button>
            <button id="btn-cancel-gm-password"></button>
        </div>
    </body>`,
        { url: 'http://localhost/' }
    );
    const restoreGlobals = installGlobals(dom, {
        fetch: async (url) => {
            if (String(url).startsWith('/api/gm-auth-required')) {
                return { ok: true, json: async () => ({ required: true, hasPassword: true }) };
            }
            return {
                ok: true,
                headers: { get: () => 'application/json' },
                json: async () => []
            };
        },
        alert() {}
    });
    let cancellationCount = 0;

    try {
        setupLoginHandlers({
            onStartSocketConnection: () => () => {
                cancellationCount += 1;
            }
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        document.getElementById('btn-join-game').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(document.getElementById('modal-gm-password').classList.contains('vtt-hidden'), false);

        document.getElementById('btn-submit-gm-password').click();
        assert.equal(document.getElementById('btn-submit-gm-password').disabled, true);
        document.getElementById('btn-cancel-gm-password').click();

        assert.equal(cancellationCount, 1);
        assert.equal(document.getElementById('modal-gm-password').classList.contains('vtt-hidden'), true);
        assert.equal(document.getElementById('btn-submit-gm-password').disabled, false);
    } finally {
        restoreGlobals();
    }
});

test('campaign discovery blocks joining until retry succeeds', async () => {
    const dom = new JSDOM(
        `<!doctype html><body>
        <div id="login-error-banner" class="vtt-hidden"><span id="login-error-text"></span></div>
        <input id="login-username" value="Player 1">
        <select id="login-role"><option value="Player" selected>Player</option></select>
        <select id="login-campaign"><option value="default">Default Campaign</option></select>
        <input id="login-remember" type="checkbox">
        <div id="campaign-load-error" class="vtt-login-error vtt-hidden"></div>
        <button id="btn-retry-campaigns"></button>
        <button id="btn-join-game"></button>
    </body>`,
        { url: 'http://localhost/' }
    );
    let resolveInitialCampaignRequest;
    const initialCampaignRequest = new Promise((resolve) => {
        resolveInitialCampaignRequest = resolve;
    });
    let campaignRequestCount = 0;
    const joins = [];
    const restoreGlobals = installGlobals(dom, {
        fetch: async (url) => {
            if (!String(url).startsWith('/api/campaigns')) {
                throw new Error(`Unexpected request: ${url}`);
            }
            campaignRequestCount += 1;
            if (campaignRequestCount === 1) return initialCampaignRequest;
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ campaigns: [{ id: 'campaign-2', name: 'Campaign 2' }] })
            };
        }
    });
    const originalConsoleWarn = console.warn;
    console.warn = () => {};

    try {
        setupLoginHandlers({
            onStartSocketConnection: (...args) => joins.push(args)
        });

        const joinButton = document.getElementById('btn-join-game');
        const campaignSelect = document.getElementById('login-campaign');
        assert.equal(joinButton.disabled, true);
        assert.equal(campaignSelect.disabled, true);

        document
            .getElementById('login-username')
            .dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assert.equal(joins.length, 0);

        resolveInitialCampaignRequest({ ok: false, status: 503 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(joinButton.disabled, true);
        assert.equal(campaignSelect.disabled, true);
        assert.equal(campaignSelect.options.length, 0);
        assert.equal(document.getElementById('campaign-load-error').classList.contains('vtt-hidden'), false);

        document.getElementById('btn-retry-campaigns').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(joinButton.disabled, false);
        assert.equal(campaignSelect.disabled, false);
        assert.equal(campaignSelect.value, 'campaign-2');
        assert.equal(document.getElementById('campaign-load-error').classList.contains('vtt-hidden'), true);

        joinButton.click();
        assert.equal(joins.length, 1);
        assert.equal(joins[0][0], 'campaign-2');
    } finally {
        console.warn = originalConsoleWarn;
        restoreGlobals();
    }
});

for (const [failure, getAuthResponse] of [
    ['an HTTP error', async () => ({ ok: false, status: 503 })],
    [
        'a network error',
        async () => {
            throw new Error('network unavailable');
        }
    ],
    ['a malformed response', async () => ({ ok: true, json: async () => ({ required: 'yes', hasPassword: true }) })]
]) {
    test(`GM join is blocked after ${failure}`, async () => {
        const dom = new JSDOM(
            `<!doctype html><body>
            <div id="login-error-banner" class="vtt-hidden"><span id="login-error-text"></span></div>
            <input id="login-username" value="Game Master">
            <select id="login-role"><option value="GM" selected>GM</option></select>
            <select id="login-campaign"><option value="default">Default Campaign</option></select>
            <input id="login-remember" type="checkbox">
            <div id="campaign-load-error" class="vtt-login-error vtt-hidden"></div>
            <button id="btn-retry-campaigns"></button>
            <button id="btn-join-game"></button>
        </body>`,
            { url: 'http://localhost/' }
        );
        const joins = [];
        const restoreGlobals = installGlobals(dom, {
            fetch: async (url) => {
                if (String(url).startsWith('/api/campaigns')) {
                    return {
                        ok: true,
                        status: 200,
                        headers: { get: () => 'application/json' },
                        json: async () => []
                    };
                }
                return getAuthResponse();
            }
        });
        const originalConsoleWarn = console.warn;
        console.warn = () => {};

        try {
            setupLoginHandlers({
                onStartSocketConnection: (...args) => joins.push(args)
            });
            await new Promise((resolve) => setTimeout(resolve, 0));

            document.getElementById('btn-join-game').click();
            await new Promise((resolve) => setTimeout(resolve, 0));

            assert.equal(joins.length, 0);
            assert.equal(document.getElementById('login-error-banner').classList.contains('vtt-hidden'), false);
            assert.match(document.getElementById('login-error-text').textContent, /Unable to verify GM requirements/);
        } finally {
            console.warn = originalConsoleWarn;
            restoreGlobals();
        }
    });
}

test('socket cancellation blocks a late connect and joined event', async () => {
    const dom = new JSDOM('<!doctype html><body><button id="btn-join-game"></button></body>', {
        url: 'http://localhost/'
    });
    const fake = makeFakeSocket();
    dom.window.VTT = { role: 'GM', username: 'Game Master', socket: null, campaignState: null };
    const restoreGlobals = installGlobals(dom, { io: () => fake.socket });

    try {
        const cancel = startSocketConnection('default', 'Game Master', 'GM', 'secret');
        assert.equal(typeof cancel, 'function');

        cancel();
        fake.trigger('connect');
        await fake.trigger('joined', {
            role: 'GM',
            userRole: 'GM',
            campaignState: { id: 'default' }
        });

        assert.equal(fake.disconnectCount, 1);
        assert.equal(
            fake.events.some((event) => event.name === 'join'),
            false
        );
        assert.equal(dom.window.VTT.socket, null);
    } finally {
        restoreGlobals();
    }
});

test('initialization failure preserves the page and blocks implicit partial retries', async () => {
    const dom = new JSDOM(
        `<!doctype html><body>
        <div id="login-overlay"></div>
        <div id="vtt-workspace"></div>
        <div id="vtt-init-error" class="vtt-hidden">
            <pre id="vtt-init-error-details"></pre>
            <button id="btn-vtt-init-reload"></button>
        </div>
    </body>`,
        { url: 'http://localhost/' }
    );
    const fake = makeFakeSocket();
    dom.window.VTT = { role: 'Player', username: 'Player 1', socket: null, campaignState: null };
    const restoreGlobals = installGlobals(dom, { io: () => fake.socket });
    const initError = new Error('module setup failed');
    let moduleAwaitCount = 0;
    const moduleInitPromise = {
        then(resolve, reject) {
            moduleAwaitCount += 1;
            return Promise.reject(initError).then(resolve, reject);
        }
    };
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        startSocketConnection('default', 'Player 1', 'Player', null, { moduleInitPromise });

        await fake.trigger('joined', {
            role: 'Player',
            userRole: 'Player',
            campaignState: { id: 'default', maps: {} }
        });
        assert.equal(dom.window.VTT._modulesInitializationState, 'failed');
        assert.equal(dom.window.VTT._modulesInitialized, false);
        assert.equal(dom.window.document.getElementById('vtt-init-error').classList.contains('vtt-hidden'), false);
        assert.match(dom.window.document.getElementById('vtt-init-error-details').textContent, /module setup failed/);
        assert.ok(dom.window.document.getElementById('vtt-workspace'));
        assert.equal(typeof dom.window.document.getElementById('btn-vtt-init-reload').onclick, 'function');

        await fake.trigger('joined', {
            role: 'Player',
            userRole: 'Player',
            campaignState: { id: 'default', maps: {} }
        });
        assert.equal(moduleAwaitCount, 1);
    } finally {
        console.error = originalConsoleError;
        restoreGlobals();
    }
});
