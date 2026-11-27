import{ALL_SKILLS as f,STANDARD_TOOLS as S}from"../vtt-sheet-modals.js?v=mwzii5ci";import{calculateEffectiveHp as h,calculateEffectiveAc as E,resolveCharacterSheetSettings as T}from"../calc/stats.js?v=mwzii5ci";import{escapeHtml as b}from"../../vtt-utils.js?v=mwzii5ci";export function renderSaveTogglesList(t,s={}){const d=document.getElementById("modal-save-toggles-list");if(!d||!t||!t.saveToggles)return;let r="";t.saveToggles.forEach((a,e)=>{r+=`
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="save-toggle-enable-cb" data-idx="${e}" ${a.enabled?"checked":""}>
                    <span style="font-weight:bold; font-size:0.85rem;">${b(a.name)}</span>
                    <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${b((a.target||"ALL").toUpperCase())}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${b(a.formula)}</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary save-toggle-edit-btn" data-idx="${e}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary save-toggle-del-btn" data-idx="${e}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `}),d.innerHTML=r,d.querySelectorAll(".save-toggle-enable-cb").forEach(a=>a.addEventListener("change",e=>{const l=e.currentTarget.dataset.idx;t.saveToggles[l].enabled=e.currentTarget.checked})),d.querySelectorAll(".save-toggle-edit-btn").forEach(a=>a.addEventListener("click",e=>{const l=e.currentTarget.dataset.idx,o=t.saveToggles[l],n=document.getElementById("modal-save-toggle-idx"),i=document.getElementById("modal-save-toggle-name"),c=document.getElementById("modal-save-toggle-formula"),m=document.getElementById("modal-save-toggle-target");n&&(n.value=l),i&&(i.value=o.name),c&&(c.value=o.formula),m&&(m.value=o.target),document.getElementById("modal-save-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-save-toggle")?.classList.add("vtt-hidden")})),d.querySelectorAll(".save-toggle-del-btn").forEach(a=>a.addEventListener("click",e=>{if(confirm("Delete this toggle?")){const l=e.currentTarget.dataset.idx;t.saveToggles.splice(l,1),renderSaveTogglesList(t,s)}}))}export function setupSaveSettingsListeners(t={}){const{getCurrentChar:s=()=>window.currentChar,saveAndEmit:d=e=>window.saveAndEmit?.(e),renderSheetData:r=e=>window.renderSheetData?.(e)}=t,a=()=>{document.getElementById("pc-save-settings-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-save-settings-overlay")?.classList.add("vtt-hidden")};document.getElementById("modal-save-settings-close")?.addEventListener("click",a),document.getElementById("pc-save-settings-overlay")?.addEventListener("click",a),document.getElementById("btn-add-save-toggle")?.addEventListener("click",()=>{const e=document.getElementById("modal-save-toggle-idx"),l=document.getElementById("modal-save-toggle-name"),o=document.getElementById("modal-save-toggle-formula"),n=document.getElementById("modal-save-toggle-target");e&&(e.value="-1"),l&&(l.value=""),o&&(o.value=""),n&&(n.value="all"),document.getElementById("modal-save-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-save-toggle")?.classList.add("vtt-hidden")}),document.getElementById("modal-save-toggle-cancel")?.addEventListener("click",()=>{document.getElementById("modal-save-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-save-toggle")?.classList.remove("vtt-hidden")}),document.getElementById("modal-save-toggle-save")?.addEventListener("click",()=>{const e=s();if(!e)return;e.saveToggles||(e.saveToggles=[]);const l=parseInt(document.getElementById("modal-save-toggle-idx")?.value||"-1"),o=document.getElementById("modal-save-toggle-name")?.value.trim(),n=document.getElementById("modal-save-toggle-formula")?.value.trim(),i=document.getElementById("modal-save-toggle-target")?.value||"all";if(!o||!n)return alert("Name and Formula are required.");const c={id:"stgl_"+Date.now(),name:o,formula:n,target:i,enabled:!0};l>=0?e.saveToggles[l]=c:e.saveToggles.push(c),document.getElementById("modal-save-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-save-toggle")?.classList.remove("vtt-hidden"),renderSaveTogglesList(e,t)}),document.getElementById("modal-save-settings-save")?.addEventListener("click",()=>{const e=s();e&&(e.globalSaveMod=parseInt(document.getElementById("modal-save-global-mod")?.value)||0,e.saves=e.saves||{},e.saveMods=e.saveMods||{},e.stats=e.stats||{},e.statMods=e.statMods||{},["str","dex","con","int","wis","cha"].forEach(l=>{const o=document.getElementById(`modal-save-prof-${l}`),n=document.getElementById(`modal-save-mod-${l}`);o&&(e.saves[l]=o.checked),n&&(e.saveMods[l]=parseInt(n.value)||0);const i=document.getElementById(`modal-stat-base-${l}`),c=document.getElementById(`modal-stat-mod-${l}`);i&&(e.stats[l]=parseInt(i.value)||10),c&&(e.statMods[l]=parseInt(c.value)||0)}),d(e),r(e),a())})}export function ensureSaveSettingsModalExists(t={}){if(document.getElementById("pc-save-settings-modal"))return;const s=document.createElement("div");s.innerHTML=`
        <div id="pc-save-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-save-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:500px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Stat & Save Settings</h3>
                <button id="modal-save-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label>Global Save Modifier</label>
                    <input type="number" id="modal-save-global-mod" value="0" style="width:100%;">
                </div>
                
                <div>
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Ability Scores & Temp Mods</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                        ${["str","dex","con","int","wis","cha"].map(d=>`
                            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                <div style="font-weight:600; font-size:0.85rem;">${d.toUpperCase()}</div>
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <input type="text" inputmode="numeric" id="modal-stat-base-${d}" value="10" style="width:48px; padding:2px; box-sizing:border-box; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" title="Base Stat">
                                    <span style="color:var(--color-text-muted); font-size:0.8rem;">+</span>
                                    <input type="text" inputmode="numeric" id="modal-stat-mod-${d}" value="0" style="width:48px; padding:2px; box-sizing:border-box; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" title="Temp Mod">
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Ability Save Proficiencies & Mods</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        ${["str","dex","con","int","wis","cha"].map(d=>`
                            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <input type="checkbox" id="modal-save-prof-${d}" style="cursor:pointer;">
                                    <label style="margin:0; font-weight:600; font-size:0.85rem;" for="modal-save-prof-${d}">${d.toUpperCase()} Save</label>
                                </div>
                                <input type="number" id="modal-save-mod-${d}" value="0" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                            </div>
                        `).join("")}
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">Save Toggles</h4>
                        <button id="btn-add-save-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-save-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-save-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-save-toggle-name" placeholder="Name (e.g. Bless)" style="flex:2;">
                            <input type="text" id="modal-save-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1;">
                            <select id="modal-save-toggle-target" style="flex:1;">
                                <option value="all">All Saves</option>
                                <option value="str">STR Save</option>
                                <option value="dex">DEX Save</option>
                                <option value="con">CON Save</option>
                                <option value="int">INT Save</option>
                                <option value="wis">WIS Save</option>
                                <option value="cha">CHA Save</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-save-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-save-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-save-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Save Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-save-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `,document.body.appendChild(s),setupSaveSettingsListeners(t)}export function openSaveSettingsModal(t,s={}){if(ensureSaveSettingsModalExists(s),!t)return;const d=document.getElementById("modal-save-global-mod");d&&(d.value=t.globalSaveMod||0),["str","dex","con","int","wis","cha"].forEach(r=>{const a=document.getElementById(`modal-save-prof-${r}`),e=document.getElementById(`modal-save-mod-${r}`);a&&(a.checked=!!(t.saves&&t.saves[r])),e&&(e.value=t.saveMods&&t.saveMods[r]||0);const l=document.getElementById(`modal-stat-base-${r}`),o=document.getElementById(`modal-stat-mod-${r}`);l&&(l.value=t.stats&&t.stats[r]||10),o&&(o.value=t.statMods&&t.statMods[r]||0)}),renderSaveTogglesList(t,s),document.getElementById("pc-save-settings-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-save-settings-overlay")?.classList.remove("vtt-hidden")}export function renderSkillTogglesList(t,s={}){const d=document.getElementById("modal-skill-toggles-list");if(!d||!t||!t.skillToggles)return;let r="";t.skillToggles.forEach((a,e)=>{r+=`
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="skill-toggle-enable-cb" data-idx="${e}" ${a.enabled?"checked":""}>
                    <span style="font-weight:bold; font-size:0.85rem;">${b(a.name)}</span>
                    <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${b((a.target||"ALL").toUpperCase())}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${b(a.formula)}</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary skill-toggle-edit-btn" data-idx="${e}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary skill-toggle-del-btn" data-idx="${e}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `}),d.innerHTML=r,d.querySelectorAll(".skill-toggle-enable-cb").forEach(a=>a.addEventListener("change",e=>{const l=e.currentTarget.dataset.idx;t.skillToggles[l].enabled=e.currentTarget.checked})),d.querySelectorAll(".skill-toggle-edit-btn").forEach(a=>a.addEventListener("click",e=>{const l=e.currentTarget.dataset.idx,o=t.skillToggles[l],n=document.getElementById("modal-skill-toggle-idx"),i=document.getElementById("modal-skill-toggle-name"),c=document.getElementById("modal-skill-toggle-formula"),m=document.getElementById("modal-skill-toggle-target");n&&(n.value=l),i&&(i.value=o.name),c&&(c.value=o.formula),m&&(m.value=o.target),document.getElementById("modal-skill-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-skill-toggle")?.classList.add("vtt-hidden")})),d.querySelectorAll(".skill-toggle-del-btn").forEach(a=>a.addEventListener("click",e=>{if(confirm("Delete this toggle?")){const l=e.currentTarget.dataset.idx;t.skillToggles.splice(l,1),renderSkillTogglesList(t,s)}}))}export function setupSkillSettingsListeners(t={}){const{getCurrentChar:s=()=>window.currentChar,saveAndEmit:d=e=>window.saveAndEmit?.(e),renderSheetData:r=e=>window.renderSheetData?.(e)}=t,a=()=>{document.getElementById("pc-skill-settings-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-skill-settings-overlay")?.classList.add("vtt-hidden")};document.getElementById("modal-skill-settings-close")?.addEventListener("click",a),document.getElementById("pc-skill-settings-overlay")?.addEventListener("click",a),document.getElementById("btn-add-skill-toggle")?.addEventListener("click",()=>{const e=document.getElementById("modal-skill-toggle-idx"),l=document.getElementById("modal-skill-toggle-name"),o=document.getElementById("modal-skill-toggle-formula"),n=document.getElementById("modal-skill-toggle-target");e&&(e.value="-1"),l&&(l.value=""),o&&(o.value=""),n&&(n.value="all"),document.getElementById("modal-skill-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-skill-toggle")?.classList.add("vtt-hidden")}),document.getElementById("modal-skill-toggle-cancel")?.addEventListener("click",()=>{document.getElementById("modal-skill-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-skill-toggle")?.classList.remove("vtt-hidden")}),document.getElementById("modal-skill-toggle-save")?.addEventListener("click",()=>{const e=s();if(!e)return;e.skillToggles||(e.skillToggles=[]);const l=parseInt(document.getElementById("modal-skill-toggle-idx")?.value||"-1"),o=document.getElementById("modal-skill-toggle-name")?.value.trim(),n=document.getElementById("modal-skill-toggle-formula")?.value.trim(),i=document.getElementById("modal-skill-toggle-target")?.value||"all";if(!o||!n)return alert("Name and Formula are required.");const c={id:"sktgl_"+Date.now(),name:o,formula:n,target:i,enabled:!0};l>=0?e.skillToggles[l]=c:e.skillToggles.push(c),document.getElementById("modal-skill-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-skill-toggle")?.classList.remove("vtt-hidden"),renderSkillTogglesList(e,t)}),document.getElementById("modal-skill-settings-save")?.addEventListener("click",()=>{const e=s();e&&(e.globalAbilityMod=document.getElementById("modal-skill-global-mod")?.value.trim()||"0",e.skills=e.skills||{},e.expertise=e.expertise||{},e.skillMods=e.skillMods||{},e.passiveSkillMods=e.passiveSkillMods||{},f.forEach(l=>{const o=l.name,n=o.replace(/ /g,"_"),i=document.getElementById(`modal-skill-prof-${n}`),c=document.getElementById(`modal-skill-exp-${n}`),m=document.getElementById(`modal-skill-mod-${n}`),v=document.getElementById(`modal-skill-passive-${n}`);i&&(e.skills[o]=i.checked),c&&(e.expertise[o]=c.checked),m&&(e.skillMods[o]=m.value.trim()||"0"),v&&(e.passiveSkillMods[o]=v.value.trim()||"0")}),d(e),r(e),a())})}export function ensureSkillSettingsModalExists(t={}){if(document.getElementById("pc-skill-settings-modal"))return;const s=document.createElement("div");s.innerHTML=`
        <div id="pc-skill-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-skill-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:640px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Skill Settings & Toggles</h3>
                <button id="modal-skill-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label>Global Ability Modifier (e.g. +1d4)</label>
                    <input type="text" id="modal-skill-global-mod" placeholder="0" style="width:100%;">
                </div>
                
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">Skill Proficiencies & Modifiers</h4>
                        <div style="font-size:0.72rem; color:var(--color-text-muted); display:flex; gap:16px;">
                            <span><strong>Mod:</strong> Active Roll</span>
                            <span><strong style="color:var(--color-gold-light);">Pass:</strong> Passive Score</span>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        ${f.map(d=>{const r=d.name.replace(/ /g,"_");return`
                                <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.25); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle); gap:6px;">
                                    <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0; overflow:hidden;">
                                        <input type="checkbox" id="modal-skill-prof-${r}" title="Proficient" style="cursor:pointer; accent-color:var(--color-gold-base);">
                                        <input type="checkbox" id="modal-skill-exp-${r}" title="Expertise" style="cursor:pointer; accent-color:var(--color-gold-light); border-radius:50%;">
                                        <label style="margin:0; font-weight:600; font-size:0.8rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" for="modal-skill-prof-${r}">${d.name}</label>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:4px;">
                                        <input type="text" id="modal-skill-mod-${r}" value="0" style="width:36px; text-align:center; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:3px; color:var(--color-text-primary);" placeholder="Mod" title="Active Roll Modifier">
                                        <input type="text" id="modal-skill-passive-${r}" value="0" style="width:36px; text-align:center; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:3px; color:var(--color-gold-light);" placeholder="Pass" title="Passive Score Modifier (e.g. +5 Observant)">
                                    </div>
                                </div>
                            `}).join("")}
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">Skill Toggles</h4>
                        <button id="btn-add-skill-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-skill-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-skill-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-skill-toggle-name" placeholder="Name (e.g. Guidance)" style="flex:2;">
                            <input type="text" id="modal-skill-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1;">
                        </div>
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <select id="modal-skill-toggle-target" style="flex:1; width:100%; background-color:#222222; color:#fff; border:1px solid var(--color-border-subtle); padding:4px; border-radius:4px;">
                                <option value="all">All Skills</option>
                                <option value="initiative">Initiative</option>
                                <option value="passive_perception">Passive Perception</option>
                                <option value="passive_investigation">Passive Investigation</option>
                                <option value="passive_insight">Passive Insight</option>
                                <option value="passive_all">All Passive Scores</option>
                                ${f.map(d=>`<option value="${d.name}">${d.name}</option>`).join("")}
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-skill-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-skill-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-skill-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Skill Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-skill-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `,document.body.appendChild(s),setupSkillSettingsListeners(t)}export function openSkillSettingsModal(t,s={}){if(ensureSkillSettingsModalExists(s),!t)return;const d=document.getElementById("modal-skill-global-mod");d&&(d.value=t.globalAbilityMod||"0"),f.forEach(r=>{const a=r.name,e=a.replace(/ /g,"_"),l=document.getElementById(`modal-skill-prof-${e}`),o=document.getElementById(`modal-skill-exp-${e}`),n=document.getElementById(`modal-skill-mod-${e}`),i=document.getElementById(`modal-skill-passive-${e}`);l&&(l.checked=!!(t.skills&&t.skills[a])),o&&(o.checked=!!(t.expertise&&t.expertise[a])),n&&(n.value=t.skillMods&&t.skillMods[a]||"0"),i&&(i.value=t.passiveSkillMods&&t.passiveSkillMods[a]||"0")}),renderSkillTogglesList(t,s),document.getElementById("pc-skill-settings-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-skill-settings-overlay")?.classList.remove("vtt-hidden")}export function ensureToolSettingsModalExists(t={}){if(document.getElementById("pc-tool-settings-modal"))return;const{getCurrentChar:s=()=>window.currentChar,saveAndEmit:d=l=>window.saveAndEmit?.(l),renderSheetData:r=l=>window.renderSheetData?.(l)}=t,a=document.createElement("div");a.innerHTML=`
        <div id="pc-tool-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-tool-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:650px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Tool Settings</h3>
                <button id="modal-tool-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div>
                    <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Configured Tools</h4>
                    <div id="modal-tool-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- Tool inputs injected here -->
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <button id="btn-add-custom-tool" class="btn btn-sm btn-secondary"><i class="fa-solid fa-plus"></i> Add Custom Tool</button>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-tool-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `,document.body.appendChild(a);const e=()=>{document.getElementById("pc-tool-settings-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-tool-settings-overlay")?.classList.add("vtt-hidden")};document.getElementById("modal-tool-settings-close")?.addEventListener("click",e),document.getElementById("pc-tool-settings-overlay")?.addEventListener("click",e),document.getElementById("btn-add-custom-tool")?.addEventListener("click",()=>{const l=document.getElementById("modal-tool-toggles-list");if(!l)return;const o="custom_tool_"+Date.now(),n=document.createElement("div");n.className="tool-settings-row",n.dataset.key=o,n.dataset.custom="true",n.style.display="flex",n.style.alignItems="center",n.style.justifyContent="space-between",n.style.background="rgba(0,0,0,0.2)",n.style.padding="6px",n.style.borderRadius="4px",n.style.border="1px solid var(--color-border-subtle)",n.innerHTML=`
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="checkbox" class="tool-show" title="Show on Sheet" checked style="cursor:pointer; accent-color: var(--color-gold-base);">
                <input type="checkbox" class="tool-prof" title="Proficient" style="cursor:pointer;">
                <input type="checkbox" class="tool-exp" title="Expertise" style="cursor:pointer; border-radius:50%;">
                <input type="text" class="tool-name" value="New Tool" style="width:140px; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Tool Name">
                <select class="tool-ability" style="background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px; padding:2px;">
                    <option value="str">STR</option>
                    <option value="dex">DEX</option>
                    <option value="con">CON</option>
                    <option value="int">INT</option>
                    <option value="wis">WIS</option>
                    <option value="cha">CHA</option>
                </select>
            </div>
            <div style="display:flex; gap:6px;">
                <input type="text" class="tool-mod" value="0" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                <button class="btn btn-danger btn-xxs tool-delete" style="padding:2px 6px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `,l.appendChild(n),n.querySelector(".tool-delete")?.addEventListener("click",()=>{n.remove()})}),document.getElementById("modal-tool-settings-save")?.addEventListener("click",()=>{const l=s();if(!l)return;const o={};document.querySelectorAll(".tool-settings-row").forEach(i=>{let c="";i.dataset.custom==="true"?c=i.querySelector(".tool-name")?.value.trim():c=i.dataset.key,c&&(o[c]={ability:i.querySelector(".tool-ability")?.value||"dex",show:!!i.querySelector(".tool-show")?.checked,prof:!!i.querySelector(".tool-prof")?.checked,exp:!!i.querySelector(".tool-exp")?.checked,mod:i.querySelector(".tool-mod")?.value||"0",custom:i.dataset.custom==="true"})}),l.tools=o,l.proficiencies=l.proficiencies||{languages:"",weapons:"",armor:"",tools:""};const n=Object.keys(o).filter(i=>o[i].prof);l.proficiencies.tools=n.join(", "),d(l),r(l),e()})}export function openToolSettingsModal(t,s={}){if(ensureToolSettingsModalExists(s),!t)return;const d=document.getElementById("modal-tool-toggles-list");if(!d)return;d.innerHTML="";const r=t.tools||{},a=new Set([...S.map(e=>e.name),...Object.keys(r)]);Array.from(a).sort().forEach(e=>{const l=S.some(u=>u.name===e),o=S.find(u=>u.name===e),n=r[e]||{ability:o?o.ability:"dex",show:!1,prof:!1,exp:!1,mod:0,custom:!l},i=n.custom!==void 0?!!n.custom:!l,c=!!(n.prof||n.proficient),m=!!n.exp,v=!!(n.show!==void 0?n.show:c),g=document.createElement("div");g.className="tool-settings-row",g.dataset.key=e,g.dataset.custom=String(i),g.style.display="flex",g.style.alignItems="center",g.style.justifyContent="space-between",g.style.background="rgba(0,0,0,0.2)",g.style.padding="6px",g.style.borderRadius="4px",g.style.border="1px solid var(--color-border-subtle)";const p=u=>n.ability===u?"selected":"";g.innerHTML=`
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <input type="checkbox" class="tool-show" title="Show on Sheet" ${v?"checked":""} style="cursor:pointer; accent-color: var(--color-gold-base);">
                <input type="checkbox" class="tool-prof" title="Proficient" ${c?"checked":""} style="cursor:pointer;">
                <input type="checkbox" class="tool-exp" title="Expertise" ${m?"checked":""} style="cursor:pointer; border-radius:50%;">
                ${i?`<input type="text" class="tool-name" value="${e}" style="width:140px; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);">`:`<span class="tool-name-static" style="width:140px; font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${e}">${e}</span>`}
                <select class="tool-ability" style="background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px; padding:2px;">
                    <option value="str" ${p("str")}>STR</option>
                    <option value="dex" ${p("dex")}>DEX</option>
                    <option value="con" ${p("con")}>CON</option>
                    <option value="int" ${p("int")}>INT</option>
                    <option value="wis" ${p("wis")}>WIS</option>
                    <option value="cha" ${p("cha")}>CHA</option>
                </select>
            </div>
            <div style="display:flex; gap:6px;">
                <input type="text" class="tool-mod" value="${n.mod||"0"}" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                ${i?'<button class="btn btn-danger btn-xxs tool-delete" style="padding:2px 6px;"><i class="fa-solid fa-trash"></i></button>':'<div style="width:24px;"></div>'}
            </div>
        `,d.appendChild(g),i&&g.querySelector(".tool-delete")?.addEventListener("click",()=>{g.remove()})}),document.getElementById("pc-tool-settings-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-tool-settings-overlay")?.classList.remove("vtt-hidden")}function k(t){const s=document.getElementById("modal-hp-effective-preview");s&&t&&(s.textContent=`${t.hpCurrent||0} / ${t.hpMax||0}`)}export function renderHpTogglesList(t,s={}){const d=document.getElementById("modal-hp-toggles-list");if(!d||!t||!t.hpToggles)return;let r="";t.hpToggles.forEach((a,e)=>{const l=(a.formula||"").toString().trim(),o=l.startsWith("+")||l.startsWith("-")?l:`+${l}`;r+=`
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="hp-toggle-enable-cb" data-idx="${e}" ${a.enabled?"checked":""}>
                    <span style="font-weight:bold; font-size:0.85rem;">${a.name}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${o} Max HP</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary hp-toggle-edit-btn" data-idx="${e}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary hp-toggle-del-btn" data-idx="${e}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `}),d.innerHTML=r,d.querySelectorAll(".hp-toggle-enable-cb").forEach(a=>a.addEventListener("change",e=>{const l=e.currentTarget.dataset.idx;t.hpToggles[l].enabled=e.currentTarget.checked,h(t),s.saveAndEmit?.(t),s.renderSheetData?.(t),k(t)})),d.querySelectorAll(".hp-toggle-edit-btn").forEach(a=>a.addEventListener("click",e=>{const l=e.currentTarget.dataset.idx,o=t.hpToggles[l],n=document.getElementById("modal-hp-toggle-idx"),i=document.getElementById("modal-hp-toggle-name"),c=document.getElementById("modal-hp-toggle-formula");n&&(n.value=l),i&&(i.value=o.name),c&&(c.value=o.formula),document.getElementById("modal-hp-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-hp-toggle")?.classList.add("vtt-hidden")})),d.querySelectorAll(".hp-toggle-del-btn").forEach(a=>a.addEventListener("click",e=>{if(confirm("Delete this toggle?")){const l=e.currentTarget.dataset.idx;t.hpToggles.splice(l,1),h(t),s.saveAndEmit?.(t),s.renderSheetData?.(t),k(t),renderHpTogglesList(t,s)}}))}export function setupHpSettingsListeners(t={}){const{getCurrentChar:s=()=>window.currentChar,saveAndEmit:d=e=>window.saveAndEmit?.(e),renderSheetData:r=e=>window.renderSheetData?.(e)}=t,a=()=>{document.getElementById("pc-hp-settings-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-hp-settings-overlay")?.classList.add("vtt-hidden")};document.getElementById("modal-hp-settings-close")?.addEventListener("click",a),document.getElementById("pc-hp-settings-overlay")?.addEventListener("click",a),document.getElementById("btn-add-hp-toggle")?.addEventListener("click",()=>{const e=document.getElementById("modal-hp-toggle-idx"),l=document.getElementById("modal-hp-toggle-name"),o=document.getElementById("modal-hp-toggle-formula");e&&(e.value="-1"),l&&(l.value=""),o&&(o.value=""),document.getElementById("modal-hp-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-hp-toggle")?.classList.add("vtt-hidden")}),document.getElementById("modal-hp-toggle-cancel")?.addEventListener("click",()=>{document.getElementById("modal-hp-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-hp-toggle")?.classList.remove("vtt-hidden")}),document.getElementById("modal-hp-toggle-save")?.addEventListener("click",()=>{const e=s();if(!e)return;e.hpToggles||(e.hpToggles=[]);const l=parseInt(document.getElementById("modal-hp-toggle-idx")?.value||"-1"),o=document.getElementById("modal-hp-toggle-name")?.value.trim(),n=document.getElementById("modal-hp-toggle-formula")?.value.trim();if(!o||!n)return alert("Name and Formula are required.");const i={id:"hptgl_"+Date.now(),name:o,formula:n,enabled:!0};l>=0?e.hpToggles[l]=i:e.hpToggles.push(i),document.getElementById("modal-hp-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-hp-toggle")?.classList.remove("vtt-hidden"),h(e),d(e),r(e),k(e),renderHpTogglesList(e,t)}),document.getElementById("modal-hp-settings-save")?.addEventListener("click",()=>{const e=s();if(!e)return;const l=parseInt(document.getElementById("modal-hp-base-max")?.value);isNaN(l)||(e.baseHpMax=Math.max(1,l)),h(e),d(e),r(e),a()})}export function ensureHpSettingsModalExists(t={}){if(document.getElementById("pc-hp-settings-modal"))return;const s=document.createElement("div");s.innerHTML=`
        <div id="pc-hp-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-hp-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:480px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">HP Settings & Toggles</h3>
                <button id="modal-hp-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label style="font-weight:600; display:block; margin-bottom:4px;">Base Max HP</label>
                    <input type="number" id="modal-hp-base-max" value="10" style="width:100%;">
                    <div style="margin-top:6px; font-size:0.8rem; color:var(--color-text-muted);">
                        Current HP / Max HP: <strong id="modal-hp-effective-preview" style="color:var(--color-gold-light);">10 / 10</strong>
                    </div>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">HP Toggles (Max HP Modifiers)</h4>
                        <button id="btn-add-hp-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-hp-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-hp-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-hp-toggle-name" placeholder="Name (e.g. Aid, Heroes' Feast)" style="flex:2;">
                            <input type="text" id="modal-hp-toggle-formula" placeholder="Mod (e.g. +5, +10, -5)" style="flex:1;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-hp-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-hp-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-hp-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- HP Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-hp-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `,document.body.appendChild(s),setupHpSettingsListeners(t)}export function openHpSettingsModal(t,s={}){if(ensureHpSettingsModalExists(s),!t)return;(t.baseHpMax===void 0||t.baseHpMax===null)&&(t.baseHpMax=parseInt(t.hpMax)||10);const d=document.getElementById("modal-hp-base-max");d&&(d.value=t.baseHpMax),k(t),renderHpTogglesList(t,s),document.getElementById("pc-hp-settings-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-hp-settings-overlay")?.classList.remove("vtt-hidden")}function I(t){const s=document.getElementById("modal-ac-effective-preview");s&&t&&(s.textContent=`${t.ac||10}`)}export function renderAcTogglesList(t,s={}){const d=document.getElementById("modal-ac-toggles-list");if(!d||!t||!t.acToggles)return;let r="";t.acToggles.forEach((a,e)=>{const l=(a.formula||"").toString().trim(),o=l.startsWith("+")||l.startsWith("-")?l:`+${l}`;r+=`
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="ac-toggle-enable-cb" data-idx="${e}" ${a.enabled?"checked":""}>
                    <span style="font-weight:bold; font-size:0.85rem;">${a.name}</span>
                    <span style="color:var(--color-gold-base); font-size:0.8rem;">${o} AC</span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-xxs btn-secondary ac-toggle-edit-btn" data-idx="${e}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xxs btn-secondary ac-toggle-del-btn" data-idx="${e}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `}),d.innerHTML=r,d.querySelectorAll(".ac-toggle-enable-cb").forEach(a=>a.addEventListener("change",e=>{const l=e.currentTarget.dataset.idx;t.acToggles[l].enabled=e.currentTarget.checked,E(t),s.saveAndEmit?.(t),s.renderSheetData?.(t),I(t)})),d.querySelectorAll(".ac-toggle-edit-btn").forEach(a=>a.addEventListener("click",e=>{const l=e.currentTarget.dataset.idx,o=t.acToggles[l],n=document.getElementById("modal-ac-toggle-idx"),i=document.getElementById("modal-ac-toggle-name"),c=document.getElementById("modal-ac-toggle-formula");n&&(n.value=l),i&&(i.value=o.name),c&&(c.value=o.formula),document.getElementById("modal-ac-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-ac-toggle")?.classList.add("vtt-hidden")})),d.querySelectorAll(".ac-toggle-del-btn").forEach(a=>a.addEventListener("click",e=>{if(confirm("Delete this toggle?")){const l=e.currentTarget.dataset.idx;t.acToggles.splice(l,1),E(t),s.saveAndEmit?.(t),s.renderSheetData?.(t),I(t),renderAcTogglesList(t,s)}}))}export function setupAcSettingsListeners(t={}){const{getCurrentChar:s=()=>window.currentChar,saveAndEmit:d=e=>window.saveAndEmit?.(e),renderSheetData:r=e=>window.renderSheetData?.(e)}=t,a=()=>{document.getElementById("pc-ac-settings-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-ac-settings-overlay")?.classList.add("vtt-hidden")};document.getElementById("modal-ac-settings-close")?.addEventListener("click",a),document.getElementById("pc-ac-settings-overlay")?.addEventListener("click",a),document.getElementById("btn-add-ac-toggle")?.addEventListener("click",()=>{const e=document.getElementById("modal-ac-toggle-idx"),l=document.getElementById("modal-ac-toggle-name"),o=document.getElementById("modal-ac-toggle-formula");e&&(e.value="-1"),l&&(l.value=""),o&&(o.value=""),document.getElementById("modal-ac-toggle-form")?.classList.remove("vtt-hidden"),document.getElementById("btn-add-ac-toggle")?.classList.add("vtt-hidden")}),document.getElementById("modal-ac-toggle-cancel")?.addEventListener("click",()=>{document.getElementById("modal-ac-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-ac-toggle")?.classList.remove("vtt-hidden")}),document.getElementById("modal-ac-toggle-save")?.addEventListener("click",()=>{const e=s();if(!e)return;e.acToggles||(e.acToggles=[]);const l=parseInt(document.getElementById("modal-ac-toggle-idx")?.value||"-1"),o=document.getElementById("modal-ac-toggle-name")?.value.trim(),n=document.getElementById("modal-ac-toggle-formula")?.value.trim();if(!o||!n)return alert("Name and Formula are required.");const i={id:"actgl_"+Date.now(),name:o,formula:n,enabled:!0};l>=0?e.acToggles[l]=i:e.acToggles.push(i),document.getElementById("modal-ac-toggle-form")?.classList.add("vtt-hidden"),document.getElementById("btn-add-ac-toggle")?.classList.remove("vtt-hidden"),E(e),d(e),r(e),I(e),renderAcTogglesList(e,t)}),document.getElementById("modal-ac-settings-save")?.addEventListener("click",()=>{const e=s();if(!e)return;const l=parseInt(document.getElementById("modal-ac-base")?.value);isNaN(l)||(e.baseAc=Math.max(1,l));const o=parseInt(document.getElementById("modal-ac-mod")?.value);e.acMod=isNaN(o)?0:o,E(e),d(e),r(e),a()})}export function ensureAcSettingsModalExists(t={}){if(document.getElementById("pc-ac-settings-modal"))return;const s=document.createElement("div");s.innerHTML=`
        <div id="pc-ac-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-ac-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:480px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">AC Settings & Toggles</h3>
                <button id="modal-ac-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Base AC</label>
                        <input type="number" id="modal-ac-base" value="10" style="width:100%;">
                    </div>
                    <div class="form-group">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Global AC Modifier</label>
                        <input type="number" id="modal-ac-mod" value="0" style="width:100%;">
                    </div>
                </div>
                <div style="font-size:0.8rem; color:var(--color-text-muted);">
                    Current Effective AC: <strong id="modal-ac-effective-preview" style="color:var(--color-gold-light);">10</strong>
                </div>

                <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; color:var(--color-text-primary);">AC Toggles</h4>
                        <button id="btn-add-ac-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                    </div>
                    <div id="modal-ac-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                        <input type="hidden" id="modal-ac-toggle-idx" value="-1">
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="modal-ac-toggle-name" placeholder="Name (e.g. Shield, Bladesong)" style="flex:2;">
                            <input type="text" id="modal-ac-toggle-formula" placeholder="Mod (e.g. +5, +2, +int, +dex)" style="flex:1;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button id="modal-ac-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                            <button id="modal-ac-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                        </div>
                    </div>
                    <div id="modal-ac-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                        <!-- AC Toggles injected here -->
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-ac-settings-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `,document.body.appendChild(s),setupAcSettingsListeners(t)}export function openAcSettingsModal(t,s={}){if(ensureAcSettingsModalExists(s),!t)return;(t.baseAc===void 0||t.baseAc===null)&&(t.baseAc=parseInt(t.ac)||10);const d=document.getElementById("modal-ac-base");d&&(d.value=t.baseAc);const r=document.getElementById("modal-ac-mod");r&&(r.value=t.acMod||0),I(t),renderAcTogglesList(t,s),document.getElementById("pc-ac-settings-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-ac-settings-overlay")?.classList.remove("vtt-hidden")}let B=null,M={};function w(){document.getElementById("pc-sheet-settings-modal")?.classList.add("vtt-hidden"),document.getElementById("pc-sheet-settings-overlay")?.classList.add("vtt-hidden"),B=null}function C(t={}){const s=document.getElementById("pc-sheet-settings-overlay"),d=document.getElementById("modal-sheet-settings-close"),r=document.getElementById("modal-sheet-settings-cancel"),a=document.getElementById("modal-sheet-settings-save");s?.addEventListener("click",w),d?.addEventListener("click",w),r?.addEventListener("click",w),document.querySelectorAll(".pc-carry-mult-pill").forEach(e=>{e.addEventListener("click",l=>{const o=l.currentTarget.dataset.mult,n=document.getElementById("modal-sheet-setting-carry-mult");n&&o&&(n.value=o)})}),document.querySelectorAll(".pc-crit-range-pill").forEach(e=>{e.addEventListener("click",l=>{const o=l.currentTarget.dataset.crit,n=document.getElementById("modal-sheet-setting-crit-range");n&&o&&(n.value=o)})}),a?.addEventListener("click",()=>{if(!B)return;const e=B;e.settings=e.settings||{};const l=!!document.getElementById("modal-sheet-setting-elven-accuracy")?.checked,o=parseFloat(document.getElementById("modal-sheet-setting-carry-mult")?.value),n=Math.max(.1,isNaN(o)?1:o),i=!!document.getElementById("modal-sheet-setting-halfling-lucky")?.checked,c=parseInt(document.getElementById("modal-sheet-setting-crit-range")?.value,10),m=Math.max(1,Math.min(20,isNaN(c)?20:c)),v=!!document.getElementById("modal-sheet-setting-brutal-critical")?.checked,g=parseInt(document.getElementById("modal-sheet-setting-brutal-crit-dice")?.value,10),p=Math.max(1,Math.min(10,isNaN(g)?1:g)),u=!!document.getElementById("modal-sheet-setting-reliable-talent")?.checked,x=!!document.getElementById("modal-sheet-setting-jack-of-all-trades")?.checked;e.settings.elvenAccuracy=l,e.settings.carryWeightMultiplier=n,e.settings.halflingLucky=i,e.settings.critRange=m,e.settings.brutalCritical=v,e.settings.brutalCritDice=p,e.settings.reliableTalent=u,e.settings.jackOfAllTrades=x,e.carryWeightMultiplier=n,e.attackSettings=e.attackSettings||{},e.attackSettings.critRange=m,e.spellSettings=e.spellSettings||{},e.spellSettings.critRange=m;const{saveAndEmit:y,renderSheetData:L}=M;typeof y=="function"&&y(e),typeof L=="function"&&L(e),w()})}export function ensureSheetSettingsModalExists(t={}){if(document.getElementById("pc-sheet-settings-modal"))return;const s=document.createElement("div");s.innerHTML=`
        <div id="pc-sheet-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="pc-sheet-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:520px; max-width:95vw;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading); display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-gear"></i> Character Sheet Settings
                </h3>
                <button id="modal-sheet-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; max-height:70vh; display:flex; flex-direction:column; gap:16px;">
                
                <!-- Elven Accuracy -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                        <input type="checkbox" id="modal-sheet-setting-elven-accuracy" style="width:18px; height:18px; cursor:pointer;">
                        <span><i class="fa-solid fa-crosshairs" style="color:var(--color-gold-base); margin-right:4px;"></i> Elven Accuracy (Superadvantage)</span>
                    </label>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:6px; margin-left:28px; line-height:1.4;">
                        When making an attack roll with Advantage, automatically roll 3d20 and keep the highest (<code>3d20kh1</code>).
                    </div>
                </div>

                <!-- Carry Weight Multiplier -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label style="font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                            <i class="fa-solid fa-weight-hanging" style="color:var(--color-gold-base); margin-right:4px;"></i> Carry Weight Multiplier
                        </label>
                        <input type="number" id="modal-sheet-setting-carry-mult" min="0.1" max="10" step="0.25" value="1" style="width:70px; text-align:center; padding:4px 6px; font-weight:bold; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary);">
                    </div>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:8px; line-height:1.4;">
                        Multiplies standard and variant encumbrance maximums, encumbered thresholds, and push/drag/lift capacities (e.g. for Powerful Build or size adjustments).
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        <button type="button" class="btn btn-xs btn-secondary pc-carry-mult-pill" data-mult="1">1x (Normal)</button>
                        <button type="button" class="btn btn-xs btn-secondary pc-carry-mult-pill" data-mult="2">2x (Powerful Build / Large)</button>
                        <button type="button" class="btn btn-xs btn-secondary pc-carry-mult-pill" data-mult="4">4x (Huge / Quadruped)</button>
                        <button type="button" class="btn btn-xs btn-secondary pc-carry-mult-pill" data-mult="8">8x (Gargantuan)</button>
                    </div>
                </div>

                <!-- Halfling Lucky -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                        <input type="checkbox" id="modal-sheet-setting-halfling-lucky" style="width:18px; height:18px; cursor:pointer;">
                        <span><i class="fa-solid fa-clover" style="color:#50c878; margin-right:4px;"></i> Halfling Lucky</span>
                    </label>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:6px; margin-left:28px; line-height:1.4;">
                        Automatically rerolls natural 1s on attack, check, and saving throw d20 rolls (<code>ro1</code>).
                    </div>
                </div>

                <!-- Global Crit Threshold -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label style="font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                            <i class="fa-solid fa-bullseye" style="color:var(--color-danger, #ef5350); margin-right:4px;"></i> Global Crit Threshold
                        </label>
                        <input type="number" id="modal-sheet-setting-crit-range" min="1" max="20" step="1" value="20" style="width:70px; text-align:center; padding:4px 6px; font-weight:bold; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary);">
                    </div>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:8px; line-height:1.4;">
                        Minimum d20 roll required for a Critical Hit across sheet attack and spell rolls (default 20, set to 19 for Champion Fighter, Hexblade's Curse, etc.).
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn btn-xs btn-secondary pc-crit-range-pill" data-crit="20">20 (Default)</button>
                        <button type="button" class="btn btn-xs btn-secondary pc-crit-range-pill" data-crit="19">19-20 (Champion)</button>
                        <button type="button" class="btn btn-xs btn-secondary pc-crit-range-pill" data-crit="18">18-20 (Master)</button>
                    </div>
                </div>

                <!-- Brutal Critical & Savage Attacks -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                            <input type="checkbox" id="modal-sheet-setting-brutal-critical" style="width:18px; height:18px; cursor:pointer;">
                            <span><i class="fa-solid fa-burst" style="color:var(--color-danger, #ef5350); margin-right:4px;"></i> Brutal Critical / Savage Attacks</span>
                        </label>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.75rem; color:var(--color-text-muted);">Extra Dice:</span>
                            <input type="number" id="modal-sheet-setting-brutal-crit-dice" min="1" max="10" step="1" value="1" style="width:55px; text-align:center; padding:3px 4px; font-weight:bold; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:4px; color:var(--color-text-primary);">
                        </div>
                    </div>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:6px; margin-left:28px; line-height:1.4;">
                        Rolls extra weapon damage dice when scoring a critical hit with a melee weapon attack (Barbarian 9/13/17, Half-Orc Savage Attacks).
                    </div>
                </div>

                <!-- Reliable Talent -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                        <input type="checkbox" id="modal-sheet-setting-reliable-talent" style="width:18px; height:18px; cursor:pointer;">
                        <span><i class="fa-solid fa-dice-d20" style="color:var(--color-gold-base); margin-right:4px;"></i> Reliable Talent</span>
                    </label>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:6px; margin-left:28px; line-height:1.4;">
                        Treat any d20 roll of 9 or lower as a 10 on ability checks that include your proficiency bonus (Rogue 11+).
                    </div>
                </div>

                <!-- Jack of All Trades -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:8px; padding:12px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; font-size:0.95rem; color:var(--color-text-primary); margin:0;">
                        <input type="checkbox" id="modal-sheet-setting-jack-of-all-trades" style="width:18px; height:18px; cursor:pointer;">
                        <span><i class="fa-solid fa-masks-theater" style="color:#38bdf8; margin-right:4px;"></i> Jack of All Trades</span>
                    </label>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:6px; margin-left:28px; line-height:1.4;">
                        Adds half your proficiency bonus (rounded down) to any ability check and initiative roll that doesn't already include proficiency (Bard 2+).
                    </div>
                </div>

            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.2);">
                <button type="button" id="modal-sheet-settings-cancel" class="btn btn-secondary">Cancel</button>
                <button type="button" id="modal-sheet-settings-save" class="btn btn-primary">Save Settings</button>
            </div>
        </div>
    `,document.body.appendChild(s),C(t)}export function openSheetSettingsModal(t,s={}){if(ensureSheetSettingsModalExists(s),!t)return;B=t,M=s,typeof T=="function"&&T(t),t.settings=t.settings||{};const d=!!t.settings.elvenAccuracy,r=t.settings.carryWeightMultiplier||t.carryWeightMultiplier||1,a=!!t.settings.halflingLucky,e=t.settings.critRange||t.attackSettings?.critRange||20,l=!!t.settings.brutalCritical,o=parseInt(t.settings.brutalCritDice)||1,n=!!t.settings.reliableTalent,i=!!t.settings.jackOfAllTrades,c=document.getElementById("modal-sheet-setting-elven-accuracy");c&&(c.checked=d);const m=document.getElementById("modal-sheet-setting-carry-mult");m&&(m.value=r);const v=document.getElementById("modal-sheet-setting-halfling-lucky");v&&(v.checked=a);const g=document.getElementById("modal-sheet-setting-crit-range");g&&(g.value=e);const p=document.getElementById("modal-sheet-setting-brutal-critical");p&&(p.checked=l);const u=document.getElementById("modal-sheet-setting-brutal-crit-dice");u&&(u.value=o);const x=document.getElementById("modal-sheet-setting-reliable-talent");x&&(x.checked=n);const y=document.getElementById("modal-sheet-setting-jack-of-all-trades");y&&(y.checked=i),document.getElementById("pc-sheet-settings-modal")?.classList.remove("vtt-hidden"),document.getElementById("pc-sheet-settings-overlay")?.classList.remove("vtt-hidden")}
