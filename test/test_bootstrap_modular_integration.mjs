import test from 'node:test';
import assert from 'node:assert/strict';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
    <div id="login-error-banner" class="vtt-hidden">
        <span id="login-error-text"></span>
    </div>
    <input id="login-remember" type="checkbox">
    <input id="login-username" type="text">
    <select id="login-role">
        <option value="GM">GM</option>
        <option value="Player">Player</option>
    </select>
    <select id="login-campaign"></select>
    <button id="btn-join-game"></button>
    <button id="btn-submit-gm-password"></button>
    <div id="vtt-pause-overlay" class="vtt-hidden">
        <i id="vtt-pause-icon"></i>
        <span id="vtt-pause-title"></span>
        <span id="vtt-pause-subtitle"></span>
    </div>
    <button id="btn-game-pause"><i></i></button>
    <div id="config-allowlist-users"></div>
</body>
</html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMPurify = DOMPurify(dom.window);

const storage = {};
globalThis.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => {
        storage[k] = String(v);
    },
    removeItem: (k) => {
        delete storage[k];
    }
};

// Import bootstrap modular subsystems
import { initVttGlobals, vttSanitizeHtml, vttAuthHeaders } from '../vtt/js/bootstrap/vtt-globals.js';
import {
    showLoginError,
    clearLoginError,
    restoreRememberedCredentials,
    resetBtnJoin
} from '../vtt/js/bootstrap/vtt-auth.js';
import { updateConnectionStatus, renderAllowlist, setupAllowlistGlobals } from '../vtt/js/bootstrap/vtt-session.js';
import { updateTabletopPauseUI } from '../vtt/js/bootstrap/vtt-pause.js';
import { getFormValuesSnapshot, tryDismissModal } from '../vtt/js/bootstrap/vtt-modals.js';

test('Bootstrap Globals: Namespace, Sanitization & GM Auth Headers', async (t) => {
    await t.test('initVttGlobals establishes window.VTT baseline state and helpers', () => {
        initVttGlobals();
        assert.ok(window.VTT, 'window.VTT must be initialized');
        assert.equal(window.VTT.campaignId, 'default');
        assert.equal(window.VTT.role, 'GM');
        assert.equal(typeof window.vttSanitizeHtml, 'function');
        assert.equal(typeof window.vttAuthHeaders, 'function');
    });

    await t.test('vttSanitizeHtml strictly filters malicious XSS while preserving 5e tags', () => {
        // Attack vectors
        const xssScript = '<div>Test<script>alert("hacked")</script></div>';
        assert.equal(vttSanitizeHtml(xssScript).includes('<script>'), false);

        const xssEvent = '<img src="invalid.png" onerror="alert(1)">';
        assert.equal(vttSanitizeHtml(xssEvent).includes('onerror'), false);

        const xssUri = '<a href="javascript:alert(1)">Click</a>';
        assert.equal(vttSanitizeHtml(xssUri).includes('javascript:'), false);

        // Safe 5e chips and FontAwesome icons
        const safe5e =
            '<div class="roll-card" data-formula="1d20+5"><i class="fa-solid fa-dice-d20"></i> <b>Roll:</b> <span>18</span></div>';
        const sanitized = vttSanitizeHtml(safe5e);
        assert.ok(sanitized.includes('data-formula="1d20+5"'));
        assert.ok(sanitized.includes('fa-dice-d20'));
        assert.ok(sanitized.includes('<b>Roll:</b>'));
    });

    await t.test('vttAuthHeaders injects x-gm-token strictly when active GM session token exists', () => {
        window.VTT.gmSessionToken = null;
        const h1 = vttAuthHeaders({ 'Content-Type': 'application/json' });
        assert.equal(h1['x-gm-token'], undefined);

        window.VTT.gmSessionToken = 'test-ephemeral-gm-token-xyz';
        const h2 = vttAuthHeaders({ 'Content-Type': 'application/json' });
        assert.equal(h2['x-gm-token'], 'test-ephemeral-gm-token-xyz');
        assert.equal(h2['Content-Type'], 'application/json');
    });
});

