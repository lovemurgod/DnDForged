/**
 * Interactive Item Automation Wizard
 * Prompts user for attack macros, AC upgrades, and spell additions when items are added.
 */

export async function runItemAutomationWizard(queue, options = {}) {
    const {
        getCurrentChar = () => null,
        ensureItemModalsExist = () => {},
        saveAndEmit = () => {},
        renderSheetData = () => {},
        vttPlayerSheetAPI = window.vttPlayerSheetAPI,
        VTTSpellManager = window.VTTSpellManager
    } = options;

    const currentChar = getCurrentChar();
    if (!queue || !queue.length || !currentChar) return;
    ensureItemModalsExist();

    const overlay = document.getElementById('pc-item-automation-overlay');
    const modal = document.getElementById('pc-item-automation-modal');
    const iconEl = document.getElementById('pc-automation-icon');
    const titleEl = document.getElementById('pc-automation-title');
    const stepIndEl = document.getElementById('pc-automation-step-indicator');
    const bodyEl = document.getElementById('pc-automation-body');
    const actionsEl = document.getElementById('pc-automation-actions');

    if (!overlay || !modal) return;

    overlay.classList.remove('vtt-hidden');
    modal.classList.remove('vtt-hidden');

    let stepIndex = 0;

    function nextStep() {
        stepIndex++;
        if (stepIndex < queue.length) {
            renderStep(queue[stepIndex]);
        } else {
            overlay.classList.add('vtt-hidden');
            modal.classList.add('vtt-hidden');
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
        }
    }

    async function renderStep(step) {
        stepIndEl.textContent = `Step ${stepIndex + 1} of ${queue.length}`;

        if (step.type === 'weapon') {
            iconEl.className = 'fa-solid fa-burst text-gradient-gold';
            titleEl.textContent = 'Create Weapon Macro?';

            const tmpl = step.item.macroTemplate || {};
            const rawProps = Array.isArray(step.item.properties) ? step.item.properties : [];
            const props = rawProps.map((p) => (typeof p === 'string' ? p.toLowerCase() : ''));
            const isFinesse = tmpl.isFinesse !== undefined ? tmpl.isFinesse : props.some((p) => p.includes('finesse'));
            const isRanged =
                tmpl.isRanged !== undefined
                    ? tmpl.isRanged
                    : step.item.rawType === 'R' ||
                      (step.item.type || '').toLowerCase().includes('ranged') ||
                      props.some((p) => p.includes('ammunition'));

            const strVal = parseInt(currentChar.stats?.str) || 10;
            const dexVal = parseInt(currentChar.stats?.dex) || 10;
            let chosenStat = 'str';
            if (isRanged) chosenStat = 'dex';
            else if (isFinesse) chosenStat = dexVal >= strVal ? 'dex' : 'str';
            else if (tmpl.attackStat && tmpl.attackStat !== 'auto') chosenStat = tmpl.attackStat;

            let bonusVal = tmpl.attackExtra !== undefined ? tmpl.attackExtra : 0;
            if (!bonusVal && step.item.bonusWeapon) {
                bonusVal = parseInt(step.item.bonusWeapon) || 0;
            } else if (!bonusVal) {
                const match = step.name.match(/\+(\d+)/);
                if (match) bonusVal = parseInt(match[1]) || 0;
            }

            const rangeVal = tmpl.range || '5 ft';
            const targetVal = tmpl.target || '1 target';

            const dmgRows =
                tmpl.damageRows && tmpl.damageRows.length > 0
                    ? tmpl.damageRows.map((r, rIdx) => ({
                          id: 'dmg_' + Date.now() + '_' + rIdx,
                          formula: r.formula,
                          stat: r.stat === 'auto' ? chosenStat : r.stat || '',
                          extra: r.extra !== undefined ? r.extra : rIdx === 0 ? bonusVal : 0,
                          type: r.type || '',
                          label: r.label || ''
                      }))
                    : [
                          {
                              id: 'dmg_' + Date.now(),
                              formula: step.item.dmg1 || '1d6',
                              stat: chosenStat,
                              extra: bonusVal,
                              type: step.item.dmgType
                                  ? step.item.dmgType.charAt(0).toUpperCase() + step.item.dmgType.slice(1)
                                  : 'Slashing',
                              label: ''
                          }
                      ];

            const damageDisplay = dmgRows
                .map((r) => {
                    let s = `${r.formula}`;
                    if (r.stat) s += ` + ${r.stat.toUpperCase()}`;
                    if (r.extra) s += ` + ${r.extra}`;
                    s += ` ${r.type}`;
                    if (r.label) s += ` (${r.label})`;
                    return s;
                })
                .join(' + ');

            const versatileVal = tmpl.versatile || step.item.dmg2;
            const versatileText = versatileVal
                ? `<span style="color:var(--color-text-muted); font-size:0.75rem;">(Versatile: ${versatileVal})</span>`
                : '';

            bodyEl.innerHTML = `
                <div style="margin-bottom:12px;">
                    Would you like to generate an attack macro for <strong style="color:var(--color-gold-light); font-size:1rem;">${step.name}</strong> in the <strong>Attacks & Macros</strong> section?
                </div>
                <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:var(--color-text-secondary);">Optimal Stat:</span>
                        <span style="font-weight:bold; color:var(--color-gold-light);">${chosenStat.toUpperCase()} ${isFinesse ? '(Finesse)' : isRanged ? '(Ranged)' : '(Melee)'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:var(--color-text-secondary);">Attack Bonus:</span>
                        <span style="font-weight:bold; color:#4caf50;">Proficiency + ${chosenStat.toUpperCase()} Mod ${bonusVal > 0 ? `+ ${bonusVal}` : ''}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:var(--color-text-secondary);">Base Damage:</span>
                        <span style="font-weight:bold; color:var(--color-text-primary);">${damageDisplay} ${versatileText}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:var(--color-text-secondary);">Target Category:</span>
                        <span style="font-weight:bold; color:var(--color-gold-base);"><i class="fa-solid fa-folder"></i> Weapons</span>
                    </div>
                </div>
            `;

            actionsEl.innerHTML = `
                <button id="pc-auto-weapon-skip" class="btn btn-secondary btn-sm">Skip</button>
                <button id="pc-auto-weapon-create" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Create Macro</button>
            `;

            document.getElementById('pc-auto-weapon-skip').onclick = () => nextStep();
            document.getElementById('pc-auto-weapon-create').onclick = () => {
                let descNote = step.desc || '';
                if (versatileVal) {
                    descNote +=
                        (descNote ? '\n\n' : '') + `*Versatile:* Two-handed attack deals ${versatileVal} damage.`;
                }

                if (!currentChar.macroCategories) currentChar.macroCategories = [];
                let weapCat = currentChar.macroCategories.find((c) => c.name.toLowerCase() === 'weapons');
                if (!weapCat) {
                    weapCat = { id: 'cat_weapons', name: 'Weapons', collapsed: false };
                    currentChar.macroCategories.unshift(weapCat);
                }

                const isMagic = !!(tmpl.isMagic !== undefined
                    ? tmpl.isMagic
                    : step.item?.isMagic || step.item?.bonusWeapon || (step.name && /\+\d+/.test(step.name)));
                const isSilvered = !!(tmpl.isSilvered !== undefined
                    ? tmpl.isSilvered
                    : step.item?.isSilvered || (step.name && /silver/i.test(step.name)));
                const isAdamantine = !!(tmpl.isAdamantine !== undefined
                    ? tmpl.isAdamantine
                    : step.item?.isAdamantine || (step.name && /adamant/i.test(step.name)));

                if (!currentChar.macros) currentChar.macros = [];
                currentChar.macros.push({
                    id: 'mac_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: step.name,
                    categoryId: weapCat.id,
                    description: descNote,
                    range: rangeVal,
                    target: targetVal,
                    attackStat: chosenStat,
                    attackProf: true,
                    attackExtra: bonusVal,
                    critRange: 20,
                    attackBonus: '',
                    saveAbility: '',
                    saveDcStat: 'none',
                    saveDcExtra: 0,
                    saveDcCustom: null,
                    isMagic,
                    isSilvered,
                    isAdamantine,
                    damage: dmgRows
                });

                saveAndEmit(currentChar);
                renderSheetData(currentChar);
                nextStep();
            };
        } else if (step.type === 'ac') {
            iconEl.className = 'fa-solid fa-shield-halved text-gradient-gold';
            titleEl.textContent = 'Update AC?';

            const currentAC = parseInt(currentChar.ac) || 10;
            const dexMod = Math.floor(((parseInt(currentChar.stats?.dex) || 10) - 10) / 2);

            const nameLower = (step.item.name || '').toLowerCase();
            let itemType = (step.item.rawType || step.item.type || '').toUpperCase();
            if (!itemType || itemType === 'ARMOR' || itemType === 'GEAR') {
                if (
                    nameLower.includes('chain mail') ||
                    nameLower.includes('plate') ||
                    nameLower.includes('splint') ||
                    nameLower.includes('ring mail')
                ) {
                    itemType = 'HA';
                } else if (
                    nameLower.includes('chain shirt') ||
                    nameLower.includes('scale mail') ||
                    nameLower.includes('breastplate') ||
                    nameLower.includes('half plate') ||
                    nameLower.includes('hide')
                ) {
                    itemType = 'MA';
                } else if (nameLower.includes('leather') || nameLower.includes('padded')) {
                    itemType = 'LA';
                } else if (nameLower.includes('shield')) {
                    itemType = 'S';
                }
            }
            const bonusAc = step.item.bonusAc ? parseInt(step.item.bonusAc) || 0 : 0;

            let overwriteAC = currentAC;
            let addAC = currentAC;
            let calcDetail = '';

            if (itemType === 'HA' || itemType.includes('HEAVY')) {
                const baseAc = step.item.ac !== null && step.item.ac !== undefined ? step.item.ac : 16;
                overwriteAC = baseAc + bonusAc;
                addAC = currentAC + (bonusAc || 0);
                calcDetail = `Heavy Armor (Base ${baseAc}${bonusAc ? ` + ${bonusAc}` : ''}, no DEX mod)`;
            } else if (itemType === 'MA' || itemType.includes('MEDIUM')) {
                const baseAc = step.item.ac !== null && step.item.ac !== undefined ? step.item.ac : 14;
                const cappedDex = Math.min(2, Math.max(0, dexMod));
                overwriteAC = baseAc + cappedDex + bonusAc;
                addAC = currentAC + (bonusAc || 0);
                calcDetail = `Medium Armor (Base ${baseAc} + DEX max 2 [${cappedDex}]${bonusAc ? ` + ${bonusAc}` : ''})`;
            } else if (itemType === 'LA' || itemType.includes('LIGHT')) {
                const baseAc = step.item.ac !== null && step.item.ac !== undefined ? step.item.ac : 11;
                const uncappedDex = Math.max(0, dexMod);
                overwriteAC = baseAc + uncappedDex + bonusAc;
                addAC = currentAC + (bonusAc || 0);
                calcDetail = `Light Armor (Base ${baseAc} + DEX [${uncappedDex}]${bonusAc ? ` + ${bonusAc}` : ''})`;
            } else if (itemType === 'S' || itemType.includes('SHIELD')) {
                const shieldBonus = step.item.ac !== null && step.item.ac !== undefined ? step.item.ac : 2 + bonusAc;
                addAC = currentAC + shieldBonus;
                overwriteAC = addAC;
                calcDetail = `Shield (+${shieldBonus} AC)`;
            } else {
                const bonus = bonusAc || step.item.ac || 1;
                addAC = currentAC + bonus;
                overwriteAC = addAC;
                calcDetail = `AC Bonus Item (+${bonus} AC)`;
            }

            bodyEl.innerHTML = `
                <div style="margin-bottom:12px;">
                    <strong style="color:var(--color-gold-light); font-size:1rem;">${step.name}</strong> modifies Armor Class. How would you like to update your AC?
                </div>
                <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:6px; padding:12px; margin-bottom:12px; font-size:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="color:var(--color-text-secondary);">Current AC:</span>
                        <span style="font-size:1.15rem; font-weight:bold; color:var(--color-gold-base);">${currentAC}</span>
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">${calcDetail}</div>
                </div>
            `;

            actionsEl.innerHTML = `
                <button id="pc-auto-ac-skip" class="btn btn-secondary btn-sm">Keep Current (${currentAC})</button>
                <button id="pc-auto-ac-add" class="btn btn-secondary btn-sm" style="border-color:var(--color-gold-base);"><i class="fa-solid fa-plus"></i> Add (${addAC})</button>
                <button id="pc-auto-ac-overwrite" class="btn btn-primary btn-sm"><i class="fa-solid fa-check"></i> Overwrite (${overwriteAC})</button>
            `;

            document.getElementById('pc-auto-ac-skip').onclick = () => nextStep();
            document.getElementById('pc-auto-ac-add').onclick = () => {
                currentChar.ac = addAC;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
                nextStep();
            };
            document.getElementById('pc-auto-ac-overwrite').onclick = () => {
                currentChar.ac = overwriteAC;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
                nextStep();
            };
        } else if (step.type === 'spells') {
            iconEl.className = 'fa-solid fa-wand-magic-sparkles text-gradient-gold';
            titleEl.textContent = 'Add Spells?';

            const dcMatch = (step.desc || '').match(/(?:save DC|DC)\s*(\d+)/i);
            const fixedDc = dcMatch ? parseInt(dcMatch[1]) : null;
            const atkMatch = (step.desc || '').match(/(?:spell attack bonus of|spell attack bonus)\s*\+?(\d+)/i);
            const fixedAtk = atkMatch ? parseInt(atkMatch[1]) : null;

            const spellNamesFormatted = (step.spells || []).map((s) => {
                if (typeof s === 'object' && s !== null) {
                    return s.name + (s.castLevel ? ` (${s.castLevel}th-level)` : '');
                }
                const str = String(s).split('|')[0];
                const [b, u] = str.split('#');
                return b.charAt(0).toUpperCase() + b.slice(1) + (u ? ` (${u}th-level)` : '');
            });

            bodyEl.innerHTML = `
                <div style="margin-bottom:12px;">
                    <strong style="color:var(--color-gold-light); font-size:1rem;">${step.name}</strong> grants the following spell(s):
                </div>
                <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:6px; padding:12px; margin-bottom:12px;">
                    <ul style="margin:0 0 0 16px; padding:0; font-size:0.85rem; color:var(--color-text-primary);">
                        ${spellNamesFormatted.map((s) => `<li style="margin-bottom:2px; font-weight:600;">${s}</li>`).join('')}
                    </ul>
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08); font-size:0.75rem; color:var(--color-text-muted); display:flex; justify-content:space-between;">
                        <span>Spell Save DC:</span>
                        <span style="font-weight:bold; color:var(--color-gold-light);">${fixedDc ? `Fixed DC ${fixedDc}` : `Character Spell DC (${currentChar.spellSettings?.ability || 'INT'})`}</span>
                    </div>
                </div>
            `;

            actionsEl.innerHTML = `
                <button id="pc-auto-spells-skip" class="btn btn-secondary btn-sm">Skip</button>
                <button id="pc-auto-spells-add" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Add Spells</button>
            `;

            document.getElementById('pc-auto-spells-skip').onclick = () => nextStep();
            document.getElementById('pc-auto-spells-add').onclick = async () => {
                let spellsCatalog = vttPlayerSheetAPI?.getSpellCache ? vttPlayerSheetAPI.getSpellCache() : null;
                if (!spellsCatalog) {
                    try {
                        const res = await fetch('/data/spells-catalog.json?v=' + Date.now());
                        if (res.ok) {
                            spellsCatalog = await res.json();
                            if (vttPlayerSheetAPI?.setSpellCache) vttPlayerSheetAPI.setSpellCache(spellsCatalog);
                        }
                    } catch (e) {}
                }

                if (
                    !currentChar.spells ||
                    typeof currentChar.spells !== 'object' ||
                    Array.isArray(currentChar.spells)
                ) {
                    currentChar.spells = {
                        cantrip: [],
                        level1: [],
                        level2: [],
                        level3: [],
                        level4: [],
                        level5: [],
                        level6: [],
                        level7: [],
                        level8: [],
                        level9: []
                    };
                }

                for (const sItem of step.spells) {
                    let cleanSName = '';
                    let castLvl = null;
                    let displayName = '';
                    if (typeof sItem === 'object' && sItem !== null) {
                        cleanSName = (sItem.cleanName || sItem.name || '').trim().toLowerCase();
                        castLvl = sItem.castLevel || null;
                        displayName = sItem.name || cleanSName;
                    } else {
                        const rawStr = String(sItem).trim();
                        const [cleanPart] = rawStr.split('|');
                        const [basePart, upcastPart] = cleanPart.split('#');
                        cleanSName = basePart.trim().toLowerCase();
                        castLvl = upcastPart ? parseInt(upcastPart) : null;
                        displayName = basePart.trim();
                    }

                    const spData = spellsCatalog
                        ? spellsCatalog.find((s) => (s.name || '').toLowerCase() === cleanSName)
                        : null;

                    const baseLvl = spData?.level !== undefined ? spData.level : 1;
                    const levelKey = baseLvl === 0 ? 'cantrip' : `level${baseLvl}`;
                    if (!currentChar.spells[levelKey]) currentChar.spells[levelKey] = [];

                    const existing = currentChar.spells[levelKey].find(
                        (s) => (s.name || '').toLowerCase() === cleanSName
                    );
                    if (!existing) {
                        const castTime = spData?.time
                            ? typeof spData.time === 'string'
                                ? spData.time
                                : `${spData.time[0]?.number || 1} ${spData.time[0]?.unit || 'action'}`
                            : '1 action';
                        const rangeStr = spData?.range
                            ? typeof spData.range === 'string'
                                ? spData.range
                                : spData.range.type || ''
                            : '';
                        const compStr = spData?.components
                            ? typeof spData.components === 'string'
                                ? spData.components
                                : Object.keys(spData.components).join(', ').toUpperCase()
                            : '';
                        const durStr = spData?.duration
                            ? typeof spData.duration === 'string'
                                ? spData.duration
                                : spData.duration[0]?.type === 'timed'
                                  ? `${spData.duration[0]?.duration?.amount} ${spData.duration[0]?.duration?.type}`
                                  : spData.duration[0]?.type
                            : 'Instantaneous';

                        const note = `*(Granted by item: ${step.name}${castLvl ? `, cast as ${castLvl}th-level spell` : ''})*`;
                        currentChar.spells[levelKey].push({
                            id: 'sp_item_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            name: spData ? spData.name : displayName.charAt(0).toUpperCase() + displayName.slice(1),
                            school: spData?.school || '',
                            castingTime: castTime,
                            range: rangeStr,
                            components: compStr,
                            duration: durStr,
                            concentration: !!spData?.concentration,
                            ritual: !!spData?.meta?.ritual,
                            description:
                                (spData?.entriesHtml ||
                                    (Array.isArray(spData?.entries) ? spData.entries.join('\n\n') : '')) +
                                `\n\n${note}`,
                            saveAbility: spData?.savingThrow ? spData.savingThrow[0]?.toUpperCase() || '' : '',
                            saveDcStat: fixedDc ? 'custom' : 'none',
                            saveDcCustom: fixedDc || null,
                            attackBonus: fixedAtk ? `+${fixedAtk}` : '',
                            damageList: spData?.damageList || [],
                            castLvl: castLvl || baseLvl,
                            itemOrigin: step.name
                        });
                    }
                }

                saveAndEmit(currentChar);
                renderSheetData(currentChar);
                if (VTTSpellManager?.renderSpellbookTab) {
                    try {
                        VTTSpellManager.renderSpellbookTab(currentChar);
                    } catch (e) {}
                }
                nextStep();
            };
        }
    }

    renderStep(queue[0]);
}
