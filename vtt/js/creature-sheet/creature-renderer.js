// ForgeDVTT Creature Sheet — Renderer Subsystem
// Handles panel DOM rendering, stat blocks, HP tracking, token avatars, legendary sections, and panel resizing.

import {
    buildTypeString,
    buildSpeedString,
    getProfBonus,
    buildSavesHtml,
    buildSkillsHtml,
    buildImmunityHtml,
    parse5eMarkup,
    injectDiceChips,
    formatRawEntry,
    isPassiveAbility,
    normalizeMonsterDamages,
    cleanTags,
    flattenEntriesToText
} from './creature-parser.js';

import {
    ensureSpellcastingFromTraits,
    buildSpellcastingHtml,
    wireSpellSlots,
    setupCsSpellListeners,
    showVttPrompt
} from './creature-spells.js';

import { wireInitiativeRoll, wireAbilityScoreClicks, getVisibilitySetting } from './creature-roller.js';

import { openEditModal } from './creature-editor.js';
import { openAssignPlayersModal } from '../player-sheet/vtt-sheet-modals.js';

export function setupPanelResizing(panel) {
    if (!panel || typeof window === 'undefined') return;

    const savedWidth = localStorage.getItem('vtt_cs_panel_width');
    if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 280) {
            panel.style.setProperty('--cs-panel-width', `${parsed}px`);
        }
    }

    let resizeHandle = panel.querySelector('.cs-resize-handle');
    if (!resizeHandle) {
        resizeHandle = document.createElement('div');
        resizeHandle.className = 'cs-resize-handle';
        resizeHandle.title = 'Drag border to resize creature sheet (double-click to reset)';
        panel.appendChild(resizeHandle);
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 320;

    resizeHandle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        isResizing = true;
        startX = e.clientX;
        const currentComputed = panel.getBoundingClientRect().width;
        startWidth = currentComputed || 320;
        panel.classList.add('is-resizing');
        resizeHandle.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
    });

    resizeHandle.addEventListener('pointermove', (e) => {
        if (!isResizing) return;
        const deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;
        const maxWidth = Math.min(window.innerWidth * 0.85, 1000);
        newWidth = Math.max(280, Math.min(newWidth, maxWidth));
        panel.style.setProperty('--cs-panel-width', `${Math.round(newWidth)}px`);
        if (window.VTT?.sheetDock?.updatePosition) window.VTT.sheetDock.updatePosition();
    });

    const stopResizing = (e) => {
        if (!isResizing) return;
        isResizing = false;
        panel.classList.remove('is-resizing');
        try {
            if (resizeHandle.hasPointerCapture(e.pointerId)) {
                resizeHandle.releasePointerCapture(e.pointerId);
            }
        } catch (err) { }
        const currentComputed = Math.round(panel.getBoundingClientRect().width);
        if (currentComputed >= 280) {
            localStorage.setItem('vtt_cs_panel_width', currentComputed);
        }
        if (window.VTT?.sheetDock?.updatePosition) window.VTT.sheetDock.updatePosition();
    };

    resizeHandle.addEventListener('pointerup', stopResizing);
    resizeHandle.addEventListener('pointercancel', stopResizing);

    resizeHandle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panel.style.setProperty('--cs-panel-width', '320px');
        localStorage.removeItem('vtt_cs_panel_width');
        if (window.VTT?.sheetDock?.updatePosition) window.VTT.sheetDock.updatePosition();
    });
}

