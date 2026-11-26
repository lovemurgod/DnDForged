import{traceTokenCanvasPath as M}from"./vtt-canvas-token-borders.js";let Z=null;export function openTokenCropper(B={}){const{sourceUrl:H,initialFraming:b={},initialBorder:y={},tokenName:_="Token",onSave:A=()=>{}}=B;if(!H)return;q();const P=document.getElementById("modal-token-cropper"),L=document.getElementById("modal-token-cropper-overlay");if(!P||!L)return;const e={img:new Image,imgLoaded:!1,sourceUrl:H,scale:b.scale!==void 0?b.scale:1,offsetX:b.offsetX!==void 0?b.offsetX:0,offsetY:b.offsetY!==void 0?b.offsetY:0,rotation:b.rotation!==void 0?b.rotation:0,shape:y.shape||"circle",borderStyle:y.style||"solid",framePreset:y.framePreset||"none",borderColor:y.color||"#007bff",borderWidth:y.width!==void 0?y.width:3,isDragging:!1,dragStartX:0,dragStartY:0,baseOffsetX:0,baseOffsetY:0},f=document.getElementById("token-cropper-canvas"),o=f.getContext("2d"),l=360;f.width=l,f.height=l;const u=document.getElementById("token-cropper-zoom"),c=document.getElementById("token-cropper-zoom-val"),S=document.getElementById("token-cropper-shape"),C=document.getElementById("token-cropper-border-style"),v=document.getElementById("token-cropper-frame-preset-group"),W=document.getElementById("token-cropper-frame-preset"),T=document.getElementById("token-cropper-border-color"),D=document.getElementById("token-cropper-border-width"),I=document.getElementById("token-cropper-border-width-val");u&&(u.value=e.scale),c&&(c.textContent=`${Math.round(e.scale*100)}%`),S&&(S.value=e.shape),C&&(C.value=e.borderStyle),W&&(W.value=e.framePreset),T&&(T.value=e.borderColor),D&&(D.value=e.borderWidth),I&&(I.textContent=`${e.borderWidth}px`),v&&v.classList.toggle("vtt-hidden",e.borderStyle!=="frame");const n=()=>{o.clearRect(0,0,l,l);const t=12;for(let r=0;r<l;r+=t)for(let d=0;d<l;d+=t)o.fillStyle=(d/t+r/t)%2===0?"#181b20":"#22262d",o.fillRect(d,r,t,t);const i=l/2,a=l/2,s=l*.44;if(e.imgLoaded){o.save(),o.translate(i+e.offsetX,a+e.offsetY),e.rotation&&o.rotate(e.rotation*Math.PI/180),o.scale(e.scale,e.scale);const r=e.img.naturalWidth||100,d=e.img.naturalHeight||100,g=s*2;let x,w;r>=d?(w=g,x=r/d*g):(x=g,w=d/r*g),o.drawImage(e.img,-x/2,-w/2,x,w),o.restore()}o.save(),o.fillStyle="rgba(0, 0, 0, 0.65)",o.fillRect(0,0,l,l),o.globalCompositeOperation="destination-out",M(o,i,a,s,e.shape),o.fill(),o.restore(),e.borderStyle!=="none"&&(o.save(),o.strokeStyle=e.borderColor,o.lineWidth=e.borderWidth,e.borderStyle==="dashed"?o.setLineDash([8,6]):e.borderStyle==="glow"&&(o.shadowColor=e.borderColor,o.shadowBlur=10),M(o,i,a,s,e.shape),o.stroke(),e.borderStyle==="double"&&(o.lineWidth=Math.max(1,e.borderWidth*.5),M(o,i,a,s-e.borderWidth-2,e.shape),o.stroke()),o.restore())};e.img.crossOrigin="anonymous",e.img.onload=()=>{e.imgLoaded=!0,n()},e.img.onerror=()=>{console.warn("Token Cropper: Failed to load source image:",e.sourceUrl)},e.img.src=e.sourceUrl;const U=t=>{e.isDragging=!0,e.dragStartX=t.clientX||t.touches?.[0]?.clientX||0,e.dragStartY=t.clientY||t.touches?.[0]?.clientY||0,e.baseOffsetX=e.offsetX,e.baseOffsetY=e.offsetY,f.style.cursor="grabbing"},z=t=>{if(!e.isDragging)return;const i=t.clientX||t.touches?.[0]?.clientX||0,a=t.clientY||t.touches?.[0]?.clientY||0;e.offsetX=e.baseOffsetX+(i-e.dragStartX),e.offsetY=e.baseOffsetY+(a-e.dragStartY),n()},Y=()=>{e.isDragging=!1,f.style.cursor="grab"};f.onmousedown=U,window.addEventListener("mousemove",z),window.addEventListener("mouseup",Y),f.ontouchstart=U,window.addEventListener("touchmove",z),window.addEventListener("touchend",Y),f.onwheel=t=>{t.preventDefault();const i=t.deltaY<0?.08:-.08;e.scale=Math.max(.4,Math.min(4,e.scale+i)),u&&(u.value=e.scale),c&&(c.textContent=`${Math.round(e.scale*100)}%`),n()},u.oninput=t=>{e.scale=parseFloat(t.target.value)||1,c&&(c.textContent=`${Math.round(e.scale*100)}%`),n()},S.onchange=t=>{e.shape=t.target.value,e.shape!=="circle"&&e.borderStyle==="frame"&&(e.borderStyle="solid",C&&(C.value="solid"),v&&v.classList.add("vtt-hidden")),n()},C.onchange=t=>{e.borderStyle=t.target.value,e.borderStyle==="frame"&&(e.shape="circle",S&&(S.value="circle")),v&&v.classList.toggle("vtt-hidden",e.borderStyle!=="frame"),n()},W.onchange=t=>{e.framePreset=t.target.value,n()},T.oninput=t=>{e.borderColor=t.target.value,n()},D.oninput=t=>{e.borderWidth=parseInt(t.target.value)||3,I&&(I.textContent=`${e.borderWidth}px`),n()},document.querySelectorAll(".token-cropper-swatch").forEach(t=>{t.onclick=()=>{const i=t.dataset.color;i&&(e.borderColor=i,T.value=i,n())}}),document.getElementById("btn-cropper-focus-face").onclick=()=>{e.offsetX=0,e.offsetY=l*.18,e.scale=Math.max(1.15,e.scale),u&&(u.value=e.scale),c&&(c.textContent=`${Math.round(e.scale*100)}%`),n()},document.getElementById("btn-cropper-center").onclick=()=>{e.offsetX=0,e.offsetY=0,n()},document.getElementById("btn-cropper-fit").onclick=()=>{e.offsetX=0,e.offsetY=0,e.scale=1,u&&(u.value=1),c&&(c.textContent="100%"),n()},document.getElementById("btn-cropper-rotate-ccw").onclick=()=>{e.rotation=(e.rotation-90+360)%360,n()},document.getElementById("btn-cropper-rotate-cw").onclick=()=>{e.rotation=(e.rotation+90)%360,n()};const R=()=>{P.classList.add("vtt-hidden"),L.classList.add("vtt-hidden"),window.removeEventListener("mousemove",z),window.removeEventListener("mouseup",Y),window.removeEventListener("touchmove",z),window.removeEventListener("touchend",Y)};document.getElementById("btn-cropper-cancel").onclick=R,document.getElementById("btn-cropper-close").onclick=R,L.onclick=R,document.getElementById("btn-cropper-apply").onclick=async()=>{const t=document.getElementById("btn-cropper-apply"),i=t.innerHTML;t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...',t.disabled=!0;try{const a=document.createElement("canvas"),s=512;a.width=s,a.height=s;const r=a.getContext("2d"),d=s/2,g=s/2,x=s/2,w=(f.width||360)*.44,X=s/(w*2);if(r.save(),M(r,d,g,x,e.shape),r.clip(),e.imgLoaded){r.translate(d+e.offsetX*X,g+e.offsetY*X),e.rotation&&r.rotate(e.rotation*Math.PI/180),r.scale(e.scale*X,e.scale*X);const m=e.img.naturalWidth||100,E=e.img.naturalHeight||100,k=s;let p,h;m>=E?(h=k,p=m/E*k):(p=k,h=E/m*k),r.drawImage(e.img,-p/2,-h/2,p,h)}r.restore();const O=await new Promise(m=>a.toBlob(m,"image/png"));let F=e.sourceUrl;if(O){const m=new FormData,E=(_||"token").replace(/[^a-zA-Z0-9_-]/g,"_").toLowerCase();m.append("file",O,`${E}_token_${Date.now()}.png`);const k=typeof window<"u"&&typeof window.vttAuthHeaders=="function"?window.vttAuthHeaders():window.VTT?.gmSessionToken?{"x-gm-token":window.VTT.gmSessionToken}:{};try{const p=await fetch("/api/assets/upload",{method:"POST",headers:k,body:m});if(p.ok){const h=await p.json();h.url&&(F=h.url)}else console.warn("Token Cropper: Upload failed with status",p.status,"falling back to data URL"),F=a.toDataURL("image/png")}catch(p){console.warn("Token Cropper: Upload failed, falling back to data URL",p),F=a.toDataURL("image/png")}}const G={scale:e.scale,offsetX:e.offsetX,offsetY:e.offsetY,rotation:e.rotation,originalUrl:e.sourceUrl},$={shape:e.shape,style:e.borderStyle,framePreset:e.framePreset,color:e.borderColor,width:e.borderWidth};A({url:F,originalUrl:e.sourceUrl,framing:G,border:$}),R()}catch(a){alert("Failed to crop token: "+a.message)}finally{t.innerHTML=i,t.disabled=!1}},P.classList.remove("vtt-hidden"),L.classList.remove("vtt-hidden"),n()}function q(){if(document.getElementById("modal-token-cropper"))return;const B=document.createElement("div");B.innerHTML=`
        <div id="modal-token-cropper-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="z-index: 10050;"></div>
        <div id="modal-token-cropper" class="vtt-modal vtt-hidden glassmorphism" style="z-index: 10051; max-width: 680px; width: 92vw; padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1px solid var(--color-border-subtle);">
            <!-- Header -->
            <div style="padding: 14px 18px; border-bottom: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3);">
                <h3 style="margin: 0; color: var(--color-gold-base); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-crop"></i> Token Cropper & Framing Studio
                </h3>
                <button type="button" id="btn-cropper-close" style="background: none; border: none; color: var(--color-text-muted); font-size: 1.2rem; cursor: pointer;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Body: Left Canvas & Right Controls -->
            <div style="display: flex; flex-wrap: wrap; padding: 16px; gap: 16px; overflow-y: auto; max-height: calc(85vh - 120px);">
                <!-- Left: Canvas Viewport -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; min-width: 280px;">
                    <div style="position: relative; width: 360px; height: 360px; max-width: 100%; aspect-ratio: 1/1; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border-subtle); box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                        <canvas id="token-cropper-canvas" style="width: 100%; height: 100%; cursor: grab; display: block; touch-action: none;"></canvas>
                        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.75); color: #ccc; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; pointer-events: none;">
                            <i class="fa-solid fa-arrows-up-down-left-right"></i> Drag to pan \xB7 Scroll to zoom
                        </div>
                    </div>

                    <!-- Alignment Presets & Rotation -->
                    <div style="display: flex; gap: 6px; width: 100%; max-width: 360px;">
                        <button type="button" id="btn-cropper-focus-face" class="btn btn-secondary btn-xs" style="flex: 1;" title="Center character face in upper frame">
                            <i class="fa-solid fa-user"></i> Focus Face
                        </button>
                        <button type="button" id="btn-cropper-center" class="btn btn-secondary btn-xs" style="flex: 1;">
                            <i class="fa-solid fa-crosshairs"></i> Center
                        </button>
                        <button type="button" id="btn-cropper-fit" class="btn btn-secondary btn-xs" style="flex: 1;">
                            <i class="fa-solid fa-compress"></i> Fit
                        </button>
                        <button type="button" id="btn-cropper-rotate-ccw" class="btn btn-secondary btn-xs" style="padding: 4px 8px;" title="Rotate 90\xB0 Counter-Clockwise">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        <button type="button" id="btn-cropper-rotate-cw" class="btn btn-secondary btn-xs" style="padding: 4px 8px;" title="Rotate 90\xB0 Clockwise">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Right: Framing & Border Controls -->
                <div style="flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 12px;">
                    <!-- Zoom Slider -->
                    <div class="form-group" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-size: 0.8rem; font-weight: bold; margin: 0;">Zoom Level</label>
                            <span id="token-cropper-zoom-val" style="font-family: monospace; font-size: 0.8rem; color: var(--color-gold-base);">100%</span>
                        </div>
                        <input type="range" id="token-cropper-zoom" min="0.4" max="4.0" step="0.05" value="1.0" style="width: 100%; cursor: pointer;">
                    </div>

                    <!-- Border Shape -->
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block;">Token Shape</label>
                        <select id="token-cropper-shape" style="width: 100%; font-size: 0.85rem; padding: 6px 8px;">
                            <option value="circle">Circle (Standard Round)</option>
                            <option value="squircle">Squircle (Rounded Square)</option>
                            <option value="square">Square (Grid Aligned)</option>
                            <option value="hexagon">Hexagon (Tactical / Sci-Fi)</option>
                            <option value="octagon">Octagon (Fortified / Boss)</option>
                            <option value="shield">Shield (Knight / Crest)</option>
                        </select>
                    </div>

                    <!-- Border Style -->
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block;">Border Style</label>
                        <select id="token-cropper-border-style" style="width: 100%; font-size: 0.85rem; padding: 6px 8px;">
                            <option value="solid">Solid Line</option>
                            <option value="double">Double Ring</option>
                            <option value="dashed">Dashed Line</option>
                            <option value="glow">Neon Glow</option>
                            <option value="frame">Thematic Fantasy Frame</option>
                            <option value="none">Borderless</option>
                        </select>
                    </div>

                    <!-- Thematic Frame Presets (Conditional) -->
                    <div id="token-cropper-frame-preset-group" class="form-group vtt-hidden" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block; color: var(--color-gold-base);">Thematic Frame Preset</label>
                        <select id="token-cropper-frame-preset" style="width: 100%; font-size: 0.85rem; padding: 6px 8px;">
                            <option value="ornate_gold">\u2728 Ornate Gold Filigree</option>
                            <option value="silver_mithral">\u{1F6E1}\uFE0F Mithral Silver Ring</option>
                            <option value="gothic_iron">\u26D3\uFE0F Gothic Spiked Iron</option>
                            <option value="arcane_runic">\u{1F52E} Glowing Arcane Runes</option>
                            <option value="legendary_crown">\u{1F451} Legendary Boss Crown</option>
                        </select>
                    </div>

                    <!-- Border Color & Quick Swatches -->
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block;">Border Color</label>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="color" id="token-cropper-border-color" value="#007bff" style="width: 40px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; cursor: pointer; background: none; padding: 0;">
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <button type="button" class="token-cropper-swatch" data-color="#007bff" style="width: 22px; height: 22px; border-radius: 50%; background: #007bff; border: 1px solid #fff; cursor: pointer;" title="Player Blue"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#dc3545" style="width: 22px; height: 22px; border-radius: 50%; background: #dc3545; border: 1px solid #fff; cursor: pointer;" title="Hostile Red"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#eab308" style="width: 22px; height: 22px; border-radius: 50%; background: #eab308; border: 1px solid #fff; cursor: pointer;" title="Neutral Yellow"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#22c55e" style="width: 22px; height: 22px; border-radius: 50%; background: #22c55e; border: 1px solid #fff; cursor: pointer;" title="Friendly Green"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#d4af37" style="width: 22px; height: 22px; border-radius: 50%; background: #d4af37; border: 1px solid #fff; cursor: pointer;" title="Gold"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#a855f7" style="width: 22px; height: 22px; border-radius: 50%; background: #a855f7; border: 1px solid #fff; cursor: pointer;" title="Purple"></button>
                            </div>
                        </div>
                    </div>

                    <!-- Border Width Slider -->
                    <div class="form-group" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-size: 0.8rem; font-weight: bold; margin: 0;">Border Thickness</label>
                            <span id="token-cropper-border-width-val" style="font-family: monospace; font-size: 0.8rem; color: var(--color-gold-base);">3px</span>
                        </div>
                        <input type="range" id="token-cropper-border-width" min="1" max="8" step="1" value="3" style="width: 100%; cursor: pointer;">
                    </div>
                </div>
            </div>

            <!-- Footer Buttons -->
            <div style="padding: 12px 18px; border-top: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.3); display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" id="btn-cropper-cancel" class="btn btn-secondary">Cancel</button>
                <button type="button" id="btn-cropper-apply" class="btn btn-primary" style="display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-check"></i> Apply & Save Token
                </button>
            </div>
        </div>
    `,document.body.appendChild(B)}
