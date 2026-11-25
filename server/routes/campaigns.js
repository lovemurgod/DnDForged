import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import {
    DATA_DIR,
    UPLOADS_DIR,
    campaigns,
    chatLogs,
    extractSubdomain,
    getOrCreateCampaign,
    isAuthorizedGmOrSecret,
    sanitizeImportedObject,
    saveCampaigns,
    saveChat,
    verifyGmOrSecret
} from '../state.js';
import { createCampaignTemplate } from '../../utils.js';
import {
    isRoll20CharacterJson,
    convertRoll20Character,
    isRoll20TableJson,
    convertRoll20TableToVTT
} from '../../electron/importers/roll20-importer.js';

export const campaignsRouter = express.Router();

let broadcastSyncFn = null;
export function registerCampaignBroadcaster(fn) {
    broadcastSyncFn = fn;
}

function notifyCampaignSync(campId) {
    if (typeof broadcastSyncFn === 'function') {
        broadcastSyncFn(campId);
    }
}

// Get campaign list (sanitized public descriptor for players, full metadata for authorized GM)
campaignsRouter.get('/campaigns', (req, res) => {
    const sub = extractSubdomain(req.headers.host);
    const isAuthed = isAuthorizedGmOrSecret(req);
    if (sub && (campaigns[sub] || isAuthed)) {
        getOrCreateCampaign(sub);
    }
    const campaignsList = Object.values(campaigns).map((c) => {
        const safeName =
            typeof c.name === 'string' && c.name.trim() ? c.name.trim() : String(c.id || 'Untitled Campaign');
        if (!isAuthed) {
            // Intentionally public metadata to populate login campaign selector
            return {
                id: c.id,
                name: safeName
            };
        }
        return {
            id: c.id,
            name: safeName,
            description: c.description || '',
            allowedUsers: c.allowedUsers || [],
            knownPlayers: c.knownPlayers || [],
            activeMapId: c.activeMapId,
            mapsCount: Object.keys(c.maps || {}).length,
            playersCount: (c.knownPlayers || []).length
        };
    });
    res.json({
        activeSubdomain: sub || null,
        campaigns: campaignsList
    });
});

// Get detailed campaign state (GM or internal secret only)
campaignsRouter.get('/campaigns/:id', verifyGmOrSecret, (req, res) => {
    const campaign = getOrCreateCampaign(req.params.id);
    res.json(campaign);
});

// Create new campaign
campaignsRouter.post('/campaigns', verifyGmOrSecret, (req, res) => {
    const { name, description, allowedUsers } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Campaign name required' });
    const id =
        name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/gi, '_') +
        '_' +
        Date.now();
    const newCamp = createCampaignTemplate(id, name.trim());
    if (description) newCamp.description = description;
    if (Array.isArray(allowedUsers)) newCamp.allowedUsers = allowedUsers;
    campaigns[id] = newCamp;
    saveCampaigns();
    res.json(campaigns[id]);
});

// Update existing campaign metadata
campaignsRouter.put('/campaigns/:id', verifyGmOrSecret, (req, res) => {
    const campId = req.params.id;
    const campaign = campaigns[campId];
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { name, description, allowedUsers } = req.body;
    if (name && name.trim()) {
        campaign.name = name.trim();
    }
    if (description !== undefined) {
        campaign.description = description;
    }
    if (Array.isArray(allowedUsers)) {
        campaign.allowedUsers = allowedUsers;
    }
    saveCampaigns();
    notifyCampaignSync(campId);
    res.json(campaign);
});

// Delete campaign
campaignsRouter.delete('/campaigns/:id', verifyGmOrSecret, (req, res) => {
    const campId = req.params.id;
    if (!campaigns[campId]) return res.status(404).json({ error: 'Campaign not found' });

    // Prevent deleting if it's the only campaign
    const keys = Object.keys(campaigns);
    if (keys.length <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only campaign. Create another campaign first.' });
    }

    delete campaigns[campId];
    saveCampaigns(true);
    res.json({ success: true, deletedId: campId });
});

