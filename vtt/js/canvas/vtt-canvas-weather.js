// DnDForged Canvas Weather Presets, Particle Layers & UI Configuration
// Handles weather preset definitions, layer composition, and live atmospheric updates

export const WEATHER_CATEGORIES = [
    {
        name: 'Atmospheric & Storms',
        options: [
            { id: 'rain', label: '🌧️ Rain (Drizzle to Downpour)' },
            { id: 'storm', label: '⛈️ Thunderstorm (Rain & Lightning)' },
            { id: 'snow', label: '❄️ Snow & Blizzard' },
            { id: 'hail', label: '🧊 Hailstorm & Ice Pellets' },
            { id: 'fog', label: '🌫️ Fog & Rolling Mist' },
            { id: 'sandstorm', label: '🏜️ Sandstorm & Dust Haze' }
        ]
    },
    {
        name: 'Nature & Wilderness',
        options: [
            { id: 'sunlight', label: '☀️ Bright Sunlight & Sunbeams' },
            { id: 'leaves', label: '🍂 Autumn Leaves & Petals' },
            { id: 'fireflies', label: "💡 Night Fireflies & Will-o'-Wisps" }
        ]
    },
    {
        name: 'Subterranean & Hazards',
        options: [
            { id: 'spores', label: '🍄 Underdark Fungal Spores' },
            { id: 'underwater', label: '🫧 Underwater Bubbles & Spores' },
            { id: 'embers', label: '🔥 Floating Embers & Ash' },
            { id: 'ash', label: '🌋 Volcanic Ashfall & Cinders' }
        ]
    },
    {
        name: 'Arcane & Planar',
        options: [
            { id: 'arcane', label: '✨ Arcane Wisps & Leyline Motes' },
            { id: 'aurora', label: '🌌 Aurora Borealis & Astral Ribbons' },
            { id: 'void', label: '🌑 Void Tendrils & Shadowfell Gloom' }
        ]
    }
];

export const WEATHER_PRESET_OPTIONS = WEATHER_CATEGORIES.flatMap((c) => c.options);

export function parseWeatherSettings(ws = {}) {
    if (!ws) ws = {};
    let initialEffects = [];
    if (Array.isArray(ws.effects)) {
        initialEffects = ws.effects.map((e) => ({
            ...e,
            ambientWash: e.ambientWash !== false
        }));
    } else if (ws.preset && ws.preset !== 'none') {
        initialEffects = [
            {
                id: 'layer_0',
                preset: ws.preset,
                intensity: typeof ws.intensity === 'number' ? ws.intensity : 0.7,
                speed: typeof ws.speed === 'number' ? ws.speed : 1.0,
                direction: typeof ws.direction === 'number' ? ws.direction : 65,
                zoom: typeof ws.zoom === 'number' ? ws.zoom : 1.0,
                color: ws.color || ws.tint || '#ffffff',
                colorStrength:
                    typeof ws.colorStrength === 'number'
                        ? ws.colorStrength
                        : typeof ws.tintOpacity === 'number'
                          ? ws.tintOpacity
                          : 0.0,
                ambientWash: true
            }
        ];
    }
    const saturation = typeof ws.saturation === 'number' ? ws.saturation : 100;
    return { effects: initialEffects, saturation };
}

export function emitWeatherUpdate(weatherState, options = {}, immediate = false) {
    const { vtt = (typeof window !== 'undefined' ? window.VTT : null) || {}, currentMapId = null } = options;

    if (!weatherState.editingMapId || !vtt.campaignState?.maps?.[weatherState.editingMapId]) return;
    const map = vtt.campaignState.maps[weatherState.editingMapId];

    map.weather = {
        effects: (weatherState.currentEditingWeatherLayers || []).map((l) => ({ ...l })),
        saturation: weatherState.currentEditingWeatherSaturation ?? 100
    };

    // Update local weather immediately for instant, smooth visual response
    if (currentMapId === weatherState.editingMapId && vtt.weatherEngine) {
        vtt.weatherEngine.setWeather(map.weather);
    }

    // Debounce socket emit to prevent network and disk write flooding during drag
    if (weatherState.weatherEmitTimer) clearTimeout(weatherState.weatherEmitTimer);
    if (immediate) {
        if (vtt.socket) {
            vtt.socket.emit('map:edit', { mapId: weatherState.editingMapId, updates: { weather: map.weather } });
        }
    } else {
        weatherState.weatherEmitTimer = setTimeout(() => {
            if (vtt.socket) {
                vtt.socket.emit('map:edit', { mapId: weatherState.editingMapId, updates: { weather: map.weather } });
            }
        }, 100);
    }
}

