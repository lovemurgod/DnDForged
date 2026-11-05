// DnDForged Map Manager, Map Settings & Multi-Map Player Dispatching
// Orchestrates map library navigation, folder management, thumbnail caching, and map configuration

export function syncGridConfigInputs() {
    // Obsolete: Grid config moved to Edit Map modal
}

export function hasMapManagerDataChanged(camp, lastFingerprint = '') {
    if (!camp || !camp.maps) return false;
    const mapsList = Object.values(camp.maps);
    const mapOrderStr = Array.isArray(camp.mapOrder) ? camp.mapOrder.join(',') : '';
    const foldersStr = Array.isArray(camp.mapFolders) ? camp.mapFolders.join(',') : '';
    const overridesStr = JSON.stringify(camp.playerMapOverrides || {});
    const mapsDigest = mapsList
        .map((m) => `${m.id}:${m.name}:${m.folder || ''}:${m.thumbnail || m.mapImage || ''}`)
        .join('|');
    const fp = `${mapsList.length}_${mapOrderStr}_${foldersStr}_${camp.activeMapId || ''}_${camp.activeGMMapId || ''}_${overridesStr}_${mapsDigest}`;
    if (fp === lastFingerprint) return false;
    return fp;
}

export function escapeMapHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getPlayerMapOverride(camp, username) {
    if (!camp?.playerMapOverrides || !username) return null;
    if (camp.playerMapOverrides[username]) return camp.playerMapOverrides[username];
    const uLower = String(username).toLowerCase();
    for (const key in camp.playerMapOverrides) {
        if (key.toLowerCase() === uLower) return camp.playerMapOverrides[key];
    }
    return null;
}

export async function probeMediaDimensions(src, isVideoHint = false) {
    const isVideo = isVideoHint || !!String(src || '').match(/\.(mp4|webm|ogg)(\?.*)?$/i) || String(src || '').includes('pinimg.com/videos');
    if (typeof document === 'undefined') {
        return { width: isVideo ? 1920 : 2000, height: isVideo ? 1080 : 1500 };
    }
    if (isVideo) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            let resolved = false;
            const finish = () => {
                if (resolved) return;
                resolved = true;
                const width = video.videoWidth || 1920;
                const height = video.videoHeight || 1080;
                video.src = '';
                resolve({ width, height });
            };
            video.onloadedmetadata = finish;
            video.onerror = finish;
            setTimeout(finish, 3500);
            video.src = src;
        });
    }

    return new Promise((resolve) => {
        const img = new Image();
        let resolved = false;
        const finish = () => {
            if (resolved) return;
            resolved = true;
            const width = img.naturalWidth || 2000;
            const height = img.naturalHeight || 1500;
            resolve({ width, height });
        };
        img.onload = finish;
        img.onerror = finish;
        setTimeout(finish, 3500);
        img.src = src;
    });
}

let activeReorderMenuCleanup = null;

export function detectMapMediaType(map = {}, safeThumb = '') {
    const rawThumb =
        map.thumbnail ||
        map.mapImage ||
        Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img)?.img ||
        '';
    let thumbUrl = safeThumb || rawThumb;
    const ytThumbMatch = thumbUrl
        ? thumbUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)
        : null;
    if (ytThumbMatch && ytThumbMatch[1]) {
        thumbUrl = `https://img.youtube.com/vi/${ytThumbMatch[1]}/hqdefault.jpg`;
    }
    const cleanThumb = (thumbUrl || '').split('?')[0].toLowerCase();
    const isVideo =
        !ytThumbMatch &&
        Boolean(
            cleanThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i) ||
            (thumbUrl && thumbUrl.includes('pinimg.com/videos')) ||
            map.isVideo ||
            (map.tokens &&
                Object.values(map.tokens).some(
                    (t) =>
                        t.layer === 'map' &&
                        (t.isVideo || (t.img && t.img.split('?')[0].match(/\.(mp4|webm|ogg|m4v|mov)$/i)))
                ))
        );
    let resolvedThumb = thumbUrl;
    if (isVideo && !cleanThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i)) {
        const mapToken = Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img);
        if (mapToken && mapToken.img) {
            resolvedThumb = mapToken.img;
        }
    }
    const isGif = !isVideo && !ytThumbMatch && cleanThumb.endsWith('.gif');
    return { isVideo, isGif, resolvedThumb, isYt: !!ytThumbMatch };
}

export function buildMapThumbnailMarkup(map, safeThumb, isVideo, isGif, iconSize = '1.8rem') {
    if (!safeThumb) {
        return `<i class="fa-solid fa-map" style="font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>`;
    }

    if (isVideo) {
        const videoSrc = safeThumb.includes('#') ? safeThumb : `${safeThumb}#t=0.001`;
        return `
            <video class="map-thumb-video" 
                   data-src="${escapeMapHtml(videoSrc)}" 
                   preload="none" 
                   muted 
                   playsinline 
                   loop 
                   style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"
                   onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
            </video>
            <i class="fa-solid fa-map" style="display: none; font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>
        `;
    }

    if (isGif) {
        return `
            <canvas class="map-thumb-gif-canvas" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; display: block;"></canvas>
            <img class="map-thumb-gif-img" 
                 src="${escapeMapHtml(safeThumb)}" 
                 loading="lazy" 
                 alt="${escapeMapHtml(map.name)}" 
                 style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; display: none;" 
                 onerror="this.style.display='none'; if(this.previousElementSibling) this.previousElementSibling.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
            <i class="fa-solid fa-map" style="display: none; font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>
        `;
    }

    return `
        <img src="${escapeMapHtml(safeThumb)}" 
             loading="lazy" 
             alt="${escapeMapHtml(map.name)}" 
             style="width: 100%; height: 100%; object-fit: cover;" 
             onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
        <i class="fa-solid fa-map" style="display: none; font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>
    `;
}

export function observeCardThumbnail(card) {
    if (!card || typeof document === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const video = card.querySelector('video.map-thumb-video[data-src]');
    if (video) {
        if (!window._mapThumbVideoObserver) {
            window._mapThumbVideoObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        const v = entry.target;
                        if (entry.isIntersecting) {
                            if (!v.src && v.dataset.src) {
                                v.src = v.dataset.src;
                                v.preload = 'metadata';
                            }
                        } else {
                            if (!v.paused) {
                                v.pause();
                            }
                        }
                    });
                },
                { rootMargin: '300px' }
            );
        }
        window._mapThumbVideoObserver.observe(video);
    }
}

export function attachThumbnailHoverPreview(thumbWrap) {
    if (!thumbWrap || typeof document === 'undefined') return;
    const video = thumbWrap.querySelector('video.map-thumb-video');
    const gifCanvas = thumbWrap.querySelector('canvas.map-thumb-gif-canvas');
    const gifImg = thumbWrap.querySelector('img.map-thumb-gif-img');

    if (video) {
        const ensureVideoSource = () => {
            if (!video.src && video.dataset.src) {
                video.src = video.dataset.src;
                video.preload = 'metadata';
            }
        };

        const setInitialFrame = () => {
            try {
                if (video.currentTime === 0) video.currentTime = 0.001;
            } catch (_) { }
        };
        if (video.readyState >= 1) {
            setInitialFrame();
        } else {
            video.addEventListener('loadeddata', setInitialFrame, { once: true });
            video.addEventListener('loadedmetadata', setInitialFrame, { once: true });
        }

        let playPromise = null;
        let isHovered = false;

        thumbWrap.addEventListener('mouseenter', () => {
            isHovered = true;
            ensureVideoSource();
            playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { });
            }
        });

        thumbWrap.addEventListener('mouseleave', () => {
            isHovered = false;
            if (playPromise !== null) {
                playPromise
                    .then(() => {
                        if (!isHovered) {
                            video.pause();
                            try {
                                video.currentTime = 0.001;
                            } catch (_) { }
                        }
                    })
                    .catch(() => {
                        video.pause();
                        try {
                            video.currentTime = 0.001;
                        } catch (_) { }
                    });
            } else {
                video.pause();
                try {
                    video.currentTime = 0.001;
                } catch (_) { }
            }
        });
    }

    if (gifCanvas && gifImg) {
        let captured = false;
        const captureFrame = () => {
            if (captured || !gifImg.naturalWidth) return;
            try {
                gifCanvas.width = gifImg.naturalWidth;
                gifCanvas.height = gifImg.naturalHeight;
                const ctx = gifCanvas.getContext('2d');
                ctx.drawImage(gifImg, 0, 0);
                captured = true;
            } catch (err) {
                gifCanvas.style.display = 'none';
                gifImg.style.display = 'block';
            }
        };

        if (gifImg.complete && gifImg.naturalWidth) {
            captureFrame();
        } else {
            gifImg.addEventListener('load', captureFrame, { once: true });
        }

        thumbWrap.addEventListener('mouseenter', () => {
            if (captured) {
                gifCanvas.style.display = 'none';
                gifImg.style.display = 'block';
            }
        });

        thumbWrap.addEventListener('mouseleave', () => {
            if (captured) {
                gifImg.style.display = 'none';
                gifCanvas.style.display = 'block';
            }
        });
    }
}

export function initMapManagerControls(managerState, options = {}) {
    if (typeof document === 'undefined') return;
    if (options && Object.keys(options).length > 0) {
        managerState.lastOptions = { ...(managerState.lastOptions || {}), ...options };
    }
    const effectiveOptions = { ...(managerState.lastOptions || {}), ...options };
    if (managerState.mapManagerControlsInitialized) return;

    const searchInput = document.getElementById('map-search-input');
    const clearBtn = document.getElementById('btn-map-search-clear');
    const btnViewGrid = document.getElementById('btn-map-view-grid');
    const btnViewList = document.getElementById('btn-map-view-list');
    const btnAddFolder = document.getElementById('btn-map-add-folder');
    const btnCloseIcon = document.getElementById('btn-map-modal-close-icon');
    const mapModal = document.getElementById('modal-upload-map');

    if (btnCloseIcon && mapModal) {
        btnCloseIcon.addEventListener('click', () => {
            mapModal.classList.add('vtt-hidden');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (managerState.searchDebounceTimer) clearTimeout(managerState.searchDebounceTimer);
            managerState.searchDebounceTimer = setTimeout(() => {
                managerState.mapSearchQuery = (searchInput.value || '').trim().toLowerCase();
                if (clearBtn) clearBtn.style.display = managerState.mapSearchQuery ? 'block' : 'none';
                renderMapGrid(managerState, effectiveOptions);
            }, 150);
        });
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            managerState.mapSearchQuery = '';
            clearBtn.style.display = 'none';
            renderMapGrid(managerState, effectiveOptions);
            searchInput.focus();
        });
    }

    if (btnViewGrid && btnViewList) {
        btnViewGrid.addEventListener('click', () => {
            managerState.currentMapViewMode = 'grid';
            localStorage.setItem('vtt_map_manager_view_mode', 'grid');
            renderMapGrid(managerState, effectiveOptions);
        });

        btnViewList.addEventListener('click', () => {
            managerState.currentMapViewMode = 'list';
            localStorage.setItem('vtt_map_manager_view_mode', 'list');
            renderMapGrid(managerState, effectiveOptions);
        });
    }

    // Inline Folder Creation
    const inlineCreator = document.getElementById('map-folder-inline-creator');
    const inputNewFolder = document.getElementById('input-map-new-folder');
    const btnSaveNewFolder = document.getElementById('btn-map-save-new-folder');
    const btnCancelNewFolder = document.getElementById('btn-map-cancel-new-folder');

    if (btnAddFolder && inlineCreator && inputNewFolder) {
        const showInlineCreator = () => {
            inlineCreator.classList.remove('vtt-hidden');
            inlineCreator.style.display = 'flex';
            inputNewFolder.value = '';
            inputNewFolder.focus();
        };
        const hideInlineCreator = () => {
            inlineCreator.classList.add('vtt-hidden');
            inlineCreator.style.display = 'none';
            inputNewFolder.value = '';
        };
        const commitNewFolder = () => {
            const val = (inputNewFolder.value || '').trim();
            if (!val) {
                hideInlineCreator();
                return;
            }
            if (val === '__ALL__' || val === '__UNCATEGORIZED__') {
                alert('Folder name is reserved. Please choose another name.');
                return;
            }
            const camp = effectiveOptions.vtt?.campaignState || window.VTT?.campaignState;
            if (!camp) return;
            if (!Array.isArray(camp.mapFolders)) camp.mapFolders = [];
            if (!camp.mapFolders.includes(val)) {
                camp.mapFolders.push(val);
                camp.mapFolders.sort();
                const socket = effectiveOptions.vtt?.socket || window.VTT?.socket;
                if (socket) {
                    socket.emit('map:folder-create', { folder: val });
                }
            }
            managerState.activeMapFolder = val;
            hideInlineCreator();
            renderMapGrid(managerState, effectiveOptions);
        };

        btnAddFolder.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = inlineCreator.style.display === 'flex' && !inlineCreator.classList.contains('vtt-hidden');
            if (isVisible) {
                hideInlineCreator();
            } else {
                showInlineCreator();
            }
        });

        if (btnSaveNewFolder) {
            btnSaveNewFolder.addEventListener('click', (e) => {
                e.stopPropagation();
                commitNewFolder();
            });
        }

        if (btnCancelNewFolder) {
            btnCancelNewFolder.addEventListener('click', (e) => {
                e.stopPropagation();
                hideInlineCreator();
            });
        }

        inputNewFolder.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitNewFolder();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideInlineCreator();
            }
        });
    }

    managerState.mapManagerControlsInitialized = true;
}

