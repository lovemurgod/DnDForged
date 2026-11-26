import { getSafeVttUrl } from './vtt-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const assetTabBtn = document.querySelector('[data-tab="tab-assets"]');
    if (!assetTabBtn) return; // Not present on this view

    const galleryContainer = document.getElementById('asset-gallery-container');
    const galleryList = document.getElementById('asset-gallery-list');
    const breadcrumbs = document.getElementById('asset-breadcrumbs');
    const searchInput = document.getElementById('asset-search');
    const zoomSlider = document.getElementById('asset-zoom-slider');
    const btnViewToggle = document.getElementById('btn-asset-view-toggle');
    const btnNewFolder = document.getElementById('btn-asset-new-folder');
    const btnAddUrl = document.getElementById('btn-asset-add-url');
    const fileUpload = document.getElementById('asset-file-upload');
    const folderUpload = document.getElementById('asset-folder-upload');
    const dropOverlay = document.getElementById('asset-drop-overlay');
    const dropOverlayText = document.getElementById('asset-drop-overlay-text');

    // Batch Toolbar elements
    const batchToolbar = document.getElementById('asset-batch-toolbar');
    const batchCount = document.getElementById('asset-batch-count');
    const btnBatchMove = document.getElementById('btn-asset-batch-move');
    const btnBatchDelete = document.getElementById('btn-asset-batch-delete');
    const btnBatchClear = document.getElementById('btn-asset-batch-clear');

    // Upload Progress elements
    const uploadProgress = document.getElementById('asset-upload-progress');
    const progressLabel = document.getElementById('asset-progress-label');
    const progressPercent = document.getElementById('asset-progress-percent');
    const progressBarFill = document.getElementById('asset-progress-bar-fill');

    function getAuthHeaders(headers = {}) {
        if (typeof window !== 'undefined' && typeof window.vttAuthHeaders === 'function') {
            return window.vttAuthHeaders(headers);
        }
        const res = { ...headers };
        if (typeof window !== 'undefined' && window.VTT?.gmSessionToken) {
            res['x-gm-token'] = window.VTT.gmSessionToken;
        }
        return res;
    }

    // Preview Modal elements
    const modalPreview = document.getElementById('modal-asset-preview');
    const previewTitle = document.getElementById('asset-preview-title');
    const previewContainer = document.getElementById('asset-preview-media-container');
    const previewInfo = document.getElementById('asset-preview-info');
    const btnPreviewClose = document.getElementById('btn-asset-preview-close');
    const btnPreviewCopy = document.getElementById('btn-asset-preview-copy-url');
    const btnPreviewPlace = document.getElementById('btn-asset-preview-place');

    // Move Modal elements
    const modalMove = document.getElementById('modal-asset-move');
    const moveFolderList = document.getElementById('asset-move-folder-list');
    const btnMoveClose = document.getElementById('btn-asset-move-close');
    const btnMoveCancel = document.getElementById('btn-asset-move-cancel');
    const btnMoveConfirm = document.getElementById('btn-asset-move-confirm');

    // State
    let assetTree = null;
    let currentPath = ''; // empty string means root
    let selectedAssets = new Map(); // key: unique identifier (path or url), value: item object
    let lastClickedIndex = -1;
    let currentRenderItems = [];
    let renderedCount = 0;
    const CHUNK_SIZE = 48;
    let assetContextMenuTarget = null; // { item, el }
    let activePreviewAsset = null;
    let activeMoveDestination = '';
    let isUploading = false;

    const isMobileClient = () => {
        return (
            window.innerWidth <= 900 ||
            document.documentElement.classList.contains('force-mobile-ui') ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        );
    };

    // View mode and zoom from preferences (defaults to list view on mobile)
    let savedViewMode = localStorage.getItem('vtt_asset_view_mode');
    let viewMode = savedViewMode || (isMobileClient() ? 'list' : 'grid');
    let zoomSize = parseInt(localStorage.getItem('vtt_asset_zoom_size') || (isMobileClient() ? '110' : '80'), 10);

    function applyViewPreferences() {
        if (galleryList) {
            const isMobile = isMobileClient();
            if (viewMode === 'list') {
                galleryList.classList.add('list-view');
                if (btnViewToggle) btnViewToggle.innerHTML = '<i class="fa-solid fa-grip"></i>';
                if (btnViewToggle) btnViewToggle.title = 'Switch to Grid View';
            } else {
                galleryList.classList.remove('list-view');
                if (btnViewToggle) btnViewToggle.innerHTML = '<i class="fa-solid fa-list"></i>';
                if (btnViewToggle) btnViewToggle.title = 'Switch to List View';
                const effectiveMin = isMobile ? Math.max(110, zoomSize) : zoomSize;
                galleryList.style.gridTemplateColumns = `repeat(auto-fill, minmax(${effectiveMin}px, 1fr))`;
            }
            const thumbSz = isMobile ? Math.max(64, zoomSize - 16) : Math.max(40, zoomSize - 20);
            galleryList.style.setProperty('--asset-thumb-size', `${thumbSz}px`);
        }
        if (zoomSlider) {
            zoomSlider.value = zoomSize;
        }
    }
    applyViewPreferences();

    if (btnViewToggle) {
        btnViewToggle.addEventListener('click', () => {
            viewMode = viewMode === 'grid' ? 'list' : 'grid';
            localStorage.setItem('vtt_asset_view_mode', viewMode);
            applyViewPreferences();
        });
    }

    if (zoomSlider) {
        zoomSlider.addEventListener('input', (e) => {
            zoomSize = parseInt(e.target.value, 10);
            localStorage.setItem('vtt_asset_zoom_size', zoomSize);
            applyViewPreferences();
        });
    }

    async function fetchAssetTree() {
        try {
            const res = await fetch('/api/assets');
            if (!res.ok) throw new Error('Failed to fetch assets');
            assetTree = await res.json();
            renderAssets();
        } catch (err) {
            console.error(err);
            if (galleryList) {
                galleryList.innerHTML = `<div class="init-empty-state" style="grid-column: 1/-1; color: var(--color-danger);">Failed to load assets: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getCurrentFolderNode(tree, pathStr) {
        if (!pathStr || pathStr === '') return tree;
        const parts = pathStr.split('/');
        let current = tree;
        for (const p of parts) {
            if (!p) continue;
            const child =
                current && Array.isArray(current.children)
                    ? current.children.find((c) => c.name === p && c.type === 'folder')
                    : null;
            if (child) {
                current = child;
            } else {
                return null;
            }
        }
        return current;
    }

    // Collect all folder paths for the move destination dialog
    function collectFolderList(node, currentPrefix = '', acc = []) {
        if (!node) return acc;
        if (currentPrefix === '') {
            acc.push({ name: 'Root', path: '' });
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                if (child.type === 'folder') {
                    acc.push({ name: child.name, path: child.path });
                    collectFolderList(child, child.path, acc);
                }
            }
        }
        return acc;
    }

    function renderBreadcrumbs() {
        if (!breadcrumbs) return;

        let html = `<span class="breadcrumb-link" data-path="" title="Drop assets here to move to Root">Root</span>`;
        if (currentPath) {
            const parts = currentPath.split('/');
            let buildPath = '';
            parts.forEach((part) => {
                if (!part) return;
                buildPath += (buildPath ? '/' : '') + part;
                const safePath = escapeHtml(buildPath);
                const safePart = escapeHtml(part);
                html += ` <span style="opacity: 0.5;">&gt;</span> <span class="breadcrumb-link" data-path="${safePath}" title="Drop assets here to move to ${safePart}">${safePart}</span>`;
            });
        }
        breadcrumbs.innerHTML = html;

        // Breadcrumb clicks & Drop zones for internal organization
        breadcrumbs.querySelectorAll('.breadcrumb-link').forEach((link) => {
            const linkPath = link.getAttribute('data-path') || '';
            link.addEventListener('click', () => {
                currentPath = linkPath;
                selectedAssets.clear();
                updateBatchToolbar();
                renderAssets();
            });

            // Drag-over to move assets into this breadcrumb folder
            link.addEventListener('dragover', (e) => {
                if (window._vttDraggingAssets && window._vttDraggingAssets.length > 0) {
                    e.preventDefault();
                    link.classList.add('drop-target-active');
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            link.addEventListener('dragleave', () => {
                link.classList.remove('drop-target-active');
            });

            link.addEventListener('drop', async (e) => {
                link.classList.remove('drop-target-active');
                if (window._vttDraggingAssets && window._vttDraggingAssets.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    const itemsToMove = [...window._vttDraggingAssets];
                    window._vttDraggingAssets = null;
                    await moveAssets(itemsToMove, linkPath);
                }
            });
        });
    }

    function updateBatchToolbar() {
        if (!batchToolbar) return;
        const count = selectedAssets.size;
        if (count > 0) {
            batchToolbar.classList.remove('vtt-hidden');
            batchCount.textContent = `${count} selected`;
        } else {
            batchToolbar.classList.add('vtt-hidden');
        }
        // Update selection UI highlight on existing elements
        galleryList.querySelectorAll('.asset-item').forEach((el) => {
            const itemKey = el.getAttribute('data-asset-key');
            if (itemKey && selectedAssets.has(itemKey)) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }

    function renderAssets() {
        renderBreadcrumbs();
        if (!assetTree) return;

        const folderNode = getCurrentFolderNode(assetTree, currentPath);
        if (!folderNode) {
            currentPath = ''; // reset to root if folder deleted or not found
            renderAssets();
            return;
        }

        const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let items = folderNode.children ? [...folderNode.children] : [];

        if (filterText) {
            // Flat search across entire tree if searching
            const allItems = [];
            function collect(node) {
                if (node.children) {
                    node.children.forEach((c) => {
                        if (c.type !== 'folder' && c.name.toLowerCase().includes(filterText)) {
                            allItems.push(c);
                        }
                        if (c.type === 'folder') collect(c);
                    });
                }
            }
            collect(assetTree);
            items = allItems;
        } else {
            // Sort: folders first, then files
            items.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        currentRenderItems = items;
        renderedCount = 0;
        galleryList.innerHTML = '';

        if (items.length === 0) {
            galleryList.innerHTML = `<div class="init-empty-state" style="grid-column: 1/-1;">This folder is empty. Drag files or folders here to upload.</div>`;
            return;
        }

        renderNextChunk();
    }

    // Virtualized / Chunked rendering for smooth 60fps scrolling with 1,000+ items
    function renderNextChunk() {
        if (renderedCount >= currentRenderItems.length) return;

        const nextBatch = currentRenderItems.slice(renderedCount, renderedCount + CHUNK_SIZE);
        const fragment = document.createDocumentFragment();

        nextBatch.forEach((item, batchIdx) => {
            const globalIndex = renderedCount + batchIdx;
            const el = createAssetElement(item, globalIndex);
            fragment.appendChild(el);
        });

        galleryList.appendChild(fragment);
        renderedCount += nextBatch.length;
    }

    // Scroll listener on gallery list for infinite chunk loading
    if (galleryList) {
        galleryList.addEventListener('scroll', () => {
            if (galleryList.scrollTop + galleryList.clientHeight >= galleryList.scrollHeight - 150) {
                renderNextChunk();
            }
        });
    }

    function getAssetKey(item) {
        return item.path || item.url || item.name;
    }

    function createAssetElement(item, index) {
        const el = document.createElement('div');
        el.className = 'asset-item';
        const itemKey = getAssetKey(item);
        el.setAttribute('data-asset-key', itemKey);
        el.setAttribute('data-index', index);

        if (selectedAssets.has(itemKey)) {
            el.classList.add('selected');
        }

        const safeName = escapeHtml(item.name || '');

        if (item.type === 'folder') {
            el.classList.add('asset-folder');
            el.innerHTML = `
                <div class="asset-thumb-wrap">
                    <i class="fa-solid fa-folder asset-icon"></i>
                </div>
                <span class="asset-name" title="${safeName}">${safeName}</span>
            `;

            // Open folder on click
            el.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    toggleSelection(item, itemKey, index, e.shiftKey);
                    return;
                }
                currentPath = item.path;
                selectedAssets.clear();
                updateBatchToolbar();
                if (searchInput) searchInput.value = '';
                renderAssets();
            });

            // Drag and drop target to move assets into this subfolder
            el.addEventListener('dragover', (e) => {
                if (window._vttDraggingAssets && window._vttDraggingAssets.length > 0) {
                    e.preventDefault();
                    el.classList.add('drop-target-active');
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            el.addEventListener('dragleave', () => {
                el.classList.remove('drop-target-active');
            });

            el.addEventListener('drop', async (e) => {
                el.classList.remove('drop-target-active');
                if (window._vttDraggingAssets && window._vttDraggingAssets.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    const itemsToMove = [...window._vttDraggingAssets];
                    window._vttDraggingAssets = null;
                    await moveAssets(itemsToMove, item.path);
                }
            });
        } else {
            // File or URL Asset
            const isVideo = item.url && (item.url.match(/\.(mp4|webm|ogg)$/i) || item.url.includes('v.pinimg.com'));
            const ytMatch = item.url && item.url.match(/(?:embed\/|v=|\.be\/)([a-zA-Z0-9_-]{11})/);
            const isYoutube = Boolean(ytMatch);
            const isGif = item.url && item.url.match(/\.gif(\?.*)?$/i);

            let thumbInner = '';
            let badgeHtml = '';

            if (isVideo) {
                badgeHtml = `<span class="asset-media-badge"><i class="fa-solid fa-film"></i> VIDEO</span>`;
                // Lightweight video poster with lazy video mounting on hover
                thumbInner = `
                    <div class="asset-thumb video-poster" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #0b0d14;">
                        <i class="fa-solid fa-circle-play" style="font-size: 1.6rem; color: var(--color-gold-base); opacity: 0.85;"></i>
                    </div>
                `;
            } else if (isYoutube && ytMatch[1]) {
                badgeHtml = `<span class="asset-media-badge" style="color: #ff5555;"><i class="fa-brands fa-youtube"></i> YT</span>`;
                thumbInner = `<img class="asset-thumb" src="https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg" alt="${safeName}" loading="lazy">`;
            } else {
                if (isGif) badgeHtml = `<span class="asset-media-badge"><i class="fa-solid fa-bolt"></i> GIF</span>`;
                thumbInner = `<img class="asset-thumb" src="${escapeHtml(getSafeVttUrl(item.url))}" data-raw-src="${escapeHtml(item.url)}" alt="${safeName}" loading="lazy">`;
            }

            el.innerHTML = `
                <div class="asset-thumb-wrap">
                    ${thumbInner}
                    ${badgeHtml}
                </div>
                <span class="asset-name" title="${safeName}">${safeName}</span>
                <button class="btn-mobile-spawn-token asset-mobile-spawn-btn" title="Place on Map" style="position: absolute; top: 4px; right: 4px; z-index: 5;">
                    <i class="fa-solid fa-plus pointer-events-none"></i>
                </button>
            `;

            // Dynamic video hover play & unmount to conserve GPU/memory
            if (isVideo) {
                const thumbWrap = el.querySelector('.asset-thumb-wrap');
                let mountedVideo = null;
                el.addEventListener('mouseenter', () => {
                    if (!mountedVideo && thumbWrap) {
                        mountedVideo = document.createElement('video');
                        mountedVideo.className = 'asset-thumb';
                        mountedVideo.dataset.rawSrc = item.url;
                        mountedVideo.src = getSafeVttUrl(item.url);
                        mountedVideo.muted = true;
                        mountedVideo.loop = true;
                        mountedVideo.playsInline = true;
                        mountedVideo.style.position = 'absolute';
                        mountedVideo.style.inset = '0';
                        mountedVideo.style.objectFit = 'contain';
                        mountedVideo.style.zIndex = '2';
                        thumbWrap.appendChild(mountedVideo);
                        mountedVideo.play().catch(() => {});
                    }
                });
                el.addEventListener('mouseleave', () => {
                    if (mountedVideo) {
                        try {
                            mountedVideo.pause();
                            mountedVideo.remove();
                        } catch (e) {}
                        mountedVideo = null;
                    }
                });
            }

            // Mobile spawn button
            const mobileSpawnBtn = el.querySelector('.asset-mobile-spawn-btn');
            if (mobileSpawnBtn) {
                mobileSpawnBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    spawnAssetToMap(item, isVideo);
                });
            }

            // Selection toggle on click
            el.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    toggleSelection(item, itemKey, index, e.shiftKey);
                } else if (selectedAssets.size > 0) {
                    toggleSelection(item, itemKey, index, false);
                }
            });

            // Drag and drop onto Map or folders
            el.draggable = true;
            el.addEventListener('dragstart', (e) => {
                // If this item is not selected, select it as the single item
                if (!selectedAssets.has(itemKey)) {
                    selectedAssets.clear();
                    selectedAssets.set(itemKey, item);
                    updateBatchToolbar();
                }

                // Global internal dragging reference
                window._vttDraggingAssets = Array.from(selectedAssets.values());

                // Set data transfer for VTT Map Canvas drop
                e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                        type: 'vtt-asset',
                        name: item.name,
                        url: item.url,
                        assetType: isVideo ? 'video' : 'image'
                    })
                );
                e.dataTransfer.effectAllowed = 'copyMove';
            });

            el.addEventListener('dragend', () => {
                window._vttDraggingAssets = null;
            });
        }

        // Context Menu Handler
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            assetContextMenuTarget = { item, el };

            const menu = document.getElementById('vtt-asset-context-menu');
            if (menu) {
                menu.style.left = `${Math.min(window.innerWidth - 180, e.clientX)}px`;
                menu.style.top = `${Math.min(window.innerHeight - 200, e.clientY)}px`;
                menu.classList.remove('vtt-hidden');
            }
        });

        return el;
    }

    function toggleSelection(item, key, index, isShift) {
        if (isShift && lastClickedIndex !== -1) {
            const start = Math.min(lastClickedIndex, index);
            const end = Math.max(lastClickedIndex, index);
            for (let i = start; i <= end; i++) {
                const target = currentRenderItems[i];
                if (target) {
                    selectedAssets.set(getAssetKey(target), target);
                }
            }
        } else {
            if (selectedAssets.has(key)) {
                selectedAssets.delete(key);
            } else {
                selectedAssets.set(key, item);
            }
            lastClickedIndex = index;
        }
        updateBatchToolbar();
    }

    function spawnAssetToMap(item, isVideo) {
        const assetPayload = {
            name: item.name,
            url: item.url,
            assetType: isVideo ? 'video' : 'image'
        };
        if (window.VTT?.mobileAdapter?.startTapToPlaceMode && window.VTT?.mobileAdapter?.isMobileViewport?.()) {
            window.VTT.mobileAdapter.startTapToPlaceMode({
                type: 'asset',
                title: item.name,
                asset: assetPayload
            });
        } else if (window.VTT?.spawnAssetAtCenter) {
            window.VTT.spawnAssetAtCenter(assetPayload);
        }
    }

    // Search input with instant filtering
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAssets();
        });
    }

    // New Folder
    if (btnNewFolder) {
        btnNewFolder.addEventListener('click', async () => {
            const name = prompt('Enter new folder name:');
            if (!name || !name.trim()) return;
            const cleanName = name.trim().replace(/[\/\\?%*:|"<>]/g, '_');
            const folderPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;

            try {
                const res = await fetch('/api/assets/folder', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ folderPath })
                });
                if (res.ok) {
                    await fetchAssetTree();
                } else {
                    const err = await res.json();
                    alert(`Failed to create folder: ${err.error || 'Unknown error'}`);
                }
            } catch (err) {
                console.error('Failed to create folder', err);
            }
        });
    }

    // Add External URL
    if (btnAddUrl) {
        btnAddUrl.addEventListener('click', async () => {
            let url = prompt('Enter direct image/video URL or YouTube link:');
            if (!url) return;

            if (window.VTT && typeof window.VTT.resolveMediaUrl === 'function') {
                try {
                    const res = await window.VTT.resolveMediaUrl(url);
                    if (res && res.resolvedUrl) {
                        url = res.resolvedUrl;
                    }
                } catch (e) {}
            }

            let name = prompt('Enter a name for this asset:', 'External Asset');
            if (!name) name = 'External Asset';

            try {
                const res = await fetch('/api/assets/url', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ url, name, folderPath: currentPath })
                });
                if (res.ok) {
                    await fetchAssetTree();
                }
            } catch (err) {
                console.error('Failed to add URL', err);
            }
        });
    }

    // Unified Upload Queue & Progress
    async function uploadFilesBatch(filesList) {
        if (!filesList || filesList.length === 0 || isUploading) return;
        isUploading = true;

        if (uploadProgress) {
            uploadProgress.classList.remove('vtt-hidden');
            progressPercent.textContent = `0%`;
            progressBarFill.style.width = `0%`;
            progressLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-gradient-gold"></i> Uploading 1 of ${filesList.length}...`;
        }

        const targetFolder = currentPath;
        let completed = 0;
        const total = filesList.length;

        // Concurrent upload pool (4 at a time)
        const concurrency = 4;
        let index = 0;

        async function uploadNext() {
            while (index < total) {
                const currentIndex = index++;
                const item = filesList[currentIndex];
                const file = item.file || item;
                const relativePath = item.relativePath || '';

                const formData = new FormData();
                if (targetFolder) formData.append('folderPath', targetFolder);
                if (relativePath) formData.append('relativePath', relativePath);
                formData.append('file', file);

                try {
                    const queryParams = new URLSearchParams();
                    if (targetFolder) queryParams.set('folderPath', targetFolder);
                    if (relativePath) queryParams.set('relativePath', relativePath);

                    const res = await fetch(`/api/assets/upload?${queryParams.toString()}`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: formData
                    });
                    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
                } catch (err) {
                    console.error(`Error uploading ${file.name}:`, err);
                } finally {
                    completed++;
                    const percent = Math.round((completed / total) * 100);
                    if (uploadProgress) {
                        progressPercent.textContent = `${percent}%`;
                        progressBarFill.style.width = `${percent}%`;
                        progressLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-gradient-gold"></i> Uploaded ${completed} of ${total}...`;
                    }
                }
            }
        }

        const workers = Array.from({ length: Math.min(concurrency, total) }, () => uploadNext());
        await Promise.all(workers);

        if (uploadProgress) {
            progressLabel.innerHTML = `<i class="fa-solid fa-circle-check text-gradient-gold"></i> Upload Complete!`;
            setTimeout(() => {
                uploadProgress.classList.add('vtt-hidden');
                isUploading = false;
            }, 1200);
        } else {
            isUploading = false;
        }

        await fetchAssetTree();
    }

    // Multi-File Upload Input Change
    if (fileUpload) {
        fileUpload.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            const batch = files.map((f) => ({ file: f, relativePath: f.name }));
            await uploadFilesBatch(batch);
            fileUpload.value = '';
        });
    }

    // Folder Upload Input Change (Preserving Full Directory Tree)
    if (folderUpload) {
        folderUpload.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            const batch = files.map((f) => ({
                file: f,
                relativePath: f.webkitRelativePath || f.name
            }));
            await uploadFilesBatch(batch);
            folderUpload.value = '';
        });
    }

    // Desktop OS Drag & Drop Ingestion
    if (galleryContainer) {
        let dragCounter = 0;

        galleryContainer.addEventListener('dragenter', (e) => {
            // Only trigger for external files, not internal asset reorganization
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                e.preventDefault();
                dragCounter++;
                if (dropOverlay) {
                    dropOverlay.classList.remove('vtt-hidden');
                    const folderName = currentPath ? currentPath.split('/').pop() : 'Root';
                    dropOverlayText.textContent = `Drop files or folders to upload to "${folderName}"`;
                }
            }
        });

        galleryContainer.addEventListener('dragover', (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        galleryContainer.addEventListener('dragleave', (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                dragCounter--;
                if (dragCounter <= 0) {
                    dragCounter = 0;
                    if (dropOverlay) dropOverlay.classList.add('vtt-hidden');
                }
            }
        });

        galleryContainer.addEventListener('drop', async (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                e.preventDefault();
                dragCounter = 0;
                if (dropOverlay) dropOverlay.classList.add('vtt-hidden');

                const items = e.dataTransfer.items;
                const collectedFiles = [];

                if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
                    // Traverse directory hierarchy recursively
                    async function traverseEntry(entry, pathPrefix = '') {
                        if (entry.isFile) {
                            const file = await new Promise((resolve) => entry.file(resolve));
                            const relPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
                            collectedFiles.push({ file, relativePath: relPath });
                        } else if (entry.isDirectory) {
                            const dirReader = entry.createReader();
                            const subEntries = await new Promise((resolve) => {
                                const allSub = [];
                                function readSub() {
                                    dirReader.readEntries((results) => {
                                        if (results.length === 0) {
                                            resolve(allSub);
                                        } else {
                                            allSub.push(...results);
                                            readSub();
                                        }
                                    });
                                }
                                readSub();
                            });
                            const nextPrefix = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
                            for (const sub of subEntries) {
                                await traverseEntry(sub, nextPrefix);
                            }
                        }
                    }

                    for (let i = 0; i < items.length; i++) {
                        const entry = items[i].webkitGetAsEntry();
                        if (entry) {
                            await traverseEntry(entry, '');
                        }
                    }
                } else {
                    // Fallback flat files
                    const files = Array.from(e.dataTransfer.files || []);
                    files.forEach((f) => collectedFiles.push({ file: f, relativePath: f.name }));
                }

                if (collectedFiles.length > 0) {
                    await uploadFilesBatch(collectedFiles);
                }
            }
        });
    }

    // Move Assets Function
    async function moveAssets(items, targetFolder) {
        if (!items || items.length === 0) return;
        try {
            const res = await fetch('/api/assets/move', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    items: items.map((item) => ({
                        path: item.path,
                        isUrl: item.type === 'url',
                        folderPath: currentPath,
                        name: item.name,
                        url: item.url
                    })),
                    targetFolder: targetFolder
                })
            });

            if (res.ok) {
                selectedAssets.clear();
                updateBatchToolbar();
                await fetchAssetTree();
            } else {
                const err = await res.json();
                alert(`Failed to move: ${err.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Move error:', err);
        }
    }

    // Batch Actions Toolbar Handlers
    if (btnBatchClear) {
        btnBatchClear.addEventListener('click', () => {
            selectedAssets.clear();
            updateBatchToolbar();
        });
    }

    if (btnBatchDelete) {
        btnBatchDelete.addEventListener('click', async () => {
            const count = selectedAssets.size;
            if (count === 0) return;
            if (!confirm(`Are you sure you want to delete ${count} selected asset${count > 1 ? 's' : ''}?`)) return;

            const itemsToDelete = Array.from(selectedAssets.values()).map((item) => ({
                path: item.path,
                isUrl: item.type === 'url',
                folderPath: currentPath,
                name: item.name,
                url: item.url
            }));

            try {
                const res = await fetch('/api/assets/delete', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ items: itemsToDelete })
                });
                if (res.ok) {
                    selectedAssets.clear();
                    updateBatchToolbar();
                    await fetchAssetTree();
                } else {
                    const err = await res.json();
                    alert(`Failed to delete: ${err.error || 'Unknown error'}`);
                }
            } catch (err) {
                console.error('Batch delete error', err);
            }
        });
    }

    if (btnBatchMove) {
        btnBatchMove.addEventListener('click', () => {
            if (selectedAssets.size === 0) return;
            openMoveDestinationModal(Array.from(selectedAssets.values()));
        });
    }

    const btnBatchCreateTable = document.getElementById('btn-asset-batch-create-table');
    if (btnBatchCreateTable) {
        btnBatchCreateTable.addEventListener('click', () => {
            const items = Array.from(selectedAssets.values()).filter((i) => i.type !== 'folder');
            if (items.length === 0) {
                alert('Select at least one image asset.');
                return;
            }
            if (window.VTT?.rollTablesEngine?.openAssetTableWithAssets) {
                window.VTT.rollTablesEngine.openAssetTableWithAssets(items);
            }
        });
    }

    const btnBatchAddTable = document.getElementById('btn-asset-batch-add-table');
    if (btnBatchAddTable) {
        btnBatchAddTable.addEventListener('click', () => {
            const items = Array.from(selectedAssets.values()).filter((i) => i.type !== 'folder');
            if (items.length === 0) {
                alert('Select at least one image asset.');
                return;
            }
            promptAddToAssetTable(items);
        });
    }

    // Move Destination Picker Modal
    function openMoveDestinationModal(itemsToMove) {
        if (!modalMove || !moveFolderList) return;
        activeMoveDestination = '';
        const allFolders = collectFolderList(assetTree, '', []);

        moveFolderList.innerHTML = '';
        allFolders.forEach((f) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'asset-move-folder-item';
            const isCurrent = f.path === currentPath;
            const displayName = f.path === '' ? '📁 Root' : `📁 ${f.path}`;

            itemEl.innerHTML = `
                <span>${escapeHtml(displayName)}</span>
                ${isCurrent ? '<span style="font-size: 0.7rem; opacity: 0.6; margin-left: auto;">(Current)</span>' : ''}
            `;

            itemEl.addEventListener('click', () => {
                moveFolderList
                    .querySelectorAll('.asset-move-folder-item')
                    .forEach((i) => i.classList.remove('selected'));
                itemEl.classList.add('selected');
                activeMoveDestination = f.path;
            });

            moveFolderList.appendChild(itemEl);
        });

        // Set initial selection to first folder item
        const first = moveFolderList.querySelector('.asset-move-folder-item');
        if (first) {
            first.classList.add('selected');
            activeMoveDestination = allFolders[0]?.path || '';
        }

        modalMove.classList.remove('vtt-hidden');

        // Confirm Move
        btnMoveConfirm.onclick = async () => {
            modalMove.classList.add('vtt-hidden');
            await moveAssets(itemsToMove, activeMoveDestination);
        };
    }

    if (btnMoveClose) btnMoveClose.addEventListener('click', () => modalMove.classList.add('vtt-hidden'));
    if (btnMoveCancel) btnMoveCancel.addEventListener('click', () => modalMove.classList.add('vtt-hidden'));

    // Lightbox Full Size Preview Modal
    function openPreviewModal(item) {
        if (!modalPreview || !item || !item.url) return;
        activePreviewAsset = item;
        previewTitle.textContent = item.name || 'Asset Preview';
        previewContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-gradient-gold" style="font-size: 2rem;"></i>`;
        previewInfo.textContent = 'Loading dimensions...';

        const isVideo = item.url.match(/\.(mp4|webm|ogg)$/i) || item.url.includes('v.pinimg.com');
        const ytMatch = item.url.match(/(?:embed\/|v=|\.be\/)([a-zA-Z0-9_-]{11})/);

        if (isVideo) {
            const vid = document.createElement('video');
            vid.dataset.rawSrc = item.url;
            vid.src = getSafeVttUrl(item.url);
            vid.controls = true;
            vid.autoplay = true;
            vid.loop = true;
            vid.style.maxWidth = '100%';
            vid.style.maxHeight = '100%';
            vid.style.objectFit = 'contain';
            vid.onloadedmetadata = () => {
                previewInfo.textContent = `Video: ${vid.videoWidth} × ${vid.videoHeight} px`;
            };
            previewContainer.innerHTML = '';
            previewContainer.appendChild(vid);
        } else if (ytMatch && ytMatch[1]) {
            previewContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border: none; border-radius: 4px;"></iframe>`;
            previewInfo.textContent = `YouTube Video (${ytMatch[1]})`;
        } else {
            const img = new Image();
            img.dataset.rawSrc = item.url;
            img.src = getSafeVttUrl(item.url);
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.onload = () => {
                previewInfo.textContent = `Image: ${img.naturalWidth} × ${img.naturalHeight} px`;
            };
            img.onerror = () => {
                previewInfo.textContent = `Failed to load preview`;
            };
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        }

        modalPreview.classList.remove('vtt-hidden');
    }

    if (btnPreviewClose) btnPreviewClose.addEventListener('click', () => modalPreview.classList.add('vtt-hidden'));
    if (btnPreviewCopy) {
        btnPreviewCopy.addEventListener('click', () => {
            if (activePreviewAsset && activePreviewAsset.url) {
                const u = activePreviewAsset.url;
                const fullUrl =
                    u.startsWith('http') ||
                    u.startsWith('data:') ||
                    u.startsWith('blob:') ||
                    u.startsWith('forgedvtt-asset://')
                        ? u
                        : window.location.origin + u;
                navigator.clipboard.writeText(fullUrl).then(() => {
                    btnPreviewCopy.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
                    setTimeout(() => {
                        btnPreviewCopy.innerHTML = `<i class="fa-solid fa-copy"></i> Copy Link`;
                    }, 1500);
                });
            }
        });
    }

    if (btnPreviewPlace) {
        btnPreviewPlace.addEventListener('click', () => {
            if (activePreviewAsset) {
                const isVid =
                    activePreviewAsset.url &&
                    (activePreviewAsset.url.match(/\.(mp4|webm|ogg)$/i) ||
                        activePreviewAsset.url.includes('youtube.com') ||
                        activePreviewAsset.url.includes('youtu.be'));
                spawnAssetToMap(activePreviewAsset, isVid);
                modalPreview.classList.add('vtt-hidden');
            }
        });
    }

    // Space hotkey to preview selected asset
    document.addEventListener('keydown', (e) => {
        if (
            e.code === 'Space' &&
            selectedAssets.size === 1 &&
            document.activeElement?.tagName !== 'INPUT' &&
            document.activeElement?.tagName !== 'TEXTAREA'
        ) {
            const first = selectedAssets.values().next().value;
            if (first && first.type !== 'folder') {
                e.preventDefault();
                openPreviewModal(first);
            }
        }
    });

    // Context Menu Logic
    document.addEventListener('mousedown', (e) => {
        const menu = document.getElementById('vtt-asset-context-menu');
        if (menu && !menu.classList.contains('vtt-hidden') && !menu.contains(e.target)) {
            menu.classList.add('vtt-hidden');
        }
    });

    // Context Menu: Preview
    document.getElementById('btn-asset-ctx-preview')?.addEventListener('click', () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
        if (item.type !== 'folder') {
            openPreviewModal(item);
        }
    });

    // Context Menu: Copy URL
    document.getElementById('btn-asset-ctx-copy-url')?.addEventListener('click', () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
        if (item.url) {
            const u = item.url;
            const fullUrl =
                u.startsWith('http') ||
                u.startsWith('data:') ||
                u.startsWith('blob:') ||
                u.startsWith('forgedvtt-asset://')
                    ? u
                    : window.location.origin + u;
            navigator.clipboard.writeText(fullUrl);
        }
    });

    // Context Menu: Move to...
    document.getElementById('btn-asset-ctx-move')?.addEventListener('click', () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
        openMoveDestinationModal([item]);
    });

    // Context Menu: Edit
    document.getElementById('btn-asset-ctx-edit')?.addEventListener('click', async () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');

        let newName = prompt('Enter new name for this asset:', item.name);
        if (!newName || !newName.trim()) return;
        newName = newName.trim();

        let newUrl = null;
        if (item.type === 'url') {
            newUrl = prompt('Enter new URL (or leave unchanged):', item.url);
            if (!newUrl) newUrl = item.url;
        }

        try {
            const res = await fetch('/api/assets/edit', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    path: item.path,
                    newName: newName,
                    isUrl: item.type === 'url',
                    folderPath: currentPath,
                    oldName: item.name,
                    newUrl: newUrl
                })
            });

            if (res.ok) {
                await fetchAssetTree();
            } else {
                const err = await res.json();
                alert(`Failed to edit: ${err.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Edit error', err);
        }
    });

    // Context Menu: Create Asset Table
    document.getElementById('btn-asset-ctx-create-table')?.addEventListener('click', () => {
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
        const items =
            selectedAssets.size > 0
                ? Array.from(selectedAssets.values()).filter((i) => i.type !== 'folder')
                : assetContextMenuTarget?.item?.type !== 'folder'
                  ? [assetContextMenuTarget.item]
                  : [];
        if (items.length === 0) return;
        if (window.VTT?.rollTablesEngine?.openAssetTableWithAssets) {
            window.VTT.rollTablesEngine.openAssetTableWithAssets(items);
        }
    });

    // Context Menu: Add to Asset Table...
    document.getElementById('btn-asset-ctx-add-to-table')?.addEventListener('click', () => {
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
        const items =
            selectedAssets.size > 0
                ? Array.from(selectedAssets.values()).filter((i) => i.type !== 'folder')
                : assetContextMenuTarget?.item?.type !== 'folder'
                  ? [assetContextMenuTarget.item]
                  : [];
        if (items.length === 0) return;
        promptAddToAssetTable(items);
    });

    function promptAddToAssetTable(items) {
        const campaignState = window.VTT?.campaignState;
        const tables = campaignState?.rollTables?.assetTables || campaignState?.assetTables || [];

        let modal = document.getElementById('modal-add-to-asset-table');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-add-to-asset-table';
            modal.className = 'vtt-modal vtt-hidden';
            modal.style.zIndex = '2800';
            modal.innerHTML = `
                <div class="modal-content glassmorphism" style="max-width: 440px; padding: 20px; border: 1px solid var(--color-gold-base);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:14px;">
                        <h4 style="margin:0; color:var(--color-gold-base); font-size:1.05rem; display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-layer-group text-gradient-gold"></i> Add to Asset Table
                        </h4>
                        <button type="button" class="btn btn-xs btn-ghost btn-close-add-table"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:14px;">
                        Adding <strong style="color:#fff;" id="modal-add-table-count">1</strong> item(s) to an Asset Table.
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;">
                        <div>
                            <label style="display:block; font-size:0.75rem; text-transform:uppercase; color:var(--color-gold-light); margin-bottom:4px;">Target Asset Table</label>
                            <select id="modal-add-table-select" style="width:100%; padding:8px; border-radius:4px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:#fff; font-size:0.85rem;"></select>
                        </div>
                        <div id="modal-add-table-weight-group">
                            <label style="display:block; font-size:0.75rem; text-transform:uppercase; color:var(--color-gold-light); margin-bottom:4px;">Weight</label>
                            <input type="number" id="modal-add-table-weight" value="1" min="1" max="100" style="width:100%; padding:6px 10px; border-radius:4px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:#fff; font-size:0.85rem;">
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button type="button" class="btn btn-xs btn-secondary btn-close-add-table">Cancel</button>
                        <button type="button" class="btn btn-xs btn-primary btn-confirm-add-table">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal
                .querySelectorAll('.btn-close-add-table')
                .forEach((b) => b.addEventListener('click', () => modal.classList.add('vtt-hidden')));
        }

        const countEl = modal.querySelector('#modal-add-table-count');
        if (countEl) countEl.textContent = items.length;

        const select = modal.querySelector('#modal-add-table-select');
        const weightInput = modal.querySelector('#modal-add-table-weight');
        const confirmBtn = modal.querySelector('.btn-confirm-add-table');

        let selectOptionsHtml = '<option value="__new__">+ Create New Asset Table...</option>';
        tables.forEach((t, idx) => {
            selectOptionsHtml += `<option value="${idx}">${escapeHtml(t.name)} (${t.entries?.length || 0} items)</option>`;
        });
        select.innerHTML = selectOptionsHtml;
        if (tables.length > 0) {
            select.value = '0';
        } else {
            select.value = '__new__';
        }

        confirmBtn.onclick = () => {
            modal.classList.add('vtt-hidden');
            const choice = select.value;
            if (choice === '__new__') {
                if (window.VTT?.rollTablesEngine?.openAssetTableWithAssets) {
                    window.VTT.rollTablesEngine.openAssetTableWithAssets(items);
                }
                return;
            }

            const targetTable = tables[parseInt(choice, 10)];
            if (!targetTable) return;
            if (!targetTable.entries) targetTable.entries = [];

            const weight = parseInt(weightInput.value, 10) || 1;
            items.forEach((item, i) => {
                const cleanName = (item.name || `Side ${targetTable.entries.length + 1}`).replace(/\.[^/.]+$/, '');
                targetTable.entries.push({
                    id: `side_${Date.now()}_${targetTable.entries.length + i}`,
                    name: cleanName,
                    url: item.url || '',
                    weight: weight
                });
            });

            if (window.VTT?.rollTablesEngine?.broadcastState) {
                window.VTT.rollTablesEngine.broadcastState();
            } else if (window.VTT?.socket) {
                window.VTT.socket.emit('rolltables:update', {
                    rollTables: campaignState?.rollTables || { tables: [], assetTables: tables, decks: [] }
                });
            }

            if (window.VTT?.toast) {
                window.VTT.toast(`Added ${items.length} artwork(s) to "${targetTable.name}"`);
            }
        };

        modal.classList.remove('vtt-hidden');
    }

    function flattenAllImageAssets(tree, result = []) {
        if (!tree) return result;
        if (Array.isArray(tree)) {
            tree.forEach((t) => flattenAllImageAssets(t, result));
            return result;
        }
        if (tree.type === 'file' || tree.type === 'url') {
            if (tree.url) result.push(tree);
        }
        if (Array.isArray(tree.children)) {
            tree.children.forEach((c) => flattenAllImageAssets(c, result));
        }
        return result;
    }

    async function openAssetPickerModal({ multiSelect = false, onSelect } = {}) {
        if (!assetTree || (Array.isArray(assetTree) && assetTree.length === 0)) {
            await fetchAssetTree();
        }

        let modal = document.getElementById('modal-gallery-asset-picker');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-gallery-asset-picker';
            modal.className = 'vtt-modal vtt-hidden';
            modal.style.zIndex = '2500';
            modal.innerHTML = `
                <div class="modal-content glassmorphism" style="max-width: 650px; width: 90vw; height: 75vh; display: flex; flex-direction: column; padding: 18px 22px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:10px;">
                        <h4 style="margin:0; color:var(--color-gold-base); font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-images text-gradient-gold"></i> Pick Asset from Gallery
                        </h4>
                        <button type="button" class="btn btn-xs btn-ghost btn-close-asset-picker"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="margin-bottom:10px;">
                        <input type="text" id="gallery-picker-search" placeholder="Search gallery assets..." style="width:100%; padding:6px 10px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); border-radius:4px; color:#fff;">
                    </div>
                    <div id="gallery-picker-grid" class="scroll-styled" style="flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:8px; padding:4px;">
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px; margin-top:10px;">
                        <span id="gallery-picker-selected-count" style="font-size:0.75rem; color:var(--color-gold-light);">0 selected</span>
                        <div class="flex-row" style="gap:6px;">
                            <button type="button" class="btn btn-xs btn-secondary btn-close-asset-picker">Cancel</button>
                            <button type="button" class="btn btn-xs btn-primary btn-confirm-asset-picker">Confirm Selection</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelectorAll('.btn-close-asset-picker').forEach((b) => {
                b.addEventListener('click', () => modal.classList.add('vtt-hidden'));
            });
        }

        const allImages = flattenAllImageAssets(assetTree);
        const searchInput = modal.querySelector('#gallery-picker-search');
        const grid = modal.querySelector('#gallery-picker-grid');
        const countSpan = modal.querySelector('#gallery-picker-selected-count');
        const confirmBtn = modal.querySelector('.btn-confirm-asset-picker');

        const localSelected = new Set();

        const renderGrid = () => {
            const query = (searchInput?.value || '').toLowerCase().trim();
            const filtered = allImages.filter((img) => !query || (img.name || '').toLowerCase().includes(query));

            if (filtered.length === 0) {
                grid.innerHTML =
                    '<div style="grid-column: 1/-1; text-align:center; padding:32px; color:var(--color-text-muted);">No images found in asset gallery.</div>';
                return;
            }

            grid.innerHTML = filtered
                .map((item, idx) => {
                    const isSel = localSelected.has(item);
                    return `
                    <div class="picker-asset-thumb" data-idx="${idx}" style="border: 2px solid ${isSel ? 'var(--color-gold-base)' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; overflow: hidden; background: #0c0a14; cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 4px; box-shadow: ${isSel ? '0 0 8px rgba(212,175,55,0.4)' : 'none'};">
                        <img src="${escapeHtml(getSafeVttUrl(item.url))}" data-raw-src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}" style="width:100%; height:75px; object-fit:cover; border-radius:4px;" data-fallback-src="favicon.svg">
                        <div style="font-size:0.65rem; color:#fff; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; margin-top:2px;">
                            ${escapeHtml(item.name)}
                        </div>
                    </div>
                `;
                })
                .join('');

            grid.querySelectorAll('.picker-asset-thumb').forEach((thumb) => {
                thumb.addEventListener('click', () => {
                    const idx = parseInt(thumb.dataset.idx, 10);
                    const item = filtered[idx];
                    if (!multiSelect) {
                        localSelected.clear();
                        localSelected.add(item);
                        renderGrid();
                    } else {
                        if (localSelected.has(item)) localSelected.delete(item);
                        else localSelected.add(item);
                        renderGrid();
                    }
                    if (countSpan) countSpan.textContent = `${localSelected.size} selected`;
                });
            });
        };

        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => renderGrid();
        }

        confirmBtn.onclick = () => {
            modal.classList.add('vtt-hidden');
            if (typeof onSelect === 'function') {
                onSelect(Array.from(localSelected));
            }
        };

        renderGrid();
        modal.classList.remove('vtt-hidden');
    }

    if (typeof window !== 'undefined') {
        if (!window.VTT) window.VTT = {};
        window.VTT.openAssetPickerModal = openAssetPickerModal;
    }

    // Context Menu: Delete
    document.getElementById('btn-asset-ctx-delete')?.addEventListener('click', async () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');

        const confirmMsg =
            item.type === 'folder'
                ? `Are you sure you want to delete the folder "${item.name}" and all its contents?`
                : `Are you sure you want to delete "${item.name}"?`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/assets/delete', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    path: item.path,
                    isUrl: item.type === 'url',
                    folderPath: currentPath,
                    name: item.name
                })
            });

            if (res.ok) {
                selectedAssets.delete(getAssetKey(item));
                updateBatchToolbar();
                await fetchAssetTree();
            } else {
                const err = await res.json();
                alert(`Failed to delete: ${err.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Delete error', err);
        }
    });

    // Initial fetch
    fetchAssetTree();
});
