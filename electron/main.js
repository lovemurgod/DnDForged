import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog, session } = require('electron');
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn, execFileSync, execSync } from 'child_process';
import net from 'net';
import crypto from 'crypto';
import { SourceManager } from './source-manager.js';
import {
    isRoll20CharacterJson,
    convertRoll20Character,
    isRoll20TableJson,
    convertRoll20TableToVTT
} from './importers/roll20-importer.js';
import { createCampaignTemplate, hashPassword } from '../utils.js';
import { p2pBridge } from '../server/p2p-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Single-instance lock: prevent multiple competing ForgeDVTT instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// Global exception guards to prevent unhandled process crashes
process.on('uncaughtException', (err) => {
    console.error('[Main Process Uncaught Exception]', err);
    if (typeof appendLog === 'function') {
        appendLog(`[Uncaught Exception] ${err?.message || err}`);
    }
});
process.on('unhandledRejection', (reason) => {
    console.error('[Main Process Unhandled Rejection]', reason);
});

// Hardware GPU Acceleration & Canvas Optimization Switches
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const DEFAULT_PORT = 5050;
let activePort = DEFAULT_PORT;
function getServerPort() {
    return activePort || appConfig.serverPort || DEFAULT_PORT;
}

// Configuration persistence
const configFilePath = path.join(app.getPath('userData'), 'forge-config.json');

// Ephemeral internal secret shared with child server process
const SERVER_INTERNAL_SECRET = crypto.randomBytes(32).toString('hex');
function internalHeaders(extra = {}) {
    return {
        'x-server-secret': SERVER_INTERNAL_SECRET,
        ...extra
    };
}

let appConfig = {
    serverPort: 5050,
    autoAssignPort: true,
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
            if (parsed.serverPort) {
                const p = parseInt(parsed.serverPort, 10);
                if (!isNaN(p) && p >= 1024 && p <= 65535) {
                    appConfig.serverPort = p;
                } else {
                    appConfig.serverPort = DEFAULT_PORT;
                }
            }
            if (parsed.autoAssignPort !== undefined) {
                appConfig.autoAssignPort = Boolean(parsed.autoAssignPort);
            }
            activePort = appConfig.serverPort || DEFAULT_PORT;
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

// Initialize Source Manager
const sourceManager = new SourceManager({
    rootDir,
    campaignDataDir: appConfig.campaignDataDir
});

// Auto-migrate legacy data from root .dndforged-data if present (clean install only, never overwrite)
const legacyDataDir = path.join(rootDir, '.dndforged-data');
const targetCampFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
const legacyCampFile = path.join(legacyDataDir, 'campaigns.json');
const migrationDoneMarker = path.join(appConfig.campaignDataDir, '.migration_done');

if (fs.existsSync(legacyCampFile) && !fs.existsSync(targetCampFile) && !fs.existsSync(migrationDoneMarker)) {
    try {
        fs.cpSync(legacyDataDir, appConfig.campaignDataDir, { recursive: true });
        fs.writeFileSync(migrationDoneMarker, new Date().toISOString(), 'utf8');
        console.log('[Migration] Migrated campaign data from workspace to active data dir.');
    } catch (e) {
        console.error('Migration notice:', e.message);
    }
}

process.env.FORGEDVTT_DATA_DIR = appConfig.campaignDataDir;
process.env.FORGEDVTT_CONFIG_FILE = configFilePath;

// Configured data and config file paths

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

// Locate bundled cloudflared binary
function getCloudflaredPath() {
    if (process.env.CLOUDFLARED_BIN && fs.existsSync(process.env.CLOUDFLARED_BIN)) {
        return process.env.CLOUDFLARED_BIN;
    }

    const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
    const resourceBin = path.join(process.resourcesPath || '', 'bin', binName);
    if (fs.existsSync(resourceBin)) return resourceBin;

    const localBin = path.join(rootDir, 'resources', 'bin', binName);
    if (fs.existsSync(localBin)) return localBin;

    const rootBin = path.join(rootDir, binName);
    if (fs.existsSync(rootBin)) return rootBin;

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
        const output = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'] })
            .toString()
            .trim();
        if (output) return output.split('\r\n')[0].split('\n')[0];
    } catch (e) {}

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
let isServerStarting = false;
let isServerStopping = false;
let cancelStartupRequested = false;
let isServerManaged = false;
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

async function syncConfigToServer() {
    try {
        await fetch(`http://127.0.0.1:${getServerPort()}/api/server/sync-config`, {
            method: 'POST',
            headers: internalHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                gmCredentials: appConfig.gmCredentials,
                campaignDataDir: appConfig.campaignDataDir
            })
        });
    } catch (e) {}
    await syncSourcesToServer();
}

async function syncSourcesToServer() {
    try {
        await fetch(`http://127.0.0.1:${getServerPort()}/api/server/sync-sources`, {
            method: 'POST',
            headers: internalHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                disabledSources: sourceManager.config.disabledSources
            })
        });
    } catch (e) {}
}