export function renderMapSidebar(allMaps, allFolders, activeFolder, managerState, options = {}) {
    if (typeof document === 'undefined') return;
    const sidebarList = document.getElementById('map-folder-nav-list');
    if (!sidebarList) return;
    sidebarList.innerHTML = '';

    const camp = options.vtt?.campaignState || {};
    const hasLivePlayers = (mapsList) => {
        return mapsList.some((map) => {
            const isGlobalActive = camp.activeMapId === map.id;
            const playersOnMap = Object.entries(camp.playerMapOverrides || {})
                .filter(([p, mId]) => mId === map.id)
                .map(([p]) => p);
            return isGlobalActive || playersOnMap.length > 0;
        });
    };

    const createSidebarItem = (folderKey, labelHtml, count, isLive, deleteBtnHtml = '') => {
        const itemEl = document.createElement('div');
        itemEl.className = `map-folder-nav-item ${activeFolder === folderKey ? 'active' : ''}`;
        itemEl.dataset.folderKey = folderKey;
        itemEl.innerHTML = `
            <div class="folder-label" style="display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; flex: 1;">${labelHtml}</div>
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                ${isLive ? '<span style="font-size: 0.6rem; background: var(--color-success-base); color: #fff; padding: 1px 5px; border-radius: 8px; font-weight: bold;"><i class="fa-solid fa-users"></i></span>' : ''}
                <span class="folder-count">${count}</span>
                ${deleteBtnHtml}
            </div>
        `;

        itemEl.addEventListener('click', () => {
            managerState.activeMapFolder = folderKey;
            renderMapGrid(managerState, options);
        });

        // Drop target to move maps into this folder (All Maps is an aggregate view, not a destination)
        itemEl.addEventListener('dragover', (e) => {
            if (!managerState.draggedMapId || folderKey === '__ALL__') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            itemEl.classList.add('drag-target-over');
        });
        itemEl.addEventListener('dragleave', (e) => {
            if (e.relatedTarget && itemEl.contains(e.relatedTarget)) return;
            itemEl.classList.remove('drag-target-over');
        });
        itemEl.addEventListener('drop', (e) => {
            if (!managerState.draggedMapId) return;
            e.preventDefault();
            itemEl.classList.remove('drag-target-over');
            if (folderKey === '__ALL__') return;
            const targetMap = camp.maps && camp.maps[managerState.draggedMapId];
            if (!targetMap) return;

            const destFolder = folderKey === '__UNCATEGORIZED__' ? '' : folderKey;
            if (targetMap.folder !== destFolder) {
                targetMap.folder = destFolder;
                if (options.vtt?.socket) {
                    options.vtt.socket.emit('map:edit', {
                        mapId: managerState.draggedMapId,
                        updates: { folder: destFolder }
                    });
                }
                renderMapGrid(managerState, options);
            }
        });

        return itemEl;
    };

    // 1. All Maps
    const allLive = hasLivePlayers(allMaps);
    sidebarList.appendChild(
        createSidebarItem(
            '__ALL__',
            '<i class="fa-solid fa-layer-group text-gradient-gold"></i> All Maps',
            allMaps.length,
            allLive
        )
    );

    // 2. Uncategorized
    const rootMaps = allMaps.filter((m) => !m.folder || !m.folder.trim());
    const uncatLive = hasLivePlayers(rootMaps);
    sidebarList.appendChild(
        createSidebarItem(
            '__UNCATEGORIZED__',
            '<i class="fa-solid fa-folder-minus" style="color: var(--color-text-muted);"></i> Uncategorized',
            rootMaps.length,
            uncatLive
        )
    );

    // 3. Custom Folders (including empty ones)
    allFolders.forEach((fName) => {
        const folderMaps = allMaps.filter((m) => (m.folder || '').trim() === fName);
        const folderLive = hasLivePlayers(folderMaps);
        const count = folderMaps.length;
        const renameBtnHtml = `<button type="button" class="btn btn-icon btn-xxs map-folder-rename-btn" title="Rename folder" style="background: none; border: none; padding: 2px 3px; color: var(--color-text-muted); cursor: pointer;"><i class="fa-solid fa-pen" style="font-size: 0.65rem;"></i></button>`;
        const delBtnHtml = `<button type="button" class="btn btn-icon btn-xxs map-folder-delete-btn" title="Delete folder" style="background: none; border: none; padding: 2px 3px; color: var(--color-text-muted); cursor: pointer;"><i class="fa-solid fa-trash-can" style="font-size: 0.65rem;"></i></button>`;
        const actionsHtml = `<div class="map-folder-actions" style="display: flex; gap: 2px; align-items: center;">${renameBtnHtml}${delBtnHtml}</div>`;

        const itemEl = createSidebarItem(
            fName,
            `<i class="fa-solid fa-folder text-gradient-gold"></i> <span title="${escapeMapHtml(fName)}" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeMapHtml(fName)}</span>`,
            count,
            folderLive,
            actionsHtml
        );

        const renameBtn = itemEl.querySelector('.map-folder-rename-btn');
        if (renameBtn) {
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = prompt(`Rename folder "${fName}" to:`, fName);
                if (newName === null) return;
                const trimmed = newName.trim();
                if (!trimmed || trimmed === fName) return;
                if (trimmed === '__ALL__' || trimmed === '__UNCATEGORIZED__') {
                    alert('Folder name is reserved. Please choose another name.');
                    return;
                }
                if (camp.mapFolders) {
                    const idx = camp.mapFolders.indexOf(fName);
                    if (idx !== -1) {
                        camp.mapFolders[idx] = trimmed;
                        camp.mapFolders.sort();
                    }
                }
                if (camp.maps) {
                    Object.values(camp.maps).forEach((m) => {
                        if (m.folder === fName) m.folder = trimmed;
                    });
                }
                if (options.vtt?.socket) {
                    options.vtt.socket.emit('map:folder-rename', { oldFolder: fName, newFolder: trimmed });
                }
                if (managerState.activeMapFolder === fName) managerState.activeMapFolder = trimmed;
                renderMapGrid(managerState, options);
            });
        }

        const delBtn = itemEl.querySelector('.map-folder-delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (count === 0) {
                    if (confirm(`Delete empty folder "${fName}"?`)) {
                        if (camp.mapFolders) {
                            camp.mapFolders = camp.mapFolders.filter((f) => f !== fName);
                        }
                        if (options.vtt?.socket) {
                            options.vtt.socket.emit('map:folder-delete', { folder: fName, mode: 'uncategorize' });
                        }
                        if (managerState.activeMapFolder === fName) managerState.activeMapFolder = '__ALL__';
                        renderMapGrid(managerState, options);
                    }
                } else {
                    const choice = prompt(
                        `Folder "${fName}" contains ${count} map(s).\n\nType "uncategorize" to keep maps and delete folder.\nType "delete all" to permanently delete the folder AND its ${count} maps:`,
                        'uncategorize'
                    );
                    if (choice === null) return;
                    const mode = choice.trim().toLowerCase() === 'delete all' ? 'cascade' : 'uncategorize';
                    if (mode === 'cascade') {
                        const totalMaps = Object.keys(camp.maps || {}).length;
                        if (totalMaps - count < 1) {
                            alert('Cannot delete all maps in this folder: a campaign must retain at least one map.');
                            return;
                        }
                    }
                    if (camp.mapFolders) {
                        camp.mapFolders = camp.mapFolders.filter((f) => f !== fName);
                    }
                    if (camp.maps) {
                        if (mode === 'cascade') {
                            folderMaps.forEach((m) => {
                                delete camp.maps[m.id];
                                if (camp.mapOrder) camp.mapOrder = camp.mapOrder.filter((id) => id !== m.id);
                            });
                        } else {
                            folderMaps.forEach((m) => {
                                m.folder = '';
                            });
                        }
                    }
                    if (options.vtt?.socket) {
                        options.vtt.socket.emit('map:folder-delete', { folder: fName, mode });
                    }
                    if (managerState.activeMapFolder === fName) managerState.activeMapFolder = '__ALL__';
                    renderMapGrid(managerState, options);
                }
            });
        }

        sidebarList.appendChild(itemEl);
    });
}

export function executeMapReorder(mapId, action, camp, managerState, options) {
    if (!camp || !camp.maps || !camp.maps[mapId]) return;
    let currentOrder = Array.isArray(camp.mapOrder) ? [...camp.mapOrder] : Object.keys(camp.maps);
    Object.keys(camp.maps).forEach((id) => {
        if (!currentOrder.includes(id)) currentOrder.push(id);
    });
    const curIdx = currentOrder.indexOf(mapId);
    if (curIdx === -1) return;

    currentOrder.splice(curIdx, 1);
    if (action === 'top') {
        currentOrder.unshift(mapId);
    } else if (action === 'bottom') {
        currentOrder.push(mapId);
    } else if (action === 'up') {
        const newIdx = Math.max(0, curIdx - 1);
        currentOrder.splice(newIdx, 0, mapId);
    } else if (action === 'down') {
        const newIdx = Math.min(currentOrder.length, curIdx + 1);
        currentOrder.splice(newIdx, 0, mapId);
    }

    camp.mapOrder = currentOrder;
    if (options.vtt?.socket) {
        options.vtt.socket.emit('map:reorder', {
            mapOrder: currentOrder,
            mapId,
            folder: camp.maps[mapId].folder
        });
    }
    renderMapGrid(managerState, options);
}

