/**
 * Player Sheet Container & Bag Management Modal
 */

export function ensureBagModalExists(options = {}) {
    if (document.getElementById('pc-bag-modal')) return;

    const {
        getCurrentChar = () => window.currentChar,
        saveAndEmit = (c) => window.saveAndEmit?.(c),
        renderSheetData = (c) => window.renderSheetData?.(c)
    } = options;

    const modalHtml = `
        <div id="pc-bag-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
        <div id="pc-bag-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3010; width:420px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                <h3 style="margin:0; color:var(--color-gold-base); font-size:1.1rem;" id="modal-bag-title"><i class="fa-solid fa-sack-xmark"></i> Create Bag / Pouch</h3>
                <button id="modal-bag-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <input type="hidden" id="modal-bag-id" value="">
            <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Container Name</label>
                <input type="text" id="modal-bag-name" placeholder="e.g. Bag of Holding, Belt Pouch, Backpack" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Icon</label>
                    <select id="modal-bag-icon" style="width:100%; padding:6px; font-size:0.85rem; background:#222; border:1px solid var(--color-border-subtle); color:#fff; border-radius:4px;">
                        <option value="fa-sack-xmark">🎒 Sack (X)</option>
                        <option value="fa-sack-dollar">💰 Sack ($)</option>
                        <option value="fa-backpack">🎒 Backpack</option>
                        <option value="fa-box-archive">📦 Box / Chest</option>
                        <option value="fa-gem">👛 Pouch / Purse</option>
                        <option value="fa-briefcase">💼 Satchel / Case</option>
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Weight Rule</label>
                    <select id="modal-bag-rule" style="width:100%; padding:6px; font-size:0.85rem; background:#222; border:1px solid var(--color-border-subtle); color:#fff; border-radius:4px;">
                        <option value="standard">Standard (Sums contents)</option>
                        <option value="fixed">Fixed Container Weight</option>
                        <option value="weightless">Weightless Contents (0 lb)</option>
                    </select>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Base Tare Weight (lbs)</label>
                    <input type="number" step="0.1" id="modal-bag-base-weight" value="0" placeholder="e.g. 5 for backpack" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Capacity Limit (lbs)</label>
                    <input type="number" step="0.1" id="modal-bag-capacity" value="" placeholder="e.g. 30 (blank = unlimited)" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div class="form-group" id="modal-bag-custom-weight-group" style="margin-bottom:16px; display:none;">
                <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Fixed Container Weight (lbs)</label>
                <input type="number" step="0.1" id="modal-bag-custom-weight" value="15" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                <button id="modal-bag-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                <button id="modal-bag-save" class="btn btn-primary btn-xs">Save Bag</button>
            </div>
        </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div);

    const ruleSelect = document.getElementById('modal-bag-rule');
    const customWeightGroup = document.getElementById('modal-bag-custom-weight-group');
    ruleSelect?.addEventListener('change', () => {
        if (customWeightGroup) {
            customWeightGroup.style.display = ruleSelect.value === 'fixed' ? 'block' : 'none';
        }
    });

    const closeBagModal = () => {
        document.getElementById('pc-bag-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-bag-overlay')?.classList.add('vtt-hidden');
    };

    document.getElementById('modal-bag-close')?.addEventListener('click', closeBagModal);
    document.getElementById('modal-bag-cancel')?.addEventListener('click', closeBagModal);
    document.getElementById('pc-bag-overlay')?.addEventListener('click', closeBagModal);

    document.getElementById('modal-bag-save')?.addEventListener('click', () => {
        const char = getCurrentChar();
        if (!char) return;
        const id = document.getElementById('modal-bag-id').value;
        const name = document.getElementById('modal-bag-name').value.trim() || 'New Bag';
        const icon = document.getElementById('modal-bag-icon').value;
        const weightRule = document.getElementById('modal-bag-rule').value;
        const customWeight = parseFloat(document.getElementById('modal-bag-custom-weight').value) || 0;
        const baseWeight = parseFloat(document.getElementById('modal-bag-base-weight').value) || 0;
        const rawCap = document.getElementById('modal-bag-capacity').value.trim();
        const capacity = rawCap !== '' && !isNaN(parseFloat(rawCap)) ? parseFloat(rawCap) : null;

        char.containers = char.containers || [];
        if (id) {
            const bag = char.containers.find((c) => c.id === id);
            if (bag) {
                bag.name = name;
                bag.icon = icon;
                bag.weightRule = weightRule;
                bag.customWeight = customWeight;
                bag.baseWeight = baseWeight;
                bag.capacity = capacity;
            }
        } else {
            const newBag = {
                id: 'bag_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name,
                icon,
                weightRule,
                customWeight,
                baseWeight,
                capacity,
                collapsed: false
            };
            char.containers.push(newBag);
        }
        closeBagModal();
        saveAndEmit(char);
        renderSheetData(char);
    });
}

export function openBagModal(bagId = null, options = {}) {
    ensureBagModalExists(options);
    const { getCurrentChar = () => window.currentChar } = options;
    const char = getCurrentChar();
    if (!char) return;

    const modal = document.getElementById('pc-bag-modal');
    const overlay = document.getElementById('pc-bag-overlay');
    const titleEl = document.getElementById('modal-bag-title');
    const idInp = document.getElementById('modal-bag-id');
    const nameInp = document.getElementById('modal-bag-name');
    const iconSel = document.getElementById('modal-bag-icon');
    const ruleSel = document.getElementById('modal-bag-rule');
    const weightInp = document.getElementById('modal-bag-custom-weight');
    const baseWeightInp = document.getElementById('modal-bag-base-weight');
    const capacityInp = document.getElementById('modal-bag-capacity');
    const customWeightGroup = document.getElementById('modal-bag-custom-weight-group');

    char.containers = char.containers || [];
    if (bagId) {
        const bag = char.containers.find((c) => c.id === bagId);
        if (bag) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen"></i> Edit Container`;
            if (idInp) idInp.value = bag.id;
            if (nameInp) nameInp.value = bag.name || '';
            if (iconSel) iconSel.value = bag.icon || 'fa-sack-xmark';
            if (ruleSel) ruleSel.value = bag.weightRule || 'standard';
            if (weightInp) weightInp.value = bag.customWeight !== undefined ? bag.customWeight : 15;
            if (baseWeightInp) baseWeightInp.value = bag.baseWeight !== undefined ? bag.baseWeight : 0;
            if (capacityInp)
                capacityInp.value = bag.capacity !== undefined && bag.capacity !== null ? bag.capacity : '';
            if (customWeightGroup) customWeightGroup.style.display = bag.weightRule === 'fixed' ? 'block' : 'none';
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-sack-xmark"></i> Create Bag / Pouch`;
        if (idInp) idInp.value = '';
        if (nameInp) nameInp.value = '';
        if (iconSel) iconSel.value = 'fa-sack-xmark';
        if (ruleSel) ruleSel.value = 'standard';
        if (weightInp) weightInp.value = 15;
        if (baseWeightInp) baseWeightInp.value = 0;
        if (capacityInp) capacityInp.value = '';
        if (customWeightGroup) customWeightGroup.style.display = 'none';
    }

    modal?.classList.remove('vtt-hidden');
    overlay?.classList.remove('vtt-hidden');
}

