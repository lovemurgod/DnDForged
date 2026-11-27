import{getSafeVttUrl as _,escapeHtml as l}from"../../vtt-utils.js?v=mwzii5ci";export function renderStep1(i){const{bodyEl:L,builderCache:x,disabledSources:c,isSourceAllowed:v,workingChar:t,recomputeCandidates:d,harvestCurrentStepInputs:k}=i,C=(x?.races||[]).filter(e=>v(e.source,e.name,c)),B=new Set,z=[];C.forEach(e=>{const r=(e.raceName||e.name||"").replace(/\s*\[.*?\]$/,"").replace(/\s*\([^)]*\).*$/,"").trim(),a=(e.source||"PHB").toUpperCase(),n=`${r.toLowerCase()}::${a}`;!r||B.has(n)||(B.add(n),z.push({name:r,source:e.source||"PHB"}))}),z.sort((e,o)=>{const r=e.name.localeCompare(o.name);return r!==0?r:e.source.localeCompare(o.source)});const H=(t.race||"").replace(/\s*\[.*?\]$/,"").replace(/\s*\([^)]*\).*$/,"").trim().toLowerCase(),$=[],I=new Set;C.forEach(e=>{if((e.raceName||e.name||"").replace(/\s*\[.*?\]$/,"").replace(/\s*\([^)]*\).*$/,"").trim().toLowerCase()===H){let r=e.subraceName||(e.name&&e.name.includes("(")?e.name.match(/\(([^)]+)\)/)?.[1]:"");if(r){r=r.replace(/^variant;\s*/i,"").trim();const a=`${r.toLowerCase()}::${(e.source||"PHB").toUpperCase()}`;!I.has(a)&&v(e.source,r,c)&&(I.add(a),$.push({name:r,source:e.source||"PHB"}))}}}),$.sort((e,o)=>{const r=e.name.localeCompare(o.name);return r!==0?r:e.source.localeCompare(o.source)});const P=(x?.bgs||[]).filter(e=>v(e.source,e.name,c)).map(e=>({name:e.name,source:e.source})).sort((e,o)=>e.name.localeCompare(o.name)),S=(x?.classes||[]).filter(e=>v(e.source,e.name,c)).map(e=>({name:e.name,source:e.source})).sort((e,o)=>e.name.localeCompare(o.name));t.tokenImages=Array.isArray(t.tokenImages)?t.tokenImages:[],(typeof t.activeTokenIndex!="number"||t.activeTokenIndex<0)&&(t.activeTokenIndex=0);const y=t.tokenImages[t.activeTokenIndex]||t.tokenImages[0],E=y?typeof y=="string"?y:y.url:t.avatar||"favicon.svg";L.innerHTML=`
        <!-- Character Identity: Name & Multi-Token Art -->
        <div class="builder-section-box" style="border-left: 3px solid var(--color-gold-base);">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-id-card text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Hero Identity & Token Artwork</strong>
                </div>
            </div>
            <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
                <!-- Circular Avatar Preview with active indicator -->
                <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <div id="pc-wiz-token-preview-circle" style="width:72px; height:72px; border-radius:50%; border:2px solid var(--color-gold-base); overflow:hidden; background:rgba(0,0,0,0.5); box-shadow:0 0 12px rgba(212,175,55,0.35); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <img id="pc-wiz-active-token-img" src="${l(_(E))}" data-raw-src="${l(E)}" alt="Token Art" style="width:100%; height:100%; object-fit:cover; display:block;" data-fallback-src="favicon.svg">
                    </div>
                    <span class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-base); font-size:0.65rem; padding:1px 6px; border-radius:3px;">Active Token</span>
                </div>

                <!-- Name & Upload Controls -->
                <div style="flex:1; min-width:260px; display:flex; flex-direction:column; gap:10px;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-signature text-gradient-gold"></i> Character Name
                        </label>
                        <input type="text" id="pc-wizard-char-name" placeholder="Enter hero name (e.g. Valeros of Neverwinter)" value="${l(t.name||"")}" style="width:100%; padding:8px 12px; font-size:1rem; font-weight:bold; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); border-radius:6px;">
                    </div>

                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <input type="file" id="pc-wiz-token-file" accept="image/*,video/mp4,video/webm" style="display:none;">
                        <button type="button" id="pc-wiz-upload-token-btn" class="btn btn-secondary btn-xs" style="display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Upload Media
                        </button>
                        <button type="button" id="pc-wiz-add-url-token-btn" class="btn btn-secondary btn-xs" style="display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-link"></i> Add from URL
                        </button>
                    </div>

                    <!-- Token Gallery / Thumbnails -->
                    ${t.tokenImages.length>0?`
                        <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
                            <span style="font-size:0.75rem; color:var(--color-text-muted);">Uploaded Token Gallery (Click to select active):</span>
                            <div id="pc-wiz-token-thumbnails" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                                ${t.tokenImages.map((e,o)=>{const r=typeof e=="string"?e:e?.url||"",a=o===t.activeTokenIndex;return`
                                    <div class="pc-wiz-token-thumb-item" data-idx="${o}" style="position:relative; width:40px; height:40px; border-radius:50%; border:2px solid ${a?"var(--color-gold-base)":"var(--color-border-subtle)"}; overflow:hidden; cursor:pointer; background:rgba(0,0,0,0.5); box-shadow:${a?"0 0 8px rgba(212,175,55,0.6)":"none"};" title="${l(e.name||"Token")}">
                                        <img src="${l(_(r))}" data-raw-src="${l(r)}" style="width:100%; height:100%; object-fit:cover;" data-fallback-src="favicon.svg">
                                        <button type="button" class="pc-wiz-del-token-btn" data-idx="${o}" style="position:absolute; top:-2px; right:-2px; width:16px; height:16px; border-radius:50%; background:#ef4444; border:none; color:#fff; font-size:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;" title="Remove this token">&times;</button>
                                    </div>
                                    `}).join("")}
                            </div>
                        </div>
                    `:""}
                </div>
            </div>
        </div>

        <!-- Species, Subrace & Background Selection -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-dna text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Origin: Species, Lineage & Background</strong>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px;">Species / Race</label>
                    <select id="pc-wizard-race" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:6px;">
                        <option value="">-- Choose Species --</option>
                        ${z.map(e=>{const o=t.race===e.name&&(!t.raceSource||(e.source||"PHB").toUpperCase()===String(t.raceSource||"").toUpperCase())&&!t.isCustomRace;return`<option value="${l(e.name)}::${l(e.source||"PHB")}" ${o?"selected":""}>${l(e.name)} [${l(e.source||"PHB")}]</option>`}).join("")}
                        <option value="__custom__" ${t.isCustomRace?"selected":""}>\u2795 Custom / Homebrew Species...</option>
                    </select>
                    <input type="text" id="pc-wizard-custom-race" placeholder="Enter custom species name" value="${l(t.customRaceText||"")}" style="width:100%; margin-top:6px; display:${t.isCustomRace?"block":"none"}; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                </div>

                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px;">Subrace / Lineage</label>
                    <select id="pc-wizard-subrace" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:6px;">
                        <option value="">None / Standard</option>
                        ${$.map(e=>{const o=t.subrace===e.name&&(!t.subraceSource||(e.source||"PHB").toUpperCase()===String(t.subraceSource||"").toUpperCase())&&!t.isCustomSubrace;return`<option value="${l(e.name)}::${l(e.source||"PHB")}" ${o?"selected":""}>${l(e.name)} [${l(e.source||"PHB")}]</option>`}).join("")}
                        <option value="__custom__" ${t.isCustomSubrace?"selected":""}>\u2795 Custom / Homebrew Subrace...</option>
                    </select>
                    <input type="text" id="pc-wizard-custom-subrace" placeholder="Enter custom subrace name" value="${l(t.customSubraceText||"")}" style="width:100%; margin-top:6px; display:${t.isCustomSubrace?"block":"none"}; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                </div>

                <div class="form-group">
                    <label style="font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); margin-bottom:4px;">Background</label>
                    <select id="pc-wizard-bg" style="width:100%; padding:8px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:6px;">
                        <option value="">-- Choose Background --</option>
                        ${P.map(e=>`<option value="${l(e.name)}::${l(e.source||"PHB")}" ${t.background===e.name&&(!t.backgroundSource||(e.source||"PHB").toUpperCase()===String(t.backgroundSource||"").toUpperCase())&&!t.isCustomBackground?"selected":""}>${l(e.name)} [${l(e.source||"PHB")}]</option>`).join("")}
                        <option value="__custom__" ${t.isCustomBackground?"selected":""}>\u2795 Custom / Homebrew Background...</option>
                    </select>
                    <input type="text" id="pc-wizard-custom-bg" placeholder="Enter custom background name" value="${l(t.customBackgroundText||"")}" style="width:100%; margin-top:6px; display:${t.isCustomBackground?"block":"none"}; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                </div>
            </div>
        </div>

        <!-- Multiclass Builder -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-shield text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Classes & Multiclassing</strong>
                    <span class="builder-pill" style="color:#4fc3f7;">Total Level: ${t.classes.reduce((e,o)=>e+(parseInt(o.level)||1),0)}</span>
                </div>
                <button type="button" id="pc-wiz-add-class-btn" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Multiclass</button>
            </div>
            <div id="pc-wiz-classes-container" style="display:flex; flex-direction:column; gap:8px;">
                ${t.classes.map((e,o)=>{const r=(e.source||"PHB").toUpperCase(),n=((x?.classes?.find(s=>(s.name||"").toLowerCase()===(e.name||"").toLowerCase()&&(!e.source||(s.source||"PHB").toUpperCase()===r))||x?.classes?.find(s=>(s.name||"").toLowerCase()===(e.name||"").toLowerCase()))?.subclasses||[]).filter(s=>{const g=(s.source||e.source||"PHB").toUpperCase();if(!v(g,s.name,c))return!1;if(r==="PHB"){if(g==="XPHB"||g.startsWith("XUA"))return!1}else if(r==="XPHB"&&g==="PHB")return!1;return!(c&&c.has("UA")&&(g.startsWith("UA")||g.startsWith("XUA")||s.name.includes("(UA)")))}),p=n.length>0;return`
                    <div class="glass-flat" style="padding:10px 12px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; border:1px solid var(--color-border-subtle); border-radius:6px;">
                        <div class="form-group" style="flex:2; min-width:140px;">
                            <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:600;">${o===0?"Primary Class":"Multiclass "+(o+1)}</label>
                            <select class="pc-wiz-cls-sel" data-idx="${o}" style="width:100%; padding:6px 8px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                ${S.map(s=>`<option value="${s.name}::${s.source||"PHB"}" ${e.name===s.name&&(!e.source||e.source===s.source)?"selected":""}>${s.name} [${s.source||"PHB"}]</option>`).join("")}
                                <option value="__custom__" ${e.isCustomClass?"selected":""}>\u2795 Custom Class...</option>
                            </select>
                            <input type="text" class="pc-wiz-custom-cls-input" data-idx="${o}" placeholder="Enter custom class name" value="${e.customClassText||""}" style="width:100%; margin-top:4px; display:${e.isCustomClass?"block":"none"}; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                        </div>
                        <div class="form-group" style="flex:2; min-width:140px;">
                            <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:600;">Subclass</label>
                            ${p?`
                                <select class="pc-wiz-subclass-sel" data-idx="${o}" style="width:100%; padding:6px 8px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    <option value="">None / Base Class</option>
                                    ${n.map(s=>`<option value="${s.name}" ${e.subclass===s.name&&!e.isCustomSubclass?"selected":""}>${s.name} [${s.source||"PHB"}]</option>`).join("")}
                                    <option value="__custom__" ${e.isCustomSubclass?"selected":""}>\u2795 Custom Subclass...</option>
                                </select>
                                <input type="text" class="pc-wiz-custom-subclass-input" data-idx="${o}" placeholder="Enter custom subclass name" value="${e.customSubclassText||""}" style="width:100%; margin-top:4px; display:${e.isCustomSubclass?"block":"none"}; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--color-gold-base); color:var(--color-gold-light); border-radius:4px;">
                            `:`
                                <input type="text" class="pc-wiz-subclass-input" data-idx="${o}" placeholder="None / e.g. Champion" value="${e.subclass||""}" style="width:100%; padding:6px 8px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            `}
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:600;">Level</label>
                            <input type="number" class="pc-wiz-cls-lvl" data-idx="${o}" min="1" max="20" value="${e.level||1}" style="width:100%; padding:6px 8px; text-align:center; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-gold-light); font-weight:bold; border-radius:4px;">
                        </div>
                        <button type="button" class="btn btn-danger btn-sm pc-wiz-cls-del" data-idx="${o}" ${t.classes.length<=1?"disabled":""} style="height:34px; padding:0 10px;" title="Remove Multiclass">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    `}).join("")}
            </div>
        </div>

        <!-- Speeds & Senses Overrides -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-person-running text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Speeds & Senses (ft)</strong>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:10px; margin-bottom:10px;">
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Walk</label>
                    <input type="number" id="pc-wiz-spd-walk" value="${t.speed.walk}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Climb</label>
                    <input type="number" id="pc-wiz-spd-climb" value="${t.speed.climb}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Fly</label>
                    <input type="number" id="pc-wiz-spd-fly" value="${t.speed.fly}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Burrow</label>
                    <input type="number" id="pc-wiz-spd-burrow" value="${t.speed.burrow}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Darkvision</label>
                    <input type="number" id="pc-wiz-sns-darkvision" value="${t.senses.darkvision}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Devil's Sight</label>
                    <input type="number" id="pc-wiz-sns-devilsight" value="${t.senses.devilSight}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Blindsight</label>
                    <input type="number" id="pc-wiz-sns-blindsight" value="${t.senses.blindsight}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Truesight</label>
                    <input type="number" id="pc-wiz-sns-truesight" value="${t.senses.truesight}" style="width:100%; text-align:center; padding:6px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
        </div>

        <!-- Bio & Description -->
        <div class="builder-section-box">
            <div class="builder-section-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-book-open text-gradient-gold"></i>
                    <strong style="font-size:0.95rem; color:var(--color-gold-base);">Character Bio & Background Details</strong>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Age</label>
                    <input type="text" id="pc-wiz-bio-age" value="${t.bio.age}" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Height</label>
                    <input type="text" id="pc-wiz-bio-height" value="${t.bio.height}" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Weight</label>
                    <input type="text" id="pc-wiz-bio-weight" value="${t.bio.weight}" style="width:100%; padding:6px 10px; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label style="font-size:0.75rem; color:var(--color-text-muted);">Backstory</label>
                <textarea id="pc-wiz-bio-backstory" class="scroll-styled" style="width:100%; height:80px; resize:vertical; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:8px 10px; border-radius:6px; font-family:var(--font-primary); font-size:0.85rem;">${t.bio.backstory}</textarea>
            </div>
            <div class="form-group">
                <label style="font-size:0.75rem; color:var(--color-text-muted);">Other Notes</label>
                <textarea id="pc-wiz-bio-notes" class="scroll-styled" style="width:100%; height:70px; resize:vertical; background:rgba(0,0,0,0.4); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:8px 10px; border-radius:6px; font-family:var(--font-primary); font-size:0.85rem;">${t.bio.notes}</textarea>
            </div>
        </div>
    `,document.getElementById("pc-wizard-char-name")?.addEventListener("input",e=>{t.name=e.target.value,i.updateTopSummary&&i.updateTopSummary()});const T=document.getElementById("pc-wiz-token-file");document.getElementById("pc-wiz-upload-token-btn")?.addEventListener("click",()=>T?.click()),T?.addEventListener("change",async e=>{const o=e.target.files?.[0];if(!o)return;const r=new FormData;r.append("file",o);try{const a=typeof window<"u"&&typeof window.vttAuthHeaders=="function"?window.vttAuthHeaders():{},n=await fetch("/api/assets/upload",{method:"POST",headers:a,body:r});if(n.ok){const p=await n.json(),s=p.url||p.path||p.filePath;s&&(t.tokenImages.push({url:s,name:o.name}),t.activeTokenIndex=t.tokenImages.length-1,t.avatar=s,renderStep1(i))}else console.error("Token upload failed:",n.statusText)}catch(a){console.error("Error uploading token image:",a)}}),document.getElementById("pc-wiz-add-url-token-btn")?.addEventListener("click",()=>{const e=prompt("Enter token image/media URL (e.g., https://... or /assets/...):");if(e&&e.trim()){const o=e.trim();t.tokenImages.push({url:o,name:`Token ${t.tokenImages.length+1}`}),t.activeTokenIndex=t.tokenImages.length-1,t.avatar=o,renderStep1(i)}}),document.querySelectorAll(".pc-wiz-token-thumb-item").forEach(e=>{e.addEventListener("click",o=>{if(o.target.closest(".pc-wiz-del-token-btn"))return;const r=parseInt(e.dataset.idx);if(!isNaN(r)&&t.tokenImages[r]){t.activeTokenIndex=r;const a=t.tokenImages[r];t.avatar=typeof a=="string"?a:a?.url,renderStep1(i)}})}),document.querySelectorAll(".pc-wiz-del-token-btn").forEach(e=>{e.addEventListener("click",o=>{o.stopPropagation();const r=parseInt(e.dataset.idx);if(!isNaN(r)&&t.tokenImages[r]){t.tokenImages.splice(r,1),t.activeTokenIndex>=t.tokenImages.length&&(t.activeTokenIndex=Math.max(0,t.tokenImages.length-1));const a=t.tokenImages[t.activeTokenIndex];t.avatar=a?typeof a=="string"?a:a?.url:"",renderStep1(i)}})}),["pc-wiz-spd-walk","pc-wiz-spd-climb","pc-wiz-spd-fly","pc-wiz-spd-burrow"].forEach(e=>{document.getElementById(e)?.addEventListener("input",()=>{t._manualSpeedCustomized=!0})});const f=document.getElementById("pc-wizard-race"),u=document.getElementById("pc-wizard-custom-race");u?.addEventListener("input",()=>{t.customRaceText=u.value.trim(),t.race=t.customRaceText||"Custom Species"}),f?.addEventListener("change",()=>{if(f.value==="__custom__")u&&(u.style.display="block"),t.isCustomRace=!0;else{u&&(u.style.display="none"),t.isCustomRace=!1;const[e,o]=f.value.split("::");t.race=e||f.value,t.raceSource=o||"",t.subrace="",t.subraceSource=""}d().then(()=>renderStep1(i))});const h=document.getElementById("pc-wizard-subrace"),m=document.getElementById("pc-wizard-custom-subrace");m?.addEventListener("input",()=>{t.customSubraceText=m.value.trim(),t.subrace=t.customSubraceText||""}),h?.addEventListener("change",()=>{if(h.value==="__custom__")m&&(m.style.display="block"),t.isCustomSubrace=!0;else{m&&(m.style.display="none"),t.isCustomSubrace=!1;const[e,o]=h.value.split("::");t.subrace=e||h.value,t.subraceSource=o||""}d().then(()=>renderStep1(i))});const w=document.getElementById("pc-wizard-bg"),b=document.getElementById("pc-wizard-custom-bg");b?.addEventListener("input",()=>{t.customBackgroundText=b.value.trim(),t.background=t.customBackgroundText||"Custom Background"}),w?.addEventListener("change",()=>{if(w.value==="__custom__")b&&(b.style.display="block"),t.isCustomBackground=!0;else{b&&(b.style.display="none"),t.isCustomBackground=!1;const[e,o]=w.value.split("::");t.background=e||w.value,t.backgroundSource=o||""}d().then(()=>renderStep1(i))}),document.getElementById("pc-wiz-add-class-btn")?.addEventListener("click",()=>{k();const e=t.classes.map(r=>r.name),o=S.find(r=>!e.includes(r.name))||S[0];t.classes.push({name:o?.name||"Fighter",source:o?.source||"PHB",subclass:"",level:1}),d().then(()=>renderStep1(i))}),document.querySelectorAll(".pc-wiz-cls-del").forEach(e=>{e.addEventListener("click",o=>{k();const r=parseInt(o.currentTarget.dataset.idx);t.classes.length>1&&(t.classes.splice(r,1),d().then(()=>renderStep1(i)))})}),document.querySelectorAll(".pc-wiz-cls-sel").forEach(e=>{e.addEventListener("change",async o=>{await k();const r=parseInt(o.target.dataset.idx),a=document.querySelector(`.pc-wiz-custom-cls-input[data-idx="${r}"]`);if(o.target.value==="__custom__")a&&(a.style.display="block"),t.classes[r].isCustomClass=!0;else{a&&(a.style.display="none"),t.classes[r].isCustomClass=!1;const[n,p]=o.target.value.split("::");t.classes[r].name=n||o.target.value,t.classes[r].source=p||"PHB",t.classes[r].subclass=""}await d(),renderStep1(i)})}),document.querySelectorAll(".pc-wiz-subclass-sel").forEach(e=>{e.addEventListener("change",o=>{const r=parseInt(o.target.dataset.idx),a=document.querySelector(`.pc-wiz-custom-subclass-input[data-idx="${r}"]`);o.target.value==="__custom__"?(a&&(a.style.display="block"),t.classes[r].isCustomSubclass=!0):(a&&(a.style.display="none"),t.classes[r].isCustomSubclass=!1,t.classes[r].subclass=o.target.value),d()})}),document.querySelectorAll(".pc-wiz-custom-subclass-input").forEach(e=>{e.addEventListener("input",o=>{const r=parseInt(o.target.dataset.idx);t.classes[r].customSubclassText=o.target.value.trim(),t.classes[r].subclass=o.target.value.trim()})}),document.querySelectorAll(".pc-wiz-subclass-input").forEach(e=>{e.addEventListener("input",o=>{const r=parseInt(o.target.dataset.idx);t.classes[r].subclass=o.target.value.trim()})}),document.querySelectorAll(".pc-wiz-cls-lvl").forEach(e=>{e.addEventListener("change",o=>{const r=parseInt(o.target.dataset.idx);t.classes[r].level=Math.max(1,Math.min(20,parseInt(o.target.value)||1)),d().then(()=>renderStep1(i))})})}
