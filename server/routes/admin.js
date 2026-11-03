import express from 'express';
import {
    DATA_DIR,
    serverConfig,
    setDatabaseDirectory,
    loadSourcesConfig,
    getDisabledSourcesSet,
    extractSubdomain,
    verifyGmOrSecret,
    getActiveIo
} from '../state.js';

export const adminRouter = express.Router();

let compendiumInvalidator = null;
export function registerCompendiumInvalidator(fn) {
    compendiumInvalidator = fn;
}

// Server Config Sync & Data Directory API
adminRouter.get('/server/data-dir', (req, res) => {
    res.json({ success: true, activeDataDir: DATA_DIR });
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
        setDatabaseDirectory(campaignDataDir);
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

// Check if username requires GM password
adminRouter.get('/gm-auth-required', (req, res) => {
    const checkUser = (req.query.username || '').trim().toLowerCase();
    const gmUser = (serverConfig.gmCredentials?.username || '').trim().toLowerCase();
    const hasGmPassword = !!serverConfig.gmCredentials?.hash;

    if (gmUser && checkUser === gmUser) {
        return res.json({
            required: true,
            hasPassword: hasGmPassword,
            gmUsername: serverConfig.gmCredentials.username
        });
    }
    return res.json({
        required: false,
        hasPassword: false
    });
});

// Disabled sources query
adminRouter.get('/sources/disabled', (req, res) => {
    const campId = req.query.campaignId || extractSubdomain(req.headers.host);
    const disabledSet = getDisabledSourcesSet(campId);
    res.json({ disabledSources: Array.from(disabledSet) });
});
