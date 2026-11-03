/**
 * Player Sheet Settings Modals:
 * 1. Stat & Save Settings & Toggles
 * 2. Skill Proficiencies, Modifiers & Toggles
 * 3. Tool Proficiencies & Custom Tools
 */

import { ALL_SKILLS, STANDARD_TOOLS } from '../vtt-sheet-modals.js';
import { calculateEffectiveHp, calculateEffectiveAc } from '../calc/stats.js';

// ─── 1. STAT & SAVE SETTINGS ──────────────────────────────────────────────────

export function renderSaveTogglesList(char, options = {}) {
    const list = document.getElementById('modal-save-toggles-list');
    if (!list) return;
    if (!char || !char.saveToggles) return;

    let html = '';
    char.saveToggles.forEach((t, i) => {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="save-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                    <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                    <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${(t.target || 'ALL').toUpperCase()}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary save-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary save-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;

    list.querySelectorAll('.save-toggle-enable-cb').forEach((cb) =>
        cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.saveToggles[idx].enabled = e.currentTarget.checked;
        })
    );

    list.querySelectorAll('.save-toggle-edit-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.saveToggles[idx];
            const idxEl = document.getElementById('modal-save-toggle-idx');
            const nameEl = document.getElementById('modal-save-toggle-name');
            const formulaEl = document.getElementById('modal-save-toggle-formula');
            const targetEl = document.getElementById('modal-save-toggle-target');
            if (idxEl) idxEl.value = idx;
            if (nameEl) nameEl.value = t.name;
            if (formulaEl) formulaEl.value = t.formula;
            if (targetEl) targetEl.value = t.target;
            document.getElementById('modal-save-toggle-form')?.classList.remove('vtt-hidden');
            document.getElementById('btn-add-save-toggle')?.classList.add('vtt-hidden');
        })
    );

    list.querySelectorAll('.save-toggle-del-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            if (confirm('Delete this toggle?')) {
                const idx = e.currentTarget.dataset.idx;
                char.saveToggles.splice(idx, 1);
                renderSaveTogglesList(char, options);
            }
        })
    );
}

export function setupSaveSettingsListeners(options = {}) {
    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    const closeSaveSettings = () => {
        document.getElementById('pc-save-settings-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-save-settings-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('modal-save-settings-close')?.addEventListener('click', closeSaveSettings);
    document.getElementById('pc-save-settings-overlay')?.addEventListener('click', closeSaveSettings);

    document.getElementById('btn-add-save-toggle')?.addEventListener('click', () => {
        const idxEl = document.getElementById('modal-save-toggle-idx');
        const nameEl = document.getElementById('modal-save-toggle-name');
        const formulaEl = document.getElementById('modal-save-toggle-formula');
        const targetEl = document.getElementById('modal-save-toggle-target');
        if (idxEl) idxEl.value = '-1';
        if (nameEl) nameEl.value = '';
        if (formulaEl) formulaEl.value = '';
        if (targetEl) targetEl.value = 'all';
        document.getElementById('modal-save-toggle-form')?.classList.remove('vtt-hidden');
        document.getElementById('btn-add-save-toggle')?.classList.add('vtt-hidden');
    });

    document.getElementById('modal-save-toggle-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-save-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-save-toggle')?.classList.remove('vtt-hidden');
    });

    document.getElementById('modal-save-toggle-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        if (!currentChar.saveToggles) currentChar.saveToggles = [];

        const idx = parseInt(document.getElementById('modal-save-toggle-idx')?.value || '-1');
        const name = document.getElementById('modal-save-toggle-name')?.value.trim();
        const formula = document.getElementById('modal-save-toggle-formula')?.value.trim();
        const target = document.getElementById('modal-save-toggle-target')?.value || 'all';
        if (!name || !formula) return alert('Name and Formula are required.');

        const t = { id: 'stgl_' + Date.now(), name, formula, target, enabled: true };
        if (idx >= 0) {
            currentChar.saveToggles[idx] = t;
        } else {
            currentChar.saveToggles.push(t);
        }
        document.getElementById('modal-save-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-save-toggle')?.classList.remove('vtt-hidden');
        renderSaveTogglesList(currentChar, options);
    });

    document.getElementById('modal-save-settings-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;

        currentChar.globalSaveMod = parseInt(document.getElementById('modal-save-global-mod')?.value) || 0;
        currentChar.saves = currentChar.saves || {};
        currentChar.saveMods = currentChar.saveMods || {};
        currentChar.stats = currentChar.stats || {};
        currentChar.statMods = currentChar.statMods || {};

        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((ab) => {
            const cb = document.getElementById(`modal-save-prof-${ab}`);
            const inp = document.getElementById(`modal-save-mod-${ab}`);
            if (cb) currentChar.saves[ab] = cb.checked;
            if (inp) currentChar.saveMods[ab] = parseInt(inp.value) || 0;

            const baseInp = document.getElementById(`modal-stat-base-${ab}`);
            const tempInp = document.getElementById(`modal-stat-mod-${ab}`);
            if (baseInp) currentChar.stats[ab] = parseInt(baseInp.value) || 10;
            if (tempInp) currentChar.statMods[ab] = parseInt(tempInp.value) || 0;
        });

        saveAndEmit(currentChar);
        renderSheetData(currentChar);
        closeSaveSettings();
    });
}