async function isServerReady(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/server/data-dir`, {
            signal: AbortSignal.timeout(1000)
        });
        if (res.ok) return true;
    } catch (e) {}
    return false;
}

async function startServer() {
    if (isServerRunning) {
        await syncConfigToServer();
        return true;
    }
    if (isServerStarting) {
        return false;
    }

    const requestedPort = parseInt(appConfig.serverPort, 10) || DEFAULT_PORT;
    let targetPort = requestedPort;

    const active = await isPortActive(targetPort);
    if (active) {
        const ready = await isServerReady(targetPort);
        if (ready) {
            appendLog(`Server already active on port ${targetPort} (external process). Attaching...`);
            activePort = targetPort;
            registeredUrl = `http://localhost:${targetPort}`;
            isServerRunning = true;
            isServerManaged = false;
            await syncConfigToServer();
            notifyStatusChange();
            return true;
        }

        // Port is occupied but not responding as ForgeDVTT
        const hasToken = appConfig.tunnelToken && isValidTunnelToken(appConfig.tunnelToken);
        if (hasToken) {
            appendLog(
                `[Server Error] Port ${targetPort} is in use. When a Named Cloudflare Tunnel Token is configured, strict port binding is enforced to match Cloudflare Zero Trust ingress rules. Please free port ${targetPort} or update your server port.`
            );
            isServerRunning = false;
            notifyStatusChange();
            return false;
        }

        if (appConfig.autoAssignPort !== false) {
            const nextFree = await findAvailablePort(targetPort + 1);
            appendLog(`[Server Notice] Port ${targetPort} is occupied. Auto-assigning next free port: ${nextFree}.`);
            targetPort = nextFree;
        } else {
            appendLog(
                `[Server Error] Port ${targetPort} is already in use by another application. Free the port or enable Auto-assign in Server Settings.`
            );
            isServerRunning = false;
            notifyStatusChange();
            return false;
        }
    }

    activePort = targetPort;
    registeredUrl = `http://localhost:${targetPort}`;
    appendLog(`Starting ForgeDVTT local Node server process on port ${targetPort}...`);
    let serverScript = path.join(rootDir, 'server.js');
    let workingDir = rootDir;

    // In packaged ASAR builds, files in asarUnpack reside in app.asar.unpacked
    const unpackedScript = serverScript.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedScript)) {
        serverScript = unpackedScript;
        workingDir = path.dirname(unpackedScript);
    } else if (app.isPackaged || workingDir.includes('app.asar')) {
        workingDir = process.resourcesPath || path.dirname(process.execPath);
    }

    let processExitedEarly = false;
    let earlyExitCode = null;
    let spawnError = null;
    isServerStarting = true;
    cancelStartupRequested = false;
    notifyStatusChange();

    try {
        serverProcess = spawn(process.execPath, [serverScript], {
            cwd: workingDir,
            env: {
                ...process.env,
                PORT: String(targetPort),
                ELECTRON_RUN_AS_NODE: '1',
                FORGEDVTT_DATA_DIR: appConfig.campaignDataDir,
                FORGEDVTT_CONFIG_FILE: configFilePath,
                FORGEDVTT_SERVER_SECRET: SERVER_INTERNAL_SECRET
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (err) {
        appendLog(`[Server Err] Failed to spawn process: ${err.message}`);
        isServerRunning = false;
        isServerStarting = false;
        notifyStatusChange();
        return false;
    }

    serverProcess.stdout.on('data', (data) => {
        const str = data.toString().trim();
        if (str) appendLog(`[Server] ${str}`);
    });

    serverProcess.stderr.on('data', (data) => {
        const str = data.toString().trim();
        if (str) appendLog(`[Server Err] ${str}`);
    });

    const onEarlyExit = (code) => {
        processExitedEarly = true;
        earlyExitCode = code;
    };
    const onEarlyError = (err) => {
        spawnError = err;
        processExitedEarly = true;
    };

    serverProcess.once('exit', onEarlyExit);
    serverProcess.once('error', onEarlyError);

    const startTime = Date.now();
    let lastHeartbeatTime = Date.now();
    let serverConfirmed = false;

    // Poll until ready, early exit, or user-initiated cancellation (no rigid 10s cutoff)
    while (!processExitedEarly && !cancelStartupRequested) {
        const portActive = await isPortActive(targetPort);
        if (portActive) {
            const ready = await isServerReady(targetPort);
            if (ready) {
                serverConfirmed = true;
                break;
            }
        }

        // Periodic diagnostic heartbeat every 12 seconds
        if (Date.now() - lastHeartbeatTime >= 12000) {
            lastHeartbeatTime = Date.now();
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            appendLog(
                `[Server Notice] Local server is initializing campaigns, compendiums & assets... (${elapsed}s elapsed)`
            );
        }

        await new Promise((r) => setTimeout(r, 200));
    }

    serverProcess.removeListener('exit', onEarlyExit);
    serverProcess.removeListener('error', onEarlyError);

    if (cancelStartupRequested) {
        appendLog(`[Server Notice] Startup cancelled by user. Terminating process...`);
        if (serverProcess) {
            try {
                serverProcess.kill();
            } catch (e) {}
            serverProcess = null;
        }
        isServerRunning = false;
        isServerStarting = false;
        cancelStartupRequested = false;
        notifyStatusChange();
        return false;
    }

    if (!serverConfirmed || processExitedEarly) {
        let reason = spawnError ? spawnError.message : '';
        if (processExitedEarly) {
            if (earlyExitCode === 98) {
                reason = `Port ${targetPort} is already in use (EADDRINUSE).`;
            } else {
                reason = `Server process exited prematurely with code ${earlyExitCode}`;
            }
        } else if (!serverConfirmed) {
            reason = `Server did not become ready on port ${targetPort}`;
        }
        appendLog(`[Server Error] Startup failed: ${reason}`);
        if (serverProcess) {
            try {
                serverProcess.kill();
            } catch (e) {}
            serverProcess = null;
        }
        isServerRunning = false;
        isServerStarting = false;
        notifyStatusChange();
        return false;
    }

    // Once confirmed running and healthy, attach normal exit handler
    serverProcess.on('exit', (code) => {
        appendLog(`Server process stopped (exit code: ${code})`);
        isServerRunning = false;
        isServerManaged = false;
        serverProcess = null;
        notifyStatusChange();
    });

    isServerStarting = false;
    isServerRunning = true;
    isServerManaged = true;
    await syncConfigToServer();
    notifyStatusChange();
    return true;
}

async function stopServer() {
    if (serverProcess) {
        appendLog('Stopping local server process gracefully...');
        const proc = serverProcess;
        isServerStopping = true;
        notifyStatusChange();

        // 1. Send graceful shutdown request to flush state (clean await up to 30s for large campaigns)
        try {
            await fetch(`http://127.0.0.1:${getServerPort()}/api/server/shutdown`, {
                method: 'POST',
                headers: internalHeaders({ 'Content-Type': 'application/json' }),
                signal: AbortSignal.timeout(30000)
            });
        } catch {
            // Server may already be closing or offline
        }

        // 2. Await clean exit before forceful fallback, logging progress periodically
        if (proc && !proc.killed) {
            await new Promise((resolve) => {
                let isDone = false;
                const startTime = Date.now();
                const cleanup = () => {
                    if (!isDone) {
                        isDone = true;
                        clearInterval(heartbeatInterval);
                        clearTimeout(safetyTimeout);
                        resolve();
                    }
                };
                proc.once('exit', cleanup);
                proc.once('close', cleanup);

                // Periodic status heartbeat every 10s
                const heartbeatInterval = setInterval(() => {
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    appendLog(`[Server Notice] Awaiting safe campaign state flush to disk... (${elapsed}s elapsed)`);
                }, 10000);

                // Safe fallback timer (45 seconds) to prevent infinite hangs
                const safetyTimeout = setTimeout(() => {
                    if (!isDone) {
                        isDone = true;
                        clearInterval(heartbeatInterval);
                        appendLog('[Server Notice] Shutdown wait threshold reached (45s). Terminating process.');
                        try {
                            proc.kill();
                        } catch {}
                        resolve();
                    }
                }, 45000);
            });
        }
        serverProcess = null;
        isServerRunning = false;
        isServerStopping = false;
        isServerManaged = false;
        notifyStatusChange();
        return { success: true };
    } else if (isServerRunning && !isServerManaged) {
        appendLog('[Server] Server is running as an external process and cannot be terminated by Electron.');
        notifyStatusChange();
        return { success: false, external: true, error: 'External server process cannot be stopped from Electron.' };
    }
    isServerRunning = false;
    isServerStopping = false;
    isServerManaged = false;
    notifyStatusChange();
    return { success: true };
}

async function startTunnel(params = {}) {
    if (isTunnelRunning) stopTunnel();

    const mode = params.mode || appConfig.hostingMode || 'forgedvtt';
    const subdomain =
        (params.subdomain || appConfig.subdomain || 'mygame').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mygame';
    const customDomain = (params.customDomain !== undefined ? params.customDomain : appConfig.customDomain || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
    const token = (params.token !== undefined ? params.token : appConfig.tunnelToken || '').trim();

    if (!appConfig.gmCredentials?.username || !appConfig.gmCredentials?.hash) {
        const msg = 'Set a GM Username and Password in Hosting & Server before starting an online tunnel.';
        appendLog(`[GM Security] Blocked tunnel start: ${msg}`);
        return { success: false, error: msg };
    }

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

    // Ensure server is running and verified healthy
    const serverHealthy = await isServerReady(getServerPort());
    if (!serverHealthy) {
        appendLog('[Tunnel] Local server not responding or not started. Attempting to start server...');
        const started = await startServer();
        if (!started || !(await isServerReady(getServerPort()))) {
            appendLog('[Tunnel Error] Aborting tunnel start because local server failed to start or is not healthy.');
            return { success: false, error: 'Local server failed to start or is not healthy' };
        }
    } else {
        isServerRunning = true;
    }

    const hasValidToken = Boolean(currentTunnelToken && isValidTunnelToken(currentTunnelToken));
    const userCloudflaredConfig = path.join(os.homedir(), '.cloudflared', 'config.yml');
    const hasUserCloudflaredConfig = fs.existsSync(userCloudflaredConfig);

    if (mode === 'custom' && customDomain && !hasValidToken && !hasUserCloudflaredConfig) {
        const msg = 'Custom Domain mode requires either a Cloudflare Tunnel Token or ~/.cloudflared/config.yml.';
        appendLog(`[Tunnel Error] ${msg}`);
        return { success: false, error: msg };
    }

    const isQuickTunnel = !(mode === 'custom' && customDomain) && !hasValidToken;
    const tunnelArgs = ['--protocol', 'http2', '--no-prechecks'];
    const tunnelEnv = { ...process.env };

    if (mode === 'custom' && customDomain) {
        registeredUrl = `https://${customDomain}`;
        appendLog(`Launching Cloudflare Tunnel for Custom Domain: ${customDomain}`);
        if (hasValidToken) {
            tunnelArgs.push('tunnel', 'run');
            tunnelEnv.TUNNEL_TOKEN = currentTunnelToken;
        } else {
            tunnelArgs.push('tunnel', '--config', userCloudflaredConfig, 'run');
        }
    } else if (hasValidToken) {
        registeredUrl = `https://${currentSubdomain}.forgedvtt.com`;
        appendLog(`Launching Cloudflare Tunnel for subdomain: ${currentSubdomain}.forgedvtt.com`);
        tunnelArgs.push('tunnel', 'run');
        tunnelEnv.TUNNEL_TOKEN = currentTunnelToken;
    } else {
        registeredUrl = ''; // Pending quick tunnel allocation from Cloudflare Edge
        appendLog('Launching zero-config Cloudflare Quick Tunnel...');
        tunnelArgs.push('tunnel', '--config', '', '--url', `http://127.0.0.1:${getServerPort()}`);
    }

    // Always use a guaranteed user-writable directory for child process execution
    const tunnelCwd = app.getPath('userData') || rootDir;

    try {
        tunnelProcess = spawn(cloudflared, tunnelArgs, {
            cwd: tunnelCwd,
            env: tunnelEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
    } catch (err) {
        appendLog(`[Tunnel Err] Failed to spawn cloudflared: ${err.message}`);
        isTunnelRunning = false;
        registeredUrl = `http://localhost:${getServerPort()}`;
        notifyStatusChange();
        return { success: false, error: err.message };
    }

    tunnelProcess.on('error', (err) => {
        appendLog(`[Tunnel Err] Cloudflare process error: ${err.message}`);
        isTunnelRunning = false;
        tunnelProcess = null;
        registeredUrl = `http://localhost:${getServerPort()}`;
        notifyStatusChange();
    });

    let quickTunnelBuffer = '';
    const handleTunnelStream = (data) => {
        const str = data.toString();
        const trimmed = str.trim();
        if (trimmed) appendLog(`[Tunnel] ${trimmed}`);

        if (isQuickTunnel && !registeredUrl) {
            quickTunnelBuffer += str;
            const match = quickTunnelBuffer.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match) {
                registeredUrl = match[0];
                appendLog(`[Tunnel] Cloudflare Quick Tunnel URL active: ${registeredUrl}`);
                notifyStatusChange();
            }
        }
    };

    tunnelProcess.stdout.on('data', handleTunnelStream);
    tunnelProcess.stderr.on('data', handleTunnelStream);

    tunnelProcess.on('exit', (code) => {
        appendLog(`Cloudflare Tunnel stopped (exit code: ${code})`);
        isTunnelRunning = false;
        tunnelProcess = null;
        registeredUrl = `http://localhost:${getServerPort()}`;
        notifyStatusChange();
    });

    isTunnelRunning = true;
    notifyStatusChange();

    // In quick tunnel mode, await assigned URL for up to 15 seconds so UI and caller receive resolved link
    if (isQuickTunnel) {
        const timeoutMs = 15000;
        const startWait = Date.now();
        while (!registeredUrl && isTunnelRunning && Date.now() - startWait < timeoutMs) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    return { success: true, url: registeredUrl || `http://localhost:${getServerPort()}` };
}

function stopTunnel() {
    if (tunnelProcess) {
        appendLog('Stopping Cloudflare Tunnel...');
        tunnelProcess.kill();
        tunnelProcess = null;
    }
    isTunnelRunning = false;
    registeredUrl = `http://localhost:${getServerPort()}`;
    notifyStatusChange();
}

function notifyStatusChange() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-update', getStatusPayload());
    }
    updateTrayMenu();
}

function getStatusPayload() {
    const port = getServerPort();
    return {
        isServerRunning,
        isServerStarting,
        isServerStopping,
        isServerManaged,
        isTunnelRunning,
        port,
        configuredPort: appConfig.serverPort || DEFAULT_PORT,
        autoAssignPort: appConfig.autoAssignPort !== false,
        subdomain: currentSubdomain,
        hostingMode: appConfig.hostingMode || 'forgedvtt',
        customDomain: appConfig.customDomain || '',
        tunnelToken: appConfig.tunnelToken || '',
        registeredUrl,
        localUrl: `http://localhost:${port}`,
        dataDir: appConfig.campaignDataDir,
        backupsDir: appConfig.backupsDir,
        cloudflaredAvailable: !!getCloudflaredPath(),
        gmUsername: appConfig.gmCredentials?.username || '',
        hasGmPassword: !!appConfig.gmCredentials?.hash,
        p2p: p2pBridge.getStatus()
    };
}

function attachWindowSecurityGuards(win, { allowLocalPopouts = false } = {}) {
    if (!win || !win.webContents) return;
    const isPermittedAppUrl = (rawUrl) => {
        if (!rawUrl || rawUrl === 'about:blank') return true;
        if (rawUrl.startsWith('file://')) return true;
        try {
            const parsed = new URL(rawUrl);
            const h = parsed.hostname.toLowerCase();
            const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
            return (
                (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
                (h === 'localhost' || h === '127.0.0.1') &&
                Number(parsed.port || defaultPort) === getServerPort()
            );
        } catch {
            return false;
        }
    };

    win.webContents.on('will-navigate', (event, navigationUrl) => {
        if (!isPermittedAppUrl(navigationUrl)) {
            event.preventDefault();
            if (/^https?:\/\//i.test(navigationUrl)) {
                shell.openExternal(navigationUrl).catch(() => {});
            }
        }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (allowLocalPopouts && isPermittedAppUrl(url)) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    webPreferences: {
                        preload: path.join(__dirname, 'vtt-preload.cjs'),
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                }
            };
        }
        if (/^https?:\/\//i.test(url)) {
            shell.openExternal(url).catch(() => {});
        }
        return { action: 'deny' };
    });
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
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    attachWindowSecurityGuards(mainWindow);
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
            path.join(rootDir, 'img', 'logo.png'),
            path.join(rootDir, 'vtt', 'img', 'logo.png'),
            path.join(rootDir, '5etools-src', 'img', 'logo.png')
        ];
        const iconPath = iconCandidates.find((p) => fs.existsSync(p));
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
            click: async () => {
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
            click: async () => {
                openVTTWindow();
            }
        },
        {
            label: 'Open VTT in Default Browser',
            click: async () => {
                shell.openExternal(`http://localhost:${getServerPort()}/vtt/index.html`);
            }
        },
        { type: 'separator' },
        {
            label: isServerRunning ? 'Stop Local Server' : 'Start Local Server',
            click: async () => {
                if (isServerRunning) stopServer();
                else startServer();
            }
        },
        {
            label: isTunnelRunning ? 'Stop Online Tunnel' : 'Start Online Tunnel',
            click: async () => {
                if (isTunnelRunning) stopTunnel();
                else startTunnel();
            }
        },
        { type: 'separator' },
        {
            label: 'Open Campaign Data Folder',
            click: async () => {
                shell.openPath(appConfig.campaignDataDir);
            }
        },
        {
            label: 'Open Backups Folder',
            click: async () => {
                shell.openPath(appConfig.backupsDir);
            }
        },
        { type: 'separator' },
        {
            label: 'Exit ForgeDVTT',
            click: () => {
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}

let presentationWindow = null;

function openPresentationWindow(campaignId = 'default') {
    if (presentationWindow && !presentationWindow.isDestroyed()) {
        presentationWindow.show();
        presentationWindow.focus();
        return;
    }

    presentationWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        title: 'ForgeDVTT — Presentation Display',
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#0a0e17',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'vtt-preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    attachWindowSecurityGuards(presentationWindow);
    presentationWindow.setMenuBarVisibility(false);
    presentationWindow.loadURL(
        `http://localhost:${getServerPort()}/vtt/index.html?mode=presentation&campaign=${encodeURIComponent(campaignId)}`
    );

    presentationWindow.on('closed', () => {
        presentationWindow = null;
        try {
            BrowserWindow.getAllWindows().forEach((win) => {
                if (!win.isDestroyed()) {
                    win.webContents.send('presentation-status-update', { isOpen: false });
                }
            });
        } catch (_) {}
    });
}

function closePresentationWindow() {
    if (presentationWindow && !presentationWindow.isDestroyed()) {
        presentationWindow.close();
        presentationWindow = null;
    }
}

function openVTTWindow(targetUrl) {
    if (session.defaultSession) {
        session.defaultSession.clearCache().catch(() => {});
    }
    const vttWin = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'ForgeDVTT Virtual Tabletop',
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'vtt-preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    attachWindowSecurityGuards(vttWin, { allowLocalPopouts: true });
    vttWin.setMenuBarVisibility(false);
    vttWin.loadURL(targetUrl || `http://localhost:${getServerPort()}/vtt/index.html`);
}

// Register IPC Handlers
ipcMain.handle('get-status', () => getStatusPayload());
ipcMain.handle('get-logs', () => consoleLogs);
ipcMain.handle('config-update-port', async (_, { port, autoAssign }) => {
    let changed = false;
    if (port !== undefined) {
        const parsed = parseInt(port, 10);
        if (Number.isInteger(parsed) && parsed >= 1024 && parsed <= 65535) {
            appConfig.serverPort = parsed;
            if (!isServerRunning) {
                activePort = parsed;
                registeredUrl = `http://localhost:${parsed}`;
            }
            changed = true;
        } else {
            return { success: false, error: 'Port must be an integer between 1024 and 65535' };
        }
    }
    if (autoAssign !== undefined) {
        appConfig.autoAssignPort = Boolean(autoAssign);
        changed = true;
    }
    if (changed) {
        saveConfig();
        notifyStatusChange();
    }
    return {
        success: true,
        port: getServerPort(),
        configuredPort: appConfig.serverPort || DEFAULT_PORT,
        autoAssign: appConfig.autoAssignPort !== false
    };
});
ipcMain.handle('start-server', async () => await startServer());
ipcMain.handle('cancel-start-server', async () => {
    if (isServerStarting) {
        cancelStartupRequested = true;
        if (serverProcess) {
            try {
                serverProcess.kill();
            } catch (e) {}
        }
        return { success: true };
    }
    return { success: false };
});
ipcMain.handle('stop-server', async () => await stopServer());
ipcMain.handle('start-tunnel', async (_, params = {}) => {
    return await startTunnel(params);
});
ipcMain.handle('stop-tunnel', () => stopTunnel());

// Direct STUN P2P Room Handlers
function hasConfiguredGmCredentials() {
    return Boolean(appConfig.gmCredentials?.username && appConfig.gmCredentials?.hash);
}

ipcMain.handle('p2p-get-status', () => p2pBridge.getStatus());
ipcMain.handle('p2p-start-room', (_, options = {}) => {
    if (!hasConfiguredGmCredentials()) {
        return { success: false, error: 'Set a GM Username and Password before starting an online P2P room.' };
    }
    const status = p2pBridge.startRoom(options);
    notifyStatusChange();
    return status;
});
ipcMain.handle('p2p-stop-room', () => {
    const result = p2pBridge.stopRoom();
    notifyStatusChange();
    return result;
});
ipcMain.handle('p2p-regen-code', () => {
    if (!hasConfiguredGmCredentials()) {
        return { success: false, error: 'Set a GM Username and Password before regenerating a P2P room code.' };
    }
    const newCode = p2pBridge.generateRoomCode();
    const status = p2pBridge.startRoom({ roomCode: newCode });
    notifyStatusChange();
    return status;
});
ipcMain.handle('open-vtt-app', async (_, targetUrl) => {
    if (!isServerRunning) {
        await startServer();
    }
    const defaultUrl = `http://localhost:${getServerPort()}/vtt/index.html`;
    if (targetUrl) {
        try {
            const parsed = new URL(targetUrl);
            const h = parsed.hostname.toLowerCase();
            const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
            if (
                (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
                (h !== 'localhost' && h !== '127.0.0.1') ||
                Number(parsed.port || defaultPort) !== getServerPort()
            ) {
                console.warn(`[Security] Blocked non-local URL in open-vtt-app: ${targetUrl}`);
                return Promise.reject(new Error('Invalid local VTT URL'));
            }
        } catch (err) {
            return Promise.reject(new Error('Malformed VTT URL', { cause: err }));
        }
    }
    return openVTTWindow(targetUrl || defaultUrl);
});
ipcMain.handle('open-external', async (_, rawUrl) => {
    try {
        const parsed = new URL(String(rawUrl || ''));
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return shell.openExternal(parsed.toString());
        }
    } catch (_) {}
    return Promise.reject(new Error('Invalid external URL protocol'));
});
ipcMain.handle('open-presentation-window', async (_, params = {}) => {
    if (!isServerRunning) {
        await startServer();
    }
    openPresentationWindow(params?.campaignId || 'default');
    return { success: true };
});
ipcMain.handle('close-presentation-window', async () => {
    closePresentationWindow();
    return { success: true };
});
ipcMain.handle('open-vtt-browser', async (_, url) => {
    if (!isServerRunning) {
        await startServer();
    }
    const targetUrl = url || `http://localhost:${getServerPort()}/vtt/index.html`;
    try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return shell.openExternal(targetUrl);
        }
        console.warn(`[Security] Blocked non-http external URL protocol in open-vtt-browser: ${targetUrl}`);
        return Promise.reject(new Error('Invalid URL protocol: only http: and https: permitted'));
    } catch (err) {
        console.warn(`[Security] Malformed external URL in open-vtt-browser: ${targetUrl}`);
        return Promise.reject(new Error('Malformed URL', { cause: err }));
    }
});
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
            oldHasData = files.some((f) => f === 'campaigns.json' || f === 'uploads' || f === 'chat-log.json');
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
                return { success: false, error: `Failed to copy data: ${err.message}` };
            }
        }
    }

    appConfig.campaignDataDir = newDir;
    saveConfig();
    process.env.FORGEDVTT_DATA_DIR = newDir;
    sourceManager.setCampaignDataDir(newDir);

    // Seamlessly notify server process if running
    try {
        await fetch(`http://127.0.0.1:${getServerPort()}/api/server/data-dir`, {
            method: 'POST',
            headers: internalHeaders({ 'Content-Type': 'application/json' }),
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

// Helper to restore campaigns and assets from backup archive or json
async function restoreBackupFromFile(targetFile) {
    if (!fs.existsSync(targetFile)) return { success: false, error: 'Backup file not found' };

    const ext = path.extname(targetFile).toLowerCase();
    const tempDir = path.join(app.getPath('temp'), `forge-backup-imp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        let manifest = null;
        let assetsDir = null;

        if (ext === '.zip') {
            unpackZipArchive(targetFile, tempDir);
            const manifestPath = path.join(tempDir, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                return { success: false, error: 'Invalid ZIP archive: manifest.json not found inside package.' };
            }
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            assetsDir = path.join(tempDir, 'assets');
        } else {
            manifest = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        }

        // Determine campaigns from manifest
        let campaignsToRestore = {};
        if (manifest.campaigns && typeof manifest.campaigns === 'object') {
            campaignsToRestore = manifest.campaigns;
        } else if (manifest.type === 'campaign' && manifest.campaign) {
            campaignsToRestore = { [manifest.campaign.id]: manifest.campaign };
        } else if (manifest.id && manifest.name) {
            campaignsToRestore = { [manifest.id]: manifest };
        } else if (
            typeof manifest === 'object' &&
            Object.values(manifest).every((c) => c && typeof c === 'object' && (c.id || c.name))
        ) {
            campaignsToRestore = manifest;
        }

        const campaignEntries = Object.entries(campaignsToRestore);
        if (campaignEntries.length === 0) {
            return { success: false, error: 'Invalid backup format: no campaign data found.' };
        }

        // Unpack assets if present
        if (assetsDir && fs.existsSync(assetsDir)) {
            const hasIsolatedCampaigns = fs.existsSync(path.join(assetsDir, 'campaigns'));
            const isolatedGlobalDir = path.join(assetsDir, 'global');

            if (hasIsolatedCampaigns || fs.existsSync(isolatedGlobalDir)) {
                if (fs.existsSync(isolatedGlobalDir)) {
                    const globalUploads = path.join(appConfig.campaignDataDir, 'uploads');
                    if (!fs.existsSync(globalUploads)) fs.mkdirSync(globalUploads, { recursive: true });
                    try {
                        fs.cpSync(isolatedGlobalDir, globalUploads, { recursive: true });
                    } catch (e) {
                        throw new Error(`Failed restoring assets to global uploads: ${e.message}`, { cause: e });
                    }
                }
            } else {
                // Legacy flat archive format: copy to global uploads
                const globalUploads = path.join(appConfig.campaignDataDir, 'uploads');
                if (!fs.existsSync(globalUploads)) fs.mkdirSync(globalUploads, { recursive: true });
                try {
                    fs.cpSync(assetsDir, globalUploads, { recursive: true });
                } catch (e) {
                    throw new Error(`Failed restoring assets to global uploads: ${e.message}`, { cause: e });
                }
            }
        }

        // Load existing campaigns
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        let existingCampaigns = {};
        if (fs.existsSync(campFile)) {
            try {
                existingCampaigns = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            } catch (e) {
                existingCampaigns = {};
            }
        }

        let restoredCount = 0;
        let firstRestoredCampaign = null;

        for (const [origId, campData] of campaignEntries) {
            if (!campData || !campData.name) continue;

            let targetId = origId || campData.id;
            let targetName = campData.name;

            if (!targetId || existingCampaigns[targetId]) {
                targetId = `${(campData.name || 'camp').toLowerCase().replace(/[^a-z0-9]/gi, '_')}_restored_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                targetName = `${campData.name} (Restored)`;
            }

            let campStr = JSON.stringify(campData);
            if (origId && targetId !== origId) {
                const oldPathRegex = new RegExp(`(/assets/campaigns/|assets/campaigns/)${origId}([/\\\\])`, 'g');
                campStr = campStr.replace(oldPathRegex, `$1${targetId}$2`);
            }

            const mergedCamp = {
                ...JSON.parse(campStr),
                id: targetId,
                name: targetName
            };

            existingCampaigns[targetId] = mergedCamp;
            restoredCount++;
            if (!firstRestoredCampaign) firstRestoredCampaign = mergedCamp;

            // Also unpack assets into per-campaign uploads if assets exist
            if (assetsDir && fs.existsSync(assetsDir)) {
                const isolatedCampDir = path.join(assetsDir, 'campaigns', origId);
                if (fs.existsSync(isolatedCampDir)) {
                    unpackAssetsToCampaign(isolatedCampDir, targetId, true);
                } else if (!fs.existsSync(path.join(assetsDir, 'campaigns'))) {
                    // Legacy flat archive fallback
                    unpackAssetsToCampaign(assetsDir, targetId, true);
                }
            }
        }

        // Unpack token assets if present in backup archive
        if (assetsDir && fs.existsSync(assetsDir)) {
            const extractedTokensDir = path.join(assetsDir, 'tokens');
            if (fs.existsSync(extractedTokensDir)) {
                const targetTokensDir = path.join(appConfig.campaignDataDir, 'assets', 'tokens');
                if (!fs.existsSync(targetTokensDir)) fs.mkdirSync(targetTokensDir, { recursive: true });
                try {
                    fs.cpSync(extractedTokensDir, targetTokensDir, { recursive: true });
                    appendLog(`[Restore] Successfully restored custom token assets.`);
                } catch (e) {
                    console.warn(`Could not restore token assets: ${e.message}`);
                }
            }
        }

        // Unpack custom homebrew sources if present in backup archive
        const extractedSourcesDir = path.join(tempDir, 'sources');
        let restoredSources = false;
        if (fs.existsSync(extractedSourcesDir)) {
            const targetSourcesDir = path.join(appConfig.campaignDataDir, 'sources');
            if (!fs.existsSync(targetSourcesDir)) fs.mkdirSync(targetSourcesDir, { recursive: true });
            try {
                fs.cpSync(extractedSourcesDir, targetSourcesDir, { recursive: true });
                restoredSources = true;
                appendLog(`[Restore] Successfully restored custom homebrew sources.`);
            } catch (e) {
                console.warn(`Could not restore homebrew sources: ${e.message}`);
            }
        }

        // Save updated campaigns.json
        fs.writeFileSync(campFile, JSON.stringify(existingCampaigns, null, 2), 'utf8');

        // Reload sources in manager and sync to server if restored
        if (restoredSources) {
            sourceManager.setCampaignDataDir(appConfig.campaignDataDir);
            await syncSourcesToServer();
        }

        // Notify server to re-read or sync database
        try {
            await fetch(`http://127.0.0.1:${getServerPort()}/api/server/data-dir`, {
                method: 'POST',
                headers: internalHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ dataDir: appConfig.campaignDataDir })
            });
        } catch (e) {}

        appendLog(`[Restore] Successfully restored ${restoredCount} campaign(s) and assets from ${targetFile}`);
        notifyStatusChange();
        return { success: true, count: restoredCount, campaign: firstRestoredCampaign, path: targetFile };
    } catch (err) {
        appendLog(`[Restore Error] Failed restoring backup: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

// Backup All Campaigns and Uploads to Backups Folder
ipcMain.handle('backup-campaign', async () => {
    if (!mainWindow) return { success: false };

    if (!fs.existsSync(appConfig.backupsDir)) {
        fs.mkdirSync(appConfig.backupsDir, { recursive: true });
    }

    const campaignsFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
    if (!fs.existsSync(campaignsFile)) {
        return { success: false, error: 'No campaign file found in active data folder to backup.' };
    }

    let campaignsData = {};
    try {
        campaignsData = JSON.parse(fs.readFileSync(campaignsFile, 'utf8'));
    } catch (err) {
        return { success: false, error: `Failed to read campaigns file: ${err.message}` };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFileName = `ForgeDVTT-Backup-${timestamp}.zip`;
    const defaultFilePath = path.join(appConfig.backupsDir, defaultFileName);

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Backup Campaign Data and Uploads',
        defaultPath: defaultFilePath,
        filters: [
            { name: 'ForgeDVTT Full Backup Archive (*.zip)', extensions: ['zip'] },
            { name: 'ForgeDVTT Campaign Data Only - No Uploads (*.json)', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const isZip = filePath.toLowerCase().endsWith('.zip');
    const tempDir = path.join(app.getPath('temp'), `forge-backup-exp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        const manifest = {
            format: 'forgedvtt-backup',
            version: 1,
            type: isZip ? 'full-backup' : 'campaign-data-only',
            exportedAt: new Date().toISOString(),
            campaigns: campaignsData
        };

        if (isZip) {
            fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
            const assetsDir = path.join(tempDir, 'assets');
            fs.mkdirSync(assetsDir, { recursive: true });

            // Collect global uploads
            const globalUploadsDir = path.join(appConfig.campaignDataDir, 'uploads');
            if (fs.existsSync(globalUploadsDir)) {
                try {
                    const destGlobal = path.join(assetsDir, 'global');
                    fs.cpSync(globalUploadsDir, destGlobal, { recursive: true });
                } catch (e) {
                    throw new Error(`Failed copying global uploads: ${e.message}`, { cause: e });
                }
            }

            // Collect per-campaign uploads into isolated campaign folders
            const campRootDir = path.join(appConfig.campaignDataDir, 'campaigns');
            if (fs.existsSync(campRootDir)) {
                try {
                    const campFolders = fs.readdirSync(campRootDir);
                    for (const cFolder of campFolders) {
                        const cUploads = path.join(campRootDir, cFolder, 'uploads');
                        if (fs.existsSync(cUploads)) {
                            const destCamp = path.join(assetsDir, 'campaigns', cFolder);
                            fs.cpSync(cUploads, destCamp, { recursive: true });
                        }
                    }
                } catch (e) {
                    throw new Error(`Failed copying campaign uploads: ${e.message}`, { cause: e });
                }
            }

            // Collect token assets (Homebrew Studio artwork)
            const tokenAssetsDir = path.join(appConfig.campaignDataDir, 'assets', 'tokens');
            if (fs.existsSync(tokenAssetsDir)) {
                try {
                    const destTokens = path.join(assetsDir, 'tokens');
                    fs.cpSync(tokenAssetsDir, destTokens, { recursive: true });
                } catch (e) {
                    console.warn(`Could not copy token assets: ${e.message}`);
                }
            }

            // Collect custom homebrew sources
            const sourcesDir = path.join(appConfig.campaignDataDir, 'sources');
            if (fs.existsSync(sourcesDir)) {
                try {
                    const destSources = path.join(tempDir, 'sources');
                    fs.cpSync(sourcesDir, destSources, { recursive: true });
                } catch (e) {
                    console.warn(`Could not copy sources directory: ${e.message}`);
                }
            }

            // Collect any other referenced uploads into global
            const referenced = findReferencedUploads(campaignsData);
            if (referenced.length > 0) {
                const destGlobal = path.join(assetsDir, 'global');
                collectAssets(referenced, '', destGlobal, true);
            }

            packZipArchive(tempDir, filePath);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
        }

        appendLog(
            `[Backup] ${isZip ? 'Full backup' : 'Campaign data (no uploads)'} successfully exported to: ${filePath}`
        );
        return { success: true, path: filePath, isFullBackup: isZip };
    } catch (err) {
        appendLog(`[Backup Error] Failed exporting backup: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
});

// Restore Backup IPC
ipcMain.handle('restore-backup', async (_, explicitFilePath) => {
    let targetFile = explicitFilePath;
    if (!targetFile) {
        if (!mainWindow) return { canceled: true };
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select ForgeDVTT Backup File (*.zip, *.json)',
            defaultPath: appConfig.backupsDir,
            filters: [
                { name: 'ForgeDVTT Backup Archive (*.zip)', extensions: ['zip'] },
                { name: 'ForgeDVTT Backup JSON (*.json)', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
        targetFile = filePaths[0];
    }

    return await restoreBackupFromFile(targetFile);
});

// GM Credentials IPC
ipcMain.handle('get-gm-credentials', () => {
    return {
        username: appConfig.gmCredentials?.username || '',
        hasPassword: !!appConfig.gmCredentials?.hash
    };
});

ipcMain.handle('set-gm-credentials', async (_, { username, password, clearPassword }) => {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername) {
        return { success: false, error: 'Username cannot be empty.' };
    }

    let hash = appConfig.gmCredentials?.hash || '';
    let salt = appConfig.gmCredentials?.salt || '';

    if (clearPassword) {
        if (isTunnelRunning) {
            return { success: false, error: 'Stop the active online tunnel before removing the GM password.' };
        }
        hash = '';
        salt = '';
    } else if (password && password.trim() !== '') {
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
        await fetch(`http://127.0.0.1:${getServerPort()}/api/server/sync-config`, {
            method: 'POST',
            headers: internalHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ gmCredentials: appConfig.gmCredentials })
        });
        appendLog(
            hash
                ? `[GM Security] Updated master GM credentials for username "${cleanUsername}".`
                : `[GM Security] Removed master GM password for username "${cleanUsername}".`
        );
    } catch (e) {}

    notifyStatusChange();
    return { success: true, username: cleanUsername, hasPassword: !!hash };
});

