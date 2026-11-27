/**
 * web-api-bridge.js
 * Browser-side adapter that implements window.electronAPI over authenticated HTTP calls
 * when the Control Center is opened via /prep in a standard web browser.
 */
(function () {
    'use strict';

    if (typeof window === 'undefined' || window.electronAPI) {
        return;
    }

    const TOKEN_KEY = 'forgedvtt_gm_token';
    const USER_KEY = 'forgedvtt_gm_username';

    window.__FORGEDVTT_WEB_PREP__ = true;

    function getToken() {
        try {
            return sessionStorage.getItem(TOKEN_KEY) || '';
        } catch (_) {
            return '';
        }
    }

    function setSession(token, username) {
        try {
            if (token) {
                sessionStorage.setItem(TOKEN_KEY, token);
                if (username) sessionStorage.setItem(USER_KEY, username);
            } else {
                sessionStorage.removeItem(TOKEN_KEY);
                sessionStorage.removeItem(USER_KEY);
            }
        } catch (_) {}
    }

    async function apiFetch(url, options = {}) {
        const headers = { ...(options.headers || {}) };
        const token = getToken();
        if (token) {
            headers['x-gm-token'] = token;
        }
        if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(url, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                if (typeof window.__onWebPrepAuthExpired === 'function') {
                    window.__onWebPrepAuthExpired(data.error || 'Session expired');
                }
            }
            const err = new Error(data.error || `Request failed (${res.status})`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    function triggerDownload(fileName, content, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function pickFiles({ accept = '.json', multiple = false } = {}) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            if (accept) input.accept = accept;
            input.multiple = multiple;
            input.onchange = () => {
                const files = Array.from(input.files || []);
                resolve(files);
            };
            input.click();
        });
    }

    async function readJsonFile(file) {
        const text = await file.text();
        return JSON.parse(text);
    }

    let hybridAuthState = {
        hasGmPassword: true,
        passwordlessLoopback: false,
        serverUsername: ''
    };

    window.__webPrepAuth = {
        getToken,
        getUsername: () => {
            try {
                return sessionStorage.getItem(USER_KEY) || hybridAuthState.serverUsername || '';
            } catch (_) {
                return hybridAuthState.serverUsername || '';
            }
        },
        async initMode() {
            if (window.__FORGEDVTT_STATIC_WEB__) {
                if (window.__staticStorageDriver) await window.__staticStorageDriver.init();
                return 'static';
            }
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 1200);
                const res = await fetch('/api/server/data-dir', { signal: ctrl.signal });
                clearTimeout(timer);
                const ct = res.headers.get('content-type') || '';
                if (res.ok && ct.includes('application/json')) {
                    return 'hybrid';
                }
            } catch (_) {}
            window.__FORGEDVTT_STATIC_WEB__ = true;
            if (window.__staticStorageDriver) await window.__staticStorageDriver.init();
            return 'static';
        },
        async verifySession() {
            const token = getToken();
            try {
                const headers = token ? { 'x-gm-token': token } : {};
                const res = await fetch('/api/server/data-dir', { headers });
                if (!res.ok) return false;
                const data = await res.json();
                if (!data || typeof data.activeDataDir !== 'string') return false;
                hybridAuthState = {
                    hasGmPassword: data.hasGmPassword !== false,
                    passwordlessLoopback: Boolean(data.passwordlessLoopback),
                    serverUsername: typeof data.gmUsername === 'string' ? data.gmUsername : ''
                };
                if (token && data.authenticated === false) {
                    setSession('', '');
                }
                return Boolean(data.authenticated || hybridAuthState.passwordlessLoopback);
            } catch (_) {
                return false;
            }
        },
        async login(username, password) {
            const res = await fetch('/api/gm-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || `Login failed (${res.status})`);
            }
            setSession(data.token, data.username);
            hybridAuthState.hasGmPassword = true;
            hybridAuthState.serverUsername = data.username || '';
            return data;
        },
        async logout() {
            const token = getToken();
            if (token) {
                try {
                    await fetch('/api/gm-logout', {
                        method: 'POST',
                        headers: { 'x-gm-token': token }
                    });
                } catch (_) {}
            }
            setSession('', '');
        }
    };

    const isStatic = () => Boolean(window.__FORGEDVTT_STATIC_WEB__ && window.__staticStorageDriver);
    const drv = () => window.__staticStorageDriver;

    window.electronAPI = {
        getPathForFile: (file) => file?.name || '',
        getStatus: async () => {
            if (isStatic()) {
                await drv().init();
                const creds = drv().gmCredentials || {};
                return {
                    isServerRunning: false,
                    isTunnelRunning: false,
                    port: 5050,
                    localUrl: window.location.origin,
                    registeredUrl: 'https://forgedvtt.com',
                    dataDir: drv().getDataPathLabel(),
                    backupsDir: drv().getDataPathLabel(),
                    needsFolderReconnect: Boolean(drv().needsFolderReconnect),
                    rememberedFolderName: drv().rememberedFolderName || '',
                    gmUsername: creds.username || '',
                    hasGmPassword: Boolean(creds.hasPassword),
                    p2p: drv().getP2pStatus(),
                    webPrepMode: true,
                    staticWebMode: true
                };
            }
            return {
                isServerRunning: true,
                isTunnelRunning: false,
                port: window.location.port || 5050,
                localUrl: window.location.origin,
                registeredUrl: window.location.origin,
                gmUsername: window.__webPrepAuth.getUsername() || (hybridAuthState.hasGmPassword ? 'GM' : ''),
                hasGmPassword: hybridAuthState.hasGmPassword,
                webPrepMode: true,
                staticWebMode: false
            };
        },
        getLogs: async () =>
            isStatic()
                ? ['[Static Web Prep] Running 100% in browser (Zero Server / Direct P2P).']
                : ['[Web Prep] Connected to ForgeDVTT Host Server.'],
        startServer: async () => ({ success: !isStatic() }),
        cancelStartServer: async () => ({ success: true }),
        updateServerPort: async () => ({ success: true }),
        stopServer: async () => ({ success: false, error: 'Not available in web mode' }),
        startTunnel: async () => ({ success: false, error: 'Cloudflare Tunnel requires the Desktop App' }),
        stopTunnel: async () => ({ success: false, error: 'Not available in web mode' }),
        openVttApp: async (url) => {
            window.open(url || '../play/', '_blank');
        },
        openVttBrowser: async (url) => {
            window.open(url || '../play/', '_blank');
        },
        openExternal: (url) => window.open(url, '_blank'),
        selectDataFolder: async () => {
            if (!isStatic()) return { canceled: true };
            return await drv().pickCampaignFolder();
        },
        reconnectDataFolder: async () => {
            if (!isStatic()) return { success: false };
            const ok = await drv().reconnectRememberedFolder();
            return { success: ok, path: drv().getDataPathLabel() };
        },
        selectBackupsFolder: async () => ({ canceled: true }),
        openDataFolder: () => {},
        openBackupsFolder: () => {},

        // Backups (Download / Upload)
        backupCampaign: async () => {
            if (isStatic()) {
                await drv().init();
                const payload = {
                    format: 'forgedvtt-backup-v1',
                    exportedAt: new Date().toISOString(),
                    campaigns: drv().campaigns,
                    chatLogs: drv().chatLogs,
                    sourcesConfig: drv().sourcesConfig
                };
                const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const fileName = `ForgeDVTT-Backup-${stamp}.json`;
                triggerDownload(fileName, JSON.stringify(payload, null, 2));
                return { success: true, path: fileName };
            }
            const res = await apiFetch('/api/server/backup');
            if (res.success && res.content) {
                triggerDownload(res.fileName, res.content);
                if (!res.path) res.path = res.fileName;
            }
            return res;
        },
        restoreBackup: async () => {
            const files = await pickFiles({ accept: '.json' });
            if (!files.length) return { canceled: true };
            const backupData = await readJsonFile(files[0]);
            if (isStatic()) {
                if (!backupData?.campaigns || typeof backupData.campaigns !== 'object') {
                    return { success: false, error: 'Invalid backup JSON' };
                }
                Object.assign(drv().campaigns, backupData.campaigns);
                if (backupData.chatLogs && typeof backupData.chatLogs === 'object') {
                    Object.assign(drv().chatLogs, backupData.chatLogs);
                    await drv()._writeJsonToDir?.('chat-log.json', drv().chatLogs);
                }
                if (backupData.sourcesConfig && typeof backupData.sourcesConfig === 'object') {
                    drv().sourcesConfig = { ...drv().sourcesConfig, ...backupData.sourcesConfig };
                    await drv()._saveSourcesConfig();
                }
                await drv()._saveCampaigns();
                const count = Object.keys(backupData.campaigns).length;
                return { success: true, count, restoredCount: count };
            }
            return await apiFetch('/api/server/restore', {
                method: 'POST',
                body: JSON.stringify({ backupData })
            });
        },

        // GM Credentials
        getGmCredentials: async () => {
            if (isStatic()) {
                await drv().init();
                return {
                    username: drv().gmCredentials?.username || '',
                    hasPassword: Boolean(drv().gmCredentials?.hasPassword)
                };
            }
            return {
                username: window.__webPrepAuth.getUsername(),
                hasPassword: hybridAuthState.hasGmPassword
            };
        },
        setGmCredentials: async ({ username, password, clearPassword }) => {
            if (isStatic()) {
                return await drv().setGmCredentials({ username, password, clearPassword });
            }
            return {
                success: false,
                error: 'Change GM credentials from the Host Desktop App.'
            };
        },

        // Direct P2P Room Management
        p2pGetStatus: async () => {
            if (isStatic()) return drv().getP2pStatus();
            try {
                return await apiFetch('/api/p2p/status');
            } catch (_) {
                return { active: false, roomCode: '', peerCount: 0, peers: [] };
            }
        },
        p2pStartRoom: async (options = {}) => {
            if (isStatic()) return drv().getP2pStatus();
            return await apiFetch('/api/p2p/start', { method: 'POST', body: JSON.stringify(options) });
        },
        p2pStopRoom: async () => {
            if (isStatic()) return { success: true };
            return await apiFetch('/api/p2p/stop', { method: 'POST' });
        },
        p2pRegenCode: async () => {
            if (isStatic()) return drv().regenP2pCode();
            return await apiFetch('/api/p2p/regen', { method: 'POST' });
        },

        // Campaign Management
        gmGetCampaigns: async () => {
            if (isStatic()) {
                await drv().init();
                const list = Object.values(drv().campaigns).map((c) => ({
                    id: c.id,
                    name: c.name || 'Untitled Campaign',
                    description: c.description || '',
                    mapsCount: Object.keys(c.maps || {}).length,
                    playersCount: (c.knownPlayers || []).length
                }));
                return { success: true, campaigns: list };
            }
            const data = await apiFetch('/api/campaigns');
            return { success: true, campaigns: data.campaigns || [] };
        },
        gmGetCampaignDetails: async (id) => {
            if (isStatic()) {
                await drv().init();
                const camp = drv().campaigns[id];
                return camp ? { success: true, campaign: camp } : { success: false, error: 'Campaign not found' };
            }
            const camp = await apiFetch(`/api/campaigns/${encodeURIComponent(id)}`);
            return { success: true, campaign: camp };
        },
        gmSaveCampaign: async (campaign) => {
            if (isStatic()) {
                await drv().init();
                drv().campaigns[campaign.id] = { ...(drv().campaigns[campaign.id] || {}), ...campaign };
                await drv()._saveCampaigns();
                return { success: true, campaign: drv().campaigns[campaign.id] };
            }
            const data = await apiFetch(`/api/campaigns/${encodeURIComponent(campaign.id)}`, {
                method: 'PUT',
                body: JSON.stringify(campaign)
            });
            return { success: true, campaign: data.campaign || campaign };
        },
        gmCreateCampaign: async (payload) => {
            if (isStatic()) {
                await drv().init();
                const folderState =
                    typeof drv().ensureFolderConnectionForImport === 'function'
                        ? await drv().ensureFolderConnectionForImport()
                        : null;
                const name = (payload?.name || 'New Campaign').trim();
                const id = name.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
                const defaultMapId = `map_${id}_default_${Date.now()}`;
                const created = {
                    id,
                    name,
                    description: payload?.description || '',
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
                    allowedUsers: Array.isArray(payload?.allowedUsers) ? payload.allowedUsers : [],
                    knownPlayers: [],
                    updatedAt: Date.now(),
                    initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false }
                };
                drv().campaigns[id] = created;
                await drv()._saveCampaigns();
                const storageLabel =
                    folderState?.storageLabel ||
                    (typeof drv().getDataPathLabel === 'function' ? drv().getDataPathLabel() : '');
                return { success: true, campaign: created, storageLabel };
            }
            const created = await apiFetch('/api/campaigns', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return created?.campaign ? created : { success: true, campaign: created };
        },
        gmDeleteCampaign: async (id) => {
            if (isStatic()) {
                if (Object.keys(drv().campaigns).length <= 1) {
                    return { success: false, error: 'Cannot delete the last remaining campaign.' };
                }
                delete drv().campaigns[id];
                await drv()._saveCampaigns();
                return { success: true };
            }
            return await apiFetch(`/api/campaigns/${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
        },
        gmDuplicateCampaign: async (id) => {
            if (isStatic()) {
                const orig = drv().campaigns[id];
                if (!orig) return { success: false, error: 'Campaign not found' };
                const newId = `${id}_copy_${Date.now()}`;
                const copy = JSON.parse(JSON.stringify(orig));
                copy.id = newId;
                copy.name = `${orig.name || id} (Copy)`;
                drv().campaigns[newId] = copy;
                await drv()._saveCampaigns();
                return { success: true, campaign: copy };
            }
            return await apiFetch(`/api/campaigns/${encodeURIComponent(id)}/duplicate`, {
                method: 'POST'
            });
        },
        gmExportCampaign: async (id) => {
            if (isStatic()) {
                const camp = drv().campaigns[id];
                if (!camp) return { success: false, error: 'Campaign not found' };
                const safe = (camp.name || id).replace(/[^a-zA-Z0-9_-]/g, '_');
                const fileName = `${safe}.json`;
                triggerDownload(fileName, JSON.stringify({ format: 'forgedvtt-campaign-v1', campaign: camp }, null, 2));
                return { success: true, fileName, filePath: fileName };
            }
            const res = await apiFetch(`/api/campaigns/${encodeURIComponent(id)}/export`);
            if (res.success && res.content) {
                triggerDownload(res.fileName, res.content);
                if (!res.filePath) res.filePath = res.fileName;
            }
            return res;
        },
        gmImportCampaign: async (fileInput) => {
            let fileObj = null;
            let parsed = null;
            let folderState = null;
            if (fileInput && typeof fileInput.text === 'function') {
                fileObj = fileInput;
            } else if (fileInput && typeof fileInput === 'object' && typeof fileInput.content === 'string') {
                parsed = JSON.parse(fileInput.content);
            } else {
                if (isStatic() && typeof drv().ensureFolderConnectionForImport === 'function') {
                    folderState = await drv().ensureFolderConnectionForImport();
                }
                const files = await pickFiles({ accept: '.json,.zip' });
                if (!files.length) return { canceled: true };
                fileObj = files[0];
            }
            if (fileObj) {
                const isZip = /\.zip$/i.test(fileObj.name || '');
                if (isZip) {
                    if (isStatic()) {
                        return {
                            success: false,
                            error: 'ZIP campaign archives cannot be imported in offline browser-only mode. Please import an exported campaign .json file or use the Desktop App.'
                        };
                    }
                    const fd = new FormData();
                    fd.append('file', fileObj);
                    return await apiFetch('/api/campaigns/import', { method: 'POST', body: fd });
                }
                parsed = await readJsonFile(fileObj);
            }
            const campaign = parsed?.campaign || parsed;
            if (!campaign || typeof campaign !== 'object') {
                return { success: false, error: 'Invalid campaign JSON' };
            }
            if (isStatic()) {
                if (!folderState && typeof drv().ensureFolderConnectionForImport === 'function') {
                    folderState = await drv().ensureFolderConnectionForImport();
                }
                const reserved = new Set(['__proto__', 'constructor', 'prototype']);
                const cleanObj = (val) => {
                    if (Array.isArray(val)) return val.map(cleanObj);
                    if (!val || typeof val !== 'object') return val;
                    const out = {};
                    for (const [k, v] of Object.entries(val)) {
                        if (!reserved.has(k)) out[k] = cleanObj(v);
                    }
                    return out;
                };
                const rawBaseId = String(campaign.id || 'imported').replace(/[^a-z0-9_-]/gi, '_');
                const newId = (reserved.has(rawBaseId) ? 'imported' : rawBaseId) + '_' + Date.now();
                let campData = cleanObj(campaign);
                if (campaign.id && campaign.id !== newId) {
                    const escOld = String(campaign.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const rx = new RegExp(
                        `(/assets/campaigns/|assets/campaigns/|/vtt-uploads/|vtt-uploads/)${escOld}([/\\\\])`,
                        'g'
                    );
                    campData = JSON.parse(JSON.stringify(campData).replace(rx, `$1${newId}$2`));
                }
                const cloned = { ...campData, id: newId, updatedAt: Date.now() };
                drv().campaigns[newId] = cloned;
                await drv()._saveCampaigns();
                const storageLabel =
                    folderState?.storageLabel ||
                    (typeof drv().getDataPathLabel === 'function' ? drv().getDataPathLabel() : '');
                return { success: true, campaign: cloned, storageLabel };
            }
            return await apiFetch('/api/campaigns/import', {
                method: 'POST',
                body: JSON.stringify({ campaign })
            });
        },
        gmExportGranular: async ({ campaignId, entityType, entityId, batch }) => {
            if (isStatic()) {
                const res = drv().exportGranular({ campaignId, entityType, entityId, batch });
                if (res.success && res.content) triggerDownload(res.fileName, res.content);
                return res;
            }
            const qs = new URLSearchParams({
                entityType: entityType || '',
                entityId: entityId || '',
                batch: batch ? 'true' : 'false'
            }).toString();
            const res = await apiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/export-granular?${qs}`);
            if (res.success && res.content) {
                triggerDownload(res.fileName, res.content);
                if (!res.filePath) res.filePath = res.fileName;
            }
            return res;
        },
        gmImportGranular: async ({ campaignId, explicitFile, entityType: hintEntityType }) => {
            let fileObj = null;
            let parsed = null;
            let folderState = null;
            if (explicitFile && typeof explicitFile.text === 'function') {
                fileObj = explicitFile;
            } else if (explicitFile && typeof explicitFile === 'object' && typeof explicitFile.content === 'string') {
                parsed = JSON.parse(explicitFile.content);
            } else {
                if (isStatic() && typeof drv().ensureFolderConnectionForImport === 'function') {
                    folderState = await drv().ensureFolderConnectionForImport();
                }
                const files = await pickFiles({ accept: '.json,.zip' });
                if (!files.length) return { canceled: true };
                fileObj = files[0];
            }
            if (fileObj) {
                if (/\.zip$/i.test(fileObj.name || '')) {
                    if (isStatic()) {
                        return {
                            success: false,
                            error: 'ZIP imports require the Desktop App or Host Server. Use JSON export/import in browser-only mode.'
                        };
                    }
                    const fd = new FormData();
                    fd.append('file', fileObj);
                    if (hintEntityType) fd.append('entityType', hintEntityType);
                    return await apiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/import-entity`, {
                        method: 'POST',
                        body: fd
                    });
                }
                parsed = await readJsonFile(fileObj);
            }
            const entityType = parsed?.entityType || hintEntityType || undefined;
            const entities = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
            const entity = parsed?.entity || parsed;
            if (isStatic()) {
                if (!folderState && typeof drv().ensureFolderConnectionForImport === 'function') {
                    folderState = await drv().ensureFolderConnectionForImport();
                }
                const res = await drv().importGranular({ campaignId, entityType, entity, entities });
                const storageLabel =
                    folderState?.storageLabel ||
                    (typeof drv().getDataPathLabel === 'function' ? drv().getDataPathLabel() : '');
                return res && typeof res === 'object' ? { ...res, storageLabel } : res;
            }
            if (entities) {
                let importedCount = 0;
                for (const item of entities) {
                    const res = await apiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/import-entity`, {
                        method: 'POST',
                        body: JSON.stringify({ entityType, entity: item })
                    });
                    if (res?.success) importedCount += Number(res.count || 1);
                }
                return { success: importedCount > 0, count: importedCount };
            }
            return await apiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/import-entity`, {
                method: 'POST',
                body: JSON.stringify({ entityType, entity })
            });
        },
        gmDeleteEntity: async ({ campaignId, entityId }) => {
            if (isStatic()) {
                return await drv().deleteEntity({ campaignId, entityId });
            }
            return await apiFetch(
                `/api/campaigns/${encodeURIComponent(campaignId)}/entities/${encodeURIComponent(entityId)}`,
                { method: 'DELETE' }
            );
        },

        // Database Sources & Homebrew Management
        sourcesGetAll: async (campaignId) => {
            if (isStatic()) return await drv().getAllSources(campaignId);
            const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
            return await apiFetch(`/api/sources${qs}`);
        },
        sourcesToggle: (params) => {
            if (isStatic()) return drv().toggleSource(params.code, params.enabled, params.campaignId);
            return apiFetch('/api/sources/toggle', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesBatchToggle: (params) => {
            if (isStatic()) return drv().batchToggle(params);
            return apiFetch('/api/sources/batch-toggle', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesTogglePartnered: (params) => {
            if (isStatic()) return drv().togglePartnered(params);
            return apiFetch('/api/sources/toggle-partnered', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesToggleUA: (params) => {
            if (isStatic()) return drv().toggleUA(params);
            return apiFetch('/api/sources/toggle-ua', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesSaveUiState: (params) => {
            if (isStatic()) return drv().saveUiState(params);
            return apiFetch('/api/sources/ui-state', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesApplyPreset: (params) => {
            if (isStatic()) return drv().applyPreset(params);
            return apiFetch('/api/sources/apply-preset', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesResetCampaign: (campaignId) => {
            if (isStatic()) return drv().resetCampaignSources(campaignId);
            return apiFetch('/api/sources/reset-campaign', { method: 'POST', body: JSON.stringify({ campaignId }) });
        },
        sourcesGetDetails: ({ category, code }) => {
            if (isStatic()) return Promise.resolve(drv().getSourceDetails({ category, code }));
            const qs = new URLSearchParams({ category, code }).toString();
            return apiFetch(`/api/sources/details?${qs}`);
        },
        sourcesSaveDetails: (data) => {
            if (isStatic()) return drv().saveSourceDetails(data);
            return apiFetch('/api/sources/details', { method: 'POST', body: JSON.stringify(data) });
        },
        sourcesCreateCustom: (data) => {
            if (isStatic()) return drv().createCustomSource(data);
            return apiFetch('/api/sources/custom', { method: 'POST', body: JSON.stringify(data) });
        },
        sourcesDeleteCustom: ({ category, code }) => {
            if (isStatic()) return drv().deleteCustomSource({ category, code });
            return apiFetch('/api/sources/custom', { method: 'DELETE', body: JSON.stringify({ category, code }) });
        },
        sourcesAddFile: async ({ category }) => {
            const files = await pickFiles({ accept: '.json' });
            if (!files.length) return { canceled: true };
            const content = await files[0].text();
            if (isStatic()) {
                return await drv().addDatabaseFile({ category, fileName: files[0].name, content });
            }
            return await apiFetch('/api/sources/add-file', {
                method: 'POST',
                body: JSON.stringify({ category, fileName: files[0].name, content })
            });
        },
        sourcesSearchCompendium: ({ category, query, limit }) => {
            if (isStatic()) return drv().searchCompendium({ category, query, limit });
            const qs = new URLSearchParams({
                category: category || '',
                query: query || '',
                limit: String(limit || 50)
            }).toString();
            return apiFetch(`/api/sources/search?${qs}`);
        },
        sourcesSearchGlobal: ({ query, category, limit }) => {
            if (isStatic()) return drv().searchAllCompendium({ query, category, limit });
            const params = { query: query || '', limit: String(limit || 50) };
            if (category) params.category = category;
            const qs = new URLSearchParams(params).toString();
            return apiFetch(`/api/sources/search-global?${qs}`);
        },
        sourcesGetEntityFull: ({ category, name, source }) => {
            if (isStatic()) return drv().getEntityFullData({ category, name, source });
            const qs = new URLSearchParams({ category, name, source }).toString();
            return apiFetch(`/api/sources/entity?${qs}`);
        },
        sourcesGetEntityFullData: ({ category, name, source }) => {
            if (isStatic()) return drv().getEntityFullData({ category, name, source });
            const qs = new URLSearchParams({ category, name, source }).toString();
            return apiFetch(`/api/sources/entity?${qs}`);
        },
        sourcesGetPreview: async ({ category, name, source }) => {
            if (isStatic()) {
                const res = await drv().getEntityFullData({ category, name, source });
                return res?.success && res.entity ? { success: true, statblock: res.entity, entity: res.entity } : res;
            }
            const qs = new URLSearchParams({ category, name, source }).toString();
            return apiFetch(`/api/sources/preview?${qs}`);
        },
        sourcesExport: async ({ category, code }) => {
            if (isStatic()) {
                const res = drv().exportSource({ category, code });
                if (res.success && res.content) triggerDownload(res.fileName, res.content);
                return res;
            }
            const qs = new URLSearchParams({ category, code }).toString();
            const res = await apiFetch(`/api/sources/export?${qs}`);
            if (res.success && res.content) {
                triggerDownload(res.fileName, res.content);
            }
            return res;
        },
        sourcesSelectAsset: async () => {
            const files = await pickFiles({ accept: 'image/*,video/webm,video/mp4' });
            if (!files.length) return { canceled: true };
            if (isStatic()) {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(files[0]);
                });
                return { success: true, url: dataUrl, filePath: dataUrl };
            }
            const fd = new FormData();
            fd.append('file', files[0]);
            return await apiFetch('/api/server/upload-asset', {
                method: 'POST',
                body: fd
            });
        },
        sourcesSelectImportFiles: async () => {
            const files = await pickFiles({ accept: '.json', multiple: true });
            if (!files.length) return { success: false, canceled: true, paths: [], filePaths: [] };
            const loaded = await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.text() })));
            return { success: true, canceled: false, paths: loaded, filePaths: loaded };
        },
        sourcesSelectImportFolder: async () => ({
            success: false,
            canceled: true,
            error: 'Folder selection is only available in the Desktop App. Use Select Files instead.'
        }),
        sourcesInspectBulk: async (filesOrObj) => {
            const rawList = Array.isArray(filesOrObj) ? filesOrObj : filesOrObj?.paths || [];
            const files = await Promise.all(
                rawList.map(async (item) => {
                    if (item && typeof item.text === 'function') {
                        return { name: item.name, content: await item.text() };
                    }
                    return item;
                })
            );
            if (isStatic()) return drv().inspectImportFiles(files);
            return apiFetch('/api/sources/inspect-bulk', {
                method: 'POST',
                body: JSON.stringify({ files })
            });
        },
        sourcesExecuteBulkImport: (params) => {
            if (isStatic()) return drv().bulkImportSources(params);
            return apiFetch('/api/sources/execute-bulk', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesImportFromUrl: async (params) => {
            if (isStatic()) {
                try {
                    const urlStr = String(params?.url || '').trim();
                    const res = await fetch(urlStr);
                    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
                    const content = await res.text();
                    let derivedName = '';
                    try {
                        derivedName = decodeURIComponent(
                            new URL(urlStr, window.location.href).pathname.split('/').pop() || ''
                        );
                    } catch (_) {}
                    const preferred = String(params?.code || params?.sourceName || derivedName || `url-${Date.now()}`)
                        .replace(/\.json$/i, '')
                        .replace(/[^a-zA-Z0-9_-]+/g, '_')
                        .replace(/^_+|_+$/g, '');
                    return await drv().addDatabaseFile({
                        category: params?.category || '',
                        fileName: `${preferred || `URL_${Date.now()}`}.json`,
                        content,
                        metadata: {
                            name: params?.sourceName || preferred || '',
                            author: params?.attribution || '',
                            license: params?.license || '',
                            licenseUrl: params?.licenseUrl || '',
                            attribution: params?.attribution || ''
                        }
                    });
                } catch (err) {
                    return {
                        success: false,
                        error: `Browser blocked direct URL import (CORS or network error: ${err.message}). Download the JSON and use Add File instead.`
                    };
                }
            }
            return apiFetch('/api/sources/import-url', { method: 'POST', body: JSON.stringify(params) });
        },
        sourcesSyncToServer: () => {
            if (isStatic()) return Promise.resolve({ success: true });
            return apiFetch('/api/sources/sync', { method: 'POST' });
        },
        sourcesRevealFile: () => {},

        onStatusUpdate: () => () => {},
        onLogUpdate: () => () => {},
        onP2pStatusUpdate: () => () => {},
        onPresentationStatusUpdate: () => () => {}
    };
})();
