export const MARTIAL_WEAPONS=["Battleaxe","Blowgun","Flail","Glaive","Greataxe","Greatsword","Halberd","Hand Crossbow","Heavy Crossbow","Lance","Longbow","Longsword","Maul","Morningstar","Net","Pike","Rapier","Scimitar","Shortsword","Trident","War Pick","Warhammer","Whip"],SIMPLE_WEAPONS=["Club","Dagger","Greatclub","Handaxe","Javelin","Light Crossbow","Light Hammer","Mace","Quarterstaff","Shortbow","Sickle","Spear","Dart","Sling"];export function renderStep5(g){const{bodyEl:r,workingChar:l,classEquipChoiceSets:n,classFixedItems:p,candidateBgItems:u,updateCountsDisplay:x}=g;if(l.builderMode==="levelup"&&!l.allowLevelUpRebuildEquip){r.innerHTML=`
            <div class="builder-section-box" style="border-left:3px solid #38bdf8; text-align:left; padding:20px;">
                <div class="builder-section-header" style="border-bottom:none; margin-bottom:10px; padding:0;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-shield-halved text-gradient-gold" style="font-size:1.2rem;"></i>
                        <strong style="font-size:1.05rem; color:var(--color-gold-base);">Level-Up Mode: Equipment & Gear Preserved</strong>
                        <span class="badge" style="background:#0284c7; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:4px;">Existing Inventory Intact</span>
                    </div>
                </div>
                <div style="font-size:0.85rem; color:var(--color-text-secondary); line-height:1.6; max-width:680px;">
                    Your hero already has established weapons, armor, currency, and backpack containers on their sheet. Starting class packages and background gold pouches are bypassed during leveling up so your inventory won't be duplicated.
                </div>
                <div style="margin-top:16px; display:flex; gap:10px; align-items:center;">
                    <button type="button" id="pc-wiz-enable-equip-rebuild" class="btn btn-secondary btn-xs" style="color:var(--color-gold-light);">
                        <i class="fa-solid fa-rotate"></i> Re-run Starting Equipment Selection
                    </button>
                </div>
            </div>
        `,document.getElementById("pc-wiz-enable-equip-rebuild")?.addEventListener("click",()=>{l.allowLevelUpRebuildEquip=!0,renderStep5(g)});return}r.innerHTML=`
        <!-- Equipment Mode Selection -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield-halved text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Starting Equipment & Wealth</strong>
                </div>
            </div>
            <div style="display:flex; gap:16px; margin-bottom:12px; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="pc-wiz-equip-mode" value="packages" ${l.useStartingWealth?"":"checked"} style="accent-color:var(--color-gold-base);">
                    <span>Starting Equipment Packages</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="pc-wiz-equip-mode" value="wealth" ${l.useStartingWealth?"checked":""} style="accent-color:var(--color-gold-base);">
                    <span>Starting Wealth / Gold Alternative</span>
                </label>
            </div>

            <div style="padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="pc-wiz-auto-macro-chk" ${l.autoWeaponMacros?"checked":""} style="accent-color:var(--color-gold-base);">
                    <span style="font-size:0.85rem; color:var(--color-gold-light);">Automatically create rollable attack macros for all imported weapons</span>
                </label>
            </div>
        </div>

        ${l.useStartingWealth?`
            <!-- Starting Wealth Input -->
            <div class="builder-section-box">
                <strong style="color:var(--color-gold-light); font-size:0.95rem;">Starting Wealth (Gold Pieces)</strong>
                <div style="display:flex; gap:10px; align-items:center; margin-top:8px;">
                    <input type="number" id="pc-wiz-starting-gold" min="0" value="${l.startingGoldAmount}" style="width:120px; padding:8px 12px; font-size:1.1rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); border-radius:4px; text-align:center;">
                    <span style="color:var(--color-gold-base); font-weight:bold;">GP</span>
                </div>
            </div>
        `:`
            <!-- Class Starting Equipment -->
            ${n.length>0||p.length>0?`
                <div class="builder-section-box">
                    <div class="builder-section-header">
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Class Starting Equipment (${l.classes[0]?.name||"Primary Class"})</strong>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${n.map((e,a)=>`
                            <div class="glass-flat" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                                <div style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light); margin-bottom:6px;">${e.title}</div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    ${e.options.map(t=>{const o=(t.label||"").toLowerCase(),i=/two\s+(martial|simple)\s+weapons/i.test(o),c=o.includes("martial weapon")||o.includes("simple weapon")||i,d=o.includes("martial weapon")?MARTIAL_WEAPONS:SIMPLE_WEAPONS,v=e.selectedOption===t.key;return i?((!e.selectedWeapon1||!d.includes(e.selectedWeapon1))&&(e.selectedWeapon1=d[0]),(!e.selectedWeapon2||!d.includes(e.selectedWeapon2))&&(e.selectedWeapon2=d[1]||d[0])):c&&(!e.selectedWeapon||!d.includes(e.selectedWeapon))&&(e.selectedWeapon=d[0]),`
                                        <div style="display:flex; flex-direction:column; gap:4px;">
                                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem; color:var(--color-text-primary);">
                                                <input type="radio" name="pc-wiz-choice-${a}" value="${t.key}" ${v?"checked":""} class="pc-wiz-eq-choice-radio" data-csidx="${a}" style="accent-color:var(--color-gold-base);">
                                                <span><strong>(${t.key.toUpperCase()})</strong> ${t.label}</span>
                                            </label>
                                            ${i&&v?`
                                                <div style="margin-left:24px; display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                                                    <div style="display:flex; align-items:center; gap:8px;">
                                                        <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Weapon 1:</span>
                                                        <select class="pc-wiz-eq-weapon-sel1" data-csidx="${a}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                            ${d.map(s=>`<option value="${s}" ${e.selectedWeapon1===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                    <div style="display:flex; align-items:center; gap:8px;">
                                                        <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Weapon 2:</span>
                                                        <select class="pc-wiz-eq-weapon-sel2" data-csidx="${a}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                            ${d.map(s=>`<option value="${s}" ${e.selectedWeapon2===s?"selected":""}>${s}</option>`).join("")}
                                                        </select>
                                                    </div>
                                                </div>
                                            `:c&&v?`
                                                <div style="margin-left:24px; display:flex; align-items:center; gap:8px; margin-top:4px;">
                                                    <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Select Weapon:</span>
                                                    <select class="pc-wiz-eq-weapon-sel" data-csidx="${a}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                        ${d.map(s=>`<option value="${s}" ${e.selectedWeapon===s?"selected":""}>${s}</option>`).join("")}
                                                    </select>
                                                </div>
                                            `:""}
                                        </div>
                                        `}).join("")}
                                </div>
                            </div>
                        `).join("")}

                        ${p.length>0?`
                            <div class="glass-flat" style="padding:10px 12px; border-radius:6px; border:1px solid var(--color-border-subtle);">
                                <div style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light); margin-bottom:6px;">Standard Class Items</div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    ${p.map(e=>{const a=(e.name||"").toLowerCase(),t=a.includes("simple weapon")||a.includes("martial weapon"),i=a.includes("martial weapon")?MARTIAL_WEAPONS:SIMPLE_WEAPONS;return t&&(!e.selectedWeapon||!i.includes(e.selectedWeapon))&&(e.selectedWeapon=i[0]),`
                                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:0.85rem; color:var(--color-text-primary); flex-wrap:wrap;">
                                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                                <input type="checkbox" class="pc-wiz-fixed-item-chk" data-item-id="${e.id}" ${e.checked?"checked":""} style="accent-color:var(--color-gold-base);">
                                                <span>${e.name}</span>
                                            </label>
                                            ${t?`
                                                <div style="display:flex; align-items:center; gap:6px;">
                                                    <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;"><i class="fa-solid fa-crosshairs"></i> Select Weapon:</span>
                                                    <select class="pc-wiz-fixed-weapon-sel" data-fitid="${e.id}" style="padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                                        ${i.map(c=>`<option value="${c}" ${e.selectedWeapon===c?"selected":""}>${c}</option>`).join("")}
                                                    </select>
                                                </div>
                                            `:""}
                                        </div>
                                        `}).join("")}
                                </div>
                            </div>
                        `:""}
                    </div>
                </div>
            `:""}

            <!-- Background Items -->
            ${u.length>0?`
                <div class="builder-section-box">
                    <div class="builder-section-header">
                        <strong style="font-size:0.95rem; color:var(--color-gold-base);">Background Items (${l.background||"Background"})</strong>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${u.map(e=>`
                            <label class="glass-flat" style="padding:8px 12px; border-radius:6px; border:1px solid var(--color-border-subtle); display:flex; gap:10px; align-items:center; cursor:pointer;">
                                <input type="checkbox" class="pc-wiz-bg-item-chk" data-item-id="${e.id}" ${e.checked?"checked":""} style="accent-color:var(--color-gold-base);">
                                <span style="font-weight:600; color:var(--color-text-primary);">${e.name} ${e.qty>1&&!e.isGold&&e.type!=="Currency"?`(x${e.qty})`:""}</span>
                            </label>
                        `).join("")}
                    </div>
                </div>
            `:""}
        `}
    `,r.querySelectorAll('input[name="pc-wiz-equip-mode"]').forEach(e=>{e.addEventListener("change",a=>{l.useStartingWealth=a.target.value==="wealth",renderStep5(g)})}),r.querySelectorAll(".pc-wiz-eq-choice-radio").forEach(e=>{e.addEventListener("change",a=>{const t=parseInt(a.target.dataset.csidx);n[t]&&(n[t].selectedOption=a.target.value),renderStep5(g),x()})}),r.querySelectorAll(".pc-wiz-eq-weapon-sel").forEach(e=>{e.addEventListener("change",a=>{const t=parseInt(a.target.dataset.csidx);n[t]&&(n[t].selectedWeapon=a.target.value)})}),r.querySelectorAll(".pc-wiz-eq-weapon-sel1").forEach(e=>{e.addEventListener("change",a=>{const t=parseInt(a.target.dataset.csidx);n[t]&&(n[t].selectedWeapon1=a.target.value)})}),r.querySelectorAll(".pc-wiz-eq-weapon-sel2").forEach(e=>{e.addEventListener("change",a=>{const t=parseInt(a.target.dataset.csidx);n[t]&&(n[t].selectedWeapon2=a.target.value)})}),r.querySelectorAll(".pc-wiz-fixed-weapon-sel").forEach(e=>{e.addEventListener("change",a=>{const t=a.target.dataset.fitid,o=p.find(i=>i.id===t);o&&(o.selectedWeapon=a.target.value)})}),r.querySelectorAll(".pc-wiz-fixed-item-chk").forEach(e=>{e.addEventListener("change",a=>{const t=a.target.dataset.itemId,o=p.find(i=>i.id===t);o&&(o.checked=a.target.checked),x()})}),document.getElementById("pc-wiz-auto-macro-chk")?.addEventListener("change",e=>{l.autoWeaponMacros=e.target.checked}),r.querySelectorAll(".pc-wiz-bg-item-chk").forEach(e=>{e.addEventListener("change",a=>{const t=a.target.dataset.itemId,o=u.find(i=>i.id===t);o&&(o.checked=a.target.checked),x()})}),document.getElementById("pc-wiz-starting-gold")?.addEventListener("change",e=>{l.startingGoldAmount=parseInt(e.target.value)||0})}
