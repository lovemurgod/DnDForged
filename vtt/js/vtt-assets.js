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
    let currentPath = ""; // empty string means root
    let selectedAssets = new Map(); // key: unique identifier (path or url), value: item object
    let lastClickedIndex = -1;
    let currentRenderItems = [];
    let renderedCount = 0;
    const CHUNK_SIZE = 48;
    let assetContextMenuTarget = null; // { item, el }
    let activePreviewAsset = null;
    let activeMoveDestination = "";
    let isUploading = false;

    // View mode and zoom from preferences
    let viewMode = localStorage.getItem('vtt_asset_view_mode') || 'grid';
    let zoomSize = parseInt(localStorage.getItem('vtt_asset_zoom_size') || '80', 10);

    function applyViewPreferences() {
        if (galleryList) {
            if (viewMode === 'list') {
                galleryList.classList.add('list-view');
                if (btnViewToggle) btnViewToggle.innerHTML = '<i class="fa-solid fa-grip"></i>';
                if (btnViewToggle) btnViewToggle.title = 'Switch to Grid View';
            } else {
                galleryList.classList.remove('list-view');
                if (btnViewToggle) btnViewToggle.innerHTML = '<i class="fa-solid fa-list"></i>';
                if (btnViewToggle) btnViewToggle.title = 'Switch to List View';
                galleryList.style.gridTemplateColumns = `repeat(auto-fill, minmax(${zoomSize}px, 1fr))`;
            }
            galleryList.style.setProperty('--asset-thumb-size', `${Math.max(40, zoomSize - 20)}px`);
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
        if (!pathStr || pathStr === "") return tree;
        const parts = pathStr.split('/');
        let current = tree;
        for (const p of parts) {
            if (!p) continue;
            const child = (current && Array.isArray(current.children)) ? current.children.find(c => c.name === p && c.type === 'folder') : null;
            if (child) {
                current = child;
            } else {
                return null;
            }
        }
        return current;
    }

    // Collect all folder paths for the move destination dialog
    function collectFolderList(node, currentPrefix = "", acc = []) {
        if (!node) return acc;
        if (currentPrefix === "") {
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
            let buildPath = "";
            parts.forEach((part) => {
                if (!part) return;
                buildPath += (buildPath ? "/" : "") + part;
                const safePath = escapeHtml(buildPath);
                const safePart = escapeHtml(part);
                html += ` <span style="opacity: 0.5;">&gt;</span> <span class="breadcrumb-link" data-path="${safePath}" title="Drop assets here to move to ${safePart}">${safePart}</span>`;
            });
        }
        breadcrumbs.innerHTML = html;

        // Breadcrumb clicks & Drop zones for internal organization
        breadcrumbs.querySelectorAll('.breadcrumb-link').forEach(link => {
            const linkPath = link.getAttribute('data-path') || "";
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
        galleryList.querySelectorAll('.asset-item').forEach(el => {
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
            currentPath = ""; // reset to root if folder deleted or not found
            renderAssets();
            return;
        }

        const filterText = searchInput ? searchInput.value.toLowerCase().trim() : "";
        let items = folderNode.children ? [...folderNode.children] : [];

        if (filterText) {
            // Flat search across entire tree if searching
            const allItems = [];
            function collect(node) {
                if (node.children) {
                    node.children.forEach(c => {
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
        galleryList.innerHTML = "";

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
                if (searchInput) searchInput.value = "";
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

            let thumbInner = "";
            let badgeHtml = "";

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
                thumbInner = `<img class="asset-thumb" src="${escapeHtml(item.url)}" alt="${safeName}" loading="lazy">`;
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
                        mountedVideo.src = item.url;
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
                        } catch(e) {}
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
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'vtt-asset',
                    name: item.name,
                    url: item.url,
                    assetType: isVideo ? 'video' : 'image'
                }));
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
            const name = prompt("Enter new folder name:");
            if (!name || !name.trim()) return;
            const cleanName = name.trim().replace(/[\/\\?%*:|"<>]/g, '_');
            const folderPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;

            try {
                const res = await fetch('/api/assets/folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath })
                });
                if (res.ok) {
                    await fetchAssetTree();
                } else {
                    const err = await res.json();
                    alert(`Failed to create folder: ${err.error || 'Unknown error'}`);
                }
            } catch (err) {
                console.error("Failed to create folder", err);
            }
        });
    }

    // Add External URL
    if (btnAddUrl) {
        btnAddUrl.addEventListener('click', async () => {
            let url = prompt("Enter direct image/video URL or YouTube link:");
            if (!url) return;

            if (window.VTT && typeof window.VTT.resolveMediaUrl === 'function') {
                try {
                    const res = await window.VTT.resolveMediaUrl(url);
                    if (res && res.resolvedUrl) {
                        url = res.resolvedUrl;
                    }
                } catch (e) {}
            }

            let name = prompt("Enter a name for this asset:", "External Asset");
            if (!name) name = "External Asset";

            try {
                const res = await fetch('/api/assets/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, name, folderPath: currentPath })
                });
                if (res.ok) {
                    await fetchAssetTree();
                }
            } catch (err) {
                console.error("Failed to add URL", err);
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
                const relativePath = item.relativePath || "";

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
            const batch = files.map(f => ({ file: f, relativePath: f.name }));
            await uploadFilesBatch(batch);
            fileUpload.value = "";
        });
    }

    // Folder Upload Input Change (Preserving Full Directory Tree)
    if (folderUpload) {
        folderUpload.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            const batch = files.map(f => ({
                file: f,
                relativePath: f.webkitRelativePath || f.name
            }));
            await uploadFilesBatch(batch);
            folderUpload.value = "";
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
                    async function traverseEntry(entry, pathPrefix = "") {
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
                            await traverseEntry(entry, "");
                        }
                    }
                } else {
                    // Fallback flat files
                    const files = Array.from(e.dataTransfer.files || []);
                    files.forEach(f => collectedFiles.push({ file: f, relativePath: f.name }));
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
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
            console.error("Move error:", err);
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

            const itemsToDelete = Array.from(selectedAssets.values()).map(item => ({
                path: item.path,
                isUrl: item.type === 'url',
                folderPath: currentPath,
                name: item.name,
                url: item.url
            }));

            try {
                const res = await fetch('/api/assets/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                console.error("Batch delete error", err);
            }
        });
    }

    if (btnBatchMove) {
        btnBatchMove.addEventListener('click', () => {
            if (selectedAssets.size === 0) return;
            openMoveDestinationModal(Array.from(selectedAssets.values()));
        });
    }

    // Move Destination Picker Modal
    function openMoveDestinationModal(itemsToMove) {
        if (!modalMove || !moveFolderList) return;
        activeMoveDestination = "";
        const allFolders = collectFolderList(assetTree, "", []);

        moveFolderList.innerHTML = "";
        allFolders.forEach(f => {
            const itemEl = document.createElement('div');
            itemEl.className = 'asset-move-folder-item';
            const isCurrent = f.path === currentPath;
            const displayName = f.path === "" ? "📁 Root" : `📁 ${f.path}`;

            itemEl.innerHTML = `
                <span>${escapeHtml(displayName)}</span>
                ${isCurrent ? '<span style="font-size: 0.7rem; opacity: 0.6; margin-left: auto;">(Current)</span>' : ''}
            `;

            itemEl.addEventListener('click', () => {
                moveFolderList.querySelectorAll('.asset-move-folder-item').forEach(i => i.classList.remove('selected'));
                itemEl.classList.add('selected');
                activeMoveDestination = f.path;
            });

            moveFolderList.appendChild(itemEl);
        });

        // Set initial selection to first folder item
        const first = moveFolderList.querySelector('.asset-move-folder-item');
        if (first) {
            first.classList.add('selected');
            activeMoveDestination = allFolders[0]?.path || "";
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
        previewTitle.textContent = item.name || "Asset Preview";
        previewContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-gradient-gold" style="font-size: 2rem;"></i>`;
        previewInfo.textContent = "Loading dimensions...";

        const isVideo = item.url.match(/\.(mp4|webm|ogg)$/i) || item.url.includes('v.pinimg.com');
        const ytMatch = item.url.match(/(?:embed\/|v=|\.be\/)([a-zA-Z0-9_-]{11})/);

        if (isVideo) {
            const vid = document.createElement('video');
            vid.src = item.url;
            vid.controls = true;
            vid.autoplay = true;
            vid.loop = true;
            vid.style.maxWidth = '100%';
            vid.style.maxHeight = '100%';
            vid.style.objectFit = 'contain';
            vid.onloadedmetadata = () => {
                previewInfo.textContent = `Video: ${vid.videoWidth} × ${vid.videoHeight} px`;
            };
            previewContainer.innerHTML = "";
            previewContainer.appendChild(vid);
        } else if (ytMatch && ytMatch[1]) {
            previewContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border: none; border-radius: 4px;"></iframe>`;
            previewInfo.textContent = `YouTube Video (${ytMatch[1]})`;
        } else {
            const img = new Image();
            img.src = item.url;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.onload = () => {
                previewInfo.textContent = `Image: ${img.naturalWidth} × ${img.naturalHeight} px`;
            };
            img.onerror = () => {
                previewInfo.textContent = `Failed to load preview`;
            };
            previewContainer.innerHTML = "";
            previewContainer.appendChild(img);
        }

        modalPreview.classList.remove('vtt-hidden');
    }

    if (btnPreviewClose) btnPreviewClose.addEventListener('click', () => modalPreview.classList.add('vtt-hidden'));
    if (btnPreviewCopy) {
        btnPreviewCopy.addEventListener('click', () => {
            if (activePreviewAsset && activePreviewAsset.url) {
                const fullUrl = activePreviewAsset.url.startsWith('http') ? activePreviewAsset.url : window.location.origin + activePreviewAsset.url;
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
                const isVid = activePreviewAsset.url && (activePreviewAsset.url.match(/\.(mp4|webm|ogg)$/i) || activePreviewAsset.url.includes('youtube.com') || activePreviewAsset.url.includes('youtu.be'));
                spawnAssetToMap(activePreviewAsset, isVid);
                modalPreview.classList.add('vtt-hidden');
            }
        });
    }

    // Space hotkey to preview selected asset
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && selectedAssets.size === 1 && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
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
            const fullUrl = item.url.startsWith('http') ? item.url : window.location.origin + item.url;
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

        let newName = prompt("Enter new name for this asset:", item.name);
        if (!newName || !newName.trim()) return;
        newName = newName.trim();

        let newUrl = null;
        if (item.type === 'url') {
            newUrl = prompt("Enter new URL (or leave unchanged):", item.url);
            if (!newUrl) newUrl = item.url;
        }

        try {
            const res = await fetch('/api/assets/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            console.error("Edit error", err);
        }
    });

    // Context Menu: Delete
    document.getElementById('btn-asset-ctx-delete')?.addEventListener('click', async () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');

        const confirmMsg = item.type === 'folder' ?
            `Are you sure you want to delete the folder "${item.name}" and all its contents?` :
            `Are you sure you want to delete "${item.name}"?`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            console.error("Delete error", err);
        }
    });

    // Initial fetch
    fetchAssetTree();
});
