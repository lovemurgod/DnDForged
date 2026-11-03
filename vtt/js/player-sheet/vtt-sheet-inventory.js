// DnDForged Player Sheet - Inventory & Equipment Subsystem
// Handles equipment rendering, container tare/capacity calculations, currency, and drag-and-drop

import { getTotalStat } from './calc/stats.js';
import {
    getContainerContentsWeight,
    getContainerEffectiveWeight as getContainerEffectiveWeightCalc,
    getContainerCapacityStatus,
    calculateCharacterTotalWeight,
    calculateEncumbrance
} from './calc/containers.js';
import { bindBagContainerEvents as bindBagContainerEventsExt } from './modals/index.js';

/**
 * Render single equipment item row HTML
 */
export function renderEquipRowHtml(eq, i, char) {
    const containers = char?.containers || [];
    return `
        <div class="equip-row glass-flat" data-idx="${i}" data-container-id="${eq.containerId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="pc-equip-drag-handle" data-idx="${i}" title="Click and drag to move/reorder item" style="cursor:grab; padding:2px 8px 2px 2px; opacity:0.6; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                    <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                </div>
                <div class="pc-equip-toggle" data-idx="${i}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); flex:1; min-width:0; display:flex; align-items:center; gap:6px; padding-right:8px;" title="Click to expand/collapse description">
                    <i class="fa-solid fa-chevron-right text-gradient-gold" style="font-size:0.8rem; flex-shrink:0; transition:transform 0.2s;" id="pc-equip-chevron-${i}"></i>
                    <span style="word-break:break-word; overflow-wrap:anywhere;">${eq.name}</span>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                    <span style="font-size:0.8rem; color:var(--color-text-muted);">Wt: ${eq.weight || 0} lb</span>
                    <div style="display:flex; align-items:center; gap:4px; margin: 0 2px;">
                        <button class="btn btn-xxs btn-secondary pc-equip-qty-minus" data-idx="${i}">-</button>
                        <span style="font-size:0.8rem; width:16px; text-align:center;">${eq.qty}</span>
                        <button class="btn btn-xxs btn-secondary pc-equip-qty-plus" data-idx="${i}">+</button>
                    </div>
                    <button class="btn btn-xxs btn-secondary pc-equip-ping" data-idx="${i}" title="Ping Item to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                </div>
            </div>
            <div class="pc-equip-desc vtt-hidden" id="pc-equip-desc-${i}" style="padding: 8px 4px 0 16px; font-size: 0.85rem; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-subtle); margin-top: 4px; line-height: 1.4;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted);"><i class="fa-solid fa-box-archive" style="color:var(--color-gold-base);"></i> Move to:</span>
                        <select class="pc-equip-container-select" data-idx="${i}" title="Move to Bag" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.75rem; border-radius:4px; padding:2px 6px; max-width:140px;">
                            <option value="" ${!eq.containerId ? 'selected' : ''}>Main Inventory</option>
                            ${containers
                                .map(
                                    (c) => `
                                <option value="${c.id}" ${eq.containerId === c.id ? 'selected' : ''}>📦 ${c.name}</option>
                            `
                                )
                                .join('')}
                        </select>
                    </div>
                    <button class="btn btn-xxs btn-secondary pc-equip-edit" data-idx="${i}" title="Edit Item"><i class="fa-solid fa-pen"></i> Edit Item</button>
                </div>
                <div style="white-space: pre-wrap;">
                    ${(function () {
                        if (!eq.description) return '<i style="opacity:0.5;">No description available.</i>';
                        let html = eq.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        html = html.replace(/\*\*(.*?)\*\*(.*?)\*\*/g, '<b>$1</b>');
                        html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
                        html = html.replace(
                            /---/g,
                            '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;">'
                        );
                        return html;
                    })()}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the full equipment tab HTML for ps-equipment
 */
export function renderEquipmentHtml(char, ctx) {
    char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    char.containers = char.containers || [];
    char.equipment = char.equipment || [];
    char.equipment.forEach((eq) => {
        if (eq.containerId === undefined) eq.containerId = null;
    });

    // Container weight & encumbrance calculations using modular calc engine
    const weightCalc = calculateCharacterTotalWeight(char);
    const totalWeight = weightCalc.totalWeight;
    const coinWeight = weightCalc.coinWeight;

    const strScore = getTotalStat(char, 'str') || 10;
    const encRule =
        (typeof document !== 'undefined' && document.getElementById('config-encumbrance-rule')?.value) || 'standard';
    const encResult = calculateEncumbrance(strScore, totalWeight, encRule);
    const encumbranceStatus = `<span style="color:${encResult.statusColor}; ${encResult.statusKey === 'over' ? 'font-weight:bold;' : ''}">${encResult.statusText}</span>`;

    let html = `
        <div style="display:flex; justify-content:center; gap:16px; margin-bottom:16px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid var(--color-border-subtle);">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#b87333; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> CP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="cp" value="${char.currency.cp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#c0c0c0; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> SP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="sp" value="${char.currency.sp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#50c878; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> EP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="ep" value="${char.currency.ep || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:var(--color-gold-base); font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> GP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="gp" value="${char.currency.gp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#e5e4e2; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> PP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="pp" value="${char.currency.pp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-backpack"></i> Inventory</h4>
            <div style="display:flex; gap:8px;">
                <button id="btn-create-bag" class="btn btn-secondary btn-xs"><i class="fa-solid fa-sack-xmark"></i> Create Bag</button>
                <button id="btn-add-equip-db" class="btn btn-secondary btn-xs"><i class="fa-solid fa-book-open"></i> Add Items</button>
                <button id="btn-add-equip-custom" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Custom Item</button>
            </div>
        </div>
        <div id="pc-equip-list" style="display:flex; flex-direction:column; gap:8px;">
            ${(function () {
                let listHtml = '';
                // 1. Bags / Containers Accordions
                (char.containers || []).forEach((c, cIdx) => {
                    const cItems = char.equipment
                        .map((eq, i) => ({ eq, i }))
                        .filter(({ eq }) => eq.containerId === c.id);
                    const itemWeightSum = getContainerContentsWeight(c, char.equipment);
                    const cap = getContainerCapacityStatus(c, char.equipment);

                    let weightLabel =
                        cap.capacity !== null
                            ? `${itemWeightSum.toFixed(1)} / ${cap.capacity.toFixed(1)} lb`
                            : `${itemWeightSum.toFixed(1)} lb`;

                    if (c.weightRule === 'fixed') {
                        weightLabel = `${(parseFloat(c.customWeight) || 0).toFixed(1)} lb (Fixed)`;
                    } else if (c.weightRule === 'weightless') {
                        weightLabel = `0.0 lb (Weightless)`;
                    } else if (parseFloat(c.baseWeight) > 0) {
                        weightLabel += ` • Base: ${parseFloat(c.baseWeight).toFixed(1)} lb`;
                    }

                    const overCapBadge = cap.isOverCapacity
                        ? `<span class="badge" style="background:#ef5350; color:#fff; font-size:0.65rem; padding:1px 6px; margin-left:4px; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> OVER CAPACITY</span>`
                        : '';

                    listHtml += `
                        <div class="pc-bag-card glass-flat" data-container-id="${c.id}" data-container-idx="${cIdx}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                            <div class="pc-bag-header" data-container-id="${c.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                    <div class="pc-bag-drag-handle" data-container-idx="${cIdx}" title="Click and drag to reorder bag" style="cursor:grab; opacity:0.5; padding-right:4px;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.5'; this.style.color='inherit';" onclick="event.stopPropagation();">
                                        <i class="fa-solid fa-grip-vertical"></i>
                                    </div>
                                    <i class="fa-solid ${c.icon || 'fa-sack-xmark'} text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                    <i class="fa-solid fa-chevron-right text-gradient-gold pc-bag-chevron" data-container-id="${c.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${c.collapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"></i>
                                    <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
                                    <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${cItems.length} item${cItems.length !== 1 ? 's' : ''} • ${weightLabel}${overCapBadge}</span>
                                </div>
                                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" onclick="event.stopPropagation();">
                                    <button class="btn btn-xxs btn-secondary pc-bag-edit" data-container-id="${c.id}" title="Edit Bag"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-xxs btn-danger pc-bag-del" data-container-id="${c.id}" title="Delete Bag"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <div class="pc-bag-contents ${c.collapsed ? 'vtt-hidden' : ''}" data-container-id="${c.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                ${cItems.map(({ eq, i }) => renderEquipRowHtml(eq, i, char)).join('')}
                                ${cItems.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this bag.</div>` : ''}
                            </div>
                        </div>
                    `;
                });

                // 2. Main Inventory (Unbagged items)
                const unbaggedItems = char.equipment.map((eq, i) => ({ eq, i })).filter(({ eq }) => !eq.containerId);
                listHtml += `
                    <div class="pc-bag-card glass-flat" data-container-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                        <div class="pc-bag-header pc-main-inv-header" data-container-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                <i class="fa-solid fa-backpack text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Main Inventory (Carried)</span>
                                <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${unbaggedItems.length} item${unbaggedItems.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div class="pc-bag-contents" data-container-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                            ${unbaggedItems.map(({ eq, i }) => renderEquipRowHtml(eq, i, char)).join('')}
                            ${unbaggedItems.length === 0 && (char.containers || []).length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All items are packed into bags.</div>` : ''}
                            ${char.equipment.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No items added yet.</div>` : ''}
                        </div>
                    </div>
                `;
                return listHtml;
            })()}
        </div>
        <div style="margin-top:16px; padding:8px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-size:0.9rem; font-family:var(--font-heading); color:var(--color-gold-light);">Total Wt:</span>
                <span style="font-weight:bold; font-size:1.1rem; margin-left:4px;" title="Includes ${coinWeight.toFixed(2)} lb from coins">${totalWeight.toFixed(1)} lb</span>
            </div>
            <div style="font-size:0.8rem;">
                Status: ${encumbranceStatus}
            </div>
        </div>
    `;

    return html;
}

/**
 * Attach all interactive listeners and drag-and-drop for the equipment tab
 */
export function wireInventoryEvents(char, ctx) {
    const { saveAndEmit, renderSheetData, vtt } = ctx;

    // Currency inputs
    document.querySelectorAll('.pc-currency-input').forEach((input) =>
        input.addEventListener('change', (e) => {
            const coinType = e.currentTarget.dataset.coin;
            char.currency = char.currency || {};
            char.currency[coinType] = parseInt(e.currentTarget.value) || 0;
            saveAndEmit(char);
            renderSheetData(char);
        })
    );

    // Bag container modals and event wiring
    const modalOptions = ctx.getModalOptions ? ctx.getModalOptions() : ctx;
    bindBagContainerEventsExt(char, modalOptions);

    // Add item buttons
    document.getElementById('btn-add-equip-db')?.addEventListener('click', () => {
        if (ctx.openItemModal) ctx.openItemModal();
        else if (window.openItemModal) window.openItemModal();
    });
    document.getElementById('btn-add-equip-custom')?.addEventListener('click', () => {
        if (ctx.openCustomItemModal) ctx.openCustomItemModal();
        else if (window.openCustomItemModal) window.openCustomItemModal();
    });

    // Quantity modifiers
    document.querySelectorAll('.pc-equip-qty-minus').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const eq = char.equipment[e.currentTarget.dataset.idx];
            if (eq && eq.qty > 1) {
                eq.qty = parseInt(eq.qty) - 1;
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );
    document.querySelectorAll('.pc-equip-qty-plus').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const eq = char.equipment[e.currentTarget.dataset.idx];
            if (eq) {
                eq.qty = parseInt(eq.qty || 1) + 1;
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    // Edit item
    document.querySelectorAll('.pc-equip-edit').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            if (ctx.openCustomItemModal) ctx.openCustomItemModal(idx);
            else if (window.openCustomItemModal) window.openCustomItemModal(idx);
        })
    );

    // Delete item
    document.querySelectorAll('.pc-equip-del').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            if (confirm('Delete this item?')) {
                char.equipment.splice(e.currentTarget.dataset.idx, 1);
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    // Ping item to chat
    document.querySelectorAll('.pc-equip-ping').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const eq = char.equipment[idx];
            if (!eq) return;
            vtt.socket.emit('chat:msg', {
                itemCard: {
                    charName: char.name,
                    itemName: eq.name,
                    weight: eq.weight || 0,
                    qty: eq.qty || 1,
                    description: eq.description || ''
                }
            });
        })
    );

    // Toggle item description
    document.querySelectorAll('.pc-equip-toggle').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const descEl = document.getElementById(`pc-equip-desc-${idx}`);
            const chevEl = document.getElementById(`pc-equip-chevron-${idx}`);
            if (descEl) {
                if (descEl.classList.contains('vtt-hidden')) {
                    descEl.classList.remove('vtt-hidden');
                    if (chevEl) chevEl.style.transform = 'rotate(90deg)';
                } else {
                    descEl.classList.add('vtt-hidden');
                    if (chevEl) chevEl.style.transform = 'rotate(0deg)';
                }
            }
        })
    );

    // Drag-and-drop state
    let equipDragHandlePressed = false;
    let equipDraggedIdx = null;
    let bagDragHandlePressed = false;
    let bagDraggedIdx = null;

    const clearEquipDropIndicators = () => {
        document.querySelectorAll('#pc-equip-list .equip-row').forEach((row) => {
            row.style.borderTop = '';
            row.style.borderBottom = '';
            row.style.boxShadow = '';
            row.style.opacity = '';
        });
        document.querySelectorAll('#pc-equip-list .pc-bag-header').forEach((hdr) => {
            hdr.style.outline = '';
            hdr.style.background = '';
        });
        document.querySelectorAll('#pc-equip-list .pc-bag-card').forEach((card) => {
            card.style.borderTop = '';
            card.style.borderBottom = '';
            card.style.opacity = '';
        });
    };

    document.querySelectorAll('.pc-equip-drag-handle').forEach((handle) => {
        handle.addEventListener('mousedown', () => {
            equipDragHandlePressed = true;
        });
    });
    document.querySelectorAll('.pc-bag-drag-handle').forEach((handle) => {
        handle.addEventListener('mousedown', () => {
            bagDragHandlePressed = true;
        });
    });

    window.addEventListener('mouseup', () => {
        equipDragHandlePressed = false;
        bagDragHandlePressed = false;
    });

    // 1. Item Dragging onto Rows
    document.querySelectorAll('#pc-equip-list .equip-row').forEach((row) => {
        row.addEventListener('dragstart', (e) => {
            if (!equipDragHandlePressed) {
                e.preventDefault();
                return;
            }
            equipDraggedIdx = parseInt(row.dataset.idx);
            e.dataTransfer.setData('text/plain', equipDraggedIdx.toString());
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                row.style.opacity = '0.4';
            }, 0);
        });

        row.addEventListener('dragover', (e) => {
            if (equipDraggedIdx === null || equipDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            clearEquipDropIndicators();
            const draggedRow = document.querySelector(`#pc-equip-list .equip-row[data-idx="${equipDraggedIdx}"]`);
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
            clearEquipDropIndicators();

            const fromIdx = equipDraggedIdx;
            const targetIdx = parseInt(row.dataset.idx);
            const targetContainerId = row.dataset.containerId || null;
            equipDraggedIdx = null;
            equipDragHandlePressed = false;

            if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let insertAt = targetIdx;
            if (e.clientY >= midY) {
                insertAt = targetIdx + 1;
            }
            if (fromIdx < insertAt) {
                insertAt--;
            }

            const [movedItem] = char.equipment.splice(fromIdx, 1);
            movedItem.containerId = targetContainerId;
            char.equipment.splice(insertAt, 0, movedItem);
            saveAndEmit(char);
            renderSheetData(char);
        });

        row.addEventListener('dragend', () => {
            equipDraggedIdx = null;
            equipDragHandlePressed = false;
            clearEquipDropIndicators();
        });
    });

    // 2. Item Dragging onto Bag Headers (Move into Bag)
    document.querySelectorAll('#pc-equip-list .pc-bag-header').forEach((hdr) => {
        hdr.addEventListener('dragover', (e) => {
            if (equipDraggedIdx === null || equipDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            clearEquipDropIndicators();
            const draggedRow = document.querySelector(`#pc-equip-list .equip-row[data-idx="${equipDraggedIdx}"]`);
            if (draggedRow) draggedRow.style.opacity = '0.4';

            hdr.style.outline = '2px dashed var(--color-gold-base)';
            hdr.style.background = 'rgba(212, 175, 55, 0.15)';
        });

        hdr.addEventListener('drop', (e) => {
            if (equipDraggedIdx === null || equipDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            clearEquipDropIndicators();

            const fromIdx = equipDraggedIdx;
            const targetContainerId = hdr.dataset.containerId || null;
            equipDraggedIdx = null;
            equipDragHandlePressed = false;

            if (!isNaN(fromIdx) && char.equipment[fromIdx]) {
                char.equipment[fromIdx].containerId = targetContainerId;
                saveAndEmit(char);
                renderSheetData(char);
            }
        });
    });

    // 3. Container Card Dragging (Reorder Bags)
    document.querySelectorAll('#pc-equip-list .pc-bag-card[data-container-idx]').forEach((card) => {
        card.addEventListener('dragstart', (e) => {
            if (!bagDragHandlePressed) return;
            bagDraggedIdx = parseInt(card.dataset.containerIdx);
            e.dataTransfer.setData('text/plain', 'bag_' + bagDraggedIdx);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                card.style.opacity = '0.4';
            }, 0);
        });

        card.addEventListener('dragover', (e) => {
            if (bagDraggedIdx === null || bagDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            clearEquipDropIndicators();
            const draggedCard = document.querySelector(
                `#pc-equip-list .pc-bag-card[data-container-idx="${bagDraggedIdx}"]`
            );
            if (draggedCard) draggedCard.style.opacity = '0.4';

            if (e.clientY < midY) {
                card.style.borderTop = '2px solid var(--color-gold-base)';
            } else {
                card.style.borderBottom = '2px solid var(--color-gold-base)';
            }
        });

        card.addEventListener('drop', (e) => {
            if (bagDraggedIdx === null || bagDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            clearEquipDropIndicators();

            const fromIdx = bagDraggedIdx;
            const targetIdx = parseInt(card.dataset.containerIdx);
            bagDraggedIdx = null;
            bagDragHandlePressed = false;

            if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let insertAt = targetIdx;
            if (e.clientY >= midY) {
                insertAt = targetIdx + 1;
            }
            if (fromIdx < insertAt) {
                insertAt--;
            }

            const [movedContainer] = char.containers.splice(fromIdx, 1);
            char.containers.splice(insertAt, 0, movedContainer);
            saveAndEmit(char);
            renderSheetData(char);
        });

        card.addEventListener('dragend', () => {
            bagDraggedIdx = null;
            bagDragHandlePressed = false;
            clearEquipDropIndicators();
        });
    });
}
