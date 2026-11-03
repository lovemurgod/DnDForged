// DnDForged Player Sheet - Bio, Proficiencies & Features Subsystem
// Handles Character Bio, Notes, Other Proficiencies, and Ability Cards/Traits with counters & categories

import { evaluateAbilityFormula, extractTextFromEntries, simulateRoll } from './vtt-sheet-rolls.js';
import { switchModalTab } from './vtt-sheet-importers.js';

/**
 * Clean a proficiency entry string
 */
export function cleanProficiencyString(raw, isWeapon = false) {
    if (!raw) return '';
    let str = String(raw).trim();
    str = str
        .replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, content) => {
            const parts = content.split('|');
            if (parts.length >= 3 && parts[2]) return parts[2];
            return parts[0];
        })
        .trim();
    if (!str) return '';
    const lower = str.toLowerCase();
    if (isWeapon) {
        if (lower === 'simple' || lower === 'martial') {
            return (lower === 'simple' ? 'Simple' : 'Martial') + ' Weapons';
        }
        if (lower.endsWith(' weapons') && !lower.startsWith('simple') && !lower.startsWith('martial')) {
            str = str.replace(/\s+weapons$/i, '').trim();
        }
        return str.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    }
    return str.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Sanitize comma-separated proficiencies text
 */
export function sanitizeProficienciesText(text, isWeapon = false) {
    if (!text) return '';
    const cleaned = extractTextFromEntries(String(text));
    const parts = cleaned
        .split(',')
        .map((p) => cleanProficiencyString(p, isWeapon))
        .filter(Boolean);
    return Array.from(new Set(parts)).join(', ');
}

/**
 * Render collapsible Bio & Notes Card for Primary Tab
 */
