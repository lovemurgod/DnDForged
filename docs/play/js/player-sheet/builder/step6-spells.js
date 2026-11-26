export function renderStep6($){const{bodyEl:p,classSpellSections:g,candidateInnateSpells:v,candidateBgExpandedSpells:b=[],asiTiers:k=[],builderCache:w,userSelectedSpellMap:m,updateCountsDisplay:x}=$,c=[];if((k||[]).forEach(e=>{if(e.choice==="feat"&&e.selectedFeatId){const t=(w?.feats||[]).find(i=>{const a=`${i.id||i.name.replace(/\W+/g,"_").toLowerCase()}::${i.source||"PHB"}`,o=i.id||i.name.replace(/\W+/g,"_").toLowerCase();return a===e.selectedFeatId||o===e.selectedFeatId||(i.id||i.name)===e.selectedFeatId||(i.name||"").toLowerCase()===e.selectedFeatId.toLowerCase()}),l=t?t.name:"Feat",s=e.featSubChoices||{};/fey[- ]touched/i.test(l)?(c.push({name:"Misty Step",level:2,origin:l}),s.spell1&&c.push({name:s.spell1,level:1,origin:l})):/shadow[- ]touched/i.test(l)?(c.push({name:"Invisibility",level:2,origin:l}),s.spell1&&c.push({name:s.spell1,level:1,origin:l})):/magic initiate/i.test(l)||/strixhaven initiate/i.test(l)||/initiate of high sorcery/i.test(l)?(s.cantrip1&&c.push({name:s.cantrip1,level:0,origin:l}),s.cantrip2&&c.push({name:s.cantrip2,level:0,origin:l}),s.spell1&&c.push({name:s.spell1,level:1,origin:l})):/artificer initiate/i.test(l)?(s.cantrip1&&c.push({name:s.cantrip1,level:0,origin:l}),s.spell1&&c.push({name:s.spell1,level:1,origin:l})):/spell sniper/i.test(l)||/scion of the outer planes/i.test(l)?s.cantrip1&&c.push({name:s.cantrip1,level:0,origin:l}):/rune shaper/i.test(l)&&(c.push({name:"Comprehend Languages",level:1,origin:l}),s.spell1&&c.push({name:s.spell1,level:1,origin:l}),s.spell2&&c.push({name:s.spell2,level:1,origin:l}))}}),!(g.length>0||v.length>0||b.length>0||c.length>0)){p.innerHTML=`
            <div class="builder-section-box" style="text-align:center; padding:30px 20px;">
                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:2rem; color:var(--color-gold-base); margin-bottom:12px; opacity:0.6;"></i>
                <h4 style="color:var(--color-gold-light); margin:0 0 6px 0;">No Spells or Spellcasting Classes</h4>
                <div style="font-size:0.85rem; color:var(--color-text-muted); max-width:480px; margin:0 auto;">
                    Your current character classes, species, feats, and background do not grant spellcasting progression or innate spells. You can add spellcasting classes in Step 1, select a spellcasting feat in Step 6, or manage spells on the sheet later.
                </div>
            </div>
        `;return}p.innerHTML=`
        <!-- Species & Innate Magic -->
        ${v.length>0?`
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-sparkles text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Species & Innate Magic</strong>
                        <span class="builder-pill" style="color:#81c784;">Auto-Granted (${v.length})</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${v.map(e=>{const t=e.name||e.spell?.name||"Unknown Spell",l=e.level!==void 0&&e.level!==null?e.level:e.spell?.level||0,s=e.originName||e.sourceLabel||e.source||"Innate",i=e.school||e.spell?.school||"",a=e.time||e.spell?.time||"1 Action",o=e.range||e.spell?.range||"Self";return`
                            <div class="pc-wiz-spell-card" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); background:rgba(22,22,28,0.85); contain: content; display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <i class="fa-solid fa-check-circle" style="color:var(--color-gold-base);"></i>
                                    <strong style="color:var(--color-gold-light); font-size:0.85rem;">${t}</strong>
                                    <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${l===0?"Cantrip":"Lvl "+l}</span>
                                    <span class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-base); border:1px solid var(--color-gold-base); font-size:0.7rem; padding:1px 6px;">${s}</span>
                                    ${i?`<span style="font-size:0.75rem; color:var(--color-text-muted);">${i}</span>`:""}
                                </div>
                                <span style="font-size:0.75rem; color:var(--color-text-muted);">${a} &bull; ${o}</span>
                            </div>
                        `}).join("")}
                </div>
            </div>
        `:""}

        <!-- Feat Granted Magic -->
        ${c.length>0?`
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-award text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Feat Granted Magic</strong>
                        <span class="builder-pill" style="color:#c084fc;">Configured in Feats (${c.length})</span>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:6px;">
                    ${c.map(e=>`
                        <div class="pc-wiz-spell-card" style="padding:8px 12px; border-radius:6px; border:1px solid rgba(192,132,252,0.3); background:rgba(22,22,28,0.85); contain: content; display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-wand-sparkles" style="color:#c084fc;"></i>
                                <strong style="color:var(--color-text-primary); font-size:0.85rem;">${e.name}</strong>
                                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${e.level===0?"Cantrip":"Lvl "+e.level}</span>
                            </div>
                            <span class="badge" style="background:rgba(192,132,252,0.15); color:#c084fc; font-size:0.7rem; padding:1px 6px;">${e.origin}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `:""}

        <!-- Background Guild & College Expanded Spells Checklist -->
        ${b.length>0?`
            <div class="builder-section-box">
                <div class="builder-section-header">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <i class="fa-solid fa-scroll text-gradient-gold"></i>
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Background Guild & College Spells</strong>
                        <span id="pc-wiz-bg-spells-pill" class="builder-pill" style="color:#38bdf8;">
                            Selected: ${b.filter(e=>e.checked).length} / ${b.length}
                        </span>
                    </div>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:10px;">
                    These spells are added to your spell repertoire by your background. Toggle the spells you wish to have prepared or known.
                </div>
                <div class="pc-wiz-bg-spells-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:8px;">
                    ${b.map((e,t)=>`
                        <div class="pc-wiz-spell-card ${e.checked?"is-selected":""}" style="padding:8px 10px; border-radius:6px; border:1px solid ${e.checked?"var(--color-gold-base)":"var(--color-border-subtle)"}; background:${e.checked?"rgba(212,175,55,0.12)":"rgba(22,22,28,0.85)"}; contain: content; display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; min-width:0;">
                                    <input type="checkbox" class="pc-wiz-bg-spell-chk" data-idx="${t}" ${e.checked?"checked":""}>
                                    <strong style="font-size:0.85rem; color:var(--color-gold-light); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.name}</strong>
                                </label>
                                <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${e.level===0?"Cantrip":"Lvl "+e.level}</span>
                                <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:0.7rem; padding:1px 6px;">${e.originName||"Background"}</span>
                            </div>
                            <div style="font-size:0.75rem; color:var(--color-text-muted); display:flex; justify-content:space-between;">
                                <span>${e.school||"Magic"}</span>
                                <span>${e.time||"1 action"} &bull; ${e.range||"Self"}</span>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `:""}

        <!-- Class Spellcasting Progression -->
        ${g.length===0?`
            <div class="builder-section-box" style="text-align:center; padding:20px;">
                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:1.8rem; color:var(--color-gold-base); margin-bottom:8px; opacity:0.6;"></i>
                <h4 style="color:var(--color-gold-light); margin:0 0 6px 0;">No Class Spellcasting Progression</h4>
                <div style="font-size:0.85rem; color:var(--color-text-muted); max-width:480px; margin:0 auto;">
                    Your current character classes do not prepare or learn spells from a class list. The innate species, feat, or background spells above will be imported automatically.
                </div>
            </div>
        `:g.map((e,t)=>{const l=e.spells.filter(r=>r.isCantrip&&r.checked).length,s=e.spells.filter(r=>!r.isCantrip&&r.checked).length,i=l>e.maxCantrips,a=s>e.maxSpells,o=e.casterType==="prepared"||e.isPrepared,f=e.casterType==="wizard"||e.isWizard;let n=`Spells Known: ${s} / ${e.maxSpells}${a?" (Over Limit)":""}`,d=`color:${a?"#ffb74d":"#4fc3f7"}; ${a?"border:1px solid #ffb74d; background:rgba(255,183,77,0.15);":""}`;if(o)n=`Eligible Spells to Import: ${s} selected (All eligible available. Daily prep on sheet)`,d="color:#4fc3f7;";else if(f){const r=s>e.maxSpells;n=`Spellbook Capacity: ${s} / ${e.maxSpells}${r?" (Extra Inscribed)":""}`,d=`color:${r?"#ffb74d":"#4fc3f7"}; ${r?"border:1px solid #ffb74d; background:rgba(255,183,77,0.15);":""}`}const u=e.spells.filter(r=>!(e.searchFilter&&!r.name.toLowerCase().includes(e.searchFilter.toLowerCase())||e.levelFilter==="cantrip"&&r.level!==0||e.levelFilter!=="all"&&e.levelFilter!=="cantrip"&&r.level!==parseInt(e.levelFilter)||e.schoolFilter!=="all"&&(r.school||"").toLowerCase()!==(e.schoolFilter||"").toLowerCase()));return`
                <div class="builder-section-box">
                    <div class="builder-section-header">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1;">
                            <i class="fa-solid fa-wand-magic-sparkles text-gradient-gold"></i>
                            <strong style="font-size:0.95rem; color:var(--color-gold-base);">${e.className} Spells</strong>
                            <span id="pc-wiz-sec-cantrips-${t}" class="builder-pill" style="color:${i?"#ffb74d":"#ba68c8"}; ${i?"border:1px solid #ffb74d; background:rgba(255,183,77,0.15);":""}">
                                Cantrips: ${l} / ${e.maxCantrips}${i?" (Over Limit)":""}
                            </span>
                            <span id="pc-wiz-sec-spells-${t}" class="builder-pill" style="${d}">
                                ${n}
                            </span>
                            ${o?'<span class="badge" style="background:rgba(46,204,113,0.15); color:#2ecc71; border:1px solid rgba(46,204,113,0.4); font-size:0.7rem; padding:1px 6px;">Divine / Primal List &bull; All Eligible Selected</span>':""}
                        </div>
                        <div style="display:flex; gap:6px; margin-left:auto;">
                            <button type="button" class="btn btn-secondary btn-xxs pc-wiz-sp-select-all" data-sec="${t}"><i class="fa-solid fa-check-double"></i> Select All</button>
                            <button type="button" class="btn btn-secondary btn-xxs pc-wiz-sp-deselect-all" data-sec="${t}"><i class="fa-solid fa-xmark"></i> Deselect All</button>
                        </div>
                    </div>

                    <!-- Filter Bar -->
                    <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                        <input type="text" class="pc-wiz-sp-search" data-sec="${t}" placeholder="Search spells..." value="${e.searchFilter||""}" style="flex:2; min-width:140px; padding:6px 10px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                        <select class="pc-wiz-sp-lvl-filter" data-sec="${t}" style="flex:1; min-width:110px; padding:6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            <option value="all" ${e.levelFilter==="all"?"selected":""}>All Levels</option>
                            <option value="cantrip" ${e.levelFilter==="cantrip"?"selected":""}>Cantrips</option>
                            ${Array.from({length:Math.max(0,parseInt(e.maxSlot)||0)},(r,S)=>S+1).map(r=>`
                                <option value="${r}" ${e.levelFilter===String(r)?"selected":""}>Level ${r}</option>
                            `).join("")}
                        </select>
                    </div>

                    <!-- Spell Cards Grid -->
                    <div class="pc-wiz-spells-container" data-sec="${t}" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:8px;">
                        ${u.map(r=>`
                            <div class="pc-wiz-spell-card ${r.checked?"is-selected":""}" data-name="${(r.name||"").toLowerCase()}" data-school="${(r.school||"").toLowerCase()}" data-level="${r.level}" style="padding:8px 10px; border-radius:6px; border:1px solid ${r.checked?"var(--color-gold-base)":"var(--color-border-subtle)"}; background:${r.checked?"rgba(212,175,55,0.12)":"rgba(22,22,28,0.85)"}; contain: content; display:flex; flex-direction:column; gap:4px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1; min-width:0;">
                                        <input type="checkbox" class="pc-wiz-spell-chk" data-sec="${t}" data-spell-id="${r.id}" ${r.checked?"checked":""}>
                                        <strong style="font-size:0.85rem; color:var(--color-gold-light); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.name}</strong>
                                    </label>
                                    <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.7rem; padding:1px 6px;">${r.level===0?"Cantrip":"Lvl "+r.level}</span>
                                </div>
                                <div style="font-size:0.75rem; color:var(--color-text-muted); display:flex; justify-content:space-between;">
                                    <span>${r.school||"Magic"}</span>
                                    <span>${r.time||"1 action"} &bull; ${r.range||"Self"}</span>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `}).join("")}
    `;function y(e){const t=g[e];if(!t)return;const l=(t.searchFilter||"").toLowerCase().trim(),s=t.levelFilter||"all",i=p.querySelector(`.pc-wiz-spells-container[data-sec="${e}"]`);i&&i.querySelectorAll(".pc-wiz-spell-card").forEach(a=>{const o=a.dataset.name||"",f=a.dataset.school||"",n=parseInt(a.dataset.level)||0;let d=!0;l&&!o.includes(l)&&!f.includes(l)&&(d=!1),s==="cantrip"&&n!==0&&(d=!1),s!=="all"&&s!=="cantrip"&&n!==parseInt(s)&&(d=!1),a.style.display=d?"flex":"none"})}p.querySelectorAll(".pc-wiz-sp-search").forEach(e=>{e.addEventListener("input",t=>{const l=parseInt(t.target.dataset.sec);g[l].searchFilter=t.target.value,y(l)})});function h(e){const t=g[e];if(!t)return;const l=t.spells.filter(o=>o.isCantrip&&o.checked).length,s=t.spells.filter(o=>!o.isCantrip&&o.checked).length,i=document.getElementById(`pc-wiz-sec-cantrips-${e}`);if(i){const o=l>t.maxCantrips;i.style.color=o?"#ffb74d":"#ba68c8",i.style.border=o?"1px solid #ffb74d":"",i.style.background=o?"rgba(255,183,77,0.15)":"",i.textContent=`Cantrips: ${l} / ${t.maxCantrips}${o?" (Over Limit)":""}`}const a=document.getElementById(`pc-wiz-sec-spells-${e}`);if(a){const o=t.casterType==="prepared"||t.isPrepared,f=t.casterType==="wizard"||t.isWizard;if(o)a.style.color="#4fc3f7",a.style.border="",a.style.background="",a.textContent=`Eligible Spells to Import: ${s} selected (All eligible available. Daily prep on sheet)`;else if(f){const n=s>t.maxSpells;a.style.color=n?"#ffb74d":"#4fc3f7",a.style.border=n?"1px solid #ffb74d":"",a.style.background=n?"rgba(255,183,77,0.15)":"",a.textContent=`Spellbook Capacity: ${s} / ${t.maxSpells}${n?" (Extra Inscribed)":""}`}else{const n=s>t.maxSpells;a.style.color=n?"#ffb74d":"#4fc3f7",a.style.border=n?"1px solid #ffb74d":"",a.style.background=n?"rgba(255,183,77,0.15)":"",a.textContent=`Spells Known: ${s} / ${t.maxSpells}${n?" (Over Limit)":""}`}}x()}p.querySelectorAll(".pc-wiz-sp-select-all").forEach(e=>{e.addEventListener("click",t=>{const l=parseInt(t.currentTarget.dataset.sec),s=g[l];if(!s)return;s.spells.forEach(a=>{a.checked=!0,a.name&&m.set(a.name.toLowerCase().trim(),!0)});const i=p.querySelector(`.pc-wiz-spells-container[data-sec="${l}"]`);i&&i.querySelectorAll(".pc-wiz-spell-card").forEach(a=>{const o=a.querySelector(".pc-wiz-spell-chk");o&&(o.checked=!0),a.classList.add("is-selected"),a.style.borderColor="var(--color-gold-base)",a.style.background="rgba(212,175,55,0.12)"}),h(l)})}),p.querySelectorAll(".pc-wiz-sp-deselect-all").forEach(e=>{e.addEventListener("click",t=>{const l=parseInt(t.currentTarget.dataset.sec),s=g[l];if(!s)return;s.spells.forEach(a=>{a.checked=!1,a.name&&m.set(a.name.toLowerCase().trim(),!1)});const i=p.querySelector(`.pc-wiz-spells-container[data-sec="${l}"]`);i&&i.querySelectorAll(".pc-wiz-spell-card").forEach(a=>{const o=a.querySelector(".pc-wiz-spell-chk");o&&(o.checked=!1),a.classList.remove("is-selected"),a.style.borderColor="var(--color-border-subtle)",a.style.background="rgba(22,22,28,0.85)"}),h(l)})}),p.querySelectorAll(".pc-wiz-sp-lvl-filter").forEach(e=>{e.addEventListener("change",t=>{const l=parseInt(t.target.dataset.sec);g[l].levelFilter=t.target.value,y(l)})}),p.querySelectorAll(".pc-wiz-spell-chk").forEach(e=>{e.addEventListener("change",t=>{const l=parseInt(t.target.dataset.sec),s=t.target.dataset.spellId,i=g[l];if(!i)return;const a=i.spells.find(r=>r.id===s);a&&(a.checked=t.target.checked,a.name&&m.set(a.name.toLowerCase().trim(),e.checked));const o=t.target.closest(".pc-wiz-spell-card");o&&(t.target.checked?(o.classList.add("is-selected"),o.style.borderColor="var(--color-gold-base)",o.style.background="rgba(212,175,55,0.12)"):(o.classList.remove("is-selected"),o.style.borderColor="var(--color-border-subtle)",o.style.background="rgba(22,22,28,0.85)"));const f=i.spells.filter(r=>r.isCantrip&&r.checked).length,n=i.spells.filter(r=>!r.isCantrip&&r.checked).length,d=document.getElementById(`pc-wiz-sec-cantrips-${l}`);if(d){const r=f>i.maxCantrips;d.style.color=r?"#ffb74d":"#ba68c8",d.style.border=r?"1px solid #ffb74d":"",d.style.background=r?"rgba(255,183,77,0.15)":"",d.textContent=`Cantrips: ${f} / ${i.maxCantrips}${r?" (Over Limit)":""}`}const u=document.getElementById(`pc-wiz-sec-spells-${l}`);if(u){const r=n>i.maxSpells;u.style.color=r?"#ffb74d":"#4fc3f7",u.style.border=r?"1px solid #ffb74d":"",u.style.background=r?"rgba(255,183,77,0.15)":"",u.textContent=`Spells: ${n} / ${i.maxSpells}${r?" (Over Limit)":""}`}x()})}),p.querySelectorAll(".pc-wiz-bg-spell-chk").forEach(e=>{e.addEventListener("change",t=>{const l=parseInt(t.target.dataset.idx),s=b[l];s&&(s.checked=t.target.checked,s.name&&m.set(s.name.toLowerCase().trim(),e.checked));const i=t.target.closest(".pc-wiz-spell-card");i&&(t.target.checked?(i.classList.add("is-selected"),i.style.borderColor="var(--color-gold-base)",i.style.background="rgba(212,175,55,0.12)"):(i.classList.remove("is-selected"),i.style.borderColor="var(--color-border-subtle)",i.style.background="rgba(22,22,28,0.85)"));const a=document.getElementById("pc-wiz-bg-spells-pill");if(a){const o=b.filter(f=>f.checked).length;a.textContent=`Selected: ${o} / ${b.length}`}x()})})}export const renderStepSpells=renderStep6,renderStep7=renderStep6;
