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
    const MAX_ASSET_CHUNKS = 2048;
    const MAX_ASSET_BYTES = 25 * 1024 * 1024;
    const SAFE_P2P_ASSET_MIMES = new Set([
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'video/webm',
        'video/mp4'
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
        'map:ping',
        'map:request_sync',
        'token:request_sync',
        'token:update',
        'token:add',
        'token:update_delta',
        'character:update',
        'character:create',
        'initiative:update',
        'dice:roll'
    ]);

    function loadConfiguredIceServers(explicitServers) {
        const servers = Array.isArray(explicitServers) && explicitServers.length
            ? [...explicitServers]
            : [...DEFAULT_ICE_SERVERS];
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
            this.iceServers = loadConfiguredIceServers(options.iceServers);

            this.id = 'p2p_' + Math.random().toString(36).substring(2, 10);
            this.connected = false;
            this.isConnecting = false;
            this._peer = null;
            this._reconnectTimer = null;

            // Event listeners map: eventName -> Set(callbacks)
            this._listeners = new Map();

            // Host mode: map of peerId -> { pc, conn, eventsChannel, assetsChannel, username, role, joined }
            this.peers = new Map();

            // Client mode: single host connection
            this.hostPeer = null;

            // Asset & RPC chunk reassembly caches
            this._assetTransfers = new Map();
            this._rpcTransfers = new Map();

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

        emit(event, ...args) {
            if (this.isHost && event === 'join') {
                this._handleHostSelfJoin(args[0]);
                return this;
            }

            // Priority 1: Mid-session campaign state sanitization for player peers
            if (this.isHost && (event === 'campaign:state-sync' || event === 'campaign:updated' || event === 'campaign:update')) {
                const rawCamp = args[0] || window.VTT?.campaignState;
                for (const [peerId, peer] of this.peers.entries()) {
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

            // Priority 1: Suppress GM-layer / hidden token movements and updates from player peers
            if (this.isHost && (event === 'token:update' || event === 'token:add')) {
                const tok = args[0]?.token;
                if (tok && (tok.layer === 'gm' || tok.isVisible === false || tok.hidden)) {
                    // Do not broadcast GM layer / hidden tokens to players
                    return this;
                }
            }

            if (this.isHost && event === 'tokens:update') {
                const tokensObj = args[0]?.tokens;
                if (tokensObj && typeof tokensObj === 'object') {
                    if (Array.isArray(tokensObj)) {
                        const safeTokens = tokensObj.filter(t => t && t.layer !== 'gm' && t.isVisible !== false && !t.hidden);
                        if (safeTokens.length === 0) return this;
                        args[0].tokens = safeTokens;
                    } else {
                        const safeTokens = {};
                        for (const k in tokensObj) {
                            const t = tokensObj[k];
                            if (t && t.layer !== 'gm' && t.isVisible !== false && !t.hidden) {
                                safeTokens[k] = t;
                            }
                        }
                        if (Object.keys(safeTokens).length === 0) return this;
                        args[0].tokens = safeTokens;
                    }
                }
            }

            if (this.isHost && event === 'token:update_delta') {
                const { mapId, tokenId, changes } = args[0] || {};
                const currentToken = window.VTT?.campaignState?.maps?.[mapId]?.tokens?.[tokenId];
                if (currentToken && (currentToken.layer === 'gm' || currentToken.isVisible === false || currentToken.hidden)) {
                    return this;
                }
            }

            const persistHostState = () => {
                if (
                    this.isHost &&
                    typeof global !== 'undefined' &&
                    typeof global.__persistStaticCampaign === 'function' &&
                    global.VTT?.campaignState
                ) {
                    global.__persistStaticCampaign(global.VTT.campaignState);
                }
            };

            const envelope = JSON.stringify({
                type: 'event',
                event,
                args,
                sender: this.username,
                role: this.role,
                timestamp: Date.now()
            });

            if (this.isHost) {
                persistHostState();
                // Host broadcast to all connected peer data channels
                this._broadcastToPeers(envelope);
            } else {
                // Client sends directly to host
                if (this.hostPeer) {
                    this._sendToPeer(this.hostPeer, envelope);
                } else {
                    console.warn(`[P2P Adapter] Cannot emit "${event}": Host peer not connected.`);
                }
            }
            return this;
        }

        async _handleHostSelfJoin(joinData = {}) {
            let campaignState = window.VTT?.campaignState || null;
            if (!campaignState && typeof fetch === 'function') {
                try {
                    const res = await fetch(`/api/campaigns/${encodeURIComponent(this.campaignId)}`);
                    if (res.ok) {
                        campaignState = await res.json();
                    }
                } catch (e) {
                    console.warn('[P2P Adapter] Could not fetch campaign from server:', e);
                }
            }

            setTimeout(() => {
                this._dispatch('joined', {
                    role: 'GM',
                    userRole: 'GM',
                    campaignState: campaignState || { id: this.campaignId, name: 'P2P Campaign' },
                    chatHistory: window.VTT?.chatHistory || []
                });
            }, 50);
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
                    const existing = global.VTT?.campaignState?.maps?.[payload.mapId]?.tokens?.[
                        payload.tokenId || payload.token?.id
                    ];
                    if (existing) {
                        const senderLower = String(senderPeer.username || '').toLowerCase();
                        const owner = String(existing.owner || existing.playerOwner || existing.ownerUsername || '').toLowerCase();
                        const players = Array.isArray(existing.players) ? existing.players.map((p) => String(p).toLowerCase()) : [];
                        if (owner !== senderLower && !players.includes(senderLower)) {
                            return false;
                        }
                    }
                }
            }
            return true;
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
                    if (!id || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_ASSET_CHUNKS) return;
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

                case 'event': {
                    const { event, args } = payload;

                    // Authoritative Host: Handle player 'join' request
                    if (this.isHost && event === 'join' && senderPeer) {
                        const joinData = args?.[0] || {};
                        const playerRole = 'Player';
                        const playerName = String(joinData.username || 'Player').trim() || 'Player';

                        // Allowlist & reserved GM name verification
                        const campState = window.VTT?.campaignState;
                        const gmName = String(campState?.gmUsername || this.username || '').trim().toLowerCase();
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

                        // Authoritative sanitization: GM secrets never sent to players
                        const sanitizedState = this._sanitizeCampaignStateForPlayer(campState, playerName);
                        const joinedPacket = JSON.stringify({
                            type: 'event',
                            event: 'joined',
                            args: [{
                                role: playerRole,
                                userRole: playerRole,
                                campaignState: sanitizedState,
                                chatHistory: (window.VTT?.chatHistory || []).slice(-50)
                            }]
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
                            console.warn(`[P2P Security] Ignored unauthenticated event "${event}" from peer ${senderPeer.id}`);
                            return;
                        }
                        if (!this._isPlayerAllowedEvent(event, args, senderPeer)) {
                            console.warn(`[P2P Security] Blocked unauthorized event "${event}" from P2P player "${senderPeer.username}"`);
                            return;
                        }
                    }

                    // Dispatch to local listeners
                    this._dispatch(event, ...(args || []));

                    // If Host, persist and forward/rebroadcast player-safe events to other peers (except sender)
                    if (this.isHost && senderPeer) {
                        if (typeof global.__persistStaticCampaign === 'function' && global.VTT?.campaignState) {
                            global.__persistStaticCampaign(global.VTT.campaignState);
                        }
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
                    const safeMime = String(mimeType || 'image/jpeg').toLowerCase().split(';')[0].trim();
                    if (
                        !id ||
                        !Number.isInteger(totalChunks) ||
                        totalChunks < 1 ||
                        totalChunks > MAX_ASSET_CHUNKS ||
                        (totalBytes && totalBytes > MAX_ASSET_BYTES) ||
                        !SAFE_P2P_ASSET_MIMES.has(safeMime)
                    ) {
                        console.warn(`[P2P Security] Rejected invalid asset transfer header "${id}" (${safeMime}, ${totalChunks} chunks)`);
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
                    m.notes = [];
                }
            }
            return clone;
        }

        _finalizeAssetTransfer(id, transfer) {
            try {
                if (transfer?.timeoutId) {
                    clearTimeout(transfer.timeoutId);
                }
                // Reconstruct full binary or base64 blob
                const fullBase64 = transfer.chunks.join('');
                const dataUrl = `data:${transfer.mimeType};base64,${fullBase64}`;
                this._assetTransfers.delete(id);

                // Notify asset consumers (canvas / cache)
                this._dispatch('asset:received', {
                    id,
                    url: dataUrl,
                    meta: transfer.meta
                });
            } catch (err) {
                console.error(`[P2P Adapter] Failed to finalize asset ${id}:`, err);
            }
        }

        _sendRawPacket(peer, text) {
            if (peer.conn?.open) {
                peer.conn.send(text);
            } else if (peer.eventsChannel?.readyState === 'open') {
                peer.eventsChannel.send(text);
            }
        }

        _sendToPeer(peer, message) {
            try {
                const str = typeof message === 'string' ? message : JSON.stringify(message);
                if (str.length <= CHUNK_SIZE) {
                    this._sendRawPacket(peer, str);
                    return;
                }
                const rpcId = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const totalChunks = Math.ceil(str.length / CHUNK_SIZE);
                this._sendRawPacket(peer, JSON.stringify({ type: 'rpc-start', id: rpcId, totalChunks }));
                for (let i = 0; i < totalChunks; i++) {
                    this._sendRawPacket(
                        peer,
                        JSON.stringify({
                            type: 'rpc-chunk',
                            id: rpcId,
                            index: i,
                            data: str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                        })
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

            // 1. Send start header
            const startPacket = JSON.stringify({
                type: 'asset-start',
                id: assetId,
                totalChunks,
                totalBytes: totalLen,
                mimeType,
                meta
            });
            this._broadcastToPeers(startPacket);

            // 2. Stream chunks sequentially
            for (let i = 0; i < totalChunks; i++) {
                const chunkSlice = base64Data.substr(i * CHUNK_SIZE, CHUNK_SIZE);
                const chunkPacket = JSON.stringify({
                    type: 'asset-chunk',
                    id: assetId,
                    index: i,
                    data: chunkSlice
                });
                this._broadcastToPeers(chunkPacket);

                // Small pause every 10 chunks to avoid saturating RTCDataChannel buffer
                if (i % 10 === 0) {
                    await new Promise(r => setTimeout(r, 8));
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
                this._dispatch('peer:disconnected', { peerId });
            };
            pc.onconnectionstatechange = () => {
                if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
                    this.peers.delete(peerId);
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
                if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
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

        /**
         * Connects using a 6-digit room code via the public signaling broker.
         */
        async connectWithRoomCode(roomCode) {
            this.isConnecting = true;
            const code = String(roomCode).toUpperCase().trim();

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.isConnecting = false;
                    reject(new Error('P2P connection timed out (possible Symmetric NAT).'));
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
                            this.connected = true;
                            this.isConnecting = false;
                            this._dispatch('connect');
                            this._dispatch('p2p:host-ready', { roomCode: code, peerId: id });
                            resolve({ roomCode: code, peerId: id });
                        });

                        peer.on('connection', (conn) => {
                            this._wirePeerJsConnection(conn);
                        });
                    } else {
                        peer.on('open', () => {
                            const conn = peer.connect(`dndforged-${code}`, { reliable: true });
                            conn.on('open', () => {
                                clearTimeout(timeout);
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
                        reject(err);
                    });
                } else {
                    // Fallback to manual mode if no broker library loaded
                    clearTimeout(timeout);
                    reject(new Error('Signaling broker library not loaded. Please use Manual Invite Code mode.'));
                }
            });
        }

        _wirePeerJsConnection(conn) {
            const peerId = conn.peer;
            const peerRecord = { id: peerId, conn, eventsChannel: conn, status: 'connected' };
            this.peers.set(peerId, peerRecord);

            conn.on('data', (data) => this._handleIncomingData(data, peerRecord));
            conn.on('close', () => {
                this.peers.delete(peerId);
                this._dispatch('peer:disconnected', { peerId });
            });

            this._dispatch('peer:connected', { peerId });
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
