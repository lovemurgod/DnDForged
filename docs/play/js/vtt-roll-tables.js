import{escapeHtml as m}from"./vtt-utils.js?v=mwzii5ci";export function svgToBase64Uri(o){return typeof btoa=="function"?"data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(o))):"data:image/svg+xml;base64,"+Buffer.from(o).toString("base64")}export function renderTarotCardSvg({name:o="Card",suit:p="",number:v=null,desc:$="",theme:h="tarokka"}={}){let B="#181524",E="#0a0812",x="#d4af37",g="#f59e0b",A="#fef08a",C="\u2726";h==="many_things"?(B="#0f172a",E="#020617",x="#fbbf24",g="#38bdf8",A="#fde047",C="\u263C"):h==="illusions"?(B="#1e1136",E="#0b1329",x="#c084fc",g="#38bdf8",A="#e9d5ff",C="\u25C8"):h==="standard"&&(B="#18181b",E="#09090b",x="#d4af37",g="#e2e8f0",A="#fef08a",C="\u269C");const _=($||"").split(/\s+/).filter(Boolean),T=[];let D="";for(const j of _)if((D+" "+j).trim().length>28){if(D&&T.push(D.trim()),D=j,T.length>=4)break}else D+=(D?" ":"")+j;D&&T.length<4&&T.push(D.trim()),T.length===4&&_.length>28&&(T[3]+="\u2026");const R=275-T.length*8,w=T.map((j,ee)=>`<tspan x="${240/2}" y="${R+ee*16}">${m(j)}</tspan>`).join(""),ye=p?p.toUpperCase():h==="tarokka"?"TAROKKA DECK":"HIGH ARCANA",S=v!=null?`\u2022 ${v} \u2022`:"",H=Math.random().toString(36).substring(2,8),G=`cardGrad_${h}_${H}`,Q=`crestGlow_${h}_${H}`,F=String(o||"Card"),W=F.length>26?10:F.length>18?12:14,q=`
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360" viewBox="0 0 240 360">
  <defs>
    <linearGradient id="${G}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${B}"/>
      <stop offset="100%" stop-color="${E}"/>
    </linearGradient>
    <radialGradient id="${Q}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${x}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${x}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Card Body -->
  <rect width="240" height="360" rx="14" fill="url(#${G})" stroke="${x}" stroke-width="3"/>
  <rect x="8" y="8" width="224" height="344" rx="10" fill="none" stroke="${x}" stroke-width="1" stroke-opacity="0.6"/>
  <rect x="12" y="12" width="216" height="336" rx="8" fill="none" stroke="${x}" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.35"/>

  <!-- Ornate Corner Accents -->
  <circle cx="18" cy="18" r="3" fill="${g}"/>
  <circle cx="222" cy="18" r="3" fill="${g}"/>
  <circle cx="18" cy="342" r="3" fill="${g}"/>
  <circle cx="222" cy="342" r="3" fill="${g}"/>

  <!-- Header Banner -->
  <text x="${240/2}" y="36" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="${A}" letter-spacing="2" text-anchor="middle">${m(ye)}</text>
  ${S?`<text x="${240/2}" y="48" font-family="Georgia, serif" font-size="9" fill="${g}" text-anchor="middle">${S}</text>`:""}

  <!-- Title Plaque -->
  <text x="${240/2}" y="74" font-family="Georgia, serif" font-size="${W}" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${m(F)}</text>

  <!-- Central Crest Frame -->
  <circle cx="${240/2}" cy="155" r="50" fill="url(#${Q})"/>
  <circle cx="${240/2}" cy="155" r="48" fill="rgba(0,0,0,0.4)" stroke="${x}" stroke-width="1.5"/>
  <circle cx="${240/2}" cy="155" r="42" fill="none" stroke="${g}" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.8"/>
  <text x="${240/2}" y="172" font-family="Georgia, serif" font-size="44" fill="${A}" text-anchor="middle">${C}</text>

  <!-- Fortune / Effect Box -->
  <rect x="18" y="235" width="204" height="95" rx="6" fill="rgba(0,0,0,0.5)" stroke="${x}" stroke-width="1" stroke-opacity="0.5"/>
  <line x1="28" y1="247" x2="212" y2="247" stroke="${g}" stroke-width="0.75" stroke-opacity="0.5"/>
  <text font-family="Georgia, serif" font-size="10.5" fill="#f1f5f9" text-anchor="middle" font-style="italic">
    ${w}
  </text>
  <line x1="28" y1="318" x2="212" y2="318" stroke="${g}" stroke-width="0.75" stroke-opacity="0.5"/>
</svg>
`.trim();return svgToBase64Uri(q)}export function renderTarotBackSvg(o="tarokka"){let $="#181524",h="#0a0812",b="#d4af37",L="#f59e0b",B="\u263D \u2726 \u263E";o==="many_things"?($="#0f172a",h="#020617",b="#fbbf24",L="#38bdf8",B="\u263C \u2726 \u263C"):o==="illusions"&&($="#1e1136",h="#0b1329",b="#c084fc",L="#38bdf8",B="\u25C8 \u2726 \u25C8");const E=`
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360" viewBox="0 0 240 360">
  <defs>
    <linearGradient id="backGrad_${o}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${$}"/>
      <stop offset="100%" stop-color="${h}"/>
    </linearGradient>
    <radialGradient id="backCenter_${o}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${b}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${b}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="240" height="360" rx="14" fill="url(#backGrad_${o})" stroke="${b}" stroke-width="3"/>
  <rect x="8" y="8" width="224" height="344" rx="10" fill="none" stroke="${b}" stroke-width="1" stroke-opacity="0.6"/>
  <rect x="14" y="14" width="212" height="332" rx="8" fill="none" stroke="${L}" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.4"/>

  <!-- Geometric Diamond Lattice Pattern -->
  <line x1="20" y1="20" x2="220" y2="340" stroke="${b}" stroke-width="0.5" stroke-opacity="0.25"/>
  <line x1="220" y1="20" x2="20" y2="340" stroke="${b}" stroke-width="0.5" stroke-opacity="0.25"/>
  <polygon points="${240/2},30 210,${360/2} ${240/2},330 30,${360/2}" fill="none" stroke="${b}" stroke-width="1" stroke-opacity="0.4"/>

  <!-- Central Medallion -->
  <circle cx="${240/2}" cy="${360/2}" r="55" fill="url(#backCenter_${o})"/>
  <circle cx="${240/2}" cy="${360/2}" r="50" fill="rgba(0,0,0,0.5)" stroke="${b}" stroke-width="2"/>
  <circle cx="${240/2}" cy="${360/2}" r="44" fill="none" stroke="${L}" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="${240/2}" y="${360/2+8}" font-family="Georgia, serif" font-size="20" fill="${b}" text-anchor="middle" letter-spacing="3">${B}</text>

  <!-- Border Ring of Runes / Dots -->
  <circle cx="${240/2}" cy="45" r="4" fill="${L}"/>
  <circle cx="${240/2}" cy="315" r="4" fill="${L}"/>
  <circle cx="40" cy="${360/2}" r="4" fill="${L}"/>
  <circle cx="200" cy="${360/2}" r="4" fill="${L}"/>
</svg>
`.trim();return svgToBase64Uri(E)}export function shuffleArray(o){const p=[...o];for(let v=p.length-1;v>0;v--){const $=Math.floor(Math.random()*(v+1));[p[v],p[$]]=[p[$],p[v]]}return p}export function findRowForRoll(o,p){if(!Array.isArray(o)||o.length===0)return null;const v=typeof p=="number"?p:parseInt(p,10);for(let h=0;h<o.length;h++){const b=o[h],L=Array.isArray(b)?b:[b],E=String(L[0]||"").trim().split(/[-–—]/);if(E.length===2){let x=parseInt(E[0],10),g=parseInt(E[1],10);if(g===0&&(g=100),x===0&&g!==100&&(x=100),!isNaN(x)&&!isNaN(g)&&v>=x&&v<=g)return{index:h,row:b}}else if(E.length===1&&!isNaN(parseInt(E[0],10))){let x=parseInt(E[0],10);if(x===0&&(x=100),x===v)return{index:h,row:b}}}const $=Math.min(Math.max(1,v||1),o.length)-1;return{index:$,row:o[$]}}export function cleanTableText(o){if(!o)return"";if(typeof o=="object"){if(o.entry)return cleanTableText(o.entry);if(o.text)return cleanTableText(o.text);if(o.name)return cleanTableText(o.name);if(Array.isArray(o))return o.map(cleanTableText).join("; ");if(o.roll){const p=o.roll.exact??(o.roll.min!==void 0?`${o.roll.min}-${o.roll.max}`:"");return p?`${p}`:""}return""}return typeof o!="string"?String(o):o.replace(/\{@damage\s+([^}]+)\}/gi,"$1").replace(/\{@dice\s+([^}]+)\}/gi,"$1").replace(/\{@hit\s+([+-]?\d+)\}/gi,"+$1").replace(/\{@spell\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@item\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@creature\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@condition\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@skill\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@sense\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@table\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1 table").replace(/\{@book\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1").replace(/\{@[a-zA-Z0-9_-]+\s+([^|}]+)(?:\|[^}]+)?\}/gi,"$1")}export function initVttRollTables(o){function p(){return o.campaignState||(o.campaignState={}),o.campaignState.rollTables||(o.campaignState.rollTables={tables:[],assetTables:[],decks:[]}),Array.isArray(o.campaignState.rollTables.tables)||(o.campaignState.rollTables.tables=[]),Array.isArray(o.campaignState.rollTables.assetTables)||(o.campaignState.rollTables.assetTables=[]),Array.isArray(o.campaignState.rollTables.decks)||(o.campaignState.rollTables.decks=[]),o.campaignState.rollTables}p();let v=null,$=null,h=null,b=null,L="",B="",E="";const x=document.getElementById("tab-tables"),g=document.getElementById("roll-tables-list"),A=document.getElementById("asset-tables-list"),C=document.getElementById("card-decks-list"),_=document.getElementById("modal-edit-roll-table"),T=document.getElementById("modal-edit-asset-table"),D=document.getElementById("modal-edit-card-deck"),R=document.getElementById("modal-view-deck-cards"),w=document.getElementById("modal-table-picker")||document.getElementById("modal-load-presets"),ye=w;o.socket&&(o.socket.on("rolltables:updated",a=>{a?.rollTables&&(o.campaignState||(o.campaignState={}),o.campaignState.rollTables=a.rollTables,p(),G())}),o.socket.on("deck:state_updated",a=>{if(a?.deckId&&a?.state){const t=(p().decks||[]).find(e=>e.id===a.deckId);t&&(t.state=a.state,W(),b===a.deckId&&le(t))}}));function S(){const a=p();o.socket&&o.role==="GM"&&o.socket.emit("rolltables:update",{rollTables:a}),G()}function H(a,t){o.socket&&o.socket.emit("deck:state_update",{deckId:a,state:t}),W()}function G(){Q(),F(),W()}function Q(){if(!g)return;const t=(p().tables||[]).filter(e=>e.name.toLowerCase().includes(L.toLowerCase())||e.description&&e.description.toLowerCase().includes(L.toLowerCase()));if(t.length===0){g.innerHTML=`
                <div class="init-empty-state" style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-dice-d20" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; margin: 0;">No roll tables yet.<br>Click <strong>+ New Table</strong> or <strong>Load Table / Presets</strong> to begin.</p>
                </div>`;return}g.innerHTML=t.map(e=>{const n=e.entries?e.entries.length:0,i=`1d${n||1}`,s=e.allowPlayers?'<span class="badge-tag" style="background: rgba(34,197,94,0.2); color: #4ade80; font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; margin-left: 6px;">Players Allowed</span>':"";return`
                <div class="rolltable-card glassmorphism" data-id="${e.id}" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 6px;">
                    <div class="flex-row" style="justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-gold-light);">${m(e.name)}</span>
                            ${s}
                            <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px;">
                                <span class="text-gradient-gold" style="font-weight: bold;">${i}</span> \u2022 ${n} ${n===1?"entry":"entries"}
                            </div>
                        </div>
                        <div class="flex-row" style="gap: 4px;">
                            <button class="btn btn-xxs btn-secondary btn-table-edit" data-id="${e.id}" title="Edit Table"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-xxs btn-secondary btn-table-clone" data-id="${e.id}" title="Clone Table"><i class="fa-solid fa-clone"></i></button>
                            <button class="btn btn-xxs btn-danger btn-table-delete" data-id="${e.id}" title="Delete Table"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    ${e.description?`<p style="font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; line-height: 1.3;">${m(e.description)}</p>`:""}
                    <div class="flex-row" style="gap: 6px; margin-top: 4px;">
                        <button class="btn btn-xs btn-primary btn-table-roll-public" data-id="${e.id}" style="flex: 1;" title="Roll table publicly to chat">
                            <i class="fa-solid fa-dice-d20"></i> Roll (${i})
                        </button>
                        <button class="btn btn-xs btn-secondary btn-table-roll-whisper" data-id="${e.id}" title="Roll table quietly (GM Whisper)">
                            <i class="fa-solid fa-user-secret"></i> Whisper
                        </button>
                    </div>
                </div>
            `}).join(""),g.querySelectorAll(".btn-table-roll-public").forEach(e=>{e.addEventListener("click",()=>j(e.dataset.id,!1))}),g.querySelectorAll(".btn-table-roll-whisper").forEach(e=>{e.addEventListener("click",()=>j(e.dataset.id,!0))}),g.querySelectorAll(".btn-table-edit").forEach(e=>{e.addEventListener("click",()=>ke(e.dataset.id))}),g.querySelectorAll(".btn-table-clone").forEach(e=>{e.addEventListener("click",()=>et(e.dataset.id))}),g.querySelectorAll(".btn-table-delete").forEach(e=>{e.addEventListener("click",()=>tt(e.dataset.id))})}function F(){if(!A)return;const a=p().assetTables||[],t=a.filter(e=>e.name.toLowerCase().includes(B.toLowerCase()));if(t.length===0){A.innerHTML=`
                <div class="init-empty-state" style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-images" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; margin: 0;">No asset tables yet.<br>Click <strong>+ New Asset Table</strong> to create flippable tokens.</p>
                </div>`;return}A.innerHTML=t.map(e=>{const n=e.entries||[],i=n.slice(0,5).map(s=>`
                <div style="width: 38px; height: 38px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #000; flex-shrink: 0;" title="${m(s.name||"Side")}">
                    <img src="${m(s.url)}" alt="${m(s.name)}" style="width: 100%; height: 100%; object-fit: cover;" data-fallback-src="favicon.svg">
                </div>
            `).join("");return`
                <div class="rolltable-card glassmorphism" data-id="${e.id}" draggable="true" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 6px; cursor: grab;">
                    <div class="flex-row" style="justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-gold-light);">${m(e.name)}</span>
                            <span style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 6px;">(${n.length} ${n.length===1?"side":"sides"})</span>
                        </div>
                        <div class="flex-row" style="gap: 4px;">
                            <button class="btn btn-xxs btn-secondary btn-asset-table-edit" data-id="${e.id}" title="Edit Asset Table"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-xxs btn-danger btn-asset-table-delete" data-id="${e.id}" title="Delete Asset Table"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="flex-row scroll-styled" style="gap: 6px; overflow-x: auto; padding: 4px 0;">
                        ${i}
                        ${n.length>5?`<div style="font-size: 0.75rem; color: var(--color-text-muted); align-self: center;">+${n.length-5} more</div>`:""}
                    </div>
                    <div class="flex-row" style="gap: 6px; margin-top: 4px;">
                        <button class="btn btn-xs btn-primary btn-asset-table-place" data-id="${e.id}" style="flex: 1;" title="Place flippable token at map center">
                            <i class="fa-solid fa-crosshairs"></i> Place on Canvas
                        </button>
                    </div>
                </div>
            `}).join(""),A.querySelectorAll(".rolltable-card").forEach(e=>{e.addEventListener("dragstart",n=>{const i=e.dataset.id,s=a.find(l=>l.id===i);if(!s)return;const r=JSON.stringify({type:"asset-table",tableId:s.id,name:s.name,size:s.defaultTokenSize||1,entries:s.entries});n.dataTransfer.setData("application/json",r),n.dataTransfer.setData("text/plain",r),n.dataTransfer.effectAllowed="copy"})}),A.querySelectorAll(".btn-asset-table-place").forEach(e=>{e.addEventListener("click",()=>ee(e.dataset.id))}),A.querySelectorAll(".btn-asset-table-edit").forEach(e=>{e.addEventListener("click",()=>$e(e.dataset.id))}),A.querySelectorAll(".btn-asset-table-delete").forEach(e=>{e.addEventListener("click",()=>it(e.dataset.id))})}function W(){if(!C)return;const t=(p().decks||[]).filter(e=>e.name.toLowerCase().includes(E.toLowerCase()));if(t.length===0){C.innerHTML=`
                <div class="init-empty-state" style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
                    <i class="fa-solid fa-layer-group" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; margin: 0;">No card decks yet.<br>Click <strong>+ New Deck</strong> or <strong>Load Deck Preset</strong> to begin.</p>
                </div>`;return}C.innerHTML=t.map(e=>{q(e);const n=e.state.drawPile.length,i=e.state.discardPile.length,s=e.state.drawnCards?e.state.drawnCards.length:0,r=(e.cards||[]).length;return`
                <div class="rolltable-card glassmorphism" data-id="${e.id}" style="padding: 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 8px;">
                    <div class="flex-row" style="gap: 10px; align-items: center;">
                        <div style="width: 44px; height: 60px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #111; flex-shrink: 0;" title="Card Back">
                            <img src="${m(e.backImg)}" alt="Card Back" style="width: 100%; height: 100%; object-fit: cover;" data-fallback-src="favicon.svg">
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="flex-row" style="justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.9rem; color: var(--color-gold-light);">${m(e.name)}</span>
                                <div class="flex-row" style="gap: 4px;">
                                    <button class="btn btn-xxs btn-secondary btn-deck-edit" data-id="${e.id}" title="Edit Deck"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-xxs btn-danger btn-deck-delete" data-id="${e.id}" title="Delete Deck"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">
                                <span title="Draw Pile" style="color: #60a5fa;"><i class="fa-solid fa-clone"></i> Draw: <strong>${n}</strong></span> \u2022 
                                <span title="Discard Pile" style="color: #f87171;"><i class="fa-solid fa-trash-can"></i> Discard: <strong>${i}</strong></span> \u2022 
                                <span title="Total Cards">${r} total</span>
                            </div>
                        </div>
                    </div>

                    <!-- Action Controls -->
                    <div class="flex-row" style="gap: 6px;">
                        <button class="btn btn-xs btn-primary btn-deck-draw" data-id="${e.id}" style="flex: 1;" ${n===0?"disabled":""} title="Draw top card">
                            <i class="fa-solid fa-hand"></i> Draw
                        </button>
                        <button class="btn btn-xs btn-secondary btn-deck-shuffle" data-id="${e.id}" title="Shuffle Draw Pile">
                            <i class="fa-solid fa-shuffle"></i> Shuffle
                        </button>
                        <button class="btn btn-xs btn-secondary btn-deck-view-cards" data-id="${e.id}" title="Inspect Drawn / Discarded Cards">
                            <i class="fa-solid fa-eye"></i> Cards
                        </button>
                        <button class="btn btn-xs btn-ghost btn-deck-recall" data-id="${e.id}" title="Recall all cards back to deck and shuffle">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                    </div>
                </div>
            `}).join(""),C.querySelectorAll(".btn-deck-draw").forEach(e=>{e.addEventListener("click",()=>he(e.dataset.id))}),C.querySelectorAll(".btn-deck-shuffle").forEach(e=>{e.addEventListener("click",()=>xe(e.dataset.id))}),C.querySelectorAll(".btn-deck-view-cards").forEach(e=>{e.addEventListener("click",()=>ve(e.dataset.id))}),C.querySelectorAll(".btn-deck-recall").forEach(e=>{e.addEventListener("click",()=>we(e.dataset.id))}),C.querySelectorAll(".btn-deck-edit").forEach(e=>{e.addEventListener("click",()=>Ee(e.dataset.id))}),C.querySelectorAll(".btn-deck-delete").forEach(e=>{e.addEventListener("click",()=>rt(e.dataset.id))})}function q(a){a.state||(a.state={drawPile:[],discardPile:[],drawnCards:[]}),Array.isArray(a.state.drawPile)||(a.state.drawPile=[]),Array.isArray(a.state.discardPile)||(a.state.discardPile=[]),Array.isArray(a.state.drawnCards)||(a.state.drawnCards=[]),a.state.drawPile.length===0&&a.state.discardPile.length===0&&a.cards&&a.cards.length>0&&(a.state.drawPile=shuffleArray(a.cards.map(t=>t.id)))}function j(a,t=!1){const e=(p().tables||[]).find(l=>l.id===a);if(!e||!e.entries||e.entries.length===0){o.toast&&o.toast("This table has no entries to roll from.","error");return}const n=e.entries.length,i=Math.floor(Math.random()*n)+1,s=e.entries[i-1];if(window.Dice3D&&typeof window.Dice3D.showDiceRoll=="function")try{window.Dice3D.showDiceRoll([{faces:n,val:i}])}catch(l){console.warn("3D dice error:",l)}const r=`
            <div class="rolltable-chat-card" style="border: 1px solid var(--color-gold-base); border-radius: 6px; padding: 10px; background: rgba(18, 22, 33, 0.95); box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gold-light); font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                    <span><i class="fa-solid fa-dice-d20"></i> ${m(e.name)}</span>
                    <span style="color: #60a5fa;">[d${n}: ${i}]</span>
                </div>
                <div style="font-weight: 600; font-size: 0.95rem; color: #fff; margin-bottom: 2px;">
                    ${m(s.name||`Result #${i}`)}
                </div>
                ${s.text?`<div style="font-size: 0.85rem; color: var(--color-text-secondary); line-height: 1.4;">${m(s.text)}</div>`:""}
            </div>
        `;o.socket&&o.socket.emit("chat:msg",{html:r,rollTableCard:{tableName:e.name,formula:`1d${n}`,roll:i,entryName:s.name||`Result #${i}`,entryText:s.text||""},text:`Rolled on table ${e.name}: ${s.name||i}`,whisperToGM:t})}function ee(a){const t=(p().assetTables||[]).find(f=>f.id===a);if(!t||!t.entries||t.entries.length===0)return;const e=window.VTT?.canvasEngine;if(!e)return;const n=e.getGrid(),i=t.defaultTokenSize||1,s=i*n.size*n.scale,r=document.getElementById("vtt-canvas-viewport"),l=r?r.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:window.innerHeight},d=e.getCanvasMouseCoords({clientX:l.left+l.width/2,clientY:l.top+l.height/2}),c={id:`token_table_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,name:t.name,x:d.x-s/2,y:d.y-s/2,hp:0,maxHp:0,size:i,img:t.entries[0]?.url||"favicon.svg",tokenImages:t.entries.map((f,u)=>({url:f.url,name:f.name||`Side ${u+1}`})),activeTokenIndex:0,isAssetTable:!0,assetTableId:t.id,isPlayer:!1,layer:e.getActiveLayer()||"token",isBorderless:!0};e.addToken(c),o.toast&&o.toast(`Placed flippable token: ${t.name}`)}function he(a){const t=(p().decks||[]).find(s=>s.id===a);if(!t||!t.cards)return;if(q(t),t.state.drawPile.length===0){o.toast&&o.toast("Draw pile is empty! Shuffle discard pile first.","warning");return}const e=document.createElement("div");e.id="modal-draw-destination",e.className="vtt-modal-backdrop animated-fade-in",e.style.cssText="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:10000; display:flex; align-items:center; justify-content:center;",e.innerHTML=`
            <div class="glassmorphism" style="width:320px; padding:18px; border-radius:8px; border:1px solid var(--color-gold-base); background:#18181b;">
                <h4 style="margin:0 0 12px 0; color:var(--color-gold-light); font-size:1rem;"><i class="fa-solid fa-hand"></i> Draw from ${m(t.name)}</h4>
                <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:14px;">Cards remaining in draw pile: <strong>${t.state.drawPile.length}</strong></p>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn btn-sm btn-primary btn-dest-chat"><i class="fa-solid fa-comments"></i> Draw to Chat (Public)</button>
                    <button class="btn btn-sm btn-secondary btn-dest-whisper"><i class="fa-solid fa-user-secret"></i> Draw to Chat (Whisper to GM)</button>
                    <button class="btn btn-sm btn-secondary btn-dest-canvas"><i class="fa-solid fa-map"></i> Play Card to Tabletop</button>
                    <button class="btn btn-sm btn-ghost btn-dest-hand"><i class="fa-solid fa-hand-holding"></i> Draw to Hand (View Only)</button>
                </div>
                <div style="margin-top:14px; text-align:right;">
                    <button class="btn btn-xs btn-ghost btn-cancel-draw">Cancel</button>
                </div>
            </div>
        `,document.body.appendChild(e);const n=()=>e.remove();e.querySelector(".btn-cancel-draw").addEventListener("click",n);const i=(s,r=!1)=>{if(n(),!t.state?.drawPile||t.state.drawPile.length===0){o.toast&&o.toast("The draw pile is empty. Please reshuffle discard pile back into deck.","info");return}const l=t.state.drawPile.shift(),d=t.cards.find(c=>c.id===l);if(d)if(t.state.drawnCards.push(l),H(t.id,t.state),s==="chat"){const c=`
                    <div class="card-draw-chat" style="border: 1px solid var(--color-gold-base); border-radius: 8px; padding: 12px; background: rgba(18, 22, 33, 0.95); max-width: 260px; margin: 0 auto; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                        <div style="font-size: 0.75rem; color: var(--color-gold-light); text-transform: uppercase; font-weight: bold; margin-bottom: 6px;">
                            ${m(t.name)}
                        </div>
                        <div style="width: 140px; height: 200px; margin: 0 auto 8px auto; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #000;">
                            <img src="${m(d.frontImg)}" alt="${m(d.name)}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div style="font-weight: 600; font-size: 0.95rem; color: #fff;">${m(d.name)}</div>
                        ${d.description?`<div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px; line-height: 1.3;">${m(d.description)}</div>`:""}
                    </div>
                `;o.socket&&o.socket.emit("chat:msg",{html:c,cardDrawCard:{deckName:t.name,cardName:d.name,cardImg:d.frontImg,description:d.description||""},text:`Drew card from ${t.name}: ${d.name}`,whisperToGM:r})}else s==="canvas"?re(t,d):s==="hand"&&ve(t.id)};e.querySelector(".btn-dest-chat").addEventListener("click",()=>i("chat",!1)),e.querySelector(".btn-dest-whisper").addEventListener("click",()=>i("chat",!0)),e.querySelector(".btn-dest-canvas").addEventListener("click",()=>i("canvas")),e.querySelector(".btn-dest-hand").addEventListener("click",()=>i("hand"))}function re(a,t,e=null){const n=window.VTT?.canvasEngine;if(!n)return;const i=n.getGrid(),s=Math.round(140*i.scale),r=Math.round(210*i.scale);let l=0,d=0;if(e)l=e.x-s/2,d=e.y-r/2;else{const f=document.getElementById("vtt-canvas-viewport"),u=f?f.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:window.innerHeight},I=n.getCanvasMouseCoords({clientX:u.left+u.width/2,clientY:u.top+u.height/2});l=I.x-s/2,d=I.y-r/2}const c={id:`token_card_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,name:t.name,x:l,y:d,hp:0,maxHp:0,size:1,pixelWidth:s,pixelHeight:r,img:t.frontImg,tokenImages:[{url:t.frontImg,name:`${t.name} (Face)`},{url:a.backImg,name:`${a.name} (Back)`}],activeTokenIndex:0,isAsset:!0,isBorderless:!1,isCardToken:!0,cardId:t.id,deckId:a.id,isPlayer:!1,layer:n.getActiveLayer()||"map",imgRadius:"6px"};n.addToken(c),o.toast&&o.toast(`Placed card "${t.name}" on canvas.`)}function xe(a){const t=(p().decks||[]).find(n=>n.id===a);if(!t)return;q(t),confirm("Shuffle discard pile back into the draw pile as well?")&&t.state.discardPile.length>0&&(t.state.drawPile=[...t.state.drawPile,...t.state.discardPile],t.state.discardPile=[]),t.state.drawPile=shuffleArray(t.state.drawPile),H(t.id,t.state),o.toast&&o.toast(`Shuffled ${t.name} (${t.state.drawPile.length} cards in draw pile)`)}function we(a){const t=(p().decks||[]).find(e=>e.id===a);!t||!t.cards||confirm(`Recall all cards in "${t.name}" back into the deck and shuffle?`)&&(t.state={drawPile:shuffleArray(t.cards.map(e=>e.id)),discardPile:[],drawnCards:[]},H(t.id,t.state),o.toast&&o.toast(`Recalled and shuffled all ${t.cards.length} cards in ${t.name}`))}function ve(a){const t=(p().decks||[]).find(e=>e.id===a);t&&(q(t),b=t.id,le(t),R&&R.classList.remove("vtt-hidden"))}function le(a){if(!R)return;const t=R.querySelector("#view-deck-title"),e=R.querySelector("#view-deck-drawn-cards"),n=R.querySelector("#view-deck-discard-cards");t&&(t.textContent=a.name);const i=(a.state.drawnCards||[]).map(r=>a.cards.find(l=>l.id===r)).filter(Boolean);e&&(i.length===0?e.innerHTML='<div class="text-muted" style="font-size:0.8rem; padding:8px;">No cards currently drawn or in play.</div>':(e.innerHTML=i.map(r=>`
                    <div class="deck-drawn-card-item" draggable="true" data-card-id="${r.id}" style="width:110px; cursor:grab; border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.2); background:#18181b; padding:6px; display:flex; flex-direction:column; gap:4px; align-items:center;">
                        <img src="${m(r.frontImg)}" alt="${m(r.name)}" style="width:100%; height:130px; object-fit:contain; border-radius:4px; background:#000;">
                        <div style="font-size:0.75rem; font-weight:600; text-align:center; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${m(r.name)}</div>
                        <div class="flex-row" style="gap:4px; width:100%;">
                            <button class="btn btn-xxs btn-danger btn-card-discard" data-deck="${a.id}" data-card="${r.id}" style="flex:1;" title="Discard Card"><i class="fa-solid fa-trash-can"></i></button>
                            <button class="btn btn-xxs btn-primary btn-card-play" data-deck="${a.id}" data-card="${r.id}" style="flex:1;" title="Play to Canvas"><i class="fa-solid fa-map"></i></button>
                        </div>
                    </div>
                `).join(""),e.querySelectorAll(".deck-drawn-card-item").forEach(r=>{r.addEventListener("dragstart",l=>{const d=r.dataset.cardId,c=a.cards.find(u=>u.id===d);if(!c)return;const f=JSON.stringify({type:"card",cardId:c.id,deckId:a.id,name:c.name,frontImg:c.frontImg,deckBackImg:a.backImg,deckName:a.name,description:c.description});l.dataTransfer.setData("application/json",f),l.dataTransfer.setData("text/plain",f),l.dataTransfer.effectAllowed="copy"})}),e.querySelectorAll(".btn-card-discard").forEach(r=>{r.addEventListener("click",()=>{Ke(r.dataset.deck,r.dataset.card)})}),e.querySelectorAll(".btn-card-play").forEach(r=>{r.addEventListener("click",()=>{const l=a.cards.find(d=>d.id===r.dataset.card);l&&re(a,l)})})));const s=(a.state.discardPile||[]).map(r=>a.cards.find(l=>l.id===r)).filter(Boolean);n&&(s.length===0?n.innerHTML='<div class="text-muted" style="font-size:0.8rem; padding:8px;">Discard pile is empty.</div>':n.innerHTML=s.map(r=>`
                    <div style="width:90px; border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#111; padding:4px; display:flex; flex-direction:column; align-items:center; opacity:0.75;">
                        <img src="${m(r.frontImg)}" alt="${m(r.name)}" style="width:100%; height:100px; object-fit:contain;">
                        <div style="font-size:0.7rem; color:var(--color-text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${m(r.name)}</div>
                    </div>
                `).join(""))}function Ke(a,t){const e=(p().decks||[]).find(n=>n.id===a);e&&(q(e),e.state.drawnCards=(e.state.drawnCards||[]).filter(n=>n!==t),e.state.discardPile.push(t),H(e.id,e.state),le(e))}function ke(a=null){v=a;const t=document.getElementById("edit-table-name"),e=document.getElementById("edit-table-desc"),n=document.getElementById("edit-table-allow-players"),i=document.getElementById("edit-table-entries-container");if(!_)return;let s=null;a&&(s=(p().tables||[]).find(l=>l.id===a)),t&&(t.value=s?.name||""),e&&(e.value=s?.description||""),n&&(n.checked=!!s?.allowPlayers);const r=s?.entries?JSON.parse(JSON.stringify(s.entries)):[];oe(r,i),_.classList.remove("vtt-hidden")}function oe(a,t){t&&(t.innerHTML=`
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">Table Entries (${a.length}):</label>
                <button type="button" class="btn btn-xxs btn-secondary btn-add-table-entry"><i class="fa-solid fa-plus"></i> Add Entry</button>
            </div>
            <div class="scroll-styled table-entries-rows" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${a.map((e,n)=>`
                    <div class="table-entry-row flex-row" style="gap:6px; align-items:center; background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);" data-idx="${n}">
                        <span style="font-size:0.75rem; color:var(--color-gold-base); font-weight:bold; width:22px; text-align:center;">${n+1}</span>
                        <input type="text" class="entry-name" value="${m(e.name||"")}" placeholder="Title / Result" style="width:120px; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="entry-text" value="${m(e.text||"")}" placeholder="Description / details (optional)" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <button type="button" class="btn btn-xxs btn-danger btn-del-entry"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `).join("")}
            </div>
        `,t.querySelector(".btn-add-table-entry").addEventListener("click",()=>{a.push({id:`entry_${Date.now()}_${a.length}`,name:"",text:""}),oe(a,t)}),t.querySelectorAll(".btn-del-entry").forEach(e=>{e.addEventListener("click",n=>{const i=n.target.closest(".table-entry-row"),s=parseInt(i.dataset.idx,10);a.splice(s,1),oe(a,t)})}),t._entries=a)}function Ze(){const a=document.getElementById("edit-table-name"),t=document.getElementById("edit-table-desc"),e=document.getElementById("edit-table-allow-players"),n=document.getElementById("edit-table-entries-container"),i=a?a.value.trim():"";if(!i){alert("Please provide a name for this roll table.");return}const s=n.querySelectorAll(".table-entry-row"),r=[];s.forEach((c,f)=>{const u=c.querySelector(".entry-name").value.trim()||`Option ${f+1}`,I=c.querySelector(".entry-text").value.trim();r.push({id:`e_${f+1}`,name:u,text:I})});const d=p().tables;if(v){const c=d.find(f=>f.id===v);c&&(c.name=i,c.description=t?t.value.trim():"",c.allowPlayers=e?e.checked:!1,c.entries=r)}else d.push({id:`table_${Date.now()}`,name:i,description:t?t.value.trim():"",allowPlayers:e?e.checked:!1,entries:r});S(),_&&_.classList.add("vtt-hidden")}function et(a){const t=p(),e=(t.tables||[]).find(i=>i.id===a);if(!e)return;const n=JSON.parse(JSON.stringify(e));n.id=`table_${Date.now()}`,n.name=`${n.name} (Copy)`,t.tables.push(n),S()}function tt(a){if(!confirm("Are you sure you want to delete this roll table?"))return;const t=p();t.tables=(t.tables||[]).filter(e=>e.id!==a),S()}function $e(a=null){$=a;const t=document.getElementById("edit-asset-table-name"),e=document.getElementById("edit-asset-table-size"),n=document.getElementById("edit-asset-table-entries-container");if(!T)return;let i=null;a&&(i=(p().assetTables||[]).find(r=>r.id===a)),t&&(t.value=i?.name||""),e&&(e.value=i?.defaultTokenSize||1);const s=i?.entries?JSON.parse(JSON.stringify(i.entries)):[];O(s,n),T.classList.remove("vtt-hidden")}function O(a,t){if(!t)return;t.innerHTML=`
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:6px; flex-wrap:wrap;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">Artworks / Sides (${a.length}):</label>
                <div class="flex-row" style="gap:4px;">
                    <button type="button" class="btn btn-xxs btn-primary btn-add-from-gallery" title="Select images from Asset Gallery"><i class="fa-solid fa-images"></i> Add from Gallery</button>
                    <button type="button" class="btn btn-xxs btn-secondary btn-add-asset-side"><i class="fa-solid fa-plus"></i> Add Side</button>
                </div>
            </div>
            <div class="scroll-styled asset-side-rows" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${a.map((n,i)=>`
                    <div class="asset-side-row flex-row" style="gap:6px; align-items:center; background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);" data-idx="${i}">
                        <div style="width:32px; height:32px; border-radius:4px; overflow:hidden; background:#000; flex-shrink:0;">
                            <img src="${m(n.url||"favicon.svg")}" alt="Preview" style="width:100%; height:100%; object-fit:cover;" data-fallback-src="favicon.svg">
                        </div>
                        <input type="text" class="side-name" value="${m(n.name||"")}" placeholder="Label (e.g. Active, Broken)" style="width:120px; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="side-url" value="${m(n.url||"")}" placeholder="Artwork Image / Video URL" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <button type="button" class="btn btn-xxs btn-secondary btn-pick-gallery-side" title="Pick from Asset Gallery"><i class="fa-solid fa-images"></i></button>
                        <button type="button" class="btn btn-xxs btn-danger btn-del-side" title="Remove Side"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `).join("")}
            </div>
        `,t.querySelector(".btn-add-asset-side").addEventListener("click",()=>{a.push({id:`side_${Date.now()}_${a.length}`,name:`Side ${a.length+1}`,url:""}),O(a,t)});const e=t.querySelector(".btn-add-from-gallery");e&&e.addEventListener("click",()=>{window.VTT?.openAssetPickerModal?window.VTT.openAssetPickerModal({multiSelect:!0,onSelect:n=>{!Array.isArray(n)||n.length===0||(n.forEach((i,s)=>{const r=(i.name||`Side ${a.length+1}`).replace(/\.[^/.]+$/,"");a.push({id:`side_${Date.now()}_${a.length+s}`,name:r,url:i.url||""})}),O(a,t))}}):alert("Asset gallery picker is not initialized.")}),t.querySelectorAll(".btn-pick-gallery-side").forEach(n=>{n.addEventListener("click",i=>{const s=i.target.closest(".asset-side-row"),r=parseInt(s.dataset.idx,10);window.VTT?.openAssetPickerModal&&window.VTT.openAssetPickerModal({multiSelect:!1,onSelect:l=>{if(!Array.isArray(l)||l.length===0)return;const d=l[0];a[r].url=d.url,(!a[r].name||a[r].name.startsWith("Side "))&&(a[r].name=(d.name||"").replace(/\.[^/.]+$/,"")||a[r].name),O(a,t)}})})}),t.querySelectorAll(".btn-del-side").forEach(n=>{n.addEventListener("click",i=>{const s=i.target.closest(".asset-side-row"),r=parseInt(s.dataset.idx,10);a.splice(r,1),O(a,t)})}),t.querySelectorAll(".side-url").forEach(n=>{n.addEventListener("change",()=>{const i=n.closest(".asset-side-row"),s=parseInt(i.dataset.idx,10);a[s]&&(a[s].url=n.value.trim());const r=i.querySelector("img");r&&(r.src=n.value.trim()||"favicon.svg")})}),t.querySelectorAll(".side-name").forEach(n=>{n.addEventListener("change",()=>{const i=n.closest(".asset-side-row"),s=parseInt(i.dataset.idx,10);a[s]&&(a[s].name=n.value.trim())})})}function at(a=[]){$=null;const t=document.getElementById("edit-asset-table-name"),e=document.getElementById("edit-asset-table-size"),n=document.getElementById("edit-asset-table-entries-container");if(t){const s=a.length>0&&a[0]?.name?a[0].name.replace(/\.[^/.]+$/,""):"New Asset Table";t.value=a.length>0?`${s} Set`:"New Asset Table"}e&&(e.value=1);const i=a.map((s,r)=>({id:`side_${Date.now()}_${r}`,name:(s.name||`Side ${r+1}`).replace(/\.[^/.]+$/,""),url:s.url||""}));O(i,n),T&&T.classList.remove("vtt-hidden")}function nt(){const a=document.getElementById("edit-asset-table-name"),t=document.getElementById("edit-asset-table-size"),e=document.getElementById("edit-asset-table-entries-container"),n=a?a.value.trim():"";if(!n){alert("Please provide a name for this asset table.");return}const i=e.querySelectorAll(".asset-side-row"),s=[];if(i.forEach((c,f)=>{const u=c.querySelector(".side-name").value.trim()||`Side ${f+1}`,I=c.querySelector(".side-url").value.trim();I&&s.push({id:`side_${f+1}`,name:u,url:I})}),s.length===0){alert("Please add at least one artwork URL to the asset table.");return}const r=t&&parseFloat(t.value)||1,d=p().assetTables;if($){const c=d.find(f=>f.id===$);c&&(c.name=n,c.defaultTokenSize=r,c.entries=s)}else d.push({id:`asset_table_${Date.now()}`,name:n,defaultTokenSize:r,entries:s});S(),T&&T.classList.add("vtt-hidden")}function it(a){if(!confirm("Are you sure you want to delete this asset table?"))return;const t=p();t.assetTables=(t.assetTables||[]).filter(e=>e.id!==a),S()}function Ee(a=null){h=a;const t=document.getElementById("edit-deck-name"),e=document.getElementById("edit-deck-back"),n=document.getElementById("edit-deck-cards-container");if(!D)return;let i=null;a&&(i=(p().decks||[]).find(r=>r.id===a)),t&&(t.value=i?.name||""),e&&(e.value=i?.backImg||"");const s=i?.cards?JSON.parse(JSON.stringify(i.cards)):[];de(s,n),D.classList.remove("vtt-hidden")}function de(a,t){t&&(t.innerHTML=`
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--color-gold-light);">Deck Cards (${a.length}):</label>
                <button type="button" class="btn btn-xxs btn-secondary btn-add-deck-card"><i class="fa-solid fa-plus"></i> Add Card</button>
            </div>
            <div class="scroll-styled deck-card-rows" style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${a.map((e,n)=>`
                    <div class="deck-card-row flex-row" style="gap:6px; align-items:center; background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);" data-idx="${n}">
                        <div style="width:30px; height:42px; border-radius:3px; overflow:hidden; background:#000; flex-shrink:0;">
                            <img src="${m(e.frontImg||"favicon.svg")}" alt="Card" style="width:100%; height:100%; object-fit:contain;" data-fallback-src="favicon.svg">
                        </div>
                        <input type="text" class="card-name" value="${m(e.name||"")}" placeholder="Card Name" style="width:110px; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="card-url" value="${m(e.frontImg||"")}" placeholder="Front Artwork URL" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <input type="text" class="card-desc" value="${m(e.description||"")}" placeholder="Description / Text" style="flex:1; font-size:0.75rem; padding:4px 6px;">
                        <button type="button" class="btn btn-xxs btn-danger btn-del-card"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `).join("")}
            </div>
        `,t.querySelector(".btn-add-deck-card").addEventListener("click",()=>{a.push({id:`card_${Date.now()}_${a.length}`,name:"",frontImg:"",description:""}),de(a,t)}),t.querySelectorAll(".btn-del-card").forEach(e=>{e.addEventListener("click",n=>{const i=n.target.closest(".deck-card-row"),s=parseInt(i.dataset.idx,10);a.splice(s,1),de(a,t)})}),t.querySelectorAll(".card-url").forEach(e=>{e.addEventListener("change",()=>{const i=e.closest(".deck-card-row").querySelector("img");i&&(i.src=e.value.trim()||"favicon.svg")})}))}function st(){const a=document.getElementById("edit-deck-name"),t=document.getElementById("edit-deck-back"),e=document.getElementById("edit-deck-cards-container"),n=a?a.value.trim():"",i=t&&t.value.trim()||"img/TextLogo.png";if(!n){alert("Please provide a name for this card deck.");return}const s=e.querySelectorAll(".deck-card-row"),r=[];s.forEach((c,f)=>{const u=c.querySelector(".card-name").value.trim()||`Card ${f+1}`,I=c.querySelector(".card-url").value.trim(),y=c.querySelector(".card-desc").value.trim();(I||u)&&r.push({id:`card_${f+1}`,name:u,frontImg:I,description:y})});const d=p().decks;if(h){const c=d.find(f=>f.id===h);c&&(c.name=n,c.backImg=i,c.cards=r,q(c))}else{const c={id:`deck_${Date.now()}`,name:n,backImg:i,cards:r,state:{drawPile:shuffleArray(r.map(f=>f.id)),discardPile:[],drawnCards:[]}};d.push(c)}S(),D&&D.classList.add("vtt-hidden")}function rt(a){if(!confirm("Are you sure you want to delete this deck?"))return;const t=p();t.decks=(t.decks||[]).filter(e=>e.id!==a),S()}let k=null,te=!1,ce="",fe="",me="",J="name",X="asc",ae=null,V=null,Y=null,ne=!1,pe="",ie=null,Le=null;function ct(a="compendium"){se(a)}function se(a="compendium"){w&&(Te(a),w.classList.remove("vtt-hidden"),a==="compendium"&&!k&&!te?Se():a==="decks"&&!Y&&!ne&&Ie())}function Te(a){w.querySelectorAll(".picker-tab-btn").forEach(s=>{const r=s.dataset.tab===a;s.classList.toggle("active",r),s.style.color=r?"var(--color-gold-light)":"var(--color-text-secondary)",s.style.borderBottomColor=r?"var(--color-gold-base)":"transparent"});const e=document.getElementById("picker-tab-content-compendium"),n=document.getElementById("picker-tab-content-presets"),i=document.getElementById("picker-tab-content-decks");e&&e.classList.toggle("vtt-hidden",a!=="compendium"),n&&n.classList.toggle("vtt-hidden",a!=="presets"),i&&i.classList.toggle("vtt-hidden",a!=="decks"),a==="compendium"&&!k&&!te?Se():a==="decks"&&!Y&&!ne&&Ie()}async function Se(){te=!0;const a=document.getElementById("picker-table-rows");a&&(a.innerHTML=`
                    <div class="p-3 text-muted" style="text-align:center; padding:32px 0;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:8px;"></i>
                        <div>Loading tables...</div>
                    </div>
                `);try{const t=await fetch("/api/tables/catalog");if(!t.ok)throw new Error("Failed to fetch tables catalog");k=await t.json();const e=document.getElementById("picker-source-select");if(e){const n=Array.from(new Set(k.map(i=>i.source).filter(Boolean))).sort();e.innerHTML='<option value="">All Sources</option>'+n.map(i=>`<option value="${m(i)}">${m(i)}</option>`).join("")}K()}catch(t){console.error("Error loading compendium tables catalog:",t),a&&(a.innerHTML=`
                        <div class="p-3 text-danger" style="text-align:center; padding:24px 0;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Error loading tables.
                        </div>
                    `)}finally{te=!1}}function K(){const a=document.getElementById("picker-table-rows"),t=document.getElementById("picker-count-label");if(!a||!k)return;let e=k.filter(i=>{if(fe&&i.source!==fe)return!1;if(me){const s=me.toLowerCase();if(!(i.dice||"").toLowerCase().includes(s))return!1}if(ce){const s=ce.toLowerCase(),r=(i.name||"").toLowerCase(),l=(i.chapter||"").toLowerCase();if(!r.includes(s)&&!l.includes(s))return!1}return!0});if(e.sort((i,s)=>{let r=0;return J==="name"?r=(i.name||"").localeCompare(s.name||""):J==="source"?r=(i.source||"").localeCompare(s.source||""):J==="dice"&&(r=(i.dice||"").localeCompare(s.dice||"",void 0,{numeric:!0})),X==="asc"?r:-r}),w.querySelectorAll(".picker-th.sortable").forEach(i=>{const r=i.dataset.sort===J;i.classList.toggle("sorted",r);const l=i.querySelector(".sort-icon");l&&(r?(l.className=`fa-solid ${X==="asc"?"fa-arrow-down-a-z":"fa-arrow-up-a-z"} sort-icon`,l.style.opacity="1"):(l.className="fa-solid fa-sort sort-icon",l.style.opacity="0.35"))}),t&&(t.textContent=`${e.length} ${e.length===1?"table":"tables"}`),e.length===0){a.innerHTML=`
                    <div style="padding:32px 16px; text-align:center; color:var(--color-text-muted);">
                        <i class="fa-solid fa-filter-circle-xmark" style="font-size:2rem; opacity:0.3; margin-bottom:8px;"></i>
                        <p style="margin:0; font-size:0.85rem;">No tables found matching your filters.</p>
                    </div>
                `;return}a.innerHTML=e.map(i=>`
                    <div class="picker-row ${i.id===ae?"selected":""}" data-id="${i.id}">
                        <div style="flex:2; font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;" title="${m(i.name)}">
                            ${m(i.name)}
                        </div>
                        <div style="width:80px; text-align:center; font-size:0.75rem; color:var(--color-gold-light); font-weight:600;">
                            ${m(i.source)}
                        </div>
                        <div style="width:80px; text-align:center; font-size:0.75rem; color:#60a5fa; font-weight:600;">
                            ${m(i.dice)}
                        </div>
                        <div class="flex-row" style="width:140px; justify-content:flex-end; gap:4px;">
                            <button type="button" class="btn btn-xxs btn-secondary btn-picker-row-preview" data-id="${i.id}" title="Preview and roll"><i class="fa-solid fa-eye"></i></button>
                            <button type="button" class="btn btn-xxs btn-primary btn-picker-row-load" data-id="${i.id}" title="Load into Campaign"><i class="fa-solid fa-download"></i> Load</button>
                        </div>
                    </div>
                `).join(""),a.querySelectorAll(".picker-row").forEach(i=>{i.addEventListener("click",s=>{if(s.target.closest(".btn-picker-row-load"))return;const r=i.dataset.id;lt(r)})}),a.querySelectorAll(".btn-picker-row-load").forEach(i=>{i.addEventListener("click",s=>{s.stopPropagation();const r=i.dataset.id;Ce(r)})})}async function lt(a){ae=a;const t=document.getElementById("picker-table-rows");t&&t.querySelectorAll(".picker-row").forEach(c=>{c.classList.toggle("selected",c.dataset.id===a)});const e=document.getElementById("picker-preview-placeholder"),n=document.getElementById("picker-preview-content");e&&e.classList.add("vtt-hidden"),n&&n.classList.remove("vtt-hidden");const i=document.getElementById("preview-table-name"),s=document.getElementById("preview-table-source"),r=document.getElementById("preview-table-dice"),l=document.getElementById("preview-table-count"),d=document.getElementById("preview-entries-table");d&&(d.innerHTML='<tr><td style="padding:16px; text-align:center; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading table breakdown...</td></tr>');try{const c=await fetch(`/api/tables/${a}`);if(!c.ok)throw new Error("Table not found");const f=await c.json();if(V=f,i&&(i.textContent=f.name),s&&(s.textContent=f.source),r&&(r.textContent=f.dice),l&&(l.textContent=`${f.rows.length} entries`),d){const u=(f.colLabels||["Roll","Result"]).map(y=>`<th style="text-align:left; padding:6px 8px; background:rgba(0,0,0,0.4); border-bottom:1px solid rgba(255,255,255,0.1); color:var(--color-gold-light); font-weight:600;">${m(y)}</th>`).join(""),I=(f.rows||[]).map((y,P)=>`<tr>${(Array.isArray(y)?y:[y]).map((M,Z)=>`<td style="padding:5px 8px; border-bottom:1px solid rgba(255,255,255,0.04); color:${Z===0?"#60a5fa":"#cbd5e1"}; font-weight:${Z===0?"600":"normal"}; vertical-align:top;">${m(String(M))}</td>`).join("")}</tr>`).join("");d.innerHTML=`<thead><tr>${u}</tr></thead><tbody>${I}</tbody>`}}catch(c){console.error("Error fetching table details:",c),d&&(d.innerHTML='<tr><td style="padding:16px; text-align:center; color:#f87171;">Failed to load table details.</td></tr>')}}async function Ce(a){let t=V;if(!t||t.id!==a)try{const i=await fetch(`/api/tables/${a}`);if(!i.ok)throw new Error("Table not found");t=await i.json()}catch{alert("Could not load table data.");return}const e=(t.rows||[]).map((i,s)=>{const r=Array.isArray(i)?i:[i],l=r.length>1?`${r[0]}: ${r[1]}`:r[0]||`Option ${s+1}`,d=r.length>2?r.slice(2).join(" \u2014 "):r.length>1?r[1]:"";return{id:`e_${s+1}`,name:l,text:d}});p().tables.push({id:`table_${Date.now()}`,name:t.name,description:`Source: ${t.source}`,allowPlayers:!1,entries:e}),S(),o.toast&&o.toast(`Loaded "${t.name}" into campaign tables!`),w&&w.classList.add("vtt-hidden")}function ot(){if(!V||!V.rows||V.rows.length===0){o.toast&&o.toast("Select a valid table to roll.","warning");return}const a=V;let t=a.rows.length;const e=(a.dice||"").match(/\b(?:1?d)?(\d+)\b/i);e&&(t=parseInt(e[1],10));const n=Math.floor(Math.random()*t)+1,i=findRowForRoll(a.rows,n),s=i?Array.isArray(i.row)?i.row:[i.row]:[`Result #${n}`];let r="",l="";if(s.length===1?r=cleanTableText(s[0]):s.length===2?(r=`Roll [${s[0]}]`,l=cleanTableText(s[1])):(r=`${s[0]}: ${cleanTableText(s[1])}`,l=cleanTableText(s.slice(2).join(" \u2014 "))),window.Dice3D&&typeof window.Dice3D.showDiceRoll=="function")try{window.Dice3D.showDiceRoll([{faces:t,val:n}])}catch{}const d=a.dice||`1d${t}`,c=`
                <div class="rolltable-chat-card" style="border: 1px solid var(--color-gold-base); border-radius: 6px; padding: 10px; background: rgba(18, 22, 33, 0.95); box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gold-light); font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
                        <span><i class="fa-solid fa-dice-d20"></i> ${m(a.name)}</span>
                        <span style="color: #60a5fa;">[${m(d)}: ${n}]</span>
                    </div>
                    <div style="font-weight: 600; font-size: 0.95rem; color: #fff; margin-bottom: 2px;">
                        ${m(r)}
                    </div>
                    ${l?`<div style="font-size: 0.85rem; color: var(--color-text-secondary); line-height: 1.4;">${m(l)}</div>`:""}
                </div>
            `;o.socket&&o.socket.emit("chat:msg",{html:c,rollTableCard:{tableName:a.name,formula:d,roll:n,entryName:r,entryText:l},text:`Rolled on table ${a.name}: ${r}`}),o.toast&&o.toast(`Rolled on ${a.name}!`)}async function Ie(){ne=!0;const a=document.getElementById("picker-deck-list");a&&(a.innerHTML=`
                <div class="p-3 text-muted" style="text-align:center; padding:32px 0;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:8px;"></i>
                    <div>Loading card decks...</div>
                </div>
            `);try{const t=await fetch("/api/decks/catalog");if(!t.ok)throw new Error("Failed to fetch card decks catalog");Y=await t.json(),Ae()}catch(t){console.error("Error loading compendium decks catalog:",t),a&&(a.innerHTML=`
                    <div class="p-3 text-danger" style="text-align:center; padding:24px 0;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Error loading card decks.
                    </div>
                `)}finally{ne=!1}}function Ae(){const a=document.getElementById("picker-deck-list"),t=document.getElementById("picker-deck-count-label");if(!a||!Y)return;let e=Y.filter(n=>{if(pe){const i=pe.toLowerCase(),s=(n.name||"").toLowerCase(),r=(n.description||"").toLowerCase();if(!s.includes(i)&&!r.includes(i))return!1}return!0});if(t&&(t.textContent=`${e.length} ${e.length===1?"deck":"decks"}`),e.length===0){a.innerHTML=`
                <div style="padding:32px 16px; text-align:center; color:var(--color-text-muted);">
                    <i class="fa-solid fa-filter-circle-xmark" style="font-size:2rem; opacity:0.3; margin-bottom:8px;"></i>
                    <p style="margin:0; font-size:0.85rem;">No card decks match your search.</p>
                </div>
            `;return}a.innerHTML=e.map(n=>{const i=n.id===ie;return`
                <div class="picker-deck-card ${i?"selected":""}" data-id="${n.id}" style="padding:10px 12px; background:rgba(255,255,255,${i?"0.08":"0.03"}); border:1px solid ${i?"var(--color-gold-base)":"rgba(255,255,255,0.08)"}; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:10px; transition:all 0.2s;">
                    <div style="flex:1; min-width:0;">
                        <div class="flex-row" style="align-items:center; gap:8px;">
                            <span style="font-weight:600; color:#fff; font-size:0.9rem;">${m(n.name)}</span>
                            <span style="font-size:0.65rem; padding:1px 6px; border-radius:4px; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.3); color:var(--color-gold-light); font-weight:600;">${m(n.source)}</span>
                            <span style="font-size:0.7rem; color:#60a5fa; font-weight:600;">${n.cardCount} cards</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${m(n.description||"")}
                        </div>
                    </div>
                    <div class="flex-row" style="gap:4px; flex-shrink:0;">
                        <button type="button" class="btn btn-xxs btn-secondary btn-deck-preview" data-id="${n.id}" title="Preview deck cards"><i class="fa-solid fa-eye"></i></button>
                        <button type="button" class="btn btn-xxs btn-primary btn-deck-load" data-id="${n.id}" title="Load Deck into Campaign"><i class="fa-solid fa-download"></i> Load</button>
                    </div>
                </div>
            `}).join(""),a.querySelectorAll(".picker-deck-card").forEach(n=>{n.addEventListener("click",i=>{i.target.closest(".btn-deck-load")||dt(n.dataset.id)})}),a.querySelectorAll(".btn-deck-load").forEach(n=>{n.addEventListener("click",i=>{i.stopPropagation(),De(n.dataset.id)})})}async function dt(a){ie=a;const t=document.getElementById("picker-deck-list");t&&t.querySelectorAll(".picker-deck-card").forEach(c=>{c.classList.toggle("selected",c.dataset.id===a)});const e=document.getElementById("picker-deck-preview-placeholder"),n=document.getElementById("picker-deck-preview-content");e&&e.classList.add("vtt-hidden"),n&&n.classList.remove("vtt-hidden");const i=document.getElementById("preview-deck-name"),s=document.getElementById("preview-deck-source"),r=document.getElementById("preview-deck-desc"),l=document.getElementById("preview-deck-card-count"),d=document.getElementById("preview-deck-cards-container");d&&(d.innerHTML='<div style="grid-column: 1/-1; text-align:center; padding:16px; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading cards...</div>');try{const c=await fetch(`/api/decks/${a}`);if(!c.ok)throw new Error("Deck details not found");const f=await c.json();Le=f,i&&(i.textContent=f.name),s&&(s.textContent=f.source),r&&(r.textContent=f.description||""),l&&(l.textContent=f.cards?.length||f.cardCount||0),d&&Array.isArray(f.cards)&&(f.cards.forEach(u=>{u.frontImg||(u.frontImg=renderTarotCardSvg({name:u.cardTitle||u.name,suit:u.suit||"",number:u.number||null,desc:u.description||"",theme:f.theme||"tarokka"}))}),f.backImg||(f.backImg=renderTarotBackSvg(f.theme||"tarokka")),d.innerHTML=f.cards.map(u=>`
                    <div style="border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#0c0a14; display:flex; flex-direction:column; align-items:center; padding:4px;" title="${m(u.name)}: ${m(u.description||"")}">
                        <img src="${m(u.frontImg)}" alt="${m(u.name)}" style="width:100%; height:90px; object-fit:contain; border-radius:2px;" data-fallback-src="favicon.svg">
                        <div style="font-size:0.65rem; color:#fff; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; margin-top:2px; font-weight:600;">
                            ${m(u.cardTitle||u.name)}
                        </div>
                    </div>
                `).join(""))}catch(c){console.error("Error loading deck details:",c),d&&(d.innerHTML='<div style="grid-column: 1/-1; text-align:center; padding:16px; color:#f87171;">Failed to load cards.</div>')}}async function De(a){let t=Le;if(!t||t.id!==a)try{const d=await fetch(`/api/decks/${a}`);if(!d.ok)throw new Error("Deck not found");t=await d.json()}catch{alert("Could not fetch deck details.");return}const e=t.theme||"tarokka",n=t.backImg||renderTarotBackSvg(e),i=(t.cards||[]).map(d=>{const c=d.frontImg||renderTarotCardSvg({name:d.cardTitle||d.name,suit:d.suit||"",number:d.number||null,desc:d.description||"",theme:e});return{id:d.id||`card_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,name:d.name,cardTitle:d.cardTitle||d.name,suit:d.suit,number:d.number,description:d.description||"",frontImg:c}}),s=p();s.decks||(s.decks=[]);const r={id:`deck_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,name:t.name,description:t.description||"",backImg:n,theme:e,source:t.source,cards:i,state:{drawPile:shuffleArray(i.map(d=>d.id)),discardPile:[],drawnCards:[]}},l=s.decks.find(d=>d.name===t.name||t.id&&d.id===t.id);if(l){const d=document.createElement("div");d.className="vtt-modal",d.style.zIndex="3000",d.innerHTML=`
                <div class="modal-content glassmorphism" style="max-width: 440px; padding: 22px; text-align: center; border: 1px solid var(--color-gold-base);">
                    <h4 style="color: var(--color-gold-base); margin-top: 0; margin-bottom: 12px; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fa-solid fa-clone text-gradient-gold"></i> Deck Already In Campaign
                    </h4>
                    <p style="font-size: 0.88rem; color: var(--color-text-primary); margin-bottom: 20px; line-height: 1.4;">
                        The deck <strong>"${m(t.name)}"</strong> is already loaded in your campaign. What would you like to do?
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button type="button" class="btn btn-sm btn-primary btn-replace-deck" style="justify-content: center;">
                            <i class="fa-solid fa-arrows-rotate"></i> Replace / Reset Existing Deck
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary btn-copy-deck" style="justify-content: center;">
                            <i class="fa-solid fa-plus"></i> Add as New Copy
                        </button>
                        <button type="button" class="btn btn-xs btn-ghost btn-cancel-deck" style="margin-top: 4px;">Cancel</button>
                    </div>
                </div>
            `,document.body.appendChild(d);const c=()=>d.remove();d.querySelector(".btn-replace-deck").addEventListener("click",()=>{c(),l.cards=i,l.theme=e,l.backImg=n,l.description=t.description||l.description||"",l.state={drawPile:shuffleArray(i.map(f=>f.id)),discardPile:[],drawnCards:[]},S(),o.toast&&o.toast(`Reset and reloaded "${t.name}" (${i.length} cards)!`),w&&w.classList.add("vtt-hidden")}),d.querySelector(".btn-copy-deck").addEventListener("click",()=>{c();let f=2;for(;s.decks.some(u=>u.name===`${t.name} (${f})`);)f++;r.name=`${t.name} (${f})`,s.decks.push(r),S(),o.toast&&o.toast(`Loaded "${r.name}" (${i.length} cards) as a new copy!`),w&&w.classList.add("vtt-hidden")}),d.querySelector(".btn-cancel-deck").addEventListener("click",c);return}s.decks.push(r),S(),o.toast&&o.toast(`Loaded "${t.name}" (${i.length} cards) into campaign!`),w&&w.classList.add("vtt-hidden")}const U=new Map;async function ue(){if(k&&k.length>0)return k;try{const a=await fetch("/api/tables/catalog");a.ok&&(k=await a.json())}catch(a){console.error("Failed to load compendium tables catalog:",a)}return k||[]}function ge(a){if(!a||typeof a!="string")return null;const t=a.toLowerCase().trim(),e=t.replace(/\s*\([^)]*\)/g,"").trim(),i=(p().tables||[]).find(r=>{const l=(r.name||"").toLowerCase().trim();return l===t||l===`${t} effects`||l===`${t} table`||l.startsWith(`${t} \u2014`)||l.startsWith(`${t} -`)});if(i){const r=i.dice||i.diceFormula||(Array.isArray(i.rows)&&i.rows.length>0?`1d${i.rows.length}`:null)||(Array.isArray(i.entries)&&i.entries.length>0?`1d${i.entries.length}`:"1d20");return{id:i.id,name:i.name,dice:r}}if(!k||k.length===0)return null;let s=k.find(r=>{const l=(r.name||"").toLowerCase().trim();return l===t||l===`${t} effects`||l===`${t} table`});return s||(s=k.find(r=>{const l=(r.name||"").toLowerCase().trim();return l.startsWith(`${t} \u2014`)||l.startsWith(`${t} -`)||l.startsWith(`${t};`)||l.startsWith(`${t},`)}),s)||e&&e!==t&&(s=k.find(r=>{const l=(r.name||"").toLowerCase().trim();return l===e||l===`${e} effects`||l===`${e} table`||l.startsWith(`${e} \u2014`)||l.startsWith(`${e} -`)}),s)?s:null}async function Be(a){if(!a||typeof a!="string")return null;const t=ge(a);return t||(await ue(),ge(a))}async function Pe(a,t={}){if(!a)return;let e=null,n="",i="",s=20;if(a==="compendium:wild_magic_sorcerer"||a==="compendium:wild_magic_barbarian"){const y=a==="compendium:wild_magic_sorcerer",P=y?"wild magic surge":"wild magic",N=y?"PHB":"TCE";await ue();const z=(k||[]).find(M=>{const Z=(M.name||"").toLowerCase().trim(),Ye=(M.source||"").toUpperCase().trim();return Z===P&&(Ye===N||y&&Ye==="XPHB")});if(z)if(U.has(z.id))e=U.get(z.id);else try{const M=await fetch(`/api/tables/${z.id}`);M.ok&&(e=await M.json(),U.set(z.id,e))}catch(M){console.error("Failed to fetch table details:",M)}}else if(a.startsWith("ctable_"))if(U.has(a))e=U.get(a);else try{const y=await fetch(`/api/tables/${a}`);y.ok&&(e=await y.json(),U.set(a,e))}catch(y){console.error("Failed to fetch table details:",y)}else{const y=(p().tables||[]).find(P=>P.id===a);if(y){n=y.name;const P=y.entries||[];s=P.length||1,i=`1d${s}`;const N=Math.floor(Math.random()*s)+1,z=P[N-1]||{name:`Result #${N}`,text:""};if(window.Dice3D&&typeof window.Dice3D.showDiceRoll=="function")try{window.Dice3D.showDiceRoll([{faces:s,val:N}])}catch{}const M=t.charName?`${t.charName} \u2014 ${t.abilityName||n}`:t.abilityName?`${t.abilityName} (${n})`:n;o.socket&&o.socket.emit("chat:msg",{rollTableCard:{tableName:M,formula:i,roll:N,entryName:z.name||`Result #${N}`,entryText:z.text||"",charName:t.charName||"",abilityName:t.abilityName||""},text:`Rolled on table ${n}: ${z.name||N}`,whisperToGM:!!t.isWhisper}),o.toast&&o.toast(`Rolled on ${n}: ${z.name||N}`);return}else{const P=await Be(a);if(P&&P.id!==a)return Pe(P.id,t)}}if(!e||!e.rows||e.rows.length===0){o.toast&&o.toast("Could not find or load linked table.","error");return}n=e.name||"Table";const r=(e.dice||"").match(/\b(?:1?d)?(\d+)\b/i);r?s=parseInt(r[1],10):s=e.rows.length,i=`1d${s}`;const l=Math.floor(Math.random()*s)+1;if(window.Dice3D&&typeof window.Dice3D.showDiceRoll=="function")try{window.Dice3D.showDiceRoll([{faces:s,val:l}])}catch{}const d=findRowForRoll(e.rows,l),c=d?Array.isArray(d.row)?d.row:[d.row]:[`Result #${l}`];let f="",u="";c.length===1?f=cleanTableText(c[0]):c.length===2?(f=`Roll [${c[0]}]`,u=cleanTableText(c[1])):(f=`${c[0]}: ${cleanTableText(c[1])}`,u=cleanTableText(c.slice(2).join(" \u2014 ")));const I=t.charName?`${t.charName} \u2014 ${t.abilityName||n}`:t.abilityName?`${t.abilityName} (${n})`:n;o.socket&&o.socket.emit("chat:msg",{rollTableCard:{tableName:I,formula:i,roll:l,entryName:f,entryText:u,charName:t.charName||"",abilityName:t.abilityName||""},text:`Rolled on table ${n}: ${f}`,whisperToGM:!!t.isWhisper}),o.toast&&o.toast(`Rolled on ${n}: ${f}`)}function be(){const a=p(),t="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(a,null,2)),e=document.createElement("a");e.setAttribute("href",t),e.setAttribute("download",`dndforged_rolltables_and_decks_${Date.now()}.json`),document.body.appendChild(e),e.click(),e.remove()}function ze(a){if(!a)return;const t=new FileReader;t.onload=e=>{try{const n=JSON.parse(e.target.result),i=p();n.tables&&Array.isArray(n.tables)&&i.tables.push(...n.tables),n.assetTables&&Array.isArray(n.assetTables)&&i.assetTables.push(...n.assetTables),n.decks&&Array.isArray(n.decks)&&(n.decks.forEach(s=>q(s)),i.decks.push(...n.decks)),S(),o.toast&&o.toast("Successfully imported roll tables and decks!"),w&&w.classList.add("vtt-hidden")}catch(n){console.error("Import error:",n),alert("Invalid JSON file format for tables/decks.")}},t.readAsText(a)}const Me=document.querySelectorAll(".tables-subtab-btn");Me.forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.subtab;Me.forEach(n=>{n.classList.remove("active"),n.style.borderBottom="2px solid transparent",n.style.color="var(--color-text-secondary)"}),a.classList.add("active"),a.style.borderBottom="2px solid var(--color-gold-base)",a.style.color="var(--color-text-primary)",document.querySelectorAll(".tables-subtab-content").forEach(n=>n.classList.add("vtt-hidden"));const e=document.getElementById(t);e&&e.classList.remove("vtt-hidden")})});const Ne=document.querySelectorAll(".asset-subtab-btn");Ne.forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.subtab;Ne.forEach(n=>{n.classList.remove("active"),n.style.borderBottom="2px solid transparent",n.style.color="var(--color-text-secondary)"}),a.classList.add("active"),a.style.borderBottom="2px solid var(--color-gold-base)",a.style.color="var(--color-text-primary)",document.querySelectorAll(".asset-subtab-content").forEach(n=>n.classList.add("vtt-hidden"));const e=document.getElementById(t);e&&e.classList.remove("vtt-hidden")})});const qe=document.getElementById("search-roll-tables");qe&&qe.addEventListener("input",a=>{L=a.target.value.trim(),Q()});const je=document.getElementById("search-asset-tables");je&&je.addEventListener("input",a=>{B=a.target.value.trim(),F()});const Re=document.getElementById("search-card-decks");Re&&Re.addEventListener("input",a=>{E=a.target.value.trim(),W()});const _e=document.getElementById("btn-new-roll-table");_e&&_e.addEventListener("click",()=>ke(null));const He=document.getElementById("btn-new-asset-table");He&&He.addEventListener("click",()=>$e(null));const Ge=document.getElementById("btn-new-card-deck");Ge&&Ge.addEventListener("click",()=>Ee(null));const Fe=document.getElementById("btn-load-preset-tables");Fe&&Fe.addEventListener("click",()=>se("compendium"));const We=document.getElementById("btn-load-preset-decks");We&&We.addEventListener("click",()=>se("decks"));const Oe=document.getElementById("btn-export-rolltables-json");Oe&&Oe.addEventListener("click",be);const Je=document.getElementById("btn-modal-export-json");Je&&Je.addEventListener("click",be);const Ve=document.getElementById("file-import-rolltables-json");if(Ve&&Ve.addEventListener("change",a=>{a.target.files&&a.target.files[0]&&(ze(a.target.files[0]),a.target.value="")}),w){w.querySelectorAll(".picker-tab-btn").forEach(l=>{l.addEventListener("click",()=>{Te(l.dataset.tab)})});const a=document.getElementById("picker-search-input");a&&a.addEventListener("input",l=>{ce=l.target.value.trim(),K()});const t=document.getElementById("picker-source-select");t&&t.addEventListener("change",l=>{fe=l.target.value,K()});const e=document.getElementById("picker-dice-select");e&&e.addEventListener("change",l=>{me=l.target.value,K()}),w.querySelectorAll(".picker-th.sortable").forEach(l=>{l.addEventListener("click",()=>{const d=l.dataset.sort;J===d?X=X==="asc"?"desc":"asc":(J=d,X="asc"),K()})});const n=document.getElementById("btn-preview-roll-chat");n&&n.addEventListener("click",ot);const i=document.getElementById("btn-preview-load-camp");i&&i.addEventListener("click",()=>{ae&&Ce(ae)});const s=document.getElementById("picker-deck-search-input");s&&s.addEventListener("input",l=>{pe=l.target.value.trim(),Ae()});const r=document.getElementById("btn-preview-load-deck");r&&r.addEventListener("click",()=>{ie&&De(ie)})}const Ue=document.getElementById("btn-save-roll-table");Ue&&Ue.addEventListener("click",Ze);const Qe=document.getElementById("btn-save-asset-table");Qe&&Qe.addEventListener("click",nt);const Xe=document.getElementById("btn-save-card-deck");return Xe&&Xe.addEventListener("click",st),G(),ue().catch(()=>{}),{renderAllViews:G,rollFromTable:j,rollLinkedTable:Pe,findTableByItemName:Be,findTableByItemNameSync:ge,placeAssetTableOnCanvas:ee,playCardToCanvas:re,drawFromDeckPrompt:he,shuffleDeckAction:xe,recallDeckAction:we,openTablePickerModal:se,openAssetTableWithAssets:at,exportRollTablesJson:be,importRollTablesJson:ze}}
