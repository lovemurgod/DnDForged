export const WEATHER_CATEGORIES=[{name:"Atmospheric & Storms",options:[{id:"rain",label:"\u{1F327}\uFE0F Rain (Drizzle to Downpour)"},{id:"storm",label:"\u26C8\uFE0F Thunderstorm (Rain & Lightning)"},{id:"snow",label:"\u2744\uFE0F Snow & Blizzard"},{id:"hail",label:"\u{1F9CA} Hailstorm & Ice Pellets"},{id:"fog",label:"\u{1F32B}\uFE0F Fog & Rolling Mist"},{id:"sandstorm",label:"\u{1F3DC}\uFE0F Sandstorm & Dust Haze"}]},{name:"Nature & Wilderness",options:[{id:"sunlight",label:"\u2600\uFE0F Bright Sunlight & Sunbeams"},{id:"leaves",label:"\u{1F342} Autumn Leaves & Petals"},{id:"fireflies",label:"\u{1F4A1} Night Fireflies & Will-o'-Wisps"}]},{name:"Subterranean & Hazards",options:[{id:"spores",label:"\u{1F344} Underdark Fungal Spores"},{id:"underwater",label:"\u{1FAE7} Underwater Bubbles & Spores"},{id:"embers",label:"\u{1F525} Floating Embers & Ash"},{id:"ash",label:"\u{1F30B} Volcanic Ashfall & Cinders"}]},{name:"Arcane & Planar",options:[{id:"arcane",label:"\u2728 Arcane Wisps & Leyline Motes"},{id:"aurora",label:"\u{1F30C} Aurora Borealis & Astral Ribbons"},{id:"void",label:"\u{1F311} Void Tendrils & Shadowfell Gloom"}]}],WEATHER_PRESET_OPTIONS=WEATHER_CATEGORIES.flatMap(e=>e.options);export function parseWeatherSettings(e={}){e||(e={});let n=[];Array.isArray(e.effects)?n=e.effects.map(r=>({...r,ambientWash:r.ambientWash!==!1})):e.preset&&e.preset!=="none"&&(n=[{id:"layer_0",preset:e.preset,intensity:typeof e.intensity=="number"?e.intensity:.7,speed:typeof e.speed=="number"?e.speed:1,direction:typeof e.direction=="number"?e.direction:65,zoom:typeof e.zoom=="number"?e.zoom:1,color:e.color||e.tint||"#ffffff",colorStrength:typeof e.colorStrength=="number"?e.colorStrength:typeof e.tintOpacity=="number"?e.tintOpacity:0,ambientWash:!0}]);const a=typeof e.saturation=="number"?e.saturation:100;return{effects:n,saturation:a}}export function emitWeatherUpdate(e,n={},a=!1){const{vtt:r=(typeof window<"u"?window.VTT:null)||{},currentMapId:l=null,draftOnly:d=!1}=n;if(!e.editingMapId||!r.campaignState?.maps?.[e.editingMapId])return;const o=r.campaignState.maps[e.editingMapId],t={effects:(e.currentEditingWeatherLayers||[]).map(p=>({...p})),saturation:e.currentEditingWeatherSaturation??100};l===e.editingMapId&&r.weatherEngine&&r.weatherEngine.setWeather(t),!(d||e.isDraft)&&(o.weather=t,e.weatherEmitTimer&&clearTimeout(e.weatherEmitTimer),a?r.socket&&r.socket.emit("map:edit",{mapId:e.editingMapId,updates:{weather:o.weather}}):e.weatherEmitTimer=setTimeout(()=>{r.socket&&r.socket.emit("map:edit",{mapId:e.editingMapId,updates:{weather:o.weather}})},100))}export function renderWeatherLayersUI(e,n={}){if(typeof document>"u")return;const a=e.currentEditingWeatherLayers||[],r=document.getElementById("edit-map-weather-layers-badge");r&&(r.textContent=`${a.length} / 3 Active`);const l=document.getElementById("btn-add-weather-layer"),d=document.getElementById("weather-layer-limit-note");l&&(l.disabled=a.length>=3),d&&(d.textContent=a.length>=3?"Max 3 layers reached":"Max 3 simultaneous layers");const o=document.getElementById("edit-map-weather-layers-list");if(o){if(o.innerHTML="",a.length===0){o.innerHTML=`
            <div style="text-align: center; padding: 18px 12px; color: var(--color-text-muted); font-size: 0.82rem; background: rgba(0,0,0,0.18); border: 1px dashed rgba(255,255,255,0.08); border-radius: 6px;">
                <i class="fa-solid fa-cloud-sun text-gradient-gold" style="font-size: 1.5rem; display: block; margin-bottom: 6px; opacity: 0.7;"></i>
                No active weather effects on this map.<br>Click <strong>+ Add Weather Layer</strong> to add rain, mist, storm, embers, etc.
            </div>
        `;return}a.forEach((t,p)=>{const v=WEATHER_PRESET_OPTIONS.find(s=>s.id===t.preset)||WEATHER_PRESET_OPTIONS[0],i=document.createElement("div");i.className="weather-layer-card",i.innerHTML=`
            <div class="weather-layer-header">
                <div class="weather-layer-title">
                    <i class="fa-solid fa-chevron-down weather-layer-caret"></i>
                    <span>Layer ${p+1}: <strong class="layer-title-name">${v.label.split(" ")[0]} ${v.label.split(" ")[1]||""}</strong></span>
                </div>
                <button type="button" class="btn btn-danger btn-xxs btn-delete-layer" title="Delete Weather Layer" style="padding: 2px 7px; font-size: 0.7rem;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="weather-layer-body">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.78rem;">Preset Type</label>
                    <select class="layer-preset-select" style="width: 100%; padding: 5px 8px; font-size: 0.8rem; background: var(--color-bg-card); color: var(--color-text-primary); border: 1px solid var(--color-gold-base); border-radius: 4px;">
                        ${WEATHER_CATEGORIES.map(s=>`
                            <optgroup label="${s.name}">
                                ${s.options.map(c=>`<option value="${c.id}" ${c.id===t.preset?"selected":""}>${c.label}</option>`).join("")}
                            </optgroup>
                        `).join("")}
                    </select>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Intensity:</span>
                            <span class="layer-intensity-val" style="color: var(--color-gold-light); font-weight: 600;">${Math.round(t.intensity*100)}%</span>
                        </label>
                        <input type="range" class="layer-intensity-input" min="0.1" max="1.0" step="0.05" value="${t.intensity}">
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Speed:</span>
                            <span class="layer-speed-val" style="color: var(--color-gold-light); font-weight: 600;">${t.speed.toFixed(1)}x</span>
                        </label>
                        <input type="range" class="layer-speed-input" min="0.2" max="2.5" step="0.1" value="${t.speed}">
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Particle Zoom:</span>
                            <span class="layer-zoom-val" style="color: var(--color-gold-light); font-weight: 600;">${t.zoom.toFixed(1)}x</span>
                        </label>
                        <input type="range" class="layer-zoom-input" min="0.5" max="3.0" step="0.1" value="${t.zoom}">
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Wind Angle:</span>
                            <span class="layer-direction-val" style="color: var(--color-gold-light); font-weight: 600;">${t.direction}\xB0</span>
                        </label>
                        <input type="range" class="layer-direction-input" min="0" max="360" step="5" value="${t.direction}">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label style="font-size: 0.75rem; margin-bottom: 0;">
                            Color Tint & Strength: <span class="layer-color-val" style="color: var(--color-gold-light); font-weight: 600;">${Math.round(t.colorStrength*100)}%</span>
                        </label>
                        <label class="weather-checkbox-label" title="Enable or disable the atmospheric background wash for this weather layer">
                            <input type="checkbox" class="layer-ambient-wash-input" ${t.ambientWash!==!1?"checked":""}>
                            <span>Ambient Wash</span>
                        </label>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="color" class="layer-color-input" value="${t.color||"#ffffff"}" style="width: 34px; height: 26px; padding: 1px; border: 1px solid var(--color-gold-base); border-radius: 4px; cursor: pointer;">
                        <input type="range" class="layer-color-strength-input" min="0" max="1.0" step="0.05" value="${t.colorStrength||0}" style="flex: 1;">
                    </div>
                </div>
            </div>
        `;const E=i.querySelector(".weather-layer-header"),L=i.querySelector(".btn-delete-layer");E.addEventListener("click",s=>{s.target.closest(".btn-delete-layer")||i.classList.toggle("collapsed")}),L.addEventListener("click",s=>{s.stopPropagation(),a.splice(p,1),renderWeatherLayersUI(e,n),emitWeatherUpdate(e,n,!0)});const x=i.querySelector(".layer-preset-select");x.addEventListener("change",()=>{t.preset=x.value;const s=WEATHER_PRESET_OPTIONS.find(M=>M.id===t.preset)||WEATHER_PRESET_OPTIONS[0],c=i.querySelector(".layer-title-name");c&&(c.textContent=`${s.label.split(" ")[0]} ${s.label.split(" ")[1]||""}`),emitWeatherUpdate(e,n,!0)});const u=i.querySelector(".layer-intensity-input"),$=i.querySelector(".layer-intensity-val");u.addEventListener("input",()=>{t.intensity=parseFloat(u.value),$.textContent=`${Math.round(t.intensity*100)}%`,emitWeatherUpdate(e,n,!1)}),u.addEventListener("change",()=>emitWeatherUpdate(e,n,!0));const m=i.querySelector(".layer-speed-input"),z=i.querySelector(".layer-speed-val");m.addEventListener("input",()=>{t.speed=parseFloat(m.value),z.textContent=`${t.speed.toFixed(1)}x`,emitWeatherUpdate(e,n,!1)}),m.addEventListener("change",()=>emitWeatherUpdate(e,n,!0));const f=i.querySelector(".layer-zoom-input"),I=i.querySelector(".layer-zoom-val");f.addEventListener("input",()=>{t.zoom=parseFloat(f.value),I.textContent=`${t.zoom.toFixed(1)}x`,emitWeatherUpdate(e,n,!1)}),f.addEventListener("change",()=>emitWeatherUpdate(e,n,!0));const y=i.querySelector(".layer-direction-input"),W=i.querySelector(".layer-direction-val");y.addEventListener("input",()=>{t.direction=parseInt(y.value,10),W.textContent=`${t.direction}\xB0`,emitWeatherUpdate(e,n,!1)}),y.addEventListener("change",()=>emitWeatherUpdate(e,n,!0));const g=i.querySelector(".layer-ambient-wash-input");g&&g.addEventListener("change",()=>{t.ambientWash=g.checked,emitWeatherUpdate(e,n,!0)});const b=i.querySelector(".layer-color-input");b.addEventListener("input",()=>{t.color=b.value,emitWeatherUpdate(e,n,!1)}),b.addEventListener("change",()=>emitWeatherUpdate(e,n,!0));const h=i.querySelector(".layer-color-strength-input"),A=i.querySelector(".layer-color-val");h.addEventListener("input",()=>{t.colorStrength=parseFloat(h.value),A.textContent=`${Math.round(t.colorStrength*100)}%`,emitWeatherUpdate(e,n,!1)}),h.addEventListener("change",()=>emitWeatherUpdate(e,n,!0)),o.appendChild(i)})}}export function setupWeatherControls(e,n={}){if(typeof document>"u")return;const a=document.getElementById("btn-add-weather-layer");a&&a.addEventListener("click",()=>{const l=e.currentEditingWeatherLayers||(e.currentEditingWeatherLayers=[]);if(l.length>=3)return;const d=l.map(t=>t.preset),o=WEATHER_PRESET_OPTIONS.find(t=>!d.includes(t.id))?.id||"rain";l.push({id:`layer_${Date.now()}`,preset:o,intensity:.7,speed:1,direction:65,zoom:1,color:"#ffffff",colorStrength:0,ambientWash:!0}),renderWeatherLayersUI(e,n),emitWeatherUpdate(e,n,!0)});const r=document.getElementById("edit-map-weather-saturation");r&&(r.addEventListener("input",()=>{e.currentEditingWeatherSaturation=parseInt(r.value,10);const l=document.getElementById("edit-map-weather-sat-val");l&&(l.textContent=`${e.currentEditingWeatherSaturation}%`),emitWeatherUpdate(e,n,!1)}),r.addEventListener("change",()=>emitWeatherUpdate(e,n,!0)))}
