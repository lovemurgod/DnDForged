// ForgeDVTT Creature Sheet — Editor Subsystem
// Handles companion editing, creature stat customization, token gallery, and defense configurations.

import { STANDARD_DAMAGE_TYPES, formatDamageList, entryToPlainText, calcDiceAverage } from './creature-parser.js';
import { resolveSpellcastingType, get5eSlotsForCaster } from './creature-spells.js';

let currentEditCharId = null;
let currentEditDefenses = null;

export function defenseToEditableRows(list) {
    if (!list) return [];
    const arr = Array.isArray(list) ? list : [list];
    const rows = [];
    arr.forEach((item) => {
        if (!item) return;
        if (typeof item === 'string') {
            rows.push({
                types: [item.trim().toLowerCase()],
                bypasses: [],
                note: ''
            });
        } else if (typeof item === 'object') {
            if (Array.isArray(item.types)) {
                rows.push({
                    types: item.types.map((t) => String(t).trim().toLowerCase()).filter(Boolean),
                    bypasses: Array.isArray(item.bypasses)
                        ? item.bypasses.map((b) => String(b).trim().toLowerCase()).filter(Boolean)
                        : [],
                    note: item.note || ''
                });
            } else {
                const inner = item.immune || item.resist || item.vulnerable || [];
                const types = (Array.isArray(inner) ? inner : [inner])
                    .map((t) => String(t).trim().toLowerCase())
                    .filter(Boolean);
                const note = item.note || '';
                const bypasses = [];
                if (/nonmagical/i.test(note)) bypasses.push('magic');
                if (/silver/i.test(note)) bypasses.push('silver');
                if (/adamantine/i.test(note)) bypasses.push('adamantine');
                rows.push({ types, bypasses, note });
            }
        }
    });
    return rows;
}

export function editableRowsToDefenses(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    const list = [];
    rows.forEach((r) => {
        const types = (r.types || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (types.length === 0) return;
        const bypasses = (r.bypasses || []).map((b) => b.trim().toLowerCase()).filter(Boolean);
        const note = (r.note || '').trim();
        if (bypasses.length > 0 || note) {
            list.push({
                types: types,
                bypasses: bypasses,
                note: note
            });
        } else {
            types.forEach((t) => list.push(t));
        }
    });
    return list;
}

export function parseDefenseTextInput(inputStr, fallbackExisting = []) {
    if (!inputStr) return [];
    const chunks = inputStr
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    const result = [];
    chunks.forEach((c) => {
        let note = '';
        let bypasses = [];
        const parenMatch = c.match(/\(([^)]+)\)/);
        if (parenMatch) {
            const inner = parenMatch[1];
            if (/nonmagical/i.test(inner)) bypasses.push('magic');
            if (/silver/i.test(inner)) bypasses.push('silver');
            if (/adamantine/i.test(inner)) bypasses.push('adamantine');
            note = inner;
            c = c.replace(/\([^)]+\)/, '').trim();
        }
        const types = c
            .split(/[\s/]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
        if (types.length > 0) {
            if (bypasses.length > 0 || note) {
                result.push({ types, bypasses, note });
            } else {
                result.push(...types);
            }
        }
    });
    return result.length > 0 ? result : fallbackExisting;
}

export function openCreatureDefenseConfigModal(currentDefenses, onApply) {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('cs-defenses-modal-overlay');
    if (overlay) overlay.remove();

    const ALL_TYPES = [
        'acid',
        'bludgeoning',
        'cold',
        'fire',
        'force',
        'lightning',
        'necrotic',
        'piercing',
        'poison',
        'psychic',
        'radiant',
        'slashing',
        'thunder'
    ];
    const BPS_TYPES = ['bludgeoning', 'piercing', 'slashing'];
    const ELEM_TYPES = ['acid', 'cold', 'fire', 'lightning', 'thunder'];

    const state = {
        resist: JSON.parse(JSON.stringify(currentDefenses.resist || [])),
        immune: JSON.parse(JSON.stringify(currentDefenses.immune || [])),
        vulnerable: JSON.parse(JSON.stringify(currentDefenses.vulnerable || []))
    };
    let activeTab = 'resist';

    overlay = document.createElement('div');
    overlay.id = 'cs-defenses-modal-overlay';
    overlay.style.cssText =
        'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:10001; display:flex; justify-content:center; align-items:center;';

    const modal = document.createElement('div');
    modal.style.cssText =
        'width:620px; max-width:92vw; max-height:88vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-gold-base, #c5a059); border-radius:8px; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.9);';

    modal.innerHTML = `
        <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle, #333); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:8px 8px 0 0;">
            <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base); font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-shield-halved"></i> Configure Creature Defenses
            </h3>
            <button type="button" id="cs-def-close-btn" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:flex; border-bottom:1px solid var(--color-border-subtle, #333); background:rgba(0,0,0,0.2);">
            <button type="button" class="cs-def-tab-btn" data-tab="resist" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Resistances</button>
            <button type="button" class="cs-def-tab-btn" data-tab="immune" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Immunities</button>
            <button type="button" class="cs-def-tab-btn" data-tab="vulnerable" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Vulnerabilities</button>
        </div>
        <div id="cs-def-tab-content" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;"></div>
        <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle, #333); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:0 0 8px 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="cs-def-add-row-btn" style="display:inline-flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-plus"></i> Add Defense Rule
            </button>
            <div style="display:gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="cs-def-cancel-btn">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="cs-def-apply-btn">Apply Defenses</button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function updateTabStyles() {
        modal.querySelectorAll('.cs-def-tab-btn').forEach((btn) => {
            const isActive = btn.dataset.tab === activeTab;
            btn.style.borderBottomColor = isActive ? 'var(--color-gold-base, #c5a059)' : 'transparent';
            btn.style.color = isActive ? 'var(--color-gold-base, #c5a059)' : 'var(--color-text-muted)';
            btn.style.background = isActive ? 'rgba(197, 160, 89, 0.1)' : 'transparent';
        });
    }

    function renderRows() {
        const container = modal.querySelector('#cs-def-tab-content');
        container.innerHTML = '';
        const rows = state[activeTab] || [];

        if (rows.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:32px 16px; color:var(--color-text-muted); font-size:0.85rem;">
                    No ${activeTab} configured yet.<br>Click <strong>"Add Defense Rule"</strong> below to create one.
                </div>
            `;
            return;
        }

        rows.forEach((row, rIdx) => {
            const rowCard = document.createElement('div');
            rowCard.style.cssText =
                'background:rgba(255,255,255,0.03); border:1px solid var(--color-border-subtle, #333); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:10px;';

            const cardHeader = document.createElement('div');
            cardHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
            cardHeader.innerHTML = `
                <span style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Rule #${rIdx + 1}</span>
                <button type="button" class="btn btn-danger btn-xxs cs-def-del-row" data-idx="${rIdx}" style="padding:2px 6px;" title="Delete this rule"><i class="fa-solid fa-trash"></i></button>
            `;
            rowCard.appendChild(cardHeader);

            const typesSection = document.createElement('div');
            typesSection.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.75rem; color:var(--color-text-muted);">Damage Types:</span>
                    <div style="display:flex; gap:4px;">
                        <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-bps" data-idx="${rIdx}" style="font-size:0.7rem; padding:1px 5px;">BPS</button>
                        <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-elem" data-idx="${rIdx}" style="font-size:0.7rem; padding:1px 5px;">Elemental</button>
                        <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-clear" data-idx="${rIdx}" style="font-size:0.7rem; padding:1px 5px;">Clear</button>
                    </div>
                </div>
            `;

            const chipsGrid = document.createElement('div');
            chipsGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
            ALL_TYPES.forEach((t) => {
                const isSelected = (row.types || []).map((x) => x.toLowerCase()).includes(t);
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'cs-def-type-chip';
                chip.dataset.type = t;
                chip.dataset.idx = rIdx;
                chip.textContent = t.charAt(0).toUpperCase() + t.slice(1);
                chip.style.cssText = isSelected
                    ? 'padding:2px 8px; font-size:0.75rem; border-radius:12px; border:1px solid var(--color-gold-base, #c5a059); background:var(--color-gold-base, #c5a059); color:#000; font-weight:600; cursor:pointer;'
                    : 'padding:2px 8px; font-size:0.75rem; border-radius:12px; border:1px solid var(--color-border-subtle, #444); background:rgba(0,0,0,0.2); color:var(--color-text-muted); cursor:pointer;';

                chip.addEventListener('click', () => {
                    row.types = row.types || [];
                    const curIdx = row.types.findIndex((x) => x.toLowerCase() === t);
                    if (curIdx >= 0) row.types.splice(curIdx, 1);
                    else row.types.push(t);
                    renderRows();
                });
                chipsGrid.appendChild(chip);
            });
            typesSection.appendChild(chipsGrid);
            rowCard.appendChild(typesSection);

            const bypassSection = document.createElement('div');
            bypassSection.style.cssText =
                'background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; display:flex; flex-direction:column; gap:4px;';
            const bypasses = (row.bypasses || []).map((b) => b.toLowerCase());
            const isMagicBypass = bypasses.includes('magic') || bypasses.includes('nonmagical');
            const isSilverBypass = bypasses.includes('silver') || bypasses.includes('silvered');
            const isAdamBypass = bypasses.includes('adamantine');

            bypassSection.innerHTML = `
                <span style="font-size:0.72rem; color:var(--color-gold-base); font-weight:600; text-transform:uppercase;">Bypassed by attacks that are:</span>
                <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:2px;">
                    <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                        <input type="checkbox" class="cs-def-bypass-magic" data-idx="${rIdx}" ${isMagicBypass ? 'checked' : ''}> Magical (Nonmagical bypasses)
                    </label>
                    <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                        <input type="checkbox" class="cs-def-bypass-silver" data-idx="${rIdx}" ${isSilverBypass ? 'checked' : ''}> Silvered
                    </label>
                    <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                        <input type="checkbox" class="cs-def-bypass-adam" data-idx="${rIdx}" ${isAdamBypass ? 'checked' : ''}> Adamantine
                    </label>
                </div>
            `;
            rowCard.appendChild(bypassSection);

            const noteSection = document.createElement('div');
            noteSection.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:0.75rem; color:var(--color-text-muted); white-space:nowrap;">Note:</span>
                    <input type="text" class="vtt-input cs-def-note-input" data-idx="${rIdx}" value="${(row.note || '').replace(/"/g, '&quot;')}" placeholder="e.g. while in dim light or darkness" style="width:100%; font-size:0.75rem; padding:3px 6px;">
                </div>
            `;
            rowCard.appendChild(noteSection);

            container.appendChild(rowCard);
        });

        container.querySelectorAll('.cs-def-del-row').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                state[activeTab].splice(idx, 1);
                renderRows();
            });
        });

        container.querySelectorAll('.cs-def-preset-bps').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const r = state[activeTab][idx];
                r.types = [...new Set([...(r.types || []), ...BPS_TYPES])];
                renderRows();
            });
        });

        container.querySelectorAll('.cs-def-preset-elem').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const r = state[activeTab][idx];
                r.types = [...new Set([...(r.types || []), ...ELEM_TYPES])];
                renderRows();
            });
        });

        container.querySelectorAll('.cs-def-preset-clear').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                state[activeTab][idx].types = [];
                renderRows();
            });
        });

        container.querySelectorAll('.cs-def-bypass-magic').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.idx);
                const r = state[activeTab][idx];
                r.bypasses = r.bypasses || [];
                r.bypasses = r.bypasses.filter((b) => b !== 'magic' && b !== 'nonmagical');
                if (cb.checked) r.bypasses.push('magic');
            });
        });

        container.querySelectorAll('.cs-def-bypass-silver').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.idx);
                const r = state[activeTab][idx];
                r.bypasses = r.bypasses || [];
                r.bypasses = r.bypasses.filter((b) => b !== 'silver' && b !== 'silvered');
                if (cb.checked) r.bypasses.push('silver');
            });
        });

        container.querySelectorAll('.cs-def-bypass-adam').forEach((cb) => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.idx);
                const r = state[activeTab][idx];
                r.bypasses = r.bypasses || [];
                r.bypasses = r.bypasses.filter((b) => b !== 'adamantine');
                if (cb.checked) r.bypasses.push('adamantine');
            });
        });

        container.querySelectorAll('.cs-def-note-input').forEach((inp) => {
            inp.addEventListener('input', () => {
                const idx = parseInt(inp.dataset.idx);
                state[activeTab][idx].note = inp.value;
            });
        });
    }

    modal.querySelectorAll('.cs-def-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab;
            updateTabStyles();
            renderRows();
        });
    });

    modal.querySelector('#cs-def-add-row-btn').addEventListener('click', () => {
        state[activeTab] = state[activeTab] || [];
        state[activeTab].push({ types: [], bypasses: [], note: '' });
        renderRows();
    });

    const closeFn = () => overlay.remove();
    modal.querySelector('#cs-def-close-btn').addEventListener('click', closeFn);
    modal.querySelector('#cs-def-cancel-btn').addEventListener('click', closeFn);

    modal.querySelector('#cs-def-apply-btn').addEventListener('click', () => {
        onApply(state);
        closeFn();
    });

    updateTabStyles();
    renderRows();
}

