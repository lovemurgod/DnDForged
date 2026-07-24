import { RenderSpells } from './render-spells.js?v=2';
// DnDForged Creature Sheet — Left Side Panel Module
export function initVttCreatureSheet(vtt) {
    const panel = document.getElementById('creature-sheet-panel');
    const minimizeBtn = document.getElementById('creature-sheet-minimize-btn');
    const contentEl = document.getElementById('vtt-creature-sheet-panel');

    if (!panel || !minimizeBtn || !contentEl) {
        console.warn('[CreatureSheet] Panel elements not found in DOM.');
        return {};
    }

    let currentMonster = null;
    let linkedTokenId = null;
    let linkedCharacterId = null;
    let isMinimized = false;
    let spellCache = null;

    function showVttPrompt(title, defaultValue, callback) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const box = document.createElement('div');
        box.style.backgroundColor = '#1e1e1e';
        box.style.border = '1px solid var(--color-border-subtle, #444)';
        box.style.borderRadius = '8px';
        box.style.padding = '20px';
        box.style.width = '300px';
        box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap = '15px';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.margin = '0';
        titleEl.style.color = 'var(--color-gold-base, #ffd700)';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue || '';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.backgroundColor = 'rgba(0,0,0,0.3)';
        input.style.border = '1px solid var(--color-border-subtle, #444)';
        input.style.color = '#fff';
        input.style.borderRadius = '4px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        
        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'btn btn-primary btn-sm';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);

        box.appendChild(titleEl);
        box.appendChild(input);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        input.focus();
        input.select();

        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        const submit = () => {
            cleanup();
            callback(input.value);
        };

        okBtn.addEventListener('click', submit);
        cancelBtn.addEventListener('click', () => {
            cleanup();
            callback(null);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') { cleanup(); callback(null); }
        });
    }

    // ─── Panel open / minimize / expand ──────────────────────────────────────
    function openPanel() {
        console.log('[vtt-creature-sheet] openPanel called');
        if (window.VTT && window.VTT.playerSheet && typeof window.VTT.playerSheet.minimizePanel === 'function') {
            window.VTT.playerSheet.minimizePanel();
            const playerPanel = document.getElementById('player-sheet-panel');
            if (playerPanel) playerPanel.style.zIndex = "50";
        }
        panel.style.zIndex = "55";
        panel.classList.add('open');
        panel.classList.remove('minimized');
        isMinimized = false;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        minimizeBtn.title = 'Minimize Creature Sheet';
        console.log('[vtt-creature-sheet] openPanel completed');
    }

    function minimizePanel() {
        panel.classList.remove('open');
        panel.classList.add('minimized');
        isMinimized = true;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        minimizeBtn.title = 'Expand Creature Sheet';
    }

    minimizeBtn.addEventListener('click', () => {
        if (isMinimized) {
            openPanel();
        } else {
            minimizePanel();
        }
    });

    // ─── Main entry: open a creature sheet ───────────────────────────────────
    async function openSheet(monsterData, tokenId, characterId) {
        console.log('[vtt-creature-sheet] openSheet called', { monsterData, tokenId, characterId });
        if (!monsterData) return;
        currentMonster = monsterData;
        linkedTokenId = tokenId || null;
        linkedCharacterId = characterId || null;

        // Backfill lair actions from legendaryGroup if not yet populated
        if (currentMonster.legendaryGroup && (!currentMonster.lairActions || currentMonster.lairActions.length === 0)) {
            try {
                const res = await fetch('data/bestiary/legendarygroups.json');
                const data = await res.json();
                const groupRef = typeof currentMonster.legendaryGroup === 'string' 
                    ? { name: currentMonster.legendaryGroup, source: currentMonster.source } 
                    : currentMonster.legendaryGroup;
                
                const lg = data.legendaryGroup.find(g => 
                    g.name === groupRef.name && 
                    (g.source === groupRef.source || !groupRef.source)
                );
                
                if (lg && lg.lairActions) {
                    let desc = '';
                    const actions = [];
                    lg.lairActions.forEach(la => {
                        if (typeof la === 'string') {
                            desc += (desc ? '\\n' : '') + la;
                        } else if (la.type === 'list' && la.items) {
                            la.items.forEach(item => {
                                // Sometimes items have a bold name at the start like "{@b Name.} description"
                                let actionName = '';
                                let actionDesc = item;
                                if (typeof item === 'string') {
                                    const match = item.match(/^{@b ([^}]+)}\\.?\\s*(.*)/);
                                    if (match) {
                                        actionName = match[1];
                                        actionDesc = match[2];
                                    }
                                }
                                actions.push({ name: actionName, entries: [actionDesc] });
                            });
                        }
                    });
                    currentMonster.lairActionsDesc = desc;
                    currentMonster.lairActions = actions;
                    
                    if (linkedCharacterId && window.VTT?.campaignState?.characters) {
                        const char = window.VTT.campaignState.characters[linkedCharacterId];
                        char.monsterData = currentMonster;
                        window.VTT.socket.emit('character:update', { character: char });
                    }
                }
            } catch (err) {
                console.error("[vtt-creature-sheet] Failed to load legendary group", err);
            }
        }

        try {
            renderStatBlock(currentMonster);
            console.log('[vtt-creature-sheet] renderStatBlock successful');
        } catch (err) {
            console.error('[vtt-creature-sheet] renderStatBlock ERROR', err);
        }
        openPanel();
    }

    // ─── Stat block renderer ─────────────────────────────────────────────────
    function renderStatBlock(m) {
        const crStr = m.cr ? (typeof m.cr === 'object' ? m.cr.cr : m.cr) : '0';
        const typeStr = buildTypeString(m);
        const hpCurrent = linkedTokenId ? (getLinkedTokenHp() ?? (m.hp?.average || 0)) : (m.hp?.average || 0);
        const hpMax = m.hp?.average || 0;
        const hpFormula = m.hp?.formula || '';
        const ac = Array.isArray(m.ac) ? m.ac[0] : m.ac;
        const acValue = typeof ac === 'object' ? ac.ac : (ac || '—');
        const acFrom = (typeof ac === 'object' && ac.from) ? ` (${ac.from.join(', ')})` : '';
        const speed = buildSpeedString(m.speed);

        const abilityScores = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

        const abilityGrid = abilityScores.map((ab, i) => {
            const score = m[ab] || 10;
            const mod = Math.floor((score - 10) / 2);
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            return `
                <div class="cs-ability-cell" data-ability="${ab}" data-score="${score}" data-mod="${mod}">
                    <span class="cs-ability-label">${abilityLabels[i]}</span>
                    <span class="cs-ability-score">${score}</span>
                    <span class="cs-ability-mod">${modStr}</span>
                    <div class="cs-ability-actions">
                        <span class="cs-ability-action-btn cs-roll-check" title="Roll Check">Check</span>
                        <span class="cs-ability-action-btn cs-roll-save" title="Roll Save">Save</span>
                    </div>
                </div>
            `;
        }).join('');

        const saves = buildSavesHtml(m);
        const skills = buildSkillsHtml(m);
        const immunities = buildImmunityHtml(m);
        const traits = buildAbilitySection('Traits', m.trait);
        const actions = buildAbilitySection('Actions', m.action);
        const bonus = buildAbilitySection('Bonus Actions', m.bonus);
        const reactions = buildAbilitySection('Reactions', m.reaction);
        const legendary = buildLegendarySection(m);

        const profBonus = getProfBonus(crStr);

        const hasSpells = m.spellcasting && m.spellcasting.length > 0;
        let tabsHtml = '';
        let spellsHtml = '';

        if (hasSpells) {
            tabsHtml = `
                <div class="cs-tabs">
                    <div class="cs-tab-btn active" data-tab="stats">Stats</div>
                    <div class="cs-tab-btn" data-tab="spells">Spells</div>
                </div>
            `;
            spellsHtml = buildSpellcastingHtml(m);
        }

        let editBtnHtml = '';
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char && (window.VTT.role === 'GM' || (char.assignedPlayers && (char.assignedPlayers.includes(window.VTT.username) || char.assignedPlayers.includes('*'))))) {
                editBtnHtml = `<button class="btn btn-sm btn-secondary cs-edit-btn" style="position:absolute; top:12px; right:12px; z-index: 10;" title="Edit Companion"><i class="fa-solid fa-pen"></i> Edit</button>`;
            }
        }

        const tokenUrl = getMonsterImageUrl(m);
        const cleanUrl = (tokenUrl || '').split('?')[0].toLowerCase();
        const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
        const isYoutube = tokenUrl && (tokenUrl.includes('youtube.com/embed') || tokenUrl.includes('youtube.com/watch') || tokenUrl.includes('youtu.be/'));

        let portraitMediaHtml = '';
        if (isVideo) {
            portraitMediaHtml = `<video src="${tokenUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;"></video>`;
        } else if (isYoutube) {
            let ytUrl = tokenUrl;
            const ytMatch = tokenUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (ytMatch) {
                const videoId = ytMatch[1];
                ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
            }
            portraitMediaHtml = `<iframe src="${ytUrl}" frameborder="0" allow="autoplay; encrypted-media" style="width:100%; height:100%; pointer-events:none; border:none;"></iframe>`;
        } else {
            portraitMediaHtml = `<img src="${tokenUrl}" alt="${m.name}" onerror="this.src='favicon.svg'" style="width:100%; height:100%; object-fit:cover; display:block;">`;
        }

        contentEl.innerHTML = `
            <!-- Header -->
            <div class="cs-header" style="position:relative;">
                ${editBtnHtml}
                <div class="cs-token-portrait">
                    ${portraitMediaHtml}
                </div>
                <div class="cs-header-info">
                    <h2 class="cs-creature-name">${m.name}</h2>
                    <p class="cs-creature-type">${typeStr}</p>
                    <div class="cs-cr-badge">CR ${crStr}</div>
                </div>
            </div>



            ${tabsHtml}

            <div id="cs-tab-stats" class="cs-tab-content active">
                <!-- HP Row -->
                <div class="cs-hp-row">
                    <div class="cs-hp-label"><i class="fa-solid fa-heart"></i> HP</div>
                    <div class="cs-hp-controls">
                        <button class="cs-hp-btn" id="cs-hp-minus" title="Damage">−</button>
                        <div class="cs-hp-display">
                            <span id="cs-hp-current">${hpCurrent}</span>
                            <span class="cs-hp-divider">/</span>
                            <span id="cs-hp-max">${hpMax}</span>
                            ${hpFormula ? `<span class="cs-hp-formula">${injectDiceChips(hpFormula)}</span>` : ''}
                        </div>
                        <button class="cs-hp-btn" id="cs-hp-plus" title="Heal">+</button>
                    </div>
                    <div class="cs-hp-bar-wrap">
                        <div class="cs-hp-bar-fill" id="cs-hp-bar" style="width: ${hpMax > 0 ? Math.round(hpCurrent / hpMax * 100) : 100}%"></div>
                    </div>
                </div>

                <!-- Core Stats Pills -->
                <div class="cs-core-stats">
                    <div class="cs-stat-pill"><i class="fa-solid fa-shield-halved"></i><span>AC ${acValue}${acFrom}</span></div>
                    <div class="cs-stat-pill"><i class="fa-solid fa-shoe-prints"></i><span>${speed}</span></div>
                    <div class="cs-stat-pill"><i class="fa-solid fa-star"></i><span>Prof +${profBonus}</span></div>
                    ${m.passive !== undefined ? `<div class="cs-stat-pill"><i class="fa-solid fa-eye"></i><span>Passive ${m.passive}</span></div>` : ''}
                </div>

                <!-- Divider -->
                <div class="cs-section-divider"></div>

                <!-- Ability Scores Grid -->
                <div class="cs-ability-grid">${abilityGrid}</div>

                <!-- Divider -->
                <div class="cs-section-divider"></div>

                <!-- Saves & Skills -->
                ${saves ? `<div class="cs-info-row"><span class="cs-info-label">Saving Throws</span><span class="cs-info-value">${saves}</span></div>` : ''}
                ${skills ? `<div class="cs-info-row"><span class="cs-info-label">Skills</span><span class="cs-info-value">${skills}</span></div>` : ''}
                ${immunities}

                <!-- Divider -->
                <div class="cs-section-divider"></div>

                <!-- Traits / Actions / Reactions / Legendary -->
                ${traits}
                ${actions}
                ${bonus}
                ${reactions}
                ${legendary}
            </div>

            ${hasSpells ? `<div id="cs-tab-spells" class="cs-tab-content">${spellsHtml}</div>` : ''}
            

        `;

        // Wire HP stepper buttons
        wireHpControls(hpCurrent, hpMax);

        // Wire ability score chips (for rolling ability checks)
        wireAbilityScoreClicks();

        // Wire Tabs
        if (hasSpells) {
            wireTabs();
            wireSpellSlots();
            setupCsSpellListeners();
        }

        // Wire Edit Button
        const editBtn = contentEl.querySelector('.cs-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openEditModal(m, linkedCharacterId);
            });
        }


    }

    function wireTabs() {
        const btns = contentEl.querySelectorAll('.cs-tab-btn');
        const contents = contentEl.querySelectorAll('.cs-tab-content');
        
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                btns.forEach(b => b.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                contentEl.querySelector(`#cs-tab-${target}`).classList.add('active');
            });
        });
    }

    function wireSpellSlots() {
        // Fetch current spell slot state from token if available
        let savedSlots = {};
        if (linkedTokenId && window.VTT?.canvasEngine) {
            const token = window.VTT.canvasEngine.getTokens()[linkedTokenId];
            if (token && token.spellSlots) {
                savedSlots = token.spellSlots;
            }
        }

        const slotInputs = contentEl.querySelectorAll('.cs-spell-slot-input');
        slotInputs.forEach(input => {
            const level = input.dataset.level;
            const max = parseInt(input.dataset.max) || 0;
            
            // Initialize from token state if available, else max
            if (savedSlots[level] !== undefined) {
                input.value = savedSlots[level];
            } else {
                input.value = max;
            }

            input.addEventListener('change', (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                val = Math.max(0, Math.min(val, max));
                e.target.value = val;

                // Sync to token
                if (linkedTokenId && window.VTT && window.VTT.socket) {
                    const canvasEngine = window.VTT.canvasEngine;
                    if (canvasEngine) {
                        const allTokens = canvasEngine.getTokens();
                        if (allTokens[linkedTokenId]) {
                            allTokens[linkedTokenId].spellSlots = allTokens[linkedTokenId].spellSlots || {};
                            allTokens[linkedTokenId].spellSlots[level] = val;
                            window.VTT.socket.emit('token:update', { tokens: allTokens });
                        }
                    }
                }
            });
        });

        // Listen for external token slot updates
        if (vtt.socket) {
            vtt.socket.on('token:updated', (data) => {
                if (linkedTokenId && data.tokens && data.tokens[linkedTokenId]) {
                    const updatedSlots = data.tokens[linkedTokenId].spellSlots;
                    if (updatedSlots) {
                        slotInputs.forEach(input => {
                            const level = input.dataset.level;
                            if (updatedSlots[level] !== undefined && input.value !== updatedSlots[level].toString()) {
                                input.value = updatedSlots[level];
                            }
                        });
                    }
                }
            });
        }
    }

    function wireHpControls(initial, max) {
        let current = parseInt(initial) || 0;
        const maxHp = parseInt(max) || 0;
        const currentEl = document.getElementById('cs-hp-current');
        const barEl = document.getElementById('cs-hp-bar');

        function updateDOMOnly() {
            if (currentEl) currentEl.textContent = current;
            if (barEl && maxHp > 0) {
                const pct = Math.max(0, Math.min(100, Math.round(current / maxHp * 100)));
                barEl.style.width = `${pct}%`;
                barEl.className = 'cs-hp-bar-fill' + (pct <= 25 ? ' danger' : pct <= 50 ? ' injured' : '');
            }
        }

        function updateDisplay() {
            updateDOMOnly();
            
            // Sync to linked canvas token
            if (linkedTokenId && window.VTT && window.VTT.socket) {
                const canvasEngine = window.VTT.canvasEngine;
                if (canvasEngine) {
                    const allTokens = canvasEngine.getTokens();
                    const currentMapId = canvasEngine.getCurrentMapId();
                    if (allTokens[linkedTokenId]) {
                        allTokens[linkedTokenId].hp = current;
                        window.VTT.socket.emit('token:update', { mapId: currentMapId, tokens: allTokens });
                        canvasEngine.renderAll();
                    }
                }
            }
            // Sync to linked character (Companion)
            if (linkedCharacterId && window.VTT && window.VTT.campaignState && window.VTT.campaignState.characters) {
                const comp = window.VTT.campaignState.characters[linkedCharacterId];
                if (comp) {
                    comp.hpCurrent = current;
                    if (window.VTT.socket) {
                        window.VTT.socket.emit('character:update', { character: comp });
                    }
                }
            }
        }

        const minusBtn = document.getElementById('cs-hp-minus');
        const plusBtn = document.getElementById('cs-hp-plus');

        if (minusBtn) {
            minusBtn.addEventListener('click', () => {
                showVttPrompt('Damage amount:', '1', (val) => {
                    if (val === null) return;
                    const dmg = parseInt(val || '1');
                    if (!isNaN(dmg)) { current = Math.max(0, current - dmg); updateDisplay(); }
                });
            });
        }
        if (plusBtn) {
            plusBtn.addEventListener('click', () => {
                showVttPrompt('Heal amount:', '1', (val) => {
                    if (val === null) return;
                    const heal = parseInt(val || '1');
                    if (!isNaN(heal)) { current = Math.min(maxHp, current + heal); updateDisplay(); }
                });
            });
        }

        // Listen for external token HP updates
        if (vtt.socket) {
            vtt.socket.on('token:updated', (data) => {
                if (linkedTokenId && data.tokens && data.tokens[linkedTokenId]) {
                    const incomingHp = data.tokens[linkedTokenId].hp;
                    if (current !== incomingHp) {
                        current = incomingHp;
                        updateDOMOnly();
                    }
                }
            });
        }
    }

    function wireAbilityScoreClicks() {
        contentEl.querySelectorAll('.cs-ability-cell').forEach(cell => {
            const checkBtn = cell.querySelector('.cs-roll-check');
            const saveBtn = cell.querySelector('.cs-roll-save');
            const ab = (cell.dataset.ability || '').toUpperCase();

            if (checkBtn) {
                checkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mod = parseInt(cell.dataset.mod) || 0;
                    const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    const label = `${currentMonster?.name || 'Creature'}: ${ab} Check`;
                    rollAndPostToChat(formula, label);
                });
            }

            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let mod = parseInt(cell.dataset.mod) || 0;
                    if (currentMonster && currentMonster.save && currentMonster.save[cell.dataset.ability]) {
                        mod = parseInt(currentMonster.save[cell.dataset.ability]) || 0;
                    }
                    const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    const label = `${currentMonster?.name || 'Creature'}: ${ab} Saving Throw`;
                    rollAndPostToChat(formula, label);
                });
            }

            // Fallback: clicking the cell itself rolls ability check
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.cs-ability-actions')) return;
                const mod = parseInt(cell.dataset.mod) || 0;
                const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                const label = `${currentMonster?.name || 'Creature'}: ${ab} Check`;
                rollAndPostToChat(formula, label);
            });
        });
    }

    // ─── Ability sections builder ─────────────────────────────────────────────
    function buildAbilitySection(title, list) {
        if (!list || list.length === 0) return '';
        const rows = list.map(entry => buildAbilityEntryHtml(entry)).join('');
        return `
            <div class="cs-section">
                <h3 class="cs-section-title"><i class="fa-solid fa-bolt"></i> ${title}</h3>
                ${rows}
            </div>
        `;
    }

    function buildLegendarySection(m) {
        let html = '';
        if (m.legendary && m.legendary.length > 0) {
            const lairDesc = m.legendaryActions !== undefined ? `<p class="cs-legendary-desc">${m.legendaryActions}</p>` : '';
            const rows = m.legendary.map(entry => buildAbilityEntryHtml(entry)).join('');
            html += `
                <div class="cs-section cs-legendary-section">
                    <h3 class="cs-section-title"><i class="fa-solid fa-crown"></i> Legendary Actions</h3>
                    ${lairDesc}
                    ${rows}
                </div>
            `;
        }
        
        if (m.lairActions && m.lairActions.length > 0) {
            const lairDesc = m.lairActionsDesc !== undefined ? `<p class="cs-legendary-desc">${m.lairActionsDesc}</p>` : '';
            const rows = m.lairActions.map(entry => buildAbilityEntryHtml(entry)).join('');
            html += `
                <div class="cs-section cs-legendary-section" style="margin-top:12px;">
                    <h3 class="cs-section-title"><i class="fa-solid fa-dungeon"></i> Lair Actions</h3>
                    ${lairDesc}
                    ${rows}
                </div>
            `;
        }
        
        return html;
    }

    function ensureNpcSpells(m) {
        if (m.spells) return m.spells;
        let spells = {
            cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: []
        };
        if (m.spellcasting) {
            m.spellcasting.forEach(sc => {
                if (sc.spells) {
                    for (let lvl in sc.spells) {
                        let levelKey = lvl === '0' ? 'cantrip' : 'level' + lvl;
                        sc.spells[lvl].spells.forEach(sp => {
                            let name = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown');
                            if (spells[levelKey]) spells[levelKey].push({ id: 'sp_' + Date.now() + Math.random(), name: name, prepared: true });
                        });
                    }
                }
                if (sc.will) {
                    sc.will.forEach(sp => {
                        let name = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown');
                        spells.cantrip.push({ id: 'sp_' + Date.now() + Math.random(), name: name, prepared: true, innate: true });
                    });
                }
                if (sc.daily) {
                    for (let dailyLvl in sc.daily) {
                        sc.daily[dailyLvl].forEach(sp => {
                            let name = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp.name || 'Unknown');
                            spells.level1.push({ id: 'sp_' + Date.now() + Math.random(), name: name, prepared: true, innate: true });
                        });
                    }
                }
            });
        }
        m.spells = spells;
        return m.spells;
    }

    function buildSpellcastingHtml(m) {
        const spellsObj = ensureNpcSpells(m);
        const spellLevels = [
            { key: 'cantrip', label: 'Cantrips/At Will' },
            { key: 'level1', label: '1st Level/Daily' },
            { key: 'level2', label: '2nd Level' },
            { key: 'level3', label: '3rd Level' },
            { key: 'level4', label: '4th Level' },
            { key: 'level5', label: '5th Level' },
            { key: 'level6', label: '6th Level' },
            { key: 'level7', label: '7th Level' },
            { key: 'level8', label: '8th Level' },
            { key: 'level9', label: '9th Level' }
        ];

        let html = `<div style="display:flex; flex-direction:column; gap:16px;">`;
        
        if (m.spellcasting && m.spellcasting.length > 0) {
            html += `<div class="cs-spellcasting-desc" style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 4px; font-size: 0.9rem; line-height: 1.4; color: var(--color-text-secondary); margin-bottom: 4px; border-left: 3px solid var(--color-gold-base);">`;
            m.spellcasting.forEach((sc, i) => {
                const name = sc.name ? `<strong style="color:var(--color-gold-light); font-size: 1rem; display:block; margin-bottom: 4px;">${sc.name}</strong> ` : '';
                const hEntries = sc.headerEntries ? sc.headerEntries.map(e => formatRawEntry(e)).join('<br>') : '';
                const fEntries = sc.footerEntries ? '<br>' + sc.footerEntries.map(e => formatRawEntry(e)).join('<br>') : '';
                const desc = injectDiceChips(parse5eMarkup(hEntries + fEntries));
                html += `<div style="margin-bottom: ${i < m.spellcasting.length - 1 ? '16px' : '0'};">${name}${desc}</div>`;
            });
            html += `</div>`;
        }

        spellLevels.forEach(sl => {
            const list = spellsObj[sl.key];
            if (list && list.length > 0) {
                html += `
                    <div class="cs-spell-page" style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                            <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base);">${sl.label}</span>
                            ${linkedCharacterId ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="${sl.key}"><i class="fa-solid fa-plus"></i> Add Spell</button>` : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${list.map((sp, idx) => {
                                if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderSpellRowHtml) {
                                    let rawHtml = window.vttPlayerSheetAPI.renderSpellRowHtml(sp, sl.key, idx, false);
                                    rawHtml = rawHtml.replace(/pc-spell-/g, 'cs-spell-');
                                    if (!linkedCharacterId) {
                                        rawHtml = rawHtml.replace(/<button[^>]*cs-spell-edit[^>]*>[\s\S]*?<\/button>/, '');
                                    }
                                    return rawHtml;
                                }
                                return `<div>${sp.name}</div>`;
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="cs-spell-page" style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                            <span style="font-size:0.9rem; font-weight:600; color:var(--color-gold-base); opacity:0.5;">${sl.label}</span>
                            ${linkedCharacterId ? `<button class="btn btn-secondary btn-xxs cs-btn-add-spell" data-level="${sl.key}"><i class="fa-solid fa-plus"></i> Add</button>` : ''}
                        </div>
                    </div>
                `;
            }
        });
        html += `</div>`;
        return html;
    }

    function formatRawEntry(e) {
        if (typeof e === 'string') return e;
        if (!e) return '';
        if (Array.isArray(e)) return e.map(item => formatRawEntry(item)).join(' ');
        
        if (e.type === 'list') {
            const itemsHtml = (e.items || []).map(item => {
                if (typeof item === 'string') return `<li style="margin-bottom: 4px;">${item}</li>`;
                if (item.type === 'itemSub' || item.type === 'item') {
                    const nameStr = item.name ? `<strong><em>${item.name}.</em></strong> ` : '';
                    const entryStr = item.entry ? formatRawEntry(item.entry) : (item.entries ? formatRawEntry(item.entries) : '');
                    return `<li style="margin-bottom: 4px;">${nameStr}${entryStr}</li>`;
                }
                return `<li style="margin-bottom: 4px;">${formatRawEntry(item)}</li>`;
            }).join('');
            return `<ul style="margin: 8px 0; padding-left: 20px;">${itemsHtml}</ul>`;
        }
        
        if (e.type === 'entries') {
            const nameStr = e.name ? `<strong><em>${e.name}.</em></strong> ` : '';
            const entryStr = e.entries ? formatRawEntry(e.entries) : '';
            return `<div style="margin-top: 8px;">${nameStr}${entryStr}</div>`;
        }

        if (e.type === 'inset') {
            const nameStr = e.name ? `<strong>${e.name}</strong><br>` : '';
            const entryStr = e.entries ? formatRawEntry(e.entries) : '';
            return `<div style="margin: 8px 0; padding: 8px; border-left: 3px solid var(--color-gold-base); background: rgba(0,0,0,0.2);">${nameStr}${entryStr}</div>`;
        }
        
        if (e.type === 'table') {
            return `<div style="margin: 8px 0; font-style: italic; color: var(--color-text-muted);">[Table: ${e.caption || 'Data table omitted'}]</div>`;
        }
        
        if (e.type === 'inlineBlock') {
            const entryStr = e.entries ? formatRawEntry(e.entries) : '';
            return `<span>${entryStr}</span>`;
        }

        if (e.entries) return formatRawEntry(e.entries);
        return ''; // Fallback for unknown object types without entries to prevent ugly JSON text
    }

    function buildAbilityEntryHtml(entry) {
        if (!entry) return '';
        const name = entry.name || '';
        const rawEntries = entry.entries || [];
        const textLines = rawEntries.map(e => formatRawEntry(e)).join(' ');
        const cleanText = parse5eMarkup(textLines);
        const displayText = injectDiceChips(cleanText);

        const parsedName = name ? parse5eMarkup(name) : '';
        const nameHtml = parsedName 
            ? parsedName 
            : `<span style="color:var(--color-primary); font-size:0.85em;"><i class="fa-solid fa-tower-broadcast"></i> Ping</span>`;

        // Store raw entries safely for macro parsing
        const rawJson = encodeURIComponent(JSON.stringify(rawEntries));

        return `
            <div class="cs-ability-entry">
                <div class="cs-ability-header" style="display: flex; align-items: center; gap: 8px;">
                    <div class="cs-ability-name cs-macro-trigger" title="Click to roll macro" style="cursor: pointer; flex: 0 0 auto;">
                        ${nameHtml} <i class="fa-solid fa-dice-d20" style="font-size: 0.85em; opacity: 0.6; margin-left: 2px;"></i>
                    </div>
                    <div class="cs-ability-info-btn" title="Click to post description to chat" style="cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; transition: background 0.2s, color 0.2s;">
                        <i class="fa-solid fa-circle-info"></i>
                    </div>
                </div>
                <div class="cs-ability-text">${displayText}</div>
                <div class="cs-ability-raw" style="display:none;">${rawJson}</div>
            </div>
        `;
    }

    // ─── 5etools Markup Parser ────────────────────────────────────────────────
    function parse5eMarkup(text) {
        if (!text) return '';
        let result = text;

        // 1. Attack tags: {@atk mw}, {@atk rw}, {@atk mw,rw}, {@atkr m}, {@atkr r}, {@atkr m,r}
        result = result.replace(/\{@atk\s+([^}]+)\}/gi, (match, type) => {
            const t = type.toLowerCase();
            if (t === 'mw') return '<strong>Melee Weapon Attack:</strong>';
            if (t === 'rw') return '<strong>Ranged Weapon Attack:</strong>';
            if (t === 'mw,rw') return '<strong>Melee or Ranged Weapon Attack:</strong>';
            return '<strong>Attack:</strong>';
        });
        result = result.replace(/\{@atkr\s+([^}]+)\}/gi, (match, type) => {
            const t = type.toLowerCase();
            if (t === 'm') return '<strong>Melee Attack:</strong>';
            if (t === 'r') return '<strong>Ranged Attack:</strong>';
            if (t === 'm,r') return '<strong>Melee or Ranged Attack:</strong>';
            return '<strong>Attack:</strong>';
        });

        // 2. Hit tags: {@hit 5} or {@hit 5} to hit -> convert to standard (+5 to hit)
        result = result.replace(/\{@hit\s+([+\-]?\d+)\}(?:\s+to\s+hit)?/gi, (match, bonus) => {
            const sign = bonus.startsWith('+') || bonus.startsWith('-') ? '' : '+';
            return `${sign}${bonus} to hit`;
        });

        // 3. Hit symbols: {@h} -> Hit:
        result = result.replace(/\{@h\}/gi, '<strong>Hit:</strong> ');

        // 4. Damage tags: {@damage 1d4 + 2|...} -> extract formula
        result = result.replace(/\{@damage\s+([^}]+)\}/gi, (match, contents) => {
            const parts = contents.split('|');
            return parts[0].trim();
        });

        // 5. DC tags: {@dc 15} -> DC 15
        result = result.replace(/\{@dc\s+(\d+)\}/gi, '<strong>DC $1</strong>');

        // 6. Recharge tags: {@recharge 5} -> (Recharge 5-6), {@recharge} -> (Recharge 6)
        result = result.replace(/\{@recharge\s*(\d*)\}/gi, (match, num) => {
            const val = num ? `${num}–6` : '6';
            return `<strong>(Recharge ${val})</strong>`;
        });

        // 7. 2024 / New Action Format tags
        result = result.replace(/\{@actSave\s+([^}]+)\}/gi, (match, stat) => {
            return `<strong>${stat.toUpperCase()} Saving Throw:</strong>`;
        });
        result = result.replace(/\{@actSaveFail\}/gi, '<em>Failure:</em>');
        result = result.replace(/\{@actSaveSuccess\}/gi, '<em>Success:</em>');
        result = result.replace(/\{@actSaveSuccessOrFail\}/gi, '<em>Success or Failure:</em>');
        result = result.replace(/\{@actTrigger\}/gi, '<strong>Trigger:</strong>');
        result = result.replace(/\{@actResponse\}/gi, '<strong>Response:</strong>');
        
        result = result.replace(/\{@action\s+([^}]+)\}/gi, '<strong>$1</strong>');
        result = result.replace(/\{@condition\s+([^|}]+)[^}]*\}/gi, '<strong>$1</strong>');
        result = result.replace(/\{@variantrule\s+([^|}]+)[^}]*\}/gi, '<strong>$1</strong>');

        // 8. Generic tag cleaner for: status, quickref, spell, item, creature, filter, etc.
        result = result.replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, contents) => {
            if (tag === 'b') return `<strong>${contents}</strong>`;
            if (tag === 'i') return `<em>${contents}</em>`;
            if (tag === 'u') return `<u>${contents}</u>`;
            if (tag === 's') return `<s>${contents}</s>`;
            if (tag === 'note') return `<em>Note: ${contents}</em>`;
            if (tag === 'chance') return `${contents}%`;

            const parts = contents.split('|');
            let displayText = parts[0].trim();
            if (parts.length >= 3) {
                const p2 = parts[2].trim();
                if (p2 && isNaN(p2)) {
                    displayText = p2;
                }
            }
            return displayText;
        });

        return result;
    }

    // ─── Dice chip injector ───────────────────────────────────────────────────
    function injectDiceChips(text) {
        if (!text) return '';
        // Match patterns like "2d6+3", "1d20", "4d8 + 2", "+5 to hit"
        let result = text;

        // 1. XdY+Z or XdY-Z or just XdY (runs first to avoid double wrapping generated buttons)
        // We use (?![^<]*>) to ensure we don't accidentally match inside an HTML tag attribute!
        result = result.replace(/(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?(?![^<]*>)/gi, (match, count, faces, sign, mod) => {
            let formula = `${count}d${faces}`;
            if (sign && mod) formula += `${sign}${mod}`;
            return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${match.trim()}</button>`;
        });

        // 2. +N to hit → clickable 1d20+N chip
        result = result.replace(/\+(\d+)\s+to\s+hit(?![^<]*>)/gi, (match, bonus) => {
            const formula = `1d20+${bonus}`;
            return `<button class="dice-chip" data-formula="${formula}" title="Roll attack: ${formula}">+${bonus} to hit</button>`;
        });

        // 3. DC N → clickable ping chip
        result = result.replace(/DC\s+(\d+)(?![^<]*>)/gi, (match, dcVal) => {
            return `<button class="dice-chip dc-chip" data-dc="${dcVal}" style="border-color: var(--color-gold-base);" title="Ping DC ${dcVal} to Chat">DC ${dcVal}</button>`;
        });

        return result;
    }

    // ─── Builders for sub-sections ────────────────────────────────────────────
    function buildTypeString(m) {
        const size = m.size ? sizeCode(m.size) : '';
        const type = m.type ? (typeof m.type === 'object' ? m.type.type : m.type) : '';
        const subtype = m.type?.tags ? ` (${m.type.tags.join(', ')})` : '';
        const align = Array.isArray(m.alignment) ? ' ' + m.alignment.join(' ') : '';
        return `${size} ${type}${subtype}${align}`.trim();
    }

    function sizeCode(s) {
        const letter = Array.isArray(s) ? s[0] : s;
        const map = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
        return map[letter?.toUpperCase()] || letter || '';
    }

    function buildSpeedString(speed) {
        if (!speed) return '—';
        const parts = [];
        if (speed.walk) parts.push(`${speed.walk} ft.`);
        if (speed.fly) parts.push(`Fly ${speed.fly} ft.`);
        if (speed.swim) parts.push(`Swim ${speed.swim} ft.`);
        if (speed.burrow) parts.push(`Burrow ${speed.burrow} ft.`);
        if (speed.climb) parts.push(`Climb ${speed.climb} ft.`);
        return parts.length ? parts.join(', ') : `${speed} ft.`;
    }

    function formatSkillName(str) {
        if (!str) return '';
        let clean = str.replace(/([A-Z])/g, ' $1');
        return clean.split(/[\s_-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    function buildSavesHtml(m) {
        if (!m.save) return '';
        return Object.entries(m.save).map(([k, v]) => {
            const ab = k.toUpperCase();
            const val = parseInt(v) || 0;
            const sign = val >= 0 ? '+' : '';
            const formula = `1d20${sign}${val}`;
            return `<button class="dice-chip" data-formula="${formula}" data-label="${ab} Saving Throw" title="Roll ${ab} Saving Throw">${ab} ${v}</button>`;
        }).join(' ');
    }

    function buildSkillsHtml(m) {
        if (!m.skill) return '';
        return Object.entries(m.skill).map(([k, v]) => {
            const skillName = formatSkillName(k);
            const val = parseInt(v) || 0;
            const sign = val >= 0 ? '+' : '';
            const formula = `1d20${sign}${val}`;
            return `<button class="dice-chip" data-formula="${formula}" data-label="${skillName} Check" title="Roll ${skillName} Check">${skillName} ${v}</button>`;
        }).join(' ');
    }

    function buildImmunityHtml(m) {
        const rows = [];
        if (m.immune) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Immunities</span><span class="cs-info-value">${formatDamageList(m.immune)}</span></div>`);
        if (m.resist) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Resistances</span><span class="cs-info-value">${formatDamageList(m.resist)}</span></div>`);
        if (m.vulnerable) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Vulnerabilities</span><span class="cs-info-value">${formatDamageList(m.vulnerable)}</span></div>`);
        if (m.conditionImmune) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Cond. Immune</span><span class="cs-info-value">${formatDamageList(m.conditionImmune)}</span></div>`);
        if (m.senses) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Senses</span><span class="cs-info-value">${typeof m.senses === 'object' ? Object.entries(m.senses).map(([k, v]) => `${k} ${v}`).join(', ') : m.senses}</span></div>`);
        if (m.languages) rows.push(`<div class="cs-info-row"><span class="cs-info-label">Languages</span><span class="cs-info-value">${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages}</span></div>`);
        return rows.join('');
    }

    function formatDamageList(list) {
        if (!list) return '—';
        if (!Array.isArray(list)) return String(list);
        return list.map(item => (typeof item === 'object' && item !== null) ? `${item.note || ''} (${item.immune || item.resist || item.vulnerable || ''})` : item).join('; ');
    }

    function getProfBonus(crStr) {
        const cr = parseFloat(crStr) || 0;
        if (cr < 5) return 2;
        if (cr < 9) return 3;
        if (cr < 13) return 4;
        if (cr < 17) return 5;
        if (cr < 21) return 6;
        if (cr < 25) return 7;
        if (cr < 29) return 8;
        return 9;
    }

    function getMonsterImageUrl(m) {
        if (linkedCharacterId && window.VTT?.campaignState?.characters) {
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char && char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex !== -1) {
                const idx = char.activeTokenIndex || 0;
                if (idx >= 0 && idx < char.tokenImages.length) return char.tokenImages[idx].url;
            }
        }
        if (m.hasToken) {
            const cleanName = m.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '_');
            return `img/bestiary/tokens/${m.source}/${cleanName}.webp`;
        }
        return 'favicon.svg';
    }

    function getLinkedTokenHp() {
        if (!linkedTokenId || !window.VTT?.canvasEngine) return null;
        const tokens = window.VTT.canvasEngine.getTokens();
        return tokens[linkedTokenId]?.hp ?? null;
    }

    function capitalize(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    // ─── Chat posting ─────────────────────────────────────────────────────────
    function rollAndPostToChat(formula, label) {
        if (!vtt.socket) return;

        const regex = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i;
        const match = formula.match(regex);
        if (!match) {
            postAbilityToChat(label, formula);
            return;
        }

        let count = parseInt(match[1]);
        const faces = parseInt(match[2]);
        const sign = match[3] || '+';
        const modifier = match[4] ? parseInt(match[4]) : 0;

        let isAdvantage = false;
        let isDisadvantage = false;
        let rollMode = window.VTT ? window.VTT.currentRollMode : 'normal';
        const evt = window.event;
        
        if (count === 1 && faces === 20) {
            if (evt && evt.shiftKey) rollMode = 'adv';
            else if (evt && evt.ctrlKey) rollMode = 'dis';
            if (rollMode === 'adv') isAdvantage = true;
            if (rollMode === 'dis') isDisadvantage = true;
        }

        if (isAdvantage || isDisadvantage) {
            count = 2; // Roll 2d20
        }

        const diceList = [];
        for (let i = 0; i < count; i++) {
            const val = Math.floor(Math.random() * faces) + 1;
            diceList.push({ faces, val });
        }
        
        let subtotal = 0;
        let droppedIndex = -1;

        if (isAdvantage) {
            if (diceList[0].val >= diceList[1].val) {
                subtotal = diceList[0].val;
                droppedIndex = 1;
            } else {
                subtotal = diceList[1].val;
                droppedIndex = 0;
            }
        } else if (isDisadvantage) {
            if (diceList[0].val <= diceList[1].val) {
                subtotal = diceList[0].val;
                droppedIndex = 1;
            } else {
                subtotal = diceList[1].val;
                droppedIndex = 0;
            }
        } else {
            for (let d of diceList) {
                subtotal += d.val;
            }
        }

        if (droppedIndex !== -1) {
            diceList[droppedIndex].discarded = true;
        }

        const finalModifier = sign === '-' ? -modifier : modifier;
        const total = subtotal + finalModifier;

        const rollResult = { formula: isAdvantage || isDisadvantage ? `2d20${rollMode==='adv'?'kh1':'kl1'}${sign}${modifier}` : formula, count, faces, diceList, modifier: finalModifier, total };
        const visibility = getVisibilitySetting();
        const modeText = isAdvantage ? ' (Advantage)' : isDisadvantage ? ' (Disadvantage)' : '';

        if (visibility === 'private') {
            // Whisper only to this GM
            vtt.socket.emit('chat:whisper', {
                to: vtt.username,
                text: `[${label}] rolls **${formula}**${modeText}`,
                roll: rollResult
            });
        } else {
            vtt.socket.emit('chat:msg', {
                text: `[${label}] rolls **${formula}**${modeText}`,
                roll: rollResult
            });
        }
    }

    function postAbilityToChat(abilityName, text) {
        if (!vtt.socket) return;
        const visibility = getVisibilitySetting();
        const msgText = `**[${currentMonster?.name || 'Creature'}] ${abilityName}**`;

        if (visibility === 'private') {
            vtt.socket.emit('chat:whisper', { to: vtt.username, text: msgText });
        } else {
            vtt.socket.emit('chat:msg', { text: msgText });
        }
    }

    function getVisibilitySetting() {
        const el = document.getElementById('config-roll-visibility');
        return el ? el.value : 'public';
    }

    // ─── Event delegation for dice chips and ability name clicks ─────────────
    contentEl.addEventListener('click', (e) => {
        // Dice chip or native roller click inside the panel
        const rollerTarget = e.target.closest('.dice-chip, .render-roller');
        if (rollerTarget) {
            // Check if it's a DC chip instead of a rollable formula
            if (rollerTarget.classList.contains('dc-chip')) {
                const dcVal = rollerTarget.dataset.dc;
                const visibility = getVisibilitySetting();
                
                // Try to find if it's specifically a spellcasting DC
                const isSpellcasting = !!rollerTarget.closest('.cs-spellcasting-header');
                const label = isSpellcasting ? "Spellcasting DC" : "Save DC";
                
                const abilityCard = {
                    creatureName: currentMonster?.name || 'Creature',
                    abilityName: label,
                    text: `<div style="text-align: center; font-size: 1.8em; margin: 12px 0; color: var(--color-gold-base); font-weight: bold;">DC ${dcVal}</div>`
                };
                
                if (visibility === 'private' || visibility === 'gm') {
                    vtt.socket.emit('chat:whisper', { to: vtt.username, text: `pings ${label}`, abilityCard });
                } else {
                    vtt.socket.emit('chat:msg', { text: `pings ${label}`, abilityCard });
                }
                e.stopPropagation();
                return;
            }

            let formula = rollerTarget.dataset.formula;
            if (!formula && rollerTarget.classList.contains('render-roller')) {
                formula = rollerTarget.textContent.trim();
            }
            const labelAttr = rollerTarget.dataset.label;
            const label = labelAttr ? `${currentMonster?.name || 'Creature'}: ${labelAttr}` : (currentMonster?.name || 'Creature');
            if (formula) rollAndPostToChat(formula, label);
            e.stopPropagation();
            return;
        }

        // Info button click -> post standard description card to chat
        const infoEl = e.target.closest('.cs-ability-info-btn');
        if (infoEl) {
            const entry = infoEl.closest('.cs-ability-entry');
            if (!entry) return;
            const nameEl = entry.querySelector('.cs-ability-name');
            let abilityName = nameEl ? nameEl.textContent.trim() : 'Ability';
            if (abilityName === 'Ping') abilityName = 'Ability';
            
            const abilityText = entry.querySelector('.cs-ability-text')?.innerHTML.trim() || '';
            const visibility = getVisibilitySetting();

            const abilityCard = {
                creatureName: currentMonster?.name || 'Creature',
                abilityName: abilityName,
                text: abilityText
            };

            if (visibility === 'private' || visibility === 'gm') {
                vtt.socket.emit('chat:whisper', { to: vtt.username, text: `pings ${abilityName}`, abilityCard });
            } else {
                vtt.socket.emit('chat:msg', { text: `pings ${abilityName}`, abilityCard });
            }
            e.stopPropagation();
            return;
        }

        // Ability name click -> evaluate and post macro card
        const nameEl = e.target.closest('.cs-ability-name');
        if (nameEl) {
            const entry = nameEl.closest('.cs-ability-entry');
            if (!entry) return;
            let abilityName = nameEl.textContent.trim();
            if (abilityName === 'Ping') abilityName = 'Ability';
            
            const abilityText = entry.querySelector('.cs-ability-text')?.innerHTML.trim() || '';
            const rawJsonEl = entry.querySelector('.cs-ability-raw');
            let rawEntries = [];
            if (rawJsonEl) {
                try {
                    rawEntries = JSON.parse(decodeURIComponent(rawJsonEl.textContent));
                } catch (err) {}
            }
            const charName = currentMonster?.name || 'Creature';
            const macroCard = parseActionMacro(abilityName, rawEntries, abilityText, charName);
            
            // Wait to see if they just wanted a description and macro generated nothing
            if (!macroCard.atkRoll && !macroCard.saveInfo && macroCard.dmgRolls.length === 0) {
                // Fallback to basic ping if there's no rollable macro stuff
                const abilityCard = {
                    creatureName: currentMonster?.name || 'Creature',
                    abilityName: abilityName,
                    text: abilityText
                };
                const visibility = getVisibilitySetting();
                if (visibility === 'private' || visibility === 'gm') {
                    vtt.socket.emit('chat:whisper', { to: vtt.username, text: `uses ${abilityName}`, abilityCard });
                } else {
                    vtt.socket.emit('chat:msg', { text: `uses ${abilityName}`, abilityCard });
                }
            } else {
                // Post macro card
                const visibility = getVisibilitySetting();
                const msgOut = { 
                    text: `uses ${abilityName}`, 
                    macroCard: macroCard, 
                    creatureName: currentMonster?.name || 'Creature' 
                };
                if (visibility === 'private' || visibility === 'gm') {
                    msgOut.to = vtt.username;
                    vtt.socket.emit('chat:whisper', msgOut);
                } else {
                    vtt.socket.emit('chat:msg', msgOut);
                }
            }
            e.stopPropagation();
            return;
        }
        
        // Spell expand button click → expand/collapse details inline
        if (e.target.closest('.cs-spell-expand-btn')) {
            const item = e.target.closest('.cs-spell-item');
            const details = item.querySelector('.cs-spell-details');
            const nameEl = item.querySelector('.cs-spell-name');
            const spellName = nameEl.textContent.trim();
            const descEl = details.querySelector('.cs-spell-desc');
            const btnEl = item.querySelector('.cs-spell-expand-btn');
            
            const editBtn = item.querySelector('.cs-spell-edit');
            const level = editBtn ? editBtn.dataset.level : null;
            const idx = editBtn ? editBtn.dataset.idx : null;
            const sp = (level && idx && currentMonster.spells && currentMonster.spells[level]) ? currentMonster.spells[level][idx] : null;

            if (details.style.display === 'none') {
                details.style.display = 'block';
                btnEl.classList.add('expanded');
                
                // Fetch and render spell data
                if (!spellCache && window.DataUtil?.spell) {
                    descEl.innerHTML = `<em>Loading spell data...</em>`;
                    window.DataUtil.spell.pLoadAll().then(spells => {
                        spellCache = spells;
                        if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderAndInjectSpell) {
                            window.vttPlayerSheetAPI.renderAndInjectSpell(spellName, descEl, sp?.description || '', sp);
                        } else {
                            renderAndInjectSpell(spellName, descEl, sp?.description || '', sp);
                        }
                    }).catch(err => {
                        console.error(err);
                        descEl.innerHTML = `<em>Error loading spell data: ${err.message || err.toString()}</em>`;
                    });
                } else if (spellCache) {
                    if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderAndInjectSpell) {
                        window.vttPlayerSheetAPI.renderAndInjectSpell(spellName, descEl, sp?.description || '', sp);
                    } else {
                        renderAndInjectSpell(spellName, descEl, sp?.description || '', sp);
                    }
                } else {
                    descEl.innerHTML = `<em>Cast ${spellName} (DataUtil not found)</em>`;
                }
            } else {
                details.style.display = 'none';
                btnEl.classList.remove('expanded');
            }
        }

        // Spell name click handling has been moved to the specific spell buttons (rollNpcSpell)

        function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp) {
            if (!spellCache) return;
            
            const spell = spellCache.find(s => s.name.toLowerCase().trim() === spellName.toLowerCase().trim());
            
            let metaHtml = '';
            if (window.Parser) {
                let time = sp?.castingTime || (spell ? Parser.spTimeListToFull(spell.time, spell.meta) : '');
                let range = sp?.range || (spell ? Parser.spRangeToFull(spell.range) : '');
                let components = sp?.components || (spell ? Parser.spComponentsToFull(spell.components, spell.level) : '');
                let duration = sp?.duration || (spell ? Parser.spDurationToFull(spell.duration) : '');
                
                time = typeof time === 'string' ? time : (spell ? Parser.spTimeListToFull(spell.time, spell.meta) : '');
                range = typeof range === 'string' ? range : (spell ? Parser.spRangeToFull(spell.range) : '');
                components = typeof components === 'string' ? components : (spell ? Parser.spComponentsToFull(spell.components, spell.level) : '');
                duration = typeof duration === 'string' ? duration : (spell ? Parser.spDurationToFull(spell.duration) : '');
                
                metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
                if (time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${time}</div>`;
                if (range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${range}</div>`;
                if (components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${components}</div>`;
                if (duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${duration}</div>`;
                metaHtml += '</div>';
            }

            if (fallbackDesc && fallbackDesc.trim() !== '') {
                containerEl.innerHTML = metaHtml + `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>`;
                return;
            }
            if (spell && RenderSpells) {
                // Generate HTML via 5eTools renderer
                let rawRender = RenderSpells.getRenderedSpell(spell);
                let html = "";
                if (typeof rawRender === "string") {
                    html = rawRender;
                } else {
                    // It's likely a DocumentFragment or Element. Append to a temp table to extract HTML.
                    const temp = document.createElement("table");
                    try {
                        if (rawRender.appendTo) rawRender.appendTo(temp);
                        else temp.appendChild(rawRender);
                        html = temp.innerHTML;
                    } catch(e) {
                        html = rawRender.outerHTML || rawRender.innerHTML || String(rawRender);
                    }
                }
                
                // The renderer output is wrapped in table structures.
                // We strip out the table row/body wrappers for a clean card layout.
                html = html.replace(/<\/?tbody[^>]*>/g, '').replace(/<\/?tr[^>]*>/g, '').replace(/<\/?td[^>]*>/g, '<div>').replace(/<\/td>/g, '</div>');
                
                // Inject our dice chip buttons
                html = injectDiceChips(html);
                containerEl.innerHTML = html;
            } else {
                containerEl.innerHTML = `<em>Could not find full text for ${spellName}</em>`;
            }
        }

    });

    // ─── Editing Logic ───────────────────────────────────────────────────────
    let currentEditCharId = null;

    function openEditModal(m, charId) {
        currentEditCharId = charId;
        const char = window.VTT.campaignState.characters[charId];
        
        // Remove existing if any
        let overlay = document.getElementById('cs-edit-modal-overlay');
        if (overlay) overlay.remove();

        // Create overlay on body
        overlay = document.createElement('div');
        overlay.id = 'cs-edit-modal-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:9999; display:flex; justify-content:center; align-items:center;";
        
        // Modal Container
        const modalContainer = document.createElement('div');
        modalContainer.style.cssText = "width: 500px; max-width: 90vw; max-height: 85vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-border, #444); border-radius: 8px; display:flex; flex-direction:column; box-shadow: 0 4px 16px rgba(0,0,0,0.8);";

        
        // Header
        const header = document.createElement('div');
        header.style.cssText = "padding:12px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-dark); border-radius: 8px 8px 0 0;";
        header.innerHTML = `
            <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base);">Edit Companion</h3>
            <div>
                <button class="btn btn-sm btn-primary" id="cs-edit-save-btn">Save</button>
                <button class="btn btn-sm btn-secondary" id="cs-edit-cancel-btn">Cancel</button>
            </div>
        `;
        
        // Content
        const content = document.createElement('div');
        content.id = 'cs-edit-modal-content';
        content.style.cssText = "flex:1; overflow-y:auto; padding:12px;";

        modalContainer.appendChild(header);
        modalContainer.appendChild(content);
        overlay.appendChild(modalContainer);
        document.body.appendChild(overlay);

        // Parse existing values
        const name = char.name || m.name || '';
        
        // Ensure tokens are initialized and normalized
        if (!char.tokenImages) {
            char.tokenImages = [];
            char.activeTokenIndex = 0;
        } else if (typeof char.tokenImages === 'string') {
            char.tokenImages = [{ url: char.tokenImages, name: 'Imported Token' }];
            char.activeTokenIndex = 0;
        } else if (Array.isArray(char.tokenImages)) {
            // Normalize old string entries
            char.tokenImages = char.tokenImages.map(t => typeof t === 'string' ? { url: t, name: 'Imported Token' } : (t && typeof t === 'object' ? t : { url: '', name: 'Unknown' }));
        } else {
            char.tokenImages = [];
            char.activeTokenIndex = 0;
        }
        if (typeof char.activeTokenIndex !== 'number') char.activeTokenIndex = 0;
        const acObj = Array.isArray(m.ac) ? m.ac[0] : m.ac;
        const ac = (typeof acObj === 'object' && acObj !== null) ? acObj.ac : (acObj || 10);
        const hpAvg = m.hp?.average || 0;
        const hpForm = m.hp?.formula || '';

        const saves = m.save || {};
        
        let html = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <!-- Identity -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Identity</h4>
                    <div style="display:flex; gap:12px; margin-bottom:8px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Name</label>
                            <input type="text" id="cs-edit-name" class="vtt-input" style="width:100%;" value="${name}">
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <label style="font-size:0.8rem;">Token Gallery <span style="font-weight:normal; color:var(--color-text-muted); margin-left:8px;">(Click active to deselect & use Bestiary art)</span></label>
                            <div style="display:flex; gap:4px;">
                                <input type="text" id="cs-edit-token-add-url" class="vtt-input vtt-input-sm" style="width:120px;" placeholder="Image URL">
                                <button class="btn btn-xs btn-secondary" id="cs-edit-token-add-btn"><i class="fa-solid fa-plus"></i></button>
                                <input type="file" id="cs-edit-token-file" style="display:none;" accept="image/*,video/*">
                                <button class="btn btn-xs btn-primary" id="cs-edit-token-upload-btn" title="Upload Media"><i class="fa-solid fa-upload"></i></button>
                            </div>
                        </div>
                        <div id="cs-edit-token-gallery" style="display:flex; gap:8px; flex-wrap:wrap; padding:8px; background:var(--color-bg-dark); border-radius:4px; min-height:80px;">
                            <!-- Gallery items rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Core Stats -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Core Stats</h4>
                    <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:8px;">
                        ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => `
                            <div>
                                <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${ab}</label>
                                <input type="number" class="vtt-input cs-edit-stat" data-stat="${ab}" style="width:100%;" value="${m[ab] || 10}">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Combat -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Combat</h4>
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">AC</label>
                            <input type="number" id="cs-edit-ac" class="vtt-input" style="width:100%;" value="${ac}">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">HP (Avg)</label>
                            <input type="number" id="cs-edit-hp-avg" class="vtt-input" style="width:100%;" value="${hpAvg}">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">HP Formula</label>
                            <input type="text" id="cs-edit-hp-form" class="vtt-input" style="width:100%;" value="${hpForm}" placeholder="e.g. 2d8+4">
                        </div>
                    </div>
                </div>

                <!-- Defenses & Info -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Defenses & Info</h4>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Immunities</label>
                            <input type="text" id="cs-edit-immune" class="vtt-input" style="width:100%;" value="${Array.isArray(m.immune) ? formatDamageList(m.immune) : m.immune || ''}" placeholder="e.g. fire, poison">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Resistances</label>
                            <input type="text" id="cs-edit-resist" class="vtt-input" style="width:100%;" value="${Array.isArray(m.resist) ? formatDamageList(m.resist) : m.resist || ''}" placeholder="e.g. bludgeoning">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Vulnerabilities</label>
                            <input type="text" id="cs-edit-vuln" class="vtt-input" style="width:100%;" value="${Array.isArray(m.vulnerable) ? formatDamageList(m.vulnerable) : m.vulnerable || ''}" placeholder="e.g. cold">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Condition Immunities</label>
                            <input type="text" id="cs-edit-cond" class="vtt-input" style="width:100%;" value="${Array.isArray(m.conditionImmune) ? formatDamageList(m.conditionImmune) : m.conditionImmune || ''}" placeholder="e.g. charmed">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Senses</label>
                            <input type="text" id="cs-edit-senses" class="vtt-input" style="width:100%;" value="${typeof m.senses === 'object' && m.senses !== null && !Array.isArray(m.senses) ? Object.entries(m.senses).map(([k,v])=>k+' '+v).join(', ') : (Array.isArray(m.senses) ? m.senses.join(', ') : m.senses || '')}" placeholder="e.g. darkvision 60 ft., passive Perception 15">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Languages</label>
                            <input type="text" id="cs-edit-lang" class="vtt-input" style="width:100%;" value="${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages || ''}" placeholder="e.g. Common, Draconic">
                        </div>
                    </div>
                </div>

                <!-- Saves -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Saving Throws (Modifiers)</h4>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                        ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => `
                            <div>
                                <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${ab}</label>
                                <input type="text" class="vtt-input cs-edit-save" data-ability="${ab}" style="width:100%;" value="${saves[ab] || ''}" placeholder="+0">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Traits -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Traits</h4>
                    <div id="cs-edit-traits-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-trait">+ Add Trait</button>
                </div>

                <!-- Actions -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Actions</h4>
                    <div id="cs-edit-actions-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-action">+ Add Action</button>
                </div>

                <!-- Reactions -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Reactions</h4>
                    <div id="cs-edit-reactions-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-reaction">+ Add Reaction</button>
                </div>

                <!-- Legendary Actions -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Legendary Actions</h4>
                    <textarea id="cs-edit-legendary-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Legendary action description...">${m.legendaryActions || ''}</textarea>
                    <div id="cs-edit-legendary-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-legendary">+ Add Legendary Action</button>
                </div>

                <!-- Lair Actions -->
                <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Lair Actions</h4>
                    <textarea id="cs-edit-lair-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Lair action description...">${m.lairActionsDesc || ''}</textarea>
                    <div id="cs-edit-lair-list"></div>
                    <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-lair">+ Add Lair Action</button>
                </div>
            </div>
        `;
        content.innerHTML = html;

        // Populate lists
        function renderAbilityList(containerId, dataArray) {
            const container = content.querySelector('#' + containerId);
            container.innerHTML = '';
            if (dataArray && Array.isArray(dataArray)) {
                dataArray.forEach(item => {
                    const row = document.createElement('div');
                    row.style.cssText = "display:flex; flex-direction:column; gap:4px; margin-bottom:8px; padding:8px; background:var(--color-bg-dark); border-radius:4px; border:1px solid var(--color-border);";
                    
                    // Simple text extraction for entries
                    let desc = '';
                    if (item.entries && Array.isArray(item.entries)) {
                        desc = item.entries.join('\\n');
                    }
                    
                    row.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <input type="text" class="vtt-input edit-ab-name" value="${item.name || ''}" placeholder="Name" style="flex:1; margin-right:8px;">
                            <button class="btn btn-xxs btn-danger edit-ab-del"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <textarea class="vtt-input edit-ab-desc" style="width:100%; height:60px; resize:vertical; font-family:var(--font-body); font-size:0.85rem;" placeholder="Description...">${desc}</textarea>
                    `;
                    row.querySelector('.edit-ab-del').addEventListener('click', () => row.remove());
                    container.appendChild(row);
                });
            }
        }

        renderAbilityList('cs-edit-traits-list', m.trait);
        renderAbilityList('cs-edit-actions-list', m.action);
        renderAbilityList('cs-edit-reactions-list', m.reaction);
        renderAbilityList('cs-edit-legendary-list', m.legendary);
        renderAbilityList('cs-edit-lair-list', m.lairActions);

        // Add buttons
        function wireAddBtn(btnId, containerId) {
            content.querySelector('#' + btnId).addEventListener('click', () => {
                const row = document.createElement('div');
                row.style.cssText = "display:flex; flex-direction:column; gap:4px; margin-bottom:8px; padding:8px; background:var(--color-bg-dark); border-radius:4px; border:1px solid var(--color-border);";
                row.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <input type="text" class="vtt-input edit-ab-name" placeholder="Name" style="flex:1; margin-right:8px;">
                        <button class="btn btn-xxs btn-danger edit-ab-del"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <textarea class="vtt-input edit-ab-desc" style="width:100%; height:60px; resize:vertical; font-family:var(--font-body); font-size:0.85rem;" placeholder="Description..."></textarea>
                `;
                row.querySelector('.edit-ab-del').addEventListener('click', () => row.remove());
                content.querySelector('#' + containerId).appendChild(row);
            });
        }
        wireAddBtn('cs-edit-add-trait', 'cs-edit-traits-list');
        wireAddBtn('cs-edit-add-action', 'cs-edit-actions-list');
        wireAddBtn('cs-edit-add-reaction', 'cs-edit-reactions-list');
        wireAddBtn('cs-edit-add-legendary', 'cs-edit-legendary-list');
        wireAddBtn('cs-edit-add-lair', 'cs-edit-lair-list');

        // Render Token Gallery
        function renderCompanionTokenGallery() {
            const gal = content.querySelector('#cs-edit-token-gallery');
            gal.innerHTML = '';
            if (char.tokenImages.length === 0) {
                gal.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No custom tokens.</span>';
                return;
            }
            char.tokenImages.forEach((imgObj, idx) => {
                const isActive = char.activeTokenIndex === idx;
                const url = imgObj.url || '';
                const cleanUrl = url.split('?')[0].toLowerCase();
                const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
                
                const wrapper = document.createElement('div');
                wrapper.style.cssText = `position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${isActive ? 'var(--color-success-base)' : 'transparent'}; cursor:pointer;`;
                
                let mediaEl;
                if (isVideo) {
                    mediaEl = document.createElement('video');
                    mediaEl.src = url;
                    mediaEl.muted = true;
                    mediaEl.loop = true;
                    mediaEl.autoplay = true;
                    mediaEl.playsInline = true;
                    mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
                } else {
                    mediaEl = document.createElement('img');
                    mediaEl.src = url;
                    mediaEl.title = imgObj.name || 'Token';
                    mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
                }
                wrapper.appendChild(mediaEl);

                if (isActive) {
                    const badge = document.createElement('div');
                    badge.style.cssText = 'position:absolute; top:2px; right:2px; background:var(--color-success-base); color:#fff; border-radius:50%; width:16px; height:16px; font-size:0.6rem; display:flex; align-items:center; justify-content:center;';
                    badge.innerHTML = '<i class="fa-solid fa-check"></i>';
                    wrapper.appendChild(badge);
                }

                const delBtn = document.createElement('button');
                delBtn.className = 'btn btn-danger btn-xxs';
                delBtn.style.cssText = 'position:absolute; bottom:2px; right:2px; padding:2px 4px;';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                wrapper.appendChild(delBtn);

                wrapper.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    if (char.activeTokenIndex === idx) {
                        char.activeTokenIndex = -1;
                    } else {
                        char.activeTokenIndex = idx;
                    }
                    renderCompanionTokenGallery();
                });
                
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    char.tokenImages.splice(idx, 1);
                    if (char.activeTokenIndex >= char.tokenImages.length) {
                        char.activeTokenIndex = Math.max(0, char.tokenImages.length - 1);
                    } else if (char.activeTokenIndex > idx) {
                        char.activeTokenIndex--;
                    }
                    renderCompanionTokenGallery();
                });
                
                gal.appendChild(wrapper);
                if (isVideo) mediaEl.play().catch(()=>{});
            });
        }
        renderCompanionTokenGallery();

        // Add URL wiring
        content.querySelector('#cs-edit-token-add-btn').addEventListener('click', () => {
            const urlInput = content.querySelector('#cs-edit-token-add-url');
            const rawUrl = urlInput.value.trim();
            if (rawUrl) {
                char.tokenImages.push({ url: rawUrl, name: 'URL Media' });
                char.activeTokenIndex = char.tokenImages.length - 1;
                urlInput.value = '';
                renderCompanionTokenGallery();
            }
        });

        // File Upload wiring
        const fileInput = content.querySelector('#cs-edit-token-file');
        const uploadBtn = content.querySelector('#cs-edit-token-upload-btn');
        
        uploadBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            
            const origHtml = uploadBtn.innerHTML;
            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            uploadBtn.disabled = true;

            try {
                const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    char.tokenImages.push({ url: data.url, name: file.name });
                    char.activeTokenIndex = char.tokenImages.length - 1;
                    renderCompanionTokenGallery();
                } else {
                    alert("Upload failed.");
                }
            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                uploadBtn.innerHTML = origHtml;
                uploadBtn.disabled = false;
                e.target.value = '';
            }
        });

        // Wiring Save/Cancel
        overlay.querySelector('#cs-edit-cancel-btn').onclick = () => overlay.remove();
        overlay.querySelector('#cs-edit-save-btn').onclick = () => saveCompanionEdits(m);
    }

    function saveCompanionEdits(m) {
        if (!currentEditCharId) return;
        const char = window.VTT.campaignState.characters[currentEditCharId];
        if (!char) return;
        
        const overlay = document.getElementById('cs-edit-modal-overlay');
        const content = document.getElementById('cs-edit-modal-content');
        if (!content) return;

        // Extract basic info
        const newName = content.querySelector('#cs-edit-name').value.trim();
        const newAc = parseInt(content.querySelector('#cs-edit-ac').value) || 10;
        const newHpAvg = parseInt(content.querySelector('#cs-edit-hp-avg').value) || 0;
        const newHpForm = content.querySelector('#cs-edit-hp-form').value.trim();

        char.name = newName;
        m.name = newName;
        // tokenImages and activeTokenIndex are already directly modified on 'char' via the gallery UI.

        char.ac = newAc;
        if (Array.isArray(m.ac)) {
            if (typeof m.ac[0] === 'object' && m.ac[0] !== null) m.ac[0].ac = newAc;
            else m.ac[0] = newAc;
        } else {
            m.ac = newAc;
        }

        m.hp = m.hp || {};
        m.hp.average = newHpAvg;
        m.hp.formula = newHpForm;
        
        // Auto-scale current HP if max changed
        if (char.hpMax !== newHpAvg) {
            if (char.hpMax > 0) {
                const ratio = char.hpCurrent / char.hpMax;
                char.hpCurrent = Math.max(1, Math.floor(newHpAvg * ratio));
            } else {
                char.hpCurrent = newHpAvg;
            }
            char.hpMax = newHpAvg;
        }

        // Core Stats
        content.querySelectorAll('.cs-edit-stat').forEach(input => {
            const stat = input.dataset.stat;
            m[stat] = parseInt(input.value) || 10;
        });

        // Defenses & Info
        const immuneStr = content.querySelector('#cs-edit-immune').value.trim();
        if (immuneStr) m.immune = immuneStr.split(',').map(s => s.trim()); else delete m.immune;

        const resistStr = content.querySelector('#cs-edit-resist').value.trim();
        if (resistStr) m.resist = resistStr.split(',').map(s => s.trim()); else delete m.resist;

        const vulnStr = content.querySelector('#cs-edit-vuln').value.trim();
        if (vulnStr) m.vulnerable = vulnStr.split(',').map(s => s.trim()); else delete m.vulnerable;

        const condStr = content.querySelector('#cs-edit-cond').value.trim();
        if (condStr) m.conditionImmune = condStr.split(',').map(s => s.trim()); else delete m.conditionImmune;

        const sensesStr = content.querySelector('#cs-edit-senses').value.trim();
        if (sensesStr) {
            m.senses = sensesStr.split(',').map(s => s.trim());
            
            // Sync with token vision
            let maxSight = 60; // default
            const sightMatches = sensesStr.match(/\d+/g);
            if (sightMatches) {
                maxSight = Math.max(...sightMatches.map(n => parseInt(n)));
            }
            char.tokenSight = maxSight;
        } else {
            delete m.senses;
            char.tokenSight = 60;
        }

        const langStr = content.querySelector('#cs-edit-lang').value.trim();
        if (langStr) m.languages = langStr.split(',').map(s => s.trim()); else delete m.languages;

        // Saves
        const newSaves = {};
        content.querySelectorAll('.cs-edit-save').forEach(input => {
            const val = input.value.trim();
            if (val) {
                newSaves[input.dataset.ability] = val;
            }
        });
        if (Object.keys(newSaves).length > 0) {
            m.save = newSaves;
        } else {
            delete m.save;
        }

        // Helper to extract abilities
        function extractAbilityList(containerId) {
            const rows = content.querySelectorAll('#' + containerId + ' > div');
            const arr = [];
            rows.forEach(r => {
                const name = r.querySelector('.edit-ab-name').value.trim();
                const desc = r.querySelector('.edit-ab-desc').value.trim();
                if (name || desc) {
                    arr.push({
                        name: name,
                        entries: desc ? desc.split('\\n') : []
                    });
                }
            });
            return arr.length > 0 ? arr : undefined;
        }

        const newTraits = extractAbilityList('cs-edit-traits-list');
        if (newTraits) m.trait = newTraits; else delete m.trait;

        const newActions = extractAbilityList('cs-edit-actions-list');
        if (newActions) m.action = newActions; else delete m.action;

        const newReactions = extractAbilityList('cs-edit-reactions-list');
        if (newReactions) m.reaction = newReactions; else delete m.reaction;

        const legDesc = content.querySelector('#cs-edit-legendary-desc').value.trim();
        if (legDesc) m.legendaryActions = legDesc; else delete m.legendaryActions;
        const newLegendary = extractAbilityList('cs-edit-legendary-list');
        if (newLegendary) m.legendary = newLegendary; else delete m.legendary;

        const lairDesc = content.querySelector('#cs-edit-lair-desc').value.trim();
        if (lairDesc) m.lairActionsDesc = lairDesc; else delete m.lairActionsDesc;
        const newLair = extractAbilityList('cs-edit-lair-list');
        if (newLair) m.lairActions = newLair; else delete m.lairActions;

        // Save back to char
        char.monsterData = m;

        // Sync to players
        window.VTT.socket.emit('character:update', { character: char });

        // Update UI
        if (overlay) overlay.remove();
        renderStatBlock(m);
        
        // window.VTT.socket.emit('chat:msg', {
        //     text: `*Companion **${char.name}** was updated.*`
        // });
    }

    function evaluateDiceHelper(formula, isCrit = false) {
        if (!formula) return { total: 0, diceList: [], isCritSuccess: false, isCritFail: false, breakdownStr: '' };
        const cleanForm = formula.replace(/\s+/g, '').toLowerCase();
        let total = 0;
        let diceList = [];
        let isCritSuccess = false;
        let isCritFail = false;

        let rollMode = window.VTT ? window.VTT.currentRollMode : 'normal';
        const evt = window.event;
        if (evt && evt.shiftKey) rollMode = 'adv';
        else if (evt && evt.ctrlKey) rollMode = 'dis';
        const isAdvantage = rollMode === 'adv';
        const isDisadvantage = rollMode === 'dis';
        
        const parts = cleanForm.split(/([+-])/);
        let sign = 1;
        let bdParts = [];

        for (let p of parts) {
            if (!p) continue;
            if (p === '+') { sign = 1; bdParts.push('+'); continue; }
            if (p === '-') { sign = -1; bdParts.push('-'); continue; }
            if (p.includes('d')) {
                const [countStr, faceStr] = p.split('d');
                let count = parseInt(countStr) || 1;
                const faces = parseInt(faceStr) || 20;

                let partDiceList = [];

                if (faces === 20 && count === 1 && (isAdvantage || isDisadvantage) && !isCrit) {
                    count = 2;
                    const roll1 = Math.floor(Math.random() * 20) + 1;
                    const roll2 = Math.floor(Math.random() * 20) + 1;
                    let keptRoll = roll1;
                    let droppedRoll = roll2;
                    
                    if (isAdvantage) {
                        if (roll2 > roll1) { keptRoll = roll2; droppedRoll = roll1; }
                    } else if (isDisadvantage) {
                        if (roll2 < roll1) { keptRoll = roll2; droppedRoll = roll1; }
                    }
                    
                    const keptObj = { val: keptRoll, type: 'd20' };
                    const droppedObj = { val: droppedRoll, type: 'd20', dropped: true };
                    
                    partDiceList.push(keptObj, droppedObj);
                    diceList.push(keptObj, droppedObj);
                    
                    if (keptRoll === 20) isCritSuccess = true;
                    if (keptRoll === 1) isCritFail = true;
                    total += sign * keptRoll;
                } else {
                    if (isCrit) {
                        count *= 2;
                    }
    
                    for (let i = 0; i < count; i++) {
                        const roll = Math.floor(Math.random() * faces) + 1;
                        if (faces === 20 && count === 1 && !isCrit) {
                            if (roll === 20) isCritSuccess = true;
                            if (roll === 1) isCritFail = true;
                        }
                        total += sign * roll;
                        const obj = { val: roll, type: `d${faces}` };
                        partDiceList.push(obj);
                        diceList.push(obj);
                    }
                }
                
                const partBd = partDiceList.map(d => d.dropped ? `(${d.val})` : d.val);
                bdParts.push(`[${partBd.join(', ')}]`);
            } else {
                const val = parseInt(p) || 0;
                total += sign * val;
                bdParts.push(val);
            }
        }

        return { total, diceList, isCritSuccess, isCritFail, breakdownStr: bdParts.join(' ') };
    }

    function extractSpellcastingStats(m) {
        let stats = { dc: 0, atk: 0, ability: 'INT', level: 1 };
        if (!m) return stats;
        
        let foundDc = false;
        let foundAtk = false;
        let foundLvl = false;
        
        if (m.spellcasting && m.spellcasting.length > 0) {
            for (let sc of m.spellcasting) {
                if (sc.headerEntries) {
                    const header = sc.headerEntries.join(' ');
                    const dcMatch = header.match(/DC\s+(\d+)/i);
                    if (dcMatch && !foundDc) {
                        stats.dc = parseInt(dcMatch[1]);
                        foundDc = true;
                    }
                    const atkMatch = header.match(/([\+\-]\d+)\s+to\s+hit/i);
                    if (atkMatch && !foundAtk) {
                        stats.atk = parseInt(atkMatch[1]);
                        foundAtk = true;
                    }
                    const abMatch = header.match(/ability\s+is\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
                    if (abMatch) {
                        stats.ability = abMatch[1].substring(0, 3).toUpperCase();
                    }
                    const lvlMatch = header.match(/(\d+)(?:st|nd|rd|th)-level spellcaster/i);
                    if (lvlMatch && !foundLvl) {
                        stats.level = parseInt(lvlMatch[1]);
                        foundLvl = true;
                    }
                }
            }
        }
        
        // Fallback calculation if explicit missing
        const crRaw = m.cr;
        let cr = 0;
        if (crRaw && crRaw.cr) cr = eval(crRaw.cr.replace('/', '.'));
        else if (typeof crRaw === 'string') cr = eval(crRaw.replace('/', '.'));
        const prof = Math.max(2, Math.floor((cr - 1) / 4) + 2);
        
        let abMod = 0;
        const abStatStr = stats.ability.toLowerCase();
        if (m[abStatStr]) {
            abMod = Math.floor((m[abStatStr] - 10) / 2);
        }
        
        if (!foundDc) stats.dc = 8 + prof + abMod;
        if (!foundAtk) stats.atk = prof + abMod;
        if (!foundLvl) {
            stats.level = cr > 0 ? Math.floor(cr) : 1;
            if (stats.level < 1) stats.level = 1;
        }
        
        return stats;
    }

    function ensureCreatureUpcastModal() {
        if (document.getElementById('modal-cs-upcast-prompt')) return;
        
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="modal-cs-upcast-prompt" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:300px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <h3 style="margin-top:0; color:var(--color-gold-base); font-size:1.1rem; border-bottom:1px solid var(--color-border-subtle); padding-bottom:8px;">Cast Spell</h3>
                <div style="margin-bottom:16px;">
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-muted);">Cast at Level</label>
                    <select id="cs-upcast-prompt-level" class="form-control" style="width:100%;"></select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-secondary btn-sm" id="cs-upcast-prompt-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="cs-upcast-prompt-cast">Cast</button>
                </div>
            </div>
        `;
        document.body.appendChild(container.firstElementChild);
    }

    function promptCreatureUpcastLevel(baseLvl, callback) {
        ensureCreatureUpcastModal();
        const modal = document.getElementById('modal-cs-upcast-prompt');
        const select = document.getElementById('cs-upcast-prompt-level');
        select.innerHTML = '';
        for (let i = baseLvl; i <= 9; i++) {
            select.innerHTML += `<option value="${i}">${i}${i===1?'st':i===2?'nd':i===3?'rd':'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
        }
        modal.classList.remove('vtt-hidden');
        
        const cleanup = () => {
            modal.classList.add('vtt-hidden');
            document.getElementById('cs-upcast-prompt-cast').removeEventListener('click', handleCast);
            document.getElementById('cs-upcast-prompt-cancel').removeEventListener('click', handleCancel);
        };
        const handleCast = () => {
            cleanup();
            callback(parseInt(select.value));
        };
        const handleCancel = () => {
            cleanup();
            callback(null);
        };
        
        document.getElementById('cs-upcast-prompt-cast').addEventListener('click', handleCast);
        document.getElementById('cs-upcast-prompt-cancel').addEventListener('click', handleCancel);
    }
    
    function getUpcastBonus(spData) {
        if (!spData.entriesHigherLevel) return null;
        const hl = JSON.stringify(spData.entriesHigherLevel).toLowerCase();
        let hlMatch = hl.match(/\{@scaledamage [^|]+\|[^|]+\|([^}]+)\}/);
        if (hlMatch) {
            return hlMatch[1];
        } else {
            hlMatch = hl.match(/increases by (?:\{@damage )?(\d+d\d+)/);
            if (hlMatch) {
                return hlMatch[1];
            } else {
                hlMatch = hl.match(/(\d+)d(\d+)/);
                if (hlMatch) {
                    return hlMatch[1] + 'd' + hlMatch[2];
                }
            }
        }
        return null;
    }

    function parseSpellMacro(spell, stats, charName, descHtml, castLvl) {
        const mc = {
            charName: charName || 'Creature',
            macroName: spell.name,
            atkRoll: null,
            saveInfo: null,
            dmgRolls: [],
            description: descHtml
        };
        
        // Parse Attack
        if (spell.spellAttack) {
            const mod = stats.atk;
            const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            const evalRoll = evaluateDiceHelper(formula);
            mc.atkRoll = {
                formula: formula,
                total: evalRoll.total,
                breakdownStr: evalRoll.breakdownStr,
                diceList: evalRoll.diceList,
                isCritSuccess: evalRoll.isCritSuccess,
                isCritFail: evalRoll.isCritFail
            };
        }
        
        // Parse Save DC
        if (spell.savingThrow && spell.savingThrow.length > 0) {
            mc.saveInfo = {
                dc: stats.dc,
                ability: spell.savingThrow[0].substring(0, 3).toUpperCase()
            };
            mc.target = `${mc.saveInfo.ability} Save DC ${mc.saveInfo.dc}`;
        }
        
        // Parse Damages
        const dmgRegex = /\{@damage ([^\}]+)\}(?:.*?([\w]+)\s+damage)?/gi;
        let rawString = JSON.stringify(spell.entries || []);
        let match;
        let isCrit = mc.atkRoll ? mc.atkRoll.isCritSuccess : false;
        
        // Quick extraction of damage types from the spell text nearby
        const typeRegex = /\{@damage [^\}]+\}\s+([a-zA-Z]+)\s+damage/gi;
        let typeMatches = [...rawString.matchAll(typeRegex)];
        let typeIdx = 0;
        
        // Cantrip Scaling Logic
        let cCount = 1;
        if (spell.level === 0) {
            if (stats.level >= 5) cCount = 2;
            if (stats.level >= 11) cCount = 3;
            if (stats.level >= 17) cCount = 4;
            
            // Do not scale dice count for these specific cantrips that scale by adding extra attacks/rays
            const noScaleDice = ['eldritch blast', 'magic stone'];
            if (noScaleDice.includes(spell.name.toLowerCase())) {
                cCount = 1;
            }
            
            // Strip out cantrip text that describes scaling to prevent duplicate damage fields
            rawString = rawString.replace(/This spell\\'s damage increases by.*?\]/g, '');
            rawString = rawString.replace(/This spell\\'s damage increases by.*?(?=")/g, '');
            rawString = rawString.replace(/\{\\"name\\":\\"Cantrip Upgrade\\".*?\}/g, '');
        }

        let upcastBonus = null;
        if (castLvl && castLvl > spell.level) {
            upcastBonus = getUpcastBonus(spell);
        }

        while ((match = dmgRegex.exec(rawString)) !== null) {
            let formula = match[1];
            
            if (cCount > 1) {
                if (formula.match(/(?:\d+\s*)?[dD]\s*\d+/)) {
                    formula = formula.replace(/(?:\d+\s*)?([dD]\s*\d+)/, `${cCount}$1`);
                }
            }

            // Upcast Logic
            if (upcastBonus && castLvl > spell.level) {
                const extra = castLvl - spell.level;
                const upcastMatch = upcastBonus.match(/(?:(\d+)\s*)?[dD]\s*(\d+)/);
                if (upcastMatch) {
                    const diceCount = upcastMatch[1] ? parseInt(upcastMatch[1]) : 1;
                    const extraDice = diceCount * extra;
                    const uSize = "d" + upcastMatch[2];
                    const diceRegex = new RegExp(`(?:(\\d+)\\s*)?[dD]\\s*${upcastMatch[2]}\\b`, 'i');
                    let m = formula.match(diceRegex);
                    if (m) {
                        const baseCount = m[1] ? parseInt(m[1]) : 1;
                        formula = formula.replace(diceRegex, `${baseCount + extraDice}${uSize}`);
                    }
                } else if (!isNaN(parseInt(upcastBonus))) {
                    formula += ` + ${parseInt(upcastBonus) * extra}`;
                }
            }
            
            let type = 'Damage';
            if (typeIdx < typeMatches.length) {
                 type = typeMatches[typeIdx][1].charAt(0).toUpperCase() + typeMatches[typeIdx][1].slice(1).toLowerCase();
                 typeIdx++;
            }
            const evalRoll = evaluateDiceHelper(formula, isCrit);
            mc.dmgRolls.push({
                type: type,
                formula: formula,
                roll: {
                    total: evalRoll.total,
                    formula: formula,
                    breakdownStr: evalRoll.breakdownStr,
                    diceList: evalRoll.diceList
                }
            });
        }
        
        return mc;
    }

    function parseActionMacro(abilityName, rawEntries, abilityText, charName) {
        const mc = {
            charName: charName || 'Creature',
            macroName: abilityName,
            atkRoll: null,
            saveInfo: null,
            dmgRolls: []
        };
        
        const rawString = typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries);
        let isCrit = false;
        
        // Parse Attack
        const atkMatch = rawString.match(/\{@hit ([\+\-]?\d+)\}/i) || rawString.match(/([\+\-]\d+) to hit/i);
        if (atkMatch) {
            const mod = parseInt(atkMatch[1]) || 0;
            const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            const evalRoll = evaluateDiceHelper(formula);
            mc.atkRoll = {
                formula: formula,
                total: evalRoll.total,
                breakdownStr: evalRoll.breakdownStr,
                diceList: evalRoll.diceList,
                isCritSuccess: evalRoll.isCritSuccess,
                isCritFail: evalRoll.isCritFail
            };
            isCrit = mc.atkRoll.isCritSuccess;
        }
        
        // Parse Save DC
        const saveMatch = rawString.match(/\{@dc (\d+)\}/i) || rawString.match(/DC (\d+) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
        if (saveMatch) {
            const dc = parseInt(saveMatch[1]);
            let ability = "Save";
            if (saveMatch[2]) {
                ability = saveMatch[2].substring(0, 3).toUpperCase();
            } else {
                const abilityMatch = rawString.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
                if (abilityMatch) ability = abilityMatch[1].substring(0, 3).toUpperCase();
            }
            mc.saveInfo = { dc, ability };
        }
        
        // Parse Damages
        const dmgRegex = /\{@damage ([^\}]+)\}(?:.*?([\w]+)\s+damage)?/gi;
        let match;
        const usedDamageTypes = new Set();
        while ((match = dmgRegex.exec(rawString)) !== null) {
            const formula = match[1];
            let type = match[2] ? match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase() : 'Slashing';
            if (!['Fire', 'Cold', 'Lightning', 'Thunder', 'Poison', 'Acid', 'Necrotic', 'Radiant', 'Force', 'Psychic', 'Slashing', 'Piercing', 'Bludgeoning', 'Healing'].includes(type)) {
                type = 'Slashing';
            }
            const evalRoll = evaluateDiceHelper(formula, isCrit);
            mc.dmgRolls.push({
                type: type,
                formula: formula,
                roll: {
                    total: evalRoll.total,
                    formula: formula,
                    breakdownStr: evalRoll.breakdownStr,
                    diceList: evalRoll.diceList
                }
            });
            usedDamageTypes.add(type);
        }
        
        // Fallback for non-tagged damage text like "5 (1d6 + 2) slashing damage"
        if (mc.dmgRolls.length === 0) {
            const fallbackDmgRegex = /\d+\s*\(([^)]+)\)\s+([a-zA-Z]+)\s+damage/gi;
            while ((match = fallbackDmgRegex.exec(rawString)) !== null) {
                const formula = match[1];
                let type = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
                const evalRoll = evaluateDiceHelper(formula, isCrit);
                mc.dmgRolls.push({
                    type: type,
                    formula: formula,
                    roll: {
                        total: evalRoll.total,
                        formula: formula,
                        breakdownStr: evalRoll.breakdownStr,
                        diceList: evalRoll.diceList
                    }
                });
            }
        }
        
        return mc;
    }
    function saveAndRenderNpcSpells(m) {
        if (!m) m = currentMonster;
        const spellsHtml = buildSpellcastingHtml(m);
        const tabSpells = document.getElementById('cs-tab-spells');
        if (tabSpells) {
            tabSpells.innerHTML = spellsHtml;
            setupCsSpellListeners();
        }
    }

    function setupCsSpellListeners() {
        const contentEl = document.getElementById('vtt-creature-sheet-panel');
        if (!contentEl) return;

        // Add
        contentEl.querySelectorAll('.cs-btn-add-spell').forEach(btn => btn.addEventListener('click', (e) => {
            if (!linkedCharacterId) return;
            const level = e.currentTarget.dataset.level;
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            if (char && window.VTTSpellManager) {
                window.VTTSpellManager.openModal(level, -1, currentMonster, (updatedMonster) => {
                    char.monsterData = updatedMonster;
                    window.VTT.socket.emit('character:update', { character: char });
                    const spellHtml = buildSpellcastingHtml(currentMonster);
                    const spellContainer = document.querySelector('.cs-spell-page')?.parentElement;
                    if (spellContainer) {
                        spellContainer.innerHTML = spellHtml;
                        setupCsSpellListeners();
                    }
                });
            }
        }));

        async function ensureSpellIsParsed(level, idx) {
            const m = currentMonster;
            if (!m || !m.spells || !m.spells[level] || !m.spells[level][idx]) return null;
            const sp = m.spells[level][idx];
            if (sp.macroPopulated) return sp;
            
            if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.getSpellCache && window.vttPlayerSheetAPI.parseSpellToMacro) {
                let spellCache = window.vttPlayerSheetAPI.getSpellCache();
                if (!spellCache && window.DataUtil && window.DataUtil.spell) {
                    spellCache = await window.DataUtil.spell.pLoadAll();
                    if (window.vttPlayerSheetAPI.setSpellCache) {
                        window.vttPlayerSheetAPI.setSpellCache(spellCache);
                    }
                }
                if (spellCache) {
                    const spData = spellCache.find(s => s.name.toLowerCase() === sp.name.toLowerCase());
                    if (spData) {
                        window.vttPlayerSheetAPI.parseSpellToMacro(spData, sp, true);
                        sp.macroPopulated = true;
                    }
                }
            }
            return sp;
        }

        // Ping Macro / Post Chat
        contentEl.querySelectorAll('.cs-spell-ping-macro').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const level = e.currentTarget.dataset.level;
            const idx = parseInt(e.currentTarget.dataset.idx);
            await ensureSpellIsParsed(level, idx);
            rollNpcSpell(level, idx, 'roll');
        }));
        contentEl.querySelectorAll('.cs-spell-macro-attack').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const level = e.currentTarget.dataset.level;
            const idx = parseInt(e.currentTarget.dataset.idx);
            await ensureSpellIsParsed(level, idx);
            rollNpcSpell(level, idx, 'attack');
        }));
        contentEl.querySelectorAll('.cs-spell-macro-damage').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const level = e.currentTarget.dataset.level;
            const idx = parseInt(e.currentTarget.dataset.idx);
            await ensureSpellIsParsed(level, idx);
            rollNpcSpell(level, idx, 'damage');
        }));
        contentEl.querySelectorAll('.cs-spell-post-chat').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = currentMonster.spells[level][idx];
            const item = e.currentTarget.closest('.cs-spell-item');
            const descEl = item.querySelector('.cs-spell-desc');
            
            const postToChat = (html) => {
                const meta = window.vttPlayerSheetAPI ? window.vttPlayerSheetAPI.getSpellMetaStrings(sp) : {};
                vtt.socket.emit('chat:msg', { abilityCard: { creatureName: currentMonster.name, abilityName: sp.name, text: html, ...meta } });
            };
            
            if (descEl.innerHTML.includes('Loading spell details...')) {
                const nameEl = item.querySelector('.cs-spell-name');
                const spellName = nameEl.textContent.trim();
                const spellCache = window.vttPlayerSheetAPI ? window.vttPlayerSheetAPI.getSpellCache() : null;
                
                if (!spellCache && window.DataUtil && window.DataUtil.spell) {
                    window.DataUtil.spell.pLoadAll().then(spells => {
                        if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.setSpellCache) {
                            window.vttPlayerSheetAPI.setSpellCache(spells);
                        }
                        if (window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderAndInjectSpell) {
                            window.vttPlayerSheetAPI.renderAndInjectSpell(spellName, descEl, sp.description || '', sp);
                        }
                        postToChat(descEl.innerHTML);
                    }).catch(() => postToChat(sp.description || ''));
                } else if (spellCache && window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderAndInjectSpell) {
                    window.vttPlayerSheetAPI.renderAndInjectSpell(spellName, descEl, sp.description || '', sp);
                    postToChat(descEl.innerHTML);
                } else postToChat(sp.description || '');
            } else {
                postToChat(descEl.innerHTML);
            }
        }));

        contentEl.querySelectorAll('.cs-spell-edit').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!linkedCharacterId) return; // Only Companions/Custom NPCs have editable spells
            
            const level = e.currentTarget.dataset.level;
            const idx = parseInt(e.currentTarget.dataset.idx);
            await ensureSpellIsParsed(level, idx);
            const char = window.VTT.campaignState.characters[linkedCharacterId];
            
            if (char && window.VTTSpellManager) {
                window.VTTSpellManager.openModal(level, idx, currentMonster, (updatedMonster) => {
                    char.monsterData = updatedMonster;
                    window.VTT.socket.emit('character:update', { character: char });
                    const spellHtml = buildSpellcastingHtml(currentMonster);
                    const spellContainer = document.querySelector('.cs-spell-page')?.parentElement;
                    if (spellContainer) {
                        spellContainer.innerHTML = spellHtml;
                        setupCsSpellListeners(); // Rebind listeners
                    }
                });
            }
        }));
    }

    function rollNpcSpell(level, idx, type) {
        const m = currentMonster;
        if (!m || !m.spells || !m.spells[level] || !m.spells[level][idx]) return;
        const sp = m.spells[level][idx];

        const getAbilityMod = (ab) => {
            const score = m[ab] || 10;
            return Math.floor((score - 10) / 2);
        };
        const pb = getProfBonus(m.cr ? (m.cr.cr || m.cr) : '0');
        const spellCastingMod = m.spellcasting && m.spellcasting[0] && m.spellcasting[0].ability ? getAbilityMod(m.spellcasting[0].ability) : getAbilityMod('int');

        let castLvl = level === 'cantrip' || level === 'legacy' ? 0 : parseInt(level.replace('level', ''));
        const baseLvl = castLvl;
        
        const emitSpell = (actualCastLvl) => {
            let atkRoll = null;
            let saveInfo = null;
            let dmgRolls = [];

            if ((type === 'roll' || type === 'attack') && ((sp.attackStat && sp.attackStat !== 'none') || sp.attackBonus)) {
                let formula = "1d20";
                if (sp.attackBonus) {
                    const bonusStr = String(sp.attackBonus).trim();
                    formula += bonusStr.startsWith('+') || bonusStr.startsWith('-') ? bonusStr : ` + ${bonusStr}`;
                } else {
                    const mod = sp.attackStat === 'spell' ? spellCastingMod : getAbilityMod(sp.attackStat);
                    formula += ` + ${mod}`;
                    if (sp.attackProf) formula += ` + ${pb}`;
                    if (sp.attackExtra) formula += ` + ${sp.attackExtra}`;
                }
                const res = window.vttPlayerSheetAPI.simulateRoll(formula);
                atkRoll = res;
            }

            if ((type === 'roll' || type === 'save') && sp.saveAbility) {
                let dc = 10;
                if (sp.saveDcCustom) {
                    dc = sp.saveDcCustom;
                } else {
                    const stat = sp.saveDcStat === 'spell' ? spellCastingMod : getAbilityMod(sp.saveDcStat || 'int');
                    const prof = sp.saveDcProf !== false ? pb : 0;
                    dc = 8 + prof + stat + (sp.saveDcExtra || 0);
                }
                saveInfo = { ability: sp.saveAbility, dc: dc };
            }

            if ((type === 'roll' || type === 'damage') && sp.damageList && sp.damageList.length > 0) {
                let dList = JSON.parse(JSON.stringify(sp.damageList));
                
                if (baseLvl === 0 && sp.cantripScale) {
                    const casterLvl = 1; 
                    let cCount = casterLvl >= 17 ? 4 : casterLvl >= 11 ? 3 : casterLvl >= 5 ? 2 : 1;
                    for (let d of dList) {
                        if (d.formula.match(/(?:\d+\s*)?[dD]\s*\d+/)) {
                            d.formula = d.formula.replace(/(?:\d+\s*)?([dD]\s*\d+)/, `${cCount}$1`);
                        }
                    }
                } 
                else if (actualCastLvl > baseLvl && sp.upcastBonus) {
                    const extra = actualCastLvl - baseLvl;
                    const upcastMatch = sp.upcastBonus.match(/(?:(\d+)\s*)?[dD]\s*(\d+)/);
                    if (upcastMatch) {
                        const diceCount = upcastMatch[1] ? parseInt(upcastMatch[1]) : 1;
                        const uSize = "d" + upcastMatch[2];
                        let merged = false;
                        for (let d of dList) {
                            const diceRegex = new RegExp(`(?:(\\d+)\\s*)?[dD]\\s*${upcastMatch[2]}\\b`, 'i');
                            let mMatch = d.formula.match(diceRegex);
                            if (mMatch) {
                                const baseCount = mMatch[1] ? parseInt(mMatch[1]) : 1;
                                d.formula = d.formula.replace(diceRegex, `${baseCount + (diceCount * extra)}${uSize}`);
                                merged = true;
                                break;
                            }
                        }
                        if (!merged) {

                            dList[0].formula += ` + ${diceCount * extra}${uSize}`;
                        }
                    } else if (!isNaN(parseInt(sp.upcastBonus))) {
                        dList[0].formula += ` + ${parseInt(sp.upcastBonus) * extra}`;
                    }
                }

                dList.forEach(d => {
                    let dform = d.formula;
                    if (d.stat && d.stat !== 'none') {
                        const mod = d.stat === 'spell' ? spellCastingMod : getAbilityMod(d.stat);
                        dform += ` + ${mod}`;
                    }
                    if (d.prof) dform += ` + ${pb}`;
                    if (d.extra) dform += ` + ${d.extra}`;
                    const res = window.vttPlayerSheetAPI.simulateRoll(dform);
                    dmgRolls.push({ formula: dform, type: d.type || '', roll: res });
                });
            }

            const meta = window.vttPlayerSheetAPI ? window.vttPlayerSheetAPI.getSpellMetaStrings(sp) : {};
            const card = {
                charName: m.name,
                macroName: sp.name,
                description: sp.macroDescription || '',
                atkRoll,
                saveInfo,
                dmgRolls,
                ...meta
            };

            if (saveInfo) card.target = `${saveInfo.ability} Save DC ${saveInfo.dc}`;
            
            window.VTT.socket.emit('chat:msg', { macroCard: card });
        };

        if (type !== 'attack' && type !== 'damage' && type !== 'save' && level !== 'cantrip' && level !== 'legacy' && sp.upcastBonus) {
            const rawLvl = parseInt(level.replace('level', ''));
            const upcastLvl = prompt(`Upcast ${sp.name}? Enter level (${rawLvl}-9) or leave empty for base.`, "");
            if (upcastLvl === null) return; 
            emitSpell(upcastLvl ? parseInt(upcastLvl) : rawLvl);
        } else {
            emitSpell(baseLvl);
        }
    }

// ─── Public API ───────────────────────────────────────────────────────────
    const api = {
        openSheet,
        saveAndRenderNpcSpells,
        openPanel,
        minimizePanel,
        openEditModal
    };
    window.vttCreatureSheetAPI = api;
    return api;
}