export function createMapCard(map, allFolderNames, managerState, options = {}, folderOptionsHtml = '') {
    if (typeof document === 'undefined') return null;

    const camp = options.vtt?.campaignState || {};
    const currentMapId = options.getCurrentMapId ? options.getCurrentMapId() : null;
    const isGlobalActive = camp.activeMapId === map.id;
    const playersOnMap = Object.entries(camp.playerMapOverrides || {})
        .filter(([p, mId]) => mId === map.id)
        .map(([p]) => p);
    const onlinePlayersList = Array.isArray(camp.onlinePlayers) ? camp.onlinePlayers : [];
    const onlineOnThisMap = playersOnMap.filter((p) => {
        const pLower = p.toLowerCase();
        return onlinePlayersList.some((op) => op.toLowerCase() === pLower);
    });
    const isPlayerActive = isGlobalActive || playersOnMap.length > 0;
    // Map is strictly locked from deletion only if it's the global active map or has online players
    const cannotDelete = isGlobalActive || onlineOnThisMap.length > 0;
    let activeText = 'Live';
    let activeClass = 'var(--color-success-base)';

    if (playersOnMap.length > 0 && !isGlobalActive) {
        activeText = playersOnMap.length === 1 ? `Live (${playersOnMap[0]})` : `Live (${playersOnMap.length} Players)`;
        activeClass = onlineOnThisMap.length > 0 ? 'var(--color-blue-base)' : 'rgba(255,255,255,0.25)';
    } else if (isGlobalActive && Object.keys(camp.playerMapOverrides || {}).length > 0) {
        activeText = `Live (Global)`;
        activeClass = 'var(--color-orange-base)';
    }

    const isGmViewing = currentMapId === map.id;
    const rawThumb =
        map.thumbnail ||
        map.mapImage ||
        Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img)?.img ||
        '';
    let thumbUrl = rawThumb;
    const ytThumbMatch = rawThumb
        ? rawThumb.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)
        : null;
    if (ytThumbMatch && ytThumbMatch[1]) {
        thumbUrl = `https://img.youtube.com/vi/${ytThumbMatch[1]}/hqdefault.jpg`;
    }
    const getSafeVttUrl = options.getSafeVttUrl || ((u) => u);
    let safeThumb = thumbUrl ? getSafeVttUrl(thumbUrl) : '';

    const cleanThumb = (safeThumb || '').split('?')[0].toLowerCase();
    const isVideo =
        !ytThumbMatch &&
        Boolean(
            cleanThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i) ||
            (safeThumb && safeThumb.includes('pinimg.com/videos')) ||
            map.isVideo ||
            (map.tokens &&
                Object.values(map.tokens).some(
                    (t) =>
                        t.layer === 'map' &&
                        (t.isVideo || (t.img && t.img.split('?')[0].match(/\.(mp4|webm|ogg|m4v|mov)$/i)))
                ))
        );
    if (isVideo && !cleanThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i)) {
        const mapToken = Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img);
        if (mapToken && mapToken.img) {
            safeThumb = getSafeVttUrl(mapToken.img);
        }
    }
    const isGif = !isVideo && !ytThumbMatch && cleanThumb.endsWith('.gif');

    const folderDropdownInner = folderOptionsHtml
        ? `<option value="">Uncategorized</option>${folderOptionsHtml}`
        : `<option value="" ${!map.folder ? 'selected' : ''}>Uncategorized</option>${allFolderNames.map((f) => `<option value="${escapeMapHtml(f)}" ${map.folder === f ? 'selected' : ''}>${escapeMapHtml(f)}</option>`).join('')}`;

    let el;
    if (managerState.currentMapViewMode === 'list') {
        // Dense List View Row
        el = document.createElement('div');
        el.className = `map-list-row ${isGmViewing ? 'is-viewing' : ''}`;
        el.dataset.mapId = map.id;
        el.innerHTML = `
            <div class="map-drag-handle" draggable="true" title="Drag to reorder or drop onto a sidebar folder">
                <i class="fa-solid fa-grip-vertical"></i>
            </div>
            <div class="map-list-thumb-wrap">
                ${buildMapThumbnailMarkup(map, safeThumb, isVideo, isGif, '1rem')}
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span class="map-name-txt" title="${escapeMapHtml(map.name)}" style="font-weight: 600; font-size: 0.84rem; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; cursor: pointer;">${escapeMapHtml(map.name)}</span>
            </div>
            <!-- Interactive Folder Dropdown in List Row -->
            <div style="width: 135px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--color-text-muted); background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px; min-width: 0;">
                <i class="fa-solid fa-folder text-gradient-gold" style="font-size: 0.65rem; flex-shrink: 0;"></i>
                <select class="map-quick-folder-select" title="Move to folder">
                    ${folderDropdownInner}
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${isPlayerActive ? `<span style="font-size: 0.65rem; background: ${activeClass}; color: #fff; padding: 2px 7px; border-radius: 10px; font-weight: bold; flex-shrink: 0;"><i class="fa-solid fa-users"></i> ${activeText}</span>` : ''}
                ${isGmViewing ? '<span style="font-size: 0.65rem; background: var(--color-gold-base); color: #111; padding: 2px 7px; border-radius: 10px; font-weight: bold; flex-shrink: 0;"><i class="fa-solid fa-eye"></i> Viewing</span>' : ''}
            </div>
            <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
                ${!isGmViewing
                ? `
                    <button class="btn-view-map btn btn-secondary btn-xxs" title="GM View" style="padding: 4px 7px; font-size: 0.72rem;"><i class="fa-solid fa-eye"></i> View</button>
                `
                : `
                    <button class="btn btn-secondary btn-xxs" disabled style="padding: 4px 7px; font-size: 0.72rem; opacity: 0.5;"><i class="fa-solid fa-check"></i> Viewing</button>
                `
            }
                <button class="btn-activate-map btn btn-primary btn-xxs" title="${isPlayerActive ? 'Push more players' : 'Push players to map'}" style="padding: 4px 7px; font-size: 0.72rem; ${isPlayerActive ? `background: ${activeClass}; border-color: transparent;` : ''}">
                    <i class="fa-solid fa-bullhorn"></i> ${isPlayerActive ? 'Push +' : 'Push'}
                </button>
                <button class="btn-reorder-map btn btn-secondary btn-xxs" title="Reorder Map" style="padding: 4px 6px;"><i class="fa-solid fa-arrows-up-down"></i></button>
                <button class="btn-duplicate-map btn btn-secondary btn-xxs" title="Duplicate Map" style="padding: 4px 6px;"><i class="fa-solid fa-clone"></i></button>
                <button class="btn-edit-map btn btn-secondary btn-xxs" title="Edit Map" style="padding: 4px 6px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete-map btn btn-danger btn-xxs" ${cannotDelete ? 'disabled' : ''} title="${cannotDelete ? 'Cannot delete map while players are actively viewing it' : 'Delete Map'}" style="padding: 4px 6px; ${cannotDelete ? 'opacity: 0.35; cursor: not-allowed;' : ''}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    } else {
        // Compact Grid View Card
        el = document.createElement('div');
        el.className = `glass-flat map-card-compact ${isGmViewing ? 'is-viewing' : ''}`;
        el.dataset.mapId = map.id;
        el.innerHTML = `
            <div class="map-card-compact-thumb">
                <div class="map-drag-handle" draggable="true" title="Drag to reorder or drop onto a sidebar folder" style="position: absolute; top: 6px; left: 6px; z-index: 10; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 2px 5px;">
                    <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <div style="position: absolute; top: 6px; right: 6px; display: flex; flex-direction: column; gap: 3px; z-index: 5;">
                    ${isPlayerActive ? `<span style="font-size: 0.62rem; background: ${activeClass}; color: #fff; padding: 2px 6px; border-radius: 12px; font-weight: bold;"><i class="fa-solid fa-users"></i> ${activeText}</span>` : ''}
                    ${isGmViewing ? '<span style="font-size: 0.62rem; background: var(--color-gold-base); color: #111; padding: 2px 6px; border-radius: 12px; font-weight: bold;"><i class="fa-solid fa-eye"></i> Viewing</span>' : ''}
                </div>
                ${buildMapThumbnailMarkup(map, safeThumb, isVideo, isGif, '1.8rem')}
            </div>
            <div class="map-card-compact-body">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; min-width: 0;">
                    <span class="map-name-txt" title="${escapeMapHtml(map.name)}" style="font-family: var(--font-heading); font-weight: 600; font-size: 0.82rem; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1; min-width: 0; cursor: pointer;">${escapeMapHtml(map.name)}</span>
                    <div style="display: flex; gap: 3px; flex-shrink: 0;">
                        <button class="btn-reorder-map btn btn-secondary btn-xxs" title="Reorder Map" style="padding: 2px 5px;"><i class="fa-solid fa-arrows-up-down"></i></button>
                        <button class="btn-duplicate-map btn btn-secondary btn-xxs" title="Duplicate Map" style="padding: 2px 5px;"><i class="fa-solid fa-clone"></i></button>
                        <button class="btn-edit-map btn btn-secondary btn-xxs" title="Edit Map" style="padding: 2px 5px;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-delete-map btn btn-danger btn-xxs" ${cannotDelete ? 'disabled' : ''} title="${cannotDelete ? 'Cannot delete map while players are actively viewing it' : 'Delete Map'}" style="padding: 2px 5px; ${cannotDelete ? 'opacity: 0.35; cursor: not-allowed;' : ''}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <!-- Interactive Folder Dropdown on Card -->
                <div style="display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--color-text-muted); background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 4px; min-width: 0;">
                    <i class="fa-solid fa-folder text-gradient-gold" style="font-size: 0.65rem; flex-shrink: 0;"></i>
                    <select class="map-quick-folder-select" title="Move to folder">
                        ${folderDropdownInner}
                    </select>
                </div>
                <!-- Tight Button Row (No huge gap) -->
                <div class="map-card-compact-buttons">
                    ${!isGmViewing
                ? `
                        <button class="btn-view-map btn btn-secondary btn-xxs" style="flex: 1; min-width: 0; justify-content: center; font-size: 0.72rem; padding: 4px 6px;"><i class="fa-solid fa-eye"></i> View</button>
                    `
                : `
                        <button class="btn btn-secondary btn-xxs" disabled style="flex: 1; min-width: 0; justify-content: center; font-size: 0.72rem; opacity: 0.5; padding: 4px 6px;"><i class="fa-solid fa-check"></i> Viewing</button>
                    `
            }
                    <button class="btn-activate-map btn btn-primary btn-xxs" style="flex: 1; min-width: 0; justify-content: center; font-size: 0.72rem; padding: 4px 6px; ${isPlayerActive ? `background: ${activeClass}; border-color: transparent;` : ''}">
                        <i class="fa-solid fa-bullhorn"></i> ${isPlayerActive ? 'Push +' : 'Push'}
                    </button>
                </div>
            </div>
        `;
    }

    const thumbBox = el.querySelector(
        managerState.currentMapViewMode === 'list' ? '.map-list-thumb-wrap' : '.map-card-compact-thumb'
    );
    if (thumbBox && (isVideo || isGif)) {
        attachThumbnailHoverPreview(thumbBox);
    }
    observeCardThumbnail(el);

    // Folder Dropdown Change Handler
    const quickFolderSelect = el.querySelector('.map-quick-folder-select');
    if (quickFolderSelect) {
        if (map.folder) quickFolderSelect.value = map.folder;
        quickFolderSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const chosen = e.target.value.trim();
            map.folder = chosen;
            if (options.vtt?.socket) {
                options.vtt.socket.emit('map:edit', { mapId: map.id, updates: { folder: chosen } });
            }
            renderMapGrid(managerState, options);
        });
    }

    // Actions
    const btnReorder = el.querySelector('.btn-reorder-map');
    if (btnReorder) {
        btnReorder.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeReorderMenuCleanup) {
                activeReorderMenuCleanup();
            }
            document.querySelectorAll('.map-reorder-dropdown-menu').forEach((m) => m.remove());
            const menu = document.createElement('div');
            menu.className = 'map-reorder-dropdown-menu glassmorphism';
            menu.style.cssText =
                'position: fixed; z-index: 10000; display: flex; flex-direction: column; gap: 3px; padding: 6px; background: rgba(22, 22, 28, 0.96); border: 1px solid var(--color-border-subtle); border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.6); min-width: 135px; font-size: 0.75rem;';

            const rect = btnReorder.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.left = `${Math.max(10, rect.left - 50)}px`;

            const onDocClick = (ev) => {
                if (!menu.contains(ev.target) && ev.target !== btnReorder) {
                    closeMenu();
                }
            };
            const closeMenu = () => {
                menu.remove();
                document.removeEventListener('click', onDocClick);
                if (activeReorderMenuCleanup === closeMenu) {
                    activeReorderMenuCleanup = null;
                }
            };
            activeReorderMenuCleanup = closeMenu;

            const makeActionBtn = (lbl, icon, act) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'btn btn-secondary btn-xxs';
                b.style.cssText =
                    'display: flex; align-items: center; gap: 6px; justify-content: flex-start; padding: 4px 8px; width: 100%; border: none; text-align: left; cursor: pointer;';
                b.innerHTML = `<i class="fa-solid ${icon}" style="width: 14px; text-align: center;"></i> <span>${lbl}</span>`;
                b.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    closeMenu();
                    executeMapReorder(map.id, act, camp, managerState, options);
                });
                return b;
            };

            menu.appendChild(makeActionBtn('Send to Top', 'fa-angles-up', 'top'));
            menu.appendChild(makeActionBtn('Move Up', 'fa-arrow-up', 'up'));
            menu.appendChild(makeActionBtn('Move Down', 'fa-arrow-down', 'down'));
            menu.appendChild(makeActionBtn('Send to Bottom', 'fa-angles-down', 'bottom'));

            document.body.appendChild(menu);
            setTimeout(() => document.addEventListener('click', onDocClick), 10);
        });
    }

    const btnDup = el.querySelector('.btn-duplicate-map');
    if (btnDup) {
        btnDup.addEventListener('click', (e) => {
            e.stopPropagation();
            if (options.vtt?.socket) {
                options.vtt.socket.emit('map:duplicate', { mapId: map.id });
            }
        });
    }

    const btnEdit = el.querySelector('.btn-edit-map');
    if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditMapModal(map, managerState, options);
        });
    }

    const btnDel = el.querySelector('.btn-delete-map');
    if (btnDel) {
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isGlobalActive) {
                alert(`Cannot delete map "${map.name}" while it is the active party map.`);
                return;
            }
            if (onlineOnThisMap.length > 0) {
                alert(
                    `Cannot delete map "${map.name}" while online player(s) (${onlineOnThisMap.join(', ')}) are actively viewing it. Move players to another map first.`
                );
                return;
            }
            if (playersOnMap.length > 0) {
                const confirmed = confirm(
                    `${playersOnMap.length} player(s) (${playersOnMap.join(', ')}) are currently assigned to "${map.name}". Deleting this map will reset their saved position to the main map. Proceed with deletion?`
                );
                if (!confirmed) return;
            } else {
                if (!confirm(`Are you absolutely sure you want to delete map "${map.name}"? This action is permanent.`)) {
                    return;
                }
            }

            if (options.vtt?.socket) {
                options.vtt.socket.emit('map:delete', { mapId: map.id });
            }
        });
    }

    const btnView = el.querySelector('.btn-view-map');
    if (btnView) {
        btnView.addEventListener('click', () => {
            if (options.vtt?.socket) {
                options.vtt.socket.emit('map:switch-gm', { mapId: map.id });
            }
            if (options.loadMap) options.loadMap(map.id);
            renderMapGrid(managerState, options);
        });
    }

    const nameTxt = el.querySelector('.map-name-txt');
    if (nameTxt && !isGmViewing) {
        nameTxt.addEventListener('click', () => {
            if (options.vtt?.socket) {
                options.vtt.socket.emit('map:switch-gm', { mapId: map.id });
            }
            if (options.loadMap) options.loadMap(map.id);
            renderMapGrid(managerState, options);
        });
    }

    const btnAct = el.querySelector('.btn-activate-map');
    if (btnAct) {
        btnAct.addEventListener('click', () => {
            openPushPlayersModal(map.id, options);
        });
    }

    // Setup Drag & Drop Reordering via Grip Handle
    const dragHandle = el.querySelector('.map-drag-handle');
    if (dragHandle) {
        dragHandle.addEventListener('dragstart', (e) => {
            managerState.draggedMapId = map.id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', map.id);
            setTimeout(() => el.classList.add('is-dragging'), 0);
        });
        dragHandle.addEventListener('dragend', () => {
            managerState.draggedMapId = null;
            document
                .querySelectorAll('.is-dragging, .drop-insert-before, .drop-insert-after, .drag-target-over')
                .forEach((node) => {
                    node.classList.remove('is-dragging', 'drop-insert-before', 'drop-insert-after', 'drag-target-over');
                });
        });
    }

    el.addEventListener('dragover', (e) => {
        if (!managerState.draggedMapId || managerState.draggedMapId === map.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const rect = el.getBoundingClientRect();
        const isGrid = managerState.currentMapViewMode === 'grid';
        const isAfter = isGrid ? e.clientX - rect.left > rect.width / 2 : e.clientY - rect.top > rect.height / 2;

        if (isAfter) {
            el.classList.add('drop-insert-after');
            el.classList.remove('drop-insert-before');
        } else {
            el.classList.add('drop-insert-before');
            el.classList.remove('drop-insert-after');
        }
    });

    el.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && el.contains(e.relatedTarget)) return;
        el.classList.remove('drop-insert-before', 'drop-insert-after');
    });

    el.addEventListener('drop', (e) => {
        if (!managerState.draggedMapId || managerState.draggedMapId === map.id) return;
        e.preventDefault();
        const isAfter = el.classList.contains('drop-insert-after');
        el.classList.remove('drop-insert-before', 'drop-insert-after');

        if (!camp || !camp.maps) return;

        let currentOrder = Array.isArray(camp.mapOrder) ? [...camp.mapOrder] : Object.keys(camp.maps);
        Object.keys(camp.maps).forEach((id) => {
            if (!currentOrder.includes(id)) currentOrder.push(id);
        });

        currentOrder = currentOrder.filter((id) => id !== managerState.draggedMapId);
        const targetIdx = currentOrder.indexOf(map.id);
        if (targetIdx !== -1) {
            const insertIdx = isAfter ? targetIdx + 1 : targetIdx;
            currentOrder.splice(insertIdx, 0, managerState.draggedMapId);
        } else {
            currentOrder.push(managerState.draggedMapId);
        }

        camp.mapOrder = currentOrder;

        let folderUpdate = undefined;
        if (managerState.activeMapFolder !== '__ALL__' && managerState.activeMapFolder !== '__UNCATEGORIZED__') {
            if (camp.maps[managerState.draggedMapId].folder !== managerState.activeMapFolder) {
                camp.maps[managerState.draggedMapId].folder = managerState.activeMapFolder;
                folderUpdate = managerState.activeMapFolder;
            }
        } else if (managerState.activeMapFolder === '__UNCATEGORIZED__') {
            if (camp.maps[managerState.draggedMapId].folder) {
                camp.maps[managerState.draggedMapId].folder = '';
                folderUpdate = '';
            }
        }

        if (options.vtt?.socket) {
            options.vtt.socket.emit('map:reorder', {
                mapOrder: currentOrder,
                mapId: managerState.draggedMapId,
                targetMapId: map.id,
                position: isAfter ? 'after' : 'before',
                folder: folderUpdate
            });
        }

        renderMapGrid(managerState, options);
    });

    return el;
}

export function renderMapGrid(managerState, options = {}) {
    if (typeof document === 'undefined') return;
    if (options && Object.keys(options).length > 0) {
        managerState.lastOptions = { ...(managerState.lastOptions || {}), ...options };
    }
    const effectiveOptions = { ...(managerState.lastOptions || {}), ...options };
    const container = document.getElementById('maps-list-container');
    const camp = effectiveOptions.vtt?.campaignState;
    if (!container || !camp || !camp.maps) return;

    initMapManagerControls(managerState, effectiveOptions);

    // Update container view mode class and toggle button states
    if (managerState.currentMapViewMode === 'list') {
        container.classList.remove('mode-grid');
        container.classList.add('mode-list');
    } else {
        container.classList.remove('mode-list');
        container.classList.add('mode-grid');
    }

    const btnGrid = document.getElementById('btn-map-view-grid');
    const btnList = document.getElementById('btn-map-view-list');
    if (btnGrid && btnList) {
        btnGrid.classList.toggle('active', managerState.currentMapViewMode === 'grid');
        btnList.classList.toggle('active', managerState.currentMapViewMode === 'list');
    }

    container.innerHTML = '';
    let allMaps = Object.values(camp.maps);
    const totalAll = allMaps.length;

    // Sort all maps by camp.mapOrder if present
    if (Array.isArray(camp.mapOrder) && camp.mapOrder.length > 0) {
        const orderMap = new Map();
        camp.mapOrder.forEach((id, idx) => orderMap.set(id, idx));
        allMaps.sort((a, b) => {
            const idxA = orderMap.has(a.id) ? orderMap.get(a.id) : 999999;
            const idxB = orderMap.has(b.id) ? orderMap.get(b.id) : 999999;
            return idxA - idxB;
        });
    }

    // Collect all distinct folder names (including saved empty camp.mapFolders)
    const campFolders = Array.isArray(camp.mapFolders) ? camp.mapFolders : [];
    const mapAssignedFolders = allMaps.map((m) => m.folder).filter((f) => f && f.trim());
    const allFolderNames = [...new Set([...campFolders, ...mapAssignedFolders])].sort();

    // Ensure activeMapFolder is valid
    if (
        managerState.activeMapFolder !== '__ALL__' &&
        managerState.activeMapFolder !== '__UNCATEGORIZED__' &&
        !allFolderNames.includes(managerState.activeMapFolder)
    ) {
        managerState.activeMapFolder = '__ALL__';
    }

    // Update total count badge
    const totalBadge = document.getElementById('map-total-count-badge');
    if (totalBadge) totalBadge.textContent = `${totalAll} ${totalAll === 1 ? 'Map' : 'Maps'}`;

    // Render Sidebar
    renderMapSidebar(allMaps, allFolderNames, managerState.activeMapFolder, managerState, effectiveOptions);

    // Filter maps by active folder
    let folderMaps = allMaps;
    let folderTitle = 'All Maps';
    if (managerState.activeMapFolder === '__UNCATEGORIZED__') {
        folderMaps = allMaps.filter((m) => !m.folder || !m.folder.trim());
        folderTitle = 'Uncategorized';
    } else if (managerState.activeMapFolder !== '__ALL__') {
        folderMaps = allMaps.filter((m) => (m.folder || '').trim() === managerState.activeMapFolder);
        folderTitle = managerState.activeMapFolder;
    }

    // Update active folder title & count in toolbar
    const folderNameEl = document.getElementById('map-active-folder-name');
    if (folderNameEl) folderNameEl.textContent = folderTitle;
    const folderCountEl = document.getElementById('map-folder-item-count');
    if (folderCountEl) folderCountEl.textContent = folderMaps.length;

    // Apply search query
    let filteredMaps = folderMaps;
    if (managerState.mapSearchQuery) {
        filteredMaps = folderMaps.filter((m) => {
            const nameMatch = (m.name || '').toLowerCase().includes(managerState.mapSearchQuery);
            const folderMatch = (m.folder || '').toLowerCase().includes(managerState.mapSearchQuery);
            return nameMatch || folderMatch;
        });
    }

    if (totalAll === 0) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--color-text-muted); font-size: 0.85rem; gap: 12px; opacity: 0.6; grid-column: 1 / -1;">
                <i class="fa-solid fa-map" style="font-size: 2.5rem; color: var(--color-gold-base); opacity: 0.4;"></i>
                <span>No maps yet. Click <strong>+ Create New Map</strong> to get started.</span>
            </div>
        `;
        return;
    }

    if (filteredMaps.length === 0) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px; color: var(--color-text-muted); font-size: 0.85rem; gap: 10px; grid-column: 1 / -1;">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; color: var(--color-text-muted); opacity: 0.4;"></i>
                <span>No maps found matching "<strong>${escapeMapHtml(managerState.mapSearchQuery)}</strong>"</span>
                <button type="button" id="btn-clear-map-search" class="btn btn-secondary btn-xs">Clear Search</button>
            </div>
        `;
        const btnClear = container.querySelector('#btn-clear-map-search');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                const input = document.getElementById('map-search-input');
                if (input) {
                    input.value = '';
                    input.dispatchEvent(new Event('input'));
                }
            });
        }
        return;
    }

    // Cancel previous scroll observer and listener
    if (managerState._batchScrollObserver) {
        managerState._batchScrollObserver.disconnect();
        managerState._batchScrollObserver = null;
    }
    if (managerState._batchScrollListener && container) {
        container.removeEventListener('scroll', managerState._batchScrollListener);
        managerState._batchScrollListener = null;
    }

    // Precompute folder options HTML once to avoid repeating in every map card
    const folderOptionsHtml = allFolderNames
        .map((f) => `<option value="${escapeMapHtml(f)}">${escapeMapHtml(f)}</option>`)
        .join('');

    const BATCH_SIZE = 24;
    let renderedCount = 0;

    const renderNextBatch = () => {
        if (renderedCount >= filteredMaps.length) return;
        const nextBatch = filteredMaps.slice(renderedCount, renderedCount + BATCH_SIZE);
        const frag = document.createDocumentFragment();
        nextBatch.forEach((map) => {
            try {
                const card = createMapCard(map, allFolderNames, managerState, effectiveOptions, folderOptionsHtml);
                if (card) frag.appendChild(card);
            } catch (err) {
                console.error('Error rendering map item:', map, err);
            }
        });

        // Remove old sentinel before appending new cards
        const oldSentinel = document.getElementById('map-scroll-sentinel');
        if (oldSentinel && oldSentinel.parentNode) {
            oldSentinel.parentNode.removeChild(oldSentinel);
        }

        container.appendChild(frag);
        renderedCount += nextBatch.length;

        // If more items remain, append a new sentinel and observe
        if (renderedCount < filteredMaps.length) {
            const sentinel = document.createElement('div');
            sentinel.id = 'map-scroll-sentinel';
            sentinel.style.cssText =
                'height: 40px; grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-size: 0.75rem;';
            sentinel.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Loading more maps (${renderedCount} / ${filteredMaps.length})...`;
            container.appendChild(sentinel);

            if (typeof IntersectionObserver !== 'undefined') {
                const obs = new IntersectionObserver(
                    (entries) => {
                        if (entries[0]?.isIntersecting) {
                            obs.disconnect();
                            renderNextBatch();
                        }
                    },
                    { root: container, rootMargin: '200px' }
                );
                obs.observe(sentinel);
                managerState._batchScrollObserver = obs;
            } else {
                const onScroll = () => {
                    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 300) {
                        container.removeEventListener('scroll', onScroll);
                        renderNextBatch();
                    }
                };
                container.addEventListener('scroll', onScroll);
                managerState._batchScrollListener = onScroll;
            }
        }
    };

    renderNextBatch();
}

