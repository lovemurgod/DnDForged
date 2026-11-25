import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('Static Web P2P Build: docs/play & docs/prep', async (t) => {
    const playIndexPath = path.join(rootDir, 'docs', 'play', 'index.html');
    const prepIndexPath = path.join(rootDir, 'docs', 'prep', 'index.html');

    await t.test('generates docs/play/index.html with /play/ base href and static flag', () => {
        assert.ok(fs.existsSync(playIndexPath), 'docs/play/index.html must exist');
        const html = fs.readFileSync(playIndexPath, 'utf8');
        assert.ok(html.includes('<base href="/play/">'), 'docs/play/index.html must use <base href="/play/">');
        assert.ok(html.includes('window.__FORGEDVTT_STATIC_WEB__ = true'), 'Must set static web flag');
        assert.ok(
            !html.includes('/socket.io/socket.io.js'),
            'Must not request /socket.io/socket.io.js in static build'
        );
        assert.ok(html.includes('js/network/vtt-static-shim.js'), 'Must include vtt-static-shim.js');
    });

    await t.test('generates docs/play/data with clean SRD catalogs', () => {
        const dataDir = path.join(rootDir, 'docs', 'play', 'data');
        assert.ok(fs.existsSync(path.join(dataDir, 'bestiary-catalog.json')), 'SRD bestiary catalog must exist');
        assert.ok(fs.existsSync(path.join(dataDir, 'spells-catalog.json')), 'SRD spells catalog must exist');
        assert.ok(fs.existsSync(path.join(dataDir, 'classes-catalog.json')), 'SRD classes catalog must exist');
    });

    await t.test('generates docs/prep/index.html with static storage driver & dual-mode bridge', () => {
        assert.ok(fs.existsSync(prepIndexPath), 'docs/prep/index.html must exist');
        const html = fs.readFileSync(prepIndexPath, 'utf8');
        assert.ok(
            html.includes('window.__FORGEDVTT_STATIC_WEB__ = true'),
            'docs/prep/index.html must set static web flag'
        );
        assert.ok(html.includes('static-storage-driver.js'), 'docs/prep/index.html must load static-storage-driver.js');
        assert.ok(html.includes('web-api-bridge.js'), 'docs/prep/index.html must load web-api-bridge.js');
        assert.ok(fs.existsSync(path.join(rootDir, 'docs', 'prep', 'static-storage-driver.js')));
        assert.ok(fs.existsSync(path.join(rootDir, 'docs', 'prep', 'web-api-bridge.js')));
    });

    await t.test('vtt-static-shim.js and vtt-session.js enforce GM password in static P2P mode', () => {
        const authJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'bootstrap', 'vtt-auth.js'), 'utf8');
        const shimJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'network', 'vtt-static-shim.js'), 'utf8');
        const sessionJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'bootstrap', 'vtt-session.js'), 'utf8');
        assert.ok(shimJs.includes('/api/gm-auth-required'), 'vtt-static-shim.js must intercept /api/gm-auth-required');
        assert.ok(
            shimJs.includes('__verifyStaticGmPassword'),
            'vtt-static-shim.js must expose __verifyStaticGmPassword'
        );
        assert.ok(
            sessionJs.includes('__verifyStaticGmPassword'),
            'vtt-session.js must verify static GM password on connect'
        );
        assert.ok(authJs.includes('isStaticOrP2p'), 'vtt-auth.js must allow P2P join if /api/campaigns is unavailable');
    });

    await t.test('dashboard.js defaults P2P share link to https://forgedvtt.com/play when no tunnel is active', () => {
        const dashJs = fs.readFileSync(path.join(rootDir, 'electron', 'ui', 'dashboard.js'), 'utf8');
        assert.ok(
            dashJs.includes("'https://forgedvtt.com/play'"),
            'Desktop P2P share link must default to forgedvtt.com/play'
        );
    });

    await t.test(
        'docs/prep bundles vtt-entry-resolver.js with zero dangling ../../vtt/ imports and no duplicate IDs',
        () => {
            const resolverPath = path.join(rootDir, 'docs', 'prep', 'vtt-entry-resolver.js');
            assert.ok(fs.existsSync(resolverPath), 'docs/prep/vtt-entry-resolver.js must exist');
            const schemasJs = fs.readFileSync(path.join(rootDir, 'docs', 'prep', 'builder-schemas.js'), 'utf8');
            assert.ok(
                schemasJs.includes("'./vtt-entry-resolver.js'"),
                'docs/prep/builder-schemas.js must import local resolver'
            );
            assert.equal(
                schemasJs.includes('../../vtt/'),
                false,
                'docs/prep/builder-schemas.js must not use ../../vtt/'
            );

            for (const htmlRel of ['electron/ui/index.html', 'docs/prep/index.html']) {
                const html = fs.readFileSync(path.join(rootDir, htmlRel), 'utf8');
                const seen = new Set();
                for (const m of html.matchAll(/\bid=["']([^"']+)["']/g)) {
                    assert.equal(seen.has(m[1]), false, `Duplicate element id "${m[1]}" in ${htmlRel}`);
                    seen.add(m[1]);
                }
                assert.ok(html.includes('id="btn-gm-export-backup"'), `${htmlRel} must expose Hybrid backup button`);
                assert.ok(html.includes('id="btn-gm-restore-backup"'), `${htmlRel} must expose Hybrid restore button`);
                assert.equal(
                    html.includes('id="modal-compendium-inspect"'),
                    false,
                    `${htmlRel} must not keep dead inspect modal`
                );
            }
        }
    );

    await t.test('Electron builder configs unpack electron/**/* for packaged local server execution', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        const srdCfg = JSON.parse(fs.readFileSync(path.join(rootDir, 'electron-builder-srd.json'), 'utf8'));
        assert.ok(pkg.build.asarUnpack.includes('electron/**/*'), 'package.json must unpack electron/**/*');
        assert.ok(srdCfg.asarUnpack.includes('electron/**/*'), 'electron-builder-srd.json must unpack electron/**/*');
    });
});