export function generateArcaneTokenDataUrl(name, category = 'monster') {
    if (typeof document === 'undefined') return 'favicon.svg';
    const cleanName = (name || 'Creature').trim();
    const words = cleanName.split(/\s+/).filter(Boolean);
    let initials = words.length > 1 ? words[0][0] + words[1][0] : cleanName.slice(0, 2);
    initials = (initials || 'C').toUpperCase();

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'favicon.svg';

    const colors = {
        monster: '#dc2626',
        npc: '#9333ea',
        companion: '#eab308',
        player: '#2563eb'
    };
    const primaryColor = colors[category] || colors.monster;

    ctx.save();
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.clip();

    const bgGrad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    bgGrad.addColorStop(0, '#1c2436');
    bgGrad.addColorStop(0.7, '#0f1422');
    bgGrad.addColorStop(1, '#080c14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 128, 128);

    ctx.beginPath();
    ctx.arc(64, 64, 48, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(64, 64, 53, 0, Math.PI * 2);
    ctx.strokeStyle = `${primaryColor}55`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 36px "Cinzel", "Georgia", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillText(initials, 65, 66);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(initials, 64, 64);

    return canvas.toDataURL('image/png');
}

export function getMonsterImageUrl(m, ctx = {}) {
    if (!m) return generateArcaneTokenDataUrl('Creature', 'monster');
    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;

    // 1. If canvas token is linked, check token's explicit image/URL
    if (linkedTokenId && typeof window !== 'undefined' && window.VTT?.canvasEngine) {
        const canvasTokens = window.VTT.canvasEngine.getTokens();
        const token = canvasTokens ? canvasTokens[linkedTokenId] : null;
        if (token) {
            if (token.img) return token.img;
            if (token.imgUrl) return token.imgUrl;
            if (token.src) return token.src;
            if (token.tokenUrl) return token.tokenUrl;
        }
    }

    // 2. If campaign character is linked, check character's custom token artwork / avatar
    if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
        const char = window.VTT.campaignState.characters[linkedCharacterId];
        if (char) {
            if (char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex !== -1) {
                const idx = char.activeTokenIndex || 0;
                if (idx >= 0 && idx < char.tokenImages.length && char.tokenImages[idx]?.url) {
                    return char.tokenImages[idx].url;
                }
            }
            if (char.avatarUrl) return char.avatarUrl;
        }
    }

    // 3. Check direct tokenImg / tokenUrl / imgUrl properties on monster object
    if (m.tokenImg) return m.tokenImg;
    if (m.tokenUrl) return m.tokenUrl;
    if (m.imgUrl) return m.imgUrl;

    // 4. Use 5etools Renderer.monster.getTokenUrl(m) if available
    if (typeof window !== 'undefined' && window.Renderer?.monster?.getTokenUrl) {
        try {
            const rUrl = window.Renderer.monster.getTokenUrl(m);
            if (rUrl) return rUrl;
        } catch (e) {
            console.warn('[CreatureSheet] Renderer.monster.getTokenUrl failed', e);
        }
    }

    // 5. Fallback path generator based on 5etools naming conventions
    if (m.hasToken || m.source || m.name) {
        const cleanName =
            typeof window !== 'undefined' && window.Parser?.nameToTokenName
                ? window.Parser.nameToTokenName(m.name)
                : (m.name || '').replace(/"/g, '').trim();
        const source = m.source || 'MM';
        return `img/bestiary/tokens/${source}/${cleanName}.webp`;
    }

    return generateArcaneTokenDataUrl(m.name || 'Creature', 'monster');
}

export function getLinkedTokenHp(m, ctx = {}) {
    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    if (!linkedTokenId || typeof window === 'undefined' || !window.VTT?.canvasEngine) return null;
    const tokens = window.VTT.canvasEngine.getTokens();
    return tokens[linkedTokenId]?.hp ?? null;
}

export function getLinkedTokenTempHp(m, ctx = {}) {
    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
    if (linkedTokenId && typeof window !== 'undefined' && window.VTT?.canvasEngine) {
        const tokens = window.VTT.canvasEngine.getTokens();
        if (tokens[linkedTokenId]?.tempHp !== undefined) return tokens[linkedTokenId].tempHp;
    }
    if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
        const char = window.VTT.campaignState.characters[linkedCharacterId];
        if (char?.tempHp !== undefined) return char.tempHp;
    }
    return m.tempHp ?? 0;
}

export function wireHpControls(panel, m, initial, max, ctx = {}, initialTemp = 0) {
    const contentEl = panel || (ctx.getContentEl ? ctx.getContentEl() : document);
    let current = parseInt(initial) || 0;
    const maxHp = parseInt(max) || 0;
    let tempHp = parseInt(initialTemp) || 0;

    const currentEl = contentEl.querySelector
        ? contentEl.querySelector('#cs-hp-current')
        : document.getElementById('cs-hp-current');
    const barEl = contentEl.querySelector
        ? contentEl.querySelector('#cs-hp-bar')
        : document.getElementById('cs-hp-bar');
    const tempEl = contentEl.querySelector
        ? contentEl.querySelector('#cs-temp-hp-current')
        : document.getElementById('cs-temp-hp-current');
    const tempBarWrap = contentEl.querySelector
        ? contentEl.querySelector('#cs-temp-hp-bar-wrap')
        : document.getElementById('cs-temp-hp-bar-wrap');

    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;

    function updateDOMOnly() {
        if (currentEl) currentEl.textContent = current;
        if (tempEl) tempEl.textContent = tempHp;
        if (tempBarWrap) {
            tempBarWrap.style.display = tempHp > 0 ? 'block' : 'none';
        }
        if (barEl && maxHp > 0) {
            const pct = Math.max(0, Math.min(100, Math.round((current / maxHp) * 100)));
            barEl.style.width = `${pct}%`;
            barEl.className = 'cs-hp-bar-fill' + (pct <= 25 ? ' danger' : pct <= 50 ? ' injured' : '');
        }
    }

    function updateDisplay() {
        updateDOMOnly();

        // Sync to linked canvas token
        if (linkedTokenId && typeof window !== 'undefined' && window.VTT?.socket) {
            const canvasEngine = window.VTT.canvasEngine;
            if (canvasEngine) {
                const allTokens = canvasEngine.getTokens ? canvasEngine.getTokens() : {};
                const currentMapId = canvasEngine.getCurrentMapId ? canvasEngine.getCurrentMapId() : null;
                const token = allTokens[linkedTokenId];
                if (token) {
                    const prevHp = Number(token.hp);
                    const prevTemp = Number(token.tempHp || 0);

                    token.hp = current;
                    token.tempHp = tempHp;
                    window.VTT.socket.emit('token:update', { mapId: currentMapId, token });

                    const triggerDamageFX = canvasEngine.triggerDamageFXAnimation;
                    const triggerHealingFX = canvasEngine.triggerHealingFXAnimation;
                    const getTokenDims = canvasEngine.getTokenDrawDimensions || (() => ({ drawW: token.width || 50, drawH: token.height || 50 }));
                    const dims = getTokenDims(token);
                    const tx = token.x + (dims.drawW || 50) / 2;
                    const ty = token.y + (dims.drawH || 50) / 2;
                    const r = Math.max(dims.drawW || 50, dims.drawH || 50) / 2;

                    if (!isNaN(prevHp) && current !== prevHp) {
                        const delta = current - prevHp;
                        if (delta < 0) {
                            const dmg = Math.abs(delta);
                            if (typeof triggerDamageFX === 'function') {
                                triggerDamageFX(tx, ty, r, ['untyped'], { amount: dmg, tokenId: token.id });
                            }
                            window.VTT.socket.emit('tokens:damage_fx', {
                                mapId: currentMapId,
                                tokenIds: [token.id],
                                damageTypes: ['untyped'],
                                amount: dmg
                            });
                        } else if (delta > 0) {
                            if (typeof triggerHealingFX === 'function') {
                                triggerHealingFX(tx, ty, r, delta, { tokenId: token.id });
                            }
                            window.VTT.socket.emit('tokens:heal_fx', {
                                mapId: currentMapId,
                                tokenIds: [token.id],
                                amount: delta
                            });
                        }
                    }

                    if (!isNaN(prevTemp) && tempHp > prevTemp) {
                        const deltaTemp = tempHp - prevTemp;
                        if (typeof triggerHealingFX === 'function') {
                            triggerHealingFX(tx, ty, r, deltaTemp, { tokenId: token.id, isTempHp: true });
                        }
                        window.VTT.socket.emit('tokens:heal_fx', {
                            mapId: currentMapId,
                            tokenIds: [token.id],
                            amount: deltaTemp,
                            isTempHp: true
                        });
                    }

                    if (canvasEngine.renderAll) canvasEngine.renderAll();
                }
            }
        }
        // Sync to linked character (Companion or Named NPC)
        if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
            const comp = window.VTT.campaignState.characters[linkedCharacterId];
            if (comp && (!linkedTokenId || comp.isGeneric !== true)) {
                comp.hpCurrent = current;
                comp.tempHp = tempHp;
                if (window.VTT.socket) {
                    window.VTT.socket.emit('character:update', { character: comp });
                }
            }
        }
    }

    const minusBtn = contentEl.querySelector
        ? contentEl.querySelector('#cs-hp-minus')
        : document.getElementById('cs-hp-minus');
    const plusBtn = contentEl.querySelector
        ? contentEl.querySelector('#cs-hp-plus')
        : document.getElementById('cs-hp-plus');
    const tempMinusBtn = contentEl.querySelector
        ? contentEl.querySelector('#cs-temp-hp-minus')
        : document.getElementById('cs-temp-hp-minus');
    const tempPlusBtn = contentEl.querySelector
        ? contentEl.querySelector('#cs-temp-hp-plus')
        : document.getElementById('cs-temp-hp-plus');

    if (minusBtn) {
        minusBtn.addEventListener('click', () => {
            showVttPrompt('Damage amount:', '1', (val) => {
                if (val === null) return;
                const dmg = parseInt(val || '1');
                if (!isNaN(dmg) && dmg > 0) {
                    if (tempHp > 0) {
                        if (dmg <= tempHp) {
                            tempHp -= dmg;
                        } else {
                            const leftover = dmg - tempHp;
                            tempHp = 0;
                            current = Math.max(0, current - leftover);
                        }
                    } else {
                        current = Math.max(0, current - dmg);
                    }
                    updateDisplay();
                }
            });
        });
    }
    if (plusBtn) {
        plusBtn.addEventListener('click', () => {
            showVttPrompt('Heal amount:', '1', (val) => {
                if (val === null) return;
                const heal = parseInt(val || '1');
                if (!isNaN(heal) && heal > 0) {
                    current = Math.min(maxHp, current + heal);
                    updateDisplay();
                }
            });
        });
    }
    if (tempMinusBtn) {
        tempMinusBtn.addEventListener('click', () => {
            showVttPrompt('Reduce Temp HP by:', '1', (val) => {
                if (val === null) return;
                const reduce = parseInt(val || '1');
                if (!isNaN(reduce) && reduce > 0) {
                    tempHp = Math.max(0, tempHp - reduce);
                    updateDisplay();
                }
            });
        });
    }
    if (tempPlusBtn) {
        tempPlusBtn.addEventListener('click', () => {
            showVttPrompt('Add Temp HP:', '1', (val) => {
                if (val === null) return;
                const add = parseInt(val || '1');
                if (!isNaN(add) && add > 0) {
                    tempHp = Math.max(0, tempHp + add);
                    updateDisplay();
                }
            });
        });
    }

    // Listen for external token HP updates
    if (vtt && vtt.socket) {
        vtt.socket.on('token:updated', (data) => {
            if (linkedTokenId && data.tokens && data.tokens[linkedTokenId]) {
                const incomingHp = data.tokens[linkedTokenId].hp;
                const incomingTemp = data.tokens[linkedTokenId].tempHp ?? 0;
                let changed = false;
                if (incomingHp !== undefined && current !== incomingHp) {
                    current = incomingHp;
                    changed = true;
                }
                if (incomingTemp !== undefined && tempHp !== incomingTemp) {
                    tempHp = incomingTemp;
                    changed = true;
                }
                if (changed) updateDOMOnly();
            }
        });

        vtt.socket.on('character:updated', (data) => {
            if (linkedCharacterId && data.character && data.character.id === linkedCharacterId) {
                const incomingHp = data.character.hpCurrent;
                const incomingTemp = data.character.tempHp ?? 0;
                let changed = false;
                if (incomingHp !== undefined && current !== incomingHp) {
                    current = incomingHp;
                    changed = true;
                }
                if (incomingTemp !== undefined && tempHp !== incomingTemp) {
                    tempHp = incomingTemp;
                    changed = true;
                }
                if (changed) updateDOMOnly();
            }
        });
    }
}

