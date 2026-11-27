/**
 * DnDForged VTT - Player & Companion Sheet JSON Import/Export
 * Reuses the native forgedvtt-entity-v1 / forgedvtt-batch-v1 schemas
 * (compatible with GM Dashboard export-granular / import-entity) and raw character JSON.
 */

const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const MAX_SHEET_JSON_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates that an imported File object is within the allowed size limit.
 * @param {{ size?: number }} file
 */
export function validateImportFileSize(file) {
    if (file && typeof file.size === 'number' && file.size > MAX_SHEET_JSON_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        throw new Error(`File is too large (${mb} MB). Maximum allowed sheet JSON size is 5 MB.`);
    }
}

/**
 * Recursively clones an object while stripping prototype-pollution keys.
 * @param {any} value
 * @returns {any}
 */
export function sanitizeSheetJsonObject(value) {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeSheetJsonObject(item));
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (RESERVED_OBJECT_KEYS.has(k)) continue;
        out[k] = sanitizeSheetJsonObject(v);
    }
    return out;
}

/**
 * Builds a forgedvtt-entity-v1 JSON payload and safe filename for a PC or Companion.
 * @param {object} char
 * @returns {{ payload: object, fileName: string }}
 */
export function buildCharacterExportPayload(char) {
    if (!char || typeof char !== 'object') {
        throw new Error('Invalid character data for export.');
    }
    const isCompanion = Boolean(char.isCompanion);
    const entityType = isCompanion ? 'companion' : 'player';
    const safeName =
        String(char.name || char.id || entityType)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '') || entityType;

    const cleanEntity = sanitizeSheetJsonObject(JSON.parse(JSON.stringify(char)));
    cleanEntity.isCompanion = isCompanion;
    const payload = {
        format: 'forgedvtt-entity-v1',
        entityType,
        exportedAt: new Date().toISOString(),
        entity: cleanEntity
    };
    return {
        payload,
        fileName: `${safeName}.json`
    };
}

/**
 * Triggers a browser JSON file download.
 * @param {object} payload
 * @param {string} fileName
 */
