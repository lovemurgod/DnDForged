// DnDForged Canvas Dynamic Lighting Presets & Configuration Subsystem
// Manages light source presets, beam rotations, color interpolation, and UI config panels

export const LIGHTING_PRESETS = {
    torch: {
        name: 'Torch',
        bright: 20,
        dim: 20,
        angle: 360,
        color: '#ff9d3b',
        animationType: 'flicker',
        animationSpeed: 1.2,
        animationIntensity: 0.12,
        animationColor2: '#ffe082'
    },
    lantern_hooded: {
        name: 'Hooded Lantern',
        bright: 30,
        dim: 30,
        angle: 360,
        color: '#ffe082',
        animationType: 'flicker',
        animationSpeed: 0.8,
        animationIntensity: 0.06,
        animationColor2: '#fff8e1'
    },
    lantern_bullseye: {
        name: 'Bullseye Lantern',
        bright: 60,
        dim: 60,
        angle: 60,
        color: '#fff3b0',
        animationType: 'none',
        animationSpeed: 1.0,
        animationIntensity: 0.1,
        animationColor2: '#ffffff'
    },
    candle: {
        name: 'Candle',
        bright: 5,
        dim: 5,
        angle: 360,
        color: '#ffc107',
        animationType: 'flicker',
        animationSpeed: 1.5,
        animationIntensity: 0.15,
        animationColor2: '#ffe082'
    },
    spell_light: {
        name: 'Light Spell',
        bright: 20,
        dim: 20,
        angle: 360,
        color: '#e0f7fa',
        animationType: 'pulse',
        animationSpeed: 0.6,
        animationIntensity: 0.08,
        animationColor2: '#b2ebf2'
    },
    campfire: {
        name: 'Campfire',
        bright: 30,
        dim: 30,
        angle: 360,
        color: '#ff7043',
        animationType: 'color_shift',
        animationSpeed: 1.0,
        animationIntensity: 0.14,
        animationColor2: '#ffb74d'
    },
    darkvision: {
        name: 'Darkvision (Self)',
        bright: 0,
        dim: 60,
        angle: 360,
        color: '#ffffff',
        animationType: 'none',
        animationSpeed: 1.0,
        animationIntensity: 0.1,
        animationColor2: '#ffffff'
    }
};

export function applyTokenLightingPreset(token, presetId) {
    if (!token) return;
    if (presetId === 'none' || !presetId) {
        token.lightEnabled = false;
        return;
    }
    const preset = LIGHTING_PRESETS[presetId];
    if (!preset) return;
    token.lightEnabled = true;
    token.lightBright = preset.bright;
    token.lightDim = preset.dim;
    token.lightAngle = preset.angle;
    token.lightColor = preset.color;
    token.lightAnimationType = preset.animationType;
    token.lightAnimationSpeed = preset.animationSpeed;
    token.lightAnimationIntensity = preset.animationIntensity;
    token.lightAnimationColor2 = preset.animationColor2;
}

export function applyStandaloneLightingPreset(light, presetId) {
    if (!light) return;
    const preset = LIGHTING_PRESETS[presetId];
    if (!preset) return;
    light.lightBright = preset.bright;
    light.lightDim = preset.dim;
    light.lightAngle = preset.angle;
    light.lightColor = preset.color;
    light.animationType = preset.animationType;
    light.animationSpeed = preset.animationSpeed;
    light.animationIntensity = preset.animationIntensity;
    light.animationColor2 = preset.animationColor2;
}

export function getTokenEffectiveLightFacing(token) {
    if (!token) return 0;
    const baseRot = typeof token.lightRotation === 'number' ? token.lightRotation : 0;
    const alpha = (baseRot * Math.PI) / 180;
    let vx = Math.cos(alpha);
    let vy = Math.sin(alpha);
    if (token.flipX) vx = -vx;
    if (token.flipY) vy = -vy;
    const theta = ((token.rotation || 0) * Math.PI) / 180;
    const finalVx = vx * Math.cos(theta) - vy * Math.sin(theta);
    const finalVy = vx * Math.sin(theta) + vy * Math.cos(theta);
    let deg = (Math.atan2(finalVy, finalVx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
}

export function getLocalLightFacingFromWorldAngle(token, targetDeg) {
    if (!token) return targetDeg || 0;
    const theta = ((token.rotation || 0) * Math.PI) / 180;
    const targetRad = (targetDeg * Math.PI) / 180;
    let vx = Math.cos(targetRad - theta);
    let vy = Math.sin(targetRad - theta);
    if (token.flipX) vx = -vx;
    if (token.flipY) vy = -vy;
    let localDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
    if (localDeg < 0) localDeg += 360;
    return Math.round(localDeg);
}

export function interpolateColors(c1, c2, factor) {
    const parseHex = (hex) => {
        let h = (hex || '#ffffff').replace('#', '');
        if (h.length === 3)
            h = h
                .split('')
                .map((c) => c + c)
                .join('');
        const parseChannel = (start, end) => {
            const val = parseInt(h.substring(start, end), 16);
            return Number.isNaN(val) ? 255 : val;
        };
        return {
            r: parseChannel(0, 2),
            g: parseChannel(2, 4),
            b: parseChannel(4, 6)
        };
    };
    const rgb1 = parseHex(c1);
    const rgb2 = parseHex(c2);
    const f = Math.max(0, Math.min(1, factor));
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * f);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * f);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * f);
    return `rgb(${r}, ${g}, ${b})`;
}

