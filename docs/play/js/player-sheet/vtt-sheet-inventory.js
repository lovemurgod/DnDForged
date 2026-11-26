import{getTotalStat as k}from"./calc/stats.js";import{getContainerContentsWeight as $,getContainerCapacityStatus as E,calculateCharacterTotalWeight as I,calculateEncumbrance as q}from"./calc/containers.js";import{bindBagContainerEvents as C}from"./modals/index.js";import{escapeHtml as v}from"../vtt-utils.js";export function renderEquipRowHtml(e,d,c){const p=c?.containers||[],y=e.linkedTable?typeof e.linkedTable=="string"?e.linkedTable:e.linkedTable.name||e.linkedTable.id:e.name,r=(typeof window<"u"&&window.VTT?.rollTablesEngine?.findTableByItemNameSync?window.VTT.rollTablesEngine.findTableByItemNameSync(y):null)||(e.linkedTable?{id:typeof e.linkedTable=="string"?e.linkedTable:e.linkedTable.id||e.linkedTable.name,name:typeof e.linkedTable=="string"?e.linkedTable:e.linkedTable.name||e.linkedTable.id,dice:typeof e.linkedTable=="object"&&e.linkedTable.dice?e.linkedTable.dice:"1d20"}:null);return`
        <div class="equip-row glass-flat" data-idx="${d}" data-container-id="${e.containerId||""}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="pc-equip-drag-handle" data-idx="${d}" title="Click and drag to move/reorder item" style="cursor:grab; padding:2px 8px 2px 2px; opacity:0.6; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                    <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                </div>
                <div class="pc-equip-toggle" data-idx="${d}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); flex:1; min-width:0; display:flex; align-items:center; gap:6px; padding-right:8px;" title="Click to expand/collapse description">
                    <i class="fa-solid fa-chevron-right text-gradient-gold" style="font-size:0.8rem; flex-shrink:0; transition:transform 0.2s;" id="pc-equip-chevron-${d}"></i>
                    <span style="word-break:break-word; overflow-wrap:anywhere;">${e.name}</span>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                    <span style="font-size:0.8rem; color:var(--color-text-muted);">Wt: ${e.weight||0} lb</span>
                    <div style="display:flex; align-items:center; gap:4px; margin: 0 2px;">
                        <button class="btn btn-xxs btn-secondary pc-equip-qty-minus" data-idx="${d}">-</button>
                        <span style="font-size:0.8rem; width:16px; text-align:center;">${e.qty}</span>
                        <button class="btn btn-xxs btn-secondary pc-equip-qty-plus" data-idx="${d}">+</button>
                    </div>
                    <button class="btn btn-xxs btn-secondary pc-equip-ping" data-idx="${d}" title="Ping Item to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                </div>
            </div>
            <div class="pc-equip-desc vtt-hidden" id="pc-equip-desc-${d}" style="padding: 8px 4px 0 16px; font-size: 0.85rem; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-subtle); margin-top: 4px; line-height: 1.4;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted);"><i class="fa-solid fa-box-archive" style="color:var(--color-gold-base);"></i> Move to:</span>
                        <select class="pc-equip-container-select" data-idx="${d}" title="Move to Bag" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.75rem; border-radius:4px; padding:2px 6px; max-width:140px;">
                            <option value="" ${e.containerId?"":"selected"}>Main Inventory</option>
                            ${p.map(o=>`
                                <option value="${o.id}" ${e.containerId===o.id?"selected":""}>\u{1F4E6} ${o.name}</option>
                            `).join("")}
                        </select>
                    </div>
                    <button class="btn btn-xxs btn-secondary pc-equip-edit" data-idx="${d}" title="Edit Item"><i class="fa-solid fa-pen"></i> Edit Item</button>
                </div>
                <div style="white-space: pre-wrap;">
                    ${(function(){if(!e.description)return'<i style="opacity:0.5;">No description available.</i>';let o=e.description.replace(/</g,"&lt;").replace(/>/g,"&gt;");return o=o.replace(/\*\*(.*?)\*\*(.*?)\*\*/g,"<b>$1</b>"),o=o.replace(/\*(.*?)\*/g,"<i>$1</i>"),o=o.replace(/---/g,'<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;">'),o})()}
                </div>
                ${r?`
                    <div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end;">
                        <button type="button" class="btn btn-xs btn-primary pc-item-table-roll-btn" data-table-id="${v(r.id)}" data-table-name="${v(r.name)}" data-item-name="${v(e.name)}" style="display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-dice-d20"></i> Roll Table (${v(r.dice||"d100")})
                        </button>
                    </div>
                `:""}
            </div>
        </div>
    `}export function renderEquipmentHtml(e,d){e.currency=e.currency||{cp:0,sp:0,ep:0,gp:0,pp:0},e.containers=e.containers||[],e.equipment=e.equipment||[],e.equipment.forEach(t=>{t.containerId===void 0&&(t.containerId=null)});const c=I(e),p=c.totalWeight,y=c.coinWeight,h=k(e,"str")||10,r=typeof document<"u"&&document.getElementById("config-encumbrance-rule")?.value||"standard",o=e.settings?.carryWeightMultiplier||e.carryWeightMultiplier||1,f=q(h,p,r,o),u=`<span style="color:${f.statusColor}; ${f.statusKey==="over"?"font-weight:bold;":""}">${f.statusText}</span>`;return`
        <div style="display:flex; justify-content:center; gap:16px; margin-bottom:16px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid var(--color-border-subtle);">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#b87333; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> CP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="cp" value="${e.currency.cp||0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#c0c0c0; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> SP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="sp" value="${e.currency.sp||0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#50c878; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> EP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="ep" value="${e.currency.ep||0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:var(--color-gold-base); font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> GP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="gp" value="${e.currency.gp||0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <label style="font-size:0.8rem; color:#e5e4e2; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> PP</label>
                <input type="number" class="form-control pc-currency-input" data-coin="pp" value="${e.currency.pp||0}" min="0" style="width:60px; text-align:center; padding:4px;">
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-backpack"></i> Inventory</h4>
            <div style="display:flex; gap:8px;">
                <button id="btn-create-bag" class="btn btn-secondary btn-xs"><i class="fa-solid fa-sack-xmark"></i> Create Bag</button>
                <button id="btn-add-equip-db" class="btn btn-secondary btn-xs"><i class="fa-solid fa-book-open"></i> Add Items</button>
                <button id="btn-add-equip-custom" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Custom Item</button>
            </div>
        </div>
        <div id="pc-equip-list" style="display:flex; flex-direction:column; gap:8px;">
            ${(function(){let t="";(e.containers||[]).forEach((i,a)=>{const l=e.equipment.map((x,w)=>({eq:x,i:w})).filter(({eq:x})=>x.containerId===i.id),b=$(i,e.equipment),g=E(i,e.equipment);let s=g.capacity!==null?`${b.toFixed(1)} / ${g.capacity.toFixed(1)} lb`:`${b.toFixed(1)} lb`;i.weightRule==="fixed"?s=`${(parseFloat(i.customWeight)||0).toFixed(1)} lb (Fixed)`:i.weightRule==="weightless"?s="0.0 lb (Weightless)":parseFloat(i.baseWeight)>0&&(s+=` \u2022 Base: ${parseFloat(i.baseWeight).toFixed(1)} lb`);const T=g.isOverCapacity?'<span class="badge" style="background:#ef5350; color:#fff; font-size:0.65rem; padding:1px 6px; margin-left:4px; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> OVER CAPACITY</span>':"";t+=`
                        <div class="pc-bag-card glass-flat" data-container-id="${i.id}" data-container-idx="${a}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                            <div class="pc-bag-header" data-container-id="${i.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                    <div class="pc-bag-drag-handle" data-container-idx="${a}" title="Click and drag to reorder bag" style="cursor:grab; opacity:0.5; padding-right:4px;" data-stop-propagation="true">
                                        <i class="fa-solid fa-grip-vertical"></i>
                                    </div>
                                    <i class="fa-solid ${i.icon||"fa-sack-xmark"} text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                    <i class="fa-solid fa-chevron-right text-gradient-gold pc-bag-chevron" data-container-id="${i.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${i.collapsed?"rotate(0deg)":"rotate(90deg)"};"></i>
                                    <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${v(i.name)}</span>
                                    <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${l.length} item${l.length!==1?"s":""} \u2022 ${s}${T}</span>
                                </div>
                                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" data-stop-propagation="true">
                                    <button class="btn btn-xxs btn-secondary pc-bag-edit" data-container-id="${i.id}" title="Edit Bag"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-xxs btn-danger pc-bag-del" data-container-id="${i.id}" title="Delete Bag"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <div class="pc-bag-contents ${i.collapsed?"vtt-hidden":""}" data-container-id="${i.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                ${l.map(({eq:x,i:w})=>renderEquipRowHtml(x,w,e)).join("")}
                                ${l.length===0?'<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this bag.</div>':""}
                            </div>
                        </div>
                    `});const n=e.equipment.map((i,a)=>({eq:i,i:a})).filter(({eq:i})=>!i.containerId);return t+=`
                    <div class="pc-bag-card glass-flat" data-container-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                        <div class="pc-bag-header pc-main-inv-header" data-container-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                <i class="fa-solid fa-backpack text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Main Inventory (Carried)</span>
                                <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${n.length} item${n.length!==1?"s":""}</span>
                            </div>
                        </div>
                        <div class="pc-bag-contents" data-container-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                            ${n.map(({eq:i,i:a})=>renderEquipRowHtml(i,a,e)).join("")}
                            ${n.length===0&&(e.containers||[]).length>0?'<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All items are packed into bags.</div>':""}
                            ${e.equipment.length===0?'<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No items added yet.</div>':""}
                        </div>
                    </div>
                `,t})()}
        </div>
        <div style="margin-top:16px; padding:8px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-size:0.9rem; font-family:var(--font-heading); color:var(--color-gold-light);">Total Wt:</span>
                <span style="font-weight:bold; font-size:1.1rem; margin-left:4px;" title="Includes ${y.toFixed(2)} lb from coins">${p.toFixed(1)} / ${f.maxThreshold} lb</span>
                ${o!==1?`<span class="badge" style="background:var(--color-primary, #6366f1); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px;" title="Carry Weight Multiplier">${o}x</span>`:""}
            </div>
            <div style="font-size:0.8rem;">
                Status: ${u}
            </div>
        </div>
    `}export function wireInventoryEvents(e,d){const{saveAndEmit:c,renderSheetData:p,vtt:y}=d;document.querySelectorAll(".pc-currency-input").forEach(t=>t.addEventListener("change",n=>{const i=n.currentTarget.dataset.coin;e.currency=e.currency||{},e.currency[i]=parseInt(n.currentTarget.value)||0,c(e),p(e)}));const h=d.getModalOptions?d.getModalOptions():d;C(e,h),document.getElementById("btn-add-equip-db")?.addEventListener("click",()=>{d.openItemModal?d.openItemModal():window.openItemModal&&window.openItemModal()}),document.getElementById("btn-add-equip-custom")?.addEventListener("click",()=>{d.openCustomItemModal?d.openCustomItemModal():window.openCustomItemModal&&window.openCustomItemModal()}),document.querySelectorAll(".pc-equip-qty-minus").forEach(t=>t.addEventListener("click",n=>{const i=e.equipment[n.currentTarget.dataset.idx];i&&i.qty>1&&(i.qty=parseInt(i.qty)-1,c(e),p(e))})),document.querySelectorAll(".pc-equip-qty-plus").forEach(t=>t.addEventListener("click",n=>{const i=e.equipment[n.currentTarget.dataset.idx];i&&(i.qty=parseInt(i.qty||1)+1,c(e),p(e))})),document.querySelectorAll(".pc-equip-edit").forEach(t=>t.addEventListener("click",n=>{const i=n.currentTarget.dataset.idx;d.openCustomItemModal?d.openCustomItemModal(i):window.openCustomItemModal&&window.openCustomItemModal(i)})),document.querySelectorAll(".pc-equip-del").forEach(t=>t.addEventListener("click",n=>{confirm("Delete this item?")&&(e.equipment.splice(n.currentTarget.dataset.idx,1),c(e),p(e))})),document.querySelectorAll(".pc-equip-ping").forEach(t=>t.addEventListener("click",n=>{const i=n.currentTarget.dataset.idx,a=e.equipment[i];if(!a)return;const l=!!(e?.whisperToGM||typeof window<"u"&&window.vttPlayerSheetAPI?.isWhisperToGM?.()),b=a.linkedTable?typeof a.linkedTable=="string"?a.linkedTable:a.linkedTable.name||a.linkedTable.id:a.name,s=(window.VTT?.rollTablesEngine?.findTableByItemNameSync?window.VTT.rollTablesEngine.findTableByItemNameSync(b):null)||(a.linkedTable?{id:typeof a.linkedTable=="string"?a.linkedTable:a.linkedTable.id||a.linkedTable.name,name:typeof a.linkedTable=="string"?a.linkedTable:a.linkedTable.name||a.linkedTable.id,dice:typeof a.linkedTable=="object"&&a.linkedTable.dice?a.linkedTable.dice:"1d20"}:null);y.socket.emit("chat:msg",{whisperToGM:l,itemCard:{charName:e.name,itemName:a.name,weight:a.weight||0,qty:a.qty||1,description:a.description||"",linkedTable:s?{id:s.id,name:s.name,dice:s.dice}:null}})})),document.querySelectorAll(".pc-item-table-roll-btn").forEach(t=>t.addEventListener("click",n=>{n.stopPropagation();const i=t.dataset.tableId,a=t.dataset.itemName,l=!!(e?.whisperToGM||typeof window<"u"&&window.vttPlayerSheetAPI?.isWhisperToGM?.());window.VTT?.rollTablesEngine?.rollLinkedTable&&window.VTT.rollTablesEngine.rollLinkedTable(i,{charName:e.name,abilityName:a,isWhisper:l})})),document.querySelectorAll(".pc-equip-toggle").forEach(t=>t.addEventListener("click",n=>{const i=n.currentTarget.dataset.idx,a=document.getElementById(`pc-equip-desc-${i}`),l=document.getElementById(`pc-equip-chevron-${i}`);a&&(a.classList.contains("vtt-hidden")?(a.classList.remove("vtt-hidden"),l&&(l.style.transform="rotate(90deg)")):(a.classList.add("vtt-hidden"),l&&(l.style.transform="rotate(0deg)")))}));let r=!1,o=null,f=!1,u=null;const m=()=>{document.querySelectorAll("#pc-equip-list .equip-row").forEach(t=>{t.style.borderTop="",t.style.borderBottom="",t.style.boxShadow="",t.style.opacity=""}),document.querySelectorAll("#pc-equip-list .pc-bag-header").forEach(t=>{t.style.outline="",t.style.background=""}),document.querySelectorAll("#pc-equip-list .pc-bag-card").forEach(t=>{t.style.borderTop="",t.style.borderBottom="",t.style.opacity=""})};document.querySelectorAll(".pc-equip-drag-handle").forEach(t=>{t.addEventListener("mousedown",()=>{r=!0})}),document.querySelectorAll(".pc-bag-drag-handle").forEach(t=>{t.addEventListener("mousedown",()=>{f=!0})}),window.addEventListener("mouseup",()=>{r=!1,f=!1}),document.querySelectorAll("#pc-equip-list .equip-row").forEach(t=>{t.addEventListener("dragstart",n=>{if(!r){n.preventDefault();return}o=parseInt(t.dataset.idx),n.dataTransfer.setData("text/plain",o.toString()),n.dataTransfer.effectAllowed="move",setTimeout(()=>{t.style.opacity="0.4"},0)}),t.addEventListener("dragover",n=>{if(o==null)return;n.preventDefault(),n.stopPropagation(),n.dataTransfer.dropEffect="move";const i=t.getBoundingClientRect(),a=i.top+i.height/2;m();const l=document.querySelector(`#pc-equip-list .equip-row[data-idx="${o}"]`);l&&(l.style.opacity="0.4"),n.clientY<a?(t.style.borderTop="2px solid var(--color-gold-base)",t.style.boxShadow="0 -4px 8px -2px rgba(212, 175, 55, 0.6)"):(t.style.borderBottom="2px solid var(--color-gold-base)",t.style.boxShadow="0 4px 8px -2px rgba(212, 175, 55, 0.6)")}),t.addEventListener("drop",n=>{n.preventDefault(),n.stopPropagation(),m();const i=o,a=parseInt(t.dataset.idx),l=t.dataset.containerId||null;if(o=null,r=!1,isNaN(i)||isNaN(a)||i===a)return;const b=t.getBoundingClientRect(),g=b.top+b.height/2;let s=a;n.clientY>=g&&(s=a+1),i<s&&s--;const[T]=e.equipment.splice(i,1);T.containerId=l,e.equipment.splice(s,0,T),c(e),p(e)}),t.addEventListener("dragend",()=>{o=null,r=!1,m()})}),document.querySelectorAll("#pc-equip-list .pc-bag-header").forEach(t=>{t.addEventListener("dragover",n=>{if(o==null)return;n.preventDefault(),n.stopPropagation(),n.dataTransfer.dropEffect="move",m();const i=document.querySelector(`#pc-equip-list .equip-row[data-idx="${o}"]`);i&&(i.style.opacity="0.4"),t.style.outline="2px dashed var(--color-gold-base)",t.style.background="rgba(212, 175, 55, 0.15)"}),t.addEventListener("drop",n=>{if(o==null)return;n.preventDefault(),n.stopPropagation(),m();const i=o,a=t.dataset.containerId||null;o=null,r=!1,!isNaN(i)&&e.equipment[i]&&(e.equipment[i].containerId=a,c(e),p(e))})}),document.querySelectorAll("#pc-equip-list .pc-bag-card[data-container-idx]").forEach(t=>{t.addEventListener("dragstart",n=>{f&&(u=parseInt(t.dataset.containerIdx),n.dataTransfer.setData("text/plain","bag_"+u),n.dataTransfer.effectAllowed="move",setTimeout(()=>{t.style.opacity="0.4"},0))}),t.addEventListener("dragover",n=>{if(u==null)return;n.preventDefault(),n.stopPropagation(),n.dataTransfer.dropEffect="move";const i=t.getBoundingClientRect(),a=i.top+i.height/2;m();const l=document.querySelector(`#pc-equip-list .pc-bag-card[data-container-idx="${u}"]`);l&&(l.style.opacity="0.4"),n.clientY<a?t.style.borderTop="2px solid var(--color-gold-base)":t.style.borderBottom="2px solid var(--color-gold-base)"}),t.addEventListener("drop",n=>{if(u==null)return;n.preventDefault(),n.stopPropagation(),m();const i=u,a=parseInt(t.dataset.containerIdx);if(u=null,f=!1,isNaN(i)||isNaN(a)||i===a)return;const l=t.getBoundingClientRect(),b=l.top+l.height/2;let g=a;n.clientY>=b&&(g=a+1),i<g&&g--;const[s]=e.containers.splice(i,1);e.containers.splice(g,0,s),c(e),p(e)}),t.addEventListener("dragend",()=>{u=null,f=!1,m()})})}
