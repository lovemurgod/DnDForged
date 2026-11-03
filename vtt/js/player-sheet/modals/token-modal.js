/**
 * Player Sheet Token Art, Sizing, Auras & FX Settings Modal
 */

let tempPlayerAurasList = [];

export function getTempPlayerAurasList() {
    return tempPlayerAurasList;
}

export function setTempPlayerAurasList(list) {
    tempPlayerAurasList = list;
}

// Helper to resolve active token image URL safely with fallbacks
export function getPlayerActiveTokenUrl(c) {
    if (!c) return 'favicon.svg';
    if (Array.isArray(c.tokenImages) && c.tokenImages.length > 0) {
        const idx =
            typeof c.activeTokenIndex === 'number' &&
            c.activeTokenIndex >= 0 &&
            c.activeTokenIndex < c.tokenImages.length
                ? c.activeTokenIndex
                : 0;
        const raw = c.tokenImages[idx] || c.tokenImages[0];
        const u = typeof raw === 'string' ? raw : raw?.url || '';
        if (u) return u;
    }
    return (
        c.tokenImage ||
        c.avatar ||
        c.img ||
        c.avatarUrl ||
        (c.monsterData && typeof window.Renderer !== 'undefined' && window.Renderer.monster
            ? window.Renderer.monster.getTokenUrl(c.monsterData)
            : null) ||
        'favicon.svg'
    );
}

// Updates the 48px portrait circle beside the sheet name to show the correct media type
export function updateTokenPortrait(url) {
    const portrait = document.getElementById('pc-token-portrait');
    if (!portrait) return;
    portrait.innerHTML = '';
    const cleanUrl = (url || '').split('?')[0].toLowerCase();
    const safeUrl =
        typeof window.getSafeVttUrl === 'function'
            ? window.getSafeVttUrl(url)
            : url && (url.includes('discordapp.com') || url.includes('discordapp.net'))
              ? '/api/proxy-discord?url=' + encodeURIComponent(url)
              : url;
    const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
    const isYoutube =
        url && (url.includes('youtube.com/embed') || url.includes('youtube.com/watch') || url.includes('youtu.be/'));
    let mediaEl;
    if (isVideo) {
        mediaEl = document.createElement('video');
        mediaEl.src = safeUrl;
        mediaEl.muted = true;
        mediaEl.loop = true;
        mediaEl.autoplay = true;
        mediaEl.playsInline = true;
        mediaEl.draggable = false;
        mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;';
        portrait.appendChild(mediaEl);
        mediaEl.play().catch(() => {});
    } else if (isYoutube) {
        mediaEl = document.createElement('iframe');
        mediaEl.src = safeUrl;
        mediaEl.frameBorder = '0';
        mediaEl.allow = 'autoplay; encrypted-media';
        mediaEl.style.cssText = 'width:100%; height:100%; pointer-events:none; border:none;';
        portrait.appendChild(mediaEl);
    } else {
        mediaEl = document.createElement('img');
        mediaEl.src = safeUrl || 'favicon.svg';
        mediaEl.draggable = false;
        mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        portrait.appendChild(mediaEl);
    }
}

