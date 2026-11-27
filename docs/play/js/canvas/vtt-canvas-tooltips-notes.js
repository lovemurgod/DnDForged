import{CONDITION_ICONS as M}from"./tokens/vtt-canvas-token-rollers.js?v=mwzii5ci";import{escapeHtml as k}from"../vtt-utils.js?v=mwzii5ci";export function injectGmTooltipStyles(t=typeof document<"u"?document:null){if(!t||t.getElementById("vtt-gm-tooltip-styles"))return;const r=t.createElement("style");r.id="vtt-gm-tooltip-styles",r.textContent=`
        #vtt-gm-token-tooltip {
            position: fixed;
            z-index: 99999;
            width: 232px;
            background: rgba(12, 15, 24, 0.96);
            border: 1px solid rgba(212, 175, 55, 0.38);
            border-radius: 10px;
            box-shadow: 0 10px 36px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.04) inset;
            font-family: var(--font-primary, 'Inter', sans-serif);
            font-size: 12px;
            color: var(--color-text-primary, #e8e8ec);
            pointer-events: none;
            user-select: none;
            padding: 10px 12px 11px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            backdrop-filter: blur(8px);
            transition: opacity 0.1s ease;
        }
        #vtt-gm-token-tooltip .gm-tip-header {
            display: flex;
            align-items: center;
            gap: 7px;
            font-weight: 700;
            font-size: 13px;
            color: #d4af37;
            border-bottom: 1px solid rgba(212, 175, 55, 0.20);
            padding-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #vtt-gm-token-tooltip .gm-tip-row-primary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        #vtt-gm-token-tooltip .gm-tip-row-passives {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 4px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 6px;
        }
        #vtt-gm-token-tooltip .gm-tip-stat {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 6px;
            padding: 4px 6px;
            text-align: center;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-label {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8a90a0;
            margin-bottom: 1px;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-value {
            font-size: 15px;
            font-weight: 700;
            color: #fff;
            line-height: 1.1;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-value.sm {
            font-size: 11px;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-value.na {
            color: #555c70;
            font-weight: 400;
        }
        #vtt-gm-token-tooltip .gm-tip-conditions {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 5px;
        }
        #vtt-gm-token-tooltip .gm-tip-cond-label {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8a90a0;
            margin-bottom: 4px;
        }
        #vtt-gm-token-tooltip .gm-tip-cond-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        #vtt-gm-token-tooltip .gm-tip-cond-pill {
            background: rgba(231, 76, 60, 0.15);
            border: 1px solid rgba(231, 76, 60, 0.35);
            border-radius: 4px;
            padding: 2px 5px;
            font-size: 10px;
            font-weight: 600;
            color: #e74c3c;
            display: flex;
            align-items: center;
            gap: 3px;
        }
    `,t.head.appendChild(r)}export function getResolvedCreatureMonsterData(t,r={}){if(!t)return null;if(t.monsterData)return t.monsterData;const e=r.campaignState||(typeof window<"u"?window.VTT?.campaignState:null),o=t.characterId||t.sourceCharacterId;if(o&&e?.characters){const n=e.characters[o];if(n?.monsterData)return n.monsterData}return null}export function getTokenAC(t,r={}){if(!t)return null;if(t.ac!==void 0&&t.ac!==null&&t.ac!==""&&!isNaN(parseInt(t.ac,10)))return parseInt(t.ac,10);const e=getResolvedCreatureMonsterData(t,r);if(e){if(e.primaryAc!==void 0&&e.primaryAc!==null&&e.primaryAc!==""&&!isNaN(parseInt(e.primaryAc,10)))return parseInt(e.primaryAc,10);if(typeof e.ac=="number")return e.ac;if(typeof e.ac=="string"&&!isNaN(parseInt(e.ac,10)))return parseInt(e.ac,10);if(Array.isArray(e.ac)&&e.ac.length>0){const i=e.ac[0];if(typeof i=="object"&&i!==null){const s=i.ac??i.value??null;if(s!==null&&!isNaN(parseInt(s,10)))return parseInt(s,10)}if(typeof i=="number")return i;if(typeof i=="string"&&!isNaN(parseInt(i,10)))return parseInt(i,10)}}const o=r.campaignState||(typeof window<"u"?window.VTT?.campaignState:null),n=t.characterId||t.sourceCharacterId;if(n&&o?.characters){const i=o.characters[n];if(i){let s=i.baseAc!==void 0&&i.baseAc!==null?parseInt(i.baseAc,10):parseInt(i.ac,10)||10;const l=parseInt(i.acMod,10)||0;let d=0;Array.isArray(i.acToggles)&&i.acToggles.filter(a=>a&&a.enabled).forEach(a=>{if(a.formula){const c=String(a.formula).trim().match(/[+-]?\s*\d+/g);c&&(d+=c.reduce((f,u)=>f+(parseInt(u.replace(/\s+/g,""),10)||0),0))}else typeof a.bonus=="number"&&(d+=a.bonus)});const p=Math.max(1,s+l+d);if(!isNaN(p))return p}if(i?.ac!==void 0&&i.ac!==null&&i.ac!==""&&!isNaN(parseInt(i.ac,10)))return parseInt(i.ac,10)}return null}export function getTokenSpeed(t,r={}){if(!t)return null;let e=null;const o=getResolvedCreatureMonsterData(t,r),n=r.campaignState||(typeof window<"u"?window.VTT?.campaignState:null);if(o?.speed!==void 0&&o.speed!==null)e=o.speed;else if(t.characterId&&n?.characters){const i=n.characters[t.characterId];i?.speed!==void 0&&i.speed!==null&&i.speed!==""&&(e=i.speed)}else t.speed!==void 0&&t.speed!==null&&t.speed!==""&&(e=t.speed);if(!e)return null;if(typeof e=="number")return`${e} ft.`;if(typeof e=="string")return e.includes("ft")?e:`${e} ft.`;if(typeof e=="object"){const i=[];if(e.walk!==void 0&&e.walk!==null){const s=typeof e.walk=="object"?e.walk.number:e.walk;s&&i.push(`${s} ft.`)}return["fly","swim","climb","burrow"].forEach(s=>{if(e[s]){const l=typeof e[s]=="object"?e[s].number:e[s];if(l){const d=s.charAt(0).toUpperCase()+s.slice(1);i.push(`${d} ${l} ft.`)}}}),i.length>0?i.join(", "):null}return null}export function getTokenPP(t,r={}){if(!t)return null;const e=getResolvedCreatureMonsterData(t,r);if(e){if(e.passive!==void 0&&e.passive!==null&&e.passive!=="")return Number(e.passive);if(e.skill&&e.skill.perception!==void 0)return 10+(parseInt(e.skill.perception)||0);if(typeof e.senses=="string"){const i=e.senses.match(/passive Perception\s+(\d+)/i);if(i)return parseInt(i[1])}else if(Array.isArray(e.senses))for(const i of e.senses){const l=(typeof i=="string"?i:i?.name||"").match(/passive Perception\s+(\d+)/i);if(l)return parseInt(l[1])}const n=e.wis??e.abilities?.wis?.score??10;return 10+Math.floor((n-10)/2)}const o=r.campaignState||(typeof window<"u"?window.VTT?.campaignState:null);if(t.characterId&&o?.characters){const n=o.characters[t.characterId];if(!n||!n.stats)return null;const i=a=>Math.floor((a-10)/2),s=Math.floor(((n.level||1)-1)/4)+2;let l=10+i(n.stats.wis||10);n.skills&&n.skills.Perception&&(l+=s),n.expertise&&n.expertise.Perception&&(l+=s);const d=n.skillMods&&n.skillMods.Perception?parseInt(n.skillMods.Perception):0;isNaN(d)||(l+=d);const p=n.passiveSkillMods&&n.passiveSkillMods.Perception?parseInt(n.passiveSkillMods.Perception):0;return isNaN(p)||(l+=p),n.skillToggles&&n.skillToggles.filter(a=>a.enabled).forEach(a=>{if(a.target==="passive_all"||a.target==="passive_perception"){const m=parseInt(a.formula)||0;isNaN(m)||(l+=m)}}),l}return null}export function getTokenPassiveStats(t,r={}){if(!t)return{pi:null,pinv:null};const e=getResolvedCreatureMonsterData(t,r);if(e){const n=e.wis??e.abilities?.wis?.score??10,i=e.int??e.abilities?.int?.score??10,s=Math.floor((n-10)/2),l=Math.floor((i-10)/2);let d=10+s;e.skill&&e.skill.insight!==void 0&&(d=10+(parseInt(e.skill.insight)||0));let p=10+l;return e.skill&&e.skill.investigation!==void 0&&(p=10+(parseInt(e.skill.investigation)||0)),{pi:d,pinv:p}}const o=r.campaignState||(typeof window<"u"?window.VTT?.campaignState:null);if(t.characterId&&o?.characters){const n=o.characters[t.characterId];if(!n||!n.stats)return{pi:null,pinv:null};const i=f=>Math.floor((f-10)/2),s=Math.floor(((n.level||1)-1)/4)+2;let l=10+i(n.stats.wis||10);n.skills&&n.skills.Insight&&(l+=s),n.expertise&&n.expertise.Insight&&(l+=s);const d=n.skillMods&&n.skillMods.Insight?parseInt(n.skillMods.Insight):0;isNaN(d)||(l+=d);const p=n.passiveSkillMods&&n.passiveSkillMods.Insight?parseInt(n.passiveSkillMods.Insight):0;isNaN(p)||(l+=p),n.skillToggles&&n.skillToggles.filter(f=>f.enabled).forEach(f=>{if(f.target==="passive_all"||f.target==="passive_insight"){const u=parseInt(f.formula)||0;isNaN(u)||(l+=u)}});let a=10+i(n.stats.int||10);n.skills&&n.skills.Investigation&&(a+=s),n.expertise&&n.expertise.Investigation&&(a+=s);const m=n.skillMods&&n.skillMods.Investigation?parseInt(n.skillMods.Investigation):0;isNaN(m)||(a+=m);const c=n.passiveSkillMods&&n.passiveSkillMods.Investigation?parseInt(n.passiveSkillMods.Investigation):0;return isNaN(c)||(a+=c),n.skillToggles&&n.skillToggles.filter(f=>f.enabled).forEach(f=>{if(f.target==="passive_all"||f.target==="passive_investigation"){const u=parseInt(f.formula)||0;isNaN(u)||(a+=u)}}),{pi:l,pinv:a}}return{pi:null,pinv:null}}export function isTokenTooltipAllowed(t,r={}){if(!t)return!1;const e=r.activeLayer||"token";if((t.layer||"token")!==e)return!1;const n=r.selectedTokenIds||new Set,i=r.selectedTokenId;if(n.has(t.id)||i&&i===t.id)return!1;const s=r.vtt||{},l=r.campaignSettings||{};if(s.role==="GM")return l.gmStatTooltipVisible!=="never";const d=l.playerStatTooltipVisible||"never";return d==="all"?!0:d==="controlled"&&typeof r.isTokenControlledByPlayer=="function"?r.isTokenControlledByPlayer(t):!1}export function showGmTokenTooltip(t,r=!1,e={}){const n=(e.tokens||{})[t];if(!n||!r&&!isTokenTooltipAllowed(n,e))return;hideGmTokenTooltip(e.doc||(typeof document<"u"?document:null),e),e.setPendingTokenTooltipId&&e.setPendingTokenTooltipId(t);const i=getTokenAC(n,e),s=getTokenPP(n,e),l=getTokenSpeed(n,e),{pi:d,pinv:p}=getTokenPassiveStats(n,e),a=Array.isArray(n.conditions)?n.conditions:[],m=a.length>0,c=i!=null&&i!==""?String(i):null,f=l!=null&&l!==""?String(l):null,u=s!=null&&s!==""?String(s):null,y=d!=null&&d!==""?String(d):null,b=p!=null&&p!==""?String(p):null;let g="";m&&(g=`
            <div class="gm-tip-conditions">
                <div class="gm-tip-cond-label">Conditions</div>
                <div class="gm-tip-cond-pills">${a.map(w=>{if(w.isCustom)return`<div class="gm-tip-cond-pill" title="${w.name}" style="border-color: ${w.color}; color: ${w.color};">
                    <i class="fa-solid fa-circle"></i>
                    <span>${w.name}</span>
                </div>`;const T=M[w.name]||"fa-circle-exclamation";return`<div class="gm-tip-cond-pill" title="${w.name}">
                <i class="fa-solid ${T}"></i>
                <span>${w.name}</span>
            </div>`}).join("")}</div>
            </div>`);const h=n.isPlayer?"fa-user":"fa-dragon",x=e.doc||(typeof document<"u"?document:null);if(!x)return;const v=x.createElement("div");v.id="vtt-gm-token-tooltip",v.innerHTML=`
        <div class="gm-tip-header">
            <i class="fa-solid ${h}"></i>
            <span title="${k(n.name||"Unknown")}">${k(n.name||"Unknown")}</span>
        </div>
        <div class="gm-tip-row-primary">
            <div class="gm-tip-stat">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-shield-halved"></i> AC</div>
                <div class="gm-tip-stat-value ${c===null?"na":""}">${c!==null?k(String(c)):"\u2014"}</div>
            </div>
            <div class="gm-tip-stat">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-person-running"></i> Speed</div>
                <div class="gm-tip-stat-value sm ${f===null?"na":""}" title="${k(String(f||""))}">${f!==null?k(String(f)):"\u2014"}</div>
            </div>
        </div>
        <div class="gm-tip-row-passives">
            <div class="gm-tip-stat" title="Passive Perception">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-eye"></i> PP</div>
                <div class="gm-tip-stat-value ${u===null?"na":""}">${u!==null?u:"\u2014"}</div>
            </div>
            <div class="gm-tip-stat" title="Passive Insight">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-brain"></i> PI</div>
                <div class="gm-tip-stat-value ${y===null?"na":""}">${y!==null?y:"\u2014"}</div>
            </div>
            <div class="gm-tip-stat" title="Passive Investigation">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-magnifying-glass"></i> PInv</div>
                <div class="gm-tip-stat-value ${b===null?"na":""}">${b!==null?b:"\u2014"}</div>
            </div>
        </div>
        ${g}
    `,x.body.appendChild(v),_positionGmTooltip(v,n,e)}export function _positionGmTooltip(t,r,e={}){const o=e.viewport;if(!o||!t||!r)return;const n=o.getBoundingClientRect(),i=e.getTokenDrawDimensions||(()=>({drawW:50,drawH:50,tokenRadius:25})),{drawW:s,drawH:l,tokenRadius:d}=i(r),p=e.zoom??1,a=e.panX??0,m=e.panY??0,c=(r.x+s/2)*p+a+n.left,f=(r.y+l/2)*p+m+n.top,u=d*p,y=t.offsetWidth||232,b=t.offsetHeight||160,g=typeof window<"u"?window.innerWidth:1920,h=typeof window<"u"?window.innerHeight:1080;let x=c+u+14;x+y>g-10&&(x=c-u-y-14),x<10&&(x=Math.max(10,Math.min(c-y/2,g-y-10)));let v=f-b/2;const I=h<=900?h-b-74:h-b-10;v=Math.max(10,Math.min(v,I)),t.style.left=`${Math.round(x)}px`,t.style.top=`${Math.round(v)}px`}export function hideGmTokenTooltip(t=typeof document<"u"?document:null,r={}){if(r.clearTooltipTimeout&&r.clearTooltipTimeout(),t){const e=t.getElementById("vtt-gm-token-tooltip");e&&e.remove()}}export function openNoteViewer(t,r={}){const e=r.doc||(typeof document<"u"?document:null);if(!e||!t)return;const o=e.getElementById("vtt-note-viewer");o&&o.remove();let n="";try{const g=typeof window<"u"?window:null;if(t.content&&g?.Renderer){const h=g.Renderer.get(),x=[];h.recursiveRender(t.content,x,{depth:0}),n=x.join("")}else t.content&&(n=`<pre style="white-space:pre-wrap;font-size:12px;">${JSON.stringify(t.content,null,2)}</pre>`)}catch(g){n=`<p style="color:#e74c3c;">Error rendering note content: ${g.message}</p>`}const i=e.createElement("div");i.id="vtt-note-viewer",i.style.cssText=["position:fixed","inset:0","z-index:9999","display:flex","align-items:center","justify-content:center","background:rgba(10,12,20,0.75)","backdrop-filter:blur(4px)"].join(";");const s=e.createElement("div");s.style.cssText=["position:relative","width:min(700px,92vw)","max-height:80vh","background:linear-gradient(135deg,#12161f,#1a1d2b)","border:1px solid rgba(212,175,55,0.35)","border-radius:12px","box-shadow:0 24px 80px rgba(0,0,0,0.7)","display:flex","flex-direction:column","overflow:hidden"].join(";");const l=e.createElement("div");l.style.cssText=["display:flex","align-items:center","justify-content:space-between","padding:16px 20px","border-bottom:1px solid rgba(212,175,55,0.2)","background:rgba(212,175,55,0.06)","flex-shrink:0"].join(";");const d=e.createElement("h2");d.style.cssText="margin:0;font-size:17px;font-weight:700;color:#d4af37;font-family:var(--font-primary,Inter);",d.textContent=`\u{1F4CD} ${t.name||`Area ${t.areaId||""}`}`;const p=e.createElement("div");p.style.display="flex",p.style.alignItems="center",p.appendChild(d);const a=e.createElement("div");a.style.display="flex",a.style.alignItems="center",a.style.gap="12px";const m=r.vtt||{};if(m.role==="GM"){const g=e.createElement("button");g.innerHTML="\u270F\uFE0F Edit",g.style.cssText=["background:rgba(212,175,55,0.15)","border:1px solid rgba(212,175,55,0.3)","color:#d4af37","padding:4px 10px","border-radius:4px","font-size:12px","cursor:pointer","transition:background 0.2s"].join(";"),g.onmouseover=()=>{g.style.background="rgba(212,175,55,0.25)"},g.onmouseout=()=>{g.style.background="rgba(212,175,55,0.15)"},g.onclick=()=>{i.remove(),openNoteEditor(t,!1,r)},a.appendChild(g)}const c=e.createElement("button");c.textContent="\xD7",c.style.cssText=["background:none","border:none","color:#888","font-size:24px","line-height:1","cursor:pointer","padding:0","display:flex","align-items:center","justify-content:center"].join(";"),c.onclick=()=>i.remove(),a.appendChild(c),l.appendChild(p),l.appendChild(a);const f=e.createElement("div");f.className="vtt-note-content",f.style.cssText=["padding:20px 24px","overflow-y:auto","flex:1","font-family:var(--font-primary,Inter)","font-size:14px","line-height:1.65","color:#d0d4de"].join(";"),f.innerHTML=n||'<p style="color:#666;font-style:italic;">This note is empty.</p>';const u=e.createElement("div");u.style.cssText=["padding:12px 20px","border-top:1px solid rgba(255,255,255,0.06)","background:rgba(0,0,0,0.2)","display:flex","align-items:center","justify-content:space-between","font-size:12px","color:#666","flex-shrink:0"].join(";");const y=e.createElement("span");m.role==="GM"&&(y.textContent=t.visibleToPlayers?"\u{1F441} Visible to players":"\u{1F512} GM Only",y.style.color=t.visibleToPlayers?"#4caf50":"#888"),u.appendChild(y);const b=e.createElement("button");b.textContent="Close",b.style.cssText=["background:rgba(255,255,255,0.08)","border:1px solid rgba(255,255,255,0.15)","color:#ccc","padding:6px 16px","border-radius:6px","cursor:pointer"].join(";"),b.onclick=()=>i.remove(),u.appendChild(b),s.appendChild(l),s.appendChild(f),s.appendChild(u),i.appendChild(s),e.body.appendChild(i),i.onclick=g=>{g.target===i&&i.remove()}}export function openNoteEditor(t,r=!1,e={}){const o=e.doc||(typeof document<"u"?document:null);if(!o||!t)return;const n=o.getElementById("vtt-note-editor");n&&n.remove();const i=o.createElement("div");i.id="vtt-note-editor",i.style.cssText=["position:fixed","inset:0","z-index:9999","display:flex","align-items:center","justify-content:center","background:rgba(10,12,20,0.75)","backdrop-filter:blur(4px)"].join(";");const s=o.createElement("div");s.style.cssText=["position:relative","width:min(600px,92vw)","max-height:85vh","background:linear-gradient(135deg,#12161f,#1a1d2b)","border:1px solid rgba(212,175,55,0.35)","border-radius:12px","box-shadow:0 24px 80px rgba(0,0,0,0.7)","display:flex","flex-direction:column","overflow:hidden"].join(";");const l=o.createElement("div");l.style.cssText=["display:flex","align-items:center","justify-content:space-between","padding:16px 20px","border-bottom:1px solid rgba(212,175,55,0.2)","background:rgba(212,175,55,0.06)","flex-shrink:0"].join(";");const d=o.createElement("h2");d.style.cssText="margin:0;font-size:16px;font-weight:700;color:#d4af37;font-family:var(--font-primary,Inter);",d.textContent=r?"\u{1F4CD} Add Map Note":`\u{1F4CD} Edit Note: ${t.name||`Area ${t.areaId||""}`}`;const p=o.createElement("button");p.textContent="\xD7",p.style.cssText=["background:none","border:none","color:#888","font-size:24px","line-height:1","cursor:pointer","padding:0"].join(";"),p.onclick=()=>{i.remove(),r&&e.notes&&(e.notes=e.notes.filter(v=>v.id!==t.id),e.renderAll&&e.renderAll())},l.appendChild(d),l.appendChild(p);const a=o.createElement("div");a.style.cssText="padding:20px 24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:14px;";const m=o.createElement("div");m.innerHTML=`
        <label style="display:block;font-size:12px;font-weight:600;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Note Title / Label</label>
        <input id="note-edit-name" type="text" value="${t.name?t.name.replace(/"/g,"&quot;"):""}" placeholder="e.g. 1. Guard Barracks" style="width:100%;box-sizing:border-box;background:#0d1017;border:1px solid #2d3345;color:#fff;padding:8px 12px;border-radius:6px;font-size:14px;">
    `,a.appendChild(m);let c="";typeof t.content=="string"?c=t.content:Array.isArray(t.content)&&(c=t.content.map(v=>typeof v=="string"?v:v&&v.entries?(v.name?`**${v.name}**
`:"")+v.entries.join(`
`):JSON.stringify(v)).join(`

`));const f=o.createElement("div");f.style.display="flex",f.style.flexDirection="column",f.style.flex="1",f.innerHTML=`
        <label style="display:block;font-size:12px;font-weight:600;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Content (Plain text or 5eTools format)</label>
        <textarea id="note-edit-content" rows="9" placeholder="Enter room description, monster details, or trap notes..." style="width:100%;box-sizing:border-box;background:#0d1017;border:1px solid #2d3345;color:#fff;padding:10px 12px;border-radius:6px;font-size:13px;resize:vertical;font-family:var(--font-primary,Inter);line-height:1.5;">${c.replace(/</g,"&lt;")}</textarea>
    `,a.appendChild(f);const u=o.createElement("div");u.style.cssText="display:flex;align-items:center;gap:10px;padding:8px 0;";const y=o.createElement("input");y.type="checkbox",y.id="note-edit-visible",y.checked=!!t.visibleToPlayers,y.style.cursor="pointer";const b=o.createElement("label");b.htmlFor="note-edit-visible",b.textContent="\u{1F441} Visible to players (can click and read this note)",b.style.cssText="font-size:13px;color:#ccc;cursor:pointer;user-select:none;",u.appendChild(y),u.appendChild(b),a.appendChild(u);const g=o.createElement("div");g.style.cssText=["padding:14px 20px","border-top:1px solid rgba(255,255,255,0.06)","background:rgba(0,0,0,0.2)","display:flex","align-items:center","justify-content:flex-end","gap:10px","flex-shrink:0"].join(";");const h=o.createElement("button");h.textContent="Cancel",h.style.cssText=["background:rgba(255,255,255,0.08)","border:1px solid rgba(255,255,255,0.15)","color:#ccc","padding:8px 18px","border-radius:6px","cursor:pointer"].join(";"),h.onclick=()=>{i.remove(),r&&e.notes&&(e.notes=e.notes.filter(v=>v.id!==t.id),e.renderAll&&e.renderAll())};const x=o.createElement("button");x.textContent="Save Note",x.style.cssText=["background:rgba(212,175,55,0.25)","border:1px solid #d4af37","color:#d4af37","padding:8px 20px","border-radius:6px","font-weight:700","cursor:pointer"].join(";"),x.onclick=()=>{const v=o.getElementById("note-edit-name")?.value.trim(),I=o.getElementById("note-edit-content")?.value.trim(),w=o.getElementById("note-edit-visible")?.checked;t.name=v||(t.areaId?`Area ${t.areaId}`:"Note"),t.content=[I],t.visibleToPlayers=w,i.remove();const T=e.vtt||{};T.socket&&e.notes&&T.socket.emit("notes:update",{mapId:e.currentMapId,notes:e.notes}),e.renderAll&&e.renderAll(),r&&openNoteViewer(t,e)},g.appendChild(h),g.appendChild(x),s.appendChild(l),s.appendChild(a),s.appendChild(g),i.appendChild(s),o.body.appendChild(i)}export function closeNoteContextMenu(){if(typeof document>"u")return;const t=document.getElementById("vtt-note-context-menu");t&&t.remove(),typeof window<"u"&&(window.removeEventListener("click",closeNoteContextMenu),window.removeEventListener("contextmenu",closeNoteContextMenu))}export function showNoteContextMenu(t,r,e,o={}){closeNoteContextMenu();const n=o.notes||[],i=n.find(p=>p.id===t);if(!i||typeof document>"u")return;const s=document.createElement("div");s.id="vtt-note-context-menu",s.style.cssText=`position:fixed; left:${r}px; top:${e}px; z-index:9999; background:#1e2330; border:1px solid #3a4155; border-radius:6px; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:4px 0; min-width:160px; font-family:var(--font-primary,Inter); font-size:13px; color:#ccc;`;const l=(p,a,m)=>{const c=document.createElement("div");c.style.cssText="padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s;",c.innerHTML=`<span>${a}</span> <span>${p}</span>`,c.onmouseover=()=>{c.style.background="rgba(255,255,255,0.1)",c.style.color="#fff"},c.onmouseout=()=>{c.style.background="transparent",c.style.color="#ccc"},c.onmousedown=f=>{f.stopPropagation(),m(),closeNoteContextMenu()},s.appendChild(c)},d=o.vtt||{};l("Edit","\u270F\uFE0F",()=>openNoteEditor(i,!1,o)),i.visibleToPlayers?l("Make Private","\u270B",()=>{i.visibleToPlayers=!1,d.socket?.emit("notes:update",{mapId:o.currentMapId,notes:n}),o.renderAll?.()}):l("Share with Players","\u{1F441}",()=>{i.visibleToPlayers=!0,d.socket?.emit("notes:update",{mapId:o.currentMapId,notes:n}),o.renderAll?.()}),l("Delete","\u{1F5D1}\uFE0F",()=>{if(o.onDeleteNote)o.onDeleteNote(t);else if(o.notes){const p=o.notes.findIndex(a=>a.id===t);p!==-1&&o.notes.splice(p,1)}d.socket?.emit("notes:update",{mapId:o.currentMapId,notes:o.notes}),o.renderAll?.()}),document.body.appendChild(s),typeof window<"u"&&setTimeout(()=>{window.addEventListener("click",closeNoteContextMenu),window.addEventListener("contextmenu",closeNoteContextMenu)},10)}export function showAddNoteContextMenu(t,r,e,o,n={}){if(closeNoteContextMenu(),typeof document>"u")return;const i=document.createElement("div");i.id="vtt-note-context-menu",i.style.cssText=`position:fixed; left:${e}px; top:${o}px; z-index:9999; background:#1e2330; border:1px solid #3a4155; border-radius:6px; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:4px 0; min-width:160px; font-family:var(--font-primary,Inter); font-size:13px; color:#ccc;`;const s=document.createElement("div");s.style.cssText="padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s;",s.innerHTML="<span>\u2795</span> <span>Add Note Here</span>",s.onmouseover=()=>{s.style.background="rgba(255,255,255,0.1)",s.style.color="#fff"},s.onmouseout=()=>{s.style.background="transparent",s.style.color="#ccc"},s.onmousedown=l=>{l.stopPropagation(),closeNoteContextMenu();const d={id:"note_"+Date.now()+Math.random().toString(36).substring(2,7),name:"",content:"",x:t,y:r,visibleToPlayers:!1};n.notes&&n.notes.push(d),openNoteEditor(d,!0,n)},i.appendChild(s),document.body.appendChild(i),typeof window<"u"&&setTimeout(()=>{window.addEventListener("click",closeNoteContextMenu),window.addEventListener("contextmenu",closeNoteContextMenu)},10)}export function renderNotePins(t,r={}){if(!t)return;const e=r.vtt||{},o=r.isGmViewing??e.role==="GM",n=r.activeLayer||"token",i=r.notes||[];if(!(o&&n==="notes"||e.role!=="GM"))return;const s=r.isRectInViewport||(()=>!0),l=r.hoveredNoteId,d=r.selectedNoteId,p=(t.getTransform?t.getTransform()?.a:1)||1;i.forEach(a=>{const m=e.role!=="GM";if(m&&!a.visibleToPlayers||!s(a.x-25,a.y-25,50,50,200))return;const c=l===a.id,f=d===a.id,u=c?m?15:17:m?12:14;t.save(),t.translate(a.x,a.y),t.scale(1/p,1/p),f&&!m&&(t.beginPath(),t.arc(0,0,u+6,0,Math.PI*2),t.strokeStyle="rgba(212, 175, 55, 0.9)",t.lineWidth=2.5,t.stroke()),t.beginPath(),t.arc(0,0,u,0,Math.PI*2),m?t.fillStyle=c?"#5c90ff":"rgba(60, 120, 255, 0.85)":t.fillStyle=c?"#d4af37":"rgba(212, 175, 55, 0.85)",t.strokeStyle="#1a1d27",t.lineWidth=2,t.fill(),t.stroke(),t.font=`${u}px serif`,t.textAlign="center",t.textBaseline="middle",t.fillStyle="#ffffff",t.fillText("\u{1F4CD}",0,0),!m&&a.visibleToPlayers&&(t.font="10px serif",t.fillText("\u{1F441}",u-2,-u+2)),t.font='bold 11px "Open Sans", Arial, sans-serif',t.fillStyle="#ffffff",t.shadowColor="rgba(0,0,0,0.9)",t.shadowBlur=4,t.textAlign="center",t.textBaseline="top",t.fillText(a.name||(a.areaId?`Area ${a.areaId}`:"Note"),0,u+4),t.restore()})}
