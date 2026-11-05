import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createCampaignTemplate, isValidAssetPath } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.join(__dirname, '..');

function resolveDefaultDataDir() {
    if (process.env.FORGEDVTT_DATA_DIR) return process.env.FORGEDVTT_DATA_DIR;
    if (rootDir.includes('.asar')) {
        return path.join(os.homedir(), '.dndforged-data');
    }
    return path.join(rootDir, '.dndforged-data');
}

// Campaign data persistence directories (dynamic & changeable)
export let DATA_DIR = resolveDefaultDataDir();
export let UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export let CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
export let CHAT_FILE = path.join(DATA_DIR, 'chat-log.json');
export let ASSETS_DIR = path.join(DATA_DIR, 'assets');
export let DISCORD_CACHE_DIR = path.join(DATA_DIR, 'discord-cache');

// Standalone VTT directories
export const VTT_DIR = path.join(rootDir, 'vtt');
export const VTT_DATA_DIR = fs.existsSync(path.join(VTT_DIR, 'data'))
    ? path.join(VTT_DIR, 'data')
    : path.join(rootDir, '5etools-src', 'data');

export function ensureDirectories() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    if (!fs.existsSync(DISCORD_CACHE_DIR)) fs.mkdirSync(DISCORD_CACHE_DIR, { recursive: true });
}
ensureDirectories();

// Launcher configuration file & state
export let CONFIG_FILE = process.env.FORGEDVTT_CONFIG_FILE || path.join(path.dirname(DATA_DIR), 'forge-config.json');
export let serverConfig = {
    gmCredentials: null
};

export function loadServerConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (parsed.gmCredentials) serverConfig.gmCredentials = parsed.gmCredentials;
        }
    } catch (err) {
        console.warn('[Server] Notice reading config:', err.message);
    }
}
loadServerConfig();

// In-Memory Database state
export let campaigns = {};
export let chatLogs = {};

// Reference to Socket.io instance for broadcasts
let activeIoInstance = null;
export function setActiveIo(io) {
    activeIoInstance = io;
}
export function getActiveIo() {
    return activeIoInstance;
}

// --- Security: Internal Secret & GM Session Authentication ---
export const SERVER_INTERNAL_SECRET = process.env.FORGEDVTT_SERVER_SECRET || crypto.randomBytes(32).toString('hex');
export const activeGmTokens = new Set();

export function generateGmSessionToken() {
    const token = crypto.randomBytes(24).toString('hex');
    activeGmTokens.add(token);
    return token;
}

export function isLoopbackRequest(req) {
    if (!req) return false;
    const ip = req.ip || req.socket?.remoteAddress || req.address || '';
    const isLocalIp = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    // Check if request was forwarded through proxy / tunnel from a remote address
    const forwarded =
        req.headers?.['x-forwarded-for'] || req.headers?.['cf-connecting-ip'] || req.headers?.['x-real-ip'];
    return isLocalIp && !forwarded;
}

