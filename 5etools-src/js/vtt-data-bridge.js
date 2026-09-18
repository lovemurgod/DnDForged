// DnDForged 5etools Data Bridge

export function initVttDataBridge(vtt) {
    const listContainer = document.getElementById('library-monster-list');
    const searchInput = document.getElementById('library-search');
    const viewport = document.getElementById('vtt-canvas-viewport');
    
    let monsters = [];
    let currentSortCol = 'name';
    let currentSortDir = 'asc';
    let currentlyFilteredMonsters = [];
    let renderedCount = 0;
    const CHUNK_SIZE = 100;
    let advancedFilters = { crMin: -1, crMax: 999, source: [], type: [], size: [], environment: [], alignment: [], resistances: [], immunities: [], vulnerabilities: [], damageTypes: [], saveTypes: [], senses: [], languages: [], movementTypes: [] };
    let filterLogics = { resistances: 'OR', immunities: 'OR', vulnerabilities: 'OR', damageTypes: 'OR', saveTypes: 'OR', senses: 'OR', languages: 'OR', movementTypes: 'OR' };
    
    // In-memory cache for full creature statblocks
    const creatureCache = new Map();

    async function fetchFullCreature(source, idOrName) {
        if (!source || !idOrName) return null;
        const key = `${source.toLowerCase()}|${idOrName.toLowerCase()}`;
        if (creatureCache.has(key)) return creatureCache.get(key);

        try {
            const res = await fetch(`/api/creature/${encodeURIComponent(source)}/${encodeURIComponent(idOrName)}`);
            if (res.ok) {
                const data = await res.json();
                creatureCache.set(key, data);
                if (data.id) creatureCache.set(`${source.toLowerCase()}|${data.id.toLowerCase()}`, data);
                if (data.name) creatureCache.set(`${source.toLowerCase()}|${data.name.toLowerCase()}`, data);
                return data;
            }
        } catch (err) {
            console.warn(`[vtt-data-bridge] /api/creature failed for ${idOrName}, trying partition fallback:`, err);
        }

        // Resilient static partition fallback
        try {
            let partRes = await fetch(`/data/bestiary-normalized/bestiary-${source.toLowerCase()}.json`);
            if (!partRes.ok) partRes = await fetch(`data/bestiary-normalized/bestiary-${source.toLowerCase()}.json`);
            if (partRes.ok) {
                const partition = await partRes.json();
                const clean = idOrName.toLowerCase();
                const found = partition.find(m => 
                    m.id?.toLowerCase() === clean || 
                    m.name?.toLowerCase() === clean ||
                    m.id?.toLowerCase() === `creature_${clean.replace(/ /g, '_')}_${source.toLowerCase()}`
                );
                if (found) {
                    creatureCache.set(key, found);
                    if (found.id) creatureCache.set(`${source.toLowerCase()}|${found.id.toLowerCase()}`, found);
                    if (found.name) creatureCache.set(`${source.toLowerCase()}|${found.name.toLowerCase()}`, found);
                    return found;
                }
            }
        } catch (err) {
            console.warn(`[vtt-data-bridge] Failed partition fallback for ${idOrName}:`, err);
        }

        return null;
    }
    window.fetchFullCreature = fetchFullCreature;

    // Map importer cache
    let mapCatalog = null;

    // Load normalized D&D 5e Bestiary Catalog
    loadBestiaryData();
    initSidebarResizer();

    async function loadBestiaryData() {
        try {
            listContainer.innerHTML = '<div class="text-muted p-3"><i class="fa-solid fa-spinner fa-spin"></i> Loading normalized bestiary catalog...</div>';
            
            let catalogRes = await fetch('/api/bestiary/catalog');
            if (!catalogRes.ok) {
                catalogRes = await fetch('/data/bestiary-catalog.json');
            }
            if (!catalogRes.ok) throw new Error('Could not load bestiary catalog');
            
            monsters = await catalogRes.json();
            populateFiltersUI();
            setupFilterListeners();
            applyMonsterFilters();
        } catch (e) {
            console.error("Error fetching normalized bestiary data:", e);
            listContainer.innerHTML = '<div class="text-danger p-3"><i class="fa-solid fa-triangle-exclamation"></i> Error accessing bestiary library.</div>';
        }
    }

    function sortMonsters(list) {
        return list.slice().sort((a, b) => {
            let res = 0;
            if (currentSortCol === 'name') {
                res = (a.name || '').localeCompare(b.name || '');
            } else if (currentSortCol === 'crNumeric') {
                const crA = a.crNumeric !== undefined ? a.crNumeric : (parseFloat(a.cr) || 0);
                const crB = b.crNumeric !== undefined ? b.crNumeric : (parseFloat(b.cr) || 0);
                res = crA - crB;
                if (res === 0) res = (a.name || '').localeCompare(b.name || '');
            } else if (currentSortCol === 'type') {
                const typeA = (a.type || a.subtype || '');
                const typeB = (b.type || b.subtype || '');
                res = typeA.localeCompare(typeB);
                if (res === 0) res = (a.name || '').localeCompare(b.name || '');
            } else if (currentSortCol === 'source') {
                const srcA = (a.source || '');
                const srcB = (b.source || '');
                res = srcA.localeCompare(srcB);
                if (res === 0) res = (a.name || '').localeCompare(b.name || '');
            }
            return currentSortDir === 'asc' ? res : -res;
        });
    }

    function updateSortHeaderIcons() {
        const tableHeader = document.getElementById('bestiary-table-header');
        if (!tableHeader) return;
        tableHeader.querySelectorAll('.bestiary-th-sort').forEach(th => {
            const col = th.dataset.sort;
            const icon = th.querySelector('.sort-icon');
            if (col === currentSortCol) {
                th.classList.add('sorted');
                if (icon) {
                    if (col === 'name') {
                        icon.className = currentSortDir === 'asc' ? 'fa-solid fa-arrow-down-a-z sort-icon' : 'fa-solid fa-arrow-up-z-a sort-icon';
                    } else if (col === 'crNumeric') {
                        icon.className = currentSortDir === 'asc' ? 'fa-solid fa-arrow-down-1-9 sort-icon' : 'fa-solid fa-arrow-up-9-1 sort-icon';
                    } else {
                        icon.className = currentSortDir === 'asc' ? 'fa-solid fa-arrow-down-short-wide sort-icon' : 'fa-solid fa-arrow-up-wide-short sort-icon';
                    }
                }
            } else {
                th.classList.remove('sorted');
                if (icon) {
                    icon.className = 'fa-solid fa-sort sort-icon';
                }
            }
        });
    }

    function setupFilterListeners() {
        const tableHeader = document.getElementById('bestiary-table-header');
        if (tableHeader) {
            tableHeader.querySelectorAll('.bestiary-th-sort').forEach(th => {
                th.addEventListener('click', () => {
                    const col = th.dataset.sort;
                    if (currentSortCol === col) {
                        currentSortDir = (currentSortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                        currentSortCol = col;
                        currentSortDir = (col === 'crNumeric' ? 'desc' : 'asc');
                    }
                    updateSortHeaderIcons();
                    applyMonsterFilters();
                });
            });
        }

        if (listContainer) {
            listContainer.addEventListener('scroll', () => {
                if (renderedCount >= currentlyFilteredMonsters.length) return;
                const { scrollTop, scrollHeight, clientHeight } = listContainer;
                if (scrollTop + clientHeight >= scrollHeight - 350) {
                    appendMonsterBatch();
                }
            });
        }

        // Live search filter & clear button
        const searchClear = document.getElementById('library-search-clear');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (searchClear) searchClear.style.display = searchInput.value ? 'block' : 'none';
                applyMonsterFilters();
            });
        }
        if (searchClear && searchInput) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                searchClear.style.display = 'none';
                applyMonsterFilters();
                searchInput.focus();
            });
        }

        // Modal triggers
        const btnFilter = document.getElementById('btn-bestiary-filter');
        const modalFilter = document.getElementById('modal-bestiary-filter');
        const btnCloseFilter = document.getElementById('btn-close-bestiary-filter');
        const btnApplyFilter = document.getElementById('btn-apply-filters');
        const btnClearFilter = document.getElementById('btn-clear-filters');

        if (btnFilter && modalFilter) {
            btnFilter.addEventListener('click', () => {
                modalFilter.classList.remove('vtt-hidden');
            });
        }
        if (btnCloseFilter && modalFilter) {
            btnCloseFilter.addEventListener('click', () => {
                modalFilter.classList.add('vtt-hidden');
            });
        }
        if (btnApplyFilter && modalFilter) {
            btnApplyFilter.addEventListener('click', () => {
                modalFilter.classList.add('vtt-hidden');
                syncFiltersFromUI();
                applyMonsterFilters();
            });
        }
        if (btnClearFilter) {
            btnClearFilter.addEventListener('click', () => {
                document.querySelectorAll('#modal-bestiary-filter input[type="checkbox"]').forEach(cb => cb.checked = false);
                const minEl = document.getElementById('filter-cr-min');
                const maxEl = document.getElementById('filter-cr-max');
                if (minEl) minEl.value = "";
                if (maxEl) maxEl.value = "";

                // Reset logic toggles to OR
                document.querySelectorAll('#modal-bestiary-filter .filter-logic-toggle').forEach(btn => {
                    btn.dataset.logic = 'OR';
                    btn.textContent = 'OR';
                    btn.classList.add('btn-secondary');
                    btn.classList.remove('btn-primary');
                });
                Object.keys(filterLogics).forEach(k => filterLogics[k] = 'OR');

                syncFiltersFromUI();
                applyMonsterFilters();
            });
        }

        // Logic toggles
        document.querySelectorAll('.filter-logic-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const current = btn.dataset.logic || 'OR';
                const next = current === 'OR' ? 'AND' : 'OR';
                btn.dataset.logic = next;
                btn.textContent = next;
                if (next === 'AND') {
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                } else {
                    btn.classList.add('btn-secondary');
                    btn.classList.remove('btn-primary');
                }
            });
        });
    }

    function formatOptionLabel(opt, category) {
        if (!opt) return '';
        if (category === 'saveTypes') return String(opt).toUpperCase();
        if (category === 'cr') return String(opt);
        return String(opt).replace(/\b\w/g, c => c.toUpperCase());
    }

    function buildCheckboxList(containerId, optionsList, categoryName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        optionsList.forEach(opt => {
            if (!opt) return;
            const lbl = document.createElement('label');
            lbl.style.display = 'flex';
            lbl.style.gap = '8px';
            lbl.style.alignItems = 'center';
            lbl.style.cursor = 'pointer';
            lbl.style.fontSize = '0.8rem';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = opt;
            cb.dataset.category = categoryName;
            
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(formatOptionLabel(opt, categoryName)));
            container.appendChild(lbl);
        });
    }

    function populateFiltersUI() {
        const crs = new Set();
        const sources = new Set();
        const types = new Set();
        const sizes = new Set();
        const envs = new Set();
        const aligns = new Set();
        const resists = new Set();
        const immunes = new Set();
        const vulns = new Set();
        const dmg = new Set();
        const saves = new Set();
        const senses = new Set();
        const langs = new Set();
        const moves = new Set();

        monsters.forEach(m => {
            if (m.cr !== undefined) crs.add(typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr));
            if (m.source) sources.add(m.source);
            if (m.type) types.add(m.type);
            if (m.subtype) types.add(m.subtype);
            if (m.size) sizes.add(m.size);
            if (m.alignment) aligns.add(m.alignment);
            if (m.environment) m.environment.forEach(e => envs.add(e));
            if (m.resistances) m.resistances.forEach(e => resists.add(e));
            if (m.immunities) m.immunities.forEach(e => immunes.add(e));
            if (m.vulnerabilities) m.vulnerabilities.forEach(e => vulns.add(e));
            if (m.damageTypes) m.damageTypes.forEach(e => dmg.add(e));
            if (m.saveTypes) m.saveTypes.forEach(e => saves.add(e));
            if (m.senses) m.senses.forEach(e => senses.add(e));
            if (m.languages) m.languages.forEach(e => langs.add(e));
            if (m.movementTypes) m.movementTypes.forEach(e => moves.add(e));
        });

        // CR Dropdowns
        const crMinSel = document.getElementById('filter-cr-min');
        const crMaxSel = document.getElementById('filter-cr-max');
        const sortedCrs = Array.from(crs).sort((a, b) => {
            const na = a === '1/8' ? 0.125 : (a === '1/4' ? 0.25 : (a === '1/2' ? 0.5 : parseFloat(a)));
            const nb = b === '1/8' ? 0.125 : (b === '1/4' ? 0.25 : (b === '1/2' ? 0.5 : parseFloat(b)));
            return na - nb;
        });
        
        let crHtml = '<option value="">Any</option>';
        sortedCrs.forEach(c => crHtml += `<option value="${c}">${c}</option>`);
        if (crMinSel) crMinSel.innerHTML = crHtml;
        if (crMaxSel) crMaxSel.innerHTML = crHtml;

        buildCheckboxList('filter-source-container', Array.from(sources).sort(), 'source');
        buildCheckboxList('filter-type-container', Array.from(types).sort(), 'type');
        buildCheckboxList('filter-size-container', Array.from(sizes).sort(), 'size');
        buildCheckboxList('filter-env-container', Array.from(envs).sort(), 'environment');
        buildCheckboxList('filter-alignment-container', Array.from(aligns).sort(), 'alignment');
        buildCheckboxList('filter-resistances-container', Array.from(resists).sort(), 'resistances');
        buildCheckboxList('filter-immunities-container', Array.from(immunes).sort(), 'immunities');
        buildCheckboxList('filter-vulnerabilities-container', Array.from(vulns).sort(), 'vulnerabilities');
        buildCheckboxList('filter-damage-container', Array.from(dmg).sort(), 'damageTypes');
        buildCheckboxList('filter-saves-container', Array.from(saves).sort(), 'saveTypes');
        buildCheckboxList('filter-senses-container', Array.from(senses).sort(), 'senses');
        buildCheckboxList('filter-languages-container', Array.from(langs).sort(), 'languages');
        buildCheckboxList('filter-movement-container', Array.from(moves).sort(), 'movementTypes');
    }

    function syncFiltersFromUI() {
        const crMinStr = document.getElementById('filter-cr-min')?.value;
        const crMaxStr = document.getElementById('filter-cr-max')?.value;
        advancedFilters.crMin = crMinStr ? (crMinStr === '1/8' ? 0.125 : (crMinStr === '1/4' ? 0.25 : (crMinStr === '1/2' ? 0.5 : parseFloat(crMinStr)))) : -1;
        advancedFilters.crMax = crMaxStr ? (crMaxStr === '1/8' ? 0.125 : (crMaxStr === '1/4' ? 0.25 : (crMaxStr === '1/2' ? 0.5 : parseFloat(crMaxStr)))) : 999;

        const catToContainerId = {
            source: 'filter-source-container',
            type: 'filter-type-container',
            size: 'filter-size-container',
            environment: 'filter-env-container',
            alignment: 'filter-alignment-container',
            resistances: 'filter-resistances-container',
            immunities: 'filter-immunities-container',
            vulnerabilities: 'filter-vulnerabilities-container',
            damageTypes: 'filter-damage-container',
            saveTypes: 'filter-saves-container',
            senses: 'filter-senses-container',
            languages: 'filter-languages-container',
            movementTypes: 'filter-movement-container'
        };

        const cats = Object.keys(catToContainerId);
        let activeCount = 0;
        if (advancedFilters.crMin !== -1 || advancedFilters.crMax !== 999) activeCount++;

        cats.forEach(cat => {
            advancedFilters[cat] = Array.from(document.querySelectorAll(`input[data-category="${cat}"]:checked`)).map(cb => cb.value);
            activeCount += advancedFilters[cat].length;
            
            // Sync Logic button if present
            const contId = catToContainerId[cat];
            const headerBtn = document.querySelector(`.filter-logic-toggle[data-category="${cat}"]`) || 
                              document.getElementById(contId)?.parentElement?.querySelector('.filter-logic-toggle');
            if (headerBtn) {
                filterLogics[cat] = headerBtn.dataset.logic || 'OR';
            }
        });

        // Update badge and filter button appearance
        const filterBadge = document.getElementById('bestiary-filter-badge');
        const filterBtn = document.getElementById('btn-bestiary-filter');
        if (filterBadge) {
            if (activeCount > 0) {
                filterBadge.textContent = activeCount;
                filterBadge.style.display = 'inline-flex';
                if (filterBtn) {
                    filterBtn.classList.add('btn-primary');
                    filterBtn.classList.remove('btn-secondary');
                }
            } else {
                filterBadge.style.display = 'none';
                if (filterBtn) {
                    filterBtn.classList.remove('btn-primary');
                    filterBtn.classList.add('btn-secondary');
                }
            }
        }
    }

    function checkLogic(monsterArr, filterArr, logic) {
        if (!filterArr || filterArr.length === 0) return true;
        if (!monsterArr || monsterArr.length === 0) return false;
        const normMonster = monsterArr.map(x => String(x).toLowerCase().trim());
        if (logic === 'AND') {
            return filterArr.every(f => normMonster.includes(String(f).toLowerCase().trim()));
        } else {
            return filterArr.some(f => normMonster.includes(String(f).toLowerCase().trim()));
        }
    }

    function applyMonsterFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filtered = monsters.filter(m => {
            // Search Query
            if (query) {
                const nameMatch = m.name && m.name.toLowerCase().includes(query);
                const typeMatch = (m.type || '').toLowerCase().includes(query) || (m.subtype || '').toLowerCase().includes(query);
                const srcMatch = (m.source || '').toLowerCase().includes(query);
                if (!nameMatch && !typeMatch && !srcMatch) return false;
            }

            // CR Min/Max
            const mCr = m.crNumeric !== undefined ? m.crNumeric : (parseFloat(m.cr) || 0);
            if (advancedFilters.crMin !== -1 && mCr < advancedFilters.crMin) return false;
            if (advancedFilters.crMax !== 999 && mCr > advancedFilters.crMax) return false;

            // Simple OR matches for General metadata
            if (advancedFilters.source.length > 0 && !advancedFilters.source.includes(m.source)) return false;
            if (advancedFilters.size.length > 0 && !advancedFilters.size.includes(m.size)) return false;
            if (advancedFilters.alignment.length > 0 && !advancedFilters.alignment.includes(m.alignment)) return false;
            
            // Type/Subtype
            if (advancedFilters.type.length > 0) {
                const typeArr = [m.type, m.subtype].filter(Boolean);
                if (!advancedFilters.type.some(t => typeArr.includes(t))) return false;
            }

            // Environment (Array)
            if (advancedFilters.environment.length > 0 && !checkLogic(m.environment, advancedFilters.environment, 'OR')) return false;

            // Arrays with Logic toggles
            if (!checkLogic(m.resistances, advancedFilters.resistances, filterLogics.resistances)) return false;
            if (!checkLogic(m.immunities, advancedFilters.immunities, filterLogics.immunities)) return false;
            if (!checkLogic(m.vulnerabilities, advancedFilters.vulnerabilities, filterLogics.vulnerabilities)) return false;
            if (!checkLogic(m.damageTypes, advancedFilters.damageTypes, filterLogics.damageTypes)) return false;
            if (!checkLogic(m.saveTypes, advancedFilters.saveTypes, filterLogics.saveTypes)) return false;
            if (!checkLogic(m.senses, advancedFilters.senses, filterLogics.senses)) return false;
            if (!checkLogic(m.languages, advancedFilters.languages, filterLogics.languages)) return false;
            if (!checkLogic(m.movementTypes, advancedFilters.movementTypes, filterLogics.movementTypes)) return false;

            return true;
        });

        currentlyFilteredMonsters = sortMonsters(filtered);
        renderedCount = 0;
        listContainer.innerHTML = '';

        if (currentlyFilteredMonsters.length === 0) {
            listContainer.innerHTML = '<div class="text-muted p-3" style="text-align:center;">No monsters found.</div>';
            return;
        }

        appendMonsterBatch();
    }

    function appendMonsterBatch() {
        const nextBatch = currentlyFilteredMonsters.slice(renderedCount, renderedCount + CHUNK_SIZE);
        if (nextBatch.length === 0) return;

        // Remove old sentinel if present
        const oldSentinel = document.getElementById('bestiary-sentinel');
        if (oldSentinel) oldSentinel.remove();

        const fragment = document.createDocumentFragment();

        nextBatch.forEach(monster => {
            const item = document.createElement('div');
            item.className = 'bestiary-table-row';
            item.draggable = true;
            
            // Format challenge rating (CR)
            let crStr = monster.cr ? (typeof monster.cr === 'object' ? monster.cr.cr : monster.cr) : '0';
            
            // Spellcaster indicator
            const spellBadge = monster.hasSpellcasting 
                ? `<span title="${monster.casterLevel ? monster.casterLevel + 'th-level ' : ''}${monster.spellAbility ? monster.spellAbility.toUpperCase() + ' ' : ''}Spellcaster" style="color:var(--color-gold-base); margin-left:3px; font-size:0.75rem;"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`
                : '';

            const editionClass = monster.edition === '2024' ? 'edition-2024' : '';
            const typeLabel = monster.type || monster.subtype || '—';

            item.innerHTML = `
                <div class="bestiary-col-name" title="${monster.name}">
                    <span class="bestiary-col-name-text">${monster.name}</span>
                    ${spellBadge}
                </div>
                <div class="bestiary-col-cr" title="CR ${crStr}">${crStr}</div>
                <div class="bestiary-col-type" title="${typeLabel}">${typeLabel}</div>
                <div class="bestiary-col-source" title="${monster.source} (${monster.edition || '2014'})">
                    <span class="bestiary-source-pill ${editionClass}">${monster.source}</span>
                </div>
            `;

            // Calculate VTT attributes
            const hp = monster.hp || calculateMonsterHp(monster);
            const size = translateSizeCategory(monster.sizeCategory || monster.size);
            const imageUrl = monster.tokenImg || getMonsterImageUrl(monster);

            // Mobile 1-tap spawn button
            const spawnBtn = document.createElement('button');
            spawnBtn.className = 'btn-mobile-spawn-token';
            spawnBtn.title = 'Spawn on Map';
            spawnBtn.innerHTML = '<i class="fa-solid fa-plus pointer-events-none"></i>';
            spawnBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                spawnMonsterAtCenter(monster);
            });
            item.appendChild(spawnBtn);

            // Drag start handler - packages token payload
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'bestiary',
                    id: monster.id,
                    name: monster.name,
                    source: monster.source,
                    edition: monster.edition,
                    hp: hp,
                    maxHp: hp,
                    size: size,
                    img: imageUrl,
                    monsterData: monster // Has catalog summary; hydrated with full data on drop
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });

            // Clicking opens creature sheet (fetches full statblock if needed)
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.btn-mobile-spawn-token')) return;
                if (window.VTT?.creatureSheet) {
                    let fullMonster = await fetchFullCreature(monster.source, monster.id);
                    if (!fullMonster) fullMonster = monster;
                    window.VTT.creatureSheet.openSheet(fullMonster, null);
                }
            });

            fragment.appendChild(item);
        });

        listContainer.appendChild(fragment);
        renderedCount += nextBatch.length;

        // Add sentinel / progress footer
        if (renderedCount < currentlyFilteredMonsters.length) {
            const sentinel = document.createElement('div');
            sentinel.id = 'bestiary-sentinel';
            sentinel.className = 'bestiary-scroll-sentinel';
            sentinel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Loaded ${renderedCount} of ${currentlyFilteredMonsters.length} (scroll for more)</span>`;
            listContainer.appendChild(sentinel);
        } else if (currentlyFilteredMonsters.length > CHUNK_SIZE) {
            const endNote = document.createElement('div');
            endNote.className = 'bestiary-scroll-sentinel';
            endNote.style.opacity = '0.5';
            endNote.innerHTML = `<i class="fa-solid fa-check"></i> <span>All ${currentlyFilteredMonsters.length} creatures loaded</span>`;
            listContainer.appendChild(endNote);
        }
    }

    function initSidebarResizer() {
        const resizer = document.getElementById('vtt-sidebar-resizer');
        const workspace = document.getElementById('vtt-workspace');
        if (!resizer || !workspace) return;

        // Restore saved width from localStorage
        const savedWidth = localStorage.getItem('forgedvtt_sidebar_width');
        if (savedWidth) {
            const widthNum = Math.max(300, Math.min(700, parseInt(savedWidth)));
            document.documentElement.style.setProperty('--sidebar-width', `${widthNum}px`);
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 380;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            resizer.classList.add('is-resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            const currentComputed = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 380;
            startWidth = currentComputed;

            const onMouseMove = (moveEv) => {
                if (!isResizing) return;
                const dx = startX - moveEv.clientX; // dragging left increases width
                const newWidth = Math.max(300, Math.min(700, startWidth + dx));
                document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
            };

            const onMouseUp = () => {
                if (!isResizing) return;
                isResizing = false;
                resizer.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);

                const finalWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 380;
                localStorage.setItem('forgedvtt_sidebar_width', String(finalWidth));
                if (vtt && vtt.canvas && typeof vtt.canvas.handleResize === 'function') {
                    vtt.canvas.handleResize();
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    // Live search filter
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyMonsterFilters();
        });
    }

    // Translate 5etools sizes (S, M, L, H, G) to grid square sizes
    function translateSizeCategory(sizeLetter) {
        if (!sizeLetter) return 1;
        const letter = Array.isArray(sizeLetter) ? sizeLetter[0] : sizeLetter;
        switch(letter.toUpperCase()) {
            case 'T': return 1; // Tiny
            case 'S': return 1; // Small
            case 'M': return 1; // Medium
            case 'L': return 2; // Large
            case 'H': return 3; // Huge
            case 'G': return 4; // Gargantuan
            default: return 1;
        }
    }

    // Resolve HP from formula or static averages
    function calculateMonsterHp(monster) {
        if (monster.hp && monster.hp.average) return monster.hp.average;
        if (monster.hp && monster.hp.formula) {
            // Quick evaluate or default fallback
            return parseInt(monster.hp.formula.split('d')[0]) * 5 || 20;
        }
        return 20;
    }

    // Parse maximum vision distance from senses array (returns 0 if no special vision like darkvision)
    function parseMonsterVision(monster) {
        if (!monster || !monster.senses) return 0;
        let maxVision = 0;
        const senses = Array.isArray(monster.senses) ? monster.senses : [monster.senses];
        senses.forEach(sense => {
            if (typeof sense === 'string') {
                const match = sense.match(/(?:darkvision|blindsight|truesight|tremorsense)\s*(\d+)/i);
                if (match && match[1]) {
                    const dist = parseInt(match[1], 10);
                    if (dist > maxVision) maxVision = dist;
                }
            }
        });
        return maxVision;
    }
    window.parseMonsterVision = parseMonsterVision;

    // Parse image location matching local folder structure with offline generator fallback
    function getMonsterImageUrl(monster) {
        if (!monster) return (window.VTT?.generateArcaneToken ? window.VTT.generateArcaneToken('Creature', 'monster') : 'favicon.svg');
        if (monster.tokenImg) return monster.tokenImg;
        if (monster.tokenUrl) return monster.tokenUrl;
        if (monster.imgUrl) return monster.imgUrl;
        if (typeof Renderer !== 'undefined' && Renderer.monster && Renderer.monster.getTokenUrl) {
            try {
                const rUrl = Renderer.monster.getTokenUrl(monster);
                if (rUrl) return rUrl;
            } catch (e) {}
        }
        if (monster.hasToken || monster.source || monster.name) {
            const cleanName = typeof Parser !== 'undefined' ? Parser.nameToTokenName(monster.name) : (monster.name || '').replace(/"/g, '').trim();
            const source = monster.source || 'MM';
            return `img/bestiary/tokens/${source}/${cleanName}.webp`;
        }
        // Fallback to offline arcane token
        return (window.VTT?.generateArcaneToken ? window.VTT.generateArcaneToken(monster.name, 'monster') : 'favicon.svg');
    }

    // Direct drag-and-drop landing handler on viewport canvas
    viewport.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    viewport.addEventListener('drop', (e) => {
        e.preventDefault();
        
        try {
            const rawData = e.dataTransfer.getData('application/json');
            if (!rawData) return;
            const data = JSON.parse(rawData);
            
            if (data.type === 'bestiary') {
                const canvasEngine = window.VTT.canvasEngine;
                const grid = canvasEngine.getGrid();
                
                // Use the exposed coordinates resolver tool to get true canvas coordinate of drag
                const mouse = canvasEngine.getCanvasMouseCoords(e);
                
                const sizePx = data.size * grid.size * grid.scale;

                const token = {
                    id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: data.name,
                    x: mouse.x - sizePx / 2, // Center dropped entity
                    y: mouse.y - sizePx / 2,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    size: data.size,
                    sightRange: parseMonsterVision(data.monsterData),
                    img: data.img,
                    isPlayer: false,
                    layer: canvasEngine.getActiveLayer(),
                    isBorderless: true,
                    monsterData: data.monsterData || null // Full stat block
                };

                // Apply grid snapping alignment
                const snap = snapToCoords(token.x, token.y, grid);
                token.x = snap.x;
                token.y = snap.y;

                canvasEngine.addToken(token);
                
                // Asynchronously hydrate token.monsterData with full normalized creature if needed
                if (data.source && (data.id || data.name)) {
                    fetchFullCreature(data.source, data.id || data.name).then(fullMonster => {
                        if (fullMonster) {
                            token.monsterData = fullMonster;
                            if (window.VTT?.socket) {
                                const curMapId = canvasEngine.getCurrentMapId?.() || canvasEngine.currentMap?.id || null;
                                window.VTT.socket.emit('token:update', { mapId: curMapId, token });
                            }
                        }
                    });
                }
                
                // Log spawn message
                // window.VTT.socket.emit('chat:msg', {
                //     text: `GM spawned token: **${data.name}** (HP: ${data.hp}/${data.maxHp}, Size: ${data.size}x${data.size})`
                // });
            } else if (data.type === 'player') {
                const canvasEngine = window.VTT.canvasEngine;
                const grid = canvasEngine.getGrid();
                
                const mouse = canvasEngine.getCanvasMouseCoords(e);
                const sizePx = data.size * grid.size * grid.scale;
                
                let charRef = null;
                const charLookupId = data.characterId || data.sourceCharacterId;
                if (charLookupId && window.VTT?.campaignState?.characters) {
                    charRef = window.VTT.campaignState.characters[charLookupId];
                }

                let tokenImg = data.img;
                if (!tokenImg && charRef) {
                    if (charRef.tokenImages && charRef.tokenImages.length > 0 && charRef.activeTokenIndex !== -1) {
                        const idx = charRef.activeTokenIndex || 0;
                        if (idx >= 0 && idx < charRef.tokenImages.length && charRef.tokenImages[idx]?.url) {
                            tokenImg = charRef.tokenImages[idx].url;
                        } else {
                            tokenImg = charRef.tokenImages[0]?.url || 'favicon.svg';
                        }
                    } else if (charRef.monsterData) {
                        tokenImg = getMonsterImageUrl(charRef.monsterData);
                        if (tokenImg && tokenImg !== 'favicon.svg') {
                            charRef.tokenImages = [{ url: tokenImg, name: 'Default Token', isDefault: true }];
                            charRef.activeTokenIndex = 0;
                            if (vtt.socket) vtt.socket.emit('character:update', { character: charRef });
                        }
                    } else {
                        tokenImg = 'favicon.svg';
                    }
                }

                const isCompanion = !!(charRef?.isCompanion || data.isCompanion);
                const isCustomNpc = !!(charRef?.isCustomNpc || data.isCustomNpc);
                const isGeneric = !!(data.isGeneric || (charRef && charRef.isGeneric === true));
                const isPlayer = !isCompanion && !isCustomNpc && (data.isPlayer !== false);

                const finalSize = charRef && charRef.tokenSize !== undefined ? charRef.tokenSize : data.size;

                // Determine sight range:
                // 1. charRef.tokenSight if explicitly saved
                // 2. data.sightRange if provided
                // 3. parseMonsterVision if monsterData exists
                // 4. Default to 0 (no special vision in pitch darkness)
                let resolvedSight = 0;
                if (charRef && charRef.tokenSight !== undefined) {
                    resolvedSight = parseInt(charRef.tokenSight);
                } else if (data.sightRange !== undefined) {
                    resolvedSight = parseInt(data.sightRange);
                } else if (charRef?.monsterData) {
                    resolvedSight = parseMonsterVision(charRef.monsterData);
                } else if (charRef?.senses && typeof charRef.senses === 'object') {
                    resolvedSight = Math.max(
                        parseInt(charRef.senses.darkvision) || 0,
                        parseInt(charRef.senses.devilSight) || 0,
                        parseInt(charRef.senses.blindsight) || 0,
                        parseInt(charRef.senses.truesight) || 0
                    );
                }

                const token = {
                    id: `token_${isPlayer ? 'pc' : (isCompanion ? 'comp' : 'npc')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: data.name,
                    x: mouse.x - sizePx / 2,
                    y: mouse.y - sizePx / 2,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    tempHp: data.tempHp || 0,
                    size: finalSize,
                    customWidth: charRef?.tokenCustomWidth || data.customWidth,
                    customHeight: charRef?.tokenCustomHeight || data.customHeight,
                    sightRange: resolvedSight,
                    img: tokenImg,
                    isPlayer: isPlayer,
                    isCompanion: isCompanion,
                    isCustomNpc: isCustomNpc,
                    isGeneric: isGeneric,
                    characterId: isGeneric ? null : data.characterId,
                    sourceCharacterId: isGeneric ? (data.sourceCharacterId || data.characterId) : null,
                    monsterData: isGeneric 
                        ? Object.assign(charRef?.monsterData ? JSON.parse(JSON.stringify(charRef.monsterData)) : (data.monsterData ? JSON.parse(JSON.stringify(data.monsterData)) : {}), { isCustomNpc: true, isGeneric: true })
                        : (charRef?.monsterData || data.monsterData || null),
                    layer: canvasEngine.getActiveLayer(),
                    isBorderless: true,
                    
                    // Auras, Light and FX - fallback to charRef properties
                    auras: data.auras || (charRef && charRef.tokenAuras) || [],
                    lightEnabled: data.lightEnabled !== undefined ? data.lightEnabled : (charRef ? charRef.tokenLightEnabled : false),
                    lightBright: data.lightBright !== undefined ? data.lightBright : (charRef ? charRef.tokenLightBright : 0),
                    lightDim: data.lightDim !== undefined ? data.lightDim : (charRef ? charRef.tokenLightDim : 0),
                    lightColor: data.lightColor || (charRef ? charRef.tokenLightColor : '#ffaa00'),
                    lightAngle: data.lightAngle !== undefined ? data.lightAngle : (charRef && charRef.tokenLightAngle !== undefined ? charRef.tokenLightAngle : 360),
                    lightRotation: data.lightRotation !== undefined ? data.lightRotation : (charRef && charRef.tokenLightRotation !== undefined ? charRef.tokenLightRotation : 0),
                    lightAnimationType: data.lightAnimationType || (charRef ? charRef.tokenLightAnimationType : 'none'),
                    lightAnimationSpeed: data.lightAnimationSpeed !== undefined ? data.lightAnimationSpeed : (charRef && charRef.tokenLightAnimationSpeed !== undefined ? charRef.tokenLightAnimationSpeed : 1.0),
                    lightAnimationIntensity: data.lightAnimationIntensity !== undefined ? data.lightAnimationIntensity : (charRef && charRef.tokenLightAnimationIntensity !== undefined ? charRef.tokenLightAnimationIntensity : 0.10),
                    lightAnimationColor2: data.lightAnimationColor2 || (charRef ? charRef.tokenLightAnimationColor2 : '#ffe082'),
                    fxOverlayEnabled: data.fxOverlayEnabled !== undefined ? data.fxOverlayEnabled : (charRef ? charRef.fxOverlayEnabled : false),
                    fxOverlayOpacity: data.fxOverlayOpacity !== undefined ? data.fxOverlayOpacity : (charRef ? charRef.fxOverlayOpacity : 0.3),
                    fxOverlayColor: data.fxOverlayColor || (charRef ? charRef.fxOverlayColor : '#007bff'),
                    fxVignetteEnabled: data.fxVignetteEnabled !== undefined ? data.fxVignetteEnabled : (charRef ? charRef.fxVignetteEnabled : false),
                    fxVignetteOpacity: data.fxVignetteOpacity !== undefined ? data.fxVignetteOpacity : (charRef ? charRef.fxVignetteOpacity : 0.6),
                    fxVignetteColor: data.fxVignetteColor || (charRef ? charRef.fxVignetteColor : '#000000'),
                    fxShadowEnabled: data.fxShadowEnabled !== undefined ? data.fxShadowEnabled : (charRef ? charRef.fxShadowEnabled : false),
                    fxShadowBlur: data.fxShadowBlur !== undefined ? data.fxShadowBlur : (charRef ? charRef.fxShadowBlur : 12),
                    fxShadowOffset: data.fxShadowOffset !== undefined ? data.fxShadowOffset : (charRef ? charRef.fxShadowOffset : 4),
                    fxShadowColor: data.fxShadowColor || (charRef ? charRef.fxShadowColor : '#000000'),
                    fxShadowOpacity: data.fxShadowOpacity !== undefined ? data.fxShadowOpacity : (charRef ? charRef.fxShadowOpacity : 0.7),
                    isGif: tokenImg && typeof tokenImg === 'string' && tokenImg.split('?')[0].toLowerCase().endsWith('.gif'),
                    isVideo: tokenImg && typeof tokenImg === 'string' && ((() => { const _c = tokenImg.split('?')[0].toLowerCase(); return _c.endsWith('.mp4') || _c.endsWith('.webm') || _c.endsWith('.ogg'); })() || tokenImg.includes('youtube.com'))
                };

                // Backward compatibility for aura
                if (token.auras && token.auras.length > 0) {
                    token.auraEnabled = true;
                    token.auraRange = token.auras[0].range;
                    token.auraShape = token.auras[0].shape;
                    token.auraStyle = token.auras[0].style;
                    token.auraOpacity = token.auras[0].opacity;
                    token.auraColor = token.auras[0].color;
                } else {
                    token.auraEnabled = false;
                }

                // Apply grid snapping alignment
                const snap = snapToCoords(token.x, token.y, grid);
                token.x = snap.x;
                token.y = snap.y;

                canvasEngine.addToken(token);
                
                // Log spawn message
                // window.VTT.socket.emit('chat:msg', {
                //     text: `Player **${data.name}** joined the map.`
                // });
            } else if (data.type === 'vtt-asset') {
                const canvasEngine = window.VTT.canvasEngine;
                const grid = canvasEngine.getGrid();
                const mouse = canvasEngine.getCanvasMouseCoords(e);
                
                const spawnAsset = (pixelWidth, pixelHeight) => {
                    let finalUrl = data.url;
                    
                    // Convert raw YouTube URLs to embed URLs if needed
                    if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
                        if (!finalUrl.includes('/embed/')) {
                            const ytMatch = finalUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                            if (ytMatch && ytMatch[1]) {
                                const videoId = ytMatch[1];
                                const listMatch = finalUrl.match(/[?&]list=([^#\&\?]+)/);
                                finalUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1`;
                                if (listMatch && listMatch[1]) {
                                    finalUrl += `&list=${listMatch[1]}`;
                                } else {
                                    finalUrl += `&playlist=${videoId}`;
                                }
                            }
                        }
                    }

                    const token = {
                        id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        name: data.name,
                        x: mouse.x - pixelWidth / 2,
                        y: mouse.y - pixelHeight / 2,
                        hp: 0,
                        maxHp: 0,
                        size: 1,
                        img: finalUrl,
                        isGif: typeof finalUrl === 'string' && finalUrl.split('?')[0].toLowerCase().endsWith('.gif'),
                        isVideo: data.assetType === 'video' || (typeof finalUrl === 'string' && (finalUrl.includes('youtube.com') || (() => { const _c = finalUrl.split('?')[0].toLowerCase(); return _c.endsWith('.mp4') || _c.endsWith('.webm') || _c.endsWith('.ogg'); })())),
                        isAsset: true,
                        pixelWidth: pixelWidth,
                        pixelHeight: pixelHeight,
                        isPlayer: false,
                        layer: canvasEngine.getActiveLayer(),
                        monsterData: null
                    };

                    const snap = snapToCoords(token.x, token.y, grid);
                    token.x = snap.x;
                    token.y = snap.y;

                    canvasEngine.addToken(token);
                    
                    // window.VTT.socket.emit('chat:msg', {
                    //     text: `GM placed an asset: **${data.name}**`
                    // });
                };

                const maxDim = grid.size * grid.scale;
                if (data.assetType === 'video' || data.url.includes('youtube.com')) {
                    // Assume 16:9
                    spawnAsset(maxDim, maxDim * (9/16));
                } else {
                    const img = new Image();
                    img.onload = () => {
                        const nw = img.naturalWidth || maxDim;
                        const nh = img.naturalHeight || maxDim;
                        const scale = maxDim / Math.max(nw, nh);
                        spawnAsset(nw * scale, nh * scale);
                    };
                    img.onerror = () => spawnAsset(maxDim, maxDim);
                    img.src = data.url;
                }
            }
        } catch(err) {
            console.error("Drop failed:", err);
        }
    });

    function getNearestHexFeatures(x, y, grid, unitSize) {
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;
        const isVert = grid.type === 'hex-v';
        const R = unitSize / Math.sqrt(3);
        let bestDistCenter = Infinity;
        let bestCx = x, bestCy = y;
        
        const checkHex = (cx, cy) => {
            const cDist = (cx - x) ** 2 + (cy - y) ** 2;
            if (cDist < bestDistCenter) {
                bestDistCenter = cDist;
                bestCx = cx;
                bestCy = cy;
            }
        };

        if (isVert) {
            const W = Math.sqrt(3) * R;
            const ySpacing = 1.5 * R;
            const estC = Math.round((x - offsetX) / W);
            const estR = Math.round((y - offsetY) / ySpacing);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = estR + dr;
                    const c = estC + dc;
                    const cx = offsetX + c * W + (Math.abs(r) % 2 === 1 ? W / 2 : 0);
                    const cy = offsetY + r * ySpacing;
                    checkHex(cx, cy);
                }
            }
        } else {
            const H = Math.sqrt(3) * R;
            const xSpacing = 1.5 * R;
            const estC = Math.round((x - offsetX) / xSpacing);
            const estR = Math.round((y - offsetY) / H);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = estR + dr;
                    const c = estC + dc;
                    const cx = offsetX + c * xSpacing;
                    const cy = offsetY + r * H + (Math.abs(c) % 2 === 1 ? H / 2 : 0);
                    checkHex(cx, cy);
                }
            }
        }
        return { cx: bestCx, cy: bestCy };
    }

    function snapToCoords(x, y, grid) {
        if (!grid || !grid.size) return { x, y };
        const size = grid.size * grid.scale;
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;

        if (grid.type === 'hex-v' || grid.type === 'hex-h') {
            const px = x + size / 2;
            const py = y + size / 2;
            const hex = getNearestHexFeatures(px, py, grid, size);
            return { x: hex.cx - size / 2, y: hex.cy - size / 2 };
        }

        const snapX = Math.round((x - offsetX) / size) * size + offsetX;
        const snapY = Math.round((y - offsetY) / size) * size + offsetY;
        return { x: snapX, y: snapY };
    }

    function spawnMonsterAtCenter(monsterOrName, optHp, optSize, optImg, optMonsterData) {
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        let monster = null;
        if (typeof monsterOrName === 'object' && monsterOrName !== null) {
            monster = monsterOrName;
        } else {
            monster = {
                name: monsterOrName,
                hp: optHp,
                size: optSize,
                tokenImg: optImg,
                monsterData: optMonsterData
            };
        }

        const hp = monster.hp || calculateMonsterHp(monster);
        const size = translateSizeCategory(monster.sizeCategory || monster.size);
        let imageUrl = monster.tokenImg;
        if (!imageUrl && monster.tokenImages && monster.tokenImages.length > 0) {
            const idx = monster.activeTokenIndex >= 0 ? monster.activeTokenIndex : 0;
            imageUrl = monster.tokenImages[idx]?.url;
        }
        if (!imageUrl) {
            imageUrl = getMonsterImageUrl(monster);
        }

        const viewportEl = document.getElementById('vtt-canvas-viewport');
        const vr = viewportEl ? viewportEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const mouse = canvasEngine.getCanvasMouseCoords({ clientX: vr.left + vr.width / 2, clientY: vr.top + vr.height / 2 });
        const grid = canvasEngine.getGrid();
        const sizePx = size * grid.size * grid.scale;

        let targetLayer = canvasEngine.getActiveLayer();
        if (targetLayer !== 'gm') targetLayer = 'token';

        const token = {
            id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: monster.name,
            x: mouse.x - sizePx / 2,
            y: mouse.y - sizePx / 2,
            hp: hp,
            maxHp: hp,
            size: size,
            sightRange: parseMonsterVision(monster.monsterData || monster),
            img: imageUrl,
            isPlayer: false,
            layer: targetLayer,
            isBorderless: true,
            monsterData: monster.monsterData || monster
        };

        const snap = snapToCoords(token.x, token.y, grid);
        token.x = snap.x;
        token.y = snap.y;

        canvasEngine.addToken(token);

        // Asynchronously hydrate token.monsterData with full normalized creature if needed
        const source = monster.source || monster.monsterData?.source;
        const idOrName = monster.id || monster.monsterData?.id || monster.name;
        if (source && idOrName) {
            fetchFullCreature(source, idOrName).then(fullMonster => {
                if (fullMonster) {
                    token.monsterData = fullMonster;
                    if (window.VTT?.socket) {
                        const curMapId = canvasEngine.getCurrentMapId?.() || canvasEngine.currentMap?.id || null;
                        window.VTT.socket.emit('token:update', { mapId: curMapId, token });
                    }
                }
            });
        }

        if (window.VTT?.mobileAdapter?.closeAllDrawers) {
            window.VTT.mobileAdapter.closeAllDrawers();
            window.VTT.mobileAdapter.setActiveNavTab('map');
        }

        if (navigator.vibrate) navigator.vibrate(40);
        if (window.VTT?.toast) {
            window.VTT.toast(`Spawned ${monster.name} on map`);
        }
    }

    function spawnCustomNpcAtCenter(npc) {
        if (!npc) return;
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        const grid = canvasEngine.getGrid();
        const isGeneric = npc.isGeneric === true;
        const size = npc.tokenSize !== undefined ? npc.tokenSize : (npc.monsterData ? translateSizeCategory(npc.monsterData.size) : 1);
        const hp = isGeneric ? (npc.hpMax || calculateMonsterHp(npc.monsterData)) : npc.hpCurrent;
        const maxHp = npc.hpMax || calculateMonsterHp(npc.monsterData);

        let tokenImg = null;
        if (npc.tokenImages && npc.tokenImages.length > 0 && npc.activeTokenIndex !== -1) {
            const idx = npc.activeTokenIndex || 0;
            if (idx >= 0 && idx < npc.tokenImages.length && npc.tokenImages[idx]?.url) {
                tokenImg = npc.tokenImages[idx].url;
            }
        }
        if (!tokenImg && npc.monsterData) {
            tokenImg = getMonsterImageUrl(npc.monsterData);
        }

        const viewportEl = document.getElementById('vtt-canvas-viewport');
        const vr = viewportEl ? viewportEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const mouse = canvasEngine.getCanvasMouseCoords({ clientX: vr.left + vr.width / 2, clientY: vr.top + vr.height / 2 });
        const sizePx = size * grid.size * grid.scale;

        let targetLayer = canvasEngine.getActiveLayer();
        if (targetLayer !== 'gm') targetLayer = 'token';

        const token = {
            id: isGeneric ? `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : `token_${npc.id}`,
            name: npc.name,
            x: mouse.x - sizePx / 2,
            y: mouse.y - sizePx / 2,
            hp: hp,
            maxHp: maxHp,
            tempHp: isGeneric ? 0 : (npc.tempHp || 0),
            size: size,
            characterId: isGeneric ? null : npc.id,
            sourceCharacterId: npc.id,
            isGeneric: isGeneric,
            isCustomNpc: true,
            isPlayer: false,
            sightRange: npc.tokenSight !== undefined ? npc.tokenSight : parseMonsterVision(npc.monsterData),
            img: tokenImg,
            layer: targetLayer,
            isBorderless: true,
            monsterData: npc.monsterData ? JSON.parse(JSON.stringify(npc.monsterData)) : null
        };

        const snap = snapToCoords(token.x, token.y, grid);
        token.x = snap.x;
        token.y = snap.y;

        canvasEngine.addToken(token);

        if (window.VTT?.mobileAdapter?.closeAllDrawers) {
            window.VTT.mobileAdapter.closeAllDrawers();
            window.VTT.mobileAdapter.setActiveNavTab('map');
        }
        if (navigator.vibrate) navigator.vibrate(40);
        if (window.VTT?.toast) {
            window.VTT.toast(`Spawned ${npc.name} on map`);
        }
    }

    function spawnCharacterAtCenter(characterIdOrChar) {
        if (!characterIdOrChar) return;
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        let char = null;
        if (typeof characterIdOrChar === 'object' && characterIdOrChar !== null) {
            char = characterIdOrChar;
        } else if (typeof characterIdOrChar === 'string') {
            char = window.VTT?.campaignState?.characters?.[characterIdOrChar] || null;
        }
        if (!char) return;

        let size = char.tokenSize !== undefined ? char.tokenSize : 1;
        if (char.isCompanion && char.monsterData) {
            const sz = char.monsterData.size ? (Array.isArray(char.monsterData.size) ? char.monsterData.size[0] : char.monsterData.size) : 'M';
            size = translateSizeCategory(sz);
        }

        let tokenImg = null;
        if (char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex !== -1) {
            const idx = char.activeTokenIndex || 0;
            if (idx >= 0 && idx < char.tokenImages.length && char.tokenImages[idx]?.url) {
                tokenImg = char.tokenImages[idx].url;
            }
        }
        if (!tokenImg && char.monsterData) {
            tokenImg = getMonsterImageUrl(char.monsterData);
        }
        if (!tokenImg && char.avatar) {
            tokenImg = char.avatar;
        }
        if (!tokenImg) {
            tokenImg = window.VTT?.generateArcaneToken ? window.VTT.generateArcaneToken(char.name, 'player') : 'favicon.svg';
        }

        const viewportEl = document.getElementById('vtt-canvas-viewport');
        const vr = viewportEl ? viewportEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const mouse = canvasEngine.getCanvasMouseCoords({ clientX: vr.left + vr.width / 2, clientY: vr.top + vr.height / 2 });
        const grid = canvasEngine.getGrid();
        const sizePx = size * grid.size * grid.scale;

        let targetLayer = canvasEngine.getActiveLayer();
        if (targetLayer !== 'gm') targetLayer = 'token';

        const isCompanion = !!char.isCompanion;
        const token = {
            id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: char.name,
            x: mouse.x - sizePx / 2,
            y: mouse.y - sizePx / 2,
            hp: char.hpCurrent || 0,
            maxHp: char.hpMax || 0,
            tempHp: char.tempHp || 0,
            size: size,
            customWidth: char.tokenCustomWidth,
            customHeight: char.tokenCustomHeight,
            characterId: char.id,
            sourceCharacterId: char.id,
            isCompanion: isCompanion,
            isPlayer: !isCompanion && !char.isCustomNpc,
            sightRange: char.tokenSight !== undefined ? char.tokenSight : (char.monsterData ? parseMonsterVision(char.monsterData) : 0),
            img: tokenImg,
            layer: targetLayer,
            isBorderless: true,
            monsterData: char.monsterData ? JSON.parse(JSON.stringify(char.monsterData)) : null
        };

        const snap = snapToCoords(token.x, token.y, grid);
        token.x = snap.x;
        token.y = snap.y;

        canvasEngine.addToken(token);

        if (window.VTT?.mobileAdapter?.closeAllDrawers) {
            window.VTT.mobileAdapter.closeAllDrawers();
            window.VTT.mobileAdapter.setActiveNavTab('map');
        }
        if (navigator.vibrate) navigator.vibrate(40);
        if (window.VTT?.toast) {
            window.VTT.toast(`Spawned ${char.name} on map`);
        }
    }

    function spawnAssetAtCenter(data) {
        if (!data || !data.url) return;
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        const viewportEl = document.getElementById('vtt-canvas-viewport');
        const vr = viewportEl ? viewportEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const mouse = canvasEngine.getCanvasMouseCoords({ clientX: vr.left + vr.width / 2, clientY: vr.top + vr.height / 2 });
        const grid = canvasEngine.getGrid();

        const spawnAsset = (pixelWidth, pixelHeight) => {
            let finalUrl = data.url;
            if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
                if (!finalUrl.includes('/embed/')) {
                    const ytMatch = finalUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                    if (ytMatch && ytMatch[1]) {
                        const videoId = ytMatch[1];
                        const listMatch = finalUrl.match(/[?&]list=([^#\&\?]+)/);
                        finalUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1`;
                        if (listMatch && listMatch[1]) {
                            finalUrl += `&list=${listMatch[1]}`;
                        } else {
                            finalUrl += `&playlist=${videoId}`;
                        }
                    }
                }
            }

                let targetLayer = canvasEngine.getActiveLayer();
                if (targetLayer !== 'map' && targetLayer !== 'gm') targetLayer = 'token';

                const token = {
                    id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: data.name || 'Asset',
                    x: mouse.x - pixelWidth / 2,
                    y: mouse.y - pixelHeight / 2,
                    hp: 0,
                    maxHp: 0,
                    size: 1,
                    img: finalUrl,
                    isGif: typeof finalUrl === 'string' && finalUrl.split('?')[0].toLowerCase().endsWith('.gif'),
                    isVideo: data.assetType === 'video' || (typeof finalUrl === 'string' && (finalUrl.includes('youtube.com') || (() => { const _c = finalUrl.split('?')[0].toLowerCase(); return _c.endsWith('.mp4') || _c.endsWith('.webm') || _c.endsWith('.ogg'); })())),
                    isAsset: true,
                    pixelWidth: pixelWidth,
                    pixelHeight: pixelHeight,
                    isPlayer: false,
                    layer: targetLayer,
                    isBorderless: true
                };

            const snap = snapToCoords(token.x, token.y, grid);
            token.x = snap.x;
            token.y = snap.y;

            canvasEngine.addToken(token);

            if (window.VTT?.mobileAdapter?.closeAllDrawers) {
                window.VTT.mobileAdapter.closeAllDrawers();
                window.VTT.mobileAdapter.setActiveNavTab('map');
            }
            if (navigator.vibrate) navigator.vibrate(40);
            if (window.VTT?.toast) {
                window.VTT.toast(`Placed ${data.name || 'asset'} on map`);
            }
        };

        const isVideo = data.assetType === 'video' || (typeof data.url === 'string' && (data.url.includes('youtube.com') || (() => { const _c = data.url.split('?')[0].toLowerCase(); return _c.endsWith('.mp4') || _c.endsWith('.webm') || _c.endsWith('.ogg'); })()));
        if (isVideo) {
            spawnAsset(grid.size * grid.scale * 3, grid.size * grid.scale * 3);
        } else {
            const img = new Image();
            img.onload = () => {
                const natW = img.naturalWidth || 100;
                const natH = img.naturalHeight || 100;
                const gridPixel = grid.size * grid.scale;
                let cols = Math.max(1, Math.round(natW / grid.size));
                let rows = Math.max(1, Math.round(natH / grid.size));
                spawnAsset(cols * gridPixel, rows * gridPixel);
            };
            img.onerror = () => {
                const s = grid.size * grid.scale * 2;
                spawnAsset(s, s);
            };
            img.src = data.url;
        }
    }


    // Tab switching logic for Bestiary Drawer
    document.querySelectorAll('.lib-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.lib-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--color-text-secondary)';
            });
            e.target.classList.add('active');
            e.target.style.borderBottomColor = 'var(--color-gold-base)';
            e.target.style.color = 'var(--color-text-primary)';
            
            document.querySelectorAll('.lib-tab-content').forEach(c => {
                c.classList.add('vtt-hidden');
                c.classList.remove('active');
            });
            const targetContent = document.getElementById(e.target.dataset.tab);
            if (targetContent) {
                targetContent.classList.remove('vtt-hidden');
                targetContent.classList.add('active');
            }
            
            if (e.target.dataset.tab === 'lib-custom') {
                renderCustomNpcList();
            }
        });
    });

    const btnAddCustomNpc = document.getElementById('btn-add-custom-npc');
    if (btnAddCustomNpc) {
        btnAddCustomNpc.addEventListener('click', openNpcImportModal);
    }

    function openNpcImportModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'vtt-sheet-submodal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'vtt-sheet-submodal bestiary-import-drawer-mobile';
        modal.style.cssText = 'width: min(540px, 94vw); max-height: 86vh; display:flex; flex-direction:column; background: var(--color-bg-base); padding: 0;';
        
        modal.innerHTML = `
            <div class="bestiary-drawer-header" style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25);">
                <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-file-import"></i> Import Bestiary Template</h3>
                <button id="npc-modal-close" class="btn btn-icon btn-secondary" style="min-height:36px; width:36px;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:12px 16px 8px 16px; background:rgba(0,0,0,0.15);">
                <input type="text" id="npc-search" class="vtt-input" style="width: 100%; border-radius: 20px; padding: 8px 14px;" placeholder="Search monsters by name or CR (e.g. Goblin, CR 1/4)..." autofocus>
            </div>
            <div class="bestiary-drawer-body scroll-styled" style="flex:1; overflow-y:auto; padding:8px 16px; min-height:160px; max-height:52vh;">
                <div id="npc-list" style="display:flex; flex-direction:column; gap:4px;"></div>
            </div>
        `;
        
        document.body.appendChild(modalOverlay);
        document.body.appendChild(modal);
        
        const listEl = modal.querySelector('#npc-list');
        const searchInput = modal.querySelector('#npc-search');
        
        const renderList = (query) => {
            listEl.innerHTML = '';
            const q = query.toLowerCase().trim();
            const filtered = monsters.filter(m => {
                if (!q) return true;
                const nameMatch = m.name.toLowerCase().includes(q);
                const crStr = m.cr ? (typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr)).toLowerCase() : '0';
                const crMatch = crStr === q || crStr.includes(q) || `cr ${crStr}`.includes(q) || `cr${crStr}`.includes(q);
                return nameMatch || crMatch;
            }).slice(0, 50);
            
            filtered.forEach(m => {
                const row = document.createElement('div');
                row.className = 'npc-template-row glassmorphism';
                row.style.cssText = 'padding:10px 14px; border:1px solid var(--color-border-subtle); cursor:pointer; display:flex; justify-content:space-between; align-items: center; border-radius: 6px; margin-bottom: 4px; transition: background 0.2s; min-height: 44px;';
                row.innerHTML = `<span><strong style="color:var(--color-text-primary); font-size:0.95rem;">${m.name}</strong> <span style="font-size:0.75em; color:var(--color-text-muted);">[${m.source || 'Unknown'}]</span></span> <span style="color:var(--color-gold-light); font-size: 0.85em; font-weight:600; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); border-radius:12px; padding:2px 8px;">CR ${m.cr ? (m.cr.cr || m.cr) : '0'}</span>`;
                row.addEventListener('click', () => {
                    promptCustomNpcName(m);
                    closeModal();
                });
                row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.05)';
                row.onmouseout = () => row.style.background = 'transparent';
                listEl.appendChild(row);
            });
            if (filtered.length === 0) {
                listEl.innerHTML = '<div style="padding: 16px; color: var(--color-text-muted); text-align: center;">No monsters found.</div>';
            }
        };
        
        let escListener = null;
        const closeModal = () => {
            if (escListener) window.removeEventListener('keydown', escListener);
            modalOverlay.remove();
            modal.remove();
        };

        escListener = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        window.addEventListener('keydown', escListener);
        
        modal.querySelector('#npc-modal-close').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', closeModal);
        searchInput.addEventListener('input', (e) => renderList(e.target.value));
        renderList('');
        searchInput.focus();
    }

    function promptCustomNpcName(monster) {
        const overlay = document.createElement('div');
        overlay.className = 'vtt-sheet-submodal-overlay vtt-sheet-submodal-high';
        const modal = document.createElement('div');
        modal.className = 'vtt-sheet-submodal vtt-sheet-submodal-high glassmorphism';
        modal.style.cssText = 'width: min(420px, 92vw); padding: 18px;';
        
        modal.innerHTML = `
            <h4 style="margin-top:0; color:var(--color-gold-base);">Import ${monster.name}</h4>
            <div class="form-group">
                <label>Custom Name (Optional)</label>
                <input type="text" id="npc-nickname" placeholder="${monster.name}" style="width:100%;">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                <button id="npc-import-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                <button id="npc-import-save" class="btn btn-primary btn-sm">Import</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        let escListener = null;
        const closeModals = () => {
            if (escListener) window.removeEventListener('keydown', escListener);
            overlay.remove();
            modal.remove();
        };

        escListener = (e) => {
            if (e.key === 'Escape') closeModals();
        };
        window.addEventListener('keydown', escListener);
        
        overlay.addEventListener('click', closeModals);
        modal.querySelector('#npc-import-cancel').addEventListener('click', closeModals);
        modal.querySelector('#npc-import-save').addEventListener('click', async () => {
            const nickname = modal.querySelector('#npc-nickname').value.trim() || monster.name;
            
            let hp = monster.hp || calculateMonsterHp(monster);
            
            // Hydrate full normalized creature before saving custom NPC
            let fullMonster = null;
            if (typeof fetchFullCreature === 'function') {
                fullMonster = await fetchFullCreature(monster.source, monster.id || monster.name);
            }
            const customMonsterData = fullMonster ? JSON.parse(JSON.stringify(fullMonster)) : JSON.parse(JSON.stringify(monster));
            
            const defaultToken = getMonsterImageUrl(customMonsterData);
            const initialTokens = (defaultToken && defaultToken !== 'favicon.svg') 
                ? [{ url: defaultToken, name: 'Default Token', isDefault: true }] 
                : [];
            
            const newId = 'npc_' + Date.now();
            const newNpc = {
                id: newId,
                name: nickname,
                isCustomNpc: true,
                isGeneric: true,
                monsterData: customMonsterData,
                hpMax: hp,
                hpCurrent: hp,
                tempHp: 0,
                ac: monster.ac ? (Array.isArray(monster.ac) ? (monster.ac[0].ac || monster.ac[0]) : (typeof monster.ac === 'object' ? monster.ac.ac : monster.ac)) : 10,
                tokenImages: initialTokens,
                activeTokenIndex: 0
            };
            
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[newId] = newNpc;
            
            if (vtt.socket) {
                vtt.socket.emit('character:update', { character: newNpc });
            }
            
            renderCustomNpcList();
            closeModals();
        });
    }

    function renderCustomNpcList() {
        const customListContainer = document.getElementById('library-custom-list');
        if (!customListContainer) return;
        
        const chars = (vtt.campaignState && vtt.campaignState.characters) ? Object.values(vtt.campaignState.characters) : [];
        const customNpcs = chars.filter(c => c.isCustomNpc);
        
        if (customNpcs.length === 0) {
            customListContainer.innerHTML = '<div class="init-empty-state" style="padding: 16px; text-align: center; color: var(--color-text-muted);">No custom NPCs yet. Click "Import & Customize NPC" to add one.</div>';
            return;
        }
        
        let html = '';
        customNpcs.forEach(npc => {
            let tokenImg = getMonsterImageUrl(npc.monsterData || {});
            if (!npc.tokenImages || npc.tokenImages.length === 0) {
                if (tokenImg && tokenImg !== 'favicon.svg') {
                    npc.tokenImages = [{ url: tokenImg, name: 'Default Token', isDefault: true }];
                    npc.activeTokenIndex = 0;
                    if (vtt.socket) vtt.socket.emit('character:update', { character: npc });
                }
            } else if (npc.activeTokenIndex !== -1) {
                const idx = npc.activeTokenIndex || 0;
                if (idx >= 0 && idx < npc.tokenImages.length && npc.tokenImages[idx]?.url) {
                    tokenImg = npc.tokenImages[idx].url;
                }
            }
            
            const cleanUrl = tokenImg.split('?')[0].toLowerCase();
            const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
            const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
            
            let mediaHtml = '';
            if (isVideo) {
                mediaHtml = `<video src="${tokenImg}" autoplay loop muted playsinline style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-gold-base); object-fit: cover;"></video>`;
            } else if (isYoutube) {
                let ytUrl = tokenImg;
                const ytMatch = tokenImg.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                if (ytMatch) {
                    const videoId = ytMatch[1];
                    ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
                }
                mediaHtml = `<iframe src="${ytUrl}" frameborder="0" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-gold-base); pointer-events:none;"></iframe>`;
            } else {
                mediaHtml = `<img src="${tokenImg}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-gold-base); object-fit: cover;" onerror="this.src='favicon.svg'">`;
            }
            
            html += `
                <div class="library-item custom-npc-row" data-id="${npc.id}" draggable="true" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 8px;">
                    <div style="display: flex; align-items: center; gap: 12px; pointer-events: none;">
                        ${mediaHtml}
                        <div>
                            <div class="lib-item-name" style="line-height: 1.2; font-weight: 600;">${npc.name}</div>
                            <div class="lib-item-cr" style="line-height: 1;">Custom NPC</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:4px; align-items:center;" class="custom-npc-actions">
                        <button class="btn-mobile-spawn-token btn-spawn-custom-npc" data-id="${npc.id}" title="Spawn on Map"><i class="fa-solid fa-plus pointer-events-none"></i></button>
                        <button class="btn btn-icon btn-secondary btn-edit-custom-npc" data-id="${npc.id}" title="Edit NPC" style="width: 24px; height: 24px; font-size: 0.8rem; padding: 0;"><i class="fa-solid fa-pen pointer-events-none"></i></button>
                        <button class="btn btn-icon btn-danger btn-del-custom-npc" data-id="${npc.id}" title="Delete NPC" style="width: 24px; height: 24px; font-size: 0.8rem; padding: 0;"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                    </div>
                </div>
            `;
        });
        
        customListContainer.innerHTML = html;
        
        customListContainer.querySelectorAll('.custom-npc-row').forEach(row => {
            const id = row.dataset.id;
            const npc = customNpcs.find(c => c.id === id);
            
            row.addEventListener('dragstart', (e) => {
                if(e.target.closest('button')) {
                    e.preventDefault();
                    return;
                }
                
                const size = npc.monsterData ? translateSizeCategory(npc.monsterData.size) : 1;
                const isGeneric = npc.isGeneric === true;
                
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'player', // Retain character linkage
                    characterId: isGeneric ? null : id,
                    sourceCharacterId: id,
                    isGeneric: isGeneric,
                    isCustomNpc: true,
                    isPlayer: false,
                    name: npc.name,
                    hp: isGeneric ? (npc.hpMax || calculateMonsterHp(npc.monsterData)) : npc.hpCurrent,
                    maxHp: npc.hpMax || calculateMonsterHp(npc.monsterData),
                    tempHp: isGeneric ? 0 : (npc.tempHp || 0),
                    size: npc.tokenSize !== undefined ? npc.tokenSize : size,
                    customWidth: npc.tokenCustomWidth,
                    customHeight: npc.tokenCustomHeight,
                    img: null,
                    sightRange: npc.tokenSight !== undefined ? npc.tokenSight : parseMonsterVision(npc.monsterData),
                    monsterData: npc.monsterData ? JSON.parse(JSON.stringify(npc.monsterData)) : null
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });
            
            row.addEventListener('click', (e) => {
                if(e.target.closest('button')) return;
                if (window.VTT?.creatureSheet) {
                    window.VTT.creatureSheet.openSheet(npc.monsterData, null, id);
                }
            });
        });

        customListContainer.querySelectorAll('.btn-spawn-custom-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const npc = customNpcs.find(c => c.id === id);
                if (npc) {
                    spawnCustomNpcAtCenter(npc);
                }
            });
        });
        
        customListContainer.querySelectorAll('.btn-edit-custom-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const npc = customNpcs.find(c => c.id === id);
                if (window.VTT?.creatureSheet) {
                    window.VTT.creatureSheet.openEditModal(npc.monsterData, id);
                }
            });
        });
        
        customListContainer.querySelectorAll('.btn-del-custom-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this custom NPC forever?')) {
                    const id = btn.dataset.id;
                    delete vtt.campaignState.characters[id];
                    if (vtt.socket) {
                        vtt.socket.emit('character:delete', { id });
                    }
                    renderCustomNpcList();
                }
            });
        });
    }

    async function resolveMediaUrl(url) {
        if (!url || typeof url !== 'string') return { resolvedUrl: url, isVideo: false };
        const cleanUrl = url.trim();
        if (!cleanUrl) return { resolvedUrl: cleanUrl, isVideo: false };

        if (cleanUrl.includes('pin.it') || cleanUrl.includes('pinterest.com/pin/') || (!cleanUrl.match(/\.(mp4|webm|ogg|png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i) && !cleanUrl.includes('youtube.com') && !cleanUrl.includes('youtu.be') && cleanUrl.startsWith('http'))) {
            try {
                const res = await fetch(`/api/resolve-media-url?url=${encodeURIComponent(cleanUrl)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.resolvedUrl) {
                        return data;
                    }
                }
            } catch (e) {
                console.warn('[VTT] Failed to resolve media URL via server API:', e);
            }
        }

        const isVideo = !!cleanUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || cleanUrl.includes('pinimg.com/videos') || cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
        return { resolvedUrl: cleanUrl, isVideo };
    }

    // Attach to window so other modules can trigger a refresh if needed
    window.VTT = window.VTT || {};
    window.VTT.renderCustomNpcList = renderCustomNpcList;
    window.VTT.resolveMediaUrl = resolveMediaUrl;

    if (vtt.socket) {
        vtt.socket.on('character:sync', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });
        vtt.socket.on('character:updated', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });
        vtt.socket.on('character:deleted', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });
        vtt.socket.on('campaign:sync', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });

        vtt.socket.on('handouts:updated', ({ handouts }) => {
            if (vtt.campaignState) {
                vtt.campaignState.handouts = handouts;
            }
            if (vtt.handoutsEngine) {
                vtt.handoutsEngine.renderList();
            }
        });

        vtt.socket.on('handouts:force_show', ({ id }) => {
            if (vtt.handoutsEngine) {
                vtt.handoutsEngine.handleForceShow(id);
            }
        });

        vtt.socket.on('splash:show', (data) => {
            if (window.VTT?.showSplashModal) {
                window.VTT.showSplashModal(data?.items || []);
            }
        });

        vtt.socket.on('sources:updated', () => {
            console.log('[VTT] Received database sources update, reloading compendium...');
            creatureCache.clear();
            loadBestiaryData();
            if (window.VTTSpellManager?.invalidateSpellCache) {
                window.VTTSpellManager.invalidateSpellCache();
                window.VTTSpellManager.loadSpells?.();
            }
            if (window.VTT?.toast) {
                window.VTT.toast('📚 Database sources updated');
            } else if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                JqueryUtil.doToast({ content: '📚 Database sources updated', type: 'info' });
            }
        });
    }

    async function load5eToolsMapCatalog(advSelect, mapSelect) {
        if (mapCatalog) {
            populateAdventureDropdown(advSelect, mapSelect);
            return;
        }
        
        try {
            advSelect.innerHTML = '<option value="">Loading 5eTools map catalog...</option>';
            const res = await fetch('data/generated/gendata-maps.json');
            if (!res.ok) throw new Error('Could not load gendata-maps.json');
            mapCatalog = await res.json();
            populateAdventureDropdown(advSelect, mapSelect);
        } catch (e) {
            console.error("Error fetching 5etools map catalog:", e);
            advSelect.innerHTML = '<option value="">Error loading maps.</option>';
        }
    }

    function populateAdventureDropdown(advSelect, mapSelect) {
        advSelect.innerHTML = '<option value="">-- Select an Adventure / Book --</option>';
        
        const sortedAdventures = Object.values(mapCatalog).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        sortedAdventures.forEach(adv => {
            const opt = document.createElement('option');
            opt.value = adv.id;
            opt.textContent = adv.name || adv.id;
            advSelect.appendChild(opt);
        });

        advSelect.addEventListener('change', () => {
            populateMapDropdown(advSelect.value, mapSelect);
        });
    }

    function populateMapDropdown(adventureId, mapSelect) {
        mapSelect.innerHTML = '<option value="">-- Select a Map --</option>';
        
        if (!adventureId || !mapCatalog[adventureId]) {
            mapSelect.disabled = true;
            return;
        }

        const adv = mapCatalog[adventureId];
        mapSelect.disabled = false;
        
        // Flatten chapters into maps list
        const maps = [];
        if (adv.chapters) {
            adv.chapters.forEach(ch => {
                if (ch.images) {
                    ch.images.forEach(img => {
                        // Only add maps that have an actual image path
                        if (img.href && img.href.path) {
                            maps.push({
                                id: img.href.path, // Use path as ID since player maps often lack an explicit 'id'
                                title: img.title || 'Untitled Map',
                                chapterName: ch.name,
                                imageType: img.imageType
                            });
                        }
                    });
                }
            });
        }

        maps.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `[${m.chapterName}] ${m.title} (${m.imageType === 'mapPlayer' ? 'Player' : 'GM'})`;
            mapSelect.appendChild(opt);
        });
    }

    const adventureCache = {};
    async function loadAdventureData(source) {
        if (!source) return null;
        const sourceLower = source.toLowerCase();
        if (adventureCache[sourceLower]) return adventureCache[sourceLower];
        try {
            let res = await fetch(`/data/adventure/adventure-${sourceLower}.json`);
            if (!res.ok) res = await fetch(`/data/book/book-${sourceLower}.json`);
            if (res.ok) {
                const data = await res.json();
                adventureCache[sourceLower] = data;
                return data;
            }
        } catch (e) {
            console.warn(`[loadAdventureData] Failed to load adventure data for ${sourceLower}:`, e);
        }
        return null;
    }

    function findEntryById(data, id) {
        if (!data || !id) return null;
        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const res = findEntryById(data[i], id);
                if (res) return res;
            }
        } else if (typeof data === 'object' && data !== null) {
            if (data.id === id) return data;
            if (data.entries) {
                const res = findEntryById(data.entries, id);
                if (res) return res;
            }
        }
        return null;
    }

    async function resolveNoteContent(source, areaId) {
        const advData = await loadAdventureData(source);
        if (!advData || !advData.data) return null;
        return findEntryById(advData.data, areaId);
    }

    async function import5etoolsMap(adventureId, mapPathId) {
        if (!mapCatalog || !adventureId || !mapPathId) return null;
        
        const adv = mapCatalog[adventureId];
        if (!adv || !adv.chapters) return null;

        let targetMap = null;
        let targetChapter = null;
        for (const ch of adv.chapters) {
            if (ch.images) {
                targetMap = ch.images.find(img => img.href && img.href.path === mapPathId);
                if (targetMap) {
                    targetChapter = ch;
                    break;
                }
            }
        }
        
        if (!targetMap) return null;

        // Find parent map if this is a player/variant map
        let parentMap = null;
        if (targetMap.mapParent && targetMap.mapParent.id) {
            for (const ch of adv.chapters) {
                if (ch.images) {
                    parentMap = ch.images.find(img => img.id === targetMap.mapParent.id);
                    if (parentMap) break;
                }
            }
        }

        // Generate a clear, descriptive map name
        let mapTitle = targetMap.title || "Imported Map";
        if (targetMap.imageType === 'mapPlayer' || mapTitle.toLowerCase() === 'player version') {
            if (parentMap && parentMap.title) {
                mapTitle = `${parentMap.title} (Player)`;
            } else if (targetChapter && targetChapter.name) {
                mapTitle = `${targetChapter.name} (Player)`;
            } else {
                mapTitle = `${adv.name || adventureId} Map (Player)`;
            }
        }

        // Local image path
        const baseUrl = '/img/';
        const mapUrl = baseUrl + targetMap.href.path;

        // Construct grid
        let mapGrid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5, type: 'square' };
        
        let gridSource = targetMap;
        if (!gridSource.grid && parentMap && parentMap.grid) {
            gridSource = parentMap;
        }
        
        if (gridSource.grid) {
            mapGrid.size = gridSource.grid.size || 50;
            mapGrid.offsetX = gridSource.grid.offsetX || 0;
            mapGrid.offsetY = gridSource.grid.offsetY || 0;
            mapGrid.scale = 1.0; 
            mapGrid.type = gridSource.grid.type || 'square';
        }

        // Construct Walls and Notes from mapRegions
        const walls = [];
        const notes = [];
        
        let regionsSource = targetMap;
        if (!regionsSource.mapRegions && parentMap && parentMap.mapRegions) {
            regionsSource = parentMap;
        }

        if (regionsSource.mapRegions) {
            // Load adventure data for area names (lightweight lookup)
            const sourceKey = regionsSource.source || adventureId;
            let adventureData = null;
            if (sourceKey) {
                adventureData = await loadAdventureData(sourceKey);
            }

            regionsSource.mapRegions.forEach(region => {
                if (region.points && Array.isArray(region.points)) {
                    const pts = region.points;
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i];
                        const p2 = pts[(i + 1) % pts.length]; // Connect back to start
                        walls.push({
                            x1: p1[0],
                            y1: p1[1],
                            x2: p2[0],
                            y2: p2[1],
                            type: 'wall' // Defaulting to wall, GM can change to door/window
                        });
                        minX = Math.min(minX, p1[0]);
                        minY = Math.min(minY, p1[1]);
                        maxX = Math.max(maxX, p1[0]);
                        maxY = Math.max(maxY, p1[1]);
                    }

                    // Generate a lightweight Note pin (content resolved on-demand when clicked)
                    if (region.area) {
                        let areaName = `Area ${region.area}`;
                        if (adventureData && adventureData.data) {
                            const entry = findEntryById(adventureData.data, region.area);
                            if (entry && entry.name) areaName = entry.name;
                        }
                        notes.push({
                            id: `note_${region.area}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            areaId: region.area,
                            source: sourceKey,
                            name: areaName,
                            x: (minX + maxX) / 2,
                            y: (minY + maxY) / 2
                        });
                    }
                }
            });
        }

        // Determine grid width and height based on the image size and grid size
        let gWidth = undefined;
        let gHeight = undefined;
        if (targetMap.width && mapGrid.size) {
            gWidth = Math.ceil(targetMap.width / mapGrid.size);
        }
        if (targetMap.height && mapGrid.size) {
            gHeight = Math.ceil(targetMap.height / mapGrid.size);
        }

        const mapAssetId = `asset_${Date.now()}_map`;
        const initialTokens = {};
        if (mapUrl) {
            initialTokens[mapAssetId] = {
                id: mapAssetId,
                name: `${mapTitle} (Artwork)`,
                x: 0,
                y: 0,
                layer: 'map',
                isAsset: true,
                isBackground: true,
                locked: true,
                img: mapUrl,
                pixelWidth: targetMap.width || (gWidth ? gWidth * mapGrid.size : 2000),
                pixelHeight: targetMap.height || (gHeight ? gHeight * mapGrid.size : 1500),
                size: 1,
                zIndex: 0,
                isPlayer: false
            };
        }

        return {
            name: mapTitle,
            mapImage: mapUrl, // Dual-guarantee authoritative background anchor!
            thumbnail: mapUrl,
            gridWidth: gWidth || 40,
            gridHeight: gHeight || 30,
            grid: mapGrid,
            walls: walls,
            notes: notes,
            tokens: initialTokens,
            shapes: {},
            lights: []
        };
    }

    function pushStateUpdate() {
        if (vtt.socket && vtt.campaignState) {
            vtt.socket.emit('handouts:update', { handouts: vtt.campaignState.handouts || [] });
        }
    }

    function emitForceShowHandout(id) {
        if (vtt.socket) {
            vtt.socket.emit('handouts:force_show', { id });
        }
    }

    function emitSplashShow(payload) {
        if (vtt.socket) {
            vtt.socket.emit('splash:show', payload);
        }
    }

    window.VTT = window.VTT || {};
    window.VTT.spawnMonsterAtCenter = spawnMonsterAtCenter;
    window.VTT.spawnCustomNpcAtCenter = spawnCustomNpcAtCenter;
    window.VTT.spawnCharacterAtCenter = spawnCharacterAtCenter;
    window.VTT.spawnAssetAtCenter = spawnAssetAtCenter;

    return {
        loadBestiaryData,
        renderCustomNpcList,
        pushStateUpdate,
        emitForceShowHandout,
        emitSplashShow,
        load5eToolsMapCatalog,
        import5etoolsMap,
        loadAdventureData,
        resolveNoteContent,
        resolveMediaUrl,
        spawnMonsterAtCenter,
        spawnCustomNpcAtCenter,
        spawnCharacterAtCenter,
        spawnAssetAtCenter
    };
}
