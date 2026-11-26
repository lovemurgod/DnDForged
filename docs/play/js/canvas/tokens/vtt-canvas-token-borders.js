export const TOKEN_SHAPES={circle:{id:"circle",name:"Circle",borderRadius:"50%",clipPath:null,description:"Standard round token"},squircle:{id:"squircle",name:"Rounded Square",borderRadius:"20%",clipPath:null,description:"Smooth squircle, blends tactical grid with organic token feel"},square:{id:"square",name:"Square",borderRadius:"4px",clipPath:null,description:"Grid-aligned square for objects, swarms, and tactical units"},hexagon:{id:"hexagon",name:"Hexagon",borderRadius:"0",clipPath:"polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",description:"Hexagonal silhouette for hex grids, sci-fi, and aberrations"},octagon:{id:"octagon",name:"Octagon",borderRadius:"0",clipPath:"polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",description:"Sturdy octagon for fortified foes and constructs"},shield:{id:"shield",name:"Shield",borderRadius:"0",clipPath:"polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)",description:"Heraldic crest for paladins, knights, and guardians"}},TOKEN_BORDER_STYLES={solid:{id:"solid",name:"Solid Line"},double:{id:"double",name:"Double Ring"},dashed:{id:"dashed",name:"Dashed Ring"},glow:{id:"glow",name:"Neon Glow"},frame:{id:"frame",name:"Thematic Frame"},none:{id:"none",name:"Borderless"}},THEMATIC_FRAMES={none:{id:"none",name:"None"},ornate_gold:{id:"ornate_gold",name:"Ornate Gold",description:"Classic heroic gold filigree frame with corner notches"},silver_mithral:{id:"silver_mithral",name:"Mithral Silver",description:"Lustrous beveled silver ring with inner hairline"},gothic_iron:{id:"gothic_iron",name:"Gothic Iron",description:"Heavy spiked iron band with dark rivet accents"},arcane_runic:{id:"arcane_runic",name:"Arcane Runes",description:"Luminous magical ring inscribed with eldritch runes"},legendary_crown:{id:"legendary_crown",name:"Legendary Boss",description:"Imperial spiked crown frame distinguishing major campaign bosses"}};export function traceTokenCanvasPath(o,t,i,e,f="circle"){switch(o.beginPath(),f){case"square":{const n=e*2,a=t-e,r=i-e;o.rect(a,r,n,n);break}case"squircle":{const n=e*2,a=t-e,r=i-e,l=e*.4;o.roundRect?o.roundRect(a,r,n,n,l):o.rect(a,r,n,n);break}case"hexagon":{o.moveTo(t,i-e),o.lineTo(t+e,i-e*.5),o.lineTo(t+e,i+e*.5),o.lineTo(t,i+e),o.lineTo(t-e,i+e*.5),o.lineTo(t-e,i-e*.5),o.closePath();break}case"octagon":{o.moveTo(t-e*.4,i-e),o.lineTo(t+e*.4,i-e),o.lineTo(t+e,i-e*.4),o.lineTo(t+e,i+e*.4),o.lineTo(t+e*.4,i+e),o.lineTo(t-e*.4,i+e),o.lineTo(t-e,i+e*.4),o.lineTo(t-e,i-e*.4),o.closePath();break}case"shield":{const n=t-e,a=i-e,r=e*2,l=e*2;o.moveTo(n,a),o.lineTo(n+r,a),o.lineTo(n+r,a+l*.65),o.lineTo(t,a+l),o.lineTo(n,a+l*.65),o.closePath();break}default:o.arc(t,i,e,0,Math.PI*2);break}}export function getThematicFrameSvg(o,t="#d4af37",i=100,e=100,f="default"){if(!o||o==="none")return"";const n=t||"#d4af37",a=String(f||"default").replace(/[^a-zA-Z0-9_-]/g,"_");switch(o){case"ornate_gold":return`
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="${n}" stroke-width="3.5" filter="drop-shadow(0 0 2px rgba(0,0,0,0.8))"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="${n}" stroke-width="1" stroke-opacity="0.8" stroke-dasharray="3,2"/>
                    <!-- Ornate Cardinal Notches -->
                    <circle cx="50" cy="3" r="2.5" fill="${n}"/>
                    <circle cx="50" cy="97" r="2.5" fill="${n}"/>
                    <circle cx="3" cy="50" r="2.5" fill="${n}"/>
                    <circle cx="97" cy="50" r="2.5" fill="${n}"/>
                    <!-- Diagonal accents -->
                    <rect x="48.5" y="0.5" width="3" height="3" fill="${n}" transform="rotate(45 50 2)"/>
                    <rect x="48.5" y="94.5" width="3" height="3" fill="${n}" transform="rotate(45 50 96)"/>
                    <rect x="1.5" y="48.5" width="3" height="3" fill="${n}" transform="rotate(45 3 50)"/>
                    <rect x="95.5" y="48.5" width="3" height="3" fill="${n}" transform="rotate(45 97 50)"/>
                </svg>
            `;case"silver_mithral":return`
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="silverGrad_${a}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#ffffff"/>
                            <stop offset="35%" stop-color="#c0c0c0"/>
                            <stop offset="65%" stop-color="#808080"/>
                            <stop offset="100%" stop-color="#e0e0e0"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="48" fill="none" stroke="url(#silverGrad_${a})" stroke-width="4"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.6"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#222222" stroke-width="1" stroke-opacity="0.5"/>
                </svg>
            `;case"gothic_iron":return`
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="#1f2421" stroke-width="4.5"/>
                    <circle cx="50" cy="50" r="48" fill="none" stroke="${n}" stroke-width="1.5" stroke-opacity="0.6"/>
                    <!-- Rivets / Studs -->
                    ${[0,45,90,135,180,225,270,315].map(r=>{const l=r*Math.PI/180,c=50+47.5*Math.cos(l),s=50+47.5*Math.sin(l);return`<circle cx="${c.toFixed(1)}" cy="${s.toFixed(1)}" r="1.8" fill="#e0e0e0" stroke="#000" stroke-width="0.5"/>`}).join("")}
                </svg>
            `;case"arcane_runic":return`
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="${n}" stroke-width="2.5" filter="drop-shadow(0 0 3px ${n})"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="${n}" stroke-width="1" stroke-opacity="0.7"/>
                    <!-- Arcane Glyphs / Runes along ring -->
                    ${[15,45,75,105,135,165,195,225,255,285,315,345].map(r=>{const l=r*Math.PI/180,c=50+46*Math.cos(l),s=50+46*Math.sin(l);return`<polygon points="${c},${s-1.5} ${c+1.5},${s+1.5} ${c-1.5},${s+1.5}" fill="${n}" opacity="0.85"/>`}).join("")}
                </svg>
            `;case"legendary_crown":return`
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="47.5" fill="none" stroke="${n}" stroke-width="3" filter="drop-shadow(0 0 4px ${n})"/>
                    <circle cx="50" cy="50" r="43.5" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-opacity="0.9"/>
                    <!-- Imperial 4-Corner Crown Spikes -->
                    <polygon points="50,0 54,6 46,6" fill="${n}" stroke="#000" stroke-width="0.5"/>
                    <polygon points="50,100 54,94 46,94" fill="${n}" stroke="#000" stroke-width="0.5"/>
                    <polygon points="0,50 6,54 6,46" fill="${n}" stroke="#000" stroke-width="0.5"/>
                    <polygon points="100,50 94,54 94,46" fill="${n}" stroke="#000" stroke-width="0.5"/>
                    <!-- Diagonal Crown Gems -->
                    <circle cx="17" cy="17" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                    <circle cx="83" cy="17" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                    <circle cx="17" cy="83" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                    <circle cx="83" cy="83" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                </svg>
            `;default:return""}}export function isAnimatedMedia(o="",t=""){const i=`${o||""} ${t||""}`.toLowerCase().split("?")[0].trim();return i.endsWith(".gif")||i.includes(".gif")||i.endsWith(".mp4")||i.endsWith(".webm")||i.endsWith(".ogg")||i.endsWith(".m4v")||i.endsWith(".mov")||i.includes(".mp4")||i.includes(".webm")||i.includes(".ogg")||i.includes(".m4v")||i.includes(".mov")||i.includes("youtube.com")||i.includes("youtu.be")}export function getShapeBorderSvg(o="circle",t="solid",i="#007bff",e=3,f=100,n=100,a="default"){if(!t||t==="none")return"";const r=i||"#007bff",l=Math.max(1,e||2),c=100/Math.max(f,1),s=Math.max(.75,l*c).toFixed(2);let d="";t==="dashed"&&(d='stroke-dasharray="6,4"');let p="";t==="glow"&&(p=`filter="drop-shadow(0 0 3px ${r})"`);let g="",m="";switch(o){case"hexagon":if(g=`<polygon points="50,1 99,25.5 99,74.5 50,99 1,74.5 1,25.5" fill="none" stroke="${r}" stroke-width="${s}" stroke-linejoin="round" ${d} ${p}/>`,t==="double"){const h=Math.max(.6,s*.5);m=`<polygon points="50,6 94,28 94,72 50,94 6,72 6,28" fill="none" stroke="${r}" stroke-width="${h}" stroke-linejoin="round"/>`}break;case"octagon":if(g=`<polygon points="30,1 70,1 99,30 99,70 70,99 30,99 1,70 1,30" fill="none" stroke="${r}" stroke-width="${s}" stroke-linejoin="round" ${d} ${p}/>`,t==="double"){const h=Math.max(.6,s*.5);m=`<polygon points="31,6 69,6 94,31 94,69 69,94 31,94 6,69 6,31" fill="none" stroke="${r}" stroke-width="${h}" stroke-linejoin="round"/>`}break;case"shield":if(g=`<polygon points="1,1 99,1 99,65 50,99 1,65" fill="none" stroke="${r}" stroke-width="${s}" stroke-linejoin="round" ${d} ${p}/>`,t==="double"){const h=Math.max(.6,s*.5);m=`<polygon points="6,6 94,6 94,63 50,94 6,63" fill="none" stroke="${r}" stroke-width="${h}" stroke-linejoin="round"/>`}break;case"squircle":if(g=`<rect x="1" y="1" width="98" height="98" rx="20" ry="20" fill="none" stroke="${r}" stroke-width="${s}" ${d} ${p}/>`,t==="double"){const h=Math.max(.6,s*.5);m=`<rect x="6" y="6" width="88" height="88" rx="16" ry="16" fill="none" stroke="${r}" stroke-width="${h}"/>`}break;case"square":if(g=`<rect x="1" y="1" width="98" height="98" rx="4" ry="4" fill="none" stroke="${r}" stroke-width="${s}" ${d} ${p}/>`,t==="double"){const h=Math.max(.6,s*.5);m=`<rect x="6" y="6" width="88" height="88" rx="2" ry="2" fill="none" stroke="${r}" stroke-width="${h}"/>`}break;default:{if(g=`<circle cx="50" cy="50" r="${Math.max(1,50-s/2).toFixed(2)}" fill="none" stroke="${r}" stroke-width="${s}" ${d} ${p}/>`,t==="double"){const k=Math.max(.6,s*.5);m=`<circle cx="50" cy="50" r="${Math.max(1,50-s-2).toFixed(2)}" fill="none" stroke="${r}" stroke-width="${k}"/>`}break}}return`
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
            ${g}
            ${m}
        </svg>
    `}export function promptAnimatedMediaChoice(o={}){const{url:t="",fileName:i="",onDirect:e=()=>{},onCrop:f=()=>{},onCancel:n=()=>{}}=o;if(typeof document>"u")return e();const a=document.getElementById("modal-animated-media-prompt-overlay");a&&a.remove();const r=t.match(/\.(mp4|webm|ogg|m4v|mov)$/i)||i.match(/\.(mp4|webm|ogg|m4v|mov)$/i),l=document.createElement("div");l.id="modal-animated-media-prompt-overlay",l.className="vtt-sheet-submodal-overlay vtt-sheet-submodal-high",l.style.cssText="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); z-index:10050; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);";const c=document.createElement("div");c.className="login-card glassmorphism animated-fade-in",c.style.cssText="max-width:420px; width:90%; background:var(--color-bg-secondary, #1a1d24); border:1px solid var(--color-gold-base, #d4af37); border-radius:8px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.8); text-align:center;";const s=r?`<video src="${t}" autoplay loop muted playsinline style="max-width:140px; max-height:140px; border-radius:8px; border:2px solid var(--color-border-subtle, #333); margin:0 auto 12px; display:block; object-fit:cover;"></video>`:`<img src="${t}" style="max-width:140px; max-height:140px; border-radius:8px; border:2px solid var(--color-border-subtle, #333); margin:0 auto 12px; display:block; object-fit:cover;">`;c.innerHTML=`
        <div style="font-size:1.6rem; color:var(--color-gold-base, #d4af37); margin-bottom:8px;">
            <i class="fa-solid fa-film"></i>
        </div>
        <h3 style="margin:0 0 8px 0; font-size:1.15rem; color:var(--color-text-primary, #fff); font-family:var(--font-heading, serif);">
            Animated Media Detected
        </h3>
        <p style="font-size:0.82rem; color:var(--color-text-secondary, #94a3b8); margin:0 0 14px 0; line-height:1.4;">
            This file contains animation. Would you like to keep it playing live on the tabletop, or crop a static frame?
        </p>
        ${s}
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:14px;">
            <button id="btn-animated-direct" class="btn btn-primary" style="padding:8px 12px; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-play"></i> Keep Animated (Direct)
            </button>
            <button id="btn-animated-crop" class="btn btn-secondary" style="padding:8px 12px; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-crop"></i> Crop into Static Token
            </button>
            <button id="btn-animated-cancel" class="btn btn-ghost" style="padding:4px 8px; font-size:0.8rem; color:var(--color-text-muted, #888); margin-top:4px;">
                Cancel
            </button>
        </div>
    `,l.appendChild(c),document.body.appendChild(l);const d=()=>{l.remove()};c.querySelector("#btn-animated-direct").onclick=()=>{d(),e()},c.querySelector("#btn-animated-crop").onclick=()=>{d(),f()},c.querySelector("#btn-animated-cancel").onclick=()=>{d(),n()},l.onclick=p=>{p.target===l&&(d(),n())}}
