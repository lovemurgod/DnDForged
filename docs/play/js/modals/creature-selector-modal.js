import{escapeHtml as u,getSafeVttUrl as Z,resolveMonsterTokenUrl as me}from"../vtt-utils.js?v=mwzhxr9x";export function getCreatureTokenUrl(i){if(!i)return"favicon.svg";if(i.tokenImg)return i.tokenImg;if(i.tokenUrl)return i.tokenUrl;if(i.imgUrl)return i.imgUrl;if(typeof Renderer<"u"&&Renderer.monster&&Renderer.monster.getTokenUrl)try{const l=Renderer.monster.getTokenUrl(i);if(l)return l}catch{}if(i.hasToken||i.source||i.name){const l=me(i);if(l)return l}return typeof window<"u"&&window.VTT?.generateArcaneToken?window.VTT.generateArcaneToken(i.name||"Creature","monster"):"favicon.svg"}export function parseCrToNumeric(i){if(i==null)return 0;typeof i=="object"&&(i=i.cr);const l=String(i).trim();if(l==="1/8")return .125;if(l==="1/4")return .25;if(l==="1/2")return .5;const f=parseFloat(l);return isNaN(f)?0:f}export function formatCrDisplay(i){return i==null?"0":String(typeof i=="object"?i.cr||"0":i)}export function formatAbilityModifier(i){const l=typeof i=="number"?i:parseInt(i,10);if(isNaN(l))return"+0";const f=Math.floor((l-10)/2);return f>=0?`+${f}`:`${f}`}let S=null;export async function loadBestiaryCatalog(i=null){if(i&&Array.isArray(i)&&i.length>0)return i;if(S&&S.length>0)return S;if(typeof window<"u"&&window.VTT?.bestiaryCatalog&&Array.isArray(window.VTT.bestiaryCatalog))return S=window.VTT.bestiaryCatalog,S;try{let l=await fetch("/api/bestiary/catalog");if(l.ok||(l=await fetch("/data/bestiary-catalog.json")),l.ok){const f=await l.json();if(Array.isArray(f))return S=f,typeof window<"u"&&window.VTT&&(window.VTT.bestiaryCatalog=f),f}}catch(l){console.warn("[creature-selector-modal] Catalog fetch error:",l)}return[]}export async function openCreatureSelectorModal(i={}){const{title:l="Select Creature Template",confirmLabel:f="Select Creature",confirmIcon:j="fa-check",onSelect:R=null,initialFilter:y={},catalog:ee=null}=i,q=await loadBestiaryCatalog(ee),H=new Set,B=new Set,F=new Set,se=new Set,U=new Set;q.forEach(e=>{e.type&&H.add(e.type),e.source&&B.add(e.source),e.size&&F.add(e.size),e.alignment&&se.add(e.alignment),Array.isArray(e.environment)&&e.environment.forEach(a=>U.add(a))});const s={searchQuery:"",sortCol:"name",sortDir:"asc",crMin:y.crMin!==void 0?y.crMin:-1,crMax:y.crMax!==void 0?y.crMax:999,type:y.type||"",sources:new Set(y.sources||[]),sizes:new Set(y.sizes||[]),alignments:new Set(y.alignments||[]),environments:new Set(y.environments||[]),isAdvancedDrawerOpen:!1,filtered:[],selectedMonster:null,fullMonster:null,renderedCount:0,batchSize:50},$=document.createElement("div");$.className="vtt-sheet-submodal-overlay creature-selector-overlay",$.style.cssText="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(3px); z-index:3100; display:flex; align-items:center; justify-content:center;";const c=document.createElement("div");c.className="vtt-sheet-submodal glassmorphism creature-selector-modal",c.style.zIndex="3110",c.innerHTML=`
        <div class="creature-selector-header">
            <h3 class="creature-selector-title">
                <i class="fa-solid ${j||"fa-paw"}"></i>
                <span>${l}</span>
            </h3>
            <button id="csm-close-btn" class="btn btn-icon btn-secondary" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="creature-selector-container">
            <!-- Left Pane: Search, Sort & Results List -->
            <div class="creature-selector-list-pane">
                <div class="creature-selector-search-box">
                    <div style="position:relative; flex:1;">
                        <input type="text" id="csm-search-input" class="vtt-input" placeholder="Search creatures by name, type, source..." autofocus autocomplete="off">
                        <button id="csm-search-clear" type="button" title="Clear search" style="display:none;" class="csm-input-clear-btn"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <button id="csm-filter-toggle" class="btn btn-secondary btn-sm" title="Advanced Filters">
                        <i class="fa-solid fa-filter"></i>
                        <span>Filters</span>
                        <span id="csm-filter-badge" class="csm-badge" style="display:none;">0</span>
                    </button>
                </div>

                <!-- Quick Filter Toolbar -->
                <div class="creature-selector-quick-filters">
                    <div class="csm-filter-group">
                        <label>CR Min</label>
                        <select id="csm-cr-min" class="vtt-select">
                            <option value="">Any</option>
                            <option value="0">0</option>
                            <option value="1/8">1/8</option>
                            <option value="1/4">1/4</option>
                            <option value="1/2">1/2</option>
                            ${[...Array(30).keys()].map(e=>`<option value="${e+1}">${e+1}</option>`).join("")}
                        </select>
                    </div>
                    <div class="csm-filter-group">
                        <label>CR Max</label>
                        <select id="csm-cr-max" class="vtt-select">
                            <option value="">Any</option>
                            <option value="0">0</option>
                            <option value="1/8">1/8</option>
                            <option value="1/4">1/4</option>
                            <option value="1/2">1/2</option>
                            ${[...Array(30).keys()].map(e=>`<option value="${e+1}">${e+1}</option>`).join("")}
                        </select>
                    </div>
                    <div class="csm-filter-group" style="flex:1;">
                        <label>Type</label>
                        <select id="csm-type-sel" class="vtt-select">
                            <option value="">All Types</option>
                            ${Array.from(H).sort().map(e=>`<option value="${e}">${e.replace(/\b\w/g,a=>a.toUpperCase())}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <!-- Advanced Filter Collapsible Drawer -->
                <div id="csm-advanced-drawer" class="creature-selector-advanced-drawer" style="display:none;">
                    <div class="csm-drawer-section">
                        <div class="csm-drawer-heading">Sourcebooks</div>
                        <div id="csm-sources-list" class="csm-checkbox-grid"></div>
                    </div>
                    <div class="csm-drawer-section">
                        <div class="csm-drawer-heading">Size Category</div>
                        <div id="csm-sizes-list" class="csm-checkbox-grid"></div>
                    </div>
                    <div class="csm-drawer-section">
                        <div class="csm-drawer-heading">Environment</div>
                        <div id="csm-environments-list" class="csm-checkbox-grid"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <button id="csm-reset-filters" class="btn btn-xs btn-secondary"><i class="fa-solid fa-rotate-left"></i> Reset All</button>
                        <span id="csm-filter-count-label" style="font-size:0.75rem; color:var(--color-text-muted);"></span>
                    </div>
                </div>

                <!-- Sortable Table Header -->
                <div class="creature-selector-table-header" id="csm-table-header">
                    <div class="csm-th csm-th-name sorted" data-sort="name" title="Sort by Name">
                        <span>Name</span>
                        <i class="fa-solid fa-arrow-down-a-z csm-sort-icon"></i>
                    </div>
                    <div class="csm-th csm-th-cr" data-sort="crNumeric" title="Sort by Challenge Rating">
                        <span>CR</span>
                        <i class="fa-solid fa-sort csm-sort-icon"></i>
                    </div>
                    <div class="csm-th csm-th-type" data-sort="type" title="Sort by Creature Type">
                        <span>Type</span>
                        <i class="fa-solid fa-sort csm-sort-icon"></i>
                    </div>
                    <div class="csm-th csm-th-source" data-sort="source" title="Sort by Source">
                        <span>Source</span>
                        <i class="fa-solid fa-sort csm-sort-icon"></i>
                    </div>
                </div>

                <!-- Scrollable Table Results -->
                <div id="csm-results-list" class="creature-selector-results-list scroll-styled"></div>

                <div class="creature-selector-status-bar">
                    <span id="csm-results-count">Loading creatures...</span>
                </div>
            </div>

            <!-- Right Pane: Live Statblock & Token Preview -->
            <div class="creature-selector-preview-pane" id="csm-preview-pane">
                <div class="csm-preview-mobile-header">
                    <button id="csm-back-to-list-btn" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-arrow-left"></i> Back to Results
                    </button>
                </div>
                <div id="csm-preview-body" class="csm-preview-body scroll-styled">
                    <div class="csm-preview-empty-state">
                        <i class="fa-solid fa-dragon csm-empty-icon"></i>
                        <div style="font-weight:600; font-size:1rem; color:var(--color-text-primary);">Select a Creature to Preview</div>
                        <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px;">Choose any creature from the list to view its complete statblock, token art, traits, and actions.</div>
                    </div>
                </div>
                <div class="csm-preview-footer" id="csm-preview-footer" style="display:none;">
                    <div id="csm-preview-footer-name" class="csm-footer-creature-info"></div>
                    <button id="csm-confirm-btn" class="btn btn-primary btn-sm">
                        <i class="fa-solid ${j||"fa-check"}"></i>
                        <span>${f}</span>
                    </button>
                </div>
            </div>
        </div>
    `,document.body.appendChild($),document.body.appendChild(c);const T=c.querySelector("#csm-search-input"),A=c.querySelector("#csm-search-clear"),C=c.querySelector("#csm-filter-toggle"),M=c.querySelector("#csm-filter-badge"),te=c.querySelector("#csm-advanced-drawer"),V=c.querySelector("#csm-cr-min"),P=c.querySelector("#csm-cr-max"),I=c.querySelector("#csm-type-sel"),re=c.querySelector("#csm-reset-filters"),Q=c.querySelector("#csm-table-header"),b=c.querySelector("#csm-results-list"),O=c.querySelector("#csm-results-count"),L=c.querySelector("#csm-preview-body"),z=c.querySelector("#csm-preview-footer"),G=c.querySelector("#csm-preview-footer-name"),ie=c.querySelector("#csm-confirm-btn"),ae=c.querySelector("#csm-back-to-list-btn"),ne=c.querySelector("#csm-close-btn");function E(e,a,t){const r=c.querySelector(`#${e}`);r&&(r.innerHTML="",Array.from(a).sort().forEach(n=>{if(!n)return;const o=document.createElement("label");o.className="csm-checkbox-label";const d=document.createElement("input");d.type="checkbox",d.value=n,d.checked=t.has(n),d.addEventListener("change",()=>{d.checked?t.add(n):t.delete(n),g()}),o.appendChild(d),o.appendChild(document.createTextNode(String(n))),r.appendChild(o)}))}E("csm-sources-list",B,s.sources),E("csm-sizes-list",F,s.sizes),E("csm-environments-list",U,s.environments);function ce(){const e=s.searchQuery.toLowerCase().trim();s.filtered=q.filter(t=>{if(e){const n=t.name&&t.name.toLowerCase().includes(e),o=(t.type||"").toLowerCase().includes(e)||(t.subtype||"").toLowerCase().includes(e),d=(t.source||"").toLowerCase().includes(e),v=t.cr?(typeof t.cr=="object"?String(t.cr.cr):String(t.cr)).toLowerCase():"0",w=v===e||`cr ${v}`.includes(e);if(!n&&!o&&!d&&!w)return!1}const r=t.crNumeric!==void 0?t.crNumeric:parseCrToNumeric(t.cr);if(s.crMin!==-1&&r<s.crMin||s.crMax!==999&&r>s.crMax)return!1;if(s.type){const n=(t.type||"").toLowerCase(),o=(t.subtype||"").toLowerCase();if(n!==s.type.toLowerCase()&&o!==s.type.toLowerCase())return!1}return!(s.sources.size>0&&!s.sources.has(t.source)||s.sizes.size>0&&!s.sizes.has(t.size)||s.environments.size>0&&!(Array.isArray(t.environment)?t.environment:[]).some(d=>s.environments.has(d)))}),s.filtered.sort((t,r)=>{if(s.sortCol==="name"){const n=(t.name||"").localeCompare(r.name||"");return s.sortDir==="asc"?n:-n}else if(s.sortCol==="crNumeric"){const n=t.crNumeric!==void 0?t.crNumeric:parseCrToNumeric(t.cr),o=r.crNumeric!==void 0?r.crNumeric:parseCrToNumeric(r.cr),d=s.sortDir==="asc"?n-o:o-n;return d!==0?d:(t.name||"").localeCompare(r.name||"")}else if(s.sortCol==="type"){const n=t.type||t.subtype||"",o=r.type||r.subtype||"",d=s.sortDir==="asc"?n.localeCompare(o):o.localeCompare(n);return d!==0?d:(t.name||"").localeCompare(r.name||"")}else if(s.sortCol==="source"){const n=t.source||"",o=r.source||"",d=s.sortDir==="asc"?n.localeCompare(o):o.localeCompare(n);return d!==0?d:(t.name||"").localeCompare(r.name||"")}return 0});let a=0;(s.crMin!==-1||s.crMax!==999)&&a++,s.type&&a++,a+=s.sources.size+s.sizes.size+s.environments.size,a>0?(M.textContent=a,M.style.display="inline-flex",C.classList.add("btn-primary"),C.classList.remove("btn-secondary")):(M.style.display="none",C.classList.remove("btn-primary"),C.classList.add("btn-secondary"))}function W(e=!0){if(e&&(b.innerHTML="",s.renderedCount=0,b.scrollTop=0),s.filtered.length===0){b.innerHTML=`
                <div style="padding:24px; text-align:center; color:var(--color-text-muted);">
                    <i class="fa-solid fa-ghost" style="font-size:1.8rem; margin-bottom:8px; opacity:0.4;"></i>
                    <div>No creatures found matching your criteria.</div>
                </div>
            `,O.textContent="0 creatures";return}const a=s.filtered.slice(s.renderedCount,s.renderedCount+s.batchSize),t=document.createDocumentFragment();a.forEach(r=>{const n=document.createElement("div"),o=s.selectedMonster&&s.selectedMonster.id===r.id&&s.selectedMonster.name===r.name;n.className=`csm-row ${o?"active-row":""}`,n.dataset.id=r.id||r.name;const d=formatCrDisplay(r.cr),v=r.type||r.subtype||"\u2014",w=r.hasSpellcasting?'<span style="color:var(--color-gold-base); margin-left:4px;" title="Spellcaster"><i class="fa-solid fa-wand-magic-sparkles"></i></span>':"";n.innerHTML=`
                <div class="csm-col-name" title="${r.name}">
                    <span class="csm-col-name-text">${r.name}</span>${w}
                </div>
                <div class="csm-col-cr"><span class="csm-cr-pill">CR ${d}</span></div>
                <div class="csm-col-type" title="${v}">${v}</div>
                <div class="csm-col-source"><span class="csm-source-badge">${r.source||"SRD"}</span></div>
            `,n.addEventListener("click",()=>{X(r)}),t.appendChild(n)}),b.appendChild(t),s.renderedCount+=a.length,O.textContent=`Showing ${Math.min(s.renderedCount,s.filtered.length)} of ${s.filtered.length} creatures`}function g(){ce(),W(!0),s.filtered.length>0?s.selectedMonster&&s.filtered.some(a=>a.name===s.selectedMonster.name&&a.source===s.selectedMonster.source)||X(s.filtered[0],!1):oe()}b.addEventListener("scroll",()=>{if(s.renderedCount<s.filtered.length){const{scrollTop:e,scrollHeight:a,clientHeight:t}=b;e+t>=a-60&&W(!1)}});async function X(e,a=!0){s.selectedMonster=e,b.querySelectorAll(".csm-row").forEach(r=>{const n=r.dataset.id===(e.id||e.name);r.classList.toggle("active-row",n)}),a&&c.classList.add("csm-mobile-preview-active"),le(e);let t=e;if(typeof window<"u"&&window.fetchFullCreature)try{const r=await window.fetchFullCreature(e.source,e.id||e.name);r&&(t=r)}catch(r){console.warn("[creature-selector-modal] Full creature hydration fallback:",r)}s.fullMonster=t,de(t)}function oe(){L.innerHTML=`
            <div class="csm-preview-empty-state">
                <i class="fa-solid fa-dragon csm-empty-icon"></i>
                <div style="font-weight:600; font-size:1rem; color:var(--color-text-primary);">No Creature Selected</div>
                <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px;">Adjust your search or filter settings to view creatures.</div>
            </div>
        `,z.style.display="none"}function le(e){const a=u(Z(getCreatureTokenUrl(e))),t=u(e.name);L.innerHTML=`
            <div class="csm-preview-card">
                <div class="csm-preview-top">
                    <img src="${a}" class="csm-preview-avatar" data-fallback-src="favicon.svg">
                    <div>
                        <h4 style="margin:0; font-size:1.15rem; color:var(--color-gold-base); font-family:var(--font-heading);">${t}</h4>
                        <div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:2px;">
                            ${u(e.size||"")} ${u(e.type||"")} \u2022 CR ${u(formatCrDisplay(e.cr))} [${u(e.source||"")}]
                        </div>
                    </div>
                </div>
                <div style="padding:24px; text-align:center; color:var(--color-text-muted);">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem; color:var(--color-gold-base); margin-bottom:8px;"></i>
                    <div style="font-size:0.85rem;">Hydrating full statblock...</div>
                </div>
            </div>
        `,z.style.display="flex",G.innerHTML=`<strong>${t}</strong> <span style="color:var(--color-text-muted); font-size:0.8em;">(CR ${u(formatCrDisplay(e.cr))})</span>`}function de(e){const a=getCreatureTokenUrl(e),t=formatCrDisplay(e.cr);let r="\u2014";typeof e.hp=="number"?r=String(e.hp):e.hp&&e.hp.average!==void 0&&(r=`${e.hp.average}${e.hp.formula?` (${e.hp.formula})`:""}`);let n="\u2014";if(Array.isArray(e.ac)&&e.ac.length>0){const p=e.ac[0];n=typeof p=="object"?`${p.ac}${p.from?` (${p.from.join(", ")})`:""}`:String(p)}else e.ac!==void 0&&(n=String(e.ac));let o="30 ft.";typeof e.speed=="string"?o=e.speed:typeof e.speed=="object"&&e.speed!==null&&(o=Object.entries(e.speed).map(([p,m])=>p==="walk"?`${m} ft.`:`${p} ${typeof m=="object"?m.number:m} ft.`).join(", "));const d=[{key:"STR",val:e.str||10},{key:"DEX",val:e.dex||10},{key:"CON",val:e.con||10},{key:"INT",val:e.int||10},{key:"WIS",val:e.wis||10},{key:"CHA",val:e.cha||10}],v=p=>!Array.isArray(p)||p.length===0?"":p.map(m=>{const ve=m.name?`<strong>${m.name}.</strong> `:"";let N="";return Array.isArray(m.entries)?N=m.entries.map(D=>typeof D=="string"?D:D.text||"").join(" "):typeof m=="string"&&(N=m),`<div class="csm-statblock-entry">${ve}${N}</div>`}).join(""),w=v(e.trait),_=v(e.action),J=v(e.bonus),K=v(e.reaction),Y=v(e.legendary);L.innerHTML=`
            <div class="csm-preview-card">
                <!-- Header -->
                <div class="csm-preview-top">
                    <img src="${u(Z(a))}" class="csm-preview-avatar" data-fallback-src="favicon.svg">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <h4 style="margin:0; font-size:1.25rem; color:var(--color-gold-base); font-family:var(--font-heading);">${u(e.name)}</h4>
                            <span class="csm-source-badge">${u(e.source||"SRD")} ${u(e.edition||"")}</span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--color-text-muted); font-style:italic; margin-top:2px;">
                            ${e.size?u(ue(e.size)):"Medium"} ${u(e.type||"creature")}${e.subtype?` (${u(e.subtype)})`:""}, ${u(e.alignment||"unaligned")}
                        </div>
                    </div>
                </div>

                <!-- Core Stats Strip -->
                <div class="csm-core-stats-grid">
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Armor Class</span>
                        <span class="csm-stat-val">${n}</span>
                    </div>
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Hit Points</span>
                        <span class="csm-stat-val">${r}</span>
                    </div>
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Speed</span>
                        <span class="csm-stat-val">${o}</span>
                    </div>
                    <div class="csm-stat-box">
                        <span class="csm-stat-lbl">Challenge</span>
                        <span class="csm-stat-val">CR ${t}</span>
                    </div>
                </div>

                <!-- Ability Scores Grid -->
                <div class="csm-abilities-grid">
                    ${d.map(p=>`
                        <div class="csm-ability-box">
                            <span class="csm-ability-key">${p.key}</span>
                            <span class="csm-ability-val">${p.val}</span>
                            <span class="csm-ability-mod">${formatAbilityModifier(p.val)}</span>
                        </div>
                    `).join("")}
                </div>

                <!-- Metadata details: Senses, Languages, Resistances -->
                <div class="csm-meta-details">
                    ${e.save?`<div><strong>Saving Throws:</strong> ${pe(e.save)}</div>`:""}
                    ${e.skill?`<div><strong>Skills:</strong> ${fe(e.skill)}</div>`:""}
                    ${e.senses?`<div><strong>Senses:</strong> ${Array.isArray(e.senses)?e.senses.join(", "):e.senses}</div>`:""}
                    ${e.languages?`<div><strong>Languages:</strong> ${Array.isArray(e.languages)?e.languages.join(", "):e.languages}</div>`:""}
                    ${e.resistances?`<div><strong>Damage Resistances:</strong> ${Array.isArray(e.resistances)?e.resistances.join(", "):e.resistances}</div>`:""}
                    ${e.immunities?`<div><strong>Damage Immunities:</strong> ${Array.isArray(e.immunities)?e.immunities.join(", "):e.immunities}</div>`:""}
                    ${e.vulnerabilities?`<div><strong>Damage Vulnerabilities:</strong> ${Array.isArray(e.vulnerabilities)?e.vulnerabilities.join(", "):e.vulnerabilities}</div>`:""}
                </div>

                <!-- Traits -->
                ${w?`<div class="csm-section"><div class="csm-section-heading">Traits</div>${w}</div>`:""}

                <!-- Actions -->
                ${_?`<div class="csm-section"><div class="csm-section-heading">Actions</div>${_}</div>`:""}

                <!-- Bonus Actions -->
                ${J?`<div class="csm-section"><div class="csm-section-heading">Bonus Actions</div>${J}</div>`:""}

                <!-- Reactions -->
                ${K?`<div class="csm-section"><div class="csm-section-heading">Reactions</div>${K}</div>`:""}

                <!-- Legendary Actions -->
                ${Y?`<div class="csm-section"><div class="csm-section-heading">Legendary Actions</div>${Y}</div>`:""}
            </div>
        `,z.style.display="flex",G.innerHTML=`<strong>${u(e.name)}</strong> <span style="color:var(--color-text-muted); font-size:0.8em;">(CR ${u(t)})</span>`}function ue(e){return{T:"Tiny",S:"Small",M:"Medium",L:"Large",H:"Huge",G:"Gargantuan"}[e]||e}function pe(e){return!e||typeof e!="object"?"":Object.entries(e).map(([a,t])=>`${a.toUpperCase()} ${t}`).join(", ")}function fe(e){return!e||typeof e!="object"?"":Object.entries(e).map(([a,t])=>`${a.replace(/\b\w/g,r=>r.toUpperCase())} ${t}`).join(", ")}let x=null,h=null;const k=()=>{x&&window.removeEventListener("keydown",x),h&&clearTimeout(h),$.remove(),c.remove()};x=e=>{e.key==="Escape"&&k()},window.addEventListener("keydown",x),$.addEventListener("click",k),ne.addEventListener("click",k),ae.addEventListener("click",()=>{c.classList.remove("csm-mobile-preview-active")}),ie.addEventListener("click",()=>{if(!s.selectedMonster)return;const e=s.selectedMonster,a=s.fullMonster||e;k(),typeof R=="function"&&R(e,a)}),T.addEventListener("input",e=>{s.searchQuery=e.target.value,A.style.display=s.searchQuery?"block":"none",clearTimeout(h),h=setTimeout(()=>{g()},100)}),A.addEventListener("click",()=>{h&&clearTimeout(h),T.value="",s.searchQuery="",A.style.display="none",g(),T.focus()}),V.addEventListener("change",e=>{s.crMin=e.target.value?parseCrToNumeric(e.target.value):-1,g()}),P.addEventListener("change",e=>{s.crMax=e.target.value?parseCrToNumeric(e.target.value):999,g()}),I.addEventListener("change",e=>{s.type=e.target.value,g()}),C.addEventListener("click",()=>{s.isAdvancedDrawerOpen=!s.isAdvancedDrawerOpen,te.style.display=s.isAdvancedDrawerOpen?"block":"none"}),re.addEventListener("click",()=>{s.crMin=-1,s.crMax=999,s.type="",s.sources.clear(),s.sizes.clear(),s.environments.clear(),V.value="",P.value="",I.value="",c.querySelectorAll('.csm-checkbox-label input[type="checkbox"]').forEach(e=>{e.checked=!1}),g()}),Q.querySelectorAll(".csm-th").forEach(e=>{e.addEventListener("click",()=>{const a=e.dataset.sort;s.sortCol===a?s.sortDir=s.sortDir==="asc"?"desc":"asc":(s.sortCol=a,s.sortDir="asc"),Q.querySelectorAll(".csm-th").forEach(t=>{const r=t.querySelector(".csm-sort-icon");t===e?(t.classList.add("sorted"),r&&(a==="name"?r.className=s.sortDir==="asc"?"fa-solid fa-arrow-down-a-z csm-sort-icon":"fa-solid fa-arrow-up-z-a csm-sort-icon":a==="crNumeric"?r.className=s.sortDir==="asc"?"fa-solid fa-arrow-down-1-9 csm-sort-icon":"fa-solid fa-arrow-up-9-1 csm-sort-icon":r.className=s.sortDir==="asc"?"fa-solid fa-arrow-down-short-wide csm-sort-icon":"fa-solid fa-arrow-up-wide-short csm-sort-icon")):(t.classList.remove("sorted"),r&&(r.className="fa-solid fa-sort csm-sort-icon"))}),g()})}),g()}typeof window<"u"&&(window.VTT=window.VTT||{},window.VTT.openCreatureSelectorModal=openCreatureSelectorModal);
