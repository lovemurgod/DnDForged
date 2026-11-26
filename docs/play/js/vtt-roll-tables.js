/**
 * vtt-roll-tables.js
 * Comprehensive Roll Tables, Flippable Asset Tables & Card Decks Subsystem for DnDForged VTT.
 * Handles table evaluations, multi-sided token spawning, deck shuffling, dealing, drawing,
 * and real-time synchronization.
 */

import { escapeHtml } from './vtt-utils.js';

// Base64 SVG generator for pristine, high-fidelity Tarot cards and card backs
export function svgToBase64Uri(svgString) {
    if (typeof btoa === 'function') {
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    }
    return 'data:image/svg+xml;base64,' + Buffer.from(svgString).toString('base64');
}

/**
 * Procedurally renders ornate, high-fantasy Tarot card visuals in pure vector SVG.
 * Avoids foreignObject to ensure 100% cross-browser, chat, canvas, and electron compatibility.
 */
export function renderTarotCardSvg({ name = 'Card', suit = '', number = null, desc = '', theme = 'tarokka' } = {}) {
    const w = 240;
    const h = 360;

    let bgStart = '#181524';
    let bgEnd = '#0a0812';
    let primaryGold = '#d4af37';
    let secondaryGold = '#f59e0b';
    let textGold = '#fef08a';
    let crestGlyph = '✦';

    if (theme === 'many_things') {
        bgStart = '#0f172a';
        bgEnd = '#020617';
        primaryGold = '#fbbf24';
        secondaryGold = '#38bdf8';
        textGold = '#fde047';
        crestGlyph = '☼';
    } else if (theme === 'illusions') {
        bgStart = '#1e1136';
        bgEnd = '#0b1329';
        primaryGold = '#c084fc';
        secondaryGold = '#38bdf8';
        textGold = '#e9d5ff';
        crestGlyph = '◈';
    } else if (theme === 'standard') {
        bgStart = '#18181b';
        bgEnd = '#09090b';
        primaryGold = '#d4af37';
        secondaryGold = '#e2e8f0';
        textGold = '#fef08a';
        crestGlyph = '⚜';
    }

    // Word wrap description into pure SVG tspans
    const words = (desc || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > 28) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word;
            if (lines.length >= 4) break;
        } else {
            currentLine += (currentLine ? ' ' : '') + word;
        }
    }
    if (currentLine && lines.length < 4) lines.push(currentLine.trim());
    if (lines.length === 4 && words.length > 28) lines[3] += '…';

    const tspanYStart = 275 - lines.length * 8;
    const descTspans = lines
        .map((l, i) => `<tspan x="${w / 2}" y="${tspanYStart + i * 16}">${escapeHtml(l)}</tspan>`)
        .join('');

    const suitLabel = suit ? suit.toUpperCase() : theme === 'tarokka' ? 'TAROKKA DECK' : 'HIGH ARCANA';
    const displayNum = number !== null && number !== undefined ? `• ${number} •` : '';
    const uid = Math.random().toString(36).substring(2, 8);
    const gradId = `cardGrad_${theme}_${uid}`;
    const glowId = `crestGlow_${theme}_${uid}`;

    // Dynamic title scaling for long card names
    const rawName = String(name || 'Card');
    const titleFontSize = rawName.length > 26 ? 10 : rawName.length > 18 ? 12 : 14;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgStart}"/>
      <stop offset="100%" stop-color="${bgEnd}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primaryGold}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${primaryGold}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Card Body -->
  <rect width="${w}" height="${h}" rx="14" fill="url(#${gradId})" stroke="${primaryGold}" stroke-width="3"/>
  <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="10" fill="none" stroke="${primaryGold}" stroke-width="1" stroke-opacity="0.6"/>
  <rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="8" fill="none" stroke="${primaryGold}" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.35"/>

  <!-- Ornate Corner Accents -->
  <circle cx="18" cy="18" r="3" fill="${secondaryGold}"/>
  <circle cx="${w - 18}" cy="18" r="3" fill="${secondaryGold}"/>
  <circle cx="18" cy="${h - 18}" r="3" fill="${secondaryGold}"/>
  <circle cx="${w - 18}" cy="${h - 18}" r="3" fill="${secondaryGold}"/>

  <!-- Header Banner -->
  <text x="${w / 2}" y="36" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="${textGold}" letter-spacing="2" text-anchor="middle">${escapeHtml(suitLabel)}</text>
  ${displayNum ? `<text x="${w / 2}" y="48" font-family="Georgia, serif" font-size="9" fill="${secondaryGold}" text-anchor="middle">${displayNum}</text>` : ''}

  <!-- Title Plaque -->
  <text x="${w / 2}" y="74" font-family="Georgia, serif" font-size="${titleFontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${escapeHtml(rawName)}</text>

  <!-- Central Crest Frame -->
  <circle cx="${w / 2}" cy="155" r="50" fill="url(#${glowId})"/>
  <circle cx="${w / 2}" cy="155" r="48" fill="rgba(0,0,0,0.4)" stroke="${primaryGold}" stroke-width="1.5"/>
  <circle cx="${w / 2}" cy="155" r="42" fill="none" stroke="${secondaryGold}" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.8"/>
  <text x="${w / 2}" y="172" font-family="Georgia, serif" font-size="44" fill="${textGold}" text-anchor="middle">${crestGlyph}</text>

  <!-- Fortune / Effect Box -->
  <rect x="18" y="235" width="${w - 36}" height="95" rx="6" fill="rgba(0,0,0,0.5)" stroke="${primaryGold}" stroke-width="1" stroke-opacity="0.5"/>
  <line x1="28" y1="247" x2="${w - 28}" y2="247" stroke="${secondaryGold}" stroke-width="0.75" stroke-opacity="0.5"/>
  <text font-family="Georgia, serif" font-size="10.5" fill="#f1f5f9" text-anchor="middle" font-style="italic">
    ${descTspans}
  </text>
  <line x1="28" y1="318" x2="${w - 28}" y2="318" stroke="${secondaryGold}" stroke-width="0.75" stroke-opacity="0.5"/>
</svg>
`.trim();

    return svgToBase64Uri(svg);
}

/**
 * Procedurally renders thematic Tarot card backs.
 */
export function renderTarotBackSvg(theme = 'tarokka') {
    const w = 240;
    const h = 360;

    let bgStart = '#181524';
    let bgEnd = '#0a0812';
    let primaryGold = '#d4af37';
    let secondaryGold = '#f59e0b';
    let symbol = '☽ ✦ ☾';

    if (theme === 'many_things') {
        bgStart = '#0f172a';
        bgEnd = '#020617';
        primaryGold = '#fbbf24';
        secondaryGold = '#38bdf8';
        symbol = '☼ ✦ ☼';
    } else if (theme === 'illusions') {
        bgStart = '#1e1136';
        bgEnd = '#0b1329';
        primaryGold = '#c084fc';
        secondaryGold = '#38bdf8';
        symbol = '◈ ✦ ◈';
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="backGrad_${theme}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgStart}"/>
      <stop offset="100%" stop-color="${bgEnd}"/>
    </linearGradient>
    <radialGradient id="backCenter_${theme}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${primaryGold}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${primaryGold}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${w}" height="${h}" rx="14" fill="url(#backGrad_${theme})" stroke="${primaryGold}" stroke-width="3"/>
  <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="10" fill="none" stroke="${primaryGold}" stroke-width="1" stroke-opacity="0.6"/>
  <rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="8" fill="none" stroke="${secondaryGold}" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.4"/>

  <!-- Geometric Diamond Lattice Pattern -->
  <line x1="20" y1="20" x2="${w - 20}" y2="${h - 20}" stroke="${primaryGold}" stroke-width="0.5" stroke-opacity="0.25"/>
  <line x1="${w - 20}" y1="20" x2="20" y2="${h - 20}" stroke="${primaryGold}" stroke-width="0.5" stroke-opacity="0.25"/>
  <polygon points="${w / 2},30 ${w - 30},${h / 2} ${w / 2},${h - 30} 30,${h / 2}" fill="none" stroke="${primaryGold}" stroke-width="1" stroke-opacity="0.4"/>

  <!-- Central Medallion -->
  <circle cx="${w / 2}" cy="${h / 2}" r="55" fill="url(#backCenter_${theme})"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="50" fill="rgba(0,0,0,0.5)" stroke="${primaryGold}" stroke-width="2"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="44" fill="none" stroke="${secondaryGold}" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="${w / 2}" y="${h / 2 + 8}" font-family="Georgia, serif" font-size="20" fill="${primaryGold}" text-anchor="middle" letter-spacing="3">${symbol}</text>

  <!-- Border Ring of Runes / Dots -->
  <circle cx="${w / 2}" cy="45" r="4" fill="${secondaryGold}"/>
  <circle cx="${w / 2}" cy="${h - 45}" r="4" fill="${secondaryGold}"/>
  <circle cx="40" cy="${h / 2}" r="4" fill="${secondaryGold}"/>
  <circle cx="${w - 40}" cy="${h / 2}" r="4" fill="${secondaryGold}"/>
</svg>
`.trim();

    return svgToBase64Uri(svg);
}

// Fisher-Yates array shuffling
export function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function findRowForRoll(rows, rollVal) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const numRoll = typeof rollVal === 'number' ? rollVal : parseInt(rollVal, 10);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.isArray(row) ? row : [row];
        const rangeStr = String(cells[0] || '').trim();
        const parts = rangeStr.split(/[-–—]/);
        if (parts.length === 2) {
            let min = parseInt(parts[0], 10);
            let max = parseInt(parts[1], 10);
            if (max === 0) max = 100;
            if (min === 0 && max !== 100) min = 100;
            if (!isNaN(min) && !isNaN(max) && numRoll >= min && numRoll <= max) {
                return { index: i, row };
            }
        } else if (parts.length === 1 && !isNaN(parseInt(parts[0], 10))) {
            let val = parseInt(parts[0], 10);
            if (val === 0) val = 100;
            if (val === numRoll) {
                return { index: i, row };
            }
        }
    }
    const idx = Math.min(Math.max(1, numRoll || 1), rows.length) - 1;
    return { index: idx, row: rows[idx] };
}