export function createAbilityRow(item = {}) {
    const row = document.createElement('div');
    row.className = 'cs-edit-ability-row';
    row.style.cssText =
        'display:flex; flex-direction:column; gap:6px; margin-bottom:10px; padding:10px; background:var(--color-bg-dark); border-radius:6px; border:1px solid var(--color-border);';

    let desc = '';
    if (item.entries && Array.isArray(item.entries)) {
        desc = item.entries
            .map((e) => entryToPlainText(e))
            .filter(Boolean)
            .join('\n');
    } else if (item.descriptionHtml) {
        desc = item.descriptionHtml;
    }

    let initAtk = '';
    let initDc = '';
    let initSaveAb = 'dex';
    let initDamages = [];

    const nameToCheck = item.name || '';
    const textToCheck = `${nameToCheck} ${desc}`;
    const initIsMagic = item.macro?.isMagic !== undefined
        ? !!item.macro.isMagic
        : (/\bmagical\b/i.test(textToCheck) || /\+[1-9]\b/.test(nameToCheck));
    const initIsSilvered = item.macro?.isSilvered !== undefined
        ? !!item.macro.isSilvered
        : /\bsilver(?:ed)?\b/i.test(textToCheck);
    const initIsAdamantine = item.macro?.isAdamantine !== undefined
        ? !!item.macro.isAdamantine
        : /\badamantine\b/i.test(textToCheck);

    if (item.macro) {
        if (item.macro.attackBonus !== undefined && item.macro.attackBonus !== null) {
            const b = item.macro.attackBonus;
            initAtk = b >= 0 ? `+${b}` : `${b}`;
        }
        if (item.macro.save && item.macro.save.dc !== undefined) {
            initDc = `${item.macro.save.dc}`;
            if (item.macro.save.ability) initSaveAb = item.macro.save.ability.toLowerCase();
        }
        if (item.macro.damages && Array.isArray(item.macro.damages)) {
            initDamages = item.macro.damages.map((d) => {
                const rawType = (d.type || 'Slashing').trim();
                const matched =
                    STANDARD_DAMAGE_TYPES.find((dt) => dt.toLowerCase() === rawType.toLowerCase()) ||
                    rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
                return { formula: d.formula || '', type: matched, saveRider: !!d.saveRider };
            });
        }
    } else if (desc) {
        const atkMatch = desc.match(/(?:\{@hit\s+([+-]?\d+)\}|([+-]?\d+)\s+to\s+hit)/i);
        if (atkMatch) {
            const val = parseInt(atkMatch[1] || atkMatch[2]);
            if (!isNaN(val)) initAtk = val >= 0 ? `+${val}` : `${val}`;
        }
        const dcMatch = desc.match(
            /DC\s+(\d+)(?:\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i
        );
        if (dcMatch) {
            initDc = dcMatch[1];
            if (dcMatch[2]) {
                initSaveAb = dcMatch[2].substring(0, 3).toLowerCase();
            }
        }
        const saveBoundary = desc.search(
            /(?:saving\s+throw|save\s+DC|\{@actSave|\{@dc|\bDC\s*\d+|\bmust\s+(?:make|succeed)\b)/i
        );
        const dmgMatches = [
            ...desc.matchAll(
                /(?:\{@damage\s+([^}]+)\}|(?:(?:(\d+)\s*\(([^)]+)\))|([1-9]\d*d\d+(?:\s*[+-]\s*\d+)?))\s*([a-zA-Z]+)?\s*damage)/gi
            )
        ];
        dmgMatches.forEach((dm) => {
            const formula = (dm[1] || dm[3] || dm[4] || '').trim();
            const rawType = (dm[5] || 'Slashing').trim();
            const type =
                STANDARD_DAMAGE_TYPES.find((dt) => dt.toLowerCase() === rawType.toLowerCase()) || 'Slashing';
            const isRider = saveBoundary !== -1 && dm.index >= saveBoundary;
            if (formula) {
                initDamages.push({ formula, type, saveRider: isRider });
            }
        });
    }

    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <input type="text" class="vtt-input edit-ab-name" value="${item.name || ''}" placeholder="Ability / Action Name" style="flex:1; font-weight:600;">
            <button type="button" class="btn btn-xxs btn-danger edit-ab-del" title="Delete Ability"><i class="fa-solid fa-trash"></i></button>
        </div>
        <!-- Modular Modifier Bar -->
        <div class="edit-ab-modifier-bar" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px; font-size:0.8rem;">
            <div style="display:flex; align-items:center; gap:4px;">
                <span style="color:var(--color-text-muted); font-size:0.75rem;">Atk Mod:</span>
                <input type="text" class="vtt-input edit-ab-atk" value="${initAtk}" placeholder="+0" style="width:48px; text-align:center; padding:2px 4px; font-size:0.8rem;">
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <span style="color:var(--color-text-muted); font-size:0.75rem;">Save DC:</span>
                <input type="number" class="vtt-input edit-ab-dc" value="${initDc}" placeholder="DC" style="width:48px; text-align:center; padding:2px 4px; font-size:0.8rem;">
                <select class="vtt-input edit-ab-save-ab" style="padding:2px 4px; font-size:0.8rem;">
                    ${['dex', 'con', 'wis', 'str', 'int', 'cha'].map((ab) => `<option value="${ab}" ${initSaveAb === ab ? 'selected' : ''}>${ab.toUpperCase()}</option>`).join('')}
                </select>
            </div>
            <div class="edit-ab-dmg-container" style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:200px;">
                <div class="edit-ab-dmg-list" style="display:flex; flex-direction:column; gap:4px;"></div>
                <button type="button" class="btn btn-xxs btn-secondary edit-ab-add-dmg" style="align-self:flex-start; font-size:0.75rem; padding:2px 6px;">
                    <i class="fa-solid fa-plus"></i> Add Dmg
                </button>
            </div>
        </div>
        <!-- Attack Bypasses Bar -->
        <div class="edit-ab-bypasses-bar" style="display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:4px 8px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:4px; font-size:0.75rem;">
            <span style="color:var(--color-gold-light); font-weight:600;">Attack Bypasses:</span>
            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Attack counts as magical for overcoming damage resistance">
                <input type="checkbox" class="edit-ab-is-magic" ${initIsMagic ? 'checked' : ''} style="cursor:pointer;"> Magical
            </label>
            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Attack is made with a silvered weapon">
                <input type="checkbox" class="edit-ab-is-silvered" ${initIsSilvered ? 'checked' : ''} style="cursor:pointer;"> Silvered
            </label>
            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Attack is made with an adamantine weapon">
                <input type="checkbox" class="edit-ab-is-adamantine" ${initIsAdamantine ? 'checked' : ''} style="cursor:pointer;"> Adamantine
            </label>
        </div>
        <textarea class="vtt-input edit-ab-desc" style="width:100%; height:65px; resize:vertical; font-family:var(--font-body); font-size:0.85rem;" placeholder="Description (e.g. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage)...">${desc}</textarea>
    `;

    row.querySelector('.edit-ab-del').addEventListener('click', () => row.remove());

    const dmgList = row.querySelector('.edit-ab-dmg-list');
    const descArea = row.querySelector('.edit-ab-desc');
    const atkInput = row.querySelector('.edit-ab-atk');
    const dcInput = row.querySelector('.edit-ab-dc');
    const saveAbSelect = row.querySelector('.edit-ab-save-ab');

    const damageTypes = STANDARD_DAMAGE_TYPES;

    function createDmgRow(formula = '', type = 'Slashing', isRider = false) {
        const rawType = (type || 'Slashing').trim();
        const matchedType =
            damageTypes.find((t) => t.toLowerCase() === rawType.toLowerCase()) ||
            rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
        const dRow = document.createElement('div');
        dRow.className = 'edit-ab-dmg-row';
        dRow.style.cssText =
            'display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:3px;';
        dRow.innerHTML = `
            <input type="text" class="vtt-input edit-ab-dmg-formula" value="${formula}" placeholder="1d6+2" style="width:70px; font-size:0.75rem; padding:2px 4px; text-align:center;">
            <select class="vtt-input edit-ab-dmg-type" style="font-size:0.75rem; padding:2px 4px;">
                ${damageTypes.map((t) => `<option value="${t}" ${matchedType.toLowerCase() === t.toLowerCase() ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <label style="display:inline-flex; align-items:center; gap:3px; font-size:0.7rem; color:var(--color-text-muted); cursor:pointer;" title="Check if this damage is triggered by the saving throw">
                <input type="checkbox" class="edit-ab-dmg-rider" ${isRider ? 'checked' : ''}> Rider
            </label>
            <button type="button" class="btn btn-xxs btn-danger edit-ab-del-dmg" style="padding:1px 4px; font-size:0.65rem;" title="Remove Damage"><i class="fa-solid fa-xmark"></i></button>
        `;
        dRow.querySelector('.edit-ab-del-dmg').addEventListener('click', () => {
            dRow.remove();
            syncDescFromInputs();
        });
        dRow.querySelector('.edit-ab-dmg-formula').addEventListener('input', syncDescFromInputs);
        dRow.querySelector('.edit-ab-dmg-type').addEventListener('change', syncDescFromInputs);
        dRow.querySelector('.edit-ab-dmg-rider').addEventListener('change', syncDescFromInputs);
        return dRow;
    }

    initDamages.forEach((d) => {
        dmgList.appendChild(createDmgRow(d.formula, d.type, d.saveRider));
    });

    row.querySelector('.edit-ab-add-dmg').addEventListener('click', () => {
        dmgList.appendChild(createDmgRow('1d6', 'Slashing', false));
        syncDescFromInputs();
    });

    let isSyncing = false;

    function syncDescFromInputs() {
        if (isSyncing) return;
        isSyncing = true;
        let currentDesc = descArea.value;

        // 1. Update Attack Tag
        const atkVal = atkInput.value.trim();
        if (atkVal) {
            const cleanAtk = atkVal.replace(/^\+/, '');
            if (/\{@hit\s+[+-]?\d+\}/i.test(currentDesc)) {
                currentDesc = currentDesc.replace(/\{@hit\s+[+-]?\d+\}/gi, `{@hit ${cleanAtk}}`);
            } else if (/\b[+-]?\d+\s+to\s+hit\b/i.test(currentDesc)) {
                currentDesc = currentDesc.replace(/\b[+-]?\d+\s+to\s+hit\b/gi, `+${cleanAtk} to hit`);
            } else if (/Attack:\s*/i.test(currentDesc)) {
                currentDesc = currentDesc.replace(/(Attack:\s*)/i, `$1+${cleanAtk} to hit, `);
            } else {
                currentDesc = currentDesc ? `+${cleanAtk} to hit. ${currentDesc}` : `+${cleanAtk} to hit.`;
            }
        }

        // 2. Update DC and Save Ability
        const dcVal = dcInput.value.trim();
        const saveAb = saveAbSelect.value;
        if (dcVal) {
            if (/\{@dc\s+\d+\}/i.test(currentDesc)) {
                currentDesc = currentDesc.replace(/\{@dc\s+\d+\}/gi, `{@dc ${dcVal}}`);
            } else if (/\bDC\s+\d+\b/i.test(currentDesc)) {
                currentDesc = currentDesc.replace(/\bDC\s+\d+\b/gi, `DC ${dcVal}`);
            }
            if (/\{@actSave\s+[a-zA-Z]+\}/i.test(currentDesc)) {
                currentDesc = currentDesc.replace(/\{@actSave\s+[a-zA-Z]+\}/gi, `{@actSave ${saveAb}}`);
            }
        }

        // 3. Update Damage Formulas
        const dmgRows = dmgList.querySelectorAll('.edit-ab-dmg-row');
        if (dmgRows.length > 0) {
            const primaryRow = dmgRows[0];
            const form = primaryRow.querySelector('.edit-ab-dmg-formula')?.value.trim();
            const type = primaryRow.querySelector('.edit-ab-dmg-type')?.value;
            if (form) {
                const avg = calcDiceAverage(form);
                const dmgPhrase = `${avg} (${form}) ${type.toLowerCase()} damage`;
                if (/\{@damage\s+[^}]+\}/i.test(currentDesc)) {
                    currentDesc = currentDesc.replace(/\{@damage\s+[^}]+\}/gi, `{@damage ${form}}`);
                } else if (/\d+\s*\([^)]+\)\s+[a-zA-Z]+\s+damage/i.test(currentDesc)) {
                    currentDesc = currentDesc.replace(/\d+\s*\([^)]+\)\s+[a-zA-Z]+\s+damage/i, dmgPhrase);
                }
            }
        }

        descArea.value = currentDesc;
        isSyncing = false;
    }

    function syncInputsFromDesc() {
        if (isSyncing) return;
        isSyncing = true;
        const currentDesc = descArea.value;

        // Attack
        const atkMatch = currentDesc.match(/(?:\{@hit\s+([+-]?\d+)\}|([+-]?\d+)\s+to\s+hit)/i);
        if (atkMatch) {
            const val = parseInt(atkMatch[1] || atkMatch[2]);
            if (!isNaN(val)) atkInput.value = val >= 0 ? `+${val}` : `${val}`;
        }

        // Save DC
        const dcMatch = currentDesc.match(
            /DC\s+(\d+)(?:\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i
        );
        if (dcMatch) {
            dcInput.value = dcMatch[1];
            if (dcMatch[2]) {
                saveAbSelect.value = dcMatch[2].substring(0, 3).toLowerCase();
            }
        }

        // Damage
        const saveBoundary = currentDesc.search(
            /(?:saving\s+throw|save\s+DC|\{@actSave|\{@dc|\bDC\s*\d+|\bmust\s+(?:make|succeed)\b)/i
        );
        const dmgMatches = [
            ...currentDesc.matchAll(
                /(?:\{@damage\s+([^}]+)\}|(?:(?:(\d+)\s*\(([^)]+)\))|([1-9]\d*d\d+(?:\s*[+-]\s*\d+)?))\s*([a-zA-Z]+)?\s*damage)/gi
            )
        ];
        if (dmgMatches.length > 0) {
            dmgList.innerHTML = '';
            dmgMatches.forEach((dm) => {
                const formula = (dm[1] || dm[3] || dm[4] || '').trim();
                const rawType = (dm[5] || 'Slashing').trim();
                const type = damageTypes.find((dt) => dt.toLowerCase() === rawType.toLowerCase()) || 'Slashing';
                const isRider = saveBoundary !== -1 && dm.index >= saveBoundary;
                if (formula) {
                    dmgList.appendChild(createDmgRow(formula, type, isRider));
                }
            });
        }

        isSyncing = false;
    }

    atkInput.addEventListener('input', syncDescFromInputs);
    dcInput.addEventListener('input', syncDescFromInputs);
    saveAbSelect.addEventListener('change', syncDescFromInputs);
    descArea.addEventListener('input', syncInputsFromDesc);

    return row;
}

