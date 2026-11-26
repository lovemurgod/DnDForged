import { spawn, execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = 5050;

function findCloudflared() {
  if (process.env.CLOUDFLARED_BIN && fs.existsSync(process.env.CLOUDFLARED_BIN)) {
    return process.env.CLOUDFLARED_BIN;
  }

  // Check bundled resources directory for Electron
  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const resourceBin = path.join(__dirname, '..', 'bin', binName);
  if (fs.existsSync(resourceBin)) return resourceBin;

  const localExe = path.join(__dirname, 'resources', 'bin', binName);
  if (fs.existsSync(localExe)) return localExe;

  // Check local directory first
  const rootExe = path.join(__dirname, binName);
  if (fs.existsSync(rootExe)) return rootExe;

  // Common Windows installation paths
  const winPaths = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    'C:\\PROGRA~2\\cloudflared\\cloudflared.exe'
  ];

  for (const winPath of winPaths) {
    if (fs.existsSync(winPath)) return winPath;
  }

  // Check system PATH
  try {
    const whichCmd = process.platform === 'win32' ? 'where cloudflared' : 'which cloudflared';
    const output = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (output) return output.split('\r\n')[0].split('\n')[0];
  } catch (e) { }

  return null;
}

function prompt(questionText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(questionText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function isPortActive(port) {
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

async function findAvailablePort(startPort, maxAttempts = 50) {
  let port = parseInt(startPort, 10) || DEFAULT_PORT;
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

function getRequestedPort(appConfig) {
  const args = process.argv.slice(2);
  const portArgIdx = args.findIndex(a => a === '--port' || a === '-p');
  if (portArgIdx !== -1 && args[portArgIdx + 1]) {
    const p = parseInt(args[portArgIdx + 1], 10);
    if (!isNaN(p) && p >= 1024 && p <= 65535) return p;
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p >= 1024 && p <= 65535) return p;
  }
  if (appConfig?.serverPort) {
    const p = parseInt(appConfig.serverPort, 10);
    if (!isNaN(p) && p >= 1024 && p <= 65535) return p;
  }
  return DEFAULT_PORT;
}

function isValidTunnelToken(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length < 30) return false;
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return !!(parsed && (parsed.t || parsed.a || parsed.s));
  } catch (e) {
    return false;
  }
}

function getDefaultUserDataDir() {
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'forgedvtt');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'forgedvtt');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'forgedvtt');
}

function getCliArgValue(args, flag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) return args[i + 1];
    if (args[i].startsWith(`${flag}=`)) return args[i].slice(flag.length + 1);
  }
  return '';
}

export function resolveActiveDataDir(appConfig, options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const env = options.env || process.env;
  const repoDir = options.repoDir || __dirname;
  const checkExists = options.existsSync || fs.existsSync;

  const cliDataDir = getCliArgValue(argv, '--data-dir').trim();
  if (cliDataDir) return path.resolve(cliDataDir);

  if (env.FORGEDVTT_DATA_DIR && env.FORGEDVTT_DATA_DIR.trim()) {
    return path.resolve(env.FORGEDVTT_DATA_DIR.trim());
  }

  if (appConfig?.campaignDataDir && String(appConfig.campaignDataDir).trim()) {
    return path.resolve(String(appConfig.campaignDataDir).trim());
  }

  const legacyRepoDataDir = path.join(repoDir, '.dndforged-data');
  if (checkExists(path.join(legacyRepoDataDir, 'campaigns.json'))) {
    return legacyRepoDataDir;
  }

  const userDataDir = options.userDataDir || getDefaultUserDataDir();
  return path.join(userDataDir, '.dndforged-data');
}

function getSavedConfigPath() {
  if (process.env.FORGEDVTT_CONFIG_FILE && fs.existsSync(process.env.FORGEDVTT_CONFIG_FILE)) {
    return process.env.FORGEDVTT_CONFIG_FILE;
  }
  const candidates = [];
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'forgedvtt', 'forge-config.json'));
  }
  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'forgedvtt', 'forge-config.json'));
  } else {
    candidates.push(path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'forgedvtt', 'forge-config.json'));
  }
  return candidates.find((p) => fs.existsSync(p)) || '';
}

function getSavedAppConfig() {
  const cfgPath = getSavedConfigPath();
  if (!cfgPath) return null;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) { }
  return null;
}

