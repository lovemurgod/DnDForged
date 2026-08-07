import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

import multer from 'multer';
import cors from 'cors';
import { createCampaignTemplate, updateMapProperty, isValidAssetPath } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Campaign data persistence directories
const DATA_DIR = process.env.FORGEDVTT_DATA_DIR || path.join(__dirname, '.dndforged-data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat-log.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ASSETS_DIR = path.join(DATA_DIR, 'assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

const DISCORD_CACHE_DIR = path.join(DATA_DIR, 'discord-cache');
if (!fs.existsSync(DISCORD_CACHE_DIR)) fs.mkdirSync(DISCORD_CACHE_DIR, { recursive: true });

// Helper to extract subdomain slug from Host header
function extractSubdomain(hostHeader) {
  if (!hostHeader) return null;
  const host = hostHeader.split(':')[0].toLowerCase().trim();
  if (host === 'localhost' || host === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return null;
  }
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub && sub !== 'www' && sub !== 'api') return sub;
  } else if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }
  return null;
}

// Desktop app installer download routes
app.get(['/download/installer', '/download/latest', '/download/setup', '/download/ForgeDVTT-Setup.exe'], (req, res) => {
  const distDir = path.join(__dirname, 'dist');
  
  // 1. Search dist/ directory for installer executable
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const setupFile = files.find(f => f.toLowerCase().endsWith('.exe') && !f.includes('uninstaller'));
    if (setupFile) {
      const fullPath = path.join(distDir, setupFile);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.download(fullPath, setupFile);
    }
  }

  // 2. Search root directory fallback
  const rootSetup = path.join(__dirname, 'ForgeDVTT-Setup-1.0.0.exe');
  if (fs.existsSync(rootSetup)) {
    return res.download(rootSetup, 'ForgeDVTT-Setup-1.0.0.exe');
  }

  // 3. Fallback: redirect directly to published GitHub release installer asset
  return res.redirect('https://github.com/lovemurgod/DnDForged/releases/download/v1.0.0/ForgeDVTT-Setup-1.0.0.exe');
});

// Setup file upload engine for maps and tokens (per-campaign subdomain isolated)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = extractSubdomain(req.headers.host) || req.body.campaignId || 'default';
    const targetDir = path.join(DATA_DIR, 'campaigns', sub, 'uploads');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Custom storage for assets to support subfolders
const assetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let targetPath = ASSETS_DIR;
    if (req.body.folderPath) {
      targetPath = path.join(ASSETS_DIR, req.body.folderPath);
    }
    // Prevent directory traversal
    if (!isValidAssetPath(targetPath, ASSETS_DIR)) return cb(new Error("Invalid path"));
    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
    cb(null, targetPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep original name
  }
});
const assetUpload = multer({ storage: assetStorage });

// Serve custom uploads with per-campaign subdomain isolation & legacy fallbacks
app.use('/vtt-uploads', (req, res, next) => {
  const sub = extractSubdomain(req.headers.host);
  const relPath = req.path;

  // 1. Check campaign-specific uploads directory if subdomain is active
  if (sub) {
    const subFilePath = path.join(DATA_DIR, 'campaigns', sub, 'uploads', relPath);
    if (fs.existsSync(subFilePath) && fs.statSync(subFilePath).isFile()) {
      return res.sendFile(subFilePath);
    }
  }

  // 2. Check root UPLOADS_DIR
  const globalFilePath = path.join(UPLOADS_DIR, relPath);
  if (fs.existsSync(globalFilePath) && fs.statSync(globalFilePath).isFile()) {
    return res.sendFile(globalFilePath);
  }

  // 3. Fallback: check across any campaign uploads directory
  const campaignsDir = path.join(DATA_DIR, 'campaigns');
  if (fs.existsSync(campaignsDir)) {
    try {
      const dirs = fs.readdirSync(campaignsDir);
      for (const dir of dirs) {
        const cand = path.join(campaignsDir, dir, 'uploads', relPath);
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          return res.sendFile(cand);
        }
      }
    } catch (e) {}
  }

  res.status(404).send('Upload file not found');
});

app.use('/assets', express.static(ASSETS_DIR));

// Middleware: If a request for /img/* results in a 404 locally,
// redirect/proxy it to the official 5etools CDN to load it instantly!
app.get('/img/*', (req, res, next) => {
  const localPath = path.join(__dirname, '5etools-src', req.path);
  if (fs.existsSync(localPath)) {
    return next(); // File exists locally, let static middleware handle it
  }
  // Redirect to official 5etools image CDN mirror
  const remoteUrl = `https://5e.tools${req.path}`;
  res.redirect(remoteUrl);
});