export function wireTabs(panel) {
    if (!panel) return;
    const btns = panel.querySelectorAll('.cs-tab-btn');
    const contents = panel.querySelectorAll('.cs-tab-content');

    btns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            btns.forEach((b) => b.classList.remove('active'));
            contents.forEach((c) => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = panel.querySelector(`#cs-tab-${target}`);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

export function wireCollapsibleHandlers(panel) {
    if (!panel) return;

    // 1. Section Title Click (Collapse/Expand entire section category)
    panel.querySelectorAll('.cs-section-title').forEach((titleEl) => {
        titleEl.addEventListener('click', () => {
            const section = titleEl.closest('.cs-section');
            if (section) {
                section.classList.toggle('collapsed');
            }
        });
    });

    // 2. Card Header Click (Collapse/Expand individual card description)
    panel.querySelectorAll('.cs-ability-header').forEach((headerEl) => {
        headerEl.addEventListener('click', (e) => {
            if (
                e.target.closest('.cs-macro-trigger') ||
                e.target.closest('.cs-ability-info-btn') ||
                e.target.closest('button') ||
                e.target.closest('.dice-chip')
            ) {
                return;
            }
            const entry = headerEl.closest('.cs-ability-entry');
            if (entry) {
                entry.classList.toggle('expanded');
            }
        });
    });

    // 3. Global Expand All / Collapse All Button
    const toggleAllBtn = panel.querySelector('#cs-toggle-all-btn');
    if (toggleAllBtn) {
        let isAllExpanded = false;
        toggleAllBtn.addEventListener('click', () => {
            isAllExpanded = !isAllExpanded;

            panel.querySelectorAll('.cs-section').forEach((sec) => {
                if (isAllExpanded) sec.classList.remove('collapsed');
                else sec.classList.add('collapsed');
            });

            panel.querySelectorAll('.cs-ability-entry').forEach((card) => {
                if (isAllExpanded) card.classList.add('expanded');
                else card.classList.remove('expanded');
            });

            const icon = toggleAllBtn.querySelector('i');
            const textSpan = toggleAllBtn.querySelector('span');
            if (isAllExpanded) {
                if (icon) icon.className = 'fa-solid fa-angles-up';
                if (textSpan) textSpan.textContent = 'Collapse All';
            } else {
                if (icon) icon.className = 'fa-solid fa-angles-down';
                if (textSpan) textSpan.textContent = 'Expand All';
            }
        });
    }
}

export function extractLairTitle(text) {
    if (!text || typeof text !== 'string') return '';
    const boldMatch = text.match(/^\{@b\s+([^}]+)\}\.?\s*(.*)/i) || text.match(/^\*\*([^*]+)\*\*\.?\s*(.*)/i);
    if (boldMatch) return cleanTags(boldMatch[1]).replace(/\.$/, '').trim();
    const spellMatch = text.match(/(?:casts?|uses?)\s+\{@spell\s+([^}|]+)/i);
    if (spellMatch) return `Cast ${spellMatch[1].trim()}`;
    const firstClause = text
        .split(/[.,;]/)[0]
        .trim()
        .replace(/^\{@[^}]+\}\s*/, '');
    let words = firstClause.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
        if (/^(a|an|the|until)$/i.test(words[0])) words.shift();
        const stopWords = new Set([
            'from',
            'in',
            'of',
            'at',
            'on',
            'to',
            'within',
            'with',
            'by',
            'around',
            'into',
            'for',
            'a',
            'an',
            'the'
        ]);
        words = words.slice(0, 3);
        while (words.length > 1 && stopWords.has(words[words.length - 1].toLowerCase())) words.pop();
        const shortName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (shortName.length >= 3) return shortName;
    }
    return '';
}