export function isAuthorizedGmOrSecret(req) {
    if (!req) return false;
    // 1. Electron IPC / Internal CLI secret check
    const serverSecret = req.headers?.['x-server-secret'];
    if (serverSecret && serverSecret === SERVER_INTERNAL_SECRET) {
        return true;
    }

    // 2. Ephemeral GM session token check
    const token =
        req.headers?.['x-gm-token'] ||
        (req.headers?.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (token && activeGmTokens.has(token)) {
        return true;
    }

    // 3. Passwordless fallback check: strictly permit only for local loopback
    const hasGmPassword = !!serverConfig.gmCredentials?.hash;
    if (!hasGmPassword) {
        return isLoopbackRequest(req);
    }

    return false;
}

export function verifyGmOrSecret(req, res, next) {
    if (isAuthorizedGmOrSecret(req)) {
        return next();
    }
    const hasGmPassword = !!serverConfig.gmCredentials?.hash;
    if (!hasGmPassword && !isLoopbackRequest(req)) {
        return res.status(403).json({ error: 'Unauthorized: GM authentication required for remote access' });
    }
    return res.status(403).json({ error: 'Unauthorized: GM authentication required' });
}

// --- SSRF & Media Scraping Domain Allowlist ---
export const ALLOWED_MEDIA_DOMAINS = [
    'youtube.com',
    'youtu.be',
    'pinterest.com',
    'pin.it',
    'pinimg.com',
    'discordapp.com',
    'discordapp.net',
    'discord.com',
    'imgur.com'
];

export function isDiscordHost(hostname) {
    const h = (hostname || '').toLowerCase();
    return (
        h === 'discordapp.com' ||
        h.endsWith('.discordapp.com') ||
        h === 'discordapp.net' ||
        h.endsWith('.discordapp.net') ||
        h === 'discord.com' ||
        h.endsWith('.discord.com')
    );
}

export function isAllowedMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();

        // Explicitly reject loopback, internal CIDR, cloud metadata addresses
        if (/^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|::1|localhost)/.test(host)) {
            return false;
        }

        return ALLOWED_MEDIA_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
    } catch {
        return false;
    }
}

// --- Sources & Homebrew Configuration Manager ---
let sourcesConfigFileMtime = 0;
export let sourcesConfig = {
    disabledSources: { global: [], campaigns: {} },
    customSources: []
};

export function loadSourcesConfig(force = false) {
    try {
        const p = path.join(DATA_DIR, 'sources-config.json');
        if (fs.existsSync(p)) {
            const stat = fs.statSync(p);
            if (force || stat.mtimeMs !== sourcesConfigFileMtime) {
                sourcesConfigFileMtime = stat.mtimeMs;
                sourcesConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
            }
        } else {
            sourcesConfigFileMtime = 0;
            sourcesConfig = {
                disabledSources: { global: [], campaigns: {} },
                customSources: []
            };
        }
    } catch (e) {
        console.error('[Server] Error loading sources-config.json:', e);
    }
}
loadSourcesConfig(true);

export function getDisabledSourcesSet(campaignId = null) {
    loadSourcesConfig(false);
    const set = new Set((sourcesConfig.disabledSources?.global || []).map((s) => String(s).toUpperCase()));
    if (campaignId && sourcesConfig.disabledSources?.campaigns?.[campaignId]) {
        for (const s of sourcesConfig.disabledSources.campaigns[campaignId]) {
            set.add(String(s).toUpperCase());
        }
    }
    return set;
}

export function extractEntityArray(data, category) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    const plural = category.endsWith('s') ? category : category + 's';
    const candidateKeys = [
        category,
        singular,
        plural,
        category === 'bestiary' ? 'monster' : null,
        category === 'bestiary' ? 'monsters' : null,
        'monster',
        'monsters',
        'spell',
        'spells',
        'item',
        'items',
        'class',
        'classes',
        'race',
        'races',
        'feat',
        'feats',
        'background',
        'backgrounds',
        'adventure',
        'adventures',
        'optionalfeature',
        'optionalfeatures',
        'data'
    ].filter(Boolean);

    for (const k of candidateKeys) {
        if (Array.isArray(data[k])) return data[k];
    }
    for (const val of Object.values(data)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val;
    }
    return [];
}