export function ensureSaveSettingsModalExists(options = {}) {
    if (document.getElementById('pc-save-settings-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-save-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-save-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:500px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Stat & Save Settings</h3>
                <button id="modal-save-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label>Global Save Modifier</label>
                    <input type="number" id="modal-save-global-mod" value="0" style="width:100%;">
                </div>
                
                <div>
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Ability Scores & Temp Mods</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                        ${['str', 'dex', 'con', 'int', 'wis', 'cha']
                            .map(
                                (ab) => `
                            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                <div style="font-weight:600; font-size:0.85rem;">${ab.toUpperCase()}</div>
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <input type="text" inputmode="numeric" id="modal-stat-base-${ab}" value="10" style="width:48px; padding:2px; box-sizing:border-box; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" title="Base Stat">
                                    <span style="color:var(--color-text-muted); font-size:0.8rem;">+</span>
                                    <input type="text" inputmode="numeric" id="modal-stat-mod-${ab}" value="0" style="width:48px; padding:2px; box-sizing:border-box; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" title="Temp Mod">
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Ability Save Proficiencies & Mods</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        ${['str', 'dex', 'con', 'int', 'wis', 'cha']
                            .map(
                                (ab) => `
                            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <input type="checkbox" id="modal-save-prof-${ab}" style="cursor:pointer;">
                                    <label style="margin:0; font-weight:600; font-size:0.85rem;" for="modal-save-prof-${ab}">${ab.toUpperCase()} Save</label>
                                </div>
                                <input type="number" id="modal-save-mod-${ab}" value="0" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">Save Toggles</h4>
                        <button id="btn-add-save-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-save-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-save-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-save-toggle-name" placeholder="Name (e.g. Bless)" style="flex:2;">
                            <input type="text" id="modal-save-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1;">
                            <select id="modal-save-toggle-target" style="flex:1;">
                                <option value="all">All Saves</option>
                                <option value="str">STR Save</option>
                                <option value="dex">DEX Save</option>
                                <option value="con">CON Save</option>
                                <option value="int">INT Save</option>
                                <option value="wis">WIS Save</option>
                                <option value="cha">CHA Save</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-save-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-save-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-save-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Save Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-save-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    setupSaveSettingsListeners(options);
}

export function openSaveSettingsModal(char, options = {}) {
    ensureSaveSettingsModalExists(options);
    if (!char) return;

    const globalModEl = document.getElementById('modal-save-global-mod');
    if (globalModEl) globalModEl.value = char.globalSaveMod || 0;

    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((ab) => {
        const cb = document.getElementById(`modal-save-prof-${ab}`);
        const inp = document.getElementById(`modal-save-mod-${ab}`);
        if (cb) cb.checked = !!(char.saves && char.saves[ab]);
        if (inp) inp.value = (char.saveMods && char.saveMods[ab]) || 0;

        const baseInp = document.getElementById(`modal-stat-base-${ab}`);
        const tempInp = document.getElementById(`modal-stat-mod-${ab}`);
        if (baseInp) baseInp.value = (char.stats && char.stats[ab]) || 10;
        if (tempInp) tempInp.value = (char.statMods && char.statMods[ab]) || 0;
    });

    renderSaveTogglesList(char, options);
    document.getElementById('pc-save-settings-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-save-settings-overlay')?.classList.remove('vtt-hidden');
}

// ─── 2. SKILL SETTINGS ────────────────────────────────────────────────────────

export function renderSkillTogglesList(char, options = {}) {
    const list = document.getElementById('modal-skill-toggles-list');
    if (!list) return;
    if (!char || !char.skillToggles) return;

    let html = '';
    char.skillToggles.forEach((t, i) => {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="skill-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                    <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                    <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${(t.target || 'ALL').toUpperCase()}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary skill-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary skill-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;

    list.querySelectorAll('.skill-toggle-enable-cb').forEach((cb) =>
        cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.skillToggles[idx].enabled = e.currentTarget.checked;
        })
    );

    list.querySelectorAll('.skill-toggle-edit-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.skillToggles[idx];
            const idxEl = document.getElementById('modal-skill-toggle-idx');
            const nameEl = document.getElementById('modal-skill-toggle-name');
            const formulaEl = document.getElementById('modal-skill-toggle-formula');
            const targetEl = document.getElementById('modal-skill-toggle-target');
            if (idxEl) idxEl.value = idx;
            if (nameEl) nameEl.value = t.name;
            if (formulaEl) formulaEl.value = t.formula;
            if (targetEl) targetEl.value = t.target;
            document.getElementById('modal-skill-toggle-form')?.classList.remove('vtt-hidden');
            document.getElementById('btn-add-skill-toggle')?.classList.add('vtt-hidden');
        })
    );

    list.querySelectorAll('.skill-toggle-del-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            if (confirm('Delete this toggle?')) {
                const idx = e.currentTarget.dataset.idx;
                char.skillToggles.splice(idx, 1);
                renderSkillTogglesList(char, options);
            }
        })
    );
}