export function bindBagContainerEvents(char, options = {}) {
    if (!char) return;
    const { saveAndEmit = (c) => window.saveAndEmit?.(c), renderSheetData = (c) => window.renderSheetData?.(c) } =
        options;

    document.getElementById('btn-create-bag')?.addEventListener('click', () => openBagModal(null, options));

    document.querySelectorAll('.pc-bag-edit').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openBagModal(e.currentTarget.dataset.containerId, options);
        })
    );

    document.querySelectorAll('.pc-bag-del').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const cId = e.currentTarget.dataset.containerId;
            const bag = (char.containers || []).find((c) => c.id === cId);
            if (!bag) return;

            char.equipment = Array.isArray(char.equipment) ? char.equipment : [];
            const cItems = char.equipment.filter((eq) => eq.containerId === cId);
            if (cItems.length > 0) {
                const choice = confirm(
                    `Delete container "${bag.name}"?\n\nClick OK to unpack items into Main Inventory.\nClick Cancel to abort deletion.`
                );
                if (!choice) return;
                cItems.forEach((eq) => {
                    eq.containerId = null;
                });
            }
            char.containers = char.containers.filter((c) => c.id !== cId);
            saveAndEmit(char);
            renderSheetData(char);
        })
    );

    document.querySelectorAll('.pc-bag-header').forEach((hdr) =>
        hdr.addEventListener('click', (e) => {
            const cId = e.currentTarget.dataset.containerId;
            if (!cId) return;
            const bag = (char.containers || []).find((c) => c.id === cId);
            if (bag) {
                bag.collapsed = !bag.collapsed;
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    document.querySelectorAll('.pc-equip-container-select').forEach((sel) =>
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const newContainerId = e.currentTarget.value || null;
            if (char.equipment && char.equipment[idx]) {
                char.equipment[idx].containerId = newContainerId;
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );
}
