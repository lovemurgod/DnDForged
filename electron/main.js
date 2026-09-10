import { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const DEFAULT_PORT = 5050;

// Configuration persistence
const configFilePath = path.join(app.getPath('userData'), 'forge-config.json');

let appConfig = {
  campaignDataDir: path.join(app.getPath('userData'), '.dndforged-data'),
  backupsDir: path.join(app.getPath('documents'), 'ForgeDVTT-Backups'),
  hostingMode: 'forgedvtt', // 'forgedvtt' | 'custom'
  subdomain: 'mygame',
  customDomain: '',
  tunnelToken: '',
  gmCredentials: {
    username: '',
    salt: '',
    hash: ''
  }
};

function loadConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      appConfig = { ...appConfig, ...parsed };
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(appConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

loadConfig();

// Ensure folders exist
if (!fs.existsSync(appConfig.campaignDataDir)) {
  fs.mkdirSync(appConfig.campaignDataDir, { recursive: true });
}
if (!fs.existsSync(appConfig.backupsDir)) {
  fs.mkdirSync(appConfig.backupsDir, { recursive: true });
}

// Auto-migrate legacy data from root .dndforged-data if present
const legacyDataDir = path.join(rootDir, '.dndforged-data');
const targetCampFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
const legacyCampFile = path.join(legacyDataDir, 'campaigns.json');

if (fs.existsSync(legacyCampFile) && (!fs.existsSync(targetCampFile) || fs.statSync(targetCampFile).size < 500)) {
  try {
    fs.cpSync(legacyDataDir, appConfig.campaignDataDir, { recursive: true });
    console.log('[Migration] Migrated campaign data from workspace to active data dir.');
  } catch (e) {
    console.error('Migration notice:', e.message);
  }
}

process.env.FORGEDVTT_DATA_DIR = appConfig.campaignDataDir;
process.env.FORGEDVTT_CONFIG_FILE = configFilePath;

// Helpers for GM password hashing
function hashPassword(password, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha256').toString('hex');
  return { hash, salt: generatedSalt };
}

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
let currentSubdomain = appConfig.subdomain || 'mygame';
let currentTunnelToken = appConfig.tunnelToken || '';
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

async function syncConfigToServer() {
  if (!appConfig.gmCredentials) return;
  try {
    await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/server/sync-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmCredentials: appConfig.gmCredentials })
    });
  } catch (e) {}
}

async function startServer() {
  if (isServerRunning) {
    await syncConfigToServer();
    return true;
  }

  const active = await isPortActive(DEFAULT_PORT);
  if (active) {
    appendLog(`Server already active on port ${DEFAULT_PORT}. Attaching...`);
    isServerRunning = true;
    await syncConfigToServer();
    notifyStatusChange();
    return true;
  }

  appendLog('Starting ForgeDVTT local Node server process...');
  const serverScript = path.join(rootDir, 'server.js');

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: rootDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      FORGEDVTT_DATA_DIR: appConfig.campaignDataDir,
      FORGEDVTT_CONFIG_FILE: configFilePath
    },
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
  await syncConfigToServer();
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