export function getLightAtCoord(x, y, lights = [], threshold = 14) {
    let minDistance = threshold;
    let foundLightId = null;

    lights.forEach((light) => {
        const dist = Math.hypot(x - light.x, y - light.y);
        if (dist < minDistance) {
            minDistance = dist;
            foundLightId = light.id;
        }
    });

    return foundLightId;
}

export function syncLightPanelWithLight(l) {
    if (!l || typeof document === 'undefined') return;
    const brightEl = document.getElementById('light-bright');
    const dimEl = document.getElementById('light-dim');
    const angleEl = document.getElementById('light-angle');
    const rotEl = document.getElementById('light-rotation');
    const colEl = document.getElementById('light-color');
    const fxEl = document.getElementById('light-fx');
    const speedEl = document.getElementById('light-speed');
    const intensityEl = document.getElementById('light-intensity');
    const col2El = document.getElementById('light-color2');
    const fxOptions = document.getElementById('light-fx-options');
    const col2Group = document.getElementById('light-color2-group');

    if (brightEl) brightEl.value = l.lightBright !== undefined ? l.lightBright : 20;
    if (dimEl) dimEl.value = l.lightDim !== undefined ? l.lightDim : 40;
    if (angleEl) angleEl.value = l.lightAngle !== undefined ? l.lightAngle : 360;
    if (rotEl) rotEl.value = l.lightRotation !== undefined ? l.lightRotation : 0;
    if (colEl) colEl.value = l.lightColor || '#ffaa00';

    const animType = l.animationType || 'none';
    if (fxEl) fxEl.value = animType;
    if (speedEl) speedEl.value = l.animationSpeed !== undefined ? l.animationSpeed : 1.0;
    if (intensityEl) intensityEl.value = l.animationIntensity !== undefined ? l.animationIntensity : 0.1;
    if (col2El) col2El.value = l.animationColor2 || '#ffe082';

    if (fxOptions) fxOptions.classList.toggle('vtt-hidden', animType === 'none');
    if (col2Group) col2Group.classList.toggle('vtt-hidden', animType !== 'color_shift');
}

