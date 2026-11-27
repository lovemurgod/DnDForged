/**
 * vtt-static-shim.js
 * Lightweight fetch & IndexedDB bridge for Static Web Hosting (forgedvtt.com/play).
 * Only activates when window.__FORGEDVTT_STATIC_WEB__ is true (no Express backend).
 * Translates /api/compendium/*, /api/campaigns*, /api/assets*, /api/sources/disabled,
 * /api/tables/*, /api/decks/*, /api/handouts/*, and /api/gm-auth-required
 * to static JSON files under data/ and browser IndexedDB/localStorage.
 */
(function (global) {
    'use strict';

    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return;
    }

    const originalFetch = window.fetch.bind(window);
    const STATIC_DB_NAME = 'forgedvtt_static_db';
    const STATIC_DB_VERSION = 2;
    const STATIC_STORE = 'kv';
    const ASSET_STORE = 'assets';
    const ASSET_URL_PREFIX = 'forgedvtt-asset://';
    const TRANSPARENT_PLACEHOLDER_SVG =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

    const SRD_ALIAS_MAP = {
        'SRD 5.1': ['SRD 5.1', 'PHB', 'MM', 'DMG'],
        'SRD 5.2': ['SRD 5.2', 'XPHB', 'XMM', 'XDMG']
    };

    const blobUrlCache = new Map();
    const pendingAssetLoads = new Set();
    let staticSyncChannel = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            staticSyncChannel = new BroadcastChannel('forgedvtt_static_sync');
            staticSyncChannel.onmessage = async (event) => {
                const msg = event?.data;
                if (!msg || msg.senderId === 'play') return;
                if (msg.type === 'campaigns-updated' && isStaticWebActive()) {
                    const campId = global.VTT?.campaignId;
                    if (!campId) return;
                    const stored = await idbGet('campaigns');
                    if (stored?.[campId] && global.VTT?.campaignState) {
                        const localTs = Number(global.VTT.campaignState.updatedAt || 0);
                        const incomingTs = Number(stored[campId].updatedAt || 0);
                        if (incomingTs > localTs) {
                            global.VTT.campaignState = stored[campId];
                            global.VTT.canvasEngine?.syncCampaignState?.(stored[campId]);
                        }
                    }
                } else if (msg.type === 'sources-updated' && isStaticWebActive()) {
                    const campId = global.VTT?.campaignId;
                    if (typeof global.loadBestiaryData === 'function') global.loadBestiaryData(campId);
                    if (global.VTTSpellManager?.invalidateSpellCache) {
                        global.VTTSpellManager.invalidateSpellCache();
                        global.VTTSpellManager.loadSpells?.(campId);
                    }
                }
            };
        }
    } catch (_) {
        /* ignore BroadcastChannel unsupported */
    }

    function isStaticWebActive() {
        return Boolean(global.__FORGEDVTT_STATIC_WEB__);
    }

    let _staticIdbPromise = null;
    function openStaticIdb() {
        if (typeof indexedDB === 'undefined') return Promise.resolve(null);
        if (_staticIdbPromise) return _staticIdbPromise;
        _staticIdbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(STATIC_DB_NAME, STATIC_DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STATIC_STORE)) {
                    db.createObjectStore(STATIC_STORE);
                }
                if (!db.objectStoreNames.contains(ASSET_STORE)) {
                    db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onclose = () => {
                    _staticIdbPromise = null;
                };
                db.onversionchange = () => {
                    db.close();
                    _staticIdbPromise = null;
                };
                resolve(db);
            };
            req.onerror = () => {
                _staticIdbPromise = null;
                reject(req.error);
            };
        });
        return _staticIdbPromise;
    }

    async function idbGet(key, storeName = STATIC_STORE) {
        try {
            const db = await openStaticIdb();
            if (!db || !db.objectStoreNames.contains(storeName)) return null;
            return await new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => resolve(null);
            });
        } catch (_) {
            return null;
        }
    }

    async function idbSet(key, val, storeName = STATIC_STORE) {
        const db = await openStaticIdb();
        if (!db || !db.objectStoreNames.contains(storeName)) {
            throw new Error(`IndexedDB store "${storeName}" is unavailable`);
        }
        return await new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = storeName === ASSET_STORE ? store.put(val) : store.put(val, key);
                let settled = false;
                const fail = (err) => {
                    if (settled) return;
                    settled = true;
                    reject(err instanceof Error ? err : new Error(String(err || 'IndexedDB write failed')));
                };
                req.onerror = () => fail(req.error || tx.error || new Error('IndexedDB put request failed'));
                tx.oncomplete = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                tx.onerror = () => fail(tx.error || req.error || new Error('IndexedDB transaction failed'));
                tx.onabort = () => fail(tx.error || new Error('IndexedDB transaction aborted'));
            } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err || 'IndexedDB write failed')));
            }
        });
    }

    async function idbDelete(key, storeName = ASSET_STORE) {
        try {
            const db = await openStaticIdb();
            if (!db || !db.objectStoreNames.contains(storeName)) return;
            await new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (_) {
            /* ignore IDB delete errors */
        }
    }

    async function prewarmAssetUrls() {
        if (!isStaticWebActive()) return;
        try {
            const db = await openStaticIdb();
            if (!db || !db.objectStoreNames.contains(ASSET_STORE)) return;
            const records = await new Promise((resolve) => {
                const tx = db.transaction(ASSET_STORE, 'readonly');
                const req = tx.objectStore(ASSET_STORE).getAll();
                req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                req.onerror = () => resolve([]);
            });
            for (const rec of records) {
                if (rec?.id && rec.blob && typeof URL?.createObjectURL === 'function') {
                    const objUrl = blobUrlCache.get(rec.id) || URL.createObjectURL(rec.blob);
                    blobUrlCache.set(rec.id, objUrl);
                    if (rec.urlPath) {
                        blobUrlCache.set(rec.urlPath, objUrl);
                        if (rec.urlPath.startsWith('/')) {
                            blobUrlCache.set(rec.urlPath.slice(1), objUrl);
                        }
                    }
                }
            }
        } catch (_) {
            /* ignore prewarm error */
        }
    }
    if (isStaticWebActive()) {
        prewarmAssetUrls();
    }

    function getAssetIdFromUrl(url) {
        if (typeof url !== 'string') return null;
        let clean = url.split('?')[0].trim();
        try {
            clean = decodeURIComponent(clean);
        } catch (_) {
            /* keep raw string if malformed URI */
        }
        if (clean.startsWith(ASSET_URL_PREFIX)) {
            return clean.slice(ASSET_URL_PREFIX.length).trim();
        }
        if (clean.startsWith('/assets/') || clean.startsWith('/vtt-uploads/')) {
            return `local:${clean}`;
        }
        if (clean.startsWith('assets/') || clean.startsWith('vtt-uploads/')) {
            return `local:/${clean}`;
        }
        return null;
    }

    global.__resolveStaticAssetUrl = function (url) {
        const assetId = getAssetIdFromUrl(url);
        if (!assetId) return null;
        if (blobUrlCache.has(assetId)) {
            return blobUrlCache.get(assetId);
        }
        if (typeof url === 'string' && blobUrlCache.has(url.split('?')[0].trim())) {
            return blobUrlCache.get(url.split('?')[0].trim());
        }
        if (!pendingAssetLoads.has(assetId)) {
            pendingAssetLoads.add(assetId);
            idbGet(assetId, ASSET_STORE)
                .then((rec) => {
                    pendingAssetLoads.delete(assetId);
                    if (rec?.blob && typeof URL?.createObjectURL === 'function') {
                        const objUrl = URL.createObjectURL(rec.blob);
                        blobUrlCache.set(assetId, objUrl);
                        if (rec.urlPath) {
                            blobUrlCache.set(rec.urlPath, objUrl);
                            if (rec.urlPath.startsWith('/')) blobUrlCache.set(rec.urlPath.slice(1), objUrl);
                        }
                        global.VTT?.canvasEngine?.refreshAssetUrl?.(url);
                    }
                })
                .catch(() => {
                    pendingAssetLoads.delete(assetId);
                });
        }
        return TRANSPARENT_PLACEHOLDER_SVG;
    };

    function createDefaultAssetTree() {
        return { name: 'Root', path: '', type: 'folder', children: [] };
    }

    async function loadAssetTree() {
        const tree = await idbGet('assetTree');
        return tree && typeof tree === 'object' && Array.isArray(tree.children) ? tree : createDefaultAssetTree();
    }

    function findOrCreateFolderNode(root, folderPath, create = false) {
        if (!folderPath) return root;
        const parts = String(folderPath)
            .split('/')
            .map((p) => p.trim())
            .filter(Boolean);
        let cur = root;
        let built = '';
        for (const part of parts) {
            built = built ? `${built}/${part}` : part;
            if (!Array.isArray(cur.children)) cur.children = [];
            let next = cur.children.find((c) => c && c.type === 'folder' && c.name === part);
            if (!next) {
                if (!create) return null;
                next = { name: part, path: built, type: 'folder', children: [] };
                cur.children.push(next);
            }
            cur = next;
        }
        return cur;
    }

    function sanitizeFilename(rawName) {
        return String(rawName || 'upload.png').replace(/[\/\\?%*:|"<>]/g, '_');
    }

    global.__staticAssetStore = {
        async saveFile(file, folderPath = '', relativePath = '') {
            const safeName = sanitizeFilename(
                relativePath ? relativePath.split('/').pop() : file?.name || 'upload.png'
            );
            const relDir =
                relativePath && relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : '';
            const effectiveFolder = [folderPath, relDir].filter(Boolean).join('/');
            const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const assetUrl = `${ASSET_URL_PREFIX}${assetId}`;
            const itemPath = effectiveFolder ? `${effectiveFolder}/${safeName}` : safeName;
            const mimeType = file?.type || 'application/octet-stream';

            await idbSet(
                assetId,
                {
                    id: assetId,
                    name: safeName,
                    path: itemPath,
                    folderPath: effectiveFolder,
                    mimeType,
                    blob: file,
                    createdAt: Date.now()
                },
                ASSET_STORE
            );
            if (typeof URL?.createObjectURL === 'function') {
                blobUrlCache.set(assetId, URL.createObjectURL(file));
            }

            const tree = await loadAssetTree();
            const targetFolder = findOrCreateFolderNode(tree, effectiveFolder, true);
            const entry = {
                id: assetId,
                name: safeName,
                path: itemPath,
                type: 'file',
                url: assetUrl
            };
            targetFolder.children = targetFolder.children.filter((c) => c && c.path !== itemPath);
            targetFolder.children.push(entry);
            await idbSet('assetTree', tree);
            return entry;
        },

        async getBlob(urlOrId) {
            const assetId = getAssetIdFromUrl(urlOrId) || String(urlOrId || '').trim();
            if (!assetId) return null;
            return await idbGet(assetId, ASSET_STORE);
        },

        async listAllBlobs() {
            try {
                const db = await openStaticIdb();
                if (!db || !db.objectStoreNames.contains(ASSET_STORE)) return [];
                return await new Promise((resolve) => {
                    const tx = db.transaction(ASSET_STORE, 'readonly');
                    const req = tx.objectStore(ASSET_STORE).getAll();
                    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                    req.onerror = () => resolve([]);
                });
            } catch (_) {
                return [];
            }
        },

        async putBlobRecord(record) {
            if (!record || !record.id || !record.blob) return false;
            try {
                await idbSet(record.id, record, ASSET_STORE);
                if (!blobUrlCache.has(record.id) && typeof URL?.createObjectURL === 'function') {
                    blobUrlCache.set(record.id, URL.createObjectURL(record.blob));
                }
                return true;
            } catch (err) {
                console.error('[Static Persistence] Failed to store asset blob in IndexedDB:', err);
                notifyPersistenceFailure(err, 'asset');
                return false;
            }
        }
    };

    let _persistTimer = null;
    let _pendingCampaignObj = null;
    let _pendingPersistWaiters = [];
    let _persistInFlight = null;
    let _lastPersistError = null;
    let _lastSavedAt = null;
    let _lastPersistToastAt = 0;

    function formatPersistenceErrorMessage(err, kind = 'campaign') {
        const name = err?.name || '';
        const raw = err?.message || String(err || 'Unknown storage error');
        if (name === 'QuotaExceededError' || /quota/i.test(raw)) {
            return `Browser storage quota exceeded; ${kind} changes could not be saved.`;
        }
        return `Failed to save ${kind} to browser storage: ${raw}`;
    }

    function notifyPersistenceFailure(err, kind = 'campaign') {
        const message = formatPersistenceErrorMessage(err, kind);
        _lastPersistError = message;
        const now = Date.now();
        if (now - _lastPersistToastAt >= 5000) {
            _lastPersistToastAt = now;
            if (typeof global.showToast === 'function') {
                global.showToast(message, 'error');
            } else if (global.vttEventBus && typeof global.vttEventBus.emit === 'function') {
                global.vttEventBus.emit('toast:show', { msg: message, type: 'error' });
            } else if (global.JqueryUtil && typeof global.JqueryUtil.doToast === 'function') {
                global.JqueryUtil.doToast({ content: message, type: 'danger' });
            }
        }
        if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
            global.dispatchEvent(
                new global.CustomEvent('forgedvtt:persistence-error', {
                    detail: { kind, message, error: err }
                })
            );
        }
    }

    async function executePendingCampaignPersist() {
        const campaignObj = _pendingCampaignObj;
        const waiters = _pendingPersistWaiters;
        _pendingCampaignObj = null;
        _pendingPersistWaiters = [];
        if (!campaignObj || !campaignObj.id) {
            for (const w of waiters) w.resolve({ ok: true, skipped: true });
            return { ok: true, skipped: true };
        }
        const run = (async () => {
            try {
                const existing = (await idbGet('campaigns')) || {};
                existing[campaignObj.id] = campaignObj;
                await idbSet('campaigns', existing);
                _lastPersistError = null;
                _lastSavedAt = campaignObj.updatedAt || Date.now();
                staticSyncChannel?.postMessage({
                    type: 'campaigns-updated',
                    senderId: 'play',
                    campaignId: campaignObj.id,
                    updatedAt: campaignObj.updatedAt
                });
                const res = { ok: true, campaignId: campaignObj.id, updatedAt: campaignObj.updatedAt };
                for (const w of waiters) w.resolve(res);
                return res;
            } catch (err) {
                console.error('[Static Persistence] Failed to save campaign to IndexedDB:', err);
                notifyPersistenceFailure(err, 'campaign');
                for (const w of waiters) w.reject(err);
                throw err;
            } finally {
                if (_persistInFlight === run) _persistInFlight = null;
            }
        })();
        _persistInFlight = run;
        return await run;
    }

    global.__persistStaticCampaign = function (campaignObj) {
        if (!campaignObj || !campaignObj.id) return Promise.resolve({ ok: true, skipped: true });
        campaignObj.updatedAt = Date.now();
        _pendingCampaignObj = campaignObj;
        if (_persistTimer) clearTimeout(_persistTimer);
        return new Promise((resolve, reject) => {
            _pendingPersistWaiters.push({ resolve, reject });
            _persistTimer = setTimeout(() => {
                _persistTimer = null;
                executePendingCampaignPersist().catch(() => {});
            }, 200);
        });
    };

    /**
     * Explicitly flushes any debounced campaign write and awaits in-flight IndexedDB
     * transaction completion. Note: browsers do not guarantee async IndexedDB completion
     * inside synchronous pagehide/beforeunload handlers, so callers should invoke and
     * await this before explicit navigation or export actions.
     */
    global.__flushStaticCampaign = async function () {
        if (_persistTimer) {
            clearTimeout(_persistTimer);
            _persistTimer = null;
        }
        if (_pendingCampaignObj) {
            return await executePendingCampaignPersist();
        }
        if (_persistInFlight) {
            return await _persistInFlight;
        }
        return { ok: true, flushed: false };
    };

    global.__getStaticPersistenceStatus = function () {
        return {
            pending: Boolean(_persistTimer || _pendingCampaignObj || _persistInFlight),
            lastError: _lastPersistError,
            lastSavedAt: _lastSavedAt
        };
    };

    function jsonResponse(obj, status = 200) {
        return new Response(JSON.stringify(obj), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function readStaticGmCreds() {
        try {
            if (typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem('forgedvtt_static_gm_creds');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    async function sha256Hex(text) {
        if (!global.crypto || !global.crypto.subtle) {
            throw new Error('Web Crypto API is unavailable for GM password verification.');
        }
        const bytes = new TextEncoder().encode(String(text || ''));
        const digest = await global.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    async function pbkdf2Hex(password, salt, iterations = 100000) {
        if (!global.crypto || !global.crypto.subtle) {
            throw new Error('Web Crypto API is unavailable for GM password verification.');
        }
        const keyMaterial = await global.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(String(password || '')),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const bits = await global.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode(String(salt || '')),
                iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        return Array.from(new Uint8Array(bits))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    global.__verifyStaticGmPassword = async function (username, password) {
        const creds = readStaticGmCreds();
        if (!creds || !creds.hasPassword || (!creds.pbkdf2Hash && !creds.sha256Hash)) {
            return { ok: true };
        }
        if (
            creds.username &&
            username &&
            String(username).trim().toLowerCase() !== String(creds.username).trim().toLowerCase()
        ) {
            return { ok: false, error: 'Invalid GM username or password.' };
        }
        if (!password) {
            return { ok: false, error: 'GM password is required.' };
        }
        if (creds.pbkdf2Hash) {
            const computedPbkdf2 = await pbkdf2Hex(password, creds.salt || '', 100000);
            if (computedPbkdf2 !== creds.pbkdf2Hash) {
                return { ok: false, error: 'Invalid GM password.' };
            }
            return { ok: true };
        }
        const computed = await sha256Hex(`${creds.salt || ''}:${password}`);
        if (computed !== creds.sha256Hash) {
            return { ok: false, error: 'Invalid GM password.' };
        }
        return { ok: true };
    };

    const CATALOG_FILE_MAP = {
        races: 'data/races-catalog.json',
        backgrounds: 'data/backgrounds-catalog.json',
        classes: 'data/classes-catalog.json',
        feats: 'data/feats-catalog.json',
        optionalfeatures: 'data/optionalfeatures-catalog.json',
        spells: 'data/spells-catalog.json',
        items: 'data/items-catalog.json',
        bestiary: 'data/bestiary-catalog.json',
        handouts: 'data/handouts-catalog.json'
    };

    const SINGULAR_TYPE_MAP = {
        creature: 'bestiary',
        spell: 'spells',
        item: 'items',
        race: 'races',
        class: 'classes',
        feat: 'feats',
        optionalfeature: 'optionalfeatures',
        background: 'backgrounds',
        handout: 'handouts'
    };

    const CUSTOM_DATA_KEY_MAP = {
        bestiary: ['monster', 'entries', 'items'],
        spells: ['spell', 'entries', 'items'],
        items: ['item', 'baseitem', 'entries', 'items'],
        classes: ['class', 'entries', 'items'],
        races: ['race', 'entries', 'items'],
        feats: ['feat', 'entries', 'items'],
        backgrounds: ['background', 'entries', 'items'],
        optionalfeatures: ['optionalfeature', 'entries', 'items'],
        handouts: ['handout', 'entries', 'items']
    };

    function expandDisabledSourceCodes(rawList) {
        const out = new Set();
        for (const item of rawList || []) {
            const upper = String(item || '')
                .trim()
                .toUpperCase();
            if (!upper) continue;
            out.add(upper);
            if (SRD_ALIAS_MAP[upper]) {
                for (const alias of SRD_ALIAS_MAP[upper]) out.add(alias);
            }
        }
        return Array.from(out);
    }

    function getDisabledSourcesForCampaign(campaignId) {
        try {
            if (campaignId && typeof localStorage !== 'undefined') {
                const campMapRaw = localStorage.getItem('forgedvtt_static_campaign_sources');
                const campMap = campMapRaw ? JSON.parse(campMapRaw) : {};
                if (Array.isArray(campMap?.[campaignId])) {
                    return expandDisabledSourceCodes(campMap[campaignId]);
                }
            }
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem('forgedvtt_static_disabled_sources');
                const parsed = raw ? JSON.parse(raw) : [];
                return expandDisabledSourceCodes(Array.isArray(parsed) ? parsed : []);
            }
        } catch (_) {
            /* ignore localStorage parse error */
        }
        return [];
    }

    async function getEnabledCustomEntries(category, disabledSet) {
        const sourcesConfig = await idbGet('sourcesConfig');
        const customSources = Array.isArray(sourcesConfig?.customSources) ? sourcesConfig.customSources : [];
        const entries = [];
        for (const src of customSources) {
            if (!src || src.category !== category) continue;
            const codeUpper = String(src.code || '').toUpperCase();
            if (codeUpper && disabledSet.has(codeUpper)) continue;
            let rawData = src.data;
            if (!rawData && typeof src.rawJson === 'string') {
                try {
                    rawData = JSON.parse(src.rawJson);
                } catch (_) {
                    rawData = null;
                }
            }
            if (!rawData) continue;
            let list = [];
            if (Array.isArray(rawData)) {
                list = rawData;
            } else {
                for (const k of CUSTOM_DATA_KEY_MAP[category] || ['entries', 'items']) {
                    if (Array.isArray(rawData[k])) {
                        list = list.concat(rawData[k]);
                    }
                }
            }
            for (const entry of list) {
                if (!entry || typeof entry !== 'object') continue;
                const entrySrc = entry.source || src.code || 'CUSTOM';
                const cleanName = String(entry.name || 'Unnamed');
                const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                entries.push({
                    ...entry,
                    source: entrySrc,
                    id: entry.id || `${category}_${slug}_${String(entrySrc).toLowerCase()}`
                });
            }
        }
        return entries;
    }

    function matchesCompendiumEntry(entry, targetSrc, targetId, rawLower) {
        if (!entry || typeof entry !== 'object') return false;
        const eSrc = String(entry.source || targetSrc).toLowerCase();
        if (targetSrc && eSrc !== targetSrc) return false;

        const cleanId = String(entry.id || '').toLowerCase();
        const cleanName = String(entry.name || '').toLowerCase();
        const spacedTarget = targetId.replace(/_/g, ' ');
        const slugTarget = targetId.replace(/[^a-z0-9]+/g, '_');
        const syntheticId = `${rawLower}_${slugTarget}_${targetSrc}`;
        return (
            (cleanId && (cleanId === targetId || cleanId === syntheticId)) ||
            (cleanName && (cleanName === targetId || cleanName === spacedTarget))
        );
    }

    const _staticCatalogCache = new Map();
    async function serveFilteredCatalog(cType, campaignId, init) {
        const staticPath = CATALOG_FILE_MAP[cType];
        if (!staticPath) return jsonResponse([]);
        const disabled = new Set(getDisabledSourcesForCampaign(campaignId));

        let baseEntries = _staticCatalogCache.get(staticPath);
        if (!baseEntries) {
            baseEntries = [];
            try {
                const res = await originalFetch(staticPath, init);
                if (res.ok) {
                    const parsed = await res.json();
                    baseEntries = Array.isArray(parsed) ? parsed : parsed?.entries || parsed?.items || [];
                    if (baseEntries.length > 0) {
                        _staticCatalogCache.set(staticPath, baseEntries);
                    }
                }
            } catch (_) {
                baseEntries = [];
            }
        }

        const customEntries = await getEnabledCustomEntries(cType, disabled);
        const filteredBase = disabled.size
            ? baseEntries.filter((e) => !disabled.has(String(e?.source || '').toUpperCase()))
            : baseEntries;

        return jsonResponse([...filteredBase, ...customEntries]);
    }

    function parseJsonBody(init) {
        try {
            if (!init?.body) return {};
            return typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } catch (_) {
            return {};
        }
    }

    function removePathsFromTree(node, targetPathsSet, removedIds) {
        if (!node || !Array.isArray(node.children)) return;
        node.children = node.children.filter((child) => {
            if (!child) return false;
            if (targetPathsSet.has(child.path)) {
                collectAssetIds(child, removedIds);
                return false;
            }
            if (child.type === 'folder') {
                removePathsFromTree(child, targetPathsSet, removedIds);
            }
            return true;
        });
    }

    function collectAssetIds(node, acc) {
        if (!node) return;
        if (node.id) acc.push(node.id);
        if (Array.isArray(node.children)) {
            for (const c of node.children) collectAssetIds(c, acc);
        }
    }

    window.fetch = async function (input, init) {
        if (!isStaticWebActive()) {
            return originalFetch(input, init);
        }

        const urlStr = typeof input === 'string' ? input : input?.url || '';
        let parsedUrl;
        try {
            parsedUrl = new URL(urlStr, window.location.origin);
        } catch (_) {
            return originalFetch(input, init);
        }

        const pathname = parsedUrl.pathname;
        const method = String(init?.method || 'GET').toUpperCase();

        if (pathname === '/api/gm-auth-required') {
            const creds = readStaticGmCreds();
            const hasPassword = Boolean(creds && creds.hasPassword && (creds.pbkdf2Hash || creds.sha256Hash));
            return jsonResponse({ required: hasPassword, hasPassword });
        }

        if (pathname === '/api/sources/disabled') {
            const campId = parsedUrl.searchParams.get('campaignId');
            return jsonResponse({ disabledSources: getDisabledSourcesForCampaign(campId) });
        }

        // Static /api/assets* manager backed by IndexedDB
        if (pathname === '/api/assets') {
            return jsonResponse(await loadAssetTree());
        }
        if (pathname === '/api/assets/folder' && method === 'POST') {
            const body = parseJsonBody(init);
            const folderPath = String(body.folderPath || '').trim();
            if (!folderPath) return jsonResponse({ error: 'folderPath required' }, 400);
            const tree = await loadAssetTree();
            findOrCreateFolderNode(tree, folderPath, true);
            await idbSet('assetTree', tree);
            return jsonResponse({ success: true, path: folderPath });
        }
        if (pathname === '/api/assets/url' && method === 'POST') {
            const body = parseJsonBody(init);
            const url = String(body.url || '').trim();
            if (!url) return jsonResponse({ error: 'URL required' }, 400);
            const folderPath = String(body.folderPath || '').trim();
            const name = String(body.name || 'External Asset').trim();
            const tree = await loadAssetTree();
            const folder = findOrCreateFolderNode(tree, folderPath, true);
            const entry = {
                name,
                path: folderPath ? `${folderPath}/${name}` : name,
                type: 'url',
                url
            };
            folder.children.push(entry);
            await idbSet('assetTree', tree);
            return jsonResponse({ success: true, asset: entry });
        }
        if ((pathname === '/api/assets/upload' || pathname === '/api/upload') && method === 'POST') {
            try {
                const fd = init?.body;
                const folderPath =
                    parsedUrl.searchParams.get('folderPath') ||
                    (fd && typeof fd.get === 'function' ? fd.get('folderPath') : '') ||
                    '';
                const relativePath =
                    parsedUrl.searchParams.get('relativePath') ||
                    (fd && typeof fd.get === 'function' ? fd.get('relativePath') : '') ||
                    '';
                const uploadedFiles = [];
                if (fd && typeof fd.getAll === 'function') {
                    for (const key of ['files', 'file', 'image']) {
                        for (const item of fd.getAll(key)) {
                            if (item && typeof item.size === 'number') uploadedFiles.push(item);
                        }
                    }
                }
                if (uploadedFiles.length > 0) {
                    const savedEntries = [];
                    for (const file of uploadedFiles) {
                        savedEntries.push(
                            await global.__staticAssetStore.saveFile(file, String(folderPath), String(relativePath))
                        );
                    }
                    const first = savedEntries[0];
                    return jsonResponse({
                        success: true,
                        url: first.url,
                        name: first.name,
                        files: savedEntries
                    });
                }
            } catch (err) {
                return jsonResponse({ success: false, error: err?.message || 'Static upload failed' }, 400);
            }
            return jsonResponse({ success: false, error: 'No upload file provided' }, 400);
        }
        if (pathname === '/api/assets/move' && method === 'POST') {
            const body = parseJsonBody(init);
            const items = Array.isArray(body.items) ? body.items : [];
            const targetFolder = String(body.targetFolder || '').trim();
            const tree = await loadAssetTree();
            const destNode = findOrCreateFolderNode(tree, targetFolder, true);
            const movedItems = [];
            const moveSet = new Set(items.map((it) => it?.path).filter(Boolean));
            const extractMoved = (node) => {
                if (!node || !Array.isArray(node.children)) return;
                node.children = node.children.filter((c) => {
                    if (c && moveSet.has(c.path)) {
                        movedItems.push(c);
                        return false;
                    }
                    if (c?.type === 'folder') extractMoved(c);
                    return true;
                });
            };
            extractMoved(tree);
            for (const item of movedItems) {
                item.path = targetFolder ? `${targetFolder}/${item.name}` : item.name;
                destNode.children.push(item);
            }
            await idbSet('assetTree', tree);
            return jsonResponse({ success: true, moved: movedItems.length });
        }
        if (pathname === '/api/assets/edit' && method === 'POST') {
            const body = parseJsonBody(init);
            const tree = await loadAssetTree();
            const renameNode = (node) => {
                if (!node || !Array.isArray(node.children)) return false;
                for (const c of node.children) {
                    if (c && (c.path === body.path || (c.type === 'url' && c.name === body.oldName))) {
                        if (body.newName) c.name = String(body.newName).trim();
                        if (body.newUrl && c.type === 'url') c.url = String(body.newUrl).trim();
                        return true;
                    }
                    if (c?.type === 'folder' && renameNode(c)) return true;
                }
                return false;
            };
            renameNode(tree);
            await idbSet('assetTree', tree);
            return jsonResponse({ success: true });
        }
        if (pathname === '/api/assets/delete' && (method === 'POST' || method === 'DELETE')) {
            const body = parseJsonBody(init);
            const items = Array.isArray(body.items) ? body.items : body.path ? [body] : [];
            const tree = await loadAssetTree();
            const paths = new Set(items.map((it) => it?.path).filter(Boolean));
            const removedIds = [];
            removePathsFromTree(tree, paths, removedIds);
            await idbSet('assetTree', tree);
            for (const assetId of removedIds) {
                blobUrlCache.delete(assetId);
                await idbDelete(assetId, ASSET_STORE);
            }
            return jsonResponse({ success: true, deleted: paths.size });
        }

        if (pathname === '/api/player-token/url') {
            const parsedBody = parseJsonBody(init);
            return jsonResponse({ url: parsedBody.url || '' });
        }
        if (pathname === '/api/resolve-media-url') {
            const rawTarget = parsedUrl.searchParams.get('url') || '';
            return jsonResponse({
                resolvedUrl: rawTarget,
                isVideo: /\.(mp4|webm|ogg)(\?.*)?$/i.test(rawTarget) || /youtube\.com|youtu\.be/i.test(rawTarget),
                originalUrl: rawTarget
            });
        }
        if (pathname === '/api/tables/catalog') {
            const rt = global.VTT?.campaignState?.rollTables || {};
            const customTables = (Array.isArray(rt.tables) && rt.tables.length ? rt.tables : rt.customTables) || [];
            const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
            const catalog = customTables
                .filter((t) => !q || (t.name && t.name.toLowerCase().includes(q)))
                .map((t) => ({
                    id: t.id,
                    name: t.name,
                    source: t.source || 'CUSTOM',
                    dice: t.dice || '1d20',
                    rowCount: Array.isArray(t.rows) ? t.rows.length : 0
                }));
            return jsonResponse(catalog);
        }
        if (pathname.startsWith('/api/tables/')) {
            const targetId = decodeURIComponent(pathname.slice('/api/tables/'.length));
            const rt = global.VTT?.campaignState?.rollTables || {};
            const customTables = (Array.isArray(rt.tables) && rt.tables.length ? rt.tables : rt.customTables) || [];
            const found = customTables.find((t) => t && t.id === targetId);
            if (!found) return jsonResponse({ error: 'Table not found' }, 404);
            return jsonResponse(found);
        }
        if (pathname === '/api/decks/catalog') {
            const rt = global.VTT?.campaignState?.rollTables || {};
            const customDecks = (Array.isArray(rt.decks) && rt.decks.length ? rt.decks : rt.cardDecks) || [];
            return jsonResponse(
                customDecks.map((d) => ({
                    id: d.id,
                    name: d.name,
                    source: d.source || 'CUSTOM',
                    cardCount: Array.isArray(d.cards) ? d.cards.length : d.cardCount || 0,
                    description: d.description || '',
                    theme: d.theme || 'standard'
                }))
            );
        }
        if (pathname.startsWith('/api/decks/')) {
            const targetId = decodeURIComponent(pathname.slice('/api/decks/'.length));
            const rt = global.VTT?.campaignState?.rollTables || {};
            const customDecks = (Array.isArray(rt.decks) && rt.decks.length ? rt.decks : rt.cardDecks) || [];
            const found = customDecks.find((d) => d && d.id === targetId);
            if (!found) return jsonResponse({ error: 'Deck not found' }, 404);
            return jsonResponse(found);
        }

        if (pathname === '/api/campaigns') {
            const stored = await idbGet('campaigns');
            const list =
                stored && typeof stored === 'object'
                    ? Object.values(stored).map((c) => ({ id: c.id, name: c.name || c.id }))
                    : [{ id: 'default', name: 'Default Campaign' }];
            return jsonResponse({
                activeSubdomain: null,
                campaigns: list.length ? list : [{ id: 'default', name: 'Default Campaign' }]
            });
        }

        if (pathname.startsWith('/api/campaigns/')) {
            const campId = decodeURIComponent(pathname.slice('/api/campaigns/'.length));
            if (method === 'PUT' || method === 'POST') {
                try {
                    const body = parseJsonBody(init);
                    const stored = (await idbGet('campaigns')) || {};
                    stored[campId] = { ...(stored[campId] || {}), ...body, id: campId, updatedAt: Date.now() };
                    await idbSet('campaigns', stored);
                    return jsonResponse({ success: true, campaign: stored[campId] });
                } catch (err) {
                    console.error('[Static Persistence] Failed to persist campaign API write:', err);
                    notifyPersistenceFailure(err, 'campaign');
                    return jsonResponse({ error: formatPersistenceErrorMessage(err, 'campaign') }, 500);
                }
            }
            const stored = await idbGet('campaigns');
            if (stored && stored[campId]) {
                return jsonResponse(stored[campId]);
            }
            const defaultMapId = `map_${campId}_default`;
            return jsonResponse({
                id: campId,
                name: 'Static P2P Campaign',
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
                characters: {},
                rollTables: { tables: [], assetTables: [], decks: [] },
                initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false }
            });
        }

        const directCatMatch = pathname.match(/^\/api\/([a-z]+)\/catalog$/i);
        if (directCatMatch && !pathname.startsWith('/api/compendium/')) {
            const rawCat = directCatMatch[1].toLowerCase();
            const normCat = SINGULAR_TYPE_MAP[rawCat] || rawCat;
            if (CATALOG_FILE_MAP[normCat]) {
                return serveFilteredCatalog(normCat, parsedUrl.searchParams.get('campaignId'), init);
            }
        }

        const catMatch = pathname.match(/^\/api\/compendium\/([a-z]+)\/catalog$/i);
        if (catMatch) {
            const cType = catMatch[1].toLowerCase();
            if (CATALOG_FILE_MAP[cType]) {
                return serveFilteredCatalog(cType, parsedUrl.searchParams.get('campaignId'), init);
            }
        }

        async function findCompendiumEntry(staticUrl, targetSrc, targetId, rawLower) {
            try {
                const res = await originalFetch(staticUrl, init);
                if (!res || !res.ok) return null;
                const data = await res.json();
                const entries = Array.isArray(data) ? data : data?.entries || data?.items || [];
                return entries.find((e) => matchesCompendiumEntry(e, targetSrc, targetId, rawLower)) || null;
            } catch (_) {
                return null;
            }
        }

        const handoutsSrcMatch = pathname.match(/^\/api\/handouts\/([^/]+)$/i);
        if (handoutsSrcMatch) {
            const srcLower = decodeURIComponent(handoutsSrcMatch[1]).toLowerCase();
            try {
                const res = await originalFetch(`data/handouts-normalized/handouts-${srcLower}.json`, init);
                if (res && res.ok) return res;
            } catch (_) {
                /* fall through to 404 */
            }
            return jsonResponse({ error: `Handouts for ${srcLower} not found` }, 404);
        }

        const singularOrCompendiumItemMatch =
            pathname.match(/^\/api\/compendium\/([a-z]+)\/([^/]+)\/([^/]+)$/i) ||
            pathname.match(/^\/api\/(creature|spell|item|optionalfeature)\/([^/]+)\/([^/]+)$/i);
        if (singularOrCompendiumItemMatch) {
            const [, rawType, rawSource, rawId] = singularOrCompendiumItemMatch;
            const rawLower = rawType.toLowerCase();
            const cType = SINGULAR_TYPE_MAP[rawLower] || rawLower;
            const targetSrc = decodeURIComponent(rawSource).toLowerCase();
            const targetId = decodeURIComponent(rawId).toLowerCase();

            // Check custom homebrew sources first
            const customEntries = await getEnabledCustomEntries(cType, new Set());
            const fromCustom = customEntries.find((e) => matchesCompendiumEntry(e, targetSrc, targetId, rawLower));
            if (fromCustom) return jsonResponse(fromCustom);

            const normalizedPath = `data/${cType}-normalized/${cType}-${targetSrc}.json`;
            const fromNormalized = await findCompendiumEntry(normalizedPath, targetSrc, targetId, rawLower);
            if (fromNormalized) return jsonResponse(fromNormalized);

            const staticPath = CATALOG_FILE_MAP[cType];
            if (staticPath) {
                const fromCatalog = await findCompendiumEntry(staticPath, targetSrc, targetId, rawLower);
                if (fromCatalog) return jsonResponse(fromCatalog);
            }
            return jsonResponse({ error: 'Entry not found' }, 404);
        }

        // Serve desktop-folder /assets/* and /vtt-uploads/* blobs from IndexedDB if synced
        if ((pathname.startsWith('/assets/') || pathname.startsWith('/vtt-uploads/')) && method === 'GET') {
            const rec = await global.__staticAssetStore?.getBlob?.(pathname);
            if (rec?.blob) {
                return new Response(rec.blob, {
                    status: 200,
                    headers: { 'Content-Type': rec.mimeType || rec.blob.type || 'application/octet-stream' }
                });
            }
        }

        // Rewrite root-relative /data/*, /vtt/data/*, /img/*, and /vtt/img/* so relative paths resolve them
        if (pathname.startsWith('/vtt/data/') || pathname.startsWith('/vtt/img/')) {
            return originalFetch(pathname.slice('/vtt/'.length) + (parsedUrl.search || ''), init);
        }
        if (pathname.startsWith('/data/') || pathname.startsWith('/img/')) {
            return originalFetch(pathname.slice(1) + (parsedUrl.search || ''), init);
        }

        return originalFetch(input, init);
    };
})(typeof window !== 'undefined' ? window : globalThis);