async function waitForServerHealth(port, serverProcess, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) return false;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/server/data-dir`, {
        signal: AbortSignal.timeout(800)
      });
      if (res.ok) return true;
    } catch (_) { }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  console.log('\n======================================================');
  console.log('   ⚔️   ForgeDVTT Online Game Launcher   ⚔️');
  console.log('   🛡️   Tabletop Freedom | Self-Hosted VTT');
  console.log('======================================================\n');

  const cloudflaredBin = findCloudflared();
  if (!cloudflaredBin) {
    console.error('❌ Cloudflare Tunnel (cloudflared) binary not found.');
    console.error('   Please install cloudflared or place cloudflared.exe in this directory.\n');
    process.exit(1);
  }

  const appConfig = getSavedAppConfig();
  const activeDataDir = resolveActiveDataDir(appConfig);
  console.log(`📁 Campaign Data Folder: ${activeDataDir}\n`);

  const tokenFile = path.join(activeDataDir, 'tunnel-token.txt');
  const legacyTokenFile = path.join(__dirname, '.dndforged-data', 'tunnel-token.txt');
  let savedToken = '';
  for (const candidateTokenFile of [tokenFile, legacyTokenFile]) {
    if (fs.existsSync(candidateTokenFile)) {
      const raw = fs.readFileSync(candidateTokenFile, 'utf8').trim();
      if (isValidTunnelToken(raw)) {
        savedToken = raw;
        break;
      }
    }
  }

  if (!savedToken && appConfig?.tunnelToken && isValidTunnelToken(appConfig.tunnelToken)) {
    savedToken = appConfig.tunnelToken.trim();
    try {
      if (!fs.existsSync(activeDataDir)) fs.mkdirSync(activeDataDir, { recursive: true });
      fs.writeFileSync(tokenFile, savedToken, 'utf8');
    } catch (e) { }
  }

  let token = savedToken;
  if (!token) {
    const inputToken = await prompt('👉 Paste Cloudflare Tunnel Token (Press ENTER for default config/quick tunnel): ');
    if (inputToken) {
      if (isValidTunnelToken(inputToken)) {
        token = inputToken;
        if (!fs.existsSync(activeDataDir)) fs.mkdirSync(activeDataDir, { recursive: true });
        fs.writeFileSync(tokenFile, token, 'utf8');
        console.log('✅ Tunnel Token saved for future launches.');
      } else {
        console.log('⚠️ Input does not match Cloudflare Token format (skipping token flag).');
      }
    }
  } else {
    console.log('🔑 Using saved Cloudflare Tunnel Token.');
  }

  const hasNamedToken = Boolean(token && isValidTunnelToken(token));
  let registeredUrl = '';
  if (hasNamedToken) {
    const defaultSubdomain = (appConfig?.subdomain || 'cosmic').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'cosmic';
    let subdomain = '';
    while (!subdomain) {
      const input = await prompt(`👉 Enter subdomain slug for this session [default: ${defaultSubdomain}]: `);
      if (!input) {
        subdomain = defaultSubdomain;
        break;
      }
      const cleaned = input.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (cleaned.length >= 2 && cleaned.length <= 32) {
        subdomain = cleaned;
      } else {
        console.log('⚠️  Subdomain must be between 2 and 32 alphanumeric characters.');
      }
    }

    const hostname = subdomain === '@' ? 'forgedvtt.com' : `${subdomain}.forgedvtt.com`;
    registeredUrl = `https://${hostname}`;
  }

  const requestedPort = getRequestedPort(appConfig);
  let activePort = requestedPort;
  const isOccupied = await isPortActive(requestedPort);
  let serverProcess = null;

  if (isOccupied) {
    let isForgeD = false;
    let runningDataDir = '';
    try {
      const res = await fetch(`http://127.0.0.1:${requestedPort}/api/server/data-dir`, {
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) {
        isForgeD = true;
        const info = await res.json().catch(() => null);
        if (info && typeof info.activeDataDir === 'string') {
          runningDataDir = info.activeDataDir;
        }
      }
    } catch (e) { }

    if (isForgeD) {
      console.log(`\nℹ️  ForgeDVTT server is already active on port ${requestedPort}. Reusing existing instance.`);
      if (runningDataDir && path.resolve(runningDataDir) !== activeDataDir) {
        console.warn(`⚠️  Warning: Running server is using "${runningDataDir}", which differs from requested "${activeDataDir}".`);
      }
    } else {
      if (token && isValidTunnelToken(token)) {
        console.error(`\n❌ [Server Error] Port ${requestedPort} is already in use by another application.`);
        console.error(`   When using a Named Cloudflare Tunnel Token, strict port binding is enforced to match your Cloudflare Zero Trust ingress rules.`);
        console.error(`   Please free port ${requestedPort} or specify your configured port via '--port <n>'.\n`);
        process.exit(1);
      }
      const autoAssign = appConfig?.autoAssignPort !== false || process.argv.includes('--auto-port');
      if (autoAssign) {
        activePort = await findAvailablePort(requestedPort + 1);
        console.log(`\n⚠️  Port ${requestedPort} is busy. Auto-assigning next free port: ${activePort}.`);
      } else {
        console.error(`\n❌ [Server Error] Port ${requestedPort} is already in use by another application.`);
        console.error(`   Specify a different port via '--port <n>' or free port ${requestedPort}.\n`);
        process.exit(1);
      }
    }
  }

  if (!isOccupied || activePort !== requestedPort) {
    console.log(`\n🚀 Starting local ForgeDVTT Node server on port ${activePort}...`);
    const childEnv = {
      ...process.env,
      PORT: String(activePort)
    };
    const cfgPath = getSavedConfigPath();
    if (cfgPath && !childEnv.FORGEDVTT_CONFIG_FILE) {
      childEnv.FORGEDVTT_CONFIG_FILE = cfgPath;
    }
    childEnv.FORGEDVTT_DATA_DIR = activeDataDir;
    if (process.env.FORGEDVTT_SERVER_SECRET) {
      childEnv.FORGEDVTT_SERVER_SECRET = process.env.FORGEDVTT_SERVER_SECRET;
    }
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: childEnv,
      stdio: 'inherit'
    });
    serverProcess.on('error', (err) => {
      console.error('\n❌ [Server Error] Failed to start server:', err.message);
    });
    const healthy = await waitForServerHealth(activePort, serverProcess, 10000);
    if (!healthy) {
      console.error('\n❌ [Server Error] Local server did not become ready in time.');
      process.exit(1);
    }
  }

  console.log('🌐 Launching Cloudflare Tunnel...');
  const tunnelArgs = ['--protocol', 'auto', '--no-prechecks'];
  const tunnelEnv = { ...process.env };

  if (hasNamedToken) {
    tunnelArgs.push('tunnel', 'run');
    tunnelEnv.TUNNEL_TOKEN = token;
  } else {
    tunnelArgs.push('tunnel', '--config', '', '--url', `http://127.0.0.1:${activePort}`);
  }

  const tunnelCwd = path.dirname(cloudflaredBin);
  const tunnelProcess = spawn(cloudflaredBin, tunnelArgs, {
    cwd: tunnelCwd,
    env: tunnelEnv,
    stdio: 'inherit'
  });

  tunnelProcess.on('error', (err) => {
    console.error('\n❌ [Tunnel Error] Failed to run cloudflared process:', err.message);
  });

  console.log('\n======================================================');
  console.log('   🎉  YOUR FORGEDVTT GAME IS ONLINE!');
  if (hasNamedToken) {
    console.log(`   🌐  Selected Game URL: ${registeredUrl}/play`);
    console.log(`   🌐  Portal / Launcher: https://forgedvtt.com/`);
    console.log('   🔒  Subdomain Isolation: ACTIVE');
  } else {
    console.log('   🌐  Quick Tunnel Mode: EPHEMERAL');
    console.log('   👉  Look below for your generated https://*.trycloudflare.com link');
  }
  console.log(`   💻  Local Access:      http://localhost:${activePort}/play`);
  console.log('======================================================');
  if (hasNamedToken) {
    console.log('\n💡 Tip: Any subdomain (e.g. mygame.forgedvtt.com) automatically loads');
    console.log('   its own isolated campaign data from your local server.');
  }
  console.log('\n(Press Ctrl+C at any time to shut down the server and tunnel)\n');

  async function shutdown() {
    console.log('\n\nShutting down ForgeD VTT online tunnel...');
    try {
      if (serverProcess && !serverProcess.killed) {
        await fetch(`http://127.0.0.1:${activePort}/api/server/shutdown`, {
          method: 'POST',
          signal: AbortSignal.timeout(1500)
        }).catch(() => {});
        if (!serverProcess.killed) serverProcess.kill();
      }
      if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill();
    } catch (e) { }
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
