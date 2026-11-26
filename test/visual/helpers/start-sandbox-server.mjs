import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');
const seedDataDir = path.resolve(rootDir, 'test', 'fixtures', 'visual-sandbox-data');
const sandboxConfigFile = path.resolve(rootDir, 'test', 'fixtures', 'visual-sandbox-config.json');

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-pw-sandbox-'));
fs.cpSync(seedDataDir, tempDataDir, { recursive: true });

const child = spawn(process.execPath, [path.join(rootDir, 'server.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
        ...process.env,
        PORT: process.env.PORT || '5051',
        FORGEDVTT_DATA_DIR: tempDataDir,
        FORGEDVTT_CONFIG_FILE: sandboxConfigFile,
        NODE_ENV: 'test'
    }
});

function cleanup() {
    try {
        if (child && !child.killed) child.kill();
    } catch {}
    try {
        fs.rmSync(tempDataDir, { recursive: true, force: true });
    } catch {}
}

process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});
child.on('exit', (code) => {
    try {
        fs.rmSync(tempDataDir, { recursive: true, force: true });
    } catch {}
    process.exit(code ?? 0);
});