// Duplicate campaign
campaignsRouter.post('/campaigns/:id/duplicate', verifyGmOrSecret, (req, res) => {
    const origId = req.params.id;
    const origCamp = campaigns[origId];
    if (!origCamp) return res.status(404).json({ error: 'Campaign not found' });

    const safeName = (origCamp.name || 'Campaign').trim();
    const newName = `${safeName} (Copy)`;
    const newId = safeName.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_copy_' + Date.now();

    // Deep clone campaign object and migrate internal asset paths to new ID
    let clonedStr = JSON.stringify(origCamp);
    const oldPathRegex = new RegExp(`(/assets/campaigns/|assets/campaigns/)${origId}([/\\\\])`, 'g');
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

    // Copy campaign uploads folder if it exists
    const origUploads = path.join(DATA_DIR, 'campaigns', origId, 'uploads');
    const newUploads = path.join(DATA_DIR, 'campaigns', newId, 'uploads');
    if (fs.existsSync(origUploads)) {
        try {
            fs.cpSync(origUploads, newUploads, { recursive: true });
        } catch (e) {
            console.error('[Duplicate] Failed copying uploads folder:', e);
        }
    }

    // Clear chat log for the new duplicate campaign
    if (chatLogs) {
        chatLogs[newId] = [];
        saveChat();
    }

    campaigns[newId] = cloned;
    saveCampaigns(true);
    res.json({ success: true, campaign: cloned });
});

// Import full campaign into server
campaignsRouter.post('/campaigns/import', verifyGmOrSecret, (req, res) => {
    const { campaign } = req.body;
    if (!campaign || !campaign.name) {
        return res.status(400).json({ error: 'Invalid campaign data for import' });
    }

    let campId = campaign.id;
    if (!campId || campaigns[campId]) {
        campId = (campaign.name || 'imported').toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
    }

    let campDataToImport = campaign;
    if (campaign.id && campId !== campaign.id) {
        let campStr = JSON.stringify(campaign);
        const oldPathRegex = new RegExp(`(/assets/campaigns/|assets/campaigns/)${campaign.id}([/\\\\])`, 'g');
        campStr = campStr.replace(oldPathRegex, `$1${campId}$2`);
        campDataToImport = JSON.parse(campStr);
    }

    const targetGm = (req.body.gmUsername || req.body.username || '').trim();
    const importedCamp = {
        ...createCampaignTemplate(campId, campaign.name || 'Imported Campaign'),
        ...campDataToImport,
        id: campId
    };

    if (targetGm) {
        importedCamp.gmUsername = targetGm;
    } else if (!importedCamp.gmUsername) {
        importedCamp.gmUsername = 'DungeonMaster';
    }

    campaigns[campId] = importedCamp;
    saveCampaigns(true);
    res.json({ success: true, campaign: importedCamp });
});