export function renderWeatherLayersUI(weatherState, options = {}) {
    if (typeof document === 'undefined') return;

    const layers = weatherState.currentEditingWeatherLayers || [];
    const badgeEl = document.getElementById('edit-map-weather-layers-badge');
    if (badgeEl) {
        badgeEl.textContent = `${layers.length} / 3 Active`;
    }

    const btnAdd = document.getElementById('btn-add-weather-layer');
    const noteEl = document.getElementById('weather-layer-limit-note');
    if (btnAdd) {
        btnAdd.disabled = layers.length >= 3;
    }
    if (noteEl) {
        noteEl.textContent = layers.length >= 3 ? 'Max 3 layers reached' : 'Max 3 simultaneous layers';
    }

    const listEl = document.getElementById('edit-map-weather-layers-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (layers.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 18px 12px; color: var(--color-text-muted); font-size: 0.82rem; background: rgba(0,0,0,0.18); border: 1px dashed rgba(255,255,255,0.08); border-radius: 6px;">
                <i class="fa-solid fa-cloud-sun text-gradient-gold" style="font-size: 1.5rem; display: block; margin-bottom: 6px; opacity: 0.7;"></i>
                No active weather effects on this map.<br>Click <strong>+ Add Weather Layer</strong> to add rain, mist, storm, embers, etc.
            </div>
        `;
        return;
    }

    layers.forEach((layer, idx) => {
        const opt = WEATHER_PRESET_OPTIONS.find((o) => o.id === layer.preset) || WEATHER_PRESET_OPTIONS[0];
        const card = document.createElement('div');
        card.className = 'weather-layer-card';

        card.innerHTML = `
            <div class="weather-layer-header">
                <div class="weather-layer-title">
                    <i class="fa-solid fa-chevron-down weather-layer-caret"></i>
                    <span>Layer ${idx + 1}: <strong class="layer-title-name">${opt.label.split(' ')[0]} ${opt.label.split(' ')[1] || ''}</strong></span>
                </div>
                <button type="button" class="btn btn-danger btn-xxs btn-delete-layer" title="Delete Weather Layer" style="padding: 2px 7px; font-size: 0.7rem;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="weather-layer-body">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.78rem;">Preset Type</label>
                    <select class="layer-preset-select" style="width: 100%; padding: 5px 8px; font-size: 0.8rem; background: var(--color-bg-card); color: var(--color-text-primary); border: 1px solid var(--color-gold-base); border-radius: 4px;">
                        ${WEATHER_CATEGORIES.map(
                            (cat) => `
                            <optgroup label="${cat.name}">
                                ${cat.options.map((o) => `<option value="${o.id}" ${o.id === layer.preset ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </optgroup>
                        `
                        ).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Intensity:</span>
                            <span class="layer-intensity-val" style="color: var(--color-gold-light); font-weight: 600;">${Math.round(layer.intensity * 100)}%</span>
                        </label>
                        <input type="range" class="layer-intensity-input" min="0.1" max="1.0" step="0.05" value="${layer.intensity}">
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Speed:</span>
                            <span class="layer-speed-val" style="color: var(--color-gold-light); font-weight: 600;">${layer.speed.toFixed(1)}x</span>
                        </label>
                        <input type="range" class="layer-speed-input" min="0.2" max="2.5" step="0.1" value="${layer.speed}">
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Particle Zoom:</span>
                            <span class="layer-zoom-val" style="color: var(--color-gold-light); font-weight: 600;">${layer.zoom.toFixed(1)}x</span>
                        </label>
                        <input type="range" class="layer-zoom-input" min="0.5" max="3.0" step="0.1" value="${layer.zoom}">
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                        <label style="font-size: 0.75rem; display: flex; justify-content: space-between;">
                            <span>Wind Angle:</span>
                            <span class="layer-direction-val" style="color: var(--color-gold-light); font-weight: 600;">${layer.direction}°</span>
                        </label>
                        <input type="range" class="layer-direction-input" min="0" max="360" step="5" value="${layer.direction}">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label style="font-size: 0.75rem; margin-bottom: 0;">
                            Color Tint & Strength: <span class="layer-color-val" style="color: var(--color-gold-light); font-weight: 600;">${Math.round(layer.colorStrength * 100)}%</span>
                        </label>
                        <label class="weather-checkbox-label" title="Enable or disable the atmospheric background wash for this weather layer">
                            <input type="checkbox" class="layer-ambient-wash-input" ${layer.ambientWash !== false ? 'checked' : ''}>
                            <span>Ambient Wash</span>
                        </label>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="color" class="layer-color-input" value="${layer.color || '#ffffff'}" style="width: 34px; height: 26px; padding: 1px; border: 1px solid var(--color-gold-base); border-radius: 4px; cursor: pointer;">
                        <input type="range" class="layer-color-strength-input" min="0" max="1.0" step="0.05" value="${layer.colorStrength || 0}" style="flex: 1;">
                    </div>
                </div>
            </div>
        `;

        // Wire Card Event Handlers
        const header = card.querySelector('.weather-layer-header');
        const btnDel = card.querySelector('.btn-delete-layer');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-layer')) return;
            card.classList.toggle('collapsed');
        });
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            layers.splice(idx, 1);
            renderWeatherLayersUI(weatherState, options);
            emitWeatherUpdate(weatherState, options, true);
        });

        const presetSelect = card.querySelector('.layer-preset-select');
        presetSelect.addEventListener('change', () => {
            layer.preset = presetSelect.value;
            const newOpt = WEATHER_PRESET_OPTIONS.find((o) => o.id === layer.preset) || WEATHER_PRESET_OPTIONS[0];
            const nameSpan = card.querySelector('.layer-title-name');
            if (nameSpan) nameSpan.textContent = `${newOpt.label.split(' ')[0]} ${newOpt.label.split(' ')[1] || ''}`;
            emitWeatherUpdate(weatherState, options, true);
        });

        const intensityInput = card.querySelector('.layer-intensity-input');
        const intensityVal = card.querySelector('.layer-intensity-val');
        intensityInput.addEventListener('input', () => {
            layer.intensity = parseFloat(intensityInput.value);
            intensityVal.textContent = `${Math.round(layer.intensity * 100)}%`;
            emitWeatherUpdate(weatherState, options, false);
        });
        intensityInput.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));

        const speedInput = card.querySelector('.layer-speed-input');
        const speedVal = card.querySelector('.layer-speed-val');
        speedInput.addEventListener('input', () => {
            layer.speed = parseFloat(speedInput.value);
            speedVal.textContent = `${layer.speed.toFixed(1)}x`;
            emitWeatherUpdate(weatherState, options, false);
        });
        speedInput.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));

        const zoomInput = card.querySelector('.layer-zoom-input');
        const zoomVal = card.querySelector('.layer-zoom-val');
        zoomInput.addEventListener('input', () => {
            layer.zoom = parseFloat(zoomInput.value);
            zoomVal.textContent = `${layer.zoom.toFixed(1)}x`;
            emitWeatherUpdate(weatherState, options, false);
        });
        zoomInput.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));

        const dirInput = card.querySelector('.layer-direction-input');
        const dirVal = card.querySelector('.layer-direction-val');
        dirInput.addEventListener('input', () => {
            layer.direction = parseInt(dirInput.value, 10);
            dirVal.textContent = `${layer.direction}°`;
            emitWeatherUpdate(weatherState, options, false);
        });
        dirInput.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));

        const washInput = card.querySelector('.layer-ambient-wash-input');
        if (washInput) {
            washInput.addEventListener('change', () => {
                layer.ambientWash = washInput.checked;
                emitWeatherUpdate(weatherState, options, true);
            });
        }

        const colorInput = card.querySelector('.layer-color-input');
        colorInput.addEventListener('input', () => {
            layer.color = colorInput.value;
            emitWeatherUpdate(weatherState, options, false);
        });
        colorInput.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));

        const colorStrengthInput = card.querySelector('.layer-color-strength-input');
        const colorVal = card.querySelector('.layer-color-val');
        colorStrengthInput.addEventListener('input', () => {
            layer.colorStrength = parseFloat(colorStrengthInput.value);
            colorVal.textContent = `${Math.round(layer.colorStrength * 100)}%`;
            emitWeatherUpdate(weatherState, options, false);
        });
        colorStrengthInput.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));

        listEl.appendChild(card);
    });
}