export function cleanTableText(str) {
    if (!str) return '';
    if (typeof str === 'object') {
        if (str.entry) return cleanTableText(str.entry);
        if (str.text) return cleanTableText(str.text);
        if (str.name) return cleanTableText(str.name);
        if (Array.isArray(str)) return str.map(cleanTableText).join('; ');
        if (str.roll) {
            const r = str.roll.exact ?? (str.roll.min !== undefined ? `${str.roll.min}-${str.roll.max}` : '');
            return r ? `${r}` : '';
        }
        return '';
    }
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/\{@damage\s+([^}]+)\}/gi, '$1')
        .replace(/\{@dice\s+([^}]+)\}/gi, '$1')
        .replace(/\{@hit\s+([+-]?\d+)\}/gi, '+$1')
        .replace(/\{@spell\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@item\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@creature\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@condition\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@skill\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@sense\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@table\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1 table')
        .replace(/\{@book\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1')
        .replace(/\{@[a-zA-Z0-9_-]+\s+([^|}]+)(?:\|[^}]+)?\}/gi, '$1');
}

// --- MASTER CONTROLLER ---
export function initVttRollTables(vtt) {
    function getState() {
        if (!vtt.campaignState) {
            vtt.campaignState = {};
        }
        if (!vtt.campaignState.rollTables) {
            vtt.campaignState.rollTables = { tables: [], assetTables: [], decks: [] };
        }
        if (!Array.isArray(vtt.campaignState.rollTables.tables)) vtt.campaignState.rollTables.tables = [];
        if (!Array.isArray(vtt.campaignState.rollTables.assetTables)) vtt.campaignState.rollTables.assetTables = [];
        if (!Array.isArray(vtt.campaignState.rollTables.decks)) vtt.campaignState.rollTables.decks = [];
        return vtt.campaignState.rollTables;
    }
    getState();

    // Active editing references
    let editingTableId = null;
    let editingAssetTableId = null;
    let editingDeckId = null;
    let viewingDeckCardsId = null;

    // Filter search strings
    let tableSearchQuery = '';
    let assetTableSearchQuery = '';
    let deckSearchQuery = '';

    // --- DOM Elements ---
    const tabTables = document.getElementById('tab-tables');
    const rollTablesListEl = document.getElementById('roll-tables-list');
    const assetTablesListEl = document.getElementById('asset-tables-list');
    const cardDecksListEl = document.getElementById('card-decks-list');

    // Modals
    const modalEditTable = document.getElementById('modal-edit-roll-table');
    const modalEditAssetTable = document.getElementById('modal-edit-asset-table');
    const modalEditDeck = document.getElementById('modal-edit-card-deck');
    const modalViewDeckCards = document.getElementById('modal-view-deck-cards');
    const modalTablePicker =
        document.getElementById('modal-table-picker') || document.getElementById('modal-load-presets');
    const modalLoadPresets = modalTablePicker;

    // --- SOCKET LISTENERS ---
    if (vtt.socket) {
        vtt.socket.on('rolltables:updated', (data) => {
            if (data?.rollTables) {
                if (!vtt.campaignState) vtt.campaignState = {};
                vtt.campaignState.rollTables = data.rollTables;
                getState();
                renderAllViews();
            }
        });

        vtt.socket.on('deck:state_updated', (data) => {
            if (data?.deckId && data?.state) {
                const deck = (getState().decks || []).find((d) => d.id === data.deckId);
                if (deck) {
                    deck.state = data.state;
                    renderCardDecksList();
                    if (viewingDeckCardsId === data.deckId) {
                        renderDeckCardsViewer(deck);
                    }
                }
            }
        });
    }

    // --- SYNC STATE TO SERVER ---
    function broadcastState() {
        const st = getState();
        if (vtt.socket && vtt.role === 'GM') {
            vtt.socket.emit('rolltables:update', { rollTables: st });
        }
        renderAllViews();
    }

    function broadcastDeckState(deckId, state) {
        if (vtt.socket) {
            vtt.socket.emit('deck:state_update', { deckId, state });
        }
        renderCardDecksList();
    }

    // --- VIEW RENDERERS ---
    function renderAllViews() {
        renderRollTablesList();
        renderAssetTablesList();
        renderCardDecksList();
    }

    // 1. RENDER ROLL TABLES
    function renderRollTablesList() {
        if (!rollTablesListEl) return;
        const tables = getState().tables || [];
        const filtered = tables.filter(
            (t) =>
                t.name.toLowerCase().includes(tableSearchQuery.toLowerCase()) ||
                (t.description && t.description.toLowerCase().includes(tableSearchQuery.toLowerCase()))
        );

        if (filtered.length === 0) {
            rollTablesListEl.innerHTML = `
                <div class="init-empty-state" style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-dice-d20" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; margin: 0;">No roll tables yet.<br>Click <strong>+ New Table</strong> or <strong>Load Table / Presets</strong> to begin.</p>
                </div>`;
            return;
        }

        rollTablesListEl.innerHTML = filtered
            .map((t) => {
                const entryCount = t.entries ? t.entries.length : 0;
                const diceFormula = `1d${entryCount || 1}`;
                const allowPlayerBadge = t.allowPlayers
                    ? '<span class="badge-tag" style="background: rgba(34,197,94,0.2); color: #4ade80; font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; margin-left: 6px;">Players Allowed</span>'
                    : '';

                return `
                <div class="rolltable-card glassmorphism" data-id="${t.id}" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 6px;">
                    <div class="flex-row" style="justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-gold-light);">${escapeHtml(t.name)}</span>
                            ${allowPlayerBadge}
                            <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px;">
                                <span class="text-gradient-gold" style="font-weight: bold;">${diceFormula}</span> • ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}
                            </div>
                        </div>
                        <div class="flex-row" style="gap: 4px;">
                            <button class="btn btn-xxs btn-secondary btn-table-edit" data-id="${t.id}" title="Edit Table"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-xxs btn-secondary btn-table-clone" data-id="${t.id}" title="Clone Table"><i class="fa-solid fa-clone"></i></button>
                            <button class="btn btn-xxs btn-danger btn-table-delete" data-id="${t.id}" title="Delete Table"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    ${t.description ? `<p style="font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; line-height: 1.3;">${escapeHtml(t.description)}</p>` : ''}
                    <div class="flex-row" style="gap: 6px; margin-top: 4px;">
                        <button class="btn btn-xs btn-primary btn-table-roll-public" data-id="${t.id}" style="flex: 1;" title="Roll table publicly to chat">
                            <i class="fa-solid fa-dice-d20"></i> Roll (${diceFormula})
                        </button>
                        <button class="btn btn-xs btn-secondary btn-table-roll-whisper" data-id="${t.id}" title="Roll table quietly (GM Whisper)">
                            <i class="fa-solid fa-user-secret"></i> Whisper
                        </button>
                    </div>
                </div>
            `;
            })
            .join('');

        // Wire event handlers
        rollTablesListEl.querySelectorAll('.btn-table-roll-public').forEach((b) => {
            b.addEventListener('click', () => rollFromTable(b.dataset.id, false));
        });
        rollTablesListEl.querySelectorAll('.btn-table-roll-whisper').forEach((b) => {
            b.addEventListener('click', () => rollFromTable(b.dataset.id, true));
        });
        rollTablesListEl.querySelectorAll('.btn-table-edit').forEach((b) => {
            b.addEventListener('click', () => openEditTableModal(b.dataset.id));
        });
        rollTablesListEl.querySelectorAll('.btn-table-clone').forEach((b) => {
            b.addEventListener('click', () => cloneTable(b.dataset.id));
        });
        rollTablesListEl.querySelectorAll('.btn-table-delete').forEach((b) => {
            b.addEventListener('click', () => deleteTable(b.dataset.id));
        });
    }

    // 2. RENDER ASSET TABLES (Flippable Tokens)
    function renderAssetTablesList() {
        if (!assetTablesListEl) return;
        const tables = getState().assetTables || [];
        const filtered = tables.filter((t) => t.name.toLowerCase().includes(assetTableSearchQuery.toLowerCase()));

        if (filtered.length === 0) {
            assetTablesListEl.innerHTML = `
                <div class="init-empty-state" style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-images" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; margin: 0;">No asset tables yet.<br>Click <strong>+ New Asset Table</strong> to create flippable tokens.</p>
                </div>`;
            return;
        }

        assetTablesListEl.innerHTML = filtered
            .map((t) => {
                const entries = t.entries || [];
                const previewsHtml = entries
                    .slice(0, 5)
                    .map(
                        (e) => `
                <div style="width: 38px; height: 38px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #000; flex-shrink: 0;" title="${escapeHtml(e.name || 'Side')}">
                    <img src="${escapeHtml(e.url)}" alt="${escapeHtml(e.name)}" style="width: 100%; height: 100%; object-fit: cover;" data-fallback-src="favicon.svg">
                </div>
            `
                    )
                    .join('');

                return `
                <div class="rolltable-card glassmorphism" data-id="${t.id}" draggable="true" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 6px; cursor: grab;">
                    <div class="flex-row" style="justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-gold-light);">${escapeHtml(t.name)}</span>
                            <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 6px;">(${entries.length} ${entries.length === 1 ? 'side' : 'sides'})</span>
                        </div>
                        <div class="flex-row" style="gap: 4px;">
                            <button class="btn btn-xxs btn-secondary btn-asset-table-edit" data-id="${t.id}" title="Edit Asset Table"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-xxs btn-danger btn-asset-table-delete" data-id="${t.id}" title="Delete Asset Table"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="flex-row scroll-styled" style="gap: 6px; overflow-x: auto; padding: 4px 0;">
                        ${previewsHtml}
                        ${entries.length > 5 ? `<div style="font-size: 0.75rem; color: var(--color-text-muted); align-self: center;">+${entries.length - 5} more</div>` : ''}
                    </div>
                    <div class="flex-row" style="gap: 6px; margin-top: 4px;">
                        <button class="btn btn-xs btn-primary btn-asset-table-place" data-id="${t.id}" style="flex: 1;" title="Place flippable token at map center">
                            <i class="fa-solid fa-crosshairs"></i> Place on Canvas
                        </button>
                    </div>
                </div>
            `;
            })
            .join('');

        // Drag to canvas
        assetTablesListEl.querySelectorAll('.rolltable-card').forEach((card) => {
            card.addEventListener('dragstart', (e) => {
                const tableId = card.dataset.id;
                const tbl = tables.find((item) => item.id === tableId);
                if (!tbl) return;

                const payload = JSON.stringify({
                    type: 'asset-table',
                    tableId: tbl.id,
                    name: tbl.name,
                    size: tbl.defaultTokenSize || 1,
                    entries: tbl.entries
                });
                e.dataTransfer.setData('application/json', payload);
                e.dataTransfer.setData('text/plain', payload);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        assetTablesListEl.querySelectorAll('.btn-asset-table-place').forEach((b) => {
            b.addEventListener('click', () => placeAssetTableOnCanvas(b.dataset.id));
        });
        assetTablesListEl.querySelectorAll('.btn-asset-table-edit').forEach((b) => {
            b.addEventListener('click', () => openEditAssetTableModal(b.dataset.id));
        });
        assetTablesListEl.querySelectorAll('.btn-asset-table-delete').forEach((b) => {
            b.addEventListener('click', () => deleteAssetTable(b.dataset.id));
        });
    }

    // 3. RENDER CARD DECKS
    function renderCardDecksList() {
        if (!cardDecksListEl) return;
        const decks = getState().decks || [];
        const filtered = decks.filter((d) => d.name.toLowerCase().includes(deckSearchQuery.toLowerCase()));

        if (filtered.length === 0) {
            cardDecksListEl.innerHTML = `
                <div class="init-empty-state" style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-layer-group" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; margin: 0;">No card decks yet.<br>Click <strong>+ New Deck</strong> or <strong>Load Deck Preset</strong> to begin.</p>
                </div>`;
            return;
        }

        cardDecksListEl.innerHTML = filtered
            .map((d) => {
                ensureDeckState(d);
                const drawCount = d.state.drawPile.length;
                const discardCount = d.state.discardPile.length;
                const drawnCount = d.state.drawnCards ? d.state.drawnCards.length : 0;
                const totalCount = (d.cards || []).length;

                return `
                <div class="rolltable-card glassmorphism" data-id="${d.id}" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 8px;">
                    <div class="flex-row" style="gap: 10px; align-items: center;">
                        <div style="width: 44px; height: 60px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #111; flex-shrink: 0;" title="Card Back">
                            <img src="${escapeHtml(d.backImg)}" alt="Card Back" style="width: 100%; height: 100%; object-fit: cover;" data-fallback-src="favicon.svg">
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="flex-row" style="justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-gold-light);">${escapeHtml(d.name)}</span>
                                <div class="flex-row" style="gap: 4px;">
                                    <button class="btn btn-xxs btn-secondary btn-deck-edit" data-id="${d.id}" title="Edit Deck"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-xxs btn-danger btn-deck-delete" data-id="${d.id}" title="Delete Deck"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">
                                <span title="Draw Pile" style="color: #60a5fa;"><i class="fa-solid fa-clone"></i> Draw: <strong>${drawCount}</strong></span> • 
                                <span title="Discard Pile" style="color: #f87171;"><i class="fa-solid fa-trash-can"></i> Discard: <strong>${discardCount}</strong></span> • 
                                <span title="Total Cards">${totalCount} total</span>
                            </div>
                        </div>
                    </div>

                    <!-- Action Controls -->
                    <div class="flex-row" style="gap: 6px;">
                        <button class="btn btn-xs btn-primary btn-deck-draw" data-id="${d.id}" style="flex: 1;" ${drawCount === 0 ? 'disabled' : ''} title="Draw top card">
                            <i class="fa-solid fa-hand"></i> Draw
                        </button>
                        <button class="btn btn-xs btn-secondary btn-deck-shuffle" data-id="${d.id}" title="Shuffle Draw Pile">
                            <i class="fa-solid fa-shuffle"></i> Shuffle
                        </button>
                        <button class="btn btn-xs btn-secondary btn-deck-view-cards" data-id="${d.id}" title="Inspect Drawn / Discarded Cards">
                            <i class="fa-solid fa-eye"></i> Cards
                        </button>
                        <button class="btn btn-xs btn-ghost btn-deck-recall" data-id="${d.id}" title="Recall all cards back to deck and shuffle">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                    </div>
                </div>
            `;
            })
            .join('');

        cardDecksListEl.querySelectorAll('.btn-deck-draw').forEach((b) => {
            b.addEventListener('click', () => drawFromDeckPrompt(b.dataset.id));
        });
        cardDecksListEl.querySelectorAll('.btn-deck-shuffle').forEach((b) => {
            b.addEventListener('click', () => shuffleDeckAction(b.dataset.id));
        });
        cardDecksListEl.querySelectorAll('.btn-deck-view-cards').forEach((b) => {
            b.addEventListener('click', () => openDeckCardsViewer(b.dataset.id));
        });
        cardDecksListEl.querySelectorAll('.btn-deck-recall').forEach((b) => {
            b.addEventListener('click', () => recallDeckAction(b.dataset.id));
        });
        cardDecksListEl.querySelectorAll('.btn-deck-edit').forEach((b) => {
            b.addEventListener('click', () => openEditDeckModal(b.dataset.id));
        });
        cardDecksListEl.querySelectorAll('.btn-deck-delete').forEach((b) => {
            b.addEventListener('click', () => deleteDeck(b.dataset.id));
        });
    }

    function ensureDeckState(deck) {
        if (!deck.state) {
            deck.state = { drawPile: [], discardPile: [], drawnCards: [] };
        }
        if (!Array.isArray(deck.state.drawPile)) deck.state.drawPile = [];
        if (!Array.isArray(deck.state.discardPile)) deck.state.discardPile = [];
        if (!Array.isArray(deck.state.drawnCards)) deck.state.drawnCards = [];

        // If draw pile and discard are both empty, auto-populate draw pile with cards
        if (
            deck.state.drawPile.length === 0 &&
            deck.state.discardPile.length === 0 &&
            deck.cards &&
            deck.cards.length > 0
        ) {
            deck.state.drawPile = shuffleArray(deck.cards.map((c) => c.id));
        }
    }

    // --- ROLL TABLE EXECUTION ---
    function rollFromTable(tableId, isWhisper = false) {
        const table = (getState().tables || []).find((t) => t.id === tableId);
        if (!table || !table.entries || table.entries.length === 0) {
            if (vtt.toast) vtt.toast('This table has no entries to roll from.', 'error');
            return;
        }

        const count = table.entries.length;
        const rollVal = Math.floor(Math.random() * count) + 1; // 1 to count
        const selectedEntry = table.entries[rollVal - 1];

        // 3D Dice Simulation if available
        if (window.Dice3D && typeof window.Dice3D.showDiceRoll === 'function') {
            try {
                window.Dice3D.showDiceRoll([{ faces: count, val: rollVal }]);
            } catch (err) {
                console.warn('3D dice error:', err);
            }
        }

        // Send Rich Chat Message
        const chatHtml = `
            <div class="rolltable-chat-card" style="border: 1px solid var(--color-gold-base); border-radius: 6px; padding: 10px; background: rgba(18, 22, 33, 0.95); box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gold-light); font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                    <span><i class="fa-solid fa-dice-d20"></i> ${escapeHtml(table.name)}</span>
                    <span style="color: #60a5fa;">[d${count}: ${rollVal}]</span>
                </div>
                <div style="font-weight: 600; font-size: 0.95rem; color: #fff; margin-bottom: 2px;">
                    ${escapeHtml(selectedEntry.name || `Result #${rollVal}`)}
                </div>
                ${selectedEntry.text ? `<div style="font-size: 0.85rem; color: var(--color-text-secondary); line-height: 1.4;">${escapeHtml(selectedEntry.text)}</div>` : ''}
            </div>
        `;

        if (vtt.socket) {
            vtt.socket.emit('chat:msg', {
                html: chatHtml,
                rollTableCard: {
                    tableName: table.name,
                    formula: `1d${count}`,
                    roll: rollVal,
                    entryName: selectedEntry.name || `Result #${rollVal}`,
                    entryText: selectedEntry.text || ''
                },
                text: `Rolled on table ${table.name}: ${selectedEntry.name || rollVal}`,
                whisperToGM: isWhisper
            });
        }
    }

    // --- ASSET TABLE PLACEMENT ---
    function placeAssetTableOnCanvas(tableId) {
        const table = (getState().assetTables || []).find((t) => t.id === tableId);
        if (!table || !table.entries || table.entries.length === 0) return;

        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        const grid = canvasEngine.getGrid();
        const size = table.defaultTokenSize || 1;
        const sizePx = size * grid.size * grid.scale;

        const viewportEl = document.getElementById('vtt-canvas-viewport');
        const vr = viewportEl
            ? viewportEl.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        const centerMouse = canvasEngine.getCanvasMouseCoords({
            clientX: vr.left + vr.width / 2,
            clientY: vr.top + vr.height / 2
        });

        const token = {
            id: `token_table_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: table.name,
            x: centerMouse.x - sizePx / 2,
            y: centerMouse.y - sizePx / 2,
            hp: 0,
            maxHp: 0,
            size: size,
            img: table.entries[0]?.url || 'favicon.svg',
            tokenImages: table.entries.map((en, idx) => ({
                url: en.url,
                name: en.name || `Side ${idx + 1}`
            })),
            activeTokenIndex: 0,
            isAssetTable: true,
            assetTableId: table.id,
            isPlayer: false,
            layer: canvasEngine.getActiveLayer() || 'token',
            isBorderless: true
        };

        canvasEngine.addToken(token);
        if (vtt.toast) vtt.toast(`Placed flippable token: ${table.name}`);
    }

    // --- CARD DECK ACTIONS ---
    function drawFromDeckPrompt(deckId) {
        const deck = (getState().decks || []).find((d) => d.id === deckId);
        if (!deck || !deck.cards) return;
        ensureDeckState(deck);

        if (deck.state.drawPile.length === 0) {
            if (vtt.toast) vtt.toast('Draw pile is empty! Shuffle discard pile first.', 'warning');
            return;
        }

        // Modal / Dropdown to pick destination
        const modal = document.createElement('div');
        modal.id = 'modal-draw-destination';
        modal.className = 'vtt-modal-backdrop animated-fade-in';
        modal.style.cssText =
            'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:10000; display:flex; align-items:center; justify-content:center;';
        modal.innerHTML = `
            <div class="glassmorphism" style="width:320px; padding:18px; border-radius:8px; border:1px solid var(--color-gold-base); background:#18181b;">
                <h4 style="margin:0 0 12px 0; color:var(--color-gold-light); font-size:1rem;"><i class="fa-solid fa-hand"></i> Draw from ${escapeHtml(deck.name)}</h4>
                <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:14px;">Cards remaining in draw pile: <strong>${deck.state.drawPile.length}</strong></p>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn btn-sm btn-primary btn-dest-chat"><i class="fa-solid fa-comments"></i> Draw to Chat (Public)</button>
                    <button class="btn btn-sm btn-secondary btn-dest-whisper"><i class="fa-solid fa-user-secret"></i> Draw to Chat (Whisper to GM)</button>
                    <button class="btn btn-sm btn-secondary btn-dest-canvas"><i class="fa-solid fa-map"></i> Play Card to Tabletop</button>
                    <button class="btn btn-sm btn-ghost btn-dest-hand"><i class="fa-solid fa-hand-holding"></i> Draw to Hand (View Only)</button>
                </div>
                <div style="margin-top:14px; text-align:right;">
                    <button class="btn btn-xs btn-ghost btn-cancel-draw">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('.btn-cancel-draw').addEventListener('click', close);

        const executeDraw = (dest, isWhisper = false) => {
            close();
            if (!deck.state?.drawPile || deck.state.drawPile.length === 0) {
                if (vtt.toast)
                    vtt.toast('The draw pile is empty. Please reshuffle discard pile back into deck.', 'info');
                return;
            }
            const cardId = deck.state.drawPile.shift(); // draw top card
            const card = deck.cards.find((c) => c.id === cardId);
            if (!card) return;

            deck.state.drawnCards.push(cardId);
            broadcastDeckState(deck.id, deck.state);

            if (dest === 'chat') {
                const cardChatHtml = `
                    <div class="card-draw-chat" style="border: 1px solid var(--color-gold-base); border-radius: 8px; padding: 12px; background: rgba(18, 22, 33, 0.95); max-width: 260px; margin: 0 auto; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                        <div style="font-size: 0.75rem; color: var(--color-gold-light); text-transform: uppercase; font-weight: bold; margin-bottom: 6px;">
                            ${escapeHtml(deck.name)}
                        </div>
                        <div style="width: 140px; height: 200px; margin: 0 auto 8px auto; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #000;">
                            <img src="${escapeHtml(card.frontImg)}" alt="${escapeHtml(card.name)}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div style="font-weight: 600; font-size: 0.95rem; color: #fff;">${escapeHtml(card.name)}</div>
                        ${card.description ? `<div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px; line-height: 1.3;">${escapeHtml(card.description)}</div>` : ''}
                    </div>
                `;
                if (vtt.socket) {
                    vtt.socket.emit('chat:msg', {
                        html: cardChatHtml,
                        cardDrawCard: {
                            deckName: deck.name,
                            cardName: card.name,
                            cardImg: card.frontImg,
                            description: card.description || ''
                        },
                        text: `Drew card from ${deck.name}: ${card.name}`,
                        whisperToGM: isWhisper
                    });
                }
            } else if (dest === 'canvas') {
                playCardToCanvas(deck, card);
            } else if (dest === 'hand') {
                openDeckCardsViewer(deck.id);
            }
        };

        modal.querySelector('.btn-dest-chat').addEventListener('click', () => executeDraw('chat', false));
        modal.querySelector('.btn-dest-whisper').addEventListener('click', () => executeDraw('chat', true));
        modal.querySelector('.btn-dest-canvas').addEventListener('click', () => executeDraw('canvas'));
        modal.querySelector('.btn-dest-hand').addEventListener('click', () => executeDraw('hand'));
    }

    function playCardToCanvas(deck, card, dropCoords = null) {
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        const grid = canvasEngine.getGrid();
        const cardWidth = Math.round(140 * grid.scale);
        const cardHeight = Math.round(210 * grid.scale);

        let spawnX = 0;
        let spawnY = 0;
        if (dropCoords) {
            spawnX = dropCoords.x - cardWidth / 2;
            spawnY = dropCoords.y - cardHeight / 2;
        } else {
            const viewportEl = document.getElementById('vtt-canvas-viewport');
            const vr = viewportEl
                ? viewportEl.getBoundingClientRect()
                : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

            const centerMouse = canvasEngine.getCanvasMouseCoords({
                clientX: vr.left + vr.width / 2,
                clientY: vr.top + vr.height / 2
            });
            spawnX = centerMouse.x - cardWidth / 2;
            spawnY = centerMouse.y - cardHeight / 2;
        }

        const token = {
            id: `token_card_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: card.name,
            x: spawnX,
            y: spawnY,
            hp: 0,
            maxHp: 0,
            size: 1,
            pixelWidth: cardWidth,
            pixelHeight: cardHeight,
            img: card.frontImg,
            tokenImages: [
                { url: card.frontImg, name: `${card.name} (Face)` },
                { url: deck.backImg, name: `${deck.name} (Back)` }
            ],
            activeTokenIndex: 0,
            isAsset: true,
            isBorderless: false,
            isCardToken: true,
            cardId: card.id,
            deckId: deck.id,
            isPlayer: false,
            layer: canvasEngine.getActiveLayer() || 'map',
            imgRadius: '6px'
        };

        canvasEngine.addToken(token);
        if (vtt.toast) vtt.toast(`Placed card "${card.name}" on canvas.`);
    }

    function shuffleDeckAction(deckId) {
        const deck = (getState().decks || []).find((d) => d.id === deckId);
        if (!deck) return;
        ensureDeckState(deck);

        const includeDiscard = confirm('Shuffle discard pile back into the draw pile as well?');
        if (includeDiscard && deck.state.discardPile.length > 0) {
            deck.state.drawPile = [...deck.state.drawPile, ...deck.state.discardPile];
            deck.state.discardPile = [];
        }

        deck.state.drawPile = shuffleArray(deck.state.drawPile);
        broadcastDeckState(deck.id, deck.state);

        if (vtt.toast) vtt.toast(`Shuffled ${deck.name} (${deck.state.drawPile.length} cards in draw pile)`);
    }

    function recallDeckAction(deckId) {
        const deck = (getState().decks || []).find((d) => d.id === deckId);
        if (!deck || !deck.cards) return;
        if (!confirm(`Recall all cards in "${deck.name}" back into the deck and shuffle?`)) return;

        deck.state = {
            drawPile: shuffleArray(deck.cards.map((c) => c.id)),
            discardPile: [],
            drawnCards: []
        };
        broadcastDeckState(deck.id, deck.state);
        if (vtt.toast) vtt.toast(`Recalled and shuffled all ${deck.cards.length} cards in ${deck.name}`);
    }

    // --- DECK CARDS VIEWER (INSPECT DRAWN & DISCARDED) ---
    function openDeckCardsViewer(deckId) {
        const deck = (getState().decks || []).find((d) => d.id === deckId);
        if (!deck) return;
        ensureDeckState(deck);
        viewingDeckCardsId = deck.id;

        renderDeckCardsViewer(deck);
        if (modalViewDeckCards) {
            modalViewDeckCards.classList.remove('vtt-hidden');
        }
    }

    function renderDeckCardsViewer(deck) {
        if (!modalViewDeckCards) return;
        const titleEl = modalViewDeckCards.querySelector('#view-deck-title');
        const drawListEl = modalViewDeckCards.querySelector('#view-deck-drawn-cards');
        const discardListEl = modalViewDeckCards.querySelector('#view-deck-discard-cards');

        if (titleEl) titleEl.textContent = deck.name;

        // Render drawn / in-hand cards
        const drawnCards = (deck.state.drawnCards || [])
            .map((id) => deck.cards.find((c) => c.id === id))
            .filter(Boolean);
        if (drawListEl) {
            if (drawnCards.length === 0) {
                drawListEl.innerHTML =
                    '<div class="text-muted" style="font-size:0.8rem; padding:8px;">No cards currently drawn or in play.</div>';
            } else {
                drawListEl.innerHTML = drawnCards
                    .map(
                        (c) => `
                    <div class="deck-drawn-card-item" draggable="true" data-card-id="${c.id}" style="width:110px; cursor:grab; border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.2); background:#18181b; padding:6px; display:flex; flex-direction:column; gap:4px; align-items:center;">
                        <img src="${escapeHtml(c.frontImg)}" alt="${escapeHtml(c.name)}" style="width:100%; height:130px; object-fit:contain; border-radius:4px; background:#000;">
                        <div style="font-size:0.75rem; font-weight:600; text-align:center; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${escapeHtml(c.name)}</div>
                        <div class="flex-row" style="gap:4px; width:100%;">
                            <button class="btn btn-xxs btn-danger btn-card-discard" data-deck="${deck.id}" data-card="${c.id}" style="flex:1;" title="Discard Card"><i class="fa-solid fa-trash-can"></i></button>
                            <button class="btn btn-xxs btn-primary btn-card-play" data-deck="${deck.id}" data-card="${c.id}" style="flex:1;" title="Play to Canvas"><i class="fa-solid fa-map"></i></button>
                        </div>
                    </div>
                `
                    )
                    .join('');

                drawListEl.querySelectorAll('.deck-drawn-card-item').forEach((itemEl) => {
                    itemEl.addEventListener('dragstart', (e) => {
                        const cardId = itemEl.dataset.cardId;
                        const c = deck.cards.find((card) => card.id === cardId);
                        if (!c) return;
                        const payload = JSON.stringify({
                            type: 'card',
                            cardId: c.id,
                            deckId: deck.id,
                            name: c.name,
                            frontImg: c.frontImg,
                            deckBackImg: deck.backImg,
                            deckName: deck.name,
                            description: c.description
                        });
                        e.dataTransfer.setData('application/json', payload);
                        e.dataTransfer.setData('text/plain', payload);
                        e.dataTransfer.effectAllowed = 'copy';
                    });
                });

                drawListEl.querySelectorAll('.btn-card-discard').forEach((b) => {
                    b.addEventListener('click', () => {
                        discardCardFromDrawn(b.dataset.deck, b.dataset.card);
                    });
                });
                drawListEl.querySelectorAll('.btn-card-play').forEach((b) => {
                    b.addEventListener('click', () => {
                        const targetCard = deck.cards.find((c) => c.id === b.dataset.card);
                        if (targetCard) playCardToCanvas(deck, targetCard);
                    });
                });
            }
        }

        // Render discard pile
        const discardCards = (deck.state.discardPile || [])
            .map((id) => deck.cards.find((c) => c.id === id))
            .filter(Boolean);
        if (discardListEl) {
            if (discardCards.length === 0) {
                discardListEl.innerHTML =
                    '<div class="text-muted" style="font-size:0.8rem; padding:8px;">Discard pile is empty.</div>';
            } else {
                discardListEl.innerHTML = discardCards
                    .map(
                        (c) => `
                    <div style="width:90px; border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#111; padding:4px; display:flex; flex-direction:column; align-items:center; opacity:0.75;">
                        <img src="${escapeHtml(c.frontImg)}" alt="${escapeHtml(c.name)}" style="width:100%; height:100px; object-fit:contain;">
                        <div style="font-size:0.7rem; color:var(--color-text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${escapeHtml(c.name)}</div>
                    </div>
                `
                    )
                    .join('');
            }
        }
    }

    function discardCardFromDrawn(deckId, cardId) {
        const deck = (getState().decks || []).find((d) => d.id === deckId);
        if (!deck) return;
        ensureDeckState(deck);

        deck.state.drawnCards = (deck.state.drawnCards || []).filter((id) => id !== cardId);
        deck.state.discardPile.push(cardId);
        broadcastDeckState(deck.id, deck.state);
        renderDeckCardsViewer(deck);
    }

    // --- CRUD OPERATIONS ---
    // 1. Roll Tables
    function openEditTableModal(tableId = null) {
        editingTableId = tableId;
        const nameInput = document.getElementById('edit-table-name');
        const descInput = document.getElementById('edit-table-desc');
        const allowPlayersInput = document.getElementById('edit-table-allow-players');
        const entriesContainer = document.getElementById('edit-table-entries-container');

        if (!modalEditTable) return;

        let table = null;
        if (tableId) {
            table = (getState().tables || []).find((t) => t.id === tableId);
        }

        if (nameInput) nameInput.value = table?.name || '';
        if (descInput) descInput.value = table?.description || '';
        if (allowPlayersInput) allowPlayersInput.checked = !!table?.allowPlayers;

        const entries = table?.entries ? JSON.parse(JSON.stringify(table.entries)) : [];
        renderTableEntriesEditor(entries, entriesContainer);

        modalEditTable.classList.remove('vtt-hidden');
    }

    function renderTableEntriesEditor(entries, container) {
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">Table Entries (${entries.length}):</label>
                <button type="button" class="btn btn-xxs btn-secondary btn-add-table-entry"><i class="fa-solid fa-plus"></i> Add Entry</button>
            </div>
            <div class="scroll-styled table-entries-rows" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${entries
                    .map(
                        (e, idx) => `
                    <div class="table-entry-row flex-row" style="gap:6px; align-items:center; background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);" data-idx="${idx}">
                        <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:bold; width:22px; text-align:center;">${idx + 1}</span>
                        <input type="text" class="entry-name" value="${escapeHtml(e.name || '')}" placeholder="Title / Result" style="width:120px; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="entry-text" value="${escapeHtml(e.text || '')}" placeholder="Description / details (optional)" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <button type="button" class="btn btn-xxs btn-danger btn-del-entry"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;

        container.querySelector('.btn-add-table-entry').addEventListener('click', () => {
            entries.push({ id: `entry_${Date.now()}_${entries.length}`, name: '', text: '' });
            renderTableEntriesEditor(entries, container);
        });

        container.querySelectorAll('.btn-del-entry').forEach((b) => {
            b.addEventListener('click', (ev) => {
                const row = ev.target.closest('.table-entry-row');
                const idx = parseInt(row.dataset.idx, 10);
                entries.splice(idx, 1);
                renderTableEntriesEditor(entries, container);
            });
        });

        // Store entries reference on container
        container._entries = entries;
    }

    function saveTableFromModal() {
        const nameInput = document.getElementById('edit-table-name');
        const descInput = document.getElementById('edit-table-desc');
        const allowPlayersInput = document.getElementById('edit-table-allow-players');
        const entriesContainer = document.getElementById('edit-table-entries-container');

        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert('Please provide a name for this roll table.');
            return;
        }

        // Collect rows
        const rows = entriesContainer.querySelectorAll('.table-entry-row');
        const entries = [];
        rows.forEach((row, idx) => {
            const rowName = row.querySelector('.entry-name').value.trim() || `Option ${idx + 1}`;
            const rowText = row.querySelector('.entry-text').value.trim();
            entries.push({ id: `e_${idx + 1}`, name: rowName, text: rowText });
        });

        const state = getState();
        const tables = state.tables;
        if (editingTableId) {
            const existing = tables.find((t) => t.id === editingTableId);
            if (existing) {
                existing.name = name;
                existing.description = descInput ? descInput.value.trim() : '';
                existing.allowPlayers = allowPlayersInput ? allowPlayersInput.checked : false;
                existing.entries = entries;
            }
        } else {
            tables.push({
                id: `table_${Date.now()}`,
                name,
                description: descInput ? descInput.value.trim() : '',
                allowPlayers: allowPlayersInput ? allowPlayersInput.checked : false,
                entries
            });
        }

        broadcastState();
        if (modalEditTable) modalEditTable.classList.add('vtt-hidden');
    }

    function cloneTable(tableId) {
        const state = getState();
        const table = (state.tables || []).find((t) => t.id === tableId);
        if (!table) return;

        const cloned = JSON.parse(JSON.stringify(table));
        cloned.id = `table_${Date.now()}`;
        cloned.name = `${cloned.name} (Copy)`;
        state.tables.push(cloned);
        broadcastState();
    }

    function deleteTable(tableId) {
        if (!confirm('Are you sure you want to delete this roll table?')) return;
        const state = getState();
        state.tables = (state.tables || []).filter((t) => t.id !== tableId);
        broadcastState();
    }

    // 2. Asset Tables (Flippable Tokens)
    function openEditAssetTableModal(tableId = null) {
        editingAssetTableId = tableId;
        const nameInput = document.getElementById('edit-asset-table-name');
        const sizeSelect = document.getElementById('edit-asset-table-size');
        const entriesContainer = document.getElementById('edit-asset-table-entries-container');

        if (!modalEditAssetTable) return;

        let table = null;
        if (tableId) {
            table = (getState().assetTables || []).find((t) => t.id === tableId);
        }

        if (nameInput) nameInput.value = table?.name || '';
        if (sizeSelect) sizeSelect.value = table?.defaultTokenSize || 1;

        const entries = table?.entries ? JSON.parse(JSON.stringify(table.entries)) : [];
        renderAssetTableEntriesEditor(entries, entriesContainer);

        modalEditAssetTable.classList.remove('vtt-hidden');
    }

    function renderAssetTableEntriesEditor(entries, container) {
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:6px; flex-wrap:wrap;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">Artworks / Sides (${entries.length}):</label>
                <div class="flex-row" style="gap:4px;">
                    <button type="button" class="btn btn-xxs btn-primary btn-add-from-gallery" title="Select images from Asset Gallery"><i class="fa-solid fa-images"></i> Add from Gallery</button>
                    <button type="button" class="btn btn-xxs btn-secondary btn-add-asset-side"><i class="fa-solid fa-plus"></i> Add Side</button>
                </div>
            </div>
            <div class="scroll-styled asset-side-rows" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${entries
                    .map(
                        (e, idx) => `
                    <div class="asset-side-row flex-row" style="gap:6px; align-items:center; background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);" data-idx="${idx}">
                        <div style="width:32px; height:32px; border-radius:4px; overflow:hidden; background:#000; flex-shrink:0;">
                            <img src="${escapeHtml(e.url || 'favicon.svg')}" alt="Preview" style="width:100%; height:100%; object-fit:cover;" data-fallback-src="favicon.svg">
                        </div>
                        <input type="text" class="side-name" value="${escapeHtml(e.name || '')}" placeholder="Label (e.g. Active, Broken)" style="width:120px; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="side-url" value="${escapeHtml(e.url || '')}" placeholder="Artwork Image / Video URL" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <button type="button" class="btn btn-xxs btn-secondary btn-pick-gallery-side" title="Pick from Asset Gallery"><i class="fa-solid fa-images"></i></button>
                        <button type="button" class="btn btn-xxs btn-danger btn-del-side" title="Remove Side"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;

        container.querySelector('.btn-add-asset-side').addEventListener('click', () => {
            entries.push({ id: `side_${Date.now()}_${entries.length}`, name: `Side ${entries.length + 1}`, url: '' });
            renderAssetTableEntriesEditor(entries, container);
        });

        const btnAddGallery = container.querySelector('.btn-add-from-gallery');
        if (btnAddGallery) {
            btnAddGallery.addEventListener('click', () => {
                if (window.VTT?.openAssetPickerModal) {
                    window.VTT.openAssetPickerModal({
                        multiSelect: true,
                        onSelect: (selectedList) => {
                            if (!Array.isArray(selectedList) || selectedList.length === 0) return;
                            selectedList.forEach((asset, idx) => {
                                const cleanName = (asset.name || `Side ${entries.length + 1}`).replace(/\.[^/.]+$/, '');
                                entries.push({
                                    id: `side_${Date.now()}_${entries.length + idx}`,
                                    name: cleanName,
                                    url: asset.url || ''
                                });
                            });
                            renderAssetTableEntriesEditor(entries, container);
                        }
                    });
                } else {
                    alert('Asset gallery picker is not initialized.');
                }
            });
        }

        container.querySelectorAll('.btn-pick-gallery-side').forEach((b) => {
            b.addEventListener('click', (ev) => {
                const row = ev.target.closest('.asset-side-row');
                const idx = parseInt(row.dataset.idx, 10);
                if (window.VTT?.openAssetPickerModal) {
                    window.VTT.openAssetPickerModal({
                        multiSelect: false,
                        onSelect: (selectedList) => {
                            if (!Array.isArray(selectedList) || selectedList.length === 0) return;
                            const asset = selectedList[0];
                            entries[idx].url = asset.url;
                            if (!entries[idx].name || entries[idx].name.startsWith('Side ')) {
                                entries[idx].name = (asset.name || '').replace(/\.[^/.]+$/, '') || entries[idx].name;
                            }
                            renderAssetTableEntriesEditor(entries, container);
                        }
                    });
                }
            });
        });

        container.querySelectorAll('.btn-del-side').forEach((b) => {
            b.addEventListener('click', (ev) => {
                const row = ev.target.closest('.asset-side-row');
                const idx = parseInt(row.dataset.idx, 10);
                entries.splice(idx, 1);
                renderAssetTableEntriesEditor(entries, container);
            });
        });

        container.querySelectorAll('.side-url').forEach((input) => {
            input.addEventListener('change', () => {
                const row = input.closest('.asset-side-row');
                const idx = parseInt(row.dataset.idx, 10);
                if (entries[idx]) entries[idx].url = input.value.trim();
                const img = row.querySelector('img');
                if (img) img.src = input.value.trim() || 'favicon.svg';
            });
        });

        container.querySelectorAll('.side-name').forEach((input) => {
            input.addEventListener('change', () => {
                const row = input.closest('.asset-side-row');
                const idx = parseInt(row.dataset.idx, 10);
                if (entries[idx]) entries[idx].name = input.value.trim();
            });
        });
    }

    function openAssetTableWithAssets(assets = []) {
        editingAssetTableId = null;
        const nameInput = document.getElementById('edit-asset-table-name');
        const sizeSelect = document.getElementById('edit-asset-table-size');
        const entriesContainer = document.getElementById('edit-asset-table-entries-container');

        if (nameInput) {
            const firstClean =
                assets.length > 0 && assets[0]?.name ? assets[0].name.replace(/\.[^/.]+$/, '') : 'New Asset Table';
            nameInput.value = assets.length > 0 ? `${firstClean} Set` : 'New Asset Table';
        }
        if (sizeSelect) sizeSelect.value = 1;

        const entries = assets.map((a, idx) => ({
            id: `side_${Date.now()}_${idx}`,
            name: (a.name || `Side ${idx + 1}`).replace(/\.[^/.]+$/, ''),
            url: a.url || ''
        }));

        renderAssetTableEntriesEditor(entries, entriesContainer);
        if (modalEditAssetTable) modalEditAssetTable.classList.remove('vtt-hidden');
    }

    function saveAssetTableFromModal() {
        const nameInput = document.getElementById('edit-asset-table-name');
        const sizeSelect = document.getElementById('edit-asset-table-size');
        const entriesContainer = document.getElementById('edit-asset-table-entries-container');

        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert('Please provide a name for this asset table.');
            return;
        }

        const rows = entriesContainer.querySelectorAll('.asset-side-row');
        const entries = [];
        rows.forEach((row, idx) => {
            const sideName = row.querySelector('.side-name').value.trim() || `Side ${idx + 1}`;
            const sideUrl = row.querySelector('.side-url').value.trim();
            if (sideUrl) {
                entries.push({ id: `side_${idx + 1}`, name: sideName, url: sideUrl });
            }
        });

        if (entries.length === 0) {
            alert('Please add at least one artwork URL to the asset table.');
            return;
        }

        const size = sizeSelect ? parseFloat(sizeSelect.value) || 1 : 1;
        const state = getState();
        const tables = state.assetTables;

        if (editingAssetTableId) {
            const existing = tables.find((t) => t.id === editingAssetTableId);
            if (existing) {
                existing.name = name;
                existing.defaultTokenSize = size;
                existing.entries = entries;
            }
        } else {
            tables.push({
                id: `asset_table_${Date.now()}`,
                name,
                defaultTokenSize: size,
                entries
            });
        }

        broadcastState();
        if (modalEditAssetTable) modalEditAssetTable.classList.add('vtt-hidden');
    }

    function deleteAssetTable(tableId) {
        if (!confirm('Are you sure you want to delete this asset table?')) return;
        const state = getState();
        state.assetTables = (state.assetTables || []).filter((t) => t.id !== tableId);
        broadcastState();
    }

    // 3. Card Decks
    function openEditDeckModal(deckId = null) {
        editingDeckId = deckId;
        const nameInput = document.getElementById('edit-deck-name');
        const backImgInput = document.getElementById('edit-deck-back');
        const cardsContainer = document.getElementById('edit-deck-cards-container');

        if (!modalEditDeck) return;

        let deck = null;
        if (deckId) {
            deck = (getState().decks || []).find((d) => d.id === deckId);
        }

        if (nameInput) nameInput.value = deck?.name || '';
        if (backImgInput) backImgInput.value = deck?.backImg || '';

        const cards = deck?.cards ? JSON.parse(JSON.stringify(deck.cards)) : [];
        renderDeckCardsEditor(cards, cardsContainer);

        modalEditDeck.classList.remove('vtt-hidden');
    }

    function renderDeckCardsEditor(cards, container) {
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">Deck Cards (${cards.length}):</label>
                <button type="button" class="btn btn-xxs btn-secondary btn-add-deck-card"><i class="fa-solid fa-plus"></i> Add Card</button>
            </div>
            <div class="scroll-styled deck-card-rows" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${cards
                    .map(
                        (c, idx) => `
                    <div class="deck-card-row flex-row" style="gap:6px; align-items:center; background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);" data-idx="${idx}">
                        <div style="width:30px; height:42px; border-radius:3px; overflow:hidden; background:#000; flex-shrink:0;">
                            <img src="${escapeHtml(c.frontImg || 'favicon.svg')}" alt="Card" style="width:100%; height:100%; object-fit:contain;" data-fallback-src="favicon.svg">
                        </div>
                        <input type="text" class="card-name" value="${escapeHtml(c.name || '')}" placeholder="Card Name" style="width:110px; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="card-url" value="${escapeHtml(c.frontImg || '')}" placeholder="Front Artwork URL" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="card-desc" value="${escapeHtml(c.description || '')}" placeholder="Description / Text" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <button type="button" class="btn btn-xxs btn-danger btn-del-card"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;

        container.querySelector('.btn-add-deck-card').addEventListener('click', () => {
            cards.push({ id: `card_${Date.now()}_${cards.length}`, name: '', frontImg: '', description: '' });
            renderDeckCardsEditor(cards, container);
        });

        container.querySelectorAll('.btn-del-card').forEach((b) => {
            b.addEventListener('click', (ev) => {
                const row = ev.target.closest('.deck-card-row');
                const idx = parseInt(row.dataset.idx, 10);
                cards.splice(idx, 1);
                renderDeckCardsEditor(cards, container);
            });
        });

        container.querySelectorAll('.card-url').forEach((input) => {
            input.addEventListener('change', () => {
                const row = input.closest('.deck-card-row');
                const img = row.querySelector('img');
                if (img) img.src = input.value.trim() || 'favicon.svg';
            });
        });
    }

    function saveDeckFromModal() {
        const nameInput = document.getElementById('edit-deck-name');
        const backImgInput = document.getElementById('edit-deck-back');
        const cardsContainer = document.getElementById('edit-deck-cards-container');

        const name = nameInput ? nameInput.value.trim() : '';
        const backImg = backImgInput ? backImgInput.value.trim() || 'img/TextLogo.png' : 'img/TextLogo.png';
        if (!name) {
            alert('Please provide a name for this card deck.');
            return;
        }

        const rows = cardsContainer.querySelectorAll('.deck-card-row');
        const cards = [];
        rows.forEach((row, idx) => {
            const cardName = row.querySelector('.card-name').value.trim() || `Card ${idx + 1}`;
            const cardUrl = row.querySelector('.card-url').value.trim();
            const cardDesc = row.querySelector('.card-desc').value.trim();
            if (cardUrl || cardName) {
                cards.push({ id: `card_${idx + 1}`, name: cardName, frontImg: cardUrl, description: cardDesc });
            }
        });

        const state = getState();
        const decks = state.decks;
        if (editingDeckId) {
            const existing = decks.find((d) => d.id === editingDeckId);
            if (existing) {
                existing.name = name;
                existing.backImg = backImg;
                existing.cards = cards;
                // Re-sync draw pile IDs with any modified/added cards
                ensureDeckState(existing);
            }
        } else {
            const newDeck = {
                id: `deck_${Date.now()}`,
                name,
                backImg,
                cards,
                state: { drawPile: shuffleArray(cards.map((c) => c.id)), discardPile: [], drawnCards: [] }
            };
            decks.push(newDeck);
        }

        broadcastState();
        if (modalEditDeck) modalEditDeck.classList.add('vtt-hidden');
    }

    function deleteDeck(deckId) {
        if (!confirm('Are you sure you want to delete this deck?')) return;
        const state = getState();
        state.decks = (state.decks || []).filter((d) => d.id !== deckId);
        broadcastState();
    }

    // --- UNIFIED TABLE PICKER & IMPORTER MODAL ---
    let compendiumCatalog = null;
    let compendiumCatalogLoading = false;
    let pickerSearchQuery = '';
    let pickerSourceFilter = '';
    let pickerDiceFilter = '';
    let pickerSortField = 'name';
    let pickerSortDirection = 'asc';
    let selectedCompendiumTableId = null;
    let selectedCompendiumTableData = null;

    // Compendium Decks Catalog & Previewer
    let compendiumDecksCatalog = null;
    let compendiumDecksLoading = false;
    let pickerDeckSearchQuery = '';
    let selectedCompendiumDeckId = null;
    let selectedCompendiumDeckData = null;

    function openLoadPresetsModal(tab = 'compendium') {
        openTablePickerModal(tab);
    }

    function openTablePickerModal(defaultTab = 'compendium') {
        if (!modalTablePicker) return;

        // Switch Tab
        switchPickerTab(defaultTab);

        modalTablePicker.classList.remove('vtt-hidden');

        if (defaultTab === 'compendium' && !compendiumCatalog && !compendiumCatalogLoading) {
            loadCompendiumCatalog();
        } else if (defaultTab === 'decks' && !compendiumDecksCatalog && !compendiumDecksLoading) {
            loadCompendiumDecksCatalog();
        }
    }

    function switchPickerTab(tabName) {
        const tabs = modalTablePicker.querySelectorAll('.picker-tab-btn');
        tabs.forEach((t) => {
            const isActive = t.dataset.tab === tabName;
            t.classList.toggle('active', isActive);
            t.style.color = isActive ? 'var(--color-gold-light)' : 'var(--color-text-secondary)';
            t.style.borderBottomColor = isActive ? 'var(--color-gold-base)' : 'transparent';
        });

        const contentComp = document.getElementById('picker-tab-content-compendium');
        const contentPres = document.getElementById('picker-tab-content-presets');
        const contentDecks = document.getElementById('picker-tab-content-decks');

        if (contentComp) contentComp.classList.toggle('vtt-hidden', tabName !== 'compendium');
        if (contentPres) contentPres.classList.toggle('vtt-hidden', tabName !== 'presets');
        if (contentDecks) contentDecks.classList.toggle('vtt-hidden', tabName !== 'decks');

        if (tabName === 'compendium' && !compendiumCatalog && !compendiumCatalogLoading) {
            loadCompendiumCatalog();
        } else if (tabName === 'decks' && !compendiumDecksCatalog && !compendiumDecksLoading) {
            loadCompendiumDecksCatalog();
        }
    }

    async function loadCompendiumCatalog() {
        compendiumCatalogLoading = true;
        const rowsContainer = document.getElementById('picker-table-rows');
        if (rowsContainer) {
            rowsContainer.innerHTML = `
                    <div class="p-3 text-muted" style="text-align:center; padding:32px 0;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:8px;"></i>
                        <div>Loading tables...</div>
                    </div>
                `;
        }

        try {
            const res = await fetch('/api/tables/catalog');
            if (!res.ok) throw new Error('Failed to fetch tables catalog');
            compendiumCatalog = await res.json();

            // Populate source filter dropdown
            const sourceSelect = document.getElementById('picker-source-select');
            if (sourceSelect) {
                const sources = Array.from(new Set(compendiumCatalog.map((t) => t.source).filter(Boolean))).sort();
                sourceSelect.innerHTML =
                    `<option value="">All Sources</option>` +
                    sources.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
            }

            renderPickerTableRows();
        } catch (err) {
            console.error('Error loading compendium tables catalog:', err);
            if (rowsContainer) {
                rowsContainer.innerHTML = `
                        <div class="p-3 text-danger" style="text-align:center; padding:24px 0;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Error loading tables.
                        </div>
                    `;
            }
        } finally {
            compendiumCatalogLoading = false;
        }
    }

    function renderPickerTableRows() {
        const rowsContainer = document.getElementById('picker-table-rows');
        const countLabel = document.getElementById('picker-count-label');
        if (!rowsContainer) return;
        if (!compendiumCatalog) return;

        // 1. Filtering
        let filtered = compendiumCatalog.filter((tbl) => {
            if (pickerSourceFilter && tbl.source !== pickerSourceFilter) return false;
            if (pickerDiceFilter) {
                const targetDice = pickerDiceFilter.toLowerCase();
                const diceVal = (tbl.dice || '').toLowerCase();
                if (!diceVal.includes(targetDice)) return false;
            }
            if (pickerSearchQuery) {
                const q = pickerSearchQuery.toLowerCase();
                const name = (tbl.name || '').toLowerCase();
                const chapter = (tbl.chapter || '').toLowerCase();
                if (!name.includes(q) && !chapter.includes(q)) return false;
            }
            return true;
        });

        // 2. Sorting
        filtered.sort((a, b) => {
            let comp = 0;
            if (pickerSortField === 'name') {
                comp = (a.name || '').localeCompare(b.name || '');
            } else if (pickerSortField === 'source') {
                comp = (a.source || '').localeCompare(b.source || '');
            } else if (pickerSortField === 'dice') {
                comp = (a.dice || '').localeCompare(b.dice || '', undefined, { numeric: true });
            }
            return pickerSortDirection === 'asc' ? comp : -comp;
        });

        // Update Sort Indicators on headers
        const headers = modalTablePicker.querySelectorAll('.picker-th.sortable');
        headers.forEach((th) => {
            const field = th.dataset.sort;
            const isField = field === pickerSortField;
            th.classList.toggle('sorted', isField);
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                if (isField) {
                    icon.className = `fa-solid ${pickerSortDirection === 'asc' ? 'fa-arrow-down-a-z' : 'fa-arrow-up-a-z'} sort-icon`;
                    icon.style.opacity = '1';
                } else {
                    icon.className = 'fa-solid fa-sort sort-icon';
                    icon.style.opacity = '0.35';
                }
            }
        });

        if (countLabel) {
            countLabel.textContent = `${filtered.length} ${filtered.length === 1 ? 'table' : 'tables'}`;
        }

        if (filtered.length === 0) {
            rowsContainer.innerHTML = `
                    <div style="padding:32px 16px; text-align:center; color:var(--color-text-muted);">
                        <i class="fa-solid fa-filter-circle-xmark" style="font-size:2rem; opacity:0.3; margin-bottom:8px;"></i>
                        <p style="margin:0; font-size:0.85rem;">No tables found matching your filters.</p>
                    </div>
                `;
            return;
        }

        rowsContainer.innerHTML = filtered
            .map((t) => {
                const isSelected = t.id === selectedCompendiumTableId;
                return `
                    <div class="picker-row ${isSelected ? 'selected' : ''}" data-id="${t.id}">
                        <div style="flex:2; font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;" title="${escapeHtml(t.name)}">
                            ${escapeHtml(t.name)}
                        </div>
                        <div style="width:80px; text-align:center; font-size:0.75rem; color:var(--color-gold-light); font-weight:600;">
                            ${escapeHtml(t.source)}
                        </div>
                        <div style="width:80px; text-align:center; font-size:0.75rem; color:#60a5fa; font-weight:600;">
                            ${escapeHtml(t.dice)}
                        </div>
                        <div class="flex-row" style="width:140px; justify-content:flex-end; gap:4px;">
                            <button type="button" class="btn btn-xxs btn-secondary btn-picker-row-preview" data-id="${t.id}" title="Preview and roll"><i class="fa-solid fa-eye"></i></button>
                            <button type="button" class="btn btn-xxs btn-primary btn-picker-row-load" data-id="${t.id}" title="Load into Campaign"><i class="fa-solid fa-download"></i> Load</button>
                        </div>
                    </div>
                `;
            })
            .join('');

        // Row click listeners
        rowsContainer.querySelectorAll('.picker-row').forEach((row) => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-picker-row-load')) return; // Handled separately
                const id = row.dataset.id;
                previewCompendiumTable(id);
            });
        });

        rowsContainer.querySelectorAll('.btn-picker-row-load').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                loadCompendiumTableToCampaign(id);
            });
        });
    }

    async function previewCompendiumTable(tableId) {
        selectedCompendiumTableId = tableId;

        // Highlight selected row in table
        const rowsContainer = document.getElementById('picker-table-rows');
        if (rowsContainer) {
            rowsContainer.querySelectorAll('.picker-row').forEach((r) => {
                r.classList.toggle('selected', r.dataset.id === tableId);
            });
        }

        const placeholder = document.getElementById('picker-preview-placeholder');
        const content = document.getElementById('picker-preview-content');
        if (placeholder) placeholder.classList.add('vtt-hidden');
        if (content) content.classList.remove('vtt-hidden');

        const nameEl = document.getElementById('preview-table-name');
        const sourceEl = document.getElementById('preview-table-source');
        const diceEl = document.getElementById('preview-table-dice');
        const countEl = document.getElementById('preview-table-count');
        const tableEl = document.getElementById('preview-entries-table');

        if (tableEl) {
            tableEl.innerHTML = `<tr><td style="padding:16px; text-align:center; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading table breakdown...</td></tr>`;
        }

        try {
            const res = await fetch(`/api/tables/${tableId}`);
            if (!res.ok) throw new Error('Table not found');
            const data = await res.json();
            selectedCompendiumTableData = data;

            if (nameEl) nameEl.textContent = data.name;
            if (sourceEl) sourceEl.textContent = data.source;
            if (diceEl) diceEl.textContent = data.dice;
            if (countEl) countEl.textContent = `${data.rows.length} entries`;

            // Render Table Headers & Rows
            if (tableEl) {
                const colHeaders = (data.colLabels || ['Roll', 'Result'])
                    .map(
                        (h) =>
                            `<th style="text-align:left; padding:6px 8px; background:rgba(0,0,0,0.4); border-bottom:1px solid rgba(255,255,255,0.1); color:var(--color-gold-light); font-weight:600;">${escapeHtml(h)}</th>`
                    )
                    .join('');

                const rowsHtml = (data.rows || [])
                    .map((row, idx) => {
                        const cells = Array.isArray(row) ? row : [row];
                        const cellsHtml = cells
                            .map(
                                (c, cIdx) =>
                                    `<td style="padding:5px 8px; border-bottom:1px solid rgba(255,255,255,0.04); color:${cIdx === 0 ? '#60a5fa' : '#cbd5e1'}; font-weight:${cIdx === 0 ? '600' : 'normal'}; vertical-align:top;">${escapeHtml(String(c))}</td>`
                            )
                            .join('');
                        return `<tr>${cellsHtml}</tr>`;
                    })
                    .join('');

                tableEl.innerHTML = `<thead><tr>${colHeaders}</tr></thead><tbody>${rowsHtml}</tbody>`;
            }
        } catch (err) {
            console.error('Error fetching table details:', err);
            if (tableEl) {
                tableEl.innerHTML = `<tr><td style="padding:16px; text-align:center; color:#f87171;">Failed to load table details.</td></tr>`;
            }
        }
    }

    async function loadCompendiumTableToCampaign(tableId) {
        let data = selectedCompendiumTableData;
        if (!data || data.id !== tableId) {
            try {
                const res = await fetch(`/api/tables/${tableId}`);
                if (!res.ok) throw new Error('Table not found');
                data = await res.json();
            } catch (err) {
                alert('Could not load table data.');
                return;
            }
        }

        const entries = (data.rows || []).map((row, idx) => {
            const cells = Array.isArray(row) ? row : [row];
            const name = cells.length > 1 ? `${cells[0]}: ${cells[1]}` : cells[0] || `Option ${idx + 1}`;
            const text = cells.length > 2 ? cells.slice(2).join(' — ') : cells.length > 1 ? cells[1] : '';
            return { id: `e_${idx + 1}`, name, text };
        });

        const state = getState();
        state.tables.push({
            id: `table_${Date.now()}`,
            name: data.name,
            description: `Source: ${data.source}`,
            allowPlayers: false,
            entries
        });

        broadcastState();
        if (vtt.toast) vtt.toast(`Loaded "${data.name}" into campaign tables!`);
        if (modalTablePicker) modalTablePicker.classList.add('vtt-hidden');
    }

    function rollCompendiumTableDirectly() {
        if (
            !selectedCompendiumTableData ||
            !selectedCompendiumTableData.rows ||
            selectedCompendiumTableData.rows.length === 0
        ) {
            if (vtt.toast) vtt.toast('Select a valid table to roll.', 'warning');
            return;
        }

        const data = selectedCompendiumTableData;
        let faces = data.rows.length;
        const diceMatch = (data.dice || '').match(/\b(?:1?d)?(\d+)\b/i);
        if (diceMatch) {
            faces = parseInt(diceMatch[1], 10);
        }
        const rollVal = Math.floor(Math.random() * faces) + 1;
        const matched = findRowForRoll(data.rows, rollVal);
        const cells = matched ? (Array.isArray(matched.row) ? matched.row : [matched.row]) : [`Result #${rollVal}`];

        let entryName = '';
        let entryText = '';
        if (cells.length === 1) {
            entryName = cleanTableText(cells[0]);
        } else if (cells.length === 2) {
            entryName = `Roll [${cells[0]}]`;
            entryText = cleanTableText(cells[1]);
        } else {
            entryName = `${cells[0]}: ${cleanTableText(cells[1])}`;
            entryText = cleanTableText(cells.slice(2).join(' — '));
        }

        // 3D dice
        if (window.Dice3D && typeof window.Dice3D.showDiceRoll === 'function') {
            try {
                window.Dice3D.showDiceRoll([{ faces, val: rollVal }]);
            } catch (err) {}
        }

        const formulaStr = data.dice || `1d${faces}`;

        // Rich chat card
        const chatHtml = `
                <div class="rolltable-chat-card" style="border: 1px solid var(--color-gold-base); border-radius: 6px; padding: 10px; background: rgba(18, 22, 33, 0.95); box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gold-light); font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                        <span><i class="fa-solid fa-dice-d20"></i> ${escapeHtml(data.name)}</span>
                        <span style="color: #60a5fa;">[${escapeHtml(formulaStr)}: ${rollVal}]</span>
                    </div>
                    <div style="font-weight: 600; font-size: 0.95rem; color: #fff; margin-bottom: 2px;">
                        ${escapeHtml(entryName)}
                    </div>
                    ${entryText ? `<div style="font-size: 0.85rem; color: var(--color-text-secondary); line-height: 1.4;">${escapeHtml(entryText)}</div>` : ''}
                </div>
            `;

        if (vtt.socket) {
            vtt.socket.emit('chat:msg', {
                html: chatHtml,
                rollTableCard: {
                    tableName: data.name,
                    formula: formulaStr,
                    roll: rollVal,
                    entryName,
                    entryText
                },
                text: `Rolled on table ${data.name}: ${entryName}`
            });
        }

        if (vtt.toast) vtt.toast(`Rolled on ${data.name}!`);
    }

    // --- COMPENDIUM DECKS CATALOG & LOADER ---
    async function loadCompendiumDecksCatalog() {
        compendiumDecksLoading = true;
        const listContainer = document.getElementById('picker-deck-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="p-3 text-muted" style="text-align:center; padding:32px 0;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:8px;"></i>
                    <div>Loading card decks...</div>
                </div>
            `;
        }

        try {
            const res = await fetch('/api/decks/catalog');
            if (!res.ok) throw new Error('Failed to fetch card decks catalog');
            compendiumDecksCatalog = await res.json();
            renderCompendiumDecksRows();
        } catch (err) {
            console.error('Error loading compendium decks catalog:', err);
            if (listContainer) {
                listContainer.innerHTML = `
                    <div class="p-3 text-danger" style="text-align:center; padding:24px 0;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Error loading card decks.
                    </div>
                `;
            }
        } finally {
            compendiumDecksLoading = false;
        }
    }

    function renderCompendiumDecksRows() {
        const listContainer = document.getElementById('picker-deck-list');
        const countLabel = document.getElementById('picker-deck-count-label');
        if (!listContainer || !compendiumDecksCatalog) return;

        let filtered = compendiumDecksCatalog.filter((d) => {
            if (pickerDeckSearchQuery) {
                const q = pickerDeckSearchQuery.toLowerCase();
                const name = (d.name || '').toLowerCase();
                const desc = (d.description || '').toLowerCase();
                if (!name.includes(q) && !desc.includes(q)) return false;
            }
            return true;
        });

        if (countLabel) {
            countLabel.textContent = `${filtered.length} ${filtered.length === 1 ? 'deck' : 'decks'}`;
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="padding:32px 16px; text-align:center; color:var(--color-text-muted);">
                    <i class="fa-solid fa-filter-circle-xmark" style="font-size:2rem; opacity:0.3; margin-bottom:8px;"></i>
                    <p style="margin:0; font-size:0.85rem;">No card decks match your search.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered
            .map((d) => {
                const isSelected = d.id === selectedCompendiumDeckId;
                return `
                <div class="picker-deck-card ${isSelected ? 'selected' : ''}" data-id="${d.id}" style="padding:10px 12px; background:rgba(255,255,255,${isSelected ? '0.08' : '0.03'}); border:1px solid ${isSelected ? 'var(--color-gold-base)' : 'rgba(255,255,255,0.08)'}; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:10px; transition:all 0.2s;">
                    <div style="flex:1; min-width:0;">
                        <div class="flex-row" style="align-items:center; gap:8px;">
                            <span style="font-weight:600; color:#fff; font-size:0.9rem;">${escapeHtml(d.name)}</span>
                            <span style="font-size:0.65rem; padding:1px 6px; border-radius:4px; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.3); color:var(--color-gold-light); font-weight:600;">${escapeHtml(d.source)}</span>
                            <span style="font-size:0.7rem; color:#60a5fa; font-weight:600;">${d.cardCount} cards</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${escapeHtml(d.description || '')}
                        </div>
                    </div>
                    <div class="flex-row" style="gap:4px; flex-shrink:0;">
                        <button type="button" class="btn btn-xxs btn-secondary btn-deck-preview" data-id="${d.id}" title="Preview deck cards"><i class="fa-solid fa-eye"></i></button>
                        <button type="button" class="btn btn-xxs btn-primary btn-deck-load" data-id="${d.id}" title="Load Deck into Campaign"><i class="fa-solid fa-download"></i> Load</button>
                    </div>
                </div>
            `;
            })
            .join('');

        listContainer.querySelectorAll('.picker-deck-card').forEach((el) => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.btn-deck-load')) return;
                previewCompendiumDeck(el.dataset.id);
            });
        });

        listContainer.querySelectorAll('.btn-deck-load').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadCompendiumDeckToCampaign(btn.dataset.id);
            });
        });
    }

    async function previewCompendiumDeck(deckId) {
        selectedCompendiumDeckId = deckId;
        const listContainer = document.getElementById('picker-deck-list');
        if (listContainer) {
            listContainer.querySelectorAll('.picker-deck-card').forEach((c) => {
                c.classList.toggle('selected', c.dataset.id === deckId);
            });
        }

        const placeholder = document.getElementById('picker-deck-preview-placeholder');
        const content = document.getElementById('picker-deck-preview-content');
        if (placeholder) placeholder.classList.add('vtt-hidden');
        if (content) content.classList.remove('vtt-hidden');

        const nameEl = document.getElementById('preview-deck-name');
        const sourceEl = document.getElementById('preview-deck-source');
        const descEl = document.getElementById('preview-deck-desc');
        const countEl = document.getElementById('preview-deck-card-count');
        const cardsContainer = document.getElementById('preview-deck-cards-container');

        if (cardsContainer) {
            cardsContainer.innerHTML =
                '<div style="grid-column: 1/-1; text-align:center; padding:16px; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading cards...</div>';
        }

        try {
            const res = await fetch(`/api/decks/${deckId}`);
            if (!res.ok) throw new Error('Deck details not found');
            const data = await res.json();
            selectedCompendiumDeckData = data;

            if (nameEl) nameEl.textContent = data.name;
            if (sourceEl) sourceEl.textContent = data.source;
            if (descEl) descEl.textContent = data.description || '';
            if (countEl) countEl.textContent = data.cards?.length || data.cardCount || 0;

            if (cardsContainer && Array.isArray(data.cards)) {
                // Ensure front images are generated with high-fantasy Tarot styling
                data.cards.forEach((c) => {
                    if (!c.frontImg) {
                        c.frontImg = renderTarotCardSvg({
                            name: c.cardTitle || c.name,
                            suit: c.suit || '',
                            number: c.number || null,
                            desc: c.description || '',
                            theme: data.theme || 'tarokka'
                        });
                    }
                });
                if (!data.backImg) {
                    data.backImg = renderTarotBackSvg(data.theme || 'tarokka');
                }

                cardsContainer.innerHTML = data.cards
                    .map(
                        (c) => `
                    <div style="border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#0c0a14; display:flex; flex-direction:column; align-items:center; padding:4px;" title="${escapeHtml(c.name)}: ${escapeHtml(c.description || '')}">
                        <img src="${escapeHtml(c.frontImg)}" alt="${escapeHtml(c.name)}" style="width:100%; height:90px; object-fit:contain; border-radius:2px;" data-fallback-src="favicon.svg">
                        <div style="font-size:0.65rem; color:#fff; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; margin-top:2px; font-weight:600;">
                            ${escapeHtml(c.cardTitle || c.name)}
                        </div>
                    </div>
                `
                    )
                    .join('');
            }
        } catch (err) {
            console.error('Error loading deck details:', err);
            if (cardsContainer) {
                cardsContainer.innerHTML =
                    '<div style="grid-column: 1/-1; text-align:center; padding:16px; color:#f87171;">Failed to load cards.</div>';
            }
        }
    }

    async function loadCompendiumDeckToCampaign(deckId) {
        let data = selectedCompendiumDeckData;
        if (!data || data.id !== deckId) {
            try {
                const res = await fetch(`/api/decks/${deckId}`);
                if (!res.ok) throw new Error('Deck not found');
                data = await res.json();
            } catch (e) {
                alert('Could not fetch deck details.');
                return;
            }
        }

        const theme = data.theme || 'tarokka';
        const backImg = data.backImg || renderTarotBackSvg(theme);
        const cards = (data.cards || []).map((c) => {
            const frontImg =
                c.frontImg ||
                renderTarotCardSvg({
                    name: c.cardTitle || c.name,
                    suit: c.suit || '',
                    number: c.number || null,
                    desc: c.description || '',
                    theme
                });
            return {
                id: c.id || `card_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: c.name,
                cardTitle: c.cardTitle || c.name,
                suit: c.suit,
                number: c.number,
                description: c.description || '',
                frontImg
            };
        });

        const state = getState();
        if (!state.decks) state.decks = [];

        const newDeck = {
            id: `deck_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: data.name,
            description: data.description || '',
            backImg,
            theme,
            source: data.source,
            cards,
            state: {
                drawPile: shuffleArray(cards.map((c) => c.id)),
                discardPile: [],
                drawnCards: []
            }
        };

        const existing = state.decks.find((d) => d.name === data.name || (data.id && d.id === data.id));
        if (existing) {
            const dupModal = document.createElement('div');
            dupModal.className = 'vtt-modal';
            dupModal.style.zIndex = '3000';
            dupModal.innerHTML = `
                <div class="modal-content glassmorphism" style="max-width: 440px; padding: 22px; text-align: center; border: 1px solid var(--color-gold-base);">
                    <h4 style="color: var(--color-gold-base); margin-top: 0; margin-bottom: 12px; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fa-solid fa-clone text-gradient-gold"></i> Deck Already In Campaign
                    </h4>
                    <p style="font-size: 0.88rem; color: var(--color-text-primary); margin-bottom: 20px; line-height: 1.4;">
                        The deck <strong>"${escapeHtml(data.name)}"</strong> is already loaded in your campaign. What would you like to do?
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button type="button" class="btn btn-sm btn-primary btn-replace-deck" style="justify-content: center;">
                            <i class="fa-solid fa-arrows-rotate"></i> Replace / Reset Existing Deck
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-copy-deck" style="justify-content: center;">
                            <i class="fa-solid fa-plus"></i> Add as New Copy
                        </button>
                        <button type="button" class="btn btn-xs btn-ghost btn-cancel-deck" style="margin-top: 4px;">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dupModal);

            const closeDup = () => dupModal.remove();

            dupModal.querySelector('.btn-replace-deck').addEventListener('click', () => {
                closeDup();
                existing.cards = cards;
                existing.theme = theme;
                existing.backImg = backImg;
                existing.description = data.description || existing.description || '';
                existing.state = {
                    drawPile: shuffleArray(cards.map((c) => c.id)),
                    discardPile: [],
                    drawnCards: []
                };
                broadcastState();
                if (vtt.toast) vtt.toast(`Reset and reloaded "${data.name}" (${cards.length} cards)!`);
                if (modalTablePicker) modalTablePicker.classList.add('vtt-hidden');
            });

            dupModal.querySelector('.btn-copy-deck').addEventListener('click', () => {
                closeDup();
                let copyNum = 2;
                while (state.decks.some((d) => d.name === `${data.name} (${copyNum})`)) {
                    copyNum++;
                }
                newDeck.name = `${data.name} (${copyNum})`;
                state.decks.push(newDeck);
                broadcastState();
                if (vtt.toast) vtt.toast(`Loaded "${newDeck.name}" (${cards.length} cards) as a new copy!`);
                if (modalTablePicker) modalTablePicker.classList.add('vtt-hidden');
            });

            dupModal.querySelector('.btn-cancel-deck').addEventListener('click', closeDup);
            return;
        }

        state.decks.push(newDeck);
        broadcastState();

        if (vtt.toast) vtt.toast(`Loaded "${data.name}" (${cards.length} cards) into campaign!`);
        if (modalTablePicker) modalTablePicker.classList.add('vtt-hidden');
    }

    const compendiumDetailsCache = new Map();

    async function ensureCompendiumCatalog() {
        if (compendiumCatalog && compendiumCatalog.length > 0) return compendiumCatalog;
        try {
            const res = await fetch('/api/tables/catalog');
            if (res.ok) {
                compendiumCatalog = await res.json();
            }
        } catch (e) {
            console.error('Failed to load compendium tables catalog:', e);
        }
        return compendiumCatalog || [];
    }

    function findTableByItemNameSync(itemName) {
        if (!itemName || typeof itemName !== 'string') return null;
        const cleanName = itemName.toLowerCase().trim();
        const baseClean = cleanName.replace(/\s*\([^)]*\)/g, '').trim();

        // 1. Check custom campaign tables
        const campaignTables = getState().tables || [];
        const campMatch = campaignTables.find((t) => {
            const tn = (t.name || '').toLowerCase().trim();
            return (
                tn === cleanName ||
                tn === `${cleanName} effects` ||
                tn === `${cleanName} table` ||
                tn.startsWith(`${cleanName} —`) ||
                tn.startsWith(`${cleanName} -`)
            );
        });
        if (campMatch) {
            const diceFormula =
                campMatch.dice ||
                campMatch.diceFormula ||
                (Array.isArray(campMatch.rows) && campMatch.rows.length > 0 ? `1d${campMatch.rows.length}` : null) ||
                (Array.isArray(campMatch.entries) && campMatch.entries.length > 0
                    ? `1d${campMatch.entries.length}`
                    : '1d20');

            return {
                id: campMatch.id,
                name: campMatch.name,
                dice: diceFormula
            };
        }

        // 2. Check cached compendium catalog
        if (!compendiumCatalog || compendiumCatalog.length === 0) return null;

        // Best-Match Heuristic
        let match = compendiumCatalog.find((t) => {
            const tn = (t.name || '').toLowerCase().trim();
            return tn === cleanName || tn === `${cleanName} effects` || tn === `${cleanName} table`;
        });
        if (match) return match;

        match = compendiumCatalog.find((t) => {
            const tn = (t.name || '').toLowerCase().trim();
            return (
                tn.startsWith(`${cleanName} —`) ||
                tn.startsWith(`${cleanName} -`) ||
                tn.startsWith(`${cleanName};`) ||
                tn.startsWith(`${cleanName},`)
            );
        });
        if (match) return match;

        if (baseClean && baseClean !== cleanName) {
            match = compendiumCatalog.find((t) => {
                const tn = (t.name || '').toLowerCase().trim();
                return (
                    tn === baseClean ||
                    tn === `${baseClean} effects` ||
                    tn === `${baseClean} table` ||
                    tn.startsWith(`${baseClean} —`) ||
                    tn.startsWith(`${baseClean} -`)
                );
            });
            if (match) return match;
        }

        return null;
    }

    async function findTableByItemName(itemName) {
        if (!itemName || typeof itemName !== 'string') return null;
        const syncMatch = findTableByItemNameSync(itemName);
        if (syncMatch) return syncMatch;

        await ensureCompendiumCatalog();
        return findTableByItemNameSync(itemName);
    }

    async function rollLinkedTable(tableId, options = {}) {
        if (!tableId) return;

        let tableData = null;
        let tableName = '';
        let diceFormula = '';
        let faces = 20;

        if (tableId === 'compendium:wild_magic_sorcerer' || tableId === 'compendium:wild_magic_barbarian') {
            const isSorcerer = tableId === 'compendium:wild_magic_sorcerer';
            const targetName = isSorcerer ? 'wild magic surge' : 'wild magic';
            const targetSource = isSorcerer ? 'PHB' : 'TCE';

            await ensureCompendiumCatalog();

            const match = (compendiumCatalog || []).find((t) => {
                const n = (t.name || '').toLowerCase().trim();
                const s = (t.source || '').toUpperCase().trim();
                return n === targetName && (s === targetSource || (isSorcerer && s === 'XPHB'));
            });

            if (match) {
                if (compendiumDetailsCache.has(match.id)) {
                    tableData = compendiumDetailsCache.get(match.id);
                } else {
                    try {
                        const res = await fetch(`/api/tables/${match.id}`);
                        if (res.ok) {
                            tableData = await res.json();
                            compendiumDetailsCache.set(match.id, tableData);
                        }
                    } catch (err) {
                        console.error('Failed to fetch table details:', err);
                    }
                }
            }
        } else if (tableId.startsWith('ctable_')) {
            if (compendiumDetailsCache.has(tableId)) {
                tableData = compendiumDetailsCache.get(tableId);
            } else {
                try {
                    const res = await fetch(`/api/tables/${tableId}`);
                    if (res.ok) {
                        tableData = await res.json();
                        compendiumDetailsCache.set(tableId, tableData);
                    }
                } catch (err) {
                    console.error('Failed to fetch table details:', err);
                }
            }
        } else {
            // Custom campaign table
            const customTbl = (getState().tables || []).find((t) => t.id === tableId);
            if (customTbl) {
                tableName = customTbl.name;
                const entries = customTbl.entries || [];
                faces = entries.length || 1;
                diceFormula = `1d${faces}`;
                const rollVal = Math.floor(Math.random() * faces) + 1;
                const entry = entries[rollVal - 1] || { name: `Result #${rollVal}`, text: '' };

                if (window.Dice3D && typeof window.Dice3D.showDiceRoll === 'function') {
                    try {
                        window.Dice3D.showDiceRoll([{ faces, val: rollVal }]);
                    } catch (e) {}
                }

                const displayName = options.charName
                    ? `${options.charName} — ${options.abilityName || tableName}`
                    : options.abilityName
                      ? `${options.abilityName} (${tableName})`
                      : tableName;

                if (vtt.socket) {
                    vtt.socket.emit('chat:msg', {
                        rollTableCard: {
                            tableName: displayName,
                            formula: diceFormula,
                            roll: rollVal,
                            entryName: entry.name || `Result #${rollVal}`,
                            entryText: entry.text || '',
                            charName: options.charName || '',
                            abilityName: options.abilityName || ''
                        },
                        text: `Rolled on table ${tableName}: ${entry.name || rollVal}`,
                        whisperToGM: !!options.isWhisper
                    });
                }
                if (vtt.toast) vtt.toast(`Rolled on ${tableName}: ${entry.name || rollVal}`);
                return;
            } else {
                // Check if tableId is an item name or table name
                const itemTbl = await findTableByItemName(tableId);
                if (itemTbl && itemTbl.id !== tableId) {
                    return rollLinkedTable(itemTbl.id, options);
                }
            }
        }

        if (!tableData || !tableData.rows || tableData.rows.length === 0) {
            if (vtt.toast) vtt.toast('Could not find or load linked table.', 'error');
            return;
        }

        tableName = tableData.name || 'Table';
        const diceMatch = (tableData.dice || '').match(/\b(?:1?d)?(\d+)\b/i);
        if (diceMatch) {
            faces = parseInt(diceMatch[1], 10);
        } else {
            faces = tableData.rows.length;
        }
        diceFormula = `1d${faces}`;

        const rollVal = Math.floor(Math.random() * faces) + 1;

        if (window.Dice3D && typeof window.Dice3D.showDiceRoll === 'function') {
            try {
                window.Dice3D.showDiceRoll([{ faces, val: rollVal }]);
            } catch (e) {}
        }

        const matched = findRowForRoll(tableData.rows, rollVal);
        const cells = matched ? (Array.isArray(matched.row) ? matched.row : [matched.row]) : [`Result #${rollVal}`];

        let entryName = '';
        let entryText = '';
        if (cells.length === 1) {
            entryName = cleanTableText(cells[0]);
        } else if (cells.length === 2) {
            entryName = `Roll [${cells[0]}]`;
            entryText = cleanTableText(cells[1]);
        } else {
            entryName = `${cells[0]}: ${cleanTableText(cells[1])}`;
            entryText = cleanTableText(cells.slice(2).join(' — '));
        }

        const displayName = options.charName
            ? `${options.charName} — ${options.abilityName || tableName}`
            : options.abilityName
              ? `${options.abilityName} (${tableName})`
              : tableName;

        if (vtt.socket) {
            vtt.socket.emit('chat:msg', {
                rollTableCard: {
                    tableName: displayName,
                    formula: diceFormula,
                    roll: rollVal,
                    entryName,
                    entryText,
                    charName: options.charName || '',
                    abilityName: options.abilityName || ''
                },
                text: `Rolled on table ${tableName}: ${entryName}`,
                whisperToGM: !!options.isWhisper
            });
        }
        if (vtt.toast) vtt.toast(`Rolled on ${tableName}: ${entryName}`);
    }

    // --- JSON IMPORT / EXPORT ---
    function exportRollTablesJson() {
        const state = getState();
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `dndforged_rolltables_and_decks_${Date.now()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    }

    function importRollTablesJson(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                const state = getState();
                if (imported.tables && Array.isArray(imported.tables)) {
                    state.tables.push(...imported.tables);
                }
                if (imported.assetTables && Array.isArray(imported.assetTables)) {
                    state.assetTables.push(...imported.assetTables);
                }
                if (imported.decks && Array.isArray(imported.decks)) {
                    imported.decks.forEach((d) => ensureDeckState(d));
                    state.decks.push(...imported.decks);
                }
                broadcastState();
                if (vtt.toast) vtt.toast('Successfully imported roll tables and decks!');
                if (modalTablePicker) modalTablePicker.classList.add('vtt-hidden');
            } catch (err) {
                console.error('Import error:', err);
                alert('Invalid JSON file format for tables/decks.');
            }
        };
        reader.readAsText(file);
    }

    // --- ATTACH EVENT HANDLERS ---
    // Sub-views switching inside #tab-tables
    const tablesSubtabBtns = document.querySelectorAll('.tables-subtab-btn');
    tablesSubtabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.subtab;
            tablesSubtabBtns.forEach((b) => {
                b.classList.remove('active');
                b.style.borderBottom = '2px solid transparent';
                b.style.color = 'var(--color-text-secondary)';
            });
            btn.classList.add('active');
            btn.style.borderBottom = '2px solid var(--color-gold-base)';
            btn.style.color = 'var(--color-text-primary)';

            document.querySelectorAll('.tables-subtab-content').forEach((c) => c.classList.add('vtt-hidden'));
            const activeContent = document.getElementById(target);
            if (activeContent) activeContent.classList.remove('vtt-hidden');
        });
    });

    // Sub-views switching inside #tab-assets [Asset Gallery | Asset Tables]
    const assetSubtabBtns = document.querySelectorAll('.asset-subtab-btn');
    assetSubtabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.subtab;
            assetSubtabBtns.forEach((b) => {
                b.classList.remove('active');
                b.style.borderBottom = '2px solid transparent';
                b.style.color = 'var(--color-text-secondary)';
            });
            btn.classList.add('active');
            btn.style.borderBottom = '2px solid var(--color-gold-base)';
            btn.style.color = 'var(--color-text-primary)';

            document.querySelectorAll('.asset-subtab-content').forEach((c) => c.classList.add('vtt-hidden'));
            const activeContent = document.getElementById(target);
            if (activeContent) activeContent.classList.remove('vtt-hidden');
        });
    });

    // Search inputs
    const inputTableSearch = document.getElementById('search-roll-tables');
    if (inputTableSearch) {
        inputTableSearch.addEventListener('input', (e) => {
            tableSearchQuery = e.target.value.trim();
            renderRollTablesList();
        });
    }

    const inputAssetTableSearch = document.getElementById('search-asset-tables');
    if (inputAssetTableSearch) {
        inputAssetTableSearch.addEventListener('input', (e) => {
            assetTableSearchQuery = e.target.value.trim();
            renderAssetTablesList();
        });
    }

    const inputDeckSearch = document.getElementById('search-card-decks');
    if (inputDeckSearch) {
        inputDeckSearch.addEventListener('input', (e) => {
            deckSearchQuery = e.target.value.trim();
            renderCardDecksList();
        });
    }

    // Modal Triggers
    const btnNewTable = document.getElementById('btn-new-roll-table');
    if (btnNewTable) btnNewTable.addEventListener('click', () => openEditTableModal(null));

    const btnNewAssetTable = document.getElementById('btn-new-asset-table');
    if (btnNewAssetTable) btnNewAssetTable.addEventListener('click', () => openEditAssetTableModal(null));

    const btnNewDeck = document.getElementById('btn-new-card-deck');
    if (btnNewDeck) btnNewDeck.addEventListener('click', () => openEditDeckModal(null));

    const btnLoadPresetTable = document.getElementById('btn-load-preset-tables');
    if (btnLoadPresetTable) btnLoadPresetTable.addEventListener('click', () => openTablePickerModal('compendium'));

    const btnLoadPresetDeck = document.getElementById('btn-load-preset-decks');
    if (btnLoadPresetDeck) btnLoadPresetDeck.addEventListener('click', () => openTablePickerModal('decks'));

    const btnExportJson = document.getElementById('btn-export-rolltables-json');
    if (btnExportJson) btnExportJson.addEventListener('click', exportRollTablesJson);

    const btnModalExportJson = document.getElementById('btn-modal-export-json');
    if (btnModalExportJson) btnModalExportJson.addEventListener('click', exportRollTablesJson);

    const fileInputImport = document.getElementById('file-import-rolltables-json');
    if (fileInputImport) {
        fileInputImport.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importRollTablesJson(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // Table Picker Modal Event Listeners
    if (modalTablePicker) {
        // Tab switching
        modalTablePicker.querySelectorAll('.picker-tab-btn').forEach((tabBtn) => {
            tabBtn.addEventListener('click', () => {
                switchPickerTab(tabBtn.dataset.tab);
            });
        });

        // Filter inputs
        const searchInput = document.getElementById('picker-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                pickerSearchQuery = e.target.value.trim();
                renderPickerTableRows();
            });
        }

        const sourceSelect = document.getElementById('picker-source-select');
        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                pickerSourceFilter = e.target.value;
                renderPickerTableRows();
            });
        }

        const diceSelect = document.getElementById('picker-dice-select');
        if (diceSelect) {
            diceSelect.addEventListener('change', (e) => {
                pickerDiceFilter = e.target.value;
                renderPickerTableRows();
            });
        }

        // Sortable headers
        modalTablePicker.querySelectorAll('.picker-th.sortable').forEach((th) => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (pickerSortField === field) {
                    pickerSortDirection = pickerSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    pickerSortField = field;
                    pickerSortDirection = 'asc';
                }
                renderPickerTableRows();
            });
        });

        // Preview Drawer Actions
        const btnPreviewRoll = document.getElementById('btn-preview-roll-chat');
        if (btnPreviewRoll) {
            btnPreviewRoll.addEventListener('click', rollCompendiumTableDirectly);
        }

        const btnPreviewLoad = document.getElementById('btn-preview-load-camp');
        if (btnPreviewLoad) {
            btnPreviewLoad.addEventListener('click', () => {
                if (selectedCompendiumTableId) {
                    loadCompendiumTableToCampaign(selectedCompendiumTableId);
                }
            });
        }

        // Compendium Decks Tab Listeners
        const deckSearchInput = document.getElementById('picker-deck-search-input');
        if (deckSearchInput) {
            deckSearchInput.addEventListener('input', (e) => {
                pickerDeckSearchQuery = e.target.value.trim();
                renderCompendiumDecksRows();
            });
        }

        const btnPreviewLoadDeck = document.getElementById('btn-preview-load-deck');
        if (btnPreviewLoadDeck) {
            btnPreviewLoadDeck.addEventListener('click', () => {
                if (selectedCompendiumDeckId) {
                    loadCompendiumDeckToCampaign(selectedCompendiumDeckId);
                }
            });
        }
    }

    // Modal Save & Close buttons
    const btnSaveTable = document.getElementById('btn-save-roll-table');
    if (btnSaveTable) btnSaveTable.addEventListener('click', saveTableFromModal);

    const btnSaveAssetTable = document.getElementById('btn-save-asset-table');
    if (btnSaveAssetTable) btnSaveAssetTable.addEventListener('click', saveAssetTableFromModal);

    const btnSaveDeck = document.getElementById('btn-save-card-deck');
    if (btnSaveDeck) btnSaveDeck.addEventListener('click', saveDeckFromModal);

    // Initial render and background pre-warming of compendium tables catalog
    renderAllViews();
    ensureCompendiumCatalog().catch(() => {});

    return {
        renderAllViews,
        rollFromTable,
        rollLinkedTable,
        findTableByItemName,
        findTableByItemNameSync,
        placeAssetTableOnCanvas,
        playCardToCanvas,
        drawFromDeckPrompt,
        shuffleDeckAction,
        recallDeckAction,
        openTablePickerModal,
        openAssetTableWithAssets,
        exportRollTablesJson,
        importRollTablesJson
    };
}
