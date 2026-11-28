import{STANDARD_DAMAGE_TYPES as Le,formatDamageList as pe,entryToPlainText as _e,calcDiceAverage as Fe,getProfBonus as Re}from"./creature-parser.js?v=mx0ag5ip";import{resolveSpellcastingType as We,get5eSlotsForCaster as Je}from"./creature-spells.js?v=mx0ag5ip";import{openTokenCropper as qe}from"../canvas/tokens/vtt-token-cropper.js?v=mx0ag5ip";import{isAnimatedMedia as Ne,promptAnimatedMediaChoice as He}from"../canvas/tokens/vtt-canvas-token-borders.js?v=mx0ag5ip";import{resolveMonsterTokenUrl as Ze}from"../vtt-utils.js?v=mx0ag5ip";export const DND_5E_SKILLS=[{key:"acrobatics",name:"Acrobatics",ability:"dex"},{key:"animalHandling",name:"Animal Handling",ability:"wis"},{key:"arcana",name:"Arcana",ability:"int"},{key:"athletics",name:"Athletics",ability:"str"},{key:"deception",name:"Deception",ability:"cha"},{key:"history",name:"History",ability:"int"},{key:"insight",name:"Insight",ability:"wis"},{key:"intimidation",name:"Intimidation",ability:"cha"},{key:"investigation",name:"Investigation",ability:"int"},{key:"medicine",name:"Medicine",ability:"wis"},{key:"nature",name:"Nature",ability:"int"},{key:"perception",name:"Perception",ability:"wis"},{key:"performance",name:"Performance",ability:"cha"},{key:"persuasion",name:"Persuasion",ability:"cha"},{key:"religion",name:"Religion",ability:"int"},{key:"sleightOfHand",name:"Sleight of Hand",ability:"dex"},{key:"stealth",name:"Stealth",ability:"dex"},{key:"survival",name:"Survival",ability:"wis"}];let je=null,oe=null;export function defenseToEditableRows(e){if(!e)return[];const I=Array.isArray(e)?e:[e],b=[];return I.forEach(C=>{if(C){if(typeof C=="string")b.push({types:[C.trim().toLowerCase()],bypasses:[],note:""});else if(typeof C=="object")if(Array.isArray(C.types))b.push({types:C.types.map(s=>String(s).trim().toLowerCase()).filter(Boolean),bypasses:Array.isArray(C.bypasses)?C.bypasses.map(s=>String(s).trim().toLowerCase()).filter(Boolean):[],note:C.note||""});else{const s=C.immune||C.resist||C.vulnerable||[],r=(Array.isArray(s)?s:[s]).map(N=>String(N).trim().toLowerCase()).filter(Boolean),y=C.note||"",l=[];/nonmagical/i.test(y)&&l.push("magic"),/silver/i.test(y)&&l.push("silver"),/adamantine/i.test(y)&&l.push("adamantine"),b.push({types:r,bypasses:l,note:y})}}}),b}export function editableRowsToDefenses(e){if(!e||!Array.isArray(e))return[];const I=[];return e.forEach(b=>{const C=(b.types||[]).map(y=>y.trim().toLowerCase()).filter(Boolean);if(C.length===0)return;const s=(b.bypasses||[]).map(y=>y.trim().toLowerCase()).filter(Boolean),r=(b.note||"").trim();s.length>0||r?I.push({types:C,bypasses:s,note:r}):C.forEach(y=>I.push(y))}),I}export function parseDefenseTextInput(e,I=[]){if(!e)return[];const b=e.split(/[,;]/).map(s=>s.trim()).filter(Boolean),C=[];return b.forEach(s=>{let r="",y=[];const l=s.match(/\(([^)]+)\)/);if(l){const c=l[1];/nonmagical/i.test(c)&&y.push("magic"),/silver/i.test(c)&&y.push("silver"),/adamantine/i.test(c)&&y.push("adamantine"),r=c,s=s.replace(/\([^)]+\)/,"").trim()}const N=s.split(/[\s/]+/).map(c=>c.trim().toLowerCase()).filter(Boolean);N.length>0&&(y.length>0||r?C.push({types:N,bypasses:y,note:r}):C.push(...N))}),C.length>0?C:I}export function openCreatureDefenseConfigModal(e,I){if(typeof document>"u")return;let b=document.getElementById("cs-defenses-modal-overlay");b&&b.remove();const C=["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"],s=["bludgeoning","piercing","slashing"],r=["acid","cold","fire","lightning","thunder"],y={resist:JSON.parse(JSON.stringify(e.resist||[])),immune:JSON.parse(JSON.stringify(e.immune||[])),vulnerable:JSON.parse(JSON.stringify(e.vulnerable||[]))};let l="resist";b=document.createElement("div"),b.id="cs-defenses-modal-overlay",b.style.cssText="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:10001; display:flex; justify-content:center; align-items:center;";const N=document.createElement("div");N.style.cssText="width:620px; max-width:92vw; max-height:88vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-gold-base, #c5a059); border-radius:8px; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.9);",N.innerHTML=`
        <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle, #333); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:8px 8px 0 0;">
            <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base); font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-shield-halved"></i> Configure Creature Defenses
            </h3>
            <button type="button" id="cs-def-close-btn" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:flex; border-bottom:1px solid var(--color-border-subtle, #333); background:rgba(0,0,0,0.2);">
            <button type="button" class="cs-def-tab-btn" data-tab="resist" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Resistances</button>
            <button type="button" class="cs-def-tab-btn" data-tab="immune" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Immunities</button>
            <button type="button" class="cs-def-tab-btn" data-tab="vulnerable" style="flex:1; padding:10px 8px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; transition:all 0.2s;">Vulnerabilities</button>
        </div>
        <div id="cs-def-tab-content" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;"></div>
        <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle, #333); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:0 0 8px 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="cs-def-add-row-btn" style="display:inline-flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-plus"></i> Add Defense Rule
            </button>
            <div style="display:gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="cs-def-cancel-btn">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="cs-def-apply-btn">Apply Defenses</button>
            </div>
        </div>
    `,b.appendChild(N),document.body.appendChild(b);function c(){N.querySelectorAll(".cs-def-tab-btn").forEach($=>{const Z=$.dataset.tab===l;$.style.borderBottomColor=Z?"var(--color-gold-base, #c5a059)":"transparent",$.style.color=Z?"var(--color-gold-base, #c5a059)":"var(--color-text-muted)",$.style.background=Z?"rgba(197, 160, 89, 0.1)":"transparent"})}function G(){const $=N.querySelector("#cs-def-tab-content");$.innerHTML="";const Z=y[l]||[];if(Z.length===0){$.innerHTML=`
                <div style="text-align:center; padding:32px 16px; color:var(--color-text-muted); font-size:0.85rem;">
                    No ${l} configured yet.<br>Click <strong>"Add Defense Rule"</strong> below to create one.
                </div>
            `;return}Z.forEach((p,S)=>{const m=document.createElement("div");m.style.cssText="background:rgba(255,255,255,0.03); border:1px solid var(--color-border-subtle, #333); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:10px;";const j=document.createElement("div");j.style.cssText="display:flex; justify-content:space-between; align-items:center;",j.innerHTML=`
                <span style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Rule #${S+1}</span>
                <button type="button" class="btn btn-danger btn-xxs cs-def-del-row" data-idx="${S}" style="padding:2px 6px;" title="Delete this rule"><i class="fa-solid fa-trash"></i></button>
            `,m.appendChild(j);const B=document.createElement("div");B.innerHTML=`
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.75rem; color:var(--color-text-muted);">Damage Types:</span>
                    <div style="display:flex; gap:4px;">
                        <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-bps" data-idx="${S}" style="font-size:0.7rem; padding:1px 5px;">BPS</button>
                        <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-elem" data-idx="${S}" style="font-size:0.7rem; padding:1px 5px;">Elemental</button>
                        <button type="button" class="btn btn-secondary btn-xxs cs-def-preset-clear" data-idx="${S}" style="font-size:0.7rem; padding:1px 5px;">Clear</button>
                    </div>
                </div>
            `;const z=document.createElement("div");z.style.cssText="display:flex; flex-wrap:wrap; gap:4px;",C.forEach(k=>{const g=(p.types||[]).map(_=>_.toLowerCase()).includes(k),L=document.createElement("button");L.type="button",L.className="cs-def-type-chip",L.dataset.type=k,L.dataset.idx=S,L.textContent=k.charAt(0).toUpperCase()+k.slice(1),L.style.cssText=g?"padding:2px 8px; font-size:0.75rem; border-radius:12px; border:1px solid var(--color-gold-base, #c5a059); background:var(--color-gold-base, #c5a059); color:#000; font-weight:600; cursor:pointer;":"padding:2px 8px; font-size:0.75rem; border-radius:12px; border:1px solid var(--color-border-subtle, #444); background:rgba(0,0,0,0.2); color:var(--color-text-muted); cursor:pointer;",L.addEventListener("click",()=>{p.types=p.types||[];const _=p.types.findIndex(Q=>Q.toLowerCase()===k);_>=0?p.types.splice(_,1):p.types.push(k),G()}),z.appendChild(L)}),B.appendChild(z),m.appendChild(B);const O=document.createElement("div");O.style.cssText="background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; display:flex; flex-direction:column; gap:4px;";const K=(p.bypasses||[]).map(k=>k.toLowerCase()),a=K.includes("magic")||K.includes("nonmagical"),q=K.includes("silver")||K.includes("silvered"),T=K.includes("adamantine");O.innerHTML=`
                <span style="font-size:0.72rem; color:var(--color-gold-base); font-weight:600; text-transform:uppercase;">Bypassed by attacks that are:</span>
                <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:2px;">
                    <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                        <input type="checkbox" class="cs-def-bypass-magic" data-idx="${S}" ${a?"checked":""}> Magical (Nonmagical bypasses)
                    </label>
                    <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                        <input type="checkbox" class="cs-def-bypass-silver" data-idx="${S}" ${q?"checked":""}> Silvered
                    </label>
                    <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:var(--color-text-secondary);">
                        <input type="checkbox" class="cs-def-bypass-adam" data-idx="${S}" ${T?"checked":""}> Adamantine
                    </label>
                </div>
            `,m.appendChild(O);const M=document.createElement("div");M.innerHTML=`
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:0.75rem; color:var(--color-text-muted); white-space:nowrap;">Note:</span>
                    <input type="text" class="vtt-input cs-def-note-input" data-idx="${S}" value="${(p.note||"").replace(/"/g,"&quot;")}" placeholder="e.g. while in dim light or darkness" style="width:100%; font-size:0.75rem; padding:3px 6px;">
                </div>
            `,m.appendChild(M),$.appendChild(m)}),$.querySelectorAll(".cs-def-del-row").forEach(p=>{p.addEventListener("click",()=>{const S=parseInt(p.dataset.idx);y[l].splice(S,1),G()})}),$.querySelectorAll(".cs-def-preset-bps").forEach(p=>{p.addEventListener("click",()=>{const S=parseInt(p.dataset.idx),m=y[l][S];m.types=[...new Set([...m.types||[],...s])],G()})}),$.querySelectorAll(".cs-def-preset-elem").forEach(p=>{p.addEventListener("click",()=>{const S=parseInt(p.dataset.idx),m=y[l][S];m.types=[...new Set([...m.types||[],...r])],G()})}),$.querySelectorAll(".cs-def-preset-clear").forEach(p=>{p.addEventListener("click",()=>{const S=parseInt(p.dataset.idx);y[l][S].types=[],G()})}),$.querySelectorAll(".cs-def-bypass-magic").forEach(p=>{p.addEventListener("change",()=>{const S=parseInt(p.dataset.idx),m=y[l][S];m.bypasses=m.bypasses||[],m.bypasses=m.bypasses.filter(j=>j!=="magic"&&j!=="nonmagical"),p.checked&&m.bypasses.push("magic")})}),$.querySelectorAll(".cs-def-bypass-silver").forEach(p=>{p.addEventListener("change",()=>{const S=parseInt(p.dataset.idx),m=y[l][S];m.bypasses=m.bypasses||[],m.bypasses=m.bypasses.filter(j=>j!=="silver"&&j!=="silvered"),p.checked&&m.bypasses.push("silver")})}),$.querySelectorAll(".cs-def-bypass-adam").forEach(p=>{p.addEventListener("change",()=>{const S=parseInt(p.dataset.idx),m=y[l][S];m.bypasses=m.bypasses||[],m.bypasses=m.bypasses.filter(j=>j!=="adamantine"),p.checked&&m.bypasses.push("adamantine")})}),$.querySelectorAll(".cs-def-note-input").forEach(p=>{p.addEventListener("input",()=>{const S=parseInt(p.dataset.idx);y[l][S].note=p.value})})}N.querySelectorAll(".cs-def-tab-btn").forEach($=>{$.addEventListener("click",()=>{l=$.dataset.tab,c(),G()})}),N.querySelector("#cs-def-add-row-btn").addEventListener("click",()=>{y[l]=y[l]||[],y[l].push({types:[],bypasses:[],note:""}),G()});const J=()=>b.remove();N.querySelector("#cs-def-close-btn").addEventListener("click",J),N.querySelector("#cs-def-cancel-btn").addEventListener("click",J),N.querySelector("#cs-def-apply-btn").addEventListener("click",()=>{I(y),J()}),c(),G()}export function createAbilityRow(e={}){const I=document.createElement("div");I.className="cs-edit-ability-row",I.style.cssText="display:flex; flex-direction:column; gap:6px; margin-bottom:10px; padding:10px; background:var(--color-bg-dark); border-radius:6px; border:1px solid var(--color-border);";let b="";e.entries&&Array.isArray(e.entries)?b=e.entries.map(a=>_e(a)).filter(Boolean).join(`
`):e.descriptionHtml&&(b=e.descriptionHtml);let C="",s="",r="dex",y=[];const l=e.name||"",N=`${l} ${b}`,c=e.macro?.isMagic!==void 0?!!e.macro.isMagic:/\bmagical\b/i.test(N)||/\+[1-9]\b/.test(l),G=e.macro?.isSilvered!==void 0?!!e.macro.isSilvered:/\bsilver(?:ed)?\b/i.test(N),J=e.macro?.isAdamantine!==void 0?!!e.macro.isAdamantine:/\badamantine\b/i.test(N);if(e.macro){if(e.macro.attackBonus!==void 0&&e.macro.attackBonus!==null){const a=e.macro.attackBonus;C=a>=0?`+${a}`:`${a}`}e.macro.save&&e.macro.save.dc!==void 0&&(s=`${e.macro.save.dc}`,e.macro.save.ability&&(r=e.macro.save.ability.toLowerCase())),e.macro.damages&&Array.isArray(e.macro.damages)&&(y=e.macro.damages.map(a=>{const q=(a.type||"Slashing").trim(),T=Le.find(M=>M.toLowerCase()===q.toLowerCase())||q.charAt(0).toUpperCase()+q.slice(1).toLowerCase();return{formula:a.formula||"",type:T,saveRider:!!a.saveRider}}))}else if(b){const a=b.match(/(?:\{@hit\s+([+-]?\d+)\}|([+-]?\d+)\s+to\s+hit)/i);if(a){const k=parseInt(a[1]||a[2]);isNaN(k)||(C=k>=0?`+${k}`:`${k}`)}const q=b.match(/DC\s+(\d+)(?:\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i);q&&(s=q[1],q[2]&&(r=q[2].substring(0,3).toLowerCase()));const T=b.search(/(?:saving\s+throw|save\s+DC|\{@actSave|\{@dc|\bDC\s*\d+|\bmust\s+(?:make|succeed)\b)/i);[...b.matchAll(/(?:\{@damage\s+([^}]+)\}|(?:(?:(\d+)\s*\(([^)]+)\))|([1-9]\d*d\d+(?:\s*[+-]\s*\d+)?))\s*([a-zA-Z]+)?\s*damage)/gi)].forEach(k=>{const g=(k[1]||k[3]||k[4]||"").trim(),L=(k[5]||"Slashing").trim(),_=Le.find(A=>A.toLowerCase()===L.toLowerCase())||"Slashing",Q=T!==-1&&k.index>=T;g&&y.push({formula:g,type:_,saveRider:Q})})}I.innerHTML=`
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <input type="text" class="vtt-input edit-ab-name" value="${e.name||""}" placeholder="Ability / Action Name" style="flex:1; font-weight:600;">
            <button type="button" class="btn btn-xxs btn-danger edit-ab-del" title="Delete Ability"><i class="fa-solid fa-trash"></i></button>
        </div>
        <!-- Modular Modifier Bar -->
        <div class="edit-ab-modifier-bar" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px; font-size:0.8rem;">
            <div style="display:flex; align-items:center; gap:4px;">
                <span style="color:var(--color-text-muted); font-size:0.75rem;">Atk Mod:</span>
                <input type="text" class="vtt-input edit-ab-atk" value="${C}" placeholder="+0" style="width:48px; text-align:center; padding:2px 4px; font-size:0.8rem;">
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <span style="color:var(--color-text-muted); font-size:0.75rem;">Save DC:</span>
                <input type="number" class="vtt-input edit-ab-dc" value="${s}" placeholder="DC" style="width:48px; text-align:center; padding:2px 4px; font-size:0.8rem;">
                <select class="vtt-input edit-ab-save-ab" style="padding:2px 4px; font-size:0.8rem;">
                    ${["dex","con","wis","str","int","cha"].map(a=>`<option value="${a}" ${r===a?"selected":""}>${a.toUpperCase()}</option>`).join("")}
                </select>
            </div>
            <div class="edit-ab-dmg-container" style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:200px;">
                <div class="edit-ab-dmg-list" style="display:flex; flex-direction:column; gap:4px;"></div>
                <button type="button" class="btn btn-xxs btn-secondary edit-ab-add-dmg" style="align-self:flex-start; font-size:0.75rem; padding:2px 6px;">
                    <i class="fa-solid fa-plus"></i> Add Dmg
                </button>
            </div>
        </div>
        <!-- Attack Bypasses Bar -->
        <div class="edit-ab-bypasses-bar" style="display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:4px 8px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:4px; font-size:0.75rem;">
            <span style="color:var(--color-gold-light); font-weight:600;">Attack Bypasses:</span>
            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Attack counts as magical for overcoming damage resistance">
                <input type="checkbox" class="edit-ab-is-magic" ${c?"checked":""} style="cursor:pointer;"> Magical
            </label>
            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Attack is made with a silvered weapon">
                <input type="checkbox" class="edit-ab-is-silvered" ${G?"checked":""} style="cursor:pointer;"> Silvered
            </label>
            <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Attack is made with an adamantine weapon">
                <input type="checkbox" class="edit-ab-is-adamantine" ${J?"checked":""} style="cursor:pointer;"> Adamantine
            </label>
        </div>
        <textarea class="vtt-input edit-ab-desc" style="width:100%; height:65px; resize:vertical; font-family:var(--font-body); font-size:0.85rem;" placeholder="Description (e.g. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage)...">${b}</textarea>
    `,I.querySelector(".edit-ab-del").addEventListener("click",()=>I.remove());const $=I.querySelector(".edit-ab-dmg-list"),Z=I.querySelector(".edit-ab-desc"),p=I.querySelector(".edit-ab-atk"),S=I.querySelector(".edit-ab-dc"),m=I.querySelector(".edit-ab-save-ab"),j=Le;function B(a="",q="Slashing",T=!1){const M=(q||"Slashing").trim(),k=j.find(L=>L.toLowerCase()===M.toLowerCase())||M.charAt(0).toUpperCase()+M.slice(1).toLowerCase(),g=document.createElement("div");return g.className="edit-ab-dmg-row",g.style.cssText="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:3px;",g.innerHTML=`
            <input type="text" class="vtt-input edit-ab-dmg-formula" value="${a}" placeholder="1d6+2" style="width:70px; font-size:0.75rem; padding:2px 4px; text-align:center;">
            <select class="vtt-input edit-ab-dmg-type" style="font-size:0.75rem; padding:2px 4px;">
                ${j.map(L=>`<option value="${L}" ${k.toLowerCase()===L.toLowerCase()?"selected":""}>${L}</option>`).join("")}
            </select>
            <label style="display:inline-flex; align-items:center; gap:3px; font-size:0.7rem; color:var(--color-text-muted); cursor:pointer;" title="Check if this damage is triggered by the saving throw">
                <input type="checkbox" class="edit-ab-dmg-rider" ${T?"checked":""}> Rider
            </label>
            <button type="button" class="btn btn-xxs btn-danger edit-ab-del-dmg" style="padding:1px 4px; font-size:0.65rem;" title="Remove Damage"><i class="fa-solid fa-xmark"></i></button>
        `,g.querySelector(".edit-ab-del-dmg").addEventListener("click",()=>{g.remove(),O()}),g.querySelector(".edit-ab-dmg-formula").addEventListener("input",O),g.querySelector(".edit-ab-dmg-type").addEventListener("change",O),g.querySelector(".edit-ab-dmg-rider").addEventListener("change",O),g}y.forEach(a=>{$.appendChild(B(a.formula,a.type,a.saveRider))}),I.querySelector(".edit-ab-add-dmg").addEventListener("click",()=>{$.appendChild(B("1d6","Slashing",!1)),O()});let z=!1;function O(){if(z)return;z=!0;let a=Z.value;const q=p.value.trim();if(q){const g=q.replace(/^\+/,"");/\{@hit\s+[+-]?\d+\}/i.test(a)?a=a.replace(/\{@hit\s+[+-]?\d+\}/gi,`{@hit ${g}}`):/\b[+-]?\d+\s+to\s+hit\b/i.test(a)?a=a.replace(/\b[+-]?\d+\s+to\s+hit\b/gi,`+${g} to hit`):/Attack:\s*/i.test(a)?a=a.replace(/(Attack:\s*)/i,`$1+${g} to hit, `):a=a?`+${g} to hit. ${a}`:`+${g} to hit.`}const T=S.value.trim(),M=m.value;T&&(/\{@dc\s+\d+\}/i.test(a)?a=a.replace(/\{@dc\s+\d+\}/gi,`{@dc ${T}}`):/\bDC\s+\d+\b/i.test(a)&&(a=a.replace(/\bDC\s+\d+\b/gi,`DC ${T}`)),/\{@actSave\s+[a-zA-Z]+\}/i.test(a)&&(a=a.replace(/\{@actSave\s+[a-zA-Z]+\}/gi,`{@actSave ${M}}`)));const k=$.querySelectorAll(".edit-ab-dmg-row");if(k.length>0){const g=k[0],L=g.querySelector(".edit-ab-dmg-formula")?.value.trim(),_=g.querySelector(".edit-ab-dmg-type")?.value;if(L){const A=`${Fe(L)} (${L}) ${_.toLowerCase()} damage`;/\{@damage\s+[^}]+\}/i.test(a)?a=a.replace(/\{@damage\s+[^}]+\}/gi,`{@damage ${L}}`):/\d+\s*\([^)]+\)\s+[a-zA-Z]+\s+damage/i.test(a)&&(a=a.replace(/\d+\s*\([^)]+\)\s+[a-zA-Z]+\s+damage/i,A))}}Z.value=a,z=!1}function K(){if(z)return;z=!0;const a=Z.value,q=a.match(/(?:\{@hit\s+([+-]?\d+)\}|([+-]?\d+)\s+to\s+hit)/i);if(q){const g=parseInt(q[1]||q[2]);isNaN(g)||(p.value=g>=0?`+${g}`:`${g}`)}const T=a.match(/DC\s+(\d+)(?:\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA))?/i);T&&(S.value=T[1],T[2]&&(m.value=T[2].substring(0,3).toLowerCase()));const M=a.search(/(?:saving\s+throw|save\s+DC|\{@actSave|\{@dc|\bDC\s*\d+|\bmust\s+(?:make|succeed)\b)/i),k=[...a.matchAll(/(?:\{@damage\s+([^}]+)\}|(?:(?:(\d+)\s*\(([^)]+)\))|([1-9]\d*d\d+(?:\s*[+-]\s*\d+)?))\s*([a-zA-Z]+)?\s*damage)/gi)];k.length>0&&($.innerHTML="",k.forEach(g=>{const L=(g[1]||g[3]||g[4]||"").trim(),_=(g[5]||"Slashing").trim(),Q=j.find(te=>te.toLowerCase()===_.toLowerCase())||"Slashing",A=M!==-1&&g.index>=M;L&&$.appendChild(B(L,Q,A))})),z=!1}return p.addEventListener("input",O),S.addEventListener("input",O),m.addEventListener("change",O),Z.addEventListener("input",K),I}export function openEditModal(e,I,b={}){if(typeof document>"u")return;je=I,oe={resist:defenseToEditableRows(e.resist),immune:defenseToEditableRows(e.immune),vulnerable:defenseToEditableRows(e.vulnerable)};const s=(b.getVtt?b.getVtt():typeof window<"u"?window.VTT:null)?.campaignState?.characters?.[I];if(!s)return;let r=document.getElementById("cs-edit-modal-overlay");r&&r.remove(),r=document.createElement("div"),r.id="cs-edit-modal-overlay",r.style.cssText="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:9999; display:flex; justify-content:center; align-items:center;";const y=document.createElement("div");y.style.cssText="width: 500px; max-width: 90vw; max-height: 85vh; background:var(--color-bg-base, #11151f); border:1px solid var(--color-border, #444); border-radius: 8px; display:flex; flex-direction:column; box-shadow: 0 4px 16px rgba(0,0,0,0.8);";const l=document.createElement("div");l.style.cssText="padding:12px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-dark); border-radius: 8px 8px 0 0;";const N=s.isCustomNpc?"Edit Custom NPC":s.isCompanion?"Edit Companion":"Edit Creature";l.innerHTML=`
        <h3 style="margin:0; font-family:var(--font-heading); color:var(--color-gold-base);">${N}</h3>
        <div>
            <button class="btn btn-sm btn-primary" id="cs-edit-save-btn">Save</button>
            <button class="btn btn-sm btn-secondary" id="cs-edit-cancel-btn">Cancel</button>
        </div>
    `;const c=document.createElement("div");c.id="cs-edit-modal-content",c.style.cssText="flex:1; overflow-y:auto; padding:12px;",y.appendChild(l),y.appendChild(c),r.appendChild(y),document.body.appendChild(r);const G=s.name||e.name||"";s.tokenImages?typeof s.tokenImages=="string"?(s.tokenImages=[{url:s.tokenImages,name:"Imported Token"}],s.activeTokenIndex=0):Array.isArray(s.tokenImages)?s.tokenImages=s.tokenImages.map(t=>typeof t=="string"?{url:t,name:"Imported Token"}:t&&typeof t=="object"?t:{url:"",name:"Unknown"}):(s.tokenImages=[],s.activeTokenIndex=0):(s.tokenImages=[],s.activeTokenIndex=0),typeof s.activeTokenIndex!="number"&&(s.activeTokenIndex=0);let J=e.tokenImg||e.tokenUrl||e.imgUrl;if(!J&&typeof window<"u"&&window.Renderer?.monster?.getTokenUrl)try{J=window.Renderer.monster.getTokenUrl(e)}catch{}!J&&(e.source||e.name)&&(J=Ze(e)),J&&!s.defaultTokenDeleted&&(s.tokenImages.some(n=>n?.isDefault||(typeof n=="string"?n:n?.url)===J)||s.tokenImages.unshift({url:J,name:"Default Token",isDefault:!0}));const $=Array.isArray(e.ac)?e.ac[0]:e.ac,Z=typeof $=="object"?$.value??$.ac??e.primaryAc??10:$??e.primaryAc??10,p=(typeof e.hp=="number"?e.hp:e.hp?.average)||s.hpMax||0,S=e.hp?.formula||"",m=e.save||{},j=e.skill||e.skills||{},B=e.cr?typeof e.cr=="object"?e.cr.cr||e.cr.coven||e.cr.lair||"0":e.cr:"0",z=Re(B),O=t=>{const n=t.toLowerCase().replace(/[\s_-]/g,"");for(const[i,u]of Object.entries(j))if(i.toLowerCase().replace(/[\s_-]/g,"")===n)return typeof u=="string"?u.trim():String(u);return""},K=DND_5E_SKILLS.map(t=>{const n=e[t.ability]??10,i=Math.floor((n-10)/2),u=O(t.key),o=u?parseInt(u.replace(/^\+/,"")):NaN,x=!isNaN(o)&&o===i+z,v=!isNaN(o)&&o===i+2*z;return`
            <div class="cs-edit-skill-row" data-skill="${t.key}" data-ability="${t.ability}" style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); padding:4px 8px; border-radius:4px; gap:6px;">
                <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <span style="font-size:0.8rem; font-weight:600; color:var(--color-text-primary);">${t.name}</span>
                    <span style="font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase; margin-left:3px;">(${t.ability})</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="display:inline-flex; align-items:center; gap:2px; font-size:0.7rem; color:var(--color-text-secondary); cursor:pointer;" title="Proficient (+${z})">
                        <input type="checkbox" class="cs-edit-skill-prof" data-skill="${t.key}" ${x?"checked":""}> P
                    </label>
                    <label style="display:inline-flex; align-items:center; gap:2px; font-size:0.7rem; color:var(--color-gold-base); cursor:pointer;" title="Expertise (+${z*2})">
                        <input type="checkbox" class="cs-edit-skill-exp" data-skill="${t.key}" ${v?"checked":""}> E
                    </label>
                    <input type="text" class="vtt-input cs-edit-skill-val" data-skill="${t.key}" style="width:44px; text-align:center; padding:2px 4px; font-size:0.8rem; height:24px;" value="${u}" placeholder="${i>=0?"+"+i:i}">
                </div>
            </div>
        `}).join(""),a=Array.isArray(e.size)?e.size[0]:e.size||"M",q={T:"Tiny",S:"Small",M:"Medium",L:"Large",H:"Huge",G:"Gargantuan"},T=q[a]?a:Object.keys(q).find(t=>q[t].toLowerCase()===String(a).toLowerCase())||"M";let M="",k="";typeof e.type=="string"?M=e.type.toLowerCase():typeof e.type=="object"&&e.type!==null&&(M=(e.type.type||"").toLowerCase(),Array.isArray(e.type.tags)?k=e.type.tags.join(", "):typeof e.type.tags=="string"&&(k=e.type.tags)),!k&&e.subtype&&(k=Array.isArray(e.subtype)?e.subtype.join(", "):e.subtype);const g=["aberration","beast","celestial","construct","dragon","elemental","fey","fiend","giant","humanoid","monstrosity","ooze","plant","undead"],L=g.includes(M),_=L?M:M?"custom":"humanoid",Q=L?"":M;let A="U",te="";if(Array.isArray(e.alignment)){if(e.alignment.length===2&&typeof e.alignment[0]=="string"&&typeof e.alignment[1]=="string"){const t=(e.alignment[0]+e.alignment[1]).toUpperCase();["LG","NG","CG","LN","CN","LE","NE","CE"].includes(t)?A=t:(A="custom",te=e.alignment.join(" "))}else if(e.alignment.length===1&&typeof e.alignment[0]=="string"){const t=e.alignment[0].toUpperCase();t==="N"||t==="NX"||t==="NY"?A="N":t==="U"?A="U":t==="A"?A="A":(A="custom",te=e.alignment[0])}else if(e.alignment.length>0){A="custom";try{te=typeof Parser<"u"&&Parser.alignmentListToFull?Parser.alignmentListToFull(e.alignment):JSON.stringify(e.alignment)}catch{te=e.alignment.join(" ")}}}else if(typeof e.alignment=="string"){const t=e.alignment.toLowerCase(),n={"lawful good":"LG","neutral good":"NG","chaotic good":"CG","lawful neutral":"LN","true neutral":"N",neutral:"N","chaotic neutral":"CN","lawful evil":"LE","neutral evil":"NE","chaotic evil":"CE",unaligned:"U","any alignment":"A"};n[t]?A=n[t]:(A="custom",te=e.alignment)}let re="";if(e.senses){if(typeof e.senses=="string")re=e.senses;else if(Array.isArray(e.senses))re=e.senses.join(", ");else if(typeof e.senses=="object"){const t=[];e.senses.sensesString&&t.push(e.senses.sensesString),["darkvision","blindsight","truesight","tremorsense","devilSight"].forEach(i=>{if(e.senses[i]&&!e.senses.sensesString?.toLowerCase().includes(i.toLowerCase())){const u=i==="devilSight"?"devil's sight":i;t.push(`${u} ${e.senses[i]} ft.`)}});const n=e.senses.passivePerception||e.senses.passive||e.passive;n!=null&&n!==""&&t.push(`passive Perception ${n}`),t.length>0?re=t.join(", "):re=Object.entries(e.senses).filter(([i])=>i!=="sensesString"&&i!=="passivePerception"&&i!=="passive").map(([i,u])=>`${i} ${u}`).join(", ")}}else e.passive&&(re=`passive Perception ${e.passive}`);let xe=`
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Identity</h4>
                <div style="display:flex; gap:12px; margin-bottom:8px;">
                    <div style="flex:1;">
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Name</label>
                        <input type="text" id="cs-edit-name" class="vtt-input" style="width:100%;" value="${G}">
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <label style="font-size:0.8rem;">Token Gallery <span style="font-weight:normal; color:var(--color-text-muted); margin-left:8px;">(Click active to deselect & use Bestiary art)</span></label>
                        <div style="display:flex; gap:4px;">
                            <input type="text" id="cs-edit-token-add-url" class="vtt-input vtt-input-sm" style="width:120px;" placeholder="Image URL">
                            <button class="btn btn-xs btn-secondary" id="cs-edit-token-add-btn"><i class="fa-solid fa-plus"></i></button>
                            <input type="file" id="cs-edit-token-file" style="display:none;" accept="image/*,video/*">
                            <button class="btn btn-xs btn-primary" id="cs-edit-token-upload-btn" title="Upload Media"><i class="fa-solid fa-upload"></i></button>
                        </div>
                    </div>
                    <div id="cs-edit-token-gallery" style="display:flex; gap:8px; flex-wrap:wrap; padding:8px; background:var(--color-bg-dark); border-radius:4px; min-height:80px;">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Size</label>
                        <select id="cs-edit-size" class="vtt-input" style="width:100%;">
                            <option value="T" ${T==="T"?"selected":""}>Tiny</option>
                            <option value="S" ${T==="S"?"selected":""}>Small</option>
                            <option value="M" ${T==="M"?"selected":""}>Medium</option>
                            <option value="L" ${T==="L"?"selected":""}>Large</option>
                            <option value="H" ${T==="H"?"selected":""}>Huge</option>
                            <option value="G" ${T==="G"?"selected":""}>Gargantuan</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Type</label>
                        <select id="cs-edit-type-select" class="vtt-input" style="width:100%;">
                            ${g.map(t=>`<option value="${t}" ${_===t?"selected":""}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join("")}
                            <option value="custom" ${_==="custom"?"selected":""}>Custom...</option>
                        </select>
                        <input type="text" id="cs-edit-type-custom" class="vtt-input" style="width:100%; margin-top:4px; display:${_==="custom"?"block":"none"};" placeholder="e.g. Swarm of Tiny beasts" value="${Q}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Tags / Subtype</label>
                        <input type="text" id="cs-edit-tags" class="vtt-input" style="width:100%;" value="${k}" placeholder="e.g. shapechanger, elf">
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Alignment</label>
                        <select id="cs-edit-align-select" class="vtt-input" style="width:100%;">
                            <option value="LG" ${A==="LG"?"selected":""}>Lawful Good</option>
                            <option value="NG" ${A==="NG"?"selected":""}>Neutral Good</option>
                            <option value="CG" ${A==="CG"?"selected":""}>Chaotic Good</option>
                            <option value="LN" ${A==="LN"?"selected":""}>Lawful Neutral</option>
                            <option value="N" ${A==="N"?"selected":""}>True Neutral</option>
                            <option value="CN" ${A==="CN"?"selected":""}>Chaotic Neutral</option>
                            <option value="LE" ${A==="LE"?"selected":""}>Lawful Evil</option>
                            <option value="NE" ${A==="NE"?"selected":""}>Neutral Evil</option>
                            <option value="CE" ${A==="CE"?"selected":""}>Chaotic Evil</option>
                            <option value="U" ${A==="U"?"selected":""}>Unaligned</option>
                            <option value="A" ${A==="A"?"selected":""}>Any Alignment</option>
                            <option value="custom" ${A==="custom"?"selected":""}>Custom...</option>
                        </select>
                        <input type="text" id="cs-edit-align-custom" class="vtt-input" style="width:100%; margin-top:4px; display:${A==="custom"?"block":"none"};" placeholder="e.g. Neutral Good (50%)" value="${te}">
                    </div>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Core Stats</h4>
                <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:8px;">
                    ${["str","dex","con","int","wis","cha"].map(t=>`
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${t}</label>
                            <input type="number" class="vtt-input cs-edit-stat" data-stat="${t}" style="width:100%;" value="${e[t]||10}">
                        </div>
                    `).join("")}
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Combat</h4>
                <div style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">AC</label>
                        <input type="number" id="cs-edit-ac" class="vtt-input" style="width:100%;" value="${Z}">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">HP (Avg)</label>
                        <input type="number" id="cs-edit-hp-avg" class="vtt-input" style="width:100%;" value="${p}">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">HP Formula</label>
                        <input type="text" id="cs-edit-hp-form" class="vtt-input" style="width:100%;" value="${S}" placeholder="e.g. 2d8+4">
                    </div>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Speeds (ft.)</h4>
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Walk</label>
                        <input type="number" id="cs-edit-speed-walk" class="vtt-input" style="width:100%;" value="${typeof e.speed=="number"?e.speed:typeof e.speed?.walk=="number"?e.speed.walk:parseInt(e.speed?.walk?.number??e.speed?.walk)??(e.speed?.walk===0?0:30)}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Fly</label>
                        <input type="number" id="cs-edit-speed-fly" class="vtt-input" style="width:100%;" value="${typeof e.speed?.fly=="number"?e.speed.fly:parseInt(e.speed?.fly?.number??e.speed?.fly)||0}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Swim</label>
                        <input type="number" id="cs-edit-speed-swim" class="vtt-input" style="width:100%;" value="${typeof e.speed?.swim=="number"?e.speed.swim:parseInt(e.speed?.swim?.number??e.speed?.swim)||0}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Burrow</label>
                        <input type="number" id="cs-edit-speed-burrow" class="vtt-input" style="width:100%;" value="${typeof e.speed?.burrow=="number"?e.speed.burrow:parseInt(e.speed?.burrow?.number??e.speed?.burrow)||0}">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Climb</label>
                        <input type="number" id="cs-edit-speed-climb" class="vtt-input" style="width:100%;" value="${typeof e.speed?.climb=="number"?e.speed.climb:parseInt(e.speed?.climb?.number??e.speed?.climb)||0}">
                    </div>
                </div>
                <div style="margin-top:6px;">
                    <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;">
                        <input type="checkbox" id="cs-edit-speed-hover" ${e.speed?.canHover?"checked":""}> Can Hover (Flight)
                    </label>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:var(--color-text-secondary);">Defenses & Senses</h4>
                    <button type="button" class="btn btn-secondary btn-xs" id="cs-btn-manage-defenses" style="display:inline-flex; align-items:center; gap:4px;">
                        <i class="fa-solid fa-shield-halved"></i> Manage Defenses
                    </button>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Damage Immunities</label>
                        <input type="text" id="cs-edit-immune" class="vtt-input" style="width:100%;" value="${pe(e.immune)}" placeholder="e.g. fire, poison; bludgeoning from nonmagical attacks">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Damage Resistances</label>
                        <input type="text" id="cs-edit-resist" class="vtt-input" style="width:100%;" value="${pe(e.resist)}" placeholder="e.g. cold, lightning">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Damage Vulnerabilities</label>
                        <input type="text" id="cs-edit-vuln" class="vtt-input" style="width:100%;" value="${pe(e.vulnerable)}" placeholder="e.g. radiant">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Condition Immunities</label>
                        <input type="text" id="cs-edit-cond" class="vtt-input" style="width:100%;" value="${Array.isArray(e.conditionImmune)?e.conditionImmune.join(", "):e.conditionImmune||""}" placeholder="e.g. charmed, frightened, poisoned">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Senses</label>
                        <input type="text" id="cs-edit-senses" class="vtt-input" style="width:100%;" value="${re}" placeholder="e.g. darkvision 60 ft., passive Perception 12">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Languages</label>
                        <input type="text" id="cs-edit-lang" class="vtt-input" style="width:100%;" value="${Array.isArray(e.languages)?e.languages.join(", "):e.languages||""}" placeholder="e.g. Common, Draconic">
                    </div>
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Saving Throws (Modifiers)</h4>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
                    ${["str","dex","con","int","wis","cha"].map(t=>`
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px; text-transform:uppercase;">${t}</label>
                            <input type="text" class="vtt-input cs-edit-save" data-ability="${t}" style="width:100%;" value="${m[t]||""}" placeholder="+0">
                        </div>
                    `).join("")}
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:var(--color-text-secondary);">Skills (Proficiency +${z})</h4>
                    <span style="font-size:0.7rem; color:var(--color-text-muted);">P = Proficient, E = Expertise</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:6px;">
                    ${K}
                </div>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Traits</h4>
                <div id="cs-edit-traits-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-trait">+ Add Trait</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Actions</h4>
                <div id="cs-edit-actions-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-action">+ Add Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Bonus Actions</h4>
                <div id="cs-edit-bonus-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-bonus">+ Add Bonus Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Reactions</h4>
                <div id="cs-edit-reactions-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-reaction">+ Add Reaction</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Legendary Actions</h4>
                <textarea id="cs-edit-legendary-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Legendary action description...">${typeof e.legendaryActions=="object"&&e.legendaryActions?e.legendaryActions.description||"":e.legendaryActions||""}</textarea>
                <div id="cs-edit-legendary-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-legendary">+ Add Legendary Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-text-secondary);">Lair Actions</h4>
                <textarea id="cs-edit-lair-desc" class="vtt-input mb-2" style="width:100%; height:60px;" placeholder="Lair action description...">${e.lairHeader||e.lairActionsDesc||e.lairActions?.header||""}</textarea>
                <div id="cs-edit-lair-list"></div>
                <button class="btn btn-xs btn-secondary mt-2" id="cs-edit-add-lair">+ Add Lair Action</button>
            </div>

            <div style="background:var(--color-bg-light); padding:12px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-wand-magic-sparkles"></i> Spellcasting Sections</h4>
                    <button class="btn btn-xs btn-secondary" id="cs-edit-add-spellcasting-block"><i class="fa-solid fa-plus"></i> Add Block</button>
                </div>
                <div id="cs-edit-spellcasting-blocks-list" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
        </div>
    `;c.innerHTML=xe;function ve(t){const n=c.querySelector(`.cs-edit-stat[data-stat="${t}"]`),i=n?parseInt(n.value)||10:e[t]||10;return Math.floor((i-10)/2)}c.querySelectorAll(".cs-edit-skill-row").forEach(t=>{const n=t.dataset.skill,i=t.dataset.ability,u=t.querySelector(".cs-edit-skill-prof"),o=t.querySelector(".cs-edit-skill-exp"),x=t.querySelector(".cs-edit-skill-val"),v=()=>{const h=ve(i);if(o.checked){const H=h+2*z;x.value=(H>=0?"+":"")+H}else if(u.checked){const H=h+z;x.value=(H>=0?"+":"")+H}else x.value=""};u.addEventListener("change",()=>{u.checked&&(o.checked=!1),v()}),o.addEventListener("change",()=>{o.checked&&(u.checked=!1),v()}),x.addEventListener("input",()=>{const h=x.value.trim();if(!h){u.checked=!1,o.checked=!1;return}const H=parseInt(h.replace(/^\+/,"")),E=ve(i);isNaN(H)||(H===E+2*z?(o.checked=!0,u.checked=!1):H===E+z?(u.checked=!0,o.checked=!1):(u.checked=!1,o.checked=!1))})}),c.querySelectorAll(".cs-edit-stat").forEach(t=>{t.addEventListener("input",()=>{const n=t.dataset.stat,i=ve(n);c.querySelectorAll(`.cs-edit-skill-row[data-ability="${n}"]`).forEach(u=>{const o=u.querySelector(".cs-edit-skill-prof"),x=u.querySelector(".cs-edit-skill-exp"),v=u.querySelector(".cs-edit-skill-val");if(v.placeholder=i>=0?`+${i}`:`${i}`,x.checked){const h=i+2*z;v.value=(h>=0?"+":"")+h}else if(o.checked){const h=i+z;v.value=(h>=0?"+":"")+h}})})});function ce(t,n){const i=c.querySelector("#"+t);i&&(i.innerHTML="",n&&Array.isArray(n)&&n.forEach(u=>{i.appendChild(createAbilityRow(u))}))}ce("cs-edit-traits-list",e.traits||e.trait),ce("cs-edit-actions-list",e.actions||e.action),ce("cs-edit-bonus-list",e.bonusActions||e.bonus),ce("cs-edit-reactions-list",e.reactions||e.reaction),ce("cs-edit-legendary-list",Array.isArray(e.legendaryActions)?e.legendaryActions:e.legendaryActions?.entries||e.legendary),ce("cs-edit-lair-list",Array.isArray(e.lairActions)?e.lairActions:Array.isArray(e.lairActions?.entries)?e.lairActions.entries:[]);function me(){const t=c.querySelector("#cs-edit-spellcasting-blocks-list");if(!t)return;t.innerHTML="",(e.spellcasting&&Array.isArray(e.spellcasting)?e.spellcasting:[]).forEach((i,u)=>{const o=document.createElement("div");o.className="cs-edit-sc-card",o.style.cssText="display:flex; flex-direction:column; gap:6px; padding:10px; background:var(--color-bg-dark); border-radius:6px; border:1px solid rgba(212,175,55,0.3); margin-bottom:8px;";const x=We(i,e),v=i.rechargeRule||(x==="pact"?"short_rest":"long_rest"),h=(i.ability||"int").toLowerCase(),H=i.casterLevel!==void 0?i.casterLevel:e.casterLevel||0,E=i.header||(Array.isArray(i.headerEntries)?i.headerEntries.join(`
