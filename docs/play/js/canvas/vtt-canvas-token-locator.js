// DnDForged Token Locator & Quick Switcher Subsystem
// Handles cross-map token search, party member tracking, and map switching navigation

export function setupTokenLocatorPanel(options = {}) {
    if (typeof document === 'undefined') return;

    const {
        vtt = (typeof window !== 'undefined' ? window.VTT : null) || {},
        getCurrentMapId = () => null,
        setCurrentMapId = () => {},
        tokens = {},
        selectedTokenIds = new Set(),
        setSelectedTokenId = () => {},
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50 }),
        panTo = () => {},
        renderAll = () => {},
        loadMap = () => {},
        openPushPlayersModal = () => {},
        isTokenControlledByPlayer = () => true,
        attachThumbnailHoverPreview = () => {},
        getSafeVttUrl = (u) => u
    } = options;

    const btnLocator = document.getElementById('btn-token-locator');
    const panelLocator = document.getElementById('vtt-token-locator-panel');
    if (!btnLocator || !panelLocator) return;

    const tabsHeader = document.getElementById('vtt-locator-tabs-header');
    const tabTokensBtn = document.getElementById('btn-locator-tab-tokens');
    const tabMapsBtn = document.getElementById('btn-locator-tab-maps');
    const tokensView = document.getElementById('vtt-locator-tokens-view');
    const mapsView = document.getElementById('vtt-locator-maps-view');
    const tokensList = document.getElementById('vtt-locator-tokens-list');
    const mapsList = document.getElementById('vtt-locator-maps-list');
    const tokensEmpty = document.getElementById('vtt-locator-tokens-empty');
    const mapsEmpty = document.getElementById('vtt-locator-maps-empty');

    let activeTab = 'tokens'; // 'tokens' | 'maps'
    let activeConfirmTimer = null;

    // Show tabs header if role is GM
    if (vtt.role === 'GM' && tabsHeader) {
        tabsHeader.classList.remove('vtt-hidden');
    } else if (tabsHeader) {
        tabsHeader.classList.add('vtt-hidden');
    }

    function openTokenLocatorPanel() {
        panelLocator.classList.add('open');
        btnLocator.classList.add('panel-open');
        refreshLocatorActiveView();
    }

    function closeTokenLocatorPanel() {
        panelLocator.classList.remove('open');
        btnLocator.classList.remove('panel-open');
        if (activeConfirmTimer) {
            clearTimeout(activeConfirmTimer);
            activeConfirmTimer = null;
        }
        if (tokensList) {
            tokensList.querySelectorAll('.locator-btn-delete.confirming').forEach((btn) => {
                btn.classList.remove('confirming');
                btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            });
        }
    }

    function isTokenLocatorOpen() {
        return panelLocator.classList.contains('open');
    }

    // Toggle on button click
    btnLocator.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isTokenLocatorOpen()) {
            closeTokenLocatorPanel();
        } else {
            openTokenLocatorPanel();
        }
    });

    // Click outside on window/canvas to auto-close
    document.addEventListener('pointerdown', (e) => {
        if (!isTokenLocatorOpen()) return;
        if (panelLocator.contains(e.target) || btnLocator.contains(e.target)) return;
        const modalPush = document.getElementById('modal-push-players');
        if (modalPush && !modalPush.classList.contains('vtt-hidden') && modalPush.contains(e.target)) return;

        closeTokenLocatorPanel();
    });

    // Tab buttons (GM only)
    if (tabTokensBtn && tabMapsBtn) {
        tabTokensBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activeTab = 'tokens';
            tabTokensBtn.classList.add('active');
            tabMapsBtn.classList.remove('active');
            if (tokensView) tokensView.classList.remove('vtt-hidden');
            if (mapsView) mapsView.classList.add('vtt-hidden');
            renderLocatorTokens();
        });

        tabMapsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activeTab = 'maps';
            tabMapsBtn.classList.add('active');
            tabTokensBtn.classList.remove('active');
            if (mapsView) mapsView.classList.remove('vtt-hidden');
            if (tokensView) tokensView.classList.add('vtt-hidden');
            renderLocatorMaps();
        });
    }

    function refreshLocatorActiveView() {
        if (activeTab === 'tokens' || vtt.role !== 'GM') {
            renderLocatorTokens();
        } else {
            renderLocatorMaps();
        }
    }

    function renderLocatorTokens() {
        if (!tokensList) return;
        tokensList.innerHTML = '';

        const maps = vtt.campaignState?.maps || {};
        const placedTokens = [];
        const currentMapId = getCurrentMapId();

        for (const [mId, mapObj] of Object.entries(maps)) {
            if (!mapObj || !mapObj.tokens) continue;
            for (const [tId, tok] of Object.entries(mapObj.tokens)) {
                if (!tok) continue;
                if (tok.layer === 'map' || tok.isBackground || tok.isAsset) continue;

                // Must strictly be a Player Character or Companion token (exclude monsters, NPCs, etc.)
                const isCompanion = Boolean(tok.isCompanion);
                const isCustomNpc = Boolean(tok.isCustomNpc);
                const isPlayer = Boolean(
                    !isCompanion &&
                    !isCustomNpc &&
                    tok.isPlayer !== false &&
                    (tok.isPlayer || tok.characterId || tok.sourceCharacterId)
                );

                if (!isPlayer && !isCompanion) continue;

                // Non-GM players only see tokens they own / control
                if (vtt.role !== 'GM') {
                    if (typeof isTokenControlledByPlayer === 'function' && !isTokenControlledByPlayer(tok)) continue;
                }

                placedTokens.push({
                    mapId: mId,
                    mapName: mapObj.name || 'Untitled Map',
                    token: tok,
                    tokenId: tId,
                    isPlayer,
                    isCompanion
                });
            }
        }

        // Sort: current map tokens first, then alphabetical by name
        placedTokens.sort((a, b) => {
            const aCur = a.mapId === currentMapId;
            const bCur = b.mapId === currentMapId;
            if (aCur && !bCur) return -1;
            if (!aCur && bCur) return 1;
            return (a.token.name || '').localeCompare(b.token.name || '');
        });

        if (placedTokens.length === 0) {
            if (tokensEmpty) tokensEmpty.classList.remove('vtt-hidden');
            return;
        } else {
            if (tokensEmpty) tokensEmpty.classList.add('vtt-hidden');
        }

        placedTokens.forEach((item) => {
            const { mapId, mapName, token: tok, tokenId, isCompanion } = item;
            const isCurrentMap = mapId === currentMapId;
            const avatarSrc = tok.img || 'favicon.svg';
            const tokenDisplayName = tok.name || (isCompanion ? 'Companion' : 'Character');
            const tooltipText = `${tokenDisplayName} (${mapName})`;

            const row = document.createElement('div');
            row.className = `locator-item-row ${isCurrentMap ? 'active-map-item' : ''}`;
            row.dataset.tokenId = tokenId;
            row.dataset.mapId = mapId;

            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'locator-token-avatar-wrap';
            avatarWrap.title = tooltipText;

            const img = document.createElement('img');
            img.className = `locator-token-avatar ${isCompanion ? 'companion' : ''}`;
            img.src = avatarSrc;
            img.alt = tokenDisplayName;
            img.onerror = () => {
                img.src = 'favicon.svg';
            };
            avatarWrap.appendChild(img);

            if (isCurrentMap) {
                const badge = document.createElement('span');
                badge.className = 'locator-current-map-badge';
                badge.title = 'Placed on currently viewed map';
                avatarWrap.appendChild(badge);
            }

            // Clicking the token avatar: center on token (switch map seamlessly if needed) & close panel
            avatarWrap.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTokenLocatorPanel();

                if (mapId === currentMapId) {
                    // Same map: select and pan smoothly
                    selectedTokenIds.clear();
                    selectedTokenIds.add(tokenId);
                    setSelectedTokenId(tokenId);
                    const liveTok = tokens[tokenId];
                    if (liveTok) {
                        const { drawW, drawH } = getTokenDrawDimensions(liveTok);
                        panTo(liveTok.x + drawW / 2, liveTok.y + drawH / 2, null, 350);
                    }
                    renderAll();
                } else {
                    // Different map: queue focus and seamlessly switch maps
                    if (options.setPendingFocusToken) {
                        options.setPendingFocusToken(tokenId, Date.now() + 6000);
                    }

                    if (vtt.role === 'GM') {
                        if (vtt.socket) vtt.socket.emit('map:switch-gm', { mapId });
                        loadMap(mapId, false);
                    } else {
                        if (vtt.socket) vtt.socket.emit('map:switch-player', { mapId });
                        if (vtt.campaignState?.maps?.[mapId]) {
                            loadMap(mapId, false);
                        }
                    }
                }
            });

            // Delete button with quick inline confirmation
            const btnDelete = document.createElement('button');
            btnDelete.className = 'locator-btn-delete';
            btnDelete.title = `Delete from ${mapName}`;
            btnDelete.setAttribute('aria-label', `Delete ${tokenDisplayName}`);
            btnDelete.innerHTML = '<i class="fa-solid fa-xmark"></i>';

            let confirmTimer = null;
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();

                if (!btnDelete.classList.contains('confirming')) {
                    // Switch other buttons out of confirming state first
                    tokensList.querySelectorAll('.locator-btn-delete.confirming').forEach((b) => {
                        b.classList.remove('confirming');
                        b.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                    });

                    btnDelete.classList.add('confirming');
                    btnDelete.innerHTML = '<i class="fa-solid fa-check"></i>';
                    btnDelete.title = 'Click again to confirm delete';

                    confirmTimer = setTimeout(() => {
                        btnDelete.classList.remove('confirming');
                        btnDelete.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                        btnDelete.title = `Delete from ${mapName}`;
                        confirmTimer = null;
                    }, 3500);
                    activeConfirmTimer = confirmTimer;
                } else {
                    if (confirmTimer) {
                        clearTimeout(confirmTimer);
                        confirmTimer = null;
                    }

                    if (vtt.socket) vtt.socket.emit('token:delete', { mapId, tokenId });

                    // If on current map, remove immediately from local canvas state
                    if (mapId === currentMapId && tokens[tokenId]) {
                        delete tokens[tokenId];
                        selectedTokenIds.delete(tokenId);
                        setSelectedTokenId(null);
                        renderAll();
                    }

                    // Remove row from panel list
                    row.remove();
                    if (tokensList.children.length === 0 && tokensEmpty) {
                        tokensEmpty.classList.remove('vtt-hidden');
                    }
                }
            });

            row.appendChild(avatarWrap);
            row.appendChild(btnDelete);
            tokensList.appendChild(row);
        });
    }

    function renderLocatorMaps() {
        if (!mapsList) return;
        mapsList.innerHTML = '';

        const maps = vtt.campaignState?.maps || {};
        const mapEntries = Object.values(maps);
        const currentMapId = getCurrentMapId();

        if (mapEntries.length === 0) {
            if (mapsEmpty) mapsEmpty.classList.remove('vtt-hidden');
            return;
        } else {
            if (mapsEmpty) mapsEmpty.classList.add('vtt-hidden');
        }

        // Sort maps alphabetically
        mapEntries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const camp = vtt.campaignState || {};
        const activePlayerMapId = camp.activeMapId;
        const overrides = camp.playerMapOverrides || {};

        mapEntries.forEach((map) => {
            const isGmViewing = currentMapId === map.id;
            const isPartyActive = activePlayerMapId === map.id;
            const playersOnThisMap = Object.entries(overrides)
                .filter(([p, mId]) => mId === map.id)
                .map(([p]) => p);
            const hasLivePlayers = isPartyActive || playersOnThisMap.length > 0;

            let tooltipLines = [map.name || 'Untitled Map'];
            if (isGmViewing) tooltipLines.push('(Current GM View)');
            if (isPartyActive && playersOnThisMap.length === 0) tooltipLines.push('(Global Party Map)');
            if (playersOnThisMap.length > 0) tooltipLines.push(`(Players: ${playersOnThisMap.join(', ')})`);

            const tooltipText = tooltipLines.join(' ');

            // Extract thumbnail
            let rawThumb =
                map.thumbnail ||
                map.mapImage ||
                Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img)?.img ||
                '';
            let thumbUrl = rawThumb || 'favicon.svg';
            const ytMatch = rawThumb
                ? rawThumb.match(
                      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
                  )
                : null;
            if (ytMatch && ytMatch[1]) {
                thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
            }

            const cleanLocThumb = (thumbUrl || '').split('?')[0].toLowerCase();
            const isLocVideo =
                !ytMatch &&
                Boolean(
                    cleanLocThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i) ||
                    (thumbUrl && thumbUrl.includes('pinimg.com/videos')) ||
                    map.isVideo ||
                    (map.tokens &&
                        Object.values(map.tokens).some(
                            (t) =>
                                t.layer === 'map' &&
                                (t.isVideo || (t.img && t.img.split('?')[0].match(/\.(mp4|webm|ogg|m4v|mov)$/i)))
                        ))
                );
            if (isLocVideo && !cleanLocThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i)) {
                const mapToken = Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img);
                if (mapToken && mapToken.img) {
                    thumbUrl = typeof getSafeVttUrl === 'function' ? getSafeVttUrl(mapToken.img) : mapToken.img;
                }
            }
            const isLocGif = !isLocVideo && !ytMatch && cleanLocThumb.endsWith('.gif');

            const row = document.createElement('div');
            row.className = `locator-item-row ${isGmViewing ? 'active-map-item' : ''}`;
            row.dataset.mapId = map.id;

            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'locator-map-thumb-wrap';
            thumbWrap.title = tooltipText;

            if (isLocVideo) {
                const video = document.createElement('video');
                video.className = `locator-map-thumb ${isGmViewing ? 'gm-viewing' : ''} map-thumb-video`;
                video.src = thumbUrl.includes('#') ? thumbUrl : `${thumbUrl}#t=0.001`;
                video.preload = 'metadata';
                video.muted = true;
                video.playsInline = true;
                video.loop = true;
                video.style.pointerEvents = 'none';
                video.onerror = () => {
                    const fallbackImg = document.createElement('img');
                    fallbackImg.className = `locator-map-thumb ${isGmViewing ? 'gm-viewing' : ''}`;
                    fallbackImg.src = 'favicon.svg';
                    if (video.parentNode) video.parentNode.replaceChild(fallbackImg, video);
                };
                thumbWrap.appendChild(video);
                attachThumbnailHoverPreview(thumbWrap);
            } else if (isLocGif) {
                const canvas = document.createElement('canvas');
                canvas.className = `locator-map-thumb ${isGmViewing ? 'gm-viewing' : ''} map-thumb-gif-canvas`;
                canvas.style.pointerEvents = 'none';
                const img = document.createElement('img');
                img.className = `locator-map-thumb ${isGmViewing ? 'gm-viewing' : ''} map-thumb-gif-img`;
                img.src = thumbUrl;
                img.alt = map.name || 'Map';
                img.style.pointerEvents = 'none';
                img.onerror = () => {
                    img.src = 'favicon.svg';
                };
                thumbWrap.appendChild(canvas);
                thumbWrap.appendChild(img);
                attachThumbnailHoverPreview(thumbWrap);
            } else {
                const img = document.createElement('img');
                img.className = `locator-map-thumb ${isGmViewing ? 'gm-viewing' : ''}`;
                img.src = thumbUrl;
                img.alt = map.name || 'Map';
                img.onerror = () => {
                    img.src = 'favicon.svg';
                };
                thumbWrap.appendChild(img);
            }

            if (hasLivePlayers) {
                const liveDot = document.createElement('span');
                liveDot.className = 'locator-map-live-dot';
                liveDot.title = 'Live players on this map';
                thumbWrap.appendChild(liveDot);
            }

            // Left-click map: switch GM view immediately & close panel
            thumbWrap.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTokenLocatorPanel();

                if (map.id !== currentMapId) {
                    if (vtt.campaignState) {
                        vtt.campaignState.activeGMMapId = map.id;
                    }
                    if (vtt.socket) vtt.socket.emit('map:switch-gm', { mapId: map.id });
                    loadMap(map.id, false);
                }
            });

            // Push to players button
            const btnPush = document.createElement('button');
            btnPush.className = 'locator-btn-push';
            btnPush.title = `Push "${map.name || 'Map'}" to players`;
            btnPush.setAttribute('aria-label', `Push ${map.name || 'Map'} to players`);
            btnPush.innerHTML = '<i class="fa-solid fa-person-arrow-up-from-line"></i>';

            btnPush.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTokenLocatorPanel();
                if (typeof openPushPlayersModal === 'function') {
                    openPushPlayersModal(map.id);
                }
            });

            row.appendChild(thumbWrap);
            row.appendChild(btnPush);
            mapsList.appendChild(row);
        });
    }

    // Expose global refresh trigger for socket/sync events
    vtt.refreshLocatorPanel = () => {
        if (isTokenLocatorOpen()) {
            refreshLocatorActiveView();
        }
    };
}