export function triggerJsonDownload(payload, fileName) {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'character.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parses raw JSON text into a normalized list of candidate character/companion entities.
 * Supports forgedvtt-entity-v1, forgedvtt-batch-v1, and raw character/companion JSON.
 * @param {string} rawText
 * @returns {{ format: string, entityType: string|null, items: object[] }}
 */
export function parseImportedSheetJson(rawText) {
    if (typeof rawText !== 'string' || !rawText.trim()) {
        throw new Error('The selected file is empty.');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (err) {
        throw new Error(`Invalid JSON file: ${err.message}`, { cause: err });
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('JSON root must be an object or array of characters.');
    }

    if (parsed.format === 'forgedvtt-campaign-v1' || parsed.campaign) {
        throw new Error('Full campaign backups cannot be imported here. Use the GM Dashboard campaign importer.');
    }
    if (parsed.format === 'forgedvtt-server-backup-v1') {
        throw new Error('Server backups cannot be imported here.');
    }

    const declaredType = typeof parsed.entityType === 'string' ? parsed.entityType : null;
    if (declaredType && !['player', 'companion', 'character'].includes(declaredType)) {
        throw new Error(
            `Unsupported entity type "${declaredType}". Only Player Characters and Companions can be imported here.`
        );
    }

    let items;
    if (parsed.format === 'forgedvtt-entity-v1' && parsed.entity && typeof parsed.entity === 'object') {
        items = [parsed.entity];
    } else if (parsed.format === 'forgedvtt-batch-v1' && Array.isArray(parsed.items)) {
        items = parsed.items;
    } else if (Array.isArray(parsed.items)) {
        items = parsed.items;
    } else if (Array.isArray(parsed.entities)) {
        items = parsed.entities;
    } else if (Array.isArray(parsed)) {
        items = parsed;
    } else if (parsed.entity && typeof parsed.entity === 'object') {
        items = [parsed.entity];
    } else {
        items = [parsed];
    }

    const validObjects = items.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (validObjects.length === 0) {
        throw new Error('No character or companion entries were found in this JSON file.');
    }

    return {
        format: typeof parsed.format === 'string' ? parsed.format : 'raw-character-json',
        entityType: declaredType,
        items: validObjects
    };
}

/**
 * Validates and sanitizes a single imported entity, enforcing GM-only Companion import rules.
 * @param {object} rawEntity
 * @param {{ isGM?: boolean, declaredEntityType?: string|null }} [options]
 * @returns {{ entity: object, isCompanion: boolean }}
 */
export function validateImportedSheetEntity(rawEntity, options = {}) {
    const { isGM = false, declaredEntityType = null } = options;
    if (!rawEntity || typeof rawEntity !== 'object' || Array.isArray(rawEntity)) {
        throw new Error('Invalid character entry.');
    }

    const sanitized = sanitizeSheetJsonObject(rawEntity);

    // Reject maps, roll tables, decks, and custom NPCs
    if (sanitized.grid || sanitized.tokens !== undefined) {
        throw new Error('Map JSON files cannot be imported into Player Characters.');
    }
    if (sanitized.isAssetTable || sanitized.sides || sanitized.cards || (sanitized.dice && sanitized.rows)) {
        throw new Error('Roll tables and card decks cannot be imported into Player Characters.');
    }
    if (sanitized.isCustomNpc || sanitized.type === 'npc') {
        throw new Error('Custom NPCs cannot be imported here.');
    }

    const isCompanion = Boolean(
        sanitized.isCompanion ||
        declaredEntityType === 'companion' ||
        (sanitized.monsterData && !sanitized.class && !sanitized.classes)
    );

    if (isCompanion && !isGM) {
        throw new Error('Only the GM can import Companion sheets.');
    }

    // Basic sanity check that this resembles a character or companion sheet
    const looksLikeSheet = Boolean(
        sanitized.name ||
        sanitized.characterName ||
        sanitized.stats ||
        sanitized.abilities ||
        sanitized.hpMax !== undefined ||
        sanitized.monsterData ||
        isCompanion
    );
    if (!looksLikeSheet) {
        throw new Error('JSON does not appear to be a valid Player Character or Companion sheet.');
    }

    if (isCompanion) {
        sanitized.isCompanion = true;
    } else {
        delete sanitized.isCompanion;
    }

    if (!sanitized.name && sanitized.characterName) {
        sanitized.name = sanitized.characterName;
    }
    if (!sanitized.name || typeof sanitized.name !== 'string') {
        sanitized.name = isCompanion ? 'Imported Companion' : 'Imported Character';
    }

    return { entity: sanitized, isCompanion };
}

/**
 * Checks whether the current user controls an existing character/companion.
 * @param {object} char
 * @param {{ isGM?: boolean, username?: string }} userContext
 * @returns {boolean}
 */
export function canUserOverwriteCharacter(char, { isGM = false, username = '' } = {}) {
    if (!char) return false;
    if (isGM) return true;
    if (char.isCompanion || char.isCustomNpc) return false;
    if (!username) return false;
    const uLower = username.toLowerCase();
    if (typeof char.owner === 'string' && char.owner.toLowerCase() === uLower) return true;
    if (typeof char.ownerUsername === 'string' && char.ownerUsername.toLowerCase() === uLower) return true;
    if (Array.isArray(char.assignedPlayers)) {
        return char.assignedPlayers.some((p) => typeof p === 'string' && (p === '*' || p.toLowerCase() === uLower));
    }
    return false;
}

/**
 * Finds an existing character/companion conflict by ID first, then by case-insensitive name.
 * Only allows overwriting when the existing character matches the imported entity kind.
 * @param {object} entity
 * @param {Record<string, object>} existingCharacters
 * @param {{ isGM?: boolean, username?: string }} userContext
 * @returns {{ conflictTarget: object|null, matchType: 'id'|'name'|null, canOverwrite: boolean }}
 */
export function findImportConflict(entity, existingCharacters = {}, userContext = {}) {
    if (!entity || !existingCharacters || typeof existingCharacters !== 'object') {
        return { conflictTarget: null, matchType: null, canOverwrite: false };
    }

    const incomingIsComp = Boolean(entity.isCompanion);

    if (entity.id && !RESERVED_OBJECT_KEYS.has(entity.id) && existingCharacters[entity.id]) {
        const target = existingCharacters[entity.id];
        const sameKind = Boolean(target.isCompanion) === incomingIsComp && !target.isCustomNpc;
        return {
            conflictTarget: target,
            matchType: 'id',
            canOverwrite: sameKind && canUserOverwriteCharacter(target, userContext)
        };
    }

    const targetName = String(entity.name || '')
        .trim()
        .toLowerCase();
    if (targetName) {
        const byName = Object.values(existingCharacters).find(
            (c) =>
                c &&
                Boolean(c.isCompanion) === incomingIsComp &&
                !c.isCustomNpc &&
                String(c.name || c.characterName || '')
                    .trim()
                    .toLowerCase() === targetName
        );
        if (byName) {
            return {
                conflictTarget: byName,
                matchType: 'name',
                canOverwrite: canUserOverwriteCharacter(byName, userContext)
            };
        }
    }

    return { conflictTarget: null, matchType: null, canOverwrite: false };
}

const CAMPAIGN_UPLOAD_URL_RE = /(?:^|\/)assets\/campaigns\/([^/\\]+)\/uploads\//i;

/**
 * Scans an imported character/companion for campaign-local upload URLs from another campaign.
 * @param {any} value
 * @param {string|null|undefined} currentCampaignId
 * @returns {string[]}
 */
export function detectCrossCampaignAssetUrls(value, currentCampaignId = null) {
    const found = new Set();
    const visit = (node) => {
        if (typeof node === 'string') {
            const match = node.match(CAMPAIGN_UPLOAD_URL_RE);
            if (match) {
                const sourceCampId = match[1];
                if (!currentCampaignId || sourceCampId !== currentCampaignId) {
                    found.add(node);
                }
            }
            return;
        }
        if (Array.isArray(node)) {
            for (const item of node) visit(item);
            return;
        }
        if (node && typeof node === 'object') {
            for (const val of Object.values(node)) visit(val);
        }
    };
    visit(value);
    return Array.from(found);
}

/**
 * Prepares the final character/companion object for insertion or overwrite.
 * @param {object} entity
 * @param {{ mode?: 'copy'|'overwrite', conflictTarget?: object|null, existingCharacters?: Record<string, object>, isGM?: boolean, username?: string }} options
 * @returns {object}
 */
export function prepareImportedCharacter(entity, options = {}) {
    const { mode = 'copy', conflictTarget = null, existingCharacters = {}, isGM = false, username = '' } = options;

    const prepared = sanitizeSheetJsonObject(entity);
    const isCompanion = Boolean(prepared.isCompanion);
    const canOverwrite =
        mode === 'overwrite' && conflictTarget && canUserOverwriteCharacter(conflictTarget, { isGM, username });

    if (canOverwrite) {
        prepared.id = conflictTarget.id;
        if (!isGM && username) {
            prepared.owner = conflictTarget.owner || username;
            prepared.ownerUsername = conflictTarget.ownerUsername || username;
            if (!Array.isArray(prepared.assignedPlayers) || prepared.assignedPlayers.length === 0) {
                prepared.assignedPlayers = Array.isArray(conflictTarget.assignedPlayers)
                    ? [...conflictTarget.assignedPlayers]
                    : [username];
            }
            if (!Array.isArray(prepared.players) || prepared.players.length === 0) {
                prepared.players = Array.isArray(conflictTarget.players) ? [...conflictTarget.players] : [username];
            }
        }
        return prepared;
    }

    // Create a new copy with a unique ID
    const prefix = isCompanion ? 'comp' : 'char';
    const baseId = prepared.id;
    const idTaken = !baseId || RESERVED_OBJECT_KEYS.has(baseId) || Boolean(existingCharacters[baseId]);
    if (idTaken) {
        prepared.id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }

    // Append (Copy) if name collides with an existing character
    const baseName = String(prepared.name || (isCompanion ? 'Imported Companion' : 'Imported Character')).trim();
    const existingNames = new Set(
        Object.values(existingCharacters)
            .filter(Boolean)
            .map((c) =>
                String(c.name || c.characterName || '')
                    .trim()
                    .toLowerCase()
            )
    );
    if (existingNames.has(baseName.toLowerCase())) {
        let candidate = `${baseName} (Copy)`;
        let counter = 2;
        while (existingNames.has(candidate.toLowerCase())) {
            candidate = `${baseName} (Copy ${counter})`;
            counter += 1;
        }
        prepared.name = candidate;
    } else {
        prepared.name = baseName;
    }

    if (!isGM && username) {
        prepared.owner = username;
        prepared.ownerUsername = username;
        prepared.assignedPlayers = [username];
        prepared.players = [username];
    } else if (isCompanion && !Array.isArray(prepared.assignedPlayers)) {
        prepared.assignedPlayers = [];
    }

    return prepared;
}
