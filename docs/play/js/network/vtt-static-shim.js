/**
 * vtt-static-shim.js
 * Lightweight fetch bridge for Static Web Hosting (forgedvtt.com/play).
 * Only activates when window.__FORGEDVTT_STATIC_WEB__ is true (no Express backend).
 * Translates /api/compendium/*, /api/campaigns*, /api/sources/disabled, and /api/gm-auth-required
 * to static JSON files under data/ and browser IndexedDB/localStorage.
 */
(function (global) {
    'use strict';

    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return;
    }

    const originalFetch = window.fetch.bind(window);
    const STATIC_DB_NAME = 'forgedvtt_static_db';
    const STATIC_STORE = 'kv';

    function isStaticWebActive() {
        return Boolean(global.__FORGEDVTT_STATIC_WEB__);
    }

    function openStaticIdb() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const req = indexedDB.open(STATIC_DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STATIC_STORE)) {
                    db.createObjectStore(STATIC_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbGet(key) {
        try {
            const db = await openStaticIdb();
            if (!db) return null;
            return await new Promise((resolve) => {
                const tx = db.transaction(STATIC_STORE, 'readonly');
                const req = tx.objectStore(STATIC_STORE).get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => resolve(null);
            });
        } catch (_) {
            return null;
        }
    }

    async function idbSet(key, val) {
        try {
            const db = await openStaticIdb();
            if (!db) return;
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STATIC_STORE, 'readwrite');
                tx.objectStore(STATIC_STORE).put(val, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (_) {}
    }

    let _persistTimer = null;
    global.__persistStaticCampaign = function (campaignObj) {
        if (!campaignObj || !campaignObj.id) return;
        if (_persistTimer) clearTimeout(_persistTimer);
        _persistTimer = setTimeout(async () => {
            try {
                const existing = (await idbGet('campaigns')) || {};
                existing[campaignObj.id] = JSON.parse(JSON.stringify(campaignObj));
                await idbSet('campaigns', existing);
            } catch (_) {}
        }, 250);
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

    global.__verifyStaticGmPassword = async function (username, password) {
        const creds = readStaticGmCreds();
        if (!creds || !creds.hasPassword || !creds.sha256Hash) {
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
        background: 'backgrounds',
        handout: 'handouts'
    };

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

        if (pathname === '/api/gm-auth-required') {
            const creds = readStaticGmCreds();
            const hasPassword = Boolean(creds && creds.hasPassword && creds.sha256Hash);
            return jsonResponse({ required: hasPassword, hasPassword });
        }

        if (pathname === '/api/sources/disabled') {
            try {
                const campId = parsedUrl.searchParams.get('campaignId');
                if (campId) {
                    const campMapRaw = localStorage.getItem('forgedvtt_static_campaign_sources');
                    const campMap = campMapRaw ? JSON.parse(campMapRaw) : {};
                    if (Array.isArray(campMap?.[campId])) {
                        return jsonResponse({ disabledSources: campMap[campId] });
                    }
                }
                const raw = localStorage.getItem('forgedvtt_static_disabled_sources');
                const parsed = raw ? JSON.parse(raw) : [];
                return jsonResponse({ disabledSources: Array.isArray(parsed) ? parsed : [] });
            } catch (_) {
                return jsonResponse({ disabledSources: [] });
            }
        }

        // Static /api/assets & uploads (Data URL fallback so portraits/tokens/maps work offline)
        if (pathname === '/api/assets') {
            return jsonResponse({ name: 'Root', path: '', type: 'folder', children: [] });
        }
        if (pathname === '/api/assets/upload' || pathname === '/api/upload') {
            try {
                const fd = init?.body;
                let file = null;
                if (fd && typeof fd.get === 'function') {
                    file = fd.get('file') || fd.get('image') || fd.get('files');
                }
                if (file && typeof FileReader !== 'undefined') {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result || ''));
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(file);
                    });
                    return jsonResponse({
                        success: true,
                        url: dataUrl,
                        name: file.name || 'upload.png',
                        files: [{ url: dataUrl, name: file.name || 'upload.png', path: dataUrl }]
                    });
                }
            } catch (_) {}
            return jsonResponse({ success: false, error: 'Unsupported static file upload' }, 400);
        }
        if (pathname === '/api/player-token/url') {
            try {
                const parsedBody = init?.body ? JSON.parse(init.body) : {};
                return jsonResponse({ url: parsedBody.url || '' });
            } catch (_) {
                return jsonResponse({ url: '' });
            }
        }
        if (pathname === '/api/resolve-media-url') {
            const rawTarget = parsedUrl.searchParams.get('url') || '';
            return jsonResponse({
                resolvedUrl: rawTarget,
                isVideo: /\.(mp4|webm|ogg)(\?.*)?$/i.test(rawTarget) || /youtube\.com|youtu\.be/i.test(rawTarget),
                originalUrl: rawTarget
            });
        }
        if (pathname === '/api/tables/catalog' || pathname === '/api/decks/catalog') {
            return jsonResponse({ tables: [], decks: [] });
        }
        if (pathname.startsWith('/api/tables/') || pathname.startsWith('/api/decks/')) {
            return jsonResponse({});
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
                initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false }
            });
        }

        const directCatMatch = pathname.match(/^\/api\/([a-z]+)\/catalog$/i);
        if (directCatMatch && !pathname.startsWith('/api/compendium/')) {
            const rawCat = directCatMatch[1].toLowerCase();
            const normCat = SINGULAR_TYPE_MAP[rawCat] || rawCat;
            const staticPath = CATALOG_FILE_MAP[normCat];
            if (staticPath) {
                return originalFetch(staticPath, init);
            }
        }

        const catMatch = pathname.match(/^\/api\/compendium\/([a-z]+)\/catalog$/i);
        if (catMatch) {
            const cType = catMatch[1].toLowerCase();
            const staticPath = CATALOG_FILE_MAP[cType];
            if (staticPath) {
                return originalFetch(staticPath, init);
            }
        }

        async function findCompendiumEntry(staticUrl, targetSrc, targetId) {
            try {
                const res = await originalFetch(staticUrl, init);
                if (!res || !res.ok) return null;
                const data = await res.json();
                const entries = Array.isArray(data) ? data : data?.entries || data?.items || [];
                return (
                    entries.find(
                        (e) =>
                            String(e.source || targetSrc).toLowerCase() === targetSrc &&
                            String(e.id || e.name || '').toLowerCase() === targetId
                    ) || null
                );
            } catch (_) {
                return null;
            }
        }

        const handoutsSrcMatch = pathname.match(/^\/api\/handouts\/([^/]+)$/i);
        if (handoutsSrcMatch) {
            const srcLower = decodeURIComponent(handoutsSrcMatch[1]).toLowerCase();
            const res = await originalFetch(`data/handouts-normalized/handouts-${srcLower}.json`, init);
            if (res.ok) return res;
            return jsonResponse({ handouts: [] });
        }

        const singularOrCompendiumItemMatch =
            pathname.match(/^\/api\/compendium\/([a-z]+)\/([^/]+)\/([^/]+)$/i) ||
            pathname.match(/^\/api\/(creature|spell|item)\/([^/]+)\/([^/]+)$/i);
        if (singularOrCompendiumItemMatch) {
            const [, rawType, rawSource, rawId] = singularOrCompendiumItemMatch;
            const rawLower = rawType.toLowerCase();
            const cType = SINGULAR_TYPE_MAP[rawLower] || rawLower;
            const targetSrc = decodeURIComponent(rawSource).toLowerCase();
            const targetId = decodeURIComponent(rawId).toLowerCase();

            const normalizedPath = `data/${cType}-normalized/${cType}-${targetSrc}.json`;
            const fromNormalized = await findCompendiumEntry(normalizedPath, targetSrc, targetId);
            if (fromNormalized) return jsonResponse(fromNormalized);

            const staticPath = CATALOG_FILE_MAP[cType];
            if (staticPath) {
                const fromCatalog = await findCompendiumEntry(staticPath, targetSrc, targetId);
                if (fromCatalog) return jsonResponse(fromCatalog);
            }
        }

        // Rewrite root-relative /data/* and /vtt/data/* calls to relative data/* so <base href="/play/"> resolves them
        if (pathname.startsWith('/vtt/data/')) {
            return originalFetch(pathname.slice('/vtt/'.length) + (parsedUrl.search || ''), init);
        }
        if (pathname.startsWith('/data/')) {
            return originalFetch(pathname.slice(1) + (parsedUrl.search || ''), init);
        }

        return originalFetch(input, init);
    };
})(typeof window !== 'undefined' ? window : globalThis);
