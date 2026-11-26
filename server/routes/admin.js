import express from 'express';
import {
    DATA_DIR,
    serverConfig,
    setDatabaseDirectory,
    loadSourcesConfig,
    getDisabledSourcesSet,
    extractSubdomain,
    verifyGmOrSecret,
    isAuthorizedGmOrSecret,
    isLoopbackRequest,
    isSameSiteOrLocalBrowserRequest,
    getActiveIo,
    generateGmSessionToken,
    revokeGmSessionToken,
    activeGmTokens
} from '../state.js';
import { verifyPassword } from '../../utils.js';
import { p2pBridge } from '../p2p-bridge.js';

export const adminRouter = express.Router();

let compendiumInvalidator = null;
export function registerCompendiumInvalidator(fn) {
    compendiumInvalidator = fn;
}

// Server Config Sync & Data Directory API
adminRouter.get('/server/data-dir', (req, res) => {
    const authenticated = isAuthorizedGmOrSecret(req);
    if (authenticated || isLoopbackRequest(req)) {
        const hasGmPassword = Boolean(serverConfig.gmCredentials?.hash);
        const passwordlessLoopback = !hasGmPassword && isLoopbackRequest(req) && isSameSiteOrLocalBrowserRequest(req);
        return res.json({
            success: true,
            activeDataDir: DATA_DIR,
            authenticated,
            hasGmPassword,
            gmUsername: authenticated ? serverConfig.gmCredentials?.username || '' : '',
            passwordlessLoopback
        });
    }
    // Remote unauthenticated probes receive a clean health ping without host path disclosure
    res.json({ success: true });
});

