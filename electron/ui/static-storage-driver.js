/**
 * static-storage-driver.js
 * Pure browser storage engine for Static Web /prep (forgedvtt.com/prep).
 * Supports Chrome/Edge File System Access API ("Choose Campaign Folder") to read/write
 * the exact same folder layout as ForgeDVTT Desktop (campaigns.json, sources-config.json,
 * sources/, uploads/), with automatic IndexedDB fallback for Safari/Firefox/mobile.
 */
(function (global) {
    'use strict';

    const IDB_NAME = 'forgedvtt_static_db';
    const IDB_STORE = 'kv';
    const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    function generateRoomCode() {
        const bytes = new Uint8Array(8);
        if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
            global.crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
            if (i === 3) code += '-';
        }
        return code;
    }

    function detectCategoryAndEntries(rawJson) {
        if (!rawJson || typeof rawJson !== 'object') {
            return { category: 'bestiary', entryCount: 0, sourceCode: '' };
        }
        const keyMap = [
            ['monster', 'bestiary'],
            ['spell', 'spells'],
            ['item', 'items'],
            ['baseitem', 'items'],
            ['class', 'classes'],
            ['subclass', 'classes'],
            ['race', 'races'],
            ['feat', 'feats'],
            ['background', 'backgrounds'],
            ['table', 'tables']
        ];
        let detectedCategory = 'bestiary';
        let entryCount = Array.isArray(rawJson) ? rawJson.length : 0;
        if (!Array.isArray(rawJson)) {
            for (const [k, cat] of keyMap) {
                if (Array.isArray(rawJson[k]) && rawJson[k].length > 0) {
                    detectedCategory = cat;
                    entryCount = rawJson[k].length;
                    break;
                }
            }
        }
        const metaSrc = rawJson._meta?.sources?.[0]?.json || rawJson._meta?.sources?.[0]?.abbreviation || '';
        return { category: detectedCategory, entryCount, sourceCode: String(metaSrc || '').toUpperCase() };
    }

    const SOURCE_CATEGORIES = [
        { id: 'bestiary', name: 'Bestiary', icon: '🐉', description: 'Monsters, NPCs & Creatures' },
        { id: 'spells', name: 'Spells', icon: '✨', description: 'Arcane, Divine & Primal Magic' },
        { id: 'items', name: 'Items & Equipment', icon: '⚔️', description: 'Weapons, Armor & Magic Items' },
        { id: 'classes', name: 'Classes & Subclasses', icon: '🛡️', description: 'Core Classes, Subclasses & Kits' },
        { id: 'races', name: 'Races & Lineages', icon: '🧝', description: 'Player Species, Lineages & Heritages' },
        { id: 'feats', name: 'Feats & Traits', icon: '📜', description: 'Feats, Boons & Supernatural Gifts' },
        { id: 'backgrounds', name: 'Backgrounds', icon: '🎭', description: 'Origins, Backgrounds & Characteristics' }
    ];

    function openIdb() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbGet(key) {
        const db = await openIdb();
        if (!db) return null;
        return await new Promise((resolve) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
        });
    }

    async function idbSet(key, val) {
        const db = await openIdb();
        if (!db) return;
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(val, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function createDefaultCampaign(id = 'default', name = 'Default Campaign') {
        const defaultMapId = `map_${id}_default_${Date.now()}`;
        return {
            id,
            name,
            activeMapId: defaultMapId,
            activeGMMapId: defaultMapId,
            maps: {
                [defaultMapId]: {
                    id: defaultMapId,
                    name: 'Initial Map',
                    mapImage: '',
                    grid: { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5 },
                    tokens: {},
                    walls: [],
                    lights: [],
                    shapes: {},
                    drawings: {},
                    traps: [],
                    portals: []
                }
            },
            initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false },
            characters: {},
            description: '',
            allowedUsers: [],
            knownPlayers: []
        };
    }

    class StaticStorageDriver {
        constructor() {
            this.dirHandle = null;
            this.hasFsAccess = typeof global.showDirectoryPicker === 'function';
            this.campaigns = {};
            this.chatLogs = {};
            this.sourcesConfig = {
                disabledSources: { global: [], campaigns: {} },
                customSources: [],
                uiState: { lastPreset: '2024-ruleset', lastScope: '', includePartnered: true, includeUA: true }
            };
            this.gmCredentials = { username: '', hasPassword: false };
            this.p2pRoomCode = this._loadRoomCode();
            this._initialized = false;
        }

        _loadRoomCode() {
            try {
                const saved = localStorage.getItem('forgedvtt_static_p2p_code');
                if (saved) return saved;
                const code = generateRoomCode();
                localStorage.setItem('forgedvtt_static_p2p_code', code);
                return code;
            } catch (_) {
                return generateRoomCode();
            }
        }

        async init() {
            if (this._initialized) return;
            this._initialized = true;

            // Try restoring remembered directory handle
            if (this.hasFsAccess) {
                try {
                    const savedHandle = await idbGet('fs_dir_handle');
                    if (savedHandle && (await savedHandle.queryPermission({ mode: 'readwrite' })) === 'granted') {
                        this.dirHandle = savedHandle;
                    }
                } catch (_) {}
            }

            await this.reloadAll();
        }

        getDataPathLabel() {
            if (this.dirHandle) {
                return `Local Folder: ${this.dirHandle.name}`;
            }
            if (this.hasFsAccess) {
                return 'Browser Storage (Click "Change Folder..." to link a PC folder)';
            }
            return 'Browser Storage (IndexedDB)';
        }

        async pickCampaignFolder() {
            if (!this.hasFsAccess) {
                return {
                    success: false,
                    canceled: true,
                    error: 'Your browser does not support folder picking. Use Chrome or Edge on desktop, or use Export/Import.'
                };
            }
            try {
                const handle = await global.showDirectoryPicker({ mode: 'readwrite' });
                this.dirHandle = handle;
                await idbSet('fs_dir_handle', handle);
                await this.reloadAll();
                return { success: true, canceled: false, path: this.getDataPathLabel() };
            } catch (err) {
                if (err?.name === 'AbortError') return { canceled: true };
                return { success: false, canceled: true, error: err?.message || 'Could not open folder' };
            }
        }

        async reconnectRememberedFolder() {
            if (!this.hasFsAccess) return false;
            try {
                const savedHandle = await idbGet('fs_dir_handle');
                if (!savedHandle) return false;
                const perm = await savedHandle.requestPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                    this.dirHandle = savedHandle;
                    await this.reloadAll();
                    return true;
                }
            } catch (_) {}
            return false;
        }

        async _readJsonFromDir(fileName) {
            if (!this.dirHandle) return null;
            try {
                const fileHandle = await this.dirHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                return JSON.parse(await file.text());
            } catch (_) {
                return null;
            }
        }

        async _writeJsonToDir(fileName, data) {
            if (!this.dirHandle) return;
            const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        }

        async reloadAll() {
            if (this.dirHandle) {
                const diskCamps = await this._readJsonFromDir('campaigns.json');
                this.campaigns =
                    diskCamps && typeof diskCamps === 'object' ? diskCamps : { default: createDefaultCampaign() };
                const diskChat = await this._readJsonFromDir('chat-log.json');
                this.chatLogs = diskChat && typeof diskChat === 'object' ? diskChat : {};
                const diskSrc = await this._readJsonFromDir('sources-config.json');
                if (diskSrc && typeof diskSrc === 'object') {
                    this.sourcesConfig = { ...this.sourcesConfig, ...diskSrc };
                }
                const diskCreds = await this._readJsonFromDir('gm-credentials.json');
                if (diskCreds && typeof diskCreds === 'object') {
                    this.gmCredentials = diskCreds;
                }
                // Mirror to IndexedDB so /play tab on same origin can read active campaign immediately
                await idbSet('campaigns', this.campaigns);
            } else {
                const idbCamps = await idbGet('campaigns');
                this.campaigns =
                    idbCamps && typeof idbCamps === 'object' && Object.keys(idbCamps).length
                        ? idbCamps
                        : { default: createDefaultCampaign() };
                this.chatLogs = (await idbGet('chatLogs')) || {};
                const idbSrc = await idbGet('sourcesConfig');
                if (idbSrc) this.sourcesConfig = { ...this.sourcesConfig, ...idbSrc };
                const idbCreds = await idbGet('gmCredentials');
                if (idbCreds) this.gmCredentials = idbCreds;
            }
            this._syncDisabledSourcesCache();
            this._syncGmCredentialsCache();
        }

        _syncGmCredentialsCache() {
            try {
                if (this.gmCredentials && this.gmCredentials.username) {
                    localStorage.setItem('forgedvtt_static_gm_creds', JSON.stringify(this.gmCredentials));
                }
            } catch (_) {}
        }

        _syncDisabledSourcesCache() {
            try {
                localStorage.setItem(
                    'forgedvtt_static_disabled_sources',
                    JSON.stringify(this.sourcesConfig.disabledSources?.global || [])
                );
                localStorage.setItem(
                    'forgedvtt_static_campaign_sources',
                    JSON.stringify(this.sourcesConfig.disabledSources?.campaigns || {})
                );
            } catch (_) {}
        }

        async _saveCampaigns() {
            await idbSet('campaigns', this.campaigns);
            if (this.dirHandle) {
                await this._writeJsonToDir('campaigns.json', this.campaigns);
            }
        }

        async _saveSourcesConfig() {
            this._syncDisabledSourcesCache();
            await idbSet('sourcesConfig', this.sourcesConfig);
            if (this.dirHandle) {
                await this._writeJsonToDir('sources-config.json', this.sourcesConfig);
            }
        }

        async getAllSources(campaignId = null) {
            const disabledGlobal = new Set(this.sourcesConfig.disabledSources?.global || []);
            const campOverrides = campaignId ? this.sourcesConfig.disabledSources?.campaigns?.[campaignId] : null;
            const disabledCamp = Array.isArray(campOverrides) ? new Set(campOverrides) : null;
            const isEnabled = (code) => (disabledCamp ? !disabledCamp.has(code) : !disabledGlobal.has(code));

            const builtinCategories = SOURCE_CATEGORIES.map((cat) => {
                const builtins = [
                    {
                        code: 'SRD 5.1',
                        name: 'D&D 5e SRD 5.1 (2014)',
                        category: cat.id,
                        isBuiltin: true,
                        isCustom: false,
                        enabled: isEnabled('SRD 5.1')
                    },
                    {
                        code: 'SRD 5.2',
                        name: 'D&D 5e SRD 5.2 (2024)',
                        category: cat.id,
                        isBuiltin: true,
                        isCustom: false,
                        enabled: isEnabled('SRD 5.2')
                    }
                ];
                const customForCat = (this.sourcesConfig.customSources || [])
                    .filter((s) => s.category === cat.id)
                    .map((s) => ({
                        ...s,
                        isBuiltin: false,
                        isCustom: true,
                        enabled: isEnabled(s.code)
                    }));
                return {
                    ...cat,
                    sources: [...builtins, ...customForCat]
                };
            });

            const flatSources = builtinCategories.flatMap((c) => c.sources);
            return {
                success: true,
                categories: builtinCategories,
                sources: flatSources,
                uiState: this.sourcesConfig.uiState,
                hasCampaignOverride: Boolean(campOverrides),
                isCampaignScoped: Boolean(campaignId),
                campaignOverrideCount: Array.isArray(campOverrides) ? campOverrides.length : 0
            };
        }

        async toggleSource(code, enabled, campaignId = null) {
            if (!this.sourcesConfig.disabledSources) {
                this.sourcesConfig.disabledSources = { global: [], campaigns: {} };
            }
            const targetList = campaignId
                ? (this.sourcesConfig.disabledSources.campaigns[campaignId] =
                      this.sourcesConfig.disabledSources.campaigns[campaignId] || [])
                : this.sourcesConfig.disabledSources.global;

            const idx = targetList.indexOf(code);
            if (enabled && idx !== -1) targetList.splice(idx, 1);
            if (!enabled && idx === -1) targetList.push(code);

            await this._saveSourcesConfig();
            return { success: true };
        }

        async setGmCredentials({ username, password, clearPassword }) {
            const cleanUser = (username || '').trim();
            if (!cleanUser) return { success: false, error: 'Username cannot be empty.' };

            let salt = this.gmCredentials?.salt || '';
            let sha256Hash = this.gmCredentials?.sha256Hash || '';
            let hasPassword = Boolean(this.gmCredentials?.hasPassword);

            if (clearPassword) {
                salt = '';
                sha256Hash = '';
                hasPassword = false;
            } else if (password && String(password).trim() !== '') {
                const bytes = new Uint8Array(16);
                global.crypto.getRandomValues(bytes);
                salt = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
                const enc = new TextEncoder().encode(`${salt}:${String(password)}`);
                const digest = await global.crypto.subtle.digest('SHA-256', enc);
                sha256Hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
                hasPassword = true;
            }

            this.gmCredentials = { username: cleanUser, salt, sha256Hash, hasPassword };
            await idbSet('gmCredentials', this.gmCredentials);
            if (this.dirHandle) {
                await this._writeJsonToDir('gm-credentials.json', this.gmCredentials);
            }
            try {
                localStorage.setItem('forgedvtt_static_gm_creds', JSON.stringify(this.gmCredentials));
            } catch (_) {}
            return { success: true, username: cleanUser, hasPassword };
        }

        exportGranular({ campaignId, entityType, entityId, batch = false }) {
            const camp = this.campaigns[campaignId];
            if (!camp) return { success: false, error: 'Campaign not found' };

            if (batch) {
                let items = [];
                if (entityType === 'map') {
                    items = Object.values(camp.maps || {});
                } else if (entityType === 'player') {
                    items = Object.values(camp.characters || {}).filter(
                        (c) => !c?.isCompanion && !c?.isCustomNpc && c?.type !== 'npc'
                    );
                } else if (entityType === 'companion') {
                    items = Object.values(camp.characters || {}).filter((c) => c?.isCompanion);
                } else if (entityType === 'customNpc') {
                    items = Object.values(camp.characters || {}).filter((c) => c?.isCustomNpc || c?.type === 'npc');
                } else if (entityType === 'tablesAndDecks') {
                    items = [
                        ...(camp.rollTables?.customTables || []),
                        ...(camp.rollTables?.assetTables || []),
                        ...(camp.rollTables?.cardDecks || [])
                    ];
                }
                if (!items.length) return { success: false, error: 'No items found to export' };
                const fileName = `${camp.id}-${entityType}-batch.json`;
                return {
                    success: true,
                    count: items.length,
                    fileName,
                    filePath: fileName,
                    content: JSON.stringify({ format: 'forgedvtt-batch-v1', entityType, items }, null, 2)
                };
            }

            let entity = null;
            if (entityType === 'map') entity = camp.maps?.[entityId];
            else if (['player', 'companion', 'customNpc', 'npc', 'character'].includes(entityType)) {
                entity = camp.characters?.[entityId];
            } else if (entityType === 'table') {
                entity =
                    (camp.rollTables?.customTables || []).find((t) => t.id === entityId) ||
                    (camp.rollTables?.assetTables || []).find((t) => t.id === entityId) ||
                    (camp.assetTables || []).find((t) => t.id === entityId);
            } else if (entityType === 'deck') {
                entity = (camp.rollTables?.cardDecks || []).find((d) => d.id === entityId);
            }
            if (!entity) return { success: false, error: 'Entity not found' };
            const safe = (entity.name || entityId || 'entity').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `${safe}.json`;
            return {
                success: true,
                count: 1,
                fileName,
                filePath: fileName,
                content: JSON.stringify({ format: 'forgedvtt-entity-v1', entityType, entity }, null, 2)
            };
        }

        async importGranular({ campaignId, entityType, entity }) {
            const camp = this.campaigns[campaignId];
            if (!camp || !entity) return { success: false, error: 'Invalid campaign or entity' };
            camp.maps = camp.maps || {};
            camp.characters = camp.characters || {};
            if (entityType === 'map' || entity.grid || entity.tokens !== undefined) {
                const mapId = `map_${campaignId}_${Date.now()}`;
                camp.maps[mapId] = { ...entity, id: mapId };
            } else {
                const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                camp.characters[charId] = { ...entity, id: charId };
            }
            await this._saveCampaigns();
            return { success: true, count: 1, campaign: camp };
        }

        async deleteEntity({ campaignId, entityId }) {
            const camp = this.campaigns[campaignId];
            if (!camp) return { success: false, error: 'Campaign not found' };
            if (camp.maps?.[entityId]) {
                if (Object.keys(camp.maps).length <= 1) {
                    return { success: false, error: 'Cannot delete the only map in the campaign.' };
                }
                delete camp.maps[entityId];
                if (camp.activeMapId === entityId) camp.activeMapId = Object.keys(camp.maps)[0];
            } else if (camp.characters?.[entityId]) {
                delete camp.characters[entityId];
            } else if (camp.rollTables) {
                for (const k of ['customTables', 'assetTables', 'cardDecks']) {
                    if (Array.isArray(camp.rollTables[k])) {
                        camp.rollTables[k] = camp.rollTables[k].filter((x) => x.id !== entityId);
                    }
                }
            }
            await this._saveCampaigns();
            return { success: true, deletedId: entityId };
        }

        async batchToggle({ codes = [], enabled, campaignId = null }) {
            for (const c of codes) await this.toggleSource(c, enabled, campaignId);
            return { success: true, count: codes.length };
        }

        async togglePartnered({ enabled, campaignId = null }) {
            this.sourcesConfig.uiState.includePartnered = Boolean(enabled);
            await this._saveSourcesConfig();
            return { success: true, campaignId };
        }

        async toggleUA({ enabled, campaignId = null }) {
            this.sourcesConfig.uiState.includeUA = Boolean(enabled);
            await this._saveSourcesConfig();
            return { success: true, campaignId };
        }

        async saveUiState(uiState = {}) {
            this.sourcesConfig.uiState = { ...this.sourcesConfig.uiState, ...uiState };
            await this._saveSourcesConfig();
            return { success: true };
        }

        async applyPreset({ preset, campaignId = null }) {
            const customSources = this.sourcesConfig.customSources || [];
            const setEnabledForAll = async (isEnabledFn) => {
                await this.toggleSource(
                    'SRD 5.1',
                    Boolean(isEnabledFn({ code: 'SRD 5.1', edition: '2014' })),
                    campaignId
                );
                await this.toggleSource(
                    'SRD 5.2',
                    Boolean(isEnabledFn({ code: 'SRD 5.2', edition: '2024' })),
                    campaignId
                );
                const seen = new Set(['SRD 5.1', 'SRD 5.2']);
                for (const src of customSources) {
                    if (!src?.code || seen.has(src.code)) continue;
                    seen.add(src.code);
                    await this.toggleSource(src.code, Boolean(isEnabledFn(src)), campaignId);
                }
            };

            switch (preset) {
                case '2024-ruleset':
                    await setEnabledForAll((s) => s.code !== 'SRD 5.1' && s.edition !== '2014');
                    break;
                case '2014-classic':
                    await setEnabledForAll((s) => s.code !== 'SRD 5.2' && s.edition !== '2024');
                    break;
                case 'core-only':
                case 'all-official':
                    await setEnabledForAll((s) => s.code === 'SRD 5.1' || s.code === 'SRD 5.2');
                    break;
                case 'everything':
                    await setEnabledForAll(() => true);
                    break;
                case 'disable-all':
                    await setEnabledForAll(() => false);
                    break;
                default:
                    return { success: false, error: `Unknown preset '${preset}'` };
            }

            this.sourcesConfig.uiState.lastPreset = preset;
            await this._saveSourcesConfig();
            return { success: true };
        }

        async resetCampaignSources(campaignId) {
            if (campaignId && this.sourcesConfig.disabledSources?.campaigns) {
                delete this.sourcesConfig.disabledSources.campaigns[campaignId];
                await this._saveSourcesConfig();
            }
            return { success: true };
        }

        getSourceDetails({ category, code }) {
            const found = (this.sourcesConfig.customSources || []).find(
                (s) => s.code === code && (!category || s.category === category)
            );
            if (found) {
                const rawJson =
                    typeof found.rawJson === 'string' ? found.rawJson : JSON.stringify(found.data || {}, null, 2);
                return {
                    success: true,
                    source: { ...found, isCustom: true, isBuiltin: false, filePath: 'Browser Storage' },
                    rawJson,
                    data: found.data || {}
                };
            }
            return {
                success: true,
                source: {
                    code,
                    category: category || 'bestiary',
                    isBuiltin: true,
                    isCustom: false,
                    filePath: 'SRD Compendium'
                },
                rawJson: '{}',
                data: {}
            };
        }

        async saveSourceDetails(data) {
            const list = this.sourcesConfig.customSources || (this.sourcesConfig.customSources = []);
            const idx = list.findIndex((s) => s.code === data.code && s.category === data.category);
            let parsedData = data.data;
            if (!parsedData && typeof data.rawJson === 'string') {
                try {
                    parsedData = JSON.parse(data.rawJson);
                } catch (_) {}
            }
            const nextEntry = {
                ...data,
                ...(parsedData ? { data: parsedData } : {}),
                isCustom: true,
                isBuiltin: false
            };
            if (idx !== -1) list[idx] = { ...list[idx], ...nextEntry };
            else list.push(nextEntry);
            await this._saveSourcesConfig();
            return { success: true };
        }

        async createCustomSource({ category, code, name, author, description, data }) {
            const list = this.sourcesConfig.customSources || (this.sourcesConfig.customSources = []);
            if (list.some((s) => s.code === code && s.category === category)) {
                return { success: false, error: `Source "${code}" already exists.` };
            }
            const created = {
                category,
                code,
                name: name || code,
                author: author || '',
                description: description || '',
                data: data && typeof data === 'object' ? data : {},
                isCustom: true,
                isBuiltin: false
            };
            list.push(created);
            await this._saveSourcesConfig();
            return { success: true, source: created };
        }

        async deleteCustomSource({ category, code }) {
            this.sourcesConfig.customSources = (this.sourcesConfig.customSources || []).filter(
                (s) => !(s.code === code && s.category === category)
            );
            await this._saveSourcesConfig();
            return { success: true };
        }

        async addDatabaseFile({ category, fileName, content }) {
            let parsed;
            try {
                parsed = typeof content === 'string' ? JSON.parse(content) : content;
            } catch (err) {
                return { success: false, error: `Invalid JSON: ${err.message}` };
            }
            const code = (fileName || 'custom').replace(/\.json$/i, '').toUpperCase();
            return await this.createCustomSource({ category, code, name: code, data: parsed });
        }

        exportSource({ category, code }) {
            const found = (this.sourcesConfig.customSources || []).find(
                (s) => s.code === code && (!category || s.category === category)
            );
            if (!found) return { success: false, error: 'Custom source not found' };
            return { success: true, fileName: `${code}.json`, content: JSON.stringify(found.data || found, null, 2) };
        }

        async searchCompendium({ category, query = '', limit = 50 }) {
            if (!category || category === 'all') {
                return await this.searchAllCompendium({ query, limit });
            }
            const catMap = {
                bestiary: '../play/data/bestiary-catalog.json',
                spells: '../play/data/spells-catalog.json',
                items: '../play/data/items-catalog.json',
                classes: '../play/data/classes-catalog.json',
                races: '../play/data/races-catalog.json',
                feats: '../play/data/feats-catalog.json',
                backgrounds: '../play/data/backgrounds-catalog.json'
            };
            const url = catMap[category];
            if (!url) return { success: true, results: [] };
            try {
                const res = await fetch(url);
                if (!res.ok) return { success: true, results: [] };
                const data = await res.json();
                const items = Array.isArray(data) ? data : data?.entries || data?.items || [];
                const q = query.trim().toLowerCase();
                const filtered = q
                    ? items.filter((it) =>
                          String(it.name || '')
                              .toLowerCase()
                              .includes(q)
                      )
                    : items;
                return { success: true, results: filtered.slice(0, limit).map((it) => ({ ...it, category })) };
            } catch (_) {
                return { success: false, results: [] };
            }
        }

        async searchAllCompendium({ query = '', category, limit = 50 }) {
            const cats =
                category && category !== 'all'
                    ? [category]
                    : ['bestiary', 'spells', 'items', 'classes', 'races', 'feats', 'backgrounds'];
            const all = [];
            for (const c of cats) {
                const { results } = await this.searchCompendium({ category: c, query, limit });
                all.push(...results);
                if (all.length >= limit) break;
            }
            return { success: true, results: all.slice(0, limit) };
        }

        async getEntityFullData({ category, name, source }) {
            const { results } = await this.searchCompendium({ category, query: name, limit: 25 });
            const match = results.find(
                (r) =>
                    String(r.name || '').toLowerCase() === String(name || '').toLowerCase() &&
                    (!source || String(r.source || '').toLowerCase() === String(source).toLowerCase())
            );
            return match ? { success: true, entity: match } : { success: false, error: 'Entry not found' };
        }

        inspectImportFiles(files = []) {
            const existing = new Set((this.sourcesConfig.customSources || []).map((s) => s.code));
            const candidates = (files || []).map((f) => {
                let parsed = null;
                try {
                    parsed = typeof f?.content === 'string' ? JSON.parse(f.content) : f?.content;
                } catch (_) {}
                const detected = detectCategoryAndEntries(parsed);
                const fileName = f?.name || f?.fileName || 'custom.json';
                const detectedSource =
                    detected.sourceCode ||
                    String(fileName)
                        .replace(/\.json$/i, '')
                        .toUpperCase();
                return {
                    fileName,
                    originalPath: fileName,
                    code: detectedSource,
                    detectedSource,
                    detectedCategory: detected.category,
                    category: detected.category,
                    entryCount: detected.entryCount,
                    content: f?.content,
                    hasConflict: existing.has(detectedSource),
                    conflict: existing.has(detectedSource)
                };
            });
            return { success: true, candidates };
        }

        async bulkImportSources({ candidates = [] }) {
            let count = 0;
            for (const c of candidates) {
                if (c.selected === false) continue;
                const category = c.detectedCategory || c.category || 'bestiary';
                const code =
                    c.detectedSource ||
                    c.code ||
                    String(c.fileName || 'CUSTOM')
                        .replace(/\.json$/i, '')
                        .toUpperCase();
                const res = await this.addDatabaseFile({
                    category,
                    fileName: `${code}.json`,
                    content: c.content
                });
                if (res.success) count++;
            }
            return { success: true, count };
        }

        getP2pStatus() {
            return {
                active: true,
                roomCode: this.p2pRoomCode,
                peerCount: 0,
                peers: []
            };
        }

        regenP2pCode() {
            this.p2pRoomCode = generateRoomCode();
            try {
                localStorage.setItem('forgedvtt_static_p2p_code', this.p2pRoomCode);
            } catch (_) {}
            return this.getP2pStatus();
        }
    }

    global.__staticStorageDriver = new StaticStorageDriver();
})(typeof window !== 'undefined' ? window : globalThis);
