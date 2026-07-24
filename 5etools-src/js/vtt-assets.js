document.addEventListener('DOMContentLoaded', () => {
    // Note: Depends on VTT core elements and potentially utils.
    // Ensure the tab initializes only when available
    const assetTabBtn = document.querySelector('[data-tab="tab-assets"]');
    if (!assetTabBtn) return; // Not present on this view

    const galleryList = document.getElementById('asset-gallery-list');
    const breadcrumbs = document.getElementById('asset-breadcrumbs');
    const searchInput = document.getElementById('asset-search');
    const btnNewFolder = document.getElementById('btn-asset-new-folder');
    const btnAddUrl = document.getElementById('btn-asset-add-url');
    const fileUpload = document.getElementById('asset-file-upload');

    let assetTree = null;
    let currentPath = ""; // empty string means root
    let assetContextMenuTarget = null; // { item, el }
    async function fetchAssetTree() {
        try {
            const res = await fetch('/api/assets');
            if (!res.ok) throw new Error('Failed to fetch assets');
            assetTree = await res.json();
            renderAssets();
        } catch (err) {
            console.error(err);
            galleryList.innerHTML = `<div class="init-empty-state" style="grid-column: 1/-1; color: var(--color-danger);">Failed to load assets: ${err.message}</div>`;
        }
    }

    function getCurrentFolderNode(tree, pathStr) {
        if (!pathStr || pathStr === "") return tree;
        const parts = pathStr.split('/');
        let current = tree;
        for (const p of parts) {
            if (!p) continue;
            const child = current.children.find(c => c.name === p && c.type === 'folder');
            if (child) {
                current = child;
            } else {
                return null;
            }
        }
        return current;
    }

    function renderBreadcrumbs() {
        if (!currentPath) {
            breadcrumbs.innerHTML = `<span class="breadcrumb-link" data-path="">Root</span>`;
            return;
        }
        
        let html = `<span class="breadcrumb-link" data-path="">Root</span>`;
        const parts = currentPath.split('/');
        let buildPath = "";
        
        parts.forEach((part, i) => {
            if (!part) return;
            buildPath += (buildPath ? "/" : "") + part;
            html += ` > <span class="breadcrumb-link" data-path="${buildPath}">${part}</span>`;
        });
        
        breadcrumbs.innerHTML = html;

        // Add click listeners to breadcrumbs
        breadcrumbs.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                currentPath = e.target.getAttribute('data-path') || "";
                renderAssets();
            });
        });
    }

    function renderAssets() {
        renderBreadcrumbs();
        
        if (!assetTree) return;
        
        const folderNode = getCurrentFolderNode(assetTree, currentPath);
        if (!folderNode) {
            currentPath = ""; // reset to root if not found
            renderAssets();
            return;
        }

        const filterText = searchInput.value.toLowerCase();
        let items = folderNode.children || [];
        
        if (filterText) {
            // Flat search across entire tree if filtering
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
                return a.name.localeCompare(b.name);
            });
        }

        if (items.length === 0) {
            galleryList.innerHTML = `<div class="init-empty-state" style="grid-column: 1/-1;">This folder is empty.</div>`;
            return;
        }

        galleryList.innerHTML = "";
        
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'asset-item';
            
            if (item.type === 'folder') {
                el.classList.add('asset-folder');
                el.innerHTML = `
                    <i class="fa-solid fa-folder asset-icon"></i>
                    <span class="asset-name" title="${item.name}">${item.name}</span>
                `;
                el.addEventListener('click', () => {
                    currentPath = item.path;
                    searchInput.value = "";
                    renderAssets();
                });
            } else {
                // File or URL
                let thumbHtml = "";
                const isVideo = item.url && item.url.match(/\.(mp4|webm|ogg)$/i);
                
                const isYoutube = item.url && item.url.includes('youtube.com/embed');
                
                if (isVideo) {
                    thumbHtml = `<video class="asset-thumb" src="${item.url}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>`;
                } else if (isYoutube) {
                    thumbHtml = `<iframe class="asset-thumb" src="${item.url}" frameborder="0" style="pointer-events: none; object-fit: cover;"></iframe>`;
                } else {
                    thumbHtml = `<img class="asset-thumb" src="${item.url}" alt="${item.name}" loading="lazy">`;
                }

                el.innerHTML = `
                    ${thumbHtml}
                    <span class="asset-name" title="${item.name}">${item.name}</span>
                `;
                
                // Drag and drop setup
                el.draggable = true;
                el.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'vtt-asset',
                        name: item.name,
                        url: item.url,
                        assetType: isVideo ? 'video' : 'image'
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                });
            }
            
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                assetContextMenuTarget = { item, el };
                const menu = document.getElementById('vtt-asset-context-menu');
                if (menu) {
                    menu.style.left = e.clientX + 'px';
                    menu.style.top = e.clientY + 'px';
                    menu.classList.remove('vtt-hidden');
                }
            });
            
            galleryList.appendChild(el);
        });
    }

    searchInput.addEventListener('input', () => {
        renderAssets();
    });

    btnNewFolder.addEventListener('click', async () => {
        const name = prompt("Enter new folder name:");
        if (!name) return;
        
        const folderPath = currentPath ? `${currentPath}/${name}` : name;
        
        try {
            const res = await fetch('/api/assets/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath })
            });
            if (res.ok) {
                await fetchAssetTree();
            }
        } catch (err) {
            console.error("Failed to create folder", err);
        }
    });

    btnAddUrl.addEventListener('click', async () => {
        let url = prompt("Enter direct image/video URL or YouTube link:");
        if (!url) return;
        
        let name = prompt("Enter a name for this asset:", "External Asset");
        if (!name) name = "External Asset";
        
        // Parse YouTube URLs to Embed format
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (ytMatch && ytMatch[1]) {
            const videoId = ytMatch[1];
            const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
            let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1`;
            if (listMatch && listMatch[1]) {
                embedUrl += `&list=${listMatch[1]}`;
            } else {
                embedUrl += `&playlist=${videoId}`;
            }
            url = embedUrl;
        }

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

    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        if (currentPath) formData.append('folderPath', currentPath);

        const uploadBtnLabel = document.querySelector('label[for="asset-file-upload"]');
        const origHtml = uploadBtnLabel.innerHTML;
        uploadBtnLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;

        try {
            const res = await fetch('/api/assets/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                await fetchAssetTree();
            } else {
                alert("Upload failed.");
            }
        } catch (err) {
            console.error("Upload error", err);
            alert("Upload error.");
        } finally {
            uploadBtnLabel.innerHTML = origHtml;
            fileUpload.value = ""; // Reset input
        }
    });

    // Context Menu Logic
    document.addEventListener('mousedown', (e) => {
        const menu = document.getElementById('vtt-asset-context-menu');
        if (menu && !menu.classList.contains('vtt-hidden') && !menu.contains(e.target)) {
            menu.classList.add('vtt-hidden');
        }
    });

    document.getElementById('btn-asset-ctx-edit')?.addEventListener('click', async () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        
        let newName = prompt("Enter new name for this asset:", item.name);
        if (!newName) return;
        
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
                alert("Failed to edit: " + err.error);
            }
        } catch (err) {
            console.error("Edit error", err);
        }
        
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
    });

    document.getElementById('btn-asset-ctx-delete')?.addEventListener('click', async () => {
        if (!assetContextMenuTarget) return;
        const { item } = assetContextMenuTarget;
        
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
                await fetchAssetTree();
            } else {
                const err = await res.json();
                alert("Failed to delete: " + err.error);
            }
        } catch (err) {
            console.error("Delete error", err);
        }
        
        document.getElementById('vtt-asset-context-menu').classList.add('vtt-hidden');
    });

    // Initial fetch
    fetchAssetTree();
});
