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
  extractSubdomain,
  getOrCreateCampaign,
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
import { initSocketServer, broadcastCampaignSync } from './server/socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 5e7, // 50MB: prevents packet overflow disconnections for large maps/drawings
  pingTimeout: 60000,     // 60s: protects against background tab throttling / sleep wake
  pingInterval: 25000     // 25s heartbeat
});

// Global Process Error Handlers
process.on('uncaughtException', (err) => {
  console.error('[Server Error] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Performance & Parsing Middleware
app.use(compression());
app.use(cors());
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

// Desktop App Installer Download Routes
app.get(['/download/installer', '/download/latest', '/download/setup', '/download/ForgeDVTT-Setup.exe'], (req, res) => {
  const distDir = path.join(rootDir, 'dist');
  
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const setupFile = files.find(f => f.toLowerCase().endsWith('.exe') && !f.includes('uninstaller'));
    if (setupFile) {
      const fullPath = path.join(distDir, setupFile);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.download(fullPath, setupFile);
    }
  }

  const rootSetup = path.join(rootDir, 'ForgeDVTT-Setup-1.0.0.exe');
  if (fs.existsSync(rootSetup)) {
    return res.download(rootSetup, 'ForgeDVTT-Setup-1.0.0.exe');
  }

  return res.redirect('https://github.com/lovemurgod/DnDForged/releases/download/v1.0.0/ForgeDVTT-Setup-1.0.0.exe');
});

// Uploads with per-campaign subdomain isolation, strict path validation & legacy fallbacks
app.use('/vtt-uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
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
  const sub = typeof rawCamp === 'string' ? rawCamp.trim() : null;

  // 1. Check campaign-specific uploads directory if campaign or subdomain is active
  if (sub) {
    const subDir = path.join(DATA_DIR, 'campaigns', sub, 'uploads');
    const subFilePath = path.resolve(subDir, relPath);
    if (isValidAssetPath(subFilePath, subDir) && fs.existsSync(subFilePath) && fs.statSync(subFilePath).isFile()) {
      return res.sendFile(subFilePath);
    }
  }

  // 2. Check root UPLOADS_DIR
  const globalFilePath = path.resolve(UPLOADS_DIR, relPath);
  if (isValidAssetPath(globalFilePath, UPLOADS_DIR) && fs.existsSync(globalFilePath) && fs.statSync(globalFilePath).isFile()) {
    return res.sendFile(globalFilePath);
  }

  // 3. Fallback: check across any campaign uploads directory
  const campaignsDir = path.join(DATA_DIR, 'campaigns');
  if (fs.existsSync(campaignsDir)) {
    try {
      const dirs = fs.readdirSync(campaignsDir);
      for (const dir of dirs) {
        const candDir = path.join(campaignsDir, dir, 'uploads');
        const cand = path.resolve(candDir, relPath);
        if (isValidAssetPath(cand, candDir) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          return res.sendFile(cand);
        }
      }
    } catch (e) {}
  }

  res.status(404).send('Upload file not found');
});

// Static assets directory
app.use('/assets', express.static(ASSETS_DIR, { maxAge: '2h', etag: true, lastModified: true }));

// Cross-wire module listeners
registerCompendiumInvalidator(invalidateCompendiumCaches);
registerCampaignBroadcaster(broadcastCampaignSync);

// Mount Subsystem Routers
app.use(compendiumRouter);
app.use(imageRouter);
app.use('/api', adminRouter);
app.use('/api', mediaRouter);
app.use('/api', campaignsRouter);
app.use('/api', assetsRouter);

// Explicitly neutralize legacy Service Worker requests so clients never re-cache stale assets
app.get(['/sw.js', '/vtt/sw.js', '/sw-injector.js'], (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  res.send('self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", () => { self.registration.unregister(); self.clients.matchAll().then(clients => clients.forEach(c => c.navigate(c.url))); });');
});

// Frontend App Routes
app.get(['/', '/index.html', '/vtt', '/vtt/', '/vtt.html', '/vtt/index.html'], (req, res) => {
  const sub = extractSubdomain(req.headers.host);
  if (sub) {
    getOrCreateCampaign(sub);
  }
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  return res.sendFile(path.join(VTT_DIR, 'index.html'));
});

app.get(['/sheet', '/sheet.html', '/vtt/sheet', '/vtt/sheet.html'], (req, res) => {
  const sub = extractSubdomain(req.headers.host);
  if (sub) {
    getOrCreateCampaign(sub);
  }
  return res.sendFile(path.join(VTT_DIR, 'sheet.html'));
});

// Static cache options for client assets
const STATIC_CACHE_OPTS = { maxAge: '2h', etag: true, lastModified: true };
const CODE_CACHE_OPTS = { maxAge: 0, etag: true, lastModified: true };
const LIB_CACHE_OPTS = { maxAge: '24h', etag: true, lastModified: true };

// Serve standalone ForgeDVTT client data statically with compression & caching
app.use(['/data', '/vtt/data'], express.static(VTT_DATA_DIR, STATIC_CACHE_OPTS));
app.use(['/data', '/vtt/data'], (req, res, next) => {
  const relPath = req.path.replace(/^[/\\]+/, '');
  const target = path.join(VTT_DATA_DIR, relPath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return res.sendFile(target, { maxAge: '2h', etag: true });
  }
  next();
});

app.use('/vtt', express.static(VTT_DIR, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath && (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.mjs'))) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

app.get(['/vtt', '/vtt/', '/vtt.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(VTT_DIR, 'index.html'));
});

// Static fallbacks for root requests (/vtt.html, /) so relative assets resolve cleanly
app.use('/css', express.static(path.join(VTT_DIR, 'css'), STATIC_CACHE_OPTS));
app.use('/js', express.static(path.join(VTT_DIR, 'js'), CODE_CACHE_OPTS));
app.use('/lib', express.static(path.join(VTT_DIR, 'lib'), LIB_CACHE_OPTS));
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
    process.exit(0);
  }, 50);
});

// Boot the server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5050;
httpServer.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`  ForgeD VTT Local Server running on port ${PORT}`);
  console.log(`  Access Local Host: http://localhost:${PORT}/vtt.html`);
  console.log(`======================================================\n`);
});

// Graceful exit flush: ensure debounced campaign writes are committed before termination
function flushAndExit(signal) {
  console.log(`[Server] Received ${signal}. Flushing pending campaign state to disk...`);
  try {
    saveCampaigns(true);
    saveChat(true);
  } catch (e) {
    console.error('[Server] Error during exit flush:', e);
  }
  process.exit(0);
}
process.on('SIGTERM', () => flushAndExit('SIGTERM'));
process.on('SIGINT', () => flushAndExit('SIGINT'));

export { app, httpServer, io };
