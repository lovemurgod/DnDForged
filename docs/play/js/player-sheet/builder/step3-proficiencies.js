export function renderStep3(u){const{bodyEl:r,workingChar:i,candidateProficiencies:x,candidateSpeciesSkills:n=[],speciesSkillChoiceDef:c=null,speciesLanguageChoiceDef:b=null,speciesToolChoiceDef:m=null,candidateLanguages:z=[],candidateTools:k=[],bgLanguageChoiceDef:$=null,bgToolChoiceDef:S=null,candidateBgSkills:p,availableClassSkills:A,selectedClassSkills:d,classSkillLimit:C,multiclassSkillSections:L=[],selectedMulticlassSkills:v=new Map,classExpertiseLimit:w=0,updateCountsDisplay:h}=u;i.expertise=i.expertise||{},i.selectedSpeciesSkills=Array.isArray(i.selectedSpeciesSkills)?i.selectedSpeciesSkills:[],i.selectedLanguages=Array.isArray(i.selectedLanguages)?i.selectedLanguages:[],i.selectedTools=Array.isArray(i.selectedTools)?i.selectedTools:[];const o=new Set;n.forEach(e=>o.add(e)),i.selectedSpeciesSkills.forEach(e=>o.add(e)),p.forEach(e=>o.add(e)),d.forEach(e=>o.add(e)),v.forEach(e=>{e.forEach(s=>o.add(s))}),x.filter(e=>e.type==="skill"&&e.checked).forEach(e=>o.add(e.label));const T=(i.classes||[]).some(e=>(e.name||"").toLowerCase()==="rogue");(T||k.some(e=>e.toLowerCase().includes("thieves")))&&o.add("Thieves' Tools"),Object.keys(i.expertise).forEach(e=>{o.has(e)||delete i.expertise[e]});const E=Object.keys(i.expertise).filter(e=>!!i.expertise[e]).length,g=[];if(b&&b.count>0)for(let e=0;e<b.count;e++)g.push({type:"species",label:`Species Language Choice ${e+1}`,from:b.from||[]});if($&&$.count>0)for(let e=0;e<$.count;e++)g.push({type:"background",label:`Background Language Choice ${e+1}`,from:$.from||[]});const f=[];if(m&&m.count>0)for(let e=0;e<m.count;e++)f.push({type:"species",label:`Species Tool Choice ${e+1}`,from:m.from||[]});if(S&&S.count>0)for(let e=0;e<S.count;e++)f.push({type:"background",label:`Background Tool Choice ${e+1}`,from:S.from||[]});r.innerHTML=`
        <!-- Saving Throws -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-award text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Saving Throw Proficiencies</strong>
                    <span class="builder-pill">${i.classes[0]?.name||"Primary Class"}</span>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${x.filter(e=>e.type==="save").map(e=>`
                    <label class="builder-badge-check ${e.checked?"is-checked":""}" style="margin:0; cursor:pointer;">
                        <input type="checkbox" class="pc-wiz-prof-chk" data-prof-id="${e.id}" ${e.checked?"checked":""} style="accent-color:var(--color-gold-base);">
                        <strong>${e.label}</strong>
                    </label>
                `).join("")}
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
                ${x.filter(e=>e.type!=="save").map(e=>`
                    <label class="builder-badge-check ${e.checked?"is-checked":""}" style="margin:0; cursor:pointer;">
                        <input type="checkbox" class="pc-wiz-prof-chk" data-prof-id="${e.id}" ${e.checked?"checked":""} style="accent-color:var(--color-gold-base);">
                        <span>${e.label}</span>
                    </label>
                `).join("")}
            </div>
        </div>

        <!-- Skill Proficiencies -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-graduation-cap text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Skill Proficiencies</strong>
                    <span class="builder-pill" style="color:#4fc3f7;">Class Skills: <strong>${d.size} / ${C}</strong></span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${n.length>0?`
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Species Skills (Granted by ${i.race||"Species"})
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${n.map(e=>`
                                <div class="builder-badge-check is-bg" style="margin:0; border-color:rgba(129,199,132,0.4);" title="Granted by Species">
                                    <i class="fa-solid fa-check" style="font-size:0.75rem; color:#81c784;"></i>
                                    <strong>${e}</strong>
                                    <span class="badge" style="font-size:0.65rem; background:rgba(129,199,132,0.2); color:#81c784; padding:0 4px; border-radius:3px;">Species</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `:""}

                ${c&&c.count>0?`
                    <div style="border-left:3px solid #81c784; padding-left:10px;">
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Species Skill Choices (Choose ${c.count} for ${c.label||i.race||"Species"}): <strong style="color:#81c784;">${i.selectedSpeciesSkills.length} / ${c.count}</strong>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${c.from.map(e=>{const s=n.includes(e)||p.includes(e),l=i.selectedSpeciesSkills.includes(e),a=s||!l&&i.selectedSpeciesSkills.length>=c.count;return`
                                    <label class="builder-badge-check ${l||s?"is-checked":""} ${a?"is-disabled":""}" style="margin:0; cursor:${s?"default":"pointer"};">
                                        <input type="checkbox" class="pc-wiz-species-skill-chk" data-skill="${e}" ${l?"checked":""} ${a?"disabled":""} style="accent-color:#81c784;">
                                        <span>${e}</span>
                                        ${s?'<span style="font-size:0.65rem; opacity:0.7;">(Granted)</span>':""}
                                    </label>
                                `}).join("")}
                        </div>
                    </div>
                `:""}

                ${p.length>0?`
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Background Skills (Granted by ${i.background||"Background"})
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${p.map(e=>`
                                <div class="builder-badge-check is-bg" style="margin:0;" title="Granted by Background">
                                    <i class="fa-solid fa-check" style="font-size:0.75rem;"></i>
                                    <strong>${e}</strong>
                                    <span class="badge" style="font-size:0.65rem; background:rgba(255,255,255,0.1); padding:0 4px; border-radius:3px;">Background</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `:""}

                <div>
                    <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                        Class Skills (Choose up to ${C} for ${i.classes[0]?.name||"Primary Class"})
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${A.map(e=>{const s=n.includes(e),l=p.includes(e),a=s||l,t=d.has(e),y=a||!t&&d.size>=C;return`
                                <label class="builder-badge-check ${t||a?"is-checked":""} ${y?"is-disabled":""}" style="margin:0; cursor:${a?"default":"pointer"};" title="${s?"Already granted by Species":l?"Already granted by Background":""}">
                                    <input type="checkbox" class="pc-wiz-class-skill-chk" data-skill="${e}" ${t?"checked":""} ${y?"disabled":""} style="accent-color:var(--color-gold-base);">
                                    <span>${e}</span>
                                    ${a?'<span style="font-size:0.65rem; opacity:0.7;">(Granted)</span>':""}
                                </label>
                            `}).join("")}
                    </div>
                </div>

                ${L.length>0?L.map(e=>{const s=v.get(e.classIdx)||new Set;return`
                    <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Multiclass Skills (Choose ${e.limit} for ${e.className}): <strong style="color:#4fc3f7;">${s.size} / ${e.limit}</strong>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${e.from.map(l=>{const a=n.includes(l)||p.includes(l)||d.has(l),t=s.has(l),y=a||!t&&s.size>=e.limit;return`
                                    <label class="builder-badge-check ${t?"is-checked":""} ${y?"is-disabled":""}" style="margin:0; cursor:${a?"default":"pointer"};">
                                        <input type="checkbox" class="pc-wiz-mc-skill-chk" data-cidx="${e.classIdx}" data-skill="${l}" ${t?"checked":""} ${y?"disabled":""} style="accent-color:var(--color-gold-base);">
                                        <span>${l}</span>
                                    </label>
                                `}).join("")}
                        </div>
                    </div>
                `}).join(""):""}
            </div>
        </div>

        <!-- Languages & Tool Proficiencies Confirmation -->
        ${z.length>0||k.length>0||g.length>0||f.length>0?`
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-language text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Languages & Tools</strong>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${z.length>0||g.length>0?`
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Languages
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${z.map(e=>`
                                <div class="builder-badge-check is-bg" style="margin:0;">
                                    <i class="fa-solid fa-comment-dots" style="font-size:0.75rem; color:#4fc3f7;"></i>
                                    <strong>${e}</strong>
                                </div>
                            `).join("")}
                        </div>
                        ${g.length>0?`
                            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                                <div style="font-size:0.75rem; color:var(--color-gold-light); font-weight:600;">
                                    Choose Language Proficiencies:
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap:10px;">
                                    ${g.map((e,s)=>`
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span style="font-size:0.8rem; color:var(--color-text-secondary);">${e.label}:</span>
                                            <select class="pc-wiz-lang-choice-sel" data-idx="${s}" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                <option value="">-- Choose Language --</option>
                                                ${e.from.map(l=>`<option value="${l}" ${i.selectedLanguages[s]===l?"selected":""}>${l}</option>`).join("")}
                                            </select>
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        `:""}
                    </div>
                `:""}
                ${k.length>0||f.length>0?`
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px; font-weight:600;">
                            Tool Proficiencies
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${k.map(e=>`
                                <div class="builder-badge-check is-bg" style="margin:0;">
                                    <i class="fa-solid fa-wrench" style="font-size:0.75rem; color:var(--color-gold-base);"></i>
                                    <strong>${e}</strong>
                                </div>
                            `).join("")}
                        </div>
                        ${f.length>0?`
                            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                                <div style="font-size:0.75rem; color:var(--color-gold-light); font-weight:600;">
                                    Choose Tool Proficiencies:
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap:10px;">
                                    ${f.map((e,s)=>`
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span style="font-size:0.8rem; color:var(--color-text-secondary);">${e.label}:</span>
                                            <select class="pc-wiz-tool-choice-sel" data-idx="${s}" style="padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                <option value="">-- Choose Tool --</option>
                                                ${e.from.map(l=>`<option value="${l}" ${i.selectedTools[s]===l?"selected":""}>${l}</option>`).join("")}
                                            </select>
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        `:""}
                    </div>
                `:""}
            </div>
        </div>
        `:""}

        <!-- Class Expertise (Rogue, Bard, Ranger Canny) -->
        ${w>0?`
        <div class="builder-section-box" style="border-left:3px solid var(--color-gold-base);">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-star text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Class Expertise</strong>
                    <span class="builder-pill" style="color:${E>=w?"#2ecc71":"#f59e0b"};">
                        Expertise: <strong>${E} / ${w}</strong>
                    </span>
                </div>
            </div>
            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:8px;">
                Choose proficiencies for expertise (double your proficiency bonus). You can select from your proficient skills${T?" or Thieves' Tools":""}.
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${Array.from(o).map(e=>{const s=!!i.expertise[e],l=!s&&E>=w;return`
                        <label class="builder-badge-check ${s?"is-checked":""} ${l?"is-disabled":""}" style="margin:0; cursor:pointer;">
                            <input type="checkbox" class="pc-wiz-expertise-chk" data-skill="${e}" ${s?"checked":""} ${l?"disabled":""} style="accent-color:var(--color-gold-base);">
                            <i class="fa-solid fa-star" style="font-size:0.7rem; color:${s?"var(--color-gold-base)":"var(--color-text-muted)"};"></i>
                            <strong>${e}</strong>
                        </label>
                    `}).join("")}
            </div>
        </div>
        `:""}
    `,r.querySelectorAll(".pc-wiz-prof-chk").forEach(e=>{e.addEventListener("change",s=>{const l=s.target.dataset.profId,a=x.find(t=>t.id===l);a&&(a.checked=s.target.checked),h()})}),r.querySelectorAll(".pc-wiz-species-skill-chk").forEach(e=>{e.addEventListener("change",s=>{const l=s.target.dataset.skill;s.target.checked?i.selectedSpeciesSkills.includes(l)||i.selectedSpeciesSkills.push(l):i.selectedSpeciesSkills=i.selectedSpeciesSkills.filter(a=>a!==l),renderStep3(u),h()})}),r.querySelectorAll(".pc-wiz-class-skill-chk").forEach(e=>{e.addEventListener("change",s=>{const l=s.target.dataset.skill;s.target.checked?d.add(l):d.delete(l),renderStep3(u),h()})}),r.querySelectorAll(".pc-wiz-mc-skill-chk").forEach(e=>{e.addEventListener("change",s=>{const l=parseInt(s.target.dataset.cidx),a=s.target.dataset.skill;v.has(l)||v.set(l,new Set);const t=v.get(l);s.target.checked?t.add(a):t.delete(a),renderStep3(u),h()})}),r.querySelectorAll(".pc-wiz-expertise-chk").forEach(e=>{e.addEventListener("change",s=>{const l=s.target.dataset.skill;s.target.checked?i.expertise[l]=!0:delete i.expertise[l],renderStep3(u),h()})}),r.querySelectorAll(".pc-wiz-lang-choice-sel").forEach(e=>{e.addEventListener("change",s=>{const l=parseInt(s.target.dataset.idx,10);i.selectedLanguages[l]=s.target.value})}),r.querySelectorAll(".pc-wiz-tool-choice-sel").forEach(e=>{e.addEventListener("change",s=>{const l=parseInt(s.target.dataset.idx,10);i.selectedTools[l]=s.target.value})})}