export function buildAbilityEntryHtml(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') {
        const extName = extractLairTitle(entry) || 'Effect';
        entry = { name: extName, entries: [entry], descriptionHtml: `<p>${entry}</p>` };
    }
    let rawEntries = entry.entries;
    if (!rawEntries && entry.entry) rawEntries = [entry.entry];
    if (!rawEntries) rawEntries = [];

    let name = entry.name || '';
    if (!name && rawEntries.length > 0) {
        const firstText = typeof rawEntries[0] === 'string' ? rawEntries[0] : JSON.stringify(rawEntries[0]);
        name = extractLairTitle(firstText) || '';
    }

    const textLines = rawEntries.map((e) => formatRawEntry(e)).join(' ');
    const cleanText = parse5eMarkup(textLines);
    const displayText = entry.descriptionHtml
        ? injectDiceChips(parse5eMarkup(entry.descriptionHtml))
        : injectDiceChips(cleanText);

    const parsedName = name ? parse5eMarkup(name) : '';
    const nameHtml = parsedName
        ? parsedName
        : `<span style="color:var(--color-primary); font-size:0.85em;"><i class="fa-solid fa-tower-broadcast"></i> Action</span>`;

    const rawJson = encodeURIComponent(JSON.stringify(rawEntries));
    const macroJson = entry.macro ? encodeURIComponent(JSON.stringify(entry.macro)) : '';
    const isPassive = isPassiveAbility(name, rawEntries, cleanText, entry.macro);

    const nameSectionHtml = isPassive
        ? `
        <div class="cs-ability-name cs-passive-trigger" title="Click to expand details" style="cursor: pointer; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;">
            ${nameHtml} <span class="badge" style="background: rgba(255,255,255,0.08); color: var(--color-text-muted); font-size: 0.65rem; padding: 1px 6px; border-radius: 10px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px;">Passive</span>
        </div>
    `
        : `
        <div class="cs-ability-name cs-macro-trigger" title="Click to roll macro" style="cursor: pointer; flex: 0 0 auto;">
            ${nameHtml} <i class="fa-solid fa-dice-d20" style="font-size: 0.85em; opacity: 0.6; margin-left: 2px;"></i>
        </div>
    `;

    return `
        <div class="cs-ability-entry">
            <div class="cs-ability-header">
                <i class="cs-card-chevron fa-solid fa-chevron-right"></i>
                ${nameSectionHtml}
                <div class="cs-ability-info-btn" title="Ping description to chat" style="cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; transition: background 0.2s, color 0.2s; margin-left: auto;">
                    <i class="fa-solid fa-comment-dots"></i>
                </div>
            </div>
            <div class="cs-ability-text">${displayText}</div>
            <div class="cs-ability-raw" style="display:none;">${rawJson}</div>
            <div class="cs-ability-macro" style="display:none;">${macroJson}</div>
        </div>
    `;
}

export function buildAbilitySection(title, list) {
    if (!list || list.length === 0) return '';
    const rows = list.map((entry) => buildAbilityEntryHtml(entry)).join('');
    return `
        <div class="cs-section">
            <h3 class="cs-section-title"><i class="fa-solid fa-bolt"></i> <span>${title}</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
            <div class="cs-section-content">
                ${rows}
            </div>
        </div>
    `;
}

