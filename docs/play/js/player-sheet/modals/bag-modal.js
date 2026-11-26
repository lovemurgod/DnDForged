export function ensureBagModalExists(e={}){if(document.getElementById("pc-bag-modal"))return;const{getCurrentChar:m=()=>window.currentChar,saveAndEmit:u=t=>window.saveAndEmit?.(t),renderSheetData:r=t=>window.renderSheetData?.(t)}=e,i=`
        <div id="pc-bag-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
        <div id="pc-bag-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3010; width:420px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                <h3 style="margin:0; color:var(--color-gold-base); font-size:1.1rem;" id="modal-bag-title"><i class="fa-solid fa-sack-xmark"></i> Create Bag / Pouch</h3>
                <button id="modal-bag-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <input type="hidden" id="modal-bag-id" value="">
            <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Container Name</label>
                <input type="text" id="modal-bag-name" placeholder="e.g. Bag of Holding, Belt Pouch, Backpack" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Icon</label>
                    <select id="modal-bag-icon" style="width:100%; padding:6px; font-size:0.85rem; background:#222; border:1px solid var(--color-border-subtle); color:#fff; border-radius:4px;">
                        <option value="fa-sack-xmark">\u{1F392} Sack (X)</option>
                        <option value="fa-sack-dollar">\u{1F4B0} Sack ($)</option>
                        <option value="fa-backpack">\u{1F392} Backpack</option>
                        <option value="fa-box-archive">\u{1F4E6} Box / Chest</option>
                        <option value="fa-gem">\u{1F45B} Pouch / Purse</option>
                        <option value="fa-briefcase">\u{1F4BC} Satchel / Case</option>
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Weight Rule</label>
                    <select id="modal-bag-rule" style="width:100%; padding:6px; font-size:0.85rem; background:#222; border:1px solid var(--color-border-subtle); color:#fff; border-radius:4px;">
                        <option value="standard">Standard (Sums contents)</option>
                        <option value="fixed">Fixed Container Weight</option>
                        <option value="weightless">Weightless Contents (0 lb)</option>
                    </select>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Base Tare Weight (lbs)</label>
                    <input type="number" step="0.1" id="modal-bag-base-weight" value="0" placeholder="e.g. 5 for backpack" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group" style="flex:1;">
                    <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Capacity Limit (lbs)</label>
                    <input type="number" step="0.1" id="modal-bag-capacity" value="" placeholder="e.g. 30 (blank = unlimited)" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div class="form-group" id="modal-bag-custom-weight-group" style="margin-bottom:16px; display:none;">
                <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Fixed Container Weight (lbs)</label>
                <input type="number" step="0.1" id="modal-bag-custom-weight" value="15" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                <button id="modal-bag-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                <button id="modal-bag-save" class="btn btn-primary btn-xs">Save Bag</button>
            </div>
        </div>
    `,l=document.createElement("div");l.innerHTML=i,document.body.appendChild(l);const o=document.getElementById("modal-bag-rule"),a=document.getElementById("modal-bag-custom-weight-group");o?.addEventListener("change",()=>{a&&(a.style.display=o.value==="fixed"?"block":"none")});const d=()=>{document.getElementById("pc-bag-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-bag-overlay")?.classList.add("vtt-hidden")};document.getElementById("modal-bag-close")?.addEventListener("click",d),document.getElementById("modal-bag-cancel")?.addEventListener("click",d),document.getElementById("pc-bag-overlay")?.addEventListener("click",d),document.getElementById("modal-bag-save")?.addEventListener("click",()=>{const t=m();if(!t)return;const c=document.getElementById("modal-bag-id").value,g=document.getElementById("modal-bag-name").value.trim()||"New Bag",p=document.getElementById("modal-bag-icon").value,b=document.getElementById("modal-bag-rule").value,f=parseFloat(document.getElementById("modal-bag-custom-weight").value)||0,n=parseFloat(document.getElementById("modal-bag-base-weight").value)||0,v=document.getElementById("modal-bag-capacity").value.trim(),y=v!==""&&!isNaN(parseFloat(v))?parseFloat(v):null;if(t.containers=t.containers||[],c){const s=t.containers.find(x=>x.id===c);s&&(s.name=g,s.icon=p,s.weightRule=b,s.customWeight=f,s.baseWeight=n,s.capacity=y)}else{const s={id:"bag_"+Date.now()+Math.random().toString(36).substr(2,5),name:g,icon:p,weightRule:b,customWeight:f,baseWeight:n,capacity:y,collapsed:!1};t.containers.push(s)}d(),u(t),r(t)})}export function openBagModal(e=null,m={}){ensureBagModalExists(m);const{getCurrentChar:u=()=>window.currentChar}=m,r=u();if(!r)return;const i=document.getElementById("pc-bag-modal"),l=document.getElementById("pc-bag-overlay"),o=document.getElementById("modal-bag-title"),a=document.getElementById("modal-bag-id"),d=document.getElementById("modal-bag-name"),t=document.getElementById("modal-bag-icon"),c=document.getElementById("modal-bag-rule"),g=document.getElementById("modal-bag-custom-weight"),p=document.getElementById("modal-bag-base-weight"),b=document.getElementById("modal-bag-capacity"),f=document.getElementById("modal-bag-custom-weight-group");if(r.containers=r.containers||[],e){const n=r.containers.find(v=>v.id===e);n&&(o&&(o.innerHTML='<i class="fa-solid fa-pen"></i> Edit Container'),a&&(a.value=n.id),d&&(d.value=n.name||""),t&&(t.value=n.icon||"fa-sack-xmark"),c&&(c.value=n.weightRule||"standard"),g&&(g.value=n.customWeight!==void 0?n.customWeight:15),p&&(p.value=n.baseWeight!==void 0?n.baseWeight:0),b&&(b.value=n.capacity!==void 0&&n.capacity!==null?n.capacity:""),f&&(f.style.display=n.weightRule==="fixed"?"block":"none"))}else o&&(o.innerHTML='<i class="fa-solid fa-sack-xmark"></i> Create Bag / Pouch'),a&&(a.value=""),d&&(d.value=""),t&&(t.value="fa-sack-xmark"),c&&(c.value="standard"),g&&(g.value=15),p&&(p.value=0),b&&(b.value=""),f&&(f.style.display="none");i?.classList.remove("vtt-hidden"),l?.classList.remove("vtt-hidden")}export function bindBagContainerEvents(e,m={}){if(!e)return;const{saveAndEmit:u=i=>window.saveAndEmit?.(i),renderSheetData:r=i=>window.renderSheetData?.(i)}=m;document.getElementById("btn-create-bag")?.addEventListener("click",()=>openBagModal(null,m)),document.querySelectorAll(".pc-bag-edit").forEach(i=>i.addEventListener("click",l=>{l.stopPropagation(),openBagModal(l.currentTarget.dataset.containerId,m)})),document.querySelectorAll(".pc-bag-del").forEach(i=>i.addEventListener("click",l=>{l.stopPropagation();const o=l.currentTarget.dataset.containerId,a=(e.containers||[]).find(t=>t.id===o);if(!a)return;e.equipment=Array.isArray(e.equipment)?e.equipment:[];const d=e.equipment.filter(t=>t.containerId===o);if(d.length>0){if(!confirm(`Delete container "${a.name}"?

Click OK to unpack items into Main Inventory.
Click Cancel to abort deletion.`))return;d.forEach(c=>{c.containerId=null})}e.containers=e.containers.filter(t=>t.id!==o),u(e),r(e)})),document.querySelectorAll(".pc-bag-header").forEach(i=>i.addEventListener("click",l=>{const o=l.currentTarget.dataset.containerId;if(!o)return;const a=(e.containers||[]).find(d=>d.id===o);a&&(a.collapsed=!a.collapsed,u(e),r(e))})),document.querySelectorAll(".pc-equip-container-select").forEach(i=>i.addEventListener("change",l=>{const o=parseInt(l.currentTarget.dataset.idx),a=l.currentTarget.value||null;e.equipment&&e.equipment[o]&&(e.equipment[o].containerId=a,u(e),r(e))}))}
