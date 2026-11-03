/**
 * Character Builder Wizard - Step 2: Ability Scores & Racial ASI
 * Standard Array, Point Buy, 4d6 Roll, Manual Entry, and Racial ASI breakdown.
 */

export function renderStep2(ctx) {
    const {
        bodyEl,
        workingChar,
        getEffectiveStats,
        getEffectiveRacialBonuses,
        getFeatAndAsiBonuses,
        getPointBuySpent,
        POINT_BUY_COSTS,
        racialChoiceDefs,
        recomputeCandidates,
        getMod
    } = ctx;

    const stats = getEffectiveStats();
    const racialBonuses = getEffectiveRacialBonuses();
    const asiBonuses = getFeatAndAsiBonuses();
    const spentPts = getPointBuySpent(workingChar);
    const remainingPts = 27 - spentPts;

    const statNames = {
        str: 'Strength',
        dex: 'Dexterity',
        con: 'Constitution',
        int: 'Intelligence',
        wis: 'Wisdom',
        cha: 'Charisma'
    };
    const statList = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    bodyEl.innerHTML = `
        <!-- Generation Method Selector -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-dice-d20 text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Ability Score Generation Method</strong>
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn ${workingChar.statMethod === 'standard' ? 'btn-primary' : 'btn-secondary'} pc-method-btn" data-method="standard" style="flex:1; min-width:130px; font-weight:600;">
                    Standard Array
                </button>
                <button type="button" class="btn ${workingChar.statMethod === 'pointbuy' ? 'btn-primary' : 'btn-secondary'} pc-method-btn" data-method="pointbuy" style="flex:1; min-width:130px; font-weight:600;">
                    Point Buy (27 Pts)
                </button>
                <button type="button" class="btn ${workingChar.statMethod === 'roll' ? 'btn-primary' : 'btn-secondary'} pc-method-btn" data-method="roll" style="flex:1; min-width:130px; font-weight:600;">
                    Roll 4d6 (Drop Lowest)
                </button>
                <button type="button" class="btn ${workingChar.statMethod === 'manual' ? 'btn-primary' : 'btn-secondary'} pc-method-btn" data-method="manual" style="flex:1; min-width:130px; font-weight:600;">
                    Manual Entry
                </button>
            </div>
        </div>

        <!-- Active Method Configuration -->
        <div class="builder-section-box">
            ${workingChar.statMethod === 'standard'
            ? `
                <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="color:var(--color-gold-light);">Standard Array: [15, 14, 13, 12, 10, 8]</strong>
                        <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">Assign each value to a different ability score below.</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    ${statList
                .map(
                    (s) => `
                        <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                            <label style="font-weight:700; color:var(--color-gold-base); font-size:0.85rem; text-transform:uppercase;">${s}</label>
                            <select class="pc-std-arr-sel" data-stat="${s}" style="width:100%; margin-top:6px; padding:6px; text-align:center; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                ${[15, 14, 13, 12, 10, 8]
                            .map(
                                (val) => `
                                    <option value="${val}" ${workingChar.standardArrayAssignments[s] === val ? 'selected' : ''}>${val}</option>
                                `
                            )
                            .join('')}
                            </select>
                        </div>
                    `
                )
                .join('')}
                </div>
            `
            : ''
        }

            ${workingChar.statMethod === 'pointbuy'
            ? `
                <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="color:var(--color-gold-light); font-size:1rem;">Point Buy Budget (Scores 8 to 15)</strong>
                        <div style="font-size:0.8rem; color:var(--color-text-secondary);">Cost: 8:0 &bull; 9:1 &bull; 10:2 &bull; 11:3 &bull; 12:4 &bull; 13:5 &bull; 14:7 &bull; 15:9</div>
                    </div>
                    <div style="font-size:1.05rem; font-weight:bold; padding:4px 14px; border-radius:20px; background:rgba(0,0,0,0.4); border:1px solid ${remainingPts >= 0 ? '#4caf50' : '#f44336'}; color:${remainingPts >= 0 ? '#81c784' : '#ef5350'};">
                        Points Remaining: ${remainingPts} / 27
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    ${statList
                .map((s) => {
                    const val = workingChar.pointBuyScores[s] || 8;
                    const cost = POINT_BUY_COSTS[val] || 0;
                    return `
                            <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                                <div style="font-weight:700; color:var(--color-gold-base); font-size:0.85rem; text-transform:uppercase;">${s}</div>
                                <div style="font-size:1.35rem; font-weight:bold; color:var(--color-text-primary); margin:4px 0;">${val}</div>
                                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:8px;">Cost: ${cost} pts</div>
                                <div style="display:flex; justify-content:center; gap:6px;">
                                    <button type="button" class="btn btn-secondary btn-xs pc-pb-btn" data-stat="${s}" data-dir="-1" ${val <= 8 ? 'disabled' : ''} style="width:30px; height:28px;">-</button>
                                    <button type="button" class="btn btn-secondary btn-xs pc-pb-btn" data-stat="${s}" data-dir="1" ${val >= 15 || remainingPts < (POINT_BUY_COSTS[val + 1] || 9) - cost ? 'disabled' : ''} style="width:30px; height:28px;">+</button>
                                </div>
                            </div>
                        `;
                })
                .join('')}
                </div>
            `
            : ''
        }

            ${workingChar.statMethod === 'roll'
            ? `
                <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="color:var(--color-gold-light); font-size:1rem;">Roll 4d6 Drop Lowest</strong>
                        <div style="font-size:0.8rem; color:var(--color-text-secondary);">Roll each pool and assign the outcome to an ability score.</div>
                    </div>
                    <button type="button" id="pc-wiz-roll-all-btn" class="btn btn-primary btn-sm" style="font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-dice"></i> Roll All 6 Stats
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
                    ${workingChar.rolledScores
                .map(
                    (r, rIdx) => `
                        <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-size:0.75rem; color:var(--color-text-muted);">Pool ${rIdx + 1}</span>
                                <button type="button" class="btn btn-xxs btn-secondary pc-reroll-single" data-idx="${rIdx}" title="Re-roll this stat"><i class="fa-solid fa-rotate-right"></i></button>
                            </div>
                            <div style="font-size:1.35rem; font-weight:bold; color:var(--color-gold-light);">${r.val}</div>
                            <div style="font-size:0.7rem; color:var(--color-text-muted); margin-bottom:6px;">[${r.rolls.join(', ')}]</div>
                            <select class="pc-roll-assign-sel" data-idx="${rIdx}" style="width:100%; padding:4px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                ${statList.map((s) => `<option value="${s}" ${r.assignedStat === s ? 'selected' : ''}>${s.toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                    `
                )
                .join('')}
                </div>
            `
            : ''
        }

            ${workingChar.statMethod === 'manual'
            ? `
                <div style="margin-bottom:12px;">
                    <strong style="color:var(--color-gold-light);">Manual Score Entry (1 to 30)</strong>
                    <div style="font-size:0.8rem; color:var(--color-text-secondary);">Directly input your character base ability scores.</div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px;">
                    ${statList
                .map(
                    (s) => `
                        <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                            <label style="font-weight:700; color:var(--color-gold-base); font-size:0.85rem; text-transform:uppercase;">${s}</label>
                            <input type="number" id="pc-man-stat-${s}" min="1" max="30" value="${workingChar.manualScores[s]}" style="width:100%; margin-top:6px; padding:6px; text-align:center; font-weight:bold; font-size:1.1rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); border-radius:4px;">
                        </div>
                    `
                )
                .join('')}
                </div>
            `
            : ''
        }
        </div>

        <!-- Racial ASI & Total Scores Breakdown -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-chart-simple text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Racial ASI & Live Scores Breakdown</strong>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="btn ${workingChar.racialAsiMode === 'catalog' ? 'btn-primary' : 'btn-secondary'} btn-xxs pc-asi-mode-btn" data-asimode="catalog">Standard Species</button>
                    <button type="button" class="btn ${workingChar.racialAsiMode === 'tashas' ? 'btn-primary' : 'btn-secondary'} btn-xxs pc-asi-mode-btn" data-asimode="tashas">Tasha's Rules</button>
                    <button type="button" class="btn ${workingChar.racialAsiMode === 'background' ? 'btn-primary' : 'btn-secondary'} btn-xxs pc-asi-mode-btn" data-asimode="background">Background ASI (2024)</button>
                    <button type="button" class="btn ${workingChar.racialAsiMode === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-xxs pc-asi-mode-btn" data-asimode="custom">Custom ASI</button>
                </div>
            </div>

            ${workingChar.racialAsiMode === 'catalog' && racialChoiceDefs.length > 0
            ? `
                <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                    ${racialChoiceDefs
                .map(
                    (cd) => `
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">${cd.label}:</span>
                            <select class="pc-wiz-racial-choice-sel" data-cid="${cd.id}" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                <option value="">-- Choose Ability (+${cd.amount}) --</option>
                                ${cd.from.map((st) => `<option value="${st}" ${workingChar.racialChoices[cd.id] === st ? 'selected' : ''}>${statNames[st]} (+${cd.amount})</option>`).join('')}
                            </select>
                        </div>
                    `
                )
                .join('')}
                </div>
            `
            : ''
        }

            ${workingChar.racialAsiMode === 'tashas'
            ? `
                <div style="background:rgba(0,0,0,0.25); padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); margin-bottom:12px;">
                    <div style="display:flex; gap:16px; align-items:center; margin-bottom:8px;">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-tashas-mode-radio" value="plus2plus1" ${workingChar.tashasMode !== 'threePlus1' ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                            <span>+2 to One, +1 to Another</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-tashas-mode-radio" value="threePlus1" ${workingChar.tashasMode === 'threePlus1' ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                            <span>+1 to Three Distinct Scores</span>
                        </label>
                    </div>
                    ${workingChar.tashasMode === 'threePlus1'
                ? `
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 1:</span>
                                <select id="pc-wiz-tashas-1-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.tashasPlus1_1 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 2:</span>
                                <select id="pc-wiz-tashas-1-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.tashasPlus1_2 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 3:</span>
                                <select id="pc-wiz-tashas-1-3" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.tashasPlus1_3 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    `
                : `
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+2 Bonus:</span>
                                <select id="pc-wiz-tashas-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.tashasPlus2 === s ? 'selected' : ''}>${statNames[s]} (+2)</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Bonus:</span>
                                <select id="pc-wiz-tashas-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.tashasPlus1 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    `
            }
                </div>
            `
            : ''
        }

            ${workingChar.racialAsiMode === 'background'
            ? `
                <div style="background:rgba(0,0,0,0.25); padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); margin-bottom:12px;">
                    <div style="display:flex; gap:16px; align-items:center; margin-bottom:8px;">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-bgasi-mode-radio" value="plus2plus1" ${workingChar.bgAsiMode !== 'threePlus1' ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                            <span>+2 to One, +1 to Another</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-bgasi-mode-radio" value="threePlus1" ${workingChar.bgAsiMode === 'threePlus1' ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                            <span>+1 to Three Distinct Scores</span>
                        </label>
                    </div>
                    ${workingChar.bgAsiMode === 'threePlus1'
                ? `
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 1:</span>
                                <select id="pc-wiz-bgasi-1-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.bgAsiPlus1_1 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 2:</span>
                                <select id="pc-wiz-bgasi-1-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.bgAsiPlus1_2 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 3:</span>
                                <select id="pc-wiz-bgasi-1-3" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.bgAsiPlus1_3 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    `
                : `
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+2 Bonus:</span>
                                <select id="pc-wiz-bgasi-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.bgAsiPlus2 === s ? 'selected' : ''}>${statNames[s]} (+2)</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Bonus:</span>
                                <select id="pc-wiz-bgasi-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${statList.map((s) => `<option value="${s}" ${workingChar.bgAsiPlus1 === s ? 'selected' : ''}>${statNames[s]} (+1)</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    `
            }
                </div>
            `
            : ''
        }

            ${(ctx.asiTiers || []).some((t) => t.choice === 'unselected')
            ? `
                <div style="margin-bottom:10px; font-size:0.8rem; color:var(--color-gold-light); display:flex; align-items:center; gap:6px; background:rgba(212,175,55,0.1); padding:6px 12px; border-radius:4px; border:1px solid rgba(212,175,55,0.25);">
                    <i class="fa-solid fa-circle-info"></i> <span>You have pending Level Milestone ASIs or Feats to assign in <strong>Step 6 (Feats & ASIs)</strong>.</span>
                </div>
            `
            : ''
        }
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:center;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-muted); font-size:0.75rem; text-transform:uppercase;">
                            <th style="padding:6px; text-align:left;">Ability</th>
                            <th style="padding:6px;">Base</th>
                            <th style="padding:6px;">Racial ASI</th>
                            <th style="padding:6px;">Feat / ASI</th>
                            <th style="padding:6px; font-weight:bold; color:var(--color-gold-light);">Total</th>
                            <th style="padding:6px; font-weight:bold; color:var(--color-gold-base);">Modifier</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statList
            .map((s) => {
                let baseVal = 10;
                if (workingChar.statMethod === 'standard')
                    baseVal = parseInt(workingChar.standardArrayAssignments[s]) || 10;
                else if (workingChar.statMethod === 'pointbuy')
                    baseVal = parseInt(workingChar.pointBuyScores[s]) || 8;
                else if (workingChar.statMethod === 'roll') {
                    const r = workingChar.rolledScores.find((x) => x.assignedStat === s);
                    baseVal = r ? r.val : 10;
                } else if (workingChar.statMethod === 'manual')
                    baseVal = parseInt(workingChar.manualScores[s]) || 10;

                const rBonus = racialBonuses[s] || 0;
                const aBonus = asiBonuses[s] || 0;
                const tot = stats[s] || 10;
                const mod = getMod(tot);

                return `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                     <td style="padding:8px 6px; text-align:left; font-weight:bold; color:var(--color-text-primary);">${statNames[s]} (${s.toUpperCase()})</td>
                                     <td style="padding:8px 6px; color:var(--color-text-secondary);">${baseVal}</td>
                                     <td style="padding:8px 6px;">
                                         ${workingChar.racialAsiMode === 'custom'
                        ? `
                                             <input type="number" class="pc-custom-asi-input" data-stat="${s}" value="${workingChar.customRacialBonuses[s] || 0}" min="-5" max="10" style="width:48px; text-align:center; padding:2px; font-size:0.85rem; font-weight:bold; background:rgba(0,0,0,0.5); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                                         `
                        : `
                                             <span style="color:${rBonus > 0 ? '#81c784' : 'var(--color-text-muted)'}; font-weight:600;">${rBonus > 0 ? '+' + rBonus : '+0'}</span>
                                         `
                    }
                                     </td>
                                     <td style="padding:8px 6px; color:${aBonus > 0 ? '#4fc3f7' : 'var(--color-text-muted)'};">${aBonus > 0 ? '+' + aBonus : '+0'}</td>
                                     <td style="padding:8px 6px; font-weight:bold; font-size:1.05rem; color:var(--color-gold-light);">${tot}</td>
                                     <td style="padding:8px 6px; font-weight:bold; font-size:1.05rem; color:${mod >= 0 ? 'var(--color-gold-base)' : '#e57373'};">${mod >= 0 ? '+' : ''}${mod}</td>
                                 </tr>
                             `;
            })
            .join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Step 2 Event Listeners
    document.querySelectorAll('.pc-method-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            workingChar.statMethod = btn.dataset.method;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.querySelectorAll('.pc-std-arr-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const st = e.target.dataset.stat;
            workingChar.standardArrayAssignments[st] = parseInt(e.target.value) || 10;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.querySelectorAll('.pc-pb-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const st = e.currentTarget.dataset.stat;
            const dir = parseInt(e.currentTarget.dataset.dir);
            const cur = workingChar.pointBuyScores[st] || 8;
            const nextVal = cur + dir;
            if (nextVal >= 8 && nextVal <= 15) {
                workingChar.pointBuyScores[st] = nextVal;
                recomputeCandidates().then(() => renderStep2(ctx));
            }
        });
    });

    document.getElementById('pc-wiz-roll-all-btn')?.addEventListener('click', () => {
        workingChar.rolledScores.forEach((r) => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const d3 = Math.floor(Math.random() * 6) + 1;
            const d4 = Math.floor(Math.random() * 6) + 1;
            const rolls = [d1, d2, d3, d4].sort((a, b) => b - a);
            r.rolls = rolls;
            r.val = rolls[0] + rolls[1] + rolls[2];
        });
        recomputeCandidates().then(() => renderStep2(ctx));
    });

    document.querySelectorAll('.pc-reroll-single').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const d3 = Math.floor(Math.random() * 6) + 1;
            const d4 = Math.floor(Math.random() * 6) + 1;
            const rolls = [d1, d2, d3, d4].sort((a, b) => b - a);
            workingChar.rolledScores[idx].rolls = rolls;
            workingChar.rolledScores[idx].val = rolls[0] + rolls[1] + rolls[2];
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.querySelectorAll('.pc-roll-assign-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            workingChar.rolledScores[idx].assignedStat = e.target.value;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.querySelectorAll('.pc-asi-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            workingChar.racialAsiMode = btn.dataset.asimode;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.querySelectorAll('input[name="pc-tashas-mode-radio"]').forEach((r) => {
        r.addEventListener('change', (e) => {
            workingChar.tashasMode = e.target.value;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.getElementById('pc-wiz-tashas-2')?.addEventListener('change', (e) => {
        workingChar.tashasPlus2 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-tashas-1')?.addEventListener('change', (e) => {
        workingChar.tashasPlus1 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-tashas-1-1')?.addEventListener('change', (e) => {
        workingChar.tashasPlus1_1 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-tashas-1-2')?.addEventListener('change', (e) => {
        workingChar.tashasPlus1_2 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-tashas-1-3')?.addEventListener('change', (e) => {
        workingChar.tashasPlus1_3 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });

    document.querySelectorAll('input[name="pc-bgasi-mode-radio"]').forEach((r) => {
        r.addEventListener('change', (e) => {
            workingChar.bgAsiMode = e.target.value;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.getElementById('pc-wiz-bgasi-2')?.addEventListener('change', (e) => {
        workingChar.bgAsiPlus2 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-bgasi-1')?.addEventListener('change', (e) => {
        workingChar.bgAsiPlus1 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-bgasi-1-1')?.addEventListener('change', (e) => {
        workingChar.bgAsiPlus1_1 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-bgasi-1-2')?.addEventListener('change', (e) => {
        workingChar.bgAsiPlus1_2 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });
    document.getElementById('pc-wiz-bgasi-1-3')?.addEventListener('change', (e) => {
        workingChar.bgAsiPlus1_3 = e.target.value;
        recomputeCandidates().then(() => renderStep2(ctx));
    });

    document.querySelectorAll('.pc-custom-asi-input').forEach((inp) => {
        inp.addEventListener('input', (e) => {
            const st = e.target.dataset.stat;
            if (st) workingChar.customRacialBonuses[st] = parseInt(e.target.value) || 0;
        });
        inp.addEventListener('change', (e) => {
            const st = e.target.dataset.stat;
            if (st) workingChar.customRacialBonuses[st] = parseInt(e.target.value) || 0;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });

    document.querySelectorAll('.pc-wiz-racial-choice-sel').forEach((sel) => {
        sel.addEventListener('change', (e) => {
            const cId = e.target.dataset.cid;
            if (cId) workingChar.racialChoices[cId] = e.target.value;
            recomputeCandidates().then(() => renderStep2(ctx));
        });
    });
}