// Proxy for Discord CDN to bypass expiring signatures
app.get('/api/proxy-discord', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || (!targetUrl.includes('discordapp.com') && !targetUrl.includes('discordapp.net'))) {
    return res.status(400).send('Invalid Discord URL');
  }

  const hash = crypto.createHash('md5').update(targetUrl).digest('hex');
  const extMatch = targetUrl.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
  const ext = extMatch ? `.${extMatch[1]}` : '';
  const cachedFilePath = path.join(DISCORD_CACHE_DIR, `${hash}${ext}`);

  if (fs.existsSync(cachedFilePath)) {
    return res.sendFile(cachedFilePath);
  }

  https.get(targetUrl, (response) => {
    if (response.statusCode === 200) {
      const fileStream = fs.createWriteStream(cachedFilePath);
      response.pipe(fileStream);
      response.pipe(res);
      
      fileStream.on('error', (err) => {
        console.error('Error writing to discord cache:', err);
      });
    } else {
      res.status(response.statusCode).send('Failed to fetch from Discord');
    }
  }).on('error', (err) => {
    res.status(500).send('Proxy error: ' + err.message);
  });
});

// Disable JS/CSS caching during development so browsers always load the latest files
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Route root / and /vtt.html
app.get('/', (req, res) => {
  const sub = extractSubdomain(req.headers.host);
  if (!sub) {
    return res.sendFile(path.join(__dirname, '5etools-src', 'launcher.html'));
  }
  res.redirect('/vtt.html');
});

app.get('/vtt.html', (req, res, next) => {
  const sub = extractSubdomain(req.headers.host);
  if (!sub) {
    return res.sendFile(path.join(__dirname, '5etools-src', 'launcher.html'));
  }
  getOrCreateCampaign(sub);
  return next();
});

// Serve 5etools-src statically
app.use(express.static(path.join(__dirname, '5etools-src')));

// In-memory campaign state backup
let campaigns = {};
let chatLogs = {};

// Helper to load database
function loadDatabase() {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
    } else {
      const defaultCampId = "default";
      campaigns = {
        [defaultCampId]: createCampaignTemplate(defaultCampId, "Default Campaign")
      };
      saveCampaigns();
    }

    // Auto-migrate campaigns to multiple maps schema if they are in the old format
    let migrated = false;
    Object.keys(campaigns).forEach(campId => {
      const c = campaigns[campId];
      if (!c.maps) {
        console.log(`[Database] Migrating campaign "${c.name}" (${campId}) to multiple maps system...`);
        const defaultMapId = `map_${campId}_default_${Date.now()}`;
        c.maps = {
          [defaultMapId]: {
            id: defaultMapId,
            name: "Initial Map",
            mapImage: c.mapImage || "",
            grid: c.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5 },
            tokens: c.tokens || {},
            walls: c.walls || [],
            lights: c.lights || [],
            shapes: c.shapes || {}
          }
        };
        c.activeMapId = defaultMapId;
        c.activeGMMapId = defaultMapId;

        // Clean up legacy keys
        delete c.mapImage;
        delete c.grid;
        delete c.tokens;
        delete c.walls;
        delete c.lights;
        delete c.shapes;

        migrated = true;
      }
      // Ensure activeGMMapId exists
      if (!c.activeGMMapId) {
        c.activeGMMapId = c.activeMapId;
        migrated = true;
      }
      // Ensure characters object exists
      if (!c.characters) {
        c.characters = {};
        migrated = true;
      }
      if (!c.allowedUsers) {
        c.allowedUsers = [];
        migrated = true;
      }
      if (!c.knownPlayers) {
        c.knownPlayers = [];
        migrated = true;
      }
    });
    if (migrated) {
      saveCampaigns();
    }

    if (fs.existsSync(CHAT_FILE)) {
      const parsedChat = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
      if (Array.isArray(parsedChat)) {
        // Migrate old array to object
        chatLogs = { "default": parsedChat };
        saveChat();
      } else {
        chatLogs = parsedChat;
      }
    } else {
      chatLogs = {};
      saveChat();
    }
  } catch (err) {
    console.error("Error loading local database:", err);
  }
}

let campaignsSaveTimeout = null;
let chatSaveTimeout = null;
const DEBOUNCE_MS = 2000;

function saveCampaigns(sync = false) {
  if (sync) {
    if (campaignsSaveTimeout) {
      clearTimeout(campaignsSaveTimeout);
      campaignsSaveTimeout = null;
    }
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), 'utf8');
    return;
  }
  
  if (campaignsSaveTimeout) clearTimeout(campaignsSaveTimeout);
  campaignsSaveTimeout = setTimeout(async () => {
    campaignsSaveTimeout = null;
    try {
      await fs.promises.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), 'utf8');
    } catch (err) {
      console.error("Failed to save campaigns async:", err);
    }
  }, DEBOUNCE_MS);
}