// Campaign Management IPC (for GM Dashboard)
ipcMain.handle('gm-get-campaigns', async () => {
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns`, {
            headers: internalHeaders()
        });
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
            const list = Object.values(data).map((c) => ({
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

ipcMain.handle('gm-get-campaign-details', async (_, campId) => {
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campId}`, {
            headers: internalHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            return { success: true, campaign: data };
        }
    } catch (e) {}

    // Fallback to local file
    try {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        if (fs.existsSync(campFile)) {
            const data = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            if (data[campId]) {
                return { success: true, campaign: data[campId] };
            }
        }
    } catch (e) {}
    return { success: false, error: 'Campaign not found' };
});

ipcMain.handle('gm-save-campaign', async (_, campaignData) => {
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campaignData.id}`, {
            method: 'PUT',
            headers: internalHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(campaignData)
        });
        if (res.ok) {
            const updated = await res.json();
            return { success: true, campaign: updated };
        }
        const err = await res.json();
        return { success: false, error: err.error || 'Failed to save campaign' };
    } catch (e) {}

    // Fallback to direct local file
    try {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        if (fs.existsSync(campFile)) {
            const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            if (all[campaignData.id]) {
                const target = all[campaignData.id];
                if (campaignData.name && campaignData.name.trim()) target.name = campaignData.name.trim();
                if (campaignData.description !== undefined) target.description = campaignData.description;
                if (Array.isArray(campaignData.allowedUsers)) target.allowedUsers = campaignData.allowedUsers;
                fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
                return { success: true, campaign: target };
            }
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
    return { success: false, error: 'Campaign not found' };
});

ipcMain.handle('gm-create-campaign', async (_, newCampData) => {
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns`, {
            method: 'POST',
            headers: internalHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(newCampData)
        });
        if (res.ok) {
            const created = await res.json();
            return { success: true, campaign: created };
        }
        const err = await res.json();
        return { success: false, error: err.error || 'Failed to create campaign' };
    } catch (e) {}

    // Fallback to direct local file
    try {
        const { name, description, allowedUsers } = newCampData || {};
        if (!name || !name.trim()) return { success: false, error: 'Campaign name required' };
        const id =
            name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/gi, '_') +
            '_' +
            Date.now();
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        let all = {};
        if (fs.existsSync(campFile)) {
            try {
                all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            } catch (_) {}
        }
        const newCamp = createCampaignTemplate(id, name.trim());
        if (description) newCamp.description = description;
        if (Array.isArray(allowedUsers)) newCamp.allowedUsers = allowedUsers;
        all[id] = newCamp;
        fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
        return { success: true, campaign: newCamp };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('gm-delete-campaign', async (_, campId) => {
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campId}`, {
            method: 'DELETE',
            headers: internalHeaders()
        });
        if (res.ok) {
            return { success: true, deletedId: campId };
        }
        const err = await res.json();
        return { success: false, error: err.error || 'Failed to delete campaign' };
    } catch (e) {}

    // Fallback to direct local file
    try {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        if (fs.existsSync(campFile)) {
            const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            const keys = Object.keys(all);
            if (keys.length <= 1) {
                return { success: false, error: 'Cannot delete the only campaign. Create another campaign first.' };
            }
            if (!all[campId]) return { success: false, error: 'Campaign not found' };
            delete all[campId];
            fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
            return { success: true, deletedId: campId };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to delete campaign' };
});

ipcMain.handle('gm-delete-entity', async (_, { campaignId, entityType, entityId }) => {
    try {
        const res = await fetch(
            `http://127.0.0.1:${getServerPort()}/api/campaigns/${campaignId}/entities/${entityId}`,
            {
                method: 'DELETE',
                headers: internalHeaders()
            }
        );
        if (res.ok) {
            const data = await res.json();
            return { success: true, deletedId: entityId, entityType: data.entityType || entityType };
        }
        const err = await res.json();
        return { success: false, error: err.error || 'Failed to delete entity' };
    } catch (e) {}

    // Fallback to direct local file
    try {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        if (fs.existsSync(campFile)) {
            const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            const camp = all[campaignId];
            if (!camp) return { success: false, error: 'Campaign not found' };

            let deleted = false;
            if (camp.maps && camp.maps[entityId]) {
                const mapKeys = Object.keys(camp.maps);
                if (mapKeys.length <= 1) {
                    return { success: false, error: 'Cannot delete the only map in the campaign.' };
                }
                delete camp.maps[entityId];
                if (Array.isArray(camp.mapOrder)) {
                    camp.mapOrder = camp.mapOrder.filter((id) => id !== entityId);
                }
                if (camp.activeMapId === entityId) {
                    camp.activeMapId = (camp.mapOrder && camp.mapOrder[0]) || Object.keys(camp.maps)[0];
                }
                if (camp.activeGMMapId === entityId) {
                    camp.activeGMMapId = camp.activeMapId;
                }
                deleted = true;
            } else if (camp.characters && camp.characters[entityId]) {
                delete camp.characters[entityId];
                deleted = true;
            } else if (entityType === 'table' || entityType === 'deck' || camp.rollTables || camp.assetTables) {
                const rt = camp.rollTables || {};
                let found = false;
                for (const tableKey of ['tables', 'customTables', 'assetTables']) {
                    if (Array.isArray(rt[tableKey])) {
                        const initLen = rt[tableKey].length;
                        rt[tableKey] = rt[tableKey].filter((t) => t.id !== entityId);
                        if (rt[tableKey].length < initLen) {
                            found = true;
                            entityType = 'table';
                        }
                    }
                }
                if (Array.isArray(camp.assetTables)) {
                    const initLen = camp.assetTables.length;
                    camp.assetTables = camp.assetTables.filter((t) => t.id !== entityId);
                    if (camp.assetTables.length < initLen) {
                        found = true;
                        entityType = 'table';
                    }
                }
                for (const deckKey of ['decks', 'cardDecks']) {
                    if (Array.isArray(rt[deckKey])) {
                        const initLen = rt[deckKey].length;
                        rt[deckKey] = rt[deckKey].filter((d) => d.id !== entityId);
                        if (rt[deckKey].length < initLen) {
                            found = true;
                            entityType = 'deck';
                        }
                    }
                }
                if (found) {
                    camp.rollTables = rt;
                    deleted = true;
                }
            }

            if (!deleted) return { success: false, error: 'Entity not found in campaign' };

            fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
            return { success: true, deletedId: entityId, entityType };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to delete entity' };
});

