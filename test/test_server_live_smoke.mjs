import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- RUNNING LIVE SERVER PROCESS SMOKE TEST ---');

const tmpDataDir = path.join(os.tmpdir(), `forge-smoke-data-${Date.now()}`);
fs.mkdirSync(tmpDataDir, { recursive: true });

// Port 5059 for isolated smoke test
const SMOKE_PORT = 5059;
const serverProcess = spawn(process.execPath, [path.join(rootDir, 'server.js')], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: String(SMOKE_PORT),
    FORGEDVTT_DATA_DIR: tmpDataDir
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOut = '';
serverProcess.stdout.on('data', (d) => { serverOut += d.toString(); });
serverProcess.stderr.on('data', (d) => { serverOut += d.toString(); });

async function checkUrl(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
  return { status: res.status, ok: res.ok, text: await res.text() };
}

try {
  // Wait up to 10s for server readiness
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 10000) {
    try {
      const ping = await checkUrl(`http://127.0.0.1:${SMOKE_PORT}/api/server/data-dir`);
      if (ping.ok) {
        ready = true;
        break;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }

  assert.strictEqual(ready, true, 'Server must bind and respond with HTTP 200 within 10s');
  console.log('  ✓ Server process successfully started and responded to HTTP probe.');

  // Check /vtt/index.html
  const vttRes = await checkUrl(`http://127.0.0.1:${SMOKE_PORT}/vtt/index.html`);
  assert.strictEqual(vttRes.status, 200, '/vtt/index.html must return HTTP 200');
  assert.ok(vttRes.text.includes('ForgeDVTT') || vttRes.text.includes('vtt-canvas'), 'VTT HTML must be rendered');
  console.log('  ✓ Browser VTT served cleanly at /vtt/index.html.');

  // Check /api/campaigns
  const campRes = await checkUrl(`http://127.0.0.1:${SMOKE_PORT}/api/campaigns`);
  assert.strictEqual(campRes.status, 200, '/api/campaigns must return HTTP 200');
  console.log('  ✓ Campaigns API responded with HTTP 200.');

} finally {
  serverProcess.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  try {
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  } catch (e) {}
}

console.log('\n======================================================');
console.log('🎉 LIVE SERVER SMOKE TEST COMPLETED SUCCESSFULLY!');
console.log('======================================================');