export function setupEditMapModal(managerState, options = {}) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-edit-map');
    if (!modal) return;

    const cancel = document.getElementById('btn-edit-map-cancel');
    const closeIcon = document.getElementById('btn-edit-map-close-icon');
    const doneBtn = document.getElementById('btn-edit-map-close');

    const cancelAction = () => {
        const mapId = managerState.editingMapId;
        if (mapId && managerState.editingMapInitialSnapshot && options.vtt?.campaignState?.maps?.[mapId]) {
            const original = managerState.editingMapInitialSnapshot;
            // Restore local map object properties from snapshot
            Object.assign(options.vtt.campaignState.maps[mapId], original);

            // Revert active canvas if currently loaded
            const currentMapId = options.getCurrentMapId ? options.getCurrentMapId() : null;
            if (currentMapId === mapId) {
                if (options.vtt?.weatherEngine) {
                    options.vtt.weatherEngine.setWeather(original.weather);
                }
                if (options.setMapBackground && original.mapImage) {
                    options.setMapBackground(original.mapImage);
                }
                if (options.renderAll) {
                    options.renderAll();
                }
            }

            renderMapGrid(managerState, options);
        }

        modal.classList.add('vtt-hidden');
        managerState.isDraft = false;
        managerState.editingMapId = null;
        managerState.editingMapInitialSnapshot = null;
    };

    const saveAndCloseAction = () => {
        const mapId = managerState.editingMapId;
        if (!mapId || !options.vtt?.campaignState?.maps?.[mapId]) {
            modal.classList.add('vtt-hidden');
            managerState.isDraft = false;
            managerState.editingMapId = null;
            managerState.editingMapInitialSnapshot = null;
            return;
        }

        const map = options.vtt.campaignState.maps[mapId];

        // 1. Map Name & Folder
        const nameVal = document.getElementById('edit-map-name')?.value?.trim() || '';
        map.name = nameVal;
        const folderVal = document.getElementById('edit-map-folder')?.value || '';
        map.folder = folderVal;

        // 2. Media URL (sets both thumbnail and mapImage, and updates artwork token)
        const urlVal = document.getElementById('edit-map-url')?.value?.trim() || '';
        map.thumbnail = urlVal;
        map.mapImage = urlVal;
        if (!map.tokens) map.tokens = {};
        let bgToken = Object.values(map.tokens).find((t) => t.layer === 'map' && (t.isBackground || t.isAsset));
        if (bgToken && urlVal) {
            bgToken.img = urlVal;
            const isVideo = !!urlVal.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || urlVal.includes('pinimg.com/videos');
            const isYoutube = urlVal.includes('youtube.com') || urlVal.includes('youtu.be');
            bgToken.isVideo = isVideo || isYoutube;
        } else if (urlVal && !bgToken) {
            const assetId = `asset_${mapId}_map`;
            map.tokens[assetId] = {
                id: assetId,
                name: `${map.name || 'Map'} (Map Artwork)`,
                x: 0,
                y: 0,
                layer: 'map',
                isAsset: true,
                isBackground: true,
                locked: true,
                img: urlVal,
                isVideo:
                    !!urlVal.match(/\.(mp4|webm|ogg)(\?.*)?$/i) ||
                    urlVal.includes('youtube.com') ||
                    urlVal.includes('youtu.be'),
                pixelWidth: 2000,
                pixelHeight: 1500,
                size: 1,
                zIndex: 0,
                isPlayer: false
            };
        }

        // 3. Grid dimensions (top-level properties on map)
        const gwRaw = document.getElementById('edit-map-grid-width')?.value;
        const ghRaw = document.getElementById('edit-map-grid-height')?.value;
        map.gridWidth = gwRaw === '' ? '' : parseFloat(gwRaw);
        map.gridHeight = ghRaw === '' ? '' : parseFloat(ghRaw);

        // 4. Grid settings
        if (!map.grid) {
            map.grid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5, type: 'square' };
        }
        const gType = document.getElementById('edit-map-grid-type')?.value || 'square';
        const gSize = parseFloat(document.getElementById('edit-map-grid-size')?.value) || 50;
        const offX = parseFloat(document.getElementById('edit-map-offset-x')?.value) || 0;
        const offY = parseFloat(document.getElementById('edit-map-offset-y')?.value) || 0;
        const gColor = document.getElementById('edit-map-grid-color')?.value || '#888888';
        const gOpacity = parseFloat(document.getElementById('edit-map-grid-opacity')?.value) ?? 0.3;

        map.grid.type = gType;
        map.grid.size = gSize;
        map.grid.offsetX = offX;
        map.grid.offsetY = offY;
        map.grid.color = gColor;
        map.grid.opacity = gOpacity;

        // Distance settings
        const distRaw = parseFloat(document.getElementById('edit-map-dist-val')?.value);
        const distVal = !isNaN(distRaw) && distRaw > 0 ? distRaw : 5;
        const distUnit = document.getElementById('edit-map-dist-unit')?.value || 'ft';
        const distCustom = document.getElementById('edit-map-dist-unit-custom')?.value?.trim();
        const finalUnit = distUnit === 'custom' ? distCustom || 'custom' : distUnit;

        map.grid.feetPerSquare = distVal;
        map.grid.distancePerSquare = distVal;
        map.grid.distanceUnit = finalUnit;

        // 5. Lighting settings
        if (!map.lightingSettings) {
            map.lightingSettings = {
                fogOfWar: true,
                daylightMode: false,
                restrictMovement: false,
                updateOnDrop: true
            };
        }
        map.lightingSettings.fogOfWar = document.getElementById('edit-map-fog-of-war')?.checked !== false;
        map.lightingSettings.daylightMode = !!document.getElementById('edit-map-daylight-mode')?.checked;
        map.lightingSettings.restrictMovement = !!document.getElementById('edit-map-restrict-movement')?.checked;
        map.lightingSettings.updateOnDrop = document.getElementById('edit-map-update-on-drop')?.checked !== false;

        // 6. Weather settings
        map.weather = {
            effects: (managerState.currentEditingWeatherLayers || []).map((l) => ({ ...l })),
            saturation: managerState.currentEditingWeatherSaturation ?? 100
        };

        const updates = {
            name: map.name,
            folder: map.folder,
            thumbnail: map.thumbnail,
            mapImage: map.mapImage,
            gridWidth: map.gridWidth,
            gridHeight: map.gridHeight,
            grid: map.grid,
            lightingSettings: map.lightingSettings,
            weather: map.weather,
            tokens: map.tokens
        };

        // Sync to server via WebSocket in a single consolidated payload
        if (options.vtt?.socket) {
            options.vtt.socket.emit('map:edit', { mapId, updates });
        }

        // Live refresh of active map if currently loaded
        const currentMapId = options.getCurrentMapId ? options.getCurrentMapId() : null;
        if (currentMapId === mapId) {
            if (options.vtt?.weatherEngine) {
                options.vtt.weatherEngine.setWeather(map.weather);
            }
            if (options.setMapBackground && map.mapImage) {
                options.setMapBackground(map.mapImage);
            }
            if (options.renderAll) {
                options.renderAll();
            }
        }

        // Re-render map cards in Campaign Map Manager
        renderMapGrid(managerState, options);

        modal.classList.add('vtt-hidden');
        managerState.isDraft = false;
        managerState.editingMapId = null;
        managerState.editingMapInitialSnapshot = null;
    };

    if (cancel) cancel.addEventListener('click', cancelAction);
    if (closeIcon) closeIcon.addEventListener('click', cancelAction);
    if (doneBtn) doneBtn.addEventListener('click', saveAndCloseAction);

    const editDistUnitEl = document.getElementById('edit-map-dist-unit');
    const editDistCustomWrap = document.getElementById('edit-map-dist-unit-custom-wrap');
    const editDistCustomInput = document.getElementById('edit-map-dist-unit-custom');

    if (editDistUnitEl) {
        editDistUnitEl.addEventListener('change', () => {
            if (editDistUnitEl.value === 'custom') {
                if (editDistCustomWrap) editDistCustomWrap.classList.remove('vtt-hidden');
                if (editDistCustomInput) editDistCustomInput.focus();
            } else {
                if (editDistCustomWrap) editDistCustomWrap.classList.add('vtt-hidden');
            }
        });
    }
}

