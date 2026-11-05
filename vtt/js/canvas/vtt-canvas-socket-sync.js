/**
 * vtt-canvas-socket-sync.js
 * Real-time websocket synchronizer for campaign state, token positions,
 * dynamic lighting, fog of war, persistent shapes, annotations, and visual effects.
 */

export function setupSocketSync(ctx = {}) {
    const vtt = ctx.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    const socket = vtt?.socket;
    if (!socket) {
        return;
    }

    socket.on('campaign:state-sync', (camp) => {
        console.log(
            '[campaign:state-sync] received, maps count:',
            camp?.maps ? Object.keys(camp.maps).length : 0,
            'activeGMMapId:',
            camp?.activeGMMapId
        );
        function getPlayerMapOverride(campaign, uName) {
            if (!campaign?.playerMapOverrides || !uName) return null;
            if (campaign.playerMapOverrides[uName]) return campaign.playerMapOverrides[uName];
            const uLower = String(uName).toLowerCase();
            for (const key in campaign.playerMapOverrides) {
                if (key.toLowerCase() === uLower) return campaign.playerMapOverrides[key];
            }
            return null;
        }

        vtt.campaignState = camp;
        const targetMapId =
            vtt.role === 'GM'
                ? camp.activeGMMapId || camp.activeMapId
                : getPlayerMapOverride(camp, vtt.username) || camp.activeMapId;

        if (targetMapId !== ctx.currentMapId) {
            // Switching to a new map: full map load
            ctx.loadMap(targetMapId, false);
        } else {
            // Already on the current map: non-destructive merge to protect active drags, selections & measurements
            const mapData = camp?.maps?.[ctx.currentMapId];
            if (mapData) {
                if (vtt.weatherEngine) {
                    vtt.weatherEngine.setWeather(mapData.weather);
                }
                ctx.traps = Array.isArray(mapData.traps) ? mapData.traps : [];
                ctx.portals = Array.isArray(mapData.portals) ? mapData.portals : [];
                ctx.lights = mapData.lights || [];
                ctx.notes = mapData.notes || [];
                ctx.walls = mapData.walls || [];
                ctx.shapes = mapData.shapes || {};
                ctx.drawings = mapData.drawings || {};

                const serverTokens = mapData.tokens || {};
                const currentTokens = ctx.tokens || {};

                for (const id in serverTokens) {
                    if (id === ctx.dragTargetId && currentTokens[id]) {
                        continue; // Preserve actively dragged token coordinates
                    }
                    const sTok = serverTokens[id];
                    if (currentTokens[id]) {
                        const lock = currentTokens[id]._portalTransitLock;
                        Object.assign(currentTokens[id], sTok);
                        if (lock && Date.now() < lock) currentTokens[id]._portalTransitLock = lock;
                    } else {
                        currentTokens[id] = JSON.parse(JSON.stringify(sTok));
                    }
                }

                for (const id in currentTokens) {
                    const t = currentTokens[id];
                    if (t && (t.layer === 'map' || t.isBackground) && t.isAsset) continue;
                    if (id === ctx.dragTargetId) continue;
                    if (!serverTokens[id]) {
                        delete currentTokens[id];
                        if (ctx.selectedTokenIds.has(id)) ctx.selectedTokenIds.delete(id);
                        if (ctx.selectedTokenId === id) ctx.selectedTokenId = null;
                    }
                }

                ctx.tokens = currentTokens;
                ctx.lastBroadcastedTokens = JSON.parse(JSON.stringify(ctx.tokens));
                ctx.renderAll();
            }
        }

        // Refresh map manager grid if it is open and map data actually changed
        const mapModal = document.getElementById('modal-upload-map');
        const isModalOpen = mapModal && !mapModal.classList.contains('vtt-hidden');
        if (isModalOpen && typeof ctx.hasMapManagerDataChanged === 'function') {
            const newFp = ctx.hasMapManagerDataChanged(vtt.campaignState, ctx._lastMapManagerFingerprint || '');
            if (newFp) {
                ctx._lastMapManagerFingerprint = newFp;
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => ctx.renderMapGrid());
                } else {
                    ctx.renderMapGrid();
                }
            }
        }

        ctx.updatePreviewBanner();
        if (typeof vtt.refreshLocatorPanel === 'function') {
            vtt.refreshLocatorPanel();
        }
    });

    // Fast-path immediate notification for party/player map activation
    socket.on('map:activated', (data) => {
        if (!data || !data.mapId) return;
        const { mapId, mapName, targetPlayers, activeMapId, activeGMMapId } = data;
        if (vtt.campaignState) {
            if (activeMapId) vtt.campaignState.activeMapId = activeMapId;
            if (activeGMMapId) vtt.campaignState.activeGMMapId = activeGMMapId;
            if (targetPlayers === 'all') {
                vtt.campaignState.playerMapOverrides = {};
            } else if (Array.isArray(targetPlayers)) {
                if (!vtt.campaignState.playerMapOverrides) vtt.campaignState.playerMapOverrides = {};
                targetPlayers.forEach((p) => {
                    vtt.campaignState.playerMapOverrides[p] = mapId;
                });
            }
        }

        const isTargeted =
            vtt.role === 'GM' ||
            !targetPlayers ||
            targetPlayers === 'all' ||
            (Array.isArray(targetPlayers) &&
                targetPlayers.some((p) => String(p).toLowerCase() === String(vtt.username || '').toLowerCase()));

        if (isTargeted) {
            if (vtt.role !== 'GM' && typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                JqueryUtil.doToast({
                    content: `<i class="fa-solid fa-bullhorn" style="color: var(--color-gold-light); margin-right: 6px;"></i> GM transitioned party to <strong>${mapName || 'New Map'}</strong>`,
                    type: 'info'
                });
            }

            if (mapId !== ctx.currentMapId) {
                ctx.loadMap(mapId, false);
                if (typeof socket?.emit === 'function') {
                    socket.emit('map:request_sync', { mapId });
                }
            }
        }

        // Refresh Map Manager grid if open
        const mapModal = document.getElementById('modal-upload-map');
        const isModalOpen = mapModal && !mapModal.classList.contains('vtt-hidden');
        if (isModalOpen && typeof ctx.renderMapGrid === 'function') {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => ctx.renderMapGrid());
            } else {
                ctx.renderMapGrid();
            }
        }

        ctx.updatePreviewBanner();
        if (typeof vtt.refreshLocatorPanel === 'function') {
            vtt.refreshLocatorPanel();
        }
    });

    socket.on('map:full_data', (data) => {
        if (!data || !data.mapId || !data.map) return;
        if (vtt.campaignState && vtt.campaignState.maps) {
            vtt.campaignState.maps[data.mapId] = data.map;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.loadMap(data.mapId, true);
        }
    });

    socket.on('token:updated', (data) => {
        if (data.origin === vtt.socket.id) return;
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            if (vtt.role === 'GM') {
                const existingTokens = vtt.campaignState.maps[data.mapId].tokens || {};
                const merged = { ...data.tokens };
                for (const id in existingTokens) {
                    if (existingTokens[id]?.layer === 'gm' && !(id in merged)) {
                        merged[id] = existingTokens[id];
                    }
                }
                vtt.campaignState.maps[data.mapId].tokens = merged;
            } else {
                vtt.campaignState.maps[data.mapId].tokens = data.tokens;
            }
        }
        if (data.mapId === ctx.currentMapId) {
            const incoming = data.tokens || {};
            for (const id in incoming) {
                const isBeingDragged = id === ctx.dragTargetId || (ctx.dragTargetId && ctx.selectedTokenIds?.has(id));
                if (isBeingDragged && ctx.tokens[id]) continue;
                ctx.tokens[id] = incoming[id];
            }
            for (const id in ctx.tokens) {
                const t = ctx.tokens[id];
                if (t && (t.layer === 'map' || t.isBackground) && t.isAsset) continue;
                // Guard: Never delete GM layer ctx.tokens for GM client on token:updated
                if (vtt.role === 'GM' && t && t.layer === 'gm') continue;
                const isBeingDragged = id === ctx.dragTargetId || (ctx.dragTargetId && ctx.selectedTokenIds?.has(id));
                if (isBeingDragged) continue;
                if (!incoming[id]) {
                    delete ctx.tokens[id];
                    if (ctx.selectedTokenIds.has(id)) ctx.selectedTokenIds.delete(id);
                    if (ctx.selectedTokenId === id) ctx.selectedTokenId = null;
                }
            }
            ctx.lastBroadcastedTokens = JSON.parse(JSON.stringify(ctx.tokens));
            ctx.processTokenAnimReqs(ctx.tokens);
            ctx.renderAll();
            if (window.VTT?.chatEngine?.refreshInitiative) window.VTT.chatEngine.refreshInitiative();
        }
    });

    socket.on('token:added', (data) => {
        if (data?.origin && vtt?.socket?.id && data.origin === vtt.socket.id) return;
        if (!data || !data.token) return;
        const tokenId = data.tokenId || data.token.id;
        if (!tokenId) return;
        if (!data.token.id) data.token.id = tokenId;

        // Security check: Never accept GM-layer or hidden tokens on player client
        if (vtt.role !== 'GM' && (data.token.layer === 'gm' || data.token.isVisible === false || data.token.hidden)) {
            return;
        }

        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            if (!vtt.campaignState.maps[data.mapId].tokens) vtt.campaignState.maps[data.mapId].tokens = {};
            vtt.campaignState.maps[data.mapId].tokens[tokenId] = data.token;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.tokens[tokenId] = data.token;
            if (ctx.lastBroadcastedTokens) {
                ctx.lastBroadcastedTokens[tokenId] = JSON.parse(JSON.stringify(data.token));
            }
            delete data.token._polyCache;
            delete data.token._losPolyCache;

            if (typeof document !== 'undefined') {
                const offNode = document.getElementById('asset_node_' + tokenId);
                if (offNode && offNode.style.display === 'none') {
                    offNode.style.display = 'block';
                }
                const offUiNode = document.getElementById('token_ui_' + tokenId);
                if (offUiNode && offUiNode.style.display === 'none') {
                    offUiNode.style.display = 'block';
                }
            }

            if (typeof ctx.processTokenAnimReqs === 'function') {
                ctx.processTokenAnimReqs(ctx.tokens);
            }
            ctx.renderAll();
            if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                window.VTT.chatEngine.refreshInitiative();
            }
        }
        if (typeof vtt.refreshLocatorPanel === 'function') vtt.refreshLocatorPanel();
    });

    socket.on('token:updated_delta', (data) => {
        if (data?.origin && vtt?.socket?.id && data.origin === vtt.socket.id) return;
        if (!data || !data.changes) return;
        const tokenId = data.tokenId;
        if (!tokenId) return;

        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            if (!vtt.campaignState.maps[data.mapId].tokens) vtt.campaignState.maps[data.mapId].tokens = {};
            const mapTokens = vtt.campaignState.maps[data.mapId].tokens;
            if (mapTokens[tokenId]) {
                Object.assign(mapTokens[tokenId], data.changes);
            } else if (data.changes && (data.changes.id || data.changes.name || data.changes.img)) {
                mapTokens[tokenId] = { id: tokenId, ...data.changes };
            }
        }
        if (data.mapId === ctx.currentMapId) {
            if (
                vtt.role !== 'GM' &&
                (data.changes?.layer === 'gm' || data.changes?.isVisible === false || data.changes?.hidden === true)
            ) {
                delete ctx.tokens[tokenId];
                if (ctx.lastBroadcastedTokens) delete ctx.lastBroadcastedTokens[tokenId];
                if (typeof document !== 'undefined') {
                    const offNode = document.getElementById('asset_node_' + tokenId);
                    if (offNode && ctx.cleanupMediaElement) ctx.cleanupMediaElement(offNode);
                    const offUiNode = document.getElementById('token_ui_' + tokenId);
                    if (offUiNode) offUiNode.remove();
                }
                ctx.renderAll();
                if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                    window.VTT.chatEngine.refreshInitiative();
                }
                return;
            }
            const isBeingDragged = tokenId === ctx.dragTargetId || (ctx.dragTargetId && ctx.selectedTokenIds?.has(tokenId));
            if (isBeingDragged) return;

            if (ctx.tokens[tokenId]) {
                Object.assign(ctx.tokens[tokenId], data.changes);
                if (ctx.lastBroadcastedTokens) {
                    ctx.lastBroadcastedTokens[tokenId] = JSON.parse(JSON.stringify(ctx.tokens[tokenId]));
                }
                if (
                    data.changes.x !== undefined ||
                    data.changes.y !== undefined ||
                    data.changes.sightRange !== undefined ||
                    data.changes.lightEnabled !== undefined ||
                    data.changes.layer !== undefined
                ) {
                    delete ctx.tokens[tokenId]._polyCache;
                    delete ctx.tokens[tokenId]._losPolyCache;
                }
                if (typeof ctx.processTokenAnimReqs === 'function') {
                    ctx.processTokenAnimReqs(ctx.tokens);
                }
                ctx.renderAll();
                if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                    window.VTT.chatEngine.refreshInitiative();
                }
            } else {
                // Self-healing: if token was not in memory, restore from campaignState or full delta
                const candidate = vtt.campaignState?.maps?.[data.mapId]?.tokens?.[tokenId];
                if (
                    candidate &&
                    (vtt.role === 'GM' ||
                        (candidate.layer !== 'gm' && candidate.isVisible !== false && !candidate.hidden))
                ) {
                    Object.assign(candidate, data.changes);
                    ctx.tokens[tokenId] = candidate;
                    if (ctx.lastBroadcastedTokens) {
                        ctx.lastBroadcastedTokens[tokenId] = JSON.parse(JSON.stringify(candidate));
                    }
                    if (typeof ctx.processTokenAnimReqs === 'function') {
                        ctx.processTokenAnimReqs(ctx.tokens);
                    }
                    ctx.renderAll();
                    if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                        window.VTT.chatEngine.refreshInitiative();
                    }
                } else if (
                    data.changes &&
                    data.changes.name &&
                    data.changes.x !== undefined &&
                    (vtt.role === 'GM' ||
                        (data.changes.layer !== 'gm' && data.changes.isVisible !== false && !data.changes.hidden))
                ) {
                    ctx.tokens[tokenId] = { id: tokenId, ...data.changes };
                    if (ctx.lastBroadcastedTokens) {
                        ctx.lastBroadcastedTokens[tokenId] = JSON.parse(JSON.stringify(ctx.tokens[tokenId]));
                    }
                    if (typeof ctx.processTokenAnimReqs === 'function') {
                        ctx.processTokenAnimReqs(ctx.tokens);
                    }
                    ctx.renderAll();
                    if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                        window.VTT.chatEngine.refreshInitiative();
                    }
                } else if (
                    vtt.role !== 'GM' &&
                    (data.changes?.layer === 'token' ||
                        data.changes?.isVisible === true ||
                        data.changes?.hidden === false)
                ) {
                    // Token revealed on map but player client is missing full token payload: request immediate authoritative sync!
                    socket.emit('token:request_sync', { mapId: data.mapId, tokenId });
                }
            }
        }
    });

    socket.on('token:deleted', (data) => {
        if (data?.origin && vtt?.socket?.id && data.origin === vtt.socket.id) return;
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]?.tokens) {
            delete vtt.campaignState.maps[data.mapId].tokens[data.tokenId];
        }
        if (data.mapId === ctx.currentMapId) {
            delete ctx.tokens[data.tokenId];
            delete ctx.lastBroadcastedTokens[data.tokenId];
            if (typeof document !== 'undefined') {
                const offNode = document.getElementById('asset_node_' + data.tokenId);
                if (offNode && ctx.cleanupMediaElement) ctx.cleanupMediaElement(offNode);
                const offUiNode = document.getElementById('token_ui_' + data.tokenId);
                if (offUiNode) offUiNode.remove();
            }
            ctx.renderAll();
            if (typeof window !== 'undefined' && window.VTT?.chatEngine?.refreshInitiative) {
                window.VTT.chatEngine.refreshInitiative();
            }
        }
        if (typeof vtt.refreshLocatorPanel === 'function') vtt.refreshLocatorPanel();
    });

    socket.on('grid:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].grid = data.grid;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.grid = data.grid;
            if (ctx.syncGridConfigInputs) ctx.syncGridConfigInputs();
            ctx.renderAll();
        }
    });

    socket.on('map:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].mapImage = data.mapImage;
        }
        if (data.mapId === ctx.currentMapId) {
            if (ctx.setMapBackground) ctx.setMapBackground(data.mapImage);
            ctx.renderAll();
        }
    });

    socket.on('walls:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].walls = data.walls;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.walls = data.walls;
            if (typeof ctx.syncWallSpatialIndex === 'function') {
                ctx.syncWallSpatialIndex();
            }
            ctx.renderAll();
        }
    });

    socket.on('lights:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].lights = data.lights;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.lights = data.lights;
            ctx.renderAll();
        }
    });

    socket.on('notes:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].notes = data.notes;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.notes = data.notes || [];
            ctx.renderAll();
        }
    });

    socket.on('map:pinged', (data) => {
        ctx.triggerPingAnimation(data.x, data.y, data.username, data.role);
    });

    socket.on('token:force_selected_gm', (data) => {
        if (vtt.role !== 'GM' || !data || !data.tokenId) return;
        const targetToken = ctx.tokens[data.tokenId];
        if (!targetToken) return;

        ctx.selectedTokenIds.clear();
        ctx.selectedTokenIds.add(data.tokenId);
        ctx.selectedTokenId = data.tokenId;

        const { drawW, drawH } = ctx.getTokenDrawDimensions
            ? ctx.getTokenDrawDimensions(targetToken)
            : { drawW: targetToken.width || 50, drawH: targetToken.height || 50 };
        const tx = targetToken.x + drawW / 2;
        const ty = targetToken.y + drawH / 2;
        ctx.panTo(tx, ty, null, 350);
        ctx.renderAll();

        const jq =
            typeof JqueryUtil !== 'undefined' ? JqueryUtil : typeof window !== 'undefined' ? window.JqueryUtil : null;
        if (jq && jq.doToast) {
            jq.doToast({
                type: 'info',
                content: `${data.username || 'Player'} targeted ${targetToken.name || 'Token'}.`
            });
        }
    });

    socket.on('tokens:damage_fx', (data) => {
        if (!data || !Array.isArray(data.tokenIds)) return;
        data.tokenIds.forEach((tokenId) => {
            const token = ctx.tokens[tokenId];
            if (!token) return;
            const { drawW, drawH } = ctx.getTokenDrawDimensions
                ? ctx.getTokenDrawDimensions(token)
                : { drawW: token.width || 50, drawH: token.height || 50 };
            const tx = token.x + drawW / 2;
            const ty = token.y + drawH / 2;
            ctx.triggerDamageFXAnimation(tx, ty, Math.max(drawW, drawH) / 2, data.damageTypes || ['untyped'], {
                amount: data.amount !== undefined ? data.amount : null,
                tokenId: tokenId
            });
        });
    });

    socket.on('tokens:heal_fx', (data) => {
        if (!data || !Array.isArray(data.tokenIds) || !ctx.triggerHealingFXAnimation) return;
        data.tokenIds.forEach((tokenId) => {
            const token = ctx.tokens[tokenId];
            if (!token) return;
            const { drawW, drawH } = ctx.getTokenDrawDimensions
                ? ctx.getTokenDrawDimensions(token)
                : { drawW: token.width || 50, drawH: token.height || 50 };
            const tx = token.x + drawW / 2;
            const ty = token.y + drawH / 2;
            ctx.triggerHealingFXAnimation(tx, ty, Math.max(drawW, drawH) / 2, data.amount || 0, {
                tokenId: tokenId,
                isTempHp: Boolean(data.isTempHp)
            });
        });
    });

    socket.on('map:pannedTo', (data) => {
        if (data.mapId && data.mapId !== ctx.currentMapId) return;
        if (data.zoom) {
            ctx.panTo(data.x, data.y, data.zoom, 400);
        } else {
            ctx.panTo(data.x, data.y, null, 400);
        }
    });

    socket.on('measure:updated', (data) => {
        if (ctx.otherMeasurements) ctx.otherMeasurements[data.socketId] = data;
        if (ctx.renderInteractionLayer) ctx.renderInteractionLayer();
    });

    socket.on('measure:cleared', (data) => {
        if (ctx.otherMeasurements) delete ctx.otherMeasurements[data.socketId];
        if (ctx.renderInteractionLayer) ctx.renderInteractionLayer();
    });

    socket.on('shapes:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].shapes = data.shapes;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.shapes = data.shapes;
            ctx.renderAll();
        }
    });

    socket.on('drawings:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].drawings = data.drawings;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.drawings = data.drawings || {};
            ctx.renderAll();
        }
    });

    socket.on('traps:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].traps = data.traps;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.traps = data.traps || [];
            ctx.renderPlacedTrapsList();
            ctx.renderAll();
        }
    });

    socket.on('portals:updated', (data) => {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
            vtt.campaignState.maps[data.mapId].portals = data.portals;
        }
        if (data.mapId === ctx.currentMapId) {
            ctx.portals = data.portals || [];
            ctx.renderPlacedPortalsList();
            if (ctx.populateTargetPortalsDropdown) ctx.populateTargetPortalsDropdown();
            ctx.renderAll();
        }
    });

    socket.on('trap:triggered', (data) => {
        if (ctx.triggerTrapSpringFX) ctx.triggerTrapSpringFX(data);
        if (ctx.postTrapTriggerChatCard) ctx.postTrapTriggerChatCard(data);
    });

    socket.on('portal:teleported', (data) => {
        if (ctx.tokens[data.tokenId]) {
            ctx.tokens[data.tokenId]._portalTransitLock = Date.now() + 200;
        }

        if (data.targetMapId === ctx.currentMapId) {
            const targetTok = ctx.tokens[data.tokenId];
            const isOwner =
                (data.username && data.username === vtt.username) ||
                (targetTok &&
                    (targetTok.isPlayer || targetTok.isCompanion) &&
                    (ctx.isTokenControlledByPlayer ? ctx.isTokenControlledByPlayer(targetTok) : false));
            if (isOwner) {
                ctx.selectedTokenIds.clear();
                ctx.selectedTokenIds.add(data.tokenId);
                ctx.selectedTokenId = data.tokenId;
                ctx.panTo(data.targetX, data.targetY, null, 350);
            }
            ctx.renderAll();
        } else if (vtt.role !== 'GM') {
            const isOwner = data.username && data.username === vtt.username;
            const currentTok = ctx.tokens[data.tokenId];
            const controlled =
                isOwner ||
                (currentTok &&
                    (currentTok.isPlayer || currentTok.isCompanion) &&
                    (ctx.isTokenControlledByPlayer ? ctx.isTokenControlledByPlayer(currentTok) : false));
            if (controlled) {
                window._portalTransitInfo = {
                    tokenId: data.tokenId,
                    targetMapId: data.targetMapId,
                    targetPortalId: data.targetPortalId || null,
                    exitPos: { x: data.targetX, y: data.targetY },
                    timestamp: Date.now()
                };
                ctx.pendingFocusTokenId = data.tokenId;
                ctx.pendingFocusTokenExpiry = Date.now() + 30000;
                if (vtt.campaignState?.maps?.[data.targetMapId]) {
                    ctx.loadMap(data.targetMapId, false);
                }
                if (ctx.showPlayerInterMapPortalToast) {
                    ctx.showPlayerInterMapPortalToast(
                        data.targetMapName || vtt.campaignState?.maps?.[data.targetMapId]?.name
                    );
                }
            }
        } else if (vtt.role === 'GM') {
            if (ctx.showGMInterMapPortalToast) {
                ctx.showGMInterMapPortalToast(data);
            }
        }
    });

    socket.on('portal:teleported_batch', (data) => {
        if (!Array.isArray(data.tokens)) return;
        data.tokens.forEach((mt) => {
            if (ctx.tokens[mt.tokenId]) {
                ctx.tokens[mt.tokenId]._portalTransitLock = Date.now() + 200;
            }
        });

        if (data.targetMapId === ctx.currentMapId) {
            const myTokens = data.tokens.filter((mt) => {
                const tok = ctx.tokens[mt.tokenId];
                return (
                    (mt.owner && mt.owner === vtt.username) ||
                    (tok &&
                        (tok.isPlayer || tok.isCompanion) &&
                        (ctx.isTokenControlledByPlayer ? ctx.isTokenControlledByPlayer(tok) : false))
                );
            });
            if (myTokens.length > 0) {
                ctx.selectedTokenIds.clear();
                myTokens.forEach((mt) => ctx.selectedTokenIds.add(mt.tokenId));
                ctx.selectedTokenId = myTokens[0].tokenId;
                ctx.panTo(myTokens[0].targetX, myTokens[0].targetY, null, 350);
            }
            ctx.renderAll();
        } else if (vtt.role !== 'GM') {
            const myTokens = data.tokens.filter((mt) => {
                const tok = ctx.tokens[mt.tokenId];
                return (
                    (mt.owner && mt.owner === vtt.username) ||
                    (tok &&
                        (tok.isPlayer || tok.isCompanion) &&
                        (ctx.isTokenControlledByPlayer ? ctx.isTokenControlledByPlayer(tok) : false))
                );
            });
            if (myTokens.length > 0) {
                const lead = myTokens[0];
                window._portalTransitInfo = {
                    tokenId: lead.tokenId,
                    targetMapId: data.targetMapId,
                    targetPortalId: data.targetPortalId || lead.targetPortalId || null,
                    exitPos: { x: lead.targetX, y: lead.targetY },
                    timestamp: Date.now()
                };
                ctx.pendingFocusTokenId = lead.tokenId;
                ctx.pendingFocusTokenExpiry = Date.now() + 30000;
                if (vtt.campaignState?.maps?.[data.targetMapId]) {
                    ctx.loadMap(data.targetMapId, false);
                }
                if (ctx.showPlayerInterMapPortalToast) {
                    ctx.showPlayerInterMapPortalToast(
                        data.targetMapName || vtt.campaignState?.maps?.[data.targetMapId]?.name
                    );
                }
            }
        } else if (vtt.role === 'GM') {
            const firstToken = data.tokens[0];
            if (firstToken && ctx.showGMInterMapPortalToast) {
                ctx.showGMInterMapPortalToast({
                    tokenId: firstToken.tokenId,
                    tokenName:
                        data.tokens.length > 1
                            ? `${firstToken.tokenName} (+${data.tokens.length - 1} tokens)`
                            : firstToken.tokenName,
                    sourceMapId: data.sourceMapId,
                    targetMapId: data.targetMapId,
                    targetMapName: data.targetMapName
                });
            }
        }
    });

    socket.on('settings:updated', (data) => {
        ctx.campaignSettings = data.settings;
        if (ctx.syncHpSettingsInputs) ctx.syncHpSettingsInputs();
        if (ctx.syncPlayerTokenSettingsUI) ctx.syncPlayerTokenSettingsUI();
        if (vtt.role === 'GM' && ctx.syncGmTokenSettingsUI) {
            ctx.syncGmTokenSettingsUI();
        }
        ctx.renderAll();
    });

    // ── Live HP sync: refresh token bars when a character sheet HP changes ──
    socket.on('character:updated', (data) => {
        if (!data.character) return;
        const char = data.character;

        // Update campaign state
        if (vtt.campaignState) {
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[char.id] = char;
        }

        // Push HP to any linked ctx.tokens on the current map
        let changed = false;
        Object.values(ctx.tokens).forEach((token) => {
            if (token.characterId === char.id || token.sourceCharacterId === char.id) {
                token.hp = char.hpCurrent ?? char.hp ?? token.hp;
                token.maxHp = char.hpMax ?? token.maxHp;
                token.tempHp = char.tempHp ?? 0;

                // Update token image
                if (char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex !== -1) {
                    const idx = char.activeTokenIndex || 0;
                    if (idx >= 0 && idx < char.tokenImages.length) {
                        token.img = char.tokenImages[idx].url;
                    }
                } else if (char.monsterData && char.monsterData.hasToken) {
                    const p =
                        typeof Parser !== 'undefined' ? Parser : typeof window !== 'undefined' ? window.Parser : null;
                    const cleanName =
                        p && p.nameToTokenName
                            ? p.nameToTokenName(char.monsterData.name)
                            : (char.monsterData.name || '').replace(/"/g, '').trim();
                    token.img = `img/bestiary/tokens/${char.monsterData.source}/${cleanName}.webp`;
                } else if (!char.monsterData && (!char.tokenImages || char.tokenImages.length === 0)) {
                    token.img =
                        window.VTT && window.VTT.generateArcaneToken
                            ? window.VTT.generateArcaneToken(char.name || 'Hero', char.isPlayer ? 'player' : 'npc')
                            : 'favicon.svg';
                }

                if (token.img && typeof token.img === 'string') {
                    const lower = token.img.toLowerCase();
                    const _c = lower.split('?')[0];
                    token.isGif = _c.endsWith('.gif');
                    token.isVideo =
                        !token.isGif &&
                        (_c.endsWith('.mp4') ||
                            _c.endsWith('.webm') ||
                            _c.endsWith('.ogg') ||
                            lower.includes('youtube.com'));
                }

                changed = true;
            }
        });
        if (changed) ctx.renderAll();
    });
}

// Map Manager Organization & View State
