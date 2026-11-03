// DnDForged Player Sheet - Spells Tab Subsystem
// Handles spellbook layout, spell slot counters, live spell filtering, spell parsing, and drag-and-drop

import { getTotalStat, getMod, getProfBonus } from './calc/stats.js';

export const SPELL_LEVELS = [
    { key: 'all', label: 'All Spells' },
    { key: 'cantrip', label: 'Cantrip' },
    { key: 'level1', label: '1st' },
    { key: 'level2', label: '2nd' },
    { key: 'level3', label: '3rd' },
    { key: 'level4', label: '4th' },
    { key: 'level5', label: '5th' },
    { key: 'level6', label: '6th' },
    { key: 'level7', label: '7th' },
    { key: 'level8', label: '8th' },
    { key: 'level9', label: '9th' },
    { key: 'legacy', label: 'Legacy' }
];

let activeSpellTab = 'cantrip';

export function getActiveSpellTab() {
    return activeSpellTab;
}

export function setActiveSpellTab(level) {
    activeSpellTab = level;
}

export function getSpellMetaStrings(sp, slKey) {
    if (typeof window !== 'undefined' && window.VTTSpellManager && window.VTTSpellManager.getSpellMetaStrings) {
        return window.VTTSpellManager.getSpellMetaStrings(sp, slKey);
    }
    if (!sp || typeof sp !== 'object') return {};

    let school = sp.school || '';
    let levelVal = sp.level !== undefined ? sp.level : '';
    let level = '';
    if (levelVal !== undefined && levelVal !== null && levelVal !== '') {
        let levelNum = Number(levelVal);
        if (!isNaN(levelNum)) {
            level = levelNum === 0 ? 'Cantrip' : `Level ${levelNum}`;
        } else {
            level = String(levelVal);
        }
    } else if (slKey) {
        if (slKey === 'cantrip') level = 'Cantrip';
        else if (typeof slKey === 'string' && slKey.startsWith('level')) {
            const num = slKey.replace('level', '');
            level = `Level ${num}`;
        } else {
            level = String(slKey);
        }
    }

    let time = sp.castingTime || '';
    let range = sp.range || '';
    let components = sp.components || '';
    let duration = sp.duration || '';

    return { school, level, time, range, components, duration };
}

export function cleanSpellHtml(html) {
    if (!html) return '';
    let cleaned = html;
    cleaned = cleaned.replace(/<div class="spell-meta"[^>]*>[\s\S]*?<\/div>/gi, '');
    return cleaned.trim();
}