// --- Campaign Duplication & Packaging Helpers ---
function getTarBin() {
    return process.platform === 'win32' ? 'tar.exe' : 'tar';
}

function packZipArchive(sourceDir, zipFilePath) {
    try {
        if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
        execFileSync(getTarBin(), ['-a', '-c', '-f', zipFilePath, '-C', sourceDir, '.'], { stdio: 'ignore' });
        return true;
    } catch (err) {
        console.error('Failed to create ZIP with tar:', err);
        throw err;
    }
}

function unpackZipArchive(zipFilePath, targetDir) {
    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        execFileSync(getTarBin(), ['-xf', zipFilePath, '-C', targetDir], { stdio: 'ignore' });
        return true;
    } catch (err) {
        console.error('Failed to extract ZIP with tar:', err);
        throw err;
    }
}

function findReferencedUploads(dataObj) {
    const fileNames = new Set();
    const jsonStr = JSON.stringify(dataObj);
    const regex =
        /(?:vtt-uploads|uploads|assets[/\\]tokens|tokens)[/\\]([^"'<>\r\n]+?\.(?:png|jpe?g|webp|svg|gif|mp3|ogg|wav|webm|mp4|json|m4a|opus))/gi;
    let match;
    while ((match = regex.exec(jsonStr)) !== null) {
        if (match[1]) {
            let fn = match[1];
            try {
                fn = decodeURIComponent(fn);
            } catch (_) {}
            fn = path.basename(fn);
            if (fn) fileNames.add(fn);
        }
    }
    return Array.from(fileNames);
}

function collectAssets(fileNames, campaignId, destAssetsDir, throwOnFailure = false) {
    const found = [];
    if (!fs.existsSync(destAssetsDir)) fs.mkdirSync(destAssetsDir, { recursive: true });

    const campUploads = path.join(appConfig.campaignDataDir, 'campaigns', campaignId, 'uploads');
    const globalUploads = path.join(appConfig.campaignDataDir, 'uploads');
    const tokenAssets = path.join(appConfig.campaignDataDir, 'assets', 'tokens');

    for (const fn of fileNames) {
        const p1 = path.join(campUploads, fn);
        const p2 = path.join(globalUploads, fn);
        const p3 = path.join(tokenAssets, fn);
        let srcFile = null;
        if (fs.existsSync(p1)) srcFile = p1;
        else if (fs.existsSync(p2)) srcFile = p2;
        else if (fs.existsSync(p3)) srcFile = p3;

        if (srcFile) {
            const dest = path.join(destAssetsDir, fn);
            try {
                fs.copyFileSync(srcFile, dest);
                found.push(fn);
            } catch (e) {
                if (throwOnFailure) {
                    throw new Error(`Could not copy asset ${fn}: ${e.message}`, { cause: e });
                }
                console.warn(`Could not copy asset ${fn}:`, e);
            }
        }
    }
    return found;
}

function unpackAssetsToCampaign(extractedAssetsDir, targetCampaignId, throwOnFailure = false) {
    if (!fs.existsSync(extractedAssetsDir)) return 0;
    const targetUploads = path.join(appConfig.campaignDataDir, 'campaigns', targetCampaignId, 'uploads');
    const targetTokens = path.join(appConfig.campaignDataDir, 'assets', 'tokens');
    if (!fs.existsSync(targetUploads)) fs.mkdirSync(targetUploads, { recursive: true });

    const files = fs.readdirSync(extractedAssetsDir);
    let count = 0;
    for (const f of files) {
        const src = path.join(extractedAssetsDir, f);
        if (fs.statSync(src).isDirectory()) continue;
        const dst = path.join(targetUploads, f);
        try {
            fs.copyFileSync(src, dst);
            if (f.startsWith('token-')) {
                if (!fs.existsSync(targetTokens)) fs.mkdirSync(targetTokens, { recursive: true });
                try {
                    fs.copyFileSync(src, path.join(targetTokens, f));
                } catch (_) {}
            }
            count++;
        } catch (e) {
            if (throwOnFailure) {
                throw new Error(`Failed copying imported asset ${f}: ${e.message}`, { cause: e });
            }
            console.warn(`Failed copying imported asset ${f}:`, e);
        }
    }
    return count;
}

// Campaign Duplication IPC
ipcMain.handle('gm-duplicate-campaign', async (_, campId) => {
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campId}/duplicate`, {
            method: 'POST',
            headers: internalHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            appendLog(`[Campaigns] Duplicated campaign ${campId} -> ${data.campaign.name} (${data.campaign.id})`);
            return { success: true, campaign: data.campaign };
        }
    } catch (e) {}

    // Fallback to direct local file
    try {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        if (fs.existsSync(campFile)) {
            const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            const orig = all[campId];
            if (!orig) return { success: false, error: 'Campaign not found' };

            const safeName = (orig.name || 'Campaign').trim();
            const newName = `${safeName} (Copy)`;
            const newId = safeName.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_copy_' + Date.now();
            // Deep clone campaign object and migrate internal asset paths to new ID
            let clonedStr = JSON.stringify(orig);
            const oldPathRegex = new RegExp(`(/assets/campaigns/|assets/campaigns/)${campId}([/\\\\])`, 'g');
            clonedStr = clonedStr.replace(oldPathRegex, `$1${newId}$2`);
            const cloned = JSON.parse(clonedStr);
            cloned.id = newId;
            cloned.name = newName;
            cloned.initiative = {
                combatants: [],
                currentRound: 1,
                activeTurnIndex: -1,
                isVisible: false
            };

            // Copy uploads folder
            const origUploads = path.join(appConfig.campaignDataDir, 'campaigns', campId, 'uploads');
            const newUploads = path.join(appConfig.campaignDataDir, 'campaigns', newId, 'uploads');
            if (fs.existsSync(origUploads)) {
                fs.cpSync(origUploads, newUploads, { recursive: true });
            }

            all[newId] = cloned;
            fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
            appendLog(`[Campaigns] (File) Duplicated campaign ${campId} -> ${newName} (${newId})`);
            return { success: true, campaign: cloned };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to duplicate campaign' };
});

// Full Campaign Export IPC
ipcMain.handle('gm-export-campaign', async (_, campId) => {
    if (!mainWindow) return { canceled: true };

    // 1. Fetch full campaign data
    let campaign = null;
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campId}`, {
            headers: internalHeaders()
        });
        if (res.ok) campaign = await res.json();
    } catch (e) {}

    if (!campaign) {
        try {
            const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
            if (fs.existsSync(campFile)) {
                const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
                campaign = all[campId];
            }
        } catch (e) {}
    }

    if (!campaign) return { success: false, error: 'Campaign not found' };

    // 2. Determine assets
    const referencedUploads = findReferencedUploads(campaign);
    const campUploadsDir = path.join(appConfig.campaignDataDir, 'campaigns', campId, 'uploads');
    let hasLocalUploads = referencedUploads.length > 0;
    if (!hasLocalUploads && fs.existsSync(campUploadsDir)) {
        try {
            hasLocalUploads = fs.readdirSync(campUploadsDir).length > 0;
        } catch (e) {}
    }

    const safeName = (campaign.name || 'Campaign').replace(/[^a-z0-9_\-]/gi, '_');
    const defaultExt = hasLocalUploads ? 'zip' : 'json';
    const defaultPath = path.join(appConfig.backupsDir, `${safeName}-Campaign.${defaultExt}`);

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: `Export Campaign: ${campaign.name}`,
        defaultPath,
        filters: [
            {
                name: hasLocalUploads ? 'ForgeDVTT Archive (*.zip)' : 'ForgeDVTT Data (*.json, *.zip)',
                extensions: hasLocalUploads ? ['zip'] : ['json', 'zip']
            },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) return { canceled: true };

    const isZip = filePath.toLowerCase().endsWith('.zip');
    const tempDir = path.join(app.getPath('temp'), `forge-camp-exp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        const manifest = {
            format: 'forgedvtt-package',
            version: 1,
            type: 'campaign',
            exportedAt: new Date().toISOString(),
            campaign
        };

        if (isZip) {
            fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
            const assetsDir = path.join(tempDir, 'assets');
            fs.mkdirSync(assetsDir, { recursive: true });

            if (fs.existsSync(campUploadsDir)) {
                fs.cpSync(campUploadsDir, assetsDir, { recursive: true });
            }
            collectAssets(referencedUploads, campId, assetsDir);

            packZipArchive(tempDir, filePath);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
        }

        appendLog(`[Campaigns] Successfully exported campaign "${campaign.name}" to ${filePath}`);
        return { success: true, filePath };
    } catch (err) {
        appendLog(`[Campaigns Error] Failed exporting campaign: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
});