// Import granular entity (map, player, companion, customNpc) into a campaign
campaignsRouter.post('/campaigns/:id/import-entity', verifyGmOrSecret, (req, res) => {
    const campId = req.params.id;
    const campaign = campaigns[campId];
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { entityType, entity, entities } = req.body;
    const items = Array.isArray(entities) ? entities : entity ? [entity] : [];
    if (items.length === 0) {
        return res.status(400).json({ error: 'No entity data provided' });
    }

    if (!campaign.maps) campaign.maps = {};
    if (!campaign.characters) campaign.characters = {};

    const importedIds = [];

    for (let item of items) {
        if (!item) continue;
        let itemStr = JSON.stringify(item);
        itemStr = itemStr.replace(
            /(?:\/assets\/campaigns\/|assets\/campaigns\/)[^/\\\s"']+(?=[/\\\\]uploads[/\\\\])/g,
            `/assets/campaigns/${campId}`
        );
        item = JSON.parse(itemStr);
        item = sanitizeImportedObject(item);
        item = maybeConvertRoll20Item(item);

        if (entityType === 'map' || item.grid || item.tokens !== undefined) {
            // It's a map
            let mapId = item.id;
            let mapName = item.name || 'Imported Map';
            if (!mapId || campaign.maps[mapId]) {
                mapId = `map_${campId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                mapName = `${mapName} (Copy)`;
            }
            const clonedMap = { ...item, id: mapId, name: mapName };
            campaign.maps[mapId] = clonedMap;
            if (!campaign.mapOrder) campaign.mapOrder = Object.keys(campaign.maps).filter((id) => id !== mapId);
            if (!campaign.mapOrder.includes(mapId)) campaign.mapOrder.push(mapId);
            importedIds.push(mapId);
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
            // It's a rollable table, asset table, or card deck
            if (!campaign.rollTables) campaign.rollTables = {};
            if (item.isAssetTable || item.sides || item._entityCategory === 'assetTable') {
                if (!campaign.rollTables.assetTables) campaign.rollTables.assetTables = [];
                let tId = item.id;
                let tName = item.name || 'Imported Asset Table';
                if (!tId || campaign.rollTables.assetTables.some((t) => t.id === tId)) {
                    tId = `asset_table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    tName = `${tName} (Copy)`;
                }
                const cloned = { ...item, id: tId, name: tName, isAssetTable: true };
                delete cloned._entityCategory;
                campaign.rollTables.assetTables.push(cloned);
                importedIds.push(tId);
            } else if (item.cards || item._entityCategory === 'cardDeck') {
                if (!campaign.rollTables.cardDecks) campaign.rollTables.cardDecks = [];
                let dId = item.id;
                let dName = item.name || 'Imported Card Deck';
                if (!dId || campaign.rollTables.cardDecks.some((d) => d.id === dId)) {
                    dId = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    dName = `${dName} (Copy)`;
                }
                const cloned = { ...item, id: dId, name: dName };
                delete cloned._entityCategory;
                campaign.rollTables.cardDecks.push(cloned);
                importedIds.push(dId);
            } else {
                if (!campaign.rollTables.customTables) campaign.rollTables.customTables = [];
                let tId = item.id;
                let tName = item.name || 'Imported Roll Table';
                if (!tId || campaign.rollTables.customTables.some((t) => t.id === tId)) {
                    tId = `table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    tName = `${tName} (Copy)`;
                }
                const cloned = { ...item, id: tId, name: tName };
                delete cloned._entityCategory;
                campaign.rollTables.customTables.push(cloned);
                importedIds.push(tId);
            }
        } else {
            // It's a character (player sheet, companion, custom NPC)
            let charId = item.id;
            let charName = item.name || 'Imported Character';
            const isOverwrite =
                item._overwrite !== undefined
                    ? Boolean(item._overwrite)
                    : item.overwrite !== undefined
                      ? Boolean(item.overwrite)
                      : Boolean(req.body.overwrite);
            const existingByName = Object.values(campaign.characters).find(
                (c) => c && (c.name === charName || c.characterName === charName)
            );
            if (!charId || (!isOverwrite && (campaign.characters[charId] || existingByName))) {
                charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                charName = `${charName} (Copy)`;
            } else if (isOverwrite && existingByName && !campaign.characters[charId]) {
                charId = existingByName.id;
            }
            const clonedChar = { ...item, id: charId, name: charName };
            delete clonedChar._overwrite;
            delete clonedChar.overwrite;
            campaign.characters[charId] = clonedChar;
            importedIds.push(charId);
        }
    }

    saveCampaigns();
    notifyCampaignSync(campId);
    res.json({ success: true, count: importedIds.length, importedIds, campaign });
});

// Delete granular entity (map or character) from a campaign
campaignsRouter.delete('/campaigns/:id/entities/:entityId', verifyGmOrSecret, (req, res) => {
    const campId = req.params.id;
    const entityId = req.params.entityId;
    const campaign = campaigns[campId];
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    let deleted = false;
    let entityType = null;

    if (campaign.maps && campaign.maps[entityId]) {
        const mapKeys = Object.keys(campaign.maps);
        if (mapKeys.length <= 1) {
            return res.status(400).json({ error: 'Cannot delete the only map in the campaign.' });
        }
        delete campaign.maps[entityId];
        if (Array.isArray(campaign.mapOrder)) {
            campaign.mapOrder = campaign.mapOrder.filter((id) => id !== entityId);
        }
        if (campaign.activeMapId === entityId) {
            campaign.activeMapId = (campaign.mapOrder && campaign.mapOrder[0]) || Object.keys(campaign.maps)[0];
        }
        if (campaign.activeGMMapId === entityId) {
            campaign.activeGMMapId = campaign.activeMapId;
        }
        deleted = true;
        entityType = 'map';
    } else if (campaign.characters && campaign.characters[entityId]) {
        delete campaign.characters[entityId];
        deleted = true;
        entityType = 'character';
    } else if (campaign.rollTables || campaign.assetTables) {
        const rt = campaign.rollTables || {};
        let found = false;
        if (Array.isArray(rt.customTables)) {
            const initLen = rt.customTables.length;
            rt.customTables = rt.customTables.filter((t) => t.id !== entityId);
            if (rt.customTables.length < initLen) {
                found = true;
                entityType = 'table';
            }
        }
        if (!found && Array.isArray(rt.assetTables)) {
            const initLen = rt.assetTables.length;
            rt.assetTables = rt.assetTables.filter((t) => t.id !== entityId);
            if (rt.assetTables.length < initLen) {
                found = true;
                entityType = 'table';
            }
        }
        if (!found && Array.isArray(campaign.assetTables)) {
            const initLen = campaign.assetTables.length;
            campaign.assetTables = campaign.assetTables.filter((t) => t.id !== entityId);
            if (campaign.assetTables.length < initLen) {
                found = true;
                entityType = 'table';
            }
        }
        if (!found && Array.isArray(rt.cardDecks)) {
            const initLen = rt.cardDecks.length;
            rt.cardDecks = rt.cardDecks.filter((d) => d.id !== entityId);
            if (rt.cardDecks.length < initLen) {
                found = true;
                entityType = 'deck';
            }
        }
        if (found) {
            campaign.rollTables = rt;
            deleted = true;
        }
    }

    if (!deleted) {
        return res.status(404).json({ error: 'Entity not found in campaign' });
    }

    saveCampaigns();
    notifyCampaignSync(campId);
    res.json({ success: true, deletedId: entityId, entityType });
});

// Chat log endpoint (/api/chat when mounted under /api - GM or internal secret only)
campaignsRouter.get('/chat', verifyGmOrSecret, (req, res) => {
    const campaignId = req.query.campaignId || 'default';
    const log = chatLogs[campaignId] || [];
    res.json(log.slice(-100)); // Send last 100 entries
});

// Export full campaign JSON for browser download
campaignsRouter.get('/campaigns/:id/export', verifyGmOrSecret, (req, res) => {
    const campaign = campaigns[req.params.id];
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    const safeName = (campaign.name || campaign.id || 'campaign').replace(/[^a-zA-Z0-9_-]/g, '_');
    const payload = {
        format: 'forgedvtt-campaign-v1',
        exportedAt: new Date().toISOString(),
        campaign,
        chatLog: chatLogs[campaign.id] || []
    };
    res.json({
        success: true,
        fileName: `${safeName}.json`,
        content: JSON.stringify(payload, null, 2)
    });
});

function collectBatchEntities(campaign, entityType) {
    if (entityType === 'map') {
        return Object.values(campaign.maps || {});
    }
    if (entityType === 'player') {
        return Object.values(campaign.characters || {}).filter(
            (c) => !c?.isCompanion && !c?.isCustomNpc && c?.type !== 'npc'
        );
    }
    if (entityType === 'companion') {
        return Object.values(campaign.characters || {}).filter((c) => Boolean(c?.isCompanion));
    }
    if (entityType === 'customNpc' || entityType === 'npc') {
        return Object.values(campaign.characters || {}).filter((c) => Boolean(c?.isCustomNpc || c?.type === 'npc'));
    }
    if (entityType === 'tablesAndDecks' || entityType === 'table') {
        return [
            ...(campaign.rollTables?.customTables || []),
            ...(campaign.rollTables?.assetTables || []),
            ...(campaign.assetTables || []),
            ...(campaign.rollTables?.cardDecks || [])
        ];
    }
    return [];
}

// Export single entity or batch of entities (map, character, table, deck) for browser download
campaignsRouter.get('/campaigns/:id/export-granular', verifyGmOrSecret, (req, res) => {
    const campaign = campaigns[req.params.id];
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

    const entityType = String(req.query.entityType || '');
    const entityId = String(req.query.entityId || '');
    const isBatch = String(req.query.batch || '').toLowerCase() === 'true';

    if (isBatch) {
        const items = collectBatchEntities(campaign, entityType);
        if (!items.length) {
            return res.status(404).json({ success: false, error: 'No items found to export' });
        }
        const safeType = entityType.replace(/[^a-zA-Z0-9_-]/g, '_') || 'entities';
        const payload = {
            format: 'forgedvtt-batch-v1',
            entityType,
            exportedAt: new Date().toISOString(),
            items
        };
        return res.json({
            success: true,
            count: items.length,
            fileName: `${campaign.id}-${safeType}-batch.json`,
            content: JSON.stringify(payload, null, 2)
        });
    }

    let entity = null;

    if (entityType === 'map') {
        entity = campaign.maps?.[entityId];
    } else if (['player', 'companion', 'customNpc', 'npc', 'character'].includes(entityType)) {
        entity = campaign.characters?.[entityId];
    } else if (entityType === 'table') {
        entity =
            (campaign.rollTables?.customTables || []).find((t) => t.id === entityId) ||
            (campaign.rollTables?.assetTables || []).find((t) => t.id === entityId) ||
            (campaign.assetTables || []).find((t) => t.id === entityId);
    } else if (entityType === 'deck') {
        entity = (campaign.rollTables?.cardDecks || []).find((d) => d.id === entityId);
    }

    if (!entity) {
        return res.status(404).json({ success: false, error: 'Entity not found' });
    }

    const safeName = (entity.name || entityId || 'entity').replace(/[^a-zA-Z0-9_-]/g, '_');
    const payload = {
        format: 'forgedvtt-entity-v1',
        entityType,
        exportedAt: new Date().toISOString(),
        entity
    };
    res.json({
        success: true,
        fileName: `${safeName}.json`,
        content: JSON.stringify(payload, null, 2)
    });
});

// Full Server Backup Export (JSON snapshot for browser download)
campaignsRouter.get('/server/backup', verifyGmOrSecret, (req, res) => {
    let sourcesConfig = null;
    try {
        const srcCfgPath = path.join(DATA_DIR, 'sources-config.json');
        if (fs.existsSync(srcCfgPath)) {
            sourcesConfig = JSON.parse(fs.readFileSync(srcCfgPath, 'utf8'));
        }
    } catch (_) {}

    const backupPayload = {
        format: 'forgedvtt-backup-v1',
        exportedAt: new Date().toISOString(),
        campaigns,
        chatLogs,
        sourcesConfig
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.json({
        success: true,
        fileName: `ForgeDVTT-Backup-${stamp}.json`,
        content: JSON.stringify(backupPayload, null, 2)
    });
});

const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Full Server Backup Restore (from uploaded JSON)
campaignsRouter.post('/server/restore', verifyGmOrSecret, (req, res) => {
    const raw = req.body?.backupData || req.body;
    if (!raw || typeof raw !== 'object' || !raw.campaigns || typeof raw.campaigns !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid backup JSON: missing campaigns object.' });
    }

    let restoredCount = 0;
    for (const [id, camp] of Object.entries(raw.campaigns)) {
        if (RESERVED_OBJECT_KEYS.has(id) || !camp || typeof camp !== 'object') continue;
        campaigns[id] = camp;
        restoredCount++;
    }
    if (raw.chatLogs && typeof raw.chatLogs === 'object') {
        for (const [id, log] of Object.entries(raw.chatLogs)) {
            if (RESERVED_OBJECT_KEYS.has(id) || !Array.isArray(log)) continue;
            chatLogs[id] = log;
        }
    }
    if (raw.sourcesConfig && typeof raw.sourcesConfig === 'object') {
        try {
            fs.writeFileSync(
                path.join(DATA_DIR, 'sources-config.json'),
                JSON.stringify(raw.sourcesConfig, null, 2),
                'utf8'
            );
        } catch (_) {}
    }

    saveCampaigns(true);
    saveChat(true);
    for (const id of Object.keys(raw.campaigns)) {
        notifyCampaignSync(id);
    }

    res.json({ success: true, restoredCount });
});

// Generic asset upload for web /prep (tokens, portraits, icons)
const prepAssetUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname) || '.png';
            const base = path
                .basename(file.originalname, ext)
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
            cb(null, `${base}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 15 * 1024 * 1024 }
});

campaignsRouter.post('/server/upload-asset', verifyGmOrSecret, prepAssetUpload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    res.json({
        success: true,
        url: `/vtt-uploads/${req.file.filename}`,
        filename: req.file.filename
    });
});

// Roll20 auto-conversion helper export check (kept ready for /campaigns/:id/import-entity)
export function maybeConvertRoll20Item(item) {
    if (isRoll20CharacterJson(item)) return convertRoll20Character(item);
    if (isRoll20TableJson(item)) return convertRoll20TableToVTT(item);
    return item;
}