export function openEditMapModal(map, managerState, options = {}) {
    if (typeof document === 'undefined') return;
    managerState.editingMapId = map.id;
    managerState.editingMapInitialSnapshot = JSON.parse(JSON.stringify(map));
    document.getElementById('edit-map-name').value = map.name || '';
    const editFolderEl = document.getElementById('edit-map-folder');
    if (editFolderEl && options.vtt?.campaignState) {
        const camp = options.vtt.campaignState;
        const campFolders = Array.isArray(camp.mapFolders) ? camp.mapFolders : [];
        const mapFolders = Object.values(camp.maps || {})
            .map((m) => m.folder)
            .filter((f) => f && f.trim());
        const allFolders = [...new Set([...campFolders, ...mapFolders])].sort();
        editFolderEl.innerHTML = `
            <option value="">Uncategorized</option>
            ${allFolders.map((f) => `<option value="${escapeMapHtml(f)}" ${map.folder === f ? 'selected' : ''}>${escapeMapHtml(f)}</option>`).join('')}
        `;
        editFolderEl.value = map.folder || '';
    }
    const bgToken = Object.values(map.tokens || {}).find((t) => t.layer === 'map' && (t.isBackground || t.isAsset));
    const effectiveMapUrl = bgToken?.img || map.mapImage || map.thumbnail || '';
    document.getElementById('edit-map-url').value = effectiveMapUrl;
    document.getElementById('edit-map-grid-width').value = map.gridWidth || '';
    document.getElementById('edit-map-grid-height').value = map.gridHeight || '';

    const g = map.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5, type: 'square' };
    document.getElementById('edit-map-grid-type').value = g.type || 'square';
    document.getElementById('edit-map-grid-size').value = g.size || 50;
    document.getElementById('edit-map-offset-x').value = g.offsetX || 0;
    document.getElementById('edit-map-offset-y').value = g.offsetY || 0;
    document.getElementById('edit-map-grid-color').value = g.color || '#888888';
    document.getElementById('edit-map-grid-opacity').value = g.opacity || 0.3;

    const getGridDistanceSettings =
        options.getGridDistanceSettings ||
        ((grid) => ({ val: grid?.feetPerSquare || 5, unit: grid?.distanceUnit || 'ft' }));
    const distSettings = getGridDistanceSettings(g);
    const editDistValEl = document.getElementById('edit-map-dist-val');
    const editDistUnitEl = document.getElementById('edit-map-dist-unit');
    const editCustomWrap = document.getElementById('edit-map-dist-unit-custom-wrap');
    const editCustomInput = document.getElementById('edit-map-dist-unit-custom');

    if (editDistValEl) editDistValEl.value = distSettings.val;
    if (editDistUnitEl) {
        const knownUnits = ['ft', 'mi', 'km', 'm', 'hex', 'yd'];
        if (knownUnits.includes(distSettings.unit)) {
            editDistUnitEl.value = distSettings.unit;
            if (editCustomWrap) editCustomWrap.classList.add('vtt-hidden');
            if (editCustomInput) editCustomInput.value = '';
        } else {
            editDistUnitEl.value = 'custom';
            if (editCustomWrap) editCustomWrap.classList.remove('vtt-hidden');
            if (editCustomInput) editCustomInput.value = distSettings.unit;
        }
    }

    const ls = map.lightingSettings || {
        fogOfWar: true,
        daylightMode: false,
        restrictMovement: false,
        updateOnDrop: true
    };
    const fogEl = document.getElementById('edit-map-fog-of-war');
    if (fogEl) fogEl.checked = ls.fogOfWar !== false;
    document.getElementById('edit-map-daylight-mode').checked = !!ls.daylightMode;
    document.getElementById('edit-map-restrict-movement').checked = !!ls.restrictMovement;
    document.getElementById('edit-map-update-on-drop').checked = ls.updateOnDrop !== false;

    // Weather settings initialization
    managerState.isDraft = true;
    if (options.parseWeatherSettings) {
        const parsedWeather = options.parseWeatherSettings(map.weather);
        managerState.currentEditingWeatherLayers = parsedWeather.effects;
        managerState.currentEditingWeatherSaturation = parsedWeather.saturation;
    }

    const satEl = document.getElementById('edit-map-weather-saturation');
    const satValEl = document.getElementById('edit-map-weather-sat-val');
    if (satEl) satEl.value = managerState.currentEditingWeatherSaturation ?? 100;
    if (satValEl) satValEl.textContent = `${managerState.currentEditingWeatherSaturation ?? 100}%`;

    if (options.renderWeatherLayersUI) {
        options.renderWeatherLayersUI(managerState, options);
    }

    document.getElementById('modal-edit-map').classList.remove('vtt-hidden');
}

