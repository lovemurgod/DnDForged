/**
 * Character Builder Wizard - Step 3: Proficiencies & Skills
 * Saving Throws, Armor/Weapons, Background Skills, Class Skills, and Class Expertise selection.
 */

export function renderStep3(ctx) {
    const {
        bodyEl,
        workingChar,
        candidateProficiencies,
        candidateBgSkills,
        availableClassSkills,
        selectedClassSkills,
        classSkillLimit,
        classExpertiseLimit = 0,
        updateCountsDisplay
    } = ctx;

    workingChar.expertise = workingChar.expertise || {};

    // Gather all proficient skills eligible for expertise
    const allProficientSkills = new Set();
    candidateBgSkills.forEach((s) => allProficientSkills.add(s));
    selectedClassSkills.forEach((s) => allProficientSkills.add(s));
    candidateProficiencies
        .filter((p) => p.type === 'skill' && p.checked)
        .forEach((p) => allProficientSkills.add(p.label));

    // If Rogue, also allow Thieves' Tools for expertise
    const isRogue = (workingChar.classes || []).some((c) => (c.name || '').toLowerCase() === 'rogue');
    if (isRogue) {
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
                                const isChecked = selectedClassSkills.has(s);
                                const isDisabled = !isChecked && selectedClassSkills.size >= classSkillLimit;
                                return `
                                <label class="builder-badge-check ${isChecked ? 'is-checked' : ''} ${isDisabled ? 'is-disabled' : ''}" style="margin:0; cursor:pointer;">
                                    <input type="checkbox" class="pc-wiz-class-skill-chk" data-skill="${s}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} style="accent-color:var(--color-gold-base);">
                                    <span>${s}</span>
                                </label>
                            `;
                            })
                            .join('')}
                    </div>
                </div>
            </div>
        </div>

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