export function renderPlayerAuraList() {
    const container = document.getElementById('pc-token-auras-list');
    if (!container) return;
    container.innerHTML = '';
    if (tempPlayerAurasList.length === 0) {
        container.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 20px; font-style: italic; background: rgba(0,0,0,0.1); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.06);">
                No active auras configured for this token.
            </div>
        `;
        return;
    }

    tempPlayerAurasList.forEach((aura, idx) => {
        if (aura.enabled === undefined) aura.enabled = true;
        const isEnabled = aura.enabled !== false;
        const auraName = aura.name || '';
        const range = aura.range !== undefined ? aura.range : 10;
        const shape = aura.shape || 'circle';
        const style = aura.style || 'both';
        const opacity = aura.opacity !== undefined ? aura.opacity : 0.3;
        const color = aura.color || '#d4af37';
        const isExpanded = !!aura.isExpanded;

        const card = document.createElement('div');
        card.className = 'aura-item-card glass-flat';
        card.style.border = '1px solid rgba(255,255,255,0.06)';
        card.style.borderRadius = '6px';
        card.style.padding = '10px';
        card.style.background = isEnabled ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
        card.style.opacity = isEnabled ? '1' : '0.7';

        card.innerHTML = `
            <div class="aura-item-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; font-size: 0.75rem; color: var(--color-text-muted); ${isExpanded ? 'transform: rotate(90deg);' : ''}"></i>
                    <label class="aura-toggle-wrapper" style="margin: 0; display: flex; align-items: center; cursor: pointer;" title="${isEnabled ? 'Disable Aura' : 'Enable Aura'}">
                        <input type="checkbox" class="aura-enable-toggle" ${isEnabled ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-gold-base);">
                    </label>
                    <span class="aura-title-text" style="font-size: 0.8rem; font-weight: bold; color: ${isEnabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${auraName ? `<strong>${auraName}</strong>` : `Aura ${idx + 1}`}: <span style="font-weight: normal; opacity: 0.85;">${range}ft ${shape.charAt(0).toUpperCase() + shape.slice(1)}</span>
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                    <span class="swatch-preview" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 1px solid rgba(255,255,255,0.2); opacity: ${isEnabled ? '1' : '0.4'};"></span>
                    <button type="button" class="btn-delete-aura btn btn-icon btn-danger btn-xxs" style="padding: 2px 4px; font-size: 0.7rem; border-radius: 4px;" title="Delete Aura">
                        <i class="fa-solid fa-trash pointer-events-none"></i>
                    </button>
                </div>
            </div>
            
            <div class="aura-item-details ${isExpanded ? '' : 'vtt-hidden'}" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Label / Name</label>
                    <input type="text" class="aura-name-input" placeholder="e.g. Spirit Guardians, Aura of Courage" value="${auraName}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                </div>
                <div class="flex-row">
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Range (ft)</label>
                        <input type="number" class="aura-range-input" min="5" max="150" step="5" value="${range}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                    </div>
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Shape</label>
                        <select class="aura-shape-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                            <option value="circle" ${shape === 'circle' ? 'selected' : ''}>Circle</option>
                            <option value="square" ${shape === 'square' ? 'selected' : ''}>Square</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex-row mt-2">
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Render Style</label>
                        <select class="aura-style-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                            <option value="both" ${style === 'both' ? 'selected' : ''}>Fill & Border</option>
                            <option value="fill" ${style === 'fill' ? 'selected' : ''}>Fill Only</option>
                            <option value="border" ${style === 'border' ? 'selected' : ''}>Border Only</option>
                        </select>
                    </div>
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Opacity</label>
                        <div style="display: flex; align-items: center; gap: 8px; height: 28px;">
                            <input type="range" class="aura-opacity-slider" min="0.05" max="1.0" step="0.05" value="${opacity}" style="flex: 1; cursor: pointer;">
                            <span class="aura-opacity-val" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">${Math.round(opacity * 100)}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-group mt-2" style="margin-bottom: 0;">
                    <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Color</label>
                    <div class="aura-color-picker-row" style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                        <input type="color" class="aura-color-input" value="${color}" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);

        // Listeners for aura logic
        const header = card.querySelector('.aura-item-header');
        const details = card.querySelector('.aura-item-details');
        const chevron = card.querySelector('.aura-chevron');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-aura') || e.target.closest('.aura-toggle-wrapper')) return;
            const collapsed = details.classList.contains('vtt-hidden');
            if (collapsed) {
                details.classList.remove('vtt-hidden');
                chevron.style.transform = 'rotate(90deg)';
                tempPlayerAurasList[idx].isExpanded = true;
            } else {
                details.classList.add('vtt-hidden');
                chevron.style.transform = 'rotate(0deg)';
                tempPlayerAurasList[idx].isExpanded = false;
            }
        });

        const enableToggle = card.querySelector('.aura-enable-toggle');
        const nameInput = card.querySelector('.aura-name-input');
        const swatchPreview = card.querySelector('.swatch-preview');
        const titleText = card.querySelector('.aura-title-text');

        const updateAuraTitle = () => {
            const rng = card.querySelector('.aura-range-input').value;
            const shp = card.querySelector('.aura-shape-select').value;
            const curName = tempPlayerAurasList[idx].name;
            const isEn = tempPlayerAurasList[idx].enabled !== false;
            titleText.innerHTML = `
                ${curName ? `<strong>${curName}</strong>` : `Aura ${idx + 1}`}: <span style="font-weight: normal; opacity: 0.85;">${rng}ft ${shp.charAt(0).toUpperCase() + shp.slice(1)}</span>
            `;
            titleText.style.color = isEn ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
        };

        enableToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            const en = enableToggle.checked;
            tempPlayerAurasList[idx].enabled = en;
            updateAuraTitle();
            swatchPreview.style.opacity = en ? '1' : '0.4';
            card.style.opacity = en ? '1' : '0.7';
            card.style.background = en ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
        });

        nameInput.addEventListener('input', () => {
            tempPlayerAurasList[idx].name = nameInput.value.trim();
            updateAuraTitle();
        });

        card.querySelector('.aura-range-input').addEventListener('input', (e) => {
            tempPlayerAurasList[idx].range = parseInt(e.target.value) || 10;
            updateAuraTitle();
        });
        card.querySelector('.aura-shape-select').addEventListener('change', (e) => {
            tempPlayerAurasList[idx].shape = e.target.value;
            updateAuraTitle();
        });
        card.querySelector('.aura-style-select').addEventListener('change', (e) => {
            tempPlayerAurasList[idx].style = e.target.value;
        });
        card.querySelector('.aura-opacity-slider').addEventListener('input', (e) => {
            const op = parseFloat(e.target.value) || 0.3;
            tempPlayerAurasList[idx].opacity = op;
            card.querySelector('.aura-opacity-val').textContent = `${Math.round(op * 100)}%`;
        });
        card.querySelector('.aura-color-input').addEventListener('input', (e) => {
            tempPlayerAurasList[idx].color = e.target.value;
            swatchPreview.style.background = e.target.value;
        });
        card.querySelector('.btn-delete-aura').addEventListener('click', (e) => {
            e.stopPropagation();
            tempPlayerAurasList.splice(idx, 1);
            renderPlayerAuraList();
        });
    });
}

