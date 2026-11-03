/**
 * Character Builder Wizard - Step 4: Features & Customizations
 * Class features, Racial traits, Background features, Optional features, and search.
 */

export function renderStep4(ctx) {
    const {
        bodyEl,
        workingChar,
        candidateClassFeatures,
        candidateRacialTraits,
        candidateBgFeatures,
        optFeatureSections,
        allCandidateAbilities,
        recomputeCandidates,
        updateCountsDisplay
    } = ctx;

    bodyEl.innerHTML = `
        <!-- Action Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <strong style="color:var(--color-gold-light); font-size:0.95rem;">Features, Background & Traits</strong>
            <div style="display:flex; gap:8px;">
                <button type="button" id="pc-wiz-add-custom-feat-btn" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Custom Trait</button>
                <button type="button" id="pc-wiz-feat-all-btn" class="btn btn-secondary btn-xs">Select All</button>
                <button type="button" id="pc-wiz-feat-none-btn" class="btn btn-secondary btn-xs">Deselect All</button>
            </div>
        </div>

        <!-- Class Features -->
        <div class="builder-section-box">
            <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-hat-wizard text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Class Features</strong>
                    <span class="builder-pill">${candidateClassFeatures.length} Available</span>
                </div>
                <div style="position:relative; min-width:180px;">
                    <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                    <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-class-feats-list" placeholder="Search class features..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div id="pc-wiz-class-feats-list" style="display:flex; flex-direction:column; gap:8px;">
                ${candidateClassFeatures
            .map(
                (cf) => `
                    <div class="glass-flat pc-wiz-feat-item" data-text="${(cf.name + ' ' + (cf.className || '') + ' ' + (cf.description || '')).toLowerCase()}" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                        <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${cf.id}" ${cf.checked ? 'checked' : ''} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <strong style="color:var(--color-gold-light); font-size:0.9rem;">${cf.name}</strong>
                                <span class="builder-pill" style="font-size:0.7rem;">${cf.className} Lv ${cf.level}</span>
                                ${cf.isSubclass ? '<span class="badge" style="background:rgba(186,104,200,0.15); border:1px solid rgba(186,104,200,0.4); color:#ba68c8; font-size:0.65rem;">Subclass</span>' : ''}
                            </div>
                            ${cf.subOptions && cf.subOptions.length > 0
                        ? `
                                <div style="margin-top:6px; display:flex; align-items:center; gap:8px;">
                                    <label style="font-size:0.75rem; color:var(--color-gold-light); font-weight:600;"><i class="fa-solid fa-paw"></i> Option:</label>
                                    <select class="pc-wiz-feat-suboption-sel" data-feat-id="${cf.id}" style="padding:2px 8px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                        ${cf.subOptions
                            .map(
                                (opt) =>
                                    `<option value="${opt.name}" ${cf.subOptionChoice === opt.name ? 'selected' : ''}>${opt.name}</option>`
                            )
                            .join('')}
                                    </select>
                                </div>
                            `
                        : ''
                    }
                            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                                ${(cf.description || '').replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                `
            )
            .join('')}
            </div>
        </div>

        <!-- Racial Traits -->
        <div class="builder-section-box">
            <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-dna text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Racial Traits</strong>
                    <span class="builder-pill">${candidateRacialTraits.length} Available</span>
                </div>
                <div style="position:relative; min-width:180px;">
                    <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                    <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-racial-feats-list" placeholder="Search racial traits..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div id="pc-wiz-racial-feats-list" style="display:flex; flex-direction:column; gap:8px;">
                ${candidateRacialTraits
            .map(
                (rt) => `
                    <div class="glass-flat pc-wiz-feat-item" data-text="${(rt.name + ' ' + (rt.description || '')).toLowerCase()}" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                        <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${rt.id}" ${rt.checked ? 'checked' : ''} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                        <div style="flex:1;">
                            <strong style="color:var(--color-gold-light); font-size:0.9rem;">${rt.name}</strong>
                            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                                ${(rt.description || '').replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                `
            )
            .join('')}
            </div>
        </div>

        <!-- Background Features -->
        ${candidateBgFeatures.length > 0
            ? `
            <div class="builder-section-box">
                <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-book-atlas text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Background Features</strong>
                        <span class="builder-pill">${candidateBgFeatures.length} Available</span>
                    </div>
                    <div style="position:relative; min-width:180px;">
                        <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                        <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-bg-feats-list" placeholder="Search background features..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                </div>
                <div id="pc-wiz-bg-feats-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${candidateBgFeatures
                .map(
                    (bf) => `
                        <div class="glass-flat pc-wiz-feat-item" data-text="${(bf.name + ' ' + (bf.description || '')).toLowerCase()}" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                            <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${bf.id}" ${bf.checked ? 'checked' : ''} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <strong style="color:var(--color-gold-light); font-size:0.9rem;">${bf.name}</strong>
                                    <span class="builder-pill" style="font-size:0.7rem;">Background: ${workingChar.background || 'Selected'}</span>
                                </div>
                                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                                    ${(bf.description || '').replace(/\n/g, '<br>')}
                                </div>
                            </div>
                        </div>
                    `
                )
                .join('')}
                </div>
            </div>
        `
            : ''
        }

        <!-- Optional Features & Specializations -->
        ${optFeatureSections
            .map(
                (sec, secIdx) => `
            <div class="builder-section-box">
                <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-wand-magic text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">${sec.className} Specializations & Options</strong>
                        <span class="builder-pill">${sec.features.length} Available</span>
                    </div>
                    <div style="position:relative; min-width:180px;">
                        <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                        <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-opt-feats-${secIdx}" placeholder="Search ${sec.className} options..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:8px;">
                    Optional class features, eldritch invocations, maneuvers, infusions, metamagic or fighting styles unlocked by your ${sec.className} levels.
                </div>
                <div id="pc-wiz-opt-feats-${secIdx}" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;" class="scroll-styled">
                    ${sec.features
                        .map(
                            (of) => `
                        <div class="glass-flat pc-wiz-feat-item" data-text="${(of.name + ' ' + (of.prerequisite || '') + ' ' + (of.description || '')).toLowerCase()}" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                            <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${of.id}" ${of.checked ? 'checked' : ''} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <strong style="color:var(--color-gold-light); font-size:0.85rem;">${of.name}</strong>
                                    ${of.prerequisite ? `<span class="badge" style="font-size:0.65rem; background:rgba(255,255,255,0.08);">${of.prerequisite}</span>` : ''}
                                </div>
                                <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px; line-height:1.35;">
                                    ${(of.description || '').replace(/\n/g, '<br>')}
                                </div>
                            </div>
                        </div>
                    `
                        )
                        .join('')}
                </div>
            </div>
        `
            )
            .join('')}

        <!-- Custom Added Features -->
        ${workingChar.customFeatures.length > 0
            ? `
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Custom / Homebrew Features</strong>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${workingChar.customFeatures
                .map(
                    (cf, i) => `
                        <div class="glass-flat" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <strong style="color:var(--color-gold-light); font-size:0.9rem;">${cf.name}</strong>
                                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px;">${cf.description}</div>
                            </div>
                            <button type="button" class="btn btn-danger btn-xxs pc-wiz-del-custom-feat" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `
                )
                .join('')}
                </div>
            </div>
        `
            : ''
        }
    `;

    // Step 4 Event Listeners
    bodyEl.querySelectorAll('.pc-wiz-feat-search').forEach((input) => {
        input.addEventListener('input', (e) => {
            const targetId = e.target.dataset.target;
            const q = (e.target.value || '').toLowerCase().trim();
            const list = document.getElementById(targetId);
            if (!list) return;
            list.querySelectorAll('.pc-wiz-feat-item').forEach((item) => {
                const txt = item.dataset.text || '';
                item.style.display = !q || txt.includes(q) ? 'flex' : 'none';
            });
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-feat-suboption-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const featId = e.target.dataset.featId;
            const val = e.target.value;
            workingChar.featureSubChoices = workingChar.featureSubChoices || {};
            workingChar.featureSubChoices[featId] = val;
            const feat = candidateClassFeatures.find((f) => f.id === featId);
            if (feat && feat.subOptions) {
                feat.subOptionChoice = val;
                const chosen = feat.subOptions.find((o) => o.name === val);
                if (chosen) {
                    feat.description = (feat.baseDescription || '') + '\n\n**' + chosen.name + ':** ' + (chosen.description || '');
                }
            }
            renderStep4(ctx);
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-feat-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.featId;
            const f = allCandidateAbilities.find((a) => a.id === id);
            if (f) f.checked = e.target.checked;
            updateCountsDisplay();
        });
    });

    document.getElementById('pc-wiz-feat-all-btn')?.addEventListener('click', () => {
        allCandidateAbilities.forEach((a) => (a.checked = true));
        renderStep4(ctx);
        updateCountsDisplay();
    });

    document.getElementById('pc-wiz-feat-none-btn')?.addEventListener('click', () => {
        allCandidateAbilities.forEach((a) => (a.checked = false));
        renderStep4(ctx);
        updateCountsDisplay();
    });

    document.getElementById('pc-wiz-add-custom-feat-btn')?.addEventListener('click', () => {
        const name = prompt('Enter feature name:');
        if (!name) return;
        const desc = prompt('Enter feature description (optional):') || '';
        const newFeat = {
            id: 'custom_f_' + Date.now(),
            name: name.trim(),
            description: desc.trim(),
            actionType: 'passive',
            category: 'Custom Features',
            checked: true
        };
        workingChar.customFeatures.push(newFeat);
        allCandidateAbilities.push(newFeat);
        renderStep4(ctx);
        updateCountsDisplay();
    });

    bodyEl.querySelectorAll('.pc-wiz-del-custom-feat').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            workingChar.customFeatures.splice(idx, 1);
            recomputeCandidates().then(() => renderStep4(ctx));
        });
    });
}
