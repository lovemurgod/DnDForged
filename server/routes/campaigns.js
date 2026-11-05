import express from 'express';
import path from 'path';
import fs from 'fs';
import {
    DATA_DIR,
    campaigns,
    chatLogs,
    extractSubdomain,
    getOrCreateCampaign,
    isAuthorizedGmOrSecret,
    saveCampaigns,
    saveChat,
    verifyGmOrSecret
} from '../state.js';
import { createCampaignTemplate } from '../../utils.js';

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
    if (sub) {
        getOrCreateCampaign(sub);
    }
    const isAuthed = isAuthorizedGmOrSecret(req);
    const campaignsList = Object.values(campaigns).map((c) => {
        if (!isAuthed) {
            // Intentionally public metadata to populate login campaign selector
            return {
                id: c.id,
                name: c.name
            };
        }
        return {
            id: c.id,
            name: c.name,
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
        } else {
            // It's a character (player sheet, companion, custom NPC)
            let charId = item.id;
            let charName = item.name || 'Imported Character';
            if (!charId || campaign.characters[charId]) {
                charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                charName = `${charName} (Copy)`;
            }
            const clonedChar = { ...item, id: charId, name: charName };
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
