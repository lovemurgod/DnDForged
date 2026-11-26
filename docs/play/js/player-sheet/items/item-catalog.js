import{getItemFullDescription as _,renderItemPreview as j}from"./item-description.js";import{runItemAutomationWizard as H}from"./item-wizard.js";import{escapeHtml as F}from"../../vtt-utils.js";export const RARITY_ORDER={none:0,mundane:0,"":0,common:1,uncommon:2,rare:3,"very rare":4,legendary:5,artifact:6,varies:7,"unknown (magic)":8,unknown:9};export function getNormalizedRarity(a){if(!a||!a.rarity)return"none";const c=String(a.rarity).trim().toLowerCase();return c==="none"||c==="mundane"?"none":c}export function getRarityBadgeHtml(a){const c=(a||"none").toLowerCase().trim(),f=c==="none"||c==="mundane"||!c?"Mundane":c.charAt(0).toUpperCase()+c.slice(1);return`<span class="rarity-badge ${c==="very rare"?"rarity-very-rare":c==="none"||c==="mundane"||!c?"rarity-none":`rarity-${c}`}">${f}</span>`}let I=null,h={query:"",mode:"all",type:"all",source:"all",rarity:"all",sortCol:"name",sortDir:"asc"},S=null,T=[],k=0;const P=50;export function getItemCache(){return I}export function invalidateItemCache(){I=null}export function setItemCache(a){I=a}export function updateSortHeaderIcons(){const a=document.getElementById("pc-sort-name"),c=document.getElementById("pc-sort-rarity"),f=document.getElementById("pc-sort-name-icon"),l=document.getElementById("pc-sort-rarity-icon");!a||!c||!f||!l||(h.sortCol==="name"?(a.classList.add("active-sort"),c.classList.remove("active-sort"),f.className=h.sortDir==="asc"?"fa-solid fa-arrow-down-a-z sort-icon":"fa-solid fa-arrow-up-z-a sort-icon",l.className="fa-solid fa-sort sort-icon"):(c.classList.add("active-sort"),a.classList.remove("active-sort"),l.className=h.sortDir==="asc"?"fa-solid fa-arrow-down-wide-short sort-icon":"fa-solid fa-arrow-up-short-wide sort-icon",f.className="fa-solid fa-sort sort-icon"))}export function populateItemFilterDropdowns(a){const c=document.getElementById("pc-item-filter-type"),f=document.getElementById("pc-item-filter-source");if(!c||!f||!a)return;const l=new Set,b=new Set;a.forEach(e=>{e.type?l.add(e.type):e.weaponCategory&&l.add(e.weaponCategory),e.source&&b.add(e.source)});const m=Array.from(l).sort((e,n)=>e.localeCompare(n)),w=Array.from(b).sort((e,n)=>e.localeCompare(n)),E=c.value,u=f.value;c.innerHTML='<option value="all">All Types</option>'+m.map(e=>`<option value="${e.replace(/"/g,"&quot;")}">${e}</option>`).join(""),f.innerHTML='<option value="all">All Sources</option>'+w.map(e=>`<option value="${e.replace(/"/g,"&quot;")}">${e}</option>`).join(""),m.includes(E)&&(c.value=E),w.includes(u)&&(f.value=u)}export function updateItemSelectedCount(){const a=window._vttSelectedItemMap?window._vttSelectedItemMap.size:document.querySelectorAll(".pc-item-select:checked").length,c=document.getElementById("pc-item-selected-count");c&&(c.textContent=`${a} item${a!==1?"s":""} selected`)}export function ensureItemModalsExist(a={}){if(document.getElementById("pc-item-modal"))return;const{getCurrentChar:c=()=>window.currentChar,saveAndEmit:f=e=>window.saveAndEmit?.(e),renderSheetData:l=e=>window.renderSheetData?.(e),getDisplaySourceBadge:b=e=>window.getDisplaySourceBadge?window.getDisplaySourceBadge(e):e}=a,m=document.createElement("div");m.innerHTML=`
        <div id="pc-item-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>

        <div id="pc-item-modal" class="vtt-sheet-submodal vtt-hidden pc-item-modal-dialog" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#18181b; border:1px solid var(--color-border-subtle); border-radius:10px; z-index:3010; box-shadow:0 8px 32px rgba(0,0,0,0.65);">
            <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-backpack text-gradient-gold" style="font-size:1.15rem;"></i>
                    <h3 style="margin:0; font-size:1.1rem; color:var(--color-gold-base); font-family:var(--font-heading);">Add Item</h3>
                </div>
                <button class="btn btn-icon" id="pc-item-modal-close" style="color:var(--color-text-muted);"><i class="fa-solid fa-times"></i></button>
            </div>

            <div class="pc-item-toolbar">
                <div class="pc-item-toolbar-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="pc-item-search" placeholder="Search by name, type, properties..." autocomplete="off">
                </div>
                <div class="pc-item-segmented" id="pc-item-mode-segmented">
                    <button type="button" class="pc-item-segmented-btn active" data-mode="all">All Items</button>
                    <button type="button" class="pc-item-segmented-btn" data-mode="magic">Magic Only</button>
                    <button type="button" class="pc-item-segmented-btn" data-mode="mundane">Mundane Only</button>
                </div>
                <select id="pc-item-filter-type" class="pc-item-filter-select">
                    <option value="all">All Types</option>
                </select>
                <select id="pc-item-filter-rarity" class="pc-item-filter-select">
                    <option value="all">All Rarities</option>
                    <option value="none">Mundane / None</option>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="very rare">Very Rare</option>
                    <option value="legendary">Legendary</option>
                    <option value="artifact">Artifact</option>
                </select>
                <select id="pc-item-filter-source" class="pc-item-filter-select">
                    <option value="all">All Sources</option>
                </select>
            </div>

            <div class="pc-item-split-body">
                <div class="pc-item-table-pane">
                    <div class="pc-item-table-scroll scroll-styled" id="pc-item-table-scroll">
                        <table class="pc-item-table">
                            <thead>
                                <tr>
                                    <th class="sortable active-sort" id="pc-sort-name" style="width:70%;">
                                        Name <i class="fa-solid fa-arrow-down-a-z sort-icon" id="pc-sort-name-icon"></i>
                                    </th>
                                    <th class="sortable" id="pc-sort-rarity" style="width:30%; text-align:center;">
                                        Rarity <i class="fa-solid fa-sort sort-icon" id="pc-sort-rarity-icon"></i>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="pc-item-tbody">
                                <tr><td colspan="2" style="text-align:center; padding:30px; color:var(--color-text-muted);">Loading items...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="pc-item-count-footer">
                        <span id="pc-item-count-indicator">Showing 0 of 0 items</span>
                        <span style="font-size:0.7rem; opacity:0.7;"><i class="fa-solid fa-angles-down"></i> Scroll for more</span>
                    </div>
                </div>

                <div class="pc-item-preview-pane scroll-styled" id="pc-item-preview-pane">
                    <div style="text-align:center; padding:40px 10px; color:var(--color-text-muted);">
                        <i class="fa-solid fa-hand-pointer" style="font-size:1.8rem; margin-bottom:12px; opacity:0.4;"></i>
                        <div>Select an item from the list to preview details</div>
                    </div>
                </div>
            </div>

            <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; background:rgba(0,0,0,0.3); align-items:center;">
                <span id="pc-item-selected-count" style="font-size:0.88rem; color:var(--color-text-muted); font-weight:500;">0 items selected</span>
                <div style="display:flex; gap:10px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="pc-item-modal-cancel">Cancel</button>
                    <button type="button" id="pc-item-modal-add" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Add Selected Items</button>
                </div>
            </div>
        </div>

        <!-- Custom Item Modal -->
        <div id="pc-custom-item-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3025; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 id="pc-custom-item-modal-title" style="margin:0; color:var(--color-gold-base);">Custom Item</h3>
                <button class="btn btn-icon" id="pc-custom-item-modal-close" style="color:var(--color-text-muted);"><i class="fa-solid fa-times"></i></button>
            </div>
            <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Item Name</label>
                    <input type="text" id="pc-custom-item-name" style="width:100%;" class="form-control" placeholder="e.g. Health Potion">
                </div>
                <div>
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Item Type</label>
                    <select id="pc-custom-item-type" style="width:100%;" class="form-control">
                        <option value="gear">Mundane Gear / Item</option>
                        <option value="weapon">Weapon</option>
                        <option value="armor">Armor / Shield</option>
                    </select>
                </div>
                <div id="pc-custom-item-weapon-fields" class="vtt-hidden" style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Damage Dice</label>
                            <input type="text" id="pc-custom-item-dmg" style="width:100%;" class="form-control" placeholder="e.g. 1d8">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Damage Type</label>
                            <input type="text" id="pc-custom-item-dmg-type" style="width:100%;" class="form-control" placeholder="e.g. Slashing">
                        </div>
                    </div>
                    <div style="display:flex; gap:16px; align-items:center; margin-top:2px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
                            <input type="checkbox" id="pc-custom-item-finesse"> Finesse
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
                            <input type="checkbox" id="pc-custom-item-ranged"> Ranged
                        </label>
                    </div>
                </div>
                <div id="pc-custom-item-armor-fields" class="vtt-hidden" style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Base AC / Shield Bonus</label>
                        <input type="number" id="pc-custom-item-ac" style="width:100%;" class="form-control" placeholder="e.g. 14 or 2" min="0">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Armor Category</label>
                        <select id="pc-custom-item-armor-cat" style="width:100%;" class="form-control">
                            <option value="light">Light Armor</option>
                            <option value="medium">Medium Armor</option>
                            <option value="heavy">Heavy Armor</option>
                            <option value="shield">Shield</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Weight (lb)</label>
                        <input type="number" id="pc-custom-item-weight" style="width:100%;" class="form-control" placeholder="0" min="0" step="any">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Quantity</label>
                        <input type="number" id="pc-custom-item-qty" style="width:100%;" class="form-control" value="1" min="1">
                    </div>
                </div>
                <div>
                    <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Description (Optional)</label>
                    <textarea id="pc-custom-item-desc" style="width:100%; height:80px; resize:vertical;" class="form-control" placeholder="Item description..."></textarea>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2);">
                <button id="pc-custom-item-modal-del" class="btn btn-danger btn-xs" style="display:none;"><i class="fa-solid fa-trash"></i> Delete Item</button>
                <button id="pc-custom-item-modal-add" class="btn btn-primary btn-xs">Save Item</button>
            </div>
        </div>

        <!-- Item Automation Wizard Modal -->
        <div id="pc-item-automation-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:transparent; backdrop-filter:none; z-index:3020;"></div>
        <div id="pc-item-automation-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#18181b; border:1.5px solid var(--color-gold-base); border-radius:10px; z-index:3025; width:480px; max-width:92vw; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px var(--color-gold-base); overflow:hidden; font-family:var(--font-primary, sans-serif);">
            <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.35); display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i id="pc-automation-icon" class="fa-solid fa-wand-magic-sparkles text-gradient-gold" style="font-size:1.15rem;"></i>
                    <h3 id="pc-automation-title" style="margin:0; font-size:1.05rem; color:var(--color-gold-base); font-family:var(--font-heading);">Item Automation</h3>
                </div>
                <span id="pc-automation-step-indicator" style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:10px;">Step 1 of 1</span>
            </div>
            <div id="pc-automation-body" style="padding:18px; font-size:0.875rem; line-height:1.5; color:var(--color-text-primary);">
                <!-- Injected step content -->
            </div>
            <div id="pc-automation-actions" style="padding:12px 18px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.25);">
                <!-- Injected step action buttons -->
            </div>
        </div>
    `,document.body.appendChild(m);const w=()=>{document.getElementById("pc-item-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden")};document.getElementById("pc-item-modal-close")?.addEventListener("click",w),document.getElementById("pc-item-modal-cancel")?.addEventListener("click",w),document.getElementById("pc-item-overlay")?.addEventListener("click",()=>{const e=document.getElementById("pc-custom-item-modal"),n=document.getElementById("pc-item-modal");e&&!e.classList.contains("vtt-hidden")?(e.classList.add("vtt-hidden"),n&&n.classList.contains("vtt-hidden")&&document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden")):n&&!n.classList.contains("vtt-hidden")&&(n.classList.add("vtt-hidden"),document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden"))}),document.getElementById("pc-item-automation-overlay")?.addEventListener("click",()=>{document.getElementById("pc-item-automation-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-item-automation-overlay")?.classList.add("vtt-hidden")}),document.getElementById("pc-custom-item-modal-close")?.addEventListener("click",()=>{document.getElementById("pc-custom-item-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-item-modal")?.classList.contains("vtt-hidden")&&document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden")}),document.getElementById("pc-custom-item-modal-del")?.addEventListener("click",()=>{const e=c();if(!e)return;const g=document.getElementById("pc-custom-item-modal-add")?.dataset.editIdx;g!=null&&g!==""&&confirm("Delete this item?")&&(e.equipment.splice(parseInt(g),1),f(e),l(e),document.getElementById("pc-custom-item-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-item-modal")?.classList.contains("vtt-hidden")&&document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden"))}),document.getElementById("pc-custom-item-type")?.addEventListener("change",e=>{const n=e.target.value;document.getElementById("pc-custom-item-weapon-fields")?.classList.toggle("vtt-hidden",n!=="weapon"),document.getElementById("pc-custom-item-armor-fields")?.classList.toggle("vtt-hidden",n!=="armor")}),document.getElementById("pc-custom-item-modal-add")?.addEventListener("click",e=>{const n=c();if(!n)return;const g=document.getElementById("pc-custom-item-name"),s=g.value.trim();if(!s){g.focus();return}const o=document.getElementById("pc-custom-item-weight").value||"0",r=document.getElementById("pc-custom-item-qty").value||"1",i=document.getElementById("pc-custom-item-desc").value||"",y=document.getElementById("pc-custom-item-type")?.value||"gear",p=e.currentTarget.dataset.editIdx,v=[];if(p!==void 0){const t=n.equipment[p];if(t){if(t.name=s,t.weight=o,t.qty=r,t.description=i,t.itemType=y,y==="weapon")t.isWeapon=!0,t.dmg1=document.getElementById("pc-custom-item-dmg")?.value||"1d8",t.dmgType=document.getElementById("pc-custom-item-dmg-type")?.value||"Slashing",t.isFinesse=!!document.getElementById("pc-custom-item-finesse")?.checked,t.isRanged=!!document.getElementById("pc-custom-item-ranged")?.checked;else if(y==="armor"){t.isArmor=!0;const d=document.getElementById("pc-custom-item-armor-cat")?.value||"medium";t.armorCategory=d,d==="shield"?(t.type="Shield",t.rawType="S",t.bonusAc=parseInt(document.getElementById("pc-custom-item-ac")?.value)||2):(t.type="Armor",t.rawType=d==="light"?"LA":d==="heavy"?"HA":"MA",t.ac=parseInt(document.getElementById("pc-custom-item-ac")?.value)||14)}}}else{n.equipment||(n.equipment=[]);const t={id:"eq_"+Date.now()+Math.random().toString(36).substr(2,5),name:s,qty:r,weight:o,description:i,itemType:y};if(y==="weapon")t.isWeapon=!0,t.type="Weapon",t.dmg1=document.getElementById("pc-custom-item-dmg")?.value||"1d8",t.dmgType=document.getElementById("pc-custom-item-dmg-type")?.value||"Slashing",t.isFinesse=!!document.getElementById("pc-custom-item-finesse")?.checked,t.isRanged=!!document.getElementById("pc-custom-item-ranged")?.checked,t.properties=[],t.isFinesse&&t.properties.push("finesse"),t.isRanged&&t.properties.push("ammunition","range"),t.macroTemplate={attackStat:"auto",isFinesse:t.isFinesse,isRanged:t.isRanged,damageRows:[{formula:t.dmg1,stat:"auto",type:t.dmgType,label:""}]},v.push({type:"weapon",item:t,name:t.name,desc:t.description});else if(y==="armor"){t.isArmor=!0;const d=document.getElementById("pc-custom-item-armor-cat")?.value||"medium";t.armorCategory=d,d==="shield"?(t.type="Shield",t.rawType="S",t.bonusAc=parseInt(document.getElementById("pc-custom-item-ac")?.value)||2):(t.type="Armor",t.rawType=d==="light"?"LA":d==="heavy"?"HA":"MA",t.ac=parseInt(document.getElementById("pc-custom-item-ac")?.value)||14),v.push({type:"ac",item:t,name:t.name,desc:t.description})}n.equipment.push(t)}f(n),l(n),document.getElementById("pc-custom-item-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-item-modal")?.classList.contains("vtt-hidden")&&document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden"),v.length>0&&H(v,{getCurrentChar:c,ensureItemModalsExist:()=>ensureItemModalsExist(a),saveAndEmit:f,renderSheetData:l})});let E=null;document.getElementById("pc-item-search")?.addEventListener("input",e=>{h.query=e.target.value,clearTimeout(E),E=setTimeout(()=>{renderItemSearchList(a)},120)}),document.querySelectorAll("#pc-item-mode-segmented .pc-item-segmented-btn").forEach(e=>{e.addEventListener("click",()=>{document.querySelectorAll("#pc-item-mode-segmented .pc-item-segmented-btn").forEach(n=>n.classList.remove("active")),e.classList.add("active"),h.mode=e.dataset.mode||"all",renderItemSearchList(a)})}),document.getElementById("pc-item-filter-type")?.addEventListener("change",e=>{h.type=e.target.value,renderItemSearchList(a)}),document.getElementById("pc-item-filter-rarity")?.addEventListener("change",e=>{h.rarity=e.target.value,renderItemSearchList(a)}),document.getElementById("pc-item-filter-source")?.addEventListener("change",e=>{h.source=e.target.value,renderItemSearchList(a)}),document.getElementById("pc-sort-name")?.addEventListener("click",()=>{h.sortCol==="name"?h.sortDir=h.sortDir==="asc"?"desc":"asc":(h.sortCol="name",h.sortDir="asc"),updateSortHeaderIcons(),renderItemSearchList(a)}),document.getElementById("pc-sort-rarity")?.addEventListener("click",()=>{h.sortCol==="rarity"?h.sortDir=h.sortDir==="asc"?"desc":"asc":(h.sortCol="rarity",h.sortDir="asc"),updateSortHeaderIcons(),renderItemSearchList(a)});const u=document.getElementById("pc-item-table-scroll");u&&u.addEventListener("scroll",()=>{u.scrollTop+u.clientHeight>=u.scrollHeight-80&&renderNextItemChunk(a)}),document.getElementById("pc-item-modal-add")?.addEventListener("click",async()=>{const e=c();if(!e)return;const n=window._vttSelectedItemMap?Array.from(window._vttSelectedItemMap.values()):[];if(!n.length)return;window._vttSelectedItemMap.clear(),updateItemSelectedCount(),document.getElementById("pc-item-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-item-overlay")?.classList.add("vtt-hidden"),e.equipment||(e.equipment=[]);const g=[];for(const s of n){const o=s.catItem;if(o&&Array.isArray(o.packContents)&&o.packContents.length>0){for(const r of o.packContents)if(typeof r=="string"){const[i,y]=r.split("|"),p=I?.items?.find(v=>v.name.toLowerCase()===i.toLowerCase());e.equipment.push({id:"eq_"+Date.now()+Math.random().toString(36).substr(2,5),name:p?p.name:i.charAt(0).toUpperCase()+i.slice(1),qty:1,weight:p&&p.weight||0,description:p&&(p.descriptionMarkdown||p.descriptionHtml)||"",source:p?.source||y||s.source})}else if(typeof r=="object"&&r!==null)if(r.item){const[i,y]=r.item.split("|"),p=I?.items?.find(v=>v.name.toLowerCase()===i.toLowerCase());e.equipment.push({id:"eq_"+Date.now()+Math.random().toString(36).substr(2,5),name:p?p.name:i.charAt(0).toUpperCase()+i.slice(1),qty:r.quantity||1,weight:p&&p.weight||0,description:p&&(p.descriptionMarkdown||p.descriptionHtml)||"",source:p?.source||y||s.source})}else r.special&&e.equipment.push({id:"eq_"+Date.now()+Math.random().toString(36).substr(2,5),name:r.special,qty:r.quantity||1,weight:0,description:"",source:s.source})}else{let r=o?.descriptionMarkdown||s.desc||o?.descriptionHtml||"";if(!r&&s.source&&s.itemId)try{const t=await fetch(`/api/item/${encodeURIComponent(s.source)}/${encodeURIComponent(s.itemId)}`);if(t.ok){const d=await t.json();r=d.descriptionMarkdown||d.descriptionHtml||(Array.isArray(d.entries)?d.entries.map(B=>typeof B=="string"?B:JSON.stringify(B)).join(`

`):"")}}catch{}e.equipment.push({id:"eq_"+Date.now()+Math.random().toString(36).substr(2,5),name:s.name,qty:1,weight:s.weight,description:r,source:s.source}),o&&(o.macroTemplate||o.isWeapon||o.dmg1||o.weaponCategory||o.rawType==="M"||o.rawType==="R"||o.type&&o.type.toLowerCase().includes("weapon"))&&g.push({type:"weapon",item:o,name:s.name,desc:r}),o&&(o.isArmor||o.ac!==null&&o.ac!==void 0||o.bonusAc||o.armor||o.rawType==="LA"||o.rawType==="MA"||o.rawType==="HA"||o.rawType==="S"||o.type&&(o.type.toLowerCase().includes("armor")||o.type==="Shield"))&&g.push({type:"ac",item:o,name:s.name,desc:r});let p=!1,v=[];if(o&&o.attachedSpells){if(Array.isArray(o.attachedSpells))v=o.attachedSpells;else if(typeof o.attachedSpells=="object"){let t=function(d){const B=[];for(const C in d)if(typeof d[C]=="string")B.push(d[C]);else if(Array.isArray(d[C]))for(const L of d[C])typeof L=="string"?B.push(L):typeof L=="object"&&B.push(...t(L));else typeof d[C]=="object"&&d[C]!==null&&B.push(...t(d[C]));return B};v=Array.from(new Set(t(o.attachedSpells)))}v.length>0&&(p=!0)}p&&g.push({type:"spells",item:o,name:s.name,desc:r,spells:v})}}f(e),l(e),g.length>0&&H(g,{getCurrentChar:c,ensureItemModalsExist:()=>ensureItemModalsExist(a),saveAndEmit:f,renderSheetData:l})})}export function openCustomItemModal(a=null,c={}){const{getCurrentChar:f=()=>window.currentChar}=c,l=f();if(!l)return;ensureItemModalsExist(c);const b=a!==null;let m="",w="",E="1",u="",e="gear",n="",g="",s=!1,o=!1,r="",i="medium";if(b&&l.equipment&&l.equipment[a]){const x=l.equipment[a];m=x.name||"",w=x.weight||"",E=x.qty||"1",u=x.description||"",e=x.itemType||(x.isWeapon?"weapon":x.isArmor?"armor":"gear"),n=x.dmg1||"",g=x.dmgType||"",s=!!x.isFinesse,o=!!x.isRanged,r=x.bonusAc!==void 0?x.bonusAc:x.ac!==void 0?x.ac:"",i=x.armorCategory||(x.type==="Shield"||x.rawType==="S"?"shield":"medium")}const y=document.getElementById("pc-custom-item-name"),p=document.getElementById("pc-custom-item-weight"),v=document.getElementById("pc-custom-item-qty"),t=document.getElementById("pc-custom-item-desc"),d=document.getElementById("pc-custom-item-type"),B=document.getElementById("pc-custom-item-dmg"),C=document.getElementById("pc-custom-item-dmg-type"),L=document.getElementById("pc-custom-item-finesse"),M=document.getElementById("pc-custom-item-ranged"),q=document.getElementById("pc-custom-item-ac"),D=document.getElementById("pc-custom-item-armor-cat");y&&(y.value=m),p&&(p.value=w),v&&(v.value=E),t&&(t.value=u),d&&(d.value=e),B&&(B.value=n),C&&(C.value=g),L&&(L.checked=s),M&&(M.checked=o),q&&(q.value=r),D&&(D.value=i),document.getElementById("pc-custom-item-weapon-fields")?.classList.toggle("vtt-hidden",e!=="weapon"),document.getElementById("pc-custom-item-armor-fields")?.classList.toggle("vtt-hidden",e!=="armor");const A=document.getElementById("pc-custom-item-modal-add");A&&(b?(A.dataset.editIdx=a,A.textContent="Save Changes"):(delete A.dataset.editIdx,A.textContent="Save Item"));const z=document.getElementById("pc-custom-item-modal-title");z&&(z.textContent=b?"Edit Item":"Custom Item");const $=document.getElementById("pc-custom-item-modal-del");$&&($.style.display=b?"inline-block":"none"),document.getElementById("pc-custom-item-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-item-overlay")?.classList.remove("vtt-hidden"),y?.focus()}export function renderItemSearchList(a={}){if(!I||!I.items)return;const c=document.getElementById("pc-item-tbody");if(!c)return;const{items:f}=I,l=(h.query||"").trim().toLowerCase(),b=h.mode||"all",m=h.type||"all",w=h.source||"all",E=h.rarity||"all",u=f.filter(s=>{if(s.type==="GV"||String(s.type).startsWith("GV|"))return!1;const o=getNormalizedRarity(s);if(b==="mundane"){if(o!=="none")return!1}else if(b==="magic"&&o==="none")return!1;if(E!=="all"&&o!==E.toLowerCase()||m!=="all"&&(s.type||s.weaponCategory||"")!==m||w!=="all"&&(s.source||"").toUpperCase()!==w.toUpperCase())return!1;if(l){const r=(s.name||"").toLowerCase(),i=(s.type||s.weaponCategory||"").toLowerCase(),y=(s.source||"").toLowerCase();if(!r.includes(l)&&!i.includes(l)&&!y.includes(l))return!1}return!0}),e=h.sortCol||"name",n=h.sortDir||"asc";u.sort((s,o)=>{if(e==="rarity"){const r=RARITY_ORDER[getNormalizedRarity(s)]??99,i=RARITY_ORDER[getNormalizedRarity(o)]??99;return r!==i?n==="asc"?r-i:i-r:(s.name||"").localeCompare(o.name||"")}else{const r=(s.name||"").localeCompare(o.name||"");return n==="asc"?r:-r}}),T=u,k=0,c.innerHTML="";const g=document.getElementById("pc-item-table-scroll");if(g&&(g.scrollTop=0),renderNextItemChunk(a),u.length>0){const s=S?u.find(o=>(o.id||o.name)===(S.id||S.name)):null;R(s||u[0],a)}else{const s=document.getElementById("pc-item-preview-pane");s&&(s.innerHTML=`
                <div style="text-align:center; padding:40px 10px; color:var(--color-text-muted);">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:1.8rem; margin-bottom:12px; opacity:0.4;"></i>
                    <div>No matching items found.</div>
                </div>
            `)}}function R(a,c={}){const{getDisplaySourceBadge:f=l=>window.getDisplaySourceBadge?window.getDisplaySourceBadge(l):l}=c;j(a,{itemCache:I,getNormalizedRarity,getRarityBadgeHtml,getDisplaySourceBadge:f,updateItemSelectedCount,setActivePreviewItem:l=>{S=l}})}export function renderNextItemChunk(a={}){const c=document.getElementById("pc-item-tbody"),f=document.getElementById("pc-item-count-indicator");if(!c)return;const{getDisplaySourceBadge:l=u=>window.getDisplaySourceBadge?window.getDisplaySourceBadge(u):u}=a;if(T.length===0){c.innerHTML='<tr><td colspan="2" style="text-align:center; padding:30px; color:var(--color-text-muted);">No items found matching your filters.</td></tr>',f&&(f.textContent="Showing 0 of 0 items");return}const b=T.slice(k,k+P);if(b.length===0)return;let m="";for(let u=0;u<b.length;u++){const e=b[u],n=e.source||"",s=(n||"").toUpperCase()==="XPHB"||(n||"").toUpperCase()==="XDMG"?"#059669":(n||"").toUpperCase()==="PHB"?"#2563eb":"#475569",o=l(n)||n,r=(e.id||e.name+"::"+n).toLowerCase(),i=window._vttSelectedItemMap?window._vttSelectedItemMap.has(r):!1,y=getNormalizedRarity(e),p=getRarityBadgeHtml(y),v=S&&(S.id||S.name)===(e.id||e.name);m+=`
            <tr class="pc-item-row ${v?"is-active":""}" data-key="${r}">
                <td style="width:70%;">
                    <div class="pc-item-name-cell">
                        <input type="checkbox" class="pc-item-cb" data-key="${r}" data-name="${e.name.replace(/"/g,"&quot;")}" data-weight="${e.weight||0}" data-source="${n}" data-id="${e.id||""}" ${i?"checked":""}>
                        <div class="pc-item-title-wrap">
                            <span class="pc-item-title" title="${e.name}">${e.name}</span>
                            ${n?`<span class="pc-item-source-badge" style="background:${s}; color:#fff;">${o}</span>`:""}
                        </div>
                    </div>
                </td>
                <td style="width:30%; text-align:center;">
                    ${p}
                </td>
            </tr>
        `}c.insertAdjacentHTML("beforeend",m);const w=k;k+=b.length,f&&(f.textContent=`Showing ${k} of ${T.length} items`),Array.from(c.querySelectorAll("tr.pc-item-row")).slice(w).forEach((u,e)=>{const n=b[e];if(!n)return;const g=u.dataset.key;u.addEventListener("click",o=>{o.target.classList.contains("pc-item-cb")||R(n,a)});const s=u.querySelector(".pc-item-cb");s&&s.addEventListener("change",()=>{if(window._vttSelectedItemMap||(window._vttSelectedItemMap=new Map),s.checked){const o=_(n,I);window._vttSelectedItemMap.set(g,{name:n.name,weight:n.weight||"0",desc:o,source:n.source||"",itemId:n.id||"",catItem:n})}else window._vttSelectedItemMap.delete(g);updateItemSelectedCount()})}),updateItemSelectedCount()}export function openItemModal(a={}){const{getCurrentChar:c=()=>window.currentChar}=a;if(!c())return;ensureItemModalsExist(a),window._vttSelectedItemMap=new Map,updateItemSelectedCount(),document.getElementById("pc-item-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-item-overlay")?.classList.remove("vtt-hidden");const l=document.getElementById("pc-item-search");l&&(l.value=h.query||"");const b=document.getElementById("pc-item-tbody");b&&(b.innerHTML='<tr><td colspan="2" style="text-align:center; padding:30px; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading items...</td></tr>'),I?(populateItemFilterDropdowns(I.items),renderItemSearchList(a)):typeof window<"u"&&Array.isArray(window.VTT?.sharedItemCatalog)&&window.VTT.sharedItemCatalog.length>0?(I={items:window.VTT.sharedItemCatalog,fluffDict:{},ruleDict:{property:{},mastery:{}},isCatalog:!0},populateItemFilterDropdowns(I.items),renderItemSearchList(a)):fetch("/data/items-catalog.json").then(m=>{if(!m.ok)throw new Error(`HTTP ${m.status}`);return m.json()}).then(m=>{typeof window<"u"&&(window.VTT=window.VTT||{},window.VTT.sharedItemCatalog=m),I={items:m,fluffDict:{},ruleDict:{property:{},mastery:{}},isCatalog:!0},populateItemFilterDropdowns(I.items),renderItemSearchList(a)}).catch(()=>{Promise.all([fetch("data/items.json").then(m=>m.json()).catch(()=>({})),fetch("data/items-base.json").then(m=>m.json()).catch(()=>({})),fetch("data/magicvariants.json").then(m=>m.json()).catch(()=>({})),fetch("data/fluff-items.json").then(m=>m.json()).catch(()=>({}))]).then(([m,w,E,u])=>{let e=[];E.magicvariant&&w.baseitem&&E.magicvariant.forEach(i=>{const y=i.requires||[];if(y.length===0)return;w.baseitem.filter(v=>y.some(t=>{for(let d in t)if(d==="type"&&typeof t[d]=="string"){const B=t[d].split("|")[0];if(v.type!==B)return!1}else if(t[d]!==v[d])return!1;return!0})).forEach(v=>{const t=i.inherits&&i.inherits.namePrefix?i.inherits.namePrefix:"",d=i.inherits&&i.inherits.nameSuffix?i.inherits.nameSuffix:"";if(!t&&!d)return;const B=t+v.name+d;e.push({...v,...i.inherits||{},name:B,_isVariant:!0,weight:v.weight||(i.inherits?i.inherits.weight:0),value:i.inherits&&i.inherits.value?i.inherits.value:v.value})})});let n=[...m.item||[],...m.itemGroup||[],...w.baseitem||[],...E.magicvariant||[],...e];const g=new Map;n.forEach(i=>{const y=`${i.name}|${i.source||"unknown"}`;g.has(y)||g.set(y,i)});let s=Array.from(g.values());const o={};u.itemFluff&&u.itemFluff.forEach(i=>{const y=(i.name+(i.source||"")).toLowerCase();if(o[y]=i.entries||[],i._copy&&i._copy.name){const p=(i._copy.name+(i._copy.source||i.source||"")).toLowerCase();!o[y]&&o[p]&&(o[y]=o[p])}});const r={property:{},mastery:{}};w.itemProperty&&w.itemProperty.forEach(i=>{i.entries&&i.abbreviation&&(r.property[i.abbreviation.toLowerCase()]=i.entries)}),w.itemMastery&&w.itemMastery.forEach(i=>{i.entries&&(r.mastery[i.name.toLowerCase()]=i.entries)}),I={items:s,fluffDict:o,ruleDict:r},populateItemFilterDropdowns(I.items),renderItemSearchList(a)}).catch(m=>{const w=document.getElementById("pc-item-tbody");w&&(w.innerHTML=`<tr><td colspan="2" style="color:var(--color-danger); text-align:center; padding:20px;">Error loading items: ${F(m.message)}</td></tr>`)})})}