async function startTunnel(params = {}) {
  if (isTunnelRunning) stopTunnel();

  const mode = params.mode || appConfig.hostingMode || 'forgedvtt';
  const subdomain = (params.subdomain || appConfig.subdomain || 'mygame').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mygame';
  const customDomain = (params.customDomain !== undefined ? params.customDomain : appConfig.customDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const token = (params.token !== undefined ? params.token : appConfig.tunnelToken || '').trim();

  appConfig.hostingMode = mode;
  appConfig.subdomain = subdomain;
  appConfig.customDomain = customDomain;
  appConfig.tunnelToken = token;
  saveConfig();

  currentSubdomain = subdomain;
  currentTunnelToken = token;

  const cloudflared = getCloudflaredPath();
  if (!cloudflared) {
    appendLog('ERROR: cloudflared binary not found in app resources.');
    return { success: false, error: 'cloudflared binary not found' };
  }

  // Ensure server is running
  if (!isServerRunning) {
    await startServer();
  }

  if (mode === 'custom' && customDomain) {
    registeredUrl = `https://${customDomain}`;
    appendLog(`Launching Cloudflare Tunnel for Custom Domain: ${customDomain}`);
  } else {
    registeredUrl = `https://${currentSubdomain}.forgedvtt.com`;
    appendLog(`Launching Cloudflare Tunnel for subdomain: ${currentSubdomain}.forgedvtt.com`);
  }

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

  tunnelProcess.stdout.on('data', (data) => {
    const str = data.toString().trim();
    if (str) appendLog(`[Tunnel] ${str}`);
  });

  tunnelProcess.stderr.on('data', (data) => {
    const str = data.toString().trim();
    if (str) {
      appendLog(`[Tunnel] ${str}`);
      // Parse quick tunnel URL if in trycloudflare mode and no custom domain set
      if (mode !== 'custom' && !currentTunnelToken) {
        const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          registeredUrl = match[0];
          notifyStatusChange();
        }
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
    hostingMode: appConfig.hostingMode || 'forgedvtt',
    customDomain: appConfig.customDomain || '',
    tunnelToken: appConfig.tunnelToken || '',
    registeredUrl,
    localUrl: `http://localhost:${DEFAULT_PORT}`,
    dataDir: appConfig.campaignDataDir,
    backupsDir: appConfig.backupsDir,
    cloudflaredAvailable: !!getCloudflaredPath(),
    gmUsername: appConfig.gmCredentials?.username || '',
    hasGmPassword: !!appConfig.gmCredentials?.hash
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    title: 'ForgeDVTT Control Center',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0b0f19',
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
      path.join(__dirname, 'icon.png'),
      path.join(rootDir, 'electron', 'icon.png'),
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
        else startTunnel();
      }
    },
    { type: 'separator' },
    {
      label: 'Open Campaign Data Folder',
      click: () => {
        shell.openPath(appConfig.campaignDataDir);
      }
    },
    {
      label: 'Open Backups Folder',
      click: () => {
        shell.openPath(appConfig.backupsDir);
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
    width: 1400,
    height: 900,
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
  return await startTunnel(params);
});
ipcMain.handle('stop-tunnel', () => stopTunnel());
ipcMain.handle('open-vtt-app', () => openVTTWindow());
ipcMain.handle('open-vtt-browser', (_, url) => shell.openExternal(url || `http://localhost:${DEFAULT_PORT}/vtt.html`));
ipcMain.handle('open-data-folder', () => shell.openPath(appConfig.campaignDataDir));
ipcMain.handle('open-backups-folder', () => shell.openPath(appConfig.backupsDir));

// Change Campaign Data Folder with Prompt to Import Saved Data
ipcMain.handle('select-data-folder', async () => {
  if (!mainWindow) return { canceled: true };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Campaign Data Folder',
    defaultPath: appConfig.campaignDataDir,
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { canceled: true };
  }

  const newDir = filePaths[0];
  const oldDir = appConfig.campaignDataDir;
  if (path.normalize(newDir) === path.normalize(oldDir)) {
    return { success: true, path: newDir, unchanged: true };
  }

  // Check if old directory contains existing data
  let oldHasData = false;
  try {
    if (fs.existsSync(oldDir)) {
      const files = fs.readdirSync(oldDir);
      oldHasData = files.some(f => f === 'campaigns.json' || f === 'uploads' || f === 'chat-log.json');
    }
  } catch (e) {}

  let imported = false;
  if (oldHasData) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Copy Data to New Folder', 'Use Empty/New Folder', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Import Saved Campaign Data?',
      message: 'Would you like to import/copy your existing campaign data, maps, and tokens to the new folder?',
      detail: `Source: ${oldDir}\nDestination: ${newDir}`
    });

    if (response === 2) {
      return { canceled: true };
    }

    if (response === 0) {
      // Copy data recursively
      try {
        appendLog(`[Data Migration] Copying data from ${oldDir} to ${newDir}...`);
        fs.cpSync(oldDir, newDir, { recursive: true });
        imported = true;
        appendLog(`[Data Migration] Successfully imported data to ${newDir}`);
      } catch (err) {
        appendLog(`[Data Migration Error] ${err.message}`);
        await dialog.showErrorBox('Import Error', `Failed to copy data: ${err.message}`);
      }
    }
  }

  appConfig.campaignDataDir = newDir;
  saveConfig();
  process.env.FORGEDVTT_DATA_DIR = newDir;

  // Seamlessly notify server process if running
  try {
    await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/server/data-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataDir: newDir })
    });
    appendLog(`[Server] Seamlessly updated database directory to: ${newDir}`);
  } catch (e) {
    // Server not yet active or network notice
  }

  notifyStatusChange();
  return { success: true, path: newDir, imported };
});

