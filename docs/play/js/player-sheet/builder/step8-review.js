export function renderStep8(l){const{bodyEl:d,workingChar:v,builderState:e,refreshArmorOptionsFromCandidates:b,runHpCalculation:r,runAcCalculation:o,getEffectiveStats:m,allArmorOptions:x,getMod:f}=l;b(),r(!1),o();const s=m(),y=v?.builderMode==="levelup";d.innerHTML=`
        <!-- HP Calculation Box -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-heart-pulse text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Hit Points Engine</strong>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.85rem; color:var(--color-text-muted);">Max HP:</span>
                    <span id="pc-wiz-hp-preview" style="font-size:1.15rem; font-weight:bold; color:#4fc3f7; background:rgba(79,195,247,0.15); border:1px solid rgba(79,195,247,0.4); padding:2px 10px; border-radius:4px;">${e.calculatedHp}</span>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="btn ${e.hpMode==="average"?"btn-primary":"btn-secondary"} btn-xs pc-wiz-hp-mode-btn" data-mode="average">Average (Fixed)</button>
                <button type="button" class="btn ${e.hpMode==="max"?"btn-primary":"btn-secondary"} btn-xs pc-wiz-hp-mode-btn" data-mode="max">Maximum</button>
                <button type="button" class="btn ${e.hpMode==="roll"?"btn-primary":"btn-secondary"} btn-xs pc-wiz-hp-mode-btn" data-mode="roll">Hit Dice Roll</button>
                <button type="button" class="btn ${e.hpMode==="roll_avg_min"?"btn-primary":"btn-secondary"} btn-xs pc-wiz-hp-mode-btn" data-mode="roll_avg_min">Roll (Avg Min)</button>
                ${y?`
                <div style="margin-left:auto; display:flex; align-items:center;">
                    <button type="button" id="pc-wiz-toggle-preserve-hp" class="btn ${e.preserveExistingHp?"btn-primary":"btn-secondary"} btn-xs" title="Keep prior level hit points intact and only add HP for newly gained levels">
                        <i class="fa-solid ${e.preserveExistingHp?"fa-lock":"fa-lock-open"}"></i> Preserve Prior HP (${e.preserveExistingHp?"ON":"OFF"})
                    </button>
                </div>
                `:""}
            </div>

            <!-- Rolls Breakdown -->
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px; max-height:160px; overflow-y:auto;" class="scroll-styled">
                ${e.hpRolls.map(a=>`
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05); opacity:${a.isPreserved?"0.65":"1"};">
                        <span>
                            ${a.className} Lv ${a.level}: [1d${a.hd} -> ${a.val}] + CON (${a.con>=0?"+"+a.con:a.con})
                            ${a.isPreserved?'<span class="badge" style="font-size:0.65rem; background:rgba(79,195,247,0.2); color:#4fc3f7; margin-left:4px;">Prior Level</span>':""}
                        </span>
                        <strong style="color:${a.isPreserved?"#90caf9":"#4fc3f7"};">+${a.total} HP</strong>
                    </div>
                `).join("")}
            </div>

            ${e.hpBreakdown&&e.hpBreakdown.totalBonus>0?`
            <div style="margin-top:8px; padding:6px 10px; background:rgba(79,195,247,0.08); border:1px solid rgba(79,195,247,0.25); border-radius:6px; font-size:0.8rem; color:var(--color-text-secondary); display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span style="color:var(--color-gold-light); font-weight:600;"><i class="fa-solid fa-calculator"></i> Bonus Breakdown:</span>
                <span>Base (${e.hpBreakdown.base})</span>
                ${e.hpBreakdown.tough?`<span style="background:rgba(79,195,247,0.2); color:#4fc3f7; padding:1px 6px; border-radius:4px; font-weight:600;">+${e.hpBreakdown.tough} Tough Feat</span>`:""}
                ${e.hpBreakdown.dwarvenToughness?`<span style="background:rgba(79,195,247,0.2); color:#4fc3f7; padding:1px 6px; border-radius:4px; font-weight:600;">+${e.hpBreakdown.dwarvenToughness} Dwarven Toughness</span>`:""}
                ${e.hpBreakdown.draconicResilience?`<span style="background:rgba(79,195,247,0.2); color:#4fc3f7; padding:1px 6px; border-radius:4px; font-weight:600;">+${e.hpBreakdown.draconicResilience} Draconic Resilience</span>`:""}
                <span style="font-weight:bold; color:#4fc3f7;">= ${e.calculatedHp} Total HP</span>
            </div>
            `:""}

            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-text-secondary);">
                    <input type="checkbox" id="pc-wiz-hp-broadcast" ${e.hpChatBroadcast?"checked":""} style="accent-color:var(--color-gold-base);">
                    <span>Broadcast HP calculation to party chat on apply</span>
                </label>
                ${e.hpMode==="roll"||e.hpMode==="roll_avg_min"?`
                    <button type="button" id="pc-wiz-reroll-hp" class="btn btn-secondary btn-xs"><i class="fa-solid fa-rotate-right"></i> Re-roll Hit Dice</button>
                `:""}
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
                    <span id="pc-wiz-ac-preview" style="font-size:1.15rem; font-weight:bold; color:#81c784; background:rgba(129,199,132,0.15); border:1px solid rgba(129,199,132,0.4); padding:2px 10px; border-radius:4px;">${e.calculatedAc}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                ${x.map(a=>`
                    <label class="glass-flat" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:center; cursor:pointer;">
                        <input type="radio" name="pc-wiz-armor-opt" value="${a.id}" ${e.activeArmorId===a.id?"checked":""} style="accent-color:var(--color-gold-base);">
                        <span style="font-weight:600; color:var(--color-text-primary);">${a.name}</span>
                    </label>
                `).join("")}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.85rem; color:var(--color-gold-light);">
                    <input type="checkbox" id="pc-wiz-shield-chk" ${e.shieldEnabled?"checked":""} style="accent-color:var(--color-gold-base);">
                    <span>Equip Shield (+2 AC)</span>
                </label>
                <div style="font-size:0.8rem; color:var(--color-text-muted);">
                    <i class="fa-solid fa-calculator"></i> ${e.acFormulaText} = <strong style="color:#81c784;">${e.calculatedAc} AC</strong>
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
                        ${e.hpManualOverride!==null&&e.hpManualOverride!==void 0?`
                            <button type="button" id="pc-wiz-clear-manual-hp" class="btn btn-secondary btn-xxs" title="Clear override and use engine calculation">
                                <i class="fa-solid fa-rotate-left"></i> Reset
                            </button>
                        `:""}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="pc-wiz-manual-hp" min="1" max="999" placeholder="Calculated (${e.calculatedHp})" value="${e.hpManualOverride!==null&&e.hpManualOverride!==void 0?e.hpManualOverride:""}" style="width:100%; padding:6px 10px; font-size:0.95rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:#4fc3f7; border-radius:4px;">
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">
                        ${e.hpManualOverride!==null&&e.hpManualOverride!==void 0?"Active override takes precedence over dice rolls.":"Leave blank to use engine calculated hit points."}
                    </div>
                </div>

                <!-- Manual AC -->
                <div class="glass-flat" style="padding:12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label for="pc-wiz-manual-ac" style="font-size:0.85rem; font-weight:600; color:var(--color-gold-light);">
                            <i class="fa-solid fa-shield" style="color:#81c784; margin-right:4px;"></i> Custom Armor Class:
                        </label>
                        ${e.acManualOverride!==null&&e.acManualOverride!==void 0?`
                            <button type="button" id="pc-wiz-clear-manual-ac" class="btn btn-secondary btn-xxs" title="Clear override and use engine calculation">
                                <i class="fa-solid fa-rotate-left"></i> Reset
                            </button>
                        `:""}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="pc-wiz-manual-ac" min="1" max="50" placeholder="Calculated (${e.calculatedAc})" value="${e.acManualOverride!==null&&e.acManualOverride!==void 0?e.acManualOverride:""}" style="width:100%; padding:6px 10px; font-size:0.95rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:#81c784; border-radius:4px;">
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">
                        ${e.acManualOverride!==null&&e.acManualOverride!==void 0?"Active override takes precedence over armor/dex.":"Leave blank to use engine calculated armor class."}
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
                ${["str","dex","con","int","wis","cha"].map(a=>{const t=f(s[a]);return`
                        <div class="glass-flat" style="padding:8px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted);">${a}</div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--color-gold-light);">${s[a]}</div>
                            <div style="font-size:0.8rem; color:${t>=0?"var(--color-gold-base)":"#e57373"};">${t>=0?"+":""}${t}</div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `,d.querySelectorAll(".pc-wiz-hp-mode-btn").forEach(a=>{a.addEventListener("click",()=>{e.hpMode=a.dataset.mode,r(!1),renderStep8(l)})}),document.getElementById("pc-wiz-toggle-preserve-hp")?.addEventListener("click",()=>{e.preserveExistingHp=!e.preserveExistingHp,r(!1),renderStep8(l)}),document.getElementById("pc-wiz-reroll-hp")?.addEventListener("click",()=>{r(!0),renderStep8(l)}),document.getElementById("pc-wiz-hp-broadcast")?.addEventListener("change",a=>{e.hpChatBroadcast=a.target.checked}),d.querySelectorAll('input[name="pc-wiz-armor-opt"]').forEach(a=>{a.addEventListener("change",t=>{e.activeArmorId=t.target.value,o(),renderStep8(l)})}),document.getElementById("pc-wiz-shield-chk")?.addEventListener("change",a=>{e.shieldEnabled=a.target.checked,o(),renderStep8(l)});const c=document.getElementById("pc-wiz-manual-hp");c&&c.addEventListener("input",a=>{const t=a.target.value.trim();if(t==="")e.hpManualOverride=null;else{const n=parseInt(t,10);e.hpManualOverride=isNaN(n)?null:Math.max(1,n)}r();const i=document.getElementById("pc-wiz-hp-preview");i&&(i.textContent=e.calculatedHp)});const p=document.getElementById("pc-wiz-clear-manual-hp");p&&p.addEventListener("click",()=>{e.hpManualOverride=null,r(),renderStep8(l)});const u=document.getElementById("pc-wiz-manual-ac");u&&u.addEventListener("input",a=>{const t=a.target.value.trim();if(t==="")e.acManualOverride=null;else{const n=parseInt(t,10);e.acManualOverride=isNaN(n)?null:Math.max(1,n)}o();const i=document.getElementById("pc-wiz-ac-preview");i&&(i.textContent=e.calculatedAc)});const g=document.getElementById("pc-wiz-clear-manual-ac");g&&g.addEventListener("click",()=>{e.acManualOverride=null,o(),renderStep8(l)})}