export function buildLegendarySection(m) {
    let html = '';
    const legEntries = Array.isArray(m.legendaryActions)
        ? m.legendaryActions
        : Array.isArray(m.legendaryActions?.entries)
            ? m.legendaryActions.entries
            : Array.isArray(m.legendary)
                ? m.legendary
                : [];
    if (legEntries && legEntries.length > 0) {
        const lairBadge = m.legendaryActionsLair
            ? ` <span class="badge" style="font-size:0.75rem; background:rgba(255,215,0,0.15); color:#ffd700; border:1px solid rgba(255,215,0,0.4); border-radius:3px; padding:1px 5px; margin-left:6px;">${m.legendaryActions?.count || 3} (${m.legendaryActionsLair} in Lair)</span>`
            : '';
        const legDesc = m.legendaryActions?.description
            ? `<p class="cs-legendary-desc">${m.legendaryActions.description}</p>`
            : m.legendaryHeader
                ? `<p class="cs-legendary-desc">${cleanTags(flattenEntriesToText(m.legendaryHeader))}</p>`
                : '';
        const rows = legEntries.map((entry) => buildAbilityEntryHtml(entry)).join('');
        html += `
            <div class="cs-section cs-legendary-section">
                <h3 class="cs-section-title"><i class="fa-solid fa-crown"></i> <span>Legendary Actions</span>${lairBadge} <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${legDesc}
                    ${rows}
                </div>
            </div>
        `;
    }

    const mythicEntries = Array.isArray(m.mythicActions)
        ? m.mythicActions
        : Array.isArray(m.mythicActions?.entries)
            ? m.mythicActions.entries
            : Array.isArray(m.mythic)
                ? m.mythic
                : [];
    if (mythicEntries && mythicEntries.length > 0) {
        const mythicDesc = m.mythicActions?.description
            ? `<p class="cs-legendary-desc">${m.mythicActions.description}</p>`
            : m.mythicHeader
                ? `<p class="cs-legendary-desc">${cleanTags(flattenEntriesToText(m.mythicHeader))}</p>`
                : '';
        const rows = mythicEntries.map((entry) => buildAbilityEntryHtml(entry)).join('');
        html += `
            <div class="cs-section cs-mythic-section" style="margin-top:12px;">
                <h3 class="cs-section-title"><i class="fa-solid fa-dragon"></i> <span>Mythic Actions</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${mythicDesc}
                    ${rows}
                </div>
            </div>
        `;
    }

    const lairEntries = Array.isArray(m.lairActions)
        ? m.lairActions
        : Array.isArray(m.lairActions?.entries)
            ? m.lairActions.entries
            : Array.isArray(m.lair)
                ? m.lair
                : [];
    if (lairEntries && lairEntries.length > 0) {
        const lairDesc =
            m.lairHeader ||
            m.lairActionsDesc ||
            (m.lairActions?.header ? cleanTags(flattenEntriesToText(m.lairActions.header)) : '');
        const rows = lairEntries.map((entry) => buildAbilityEntryHtml(entry)).join('');
        html += `
            <div class="cs-section cs-lair-section" style="margin-top:12px;">
                <h3 class="cs-section-title"><i class="fa-solid fa-mountain-sun"></i> <span>Lair Actions</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${lairDesc ? `<p class="cs-legendary-desc">${lairDesc}</p>` : ''}
                    ${rows}
                </div>
            </div>
        `;
    }

    return html;
}

export function buildVariantSection(m) {
    const variantList = m.variants || (m.variant && Array.isArray(m.variant) ? m.variant : []);
    if (!variantList || variantList.length === 0) return '';

    const rows = variantList
        .map((v) => {
            if (!v) return '';
            const name = v.name || 'Variant';
            const entries = v.entries || (v.entry ? [v.entry] : []);
            const descriptionHtml = v.descriptionHtml || (typeof v === 'string' ? `<p>${v}</p>` : '');

            return buildAbilityEntryHtml({
                name,
                entries,
                descriptionHtml,
                actionType: 'variant'
            });
        })
        .filter(Boolean)
        .join('');

    return `
        <div class="cs-section cs-variant-section" style="margin-top:12px;">
            <h3 class="cs-section-title"><i class="fa-solid fa-masks-theater"></i> <span>Variant Traits</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
            <div class="cs-section-content">
                ${rows}
            </div>
        </div>
    `;
}

export function saveMonsterData(m, ctx = {}) {
    const curM = m || (ctx.getMonster ? ctx.getMonster() : null);
    if (!curM) return;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;

    if (linkedCharacterId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters) {
        const char = window.VTT.campaignState.characters[linkedCharacterId];
        if (char) {
            char.monsterData = curM;
            if (curM.spells) char.spells = curM.spells;
            window.VTT.socket?.emit('character:update', { character: char });
        }
    } else if (linkedTokenId && typeof window !== 'undefined' && window.VTT?.canvasEngine) {
        const token = window.VTT.canvasEngine.getTokens()[linkedTokenId];
        if (token) {
            token.monsterData = curM;
            if (curM.spells) token.spells = curM.spells;
            const curMapId =
                window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
            window.VTT.socket?.emit('token:update', { mapId: curMapId, token: token });
        }
    } else if (typeof window !== 'undefined' && window.VTT?.currentToken) {
        window.VTT.currentToken.monsterData = curM;
        if (curM.spells) window.VTT.currentToken.spells = curM.spells;
        const curMapId =
            window.VTT?.canvasEngine?.getCurrentMapId?.() || window.VTT?.canvasEngine?.currentMap?.id || null;
        window.VTT.socket?.emit('token:update', { mapId: curMapId, token: window.VTT.currentToken });
    }
}

