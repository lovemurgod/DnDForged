// DnDForged Player Sheet - Character Builder & Import Wizards
// Handles Background, Species, Class, Subclass, and Feat wizard modals

import { SKILL_NAMES_MASTER } from './vtt-sheet-modals.js';

export function normalizeSkill(s) {
    if (!s) return '';
    const found = SKILL_NAMES_MASTER.find(x => x.toLowerCase() === s.trim().toLowerCase());
    return found || s.trim();
}

export function normalizeTool(t) {
    if (!t) return '';
    const clean = t.trim();
    if (/vehicles?\s*\(\s*water\s*\)/i.test(clean)) return 'Water Vehicles';
    if (/vehicles?\s*\(\s*land\s*\)/i.test(clean)) return 'Land Vehicles';
    if (/thieves'?\s*tools?/i.test(clean)) return "Thieves' Tools";
    if (/navigator'?s?\s*tools?/i.test(clean)) return "Navigator's Tools";
    if (/cartographer'?s?\s*tools?/i.test(clean)) return "Cartographer's Tools";
    if (/cook'?s?\s*utensils?/i.test(clean)) return "Cook's Utensils";
    if (/alchemist'?s?\s*supplies?/i.test(clean)) return "Alchemist's Supplies";
    if (/brewer'?s?\s*supplies?/i.test(clean)) return "Brewer's Supplies";
    if (/calligrapher'?s?\s*supplies?/i.test(clean)) return "Calligrapher's Supplies";
    if (/carpenter'?s?\s*tools?/i.test(clean)) return "Carpenter's Tools";
    if (/cobbler'?s?\s*tools?/i.test(clean)) return "Cobbler's Tools";
    if (/glassblower'?s?\s*tools?/i.test(clean)) return "Glassblower's Tools";
    if (/herbalism\s*kit/i.test(clean)) return "Herbalism Kit";
    if (/jeweler'?s?\s*tools?/i.test(clean)) return "Jeweler's Tools";
    if (/leatherworker'?s?\s*tools?/i.test(clean)) return "Leatherworker's Tools";
    if (/mason'?s?\s*tools?/i.test(clean)) return "Mason's Tools";
    if (/painter'?s?\s*supplies?/i.test(clean)) return "Painter's Supplies";
    if (/poisoner'?s?\s*kit/i.test(clean)) return "Poisoner's Kit";
    if (/potter'?s?\s*tools?/i.test(clean)) return "Potter's Tools";
    if (/smith'?s?\s*tools?/i.test(clean)) return "Smith's Tools";
    if (/tinker'?s?\s*tools?/i.test(clean)) return "Tinker's Tools";
    if (/weaver'?s?\s*tools?/i.test(clean)) return "Weaver's Tools";
    if (/woodcarver'?s?\s*tools?/i.test(clean)) return "Woodcarver's Tools";
    if (/disguise\s*kit/i.test(clean)) return "Disguise Kit";
    if (/forgery\s*kit/i.test(clean)) return "Forgery Kit";
    return clean;
}

export function expandToolOptions(fromList) {
    const ARTISAN_TOOLS = [
        "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
        "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
        "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
        "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
        "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools"
    ];
    const GAMING_SETS = ["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set"];
    const MUSICAL_INSTRUMENTS = ["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol"];

    const res = [];
    (fromList || []).forEach(f => {
        if (/AnyArtisansTools?|Artisan's Tools/i.test(f)) {
            res.push(...ARTISAN_TOOLS);
        } else if (/AnyGamingSet|Gaming Set/i.test(f)) {
            res.push(...GAMING_SETS);
        } else if (/Musical Instrument/i.test(f)) {
            res.push(...MUSICAL_INSTRUMENTS);
        } else {
            res.push(normalizeTool(f));
        }
    });
    return Array.from(new Set(res));
}

export function ensureBackgroundImportModalExists() {
    if (document.getElementById('pc-bg-import-modal')) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="pc-bg-import-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-bg-import-modal" class="vtt-sheet-submodal vtt-hidden" style="width:580px;">
            <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-scroll text-gradient-gold" style="font-size:1.3rem;"></i>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="bg-import-modal-title">
                            Import Background
                        </h3>
                        <span id="bg-import-modal-source" class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-light); font-size:0.7rem; border:1px solid rgba(212,175,55,0.3); padding:1px 6px; border-radius:4px;">PHB</span>
                    </div>
                </div>
                <button id="bg-import-modal-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div style="padding:16px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; flex:1;" class="scroll-styled" id="bg-import-modal-body">
            </div>

            <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35);">
                <button id="bg-import-modal-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                <button id="bg-import-modal-apply" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-check"></i> Apply to Character</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

export function promptBackgroundImportModal(bgData, char, onCancel, onApplied) {
    if (!bgData || !char) return;
    ensureBackgroundImportModalExists();

    const modal = document.getElementById('pc-bg-import-modal');
    const overlay = document.getElementById('pc-bg-import-overlay');
    const titleEl = document.getElementById('bg-import-modal-title');
    const sourceEl = document.getElementById('bg-import-modal-source');
    const bodyEl = document.getElementById('bg-import-modal-body');

    if (!modal || !overlay || !bodyEl) return;

    titleEl.innerText = bgData.name || 'Background';
    if (sourceEl) sourceEl.innerText = bgData.source || 'PHB';

    const skillsData = bgData.skillsData || { fixed: [], choose: null };
    const toolsData = bgData.toolsData || { fixed: [], choose: null };
    const equipData = bgData.equipmentData || { fixedItems: [], fixedGold: 0, choiceSets: [] };
    const features = bgData.features || [];

    let descSnippet = '';
    if (bgData.description) {
        const clean = bgData.description.replace(/^#+\s+/gm, '').trim();
        const firstPara = clean.split('\n\n')[0] || '';
        if (firstPara) {
            descSnippet = `<div style="font-size:0.8rem; color:var(--color-text-secondary); line-height:1.4; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:8px 12px; border-radius:6px;">${firstPara.slice(0, 300)}${firstPara.length > 300 ? '...' : ''}</div>`;
        }
    }

    const fixedSkills = (skillsData.fixed || []).map(normalizeSkill);
    const skillBadges = fixedSkills.map(s => `
        <span style="background:rgba(46,204,113,0.15); border:1px solid rgba(46,204,113,0.4); color:#2ecc71; padding:3px 8px; border-radius:4px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-check"></i> ${s}
        </span>
    `).join('');

    let chooseSkillHtml = '';
    if (skillsData.choose && Array.isArray(skillsData.choose.from)) {
        const count = skillsData.choose.count || 1;
        const fromSkills = skillsData.choose.from.map(normalizeSkill);
        chooseSkillHtml = `
            <div style="margin-top:6px;">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px;">
                    Choose <strong style="color:var(--color-gold-base);">${count}</strong> skill${count > 1 ? 's' : ''}:
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;" class="bg-skill-choice-group" data-count="${count}">
                    ${fromSkills.map((s, idx) => `
                        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:4px 8px; border-radius:4px; margin:0;">
                            <input type="checkbox" class="bg-skill-choice-chk" value="${s}" ${idx < count ? 'checked' : ''} style="cursor:pointer; accent-color:var(--color-gold-base);">
                            <span>${s}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const skillsHtml = `
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-graduation-cap"></i> Skill Proficiencies
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${skillBadges || (skillsData.choose ? '' : '<span style="font-size:0.8rem; color:var(--color-text-muted);">None</span>')}
            </div>
            ${chooseSkillHtml}
        </div>
    `;

    const fixedTools = (toolsData.fixed || []).map(normalizeTool);
    const toolBadges = fixedTools.map(t => `
        <span style="background:rgba(52,152,219,0.15); border:1px solid rgba(52,152,219,0.4); color:#3498db; padding:3px 8px; border-radius:4px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-wrench"></i> ${t}
        </span>
    `).join('');

    let chooseToolHtml = '';
    if (toolsData.choose && Array.isArray(toolsData.choose.from)) {
        const count = toolsData.choose.count || 1;
        const expandedTools = expandToolOptions(toolsData.choose.from);
        chooseToolHtml = `
            <div style="margin-top:6px;">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px;">
                    Choose <strong style="color:var(--color-gold-base);">${count}</strong> tool${count > 1 ? 's' : ''}:
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${Array.from({ length: count }).map((_, idx) => `
                        <select class="bg-tool-choice-sel" style="width:100%; padding:5px 8px; font-size:0.8rem; background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                            ${expandedTools.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const toolsHtml = `
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-toolbox"></i> Tool Proficiencies
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${toolBadges || (toolsData.choose ? '' : '<span style="font-size:0.8rem; color:var(--color-text-muted);">None</span>')}
            </div>
            ${chooseToolHtml}
        </div>
    `;

    const fixedItems = equipData.fixedItems || [];
    const fixedGold = equipData.fixedGold || 0;
    const choiceSets = equipData.choiceSets || [];

    let fixedEquipSummary = [];
    fixedItems.forEach(it => {
        fixedEquipSummary.push((it.quantity > 1 ? `${it.quantity}x ` : '') + (it.name || 'item'));
    });
    if (fixedGold > 0) fixedEquipSummary.push(`${fixedGold} gp`);

    let choiceSetsHtml = '';
    if (choiceSets.length > 0) {
        choiceSetsHtml = choiceSets.map((set, si) => `
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:0.75rem; color:var(--color-text-muted);">Equipment Package:</div>
                ${set.options.map((opt, oi) => {
                    const optLabel = opt.label || (opt.items.map(it => (it.quantity > 1 ? `${it.quantity}x ` : '') + it.name).join(', ') + (opt.gold ? ` + ${opt.gold} gp` : ''));
                    return `
                        <label style="display:flex; align-items:flex-start; gap:8px; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:6px 10px; border-radius:4px; margin:0;">
                            <input type="radio" name="bg-equip-set-${si}" value="${oi}" ${oi === 0 ? 'checked' : ''} style="cursor:pointer; accent-color:var(--color-gold-base); margin-top:2px;">
                            <div style="flex:1;">
                                <strong style="color:var(--color-gold-light);">Option ${opt.key || String.fromCharCode(65 + oi)}:</strong>
                                <span style="color:var(--color-text-primary); margin-left:4px;">${optLabel}</span>
                            </div>
                        </label>
                    `;
                }).join('')}
            </div>
        `).join('');
    }

    const equipHtml = `
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-sack-dollar"></i> Starting Equipment & Gold
            </div>
            ${fixedEquipSummary.length > 0 ? `
                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:6px;">
                    <strong>Standard Gear:</strong> ${fixedEquipSummary.join(', ')}
                </div>
            ` : ''}
            ${choiceSetsHtml}

            <div style="margin-top:10px; padding:8px 10px; background:rgba(0,0,0,0.35); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px; font-weight:600;">Inventory Handling:</div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                        <input type="radio" name="bg-inv-handling" value="append" checked style="cursor:pointer; accent-color:var(--color-gold-base);">
                        <span><strong>Append to Inventory</strong> (Keep existing items & add background equipment)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                        <input type="radio" name="bg-inv-handling" value="replace" style="cursor:pointer; accent-color:var(--color-gold-base);">
                        <span><strong>Replace Inventory</strong> (Clear current items & replace with background equipment)</span>
                    </label>
                </div>
            </div>
        </div>
    `;

    const featureNames = features.map(f => f.name).join(', ') || 'Background Feature';
    const cardsHtml = `
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-address-card"></i> Ability Cards
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                <input type="checkbox" id="bg-import-create-cards" checked style="cursor:pointer; accent-color:var(--color-gold-base);">
                <span>Create Ability Cards in <strong>"Background Features"</strong> category</span>
            </label>
            <div style="font-size:0.72rem; color:var(--color-text-muted); margin-left:20px; margin-top:3px; line-height:1.3;">
                Creates rules card for <em>${featureNames}</em> plus a complete Background Summary card.
            </div>
        </div>
    `;

    bodyEl.innerHTML = descSnippet + skillsHtml + toolsHtml + equipHtml + cardsHtml;

    bodyEl.querySelectorAll('.bg-skill-choice-group').forEach(group => {
        const count = parseInt(group.dataset.count) || 1;
        const chks = group.querySelectorAll('.bg-skill-choice-chk');
        const updateSkillLimit = () => {
            const checkedCount = Array.from(chks).filter(c => c.checked).length;
            chks.forEach(c => {
                if (!c.checked) {
                    c.disabled = checkedCount >= count;
                    c.parentElement.style.opacity = (checkedCount >= count) ? '0.5' : '1';
                } else {
                    c.disabled = false;
                    c.parentElement.style.opacity = '1';
                }
            });
        };
        chks.forEach(c => c.addEventListener('change', updateSkillLimit));
        updateSkillLimit();
    });

    const closeModal = () => {
        modal.classList.add('vtt-hidden');
        overlay.classList.add('vtt-hidden');
    };

    document.getElementById('bg-import-modal-close').onclick = () => { closeModal(); if (onCancel) onCancel(); };
    document.getElementById('bg-import-modal-cancel').onclick = () => { closeModal(); if (onCancel) onCancel(); };
    overlay.onclick = () => { closeModal(); if (onCancel) onCancel(); };

    document.getElementById('bg-import-modal-apply').onclick = () => {
        const selectedSkills = [...fixedSkills];
        bodyEl.querySelectorAll('.bg-skill-choice-chk:checked').forEach(c => {
            if (!selectedSkills.includes(c.value)) selectedSkills.push(c.value);
        });

        const selectedTools = [...fixedTools];
        bodyEl.querySelectorAll('.bg-tool-choice-sel').forEach(s => {
            if (s.value && !selectedTools.includes(s.value)) selectedTools.push(s.value);
        });

        const invHandling = bodyEl.querySelector('input[name="bg-inv-handling"]:checked')?.value || 'append';
        const createCards = !!document.getElementById('bg-import-create-cards')?.checked;

        const finalEquipItems = [...fixedItems];
        let totalGold = fixedGold;

        choiceSets.forEach((set, si) => {
            const selectedOptIdx = parseInt(bodyEl.querySelector(`input[name="bg-equip-set-${si}"]:checked`)?.value) || 0;
            const chosen = set.options[selectedOptIdx];
            if (chosen) {
                if (chosen.items) finalEquipItems.push(...chosen.items);
                if (chosen.gold) totalGold += chosen.gold;
            }
        });

        closeModal();
        if (typeof onApplied === 'function') {
            onApplied({
                skills: selectedSkills,
                tools: selectedTools,
                items: finalEquipItems,
                gold: totalGold,
                invHandling,
                createCards,
                features
            });
        }
    };

    modal.classList.remove('vtt-hidden');
    overlay.classList.remove('vtt-hidden');
}

export function switchModalTab(tabId) {
    document.querySelectorAll('#tab-btn-manual, #tab-btn-import').forEach(b => b.classList.remove('active'));
    document.getElementById('modal-tab-manual')?.classList.add('vtt-hidden');
    document.getElementById('modal-tab-import')?.classList.add('vtt-hidden');
    
    document.getElementById(`tab-btn-${tabId}`)?.classList.add('active');
    document.getElementById(`modal-tab-${tabId}`)?.classList.remove('vtt-hidden');
}

export function getSuggestedCategoryName(currentCategory, features) {
    if (currentCategory === 'class') {
        const classSel = document.getElementById('import-class-sel');
        const className = classSel ? classSel.value : '';
        const subSel = document.getElementById('import-subclass-sel');
        const subName = subSel && subSel.value && subSel.value !== '__base__' ? subSel.options[subSel.selectedIndex]?.text.split('[')[0].trim() : '';

        if (features && features.length === 1 && features[0].subclassShortName) {
            return `Subclass - ${subName || features[0].subclassShortName}`;
        }
        if (subName) {
            return `Subclass - ${subName}`;
        }
        return className ? `Class - ${className}` : 'Class Features';
    }
    if (currentCategory === 'feat') return 'Feats';
    if (currentCategory === 'race') {
        return (features && features.length === 1) ? `Species - ${features[0].name}` : 'Species Traits';
    }
    if (currentCategory === 'background') {
        return (features && features.length === 1) ? `Background - ${features[0].name}` : 'Background Features';
    }
    if (currentCategory === 'charoption') return 'Character Options';
    if (currentCategory === 'optionalfeature') {
        if (features && features.length > 0) {
            const first = features[0];
            const cat = first.featureCategory || first.featureTypeName;
            if (cat && cat !== 'Optional Feature') {
                if (cat.endsWith('y')) return cat.slice(0, -1) + 'ies';
                if (!cat.endsWith('s')) return cat + 's';
                return cat;
            }
        }
        return 'Optional Features';
    }
    return 'Special Features';
}

export function populateOptFeatureTypeDropdown(data) {
    const sel = document.getElementById('import-optfeat-type-sel');
    if (!sel) return;
    const typeCounts = new Map();
    (data || []).forEach(f => {
        const cat = f.featureCategory || f.featureTypeName || 'Other';
        typeCounts.set(cat, (typeCounts.get(cat) || 0) + 1);
    });

    let opts = '<option value="">-- All Feature Types --</option>';
    const sortedTypes = Array.from(typeCounts.keys()).sort((a, b) => a.localeCompare(b));
    sortedTypes.forEach(t => {
        opts += `<option value="${t}">${t} (${typeCounts.get(t)})</option>`;
    });
    sel.innerHTML = opts;
    sel.value = '';
}
