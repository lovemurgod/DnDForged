/**
 * run_canvas_interactions_e2e.cjs
 * Cross-platform runner for Electron Canvas E2E automated test.
 * Ensures ELECTRON_RUN_AS_NODE is stripped so Electron launches as a real browser.
 * Auto-starts node server.js if not already running on port 5050, and cleans up on exit.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const E2E_PORT = parseInt(process.env.FORGEDVTT_E2E_PORT || '5059', 10);
const E2E_URL = `http://localhost:${E2E_PORT}/vtt.html`;

function checkServer(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/vtt.html`, () => {
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(port, retries = 30) {
    for (let i = 0; i < retries; i++) {
        const ok = await checkServer(port);
        if (ok) return true;
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

function createIsolatedSeedDir() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-e2e-'));
    const defaultMapId = 'map_default_e2e';
    const campaigns = {
        default: {
            id: 'default',
            name: 'Default Campaign',
            description: 'Isolated Canvas E2E Campaign',
            gmUsername: 'DungeonMaster',
            activeMapId: defaultMapId,
            activeGMMapId: defaultMapId,
            maps: {
                [defaultMapId]: {
                    id: defaultMapId,
                    name: 'Initial Map',
                    mapImage: '',
                    grid: { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5 },
                    tokens: {
                        tok_acererak_1: {
                            id: 'tok_acererak_1',
                            name: 'Acererak',
                            x: 1250,
                            y: 850,
                            size: 1,
                            hp: 285,
                            maxHp: 285,
                            ac: 21,
                            layer: 'token',
                            owner: 'DungeonMaster',
                            img: 'img/tokens/goblin.png'
                        }
                    },
                    walls: [],
                    lights: [],
                    shapes: {},
                    drawings: {},
                    traps: [],
                    portals: []
                }
            },
            characters: {},
            initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false }
        }
    };
    fs.writeFileSync(path.join(tmpDir, 'campaigns.json'), JSON.stringify(campaigns, null, 2), 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'forge-config.json'), JSON.stringify({}, null, 2), 'utf8');
    return tmpDir;
}

async function main() {
    const seedDir = createIsolatedSeedDir();
    console.log(`[E2E Runner] Starting isolated server.js on port ${E2E_PORT}...`);
    const serverChild = spawn('node', ['server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: {
            ...process.env,
            PORT: String(E2E_PORT),
            FORGEDVTT_DATA_DIR: seedDir,
            FORGEDVTT_CONFIG_FILE: path.join(seedDir, 'forge-config.json')
        },
        stdio: 'ignore',
        detached: false
    });
    const ready = await waitForServer(E2E_PORT);
    if (!ready) {
        console.error(`[E2E Runner] Failed to connect to server on port ${E2E_PORT} after launch.`);
        try {
            serverChild.kill();
        } catch (e) {}
        fs.rmSync(seedDir, { recursive: true, force: true });
        process.exit(1);
    }
    console.log(`[E2E Runner] Isolated server is up at ${E2E_URL}.`);

    const env = { ...process.env, FORGEDVTT_E2E_URL: E2E_URL };
    delete env.ELECTRON_RUN_AS_NODE;

    const testScript = path.join(__dirname, 'e2e_all_canvas_interactions.mjs');
    const child = spawn('npx', ['electron', testScript], {
        env,
        shell: true,
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        try {
            serverChild.kill();
        } catch (e) {}
        try {
            fs.rmSync(seedDir, { recursive: true, force: true });
        } catch (e) {}
        process.exit(code || 0);
    });
}

main();