export function renderPlayerTokenGallery(options = {}) {
    const { getCurrentChar = () => window.currentChar } = options;
    const currentChar = getCurrentChar();
    const gal = document.getElementById('pc-token-gallery');
    if (!gal) return;
    gal.innerHTML = '';
    if (!currentChar || !currentChar.tokenImages || currentChar.tokenImages.length === 0) {
        gal.innerHTML =
            '<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No token artwork added.</span>';
        return;
    }
    currentChar.tokenImages.forEach((imgObj, idx) => {
        const isActive = currentChar.activeTokenIndex === idx;
        const url = imgObj.url || '';
        const safeItemUrl =
            typeof window.getSafeVttUrl === 'function'
                ? window.getSafeVttUrl(url)
                : url && (url.includes('discordapp.com') || url.includes('discordapp.net'))
                  ? '/api/proxy-discord?url=' + encodeURIComponent(url)
                  : url;
        const cleanUrl = url.split('?')[0].toLowerCase();
        const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
        const isYoutube =
            url.includes('youtube.com/embed') || url.includes('youtube.com/watch') || url.includes('youtu.be/');

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${isActive ? 'var(--color-success-base)' : 'transparent'}; cursor:pointer;`;
        wrapper.className = 'pc-token-gal-item';
        wrapper.dataset.idx = idx;

        let mediaEl;
        if (isVideo) {
            mediaEl = document.createElement('video');
            mediaEl.src = safeItemUrl;
            mediaEl.muted = true;
            mediaEl.loop = true;
            mediaEl.autoplay = true;
            mediaEl.playsInline = true;
            mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            mediaEl.play().catch(() => {});
        } else if (isYoutube) {
            mediaEl = document.createElement('iframe');
            mediaEl.src = safeItemUrl;
            mediaEl.frameBorder = '0';
            mediaEl.allow = 'autoplay; encrypted-media';
            mediaEl.style.cssText = 'width:100%; height:100%; pointer-events:none; border:none;';
        } else {
            mediaEl = document.createElement('img');
            mediaEl.src = safeItemUrl;
            mediaEl.title = imgObj.name || 'Token';
            mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        }
        wrapper.appendChild(mediaEl);

        if (isActive) {
            const badge = document.createElement('div');
            badge.style.cssText =
                'position:absolute; top:2px; right:2px; background:var(--color-success-base); color:#fff; border-radius:50%; width:16px; height:16px; font-size:0.6rem; display:flex; align-items:center; justify-content:center;';
            badge.innerHTML = '<i class="fa-solid fa-check"></i>';
            wrapper.appendChild(badge);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-xxs pc-token-gal-del';
        delBtn.dataset.idx = idx;
        delBtn.style.cssText = 'position:absolute; bottom:2px; right:2px; padding:2px 4px;';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        wrapper.appendChild(delBtn);

        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.pc-token-gal-del')) return;
            currentChar.activeTokenIndex = idx;
            updateTokenPortrait(imgObj.url);
            renderPlayerTokenGallery(options);
        });

        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentChar.tokenImages.splice(idx, 1);
            if (currentChar.activeTokenIndex >= currentChar.tokenImages.length) {
                currentChar.activeTokenIndex = Math.max(0, currentChar.tokenImages.length - 1);
            } else if (currentChar.activeTokenIndex > idx) {
                currentChar.activeTokenIndex--;
            }
            renderPlayerTokenGallery(options);
        });

        gal.appendChild(wrapper);

        if (isVideo) mediaEl.play().catch(() => {});
    });
}

export function setupPlayerTokenEditListeners(options = {}) {
    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    document.getElementById('modal-pc-token-edit-close')?.addEventListener('click', () => {
        document.getElementById('modal-pc-token-edit')?.classList.add('vtt-hidden');
        document.getElementById('modal-pc-token-edit-overlay')?.classList.add('vtt-hidden');
    });
    document.getElementById('modal-pc-token-edit-overlay')?.addEventListener('click', () => {
        document.getElementById('modal-pc-token-edit')?.classList.add('vtt-hidden');
        document.getElementById('modal-pc-token-edit-overlay')?.classList.add('vtt-hidden');
    });

    // Add URL
    document.getElementById('btn-pc-token-add-url')?.addEventListener('click', async () => {
        const currentChar = getCurrentChar();
        const urlInput = document.getElementById('pc-token-add-url');
        let rawUrl = urlInput?.value.trim();
        if (rawUrl) {
            const btn = document.getElementById('btn-pc-token-add-url');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const res = await fetch('/api/player-token/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: rawUrl })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (!currentChar.tokenImages) currentChar.tokenImages = [];
                    currentChar.tokenImages.push({ url: data.url, name: 'URL Media' });
                    currentChar.activeTokenIndex = currentChar.tokenImages.length - 1;
                    if (urlInput) urlInput.value = '';
                    renderPlayerTokenGallery(options);
                } else {
                    alert('Failed to process URL.');
                }
            } catch (e) {
                alert('Error: ' + e.message);
            } finally {
                btn.innerHTML = originalText;
            }
        }
    });

    // Upload File
    document.getElementById('btn-pc-token-upload')?.addEventListener('click', async () => {
        const currentChar = getCurrentChar();
        const fileInput = document.getElementById('pc-token-file');
        if (!fileInput || fileInput.files.length === 0) return alert('Select a file first.');
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        const btn = document.getElementById('btn-pc-token-upload');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                if (!currentChar.tokenImages) currentChar.tokenImages = [];
                currentChar.tokenImages.push({ url: data.url, name: file.name });
                currentChar.activeTokenIndex = currentChar.tokenImages.length - 1;
                renderPlayerTokenGallery(options);
            } else {
                alert('Upload failed.');
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.innerHTML = originalText;
            fileInput.value = '';
        }
    });

    // Aura add
    document.getElementById('btn-pc-token-add-aura')?.addEventListener('click', () => {
        tempPlayerAurasList.forEach((a) => (a.isExpanded = false));
        tempPlayerAurasList.push({
            name: '',
            enabled: true,
            range: 10,
            shape: 'circle',
            style: 'both',
            opacity: 0.3,
            color: '#d4af37',
            isExpanded: true
        });
        renderPlayerAuraList();
        const listContainer = document.getElementById('pc-token-auras-list');
        setTimeout(() => {
            if (listContainer) listContainer.scrollTop = listContainer.scrollHeight;
        }, 50);
    });

    // Tab Switching for FX
    const switchFxTab = (btnId, panelId) => {
        ['tab-btn-pc-fx-overlay', 'tab-btn-pc-fx-vignette', 'tab-btn-pc-fx-shadow'].forEach((id) =>
            document.getElementById(id)?.classList.remove('active')
        );
        ['panel-pc-fx-overlay', 'panel-pc-fx-vignette', 'panel-pc-fx-shadow'].forEach((id) =>
            document.getElementById(id)?.classList.add('vtt-hidden')
        );
        document.getElementById(btnId)?.classList.add('active');
        document.getElementById(panelId)?.classList.remove('vtt-hidden');
    };
    document
        .getElementById('tab-btn-pc-fx-overlay')
        ?.addEventListener('click', () => switchFxTab('tab-btn-pc-fx-overlay', 'panel-pc-fx-overlay'));
    document
        .getElementById('tab-btn-pc-fx-vignette')
        ?.addEventListener('click', () => switchFxTab('tab-btn-pc-fx-vignette', 'panel-pc-fx-vignette'));
    document
        .getElementById('tab-btn-pc-fx-shadow')
        ?.addEventListener('click', () => switchFxTab('tab-btn-pc-fx-shadow', 'panel-pc-fx-shadow'));

    // FX Expanders
    const bindDetailToggle = (cbId, detailsId) => {
        document.getElementById(cbId)?.addEventListener('change', (e) => {
            if (e.target.checked) document.getElementById(detailsId)?.classList.remove('vtt-hidden');
            else document.getElementById(detailsId)?.classList.add('vtt-hidden');
        });
    };
    bindDetailToggle('pc-token-edit-fx-overlay-enabled', 'pc-fx-overlay-details');
    bindDetailToggle('pc-token-edit-fx-vignette-enabled', 'pc-fx-vignette-details');
    bindDetailToggle('pc-token-edit-fx-shadow-enabled', 'pc-fx-shadow-details');

    // FX Sliders readouts
    document.getElementById('pc-token-edit-fx-overlay-opacity')?.addEventListener('input', (e) => {
        const span = document.getElementById('val-pc-fx-overlay-opacity');
        if (span) span.textContent = `${Math.round(e.target.value * 100)}%`;
    });
    document.getElementById('pc-token-edit-fx-vignette-opacity')?.addEventListener('input', (e) => {
        const span = document.getElementById('val-pc-fx-vignette-opacity');
        if (span) span.textContent = `${Math.round(e.target.value * 100)}%`;
    });
    document.getElementById('pc-token-edit-fx-shadow-opacity')?.addEventListener('input', (e) => {
        const span = document.getElementById('val-pc-fx-shadow-opacity');
        if (span) span.textContent = `${Math.round(e.target.value * 100)}%`;
    });

    // Save
    document.getElementById('modal-pc-token-edit-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;

        currentChar.tokenSize = parseFloat(document.getElementById('pc-token-edit-size')?.value) || 1;
        currentChar.tokenSight = parseInt(document.getElementById('pc-token-edit-sight')?.value) || 60;

        // Auras
        currentChar.tokenAuras = tempPlayerAurasList.map((a) => {
            const { isExpanded, ...clean } = a;
            return clean;
        });

        // FX
        currentChar.fxOverlayEnabled = !!document.getElementById('pc-token-edit-fx-overlay-enabled')?.checked;
        currentChar.fxOverlayOpacity =
            parseFloat(document.getElementById('pc-token-edit-fx-overlay-opacity')?.value) || 0.3;
        currentChar.fxOverlayColor = document.getElementById('pc-token-edit-fx-overlay-color')?.value || '#007bff';

        currentChar.fxVignetteEnabled = !!document.getElementById('pc-token-edit-fx-vignette-enabled')?.checked;
        currentChar.fxVignetteOpacity =
            parseFloat(document.getElementById('pc-token-edit-fx-vignette-opacity')?.value) || 0.6;
        currentChar.fxVignetteColor = document.getElementById('pc-token-edit-fx-vignette-color')?.value || '#000000';

        currentChar.fxShadowEnabled = !!document.getElementById('pc-token-edit-fx-shadow-enabled')?.checked;
        currentChar.fxShadowBlur = parseInt(document.getElementById('pc-token-edit-fx-shadow-blur')?.value) || 12;
        currentChar.fxShadowOffset = parseInt(document.getElementById('pc-token-edit-fx-shadow-offset')?.value) || 4;
        currentChar.fxShadowColor = document.getElementById('pc-token-edit-fx-shadow-color')?.value || '#000000';
        currentChar.fxShadowOpacity =
            parseFloat(document.getElementById('pc-token-edit-fx-shadow-opacity')?.value) || 0.7;

        saveAndEmit(currentChar);
        renderSheetData(currentChar);

        // Apply immediately to matching canvas tokens
        if (window.VTT && window.VTT.canvasEngine) {
            const tokens = window.VTT.canvasEngine.getTokens();
            let canvasUpdated = false;
            Object.values(tokens).forEach((t) => {
                if (t.characterId === currentChar.id || (t.isPlayer && t.name === currentChar.name)) {
                    const activeImageUrl = getPlayerActiveTokenUrl(currentChar);
                    t.img = activeImageUrl;
                    t.size = currentChar.tokenSize;
                    t.sightRange = currentChar.tokenSight;
                    const _cleanActiveUrl = activeImageUrl.split('?')[0].toLowerCase();
                    t.isGif = _cleanActiveUrl.endsWith('.gif');
                    t.isVideo =
                        !t.isGif &&
                        (_cleanActiveUrl.endsWith('.mp4') ||
                            _cleanActiveUrl.endsWith('.webm') ||
                            _cleanActiveUrl.endsWith('.ogg') ||
                            activeImageUrl.includes('youtube.com'));

                    t.auras = JSON.parse(JSON.stringify(currentChar.tokenAuras || []));
                    if (t.auras.length > 0) {
                        t.auraEnabled = true;
                        t.auraRange = t.auras[0].range;
                        t.auraShape = t.auras[0].shape;
                        t.auraStyle = t.auras[0].style;
                        t.auraOpacity = t.auras[0].opacity;
                        t.auraColor = t.auras[0].color;
                    } else {
                        t.auraEnabled = false;
                    }

                    t.fxOverlayEnabled = currentChar.fxOverlayEnabled;
                    t.fxOverlayOpacity = currentChar.fxOverlayOpacity;
                    t.fxOverlayColor = currentChar.fxOverlayColor;

                    t.fxVignetteEnabled = currentChar.fxVignetteEnabled;
                    t.fxVignetteOpacity = currentChar.fxVignetteOpacity;
                    t.fxVignetteColor = currentChar.fxVignetteColor;

                    t.fxShadowEnabled = currentChar.fxShadowEnabled;
                    t.fxShadowBlur = currentChar.fxShadowBlur;
                    t.fxShadowOffset = currentChar.fxShadowOffset;
                    t.fxShadowColor = currentChar.fxShadowColor;
                    t.fxShadowOpacity = currentChar.fxShadowOpacity;

                    t.name = currentChar.name;
                    t.hp = currentChar.hpCurrent;
                    t.maxHp = currentChar.hpMax;
                    t.tempHp = currentChar.tempHp || 0;
                    t.characterId = currentChar.id;

                    canvasUpdated = true;
                }
            });

            if (canvasUpdated) {
                window.VTT.canvasEngine.setTokens(tokens);
                if (window.VTT?.chatEngine?.updateCombatantTokenArt) {
                    const activeImageUrl = getPlayerActiveTokenUrl(currentChar);
                    window.VTT.chatEngine.updateCombatantTokenArt(null, activeImageUrl, currentChar.id);
                }
            }
        }

        document.getElementById('modal-pc-token-edit')?.classList.add('vtt-hidden');
        document.getElementById('modal-pc-token-edit-overlay')?.classList.add('vtt-hidden');
    });
}

export function ensurePlayerTokenEditModalExists(options = {}) {
    if (document.getElementById('modal-pc-token-edit')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="modal-pc-token-edit-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="modal-pc-token-edit" class="vtt-sheet-submodal vtt-hidden" style="width:500px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Player Token Settings</h3>
                <button id="modal-pc-token-edit-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <!-- Token Art Section -->
                <div class="form-group">
                    <h4 style="margin:0 0 12px 0; color:var(--color-text-primary);">Token Artwork</h4>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <input type="text" id="pc-token-add-url" placeholder="Image URL..." style="flex:1;">
                        <button id="btn-pc-token-add-url" class="btn btn-secondary btn-xs">Add URL</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted);">OR</span>
                        <input type="file" id="pc-token-file" accept="image/*,video/mp4,video/webm" style="font-size:0.75rem; color:var(--color-text-muted);">
                        <button id="btn-pc-token-upload" class="btn btn-secondary btn-xs">Upload</button>
                    </div>
                    <div id="pc-token-gallery" style="display:flex; flex-wrap:wrap; gap:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px; min-height:80px;">
                        <!-- Gallery items injected here -->
                    </div>
                </div>
                
                <div class="flex-row">
                    <div class="form-group w-50">
                        <label>Token Size Category</label>
                        <select id="pc-token-edit-size" style="width:100%;">
                            <option value="0.5">Small (0.5x0.5 Grid)</option>
                            <option value="1">Medium (1x1 Grid)</option>
                            <option value="2">Large (2x2)</option>
                            <option value="3">Huge (3x3)</option>
                            <option value="4">Gargantuan (4x4)</option>
                        </select>
                    </div>
                    <div class="form-group w-50">
                        <label>Sight Range (ft)</label>
                        <input type="number" id="pc-token-edit-sight" min="0" max="240" step="5" value="60" style="width:100%;" disabled title="Token Sight is managed automatically from the Build Tab Vision settings.">
                        <small style="color:var(--color-text-muted); font-size:0.7rem; margin-top:2px; display:block;">Managed by Build Tab</small>
                    </div>
                </div>

                <!-- Aura Settings Section -->
                <div class="form-group border-top-subtle pt-3 mt-3">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-circle-nodes"></i> Token Auras</span>
                        <button type="button" id="btn-pc-token-add-aura" class="btn btn-secondary btn-xxs" style="padding: 4px 8px; font-size: 0.72rem;">
                            <i class="fa-solid fa-plus"></i> Add Aura
                        </button>
                    </h4>
                    <div id="pc-token-auras-list" style="margin-top: 10px; max-height: 260px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px;">
                        <!-- Auras dynamically rendered here -->
                    </div>
                </div>

                <!-- Token Visual Effects Section -->
                <div class="form-group border-top-subtle pt-3 mt-3">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Token Visual Effects
                    </h4>
                    
                    <div class="flex-row" style="gap: 4px; margin-bottom: 12px;">
                        <button type="button" id="tab-btn-pc-fx-overlay" class="btn btn-secondary btn-xxs active" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Overlay</button>
                        <button type="button" id="tab-btn-pc-fx-vignette" class="btn btn-secondary btn-xxs" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Vignette</button>
                        <button type="button" id="tab-btn-pc-fx-shadow" class="btn btn-secondary btn-xxs" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Shadow</button>
                    </div>
                    
                    <!-- Overlay FX Panel -->
                    <div id="panel-pc-fx-overlay" class="fx-panel" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="config-setting">
                            <label>Enable Color Overlay</label>
                            <input type="checkbox" id="pc-token-edit-fx-overlay-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                        </div>
                        <div id="pc-fx-overlay-details" class="vtt-hidden">
                            <div class="config-setting">
                                <label>Overlay Opacity</label>
                                <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                    <input type="range" id="pc-token-edit-fx-overlay-opacity" min="0.05" max="0.9" step="0.05" value="0.3" style="flex: 1; cursor: pointer;">
                                    <span id="val-pc-fx-overlay-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">30%</span>
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Overlay Color</label>
                                <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                    <input type="color" id="pc-token-edit-fx-overlay-color" value="#007bff" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Vignette FX Panel -->
                    <div id="panel-pc-fx-vignette" class="fx-panel vtt-hidden" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="config-setting">
                            <label>Enable Border Vignette</label>
                            <input type="checkbox" id="pc-token-edit-fx-vignette-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                        </div>
                        <div id="pc-fx-vignette-details" class="vtt-hidden">
                            <div class="config-setting">
                                <label>Vignette Depth</label>
                                <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                    <input type="range" id="pc-token-edit-fx-vignette-opacity" min="0.1" max="1.0" step="0.05" value="0.6" style="flex: 1; cursor: pointer;">
                                    <span id="val-pc-fx-vignette-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">60%</span>
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Vignette Color</label>
                                <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                    <input type="color" id="pc-token-edit-fx-vignette-color" value="#000000" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Shadow FX Panel -->
                    <div id="panel-pc-fx-shadow" class="fx-panel vtt-hidden" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="config-setting">
                            <label>Enable Floor Shadow</label>
                            <input type="checkbox" id="pc-token-edit-fx-shadow-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                        </div>
                        <div id="pc-fx-shadow-details" class="vtt-hidden">
                            <div class="flex-row">
                                <div class="form-group w-50" style="margin-bottom: 0;">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Blur (px)</label>
                                    <input type="number" id="pc-token-edit-fx-shadow-blur" min="0" max="40" value="12" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                </div>
                                <div class="form-group w-50" style="margin-bottom: 0;">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Offset (px)</label>
                                    <input type="number" id="pc-token-edit-fx-shadow-offset" min="-20" max="20" value="4" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Color & Opacity</label>
                                <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                    <input type="color" id="pc-token-edit-fx-shadow-color" value="#000000" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                                        <input type="range" id="pc-token-edit-fx-shadow-opacity" min="0.1" max="1.0" step="0.05" value="0.7" style="flex: 1; cursor: pointer;">
                                        <span id="val-pc-fx-shadow-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">70%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-pc-token-edit-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    setupPlayerTokenEditListeners(options);
}

export function openPlayerTokenEditModal(char, options = {}) {
    ensurePlayerTokenEditModalExists(options);
    if (!char) return;

    const sizeEl = document.getElementById('pc-token-edit-size');
    const sightEl = document.getElementById('pc-token-edit-sight');
    if (sizeEl) sizeEl.value = char.tokenSize || 1;
    if (sightEl) sightEl.value = char.tokenSight !== undefined ? char.tokenSight : 0;

    tempPlayerAurasList = (char.tokenAuras || []).map((a, i) => ({
        ...a,
        enabled: a.enabled !== undefined ? a.enabled : true,
        name: a.name || '',
        isExpanded: i === 0
    }));
    renderPlayerAuraList();

    const overlayCb = document.getElementById('pc-token-edit-fx-overlay-enabled');
    const overlayOp = document.getElementById('pc-token-edit-fx-overlay-opacity');
    const overlayVal = document.getElementById('val-pc-fx-overlay-opacity');
    const overlayCol = document.getElementById('pc-token-edit-fx-overlay-color');
    const overlayDet = document.getElementById('pc-fx-overlay-details');

    if (overlayCb) overlayCb.checked = !!char.fxOverlayEnabled;
    if (overlayOp) overlayOp.value = char.fxOverlayOpacity !== undefined ? char.fxOverlayOpacity : 0.3;
    if (overlayVal)
        overlayVal.textContent = `${Math.round((char.fxOverlayOpacity !== undefined ? char.fxOverlayOpacity : 0.3) * 100)}%`;
    if (overlayCol) overlayCol.value = char.fxOverlayColor || '#007bff';
    if (overlayDet) {
        if (char.fxOverlayEnabled) overlayDet.classList.remove('vtt-hidden');
        else overlayDet.classList.add('vtt-hidden');
    }

    const vigCb = document.getElementById('pc-token-edit-fx-vignette-enabled');
    const vigOp = document.getElementById('pc-token-edit-fx-vignette-opacity');
    const vigVal = document.getElementById('val-pc-fx-vignette-opacity');
    const vigCol = document.getElementById('pc-token-edit-fx-vignette-color');
    const vigDet = document.getElementById('pc-fx-vignette-details');

    if (vigCb) vigCb.checked = !!char.fxVignetteEnabled;
    if (vigOp) vigOp.value = char.fxVignetteOpacity !== undefined ? char.fxVignetteOpacity : 0.6;
    if (vigVal)
        vigVal.textContent = `${Math.round((char.fxVignetteOpacity !== undefined ? char.fxVignetteOpacity : 0.6) * 100)}%`;
    if (vigCol) vigCol.value = char.fxVignetteColor || '#000000';
    if (vigDet) {
        if (char.fxVignetteEnabled) vigDet.classList.remove('vtt-hidden');
        else vigDet.classList.add('vtt-hidden');
    }

    const shaCb = document.getElementById('pc-token-edit-fx-shadow-enabled');
    const shaBlur = document.getElementById('pc-token-edit-fx-shadow-blur');
    const shaOffset = document.getElementById('pc-token-edit-fx-shadow-offset');
    const shaCol = document.getElementById('pc-token-edit-fx-shadow-color');
    const shaOp = document.getElementById('pc-token-edit-fx-shadow-opacity');
    const shaVal = document.getElementById('val-pc-fx-shadow-opacity');
    const shaDet = document.getElementById('pc-fx-shadow-details');

    if (shaCb) shaCb.checked = !!char.fxShadowEnabled;
    if (shaBlur) shaBlur.value = char.fxShadowBlur !== undefined ? char.fxShadowBlur : 12;
    if (shaOffset) shaOffset.value = char.fxShadowOffset !== undefined ? char.fxShadowOffset : 4;
    if (shaCol) shaCol.value = char.fxShadowColor || '#000000';
    if (shaOp) shaOp.value = char.fxShadowOpacity !== undefined ? char.fxShadowOpacity : 0.7;
    if (shaVal)
        shaVal.textContent = `${Math.round((char.fxShadowOpacity !== undefined ? char.fxShadowOpacity : 0.7) * 100)}%`;
    if (shaDet) {
        if (char.fxShadowEnabled) shaDet.classList.remove('vtt-hidden');
        else shaDet.classList.add('vtt-hidden');
    }

    renderPlayerTokenGallery(options);

    document.getElementById('modal-pc-token-edit')?.classList.remove('vtt-hidden');
    document.getElementById('modal-pc-token-edit-overlay')?.classList.remove('vtt-hidden');
}
