import{SKILL_NAMES_MASTER as P}from"./vtt-sheet-modals.js?v=mwzii5ci";import{parseEquipmentTextToData as O}from"./builder/builder-state.js?v=mwzii5ci";export function normalizeSkill(t){return t?P.find(r=>r.toLowerCase()===t.trim().toLowerCase())||t.trim():""}export function normalizeTool(t){if(!t)return"";const e=t.trim();return/vehicles?\s*\(\s*water\s*\)/i.test(e)?"Water Vehicles":/vehicles?\s*\(\s*land\s*\)/i.test(e)?"Land Vehicles":/thieves'?\s*tools?/i.test(e)?"Thieves' Tools":/navigator'?s?\s*tools?/i.test(e)?"Navigator's Tools":/cartographer'?s?\s*tools?/i.test(e)?"Cartographer's Tools":/cook'?s?\s*utensils?/i.test(e)?"Cook's Utensils":/alchemist'?s?\s*supplies?/i.test(e)?"Alchemist's Supplies":/brewer'?s?\s*supplies?/i.test(e)?"Brewer's Supplies":/calligrapher'?s?\s*supplies?/i.test(e)?"Calligrapher's Supplies":/carpenter'?s?\s*tools?/i.test(e)?"Carpenter's Tools":/cobbler'?s?\s*tools?/i.test(e)?"Cobbler's Tools":/glassblower'?s?\s*tools?/i.test(e)?"Glassblower's Tools":/herbalism\s*kit/i.test(e)?"Herbalism Kit":/jeweler'?s?\s*tools?/i.test(e)?"Jeweler's Tools":/leatherworker'?s?\s*tools?/i.test(e)?"Leatherworker's Tools":/mason'?s?\s*tools?/i.test(e)?"Mason's Tools":/painter'?s?\s*supplies?/i.test(e)?"Painter's Supplies":/poisoner'?s?\s*kit/i.test(e)?"Poisoner's Kit":/potter'?s?\s*tools?/i.test(e)?"Potter's Tools":/smith'?s?\s*tools?/i.test(e)?"Smith's Tools":/tinker'?s?\s*tools?/i.test(e)?"Tinker's Tools":/weaver'?s?\s*tools?/i.test(e)?"Weaver's Tools":/woodcarver'?s?\s*tools?/i.test(e)?"Woodcarver's Tools":/disguise\s*kit/i.test(e)?"Disguise Kit":/forgery\s*kit/i.test(e)?"Forgery Kit":e}export function expandToolOptions(t){const e=["Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies","Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils","Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools","Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools","Weaver's Tools","Woodcarver's Tools"],r=["Dice Set","Dragonchess Set","Playing Card Set","Three-Dragon Ante Set"],i=["Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan Flute","Shawm","Viol"],l=[];return(t||[]).forEach(s=>{/AnyArtisansTools?|Artisan's Tools/i.test(s)?l.push(...e):/AnyGamingSet|Gaming Set/i.test(s)?l.push(...r):/Musical Instrument/i.test(s)?l.push(...i):l.push(normalizeTool(s))}),Array.from(new Set(l))}export function ensureBackgroundImportModalExists(){if(document.getElementById("pc-bg-import-modal"))return;const t=document.createElement("div");t.innerHTML=`
        <div id="pc-bg-import-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-bg-import-modal" class="vtt-sheet-submodal vtt-hidden" style="width:580px;">
            <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-scroll text-gradient-gold" style="font-size:1.3rem;"></i>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="bg-import-modal-title">
                            Import Background
                        </h3>
                        <span id="bg-import-modal-source" class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-light); font-size:0.7rem; border:1px solid rgba(212,175,55,0.3); padding:1px 6px; border-radius:4px;">PHB</span>
                    </div>
                </div>
                <button id="bg-import-modal-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div style="padding:16px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; flex:1;" class="scroll-styled" id="bg-import-modal-body">
            </div>

            <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35);">
                <button id="bg-import-modal-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                <button id="bg-import-modal-apply" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-check"></i> Apply to Character</button>
            </div>
        </div>
    `,document.body.appendChild(t)}export function promptBackgroundImportModal(t,e,r,i){if(!t||!e)return;ensureBackgroundImportModalExists();const l=document.getElementById("pc-bg-import-modal"),s=document.getElementById("pc-bg-import-overlay"),f=document.getElementById("bg-import-modal-title"),T=document.getElementById("bg-import-modal-source"),g=document.getElementById("bg-import-modal-body");if(!l||!s||!g)return;f.innerText=t.name||"Background",T&&(T.innerText=t.source||"PHB");const b=t.skillsData||{fixed:[],choose:null},x=t.toolsData||{fixed:[],choose:null};let c=t.equipmentData;!(c&&(Array.isArray(c.fixedItems)&&c.fixedItems.length>0||c.fixedGold||Array.isArray(c.choiceSets)&&c.choiceSets.length>0))&&(t.equipment||t.startingEquipment)&&(c=O(t.equipment||t.startingEquipment)),c||(c={fixedItems:[],fixedGold:0,choiceSets:[]});const E=t.features||[];let $="";if(t.description){const a=t.description.replace(/^#+\s+/gm,"").trim().split(`

`)[0]||"";a&&($=`<div style="font-size:0.8rem; color:var(--color-text-secondary); line-height:1.4; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:8px 12px; border-radius:6px;">${a.slice(0,300)}${a.length>300?"...":""}</div>`)}const w=(b.fixed||[]).map(normalizeSkill),C=w.map(o=>`
        <span style="background:rgba(46,204,113,0.15); border:1px solid rgba(46,204,113,0.4); color:#2ecc71; padding:3px 8px; border-radius:4px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-check"></i> ${o}
        </span>
    `).join("");let I="";if(b.choose&&Array.isArray(b.choose.from)){const o=b.choose.count||1,a=b.choose.from.map(normalizeSkill);I=`
            <div style="margin-top:6px;">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px;">
                    Choose <strong style="color:var(--color-gold-base);">${o}</strong> skill${o>1?"s":""}:
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;" class="bg-skill-choice-group" data-count="${o}">
                    ${a.map((n,m)=>`
                        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:4px 8px; border-radius:4px; margin:0;">
                            <input type="checkbox" class="bg-skill-choice-chk" value="${n}" ${m<o?"checked":""} style="cursor:pointer; accent-color:var(--color-gold-base);">
                            <span>${n}</span>
                        </label>
                    `).join("")}
                </div>
            </div>
        `}const L=`
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-graduation-cap"></i> Skill Proficiencies
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${C||(b.choose?"":'<span style="font-size:0.8rem; color:var(--color-text-muted);">None</span>')}
            </div>
            ${I}
        </div>
    `,A=(x.fixed||[]).map(normalizeTool),N=A.map(o=>`
        <span style="background:rgba(52,152,219,0.15); border:1px solid rgba(52,152,219,0.4); color:#3498db; padding:3px 8px; border-radius:4px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-wrench"></i> ${o}
        </span>
    `).join("");let B="";if(x.choose&&Array.isArray(x.choose.from)){const o=x.choose.count||1,a=expandToolOptions(x.choose.from);B=`
            <div style="margin-top:6px;">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px;">
                    Choose <strong style="color:var(--color-gold-base);">${o}</strong> tool${o>1?"s":""}:
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${Array.from({length:o}).map((n,m)=>`
                        <select class="bg-tool-choice-sel" style="width:100%; padding:5px 8px; font-size:0.8rem; background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                            ${a.map(p=>`<option value="${p}">${p}</option>`).join("")}
                        </select>
                    `).join("")}
                </div>
            </div>
        `}const H=`
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-toolbox"></i> Tool Proficiencies
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${N||(x.choose?"":'<span style="font-size:0.8rem; color:var(--color-text-muted);">None</span>')}
            </div>
            ${B}
        </div>
    `,q=c.fixedItems||[],k=c.fixedGold||0,S=c.choiceSets||[];let v=[];q.forEach(o=>{v.push((o.quantity>1?`${o.quantity}x `:"")+(o.name||"item"))}),k>0&&v.push(`${k} gp`);let z="";S.length>0&&(z=S.map((o,a)=>`
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:0.75rem; color:var(--color-text-muted);">Equipment Package:</div>
                ${o.options.map((n,m)=>{const p=n.label||n.items.map(d=>(d.quantity>1?`${d.quantity}x `:"")+d.name).join(", ")+(n.gold?` + ${n.gold} gp`:"");return`
                        <label style="display:flex; align-items:flex-start; gap:8px; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:6px 10px; border-radius:4px; margin:0;">
                            <input type="radio" name="bg-equip-set-${a}" value="${m}" ${m===0?"checked":""} style="cursor:pointer; accent-color:var(--color-gold-base); margin-top:2px;">
                            <div style="flex:1;">
                                <strong style="color:var(--color-gold-light);">Option ${n.key||String.fromCharCode(65+m)}:</strong>
                                <span style="color:var(--color-text-primary); margin-left:4px;">${p}</span>
                            </div>
                        </label>
                    `}).join("")}
            </div>
        `).join(""));const M=`
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-sack-dollar"></i> Starting Equipment & Gold
            </div>
            ${v.length>0?`
                <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:6px;">
                    <strong>Standard Gear:</strong> ${v.join(", ")}
                </div>
            `:""}
            ${z}

            <div style="margin-top:10px; padding:8px 10px; background:rgba(0,0,0,0.35); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px; font-weight:600;">Inventory Handling:</div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                        <input type="radio" name="bg-inv-handling" value="append" checked style="cursor:pointer; accent-color:var(--color-gold-base);">
                        <span><strong>Append to Inventory</strong> (Keep existing items & add background equipment)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                        <input type="radio" name="bg-inv-handling" value="replace" style="cursor:pointer; accent-color:var(--color-gold-base);">
                        <span><strong>Replace Inventory</strong> (Clear current items & replace with background equipment)</span>
                    </label>
                </div>
            </div>
        </div>
    `,j=`
        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
            <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-address-card"></i> Ability Cards
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                <input type="checkbox" id="bg-import-create-cards" checked style="cursor:pointer; accent-color:var(--color-gold-base);">
                <span>Create Ability Cards in <strong>"Background Features"</strong> category</span>
            </label>
            <div style="font-size:0.72rem; color:var(--color-text-muted); margin-left:20px; margin-top:3px; line-height:1.3;">
                Creates rules card for <em>${E.map(o=>o.name).join(", ")||"Background Feature"}</em> plus a complete Background Summary card.
            </div>
        </div>
    `;g.innerHTML=$+L+H+M+j,g.querySelectorAll(".bg-skill-choice-group").forEach(o=>{const a=parseInt(o.dataset.count)||1,n=o.querySelectorAll(".bg-skill-choice-chk"),m=()=>{const p=Array.from(n).filter(d=>d.checked).length;n.forEach(d=>{d.checked?(d.disabled=!1,d.parentElement.style.opacity="1"):(d.disabled=p>=a,d.parentElement.style.opacity=p>=a?"0.5":"1")})};n.forEach(p=>p.addEventListener("change",m)),m()});const h=()=>{l.classList.add("vtt-hidden"),s.classList.add("vtt-hidden")};document.getElementById("bg-import-modal-close").onclick=()=>{h(),r&&r()},document.getElementById("bg-import-modal-cancel").onclick=()=>{h(),r&&r()},s.onclick=()=>{h(),r&&r()},document.getElementById("bg-import-modal-apply").onclick=()=>{const o=[...w];g.querySelectorAll(".bg-skill-choice-chk:checked").forEach(u=>{o.includes(u.value)||o.push(u.value)});const a=[...A];g.querySelectorAll(".bg-tool-choice-sel").forEach(u=>{u.value&&!a.includes(u.value)&&a.push(u.value)});const n=g.querySelector('input[name="bg-inv-handling"]:checked')?.value||"append",m=!!document.getElementById("bg-import-create-cards")?.checked,p=[...q];let d=k;S.forEach((u,F)=>{const G=parseInt(g.querySelector(`input[name="bg-equip-set-${F}"]:checked`)?.value)||0,y=u.options[G];y&&(y.items&&p.push(...y.items),y.gold&&(d+=y.gold))}),h(),typeof i=="function"&&i({skills:o,tools:a,items:p,gold:d,invHandling:n,createCards:m,features:E})},l.classList.remove("vtt-hidden"),s.classList.remove("vtt-hidden")}export function switchModalTab(t){document.querySelectorAll("#tab-btn-manual, #tab-btn-import").forEach(e=>e.classList.remove("active")),document.getElementById("modal-tab-manual")?.classList.add("vtt-hidden"),document.getElementById("modal-tab-import")?.classList.add("vtt-hidden"),document.getElementById(`tab-btn-${t}`)?.classList.add("active"),document.getElementById(`modal-tab-${t}`)?.classList.remove("vtt-hidden")}export function getSuggestedCategoryName(t,e){if(t==="class"){const r=document.getElementById("import-class-sel"),i=r?r.value:"",l=document.getElementById("import-subclass-sel"),s=l&&l.value&&l.value!=="__base__"?l.options[l.selectedIndex]?.text.split("[")[0].trim():"";return e&&e.length===1&&e[0].subclassShortName?`Subclass - ${s||e[0].subclassShortName}`:s?`Subclass - ${s}`:i?`Class - ${i}`:"Class Features"}if(t==="feat")return"Feats";if(t==="race")return e&&e.length===1?`Species - ${e[0].name}`:"Species Traits";if(t==="background")return e&&e.length===1?`Background - ${e[0].name}`:"Background Features";if(t==="charoption")return"Character Options";if(t==="optionalfeature"){if(e&&e.length>0){const r=e[0],i=r.featureCategory||r.featureTypeName;if(i&&i!=="Optional Feature")return i.endsWith("y")?i.slice(0,-1)+"ies":i.endsWith("s")?i:i+"s"}return"Optional Features"}return"Special Features"}export function populateOptFeatureTypeDropdown(t){const e=document.getElementById("import-optfeat-type-sel");if(!e)return;const r=new Map;(t||[]).forEach(s=>{const f=s.featureCategory||s.featureTypeName||"Other";r.set(f,(r.get(f)||0)+1)});let i='<option value="">-- All Feature Types --</option>';Array.from(r.keys()).sort((s,f)=>s.localeCompare(f)).forEach(s=>{i+=`<option value="${s}">${s} (${r.get(s)})</option>`}),e.innerHTML=i,e.value=""}
