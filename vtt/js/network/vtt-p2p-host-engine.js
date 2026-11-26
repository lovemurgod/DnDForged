/**
 * vtt-p2p-host-engine.js
 * Authoritative P2P Host state mutation and Socket.IO event translation engine.
 * Mirrors server/socket.js behavior in-browser so Direct P2P hosts process
 * chat, rolls, tokens, maps, walls, lighting, initiative, pause/X-Card, and
 * character updates identically to the Express Socket.IO server.
 */
(function (global) {
    'use strict';

    const PLAYER_FORBIDDEN_TOKEN_FIELDS = new Set([
        '__proto__',
        'constructor',
        'prototype',
        'owner',
        'playerOwner',
        'ownerUsername',
        'players',
        'assignedPlayers',
        'characterId',
        'sourceCharacterId',
        'layer',
        'hidden',
        'isVisible',
        'gmOnly',
        'gmNotes'
    ]);

    const MAP_PROPERTY_EVENTS = {
        'grid:update': { prop: 'grid', outEvent: 'grid:updated', key: 'grid' },
        'map:update': { prop: 'mapImage', outEvent: 'map:updated', key: 'mapImage' },
        'walls:update': { prop: 'walls', outEvent: 'walls:updated', key: 'walls' },
        'lights:update': { prop: 'lights', outEvent: 'lights:updated', key: 'lights' },
        'notes:update': { prop: 'notes', outEvent: 'notes:updated', key: 'notes', playerFilter: 'notes' },
        'traps:update': { prop: 'traps', outEvent: 'traps:updated', key: 'traps', playerFilter: 'traps' },
        'portals:update': { prop: 'portals', outEvent: 'portals:updated', key: 'portals', playerFilter: 'portals' },
        'shapes:update': { prop: 'shapes', outEvent: 'shapes:updated', key: 'shapes', allowPlayerOwned: true },
        'drawings:update': { prop: 'drawings', outEvent: 'drawings:updated', key: 'drawings', allowPlayerOwned: true }
    };

    function sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeObject);
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            out[k] = typeof v === 'object' && v !== null ? sanitizeObject(v) : v;
        }
        return out;
    }

    function stripTags(val) {
        if (val === undefined || val === null) return val;
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        return String(val).replace(/<[^>]*>/g, '');
    }

    function stripTagsDeep(val) {
        if (val === undefined || val === null || typeof val === 'number' || typeof val === 'boolean') return val;
        if (typeof val === 'string') return stripTags(val);
        if (Array.isArray(val)) return val.map(stripTagsDeep);
        if (typeof val === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(val)) {
                if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
                out[k] = stripTagsDeep(v);
            }
            return out;
        }
        return val;
    }

    function getPlayerMapOverride(camp, username) {
        if (!camp?.playerMapOverrides || !username) return null;
        if (camp.playerMapOverrides[username]) return camp.playerMapOverrides[username];
        const uLower = String(username).toLowerCase();
        for (const k in camp.playerMapOverrides) {
            if (k.toLowerCase() === uLower) return camp.playerMapOverrides[k];
        }
        return null;
    }

    function resolveTargetMapId(camp, explicitMapId, senderRole, senderUsername) {
        if (explicitMapId && camp?.maps?.[explicitMapId]) return explicitMapId;
        if (senderRole === 'GM') {
            return camp?.activeGMMapId || camp?.activeMapId || Object.keys(camp?.maps || {})[0];
        }
        return getPlayerMapOverride(camp, senderUsername) || camp?.activeMapId || Object.keys(camp?.maps || {})[0];
    }

    function isCharacterControlled(char, senderRole, senderUsername) {
        if (!char) return false;
        if (senderRole === 'GM') return true;
        if (!senderUsername) return false;
        const uLower = String(senderUsername).toLowerCase();
        const matchUser = (val) => typeof val === 'string' && (val === '*' || val.toLowerCase() === uLower);
        const matchArr = (arr) => Array.isArray(arr) && arr.some(matchUser);
        return (
            matchUser(char.owner) ||
            matchUser(char.ownerUsername) ||
            matchArr(char.assignedPlayers) ||
            matchArr(char.players)
        );
    }

    function isTokenControlled(token, camp, senderRole, senderUsername) {
        if (!token) return false;
        if (senderRole === 'GM') return true;
        if (!senderUsername) return false;
        const uLower = String(senderUsername).toLowerCase();
        const matchUser = (val) => typeof val === 'string' && (val === '*' || val.toLowerCase() === uLower);
        const matchArr = (arr) => Array.isArray(arr) && arr.some(matchUser);
        if (matchUser(token.owner) || matchUser(token.playerOwner) || matchUser(token.ownerUsername)) return true;
        if (matchArr(token.players) || matchArr(token.assignedPlayers)) return true;
        const charId = token.characterId || token.sourceCharacterId;
        if (charId && camp?.characters?.[charId]) {
            return isCharacterControlled(camp.characters[charId], senderRole, senderUsername);
        }
        return false;
    }

    function isTokenVisibleToPlayers(tok) {
        return Boolean(tok && tok.layer !== 'gm' && tok.isVisible !== false && !tok.hidden);
    }

    function filterPlayerTokenFields(payload, existingToken) {
        const clean = sanitizeObject(payload || {});
        for (const k of PLAYER_FORBIDDEN_TOKEN_FIELDS) delete clean[k];
        if (existingToken) {
            for (const k of PLAYER_FORBIDDEN_TOKEN_FIELDS) {
                if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && existingToken[k] !== undefined) {
                    clean[k] = existingToken[k];
                }
            }
        }
        return clean;
    }

    function mergePlayerOwnedMapDict(existingDict, incomingDict, username) {
        const existing = existingDict || {};
        const merged = { ...existing };
        const incoming = incomingDict || {};
        const uLower = String(username || '').toLowerCase();
        for (const id in existing) {
            if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
            const item = existing[id];
            if (item?.ownerUsername && item.ownerUsername.toLowerCase() === uLower && !incoming[id]) {
                delete merged[id];
            }
        }
        for (const id in incoming) {
            if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
            const ex = existing[id];
            if (ex && (!ex.ownerUsername || ex.ownerUsername.toLowerCase() !== uLower)) continue;
            merged[id] = { ...sanitizeObject(incoming[id]), ownerUsername: username };
        }
        return merged;
    }

    function sendPacket(adapter, peer, event, args, senderName, senderRole) {
        const env = JSON.stringify({
            type: 'event',
            event,
            args,
            sender: senderName,
            role: senderRole,
            timestamp: Date.now()
        });
        adapter._sendToPeer(peer, env);
    }

    function emitToAll(
        adapter,
        event,
        args,
        { excludePeerId = null, excludeHost = false, senderName, senderRole } = {}
    ) {
        if (!excludeHost) {
            adapter._dispatch(event, ...args);
        }
        for (const [peerId, peer] of adapter.peers.entries()) {
            if (!peer.joined || peerId === excludePeerId) continue;
            sendPacket(adapter, peer, event, args, senderName || adapter.username, senderRole || adapter.role);
        }
    }

    function emitCampaignSyncToAll(adapter, camp) {
        const rawCamp = camp || global.VTT?.campaignState;
        if (!rawCamp) return;
        const hostClone = JSON.parse(JSON.stringify(rawCamp));
        if (!hostClone.mapOrder && hostClone.maps) hostClone.mapOrder = Object.keys(hostClone.maps);
        if (!hostClone.mapFolders) hostClone.mapFolders = [];
        hostClone.onlinePlayers = Array.from(adapter.peers.values())
            .filter((p) => p.joined && p.role !== 'GM' && p.username)
            .map((p) => p.username);

        adapter._dispatch('campaign:state-sync', hostClone);
        for (const [, peer] of adapter.peers.entries()) {
            if (!peer.joined) continue;
            const sanitized = adapter._sanitizeCampaignStateForPlayer(hostClone, peer.username || 'Player');
            sendPacket(adapter, peer, 'campaign:state-sync', [sanitized], adapter.username, 'GM');
        }
    }

    function filterMapCollectionForPlayer(propKey, items, username) {
        if (!Array.isArray(items)) return items;
        if (propKey === 'traps') return items.filter((t) => t && !t.hidden && !t.isSecret && t.layer !== 'gm');
        if (propKey === 'notes') return items.filter((n) => n && (n.isPublic || n.author === username));
        if (propKey === 'portals') return items.filter((p) => p && !p.isSecret);
        return items;
    }

    const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const peerRateWindows = new Map();

    function checkPeerRateLimit(senderPeer) {
        if (!senderPeer) return true;
        const key = senderPeer.id || senderPeer.username || 'peer';
        const now = Date.now();
        let win = peerRateWindows.get(key);
        if (!win || now - win.start > 2000) {
            win = { start: now, count: 0 };
            peerRateWindows.set(key, win);
        }
        win.count++;
        return win.count <= 80;
    }

    /**
     * Processes a Socket.IO-style event on an authoritative P2P Host adapter.
     * Returns true if the event was handled by the host engine.
     */
    function processEvent({ adapter, event, args = [], senderPeer = null }) {
        const senderRole = senderPeer ? senderPeer.role || 'Player' : 'GM';
        const senderName = senderPeer ? senderPeer.username || 'Player' : adapter.username || 'Game Master';
        const originId = senderPeer ? senderPeer.id : adapter.id;
        if (senderRole !== 'GM' && !checkPeerRateLimit(senderPeer)) return true;
        const camp =
            global.VTT?.campaignState ||
            (global.VTT ? (global.VTT.campaignState = { id: adapter.campaignId, maps: {}, characters: {} }) : null);
        const data = args[0] && typeof args[0] === 'object' ? args[0] : args[0];
        const persist = () => adapter._persistHostCampaignState?.(camp);

        // 1. Chat & Whisper
        if (event === 'chat:msg') {
            const safeMsg = data && typeof data === 'object' ? sanitizeObject(data) : {};
            const chatMsg = {
                id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                username: senderName,
                role: senderRole,
                text: safeMsg.text !== undefined ? stripTags(safeMsg.text) : safeMsg.text,
                html: null,
                roll: safeMsg.roll ? stripTagsDeep(safeMsg.roll) : null,
                abilityCard: safeMsg.abilityCard ? stripTagsDeep(safeMsg.abilityCard) : null,
                macroCard: safeMsg.macroCard ? stripTagsDeep(safeMsg.macroCard) : null,
                itemCard: safeMsg.itemCard ? stripTagsDeep(safeMsg.itemCard) : null,
                saveResolveCard: safeMsg.saveResolveCard ? stripTagsDeep(safeMsg.saveResolveCard) : null,
                massAttackCard: safeMsg.massAttackCard ? stripTagsDeep(safeMsg.massAttackCard) : null,
                rollTableCard: safeMsg.rollTableCard ? stripTagsDeep(safeMsg.rollTableCard) : null,
                cardDrawCard: safeMsg.cardDrawCard ? stripTagsDeep(safeMsg.cardDrawCard) : null,
                timestamp: Date.now(),
                hidden: false,
                whisperToGM: Boolean(safeMsg.whisperToGM),
                whisperTo: safeMsg.whisperTo ? stripTags(safeMsg.whisperTo) : null
            };
            if (global.VTT) {
                if (!Array.isArray(global.VTT.chatHistory)) global.VTT.chatHistory = [];
                global.VTT.chatHistory.push(chatMsg);
                if (global.VTT.chatHistory.length > 500) global.VTT.chatHistory.shift();
            }
            if (chatMsg.whisperToGM) {
                adapter._dispatch('chat:msg', chatMsg);
                if (senderPeer) sendPacket(adapter, senderPeer, 'chat:msg', [chatMsg], senderName, senderRole);
            } else if (chatMsg.whisperTo) {
                const targetLower = String(chatMsg.whisperTo).toLowerCase().trim();
                adapter._dispatch('chat:msg', chatMsg);
                for (const [, peer] of adapter.peers.entries()) {
                    if (!peer.joined) continue;
                    const pLower = String(peer.username || '')
                        .toLowerCase()
                        .trim();
                    if (peer === senderPeer || pLower === targetLower) {
                        sendPacket(adapter, peer, 'chat:msg', [chatMsg], senderName, senderRole);
                    }
                }
            } else {
                emitToAll(adapter, 'chat:msg', [chatMsg], { senderName, senderRole });
            }
            persist();
            return true;
        }

        if (event === 'chat:whisper') {
            const safeMsg = data && typeof data === 'object' ? sanitizeObject(data) : {};
            const whisperMsg = {
                username: senderName,
                role: senderRole,
                text: safeMsg.text !== undefined ? stripTags(safeMsg.text) : safeMsg.text,
                roll: safeMsg.roll ? stripTagsDeep(safeMsg.roll) : null,
                macroCard: safeMsg.macroCard ? stripTagsDeep(safeMsg.macroCard) : null,
                spellCard: safeMsg.spellCard ? stripTagsDeep(safeMsg.spellCard) : null,
                abilityCard: safeMsg.abilityCard ? stripTagsDeep(safeMsg.abilityCard) : null,
                itemCard: safeMsg.itemCard ? stripTagsDeep(safeMsg.itemCard) : null,
                saveResolveCard: safeMsg.saveResolveCard ? stripTagsDeep(safeMsg.saveResolveCard) : null,
                massAttackCard: safeMsg.massAttackCard ? stripTagsDeep(safeMsg.massAttackCard) : null,
                timestamp: Date.now()
            };
            if (senderPeer) sendPacket(adapter, senderPeer, 'chat:whisper', [whisperMsg], senderName, senderRole);
            else adapter._dispatch('chat:whisper', whisperMsg);
            return true;
        }

        if (event === 'chat:delete') {
            if (senderRole !== 'GM') return true;
            if (Array.isArray(global.VTT?.chatHistory)) {
                global.VTT.chatHistory = global.VTT.chatHistory.filter((m) => m.id !== data);
                persist();
            }
            emitToAll(adapter, 'chat:deleted', [{ id: data }], { senderName, senderRole });
            return true;
        }

        if (event === 'chat:hide') {
            if (senderRole !== 'GM') return true;
            const msg = Array.isArray(global.VTT?.chatHistory)
                ? global.VTT.chatHistory.find((m) => m.id === data)
                : null;
            if (msg) {
                msg.hidden = !msg.hidden;
                persist();
                emitToAll(adapter, 'chat:hidden_toggled', [{ id: data, hidden: msg.hidden }], {
                    senderName,
                    senderRole
                });
            }
            return true;
        }

        if (
            event === 'chat:save_resolved' ||
            event === 'chat:mass_attack_resolved' ||
            event === 'chat:macro_resolved'
        ) {
            if (senderRole !== 'GM' || !data?.id) return true;
            if (Array.isArray(global.VTT?.chatHistory)) {
                const msg = global.VTT.chatHistory.find((m) => m.id === data.id);
                if (msg) {
                    if (event === 'chat:save_resolved' && msg.saveResolveCard) {
                        msg.saveResolveCard.resolved = true;
                        Object.assign(msg.saveResolveCard, stripTagsDeep(data));
                    } else if (event === 'chat:mass_attack_resolved' && msg.massAttackCard) {
                        msg.massAttackCard.resolved = true;
                        Object.assign(msg.massAttackCard, stripTagsDeep(data));
                    } else if (event === 'chat:macro_resolved' && msg.macroCard) {
                        msg.macroCard.resolved = true;
                        Object.assign(msg.macroCard, stripTagsDeep(data));
                    }
                    persist();
                }
            }
            emitToAll(adapter, event, [data], { senderName, senderRole });
            return true;
        }

        // 2. Simple GM-only campaign/broadcast syncs
        if (event === 'allowlist:update' && senderRole === 'GM' && camp) {
            camp.allowedUsers = Array.isArray(data?.allowedUsers) ? data.allowedUsers : [];
            persist();
            emitToAll(adapter, 'allowlist:updated', [{ allowedUsers: camp.allowedUsers }], { senderName, senderRole });
            return true;
        }
        if (event === 'handouts:update' && senderRole === 'GM' && camp) {
            camp.handouts = data?.handouts;
            persist();
            emitToAll(adapter, 'handouts:updated', [{ handouts: camp.handouts }], { senderName, senderRole });
            return true;
        }
        if (event === 'handouts:force_show' && senderRole === 'GM') {
            emitToAll(adapter, 'handouts:force_show', [data], { senderName, senderRole });
            return true;
        }
        if (event === 'splash:show' && senderRole === 'GM') {
            emitToAll(adapter, 'splash:show', [data], { senderName, senderRole });
            return true;
        }
        if (event === 'settings:update' && senderRole === 'GM' && camp) {
            camp.settings = data?.settings;
            persist();
            emitToAll(adapter, 'settings:updated', [{ settings: camp.settings }], { senderName, senderRole });
            return true;
        }
        if (event === 'rolltables:update' && senderRole === 'GM' && camp) {
            if (!camp.rollTables) camp.rollTables = { tables: [], assetTables: [], decks: [] };
            if (data?.rollTables) camp.rollTables = data.rollTables;
            else {
                if (data?.tables) camp.rollTables.tables = data.tables;
                if (data?.assetTables) camp.rollTables.assetTables = data.assetTables;
                if (data?.decks) camp.rollTables.decks = data.decks;
            }
            persist();
            emitToAll(adapter, 'rolltables:updated', [{ rollTables: camp.rollTables }], { senderName, senderRole });
            return true;
        }
        if (event === 'deck:state_update' && camp && data?.deckId) {
            const deck = (camp.rollTables?.decks || []).find((d) => d.id === data.deckId);
            if (!deck || (senderRole !== 'GM' && !deck.allowPlayers)) return true;
            if (data.state) {
                deck.state = data.state;
                persist();
                emitToAll(adapter, 'deck:state_updated', [{ deckId: data.deckId, state: data.state }], {
                    senderName,
                    senderRole
                });
            }
            return true;
        }

        // 3. Pause / X-Card
        if (event === 'game:set_pause' && camp) {
            const requestedPause = Boolean(data?.paused);
            if (!requestedPause && senderRole !== 'GM') return true;
            const source = senderRole === 'GM' ? data?.source || 'gm' : 'xcard';
            camp.isPaused = requestedPause;
            camp.pauseState = {
                isPaused: requestedPause,
                source: requestedPause ? source : null,
                by: senderName,
                at: Date.now()
            };
            persist();
            emitToAll(adapter, 'game:pause_state', [camp.pauseState], { senderName, senderRole });
            return true;
        }

        // 4. Tokens
        if (event === 'token:add' && camp) {
            if (senderRole !== 'GM' && camp.isPaused) return true;
            const mapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            if (!targetMap || !data?.tokenId || RESERVED_KEYS.has(data.tokenId)) return true;
            if (!targetMap.tokens) targetMap.tokens = {};
            if (senderRole !== 'GM') {
                const allowedMapId = getPlayerMapOverride(camp, senderName) || camp.activeMapId;
                if (allowedMapId && mapId !== allowedMapId) return true;
                if (targetMap.tokens[data.tokenId]) return true;
                if (
                    !isTokenVisibleToPlayers(data.token) ||
                    !isTokenControlled(data.token, camp, senderRole, senderName)
                ) {
                    return true;
                }
                if (data.token?.characterId) {
                    const ch = camp.characters?.[data.token.characterId];
                    if (ch && !isCharacterControlled(ch, senderRole, senderName)) return true;
                }
            }
            const cloned = sanitizeObject(JSON.parse(JSON.stringify(data.token || {})));
            if (!cloned.id) cloned.id = data.tokenId;
            delete cloned._animReq;
            targetMap.tokens[data.tokenId] = cloned;
            persist();

            const visible = isTokenVisibleToPlayers(cloned);
            adapter._dispatch('token:added', { mapId, tokenId: data.tokenId, token: cloned, origin: originId });
            if (visible) {
                for (const [, peer] of adapter.peers.entries()) {
                    if (!peer.joined) continue;
                    sendPacket(
                        adapter,
                        peer,
                        'token:added',
                        [{ mapId, tokenId: data.tokenId, token: cloned, origin: originId }],
                        senderName,
                        senderRole
                    );
                }
            }
            return true;
        }

        if ((event === 'token:update' || event === 'tokens:update') && camp) {
            if (senderRole !== 'GM' && camp.isPaused) return true;
            const mapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            if (!targetMap) return true;
            if (!targetMap.tokens) targetMap.tokens = {};

            if (data?.token?.id && !data?.tokens) {
                const tokId = data.token.id;
                const oldTok = targetMap.tokens[tokId];
                if (senderRole !== 'GM' && (!oldTok || !isTokenControlled(oldTok, camp, senderRole, senderName))) {
                    return true;
                }
                const wasVis = isTokenVisibleToPlayers(oldTok);
                const rawCloned = JSON.parse(JSON.stringify(data.token));
                const cloned =
                    senderRole === 'GM' ? sanitizeObject(rawCloned) : filterPlayerTokenFields(rawCloned, oldTok);
                if (!cloned.id) cloned.id = tokId;
                delete cloned._animReq;
                targetMap.tokens[tokId] = cloned;
                const nowVis = isTokenVisibleToPlayers(cloned);
                persist();

                adapter._dispatch('token:updated_delta', { mapId, tokenId: tokId, changes: cloned, origin: originId });
                for (const [, peer] of adapter.peers.entries()) {
                    if (!peer.joined) continue;
                    if (!wasVis && nowVis) {
                        sendPacket(
                            adapter,
                            peer,
                            'token:added',
                            [{ mapId, tokenId: tokId, token: cloned, origin: originId }],
                            senderName,
                            senderRole
                        );
                    } else if (wasVis && !nowVis) {
                        sendPacket(
                            adapter,
                            peer,
                            'token:deleted',
                            [{ mapId, tokenId: tokId, origin: originId }],
                            senderName,
                            senderRole
                        );
                    } else if (nowVis) {
                        sendPacket(
                            adapter,
                            peer,
                            'token:updated_delta',
                            [{ mapId, tokenId: tokId, changes: cloned, origin: originId }],
                            senderName,
                            senderRole
                        );
                    }
                }
                return true;
            }

            if (data?.tokens && typeof data.tokens === 'object') {
                const incoming = sanitizeObject(JSON.parse(JSON.stringify(data.tokens)));
                for (const id in incoming) {
                    const oldTok = targetMap.tokens[id];
                    if (senderRole !== 'GM') {
                        if (!oldTok || !isTokenControlled(oldTok, camp, senderRole, senderName)) continue;
                        incoming[id] = filterPlayerTokenFields(incoming[id], oldTok);
                    }
                    if (incoming[id]?._animReq) delete incoming[id]._animReq;
                    targetMap.tokens[id] = incoming[id];
                }
                persist();
                const fullTokens = targetMap.tokens;
                const safeTokens = {};
                for (const id in fullTokens) {
                    if (isTokenVisibleToPlayers(fullTokens[id])) safeTokens[id] = fullTokens[id];
                }
                adapter._dispatch('token:updated', { mapId, tokens: fullTokens, origin: originId });
                for (const [, peer] of adapter.peers.entries()) {
                    if (!peer.joined) continue;
                    sendPacket(
                        adapter,
                        peer,
                        'token:updated',
                        [{ mapId, tokens: safeTokens, origin: originId }],
                        senderName,
                        senderRole
                    );
                }
            }
            return true;
        }

        if (event === 'token:update_delta' && camp) {
            if (senderRole !== 'GM' && camp.isPaused) return true;
            if (!data?.tokenId || RESERVED_KEYS.has(data.tokenId)) return true;
            const mapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            const existingToken = targetMap?.tokens?.[data?.tokenId];
            if (!existingToken || !data?.changes) return true;
            if (senderRole !== 'GM' && !isTokenControlled(existingToken, camp, senderRole, senderName)) return true;

            const applied =
                senderRole === 'GM'
                    ? sanitizeObject(data.changes)
                    : filterPlayerTokenFields(data.changes, existingToken);
            const wasVis = isTokenVisibleToPlayers(existingToken);
            Object.assign(existingToken, applied);
            if (!existingToken.id) existingToken.id = data.tokenId;
            delete existingToken._animReq;
            const nowVis = isTokenVisibleToPlayers(existingToken);
            const snapshot = JSON.parse(JSON.stringify(existingToken));
            persist();

            adapter._dispatch('token:updated_delta', {
                mapId,
                tokenId: data.tokenId,
                changes: applied,
                origin: originId
            });
            for (const [, peer] of adapter.peers.entries()) {
                if (!peer.joined) continue;
                if (!wasVis && nowVis) {
                    sendPacket(
                        adapter,
                        peer,
                        'token:added',
                        [{ mapId, tokenId: data.tokenId, token: snapshot, origin: originId }],
                        senderName,
                        senderRole
                    );
                } else if (wasVis && !nowVis) {
                    sendPacket(
                        adapter,
                        peer,
                        'token:deleted',
                        [{ mapId, tokenId: data.tokenId, origin: originId }],
                        senderName,
                        senderRole
                    );
                } else if (nowVis) {
                    sendPacket(
                        adapter,
                        peer,
                        'token:updated_delta',
                        [{ mapId, tokenId: data.tokenId, changes: applied, origin: originId }],
                        senderName,
                        senderRole
                    );
                }
            }
            return true;
        }

        if (event === 'token:delete' && camp) {
            if (senderRole !== 'GM' && camp.isPaused) return true;
            const mapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            const existingToken = targetMap?.tokens?.[data?.tokenId];
            if (!existingToken) return true;
            if (senderRole !== 'GM' && !isTokenControlled(existingToken, camp, senderRole, senderName)) return true;
            delete targetMap.tokens[data.tokenId];
            persist();
            emitToAll(adapter, 'token:deleted', [{ mapId, tokenId: data.tokenId, origin: originId }], {
                senderName,
                senderRole
            });
            return true;
        }

        // 5. Uniform Map Property Updates (grid, walls, lights, notes, traps, portals, shapes, drawings, mapImage)
        if (event === 'maptools:update' && senderRole === 'GM' && camp && data) {
            const mapId = resolveTargetMapId(camp, data.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            if (!targetMap) return true;
            if (Array.isArray(data.traps)) targetMap.traps = data.traps;
            if (Array.isArray(data.portals)) targetMap.portals = data.portals;
            persist();
            if (Array.isArray(data.traps)) {
                adapter._dispatch('traps:updated', { mapId, traps: targetMap.traps, origin: originId });
                for (const [, peer] of adapter.peers.entries()) {
                    if (!peer.joined) continue;
                    sendPacket(
                        adapter,
                        peer,
                        'traps:updated',
                        [
                            {
                                mapId,
                                traps: filterMapCollectionForPlayer('traps', targetMap.traps, peer.username),
                                origin: originId
                            }
                        ],
                        senderName,
                        senderRole
                    );
                }
            }
            if (Array.isArray(data.portals)) {
                adapter._dispatch('portals:updated', { mapId, portals: targetMap.portals, origin: originId });
                for (const [, peer] of adapter.peers.entries()) {
                    if (!peer.joined) continue;
                    sendPacket(
                        adapter,
                        peer,
                        'portals:updated',
                        [
                            {
                                mapId,
                                portals: filterMapCollectionForPlayer('portals', targetMap.portals, peer.username),
                                origin: originId
                            }
                        ],
                        senderName,
                        senderRole
                    );
                }
            }
            return true;
        }
        if (MAP_PROPERTY_EVENTS[event] && camp) {
            const spec = MAP_PROPERTY_EVENTS[event];
            if (senderRole !== 'GM' && !spec.allowPlayerOwned) return true;
            const mapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            if (!targetMap) return true;
            let nextVal = data?.[spec.key];
            if (senderRole !== 'GM' && spec.allowPlayerOwned) {
                nextVal = mergePlayerOwnedMapDict(targetMap[spec.prop], nextVal, senderName);
            }
            targetMap[spec.prop] = nextVal;
            persist();

            adapter._dispatch(spec.outEvent, { mapId, [spec.key]: nextVal, origin: originId });
            for (const [, peer] of adapter.peers.entries()) {
                if (!peer.joined) continue;
                const peerVal = spec.playerFilter
                    ? filterMapCollectionForPlayer(spec.prop, nextVal, peer.username)
                    : nextVal;
                sendPacket(
                    adapter,
                    peer,
                    spec.outEvent,
                    [{ mapId, [spec.key]: peerVal, origin: originId }],
                    senderName,
                    senderRole
                );
            }
            return true;
        }

        if (event === 'door:toggle' && camp && data) {
            const mapId = resolveTargetMapId(camp, data.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            if (!targetMap || !Array.isArray(targetMap.walls)) return true;
            let targetWall = data.wallId ? targetMap.walls.find((w) => w && w.id === data.wallId) : null;
            if (!targetWall && typeof data.wallIdx === 'number') targetWall = targetMap.walls[data.wallIdx];
            if (!targetWall || (targetWall.type !== 'door' && targetWall.type !== 'window')) return true;
            if (targetWall.isLocked && senderRole !== 'GM') return true;
            targetWall.isOpen = !targetWall.isOpen;
            persist();
            emitToAll(adapter, 'walls:updated', [{ mapId, walls: targetMap.walls }], { senderName, senderRole });
            return true;
        }

        if (event === 'trap:trigger' && camp && data) {
            const mapId = resolveTargetMapId(camp, data.mapId, senderRole, senderName);
            const targetMap = camp.maps?.[mapId];
            const tr = Array.isArray(targetMap?.traps) ? targetMap.traps.find((t) => t.id === data.trapId) : null;
            if (!tr) return true;
            const trigTok = data.tokenId ? targetMap.tokens?.[data.tokenId] : null;
            if (senderRole !== 'GM' && (!trigTok || !isTokenControlled(trigTok, camp, senderRole, senderName)))
                return true;
            tr.isRevealed = true;
            if (!tr.repeatTrigger) tr.isSpent = true;
            persist();
            for (const [, peer] of adapter.peers.entries()) {
                if (!peer.joined) continue;
                sendPacket(
                    adapter,
                    peer,
                    'traps:updated',
                    [{ mapId, traps: filterMapCollectionForPlayer('traps', targetMap.traps, peer.username) }],
                    senderName,
                    senderRole
                );
            }
            adapter._dispatch('traps:updated', { mapId, traps: targetMap.traps });
            emitToAll(
                adapter,
                'trap:triggered',
                [
                    {
                        ...data,
                        trapName: tr.name || 'A concealed trap',
                        tokenName: trigTok?.name || data.tokenName || 'A creature',
                        saveAbility: tr.saveAbility || data.saveAbility || 'DEX',
                        saveDc: tr.saveDc || data.saveDc || 15,
                        damage: tr.damage || data.damage || '',
                        damageType: tr.damageType || data.damageType || 'piercing',
                        flavor: tr.flavor || data.flavor
                    }
                ],
                { senderName, senderRole }
            );
            return true;
        }

        if ((event === 'portal:teleport_inter_map' || event === 'portal:teleport_inter_map_batch') && camp && data) {
            const { sourceMapId, targetMapId, targetPortalId } = data;
            const sMap = camp.maps?.[sourceMapId];
            const tMap = camp.maps?.[targetMapId];
            if (!sMap || !tMap || !sMap.tokens) return true;
            if (!tMap.tokens) tMap.tokens = {};
            if (!camp.playerMapOverrides) camp.playerMapOverrides = {};

            const transitions =
                event === 'portal:teleport_inter_map_batch'
                    ? Array.isArray(data.transitions)
                        ? data.transitions
                        : []
                    : [data];
            const moved = [];
            for (const tr of transitions) {
                const tok = sMap.tokens[tr.tokenId];
                if (!tok) continue;
                let destX = Number.isFinite(Number(tr.targetX)) ? Number(tr.targetX) : tok.x || 0;
                let destY = Number.isFinite(Number(tr.targetY)) ? Number(tr.targetY) : tok.y || 0;
                if (senderRole !== 'GM') {
                    if (camp.isPaused) continue;
                    if (!isTokenControlled(tok, camp, senderRole, senderName)) continue;
                    if (!tr.sourcePortalId) continue;
                    const sPortal = Array.isArray(sMap.portals)
                        ? sMap.portals.find((p) => p && p.id === tr.sourcePortalId)
                        : null;
                    if (!sPortal || sPortal.isSecret || sPortal.isLocked) continue;
                    if (!sPortal.targetMapId || sPortal.targetMapId !== targetMapId) continue;
                    const cx = (tok.x || 0) + (tok.w || 0) / 2;
                    const cy = (tok.y || 0) + (tok.h || 0) / 2;
                    const g = sPortal.geom || sPortal;
                    let dist = Infinity;
                    if (g.x1 !== undefined && g.y1 !== undefined && g.x2 !== undefined && g.y2 !== undefined) {
                        const dx = g.x2 - g.x1;
                        const dy = g.y2 - g.y1;
                        const lenSq = dx * dx + dy * dy;
                        const t =
                            lenSq > 0 ? Math.max(0, Math.min(1, ((cx - g.x1) * dx + (cy - g.y1) * dy) / lenSq)) : 0;
                        dist = Math.hypot(cx - (g.x1 + t * dx), cy - (g.y1 + t * dy));
                    } else if (g.x !== undefined && g.y !== undefined && g.w !== undefined && g.h !== undefined) {
                        const nx = Math.max(g.x, Math.min(cx, g.x + g.w));
                        const ny = Math.max(g.y, Math.min(cy, g.y + g.h));
                        dist = Math.hypot(cx - nx, cy - ny);
                    } else if (g.x !== undefined && g.y !== undefined && g.r !== undefined) {
                        dist = Math.max(0, Math.hypot(cx - g.x, cy - g.y) - g.r);
                    } else {
                        const pX = g.x ?? g.x1 ?? tok.x ?? 0;
                        const pY = g.y ?? g.y1 ?? tok.y ?? 0;
                        dist = Math.hypot(cx - pX, cy - pY);
                    }
                    if (dist > 400) continue;
                    const dPortalId = tr.targetPortalId || targetPortalId || sPortal.targetPortalId;
                    const dPortal =
                        dPortalId && Array.isArray(tMap.portals)
                            ? tMap.portals.find((p) => p && p.id === dPortalId)
                            : null;
                    if (dPortal) {
                        const dg = dPortal.geom || dPortal;
                        const dpX = dg.x ?? dg.x1 ?? destX;
                        const dpY = dg.y ?? dg.y1 ?? destY;
                        if (Math.hypot(destX - dpX, destY - dpY) > 400) {
                            destX = dpX;
                            destY = dpY;
                        }
                    }
                }
                delete sMap.tokens[tr.tokenId];
                tok.x = destX;
                tok.y = destY;
                tMap.tokens[tr.tokenId] = tok;
                if (senderRole !== 'GM' && !RESERVED_KEYS.has(senderName))
                    camp.playerMapOverrides[senderName] = targetMapId;
                else if (tok.owner || tr.username) camp.playerMapOverrides[tok.owner || tr.username] = targetMapId;
                moved.push({
                    tokenId: tr.tokenId,
                    token: tok,
                    tokenName: tok.name || 'Token',
                    targetPortalId: tr.targetPortalId || targetPortalId || null,
                    targetX: destX,
                    targetY: destY,
                    username: tok.owner || tr.username || senderName
                });
                emitToAll(adapter, 'token:deleted', [{ mapId: sourceMapId, tokenId: tr.tokenId, origin: originId }], {
                    senderName,
                    senderRole
                });
                if (isTokenVisibleToPlayers(tok)) {
                    emitToAll(
                        adapter,
                        'token:added',
                        [{ mapId: targetMapId, tokenId: tr.tokenId, token: tok, origin: originId }],
                        { senderName, senderRole }
                    );
                } else {
                    adapter._dispatch('token:added', {
                        mapId: targetMapId,
                        tokenId: tr.tokenId,
                        token: tok,
                        origin: originId
                    });
                }
            }
            if (moved.length > 0) {
                persist();
                emitCampaignSyncToAll(adapter, camp);
                if (event === 'portal:teleport_inter_map_batch') {
                    emitToAll(
                        adapter,
                        'portal:teleported_batch',
                        [
                            {
                                sourceMapId,
                                targetMapId,
                                targetPortalId: targetPortalId || null,
                                targetMapName: tMap.name || 'New Map',
                                tokens: moved
                            }
                        ],
                        { senderName, senderRole }
                    );
                }
                for (const mt of moved) {
                    emitToAll(
                        adapter,
                        'portal:teleported',
                        [{ ...mt, sourceMapId, targetMapId, targetMapName: tMap.name || 'New Map' }],
                        { senderName, senderRole }
                    );
                }
            }
            return true;
        }

        // 6. Initiative & Characters
        if (event === 'initiative:update' && camp && data?.initiative) {
            if (senderRole === 'GM') {
                camp.initiative = data.initiative;
            } else {
                const cur = camp.initiative || {
                    combatants: [],
                    currentRound: 1,
                    activeTurnIndex: -1,
                    isVisible: false
                };
                const nextCombatants = Array.isArray(cur.combatants) ? [...cur.combatants] : [];
                const incoming = Array.isArray(data.initiative.combatants) ? data.initiative.combatants : [];
                for (const c of incoming) {
                    if (!c || typeof c !== 'object') continue;
                    const charMatch = c.characterId ? camp.characters?.[c.characterId] : null;
                    if (!charMatch || !isCharacterControlled(charMatch, senderRole, senderName)) continue;
                    const idx = nextCombatants.findIndex(
                        (ec) =>
                            ec &&
                            ((c.id && ec.id === c.id) ||
                                (c.characterId && ec.characterId === c.characterId) ||
                                (c.tokenId && ec.tokenId === c.tokenId) ||
                                (c.name && ec.name && ec.name.toLowerCase() === String(c.name).toLowerCase()))
                    );
                    if (idx !== -1) {
                        const existing = nextCombatants[idx];
                        const existingChar = existing?.characterId ? camp.characters?.[existing.characterId] : null;
                        if (existingChar && !isCharacterControlled(existingChar, senderRole, senderName)) continue;
                        nextCombatants[idx] = { ...existing, ...c };
                    } else {
                        nextCombatants.push(c);
                    }
                }
                nextCombatants.sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0));
                camp.initiative = { ...cur, combatants: nextCombatants };
            }
            persist();
            emitToAll(adapter, 'initiative:updated', [{ initiative: camp.initiative }], { senderName, senderRole });
            return true;
        }

        if (event === 'initiative:settings' && senderRole === 'GM' && camp) {
            if (typeof data?.visible === 'boolean') {
                if (!camp.initiative)
                    camp.initiative = { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: false };
                camp.initiative.isVisible = data.visible;
                persist();
            }
            emitToAll(adapter, 'initiative:settings', [data], { senderName, senderRole });
            return true;
        }

        if ((event === 'character:update' || event === 'character:create') && camp && data?.character?.id) {
            if (!camp.characters) camp.characters = {};
            const charId = data.character.id;
            if (RESERVED_KEYS.has(charId)) return true;
            const existing = camp.characters[charId];
            if (senderRole !== 'GM') {
                if (camp.isPaused) return true;
                if (event === 'character:create' && existing) return true;
                if (existing && !isCharacterControlled(existing, senderRole, senderName)) return true;
                const sanitized = sanitizeObject(data.character);
                if (!existing) {
                    const ownedCount = Object.values(camp.characters).filter((ch) =>
                        isCharacterControlled(ch, senderRole, senderName)
                    ).length;
                    if (ownedCount >= 10) return true;
                    sanitized.owner = senderName;
                    sanitized.ownerUsername = senderName;
                    sanitized.assignedPlayers = [senderName];
                    sanitized.players = [senderName];
                    delete sanitized.monsterData;
                } else {
                    sanitized.owner = existing.owner;
                    sanitized.ownerUsername = existing.ownerUsername;
                    sanitized.assignedPlayers = existing.assignedPlayers;
                    sanitized.players = existing.players;
                    if (existing.monsterData !== undefined) sanitized.monsterData = existing.monsterData;
                    else delete sanitized.monsterData;
                }
                camp.characters[charId] = sanitized;
            } else {
                camp.characters[charId] = sanitizeObject(data.character);
            }
            persist();
            emitToAll(adapter, 'character:updated', [{ character: camp.characters[charId], origin: originId }], {
                senderName,
                senderRole
            });
            return true;
        }

        if (event === 'character:delete' && camp && data?.id && camp.characters?.[data.id]) {
            if (senderRole !== 'GM' && !isCharacterControlled(camp.characters[data.id], senderRole, senderName))
                return true;
            delete camp.characters[data.id];
            persist();
            emitToAll(adapter, 'character:deleted', [{ id: data.id }], { senderName, senderRole });
            return true;
        }

        // 7. Maps & Campaign Lifecycle
        if (event === 'map:create' && senderRole === 'GM' && camp) {
            const mapId = `map_${camp.id || 'default'}_${Date.now()}`;
            if (!camp.maps) camp.maps = {};
            camp.maps[mapId] = {
                id: mapId,
                name: data?.name || 'Unnamed Map',
                folder: (data?.folder || '').trim(),
                mapImage: data?.mapImage || '',
                thumbnail: data?.thumbnail || data?.mapImage || '',
                gridWidth: data?.gridWidth,
                gridHeight: data?.gridHeight,
                grid: data?.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5, type: 'square' },
                tokens: data?.tokens || {},
                walls: data?.walls || [],
                notes: data?.notes || [],
                lights: data?.lights || [],
                shapes: data?.shapes || {},
                drawings: data?.drawings || {},
                traps: data?.traps || [],
                portals: data?.portals || []
            };
            if (!Array.isArray(camp.mapOrder)) camp.mapOrder = Object.keys(camp.maps);
            else if (!camp.mapOrder.includes(mapId)) camp.mapOrder.push(mapId);
            camp.activeGMMapId = mapId;
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'map:bulk-create' && senderRole === 'GM' && camp && Array.isArray(data?.maps)) {
            if (!camp.maps) camp.maps = {};
            if (!Array.isArray(camp.mapOrder)) camp.mapOrder = Object.keys(camp.maps);
            const targetFolder = (data.targetFolder || '').trim();
            if (targetFolder && targetFolder !== '__ALL__' && targetFolder !== '__UNCATEGORIZED__') {
                if (!Array.isArray(camp.mapFolders)) camp.mapFolders = [];
                if (!camp.mapFolders.includes(targetFolder)) {
                    camp.mapFolders.push(targetFolder);
                    camp.mapFolders.sort();
                }
            }
            data.maps.forEach((m, idx) => {
                const mapId = `map_${camp.id || 'default'}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
                camp.maps[mapId] = {
                    id: mapId,
                    name: m.name || `Imported Map ${idx + 1}`,
                    folder: (m.folder || targetFolder || '').trim(),
                    mapImage: m.mapImage || '',
                    thumbnail: m.thumbnail || m.mapImage || '',
                    gridWidth: m.gridWidth,
                    gridHeight: m.gridHeight,
                    grid: m.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5, type: 'square' },
                    tokens: m.tokens || {},
                    walls: m.walls || [],
                    notes: m.notes || [],
                    lights: m.lights || [],
                    shapes: m.shapes || {},
                    drawings: m.drawings || {},
                    traps: m.traps || [],
                    portals: m.portals || []
                };
                camp.mapOrder.push(mapId);
            });
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (
            event === 'map:edit' &&
            senderRole === 'GM' &&
            camp &&
            data?.mapId &&
            data?.updates &&
            camp.maps?.[data.mapId]
        ) {
            Object.assign(camp.maps[data.mapId], data.updates);
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'map:duplicate' && senderRole === 'GM' && camp && data?.mapId && camp.maps?.[data.mapId]) {
            const src = camp.maps[data.mapId];
            const newMapId = `map_${camp.id || 'default'}_${Date.now()}`;
            const cloned = JSON.parse(JSON.stringify(src));
            cloned.id = newMapId;
            cloned.name = `${src.name || 'Map'} (Copy)`;
            camp.maps[newMapId] = cloned;
            if (!Array.isArray(camp.mapOrder)) camp.mapOrder = Object.keys(camp.maps);
            else camp.mapOrder.push(newMapId);
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'map:rename' && senderRole === 'GM' && camp && data?.mapId && camp.maps?.[data.mapId]) {
            camp.maps[data.mapId].name = data.name;
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'map:delete' && senderRole === 'GM' && camp && data?.mapId && camp.maps?.[data.mapId]) {
            if (Object.keys(camp.maps).length <= 1) return true;
            delete camp.maps[data.mapId];
            if (Array.isArray(camp.mapOrder)) camp.mapOrder = camp.mapOrder.filter((id) => id !== data.mapId);
            const firstId = Object.keys(camp.maps)[0];
            if (camp.activeMapId === data.mapId) camp.activeMapId = firstId;
            if (camp.activeGMMapId === data.mapId) camp.activeGMMapId = camp.activeMapId;
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'map:reorder' && senderRole === 'GM' && camp && camp.maps) {
            const { mapOrder, mapId, targetMapId, position, folder } = data || {};
            if (Array.isArray(mapOrder)) {
                const valid = mapOrder.filter((id) => camp.maps[id]);
                Object.keys(camp.maps).forEach((id) => {
                    if (!valid.includes(id)) valid.push(id);
                });
                camp.mapOrder = valid;
            } else if (mapId && camp.maps[mapId]) {
                let order = Array.isArray(camp.mapOrder) ? [...camp.mapOrder] : Object.keys(camp.maps);
                order = order.filter((id) => id !== mapId && camp.maps[id]);
                const tIdx = targetMapId ? order.indexOf(targetMapId) : -1;
                if (tIdx !== -1) order.splice(position === 'after' ? tIdx + 1 : tIdx, 0, mapId);
                else order.push(mapId);
                camp.mapOrder = order;
            }
            if (mapId && camp.maps[mapId] && folder !== undefined) camp.maps[mapId].folder = folder;
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (
            (event === 'map:folder-create' || event === 'map:folder-rename' || event === 'map:folder-delete') &&
            senderRole === 'GM' &&
            camp
        ) {
            if (!Array.isArray(camp.mapFolders)) camp.mapFolders = [];
            if (event === 'map:folder-create') {
                const f = (data?.folder || '').trim();
                if (f && f !== '__ALL__' && f !== '__UNCATEGORIZED__' && !camp.mapFolders.includes(f)) {
                    camp.mapFolders.push(f);
                    camp.mapFolders.sort();
                }
            } else if (event === 'map:folder-rename') {
                const o = (data?.oldFolder || '').trim();
                const n = (data?.newFolder || '').trim();
                if (o && n && o !== n) {
                    const idx = camp.mapFolders.indexOf(o);
                    if (idx !== -1) camp.mapFolders[idx] = n;
                    Object.values(camp.maps || {}).forEach((m) => {
                        if (m.folder === o) m.folder = n;
                    });
                }
            } else if (event === 'map:folder-delete') {
                const f = (data?.folder || '').trim();
                camp.mapFolders = camp.mapFolders.filter((x) => x !== f);
                Object.values(camp.maps || {}).forEach((m) => {
                    if (m.folder === f) m.folder = '';
                });
            }
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (
            (event === 'map:switch-gm' || event === 'map:switch') &&
            senderRole === 'GM' &&
            camp &&
            data?.mapId &&
            camp.maps?.[data.mapId]
        ) {
            camp.activeGMMapId = data.mapId;
            persist();
            adapter._dispatch('campaign:state-sync', JSON.parse(JSON.stringify(camp)));
            return true;
        }

        if (
            (event === 'map:switch-player' || event === 'player:map_override') &&
            camp &&
            data?.mapId &&
            !RESERVED_KEYS.has(data.mapId) &&
            !RESERVED_KEYS.has(senderName) &&
            camp.maps?.[data.mapId]
        ) {
            if (senderRole !== 'GM') {
                const targetMap = camp.maps[data.mapId];
                const currentOverride = getPlayerMapOverride(camp, senderName);
                const hasTokenOnTarget = Object.values(targetMap?.tokens || {}).some((t) =>
                    isTokenControlled(t, camp, senderRole, senderName)
                );
                const isAllowedMap =
                    data.mapId === camp.activeMapId ||
                    data.mapId === currentOverride ||
                    hasTokenOnTarget ||
                    targetMap.isPublic === true;
                if (!isAllowedMap) return true;
            }
            if (!camp.playerMapOverrides) camp.playerMapOverrides = {};
            camp.playerMapOverrides[senderName] = data.mapId;
            persist();
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'campaign:update' && senderRole === 'GM' && camp) {
            if (data?.activeGMMapId && camp.maps?.[data.activeGMMapId]) {
                camp.activeGMMapId = data.activeGMMapId;
                persist();
                adapter._dispatch('campaign:state-sync', JSON.parse(JSON.stringify(camp)));
            }
            return true;
        }

        if (event === 'map:activate-players' && senderRole === 'GM' && camp && data?.mapId && camp.maps?.[data.mapId]) {
            const { mapId, targetPlayers } = data;
            const isAll = !targetPlayers || targetPlayers === 'all';
            if (isAll) {
                camp.activeMapId = mapId;
                camp.activeGMMapId = mapId;
                camp.playerMapOverrides = {};
            } else if (Array.isArray(targetPlayers)) {
                if (!camp.playerMapOverrides) camp.playerMapOverrides = {};
                targetPlayers.forEach((p) => {
                    camp.playerMapOverrides[p] = mapId;
                });
            }
            persist();
            emitToAll(
                adapter,
                'map:activated',
                [
                    {
                        mapId,
                        mapName: camp.maps[mapId]?.name || 'Map',
                        targetPlayers: isAll ? 'all' : targetPlayers,
                        activeMapId: camp.activeMapId,
                        activeGMMapId: camp.activeGMMapId
                    }
                ],
                { senderName, senderRole }
            );
            emitCampaignSyncToAll(adapter, camp);
            return true;
        }

        if (event === 'map:request_sync' && camp) {
            const targetMapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const rawMap = camp.maps?.[targetMapId];
            if (rawMap) {
                if (senderPeer) {
                    const sanitized = adapter._sanitizeCampaignStateForPlayer(
                        { maps: { [targetMapId]: rawMap } },
                        senderName
                    ).maps[targetMapId];
                    sendPacket(
                        adapter,
                        senderPeer,
                        'map:full_data',
                        [{ mapId: targetMapId, map: sanitized }],
                        adapter.username,
                        'GM'
                    );
                } else {
                    adapter._dispatch('map:full_data', { mapId: targetMapId, map: rawMap });
                }
            }
            return true;
        }

        if (event === 'token:request_sync' && camp && data?.tokenId) {
            const targetMapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
            const tok = camp.maps?.[targetMapId]?.tokens?.[data.tokenId];
            if (tok && (senderRole === 'GM' || isTokenVisibleToPlayers(tok))) {
                const payload = { mapId: targetMapId, tokenId: data.tokenId, token: tok, origin: 'server_sync' };
                if (senderPeer) sendPacket(adapter, senderPeer, 'token:added', [payload], adapter.username, 'GM');
                else adapter._dispatch('token:added', payload);
            }
            return true;
        }

        // 8. Transient FX, Pings, Measure & Presentation
        if (event === 'map:ping') {
            emitToAll(adapter, 'map:pinged', [{ x: data?.x, y: data?.y, username: senderName, role: senderRole }], {
                excludePeerId: senderPeer?.id || null,
                excludeHost: !senderPeer,
                senderName,
                senderRole
            });
            return true;
        }
        if (event === 'map:panTo' && senderRole === 'GM') {
            emitToAll(adapter, 'map:pannedTo', [data], { excludeHost: true, senderName, senderRole });
            return true;
        }
        if (event === 'measure:update') {
            emitToAll(
                adapter,
                'measure:updated',
                [{ ...data, socketId: originId, username: senderName, role: senderRole }],
                { excludePeerId: senderPeer?.id || null, excludeHost: !senderPeer, senderName, senderRole }
            );
            return true;
        }
        if (event === 'measure:clear') {
            emitToAll(adapter, 'measure:cleared', [{ socketId: originId }], {
                excludePeerId: senderPeer?.id || null,
                excludeHost: !senderPeer,
                senderName,
                senderRole
            });
            return true;
        }
        if (event === 'token:force_select_gm') {
            adapter._dispatch('token:force_selected_gm', { tokenId: data?.tokenId, username: senderName });
            return true;
        }
        if (event === 'tokens:damage_fx' || event === 'tokens:heal_fx') {
            if (senderRole !== 'GM') {
                if (camp?.isPaused) return true;
                const mapId = resolveTargetMapId(camp, data?.mapId, senderRole, senderName);
                const tMap = camp?.maps?.[mapId];
                const tokId = data?.tokenId;
                if (
                    !tokId ||
                    !tMap?.tokens?.[tokId] ||
                    !isTokenControlled(tMap.tokens[tokId], camp, senderRole, senderName)
                ) {
                    return true;
                }
            }
            const payload = { ...(data || {}), origin: data?.origin || originId };
            emitToAll(adapter, event, [payload], { senderName, senderRole });
            return true;
        }
        if (event === 'theme:broadcast' && senderRole === 'GM') {
            emitToAll(adapter, 'theme:broadcasted', [{ themeId: data?.themeId, gmName: senderName }], {
                excludeHost: true,
                senderName,
                senderRole
            });
            return true;
        }
        if (event === 'presentation:camSync' && senderRole === 'GM') {
            emitToAll(adapter, 'presentation:camSynced', [data], { excludeHost: true, senderName, senderRole });
            return true;
        }
        if (event === 'presentation:camLock' && senderRole === 'GM') {
            emitToAll(adapter, 'presentation:camLocked', [{ locked: Boolean(data?.locked) }], {
                excludeHost: true,
                senderName,
                senderRole
            });
            return true;
        }

        return false;
    }

    const VttP2PHostEngine = { processEvent };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { VttP2PHostEngine };
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.VttP2PHostEngine = VttP2PHostEngine;
    }
    if (typeof window !== 'undefined') {
        window.VttP2PHostEngine = VttP2PHostEngine;
    }
})(typeof window !== 'undefined' ? window : globalThis);