export function setupSkillSettingsListeners(options = {}) {
    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    const closeSkillSettings = () => {
        document.getElementById('pc-skill-settings-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-skill-settings-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('modal-skill-settings-close')?.addEventListener('click', closeSkillSettings);
    document.getElementById('pc-skill-settings-overlay')?.addEventListener('click', closeSkillSettings);

    document.getElementById('btn-add-skill-toggle')?.addEventListener('click', () => {
        const idxEl = document.getElementById('modal-skill-toggle-idx');
        const nameEl = document.getElementById('modal-skill-toggle-name');
        const formulaEl = document.getElementById('modal-skill-toggle-formula');
        const targetEl = document.getElementById('modal-skill-toggle-target');
        if (idxEl) idxEl.value = '-1';
        if (nameEl) nameEl.value = '';
        if (formulaEl) formulaEl.value = '';
        if (targetEl) targetEl.value = 'all';
        document.getElementById('modal-skill-toggle-form')?.classList.remove('vtt-hidden');
        document.getElementById('btn-add-skill-toggle')?.classList.add('vtt-hidden');
    });

    document.getElementById('modal-skill-toggle-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-skill-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-skill-toggle')?.classList.remove('vtt-hidden');
    });

    document.getElementById('modal-skill-toggle-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        if (!currentChar.skillToggles) currentChar.skillToggles = [];

        const idx = parseInt(document.getElementById('modal-skill-toggle-idx')?.value || '-1');
        const name = document.getElementById('modal-skill-toggle-name')?.value.trim();
        const formula = document.getElementById('modal-skill-toggle-formula')?.value.trim();
        const target = document.getElementById('modal-skill-toggle-target')?.value || 'all';
        if (!name || !formula) return alert('Name and Formula are required.');

        const t = { id: 'sktgl_' + Date.now(), name, formula, target, enabled: true };
        if (idx >= 0) {
            currentChar.skillToggles[idx] = t;
        } else {
            currentChar.skillToggles.push(t);
        }
        document.getElementById('modal-skill-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-skill-toggle')?.classList.remove('vtt-hidden');
        renderSkillTogglesList(currentChar, options);
    });

    document.getElementById('modal-skill-settings-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;

        currentChar.globalAbilityMod = document.getElementById('modal-skill-global-mod')?.value.trim() || '0';
        currentChar.skills = currentChar.skills || {};
        currentChar.expertise = currentChar.expertise || {};
        currentChar.skillMods = currentChar.skillMods || {};
        currentChar.passiveSkillMods = currentChar.passiveSkillMods || {};

        ALL_SKILLS.forEach((skill) => {
            const sName = skill.name;
            const idSafe = sName.replace(/ /g, '_');
            const pCb = document.getElementById(`modal-skill-prof-${idSafe}`);
            const eCb = document.getElementById(`modal-skill-exp-${idSafe}`);
            const inp = document.getElementById(`modal-skill-mod-${idSafe}`);
            const passInp = document.getElementById(`modal-skill-passive-${idSafe}`);
            if (pCb) currentChar.skills[sName] = pCb.checked;
            if (eCb) currentChar.expertise[sName] = eCb.checked;
            if (inp) currentChar.skillMods[sName] = inp.value.trim() || '0';
            if (passInp) currentChar.passiveSkillMods[sName] = passInp.value.trim() || '0';
        });

        saveAndEmit(currentChar);
        renderSheetData(currentChar);
        closeSkillSettings();
    });
}

