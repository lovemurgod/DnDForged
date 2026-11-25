import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 5088;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function isPortActive(port) {
    return new Promise((resolve) => {
        const socket = net.connect(port, '127.0.0.1');
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => {
            resolve(false);
        });
    });
}

async function isServerReady(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/server/data-dir`, {
            signal: AbortSignal.timeout(1000)
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function findAvailablePort(startPort, maxAttempts = 50) {
    let port = parseInt(startPort, 10);
    for (let i = 0; i < maxAttempts; i++) {
        const candidate = port + i;
        const active = await isPortActive(candidate);
        if (!active) {
            const isBindable = await new Promise((resolve) => {
                const srv = net.createServer();
                srv.once('error', () => resolve(false));
                srv.once('listening', () => {
                    srv.close(() => resolve(true));
                });
                srv.listen(candidate, '127.0.0.1');
            });
            if (isBindable) return candidate;
        }
    }
    return port;
}

async function run() {
    console.log('[Test] Starting server port configuration & fail-fast tests...\n');

    let serverProcess = null;
    let competingProcess = null;
    try {
        // 1. Start Server on TEST_PORT
        console.log(`[Test 1] Spawning server.js with PORT=${TEST_PORT}...`);
        serverProcess = spawn(process.execPath, ['server.js'], {
            cwd: rootDir,
            env: {
                ...process.env,
                PORT: String(TEST_PORT)
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdoutData = '';
        let stderrData = '';
        serverProcess.stdout.on('data', (d) => (stdoutData += d.toString()));
        serverProcess.stderr.on('data', (d) => (stderrData += d.toString()));

        // Wait up to 15s for server to start
        let started = false;
        const startDeadline = Date.now() + 15000;
        while (Date.now() < startDeadline) {
            if (await isServerReady(TEST_PORT)) {
                started = true;
                break;
            }
            await sleep(150);
        }

        assert(started, `Expected server to be ready on port ${TEST_PORT}. Stderr: ${stderrData}`);
        console.log(`✓ Server successfully started and responded on custom port ${TEST_PORT}`);

        // 2. Test EADDRINUSE Fast-Fail
        console.log('\n[Test 2] Testing EADDRINUSE fast-fail (spawning competing server on same port)...');
        const competingStartTime = Date.now();
        competingProcess = spawn(process.execPath, ['server.js'], {
            cwd: rootDir,
            env: {
                ...process.env,
                PORT: String(TEST_PORT)
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let competingStdout = '';
        let competingStderr = '';
        competingProcess.stdout.on('data', (d) => (competingStdout += d.toString()));
        competingProcess.stderr.on('data', (d) => (competingStderr += d.toString()));

        const exitCode = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (competingProcess) competingProcess.kill();
                reject(
                    new Error(
                        `Competing process did not exit within 10000ms! (EADDRINUSE hang bug)\nStdout: ${competingStdout}\nStderr: ${competingStderr}`
                    )
                );
            }, 10000);

            competingProcess.on('exit', (code) => {
                clearTimeout(timeout);
                resolve(code);
            });
        });

        const duration = Date.now() - competingStartTime;
        console.log(`✓ Competing process exited cleanly in ${duration}ms with exit code: ${exitCode}`);
        assert.strictEqual(exitCode, 98, `Expected exit code 98 (EADDRINUSE), got ${exitCode}`);
        assert(duration < 10000, `Expected fast exit in under 10s, took ${duration}ms`);

        // 3. Test findAvailablePort logic
        console.log('\n[Test 3] Testing findAvailablePort auto-assign fallback...');
        const nextFree = await findAvailablePort(TEST_PORT);
        console.log(`✓ When port ${TEST_PORT} is in use, findAvailablePort returned: ${nextFree}`);
        assert.notStrictEqual(nextFree, TEST_PORT, 'findAvailablePort should skip occupied port');
        assert(nextFree > TEST_PORT, 'findAvailablePort should pick an incremented port');
    } finally {
        if (competingProcess) {
            try {
                competingProcess.kill();
            } catch {}
        }
        if (serverProcess) {
            console.log('\n[Cleanup] Shutting down test server...');
            serverProcess.kill();
            await sleep(300);
        }
    }

    console.log('\n======================================================');
    console.log('  ALL SERVER PORT & FAIL-FAST TESTS PASSED SUCCESSFULLY! ');
    console.log('======================================================\n');
}

run().catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
});
