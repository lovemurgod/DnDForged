export const DAMAGE_TYPE_COLORS={fire:"#f97316",cold:"#38bdf8",ice:"#38bdf8",lightning:"#facc15",electric:"#facc15",thunder:"#7dd3fc",acid:"#a3e635",poison:"#4ade80",radiant:"#fef08a",necrotic:"#c084fc",force:"#e879f9",psychic:"#f472b6",slashing:"#ef4444",piercing:"#f87171",bludgeoning:"#fb7185"};export function generateDamageTypeSVG(k,g=25,p={}){const a=(k||"untyped").trim().toLowerCase(),d=Math.max(70,Math.round(g*2.8)),t=d/2,i=g*1.05;let $="";if(a.includes("heal")){let o="";for(let e=0;e<8;e++){const l=e*Math.PI/4,c=i*(.35+e%3*.25),s=(t+Math.cos(l)*c).toFixed(1),n=(t+Math.sin(l)*(c*.7)-e%2*8).toFixed(1),f=(2.8-e%2*.8).toFixed(1),r=(f*.55).toFixed(1);o+=`
                <circle cx="${s}" cy="${n}" r="${f}" fill="#16a34a" class="vtt-sparkle-float"/>
                <circle cx="${s}" cy="${n}" r="${r}" fill="#ffffff" class="vtt-sparkle-float"/>
            `}$=`
            <defs>
                <radialGradient id="grad_heal_${d}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                    <stop offset="35%" stop-color="#86efac" stop-opacity="0.85"/>
                    <stop offset="70%" stop-color="#22c55e" stop-opacity="0.45"/>
                    <stop offset="100%" stop-color="#15803d" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" fill="url(#grad_heal_${d})" class="vtt-fx-bloom"/>
            ${o}
        `}else if(a.includes("temphp")||a.includes("temp_hp")){let o="";for(let e=0;e<4;e++){const l=e*Math.PI/2+Math.PI/4,c=(t+Math.cos(l)*(i*1.05)).toFixed(1),s=(t+Math.sin(l)*(i*1.05)).toFixed(1);o+=`
                <circle cx="${c}" cy="${s}" r="4.2" fill="#0284c7"/>
                <circle cx="${c}" cy="${s}" r="2.2" fill="#ffffff"/>
            `}$=`
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" stroke="#0284c7" stroke-width="4.5" fill="none" class="vtt-fx-expand"/>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" stroke="#38bdf8" stroke-width="2.5" fill="none" class="vtt-fx-expand"/>
            <circle cx="${t}" cy="${t}" r="${(i*.82).toFixed(1)}" stroke="#ffffff" stroke-width="1.8" fill="none" opacity="0.9"/>
            ${o}
        `}else if(a.includes("fire")){let o="";for(let e=0;e<8;e++){const l=e*1.618*Math.PI*2%(Math.PI*2),c=i*(.35+e%4*.2),s=(t+Math.cos(l)*c).toFixed(1),n=(t+Math.sin(l)*(c*.6)-e%3*6).toFixed(1),f=(3.2-e%2*.8).toFixed(1),r=(f*.55).toFixed(1);o+=`
                <circle cx="${s}" cy="${n}" r="${f}" fill="#ea580c" class="vtt-ember-rise"/>
                <circle cx="${s}" cy="${n}" r="${r}" fill="#ffffff" class="vtt-ember-rise"/>
            `}$=`
            <defs>
                <radialGradient id="grad_fire_${d}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="25%" stop-color="#fff5b4" stop-opacity="0.95"/>
                    <stop offset="55%" stop-color="#f97316" stop-opacity="0.8"/>
                    <stop offset="85%" stop-color="#dc2626" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#991b1b" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" fill="url(#grad_fire_${d})" class="vtt-fx-bloom"/>
            ${o}
        `}else if(a.includes("cold")||a.includes("ice")){let o="";for(let e=0;e<6;e++){const l=e*Math.PI/3,c=i*1.15,s=t+Math.cos(l)*c,n=t+Math.sin(l)*c,f=t+Math.cos(l)*(c*.55),r=t+Math.sin(l)*(c*.55),x=l+Math.PI/4,h=l-Math.PI/4,y=c*.25;o+=`
                <line x1="${t}" y1="${t}" x2="${s.toFixed(1)}" y2="${n.toFixed(1)}" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round"/>
                <line x1="${t}" y1="${t}" x2="${s.toFixed(1)}" y2="${n.toFixed(1)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                <line x1="${f.toFixed(1)}" y1="${r.toFixed(1)}" x2="${(f+Math.cos(x)*y).toFixed(1)}" y2="${(r+Math.sin(x)*y).toFixed(1)}" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
                <line x1="${f.toFixed(1)}" y1="${r.toFixed(1)}" x2="${(f+Math.cos(x)*y).toFixed(1)}" y2="${(r+Math.sin(x)*y).toFixed(1)}" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="${f.toFixed(1)}" y1="${r.toFixed(1)}" x2="${(f+Math.cos(h)*y).toFixed(1)}" y2="${(r+Math.sin(h)*y).toFixed(1)}" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
                <line x1="${f.toFixed(1)}" y1="${r.toFixed(1)}" x2="${(f+Math.cos(h)*y).toFixed(1)}" y2="${(r+Math.sin(h)*y).toFixed(1)}" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
                <rect x="${(s-3).toFixed(1)}" y="${(n-3).toFixed(1)}" width="6" height="6" fill="#0284c7" transform="rotate(45, ${s.toFixed(1)}, ${n.toFixed(1)})"/>
                <rect x="${(s-1.5).toFixed(1)}" y="${(n-1.5).toFixed(1)}" width="3" height="3" fill="#ffffff" transform="rotate(45, ${s.toFixed(1)}, ${n.toFixed(1)})"/>
            `}$=`
            <defs>
                <radialGradient id="grad_cold_${d}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="40%" stop-color="#67e8f9" stop-opacity="0.85"/>
                    <stop offset="80%" stop-color="#0284c7" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#0369a1" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" fill="url(#grad_cold_${d})" class="vtt-fx-bloom"/>
            ${o}
        `}else if(a.includes("lightning")||a.includes("electric")){let o="";for(let e=0;e<3;e++){const l=e*Math.PI*2/3+.35;let c=`${t},${t}`;const s=5;for(let n=1;n<=s;n++){const f=i*1.25*(n/s),r=((n%2===0?1:-1)*9).toFixed(1),x=(t+Math.cos(l)*f-Math.sin(l)*r).toFixed(1),h=(t+Math.sin(l)*f+Math.cos(l)*r).toFixed(1);c+=` ${x},${h}`}o+=`
                <polyline points="${c}" stroke="#ca8a04" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="bevel" fill="none" pathLength="100" class="vtt-lightning-bolt" opacity="0.7"/>
                <polyline points="${c}" stroke="#facc15" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="bevel" fill="none" pathLength="100" class="vtt-lightning-bolt"/>
                <polyline points="${c}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="bevel" fill="none" pathLength="100" class="vtt-lightning-bolt"/>
            `}$=`
            <circle cx="${t}" cy="${t}" r="${(i*.85).toFixed(1)}" fill="#fef08a" opacity="0.45" class="vtt-fx-bloom"/>
            ${o}
        `}else if(a.includes("thunder")){let o="";for(let e=0;e<8;e++){const l=e*Math.PI/4,c=i*.55,s=i*1.15,n=(t+Math.cos(l)*c).toFixed(1),f=(t+Math.sin(l)*c).toFixed(1),r=(t+Math.cos(l)*s).toFixed(1),x=(t+Math.sin(l)*s).toFixed(1);o+=`
                <line x1="${n}" y1="${f}" x2="${r}" y2="${x}" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round"/>
                <line x1="${n}" y1="${f}" x2="${r}" y2="${x}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
            `}$=`
            <circle cx="${t}" cy="${t}" r="${(i*.65).toFixed(1)}" stroke="#0284c7" stroke-width="4.5" fill="none" opacity="0.9" class="vtt-fx-expand"/>
            <circle cx="${t}" cy="${t}" r="${(i*.65).toFixed(1)}" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.95" class="vtt-fx-expand"/>
            <circle cx="${t}" cy="${t}" r="${(i*.95).toFixed(1)}" stroke="#0284c7" stroke-width="3.5" fill="none" opacity="0.8" class="vtt-fx-expand"/>
            <circle cx="${t}" cy="${t}" r="${(i*.95).toFixed(1)}" stroke="#bae6fd" stroke-width="1.8" fill="none" opacity="0.85" class="vtt-fx-expand"/>
            <circle cx="${t}" cy="${t}" r="${(i*1.25).toFixed(1)}" stroke="#38bdf8" stroke-width="2.2" fill="none" opacity="0.6" class="vtt-fx-expand"/>
            ${o}
        `}else if(a.includes("acid")){let o="";for(let e=0;e<7;e++){const l=e*.9*Math.PI,c=i*.7*(e%4/4+.25),s=(t+Math.cos(l)*c).toFixed(1),n=(t+Math.sin(l)*c+e%2*5).toFixed(1),f=(3.5-e%2*.8).toFixed(1),r=(f*.45).toFixed(1);o+=`
                <circle cx="${s}" cy="${n}" r="${f}" fill="#65a30d" stroke="#a3e635" stroke-width="1.5" class="vtt-bubble-pop"/>
                <circle cx="${(parseFloat(s)-.7).toFixed(1)}" cy="${(parseFloat(n)-.7).toFixed(1)}" r="${r}" fill="#ffffff" class="vtt-bubble-pop"/>
            `}$=`
            <defs>
                <radialGradient id="grad_acid_${d}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="30%" stop-color="#d9f99d" stop-opacity="0.9"/>
                    <stop offset="65%" stop-color="#84cc16" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="#4d7c0f" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" fill="url(#grad_acid_${d})" class="vtt-fx-bloom"/>
            ${o}
        `}else if(a.includes("poison")){let o="";for(let e=0;e<5;e++){const l=e*Math.PI*2/5,c=i*.45,s=(t+Math.cos(l)*c).toFixed(1),n=(t+Math.sin(l)*c).toFixed(1),f=(i*.65).toFixed(1),r=(i*.38).toFixed(1);o+=`
                <circle cx="${s}" cy="${n}" r="${f}" fill="rgba(22, 101, 52, 0.45)" stroke="#15803d" stroke-width="2" class="vtt-fx-expand"/>
                <circle cx="${s}" cy="${n}" r="${r}" fill="rgba(74, 222, 128, 0.55)" stroke="#86efac" stroke-width="1" class="vtt-fx-expand"/>
            `}$=o}else if(a.includes("radiant")){const o=i*1.45,e=o*.55;$=`
            <defs>
                <radialGradient id="grad_radiant_${d}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="30%" stop-color="#fef08a" stop-opacity="0.85"/>
                    <stop offset="70%" stop-color="#eab308" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#ca8a04" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${(i*1.15).toFixed(1)}" fill="url(#grad_radiant_${d})" class="vtt-fx-bloom"/>
            <polygon points="${t},${(t-o).toFixed(1)} ${(t+5.5).toFixed(1)},${t} ${t},${(t+o).toFixed(1)} ${(t-5.5).toFixed(1)},${t}" fill="#ca8a04" class="vtt-star-flare"/>
            <polygon points="${t},${(t-o*.9).toFixed(1)} ${(t+3.2).toFixed(1)},${t} ${t},${(t+o*.9).toFixed(1)} ${(t-3.2).toFixed(1)},${t}" fill="#ffffff" class="vtt-star-flare"/>
            <polygon points="${(t-o).toFixed(1)},${t} ${t},${(t-5.5).toFixed(1)} ${(t+o).toFixed(1)},${t} ${t},${(t+5.5).toFixed(1)}" fill="#ca8a04" class="vtt-star-flare"/>
            <polygon points="${(t-o*.9).toFixed(1)},${t} ${t},${(t-3.2).toFixed(1)} ${(t+o*.9).toFixed(1)},${t} ${t},${(t+3.2).toFixed(1)}" fill="#ffffff" class="vtt-star-flare"/>
            <line x1="${(t-e).toFixed(1)}" y1="${(t-e).toFixed(1)}" x2="${(t+e).toFixed(1)}" y2="${(t+e).toFixed(1)}" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/>
            <line x1="${(t-e).toFixed(1)}" y1="${(t-e).toFixed(1)}" x2="${(t+e).toFixed(1)}" y2="${(t+e).toFixed(1)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            <line x1="${(t-e).toFixed(1)}" y1="${(t+e).toFixed(1)}" x2="${(t+e).toFixed(1)}" y2="${(t-e).toFixed(1)}" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/>
            <line x1="${(t-e).toFixed(1)}" y1="${(t+e).toFixed(1)}" x2="${(t+e).toFixed(1)}" y2="${(t-e).toFixed(1)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        `}else if(a.includes("necrotic")){let o="";for(let e=0;e<5;e++){const l=e*Math.PI*2/5,c=(t+Math.cos(l)*(i*.5)+(e%2===0?8:-8)).toFixed(1),s=(t+Math.sin(l)*(i*.5)+(e%2===0?-8:8)).toFixed(1),n=(t+Math.cos(l)*(i*1.3)).toFixed(1),f=(t+Math.sin(l)*(i*1.3)).toFixed(1);o+=`
                <path d="M ${t} ${t} Q ${c} ${s} ${n} ${f}" stroke="#3b0764" stroke-width="5" stroke-linecap="round" fill="none"/>
                <path d="M ${t} ${t} Q ${c} ${s} ${n} ${f}" stroke="#c084fc" stroke-width="3" stroke-linecap="round" fill="none"/>
                <path d="M ${t} ${t} Q ${c} ${s} ${n} ${f}" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>
            `}$=`
            <defs>
                <radialGradient id="grad_necrotic_${d}">
                    <stop offset="0%" stop-color="#0f0a19" stop-opacity="0.95"/>
                    <stop offset="40%" stop-color="#581c87" stop-opacity="0.85"/>
                    <stop offset="80%" stop-color="#9333ea" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#3b0764" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" fill="url(#grad_necrotic_${d})" class="vtt-fx-bloom"/>
            ${o}
        `}else if(a.includes("force")){let o="";for(let e=0;e<6;e++){const l=e*Math.PI/3,c=(t+Math.cos(l)*i).toFixed(1),s=(t+Math.sin(l)*i).toFixed(1);o+=`
                <circle cx="${c}" cy="${s}" r="4" fill="#a21caf"/>
                <circle cx="${c}" cy="${s}" r="2" fill="#ffffff"/>
            `}$=`
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" stroke="#701a75" stroke-width="5.5" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" stroke="#e879f9" stroke-width="3.5" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${t}" cy="${t}" r="${i.toFixed(1)}" stroke="#ffffff" stroke-width="1.6" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${t}" cy="${t}" r="${(i*.65).toFixed(1)}" stroke="#ffffff" stroke-width="1.8" fill="none" opacity="0.85"/>
            ${o}
        `}else if(a.includes("psychic")){let o="";for(let e=0;e<2;e++){const l=i*(.65+e*.45);let c="";const s=24;for(let n=0;n<=s;n++){const f=n/s*Math.PI*2,r=Math.sin(f*6+e*2)*5,x=l+r,h=(t+Math.cos(f)*x).toFixed(1),y=(t+Math.sin(f)*x).toFixed(1);c+=n===0?`M ${h} ${y}`:` L ${h} ${y}`}c+=" Z",o+=`
                <path d="${c}" stroke="#831843" stroke-width="4.5" fill="none" opacity="${e===0?.95:.75}" class="vtt-fx-expand"/>
                <path d="${c}" stroke="#f472b6" stroke-width="2.8" fill="none" opacity="${e===0?.95:.75}" class="vtt-fx-expand"/>
                <path d="${c}" stroke="#ffffff" stroke-width="1.2" fill="none" opacity="${e===0?1:.85}" class="vtt-fx-expand"/>
            `}$=o}else if(a.includes("slashing")){const o=(t-i*.95).toFixed(1),e=(t-i*.85).toFixed(1),l=(t+i*.95).toFixed(1),c=(t+i*.85).toFixed(1),s=(t+i*.25).toFixed(1),n=(t-i*.25).toFixed(1);$=`
            <path d="M ${o} ${e} Q ${s} ${n} ${l} ${c}" stroke="rgba(220, 38, 38, 0.75)" stroke-width="8" stroke-linecap="round" fill="none" pathLength="100" class="vtt-slash-trail"/>
            <path d="M ${o} ${e} Q ${s} ${n} ${l} ${c}" stroke="#dc2626" stroke-width="5" stroke-linecap="round" fill="none" pathLength="100" class="vtt-slash-cut"/>
            <path d="M ${o} ${e} Q ${s} ${n} ${l} ${c}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" fill="none" pathLength="100" class="vtt-slash-cut"/>
        `}else if(a.includes("piercing")){const o=(t-i*.9).toFixed(1),e=(t-i*.9).toFixed(1);$=`
            <line x1="${o}" y1="${e}" x2="${t}" y2="${t}" stroke="#b91c1c" stroke-width="5" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${o}" y1="${e}" x2="${t}" y2="${t}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <circle cx="${t}" cy="${t}" r="6" fill="#b91c1c"/>
            <circle cx="${t}" cy="${t}" r="3" fill="#ffffff"/>
            <path d="M ${(t-i*.6).toFixed(1)} ${(t+i*.2).toFixed(1)} Q ${t} ${(t+i*.8).toFixed(1)} ${(t+i*.6).toFixed(1)} ${(t+i*.2).toFixed(1)}" stroke="#ef4444" stroke-width="3" fill="none" stroke-linecap="round" class="vtt-fx-expand"/>
            <path d="M ${(t-i*.6).toFixed(1)} ${(t+i*.2).toFixed(1)} Q ${t} ${(t+i*.8).toFixed(1)} ${(t+i*.6).toFixed(1)} ${(t+i*.2).toFixed(1)}" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round" class="vtt-fx-expand"/>
        `}else if(a.includes("bludgeoning")){let o="";for(let e=0;e<6;e++){const l=e*Math.PI/3+.25,c=i*.85,s=(t+Math.cos(l)*c).toFixed(1),n=(t+Math.sin(l)*c).toFixed(1);o+=`
                <circle cx="${s}" cy="${n}" r="3.5" fill="#475569"/>
                <circle cx="${s}" cy="${n}" r="1.8" fill="${e%2===0?"#ffffff":"#94a3b8"}"/>
            `}$=`
            <circle cx="${t}" cy="${t}" r="${(i*.95).toFixed(1)}" stroke="#9f1239" stroke-width="6" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${t}" cy="${t}" r="${(i*.95).toFixed(1)}" stroke="#fb7185" stroke-width="3.5" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${t}" cy="${t}" r="${(i*.95).toFixed(1)}" stroke="#ffffff" stroke-width="1.8" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            ${o}
        `}else{const o=i*.7;$=`
            <defs>
                <radialGradient id="grad_untyped_${d}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                    <stop offset="35%" stop-color="#ef4444" stop-opacity="0.8"/>
                    <stop offset="100%" stop-color="#b91c1c" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${t}" cy="${t}" r="${(i*.9).toFixed(1)}" fill="url(#grad_untyped_${d})" class="vtt-fx-bloom"/>
            <line x1="${(t-o).toFixed(1)}" y1="${(t-o).toFixed(1)}" x2="${(t+o).toFixed(1)}" y2="${(t+o).toFixed(1)}" stroke="#991b1b" stroke-width="5" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${(t-o).toFixed(1)}" y1="${(t-o).toFixed(1)}" x2="${(t+o).toFixed(1)}" y2="${(t+o).toFixed(1)}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${(t+o).toFixed(1)}" y1="${(t-o).toFixed(1)}" x2="${(t-o).toFixed(1)}" y2="${(t+o).toFixed(1)}" stroke="#991b1b" stroke-width="5" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${(t+o).toFixed(1)}" y1="${(t-o).toFixed(1)}" x2="${(t-o).toFixed(1)}" y2="${(t+o).toFixed(1)}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
        `}let F="";if(a.includes("slashing")||a.includes("piercing")||a==="untyped"||a.includes("physical")){const o=p.angle!==void 0?p.angle:(Math.random()*70-35).toFixed(1),e=p.flipX!==void 0?p.flipX:Math.random()>.5;F=`transform="rotate(${o} ${t} ${t})${e?` translate(${d}, 0) scale(-1, 1)`:""}"`}else F=`transform="rotate(${p.angle!==void 0?p.angle:(Math.random()*360).toFixed(1)} ${t} ${t})"`;return`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}" width="${d}" height="${d}" class="vtt-procedural-vector-fx ${a}">
            <g ${F}>
                ${$}
            </g>
        </svg>
    `.trim()}export const MAX_CONCURRENT_PROCEDURAL_FX=6;let u=0;const b=[];export function getActiveProceduralFxCount(){return u}export function resetProceduralFxQueue(){u=0,b.length=0}function M(){for(;u<MAX_CONCURRENT_PROCEDURAL_FX&&b.length>0;){const k=b.shift();k&&k()}}export function spawnProceduralCombatFX(k,g,p,a,d={},t=!1,i=!1){if(typeof document>"u")return;const $=document.getElementById("vtt-html-overlays")||document.getElementById("canvas-container")||document.body;if(!$)return;let F=k,v=g;const o=d&&d.tokenId;if(o){const s=document.getElementById("asset_node_"+o),n=document.getElementById("token_ui_"+o);if(s&&s.style.left){const f=parseFloat(s.style.left),r=parseFloat(s.style.top),x=parseFloat(s.style.width)||(p||25)*2,h=parseFloat(s.style.height)||(p||25)*2;!isNaN(f)&&!isNaN(r)&&(F=f+x/2,v=r+h/2)}else if(n){const f=parseFloat(n.style.width)||(p||25)*2,r=parseFloat(n.style.height)||(p||25)*2,x=n.style.transform&&n.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);x&&(F=parseFloat(x[1])+f/2,v=parseFloat(x[2])+r/2)}}const e=Array.isArray(a)&&a.length>0?a:["untyped"],l=(e[0]?String(e[0]):"untyped").trim().toLowerCase();let c="untyped";if(t||l.includes("heal"))c="heal";else if(i||l.includes("temphp")||l.includes("temp_hp"))c="temphp";else{const s=["fire","cold","ice","lightning","electric","thunder","acid","poison","radiant","necrotic","force","psychic","slashing","piercing","bludgeoning"];for(const n of s)if(l.includes(n)){c=n;break}}try{const s=document.createElement("div");s.className=`vtt-procedural-fx-container ${c}`,s.style.left=`${F}px`,s.style.top=`${v}px`,s.innerHTML=generateDamageTypeSVG(c,p||25,d);let n=!1;const f=()=>{n||(n=!0,u=Math.max(0,u-1),typeof s.remove=="function"?s.remove():s.parentNode&&typeof s.parentNode.removeChild=="function"&&s.parentNode.removeChild(s),M())};s.onanimationend=f,setTimeout(f,700);const r=()=>{u++,$.appendChild(s)};u>=MAX_CONCURRENT_PROCEDURAL_FX?(b.push(r),setTimeout(M,60)):r()}catch(s){console.warn("[VTT] Error mounting procedural vector FX node:",s)}}
