/**
 * Item Catalog, Compendium Browsing, Search, Filtering & Selection Modals
 */

import { getItemFullDescription, renderItemPreview } from './item-description.js';
import { runItemAutomationWizard } from './item-wizard.js';

export const RARITY_ORDER = {
    none: 0,
    mundane: 0,
    '': 0,
    common: 1,
    uncommon: 2,
    rare: 3,
    'very rare': 4,
    legendary: 5,
    artifact: 6,
    varies: 7,
    'unknown (magic)': 8,
    unknown: 9
};

export function getNormalizedRarity(item) {
    if (!item || !item.rarity) return 'none';
    const r = String(item.rarity).trim().toLowerCase();
    if (r === 'none' || r === 'mundane') return 'none';
    return r;
}

export function getRarityBadgeHtml(rarity) {
    const norm = (rarity || 'none').toLowerCase().trim();
    const label =
        norm === 'none' || norm === 'mundane' || !norm ? 'Mundane' : norm.charAt(0).toUpperCase() + norm.slice(1);
    const cssClass =
        norm === 'very rare'
            ? 'rarity-very-rare'
            : norm === 'none' || norm === 'mundane' || !norm
              ? 'rarity-none'
              : `rarity-${norm}`;
    return `<span class="rarity-badge ${cssClass}">${label}</span>`;
}

// Module-level state
let itemCache = null;
let itemFilterState = {
    query: '',
    mode: 'all', // 'all' | 'magic' | 'mundane'
    type: 'all',
    source: 'all',
    rarity: 'all',
    sortCol: 'name',
    sortDir: 'asc'
};
let activePreviewItem = null;
let filteredItemsCache = [];
let renderedItemCount = 0;
const ITEM_PAGE_SIZE = 50;

export function getItemCache() {
    return itemCache;
}

export function invalidateItemCache() {
    itemCache = null;
}

export function setItemCache(cache) {
    itemCache = cache;
}

export function updateSortHeaderIcons() {
    const nameHeader = document.getElementById('pc-sort-name');
    const rarityHeader = document.getElementById('pc-sort-rarity');
    const nameIcon = document.getElementById('pc-sort-name-icon');
    const rarityIcon = document.getElementById('pc-sort-rarity-icon');

    if (!nameHeader || !rarityHeader || !nameIcon || !rarityIcon) return;

    if (itemFilterState.sortCol === 'name') {
        nameHeader.classList.add('active-sort');
        rarityHeader.classList.remove('active-sort');
        nameIcon.className =
            itemFilterState.sortDir === 'asc'
                ? 'fa-solid fa-arrow-down-a-z sort-icon'
                : 'fa-solid fa-arrow-up-z-a sort-icon';
        rarityIcon.className = 'fa-solid fa-sort sort-icon';
    } else {
        rarityHeader.classList.add('active-sort');
        nameHeader.classList.remove('active-sort');
        rarityIcon.className =
            itemFilterState.sortDir === 'asc'
                ? 'fa-solid fa-arrow-down-wide-short sort-icon'
                : 'fa-solid fa-arrow-up-short-wide sort-icon';
        nameIcon.className = 'fa-solid fa-sort sort-icon';
    }
}

