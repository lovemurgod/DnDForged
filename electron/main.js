import { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const DEFAULT_PORT = 5050;

// Setup app data directory & auto-migrate from local workspace folder if present
const userDataDir = path.join(app.getPath('userData'), '.dndforged-data');
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

const legacyDataDir = path.join(rootDir, '.dndforged-data');
const targetCampFile = path.join(userDataDir, 'campaigns.json');
const legacyCampFile = path.join(legacyDataDir, 'campaigns.json');

if (fs.existsSync(legacyCampFile) && (!fs.existsSync(targetCampFile) || fs.statSync(targetCampFile).size < 1000)) {
  try {
    fs.cpSync(legacyDataDir, userDataDir, { recursive: true });
    console.log('[Migration] Migrated campaign data from workspace to AppData.');
  } catch (e) {
    console.error('Migration notice:', e.message);
  }
}

process.env.FORGEDVTT_DATA_DIR = userDataDir;

// Locate bundled cloudflared binary
function getCloudflaredPath() {
  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const resourceBin = path.join(process.resourcesPath, 'bin', binName);
  if (fs.existsSync(resourceBin)) return resourceBin;

  const localBin = path.join(rootDir, 'resources', 'bin', binName);
  if (fs.existsSync(localBin)) return localBin;

  const rootBin = path.join(rootDir, binName);
  if (fs.existsSync(rootBin)) return rootBin;

  return null;
}

const cloudflaredBinPath = getCloudflaredPath();
if (cloudflaredBinPath) {
  process.env.CLOUDFLARED_BIN = cloudflaredBinPath;
}

// Global State
let mainWindow = null;
let tray = null;
let serverProcess = null;
let tunnelProcess = null;

let isServerRunning = false;
let isTunnelRunning = false;
let currentSubdomain = 'julz';
let currentTunnelToken = '';
let registeredUrl = 'http://localhost:5050';
let consoleLogs = [];

function appendLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${msg}`;
  consoleLogs.push(logEntry);
  if (consoleLogs.length > 200) consoleLogs.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-update', logEntry);
  }
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

async function startServer() {
  if (isServerRunning) return true;

  const active = await isPortActive(DEFAULT_PORT);
  if (active) {
    appendLog(`Server already active on port ${DEFAULT_PORT}. Attaching...`);
    isServerRunning = true;
    notifyStatusChange();
    return true;
  }

  appendLog('Starting ForgeDVTT local Node server process...');
  const serverScript = path.join(rootDir, 'server.js');

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: rootDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    const str = data.toString().trim();
    if (str) appendLog(`[Server] ${str}`);
  });

  serverProcess.stderr.on('data', (data) => {
    const str = data.toString().trim();
    if (str) appendLog(`[Server Err] ${str}`);
  });

  serverProcess.on('exit', (code) => {
    appendLog(`Server process stopped (exit code: ${code})`);
    isServerRunning = false;
    serverProcess = null;
    notifyStatusChange();
  });

  // Give server time to bind
  await new Promise((r) => setTimeout(r, 1200));
  isServerRunning = true;
  notifyStatusChange();
  return true;
}

function stopServer() {
  if (serverProcess) {
    appendLog('Stopping local server process...');
    serverProcess.kill();
    serverProcess = null;
  }
  isServerRunning = false;
  notifyStatusChange();
}

async function startTunnel(subdomainInput, tokenInput) {
  if (isTunnelRunning) stopTunnel();

  currentSubdomain = (subdomainInput || 'julz').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!currentSubdomain) currentSubdomain = 'julz';
  currentTunnelToken = tokenInput ? tokenInput.trim() : '';

  const cloudflared = getCloudflaredPath();
  if (!cloudflared) {
    appendLog('ERROR: cloudflared binary not found in app resources.');
    return { success: false, error: 'cloudflared binary not found' };
  }

  // Ensure server is running
  if (!isServerRunning) {
    await startServer();
  }

  appendLog(`Launching Cloudflare Tunnel for subdomain: ${currentSubdomain}.forgedvtt.com`);

  const tunnelArgs = [];
  if (currentTunnelToken) {
    tunnelArgs.push('tunnel', 'run', '--token', currentTunnelToken);
  } else {
    const localConfig = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cloudflared', 'config.yml');
    if (fs.existsSync(localConfig)) {
      tunnelArgs.push('--config', localConfig, 'tunnel', 'run');
    } else {
      tunnelArgs.push('tunnel', '--url', `http://127.0.0.1:${DEFAULT_PORT}`);
    }
  }

  tunnelProcess = spawn(cloudflared, tunnelArgs, {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  registeredUrl = `https://${currentSubdomain}.forgedvtt.com`;

  tunnelProcess.stdout.on('data', (data) => {
    const str = data.toString().trim();
    if (str) appendLog(`[Tunnel] ${str}`);
  });

  tunnelProcess.stderr.on('data', (data) => {
    const str = data.toString().trim();
    if (str) {
      appendLog(`[Tunnel] ${str}`);
      // Parse tunnel URL if in quick mode
      const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        registeredUrl = match[0];
        notifyStatusChange();
      }
    }
  });

  tunnelProcess.on('exit', (code) => {
    appendLog(`Cloudflare Tunnel stopped (exit code: ${code})`);
    isTunnelRunning = false;
    tunnelProcess = null;
    notifyStatusChange();
  });

  isTunnelRunning = true;
  notifyStatusChange();
  return { success: true, url: registeredUrl };
}