`):i.description||i.desc||""),Y=[];if(x==="innate"){(i.will||i.atWill||i.innateObj?.will)&&Y.push(0);const W=i.daily||i.innateObj?.daily||{};for(const P in W){const V=parseInt(P);!isNaN(V)&&!Y.includes(V)&&Y.push(V)}Y.sort((P,V)=>P-V),Y.length===0&&Y.push(0)}o.innerHTML=`
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <input type="text" class="vtt-input sc-edit-name" value="${i.name||(x==="innate"?"Innate Spellcasting":"Spellcasting")}" placeholder="Block Name (e.g. Innate Spellcasting, Fey Heritage)" style="flex:1; font-weight:600; color:var(--color-gold-base);">
                    <button class="btn btn-xxs btn-danger sc-edit-del" title="Delete Block"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:8px;">
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Block Type</label>
                        <select class="vtt-input sc-edit-type" style="width:100%;">
                            <option value="innate" ${x==="innate"?"selected":""}>Innate / Usage-Based</option>
                            <option value="slot" ${x==="slot"?"selected":""}>Class / Slot-Based</option>
                            <option value="pact" ${x==="pact"?"selected":""}>Pact Magic</option>
                            <option value="custom" ${x==="custom"?"selected":""}>Custom</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Default Rest Rule</label>
                        <select class="vtt-input sc-edit-recharge" style="width:100%;">
                            <option value="long_rest" ${v==="long_rest"?"selected":""}>Long Rest (Daily)</option>
                            <option value="short_rest" ${v==="short_rest"?"selected":""}>Short Rest</option>
                            <option value="short_or_long" ${v==="short_or_long"?"selected":""}>Short or Long Rest</option>
                            <option value="none" ${v==="none"?"selected":""}>None / Special</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Casting Ability</label>
                        <select class="vtt-input sc-edit-ability" style="width:100%;">
                            <option value="int" ${h==="int"?"selected":""}>Intelligence</option>
                            <option value="wis" ${h==="wis"?"selected":""}>Wisdom</option>
                            <option value="cha" ${h==="cha"?"selected":""}>Charisma</option>
                            <option value="con" ${h==="con"?"selected":""}>Constitution</option>
                            <option value="str" ${h==="str"?"selected":""}>Strength</option>
                            <option value="dex" ${h==="dex"?"selected":""}>Dexterity</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Caster Level</label>
                        <input type="number" class="vtt-input sc-edit-caster-level" value="${H}" min="0" max="20" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Save DC (Opt)</label>
                        <input type="number" class="vtt-input sc-edit-dc" value="${i.dc||""}" placeholder="Auto" style="width:100%;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.75rem; color:var(--color-text-muted); margin-bottom:2px;">Atk Mod (Opt)</label>
                        <input type="text" class="vtt-input sc-edit-atk-mod" value="${i.atkMod!==void 0?i.atkMod:""}" placeholder="Auto" style="width:100%;">
                    </div>
                </div>

                <!-- Innate Sections Manager -->
                <div class="sc-edit-innate-box" style="display:${x==="innate"?"block":"none"}; margin-top:6px; padding:6px; background:rgba(0,0,0,0.2); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:0.75rem; font-weight:600; color:var(--color-gold-base);">Innate Frequency Sections</span>
                        <button type="button" class="btn btn-xxs btn-secondary sc-edit-add-section-btn" style="padding:1px 5px; font-size:0.7rem;"><i class="fa-solid fa-plus"></i> Add Section</button>
                    </div>
                    <div class="sc-edit-sections-list" style="display:flex; flex-direction:column; gap:4px;"></div>
                </div>

                <div class="sc-edit-slot-preview" style="display:${x!=="innate"?"block":"none"}; font-size:0.75rem; color:var(--color-text-muted); font-style:italic; margin-top:2px;"></div>

                <div style="margin-top:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <label style="font-size:0.75rem; color:var(--color-text-muted); margin:0;">Introductory / Component Notes</label>
                        <button type="button" class="btn btn-xxs btn-secondary sc-edit-autogen-header" style="padding:1px 6px; font-size:0.7rem;" title="Auto-generate standard 5e phrasing based on block settings">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-generate 5e Text
                        </button>
                    </div>
                    <textarea class="vtt-input sc-edit-header" rows="2" style="width:100%; resize:vertical; font-size:0.82rem; padding:4px 6px; box-sizing:border-box;" placeholder="e.g. The creature can innately cast the following spells, requiring no material components:">${E}</textarea>
                </div>
            `;const le=o.querySelector(".sc-edit-type"),se=o.querySelector(".sc-edit-innate-box"),X=o.querySelector(".sc-edit-sections-list"),Ue=o.querySelector(".sc-edit-add-section-btn"),Ee=o.querySelector(".sc-edit-slot-preview"),Ie=o.querySelector(".sc-edit-caster-level"),ze=o.querySelector(".sc-edit-autogen-header"),Me=o.querySelector(".sc-edit-header");ze&&Me&&ze.addEventListener("click",()=>{const W=o.querySelector(".sc-edit-name")?.value?.trim()||"Spellcasting",P=le.value,V=o.querySelector(".sc-edit-ability")?.value||"int",ie=parseInt(Ie.value)||0,fe=o.querySelector(".sc-edit-dc")?.value?.trim(),ue=o.querySelector(".sc-edit-atk-mod")?.value?.trim(),ye=e.name||s.name||"The creature",Se={int:"Intelligence",wis:"Wisdom",cha:"Charisma",con:"Constitution",str:"Strength",dex:"Dexterity"}[V]||"Intelligence",Pe=e[V]??e.abilities?.[V]?.score??10,De=Math.floor((Pe-10)/2),Be=Re(e.cr?e.cr.cr||e.cr:"0"),Ve=8+Be+De,Ge=Be+De,Ae=fe!==""&&!isNaN(parseInt(fe))?parseInt(fe):Ve,be=ue!==""&&!isNaN(parseInt(ue))?parseInt(ue):Ge,Ce=be>=0?"+":"";let he="";if(P==="innate"||/innate|psionic/i.test(W)){const $e=/psionic/i.test(W)?"requiring no spell components":"requiring no material components";he=`${ye}'s innate spellcasting ability is ${Se} (spell save DC ${Ae}${be!=null?`, ${Ce}${be} to hit with spell attacks`:""}). ${ye} can innately cast the following spells, ${$e}:`}else if(P==="pact")he=`${ye} is a ${ie?`${ie}th-level`:""} warlock spellcaster. Its spellcasting ability is ${Se} (spell save DC ${Ae}, ${Ce}${be} to hit with spell attacks). ${ye} has the following warlock spells prepared:`;else{const $e=["","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th","13th","14th","15th","16th","17th","18th","19th","20th"][ie]||(ie?`${ie}th`:"");$e?he=`${ye} is a ${$e}-level spellcaster. Its spellcasting ability is ${Se} (spell save DC ${Ae}, ${Ce}${be} to hit with spell attacks). ${ye} has the following wizard spells prepared:`:he=`${ye}'s spellcasting ability is ${Se} (spell save DC ${Ae}, ${Ce}${be} to hit with spell attacks). ${ye} has the following spells prepared:`}Me.value=he});function Te(){const W=le.value,P=parseInt(Ie.value)||0;if(W==="innate"){Ee.style.display="none";return}Ee.style.display="block";const V=Je(W,P),ie=Object.entries(V).map(([fe,ue])=>`${fe.replace("level","L")}: ${ue}`).join(", ");Ee.textContent=ie?`Auto-calculated slots: ${ie}`:"No auto spell slots for level 0."}function we(W=0){const P=document.createElement("div");P.className="sc-edit-section-row",P.style.cssText="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);";const V=parseInt(W)===0;P.innerHTML=`
                    <span style="font-size:0.75rem; color:var(--color-text-muted); width:70px;">Usage Count:</span>
                    <div style="display:flex; align-items:center; gap:6px; flex:1;">
                        <input type="number" class="vtt-input sc-edit-section-counter" value="${W}" min="0" max="9" style="width:52px; text-align:center; padding:2px 4px; font-weight:bold;">
                        <span class="sc-edit-section-label" style="font-size:0.75rem; color:var(--color-gold-base); font-weight:600;">${V?"At Will (0)":`${W}/Day`}</span>
                    </div>
                    <button type="button" class="btn btn-xxs btn-danger sc-edit-section-del" title="Remove Section"><i class="fa-solid fa-trash"></i></button>
                `;const ie=P.querySelector(".sc-edit-section-counter"),fe=P.querySelector(".sc-edit-section-label");ie.addEventListener("input",()=>{const ue=parseInt(ie.value)||0;fe.textContent=ue===0?"At Will (0)":`${ue}/Day`}),P.querySelector(".sc-edit-section-del").addEventListener("click",()=>P.remove()),X.appendChild(P)}x==="innate"&&Y.forEach(W=>we(W)),Ue.addEventListener("click",()=>{const W=X.querySelectorAll(".sc-edit-section-counter"),P=Array.from(W).map(V=>parseInt(V.value)||0);if(!P.includes(0))we(0);else{let V=1;for(;P.includes(V)&&V<10;)V++;we(V)}}),le.addEventListener("change",()=>{const W=le.value==="innate";se.style.display=W?"block":"none",W&&X.children.length===0&&we(0),Te()}),Ie.addEventListener("input",Te),Te(),o.querySelector(".sc-edit-del").addEventListener("click",()=>o.remove()),t.appendChild(o)})}me(),c.querySelector("#cs-edit-add-spellcasting-block").addEventListener("click",()=>{e.spellcasting=e.spellcasting||[],e.spellcasting.push({name:"Innate Spellcasting",type:"innate",ability:"cha",casterLevel:0,header:"",headerEntries:[],will:[]}),me()});function ae(t,n){c.querySelector("#"+t).addEventListener("click",()=>{const i=createAbilityRow({});c.querySelector("#"+n).appendChild(i)})}ae("cs-edit-add-trait","cs-edit-traits-list"),ae("cs-edit-add-action","cs-edit-actions-list"),ae("cs-edit-add-bonus","cs-edit-bonus-list"),ae("cs-edit-add-reaction","cs-edit-reactions-list"),ae("cs-edit-add-legendary","cs-edit-legendary-list"),ae("cs-edit-add-lair","cs-edit-lair-list");function ee(){const t=c.querySelector("#cs-edit-token-gallery");if(t){if(t.innerHTML="",s.tokenImages.length===0){t.innerHTML='<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No custom tokens.</span>';return}s.tokenImages.forEach((n,i)=>{const u=s.activeTokenIndex===i,o=n.url||"",v=o.split("?")[0].toLowerCase().match(/\.(mp4|webm|ogg)$/i),h=document.createElement("div");h.style.cssText=`position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${u?"var(--color-success-base)":"transparent"}; cursor:pointer;`;const H=typeof window<"u"&&typeof window.getSafeVttUrl=="function"?window.getSafeVttUrl(o):o&&(o.includes("discordapp.com")||o.includes("discordapp.net"))?"/api/proxy-discord?url="+encodeURIComponent(o):o;let E;if(v?(E=document.createElement("video"),E.src=H,E.muted=!0,E.loop=!0,E.autoplay=!0,E.playsInline=!0,E.style.cssText="width:100%; height:100%; object-fit:cover; display:block;"):(E=document.createElement("img"),E.src=H,E.title=n.name||"Token",E.style.cssText="width:100%; height:100%; object-fit:cover; display:block;"),h.appendChild(E),u){const se=document.createElement("div");se.style.cssText="position:absolute; top:2px; right:2px; background:var(--color-success-base); color:var(--color-on-success, #fff); border-radius:50%; width:16px; height:16px; font-size:0.6rem; display:flex; align-items:center; justify-content:center;",se.innerHTML='<i class="fa-solid fa-check"></i>',h.appendChild(se)}const Y=document.createElement("button");Y.className="btn btn-secondary btn-xxs",Y.style.cssText="position:absolute; bottom:2px; left:2px; padding:2px 4px;",Y.title="Crop / Frame Token Art",Y.innerHTML='<i class="fa-solid fa-crop"></i>',h.appendChild(Y),Y.addEventListener("click",se=>{se.stopPropagation(),!(Ne(n.url,n.name)&&!confirm("Cropping an animated token will freeze its animation into a static frame. Do you want to continue?"))&&qe({sourceUrl:n.originalUrl||n.url,initialFraming:n.framing||{},initialBorder:s.tokenBorder||{shape:"circle",style:"solid",color:"#eab308",width:3},tokenName:s.name||"Creature",onSave:X=>{n.url=X.url,n.originalUrl=X.originalUrl,n.framing=X.framing,X.border&&(s.tokenBorder=X.border),s.activeTokenIndex=i,ee()}})});const le=document.createElement("button");le.className="btn btn-danger btn-xxs",le.style.cssText="position:absolute; bottom:2px; right:2px; padding:2px 4px;",le.innerHTML='<i class="fa-solid fa-trash"></i>',h.appendChild(le),h.addEventListener("click",se=>{se.target.closest("button")||(s.activeTokenIndex===i?s.activeTokenIndex=-1:s.activeTokenIndex=i,ee())}),le.addEventListener("click",se=>{se.stopPropagation();const X=s.tokenImages[i];(X?.isDefault||J&&(typeof X=="string"?X:X?.url)===J)&&(s.defaultTokenDeleted=!0),s.tokenImages.splice(i,1),s.activeTokenIndex>=s.tokenImages.length?s.activeTokenIndex=Math.max(0,s.tokenImages.length-1):s.activeTokenIndex>i&&s.activeTokenIndex--,ee()}),t.appendChild(h),v&&E.play().catch(()=>{})})}}ee(),c.querySelector("#cs-edit-token-add-btn").addEventListener("click",()=>{const t=c.querySelector("#cs-edit-token-add-url"),n=t.value.trim();if(n){t.value="";const i=()=>{s.tokenImages.push({url:n,originalUrl:n,name:"URL Media"}),s.activeTokenIndex=s.tokenImages.length-1,ee()},u=()=>{qe({sourceUrl:n,tokenName:s.name||"Creature",initialBorder:s.tokenBorder||{shape:"circle",style:"solid",color:"#eab308",width:3},onSave:o=>{s.tokenImages.push({url:o.url,originalUrl:o.originalUrl,framing:o.framing,name:"URL Media"}),o.border&&(s.tokenBorder=o.border),s.activeTokenIndex=s.tokenImages.length-1,ee()}})};Ne(n)?He({url:n,fileName:n,onDirect:i,onCrop:u}):u()}});const ke=c.querySelector("#cs-edit-token-file"),de=c.querySelector("#cs-edit-token-upload-btn");de.addEventListener("click",()=>ke.click()),ke.addEventListener("change",async t=>{const n=t.target.files[0];if(!n)return;const i=new FormData;i.append("file",n);const u=de.innerHTML;de.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>',de.disabled=!0;const o=typeof window<"u"&&typeof window.vttAuthHeaders=="function"?window.vttAuthHeaders():window.VTT?.gmSessionToken?{"x-gm-token":window.VTT.gmSessionToken}:{};try{const x=await fetch("/api/assets/upload",{method:"POST",headers:o,body:i});if(x.ok){const v=await x.json(),h=()=>{s.tokenImages.push({url:v.url,originalUrl:v.url,name:n.name}),s.activeTokenIndex=s.tokenImages.length-1,ee()},H=()=>{qe({sourceUrl:v.url,tokenName:s.name||"Creature",initialBorder:s.tokenBorder||{shape:"circle",style:"solid",color:"#eab308",width:3},onSave:E=>{s.tokenImages.push({url:E.url,originalUrl:E.originalUrl,framing:E.framing,name:n.name}),E.border&&(s.tokenBorder=E.border),s.activeTokenIndex=s.tokenImages.length-1,ee()}})};Ne(v.url,n.name)?He({url:v.url,fileName:n.name,onDirect:h,onCrop:H}):H()}else{const v=await x.json().catch(()=>null);alert("Upload failed: "+(v?.error||x.statusText||"Server error"))}}catch(x){alert("Error: "+x.message)}finally{de.innerHTML=u,de.disabled=!1,t.target.value=""}});const d=c.querySelector("#cs-edit-type-select"),w=c.querySelector("#cs-edit-type-custom");d.addEventListener("change",()=>{w.style.display=d.value==="custom"?"block":"none"});const D=c.querySelector("#cs-edit-align-select"),f=c.querySelector("#cs-edit-align-custom");D.addEventListener("change",()=>{f.style.display=D.value==="custom"?"block":"none"});const R=()=>JSON.stringify(Array.from(c.querySelectorAll("input, select, textarea")).map(t=>t.type==="checkbox"?t.checked:t.value)),U=R(),F=(t=!1)=>{!t&&R()!==U&&!confirm("Discard unsaved changes?")||(typeof window<"u"&&window.removeEventListener("keydown",ne),r.remove())},ne=t=>{(t.key==="Escape"||t.keyCode===27)&&F(!1)};typeof window<"u"&&window.addEventListener("keydown",ne),r.addEventListener("click",t=>{t.target===r&&F(!1)});const ge=c.querySelector("#cs-btn-manage-defenses");ge&&ge.addEventListener("click",t=>{t.preventDefault(),t.stopPropagation(),openCreatureDefenseConfigModal(oe,n=>{oe=n;const i=c.querySelector("#cs-edit-resist");i&&(i.value=pe(editableRowsToDefenses(oe.resist)));const u=c.querySelector("#cs-edit-immune");u&&(u.value=pe(editableRowsToDefenses(oe.immune)));const o=c.querySelector("#cs-edit-vuln");o&&(o.value=pe(editableRowsToDefenses(oe.vulnerable)))})}),r.querySelector("#cs-edit-cancel-btn").onclick=()=>F(!1),r.querySelector("#cs-edit-save-btn").onclick=()=>{typeof window<"u"&&window.removeEventListener("keydown",ne),saveCompanionEdits(e,I,b)}}export function saveCompanionEdits(e,I=null,b={}){const C=I||je;if(!C)return;const s=b.getVtt?b.getVtt():typeof window<"u"?window.VTT:null,r=s?.campaignState?.characters?.[C];if(!r)return;const y=document.getElementById("cs-edit-modal-overlay"),l=document.getElementById("cs-edit-modal-content");if(!l)return;const N=l.querySelector("#cs-edit-name").value.trim(),c=parseInt(l.querySelector("#cs-edit-ac").value)||10,G=parseInt(l.querySelector("#cs-edit-hp-avg").value)||0,J=l.querySelector("#cs-edit-hp-form").value.trim();r.name=N,e.name=N;const $=l.querySelector("#cs-edit-size").value;e.size=[$];const Z=l.querySelector("#cs-edit-type-select").value,p=l.querySelector("#cs-edit-type-custom").value.trim(),S=l.querySelector("#cs-edit-tags").value.trim();let m=Z==="custom"?p||"humanoid":Z,j=S?S.split(",").map(d=>d.trim()).filter(Boolean):[];j.length>0?e.type={type:m,tags:j}:e.type=m;const B=l.querySelector("#cs-edit-align-select").value,z=l.querySelector("#cs-edit-align-custom").value.trim();if(B==="custom"?e.alignment=z?[z]:["U"]:B==="LG"?e.alignment=["L","G"]:B==="NG"?e.alignment=["N","G"]:B==="CG"?e.alignment=["C","G"]:B==="LN"?e.alignment=["L","N"]:B==="N"?e.alignment=["N"]:B==="CN"?e.alignment=["C","N"]:B==="LE"?e.alignment=["L","E"]:B==="NE"?e.alignment=["N","E"]:B==="CE"?e.alignment=["C","E"]:B==="U"?e.alignment=["U"]:B==="A"&&(e.alignment=["A"]),r.ac=c,r.primaryAc=c,e.primaryAc=c,Array.isArray(e.ac)?typeof e.ac[0]=="object"&&e.ac[0]!==null?(e.ac[0].value=c,e.ac[0].ac=c):e.ac=[{value:c,ac:c}]:typeof e.ac=="object"&&e.ac!==null?(e.ac.value=c,e.ac.ac=c):e.ac=[{value:c,ac:c}],e.hp=e.hp||{},e.hp.average=G,e.hp.formula=J,r.hpMax!==G){if(r.hpMax>0){const d=r.hpCurrent/r.hpMax;r.hpCurrent=Math.max(1,Math.floor(G*d))}else r.hpCurrent=G;r.hpMax=G}l.querySelectorAll(".cs-edit-stat").forEach(d=>{const w=d.dataset.stat;e[w]=parseInt(d.value)||10});const O=l.querySelector("#cs-edit-speed-walk"),K=l.querySelector("#cs-edit-speed-fly"),a=l.querySelector("#cs-edit-speed-swim"),q=l.querySelector("#cs-edit-speed-climb"),T=l.querySelector("#cs-edit-speed-burrow"),M=l.querySelector("#cs-edit-speed-hover");if(O||K||a||q||T){const d=O?parseInt(O.value):30,w=K?parseInt(K.value):0,D=a?parseInt(a.value):0,f=q?parseInt(q.value):0,R=T?parseInt(T.value):0,U=M?M.checked:!1,F={walk:isNaN(d)?30:d};!isNaN(w)&&w>0&&(F.fly=w),!isNaN(D)&&D>0&&(F.swim=D),!isNaN(f)&&f>0&&(F.climb=f),!isNaN(R)&&R>0&&(F.burrow=R),U&&(F.canHover=!0),e.speed=F,r.speed=F}if(oe){const d=l.querySelector("#cs-edit-immune").value.trim(),w=editableRowsToDefenses(oe.immune);d===""?delete e.immune:d===pe(w)?(e.immune=w.length>0?w:void 0,e.immune||delete e.immune):(e.immune=parseDefenseTextInput(d,w),(!e.immune||e.immune.length===0)&&delete e.immune);const D=l.querySelector("#cs-edit-resist").value.trim(),f=editableRowsToDefenses(oe.resist);D===""?delete e.resist:D===pe(f)?(e.resist=f.length>0?f:void 0,e.resist||delete e.resist):(e.resist=parseDefenseTextInput(D,f),(!e.resist||e.resist.length===0)&&delete e.resist);const R=l.querySelector("#cs-edit-vuln").value.trim(),U=editableRowsToDefenses(oe.vulnerable);R===""?delete e.vulnerable:R===pe(U)?(e.vulnerable=U.length>0?U:void 0,e.vulnerable||delete e.vulnerable):(e.vulnerable=parseDefenseTextInput(R,U),(!e.vulnerable||e.vulnerable.length===0)&&delete e.vulnerable)}const k=l.querySelector("#cs-edit-cond").value.trim();k?e.conditionImmune=k.split(",").map(d=>d.trim()):delete e.conditionImmune;const g=l.querySelector("#cs-edit-senses").value.trim();if(g){e.senses=g.split(",").map(w=>w.trim());let d=0;if(typeof window<"u"&&window.parseMonsterVision)d=window.parseMonsterVision({senses:e.senses});else{const w=g.match(/(?:darkvision|blindsight|truesight|tremorsense|devil(?:'s)?\s*sight)\s*(\d+)/gi);w&&w.forEach(D=>{const f=parseInt(D.match(/\d+/)?.[0]||0);f>d&&(d=f)})}r.tokenSight=d>0?d:5}else delete e.senses,r.tokenSight=5;const L=l.querySelector("#cs-edit-lang").value.trim();L?e.languages=L.split(",").map(d=>d.trim()):delete e.languages;const _={};l.querySelectorAll(".cs-edit-save").forEach(d=>{const w=d.value.trim();w&&(_[d.dataset.ability]=w)}),Object.keys(_).length>0?e.save=_:delete e.save;const Q={};l.querySelectorAll(".cs-edit-skill-val").forEach(d=>{const w=d.value.trim();if(w){const D=/^[+-]/.test(w)?w:`+${w}`;Q[d.dataset.skill]=D}}),Object.keys(Q).length>0?e.skill=Q:delete e.skill,delete e.skills;function A(d){const w=l.querySelectorAll("#"+d+" > div"),D=[];return w.forEach(f=>{const R=f.querySelector(".edit-ab-name")?.value.trim()||"",U=f.querySelector(".edit-ab-desc")?.value.trim()||"",F=f.querySelector(".edit-ab-atk")?.value.trim()||"",ne=f.querySelector(".edit-ab-dc")?.value.trim()||"",ge=f.querySelector(".edit-ab-save-ab")?.value.trim()||"dex",t=f.querySelectorAll(".edit-ab-dmg-row"),n=[];t.forEach(x=>{const v=x.querySelector(".edit-ab-dmg-formula")?.value.trim(),h=x.querySelector(".edit-ab-dmg-type")?.value.trim()||"Slashing",H=x.querySelector(".edit-ab-dmg-rider")?.checked||!1,E=Le.find(Y=>Y.toLowerCase()===h.toLowerCase())||h.charAt(0).toUpperCase()+h.slice(1).toLowerCase();v&&n.push({formula:v,type:E,saveRider:H})});const i=f.querySelector(".edit-ab-is-magic")?.checked||!1,u=f.querySelector(".edit-ab-is-silvered")?.checked||!1,o=f.querySelector(".edit-ab-is-adamantine")?.checked||!1;if(R||U||F||ne||n.length>0||i||u||o){const x={name:R,entries:U?U.split(`