export function renderPrimaryBioCardHtml(char) {
    char.bio = char.bio || {};
    return `
        <!-- Collapsible Bio & Character Notes Card -->
        <div class="ps-collapsible-card" style="margin-top:16px; margin-bottom:12px;">
            <div class="ps-card-header pc-bio-toggle" id="pc-bio-toggle" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                <span><i class="fa-solid fa-feather-pointed" style="color:var(--color-gold-base); margin-right:6px;"></i> <strong>Character Bio & Notes</strong></span>
                <i class="fa-solid fa-chevron-down" id="pc-bio-chevron" style="transition:transform 0.2s;"></i>
            </div>
            <div class="pc-bio-content vtt-hidden" id="pc-bio-content" style="padding:14px; display:flex; flex-direction:column; gap:12px; background:rgba(0,0,0,0.25);">
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <div class="form-group" style="flex:1; min-width:70px; margin:0;">
                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Age</label>
                        <input type="text" id="pc-primary-bio-age" value="${char.bio.age || ''}" style="width:100%; font-size:0.85rem; padding:4px 8px; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary);">
                    </div>
                    <div class="form-group" style="flex:1; min-width:70px; margin:0;">
                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Height</label>
                        <input type="text" id="pc-primary-bio-height" value="${char.bio.height || ''}" style="width:100%; font-size:0.85rem; padding:4px 8px; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary);">
                    </div>
                    <div class="form-group" style="flex:1; min-width:70px; margin:0;">
                        <label style="font-size:0.75rem; color:var(--color-text-muted);">Weight</label>
                        <input type="text" id="pc-primary-bio-weight" value="${char.bio.weight || ''}" style="width:100%; font-size:0.85rem; padding:4px 8px; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary);">
                    </div>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Backstory</label>
                    <textarea id="pc-primary-bio-backstory" class="scroll-styled" style="height:80px; width:100%; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary); font-size:0.85rem; padding:6px 8px; line-height:1.4;">${char.bio.backstory || ''}</textarea>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Other Notes</label>
                    <textarea id="pc-primary-bio-notes" class="scroll-styled" style="height:80px; width:100%; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary); font-size:0.85rem; padding:6px 8px; line-height:1.4;">${char.bio.notes || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Other Proficiencies card for Primary Tab
 */
export function renderOtherProficienciesHtml(char) {
    char.proficiencies = char.proficiencies || { languages: '', weapons: '', armor: '', tools: '' };
    return `
        <div style="margin-top:12px; margin-bottom:12px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid var(--color-border-subtle);">
            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Other Proficiencies</h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Languages</label>
                    <input type="text" id="pc-prof-languages" value="${char.proficiencies.languages || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="languages" data-name="Languages" title="Ping Languages to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Weapons</label>
                    <input type="text" id="pc-prof-weapons" value="${char.proficiencies.weapons || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="weapons" data-name="Weapon Proficiencies" title="Ping Weapons to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Armor</label>
                    <input type="text" id="pc-prof-armor" value="${char.proficiencies.armor || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="armor" data-name="Armor Proficiencies" title="Ping Armor to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Tools</label>
                    <input type="text" id="pc-prof-tools" value="${char.proficiencies.tools || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="tools" data-name="Tool Proficiencies" title="Ping Tools to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Format markdown and custom fields in an ability card description
 */
export function formatAbilityCardDescription(card) {
    if (!card) return '';
    let raw = (card.description || '').trim();
    if (!raw && (!card.customFields || card.customFields.length === 0)) {
        return '<i style="opacity:0.6;">No description provided.</i>';
    }

    let safe = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safe = safe.replace(
        /\*\*(.+?)\*\*/g,
        '<strong style="color:var(--color-gold-light); font-weight:600;">$1</strong>'
    );
    safe = safe.replace(/(^|[^*])\*(?!\*)([^*]+)\*/g, '$1<em>$2</em>');
    safe = safe.replace(/\r\n/g, '\n');
    safe = safe.replace(/^[ \t]*[-*][ \t]+(.+)$/gm, '&bull; $1');
    safe = safe.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');

    if (Array.isArray(card.customFields) && card.customFields.length > 0) {
        const fieldsHtml = card.customFields
            .map((f) => {
                const l = (f.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const e = (f.entry || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<strong style="color:var(--color-gold-light); font-weight:600;">${l}:</strong> ${e}`;
            })
            .join('<br>');

        if (safe) {
            safe += `<br><br>${fieldsHtml}`;
        } else {
            safe = fieldsHtml;
        }
    }

    return safe;
}

/**
 * Render single ability row HTML
 */
export function renderAbilityRowHtml(card, i, char) {
    const actionPill =
        card.actionType && card.actionType !== 'passive'
            ? card.actionType === 'bonus'
                ? `<span class="badge" style="background:#d97706; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Bonus</span>`
                : card.actionType === 'reaction'
                    ? `<span class="badge" style="background:#2563eb; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Reaction</span>`
                    : card.actionType === 'action'
                        ? `<span class="badge" style="background:#16a34a; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Action</span>`
                        : `<span class="badge" style="background:#9333ea; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">${card.actionType}</span>`
            : '';

    const evalFormula = evaluateAbilityFormula(card.formula, card.formulaConfig, char);
    const rollChipHtml = evalFormula
        ? `
        <button class="btn btn-xxs btn-secondary pc-ability-roll-chip" data-idx="${i}" data-formula="${evalFormula}" data-name="${card.name}" title="Click to Roll: ${evalFormula}" style="font-family:monospace; border-color:var(--color-gold-base); font-size:0.75rem; padding:2px 6px; display:inline-flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${evalFormula}
        </button>
    `
        : '';

    return `
    <div class="ability-row glass-flat" data-idx="${i}" data-category-id="${card.categoryId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <div class="pc-ability-drag-handle" data-idx="${i}" title="Click and drag to move/reorder ability card" style="cursor:grab; opacity:0.6; padding-right:4px; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                    <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                </div>
                <i class="fa-solid fa-chevron-right pc-ability-expand" data-idx="${i}" style="transition:transform 0.2s; cursor:pointer; font-size:0.7rem; color:var(--color-text-muted);"></i>
                <div class="pc-ability-ping" data-idx="${i}" title="Ping description to chat" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-comment-dots text-gradient-gold"></i> ${card.name}
                    ${actionPill}
                </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                ${rollChipHtml}
                ${card.hasCounter
            ? `
                <div style="display:flex; align-items:center; gap:4px;">
                    <button class="btn btn-xxs btn-secondary pc-ability-uses-minus" data-idx="${i}">-</button>
                    <span style="font-size:0.8rem; font-family:monospace; min-width:24px; text-align:center;">${card.usesCurrent || 0} / ${card.usesMax || 0}</span>
                    <button class="btn btn-xxs btn-secondary pc-ability-uses-plus" data-idx="${i}">+</button>
                    <span style="font-size:0.65rem; color:var(--color-text-muted); opacity:0.8; margin-left:2px;" title="Resets on ${card.resetType === 'short' ? 'Short Rest' : card.resetType === 'none' ? 'Manual' : 'Long Rest'}">[${card.resetType === 'short' ? 'SR' : card.resetType === 'none' ? 'Man' : 'LR'}]</span>
                </div>
                `
            : ''
        }
                <button class="btn btn-xxs btn-secondary pc-ability-edit" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-xxs btn-danger pc-ability-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
        <div class="pc-ability-details" id="pc-ability-details-${i}" style="display:none; font-size:0.85rem; margin-top:6px; border-top:1px solid rgba(255,255,255,0.08); padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:4px; line-height:1.5; color:var(--color-text-secondary); word-break:break-word;">
            <div class="pc-ability-desc-content" style="white-space:normal;">${formatAbilityCardDescription(card)}</div>
            <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:0.72rem; color:var(--color-text-muted);"><i class="fa-solid fa-folder" style="color:var(--color-gold-base);"></i> Category:</span>
                    <select class="pc-ability-cat-select" data-idx="${i}" title="Move to Category" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.75rem; border-radius:4px; padding:2px 6px; max-width:140px;">
                        <option value="" ${!card.categoryId ? 'selected' : ''}>Uncategorized</option>
                        ${(char.abilityCategories || [])
            .map(
                (c) => `
                            <option value="${c.id}" ${card.categoryId === c.id ? 'selected' : ''}>📁 ${c.name}</option>
                        `
            )
            .join('')}
                    </select>
                </div>
            </div>
        </div>
    </div>
    `;
}

/**
 * Render Ability Cards section for ps-info
 */
export function renderAbilityCardsHtml(char, ctx) {
    char.abilityCategories = char.abilityCategories || [];
    char.abilityCards = char.abilityCards || [];

    return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-address-card"></i> Ability Cards</h4>
            <div style="display:flex; align-items:center; gap:8px;">
                <button id="btn-create-ability-cat" class="btn btn-secondary btn-xs"><i class="fa-solid fa-folder-plus"></i> Category</button>
                <button id="btn-add-ability" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Card</button>
            </div>
        </div>
        <div style="margin-bottom:8px; display:flex; gap:8px;">
            <input type="text" id="pc-ability-search" placeholder="Search ability cards by name or details..." style="flex:1; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
        </div>
        <div id="pc-ability-list" style="display:flex; flex-direction:column; gap:8px;">
            ${(function () {
            let html = '';
            (char.abilityCategories || []).forEach((c, cIdx) => {
                const cItems = char.abilityCards
                    .map((card, i) => ({ card, i }))
                    .filter(({ card }) => card.categoryId === c.id);
                html += `
                        <div class="pc-ability-cat-card glass-flat" data-category-id="${c.id}" data-category-idx="${cIdx}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                            <div class="pc-ability-cat-header" data-category-id="${c.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                    <div class="pc-ability-cat-drag-handle" data-category-idx="${cIdx}" title="Click and drag to reorder category" style="cursor:grab; opacity:0.5; padding-right:4px;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.5'; this.style.color='inherit';" onclick="event.stopPropagation();">
                                        <i class="fa-solid fa-grip-vertical"></i>
                                    </div>
                                    <i class="fa-solid fa-folder text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                    <i class="fa-solid fa-chevron-right text-gradient-gold pc-ability-cat-chevron" data-category-id="${c.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${c.collapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"></i>
                                    <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
                                    <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${cItems.length} item${cItems.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" onclick="event.stopPropagation();">
                                    <button class="btn btn-xxs btn-secondary pc-ability-cat-edit" data-category-id="${c.id}" title="Edit Category"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-xxs btn-danger pc-ability-cat-del" data-category-id="${c.id}" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <div class="pc-ability-cat-contents ${c.collapsed ? 'vtt-hidden' : ''}" data-category-id="${c.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                ${cItems.map(({ card, i }) => renderAbilityRowHtml(card, i, char)).join('')}
                                ${cItems.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this category.</div>` : ''}
                            </div>
                        </div>
                    `;
            });

            const uncatAbilities = char.abilityCards
                .map((card, i) => ({ card, i }))
                .filter(({ card }) => !card.categoryId);
            html += `
                    <div class="pc-ability-cat-card glass-flat" data-category-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                        <div class="pc-ability-cat-header pc-main-ability-header" data-category-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                <i class="fa-solid fa-address-card text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Uncategorized Abilities</span>
                                <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${uncatAbilities.length} item${uncatAbilities.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div class="pc-ability-cat-contents" data-category-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                            ${uncatAbilities.map(({ card, i }) => renderAbilityRowHtml(card, i, char)).join('')}
                            ${uncatAbilities.length === 0 && (char.abilityCategories || []).length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All abilities are organized into categories.</div>` : ''}
                            ${char.abilityCards.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No ability cards added yet.</div>` : ''}
                        </div>
                    </div>
                `;
            return html;
        })()}
        </div>
    `;
}

/**
 * Harvest bio fields from DOM into character object
 */
export function harvestBioData(char) {
    if (typeof document === 'undefined') return;
    char.bio = char.bio || {};

    const ageInp = document.getElementById('pc-primary-bio-age') || document.getElementById('pc-bio-age');
    if (ageInp) char.bio.age = ageInp.value;

    const heightInp = document.getElementById('pc-primary-bio-height') || document.getElementById('pc-bio-height');
    if (heightInp) char.bio.height = heightInp.value;

    const weightInp = document.getElementById('pc-primary-bio-weight') || document.getElementById('pc-bio-weight');
    if (weightInp) char.bio.weight = weightInp.value;

    const backstoryInp =
        document.getElementById('pc-primary-bio-backstory') || document.getElementById('pc-bio-backstory');
    if (backstoryInp) char.bio.backstory = backstoryInp.value;

    const notesInp = document.getElementById('pc-primary-bio-notes') || document.getElementById('pc-bio-notes');
    if (notesInp) char.bio.notes = notesInp.value;
}

/**
 * Render dynamic custom fields inside the ability modal
 */
export function renderAbilityFields(fields = []) {
    if (typeof document === 'undefined') return;
    const list = document.getElementById('modal-ability-fields-list');
    if (!list) return;
    list.innerHTML = '';
    fields.forEach((f) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.className = 'modal-ability-field-row';
        row.innerHTML = `
            <input type="text" class="ab-field-label" placeholder="Label" value="${f.label || ''}" style="flex:1; padding:4px; font-size:0.8rem;">
            <input type="text" class="ab-field-entry" placeholder="Entry" value="${f.entry || ''}" style="flex:2; padding:4px; font-size:0.8rem;">
            <button class="btn btn-xxs btn-danger btn-ab-field-remove"><i class="fa-solid fa-trash"></i></button>
        `;
        row.querySelector('.btn-ab-field-remove')?.addEventListener('click', () => row.remove());
        list.appendChild(row);
    });
}

/**
 * Attach listeners for Bio & Proficiencies
 */
export function wireBioEvents(char, ctx) {
    const { saveAndEmit, vtt } = ctx;

    // Bio collapsible card toggle
    const bioToggle = document.getElementById('pc-bio-toggle');
    const bioContent = document.getElementById('pc-bio-content');
    const bioChevron = document.getElementById('pc-bio-chevron');
    if (bioToggle && bioContent) {
        bioToggle.addEventListener('click', () => {
            const isHidden = bioContent.classList.toggle('vtt-hidden');
            if (bioChevron) {
                bioChevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    }

    // Primary bio input change listeners
    ['age', 'height', 'weight', 'backstory', 'notes'].forEach((field) => {
        const input = document.getElementById(`pc-primary-bio-${field}`);
        if (input) {
            input.addEventListener('change', () => {
                char.bio = char.bio || {};
                char.bio[field] = input.value;
                saveAndEmit(char);
            });
        }
    });

    // Other proficiencies input change listeners
    ['languages', 'weapons', 'armor', 'tools'].forEach((type) => {
        document.getElementById(`pc-prof-${type}`)?.addEventListener('change', (e) => {
            char.proficiencies = char.proficiencies || { languages: '', weapons: '', armor: '', tools: '' };
            char.proficiencies[type] = e.target.value;
            if (type === 'tools' && char.tools) {
                const parsed = e.target.value
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean);
                Object.keys(char.tools).forEach((k) => {
                    char.tools[k].prof = parsed.includes(k.toLowerCase());
                });
            }
            saveAndEmit(char);
        });
    });

    // Proficiencies ping buttons
    document.querySelectorAll('.pc-prof-ping').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            const name = e.currentTarget.dataset.name;
            const rawVal = char.proficiencies?.[type] || 'None';
            const val = sanitizeProficienciesText(rawVal, type === 'weapons') || 'None';
            vtt.socket.emit('chat:msg', {
                text: `[${char.name || 'Player'}: ${name}]\n**Proficiencies:** ${val}`
            });
        });
    });
}

/**
 * Attach listeners and drag-and-drop for Ability Cards
 */
export function wireAbilityCardsEvents(char, ctx) {
    const { saveAndEmit, renderSheetData, vtt } = ctx;

    // Add ability button
    document.getElementById('btn-add-ability')?.addEventListener('click', () => {
        document.getElementById('modal-ability-idx').value = '-1';
        document.getElementById('modal-ability-name').value = '';
        const catSel = document.getElementById('modal-ability-category');
        if (catSel) {
            catSel.innerHTML =
                '<option value="">Uncategorized</option>' +
                (char.abilityCategories || []).map((c) => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
            catSel.value = '';
        }
        const actSel = document.getElementById('modal-ability-action-type');
        if (actSel) actSel.value = 'passive';
        document.getElementById('modal-ability-desc').value = '';

        if (ctx.populateScalingModDropdown) ctx.populateScalingModDropdown(char);
        if (document.getElementById('modal-ability-base-dice'))
            document.getElementById('modal-ability-base-dice').value = '';
        if (document.getElementById('modal-ability-scaling-mod'))
            document.getElementById('modal-ability-scaling-mod').value = 'none';
        if (document.getElementById('modal-ability-extra-bonus'))
            document.getElementById('modal-ability-extra-bonus').value = 0;
        if (document.getElementById('modal-ability-formula'))
            document.getElementById('modal-ability-formula').value = '';
        if (document.getElementById('modal-ability-formula-preview'))
            document.getElementById('modal-ability-formula-preview').innerText = 'None';

        document.getElementById('modal-ability-has-counter').checked = false;
        document.getElementById('modal-ability-uses-container').style.display = 'none';
        document.getElementById('modal-ability-uses-current').value = 0;
        document.getElementById('modal-ability-uses-max').value = 0;
        if (document.getElementById('modal-ability-reset-type'))
            document.getElementById('modal-ability-reset-type').value = 'long';

        if (ctx.renderAbilityFields) ctx.renderAbilityFields([]);
        switchModalTab('manual');
        if (ctx.initializeImportTab) ctx.initializeImportTab();
        document.getElementById('pc-ability-modal')?.classList.remove('vtt-hidden');
        document.getElementById('pc-ability-overlay')?.classList.remove('vtt-hidden');
    });

    // Edit ability button
    document.querySelectorAll('.pc-ability-edit').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            if (!ab) return;
            document.getElementById('modal-ability-idx').value = idx;
            document.getElementById('modal-ability-name').value = ab.name || '';
            const catSel = document.getElementById('modal-ability-category');
            if (catSel) {
                catSel.innerHTML =
                    '<option value="">Uncategorized</option>' +
                    (char.abilityCategories || []).map((c) => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                catSel.value = ab.categoryId || '';
            }
            const actSel = document.getElementById('modal-ability-action-type');
            if (actSel) actSel.value = ab.actionType || 'passive';
            document.getElementById('modal-ability-desc').value = ab.description || '';

            let baseDice = '';
            let scalingMod = 'none';
            let extraBonus = 0;
            if (ab.formulaConfig) {
                baseDice = ab.formulaConfig.baseDice || '';
                scalingMod = ab.formulaConfig.modClass
                    ? `classLevel:${ab.formulaConfig.modClass}`
                    : ab.formulaConfig.scalingMod || 'none';
                extraBonus = ab.formulaConfig.extraBonus || 0;
            }
            if (ctx.populateScalingModDropdown) ctx.populateScalingModDropdown(char, scalingMod);
            if (document.getElementById('modal-ability-base-dice'))
                document.getElementById('modal-ability-base-dice').value = baseDice;
            if (document.getElementById('modal-ability-extra-bonus'))
                document.getElementById('modal-ability-extra-bonus').value = extraBonus;
            if (document.getElementById('modal-ability-formula'))
                document.getElementById('modal-ability-formula').value = ab.formula || '';

            const evalFormula = evaluateAbilityFormula(ab.formula, ab.formulaConfig, char);
            if (document.getElementById('modal-ability-formula-preview')) {
                document.getElementById('modal-ability-formula-preview').innerText = evalFormula || 'None';
            }

            document.getElementById('modal-ability-has-counter').checked = !!ab.hasCounter;
            document.getElementById('modal-ability-uses-container').style.display = ab.hasCounter ? 'flex' : 'none';
            document.getElementById('modal-ability-uses-current').value = ab.usesCurrent || 0;
            document.getElementById('modal-ability-uses-max').value = ab.usesMax || 0;
            if (document.getElementById('modal-ability-reset-type'))
                document.getElementById('modal-ability-reset-type').value = ab.resetType || 'long';

            if (ctx.renderAbilityFields) ctx.renderAbilityFields(ab.customFields || []);
            switchModalTab('manual');
            if (ctx.initializeImportTab) ctx.initializeImportTab();
            document.getElementById('pc-ability-modal')?.classList.remove('vtt-hidden');
            document.getElementById('pc-ability-overlay')?.classList.remove('vtt-hidden');
        })
    );

    // Counter minus / plus
    document.querySelectorAll('.pc-ability-uses-minus').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            if (ab) {
                ab.usesCurrent = Math.max(0, (ab.usesCurrent || 0) - 1);
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    document.querySelectorAll('.pc-ability-uses-plus').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            if (ab) {
                const current = ab.usesCurrent || 0;
                const max = ab.usesMax || 0;
                if (max > 0) {
                    ab.usesCurrent = Math.min(max, current + 1);
                } else {
                    ab.usesCurrent = current + 1;
                }
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    // Ability category management
    document.getElementById('btn-create-ability-cat')?.addEventListener('click', () => {
        if (ctx.openCategoryModal) ctx.openCategoryModal('ability');
    });

    document.querySelectorAll('.pc-ability-cat-edit').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (ctx.openCategoryModal) ctx.openCategoryModal('ability', e.currentTarget.dataset.categoryId);
        })
    );

    document.querySelectorAll('.pc-ability-cat-del').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (ctx.openCategoryDeleteModal) ctx.openCategoryDeleteModal('ability', e.currentTarget.dataset.categoryId);
        })
    );

    document.querySelectorAll('.pc-ability-cat-header').forEach((hdr) =>
        hdr.addEventListener('click', (e) => {
            const cId = e.currentTarget.dataset.categoryId;
            if (!cId) return;
            const cat = (char.abilityCategories || []).find((c) => c.id === cId);
            if (cat) {
                cat.collapsed = !cat.collapsed;
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    document.querySelectorAll('.pc-ability-cat-select').forEach((sel) =>
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const newCatId = e.currentTarget.value || null;
            if (char.abilityCards && char.abilityCards[idx]) {
                char.abilityCards[idx].categoryId = newCatId;
                saveAndEmit(char);
                renderSheetData(char);
            }
        })
    );

    // Delete ability card
    document.querySelectorAll('.pc-ability-del').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.idx);
            if (!isNaN(idx) && char.abilityCards[idx]) {
                if (confirm('Delete this ability card?')) {
                    char.abilityCards.splice(idx, 1);
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            }
        })
    );

    // Expand details
    document.querySelectorAll('.pc-ability-expand').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const details = document.getElementById(`pc-ability-details-${idx}`);
            if (details) {
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                } else {
                    details.style.display = 'none';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                }
            }
        })
    );

    // Ping description to chat
    document.querySelectorAll('.pc-ability-ping').forEach((btn) =>
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            if (!ab) return;

            let descHtml = ab.description ? ab.description.replace(/\n/g, '<br>') : '';
            if (ab.customFields && ab.customFields.length > 0) {
                if (descHtml) descHtml += '<br><br>';
                ab.customFields.forEach((f) => {
                    descHtml += `<b>${f.label}:</b> ${f.entry}<br>`;
                });
            }

            const mc = {
                charName: char.name,
                macroName: ab.name,
                description: descHtml
            };

            if (ab.formula) {
                const evalFormula = evaluateAbilityFormula(ab.formula, ab.formulaConfig, char);
                mc.dmgRolls = [
                    {
                        type: 'Roll',
                        formula: evalFormula || ab.formula,
                        roll: simulateRoll(evalFormula || ab.formula)
                    }
                ];
            }

            vtt.socket.emit('chat:msg', {
                macroCard: mc
            });
        })
    );

    // 1-Click Roll Chip
    document.querySelectorAll('.pc-ability-roll-chip').forEach((chip) =>
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            if (!ab || !ab.formula) return;
            const evalFormula = evaluateAbilityFormula(ab.formula, ab.formulaConfig, char);
            const rollVal = simulateRoll(evalFormula || ab.formula);

            const mc = {
                charName: char.name,
                macroName: ab.name,
                description: ab.description ? ab.description.replace(/\n/g, '<br>') : '',
                dmgRolls: [
                    {
                        type: 'Roll',
                        formula: evalFormula || ab.formula,
                        roll: rollVal
                    }
                ]
            };
            vtt.socket.emit('chat:msg', { macroCard: mc });
        })
    );

    // Search filter
    const abilitySearch = document.getElementById('pc-ability-search');
    if (abilitySearch) {
        abilitySearch.oninput = (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('#pc-ability-list .ability-row').forEach((row) => {
                const txt = row.innerText.toLowerCase();
                row.style.display = !query || txt.includes(query) ? 'flex' : 'none';
            });
            document.querySelectorAll('#pc-ability-list .pc-ability-cat-card').forEach((card) => {
                const visibleRows = card.querySelectorAll('.ability-row:not([style*="display: none"])');
                card.style.display = visibleRows.length > 0 ? 'block' : 'none';
            });
        };
    }

    // Drag-and-drop
    let abilityDragHandlePressed = false;
    let abilityDraggedIdx = null;
    let abilityCatDragHandlePressed = false;
    let abilityCatDraggedIdx = null;

    const clearAbilityDropIndicators = () => {
        document.querySelectorAll('#pc-ability-list .ability-row').forEach((row) => {
            row.style.borderTop = '';
            row.style.borderBottom = '';
            row.style.boxShadow = '';
            row.style.opacity = '';
        });
        document.querySelectorAll('#pc-ability-list .pc-ability-cat-header').forEach((hdr) => {
            hdr.style.outline = '';
            hdr.style.background = '';
        });
        document.querySelectorAll('#pc-ability-list .pc-ability-cat-card').forEach((card) => {
            card.style.borderTop = '';
            card.style.borderBottom = '';
            card.style.opacity = '';
        });
    };

    document.querySelectorAll('.pc-ability-drag-handle').forEach((handle) => {
        handle.addEventListener('mousedown', () => {
            abilityDragHandlePressed = true;
        });
    });
    document.querySelectorAll('.pc-ability-cat-drag-handle').forEach((handle) => {
        handle.addEventListener('mousedown', () => {
            abilityCatDragHandlePressed = true;
        });
    });

    window.addEventListener('mouseup', () => {
        abilityDragHandlePressed = false;
        abilityCatDragHandlePressed = false;
    });

    // Drag ability rows
    document.querySelectorAll('#pc-ability-list .ability-row').forEach((row) => {
        row.addEventListener('dragstart', (e) => {
            if (!abilityDragHandlePressed) {
                e.preventDefault();
                return;
            }
            abilityDraggedIdx = parseInt(row.dataset.idx);
            e.dataTransfer.setData('text/plain', `ability_${abilityDraggedIdx}`);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                row.style.opacity = '0.4';
            }, 0);
        });

        row.addEventListener('dragover', (e) => {
            if (abilityDraggedIdx === null || abilityDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            clearAbilityDropIndicators();
            const draggedRow = document.querySelector(`#pc-ability-list .ability-row[data-idx="${abilityDraggedIdx}"]`);
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
            clearAbilityDropIndicators();

            const fromIdx = abilityDraggedIdx;
            const targetIdx = parseInt(row.dataset.idx);
            const targetCategoryId = row.dataset.categoryId || null;
            abilityDraggedIdx = null;
            abilityDragHandlePressed = false;

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

            const [movedItem] = char.abilityCards.splice(fromIdx, 1);
            movedItem.categoryId = targetCategoryId;
            char.abilityCards.splice(insertAt, 0, movedItem);
            saveAndEmit(char);
            renderSheetData(char);
        });

        row.addEventListener('dragend', () => {
            abilityDraggedIdx = null;
            abilityDragHandlePressed = false;
            clearAbilityDropIndicators();
        });
    });

    // Drop on category header
    document.querySelectorAll('#pc-ability-list .pc-ability-cat-header').forEach((hdr) => {
        hdr.addEventListener('dragover', (e) => {
            if (abilityDraggedIdx === null || abilityDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            clearAbilityDropIndicators();
            const draggedRow = document.querySelector(`#pc-ability-list .ability-row[data-idx="${abilityDraggedIdx}"]`);
            if (draggedRow) draggedRow.style.opacity = '0.4';

            hdr.style.outline = '2px dashed var(--color-gold-base)';
            hdr.style.background = 'rgba(212, 175, 55, 0.15)';
        });

        hdr.addEventListener('drop', (e) => {
            if (abilityDraggedIdx === null || abilityDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            clearAbilityDropIndicators();

            const fromIdx = abilityDraggedIdx;
            const targetCategoryId = hdr.dataset.categoryId || null;
            abilityDraggedIdx = null;
            abilityDragHandlePressed = false;

            if (!isNaN(fromIdx) && char.abilityCards[fromIdx]) {
                char.abilityCards[fromIdx].categoryId = targetCategoryId;
                saveAndEmit(char);
                renderSheetData(char);
            }
        });
    });

    // Reorder categories
    document.querySelectorAll('#pc-ability-list .pc-ability-cat-card[data-category-idx]').forEach((card) => {
        card.addEventListener('dragstart', (e) => {
            if (!abilityCatDragHandlePressed) return;
            abilityCatDraggedIdx = parseInt(card.dataset.categoryIdx);
            e.dataTransfer.setData('text/plain', 'acat_' + abilityCatDraggedIdx);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                card.style.opacity = '0.4';
            }, 0);
        });

        card.addEventListener('dragover', (e) => {
            if (abilityCatDraggedIdx === null || abilityCatDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            clearAbilityDropIndicators();
            const draggedCard = document.querySelector(
                `#pc-ability-list .pc-ability-cat-card[data-category-idx="${abilityCatDraggedIdx}"]`
            );
            if (draggedCard) draggedCard.style.opacity = '0.4';

            if (e.clientY < midY) {
                card.style.borderTop = '2px solid var(--color-gold-base)';
            } else {
                card.style.borderBottom = '2px solid var(--color-gold-base)';
            }
        });

        card.addEventListener('drop', (e) => {
            if (abilityCatDraggedIdx === null || abilityCatDraggedIdx === undefined) return;
            e.preventDefault();
            e.stopPropagation();
            clearAbilityDropIndicators();

            const fromIdx = abilityCatDraggedIdx;
            const targetIdx = parseInt(card.dataset.categoryIdx);
            abilityCatDraggedIdx = null;
            abilityCatDragHandlePressed = false;

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

            const [movedContainer] = char.abilityCategories.splice(fromIdx, 1);
            char.abilityCategories.splice(insertAt, 0, movedContainer);
            saveAndEmit(char);
            renderSheetData(char);
        });

        card.addEventListener('dragend', () => {
            abilityCatDraggedIdx = null;
            abilityCatDragHandlePressed = false;
            clearAbilityDropIndicators();
        });
    });
}
