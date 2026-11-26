import{escapeHtml as N,resolveMonsterTokenUrl as be}from"../vtt-utils.js";import{buildTypeString as Te,buildSpeedString as ke,getProfBonus as Se,buildSavesHtml as Ce,buildSkillsHtml as $e,buildImmunityHtml as Ie,parse5eMarkup as _,injectDiceChips as ie,formatRawEntry as Ae,isPassiveAbility as xe,normalizeMonsterDamages as Me,cleanTags as K,flattenEntriesToText as ae}from"./creature-parser.js";import{ensureSpellcastingFromTraits as Ee,buildSpellcastingHtml as Le,wireSpellSlots as He,setupCsSpellListeners as Ve,showVttPrompt as Q}from"./creature-spells.js";import{wireInitiativeRoll as Pe,wireAbilityScoreClicks as Ne}from"./creature-roller.js";import{openEditModal as pe}from"./creature-editor.js";import{openAssignPlayersModal as Ge}from"../player-sheet/vtt-sheet-modals.js";export function setupPanelResizing(e){if(!e||typeof window>"u")return;const a=localStorage.getItem("vtt_cs_panel_width");if(a){const o=parseInt(a,10);!isNaN(o)&&o>=280&&e.style.setProperty("--cs-panel-width",`${o}px`)}let t=e.querySelector(".cs-resize-handle");t||(t=document.createElement("div"),t.className="cs-resize-handle",t.title="Drag border to resize creature sheet (double-click to reset)",e.appendChild(t));let i=!1,n=0,c=320;t.addEventListener("pointerdown",o=>{if(o.button!==0)return;i=!0,n=o.clientX,c=e.getBoundingClientRect().width||320,e.classList.add("is-resizing"),t.setPointerCapture(o.pointerId),o.preventDefault(),o.stopPropagation()}),t.addEventListener("pointermove",o=>{if(!i)return;const l=o.clientX-n;let r=c+l;const d=Math.min(window.innerWidth*.85,1e3);r=Math.max(280,Math.min(r,d)),e.style.setProperty("--cs-panel-width",`${Math.round(r)}px`),window.VTT?.sheetDock?.updatePosition&&window.VTT.sheetDock.updatePosition()});const s=o=>{if(!i)return;i=!1,e.classList.remove("is-resizing");try{t.hasPointerCapture(o.pointerId)&&t.releasePointerCapture(o.pointerId)}catch{}const l=Math.round(e.getBoundingClientRect().width);l>=280&&localStorage.setItem("vtt_cs_panel_width",l),window.VTT?.sheetDock?.updatePosition&&window.VTT.sheetDock.updatePosition()};t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s),t.addEventListener("dblclick",o=>{o.preventDefault(),o.stopPropagation(),e.style.setProperty("--cs-panel-width","320px"),localStorage.removeItem("vtt_cs_panel_width"),window.VTT?.sheetDock?.updatePosition&&window.VTT.sheetDock.updatePosition()})}export function generateArcaneTokenDataUrl(e,a="monster"){if(typeof document>"u")return"favicon.svg";const t=(e||"Creature").trim(),i=t.split(/\s+/).filter(Boolean);let n=i.length>1?i[0][0]+i[1][0]:t.slice(0,2);n=(n||"C").toUpperCase();const c=document.createElement("canvas");c.width=128,c.height=128;const s=c.getContext("2d");if(!s)return"favicon.svg";const o={monster:"#dc2626",npc:"#9333ea",companion:"#eab308",player:"#2563eb"},l=o[a]||o.monster;s.save(),s.beginPath(),s.arc(64,64,60,0,Math.PI*2),s.clip();const r=s.createRadialGradient(64,64,10,64,64,64);return r.addColorStop(0,"#1c2436"),r.addColorStop(.7,"#0f1422"),r.addColorStop(1,"#080c14"),s.fillStyle=r,s.fillRect(0,0,128,128),s.beginPath(),s.arc(64,64,48,0,Math.PI*2),s.strokeStyle="rgba(212, 175, 55, 0.3)",s.lineWidth=1.5,s.stroke(),s.beginPath(),s.arc(64,64,53,0,Math.PI*2),s.strokeStyle=`${l}55`,s.lineWidth=2,s.stroke(),s.restore(),s.beginPath(),s.arc(64,64,60,0,Math.PI*2),s.strokeStyle=l,s.lineWidth=5,s.stroke(),s.beginPath(),s.arc(64,64,62,0,Math.PI*2),s.strokeStyle="rgba(212, 175, 55, 0.7)",s.lineWidth=1.5,s.stroke(),s.font='bold 36px "Cinzel", "Georgia", "Times New Roman", serif',s.textAlign="center",s.textBaseline="middle",s.fillStyle="rgba(0, 0, 0, 0.9)",s.fillText(n,65,66),s.fillStyle="#f8fafc",s.fillText(n,64,64),c.toDataURL("image/png")}export function getMonsterImageUrl(e,a={}){if(!e)return generateArcaneTokenDataUrl("Creature","monster");const t=a.getLinkedTokenId?a.getLinkedTokenId():null,i=a.getLinkedCharacterId?a.getLinkedCharacterId():null;if(t&&typeof window<"u"&&window.VTT?.canvasEngine){const n=window.VTT.canvasEngine.getTokens(),c=n?n[t]:null;if(c){if(c.img)return c.img;if(c.imgUrl)return c.imgUrl;if(c.src)return c.src;if(c.tokenUrl)return c.tokenUrl}}if(i&&typeof window<"u"&&window.VTT?.campaignState?.characters){const n=window.VTT.campaignState.characters[i];if(n){if(n.tokenImages&&n.tokenImages.length>0&&n.activeTokenIndex!==-1){const c=n.activeTokenIndex||0;if(c>=0&&c<n.tokenImages.length&&n.tokenImages[c]?.url)return n.tokenImages[c].url}if(n.avatarUrl)return n.avatarUrl}}if(e.tokenImg)return e.tokenImg;if(e.tokenUrl)return e.tokenUrl;if(e.imgUrl)return e.imgUrl;if(typeof window<"u"&&window.Renderer?.monster?.getTokenUrl)try{const n=window.Renderer.monster.getTokenUrl(e);if(n)return n}catch(n){console.warn("[CreatureSheet] Renderer.monster.getTokenUrl failed",n)}if(e.hasToken||e.source||e.name){const n=be(e);if(n)return n}return generateArcaneTokenDataUrl(e.name||"Creature","monster")}export function getLinkedTokenHp(e,a={}){const t=a.getLinkedCharacterId?a.getLinkedCharacterId():null;if(t&&typeof window<"u"&&window.VTT?.campaignState?.characters){const n=window.VTT.campaignState.characters[t];if(n&&n.isGeneric!==!0&&n.hpCurrent!==void 0)return n.hpCurrent}const i=a.getLinkedTokenId?a.getLinkedTokenId():null;if(i&&typeof window<"u"&&window.VTT?.canvasEngine){const n=window.VTT.canvasEngine.getTokens();if(n[i]?.hp!==void 0)return n[i].hp}return null}export function getLinkedTokenTempHp(e,a={}){const t=a.getLinkedTokenId?a.getLinkedTokenId():null,i=a.getLinkedCharacterId?a.getLinkedCharacterId():null;if(t&&typeof window<"u"&&window.VTT?.canvasEngine){const n=window.VTT.canvasEngine.getTokens();if(n[t]?.tempHp!==void 0)return n[t].tempHp}if(i&&typeof window<"u"&&window.VTT?.campaignState?.characters){const n=window.VTT.campaignState.characters[i];if(n?.tempHp!==void 0)return n.tempHp}return e.tempHp??0}export function wireHpControls(e,a,t,i,n={},c=0){const s=e||(n.getContentEl?n.getContentEl():document);let o=parseInt(t)||0;const l=parseInt(i)||0;let r=parseInt(c)||0;const d=s.querySelector?s.querySelector("#cs-hp-current"):document.getElementById("cs-hp-current"),h=s.querySelector?s.querySelector("#cs-hp-bar"):document.getElementById("cs-hp-bar"),T=s.querySelector?s.querySelector("#cs-temp-hp-current"):document.getElementById("cs-temp-hp-current"),k=s.querySelector?s.querySelector("#cs-temp-hp-bar-wrap"):document.getElementById("cs-temp-hp-bar-wrap"),v=n.getLinkedTokenId?n.getLinkedTokenId():null,C=n.getLinkedCharacterId?n.getLinkedCharacterId():null,f=n.getVtt?n.getVtt():typeof window<"u"?window.VTT:null;function G(){if(d&&(d.textContent=o),T&&(T.textContent=r),k&&(k.style.display=r>0?"block":"none"),h&&l>0){const p=Math.max(0,Math.min(100,Math.round(o/l*100)));h.style.width=`${p}%`,h.className="cs-hp-bar-fill"+(p<=25?" danger":p<=50?" injured":"")}}function L(){if(G(),v&&typeof window<"u"&&window.VTT?.socket){const p=window.VTT.canvasEngine;if(p){const g=p.getTokens?p.getTokens():{},S=p.getCurrentMapId?p.getCurrentMapId():null,y=g[v];if(y){const q=Number(y.hp),U=Number(y.tempHp||0);y.hp=o,y.tempHp=r,window.VTT.socket.emit("token:update",{mapId:S,token:y});const H=p.triggerDamageFXAnimation,E=p.triggerHealingFXAnimation,V=(p.getTokenDrawDimensions||(()=>({drawW:y.width||50,drawH:y.height||50})))(y),P=y.x+(V.drawW||50)/2,J=y.y+(V.drawH||50)/2,W=Math.max(V.drawW||50,V.drawH||50)/2;if(!isNaN(q)&&o!==q){const $=o-q;if($<0){const j=Math.abs($);typeof H=="function"&&H(P,J,W,["untyped"],{amount:j,tokenId:y.id}),window.VTT.socket.emit("tokens:damage_fx",{mapId:S,tokenIds:[y.id],damageTypes:["untyped"],amount:j})}else $>0&&(typeof E=="function"&&E(P,J,W,$,{tokenId:y.id}),window.VTT.socket.emit("tokens:heal_fx",{mapId:S,tokenIds:[y.id],amount:$}))}if(!isNaN(U)&&r>U){const $=r-U;typeof E=="function"&&E(P,J,W,$,{tokenId:y.id,isTempHp:!0}),window.VTT.socket.emit("tokens:heal_fx",{mapId:S,tokenIds:[y.id],amount:$,isTempHp:!0})}p.renderAll&&p.renderAll()}}}if(C&&typeof window<"u"&&window.VTT?.campaignState?.characters){const p=window.VTT.campaignState.characters[C];p&&(!v||p.isGeneric!==!0)&&(p.hpCurrent=o,p.tempHp=r,window.VTT.socket&&window.VTT.socket.emit("character:update",{character:p}))}}const B=s.querySelector?s.querySelector("#cs-hp-minus"):document.getElementById("cs-hp-minus"),D=s.querySelector?s.querySelector("#cs-hp-plus"):document.getElementById("cs-hp-plus"),R=s.querySelector?s.querySelector("#cs-temp-hp-minus"):document.getElementById("cs-temp-hp-minus"),A=s.querySelector?s.querySelector("#cs-temp-hp-plus"):document.getElementById("cs-temp-hp-plus"),Z=f?.role==="GM",x=C&&f?.campaignState?.characters?f.campaignState.characters[C]:null,ee=!!(x&&x.assignedPlayers&&(x.assignedPlayers.includes(f?.username)||x.assignedPlayers.includes("*")||x.owner===f?.username)),M=v&&f?.canvasEngine?f.canvasEngine.getTokens()?.[v]:null,O=!!(M&&(M.ownerUsername===f?.username||M.playerOwner===f?.username||M.assignedPlayers&&M.assignedPlayers.includes(f?.username))),X=!!((x?x.isGeneric===!0:a.isGeneric===!0)&&!v);if((Z||ee||O)&&!X)B&&B.addEventListener("click",()=>{Q("Damage amount:","1",p=>{if(p===null)return;const g=parseInt(p||"1");if(!isNaN(g)&&g>0){if(r>0)if(g<=r)r-=g;else{const S=g-r;r=0,o=Math.max(0,o-S)}else o=Math.max(0,o-g);L()}})}),D&&D.addEventListener("click",()=>{Q("Heal amount:","1",p=>{if(p===null)return;const g=parseInt(p||"1");!isNaN(g)&&g>0&&(o=Math.min(l,o+g),L())})}),R&&R.addEventListener("click",()=>{Q("Reduce Temp HP by:","1",p=>{if(p===null)return;const g=parseInt(p||"1");!isNaN(g)&&g>0&&(r=Math.max(0,r-g),L())})}),A&&A.addEventListener("click",()=>{Q("Add Temp HP:","1",p=>{if(p===null)return;const g=parseInt(p||"1");!isNaN(g)&&g>0&&(r=Math.max(0,r+g),L())})});else{const p=X?"Template view: select a token instance on the canvas or dock to modify HP":"You do not have permission to modify this creature's HP";[B,D,R,A].forEach(g=>{g&&(g.disabled=!0,g.style.opacity="0.4",g.style.cursor="not-allowed",g.title=p)})}f&&f.socket&&(f._csHpTokenListener&&f.socket.off("token:updated",f._csHpTokenListener),f._csHpCharListener&&f.socket.off("character:updated",f._csHpCharListener),f._csHpTokenListener=p=>{if(v&&p.tokens&&p.tokens[v]){const g=p.tokens[v].hp,S=p.tokens[v].tempHp??0;let y=!1;g!==void 0&&o!==g&&(o=g,y=!0),S!==void 0&&r!==S&&(r=S,y=!0),y&&G()}},f._csHpCharListener=p=>{if(C&&p.character&&p.character.id===C){const g=p.character.hpCurrent,S=p.character.tempHp??0;let y=!1;g!==void 0&&o!==g&&(o=g,y=!0),S!==void 0&&r!==S&&(r=S,y=!0),y&&G()}},f.socket.on("token:updated",f._csHpTokenListener),f.socket.on("character:updated",f._csHpCharListener))}export function wireTabs(e){if(!e)return;const a=e.querySelectorAll(".cs-tab-btn"),t=e.querySelectorAll(".cs-tab-content");a.forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.tab;a.forEach(s=>s.classList.remove("active")),t.forEach(s=>s.classList.remove("active")),i.classList.add("active");const c=e.querySelector(`#cs-tab-${n}`);c&&c.classList.add("active")})})}export function wireCollapsibleHandlers(e){if(!e)return;e.querySelectorAll(".cs-section-title").forEach(t=>{t.addEventListener("click",()=>{const i=t.closest(".cs-section");i&&i.classList.toggle("collapsed")})}),e.querySelectorAll(".cs-ability-header").forEach(t=>{t.addEventListener("click",i=>{if(i.target.closest(".cs-macro-trigger")||i.target.closest(".cs-ability-info-btn")||i.target.closest("button")||i.target.closest(".dice-chip"))return;const n=t.closest(".cs-ability-entry");n&&n.classList.toggle("expanded")})});const a=e.querySelector("#cs-toggle-all-btn");if(a){let t=!1;a.addEventListener("click",()=>{t=!t,e.querySelectorAll(".cs-section").forEach(c=>{t?c.classList.remove("collapsed"):c.classList.add("collapsed")}),e.querySelectorAll(".cs-ability-entry").forEach(c=>{t?c.classList.add("expanded"):c.classList.remove("expanded")});const i=a.querySelector("i"),n=a.querySelector("span");t?(i&&(i.className="fa-solid fa-angles-up"),n&&(n.textContent="Collapse All")):(i&&(i.className="fa-solid fa-angles-down"),n&&(n.textContent="Expand All"))})}}export function extractLairTitle(e){if(!e||typeof e!="string")return"";const a=e.match(/^\{@b\s+([^}]+)\}\.?\s*(.*)/i)||e.match(/^\*\*([^*]+)\*\*\.?\s*(.*)/i);if(a)return K(a[1]).replace(/\.$/,"").trim();const t=e.match(/(?:casts?|uses?)\s+\{@spell\s+([^}|]+)/i);if(t)return`Cast ${t[1].trim()}`;let n=e.split(/[.,;]/)[0].trim().replace(/^\{@[^}]+\}\s*/,"").split(/\s+/).filter(Boolean);if(n.length>0){/^(a|an|the|until)$/i.test(n[0])&&n.shift();const c=new Set(["from","in","of","at","on","to","within","with","by","around","into","for","a","an","the"]);for(n=n.slice(0,3);n.length>1&&c.has(n[n.length-1].toLowerCase());)n.pop();const s=n.map(o=>o.charAt(0).toUpperCase()+o.slice(1).toLowerCase()).join(" ");if(s.length>=3)return s}return""}export function detectCreatureAbilityTable(e,a="",t=[],i=""){const n=(a||"").toLowerCase();if(n.includes("eye ray")||n.includes("eye rays")){const r=[],d=h=>{Array.isArray(h)&&h.forEach(T=>{T?.type==="list"&&Array.isArray(T.items)?T.items.forEach((k,v)=>{const C=k.name||`Ray ${v+1}`,f=k.entry||(Array.isArray(k.entries)?k.entries.join(" "):"");r.push({roll:v+1,name:C.replace(/^\d+\.\s*/,""),fullName:C,desc:_(f)})}):T?.entries&&d(T.entries)})};if(d(t),r.length>0)return{type:"eye-rays",formula:`1d${r.length}`,diceSides:r.length,items:r}}if(n.includes("warp creature")||n.includes("flesh warping"))return{type:"flesh-warping",formula:"1d100",diceSides:100,tableName:"Flesh Warping (Demon Ichor)"};const c=r=>{if(!Array.isArray(r))return null;for(const d of r){if(d?.type==="table"&&Array.isArray(d.rows)&&d.rows.length>0)return d;if(d?.entries){const h=c(d.entries);if(h)return h}}return null},s=c(t);if(s){const r=s.rows.map((d,h)=>{const T=Array.isArray(d)?d:[d];return{roll:h+1,name:String(T[0]||`Option ${h+1}`),desc:T.slice(1).map(k=>String(k)).join(" \u2014 ")}});return{type:"embedded-table",formula:`1d${r.length}`,diceSides:r.length,items:r}}const o=r=>{if(!Array.isArray(r))return null;for(const d of r){if(d?.type==="list"&&Array.isArray(d.items)&&d.items.length>=2&&d.items.every((T,k)=>{const v=String(T?.name||T||"");return v.startsWith(`${k+1}.`)||v.startsWith(`${k+1} `)||/^\d+/.test(v)}))return d.items;if(d?.entries){const h=o(d.entries);if(h)return h}}return null},l=o(t);if(l){const r=l.map((d,h)=>{const T=typeof d=="string"?d:d.name||`Option ${h+1}`,k=typeof d=="string"?"":d.entry||(Array.isArray(d.entries)?d.entries.join(" "):"");return{roll:h+1,name:T.replace(/^\d+\.\s*/,""),fullName:T,desc:_(k)}});return{type:"numbered-list",formula:`1d${r.length}`,diceSides:r.length,items:r}}return null}export function buildAbilityEntryHtml(e){if(!e)return"";typeof e=="string"&&(e={name:extractLairTitle(e)||"Effect",entries:[e],descriptionHtml:`<p>${e}</p>`});let a=e.entries;!a&&e.entry&&(a=[e.entry]),a||(a=[]);let t=e.name||"";if(!t&&a.length>0){const v=typeof a[0]=="string"?a[0]:JSON.stringify(a[0]);t=extractLairTitle(v)||""}const i=a.map(v=>Ae(v)).join(" "),n=_(i),c=e.descriptionHtml?ie(_(e.descriptionHtml)):ie(n),s=t?_(t):"",o=s||'<span style="color:var(--color-primary); font-size:0.85em;"><i class="fa-solid fa-tower-broadcast"></i> Action</span>',l=encodeURIComponent(JSON.stringify(a)),r=e.macro?encodeURIComponent(JSON.stringify(e.macro)):"",d=xe(t,a,n,e.macro),h=detectCreatureAbilityTable(e,t,a,n),T=h?`
        <button type="button" class="btn btn-xxs btn-secondary cs-ability-table-chip" 
                data-ability-name="${N(t)}"
                data-table-type="${h.type}"
                data-formula="${h.formula}"
                data-table-json="${encodeURIComponent(JSON.stringify(h))}"
                title="Roll ${N(t)} Table"
                style="margin-left: auto; margin-right: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: rgba(212, 175, 55, 0.15); border: 1px solid var(--color-gold-base); color: var(--color-gold-light); cursor: pointer;">
            <i class="fa-solid fa-dice-d20 text-gradient-gold"></i> Roll Table
        </button>
    `:"";return`
        <div class="cs-ability-entry">
            <div class="cs-ability-header">
                <i class="cs-card-chevron fa-solid fa-chevron-right"></i>
                ${d?`
        <div class="cs-ability-name cs-passive-trigger" title="Click to expand details" style="cursor: pointer; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;">
            ${o} <span class="badge" style="background: rgba(255,255,255,0.08); color: var(--color-text-muted); font-size: 0.65rem; padding: 1px 6px; border-radius: 10px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px;">Passive</span>
        </div>
    `:`
        <div class="cs-ability-name cs-macro-trigger" title="Click to roll macro" style="cursor: pointer; flex: 0 0 auto;">
            ${o} <i class="fa-solid fa-dice-d20" style="font-size: 0.85em; opacity: 0.6; margin-left: 2px;"></i>
        </div>
    `}
                ${T}
                <div class="cs-ability-info-btn" title="Ping description to chat" style="cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; transition: background 0.2s, color 0.2s; ${h?"":"margin-left: auto;"}">
                    <i class="fa-solid fa-comment-dots"></i>
                </div>
            </div>
            <div class="cs-ability-text">${c}</div>
            <div class="cs-ability-raw" style="display:none;">${l}</div>
            <div class="cs-ability-macro" style="display:none;">${r}</div>
        </div>
    `}export function buildAbilitySection(e,a){if(!a||a.length===0)return"";const t=a.map(i=>buildAbilityEntryHtml(i)).join("");return`
        <div class="cs-section">
            <h3 class="cs-section-title"><i class="fa-solid fa-bolt"></i> <span>${e}</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
            <div class="cs-section-content">
                ${t}
            </div>
        </div>
    `}export function buildLegendarySection(e){let a="";const t=Array.isArray(e.legendaryActions)?e.legendaryActions:Array.isArray(e.legendaryActions?.entries)?e.legendaryActions.entries:Array.isArray(e.legendary)?e.legendary:[];if(t&&t.length>0){const c=e.legendaryActionsLair?` <span class="badge" style="font-size:0.75rem; background:rgba(255,215,0,0.15); color:#ffd700; border:1px solid rgba(255,215,0,0.4); border-radius:3px; padding:1px 5px; margin-left:6px;">${e.legendaryActions?.count||3} (${e.legendaryActionsLair} in Lair)</span>`:"",s=e.legendaryActions?.description?`<p class="cs-legendary-desc">${e.legendaryActions.description}</p>`:e.legendaryHeader?`<p class="cs-legendary-desc">${K(ae(e.legendaryHeader))}</p>`:"",o=t.map(l=>buildAbilityEntryHtml(l)).join("");a+=`
            <div class="cs-section cs-legendary-section">
                <h3 class="cs-section-title"><i class="fa-solid fa-crown"></i> <span>Legendary Actions</span>${c} <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${s}
                    ${o}
                </div>
            </div>
        `}const i=Array.isArray(e.mythicActions)?e.mythicActions:Array.isArray(e.mythicActions?.entries)?e.mythicActions.entries:Array.isArray(e.mythic)?e.mythic:[];if(i&&i.length>0){const c=e.mythicActions?.description?`<p class="cs-legendary-desc">${e.mythicActions.description}</p>`:e.mythicHeader?`<p class="cs-legendary-desc">${K(ae(e.mythicHeader))}</p>`:"",s=i.map(o=>buildAbilityEntryHtml(o)).join("");a+=`
            <div class="cs-section cs-mythic-section" style="margin-top:12px;">
                <h3 class="cs-section-title"><i class="fa-solid fa-dragon"></i> <span>Mythic Actions</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${c}
                    ${s}
                </div>
            </div>
        `}const n=Array.isArray(e.lairActions)?e.lairActions:Array.isArray(e.lairActions?.entries)?e.lairActions.entries:Array.isArray(e.lair)?e.lair:[];if(n&&n.length>0){const c=e.lairHeader||e.lairActionsDesc||(e.lairActions?.header?K(ae(e.lairActions.header)):""),s=n.map(o=>buildAbilityEntryHtml(o)).join("");a+=`
            <div class="cs-section cs-lair-section" style="margin-top:12px;">
                <h3 class="cs-section-title"><i class="fa-solid fa-mountain-sun"></i> <span>Lair Actions</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
                <div class="cs-section-content">
                    ${c?`<p class="cs-legendary-desc">${c}</p>`:""}
                    ${s}
                </div>
            </div>
        `}return a}export function buildVariantSection(e){const a=e.variants||(e.variant&&Array.isArray(e.variant)?e.variant:[]);return!a||a.length===0?"":`
        <div class="cs-section cs-variant-section" style="margin-top:12px;">
            <h3 class="cs-section-title"><i class="fa-solid fa-masks-theater"></i> <span>Variant Traits</span> <i class="cs-section-chevron fa-solid fa-chevron-down"></i></h3>
            <div class="cs-section-content">
                ${a.map(i=>{if(!i)return"";const n=i.name||"Variant",c=i.entries||(i.entry?[i.entry]:[]),s=i.descriptionHtml||(typeof i=="string"?`<p>${i}</p>`:"");return buildAbilityEntryHtml({name:n,entries:c,descriptionHtml:s,actionType:"variant"})}).filter(Boolean).join("")}
            </div>
        </div>
    `}export function saveMonsterData(e,a={}){const t=e||(a.getMonster?a.getMonster():null);if(!t)return;const i=a.getLinkedCharacterId?a.getLinkedCharacterId():null,n=a.getLinkedTokenId?a.getLinkedTokenId():null,c=a.getVtt?a.getVtt():typeof window<"u"?window.VTT:null;if(i&&typeof window<"u"&&window.VTT?.campaignState?.characters){const s=window.VTT.campaignState.characters[i];s&&(s.monsterData=t,t.spells&&(s.spells=t.spells),window.VTT.socket?.emit("character:update",{character:s}))}else if(n&&typeof window<"u"&&window.VTT?.canvasEngine){const s=window.VTT.canvasEngine.getTokens()[n];if(s){s.monsterData=t,t.spells&&(s.spells=t.spells);const o=window.VTT?.canvasEngine?.getCurrentMapId?.()||window.VTT?.canvasEngine?.currentMap?.id||null;window.VTT.socket?.emit("token:update",{mapId:o,token:s})}}}export function renderStatBlock(e,a=null,t={}){const i=a||(t.getContentEl?t.getContentEl():document.getElementById("vtt-creature-sheet-panel"));if(!i)return;const n=t.getLinkedTokenId?t.getLinkedTokenId():null,c=t.getLinkedCharacterId?t.getLinkedCharacterId():null,s=t.getVtt?t.getVtt():typeof window<"u"?window.VTT:null,o=c||n&&typeof window<"u"&&window.VTT?.canvasEngine?.getTokens()?.[n]?.sourceCharacterId,l=o&&typeof window<"u"&&window.VTT?.campaignState?.characters?window.VTT.campaignState.characters[o]:null,r=l?l.isGeneric===!0:e.isGeneric===!0;let d=0,h=0;if(r)if(n){d=getLinkedTokenHp(e,t)??(e.hp?.average||(typeof e.hp=="number"?e.hp:0));const u=window.VTT?.canvasEngine?.getTokens()?.[n];h=u&&u.maxHp!==void 0?u.maxHp:e.hp?.average||(typeof e.hp=="number"?e.hp:0)}else d=typeof e.hp=="number"?e.hp:e.hp?.average||l?.hpCurrent||l?.hpMax||0,h=l?.hpMax??(typeof e.hp=="number"?e.hp:e.hp?.average||d);else if(l)d=l.hpCurrent??(typeof e.hp=="number"?e.hp:e.hp?.average||0),h=l.hpMax??(typeof e.hp=="number"?e.hp:e.hp?.average||0);else if(n){d=getLinkedTokenHp(e,t)??(e.hp?.average||(typeof e.hp=="number"?e.hp:0));const u=window.VTT?.canvasEngine?.getTokens()?.[n];h=u&&u.maxHp!==void 0?u.maxHp:e.hp?.average||(typeof e.hp=="number"?e.hp:0)}else d=typeof e.hp=="number"?e.hp:e.hp?.average||0,h=d;const T=e.cr?typeof e.cr=="object"?e.cr.cr||e.cr.coven||e.cr.lair||"0":e.cr:"0",k=Te(e),v=e.hp?.formula||"",C=getLinkedTokenTempHp(e,t)||0,f=Array.isArray(e.ac)?e.ac[0]:e.ac,G=typeof f=="object"?f.value??f.ac??e.primaryAc??"\u2014":f??e.primaryAc??"\u2014",L=typeof f=="object"&&f.from?` (${Array.isArray(f.from)?f.from.join(", "):f.from})`:"",B=ke(e.speed),D=Se(T),R=e.dex??e.abilities?.dex?.score??10;let A=Math.floor((R-10)/2);e.initiative!==void 0&&(typeof e.initiative=="number"?A=e.initiative:typeof e.initiative?.bonus=="number"&&(A=e.initiative.bonus));const Z=A>=0?`+${A}`:`${A}`,x=["str","dex","con","int","wis","cha"],ee=["STR","DEX","CON","INT","WIS","CHA"],M=x.map((u,b)=>{const m=e[u]??e.abilities?.[u]?.score??10,w=Math.floor((m-10)/2),ve=w>=0?`+${w}`:`${w}`;return`
            <div class="cs-ability-cell" data-ability="${u}" data-score="${m}" data-mod="${w}">
                <span class="cs-ability-label">${ee[b]}</span>
                <span class="cs-ability-score">${m}</span>
                <span class="cs-ability-mod">${ve}</span>
                <div class="cs-ability-actions">
                    <span class="cs-ability-action-btn cs-roll-check" title="Roll Check">Check</span>
                    <span class="cs-ability-action-btn cs-roll-save" title="Roll Save">Save</span>
                </div>
            </div>
        `}).join(""),O=Ce(e),te=$e(e),X=Ie(e),oe=buildAbilitySection("Traits",e.traits||e.trait),p=buildAbilitySection("Actions",e.actions||e.action),g=buildAbilitySection("Bonus Actions",e.bonusActions||e.bonus),S=buildAbilitySection("Reactions",e.reactions||e.reaction),y=buildLegendarySection(e),q=buildVariantSection(e),U=!!(c||e.isCustomNpc||e.isCompanion);Ee(e);const H=U||e.spellcasting&&e.spellcasting.length>0||e.spells&&Object.values(e.spells).some(u=>Array.isArray(u)&&u.length>0)||e.slots&&Object.keys(e.slots).length>0||e.spellSlots&&Object.keys(e.spellSlots).length>0;let E="",F="";if(H){E=`
            <div class="cs-tabs">
                <div class="cs-tab-btn active" data-tab="stats">Stats</div>
                <div class="cs-tab-btn" data-tab="spells">Spells</div>
            </div>
        `;try{F=Le(e,c)}catch(u){console.error("[CreatureSheet] Error building spellcasting HTML:",u),F=`<div class="alert alert-warning" style="padding:12px; background:rgba(255,165,0,0.15); border:1px solid orange; border-radius:4px; color:#ffcc00;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>Could not format spellcasting list: ${u.message}</div>`}}let V="";l&&l.name&&e.name!==l.name&&(e.name=l.name),l&&Me(e),l&&typeof window<"u"&&(window.VTT?.role==="GM"||l.assignedPlayers&&(l.assignedPlayers.includes(window.VTT?.username)||l.assignedPlayers.includes("*")))&&(V='<button class="btn btn-xs btn-secondary cs-edit-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;" title="Edit Creature Stats"><i class="fa-solid fa-pen-to-square"></i> <span>Edit</span></button>');let P="";l&&typeof window<"u"&&window.VTT?.role==="GM"&&(P=`<button class="btn btn-xs btn-secondary cs-assign-players-btn" id="cs-assign-players-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;" title="Assign Players to this ${l.isCompanion?"Companion":"Sheet"}"><i class="fa-solid fa-users"></i> <span>Assign</span></button>`);const W=!!(typeof window<"u"&&window.VTT?.role==="GM"&&(o&&l||e.isCustomNpc||e.isCompanion))?`
        <button id="cs-generic-named-toggle" class="btn btn-xs ${r?"btn-secondary":"btn-primary"}" title="Entity Type: ${r?"Generic (independent instanced tokens on canvas)":"Named (linked to central sheet)"}. Click to toggle." style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:2px 6px; border-radius:4px; cursor:pointer;">
            <i class="${r?"fa-solid fa-people-group":"fa-solid fa-street-view"}"></i>
            <span>${r?"Generic":"Named"}</span>
        </button>
    `:"",$=typeof window<"u"&&window.VTT?.currentRollMode||null,j=typeof window<"u"&&window.VTT?.whisperGM!==void 0?window.VTT.whisperGM:null;e.activeRollMode=$||e.activeRollMode||l&&l.activeRollMode||"normal",e.whisperToGM=j!==null?!!j:e.whisperToGM!==void 0?!!e.whisperToGM:l?!!l.whisperToGM:!1;const ne=typeof window<"u"&&window.VTT?.currentRollMode||e.activeRollMode||"normal",ue=!!(typeof window<"u"&&window.VTT?.whisperGM||e.whisperToGM),fe=`
        <div class="ps-segmented-capsule cs-segmented-capsule" role="group" aria-label="Creature Sheet Roll Mode">
            <button type="button" class="ps-roll-mode-btn cs-roll-mode-btn ${ne==="adv"?"active adv":""}" data-mode="adv" title="Advantage (rolls with advantage)"><i class="fa-solid fa-angles-up"></i> Adv</button>
            <button type="button" class="ps-roll-mode-btn cs-roll-mode-btn ${ne==="normal"?"active":""}" data-mode="normal" title="Normal (1d20)">Norm</button>
            <button type="button" class="ps-roll-mode-btn cs-roll-mode-btn ${ne==="dis"?"active dis":""}" data-mode="dis" title="Disadvantage (rolls with disadvantage)"><i class="fa-solid fa-angles-down"></i> Dis</button>
        </div>
    `,ge=`
        <button type="button" class="ps-whisper-btn cs-whisper-btn ${ue?"active":""}" id="cs-btn-gm-whisper" title="Whisper rolls from this sheet to GM only"><i class="fa-solid fa-user-secret"></i> GM</button>
    `,he=`
        <button type="button" class="ps-settings-cog-btn cs-settings-cog-btn" id="cs-btn-sheet-settings" title="Edit Creature Stats & Settings"><i class="fa-solid fa-gear"></i></button>
    `,ye=s&&!s.isStandaloneSheet?'<button class="cs-popout-btn btn btn-icon btn-secondary btn-xs" id="cs-btn-popout" title="Open Sheet in New Tab"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>':"",I=getMonsterImageUrl(e,t),me=(I||"").split("?")[0].toLowerCase().match(/\.(mp4|webm|ogg)$/i),we=I&&(I.includes("youtube.com/embed")||I.includes("youtube.com/watch")||I.includes("youtu.be/"));let Y="";if(me)Y=`<video src="${I}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;"></video>`;else if(we){let u=I;const b=I.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);if(b){const m=b[1];u=`https://www.youtube.com/embed/${m}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${m}`}Y=`<iframe src="${u}" frameborder="0" allow="autoplay; encrypted-media" style="width:100%; height:100%; pointer-events:none; border:none;"></iframe>`}else{const u=N(e.name||"Creature"),b=typeof window<"u"&&typeof window.getSafeVttUrl=="function"?window.getSafeVttUrl(I):I;Y=`<img src="${N(b)}" alt="${u}" data-fallback-arcane="${u}" style="width:100%; height:100%; object-fit:cover; display:block;">`}i.innerHTML=`
        <!-- Top Toolbar -->
        <div class="cs-top-toolbar ps-top-control-bar">
            <div class="cs-top-toolbar-group">
                ${W}
                ${fe}
            </div>
            <div class="cs-top-toolbar-group ps-actions-group">
                ${ge}
                ${he}
                ${P}
                ${ye}
            </div>
        </div>

        <!-- Header -->
        <div class="cs-header">
            <div class="cs-token-portrait">
                ${Y}
            </div>
            <div class="cs-header-info">
                <h2 class="cs-creature-name">${N(e.name)}</h2>
                <p class="cs-creature-type">${N(k)}</p>
                <div class="cs-header-meta">
                    <div class="cs-cr-badge">CR ${T}</div>
                </div>
            </div>
        </div>

        ${E}

        <div id="cs-tab-stats" class="cs-tab-content active">
            <!-- HP Row -->
            <div class="cs-hp-row">
                <div style="display: flex; gap: 4px; margin-bottom: 8px; align-items: center; width: 100%;">
                    ${(()=>{const u=h>0?Math.max(0,Math.min(100,Math.round(d/h*100))):100;return`<div class="cs-hp-bar-wrap" style="flex: 1;">
                        <div class="cs-hp-bar-fill${u<=25?" danger":u<=50?" injured":""}" id="cs-hp-bar" style="width: ${u}%"></div>
                    </div>`})()}
                    <div class="cs-hp-bar-wrap cs-temp-hp-bar-wrap" id="cs-temp-hp-bar-wrap" style="flex: 0 0 20%; display: ${C>0?"block":"none"};" title="Temp HP">
                        <div class="cs-hp-bar-fill cs-temp-hp-bar-fill" id="cs-temp-hp-bar" style="width: 100%;"></div>
                    </div>
                </div>
                <div class="cs-hp-controls-row">
                    <div class="cs-hp-group">
                        <div class="cs-hp-label">
                            <i class="fa-solid fa-heart" style="color: var(--color-danger-base, #e53935); font-size: 0.85rem;"></i> HP
                        </div>
                        <div class="cs-hp-controls">
                            <button class="cs-hp-btn" id="cs-hp-minus" title="Damage">\u2212</button>
                            <div class="cs-hp-display">
                                <span id="cs-hp-current">${d}</span>
                                <span class="cs-hp-divider">/</span>
                                <span id="cs-hp-max">${h}</span>
                            </div>
                            <button class="cs-hp-btn" id="cs-hp-plus" title="Heal">+</button>
                        </div>
                    </div>
                    <div class="cs-temp-hp-group">
                        <div class="cs-hp-label">
                            <i class="fa-solid fa-shield" style="color: var(--color-temphp-base, #2196f3); font-size: 0.85rem;"></i> Temp
                        </div>
                        <div class="cs-hp-controls">
                            <button class="cs-hp-btn" id="cs-temp-hp-minus" title="Reduce Temp HP">\u2212</button>
                            <div class="cs-hp-display" style="min-width: 28px;">
                                <span id="cs-temp-hp-current">${C}</span>
                            </div>
                            <button class="cs-hp-btn" id="cs-temp-hp-plus" title="Add Temp HP">+</button>
                        </div>
                    </div>
                </div>
                ${v?`<div style="width: 100%; margin-top: 4px;"><span class="cs-hp-formula">${ie(v)}</span></div>`:""}
            </div>

            <!-- Dedicated Combat Stats Row (AC & Initiative) -->
            <div class="cs-combat-stats-row">
                <div class="cs-combat-stat-card">
                    <i class="fa-solid fa-shield-halved cs-combat-stat-icon"></i>
                    <div class="cs-combat-stat-content">
                        <span class="cs-combat-stat-label">Armor Class</span>
                        <span class="cs-combat-stat-value">${G}${L}</span>
                    </div>
                </div>
                <div class="cs-combat-stat-card cs-combat-stat-btn cs-roll-initiative-btn" style="cursor: pointer;" title="Roll Initiative">
                    <i class="fa-solid fa-dice-d20 cs-combat-stat-icon" style="color: var(--color-gold-base);"></i>
                    <div class="cs-combat-stat-content">
                        <span class="cs-combat-stat-label">Initiative</span>
                        <span class="cs-combat-stat-value">${Z}</span>
                    </div>
                </div>
            </div>

            <!-- Secondary Core Stats Pills -->
            <div class="cs-core-stats">
                <div class="cs-stat-pill"><i class="fa-solid fa-shoe-prints"></i><span>${B}</span></div>
                <div class="cs-stat-pill"><i class="fa-solid fa-star"></i><span>Prof +${D}</span></div>
                ${e.passive!==void 0?`<div class="cs-stat-pill"><i class="fa-solid fa-eye"></i><span>Passive ${e.passive}</span></div>`:""}
            </div>

            <!-- Divider -->
            <div class="cs-section-divider"></div>

            <!-- Ability Scores Grid -->
            <div class="cs-ability-grid">${M}</div>

            <!-- Divider -->
            <div class="cs-section-divider"></div>

            <!-- Saves & Skills -->
            ${O?`<div class="cs-info-row"><span class="cs-info-label">Saving Throws</span><span class="cs-info-value">${O}</span></div>`:""}
            ${te?`<div class="cs-info-row"><span class="cs-info-label">Skills</span><span class="cs-info-value">${te}</span></div>`:""}
            ${X}

            <!-- Divider -->
            <div class="cs-section-divider"></div>

            <!-- Global Collapse Control -->
            <div style="display: flex; justify-content: flex-end; padding: 6px 16px 2px 16px;">
                <button id="cs-toggle-all-btn" class="btn btn-secondary btn-xxs" style="font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Expand or collapse all sections and cards">
                    <i class="fa-solid fa-angles-down"></i> <span>Expand All</span>
                </button>
            </div>

            <!-- Traits / Actions / Reactions / Legendary -->
            ${oe}
            ${p}
            ${g}
            ${S}
            ${y}
            ${q}
        </div>

        ${H?`<div id="cs-tab-spells" class="cs-tab-content">${F}</div>`:""}
    `,wireHpControls(i,e,d,h,t,C),Ne(i,e,t),Pe(i,e,t),wireCollapsibleHandlers(i),H&&(wireTabs(i),He(i,e,t),Ve(i,e,t));const re=i.querySelector("#cs-assign-players-btn");re&&l&&re.addEventListener("click",()=>{Ge(l,s||window.VTT,u=>{if((s?.socket||window.VTT?.socket)&&(s?.socket||window.VTT.socket).emit("character:update",{character:u}),window.VTT?.canvasEngine){const b=window.VTT.canvasEngine.getTokens(),m=window.VTT.canvasEngine.getCurrentMapId?window.VTT.canvasEngine.getCurrentMapId():null;Object.values(b).forEach(w=>{(w.characterId===u.id||w.id===n)&&(w.assignedPlayers=[...u.assignedPlayers||[]],window.VTT?.socket&&window.VTT.socket.emit("token:update",{mapId:m,token:w}))})}window.VTT?.playerSheet?.renderCharacterList&&window.VTT.playerSheet.renderCharacterList()})});const ce=i.querySelector(".cs-edit-btn");ce&&ce.addEventListener("click",()=>{pe(e,o,t)});const le=i.querySelector("#cs-btn-popout");le&&le.addEventListener("click",u=>{if(u.preventDefault(),u.stopPropagation(),typeof window<"u"&&window.SheetWindowManager){let b="creature";const m=o&&window.VTT?.campaignState?.characters?.[o];m&&(m.isCompanion?b="companion":m.isCustomNpc&&(b="npc")),window.SheetWindowManager.openPopout({type:b,tokenId:n,characterId:c||o,name:e.name,source:e.source,monsterData:e}),t.minimizePanel&&t.minimizePanel()}});const de=i.querySelector("#cs-btn-sheet-settings");de&&de.addEventListener("click",u=>{u.preventDefault(),u.stopPropagation(),t.openEditModal?t.openEditModal(e,o):pe(e,o,t)}),i.querySelectorAll(".cs-roll-mode-btn").forEach(u=>{u.addEventListener("click",b=>{b.preventDefault(),b.stopPropagation();const m=u.dataset.mode||"normal";typeof window<"u"&&window.VTT?.setGlobalRollMode&&window.VTT.setGlobalRollMode(m),e.activeRollMode=m,l&&(l.activeRollMode=m),t.saveMonsterData&&t.saveMonsterData(e),i.querySelectorAll(".cs-roll-mode-btn").forEach(w=>{w.classList.remove("active","adv","dis"),w.dataset.mode===m&&(w.classList.add("active"),m==="adv"&&w.classList.add("adv"),m==="dis"&&w.classList.add("dis"))})})});const se=i.querySelector("#cs-btn-gm-whisper");se&&se.addEventListener("click",u=>{u.preventDefault(),u.stopPropagation();const m=!!!(typeof window<"u"&&window.VTT?.whisperGM||e.whisperToGM);typeof window<"u"&&window.VTT?.setGlobalWhisperGM&&window.VTT.setGlobalWhisperGM(m),e.whisperToGM=m,l&&(l.whisperToGM=m),t.saveMonsterData&&t.saveMonsterData(e);const w=document.getElementById("config-roll-visibility");w&&(w.value=m?"private":"public",w.dispatchEvent(new Event("change"))),se.classList.toggle("active",m)});const z=i.querySelector("#cs-generic-named-toggle");z&&z.addEventListener("click",u=>{u.preventDefault(),u.stopPropagation();const b=o&&window.VTT?.campaignState?.characters?window.VTT.campaignState.characters[o]:null,w=!(b?b.isGeneric===!0:e.isGeneric===!0);b&&(b.isGeneric=w,window.VTT?.socket&&window.VTT.socket.emit("character:update",{character:b})),e.isGeneric=w,z.className=`btn btn-xs ${w?"btn-secondary":"btn-primary"}`,z.innerHTML=`<i class="${w?"fa-solid fa-people-group":"fa-solid fa-street-view"}"></i> <span>${w?"Generic":"Named"}</span>`,z.title=`Entity Type: ${w?"Generic (independent instanced tokens on canvas)":"Named (linked to central sheet)"}. Click to toggle.`})}