adminRouter.post('/server/data-dir', verifyGmOrSecret, (req, res) => {
    const { dataDir } = req.body;
    if (!dataDir) return res.status(400).json({ error: 'dataDir required' });
    try {
        setDatabaseDirectory(dataDir);
        res.json({ success: true, activeDataDir: DATA_DIR });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

adminRouter.post('/server/sync-config', verifyGmOrSecret, (req, res) => {
    const { gmCredentials, campaignDataDir } = req.body;
    if (gmCredentials !== undefined) {
        serverConfig.gmCredentials = gmCredentials;
        console.log(
            '[Server] Synced GM credentials from launcher:',
            gmCredentials?.username ? `GM user=${gmCredentials.username}` : 'Cleared'
        );
    }
    if (campaignDataDir && campaignDataDir !== DATA_DIR) {
        console.log(`[Server] Switching database directory to: ${campaignDataDir}`);
        try {
            setDatabaseDirectory(campaignDataDir);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json({ success: true, activeDataDir: DATA_DIR });
});

// Sources & Homebrew Sync Endpoint
adminRouter.post(['/server/sync-sources', '/sources/sync'], verifyGmOrSecret, (req, res) => {
    loadSourcesConfig(true);

    // Invalidate in-memory caches if registered
    if (typeof compendiumInvalidator === 'function') {
        compendiumInvalidator();
    }

    // Broadcast live refresh to connected VTT sockets
    const io = getActiveIo();
    if (io) {
        io.emit('sources:updated', { timestamp: Date.now() });
    }
    console.log('[Sources] Hot-reloaded source filters and broadcast update to VTT.');
    res.json({ success: true, timestamp: Date.now() });
});

// Check if password auth is required for GM login (omit username enumeration)
adminRouter.get('/gm-auth-required', (req, res) => {
    const checkUser = (req.query.username || '').trim().toLowerCase();
    const gmUser = (serverConfig.gmCredentials?.username || '').trim().toLowerCase();
    const hasGmPassword = !!serverConfig.gmCredentials?.hash;

    if (gmUser && checkUser === gmUser) {
        return res.json({
            required: true,
            hasPassword: hasGmPassword
        });
    }
    return res.json({
        required: false,
        hasPassword: false
    });
});

// Remote GM Login & Session Token Issuance (with per-IP rate limiting)
const GM_LOGIN_WINDOW_MS = 60_000;
const GM_LOGIN_MAX_ATTEMPTS = 5;
const gmLoginAttempts = new Map();

export function getClientIpKey(req) {
    const socketAddr = String(req.ip || req.socket?.remoteAddress || req.address || 'local').trim() || 'local';
    const cleanSocket = socketAddr.replace(/^::ffff:/, '');
    const isBehindLocalProxy = cleanSocket === '127.0.0.1' || cleanSocket === '::1' || cleanSocket === 'localhost';
    if (isBehindLocalProxy) {
        const cfRay = req.headers?.['cf-ray'];
        const cf = req.headers?.['cf-connecting-ip'];
        const cfIp = cfRay ? (Array.isArray(cf) ? cf[0] : cf ? String(cf) : '').trim().slice(0, 64) : '';
        if (cfIp) {
            return cfIp.replace(/^::ffff:/, '');
        }
        const xff = req.headers?.['x-forwarded-for'];
        if (typeof xff === 'string' && xff.trim()) {
            const parts = xff
                .split(',')
                .map((s) => s.trim().replace(/^::ffff:/, ''))
                .filter(Boolean);
            const isLocalHop = (h) => h === '127.0.0.1' || h === '::1' || h === 'localhost';
            // Prefer rightmost non-local proxy-appended IP so spoofed leftmost hops cannot rotate rate-limit buckets
            const rightmostNonLocal = [...parts].reverse().find((p) => !isLocalHop(p));
            const picked = (rightmostNonLocal || parts[0] || '').slice(0, 64);
            if (picked) return picked;
        }
    }
    return cleanSocket;
}

function pruneExpiredLoginAttempts(now) {
    if (gmLoginAttempts.size < 250) return;
    for (const [key, rec] of gmLoginAttempts.entries()) {
        if (!rec || now - rec.windowStart >= GM_LOGIN_WINDOW_MS) {
            gmLoginAttempts.delete(key);
        }
    }
    if (gmLoginAttempts.size >= 1000) {
        gmLoginAttempts.clear();
    }
}

export function resetGmLoginRateLimits() {
    gmLoginAttempts.clear();
}

export function checkAndRecordGmAuthFailure(req) {
    const ipKey = getClientIpKey(req);
    const now = Date.now();
    pruneExpiredLoginAttempts(now);
    const rec = gmLoginAttempts.get(ipKey);
    if (rec && now - rec.windowStart < GM_LOGIN_WINDOW_MS && rec.count >= GM_LOGIN_MAX_ATTEMPTS) {
        return { limited: true };
    }
    if (!rec || now - rec.windowStart >= GM_LOGIN_WINDOW_MS) {
        gmLoginAttempts.set(ipKey, { count: 1, windowStart: now });
    } else {
        rec.count += 1;
    }
    return { limited: false };
}

export function isGmAuthRateLimited(req) {
    const ipKey = getClientIpKey(req);
    const now = Date.now();
    const rec = gmLoginAttempts.get(ipKey);
    return Boolean(rec && now - rec.windowStart < GM_LOGIN_WINDOW_MS && rec.count >= GM_LOGIN_MAX_ATTEMPTS);
}

export function clearGmAuthFailures(req) {
    gmLoginAttempts.delete(getClientIpKey(req));
}

adminRouter.post('/gm-login', (req, res) => {
    if (isGmAuthRateLimited(req)) {
        return res.status(429).json({
            success: false,
            error: 'Too many failed login attempts. Please wait a minute before trying again.'
        });
    }

    const { username, password } = req.body || {};
    const gmUser = (serverConfig.gmCredentials?.username || '').trim();
    const gmSalt = serverConfig.gmCredentials?.salt || '';
    const gmHash = serverConfig.gmCredentials?.hash || '';

    if (!gmUser || !gmHash) {
        return res.status(403).json({
            success: false,
            error: 'GM password must be configured on the host before remote login is permitted.'
        });
    }

    const cleanUser = (username || '').trim();
    if (cleanUser.toLowerCase() !== gmUser.toLowerCase() || !verifyPassword(String(password || ''), gmSalt, gmHash)) {
        checkAndRecordGmAuthFailure(req);
        return res.status(401).json({
            success: false,
            error: 'Invalid GM username or password.'
        });
    }

    clearGmAuthFailures(req);
    const token = generateGmSessionToken();
    return res.json({
        success: true,
        token,
        username: gmUser
    });
});

adminRouter.post('/gm-logout', (req, res) => {
    const token =
        req.headers?.['x-gm-token'] ||
        (req.headers?.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (token) {
        revokeGmSessionToken(token);
    }
    return res.json({ success: true });
});

// Disabled sources query
adminRouter.get('/sources/disabled', (req, res) => {
    const campId = req.query.campaignId || extractSubdomain(req.headers.host);
    const disabledSet = getDisabledSourcesSet(campId);
    res.json({ disabledSources: Array.from(disabledSet) });
});

// Direct P2P room status & host peer sync bridge
adminRouter.get('/p2p/status', verifyGmOrSecret, (req, res) => {
    return res.json(p2pBridge.getStatus());
});

adminRouter.post('/p2p/peers', verifyGmOrSecret, (req, res) => {
    const { roomCode, peers } = req.body || {};
    if (roomCode && (!p2pBridge.active || p2pBridge.roomCode !== roomCode)) {
        p2pBridge.startRoom({ roomCode: String(roomCode).trim().toUpperCase() });
    }
    const status = p2pBridge.syncPeers(Array.isArray(peers) ? peers : []);
    return res.json({ success: true, ...status });
});

adminRouter.post('/p2p/start', verifyGmOrSecret, (req, res) => {
    const status = p2pBridge.startRoom(req.body || {});
    return res.json({ success: true, ...status });
});

adminRouter.post('/p2p/stop', verifyGmOrSecret, (_req, res) => {
    const status = p2pBridge.stopRoom();
    return res.json({ success: true, ...status });
});

adminRouter.post('/p2p/regen', verifyGmOrSecret, (_req, res) => {
    const newCode = p2pBridge.generateRoomCode();
    const status = p2pBridge.startRoom({ roomCode: newCode });
    return res.json({ success: true, ...status });
});