export function promptUpcastLevel(baseLvl, callback) {
    if (typeof document === 'undefined') {
        if (callback) callback(baseLvl);
        return;
    }
    const modal = document.getElementById('modal-spell-upcast-prompt');
    const select = document.getElementById('upcast-prompt-level');
    if (!modal || !select) {
        if (callback) callback(baseLvl);
        return;
    }
    select.innerHTML = '';
    for (let i = baseLvl; i <= 9; i++) {
        select.innerHTML += `<option value="${i}">${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
    }
    modal.classList.remove('vtt-hidden');

    const handleCast = () => {
        cleanup();
        callback(parseInt(select.value));
    };
    const handleCancel = () => {
        cleanup();
        callback(null);
    };
    const cleanup = () => {
        modal.classList.add('vtt-hidden');
        document.getElementById('upcast-prompt-cast')?.removeEventListener('click', handleCast);
        document.getElementById('upcast-prompt-cancel')?.removeEventListener('click', handleCancel);
    };

    document.getElementById('upcast-prompt-cast')?.addEventListener('click', handleCast);
    document.getElementById('upcast-prompt-cancel')?.addEventListener('click', handleCancel);
}

export function getCharIs2024(c) {
    if (!c) return false;
    return !!(
        (c.classes &&
            c.classes.some(
                (cls) => (cls.name || '').includes('[XPHB]') || (cls.source || '').toUpperCase() === 'XPHB'
            )) ||
        c.ruleset === '2024' ||
        c.source === 'XPHB' ||
        c.source === 'XMM' ||
        c.is2024
    );
}

export function findPlayerSpell(c, level, idx, spellName = null) {
    if (!c || !c.spells) return null;
    let list = c.spells[level];
    if (!list && level) {
        if (level.startsWith('level')) {
            const numKey = level.replace('level', '');
            list = c.spells[numKey];
        } else if (/^\d+$/.test(level)) {
            list = c.spells[level === '0' ? 'cantrip' : 'level' + level];
        } else if (level === 'cantrip') {
            list = c.spells['0'];
        }
    }

    if (spellName) {
        const cleanName = spellName
            .toLowerCase()
            .replace(/\[.*?\]$/, '')
            .trim();
        if (list && idx !== null && idx !== undefined && !isNaN(idx) && list[idx]) {
            const currentName = (list[idx].name || '')
                .toLowerCase()
                .replace(/\[.*?\]$/, '')
                .trim();
            if (currentName === cleanName) {
                return list[idx];
            }
        }
        if (Array.isArray(list)) {
            const foundInLevel = list.find(
                (s) =>
                    s &&
                    (s.name || '')
                        .toLowerCase()
                        .replace(/\[.*?\]$/, '')
                        .trim() === cleanName
            );
            if (foundInLevel) return foundInLevel;
        }
        for (const k in c.spells) {
            if (Array.isArray(c.spells[k])) {
                const found = c.spells[k].find(
                    (s) =>
                        s &&
                        (s.name || '')
                            .toLowerCase()
                            .replace(/\[.*?\]$/, '')
                            .trim() === cleanName
                );
                if (found) return found;
            }
        }
    }

    if (list && idx !== null && idx !== undefined && !isNaN(idx) && list[idx]) {
        return list[idx];
    }
    return null;
}

export function getUpcastedDamage(sp, castLvl, baseLvl, charLvl) {
    let list = sp.damageList && sp.damageList.length > 0 ? JSON.parse(JSON.stringify(sp.damageList)) : [];
    if (list.length === 0 && sp.damage) list.push({ formula: sp.damage, type: sp.damageType || '', label: '' });

    const scaleFn =
        typeof window !== 'undefined' ? window.VTTSpellManager?.scaleUpcastFormula || window.scaleUpcastFormula : null;

    if (baseLvl === 0 && list.length > 0) {
        let cCount = 1;
        if (charLvl >= 5) cCount = 2;
        if (charLvl >= 11) cCount = 3;
        if (charLvl >= 17) cCount = 4;
        for (let idx = 0; idx < list.length; idx++) {
            const d = list[idx];
            const rowCantripScale =
                d.cantripScale !== undefined
                    ? Boolean(d.cantripScale)
                    : idx === 0
                      ? Boolean(sp.cantripScale !== false)
                      : false;
            if (rowCantripScale && d.formula && /(?:\d+\s*)?[dD]\s*\d+/.test(d.formula)) {
                d.formula = d.formula.replace(/^(?:(\d+)\s*)?([dD]\s*\d+)/, (m, countStr, die) => {
                    const count = countStr !== undefined && countStr !== '' ? parseInt(countStr) : 1;
                    if (count === 0) {
                        const extraDice = cCount - 1;
                        return extraDice > 0 ? `${extraDice}${die}` : '0';
                    }
                    return `${cCount * count}${die}`;
                });
            }
        }
    } else if (castLvl > baseLvl && list.length > 0) {
        let rowSpecificScaled = false;
        for (let idx = 0; idx < list.length; idx++) {
            const d = list[idx];
            const rowUpcast = d.upcastBonus !== undefined ? d.upcastBonus : idx === 0 ? sp.upcastBonus : '';
            if (rowUpcast && String(rowUpcast).trim() !== '') {
                const step = d.upcastScaleStep || sp.upcastScaleStep || 1;
                const extra = Math.floor((castLvl - baseLvl) / step);
                if (extra > 0) {
                    if (scaleFn) {
                        const scaledUpcastStr = scaleFn(rowUpcast, extra);
                        if (scaledUpcastStr) {
                            d.formula = `${d.formula || ''} ${scaledUpcastStr}`.trim();
                            rowSpecificScaled = true;
                        }
                    }
                }
            }
        }

        if (!rowSpecificScaled && sp.upcastBonus && list[0] && scaleFn) {
            const step = sp.upcastScaleStep || 1;
            const extra = Math.floor((castLvl - baseLvl) / step);
            if (extra > 0) {
                const scaledUpcastStr = scaleFn(sp.upcastBonus, extra);
                if (scaledUpcastStr) {
                    list[0].formula = `${list[0].formula || ''} ${scaledUpcastStr}`.trim();
                }
            }
        }
    }
    return list;
}

/**
 * Render the full Spells tab HTML
 */
export function renderSpellsHtml(char, ctx) {
    char.spells = char.spells || {};
    char.spellSlots = char.spellSlots || {};
    char.spellSettings = char.spellSettings || {
        ability: char.spellAbility || 'INT',
        atkMod: 0,
        dcMod: 0,
        dmgMod: 0,
        toggles: []
    };

    if (ctx && ctx.activeSpellTab) {
        activeSpellTab = ctx.activeSpellTab;
    }

    const renderSpellRowHtml =
        (ctx && ctx.renderSpellRowHtml) ||
        (typeof window !== 'undefined' && window.vttPlayerSheetAPI && window.vttPlayerSheetAPI.renderSpellRowHtml) ||
        ((sp) => `<div class="spell-row">${sp?.name || 'Spell'}</div>`);

    let spellsHtml = `
        <style>
            .no-spin-button::-webkit-inner-spin-button,
            .no-spin-button::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .no-spin-button {
                -moz-appearance: textfield;
            }
        </style>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-book-open"></i> Spellbook</h4>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn btn-xxs btn-secondary pc-spell-settings-btn" title="Spell Settings"><i class="fa-solid fa-cog"></i></button>
            </div>
        </div>
        ${
            char.spellSettings.toggles && char.spellSettings.toggles.length > 0
                ? `
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
            ${char.spellSettings.toggles
                .map(
                    (t, i) => `
                <button class="btn btn-xxs btn-secondary pc-spell-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                    <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                </button>
            `
                )
                .join('')}
        </div>`
                : ''
        }
        <div style="display:flex; flex-direction:row; gap:16px; margin-bottom:12px; align-items:flex-start;">
            <!-- Left Sidebar for Tabs -->
            <div style="display:flex; flex-direction:column; gap:4px; min-width: 100px; border-right:1px solid var(--color-border-subtle); padding-right:12px;">
                ${SPELL_LEVELS.map((sl) => {
                    let slotHtml = '';
                    if (sl.key !== 'cantrip' && sl.key !== 'legacy' && sl.key !== 'all') {
                        const cur = char.spellSlots[sl.key]?.current || 0;
                        const max = char.spellSlots[sl.key]?.max || 0;
                        slotHtml = `
                            <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-top:2px; margin-bottom:4px; font-size:0.7rem; color:var(--color-text-muted);">
                                <button class="btn btn-xxs btn-secondary pc-slot-btn-minus" data-level="${sl.key}" style="padding:0 4px; font-size:0.7rem; line-height:1;">-</button>
                                <input type="number" min="0" class="pc-slot-current no-spin-button" data-level="${sl.key}" value="${cur}" style="width:20px; padding:0; font-size:0.7rem; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:var(--color-text-primary); text-align:center; border-radius:2px;">
                                <button class="btn btn-xxs btn-secondary pc-slot-btn-plus" data-level="${sl.key}" style="padding:0 4px; font-size:0.7rem; line-height:1;">+</button>
                                <span style="margin: 0 2px;">/</span>
                                <input type="number" min="0" class="pc-slot-max no-spin-button" data-level="${sl.key}" value="${max}" style="width:20px; padding:0; font-size:0.7rem; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:var(--color-text-primary); text-align:center; border-radius:2px;">
                            </div>
                        `;
                    }
                    return `
                        <div style="display:flex; flex-direction:column; align-items:stretch;">
                            <button class="btn btn-xs pc-spell-tab-btn ${sl.key === activeSpellTab ? 'btn-primary' : 'btn-secondary'}" data-level="${sl.key}" style="text-align:left;">${sl.label}</button>
                            ${slotHtml}
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Right Area for Pages -->
            <div id="pc-spell-pages" style="flex:1; min-width:0;">
                ${SPELL_LEVELS.map((sl) => {
                    if (sl.key === 'all') {
                        return `
                            <div class="pc-spell-page ${sl.key === activeSpellTab ? '' : 'vtt-hidden'}" id="spell-page-${sl.key}">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px;">
                                    <span style="font-size:0.9rem; font-weight:600;">All Spells</span>
                                    <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; color:var(--color-text-secondary); user-select:none;">
                                        <input type="checkbox" id="all-spells-prep-only" style="cursor:pointer;">
                                        <span>Show Prepared Only</span>
                                    </label>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <input type="text" id="all-spells-search" placeholder="Search spells..." style="width:100%; padding:6px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                </div>
                                <div id="all-spells-list" style="display:flex; flex-direction:column; gap:16px;">
                                    ${SPELL_LEVELS.filter((lvl) => lvl.key !== 'all')
                                        .map((lvl) => {
                                            const allLvlSpells = char.spells[lvl.key] || [];
                                            const lvlSpellsRendered = allLvlSpells
                                                .map((sp, idx) => ({ sp, idx }))
                                                .map(({ sp, idx }) => renderSpellRowHtml(sp, lvl.key, idx, true));

                                            if (lvlSpellsRendered.length === 0) return '';
                                            return `
                                                <div class="all-spells-group">
                                                    <h5 style="margin:0 0 8px 0; color:var(--color-gold-base); font-size:0.85rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${lvl.label}</h5>
                                                    <div style="display:flex; flex-direction:column; gap:8px;">
                                                        ${lvlSpellsRendered.join('')}
                                                    </div>
                                                </div>
                                            `;
                                        })
                                        .join('')}
                                    ${Object.values(char.spells).every((arr) => !arr || arr.length === 0) ? '<div style="font-size:0.8rem; color:var(--color-text-muted);">No spells added.</div>' : ''}
                                </div>
                            </div>
                        `;
                    } else {
                        const spList = char.spells[sl.key] || [];
                        return `
                            <div class="pc-spell-page ${sl.key === activeSpellTab ? '' : 'vtt-hidden'}" id="spell-page-${sl.key}">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <span style="font-size:0.9rem; font-weight:600;">${sl.label} Spells</span>
                                    </div>
                                    <button class="btn btn-secondary btn-xxs btn-add-spell" data-level="${sl.key}"><i class="fa-solid fa-plus"></i> Add Spell</button>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    ${spList.map((sp, idx) => renderSpellRowHtml(sp, sl.key, idx, false)).join('')}
                                    ${spList.length === 0 ? '<div style="font-size:0.8rem; color:var(--color-text-muted);">No spells added.</div>' : ''}
                                </div>
                            </div>
                        `;
                    }
                }).join('')}
            </div>
        </div>
    `;

    return spellsHtml;
}

/**
 * Attach all interactive listeners and drag-and-drop for the Spells tab
 */
export function wireSpellsEvents(char, ctx) {
    const { saveAndEmit, renderSheetData, vtt } = ctx;

    // Spell tab switching
    document.querySelectorAll('.pc-spell-tab-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            activeSpellTab = level;
            if (ctx.setActiveSpellTab) ctx.setActiveSpellTab(level);
            document.querySelectorAll('.pc-spell-tab-btn').forEach((b) => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            });
            e.currentTarget.classList.add('btn-primary');
            e.currentTarget.classList.remove('btn-secondary');
            document.querySelectorAll('.pc-spell-page').forEach((p) => p.classList.add('vtt-hidden'));
            document.getElementById('spell-page-' + level)?.classList.remove('vtt-hidden');
        })
    );

    // Add Spell buttons
    document.querySelectorAll('#ps-spells .btn-add-spell, .btn-add-spell').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level || 'cantrip';
            const currentChar = ctx.getCurrentChar ? ctx.getCurrentChar() : char;
            const is2024 = getCharIs2024(currentChar);
            const openFn =
                (ctx && ctx.openSpellModal) ||
                (window.VTTSpellManager && window.VTTSpellManager.openModal) ||
                window.openSpellModal;
            if (openFn) {
                openFn(
                    level,
                    -1,
                    currentChar,
                    (updatedChar) => {
                        if (updatedChar) {
                            Object.assign(char, updatedChar);
                            saveAndEmit(char);
                            renderSheetData(char);
                        }
                    },
                    { is2024 }
                );
            }
        });
    });

    // Edit Spell buttons
    document.querySelectorAll('#ps-spells .pc-spell-edit, .pc-spell-edit').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const level = e.currentTarget.dataset.level;
            const idx = parseInt(e.currentTarget.dataset.idx);
            const currentChar = ctx.getCurrentChar ? ctx.getCurrentChar() : char;
            const is2024 = getCharIs2024(currentChar);

            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            const sp = findPlayerSpell(char, level, idx, spellName);

            const openFn =
                (ctx && ctx.openSpellModal) ||
                (window.VTTSpellManager && window.VTTSpellManager.openModal) ||
                window.openSpellModal;
            if (level && idx >= 0 && openFn) {
                openFn(
                    level,
                    idx,
                    currentChar,
                    (updatedChar) => {
                        if (updatedChar) {
                            Object.assign(char, updatedChar);
                            saveAndEmit(char);
                            renderSheetData(char);
                        }
                    },
                    { targetSpell: sp, is2024 }
                );
            }
        });
    });

    // Slot current & max inputs
    document.querySelectorAll('.pc-slot-current').forEach((inp) =>
        inp.addEventListener('change', (e) => {
            const lvl = e.currentTarget.dataset.level;
            char.spellSlots[lvl] = char.spellSlots[lvl] || { current: 0, max: 0 };
            char.spellSlots[lvl].current = parseInt(e.currentTarget.value) || 0;
            saveAndEmit(char);
        })
    );

    document.querySelectorAll('.pc-slot-max').forEach((inp) =>
        inp.addEventListener('change', (e) => {
            const lvl = e.currentTarget.dataset.level;
            char.spellSlots[lvl] = char.spellSlots[lvl] || { current: 0, max: 0 };
            char.spellSlots[lvl].max = parseInt(e.currentTarget.value) || 0;
            saveAndEmit(char);
        })
    );

    // Slot +/- buttons
    document.querySelectorAll('.pc-slot-btn-minus').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const input = e.currentTarget.nextElementSibling;
            if (input && input.classList.contains('pc-slot-current')) {
                let val = parseInt(input.value) || 0;
                if (val > 0) {
                    input.value = val - 1;
                    input.dispatchEvent(new Event('change'));
                }
            }
        })
    );

    document.querySelectorAll('.pc-slot-btn-plus').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const input = e.currentTarget.previousElementSibling;
            if (input && input.classList.contains('pc-slot-current')) {
                let val = parseInt(input.value) || 0;
                input.value = val + 1;
                input.dispatchEvent(new Event('change'));
            }
        })
    );

    // All Spells search and prepared filter
    const applyAllSpellsFilters = () => {
        const val = document.getElementById('all-spells-search')?.value.toLowerCase().trim() || '';
        const isPrepOnly = document.getElementById('all-spells-prep-only')?.checked || false;
        const isSearching = val !== '';

        document.querySelectorAll('#spell-page-all .pc-spell-drag-handle').forEach((handle) => {
            if (isSearching) {
                handle.dataset.disabled = 'true';
                handle.style.opacity = '0.2';
                handle.style.cursor = 'not-allowed';
                handle.title = 'Reordering disabled during search';
            } else {
                delete handle.dataset.disabled;
                handle.style.opacity = '0.6';
                handle.style.cursor = 'grab';
                handle.title = 'Click and drag to reorder spell';
            }
        });

        document.querySelectorAll('#spell-page-all .spell-row').forEach((row) => {
            const name = (row.dataset.spellName || '').toLowerCase();
            const isPrep =
                row.dataset.prepared === 'true' || row.dataset.level === 'cantrip' || row.dataset.level === 'legacy';
            const matchesSearch = !val || name.includes(val);
            const matchesPrep = !isPrepOnly || isPrep;
            row.style.display = matchesSearch && matchesPrep ? 'flex' : 'none';
        });

        document.querySelectorAll('.all-spells-group').forEach((group) => {
            const visibleSpells = Array.from(group.querySelectorAll('.spell-row')).filter(
                (row) => row.style.display !== 'none'
            );
            group.style.display = visibleSpells.length > 0 ? 'block' : 'none';
        });
    };

    document.getElementById('all-spells-search')?.addEventListener('input', applyAllSpellsFilters);
    document.getElementById('all-spells-prep-only')?.addEventListener('change', applyAllSpellsFilters);

    // Spell expand description toggle
    document.querySelectorAll('.pc-spell-expand-btn').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            if (!item) return;
            const details = item.querySelector('.pc-spell-details');
            const nameEl = item.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item.dataset.spellName || 'Spell';
            const descEl = details ? details.querySelector('.pc-spell-desc') : null;
            const chevron = e.currentTarget.querySelector('.fa-chevron-right');

            const postChatBtn = item.querySelector('.pc-spell-post-chat');
            const level = item.dataset.level || (postChatBtn ? postChatBtn.dataset.level : null);
            const idx =
                item.dataset.idx !== undefined
                    ? parseInt(item.dataset.idx)
                    : postChatBtn
                      ? parseInt(postChatBtn.dataset.idx)
                      : null;
            let sp = findPlayerSpell(char, level, idx, spellName);
            const is2024 = getCharIs2024(char);
            if (!sp) {
                sp = { name: spellName, level: level, source: is2024 ? 'XPHB' : 'PHB' };
            } else if (!sp.source || sp.source === 'MM' || sp.source === 'XMM') {
                sp.source = is2024 ? 'XPHB' : 'PHB';
            }

            const spellOptions = { is2024, caster: char };

            if (details) {
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    if (chevron) chevron.style.transform = 'rotate(90deg)';
                    if (sp && window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                        try {
                            await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
                        } catch (err) {
                            console.warn('[VTTSpellManager] Error parsing spell:', err);
                        }
                    }
                    if (window.VTTSpellManager && window.VTTSpellManager.renderAndInjectSpell) {
                        window.VTTSpellManager.renderAndInjectSpell(
                            spellName,
                            descEl,
                            sp?.description || '',
                            sp,
                            level,
                            spellOptions
                        );
                    }
                } else {
                    details.style.display = 'none';
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            }
        })
    );

    // Post spell to chat
    document.querySelectorAll('.pc-spell-post-chat').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            let sp = findPlayerSpell(char, level, idx, spellName);
            const is2024 = getCharIs2024(char);
            if (!sp && spellName) {
                sp = { name: spellName, level: level, source: is2024 ? 'XPHB' : 'PHB' };
            }
            if (!sp) return;

            const spellOptions = { is2024, caster: char };
            if (window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
            }

            const visibility =
                typeof window !== 'undefined' && typeof window.getVisibilitySetting === 'function'
                    ? window.getVisibilitySetting()
                    : 'public';

            if (window.VTTSpellManager && window.VTTSpellManager.postSpellToChat) {
                window.VTTSpellManager.postSpellToChat(sp, level, char.name, visibility);
            } else {
                const meta = getSpellMetaStrings(sp, level);
                let metaHtml = '';
                if (
                    meta &&
                    (meta.level || meta.school || meta.time || meta.range || meta.components || meta.duration)
                ) {
                    metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
                    if (meta.level)
                        metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${meta.level}</div>`;
                    if (meta.school)
                        metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${meta.school}</div>`;
                    if (meta.time)
                        metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${meta.time}</div>`;
                    if (meta.range)
                        metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${meta.range}</div>`;
                    if (meta.components)
                        metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${meta.components}</div>`;
                    if (meta.duration)
                        metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${meta.duration}</div>`;
                    metaHtml += '</div>';
                }
                let bodyText = sp.description || '';
                bodyText = cleanSpellHtml(bodyText);
                vtt.socket.emit('chat:msg', {
                    abilityCard: {
                        creatureName: char.name,
                        abilityName: sp.name,
                        text: metaHtml + bodyText,
                        ...meta
                    }
                });
            }
        })
    );

    // Ping spell macro
    document.querySelectorAll('.pc-spell-ping-macro').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            const sp = findPlayerSpell(char, level, idx, spellName);
            if (!sp) return;

            const is2024 = getCharIs2024(char);
            const spellOptions = { is2024, caster: char };
            if (window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                await window.VTTSpellManager.ensureSpellIsParsed(sp, spellOptions);
            }

            const visibility =
                typeof window !== 'undefined' && typeof window.getVisibilitySetting === 'function'
                    ? window.getVisibilitySetting()
                    : 'public';

            const hasMechanics = Boolean(
                (sp.attackStat && sp.attackStat !== 'none' && sp.attackStat !== '') ||
                sp.attackBonus ||
                sp.saveAbility ||
                (sp.saveDcStat && sp.saveDcStat !== 'none') ||
                sp.saveDcCustom ||
                (sp.damageList && sp.damageList.length > 0)
            );

            if (hasMechanics && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                const hasUpcast =
                    sp.upcastBonus ||
                    (sp.damageList && sp.damageList.some((d) => d.upcastBonus && String(d.upcastBonus).trim() !== ''));
                const upcastFn = window.VTTSpellManager?.promptUpcastLevel || promptUpcastLevel;
                if (level !== 'cantrip' && level !== 'legacy' && hasUpcast && upcastFn) {
                    upcastFn(parseInt(String(level).replace('level', '')) || 1, (lvl) => {
                        if (lvl) {
                            window.VTTSpellManager.rollSpell(sp, level, char, { type: 'roll', castLvl: lvl, visibility });
                        }
                    });
                } else {
                    window.VTTSpellManager.rollSpell(sp, level, char, { type: 'roll', visibility });
                }
            } else if (window.VTTSpellManager && window.VTTSpellManager.postSpellToChat) {
                // Utility spell fallback: ping description card
                window.VTTSpellManager.postSpellToChat(sp, level, char.name, visibility);
            }
        })
    );

    // Spell prep toggle
    document.querySelectorAll('.pc-spell-prep-toggle').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            const sp = findPlayerSpell(char, level, idx, spellName);
            if (!sp) return;
            sp.prepared = sp.prepared === false ? true : false;
            saveAndEmit(char);
            renderSheetData(char);
        })
    );

    // Spell attack, save, damage buttons
    document.querySelectorAll('.pc-spell-macro-attack').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            const sp = findPlayerSpell(char, level, idx, spellName);
            if (sp && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                window.VTTSpellManager.rollSpell(sp, level, char, { type: 'attack' });
            }
        })
    );

    document.querySelectorAll('.pc-spell-macro-save').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            const sp = findPlayerSpell(char, level, idx, spellName);
            if (sp && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                window.VTTSpellManager.rollSpell(sp, level, char, { type: 'save' });
            }
        })
    );

    document.querySelectorAll('.pc-spell-macro-damage').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const item =
                e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            const nameEl = item?.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : item?.dataset.spellName || '';
            const sp = findPlayerSpell(char, level, idx, spellName);
            if (!sp) return;

            const hasUpcast =
                sp.upcastBonus ||
                (sp.damageList && sp.damageList.some((d) => d.upcastBonus && String(d.upcastBonus).trim() !== ''));
            const upcastFn = window.VTTSpellManager?.promptUpcastLevel || promptUpcastLevel;
            if (level !== 'cantrip' && level !== 'legacy' && hasUpcast && upcastFn) {
                upcastFn(parseInt(String(level).replace('level', '')) || 1, (lvl) => {
                    if (lvl && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                        window.VTTSpellManager.rollSpell(sp, level, char, { type: 'damage', castLvl: lvl });
                    }
                });
            } else if (window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                window.VTTSpellManager.rollSpell(sp, level, char, { type: 'damage' });
            }
        })
    );

    // Drag-and-drop within spell levels
    let spellDragHandlePressed = false;
    let spellDraggedIdx = null;
    let spellDraggedLevel = null;

    const clearSpellDropIndicators = () => {
        document.querySelectorAll('#ps-spells .spell-row').forEach((row) => {
            row.style.borderTop = '';
            row.style.borderBottom = '';
            row.style.boxShadow = '';
            row.style.opacity = '';
        });
    };

    document.querySelectorAll('.pc-spell-drag-handle').forEach((handle) => {
        handle.addEventListener('mousedown', () => {
            spellDragHandlePressed = true;
        });
    });

    window.addEventListener('mouseup', () => {
        spellDragHandlePressed = false;
    });

    document.querySelectorAll('#ps-spells .spell-row').forEach((row) => {
        row.addEventListener('dragstart', (e) => {
            const searchInput = document.getElementById('all-spells-search');
            if (searchInput && searchInput.value.trim() !== '') {
                e.preventDefault();
                return;
            }
            if (!spellDragHandlePressed) {
                e.preventDefault();
                return;
            }
            spellDraggedIdx = parseInt(row.dataset.idx);
            spellDraggedLevel = row.dataset.level;
            e.dataTransfer.setData('text/plain', `spell_${spellDraggedLevel}_${spellDraggedIdx}`);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                row.style.opacity = '0.4';
            }, 0);
        });

        row.addEventListener('dragover', (e) => {
            if (spellDraggedIdx === null || spellDraggedIdx === undefined || !spellDraggedLevel) return;
            const searchInput = document.getElementById('all-spells-search');
            if (searchInput && searchInput.value.trim() !== '') return;

            const targetLevel = row.dataset.level;
            if (targetLevel !== spellDraggedLevel) return;

            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            clearSpellDropIndicators();

            const draggedRow = document.querySelector(
                `#ps-spells .spell-row[data-level="${spellDraggedLevel}"][data-idx="${spellDraggedIdx}"]`
            );
            if (draggedRow) draggedRow.style.opacity = '0.4';

            if (e.clientY < midY) {
                row.style.borderTop = '2px solid var(--color-gold-base)';
                row.style.boxShadow = '0 -4px 8px -2px rgba(212, 175, 55, 0.6)';
            } else {
                row.style.borderBottom = '2px solid var(--color-gold-base)';
                row.style.boxShadow = '0 4px 8px -2px rgba(212, 175, 55, 0.6)';
            }
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearSpellDropIndicators();

            const fromIdx = spellDraggedIdx;
            const fromLevel = spellDraggedLevel;
            const targetIdx = parseInt(row.dataset.idx);
            const targetLevel = row.dataset.level;
            spellDraggedIdx = null;
            spellDraggedLevel = null;
            spellDragHandlePressed = false;

            if (fromLevel !== targetLevel || isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let insertAt = targetIdx;
            if (e.clientY >= midY) {
                insertAt = targetIdx + 1;
            }
            if (fromIdx < insertAt) {
                insertAt--;
            }

            if (char.spells[fromLevel] && char.spells[fromLevel][fromIdx]) {
                const [movedSpell] = char.spells[fromLevel].splice(fromIdx, 1);
                char.spells[fromLevel].splice(insertAt, 0, movedSpell);
                saveAndEmit(char);
                renderSheetData(char);
            }
        });

        row.addEventListener('dragend', () => {
            spellDraggedIdx = null;
            spellDraggedLevel = null;
            spellDragHandlePressed = false;
            clearSpellDropIndicators();
        });
    });
}