export function ensureSkillSettingsModalExists(options = {}) {
    if (document.getElementById('pc-skill-settings-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-skill-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-skill-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:640px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Skill Settings & Toggles</h3>
                <button id="modal-skill-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label>Global Ability Modifier (e.g. +1d4)</label>
                    <input type="text" id="modal-skill-global-mod" placeholder="0" style="width:100%;">
                </div>
                
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">Skill Proficiencies & Modifiers</h4>
                        <div style="font-size:0.72rem; color:var(--color-text-muted); display:flex; gap:16px;">
                            <span><strong>Mod:</strong> Active Roll</span>
                            <span><strong style="color:var(--color-gold-light);">Pass:</strong> Passive Score</span>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        ${ALL_SKILLS.map((skill) => {
                            const idSafe = skill.name.replace(/ /g, '_');
                            return `
                                <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.25); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle); gap:6px;">
                                    <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0; overflow:hidden;">
                                        <input type="checkbox" id="modal-skill-prof-${idSafe}" title="Proficient" style="cursor:pointer; accent-color:var(--color-gold-base);">
                                        <input type="checkbox" id="modal-skill-exp-${idSafe}" title="Expertise" style="cursor:pointer; accent-color:var(--color-gold-light); border-radius:50%;">
                                        <label style="margin:0; font-weight:600; font-size:0.8rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" for="modal-skill-prof-${idSafe}">${skill.name}</label>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <input type="text" id="modal-skill-mod-${idSafe}" value="0" style="width:36px; text-align:center; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:3px; color:var(--color-text-primary);" placeholder="Mod" title="Active Roll Modifier">
                                        <input type="text" id="modal-skill-passive-${idSafe}" value="0" style="width:36px; text-align:center; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:3px; color:var(--color-gold-light);" placeholder="Pass" title="Passive Score Modifier (e.g. +5 Observant)">
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">Skill Toggles</h4>
                        <button id="btn-add-skill-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-skill-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-skill-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-skill-toggle-name" placeholder="Name (e.g. Guidance)" style="flex:2;">
                            <input type="text" id="modal-skill-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1;">
                        </div>
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <select id="modal-skill-toggle-target" style="flex:1; width:100%; background-color:#222222; color:#fff; border:1px solid var(--color-border-subtle); padding:4px; border-radius:4px;">
                                <option value="all">All Skills</option>
                                <option value="initiative">Initiative</option>
                                <option value="passive_perception">Passive Perception</option>
                                <option value="passive_investigation">Passive Investigation</option>
                                <option value="passive_insight">Passive Insight</option>
                                <option value="passive_all">All Passive Scores</option>
                                ${ALL_SKILLS.map((s) => `<option value="${s.name}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-skill-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-skill-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-skill-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Skill Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-skill-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    setupSkillSettingsListeners(options);
}

export function openSkillSettingsModal(char, options = {}) {
    ensureSkillSettingsModalExists(options);
    if (!char) return;

    const globalModEl = document.getElementById('modal-skill-global-mod');
    if (globalModEl) globalModEl.value = char.globalAbilityMod || '0';

    ALL_SKILLS.forEach((skill) => {
        const sName = skill.name;
        const idSafe = sName.replace(/ /g, '_');
        const pCb = document.getElementById(`modal-skill-prof-${idSafe}`);
        const eCb = document.getElementById(`modal-skill-exp-${idSafe}`);
        const inp = document.getElementById(`modal-skill-mod-${idSafe}`);
        const passInp = document.getElementById(`modal-skill-passive-${idSafe}`);
        if (pCb) pCb.checked = !!(char.skills && char.skills[sName]);
        if (eCb) eCb.checked = !!(char.expertise && char.expertise[sName]);
        if (inp) inp.value = (char.skillMods && char.skillMods[sName]) || '0';
        if (passInp) passInp.value = (char.passiveSkillMods && char.passiveSkillMods[sName]) || '0';
    });

    renderSkillTogglesList(char, options);
    document.getElementById('pc-skill-settings-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-skill-settings-overlay')?.classList.remove('vtt-hidden');
}

// ─── 3. TOOL SETTINGS ─────────────────────────────────────────────────────────

export function ensureToolSettingsModalExists(options = {}) {
    if (document.getElementById('pc-tool-settings-modal')) return;

    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-tool-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-tool-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:650px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Tool Settings</h3>
                <button id="modal-tool-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div>
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Configured Tools</h4>
                    <div id="modal-tool-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Tool inputs injected here -->
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <button id="btn-add-custom-tool" class="btn btn-sm btn-secondary"><i class="fa-solid fa-plus"></i> Add Custom Tool</button>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-tool-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    const closeToolSettings = () => {
        document.getElementById('pc-tool-settings-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-tool-settings-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('modal-tool-settings-close')?.addEventListener('click', closeToolSettings);
    document.getElementById('pc-tool-settings-overlay')?.addEventListener('click', closeToolSettings);

    document.getElementById('btn-add-custom-tool')?.addEventListener('click', () => {
        const list = document.getElementById('modal-tool-toggles-list');
        if (!list) return;
        const idSafe = 'custom_tool_' + Date.now();
        const div = document.createElement('div');
        div.className = 'tool-settings-row';
        div.dataset.key = idSafe;
        div.dataset.custom = 'true';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';
        div.style.background = 'rgba(0,0,0,0.2)';
        div.style.padding = '6px';
        div.style.borderRadius = '4px';
        div.style.border = '1px solid var(--color-border-subtle)';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="checkbox" class="tool-show" title="Show on Sheet" checked style="cursor:pointer; accent-color: var(--color-gold-base);">
                <input type="checkbox" class="tool-prof" title="Proficient" style="cursor:pointer;">
                <input type="checkbox" class="tool-exp" title="Expertise" style="cursor:pointer; border-radius:50%;">
                <input type="text" class="tool-name" value="New Tool" style="width:140px; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Tool Name">
                <select class="tool-ability" style="background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px; padding:2px;">
                    <option value="str">STR</option>
                    <option value="dex">DEX</option>
                    <option value="con">CON</option>
                    <option value="int">INT</option>
                    <option value="wis">WIS</option>
                    <option value="cha">CHA</option>
                </select>
            </div>
            <div style="display:flex; gap:6px;">
                <input type="text" class="tool-mod" value="0" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                <button class="btn btn-danger btn-xxs tool-delete" style="padding:2px 6px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);

        div.querySelector('.tool-delete')?.addEventListener('click', () => {
            div.remove();
        });
    });

    document.getElementById('modal-tool-settings-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        const newTools = {};
        document.querySelectorAll('.tool-settings-row').forEach((row) => {
            let name = '';
            if (row.dataset.custom === 'true') {
                name = row.querySelector('.tool-name')?.value.trim();
            } else {
                name = row.dataset.key;
            }

            if (!name) return;

            newTools[name] = {
                ability: row.querySelector('.tool-ability')?.value || 'dex',
                show: !!row.querySelector('.tool-show')?.checked,
                prof: !!row.querySelector('.tool-prof')?.checked,
                exp: !!row.querySelector('.tool-exp')?.checked,
                mod: row.querySelector('.tool-mod')?.value || '0',
                custom: row.dataset.custom === 'true'
            };
        });
        currentChar.tools = newTools;
        currentChar.proficiencies = currentChar.proficiencies || { languages: '', weapons: '', armor: '', tools: '' };
        const profToolNames = Object.keys(newTools).filter((k) => newTools[k].prof);
        currentChar.proficiencies.tools = profToolNames.join(', ');
        saveAndEmit(currentChar);
        renderSheetData(currentChar);

        closeToolSettings();
    });
}

export function openToolSettingsModal(char, options = {}) {
    ensureToolSettingsModalExists(options);
    if (!char) return;

    const list = document.getElementById('modal-tool-toggles-list');
    if (!list) return;
    list.innerHTML = '';

    const currentTools = char.tools || {};
    const allTools = new Set([...STANDARD_TOOLS.map((t) => t.name), ...Object.keys(currentTools)]);

    Array.from(allTools)
        .sort()
        .forEach((toolName) => {
            const isStandard = STANDARD_TOOLS.some((t) => t.name === toolName);
            const defTool = STANDARD_TOOLS.find((t) => t.name === toolName);
            const tData = currentTools[toolName] || {
                ability: defTool ? defTool.ability : 'dex',
                show: false,
                prof: false,
                exp: false,
                mod: 0,
                custom: !isStandard
            };
            const isCustom = tData.custom !== undefined ? Boolean(tData.custom) : !isStandard;
            const isProf = Boolean(tData.prof || tData.proficient);
            const isExp = Boolean(tData.exp);
            const isShow = Boolean(tData.show !== undefined ? tData.show : isProf);

            const div = document.createElement('div');
            div.className = 'tool-settings-row';
            div.dataset.key = toolName;
            div.dataset.custom = String(isCustom);
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.background = 'rgba(0,0,0,0.2)';
            div.style.padding = '6px';
            div.style.borderRadius = '4px';
            div.style.border = '1px solid var(--color-border-subtle)';

            const selAb = (ab) => (tData.ability === ab ? 'selected' : '');

            div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="checkbox" class="tool-show" title="Show on Sheet" ${isShow ? 'checked' : ''} style="cursor:pointer; accent-color: var(--color-gold-base);">
                <input type="checkbox" class="tool-prof" title="Proficient" ${isProf ? 'checked' : ''} style="cursor:pointer;">
                <input type="checkbox" class="tool-exp" title="Expertise" ${isExp ? 'checked' : ''} style="cursor:pointer; border-radius:50%;">
                ${
                    isCustom
                        ? `<input type="text" class="tool-name" value="${toolName}" style="width:140px; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);">`
                        : `<span class="tool-name-static" style="width:140px; font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${toolName}">${toolName}</span>`
                }
                <select class="tool-ability" style="background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px; padding:2px;">
                    <option value="str" ${selAb('str')}>STR</option>
                    <option value="dex" ${selAb('dex')}>DEX</option>
                    <option value="con" ${selAb('con')}>CON</option>
                    <option value="int" ${selAb('int')}>INT</option>
                    <option value="wis" ${selAb('wis')}>WIS</option>
                    <option value="cha" ${selAb('cha')}>CHA</option>
                </select>
            </div>
            <div style="display:flex; gap:6px;">
                <input type="text" class="tool-mod" value="${tData.mod || '0'}" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                ${isCustom ? `<button class="btn btn-danger btn-xxs tool-delete" style="padding:2px 6px;"><i class="fa-solid fa-trash"></i></button>` : '<div style="width:24px;"></div>'}
            </div>
        `;
            list.appendChild(div);

            if (isCustom) {
                div.querySelector('.tool-delete')?.addEventListener('click', () => {
                    div.remove();
                });
            }
        });

    document.getElementById('pc-tool-settings-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-tool-settings-overlay')?.classList.remove('vtt-hidden');
}

// ─── 4. HP SETTINGS & TOGGLES ─────────────────────────────────────────────────

function updateHpModalPreview(char) {
    const el = document.getElementById('modal-hp-effective-preview');
    if (el && char) {
        el.textContent = `${char.hpCurrent || 0} / ${char.hpMax || 0}`;
    }
}

export function renderHpTogglesList(char, options = {}) {
    const list = document.getElementById('modal-hp-toggles-list');
    if (!list) return;
    if (!char || !char.hpToggles) return;

    let html = '';
    char.hpToggles.forEach((t, i) => {
        const cleanF = (t.formula || '').toString().trim();
        const displayF = cleanF.startsWith('+') || cleanF.startsWith('-') ? cleanF : `+${cleanF}`;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="hp-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                    <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${displayF} Max HP</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary hp-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary hp-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;

    list.querySelectorAll('.hp-toggle-enable-cb').forEach((cb) =>
        cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.hpToggles[idx].enabled = e.currentTarget.checked;
            calculateEffectiveHp(char);
            options.saveAndEmit?.(char);
            options.renderSheetData?.(char);
            updateHpModalPreview(char);
        })
    );

    list.querySelectorAll('.hp-toggle-edit-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.hpToggles[idx];
            const idxEl = document.getElementById('modal-hp-toggle-idx');
            const nameEl = document.getElementById('modal-hp-toggle-name');
            const formulaEl = document.getElementById('modal-hp-toggle-formula');
            if (idxEl) idxEl.value = idx;
            if (nameEl) nameEl.value = t.name;
            if (formulaEl) formulaEl.value = t.formula;
            document.getElementById('modal-hp-toggle-form')?.classList.remove('vtt-hidden');
            document.getElementById('btn-add-hp-toggle')?.classList.add('vtt-hidden');
        })
    );

    list.querySelectorAll('.hp-toggle-del-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            if (confirm('Delete this toggle?')) {
                const idx = e.currentTarget.dataset.idx;
                char.hpToggles.splice(idx, 1);
                calculateEffectiveHp(char);
                options.saveAndEmit?.(char);
                options.renderSheetData?.(char);
                updateHpModalPreview(char);
                renderHpTogglesList(char, options);
            }
        })
    );
}

export function setupHpSettingsListeners(options = {}) {
    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    const closeHpSettings = () => {
        document.getElementById('pc-hp-settings-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-hp-settings-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('modal-hp-settings-close')?.addEventListener('click', closeHpSettings);
    document.getElementById('pc-hp-settings-overlay')?.addEventListener('click', closeHpSettings);

    document.getElementById('btn-add-hp-toggle')?.addEventListener('click', () => {
        const idxEl = document.getElementById('modal-hp-toggle-idx');
        const nameEl = document.getElementById('modal-hp-toggle-name');
        const formulaEl = document.getElementById('modal-hp-toggle-formula');
        if (idxEl) idxEl.value = '-1';
        if (nameEl) nameEl.value = '';
        if (formulaEl) formulaEl.value = '';
        document.getElementById('modal-hp-toggle-form')?.classList.remove('vtt-hidden');
        document.getElementById('btn-add-hp-toggle')?.classList.add('vtt-hidden');
    });

    document.getElementById('modal-hp-toggle-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-hp-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-hp-toggle')?.classList.remove('vtt-hidden');
    });

    document.getElementById('modal-hp-toggle-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        if (!currentChar.hpToggles) currentChar.hpToggles = [];

        const idx = parseInt(document.getElementById('modal-hp-toggle-idx')?.value || '-1');
        const name = document.getElementById('modal-hp-toggle-name')?.value.trim();
        const formula = document.getElementById('modal-hp-toggle-formula')?.value.trim();
        if (!name || !formula) return alert('Name and Formula are required.');

        const t = { id: 'hptgl_' + Date.now(), name, formula, enabled: true };
        if (idx >= 0) {
            currentChar.hpToggles[idx] = t;
        } else {
            currentChar.hpToggles.push(t);
        }
        document.getElementById('modal-hp-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-hp-toggle')?.classList.remove('vtt-hidden');
        calculateEffectiveHp(currentChar);
        saveAndEmit(currentChar);
        renderSheetData(currentChar);
        updateHpModalPreview(currentChar);
        renderHpTogglesList(currentChar, options);
    });

    document.getElementById('modal-hp-settings-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;

        const baseVal = parseInt(document.getElementById('modal-hp-base-max')?.value);
        if (!isNaN(baseVal)) {
            currentChar.baseHpMax = Math.max(1, baseVal);
        }
        calculateEffectiveHp(currentChar);
        saveAndEmit(currentChar);
        renderSheetData(currentChar);
        closeHpSettings();
    });
}

export function ensureHpSettingsModalExists(options = {}) {
    if (document.getElementById('pc-hp-settings-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-hp-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-hp-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:480px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">HP Settings & Toggles</h3>
                <button id="modal-hp-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label style="font-weight:600; display:block; margin-bottom:4px;">Base Max HP</label>
                    <input type="number" id="modal-hp-base-max" value="10" style="width:100%;">
                    <div style="margin-top:6px; font-size:0.8rem; color:var(--color-text-muted);">
                        Current HP / Max HP: <strong id="modal-hp-effective-preview" style="color:var(--color-gold-light);">10 / 10</strong>
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">HP Toggles (Max HP Modifiers)</h4>
                        <button id="btn-add-hp-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-hp-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-hp-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-hp-toggle-name" placeholder="Name (e.g. Aid, Heroes' Feast)" style="flex:2;">
                            <input type="text" id="modal-hp-toggle-formula" placeholder="Mod (e.g. +5, +10, -5)" style="flex:1;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-hp-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-hp-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-hp-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- HP Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-hp-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    setupHpSettingsListeners(options);
}

export function openHpSettingsModal(char, options = {}) {
    ensureHpSettingsModalExists(options);
    if (!char) return;

    if (char.baseHpMax === undefined || char.baseHpMax === null) {
        char.baseHpMax = parseInt(char.hpMax) || 10;
    }
    const baseInput = document.getElementById('modal-hp-base-max');
    if (baseInput) baseInput.value = char.baseHpMax;

    updateHpModalPreview(char);
    renderHpTogglesList(char, options);

    document.getElementById('pc-hp-settings-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-hp-settings-overlay')?.classList.remove('vtt-hidden');
}

// ─── 5. AC SETTINGS & TOGGLES ─────────────────────────────────────────────────

function updateAcModalPreview(char) {
    const el = document.getElementById('modal-ac-effective-preview');
    if (el && char) {
        el.textContent = `${char.ac || 10}`;
    }
}

export function renderAcTogglesList(char, options = {}) {
    const list = document.getElementById('modal-ac-toggles-list');
    if (!list) return;
    if (!char || !char.acToggles) return;

    let html = '';
    char.acToggles.forEach((t, i) => {
        const cleanF = (t.formula || '').toString().trim();
        const displayF = cleanF.startsWith('+') || cleanF.startsWith('-') ? cleanF : `+${cleanF}`;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="ac-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                    <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${displayF} AC</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary ac-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary ac-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;

    list.querySelectorAll('.ac-toggle-enable-cb').forEach((cb) =>
        cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.acToggles[idx].enabled = e.currentTarget.checked;
            calculateEffectiveAc(char);
            options.saveAndEmit?.(char);
            options.renderSheetData?.(char);
            updateAcModalPreview(char);
        })
    );

    list.querySelectorAll('.ac-toggle-edit-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.acToggles[idx];
            const idxEl = document.getElementById('modal-ac-toggle-idx');
            const nameEl = document.getElementById('modal-ac-toggle-name');
            const formulaEl = document.getElementById('modal-ac-toggle-formula');
            if (idxEl) idxEl.value = idx;
            if (nameEl) nameEl.value = t.name;
            if (formulaEl) formulaEl.value = t.formula;
            document.getElementById('modal-ac-toggle-form')?.classList.remove('vtt-hidden');
            document.getElementById('btn-add-ac-toggle')?.classList.add('vtt-hidden');
        })
    );

    list.querySelectorAll('.ac-toggle-del-btn').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            if (confirm('Delete this toggle?')) {
                const idx = e.currentTarget.dataset.idx;
                char.acToggles.splice(idx, 1);
                calculateEffectiveAc(char);
                options.saveAndEmit?.(char);
                options.renderSheetData?.(char);
                updateAcModalPreview(char);
                renderAcTogglesList(char, options);
            }
        })
    );
}

export function setupAcSettingsListeners(options = {}) {
    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    const closeAcSettings = () => {
        document.getElementById('pc-ac-settings-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-ac-settings-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('modal-ac-settings-close')?.addEventListener('click', closeAcSettings);
    document.getElementById('pc-ac-settings-overlay')?.addEventListener('click', closeAcSettings);

    document.getElementById('btn-add-ac-toggle')?.addEventListener('click', () => {
        const idxEl = document.getElementById('modal-ac-toggle-idx');
        const nameEl = document.getElementById('modal-ac-toggle-name');
        const formulaEl = document.getElementById('modal-ac-toggle-formula');
        if (idxEl) idxEl.value = '-1';
        if (nameEl) nameEl.value = '';
        if (formulaEl) formulaEl.value = '';
        document.getElementById('modal-ac-toggle-form')?.classList.remove('vtt-hidden');
        document.getElementById('btn-add-ac-toggle')?.classList.add('vtt-hidden');
    });

    document.getElementById('modal-ac-toggle-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-ac-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-ac-toggle')?.classList.remove('vtt-hidden');
    });

    document.getElementById('modal-ac-toggle-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;
        if (!currentChar.acToggles) currentChar.acToggles = [];

        const idx = parseInt(document.getElementById('modal-ac-toggle-idx')?.value || '-1');
        const name = document.getElementById('modal-ac-toggle-name')?.value.trim();
        const formula = document.getElementById('modal-ac-toggle-formula')?.value.trim();
        if (!name || !formula) return alert('Name and Formula are required.');

        const t = { id: 'actgl_' + Date.now(), name, formula, enabled: true };
        if (idx >= 0) {
            currentChar.acToggles[idx] = t;
        } else {
            currentChar.acToggles.push(t);
        }
        document.getElementById('modal-ac-toggle-form')?.classList.add('vtt-hidden');
        document.getElementById('btn-add-ac-toggle')?.classList.remove('vtt-hidden');
        calculateEffectiveAc(currentChar);
        saveAndEmit(currentChar);
        renderSheetData(currentChar);
        updateAcModalPreview(currentChar);
        renderAcTogglesList(currentChar, options);
    });

    document.getElementById('modal-ac-settings-save')?.addEventListener('click', () => {
        const currentChar = getCurrentChar();
        if (!currentChar) return;

        const baseVal = parseInt(document.getElementById('modal-ac-base')?.value);
        if (!isNaN(baseVal)) {
            currentChar.baseAc = Math.max(1, baseVal);
        }
        const modVal = parseInt(document.getElementById('modal-ac-mod')?.value);
        currentChar.acMod = isNaN(modVal) ? 0 : modVal;

        calculateEffectiveAc(currentChar);
        saveAndEmit(currentChar);
        renderSheetData(currentChar);
        closeAcSettings();
    });
}

export function ensureAcSettingsModalExists(options = {}) {
    if (document.getElementById('pc-ac-settings-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-ac-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-ac-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:480px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">AC Settings & Toggles</h3>
                <button id="modal-ac-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Base AC</label>
                        <input type="number" id="modal-ac-base" value="10" style="width:100%;">
                    </div>
                    <div class="form-group">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Global AC Modifier</label>
                        <input type="number" id="modal-ac-mod" value="0" style="width:100%;">
                    </div>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-muted);">
                    Current Effective AC: <strong id="modal-ac-effective-preview" style="color:var(--color-gold-light);">10</strong>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">AC Toggles</h4>
                        <button id="btn-add-ac-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-ac-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-ac-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-ac-toggle-name" placeholder="Name (e.g. Shield, Bladesong)" style="flex:2;">
                            <input type="text" id="modal-ac-toggle-formula" placeholder="Mod (e.g. +5, +2, +int, +dex)" style="flex:1;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-ac-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-ac-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-ac-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- AC Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-ac-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    setupAcSettingsListeners(options);
}

export function openAcSettingsModal(char, options = {}) {
    ensureAcSettingsModalExists(options);
    if (!char) return;

    if (char.baseAc === undefined || char.baseAc === null) {
        char.baseAc = parseInt(char.ac) || 10;
    }
    const baseInput = document.getElementById('modal-ac-base');
    if (baseInput) baseInput.value = char.baseAc;
    const modInput = document.getElementById('modal-ac-mod');
    if (modInput) modInput.value = char.acMod || 0;

    updateAcModalPreview(char);
    renderAcTogglesList(char, options);

    document.getElementById('pc-ac-settings-modal')?.classList.remove('vtt-hidden');
    document.getElementById('pc-ac-settings-overlay')?.classList.remove('vtt-hidden');
}
