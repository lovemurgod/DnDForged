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
    const STATIC_SYNC_CHANNEL = 'forgedvtt_static_sync';
    const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const INSTANCE_ID = `prep_${Math.random().toString(36).slice(2, 10)}`;

    const SRD_CODE_ALIASES = {
        'SRD 5.1': ['SRD 5.1', 'PHB', 'MM', 'DMG'],
        'SRD 5.2': ['SRD 5.2', 'XPHB', 'XMM', 'XDMG']
    };

    function sanitizeFilenamePart(str) {
        return String(str || '').replace(/[<>:"/\\|?*]/g, '_');
    }

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
            ['optionalfeature', 'feats'],
            ['adventure', 'adventures'],
            ['adventureData', 'adventures'],
            ['table', 'tables']
        ];
        let detectedCategory = typeof rawJson.category === 'string' && rawJson.category ? rawJson.category : 'bestiary';
        let entryCount = Array.isArray(rawJson) ? rawJson.length : 0;
        if (!Array.isArray(rawJson)) {
            for (const [k, cat] of keyMap) {
                if (Array.isArray(rawJson[k]) && rawJson[k].length > 0) {
                    detectedCategory = cat;
                    entryCount = rawJson[k].length;
                    break;
                }
            }
            if (entryCount === 0 && Array.isArray(rawJson.entries)) {
                entryCount = rawJson.entries.length;
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
        { id: 'backgrounds', name: 'Backgrounds', icon: '🎭', description: 'Origins, Backgrounds & Characteristics' },
        {
            id: 'adventures',
            name: 'Adventures & Modules',
            icon: '🗺️',
            description: 'Published Adventures, Encounters & Modules'
        },
        {
            id: 'tables',
            name: 'Rollable Tables & Decks',
            icon: '🎲',
            description: 'Random Tables, Generators & Card Decks'
        }
    ];

    function openIdb() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const req = indexedDB.open(IDB_NAME, 2);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
                if (!db.objectStoreNames.contains('assets')) {
                    db.createObjectStore('assets', { keyPath: 'id' });
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
            rollTables: { tables: [], assetTables: [], decks: [] },
            characters: {},
            description: '',
            allowedUsers: [],
            knownPlayers: [],
            updatedAt: Date.now()
        };
    }

    function mergeCampaignCollections(diskCamps, idbCamps, preferDisk = false) {
        const merged = { ...(diskCamps && typeof diskCamps === 'object' ? diskCamps : {}) };
        if (idbCamps && typeof idbCamps === 'object') {
            for (const [id, idbCamp] of Object.entries(idbCamps)) {
                if (!idbCamp || typeof idbCamp !== 'object') continue;
                const diskCamp = merged[id];
                if (!diskCamp) {
                    if (!preferDisk && Number(idbCamp.updatedAt || 0) > 0) {
                        merged[id] = idbCamp;
                    }
                    continue;
                }
                const idbTs = Number(idbCamp.updatedAt || 0);
                const diskTs = Number(diskCamp.updatedAt || 0);
                if (!preferDisk && idbTs > diskTs) {
                    merged[id] = idbCamp;
                }
            }
        }
        return Object.keys(merged).length ? merged : { default: createDefaultCampaign() };
    }

    class StaticStorageDriver {
        constructor() {
            this.dirHandle = null;
            this.rememberedFolderName = '';
            this.needsFolderReconnect = false;
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
            this._syncChannel = null;
            this._setupSyncChannel();
        }

        _setupSyncChannel() {
            if (typeof global.BroadcastChannel !== 'function' || this._syncChannel) return;
            try {
                this._syncChannel = new global.BroadcastChannel(STATIC_SYNC_CHANNEL);
                this._syncChannel.onmessage = async (event) => {
                    const msg = event?.data;
                    if (!msg || msg.senderId === INSTANCE_ID) return;
                    if (msg.type === 'campaigns-updated' || msg.action === 'CAMPAIGN_UPDATED') {
                        const latest = await idbGet('campaigns');
                        if (latest && typeof latest === 'object') {
                            this.campaigns = mergeCampaignCollections(this.campaigns, latest, false);
                            if (this.dirHandle) {
                                await this._writeJsonToDir('campaigns.json', this.campaigns).catch(() => {});
                                await this._mirrorIdbAssetsToDir().catch(() => {});
                            }
                            if (
                                typeof global.dispatchEvent === 'function' &&
                                typeof global.CustomEvent === 'function'
                            ) {
                                global.dispatchEvent(new global.CustomEvent('forgedvtt:campaigns-updated'));
                            }
                        }
                    }
                };
            } catch (_) {
                this._syncChannel = null;
            }
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
                    if (savedHandle) {
                        this.rememberedFolderName = savedHandle.name || '';
                        const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
                        if (perm === 'granted') {
                            this.dirHandle = savedHandle;
                            this.needsFolderReconnect = false;
                        } else {
                            this.needsFolderReconnect = true;
                        }
                    }
                } catch (_) {}
            }

            await this.reloadAll();
        }

        getDataPathLabel() {
            if (this.dirHandle) {
                return `Local Folder: ${this.dirHandle.name}`;
            }
            if (this.needsFolderReconnect && this.rememberedFolderName) {
                return `Local Folder (${this.rememberedFolderName}) paused — Click "Change Folder..." to reconnect`;
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
                this.rememberedFolderName = handle.name || '';
                this.needsFolderReconnect = false;
                await idbSet('fs_dir_handle', handle);
                await this.reloadAll({ preferDisk: true });
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
                    this.rememberedFolderName = savedHandle.name || '';
                    this.needsFolderReconnect = false;
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

        async reloadAll({ preferDisk = false } = {}) {
            this.gmCredentials = { username: '', hasPassword: false };
            this.sourcesConfig = {
                disabledSources: { global: [], campaigns: {} },
                customSources: [],
                uiState: { lastPreset: '2024-ruleset', lastScope: '', includePartnered: true, includeUA: true }
            };

            if (this.dirHandle) {
                const diskCamps = await this._readJsonFromDir('campaigns.json');
                const idbCamps = await idbGet('campaigns');
                if (diskCamps && typeof diskCamps === 'object') {
                    this.campaigns = mergeCampaignCollections(diskCamps, idbCamps, preferDisk);
                    if (!preferDisk && JSON.stringify(this.campaigns) !== JSON.stringify(diskCamps)) {
                        await this._writeJsonToDir('campaigns.json', this.campaigns);
                    }
                } else {
                    this.campaigns =
                        idbCamps && typeof idbCamps === 'object' && Object.keys(idbCamps).length
                            ? idbCamps
                            : { default: createDefaultCampaign() };
                    await this._writeJsonToDir('campaigns.json', this.campaigns);
                }

                const diskChat = await this._readJsonFromDir('chat-log.json');
                this.chatLogs = diskChat && typeof diskChat === 'object' ? diskChat : (await idbGet('chatLogs')) || {};
                const diskSrc = await this._readJsonFromDir('sources-config.json');
                if (diskSrc && typeof diskSrc === 'object') {
                    this.sourcesConfig = { ...this.sourcesConfig, ...diskSrc };
                }
                const diskCreds = await this._readJsonFromDir('gm-credentials.json');
                if (diskCreds && typeof diskCreds === 'object' && diskCreds.username) {
                    this.gmCredentials = diskCreds;
                }
                // Mirror to IndexedDB so /play tab on same origin can read active campaign immediately
                await idbSet('campaigns', this.campaigns);
                await idbSet('chatLogs', this.chatLogs);
                await idbSet('sourcesConfig', this.sourcesConfig);
                await idbSet('gmCredentials', this.gmCredentials);
                await this._syncAssetsWithDir().catch(() => {});
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
                if (idbCreds && idbCreds.username) this.gmCredentials = idbCreds;
            }
            this._syncDisabledSourcesCache();
            this._syncGmCredentialsCache();
        }

        _syncGmCredentialsCache() {
            try {
                if (this.gmCredentials && this.gmCredentials.username) {
                    localStorage.setItem('forgedvtt_static_gm_creds', JSON.stringify(this.gmCredentials));
                } else {
                    localStorage.removeItem('forgedvtt_static_gm_creds');
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
            const now = Date.now();
            for (const c of Object.values(this.campaigns || {})) {
                if (c && typeof c === 'object' && !c.updatedAt) c.updatedAt = now;
            }
            await idbSet('campaigns', this.campaigns);
            if (this.dirHandle) {
                await this._writeJsonToDir('campaigns.json', this.campaigns);
                await this._mirrorIdbAssetsToDir().catch(() => {});
            }
            if (this._syncChannel) {
                try {
                    this._syncChannel.postMessage({ type: 'campaigns-updated', senderId: INSTANCE_ID });
                } catch (_) {}
            }
        }

        async _saveSourcesConfig() {
            this._syncDisabledSourcesCache();
            await idbSet('sourcesConfig', this.sourcesConfig);
            if (this.dirHandle) {
                await this._writeJsonToDir('sources-config.json', this.sourcesConfig);
            }
            if (this._syncChannel) {
                try {
                    this._syncChannel.postMessage({ type: 'sources-updated', senderId: INSTANCE_ID });
                } catch (_) {}
            }
        }

        async _openAssetIdb() {
            return await new Promise((resolve) => {
                if (typeof indexedDB === 'undefined') return resolve(null);
                const req = indexedDB.open(IDB_NAME, 2);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
                    if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
        }

        async _mirrorIdbAssetsToDir() {
            if (!this.dirHandle) return;
            const db = await this._openAssetIdb();
            if (!db || !db.objectStoreNames.contains('assets')) return;
            const records = await new Promise((resolve) => {
                const tx = db.transaction('assets', 'readonly');
                const req = tx.objectStore('assets').getAll();
                req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                req.onerror = () => resolve([]);
            });
            if (!records.length) return;
            const assetsDir = await this.dirHandle.getDirectoryHandle('assets', { create: true });
            const manifest = {};
            for (const rec of records) {
                if (!rec?.id || !rec.blob) continue;
                manifest[rec.id] = {
                    id: rec.id,
                    name: rec.name || rec.id,
                    path: rec.path || rec.name || rec.id,
                    folderPath: rec.folderPath || '',
                    mimeType: rec.mimeType || rec.blob.type || 'application/octet-stream',
                    createdAt: rec.createdAt || Date.now()
                };
                try {
                    await assetsDir.getFileHandle(rec.id);
                } catch (_) {
                    const fh = await assetsDir.getFileHandle(rec.id, { create: true });
                    const wr = await fh.createWritable();
                    await wr.write(rec.blob);
                    await wr.close();
                }
            }
            const mfh = await assetsDir.getFileHandle('manifest.json', { create: true });
            const mwr = await mfh.createWritable();
            await mwr.write(JSON.stringify(manifest, null, 2));
            await mwr.close();
        }

        async _syncAssetsWithDir() {
            if (!this.dirHandle) return;
            const db = await this._openAssetIdb();
            if (!db || !db.objectStoreNames.contains('assets')) return;
            try {
                const assetsDir = await this.dirHandle.getDirectoryHandle('assets', { create: false });
                let manifest = {};
                try {
                    const mfh = await assetsDir.getFileHandle('manifest.json');
                    const mfile = await mfh.getFile();
                    manifest = JSON.parse(await mfile.text());
                } catch (_) {}
                for await (const [name, handle] of assetsDir.entries()) {
                    if (handle.kind !== 'file' || name === 'manifest.json') continue;
                    const existing = await new Promise((resolve) => {
                        const tx = db.transaction('assets', 'readonly');
                        const req = tx.objectStore('assets').get(name);
                        req.onsuccess = () => resolve(req.result || null);
                        req.onerror = () => resolve(null);
                    });
                    if (!existing) {
                        const file = await handle.getFile();
                        const meta = manifest[name] || {};
                        await new Promise((resolve) => {
                            const tx = db.transaction('assets', 'readwrite');
                            tx.objectStore('assets').put({
                                id: name,
                                name: meta.name || name,
                                path: meta.path || meta.name || name,
                                folderPath: meta.folderPath || '',
                                mimeType: meta.mimeType || file.type || 'application/octet-stream',
                                blob: file,
                                createdAt: meta.createdAt || Date.now()
                            });
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                        });
                    }
                }
            } catch (_) {}
            await this._mirrorIdbAssetsToDir().catch(() => {});
        }

        async getAllSources(campaignId = null) {
            const disabledGlobal = new Set(this.sourcesConfig.disabledSources?.global || []);
            const campOverrides = campaignId ? this.sourcesConfig.disabledSources?.campaigns?.[campaignId] : null;
            const disabledCamp = Array.isArray(campOverrides) ? new Set(campOverrides) : null;
            const activeDisabled = disabledCamp || disabledGlobal;
            const isSrdEnabled = (srdCode, catId) => {
                if (activeDisabled.has(srdCode)) return false;
                const catPrimary =
                    srdCode === 'SRD 5.1'
                        ? catId === 'bestiary'
                            ? 'MM'
                            : catId === 'items'
                              ? 'DMG'
                              : 'PHB'
                        : catId === 'bestiary'
                          ? 'XMM'
                          : catId === 'items'
                            ? 'XDMG'
                            : 'XPHB';
                return !activeDisabled.has(catPrimary);
            };
            const isEnabled = (code) => !activeDisabled.has(code);

            const builtinCategories = SOURCE_CATEGORIES.map((cat) => {
                const builtins = [
                    {
                        code: 'SRD 5.1',
                        name: 'D&D 5e SRD 5.1 (2014)',
                        category: cat.id,
                        edition: '2014',
                        isBuiltin: true,
                        isCustom: false,
                        enabled: isSrdEnabled('SRD 5.1', cat.id)
                    },
                    {
                        code: 'SRD 5.2',
                        name: 'D&D 5e SRD 5.2 (2024)',
                        category: cat.id,
                        edition: '2024',
                        isBuiltin: true,
                        isCustom: false,
                        enabled: isSrdEnabled('SRD 5.2', cat.id)
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

            // Clean or sync Desktop-equivalent aliases when toggling SRD 5.1 / 5.2
            const aliases = SRD_CODE_ALIASES[code];
            if (aliases && enabled) {
                for (const alias of aliases) {
                    const aIdx = targetList.indexOf(alias);
                    if (aIdx !== -1) targetList.splice(aIdx, 1);
                }
            }

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

            const readTables = () => {
                const rt = camp.rollTables || {};
                return (Array.isArray(rt.tables) && rt.tables.length ? rt.tables : rt.customTables) || [];
            };
            const readDecks = () => {
                const rt = camp.rollTables || {};
                return (Array.isArray(rt.decks) && rt.decks.length ? rt.decks : rt.cardDecks) || [];
            };
            const readAssetTables = () => camp.rollTables?.assetTables || camp.assetTables || [];

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
                    const seen = new Set();
                    for (const entry of [...readTables(), ...readAssetTables(), ...readDecks()]) {
                        const key = entry?.id || entry?.name;
                        if (key && seen.has(key)) continue;
                        if (key) seen.add(key);
                        items.push(entry);
                    }
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
                    readTables().find((t) => t.id === entityId) || readAssetTables().find((t) => t.id === entityId);
            } else if (entityType === 'deck') {
                entity = readDecks().find((d) => d.id === entityId);
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

        _importSingleEntity(camp, campaignId, entityType, item) {
            if (!item || typeof item !== 'object') return false;
            camp.maps = camp.maps || {};
            camp.characters = camp.characters || {};
            camp.rollTables = camp.rollTables || { tables: [], assetTables: [], decks: [] };
            if (!Array.isArray(camp.rollTables.tables)) {
                camp.rollTables.tables = Array.isArray(camp.rollTables.customTables)
                    ? [...camp.rollTables.customTables]
                    : [];
            }
            if (!Array.isArray(camp.rollTables.assetTables)) {
                camp.rollTables.assetTables = Array.isArray(camp.assetTables) ? [...camp.assetTables] : [];
            }
            if (!Array.isArray(camp.rollTables.decks)) {
                camp.rollTables.decks = Array.isArray(camp.rollTables.cardDecks) ? [...camp.rollTables.cardDecks] : [];
            }

            const isDeck = entityType === 'deck' || (Array.isArray(item.cards) && !item.grid);
            const isAssetTable = entityType === 'assetTable' || (Array.isArray(item.sides) && !item.grid);
            const isTable =
                entityType === 'table' ||
                (entityType === 'tablesAndDecks' && (Array.isArray(item.rows) || item.dice)) ||
                (Array.isArray(item.rows) && !item.grid && !item.stats && !item.classes);

            if (isDeck) {
                const deckId = item.id || `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const nextDeck = { ...item, id: deckId };
                camp.rollTables.decks = camp.rollTables.decks.filter((d) => d.id !== deckId);
                camp.rollTables.decks.push(nextDeck);
                return true;
            }
            if (isAssetTable) {
                const tableId = item.id || `atable_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const nextTable = { ...item, id: tableId };
                camp.rollTables.assetTables = camp.rollTables.assetTables.filter((t) => t.id !== tableId);
                camp.rollTables.assetTables.push(nextTable);
                return true;
            }
            if (isTable) {
                const tableId = item.id || `table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const nextTable = { ...item, id: tableId };
                camp.rollTables.tables = camp.rollTables.tables.filter((t) => t.id !== tableId);
                camp.rollTables.tables.push(nextTable);
                return true;
            }
            if (entityType === 'map' || item.grid || item.tokens !== undefined) {
                const mapId = `map_${campaignId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
                camp.maps[mapId] = { ...item, id: mapId };
                return true;
            }

            const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const charData = { ...item, id: charId };
            if (entityType === 'companion' && charData.isCompanion === undefined) charData.isCompanion = true;
            if ((entityType === 'customNpc' || entityType === 'npc') && charData.isCustomNpc === undefined) {
                charData.isCustomNpc = true;
            }
            camp.characters[charId] = charData;
            return true;
        }

        async importGranular({ campaignId, entityType, entity, entities }) {
            const camp = this.campaigns[campaignId];
            const items = Array.isArray(entities) ? entities : entity ? [entity] : [];
            if (!camp || !items.length) return { success: false, error: 'Invalid campaign or entity' };

            let count = 0;
            for (const item of items) {
                if (this._importSingleEntity(camp, campaignId, entityType, item)) {
                    count++;
                }
            }
            if (!count) return { success: false, error: 'No valid items found to import' };
            camp.updatedAt = Date.now();
            await this._saveCampaigns();
            return { success: true, count, campaign: camp };
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
                if (camp.activeGMMapId === entityId) camp.activeGMMapId = camp.activeMapId;
            } else if (camp.characters?.[entityId]) {
                delete camp.characters[entityId];
            } else {
                if (camp.rollTables) {
                    for (const k of ['tables', 'customTables', 'assetTables', 'decks', 'cardDecks']) {
                        if (Array.isArray(camp.rollTables[k])) {
                            camp.rollTables[k] = camp.rollTables[k].filter((x) => x.id !== entityId);
                        }
                    }
                }
                if (Array.isArray(camp.assetTables)) {
                    camp.assetTables = camp.assetTables.filter((x) => x.id !== entityId);
                }
            }
            camp.updatedAt = Date.now();
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

        async createCustomSource({
            category,
            code,
            name,
            author,
            license,
            licenseUrl,
            attribution,
            description,
            data,
            overwrite = false
        }) {
            const list = this.sourcesConfig.customSources || (this.sourcesConfig.customSources = []);
            const existingIdx = list.findIndex((s) => s.code === code && s.category === category);
            if (existingIdx !== -1 && !overwrite) {
                return { success: false, error: `Source "${code}" already exists.` };
            }
            const created = {
                category,
                code,
                name: name || code,
                author: author || '',
                license: license || '',
                licenseUrl: licenseUrl || '',
                attribution: attribution || '',
                description: description || '',
                data: data && typeof data === 'object' ? data : {},
                isCustom: true,
                isBuiltin: false
            };
            if (existingIdx !== -1) {
                list[existingIdx] = created;
            } else {
                list.push(created);
            }
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

        async addDatabaseFile({ category, fileName, content, metadata = {}, overwrite = false }) {
            let parsed;
            try {
                parsed = typeof content === 'string' ? JSON.parse(content) : content;
            } catch (err) {
                return { success: false, error: `Invalid JSON: ${err.message}` };
            }
            const detected = detectCategoryAndEntries(parsed);
            const resolvedCategory = category || detected.category || 'bestiary';
            const rawCode = (fileName || detected.sourceCode || 'custom').replace(/\.json$/i, '');
            const code = sanitizeFilenamePart(rawCode).toUpperCase() || 'CUSTOM';
            return await this.createCustomSource({
                category: resolvedCategory,
                code,
                name: metadata.name || code,
                author: metadata.author || '',
                license: metadata.license || '',
                licenseUrl: metadata.licenseUrl || '',
                attribution: metadata.attribution || '',
                data: parsed,
                overwrite
            });
        }

        exportSource({ category, code }) {
            const found = (this.sourcesConfig.customSources || []).find(
                (s) => s.code === code && (!category || s.category === category)
            );
            if (!found) return { success: false, error: 'Custom source not found' };
            return { success: true, fileName: `${code}.json`, content: JSON.stringify(found.data || found, null, 2) };
        }

        _extractCustomSourceEntries(src) {
            const raw = src?.data;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            const arrays = [];
            for (const key of [
                'monster',
                'spell',
                'item',
                'baseitem',
                'class',
                'subclass',
                'race',
                'feat',
                'background',
                'optionalfeature',
                'adventure',
                'table',
                'entries',
                'items'
            ]) {
                if (Array.isArray(raw[key])) arrays.push(...raw[key]);
            }
            return arrays;
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
            const items = [];
            if (url) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        const parsed = Array.isArray(data) ? data : data?.entries || data?.items || [];
                        items.push(...parsed);
                    }
                } catch (_) {}
            }
            for (const custom of this.sourcesConfig.customSources || []) {
                if (custom.category !== category) continue;
                for (const entry of this._extractCustomSourceEntries(custom)) {
                    if (entry && typeof entry === 'object' && entry.name) {
                        items.push({ ...entry, source: entry.source || custom.code });
                    }
                }
            }
            const q = query.trim().toLowerCase();
            const filtered = q
                ? items.filter((it) =>
                      String(it.name || '')
                          .toLowerCase()
                          .includes(q)
                  )
                : items;
            return { success: true, results: filtered.slice(0, limit).map((it) => ({ ...it, category })) };
        }

        async searchAllCompendium({ query = '', category, limit = 50 }) {
            const cats =
                category && category !== 'all'
                    ? [category]
                    : [
                          'bestiary',
                          'spells',
                          'items',
                          'classes',
                          'races',
                          'feats',
                          'backgrounds',
                          'adventures',
                          'tables'
                      ];
            const all = [];
            for (const c of cats) {
                const { results } = await this.searchCompendium({ category: c, query, limit });
                all.push(...results);
                if (all.length >= limit) break;
            }
            return { success: true, results: all.slice(0, limit) };
        }

        async getEntityFullData({ category, name, source }) {
            const targetName = String(name || '')
                .trim()
                .toLowerCase();
            const targetSource = String(source || '')
                .trim()
                .toLowerCase();
            const isMatch = (entry) =>
                entry &&
                String(entry.name || '')
                    .trim()
                    .toLowerCase() === targetName &&
                (!targetSource ||
                    String(entry.source || '')
                        .trim()
                        .toLowerCase() === targetSource);

            // 1. Check custom homebrew sources stored in Prep
            for (const custom of this.sourcesConfig.customSources || []) {
                if (category && custom.category !== category) continue;
                const entries = this._extractCustomSourceEntries(custom);
                const found = entries.find((e) => {
                    const effective = e && !e.source ? { ...e, source: custom.code } : e;
                    return isMatch(effective);
                });
                if (found) {
                    return { success: true, entity: { ...found, source: found.source || custom.code, category } };
                }
            }

            // 2. Fetch full normalized statblock from partitioned JSON (same layout as /play)
            if (category && targetSource) {
                const safeSrc = targetSource.replace(/[^a-z0-9_-]/g, '');
                const normUrl = `../play/data/${category}-normalized/${category}-${safeSrc}.json`;
                try {
                    const res = await fetch(normUrl);
                    if (res.ok) {
                        const data = await res.json();
                        const list = Array.isArray(data) ? data : data?.entries || data?.items || [];
                        const match = list.find(isMatch);
                        if (match) return { success: true, entity: match };
                    }
                } catch (_) {}
            }

            // 3. Fallback to compendium catalog search
            const { results } = await this.searchCompendium({ category, query: name, limit: 25 });
            const match = results.find(isMatch);
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

        async bulkImportSources({ candidates = [], conflictDecisions = {} }) {
            let count = 0;
            const usedCodes = new Set((this.sourcesConfig.customSources || []).map((s) => `${s.category}:${s.code}`));
            for (const c of candidates) {
                if (c.selected === false) continue;
                const category = c.detectedCategory || c.category || 'bestiary';
                let code =
                    c.detectedSource ||
                    c.code ||
                    String(c.fileName || 'CUSTOM')
                        .replace(/\.json$/i, '')
                        .toUpperCase();
                code = sanitizeFilenamePart(code).toUpperCase() || 'CUSTOM';

                const decision =
                    c.conflictDecision ||
                    conflictDecisions[c.originalPath || c.fileName] ||
                    (usedCodes.has(`${category}:${code}`) ? 'rename' : '');

                let overwrite = false;
                if (usedCodes.has(`${category}:${code}`) || c.hasConflict) {
                    if (decision === 'skip') continue;
                    if (decision === 'overwrite') {
                        overwrite = true;
                    } else if (usedCodes.has(`${category}:${code}`)) {
                        let suffix = 1;
                        let candidateCode = `${code}_COPY`;
                        while (usedCodes.has(`${category}:${candidateCode}`)) {
                            suffix++;
                            candidateCode = `${code}_COPY${suffix}`;
                        }
                        code = candidateCode;
                    }
                }

                const res = await this.addDatabaseFile({
                    category,
                    fileName: `${code}.json`,
                    content: c.content,
                    overwrite
                });
                if (res.success) {
                    usedCodes.add(`${category}:${code}`);
                    count++;
                }
            }
            return { success: true, count, importedCount: count };
        }

        getP2pStatus() {
            return {
                active: false,
                statusLabel: 'Ready (Host opens in /play)',
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
