/**
 * Character Builder Wizard - Step 8: Review HP & AC
 * Hit point calculation options, armor selection, shield toggle, and final ability score recap.
 */

export function renderStep8(ctx) {
    const {
        bodyEl,
        builderState,
        refreshArmorOptionsFromCandidates,
        runHpCalculation,
        runAcCalculation,
        getEffectiveStats,
        allArmorOptions,
        getMod
    } = ctx;

    refreshArmorOptionsFromCandidates();
    runHpCalculation();
    runAcCalculation();
    const stats = getEffectiveStats();

    bodyEl.innerHTML = `
        <!-- HP Calculation Box -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-heart-pulse text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Hit Points Engine</strong>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.85rem; color:var(--color-text-muted);">Max HP:</span>
                    <span id="pc-wiz-hp-preview" style="font-size:1.15rem; font-weight:bold; color:#4fc3f7; background:rgba(79,195,247,0.15); border:1px solid rgba(79,195,247,0.4); padding:2px 10px; border-radius:4px;">${builderState.calculatedHp}</span>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                <button type="button" class="btn ${builderState.hpMode === 'average' ? 'btn-primary' : 'btn-secondary'} btn-xs pc-wiz-hp-mode-btn" data-mode="average">Average (Fixed)</button>
                <button type="button" class="btn ${builderState.hpMode === 'max' ? 'btn-primary' : 'btn-secondary'} btn-xs pc-wiz-hp-mode-btn" data-mode="max">Maximum</button>
                <button type="button" class="btn ${builderState.hpMode === 'roll' ? 'btn-primary' : 'btn-secondary'} btn-xs pc-wiz-hp-mode-btn" data-mode="roll">Hit Dice Roll</button>
                <button type="button" class="btn ${builderState.hpMode === 'roll_avg_min' ? 'btn-primary' : 'btn-secondary'} btn-xs pc-wiz-hp-mode-btn" data-mode="roll_avg_min">Roll (Avg Min)</button>
            </div>

            <!-- Rolls Breakdown -->
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px; max-height:160px; overflow-y:auto;" class="scroll-styled">
                ${builderState.hpRolls
            .map(
                (r) => `
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span>${r.className} Lv ${r.level}: [1d${r.hd} -> ${r.val}] + CON (${r.con >= 0 ? '+' + r.con : r.con})</span>
                        <strong style="color:#4fc3f7;">+${r.total} HP</strong>
                    </div>
                `
            )
            .join('')}
            </div>

            ${builderState.hpBreakdown && builderState.hpBreakdown.totalBonus > 0
            ? `
            <div style="margin-top:8px; padding:6px 10px; background:rgba(79,195,247,0.08); border:1px solid rgba(79,195,247,0.25); border-radius:6px; font-size:0.8rem; color:var(--color-text-secondary); display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span style="color:var(--color-gold-light); font-weight:600;"><i class="fa-solid fa-calculator"></i> Bonus Breakdown:</span>
                <span>Base (${builderState.hpBreakdown.base})</span>
                ${builderState.hpBreakdown.tough ? `<span style="background:rgba(79,195,247,0.2); color:#4fc3f7; padding:1px 6px; border-radius:4px; font-weight:600;">+${builderState.hpBreakdown.tough} Tough Feat</span>` : ''}
                ${builderState.hpBreakdown.dwarvenToughness ? `<span style="background:rgba(79,195,247,0.2); color:#4fc3f7; padding:1px 6px; border-radius:4px; font-weight:600;">+${builderState.hpBreakdown.dwarvenToughness} Dwarven Toughness</span>` : ''}
                ${builderState.hpBreakdown.draconicResilience ? `<span style="background:rgba(79,195,247,0.2); color:#4fc3f7; padding:1px 6px; border-radius:4px; font-weight:600;">+${builderState.hpBreakdown.draconicResilience} Draconic Resilience</span>` : ''}
                <span style="font-weight:bold; color:#4fc3f7;">= ${builderState.calculatedHp} Total HP</span>
            </div>
            `
            : ''
        }

            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-text-secondary);">
                    <input type="checkbox" id="pc-wiz-hp-broadcast" ${builderState.hpChatBroadcast ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                    <span>Broadcast HP calculation to party chat on apply</span>
                </label>
                ${builderState.hpMode === 'roll' || builderState.hpMode === 'roll_avg_min'
            ? `
                    <button type="button" id="pc-wiz-reroll-hp" class="btn btn-secondary btn-xs"><i class="fa-solid fa-rotate-right"></i> Re-roll Hit Dice</button>
                `
            : ''
        }
            </div>
        </div>

        <!-- AC Calculation Box -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Armor Class Engine</strong>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.85rem; color:var(--color-text-muted);">Armor Class:</span>
                    <span id="pc-wiz-ac-preview" style="font-size:1.15rem; font-weight:bold; color:#81c784; background:rgba(129,199,132,0.15); border:1px solid rgba(129,199,132,0.4); padding:2px 10px; border-radius:4px;">${builderState.calculatedAc}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                ${allArmorOptions
            .map(
                (arm) => `
                    <label class="glass-flat" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:center; cursor:pointer;">
                        <input type="radio" name="pc-wiz-armor-opt" value="${arm.id}" ${builderState.activeArmorId === arm.id ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                        <span style="font-weight:600; color:var(--color-text-primary);">${arm.name}</span>
                    </label>
                `
            )
            .join('')}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.85rem; color:var(--color-gold-light);">
                    <input type="checkbox" id="pc-wiz-shield-chk" ${builderState.shieldEnabled ? 'checked' : ''} style="accent-color:var(--color-gold-base);">
                    <span>Equip Shield (+2 AC)</span>
                </label>
                <div style="font-size:0.8rem; color:var(--color-text-muted);">
                    <i class="fa-solid fa-calculator"></i> ${builderState.acFormulaText} = <strong style="color:#81c784;">${builderState.calculatedAc} AC</strong>
                </div>
            </div>
        </div>

        <!-- Manual Overrides Box -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-pen-to-square text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Manual Overrides</strong>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-secondary);">Directly set Max HP and AC to override automatic engine calculations</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; padding:4px 0;">
                <!-- Manual Max HP -->
                <div class="glass-flat" style="padding:12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label for="pc-wiz-manual-hp" style="font-size:0.85rem; font-weight:600; color:var(--color-gold-light);">
                            <i class="fa-solid fa-heart-pulse" style="color:#4fc3f7; margin-right:4px;"></i> Custom Max HP:
                        </label>
                        ${builderState.hpManualOverride !== null && builderState.hpManualOverride !== undefined
            ? `
                            <button type="button" id="pc-wiz-clear-manual-hp" class="btn btn-secondary btn-xxs" title="Clear override and use engine calculation">
                                <i class="fa-solid fa-rotate-left"></i> Reset
                            </button>
                        `
            : ''
        }
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="pc-wiz-manual-hp" min="1" max="999" placeholder="Calculated (${builderState.calculatedHp})" value="${builderState.hpManualOverride !== null && builderState.hpManualOverride !== undefined ? builderState.hpManualOverride : ''}" style="width:100%; padding:6px 10px; font-size:0.95rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:#4fc3f7; border-radius:4px;">
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">
                        ${builderState.hpManualOverride !== null && builderState.hpManualOverride !== undefined ? `Active override takes precedence over dice rolls.` : `Leave blank to use engine calculated hit points.`}
                    </div>
                </div>

                <!-- Manual AC -->
                <div class="glass-flat" style="padding:12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label for="pc-wiz-manual-ac" style="font-size:0.85rem; font-weight:600; color:var(--color-gold-light);">
                            <i class="fa-solid fa-shield" style="color:#81c784; margin-right:4px;"></i> Custom Armor Class:
                        </label>
                        ${builderState.acManualOverride !== null && builderState.acManualOverride !== undefined
            ? `
                            <button type="button" id="pc-wiz-clear-manual-ac" class="btn btn-secondary btn-xxs" title="Clear override and use engine calculation">
                                <i class="fa-solid fa-rotate-left"></i> Reset
                            </button>
                        `
            : ''
        }
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="pc-wiz-manual-ac" min="1" max="50" placeholder="Calculated (${builderState.calculatedAc})" value="${builderState.acManualOverride !== null && builderState.acManualOverride !== undefined ? builderState.acManualOverride : ''}" style="width:100%; padding:6px 10px; font-size:0.95rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:#81c784; border-radius:4px;">
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">
                        ${builderState.acManualOverride !== null && builderState.acManualOverride !== undefined ? `Active override takes precedence over armor/dex.` : `Leave blank to use engine calculated armor class.`}
                    </div>
                </div>
            </div>
        </div>

        <!-- Character Recap Card -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-address-card text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Final Build Recap</strong>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px; text-align:center;">
                ${['str', 'dex', 'con', 'int', 'wis', 'cha']
            .map((s) => {
                const mod = getMod(stats[s]);
                return `
                        <div class="glass-flat" style="padding:8px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted);">${s}</div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--color-gold-light);">${stats[s]}</div>
                            <div style="font-size:0.8rem; color:${mod >= 0 ? 'var(--color-gold-base)' : '#e57373'};">${mod >= 0 ? '+' : ''}${mod}</div>
                        </div>
                    `;
            })
            .join('')}
            </div>
        </div>
    `;

    // Step 8 Event Listeners
    bodyEl.querySelectorAll('.pc-wiz-hp-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            builderState.hpMode = btn.dataset.mode;
            runHpCalculation();
            renderStep8(ctx);
        });
    });

    document.getElementById('pc-wiz-reroll-hp')?.addEventListener('click', () => {
        runHpCalculation();
        renderStep8(ctx);
    });

    document.getElementById('pc-wiz-hp-broadcast')?.addEventListener('change', (e) => {
        builderState.hpChatBroadcast = e.target.checked;
    });

    bodyEl.querySelectorAll('input[name="pc-wiz-armor-opt"]').forEach((r) => {
        r.addEventListener('change', (e) => {
            builderState.activeArmorId = e.target.value;
            runAcCalculation();
            renderStep8(ctx);
        });
    });

    document.getElementById('pc-wiz-shield-chk')?.addEventListener('change', (e) => {
        builderState.shieldEnabled = e.target.checked;
        runAcCalculation();
        renderStep8(ctx);
    });

    const manualHpInput = document.getElementById('pc-wiz-manual-hp');
    if (manualHpInput) {
        manualHpInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val === '') {
                builderState.hpManualOverride = null;
            } else {
                const parsed = parseInt(val, 10);
                builderState.hpManualOverride = isNaN(parsed) ? null : Math.max(1, parsed);
            }
            runHpCalculation();
            const hpPrev = document.getElementById('pc-wiz-hp-preview');
            if (hpPrev) hpPrev.textContent = builderState.calculatedHp;
        });
    }

    const clearHpBtn = document.getElementById('pc-wiz-clear-manual-hp');
    if (clearHpBtn) {
        clearHpBtn.addEventListener('click', () => {
            builderState.hpManualOverride = null;
            runHpCalculation();
            renderStep8(ctx);
        });
    }

    const manualAcInput = document.getElementById('pc-wiz-manual-ac');
    if (manualAcInput) {
        manualAcInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val === '') {
                builderState.acManualOverride = null;
            } else {
                const parsed = parseInt(val, 10);
                builderState.acManualOverride = isNaN(parsed) ? null : Math.max(1, parsed);
            }
            runAcCalculation();
            const acPrev = document.getElementById('pc-wiz-ac-preview');
            if (acPrev) acPrev.textContent = builderState.calculatedAc;
        });
    }

    const clearAcBtn = document.getElementById('pc-wiz-clear-manual-ac');
    if (clearAcBtn) {
        clearAcBtn.addEventListener('click', () => {
            builderState.acManualOverride = null;
            runAcCalculation();
            renderStep8(ctx);
        });
    }
}
