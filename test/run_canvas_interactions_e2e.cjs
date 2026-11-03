/**
 * run_canvas_interactions_e2e.cjs
 * Cross-platform runner for Electron Canvas E2E automated test.
 * Ensures ELECTRON_RUN_AS_NODE is stripped so Electron launches as a real browser.
 * Auto-starts node server.js if not already running on port 5050, and cleans up on exit.
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

function checkServer() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:5050/vtt.html', (res) => {
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(retries = 20) {
    for (let i = 0; i < retries; i++) {
        const ok = await checkServer();
        if (ok) return true;
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

async function main() {
    let serverChild = null;
    const isRunning = await checkServer();
    if (!isRunning) {
        console.log('[E2E Runner] Starting background server.js on port 5050...');
        serverChild = spawn('node', ['server.js'], {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'ignore',
            detached: false
        });
        const ready = await waitForServer();
        if (!ready) {
            console.error('[E2E Runner] Failed to connect to server on port 5050 after launch.');
            if (serverChild) serverChild.kill();
            process.exit(1);
        }
        console.log('[E2E Runner] Server is up and responding.');
    }

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    const testScript = path.join(__dirname, 'test_all_canvas_interactions.mjs');
    const child = spawn('npx', ['electron', testScript], {
        env,
        shell: true,
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        if (serverChild) {
            try {
                serverChild.kill();
                process.kill(serverChild.pid);
            } catch (e) {}
        }
        process.exit(code || 0);
    });
}

main();