export function populateItemFilterDropdowns(items) {
    const typeSelect = document.getElementById('pc-item-filter-type');
    const sourceSelect = document.getElementById('pc-item-filter-source');
    if (!typeSelect || !sourceSelect || !items) return;

    const types = new Set();
    const sources = new Set();
    items.forEach((it) => {
        if (it.type) types.add(it.type);
        else if (it.weaponCategory) types.add(it.weaponCategory);
        if (it.source) sources.add(it.source);
    });

    const sortedTypes = Array.from(types).sort((a, b) => a.localeCompare(b));
    const sortedSources = Array.from(sources).sort((a, b) => a.localeCompare(b));

    const curType = typeSelect.value;
    const curSource = sourceSelect.value;

    typeSelect.innerHTML =
        '<option value="all">All Types</option>' +
        sortedTypes.map((t) => `<option value="${t.replace(/"/g, '&quot;')}">${t}</option>`).join('');
    sourceSelect.innerHTML =
        '<option value="all">All Sources</option>' +
        sortedSources.map((s) => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('');

    if (sortedTypes.includes(curType)) typeSelect.value = curType;
    if (sortedSources.includes(curSource)) sourceSelect.value = curSource;
}

export function updateItemSelectedCount() {
    const count = window._vttSelectedItemMap
        ? window._vttSelectedItemMap.size
        : document.querySelectorAll('.pc-item-select:checked').length;
    const countEl = document.getElementById('pc-item-selected-count');
    if (countEl) countEl.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
}

export function ensureItemModalsExist(options = {}) {
    if (document.getElementById('pc-item-modal')) return;

    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c),
        getDisplaySourceBadge = (s) => (window.getDisplaySourceBadge ? window.getDisplaySourceBadge(s) : s)
    } = options;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-item-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>

        <div id="pc-item-modal" class="vtt-sheet-submodal vtt-hidden pc-item-modal-dialog" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#18181b; border:1px solid var(--color-border-subtle); border-radius:10px; z-index:3010; box-shadow:0 8px 32px rgba(0,0,0,0.65);">
            <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-backpack text-gradient-gold" style="font-size:1.15rem;"></i>
                    <h3 style="margin:0; font-size:1.1rem; color:var(--color-gold-base); font-family:var(--font-heading);">Add Item</h3>
                </div>
                <button class="btn btn-icon" id="pc-item-modal-close" style="color:var(--color-text-muted);"><i class="fa-solid fa-times"></i></button>
            </div>

            <div class="pc-item-toolbar">
                <div class="pc-item-toolbar-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="pc-item-search" placeholder="Search by name, type, properties..." autocomplete="off">
                </div>
                <div class="pc-item-segmented" id="pc-item-mode-segmented">
                    <button type="button" class="pc-item-segmented-btn active" data-mode="all">All Items</button>
                    <button type="button" class="pc-item-segmented-btn" data-mode="magic">Magic Only</button>
                    <button type="button" class="pc-item-segmented-btn" data-mode="mundane">Mundane Only</button>
                </div>
                <select id="pc-item-filter-type" class="pc-item-filter-select">
                    <option value="all">All Types</option>
                </select>
                <select id="pc-item-filter-rarity" class="pc-item-filter-select">
                    <option value="all">All Rarities</option>
                    <option value="none">Mundane / None</option>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="very rare">Very Rare</option>
                    <option value="legendary">Legendary</option>
                    <option value="artifact">Artifact</option>
                </select>
                <select id="pc-item-filter-source" class="pc-item-filter-select">
                    <option value="all">All Sources</option>
                </select>
            </div>

            <div class="pc-item-split-body">
                <div class="pc-item-table-pane">
                    <div class="pc-item-table-scroll scroll-styled" id="pc-item-table-scroll">
                        <table class="pc-item-table">
                            <thead>
                                <tr>
                                    <th class="sortable active-sort" id="pc-sort-name" style="width:70%;">
                                        Name <i class="fa-solid fa-arrow-down-a-z sort-icon" id="pc-sort-name-icon"></i>
                                    </th>
                                    <th class="sortable" id="pc-sort-rarity" style="width:30%; text-align:center;">
                                        Rarity <i class="fa-solid fa-sort sort-icon" id="pc-sort-rarity-icon"></i>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="pc-item-tbody">
                                <tr><td colspan="2" style="text-align:center; padding:30px; color:var(--color-text-muted);">Loading items...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pc-item-count-footer">
                        <span id="pc-item-count-indicator">Showing 0 of 0 items</span>
                        <span style="font-size:0.7rem; opacity:0.7;"><i class="fa-solid fa-angles-down"></i> Scroll for more</span>
                    </div>
                </div>

                <div class="pc-item-preview-pane scroll-styled" id="pc-item-preview-pane">
                    <div style="text-align:center; padding:40px 10px; color:var(--color-text-muted);">
                        <i class="fa-solid fa-hand-pointer" style="font-size:1.8rem; margin-bottom:12px; opacity:0.4;"></i>
                        <div>Select an item from the list to preview details</div>
                    </div>
                </div>
            </div>

            <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; background:rgba(0,0,0,0.3); align-items:center;">
                <span id="pc-item-selected-count" style="font-size:0.88rem; color:var(--color-text-muted); font-weight:500;">0 items selected</span>
                <div style="display:flex; gap:10px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="pc-item-modal-cancel">Cancel</button>
                    <button type="button" id="pc-item-modal-add" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Add Selected Items</button>
                </div>
            </div>
        </div>

        <!-- Custom Item Modal -->
        <div id="pc-custom-item-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3025; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 id="pc-custom-item-modal-title" style="margin:0; color:var(--color-gold-base);">Custom Item</h3>
                <button class="btn btn-icon" id="pc-custom-item-modal-close" style="color:var(--color-text-muted);"><i class="fa-solid fa-times"></i></button>
            </div>
            <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Item Name</label>
                    <input type="text" id="pc-custom-item-name" style="width:100%;" class="form-control" placeholder="e.g. Health Potion">
                </div>
                <div style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Weight (lb)</label>
                        <input type="number" id="pc-custom-item-weight" style="width:100%;" class="form-control" placeholder="0" min="0" step="any">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Quantity</label>
                        <input type="number" id="pc-custom-item-qty" style="width:100%;" class="form-control" value="1" min="1">
                    </div>
                </div>
                <div>
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Description (Optional)</label>
                    <textarea id="pc-custom-item-desc" style="width:100%; height:80px; resize:vertical;" class="form-control" placeholder="Item description..."></textarea>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2);">
                <button id="pc-custom-item-modal-del" class="btn btn-danger btn-xs" style="display:none;"><i class="fa-solid fa-trash"></i> Delete Item</button>
                <button id="pc-custom-item-modal-add" class="btn btn-primary btn-xs">Save Item</button>
            </div>
        </div>

        <!-- Item Automation Wizard Modal -->
        <div id="pc-item-automation-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); backdrop-filter:blur(3px); z-index:3020;"></div>
        <div id="pc-item-automation-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden glassmorphism" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#18181b; border:1px solid var(--color-gold-base); border-radius:10px; z-index:3025; width:480px; max-width:92vw; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.7); overflow:hidden; font-family:var(--font-primary, sans-serif);">
            <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.35); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i id="pc-automation-icon" class="fa-solid fa-wand-magic-sparkles text-gradient-gold" style="font-size:1.15rem;"></i>
                    <h3 id="pc-automation-title" style="margin:0; font-size:1.05rem; color:var(--color-gold-base); font-family:var(--font-heading);">Item Automation</h3>
                </div>
                <span id="pc-automation-step-indicator" style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:10px;">Step 1 of 1</span>
            </div>
            <div id="pc-automation-body" style="padding:18px; font-size:0.875rem; line-height:1.5; color:var(--color-text-primary);">
                <!-- Injected step content -->
            </div>
            <div id="pc-automation-actions" style="padding:12px 18px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.25);">
                <!-- Injected step action buttons -->
            </div>
        </div>
    `;
    document.body.appendChild(container);

    const closeItemModal = () => {
        document.getElementById('pc-item-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('pc-item-modal-close')?.addEventListener('click', closeItemModal);
    document.getElementById('pc-item-modal-cancel')?.addEventListener('click', closeItemModal);

    // Backdrop tap-to-dismiss for items overlay
    document.getElementById('pc-item-overlay')?.addEventListener('click', () => {
        const customModal = document.getElementById('pc-custom-item-modal');
        const itemModal = document.getElementById('pc-item-modal');
        if (customModal && !customModal.classList.contains('vtt-hidden')) {
            customModal.classList.add('vtt-hidden');
            if (itemModal && itemModal.classList.contains('vtt-hidden')) {
                document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');
            }
        } else if (itemModal && !itemModal.classList.contains('vtt-hidden')) {
            itemModal.classList.add('vtt-hidden');
            document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');
        }
    });

    document.getElementById('pc-item-automation-overlay')?.addEventListener('click', () => {
        document.getElementById('pc-item-automation-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-item-automation-overlay')?.classList.add('vtt-hidden');
    });

    document.getElementById('pc-custom-item-modal-close')?.addEventListener('click', () => {
        document.getElementById('pc-custom-item-modal')?.classList.add('vtt-hidden');
        if (document.getElementById('pc-item-modal')?.classList.contains('vtt-hidden')) {
            document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');
        }
    });

    document.getElementById('pc-custom-item-modal-del')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        const saveBtn = document.getElementById('pc-custom-item-modal-add');
        const editIdx = saveBtn?.dataset.editIdx;
        if (editIdx !== undefined && editIdx !== null && editIdx !== '') {
            if (confirm('Delete this item?')) {
                currentChar.equipment.splice(parseInt(editIdx), 1);
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
                document.getElementById('pc-custom-item-modal')?.classList.add('vtt-hidden');
                if (document.getElementById('pc-item-modal')?.classList.contains('vtt-hidden')) {
                    document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');
                }
            }
        }
    });

    document.getElementById('pc-custom-item-modal-add')?.addEventListener('click', (e) => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        const nameInput = document.getElementById('pc-custom-item-name');
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.focus();
            return;
        }
        const weight = document.getElementById('pc-custom-item-weight').value || '0';
        const qty = document.getElementById('pc-custom-item-qty').value || '1';
        const desc = document.getElementById('pc-custom-item-desc').value || '';

        const editIdx = e.currentTarget.dataset.editIdx;
        if (editIdx !== undefined) {
            const eq = currentChar.equipment[editIdx];
            if (eq) {
                eq.name = name;
                eq.weight = weight;
                eq.qty = qty;
                eq.description = desc;
            }
        } else {
            if (!currentChar.equipment) currentChar.equipment = [];
            currentChar.equipment.push({
                id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name: name,
                qty: qty,
                weight: weight,
                description: desc
            });
        }
        saveAndEmit(currentChar);
        renderSheetData(currentChar);

        document.getElementById('pc-custom-item-modal')?.classList.add('vtt-hidden');
        if (document.getElementById('pc-item-modal')?.classList.contains('vtt-hidden')) {
            document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');
        }
    });

    // ─── Add Item Toolbar Listeners ────────────────────────────────────────
    let itemSearchDebounce = null;
    document.getElementById('pc-item-search')?.addEventListener('input', (e) => {
        itemFilterState.query = e.target.value;
        clearTimeout(itemSearchDebounce);
        itemSearchDebounce = setTimeout(() => {
            renderItemSearchList(options);
        }, 120);
    });

    document.querySelectorAll('#pc-item-mode-segmented .pc-item-segmented-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document
                .querySelectorAll('#pc-item-mode-segmented .pc-item-segmented-btn')
                .forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            itemFilterState.mode = btn.dataset.mode || 'all';
            renderItemSearchList(options);
        });
    });

    document.getElementById('pc-item-filter-type')?.addEventListener('change', (e) => {
        itemFilterState.type = e.target.value;
        renderItemSearchList(options);
    });

    document.getElementById('pc-item-filter-rarity')?.addEventListener('change', (e) => {
        itemFilterState.rarity = e.target.value;
        renderItemSearchList(options);
    });

    document.getElementById('pc-item-filter-source')?.addEventListener('change', (e) => {
        itemFilterState.source = e.target.value;
        renderItemSearchList(options);
    });

    document.getElementById('pc-sort-name')?.addEventListener('click', () => {
        if (itemFilterState.sortCol === 'name') {
            itemFilterState.sortDir = itemFilterState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            itemFilterState.sortCol = 'name';
            itemFilterState.sortDir = 'asc';
        }
        updateSortHeaderIcons();
        renderItemSearchList(options);
    });

    document.getElementById('pc-sort-rarity')?.addEventListener('click', () => {
        if (itemFilterState.sortCol === 'rarity') {
            itemFilterState.sortDir = itemFilterState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            itemFilterState.sortCol = 'rarity';
            itemFilterState.sortDir = 'asc';
        }
        updateSortHeaderIcons();
        renderItemSearchList(options);
    });

    const tableScrollEl = document.getElementById('pc-item-table-scroll');
    if (tableScrollEl) {
        tableScrollEl.addEventListener('scroll', () => {
            if (tableScrollEl.scrollTop + tableScrollEl.clientHeight >= tableScrollEl.scrollHeight - 80) {
                renderNextItemChunk(options);
            }
        });
    }

    document.getElementById('pc-item-modal-add')?.addEventListener('click', async () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        const selectedList = window._vttSelectedItemMap ? Array.from(window._vttSelectedItemMap.values()) : [];
        if (!selectedList.length) return;

        window._vttSelectedItemMap.clear();
        updateItemSelectedCount();
        document.getElementById('pc-item-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-item-overlay')?.classList.add('vtt-hidden');

        if (!currentChar.equipment) currentChar.equipment = [];
        const automationQueue = [];

        for (const sel of selectedList) {
            const catItem = sel.catItem;

            // 1. Automatic Pack Unpacking
            if (catItem && Array.isArray(catItem.packContents) && catItem.packContents.length > 0) {
                for (const packEntry of catItem.packContents) {
                    if (typeof packEntry === 'string') {
                        const [pName, pSrc] = packEntry.split('|');
                        const found = itemCache?.items?.find((it) => it.name.toLowerCase() === pName.toLowerCase());
                        currentChar.equipment.push({
                            id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            name: found ? found.name : pName.charAt(0).toUpperCase() + pName.slice(1),
                            qty: 1,
                            weight: found ? found.weight || 0 : 0,
                            description: found ? found.descriptionMarkdown || found.descriptionHtml || '' : '',
                            source: found?.source || pSrc || sel.source
                        });
                    } else if (typeof packEntry === 'object' && packEntry !== null) {
                        if (packEntry.item) {
                            const [pName, pSrc] = packEntry.item.split('|');
                            const found = itemCache?.items?.find((it) => it.name.toLowerCase() === pName.toLowerCase());
                            currentChar.equipment.push({
                                id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                name: found ? found.name : pName.charAt(0).toUpperCase() + pName.slice(1),
                                qty: packEntry.quantity || 1,
                                weight: found ? found.weight || 0 : 0,
                                description: found ? found.descriptionMarkdown || found.descriptionHtml || '' : '',
                                source: found?.source || pSrc || sel.source
                            });
                        } else if (packEntry.special) {
                            currentChar.equipment.push({
                                id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                name: packEntry.special,
                                qty: packEntry.quantity || 1,
                                weight: 0,
                                description: '',
                                source: sel.source
                            });
                        }
                    }
                }
            } else {
                // Standard item
                let fullDesc = catItem?.descriptionMarkdown || sel.desc || catItem?.descriptionHtml || '';
                if (!fullDesc && sel.source && sel.itemId) {
                    try {
                        const res = await fetch(
                            `/api/item/${encodeURIComponent(sel.source)}/${encodeURIComponent(sel.itemId)}`
                        );
                        if (res.ok) {
                            const fullItem = await res.json();
                            fullDesc =
                                fullItem.descriptionMarkdown ||
                                fullItem.descriptionHtml ||
                                (Array.isArray(fullItem.entries)
                                    ? fullItem.entries
                                          .map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
                                          .join('\n\n')
                                    : '');
                        }
                    } catch (e) {}
                }

                currentChar.equipment.push({
                    id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: sel.name,
                    qty: 1,
                    weight: sel.weight,
                    description: fullDesc,
                    source: sel.source
                });

                // 2. Detect Weapon Macro Automation
                const isWeap = !!(
                    catItem &&
                    (catItem.macroTemplate ||
                        catItem.isWeapon ||
                        catItem.dmg1 ||
                        catItem.weaponCategory ||
                        catItem.rawType === 'M' ||
                        catItem.rawType === 'R' ||
                        (catItem.type && catItem.type.toLowerCase().includes('weapon')))
                );
                if (isWeap) {
                    automationQueue.push({
                        type: 'weapon',
                        item: catItem,
                        name: sel.name,
                        desc: fullDesc
                    });
                }

                // 3. Detect AC Modification Automation
                const isArm = !!(
                    catItem &&
                    (catItem.isArmor ||
                        (catItem.ac !== null && catItem.ac !== undefined) ||
                        catItem.bonusAc ||
                        catItem.armor ||
                        catItem.rawType === 'LA' ||
                        catItem.rawType === 'MA' ||
                        catItem.rawType === 'HA' ||
                        catItem.rawType === 'S' ||
                        (catItem.type && (catItem.type.toLowerCase().includes('armor') || catItem.type === 'Shield')))
                );
                if (isArm) {
                    automationQueue.push({
                        type: 'ac',
                        item: catItem,
                        name: sel.name,
                        desc: fullDesc
                    });
                }

                // 4. Detect Granted Spells Automation
                let hasSpells = false;
                let spellsList = [];
                if (catItem && catItem.attachedSpells) {
                    if (Array.isArray(catItem.attachedSpells)) {
                        spellsList = catItem.attachedSpells;
                    } else if (typeof catItem.attachedSpells === 'object') {
                        function extractSpells(obj) {
                            const res = [];
                            for (const k in obj) {
                                if (typeof obj[k] === 'string') res.push(obj[k]);
                                else if (Array.isArray(obj[k])) {
                                    for (const sub of obj[k]) {
                                        if (typeof sub === 'string') res.push(sub);
                                        else if (typeof sub === 'object') res.push(...extractSpells(sub));
                                    }
                                } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                                    res.push(...extractSpells(obj[k]));
                                }
                            }
                            return res;
                        }
                        spellsList = Array.from(new Set(extractSpells(catItem.attachedSpells)));
                    }
                    if (spellsList.length > 0) hasSpells = true;
                }

                if (hasSpells) {
                    automationQueue.push({
                        type: 'spells',
                        item: catItem,
                        name: sel.name,
                        desc: fullDesc,
                        spells: spellsList
                    });
                }
            }
        }

        saveAndEmit(currentChar);
        renderSheetData(currentChar);

        if (automationQueue.length > 0) {
            runItemAutomationWizard(automationQueue, {
                getCurrentChar,
                ensureItemModalsExist: () => ensureItemModalsExist(options),
                saveAndEmit,
                renderSheetData
            });
        }
    });
}

export function openCustomItemModal(editIdx = null, options = {}) {
    const { getCurrentChar = () => window.currentChar } = options;

    const currentChar = getCurrentChar();
    if (!currentChar) return;
    ensureItemModalsExist(options);
    const isEdit = editIdx !== null;

    let name = '',
        weight = '',
        qty = '1',
        desc = '';
    if (isEdit && currentChar.equipment && currentChar.equipment[editIdx]) {
        const eq = currentChar.equipment[editIdx];
        name = eq.name || '';
        weight = eq.weight || '';
        qty = eq.qty || '1';
        desc = eq.description || '';
    }

    const nameEl = document.getElementById('pc-custom-item-name');
    const weightEl = document.getElementById('pc-custom-item-weight');
    const qtyEl = document.getElementById('pc-custom-item-qty');
    const descEl = document.getElementById('pc-custom-item-desc');

    if (nameEl) nameEl.value = name;
    if (weightEl) weightEl.value = weight;
    if (qtyEl) qtyEl.value = qty;
    if (descEl) descEl.value = desc;

    const saveBtn = document.getElementById('pc-custom-item-modal-add');
    if (saveBtn) {
        if (isEdit) {
            saveBtn.dataset.editIdx = editIdx;
            saveBtn.textContent = 'Save Changes';
        } else {
            delete saveBtn.dataset.editIdx;
            saveBtn.textContent = 'Save Item';
        }
    }

    const titleEl = document.getElementById('pc-custom-item-modal-title');
    if (titleEl) {
        titleEl.textContent = isEdit ? 'Edit Item' : 'Custom Item';
    }

    const delBtn = document.getElementById('pc-custom-item-modal-del');
    if (delBtn) {
        delBtn.style.display = isEdit ? 'inline-block' : 'none';
    }

    document.getElementById('pc-custom-item-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-item-overlay')?.classList.remove('vtt-hidden');
    nameEl?.focus();
}

export function renderItemSearchList(options = {}) {
    if (!itemCache || !itemCache.items) return;
    const tbody = document.getElementById('pc-item-tbody');
    if (!tbody) return;

    const { items } = itemCache;
    const q = (itemFilterState.query || '').trim().toLowerCase();
    const mode = itemFilterState.mode || 'all';
    const typeFilter = itemFilterState.type || 'all';
    const sourceFilter = itemFilterState.source || 'all';
    const rarityFilter = itemFilterState.rarity || 'all';

    // 1. Filtering
    const filtered = items.filter((it) => {
        if (it.type === 'GV' || String(it.type).startsWith('GV|')) return false;

        const normRarity = getNormalizedRarity(it);

        // Mode filter (all, magic, mundane)
        if (mode === 'mundane') {
            if (normRarity !== 'none') return false;
        } else if (mode === 'magic') {
            if (normRarity === 'none') return false;
        }

        // Rarity filter
        if (rarityFilter !== 'all') {
            if (normRarity !== rarityFilter.toLowerCase()) return false;
        }

        // Type filter
        if (typeFilter !== 'all') {
            const itType = it.type || it.weaponCategory || '';
            if (itType !== typeFilter) return false;
        }

        // Source filter
        if (sourceFilter !== 'all') {
            if ((it.source || '').toUpperCase() !== sourceFilter.toUpperCase()) return false;
        }

        // Query filter
        if (q) {
            const name = (it.name || '').toLowerCase();
            const type = (it.type || it.weaponCategory || '').toLowerCase();
            const source = (it.source || '').toLowerCase();
            if (!name.includes(q) && !type.includes(q) && !source.includes(q)) return false;
        }

        return true;
    });

    // 2. Sorting
    const sortCol = itemFilterState.sortCol || 'name';
    const sortDir = itemFilterState.sortDir || 'asc';

    filtered.sort((a, b) => {
        if (sortCol === 'rarity') {
            const rankA = RARITY_ORDER[getNormalizedRarity(a)] ?? 99;
            const rankB = RARITY_ORDER[getNormalizedRarity(b)] ?? 99;
            if (rankA !== rankB) {
                return sortDir === 'asc' ? rankA - rankB : rankB - rankA;
            }
            return (a.name || '').localeCompare(b.name || '');
        } else {
            const comp = (a.name || '').localeCompare(b.name || '');
            return sortDir === 'asc' ? comp : -comp;
        }
    });

    filteredItemsCache = filtered;
    renderedItemCount = 0;
    tbody.innerHTML = '';

    const scrollEl = document.getElementById('pc-item-table-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;

    renderNextItemChunk(options);

    // Render preview for first item or keep active if still present
    if (filtered.length > 0) {
        const stillActive = activePreviewItem
            ? filtered.find((i) => (i.id || i.name) === (activePreviewItem.id || activePreviewItem.name))
            : null;
        renderPreviewForItem(stillActive || filtered[0], options);
    } else {
        const previewPane = document.getElementById('pc-item-preview-pane');
        if (previewPane) {
            previewPane.innerHTML = `
                <div style="text-align:center; padding:40px 10px; color:var(--color-text-muted);">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:1.8rem; margin-bottom:12px; opacity:0.4;"></i>
                    <div>No matching items found.</div>
                </div>
            `;
        }
    }
}

function renderPreviewForItem(item, options = {}) {
    const { getDisplaySourceBadge = (s) => (window.getDisplaySourceBadge ? window.getDisplaySourceBadge(s) : s) } =
        options;

    renderItemPreview(item, {
        itemCache,
        getNormalizedRarity,
        getRarityBadgeHtml,
        getDisplaySourceBadge,
        updateItemSelectedCount,
        setActivePreviewItem: (it) => {
            activePreviewItem = it;
        }
    });
}

export function renderNextItemChunk(options = {}) {
    const tbody = document.getElementById('pc-item-tbody');
    const countIndicator = document.getElementById('pc-item-count-indicator');
    if (!tbody) return;

    const { getDisplaySourceBadge = (s) => (window.getDisplaySourceBadge ? window.getDisplaySourceBadge(s) : s) } =
        options;

    if (filteredItemsCache.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="2" style="text-align:center; padding:30px; color:var(--color-text-muted);">No items found matching your filters.</td></tr>';
        if (countIndicator) countIndicator.textContent = 'Showing 0 of 0 items';
        return;
    }

    const chunk = filteredItemsCache.slice(renderedItemCount, renderedItemCount + ITEM_PAGE_SIZE);
    if (chunk.length === 0) return;

    let rowsHtml = '';
    for (let i = 0; i < chunk.length; i++) {
        const item = chunk[i];
        const source = item.source || '';
        const is2024 = (source || '').toUpperCase() === 'XPHB' || (source || '').toUpperCase() === 'XDMG';
        const badgeBg = is2024 ? '#059669' : (source || '').toUpperCase() === 'PHB' ? '#2563eb' : '#475569';
        const displaySrc = getDisplaySourceBadge(source) || source;

        const itemKey = (item.id || item.name + '::' + source).toLowerCase();
        const isChecked = window._vttSelectedItemMap ? window._vttSelectedItemMap.has(itemKey) : false;
        const normRarity = getNormalizedRarity(item);
        const rarityBadge = getRarityBadgeHtml(normRarity);
        const isActive =
            activePreviewItem && (activePreviewItem.id || activePreviewItem.name) === (item.id || item.name);

        rowsHtml += `
            <tr class="pc-item-row ${isActive ? 'is-active' : ''}" data-key="${itemKey}">
                <td style="width:70%;">
                    <div class="pc-item-name-cell">
                        <input type="checkbox" class="pc-item-cb" data-key="${itemKey}" data-name="${item.name.replace(/"/g, '&quot;')}" data-weight="${item.weight || 0}" data-source="${source}" data-id="${item.id || ''}" ${isChecked ? 'checked' : ''}>
                        <div class="pc-item-title-wrap">
                            <span class="pc-item-title" title="${item.name}">${item.name}</span>
                            ${source ? `<span class="pc-item-source-badge" style="background:${badgeBg}; color:#fff;">${displaySrc}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td style="width:30%; text-align:center;">
                    ${rarityBadge}
                </td>
            </tr>
        `;
    }

    tbody.insertAdjacentHTML('beforeend', rowsHtml);

    const newStartIndex = renderedItemCount;
    renderedItemCount += chunk.length;

    if (countIndicator) {
        countIndicator.textContent = `Showing ${renderedItemCount} of ${filteredItemsCache.length} items`;
    }

    // Attach listeners to newly added rows
    const newlyAddedRows = Array.from(tbody.querySelectorAll('tr.pc-item-row')).slice(newStartIndex);
    newlyAddedRows.forEach((row, idx) => {
        const item = chunk[idx];
        if (!item) return;
        const itemKey = row.dataset.key;

        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('pc-item-cb')) return;
            renderPreviewForItem(item, options);
        });

        const cb = row.querySelector('.pc-item-cb');
        if (cb) {
            cb.addEventListener('change', () => {
                if (!window._vttSelectedItemMap) window._vttSelectedItemMap = new Map();
                if (cb.checked) {
                    const desc = getItemFullDescription(item, itemCache);
                    window._vttSelectedItemMap.set(itemKey, {
                        name: item.name,
                        weight: item.weight || '0',
                        desc: desc,
                        source: item.source || '',
                        itemId: item.id || '',
                        catItem: item
                    });
                } else {
                    window._vttSelectedItemMap.delete(itemKey);
                }
                updateItemSelectedCount();
            });
        }
    });

    updateItemSelectedCount();
}