// Change Backups Folder
ipcMain.handle('select-backups-folder', async () => {
  if (!mainWindow) return { canceled: true };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Backups Folder',
    defaultPath: appConfig.backupsDir,
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { canceled: true };
  }

  const newDir = filePaths[0];
  appConfig.backupsDir = newDir;
  saveConfig();
  notifyStatusChange();
  return { success: true, path: newDir };
});

// Backup Campaign to Backups Folder
ipcMain.handle('backup-campaign', async () => {
  if (!mainWindow) return { success: false };

  if (!fs.existsSync(appConfig.backupsDir)) {
    fs.mkdirSync(appConfig.backupsDir, { recursive: true });
  }

  const defaultFileName = `ForgeDVTT-Backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const defaultFilePath = path.join(appConfig.backupsDir, defaultFileName);

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Backup Campaign Data',
    defaultPath: defaultFilePath,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    const campaignsFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
    if (fs.existsSync(campaignsFile)) {
      fs.copyFileSync(campaignsFile, filePath);
      appendLog(`[Backup] Campaign data successfully exported to: ${filePath}`);
      return { success: true, path: filePath };
    } else {
      return { success: false, error: 'No campaign file found in active data folder to backup.' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// GM Credentials IPC
ipcMain.handle('get-gm-credentials', () => {
  return {
    username: appConfig.gmCredentials?.username || '',
    hasPassword: !!appConfig.gmCredentials?.hash
  };
});

ipcMain.handle('set-gm-credentials', async (_, { username, password }) => {
  const cleanUsername = (username || '').trim();
  if (!cleanUsername) {
    return { success: false, error: 'Username cannot be empty.' };
  }

  let hash = appConfig.gmCredentials?.hash || '';
  let salt = appConfig.gmCredentials?.salt || '';
  if (password && password.trim() !== '') {
    const res = hashPassword(password);
    hash = res.hash;
    salt = res.salt;
  }

  appConfig.gmCredentials = {
    username: cleanUsername,
    salt,
    hash
  };
  saveConfig();

  // Notify running server
  try {
    await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/server/sync-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmCredentials: appConfig.gmCredentials })
    });
    appendLog(`[GM Security] Updated master GM credentials for username "${cleanUsername}".`);
  } catch (e) {}

  notifyStatusChange();
  return { success: true, username: cleanUsername, hasPassword: !!hash };
});

// Campaign Management IPC (for GM Dashboard)
ipcMain.handle('gm-get-campaigns', async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/campaigns`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, campaigns: data.campaigns || [] };
    }
  } catch (e) {}

  // Fallback to local file
  try {
    const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
    if (fs.existsSync(campFile)) {
      const data = JSON.parse(fs.readFileSync(campFile, 'utf8'));
      const list = Object.values(data).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        allowedUsers: c.allowedUsers || [],
        knownPlayers: c.knownPlayers || [],
        mapsCount: Object.keys(c.maps || {}).length,
        playersCount: (c.knownPlayers || []).length
      }));
      return { success: true, campaigns: list };
    }
  } catch (e) {}
  return { success: true, campaigns: [] };
});

ipcMain.handle('gm-save-campaign', async (_, campaignData) => {
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/campaigns/${campaignData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignData)
    });
    if (res.ok) {
      const updated = await res.json();
      return { success: true, campaign: updated };
    }
    const err = await res.json();
    return { success: false, error: err.error || 'Failed to save campaign' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gm-create-campaign', async (_, newCampData) => {
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCampData)
    });
    if (res.ok) {
      const created = await res.json();
      return { success: true, campaign: created };
    }
    const err = await res.json();
    return { success: false, error: err.error || 'Failed to create campaign' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gm-delete-campaign', async (_, campId) => {
  try {
    const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/campaigns/${campId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      return { success: true, deletedId: campId };
    }
    const err = await res.json();
    return { success: false, error: err.error || 'Failed to delete campaign' };
  } catch (e) {
    return { success: false, error: e.message };
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