export function setupLightingPanelControls(state = {}, callbacks = {}) {
    if (typeof document === 'undefined') return;
    const lightingPanel = document.getElementById('panel-lighting-config');
    if (!lightingPanel) return;

    const {
        lights = [],
        currentMapId = null,
        socket = null,
        renderAll = null,
        getSelectedLightId = () => null
    } = callbacks;

    const lightingBtns = lightingPanel.querySelectorAll('.lighting-btn');
    const wallOptions = document.getElementById('lighting-wall-options');
    const lightOptions = document.getElementById('lighting-light-options');

    lightingBtns.forEach((lb) => {
        lb.addEventListener('click', () => {
            const lType = lb.getAttribute('data-lighting');
            if (lType) {
                lightingBtns.forEach((b) => b.classList.remove('active'));
                lb.classList.add('active');
                if (state.currentLightingType !== undefined) state.currentLightingType = lType;

                if (lightOptions) {
                    if (lType === 'light') {
                        lightOptions.classList.remove('vtt-hidden');
                    } else {
                        lightOptions.classList.add('vtt-hidden');
                    }
                }

                if (wallOptions) {
                    if (lType === 'wall') {
                        wallOptions.classList.remove('vtt-hidden');
                    } else {
                        wallOptions.classList.add('vtt-hidden');
                    }
                }
            }
        });
    });

    const wallShapeBtns = lightingPanel.querySelectorAll('.wall-shape-btn');
    wallShapeBtns.forEach((sb) => {
        sb.addEventListener('click', () => {
            const shape = sb.getAttribute('data-shape');
            if (shape) {
                wallShapeBtns.forEach((b) => b.classList.remove('active'));
                sb.classList.add('active');
                if (state.currentWallShape !== undefined) state.currentWallShape = shape;
            }
        });
    });

    const lightPresetSelect = document.getElementById('light-preset');
    if (lightPresetSelect) {
        lightPresetSelect.addEventListener('change', () => {
            const pId = lightPresetSelect.value;
            if (pId && pId !== 'custom' && LIGHTING_PRESETS[pId]) {
                const p = LIGHTING_PRESETS[pId];
                if (document.getElementById('light-bright')) document.getElementById('light-bright').value = p.bright;
                if (document.getElementById('light-dim')) document.getElementById('light-dim').value = p.dim;
                if (document.getElementById('light-angle')) document.getElementById('light-angle').value = p.angle;
                if (document.getElementById('light-color')) document.getElementById('light-color').value = p.color;
                if (document.getElementById('light-fx'))
                    document.getElementById('light-fx').value = p.animationType || 'none';
                if (document.getElementById('light-speed'))
                    document.getElementById('light-speed').value = p.animationSpeed || 1.0;
                if (document.getElementById('light-intensity'))
                    document.getElementById('light-intensity').value = p.animationIntensity || 0.1;
                if (document.getElementById('light-color2'))
                    document.getElementById('light-color2').value = p.animationColor2 || '#ffe082';

                const fxOptions = document.getElementById('light-fx-options');
                const color2Group = document.getElementById('light-color2-group');
                if (fxOptions) fxOptions.classList.toggle('vtt-hidden', (p.animationType || 'none') === 'none');
                if (color2Group) color2Group.classList.toggle('vtt-hidden', p.animationType !== 'color_shift');

                const selectedLightId = getSelectedLightId();
                if (selectedLightId) {
                    const l = lights.find((item) => item.id === selectedLightId);
                    if (l) {
                        applyStandaloneLightingPreset(l, pId);
                        if (socket) socket.emit('lights:update', { mapId: currentMapId, lights });
                        if (renderAll) renderAll();
                    }
                }
            }
        });
    }

    const lightFxSelect = document.getElementById('light-fx');
    if (lightFxSelect) {
        lightFxSelect.addEventListener('change', () => {
            const val = lightFxSelect.value;
            const fxOptions = document.getElementById('light-fx-options');
            const color2Group = document.getElementById('light-color2-group');
            if (fxOptions) fxOptions.classList.toggle('vtt-hidden', val === 'none');
            if (color2Group) color2Group.classList.toggle('vtt-hidden', val !== 'color_shift');

            const selectedLightId = getSelectedLightId();
            if (selectedLightId) {
                const l = lights.find((item) => item.id === selectedLightId);
                if (l) {
                    l.animationType = val;
                    if (socket) socket.emit('lights:update', { mapId: currentMapId, lights });
                    if (renderAll) renderAll();
                }
            }
        });
    }

    const lightPropInputs = [
        'light-bright',
        'light-dim',
        'light-angle',
        'light-rotation',
        'light-color',
        'light-speed',
        'light-intensity',
        'light-color2'
    ];
    let lightUpdateDebounceTimer = null;
    lightPropInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const selectedLightId = getSelectedLightId();
                if (selectedLightId) {
                    const l = lights.find((item) => item.id === selectedLightId);
                    if (l) {
                        l.lightBright = parseInt(document.getElementById('light-bright')?.value) || 0;
                        l.lightDim = parseInt(document.getElementById('light-dim')?.value) || 0;
                        l.lightAngle = parseInt(document.getElementById('light-angle')?.value) || 360;
                        l.lightRotation = parseInt(document.getElementById('light-rotation')?.value) || 0;
                        l.lightColor = document.getElementById('light-color')?.value || '#ffaa00';
                        l.animationSpeed = parseFloat(document.getElementById('light-speed')?.value) || 1.0;
                        l.animationIntensity = parseFloat(document.getElementById('light-intensity')?.value) || 0.1;
                        l.animationColor2 = document.getElementById('light-color2')?.value || '#ffe082';
                        
                        if (socket) {
                            if (lightUpdateDebounceTimer) clearTimeout(lightUpdateDebounceTimer);
                            lightUpdateDebounceTimer = setTimeout(() => {
                                socket.emit('lights:update', { mapId: currentMapId, lights });
                            }, 80);
                        }
                        if (renderAll) renderAll();
                    }
                }
            });
        }
    });
}
