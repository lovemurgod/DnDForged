/**
 * Character Builder Wizard - Step 1: Identity & Classes
 * Species, Subrace, Background, Multiclassing rows, Senses, Speeds, and Bio.
 */

export function renderStep1(ctx) {
    const {
        bodyEl,
        builderCache,
        disabledSources,
        isSourceAllowed,
        workingChar,
        recomputeCandidates,
        harvestCurrentStepInputs
    } = ctx;

    const rawRaces = (builderCache?.races || []).filter((r) => isSourceAllowed(r.source, r.name, disabledSources));
    const seenR = new Set();
    const baseRaces = [];
    rawRaces.forEach((r) => {
        const raw = r.raceName || r.name || '';
        const baseName = raw
            .replace(/\s*\[.*?\]$/, '')
            .replace(/\s*\([^)]*\).*$/, '')
            .trim();
        if (!baseName || seenR.has(baseName.toLowerCase())) return;
        seenR.add(baseName.toLowerCase());
        baseRaces.push({ name: baseName, source: r.source });
    });
    baseRaces.sort((a, b) => a.name.localeCompare(b.name));

    // Matching subraces
    const cleanBase = (workingChar.race || '')
        .replace(/\s*\[.*?\]$/, '')
        .replace(/\s*\([^)]*\).*$/, '')
        .trim()
        .toLowerCase();
    const matchingSubraces = [];
    const seenSub = new Set();
    rawRaces.forEach((r) => {
        const rBase = (r.raceName || r.name || '')
            .replace(/\s*\[.*?\]$/, '')
            .replace(/\s*\([^)]*\).*$/, '')
            .trim()
            .toLowerCase();
        if (rBase === cleanBase) {
            let sub = r.subraceName || (r.name && r.name.includes('(') ? r.name.match(/\(([^)]+)\)/)?.[1] : '');
            if (sub) {
                sub = sub.replace(/^variant;\s*/i, '').trim();
                if (!seenSub.has(sub.toLowerCase()) && isSourceAllowed(r.source, sub, disabledSources)) {
                    seenSub.add(sub.toLowerCase());
                    matchingSubraces.push({ name: sub, source: r.source });
                }
            }
        }
    });
    matchingSubraces.sort((a, b) => a.name.localeCompare(b.name));

    // Backgrounds
    const rawBgs = (builderCache?.bgs || []).filter((b) => isSourceAllowed(b.source, b.name, disabledSources));
    const bgList = rawBgs.map((b) => ({ name: b.name, source: b.source })).sort((a, b) => a.name.localeCompare(b.name));

    // Classes list
    const rawCls = (builderCache?.classes || []).filter((c) => isSourceAllowed(c.source, c.name, disabledSources));
    const clsList = rawCls
        .map((c) => ({ name: c.name, source: c.source }))
        .sort((a, b) => a.name.localeCompare(b.name));

    bodyEl.innerHTML = `
        <!-- Species, Subrace & Background Selection -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-dna text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Origin: Species, Lineage & Background</strong>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px;">Species / Race</label>
                    <select id="pc-wizard-race" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:6px;">
                        <option value="">-- Choose Species --</option>
                        ${baseRaces.map((r) => `<option value="${r.name}" ${workingChar.race === r.name && !workingChar.isCustomRace ? 'selected' : ''}>${r.name} [${r.source || 'PHB'}]</option>`).join('')}
                        <option value="__custom__" ${workingChar.isCustomRace ? 'selected' : ''}>➕ Custom / Homebrew Species...</option>
                    </select>
                    <input type="text" id="pc-wizard-custom-race" placeholder="Enter custom species name" value="${workingChar.customRaceText}" style="width:100%; margin-top:6px; display:${workingChar.isCustomRace ? 'block' : 'none'}; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                </div>

                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px;">Subrace / Lineage</label>
                    <select id="pc-wizard-subrace" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:6px;">
                        <option value="">None / Standard</option>
                        ${matchingSubraces.map((s) => `<option value="${s.name}" ${workingChar.subrace === s.name && !workingChar.isCustomSubrace ? 'selected' : ''}>${s.name} [${s.source || 'PHB'}]</option>`).join('')}
                        <option value="__custom__" ${workingChar.isCustomSubrace ? 'selected' : ''}>➕ Custom / Homebrew Subrace...</option>
                    </select>
                    <input type="text" id="pc-wizard-custom-subrace" placeholder="Enter custom subrace name" value="${workingChar.customSubraceText}" style="width:100%; margin-top:6px; display:${workingChar.isCustomSubrace ? 'block' : 'none'}; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                </div>

                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px;">Background</label>
                    <select id="pc-wizard-bg" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:6px;">
                        <option value="">-- Choose Background --</option>
                        ${bgList.map((b) => `<option value="${b.name}::${b.source || 'PHB'}" ${workingChar.background === b.name && (!workingChar.backgroundSource || (b.source || 'PHB').toUpperCase() === String(workingChar.backgroundSource || '').toUpperCase()) && !workingChar.isCustomBackground ? 'selected' : ''}>${b.name} [${b.source || 'PHB'}]</option>`).join('')}
                        <option value="__custom__" ${workingChar.isCustomBackground ? 'selected' : ''}>➕ Custom / Homebrew Background...</option>
                    </select>
                    <input type="text" id="pc-wizard-custom-bg" placeholder="Enter custom background name" value="${workingChar.customBackgroundText}" style="width:100%; margin-top:6px; display:${workingChar.isCustomBackground ? 'block' : 'none'}; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                </div>
            </div>
        </div>

        <!-- Multiclass Builder -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Classes & Multiclassing</strong>
                    <span class="builder-pill" style="color:#4fc3f7;">Total Level: ${workingChar.classes.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0)}</span>
                </div>
                <button type="button" id="pc-wiz-add-class-btn" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Multiclass</button>
            </div>
            <div id="pc-wiz-classes-container" style="display:flex; flex-direction:column; gap:8px;">
                ${workingChar.classes
            .map((cls, i) => {
                const curSrc = (cls.source || 'PHB').toUpperCase();
                const cObj =
                    builderCache?.classes?.find(
                        (c) =>
                            (c.name || '').toLowerCase() === (cls.name || '').toLowerCase() &&
                            (!cls.source || (c.source || 'PHB').toUpperCase() === curSrc)
                    ) ||
                    builderCache?.classes?.find(
                        (c) => (c.name || '').toLowerCase() === (cls.name || '').toLowerCase()
                    );
                const availableSubs = (cObj?.subclasses || []).filter((s) => {
                    const subSrc = (s.source || cls.source || 'PHB').toUpperCase();
                    if (!isSourceAllowed(subSrc, s.name, disabledSources)) return false;
                    if (curSrc === 'PHB') {
                        if (subSrc === 'XPHB' || subSrc.startsWith('XUA')) return false;
                    } else if (curSrc === 'XPHB') {
                        if (subSrc === 'PHB') return false;
                    }
                    if (disabledSources && disabledSources.has('UA')) {
                        if (subSrc.startsWith('UA') || subSrc.startsWith('XUA') || s.name.includes('(UA)'))
                            return false;
                    }
                    return true;
                });
                const hasSubs = availableSubs.length > 0;
                return `
                    <div class="glass-flat" style="padding:10px 12px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; border:1px solid var(--color-border-subtle); border-radius:6px;">
                        <div class="form-group" style="flex:2; min-width:140px;">
                            <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:600;">${i === 0 ? 'Primary Class' : 'Multiclass ' + (i + 1)}</label>
                            <select class="pc-wiz-cls-sel" data-idx="${i}" style="width:100%; padding:6px 8px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                ${clsList.map((c) => `<option value="${c.name}::${c.source || 'PHB'}" ${cls.name === c.name && (!cls.source || cls.source === c.source) ? 'selected' : ''}>${c.name} [${c.source || 'PHB'}]</option>`).join('')}
                                <option value="__custom__" ${cls.isCustomClass ? 'selected' : ''}>➕ Custom Class...</option>
                            </select>
                            <input type="text" class="pc-wiz-custom-cls-input" data-idx="${i}" placeholder="Enter custom class name" value="${cls.customClassText || ''}" style="width:100%; margin-top:4px; display:${cls.isCustomClass ? 'block' : 'none'}; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                        </div>
                        <div class="form-group" style="flex:2; min-width:140px;">
                            <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:600;">Subclass</label>
                            ${hasSubs
                        ? `
                                <select class="pc-wiz-subclass-sel" data-idx="${i}" style="width:100%; padding:6px 8px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    <option value="">None / Base Class</option>
                                    ${availableSubs.map((s) => `<option value="${s.name}" ${cls.subclass === s.name && !cls.isCustomSubclass ? 'selected' : ''}>${s.name} [${s.source || 'PHB'}]</option>`).join('')}
                                    <option value="__custom__" ${cls.isCustomSubclass ? 'selected' : ''}>➕ Custom Subclass...</option>
                                </select>
                                <input type="text" class="pc-wiz-custom-subclass-input" data-idx="${i}" placeholder="Enter custom subclass name" value="${cls.customSubclassText || ''}" style="width:100%; margin-top:4px; display:${cls.isCustomSubclass ? 'block' : 'none'}; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                            `
                        : `
                                <input type="text" class="pc-wiz-subclass-input" data-idx="${i}" placeholder="None / e.g. Champion" value="${cls.subclass || ''}" style="width:100%; padding:6px 8px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            `
                    }
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:600;">Level</label>
                            <input type="number" class="pc-wiz-cls-lvl" data-idx="${i}" min="1" max="20" value="${cls.level || 1}" style="width:100%; padding:6px 8px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); font-weight:bold; border-radius:4px;">
                        </div>
                        <button type="button" class="btn btn-danger btn-sm pc-wiz-cls-del" data-idx="${i}" ${workingChar.classes.length <= 1 ? 'disabled' : ''} style="height:34px; padding:0 10px;" title="Remove Multiclass">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    `;
            })
            .join('')}
            </div>
        </div>

        <!-- Speeds & Senses Overrides -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-person-running text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Speeds & Senses (ft)</strong>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:10px; margin-bottom:10px;">
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Walk</label>
                    <input type="number" id="pc-wiz-spd-walk" value="${workingChar.speed.walk}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Climb</label>
                    <input type="number" id="pc-wiz-spd-climb" value="${workingChar.speed.climb}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Fly</label>
                    <input type="number" id="pc-wiz-spd-fly" value="${workingChar.speed.fly}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Burrow</label>
                    <input type="number" id="pc-wiz-spd-burrow" value="${workingChar.speed.burrow}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Darkvision</label>
                    <input type="number" id="pc-wiz-sns-darkvision" value="${workingChar.senses.darkvision}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Devil's Sight</label>
                    <input type="number" id="pc-wiz-sns-devilsight" value="${workingChar.senses.devilSight}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Blindsight</label>
                    <input type="number" id="pc-wiz-sns-blindsight" value="${workingChar.senses.blindsight}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Truesight</label>
                    <input type="number" id="pc-wiz-sns-truesight" value="${workingChar.senses.truesight}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
        </div>

        <!-- Bio & Description -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-book-open text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Character Bio & Background Details</strong>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Age</label>
                    <input type="text" id="pc-wiz-bio-age" value="${workingChar.bio.age}" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Height</label>
                    <input type="text" id="pc-wiz-bio-height" value="${workingChar.bio.height}" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Weight</label>
                    <input type="text" id="pc-wiz-bio-weight" value="${workingChar.bio.weight}" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label style="font-size:0.75rem; color:var(--color-text-muted);">Backstory</label>
                <textarea id="pc-wiz-bio-backstory" class="scroll-styled" style="width:100%; height:80px; resize:vertical; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:8px 10px; border-radius:6px; font-family:var(--font-primary); font-size:0.85rem;">${workingChar.bio.backstory}</textarea>
            </div>
            <div class="form-group">
                <label style="font-size:0.75rem; color:var(--color-text-muted);">Other Notes</label>
                <textarea id="pc-wiz-bio-notes" class="scroll-styled" style="width:100%; height:70px; resize:vertical; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:8px 10px; border-radius:6px; font-family:var(--font-primary); font-size:0.85rem;">${workingChar.bio.notes}</textarea>
            </div>
        </div>
    `;

    // Step 1 Event Listeners
    const rSel = document.getElementById('pc-wizard-race');
    const custR = document.getElementById('pc-wizard-custom-race');
    rSel?.addEventListener('change', () => {
        if (rSel.value === '__custom__') {
            if (custR) custR.style.display = 'block';
            workingChar.isCustomRace = true;
        } else {
            if (custR) custR.style.display = 'none';
            workingChar.isCustomRace = false;
            workingChar.race = rSel.value;
            workingChar.subrace = '';
        }
        recomputeCandidates().then(() => renderStep1(ctx));
    });

    const sSel = document.getElementById('pc-wizard-subrace');
    const custS = document.getElementById('pc-wizard-custom-subrace');
    sSel?.addEventListener('change', () => {
        if (sSel.value === '__custom__') {
            if (custS) custS.style.display = 'block';
            workingChar.isCustomSubrace = true;
        } else {
            if (custS) custS.style.display = 'none';
            workingChar.isCustomSubrace = false;
            workingChar.subrace = sSel.value;
        }
        recomputeCandidates();
    });

    const bgSel = document.getElementById('pc-wizard-bg');
    const custBg = document.getElementById('pc-wizard-custom-bg');
    bgSel?.addEventListener('change', () => {
        if (bgSel.value === '__custom__') {
            if (custBg) custBg.style.display = 'block';
            workingChar.isCustomBackground = true;
        } else {
            if (custBg) custBg.style.display = 'none';
            workingChar.isCustomBackground = false;
            const [bName, bSrc] = bgSel.value.split('::');
            workingChar.background = bName || bgSel.value;
            workingChar.backgroundSource = bSrc || '';
        }
        recomputeCandidates();
    });

    document.getElementById('pc-wiz-add-class-btn')?.addEventListener('click', () => {
        harvestCurrentStepInputs();
        const currentNames = workingChar.classes.map((c) => c.name);
        const unused = clsList.find((c) => !currentNames.includes(c.name)) || clsList[0];
        workingChar.classes.push({
            name: unused?.name || 'Fighter',
            source: unused?.source || 'PHB',
            subclass: '',
            level: 1
        });
        recomputeCandidates().then(() => renderStep1(ctx));
    });

    document.querySelectorAll('.pc-wiz-cls-del').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            harvestCurrentStepInputs();
            const idx = parseInt(e.currentTarget.dataset.idx);
            if (workingChar.classes.length > 1) {
                workingChar.classes.splice(idx, 1);
                recomputeCandidates().then(() => renderStep1(ctx));
            }
        });
    });

    document.querySelectorAll('.pc-wiz-cls-sel').forEach((sel) => {
        sel.addEventListener('change', async (e) => {
            await harvestCurrentStepInputs();
            const idx = parseInt(e.target.dataset.idx);
            const custInput = document.querySelector(`.pc-wiz-custom-cls-input[data-idx="${idx}"]`);
            if (e.target.value === '__custom__') {
                if (custInput) custInput.style.display = 'block';
                workingChar.classes[idx].isCustomClass = true;
            } else {
                if (custInput) custInput.style.display = 'none';
                workingChar.classes[idx].isCustomClass = false;
                const [cName, cSrc] = e.target.value.split('::');
                workingChar.classes[idx].name = cName || e.target.value;
                workingChar.classes[idx].source = cSrc || 'PHB';
                workingChar.classes[idx].subclass = '';
            }
            await recomputeCandidates();
            renderStep1(ctx);
        });
    });

    document.querySelectorAll('.pc-wiz-subclass-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const custSub = document.querySelector(`.pc-wiz-custom-subclass-input[data-idx="${idx}"]`);
            if (e.target.value === '__custom__') {
                if (custSub) custSub.style.display = 'block';
                workingChar.classes[idx].isCustomSubclass = true;
            } else {
                if (custSub) custSub.style.display = 'none';
                workingChar.classes[idx].isCustomSubclass = false;
                workingChar.classes[idx].subclass = e.target.value;
            }
            recomputeCandidates();
        });
    });

    document.querySelectorAll('.pc-wiz-custom-subclass-input').forEach((input) => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            workingChar.classes[idx].customSubclassText = e.target.value.trim();
            workingChar.classes[idx].subclass = e.target.value.trim();
        });
    });

    document.querySelectorAll('.pc-wiz-subclass-input').forEach((input) => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            workingChar.classes[idx].subclass = e.target.value.trim();
        });
    });

    document.querySelectorAll('.pc-wiz-cls-lvl').forEach((input) => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            workingChar.classes[idx].level = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
            recomputeCandidates().then(() => renderStep1(ctx));
        });
    });
}
