/**
 * ForgeD VTT - Multiple Slideout Sheet Tabs
 * Replaces the legacy two-tab limit with dynamic slideout tabs on the left edge.
 * - Player Characters: individual slideout tabs
 * - Named Custom NPCs & Companions: individual slideout tabs
 * - Generic Custom NPCs & Monsters: shared single slideout tab per creature definition
 * - Drag-to-reorder tabs with custom persistence in localStorage
 * - Hover tooltip extends with sheet/token name, pop-out button, 'x' close button,
 *   and instance switcher chips for generic creatures with multiple tokens
 * - Bidirectional canvas highlighting
 * - Turn tracker subtle pulse ring
 * - Clean native sheet rendering with zero layout modification
 */

function isVideoMedia(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg') ||
           clean.includes('pinimg.com/videos') || clean.includes('youtube.com') || clean.includes('youtu.be');
}

export class SheetDockManager {
    constructor(vtt) {
        this.vtt = vtt;
        this.tabs = new Map(); // tabKey -> TabData
        this.tabOrder = []; // array of tabKeys
        this.activeTabKey = null;
        this.containerEl = null;
        this._internalCall = false;
        this.draggedTabKey = null;
        this.orderStorageKey = `forgedvtt_tab_order_${vtt.campaignId || 'default'}`;

        this.initDOM();
        this.setupPanelSync();
        this.loadSavedOrder();
    }

    initDOM() {
        let container = document.getElementById('vtt-slideout-tabs');
        if (!container) {
            container = document.createElement('div');
            container.id = 'vtt-slideout-tabs';
            container.className = 'slideout-tabs-container';
            document.body.appendChild(container);
        }
        this.containerEl = container;

        // Hide old hardcoded minimize buttons so they don't conflict
        const oldCreatureBtn = document.getElementById('creature-sheet-minimize-btn');
        const oldPlayerBtn = document.getElementById('player-sheet-minimize-btn');
        if (oldCreatureBtn) oldCreatureBtn.style.display = 'none';
        if (oldPlayerBtn) oldPlayerBtn.style.display = 'none';
    }

    setupPanelSync() {
        this.updatePosition = () => {
            if (!this.containerEl) return;
            const creaturePanel = document.getElementById('creature-sheet-panel');
            const playerPanel = document.getElementById('player-sheet-panel');

            if (playerPanel && playerPanel.classList.contains('open')) {
                const w = playerPanel.offsetWidth || 450;
                this.containerEl.style.transform = `translateX(${w}px)`;
            } else if (creaturePanel && creaturePanel.classList.contains('open')) {
                const w = creaturePanel.offsetWidth || 320;
                this.containerEl.style.transform = `translateX(${w}px)`;
            } else {
                this.containerEl.style.transform = 'translateX(0)';
            }
        };

        const observer = new MutationObserver(this.updatePosition);
        const creaturePanel = document.getElementById('creature-sheet-panel');
        const playerPanel = document.getElementById('player-sheet-panel');
        if (creaturePanel) observer.observe(creaturePanel, { attributes: true, attributeFilter: ['class', 'style'] });
        if (playerPanel) observer.observe(playerPanel, { attributes: true, attributeFilter: ['class', 'style'] });

        window.addEventListener('resize', this.updatePosition);
    }

