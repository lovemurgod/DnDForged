export function closeAnyWallModal(){const o=document.getElementById("vtt-wall-settings-modal");o&&o.remove();const i=document.getElementById("vtt-wall-context-menu");i&&i.remove()}export function createWallSettingsModalContainer(o,i,d=280){closeAnyWallModal();const n=document.createElement("div");return n.id="vtt-wall-settings-modal",n.className="glassmorphism floating-tool-panel",n.style.position="fixed",n.style.left=`${Math.min(window.innerWidth-d-20,Math.max(10,o))}px`,n.style.top=`${Math.min(window.innerHeight-380,Math.max(10,i))}px`,n.style.zIndex="10000",n.style.padding="14px 16px",n.style.borderRadius="8px",n.style.width=`${d}px`,n.style.background="rgba(18, 22, 33, 0.98)",n.style.border="1px solid var(--color-border-subtle)",n.style.boxShadow="0 10px 36px rgba(0, 0, 0, 0.6)",n}export function setupModalOutsideClick(o){let i=!0;const d=n=>{i&&(o.contains(n.target)||(i=!1,window.removeEventListener("mousedown",d),o.remove()))};o._cleanupOutsideClick=()=>{i&&(i=!1,window.removeEventListener("mousedown",d))},setTimeout(()=>{i&&document.body.contains(o)&&window.addEventListener("mousedown",d)},120)}export function showDoorSettingsModal(o,i,d,n){const{walls:s,currentMapId:b,vtt:g,onWallsUpdated:l,onWallDeleted:c}=n,e=s[o];if(!e)return;const t=createWallSettingsModalContainer(i,d,280);t.innerHTML=`
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-door-closed text-gradient-gold"></i> Door Settings
            </h4>
            <button type="button" class="btn btn-secondary btn-xxs modal-close-btn" style="padding: 2px 6px;">\u2715</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer;">
                <span><i class="fa-solid fa-lock" style="width: 18px; color: ${e.isLocked?"#dc3545":"#6c757d"};"></i> Locked Door</span>
                <input type="checkbox" id="modal-door-locked" ${e.isLocked?"checked":""}>
            </label>

            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer;">
                <span><i class="fa-solid fa-eye-slash" style="width: 18px; color: ${e.isSecret?"#ffc107":"#28a745"};"></i> Secret (Hidden to Players)</span>
                <input type="checkbox" id="modal-door-secret" ${e.isSecret?"checked":""}>
            </label>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer; margin-bottom: 6px;">
                    <span><i class="fa-solid fa-arrows-spin" style="width: 18px; color: var(--color-gold-base);"></i> Rotating Hinge Pivot</span>
                    <input type="checkbox" id="modal-door-hinge" ${e.hasHinge?"checked":""}>
                </label>
                <div id="modal-door-hinge-details" class="${e.hasHinge?"":"vtt-hidden"}" style="display: flex; flex-direction: column; gap: 6px; padding-left: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
                        <span>Pivot Endpoint:</span>
                        <select id="modal-door-hinge-endpoint" style="font-size: 0.75rem; padding: 2px 6px;">
                            <option value="1" ${(e.hingeEndpoint||1)===1?"selected":""}>Endpoint 1 (Start)</option>
                            <option value="2" ${(e.hingeEndpoint||1)===2?"selected":""}>Endpoint 2 (End)</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
                        <span>Swing Angle (\xB0):</span>
                        <input type="number" id="modal-door-swing-angle" min="15" max="180" step="15" value="${e.swingAngle||90}" style="width: 60px; font-size: 0.75rem; padding: 2px 4px;">
                    </div>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">Convert to:</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="modal-convert-to-wall" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-square-full"></i> Wall</button>
                    <button type="button" id="modal-convert-to-window" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-border-all"></i> Window</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <button type="button" id="modal-door-delete" class="btn btn-danger btn-xs" style="width: 100%; text-align: center;">
                    <i class="fa-solid fa-trash"></i> Delete Door
                </button>
            </div>
        </div>
    `,document.body.appendChild(t),setupModalOutsideClick(t),t.querySelector(".modal-close-btn").onclick=()=>{t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-door-locked").onchange=a=>{e.isLocked=a.target.checked,e.isLocked&&e.isOpen&&(e.isOpen=!1),l()},t.querySelector("#modal-door-secret").onchange=a=>{e.isSecret=a.target.checked,l()};const r=t.querySelector("#modal-door-hinge"),y=t.querySelector("#modal-door-hinge-details");r.onchange=a=>{e.hasHinge=a.target.checked,e.hasHinge&&!e.hingeEndpoint&&(e.hingeEndpoint=1),y.classList.toggle("vtt-hidden",!e.hasHinge),l()},t.querySelector("#modal-door-hinge-endpoint").onchange=a=>{e.hingeEndpoint=parseInt(a.target.value)||1,l()},t.querySelector("#modal-door-swing-angle").onchange=a=>{e.swingAngle=parseInt(a.target.value)||90,l()},t.querySelector("#modal-convert-to-wall").onclick=()=>{e.type="wall",l(),t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-convert-to-window").onclick=()=>{e.type="window",l(),t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-door-delete").onclick=()=>{s.splice(o,1),typeof c=="function"&&c(o),t._cleanupOutsideClick?.(),t.remove()}}export function showWindowSettingsModal(o,i,d,n){const{walls:s,currentMapId:b,vtt:g,onWallsUpdated:l,onWallDeleted:c}=n,e=s[o];if(!e)return;const t=createWallSettingsModalContainer(i,d,290);let r="both_blocked";e.oneWay&&e.oneWay!=="none"?r="one_way":(e.isSeeThrough||e.isDrawn===!1)&&(r="both_seethrough"),t.innerHTML=`
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-border-all text-gradient-gold"></i> Window Settings
            </h4>
            <button type="button" class="btn btn-secondary btn-xxs modal-close-btn" style="padding: 2px 6px;">\u2715</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer;">
                <span><i class="fa-solid fa-lock" style="width: 18px; color: ${e.isLocked?"#dc3545":"#6c757d"};"></i> Locked (Blocks Pass-Through)</span>
                <input type="checkbox" id="modal-window-locked" ${e.isLocked?"checked":""}>
            </label>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.78rem; font-weight: 500; margin-bottom: 6px; color: var(--color-gold-base);">Vision & Light Mode:</div>
                <select id="modal-window-vision-mode" style="width: 100%; font-size: 0.75rem; padding: 4px 8px; margin-bottom: 6px;">
                    <option value="both_seethrough" ${r==="both_seethrough"?"selected":""}>Both Sides See-Through (Transparent)</option>
                    <option value="both_blocked" ${r==="both_blocked"?"selected":""}>Both Sides Blocked (Opaque Glass)</option>
                    <option value="one_way" ${r==="one_way"?"selected":""}>One-Way Vision (Tinted / Mirrored)</option>
                </select>
                
                <div id="modal-window-oneway-controls" class="${r==="one_way"?"":"vtt-hidden"}" style="background: rgba(0,0,0,0.25); padding: 8px; border-radius: 4px; display: flex; flex-direction: column; gap: 6px;">
                    <button type="button" id="modal-window-flip-direction" class="btn btn-secondary btn-xs" style="width: 100%;">
                        <i class="fa-solid fa-arrows-rotate"></i> Flip Direction (Swap Sides)
                    </button>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 2px;"></span> Green Dashed: See-Through
                    </div>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #dc3545; border-radius: 2px;"></span> Red Solid: Blocked
                    </div>
                </div>
            </div>

            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <span><i class="fa-solid fa-eye-slash" style="width: 18px; color: ${e.isSecret?"#ffc107":"#28a745"};"></i> Secret (Hidden to Players)</span>
                <input type="checkbox" id="modal-window-secret" ${e.isSecret?"checked":""}>
            </label>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">Convert to:</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="modal-convert-to-wall" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-square-full"></i> Wall</button>
                    <button type="button" id="modal-convert-to-door" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-door-closed"></i> Door</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <button type="button" id="modal-window-delete" class="btn btn-danger btn-xs" style="width: 100%; text-align: center;">
                    <i class="fa-solid fa-trash"></i> Delete Window
                </button>
            </div>
        </div>
    `,document.body.appendChild(t),setupModalOutsideClick(t),t.querySelector(".modal-close-btn").onclick=()=>{t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-window-locked").onchange=p=>{e.isLocked=p.target.checked,e.isLocked&&e.isOpen&&(e.isOpen=!1),l()};const y=t.querySelector("#modal-window-vision-mode"),a=t.querySelector("#modal-window-oneway-controls");y.onchange=p=>{const u=p.target.value;u==="both_seethrough"?(e.isSeeThrough=!0,e.isDrawn=!1,e.oneWay="none",a.classList.add("vtt-hidden")):u==="both_blocked"?(e.isSeeThrough=!1,e.isDrawn=!0,e.oneWay="none",a.classList.add("vtt-hidden")):u==="one_way"&&(e.isSeeThrough=!1,e.isDrawn=!0,(!e.oneWay||e.oneWay==="none")&&(e.oneWay="left"),a.classList.remove("vtt-hidden")),l()},t.querySelector("#modal-window-flip-direction").onclick=()=>{e.oneWay=e.oneWay==="left"?"right":"left",l()},t.querySelector("#modal-window-secret").onchange=p=>{e.isSecret=p.target.checked,l()},t.querySelector("#modal-convert-to-wall").onclick=()=>{e.type="wall",l(),t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-convert-to-door").onclick=()=>{e.type="door",l(),t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-window-delete").onclick=()=>{s.splice(o,1),typeof c=="function"&&c(o),t._cleanupOutsideClick?.(),t.remove()}}export function showWallSettingsModal(o,i,d,n){const{walls:s,currentMapId:b,vtt:g,onWallsUpdated:l,onWallDeleted:c}=n,e=s[o];if(!e)return;const t=createWallSettingsModalContainer(i,d,280),r=e.oneWay&&e.oneWay!=="none";t.innerHTML=`
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-square-full text-gradient-gold"></i> Wall Settings
            </h4>
            <button type="button" class="btn btn-secondary btn-xxs modal-close-btn" style="padding: 2px 6px;">\u2715</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>
                <div style="font-size: 0.78rem; font-weight: 500; margin-bottom: 6px; color: var(--color-gold-base);">Vision & Light Blocking:</div>
                <select id="modal-wall-direction-mode" style="width: 100%; font-size: 0.75rem; padding: 4px 8px; margin-bottom: 6px;">
                    <option value="none" ${r?"":"selected"}>Two-Way Wall (Normal / Blocks Both Sides)</option>
                    <option value="one_way" ${r?"selected":""}>One-Way Wall (Parapet / Ledge / Cliff)</option>
                </select>
                
                <div id="modal-wall-oneway-controls" class="${r?"":"vtt-hidden"}" style="background: rgba(0,0,0,0.25); padding: 8px; border-radius: 4px; display: flex; flex-direction: column; gap: 6px;">
                    <button type="button" id="modal-wall-flip-direction" class="btn btn-secondary btn-xs" style="width: 100%;">
                        <i class="fa-solid fa-arrows-rotate"></i> Flip Direction (Swap Sides)
                    </button>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 2px;"></span> Green Dashed: See-Through
                    </div>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #dc3545; border-radius: 2px;"></span> Red Solid: Blocked
                    </div>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">Convert to:</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="modal-convert-to-door" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-door-closed"></i> Door</button>
                    <button type="button" id="modal-convert-to-window" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-border-all"></i> Window</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <button type="button" id="modal-wall-delete" class="btn btn-danger btn-xs" style="width: 100%; text-align: center;">
                    <i class="fa-solid fa-trash"></i> Delete Wall
                </button>
            </div>
        </div>
    `,document.body.appendChild(t),setupModalOutsideClick(t),t.querySelector(".modal-close-btn").onclick=()=>{t._cleanupOutsideClick?.(),t.remove()};const y=t.querySelector("#modal-wall-direction-mode"),a=t.querySelector("#modal-wall-oneway-controls");y.onchange=p=>{p.target.value==="none"?(e.oneWay="none",a.classList.add("vtt-hidden")):((!e.oneWay||e.oneWay==="none")&&(e.oneWay="left"),a.classList.remove("vtt-hidden")),l()},t.querySelector("#modal-wall-flip-direction").onclick=()=>{e.oneWay=e.oneWay==="left"?"right":"left",l()},t.querySelector("#modal-convert-to-door").onclick=()=>{e.type="door",l(),t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-convert-to-window").onclick=()=>{e.type="window",l(),t._cleanupOutsideClick?.(),t.remove()},t.querySelector("#modal-wall-delete").onclick=()=>{s.splice(o,1),typeof c=="function"&&c(o),t._cleanupOutsideClick?.(),t.remove()}}export function openWallSettingsModal(o,i,d,n){const s=n.walls[o];s&&(s.type==="door"?showDoorSettingsModal(o,i,d,n):s.type==="window"?showWindowSettingsModal(o,i,d,n):showWallSettingsModal(o,i,d,n))}
