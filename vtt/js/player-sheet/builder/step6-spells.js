/**
 * Character Builder Wizard - Step 7: Spells & Magic
 * Innate species magic, feat-granted magic, background guild/college expanded spells,
 * class spell lists, focus-preserving search, reactive counters.
 */

export function renderStep6(ctx) {
    const {
        bodyEl,
        classSpellSections,
        candidateInnateSpells,
        candidateBgExpandedSpells = [],
        asiTiers = [],
        builderCache,
        userSelectedSpellMap,
        updateCountsDisplay
    } = ctx;

    // Gather spells configured in Feats & ASIs
    const featSpells = [];
    (asiTiers || []).forEach((t) => {
        if (t.choice === 'feat' && t.selectedFeatId) {
            const featObj = (builderCache?.feats || []).find(
                (f) =>
                    (f.id || f.name) === t.selectedFeatId ||
                    (f.name || '').toLowerCase() === t.selectedFeatId.toLowerCase()
            );
            const fName = featObj ? featObj.name : 'Feat';
            const sub = t.featSubChoices || {};

            if (/fey[- ]touched/i.test(fName)) {
                featSpells.push({ name: 'Misty Step', level: 2, origin: fName });
                if (sub.spell1) featSpells.push({ name: sub.spell1, level: 1, origin: fName });
            } else if (/shadow[- ]touched/i.test(fName)) {
                featSpells.push({ name: 'Invisibility', level: 2, origin: fName });
                if (sub.spell1) featSpells.push({ name: sub.spell1, level: 1, origin: fName });
            } else if (
                /magic initiate/i.test(fName) ||
                /strixhaven initiate/i.test(fName) ||
                /initiate of high sorcery/i.test(fName)
            ) {
                if (sub.cantrip1) featSpells.push({ name: sub.cantrip1, level: 0, origin: fName });
                if (sub.cantrip2) featSpells.push({ name: sub.cantrip2, level: 0, origin: fName });
                if (sub.spell1) featSpells.push({ name: sub.spell1, level: 1, origin: fName });
            } else if (/artificer initiate/i.test(fName)) {
                if (sub.cantrip1) featSpells.push({ name: sub.cantrip1, level: 0, origin: fName });
                if (sub.spell1) featSpells.push({ name: sub.spell1, level: 1, origin: fName });
            } else if (/spell sniper/i.test(fName) || /scion of the outer planes/i.test(fName)) {
                if (sub.cantrip1) featSpells.push({ name: sub.cantrip1, level: 0, origin: fName });
            } else if (/rune shaper/i.test(fName)) {
                featSpells.push({ name: 'Comprehend Languages', level: 1, origin: fName });
                if (sub.spell1) featSpells.push({ name: sub.spell1, level: 1, origin: fName });
                if (sub.spell2) featSpells.push({ name: sub.spell2, level: 1, origin: fName });
            }
        }
    });

    const hasAnySpells =
        classSpellSections.length > 0 ||
        candidateInnateSpells.length > 0 ||
        candidateBgExpandedSpells.length > 0 ||
        featSpells.length > 0;

    if (!hasAnySpells) {
        bodyEl.innerHTML = `
            <div class="builder-section-box" style="text-align:center; padding:30px 20px;">
                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:2rem; color:var(--color-gold-base); margin-bottom:12px; opacity:0.6;"></i>
                <h4 style="color:var(--color-gold-light); margin:0 0 6px 0;">No Spells or Spellcasting Classes</h4>
                <div style="font-size:0.85rem; color:var(--color-text-muted); max-width:480px; margin:0 auto;">
                    Your current character classes, species, feats, and background do not grant spellcasting progression or innate spells. You can add spellcasting classes in Step 1, select a spellcasting feat in Step 6, or manage spells on the sheet later.
                </div>
            </div>
        `;
        return;
    }

    bodyEl.innerHTML = `
        <!-- Species & Innate Magic -->
        ${
            candidateInnateSpells.length > 0
                ? `
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-sparkles text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Species & Innate Magic</strong>
                        <span class="builder-pill" style="color:#81c784;">Auto-Granted (${candidateInnateSpells.length})</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${candidateInnateSpells
                        .map((isp) => {
                            const sName = isp.name || isp.spell?.name || 'Unknown Spell';
                            const sLevel =
                                isp.level !== undefined && isp.level !== null ? isp.level : isp.spell?.level || 0;
                            const sOrigin = isp.originName || isp.sourceLabel || isp.source || 'Innate';
                            const sSchool = isp.school || isp.spell?.school || '';
                            const sTime = isp.time || isp.spell?.time || '1 Action';
                            const sRange = isp.range || isp.spell?.range || 'Self';
                            return `
                            <div class="pc-wiz-spell-card" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); background:rgba(22,22,28,0.85); contain: content; display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <i class="fa-solid fa-check-circle" style="color:var(--color-gold-base);"></i>
                                    <strong style="color:var(--color-gold-light); font-size:0.85rem;">${sName}</strong>
                                    <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${sLevel === 0 ? 'Cantrip' : 'Lvl ' + sLevel}</span>
                                    <span class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-base); border:1px solid var(--color-gold-base); font-size:0.7rem; padding:1px 6px;">${sOrigin}</span>
                                    ${sSchool ? `<span style="font-size:0.75rem; color:var(--color-text-muted);">${sSchool}</span>` : ''}
                                </div>
                                <span style="font-size:0.75rem; color:var(--color-text-muted);">${sTime} &bull; ${sRange}</span>
                            </div>
                        `;
                        })
                        .join('')}
                </div>
            </div>
        `
                : ''
        }

        <!-- Feat Granted Magic -->
        ${
            featSpells.length > 0
                ? `
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-award text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Feat Granted Magic</strong>
                        <span class="builder-pill" style="color:#c084fc;">Configured in Feats (${featSpells.length})</span>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:6px;">
                    ${featSpells
                        .map(
                            (fsp) => `
                        <div class="pc-wiz-spell-card" style="padding:8px 12px; border-radius:6px; border:1px solid rgba(192,132,252,0.3); background:rgba(22,22,28,0.85); contain: content; display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-wand-sparkles" style="color:#c084fc;"></i>
                                <strong style="color:var(--color-text-primary); font-size:0.85rem;">${fsp.name}</strong>
                                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${fsp.level === 0 ? 'Cantrip' : 'Lvl ' + fsp.level}</span>
                            </div>
                            <span class="badge" style="background:rgba(192,132,252,0.15); color:#c084fc; font-size:0.7rem; padding:1px 6px;">${fsp.origin}</span>
                        </div>
                    `
                        )
                        .join('')}
                </div>
            </div>
        `
                : ''
        }

        <!-- Background Guild & College Expanded Spells Checklist -->
        ${
            candidateBgExpandedSpells.length > 0
                ? `
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <i class="fa-solid fa-scroll text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Background Guild & College Spells</strong>
                        <span id="pc-wiz-bg-spells-pill" class="builder-pill" style="color:#38bdf8;">
                            Selected: ${candidateBgExpandedSpells.filter((s) => s.checked).length} / ${candidateBgExpandedSpells.length}
                        </span>
                    </div>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:10px;">
                    These spells are added to your spell repertoire by your background. Toggle the spells you wish to have prepared or known.
                </div>
                <div class="pc-wiz-bg-spells-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:8px;">
                    ${candidateBgExpandedSpells
                        .map(
                            (sp, idx) => `
                        <div class="pc-wiz-spell-card ${sp.checked ? 'is-selected' : ''}" style="padding:8px 10px; border-radius:6px; border:1px solid ${sp.checked ? 'var(--color-gold-base)' : 'var(--color-border-subtle)'}; background:${sp.checked ? 'rgba(212,175,55,0.12)' : 'rgba(22,22,28,0.85)'}; contain: content; display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; min-width:0;">
                                    <input type="checkbox" class="pc-wiz-bg-spell-chk" data-idx="${idx}" ${sp.checked ? 'checked' : ''}>
                                    <strong style="font-size:0.85rem; color:var(--color-gold-light); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sp.name}</strong>
                                </label>
                                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${sp.level === 0 ? 'Cantrip' : 'Lvl ' + sp.level}</span>
                                <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:0.7rem; padding:1px 6px;">${sp.originName || 'Background'}</span>
                            </div>
                            <div style="font-size:0.75rem; color:var(--color-text-muted); display:flex; justify-content:space-between;">
                                <span>${sp.school || 'Magic'}</span>
                                <span>${sp.time || '1 action'} &bull; ${sp.range || 'Self'}</span>
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

        <!-- Class Spellcasting Progression -->
        ${
            classSpellSections.length === 0
                ? `
            <div class="builder-section-box" style="text-align:center; padding:20px;">
                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:1.8rem; color:var(--color-gold-base); margin-bottom:8px; opacity:0.6;"></i>
                <h4 style="color:var(--color-gold-light); margin:0 0 6px 0;">No Class Spellcasting Progression</h4>
                <div style="font-size:0.85rem; color:var(--color-text-muted); max-width:480px; margin:0 auto;">
                    Your current character classes do not prepare or learn spells from a class list. The innate species, feat, or background spells above will be imported automatically.
                </div>
            </div>
        `
                : classSpellSections
                      .map((sec, secIdx) => {
                          const cantripsChecked = sec.spells.filter((s) => s.isCantrip && s.checked).length;
                          const leveledChecked = sec.spells.filter((s) => !s.isCantrip && s.checked).length;
                          const cantripOver = cantripsChecked > sec.maxCantrips;
                          const spellOver = leveledChecked > sec.maxSpells;

                          // Apply filters
                          const filteredSpells = sec.spells.filter((sp) => {
                              if (sec.searchFilter && !sp.name.toLowerCase().includes(sec.searchFilter.toLowerCase()))
                                  return false;
                              if (sec.levelFilter === 'cantrip' && sp.level !== 0) return false;
                              if (
                                  sec.levelFilter !== 'all' &&
                                  sec.levelFilter !== 'cantrip' &&
                                  sp.level !== parseInt(sec.levelFilter)
                              )
                                  return false;
                              if (
                                  sec.schoolFilter !== 'all' &&
                                  (sp.school || '').toLowerCase() !== (sec.schoolFilter || '').toLowerCase()
                              )
                                  return false;
                              return true;
                          });

                          return `
                <div class="builder-section-box">
                    <div class="builder-section-header">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1;">
                            <i class="fa-solid fa-wand-magic-sparkles text-gradient-gold"></i>
                            <strong style="font-size:0.95rem; color:var(--color-gold-base);">${sec.className} Spells</strong>
                            <span id="pc-wiz-sec-cantrips-${secIdx}" class="builder-pill" style="color:${cantripOver ? '#ffb74d' : '#ba68c8'}; ${cantripOver ? 'border:1px solid #ffb74d; background:rgba(255,183,77,0.15);' : ''}">
                                Cantrips: ${cantripsChecked} / ${sec.maxCantrips}${cantripOver ? ' (Over Limit)' : ''}
                            </span>
                            <span id="pc-wiz-sec-spells-${secIdx}" class="builder-pill" style="color:${spellOver ? '#ffb74d' : '#4fc3f7'}; ${spellOver ? 'border:1px solid #ffb74d; background:rgba(255,183,77,0.15);' : ''}">
                                Spells: ${leveledChecked} / ${sec.maxSpells}${spellOver ? ' (Over Limit)' : ''}
                            </span>
                        </div>
                        <div style="display:flex; gap:6px; margin-left:auto;">
                            <button type="button" class="btn btn-secondary btn-xxs pc-wiz-sp-select-all" data-sec="${secIdx}"><i class="fa-solid fa-check-double"></i> Select All</button>
                            <button type="button" class="btn btn-secondary btn-xxs pc-wiz-sp-deselect-all" data-sec="${secIdx}"><i class="fa-solid fa-xmark"></i> Deselect All</button>
                        </div>
                    </div>

                    <!-- Filter Bar -->
                    <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                        <input type="text" class="pc-wiz-sp-search" data-sec="${secIdx}" placeholder="Search spells..." value="${sec.searchFilter || ''}" style="flex:2; min-width:140px; padding:6px 10px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                        <select class="pc-wiz-sp-lvl-filter" data-sec="${secIdx}" style="flex:1; min-width:110px; padding:6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            <option value="all" ${sec.levelFilter === 'all' ? 'selected' : ''}>All Levels</option>
                            <option value="cantrip" ${sec.levelFilter === 'cantrip' ? 'selected' : ''}>Cantrips</option>
                            ${Array.from({ length: Math.max(0, parseInt(sec.maxSlot) || 0) }, (_, i) => i + 1)
                                .map(
                                    (l) => `
                                <option value="${l}" ${sec.levelFilter === String(l) ? 'selected' : ''}>Level ${l}</option>
                            `
                                )
                                .join('')}
                        </select>
                    </div>

                    <!-- Spell Cards Grid -->
                    <div class="pc-wiz-spells-container" data-sec="${secIdx}" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:8px;">
                        ${filteredSpells
                            .map(
                                (sp) => `
                            <div class="pc-wiz-spell-card ${sp.checked ? 'is-selected' : ''}" data-name="${(sp.name || '').toLowerCase()}" data-school="${(sp.school || '').toLowerCase()}" data-level="${sp.level}" style="padding:8px 10px; border-radius:6px; border:1px solid ${sp.checked ? 'var(--color-gold-base)' : 'var(--color-border-subtle)'}; background:${sp.checked ? 'rgba(212,175,55,0.12)' : 'rgba(22,22,28,0.85)'}; contain: content; display:flex; flex-direction:column; gap:4px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; min-width:0;">
                                        <input type="checkbox" class="pc-wiz-spell-chk" data-sec="${secIdx}" data-spell-id="${sp.id}" ${sp.checked ? 'checked' : ''}>
                                        <strong style="font-size:0.85rem; color:var(--color-gold-light); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sp.name}</strong>
                                    </label>
                                    <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${sp.level === 0 ? 'Cantrip' : 'Lvl ' + sp.level}</span>
                                </div>
                                <div style="font-size:0.75rem; color:var(--color-text-muted); display:flex; justify-content:space-between;">
                                    <span>${sp.school || 'Magic'}</span>
                                    <span>${sp.time || '1 action'} &bull; ${sp.range || 'Self'}</span>
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>
            `;
                      })
                      .join('')
        }
    `;

    // Live filtering without destroying search input focus
    function applySpellFilters(secIdx) {
        const sec = classSpellSections[secIdx];
        if (!sec) return;
        const q = (sec.searchFilter || '').toLowerCase().trim();
        const lvl = sec.levelFilter || 'all';
        const container = bodyEl.querySelector(`.pc-wiz-spells-container[data-sec="${secIdx}"]`);
        if (!container) return;

        container.querySelectorAll('.pc-wiz-spell-card').forEach((card) => {
            const name = card.dataset.name || '';
            const school = card.dataset.school || '';
            const spLvl = parseInt(card.dataset.level) || 0;
            let match = true;
            if (q && !name.includes(q) && !school.includes(q)) match = false;
            if (lvl === 'cantrip' && spLvl !== 0) match = false;
            if (lvl !== 'all' && lvl !== 'cantrip' && spLvl !== parseInt(lvl)) match = false;
            card.style.display = match ? 'flex' : 'none';
        });
    }

    bodyEl.querySelectorAll('.pc-wiz-sp-search').forEach((input) => {
        input.addEventListener('input', (e) => {
            const secIdx = parseInt(e.target.dataset.sec);
            classSpellSections[secIdx].searchFilter = e.target.value;
            applySpellFilters(secIdx);
        });
    });

    function updateSecCounters(secIdx) {
        const sec = classSpellSections[secIdx];
        if (!sec) return;
        const cantripsChecked = sec.spells.filter((s) => s.isCantrip && s.checked).length;
        const leveledChecked = sec.spells.filter((s) => !s.isCantrip && s.checked).length;
        const cantripPill = document.getElementById(`pc-wiz-sec-cantrips-${secIdx}`);
        if (cantripPill) {
            const over = cantripsChecked > sec.maxCantrips;
            cantripPill.style.color = over ? '#ffb74d' : '#ba68c8';
            cantripPill.style.border = over ? '1px solid #ffb74d' : '';
            cantripPill.style.background = over ? 'rgba(255,183,77,0.15)' : '';
            cantripPill.textContent = `Cantrips: ${cantripsChecked} / ${sec.maxCantrips}${over ? ' (Over Limit)' : ''}`;
        }
        const spellPill = document.getElementById(`pc-wiz-sec-spells-${secIdx}`);
        if (spellPill) {
            const over = leveledChecked > sec.maxSpells;
            spellPill.style.color = over ? '#ffb74d' : '#4fc3f7';
            spellPill.style.border = over ? '1px solid #ffb74d' : '';
            spellPill.style.background = over ? 'rgba(255,183,77,0.15)' : '';
            spellPill.textContent = `Spells: ${leveledChecked} / ${sec.maxSpells}${over ? ' (Over Limit)' : ''}`;
        }
        updateCountsDisplay();
    }

    bodyEl.querySelectorAll('.pc-wiz-sp-select-all').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const secIdx = parseInt(e.currentTarget.dataset.sec);
            const sec = classSpellSections[secIdx];
            if (!sec) return;
            sec.spells.forEach((sp) => {
                sp.checked = true;
                if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), true);
            });
            const container = bodyEl.querySelector(`.pc-wiz-spells-container[data-sec="${secIdx}"]`);
            if (container) {
                container.querySelectorAll('.pc-wiz-spell-card').forEach((card) => {
                    const chk = card.querySelector('.pc-wiz-spell-chk');
                    if (chk) chk.checked = true;
                    card.classList.add('is-selected');
                    card.style.borderColor = 'var(--color-gold-base)';
                    card.style.background = 'rgba(212,175,55,0.12)';
                });
            }
            updateSecCounters(secIdx);
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-sp-deselect-all').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const secIdx = parseInt(e.currentTarget.dataset.sec);
            const sec = classSpellSections[secIdx];
            if (!sec) return;
            sec.spells.forEach((sp) => {
                sp.checked = false;
                if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), false);
            });
            const container = bodyEl.querySelector(`.pc-wiz-spells-container[data-sec="${secIdx}"]`);
            if (container) {
                container.querySelectorAll('.pc-wiz-spell-card').forEach((card) => {
                    const chk = card.querySelector('.pc-wiz-spell-chk');
                    if (chk) chk.checked = false;
                    card.classList.remove('is-selected');
                    card.style.borderColor = 'var(--color-border-subtle)';
                    card.style.background = 'rgba(22,22,28,0.85)';
                });
            }
            updateSecCounters(secIdx);
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-sp-lvl-filter').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const secIdx = parseInt(e.target.dataset.sec);
            classSpellSections[secIdx].levelFilter = e.target.value;
            applySpellFilters(secIdx);
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-spell-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const secIdx = parseInt(e.target.dataset.sec);
            const spId = e.target.dataset.spellId;
            const sec = classSpellSections[secIdx];
            if (!sec) return;
            const sp = sec.spells.find((x) => x.id === spId);
            if (sp) {
                sp.checked = e.target.checked;
                if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), chk.checked);
            }

            const card = e.target.closest('.pc-wiz-spell-card');
            if (card) {
                if (e.target.checked) {
                    card.classList.add('is-selected');
                    card.style.borderColor = 'var(--color-gold-base)';
                    card.style.background = 'rgba(212,175,55,0.12)';
                } else {
                    card.classList.remove('is-selected');
                    card.style.borderColor = 'var(--color-border-subtle)';
                    card.style.background = 'rgba(22,22,28,0.85)';
                }
            }

            const cantripsChecked = sec.spells.filter((s) => s.isCantrip && s.checked).length;
            const leveledChecked = sec.spells.filter((s) => !s.isCantrip && s.checked).length;
            const cantripPill = document.getElementById(`pc-wiz-sec-cantrips-${secIdx}`);
            if (cantripPill) {
                const over = cantripsChecked > sec.maxCantrips;
                cantripPill.style.color = over ? '#ffb74d' : '#ba68c8';
                cantripPill.style.border = over ? '1px solid #ffb74d' : '';
                cantripPill.style.background = over ? 'rgba(255,183,77,0.15)' : '';
                cantripPill.textContent = `Cantrips: ${cantripsChecked} / ${sec.maxCantrips}${over ? ' (Over Limit)' : ''}`;
            }
            const spellPill = document.getElementById(`pc-wiz-sec-spells-${secIdx}`);
            if (spellPill) {
                const over = leveledChecked > sec.maxSpells;
                spellPill.style.color = over ? '#ffb74d' : '#4fc3f7';
                spellPill.style.border = over ? '1px solid #ffb74d' : '';
                spellPill.style.background = over ? 'rgba(255,183,77,0.15)' : '';
                spellPill.textContent = `Spells: ${leveledChecked} / ${sec.maxSpells}${over ? ' (Over Limit)' : ''}`;
            }
            updateCountsDisplay();
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-bg-spell-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const sp = candidateBgExpandedSpells[idx];
            if (sp) {
                sp.checked = e.target.checked;
                if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), chk.checked);
            }

            const card = e.target.closest('.pc-wiz-spell-card');
            if (card) {
                if (e.target.checked) {
                    card.classList.add('is-selected');
                    card.style.borderColor = 'var(--color-gold-base)';
                    card.style.background = 'rgba(212,175,55,0.12)';
                } else {
                    card.classList.remove('is-selected');
                    card.style.borderColor = 'var(--color-border-subtle)';
                    card.style.background = 'rgba(22,22,28,0.85)';
                }
            }

            const bgPill = document.getElementById('pc-wiz-bg-spells-pill');
            if (bgPill) {
                const selCount = candidateBgExpandedSpells.filter((s) => s.checked).length;
                bgPill.textContent = `Selected: ${selCount} / ${candidateBgExpandedSpells.length}`;
            }
            updateCountsDisplay();
        });
    });
}

export const renderStepSpells = renderStep6;
export const renderStep7 = renderStep6;
