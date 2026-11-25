/**
 * ForgeDVTT - Native WebRTC STUN P2P Virtual Socket Adapter
 * Emulates a Socket.IO client interface over an encrypted WebRTC RTCDataChannel.
 * Supports dual signaling (Public Broker Room Codes + Serverless Manual Text Exchange)
 * and binary chunk streaming for large battlemaps with zero server bandwidth.
 */

(function (global) {
    'use strict';

    const DEFAULT_ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
    ];

    const CHUNK_SIZE = 16 * 1024; // 16 KB binary/RPC chunks safe for desktop and mobile WebRTC stacks
    const MAX_ASSET_CHUNKS = 8192; // 128 MB max chunked payload
    const MAX_ASSET_BYTES = 100 * 1024 * 1024;
    const TRANSPARENT_ASSET_PLACEHOLDER =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
    const SAFE_P2P_ASSET_MIMES = new Set([
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'video/webm',
        'video/mp4',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
        'audio/webm',
        'application/octet-stream'
    ]);
    const SIGNAL_PREFIX_OFFER = 'dndvtt://offer/';
    const SIGNAL_PREFIX_ANSWER = 'dndvtt://answer/';

    // Public broker fallback for 1-click room codes
    const PUBLIC_BROKER_HOST = '0.peerjs.com';
    const PUBLIC_BROKER_PORT = 443;
    const PUBLIC_BROKER_PATH = '/';

    // Events non-GM P2P players are permitted to emit to Host
    const PLAYER_ALLOWED_P2P_EVENTS = new Set([
        'chat:msg',
        'chat:whisper',
        'chat:save_resolved',
        'chat:mass_attack_resolved',
        'chat:macro_resolved',
        'map:ping',
        'map:request_sync',
        'map:switch-player',
        'player:map_override',
        'token:request_sync',
        'token:update',
        'token:add',
        'token:update_delta',
        'token:delete',
        'token:force_select_gm',
        'tokens:damage_fx',
        'tokens:heal_fx',
        'character:update',
        'character:create',
        'character:delete',
        'initiative:update',
        'dice:roll',
        'game:set_pause',
        'door:toggle',
        'trap:trigger',
        'portal:teleport_inter_map',
        'portal:teleport_inter_map_batch',
        'shapes:update',
        'drawings:update',
        'measure:update',
        'measure:clear',
        'deck:state_update'
    ]);

    function loadConfiguredIceServers(explicitServers) {
        const servers =
            Array.isArray(explicitServers) && explicitServers.length ? [...explicitServers] : [...DEFAULT_ICE_SERVERS];
        try {
            if (typeof window !== 'undefined' && window.location?.hash) {
                const hashMatch = window.location.hash.match(/ice=([^&]+)/);
                if (hashMatch && hashMatch[1]) {
                    const decoded = decodeURIComponent(escape(atob(decodeURIComponent(hashMatch[1]))));
                    const parsed = JSON.parse(decoded);
                    if (Array.isArray(parsed)) {
                        for (const s of parsed) {
                            if (s && s.urls) servers.push(s);
                        }
                    }
                }
            }
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('forgedvtt_ice_servers');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        for (const s of parsed) {
                            if (s && s.urls && !servers.some((x) => x.urls === s.urls)) {
                                servers.push(s);
                            }
                        }
                    }
                }
            }
        } catch (_) {}
        return servers;
    }

    class VttP2PAdapter {
        constructor(options = {}) {
            this.isHost = Boolean(options.isHost);
            this.role = options.role || (this.isHost ? 'GM' : 'Player');
            this.username = options.username || '';
            this.campaignId = options.campaignId || 'default';
            this.gmPassword = options.gmPassword || null;
            this.iceServers = loadConfiguredIceServers(options.iceServers);

            this.id = 'p2p_' + Math.random().toString(36).substring(2, 10);
            this.connected = false;
            this.isConnecting = false;
            this._peer = null;
            this._reconnectTimer = null;
            this._expressPersistTimer = null;

            // Event listeners map: eventName -> Set(callbacks)
            this._listeners = new Map();

            // Host mode: map of peerId -> { pc, conn, eventsChannel, assetsChannel, username, role, joined }
            this.peers = new Map();

            // Client mode: single host connection
            this.hostPeer = null;

            // Asset & RPC chunk reassembly caches
            this._assetTransfers = new Map();
            this._rpcTransfers = new Map();
            this._remoteAssetBlobCache = new Map();
            this._pendingAssetRequests = new Set();

            // Emulate socket.io sub-object
            this.io = {
                on: (evt, cb) => this.on(`io:${evt}`, cb),
                off: (evt, cb) => this.off(`io:${evt}`, cb)
            };
        }

        // =========================================================================
        // SOCKET.IO COMPATIBILITY API
        // =========================================================================

        on(event, handler) {
            if (!this._listeners.has(event)) {
                this._listeners.set(event, new Set());
            }
            this._listeners.get(event).add(handler);
            return this;
        }

        off(event, handler) {
            if (this._listeners.has(event)) {
                if (handler) {
                    this._listeners.get(event).delete(handler);
                } else {
                    this._listeners.delete(event);
                }
            }
            return this;
        }

        once(event, handler) {
            const wrapper = (...args) => {
                this.off(event, wrapper);
                handler(...args);
            };
            return this.on(event, wrapper);
        }

        _dispatch(event, ...args) {
            if (this._listeners.has(event)) {
                for (const handler of this._listeners.get(event)) {
                    try {
                        handler(...args);
                    } catch (err) {
                        console.error(`[P2P Adapter] Error in listener for "${event}":`, err);
                    }
                }
            }
        }

        _persistHostCampaignState(campObj) {
            const target = campObj || global.VTT?.campaignState;
            if (!this.isHost || !target) return;
            if (typeof global.__persistStaticCampaign === 'function') {
                global.__persistStaticCampaign(target);
                return;
            }
            if (typeof fetch !== 'function' || !target.id) return;
            if (this._expressPersistTimer) clearTimeout(this._expressPersistTimer);
            this._expressPersistTimer = setTimeout(async () => {
                try {
                    const headers = {
                        'Content-Type': 'application/json',
                        ...(typeof global.vttAuthHeaders === 'function' ? global.vttAuthHeaders() : {})
                    };
                    await fetch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(target)
                    });
                } catch (_) {
                    /* ignore background sync errors */
                }
            }, 350);
        }

        _syncPeersToBackendBridge() {
            if (!this.isHost || global.__FORGEDVTT_STATIC_WEB__ || typeof fetch !== 'function') return;
            try {
                const peerList = Array.from(this.peers.values())
                    .filter((p) => p.joined)
                    .map((p) => ({ id: p.id, username: p.username, role: p.role }));
                const headers = {
                    'Content-Type': 'application/json',
                    ...(typeof global.vttAuthHeaders === 'function' ? global.vttAuthHeaders() : {})
                };
                fetch('/api/p2p/peers', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ peers: peerList })
                }).catch(() => {});
            } catch (_) {
                /* ignore */
            }
        }

        emit(event, ...args) {
            if (this.isHost && event === 'join') {
                this._handleHostSelfJoin(args[0]);
                return this;
            }

            if (this.isHost && global.VttP2PHostEngine && typeof global.VttP2PHostEngine.processEvent === 'function') {
                if (global.VttP2PHostEngine.processEvent({ adapter: this, event, args, senderPeer: null })) {
                    return this;
                }
            }

            // Priority 1: Mid-session campaign state sanitization for player peers
            if (
                this.isHost &&
                (event === 'campaign:state-sync' || event === 'campaign:updated' || event === 'campaign:update')
            ) {
                const rawCamp = args[0] || global.VTT?.campaignState;
                for (const [, peer] of this.peers.entries()) {
                    const sanitized = this._sanitizeCampaignStateForPlayer(rawCamp, peer.username || 'Player');
                    const env = JSON.stringify({
                        type: 'event',
                        event,
                        args: [sanitized, ...args.slice(1)],
                        sender: this.username,
                        role: this.role,
                        timestamp: Date.now()
                    });
                    this._sendToPeer(peer, env);
                }
                return this;
            }

            // Priority 1: Persist GM/hidden tokens locally before suppressing broadcast to players
            if (this.isHost && (event === 'token:update' || event === 'token:add')) {
                const tok = args[0]?.token;
                if (tok && (tok.layer === 'gm' || tok.isVisible === false || tok.hidden)) {
                    this._persistHostCampaignState();
                    return this;
                }
            }

            let outboundArgs = args;
            if (this.isHost && event === 'tokens:update') {
                const tokensObj = args[0]?.tokens;
                if (tokensObj && typeof tokensObj === 'object') {
                    if (Array.isArray(tokensObj)) {
                        const safeTokens = tokensObj.filter(
                            (t) => t && t.layer !== 'gm' && t.isVisible !== false && !t.hidden
                        );
                        if (safeTokens.length === 0) {
                            this._persistHostCampaignState();
                            return this;
                        }
                        outboundArgs = [{ ...args[0], tokens: safeTokens }, ...args.slice(1)];
                    } else {
                        const safeTokens = {};
                        for (const k in tokensObj) {
                            const t = tokensObj[k];
                            if (t && t.layer !== 'gm' && t.isVisible !== false && !t.hidden) {
                                safeTokens[k] = t;
                            }
                        }
                        if (Object.keys(safeTokens).length === 0) {
                            this._persistHostCampaignState();
                            return this;
                        }
                        outboundArgs = [{ ...args[0], tokens: safeTokens }, ...args.slice(1)];
                    }
                }
            }

            if (this.isHost && event === 'token:update_delta') {
                const { mapId, tokenId } = args[0] || {};
                const currentToken = global.VTT?.campaignState?.maps?.[mapId]?.tokens?.[tokenId];
                if (
                    currentToken &&
                    (currentToken.layer === 'gm' || currentToken.isVisible === false || currentToken.hidden)
                ) {
                    this._persistHostCampaignState();
                    return this;
                }
            }

            const envelope = JSON.stringify({
                type: 'event',
                event,
                args: outboundArgs,
                sender: this.username,
                role: this.role,
                timestamp: Date.now()
            });

            if (this.isHost) {
                this._persistHostCampaignState();
                this._broadcastToPeers(envelope);
            } else {
                if (this.hostPeer) {
                    this._sendToPeer(this.hostPeer, envelope);
                } else {
                    console.warn(`[P2P Adapter] Cannot emit "${event}": Host peer not connected.`);
                }
            }
            return this;
        }

        async _handleHostSelfJoin(joinData = {}) {
            let gmSessionToken = global.VTT?.gmSessionToken || null;
            if (!global.__FORGEDVTT_STATIC_WEB__ && typeof fetch === 'function') {
                const pw = joinData.gmPassword ?? this.gmPassword;
                const uName = joinData.username || this.username;
                if (pw) {
                    try {
                        const loginRes = await fetch('/api/gm-login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: uName, password: pw })
                        });
                        const loginData = await loginRes.json().catch(() => ({}));
                        if (!loginRes.ok || !loginData.success) {
                            this._dispatch('join_rejected', {
                                reason: loginData.error || 'Incorrect GM Password.'
                            });
                            return;
                        }
                        if (loginData.token) {
                            gmSessionToken = loginData.token;
                            if (global.VTT) global.VTT.gmSessionToken = gmSessionToken;
                        }
                    } catch (err) {
                        console.warn('[P2P Adapter] Express GM login error:', err);
                    }
                }
            }

            let campaignState = global.VTT?.campaignState || null;
            if (!campaignState && typeof fetch === 'function') {
                try {
                    const headers = typeof global.vttAuthHeaders === 'function' ? global.vttAuthHeaders() : {};
                    if (gmSessionToken) headers['x-gm-token'] = gmSessionToken;
                    const res = await fetch(`/api/campaigns/${encodeURIComponent(this.campaignId)}`, { headers });
                    if (res.ok) {
                        campaignState = await res.json();
                    } else if (res.status === 401 || res.status === 403) {
                        this._dispatch('join_rejected', {
                            reason: 'GM authentication required to access this server campaign.'
                        });
                        return;
                    }
                } catch (e) {
                    console.warn('[P2P Adapter] Could not fetch campaign from server:', e);
                }
            }

            setTimeout(() => {
                this._dispatch('joined', {
                    role: 'GM',
                    userRole: 'GM',
                    gmSessionToken,
                    campaignState: campaignState || {
                        id: this.campaignId,
                        name: 'P2P Campaign',
                        maps: {},
                        characters: {}
                    },
                    chatHistory: global.VTT?.chatHistory || []
                });
            }, 30);
        }

        disconnect() {
            this.connected = false;
            this.isConnecting = false;
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
            }

            // Clear all active asset & RPC transfer timeouts and prune memory
            for (const transfer of this._assetTransfers.values()) {
                if (transfer?.timeoutId) clearTimeout(transfer.timeoutId);
            }
            this._assetTransfers.clear();
            this._pendingAssetRequests.clear();
            for (const rpc of this._rpcTransfers.values()) {
                if (rpc?.timeoutId) clearTimeout(rpc.timeoutId);
            }
            this._rpcTransfers.clear();

            if (this.isHost) {
                for (const [, peer] of this.peers.entries()) {
                    try {
                        peer.pc?.close();
                        peer.conn?.close();
                    } catch (e) {}
                }
                this.peers.clear();
            } else if (this.hostPeer) {
                try {
                    this.hostPeer.pc?.close();
                    this.hostPeer.conn?.close();
                } catch (e) {}
                this.hostPeer = null;
            }

            if (this._peer) {
                try {
                    this._peer.destroy();
                } catch (_) {}
                this._peer = null;
            }

            this._dispatch('disconnect', 'client disconnect');
            return this;
        }

        // =========================================================================
        // DATA CHANNEL MESSAGE HANDLING & CHUNK REASSEMBLY
        // =========================================================================

        _isPlayerAllowedEvent(event, args, senderPeer) {
            if (!PLAYER_ALLOWED_P2P_EVENTS.has(event)) return false;
            if (event === 'token:add' || event === 'token:update' || event === 'token:update_delta') {
                const payload = args?.[0] || {};
                const tok = payload.token || payload.changes || {};
                if (tok.layer === 'gm' || tok.hidden === true || tok.isVisible === false) {
                    return false;
                }
                if ((event === 'token:update' || event === 'token:update_delta') && payload.mapId) {
                    const existing =
                        global.VTT?.campaignState?.maps?.[payload.mapId]?.tokens?.[
                            payload.tokenId || payload.token?.id
                        ];
                    if (existing) {
                        const senderLower = String(senderPeer.username || '').toLowerCase();
                        const owner = String(
                            existing.owner || existing.playerOwner || existing.ownerUsername || ''
                        ).toLowerCase();
                        const players = Array.isArray(existing.players)
                            ? existing.players.map((p) => String(p).toLowerCase())
                            : [];
                        if (owner !== senderLower && !players.includes(senderLower)) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        requestAsset(url) {
            if (!url || typeof url !== 'string' || this.isHost) return null;
            if (this._remoteAssetBlobCache.has(url)) {
                return this._remoteAssetBlobCache.get(url);
            }
            if (this.connected && this.hostPeer && !this._pendingAssetRequests.has(url)) {
                this._pendingAssetRequests.add(url);
                this._sendToPeer(this.hostPeer, JSON.stringify({ type: 'asset-request', url }));
            }
            return TRANSPARENT_ASSET_PLACEHOLDER;
        }

        resolveAssetUrl(url) {
            if (!url || typeof url !== 'string') return null;
            const isPrivateP2pAsset =
                url.startsWith('forgedvtt-asset://') || url.startsWith('/vtt-uploads/') || url.startsWith('/assets/');
            if (!isPrivateP2pAsset) return null;

            if (this.isHost) {
                if (url.startsWith('forgedvtt-asset://') && typeof global.__resolveStaticAssetUrl === 'function') {
                    return global.__resolveStaticAssetUrl(url);
                }
                return null;
            }

            return this.requestAsset(url);
        }

        async _handlePeerAssetRequest(url, senderPeer) {
            if (!this.isHost || !senderPeer || !senderPeer.joined || typeof url !== 'string') return;
            const isSafeLocal =
                url.startsWith('forgedvtt-asset://') || url.startsWith('/vtt-uploads/') || url.startsWith('/assets/');
            if (!isSafeLocal || url.includes('..') || url.includes('\0')) return;

            try {
                let blob = null;
                let mimeType = 'application/octet-stream';
                if (url.startsWith('forgedvtt-asset://') && global.__staticAssetStore?.getBlob) {
                    const rec = await global.__staticAssetStore.getBlob(url);
                    if (rec instanceof Blob) {
                        blob = rec;
                        mimeType = rec.type || mimeType;
                    } else if (rec?.blob) {
                        blob = rec.blob;
                        mimeType = rec.mimeType || rec.blob.type || mimeType;
                    }
                } else if (typeof fetch === 'function') {
                    const headers = typeof global.vttAuthHeaders === 'function' ? global.vttAuthHeaders() : {};
                    const res = await fetch(url, { headers });
                    if (res.ok) {
                        blob = await res.blob();
                        mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || blob.type || mimeType;
                    }
                }
                if (!blob) return;
                const arrayBuf = await blob.arrayBuffer();
                const bytes = new Uint8Array(arrayBuf);
                let binary = '';
                const step = 0x8000;
                for (let i = 0; i < bytes.length; i += step) {
                    binary += String.fromCharCode(...bytes.subarray(i, i + step));
                }
                const base64Data = btoa(binary);
                const assetId = `p2p_asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                await this._streamAssetToPeer(senderPeer, assetId, base64Data, mimeType, { originalUrl: url });
            } catch (err) {
                console.warn(`[P2P Adapter] Could not fulfill asset request for ${url}:`, err);
            }
        }

        _handleIncomingData(rawMessage, senderPeer = null) {
            let payload;
            try {
                payload = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
            } catch (e) {
                console.error('[P2P Adapter] Invalid JSON payload received:', e);
                return;
            }

            if (!payload || !payload.type) return;

            switch (payload.type) {
                case 'rpc-start': {
                    const { id, totalChunks } = payload;
                    if (!id || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_ASSET_CHUNKS)
                        return;
                    const existing = this._rpcTransfers.get(id);
                    if (existing?.timeoutId) clearTimeout(existing.timeoutId);
                    const timeoutId = setTimeout(() => this._rpcTransfers.delete(id), 30000);
                    this._rpcTransfers.set(id, {
                        chunks: new Array(totalChunks),
                        receivedCount: 0,
                        totalChunks,
                        timeoutId
                    });
                    break;
                }

                case 'rpc-chunk': {
                    const { id, index, data } = payload;
                    const transfer = this._rpcTransfers.get(id);
                    if (!transfer || !Number.isInteger(index) || index < 0 || index >= transfer.totalChunks) return;
                    if (!transfer.chunks[index] && typeof data === 'string') {
                        transfer.chunks[index] = data;
                        transfer.receivedCount++;
                        if (transfer.receivedCount === transfer.totalChunks) {
                            clearTimeout(transfer.timeoutId);
                            const fullText = transfer.chunks.join('');
                            this._rpcTransfers.delete(id);
                            this._handleIncomingData(fullText, senderPeer);
                        }
                    }
                    break;
                }

                case 'asset-request': {
                    if (this.isHost && senderPeer) {
                        this._handlePeerAssetRequest(payload.url, senderPeer);
                    }
                    break;
                }

                case 'event': {
                    const { event, args } = payload;

                    // Authoritative Host: Handle player 'join' request
                    if (this.isHost && event === 'join' && senderPeer) {
                        const joinData = args?.[0] || {};
                        const playerRole = 'Player';
                        const playerName = String(joinData.username || 'Player').trim() || 'Player';

                        // Allowlist & reserved GM name verification
                        const campState = global.VTT?.campaignState;
                        const gmName = String(campState?.gmUsername || this.username || '')
                            .trim()
                            .toLowerCase();
                        const allowed = campState?.allowedUsers || [];
                        if (
                            joinData.role === 'GM' ||
                            (gmName && playerName.toLowerCase() === gmName && joinData.role !== 'Player') ||
                            (allowed.length > 0 && !allowed.includes(playerName))
                        ) {
                            const reason =
                                joinData.role === 'GM'
                                    ? 'Only the host browser can join as GM in a Direct P2P room.'
                                    : 'Username not on the allowed list';
                            const rejPacket = JSON.stringify({
                                type: 'event',
                                event: 'join_rejected',
                                args: [{ reason }]
                            });
                            this._sendToPeer(senderPeer, rejPacket);
                            setTimeout(() => {
                                try {
                                    senderPeer.conn?.close();
                                    senderPeer.pc?.close();
                                } catch (_) {}
                                this.peers.delete(senderPeer.id);
                            }, 50);
                            return;
                        }

                        senderPeer.joined = true;
                        senderPeer.username = playerName;
                        senderPeer.role = playerRole;
                        this._syncPeersToBackendBridge();

                        // Authoritative sanitization: GM secrets never sent to players
                        const sanitizedState = this._sanitizeCampaignStateForPlayer(campState, playerName);
                        const joinedPacket = JSON.stringify({
                            type: 'event',
                            event: 'joined',
                            args: [
                                {
                                    role: playerRole,
                                    userRole: playerRole,
                                    campaignState: sanitizedState,
                                    chatHistory: (global.VTT?.chatHistory || []).slice(-50)
                                }
                            ]
                        });
                        this._sendToPeer(senderPeer, joinedPacket);

                        const joinNotice = JSON.stringify({
                            type: 'event',
                            event: 'sys_message',
                            args: [{ text: `${playerName} has joined via Direct P2P.`, timestamp: Date.now() }]
                        });
                        this._broadcastToPeers(joinNotice);
                        return;
                    }

                    // Host must reject events from peers that have not completed 'join' or emit GM-only events
                    if (this.isHost && senderPeer) {
                        if (!senderPeer.joined) {
                            console.warn(
                                `[P2P Security] Ignored unauthenticated event "${event}" from peer ${senderPeer.id}`
                            );
                            return;
                        }
                        if (!this._isPlayerAllowedEvent(event, args, senderPeer)) {
                            console.warn(
                                `[P2P Security] Blocked unauthorized event "${event}" from P2P player "${senderPeer.username}"`
                            );
                            return;
                        }
                        if (global.VttP2PHostEngine && typeof global.VttP2PHostEngine.processEvent === 'function') {
                            if (global.VttP2PHostEngine.processEvent({ adapter: this, event, args, senderPeer })) {
                                return;
                            }
                        }
                    }

                    // Dispatch to local listeners
                    this._dispatch(event, ...(args || []));

                    // If Host, persist and forward/rebroadcast player-safe events to other peers (except sender)
                    if (this.isHost && senderPeer) {
                        this._persistHostCampaignState();
                        const safeForward = JSON.stringify({
                            type: 'event',
                            event,
                            args,
                            sender: senderPeer.username,
                            role: senderPeer.role,
                            timestamp: Date.now()
                        });
                        this._broadcastToPeers(safeForward, senderPeer.id);
                    }
                    break;
                }

                case 'asset-start': {
                    if (this.isHost && senderPeer && !senderPeer.joined) return;
                    const { id, totalChunks, totalBytes, mimeType, meta } = payload;
                    const safeMime = String(mimeType || 'image/jpeg')
                        .toLowerCase()
                        .split(';')[0]
                        .trim();
                    if (
                        !id ||
                        !Number.isInteger(totalChunks) ||
                        totalChunks < 1 ||
                        totalChunks > MAX_ASSET_CHUNKS ||
                        (totalBytes && totalBytes > MAX_ASSET_BYTES) ||
                        !SAFE_P2P_ASSET_MIMES.has(safeMime)
                    ) {
                        console.warn(
                            `[P2P Security] Rejected invalid asset transfer header "${id}" (${safeMime}, ${totalChunks} chunks)`
                        );
                        return;
                    }
                    if (this._assetTransfers.has(id)) {
                        const existing = this._assetTransfers.get(id);
                        if (existing?.timeoutId) clearTimeout(existing.timeoutId);
                    }
                    const timeoutId = setTimeout(() => {
                        if (this._assetTransfers.has(id)) {
                            console.warn(`[P2P Adapter] Asset transfer ${id} timed out. Pruning abandoned chunks.`);
                            this._assetTransfers.delete(id);
                        }
                    }, 60000); // 60s TTL
                    this._assetTransfers.set(id, {
                        chunks: new Array(totalChunks),
                        receivedCount: 0,
                        totalChunks,
                        totalBytes,
                        mimeType: safeMime,
                        meta: meta || {},
                        createdAt: Date.now(),
                        timeoutId
                    });
                    break;
                }

                case 'asset-chunk': {
                    const { id, index, data } = payload;
                    const transfer = this._assetTransfers.get(id);
                    if (
                        transfer &&
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index < transfer.totalChunks &&
                        !transfer.chunks[index] &&
                        typeof data === 'string'
                    ) {
                        transfer.chunks[index] = data;
                        transfer.receivedCount++;

                        if (transfer.receivedCount === transfer.totalChunks) {
                            this._finalizeAssetTransfer(id, transfer);
                        }
                    }
                    break;
                }

                default:
                    console.warn('[P2P Adapter] Unhandled packet type:', payload.type);
            }
        }

        _sanitizeCampaignStateForPlayer(camp, username) {
            if (!camp) return { id: this.campaignId };
            const clone = JSON.parse(JSON.stringify(camp));

            delete clone.gmPasswordHash;
            delete clone.gmCredentials;
            delete clone.activeGMMapId;

            if (!clone.mapOrder && clone.maps) clone.mapOrder = Object.keys(clone.maps);
            const activeIds = new Set();
            if (clone.activeMapId) activeIds.add(clone.activeMapId);
            const overrideId = clone.playerMapOverrides?.[username];
            if (overrideId) activeIds.add(overrideId);

            if (clone.maps) {
                for (const mapId in clone.maps) {
                    const m = clone.maps[mapId];
                    if (!m) continue;

                    if (m.tokens) {
                        for (const tId in m.tokens) {
                            const tok = m.tokens[tId];
                            if (tok && (tok.layer === 'gm' || tok.isVisible === false || tok.hidden)) {
                                delete m.tokens[tId];
                            }
                        }
                    }

                    if (Array.isArray(m.portals)) {
                        m.portals = m.portals.filter((p) => p && !p.isSecret);
                    }
                    m.traps = [];
                    if (activeIds.size > 0 && !activeIds.has(mapId)) {
                        m.walls = [];
                        m.lights = [];
                        m.shapes = {};
                        m.drawings = {};
                        m.notes = [];
                    } else {
                        m.notes = Array.isArray(m.notes)
                            ? m.notes.filter((n) => n && (n.isPublic || n.author === username))
                            : [];
                    }
                }
            }
            return clone;
        }

        _finalizeAssetTransfer(id, transfer) {
            try {
                if (transfer?.timeoutId) {
                    clearTimeout(transfer.timeoutId);
                }
                const fullBase64 = transfer.chunks.join('');
                const dataUrl = `data:${transfer.mimeType};base64,${fullBase64}`;
                this._assetTransfers.delete(id);

                let resolvedUrl = dataUrl;
                const origUrl = transfer.meta?.originalUrl;
                if (origUrl) {
                    this._pendingAssetRequests.delete(origUrl);
                    if (
                        typeof atob === 'function' &&
                        typeof Blob !== 'undefined' &&
                        typeof URL?.createObjectURL === 'function'
                    ) {
                        try {
                            const binStr = atob(fullBase64);
                            const bytes = new Uint8Array(binStr.length);
                            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                            const blob = new Blob([bytes], { type: transfer.mimeType });
                            resolvedUrl = URL.createObjectURL(blob);
                        } catch (_) {
                            resolvedUrl = dataUrl;
                        }
                    }
                    this._remoteAssetBlobCache.set(origUrl, resolvedUrl);
                    global.VTT?.canvasEngine?.refreshAssetUrl?.(origUrl);
                }

                this._dispatch('asset:received', {
                    id,
                    originalUrl: origUrl,
                    url: dataUrl,
                    blobUrl: resolvedUrl,
                    meta: transfer.meta
                });
            } catch (err) {
                console.error(`[P2P Adapter] Failed to finalize asset ${id}:`, err);
            }
        }

        _sendRawPacket(peer, text, preferAssets = false) {
            const ch = preferAssets && peer.assetsChannel?.readyState === 'open' ? peer.assetsChannel : null;
            if (ch) {
                ch.send(text);
            } else if (peer.conn?.open) {
                peer.conn.send(text);
            } else if (peer.eventsChannel?.readyState === 'open') {
                peer.eventsChannel.send(text);
            }
        }

        _getBufferedAmount(peer, preferAssets = false) {
            const dc =
                preferAssets && peer.assetsChannel?.readyState === 'open'
                    ? peer.assetsChannel
                    : peer.conn?.dataChannel || peer.eventsChannel;
            return dc && typeof dc.bufferedAmount === 'number' ? dc.bufferedAmount : 0;
        }

        async _streamAssetToPeer(peer, assetId, base64Data, mimeType = 'image/jpeg', meta = {}) {
            if (!peer || !base64Data) return;
            const totalLen = base64Data.length;
            const totalChunks = Math.ceil(totalLen / CHUNK_SIZE);
            const startPacket = JSON.stringify({
                type: 'asset-start',
                id: assetId,
                totalChunks,
                totalBytes: totalLen,
                mimeType,
                meta
            });
            this._sendToPeer(peer, startPacket, true);

            for (let i = 0; i < totalChunks; i++) {
                const chunkPacket = JSON.stringify({
                    type: 'asset-chunk',
                    id: assetId,
                    index: i,
                    data: base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                });
                this._sendRawPacket(peer, chunkPacket, true);
                if (i % 10 === 0 || this._getBufferedAmount(peer, true) > 256 * 1024) {
                    await new Promise((r) => setTimeout(r, 8));
                }
            }
        }

        _sendToPeer(peer, message, preferAssets = false) {
            try {
                const str = typeof message === 'string' ? message : JSON.stringify(message);
                if (str.length <= CHUNK_SIZE) {
                    this._sendRawPacket(peer, str, preferAssets);
                    return;
                }
                const rpcId = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const totalChunks = Math.ceil(str.length / CHUNK_SIZE);
                this._sendRawPacket(peer, JSON.stringify({ type: 'rpc-start', id: rpcId, totalChunks }), preferAssets);
                for (let i = 0; i < totalChunks; i++) {
                    this._sendRawPacket(
                        peer,
                        JSON.stringify({
                            type: 'rpc-chunk',
                            id: rpcId,
                            index: i,
                            data: str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                        }),
                        preferAssets
                    );
                }
            } catch (err) {
                console.warn(`[P2P Adapter] Failed to send message to peer ${peer.id}:`, err);
            }
        }

        _broadcastToPeers(message, excludePeerId = null) {
            for (const [peerId, peer] of this.peers.entries()) {
                if (peerId !== excludePeerId) {
                    this._sendToPeer(peer, message);
                }
            }
        }

        // =========================================================================
        // BINARY ASSET STREAMER (Battlemaps & Custom Tokens)
        // =========================================================================

        async streamAssetToPeers(assetId, base64Data, mimeType = 'image/jpeg', meta = {}) {
            if (!this.isHost || !base64Data) return;

            const totalLen = base64Data.length;
            const totalChunks = Math.ceil(totalLen / CHUNK_SIZE);

            const startPacket = JSON.stringify({
                type: 'asset-start',
                id: assetId,
                totalChunks,
                totalBytes: totalLen,
                mimeType,
                meta
            });
            for (const [, peer] of this.peers.entries()) {
                if (peer.joined) {
                    this._sendToPeer(peer, startPacket, true);
                }
            }

            for (let i = 0; i < totalChunks; i++) {
                const chunkSlice = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const chunkPacket = JSON.stringify({
                    type: 'asset-chunk',
                    id: assetId,
                    index: i,
                    data: chunkSlice
                });
                let needsBackpressure = false;
                for (const [, peer] of this.peers.entries()) {
                    if (!peer.joined) continue;
                    this._sendRawPacket(peer, chunkPacket, true);
                    if (this._getBufferedAmount(peer, true) > 256 * 1024) {
                        needsBackpressure = true;
                    }
                }

                if (i % 10 === 0 || needsBackpressure) {
                    await new Promise((r) => setTimeout(r, 8));
                }
            }
        }

        // =========================================================================
        // SERVERLESS MANUAL SIGNALING (Offer & Answer String Exchange)
        // =========================================================================

        /**
         * Host creates a manual connection offer string to send to a player via Discord.
         */
        async createHostManualOffer() {
            const pc = new RTCPeerConnection({ iceServers: this.iceServers });
            const peerId = 'peer_' + Math.random().toString(36).substring(2, 8);

            const eventsChannel = pc.createDataChannel('dndforged-events', { ordered: true });
            const assetsChannel = pc.createDataChannel('dndforged-assets', { ordered: true });

            const peerRecord = {
                id: peerId,
                pc,
                eventsChannel,
                assetsChannel,
                status: 'connecting'
            };
            this.peers.set(peerId, peerRecord);

            eventsChannel.onopen = () => {
                peerRecord.status = 'connected';
                this.connected = true;
                this._dispatch('connect');
                this._dispatch('peer:connected', { peerId });
            };

            eventsChannel.onmessage = (event) => {
                this._handleIncomingData(event.data, peerRecord);
            };
            eventsChannel.onclose = () => {
                this.peers.delete(peerId);
                this._syncPeersToBackendBridge();
                this._dispatch('peer:disconnected', { peerId });
            };
            pc.onconnectionstatechange = () => {
                if (['failed', 'closed'].includes(pc.connectionState)) {
                    this.peers.delete(peerId);
                    this._syncPeersToBackendBridge();
                    this._dispatch('peer:disconnected', { peerId });
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Wait for ICE gathering to complete so all STUN candidates are bundled
            await this._waitForIceGathering(pc);

            this.connected = true;
            this._dispatch('connect');

            const offerPayload = {
                v: 1,
                type: 'offer',
                peerId,
                sdp: pc.localDescription
            };

            return SIGNAL_PREFIX_OFFER + VttP2PAdapter.encodeBase64(JSON.stringify(offerPayload));
        }

        /**
         * Player accepts host's manual offer string and generates an answer string.
         */
        async createPlayerManualAnswer(offerString) {
            const cleanStr = offerString.replace(SIGNAL_PREFIX_OFFER, '').trim();
            const offerData = JSON.parse(VttP2PAdapter.decodeBase64(cleanStr));

            const pc = new RTCPeerConnection({ iceServers: this.iceServers });
            this.hostPeer = { pc, status: 'connecting' };

            pc.ondatachannel = (event) => {
                const channel = event.channel;
                if (channel.label === 'dndforged-events') {
                    this.hostPeer.eventsChannel = channel;
                    channel.onopen = () => {
                        this.connected = true;
                        this.isConnecting = false;
                        this._dispatch('connect');
                    };
                    channel.onmessage = (e) => this._handleIncomingData(e.data);
                    channel.onclose = () => {
                        this.connected = false;
                        this._dispatch('disconnect', 'manual channel closed');
                    };
                } else if (channel.label === 'dndforged-assets') {
                    this.hostPeer.assetsChannel = channel;
                    channel.onmessage = (e) => this._handleIncomingData(e.data);
                }
            };
            pc.onconnectionstatechange = () => {
                if (['failed', 'closed'].includes(pc.connectionState)) {
                    this.connected = false;
                    this._dispatch('disconnect', `webrtc ${pc.connectionState}`);
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await this._waitForIceGathering(pc);

            const answerPayload = {
                v: 1,
                type: 'answer',
                peerId: offerData.peerId,
                sdp: pc.localDescription
            };

            return SIGNAL_PREFIX_ANSWER + VttP2PAdapter.encodeBase64(JSON.stringify(answerPayload));
        }

        /**
         * Host pastes the player's answer string to complete the handshake.
         */
        async applyHostManualAnswer(answerString) {
            const cleanStr = answerString.replace(SIGNAL_PREFIX_ANSWER, '').trim();
            const answerData = JSON.parse(VttP2PAdapter.decodeBase64(cleanStr));

            const peerRecord = this.peers.get(answerData.peerId);
            if (!peerRecord) {
                throw new Error(`[P2P Adapter] No matching pending peer found for ID: ${answerData.peerId}`);
            }

            await peerRecord.pc.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
            return { success: true, peerId: answerData.peerId };
        }

        _waitForIceGathering(pc, timeoutMs = 4000) {
            return new Promise((resolve) => {
                if (pc.iceGatheringState === 'complete') {
                    resolve();
                    return;
                }
                const timer = setTimeout(() => resolve(), timeoutMs);
                pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState === 'complete') {
                        clearTimeout(timer);
                        resolve();
                    }
                };
            });
        }

        // =========================================================================
        // PUBLIC BROKER SIGNALING (1-Click 6-Digit Room Codes)
        // =========================================================================

        static normalizeRoomCode(rawCode) {
            const clean = String(rawCode || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');
            if (clean.length === 8) {
                return `${clean.slice(0, 4)}-${clean.slice(4)}`;
            }
            return String(rawCode || '')
                .toUpperCase()
                .trim();
        }

        /**
         * Connects using a room code via the public signaling broker.
         */
        async connectWithRoomCode(roomCode) {
            this.isConnecting = true;
            const code = VttP2PAdapter.normalizeRoomCode(roomCode);

            return new Promise((resolve, reject) => {
                let settled = false;
                const timeout = setTimeout(() => {
                    this.isConnecting = false;
                    if (!settled) {
                        settled = true;
                        reject(new Error('P2P connection timed out (possible Symmetric NAT).'));
                    }
                }, 10000);

                // Check if PeerJS library is available in global scope
                if (typeof global.Peer !== 'undefined') {
                    if (this._peer) {
                        try {
                            this._peer.destroy();
                        } catch (_) {}
                    }
                    const peer = new global.Peer(this.isHost ? `dndforged-${code}` : undefined, {
                        host: PUBLIC_BROKER_HOST,
                        port: PUBLIC_BROKER_PORT,
                        path: PUBLIC_BROKER_PATH,
                        secure: true,
                        config: { iceServers: this.iceServers }
                    });
                    this._peer = peer;

                    if (this.isHost) {
                        peer.on('open', (id) => {
                            clearTimeout(timeout);
                            const wasReconnecting = settled;
                            settled = true;
                            this.connected = true;
                            this.isConnecting = false;
                            if (wasReconnecting) {
                                this._dispatch('io:reconnect');
                            } else {
                                this._dispatch('connect');
                                this._dispatch('p2p:host-ready', { roomCode: code, peerId: id });
                                resolve({ roomCode: code, peerId: id });
                            }
                        });

                        peer.on('connection', (conn) => {
                            this._wirePeerJsConnection(conn);
                        });
                    } else {
                        peer.on('open', () => {
                            const conn = peer.connect(`dndforged-${code}`, { reliable: true });
                            conn.on('open', () => {
                                clearTimeout(timeout);
                                settled = true;
                                this.connected = true;
                                this.isConnecting = false;
                                this.hostPeer = { conn, eventsChannel: conn };
                                this._dispatch('connect');
                                resolve({ success: true });
                            });
                            conn.on('data', (data) => this._handleIncomingData(data));
                            conn.on('close', () => {
                                this.connected = false;
                                this._dispatch('disconnect', 'peer closed');
                            });
                            conn.on('error', (err) => {
                                this.connected = false;
                                this._dispatch('disconnect', err?.message || 'peer connection error');
                            });
                        });
                    }

                    peer.on('disconnected', () => {
                        this._dispatch('io:reconnect_attempt', 1);
                        if (!peer.destroyed) {
                            try {
                                peer.reconnect();
                            } catch (_) {}
                        }
                    });

                    peer.on('error', (err) => {
                        clearTimeout(timeout);
                        this.isConnecting = false;
                        if (!settled) {
                            settled = true;
                            reject(err);
                        } else {
                            this._dispatch('io:reconnect_attempt', 1);
                        }
                    });
                } else {
                    clearTimeout(timeout);
                    reject(new Error('Signaling broker library not loaded. Please use Manual Invite Code mode.'));
                }
            });
        }

        _wirePeerJsConnection(conn) {
            const peerId = conn.peer;
            const peerRecord = { id: peerId, conn, eventsChannel: conn, status: 'connecting' };
            this.peers.set(peerId, peerRecord);

            conn.on('open', () => {
                peerRecord.status = 'connected';
                this._dispatch('peer:connected', { peerId });
            });
            conn.on('data', (data) => this._handleIncomingData(data, peerRecord));
            conn.on('close', () => {
                this.peers.delete(peerId);
                this._syncPeersToBackendBridge();
                this._dispatch('peer:disconnected', { peerId });
            });
            conn.on('error', (err) => {
                console.warn(`[P2P Adapter] Peer connection error (${peerId}):`, err);
                this.peers.delete(peerId);
                this._syncPeersToBackendBridge();
                this._dispatch('peer:disconnected', { peerId });
            });
        }

        // =========================================================================
        // UTILITY HELPERS
        // =========================================================================

        static encodeBase64(str) {
            if (typeof btoa === 'function') {
                return btoa(unescape(encodeURIComponent(str)));
            }
            return Buffer.from(str, 'utf8').toString('base64');
        }

        static decodeBase64(b64) {
            if (typeof atob === 'function') {
                return decodeURIComponent(escape(atob(b64)));
            }
            return Buffer.from(b64, 'base64').toString('utf8');
        }
    }

    // Export for browser window, globalThis, and CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { VttP2PAdapter, DEFAULT_ICE_SERVERS };
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.VttP2PAdapter = VttP2PAdapter;
        globalThis.DEFAULT_ICE_SERVERS = DEFAULT_ICE_SERVERS;
    }
    if (typeof window !== 'undefined') {
        window.VttP2PAdapter = VttP2PAdapter;
        window.DEFAULT_ICE_SERVERS = DEFAULT_ICE_SERVERS;
    }
})(typeof window !== 'undefined' ? window : globalThis);
