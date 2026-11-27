import{CONDITION_ICONS as le,getPcRollFormula as P,rollFromToken as z,showAddCustomConditionModal as ve}from"./vtt-canvas-token-rollers.js?v=mwzhxr9x";import{showApplyDamageModal as he}from"./vtt-canvas-mass-actions.js?v=mwzhxr9x";import{applyTokenLightingPreset as ge}from"../vtt-canvas-lighting.js?v=mwzhxr9x";import{escapeHtml as re,getSafeVttUrl as ye,resolveMonsterTokenUrl as ke}from"../../vtt-utils.js?v=mwzhxr9x";export function changeTokenZOrder(f,S,q={}){const{tokens:b={},renderAll:d=()=>{}}=q,c=Object.values(b);if(c.length<=1)return;const y=b[f];if(!y)return;const U=c.filter(w=>w.id!==f).map(w=>w.zIndex||0),V=U.length>0?Math.max(...U):0,H=U.length>0?Math.min(...U):0;if(S==="front")y.zIndex=V+1;else if(S==="back")y.zIndex=H-1;else if(S==="front-one"||S==="back-one"){const w=[...c].sort((p,T)=>(p.zIndex||0)-(T.zIndex||0)),L=w.findIndex(p=>p.id===f);if(S==="front-one"){if(L<w.length-1){const p=w[L+1],T=y.zIndex||0;y.zIndex=p.zIndex||0,p.zIndex=T,y.zIndex===p.zIndex&&(y.zIndex+=1)}}else if(L>0){const p=w[L-1],T=y.zIndex||0;y.zIndex=p.zIndex||0,p.zIndex=T,y.zIndex===p.zIndex&&(y.zIndex-=1)}}typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(b),d()}export function showTokenContextMenu(f,S,q,b={}){if(typeof document>"u")return;const{vtt:d=(typeof window<"u"?window.VTT:null)||{},tokens:c={},selectedTokenIds:y=new Set,campaignSettings:U={},isMobileViewport:V=()=>!1,triggerSplashForSelection:H=()=>{},getTokenDrawDimensions:w=()=>({drawW:50,drawH:50}),snapToGrid:L=(e,i)=>({x:e,y:i}),renderAll:p=()=>{},changeTokenZOrderFn:T=changeTokenZOrder,applyLightingPresetFn:de=ge,deleteMapBackgroundAsset:F=null}=b,O=document.getElementById("vtt-token-context-menu");O&&O.remove();const a=c[f];if(!a)return;let u=a.monsterData;if(!u&&a.characterId&&d.campaignState?.characters?.[a.characterId]){const e=d.campaignState.characters[a.characterId];(e.isCompanion||e.isCustomNpc||e.monsterData)&&e.monsterData&&(u=e.monsterData)}const n=document.createElement("div");n.id="vtt-token-context-menu",n.className="vtt-token-context-menu",n.style.left=`${S}px`,n.style.top=`${q}px`;const W=[{key:"str",label:"Strength"},{key:"dex",label:"Dexterity"},{key:"con",label:"Constitution"},{key:"int",label:"Intelligence"},{key:"wis",label:"Wisdom"},{key:"cha",label:"Charisma"}],Z=[{key:"acrobatics",label:"Acrobatics",ability:"dex"},{key:"animalHandling",label:"Animal Handling",ability:"wis"},{key:"arcana",label:"Arcana",ability:"int"},{key:"athletics",label:"Athletics",ability:"str"},{key:"deception",label:"Deception",ability:"cha"},{key:"history",label:"History",ability:"int"},{key:"insight",label:"Insight",ability:"wis"},{key:"intimidation",label:"Intimidation",ability:"cha"},{key:"investigation",label:"Investigation",ability:"int"},{key:"medicine",label:"Medicine",ability:"wis"},{key:"nature",label:"Nature",ability:"int"},{key:"perception",label:"Perception",ability:"wis"},{key:"performance",label:"Performance",ability:"cha"},{key:"persuasion",label:"Persuasion",ability:"cha"},{key:"religion",label:"Religion",ability:"int"},{key:"sleightOfHand",label:"Sleight of Hand",ability:"dex"},{key:"stealth",label:"Stealth",ability:"dex"},{key:"survival",label:"Survival",ability:"wis"}];let h=`
        <div class="vtt-token-menu-header">
            <i class="fa-solid fa-dice-d20"></i> ${a.name}
        </div>
        <div class="vtt-token-menu-item" id="menu-ctx-splash-art">
            <span><i class="fa-solid fa-expand item-icon"></i> Splash Art</span>
            <span style="font-size: 0.7rem; opacity: 0.7; font-family: monospace; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; margin-left: auto;">Shift+X</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-apply-damage">
            <span><i class="fa-solid fa-heart-crack item-icon"></i> Apply Damage</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-roll-init">
            <span><i class="fa-solid fa-swords item-icon"></i> Roll Initiative</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
    `;h+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-arrows-to-eye item-icon"></i> Ability Checks</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `,W.forEach(e=>{const i=u&&u[e.key]||10,t=Math.floor((i-10)/2),o=t>=0?`+${t}`:`${t}`,s=u?`<span class="modifier-badge">${o}</span>`:"";h+=`
            <div class="vtt-submenu-item menu-roll-ability" data-ability="${e.key}" data-label="${e.label}">
                <span>${e.label}</span>
                ${s}
            </div>
        `}),h+=`
                </div>
            </div>
        </div>
    `,h+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-shield-halved item-icon"></i> Saving Throws</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `,W.forEach(e=>{let i=0;if(u){const s=u[e.key]||10;i=Math.floor((s-10)/2),u.save&&u.save[e.key]!==void 0&&(i=parseInt(u.save[e.key]))}const t=i>=0?`+${i}`:`${i}`,o=u?`<span class="modifier-badge">${t}</span>`:"";h+=`
            <div class="vtt-submenu-item menu-roll-save" data-ability="${e.key}" data-label="${e.label}">
                <span>${e.label}</span>
                ${o}
            </div>
        `}),h+=`
                </div>
            </div>
        </div>
    `,h+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-wand-magic-sparkles item-icon"></i> Skill Checks</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `,Z.forEach(e=>{let i=0;if(u){const s=u[e.ability]||10;i=Math.floor((s-10)/2),u.skill&&u.skill[e.key]!==void 0&&(i=parseInt(u.skill[e.key]))}const t=i>=0?`+${i}`:`${i}`,o=u?`<span class="modifier-badge">${t}</span>`:"";h+=`
            <div class="vtt-submenu-item menu-roll-skill" data-skill="${e.key}" data-label="${e.label}">
                <span>${e.label}</span>
                ${o}
            </div>
        `}),h+=`
                </div>
            </div>
        </div>
    `;const ce=a.flightHeight||0;h+=`
        <div class="vtt-token-menu-item" style="cursor: default; display: flex; justify-content: space-between; align-items: center; padding-right: 8px;">
            <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Elevation</span>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button class="menu-btn-flight-dec" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                <input type="number" class="menu-input-flight" value="${ce}" step="5" style="width: 40px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; text-align: center; border-radius: 4px; font-size: 12px; height: 20px; padding: 0;">
                <button class="menu-btn-flight-inc" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
        </div>
    `,h+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-heart-pulse item-icon"></i> Conditions</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-condition-gallery-container">
                    <div class="vtt-condition-gallery">
    `;const fe=Object.keys(le).sort(),ue=new Set((a.conditions||[]).map(e=>e.name));fe.forEach(e=>{const i=le[e],t=ue.has(e);h+=`
            <button type="button" class="vtt-cond-tile menu-toggle-condition${t?" is-active":""}" data-cond="${e}" title="${e}">
                <i class="fa-solid ${i}"></i>
            </button>
        `}),h+=`
                    </div>
                    <div class="vtt-cond-footer-actions">
                        <button type="button" class="vtt-cond-action-btn btn-add-custom menu-add-custom-condition">
                            <i class="fa-solid fa-plus"></i> Add Custom Condition...
                        </button>
                        <button type="button" class="vtt-cond-action-btn btn-clear-all menu-clear-all-conditions">
                            <i class="fa-solid fa-trash-can"></i> Clear All Conditions
                        </button>
                    </div>
    `,a.conditions&&a.conditions.some(e=>e.isCustom)&&(h+='<div class="vtt-cond-custom-list">',a.conditions.forEach((e,i)=>{e.isCustom&&(h+=`
                    <div class="vtt-cond-custom-chip menu-toggle-custom-condition" data-custom-idx="${i}" title="Click to remove custom condition '${e.name}'">
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${e.color||"var(--color-gold-base)"}; display: inline-block;"></span>
                            <span>${e.name}</span>
                        </span>
                        <i class="fa-solid fa-xmark" style="font-size: 10px;"></i>
                    </div>
                `)}),h+="</div>"),h+=`
                </div>
            </div>
        </div>
    `;const _=a.characterId||a.sourceCharacterId,v=_&&d.campaignState?.characters?d.campaignState.characters[_]:null,k=[],j=new Set,I=(e,i,t=!1,o="")=>{if(!e||typeof e!="string")return;const s=e.trim();!s||j.has(s)||(j.add(s),k.push({url:s,idx:i,isDefault:t,label:o}))},R=e=>{if(!e)return null;if(e.tokenImg)return e.tokenImg;if(e.tokenUrl)return e.tokenUrl;if(e.imgUrl)return e.imgUrl;if(typeof window<"u"&&window.Renderer?.monster?.getTokenUrl)try{const i=window.Renderer.monster.getTokenUrl(e);if(i)return i}catch{}return e.hasToken||e.source||e.name?ke(e):d.generateArcaneToken?d.generateArcaneToken(e?.name||"Creature","monster"):null};let D=null;if(v&&(v.isCompanion||v.isCustomNpc||v.monsterData)?D=R(v.monsterData||{}):a.monsterData?D=R(a.monsterData):v&&!v.isPlayer&&v.monster&&(D=R(v.monster)),D&&I(D,-1,!0,"Default Token"),v&&v.tokenImages&&Array.isArray(v.tokenImages)&&v.tokenImages.forEach((e,i)=>{const t=typeof e=="string"?e:e?.url||"";I(t,i,!1,typeof e=="object"&&e?.name?e.name:"Gallery Token")}),a.tokenImages&&Array.isArray(a.tokenImages)&&a.tokenImages.forEach((e,i)=>{const t=typeof e=="string"?e:e?.url||"";I(t,i,!1,typeof e=="object"&&e?.name?e.name:"Token Gallery")}),v&&(v.tokenImage&&I(v.tokenImage,-2,!1,"Sheet Token"),v.avatar&&I(v.avatar,-3,!1,"Avatar"),v.avatarUrl&&I(v.avatarUrl,-4,!1,"Avatar"),v.img&&I(v.img,-5,!1,"Sheet Image")),a.img&&I(a.img,-6,!1,"Current Canvas Art"),a.url&&I(a.url,-7,!1,"Current URL"),k.length>0){let e="";k.forEach(s=>{let g=!1;v&&v.activeTokenIndex!==void 0&&v.activeTokenIndex!==null&&v.activeTokenIndex>=0?g=v.activeTokenIndex===s.idx||a.img===s.url:g=a.img===s.url;const r=(s.url||"").split("?")[0].toLowerCase().match(/\.(mp4|webm|ogg)$/i)||s.url.includes("pinimg.com/videos"),m=s.url.includes("youtube.com")||s.url.includes("youtu.be"),x=`border: 2px solid ${g?"var(--color-success-base)":"rgba(255,255,255,0.2)"};`,C=re(s.label||(s.isDefault?"Default Token":"Custom Token")),A=re(ye(s.url));r?e+=`
                    <div class="menu-token-selector-item" data-idx="${s.idx}" data-url="${A}" title="${C}" style="width: 48px; height: 48px; position: relative; border-radius: 4px; overflow: hidden; cursor: pointer; ${x} background: #000; flex-shrink: 0;">
                        <video src="${A}" autoplay muted loop playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"></video>
                        <span style="position: absolute; bottom: 1px; right: 2px; font-size: 9px; pointer-events: none; opacity: 0.85;">\u25B6</span>
                    </div>`:m?e+=`
                    <div class="menu-token-selector-item" data-idx="${s.idx}" data-url="${A}" title="${C}" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; ${x} background: #222; flex-shrink: 0;">
                        <span style="font-size: 20px; pointer-events: none;">\u{1F4FA}</span>
                    </div>`:e+=`
                    <div class="menu-token-selector-item" data-idx="${s.idx}" data-url="${A}" title="${C}" style="width: 48px; height: 48px; position: relative; border-radius: 4px; overflow: hidden; cursor: pointer; ${x} flex-shrink: 0;">
                        <img src="${A}" alt="${C}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" data-fallback-hide-parent="1">
                    </div>`});const i=a.isAssetTable||a.isCardToken;h+=`
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid ${i?"fa-table-cells-large":"fa-images"} item-icon"></i> ${i?"Side Selector":"Token Selector"}</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled" style="width: 250px; padding: 12px; cursor: default; max-height: 400px; display: flex; gap: 8px; flex-wrap: wrap;">
                        ${e}
                    </div>
                </div>
            </div>
        `,k.length>1&&(a.isCardToken&&(h+=`
                    <div class="vtt-token-menu-item" id="menu-flip-card">
                        <span><i class="fa-solid fa-repeat item-icon text-gradient-gold"></i> Flip Card</span>
                    </div>
                `),h+=`
                <div class="vtt-token-menu-item" id="menu-next-side">
                    <span><i class="fa-solid fa-forward-step item-icon"></i> Next Side</span>
                </div>
                <div class="vtt-token-menu-item" id="menu-random-side">
                    <span><i class="fa-solid fa-dice item-icon text-gradient-gold"></i> Random Side</span>
                </div>
            `)}h+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-fire item-icon" style="color: #ff9d3b;"></i> Equip Light</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu" style="min-width: 220px;">
                <div class="vtt-token-submenu-list scroll-styled">
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="torch">
                        <span>\u{1F525} Torch (20/40 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="lantern_hooded">
                        <span>\u{1F3EE} Hooded Lantern (30/60 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="lantern_bullseye">
                        <span>\u{1F526} Bullseye Lantern (60/120 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="candle">
                        <span>\u{1F56F}\uFE0F Candle (5/10 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="spell_light">
                        <span>\u2728 Light Spell (20/40 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="campfire">
                        <span>\u{1F3D5}\uFE0F Campfire (30/60 ft)</span>
                    </div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="darkvision">
                        <span>\u{1F441}\uFE0F Darkvision (60 ft)</span>
                    </div>
                    <div class="vtt-token-menu-divider"></div>
                    <div class="vtt-submenu-item menu-ctx-equip-light" data-preset="extinguish">
                        <span style="color: var(--color-danger);"><i class="fa-solid fa-ban"></i> Extinguish Light</span>
                    </div>
                </div>
            </div>
        </div>
    `,h+=`
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item" id="menu-ctx-transform">
            <span><i class="fa-solid fa-arrows-rotate item-icon"></i> Transform</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu" style="min-width: 190px;">
                <div class="vtt-token-submenu-list scroll-styled">
                    <div class="vtt-submenu-item" id="menu-flip-h">
                        <span><i class="fa-solid fa-arrows-left-right" style="width: 16px; text-align: center; margin-right: 8px;"></i> Flip Horizontally</span>
                    </div>
                    <div class="vtt-submenu-item" id="menu-flip-v">
                        <span><i class="fa-solid fa-arrows-up-down" style="width: 16px; text-align: center; margin-right: 8px;"></i> Flip Vertically</span>
                    </div>
                    <div class="vtt-submenu-item" id="menu-reset-rotation">
                        <span><i class="fa-solid fa-rotate-left" style="width: 16px; text-align: center; margin-right: 8px;"></i> Reset Rotation</span>
                    </div>
                </div>
            </div>
        </div>
    `,d.role==="GM"&&(h+=`
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item" id="menu-ctx-arrange">
                <span><i class="fa-solid fa-layer-group item-icon"></i> Arrange & Layer</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu" style="min-width: 200px;">
                    <div class="vtt-token-submenu-list scroll-styled">
                        <div class="vtt-submenu-item" id="menu-move-front">
                            <span><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 8px;"></i> Move to Front</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-move-back">
                            <span><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 8px;"></i> Move to Back</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-move-front-one">
                            <span><i class="fa-solid fa-angle-up" style="width: 16px; text-align: center; margin-right: 8px;"></i> Move Front One</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-move-back-one">
                            <span><i class="fa-solid fa-angle-down" style="width: 16px; text-align: center; margin-right: 8px;"></i> Move Back One</span>
                        </div>
                        <div class="vtt-token-menu-divider"></div>
                        <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="token">
                            <span><i class="fa-solid fa-users" style="width: 16px; text-align: center; margin-right: 8px;"></i> Token Layer</span>
                        </div>
                        <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="gm">
                            <span><i class="fa-solid fa-user-secret" style="width: 16px; text-align: center; margin-right: 8px;"></i> GM Layer</span>
                        </div>
                        <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="map">
                            <span><i class="fa-solid fa-map" style="width: 16px; text-align: center; margin-right: 8px;"></i> Map Layer</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-sync item-icon"></i> Convert</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu" style="min-width: 220px;">
                    <div class="vtt-token-submenu-list scroll-styled">
                        <div class="vtt-submenu-item" id="menu-ctx-convert-freeform">
                            <span><i class="fa-solid fa-image" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Freeform Asset</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-ctx-convert-borderless">
                            <span><i class="fa-solid fa-circle" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Borderless Token</span>
                        </div>
                        <div class="vtt-submenu-item" id="menu-ctx-convert-bordered">
                            <span><i class="fa-solid fa-ring" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Bordered Token</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="vtt-token-menu-item text-danger" id="menu-ctx-delete" style="color: var(--color-danger);">
                <span><i class="fa-solid fa-trash item-icon"></i> Delete</span>
            </div>
        `),n.innerHTML=h,document.body.appendChild(n);const B=V(),$=document.getElementById("vtt-mobile-backdrop");B&&(n.classList.add("mobile-modal-mode"),$&&$.classList.add("active"));const M=()=>{$&&($.classList.remove("active"),$.removeEventListener("click",M),$.removeEventListener("touchend",M))};B&&$&&($.addEventListener("click",M),$.addEventListener("touchend",M));const me=n.remove.bind(n);if(n.remove=function(){M(),me()},B)n.style.left="50%",n.style.top="50%",n.style.transform="translate(-50%, -50%)";else{const i=window.innerWidth,t=window.innerHeight,o=n.offsetWidth||n.getBoundingClientRect().width||200,s=n.offsetHeight||n.getBoundingClientRect().height||350,g=Math.max(160,t-24);n.style.maxHeight=`${g}px`,(n.scrollHeight>g||s>g)&&(n.style.overflowY="auto",n.style.overflowX="hidden");let l=S,r=q;S+o>i-12&&(l=Math.max(12,i-o-12)),q+s>t-12&&(r=Math.max(12,t-s-12)),l=Math.max(12,l),r=Math.max(12,r),n.style.left=`${l}px`,n.style.top=`${r}px`,n.querySelectorAll(".vtt-token-menu-item").forEach(m=>{const x=m.querySelector(".vtt-token-submenu");x&&m.addEventListener("mouseenter",()=>{const C=m.getBoundingClientRect(),A=x.offsetWidth||200,pe=x.offsetHeight||220;C.right+A>window.innerWidth-8?x.classList.add("flip-left"):x.classList.remove("flip-left"),C.top+pe>window.innerHeight-8?x.classList.add("flip-up"):x.classList.remove("flip-up")})})}const K=n.querySelector("#menu-ctx-splash-art");K&&K.addEventListener("click",()=>{H(f),n.remove()});const X=n.querySelector("#menu-apply-damage");X&&X.addEventListener("click",()=>{he([f],b),n.remove()}),n.querySelector("#menu-roll-init").addEventListener("click",e=>{let i="",t=10;if(u){t=u.dex||10;let l=Math.floor((t-10)/2);u.initiative!==void 0&&(typeof u.initiative=="number"?l=u.initiative:typeof u.initiative?.bonus=="number"&&(l=u.initiative.bonus)),i=`1d20${l>=0?"+":""}${l}`}else if(a.isPlayer&&a.characterId&&d.campaignState?.characters?.[a.characterId]){const l=d.campaignState.characters[a.characterId];if(l.isCustomNpc||l.monsterData){t=l.monsterData?.dex||10;let r=Math.floor((t-10)/2);l.monsterData?.initiative!==void 0&&(typeof l.monsterData.initiative=="number"?r=l.monsterData.initiative:typeof l.monsterData.initiative?.bonus=="number"&&(r=l.monsterData.initiative.bonus)),i=`1d20${r>=0?"+":""}${r}`}else t=l.stats?.dex||10,i=P(l,"initiative")}else{const l=typeof prompt=="function"?prompt(`Enter Initiative Modifier for ${a.name}:`,"0"):"0";if(l===null){n.remove();return}let r=parseInt(l)||0;i=`1d20${r>=0?"+":""}${r}`}let o=0;U.initDexTiebreaker!==!1&&(o=Math.round(t)/100);const s=`${a.name}: Initiative`,g=z(i,s,f,o,{vtt:d,optEvent:e});typeof window<"u"&&window.VTT?.chatEngine&&window.VTT.chatEngine.addToInitiative(a.name,g,f),n.remove()}),n.querySelectorAll(".menu-roll-ability").forEach(e=>{e.addEventListener("click",i=>{const t=e.dataset.ability,o=e.dataset.label;let s="";if(u){const l=u[t]||10;let r=Math.floor((l-10)/2);s=`1d20${r>=0?"+":""}${r}`}else if(a.isPlayer&&a.characterId&&d.campaignState?.characters?.[a.characterId]){const l=d.campaignState.characters[a.characterId];s=P(l,"ability",t)}else{const l=typeof prompt=="function"?prompt(`Enter modifier for ${o} Check:`,"0"):"0";if(l===null){n.remove();return}let r=parseInt(l)||0;s=`1d20${r>=0?"+":""}${r}`}const g=`${a.name}: ${o.toUpperCase()} Check`;z(s,g,f,0,{vtt:d,optEvent:i}),n.remove()})}),n.querySelectorAll(".menu-roll-save").forEach(e=>{e.addEventListener("click",i=>{const t=e.dataset.ability,o=e.dataset.label;let s="";if(u){const l=u[t]||10;let r=Math.floor((l-10)/2);u.save&&u.save[t]!==void 0&&(r=parseInt(u.save[t])),s=`1d20${r>=0?"+":""}${r}`}else if(a.isPlayer&&a.characterId&&d.campaignState?.characters?.[a.characterId]){const l=d.campaignState.characters[a.characterId];s=P(l,"save",t)}else{const l=typeof prompt=="function"?prompt(`Enter modifier for ${o} Save:`,"0"):"0";if(l===null){n.remove();return}let r=parseInt(l)||0;s=`1d20${r>=0?"+":""}${r}`}const g=`${a.name}: ${o.toUpperCase()} Saving Throw`;z(s,g,f,0,{vtt:d,optEvent:i}),n.remove()})}),n.querySelectorAll(".menu-roll-skill").forEach(e=>{e.addEventListener("click",i=>{const t=e.dataset.skill,o=e.dataset.label;let s="";if(u){const l=Z.find(x=>x.key===t),r=u[l.ability]||10;let m=Math.floor((r-10)/2);u.skill&&u.skill[t]!==void 0&&(m=parseInt(u.skill[t])),s=`1d20${m>=0?"+":""}${m}`}else if(a.isPlayer&&a.characterId&&d.campaignState?.characters?.[a.characterId]){const l=d.campaignState.characters[a.characterId];s=P(l,"skill",t)}else{const l=typeof prompt=="function"?prompt(`Enter modifier for ${o} Check:`,"0"):"0";if(l===null){n.remove();return}let r=parseInt(l)||0;s=`1d20${r>=0?"+":""}${r}`}const g=`${a.name}: ${o} Check`;z(s,g,f,0,{vtt:d,optEvent:i}),n.remove()})});const G=e=>{const i=c[f];i&&(i.flightHeight=e,typeof b.emitTokenUpdates=="function"?b.emitTokenUpdates(c):typeof window<"u"&&typeof window.emitTokenUpdates=="function"?window.emitTokenUpdates(c):d.socket&&d.socket.emit("tokens:update",{tokens:c}),p())},Y=n.querySelector(".menu-btn-flight-dec"),J=n.querySelector(".menu-btn-flight-inc"),E=n.querySelector(".menu-input-flight");Y&&J&&E&&(Y.addEventListener("click",e=>{e.stopPropagation();let i=parseInt(E.value)||0;i-=5,E.value=i,G(i)}),J.addEventListener("click",e=>{e.stopPropagation();let i=parseInt(E.value)||0;i+=5,E.value=i,G(i)}),E.addEventListener("change",e=>{e.stopPropagation(),G(parseInt(E.value)||0)}),E.addEventListener("click",e=>e.stopPropagation())),n.querySelectorAll(".menu-toggle-condition").forEach(e=>{e.addEventListener("click",i=>{i.stopPropagation();const t=c[f];if(!t)return;const o=e.dataset.cond;t.conditions||(t.conditions=[]);const s=t.conditions.findIndex(g=>g.name===o);s!==-1?(t.conditions.splice(s,1),e.classList.remove("is-active")):(t.conditions.push({name:o}),e.classList.add("is-active")),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p()})});const Q=n.querySelector(".menu-clear-all-conditions");Q&&Q.addEventListener("click",e=>{e.stopPropagation();const i=c[f];if(!i)return;i.conditions=[],n.querySelectorAll(".menu-toggle-condition").forEach(o=>o.classList.remove("is-active"));const t=n.querySelector(".vtt-cond-custom-list");t&&t.remove(),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p()});const ee=n.querySelector(".menu-add-custom-condition");ee&&ee.addEventListener("click",e=>{e.stopPropagation(),n.remove(),ve(f,{tokens:c,renderAll:p})}),n.querySelectorAll(".menu-toggle-custom-condition").forEach(e=>{e.addEventListener("click",i=>{i.stopPropagation();const t=c[f];if(!t||!t.conditions)return;const o=parseInt(e.dataset.customIdx);t.conditions.splice(o,1),e.remove(),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p()})}),n.querySelectorAll(".menu-token-selector-item, .menu-token-selector-img").forEach(e=>{e.addEventListener("click",i=>{i.stopPropagation();const t=e.dataset.url||e.getAttribute("data-url"),o=parseInt(e.dataset.idx||e.getAttribute("data-idx")||"-1",10),s=c[f];if(!s||!t)return;s.url=t,s.img=t;const g=t.split("?")[0].toLowerCase(),l=g.endsWith(".gif")||t.includes(".gif");s.isGif=l,s.isVideo=!l&&(!!g.match(/\.(mp4|webm|ogg)$/i)||t.includes("youtube.com")||t.includes("pinimg.com/videos"));const r=s.characterId||s.sourceCharacterId;if(r&&d.campaignState?.characters){const m=d.campaignState.characters[r];m&&(o>=0&&Array.isArray(m.tokenImages)&&o<m.tokenImages.length&&(m.activeTokenIndex=o),m.tokenSize=s.size,m.tokenSight=s.sightRange,m.tokenAuras=s.auras,m.fxOverlayEnabled=s.fxOverlayEnabled,m.fxOverlayOpacity=s.fxOverlayOpacity,m.fxOverlayColor=s.fxOverlayColor,m.fxVignetteEnabled=s.fxVignetteEnabled,m.fxVignetteOpacity=s.fxVignetteOpacity,m.fxVignetteColor=s.fxVignetteColor,m.fxShadowEnabled=s.fxShadowEnabled,m.fxShadowBlur=s.fxShadowBlur,m.fxShadowOffset=s.fxShadowOffset,m.fxShadowColor=s.fxShadowColor,m.fxShadowOpacity=s.fxShadowOpacity,m.tokenLightEnabled=s.lightEnabled,m.tokenLightBright=s.lightBright,m.tokenLightDim=s.lightDim,m.tokenLightColor=s.lightColor,d.socket&&d.socket.emit("character:update",{id:r,character:m}))}typeof window<"u"&&window.VTT?.chatEngine?.updateCombatantTokenArt?window.VTT.chatEngine.updateCombatantTokenArt(f,t,r):typeof window<"u"&&window.VTT?.chatEngine?.refreshInitiative&&window.VTT.chatEngine.refreshInitiative(),d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()})});const N=e=>{if(!k||k.length===0)return;const i=Math.max(0,Math.min(k.length-1,e)),t=k[i];if(!t||!t.url)return;const o=c[f];if(!o)return;o.url=t.url,o.img=t.url,o.activeTokenIndex=t.idx;const s=t.url.split("?")[0].toLowerCase(),g=s.endsWith(".gif")||t.url.includes(".gif");o.isGif=g,o.isVideo=!g&&(!!s.match(/\.(mp4|webm|ogg)$/i)||t.url.includes("youtube.com")||t.url.includes("pinimg.com/videos"));const l=o.characterId||o.sourceCharacterId;if(l&&d.campaignState?.characters){const r=d.campaignState.characters[l];r&&t.idx>=0&&Array.isArray(r.tokenImages)&&t.idx<r.tokenImages.length&&(r.activeTokenIndex=t.idx,d.socket&&d.socket.emit("character:update",{id:l,character:r}))}if(typeof window<"u"&&window.VTT?.chatEngine?.updateCombatantTokenArt?window.VTT.chatEngine.updateCombatantTokenArt(f,t.url,l):typeof window<"u"&&window.VTT?.chatEngine?.refreshInitiative&&window.VTT.chatEngine.refreshInitiative(),d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),typeof window<"u"&&window.VTT?.toast){const r=t.label||`Side ${i+1}`;window.VTT.toast(`Token art: ${r}`)}},te=n.querySelector("#menu-next-side");te&&te.addEventListener("click",()=>{const e=c[f];if(!e||k.length<2)return;let i=k.findIndex(o=>o.url===e.img||o.idx===e.activeTokenIndex);i<0&&(i=0);const t=(i+1)%k.length;N(t),n.remove()});const ie=n.querySelector("#menu-random-side");ie&&ie.addEventListener("click",()=>{if(!c[f]||k.length<2)return;const i=Math.floor(Math.random()*k.length);N(i),n.remove()});const ne=n.querySelector("#menu-flip-card");ne&&ne.addEventListener("click",()=>{const e=c[f];if(!e||k.length<2)return;const t=k.findIndex(o=>o.url===e.img||o.idx===e.activeTokenIndex)===0?1:0;N(t),n.remove()}),n.querySelectorAll(".menu-ctx-equip-light").forEach(e=>{e.addEventListener("click",()=>{const i=c[f];if(!i)return;const t=e.dataset.preset;t==="extinguish"?i.lightEnabled=!1:de(i,t),d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()})});const ae=n.querySelector("#menu-flip-h");ae&&ae.addEventListener("click",()=>{const e=c[f];e&&(e.flipX=!e.flipX,d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p()),n.remove()});const se=n.querySelector("#menu-flip-v");se&&se.addEventListener("click",()=>{const e=c[f];e&&(e.flipY=!e.flipY,d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p()),n.remove()});const oe=n.querySelector("#menu-reset-rotation");oe&&oe.addEventListener("click",()=>{(y.has(f)?Array.from(y):[f]).forEach(i=>{const t=c[i];t&&(t.rotation=0)}),d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()}),d.role==="GM"&&(n.querySelector("#menu-move-front").addEventListener("click",()=>{T(f,"front",b),n.remove()}),n.querySelector("#menu-move-back").addEventListener("click",()=>{T(f,"back",b),n.remove()}),n.querySelector("#menu-move-front-one").addEventListener("click",()=>{T(f,"front-one",b),n.remove()}),n.querySelector("#menu-move-back-one").addEventListener("click",()=>{T(f,"back-one",b),n.remove()}),n.querySelectorAll(".menu-ctx-move-layer").forEach(e=>{e.addEventListener("click",()=>{const i=e.dataset.layer;(y.has(f)?Array.from(y):[f]).forEach(o=>{c[o]&&(c[o].layer=i,y.delete(o),window.VTT?.chatEngine?.updateCombatantLayer&&window.VTT?.chatEngine?.updateCombatantLayer?.(o,i))}),d.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()})}),n.querySelector("#menu-ctx-convert-freeform").addEventListener("click",()=>{const{drawW:e,drawH:i}=w(a);a.isAsset=!0,a.isBorderless=!1,a.pixelWidth=e,a.pixelHeight=i,a.imgRadius="0",typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()}),n.querySelector("#menu-ctx-convert-borderless").addEventListener("click",()=>{a.isAsset=!1,a.isBorderless=!0;const e=L(a.x,a.y,!0);a.x=e.x,a.y=e.y,a.size=1,(a.assetType==="video"||a.url&&a.url.split("?")[0].toLowerCase().endsWith(".gif"))&&(a.imgRadius="50%"),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()}),n.querySelector("#menu-ctx-convert-bordered").addEventListener("click",()=>{a.isAsset=!1,a.isBorderless=!1;const e=L(a.x,a.y,!0);a.x=e.x,a.y=e.y,a.size=1,(a.assetType==="video"||a.url&&a.url.split("?")[0].toLowerCase().endsWith(".gif"))&&(a.imgRadius="50%"),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()}),n.querySelector("#menu-ctx-delete").addEventListener("click",()=>{if(typeof F=="function"&&F(f)){p(),n.remove();return}delete c[f],typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(c),p(),n.remove()}))}