`):[]},v={};let h=!1;const H=F!==""?parseInt(F.replace(/^\+/,"")):NaN;isNaN(H)||(v.isAttack=!0,v.attackBonus=H,h=!0);const E=ne!==""?parseInt(ne):NaN;isNaN(E)||(v.save={dc:E,ability:ge.toLowerCase()},h=!0),n.length>0&&(v.damages=n,h=!0),(h||i||u||o)&&(v.isMagic=i,v.isSilvered=u,v.isAdamantine=o,h=!0),h&&(x.macro=v),D.push(x)}}),D.length>0?D:void 0}const te=A("cs-edit-traits-list");te?e.traits=te:delete e.traits,delete e.trait;const re=A("cs-edit-actions-list");re?e.actions=re:delete e.actions,delete e.action;const xe=A("cs-edit-bonus-list");xe?e.bonusActions=xe:delete e.bonusActions,delete e.bonus;const ve=A("cs-edit-reactions-list");ve?e.reactions=ve:delete e.reactions,delete e.reaction;const ce=l.querySelector("#cs-edit-legendary-desc").value.trim(),me=A("cs-edit-legendary-list");me||ce?e.legendaryActions={description:ce,entries:me||[]}:delete e.legendaryActions,delete e.legendary;const ae=l.querySelector("#cs-edit-lair-desc").value.trim(),ee=A("cs-edit-lair-list");ee&&ee.length>0?(e.lairActions=ee,ae?(e.lairActionsDesc=ae,e.lairHeader=ae):(delete e.lairActionsDesc,delete e.lairHeader)):(delete e.lairActions,delete e.lairActionsDesc,delete e.lairHeader);const ke=l.querySelectorAll("#cs-edit-spellcasting-blocks-list .cs-edit-sc-card"),de=[];if(ke.forEach((d,w)=>{const D=d.querySelector(".sc-edit-name").value.trim()||"Spellcasting",f=d.querySelector(".sc-edit-type").value,R=d.querySelector(".sc-edit-recharge").value,U=d.querySelector(".sc-edit-ability").value,F=parseInt(d.querySelector(".sc-edit-caster-level").value)||0,ne=d.querySelector(".sc-edit-dc").value.trim(),ge=d.querySelector(".sc-edit-atk-mod").value.trim(),t=e.spellcasting&&e.spellcasting[w]?e.spellcasting[w]:{},n=d.querySelector(".sc-edit-header")?.value?.trim()||"",i={id:t.id||`sc_${w}`,name:D,type:f,rechargeRule:R,ability:U,casterLevel:F,header:n,headerEntries:n?[n]:[]};t.footer&&(i.footer=t.footer),t.footerEntries&&(i.footerEntries=t.footerEntries),f==="slot"||f==="pact"?(i.spellsByLevel=t.spellsByLevel||{},i.spellsObj=t.spellsObj||{}):f==="innate"&&(i.will=[],i.daily={},d.querySelectorAll(".sc-edit-section-row").forEach(o=>{const x=parseInt(o.querySelector(".sc-edit-section-counter").value)||0;if(x===0)i.will=t.will||t.innateObj?.will||[];else{const v=x.toString();i.daily[v]=t.daily&&t.daily[v]||t.innateObj?.daily&&t.innateObj.daily[v]||[]}}),i.innateObj={will:i.will,daily:i.daily}),ne!==""?i.dc=parseInt(ne)||void 0:delete i.dc,ge!==""?i.atkMod=parseInt(ge)||void 0:delete i.atkMod,w===0&&(e.casterLevel=F),de.push(i)}),e.spellcasting=de,e.spells=null,r.monsterData=e,s&&s.socket&&s.socket.emit("character:update",{character:r}),s?.canvasEngine){const d=s.canvasEngine.getTokens();let w=!1;const D=r.tokenImages&&r.activeTokenIndex!==-1&&r.tokenImages[r.activeTokenIndex]?.url?r.tokenImages[r.activeTokenIndex].url:null;if(Object.values(d).forEach(f=>{if((f.characterId===r.id||f.sourceCharacterId===r.id||f.name===r.name&&!f.isPlayer)&&(r.tokenSight!==void 0&&(f.sightRange=r.tokenSight,w=!0),D)){f.img=D;const U=D.split("?")[0].toLowerCase();f.isGif=U.endsWith(".gif"),f.isVideo=!f.isGif&&(U.endsWith(".mp4")||U.endsWith(".webm")||U.endsWith(".ogg")),w=!0}}),w){const f=s.canvasEngine.getCurrentMapId();f&&s.socket&&Object.values(d).forEach(R=>{(R.characterId===r.id||R.sourceCharacterId===r.id||R.name===r.name&&!R.isPlayer)&&s.socket.emit("token:update",{mapId:f,token:R})}),s.canvasEngine.renderAll()}}window.VTT?.renderCustomNpcList&&window.VTT.renderCustomNpcList(),y&&y.remove(),b.renderStatBlock&&b.renderStatBlock(e),b.saveAndRenderNpcSpells&&b.saveAndRenderNpcSpells(e)}
