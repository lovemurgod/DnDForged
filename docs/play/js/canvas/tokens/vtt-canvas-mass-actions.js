import{CONDITION_ICONS as le,getPcRollFormula as ie,getTokenSaveMod as re,rollSavingThrowToken as de,postSaveResolutionChatCard as ce,rollFromToken as se,showAddCustomConditionModal as fe}from"./vtt-canvas-token-rollers.js?v=mx0ag5ip";export function _hasResistanceType(e,y,u={}){if(!e||!y)return!1;let s=e;if(typeof s=="string"?s=s.split(",").map(m=>m.trim()).filter(Boolean):!Array.isArray(s)&&typeof s=="object"&&(s=[s]),!Array.isArray(s))return!1;const i=y.toLowerCase().trim(),t=!!(u.isMagic||u.isSpell),c=!!u.isSilvered,v=!!u.isAdamantine;return s.some(m=>{if(!m)return!1;if(typeof m=="string")return m.toLowerCase().trim()===i;if(typeof m=="object"&&Array.isArray(m.types)){if(!m.types.some(o=>String(o).toLowerCase().trim()===i))return!1;const a=Array.isArray(m.bypasses)?m.bypasses:[];return!(a.length>0&&(a.includes("magic")&&t||a.includes("silver")&&c||a.includes("adamantine")&&v))}const r=m.resist||m.immune||m.vulnerable;if(typeof m=="object"&&r){const p=(m.note||m.special||"").toLowerCase(),a=[];return(p.includes("nonmagical")||p.includes("non-magical"))&&a.push("magic"),p.includes("silver")&&a.push("silver"),p.includes("adamant")&&a.push("adamantine"),a.length>0&&(a.includes("magic")&&t||a.includes("silver")&&c||a.includes("adamantine")&&v)?!1:_hasResistanceType(r,y,u)}return!1})}export function syncTokensHpToCharacters(e,y={}){const{vtt:u=(typeof window<"u"?window.VTT:null)||{},tokens:s={}}=y;if(!e||e.length===0||!u.campaignState?.characters)return;const i=new Set;e.forEach(t=>{if(!t||t.isGeneric===!0)return;const c=t.characterId||t.sourceCharacterId;if(!c)return;const v=u.campaignState.characters[c];if(!v||v.isGeneric===!0)return;let m=!1;t.hp!==void 0&&v.hpCurrent!==t.hp&&(v.hpCurrent=t.hp,m=!0),t.maxHp!==void 0&&v.hpMax!==t.maxHp&&(v.hpMax=t.maxHp,m=!0),t.tempHp!==void 0&&(v.tempHp??0)!==(t.tempHp??0)&&(v.tempHp=t.tempHp??0,m=!0),m&&(i.add(v),Object.values(s).forEach(r=>{r.id!==t.id&&(r.characterId===v.id||r.sourceCharacterId===v.id)&&r.isGeneric!==!0&&(r.hp=v.hpCurrent,r.maxHp=v.hpMax,r.tempHp=v.tempHp)}))}),i.size>0&&u.socket&&i.forEach(t=>{u.socket.emit("character:update",{character:t}),typeof window<"u"&&window.VTT?.playerSheet?.syncLiveHp&&window.VTT.playerSheet.syncLiveHp(t.id,t.hpCurrent,t.hpMax,t.tempHp)})}export function applyDamageToTokens(e,y,u,s,i={},t={}){const{vtt:c=(typeof window<"u"?window.VTT:null)||{},tokens:v={},currentMapId:m=null,syncHpFn:r=syncTokensHpToCharacters,renderAll:p=()=>{},getTokenDrawDimensions:a=()=>({drawW:50,drawH:50}),triggerDamageFXAnimation:o=null,triggerHealingFXAnimation:h=null}=t;if(!e||e.length===0)return;let I=0;const x=[];let n=0;e.forEach(L=>{const b=v[L];if(!b)return;let S=y;if(s!=="heal"&&u!=="untyped"&&b.monsterData){const k=b.monsterData;let g=1;k.immune&&_hasResistanceType(k.immune,u,i)?g=0:k.vulnerable&&_hasResistanceType(k.vulnerable,u,i)?g=2:k.resist&&_hasResistanceType(k.resist,u,i)&&(g=.5),S=Math.floor(S*g)}else if(s!=="heal"&&u!=="untyped"&&b.isPlayer&&b.characterId&&c.campaignState?.characters?.[b.characterId]){const k=c.campaignState.characters[b.characterId];let g=1;k.immune&&_hasResistanceType(k.immune,u,i)?g=0:k.vulnerable&&_hasResistanceType(k.vulnerable,u,i)?g=2:k.resist&&_hasResistanceType(k.resist,u,i)&&(g=.5),S=Math.floor(S*g)}if(s==="half"&&(S=Math.floor(S/2)),s==="heal"){if(b.hp!==void 0){const k=b.maxHp!==void 0?b.maxHp:9999,g=b.hp;b.hp=Math.min(b.hp+S,k);const N=b.hp-g;if(N>0&&(n=N,I++,x.push(b),typeof h=="function")){const{drawW:F,drawH:X}=a(b);h(b.x+F/2,b.y+X/2,Math.max(F,X)/2,N,{tokenId:b.id,delayMs:Math.min(360,Math.max(0,I-1)*60)})}}}else if(b.hp!==void 0){let k=0;b.tempHp&&b.tempHp>0&&(k=Math.min(b.tempHp,S),b.tempHp-=k,S-=k);const g=k+S;if(S>0&&(b.hp=Math.max(0,b.hp-S)),n=g,I++,x.push(b),typeof o=="function"){const{drawW:N,drawH:F}=a(b);o(b.x+N/2,b.y+F/2,Math.max(N,F)/2,[u||"untyped"],{amount:g>0?g:y,tokenId:b.id,delayMs:Math.min(360,Math.max(0,I-1)*60)})}}}),I>0&&(r(x,{vtt:c,tokens:v}),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(v),p(),c.socket&&(s==="heal"?c.socket.emit("tokens:heal_fx",{mapId:m,tokenIds:x.map(L=>L.id),amount:x.length===1?n:null,origin:c.socket.id}):c.socket.emit("tokens:damage_fx",{mapId:m,tokenIds:x.map(L=>L.id),damageTypes:[u||"untyped"],amount:x.length===1?n:null,origin:c.socket.id})))}export function applyCardDamageToToken(e,y,u=1,s={}){const{vtt:i=(typeof window<"u"?window.VTT:null)||{}}=s;if(!e||!y||y.length===0||u<=0)return 0;let t=0;return y.forEach(c=>{const v=c.roll?c.roll.total:parseInt(c.formula)||0;if(v<=0)return;const m=c.type||"untyped",r={isMagic:!!c.isMagic,isSilvered:!!c.isSilvered,isAdamantine:!!c.isAdamantine,isSpell:!!c.isSpell};let p=v;if(m!=="untyped"&&e.monsterData){const a=e.monsterData;let o=1;a.immune&&_hasResistanceType(a.immune,m,r)?o=0:a.vulnerable&&_hasResistanceType(a.vulnerable,m,r)?o=2:a.resist&&_hasResistanceType(a.resist,m,r)&&(o=.5),p=Math.floor(p*o)}else if(m!=="untyped"&&e.isPlayer&&e.characterId&&i.campaignState?.characters?.[e.characterId]){const a=i.campaignState.characters[e.characterId];let o=1;a.immune&&_hasResistanceType(a.immune,m,r)?o=0:a.vulnerable&&_hasResistanceType(a.vulnerable,m,r)?o=2:a.resist&&_hasResistanceType(a.resist,m,r)&&(o=.5),p=Math.floor(p*o)}if(p=Math.floor(p*u),e.hp!==void 0&&p>0){let a=0;e.tempHp&&e.tempHp>0&&(a=Math.min(e.tempHp,p),e.tempHp-=a,p-=a),p>0&&(e.hp=Math.max(0,e.hp-p)),t+=a+p}}),t}export function applyCompositeDamageToTokens(e,y,u=1,s={}){const{vtt:i=(typeof window<"u"?window.VTT:null)||{},tokens:t={},currentMapId:c=null,getTokenDrawDimensions:v=()=>({drawW:50,drawH:50}),triggerDamageFXAnimation:m=()=>{},syncHpFn:r=syncTokensHpToCharacters,renderAll:p=()=>{}}=s;if(!e||e.length===0||!t)return{anyApplied:!1,affectedTokens:[],totalDeducted:0};const a=(y||[]).map(x=>x.type||"untyped").filter(Boolean);let o=!1;const h=[];let I=0;return e.forEach((x,n)=>{const L=t[x];if(!L)return;const b=applyCardDamageToToken(L,y,u,{vtt:i});b>0&&(o=!0,h.push(L),I+=b);const{drawW:S,drawH:k}=v(L);m(L.x+S/2,L.y+k/2,Math.max(S,k)/2,a.length>0?a:["untyped"],{amount:b,tokenId:L.id,delayMs:Math.min(360,n*60)})}),o&&(r(h,{vtt:i,tokens:t}),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(t),p()),i.socket&&i.socket.emit("tokens:damage_fx",{mapId:c,tokenIds:e,damageTypes:a.length>0?a:["untyped"],origin:i.socket.id}),{anyApplied:o,affectedTokens:h,totalDeducted:I}}function oe(e){return e?String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"):""}export function resolveTokenAC(e,y={}){if(!e)return 10;if(typeof y.getTokenAC=="function"){const t=y.getTokenAC(e);if(t!=null&&t!==""&&!isNaN(parseInt(t,10)))return parseInt(t,10)}if(e.ac!==void 0&&e.ac!==null&&e.ac!==""&&!isNaN(parseInt(e.ac,10)))return parseInt(e.ac,10);const u=e.monsterData||(typeof y.getResolvedCreatureMonsterData=="function"?y.getResolvedCreatureMonsterData(e):null);if(u){if(u.primaryAc!==void 0&&u.primaryAc!==null&&u.primaryAc!==""){const t=parseInt(u.primaryAc,10);if(!isNaN(t))return t}if(typeof u.ac=="number")return u.ac;if(typeof u.ac=="string"&&!isNaN(parseInt(u.ac,10)))return parseInt(u.ac,10);if(Array.isArray(u.ac)&&u.ac.length>0){const t=u.ac[0];if(typeof t=="object"&&t!==null){const c=t.ac??t.value;if(c!=null&&!isNaN(parseInt(c,10)))return parseInt(c,10)}if(typeof t=="number")return t;if(typeof t=="string"&&!isNaN(parseInt(t,10)))return parseInt(t,10)}}const s=y.vtt||(typeof window<"u"?window.VTT:null),i=e.characterId||e.sourceCharacterId;if(i&&s?.campaignState?.characters){const t=s.campaignState.characters[i];if(t){let c=t.baseAc!==void 0&&t.baseAc!==null?parseInt(t.baseAc,10):parseInt(t.ac,10)||10;const v=parseInt(t.acMod,10)||0;let m=0;Array.isArray(t.acToggles)&&t.acToggles.filter(p=>p&&p.enabled).forEach(p=>{if(p.formula){const o=String(p.formula).trim().match(/[+-]?\s*\d+/g);o&&(m+=o.reduce((h,I)=>h+(parseInt(I.replace(/\s+/g,""),10)||0),0))}else typeof p.bonus=="number"&&(m+=p.bonus)});const r=Math.max(1,c+v+m);if(!isNaN(r))return r}if(typeof t?.ac=="number")return t.ac;if(t?.ac!==void 0&&t?.ac!==null&&!isNaN(parseInt(t.ac,10)))return parseInt(t.ac,10)}return 10}export function promptMassAttackDistribution(e,y,u,s,i={}){if(typeof document>"u")return;const{tokens:t={}}=i,c=document.getElementById("vtt-distribute-attacks-backdrop");c&&(typeof c._cleanup=="function"&&c._cleanup(),c.remove());const v=e.attacks||[],m=y.map(n=>t[n]).filter(Boolean);if(m.length===0){typeof s=="function"&&s();return}const r=document.createElement("div");r.id="vtt-distribute-attacks-backdrop",r.className="vtt-modal-backdrop";const p=document.createElement("div");p.className="vtt-mass-roll-dialog",p.style.width="480px";const a=m.map(n=>oe(n.name||"Token")).join(", ");p.innerHTML=`
        <div class="mass-roll-header">
            <div class="mass-roll-title">
                <i class="fa-solid fa-crosshairs"></i>
                <span>Distribute Mass Attacks</span>
            </div>
            <button type="button" class="mass-roll-close" id="btn-distribute-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mass-roll-body">
            <div class="mass-roll-creature-info">
                <strong>${v.length}</strong> attacks targeting <strong>${m.length}</strong> creatures (${a}). Choose how to distribute:
            </div>
            <div class="distribute-modes-grid">
                <button type="button" class="distribute-mode-card" data-mode="attacks_equal">
                    <div class="distribute-mode-card-icon"><i class="fa-solid fa-crosshairs"></i></div>
                    <div class="distribute-mode-card-content">
                        <div class="distribute-mode-card-title">Distribute Attacks Equally</div>
                        <div class="distribute-mode-card-desc">Evenly splits attacks across targets. Evaluates each attack against that target's AC.</div>
                    </div>
                </button>
                <button type="button" class="distribute-mode-card" data-mode="attacks_random">
                    <div class="distribute-mode-card-icon"><i class="fa-solid fa-shuffle"></i></div>
                    <div class="distribute-mode-card-content">
                        <div class="distribute-mode-card-title">Distribute Attacks Randomly</div>
                        <div class="distribute-mode-card-desc">Assigns each attack to a random target. Evaluates against that target's AC.</div>
                    </div>
                </button>
                <button type="button" class="distribute-mode-card" data-mode="damage_equal">
                    <div class="distribute-mode-card-icon"><i class="fa-solid fa-scale-balanced"></i></div>
                    <div class="distribute-mode-card-content">
                        <div class="distribute-mode-card-title">Distribute Damage Equally</div>
                        <div class="distribute-mode-card-desc">Evaluates hits, pools total hit damage, and divides it equally among all targets.</div>
                    </div>
                </button>
                <button type="button" class="distribute-mode-card" data-mode="damage_random">
                    <div class="distribute-mode-card-icon"><i class="fa-solid fa-dice"></i></div>
                    <div class="distribute-mode-card-content">
                        <div class="distribute-mode-card-title">Distribute Damage Randomly</div>
                        <div class="distribute-mode-card-desc">Evaluates hits, and randomly assigns each hitting attack's full damage to a target.</div>
                    </div>
                </button>
            </div>
        </div>
        <div class="mass-roll-footer">
            <button type="button" class="btn-mass-roll-cancel" id="btn-distribute-cancel">Cancel</button>
        </div>
    `,r.appendChild(p),document.body.appendChild(r);function o(){window.removeEventListener("keydown",x)}r._cleanup=o;function h(){o(),r.remove()}function I(n){h(),typeof u=="function"&&u(n)}function x(n){n.key==="Escape"&&(n.preventDefault(),h(),typeof s=="function"&&s())}window.addEventListener("keydown",x),p.querySelector("#btn-distribute-close").addEventListener("click",()=>{h(),typeof s=="function"&&s()}),p.querySelector("#btn-distribute-cancel").addEventListener("click",()=>{h(),typeof s=="function"&&s()}),p.querySelectorAll(".distribute-mode-card").forEach(n=>{n.addEventListener("click",()=>{const L=n.dataset.mode;I(L)})}),r.addEventListener("click",n=>{n.target===r&&(h(),typeof s=="function"&&s())})}export function processMassAttackFromChat(e,y,u={}){const{vtt:s=(typeof window<"u"?window.VTT:null)||{},selectedTokenIds:i=new Set,executeMassAttackResolutionFn:t=executeMassAttackResolution,promptMassAttackDistributionFn:c=promptMassAttackDistribution}=u;if(s.role!=="GM"||!e)return;const v=Array.from(i);if(v.length===0){if(typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:"warning",content:"No tokens selected. Select target token(s) on canvas first."}),y&&typeof document<"u"){const p=document.querySelector(`[data-msg-id="${y}"]`)?.querySelector(".btn-mass-attack-process");p&&(p.disabled=!1)}return}if((e.attacks||[]).length!==0){if(v.length===1){t(e,"attacks_equal",y,{...u,targetTokenIds:v});return}c(e,v,r=>{t(e,r,y,{...u,targetTokenIds:v})},()=>{if(y&&typeof document<"u"){const p=document.querySelector(`[data-msg-id="${y}"]`)?.querySelector(".btn-mass-attack-process");p&&(p.disabled=!1)}},u)}}export function executeMassAttackResolution(e,y,u,s={}){const{vtt:i=(typeof window<"u"?window.VTT:null)||{},tokens:t={},currentMapId:c=null,getTokenDrawDimensions:v=()=>({drawW:50,drawH:50}),triggerDamageFXAnimation:m=()=>{},syncHpFn:r=syncTokensHpToCharacters,renderAll:p=()=>{},getResolvedCreatureMonsterData:a=d=>d?.monsterData||null}=s,o=e.attacks||[];if(o.length===0)return;let h=[];Array.isArray(s.targetTokenIds)&&s.targetTokenIds.length>0?h=s.targetTokenIds.map(d=>t[d]).filter(Boolean):Array.isArray(y)&&(h=y.map(d=>t[d.tokenId]).filter(Boolean)),h.length===0&&(h=Object.values(t));const I=new Map;if(h.forEach(d=>{d&&d.id&&!I.has(d.id)&&I.set(d.id,d)}),h=Array.from(I.values()),h.length===0)return;let x=!1;const n=[],L=[],b=new Set,S=[],k={};function g(d,T){if(!d||!T||T.length===0)return 0;T.forEach(E=>{E.type&&b.add(E.type)});const q=applyCardDamageToToken(d,T,1,{vtt:i});return q>0&&(x=!0,k[d.id]||(k[d.id]={token:d,deducted:0,damageTypes:new Set}),k[d.id].deducted+=q,T.forEach(E=>{E.type&&k[d.id].damageTypes.add(E.type)})),q}const N=Array.isArray(y),F=N?"custom":y||"attacks_equal";if(N){const d={};o.forEach(T=>{d[T.index]=T}),y.forEach(T=>{const q=t[T.tokenId];if(!q)return;const E=resolveTokenAC(q,s);T.attackIndices.forEach(C=>{const $=d[C];if(!$)return;let j=!1;$.atkRoll?j=$.atkRoll.isCritSuccess||!$.atkRoll.isCritFail&&$.atkRoll.total>=E:j=!0;let W=0;if(j){const G=$.dmgRolls||[],H=G.filter(_=>!_.saveRider),z=G.filter(_=>_.saveRider);W=g(q,H),$.saveInfo&&$.saveInfo.dc&&S.push({token:q,attackIndex:$.index,saveInfo:$.saveInfo,riderDamages:z})}$.resolution={tokenId:q.id,tokenName:q.name||"Token",hit:j,damageDealt:W}})})}else if(F==="attacks_equal")o.forEach((d,T)=>{const q=h[T%h.length],E=resolveTokenAC(q,s);let C=!1;d.atkRoll?C=d.atkRoll.isCritSuccess||!d.atkRoll.isCritFail&&d.atkRoll.total>=E:C=!0;let $=0;if(C){const j=d.dmgRolls||[],W=j.filter(H=>!H.saveRider),G=j.filter(H=>H.saveRider);$=g(q,W),d.saveInfo&&d.saveInfo.dc&&S.push({token:q,attackIndex:d.index,saveInfo:d.saveInfo,riderDamages:G})}d.resolution={tokenId:q.id,tokenName:q.name||"Token",hit:C,damageDealt:$}});else if(F==="attacks_random")o.forEach(d=>{const T=h[Math.floor(Math.random()*h.length)],q=resolveTokenAC(T,s);let E=!1;d.atkRoll?E=d.atkRoll.isCritSuccess||!d.atkRoll.isCritFail&&d.atkRoll.total>=q:E=!0;let C=0;if(E){const $=d.dmgRolls||[],j=$.filter(G=>!G.saveRider),W=$.filter(G=>G.saveRider);C=g(T,j),d.saveInfo&&d.saveInfo.dc&&S.push({token:T,attackIndex:d.index,saveInfo:d.saveInfo,riderDamages:W})}d.resolution={tokenId:T.id,tokenName:T.name||"Token",hit:E,damageDealt:C}});else if(F==="damage_random")o.forEach(d=>{const T=h[Math.floor(Math.random()*h.length)],q=resolveTokenAC(T,s);let E=!1;d.atkRoll?E=d.atkRoll.isCritSuccess||!d.atkRoll.isCritFail&&d.atkRoll.total>=q:E=!0;let C=0;if(E){const $=d.dmgRolls||[],j=$.filter(G=>!G.saveRider),W=$.filter(G=>G.saveRider);C=g(T,j),d.saveInfo&&d.saveInfo.dc&&S.push({token:T,attackIndex:d.index,saveInfo:d.saveInfo,riderDamages:W})}d.resolution={tokenId:T.id,tokenName:T.name||"Token",hit:E,damageDealt:C}});else if(F==="damage_equal"){const d=[];if(o.forEach((T,q)=>{const E=h[q%h.length],C=resolveTokenAC(E,s);let $=!1;T.atkRoll?$=T.atkRoll.isCritSuccess||!T.atkRoll.isCritFail&&T.atkRoll.total>=C:$=!0,$?d.push({attack:T,testTarget:E}):T.resolution={tokenId:E.id,tokenName:E.name||"Token",hit:!1,damageDealt:0}}),d.length>0){const T={};d.forEach(({attack:H})=>{(H.dmgRolls||[]).filter(O=>!O.saveRider).forEach(O=>{const l=O.type||"untyped",w=`${l}_${!!O.isMagic}_${!!O.isSilvered}_${!!O.isAdamantine}_${!!O.isSpell}`,D=O.roll?O.roll.total:parseInt(O.formula)||0;T[w]||(T[w]={type:l,isMagic:!!O.isMagic,isSilvered:!!O.isSilvered,isAdamantine:!!O.isAdamantine,isSpell:!!O.isSpell,total:0}),T[w].total+=D})});const q=new Map;d.forEach(({testTarget:H})=>{H&&!q.has(H.id)&&q.set(H.id,H)});const E=Array.from(q.values()),C=E.length,$=E.map(()=>[]);Object.values(T).forEach(H=>{const z=Math.floor(H.total/C),_=H.total%C;E.forEach((O,l)=>{const w=z+(l<_?1:0);w>0&&$[l].push({type:H.type,formula:`${w}`,isMagic:H.isMagic,isSilvered:H.isSilvered,isAdamantine:H.isAdamantine,isSpell:H.isSpell,roll:{total:w,formula:`${w}`}})})});let j=0;E.forEach((H,z)=>{const _=$[z];if(_.length>0){const O=g(H,_);j+=O}}),d.forEach(({attack:H,testTarget:z})=>{if(H.saveInfo&&H.saveInfo.dc){const O=(H.dmgRolls||[]).filter(l=>l.saveRider);S.push({token:z,attackIndex:H.index,saveInfo:H.saveInfo,riderDamages:O})}});const W=Math.floor(j/d.length),G=j%d.length;d.forEach(({attack:H,testTarget:z},_)=>{const O=W+(_<G?1:0);H.resolution={tokenId:z.id,tokenName:z.name||`${E.length} Targets`,hit:!0,damageDealt:O}})}}Object.values(k).forEach(({token:d,deducted:T,damageTypes:q},E)=>{L.push(d),n.push(d.id);const{drawW:C,drawH:$}=v(d);m(d.x+C/2,d.y+$/2,Math.max(C,$)/2,q.size>0?Array.from(q):["untyped"],{amount:T,tokenId:d.id,delayMs:Math.min(360,E*60)})}),x&&(r(L,{vtt:i,tokens:t}),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(t),p()),n.length>0&&i.socket&&i.socket.emit("tokens:damage_fx",{mapId:c,tokenIds:n,damageTypes:b.size>0?Array.from(b):["untyped"],origin:i.socket.id});const X=o.filter(d=>d.resolution?.hit).length,Y=o.reduce((d,T)=>d+(T.resolution?.damageDealt||0),0),Z={hitsCount:X,totalDamageDealt:Y,saveRidersTriggered:S.length>0};if(e.resolved={timestamp:Date.now()},e.summary=Z,i.socket&&u&&i.socket.emit("chat:mass_attack_resolved",{id:u,massAttackCard:e,resolution:{timestamp:Date.now()},attacks:o,summary:Z}),S.length>0){let q=function(){if(T<S.length){const E=S[T],C=E.token,$=E.saveInfo,j=($.ability||"CON").toUpperCase(),W=parseInt($.dc)||10,G=j.toLowerCase();let H="";if(C.isPlayer&&C.characterId&&i.campaignState?.characters?.[C.characterId]){const l=i.campaignState.characters[C.characterId];H=ie(l,"save",G)}else{const l=a(C);if(l&&l.save&&l.save[G]!==void 0){const w=parseInt(l.save[G])||0;H=`1d20${w>=0?"+":""}${w}`}else if(l&&l[G]!==void 0){const w=Math.floor(((l[G]||10)-10)/2);H=`1d20${w>=0?"+":""}${w}`}else{const w=re(C,j,{vtt:i,getResolvedCreatureMonsterData:a});H=`1d20${w>=0?"+":""}${w}`}}const z=`${C.name||"Token"} (Attack #${E.attackIndex}): ${j} Saving Throw (DC ${W})`,_=de(H,z,C.id,{vtt:i}),O=_.total>=W;d.push({tokenId:C.id,tokenName:`${C.name||"Token"} (Attack #${E.attackIndex})`,attackIndex:E.attackIndex,d20:_.d20,mod:_.mod,total:_.total,passed:O,formula:_.formula,dmgRolls:E.riderDamages||[]}),T++,setTimeout(q,150)}else{const E=S[0]?.saveInfo||{},C=S.flatMap($=>$.riderDamages||[]);ce({dc:parseInt(E.dc)||10,ability:(E.ability||"CON").toUpperCase(),results:d,cardData:{dmgRolls:C.length>0?C:[]}},{vtt:i})}};const d=[];let T=0;q()}}export function processCardFullResolution(e,y,u={}){if(!y||y.length===0)return!1;const{vtt:s=(typeof window<"u"?window.VTT:null)||{},tokens:i={},currentMapId:t=null,getTokenDrawDimensions:c=()=>({drawW:50,drawH:50}),triggerDamageFXAnimation:v=()=>{},syncHpFn:m=syncTokensHpToCharacters,renderAll:r=()=>{},getResolvedCreatureMonsterData:p=g=>g?.monsterData||null,msgId:a=u.msgId||null}=u,o=e.dmgRolls||[],h=!!e.atkRoll,I=e.saveInfo||(e.saveDc?{dc:e.saveDc,ability:e.saveAbility}:null),x=["STR","DEX","CON","INT","WIS","CHA","STRENGTH","DEXTERITY","CONSTITUTION","INTELLIGENCE","WISDOM","CHARISMA"],n=I&&I.ability&&x.includes(I.ability.trim().toUpperCase())&&!isNaN(parseInt(I.dc))&&parseInt(I.dc)>0?{...I,ability:I.ability.trim().substring(0,3).toUpperCase()}:null,L=y.map(g=>i[g]?.name||"Target").slice(0,3).join(", ")+(y.length>3?` +${y.length-3} more`:""),b={};if(h){const g=e.atkRoll;y.forEach(N=>{const F=i[N];if(!F)return;const X=resolveTokenAC(F,u),Y=g.isCritSuccess||!g.isCritFail&&g.total>=X;b[N]=Y})}const S=h?y.filter(g=>b[g]):y;if(h&&S.length===0){const g=`Attack (${e.atkRoll.total}) missed selected token(s)`;return e.resolved={summary:g,timestamp:Date.now()},s.socket&&a&&s.socket.emit("chat:macro_resolved",{id:a,macroCard:e,resolution:e.resolved}),!0}let k=0;if(h){const g=o.filter(N=>!N.saveRider);if(g.length>0){let N=!1;const F=[],X=[],Y=g.map(Z=>Z.type||"untyped").filter(Boolean);S.forEach((Z,d)=>{const T=i[Z];if(!T)return;const q=applyCardDamageToToken(T,g,1,{vtt:s});q>0&&(N=!0,X.push(T),k+=q),F.push(T.id);const{drawW:E,drawH:C}=c(T);v(T.x+E/2,T.y+C/2,Math.max(E,C)/2,Y.length>0?Y:["untyped"],{amount:q,tokenId:T.id,delayMs:Math.min(360,d*60)})}),N&&(m(X,{vtt:s,tokens:i}),typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(i),r()),F.length>0&&s.socket&&s.socket.emit("tokens:damage_fx",{mapId:t,tokenIds:F,damageTypes:Y.length>0?Y:["untyped"],origin:s.socket.id})}}if(n){let E=function(){if(q<X.length){const C=X[q],$=i[C];if($){let j="";if($.isPlayer&&$.characterId&&s.campaignState?.characters?.[$.characterId]){const z=s.campaignState.characters[$.characterId];j=ie(z,"save",F)}else{const z=p($);if(z&&z.save&&z.save[F]!==void 0){const _=parseInt(z.save[F])||0;j=`1d20${_>=0?"+":""}${_}`}else if(z&&z[F]!==void 0){const _=Math.floor(((z[F]||10)-10)/2);j=`1d20${_>=0?"+":""}${_}`}else{const _=re($,g,{vtt:s,getResolvedCreatureMonsterData:p});j=`1d20${_>=0?"+":""}${_}`}}const W=`${$.name||"Token"}: ${g} Saving Throw`,G=de(j,W,$.id,{vtt:s}),H=G.total>=N;T.push({tokenId:$.id,tokenName:$.name||"Token",d20:G.d20,mod:G.mod,total:G.total,passed:H,formula:G.formula,dmgRolls:d})}q++,setTimeout(E,150)}else ce({dc:N,ability:g,results:T,cardData:{...e,dmgRolls:d}},{vtt:s})};const g=(n.ability||"DEX").toUpperCase(),N=parseInt(n.dc)||10,F=g.toLowerCase(),X=S,Y=S.map(C=>i[C]?.name||"Target").slice(0,3).join(", ")+(S.length>3?` +${S.length-3} more`:""),Z=h?`Hit! Dealt ${k} DMG to ${Y} (Saving Throw triggered)`:`Saving Throw triggered for ${L}`;e.resolved={summary:Z,timestamp:Date.now()},s.socket&&a&&s.socket.emit("chat:macro_resolved",{id:a,macroCard:e,resolution:e.resolved});let d=o.filter(C=>C.saveRider);!h&&d.length===0&&(d=o);const T=[];let q=0;return E(),!0}else if(h){const g=S.map(F=>i[F]?.name||"Target").slice(0,3).join(", ")+(S.length>3?` +${S.length-3} more`:""),N=`Hit! Dealt ${k} DMG to ${g}`;return e.resolved={summary:N,timestamp:Date.now()},s.socket&&a&&s.socket.emit("chat:macro_resolved",{id:a,macroCard:e,resolution:e.resolved}),!0}else{k=applyCompositeDamageToTokens(y,o,1,u)?.totalDeducted??0;const N=`Applied ${k} DMG to ${L}`;return e.resolved={summary:N,timestamp:Date.now()},s.socket&&a&&s.socket.emit("chat:macro_resolved",{id:a,macroCard:e,resolution:e.resolved}),!0}}export function handleCardAction(e,y,u={}){const{vtt:s=(typeof window<"u"?window.VTT:null)||{},selectedTokenIds:i=new Set}=u;if(s.role!=="GM")return!1;let t=Array.from(i);if(t.length===0&&e&&e.tokenId&&(t=[e.tokenId]),t.length===0)return typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:"warning",content:"No tokens selected. Select target token(s) first."}),!1;const c=u.msgId||null;let v=e.dmgRolls||[];if(v.length===0){if(e.damageRoll)v=[{roll:e.damageRoll,type:e.damageType||"piercing"}];else if(e.damage){const a=parseInt(e.damage)||0;v=[{formula:String(e.damage),roll:{total:a},type:e.damageType||"piercing"}]}}const m=u.tokens||{},r=t.map(a=>m[a]?.name||"Target").slice(0,3).join(", ")+(t.length>3?` +${t.length-3} more`:""),p=!!(e.isTrap||e.trapId);if(y==="full"){const h=`Full Damage (${applyCompositeDamageToTokens(t,v,1,u)?.totalDeducted??0} HP) applied to ${r}`;return p?typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:"success",content:h}):(e.resolved={summary:h,timestamp:Date.now()},s.socket&&c&&s.socket.emit("chat:macro_resolved",{id:c,macroCard:e,resolution:e.resolved})),!0}else if(y==="half"){const h=`Half Damage (${applyCompositeDamageToTokens(t,v,.5,u)?.totalDeducted??0} HP) applied to ${r}`;return p?typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:"success",content:h}):(e.resolved={summary:h,timestamp:Date.now()},s.socket&&c&&s.socket.emit("chat:macro_resolved",{id:c,macroCard:e,resolution:e.resolved})),!0}else if(y==="process"){if(p){if(!e.saveAbility||e.saveAbility==="NONE"){const x=`Full Damage (${applyCompositeDamageToTokens(t,v,1,u)?.totalDeducted??0} HP) applied to ${r}`;return typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:"success",content:x}),!0}const a=`${e.trapId}_${e.tokenId||t[0]}`,o=s._lastTrapSaves?.[a]||typeof window<"u"&&window.VTT?._lastTrapSaves?.[a]||e.lastSaveRoll||null;if(t.length===1){if(!o)return typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:"warning",content:"Please click 'Roll Save' first before processing the trap."}),!1;const h=parseInt(e.saveDc)||15,I=o.total>=h,L=applyCompositeDamageToTokens(t,v,I?.5:1,u)?.totalDeducted??0,b=I?`Save Passed (${o.total} vs DC ${h}): Half Damage (${L} HP) applied to ${r}`:`Save Failed (${o.total} vs DC ${h}): Full Damage (${L} HP) applied to ${r}`;return typeof JqueryUtil<"u"&&JqueryUtil.doToast&&JqueryUtil.doToast({type:I?"info":"success",content:b}),!0}return e.dmgRolls=v,e.saveInfo=e.saveInfo||{dc:e.saveDc,ability:e.saveAbility},processCardFullResolution(e,t,{...u,msgId:c})}return processCardFullResolution(e,t,{...u,msgId:c})}return!1}export function changeMassTokenZOrder(e,y,u={}){const{vtt:s=(typeof window<"u"?window.VTT:null)||{},tokens:i={},renderAll:t=()=>{}}=u,c=Object.values(i);if(c.length===0||e.length===0)return;const v=new Set(e),m=e.map(o=>i[o]).filter(Boolean);if(m.length===0)return;const r=c.filter(o=>!v.has(o.id)).map(o=>o.zIndex||0),p=r.length>0?Math.max(...r):0,a=r.length>0?Math.min(...r):0;if(m.sort((o,h)=>(o.zIndex||0)-(h.zIndex||0)),y==="front")m.forEach((o,h)=>{o.zIndex=p+1+h});else if(y==="back"){const o=a-m.length;m.forEach((h,I)=>{h.zIndex=o+I})}s.socket&&typeof window<"u"&&typeof window.emitTokenUpdates=="function"&&window.emitTokenUpdates(i),t()}export function showApplyDamageModal(e,y={}){if(typeof document>"u")return;const{applyDamageToTokensFn:u=applyDamageToTokens}=y,s=document.getElementById("vtt-apply-damage-modal");s&&s.remove();const i=document.createElement("div");i.id="vtt-apply-damage-modal",i.className="vtt-modal";const t=["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"];i.innerHTML=`
        <div class="vtt-modal-content" style="max-width: 300px;">
            <div class="vtt-modal-header">
                <h3><i class="fa-solid fa-heart-crack"></i> Apply Damage (${e.length} Token${e.length>1?"s":""})</h3>
                <button class="vtt-modal-close"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="vtt-modal-body">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Damage Amount</label>
                    <input type="number" id="apply-damage-amount" class="vtt-input" value="0" min="0" style="width: 100%;" autofocus>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px;">Damage Type</label>
                    <select id="apply-damage-type" class="vtt-input" style="width: 100%;">
                        <option value="untyped">Untyped</option>
                        ${t.map(a=>`<option value="${a}">${a.charAt(0).toUpperCase()+a.slice(1)}</option>`).join("")}
                    </select>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="vtt-btn vtt-btn-danger" id="btn-apply-full" style="flex: 1;"><i class="fa-solid fa-droplet"></i> Full</button>
                    <button class="vtt-btn vtt-btn-warning" id="btn-apply-half" style="flex: 1;"><i class="fa-solid fa-shield-halved"></i> Half</button>
                    <button class="vtt-btn vtt-btn-success" id="btn-apply-heal" style="flex: 1;"><i class="fa-solid fa-heart"></i> Heal</button>
                </div>
            </div>
        </div>
    `,document.body.appendChild(i);const c=a=>{(a.key==="Escape"||a.keyCode===27)&&(window.removeEventListener("keydown",c),i.remove())};window.addEventListener("keydown",c),i.addEventListener("click",a=>{a.target===i&&(window.removeEventListener("keydown",c),i.remove())}),i.querySelector(".vtt-modal-close").addEventListener("click",()=>{window.removeEventListener("keydown",c),i.remove()});const m=i.querySelector("#apply-damage-amount"),r=i.querySelector("#apply-damage-type"),p=a=>{const o=parseInt(m.value)||0;o>0&&u(e,o,r.value,a,{},y),window.removeEventListener("keydown",c),i.remove()};i.querySelector("#btn-apply-full").addEventListener("click",()=>p("full")),i.querySelector("#btn-apply-half").addEventListener("click",()=>p("half")),i.querySelector("#btn-apply-heal").addEventListener("click",()=>p("heal")),m.addEventListener("keydown",a=>{a.key==="Enter"&&p("full")})}export function promptCustomModifierModal(e,y,u){if(typeof document>"u"){typeof y=="function"&&y(0);return}const s=document.getElementById("vtt-custom-mod-backdrop");s&&(typeof s._cleanup=="function"&&s._cleanup(),s.remove());const i=document.createElement("div");i.id="vtt-custom-mod-backdrop",i.className="vtt-modal-backdrop";let t=0;const c=document.createElement("div");c.className="vtt-mass-roll-dialog",c.style.width="360px",c.innerHTML=`
        <div class="mass-roll-header">
            <div class="mass-roll-title">
                <i class="fa-solid fa-calculator"></i>
                <span>Custom Modifier</span>
            </div>
            <button type="button" class="mass-roll-close" id="btn-mod-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mass-roll-body">
            <div class="mass-roll-creature-info">
                Some selected tokens lack a stat block. Specify a modifier for <strong>${oe(e)}</strong>:
            </div>
            
            <div>
                <div class="mass-roll-label">
                    <span>Modifier</span>
                    <span id="mod-display" style="color:var(--color-gold-light); font-family:var(--font-mono, monospace);">+0</span>
                </div>
                <div class="mass-roll-count-row">
                    <button type="button" class="mass-roll-step-btn" id="mod-minus">-</button>
                    <input type="number" class="mass-roll-input" id="mod-input" value="0" min="-10" max="30">
                    <button type="button" class="mass-roll-step-btn" id="mod-plus">+</button>
                </div>
            </div>

            <div class="mass-roll-presets">
                <button type="button" class="mass-roll-preset-chip" data-mod="-2">-2</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="-1">-1</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="0">+0</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="1">+1</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="2">+2</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="3">+3</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="4">+4</button>
                <button type="button" class="mass-roll-preset-chip" data-mod="5">+5</button>
            </div>
        </div>
        <div class="mass-roll-footer">
            <button type="button" class="btn-mass-roll-cancel" id="btn-mod-cancel">Cancel</button>
            <button type="button" class="btn-mass-roll-confirm" id="btn-mod-confirm">
                <i class="fa-solid fa-dice-d20"></i> Confirm & Roll
            </button>
        </div>
    `,i.appendChild(c),document.body.appendChild(i);const v=c.querySelector("#mod-input"),m=c.querySelector("#mod-display");function r(I){t=parseInt(I)||0,v.value=t,m&&(m.textContent=t>=0?`+${t}`:`${t}`)}v.focus(),v.select(),v.addEventListener("input",()=>r(v.value)),c.querySelector("#mod-minus").addEventListener("click",()=>r(t-1)),c.querySelector("#mod-plus").addEventListener("click",()=>r(t+1)),c.querySelectorAll(".mass-roll-preset-chip").forEach(I=>{I.addEventListener("click",()=>{const x=parseInt(I.dataset.mod)||0;r(x)})});function p(){typeof window<"u"&&window.removeEventListener("keydown",h),i.remove()}i._cleanup=p;function a(){p(),typeof y=="function"&&y(t)}function o(){p(),typeof u=="function"&&u()}function h(I){I.key==="Escape"?(I.preventDefault(),o()):I.key==="Enter"&&(I.preventDefault(),a())}typeof window<"u"&&window.addEventListener("keydown",h),c.querySelector("#btn-mod-close").addEventListener("click",o),c.querySelector("#btn-mod-cancel").addEventListener("click",o),c.querySelector("#btn-mod-confirm").addEventListener("click",a),i.addEventListener("click",I=>{I.target===i&&o()})}export function clusterTokensByProximity(e,y){if(!e||!Array.isArray(e)||e.length<=1||y<=1)return e?[e.slice()]:[[]];const u=e.length,s=Math.min(y,u),i=a=>({x:(a.x||0)+(a.width||50)/2,y:(a.y||0)+(a.height||50)/2}),t=Math.floor(u/s),c=u%s,v=Array.from({length:s},(a,o)=>t+(o<c?1:0)),m=(a,o)=>(a.x-o.x)**2+(a.y-o.y)**2,r=[...e],p=[];for(let a=0;a<s&&r.length!==0;a++){const o=v[a];if(a===s-1){p.push(r.splice(0,r.length));break}let h=0,I=0;r.forEach(k=>{const g=i(k);h+=g.x,I+=g.y}),h/=r.length,I/=r.length;let x=0,n=-1;r.forEach((k,g)=>{const N=m(i(k),{x:h,y:I});N>n&&(n=N,x=g)});const L=r.splice(x,1)[0],b=[L],S=i(L);for(;b.length<o&&r.length>0;){let k=0,g=1/0;r.forEach((F,X)=>{const Y=m(i(F),S);Y<g&&(g=Y,k=X)});const N=r.splice(k,1)[0];b.push(N)}p.push(b)}return p.sort((a,o)=>{const h=a.reduce((L,b)=>L+(b.x||0),0)/a.length,I=o.reduce((L,b)=>L+(b.x||0),0)/o.length;if(Math.abs(h-I)>1)return h-I;const x=a.reduce((L,b)=>L+(b.y||0),0)/a.length,n=o.reduce((L,b)=>L+(b.y||0),0)/o.length;return x-n}),p}export function promptQuickSplitModal(e,y,u,s){if(typeof document>"u")return;const i=document.getElementById("vtt-quick-split-backdrop");i&&(typeof i._cleanup=="function"&&i._cleanup(),i.remove());let t="",c=0;Object.entries(e).forEach(([k,g])=>{g.length>c&&(c=g.length,t=k)});const v=document.createElement("div");v.id="vtt-quick-split-backdrop",v.className="vtt-modal-backdrop";const m=document.createElement("div");m.className="vtt-mass-roll-dialog",m.style.width="440px";let r=c<=12?2:Math.min(10,Math.ceil(c/5)),p="";c<=20?p=`
            <button type="button" class="mass-roll-preset-chip" data-sub="1">Single (1 Group)</button>
            <button type="button" class="mass-roll-preset-chip" data-sub="2">2 Groups</button>
            <button type="button" class="mass-roll-preset-chip" data-size="4">Groups of 4</button>
            <button type="button" class="mass-roll-preset-chip" data-size="5">Groups of 5</button>
        `:p=`
            <button type="button" class="mass-roll-preset-chip" data-sub="1">Single Group</button>
            <button type="button" class="mass-roll-preset-chip" data-size="5">Groups of 5</button>
            <button type="button" class="mass-roll-preset-chip" data-size="10">Groups of 10</button>
            <button type="button" class="mass-roll-preset-chip" data-size="20">Groups of 20</button>
            <button type="button" class="mass-roll-preset-chip" data-sub="2">Halves (2)</button>
            <button type="button" class="mass-roll-preset-chip" data-sub="4">Quarters (4)</button>
        `,m.innerHTML=`
        <div class="mass-roll-header">
            <div class="mass-roll-title">
                <i class="fa-solid fa-users-rays"></i>
                <span>Group Initiative: Squad Split</span>
            </div>
            <button type="button" class="mass-roll-close" id="btn-split-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mass-roll-body">
            <div class="mass-roll-creature-info">
                Large group detected: <strong>${c} \xD7 ${oe(t)}</strong>. Choose how to split initiative squads:
            </div>
            
            <div>
                <div class="mass-roll-label">
                    <span>Number of Subgroups</span>
                    <span id="split-subgroups-display" style="color:var(--color-gold-light); font-family:var(--font-mono, monospace);">${r}</span>
                </div>
                <div class="mass-roll-count-row">
                    <button type="button" class="mass-roll-step-btn" id="split-minus">-</button>
                    <input type="number" class="mass-roll-input" id="split-input" value="${r}" min="1" max="${c}">
                    <button type="button" class="mass-roll-step-btn" id="split-plus">+</button>
                </div>
            </div>

            <div class="mass-roll-presets">
                ${p}
            </div>

            <div id="split-preview" style="font-size:0.8rem; color:#aaa; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
            </div>
        </div>
        <div class="mass-roll-footer" style="display:flex; justify-content:space-between;">
            <button type="button" class="btn-mass-roll-cancel" id="btn-split-cancel">Cancel</button>
            <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-secondary" id="btn-split-single" style="font-size:0.8rem;">
                    Keep Single
                </button>
                <button type="button" class="btn-mass-roll-confirm" id="btn-split-confirm">
                    <i class="fa-solid fa-dice-d20"></i> Split & Roll
                </button>
            </div>
        </div>
    `,v.appendChild(m),document.body.appendChild(v);const a=m.querySelector("#split-input"),o=m.querySelector("#split-subgroups-display"),h=m.querySelector("#split-preview");let I={mode:"count",value:r};function x(k,g=null){if(r=Math.max(1,Math.min(c,parseInt(k)||1)),I=g||{mode:"count",value:r},a.value=r,o&&(o.textContent=r),h)if(r===1)h.innerHTML=`<i class="fa-solid fa-user-group"></i> All <strong>${c}</strong> tokens will share a single initiative roll.`;else if(I.mode==="size"){const N=I.value;h.innerHTML=`<i class="fa-solid fa-users-rays"></i> Splitting by squad size into <strong>squads of ~${N}</strong> tokens each (${r} squads for ${t}).`}else{const N=Math.ceil(c/r);h.innerHTML=`<i class="fa-solid fa-users-rays"></i> Splitting into <strong>${r} geographic squads</strong> (~${N} tokens per squad), each rolling its own initiative.`}}x(r,{mode:"count",value:r}),a.addEventListener("input",()=>x(a.value,{mode:"count",value:parseInt(a.value)||1})),m.querySelector("#split-minus").addEventListener("click",()=>x(r-1,{mode:"count",value:r-1})),m.querySelector("#split-plus").addEventListener("click",()=>x(r+1,{mode:"count",value:r+1})),m.querySelectorAll(".mass-roll-preset-chip").forEach(k=>{k.addEventListener("click",()=>{if(k.dataset.sub){const g=parseInt(k.dataset.sub)||1;x(g,{mode:"count",value:g})}else if(k.dataset.size){const g=parseInt(k.dataset.size)||5,N=Math.max(1,Math.ceil(c/g));x(N,{mode:"size",value:g})}})});function n(){typeof window<"u"&&window.removeEventListener("keydown",S),v.remove()}v._cleanup=n;function L(k){n(),typeof u=="function"&&u(k)}function b(){n(),typeof s=="function"&&s()}function S(k){k.key==="Escape"?(k.preventDefault(),b()):k.key==="Enter"&&(k.preventDefault(),L(I))}typeof window<"u"&&window.addEventListener("keydown",S),m.querySelector("#btn-split-close").addEventListener("click",b),m.querySelector("#btn-split-cancel").addEventListener("click",b),m.querySelector("#btn-split-single").addEventListener("click",()=>L({mode:"count",value:1})),m.querySelector("#btn-split-confirm").addEventListener("click",()=>L(I)),v.addEventListener("click",k=>{k.target===v&&b()})}export function showMassRollContextMenu(e,y,u,s={}){if(typeof document>"u")return;const{vtt:i=(typeof window<"u"?window.VTT:null)||{},tokens:t={},selectedTokenIds:c=new Set,campaignSettings:v={},isMobileViewport:m=()=>!1,triggerSplashForSelection:r=()=>{},getTokenDrawDimensions:p=()=>({drawW:50,drawH:50}),snapToGrid:a=(l,w)=>({x:l,y:w}),renderAll:o=()=>{},getResolvedCreatureMonsterData:h=l=>l?.monsterData||null}=s,I=document.getElementById("vtt-token-context-menu");I&&I.remove();const x=e.map(l=>t[l]).filter(Boolean);if(x.length===0)return;const n=document.createElement("div");n.id="vtt-token-context-menu",n.className="vtt-token-context-menu",n.style.left=`${y}px`,n.style.top=`${u}px`;const L=[{key:"str",label:"Strength"},{key:"dex",label:"Dexterity"},{key:"con",label:"Constitution"},{key:"int",label:"Intelligence"},{key:"wis",label:"Wisdom"},{key:"cha",label:"Charisma"}],b=[{key:"acrobatics",label:"Acrobatics",ability:"dex"},{key:"animalHandling",label:"Animal Handling",ability:"wis"},{key:"arcana",label:"Arcana",ability:"int"},{key:"athletics",label:"Athletics",ability:"str"},{key:"deception",label:"Deception",ability:"cha"},{key:"history",label:"History",ability:"int"},{key:"insight",label:"Insight",ability:"wis"},{key:"intimidation",label:"Intimidation",ability:"cha"},{key:"investigation",label:"Investigation",ability:"int"},{key:"medicine",label:"Medicine",ability:"wis"},{key:"nature",label:"Nature",ability:"int"},{key:"perception",label:"Perception",ability:"wis"},{key:"performance",label:"Performance",ability:"cha"},{key:"persuasion",label:"Persuasion",ability:"cha"},{key:"religion",label:"Religion",ability:"int"},{key:"sleightOfHand",label:"Sleight of Hand",ability:"dex"},{key:"stealth",label:"Stealth",ability:"dex"},{key:"survival",label:"Survival",ability:"wis"}];let S=`
        <div class="vtt-token-menu-header">
            <i class="fa-solid fa-users"></i> ${e.length} Tokens Selected
        </div>
        <div class="vtt-token-menu-item" id="menu-ctx-splash-art">
            <span><i class="fa-solid fa-expand item-icon"></i> Splash Art (${e.length})</span>
            <span style="font-size: 0.7rem; opacity: 0.7; font-family: monospace; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; margin-left: auto;">Shift+X</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-apply-damage">
            <span><i class="fa-solid fa-heart-crack item-icon"></i> Apply Damage</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-roll-init">
            <span><i class="fa-solid fa-swords item-icon"></i> Roll Initiative for All (Individual)</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-roll-group-init">
            <span><i class="fa-solid fa-users-rays item-icon"></i> Roll Group Initiative (By Name)</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
    `;S+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-arrows-to-eye item-icon"></i> Ability Checks</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `,L.forEach(l=>{S+=`
            <div class="vtt-submenu-item menu-roll-ability" data-ability="${l.key}" data-label="${l.label}">
                <span>${l.label}</span>
            </div>
        `}),S+=`
                </div>
            </div>
        </div>
    `,S+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-shield-halved item-icon"></i> Saving Throws</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `,L.forEach(l=>{S+=`
            <div class="vtt-submenu-item menu-roll-save" data-ability="${l.key}" data-label="${l.label}">
                <span>${l.label}</span>
            </div>
        `}),S+=`
                </div>
            </div>
        </div>
    `,S+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-wand-magic-sparkles item-icon"></i> Skill Checks</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-token-submenu-list scroll-styled">
    `,b.forEach(l=>{S+=`
            <div class="vtt-submenu-item menu-roll-skill" data-skill="${l.key}" data-label="${l.label}">
                <span>${l.label}</span>
            </div>
        `}),S+=`
                </div>
            </div>
        </div>
    `;const k=x[0]?.flightHeight||0;S+=`
        <div class="vtt-token-menu-item" style="cursor: default; display: flex; justify-content: space-between; align-items: center; padding-right: 8px;">
            <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Elevation</span>
            <div style="display: flex; align-items: center; gap: 4px;">
                <button class="menu-btn-flight-dec" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                <input type="number" class="menu-input-flight" value="${k}" step="5" style="width: 40px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; text-align: center; border-radius: 4px; font-size: 12px; height: 20px; padding: 0;">
                <button class="menu-btn-flight-inc" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
        </div>
    `,S+=`
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-heart-pulse item-icon"></i> Conditions</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu">
                <div class="vtt-condition-gallery-container">
                    <div class="vtt-condition-gallery">
    `,Object.keys(le).sort().forEach(l=>{const w=le[l],D=x.every(B=>B.conditions&&B.conditions.some(R=>R.name===l));S+=`
            <button type="button" class="vtt-cond-tile menu-toggle-mass-condition${D?" is-active":""}" data-cond="${l}" title="${l}">
                <i class="fa-solid ${w}"></i>
            </button>
        `}),S+=`
                    </div>
                    <div class="vtt-cond-footer-actions">
                        <button type="button" class="vtt-cond-action-btn btn-add-custom menu-add-custom-condition">
                            <i class="fa-solid fa-plus"></i> Add Custom Condition...
                        </button>
                        <button type="button" class="vtt-cond-action-btn btn-clear-all menu-clear-all-conditions">
                            <i class="fa-solid fa-trash-can"></i> Clear All Conditions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,S+=`
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
    `,i.role==="GM"&&(S+=`
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
                <span><i class="fa-solid fa-trash item-icon"></i> Delete (${e.length} Tokens)</span>
            </div>
        `),n.innerHTML=S,document.body.appendChild(n);const N=m(),F=document.getElementById("vtt-mobile-backdrop");N&&(n.classList.add("mobile-modal-mode"),F&&F.classList.add("active"));const X=()=>{F&&(F.classList.remove("active"),F.removeEventListener("click",X),F.removeEventListener("touchend",X))};N&&F&&(F.addEventListener("click",X),F.addEventListener("touchend",X));const Y=n.remove.bind(n);if(n.remove=function(){X(),Y()},N)n.style.left="50%",n.style.top="50%",n.style.transform="translate(-50%, -50%)";else{const w=window.innerWidth,D=window.innerHeight,B=n.offsetWidth||n.getBoundingClientRect().width||200,R=n.offsetHeight||n.getBoundingClientRect().height||350,M=Math.max(160,D-24);n.style.maxHeight=`${M}px`,(n.scrollHeight>M||R>M)&&(n.style.overflowY="auto",n.style.overflowX="hidden");let f=y,U=u;y+B>w-12&&(f=Math.max(12,w-B-12)),u+R>D-12&&(U=Math.max(12,D-R-12)),f=Math.max(12,f),U=Math.max(12,U),n.style.left=`${f}px`,n.style.top=`${U}px`,n.querySelectorAll(".vtt-token-menu-item").forEach(P=>{const A=P.querySelector(".vtt-token-submenu");A&&P.addEventListener("mouseenter",()=>{const J=P.getBoundingClientRect(),V=A.offsetWidth||200,ee=A.offsetHeight||220;J.right+V>window.innerWidth-8?A.classList.add("flip-left"):A.classList.remove("flip-left"),J.top+ee>window.innerHeight-8?A.classList.add("flip-up"):A.classList.remove("flip-up")})})}const Z=l=>{if(l.monsterData)return l.monsterData;if(l.characterId&&i.campaignState?.characters?.[l.characterId]){const w=i.campaignState.characters[l.characterId];if((w.isCompanion||w.isCustomNpc||w.monsterData)&&w.monsterData)return w.monsterData}return null},d=(l,w,D)=>{if(!l.some(R=>!Z(R)&&!(R.isPlayer&&R.characterId&&i.campaignState?.characters?.[R.characterId]))){D(0);return}promptCustomModifierModal(w,R=>{D(R)})},T=n.querySelector("#menu-ctx-splash-art");T&&T.addEventListener("click",()=>{r(),n.remove()});const q=n.querySelector("#menu-apply-damage");q&&q.addEventListener("click",()=>{showApplyDamageModal(e,s),n.remove()}),n.querySelector("#menu-roll-init")?.addEventListener("click",l=>{d(x,"Initiative",w=>{x.forEach(D=>{let B="",R=10;const M=Z(D);if(M){R=M.dex||10;let A=Math.floor((R-10)/2);M.initiative!==void 0&&(typeof M.initiative=="number"?A=M.initiative:typeof M.initiative?.bonus=="number"&&(A=M.initiative.bonus)),B=`1d20${A>=0?"+":""}${A}`}else if(D.isPlayer&&D.characterId&&i.campaignState?.characters?.[D.characterId]){const A=i.campaignState.characters[D.characterId];if(A.isCustomNpc||A.monsterData){R=A.monsterData?.dex||10;let J=Math.floor((R-10)/2);A.monsterData?.initiative!==void 0&&(typeof A.monsterData.initiative=="number"?J=A.monsterData.initiative:typeof A.monsterData.initiative?.bonus=="number"&&(J=A.monsterData.initiative.bonus)),B=`1d20${J>=0?"+":""}${J}`}else R=A.stats?.dex||10,B=ie(A,"initiative")}else{let A=w;B=`1d20${A>=0?"+":""}${A}`}let f=0;v.initDexTiebreaker!==!1&&(f=Math.round(R)/100);const U=`${D.name}: Initiative`,P=se(B,U,D.id,f,{vtt:i,optEvent:l});typeof window<"u"&&window.VTT?.chatEngine&&window.VTT.chatEngine.addToInitiative(D.name,P,D.id)})}),n.remove()}),n.querySelector("#menu-roll-group-init")?.addEventListener("click",l=>{d(x,"Group Initiative",w=>{const D={};x.forEach(M=>{const f=(M.name||"Token").trim();D[f]||(D[f]=[]),D[f].push(M)});const B=Object.values(D).some(M=>M.length>6),R=(M={})=>{Object.entries(D).forEach(([f,U])=>{const P=U.length;let A=1;if(typeof M=="object"&&M!==null)if(M.mode==="size")A=Math.max(1,Math.ceil(P/(M.value||5)));else if(M.mode==="count")A=Math.max(1,Math.min(P,M.value||2));else if(M[f]!==void 0){const V=M[f];typeof V=="object"&&V!==null?V.mode==="size"?A=Math.max(1,Math.ceil(P/(V.value||5))):V.mode==="count"?A=Math.max(1,Math.min(P,V.value||2)):A=Math.max(1,Math.min(P,parseInt(V.value)||1)):A=Math.max(1,Math.min(P,parseInt(V)||1))}else P>6&&(A=2);else typeof M=="number"?A=Math.max(1,Math.min(P,M)):P>6&&(A=2);const J=V=>{let ee="",te=10;const Q=Z(V);if(Q){te=Q.dex||10;let K=Math.floor((te-10)/2);Q.initiative!==void 0&&(typeof Q.initiative=="number"?K=Q.initiative:typeof Q.initiative?.bonus=="number"&&(K=Q.initiative.bonus)),ee=`1d20${K>=0?"+":""}${K}`}else if(V.isPlayer&&V.characterId&&i.campaignState?.characters?.[V.characterId]){const K=i.campaignState.characters[V.characterId];if(K.isCustomNpc||K.monsterData){te=K.monsterData?.dex||10;let ne=Math.floor((te-10)/2);K.monsterData?.initiative!==void 0&&(typeof K.monsterData.initiative=="number"?ne=K.monsterData.initiative:typeof K.monsterData.initiative?.bonus=="number"&&(ne=K.monsterData.initiative.bonus)),ee=`1d20${ne>=0?"+":""}${ne}`}else te=K.stats?.dex||10,ee=ie(K,"initiative")}else ee=`1d20${w>=0?"+":""}${w}`;let ae=0;return v.initDexTiebreaker!==!1&&(ae=Math.round(te)/100),{formula:ee,dexTiebreaker:ae}};if(A<=1||P<=1){const V=U[0],{formula:ee,dexTiebreaker:te}=J(V),Q=`${f}: Group Initiative`,ae=se(ee,Q,V.id,te,{vtt:i,optEvent:l});typeof window<"u"&&window.VTT?.chatEngine&&window.VTT.chatEngine.addToInitiative(f,ae,V.id,V.img,U.map(K=>K.id))}else clusterTokensByProximity(U,A).forEach((ee,te)=>{if(ee.length===0)return;const Q=ee[0],{formula:ae,dexTiebreaker:K}=J(Q),ne=`${f} (Squad ${te+1}): Initiative`,ue=se(ae,ne,Q.id,K,{vtt:i,optEvent:l});typeof window<"u"&&window.VTT?.chatEngine&&window.VTT.chatEngine.addToInitiative(`${f} (Squad ${te+1})`,ue,Q.id,Q.img,ee.map(me=>me.id))})})};B?promptQuickSplitModal(D,x,M=>{const f={};Object.entries(D).forEach(([U,P])=>{P.length>6&&(f[U]=M)}),R(f)}):R()}),n.remove()}),n.querySelectorAll(".menu-roll-ability").forEach(l=>{l.addEventListener("click",w=>{const D=l.dataset.ability,B=l.dataset.label;d(x,`${B} Check`,R=>{x.forEach(M=>{let f="";const U=Z(M);if(U){const A=U[D]||10;let J=Math.floor((A-10)/2);f=`1d20${J>=0?"+":""}${J}`}else if(M.isPlayer&&M.characterId&&i.campaignState?.characters?.[M.characterId]){const A=i.campaignState.characters[M.characterId];f=ie(A,"ability",D)}else f=`1d20${R>=0?"+":""}${R}`;const P=`${M.name}: ${B.toUpperCase()} Check`;se(f,P,M.id,0,{vtt:i,optEvent:w})})}),n.remove()})}),n.querySelectorAll(".menu-roll-save").forEach(l=>{l.addEventListener("click",w=>{const D=l.dataset.ability,B=l.dataset.label;d(x,`${B} Save`,R=>{x.forEach(M=>{let f="";const U=Z(M);if(U){const A=U[D]||10;let J=Math.floor((A-10)/2);U.save&&U.save[D]!==void 0&&(J=parseInt(U.save[D])),f=`1d20${J>=0?"+":""}${J}`}else if(M.isPlayer&&M.characterId&&i.campaignState?.characters?.[M.characterId]){const A=i.campaignState.characters[M.characterId];f=ie(A,"save",D)}else f=`1d20${R>=0?"+":""}${R}`;const P=`${M.name}: ${B.toUpperCase()} Saving Throw`;se(f,P,M.id,0,{vtt:i,optEvent:w})})}),n.remove()})}),n.querySelectorAll(".menu-roll-skill").forEach(l=>{l.addEventListener("click",w=>{const D=l.dataset.skill,B=l.dataset.label;d(x,`${B} Check`,R=>{const M=b.find(f=>f.key===D);x.forEach(f=>{let U="";const P=Z(f);if(P){const J=P[M.ability]||10;let V=Math.floor((J-10)/2);P.skill&&P.skill[D]!==void 0&&(V=parseInt(P.skill[D])),U=`1d20${V>=0?"+":""}${V}`}else if(f.isPlayer&&f.characterId&&i.campaignState?.characters?.[f.characterId]){const J=i.campaignState.characters[f.characterId];U=ie(J,"skill",D)}else U=`1d20${R>=0?"+":""}${R}`;const A=`${f.name}: ${B} Check`;se(U,A,f.id,0,{vtt:i,optEvent:w})})}),n.remove()})});const E=()=>{typeof s.emitTokenUpdates=="function"?s.emitTokenUpdates(t):typeof window<"u"&&typeof window.emitTokenUpdates=="function"?window.emitTokenUpdates(t):i.socket&&i.socket.emit("tokens:update",{tokens:t})},C=l=>{let w=!1;x.forEach(D=>{D.flightHeight=l,w=!0}),w&&(E(),o())},$=n.querySelector(".menu-btn-flight-dec"),j=n.querySelector(".menu-btn-flight-inc"),W=n.querySelector(".menu-input-flight");$&&j&&W&&($.addEventListener("click",l=>{l.stopPropagation();let w=parseInt(W.value)||0;w-=5,W.value=w,C(w)}),j.addEventListener("click",l=>{l.stopPropagation();let w=parseInt(W.value)||0;w+=5,W.value=w,C(w)}),W.addEventListener("change",l=>{l.stopPropagation(),C(parseInt(W.value)||0)}),W.addEventListener("click",l=>l.stopPropagation())),n.querySelectorAll(".menu-toggle-mass-condition").forEach(l=>{l.addEventListener("click",w=>{w.stopPropagation();const D=l.dataset.cond,B=x.every(R=>R.conditions&&R.conditions.some(M=>M.name===D));x.forEach(R=>{R.conditions||(R.conditions=[]);const M=R.conditions.findIndex(f=>f.name===D);B?M!==-1&&R.conditions.splice(M,1):M===-1&&R.conditions.push({name:D})}),B?l.classList.remove("is-active"):l.classList.add("is-active"),E(),o()})});const G=n.querySelector(".menu-clear-all-conditions");G&&G.addEventListener("click",l=>{l.stopPropagation(),x.forEach(w=>{w.conditions=[]}),n.querySelectorAll(".menu-toggle-mass-condition").forEach(w=>w.classList.remove("is-active")),E(),o()});const H=n.querySelector(".menu-add-custom-condition");H&&H.addEventListener("click",l=>{l.stopPropagation(),n.remove(),fe(e,{tokens:t,renderAll:o})});const z=n.querySelector("#menu-flip-h");z&&z.addEventListener("click",()=>{x.forEach(l=>{l.flipX=!l.flipX}),E(),o(),n.remove()});const _=n.querySelector("#menu-flip-v");_&&_.addEventListener("click",()=>{x.forEach(l=>{l.flipY=!l.flipY}),E(),o(),n.remove()});const O=n.querySelector("#menu-reset-rotation");if(O&&O.addEventListener("click",()=>{x.forEach(l=>{l.rotation=0}),E(),o(),n.remove()}),i.role==="GM"){const l=n.querySelector("#menu-move-front");l&&l.addEventListener("click",()=>{changeMassTokenZOrder(e,"front",{vtt:i,tokens:t,renderAll:o}),n.remove()});const w=n.querySelector("#menu-move-back");w&&w.addEventListener("click",()=>{changeMassTokenZOrder(e,"back",{vtt:i,tokens:t,renderAll:o}),n.remove()}),n.querySelectorAll(".menu-ctx-move-layer").forEach(f=>{f.addEventListener("click",()=>{const U=f.dataset.layer;x.forEach(P=>{P.layer=U,window.VTT?.chatEngine?.updateCombatantLayer&&window.VTT.chatEngine.updateCombatantLayer(P.id,U)}),E(),o(),n.remove()})});const D=n.querySelector("#menu-ctx-convert-freeform");D&&D.addEventListener("click",()=>{x.forEach(f=>{const{drawW:U,drawH:P}=p(f);f.isAsset=!0,f.isBorderless=!1,f.pixelWidth=U,f.pixelHeight=P,f.imgRadius="0"}),E(),o(),n.remove()});const B=n.querySelector("#menu-ctx-convert-borderless");B&&B.addEventListener("click",()=>{x.forEach(f=>{f.isAsset=!1,f.isBorderless=!0;const U=a(f.x,f.y,!0);f.x=U.x,f.y=U.y,f.size=1,(f.assetType==="video"||f.url&&f.url.split("?")[0].toLowerCase().endsWith(".gif"))&&(f.imgRadius="50%")}),E(),o(),n.remove()});const R=n.querySelector("#menu-ctx-convert-bordered");R&&R.addEventListener("click",()=>{x.forEach(f=>{f.isAsset=!1,f.isBorderless=!1;const U=a(f.x,f.y,!0);f.x=U.x,f.y=U.y,f.size=1,(f.assetType==="video"||f.url&&f.url.split("?")[0].toLowerCase().endsWith(".gif"))&&(f.imgRadius="50%")}),E(),o(),n.remove()});const M=n.querySelector("#menu-ctx-delete");M&&M.addEventListener("click",()=>{e.forEach(f=>{delete t[f],c.delete(f)}),E(),o(),n.remove()})}}