export function setupMapUploadControls(managerState, options = {}) {
    if (typeof document === 'undefined') return;
    const btnChangeMap = document.getElementById('btn-change-map');
    const modal = document.getElementById('modal-upload-map');
    const cancel = document.getElementById('btn-map-modal-cancel');

    const mapSelect = document.getElementById('map-select-source');
    const uploadPanel = document.getElementById('map-upload-panel');
    const urlPanel = document.getElementById('map-url-panel');

    const fileInput = document.getElementById('map-file-input');
    const fileNameSpan = document.getElementById('map-file-name');
    const urlInput = document.getElementById('map-url-input');

    // 5eTools specific elements
    const toolsPanel = document.getElementById('map-5etools-panel');
    const advSelect = document.getElementById('map-5etools-adventure');
    const mapDropdown = document.getElementById('map-5etools-map');

    // Create Panel toggles
    const btnOpenImport = document.getElementById('btn-map-modal-open-import');
    const btnOpenCreate = document.getElementById('btn-map-modal-open-create');
    const createPanel = document.getElementById('map-create-panel');
    const btnCreateCancel = document.getElementById('btn-map-create-cancel');
    const btnCreateSubmit = document.getElementById('btn-map-create-submit');
    const btnBulkImport = document.getElementById('btn-map-bulk-import');
    const newMapNameInput = document.getElementById('new-map-name');
    const newMapFolderInput = document.getElementById('new-map-folder');
    const newMapGridTypeSelect = document.getElementById('new-map-grid-type');
    const newMapDistValInput = document.getElementById('new-map-dist-val');
    const newMapDistUnitSelect = document.getElementById('new-map-dist-unit');
    const newMapDistCustomWrap = document.getElementById('new-map-dist-unit-custom-wrap');
    const newMapDistCustomInput = document.getElementById('new-map-dist-unit-custom');

    // New Grid & Scene custom controls
    const newMapGridWidthInput = document.getElementById('new-map-grid-width');
    const newMapGridHeightInput = document.getElementById('new-map-grid-height');
    const newMapGridSizeInput = document.getElementById('new-map-grid-size');
    const newMapGridColorInput = document.getElementById('new-map-grid-color');
    const newMapGridOpacityInput = document.getElementById('new-map-grid-opacity');
    const newMapFogOfWarInput = document.getElementById('new-map-fog-of-war');
    const newMapDaylightModeInput = document.getElementById('new-map-daylight-mode');

    const resetCreationFields = () => {
        if (newMapNameInput) newMapNameInput.value = '';
        if (newMapFolderInput) {
            newMapFolderInput.value = '';
            newMapFolderInput.dataset.autoFilled = 'false';
        }
        if (newMapGridTypeSelect) newMapGridTypeSelect.value = 'square';
        if (newMapDistValInput) newMapDistValInput.value = 5;
        if (newMapDistUnitSelect) newMapDistUnitSelect.value = 'ft';
        if (newMapDistCustomWrap) newMapDistCustomWrap.classList.add('vtt-hidden');
        if (newMapDistCustomInput) newMapDistCustomInput.value = '';
        if (newMapGridWidthInput) newMapGridWidthInput.value = 40;
        if (newMapGridHeightInput) newMapGridHeightInput.value = 30;
        if (newMapGridSizeInput) newMapGridSizeInput.value = 50;
        if (newMapGridColorInput) newMapGridColorInput.value = '#888888';
        if (newMapGridOpacityInput) newMapGridOpacityInput.value = 0.3;
        if (newMapFogOfWarInput) newMapFogOfWarInput.checked = true;
        if (newMapDaylightModeInput) newMapDaylightModeInput.checked = false;
        if (urlInput) urlInput.value = '';
        if (fileInput) fileInput.value = '';
        if (fileNameSpan) fileNameSpan.textContent = 'No file selected.';
        updateFolderDatalist();
    };

    const getSafeVttUrl = options.getSafeVttUrl || ((u) => u);

    if (newMapDistUnitSelect) {
        newMapDistUnitSelect.addEventListener('change', () => {
            if (newMapDistUnitSelect.value === 'custom') {
                if (newMapDistCustomWrap) newMapDistCustomWrap.classList.remove('vtt-hidden');
                if (newMapDistCustomInput) newMapDistCustomInput.focus();
            } else {
                if (newMapDistCustomWrap) newMapDistCustomWrap.classList.add('vtt-hidden');
            }
        });
    }

    const updateFolderDatalist = () => {
        const datalist = document.getElementById('map-existing-folders-datalist');
        const camp = options.vtt?.campaignState;
        if (!datalist || !camp) return;
        const fromMaps = Object.values(camp.maps || {})
            .map((m) => m.folder)
            .filter((f) => f && f.trim());
        const fromFolders = (camp.mapFolders || []).filter((f) => f && f.trim());
        const folders = [...new Set([...fromMaps, ...fromFolders])].sort();
        datalist.innerHTML = folders.map((f) => `<option value="${escapeMapHtml(f)}"></option>`).join('');
    };

    if (btnChangeMap) {
        btnChangeMap.addEventListener('click', () => {
            if (modal) modal.classList.remove('vtt-hidden');
            if (createPanel) createPanel.classList.add('vtt-hidden');
            updateFolderDatalist();
            renderMapGrid(managerState, options);
        });
    }

    if (!window._vttMapManagerEscapeBound) {
        window._vttMapManagerEscapeBound = true;
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const pushModal = document.getElementById('modal-push-players');
            if (pushModal && !pushModal.classList.contains('vtt-hidden')) {
                pushModal.classList.add('vtt-hidden');
                return;
            }
            const editModal = document.getElementById('modal-edit-map');
            if (editModal && !editModal.classList.contains('vtt-hidden')) {
                const cancelBtn = document.getElementById('btn-edit-map-cancel');
                if (cancelBtn) cancelBtn.click();
                else editModal.classList.add('vtt-hidden');
                return;
            }
            const uploadModal = document.getElementById('modal-upload-map');
            if (uploadModal && !uploadModal.classList.contains('vtt-hidden')) {
                const createDrawer = document.getElementById('map-creation-drawer');
                if (createDrawer && !createDrawer.classList.contains('vtt-hidden')) {
                    createDrawer.classList.add('vtt-hidden');
                } else {
                    uploadModal.classList.add('vtt-hidden');
                }
            }
        });
    }

    if (cancel)
        cancel.addEventListener('click', () => {
            if (modal) modal.classList.add('vtt-hidden');
        });
    const closeIcon = document.getElementById('btn-map-modal-close-icon');
    if (closeIcon)
        closeIcon.addEventListener('click', () => {
            if (modal) modal.classList.add('vtt-hidden');
        });

    if (btnOpenImport) {
        btnOpenImport.addEventListener('click', () => {
            if (createPanel) createPanel.classList.remove('vtt-hidden');
            resetCreationFields();

            if (mapSelect) mapSelect.value = '5etools';
            if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
            if (urlPanel) urlPanel.classList.add('vtt-hidden');
            if (toolsPanel) {
                toolsPanel.classList.remove('vtt-hidden');
                if (window.VTT?.dataBridge?.load5eToolsMapCatalog) {
                    window.VTT.dataBridge.load5eToolsMapCatalog(advSelect, mapDropdown);
                }
            }

            const modalContent = document.querySelector('#modal-upload-map .modal-content');
            if (modalContent) setTimeout(() => (modalContent.scrollTop = 0), 50);
        });
    }

    if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => {
            if (createPanel) createPanel.classList.remove('vtt-hidden');
            resetCreationFields();

            if (mapSelect) mapSelect.value = 'blank';
            if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
            if (urlPanel) urlPanel.classList.add('vtt-hidden');
            if (toolsPanel) toolsPanel.classList.add('vtt-hidden');

            const modalContent = document.querySelector('#modal-upload-map .modal-content');
            if (modalContent) setTimeout(() => (modalContent.scrollTop = 0), 50);
        });
    }

    if (btnCreateCancel)
        btnCreateCancel.addEventListener('click', () => {
            if (createPanel) createPanel.classList.add('vtt-hidden');
        });

    if (advSelect) {
        advSelect.addEventListener('change', () => {
            const advName = advSelect.options[advSelect.selectedIndex]?.textContent?.trim() || '';
            if (
                newMapFolderInput &&
                (!newMapFolderInput.value.trim() || newMapFolderInput.dataset.autoFilled === 'true')
            ) {
                if (advName && advSelect.value) {
                    newMapFolderInput.value = advName;
                    newMapFolderInput.dataset.autoFilled = 'true';
                }
            }
            setTimeout(() => {
                if (advSelect.value && mapDropdown && mapDropdown.options.length > 1) {
                    if (btnBulkImport) btnBulkImport.disabled = false;
                } else {
                    if (btnBulkImport) btnBulkImport.disabled = true;
                }
            }, 100);
        });
    }

    if (mapDropdown) {
        mapDropdown.addEventListener('change', () => {
            if (mapDropdown.selectedIndex >= 0 && mapDropdown.value) {
                const selectedText = mapDropdown.options[mapDropdown.selectedIndex].textContent;
                if (
                    selectedText &&
                    newMapNameInput &&
                    (!newMapNameInput.value.trim() || newMapNameInput.dataset.autoFilled === 'true')
                ) {
                    newMapNameInput.value = selectedText;
                    newMapNameInput.dataset.autoFilled = 'true';
                }
            }
        });
    }

    if (newMapNameInput) {
        newMapNameInput.addEventListener('input', () => {
            newMapNameInput.dataset.autoFilled = 'false';
        });
    }

    if (newMapFolderInput) {
        newMapFolderInput.addEventListener('input', () => {
            newMapFolderInput.dataset.autoFilled = 'false';
        });
    }

    if (btnBulkImport) {
        btnBulkImport.addEventListener('click', async () => {
            const advId = advSelect ? advSelect.value : null;
            if (!advId) return;

            const mapOptions = mapDropdown ? Array.from(mapDropdown.options).filter((opt) => opt.value) : [];
            if (mapOptions.length === 0) return alert('No maps found for this adventure.');

            const advName = advSelect.options[advSelect.selectedIndex]?.textContent?.trim() || advId;
            const targetFolder = prompt(`Enter folder/category for these ${mapOptions.length} maps:`, advName);
            if (targetFolder === null) return;

            if (
                !confirm(
                    `This adventure has ${mapOptions.length} maps. Are you sure you want to bulk import all of them into "${targetFolder.trim() || 'Uncategorized'}"? This may take a minute.`
                )
            ) {
                return;
            }

            btnBulkImport.disabled = true;
            if (btnCreateSubmit) btnCreateSubmit.disabled = true;
            const originalText = btnBulkImport.innerHTML;

            const importedMaps = [];
            for (let i = 0; i < mapOptions.length; i++) {
                const mapId = mapOptions[i].value;
                const mapName = mapOptions[i].textContent;

                btnBulkImport.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Parsing ${i + 1}/${mapOptions.length}...`;

                try {
                    if (window.VTT?.dataBridge?.import5etoolsMap) {
                        const importedMap = await window.VTT.dataBridge.import5etoolsMap(advId, mapId);
                        if (importedMap) {
                            importedMap.name = mapName;
                            if (targetFolder.trim()) {
                                importedMap.folder = targetFolder.trim();
                            }
                            importedMaps.push(importedMap);
                        }
                    }
                } catch (e) {
                    console.error(`Error importing map ${mapName}:`, e);
                }
            }

            if (importedMaps.length > 0 && options.vtt?.socket) {
                btnBulkImport.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving ${importedMaps.length} maps...`;
                options.vtt.socket.emit('map:bulk-create', {
                    maps: importedMaps,
                    targetFolder: targetFolder.trim()
                });
            }

            btnBulkImport.innerHTML = originalText;
            btnBulkImport.disabled = false;
            if (btnCreateSubmit) btnCreateSubmit.disabled = false;

            if (createPanel) createPanel.classList.add('vtt-hidden');
            renderMapGrid(managerState, options);
        });
    }

    if (mapSelect) {
        mapSelect.addEventListener('change', () => {
            if (mapSelect.value === 'upload') {
                if (uploadPanel) uploadPanel.classList.remove('vtt-hidden');
                if (urlPanel) urlPanel.classList.add('vtt-hidden');
                if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
            } else if (mapSelect.value === 'url') {
                if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                if (urlPanel) urlPanel.classList.remove('vtt-hidden');
                if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
            } else if (mapSelect.value === '5etools') {
                if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                if (urlPanel) urlPanel.classList.add('vtt-hidden');
                if (toolsPanel) {
                    toolsPanel.classList.remove('vtt-hidden');
                    if (window.VTT?.dataBridge?.load5eToolsMapCatalog) {
                        window.VTT.dataBridge.load5eToolsMapCatalog(advSelect, mapDropdown);
                    }
                }
            } else {
                if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                if (urlPanel) urlPanel.classList.add('vtt-hidden');
                if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0 && fileNameSpan) {
                fileNameSpan.textContent = fileInput.files[0].name;
            }
        });
    }

    if (btnCreateSubmit) {
        btnCreateSubmit.addEventListener('click', async () => {
            const name = newMapNameInput.value.trim();
            const folder = newMapFolderInput ? newMapFolderInput.value.trim() : '';
            const chosenGridType = newMapGridTypeSelect ? newMapGridTypeSelect.value : 'square';
            const rawDistVal = parseFloat(newMapDistValInput?.value);
            const chosenDistVal = !isNaN(rawDistVal) && rawDistVal > 0 ? rawDistVal : 5;
            const chosenUnitSelect = newMapDistUnitSelect?.value || 'ft';
            const customUnitVal = newMapDistCustomInput?.value?.trim();
            const chosenDistanceUnit = chosenUnitSelect === 'custom' ? customUnitVal || 'custom' : chosenUnitSelect;

            const rawGridWidth = parseInt(newMapGridWidthInput?.value, 10);
            const rawGridHeight = parseInt(newMapGridHeightInput?.value, 10);
            const rawGridSize = parseFloat(newMapGridSizeInput?.value);
            const chosenGridSize = !isNaN(rawGridSize) && rawGridSize >= 20 ? rawGridSize : 50;
            const chosenGridColor = newMapGridColorInput?.value || '#888888';
            const rawGridOpacity = parseFloat(newMapGridOpacityInput?.value);
            const chosenGridOpacity = !isNaN(rawGridOpacity) ? Math.min(1, Math.max(0, rawGridOpacity)) : 0.3;
            const chosenFogOfWar = newMapFogOfWarInput ? newMapFogOfWarInput.checked : true;
            const chosenDaylightMode = newMapDaylightModeInput ? newMapDaylightModeInput.checked : false;

            if (!name) return alert('Please enter a map name');

            if (mapSelect.value === 'blank') {
                const targetWidth = !isNaN(rawGridWidth) && rawGridWidth > 0 ? rawGridWidth : 40;
                const targetHeight = !isNaN(rawGridHeight) && rawGridHeight > 0 ? rawGridHeight : 30;
                if (options.vtt?.socket) {
                    options.vtt.socket.emit('map:create', {
                        name,
                        folder,
                        mapImage: '',
                        thumbnail: '',
                        gridWidth: targetWidth,
                        gridHeight: targetHeight,
                        grid: {
                            size: chosenGridSize,
                            offsetX: 0,
                            offsetY: 0,
                            scale: 1.0,
                            feetPerSquare: chosenDistVal,
                            distancePerSquare: chosenDistVal,
                            distanceUnit: chosenDistanceUnit,
                            type: chosenGridType,
                            color: chosenGridColor,
                            opacity: chosenGridOpacity
                        },
                        lightingSettings: {
                            fogOfWar: chosenFogOfWar,
                            daylightMode: chosenDaylightMode,
                            restrictMovement: true,
                            updateOnDrop: true
                        },
                        tokens: {},
                        walls: [],
                        notes: [],
                        lights: [],
                        shapes: {}
                    });
                }
                createPanel.classList.add('vtt-hidden');
                renderMapGrid(managerState, options);
            } else if (mapSelect.value === 'url') {
                let url = urlInput.value.trim();
                if (!url) return alert('Please enter image URL');

                try {
                    btnCreateSubmit.disabled = true;
                    btnCreateSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resolving...';
                    if (window.VTT && typeof window.VTT.resolveMediaUrl === 'function') {
                        const res = await window.VTT.resolveMediaUrl(url);
                        if (res && res.resolvedUrl) {
                            url = res.resolvedUrl;
                        }
                    }

                    const ytMatch = url.match(
                        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
                    );
                    const isYt = !!ytMatch;
                    const ytVideoId = ytMatch ? ytMatch[1] : null;
                    let embedUrl = url;
                    let thumbUrl = url;
                    let nw = 2000;
                    let nh = 1500;
                    const gSize = chosenGridSize;
                    let gWidth = !isNaN(rawGridWidth) && rawGridWidth > 0 ? rawGridWidth : Math.ceil(nw / gSize);
                    let gHeight = !isNaN(rawGridHeight) && rawGridHeight > 0 ? rawGridHeight : Math.ceil(nh / gSize);

                    const isVideoUrl =
                        isYt || !!url.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || url.includes('pinimg.com/videos');
                    if (isYt) {
                        embedUrl = `https://www.youtube.com/embed/${ytVideoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${ytVideoId}`;
                        thumbUrl = `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`;
                        gWidth = !isNaN(rawGridWidth) && rawGridWidth > 0 ? rawGridWidth : 38;
                        gHeight = !isNaN(rawGridHeight) && rawGridHeight > 0 ? rawGridHeight : 22;
                        nw = gWidth * gSize;
                        nh = gHeight * gSize;
                    } else {
                        const { width: probedW, height: probedH } = await probeMediaDimensions(
                            getSafeVttUrl(url),
                            isVideoUrl
                        );
                        nw = probedW;
                        nh = probedH;
                        gWidth = !isNaN(rawGridWidth) && rawGridWidth > 0 ? rawGridWidth : Math.ceil(nw / gSize);
                        gHeight = !isNaN(rawGridHeight) && rawGridHeight > 0 ? rawGridHeight : Math.ceil(nh / gSize);
                    }

                    const assetId = `asset_${Date.now()}_map`;
                    const initialTokens = {
                        [assetId]: {
                            id: assetId,
                            name: `${name} (Map Artwork)`,
                            x: 0,
                            y: 0,
                            layer: 'map',
                            isAsset: true,
                            isBackground: true,
                            locked: true,
                            img: isYt ? embedUrl : url,
                            isVideo: isVideoUrl,
                            pixelWidth: nw,
                            pixelHeight: nh,
                            size: 1,
                            zIndex: 0,
                            isPlayer: false
                        }
                    };

                    if (options.vtt?.socket) {
                        options.vtt.socket.emit('map:create', {
                            name,
                            folder,
                            mapImage: isYt ? '' : url,
                            thumbnail: thumbUrl,
                            isVideo: isVideoUrl,
                            gridWidth: gWidth,
                            gridHeight: gHeight,
                            grid: {
                                size: gSize,
                                offsetX: 0,
                                offsetY: 0,
                                scale: 1.0,
                                feetPerSquare: chosenDistVal,
                                distancePerSquare: chosenDistVal,
                                distanceUnit: chosenDistanceUnit,
                                type: chosenGridType,
                                color: chosenGridColor,
                                opacity: chosenGridOpacity
                            },
                            lightingSettings: {
                                fogOfWar: chosenFogOfWar,
                                daylightMode: chosenDaylightMode,
                                restrictMovement: true,
                                updateOnDrop: true
                            },
                            tokens: initialTokens,
                            walls: [],
                            notes: [],
                            lights: [],
                            shapes: {}
                        });
                    }
                    createPanel.classList.add('vtt-hidden');
                    renderMapGrid(managerState, options);
                } catch (e) {
                    console.warn('[map:create] URL resolution warning:', e);
                } finally {
                    btnCreateSubmit.disabled = false;
                    btnCreateSubmit.innerHTML = 'Create Map';
                }
            } else if (mapSelect.value === '5etools') {
                const advId = advSelect.value;
                const mapId = mapDropdown.value;
                if (!advId || !mapId) return alert('Please select an adventure and a map to import.');

                let targetFolder = folder;
                if (!targetFolder) {
                    const advName = advSelect.options[advSelect.selectedIndex]?.textContent?.trim() || advId;
                    const prompted = prompt('Enter folder/category for this map:', advName);
                    if (prompted === null) return;
                    targetFolder = prompted.trim();
                }

                try {
                    btnCreateSubmit.disabled = true;
                    btnCreateSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing Map...';
                    if (window.VTT && window.VTT.dataBridge && window.VTT.dataBridge.import5etoolsMap) {
                        const importedMap = await window.VTT.dataBridge.import5etoolsMap(advId, mapId);
                        if (importedMap) {
                            importedMap.name = name;
                            if (targetFolder) importedMap.folder = targetFolder;
                            if (!importedMap.grid) {
                                importedMap.grid = {
                                    size: 50,
                                    offsetX: 0,
                                    offsetY: 0,
                                    scale: 1.0,
                                    feetPerSquare: chosenDistVal,
                                    distancePerSquare: chosenDistVal,
                                    distanceUnit: chosenDistanceUnit,
                                    type: chosenGridType,
                                    color: '#888888',
                                    opacity: 0.3
                                };
                            } else {
                                importedMap.grid.feetPerSquare = chosenDistVal;
                                importedMap.grid.distancePerSquare = chosenDistVal;
                                importedMap.grid.distanceUnit = chosenDistanceUnit;
                                if (
                                    chosenGridType !== 'square' &&
                                    (!importedMap.grid.type || importedMap.grid.type === 'square')
                                ) {
                                    importedMap.grid.type = chosenGridType;
                                }
                            }
                            if (options.vtt?.socket) {
                                options.vtt.socket.emit('map:create', importedMap);
                            }
                            createPanel.classList.add('vtt-hidden');
                            renderMapGrid(managerState, options);
                        } else {
                            alert('Error parsing the selected map.');
                        }
                    }
                } catch (err) {
                    console.error('Error importing 5etools map:', err);
                    alert('Failed to import 5etools map: ' + (err.message || err));
                } finally {
                    btnCreateSubmit.disabled = false;
                    btnCreateSubmit.innerHTML = 'Create Map';
                }
            } else {
                // File upload via REST api
                if (fileInput.files.length === 0) return alert('Select a file first');
                const file = fileInput.files[0];
                const isVideoFile = !!file.type.match(/^video\//i) || !!file.name.match(/\.(mp4|webm|ogg)$/i);
                const formData = new FormData();
                formData.append('image', file);

                try {
                    btnCreateSubmit.disabled = true;
                    btnCreateSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const uploadedUrl = data.url;

                        const { width: nw, height: nh } = await probeMediaDimensions(
                            getSafeVttUrl(uploadedUrl),
                            isVideoFile
                        );

                        const gSize = chosenGridSize;
                        const gWidth = !isNaN(rawGridWidth) && rawGridWidth > 0 ? rawGridWidth : Math.ceil(nw / gSize);
                        const gHeight =
                            !isNaN(rawGridHeight) && rawGridHeight > 0 ? rawGridHeight : Math.ceil(nh / gSize);
                        const assetId = `asset_${Date.now()}_map`;
                        const initialTokens = {
                            [assetId]: {
                                id: assetId,
                                name: `${name} (Map Artwork)`,
                                x: 0,
                                y: 0,
                                layer: 'map',
                                isAsset: true,
                                isBackground: true,
                                locked: true,
                                img: uploadedUrl,
                                isVideo: isVideoFile,
                                pixelWidth: nw,
                                pixelHeight: nh,
                                size: 1,
                                zIndex: 0,
                                isPlayer: false
                            }
                        };

                        if (options.vtt?.socket) {
                            options.vtt.socket.emit('map:create', {
                                name,
                                folder,
                                mapImage: uploadedUrl,
                                thumbnail: uploadedUrl,
                                isVideo: isVideoFile,
                                gridWidth: gWidth,
                                gridHeight: gHeight,
                                grid: {
                                    size: gSize,
                                    offsetX: 0,
                                    offsetY: 0,
                                    scale: 1.0,
                                    feetPerSquare: chosenDistVal,
                                    distancePerSquare: chosenDistVal,
                                    distanceUnit: chosenDistanceUnit,
                                    type: chosenGridType,
                                    color: chosenGridColor,
                                    opacity: chosenGridOpacity
                                },
                                lightingSettings: {
                                    fogOfWar: chosenFogOfWar,
                                    daylightMode: chosenDaylightMode,
                                    restrictMovement: true,
                                    updateOnDrop: true
                                },
                                tokens: initialTokens,
                                walls: [],
                                notes: [],
                                lights: [],
                                shapes: {}
                            });
                        }
                        createPanel.classList.add('vtt-hidden');
                        renderMapGrid(managerState, options);
                    } else {
                        alert('Image upload failed');
                    }
                } catch (err) {
                    console.error('Upload error:', err);
                    alert('Image upload error: ' + (err.message || err));
                } finally {
                    btnCreateSubmit.disabled = false;
                    btnCreateSubmit.innerHTML = 'Create Map';
                }
            }
        });
    }

    // Banner Push button listener
    const bannerPushBtn = document.getElementById('btn-banner-push-players');
    if (bannerPushBtn) {
        bannerPushBtn.addEventListener('click', () => {
            const currentMapId = options.getCurrentMapId ? options.getCurrentMapId() : null;
            if (currentMapId) {
                openPushPlayersModal(currentMapId, options);
            }
        });
    }
}

