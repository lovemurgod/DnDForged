import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { spawn } from 'child_process';
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
        assert.ok(!html.includes('<base href='), 'docs/play/index.html must use relative paths without <base>');
        assert.ok(html.includes('static-flag.js'), 'Must load static-flag.js');
        assert.ok(
            fs
                .readFileSync(path.join(rootDir, 'docs', 'play', 'static-flag.js'), 'utf8')
                .includes('window.__FORGEDVTT_STATIC_WEB__ = true'),
            'docs/play/static-flag.js must set static web flag'
        );
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
            html.includes('static-flag.js') &&
                fs
                    .readFileSync(path.join(rootDir, 'docs', 'prep', 'static-flag.js'), 'utf8')
                    .includes('window.__FORGEDVTT_STATIC_WEB__ = true'),
            'docs/prep must set static web flag via static-flag.js'
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
                schemasJs.includes('./vtt-entry-resolver.js'),
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

    await t.test('docs/play/sheet.html includes static P2P popout dependencies and local asset refs exist', () => {
        const sheetPath = path.join(rootDir, 'docs', 'play', 'sheet.html');
        assert.ok(fs.existsSync(sheetPath), 'docs/play/sheet.html must exist');
        const sheetHtml = fs.readFileSync(sheetPath, 'utf8');
        assert.ok(!sheetHtml.includes('<base href='), 'docs/play/sheet.html must use relative paths without <base>');
        assert.ok(sheetHtml.includes('static-flag.js'), 'sheet.html must load static-flag.js');
        for (const reqScript of [
            'js/network/vtt-static-shim.js',
            'lib/peerjs.min.js',
            'js/network/vtt-p2p-host-engine.js',
            'js/network/vtt-p2p-adapter.js',
            'lib/purify.min.js'
        ]) {
            assert.ok(sheetHtml.includes(reqScript), `docs/play/sheet.html must load ${reqScript}`);
            assert.ok(
                fs.existsSync(path.join(rootDir, 'docs', 'play', reqScript)),
                `Missing bundled asset docs/play/${reqScript}`
            );
        }

        // Verify all local <script src> and <link href> assets in play & prep pages exist on disk
        for (const [pageRel, baseDir] of [
            ['docs/play/index.html', path.join(rootDir, 'docs', 'play')],
            ['docs/play/sheet.html', path.join(rootDir, 'docs', 'play')],
            ['docs/prep/index.html', path.join(rootDir, 'docs', 'prep')]
        ]) {
            const html = fs.readFileSync(path.join(rootDir, pageRel), 'utf8');
            for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
                const ref = m[1];
                if (/^(https?:|data:|blob:|#|\/play\/|mailto:|javascript:)/i.test(ref)) continue;
                const cleanRef = ref.split('?')[0].split('#')[0];
                if (!cleanRef || cleanRef === '../play/' || cleanRef === '../prep/') continue;
                const resolved = cleanRef.startsWith('../')
                    ? path.resolve(baseDir, cleanRef)
                    : path.resolve(baseDir, cleanRef.replace(/^\/+/, ''));
                assert.ok(fs.existsSync(resolved), `Missing local asset "${ref}" referenced by ${pageRel}`);
            }
        }
    });

    await t.test('1:1 CC0 SVG token integrity across all SRD creatures in docs/play', () => {
        const catalogPath = path.join(rootDir, 'docs', 'play', 'data', 'bestiary-catalog.json');
        const creatures = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        assert.ok(Array.isArray(creatures) && creatures.length > 0, 'bestiary-catalog.json must be non-empty');

        const tokenDir = path.join(rootDir, 'docs', 'play', 'img', 'bestiary', 'tokens');
        const filesInTokenDir = fs.readdirSync(tokenDir);
        const webpFiles = filesInTokenDir.filter((f) => f.toLowerCase().endsWith('.webp'));
        assert.strictEqual(webpFiles.length, 0, 'Static SRD token directory must not contain .webp files');

        for (const creature of creatures) {
            assert.ok(creature.tokenUrl, `Creature ${creature.name} must define tokenUrl`);
            assert.ok(
                creature.tokenUrl.endsWith('.svg'),
                `Creature ${creature.name} tokenUrl (${creature.tokenUrl}) must use .svg in static SRD build`
            );
            const relTokenPath = creature.tokenUrl.replace(/^\/+/, '');
            const fullTokenPath = path.join(rootDir, 'docs', 'play', relTokenPath);
            assert.ok(fs.existsSync(fullTokenPath), `Missing SVG token file ${fullTokenPath} for ${creature.name}`);
            const svgHeader = fs.readFileSync(fullTokenPath, 'utf8').slice(0, 200);
            assert.ok(svgHeader.includes('<svg'), `Token ${fullTokenPath} must be valid SVG XML`);
        }
    });

    await t.test('vtt-static-shim.js API handlers return strict 404/[] and enforce SRD/custom filtering', async () => {
        const shimCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'network', 'vtt-static-shim.js'), 'utf8');
        const store = new Map();
        const origFetch = async (url) => {
            if (String(url).includes('bestiary-catalog.json')) {
                return new Response(
                    JSON.stringify([
                        { id: 'c1', name: 'Goblin', source: 'MM' },
                        { id: 'c2', name: 'Aarakocra', source: 'XMM' }
                    ]),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
            return new Response('Not Found', { status: 404 });
        };
        const sandbox = {
            window: null,
            globalThis: null,
            self: null,
            __FORGEDVTT_STATIC_WEB__: true,
            location: { href: 'https://forgedvtt.com/play/', origin: 'https://forgedvtt.com', pathname: '/play/' },
            localStorage: {
                getItem: (k) => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: (k) => store.delete(k)
            },
            crypto: crypto.webcrypto,
            fetch: origFetch,
            Request,
            Response,
            Headers,
            URL,
            URLSearchParams,
            Blob,
            BroadcastChannel: class {
                postMessage() {}
            },
            console,
            setTimeout,
            clearTimeout
        };
        sandbox.window = sandbox;
        sandbox.globalThis = sandbox;
        sandbox.self = sandbox;
        vm.runInNewContext(shimCode, sandbox);

        const tablesCat = await sandbox.fetch('/api/tables/catalog');
        assert.strictEqual(tablesCat.status, 200);
        assert.deepStrictEqual(await tablesCat.json(), []);

        const decksCat = await sandbox.fetch('/api/decks/catalog');
        assert.strictEqual(decksCat.status, 200);
        assert.deepStrictEqual(await decksCat.json(), []);

        const missingTable = await sandbox.fetch('/api/tables/nonexistent_table');
        assert.strictEqual(missingTable.status, 404);

        const missingDeck = await sandbox.fetch('/api/decks/nonexistent_deck');
        assert.strictEqual(missingDeck.status, 404);

        const missingHandout = await sandbox.fetch('/api/handouts/phb');
        assert.strictEqual(missingHandout.status, 404);

        // Disabling SRD 5.1 must exclude MM creatures while keeping XMM
        store.set('forgedvtt_static_disabled_sources', JSON.stringify(['SRD 5.1']));
        const filteredBestiary = await sandbox.fetch('/api/bestiary/catalog');
        assert.strictEqual(filteredBestiary.status, 200);
        const filteredRows = await filteredBestiary.json();
        assert.strictEqual(filteredRows.length, 1);
        assert.strictEqual(filteredRows[0].name, 'Aarakocra');
    });

    await t.test('docs website pages expose /play/ and /prep/ with updated ports and config paths', () => {
        for (const page of ['index.html', 'getting-started.html', 'self-hosted-vtt.html', 'app-guide.html']) {
            const html = fs.readFileSync(path.join(rootDir, 'docs', page), 'utf8');
            assert.ok(html.includes('href="play/"'), `${page} must link to play/`);
            assert.ok(html.includes('href="prep/"'), `${page} must link to prep/`);
        }
        const selfHosted = fs.readFileSync(path.join(rootDir, 'docs', 'self-hosted-vtt.html'), 'utf8');
        assert.ok(!selfHosted.includes(':3000'), 'self-hosted-vtt.html must not document stale port :3000');
        assert.ok(selfHosted.includes(':5050'), 'self-hosted-vtt.html must document port :5050');

        const appGuide = fs.readFileSync(path.join(rootDir, 'docs', 'app-guide.html'), 'utf8');
        assert.ok(!appGuide.includes('<code>auth.json</code>'), 'app-guide.html must not reference stale auth.json');
        assert.ok(appGuide.includes('forge-config.json'), 'app-guide.html must document forge-config.json');
        assert.ok(!appGuide.includes('Rebuild Catalogs'), 'app-guide.html must not reference removed Rebuild Catalogs');

        const gsHtml = fs.readFileSync(path.join(rootDir, 'docs', 'getting-started.html'), 'utf8');
        assert.ok(!gsHtml.includes('Enter\n          Campaign') && !gsHtml.includes('Enter Campaign'));
        assert.ok(gsHtml.includes('Enter\n          Tabletop') || gsHtml.includes('Enter Tabletop'));

        const sitemap = fs.readFileSync(path.join(rootDir, 'docs', 'sitemap.xml'), 'utf8');
        assert.ok(sitemap.includes('https://forgedvtt.com/play/'));
        assert.ok(sitemap.includes('https://forgedvtt.com/prep/'));
    });

    await t.test('server.js serves /play/sheet.html, SRD .svg fallback, and non-default /vtt-uploads', async () => {
        const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-srv-test-'));
        const secret = 'test_secret_123456';
        const uploadDir = path.join(tmpDataDir, 'campaigns', 'camp_alpha', 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, 'hello.txt'), 'upload-ok', 'utf8');

        const port = 19000 + Math.floor(Math.random() * 10000);
        const child = spawn(process.execPath, [path.join(rootDir, 'server.js')], {
            cwd: rootDir,
            env: {
                ...process.env,
                PORT: String(port),
                FORGEDVTT_DATA_DIR: tmpDataDir,
                FORGEDVTT_CONFIG_FILE: path.join(tmpDataDir, 'forge-config.json'),
                FORGEDVTT_SERVER_SECRET: secret
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        try {
            let ready = false;
            for (let i = 0; i < 40; i++) {
                try {
                    const r = await fetch(`http://127.0.0.1:${port}/api/server/data-dir`, {
                        signal: AbortSignal.timeout(500)
                    });
                    if (r.ok) {
                        ready = true;
                        break;
                    }
                } catch (_) {}
                await new Promise((r) => setTimeout(r, 150));
            }
            assert.ok(ready, 'Express server must start and pass health check');

            const sheetRes = await fetch(`http://127.0.0.1:${port}/play/sheet.html`);
            assert.strictEqual(sheetRes.status, 200);
            const sheetJsRes = await fetch(`http://127.0.0.1:${port}/play/js/vtt-sheet-popout.js`);
            assert.strictEqual(sheetJsRes.status, 200);

            const uploadRes = await fetch(`http://127.0.0.1:${port}/vtt-uploads/hello.txt`);
            assert.strictEqual(uploadRes.status, 200);
            assert.strictEqual(await uploadRes.text(), 'upload-ok');
            assert.ok(uploadRes.headers.get('content-security-policy')?.includes('sandbox'));

            const traversalStatus = await new Promise((resolve, reject) => {
                const req = http.get(
                    { hostname: '127.0.0.1', port, path: '/vtt-uploads/%2e%2e/campaigns.json' },
                    (res) => {
                        res.resume();
                        resolve(res.statusCode);
                    }
                );
                req.on('error', reject);
            });
            assert.strictEqual(traversalStatus, 403);
        } finally {
            try {
                await fetch(`http://127.0.0.1:${port}/api/server/shutdown`, {
                    method: 'POST',
                    headers: { 'x-server-secret': secret }
                });
            } catch (_) {}
            await new Promise((resolve) => {
                if (child.exitCode !== null) return resolve();
                const timer = setTimeout(() => {
                    if (child.exitCode === null) {
                        try {
                            child.kill('SIGKILL');
                        } catch (_) {}
                    }
                    resolve();
                }, 1500);
                child.once('exit', () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
            fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    });

    await t.test('static-storage-driver.js prompts to reconnect/link folder before import', async () => {
        const driverSrc = fs.readFileSync(path.join(rootDir, 'electron', 'ui', 'static-storage-driver.js'), 'utf8');
        let confirmCalls = 0;
        let confirmResponse = false;
        const alertMessages = [];
        const sandbox = {
            confirm: () => {
                confirmCalls += 1;
                return confirmResponse;
            },
            alert: (msg) => {
                alertMessages.push(msg);
            },
            showDirectoryPicker: () => {},
            localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            crypto: { getRandomValues: (arr) => arr.fill(1) },
            console
        };
        sandbox.window = sandbox;
        sandbox.globalThis = sandbox;
        vm.runInNewContext(driverSrc, sandbox);
        const drv = sandbox.__staticStorageDriver;
        assert.ok(typeof drv.ensureFolderConnectionForImport === 'function');

        // 1. Paused folder: user accepts reconnect
        drv.hasFsAccess = true;
        drv.dirHandle = null;
        drv.needsFolderReconnect = true;
        drv.rememberedFolderName = 'MyCampaigns';
        let reconnectCalled = 0;
        drv.reconnectRememberedFolder = async () => {
            reconnectCalled += 1;
            drv.dirHandle = { name: 'MyCampaigns' };
            drv.needsFolderReconnect = false;
            return true;
        };
        confirmResponse = true;
        const reconnected = await drv.ensureFolderConnectionForImport();
        assert.equal(confirmCalls, 1);
        assert.equal(reconnectCalled, 1);
        assert.equal(reconnected.connected, true);
        assert.equal(reconnected.failedToConnect, false);
        assert.equal(alertMessages.length, 0);

        // 2. Paused folder: user accepts reconnect, but permission is denied -> alerts user
        drv.dirHandle = null;
        drv.needsFolderReconnect = true;
        drv.reconnectRememberedFolder = async () => false;
        confirmResponse = true;
        const failed = await drv.ensureFolderConnectionForImport();
        assert.equal(confirmCalls, 2);
        assert.equal(failed.connected, false);
        assert.equal(failed.failedToConnect, true);
        assert.equal(alertMessages.length, 1);
        assert.ok(alertMessages[0].includes('IndexedDB'));

        // 3. Unlinked folder: user declines and falls back to IndexedDB without alert
        drv.dirHandle = null;
        drv.needsFolderReconnect = false;
        let pickCalled = 0;
        drv.pickCampaignFolder = async () => {
            pickCalled += 1;
            return { canceled: true };
        };
        confirmResponse = false;
        const declined = await drv.ensureFolderConnectionForImport();
        assert.equal(confirmCalls, 3);
        assert.equal(pickCalled, 0);
        assert.equal(declined.connected, false);
        assert.equal(declined.failedToConnect, false);
        assert.equal(alertMessages.length, 1);
    });

    await t.test(
        'web-api-bridge.js checks folder connection before file picker and on create in static mode',
        async () => {
            const bridgeSrc = fs.readFileSync(path.join(rootDir, 'electron', 'ui', 'web-api-bridge.js'), 'utf8');
            const callOrder = [];
            const fakeFile = {
                name: 'camp.json',
                text: async () => JSON.stringify({ id: 'c1', name: 'Test Camp', maps: {} })
            };
            const sandbox = {
                __FORGEDVTT_STATIC_WEB__: true,
                __staticStorageDriver: {
                    campaigns: {},
                    init: async () => {},
                    ensureFolderConnectionForImport: async () => {
                        callOrder.push('ensureFolder');
                        return { connected: true, storageLabel: 'Local Folder: Campaigns' };
                    },
                    getDataPathLabel: () => 'Local Folder: Campaigns',
                    _saveCampaigns: async () => {
                        callOrder.push('saveCampaigns');
                    }
                },
                document: {
                    createElement: () => {
                        const el = {
                            type: '',
                            accept: '',
                            multiple: false,
                            files: [fakeFile],
                            onchange: null,
                            click: () => {
                                callOrder.push('pickFiles');
                                setTimeout(() => el.onchange && el.onchange(), 0);
                            }
                        };
                        return el;
                    }
                },
                localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
                setTimeout,
                clearTimeout,
                console
            };
            sandbox.window = sandbox;
            sandbox.globalThis = sandbox;
            vm.runInNewContext(bridgeSrc, sandbox);
            const api = sandbox.window.electronAPI;

            const importRes = await api.gmImportCampaign(null);
            assert.equal(importRes.success, true);
            assert.equal(importRes.storageLabel, 'Local Folder: Campaigns');
            assert.deepEqual(callOrder, ['ensureFolder', 'pickFiles', 'saveCampaigns']);

            callOrder.length = 0;
            const createRes = await api.gmCreateCampaign({ name: 'Created Camp' });
            assert.equal(createRes.success, true);
            assert.equal(createRes.storageLabel, 'Local Folder: Campaigns');
            assert.deepEqual(callOrder, ['ensureFolder', 'saveCampaigns']);
        }
    );

    await t.test(
        'launcher.js resolveActiveDataDir respects CLI, env, config, legacy, and userData precedence',
        async () => {
            const { resolveActiveDataDir } = await import('../launcher.js');
            const repoDir = path.join(rootDir, '__fake_repo__');
            const userDataDir = path.join(rootDir, '__fake_userdata__');

            assert.equal(
                resolveActiveDataDir(
                    { campaignDataDir: '/cfg/data' },
                    {
                        argv: ['--data-dir', '/cli/data'],
                        env: { FORGEDVTT_DATA_DIR: '/env/data' },
                        repoDir,
                        userDataDir,
                        existsSync: () => false
                    }
                ),
                path.resolve('/cli/data')
            );

            assert.equal(
                resolveActiveDataDir(null, {
                    argv: ['--data-dir=/cli/equals'],
                    env: {},
                    repoDir,
                    userDataDir,
                    existsSync: () => false
                }),
                path.resolve('/cli/equals')
            );

            assert.equal(
                resolveActiveDataDir(
                    { campaignDataDir: '/cfg/data' },
                    {
                        argv: [],
                        env: { FORGEDVTT_DATA_DIR: '/env/data' },
                        repoDir,
                        userDataDir,
                        existsSync: () => false
                    }
                ),
                path.resolve('/env/data')
            );

            assert.equal(
                resolveActiveDataDir(
                    { campaignDataDir: '/cfg/data' },
                    { argv: [], env: {}, repoDir, userDataDir, existsSync: () => false }
                ),
                path.resolve('/cfg/data')
            );

            assert.equal(
                resolveActiveDataDir(null, {
                    argv: [],
                    env: {},
                    repoDir,
                    userDataDir,
                    existsSync: (p) => p === path.join(repoDir, '.dndforged-data', 'campaigns.json')
                }),
                path.join(repoDir, '.dndforged-data')
            );

            assert.equal(
                resolveActiveDataDir(null, { argv: [], env: {}, repoDir, userDataDir, existsSync: () => false }),
                path.join(userDataDir, '.dndforged-data')
            );
        }
    );
});
