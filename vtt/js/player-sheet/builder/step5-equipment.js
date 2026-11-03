/**
 * Character Builder Wizard - Step 5: Equipment & Gear
 * Class starting equipment choices, background gear, starting wealth, and weapon macros.
 */

export const MARTIAL_WEAPONS = [
    'Battleaxe',
    'Blowgun',
    'Club',
    'Dagger',
    'Dart',
    'Flail',
    'Glaive',
    'Greataxe',
    'Greatsword',
    'Halberd',
    'Hand Crossbow',
    'Heavy Crossbow',
    'Lance',
    'Longbow',
    'Longsword',
    'Maul',
    'Morningstar',
    'Net',
    'Pike',
    'Rapier',
    'Scimitar',
    'Shortsword',
    'Trident',
    'War Pick',
    'Warhammer',
    'Whip'
];

export const SIMPLE_WEAPONS = [
    'Club',
    'Dagger',
    'Greatclub',
    'Handaxe',
    'Javelin',
    'Light Crossbow',
    'Light Hammer',
    'Mace',
    'Quarterstaff',
    'Shortbow',
    'Sickle',
    'Spear',
    'Dart',
    'Sling'
];

export function renderStep5(ctx) {
    const { bodyEl, workingChar, classEquipChoiceSets, classFixedItems, candidateBgItems, updateCountsDisplay } = ctx;

    bodyEl.innerHTML = `
        <!-- Equipment Mode Selection -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield-halved text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Starting Equipment & Wealth</strong>
                </div>
            </div>
            <div style="display:flex; gap:16px; margin-bottom:12px; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="pc-wiz-equip-mode" value="packages" ${!workingChar.useStartingWealth ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                    <span>Starting Equipment Packages</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="pc-wiz-equip-mode" value="wealth" ${workingChar.useStartingWealth ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                    <span>Starting Wealth / Gold Alternative</span>
                </label>
            </div>

            <div style="padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="pc-wiz-auto-macro-chk" ${workingChar.autoWeaponMacros ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                    <span style="font-size:0.85rem; color:var(--color-gold-light);">Automatically create rollable attack macros for all imported weapons</span>
                </label>
            </div>
        </div>

        ${
            !workingChar.useStartingWealth
                ? `
            <!-- Class Starting Equipment -->
            ${
                classEquipChoiceSets.length > 0 || classFixedItems.length > 0
                    ? `
                <div class="builder-section-box">
                    <div class="builder-section-header">
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Class Starting Equipment (${workingChar.classes[0]?.name || 'Primary Class'})</strong>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${classEquipChoiceSets
                            .map(
                                (cSet, csIdx) => `
                            <div class="glass-flat" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                                <div style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light); margin-bottom:6px;">${cSet.title}</div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    ${cSet.options
                                        .map((opt) => {
                                            const optLower = (opt.label || '').toLowerCase();
                                            const isDualWeapon = /two\s+(martial|simple)\s+weapons/i.test(optLower);
                                            const isGenericWeapon =
                                                optLower.includes('martial weapon') ||
                                                optLower.includes('simple weapon') ||
                                                isDualWeapon;
                                            const isMartial = optLower.includes('martial weapon');
                                            const weaponList = isMartial ? MARTIAL_WEAPONS : SIMPLE_WEAPONS;
                                            const isSelected = cSet.selectedOption === opt.key;
                                            if (isDualWeapon) {
                                                if (!cSet.selectedWeapon1 || !weaponList.includes(cSet.selectedWeapon1))
                                                    cSet.selectedWeapon1 = weaponList[0];
                                                if (!cSet.selectedWeapon2 || !weaponList.includes(cSet.selectedWeapon2))
                                                    cSet.selectedWeapon2 = weaponList[1] || weaponList[0];
                                            } else if (
                                                isGenericWeapon &&
                                                (!cSet.selectedWeapon || !weaponList.includes(cSet.selectedWeapon))
                                            ) {
                                                cSet.selectedWeapon = weaponList[0];
                                            }
                                            return `
                                        <div style="display:flex; flex-direction:column; gap:4px;">
                                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem; color:var(--color-text-primary);">
                                                <input type="radio" name="pc-wiz-choice-${csIdx}" value="${opt.key}" ${isSelected ? 'checked' : ''} class="pc-wiz-eq-choice-radio" data-csidx="${csIdx}" style="accent-color:var(--color-gold-base);">
                                                <span><strong>(${opt.key.toUpperCase()})</strong> ${opt.label}</span>
                                            </label>
                                            ${
                                                isDualWeapon && isSelected
                                                    ? `
                                                <div style="margin-left:24px; display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                                                    <div style="display:flex; align-items:center; gap:8px;">
                                                        <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Weapon 1:</span>
                                                        <select class="pc-wiz-eq-weapon-sel1" data-csidx="${csIdx}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                            ${weaponList.map((w) => `<option value="${w}" ${cSet.selectedWeapon1 === w ? 'selected' : ''}>${w}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                    <div style="display:flex; align-items:center; gap:8px;">
                                                        <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Weapon 2:</span>
                                                        <select class="pc-wiz-eq-weapon-sel2" data-csidx="${csIdx}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                            ${weaponList.map((w) => `<option value="${w}" ${cSet.selectedWeapon2 === w ? 'selected' : ''}>${w}</option>`).join('')}
                                                        </select>
                                                    </div>
                                                </div>
                                            `
                                                    : isGenericWeapon && isSelected
                                                      ? `
                                                <div style="margin-left:24px; display:flex; align-items:center; gap:8px; margin-top:4px;">
                                                    <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Select Weapon:</span>
                                                    <select class="pc-wiz-eq-weapon-sel" data-csidx="${csIdx}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                        ${weaponList.map((w) => `<option value="${w}" ${cSet.selectedWeapon === w ? 'selected' : ''}>${w}</option>`).join('')}
                                                    </select>
                                                </div>
                                            `
                                                      : ''
                                            }
                                        </div>
                                        `;
                                        })
                                        .join('')}
                                </div>
                            </div>
                        `
                            )
                            .join('')}

                        ${
                            classFixedItems.length > 0
                                ? `
                            <div class="glass-flat" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                                <div style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light); margin-bottom:6px;">Standard Class Items</div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    ${classFixedItems
                                        .map((fit) => {
                                            const fitLower = (fit.name || '').toLowerCase();
                                            const isGenericWeapon =
                                                fitLower.includes('simple weapon') ||
                                                fitLower.includes('martial weapon');
                                            const isMartial = fitLower.includes('martial weapon');
                                            const weaponList = isMartial ? MARTIAL_WEAPONS : SIMPLE_WEAPONS;
                                            if (
                                                isGenericWeapon &&
                                                (!fit.selectedWeapon || !weaponList.includes(fit.selectedWeapon))
                                            ) {
                                                fit.selectedWeapon = weaponList[0];
                                            }
                                            return `
                                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:0.85rem; color:var(--color-text-primary); flex-wrap:wrap;">
                                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                                <input type="checkbox" class="pc-wiz-fixed-item-chk" data-item-id="${fit.id}" ${fit.checked ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                                                <span>${fit.name}</span>
                                            </label>
                                            ${
                                                isGenericWeapon
                                                    ? `
                                                <div style="display:flex; align-items:center; gap:6px;">
                                                    <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Select Weapon:</span>
                                                    <select class="pc-wiz-fixed-weapon-sel" data-fitid="${fit.id}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                        ${weaponList.map((w) => `<option value="${w}" ${fit.selectedWeapon === w ? 'selected' : ''}>${w}</option>`).join('')}
                                                    </select>
                                                </div>
                                            `
                                                    : ''
                                            }
                                        </div>
                                        `;
                                        })
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

            <!-- Background Items -->
            ${
                candidateBgItems.length > 0
                    ? `
                <div class="builder-section-box">
                    <div class="builder-section-header">
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Background Items (${workingChar.background || 'Background'})</strong>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${candidateBgItems
                            .map(
                                (it) => `
                            <label class="glass-flat" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:center; cursor:pointer;">
                                <input type="checkbox" class="pc-wiz-bg-item-chk" data-item-id="${it.id}" ${it.checked ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                                <span style="font-weight:600; color:var(--color-text-primary);">${it.name} ${it.qty > 1 && !it.isGold && it.type !== 'Currency' ? `(x${it.qty})` : ''}</span>
                            </label>
                        `
                            )
                            .join('')}
                    </div>
                </div>
            `
                    : ''
            }
        `
                : `
            <!-- Starting Wealth Input -->
            <div class="builder-section-box">
                <strong style="color:var(--color-gold-light); font-size:0.95rem;">Starting Wealth (Gold Pieces)</strong>
                <div style="display:flex; gap:10px; align-items:center; margin-top:8px;">
                    <input type="number" id="pc-wiz-starting-gold" min="0" value="${workingChar.startingGoldAmount}" style="width:120px; padding:8px 12px; font-size:1.1rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); border-radius:4px; text-align:center;">
                    <span style="color:var(--color-gold-base); font-weight:bold;">GP</span>
                </div>
            </div>
        `
        }
    `;

    // Step 5 Event Listeners
    bodyEl.querySelectorAll('input[name="pc-wiz-equip-mode"]').forEach((r) => {
        r.addEventListener('change', (e) => {
            workingChar.useStartingWealth = e.target.value === 'wealth';
            renderStep5(ctx);
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-eq-choice-radio').forEach((r) => {
        r.addEventListener('change', (e) => {
            const csIdx = parseInt(e.target.dataset.csidx);
            if (classEquipChoiceSets[csIdx]) {
                classEquipChoiceSets[csIdx].selectedOption = e.target.value;
            }
            renderStep5(ctx);
            updateCountsDisplay();
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-eq-weapon-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const csIdx = parseInt(e.target.dataset.csidx);
            if (classEquipChoiceSets[csIdx]) {
                classEquipChoiceSets[csIdx].selectedWeapon = e.target.value;
            }
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-eq-weapon-sel1').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const csIdx = parseInt(e.target.dataset.csidx);
            if (classEquipChoiceSets[csIdx]) {
                classEquipChoiceSets[csIdx].selectedWeapon1 = e.target.value;
            }
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-eq-weapon-sel2').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const csIdx = parseInt(e.target.dataset.csidx);
            if (classEquipChoiceSets[csIdx]) {
                classEquipChoiceSets[csIdx].selectedWeapon2 = e.target.value;
            }
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-fixed-weapon-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const fitId = e.target.dataset.fitid;
            const fit = classFixedItems.find((x) => x.id === fitId);
            if (fit) fit.selectedWeapon = e.target.value;
        });
    });

    bodyEl.querySelectorAll('.pc-wiz-fixed-item-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.itemId;
            const it = classFixedItems.find((x) => x.id === id);
            if (it) it.checked = e.target.checked;
            updateCountsDisplay();
        });
    });

    document.getElementById('pc-wiz-auto-macro-chk')?.addEventListener('change', (e) => {
        workingChar.autoWeaponMacros = e.target.checked;
    });

    bodyEl.querySelectorAll('.pc-wiz-bg-item-chk').forEach((chk) => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.itemId;
            const it = candidateBgItems.find((x) => x.id === id);
            if (it) it.checked = e.target.checked;
            updateCountsDisplay();
        });
    });

    document.getElementById('pc-wiz-starting-gold')?.addEventListener('change', (e) => {
        workingChar.startingGoldAmount = parseInt(e.target.value) || 0;
    });
}