let mapToPushId = null;
let latestPushModalOptions = {};
let pushPlayersModalInitialized = false;

export function setupPushPlayersModal(options = {}) {
    if (typeof document === 'undefined') return;
    if (options && Object.keys(options).length > 0) {
        latestPushModalOptions = { ...latestPushModalOptions, ...options };
    }
    const modal = document.getElementById('modal-push-players');
    if (!modal) return;
    if (pushPlayersModalInitialized) return;

    const cancelBtn = document.getElementById('btn-push-players-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('vtt-hidden');
            mapToPushId = null;
        });
    }

    const pushAll = document.getElementById('push-players-all');
    if (pushAll) {
        pushAll.addEventListener('change', (e) => {
            const list = document.getElementById('push-players-list');
            if (list) {
                const checkboxes = list.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach((cb) => (cb.checked = e.target.checked));
            }
        });
    }

    const list = document.getElementById('push-players-list');
    if (list) {
        list.addEventListener('change', () => {
            const checkboxes = list.querySelectorAll('input[type="checkbox"]');
            const checked = list.querySelectorAll('input[type="checkbox"]:checked');
            if (pushAll) {
                pushAll.checked = checkboxes.length > 0 && checkboxes.length === checked.length;
            }
        });
    }

    const confirmBtn = document.getElementById('btn-push-players-confirm');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (!mapToPushId) return;
            const targetMapId = mapToPushId;
            const opts = { ...latestPushModalOptions, ...options };
            const isAll = pushAll?.checked;

            let targetPlayers = 'all';
            if (!isAll && list) {
                const checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
                targetPlayers = Array.from(checkboxes).map((cb) => cb.value);
            }

            const targetMapName = opts.vtt?.campaignState?.maps?.[targetMapId]?.name || 'Map';

            // 1. Optimistically synchronize GM local state & immediately switch GM view to pushed map
            if (opts.vtt?.campaignState) {
                opts.vtt.campaignState.activeGMMapId = targetMapId;
                if (targetPlayers === 'all') {
                    opts.vtt.campaignState.activeMapId = targetMapId;
                    opts.vtt.campaignState.playerMapOverrides = {};
                } else if (Array.isArray(targetPlayers)) {
                    if (!opts.vtt.campaignState.playerMapOverrides) opts.vtt.campaignState.playerMapOverrides = {};
                    targetPlayers.forEach((p) => {
                        const pLower = p.toLowerCase();
                        for (const k in opts.vtt.campaignState.playerMapOverrides) {
                            if (k.toLowerCase() === pLower && k !== p) {
                                delete opts.vtt.campaignState.playerMapOverrides[k];
                            }
                        }
                        opts.vtt.campaignState.playerMapOverrides[p] = targetMapId;
                    });
                }
            }

            if (typeof opts.loadMap === 'function') {
                opts.loadMap(targetMapId, false);
            }

            // 2. Immediate Toast confirmation for GM
            if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                const recipientText = targetPlayers === 'all' ? 'all players' : `${targetPlayers.length} player(s)`;
                JqueryUtil.doToast({
                    content: `<i class="fa-solid fa-bullhorn" style="color: var(--color-gold-light); margin-right: 6px;"></i> Pushed <strong>${escapeMapHtml(targetMapName)}</strong> to ${recipientText}`,
                    type: 'success'
                });
            }

            // 3. Emit activation event to server
            if (opts.vtt?.socket) {
                opts.vtt.socket.emit('map:activate-players', { mapId: targetMapId, targetPlayers });
            }

            // 4. Update Map Manager grid & Token Locator
            if (typeof opts.renderMapGrid === 'function') {
                opts.renderMapGrid();
            }
            if (typeof opts.vtt?.refreshLocatorPanel === 'function') {
                opts.vtt.refreshLocatorPanel();
            }

            modal.classList.add('vtt-hidden');
            mapToPushId = null;
        });
    }

    pushPlayersModalInitialized = true;
}