function saveChat(sync = false) {
  if (sync) {
    if (chatSaveTimeout) {
      clearTimeout(chatSaveTimeout);
      chatSaveTimeout = null;
    }
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chatLogs, null, 2), 'utf8');
    return;
  }

  if (chatSaveTimeout) clearTimeout(chatSaveTimeout);
  chatSaveTimeout = setTimeout(async () => {
    chatSaveTimeout = null;
    try {
      await fs.promises.writeFile(CHAT_FILE, JSON.stringify(chatLogs, null, 2), 'utf8');
    } catch (err) {
      console.error("Failed to save chat async:", err);
    }
  }, DEBOUNCE_MS);
}

// Graceful shutdown to flush pending writes synchronously
function gracefulShutdown() {
  console.log("Shutting down... flushing pending file writes.");
  saveCampaigns(true);
  saveChat(true);
  process.exit(0);
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

loadDatabase();

function getOrCreateCampaign(campId) {
  if (!campaigns[campId]) {
    const displayName = campId.charAt(0).toUpperCase() + campId.slice(1) + " Campaign";
    campaigns[campId] = createCampaignTemplate(campId, displayName);
    saveCampaigns();
  }
  return campaigns[campId];
}

// REST APIs
// Get campaign list
app.get('/api/campaigns', (req, res) => {
  const sub = extractSubdomain(req.headers.host);
  if (sub) {
    getOrCreateCampaign(sub);
  }
  res.json(Object.values(campaigns).map(c => ({ id: c.id, name: c.name })));
});

// Get detailed campaign state
app.get('/api/campaigns/:id', (req, res) => {
  const campaign = getOrCreateCampaign(req.params.id);
  res.json(campaign);
});

// Create new campaign
app.post('/api/campaigns', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Campaign name required" });
  const id = name.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
  campaigns[id] = createCampaignTemplate(id, name);
  saveCampaigns();
  res.json(campaigns[id]);
});

// Upload media file (map/token image)
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image provided" });
  const relativeUrl = `/vtt-uploads/${req.file.filename}`;
  res.json({ url: relativeUrl });
});

