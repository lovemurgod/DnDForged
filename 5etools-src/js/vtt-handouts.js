export function initVttHandouts(vtt) {
    const listEl = document.getElementById('handout-list');
    const btnCreate = document.getElementById('btn-handout-create');
    
    // Edit Modal Elements
    const modalEdit = document.getElementById('modal-edit-handout');
    const editTitleInput = document.getElementById('edit-handout-name');
    const editDescInput = document.getElementById('edit-handout-desc');
    const editUrlInput = document.getElementById('edit-handout-url');
    const btnEditSave = document.getElementById('btn-handout-save');
    const btnEditCancel = document.getElementById('btn-handout-cancel');
    const editModalTitle = document.getElementById('modal-edit-handout-title');
    
    // View Modal Elements
    const modalView = document.getElementById('modal-view-handout');
    const viewTitle = document.getElementById('view-handout-title');
    const viewDesc = document.getElementById('view-handout-desc');
    const viewMediaContainer = document.getElementById('view-handout-media-container');
    const btnViewClose = document.getElementById('btn-view-handout-close');

    let editingHandoutId = null;

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
            editModalTitle.innerHTML = '<i class="fa-solid fa-note-sticky text-gradient-gold"></i> Create Handout';
            editTitleInput.value = '';
            editDescInput.value = '';
            editUrlInput.value = '';
            modalEdit.classList.remove('vtt-hidden');
        });
    }

    function openEditModal(handout) {
        editingHandoutId = handout.id;
        editModalTitle.innerHTML = '<i class="fa-solid fa-note-sticky text-gradient-gold"></i> Edit Handout';
        editTitleInput.value = handout.title || '';
        editDescInput.value = handout.desc || '';
        editUrlInput.value = handout.url || '';
        modalEdit.classList.remove('vtt-hidden');
    }

    if (btnEditCancel) {
        btnEditCancel.addEventListener('click', () => {
            modalEdit.classList.add('vtt-hidden');
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

            if (editingHandoutId) {
                // Update
                const ho = vtt.campaignState.handouts.find(h => h.id === editingHandoutId);
                if (ho) {
                    ho.title = title;
                    ho.desc = desc;
                    ho.url = url;
                }
            } else {
                // Create
                vtt.campaignState.handouts.push({
                    id: generateId(),
                    title: title,
                    desc: desc,
                    url: url,
                    isVisible: false
                });
            }

            modalEdit.classList.add('vtt-hidden');
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
        viewTitle.textContent = handout.title || 'Handout';
        viewDesc.textContent = handout.desc || '';
        
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
            modalView.classList.add('vtt-hidden');
            viewMediaContainer.innerHTML = ''; // Stop videos
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

        visibleHandouts.forEach(ho => {
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
            titleWrap.style.color = ho.isVisible ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
            titleWrap.innerHTML = `<i class="fa-solid ${ho.isVisible ? 'fa-eye' : 'fa-eye-slash'} ${ho.isVisible ? 'text-gradient-gold' : ''}" style="margin-right:8px; font-size:0.8rem;"></i> ${ho.title}`;
            
            // Clicking card opens view modal
            titleWrap.addEventListener('click', () => openViewModal(ho));
            card.appendChild(titleWrap);

            if (vtt.role === 'GM') {
                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.gap = '6px';

                // Toggle visibility
                const btnVis = document.createElement('button');
                btnVis.className = `btn btn-xxs ${ho.isVisible ? 'btn-primary' : 'btn-secondary'}`;
                btnVis.title = ho.isVisible ? "Hide from Players" : "Show to Players";
                btnVis.innerHTML = `<i class="fa-solid ${ho.isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
                btnVis.addEventListener('click', (e) => { e.stopPropagation(); toggleVisibility(ho.id); });
                
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

                // Force Show
                const btnForce = document.createElement('button');
                btnForce.className = 'btn btn-xxs btn-primary';
                btnForce.title = "Force Pop-up on Player Screens";
                btnForce.innerHTML = '<i class="fa-solid fa-bullhorn"></i>';
                btnForce.addEventListener('click', (e) => { e.stopPropagation(); forceShow(ho.id); });

                actions.appendChild(btnVis);
                actions.appendChild(btnForce);
                actions.appendChild(btnEdit);
                actions.appendChild(btnDel);
                card.appendChild(actions);
            }

            listEl.appendChild(card);
        });
    }

    // Public API
    return {
        renderList,
        handleForceShow
    };
}
