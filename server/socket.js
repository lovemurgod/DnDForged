import {
    campaigns,
    chatLogs,
    serverConfig,
    activeGmTokens,
    generateGmSessionToken,
    saveCampaigns,
    saveChat,
    extractSubdomain,
    getOrCreateCampaign,
    setActiveIo,
    isLoopbackRequest
} from './state.js';
import { verifyPassword, updateMapProperty } from '../utils.js';
import { registerCampaignBroadcaster } from './routes/campaigns.js';

let activeIo = null;

export function broadcastCampaignSync(campaignId) {
    if (!activeIo) return;
    const camp = campaigns[campaignId];
    if (!camp) return;
    const room = activeIo.sockets.adapter.rooms.get(campaignId);
    if (!room) return;
    for (const socketId of room) {
        const s = activeIo.sockets.sockets.get(socketId);
        if (s) {
            s.emit('campaign:state-sync', getSanitizedCampaignSync(camp, s.role, s.username, campaignId));
        }
    }
}

// Returns a minimal, high-performance campaign state slice tailored to the client's role.
// Inactive maps have heavy collections (walls, notes, non-background tokens, lights, shapes)
// stripped, ensuring payloads stay far below Cloudflare's 1MB WebSocket frame limit (<50KB).
function getPlayerMapOverride(camp, username) {
    if (!camp?.playerMapOverrides || !username) return null;
    if (camp.playerMapOverrides[username]) return camp.playerMapOverrides[username];
    const uLower = String(username).toLowerCase();
    for (const key in camp.playerMapOverrides) {
        if (key.toLowerCase() === uLower) return camp.playerMapOverrides[key];
    }
    return null;
}

function getSanitizedCampaignSync(camp, role, username, campaignId = null) {
    if (!camp) return null;
    const cloned = { ...camp };
    if (!cloned.mapOrder && cloned.maps) {
        cloned.mapOrder = Object.keys(cloned.maps);
    }
    if (!cloned.mapFolders) {
        cloned.mapFolders = camp.mapFolders || [];
    }
    if (cloned.playerMapOverrides) {
        cloned.playerMapOverrides = { ...camp.playerMapOverrides };
    }

    const campId = campaignId || camp.id;
    if (role === 'GM' && activeIo && campId) {
        const room = activeIo.sockets.adapter.rooms.get(campId);
        const online = [];
        if (room) {
            for (const socketId of room) {
                const s = activeIo.sockets.sockets.get(socketId);
                if (s && s.role !== 'GM' && s.username) {
                    online.push(s.username);
                }
            }
        }
        cloned.onlinePlayers = [...new Set(online)];
    }

    // Determine which map IDs need full data for this user
    const activeIds = new Set();
    if (camp.activeMapId) activeIds.add(camp.activeMapId);
    if (role === 'GM' && camp.activeGMMapId) activeIds.add(camp.activeGMMapId);
    const overrideMapId = role !== 'GM' ? getPlayerMapOverride(camp, username) : null;
    if (overrideMapId) {
        activeIds.add(overrideMapId);
    }

    if (camp.maps) {
        cloned.maps = {};
        for (const mapId in camp.maps) {
            const m = camp.maps[mapId];
            if (!m) continue;
            if (!activeIds.has(mapId)) {
                if (role !== 'GM') {
                    const safeInactiveTokens = {};
                    if (m.tokens) {
                        for (const tId in m.tokens) {
                            const tok = m.tokens[tId];
                            if (tok && tok.layer !== 'gm' && tok.isVisible !== false && !tok.hidden) {
                                safeInactiveTokens[tId] = tok;
                            }
                        }
                    }
                    cloned.maps[mapId] = {
                        id: m.id,
                        name: m.name,
                        folder: m.folder || '',
                        mapImage: m.mapImage || '',
                        thumbnail: m.thumbnail || m.mapImage || '',
                        gridWidth: m.gridWidth,
                        gridHeight: m.gridHeight,
                        grid: m.grid ? { ...m.grid } : undefined,
                        lightingSettings: m.lightingSettings,
                        weather: m.weather || null,
                        tokens: safeInactiveTokens,
                        walls: [],
                        notes: [],
                        lights: [],
                        shapes: {},
                        drawings: {},
                        traps: [],
                        portals: []
                    };
                } else {
                    cloned.maps[mapId] = {
                        id: m.id,
                        name: m.name,
                        folder: m.folder || '',
                        mapImage: m.mapImage || '',
                        thumbnail: m.thumbnail || m.mapImage || '',
                        gridWidth: m.gridWidth,
                        gridHeight: m.gridHeight,
                        grid: m.grid ? { ...m.grid } : undefined,
                        lightingSettings: m.lightingSettings,
                        weather: m.weather || null,
                        tokens: m.tokens || {},
                        walls: m.walls || [],
                        notes: [],
                        lights: m.lights || [],
                        shapes: {},
                        drawings: {},
                        traps: [],
                        portals: []
                    };
                }
            } else if (role !== 'GM') {
                // Active map for player view: strip GM secrets
                const playerMap = structuredClone(m);
                if (playerMap.tokens) {
                    const safeTokens = {};
                    for (const tId in playerMap.tokens) {
                        const tok = playerMap.tokens[tId];
                        if (tok && tok.layer !== 'gm' && tok.isVisible !== false && !tok.hidden) {
                            safeTokens[tId] = tok;
                        }
                    }
                    playerMap.tokens = safeTokens;
                }
                playerMap.traps = [];
                if (Array.isArray(playerMap.notes)) {
                    playerMap.notes = playerMap.notes.filter((n) => n && (n.isPublic || n.author === username));
                }
                if (Array.isArray(playerMap.portals)) {
                    playerMap.portals = playerMap.portals.filter((p) => p && !p.isSecret);
                }
                cloned.maps[mapId] = playerMap;
            } else {
                // GM gets full map data
                cloned.maps[mapId] = m;
            }
        }
    }
    return cloned;
}

// Broadcasts campaign:state-sync to each client in the room tailored to their view
function isCharacterControlledBySocket(char, socket) {
    if (!char || !socket) return false;
    if (socket.role === 'GM') return true;
    const username = socket.username;
    if (!username) return false;
    const uLower = username.toLowerCase();

    const matchUser = (val) => typeof val === 'string' && (val === '*' || val.toLowerCase() === uLower);
    const matchArr = (arr) => Array.isArray(arr) && arr.some(matchUser);

    if (matchUser(char.owner) || matchUser(char.ownerUsername)) return true;
    if (matchArr(char.assignedPlayers) || matchArr(char.players)) return true;

    return false;
}

function isTokenControlledBySocket(token, socket, campaign) {
    if (!token || !socket) return false;
    if (socket.role === 'GM') return true;
    const username = socket.username;
    if (!username) return false;
    const uLower = username.toLowerCase();

    const matchUser = (val) => typeof val === 'string' && (val === '*' || val.toLowerCase() === uLower);
    const matchArr = (arr) => Array.isArray(arr) && arr.some(matchUser);

    // Direct ownership on the token object
    if (matchUser(token.owner) || matchUser(token.playerOwner) || matchUser(token.ownerUsername)) {
        return true;
    }
    if (matchArr(token.players) || matchArr(token.assignedPlayers)) {
        return true;
    }

    // Linked character or companion ownership
    const charId = token.characterId || token.sourceCharacterId;
    if (charId && campaign && campaign.characters && campaign.characters[charId]) {
        const char = campaign.characters[charId];
        if (isCharacterControlledBySocket(char, socket)) {
            return true;
        }
    }

    return false;
}

// WebSocket Synchronizer