export function openEditModal(m, charId, ctx = {}) {
    if (typeof document === 'undefined') return;
    currentEditCharId = charId;
    currentEditDefenses = {
        resist: defenseToEditableRows(m.resist),
        immune: defenseToEditableRows(m.immune),
        vulnerable: defenseToEditableRows(m.vulnerable)
    };
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;
    const char = vtt?.campaignState?.characters?.[charId];
    if (!char) return;

    let overlay = document.getElementById('cs-edit-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'cs-edit-modal-overlay';
    overlay.style.cssText =
        'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:9999; display:flex; justify-content:center; align-items:center;';

    const modalContainer = document.createElement('div');
    modalContainer.style.cssText =
        'width: 500px; max-width: 90vw; max-height: 85vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-border, #444); border-radius: 8px; display:flex; flex-direction:column; box-shadow: 0 4px 16px rgba(0,0,0,0.8);';

    const header = document.createElement('div');
    header.style.cssText =
        'padding:12px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-dark); border-radius: 8px 8px 0 0;';
    header.innerHTML = `
        <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base);">Edit Companion</h3>
        <div>
            <button class="btn btn-sm btn-primary" id="cs-edit-save-btn">Save</button>
            <button class="btn btn-sm btn-secondary" id="cs-edit-cancel-btn">Cancel</button>
        </div>
    `;

    const content = document.createElement('div');
    content.id = 'cs-edit-modal-content';
    content.style.cssText = 'flex:1; overflow-y:auto; padding:12px;';

    modalContainer.appendChild(header);
    modalContainer.appendChild(content);
    overlay.appendChild(modalContainer);
    document.body.appendChild(overlay);

    const name = char.name || m.name || '';

    if (!char.tokenImages) {
        char.tokenImages = [];
        char.activeTokenIndex = 0;
    } else if (typeof char.tokenImages === 'string') {
        char.tokenImages = [{ url: char.tokenImages, name: 'Imported Token' }];
        char.activeTokenIndex = 0;
    } else if (Array.isArray(char.tokenImages)) {
        char.tokenImages = char.tokenImages.map((t) =>
            typeof t === 'string'
                ? { url: t, name: 'Imported Token' }
                : t && typeof t === 'object'
                  ? t
                  : { url: '', name: 'Unknown' }
        );
    } else {
        char.tokenImages = [];
        char.activeTokenIndex = 0;
    }
    if (typeof char.activeTokenIndex !== 'number') char.activeTokenIndex = 0;

    let defaultTokenUrl = m.tokenImg || m.tokenUrl || m.imgUrl;
    if (!defaultTokenUrl && typeof window !== 'undefined' && window.Renderer?.monster?.getTokenUrl) {
        try {
            defaultTokenUrl = window.Renderer.monster.getTokenUrl(m);
        } catch (e) {}
    }
    if (!defaultTokenUrl && (m.source || m.name)) {
        const cleanName =
            typeof window !== 'undefined' && window.Parser?.nameToTokenName
                ? window.Parser.nameToTokenName(m.name)
                : (m.name || '').replace(/"/g, '').trim();
        const source = m.source || 'MM';
        defaultTokenUrl = `img/bestiary/tokens/${source}/${cleanName}.webp`;
    }
    if (defaultTokenUrl && !char.defaultTokenDeleted) {
        const hasDefault = char.tokenImages.some(
            (t) => t?.isDefault || (typeof t === 'string' ? t : t?.url) === defaultTokenUrl
        );
        if (!hasDefault) {
            char.tokenImages.unshift({ url: defaultTokenUrl, name: 'Default Token', isDefault: true });
        }
    }

    const acObj = Array.isArray(m.ac) ? m.ac[0] : m.ac;
    const ac =
        typeof acObj === 'object' ? (acObj.value ?? acObj.ac ?? m.primaryAc ?? 10) : (acObj ?? m.primaryAc ?? 10);
    const hpAvg = m.hp?.average || 0;
    const hpForm = m.hp?.formula || '';
    const saves = m.save || {};

    const rawSize = Array.isArray(m.size) ? m.size[0] : m.size || 'M';
    const sizeMap = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
    const sizeVal = sizeMap[rawSize]
        ? rawSize
        : Object.keys(sizeMap).find((k) => sizeMap[k].toLowerCase() === String(rawSize).toLowerCase()) || 'M';

    let typeStr = '';
    let tagsStr = '';
    if (typeof m.type === 'string') {
        typeStr = m.type.toLowerCase();
    } else if (typeof m.type === 'object' && m.type !== null) {
        typeStr = (m.type.type || '').toLowerCase();
        if (Array.isArray(m.type.tags)) {
            tagsStr = m.type.tags.join(', ');
        } else if (typeof m.type.tags === 'string') {
            tagsStr = m.type.tags;
        }
    }
    if (!tagsStr && m.subtype) {
        tagsStr = Array.isArray(m.subtype) ? m.subtype.join(', ') : m.subtype;
    }

    const standardTypes = [
        'aberration',
        'beast',
        'celestial',
        'construct',
        'dragon',
        'elemental',
        'fey',
        'fiend',
        'giant',
        'humanoid',
        'monstrosity',
        'ooze',
        'plant',
        'undead'
    ];
    const isStandardType = standardTypes.includes(typeStr);
    const typeSelectVal = isStandardType ? typeStr : typeStr ? 'custom' : 'humanoid';
    const customTypeVal = isStandardType ? '' : typeStr;

    let alignCategory = 'U';
    let customAlignValue = '';

    if (Array.isArray(m.alignment)) {
        if (m.alignment.length === 2 && typeof m.alignment[0] === 'string' && typeof m.alignment[1] === 'string') {
            const code = (m.alignment[0] + m.alignment[1]).toUpperCase();
            if (['LG', 'NG', 'CG', 'LN', 'CN', 'LE', 'NE', 'CE'].includes(code)) {
                alignCategory = code;
            } else {
                alignCategory = 'custom';
                customAlignValue = m.alignment.join(' ');
            }
        } else if (m.alignment.length === 1 && typeof m.alignment[0] === 'string') {
            const code = m.alignment[0].toUpperCase();
            if (code === 'N' || code === 'NX' || code === 'NY') alignCategory = 'N';
            else if (code === 'U') alignCategory = 'U';
            else if (code === 'A') alignCategory = 'A';
            else {
                alignCategory = 'custom';
                customAlignValue = m.alignment[0];
            }
        } else if (m.alignment.length > 0) {
            alignCategory = 'custom';
            try {
                customAlignValue =
                    typeof Parser !== 'undefined' && Parser.alignmentListToFull
                        ? Parser.alignmentListToFull(m.alignment)
                        : JSON.stringify(m.alignment);
            } catch (e) {
                customAlignValue = m.alignment.join(' ');
            }
        }
    } else if (typeof m.alignment === 'string') {
        const rawAlign = m.alignment.toLowerCase();
        const alignMap = {
            'lawful good': 'LG',
            'neutral good': 'NG',
            'chaotic good': 'CG',
            'lawful neutral': 'LN',
            'true neutral': 'N',
            neutral: 'N',
            'chaotic neutral': 'CN',
            'lawful evil': 'LE',
            'neutral evil': 'NE',
            'chaotic evil': 'CE',
            unaligned: 'U',
            'any alignment': 'A'
        };
        if (alignMap[rawAlign]) {
            alignCategory = alignMap[rawAlign];
        } else {
            alignCategory = 'custom';
            customAlignValue = m.alignment;
        }
    }

    let sensesValue = '';
    if (m.senses) {
        if (typeof m.senses === 'string') {
            sensesValue = m.senses;
        } else if (Array.isArray(m.senses)) {
            sensesValue = m.senses.join(', ');
        } else if (typeof m.senses === 'object') {
            const parts = [];
            if (m.senses.sensesString) parts.push(m.senses.sensesString);
            ['darkvision', 'blindsight', 'truesight', 'tremorsense', 'devilSight'].forEach((k) => {
                if (m.senses[k] && !m.senses.sensesString?.toLowerCase().includes(k.toLowerCase())) {
                    const name = k === 'devilSight' ? "devil's sight" : k;
                    parts.push(`${name} ${m.senses[k]} ft.`);
                }
            });
            const passive = m.senses.passivePerception || m.senses.passive || m.passive;
            if (passive !== undefined && passive !== null && passive !== '') {
                parts.push(`passive Perception ${passive}`);
            }
            if (parts.length > 0) {
                sensesValue = parts.join(', ');
            } else {
                sensesValue = Object.entries(m.senses)
                    .filter(([k]) => k !== 'sensesString' && k !== 'passivePerception' && k !== 'passive')
                    .map(([k, v]) => `${k} ${v}`)
                    .join(', ');
            }
        }
    } else if (m.passive) {
        sensesValue = `passive Perception ${m.passive}`;
    }

    let html = `
        <div style="display:flex; flex-direction:column; gap:16px;">
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
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Size</label>
                        <select id="cs-edit-size" class="vtt-input" style="width:100%;">
                            <option value="T" ${sizeVal === 'T' ? 'selected' : ''}>Tiny</option>
                            <option value="S" ${sizeVal === 'S' ? 'selected' : ''}>Small</option>
                            <option value="M" ${sizeVal === 'M' ? 'selected' : ''}>Medium</option>
                            <option value="L" ${sizeVal === 'L' ? 'selected' : ''}>Large</option>
                            <option value="H" ${sizeVal === 'H' ? 'selected' : ''}>Huge</option>
                            <option value="G" ${sizeVal === 'G' ? 'selected' : ''}>Gargantuan</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Type</label>
                        <select id="cs-edit-type-select" class="vtt-input" style="width:100%;">
                            ${standardTypes.map((t) => `<option value="${t}" ${typeSelectVal === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                            <option value="custom" ${typeSelectVal === 'custom' ? 'selected' : ''}>Custom...</option>
                        </select>
                        <input type="text" id="cs-edit-type-custom" class="vtt-input" style="width:100%; margin-top:4px; display:${typeSelectVal === 'custom' ? 'block' : 'none'};" placeholder="e.g. Swarm of Tiny beasts" value="${customTypeVal}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Tags / Subtype</label>
                        <input type="text" id="cs-edit-tags" class="vtt-input" style="width:100%;" value="${tagsStr}" placeholder="e.g. shapechanger, elf">
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Alignment</label>
                        <select id="cs-edit-align-select" class="vtt-input" style="width:100%;">
                            <option value="LG" ${alignCategory === 'LG' ? 'selected' : ''}>Lawful Good</option>
                            <option value="NG" ${alignCategory === 'NG' ? 'selected' : ''}>Neutral Good</option>
                            <option value="CG" ${alignCategory === 'CG' ? 'selected' : ''}>Chaotic Good</option>
                            <option value="LN" ${alignCategory === 'LN' ? 'selected' : ''}>Lawful Neutral</option>
                            <option value="N" ${alignCategory === 'N' ? 'selected' : ''}>True Neutral</option>
                            <option value="CN" ${alignCategory === 'CN' ? 'selected' : ''}>Chaotic Neutral</option>
                            <option value="LE" ${alignCategory === 'LE' ? 'selected' : ''}>Lawful Evil</option>
                            <option value="NE" ${alignCategory === 'NE' ? 'selected' : ''}>Neutral Evil</option>
                            <option value="CE" ${alignCategory === 'CE' ? 'selected' : ''}>Chaotic Evil</option>
                            <option value="U" ${alignCategory === 'U' ? 'selected' : ''}>Unaligned</option>
                            <option value="A" ${alignCategory === 'A' ? 'selected' : ''}>Any Alignment</option>
                            <option value="custom" ${alignCategory === 'custom' ? 'selected' : ''}>Custom...</option>
                        </select>
                        <input type="text" id="cs-edit-align-custom" class="vtt-input" style="width:100%; margin-top:4px; display:${alignCategory === 'custom' ? 'block' : 'none'};" placeholder="e.g. Neutral Good (50%)" value="${customAlignValue}">
                    </div>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Core Stats</h4>
                <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:8px;">
                    ${['str', 'dex', 'con', 'int', 'wis', 'cha']
                        .map(
                            (ab) => `
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${ab}</label>
                            <input type="number" class="vtt-input cs-edit-stat" data-stat="${ab}" style="width:100%;" value="${m[ab] || 10}">
                        </div>
                    `
                        )
                        .join('')}
                </div>
            </div>

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

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Speeds (ft.)</h4>
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Walk</label>
                        <input type="number" id="cs-edit-speed-walk" class="vtt-input" style="width:100%;" value="${typeof m.speed === 'number' ? m.speed : typeof m.speed?.walk === 'number' ? m.speed.walk : (parseInt(m.speed?.walk?.number ?? m.speed?.walk) ?? (m.speed?.walk === 0 ? 0 : 30))}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Fly</label>
                        <input type="number" id="cs-edit-speed-fly" class="vtt-input" style="width:100%;" value="${typeof m.speed?.fly === 'number' ? m.speed.fly : parseInt(m.speed?.fly?.number ?? m.speed?.fly) || 0}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Swim</label>
                        <input type="number" id="cs-edit-speed-swim" class="vtt-input" style="width:100%;" value="${typeof m.speed?.swim === 'number' ? m.speed.swim : parseInt(m.speed?.swim?.number ?? m.speed?.swim) || 0}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Burrow</label>
                        <input type="number" id="cs-edit-speed-burrow" class="vtt-input" style="width:100%;" value="${typeof m.speed?.burrow === 'number' ? m.speed.burrow : parseInt(m.speed?.burrow?.number ?? m.speed?.burrow) || 0}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Climb</label>
                        <input type="number" id="cs-edit-speed-climb" class="vtt-input" style="width:100%;" value="${typeof m.speed?.climb === 'number' ? m.speed.climb : parseInt(m.speed?.climb?.number ?? m.speed?.climb) || 0}">
                    </div>
                </div>
                <div style="margin-top:6px;">
                    <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
                        <input type="checkbox" id="cs-edit-speed-hover" ${m.speed?.canHover ? 'checked' : ''}> Can Hover (Flight)
                    </label>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:var(--color-text-secondary);">Defenses & Senses</h4>
                    <button type="button" class="btn btn-secondary btn-xs" id="cs-btn-manage-defenses" style="display:inline-flex; align-items:center; gap:4px;">
                        <i class="fa-solid fa-shield-halved"></i> Manage Defenses
                    </button>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Damage Immunities</label>
                        <input type="text" id="cs-edit-immune" class="vtt-input" style="width:100%;" value="${formatDamageList(m.immune)}" placeholder="e.g. fire, poison; bludgeoning from nonmagical attacks">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Damage Resistances</label>
                        <input type="text" id="cs-edit-resist" class="vtt-input" style="width:100%;" value="${formatDamageList(m.resist)}" placeholder="e.g. cold, lightning">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Damage Vulnerabilities</label>
                        <input type="text" id="cs-edit-vuln" class="vtt-input" style="width:100%;" value="${formatDamageList(m.vulnerable)}" placeholder="e.g. radiant">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Condition Immunities</label>
                        <input type="text" id="cs-edit-cond" class="vtt-input" style="width:100%;" value="${Array.isArray(m.conditionImmune) ? m.conditionImmune.join(', ') : m.conditionImmune || ''}" placeholder="e.g. charmed, frightened, poisoned">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Senses</label>
                        <input type="text" id="cs-edit-senses" class="vtt-input" style="width:100%;" value="${sensesValue}" placeholder="e.g. darkvision 60 ft., passive Perception 12">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Languages</label>
                        <input type="text" id="cs-edit-lang" class="vtt-input" style="width:100%;" value="${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages || ''}" placeholder="e.g. Common, Draconic">
                    </div>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Saving Throws (Modifiers)</h4>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                    ${['str', 'dex', 'con', 'int', 'wis', 'cha']
                        .map(
                            (ab) => `
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${ab}</label>
                            <input type="text" class="vtt-input cs-edit-save" data-ability="${ab}" style="width:100%;" value="${saves[ab] || ''}" placeholder="+0">
                        </div>
                    `
                        )
                        .join('')}
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Traits</h4>
                <div id="cs-edit-traits-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-trait">+ Add Trait</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Actions</h4>
                <div id="cs-edit-actions-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-action">+ Add Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Bonus Actions</h4>
                <div id="cs-edit-bonus-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-bonus">+ Add Bonus Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Reactions</h4>
                <div id="cs-edit-reactions-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-reaction">+ Add Reaction</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Legendary Actions</h4>
                <textarea id="cs-edit-legendary-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Legendary action description...">${typeof m.legendaryActions === 'object' && m.legendaryActions ? m.legendaryActions.description || '' : m.legendaryActions || ''}</textarea>
                <div id="cs-edit-legendary-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-legendary">+ Add Legendary Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Lair Actions</h4>
                <textarea id="cs-edit-lair-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Lair action description...">${m.lairHeader || m.lairActionsDesc || m.lairActions?.header || ''}</textarea>
                <div id="cs-edit-lair-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-lair">+ Add Lair Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-wand-magic-sparkles"></i> Spellcasting Sections</h4>
                    <button class="btn btn-xs btn-secondary" id="cs-edit-add-spellcasting-block"><i class="fa-solid fa-plus"></i> Add Block</button>
                </div>
                <div id="cs-edit-spellcasting-blocks-list" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
        </div>
    `;
    content.innerHTML = html;

    function renderAbilityList(containerId, dataArray) {
        const container = content.querySelector('#' + containerId);
        if (!container) return;
        container.innerHTML = '';
        if (dataArray && Array.isArray(dataArray)) {
            dataArray.forEach((item) => {
                container.appendChild(createAbilityRow(item));
            });
        }
    }

    renderAbilityList('cs-edit-traits-list', m.traits || m.trait);
    renderAbilityList('cs-edit-actions-list', m.actions || m.action);
    renderAbilityList('cs-edit-bonus-list', m.bonusActions || m.bonus);
    renderAbilityList('cs-edit-reactions-list', m.reactions || m.reaction);
    renderAbilityList(
        'cs-edit-legendary-list',
        Array.isArray(m.legendaryActions) ? m.legendaryActions : m.legendaryActions?.entries || m.legendary
    );
    renderAbilityList(
        'cs-edit-lair-list',
        Array.isArray(m.lairActions)
            ? m.lairActions
            : Array.isArray(m.lairActions?.entries)
              ? m.lairActions.entries
              : []
    );

    // Render Spellcasting Blocks in Modal
    function renderModalSpellcastingBlocks() {
        const container = content.querySelector('#cs-edit-spellcasting-blocks-list');
        if (!container) return;
        container.innerHTML = '';
        const blocks = m.spellcasting && Array.isArray(m.spellcasting) ? m.spellcasting : [];
        blocks.forEach((sc, idx) => {
            const card = document.createElement('div');
            card.className = 'cs-edit-sc-card';
            card.style.cssText =
                'display:flex; flex-direction:column; gap:6px; padding:10px; background:var(--color-bg-dark); border-radius:6px; border:1px solid rgba(212,175,55,0.3); margin-bottom:8px;';

            const currentType = resolveSpellcastingType(sc, m);
            const rechargeRule = sc.rechargeRule || (currentType === 'pact' ? 'short_rest' : 'long_rest');
            const abVal = (sc.ability || 'int').toLowerCase();
            const casterLvl = sc.casterLevel !== undefined ? sc.casterLevel : m.casterLevel || 0;

            const initialSections = [];
            if (currentType === 'innate') {
                if (sc.will || sc.atWill || sc.innateObj?.will) {
                    initialSections.push(0);
                }
                const dailyObj = sc.daily || sc.innateObj?.daily || {};
                for (const k in dailyObj) {
                    const num = parseInt(k);
                    if (!isNaN(num) && !initialSections.includes(num)) {
                        initialSections.push(num);
                    }
                }
                initialSections.sort((a, b) => a - b);
                if (initialSections.length === 0) initialSections.push(0);
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <input type="text" class="vtt-input sc-edit-name" value="${sc.name || (currentType === 'innate' ? 'Innate Spellcasting' : 'Spellcasting')}" placeholder="Block Name (e.g. Innate Spellcasting, Fey Heritage)" style="flex:1; font-weight:600; color:var(--color-gold-base);">
                    <button class="btn btn-xxs btn-danger sc-edit-del" title="Delete Block"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:8px;">
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Block Type</label>
                        <select class="vtt-input sc-edit-type" style="width:100%;">
                            <option value="innate" ${currentType === 'innate' ? 'selected' : ''}>Innate / Usage-Based</option>
                            <option value="slot" ${currentType === 'slot' ? 'selected' : ''}>Class / Slot-Based</option>
                            <option value="pact" ${currentType === 'pact' ? 'selected' : ''}>Pact Magic</option>
                            <option value="custom" ${currentType === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Default Rest Rule</label>
                        <select class="vtt-input sc-edit-recharge" style="width:100%;">
                            <option value="long_rest" ${rechargeRule === 'long_rest' ? 'selected' : ''}>Long Rest (Daily)</option>
                            <option value="short_rest" ${rechargeRule === 'short_rest' ? 'selected' : ''}>Short Rest</option>
                            <option value="short_or_long" ${rechargeRule === 'short_or_long' ? 'selected' : ''}>Short or Long Rest</option>
                            <option value="none" ${rechargeRule === 'none' ? 'selected' : ''}>None / Special</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Casting Ability</label>
                        <select class="vtt-input sc-edit-ability" style="width:100%;">
                            <option value="int" ${abVal === 'int' ? 'selected' : ''}>Intelligence</option>
                            <option value="wis" ${abVal === 'wis' ? 'selected' : ''}>Wisdom</option>
                            <option value="cha" ${abVal === 'cha' ? 'selected' : ''}>Charisma</option>
                            <option value="con" ${abVal === 'con' ? 'selected' : ''}>Constitution</option>
                            <option value="str" ${abVal === 'str' ? 'selected' : ''}>Strength</option>
                            <option value="dex" ${abVal === 'dex' ? 'selected' : ''}>Dexterity</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Caster Level</label>
                        <input type="number" class="vtt-input sc-edit-caster-level" value="${casterLvl}" min="0" max="20" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Save DC (Opt)</label>
                        <input type="number" class="vtt-input sc-edit-dc" value="${sc.dc || ''}" placeholder="Auto" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Atk Mod (Opt)</label>
                        <input type="text" class="vtt-input sc-edit-atk-mod" value="${sc.atkMod !== undefined ? sc.atkMod : ''}" placeholder="Auto" style="width:100%;">
                    </div>
                </div>

                <!-- Innate Sections Manager -->
                <div class="sc-edit-innate-box" style="display:${currentType === 'innate' ? 'block' : 'none'}; margin-top:6px; padding:6px; background:rgba(0,0,0,0.2); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:0.75rem; font-weight:600; color:var(--color-gold-base);">Innate Frequency Sections</span>
                        <button type="button" class="btn btn-xxs btn-secondary sc-edit-add-section-btn" style="padding:1px 5px; font-size:0.7rem;"><i class="fa-solid fa-plus"></i> Add Section</button>
                    </div>
                    <div class="sc-edit-sections-list" style="display:flex; flex-direction:column; gap:4px;"></div>
                </div>

                <div class="sc-edit-slot-preview" style="display:${currentType !== 'innate' ? 'block' : 'none'}; font-size:0.75rem; color:var(--color-text-muted); font-style:italic; margin-top:2px;"></div>
            `;

            const typeSelect = card.querySelector('.sc-edit-type');
            const innateBox = card.querySelector('.sc-edit-innate-box');
            const sectionsList = card.querySelector('.sc-edit-sections-list');
            const addSectionBtn = card.querySelector('.sc-edit-add-section-btn');
            const slotPreview = card.querySelector('.sc-edit-slot-preview');
            const casterLvlInput = card.querySelector('.sc-edit-caster-level');

            function updateSlotPreview() {
                const t = typeSelect.value;
                const lvl = parseInt(casterLvlInput.value) || 0;
                if (t === 'innate') {
                    slotPreview.style.display = 'none';
                    return;
                }
                slotPreview.style.display = 'block';
                const slots = get5eSlotsForCaster(t, lvl);
                const desc = Object.entries(slots)
                    .map(([k, v]) => `${k.replace('level', 'L')}: ${v}`)
                    .join(', ');
                slotPreview.textContent = desc ? `Auto-calculated slots: ${desc}` : 'No auto spell slots for level 0.';
            }

            function addSectionRow(usages = 0) {
                const row = document.createElement('div');
                row.className = 'sc-edit-section-row';
                row.style.cssText =
                    'display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);';

                const isAtWill = parseInt(usages) === 0;
                row.innerHTML = `
                    <span style="font-size:0.75rem; color:var(--color-text-muted); width:70px;">Usage Count:</span>
                    <div style="display:flex; align-items:center; gap:6px; flex:1;">
                        <input type="number" class="vtt-input sc-edit-section-counter" value="${usages}" min="0" max="9" style="width:52px; text-align:center; padding:2px 4px; font-weight:bold;">
                        <span class="sc-edit-section-label" style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;">${isAtWill ? 'At Will (0)' : `${usages}/Day`}</span>
                    </div>
                    <button type="button" class="btn btn-xxs btn-danger sc-edit-section-del" title="Remove Section"><i class="fa-solid fa-trash"></i></button>
                `;

                const counterInput = row.querySelector('.sc-edit-section-counter');
                const labelSpan = row.querySelector('.sc-edit-section-label');
                counterInput.addEventListener('input', () => {
                    const val = parseInt(counterInput.value) || 0;
                    labelSpan.textContent = val === 0 ? 'At Will (0)' : `${val}/Day`;
                });

                row.querySelector('.sc-edit-section-del').addEventListener('click', () => row.remove());
                sectionsList.appendChild(row);
            }

            if (currentType === 'innate') {
                initialSections.forEach((u) => addSectionRow(u));
            }

            addSectionBtn.addEventListener('click', () => {
                const currentRows = sectionsList.querySelectorAll('.sc-edit-section-counter');
                const existingUsages = Array.from(currentRows).map((inp) => parseInt(inp.value) || 0);
                if (!existingUsages.includes(0)) {
                    addSectionRow(0);
                } else {
                    let next = 1;
                    while (existingUsages.includes(next) && next < 10) next++;
                    addSectionRow(next);
                }
            });

            typeSelect.addEventListener('change', () => {
                const isNowInnate = typeSelect.value === 'innate';
                innateBox.style.display = isNowInnate ? 'block' : 'none';
                if (isNowInnate && sectionsList.children.length === 0) {
                    addSectionRow(0);
                }
                updateSlotPreview();
            });

            casterLvlInput.addEventListener('input', updateSlotPreview);
            updateSlotPreview();

            card.querySelector('.sc-edit-del').addEventListener('click', () => card.remove());
            container.appendChild(card);
        });
    }
    renderModalSpellcastingBlocks();

    content.querySelector('#cs-edit-add-spellcasting-block').addEventListener('click', () => {
        m.spellcasting = m.spellcasting || [];
        m.spellcasting.push({
            name: 'Innate Spellcasting',
            type: 'innate',
            ability: 'cha',
            casterLevel: 0,
            headerEntries: [],
            will: []
        });
        renderModalSpellcastingBlocks();
    });

    function wireAddBtn(btnId, containerId) {
        content.querySelector('#' + btnId).addEventListener('click', () => {
            const row = createAbilityRow({});
            content.querySelector('#' + containerId).appendChild(row);
        });
    }
    wireAddBtn('cs-edit-add-trait', 'cs-edit-traits-list');
    wireAddBtn('cs-edit-add-action', 'cs-edit-actions-list');
    wireAddBtn('cs-edit-add-bonus', 'cs-edit-bonus-list');
    wireAddBtn('cs-edit-add-reaction', 'cs-edit-reactions-list');
    wireAddBtn('cs-edit-add-legendary', 'cs-edit-legendary-list');
    wireAddBtn('cs-edit-add-lair', 'cs-edit-lair-list');

    function renderCompanionTokenGallery() {
        const gal = content.querySelector('#cs-edit-token-gallery');
        if (!gal) return;
        gal.innerHTML = '';
        if (char.tokenImages.length === 0) {
            gal.innerHTML =
                '<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No custom tokens.</span>';
            return;
        }
        char.tokenImages.forEach((imgObj, idx) => {
            const isActive = char.activeTokenIndex === idx;
            const url = imgObj.url || '';
            const cleanUrl = url.split('?')[0].toLowerCase();
            const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);

            const wrapper = document.createElement('div');
            wrapper.style.cssText = `position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${isActive ? 'var(--color-success-base)' : 'transparent'}; cursor:pointer;`;

            const safeUrl =
                typeof window !== 'undefined' && typeof window.getSafeVttUrl === 'function'
                    ? window.getSafeVttUrl(url)
                    : url && (url.includes('discordapp.com') || url.includes('discordapp.net'))
                      ? '/api/proxy-discord?url=' + encodeURIComponent(url)
                      : url;
            let mediaEl;
            if (isVideo) {
                mediaEl = document.createElement('video');
                mediaEl.src = safeUrl;
                mediaEl.muted = true;
                mediaEl.loop = true;
                mediaEl.autoplay = true;
                mediaEl.playsInline = true;
                mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            } else {
                mediaEl = document.createElement('img');
                mediaEl.src = safeUrl;
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
                const deletedToken = char.tokenImages[idx];
                if (
                    deletedToken?.isDefault ||
                    (defaultTokenUrl &&
                        (typeof deletedToken === 'string' ? deletedToken : deletedToken?.url) === defaultTokenUrl)
                ) {
                    char.defaultTokenDeleted = true;
                }
                char.tokenImages.splice(idx, 1);
                if (char.activeTokenIndex >= char.tokenImages.length) {
                    char.activeTokenIndex = Math.max(0, char.tokenImages.length - 1);
                } else if (char.activeTokenIndex > idx) {
                    char.activeTokenIndex--;
                }
                renderCompanionTokenGallery();
            });

            gal.appendChild(wrapper);
            if (isVideo) mediaEl.play().catch(() => {});
        });
    }
    renderCompanionTokenGallery();

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
                alert('Upload failed.');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            uploadBtn.innerHTML = origHtml;
            uploadBtn.disabled = false;
            e.target.value = '';
        }
    });

    const typeSelect = content.querySelector('#cs-edit-type-select');
    const typeCustomInput = content.querySelector('#cs-edit-type-custom');
    typeSelect.addEventListener('change', () => {
        typeCustomInput.style.display = typeSelect.value === 'custom' ? 'block' : 'none';
    });

    const alignSelect = content.querySelector('#cs-edit-align-select');
    const alignCustomInput = content.querySelector('#cs-edit-align-custom');
    alignSelect.addEventListener('change', () => {
        alignCustomInput.style.display = alignSelect.value === 'custom' ? 'block' : 'none';
    });

    const getSnapshot = () =>
        JSON.stringify(
            Array.from(content.querySelectorAll('input, select, textarea')).map((el) =>
                el.type === 'checkbox' ? el.checked : el.value
            )
        );
    const initialSnapshot = getSnapshot();

    const closeEditModal = (force = false) => {
        if (!force && getSnapshot() !== initialSnapshot) {
            if (!confirm('Discard unsaved changes?')) return;
        }
        if (typeof window !== 'undefined') window.removeEventListener('keydown', onEsc);
        overlay.remove();
    };

    const onEsc = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            closeEditModal(false);
        }
    };
    if (typeof window !== 'undefined') window.addEventListener('keydown', onEsc);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeEditModal(false);
        }
    });

    const manageDefensesBtn = content.querySelector('#cs-btn-manage-defenses');
    if (manageDefensesBtn) {
        manageDefensesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCreatureDefenseConfigModal(currentEditDefenses, (updated) => {
                currentEditDefenses = updated;
                const resInput = content.querySelector('#cs-edit-resist');
                if (resInput) resInput.value = formatDamageList(editableRowsToDefenses(currentEditDefenses.resist));
                const immInput = content.querySelector('#cs-edit-immune');
                if (immInput) immInput.value = formatDamageList(editableRowsToDefenses(currentEditDefenses.immune));
                const vulInput = content.querySelector('#cs-edit-vuln');
                if (vulInput) vulInput.value = formatDamageList(editableRowsToDefenses(currentEditDefenses.vulnerable));
            });
        });
    }

    overlay.querySelector('#cs-edit-cancel-btn').onclick = () => closeEditModal(false);
    overlay.querySelector('#cs-edit-save-btn').onclick = () => {
        if (typeof window !== 'undefined') window.removeEventListener('keydown', onEsc);
        saveCompanionEdits(m, charId, ctx);
    };
}

