import { spawn, execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = 5050;

function findCloudflared() {
  // Check local directory first
  const localExe = path.join(__dirname, 'cloudflared.exe');
  if (fs.existsSync(localExe)) return localExe;

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
  } catch (e) {}

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

  const tokenFile = path.join(__dirname, '.dndforged-data', 'tunnel-token.txt');
  let savedToken = '';
  if (fs.existsSync(tokenFile)) {
    savedToken = fs.readFileSync(tokenFile, 'utf8').trim();
  }

  let token = savedToken;
  if (!token) {
    const inputToken = await prompt('👉 Paste Cloudflare Tunnel Token (Press ENTER for default config/quick tunnel): ');
    if (inputToken) {
      token = inputToken;
      const dataDir = path.join(__dirname, '.dndforged-data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tokenFile, token, 'utf8');
      console.log('✅ Tunnel Token saved for future launches.');
    }
  } else {
    console.log('🔑 Using saved Cloudflare Tunnel Token.');
  }

  let subdomain = '';
  while (!subdomain) {
    const input = await prompt('👉 Enter subdomain slug for this session (e.g. julz or cosmic): ');
    if (!input) {
      subdomain = '@';
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
  const registeredUrl = `https://${hostname}`;

  const alreadyRunning = await isPortActive(DEFAULT_PORT);
  let serverProcess = null;

  if (alreadyRunning) {
    console.log(`\nℹ️  ForgeDVTT server is already active on port ${DEFAULT_PORT}. Reusing existing instance.`);
  } else {
    console.log('\n🚀 Starting local ForgeDVTT Node server...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    // Wait for server to initialize
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('🌐 Launching Cloudflare Tunnel...');
  const tunnelArgs = [];

  const localConfig = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cloudflared', 'config.yml');
  if (token) {
    tunnelArgs.push('tunnel', 'run', '--token', token);
  } else if (fs.existsSync(localConfig)) {
    tunnelArgs.push('--config', localConfig, 'tunnel', 'run');
  } else {
    tunnelArgs.push('tunnel', '--url', `http://127.0.0.1:${DEFAULT_PORT}`);
  }

  const tunnelProcess = spawn(cloudflaredBin, tunnelArgs, {
    cwd: __dirname,
    stdio: 'inherit'
  });

  console.log('\n======================================================');
  console.log('   🎉  YOUR FORGEDVTT GAME IS ONLINE!');
  console.log(`   🌐  Selected Game URL: ${registeredUrl}/vtt.html`);
  console.log(`   🌐  Portal / Launcher: https://forgedvtt.com/`);
  console.log(`   💻  Local Access:      http://localhost:${DEFAULT_PORT}/`);
  console.log('   🔒  Subdomain Isolation: ACTIVE');
  console.log('======================================================');
  console.log('\n💡 Tip: Any subdomain (e.g. julz.forgedvtt.com) automatically loads');
  console.log('   its own isolated campaign data from your local server.');
  console.log('\n(Press Ctrl+C at any time to shut down the server and tunnel)\n');

  function shutdown() {
    console.log('\n\nShutting down DnDForged online tunnel...');
    try {
      if (serverProcess && !serverProcess.killed) serverProcess.kill();
      if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill();
    } catch (e) {}
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