function stopTunnel() {
  if (tunnelProcess) {
    appendLog('Stopping Cloudflare Tunnel...');
    tunnelProcess.kill();
    tunnelProcess = null;
  }
  isTunnelRunning = false;
  registeredUrl = `http://localhost:${DEFAULT_PORT}`;
  notifyStatusChange();
}

function notifyStatusChange() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-update', getStatusPayload());
  }
  updateTrayMenu();
}

function getStatusPayload() {
  return {
    isServerRunning,
    isTunnelRunning,
    port: DEFAULT_PORT,
    subdomain: currentSubdomain,
    registeredUrl,
    localUrl: `http://localhost:${DEFAULT_PORT}`,
    dataDir: userDataDir,
    cloudflaredAvailable: !!getCloudflaredPath()
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'ForgeDVTT Control Center',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const iconCandidates = [
      path.join(rootDir, '5etools-src', 'icon', 'icon-192.png'),
      path.join(rootDir, '5etools-src', 'img', 'logo.png')
    ];
    const iconPath = iconCandidates.find(p => fs.existsSync(p));
    if (iconPath) {
      tray = new Tray(iconPath);
      tray.setToolTip('ForgeDVTT Tabletop Freedom');
      updateTrayMenu();

      tray.on('double-click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
  } catch (err) {
    appendLog(`[Tray Note] ${err.message}`);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: 'ForgeDVTT Control Center', enabled: false },
    { type: 'separator' },
    {
      label: mainWindow && mainWindow.isVisible() ? 'Hide Dashboard' : 'Show Dashboard',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Open VTT in App Window',
      click: () => {
        openVTTWindow();
      }
    },
    {
      label: 'Open VTT in Default Browser',
      click: () => {
        shell.openExternal(`http://localhost:${DEFAULT_PORT}/vtt.html`);
      }
    },
    { type: 'separator' },
    {
      label: isServerRunning ? 'Stop Local Server' : 'Start Local Server',
      click: () => {
        if (isServerRunning) stopServer();
        else startServer();
      }
    },
    {
      label: isTunnelRunning ? 'Stop Online Tunnel' : 'Start Online Tunnel',
      click: () => {
        if (isTunnelRunning) stopTunnel();
        else startTunnel(currentSubdomain, currentTunnelToken);
      }
    },
    { type: 'separator' },
    {
      label: 'Open Campaign Data Folder',
      click: () => {
        shell.openPath(userDataDir);
      }
    },
    { type: 'separator' },
    {
      label: 'Exit ForgeDVTT',
      click: () => {
        app.isQuitting = true;
        stopTunnel();
        stopServer();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function openVTTWindow() {
  const vttWin = new BrowserWindow({
    width: 1366,
    height: 868,
    title: 'ForgeDVTT Virtual Tabletop',
    backgroundColor: '#121212',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  vttWin.setMenuBarVisibility(false);
  vttWin.loadURL(`http://localhost:${DEFAULT_PORT}/vtt.html`);
}

// Register IPC Handlers
ipcMain.handle('get-status', () => getStatusPayload());
ipcMain.handle('get-logs', () => consoleLogs);
ipcMain.handle('start-server', async () => await startServer());
ipcMain.handle('stop-server', () => stopServer());
ipcMain.handle('start-tunnel', async (_, params = {}) => {
  const subdomain = typeof params === 'string' ? params : params?.subdomain;
  const token = typeof params === 'object' ? params?.token : '';
  return await startTunnel(subdomain, token);
});
ipcMain.handle('stop-tunnel', () => stopTunnel());
ipcMain.handle('open-vtt-app', () => openVTTWindow());
ipcMain.handle('open-vtt-browser', (_, url) => shell.openExternal(url || `http://localhost:${DEFAULT_PORT}/vtt.html`));
ipcMain.handle('open-data-folder', () => shell.openPath(userDataDir));

ipcMain.handle('backup-campaign', async () => {
  if (!mainWindow) return { success: false };
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Backup Campaign Data',
    defaultPath: path.join(app.getPath('documents'), `ForgeDVTT-Backup-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (!filePath) return { success: false, canceled: true };

  try {
    const campaignsFile = path.join(userDataDir, 'campaigns.json');
    if (fs.existsSync(campaignsFile)) {
      fs.copyFileSync(campaignsFile, filePath);
      return { success: true, path: filePath };
    } else {
      return { success: false, error: 'No campaign file found to backup.' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App Lifecycle
app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Auto-start server on app boot
  await startServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopTunnel();
  stopServer();
});

app.on('window-all-closed', (e) => {
  // Prevent quitting when window is closed, keep running in system tray
  if (process.platform !== 'darwin') {
    e.preventDefault();
  }
});