export function saveCompanionEdits(m, charId = null, ctx = {}) {
    const targetCharId = charId || currentEditCharId;
    if (!targetCharId) return;
    const vtt = ctx.getVtt ? ctx.getVtt() : typeof window !== 'undefined' ? window.VTT : null;
    const char = vtt?.campaignState?.characters?.[targetCharId];
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

    // Classification & Info
    const newSize = content.querySelector('#cs-edit-size').value;
    m.size = [newSize];

    const typeSel = content.querySelector('#cs-edit-type-select').value;
    const typeCustom = content.querySelector('#cs-edit-type-custom').value.trim();
    const tagsRaw = content.querySelector('#cs-edit-tags').value.trim();

    let finalTypeStr = typeSel === 'custom' ? typeCustom || 'humanoid' : typeSel;
    let tagsArr = tagsRaw
        ? tagsRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : [];

    if (tagsArr.length > 0) {
        m.type = { type: finalTypeStr, tags: tagsArr };
    } else {
        m.type = finalTypeStr;
    }

    const alignSel = content.querySelector('#cs-edit-align-select').value;
    const alignCustom = content.querySelector('#cs-edit-align-custom').value.trim();
    if (alignSel === 'custom') {
        m.alignment = alignCustom ? [alignCustom] : ['U'];
    } else if (alignSel === 'LG') m.alignment = ['L', 'G'];
    else if (alignSel === 'NG') m.alignment = ['N', 'G'];
    else if (alignSel === 'CG') m.alignment = ['C', 'G'];
    else if (alignSel === 'LN') m.alignment = ['L', 'N'];
    else if (alignSel === 'N') m.alignment = ['N'];
    else if (alignSel === 'CN') m.alignment = ['C', 'N'];
    else if (alignSel === 'LE') m.alignment = ['L', 'E'];
    else if (alignSel === 'NE') m.alignment = ['N', 'E'];
    else if (alignSel === 'CE') m.alignment = ['C', 'E'];
    else if (alignSel === 'U') m.alignment = ['U'];
    else if (alignSel === 'A') m.alignment = ['A'];

    char.ac = newAc;
    char.primaryAc = newAc;
    m.primaryAc = newAc;
    if (Array.isArray(m.ac)) {
        if (typeof m.ac[0] === 'object' && m.ac[0] !== null) {
            m.ac[0].value = newAc;
            m.ac[0].ac = newAc;
        } else {
            m.ac = [{ value: newAc, ac: newAc }];
        }
    } else if (typeof m.ac === 'object' && m.ac !== null) {
        m.ac.value = newAc;
        m.ac.ac = newAc;
    } else {
        m.ac = [{ value: newAc, ac: newAc }];
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
    content.querySelectorAll('.cs-edit-stat').forEach((input) => {
        const stat = input.dataset.stat;
        m[stat] = parseInt(input.value) || 10;
    });

    // Speeds
    const walkInput = content.querySelector('#cs-edit-speed-walk');
    const flyInput = content.querySelector('#cs-edit-speed-fly');
    const swimInput = content.querySelector('#cs-edit-speed-swim');
    const climbInput = content.querySelector('#cs-edit-speed-climb');
    const burrowInput = content.querySelector('#cs-edit-speed-burrow');
    const hoverInput = content.querySelector('#cs-edit-speed-hover');

    if (walkInput || flyInput || swimInput || climbInput || burrowInput) {
        const walkVal = walkInput ? parseInt(walkInput.value) : 30;
        const flyVal = flyInput ? parseInt(flyInput.value) : 0;
        const swimVal = swimInput ? parseInt(swimInput.value) : 0;
        const climbVal = climbInput ? parseInt(climbInput.value) : 0;
        const burrowVal = burrowInput ? parseInt(burrowInput.value) : 0;
        const canHover = hoverInput ? hoverInput.checked : false;

        const newSpeed = {
            walk: isNaN(walkVal) ? 30 : walkVal
        };
        if (!isNaN(flyVal) && flyVal > 0) newSpeed.fly = flyVal;
        if (!isNaN(swimVal) && swimVal > 0) newSpeed.swim = swimVal;
        if (!isNaN(climbVal) && climbVal > 0) newSpeed.climb = climbVal;
        if (!isNaN(burrowVal) && burrowVal > 0) newSpeed.burrow = burrowVal;
        if (canHover) newSpeed.canHover = true;

        m.speed = newSpeed;
        char.speed = newSpeed;
    }

    // Defenses & Info
    if (currentEditDefenses) {
        const immuneStr = content.querySelector('#cs-edit-immune').value.trim();
        const compiledImm = editableRowsToDefenses(currentEditDefenses.immune);
        if (immuneStr === '') {
            delete m.immune;
        } else if (immuneStr === formatDamageList(compiledImm)) {
            m.immune = compiledImm.length > 0 ? compiledImm : undefined;
            if (!m.immune) delete m.immune;
        } else {
            m.immune = parseDefenseTextInput(immuneStr, compiledImm);
            if (!m.immune || m.immune.length === 0) delete m.immune;
        }

        const resistStr = content.querySelector('#cs-edit-resist').value.trim();
        const compiledRes = editableRowsToDefenses(currentEditDefenses.resist);
        if (resistStr === '') {
            delete m.resist;
        } else if (resistStr === formatDamageList(compiledRes)) {
            m.resist = compiledRes.length > 0 ? compiledRes : undefined;
            if (!m.resist) delete m.resist;
        } else {
            m.resist = parseDefenseTextInput(resistStr, compiledRes);
            if (!m.resist || m.resist.length === 0) delete m.resist;
        }

        const vulnStr = content.querySelector('#cs-edit-vuln').value.trim();
        const compiledVuln = editableRowsToDefenses(currentEditDefenses.vulnerable);
        if (vulnStr === '') {
            delete m.vulnerable;
        } else if (vulnStr === formatDamageList(compiledVuln)) {
            m.vulnerable = compiledVuln.length > 0 ? compiledVuln : undefined;
            if (!m.vulnerable) delete m.vulnerable;
        } else {
            m.vulnerable = parseDefenseTextInput(vulnStr, compiledVuln);
            if (!m.vulnerable || m.vulnerable.length === 0) delete m.vulnerable;
        }
    }

    const condStr = content.querySelector('#cs-edit-cond').value.trim();
    if (condStr) m.conditionImmune = condStr.split(',').map((s) => s.trim());
    else delete m.conditionImmune;

    const sensesStr = content.querySelector('#cs-edit-senses').value.trim();
    if (sensesStr) {
        m.senses = sensesStr.split(',').map((s) => s.trim());

        let maxSight = 0;
        if (typeof window !== 'undefined' && window.parseMonsterVision) {
            maxSight = window.parseMonsterVision({ senses: m.senses });
        } else {
            const sightMatches = sensesStr.match(
                /(?:darkvision|blindsight|truesight|tremorsense|devil(?:'s)?\s*sight)\s*(\d+)/gi
            );
            if (sightMatches) {
                sightMatches.forEach((sm) => {
                    const num = parseInt(sm.match(/\d+/)?.[0] || 0);
                    if (num > maxSight) maxSight = num;
                });
            }
        }
        char.tokenSight = maxSight > 0 ? maxSight : 5;
    } else {
        delete m.senses;
        char.tokenSight = 5;
    }

    const langStr = content.querySelector('#cs-edit-lang').value.trim();
    if (langStr) m.languages = langStr.split(',').map((s) => s.trim());
    else delete m.languages;

    // Saves
    const newSaves = {};
    content.querySelectorAll('.cs-edit-save').forEach((input) => {
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

    function extractAbilityList(containerId) {
        const rows = content.querySelectorAll('#' + containerId + ' > div');
        const arr = [];
        rows.forEach((r) => {
            const name = r.querySelector('.edit-ab-name')?.value.trim() || '';
            const desc = r.querySelector('.edit-ab-desc')?.value.trim() || '';
            const atkRaw = r.querySelector('.edit-ab-atk')?.value.trim() || '';
            const dcRaw = r.querySelector('.edit-ab-dc')?.value.trim() || '';
            const saveAb = r.querySelector('.edit-ab-save-ab')?.value.trim() || 'dex';

            const dmgRows = r.querySelectorAll('.edit-ab-dmg-row');
            const damages = [];
            dmgRows.forEach((dr) => {
                const formula = dr.querySelector('.edit-ab-dmg-formula')?.value.trim();
                const rawType = dr.querySelector('.edit-ab-dmg-type')?.value.trim() || 'Slashing';
                const isRider = dr.querySelector('.edit-ab-dmg-rider')?.checked || false;
                const type =
                    STANDARD_DAMAGE_TYPES.find((dt) => dt.toLowerCase() === rawType.toLowerCase()) ||
                    rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
                if (formula) {
                    damages.push({ formula, type, saveRider: isRider });
                }
            });

            const isMagic = r.querySelector('.edit-ab-is-magic')?.checked || false;
            const isSilvered = r.querySelector('.edit-ab-is-silvered')?.checked || false;
            const isAdamantine = r.querySelector('.edit-ab-is-adamantine')?.checked || false;

            if (name || desc || atkRaw || dcRaw || damages.length > 0 || isMagic || isSilvered || isAdamantine) {
                const abilityItem = {
                    name: name,
                    entries: desc ? desc.split('\n') : []
                };

                const macro = {};
                let hasMacro = false;

                const atkNum = atkRaw !== '' ? parseInt(atkRaw.replace(/^\+/, '')) : NaN;
                if (!isNaN(atkNum)) {
                    macro.isAttack = true;
                    macro.attackBonus = atkNum;
                    hasMacro = true;
                }

                const dcNum = dcRaw !== '' ? parseInt(dcRaw) : NaN;
                if (!isNaN(dcNum)) {
                    macro.save = {
                        dc: dcNum,
                        ability: saveAb.toLowerCase()
                    };
                    hasMacro = true;
                }

                if (damages.length > 0) {
                    macro.damages = damages;
                    hasMacro = true;
                }

                if (hasMacro || isMagic || isSilvered || isAdamantine) {
                    macro.isMagic = isMagic;
                    macro.isSilvered = isSilvered;
                    macro.isAdamantine = isAdamantine;
                    hasMacro = true;
                }

                if (hasMacro) {
                    abilityItem.macro = macro;
                }

                arr.push(abilityItem);
            }
        });
        return arr.length > 0 ? arr : undefined;
    }

    const newTraits = extractAbilityList('cs-edit-traits-list');
    if (newTraits) m.traits = newTraits;
    else delete m.traits;
    delete m.trait;

    const newActions = extractAbilityList('cs-edit-actions-list');
    if (newActions) m.actions = newActions;
    else delete m.actions;
    delete m.action;

    const newBonus = extractAbilityList('cs-edit-bonus-list');
    if (newBonus) m.bonusActions = newBonus;
    else delete m.bonusActions;
    delete m.bonus;

    const newReactions = extractAbilityList('cs-edit-reactions-list');
    if (newReactions) m.reactions = newReactions;
    else delete m.reactions;
    delete m.reaction;

    const legDesc = content.querySelector('#cs-edit-legendary-desc').value.trim();
    const newLegendary = extractAbilityList('cs-edit-legendary-list');
    if (newLegendary || legDesc) {
        m.legendaryActions = { description: legDesc, entries: newLegendary || [] };
    } else {
        delete m.legendaryActions;
    }
    delete m.legendary;

    const lairDesc = content.querySelector('#cs-edit-lair-desc').value.trim();
    const newLair = extractAbilityList('cs-edit-lair-list');
    if (newLair && newLair.length > 0) {
        m.lairActions = newLair;
        if (lairDesc) {
            m.lairActionsDesc = lairDesc;
            m.lairHeader = lairDesc;
        } else {
            delete m.lairActionsDesc;
            delete m.lairHeader;
        }
    } else {
        delete m.lairActions;
        delete m.lairActionsDesc;
        delete m.lairHeader;
    }

    // Extract Spellcasting Blocks
    const scCards = content.querySelectorAll('#cs-edit-spellcasting-blocks-list .cs-edit-sc-card');
    const newSpellcasting = [];
    scCards.forEach((card, idx) => {
        const scName = card.querySelector('.sc-edit-name').value.trim() || 'Spellcasting';
        const scType = card.querySelector('.sc-edit-type').value;
        const scRecharge = card.querySelector('.sc-edit-recharge').value;
        const abStat = card.querySelector('.sc-edit-ability').value;
        const casterLvlVal = parseInt(card.querySelector('.sc-edit-caster-level').value) || 0;
        const dcRaw = card.querySelector('.sc-edit-dc').value.trim();
        const atkRaw = card.querySelector('.sc-edit-atk-mod').value.trim();

        const existingBlock = m.spellcasting && m.spellcasting[idx] ? m.spellcasting[idx] : {};
        const block = {
            id: existingBlock.id || `sc_${idx}`,
            name: scName,
            type: scType,
            rechargeRule: scRecharge,
            ability: abStat,
            casterLevel: casterLvlVal,
            headerEntries: existingBlock.headerEntries || []
        };

        if (scType === 'slot' || scType === 'pact') {
            block.spellsByLevel = existingBlock.spellsByLevel || {};
            block.spellsObj = existingBlock.spellsObj || {};
        } else if (scType === 'innate') {
            block.will = [];
            block.daily = {};

            const sectionRows = card.querySelectorAll('.sc-edit-section-row');
            sectionRows.forEach((sr) => {
                const countVal = parseInt(sr.querySelector('.sc-edit-section-counter').value) || 0;
                if (countVal === 0) {
                    block.will = existingBlock.will || existingBlock.innateObj?.will || [];
                } else {
                    const k = countVal.toString();
                    block.daily[k] =
                        (existingBlock.daily && existingBlock.daily[k]) ||
                        (existingBlock.innateObj?.daily && existingBlock.innateObj.daily[k]) ||
                        [];
                }
            });

            block.innateObj = {
                will: block.will,
                daily: block.daily
            };
        }

        if (dcRaw !== '') block.dc = parseInt(dcRaw) || undefined;
        else delete block.dc;
        if (atkRaw !== '') block.atkMod = parseInt(atkRaw) || undefined;
        else delete block.atkMod;
        if (idx === 0) m.casterLevel = casterLvlVal;
        newSpellcasting.push(block);
    });
    m.spellcasting = newSpellcasting;
    m.spells = null;

    char.monsterData = m;

    if (vtt && vtt.socket) {
        vtt.socket.emit('character:update', { character: char });
    }

    if (vtt?.canvasEngine) {
        const tokens = vtt.canvasEngine.getTokens();
        let changed = false;
        Object.values(tokens).forEach((t) => {
            if (t.characterId === char.id || (t.name === char.name && !t.isPlayer)) {
                if (char.tokenSight !== undefined) {
                    t.sightRange = char.tokenSight;
                    changed = true;
                }
            }
        });
        if (changed) {
            const curMapId = vtt.canvasEngine.getCurrentMapId();
            if (curMapId && vtt.socket) {
                Object.values(tokens).forEach((t) => {
                    if (t.characterId === char.id || (t.name === char.name && !t.isPlayer)) {
                        vtt.socket.emit('token:update', { mapId: curMapId, token: t });
                    }
                });
            }
            vtt.canvasEngine.renderAll();
        }
    }

    if (overlay) overlay.remove();
    if (ctx.renderStatBlock) ctx.renderStatBlock(m);
    if (ctx.saveAndRenderNpcSpells) ctx.saveAndRenderNpcSpells(m);
}