// Full Campaign Import IPC
ipcMain.handle('gm-import-campaign', async (_, explicitFilePath) => {
    let targetFile = explicitFilePath;
    if (!targetFile) {
        if (!mainWindow) return { canceled: true };
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select ForgeDVTT Campaign File (*.zip, *.json)',
            filters: [
                { name: 'ForgeDVTT Campaign (*.zip, *.json)', extensions: ['zip', 'json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
        targetFile = filePaths[0];
    }

    if (!fs.existsSync(targetFile)) return { success: false, error: 'File not found' };

    const ext = path.extname(targetFile).toLowerCase();
    const tempDir = path.join(app.getPath('temp'), `forge-camp-imp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        let manifest = null;
        let assetsDir = null;

        if (ext === '.zip') {
            unpackZipArchive(targetFile, tempDir);
            const manifestPath = path.join(tempDir, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                return { success: false, error: 'Invalid ZIP archive: manifest.json not found inside package.' };
            }
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            assetsDir = path.join(tempDir, 'assets');
        } else {
            manifest = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        }

        // If target is a full backup archive, seamlessly restore it
        if (
            manifest.type === 'full-backup' ||
            manifest.format === 'forgedvtt-backup' ||
            manifest.campaigns ||
            (!manifest.campaign &&
                !manifest.maps &&
                Object.values(manifest).some((v) => v && typeof v === 'object' && v.name))
        ) {
            return await restoreBackupFromFile(targetFile);
        }

        const campData = manifest.campaign || (manifest.maps ? manifest : null);
        if (!campData || !campData.name) {
            return { success: false, error: 'Invalid campaign format: missing campaign data.' };
        }

        const origCampId = campData.id;
        const safeBaseId = (campData.id || campData.name).toLowerCase().replace(/[^a-z0-9]/gi, '_');
        const newCampId = `${safeBaseId}_imported_${Date.now()}`;
        let campStr = JSON.stringify(campData);
        if (origCampId) {
            const oldPathRegex = new RegExp(`(/assets/campaigns/|assets/campaigns/)${origCampId}([/\\\\])`, 'g');
            campStr = campStr.replace(oldPathRegex, `$1${newCampId}$2`);
        }
        const newCamp = {
            ...JSON.parse(campStr),
            id: newCampId,
            name: `${campData.name} (Imported)`
        };

        if (assetsDir && fs.existsSync(assetsDir)) {
            unpackAssetsToCampaign(assetsDir, newCampId);
        }

        let saved = false;
        try {
            const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/import`, {
                method: 'POST',
                headers: internalHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ campaign: newCamp })
            });
            if (res.ok) saved = true;
        } catch (e) {}

        if (!saved) {
            const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
            let all = {};
            if (fs.existsSync(campFile)) {
                all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
            }
            all[newCampId] = newCamp;
            fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
        }

        appendLog(`[Campaigns] Successfully imported campaign "${newCamp.name}" (${newCampId})`);
        return { success: true, campaign: newCamp };
    } catch (err) {
        appendLog(`[Campaigns Error] Failed importing campaign: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
});

// Granular Entity Export IPC (Map, Custom NPC, Companion, Player Sheet)
ipcMain.handle('gm-export-granular', async (_, { campaignId, entityType, entityId, batch }) => {
    if (!mainWindow) return { canceled: true };

    let campaign = null;
    try {
        const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campaignId}`, {
            headers: internalHeaders()
        });
        if (res.ok) campaign = await res.json();
    } catch (e) {}

    if (!campaign) {
        try {
            const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
            if (fs.existsSync(campFile)) {
                const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
                campaign = all[campaignId];
            }
        } catch (e) {}
    }

    if (!campaign) return { success: false, error: 'Campaign not found' };

    let items = [];
    let exportLabel = '';

    if (entityType === 'map') {
        if (batch) {
            items = Object.values(campaign.maps || {});
            exportLabel = `${campaign.name || 'Campaign'}-All-Maps`;
        } else {
            const m = (campaign.maps || {})[entityId];
            if (m) items = [m];
            exportLabel = m?.name ? `${m.name}-Map` : 'Map';
        }
    } else if (entityType === 'player') {
        const isCompanion = (c) => Boolean(c.isCompanion || (c.id && c.id.startsWith('comp_')));
        const isCustomNpc = (c) =>
            Boolean(
                c.isCustomNpc ||
                (c.id && c.id.startsWith('npc_')) ||
                (c.monsterData && !c.isPlayer && !c.isCompanion && !(c.id && c.id.startsWith('char_')))
            );
        const isPlayer = (c) => !isCompanion(c) && !isCustomNpc(c);

        const chars = Object.values(campaign.characters || {}).filter(isPlayer);
        if (batch) {
            items = chars;
            exportLabel = `${campaign.name || 'Campaign'}-All-Players`;
        } else {
            const ch = (campaign.characters || {})[entityId];
            if (ch) items = [ch];
            exportLabel = ch?.name ? `${ch.name}-Player` : 'Player';
        }
    } else if (entityType === 'companion') {
        const chars = Object.values(campaign.characters || {}).filter(
            (c) => c.isCompanion || (c.id && c.id.startsWith('comp_'))
        );
        if (batch) {
            items = chars;
            exportLabel = `${campaign.name || 'Campaign'}-All-Companions`;
        } else {
            const ch = (campaign.characters || {})[entityId];
            if (ch) items = [ch];
            exportLabel = ch?.name ? `${ch.name}-Companion` : 'Companion';
        }
    } else if (entityType === 'customNpc') {
        const chars = Object.values(campaign.characters || {}).filter(
            (c) =>
                c.isCustomNpc ||
                (c.id && c.id.startsWith('npc_')) ||
                (c.monsterData && !c.isPlayer && !c.isCompanion && !(c.id && c.id.startsWith('char_')))
        );
        if (batch) {
            items = chars;
            exportLabel = `${campaign.name || 'Campaign'}-All-Custom-NPCs`;
        } else {
            const ch = (campaign.characters || {})[entityId];
            if (ch) items = [ch];
            exportLabel = ch?.name ? `${ch.name}-NPC` : 'CustomNPC';
        }
    } else if (entityType === 'table' || entityType === 'deck' || entityType === 'tablesAndDecks') {
        const rollTablesObj = campaign.rollTables || {};
        const customTables =
            (Array.isArray(rollTablesObj.tables) && rollTablesObj.tables.length
                ? rollTablesObj.tables
                : rollTablesObj.customTables) || [];
        const assetTables = rollTablesObj.assetTables || campaign.assetTables || [];
        const cardDecks =
            (Array.isArray(rollTablesObj.decks) && rollTablesObj.decks.length
                ? rollTablesObj.decks
                : rollTablesObj.cardDecks) || [];

        if (batch || entityType === 'tablesAndDecks') {
            items = [
                ...customTables.map((t) => ({ ...t, _entityCategory: 'customTable' })),
                ...assetTables.map((t) => ({ ...t, _entityCategory: 'assetTable' })),
                ...cardDecks.map((t) => ({ ...t, _entityCategory: 'cardDeck' }))
            ];
            exportLabel = `${campaign.name || 'Campaign'}-All-Tables-and-Decks`;
        } else {
            let match = null;
            if (entityType === 'deck') {
                match = cardDecks.find((d) => d.id === entityId);
            } else {
                match =
                    customTables.find((t) => t.id === entityId) ||
                    assetTables.find((t) => t.id === entityId) ||
                    cardDecks.find((d) => d.id === entityId);
            }
            if (match) items = [match];
            exportLabel = match?.name
                ? `${match.name}-${match.isAssetTable ? 'AssetTable' : match.cards ? 'Deck' : 'Table'}`
                : 'Table';
        }
    }

    if (items.length === 0) {
        return { success: false, error: `No items found to export for ${entityType}` };
    }

    const cleanLabel = exportLabel.replace(/[^a-z0-9_\-]/gi, '_');
    const referencedUploads = findReferencedUploads(items);
    const hasLocalUploads = referencedUploads.length > 0;
    const defaultExt = hasLocalUploads ? 'zip' : 'json';
    const defaultPath = path.join(appConfig.backupsDir, `${cleanLabel}.${defaultExt}`);

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${exportLabel}`,
        defaultPath,
        filters: [
            {
                name: hasLocalUploads ? 'ForgeDVTT Archive (*.zip)' : 'ForgeDVTT Data (*.json, *.zip)',
                extensions: hasLocalUploads ? ['zip'] : ['json', 'zip']
            },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) return { canceled: true };

    const isZip = filePath.toLowerCase().endsWith('.zip');
    const tempDir = path.join(app.getPath('temp'), `forge-gran-exp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        const manifest = {
            format: 'forgedvtt-item',
            version: 1,
            entityType,
            batch: !!batch,
            count: items.length,
            exportedAt: new Date().toISOString(),
            sourceCampaign: campaign.name || campaign.id,
            items
        };

        if (isZip) {
            fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
            const assetsDir = path.join(tempDir, 'assets');
            collectAssets(referencedUploads, campaignId, assetsDir);
            packZipArchive(tempDir, filePath);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
        }

        appendLog(`[Export] Successfully exported ${items.length} ${entityType}(s) to ${filePath}`);
        return { success: true, filePath, count: items.length };
    } catch (err) {
        appendLog(`[Export Error] Failed exporting ${entityType}: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
});

// Granular Entity Import IPC
ipcMain.handle('gm-import-granular', async (_, { campaignId, explicitFilePath }) => {
    let targetFiles = explicitFilePath
        ? Array.isArray(explicitFilePath)
            ? explicitFilePath
            : [explicitFilePath]
        : null;

    if (!targetFiles) {
        if (!mainWindow) return { canceled: true };
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Item to Import (*.zip, *.json)',
            filters: [
                { name: 'ForgeDVTT Item (*.zip, *.json)', extensions: ['zip', 'json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile', 'multiSelections']
        });
        if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
        targetFiles = filePaths;
    }

    if (targetFiles.length === 0) return { canceled: true };

    // Check if any selected files are Roll20 character or table JSONs
    const roll20Candidates = [];
    const roll20TableCandidates = [];
    const standardFiles = [];

    for (const fPath of targetFiles) {
        if (!fs.existsSync(fPath)) continue;
        const ext = path.extname(fPath).toLowerCase();
        if (ext === '.json') {
            try {
                const parsed = JSON.parse(fs.readFileSync(fPath, 'utf8'));
                if (isRoll20CharacterJson(parsed)) {
                    roll20Candidates.push({ filePath: fPath, data: parsed });
                    continue;
                }
                if (isRoll20TableJson(parsed)) {
                    roll20TableCandidates.push({ filePath: fPath, data: parsed });
                    continue;
                }
            } catch {}
        }
        standardFiles.push(fPath);
    }

    if (roll20TableCandidates.length > 0) {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        let currentCamp = null;
        let allCamps = null;
        if (fs.existsSync(campFile)) {
            try {
                allCamps = JSON.parse(fs.readFileSync(campFile, 'utf8'));
                currentCamp = allCamps[campaignId];
            } catch {}
        }
        if (currentCamp) {
            if (!currentCamp.rollTables) currentCamp.rollTables = {};
            if (!Array.isArray(currentCamp.rollTables.tables)) {
                currentCamp.rollTables.tables = Array.isArray(currentCamp.rollTables.customTables)
                    ? [...currentCamp.rollTables.customTables]
                    : [];
            }
            if (!currentCamp.rollTables.assetTables) currentCamp.rollTables.assetTables = [];

            const uploadsDir = path.join(appConfig.campaignDataDir, 'campaigns', campaignId, 'uploads');
            let tableCount = 0;

            for (const item of roll20TableCandidates) {
                try {
                    const conv = await convertRoll20TableToVTT(item.data, uploadsDir, campaignId);
                    if (conv.customTables?.length > 0) {
                        currentCamp.rollTables.tables.push(...conv.customTables);
                        currentCamp.rollTables.customTables = currentCamp.rollTables.tables;
                        tableCount += conv.customTables.length;
                    }
                    if (conv.assetTables?.length > 0) {
                        currentCamp.rollTables.assetTables.push(...conv.assetTables);
                        tableCount += conv.assetTables.length;
                    }
                } catch (e) {
                    appendLog(`[Roll20 Table Import Error] ${e.message}`);
                }
            }

            fs.writeFileSync(campFile, JSON.stringify(allCamps, null, 2), 'utf8');
            appendLog(
                `[Roll20 Import] Converted and imported ${tableCount} Roll20 table(s) into campaign ${campaignId}`
            );
            if (standardFiles.length === 0) {
                return { success: true, count: tableCount, campaign: currentCamp };
            }
        }
    }

    if (roll20Candidates.length > 0) {
        const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
        let currentCamp = null;
        let allCamps = null;
        if (fs.existsSync(campFile)) {
            try {
                allCamps = JSON.parse(fs.readFileSync(campFile, 'utf8'));
                currentCamp = allCamps[campaignId];
            } catch {}
        }

        const convertedChars = [];
        const uploadsDir = path.join(appConfig.campaignDataDir, 'campaigns', campaignId, 'uploads');

        for (const item of roll20Candidates) {
            try {
                const rawCharName = (
                    item.data.character?.attributes?.name ||
                    item.data.character?.name ||
                    item.data.name ||
                    item.data.character?.attribs?.find((a) => a?.name === 'character_name')?.current ||
                    'Imported Character'
                ).trim();
                let overwriteExistingId = null;

                if (currentCamp && currentCamp.characters) {
                    const existing = Object.entries(currentCamp.characters).find(
                        ([, c]) => (c.name || '').trim().toLowerCase() === rawCharName.toLowerCase()
                    );
                    if (existing) {
                        const [existingId] = existing;
                        if (mainWindow) {
                            const { response } = await dialog.showMessageBox(mainWindow, {
                                type: 'question',
                                buttons: ['Import as New Copy', 'Overwrite Existing', 'Skip'],
                                defaultId: 0,
                                cancelId: 2,
                                title: 'Character Name Conflict',
                                message: `A character named "${rawCharName}" already exists in this campaign.`,
                                detail: 'Would you like to import this character as a new copy or overwrite the existing character?'
                            });
                            if (response === 2) {
                                continue; // Skip
                            } else if (response === 1) {
                                overwriteExistingId = existingId;
                            }
                        }
                    }
                }

                const converted = await convertRoll20Character(item.data, campaignId, {
                    sourceManager,
                    uploadsDir
                });

                if (overwriteExistingId) {
                    converted.id = overwriteExistingId;
                    converted.name = rawCharName;
                    converted._overwrite = true;
                } else if (
                    currentCamp &&
                    currentCamp.characters &&
                    Object.values(currentCamp.characters).some(
                        (c) => (c.name || '').trim().toLowerCase() === converted.name.trim().toLowerCase()
                    )
                ) {
                    converted.name = `${converted.name} (Copy)`;
                }

                convertedChars.push(converted);
            } catch (err) {
                appendLog(`[Import Error] Failed importing Roll20 character "${item.filePath}": ${err.message}`);
            }
        }

        if (convertedChars.length > 0) {
            let resData = null;
            try {
                const res = await fetch(
                    `http://127.0.0.1:${getServerPort()}/api/campaigns/${campaignId}/import-entity`,
                    {
                        method: 'POST',
                        headers: internalHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ entityType: 'player', entities: convertedChars })
                    }
                );
                if (res.ok) resData = await res.json();
            } catch (e) {}

            if (!resData && allCamps && currentCamp) {
                if (!currentCamp.characters) currentCamp.characters = {};
                for (const char of convertedChars) {
                    const cleanChar = { ...char };
                    delete cleanChar._overwrite;
                    delete cleanChar.overwrite;
                    currentCamp.characters[cleanChar.id] = cleanChar;
                }
                fs.writeFileSync(campFile, JSON.stringify(allCamps, null, 2), 'utf8');
                resData = {
                    success: true,
                    count: convertedChars.length,
                    importedIds: convertedChars.map((c) => c.id),
                    campaign: currentCamp
                };
            }

            if (resData && resData.success) {
                appendLog(`[Import] Successfully imported ${resData.count} character(s) into campaign ${campaignId}`);
                if (standardFiles.length === 0) {
                    return resData;
                }
            }
        } else if (standardFiles.length === 0) {
            return { canceled: true };
        }
    }

    if (standardFiles.length === 0) {
        return { canceled: true };
    }

    const targetFile = standardFiles[0];
    if (!fs.existsSync(targetFile)) return { success: false, error: 'File not found' };

    const ext = path.extname(targetFile).toLowerCase();
    const tempDir = path.join(app.getPath('temp'), `forge-gran-imp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        let manifest = null;
        let assetsDir = null;

        if (ext === '.zip') {
            unpackZipArchive(targetFile, tempDir);
            const manifestPath = path.join(tempDir, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                return { success: false, error: 'Invalid ZIP archive: manifest.json not found.' };
            }
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            assetsDir = path.join(tempDir, 'assets');
        } else {
            manifest = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        }

        let items = [];
        let entityType = manifest.entityType || 'unknown';

        if (Array.isArray(manifest.items)) {
            items = manifest.items;
        } else if (manifest.item) {
            items = [manifest.item];
        } else if (Array.isArray(manifest)) {
            items = manifest;
        } else if (manifest.grid || manifest.tokens !== undefined) {
            items = [manifest];
            entityType = 'map';
        } else if (manifest.id && (manifest.name || manifest.monsterData)) {
            items = [manifest];
        }

        if (items.length === 0) {
            return { success: false, error: 'No recognizable entity items found in file.' };
        }

        // Migrate any cross-campaign asset paths to target campaignId
        items = items.map((item) => {
            let itemStr = JSON.stringify(item);
            itemStr = itemStr.replace(
                /(?:\/assets\/campaigns\/|assets\/campaigns\/)[^/\\\s"']+(?=[/\\\\]uploads[/\\\\])/g,
                `/assets/campaigns/${campaignId}`
            );
            return JSON.parse(itemStr);
        });

        if (assetsDir && fs.existsSync(assetsDir)) {
            unpackAssetsToCampaign(assetsDir, campaignId);
        }

        let resData = null;
        try {
            const res = await fetch(`http://127.0.0.1:${getServerPort()}/api/campaigns/${campaignId}/import-entity`, {
                method: 'POST',
                headers: internalHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ entityType, entities: items })
            });
            if (res.ok) resData = await res.json();
        } catch (e) {}

        if (!resData) {
            const campFile = path.join(appConfig.campaignDataDir, 'campaigns.json');
            if (fs.existsSync(campFile)) {
                const all = JSON.parse(fs.readFileSync(campFile, 'utf8'));
                const camp = all[campaignId];
                if (!camp) return { success: false, error: 'Target campaign not found' };
                if (!camp.maps) camp.maps = {};
                if (!camp.characters) camp.characters = {};

                const importedIds = [];
                for (const item of items) {
                    if (entityType === 'map' || item.grid || item.tokens !== undefined) {
                        let mId = item.id;
                        let mName = item.name || 'Imported Map';
                        if (!mId || camp.maps[mId]) {
                            mId = `map_${campaignId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                            mName = `${mName} (Copy)`;
                        }
                        camp.maps[mId] = { ...item, id: mId, name: mName };
                        if (!camp.mapOrder) camp.mapOrder = Object.keys(camp.maps).filter((id) => id !== mId);
                        if (!camp.mapOrder.includes(mId)) camp.mapOrder.push(mId);
                        importedIds.push(mId);
                    } else if (
                        entityType === 'table' ||
                        entityType === 'deck' ||
                        item._entityCategory === 'customTable' ||
                        item._entityCategory === 'assetTable' ||
                        item._entityCategory === 'cardDeck' ||
                        item.isAssetTable ||
                        item.sides ||
                        item.cards ||
                        (item.dice && item.rows)
                    ) {
                        if (!camp.rollTables) camp.rollTables = {};
                        if (item.isAssetTable || item.sides || item._entityCategory === 'assetTable') {
                            if (!camp.rollTables.assetTables) camp.rollTables.assetTables = [];
                            let tId = item.id;
                            let tName = item.name || 'Imported Asset Table';
                            if (!tId || camp.rollTables.assetTables.some((t) => t.id === tId)) {
                                tId = `asset_table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                tName = `${tName} (Copy)`;
                            }
                            const cloned = { ...item, id: tId, name: tName, isAssetTable: true };
                            delete cloned._entityCategory;
                            camp.rollTables.assetTables.push(cloned);
                            importedIds.push(tId);
                        } else if (item.cards || item._entityCategory === 'cardDeck') {
                            if (!Array.isArray(camp.rollTables.decks)) {
                                camp.rollTables.decks = Array.isArray(camp.rollTables.cardDecks)
                                    ? [...camp.rollTables.cardDecks]
                                    : [];
                            }
                            let dId = item.id;
                            let dName = item.name || 'Imported Card Deck';
                            if (!dId || camp.rollTables.decks.some((d) => d.id === dId)) {
                                dId = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                dName = `${dName} (Copy)`;
                            }
                            const cloned = { ...item, id: dId, name: dName };
                            delete cloned._entityCategory;
                            camp.rollTables.decks.push(cloned);
                            camp.rollTables.cardDecks = camp.rollTables.decks;
                            importedIds.push(dId);
                        } else {
                            if (!Array.isArray(camp.rollTables.tables)) {
                                camp.rollTables.tables = Array.isArray(camp.rollTables.customTables)
                                    ? [...camp.rollTables.customTables]
                                    : [];
                            }
                            let tId = item.id;
                            let tName = item.name || 'Imported Roll Table';
                            if (!tId || camp.rollTables.tables.some((t) => t.id === tId)) {
                                tId = `table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                tName = `${tName} (Copy)`;
                            }
                            const cloned = { ...item, id: tId, name: tName };
                            delete cloned._entityCategory;
                            camp.rollTables.tables.push(cloned);
                            camp.rollTables.customTables = camp.rollTables.tables;
                            importedIds.push(tId);
                        }
                    } else {
                        let cId = item.id;
                        let cName = item.name || 'Imported Character';
                        if (!cId || camp.characters[cId]) {
                            cId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                            cName = `${cName} (Copy)`;
                        }
                        camp.characters[cId] = { ...item, id: cId, name: cName };
                        importedIds.push(cId);
                    }
                }
                fs.writeFileSync(campFile, JSON.stringify(all, null, 2), 'utf8');
                resData = { success: true, count: importedIds.length, importedIds, campaign: camp };
            }
        }

        if (resData && resData.success) {
            appendLog(`[Import] Successfully imported ${resData.count} item(s) into campaign ${campaignId}`);
            return resData;
        }
        return { success: false, error: resData?.error || 'Failed to import entity' };
    } catch (err) {
        appendLog(`[Import Error] Failed importing entity: ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
});

// Database Sources & Homebrew Management IPC
ipcMain.handle('sources-get-all', (_, campaignId) => {
    return sourceManager.getAllSources(campaignId);
});

ipcMain.handle('sources-toggle', async (_, { code, enabled, campaignId }) => {
    const result = sourceManager.toggleSource(code, enabled, campaignId);
    await syncSourcesToServer();
    appendLog(
        `[Sources] Set source ${code} to ${enabled ? 'Enabled' : 'Disabled'}${campaignId ? ` for campaign ${campaignId}` : ' globally'}.`
    );
    return result;
});

ipcMain.handle('sources-batch-toggle', async (_, { codes, enabled, campaignId }) => {
    const result = sourceManager.batchToggle(codes, enabled, campaignId);
    await syncSourcesToServer();
    appendLog(`[Sources] Bulk set ${result.count} sources to ${enabled ? 'Enabled' : 'Disabled'}.`);
    return result;
});

ipcMain.handle('sources-toggle-partnered', async (_, { enabled, campaignId }) => {
    const result = sourceManager.togglePartnered(enabled, campaignId);
    await syncSourcesToServer();
    appendLog(`[Sources] ${enabled ? 'Enabled' : 'Disabled'} all Partnered sources (${result.count} sources updated).`);
    return result;
});

ipcMain.handle('sources-toggle-ua', async (_, { enabled, campaignId }) => {
    const result = sourceManager.toggleUA(enabled, campaignId);
    await syncSourcesToServer();
    appendLog(
        `[Sources] ${enabled ? 'Enabled' : 'Disabled'} all Unearthed Arcana (UA) sources (${result.count} sources updated).`
    );
    return result;
});

ipcMain.handle('sources-save-ui-state', (_, uiState) => {
    return sourceManager.saveUiState(uiState);
});

ipcMain.handle('sources-apply-preset', async (_, { preset, campaignId }) => {
    const result = sourceManager.applyPreset(preset, campaignId);
    await syncSourcesToServer();
    appendLog(`[Sources] Applied preset '${preset}'${campaignId ? ` to campaign ${campaignId}` : ' globally'}.`);
    return result;
});

ipcMain.handle('sources-get-details', (_, { category, code }) => {
    return sourceManager.getSourceDetails(category, code);
});

ipcMain.handle('sources-save-details', async (_, data) => {
    const result = sourceManager.saveSourceDetails(data);
    if (result.success) {
        await syncSourcesToServer();
        appendLog(`[Sources] Saved changes to database source ${data.code} (${data.category}).`);
    }
    return result;
});

ipcMain.handle('sources-add-file', async (_, { category }) => {
    if (!mainWindow) return { canceled: true };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: `Add Database File for ${category}`,
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return { canceled: true };
    }

    const result = sourceManager.addDatabaseFile({ category, filePath: filePaths[0] });
    if (result.success) {
        await syncSourcesToServer();
        appendLog(
            `[Sources] Successfully imported database file '${filePaths[0]}' as source '${result.source.code}' into ${category}.`
        );
    }
    return result;
});

ipcMain.handle('sources-create-custom', async (_, data) => {
    const result = sourceManager.createCustomSource(data);
    if (result.success) {
        await syncSourcesToServer();
        appendLog(
            `[Sources] Created new custom source '${result.source.code}' in category '${result.source.category}'.`
        );
    }
    return result;
});

ipcMain.handle('sources-delete-custom', async (_, { category, code }) => {
    const result = sourceManager.deleteCustomSource(category, code);
    if (result.success) {
        await syncSourcesToServer();
        appendLog(`[Sources] Deleted custom source '${code}' from category '${category}'.`);
    }
    return result;
});

ipcMain.handle('sources-reveal-file', (_, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
    }
    return { success: false, error: 'File path not found' };
});

ipcMain.handle('sources-search-compendium', (_, { category, query, limit }) => {
    return sourceManager.searchCompendium(category, query, limit || 50);
});

ipcMain.handle('sources-get-entity-full', (_, { category, name, source }) => {
    return sourceManager.getEntityFullData(category, name, source);
});

ipcMain.handle('sources-export', async (_, { category, code }) => {
    if (!mainWindow) return { canceled: true };
    const cleanCode = (code || 'SOURCE').toUpperCase();
    const defaultFileName = `${cleanCode}-Compendium.json`;

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${cleanCode} Sourcebook`,
        defaultPath: path.join(appConfig.campaignDataDir, defaultFileName),
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (canceled || !filePath) return { canceled: true };
    return sourceManager.exportSource(category, code, filePath);
});

ipcMain.handle('sources-select-asset', async () => {
    if (!mainWindow) return { canceled: true };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Token or Artwork Image',
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return { canceled: true };
    }

    const saved = sourceManager.saveAssetImage(filePaths[0]);
    return {
        ...saved,
        filePath: saved?.webPath || saved?.localPath
    };
});

ipcMain.handle('sources-search-global', (_, { query, category, limit }) => {
    return sourceManager.searchAllCompendium(query, { category, limit });
});

ipcMain.handle('sources-get-preview', (_, { category, name, source }) => {
    return sourceManager.getFormattedStatblock(category, name, source);
});

ipcMain.handle('sources-select-import-files', async () => {
    if (!mainWindow) return { canceled: true };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Sourcebook JSON or ZIP Files',
        filters: [
            { name: 'Compendium Files (*.json, *.zip)', extensions: ['json', 'zip'] },
            { name: 'JSON Files (*.json)', extensions: ['json'] },
            { name: 'ZIP Archives (*.zip)', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return { canceled: true };
    }
    return { success: true, filePaths };
});

ipcMain.handle('sources-select-import-folder', async () => {
    if (!mainWindow) return { canceled: true };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Sourcebook Folder',
        properties: ['openDirectory']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return { canceled: true };
    }
    return { success: true, folderPath: filePaths[0] };
});

ipcMain.handle('sources-inspect-bulk', (_, { paths }) => {
    return sourceManager.inspectImportFiles(paths);
});

ipcMain.handle('sources-execute-bulk-import', async (_, { candidates, conflictDecisions }) => {
    const res = sourceManager.bulkImportSources(candidates, conflictDecisions);
    if (res && res.success) {
        // Notify local express server to broadcast sources update to any connected VTTs
        await syncSourcesToServer();
        appendLog(`[Sources] Bulk imported sources and synchronized with server.`);
    }
    return res;
});

ipcMain.handle('sources-reset-campaign', async (_, campaignId) => {
    const result = sourceManager.resetCampaignSources(campaignId);
    await syncSourcesToServer();
    appendLog(`[Sources] Reset sourcebook overrides to global defaults for campaign ${campaignId}.`);
    return result;
});

ipcMain.handle('sources-import-from-url', async (_, payload) => {
    const { url, ...metadata } = payload || {};
    const res = await sourceManager.importFromUrl(url, metadata);
    if (res && res.success) {
        await syncSourcesToServer();
        appendLog(`[Sources] Successfully imported sourcebook from URL: ${url}`);
    }
    return res;
});

ipcMain.handle('sources-sync-to-server', async () => {
    await syncSourcesToServer();
    appendLog('[Sources] Explicitly synchronized source filters and custom homebrew with VTT.');
    return { success: true };
});

// App Lifecycle
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

app.whenReady().then(async () => {
    try {
        if (session.defaultSession) {
            await session.defaultSession.clearCache();
        }
    } catch (e) {
        console.error('Failed to clear Electron cache on startup:', e);
    }
    createWindow();
    createTray();

    // Start default STUN P2P room session only once GM credentials are configured, and wire status updates
    if (hasConfiguredGmCredentials()) {
        p2pBridge.startRoom();
    }
    p2pBridge.on('peer:connected', () => notifyStatusChange());
    p2pBridge.on('peer:disconnected', () => notifyStatusChange());

    // Auto-start server on app boot
    await startServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

let isGracefulQuitDone = false;
app.on('before-quit', async (e) => {
    if (isGracefulQuitDone) return;
    e.preventDefault();
    app.isQuitting = true;
    stopTunnel();
    await stopServer();
    isGracefulQuitDone = true;
    app.quit();
});

app.on('window-all-closed', (e) => {
    // Prevent quitting when window is closed, keep running in system tray
    if (process.platform !== 'darwin') {
        e.preventDefault();
    }
});