export function renderStatBlock(m, panel = null, ctx = {}) {
    const contentEl =
        panel || (ctx.getContentEl ? ctx.getContentEl() : document.getElementById('vtt-creature-sheet-panel'));
    if (!contentEl) return;

    const linkedTokenId = ctx.getLinkedTokenId ? ctx.getLinkedTokenId() : null;
    const linkedCharacterId = ctx.getLinkedCharacterId ? ctx.getLinkedCharacterId() : null;
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;

    const crStr = m.cr ? (typeof m.cr === 'object' ? m.cr.cr : m.cr) : '0';
    const typeStr = buildTypeString(m);
    const hpCurrent = linkedTokenId ? (getLinkedTokenHp(m, ctx) ?? (m.hp?.average || 0)) : m.hp?.average || 0;
    const hpMax = m.hp?.average || 0;
    const hpFormula = m.hp?.formula || '';
    const hpTemp = getLinkedTokenTempHp(m, ctx) || 0;
    const ac = Array.isArray(m.ac) ? m.ac[0] : m.ac;
    const acValue = typeof ac === 'object' ? (ac.value ?? ac.ac ?? m.primaryAc ?? '—') : (ac ?? m.primaryAc ?? '—');
    const acFrom =
        typeof ac === 'object' && ac.from ? ` (${Array.isArray(ac.from) ? ac.from.join(', ') : ac.from})` : '';
    const speed = buildSpeedString(m.speed);
    const profBonus = getProfBonus(crStr);

    const dexScore = m.dex ?? m.abilities?.dex?.score ?? 10;
    let initMod = Math.floor((dexScore - 10) / 2);
    if (m.initiative !== undefined) {
        if (typeof m.initiative === 'number') initMod = m.initiative;
        else if (typeof m.initiative?.bonus === 'number') initMod = m.initiative.bonus;
    }
    const initModStr = initMod >= 0 ? `+${initMod}` : `${initMod}`;

    const abilityScores = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const abilityLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

    const abilityGrid = abilityScores
        .map((ab, i) => {
            const score = m[ab] ?? m.abilities?.[ab]?.score ?? 10;
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
        })
        .join('');

    const saves = buildSavesHtml(m);
    const skills = buildSkillsHtml(m);
    const immunities = buildImmunityHtml(m);
    const traits = buildAbilitySection('Traits', m.traits || m.trait);
    const actions = buildAbilitySection('Actions', m.actions || m.action);
    const bonus = buildAbilitySection('Bonus Actions', m.bonusActions || m.bonus);
    const reactions = buildAbilitySection('Reactions', m.reactions || m.reaction);
    const legendary = buildLegendarySection(m);
    const variants = buildVariantSection(m);

    const isEditableCreature = Boolean(linkedCharacterId || m.isCustomNpc || m.isCompanion);
    ensureSpellcastingFromTraits(m);
    const hasSpells =
        isEditableCreature ||
        (m.spellcasting && m.spellcasting.length > 0) ||
        (m.spells && Object.values(m.spells).some((arr) => Array.isArray(arr) && arr.length > 0)) ||
        (m.slots && Object.keys(m.slots).length > 0) ||
        (m.spellSlots && Object.keys(m.spellSlots).length > 0);
    let tabsHtml = '';
    let spellsHtml = '';

    if (hasSpells) {
        tabsHtml = `
            <div class="cs-tabs">
                <div class="cs-tab-btn active" data-tab="stats">Stats</div>
                <div class="cs-tab-btn" data-tab="spells">Spells</div>
            </div>
        `;
        try {
            spellsHtml = buildSpellcastingHtml(m, linkedCharacterId);
        } catch (err) {
            console.error('[CreatureSheet] Error building spellcasting HTML:', err);
            spellsHtml = `<div class="alert alert-warning" style="padding:12px; background:rgba(255,165,0,0.15); border:1px solid orange; border-radius:4px; color:#ffcc00;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>Could not format spellcasting list: ${err.message}</div>`;
        }
    }

    let editBtnHtml = '';
    const activeCharId =
        linkedCharacterId ||
        (linkedTokenId &&
            typeof window !== 'undefined' &&
            window.VTT?.canvasEngine?.getTokens()?.[linkedTokenId]?.sourceCharacterId);
    const char =
        activeCharId && typeof window !== 'undefined' && window.VTT?.campaignState?.characters
            ? window.VTT.campaignState.characters[activeCharId]
            : null;
    if (char && char.name && m.name !== char.name) {
        m.name = char.name;
    }
    if (char) {
        normalizeMonsterDamages(m);
    }
    if (
        char &&
        typeof window !== 'undefined' &&
        (window.VTT?.role === 'GM' ||
            (char.assignedPlayers &&
                (char.assignedPlayers.includes(window.VTT?.username) || char.assignedPlayers.includes('*'))))
    ) {
        editBtnHtml = `<button class="btn btn-xs btn-secondary cs-edit-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;" title="Edit Creature Stats"><i class="fa-solid fa-pen-to-square"></i> <span>Edit</span></button>`;
    }

    let assignBtnHtml = '';
    if (char && typeof window !== 'undefined' && window.VTT?.role === 'GM') {
        assignBtnHtml = `<button class="btn btn-xs btn-secondary cs-assign-players-btn" id="cs-assign-players-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;" title="Assign Players to this ${char.isCompanion ? 'Companion' : 'Sheet'}"><i class="fa-solid fa-users"></i> <span>Assign</span></button>`;
    }

    const showGenericNamedToggle = Boolean(
        typeof window !== 'undefined' &&
        window.VTT?.role === 'GM' &&
        ((activeCharId && char) || m.isCustomNpc || m.isCompanion)
    );
    const isGeneric = char ? char.isGeneric === true : m.isGeneric === true;

    const genericNamedToggleHtml = showGenericNamedToggle
        ? `
        <button id="cs-generic-named-toggle" class="btn btn-xs ${isGeneric ? 'btn-secondary' : 'btn-primary'}" title="Entity Type: ${isGeneric ? 'Generic (independent instanced tokens on canvas)' : 'Named (linked to central sheet)'}. Click to toggle." style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;">
            <i class="${isGeneric ? 'fa-solid fa-people-group' : 'fa-solid fa-street-view'}"></i>
            <span>${isGeneric ? 'Generic' : 'Named'}</span>
        </button>
    `
        : '';

    const curVis = getVisibilitySetting(ctx);
    const rollVisToggleHtml = `
        <button id="cs-roll-vis-toggle" class="btn btn-xs ${curVis === 'private' ? 'btn-danger' : 'btn-secondary'}" title="Roll Visibility: ${curVis === 'private' ? 'GM Secret' : 'Public'}. Click to toggle." style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;">
            <i class="${curVis === 'private' ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}"></i>
            <span>${curVis === 'private' ? 'GM Secret' : 'Public'}</span>
        </button>
    `;

    const popoutBtnHtml =
        vtt && !vtt.isStandaloneSheet
            ? `<button class="cs-popout-btn btn btn-icon btn-secondary btn-xs" id="cs-btn-popout" title="Open Sheet in New Tab"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`
            : '';

    const tokenUrl = getMonsterImageUrl(m, ctx);
    const cleanUrl = (tokenUrl || '').split('?')[0].toLowerCase();
    const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
    const isYoutube =
        tokenUrl &&
        (tokenUrl.includes('youtube.com/embed') ||
            tokenUrl.includes('youtube.com/watch') ||
            tokenUrl.includes('youtu.be/'));

    let portraitMediaHtml = '';
    if (isVideo) {
        portraitMediaHtml = `<video src="${tokenUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;"></video>`;
    } else if (isYoutube) {
        let ytUrl = tokenUrl;
        const ytMatch = tokenUrl.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
        );
        if (ytMatch) {
            const videoId = ytMatch[1];
            ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
        }
        portraitMediaHtml = `<iframe src="${ytUrl}" frameborder="0" allow="autoplay; encrypted-media" style="width:100%; height:100%; pointer-events:none; border:none;"></iframe>`;
    } else {
        const safeName = (m.name || 'Creature').replace(/'/g, "\\'");
        const safeTokenUrl =
            typeof window !== 'undefined' && typeof window.getSafeVttUrl === 'function'
                ? window.getSafeVttUrl(tokenUrl)
                : tokenUrl;
        portraitMediaHtml = `<img src="${safeTokenUrl}" alt="${m.name}" onerror="if (window.VTT?.generateArcaneToken) { this.src = window.VTT.generateArcaneToken('${safeName}', 'monster'); } else { this.src = 'favicon.svg'; }" style="width:100%; height:100%; object-fit:cover; display:block;">`;
    }

    contentEl.innerHTML = `
        <!-- Top Toolbar -->
        <div class="cs-top-toolbar">
            <div class="cs-top-toolbar-group">
                ${genericNamedToggleHtml}
                ${rollVisToggleHtml}
            </div>
            <div class="cs-top-toolbar-group">
                ${assignBtnHtml}
                ${editBtnHtml}
                ${popoutBtnHtml}
            </div>
        </div>

        <!-- Header -->
        <div class="cs-header">
            <div class="cs-token-portrait">
                ${portraitMediaHtml}
            </div>
            <div class="cs-header-info">
                <h2 class="cs-creature-name">${m.name}</h2>
                <p class="cs-creature-type">${typeStr}</p>
                <div class="cs-header-meta">
                    <div class="cs-cr-badge">CR ${crStr}</div>
                </div>
            </div>
        </div>

        ${tabsHtml}

        <div id="cs-tab-stats" class="cs-tab-content active">
            <!-- HP Row -->
            <div class="cs-hp-row">
                <div style="display: flex; gap: 4px; margin-bottom: 8px; align-items: center; width: 100%;">
                    <div class="cs-hp-bar-wrap" style="flex: 1;">
                        <div class="cs-hp-bar-fill" id="cs-hp-bar" style="width: ${hpMax > 0 ? Math.round((hpCurrent / hpMax) * 100) : 100}%"></div>
                    </div>
                    <div class="cs-hp-bar-wrap cs-temp-hp-bar-wrap" id="cs-temp-hp-bar-wrap" style="flex: 0 0 20%; display: ${hpTemp > 0 ? 'block' : 'none'};" title="Temp HP">
                        <div class="cs-hp-bar-fill cs-temp-hp-bar-fill" id="cs-temp-hp-bar" style="width: 100%;"></div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div class="cs-hp-label" style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; color: var(--color-text-secondary); margin-bottom: 0;">
                            <i class="fa-solid fa-heart" style="color: #e53935; font-size: 0.85rem;"></i> HP
                        </div>
                        <div class="cs-hp-controls" style="margin-bottom: 0;">
                            <button class="cs-hp-btn" id="cs-hp-minus" title="Damage">−</button>
                            <div class="cs-hp-display" style="min-width: 60px;">
                                <span id="cs-hp-current">${hpCurrent}</span>
                                <span class="cs-hp-divider">/</span>
                                <span id="cs-hp-max">${hpMax}</span>
                            </div>
                            <button class="cs-hp-btn" id="cs-hp-plus" title="Heal">+</button>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div class="cs-hp-label" style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; color: var(--color-text-secondary); margin-bottom: 0;">
                            <i class="fa-solid fa-shield" style="color: var(--color-temphp-base, #2196f3); font-size: 0.85rem;"></i> Temp
                        </div>
                        <div class="cs-hp-controls" style="margin-bottom: 0;">
                            <button class="cs-hp-btn" id="cs-temp-hp-minus" title="Reduce Temp HP">−</button>
                            <div class="cs-hp-display" style="min-width: 28px;">
                                <span id="cs-temp-hp-current">${hpTemp}</span>
                            </div>
                            <button class="cs-hp-btn" id="cs-temp-hp-plus" title="Add Temp HP">+</button>
                        </div>
                    </div>
                </div>
                ${hpFormula ? `<div style="width: 100%; margin-top: 4px;"><span class="cs-hp-formula">${injectDiceChips(hpFormula)}</span></div>` : ''}
            </div>

            <!-- Dedicated Combat Stats Row (AC & Initiative) -->
            <div class="cs-combat-stats-row">
                <div class="cs-combat-stat-card">
                    <i class="fa-solid fa-shield-halved cs-combat-stat-icon"></i>
                    <div class="cs-combat-stat-content">
                        <span class="cs-combat-stat-label">Armor Class</span>
                        <span class="cs-combat-stat-value">${acValue}${acFrom}</span>
                    </div>
                </div>
                <div class="cs-combat-stat-card cs-combat-stat-btn cs-roll-initiative-btn" style="cursor: pointer;" title="Roll Initiative">
                    <i class="fa-solid fa-dice-d20 cs-combat-stat-icon" style="color: var(--color-gold-base);"></i>
                    <div class="cs-combat-stat-content">
                        <span class="cs-combat-stat-label">Initiative</span>
                        <span class="cs-combat-stat-value">${initModStr}</span>
                    </div>
                </div>
            </div>

            <!-- Secondary Core Stats Pills -->
            <div class="cs-core-stats">
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

            <!-- Global Collapse Control -->
            <div style="display: flex; justify-content: flex-end; padding: 6px 16px 2px 16px;">
                <button id="cs-toggle-all-btn" class="btn btn-secondary btn-xxs" style="font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Expand or collapse all sections and cards">
                    <i class="fa-solid fa-angles-down"></i> <span>Expand All</span>
                </button>
            </div>

            <!-- Traits / Actions / Reactions / Legendary -->
            ${traits}
            ${actions}
            ${bonus}
            ${reactions}
            ${legendary}
            ${variants}
        </div>

        ${hasSpells ? `<div id="cs-tab-spells" class="cs-tab-content">${spellsHtml}</div>` : ''}
    `;

    // Wire HP stepper buttons
    wireHpControls(contentEl, m, hpCurrent, hpMax, ctx, hpTemp);

    // Wire ability score chips (for rolling ability checks)
    wireAbilityScoreClicks(contentEl, m, ctx);

    // Wire Initiative Roll
    wireInitiativeRoll(contentEl, m, ctx);

    // Wire Collapsible Sections and Cards
    wireCollapsibleHandlers(contentEl);

    // Wire Tabs
    if (hasSpells) {
        wireTabs(contentEl);
        wireSpellSlots(contentEl, m, ctx);
        setupCsSpellListeners(contentEl, m, ctx);
    }

    // Wire Assign Players Button (Companions / Characters)
    const assignBtn = contentEl.querySelector('#cs-assign-players-btn');
    if (assignBtn && char) {
        assignBtn.addEventListener('click', () => {
            openAssignPlayersModal(char, vtt || window.VTT, (updatedChar) => {
                if (vtt?.socket || window.VTT?.socket) {
                    (vtt?.socket || window.VTT.socket).emit('character:update', { character: updatedChar });
                }
                // Sync assigned players to any tokens on canvas
                if (window.VTT?.canvasEngine) {
                    const tokens = window.VTT.canvasEngine.getTokens();
                    const currentMapId = window.VTT.canvasEngine.getCurrentMapId ? window.VTT.canvasEngine.getCurrentMapId() : null;
                    Object.values(tokens).forEach((t) => {
                        if (t.characterId === updatedChar.id || t.id === linkedTokenId) {
                            t.assignedPlayers = [...(updatedChar.assignedPlayers || [])];
                            if (window.VTT?.socket) {
                                window.VTT.socket.emit('token:update', { mapId: currentMapId, token: t });
                            }
                        }
                    });
                }
                if (window.VTT?.playerSheet?.renderCharacterList) {
                    window.VTT.playerSheet.renderCharacterList();
                }
            });
        });
    }

    // Wire Edit Button
    const editBtn = contentEl.querySelector('.cs-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            openEditModal(m, activeCharId, ctx);
        });
    }

    // Wire Pop-Out Button
    const popoutBtn = contentEl.querySelector('#cs-btn-popout');
    if (popoutBtn) {
        popoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window !== 'undefined' && window.SheetWindowManager) {
                let sheetType = 'creature';
                const targetChar = activeCharId && window.VTT?.campaignState?.characters?.[activeCharId];
                if (targetChar) {
                    if (targetChar.isCompanion) sheetType = 'companion';
                    else if (targetChar.isCustomNpc) sheetType = 'npc';
                }
                window.SheetWindowManager.openPopout({
                    type: sheetType,
                    tokenId: linkedTokenId,
                    characterId: linkedCharacterId || activeCharId,
                    name: m.name,
                    source: m.source,
                    monsterData: m
                });
                if (ctx.minimizePanel) ctx.minimizePanel();
            }
        });
    }

    // Wire Roll Visibility Quick-Toggle Pill
    const visToggleBtn = contentEl.querySelector('#cs-roll-vis-toggle');
    if (visToggleBtn) {
        visToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentVis = getVisibilitySetting(ctx);
            const nextVis = currentVis === 'private' ? 'public' : 'private';
            const el = document.getElementById('config-roll-visibility');
            if (el) {
                el.value = nextVis;
                el.dispatchEvent(new Event('change'));
            }
            const isPrivate = nextVis === 'private';
            visToggleBtn.className = `btn btn-xs ${isPrivate ? 'btn-danger' : 'btn-secondary'}`;
            visToggleBtn.innerHTML = `<i class="${isPrivate ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}"></i> <span>${isPrivate ? 'GM Secret' : 'Public'}</span>`;
            visToggleBtn.title = `Roll Visibility: ${isPrivate ? 'GM Secret (only GM sees)' : 'Public (all see)'}. Click to toggle.`;
        });
    }

    // Wire Generic / Named Instancing Toggle
    const gnToggleBtn = contentEl.querySelector('#cs-generic-named-toggle');
    if (gnToggleBtn) {
        gnToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetChar =
                activeCharId && window.VTT?.campaignState?.characters
                    ? window.VTT.campaignState.characters[activeCharId]
                    : null;
            const currentIsGeneric = targetChar ? targetChar.isGeneric === true : m.isGeneric === true;
            const nextIsGeneric = !currentIsGeneric;

            if (targetChar) {
                targetChar.isGeneric = nextIsGeneric;
                if (window.VTT?.socket) {
                    window.VTT.socket.emit('character:update', { character: targetChar });
                }
            }
            m.isGeneric = nextIsGeneric;

            gnToggleBtn.className = `btn btn-xs ${nextIsGeneric ? 'btn-secondary' : 'btn-primary'}`;
            gnToggleBtn.innerHTML = `<i class="${nextIsGeneric ? 'fa-solid fa-people-group' : 'fa-solid fa-street-view'}"></i> <span>${nextIsGeneric ? 'Generic' : 'Named'}</span>`;
            gnToggleBtn.title = `Entity Type: ${nextIsGeneric ? 'Generic (independent instanced tokens on canvas)' : 'Named (linked to central sheet)'}. Click to toggle.`;
        });
    }
}