export function openItemModal(options = {}) {
    const { getCurrentChar = () => window.currentChar } = options;

    const currentChar = getCurrentChar();
    if (!currentChar) return;
    ensureItemModalsExist(options);
    window._vttSelectedItemMap = new Map();
    updateItemSelectedCount();
    document.getElementById('pc-item-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-item-overlay')?.classList.remove('vtt-hidden');

    const searchInput = document.getElementById('pc-item-search');
    if (searchInput) searchInput.value = itemFilterState.query || '';

    const tbody = document.getElementById('pc-item-tbody');
    if (tbody) {
        tbody.innerHTML =
            '<tr><td colspan="2" style="text-align:center; padding:30px; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading items...</td></tr>';
    }

    if (itemCache) {
        populateItemFilterDropdowns(itemCache.items);
        renderItemSearchList(options);
    } else {
        fetch('/data/items-catalog.json?v=' + Date.now())
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((catalogItems) => {
                itemCache = {
                    items: catalogItems,
                    fluffDict: {},
                    ruleDict: { property: {}, mastery: {} },
                    isCatalog: true
                };
                populateItemFilterDropdowns(itemCache.items);
                renderItemSearchList(options);
            })
            .catch(() => {
                Promise.all([
                    fetch('data/items.json')
                        .then((res) => res.json())
                        .catch(() => ({})),
                    fetch('data/items-base.json')
                        .then((res) => res.json())
                        .catch(() => ({})),
                    fetch('data/magicvariants.json')
                        .then((res) => res.json())
                        .catch(() => ({})),
                    fetch('data/fluff-items.json')
                        .then((res) => res.json())
                        .catch(() => ({}))
                ])
                    .then(([itemData, baseData, variantData, fluffData]) => {
                        let generatedVariants = [];
                        if (variantData.magicvariant && baseData.baseitem) {
                            variantData.magicvariant.forEach((variant) => {
                                const reqs = variant.requires || [];
                                if (reqs.length === 0) return;

                                const matchingBaseItems = baseData.baseitem.filter((base) => {
                                    return reqs.some((req) => {
                                        for (let k in req) {
                                            if (k === 'type' && typeof req[k] === 'string') {
                                                const reqType = req[k].split('|')[0];
                                                if (base.type !== reqType) return false;
                                            } else if (req[k] !== base[k]) return false;
                                        }
                                        return true;
                                    });
                                });

                                matchingBaseItems.forEach((base) => {
                                    const prefix =
                                        variant.inherits && variant.inherits.namePrefix
                                            ? variant.inherits.namePrefix
                                            : '';
                                    const suffix =
                                        variant.inherits && variant.inherits.nameSuffix
                                            ? variant.inherits.nameSuffix
                                            : '';
                                    if (!prefix && !suffix) return;
                                    const name = prefix + base.name + suffix;
                                    generatedVariants.push({
                                        ...base,
                                        ...(variant.inherits || {}),
                                        name: name,
                                        _isVariant: true,
                                        weight: base.weight || (variant.inherits ? variant.inherits.weight : 0),
                                        value:
                                            variant.inherits && variant.inherits.value
                                                ? variant.inherits.value
                                                : base.value
                                    });
                                });
                            });
                        }

                        let rawItems = [
                            ...(itemData.item || []),
                            ...(itemData.itemGroup || []),
                            ...(baseData.baseitem || []),
                            ...(variantData.magicvariant || []),
                            ...generatedVariants
                        ];

                        const uniqueMap = new Map();
                        rawItems.forEach((it) => {
                            const key = `${it.name}|${it.source || 'unknown'}`;
                            if (!uniqueMap.has(key)) uniqueMap.set(key, it);
                        });
                        let items = Array.from(uniqueMap.values());

                        const fluffDict = {};
                        if (fluffData.itemFluff) {
                            fluffData.itemFluff.forEach((f) => {
                                const key = (f.name + (f.source || '')).toLowerCase();
                                fluffDict[key] = f.entries || [];
                                if (f._copy && f._copy.name) {
                                    const copyKey = (f._copy.name + (f._copy.source || f.source || '')).toLowerCase();
                                    if (!fluffDict[key] && fluffDict[copyKey]) {
                                        fluffDict[key] = fluffDict[copyKey];
                                    }
                                }
                            });
                        }
                        const ruleDict = { property: {}, mastery: {} };
                        if (baseData.itemProperty) {
                            baseData.itemProperty.forEach((p) => {
                                if (p.entries && p.abbreviation) {
                                    ruleDict.property[p.abbreviation.toLowerCase()] = p.entries;
                                }
                            });
                        }
                        if (baseData.itemMastery) {
                            baseData.itemMastery.forEach((m) => {
                                if (m.entries) {
                                    ruleDict.mastery[m.name.toLowerCase()] = m.entries;
                                }
                            });
                        }

                        itemCache = { items, fluffDict, ruleDict };
                        populateItemFilterDropdowns(itemCache.items);
                        renderItemSearchList(options);
                    })
                    .catch((err) => {
                        const tbodyErr = document.getElementById('pc-item-tbody');
                        if (tbodyErr)
                            tbodyErr.innerHTML = `<tr><td colspan="2" style="color:var(--color-danger); text-align:center; padding:20px;">Error loading items: ${err.message}</td></tr>`;
                    });
            });
    }
}
