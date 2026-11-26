export function renderStep4(o){const{bodyEl:d,workingChar:l,candidateClassFeatures:p,candidateRacialTraits:u,candidateBgFeatures:g,optFeatureSections:f,allCandidateAbilities:n,recomputeCandidates:b,updateCountsDisplay:c}=o;d.innerHTML=`
        <!-- Action Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <strong style="color:var(--color-gold-light); font-size:0.95rem;">Features, Background & Traits</strong>
            <div style="display:flex; gap:8px;">
                <button type="button" id="pc-wiz-add-custom-feat-btn" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Custom Trait</button>
                <button type="button" id="pc-wiz-feat-all-btn" class="btn btn-secondary btn-xs">Select All</button>
                <button type="button" id="pc-wiz-feat-none-btn" class="btn btn-secondary btn-xs">Deselect All</button>
            </div>
        </div>

        <!-- Class Features -->
        <div class="builder-section-box">
            <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-hat-wizard text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Class Features</strong>
                    <span class="builder-pill">${p.length} Available</span>
                </div>
                <div style="position:relative; min-width:180px;">
                    <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                    <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-class-feats-list" placeholder="Search class features..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div id="pc-wiz-class-feats-list" style="display:flex; flex-direction:column; gap:8px;">
                ${p.map(e=>`
                    <div class="glass-flat pc-wiz-feat-item" data-text="${(e.name+" "+(e.className||"")+" "+(e.description||"")).toLowerCase()}" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                        <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${e.id}" ${e.checked?"checked":""} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <strong style="color:var(--color-gold-light); font-size:0.9rem;">${e.name}</strong>
                                <span class="builder-pill" style="font-size:0.7rem;">${e.className} Lv ${e.level}</span>
                                ${e.isSubclass?'<span class="badge" style="background:rgba(186,104,200,0.15); border:1px solid rgba(186,104,200,0.4); color:#ba68c8; font-size:0.65rem;">Subclass</span>':""}
                            </div>
                            ${e.subOptions&&e.subOptions.length>0?`
                                <div style="margin-top:6px; display:flex; align-items:center; gap:8px;">
                                    <label style="font-size:0.75rem; color:var(--color-gold-light); font-weight:600;"><i class="fa-solid fa-list-check"></i> Selection:</label>
                                    <select class="pc-wiz-feat-suboption-sel" data-feat-id="${e.id}" style="padding:2px 8px; font-size:0.8rem; background:#1e1e1e; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                        ${e.subOptions.map(t=>`<option value="${t.name}" ${e.subOptionChoice===t.name?"selected":""}>${t.name}</option>`).join("")}
                                    </select>
                                </div>
                            `:""}
                            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                                ${(e.description||"").replace(/\n/g,"<br>")}
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>

        <!-- Racial Traits -->
        <div class="builder-section-box">
            <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-dna text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Racial Traits</strong>
                    <span class="builder-pill">${u.length} Available</span>
                </div>
                <div style="position:relative; min-width:180px;">
                    <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                    <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-racial-feats-list" placeholder="Search racial traits..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div id="pc-wiz-racial-feats-list" style="display:flex; flex-direction:column; gap:8px;">
                ${u.map(e=>`
                    <div class="glass-flat pc-wiz-feat-item" data-text="${(e.name+" "+(e.description||"")).toLowerCase()}" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                        <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${e.id}" ${e.checked?"checked":""} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                        <div style="flex:1;">
                            <strong style="color:var(--color-gold-light); font-size:0.9rem;">${e.name}</strong>
                            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                                ${(e.description||"").replace(/\n/g,"<br>")}
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>

        <!-- Background Features -->
        ${g.length>0?`
            <div class="builder-section-box">
                <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-book-atlas text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Background Features</strong>
                        <span class="builder-pill">${g.length} Available</span>
                    </div>
                    <div style="position:relative; min-width:180px;">
                        <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                        <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-bg-feats-list" placeholder="Search background features..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                </div>
                <div id="pc-wiz-bg-feats-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${g.map(e=>`
                        <div class="glass-flat pc-wiz-feat-item" data-text="${(e.name+" "+(e.description||"")).toLowerCase()}" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                            <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${e.id}" ${e.checked?"checked":""} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <strong style="color:var(--color-gold-light); font-size:0.9rem;">${e.name}</strong>
                                    <span class="builder-pill" style="font-size:0.7rem;">Background: ${l.background||"Selected"}</span>
                                </div>
                                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                                    ${(e.description||"").replace(/\n/g,"<br>")}
                                </div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `:""}

        <!-- Optional Features & Specializations -->
        ${f.map((e,t)=>`
            <div class="builder-section-box">
                <div class="builder-section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-wand-magic text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">${e.className} Specializations & Options</strong>
                        <span class="builder-pill">${e.features.length} Available</span>
                    </div>
                    <div style="position:relative; min-width:180px;">
                        <i class="fa-solid fa-search" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--color-text-muted);"></i>
                        <input type="text" class="pc-wiz-feat-search" data-target="pc-wiz-opt-feats-${t}" placeholder="Search ${e.className} options..." style="width:100%; padding:4px 8px 4px 26px; font-size:0.75rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:8px;">
                    Optional class features, eldritch invocations, maneuvers, infusions, metamagic or fighting styles unlocked by your ${e.className} levels.
                </div>
                <div id="pc-wiz-opt-feats-${t}" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;" class="scroll-styled">
                    ${e.features.map(a=>`
                        <div class="glass-flat pc-wiz-feat-item" data-text="${(a.name+" "+(a.prerequisite||"")+" "+(a.description||"")).toLowerCase()}" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:flex-start;">
                            <input type="checkbox" class="pc-wiz-feat-chk" data-feat-id="${a.id}" ${a.checked?"checked":""} style="margin-top:4px; accent-color:var(--color-gold-base); cursor:pointer;">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <strong style="color:var(--color-gold-light); font-size:0.85rem;">${a.name}</strong>
                                    ${a.prerequisite?`<span class="badge" style="font-size:0.65rem; background:rgba(255,255,255,0.08);">${a.prerequisite}</span>`:""}
                                </div>
                                <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px; line-height:1.35;">
                                    ${(a.description||"").replace(/\n/g,"<br>")}
                                </div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("")}

        <!-- Custom Added Features -->
        ${l.customFeatures.length>0?`
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Custom / Homebrew Features</strong>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${l.customFeatures.map((e,t)=>`
                        <div class="glass-flat" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <strong style="color:var(--color-gold-light); font-size:0.9rem;">${e.name}</strong>
                                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px;">${e.description}</div>
                            </div>
                            <button type="button" class="btn btn-danger btn-xxs pc-wiz-del-custom-feat" data-idx="${t}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `).join("")}
                </div>
            </div>
        `:""}
    `,d.querySelectorAll(".pc-wiz-feat-search").forEach(e=>{e.addEventListener("input",t=>{const a=t.target.dataset.target,i=(t.target.value||"").toLowerCase().trim(),s=document.getElementById(a);s&&s.querySelectorAll(".pc-wiz-feat-item").forEach(r=>{const x=r.dataset.text||"";r.style.display=!i||x.includes(i)?"flex":"none"})})}),d.querySelectorAll(".pc-wiz-feat-suboption-sel").forEach(e=>{e.addEventListener("change",t=>{const a=t.target.dataset.featId,i=t.target.value;l.featureSubChoices=l.featureSubChoices||{},l.featureSubChoices[a]=i;const s=p.find(r=>r.id===a);if(s&&s.subOptions){s.subOptionChoice=i;const r=s.subOptions.find(x=>x.name===i);r&&(s.description=(s.baseDescription||"")+`

**`+r.name+":** "+(r.description||""))}renderStep4(o)})}),d.querySelectorAll(".pc-wiz-feat-chk").forEach(e=>{e.addEventListener("change",t=>{const a=t.target.dataset.featId,i=n.find(s=>s.id===a);i&&(i.checked=t.target.checked),c()})}),document.getElementById("pc-wiz-feat-all-btn")?.addEventListener("click",()=>{n.forEach(e=>e.checked=!0),renderStep4(o),c()}),document.getElementById("pc-wiz-feat-none-btn")?.addEventListener("click",()=>{n.forEach(e=>e.checked=!1),renderStep4(o),c()}),document.getElementById("pc-wiz-add-custom-feat-btn")?.addEventListener("click",()=>{const e=prompt("Enter feature name:");if(!e)return;const t=prompt("Enter feature description (optional):")||"",a={id:"custom_f_"+Date.now(),name:e.trim(),description:t.trim(),actionType:"passive",category:"Custom Features",checked:!0};l.customFeatures.push(a),n.push(a),renderStep4(o),c()}),d.querySelectorAll(".pc-wiz-del-custom-feat").forEach(e=>{e.addEventListener("click",t=>{const a=parseInt(t.currentTarget.dataset.idx);l.customFeatures.splice(a,1),b().then(()=>renderStep4(o))})})}