export function loadCustomEntities(category) {
    const results = [];
    try {
        const catDir = path.join(DATA_DIR, 'sources', category);
        if (fs.existsSync(catDir)) {
            const files = fs.readdirSync(catDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const raw = fs.readFileSync(path.join(catDir, file), 'utf8');
                    const data = JSON.parse(raw);
                    const srcCode = String(data.source || file.replace(/\.json$/i, '')).toUpperCase();
                    const items = extractEntityArray(data, category);
                    for (const item of items) {
                        if (item && typeof item === 'object') {
                            if (!item.source) item.source = srcCode;
                            results.push(item);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
    return results;
}

// Database Persistence with atomic writing & debouncing
let campaignsSaveTimeout = null;
let chatSaveTimeout = null;
const DEBOUNCE_MS = 2000;

export async function atomicWriteFile(filePath, data) {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
    await fs.promises.writeFile(tempPath, data, 'utf8');
    if (filePath.endsWith('campaigns.json') && fs.existsSync(filePath)) {
        try {
            await fs.promises.copyFile(filePath, `${filePath}.bak`);
        } catch (bakErr) {}
    }
    await fs.promises.rename(tempPath, filePath);
}

export function atomicWriteFileSync(filePath, data) {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
    fs.writeFileSync(tempPath, data, 'utf8');
    if (filePath.endsWith('campaigns.json') && fs.existsSync(filePath)) {
        try {
            fs.copyFileSync(filePath, `${filePath}.bak`);
        } catch (bakErr) {}
    }
    fs.renameSync(tempPath, filePath);
}

export function saveCampaigns(sync = false) {
    if (sync) {
        if (campaignsSaveTimeout) {
            clearTimeout(campaignsSaveTimeout);
            campaignsSaveTimeout = null;
        }
        try {
            atomicWriteFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns));
        } catch (err) {
            console.error('Failed to save campaigns sync:', err);
        }
        return;
    }

    if (campaignsSaveTimeout) clearTimeout(campaignsSaveTimeout);
    campaignsSaveTimeout = setTimeout(async () => {
        campaignsSaveTimeout = null;
        try {
            await atomicWriteFile(CAMPAIGNS_FILE, JSON.stringify(campaigns));
        } catch (err) {
            console.error('Failed to save campaigns async:', err);
        }
    }, DEBOUNCE_MS);
}

export function saveChat(sync = false) {
    if (sync) {
        if (chatSaveTimeout) {
            clearTimeout(chatSaveTimeout);
            chatSaveTimeout = null;
        }
        try {
            atomicWriteFileSync(CHAT_FILE, JSON.stringify(chatLogs));
        } catch (err) {
            console.error('Failed to save chat sync:', err);
        }
        return;
    }

    if (chatSaveTimeout) clearTimeout(chatSaveTimeout);
    chatSaveTimeout = setTimeout(async () => {
        chatSaveTimeout = null;
        try {
            await atomicWriteFile(CHAT_FILE, JSON.stringify(chatLogs));
        } catch (err) {
            console.error('Failed to save chat async:', err);
        }
    }, DEBOUNCE_MS);
}

export function loadDatabase() {
    try {
        if (fs.existsSync(CAMPAIGNS_FILE)) {
            let loaded = null;
            try {
                loaded = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
                // Maintain backup of last successfully loaded campaigns file
                fs.copyFileSync(CAMPAIGNS_FILE, `${CAMPAIGNS_FILE}.bak`);
            } catch (parseErr) {
                console.error('[Database CRITICAL] Corrupted campaigns.json detected:', parseErr.message);
                const corruptArchive = `${CAMPAIGNS_FILE}.corrupt.${Date.now()}`;
                try {
                    fs.copyFileSync(CAMPAIGNS_FILE, corruptArchive);
                    console.warn(`[Database] Preserved corrupted file as ${corruptArchive}`);
                } catch (copyErr) {
                    console.error('[Database] Failed to archive corrupted file:', copyErr);
                }

                const bakFile = `${CAMPAIGNS_FILE}.bak`;
                if (fs.existsSync(bakFile)) {
                    console.log('[Database] Attempting recovery from campaigns.json.bak...');
                    try {
                        loaded = JSON.parse(fs.readFileSync(bakFile, 'utf8'));
                        console.log('[Database] Successfully recovered campaign data from .bak!');
                    } catch (bakErr) {
                        console.error('[Database CRITICAL] Backup .bak file is also invalid:', bakErr.message);
                    }
                }

                if (!loaded) {
                    console.error(
                        '[Database CRITICAL] Halting database reload to prevent destructive empty overwrite.'
                    );
                    return;
                }
            }

            for (const k of Object.keys(campaigns)) delete campaigns[k];
            Object.assign(campaigns, loaded);
        } else {
            for (const k of Object.keys(campaigns)) delete campaigns[k];
            campaigns.default = createCampaignTemplate('default', 'Primary Campaign');
            saveCampaigns();
        }

        // Auto-migration checks
        let migrated = false;
        Object.values(campaigns).forEach((c) => {
            if (!c.maps) {
                c.maps = {};
                migrated = true;
            }
            if (c.maps) {
                Object.values(c.maps).forEach((map) => {
                    if (!map.tokens) map.tokens = {};
                    if (map.mapImage && map.mapImage.trim()) {
                        const imgUrl = map.mapImage.trim();
                        const isVideo = imgUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i);
                        const isYoutube = imgUrl.includes('youtube.com') || imgUrl.includes('youtu.be');

                        const hasExistingBg = Object.values(map.tokens).some(
                            (t) => t.layer === 'map' && (t.isBackground || t.isAsset)
                        );

                        if (!hasExistingBg) {
                            const gSize = map.grid?.size || 50;
                            const gScale = map.grid?.scale || 1.0;
                            const gWidth = map.gridWidth ? Math.ceil(map.gridWidth) : 40;
                            const gHeight = map.gridHeight ? Math.ceil(map.gridHeight) : 30;
                            const pixelWidth = map.gridWidth ? map.gridWidth * gSize * gScale : 2000;
                            const pixelHeight = map.gridHeight ? map.gridHeight * gSize * gScale : 1500;

                            const assetId = `asset_${map.id}_bg`;
                            map.tokens[assetId] = {
                                id: assetId,
                                name: `${map.name || 'Map'} (Artwork)`,
                                x: 0,
                                y: 0,
                                layer: 'map',
                                isAsset: true,
                                isBackground: true,
                                img: imgUrl,
                                isVideo: isVideo || isYoutube,
                                pixelWidth: pixelWidth,
                                pixelHeight: pixelHeight,
                                size: 1,
                                zIndex: 0,
                                isPlayer: false
                            };
                            if (!map.gridWidth) map.gridWidth = gWidth;
                            if (!map.gridHeight) map.gridHeight = gHeight;
                        }

                        map.thumbnail = map.thumbnail || imgUrl;
                        map.mapImage = '';
                        migrated = true;
                        console.log(`[Database] Migrated map "${map.name}" (${map.id}) to Freeform Asset.`);
                    }
                });
            }
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
            saveCampaigns(true);
        }

        if (fs.existsSync(CHAT_FILE)) {
            const parsedChat = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
            if (Array.isArray(parsedChat)) {
                chatLogs = { default: parsedChat };
                saveChat();
            } else {
                chatLogs = parsedChat;
            }
        } else {
            chatLogs = {};
            saveChat();
        }
    } catch (err) {
        console.error('Error loading local database:', err);
    }
}
loadDatabase();

export function setDatabaseDirectory(newDir) {
    if (!newDir) return;
    const isSwitching = path.resolve(newDir) !== path.resolve(DATA_DIR);
    if (isSwitching) {
        saveCampaigns(true);
        saveChat(true);
        DATA_DIR = newDir;
        UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
        CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
        CHAT_FILE = path.join(DATA_DIR, 'chat-log.json');
        ASSETS_DIR = path.join(DATA_DIR, 'assets');
        DISCORD_CACHE_DIR = path.join(DATA_DIR, 'discord-cache');
        ensureDirectories();
    }
    loadDatabase();
    loadSourcesConfig();
    console.log(`[Database] Dynamically switched active DATA_DIR to: ${DATA_DIR}`);
}

export function extractSubdomain(hostHeader) {
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

export function getOrCreateCampaign(campId, displayName = null) {
    if (!campaigns[campId]) {
        const name = displayName || campId.charAt(0).toUpperCase() + campId.slice(1) + ' Campaign';
        campaigns[campId] = createCampaignTemplate(campId, name);
        saveCampaigns();
    }
    return campaigns[campId];
}
export { isValidAssetPath };