export function initSocketServer(io) {
    activeIo = io;
    setActiveIo(io);
    registerCampaignBroadcaster(broadcastCampaignSync);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        const socketSubdomain = extractSubdomain(socket.handshake.headers.host);

        // Handle player/GM registration to a campaign room
        socket.on('join', ({ campaignId, username, role, isSubWindow, gmPassword }) => {
            let targetCampaignId = campaignId || socketSubdomain || 'default';

            if (!campaigns[targetCampaignId]) {
                getOrCreateCampaign(targetCampaignId);
            }
            const activeCampId = targetCampaignId;

            const globalGmUser = (serverConfig.gmCredentials?.username || '').trim();
            const hasGlobalGm = !!globalGmUser;

            // GM Role verification
            if (role === 'GM') {
                const isLocal = isLoopbackRequest(socket.handshake);
                const hasPasswordHash = !!serverConfig.gmCredentials?.hash;

                // 1. Remote GM joins MUST have a configured password and provide valid credentials
                if (!isLocal) {
                    if (!hasPasswordHash) {
                        console.warn(
                            `[Security] Remote connection from ${socket.handshake.address} attempted GM role without configured server password. Rejecting join.`
                        );
                        socket.emit('join_rejected', {
                            reason: 'Remote Game Master login requires a password configured in the GM Dashboard.',
                            code: 'PASSWORD_REQUIRED'
                        });
                        socket.disconnect(true);
                        return;
                    }
                    if (hasGlobalGm && username.trim().toLowerCase() !== globalGmUser.toLowerCase()) {
                        socket.emit('join_rejected', {
                            reason: 'You are not the designated Game Master for this server.'
                        });
                        socket.disconnect(true);
                        return;
                    }
                    const isValid = verifyPassword(
                        gmPassword || '',
                        serverConfig.gmCredentials.salt,
                        serverConfig.gmCredentials.hash
                    );
                    if (!isValid) {
                        socket.emit('join_rejected', {
                            reason: 'Incorrect GM Password.',
                            code: 'INVALID_PASSWORD'
                        });
                        socket.disconnect(true);
                        return;
                    }
                    // Authoritative GM: update campaign's assigned GM username to authenticated GM
                    if (campaigns[activeCampId].gmUsername !== username) {
                        campaigns[activeCampId].gmUsername = username;
                        saveCampaigns();
                    }
                } else {
                    // 2. Local loopback connection: allow convenient local login
                    if (hasGlobalGm) {
                        if (username.trim().toLowerCase() !== globalGmUser.toLowerCase()) {
                            socket.emit('join_rejected', {
                                reason: 'You are not the designated Game Master for this server.'
                            });
                            socket.disconnect(true);
                            return;
                        }
                        if (hasPasswordHash) {
                            const isValid = verifyPassword(
                                gmPassword || '',
                                serverConfig.gmCredentials.salt,
                                serverConfig.gmCredentials.hash
                            );
                            if (!isValid) {
                                socket.emit('join_rejected', {
                                    reason: 'Incorrect GM Password.',
                                    code: 'INVALID_PASSWORD'
                                });
                                socket.disconnect(true);
                                return;
                            }
                        }
                        if (campaigns[activeCampId].gmUsername !== username) {
                            campaigns[activeCampId].gmUsername = username;
                            saveCampaigns();
                        }
                    } else {
                        // Passwordless fallback on loopback
                        if (!campaigns[activeCampId].gmUsername) {
                            campaigns[activeCampId].gmUsername = username;
                            saveCampaigns();
                        } else if (username !== campaigns[activeCampId].gmUsername) {
                            socket.emit('join_rejected', { reason: 'You are not the Game Master for this campaign.' });
                            socket.disconnect(true);
                            return;
                        }
                    }
                }
            }

            // Prevent players from taking the GM's username
            if (role === 'Player') {
                if (hasGlobalGm && username.trim().toLowerCase() === globalGmUser.toLowerCase()) {
                    socket.emit('join_rejected', { reason: 'That username is reserved for the Game Master.' });
                    socket.disconnect(true);
                    return;
                }
                if (campaigns[activeCampId].gmUsername && username === campaigns[activeCampId].gmUsername) {
                    socket.emit('join_rejected', { reason: 'That username is reserved for the Game Master.' });
                    socket.disconnect(true);
                    return;
                }
            }

            let finalRole = role;
            if (finalRole === 'Player') {
                // Enforce allowlist if it exists and is populated
                const allowed = campaigns[activeCampId].allowedUsers || [];
                if (allowed.length > 0 && !allowed.includes(username)) {
                    socket.emit('join_rejected', { reason: 'Username not on the allowed list' });
                    socket.disconnect(true);
                    return;
                }
            }

            socket.join(activeCampId);
            socket.campaignId = activeCampId;
            socket.username = username;
            socket.role = finalRole;
            socket.isSubWindow = !!isSubWindow;

            if (!campaigns[activeCampId].knownPlayers) {
                campaigns[activeCampId].knownPlayers = [];
            }
            if (!campaigns[activeCampId].knownPlayers.includes(username)) {
                campaigns[activeCampId].knownPlayers.push(username);
                saveCampaigns();
            }

            console.log(
                `${username} joined campaign ${activeCampId} as ${finalRole}${socket.isSubWindow ? ' (Sub-Window)' : ''}`
            );

            // Welcome user and send current state (sanitized to avoid 1MB websocket limit)
            const rawChat = (chatLogs[activeCampId] || []).slice(-50);
            const sanitizedChat =
                finalRole === 'GM'
                    ? rawChat
                    : rawChat.filter((m) => {
                        if (m.whisperToGM) return m.username === username;
                        if (m.whisperTo) {
                            const tLower = String(m.whisperTo).toLowerCase().trim();
                            return m.username === username || (username && username.toLowerCase().trim() === tLower);
                        }
                        return true;
                    });

            let gmSessionToken = null;
            if (finalRole === 'GM') {
                gmSessionToken = generateGmSessionToken();
                socket.gmSessionToken = gmSessionToken;
            }

            socket.emit('joined', {
                gmSessionToken,
                role: finalRole,
                userRole: finalRole,
                campaignState: getSanitizedCampaignSync(campaigns[activeCampId], finalRole, username, activeCampId),
                chatHistory: sanitizedChat
            });

            // Notify others only if it is a primary window connection
            if (!socket.isSubWindow) {
                socket.to(activeCampId).emit('sys_message', {
                    text: `${username} has joined the game.`,
                    timestamp: Date.now()
                });
                broadcastCampaignSync(activeCampId);
            }
        });

        socket.on('allowlist:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            campaigns[campaignId].allowedUsers = data.allowedUsers;
            saveCampaigns();

            io.to(campaignId).emit('allowlist:updated', { allowedUsers: data.allowedUsers });
        });

        // Sync handouts
        socket.on('handouts:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            campaigns[campaignId].handouts = data.handouts;
            saveCampaigns();

            io.to(campaignId).emit('handouts:updated', { handouts: data.handouts });
        });

        // Forward handouts:force_show
        socket.on('handouts:force_show', (data) => {
            const { campaignId } = socket;
            if (!campaignId) return;
            if (socket.role !== 'GM') return;

            io.to(campaignId).emit('handouts:force_show', data);
        });

        // Forward splash:show to all clients in campaign
        socket.on('splash:show', (data) => {
            const { campaignId } = socket;
            if (!campaignId) return;
            if (socket.role !== 'GM') return;

            io.to(campaignId).emit('splash:show', data);
        });

        // Tabletop Pause & X-Card Safety Tool synchronizer
        socket.on('game:set_pause', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            const camp = campaigns[campaignId];

            const requestedPause = !!data?.paused;
            let source = data?.source || (socket.role === 'GM' ? 'gm' : 'xcard');

            if (!requestedPause) {
                // Unpausing: ONLY GM can unpause
                if (socket.role !== 'GM') {
                    console.warn(
                        `[Security] Non-GM player ${socket.username} attempted to unpause campaign ${campaignId}`
                    );
                    return;
                }
                camp.isPaused = false;
                camp.pauseState = {
                    isPaused: false,
                    source: null,
                    by: socket.username || 'GM',
                    at: Date.now()
                };
                saveCampaigns();
                io.to(campaignId).emit('game:pause_state', camp.pauseState);
                console.log(`[Campaign ${campaignId}] Tabletop RESUMED by GM (${socket.username})`);
            } else {
                // Pausing: GM or Player (via X-Card)
                if (socket.role !== 'GM') {
                    source = 'xcard';
                }
                camp.isPaused = true;
                camp.pauseState = {
                    isPaused: true,
                    source: source,
                    by: socket.username || (socket.role === 'GM' ? 'GM' : 'Player'),
                    at: Date.now()
                };
                saveCampaigns();
                io.to(campaignId).emit('game:pause_state', camp.pauseState);
                console.log(
                    `[Campaign ${campaignId}] Tabletop PAUSED (${source}) by ${socket.username} (${socket.role})`
                );
            }
        });

        // Sync token state changes (legacy - full state)
        socket.on('token:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM' && campaigns[campaignId].isPaused) {
                console.warn(`[Pause] Blocked token:update from player ${socket.username} during active pause`);
                return;
            }

            const mapId =
                data.mapId ||
                (socket.role === 'GM'
                    ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                    : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                    campaigns[campaignId].activeMapId);

            // Handle single token format { token } gracefully
            if (data.token && data.token.id && !data.tokens) {
                if (socket.role !== 'GM' && !isTokenControlledBySocket(data.token, socket, campaigns[campaignId])) {
                    console.warn(
                        `[Security] Unauthorized token update attempt by ${socket.username} for token ${data.token.id}`
                    );
                    return;
                }
                let mapId =
                    data.mapId ||
                    (socket.role === 'GM'
                        ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                        : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                        campaigns[campaignId].activeMapId);

                let wasVisibleToPlayers = false;
                let isVisibleToPlayers = false;
                let tokenSnapshot = null;
                if (campaigns[campaignId].maps) {
                    let targetMap = campaigns[campaignId].maps[mapId];
                    let oldTok = targetMap?.tokens?.[data.token.id];
                    if (targetMap) {
                        if (!targetMap.tokens) targetMap.tokens = {};
                        wasVisibleToPlayers = oldTok
                            ? oldTok.layer !== 'gm' && oldTok.isVisible !== false && !oldTok.hidden
                            : false;
                        const cloned = JSON.parse(JSON.stringify(data.token));
                        if (!cloned.id) cloned.id = data.token.id;
                        if (cloned._animReq) delete cloned._animReq;
                        targetMap.tokens[data.token.id] = cloned;
                        isVisibleToPlayers = cloned.layer !== 'gm' && cloned.isVisible !== false && !cloned.hidden;
                        tokenSnapshot = cloned;
                        saveCampaigns();
                    }
                }

                const room = io.sockets.adapter.rooms.get(campaignId);
                if (room && tokenSnapshot) {
                    for (const socketId of room) {
                        const s = io.sockets.sockets.get(socketId);
                        if (!s) continue;
                        if (s.role === 'GM') {
                            s.emit('token:updated_delta', {
                                mapId,
                                tokenId: data.token.id,
                                changes: data.token,
                                origin: socket.id
                            });
                        } else {
                            if (!wasVisibleToPlayers && isVisibleToPlayers) {
                                s.emit('token:added', {
                                    mapId,
                                    tokenId: data.token.id,
                                    token: tokenSnapshot,
                                    origin: socket.id
                                });
                            } else if (wasVisibleToPlayers && !isVisibleToPlayers) {
                                s.emit('token:deleted', { mapId, tokenId: data.token.id, origin: socket.id });
                            } else if (isVisibleToPlayers) {
                                s.emit('token:updated_delta', {
                                    mapId,
                                    tokenId: data.token.id,
                                    changes: data.token,
                                    origin: socket.id
                                });
                            }
                        }
                    }
                } else {
                    io.to(campaignId).emit('token:updated_delta', {
                        mapId,
                        tokenId: data.token.id,
                        changes: data.token,
                        origin: socket.id
                    });
                }
                return;
            }

            if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
                const cloned = JSON.parse(JSON.stringify(data.tokens || {}));
                const existingTokens = campaigns[campaignId].maps[mapId].tokens || {};
                for (const id in cloned) {
                    if (socket.role !== 'GM') {
                        const checkTok = existingTokens[id] || cloned[id];
                        if (!isTokenControlledBySocket(checkTok, socket, campaigns[campaignId])) {
                            continue;
                        }
                    }
                    if (cloned[id]?._animReq) delete cloned[id]._animReq;
                    existingTokens[id] = cloned[id];
                }
                campaigns[campaignId].maps[mapId].tokens = existingTokens;
                saveCampaigns();
            }

            // Broadcast update tailored per recipient role (GM receives all tokens; players receive sanitized tokens)
            const room = io.sockets.adapter.rooms.get(campaignId);
            if (room) {
                const fullTokens = (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]?.tokens) || {};
                const safeTokens = {};
                for (const tId in fullTokens) {
                    const tok = fullTokens[tId];
                    if (tok && tok.layer !== 'gm' && tok.isVisible !== false && !tok.hidden) {
                        safeTokens[tId] = tok;
                    }
                }
                for (const socketId of room) {
                    const s = io.sockets.sockets.get(socketId);
                    if (s) {
                        const tokensToSend = s.role === 'GM' ? fullTokens : safeTokens;
                        s.emit('token:updated', { mapId, tokens: tokensToSend, origin: socket.id });
                    }
                }
            }
        });

        // Add new token
        socket.on('token:add', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM' && campaigns[campaignId].isPaused) {
                console.warn(`[Pause] Blocked token:add from player ${socket.username} during active pause`);
                return;
            }

            // Security check: Players may only add tokens they control (characters or companions)
            if (socket.role !== 'GM') {
                const isAllowed = isTokenControlledBySocket(data.token, socket, campaigns[campaignId]);
                if (!isAllowed) {
                    console.warn(`[Security] Player ${socket.username} attempted to add unauthorized token`);
                    return;
                }
                if (!data.token.owner) data.token.owner = socket.username;
                if (!data.token.playerOwner) data.token.playerOwner = socket.username;
                if (!data.token.ownerUsername) data.token.ownerUsername = socket.username;
            }

            const mapId =
                data.mapId ||
                (socket.role === 'GM'
                    ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                    : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                    campaigns[campaignId].activeMapId);
            if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
                const cloned = JSON.parse(JSON.stringify(data.token || {}));
                if (!cloned.id) cloned.id = data.tokenId;
                if (cloned._animReq) delete cloned._animReq;
                if (!campaigns[campaignId].maps[mapId].tokens) campaigns[campaignId].maps[mapId].tokens = {};
                campaigns[campaignId].maps[mapId].tokens[data.tokenId] = cloned;
                saveCampaigns();
            }

            const tokenToSend = campaigns[campaignId].maps?.[mapId]?.tokens?.[data.tokenId] || data.token;
            if (tokenToSend && !tokenToSend.id) tokenToSend.id = data.tokenId;

            const isVisibleToPlayers =
                tokenToSend && tokenToSend.layer !== 'gm' && tokenToSend.isVisible !== false && !tokenToSend.hidden;
            const room = io.sockets.adapter.rooms.get(campaignId);
            if (room) {
                for (const socketId of room) {
                    const s = io.sockets.sockets.get(socketId);
                    if (s && (s.role === 'GM' || isVisibleToPlayers)) {
                        s.emit('token:added', { mapId, tokenId: data.tokenId, token: tokenToSend, origin: socket.id });
                    }
                }
            } else {
                io.to(campaignId).emit('token:added', {
                    mapId,
                    tokenId: data.tokenId,
                    token: tokenToSend,
                    origin: socket.id
                });
            }
        });

        // Update specific fields of an existing token (Delta)
        socket.on('token:update_delta', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM' && campaigns[campaignId].isPaused) {
                console.warn(`[Pause] Blocked token:update_delta from player ${socket.username} during active pause`);
                return;
            }

            let mapId =
                data.mapId ||
                (socket.role === 'GM'
                    ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                    : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                    campaigns[campaignId].activeMapId);
            let wasVisibleToPlayers = false;
            let isVisibleToPlayers = false;
            let tokenSnapshot = null;

            if (campaigns[campaignId].maps) {
                let targetMap = campaigns[campaignId].maps[mapId];
                let existingToken = targetMap?.tokens?.[data.tokenId];

                if (existingToken) {
                    // Security check: GM can update any token; Players can only update tokens they control
                    if (socket.role !== 'GM') {
                        const isOwner = isTokenControlledBySocket(existingToken, socket, campaigns[campaignId]);
                        if (!isOwner) {
                            console.warn(
                                `[Security] Unauthorized token delta update attempt by ${socket.username} for token ${data.tokenId}`
                            );
                            return;
                        }
                    }

                    wasVisibleToPlayers =
                        existingToken.layer !== 'gm' && existingToken.isVisible !== false && !existingToken.hidden;
                    Object.assign(existingToken, data.changes);
                    if (!existingToken.id) existingToken.id = data.tokenId;
                    if (existingToken._animReq) delete existingToken._animReq;
                    isVisibleToPlayers =
                        existingToken.layer !== 'gm' && existingToken.isVisible !== false && !existingToken.hidden;
                    tokenSnapshot = JSON.parse(JSON.stringify(existingToken));
                    saveCampaigns();
                }
            }

            const room = io.sockets.adapter.rooms.get(campaignId);
            if (room && tokenSnapshot) {
                for (const socketId of room) {
                    const s = io.sockets.sockets.get(socketId);
                    if (!s) continue;
                    if (s.role === 'GM') {
                        s.emit('token:updated_delta', {
                            mapId,
                            tokenId: data.tokenId,
                            changes: data.changes,
                            origin: socket.id
                        });
                    } else {
                        // Visibility transition routing for non-GM players
                        if (!wasVisibleToPlayers && isVisibleToPlayers) {
                            s.emit('token:added', {
                                mapId,
                                tokenId: data.tokenId,
                                token: tokenSnapshot,
                                origin: socket.id
                            });
                        } else if (wasVisibleToPlayers && !isVisibleToPlayers) {
                            s.emit('token:deleted', { mapId, tokenId: data.tokenId, origin: socket.id });
                        } else if (isVisibleToPlayers) {
                            s.emit('token:updated_delta', {
                                mapId,
                                tokenId: data.tokenId,
                                changes: data.changes,
                                origin: socket.id
                            });
                        }
                    }
                }
            } else {
                io.to(campaignId).emit('token:updated_delta', {
                    mapId,
                    tokenId: data.tokenId,
                    changes: data.changes,
                    origin: socket.id
                });
            }
        });

        // Delete token
        socket.on('token:delete', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM' && campaigns[campaignId].isPaused) {
                console.warn(`[Pause] Blocked token:delete from player ${socket.username} during active pause`);
                return;
            }

            const mapId =
                data.mapId ||
                (socket.role === 'GM'
                    ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                    : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                    campaigns[campaignId].activeMapId);
            if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
                const existingToken = campaigns[campaignId].maps[mapId].tokens[data.tokenId];
                if (!existingToken) return;

                // Security check: GM can delete any token; Players can only delete tokens they control
                if (socket.role !== 'GM') {
                    const isOwner = isTokenControlledBySocket(existingToken, socket, campaigns[campaignId]);
                    if (!isOwner) {
                        console.warn(
                            `[Security] Unauthorized token delete attempt by ${socket.username} for token ${data.tokenId}`
                        );
                        return;
                    }
                }

                delete campaigns[campaignId].maps[mapId].tokens[data.tokenId];
                saveCampaigns();
            }

            io.to(campaignId).emit('token:deleted', { mapId, tokenId: data.tokenId, origin: socket.id });
        });

        // Sync grid configuration changes (GM only)
        socket.on('grid:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'grid', data.grid);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('grid:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                grid: data.grid
            });
        });

        // Sync map background updates (GM only)
        socket.on('map:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'mapImage', data.mapImage);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('map:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                mapImage: data.mapImage
            });
        });

        // Sync partial map updates from the Edit Map modal (grid dimensions, name, url)
        socket.on('map:edit', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            if (data.mapId && data.updates && campaigns[campaignId].maps[data.mapId]) {
                Object.assign(campaigns[campaignId].maps[data.mapId], data.updates);
                saveCampaigns();
                broadcastCampaignSync(campaignId);
            }
        });

        // Reorder maps in campaign (GM only)
        socket.on('map:reorder', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const { mapOrder, mapId, targetMapId, position, folder } = data || {};
            const camp = campaigns[campaignId];
            if (!camp.maps) return;

            if (Array.isArray(mapOrder)) {
                const validIds = mapOrder.filter((id) => camp.maps[id]);
                Object.keys(camp.maps).forEach((id) => {
                    if (!validIds.includes(id)) validIds.push(id);
                });
                camp.mapOrder = validIds;
            } else if (mapId && camp.maps[mapId]) {
                let currentOrder = Array.isArray(camp.mapOrder) ? [...camp.mapOrder] : Object.keys(camp.maps);
                currentOrder = currentOrder.filter((id) => id !== mapId && camp.maps[id]);
                if (targetMapId && camp.maps[targetMapId]) {
                    const targetIdx = currentOrder.indexOf(targetMapId);
                    if (targetIdx !== -1) {
                        const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
                        currentOrder.splice(insertIdx, 0, mapId);
                    } else {
                        currentOrder.push(mapId);
                    }
                } else {
                    currentOrder.push(mapId);
                }
                camp.mapOrder = currentOrder;
            }

            if (mapId && camp.maps[mapId] && folder !== undefined) {
                camp.maps[mapId].folder = folder;
            }

            saveCampaigns();
            broadcastCampaignSync(campaignId);
        });

        // Create a new map folder (GM only)
        socket.on('map:folder-create', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || socket.role !== 'GM') return;
            const folderName = (data?.folder || '').trim();
            if (!folderName || folderName === '__ALL__' || folderName === '__UNCATEGORIZED__') return;
            const camp = campaigns[campaignId];
            if (!camp.mapFolders) camp.mapFolders = [];
            if (!camp.mapFolders.includes(folderName)) {
                camp.mapFolders.push(folderName);
                camp.mapFolders.sort();
                saveCampaigns();
                broadcastCampaignSync(campaignId);
            }
        });

        // Rename a map folder (GM only)
        socket.on('map:folder-rename', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || socket.role !== 'GM') return;
            const oldFolder = (data?.oldFolder || '').trim();
            const newFolder = (data?.newFolder || '').trim();
            if (!oldFolder || !newFolder || oldFolder === newFolder) return;
            if (newFolder === '__ALL__' || newFolder === '__UNCATEGORIZED__') return;

            const camp = campaigns[campaignId];
            if (camp.mapFolders) {
                const idx = camp.mapFolders.indexOf(oldFolder);
                if (idx !== -1) {
                    camp.mapFolders[idx] = newFolder;
                    camp.mapFolders.sort();
                }
            }
            if (camp.maps) {
                Object.values(camp.maps).forEach((m) => {
                    if (m.folder === oldFolder) {
                        m.folder = newFolder;
                    }
                });
            }
            saveCampaigns();
            broadcastCampaignSync(campaignId);
        });

        // Delete a map folder (GM only)
        socket.on('map:folder-delete', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || socket.role !== 'GM') return;
            const folderName = (data?.folder || '').trim();
            const mode = data?.mode || 'uncategorize'; // 'uncategorize' or 'cascade'
            const camp = campaigns[campaignId];
            if (camp.mapFolders) {
                camp.mapFolders = camp.mapFolders.filter((f) => f !== folderName);
            }
            if (camp.maps) {
                if (mode === 'cascade') {
                    const mapsInFolder = Object.values(camp.maps).filter((m) => m.folder === folderName);
                    const remainingMapCount = Object.keys(camp.maps).length - mapsInFolder.length;
                    if (remainingMapCount < 1) {
                        socket.emit('error', 'Cannot delete folder and all maps: a campaign must retain at least one map.');
                        return;
                    }
                    mapsInFolder.forEach((m) => {
                        const mId = m.id;
                        delete camp.maps[mId];
                        if (camp.mapOrder) {
                            camp.mapOrder = camp.mapOrder.filter((id) => id !== mId);
                        }
                        if (camp.playerMapOverrides) {
                            Object.keys(camp.playerMapOverrides).forEach((u) => {
                                if (camp.playerMapOverrides[u] === mId) delete camp.playerMapOverrides[u];
                            });
                        }
                        if (camp.activeGMMapId === mId) camp.activeGMMapId = camp.activeMapId;
                    });
                } else {
                    Object.values(camp.maps).forEach((m) => {
                        if (m.folder === folderName) m.folder = '';
                    });
                }
            }
            saveCampaigns();
            broadcastCampaignSync(campaignId);
        });

        // Sync wall updates (GM only)
        socket.on('walls:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'walls', data.walls);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('walls:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                walls: data.walls
            });
        });

        // Dedicated door/window toggle handler (permitted for non-GMs when unlocked)
        socket.on('door:toggle', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || !data) return;

            const camp = campaigns[campaignId];
            const targetMapId =
                data.mapId ||
                (socket.role === 'GM'
                    ? camp.activeGMMapId || camp.activeMapId
                    : getPlayerMapOverride(camp, socket.username) || camp.activeMapId);

            const map = camp.maps?.[targetMapId];
            if (!map || !Array.isArray(map.walls)) return;

            // Find wall by wallId or wallIdx
            let targetWall = null;
            if (data.wallId) {
                targetWall = map.walls.find((w) => w && w.id === data.wallId);
            }
            if (!targetWall && typeof data.wallIdx === 'number' && map.walls[data.wallIdx]) {
                targetWall = map.walls[data.wallIdx];
            }
            if (!targetWall) return;

            // Validate that the wall is a door or window
            if (targetWall.type !== 'door' && targetWall.type !== 'window') return;

            // Locked doors can only be toggled by the GM
            if (targetWall.isLocked && socket.role !== 'GM') return;

            targetWall.isOpen = !targetWall.isOpen;
            saveCampaigns();

            io.to(campaignId).emit('walls:updated', {
                mapId: targetMapId,
                walls: map.walls
            });
        });

        socket.on('lights:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'lights', data.lights);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('lights:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                lights: data.lights
            });
        });

        socket.on('notes:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'notes', data.notes || []);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('notes:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                notes: data.notes || []
            });
        });

        socket.on('traps:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'traps', data.traps || []);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('traps:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                traps: data.traps || []
            });
        });

        socket.on('portals:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const targetMapId = updateMapProperty(campaigns, campaignId, data.mapId, 'portals', data.portals || []);
            if (targetMapId) saveCampaigns();

            io.to(campaignId).emit('portals:updated', {
                mapId: targetMapId || data.mapId || campaigns[campaignId].activeMapId,
                portals: data.portals || []
            });
        });

        socket.on('trap:trigger', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || !data) return;
            const camp = campaigns[campaignId];
            const mapId = data.mapId || camp.activeMapId;
            if (!camp.maps || !camp.maps[mapId] || !Array.isArray(camp.maps[mapId].traps)) return;

            const tr = camp.maps[mapId].traps.find((t) => t.id === data.trapId);
            if (!tr) {
                console.warn(
                    `[Security] Rejected trap trigger from ${socket.username}: trap ${data.trapId} not found on map ${mapId}`
                );
                return;
            }

            // Security check: non-GMs can only trigger traps with tokens they control
            let triggeringToken = null;
            if (data.tokenId && camp.maps[mapId].tokens) {
                triggeringToken = camp.maps[mapId].tokens[data.tokenId];
            }
            if (socket.role !== 'GM') {
                if (!triggeringToken || !isTokenControlledBySocket(triggeringToken, socket, camp)) {
                    console.warn(
                        `[Security] Unauthorized trap trigger attempt by ${socket.username} for token ${data.tokenId}`
                    );
                    return;
                }
            }

            tr.isRevealed = true;
            if (!tr.repeatTrigger) tr.isSpent = true;
            saveCampaigns();
            io.to(campaignId).emit('traps:updated', { mapId, traps: camp.maps[mapId].traps });

            const tokenName =
                (triggeringToken && triggeringToken.name) ||
                (typeof data.tokenName === 'string' ? data.tokenName.slice(0, 50) : 'A creature');
            const trapName = tr.name || 'A concealed trap';

            const chatMsg = {
                id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                username: 'SYSTEM',
                role: 'GM',
                text: `**TRAP TRIGGERED:** ${trapName}`,
                roll: data.damageRoll || null,
                trapCard: {
                    trapId: tr.id,
                    trapName: trapName,
                    tokenId: (triggeringToken && triggeringToken.id) || data.tokenId,
                    tokenName: tokenName,
                    saveAbility: tr.saveAbility || 'DEX',
                    saveDc: tr.saveDc || 15,
                    damage: tr.damage || '',
                    damageRoll: data.damageRoll || null,
                    flavor: tr.flavor || 'A concealed hazard is sprung upon entry!'
                },
                timestamp: Date.now(),
                hidden: false,
                whisperToGM: false
            };
            if (!chatLogs[campaignId]) chatLogs[campaignId] = [];
            chatLogs[campaignId].push(chatMsg);
            if (chatLogs[campaignId].length > 500) chatLogs[campaignId].shift();
            saveChat();
            io.to(campaignId).emit('chat:msg', chatMsg);
            io.to(campaignId).emit('trap:triggered', {
                ...data,
                trapName,
                tokenName,
                saveAbility: tr.saveAbility,
                saveDc: tr.saveDc,
                damage: tr.damage,
                flavor: tr.flavor
            });
        });

        // Helper to resolve player username for a token
        function resolveTokenPlayerUsername(camp, token) {
            if (!token) return null;
            if (token.owner) return token.owner;
            if (token.playerUsername) return token.playerUsername;
            if (token.characterId && camp.characters && camp.characters[token.characterId]) {
                const c = camp.characters[token.characterId];
                return c.player || c.username || c.owner || null;
            }
            return null;
        }

        function getPortalCenterPoint(portal) {
            if (!portal || !portal.geom) return null;
            const g = portal.geom;
            if (portal.shape === 'rect') {
                return { x: (g.x || 0) + (g.w || 50) / 2, y: (g.y || 0) + (g.h || 50) / 2 };
            } else if (portal.shape === 'circle') {
                return { x: g.cx || 0, y: g.cy || 0 };
            } else if (portal.shape === 'line') {
                return { x: ((g.x1 || 0) + (g.x2 || 0)) / 2, y: ((g.y1 || 0) + (g.y2 || 0)) / 2 };
            } else if (portal.shape === 'polygon' && Array.isArray(g.points) && g.points.length > 0) {
                const total = g.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
                return { x: total.x / g.points.length, y: total.y / g.points.length };
            }
            return null;
        }

        function validatePortalTransition(camp, sourceMap, targetMapId, token, targetPortalId, socket) {
            if (socket.role === 'GM') return true;
            // Token must be controlled by player
            if (!isTokenControlledBySocket(token, socket, camp)) {
                console.warn(
                    `[Security] Unauthorized portal teleport attempt by ${socket.username} for token ${token.id}`
                );
                return false;
            }
            // Must have a valid connecting portal on source map targeting targetMapId
            const portals = sourceMap.portals || [];
            const matchingPortal = portals.find((p) => {
                if (p.disabled || p.isLocked || p.locked) return false;
                const matchesMap = p.targetMapId === targetMapId;
                const matchesPortal = !targetPortalId || !p.targetPortalId || p.targetPortalId === targetPortalId;
                return matchesMap && matchesPortal;
            });
            if (!matchingPortal) {
                console.warn(
                    `[Security] Invalid portal teleport requested by ${socket.username}: no matching portal on map`
                );
                return false;
            }

            // Proximity check: token must be reasonably close to the portal (within 400px / ~8 grid cells)
            const pCenter = getPortalCenterPoint(matchingPortal);
            if (pCenter && typeof token.x === 'number' && typeof token.y === 'number') {
                const distSq =
                    (token.x - pCenter.x) * (token.x - pCenter.x) + (token.y - pCenter.y) * (token.y - pCenter.y);
                if (distSq > 400 * 400) {
                    console.warn(
                        `[Security] Portal teleport distance check failed for ${socket.username} on token ${token.id}`
                    );
                    return false;
                }
            }
            return true;
        }

        socket.on('portal:teleport_inter_map', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            const { sourceMapId, targetMapId, tokenId, targetX, targetY, username, targetPortalId } = data;
            const camp = campaigns[campaignId];
            if (!camp.maps || !camp.maps[sourceMapId] || !camp.maps[targetMapId]) return;

            const sourceMap = camp.maps[sourceMapId];
            const targetMap = camp.maps[targetMapId];
            if (sourceMap.tokens && sourceMap.tokens[tokenId]) {
                const token = sourceMap.tokens[tokenId];
                if (!validatePortalTransition(camp, sourceMap, targetMapId, token, targetPortalId, socket)) {
                    return;
                }

                delete sourceMap.tokens[tokenId];
                token.x = targetX;
                token.y = targetY;
                if (!targetMap.tokens) targetMap.tokens = {};
                targetMap.tokens[tokenId] = token;

                if (!camp.playerMapOverrides) camp.playerMapOverrides = {};
                const tokenOwner = resolveTokenPlayerUsername(camp, token);
                if (socket.role === 'GM') {
                    if (tokenOwner) {
                        camp.playerMapOverrides[tokenOwner] = targetMapId;
                    } else if (username && username !== 'GM') {
                        camp.playerMapOverrides[username] = targetMapId;
                    }
                } else if (socket.username) {
                    // Non-GM players can only override their own view
                    camp.playerMapOverrides[socket.username] = targetMapId;
                }

                saveCampaigns();
                broadcastCampaignSync(campaignId);
                io.to(campaignId).emit('token:deleted', { mapId: sourceMapId, tokenId, origin: socket.id });
                io.to(campaignId).emit('token:added', { mapId: targetMapId, tokenId, token, origin: socket.id });
                io.to(campaignId).emit('portal:teleported', {
                    tokenId,
                    tokenName: token.name || 'Token',
                    sourceMapId,
                    targetMapId,
                    targetPortalId: targetPortalId || null,
                    targetMapName: targetMap.name || 'New Map',
                    targetX,
                    targetY,
                    username: socket.role === 'GM' ? tokenOwner || username : socket.username
                });
            }
        });

        // Batch inter-map portal teleportation (multi-token transit)
        socket.on('portal:teleport_inter_map_batch', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            const { sourceMapId, targetMapId, targetPortalId, transitions } = data;
            if (!Array.isArray(transitions) || transitions.length === 0) return;
            const camp = campaigns[campaignId];
            if (!camp.maps || !camp.maps[sourceMapId] || !camp.maps[targetMapId]) return;

            const sourceMap = camp.maps[sourceMapId];
            const targetMap = camp.maps[targetMapId];
            if (!sourceMap.tokens) return;
            if (!targetMap.tokens) targetMap.tokens = {};
            if (!camp.playerMapOverrides) camp.playerMapOverrides = {};

            const movedTokens = [];
            const affectedOwners = new Set();

            transitions.forEach((tr) => {
                const { tokenId, targetX, targetY, username, targetPortalId: trPortalId } = tr;
                if (sourceMap.tokens[tokenId]) {
                    const token = sourceMap.tokens[tokenId];
                    if (
                        !validatePortalTransition(
                            camp,
                            sourceMap,
                            targetMapId,
                            token,
                            trPortalId || targetPortalId,
                            socket
                        )
                    ) {
                        return;
                    }

                    delete sourceMap.tokens[tokenId];
                    token.x = targetX;
                    token.y = targetY;
                    targetMap.tokens[tokenId] = token;

                    const owner = resolveTokenPlayerUsername(camp, token);
                    if (socket.role === 'GM') {
                        if (owner) {
                            camp.playerMapOverrides[owner] = targetMapId;
                            affectedOwners.add(owner);
                        } else if (username && username !== 'GM') {
                            camp.playerMapOverrides[username] = targetMapId;
                            affectedOwners.add(username);
                        }
                    } else if (socket.username) {
                        camp.playerMapOverrides[socket.username] = targetMapId;
                        affectedOwners.add(socket.username);
                    }

                    movedTokens.push({
                        tokenId,
                        token,
                        tokenName: token.name || 'Token',
                        targetPortalId: trPortalId || targetPortalId || null,
                        targetX,
                        targetY,
                        owner: socket.role === 'GM' ? owner || username : socket.username
                    });

                    io.to(campaignId).emit('token:deleted', { mapId: sourceMapId, tokenId, origin: socket.id });
                    io.to(campaignId).emit('token:added', { mapId: targetMapId, tokenId, token, origin: socket.id });
                }
            });

            if (movedTokens.length > 0) {
                saveCampaigns();
                broadcastCampaignSync(campaignId);
                io.to(campaignId).emit('portal:teleported_batch', {
                    sourceMapId,
                    targetMapId,
                    targetPortalId: targetPortalId || null,
                    targetMapName: targetMap.name || 'New Map',
                    tokens: movedTokens
                });
                // Also emit individual notifications for compatibility with toast banners
                movedTokens.forEach((mt) => {
                    io.to(campaignId).emit('portal:teleported', {
                        tokenId: mt.tokenId,
                        tokenName: mt.tokenName,
                        sourceMapId,
                        targetMapId,
                        targetPortalId: mt.targetPortalId || targetPortalId || null,
                        targetMapName: targetMap.name || 'New Map',
                        targetX: mt.targetX,
                        targetY: mt.targetY,
                        username: mt.owner || socket.username
                    });
                });
            }
        });

        // Sync combat initiative
        socket.on('initiative:update', (data) => {
            try {
                const { campaignId, role } = socket;
                if (!campaignId || !campaigns[campaignId] || !data || !data.initiative) return;
                const camp = campaigns[campaignId];

                if (role === 'GM') {
                    camp.initiative = data.initiative;
                } else {
                    const currentInit = camp.initiative || {
                        combatants: [],
                        currentRound: 1,
                        activeTurnIndex: -1,
                        isVisible: false
                    };
                    const existingCombatants = Array.isArray(currentInit.combatants) ? [...currentInit.combatants] : [];
                    const incomingCombatants = Array.isArray(data.initiative.combatants)
                        ? data.initiative.combatants
                        : [];

                    // Filter incoming combatants: players can only add/update combatants for characters/tokens they control
                    const allowedNewCombatants = incomingCombatants.filter((c) => {
                        if (!c || typeof c !== 'object') return false;
                        if (c.tokenId) {
                            for (const mId in camp.maps || {}) {
                                const tok = camp.maps[mId]?.tokens?.[c.tokenId];
                                if (tok && isTokenControlledBySocket(tok, socket, camp)) return true;
                            }
                        }
                        if (c.characterId && camp.characters?.[c.characterId]) {
                            return isCharacterControlledBySocket(camp.characters[c.characterId], socket);
                        }
                        // Fallback: check if combatant name matches any character controlled by the user
                        if (typeof c.name === 'string' && c.name.trim()) {
                            const cNameLower = c.name.trim().toLowerCase();
                            for (const charId in camp.characters || {}) {
                                const ch = camp.characters[charId];
                                if (ch && typeof ch.name === 'string' && ch.name.toLowerCase() === cNameLower) {
                                    if (isCharacterControlledBySocket(ch, socket)) return true;
                                }
                            }
                        }
                        return false;
                    });

                    // Helper to check if an existing combatant is controlled by this socket
                    const isExistingCombatantControlled = (ec) => {
                        if (!ec) return false;
                        if (ec.tokenId) {
                            for (const mId in camp.maps || {}) {
                                const tok = camp.maps[mId]?.tokens?.[ec.tokenId];
                                if (tok && isTokenControlledBySocket(tok, socket, camp)) return true;
                            }
                        }
                        if (ec.characterId && camp.characters?.[ec.characterId]) {
                            return isCharacterControlledBySocket(camp.characters[ec.characterId], socket);
                        }
                        if (typeof ec.name === 'string' && ec.name.trim()) {
                            const ecNameLower = ec.name.trim().toLowerCase();
                            for (const charId in camp.characters || {}) {
                                const ch = camp.characters[charId];
                                if (ch && typeof ch.name === 'string' && ch.name.toLowerCase() === ecNameLower) {
                                    if (isCharacterControlledBySocket(ch, socket)) return true;
                                }
                            }
                        }
                        return false;
                    };

                    // Upsert allowed combatants into existing combatants list without touching others
                    allowedNewCombatants.forEach((allowed) => {
                        if (typeof allowed.name === 'string') {
                            allowed.name = allowed.name.slice(0, 100);
                        }
                        const allowedNameLower = typeof allowed.name === 'string' ? allowed.name.toLowerCase() : null;

                        const matchIdx = existingCombatants.findIndex((ec) => {
                            if (!ec) return false;
                            const ecNameLower = typeof ec.name === 'string' ? ec.name.toLowerCase() : null;
                            const matchesId = allowed.id && ec.id === allowed.id;
                            const matchesToken = allowed.tokenId && ec.tokenId === allowed.tokenId;
                            const matchesName = allowedNameLower && ecNameLower && allowedNameLower === ecNameLower;
                            if (matchesId || matchesToken || matchesName) {
                                // CRITICAL: Only allow matching if the target combatant is also controlled by this player!
                                return isExistingCombatantControlled(ec);
                            }
                            return false;
                        });

                        if (matchIdx !== -1) {
                            const target = existingCombatants[matchIdx];
                            existingCombatants[matchIdx] = {
                                ...target,
                                ...allowed,
                                id: target.id,
                                tokenId: target.tokenId || allowed.tokenId,
                                characterId: target.characterId || allowed.characterId
                            };
                        } else {
                            existingCombatants.push(allowed);
                        }
                    });

                    // Sort descending
                    existingCombatants.sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0));

                    camp.initiative = {
                        ...currentInit,
                        combatants: existingCombatants
                    };
                }

                saveCampaigns();

                io.to(campaignId).emit('initiative:updated', { initiative: camp.initiative });
            } catch (err) {
                console.error('[Socket] Error handling initiative:update:', err);
            }
        });

        // Sync initiative settings (e.g. visibility toggle to players - GM only)
        socket.on('initiative:settings', (settings) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            if (settings && typeof settings.visible === 'boolean') {
                if (!campaigns[campaignId].initiative) {
                    campaigns[campaignId].initiative = {
                        combatants: [],
                        currentRound: 1,
                        activeTurnIndex: -1,
                        isVisible: false
                    };
                }
                campaigns[campaignId].initiative.isVisible = settings.visible;
                saveCampaigns();
            }

            io.to(campaignId).emit('initiative:settings', settings);
        });

        // Sync persistent shapes/effects
        socket.on('shapes:update', (data) => {
            const { campaignId, role, username } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            const camp = campaigns[campaignId];
            const targetMapId = data.mapId || camp.activeMapId;
            const currentMap = camp.maps?.[targetMapId];
            if (!currentMap) return;

            let finalShapes = data.shapes;
            if (role !== 'GM') {
                const existingShapes = currentMap.shapes || {};
                const mergedShapes = { ...existingShapes };
                const newShapes = data.shapes || {};

                for (const id in existingShapes) {
                    const s = existingShapes[id];
                    if (s && s.ownerUsername && s.ownerUsername.toLowerCase() === (username || '').toLowerCase()) {
                        if (!newShapes[id]) {
                            delete mergedShapes[id];
                        }
                    }
                }

                for (const id in newShapes) {
                    const s = newShapes[id];
                    const existing = existingShapes[id];
                    if (
                        existing &&
                        (!existing.ownerUsername ||
                            existing.ownerUsername.toLowerCase() !== (username || '').toLowerCase())
                    ) {
                        continue;
                    }
                    mergedShapes[id] = {
                        ...s,
                        ownerUsername: username
                    };
                }
                finalShapes = mergedShapes;
            }

            const savedMapId = updateMapProperty(campaigns, campaignId, targetMapId, 'shapes', finalShapes);
            if (savedMapId) saveCampaigns();

            io.to(campaignId).emit('shapes:updated', {
                mapId: savedMapId || targetMapId,
                shapes: finalShapes,
                origin: socket.id
            });
        });

        // Sync persistent drawings/paint objects
        socket.on('drawings:update', (data) => {
            const { campaignId, role, username } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            const camp = campaigns[campaignId];
            const targetMapId = data.mapId || camp.activeMapId;
            const currentMap = camp.maps?.[targetMapId];
            if (!currentMap) return;

            let finalDrawings = data.drawings;
            if (role !== 'GM') {
                const existingDrawings = currentMap.drawings || {};
                const mergedDrawings = { ...existingDrawings };
                const newDrawings = data.drawings || {};

                for (const id in existingDrawings) {
                    const d = existingDrawings[id];
                    if (d && d.ownerUsername && d.ownerUsername.toLowerCase() === (username || '').toLowerCase()) {
                        if (!newDrawings[id]) {
                            delete mergedDrawings[id];
                        }
                    }
                }

                for (const id in newDrawings) {
                    const d = newDrawings[id];
                    const existing = existingDrawings[id];
                    if (
                        existing &&
                        (!existing.ownerUsername ||
                            existing.ownerUsername.toLowerCase() !== (username || '').toLowerCase())
                    ) {
                        continue;
                    }
                    mergedDrawings[id] = {
                        ...d,
                        ownerUsername: username
                    };
                }
                finalDrawings = mergedDrawings;
            }

            const savedMapId = updateMapProperty(campaigns, campaignId, targetMapId, 'drawings', finalDrawings);
            if (savedMapId) saveCampaigns();

            io.to(campaignId).emit('drawings:updated', {
                mapId: savedMapId || targetMapId,
                drawings: finalDrawings,
                origin: socket.id
            });
        });

        // Sync HP bar visibilities & settings (GM only)
        socket.on('settings:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            campaigns[campaignId].settings = data.settings;
            saveCampaigns();

            io.to(campaignId).emit('settings:updated', { settings: data.settings });
        });

        // Create or update a character
        socket.on('character:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (!campaigns[campaignId].characters) campaigns[campaignId].characters = {};

            const charId = data.character?.id;
            if (!charId) return;

            if (socket.role !== 'GM') {
                const existing = campaigns[campaignId].characters[charId];
                if (existing) {
                    const isOwner = isCharacterControlledBySocket(existing, socket);
                    if (!isOwner) {
                        console.warn(
                            `[Security] Unauthorized character update attempt by ${socket.username} for character ${charId}`
                        );
                        return;
                    }
                } else {
                    data.character.owner = socket.username;
                    data.character.ownerUsername = socket.username;
                    if (!data.character.assignedPlayers) data.character.assignedPlayers = [socket.username];
                    if (!data.character.players) data.character.players = [socket.username];
                }
            }

            campaigns[campaignId].characters[charId] = data.character;
            saveCampaigns();

            // Broadcast update to everyone
            io.to(campaignId).emit('character:updated', { character: data.character, origin: socket.id });
        });

        // Delete a character
        socket.on('character:delete', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || !campaigns[campaignId].characters) return;

            const existing = campaigns[campaignId].characters[data.id];
            if (!existing) return;

            if (socket.role !== 'GM') {
                const isOwner = isCharacterControlledBySocket(existing, socket);
                if (!isOwner) {
                    console.warn(
                        `[Security] Unauthorized character delete attempt by ${socket.username} for character ${data.id}`
                    );
                    return;
                }
            }

            delete campaigns[campaignId].characters[data.id];
            saveCampaigns();

            // Broadcast delete to everyone (including sender)
            io.to(campaignId).emit('character:deleted', { id: data.id });
        });

        // Create a new map (GM only)
        socket.on('map:create', (data) => {
            const { campaignId } = socket;
            console.log(`[map:create] received - campaignId=${campaignId}, role=${socket.role}, name=${data?.name}`);
            if (!campaignId || !campaigns[campaignId]) {
                console.log(`[map:create] REJECTED: no campaignId or campaign not found`);
                return;
            }
            if (socket.role !== 'GM') {
                console.log(`[map:create] REJECTED: socket.role is "${socket.role}", expected "GM"`);
                return;
            }

            const mapId = `map_${campaignId}_${Date.now()}`;
            const newMap = {
                id: mapId,
                name: data.name || 'Unnamed Map',
                folder: (data.folder || '').trim(),
                mapImage: data.mapImage || '',
                thumbnail: data.thumbnail || data.mapImage || '',
                gridWidth: data.gridWidth,
                gridHeight: data.gridHeight,
                grid: data.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5, type: 'square' },
                tokens: data.tokens || {},
                walls: data.walls || [],
                notes: data.notes || [],
                lights: data.lights || [],
                shapes: data.shapes || {},
                drawings: data.drawings || {},
                traps: data.traps || [],
                portals: data.portals || []
            };

            if (!campaigns[campaignId].maps) campaigns[campaignId].maps = {};
            campaigns[campaignId].maps[mapId] = newMap;
            if (!campaigns[campaignId].mapOrder)
                campaigns[campaignId].mapOrder = Object.keys(campaigns[campaignId].maps).filter((id) => id !== mapId);
            if (!campaigns[campaignId].mapOrder.includes(mapId)) campaigns[campaignId].mapOrder.push(mapId);
            campaigns[campaignId].activeGMMapId = mapId; // GM previews new map instantly
            saveCampaigns();

            console.log(
                `[map:create] SUCCESS: created map "${newMap.name}" (${mapId}), broadcasting campaign:state-sync to room ${campaignId}`
            );
            broadcastCampaignSync(campaignId);
        });

        // Bulk create multiple maps in a single transaction without switching GM active map (GM only)
        socket.on('map:bulk-create', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || socket.role !== 'GM') return;
            const mapList = Array.isArray(data?.maps) ? data.maps : [];
            if (mapList.length === 0) return;

            const camp = campaigns[campaignId];
            if (!camp.maps) camp.maps = {};
            if (!camp.mapOrder) camp.mapOrder = Object.keys(camp.maps);

            const targetFolder = (data?.targetFolder || '').trim();
            if (targetFolder && targetFolder !== '__ALL__' && targetFolder !== '__UNCATEGORIZED__') {
                if (!camp.mapFolders) camp.mapFolders = [];
                if (!camp.mapFolders.includes(targetFolder)) {
                    camp.mapFolders.push(targetFolder);
                    camp.mapFolders.sort();
                }
            }

            mapList.forEach((m, idx) => {
                const mapId = `map_${campaignId}_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
                const newMap = {
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
                camp.maps[mapId] = newMap;
                if (!camp.mapOrder.includes(mapId)) {
                    camp.mapOrder.push(mapId);
                }
            });

            saveCampaigns();
            console.log(`[map:bulk-create] SUCCESS: created ${mapList.length} maps in room ${campaignId}`);
            broadcastCampaignSync(campaignId);
        });

        // Duplicate an existing map (GM only)
        socket.on('map:duplicate', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const { mapId } = data || {};
            const sourceMap = campaigns[campaignId].maps?.[mapId];
            if (!sourceMap) return;

            const newMapId = `map_${campaignId}_${Date.now()}`;
            const cloned = JSON.parse(JSON.stringify(sourceMap));
            cloned.id = newMapId;
            cloned.name = `${sourceMap.name || 'Map'} (Copy)`;

            // Ensure cloned tokens have new IDs if needed so token state is independent
            if (cloned.tokens && typeof cloned.tokens === 'object') {
                const remappedTokens = {};
                for (const [tId, tVal] of Object.entries(cloned.tokens)) {
                    const newTId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                    remappedTokens[newTId] = { ...tVal, id: newTId };
                }
                cloned.tokens = remappedTokens;
            }

            // Remap portals, traps, lights IDs and unlink cross-map portal links
            if (Array.isArray(cloned.portals)) {
                cloned.portals = cloned.portals.map((p) => ({
                    ...p,
                    id: `portal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    targetPortalId: null
                }));
            }
            if (Array.isArray(cloned.traps)) {
                cloned.traps = cloned.traps.map((tr) => ({
                    ...tr,
                    id: `trap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
                }));
            }
            if (Array.isArray(cloned.lights)) {
                cloned.lights = cloned.lights.map((l) => ({
                    ...l,
                    id: `light_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
                }));
            }

            campaigns[campaignId].maps[newMapId] = cloned;
            if (!campaigns[campaignId].mapOrder)
                campaigns[campaignId].mapOrder = Object.keys(campaigns[campaignId].maps).filter(
                    (id) => id !== newMapId
                );
            const srcIdx = campaigns[campaignId].mapOrder.indexOf(mapId);
            if (srcIdx !== -1) {
                campaigns[campaignId].mapOrder.splice(srcIdx + 1, 0, newMapId);
            } else {
                campaigns[campaignId].mapOrder.push(newMapId);
            }
            saveCampaigns();
            console.log(
                `[map:duplicate] SUCCESS: duplicated map "${sourceMap.name}" into "${cloned.name}" (${newMapId})`
            );
            broadcastCampaignSync(campaignId);
        });

        // Rename a map (GM only)
        socket.on('map:rename', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const { mapId, name } = data;
            if (campaigns[campaignId].maps && campaigns[campaignId].maps[mapId]) {
                campaigns[campaignId].maps[mapId].name = name;
                saveCampaigns();
            }

            broadcastCampaignSync(campaignId);
        });

        // Delete a map (GM only)
        socket.on('map:delete', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const { mapId } = data || {};
            const camp = campaigns[campaignId];
            if (camp.maps && camp.maps[mapId]) {
                // Safeguard 1: Disallow deleting the only remaining map
                if (Object.keys(camp.maps).length <= 1) {
                    socket.emit(
                        'error',
                        'Cannot delete the only map in the campaign. A campaign must retain at least one map.'
                    );
                    return;
                }

                // Safeguard 2: Check active connected player sockets in this campaign room
                const room = io.sockets.adapter.rooms.get(campaignId);
                let activeConnectedViewing = false;
                if (room) {
                    for (const sId of room) {
                        const s = io.sockets.sockets.get(sId);
                        if (s && s.role !== 'GM') {
                            const effectivePlayerMap = getPlayerMapOverride(camp, s.username) || camp.activeMapId;
                            if (effectivePlayerMap === mapId) {
                                activeConnectedViewing = true;
                                break;
                            }
                        }
                    }
                }

                if (activeConnectedViewing || (camp.activeMapId === mapId && room && room.size > 1)) {
                    socket.emit(
                        'error',
                        'Cannot delete map while players are actively viewing it. Move players to another map first.'
                    );
                    return;
                }

                // Auto-prune offline player overrides that were mapped to this map
                if (camp.playerMapOverrides) {
                    for (const [user, targetId] of Object.entries(camp.playerMapOverrides)) {
                        if (targetId === mapId) {
                            delete camp.playerMapOverrides[user];
                        }
                    }
                }

                delete camp.maps[mapId];
                if (camp.mapOrder) {
                    camp.mapOrder = camp.mapOrder.filter((id) => id !== mapId);
                }
                const remainingMapIds = Object.keys(camp.maps);
                if (camp.activeMapId === mapId) {
                    camp.activeMapId = remainingMapIds[0];
                }
                if (camp.activeGMMapId === mapId) {
                    camp.activeGMMapId = camp.activeMapId;
                }
                saveCampaigns();
            }

            broadcastCampaignSync(campaignId);
        });

        // GM switches local viewed map (GM only)
        const handleMapSwitchGm = (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const { mapId } = data || {};
            const camp = campaigns[campaignId];
            if (camp.maps && camp.maps[mapId]) {
                camp.activeGMMapId = mapId;
                saveCampaigns();
            }

            socket.emit('campaign:state-sync', getSanitizedCampaignSync(camp, socket.role, socket.username, campaignId));
        };
        socket.on('map:switch-gm', handleMapSwitchGm);
        socket.on('map:switch', handleMapSwitchGm); // Backwards-compatibility alias

        // Player switches map (e.g. via token locator to jump to a map where they control a token)
        const handleMapSwitchPlayer = (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;

            const { mapId } = data || {};
            const camp = campaigns[campaignId];
            if (!camp.maps || !camp.maps[mapId]) return;

            // Security check: If not GM, ensure player controls at least one token on target map
            if (socket.role !== 'GM') {
                const targetTokens = camp.maps[mapId].tokens || {};
                const controlsToken = Object.values(targetTokens).some((tok) =>
                    isTokenControlledBySocket(tok, socket, camp)
                );
                if (!controlsToken) {
                    console.warn(`[Security] Player ${socket.username} attempted unauthorized map switch to ${mapId}`);
                    return;
                }
            }

            if (!camp.playerMapOverrides) camp.playerMapOverrides = {};
            camp.playerMapOverrides[socket.username] = mapId;
            saveCampaigns();

            broadcastCampaignSync(campaignId);
        };
        socket.on('map:switch-player', handleMapSwitchPlayer);
        socket.on('player:map_override', handleMapSwitchPlayer); // Backwards-compatibility alias

        // Client updates campaign settings/activeGMMapId
        socket.on('campaign:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const camp = campaigns[campaignId];
            if (data.activeGMMapId && camp.maps && camp.maps[data.activeGMMapId]) {
                camp.activeGMMapId = data.activeGMMapId;
                saveCampaigns();
                socket.emit('campaign:state-sync', getSanitizedCampaignSync(camp, socket.role, socket.username, campaignId));
            }
        });

        // Activate map for players (GM only)
        socket.on('map:activate-players', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            if (socket.role !== 'GM') return;

            const { mapId, targetPlayers } = data; // targetPlayers = array of usernames, or 'all', or undefined
            const camp = campaigns[campaignId];
            if (camp.maps && camp.maps[mapId]) {
                const isAll =
                    !targetPlayers ||
                    targetPlayers === 'all' ||
                    (Array.isArray(targetPlayers) &&
                        camp.knownPlayers &&
                        camp.knownPlayers.length > 0 &&
                        camp.knownPlayers.every((p) => targetPlayers.includes(p)));

                if (isAll) {
                    camp.activeMapId = mapId;
                    camp.activeGMMapId = mapId;
                    camp.playerMapOverrides = {};
                } else {
                    if (!camp.playerMapOverrides) camp.playerMapOverrides = {};

                    // Push specific players without carrying token state between maps.
                    targetPlayers.forEach((p) => {
                        camp.playerMapOverrides[p] = mapId;
                    });
                }

                saveCampaigns();

                // Direct fast-path notification for instantaneous player & GM reaction
                io.to(campaignId).emit('map:activated', {
                    mapId,
                    mapName: camp.maps[mapId]?.name || 'Map',
                    targetPlayers: isAll ? 'all' : targetPlayers,
                    activeMapId: camp.activeMapId,
                    activeGMMapId: camp.activeGMMapId
                });
            }

            broadcastCampaignSync(campaignId);
        });

        // Client requests full data for a specific map
        socket.on('map:request_sync', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId]) return;
            const targetMapId =
                data?.mapId ||
                (socket.role === 'GM'
                    ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                    : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                    campaigns[campaignId].activeMapId);
            if (campaigns[campaignId].maps && campaigns[campaignId].maps[targetMapId]) {
                socket.emit('map:full_data', { mapId: targetMapId, map: campaigns[campaignId].maps[targetMapId] });
            }
        });

        // Client requests full token data (e.g. self-healing on incomplete delta or layer transition)
        socket.on('token:request_sync', (data) => {
            const { campaignId } = socket;
            if (!campaignId || !campaigns[campaignId] || !data?.tokenId) return;
            let targetMapId =
                data.mapId ||
                (socket.role === 'GM'
                    ? campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId
                    : getPlayerMapOverride(campaigns[campaignId], socket.username) ||
                    campaigns[campaignId].activeMapId);

            let token = campaigns[campaignId].maps?.[targetMapId]?.tokens?.[data.tokenId];
            if (!token && campaigns[campaignId].maps) {
                for (const mId in campaigns[campaignId].maps) {
                    if (campaigns[campaignId].maps[mId]?.tokens?.[data.tokenId]) {
                        targetMapId = mId;
                        token = campaigns[campaignId].maps[mId].tokens[data.tokenId];
                        break;
                    }
                }
            }

            if (token) {
                const isVisible =
                    socket.role === 'GM' || (token.layer !== 'gm' && token.isVisible !== false && !token.hidden);
                if (isVisible) {
                    const cloned = JSON.parse(JSON.stringify(token));
                    if (!cloned.id) cloned.id = data.tokenId;
                    socket.emit('token:added', {
                        mapId: targetMapId,
                        tokenId: data.tokenId,
                        token: cloned,
                        origin: 'server_sync'
                    });
                }
            }
        });

        // Sync chat message & dice rolls
        socket.on('chat:msg', (msg) => {
            const { campaignId } = socket;
            if (!campaignId) return;

            const stripTags = (val) => {
                if (val === undefined || val === null) return val;
                if (typeof val === 'number' || typeof val === 'boolean') return val;
                return String(val).replace(/<[^>]*>/g, '');
            };

            const safeMsg = msg && typeof msg === 'object' ? msg : {};
            let cleanRoll = safeMsg.roll;
            if (cleanRoll && typeof cleanRoll === 'object') {
                cleanRoll = {
                    ...cleanRoll,
                    total: typeof cleanRoll.total === 'number' ? cleanRoll.total : stripTags(cleanRoll.total),
                    formula: stripTags(cleanRoll.formula),
                    breakdownStr: stripTags(cleanRoll.breakdownStr),
                    compactBreakdown: stripTags(cleanRoll.compactBreakdown)
                };
            }

            let cleanMacro = safeMsg.macroCard;
            if (cleanMacro && typeof cleanMacro === 'object') {
                cleanMacro = {
                    ...cleanMacro,
                    charName: stripTags(cleanMacro.charName),
                    macroName: stripTags(cleanMacro.macroName),
                    saveDc: stripTags(cleanMacro.saveDc),
                    saveAbility: stripTags(cleanMacro.saveAbility),
                    dmgRolls: Array.isArray(cleanMacro.dmgRolls)
                        ? cleanMacro.dmgRolls.map((dr) => ({
                            ...dr,
                            type: stripTags(dr.type),
                            label: stripTags(dr.label),
                            formula: stripTags(dr.formula)
                        }))
                        : cleanMacro.dmgRolls
                };
            }

            const chatMsg = {
                id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                username: socket.username,
                role: socket.role,
                text: safeMsg.text,
                roll: cleanRoll || null,
                abilityCard: safeMsg.abilityCard || null,
                macroCard: cleanMacro || null,
                itemCard: safeMsg.itemCard || null,
                saveResolveCard: safeMsg.saveResolveCard || null,
                massAttackCard: safeMsg.massAttackCard || null,
                timestamp: Date.now(),
                hidden: false,
                whisperToGM: safeMsg.whisperToGM || false,
                whisperTo: safeMsg.whisperTo ? stripTags(safeMsg.whisperTo) : null
            };

            if (!chatLogs[campaignId]) chatLogs[campaignId] = [];
            chatLogs[campaignId].push(chatMsg);
            // Keep chat history capped
            if (chatLogs[campaignId].length > 500) chatLogs[campaignId].shift();
            if (chatMsg.whisperToGM) {
                socket.emit('chat:msg', chatMsg);
                const room = io.sockets.adapter.rooms.get(campaignId);
                if (room) {
                    for (const sId of room) {
                        const clientSocket = io.sockets.sockets.get(sId);
                        if (clientSocket && clientSocket.role === 'GM' && clientSocket.id !== socket.id) {
                            clientSocket.emit('chat:msg', chatMsg);
                        }
                    }
                }
            } else if (chatMsg.whisperTo) {
                // Targeted player whisper: delivered to sender, recipient, and table GM
                socket.emit('chat:msg', chatMsg);
                const targetLower = String(chatMsg.whisperTo).toLowerCase().trim();
                const room = io.sockets.adapter.rooms.get(campaignId);
                if (room) {
                    for (const sId of room) {
                        const clientSocket = io.sockets.sockets.get(sId);
                        if (!clientSocket || clientSocket.id === socket.id) continue;
                        const uMatch = (clientSocket.username || '').toLowerCase().trim() === targetLower;
                        const isGm = clientSocket.role === 'GM';
                        if (uMatch || isGm) {
                            clientSocket.emit('chat:msg', chatMsg);
                        }
                    }
                }
            } else {
                io.to(campaignId).emit('chat:msg', chatMsg);
            }
            saveChat();
        });

        // Resolve save resolution card in chat (GM only)
        socket.on('chat:save_resolved', (data) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM' || !data || !data.id) return;
            if (chatLogs[campaignId]) {
                const msg = chatLogs[campaignId].find((m) => m.id === data.id);
                if (msg && msg.saveResolveCard) {
                    msg.saveResolveCard.resolved = data.resolution;
                    if (data.results) {
                        msg.saveResolveCard.results = data.results;
                    }
                    saveChat();
                    io.to(campaignId).emit('chat:save_resolved', data);
                }
            }
        });

        // Resolve mass attack card in chat (GM only)
        socket.on('chat:mass_attack_resolved', (data) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM' || !data || !data.id) return;
            if (chatLogs[campaignId]) {
                const msg = chatLogs[campaignId].find((m) => m.id === data.id);
                if (msg && msg.massAttackCard) {
                    msg.massAttackCard.resolved = data.resolution || true;
                    if (data.attacks) {
                        msg.massAttackCard.attacks = data.attacks;
                    }
                    if (data.summary) {
                        msg.massAttackCard.summary = data.summary;
                    }
                    saveChat();
                    io.to(campaignId).emit('chat:mass_attack_resolved', data);
                }
            }
        });

        // Resolve macro card in chat (GM only)
        socket.on('chat:macro_resolved', (data) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM' || !data || !data.id) return;
            if (chatLogs[campaignId]) {
                const msg = chatLogs[campaignId].find((m) => m.id === data.id);
                if (msg && msg.macroCard) {
                    msg.macroCard.resolved = data.resolution || true;
                    if (data.results) {
                        msg.macroCard.results = data.results;
                    }
                    if (data.summary) {
                        msg.macroCard.summary = data.summary;
                    }
                    saveChat();
                    io.to(campaignId).emit('chat:macro_resolved', data);
                }
            }
        });

        // Delete chat message (GM only)
        socket.on('chat:delete', (msgId) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM') return;
            if (chatLogs[campaignId]) {
                chatLogs[campaignId] = chatLogs[campaignId].filter((m) => m.id !== msgId);
                saveChat();
                io.to(campaignId).emit('chat:deleted', { id: msgId });
            }
        });

        // Hide chat message (GM only)
        socket.on('chat:hide', (msgId) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM') return;
            if (chatLogs[campaignId]) {
                const msg = chatLogs[campaignId].find((m) => m.id === msgId);
                if (msg) {
                    msg.hidden = !msg.hidden;
                    saveChat();
                    io.to(campaignId).emit('chat:hidden_toggled', { id: msgId, hidden: msg.hidden });
                }
            }
        });

        // Private whisper (GM-only creature sheet rolls) — sent only back to the sender
        socket.on('chat:whisper', (msg) => {
            const whisperMsg = {
                username: socket.username,
                role: socket.role,
                text: msg.text,
                roll: msg.roll || null,
                macroCard: msg.macroCard || null,
                spellCard: msg.spellCard || null,
                abilityCard: msg.abilityCard || null,
                itemCard: msg.itemCard || null,
                saveResolveCard: msg.saveResolveCard || null,
                massAttackCard: msg.massAttackCard || null,
                timestamp: Date.now()
            };
            // Send only to the requesting socket (GM sees it privately)
            socket.emit('chat:whisper', whisperMsg);
        });

        // Sync map ping event
        socket.on('map:ping', (data) => {
            const { campaignId } = socket;
            if (!campaignId) return;
            socket.to(campaignId).emit('map:pinged', {
                x: data.x,
                y: data.y,
                username: socket.username,
                role: socket.role
            });
        });

        // Sync map pan event (GM only)
        socket.on('map:panTo', (data) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM') return;
            socket.to(campaignId).emit('map:pannedTo', {
                mapId: data.mapId,
                x: data.x,
                y: data.y,
                zoom: data.zoom
            });
        });

        // Sync atmospheric theme broadcast (GM only)
        socket.on('theme:broadcast', (data) => {
            const { campaignId } = socket;
            if (!campaignId || socket.role !== 'GM') return;
            socket.to(campaignId).emit('theme:broadcasted', {
                themeId: data.themeId,
                gmName: socket.username || 'GM'
            });
        });

        // Sync real-time shape measurement drawing
        socket.on('measure:update', (data) => {
            const { campaignId } = socket;
            if (!campaignId) return;
            socket.to(campaignId).emit('measure:updated', {
                ...data,
                socketId: socket.id,
                username: socket.username,
                role: socket.role
            });
        });

        socket.on('measure:clear', () => {
            const { campaignId } = socket;
            if (!campaignId) return;
            socket.to(campaignId).emit('measure:cleared', {
                socketId: socket.id
            });
        });

        // Sync token force select event (player forces GM to select token)
        socket.on('token:force_select_gm', (data) => {
            const { campaignId } = socket;
            if (!campaignId) return;
            socket.to(campaignId).emit('token:force_selected_gm', {
                tokenId: data.tokenId,
                username: socket.username
            });
        });

        // Sync damage visual FX across all clients
        socket.on('tokens:damage_fx', (data) => {
            const { campaignId } = socket;
            if (!campaignId) return;
            io.to(campaignId).emit('tokens:damage_fx', data);
        });

        socket.on('disconnect', () => {
            if (socket.gmSessionToken) {
                // Grace period: allow 60s for transient network reconnects before invalidating GM token
                const tokenToPurge = socket.gmSessionToken;
                setTimeout(() => {
                    activeGmTokens.delete(tokenToPurge);
                }, 60000);
            }
            console.log(`User disconnected: ${socket.id}${socket.isSubWindow ? ' (Sub-Window)' : ''}`);
            if (socket.campaignId && socket.username && !socket.isSubWindow) {
                socket.to(socket.campaignId).emit('sys_message', {
                    text: `${socket.username} has left the game.`,
                    timestamp: Date.now()
                });
                broadcastCampaignSync(socket.campaignId);
            }
        });
    });
}
