export function renderStep2(r){const{bodyEl:$,workingChar:e,getEffectiveStats:w,getEffectiveRacialBonuses:A,getFeatAndAsiBonuses:z,getPointBuySpent:S,POINT_BUY_COSTS:v,racialChoiceDefs:f,recomputeCandidates:i,getMod:P}=r,M=w(),E=A(),B=z(),h=27-S(e),g={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"},n=["str","dex","con","int","wis","cha"],u=r.matchedBg,m=new Set;u&&u.ability&&(Array.isArray(u.ability)?u.ability:[u.ability]).forEach(a=>{a&&(a.choose&&Array.isArray(a.choose.from)?a.choose.from.forEach(o=>m.add(o.toLowerCase())):typeof a=="object"&&Object.keys(a).forEach(o=>{["str","dex","con","int","wis","cha"].includes(o.toLowerCase())&&m.add(o.toLowerCase())}))});const k=[...n].sort((t,a)=>{const o=m.has(t),s=m.has(a);return o&&!s?-1:!o&&s?1:0}),x=(t,a)=>k.map(o=>{const s=m.has(o);return`<option value="${o}" ${t===o?"selected":""}>${g[o]} (${a})${s?" \u2605 Background Recommended":""}</option>`}).join("");$.innerHTML=`
        <!-- Generation Method Selector -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-dice-d20 text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Ability Score Generation Method</strong>
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn ${e.statMethod==="standard"?"btn-primary":"btn-secondary"} pc-method-btn" data-method="standard" style="flex:1; min-width:130px; font-weight:600;">
                    Standard Array
                </button>
                <button type="button" class="btn ${e.statMethod==="pointbuy"?"btn-primary":"btn-secondary"} pc-method-btn" data-method="pointbuy" style="flex:1; min-width:130px; font-weight:600;">
                    Point Buy (27 Pts)
                </button>
                <button type="button" class="btn ${e.statMethod==="roll"?"btn-primary":"btn-secondary"} pc-method-btn" data-method="roll" style="flex:1; min-width:130px; font-weight:600;">
                    Roll 4d6 (Drop Lowest)
                </button>
                <button type="button" class="btn ${e.statMethod==="manual"?"btn-primary":"btn-secondary"} pc-method-btn" data-method="manual" style="flex:1; min-width:130px; font-weight:600;">
                    Manual Entry
                </button>
            </div>
        </div>

        <!-- Active Method Configuration -->
        <div class="builder-section-box">
            ${e.statMethod==="standard"?`
                <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="color:var(--color-gold-light);">Standard Array: [15, 14, 13, 12, 10, 8]</strong>
                        <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">Assign each value to a different ability score below.</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    ${n.map(t=>`
                        <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                            <label style="font-weight:700; color:var(--color-gold-base); font-size:0.85rem; text-transform:uppercase;">${t}</label>
                            <select class="pc-std-arr-sel" data-stat="${t}" style="width:100%; margin-top:6px; padding:6px; text-align:center; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                ${[15,14,13,12,10,8].map(a=>`
                                    <option value="${a}" ${e.standardArrayAssignments[t]===a?"selected":""}>${a}</option>
                                `).join("")}
                            </select>
                        </div>
                    `).join("")}
                </div>
            `:""}

            ${e.statMethod==="pointbuy"?`
                <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="color:var(--color-gold-light); font-size:1rem;">Point Buy Budget (Scores 8 to 15)</strong>
                        <div style="font-size:0.8rem; color:var(--color-text-secondary);">Cost: 8:0 &bull; 9:1 &bull; 10:2 &bull; 11:3 &bull; 12:4 &bull; 13:5 &bull; 14:7 &bull; 15:9</div>
                    </div>
                    <div style="font-size:1.05rem; font-weight:bold; padding:4px 14px; border-radius:20px; background:rgba(0,0,0,0.4); border:1px solid ${h>=0?"#4caf50":"#f44336"}; color:${h>=0?"#81c784":"#ef5350"};">
                        Points Remaining: ${h} / 27
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    ${n.map(t=>{const a=e.pointBuyScores[t]||8,o=v[a]||0;return`
                            <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                                <div style="font-weight:700; color:var(--color-gold-base); font-size:0.85rem; text-transform:uppercase;">${t}</div>
                                <div style="font-size:1.35rem; font-weight:bold; color:var(--color-text-primary); margin:4px 0;">${a}</div>
                                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:8px;">Cost: ${o} pts</div>
                                <div style="display:flex; justify-content:center; gap:6px;">
                                    <button type="button" class="btn btn-secondary btn-xs pc-pb-btn" data-stat="${t}" data-dir="-1" ${a<=8?"disabled":""} style="width:30px; height:28px;">-</button>
                                    <button type="button" class="btn btn-secondary btn-xs pc-pb-btn" data-stat="${t}" data-dir="1" ${a>=15||h<(v[a+1]||9)-o?"disabled":""} style="width:30px; height:28px;">+</button>
                                </div>
                            </div>
                        `}).join("")}
                </div>
            `:""}

            ${e.statMethod==="roll"?`
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
                    ${e.rolledScores.map((t,a)=>`
                        <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-size:0.75rem; color:var(--color-text-muted);">Pool ${a+1}</span>
                                <button type="button" class="btn btn-xxs btn-secondary pc-reroll-single" data-idx="${a}" title="Re-roll this stat"><i class="fa-solid fa-rotate-right"></i></button>
                            </div>
                            <div style="font-size:1.35rem; font-weight:bold; color:var(--color-gold-light);">${t.val}</div>
                            <div style="font-size:0.7rem; color:var(--color-text-muted); margin-bottom:6px;">[${t.rolls.join(", ")}]</div>
                            <select class="pc-roll-assign-sel" data-idx="${a}" style="width:100%; padding:4px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                ${n.map(o=>`<option value="${o}" ${t.assignedStat===o?"selected":""}>${o.toUpperCase()}</option>`).join("")}
                            </select>
                        </div>
                    `).join("")}
                </div>
            `:""}

            ${e.statMethod==="manual"?`
                <div style="margin-bottom:12px;">
                    <strong style="color:var(--color-gold-light);">Manual Score Entry (1 to 30)</strong>
                    <div style="font-size:0.8rem; color:var(--color-text-secondary);">Directly input your character base ability scores.</div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px;">
                    ${n.map(t=>`
                        <div class="glass-flat" style="padding:10px; border-radius:6px; text-align:center; border:1px solid var(--color-border-subtle);">
                            <label style="font-weight:700; color:var(--color-gold-base); font-size:0.85rem; text-transform:uppercase;">${t}</label>
                            <input type="number" id="pc-man-stat-${t}" min="1" max="30" value="${e.manualScores[t]}" style="width:100%; margin-top:6px; padding:6px; text-align:center; font-weight:bold; font-size:1.1rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); border-radius:4px;">
                        </div>
                    `).join("")}
                </div>
            `:""}
        </div>

        <!-- Racial ASI & Total Scores Breakdown -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-chart-simple text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Racial ASI & Live Scores Breakdown</strong>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="btn ${e.racialAsiMode==="catalog"?"btn-primary":"btn-secondary"} btn-xxs pc-asi-mode-btn" data-asimode="catalog">Standard Species</button>
                    <button type="button" class="btn ${e.racialAsiMode==="tashas"?"btn-primary":"btn-secondary"} btn-xxs pc-asi-mode-btn" data-asimode="tashas">Tasha's Rules</button>
                    <button type="button" class="btn ${e.racialAsiMode==="background"?"btn-primary":"btn-secondary"} btn-xxs pc-asi-mode-btn" data-asimode="background">Background ASI (2024)</button>
                    <button type="button" class="btn ${e.racialAsiMode==="custom"?"btn-primary":"btn-secondary"} btn-xxs pc-asi-mode-btn" data-asimode="custom">Custom ASI</button>
                </div>
            </div>

            ${e.racialAsiMode==="catalog"&&f.length>0?`
                <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                    ${f.map(t=>`
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">${t.label}:</span>
                            <select class="pc-wiz-racial-choice-sel" data-cid="${t.id}" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                <option value="">-- Choose Ability (+${t.amount}) --</option>
                                ${t.from.map(a=>`<option value="${a}" ${e.racialChoices[t.id]===a?"selected":""}>${g[a]} (+${t.amount})</option>`).join("")}
                            </select>
                        </div>
                    `).join("")}
                </div>
            `:""}

            ${e.racialAsiMode==="tashas"?`
                <div style="background:rgba(0,0,0,0.25); padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); margin-bottom:12px;">
                    <div style="display:flex; gap:16px; align-items:center; margin-bottom:8px;">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-tashas-mode-radio" value="plus2plus1" ${e.tashasMode!=="threePlus1"?"checked":""} style="accent-color:var(--color-gold-base);">
                            <span>+2 to One, +1 to Another</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-tashas-mode-radio" value="threePlus1" ${e.tashasMode==="threePlus1"?"checked":""} style="accent-color:var(--color-gold-base);">
                            <span>+1 to Three Distinct Scores</span>
                        </label>
                    </div>
                    ${e.tashasMode==="threePlus1"?`
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 1:</span>
                                <select id="pc-wiz-tashas-1-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${n.map(t=>`<option value="${t}" ${e.tashasPlus1_1===t?"selected":""}>${g[t]} (+1)</option>`).join("")}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 2:</span>
                                <select id="pc-wiz-tashas-1-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${n.map(t=>`<option value="${t}" ${e.tashasPlus1_2===t?"selected":""}>${g[t]} (+1)</option>`).join("")}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 3:</span>
                                <select id="pc-wiz-tashas-1-3" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${n.map(t=>`<option value="${t}" ${e.tashasPlus1_3===t?"selected":""}>${g[t]} (+1)</option>`).join("")}
                                </select>
                            </div>
                        </div>
                    `:`
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+2 Bonus:</span>
                                <select id="pc-wiz-tashas-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${n.map(t=>`<option value="${t}" ${e.tashasPlus2===t?"selected":""}>${g[t]} (+2)</option>`).join("")}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Bonus:</span>
                                <select id="pc-wiz-tashas-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${n.map(t=>`<option value="${t}" ${e.tashasPlus1===t?"selected":""}>${g[t]} (+1)</option>`).join("")}
                                </select>
                            </div>
                        </div>
                    `}
                </div>
            `:""}

            ${e.racialAsiMode==="background"?`
                <div style="background:rgba(0,0,0,0.25); padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); margin-bottom:12px;">
                    <div style="display:flex; gap:16px; align-items:center; margin-bottom:8px;">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-bgasi-mode-radio" value="plus2plus1" ${e.bgAsiMode!=="threePlus1"?"checked":""} style="accent-color:var(--color-gold-base);">
                            <span>+2 to One, +1 to Another</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; color:var(--color-gold-light);">
                            <input type="radio" name="pc-bgasi-mode-radio" value="threePlus1" ${e.bgAsiMode==="threePlus1"?"checked":""} style="accent-color:var(--color-gold-base);">
                            <span>+1 to Three Distinct Scores</span>
                        </label>
                    </div>
                    ${e.bgAsiMode==="threePlus1"?`
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 1:</span>
                                <select id="pc-wiz-bgasi-1-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${x(e.bgAsiPlus1_1,"+1")}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 2:</span>
                                <select id="pc-wiz-bgasi-1-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${x(e.bgAsiPlus1_2,"+1")}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Stat 3:</span>
                                <select id="pc-wiz-bgasi-1-3" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${x(e.bgAsiPlus1_3,"+1")}
                                </select>
                            </div>
                        </div>
                    `:`
                        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+2 Bonus:</span>
                                <select id="pc-wiz-bgasi-2" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${x(e.bgAsiPlus2,"+2")}
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">+1 Bonus:</span>
                                <select id="pc-wiz-bgasi-1" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    ${x(e.bgAsiPlus1,"+1")}
                                </select>
                            </div>
                        </div>
                    `}
                </div>
            `:""}

            ${(r.asiTiers||[]).some(t=>t.choice==="unselected")?`
                <div style="margin-bottom:10px; font-size:0.8rem; color:var(--color-gold-light); display:flex; align-items:center; gap:6px; background:rgba(212,175,55,0.1); padding:6px 12px; border-radius:4px; border:1px solid rgba(212,175,55,0.25);">
                    <i class="fa-solid fa-circle-info"></i> <span>You have pending Level Milestone ASIs or Feats to assign in <strong>Step 6 (Feats & ASIs)</strong>.</span>
                </div>
            `:""}
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
                        ${n.map(t=>{let a=10;if(e.statMethod==="standard")a=parseInt(e.standardArrayAssignments[t])||10;else if(e.statMethod==="pointbuy")a=parseInt(e.pointBuyScores[t])||8;else if(e.statMethod==="roll"){const p=e.rolledScores.find(y=>y.assignedStat===t);a=p?p.val:10}else e.statMethod==="manual"&&(a=parseInt(e.manualScores[t])||10);const o=E[t]||0,s=B[t]||0,d=M[t]||10,l=P(d),c=d>20;return`
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                     <td style="padding:8px 6px; text-align:left; font-weight:bold; color:var(--color-text-primary);">${g[t]} (${t.toUpperCase()})</td>
                                     <td style="padding:8px 6px; color:var(--color-text-secondary);">${a}</td>
                                     <td style="padding:8px 6px;">
                                         ${e.racialAsiMode==="custom"?`
                                             <input type="number" class="pc-custom-asi-input" data-stat="${t}" value="${e.customRacialBonuses[t]||0}" min="-5" max="10" style="width:48px; text-align:center; padding:2px; font-size:0.85rem; font-weight:bold; background:rgba(0,0,0,0.5); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                                         `:`
                                             <span style="color:${o>0?"#81c784":"var(--color-text-muted)"}; font-weight:600;">${o>0?"+"+o:"+0"}</span>
                                         `}
                                     </td>
                                     <td style="padding:8px 6px; color:${s>0?"#4fc3f7":"var(--color-text-muted)"};">${s>0?"+"+s:"+0"}</td>
                                     <td style="padding:8px 6px; font-weight:bold; font-size:1.05rem; color:${c?"#ff9800":"var(--color-gold-light)"};">
                                         ${d}
                                         ${c?'<span class="badge" style="background:rgba(255,152,0,0.2); color:#ffb74d; border:1px solid #ff9800; font-size:0.65rem; margin-left:4px; padding:1px 4px; border-radius:3px;" title="Standard 5e ability cap is 20 without magic items or epic boons.">>20 Cap</span>':""}
                                     </td>
                                     <td style="padding:8px 6px; font-weight:bold; font-size:1.05rem; color:${l>=0?"var(--color-gold-base)":"#e57373"};">${l>=0?"+":""}${l}</td>
                                 </tr>
                             `}).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `,document.querySelectorAll(".pc-method-btn").forEach(t=>{t.addEventListener("click",()=>{e.statMethod=t.dataset.method,i().then(()=>renderStep2(r))})}),document.querySelectorAll(".pc-std-arr-sel").forEach(t=>{t.addEventListener("change",a=>{const o=a.target.dataset.stat,s=parseInt(a.target.value)||10,d=e.standardArrayAssignments[o],l=n.find(c=>c!==o&&e.standardArrayAssignments[c]===s);l&&(e.standardArrayAssignments[l]=d),e.standardArrayAssignments[o]=s,i().then(()=>renderStep2(r))})}),document.querySelectorAll(".pc-pb-btn").forEach(t=>{t.addEventListener("click",a=>{const o=a.currentTarget.dataset.stat,s=parseInt(a.currentTarget.dataset.dir),l=(e.pointBuyScores[o]||8)+s;l>=8&&l<=15&&(e.pointBuyScores[o]=l,i().then(()=>renderStep2(r)))})}),document.getElementById("pc-wiz-roll-all-btn")?.addEventListener("click",()=>{e.rolledScores.forEach(t=>{const a=Math.floor(Math.random()*6)+1,o=Math.floor(Math.random()*6)+1,s=Math.floor(Math.random()*6)+1,d=Math.floor(Math.random()*6)+1,l=[a,o,s,d].sort((c,p)=>p-c);t.rolls=l,t.val=l[0]+l[1]+l[2]}),i().then(()=>renderStep2(r))}),document.querySelectorAll(".pc-reroll-single").forEach(t=>{t.addEventListener("click",a=>{const o=parseInt(a.currentTarget.dataset.idx),s=Math.floor(Math.random()*6)+1,d=Math.floor(Math.random()*6)+1,l=Math.floor(Math.random()*6)+1,c=Math.floor(Math.random()*6)+1,p=[s,d,l,c].sort((y,L)=>L-y);e.rolledScores[o].rolls=p,e.rolledScores[o].val=p[0]+p[1]+p[2],i().then(()=>renderStep2(r))})}),document.querySelectorAll(".pc-roll-assign-sel").forEach(t=>{t.addEventListener("change",a=>{const o=parseInt(a.target.dataset.idx),s=a.target.value,d=e.rolledScores[o].assignedStat,l=e.rolledScores.find((c,p)=>p!==o&&c.assignedStat===s);l&&(l.assignedStat=d),e.rolledScores[o].assignedStat=s,i().then(()=>renderStep2(r))})}),document.querySelectorAll(".pc-asi-mode-btn").forEach(t=>{t.addEventListener("click",()=>{e.racialAsiMode=t.dataset.asimode,i().then(()=>renderStep2(r))})}),document.querySelectorAll('input[name="pc-tashas-mode-radio"]').forEach(t=>{t.addEventListener("change",a=>{e.tashasMode=a.target.value,i().then(()=>renderStep2(r))})});function b(t,a,o){const s=new Set;[t,a,o].forEach(d=>{if(s.has(e[d])){const l=n.find(c=>!s.has(c))||"str";e[d]=l,s.add(l)}else s.add(e[d])})}document.getElementById("pc-wiz-tashas-2")?.addEventListener("change",t=>{e.tashasPlus2=t.target.value,e.tashasPlus1===e.tashasPlus2&&(e.tashasPlus1=n.find(a=>a!==e.tashasPlus2)||"con"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-tashas-1")?.addEventListener("change",t=>{e.tashasPlus1=t.target.value,e.tashasPlus2===e.tashasPlus1&&(e.tashasPlus2=n.find(a=>a!==e.tashasPlus1)||"str"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-tashas-1-1")?.addEventListener("change",t=>{e.tashasPlus1_1=t.target.value,b("tashasPlus1_1","tashasPlus1_2","tashasPlus1_3"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-tashas-1-2")?.addEventListener("change",t=>{e.tashasPlus1_2=t.target.value,b("tashasPlus1_2","tashasPlus1_1","tashasPlus1_3"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-tashas-1-3")?.addEventListener("change",t=>{e.tashasPlus1_3=t.target.value,b("tashasPlus1_3","tashasPlus1_1","tashasPlus1_2"),i().then(()=>renderStep2(r))}),document.querySelectorAll('input[name="pc-bgasi-mode-radio"]').forEach(t=>{t.addEventListener("change",a=>{e.bgAsiMode=a.target.value,i().then(()=>renderStep2(r))})}),document.getElementById("pc-wiz-bgasi-2")?.addEventListener("change",t=>{e.bgAsiPlus2=t.target.value,e.bgAsiPlus1===e.bgAsiPlus2&&(e.bgAsiPlus1=n.find(a=>a!==e.bgAsiPlus2)||"con"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-bgasi-1")?.addEventListener("change",t=>{e.bgAsiPlus1=t.target.value,e.bgAsiPlus2===e.bgAsiPlus1&&(e.bgAsiPlus2=n.find(a=>a!==e.bgAsiPlus1)||"str"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-bgasi-1-1")?.addEventListener("change",t=>{e.bgAsiPlus1_1=t.target.value,b("bgAsiPlus1_1","bgAsiPlus1_2","bgAsiPlus1_3"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-bgasi-1-2")?.addEventListener("change",t=>{e.bgAsiPlus1_2=t.target.value,b("bgAsiPlus1_2","bgAsiPlus1_1","bgAsiPlus1_3"),i().then(()=>renderStep2(r))}),document.getElementById("pc-wiz-bgasi-1-3")?.addEventListener("change",t=>{e.bgAsiPlus1_3=t.target.value,b("bgAsiPlus1_3","bgAsiPlus1_1","bgAsiPlus1_2"),i().then(()=>renderStep2(r))}),document.querySelectorAll(".pc-custom-asi-input").forEach(t=>{t.addEventListener("input",a=>{const o=a.target.dataset.stat;o&&(e.customRacialBonuses[o]=parseInt(a.target.value)||0)}),t.addEventListener("change",a=>{const o=a.target.dataset.stat;o&&(e.customRacialBonuses[o]=parseInt(a.target.value)||0),i().then(()=>renderStep2(r))})}),document.querySelectorAll(".pc-wiz-racial-choice-sel").forEach(t=>{t.addEventListener("change",a=>{const o=a.target.dataset.cid;o&&(e.racialChoices[o]=a.target.value),i().then(()=>renderStep2(r))})})}
