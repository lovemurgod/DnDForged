import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Electron UI has P2P launcher buttons and listeners', () => {
    const html = fs.readFileSync(path.resolve('electron/ui/index.html'), 'utf-8');
    assert.match(html, /id="btn-launch-app-p2p"/, 'index.html has btn-launch-app-p2p');
    assert.match(html, /id="btn-launch-browser-p2p"/, 'index.html has btn-launch-browser-p2p');

    const js = fs.readFileSync(path.resolve('electron/ui/dashboard.js'), 'utf-8');
    assert.match(js, /btnLaunchAppP2p/, 'dashboard.js binds btnLaunchAppP2p');
    assert.match(js, /btnLaunchBrowserP2p/, 'dashboard.js binds btnLaunchBrowserP2p');
    assert.match(js, /openVttApp\(targetUrl\)/, 'dashboard.js calls openVttApp with targetUrl');
    assert.match(js, /openVttBrowser\(targetUrl\)/, 'dashboard.js calls openVttBrowser with targetUrl');
});

test('VTT Login screen has connection tooltips and dynamic hint subtitle', () => {
    const html = fs.readFileSync(path.resolve('vtt/index.html'), 'utf-8');
    assert.match(
        html,
        /id="tab-login-server"[^>]*title="Offline \/ Host Server:/,
        'Server tab has informative tooltip'
    );
    assert.match(html, /id="tab-login-p2p"[^>]*title="Online \(Direct P2P\):/, 'P2P tab has informative tooltip');
    assert.match(html, /id="login-connection-hint"/, 'Login screen has connection hint container');
    assert.match(html, /id="login-connection-hint-text"/, 'Login screen has dynamic connection hint text');

    const authJs = fs.readFileSync(path.resolve('vtt/js/bootstrap/vtt-auth.js'), 'utf-8');
    assert.match(authJs, /login-connection-hint-text/, 'vtt-auth.js updates login-connection-hint-text');
    assert.match(authJs, /Direct P2P:.*Low-latency direct connection/, 'vtt-auth.js provides clear P2P explanation');
    assert.match(authJs, /Web Server:.*Standard host connection/, 'vtt-auth.js provides clear Server explanation');
});
