/**
 * ForgeDVTT Local Server
 * Clean entrypoint modularized from the original monolithic architecture.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import compression from 'compression';

import {
  rootDir,
  DATA_DIR,
  UPLOADS_DIR,
  ASSETS_DIR,
  VTT_DIR,
  VTT_DATA_DIR,
  TUNNEL_ROOT_DOMAINS,
  campaigns,
  extractSubdomain,
  getOrCreateCampaign,
  isAuthorizedGmOrSecret,
  isLocalOriginUrl,
  isValidAssetPath,
  isLoopbackRequest,
  SERVER_INTERNAL_SECRET,
  saveCampaigns,
  saveChat
} from './server/state.js';

import { compendiumRouter, invalidateCompendiumCaches } from './server/routes/compendium.js';
import { mediaRouter, imageRouter } from './server/routes/media.js';
import { adminRouter, registerCompendiumInvalidator } from './server/routes/admin.js';
import { campaignsRouter, registerCampaignBroadcaster } from './server/routes/campaigns.js';
import { assetsRouter } from './server/routes/assets.js';
import { sourcesRouter, registerSourcesCompendiumInvalidator } from './server/routes/sources.js';
import { initSocketServer, broadcastCampaignSync } from './server/socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isHostMatch(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

function isAllowedTunnelOrigin(origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const h = parsed.hostname.toLowerCase();
    return TUNNEL_ROOT_DOMAINS.some((domain) => isHostMatch(h, domain));
  } catch {
    return false;
  }
}

function isAllowedWebOrigin(origin, requestHost) {
  if (!origin) return true;
  if (isLocalOriginUrl(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const reqHostLower = requestHost ? String(requestHost).toLowerCase() : '';
    if (reqHostLower && parsed.host.toLowerCase() === reqHostLower) return true;
    const h = parsed.hostname.toLowerCase();
    return isHostMatch(h, 'forgedvtt.com');
  } catch {
    return false;
  }
}

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => cb(null, isAllowedWebOrigin(origin, null) || isAllowedTunnelOrigin(origin)),
    methods: ["GET", "POST"]
  },
  allowRequest: (req, cb) => {
    const allowed = isAllowedWebOrigin(req.headers.origin, req.headers.host);
    cb(null, allowed);
  },
  perMessageDeflate: { threshold: 1024 },
  maxHttpBufferSize: 5e7, // 50MB: prevents packet overflow disconnections for large maps/drawings
  pingTimeout: 60000,     // 60s: protects against background tab throttling / sleep wake
  pingInterval: 25000     // 25s heartbeat
});

// Global Process Error Handlers
process.on('uncaughtException', (err) => {
  console.error('[Server Error] Uncaught Exception:', err);
  flushAndExit('uncaughtException', 1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Performance & Parsing Middleware
app.use(compression());
app.use((req, res, next) => {
  cors({
    origin: (origin, cb) => cb(null, isAllowedWebOrigin(origin, req.headers.host)),
    credentials: true
  })(req, res, next);
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Browser caching & ETag validation for JS and CSS files
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=7200, must-revalidate');
    }
  }
  next();
});

function parseInstallerSemver(filename) {
  const m = String(filename || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function findLatestInstaller() {
  const searchDirs = [path.join(rootDir, 'dist-srd'), path.join(rootDir, 'dist'), rootDir];
  const candidates = [];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const f of fs.readdirSync(dir)) {
        const lower = f.toLowerCase();
        if (lower.endsWith('.exe') && lower.includes('setup') && !lower.includes('uninstaller')) {
          candidates.push({
            dir,
            file: f,
            fullPath: path.join(dir, f),
            ver: parseInstallerSemver(f),
            priority: dir === path.join(rootDir, 'dist-srd') ? 2 : dir === path.join(rootDir, 'dist') ? 1 : 0
          });
        }
      }
    } catch (_) {}
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (b.ver[i] !== a.ver[i]) return b.ver[i] - a.ver[i];
    }
    return b.priority - a.priority;
  });
  return candidates[0] || null;
}

// Desktop App Installer Download Routes
app.get(['/download/installer', '/download/latest', '/download/setup', '/download/ForgeDVTT-Setup.exe'], (req, res) => {
  const latest = findLatestInstaller();
  if (latest && fs.existsSync(latest.fullPath)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.download(latest.fullPath, latest.file);
  }

  return res.redirect('https://github.com/lovemurgod/DnDForged/releases/download/1.5.0/ForgeDVTT-Setup-1.5.0.exe');
});

// Uploads with per-campaign subdomain isolation, strict path validation & legacy fallbacks
app.use('/vtt-uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).send('Bad Request: Malformed URI');
  }

  // Guard against directory traversal, null bytes, and path escapes
  if (req.path.includes('..') || decodedPath.includes('..') || req.path.includes('\0') || decodedPath.includes('\0')) {
    console.warn(`[Security] Blocked path traversal attempt on /vtt-uploads: ${req.path}`);
    return res.status(403).send('Forbidden: Invalid upload path');
  }

  const relPath = decodedPath.replace(/^[/\\]+/, '');
  const rawCamp = extractSubdomain(req.headers.host) || req.query.campaignId || req.headers['x-campaign-id'];
  const sub = typeof rawCamp === 'string' ? rawCamp.replace(/[^a-zA-Z0-9_-]/g, '').trim() : '';

  // 1. Check campaign-specific uploads directory if campaign or subdomain is active
  const campaignsRoot = path.resolve(DATA_DIR, 'campaigns');
  if (sub) {
    const subDir = path.resolve(campaignsRoot, sub, 'uploads');
    const subFilePath = path.resolve(subDir, relPath);
    if (
      isValidAssetPath(subDir, campaignsRoot) &&
      isValidAssetPath(subFilePath, subDir) &&
      fs.existsSync(subFilePath) &&
      fs.statSync(subFilePath).isFile()
    ) {
      return res.sendFile(subFilePath);
    }
  }

  // 2. Check root UPLOADS_DIR (and campaign uploads folders safely when no explicit campaign was specified)
  const globalFilePath = path.resolve(UPLOADS_DIR, relPath);
  if (isValidAssetPath(globalFilePath, UPLOADS_DIR) && fs.existsSync(globalFilePath) && fs.statSync(globalFilePath).isFile()) {
    return res.sendFile(globalFilePath);
  }

  if (!sub) {
    const defaultUploadsDir = path.join(campaignsRoot, 'default', 'uploads');
    const defaultFilePath = path.resolve(defaultUploadsDir, relPath);
    if (isValidAssetPath(defaultFilePath, defaultUploadsDir) && fs.existsSync(defaultFilePath) && fs.statSync(defaultFilePath).isFile()) {
      return res.sendFile(defaultFilePath);
    }
    if (fs.existsSync(campaignsRoot)) {
      try {
        for (const entry of fs.readdirSync(campaignsRoot, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name === 'default') continue;
          const campUploadsDir = path.resolve(campaignsRoot, entry.name, 'uploads');
          const campFilePath = path.resolve(campUploadsDir, relPath);
          if (
            isValidAssetPath(campFilePath, campUploadsDir) &&
            fs.existsSync(campFilePath) &&
            fs.statSync(campFilePath).isFile()
          ) {
            return res.sendFile(campFilePath);
          }
        }
      } catch (err) {
        console.warn('[Uploads] Failed scanning campaign upload folders:', err.message);
      }
    }
  }

  res.status(404).send('Upload file not found');
});

// Static assets directory (enforce nosniff and sandbox player uploads against active HTML/SVG script execution)
app.use('/assets/players', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
  next();
});
let cachedAssetsDir = null;
let cachedAssetsStatic = null;
app.use('/assets', (req, res, next) => {
  if (cachedAssetsDir !== ASSETS_DIR || !cachedAssetsStatic) {
    cachedAssetsDir = ASSETS_DIR;
    cachedAssetsStatic = express.static(ASSETS_DIR, {
      maxAge: '2h',
      etag: true,
      lastModified: true,
      setHeaders: (r) => {
        r.setHeader('X-Content-Type-Options', 'nosniff');
        r.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
      }
    });
  }
  return cachedAssetsStatic(req, res, next);
});

// Cross-wire module listeners
registerCompendiumInvalidator(invalidateCompendiumCaches);
registerSourcesCompendiumInvalidator(invalidateCompendiumCaches);
registerCampaignBroadcaster(broadcastCampaignSync);

// Mount Subsystem Routers
app.use(compendiumRouter);
app.use(imageRouter);
app.use('/api', adminRouter);
app.use('/api', mediaRouter);
app.use('/api', campaignsRouter);
app.use('/api', assetsRouter);
app.use('/api', sourcesRouter);

// Explicitly neutralize legacy Service Worker requests so clients never re-cache stale assets
app.get(['/sw.js', '/vtt/sw.js', '/sw-injector.js'], (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  res.send('self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", () => { self.registration.unregister(); self.clients.matchAll().then(clients => clients.forEach(c => c.navigate(c.url))); });');
});

// Prep Control Center Web Routes (/prep)
const PREP_UI_DIR = path.join(rootDir, 'electron', 'ui');
app.get('/prep/icon.png', (req, res) => {
  const iconPath = path.join(rootDir, 'electron', 'icon.png');
  if (fs.existsSync(iconPath)) return res.sendFile(iconPath);
  return res.status(404).end();
});
app.get(['/prep', '/prep/'], (req, res) => {
  if (req.path === '/prep') {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(302, `/prep/${qs}`);
  }
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  return res.sendFile(path.join(PREP_UI_DIR, 'index.html'));
});
app.use('/prep', express.static(PREP_UI_DIR, {
  maxAge: 0,
  etag: true,
  lastModified: true
}));

// Frontend App Routes (/play is canonical; /vtt.html, /vtt/, and / kept as aliases)
app.get(['/', '/index.html', '/play', '/play/', '/vtt', '/vtt/', '/vtt.html', '/vtt/index.html'], (req, res) => {
  const sub = extractSubdomain(req.headers.host);
  if (sub && (campaigns[sub] || isAuthorizedGmOrSecret(req))) {
    getOrCreateCampaign(sub);
  }
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  return res.sendFile(path.join(VTT_DIR, 'index.html'));
});

app.get(['/sheet', '/sheet.html', '/play/sheet', '/play/sheet.html', '/vtt/sheet', '/vtt/sheet.html'], (req, res) => {
  const sub = extractSubdomain(req.headers.host);
  if (sub && (campaigns[sub] || isAuthorizedGmOrSecret(req))) {
    getOrCreateCampaign(sub);
  }
  return res.sendFile(path.join(VTT_DIR, 'sheet.html'));
});

// Static cache options for client assets
const STATIC_CACHE_OPTS = { maxAge: '2h', etag: true, lastModified: true };
const CODE_CACHE_OPTS = { maxAge: '5m', etag: true, lastModified: true };
const LIB_CACHE_OPTS = { maxAge: '24h', etag: true, lastModified: true };

// Serve standalone ForgeDVTT client data statically with compression & caching
app.use(['/data', '/vtt/data', '/play/data'], express.static(VTT_DATA_DIR, STATIC_CACHE_OPTS));

// SRD CC0 Token fallback: serve .svg token cleanly when legacy .webp path is requested and .webp is absent
const tokensImgDir = path.join(VTT_DIR, 'img', 'bestiary', 'tokens');
app.use(['/img/bestiary/tokens', '/vtt/img/bestiary/tokens', '/play/img/bestiary/tokens'], (req, res, next) => {
  const reqPath = req.path || '';
  if (/\.webp$/i.test(reqPath)) {
    const rel = reqPath.replace(/^[/\\]+/, '');
    const webpTarget = path.resolve(tokensImgDir, rel);
    if (!isValidAssetPath(webpTarget, tokensImgDir)) {
      return res.status(403).send('Forbidden: Invalid token path');
    }
    if (!fs.existsSync(webpTarget)) {
      const svgTarget = webpTarget.replace(/\.webp$/i, '.svg');
      if (isValidAssetPath(svgTarget, tokensImgDir) && fs.existsSync(svgTarget) && fs.statSync(svgTarget).isFile()) {
        res.setHeader('Cache-Control', 'public, max-age=7200');
        return res.type('image/svg+xml').sendFile(svgTarget);
      }
    }
  }
  next();
});

const VTT_STATIC_MIDDLEWARE = express.static(VTT_DIR, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath && filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filePath && (filePath.endsWith('.js') || filePath.endsWith('.mjs'))) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  }
});
app.use('/vtt', VTT_STATIC_MIDDLEWARE);
app.use('/play', VTT_STATIC_MIDDLEWARE);

app.get(['/vtt', '/vtt/', '/vtt.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(VTT_DIR, 'index.html'));
});

// Static fallbacks for root requests (/vtt.html, /) so relative assets resolve cleanly
app.use('/css', express.static(path.join(VTT_DIR, 'css'), STATIC_CACHE_OPTS));
app.use('/js', express.static(path.join(VTT_DIR, 'js'), CODE_CACHE_OPTS));
app.use('/lib', express.static(path.join(VTT_DIR, 'lib'), LIB_CACHE_OPTS));
app.use(['/audio', '/vtt/audio', '/play/audio'], express.static(path.join(VTT_DIR, 'audio'), STATIC_CACHE_OPTS));
app.use(['/img', '/vtt/img'], express.static(path.join(VTT_DIR, 'img'), STATIC_CACHE_OPTS));

// Serve 5etools-src statically as optional companion / compendium if present
if (fs.existsSync(path.join(rootDir, '5etools-src'))) {
  app.use(express.static(path.join(rootDir, '5etools-src')));
}

// Initialize Realtime Socket.IO Server
initSocketServer(io);

// Graceful shutdown endpoint (local loopback and internal secret only)
app.post('/api/server/shutdown', (req, res) => {
  const secret = req.headers['x-server-secret'];
  if (!isLoopbackRequest(req) || !secret || secret !== SERVER_INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Unauthorized shutdown request' });
  }
  console.log('[Server] Authorized shutdown request received from local manager. Flushing state...');
  try {
    saveCampaigns(true);
    saveChat(true);
  } catch (e) {
    console.error('[Server] Error flushing state during shutdown request:', e);
  }
  res.json({ success: true, message: 'Server flushed and terminating' });
  setTimeout(() => {
    try {
      io.close();
    } catch (_) {}
    try {
      httpServer.close(() => process.exit(0));
    } catch (_) {
      process.exit(0);
    }
    setTimeout(() => process.exit(0), 500).unref();
  }, 50);
});

// Boot the server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5050;

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server Error] Port ${PORT} is already in use (EADDRINUSE).`);
    process.exit(98);
  } else {
    console.error('[Server Error] HTTP Server Error:', err);
    process.exit(1);
  }
});

httpServer.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`  ForgeD VTT Local Server running on port ${PORT}`);
  console.log(`  Access Local Host: http://localhost:${PORT}/vtt.html`);
  console.log(`======================================================\n`);
});

// Graceful exit flush: ensure debounced campaign writes are committed before termination
function flushAndExit(signal, exitCode = 0) {
  console.log(`[Server] Received ${signal}. Flushing pending campaign state to disk...`);
  try {
    saveCampaigns(true);
    saveChat(true);
  } catch (e) {
    console.error('[Server] Error during exit flush:', e);
  }
  try {
    io.close();
  } catch (_) {}
  try {
    httpServer.close(() => process.exit(exitCode));
  } catch (_) {
    process.exit(exitCode);
  }
  setTimeout(() => process.exit(exitCode), 500).unref();
}
process.on('SIGTERM', () => flushAndExit('SIGTERM'));
process.on('SIGINT', () => flushAndExit('SIGINT'));

export { app, httpServer, io };