export function openPushPlayersModal(mapId, options = {}) {
    if (typeof document === 'undefined') return;
    mapToPushId = mapId;
    if (options && Object.keys(options).length > 0) {
        latestPushModalOptions = { ...latestPushModalOptions, ...options };
    }
    const opts = { ...latestPushModalOptions, ...options };
    const modal = document.getElementById('modal-push-players');
    const list = document.getElementById('push-players-list');
    const camp = opts.vtt?.campaignState || {};
    if (!modal || !list) return;

    const knownPlayers = camp.knownPlayers || [];
    const allowedUsers = camp.allowedUsers || [];
    const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];

    list.innerHTML = '';
    allPotentialPlayers.forEach((p) => {
        const currentMapId = getPlayerMapOverride(camp, p) || camp.activeMapId;
        const isAlreadyHere = currentMapId === mapId;
        const currentMapName = camp.maps?.[currentMapId]?.name || 'Unknown Map';

        const div = document.createElement('label');
        div.className = 'push-player-row';

        div.innerHTML = `
            <div class="push-player-left">
                <input type="checkbox" value="${escapeMapHtml(p)}" checked>
                <span class="push-player-name">${escapeMapHtml(p)}</span>
            </div>
            <span class="push-player-map-tag ${isAlreadyHere ? 'already-here' : 'other-map'}">
                ${isAlreadyHere ? 'Already Here' : `on &quot;${escapeMapHtml(currentMapName)}&quot;`}
            </span>
        `;
        list.appendChild(div);
    });

    if (allPotentialPlayers.length === 0) {
        list.innerHTML = '<div style="color:var(--color-text-muted); padding: 8px;">No players available.</div>';
    }

    const pushAll = document.getElementById('push-players-all');
    if (pushAll) pushAll.checked = true;

    modal.classList.remove('vtt-hidden');
}
