/**
 * Character Builder Wizard - Step 3: Proficiencies & Skills
 * Saving Throws, Armor/Weapons, Background Skills, Class Skills, and Class Expertise selection.
 */

export function renderStep3(ctx) {
    const {
        bodyEl,
        workingChar,
        candidateProficiencies,
        candidateSpeciesSkills = [],
        candidateLanguages = [],
        candidateTools = [],
        candidateBgSkills,
        availableClassSkills,
        selectedClassSkills,
        classSkillLimit,
        multiclassSkillSections = [],
        selectedMulticlassSkills = new Map(),
        classExpertiseLimit = 0,
        updateCountsDisplay
    } = ctx;

    workingChar.expertise = workingChar.expertise || {};

    // Gather all proficient skills eligible for expertise
    const allProficientSkills = new Set();
    candidateSpeciesSkills.forEach((s) => allProficientSkills.add(s));
    candidateBgSkills.forEach((s) => allProficientSkills.add(s));
    selectedClassSkills.forEach((s) => allProficientSkills.add(s));
    selectedMulticlassSkills.forEach((set) => {
        set.forEach((s) => allProficientSkills.add(s));
    });
    candidateProficiencies
        .filter((p) => p.type === 'skill' && p.checked)
        .forEach((p) => allProficientSkills.add(p.label));

    // If Rogue or Artificer, also allow Thieves' Tools for expertise
    const isRogue = (workingChar.classes || []).some((c) => (c.name || '').toLowerCase() === 'rogue');
    if (isRogue || candidateTools.some((t) => t.toLowerCase().includes('thieves'))) {
        allProficientSkills.add("Thieves' Tools");
    }

    // Clean up any expertise in workingChar for skills no longer proficient
    Object.keys(workingChar.expertise).forEach((sk) => {
        if (!allProficientSkills.has(sk)) {
            delete workingChar.expertise[sk];
        }
    });

    const selectedExpertiseCount = Object.keys(workingChar.expertise).filter((k) => !!workingChar.expertise[k]).length;

    bodyEl.innerHTML = `
        <!-- Saving Throws -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-award text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Saving Throw Proficiencies</strong>
                    <span class="builder-pill">${workingChar.classes[0]?.name || 'Primary Class'}</span>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${candidateProficiencies
                    .filter((p) => p.type === 'save')
                    .map(
                        (p) => `
                    <label class="builder-badge-check ${p.checked ? 'is-checked' : ''}" style="margin:0; cursor:pointer;">
                        <input type="checkbox" class="pc-wiz-prof-chk" data-prof-id="${p.id}" ${p.checked ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                        <strong>${p.label}</strong>
                    </label>
                `
                    )
                    .join('')}
            </div>
        </div>

        <!-- Armor & Weapons -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield-halved text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Armor & Weapon Proficiencies</strong>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${candidateProficiencies
                    .filter((p) => p.type !== 'save')
                    .map(
                        (p) => `
                    <label class="builder-badge-check ${p.checked ? 'is-checked' : ''}" style="margin:0; cursor:pointer;">
                        <input type="checkbox" class="pc-wiz-prof-chk" data-prof-id="${p.id}" ${p.checked ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                        <span>${p.label}</span>
                    </label>
                `
                    )
                    .join('')}
            </div>
        </div>

        <!-- Skill Proficiencies -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-graduation-cap text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Skill Proficiencies</strong>
                    <span class="builder-pill" style="color:#4fc3f7;">Class Skills: <strong>${selectedClassSkills.size} / ${classSkillLimit}</strong></span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${
                    candidateSpeciesSkills.length > 0
                        ? `
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Species Skills (Granted by ${workingChar.race || 'Species'})
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${candidateSpeciesSkills
                                .map(
                                    (s) => `
                                <div class="builder-badge-check is-bg" style="margin:0; border-color:rgba(129,199,132,0.4);" title="Granted by Species">
                                    <i class="fa-solid fa-check" style="font-size:0.75rem; color:#81c784;"></i>
                                    <strong>${s}</strong>
                                    <span class="badge" style="font-size:0.65rem; background:rgba(129,199,132,0.2); color:#81c784; padding:0 4px; border-radius:3px;">Species</span>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                `
                        : ''
                }

                ${
                    candidateBgSkills.length > 0
                        ? `
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Background Skills (Granted by ${workingChar.background || 'Background'})
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${candidateBgSkills
                                .map(
                                    (s) => `
                                <div class="builder-badge-check is-bg" style="margin:0;" title="Granted by Background">
                                    <i class="fa-solid fa-check" style="font-size:0.75rem;"></i>
                                    <strong>${s}</strong>
                                    <span class="badge" style="font-size:0.65rem; background:rgba(255,255,255,0.1); padding:0 4px; border-radius:3px;">Background</span>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                `
                        : ''
                }

                <div>
                    <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                        Class Skills (Choose up to ${classSkillLimit} for ${workingChar.classes[0]?.name || 'Primary Class'})
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${availableClassSkills
                            .map((s) => {
                                const isGrantedBySpecies = candidateSpeciesSkills.includes(s);
                                const isGrantedByBg = candidateBgSkills.includes(s);
                                const isAlreadyGranted = isGrantedBySpecies || isGrantedByBg;
                                const isChecked = selectedClassSkills.has(s);
                                const isDisabled = isAlreadyGranted || (!isChecked && selectedClassSkills.size >= classSkillLimit);
                                return `
                                <label class="builder-badge-check ${isChecked || isAlreadyGranted ? 'is-checked' : ''} ${isDisabled ? 'is-disabled' : ''}" style="margin:0; cursor:${isAlreadyGranted ? 'default' : 'pointer'};" title="${isGrantedBySpecies ? 'Already granted by Species' : isGrantedByBg ? 'Already granted by Background' : ''}">
                                    <input type="checkbox" class="pc-wiz-class-skill-chk" data-skill="${s}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} style="accent-color:var(--color-gold-base);">
                                    <span>${s}</span>
                                    ${isAlreadyGranted ? '<span style="font-size:0.65rem; opacity:0.7;">(Granted)</span>' : ''}
                                </label>
                            `;
                            })
                            .join('')}
                    </div>
                </div>

                ${
                    multiclassSkillSections.length > 0
                        ? multiclassSkillSections
                              .map((sec) => {
                                  const curSet = selectedMulticlassSkills.get(sec.classIdx) || new Set();
                                  return `
                    <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Multiclass Skills (Choose ${sec.limit} for ${sec.className}): <strong style="color:#4fc3f7;">${curSet.size} / ${sec.limit}</strong>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${sec.from
                                .map((s) => {
                                    const isGrantedElsewhere = candidateSpeciesSkills.includes(s) || candidateBgSkills.includes(s) || selectedClassSkills.has(s);
                                    const isChecked = curSet.has(s);
                                    const isDisabled = isGrantedElsewhere || (!isChecked && curSet.size >= sec.limit);
                                    return `
                                    <label class="builder-badge-check ${isChecked ? 'is-checked' : ''} ${isDisabled ? 'is-disabled' : ''}" style="margin:0; cursor:${isGrantedElsewhere ? 'default' : 'pointer'};">
                                        <input type="checkbox" class="pc-wiz-mc-skill-chk" data-cidx="${sec.classIdx}" data-skill="${s}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} style="accent-color:var(--color-gold-base);">
                                        <span>${s}</span>
                                    </label>
                                `;
                                })
                                .join('')}
                        </div>
                    </div>
                `;
                              })
                              .join('')
                        : ''
                }
            </div>
        </div>

        <!-- Languages & Tool Proficiencies Confirmation -->
        ${
            candidateLanguages.length > 0 || candidateTools.length > 0
                ? `
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-language text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Languages & Tools</strong>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${
                    candidateLanguages.length > 0
                        ? `
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Languages
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${candidateLanguages
                                .map(
                                    (l) => `
                                <div class="builder-badge-check is-bg" style="margin:0;">
                                    <i class="fa-solid fa-comment-dots" style="font-size:0.75rem; color:#4fc3f7;"></i>
                                    <strong>${l}</strong>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                `
                        : ''
                }
                ${
                    candidateTools.length > 0
                        ? `
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Tool Proficiencies
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${candidateTools
                                .map(
                                    (t) => `
                                <div class="builder-badge-check is-bg" style="margin:0;">
                                    <i class="fa-solid fa-wrench" style="font-size:0.75rem; color:var(--color-gold-base);"></i>
                                    <strong>${t}</strong>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                `
                        : ''
                }
            </div>
        </div>
        `
                : ''
        }

        <!-- Class Expertise (Rogue, Bard, Ranger Canny) -->
        ${
            classExpertiseLimit > 0
                ? `
        <div class="builder-section-box" style="border-left:3px solid var(--color-gold-base);">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-star text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Class Expertise</strong>
                    <span class="builder-pill" style="color:${selectedExpertiseCount >= classExpertiseLimit ? '#2ecc71' : '#f59e0b'};">
                        Expertise: <strong>${selectedExpertiseCount} / ${classExpertiseLimit}</strong>
                    </span>
                </div>
            </div>
            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:8px;">
                Choose proficiencies for expertise (double your proficiency bonus). You can select from your proficient skills${isRogue ? " or Thieves' Tools" : ''}.
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${Array.from(allProficientSkills)
                    .map((sk) => {
                        const isExp = !!workingChar.expertise[sk];
                        const isDisabled = !isExp && selectedExpertiseCount >= classExpertiseLimit;
                        return `
                        <label class="builder-badge-check ${isExp ? 'is-checked' : ''} ${isDisabled ? 'is-disabled' : ''}" style="margin:0; cursor:pointer;">
                            <input type="checkbox" class="pc-wiz-expertise-chk" data-skill="${sk}" ${isExp ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} style="accent-color:var(--color-gold-base);">
                            <i class="fa-solid fa-star" style="font-size:0.7rem; color:${isExp ? 'var(--color-gold-base)' : 'var(--color-text-muted)'};"></i>
                            <strong>${sk}</strong>
                        </label>
                    `;
                    })
                    .join('')}
            </div>
        </div>
        `
                : ''
        }
    `;

    // Step 3 Event Listeners
    bodyEl.querySelectorAll('.pc-wiz-prof-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const profId = e.target.dataset.profId;
            const p = candidateProficiencies.find((x) => x.id === profId);
            if (p) p.checked = e.target.checked;
            updateCountsDisplay();
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-class-skill-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const sk = e.target.dataset.skill;
            if (e.target.checked) selectedClassSkills.add(sk);
            else selectedClassSkills.delete(sk);
            renderStep3(ctx);
            updateCountsDisplay();
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-mc-skill-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const cIdx = parseInt(e.target.dataset.cidx);
            const sk = e.target.dataset.skill;
            if (!selectedMulticlassSkills.has(cIdx)) {
                selectedMulticlassSkills.set(cIdx, new Set());
            }
            const set = selectedMulticlassSkills.get(cIdx);
            if (e.target.checked) set.add(sk);
            else set.delete(sk);
            renderStep3(ctx);
            updateCountsDisplay();
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-expertise-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const sk = e.target.dataset.skill;
            if (e.target.checked) {
                workingChar.expertise[sk] = true;
            } else {
                delete workingChar.expertise[sk];
            }
            renderStep3(ctx);
            updateCountsDisplay();
        });
    });
}
