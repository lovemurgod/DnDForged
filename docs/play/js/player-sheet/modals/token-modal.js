import{openTokenCropper as T}from"../../canvas/tokens/vtt-token-cropper.js?v=mwzii5ci";import{isAnimatedMedia as S,promptAnimatedMediaChoice as U}from"../../canvas/tokens/vtt-canvas-token-borders.js?v=mwzii5ci";import{escapeHtml as L}from"../../vtt-utils.js?v=mwzii5ci";let v=[];export function getTempPlayerAurasList(){return v}export function setTempPlayerAurasList(t){v=t}export function getPlayerActiveTokenUrl(t){if(!t)return"favicon.svg";if(Array.isArray(t.tokenImages)&&t.tokenImages.length>0){const a=typeof t.activeTokenIndex=="number"&&t.activeTokenIndex>=0&&t.activeTokenIndex<t.tokenImages.length?t.activeTokenIndex:0,m=t.tokenImages[a]||t.tokenImages[0],c=typeof m=="string"?m:m?.url||"";if(c)return c}const r=t.isCompanion?"companion":"player";return t.tokenImage||t.avatar||t.img||t.avatarUrl||(t.monsterData&&typeof window.Renderer<"u"&&window.Renderer.monster?window.Renderer.monster.getTokenUrl(t.monsterData):null)||(typeof window<"u"&&window.VTT?.generateArcaneToken?window.VTT.generateArcaneToken(t.name||"Hero",r):null)||"favicon.svg"}export function updateTokenPortrait(t){const r=document.getElementById("pc-token-portrait");if(!r)return;r.innerHTML="";const a=(t||"").split("?")[0].toLowerCase(),m=typeof window.getSafeVttUrl=="function"?window.getSafeVttUrl(t):t&&(t.includes("discordapp.com")||t.includes("discordapp.net"))?"/api/proxy-discord?url="+encodeURIComponent(t):t,c=a.match(/\.(mp4|webm|ogg)$/i),y=t&&(t.includes("youtube.com/embed")||t.includes("youtube.com/watch")||t.includes("youtu.be/"));let e;c?(e=document.createElement("video"),e.src=m,e.muted=!0,e.loop=!0,e.autoplay=!0,e.playsInline=!0,e.draggable=!1,e.style.cssText="width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;",r.appendChild(e),e.play().catch(()=>{})):y?(e=document.createElement("iframe"),e.src=m,e.frameBorder="0",e.allow="autoplay; encrypted-media",e.style.cssText="width:100%; height:100%; pointer-events:none; border:none;",r.appendChild(e)):(e=document.createElement("img"),e.src=m||"favicon.svg",e.draggable=!1,e.style.cssText="width:100%; height:100%; object-fit:cover; display:block;",r.appendChild(e))}export function renderPlayerAuraList(){const t=document.getElementById("pc-token-auras-list");if(t){if(t.innerHTML="",v.length===0){t.innerHTML=`
            <div style="font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 20px; font-style: italic; background: rgba(0,0,0,0.1); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.06);">
                No active auras configured for this token.
            </div>
        `;return}v.forEach((r,a)=>{r.enabled===void 0&&(r.enabled=!0);const m=r.enabled!==!1,c=r.name||"",y=r.range!==void 0?r.range:10,e=r.shape||"circle",n=r.style||"both",d=r.opacity!==void 0?r.opacity:.3,h=r.color||"#d4af37",b=!!r.isExpanded,i=document.createElement("div");i.className="aura-item-card glass-flat",i.style.border="1px solid rgba(255,255,255,0.06)",i.style.borderRadius="6px",i.style.padding="10px",i.style.background=m?"rgba(0,0,0,0.15)":"rgba(0,0,0,0.08)",i.style.opacity=m?"1":"0.7",i.innerHTML=`
            <div class="aura-item-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; font-size: 0.75rem; color: var(--color-text-muted); ${b?"transform: rotate(90deg);":""}"></i>
                    <label class="aura-toggle-wrapper" style="margin: 0; display: flex; align-items: center; cursor: pointer;" title="${m?"Disable Aura":"Enable Aura"}">
                        <input type="checkbox" class="aura-enable-toggle" ${m?"checked":""} style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-gold-base);">
                    </label>
                    <span class="aura-title-text" style="font-size: 0.8rem; font-weight: bold; color: ${m?"var(--color-text-primary)":"var(--color-text-muted)"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${c?`<strong>${L(c)}</strong>`:`Aura ${a+1}`}: <span style="font-weight: normal; opacity: 0.85;">${y}ft ${e.charAt(0).toUpperCase()+e.slice(1)}</span>
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                    <span class="swatch-preview" style="width: 14px; height: 14px; border-radius: 50%; background: ${h}; border: 1px solid rgba(255,255,255,0.2); opacity: ${m?"1":"0.4"};"></span>
                    <button type="button" class="btn-delete-aura btn btn-icon btn-danger btn-xxs" style="padding: 2px 4px; font-size: 0.7rem; border-radius: 4px;" title="Delete Aura">
                        <i class="fa-solid fa-trash pointer-events-none"></i>
                    </button>
                </div>
            </div>
            
            <div class="aura-item-details ${b?"":"vtt-hidden"}" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Label / Name</label>
                    <input type="text" class="aura-name-input" placeholder="e.g. Spirit Guardians, Aura of Courage" value="${L(c)}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                </div>
                <div class="flex-row">
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Range (ft)</label>
                        <input type="number" class="aura-range-input" min="5" max="150" step="5" value="${y}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                    </div>
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Shape</label>
                        <select class="aura-shape-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                            <option value="circle" ${e==="circle"?"selected":""}>Circle</option>
                            <option value="square" ${e==="square"?"selected":""}>Square</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex-row mt-2">
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Render Style</label>
                        <select class="aura-style-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                            <option value="both" ${n==="both"?"selected":""}>Fill & Border</option>
                            <option value="fill" ${n==="fill"?"selected":""}>Fill Only</option>
                            <option value="border" ${n==="border"?"selected":""}>Border Only</option>
                        </select>
                    </div>
                    <div class="form-group w-50" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Opacity</label>
                        <div style="display: flex; align-items: center; gap: 8px; height: 28px;">
                            <input type="range" class="aura-opacity-slider" min="0.05" max="1.0" step="0.05" value="${d}" style="flex: 1; cursor: pointer;">
                            <span class="aura-opacity-val" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">${Math.round(d*100)}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-group mt-2" style="margin-bottom: 0;">
                    <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Color</label>
                    <div class="aura-color-picker-row" style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                        <input type="color" class="aura-color-input" value="${h}" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                    </div>
                </div>
            </div>
        `,t.appendChild(i);const p=i.querySelector(".aura-item-header"),l=i.querySelector(".aura-item-details"),o=i.querySelector(".aura-chevron");p.addEventListener("click",f=>{if(f.target.closest(".btn-delete-aura")||f.target.closest(".aura-toggle-wrapper"))return;l.classList.contains("vtt-hidden")?(l.classList.remove("vtt-hidden"),o.style.transform="rotate(90deg)",v[a].isExpanded=!0):(l.classList.add("vtt-hidden"),o.style.transform="rotate(0deg)",v[a].isExpanded=!1)});const s=i.querySelector(".aura-enable-toggle"),u=i.querySelector(".aura-name-input"),x=i.querySelector(".swatch-preview"),w=i.querySelector(".aura-title-text"),k=()=>{const f=i.querySelector(".aura-range-input").value,g=i.querySelector(".aura-shape-select").value,E=v[a].name,I=v[a].enabled!==!1;w.innerHTML=`
                ${E?`<strong>${L(E)}</strong>`:`Aura ${a+1}`}: <span style="font-weight: normal; opacity: 0.85;">${f}ft ${g.charAt(0).toUpperCase()+g.slice(1)}</span>
            `,w.style.color=I?"var(--color-text-primary)":"var(--color-text-muted)"};s.addEventListener("change",f=>{f.stopPropagation();const g=s.checked;v[a].enabled=g,k(),x.style.opacity=g?"1":"0.4",i.style.opacity=g?"1":"0.7",i.style.background=g?"rgba(0,0,0,0.15)":"rgba(0,0,0,0.08)"}),u.addEventListener("input",()=>{v[a].name=u.value.trim(),k()}),i.querySelector(".aura-range-input").addEventListener("input",f=>{v[a].range=parseInt(f.target.value)||10,k()}),i.querySelector(".aura-shape-select").addEventListener("change",f=>{v[a].shape=f.target.value,k()}),i.querySelector(".aura-style-select").addEventListener("change",f=>{v[a].style=f.target.value}),i.querySelector(".aura-opacity-slider").addEventListener("input",f=>{const g=parseFloat(f.target.value)||.3;v[a].opacity=g,i.querySelector(".aura-opacity-val").textContent=`${Math.round(g*100)}%`}),i.querySelector(".aura-color-input").addEventListener("input",f=>{v[a].color=f.target.value,x.style.background=f.target.value}),i.querySelector(".btn-delete-aura").addEventListener("click",f=>{f.stopPropagation(),v.splice(a,1),renderPlayerAuraList()})})}}export function renderPlayerTokenGallery(t={}){const{getCurrentChar:r=()=>window.currentChar}=t,a=r(),m=document.getElementById("pc-token-gallery");if(m){if(m.innerHTML="",!a||!a.tokenImages||a.tokenImages.length===0){m.innerHTML='<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No token artwork added.</span>';return}a.tokenImages.forEach((c,y)=>{const e=a.activeTokenIndex===y,n=c.url||"",d=typeof window.getSafeVttUrl=="function"?window.getSafeVttUrl(n):n&&(n.includes("discordapp.com")||n.includes("discordapp.net"))?"/api/proxy-discord?url="+encodeURIComponent(n):n,b=n.split("?")[0].toLowerCase().match(/\.(mp4|webm|ogg)$/i),i=n.includes("youtube.com/embed")||n.includes("youtube.com/watch")||n.includes("youtu.be/"),p=document.createElement("div");p.style.cssText=`position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${e?"var(--color-success-base)":"transparent"}; cursor:pointer;`,p.className="pc-token-gal-item",p.dataset.idx=y;let l;if(b?(l=document.createElement("video"),l.src=d,l.muted=!0,l.loop=!0,l.autoplay=!0,l.playsInline=!0,l.style.cssText="width:100%; height:100%; object-fit:cover; display:block;",l.play().catch(()=>{})):i?(l=document.createElement("iframe"),l.src=d,l.frameBorder="0",l.allow="autoplay; encrypted-media",l.style.cssText="width:100%; height:100%; pointer-events:none; border:none;"):(l=document.createElement("img"),l.src=d,l.title=c.name||"Token",l.style.cssText="width:100%; height:100%; object-fit:cover; display:block;"),p.appendChild(l),e){const u=document.createElement("div");u.style.cssText="position:absolute; top:2px; right:2px; background:var(--color-success-base); color:var(--color-on-success, #fff); border-radius:50%; width:16px; height:16px; font-size:0.6rem; display:flex; align-items:center; justify-content:center;",u.innerHTML='<i class="fa-solid fa-check"></i>',p.appendChild(u)}const o=document.createElement("button");o.className="btn btn-secondary btn-xxs pc-token-gal-crop",o.dataset.idx=y,o.style.cssText="position:absolute; bottom:2px; left:2px; padding:2px 4px;",o.title="Crop / Frame Token Art",o.innerHTML='<i class="fa-solid fa-crop"></i>',p.appendChild(o),o.addEventListener("click",u=>{u.stopPropagation(),!(S(c.url,c.name)&&!confirm("Cropping an animated token will freeze its animation into a static frame. Do you want to continue?"))&&T({sourceUrl:c.originalUrl||c.url,initialFraming:c.framing||{},initialBorder:a.tokenBorder||{shape:"circle",style:"solid",color:"#007bff",width:3},tokenName:a.name||"Hero",onSave:x=>{c.url=x.url,c.originalUrl=x.originalUrl,c.framing=x.framing,x.border&&(a.tokenBorder=x.border),a.activeTokenIndex=y,updateTokenPortrait(x.url),renderPlayerTokenGallery(t)}})});const s=document.createElement("button");s.className="btn btn-danger btn-xxs pc-token-gal-del",s.dataset.idx=y,s.style.cssText="position:absolute; bottom:2px; right:2px; padding:2px 4px;",s.innerHTML='<i class="fa-solid fa-trash"></i>',p.appendChild(s),p.addEventListener("click",u=>{u.target.closest(".pc-token-gal-del")||(a.activeTokenIndex=y,updateTokenPortrait(c.url),renderPlayerTokenGallery(t))}),s.addEventListener("click",u=>{u.stopPropagation(),a.tokenImages.splice(y,1),a.activeTokenIndex>=a.tokenImages.length?a.activeTokenIndex=Math.max(0,a.tokenImages.length-1):a.activeTokenIndex>y&&a.activeTokenIndex--,renderPlayerTokenGallery(t)}),m.appendChild(p),b&&l.play().catch(()=>{})})}}export function setupPlayerTokenEditListeners(t={}){const{getCurrentChar:r=()=>window.currentChar,saveAndEmit:a=e=>window.saveAndEmit?.(e),renderSheetData:m=e=>window.renderSheetData?.(e)}=t;document.getElementById("modal-pc-token-edit-close")?.addEventListener("click",()=>{document.getElementById("modal-pc-token-edit")?.classList.add("vtt-hidden"),document.getElementById("modal-pc-token-edit-overlay")?.classList.add("vtt-hidden")}),document.getElementById("modal-pc-token-edit-overlay")?.addEventListener("click",()=>{document.getElementById("modal-pc-token-edit")?.classList.add("vtt-hidden"),document.getElementById("modal-pc-token-edit-overlay")?.classList.add("vtt-hidden")}),document.getElementById("btn-pc-token-add-url")?.addEventListener("click",async()=>{const e=r(),n=document.getElementById("pc-token-add-url");let d=n?.value.trim();if(d){const h=document.getElementById("btn-pc-token-add-url"),b=h.innerHTML;h.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';try{const i=await fetch("/api/player-token/url",{method:"POST",headers:typeof window<"u"&&typeof window.vttAuthHeaders=="function"?window.vttAuthHeaders({"Content-Type":"application/json"}):{"Content-Type":"application/json"},body:JSON.stringify({url:d})});if(i.ok){const p=await i.json();n&&(n.value="");const l=()=>{e.tokenImages||(e.tokenImages=[]),e.tokenImages.push({url:p.url,originalUrl:d,name:"URL Media"}),e.activeTokenIndex=e.tokenImages.length-1,updateTokenPortrait(p.url),renderPlayerTokenGallery(t)},o=()=>{T({sourceUrl:p.url,tokenName:e.name||"Hero",initialBorder:e.tokenBorder||{shape:"circle",style:"solid",color:"#007bff",width:3},onSave:s=>{e.tokenImages||(e.tokenImages=[]),e.tokenImages.push({url:s.url,originalUrl:s.originalUrl,framing:s.framing,name:"URL Media"}),s.border&&(e.tokenBorder=s.border),e.activeTokenIndex=e.tokenImages.length-1,updateTokenPortrait(s.url),renderPlayerTokenGallery(t)}})};S(p.url,d)?U({url:p.url,fileName:d,onDirect:l,onCrop:o}):o()}else alert("Failed to process URL.")}catch(i){alert("Error: "+i.message)}finally{h.innerHTML=b}}}),document.getElementById("btn-pc-token-upload")?.addEventListener("click",async()=>{const e=r(),n=document.getElementById("pc-token-file");if(!n||n.files.length===0)return alert("Select a file first.");const d=n.files[0],h=new FormData;h.append("file",d);const b=document.getElementById("btn-pc-token-upload"),i=b.innerHTML;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';const p=typeof window<"u"&&typeof window.vttAuthHeaders=="function"?window.vttAuthHeaders():window.VTT?.gmSessionToken?{"x-gm-token":window.VTT.gmSessionToken}:{};try{const l=await fetch("/api/assets/upload",{method:"POST",headers:p,body:h});if(l.ok){const o=await l.json();n.value="";const s=()=>{e.tokenImages||(e.tokenImages=[]),e.tokenImages.push({url:o.url,originalUrl:o.url,name:d.name}),e.activeTokenIndex=e.tokenImages.length-1,updateTokenPortrait(o.url),renderPlayerTokenGallery(t)},u=()=>{T({sourceUrl:o.url,tokenName:e.name||"Hero",initialBorder:e.tokenBorder||{shape:"circle",style:"solid",color:"#007bff",width:3},onSave:x=>{e.tokenImages||(e.tokenImages=[]),e.tokenImages.push({url:x.url,originalUrl:x.originalUrl,framing:x.framing,name:d.name}),x.border&&(e.tokenBorder=x.border),e.activeTokenIndex=e.tokenImages.length-1,updateTokenPortrait(x.url),renderPlayerTokenGallery(t)}})};S(o.url,d.name)?U({url:o.url,fileName:d.name,onDirect:s,onCrop:u}):u()}else{const o=await l.json().catch(()=>null);alert("Upload failed: "+(o?.error||l.statusText||"Server error"))}}catch(l){alert("Error: "+l.message)}finally{b.innerHTML=i}}),document.getElementById("btn-pc-token-add-aura")?.addEventListener("click",()=>{v.forEach(n=>n.isExpanded=!1),v.push({name:"",enabled:!0,range:10,shape:"circle",style:"both",opacity:.3,color:"#d4af37",isExpanded:!0}),renderPlayerAuraList();const e=document.getElementById("pc-token-auras-list");setTimeout(()=>{e&&(e.scrollTop=e.scrollHeight)},50)});const c=(e,n)=>{["tab-btn-pc-fx-overlay","tab-btn-pc-fx-vignette","tab-btn-pc-fx-shadow"].forEach(d=>document.getElementById(d)?.classList.remove("active")),["panel-pc-fx-overlay","panel-pc-fx-vignette","panel-pc-fx-shadow"].forEach(d=>document.getElementById(d)?.classList.add("vtt-hidden")),document.getElementById(e)?.classList.add("active"),document.getElementById(n)?.classList.remove("vtt-hidden")};document.getElementById("tab-btn-pc-fx-overlay")?.addEventListener("click",()=>c("tab-btn-pc-fx-overlay","panel-pc-fx-overlay")),document.getElementById("tab-btn-pc-fx-vignette")?.addEventListener("click",()=>c("tab-btn-pc-fx-vignette","panel-pc-fx-vignette")),document.getElementById("tab-btn-pc-fx-shadow")?.addEventListener("click",()=>c("tab-btn-pc-fx-shadow","panel-pc-fx-shadow"));const y=(e,n)=>{document.getElementById(e)?.addEventListener("change",d=>{d.target.checked?document.getElementById(n)?.classList.remove("vtt-hidden"):document.getElementById(n)?.classList.add("vtt-hidden")})};y("pc-token-edit-fx-overlay-enabled","pc-fx-overlay-details"),y("pc-token-edit-fx-vignette-enabled","pc-fx-vignette-details"),y("pc-token-edit-fx-shadow-enabled","pc-fx-shadow-details"),document.getElementById("pc-token-edit-fx-overlay-opacity")?.addEventListener("input",e=>{const n=document.getElementById("val-pc-fx-overlay-opacity");n&&(n.textContent=`${Math.round(e.target.value*100)}%`)}),document.getElementById("pc-token-edit-fx-vignette-opacity")?.addEventListener("input",e=>{const n=document.getElementById("val-pc-fx-vignette-opacity");n&&(n.textContent=`${Math.round(e.target.value*100)}%`)}),document.getElementById("pc-token-edit-fx-shadow-opacity")?.addEventListener("input",e=>{const n=document.getElementById("val-pc-fx-shadow-opacity");n&&(n.textContent=`${Math.round(e.target.value*100)}%`)}),document.getElementById("pc-token-edit-border-width")?.addEventListener("input",e=>{const n=document.getElementById("val-pc-token-edit-border-width");n&&(n.textContent=`${e.target.value}px`)}),document.getElementById("pc-token-edit-border-style")?.addEventListener("change",e=>{const n=document.getElementById("pc-token-edit-frame-group");n&&n.classList.toggle("vtt-hidden",e.target.value!=="frame")}),document.getElementById("modal-pc-token-edit-save")?.addEventListener("click",()=>{const e=r();if(!e)return;e.tokenSize=parseFloat(document.getElementById("pc-token-edit-size")?.value)||1,e.tokenSight=parseInt(document.getElementById("pc-token-edit-sight")?.value)||60;const n=document.getElementById("pc-token-edit-border-shape")?.value||"circle",d=document.getElementById("pc-token-edit-border-style")?.value||"solid",h=document.getElementById("pc-token-edit-frame-preset")?.value||"none",b=document.getElementById("pc-token-edit-border-color")?.value||"#007bff",i=parseInt(document.getElementById("pc-token-edit-border-width")?.value)||3;if(e.tokenBorder={shape:n,style:d,framePreset:h,color:b,width:i},e.tokenAuras=v.map(p=>{const{isExpanded:l,...o}=p;return o}),e.fxOverlayEnabled=!!document.getElementById("pc-token-edit-fx-overlay-enabled")?.checked,e.fxOverlayOpacity=parseFloat(document.getElementById("pc-token-edit-fx-overlay-opacity")?.value)||.3,e.fxOverlayColor=document.getElementById("pc-token-edit-fx-overlay-color")?.value||"#007bff",e.fxVignetteEnabled=!!document.getElementById("pc-token-edit-fx-vignette-enabled")?.checked,e.fxVignetteOpacity=parseFloat(document.getElementById("pc-token-edit-fx-vignette-opacity")?.value)||.6,e.fxVignetteColor=document.getElementById("pc-token-edit-fx-vignette-color")?.value||"#000000",e.fxShadowEnabled=!!document.getElementById("pc-token-edit-fx-shadow-enabled")?.checked,e.fxShadowBlur=parseInt(document.getElementById("pc-token-edit-fx-shadow-blur")?.value)||12,e.fxShadowOffset=parseInt(document.getElementById("pc-token-edit-fx-shadow-offset")?.value)||4,e.fxShadowColor=document.getElementById("pc-token-edit-fx-shadow-color")?.value||"#000000",e.fxShadowOpacity=parseFloat(document.getElementById("pc-token-edit-fx-shadow-opacity")?.value)||.7,a(e),m(e),window.VTT&&window.VTT.canvasEngine){const p=window.VTT.canvasEngine.getTokens();let l=!1;if(Object.values(p).forEach(o=>{if(o.characterId===e.id||o.isPlayer&&o.name===e.name){const s=getPlayerActiveTokenUrl(e);o.img=s,o.size=e.tokenSize,o.sightRange=e.tokenSight;const u=s.split("?")[0].toLowerCase();o.isGif=u.endsWith(".gif")||s.includes(".gif"),o.isVideo=!o.isGif&&(u.endsWith(".mp4")||u.endsWith(".webm")||u.endsWith(".ogg")||u.endsWith(".m4v")||u.endsWith(".mov")||s.includes("youtube.com")||s.includes("youtu.be")||s.includes("pinimg.com/videos")),o.auras=JSON.parse(JSON.stringify(e.tokenAuras||[])),o.auras.length>0?(o.auraEnabled=!0,o.auraRange=o.auras[0].range,o.auraShape=o.auras[0].shape,o.auraStyle=o.auras[0].style,o.auraOpacity=o.auras[0].opacity,o.auraColor=o.auras[0].color):o.auraEnabled=!1,o.fxOverlayEnabled=e.fxOverlayEnabled,o.fxOverlayOpacity=e.fxOverlayOpacity,o.fxOverlayColor=e.fxOverlayColor,o.fxVignetteEnabled=e.fxVignetteEnabled,o.fxVignetteOpacity=e.fxVignetteOpacity,o.fxVignetteColor=e.fxVignetteColor,o.fxShadowEnabled=e.fxShadowEnabled,o.fxShadowBlur=e.fxShadowBlur,o.fxShadowOffset=e.fxShadowOffset,o.fxShadowColor=e.fxShadowColor,o.fxShadowOpacity=e.fxShadowOpacity,o.border=JSON.parse(JSON.stringify(e.tokenBorder||{})),o.ringColor=e.tokenBorder?.color||"#007bff",o.isBorderless=e.tokenBorder?.style==="none",o.name=e.name,o.hp=e.hpCurrent,o.maxHp=e.hpMax,o.tempHp=e.tempHp||0,o.characterId=e.id,l=!0}}),l&&(window.VTT.canvasEngine.setTokens(p),window.VTT?.chatEngine?.updateCombatantTokenArt)){const o=getPlayerActiveTokenUrl(e);window.VTT.chatEngine.updateCombatantTokenArt(null,o,e.id)}}document.getElementById("modal-pc-token-edit")?.classList.add("vtt-hidden"),document.getElementById("modal-pc-token-edit-overlay")?.classList.add("vtt-hidden")})}export function ensurePlayerTokenEditModalExists(t={}){if(document.getElementById("modal-pc-token-edit"))return;const r=document.createElement("div");r.innerHTML=`
        <div id="modal-pc-token-edit-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
        <div id="modal-pc-token-edit" class="vtt-sheet-submodal vtt-hidden" style="width:500px;">
            <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-gold-base);">Player Token Settings</h3>
                <button id="modal-pc-token-edit-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                <!-- Token Art Section -->
                <div class="form-group">
                    <h4 style="margin:0 0 12px 0; color:var(--color-text-primary);">Token Artwork</h4>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <input type="text" id="pc-token-add-url" placeholder="Image URL..." style="flex:1;">
                        <button id="btn-pc-token-add-url" class="btn btn-secondary btn-xs">Add URL</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted);">OR</span>
                        <input type="file" id="pc-token-file" accept="image/*,video/mp4,video/webm" style="font-size:0.75rem; color:var(--color-text-muted);">
                        <button id="btn-pc-token-upload" class="btn btn-secondary btn-xs">Upload</button>
                    </div>
                    <div id="pc-token-gallery" style="display:flex; flex-wrap:wrap; gap:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px; min-height:80px;">
                        <!-- Gallery items injected here -->
                    </div>
                </div>
                
                <div class="flex-row">
                    <div class="form-group w-50">
                        <label>Token Size Category</label>
                        <select id="pc-token-edit-size" style="width:100%;">
                            <option value="0.5">Small (0.5x0.5 Grid)</option>
                            <option value="1">Medium (1x1 Grid)</option>
                            <option value="2">Large (2x2)</option>
                            <option value="3">Huge (3x3)</option>
                            <option value="4">Gargantuan (4x4)</option>
                        </select>
                    </div>
                    <div class="form-group w-50">
                        <label>Sight Range (ft)</label>
                        <input type="number" id="pc-token-edit-sight" min="0" max="240" step="5" value="60" style="width:100%;" disabled title="Token Sight is managed automatically from the Build Tab Vision settings.">
                        <small style="color:var(--color-text-muted); font-size:0.7rem; margin-top:2px; display:block;">Managed by Build Tab</small>
                    </div>
                </div>

                <!-- Token Border & Frame Section -->
                <div class="form-group border-top-subtle pt-3 mt-3">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-shapes"></i> Token Border & Frame</span>
                    </h4>
                    <div class="flex-row">
                        <div class="form-group w-50" style="margin-bottom: 8px;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Border Shape</label>
                            <select id="pc-token-edit-border-shape" style="width: 100%; font-size: 0.8rem; padding: 4px 6px;">
                                <option value="circle">Circle (Round)</option>
                                <option value="squircle">Squircle (Rounded Square)</option>
                                <option value="square">Square</option>
                                <option value="hexagon">Hexagon</option>
                                <option value="octagon">Octagon</option>
                                <option value="shield">Shield</option>
                            </select>
                        </div>
                        <div class="form-group w-50" style="margin-bottom: 8px;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Border Style</label>
                            <select id="pc-token-edit-border-style" style="width: 100%; font-size: 0.8rem; padding: 4px 6px;">
                                <option value="solid">Solid Line</option>
                                <option value="double">Double Ring</option>
                                <option value="dashed">Dashed Line</option>
                                <option value="glow">Neon Glow</option>
                                <option value="frame">Thematic Frame</option>
                                <option value="none">Borderless</option>
                            </select>
                        </div>
                    </div>
                    <div id="pc-token-edit-frame-group" class="form-group vtt-hidden" style="margin-bottom: 8px;">
                        <label style="font-size: 0.72rem; color: var(--color-gold-base); margin-bottom: 2px;">Thematic Frame Preset</label>
                        <select id="pc-token-edit-frame-preset" style="width: 100%; font-size: 0.8rem; padding: 4px 6px;">
                            <option value="ornate_gold">\u2728 Ornate Gold Filigree</option>
                            <option value="silver_mithral">\u{1F6E1}\uFE0F Mithral Silver Ring</option>
                            <option value="gothic_iron">\u26D3\uFE0F Gothic Spiked Iron</option>
                            <option value="arcane_runic">\u{1F52E} Glowing Arcane Runes</option>
                            <option value="legendary_crown">\u{1F451} Legendary Boss Crown</option>
                        </select>
                    </div>
                    <div class="flex-row">
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Border Color</label>
                            <input type="color" id="pc-token-edit-border-color" value="#007bff" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                        </div>
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Thickness</label>
                                <span id="val-pc-token-edit-border-width" style="font-family: monospace; font-size: 0.75rem; color: var(--color-gold-base);">3px</span>
                            </div>
                            <input type="range" id="pc-token-edit-border-width" min="1" max="8" step="1" value="3" style="width: 100%; cursor: pointer;">
                        </div>
                    </div>
                </div>

                <!-- Aura Settings Section -->
                <div class="form-group border-top-subtle pt-3 mt-3">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-circle-nodes"></i> Token Auras</span>
                        <button type="button" id="btn-pc-token-add-aura" class="btn btn-secondary btn-xxs" style="padding: 4px 8px; font-size: 0.72rem;">
                            <i class="fa-solid fa-plus"></i> Add Aura
                        </button>
                    </h4>
                    <div id="pc-token-auras-list" style="margin-top: 10px; max-height: 260px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px;">
                        <!-- Auras dynamically rendered here -->
                    </div>
                </div>

                <!-- Token Visual Effects Section -->
                <div class="form-group border-top-subtle pt-3 mt-3">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Token Visual Effects
                    </h4>
                    
                    <div class="flex-row" style="gap: 4px; margin-bottom: 12px;">
                        <button type="button" id="tab-btn-pc-fx-overlay" class="btn btn-secondary btn-xxs active" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Overlay</button>
                        <button type="button" id="tab-btn-pc-fx-vignette" class="btn btn-secondary btn-xxs" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Vignette</button>
                        <button type="button" id="tab-btn-pc-fx-shadow" class="btn btn-secondary btn-xxs" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Shadow</button>
                    </div>
                    
                    <!-- Overlay FX Panel -->
                    <div id="panel-pc-fx-overlay" class="fx-panel" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="config-setting">
                            <label>Enable Color Overlay</label>
                            <input type="checkbox" id="pc-token-edit-fx-overlay-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                        </div>
                        <div id="pc-fx-overlay-details" class="vtt-hidden">
                            <div class="config-setting">
                                <label>Overlay Opacity</label>
                                <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                    <input type="range" id="pc-token-edit-fx-overlay-opacity" min="0.05" max="0.9" step="0.05" value="0.3" style="flex: 1; cursor: pointer;">
                                    <span id="val-pc-fx-overlay-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">30%</span>
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Overlay Color</label>
                                <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                    <input type="color" id="pc-token-edit-fx-overlay-color" value="#007bff" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Vignette FX Panel -->
                    <div id="panel-pc-fx-vignette" class="fx-panel vtt-hidden" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="config-setting">
                            <label>Enable Border Vignette</label>
                            <input type="checkbox" id="pc-token-edit-fx-vignette-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                        </div>
                        <div id="pc-fx-vignette-details" class="vtt-hidden">
                            <div class="config-setting">
                                <label>Vignette Depth</label>
                                <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                    <input type="range" id="pc-token-edit-fx-vignette-opacity" min="0.1" max="1.0" step="0.05" value="0.6" style="flex: 1; cursor: pointer;">
                                    <span id="val-pc-fx-vignette-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">60%</span>
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Vignette Color</label>
                                <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                    <input type="color" id="pc-token-edit-fx-vignette-color" value="#000000" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Shadow FX Panel -->
                    <div id="panel-pc-fx-shadow" class="fx-panel vtt-hidden" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="config-setting">
                            <label>Enable Floor Shadow</label>
                            <input type="checkbox" id="pc-token-edit-fx-shadow-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                        </div>
                        <div id="pc-fx-shadow-details" class="vtt-hidden">
                            <div class="flex-row">
                                <div class="form-group w-50" style="margin-bottom: 0;">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Blur (px)</label>
                                    <input type="number" id="pc-token-edit-fx-shadow-blur" min="0" max="40" value="12" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                </div>
                                <div class="form-group w-50" style="margin-bottom: 0;">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Offset (px)</label>
                                    <input type="number" id="pc-token-edit-fx-shadow-offset" min="-20" max="20" value="4" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                </div>
                            </div>
                            <div class="form-group mt-2">
                                <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Color & Opacity</label>
                                <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                    <input type="color" id="pc-token-edit-fx-shadow-color" value="#000000" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                                        <input type="range" id="pc-token-edit-fx-shadow-opacity" min="0.1" max="1.0" step="0.05" value="0.7" style="flex: 1; cursor: pointer;">
                                        <span id="val-pc-fx-shadow-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">70%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                <button id="modal-pc-token-edit-save" class="btn btn-primary">Save Changes</button>
            </div>
        </div>
    `,document.body.appendChild(r),setupPlayerTokenEditListeners(t)}export function openPlayerTokenEditModal(t,r={}){if(ensurePlayerTokenEditModalExists(r),!t)return;const a=document.getElementById("pc-token-edit-size"),m=document.getElementById("pc-token-edit-sight");a&&(a.value=t.tokenSize||1),m&&(m.value=t.tokenSight!==void 0?t.tokenSight:0),v=(t.tokenAuras||[]).map((B,$)=>({...B,enabled:B.enabled!==void 0?B.enabled:!0,name:B.name||"",isExpanded:$===0})),renderPlayerAuraList();const c=document.getElementById("pc-token-edit-fx-overlay-enabled"),y=document.getElementById("pc-token-edit-fx-overlay-opacity"),e=document.getElementById("val-pc-fx-overlay-opacity"),n=document.getElementById("pc-token-edit-fx-overlay-color"),d=document.getElementById("pc-fx-overlay-details");c&&(c.checked=!!t.fxOverlayEnabled),y&&(y.value=t.fxOverlayOpacity!==void 0?t.fxOverlayOpacity:.3),e&&(e.textContent=`${Math.round((t.fxOverlayOpacity!==void 0?t.fxOverlayOpacity:.3)*100)}%`),n&&(n.value=t.fxOverlayColor||"#007bff"),d&&(t.fxOverlayEnabled?d.classList.remove("vtt-hidden"):d.classList.add("vtt-hidden"));const h=document.getElementById("pc-token-edit-fx-vignette-enabled"),b=document.getElementById("pc-token-edit-fx-vignette-opacity"),i=document.getElementById("val-pc-fx-vignette-opacity"),p=document.getElementById("pc-token-edit-fx-vignette-color"),l=document.getElementById("pc-fx-vignette-details");h&&(h.checked=!!t.fxVignetteEnabled),b&&(b.value=t.fxVignetteOpacity!==void 0?t.fxVignetteOpacity:.6),i&&(i.textContent=`${Math.round((t.fxVignetteOpacity!==void 0?t.fxVignetteOpacity:.6)*100)}%`),p&&(p.value=t.fxVignetteColor||"#000000"),l&&(t.fxVignetteEnabled?l.classList.remove("vtt-hidden"):l.classList.add("vtt-hidden"));const o=document.getElementById("pc-token-edit-fx-shadow-enabled"),s=document.getElementById("pc-token-edit-fx-shadow-blur"),u=document.getElementById("pc-token-edit-fx-shadow-offset"),x=document.getElementById("pc-token-edit-fx-shadow-color"),w=document.getElementById("pc-token-edit-fx-shadow-opacity"),k=document.getElementById("val-pc-fx-shadow-opacity"),f=document.getElementById("pc-fx-shadow-details");o&&(o.checked=!!t.fxShadowEnabled),s&&(s.value=t.fxShadowBlur!==void 0?t.fxShadowBlur:12),u&&(u.value=t.fxShadowOffset!==void 0?t.fxShadowOffset:4),x&&(x.value=t.fxShadowColor||"#000000"),w&&(w.value=t.fxShadowOpacity!==void 0?t.fxShadowOpacity:.7),k&&(k.textContent=`${Math.round((t.fxShadowOpacity!==void 0?t.fxShadowOpacity:.7)*100)}%`),f&&(t.fxShadowEnabled?f.classList.remove("vtt-hidden"):f.classList.add("vtt-hidden"));const g=t.tokenBorder||{},E=document.getElementById("pc-token-edit-border-shape"),I=document.getElementById("pc-token-edit-border-style"),C=document.getElementById("pc-token-edit-frame-preset"),O=document.getElementById("pc-token-edit-frame-group"),z=document.getElementById("pc-token-edit-border-color"),A=document.getElementById("pc-token-edit-border-width"),V=document.getElementById("val-pc-token-edit-border-width");E&&(E.value=g.shape||"circle"),I&&(I.value=g.style||"solid"),C&&(C.value=g.framePreset||"none"),O&&O.classList.toggle("vtt-hidden",(g.style||"solid")!=="frame"),z&&(z.value=g.color||"#007bff"),A&&(A.value=g.width!==void 0?g.width:3),V&&(V.textContent=`${g.width!==void 0?g.width:3}px`),renderPlayerTokenGallery(r),document.getElementById("modal-pc-token-edit")?.classList.remove("vtt-hidden"),document.getElementById("modal-pc-token-edit-overlay")?.classList.remove("vtt-hidden")}