export function setupWeatherControls(weatherState, options = {}) {
    if (typeof document === 'undefined') return;

    const btnAddLayer = document.getElementById('btn-add-weather-layer');
    if (btnAddLayer) {
        btnAddLayer.addEventListener('click', () => {
            const layers = weatherState.currentEditingWeatherLayers || (weatherState.currentEditingWeatherLayers = []);
            if (layers.length >= 3) return;

            const existingPresets = layers.map((l) => l.preset);
            const nextPreset = WEATHER_PRESET_OPTIONS.find((o) => !existingPresets.includes(o.id))?.id || 'rain';

            layers.push({
                id: `layer_${Date.now()}`,
                preset: nextPreset,
                intensity: 0.7,
                speed: 1.0,
                direction: 65,
                zoom: 1.0,
                color: '#ffffff',
                colorStrength: 0.0,
                ambientWash: true
            });

            renderWeatherLayersUI(weatherState, options);
            emitWeatherUpdate(weatherState, options, true);
        });
    }

    const weatherSatEl = document.getElementById('edit-map-weather-saturation');
    if (weatherSatEl) {
        weatherSatEl.addEventListener('input', () => {
            weatherState.currentEditingWeatherSaturation = parseInt(weatherSatEl.value, 10);
            const valEl = document.getElementById('edit-map-weather-sat-val');
            if (valEl) valEl.textContent = `${weatherState.currentEditingWeatherSaturation}%`;
            emitWeatherUpdate(weatherState, options, false);
        });
        weatherSatEl.addEventListener('change', () => emitWeatherUpdate(weatherState, options, true));
    }
}
