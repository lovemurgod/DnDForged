/**
 * creature-selector-modal.js
 * Universal, high-performance split-pane modal for searching, sorting, filtering,
 * and previewing Bestiary creatures for Companion creation, Custom NPC import, and more.
 */

// Helper to calculate or fallback token image URL
export function getCreatureTokenUrl(monster) {
    if (!monster) return 'favicon.svg';
    if (monster.tokenImg) return monster.tokenImg;
    if (monster.tokenUrl) return monster.tokenUrl;
    if (monster.imgUrl) return monster.imgUrl;
    if (typeof Renderer !== 'undefined' && Renderer.monster && Renderer.monster.getTokenUrl) {
        try {
            const rUrl = Renderer.monster.getTokenUrl(monster);
            if (rUrl) return rUrl;
        } catch (_) {}
    }
    if (monster.hasToken || monster.source || monster.name) {
        const cleanName =
            typeof Parser !== 'undefined'
                ? Parser.nameToTokenName(monster.name)
                : (monster.name || '').replace(/"/g, '').trim();
        const source = monster.source || 'MM';
        return `img/bestiary/tokens/${source}/${cleanName}.webp`;
    }
    if (typeof window !== 'undefined' && window.VTT?.generateArcaneToken) {
        return window.VTT.generateArcaneToken(monster.name || 'Creature', 'monster');
    }
    return 'favicon.svg';
}

// Parse CR to numeric value for sorting and range comparison
export function parseCrToNumeric(cr) {
    if (cr === undefined || cr === null) return 0;
    if (typeof cr === 'object') cr = cr.cr;
    const str = String(cr).trim();
    if (str === '1/8') return 0.125;
    if (str === '1/4') return 0.25;
    if (str === '1/2') return 0.5;
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
}

// Format CR display string
export function formatCrDisplay(cr) {
    if (cr === undefined || cr === null) return '0';
    if (typeof cr === 'object') return String(cr.cr || '0');
    return String(cr);
}

// Compute standard ability modifier string (+X or -X)
export function formatAbilityModifier(score) {
    const num = typeof score === 'number' ? score : parseInt(score, 10);
    if (isNaN(num)) return '+0';
    const mod = Math.floor((num - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

let cachedCatalog = null;

export async function loadBestiaryCatalog(explicitCatalog = null) {
    if (explicitCatalog && Array.isArray(explicitCatalog) && explicitCatalog.length > 0) {
        return explicitCatalog;
    }
    if (cachedCatalog && cachedCatalog.length > 0) {
        return cachedCatalog;
    }
    if (typeof window !== 'undefined' && window.VTT?.bestiaryCatalog && Array.isArray(window.VTT.bestiaryCatalog)) {
        cachedCatalog = window.VTT.bestiaryCatalog;
        return cachedCatalog;
    }

    try {
        let res = await fetch('/api/bestiary/catalog');
        if (!res.ok) {
            res = await fetch('/data/bestiary-catalog.json');
        }
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                cachedCatalog = data;
                if (typeof window !== 'undefined' && window.VTT) {
                    window.VTT.bestiaryCatalog = data;
                }
                return data;
            }
        }
    } catch (err) {
        console.warn('[creature-selector-modal] Catalog fetch error:', err);
    }
    return [];
}

/**
 * Opens the two-column Creature Selector Modal
 * @param {Object} options Configuration options
 */
export async function openCreatureSelectorModal(options = {}) {
    const {
        title = 'Select Creature Template',
        confirmLabel = 'Select Creature',
        confirmIcon = 'fa-check',
        onSelect = null,
        initialFilter = {},
        catalog = null
    } = options;

    const allMonsters = await loadBestiaryCatalog(catalog);

    // Collect available metadata for dropdowns and filter drawer
    const availableTypes = new Set();
    const availableSources = new Set();
    const availableSizes = new Set();
    const availableAlignments = new Set();
    const availableEnvironments = new Set();

    allMonsters.forEach((m) => {
        if (m.type) availableTypes.add(m.type);
        if (m.source) availableSources.add(m.source);
        if (m.size) availableSizes.add(m.size);
        if (m.alignment) availableAlignments.add(m.alignment);
        if (Array.isArray(m.environment)) {
            m.environment.forEach((env) => availableEnvironments.add(env));
        }
    });

    // Modal state
    const state = {
        searchQuery: '',
        sortCol: 'name',
        sortDir: 'asc',
        crMin: initialFilter.crMin !== undefined ? initialFilter.crMin : -1,
        crMax: initialFilter.crMax !== undefined ? initialFilter.crMax : 999,
        type: initialFilter.type || '',
        sources: new Set(initialFilter.sources || []),
        sizes: new Set(initialFilter.sizes || []),
        alignments: new Set(initialFilter.alignments || []),
        environments: new Set(initialFilter.environments || []),
        isAdvancedDrawerOpen: false,
        filtered: [],
        selectedMonster: null,
        fullMonster: null,
        renderedCount: 0,
        batchSize: 50
    };

    // Build DOM structure
    const overlay = document.createElement('div');
    overlay.className = 'vtt-sheet-submodal-overlay creature-selector-overlay';
    overlay.style.cssText =
        'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(3px); z-index:3100; display:flex; align-items:center; justify-content:center;';

    const modal = document.createElement('div');
    modal.className = 'vtt-sheet-submodal glassmorphism creature-selector-modal';
    modal.style.zIndex = '3110';

    modal.innerHTML = `
        <div class="creature-selector-header">
            <h3 class="creature-selector-title">
                <i class="fa-solid ${confirmIcon || 'fa-paw'}"></i>
                <span>${title}</span>
            </h3>
            <button id="csm-close-btn" class="btn btn-icon btn-secondary" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="creature-selector-container">
            <!-- Left Pane: Search, Sort & Results List -->
            <div class="creature-selector-list-pane">
                <div class="creature-selector-search-box">
                    <div style="position:relative; flex:1;">
                        <input type="text" id="csm-search-input" class="vtt-input" placeholder="Search creatures by name, type, source..." autofocus autocomplete="off">
                        <button id="csm-search-clear" type="button" title="Clear search" style="display:none;" class="csm-input-clear-btn"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <button id="csm-filter-toggle" class="btn btn-secondary btn-sm" title="Advanced Filters">
                        <i class="fa-solid fa-filter"></i>
                        <span>Filters</span>
                        <span id="csm-filter-badge" class="csm-badge" style="display:none;">0</span>
                    </button>
                </div>

                <!-- Quick Filter Toolbar -->
                <div class="creature-selector-quick-filters">
                    <div class="csm-filter-group">
                        <label>CR Min</label>
                        <select id="csm-cr-min" class="vtt-select">
                            <option value="">Any</option>
                            <option value="0">0</option>
                            <option value="1/8">1/8</option>
                            <option value="1/4">1/4</option>
                            <option value="1/2">1/2</option>
                            ${[...Array(30).keys()].map((i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                        </select>
                    </div>
                    <div class="csm-filter-group">
                        <label>CR Max</label>
                        <select id="csm-cr-max" class="vtt-select">
                            <option value="">Any</option>
                            <option value="0">0</option>
                            <option value="1/8">1/8</option>
                            <option value="1/4">1/4</option>
                            <option value="1/2">1/2</option>
                            ${[...Array(30).keys()].map((i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                        </select>
                    </div>
                    <div class="csm-filter-group" style="flex:1;">
                        <label>Type</label>
                        <select id="csm-type-sel" class="vtt-select">
                            <option value="">All Types</option>
                            ${Array.from(availableTypes)
                                .sort()
                                .map(
                                    (t) => `<option value="${t}">${t.replace(/\b\w/g, (c) => c.toUpperCase())}</option>`
                                )
                                .join('')}
                        </select>
                    </div>
                </div>

                <!-- Advanced Filter Collapsible Drawer -->
                <div id="csm-advanced-drawer" class="creature-selector-advanced-drawer" style="display:none;">
                    <div class="csm-drawer-section">
                        <div class="csm-drawer-heading">Sourcebooks</div>
                        <div id="csm-sources-list" class="csm-checkbox-grid"></div>
                    </div>
                    <div class="csm-drawer-section">
                        <div class="csm-drawer-heading">Size Category</div>
                        <div id="csm-sizes-list" class="csm-checkbox-grid"></div>
                    </div>
                    <div class="csm-drawer-section">
                        <div class="csm-drawer-heading">Environment</div>
                        <div id="csm-environments-list" class="csm-checkbox-grid"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <button id="csm-reset-filters" class="btn btn-xs btn-secondary"><i class="fa-solid fa-rotate-left"></i> Reset All</button>
                        <span id="csm-filter-count-label" style="font-size:0.75rem; color:var(--color-text-muted);"></span>
                    </div>
                </div>

                <!-- Sortable Table Header -->
                <div class="creature-selector-table-header" id="csm-table-header">
                    <div class="csm-th csm-th-name sorted" data-sort="name" title="Sort by Name">
                        <span>Name</span>
                        <i class="fa-solid fa-arrow-down-a-z csm-sort-icon"></i>
                    </div>
                    <div class="csm-th csm-th-cr" data-sort="crNumeric" title="Sort by Challenge Rating">
                        <span>CR</span>
                        <i class="fa-solid fa-sort csm-sort-icon"></i>
                    </div>
                    <div class="csm-th csm-th-type" data-sort="type" title="Sort by Creature Type">
                        <span>Type</span>
                        <i class="fa-solid fa-sort csm-sort-icon"></i>
                    </div>
                    <div class="csm-th csm-th-source" data-sort="source" title="Sort by Source">
                        <span>Source</span>
                        <i class="fa-solid fa-sort csm-sort-icon"></i>
                    </div>
                </div>

                <!-- Scrollable Table Results -->
                <div id="csm-results-list" class="creature-selector-results-list scroll-styled"></div>

                <div class="creature-selector-status-bar">
                    <span id="csm-results-count">Loading creatures...</span>
                </div>
            </div>

            <!-- Right Pane: Live Statblock & Token Preview -->
            <div class="creature-selector-preview-pane" id="csm-preview-pane">
                <div class="csm-preview-mobile-header">
                    <button id="csm-back-to-list-btn" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-arrow-left"></i> Back to Results
                    </button>
                </div>
                <div id="csm-preview-body" class="csm-preview-body scroll-styled">
                    <div class="csm-preview-empty-state">
                        <i class="fa-solid fa-dragon csm-empty-icon"></i>
                        <div style="font-weight:600; font-size:1rem; color:var(--color-text-primary);">Select a Creature to Preview</div>
                        <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px;">Choose any creature from the list to view its complete statblock, token art, traits, and actions.</div>
                    </div>
                </div>
                <div class="csm-preview-footer" id="csm-preview-footer" style="display:none;">
                    <div id="csm-preview-footer-name" class="csm-footer-creature-info"></div>
                    <button id="csm-confirm-btn" class="btn btn-primary btn-sm">
                        <i class="fa-solid ${confirmIcon || 'fa-check'}"></i>
                        <span>${confirmLabel}</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // Query DOM Elements
    const searchInput = modal.querySelector('#csm-search-input');
    const searchClearBtn = modal.querySelector('#csm-search-clear');
    const filterToggleBtn = modal.querySelector('#csm-filter-toggle');
    const filterBadge = modal.querySelector('#csm-filter-badge');
    const advancedDrawer = modal.querySelector('#csm-advanced-drawer');
    const crMinSel = modal.querySelector('#csm-cr-min');
    const crMaxSel = modal.querySelector('#csm-cr-max');
    const typeSel = modal.querySelector('#csm-type-sel');
    const resetFiltersBtn = modal.querySelector('#csm-reset-filters');
    const tableHeader = modal.querySelector('#csm-table-header');
    const resultsList = modal.querySelector('#csm-results-list');
    const resultsCountEl = modal.querySelector('#csm-results-count');
    const previewBody = modal.querySelector('#csm-preview-body');
    const previewFooter = modal.querySelector('#csm-preview-footer');
    const previewFooterName = modal.querySelector('#csm-preview-footer-name');
    const confirmBtn = modal.querySelector('#csm-confirm-btn');
    const backToListBtn = modal.querySelector('#csm-back-to-list-btn');
    const closeBtn = modal.querySelector('#csm-close-btn');

    // Populate Checkbox Grids for Advanced Filter Drawer
    function buildCheckboxes(containerId, values, stateSet) {
        const container = modal.querySelector(`#${containerId}`);
        if (!container) return;
        container.innerHTML = '';
        Array.from(values)
            .sort()
            .forEach((val) => {
                if (!val) return;
                const label = document.createElement('label');
                label.className = 'csm-checkbox-label';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = val;
                cb.checked = stateSet.has(val);
                cb.addEventListener('change', () => {
                    if (cb.checked) stateSet.add(val);
                    else stateSet.delete(val);
                    applyFiltersAndRender();
                });
                label.appendChild(cb);
                label.appendChild(document.createTextNode(String(val)));
                container.appendChild(label);
            });
    }

    buildCheckboxes('csm-sources-list', availableSources, state.sources);
    buildCheckboxes('csm-sizes-list', availableSizes, state.sizes);
    buildCheckboxes('csm-environments-list', availableEnvironments, state.environments);

    // Filter Logic
    function applyFilters() {
        const q = state.searchQuery.toLowerCase().trim();
        state.filtered = allMonsters.filter((m) => {
            // Text Search
            if (q) {
                const nameMatch = m.name && m.name.toLowerCase().includes(q);
                const typeMatch =
                    (m.type || '').toLowerCase().includes(q) || (m.subtype || '').toLowerCase().includes(q);
                const srcMatch = (m.source || '').toLowerCase().includes(q);
                const crStr = m.cr ? (typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr)).toLowerCase() : '0';
                const crMatch = crStr === q || `cr ${crStr}`.includes(q);
                if (!nameMatch && !typeMatch && !srcMatch && !crMatch) return false;
            }

            // CR Range
            const numericCr = m.crNumeric !== undefined ? m.crNumeric : parseCrToNumeric(m.cr);
            if (state.crMin !== -1 && numericCr < state.crMin) return false;
            if (state.crMax !== 999 && numericCr > state.crMax) return false;

            // Type
            if (state.type) {
                const typeVal = (m.type || '').toLowerCase();
                const subtypeVal = (m.subtype || '').toLowerCase();
                if (typeVal !== state.type.toLowerCase() && subtypeVal !== state.type.toLowerCase()) {
                    return false;
                }
            }

            // Advanced Drawer multi-selects
            if (state.sources.size > 0 && !state.sources.has(m.source)) return false;
            if (state.sizes.size > 0 && !state.sizes.has(m.size)) return false;
            if (state.environments.size > 0) {
                const envs = Array.isArray(m.environment) ? m.environment : [];
                const hasEnv = envs.some((e) => state.environments.has(e));
                if (!hasEnv) return false;
            }

            return true;
        });

        // Sort filtered list
        state.filtered.sort((a, b) => {
            if (state.sortCol === 'name') {
                const res = (a.name || '').localeCompare(b.name || '');
                return state.sortDir === 'asc' ? res : -res;
            } else if (state.sortCol === 'crNumeric') {
                const crA = a.crNumeric !== undefined ? a.crNumeric : parseCrToNumeric(a.cr);
                const crB = b.crNumeric !== undefined ? b.crNumeric : parseCrToNumeric(b.cr);
                const diff = state.sortDir === 'asc' ? crA - crB : crB - crA;
                if (diff !== 0) return diff;
                return (a.name || '').localeCompare(b.name || '');
            } else if (state.sortCol === 'type') {
                const typeA = a.type || a.subtype || '';
                const typeB = b.type || b.subtype || '';
                const diff = state.sortDir === 'asc' ? typeA.localeCompare(typeB) : typeB.localeCompare(typeA);
                if (diff !== 0) return diff;
                return (a.name || '').localeCompare(b.name || '');
            } else if (state.sortCol === 'source') {
                const srcA = a.source || '';
                const srcB = b.source || '';
                const diff = state.sortDir === 'asc' ? srcA.localeCompare(srcB) : srcB.localeCompare(srcA);
                if (diff !== 0) return diff;
                return (a.name || '').localeCompare(b.name || '');
            }
            return 0;
        });

        // Update active filter badge
        let activeFilterCount = 0;
        if (state.crMin !== -1 || state.crMax !== 999) activeFilterCount++;
        if (state.type) activeFilterCount++;
        activeFilterCount += state.sources.size + state.sizes.size + state.environments.size;

        if (activeFilterCount > 0) {
            filterBadge.textContent = activeFilterCount;
            filterBadge.style.display = 'inline-flex';
            filterToggleBtn.classList.add('btn-primary');
            filterToggleBtn.classList.remove('btn-secondary');
        } else {
            filterBadge.style.display = 'none';
            filterToggleBtn.classList.remove('btn-primary');
            filterToggleBtn.classList.add('btn-secondary');
        }
    }

    // Render list rows batch
    function renderResults(reset = true) {
        if (reset) {
            resultsList.innerHTML = '';
            state.renderedCount = 0;
            resultsList.scrollTop = 0;
        }

        if (state.filtered.length === 0) {
            resultsList.innerHTML = `
                <div style="padding:24px; text-align:center; color:var(--color-text-muted);">
                    <i class="fa-solid fa-ghost" style="font-size:1.8rem; margin-bottom:8px; opacity:0.4;"></i>
                    <div>No creatures found matching your criteria.</div>
                </div>
            `;
            resultsCountEl.textContent = '0 creatures';
            return;
        }

        const nextBatch = state.filtered.slice(state.renderedCount, state.renderedCount + state.batchSize);
        const fragment = document.createDocumentFragment();

        nextBatch.forEach((monster) => {
            const row = document.createElement('div');
            const isSelected =
                state.selectedMonster &&
                state.selectedMonster.id === monster.id &&
                state.selectedMonster.name === monster.name;
            row.className = `csm-row ${isSelected ? 'active-row' : ''}`;
            row.dataset.id = monster.id || monster.name;

            const crStr = formatCrDisplay(monster.cr);
            const typeStr = monster.type || monster.subtype || '—';
            const spellBadge = monster.hasSpellcasting
                ? `<span style="color:var(--color-gold-base); margin-left:4px;" title="Spellcaster"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`
                : '';

            row.innerHTML = `
                <div class="csm-col-name" title="${monster.name}">
                    <span class="csm-col-name-text">${monster.name}</span>${spellBadge}
                </div>
                <div class="csm-col-cr"><span class="csm-cr-pill">CR ${crStr}</span></div>
                <div class="csm-col-type" title="${typeStr}">${typeStr}</div>
                <div class="csm-col-source"><span class="csm-source-badge">${monster.source || 'SRD'}</span></div>
            `;

            row.addEventListener('click', () => {
                selectMonster(monster);
            });

            fragment.appendChild(row);
        });

        resultsList.appendChild(fragment);
        state.renderedCount += nextBatch.length;
        resultsCountEl.textContent = `Showing ${Math.min(state.renderedCount, state.filtered.length)} of ${state.filtered.length} creatures`;
    }

    function applyFiltersAndRender() {
        applyFilters();
        renderResults(true);

        // Auto-select first monster if current selection is no longer in filtered list
        if (state.filtered.length > 0) {
            const stillPresent =
                state.selectedMonster &&
                state.filtered.some(
                    (m) => m.name === state.selectedMonster.name && m.source === state.selectedMonster.source
                );
            if (!stillPresent) {
                selectMonster(state.filtered[0], false);
            }
        } else {
            renderEmptyPreview();
        }
    }

    // Scroll listener for batch loading
    resultsList.addEventListener('scroll', () => {
        if (state.renderedCount < state.filtered.length) {
            const { scrollTop, scrollHeight, clientHeight } = resultsList;
            if (scrollTop + clientHeight >= scrollHeight - 60) {
                renderResults(false);
            }
        }
    });

    // Select monster and render preview pane
    async function selectMonster(monster, slideMobile = true) {
        state.selectedMonster = monster;

        // Highlight selected row
        resultsList.querySelectorAll('.csm-row').forEach((r) => {
            const isMatch = r.dataset.id === (monster.id || monster.name);
            r.classList.toggle('active-row', isMatch);
        });

        // Handle mobile sliding view
        if (slideMobile) {
            modal.classList.add('csm-mobile-preview-active');
        }

        renderLoadingPreview(monster);

        // Fetch full creature statblock
        let fullMonster = monster;
        if (typeof window !== 'undefined' && window.fetchFullCreature) {
            try {
                const fetched = await window.fetchFullCreature(monster.source, monster.id || monster.name);
                if (fetched) fullMonster = fetched;
            } catch (e) {
                console.warn('[creature-selector-modal] Full creature hydration fallback:', e);
            }
        }
        state.fullMonster = fullMonster;

        // Render full preview statblock
        renderStatblockPreview(fullMonster);
    }

    function renderEmptyPreview() {
        previewBody.innerHTML = `
            <div class="csm-preview-empty-state">
                <i class="fa-solid fa-dragon csm-empty-icon"></i>
                <div style="font-weight:600; font-size:1rem; color:var(--color-text-primary);">No Creature Selected</div>
                <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px;">Adjust your search or filter settings to view creatures.</div>
            </div>
        `;
        previewFooter.style.display = 'none';
    }

    function renderLoadingPreview(monster) {
        const tokenUrl = getCreatureTokenUrl(monster);
        previewBody.innerHTML = `
            <div class="csm-preview-card">
                <div class="csm-preview-top">
                    <img src="${tokenUrl}" class="csm-preview-avatar" onerror="this.src='favicon.svg'">
                    <div>
                        <h4 style="margin:0; font-size:1.15rem; color:var(--color-gold-base); font-family:var(--font-heading);">${monster.name}</h4>
                        <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:2px;">
                            ${monster.size || ''} ${monster.type || ''} • CR ${formatCrDisplay(monster.cr)} [${monster.source || ''}]
                        </div>
                    </div>
                </div>
                <div style="padding:24px; text-align:center; color:var(--color-text-muted);">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem; color:var(--color-gold-base); margin-bottom:8px;"></i>
                    <div style="font-size:0.85rem;">Hydrating full statblock...</div>
                </div>
            </div>
        `;
        previewFooter.style.display = 'flex';
        previewFooterName.innerHTML = `<strong>${monster.name}</strong> <span style="color:var(--color-text-muted); font-size:0.8em;">(CR ${formatCrDisplay(monster.cr)})</span>`;
    }

    function renderStatblockPreview(m) {
        const tokenUrl = getCreatureTokenUrl(m);
        const crStr = formatCrDisplay(m.cr);

        // HP calculation
        let hpDisplay = '—';
        if (typeof m.hp === 'number') {
            hpDisplay = String(m.hp);
        } else if (m.hp && m.hp.average !== undefined) {
            hpDisplay = `${m.hp.average}${m.hp.formula ? ` (${m.hp.formula})` : ''}`;
        }

        // AC calculation
        let acDisplay = '—';
        if (Array.isArray(m.ac) && m.ac.length > 0) {
            const firstAc = m.ac[0];
            acDisplay =
                typeof firstAc === 'object'
                    ? `${firstAc.ac}${firstAc.from ? ` (${firstAc.from.join(', ')})` : ''}`
                    : String(firstAc);
        } else if (m.ac !== undefined) {
            acDisplay = String(m.ac);
        }

        // Speed calculation
        let speedDisplay = '30 ft.';
        if (typeof m.speed === 'string') {
            speedDisplay = m.speed;
        } else if (typeof m.speed === 'object' && m.speed !== null) {
            speedDisplay = Object.entries(m.speed)
                .map(([mode, val]) =>
                    mode === 'walk' ? `${val} ft.` : `${mode} ${typeof val === 'object' ? val.number : val} ft.`
                )
                .join(', ');
        }

        // Ability Scores
        const abilities = [
            { key: 'STR', val: m.str || 10 },
            { key: 'DEX', val: m.dex || 10 },
            { key: 'CON', val: m.con || 10 },
            { key: 'INT', val: m.int || 10 },
            { key: 'WIS', val: m.wis || 10 },
            { key: 'CHA', val: m.cha || 10 }
        ];

        // Format Trait / Action entries
        const formatEntries = (entries) => {
            if (!Array.isArray(entries) || entries.length === 0) return '';
            return entries
                .map((entry) => {
                    const name = entry.name ? `<strong>${entry.name}.</strong> ` : '';
                    let text = '';
                    if (Array.isArray(entry.entries)) {
                        text = entry.entries.map((e) => (typeof e === 'string' ? e : e.text || '')).join(' ');
                    } else if (typeof entry === 'string') {
                        text = entry;
                    }
                    return `<div class="csm-statblock-entry">${name}${text}</div>`;
                })
                .join('');
        };

        const traitsHtml = formatEntries(m.trait);
        const actionsHtml = formatEntries(m.action);
        const bonusActionsHtml = formatEntries(m.bonus);
        const reactionsHtml = formatEntries(m.reaction);
        const legendaryHtml = formatEntries(m.legendary);

        previewBody.innerHTML = `
            <div class="csm-preview-card">
                <!-- Header -->
                <div class="csm-preview-top">
                    <img src="${tokenUrl}" class="csm-preview-avatar" onerror="this.src='favicon.svg'">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <h4 style="margin:0; font-size:1.25rem; color:var(--color-gold-base); font-family:var(--font-heading);">${m.name}</h4>
                            <span class="csm-source-badge">${m.source || 'SRD'} ${m.edition || ''}</span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--color-text-muted); font-style:italic; margin-top:2px;">
                            ${m.size ? translateSizeName(m.size) : 'Medium'} ${m.type || 'creature'}${m.subtype ? ` (${m.subtype})` : ''}, ${m.alignment || 'unaligned'}
                        </div>
                    </div>
                </div>

                <!-- Core Stats Strip -->
                <div class="csm-core-stats-grid">
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Armor Class</span>
                        <span class="csm-stat-val">${acDisplay}</span>
                    </div>
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Hit Points</span>
                        <span class="csm-stat-val">${hpDisplay}</span>
                    </div>
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Speed</span>
                        <span class="csm-stat-val">${speedDisplay}</span>
                    </div>
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Challenge</span>
                        <span class="csm-stat-val">CR ${crStr}</span>
                    </div>
                </div>

                <!-- Ability Scores Grid -->
                <div class="csm-abilities-grid">
                    ${abilities
                        .map(
                            (a) => `
                        <div class="csm-ability-box">
                            <span class="csm-ability-key">${a.key}</span>
                            <span class="csm-ability-val">${a.val}</span>
                            <span class="csm-ability-mod">${formatAbilityModifier(a.val)}</span>
                        </div>
                    `
                        )
                        .join('')}
                </div>

                <!-- Metadata details: Senses, Languages, Resistances -->
                <div class="csm-meta-details">
                    ${m.save ? `<div><strong>Saving Throws:</strong> ${formatSaves(m.save)}</div>` : ''}
                    ${m.skill ? `<div><strong>Skills:</strong> ${formatSkills(m.skill)}</div>` : ''}
                    ${m.senses ? `<div><strong>Senses:</strong> ${Array.isArray(m.senses) ? m.senses.join(', ') : m.senses}</div>` : ''}
                    ${m.languages ? `<div><strong>Languages:</strong> ${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages}</div>` : ''}
                    ${m.resistances ? `<div><strong>Damage Resistances:</strong> ${Array.isArray(m.resistances) ? m.resistances.join(', ') : m.resistances}</div>` : ''}
                    ${m.immunities ? `<div><strong>Damage Immunities:</strong> ${Array.isArray(m.immunities) ? m.immunities.join(', ') : m.immunities}</div>` : ''}
                    ${m.vulnerabilities ? `<div><strong>Damage Vulnerabilities:</strong> ${Array.isArray(m.vulnerabilities) ? m.vulnerabilities.join(', ') : m.vulnerabilities}</div>` : ''}
                </div>

                <!-- Traits -->
                ${traitsHtml ? `<div class="csm-section"><div class="csm-section-heading">Traits</div>${traitsHtml}</div>` : ''}

                <!-- Actions -->
                ${actionsHtml ? `<div class="csm-section"><div class="csm-section-heading">Actions</div>${actionsHtml}</div>` : ''}

                <!-- Bonus Actions -->
                ${bonusActionsHtml ? `<div class="csm-section"><div class="csm-section-heading">Bonus Actions</div>${bonusActionsHtml}</div>` : ''}

                <!-- Reactions -->
                ${reactionsHtml ? `<div class="csm-section"><div class="csm-section-heading">Reactions</div>${reactionsHtml}</div>` : ''}

                <!-- Legendary Actions -->
                ${legendaryHtml ? `<div class="csm-section"><div class="csm-section-heading">Legendary Actions</div>${legendaryHtml}</div>` : ''}
            </div>
        `;

        previewFooter.style.display = 'flex';
        previewFooterName.innerHTML = `<strong>${m.name}</strong> <span style="color:var(--color-text-muted); font-size:0.8em;">(CR ${crStr})</span>`;
    }

    function translateSizeName(sizeChar) {
        const map = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
        return map[sizeChar] || sizeChar;
    }

    function formatSaves(saveObj) {
        if (!saveObj || typeof saveObj !== 'object') return '';
        return Object.entries(saveObj)
            .map(([k, v]) => `${k.toUpperCase()} ${v}`)
            .join(', ');
    }

    function formatSkills(skillObj) {
        if (!skillObj || typeof skillObj !== 'object') return '';
        return Object.entries(skillObj)
            .map(([k, v]) => `${k.replace(/\b\w/g, (c) => c.toUpperCase())} ${v}`)
            .join(', ');
    }

    // Modal Close Cleanup
    let escListener = null;
    let searchDebounceTimer = null;
    const closeModal = () => {
        if (escListener) window.removeEventListener('keydown', escListener);
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        overlay.remove();
        modal.remove();
    };

    escListener = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', escListener);

    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    // Mobile Back to Results
    backToListBtn.addEventListener('click', () => {
        modal.classList.remove('csm-mobile-preview-active');
    });

    // Confirm Button
    confirmBtn.addEventListener('click', () => {
        if (!state.selectedMonster) return;
        const chosen = state.selectedMonster;
        const full = state.fullMonster || chosen;
        closeModal();
        if (typeof onSelect === 'function') {
            onSelect(chosen, full);
        }
    });

    // Event Handlers for Filters and Search
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        searchClearBtn.style.display = state.searchQuery ? 'block' : 'none';
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            applyFiltersAndRender();
        }, 100);
    });

    searchClearBtn.addEventListener('click', () => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchInput.value = '';
        state.searchQuery = '';
        searchClearBtn.style.display = 'none';
        applyFiltersAndRender();
        searchInput.focus();
    });

    crMinSel.addEventListener('change', (e) => {
        state.crMin = e.target.value ? parseCrToNumeric(e.target.value) : -1;
        applyFiltersAndRender();
    });

    crMaxSel.addEventListener('change', (e) => {
        state.crMax = e.target.value ? parseCrToNumeric(e.target.value) : 999;
        applyFiltersAndRender();
    });

    typeSel.addEventListener('change', (e) => {
        state.type = e.target.value;
        applyFiltersAndRender();
    });

    filterToggleBtn.addEventListener('click', () => {
        state.isAdvancedDrawerOpen = !state.isAdvancedDrawerOpen;
        advancedDrawer.style.display = state.isAdvancedDrawerOpen ? 'block' : 'none';
    });

    resetFiltersBtn.addEventListener('click', () => {
        state.crMin = -1;
        state.crMax = 999;
        state.type = '';
        state.sources.clear();
        state.sizes.clear();
        state.environments.clear();
        crMinSel.value = '';
        crMaxSel.value = '';
        typeSel.value = '';

        modal.querySelectorAll('.csm-checkbox-label input[type="checkbox"]').forEach((cb) => {
            cb.checked = false;
        });

        applyFiltersAndRender();
    });

    // Sort Click Handlers
    tableHeader.querySelectorAll('.csm-th').forEach((th) => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (state.sortCol === col) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortCol = col;
                state.sortDir = 'asc';
            }

            // Update UI headers
            tableHeader.querySelectorAll('.csm-th').forEach((cell) => {
                const icon = cell.querySelector('.csm-sort-icon');
                if (cell === th) {
                    cell.classList.add('sorted');
                    if (icon) {
                        if (col === 'name') {
                            icon.className =
                                state.sortDir === 'asc'
                                    ? 'fa-solid fa-arrow-down-a-z csm-sort-icon'
                                    : 'fa-solid fa-arrow-up-z-a csm-sort-icon';
                        } else if (col === 'crNumeric') {
                            icon.className =
                                state.sortDir === 'asc'
                                    ? 'fa-solid fa-arrow-down-1-9 csm-sort-icon'
                                    : 'fa-solid fa-arrow-up-9-1 csm-sort-icon';
                        } else {
                            icon.className =
                                state.sortDir === 'asc'
                                    ? 'fa-solid fa-arrow-down-short-wide csm-sort-icon'
                                    : 'fa-solid fa-arrow-up-wide-short csm-sort-icon';
                        }
                    }
                } else {
                    cell.classList.remove('sorted');
                    if (icon) icon.className = 'fa-solid fa-sort csm-sort-icon';
                }
            });

            applyFiltersAndRender();
        });
    });

    // Initial Filter & Render
    applyFiltersAndRender();
}

// Ensure global registration on window.VTT
if (typeof window !== 'undefined') {
    window.VTT = window.VTT || {};
    window.VTT.openCreatureSelectorModal = openCreatureSelectorModal;
}