    loadSavedOrder() {
        try {
            const raw = localStorage.getItem(this.orderStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.tabOrder = parsed;
                }
            }
        } catch (e) {
            console.warn('[SheetDock] Failed to load tab order:', e);
        }
    }

    saveOrder() {
        try {
            localStorage.setItem(this.orderStorageKey, JSON.stringify(this.tabOrder));
        } catch (e) {
            console.warn('[SheetDock] Failed to save tab order:', e);
        }
    }

    /**
     * Main entry: open or focus a sheet tab
     */
    openSheet(params) {
        const {
            type, // 'player' | 'creature'
            id,
            name = 'Unnamed',
            avatar,
            monsterData = null,
            tokenId = null,
            characterId = null,
            isCompanion = false,
            isCustomNpc = false,
            isGeneric = false
        } = params;

        let roleCategory = 'generic';
        let tabKey = '';
        let tabName = name;
        let tabAvatar = avatar || 'img/logo.png';

        // 1. Player Character -> Individual Tab
        if (type === 'player' && !isCompanion && !isCustomNpc) {
            roleCategory = 'player';
            tabKey = `pc_${id || characterId}`;
            if (this.vtt.campaignState?.characters?.[id || characterId]) {
                const c = this.vtt.campaignState.characters[id || characterId];
                tabName = c.name || tabName;
                tabAvatar = c.avatar || c.tokenImage || tabAvatar;
            }
        }
        // 2. Named Custom NPC or Companion -> Individual Tab
        else if (isCompanion || isCustomNpc || (characterId && (characterId.startsWith('npc_') || characterId.startsWith('comp_') || this.vtt.campaignState?.characters?.[characterId]))) {
            roleCategory = 'companion';
            const charKey = characterId || id || (monsterData?.name ? monsterData.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'custom');
            tabKey = (isCustomNpc || (characterId && characterId.startsWith('npc_'))) ? `npc_${charKey.replace(/^npc_/, '')}` : `comp_${charKey.replace(/^comp_/, '')}`;
            if (characterId && this.vtt.campaignState?.characters?.[characterId]) {
                const c = this.vtt.campaignState.characters[characterId];
                tabName = c.name || tabName;
                tabAvatar = c.avatar || c.tokenImage || tabAvatar;
            } else if (id && this.vtt.campaignState?.characters?.[id]) {
                const c = this.vtt.campaignState.characters[id];
                tabName = c.name || tabName;
                tabAvatar = c.avatar || c.tokenImage || tabAvatar;
            } else if (monsterData) {
                tabName = monsterData.name || tabName;
                tabAvatar = monsterData.tokenUrl || monsterData.img || tabAvatar;
            }
        }
        // 3. Generic Bestiary Monster -> ONE shared tab per creature definition
        else {
            roleCategory = 'generic';
            const defId = monsterData?.id || (monsterData?.source && monsterData?.name ? `${monsterData.source}_${monsterData.name}` : tabName);
            tabKey = `gen_${defId.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
            tabName = monsterData?.name || tabName;
            tabAvatar = monsterData?.tokenUrl || monsterData?.img || tabAvatar;
        }

        let tab = this.tabs.get(tabKey);
        if (!tab) {
            tab = {
                key: tabKey,
                type: type || (roleCategory === 'player' ? 'player' : 'creature'),
                roleCategory,
                id: id || characterId,
                characterId: characterId || (roleCategory === 'player' ? id : null),
                name: tabName,
                avatar: tabAvatar,
                monsterData,
                isGeneric: roleCategory === 'generic',
                activeTokenId: tokenId,
                linkedTokenIds: tokenId ? [tokenId] : [],
                isTurnActive: false,
                isVideo: Boolean(params.isVideo || isVideoMedia(tabAvatar))
            };
            this.tabs.set(tabKey, tab);
            if (!this.tabOrder.includes(tabKey)) {
                this.tabOrder.push(tabKey);
                this.saveOrder();
            }
        } else {
            if (tokenId) tab.activeTokenId = tokenId;
            if (monsterData) tab.monsterData = monsterData;
            if (tabAvatar && tabAvatar !== 'img/logo.png') {
                tab.avatar = tabAvatar;
                tab.isVideo = Boolean(params.isVideo || isVideoMedia(tabAvatar));
            }
            if (tabName) tab.name = tabName;
        }

        this.updateLinkedTokens(tab);
        this.renderTabs();
        this.activateTab(tabKey);
        return tab;
    }

    updateLinkedTokens(tab) {
        if (!this.vtt.canvasEngine || typeof this.vtt.canvasEngine.getTokens !== 'function') {
            tab.linkedTokenIds = tab.activeTokenId ? [tab.activeTokenId] : [];
            return;
        }

        const allTokens = this.vtt.canvasEngine.getTokens() || {};
        const matches = [];

        for (const [tId, tok] of Object.entries(allTokens)) {
            if (!tok) continue;
            if (tab.roleCategory === 'player') {
                if (tok.characterId === tab.characterId || tok.characterId === tab.id) matches.push(tId);
            } else if (tab.roleCategory === 'companion') {
                const charId = tok.characterId || tok.sourceCharacterId;
                if ((charId && (charId === tab.characterId || charId === tab.id)) || tok.id === tab.id) {
                    matches.push(tId);
                }
            } else {
                const tokMonster = tok.monsterData;
                const matchName = tokMonster?.name === tab.name || tok.name === tab.name;
                const matchSource = (!tokMonster?.source || !tab.monsterData?.source || tokMonster.source === tab.monsterData.source);
                if (matchName && matchSource) matches.push(tId);
            }
        }

        tab.linkedTokenIds = matches;
        if (!tab.activeTokenId || !allTokens[tab.activeTokenId]) {
            tab.activeTokenId = matches[0] || null;
        }

        // Sync avatar and video status from active token if available
        if (tab.activeTokenId && allTokens[tab.activeTokenId]) {
            const activeTok = allTokens[tab.activeTokenId];
            if (activeTok.img && (!tab.avatar || tab.avatar === 'img/logo.png')) {
                tab.avatar = activeTok.img;
            }
            if (activeTok.isVideo !== undefined) {
                tab.isVideo = !!activeTok.isVideo;
            } else if (isVideoMedia(activeTok.img || tab.avatar)) {
                tab.isVideo = true;
            }
        }
    }

    activateTab(tabKey) {
        const tab = this.tabs.get(tabKey);
        if (!tab) return;

        this.activeTabKey = tabKey;
        this._internalCall = true;

        try {
            if (tab.type === 'player' && this.vtt.playerSheet) {
                if (this.vtt.creatureSheet?.minimizePanel) this.vtt.creatureSheet.minimizePanel();
                this.vtt.playerSheet.openSheet(tab.characterId || tab.id);
            } else if (this.vtt.creatureSheet) {
                if (this.vtt.playerSheet?.minimizePanel) this.vtt.playerSheet.minimizePanel();
                this.vtt.creatureSheet.openSheet(tab.monsterData, tab.activeTokenId, tab.characterId);
            }
        } finally {
            this._internalCall = false;
        }

        this.renderTabs();
        setTimeout(() => { if (this.updatePosition) this.updatePosition(); }, 20);
    }

    switchTokenInstance(tabKey, tokenId) {
        const tab = this.tabs.get(tabKey);
        if (!tab) return;

        tab.activeTokenId = tokenId;
        this.highlightTokenOnCanvas(tokenId, true);

        if (this.vtt.creatureSheet) {
            this.vtt.creatureSheet.openSheet(tab.monsterData, tokenId, tab.characterId);
        }

        this.renderTabs();
    }

    closeTab(tabKey) {
        const tab = this.tabs.get(tabKey);
        if (!tab) return;

        this.tabs.delete(tabKey);
        this.tabOrder = this.tabOrder.filter(k => k !== tabKey);
        this.saveOrder();

        if (this.activeTabKey === tabKey) {
            this.activeTabKey = null;
            const remainingKeys = this.tabOrder.filter(k => this.tabs.has(k));
            if (remainingKeys.length > 0) {
                this.activateTab(remainingKeys[remainingKeys.length - 1]);
            } else {
                if (this.vtt.playerSheet?.minimizePanel) this.vtt.playerSheet.minimizePanel();
                if (this.vtt.creatureSheet?.minimizePanel) this.vtt.creatureSheet.minimizePanel();
            }
        }

        this.renderTabs();
        setTimeout(() => { if (this.updatePosition) this.updatePosition(); }, 20);
    }

    toggleTab(tabKey) {
        const tab = this.tabs.get(tabKey);
        if (!tab) return;

        const isPlayer = tab.type === 'player';
        const panel = isPlayer ? document.getElementById('player-sheet-panel') : document.getElementById('creature-sheet-panel');
        const isOpen = panel && panel.classList.contains('open');

        if (this.activeTabKey === tabKey && isOpen) {
            // Already active and open -> minimize
            if (isPlayer && this.vtt.playerSheet?.minimizePanel) this.vtt.playerSheet.minimizePanel();
            else if (this.vtt.creatureSheet?.minimizePanel) this.vtt.creatureSheet.minimizePanel();
            this.renderTabs();
            setTimeout(() => { if (this.updatePosition) this.updatePosition(); }, 20);
        } else {
            // Open / switch
            this.activateTab(tabKey);
        }
    }

    popOutTab(tabKey) {
        const tab = this.tabs.get(tabKey);
        if (!tab) return;

        const mgr = window.SheetWindowManager || this.vtt?.sheetWindowManager;
        if (mgr) {
            const options = {
                type: tab.type,
                id: tab.characterId || tab.id,
                characterId: tab.characterId,
                monsterData: tab.monsterData,
                tokenId: tab.activeTokenId,
                name: tab.name
            };

            if (typeof mgr.openPopout === 'function') {
                mgr.openPopout(options);
            } else if (typeof mgr.popOutSheet === 'function') {
                mgr.popOutSheet(options);
            }
            this.closeTab(tabKey);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bidirectional Canvas Highlighting
    // ─────────────────────────────────────────────────────────────────────────

    highlightTokenOnCanvas(tokenId, isHighlighted) {
        if (!tokenId || !this.vtt.canvasEngine) return;
        if (typeof this.vtt.canvasEngine.highlightTokenExternal === 'function') {
            this.vtt.canvasEngine.highlightTokenExternal(tokenId, isHighlighted);
        }
    }

    highlightTabForToken(tokenId) {
        if (!this.containerEl) return;
        this.containerEl.querySelectorAll('.slideout-tab-handle').forEach(el => el.classList.remove('canvas-hover-pulse'));

        if (!tokenId) return;

        for (const [key, tab] of this.tabs.entries()) {
            if (tab.activeTokenId === tokenId || tab.linkedTokenIds?.includes(tokenId)) {
                const tabEl = this.containerEl.querySelector(`.slideout-tab-wrapper[data-tab-key="${key}"] .slideout-tab-handle`);
                if (tabEl) tabEl.classList.add('canvas-hover-pulse');
                break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initiative / Turn Tracker Sync
    // ─────────────────────────────────────────────────────────────────────────

    setActiveTurnToken(tokenId, combatantName) {
        for (const tab of this.tabs.values()) {
            tab.isTurnActive = false;
        }

        if (tokenId || combatantName) {
            for (const tab of this.tabs.values()) {
                const matchToken = tokenId && (tab.activeTokenId === tokenId || tab.linkedTokenIds?.includes(tokenId));
                const matchName = combatantName && tab.name.toLowerCase() === combatantName.toLowerCase();
                if (matchToken || matchName) {
                    tab.isTurnActive = true;
                    break;
                }
            }
        }

        this.renderTabs();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tab Rendering & Event Listeners
    // ─────────────────────────────────────────────────────────────────────────

    renderTabs() {
        if (!this.containerEl) return;

        if (this.tabs.size === 0) {
            this.containerEl.innerHTML = '';
            return;
        }

        // Ensure all active tabs are included in tabOrder
        for (const key of this.tabs.keys()) {
            if (!this.tabOrder.includes(key)) this.tabOrder.push(key);
        }
        // Filter tabOrder to only active keys
        const orderedKeys = this.tabOrder.filter(k => this.tabs.has(k));

        const creaturePanel = document.getElementById('creature-sheet-panel');
        const playerPanel = document.getElementById('player-sheet-panel');
        const isPanelOpen = (creaturePanel && creaturePanel.classList.contains('open')) ||
                            (playerPanel && playerPanel.classList.contains('open'));

        const allTokens = this.vtt.canvasEngine?.getTokens ? this.vtt.canvasEngine.getTokens() : {};

        let html = '';

        for (const key of orderedKeys) {
            const tab = this.tabs.get(key);
            if (!tab) continue;

            this.updateLinkedTokens(tab);

            const isActive = (key === this.activeTabKey && isPanelOpen);
            const roleClass = `role-${tab.roleCategory}`;
            const activeClass = isActive ? 'active' : '';
            const turnClass = tab.isTurnActive ? 'turn-ring' : '';

            // Multi-token instance switcher chips inside tooltip for generic creature tabs
            let instanceChipsHtml = '';
            if (tab.isGeneric && tab.linkedTokenIds.length > 1) {
                instanceChipsHtml = '<div class="tooltip-instance-row">';
                tab.linkedTokenIds.forEach((tId, idx) => {
                    const tok = allTokens[tId];
                    const tokHp = tok ? (tok.hpCurrent ?? tok.hp ?? tab.monsterData?.hp ?? '') : '';
                    const isChipActive = tId === tab.activeTokenId;
                    instanceChipsHtml += `
                        <button class="tab-instance-chip ${isChipActive ? 'active' : ''}" 
                                data-tab-key="${tab.key}" 
                                data-token-id="${tId}" 
                                title="Switch to Instance #${idx + 1}">
                            #${idx + 1}${tokHp ? ` [${tokHp} HP]` : ''}
                        </button>
                    `;
                });
                instanceChipsHtml += '</div>';
            }

            const isVideo = Boolean(tab.isVideo || isVideoMedia(tab.avatar));
            const mediaHtml = isVideo
                ? `<video src="${tab.avatar}" autoplay muted loop playsinline class="tab-handle-avatar" onerror="this.style.display='none'"></video>`
                : `<img src="${tab.avatar || 'img/logo.png'}" alt="${tab.name}" class="tab-handle-avatar" onerror="this.src='img/logo.png'">`;

            html += `
                <div class="slideout-tab-wrapper" data-tab-key="${tab.key}" draggable="true">
                    <button class="slideout-tab-handle ${roleClass} ${activeClass} ${turnClass}" 
                            data-tab-key="${tab.key}" 
                            title="${tab.name}">
                        ${mediaHtml}
                        <i class="fa-solid ${isActive ? 'fa-chevron-left' : 'fa-chevron-right'} tab-handle-chevron"></i>
                    </button>
                    <!-- Hover Tooltip extending to the right with Name, Popout, Close, and Instance Chips -->
                    <div class="slideout-tab-tooltip glassmorphism">
                        <div class="tooltip-main-row">
                            <span class="tab-tooltip-name" title="${tab.name}">${tab.name}</span>
                            <button class="tab-tooltip-popout" data-tab-key="${tab.key}" title="Pop out into separate browser tab">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </button>
                            <button class="tab-tooltip-close" data-tab-key="${tab.key}" title="Close sheet">&times;</button>
                        </div>
                        ${instanceChipsHtml}
                    </div>
                </div>
            `;
        }

        this.containerEl.innerHTML = html;
        this.attachListeners();
    }

    attachListeners() {
        if (!this.containerEl) return;

        // 1. Click on tab handle -> toggle / open sheet
        this.containerEl.querySelectorAll('.slideout-tab-handle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.tabKey;
                this.toggleTab(key);
            });

            // Bidirectional Canvas Highlighting on hover
            btn.addEventListener('mouseenter', () => {
                const key = btn.dataset.tabKey;
                const tab = this.tabs.get(key);
                if (tab && tab.activeTokenId) {
                    this.highlightTokenOnCanvas(tab.activeTokenId, true);
                }
            });
            btn.addEventListener('mouseleave', () => {
                const key = btn.dataset.tabKey;
                const tab = this.tabs.get(key);
                if (tab && tab.activeTokenId) {
                    this.highlightTokenOnCanvas(tab.activeTokenId, false);
                }
            });
        });

        // 2. Click on "x" close button in hover tooltip
        this.containerEl.querySelectorAll('.tab-tooltip-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.tabKey;
                this.closeTab(key);
            });
        });

        // 3. Click on Popout button in hover tooltip
        this.containerEl.querySelectorAll('.tab-tooltip-popout').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.tabKey;
                this.popOutTab(key);
            });
        });

        // 4. Instance Switcher Chips inside tooltip
        this.containerEl.querySelectorAll('.tab-instance-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabKey = btn.dataset.tabKey;
                const tokId = btn.dataset.tokenId;
                this.switchTokenInstance(tabKey, tokId);
            });
            btn.addEventListener('mouseenter', () => {
                this.highlightTokenOnCanvas(btn.dataset.tokenId, true);
            });
            btn.addEventListener('mouseleave', () => {
                this.highlightTokenOnCanvas(btn.dataset.tokenId, false);
            });
        });

        // 5. HTML5 Drag-and-Drop Reordering
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const wrappers = this.containerEl.querySelectorAll('.slideout-tab-wrapper');

        wrappers.forEach(wrap => {
            wrap.addEventListener('dragstart', (e) => {
                this.draggedTabKey = wrap.dataset.tabKey;
                wrap.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this.draggedTabKey);
            });

            wrap.addEventListener('dragend', () => {
                wrap.classList.remove('is-dragging');
                this.containerEl.querySelectorAll('.slideout-tab-wrapper').forEach(w => {
                    w.classList.remove('drop-above', 'drop-below');
                });
                this.draggedTabKey = null;
            });

            wrap.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!this.draggedTabKey || this.draggedTabKey === wrap.dataset.tabKey) return;

                const rect = wrap.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    wrap.classList.add('drop-above');
                    wrap.classList.remove('drop-below');
                } else {
                    wrap.classList.add('drop-below');
                    wrap.classList.remove('drop-above');
                }
            });

            wrap.addEventListener('dragleave', () => {
                wrap.classList.remove('drop-above', 'drop-below');
            });

            wrap.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetKey = wrap.dataset.tabKey;
                const sourceKey = this.draggedTabKey;
                wrap.classList.remove('drop-above', 'drop-below');

                if (!sourceKey || !targetKey || sourceKey === targetKey) return;

                const rect = wrap.getBoundingClientRect();
                const insertBefore = e.clientY < (rect.top + rect.height / 2);

                const currentOrder = this.tabOrder.filter(k => this.tabs.has(k) && k !== sourceKey);
                const targetIdx = currentOrder.indexOf(targetKey);

                if (targetIdx !== -1) {
                    const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
                    currentOrder.splice(insertIdx, 0, sourceKey);
                    this.tabOrder = currentOrder;
                    this.saveOrder();
                    this.renderTabs();
                }
            });
        });
    }
}

export function initVttSheetDock(vtt) {
    const dock = new SheetDockManager(vtt);
    vtt.sheetDock = dock;
    return dock;
}