// Resolve media URL (e.g. Pinterest pin.it shortlinks, pinterest.com pin pages, shortlinks)
app.get('/api/resolve-media-url', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ error: "No URL provided" });
  }

  const cleanTarget = targetUrl.trim();
  
    // Fast check: if already direct video or YouTube
  const isVideoExt = !!cleanTarget.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || cleanTarget.includes('pinimg.com/videos');
  const isYoutube = cleanTarget.includes('youtube.com') || cleanTarget.includes('youtu.be');
  const isDirectImage = !!cleanTarget.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i);

  if (isVideoExt || isYoutube || (isDirectImage && !cleanTarget.includes('pin.it') && !cleanTarget.includes('pinterest.com/pin/'))) {
    return res.json({
      resolvedUrl: cleanTarget,
      isVideo: isVideoExt || isYoutube,
      isYoutube
    });
  }

  try {
    const fetchRes = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    const finalUrl = fetchRes.url || cleanTarget;
    const html = await fetchRes.text();

    // 1. Look for Pinterest video stream (v1.pinimg.com / v.pinimg.com / .mp4 matches)
    const pinVideoMatch = html.match(/(https?:\/\/[a-z0-9.]*pinimg\.com\/videos\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*)/i) ||
                          html.match(/(https?:\/\/[^\s"'<>\\]+\.mp4(?:\?[^\s"'<>\\]*)?)/i) ||
                          html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);

    if (pinVideoMatch && pinVideoMatch[1]) {
      let videoUrl = pinVideoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      return res.json({
        resolvedUrl: videoUrl,
        isVideo: true,
        originalUrl: targetUrl
      });
    }

    // 2. Look for high-res Pinterest image (i.pinimg.com/originals/...) or og:image
    const pinImageMatch = html.match(/(https:\/\/i\.pinimg\.com\/(?:originals|[0-9]+x)\/[^\s"'<>\\]+)/i) ||
                          html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i);

    if (pinImageMatch && pinImageMatch[1]) {
      let imageUrl = pinImageMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      // Try upgrading low-res thumbnail paths (e.g. 236x, 736x) to originals for full resolution
      imageUrl = imageUrl.replace(/\/i\.pinimg\.com\/[0-9]+x\//, '/i.pinimg.com/originals/');
      const isGif = imageUrl.toLowerCase().split('?')[0].endsWith('.gif');
      return res.json({
        resolvedUrl: imageUrl,
        isVideo: isGif,
        isGif,
        originalUrl: targetUrl
      });
    }

    // Fallback: return finalUrl after redirect
    const isFinalVideo = !!finalUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || finalUrl.includes('pinimg.com/videos');
    res.json({
      resolvedUrl: finalUrl,
      isVideo: isFinalVideo,
      originalUrl: targetUrl
    });
  } catch (err) {
    console.error('[resolve-media-url] Error resolving URL:', err.message);
    res.json({
      resolvedUrl: cleanTarget,
      isVideo: isVideoExt,
      error: err.message
    });
  }
});


// Recursively get directory structure for assets
function getAssetTree(dirPath, relativePath = '') {
  const result = { name: path.basename(dirPath) === 'assets' && relativePath === '' ? 'Root' : path.basename(dirPath), path: relativePath, type: 'folder', children: [] };
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    if (item.name === '_urls.json') continue; // Skip metadata
    
    if (item.isDirectory()) {
      result.children.push(getAssetTree(path.join(dirPath, item.name), path.join(relativePath, item.name).replace(/\\/g, '/')));
    } else {
      result.children.push({ name: item.name, path: path.join(relativePath, item.name).replace(/\\/g, '/'), type: 'file', url: `/assets/${path.join(relativePath, item.name).replace(/\\/g, '/')}` });
    }
  }
  
  // Load URLs
  const urlsFile = path.join(dirPath, '_urls.json');
  if (fs.existsSync(urlsFile)) {
    try {
      const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
      for (const u of urls) {
        result.children.push(u);
      }
    } catch (e) {}
  }
  return result;
}

// Asset Gallery APIs
app.get('/api/assets', (req, res) => {
  try {
    const tree = getAssetTree(ASSETS_DIR);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assets/folder', (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: "folderPath required" });
  const targetPath = path.join(ASSETS_DIR, folderPath);
  if (!isValidAssetPath(targetPath, ASSETS_DIR)) return res.status(403).json({ error: "Invalid path" });
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  res.json({ success: true, path: folderPath });
});

app.post('/api/assets/upload', assetUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  let relPath = req.file.originalname;
  if (req.body.folderPath) {
    relPath = path.join(req.body.folderPath, req.file.originalname).replace(/\\/g, '/');
  }
  res.json({ url: `/assets/${relPath}`, name: req.file.originalname });
});

async function processMediaUrl(url) {
  let finalUrl = url;
  
  // Try to parse YouTube URLs to Embed format
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
      let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1`;
      if (listMatch && listMatch[1]) {
          embedUrl += `&list=${listMatch[1]}`;
      } else {
          embedUrl += `&playlist=${videoId}`;
      }
      return embedUrl;
  }

  // Fast path: If it already looks like a direct media link, return it immediately
  if (url.match(/\.(mp4|webm|ogg|jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) {
      return url;
  }

  // For non-direct links, scrape for OpenGraph or structured data tags
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    // Pinterest specific matching (sometimes lacks extensions or uses contentUrl)
    const pinVideoMatch = html.match(/"contentUrl":"([^"]+\.mp4)"/i);
    const pinImageMatch = html.match(/"image":"([^"]+)"/i); // removed strict extension check for pin

    // Generic OpenGraph matching
    const ogVideoMatch = html.match(/<meta[^>]+property=["']og:video:secure_url["'][^>]*content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]+property=["']og:video["'][^>]*content=["']([^"']+)["']/i);
                         
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    
    if (pinVideoMatch && pinVideoMatch[1]) {
      finalUrl = pinVideoMatch[1].replace(/\\u002F/g, '/');
    } else if (ogVideoMatch && ogVideoMatch[1]) {
      finalUrl = ogVideoMatch[1].replace(/\\u002F/g, '/');
    } else if (pinImageMatch && pinImageMatch[1] && !pinImageMatch[1].includes('{')) {
      // make sure pinImageMatch is actually a URL and not a JSON object
      finalUrl = pinImageMatch[1].replace(/\\u002F/g, '/');
    } else if (ogImageMatch && ogImageMatch[1]) {
      finalUrl = ogImageMatch[1].replace(/\\u002F/g, '/');
    }
  } catch (e) {
    console.error(`Failed to scrape URL ${url}:`, e);
  }
  
  return finalUrl;
}

app.post('/api/player-token/url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });
  const finalUrl = await processMediaUrl(url);
  res.json({ url: finalUrl });
});

app.post('/api/assets/url', async (req, res) => {
  const { url, name, folderPath } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });
  
  const finalUrl = await processMediaUrl(url);

  const targetDir = folderPath ? path.join(ASSETS_DIR, folderPath) : ASSETS_DIR;
  if (!isValidAssetPath(targetDir, ASSETS_DIR)) return res.status(403).json({ error: "Invalid path" });
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  
  const urlsFile = path.join(targetDir, '_urls.json');
  let urls = [];
  if (fs.existsSync(urlsFile)) {
    urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
  }
  
  const newAsset = { name: name || 'External URL', url: finalUrl, type: 'url', path: folderPath ? `${folderPath}/${name || 'External URL'}` : (name || 'External URL') };
  urls.push(newAsset);
  fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
  
  res.json(newAsset);
});

app.post('/api/assets/delete', (req, res) => {
  const { path: relPath, isUrl, folderPath, name } = req.body;
  if (!relPath && !name) return res.status(400).json({ error: "Path or name required" });

  try {
    if (isUrl) {
      const targetDir = folderPath ? path.join(ASSETS_DIR, folderPath) : ASSETS_DIR;
      if (!isValidAssetPath(targetDir, ASSETS_DIR)) return res.status(403).json({ error: "Invalid path" });
      const urlsFile = path.join(targetDir, '_urls.json');
      if (fs.existsSync(urlsFile)) {
        let urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        urls = urls.filter(u => u.name !== name);
        fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
      }
      return res.json({ success: true });
    } else {
      const targetPath = path.join(ASSETS_DIR, relPath);
      if (!isValidAssetPath(targetPath, ASSETS_DIR)) return res.status(403).json({ error: "Invalid path" });
      if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isDirectory()) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(targetPath);
        }
      }
      return res.json({ success: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/assets/edit', (req, res) => {
  const { path: oldRelPath, newName, isUrl, folderPath, oldName, newUrl } = req.body;
  if (!newName) return res.status(400).json({ error: "New name required" });

  try {
    if (isUrl) {
      const targetDir = folderPath ? path.join(ASSETS_DIR, folderPath) : ASSETS_DIR;
      if (!isValidAssetPath(targetDir, ASSETS_DIR)) return res.status(403).json({ error: "Invalid path" });
      const urlsFile = path.join(targetDir, '_urls.json');
      if (fs.existsSync(urlsFile)) {
        let urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        const idx = urls.findIndex(u => u.name === oldName);
        if (idx !== -1) {
          urls[idx].name = newName;
          if (newUrl) urls[idx].url = newUrl;
          urls[idx].path = folderPath ? `${folderPath}/${newName}` : newName;
          fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
        }
      }
      return res.json({ success: true });
    } else {
      const oldPath = path.join(ASSETS_DIR, oldRelPath);
      const parentDir = path.dirname(oldPath);
      const newPath = path.join(parentDir, newName);
      
      if (!isValidAssetPath(oldPath, ASSETS_DIR) || !isValidAssetPath(newPath, ASSETS_DIR)) return res.status(403).json({ error: "Invalid path" });
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
      return res.json({ success: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Chat log endpoint
app.get('/api/chat', (req, res) => {
  const campaignId = req.query.campaignId || 'default';
  const log = chatLogs[campaignId] || [];
  res.json(log.slice(-100)); // Send last 100 entries
});

// WebSocket Synchronizer
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  const socketSubdomain = extractSubdomain(socket.handshake.headers.host);

  // Handle player/GM registration to a campaign room
  socket.on('join', ({ campaignId, username, role }) => {
    let targetCampaignId = campaignId || socketSubdomain || 'default';

    if (!campaigns[targetCampaignId]) {
      getOrCreateCampaign(targetCampaignId);
    }
    const activeCampId = targetCampaignId;

    // Auto-GM logic: first person to join the campaign becomes GM
    if (!campaigns[activeCampId].gmUsername) {
        if (role !== 'GM') {
            socket.emit('join_rejected', { reason: "The first person to join a new campaign must be the Game Master." });
            socket.disconnect(true);
            return;
        }
        campaigns[activeCampId].gmUsername = username;
        saveCampaigns();
    }

    if (role === 'GM' && campaigns[activeCampId].gmUsername && username !== campaigns[activeCampId].gmUsername) {
        socket.emit('join_rejected', { reason: "You are not the Game Master for this campaign." });
        socket.disconnect(true);
        return;
    }

    if (role === 'Player' && username === campaigns[activeCampId].gmUsername) {
        socket.emit('join_rejected', { reason: "That username is reserved for the Game Master." });
        socket.disconnect(true);
        return;
    }

    let finalRole = role;
    if (finalRole === 'Player') {
        // Enforce allowlist if it exists and is populated
        const allowed = campaigns[activeCampId].allowedUsers || [];
        if (allowed.length > 0 && !allowed.includes(username)) {
            socket.emit('join_rejected', { reason: "Username not on the allowed list" });
            socket.disconnect(true);
            return;
        }
    }

    socket.join(activeCampId);
    socket.campaignId = activeCampId;
    socket.username = username;
    socket.role = finalRole;
    
    if (!campaigns[activeCampId].knownPlayers) {
        campaigns[activeCampId].knownPlayers = [];
    }
    if (!campaigns[activeCampId].knownPlayers.includes(username)) {
        campaigns[activeCampId].knownPlayers.push(username);
        saveCampaigns();
    }
    
    console.log(`${username} joined campaign ${activeCampId} as ${finalRole}`);

    // Welcome user and send current state
    socket.emit('joined', {
      campaignState: campaigns[activeCampId] || null,
      chatHistory: (chatLogs[activeCampId] || []).slice(-50)
    });

    // Notify others
    socket.to(activeCampId).emit('sys_message', {
      text: `${username} has joined the game.`,
      timestamp: Date.now()
    });
  });

  socket.on('allowlist:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    campaigns[campaignId].allowedUsers = data.allowedUsers;
    saveCampaigns();

    io.to(campaignId).emit('allowlist:updated', { allowedUsers: data.allowedUsers });
  });

  // Sync handouts
  socket.on('handouts:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    campaigns[campaignId].handouts = data.handouts;
    saveCampaigns();

    io.to(campaignId).emit('handouts:updated', { handouts: data.handouts });
  });

  // Forward handouts:force_show
  socket.on('handouts:force_show', (data) => {
    const { campaignId } = socket;
    if (!campaignId) return;
    if (socket.role !== 'GM') return;

    io.to(campaignId).emit('handouts:force_show', data);
  });

  // Sync token state changes (legacy - full state)
  socket.on('token:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    
    const mapId = data.mapId || campaigns[campaignId].activeMapId;
    if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
      campaigns[campaignId].maps[mapId].tokens = data.tokens;
      saveCampaigns();
    }

    // Broadcast update to everyone in the room (including sender to trigger local sync)
    io.to(campaignId).emit('token:updated', { mapId, tokens: data.tokens, origin: socket.id });
  });

  // Add new token
  socket.on('token:add', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    
    const mapId = data.mapId || campaigns[campaignId].activeMapId;
    if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
      campaigns[campaignId].maps[mapId].tokens[data.tokenId] = data.token;
      saveCampaigns();
    }

    io.to(campaignId).emit('token:added', { mapId, tokenId: data.tokenId, token: data.token, origin: socket.id });
  });

  // Update specific fields of an existing token (Delta)
  socket.on('token:update_delta', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    
    const mapId = data.mapId || campaigns[campaignId].activeMapId;
    if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
      const existingToken = campaigns[campaignId].maps[mapId].tokens[data.tokenId];
      if (existingToken) {
        Object.assign(existingToken, data.changes);
        saveCampaigns();
      }
    }

    io.to(campaignId).emit('token:updated_delta', { mapId, tokenId: data.tokenId, changes: data.changes, origin: socket.id });
  });

  // Delete token
  socket.on('token:delete', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    
    const mapId = data.mapId || campaigns[campaignId].activeMapId;
    if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
      delete campaigns[campaignId].maps[mapId].tokens[data.tokenId];
      saveCampaigns();
    }

    io.to(campaignId).emit('token:deleted', { mapId, tokenId: data.tokenId, origin: socket.id });
  });

  // Sync grid configuration changes (GM only)
  socket.on('grid:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'grid', data.grid);
    if (targetMapId) saveCampaigns();

    io.to(campaignId).emit('grid:updated', { mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId, grid: data.grid });
  });

  // Sync map background updates (GM only)
  socket.on('map:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'mapImage', data.mapImage);
    if (targetMapId) saveCampaigns();

    io.to(campaignId).emit('map:updated', { mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId, mapImage: data.mapImage });
  });

  // Sync partial map updates from the Edit Map modal (grid dimensions, name, url)
  socket.on('map:edit', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    if (data.mapId && data.updates && campaigns[campaignId].maps[data.mapId]) {
      Object.assign(campaigns[campaignId].maps[data.mapId], data.updates);
      saveCampaigns();
      io.to(campaignId).emit('campaign:state-sync', campaigns[campaignId]);
    }
  });

  // Sync wall updates (GM only)
  socket.on('walls:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'walls', data.walls);
    if (targetMapId) saveCampaigns();

    io.to(campaignId).emit('walls:updated', { mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId, walls: data.walls });
  });

  socket.on('lights:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'lights', data.lights);
    if (targetMapId) saveCampaigns();

    io.to(campaignId).emit('lights:updated', { mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId, lights: data.lights });
  });

  socket.on('notes:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'notes', data.notes || []);
    if (targetMapId) saveCampaigns();

    io.to(campaignId).emit('notes:updated', { mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId, notes: data.notes || [] });
  });

  // Sync combat initiative
  socket.on('initiative:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;

    campaigns[campaignId].initiative = data.initiative;
    saveCampaigns();

    io.to(campaignId).emit('initiative:updated', { initiative: data.initiative });
  });

  // Sync persistent shapes/effects
  socket.on('shapes:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;

    const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'shapes', data.shapes);
    if (targetMapId) saveCampaigns();

    io.to(campaignId).emit('shapes:updated', { mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId, shapes: data.shapes, origin: socket.id });
  });

  // Sync HP bar visibilities & settings (GM only)
  socket.on('settings:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    campaigns[campaignId].settings = data.settings;
    saveCampaigns();

    io.to(campaignId).emit('settings:updated', { settings: data.settings });
  });

  // Create or update a character
  socket.on('character:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (!campaigns[campaignId].characters) campaigns[campaignId].characters = {};

    campaigns[campaignId].characters[data.character.id] = data.character;
    saveCampaigns();

    // Broadcast update to everyone
    io.to(campaignId).emit('character:updated', { character: data.character, origin: socket.id });
  });

  // Delete a character
  socket.on('character:delete', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId] || !campaigns[campaignId].characters) return;
    
    if (campaigns[campaignId].characters[data.id]) {
      delete campaigns[campaignId].characters[data.id];
      saveCampaigns();
    }

    // Broadcast delete to everyone
    socket.to(campaignId).emit('character:deleted', { id: data.id });
  });

  // Create a new map (GM only)
  socket.on('map:create', (data) => {
    const { campaignId } = socket;
    console.log(`[map:create] received - campaignId=${campaignId}, role=${socket.role}, name=${data?.name}`);
    if (!campaignId || !campaigns[campaignId]) {
      console.log(`[map:create] REJECTED: no campaignId or campaign not found`);
      return;
    }
    if (socket.role !== 'GM') {
      console.log(`[map:create] REJECTED: socket.role is "${socket.role}", expected "GM"`);
      return;
    }

    const mapId = `map_${campaignId}_${Date.now()}`;
    const newMap = {
      id: mapId,
      name: data.name || "Unnamed Map",
      mapImage: data.mapImage || "",
      gridWidth: data.gridWidth,
      gridHeight: data.gridHeight,
      grid: data.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5 },
      tokens: {},
      walls: data.walls || [],
      notes: data.notes || [],
      lights: [],
      shapes: {}
    };

    if (!campaigns[campaignId].maps) campaigns[campaignId].maps = {};
    campaigns[campaignId].maps[mapId] = newMap;
    campaigns[campaignId].activeGMMapId = mapId; // GM previews new map instantly
    saveCampaigns();

    console.log(`[map:create] SUCCESS: created map "${newMap.name}" (${mapId}), broadcasting campaign:state-sync to room ${campaignId}`);
    io.to(campaignId).emit('campaign:state-sync', campaigns[campaignId]);
  });

  // Rename a map (GM only)
  socket.on('map:rename', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const { mapId, name } = data;
    if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
      campaigns[campaignId].maps[mapId].name = name;
      saveCampaigns();
    }

    io.to(campaignId).emit('campaign:state-sync', campaigns[campaignId]);
  });

  // Delete a map (GM only)
  socket.on('map:delete', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const { mapId } = data;
    const camp = campaigns[campaignId];
    if (camp.maps && camp.maps[mapId]) {
      // Safety block: Do not delete active player map
      if (camp.activeMapId === mapId) return;

      delete camp.maps[mapId];
      if (camp.activeGMMapId === mapId) {
        camp.activeGMMapId = camp.activeMapId;
      }
      saveCampaigns();
    }

    io.to(campaignId).emit('campaign:state-sync', camp);
  });

  // GM switches local viewed map (GM only)
  socket.on('map:switch-gm', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const { mapId } = data;
    const camp = campaigns[campaignId];
    if (camp.maps && camp.maps[mapId]) {
      camp.activeGMMapId = mapId;
      saveCampaigns();
    }

    socket.emit('campaign:state-sync', camp);
  });

  // Activate map for players (GM only)
  socket.on('map:activate-players', (data) => {
    const { campaignId } = socket;
    if (!campaignId || !campaigns[campaignId]) return;
    if (socket.role !== 'GM') return;

    const { mapId, targetPlayers } = data; // targetPlayers = array of usernames, or 'all', or undefined
    const camp = campaigns[campaignId];
    if (camp.maps && camp.maps[mapId]) {
      if (!targetPlayers || targetPlayers === 'all') {
        camp.activeMapId = mapId;
        camp.activeGMMapId = mapId;
        camp.playerMapOverrides = {};
      } else {
        if (!camp.playerMapOverrides) camp.playerMapOverrides = {};

        // Push specific players without carrying token state between maps.
        targetPlayers.forEach(p => {
          camp.playerMapOverrides[p] = mapId;
        });
      }

      saveCampaigns();
    }

    io.to(campaignId).emit('campaign:state-sync', camp);
  });

    // Sync chat message & dice rolls
  socket.on('chat:msg', (msg) => {
    const { campaignId } = socket;
    if (!campaignId) return;

    const chatMsg = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: socket.username,
      role: socket.role,
      text: msg.text,
      roll: msg.roll || null,
      abilityCard: msg.abilityCard || null,
      macroCard: msg.macroCard || null,
      itemCard: msg.itemCard || null,
      timestamp: Date.now(),
      hidden: false,
      whisperToGM: msg.whisperToGM || false
    };

    if (!chatLogs[campaignId]) chatLogs[campaignId] = [];
    chatLogs[campaignId].push(chatMsg);
    // Keep chat history capped
    if (chatLogs[campaignId].length > 500) chatLogs[campaignId].shift();
    saveChat();

    io.to(campaignId).emit('chat:msg', chatMsg);
  });

  // Delete chat message (GM only)
  socket.on('chat:delete', (msgId) => {
    const { campaignId } = socket;
    if (!campaignId || socket.role !== 'GM') return;
    if (chatLogs[campaignId]) {
      chatLogs[campaignId] = chatLogs[campaignId].filter(m => m.id !== msgId);
      saveChat();
      io.to(campaignId).emit('chat:deleted', { id: msgId });
    }
  });

  // Hide chat message (GM only)
  socket.on('chat:hide', (msgId) => {
    const { campaignId } = socket;
    if (!campaignId || socket.role !== 'GM') return;
    if (chatLogs[campaignId]) {
      const msg = chatLogs[campaignId].find(m => m.id === msgId);
      if (msg) {
        msg.hidden = !msg.hidden;
        saveChat();
        io.to(campaignId).emit('chat:hidden_toggled', { id: msgId, hidden: msg.hidden });
      }
    }
  });

  // Private whisper (GM-only creature sheet rolls) — sent only back to the sender
  socket.on('chat:whisper', (msg) => {
    const whisperMsg = {
      username: socket.username,
      role: socket.role,
      text: msg.text,
      roll: msg.roll || null,
      abilityCard: msg.abilityCard || null,
      timestamp: Date.now()
    };
    // Send only to the requesting socket (GM sees it privately)
    socket.emit('chat:whisper', whisperMsg);
  });

  // Sync map ping event
  socket.on('map:ping', (data) => {
    const { campaignId } = socket;
    if (!campaignId) return;
    socket.to(campaignId).emit('map:pinged', {
      x: data.x,
      y: data.y,
      username: socket.username,
      role: socket.role
    });
  });

  // Sync map pan event (GM only)
  socket.on('map:panTo', (data) => {
    const { campaignId } = socket;
    if (!campaignId || socket.role !== 'GM') return;
    socket.to(campaignId).emit('map:pannedTo', {
      x: data.x,
      y: data.y
    });
  });

  // Sync real-time shape measurement drawing
  socket.on('measure:update', (data) => {
    const { campaignId } = socket;
    if (!campaignId) return;
    socket.to(campaignId).emit('measure:updated', {
      ...data,
      socketId: socket.id,
      username: socket.username,
      role: socket.role
    });
  });

  socket.on('measure:clear', () => {
    const { campaignId } = socket;
    if (!campaignId) return;
    socket.to(campaignId).emit('measure:cleared', {
      socketId: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.campaignId && socket.username) {
      socket.to(socket.campaignId).emit('sys_message', {
        text: `${socket.username} has left the game.`,
        timestamp: Date.now()
      });
    }
  });
});

// Boot the server
const PORT = 5050;
httpServer.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`  DnDForged VTT Local Server running on port ${PORT}`);
  console.log(`  Access Local Host: http://localhost:${PORT}/vtt.html`);
  console.log(`======================================================\n`);

});
