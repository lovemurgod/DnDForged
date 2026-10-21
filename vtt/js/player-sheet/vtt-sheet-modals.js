// DnDForged Player Sheet - Submodals & Dialog Managers
// Handles Assign Players, Macro Configuration, Stat/Save Settings, and Modal Dismissals

export const ALL_SKILLS = [
    { name: 'Acrobatics', ability: 'dex' },
    { name: 'Animal Handling', ability: 'wis' },
    { name: 'Arcana', ability: 'int' },
    { name: 'Athletics', ability: 'str' },
    { name: 'Deception', ability: 'cha' },
    { name: 'History', ability: 'int' },
    { name: 'Insight', ability: 'wis' },
    { name: 'Intimidation', ability: 'cha' },
    { name: 'Investigation', ability: 'int' },
    { name: 'Medicine', ability: 'wis' },
    { name: 'Nature', ability: 'int' },
    { name: 'Perception', ability: 'wis' },
    { name: 'Performance', ability: 'cha' },
    { name: 'Persuasion', ability: 'cha' },
    { name: 'Religion', ability: 'int' },
    { name: 'Sleight of Hand', ability: 'dex' },
    { name: 'Stealth', ability: 'dex' },
    { name: 'Survival', ability: 'wis' }
];

export const STANDARD_TOOLS = [
    { name: "Alchemist's Supplies", ability: "int" },
    { name: "Brewer's Supplies", ability: "int" },
    { name: "Calligrapher's Supplies", ability: "int" },
    { name: "Carpenter's Tools", ability: "str" },
    { name: "Cartographer's Tools", ability: "int" },
    { name: "Cobbler's Tools", ability: "dex" },
    { name: "Cook's Utensils", ability: "wis" },
    { name: "Dice Set", ability: "int" },
    { name: "Dragonchess Set", ability: "int" },
    { name: "Disguise Kit", ability: "cha" },
    { name: "Forgery Kit", ability: "int" },
    { name: "Glassblower's Tools", ability: "dex" },
    { name: "Herbalism Kit", ability: "int" },
    { name: "Jeweler's Tools", ability: "dex" },
    { name: "Land Vehicles", ability: "wis" },
    { name: "Leatherworker's Tools", ability: "dex" },
    { name: "Mason's Tools", ability: "str" },
    { name: "Musical Instrument", ability: "cha" },
    { name: "Navigator's Tools", ability: "wis" },
    { name: "Painter's Supplies", ability: "dex" },
    { name: "Playing Card Set", ability: "int" },
    { name: "Poisoner's Kit", ability: "int" },
    { name: "Potter's Tools", ability: "dex" },
    { name: "Smith's Tools", ability: "str" },
    { name: "Thieves' Tools", ability: "dex" },
    { name: "Tinker's Tools", ability: "dex" },
    { name: "Water Vehicles", ability: "wis" },
    { name: "Weaver's Tools", ability: "dex" },
    { name: "Woodcarver's Tools", ability: "dex" }
];

export const SKILL_NAMES_MASTER = [
    'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
    'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
    'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
    'Sleight of Hand', 'Stealth', 'Survival'
];

let activeAssignChar = null;

export function ensureAssignPlayersModalExists(onSaveCallback) {
    if (document.getElementById('pc-assign-players-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-assign-players-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-assign-players-modal" class="vtt-sheet-submodal vtt-hidden" style="width:400px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Assign Players</h3>
                <button id="modal-assign-players-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="modal-assign-players-list" style="padding:16px; display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto;">
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.2);">
                <button class="btn btn-secondary btn-sm" id="modal-assign-players-cancel">Cancel</button>
                <button class="btn btn-primary btn-sm" id="modal-assign-players-save">Save Assignments</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    document.getElementById('pc-assign-players-overlay').addEventListener('click', closeAssignPlayersModal);
    document.getElementById('modal-assign-players-close').addEventListener('click', closeAssignPlayersModal);
    document.getElementById('modal-assign-players-cancel').addEventListener('click', closeAssignPlayersModal);
    document.getElementById('modal-assign-players-save').addEventListener('click', () => {
        saveAssignPlayers(activeAssignChar, onSaveCallback);
    });
}

export function openAssignPlayersModal(char, vtt, onSaveCallback) {
    ensureAssignPlayersModalExists(onSaveCallback);
    activeAssignChar = char;
    const listEl = document.getElementById('modal-assign-players-list');
    listEl.innerHTML = '';

    const knownPlayers = (vtt.campaignState && vtt.campaignState.knownPlayers) ? vtt.campaignState.knownPlayers : [];
    const allowedUsers = (vtt.campaignState && vtt.campaignState.allowedUsers) ? vtt.campaignState.allowedUsers : [];
    const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];
    const assigned = char.assignedPlayers || [];

    let html = '';
    const allIsChecked = assigned.includes('*') ? 'checked' : '';
    html += `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom: 8px;">
            <input type="checkbox" class="pc-assign-cb" value="*" ${allIsChecked}>
            <span style="font-weight:bold; color:var(--color-gold-light);">All Players</span>
        </label>
    `;

    if (allPotentialPlayers.length === 0) {
        html += '<div style="color:var(--color-text-muted);">No other players have joined or been allowlisted yet.</div>';
    } else {
        allPotentialPlayers.forEach(p => {
            const isChecked = assigned.includes(p) ? 'checked' : '';
            html += `
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" class="pc-assign-cb" value="${p}" ${isChecked}>
                    <span>${p}</span>
                </label>
            `;
        });
    }
    listEl.innerHTML = html;

    document.getElementById('pc-assign-players-overlay').classList.remove('vtt-hidden');
    document.getElementById('pc-assign-players-modal').classList.remove('vtt-hidden');
}

export function closeAssignPlayersModal() {
    document.getElementById('pc-assign-players-overlay')?.classList.add('vtt-hidden');
    document.getElementById('pc-assign-players-modal')?.classList.add('vtt-hidden');
    activeAssignChar = null;
}

export function saveAssignPlayers(char, onSaveCallback) {
    if (!char) return;
    const cbs = document.querySelectorAll('.pc-assign-cb');
    const assigned = [];
    cbs.forEach(cb => {
        if (cb.checked) assigned.push(cb.value);
    });
    char.assignedPlayers = assigned;
    if (typeof onSaveCallback === 'function') onSaveCallback(char);
    closeAssignPlayersModal();
}

export function getMacroModalSnapshot() {
    const m = document.getElementById('pc-macro-modal');
    if (!m) return '';
    const inputs = Array.from(m.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')).map(el => {
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    });
    return JSON.stringify(inputs);
}
