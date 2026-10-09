export function initVttHandouts(vtt) {
    const listEl = document.getElementById('handout-list');
    const btnCreate = document.getElementById('btn-handout-create');
    const btnImport = document.getElementById('btn-handout-import');
    
    // Edit Modal Elements
    const modalEdit = document.getElementById('modal-edit-handout');
    const editTitleInput = document.getElementById('edit-handout-name');
    const editDescInput = document.getElementById('edit-handout-desc');
    const editUrlInput = document.getElementById('edit-handout-url');
    const editFolderInput = document.getElementById('edit-handout-folder');
    const btnEditSave = document.getElementById('btn-handout-save');
    const btnEditCancel = document.getElementById('btn-handout-cancel');
    const editModalTitle = document.getElementById('modal-edit-handout-title');
    
    // View Modal Elements
    const modalView = document.getElementById('modal-view-handout');
    const viewTitle = document.getElementById('view-handout-title');
    const viewDesc = document.getElementById('view-handout-desc');
    const viewMediaContainer = document.getElementById('view-handout-media-container');
    const btnViewClose = document.getElementById('btn-view-handout-close');

    // Import Wizard Elements
    const modalImport = document.getElementById('modal-import-handout');
    const btnImportClose = document.getElementById('btn-import-handout-close');
    const btnImportCancel = document.getElementById('btn-import-handout-cancel');
    const btnImportConfirm = document.getElementById('btn-import-handout-confirm');
    const importSelectedCount = document.getElementById('import-selected-count');
    const importWizardStatus = document.getElementById('import-wizard-status');
    const btnTabAdv = document.getElementById('btn-source-tab-adventures');
    const btnTabBooks = document.getElementById('btn-source-tab-books');
    const inputSourceSearch = document.getElementById('import-source-search');
    const sourceListEl = document.getElementById('import-source-list');
    const activeSourceBadge = document.getElementById('import-active-source-badge');
    const filterButtons = document.querySelectorAll('.import-filter-bar .import-filter-btn');
    const inputItemSearch = document.getElementById('import-item-search');
    const btnSelectAll = document.getElementById('btn-import-select-all');
    const btnDeselectAll = document.getElementById('btn-import-deselect-all');
    const itemTreeEl = document.getElementById('import-item-tree');
    const previewTitleEl = document.getElementById('import-preview-title');
    const previewTypePill = document.getElementById('import-preview-type-pill');
    const previewContainerEl = document.getElementById('import-preview-container');

    let editingHandoutId = null;
    const collapsedFolders = new Set();

    // Import Wizard State
    let adventuresIndex = null;
    let booksIndex = null;
    let currentSourceType = 'adventures'; // 'adventures' or 'books'
    let currentSelectedSource = null;
    let currentExtractedItems = [];
    let selectedItemIds = new Set();
    let activeFilter = 'all'; // 'all', 'image', 'inset', 'story'
    let itemSearchQuery = '';
    let previewedItem = null;

    // Ensure handouts array exists
    if (vtt.campaignState && !vtt.campaignState.handouts) {
        vtt.campaignState.handouts = [];
    }

    function generateId() {
        return 'ho_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    }

    // Modal Edit Operations
    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            editingHandoutId = null;
            if (editModalTitle) editModalTitle.innerHTML = '<i class="fa-solid fa-note-sticky text-gradient-gold"></i> Create Handout';
            if (editTitleInput) editTitleInput.value = '';
            if (editDescInput) editDescInput.value = '';
            if (editUrlInput) editUrlInput.value = '';
            if (editFolderInput) editFolderInput.value = '';
            if (modalEdit) modalEdit.classList.remove('vtt-hidden');
        });
    }

    function openEditModal(handout) {
        editingHandoutId = handout.id;
        if (editModalTitle) editModalTitle.innerHTML = '<i class="fa-solid fa-note-sticky text-gradient-gold"></i> Edit Handout';
        if (editTitleInput) editTitleInput.value = handout.title || '';
        if (editDescInput) editDescInput.value = handout.desc || '';
        if (editUrlInput) editUrlInput.value = handout.url || '';
        if (editFolderInput) editFolderInput.value = handout.folder || '';
        if (modalEdit) modalEdit.classList.remove('vtt-hidden');
    }

    if (btnEditCancel) {
        btnEditCancel.addEventListener('click', () => {
            if (modalEdit) modalEdit.classList.add('vtt-hidden');
            editingHandoutId = null;
        });
    }

    if (btnEditSave) {
        btnEditSave.addEventListener('click', () => {
            const title = editTitleInput.value.trim();
            if (!title) {
                alert("Handout needs a title.");
                return;
            }

            const desc = editDescInput.value.trim();
            const url = editUrlInput.value.trim();
            const folder = editFolderInput ? editFolderInput.value.trim() : '';

            if (editingHandoutId) {
                // Update
                const ho = vtt.campaignState.handouts.find(h => h.id === editingHandoutId);
                if (ho) {
                    ho.title = title;
                    ho.desc = desc;
                    ho.url = url;
                    ho.folder = folder;
                }
            } else {
                // Create
                vtt.campaignState.handouts.push({
                    id: generateId(),
                    title: title,
                    desc: desc,
                    url: url,
                    folder: folder,
                    subfolder: '',
                    type: 'custom',
                    isVisible: false
                });
            }

            if (modalEdit) modalEdit.classList.add('vtt-hidden');
            syncAndRender();
        });
    }

    // Viewer Operations
    function parseMediaUrl(url) {
        if (!url) return '';
        
        // YouTube
        let ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (ytMatch) {
            return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen style="border-radius:8px; border:1px solid var(--color-border-subtle);"></iframe>`;
        }

        // Vimeo
        let vmMatch = url.match(/vimeo\.com\/(?:.*#|.*\/videos\/)?([0-9]+)/i);
        if (vmMatch) {
            return `<iframe src="https://player.vimeo.com/video/${vmMatch[1]}" width="100%" height="400" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="border-radius:8px; border:1px solid var(--color-border-subtle);"></iframe>`;
        }

        // Raw video
        if (url.match(/\.(mp4|webm|ogg)$/i)) {
            return `<video src="${url}" controls style="max-width:100%; max-height:400px; border-radius:8px; border:1px solid var(--color-border-subtle);"></video>`;
        }

        // Default to Image
        return `<img src="${url}" style="max-width:100%; max-height:400px; border-radius:8px; border:1px solid var(--color-border-subtle); object-fit:contain;" alt="Handout Media">`;
    }

    function openViewModal(handout) {
        if (!modalView) return;
        viewTitle.textContent = handout.title || 'Handout';
        
        // Rich HTML or Text Rendering
        if (handout.html) {
            viewDesc.innerHTML = handout.html;
            if (window.Renderer?.dice?.bindRollButtons) {
                try { window.Renderer.dice.bindRollButtons(viewDesc); } catch (e) {}
            }
        } else {
            viewDesc.textContent = handout.desc || '';
        }
        
        if (handout.url) {
            viewMediaContainer.innerHTML = parseMediaUrl(handout.url);
            viewMediaContainer.style.display = 'block';
        } else {
            viewMediaContainer.innerHTML = '';
            viewMediaContainer.style.display = 'none';
        }
        
        modalView.classList.remove('vtt-hidden');
    }

    if (btnViewClose) {
        btnViewClose.addEventListener('click', () => {
            if (modalView) modalView.classList.add('vtt-hidden');
            if (viewMediaContainer) viewMediaContainer.innerHTML = ''; // Stop videos
        });
    }

    // Public method for data bridge
    function handleForceShow(handoutId) {
        if (!vtt.campaignState || !vtt.campaignState.handouts) return;
        const ho = vtt.campaignState.handouts.find(h => h.id === handoutId);
        if (ho) {
            openViewModal(ho);
            // Switch tab to handouts if not already
            const handoutsTabBtn = document.querySelector('.tab-header[data-tab="tab-handouts"]');
            if (handoutsTabBtn && !handoutsTabBtn.classList.contains('active')) {
                handoutsTabBtn.click();
            }
        }
    }

    function syncAndRender() {
        renderList();
        if (vtt.role === 'GM' && vtt.dataBridge && vtt.dataBridge.pushStateUpdate) {
            vtt.dataBridge.pushStateUpdate();
        }
    }

    function toggleVisibility(id) {
        const ho = vtt.campaignState.handouts.find(h => h.id === id);
        if (ho) {
            ho.isVisible = !ho.isVisible;
            syncAndRender();
        }
    }

    function deleteHandout(id) {
        if (!confirm("Are you sure you want to delete this handout?")) return;
        vtt.campaignState.handouts = vtt.campaignState.handouts.filter(h => h.id !== id);
        syncAndRender();
    }

    function forceShow(id) {
        if (vtt.dataBridge && vtt.dataBridge.emitForceShowHandout) {
            vtt.dataBridge.emitForceShowHandout(id);
        }
        // Show for self too
        handleForceShow(id);
    }

    // Helper: Create single handout card element
    function createHandoutCard(ho) {
        const card = document.createElement('div');
        card.className = 'character-card glassmorphism';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.padding = '8px 12px';
        card.style.cursor = 'pointer';

        const titleWrap = document.createElement('div');
        titleWrap.style.flex = '1';
        titleWrap.style.fontWeight = '600';
        titleWrap.style.minWidth = '0';
        titleWrap.style.color = ho.isVisible ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
        
        let typeIcon = 'fa-note-sticky';
        if (ho.type === 'image' || (!ho.type && ho.url)) typeIcon = 'fa-image';
        else if (ho.type === 'inset') typeIcon = 'fa-scroll';
        else if (ho.type === 'story') typeIcon = 'fa-book-open';

        titleWrap.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <i class="fa-solid ${typeIcon} text-gradient-gold" style="font-size:0.85rem; flex-shrink:0;"></i>
                <i class="fa-solid ${ho.isVisible ? 'fa-eye' : 'fa-eye-slash'} ${ho.isVisible ? 'text-gradient-gold' : ''}" style="font-size:0.75rem; flex-shrink:0;"></i>
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ho.title}</span>
            </div>
        `;
        
        titleWrap.addEventListener('click', () => openViewModal(ho));
        card.appendChild(titleWrap);

        if (vtt.role === 'GM') {
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '6px';
            actions.style.flexShrink = '0';

            // Toggle visibility
            const btnVis = document.createElement('button');
            btnVis.className = `btn btn-xxs ${ho.isVisible ? 'btn-primary' : 'btn-secondary'}`;
            btnVis.title = ho.isVisible ? "Hide from Players" : "Show to Players";
            btnVis.innerHTML = `<i class="fa-solid ${ho.isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
            btnVis.addEventListener('click', (e) => { e.stopPropagation(); toggleVisibility(ho.id); });
            
            // Force Show
            const btnForce = document.createElement('button');
            btnForce.className = 'btn btn-xxs btn-primary';
            btnForce.title = "Force Pop-up on Player Screens";
            btnForce.innerHTML = '<i class="fa-solid fa-bullhorn"></i>';
            btnForce.addEventListener('click', (e) => { e.stopPropagation(); forceShow(ho.id); });

            // Edit
            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn btn-xxs btn-secondary';
            btnEdit.title = "Edit Handout";
            btnEdit.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            btnEdit.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(ho); });

            // Delete
            const btnDel = document.createElement('button');
            btnDel.className = 'btn btn-xxs btn-danger';
            btnDel.title = "Delete Handout";
            btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
            btnDel.addEventListener('click', (e) => { e.stopPropagation(); deleteHandout(ho.id); });

            actions.appendChild(btnVis);
            actions.appendChild(btnForce);
            actions.appendChild(btnEdit);
            actions.appendChild(btnDel);
            card.appendChild(actions);
        }

        return card;
    }

    function renderList() {
        if (!listEl) return;
        listEl.innerHTML = '';

        const handouts = (vtt.campaignState && vtt.campaignState.handouts) ? vtt.campaignState.handouts : [];
        let visibleHandouts = handouts;
        
        if (vtt.role !== 'GM') {
            visibleHandouts = handouts.filter(h => h.isVisible);
        }

        if (visibleHandouts.length === 0) {
            listEl.innerHTML = '<div class="init-empty-state">No handouts available.</div>';
            return;
        }

        // Group handouts into folders
        const folderGroups = {};
        const rootHandouts = [];

        visibleHandouts.forEach(ho => {
            if (ho.folder && ho.folder.trim()) {
                const fName = ho.folder.trim();
                if (!folderGroups[fName]) folderGroups[fName] = [];
                folderGroups[fName].push(ho);
            } else {
                rootHandouts.push(ho);
            }
        });

        // 1. Render root / standalone handouts first
        if (rootHandouts.length > 0) {
            if (Object.keys(folderGroups).length > 0) {
                const rootLabel = document.createElement('div');
                rootLabel.className = 'handout-subfolder-label';
                rootLabel.innerHTML = '<i class="fa-solid fa-note-sticky text-gradient-gold"></i> Standalone Handouts';
                listEl.appendChild(rootLabel);
            }
            rootHandouts.forEach(ho => listEl.appendChild(createHandoutCard(ho)));
        }

        // 2. Render folder groups
        Object.keys(folderGroups).sort().forEach(folderName => {
            const folderItems = folderGroups[folderName];
            const isCollapsed = collapsedFolders.has(folderName);

            const groupEl = document.createElement('div');
            groupEl.className = `handout-folder-group ${isCollapsed ? 'collapsed' : ''}`;

            const headerEl = document.createElement('div');
            headerEl.className = 'handout-folder-header';
            
            const titleWrap = document.createElement('div');
            titleWrap.className = 'handout-folder-title-wrap';
            titleWrap.innerHTML = `
                <i class="fa-solid fa-chevron-down handout-folder-caret"></i>
                <i class="fa-solid fa-folder text-gradient-gold"></i>
                <span>${folderName}</span>
                <span class="handout-folder-count">${folderItems.length}</span>
            `;
            headerEl.appendChild(titleWrap);

            headerEl.addEventListener('click', (e) => {
                if (e.target.closest('.handout-folder-actions')) return;
                if (collapsedFolders.has(folderName)) {
                    collapsedFolders.delete(folderName);
                    groupEl.classList.remove('collapsed');
                } else {
                    collapsedFolders.add(folderName);
                    groupEl.classList.add('collapsed');
                }
            });

            if (vtt.role === 'GM') {
                const actionsEl = document.createElement('div');
                actionsEl.className = 'handout-folder-actions';

                // Show all in folder
                const btnShowAll = document.createElement('button');
                btnShowAll.className = 'btn btn-xxs btn-secondary';
                btnShowAll.title = 'Show all handouts in folder to players';
                btnShowAll.innerHTML = '<i class="fa-solid fa-eye"></i>';
                btnShowAll.addEventListener('click', (e) => {
                    e.stopPropagation();
                    folderItems.forEach(h => h.isVisible = true);
                    syncAndRender();
                });

                // Hide all in folder
                const btnHideAll = document.createElement('button');
                btnHideAll.className = 'btn btn-xxs btn-secondary';
                btnHideAll.title = 'Hide all handouts in folder from players';
                btnHideAll.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                btnHideAll.addEventListener('click', (e) => {
                    e.stopPropagation();
                    folderItems.forEach(h => h.isVisible = false);
                    syncAndRender();
                });

                // Delete folder
                const btnDeleteFolder = document.createElement('button');
                btnDeleteFolder.className = 'btn btn-xxs btn-danger';
                btnDeleteFolder.title = 'Delete all handouts in folder';
                btnDeleteFolder.innerHTML = '<i class="fa-solid fa-trash"></i>';
                btnDeleteFolder.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete all ${folderItems.length} handouts in folder "${folderName}"?`)) return;
                    const idsToDelete = new Set(folderItems.map(h => h.id));
                    vtt.campaignState.handouts = vtt.campaignState.handouts.filter(h => !idsToDelete.has(h.id));
                    syncAndRender();
                });

                actionsEl.appendChild(btnShowAll);
                actionsEl.appendChild(btnHideAll);
                actionsEl.appendChild(btnDeleteFolder);
                headerEl.appendChild(actionsEl);
            }

            const contentEl = document.createElement('div');
            contentEl.className = 'handout-folder-content';

            // Check for subfolders within this folder
            const subfolders = {};
            const unassigned = [];
            folderItems.forEach(h => {
                if (h.subfolder && h.subfolder.trim() && h.subfolder.trim() !== folderName) {
                    const sub = h.subfolder.trim();
                    if (!subfolders[sub]) subfolders[sub] = [];
                    subfolders[sub].push(h);
                } else {
                    unassigned.push(h);
                }
            });

            if (Object.keys(subfolders).length > 0) {
                if (unassigned.length > 0) {
                    unassigned.forEach(ho => contentEl.appendChild(createHandoutCard(ho)));
                }
                Object.keys(subfolders).sort().forEach(subName => {
                    const subLabel = document.createElement('div');
                    subLabel.className = 'handout-subfolder-label';
                    subLabel.textContent = subName;
                    contentEl.appendChild(subLabel);
                    subfolders[subName].forEach(ho => contentEl.appendChild(createHandoutCard(ho)));
                });
            } else {
                folderItems.forEach(ho => contentEl.appendChild(createHandoutCard(ho)));
            }

            groupEl.appendChild(headerEl);
            groupEl.appendChild(contentEl);
            listEl.appendChild(groupEl);
        });
    }

    // ─── Handout Import Wizard Engine ──────────────────────────────────────────

    function initImportWizard() {
        if (!btnImport || !modalImport) return;

        btnImport.addEventListener('click', () => {
            openImportWizard();
        });

        if (btnImportClose) {
            btnImportClose.addEventListener('click', () => {
                modalImport.classList.add('vtt-hidden');
            });
        }

        if (btnImportCancel) {
            btnImportCancel.addEventListener('click', () => {
                modalImport.classList.add('vtt-hidden');
            });
        }

        if (btnTabAdv) {
            btnTabAdv.addEventListener('click', () => {
                currentSourceType = 'adventures';
                btnTabAdv.classList.add('btn-primary', 'active');
                btnTabAdv.classList.remove('btn-secondary');
                btnTabBooks.classList.add('btn-secondary');
                btnTabBooks.classList.remove('btn-primary', 'active');
                renderSourceList();
            });
        }

        if (btnTabBooks) {
            btnTabBooks.addEventListener('click', () => {
                currentSourceType = 'books';
                btnTabBooks.classList.add('btn-primary', 'active');
                btnTabBooks.classList.remove('btn-secondary');
                btnTabAdv.classList.add('btn-secondary');
                btnTabAdv.classList.remove('btn-primary', 'active');
                renderSourceList();
            });
        }

        if (inputSourceSearch) {
            inputSourceSearch.addEventListener('input', () => {
                renderSourceList();
            });
        }

        if (filterButtons) {
            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilter = btn.dataset.filter || 'all';
                    renderContentTree();
                });
            });
        }

        if (inputItemSearch) {
            inputItemSearch.addEventListener('input', (e) => {
                itemSearchQuery = e.target.value.toLowerCase().trim();
                renderContentTree();
            });
        }

        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', () => {
                const visibleItems = getFilteredItems();
                visibleItems.forEach(it => selectedItemIds.add(it.id));
                updateSelectionState();
                renderContentTree();
            });
        }

        if (btnDeselectAll) {
            btnDeselectAll.addEventListener('click', () => {
                selectedItemIds.clear();
                updateSelectionState();
                renderContentTree();
            });
        }

        if (btnImportConfirm) {
            btnImportConfirm.addEventListener('click', () => {
                executeBatchImport();
            });
        }
    }

    async function openImportWizard() {
        modalImport.classList.remove('vtt-hidden');
        if (!adventuresIndex || !booksIndex) {
            await loadSourceIndexes();
        }
        renderSourceList();
    }

    async function loadSourceIndexes() {
        sourceListEl.innerHTML = '<div class="init-empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading module catalog...</div>';
        try {
            let res = await fetch('/api/handouts/catalog');
            if (!res.ok) res = await fetch('data/handouts-catalog.json');
            if (res.ok) {
                const catalog = await res.json();
                adventuresIndex = catalog.filter(m => m.type === 'adventure');
                booksIndex = catalog.filter(m => m.type === 'book');
            } else {
                throw new Error("Could not load handouts catalog");
            }
        } catch (err) {
            console.error("Failed to load handouts catalog:", err);
            sourceListEl.innerHTML = '<div class="init-empty-state text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Error loading module catalog.</div>';
        }
    }

    function renderSourceList() {
        if (!sourceListEl) return;
        sourceListEl.innerHTML = '';

        const list = currentSourceType === 'adventures' ? (adventuresIndex || []) : (booksIndex || []);
        const query = inputSourceSearch ? inputSourceSearch.value.toLowerCase().trim() : '';

        const filtered = list.filter(item => {
            if (!query) return true;
            return (item.name && item.name.toLowerCase().includes(query)) ||
                   (item.id && item.id.toLowerCase().includes(query)) ||
                   (item.author && item.author.toLowerCase().includes(query)) ||
                   (item.storyline && item.storyline.toLowerCase().includes(query));
        });

        if (filtered.length === 0) {
            sourceListEl.innerHTML = '<div class="init-empty-state">No matching modules found.</div>';
            return;
        }

        filtered.forEach(src => {
            const card = document.createElement('div');
            card.className = `import-source-card ${currentSelectedSource && currentSelectedSource.id === src.id ? 'active' : ''}`;
            
            let coverHtml = '';
            if (src.cover) {
                coverHtml = `<img src="${src.cover}" class="import-source-card-cover" onerror="this.style.display='none'">`;
            } else {
                coverHtml = `<div class="import-source-card-cover" style="display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-book text-muted" style="font-size:0.8rem;"></i></div>`;
            }

            card.innerHTML = `
                ${coverHtml}
                <div class="import-source-card-info">
                    <div class="import-source-card-title" title="${src.name}">${src.name}</div>
                    <div class="import-source-card-meta">
                        <span class="bestiary-source-pill edition-5e">${src.id || src.source}</span>
                        ${src.handoutCount ? `<span>${src.handoutCount} items</span>` : ''}
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                selectSource(src);
            });

            sourceListEl.appendChild(card);
        });
    }

    async function selectSource(src) {
        currentSelectedSource = src;
        renderSourceList(); // Update active card state

        if (activeSourceBadge) {
            activeSourceBadge.textContent = src.name;
            activeSourceBadge.title = src.name;
        }

        itemTreeEl.innerHTML = '<div class="init-empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading handouts...</div>';
        selectedItemIds.clear();
        updateSelectionState();

        const srcKey = (src.id || src.source).toLowerCase();
        let items = null;
        try {
            let res = await fetch(`/api/handouts/${srcKey}`);
            if (!res.ok) res = await fetch(`data/handouts-normalized/handouts-${srcKey}.json`);
            if (res.ok) {
                items = await res.json();
            } else {
                throw new Error(`Failed to load handouts for ${srcKey}`);
            }
        } catch (err) {
            console.error("Error loading handout partition:", err);
            itemTreeEl.innerHTML = `<div class="init-empty-state text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Could not load handouts for ${src.name}.</div>`;
            return;
        }

        currentExtractedItems = items || [];
        updateFilterCounts();
        renderContentTree();

        // Auto preview first item if available
        if (currentExtractedItems.length > 0) {
            previewItem(currentExtractedItems[0]);
        }
    }

    function updateFilterCounts() {
        const cAll = document.getElementById('count-filter-all');
        const cImg = document.getElementById('count-filter-image');
        const cIns = document.getElementById('count-filter-inset');
        const cSty = document.getElementById('count-filter-story');

        const totalAll = currentExtractedItems.length;
        const totalImg = currentExtractedItems.filter(i => i.type === 'image').length;
        const totalIns = currentExtractedItems.filter(i => i.type === 'inset').length;
        const totalSty = currentExtractedItems.filter(i => i.type === 'story').length;

        if (cAll) cAll.textContent = totalAll;
        if (cImg) cImg.textContent = totalImg;
        if (cIns) cIns.textContent = totalIns;
        if (cSty) cSty.textContent = totalSty;
    }

    function getFilteredItems() {
        return currentExtractedItems.filter(it => {
            // Type filter
            if (activeFilter !== 'all' && it.type !== activeFilter) return false;
            // Search query filter
            if (itemSearchQuery) {
                const matchTitle = it.title && it.title.toLowerCase().includes(itemSearchQuery);
                const matchChapter = it.chapter && it.chapter.toLowerCase().includes(itemSearchQuery);
                if (!matchTitle && !matchChapter) return false;
            }
            return true;
        });
    }

    function renderContentTree() {
        if (!itemTreeEl) return;
        itemTreeEl.innerHTML = '';

        const visibleItems = getFilteredItems();

        if (visibleItems.length === 0) {
            itemTreeEl.innerHTML = '<div class="init-empty-state">No matching handouts found with current filter.</div>';
            return;
        }

        // Group by chapter
        const chapters = {};
        visibleItems.forEach(it => {
            const ch = it.chapter || 'General Content';
            if (!chapters[ch]) chapters[ch] = [];
            chapters[ch].push(it);
        });

        Object.keys(chapters).forEach(chName => {
            const chItems = chapters[chName];
            const chGroup = document.createElement('div');
            chGroup.className = 'import-chapter-group';

            const chHeader = document.createElement('div');
            chHeader.className = 'import-chapter-header';
            
            const allChSelected = chItems.every(i => selectedItemIds.has(i.id));
            chHeader.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="import-chapter-cb" ${allChSelected ? 'checked' : ''} style="cursor:pointer; accent-color:var(--color-gold-base);">
                    <span>${chName}</span>
                </div>
                <span style="font-size:0.7rem; color:var(--color-text-muted); font-weight:normal;">${chItems.length} items</span>
            `;

            // Chapter checkbox toggle all in chapter
            const chCb = chHeader.querySelector('.import-chapter-cb');
            chCb.addEventListener('click', (e) => {
                e.stopPropagation();
                const check = chCb.checked;
                chItems.forEach(i => {
                    if (check) selectedItemIds.add(i.id);
                    else selectedItemIds.delete(i.id);
                });
                updateSelectionState();
                renderContentTree();
            });

            chGroup.appendChild(chHeader);

            chItems.forEach(item => {
                const row = document.createElement('div');
                const isSelected = selectedItemIds.has(item.id);
                const isPreview = previewedItem && previewedItem.id === item.id;
                row.className = `import-item-row ${isPreview ? 'preview-active' : ''}`;

                let badgeClass = 'badge-type-image';
                let typeLabel = 'Image';
                let iconClass = 'fa-image';
                if (item.type === 'inset') {
                    badgeClass = 'badge-type-inset';
                    typeLabel = 'Inset';
                    iconClass = 'fa-scroll';
                } else if (item.type === 'story') {
                    badgeClass = 'badge-type-story';
                    typeLabel = 'Story';
                    iconClass = 'fa-book-open';
                }

                row.innerHTML = `
                    <input type="checkbox" class="import-item-cb" ${isSelected ? 'checked' : ''}>
                    <i class="fa-solid ${iconClass} text-gradient-gold" style="font-size:0.78rem;"></i>
                    <div class="import-item-label" title="${item.title}">${item.title}</div>
                    <span class="badge-item-type ${badgeClass}">${typeLabel}</span>
                `;

                const cb = row.querySelector('.import-item-cb');
                cb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (cb.checked) selectedItemIds.add(item.id);
                    else selectedItemIds.delete(item.id);
                    updateSelectionState();
                });

                row.addEventListener('click', () => {
                    previewItem(item);
                    document.querySelectorAll('.import-item-row').forEach(r => r.classList.remove('preview-active'));
                    row.classList.add('preview-active');
                });

                chGroup.appendChild(row);
            });

            itemTreeEl.appendChild(chGroup);
        });
    }

    function previewItem(item) {
        previewedItem = item;
        if (!previewContainerEl) return;

        if (previewTitleEl) {
            previewTitleEl.textContent = item.title;
            previewTitleEl.title = item.title;
        }

        if (previewTypePill) {
            previewTypePill.classList.remove('vtt-hidden', 'badge-type-image', 'badge-type-inset', 'badge-type-story');
            if (item.type === 'image') {
                previewTypePill.classList.add('badge-type-image');
                previewTypePill.textContent = 'Image / Map';
            } else if (item.type === 'inset') {
                previewTypePill.classList.add('badge-type-inset');
                previewTypePill.textContent = 'Letter / Inset';
            } else {
                previewTypePill.classList.add('badge-type-story');
                previewTypePill.textContent = 'Story Section';
            }
        }

        previewContainerEl.innerHTML = '';

        if (item.type === 'image' && item.url) {
            const imgBox = document.createElement('div');
            imgBox.className = 'import-preview-img-box';
            imgBox.innerHTML = `
                <img src="${item.url}" class="import-preview-img" alt="${item.title}" onerror="this.onerror=null; this.src='img/TextLogo.png';">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:6px;">${item.url}</div>
            `;
            previewContainerEl.appendChild(imgBox);
        }

        if (item.html) {
            const htmlBox = document.createElement('div');
            htmlBox.className = 'import-preview-html-box';
            htmlBox.innerHTML = item.html;
            if (window.Renderer?.dice?.bindRollButtons) {
                try { window.Renderer.dice.bindRollButtons(htmlBox); } catch (e) {}
            }
            previewContainerEl.appendChild(htmlBox);
        } else if (item.desc) {
            const descBox = document.createElement('div');
            descBox.className = 'import-preview-html-box';
            descBox.style.whiteSpace = 'pre-wrap';
            descBox.textContent = item.desc;
            previewContainerEl.appendChild(descBox);
        }
    }

    function updateSelectionState() {
        const count = selectedItemIds.size;
        if (importSelectedCount) importSelectedCount.textContent = count;
        if (btnImportConfirm) btnImportConfirm.disabled = count === 0;

        if (importWizardStatus) {
            if (count === 0) {
                importWizardStatus.innerHTML = '<i class="fa-solid fa-circle-info text-gradient-gold"></i> Select items from the list to import into your campaign.';
            } else {
                const folderName = currentSelectedSource ? (currentSelectedSource.name || currentSelectedSource.id) : 'Imported Handouts';
                importWizardStatus.innerHTML = `<i class="fa-solid fa-check text-success"></i> Ready to import <strong>${count}</strong> item(s) into folder <em>"${folderName}"</em>.`;
            }
        }
    }

    function executeBatchImport() {
        if (selectedItemIds.size === 0) return;

        const itemsToImport = currentExtractedItems.filter(it => selectedItemIds.has(it.id));
        if (itemsToImport.length === 0) return;

        itemsToImport.forEach(it => {
            vtt.campaignState.handouts.push({
                id: generateId(),
                title: it.title,
                desc: it.desc || '',
                html: it.html || '',
                url: it.url || '',
                folder: it.folder || 'Imported Handouts',
                subfolder: it.subfolder || '',
                type: it.type || 'custom',
                isVisible: false
            });
        });

        // Ensure newly imported folder is expanded
        if (itemsToImport[0].folder) {
            collapsedFolders.delete(itemsToImport[0].folder);
        }

        syncAndRender();
        if (modalImport) modalImport.classList.add('vtt-hidden');

        // Toast notification
        if (window.showToast) {
            window.showToast(`Imported ${itemsToImport.length} handouts from ${itemsToImport[0].folder}!`, 'success');
        } else {
            alert(`Successfully imported ${itemsToImport.length} handouts into "${itemsToImport[0].folder}"!`);
        }
    }

    // Initialize Importer
    initImportWizard();

    // Public API
    return {
        renderList,
        handleForceShow,
        openImportWizard
    };
}
