import{escapeHtml as w}from"../../vtt-utils.js";export function parseItemEntry(e,n,r){if(!e)return"";if(typeof e=="string"){let s=e.replace(/{@\w+ ([^|}]+)[^}]*}/g,"$1");return s=s.replace(/{=([^}]+)}/g,(l,p)=>n&&n[p]!==void 0?n[p]:n&&n.inherits&&n.inherits[p]!==void 0?n.inherits[p]:l),s=s.replace(/\{#itemEntry ([^|}]+)[^}]*\}/g,(l,p)=>{if(n&&n.resist&&p.includes("Resistance")){const d=p.split(" ")[0].toLowerCase();return`You have resistance to ${n.resist.join(" and ")} damage while you wear or use this ${d}.`}const a=r?r.find(d=>d.name===p):null;return a&&a.entries?parseItemEntry(a.entries,a,r):a&&a.inherits&&a.inherits.entries?parseItemEntry(a.inherits.entries,a,r):`See *${p}*`}),s}return Array.isArray(e)?e.map(s=>parseItemEntry(s,n,r)).filter(Boolean).join(`

`):e.type==="list"&&e.items?e.items.map(s=>"- "+parseItemEntry(s,n,r)).filter(Boolean).join(`
`):e.entries?(e.name?`**${e.name}.** `:"")+parseItemEntry(e.entries,n,r):e.type==="table"?"[Table]":""}export function buildItemMechanicalText(e){let n=[];const r={M:"Melee Weapon",R:"Ranged Weapon",LA:"Light Armor",MA:"Medium Armor",HA:"Heavy Armor",S:"Shield",W:"Wondrous Item",P:"Potion",RG:"Ring",RD:"Rod",ST:"Staff",WD:"Wand",SC:"Scroll"},s={V:"Versatile",F:"Finesse",L:"Light",H:"Heavy","2H":"Two-Handed",T:"Thrown",A:"Ammunition",R:"Reach",S:"Special",LD:"Loading"},l={S:"slashing",P:"piercing",B:"bludgeoning",C:"cold",F:"fire",L:"lightning",O:"force",N:"necrotic",R:"radiant",T:"thunder",Y:"psychic",A:"acid",I:"poison"},p=r[e.type]||e.type||e.weaponCategory||"Item",a=e.rarity?`, ${e.rarity}`:"",d=e.reqAttune?" (requires attunement)":"";if(n.push(`*${p}${a}${d}*`),e.ac){let i=String(e.ac);e.type==="LA"&&(i+=" + Dex modifier"),e.type==="MA"&&(i+=" + Dex modifier (max 2)"),n.push(`**Armor Class:** ${i}`)}if(e.dmg1){const i=l[e.dmgType]||e.dmgType||"";let t=`**Damage:** ${e.dmg1} ${i}`;e.dmg2&&(t+=` (or ${e.dmg2} ${i} versatile)`),n.push(t)}if(e.property&&e.property.length>0){const i=e.property.map(t=>{const o=typeof t=="string"?t:t.uid||t.name||"",c=o.split("|")[0],u=s[c]||s[o]||c;return typeof t=="object"&&t.note?`${u} (${t.note})`:u}).filter(Boolean).join(", ");i&&n.push(`**Properties:** ${i}`)}return e.resist&&n.push(`**Resistance:** ${Array.isArray(e.resist)?e.resist.join(", "):e.resist}`),e.immune&&n.push(`**Immunity:** ${Array.isArray(e.immune)?e.immune.join(", "):e.immune}`),e.conditionImmune&&n.push(`**Condition Immunity:** ${Array.isArray(e.conditionImmune)?e.conditionImmune.join(", "):e.conditionImmune}`),n.length?n.join(`
`)+`
---
`:""}export function getItemFullDescription(e,n){if(!n)return e.descriptionMarkdown||e.descriptionHtml||"";const{items:r,fluffDict:s,ruleDict:l}=n;if(e.descriptionMarkdown)return e.descriptionMarkdown;let p=buildItemMechanicalText(e),a=[];const d=e.source||"";if(e._isVariant&&e.baseName){const t=(e.baseName+d).toLowerCase();let o=null;const c=r?r.find(u=>u.name===e.baseName):null;c&&c.entries&&c.entries.length?o=c.entries:s&&s[t]&&(o=s[t]),o&&a.push(parseItemEntry(o,e,r))}let i=e.entries||(e.inherits?e.inherits.entries:null);if(!i||i.length===0){const t=(e.name+d).toLowerCase();s&&s[t]&&(i=s[t])}return i&&a.push(parseItemEntry(i,e,r)),l&&(e.property&&e.property.length>0&&e.property.forEach(t=>{const c=(typeof t=="string"?t:t.uid||t.name||"").split("|")[0].toLowerCase();l.property[c]&&a.push(parseItemEntry(l.property[c],e,r))}),e.mastery&&e.mastery.length>0&&e.mastery.forEach(t=>{const c=(typeof t=="string"?t:t.uid||t.name||"").split("|")[0].toLowerCase();if(l.mastery[c]){const u={type:"entries",name:"Mastery: "+c.charAt(0).toUpperCase()+c.slice(1),entries:l.mastery[c]};a.push(parseItemEntry(u,e,r))}})),p+a.filter(Boolean).join(`

`)}export function renderItemPreview(e,n={}){const r=document.getElementById("pc-item-preview-pane");if(!r||!e)return;const{itemCache:s=null,getNormalizedRarity:l=()=>"common",getRarityBadgeHtml:p=()=>"",getDisplaySourceBadge:a=f=>f,updateItemSelectedCount:d=()=>{},setActivePreviewItem:i=()=>{}}=n;i(e);const t=(e.id||e.name+"::"+(e.source||"")).toLowerCase();document.querySelectorAll("#pc-item-tbody tr.pc-item-row").forEach(f=>{f.dataset.key===t?f.classList.add("is-active"):f.classList.remove("is-active")});const o=e.source||"",u=(o||"").toUpperCase()==="XPHB"||(o||"").toUpperCase()==="XDMG"?"#059669":(o||"").toUpperCase()==="PHB"?"#2563eb":"#475569",h=a(o)||o,m=l(e),$=p(m),S=e.type||e.weaponCategory||"Item",b=e.value?e.value/100+" gp":"\u2014",I=e.weight!==void 0&&e.weight!==null?`${e.weight} lb`:"\u2014",y=window._vttSelectedItemMap&&window._vttSelectedItemMap.has(t);let g="";e.descriptionHtml?g=e.descriptionHtml:g=getItemFullDescription(e,s).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^---\s*$/gm,"<hr>").replace(/\n\n/g,"<p></p>").replace(/\n/g,"<br>"),r.innerHTML=`
        <div class="pc-item-preview-header">
            <div class="pc-item-preview-title">
                <span>${w(e.name)}</span>
                ${o?`<span class="pc-item-source-badge" style="background:${u}; color:#fff;">${w(h)}</span>`:""}
            </div>
            <div class="pc-item-preview-meta">
                <span style="font-weight:600;">${w(S)}</span>
                <span>\u2022</span>
                ${$}
                ${e.reqAttune?'<span style="color:#d4af37;"><i class="fa-solid fa-ring"></i> Requires Attunement</span>':""}
            </div>
        </div>

        <div class="pc-item-preview-stats">
            <div class="pc-item-preview-stat-box">
                <span class="pc-item-preview-stat-label">Weight</span>
                <span class="pc-item-preview-stat-val">${I}</span>
            </div>
            <div class="pc-item-preview-stat-box">
                <span class="pc-item-preview-stat-label">Value</span>
                <span class="pc-item-preview-stat-val">${b}</span>
            </div>
            ${e.dmg1?`
                <div class="pc-item-preview-stat-box">
                    <span class="pc-item-preview-stat-label">Damage</span>
                    <span class="pc-item-preview-stat-val">${e.dmg1} ${e.dmgType||""}</span>
                </div>
            `:""}
            ${e.ac?`
                <div class="pc-item-preview-stat-box">
                    <span class="pc-item-preview-stat-label">Armor Class</span>
                    <span class="pc-item-preview-stat-val">${e.ac}</span>
                </div>
            `:""}
        </div>

        <div class="pc-item-preview-body">
            ${g}
        </div>

        <div style="margin-top:auto; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <button type="button" id="pc-preview-select-btn" class="btn ${y?"btn-secondary":"btn-primary"} btn-sm" style="flex:1;">
                <i class="fa-solid ${y?"fa-check":"fa-plus"}"></i> ${y?"Selected":"Select Item"}
            </button>
        </div>
    `,document.getElementById("pc-preview-select-btn")?.addEventListener("click",()=>{window._vttSelectedItemMap||(window._vttSelectedItemMap=new Map);const f=getItemFullDescription(e,s);window._vttSelectedItemMap.has(t)?window._vttSelectedItemMap.delete(t):window._vttSelectedItemMap.set(t,{name:e.name,weight:e.weight||"0",desc:f,source:e.source||"",itemId:e.id||"",catItem:e});const v=document.querySelector(`.pc-item-cb[data-key="${t}"]`);v&&(v.checked=window._vttSelectedItemMap.has(t)),d()})}