test('Bootstrap Auth: Login Error Banners & Remember-Me Persistence', async (t) => {
    await t.test('showLoginError and clearLoginError toggle banner visibility', () => {
        const banner = document.getElementById('login-error-banner');
        const text = document.getElementById('login-error-text');

        showLoginError('Invalid credentials');
        assert.equal(text.textContent, 'Invalid credentials');
        assert.equal(banner.classList.contains('vtt-hidden'), false);

        clearLoginError();
        assert.equal(banner.classList.contains('vtt-hidden'), true);
    });

    await t.test('restoreRememberedCredentials loads stored username and role from localStorage', () => {
        storage.vtt_remember = 'true';
        storage.vtt_username = 'DungeonMasterBob';
        storage.vtt_role = 'GM';

        restoreRememberedCredentials();
        assert.equal(document.getElementById('login-remember').checked, true);
        assert.equal(document.getElementById('login-username').value, 'DungeonMasterBob');
        assert.equal(document.getElementById('login-role').value, 'GM');
    });

    await t.test('resetBtnJoin re-enables login and password validate buttons', () => {
        const btnJoin = document.getElementById('btn-join-game');
        const btnVal = document.getElementById('btn-submit-gm-password');
        btnJoin.disabled = true;
        btnVal.disabled = true;

        resetBtnJoin();
        assert.equal(btnJoin.disabled, false);
        assert.ok(btnJoin.innerHTML.includes('Enter Tabletop'));
        assert.equal(btnVal.disabled, false);
        assert.ok(btnVal.innerHTML.includes('Validate'));
    });
});

test('Bootstrap Tabletop Pause & Safety Tools (X-Card)', async (t) => {
    await t.test('updateTabletopPauseUI transitions between GM Pause and X-Card Pause', () => {
        let notifiedCanvasPause = null;
        window.VTT.canvasEngine = {
            setGamePauseState: (p) => {
                notifiedCanvasPause = p;
            }
        };

        const overlay = document.getElementById('vtt-pause-overlay');
        const titleEl = document.getElementById('vtt-pause-title');

        // 1. GM Pause Trigger
        updateTabletopPauseUI({ isPaused: true, source: 'gm' }, false);
        assert.equal(window.VTT.isPaused, true);
        assert.equal(notifiedCanvasPause, true);
        assert.equal(overlay.classList.contains('active'), true);
        assert.equal(overlay.classList.contains('theme-gm'), true);
        assert.ok(titleEl.textContent.includes('PAUSED BY GM'));

        // 2. X-Card Trigger
        updateTabletopPauseUI({ isPaused: true, source: 'xcard', by: 'Alice' }, false);
        assert.equal(window.VTT.isPaused, true);
        assert.equal(overlay.classList.contains('theme-xcard'), true);
        assert.ok(titleEl.textContent.includes('X-CARD'));

        // 3. Resume Tabletop
        updateTabletopPauseUI({ isPaused: false }, false);
        assert.equal(window.VTT.isPaused, false);
        assert.equal(notifiedCanvasPause, false);
    });
});

test('Bootstrap Modals: Form Value Snapshotting & Change Dismissal Confirmation', async (t) => {
    await t.test('getFormValuesSnapshot serializes all interactive form elements', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <input type="text" value="Goblin Ambush">
            <input type="checkbox" checked>
            <select><option value="night" selected>Night</option></select>
        `;

        const snapshot = getFormValuesSnapshot(container);
        assert.equal(snapshot, JSON.stringify(['Goblin Ambush', true, 'night']));
    });

    await t.test('tryDismissModal prevents discarding unsaved changes unless confirmed', () => {
        let confirmCalled = false;
        let confirmResult = false;
        globalThis.confirm = (msg) => {
            confirmCalled = true;
            return confirmResult;
        };

        const modal = document.createElement('div');
        modal.innerHTML = '<input type="text" value="Dirty Edited Name">';
        modal._initialModalSnapshot = JSON.stringify(['Clean Name']);

        // User cancels confirmation -> modal stays open
        confirmResult = false;
        const dismissedCancelled = tryDismissModal(modal);
        assert.equal(dismissedCancelled, false);
        assert.equal(confirmCalled, true);
        assert.equal(modal.classList.contains('vtt-hidden'), false);

        // User accepts confirmation -> modal is hidden
        confirmResult = true;
        const dismissedAccepted = tryDismissModal(modal);
        assert.equal(dismissedAccepted, true);
        assert.equal(modal.classList.contains('vtt-hidden'), true);
    });
});

test('Bootstrap Session: Allowlist Registration & Globals Handshake', async (t) => {
    await t.test('setupAllowlistGlobals attaches addAllowlistUser and removeAllowlistUser to window', () => {
        setupAllowlistGlobals();
        assert.equal(typeof window.addAllowlistUser, 'function');
        assert.equal(typeof window.removeAllowlistUser, 'function');
    });

    await t.test('renderAllowlist generates rows for each allowed player username', () => {
        renderAllowlist(['Frodo', 'Samwise', 'Gandalf']);
        const container = document.getElementById('config-allowlist-users');
        assert.equal(container.children.length, 3, 'Should render 3 player rows in allowlist');
    });
});
