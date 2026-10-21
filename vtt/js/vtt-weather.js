// DnDForged Weather Effects Engine (vtt-weather.js)
// Zero-allocation, high-performance 2D Canvas multi-layer particle simulation
// Optimized for low-end mobile devices, integrated GPUs, and budget laptops.

export function initVttWeather(vtt) {
    const canvas = document.getElementById('vtt-canvas-weather');
    if (!canvas) {
        console.warn('[VttWeather] Canvas element #vtt-canvas-weather not found.');
        return null;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        console.warn('[VttWeather] Unable to get 2D context for weather canvas.');
        return null;
    }

    // Client Quality Setting ('high', 'low', 'off')
    let currentQuality = localStorage.getItem('vtt_weather_quality') || 'high';

    // Active Weather Configuration supporting up to 3 simultaneous layers
    let activeConfig = {
        effects: [],
        saturation: 100 // 0% (monochrome) to 200% (vivid)
    };

    let animFrameId = null;
    let width = 0;
    let height = 0;
    let lastTime = 0;

    // Maximum particle capacities per preset
    const PARTICLE_BUDGETS = {
        rain: { high: 180, low: 70 },
        storm: { high: 210, low: 85 },
        snow: { high: 150, low: 65 },
        hail: { high: 140, low: 60 },
        fog: { high: 45, low: 20 },
        sandstorm: { high: 160, low: 70 },
        sunlight: { high: 50, low: 25 },
        leaves: { high: 45, low: 20 },
        fireflies: { high: 40, low: 20 },
        spores: { high: 75, low: 35 },
        underwater: { high: 60, low: 25 },
        embers: { high: 80, low: 35 },
        ash: { high: 130, low: 55 },
        arcane: { high: 60, low: 28 },
        aurora: { high: 35, low: 18 },
        void: { high: 40, low: 20 }
    };

    // Splash pool for rain/storm/hail ground ripples
    const MAX_SPLASHES = 60;
    const splashes = [];
    for (let i = 0; i < MAX_SPLASHES; i++) {
        splashes.push({ active: false, x: 0, y: 0, r: 0, maxR: 12, alpha: 0, color: '#c8e1ff', isHail: false });
    }

    // Pre-allocated particle pool partitioned across up to 3 active layers
    const MAX_POOL = 400;
    const particles = [];
    for (let i = 0; i < MAX_POOL; i++) {
        particles.push({
            active: false,
            layerIdx: 0,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            size: 1,
            length: 1,
            alpha: 1,
            maxAlpha: 1,
            life: 0,
            maxLife: 100,
            rot: 0,
            vRot: 0,
            phase: Math.random() * Math.PI * 2,
            spriteIdx: 0,
            tint: '#ffffff',
            bounces: 0
        });
    }

    // Color conversion helpers
    function hexToRgba(hex, alpha) {
        if (!hex || typeof hex !== 'string') return `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        let clean = hex.replace('#', '').trim();
        if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
        const r = parseInt(clean.substring(0, 2), 16) || 255;
        const g = parseInt(clean.substring(2, 4), 16) || 255;
        const b = parseInt(clean.substring(4, 6), 16) || 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    }

    function blendColorRgb(hex1, hex2, ratio) {
        let c1 = (hex1 || '#ffffff').replace('#', '').trim();
        let c2 = (hex2 || '#ffffff').replace('#', '').trim();
        if (c1.length === 3) c1 = c1.split('').map(c => c + c).join('');
        if (c2.length === 3) c2 = c2.split('').map(c => c + c).join('');
        const r1 = parseInt(c1.substring(0, 2), 16) || 255;
        const g1 = parseInt(c1.substring(2, 4), 16) || 255;
        const b1 = parseInt(c1.substring(4, 6), 16) || 255;
        const r2 = parseInt(c2.substring(0, 2), 16) || 255;
        const g2 = parseInt(c2.substring(2, 4), 16) || 255;
        const b2 = parseInt(c2.substring(4, 6), 16) || 255;
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        return { r, g, b };
    }

    // =========================================================================
    // Pre-rendered Procedural Sprites (Cached per Layer)
    // Avoids expensive radial gradients & vector paths in each animation frame.
    // =========================================================================
    function createLayerSpriteCollection() {
        return {
            fog: [],
            snow: [],
            embers: [],
            leaves: [],
            underwater: [],
            sand: [],
            hail: [],
            sunlight: [],
            fireflies: [],
            spores: [],
            ash: [],
            arcane: [],
            void: []
        };
    }

    const spritesByLayer = [
        createLayerSpriteCollection(),
        createLayerSpriteCollection(),
        createLayerSpriteCollection()
    ];

    function createOffscreen(w, h) {
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        return off;
    }

    function initLayerSprites(layerIdx, tintColor = '#ffffff', tintStrength = 0) {
        if (layerIdx < 0 || layerIdx >= 3) return;
        const spr = spritesByLayer[layerIdx];
        spr.fog.length = 0;
        spr.snow.length = 0;
        spr.embers.length = 0;
        spr.leaves.length = 0;
        spr.underwater.length = 0;
        spr.sand.length = 0;
        spr.hail.length = 0;
        spr.sunlight.length = 0;
        spr.fireflies.length = 0;
        spr.spores.length = 0;
        spr.ash.length = 0;
        spr.arcane.length = 0;
        spr.void.length = 0;

        const effectiveStrength = Math.max(0, Math.min(1, tintStrength || 0));

        // 1. Fog / Volumetric Mist Clouds (256px and 512px for lush, dense billowing)
        [256, 512].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);

            const baseRgb = blendColorRgb('#f0f4fc', tintColor, effectiveStrength);
            const midRgb = blendColorRgb('#d8e2f0', tintColor, effectiveStrength);
            const outerRgb = blendColorRgb('#c0d0e4', tintColor, effectiveStrength);

            grad.addColorStop(0, `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.95)`);
            grad.addColorStop(0.3, `rgba(${midRgb.r}, ${midRgb.g}, ${midRgb.b}, 0.75)`);
            grad.addColorStop(0.65, `rgba(${outerRgb.r}, ${outerRgb.g}, ${outerRgb.b}, 0.35)`);
            grad.addColorStop(0.85, `rgba(${outerRgb.r}, ${outerRgb.g}, ${outerRgb.b}, 0.12)`);
            grad.addColorStop(1, `rgba(${outerRgb.r}, ${outerRgb.g}, ${outerRgb.b}, 0)`);

            cx.fillStyle = grad;
            cx.fillRect(0, 0, sz, sz);
            spr.fog.push(c);
        });

        // 2. Snow Flakes (Soft glowing circles & faceted flakes)
        [16, 28].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const sRgb = blendColorRgb('#ffffff', tintColor, effectiveStrength);

            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 1.0)`);
            grad.addColorStop(0.45, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.8)`);
            grad.addColorStop(0.8, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.25)`);
            grad.addColorStop(1, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0)`);

            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.snow.push(c);
        });

        // 3. Embers (Fiery glowing particles with incandescent cores)
        [16, 24].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);

            if (effectiveStrength > 0.15) {
                const eRgb = blendColorRgb('#ffaa44', tintColor, effectiveStrength);
                grad.addColorStop(0, `rgba(${eRgb.r}, ${eRgb.g}, ${eRgb.b}, 1.0)`);
                grad.addColorStop(0.4, `rgba(${eRgb.r}, ${eRgb.g}, ${eRgb.b}, 0.8)`);
                grad.addColorStop(1, `rgba(${eRgb.r}, ${eRgb.g}, ${eRgb.b}, 0)`);
            } else {
                if (sz === 16) {
                    grad.addColorStop(0, 'rgba(255, 255, 220, 1.0)');
                    grad.addColorStop(0.35, 'rgba(255, 170, 40, 0.85)');
                    grad.addColorStop(0.75, 'rgba(230, 60, 20, 0.35)');
                    grad.addColorStop(1, 'rgba(180, 20, 10, 0)');
                } else {
                    grad.addColorStop(0, 'rgba(255, 230, 180, 1.0)');
                    grad.addColorStop(0.3, 'rgba(255, 140, 30, 0.9)');
                    grad.addColorStop(0.7, 'rgba(200, 40, 10, 0.4)');
                    grad.addColorStop(1, 'rgba(120, 10, 5, 0)');
                }
            }
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.embers.push(c);
        });

        // 4. Autumn Leaves (Autumn colors: Crimson, Amber, Russet)
        const leafColors = ['#c0392b', '#d35400', '#f39c12', '#a04000'];
        leafColors.forEach(col => {
            const sz = 28;
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const lRgb = blendColorRgb(col, tintColor, effectiveStrength * 0.7);

            cx.fillStyle = `rgb(${lRgb.r}, ${lRgb.g}, ${lRgb.b})`;
            cx.beginPath();
            cx.moveTo(14, 2);
            cx.bezierCurveTo(24, 8, 25, 18, 14, 26);
            cx.bezierCurveTo(3, 18, 4, 8, 14, 2);
            cx.fill();
            cx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
            cx.lineWidth = 1;
            cx.beginPath();
            cx.moveTo(14, 5);
            cx.lineTo(14, 26);
            cx.stroke();
            spr.leaves.push(c);
        });

        // 5. Underwater Bubbles / Spores
        [20, 32].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const bRgb = blendColorRgb('#50b4f0', tintColor, effectiveStrength);

            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, `rgba(${bRgb.r}, ${bRgb.g}, ${bRgb.b}, 0.1)`);
            grad.addColorStop(0.7, `rgba(${bRgb.r}, ${bRgb.g}, ${bRgb.b}, 0.3)`);
            grad.addColorStop(0.92, `rgba(255, 255, 255, 0.75)`);
            grad.addColorStop(1, `rgba(${bRgb.r}, ${bRgb.g}, ${bRgb.b}, 0.1)`);

            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();

            // Specular reflection highlight
            cx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            cx.beginPath();
            cx.arc(half - sz * 0.2, half - sz * 0.2, sz * 0.12, 0, Math.PI * 2);
            cx.fill();
            spr.underwater.push(c);
        });

        // 6. Sandstorm specks (soft dusty ovals)
        [16, 24].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const dRgb = blendColorRgb('#d7af6e', tintColor, effectiveStrength);

            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, `rgba(${dRgb.r}, ${dRgb.g}, ${dRgb.b}, 0.85)`);
            grad.addColorStop(0.5, `rgba(${dRgb.r}, ${dRgb.g}, ${dRgb.b}, 0.45)`);
            grad.addColorStop(1, `rgba(${dRgb.r}, ${dRgb.g}, ${dRgb.b}, 0)`);

            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.sand.push(c);
        });

        // 7. Hail (Faceted translucent ice pellets)
        [12, 20].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const hRgb = blendColorRgb('#d8f0ff', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half * 0.7, half * 0.7, 0, half, half, half);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            grad.addColorStop(0.55, `rgba(${hRgb.r}, ${hRgb.g}, ${hRgb.b}, 0.85)`);
            grad.addColorStop(0.9, `rgba(${hRgb.r}, ${hRgb.g}, ${hRgb.b}, 0.4)`);
            grad.addColorStop(1.0, `rgba(${hRgb.r}, ${hRgb.g}, ${hRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half * 0.85, 0, Math.PI * 2);
            cx.fill();
            spr.hail.push(c);
        });

        // 8. Sunlight Dust Motes (Warm golden glow)
        [16, 24].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const sRgb = blendColorRgb('#ffe08a', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, 'rgba(255, 255, 235, 1.0)');
            grad.addColorStop(0.35, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.75)`);
            grad.addColorStop(0.75, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.2)`);
            grad.addColorStop(1, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.sunlight.push(c);
        });

        // 9. Fireflies (Bioluminescent chartreuse glowing bodies with soft radiant bloom)
        [20, 32].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const fRgb = blendColorRgb('#d4ff55', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, 'rgba(255, 255, 230, 1.0)');
            grad.addColorStop(0.25, `rgba(${fRgb.r}, ${fRgb.g}, ${fRgb.b}, 0.95)`);
            grad.addColorStop(0.65, `rgba(${fRgb.r}, ${fRgb.g}, ${fRgb.b}, 0.35)`);
            grad.addColorStop(1, `rgba(${fRgb.r}, ${fRgb.g}, ${fRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.fireflies.push(c);
        });

        // 10. Underdark Fungal Spores (Bioluminescent teal/green spore disks)
        [16, 26].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const spRgb = blendColorRgb('#45e8b2', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, 'rgba(235, 255, 245, 0.95)');
            grad.addColorStop(0.35, `rgba(${spRgb.r}, ${spRgb.g}, ${spRgb.b}, 0.8)`);
            grad.addColorStop(0.75, `rgba(${spRgb.r}, ${spRgb.g}, ${spRgb.b}, 0.25)`);
            grad.addColorStop(1, `rgba(${spRgb.r}, ${spRgb.g}, ${spRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.spores.push(c);
        });

        // 11. Volcanic Ash (Dark jagged soot flakes + incandescent micro-cinders)
        [16, 24].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const aRgb = blendColorRgb('#2e2e34', tintColor, effectiveStrength);
            cx.fillStyle = `rgba(${aRgb.r}, ${aRgb.g}, ${aRgb.b}, 0.85)`;
            cx.beginPath();
            cx.moveTo(half, 2);
            cx.lineTo(sz - 2, half * 0.7);
            cx.lineTo(sz * 0.8, sz - 2);
            cx.lineTo(half * 0.4, sz * 0.85);
            cx.lineTo(2, half);
            cx.closePath();
            cx.fill();
            spr.ash.push(c);
        });
        {
            const sz = 16;
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const cRgb = blendColorRgb('#ff5522', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, 'rgba(255, 230, 180, 1.0)');
            grad.addColorStop(0.4, `rgba(${cRgb.r}, ${cRgb.g}, ${cRgb.b}, 0.85)`);
            grad.addColorStop(1, `rgba(${cRgb.r}, ${cRgb.g}, ${cRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.ash.push(c);
        }

        // 12. Arcane Wisps (Mystic violet/cyan motes with outer shimmer aura)
        [24, 44].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const mRgb = blendColorRgb('#a855f7', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            grad.addColorStop(0.28, `rgba(${mRgb.r}, ${mRgb.g}, ${mRgb.b}, 0.85)`);
            grad.addColorStop(0.7, `rgba(${mRgb.r}, ${mRgb.g}, ${mRgb.b}, 0.25)`);
            grad.addColorStop(1, `rgba(${mRgb.r}, ${mRgb.g}, ${mRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.arcane.push(c);
        });

        // 13. Void Wisps (Feathered obsidian gloom smoke)
        [96, 160].forEach(sz => {
            const c = createOffscreen(sz, sz);
            const cx = c.getContext('2d');
            const half = sz / 2;
            const vRgb = blendColorRgb('#140c20', tintColor, effectiveStrength);
            const grad = cx.createRadialGradient(half, half, 0, half, half, half);
            grad.addColorStop(0, `rgba(${vRgb.r}, ${vRgb.g}, ${vRgb.b}, 0.85)`);
            grad.addColorStop(0.4, `rgba(${vRgb.r}, ${vRgb.g}, ${vRgb.b}, 0.5)`);
            grad.addColorStop(0.8, `rgba(${vRgb.r}, ${vRgb.g}, ${vRgb.b}, 0.15)`);
            grad.addColorStop(1, `rgba(${vRgb.r}, ${vRgb.g}, ${vRgb.b}, 0)`);
            cx.fillStyle = grad;
            cx.beginPath();
            cx.arc(half, half, half, 0, Math.PI * 2);
            cx.fill();
            spr.void.push(c);
        });
    }

    // Initialize default sprites for all 3 slots
    for (let i = 0; i < 3; i++) {
        initLayerSprites(i);
    }

    // =========================================================================
    // Thunderstorm Lightning Simulation State
    // =========================================================================
    let lightningState = {
        active: false,
        alpha: 0,
        nextTrigger: Date.now() + (10000 + Math.random() * 12000),
        step: 0,
        stepTimer: 0
    };

    function triggerLightning() {
        lightningState.active = true;
        lightningState.step = 0;
        lightningState.stepTimer = 0;
        lightningState.alpha = 0.65;
        lightningState.nextTrigger = Date.now() + (10000 + Math.random() * 15000);
    }

    function updateLightning(dt) {
        if (!lightningState.active) {
            const hasStorm = activeConfig.effects.some(e => e.preset === 'storm');
            if (hasStorm && Date.now() >= lightningState.nextTrigger) {
                triggerLightning();
            }
            return;
        }

        lightningState.stepTimer += dt;
        if (lightningState.step === 0) {
            lightningState.alpha -= dt * 6.5;
            if (lightningState.alpha <= 0.1) {
                lightningState.step = 1;
                lightningState.stepTimer = 0;
                lightningState.alpha = 0.85;
            }
        } else if (lightningState.step === 1) {
            lightningState.alpha -= dt * 4.0;
            if (lightningState.alpha <= 0.15) {
                lightningState.step = 2;
                lightningState.stepTimer = 0;
                lightningState.alpha = 0.95;
            }
        } else if (lightningState.step === 2) {
            lightningState.alpha -= dt * 3.2;
            if (lightningState.alpha <= 0) {
                lightningState.alpha = 0;
                lightningState.active = false;
            }
        }
    }

    // =========================================================================
    // Canvas Sizing (Matches 100% of Map Dimensions)
    // =========================================================================
    function resize(customW, customH) {
        let newW = customW;
        let newH = customH;

        if (!newW || !newH) {
            const parent = canvas.parentElement;
            if (parent) {
                newW = parseInt(parent.style.width, 10) || parent.clientWidth || window.innerWidth;
                newH = parseInt(parent.style.height, 10) || parent.clientHeight || window.innerHeight;
            } else {
                newW = window.innerWidth;
                newH = window.innerHeight;
            }
        }

        newW = Math.max(100, Math.floor(newW));
        newH = Math.max(100, Math.floor(newH));

        if (canvas.width !== newW || canvas.height !== newH) {
            canvas.width = newW;
            canvas.height = newH;
            canvas.style.width = `${newW}px`;
            canvas.style.height = `${newH}px`;
            width = newW;
            height = newH;
            reseedPool();
        }

        if (!animFrameId && currentQuality !== 'off' && activeConfig.effects.length > 0 && width > 0 && height > 0) {
            lastTime = 0;
            animFrameId = requestAnimationFrame(step);
        }
    }

    // =========================================================================
    // Ground Splash Spawning
    // =========================================================================
    function spawnSplash(x, y, zoomScale = 1.0, color = '#c8e1ff', isHail = false) {
        if (currentQuality === 'low' && Math.random() < 0.6) return;
        const scale = Math.max(0.5, Math.min(3.0, zoomScale));
        for (let i = 0; i < MAX_SPLASHES; i++) {
            if (!splashes[i].active) {
                splashes[i].active = true;
                splashes[i].x = x;
                splashes[i].y = y;
                splashes[i].r = isHail ? 2 * scale : 1;
                splashes[i].maxR = (isHail ? 14 + Math.random() * 8 : 8 + Math.random() * 10) * scale;
                splashes[i].alpha = isHail ? 0.9 : 0.55;
                splashes[i].color = color;
                splashes[i].isHail = !!isHail;
                break;
            }
        }
    }

    // =========================================================================
    // Dual-Border Flux Ingress Particle Spawning (Guarantees 100% Uniform Coverage)
    // Eliminates all dead zones (such as bottom-left corners) at any wind angle.
    // =========================================================================
    function initParticle(p, isInitial) {
        p.active = true;
        const layer = activeConfig.effects[p.layerIdx];
        if (!layer || !layer.preset || layer.preset === 'none') {
            p.active = false;
            return;
        }

        const preset = layer.preset;
        const rad = ((layer.direction !== undefined ? layer.direction : 65) * Math.PI) / 180;
        const speedMultiplier = Math.max(0.2, layer.speed || 1.0);
        const zoomScale = Math.max(0.5, Math.min(3.0, layer.zoom || 1.0));
        const intensityMultiplier = Math.max(0.1, Math.min(1.0, layer.intensity || 0.7));

        if (isInitial) {
            p.x = Math.random() * width;
            p.y = Math.random() * height;
        } else {
            if (preset === 'underwater' || preset === 'embers' || preset === 'arcane') {
                p.x = Math.random() * width;
                p.y = height + 10 + Math.random() * 20;
            } else if (preset === 'fireflies' || preset === 'spores') {
                p.x = Math.random() * width;
                p.y = Math.random() * height;
            } else {
                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);
                const absVx = Math.abs(cosA);
                const absVy = Math.abs(sinA);

                // Cross-sectional flux through horizontal border = |vy| * width
                // Cross-sectional flux through vertical border = |vx| * height
                const fluxH = absVy * (width + 120);
                const fluxV = absVx * (height + 120);
                const totalFlux = (fluxH + fluxV) || 1.0;
                const pHorizontal = fluxH / totalFlux;

                const margin = 40 + Math.random() * 50;

                if (Math.random() < pHorizontal) {
                    // Ingress through horizontal boundary (Top if sinA >= 0, Bottom if sinA < 0)
                    p.x = Math.random() * (width + 200) - 100;
                    p.y = sinA >= 0 ? -margin : height + margin;
                } else {
                    // Ingress through vertical boundary (Left if cosA >= 0, Right if cosA < 0)
                    p.x = cosA >= 0 ? -margin : width + margin;
                    p.y = Math.random() * (height + 200) - 100;
                }
            }
        }

        p.phase = Math.random() * Math.PI * 2;

        const sprColl = spritesByLayer[p.layerIdx] || spritesByLayer[0];

        switch (preset) {
            case 'rain': {
                const spd = (550 + Math.random() * 250) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd;
                p.size = (1.2 + Math.random() * 0.8) * zoomScale;
                p.length = (16 + Math.random() * 14) * zoomScale;
                p.maxAlpha = (0.35 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.maxLife = 9999;
                break;
            }
            case 'storm': {
                const spd = (800 + Math.random() * 350) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd;
                p.size = (1.5 + Math.random() * 1.0) * zoomScale;
                p.length = (24 + Math.random() * 20) * zoomScale;
                p.maxAlpha = (0.5 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.maxLife = 9999;
                break;
            }
            case 'snow': {
                const spd = (45 + Math.random() * 55) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd;
                p.size = (8 + Math.random() * 12) * zoomScale;
                p.maxAlpha = (0.5 + Math.random() * 0.4) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.spriteIdx = sprColl.snow.length > 0 ? Math.floor(Math.random() * sprColl.snow.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'hail': {
                const spd = (550 + Math.random() * 250) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd;
                p.size = (9 + Math.random() * 9) * zoomScale;
                p.maxAlpha = (0.75 + Math.random() * 0.25) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.bounces = 0;
                p.spriteIdx = sprColl.hail.length > 0 ? Math.floor(Math.random() * sprColl.hail.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'fog': {
                const spd = (18 + Math.random() * 24) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd * 0.4;
                p.size = (450 + Math.random() * 400) * zoomScale;
                p.maxAlpha = (0.40 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 16 + Math.random() * 14;
                p.rot = Math.random() * Math.PI * 2;
                p.vRot = (Math.random() - 0.5) * 0.06;
                p.spriteIdx = sprColl.fog.length > 0 ? Math.floor(Math.random() * sprColl.fog.length) : 0;
                break;
            }
            case 'embers': {
                const spd = (35 + Math.random() * 50) * speedMultiplier;
                p.vx = (Math.random() - 0.5) * 25;
                p.vy = -spd;
                p.size = (8 + Math.random() * 12) * zoomScale;
                p.maxAlpha = (0.65 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 4 + Math.random() * 5;
                p.spriteIdx = sprColl.embers.length > 0 ? Math.floor(Math.random() * sprColl.embers.length) : 0;
                break;
            }
            case 'leaves': {
                const spd = (50 + Math.random() * 65) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd;
                p.size = (18 + Math.random() * 14) * zoomScale;
                p.maxAlpha = (0.75 + Math.random() * 0.25) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.rot = Math.random() * Math.PI * 2;
                p.vRot = (Math.random() - 0.5) * 3.5;
                p.spriteIdx = sprColl.leaves.length > 0 ? Math.floor(Math.random() * sprColl.leaves.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'sandstorm': {
                const spd = (300 + Math.random() * 220) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd * 0.5;
                p.size = (10 + Math.random() * 12) * zoomScale;
                p.maxAlpha = (0.4 + Math.random() * 0.4) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.spriteIdx = sprColl.sand.length > 0 ? Math.floor(Math.random() * sprColl.sand.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'underwater': {
                const spd = (25 + Math.random() * 40) * speedMultiplier;
                p.vx = (Math.random() - 0.5) * 15;
                p.vy = -spd;
                p.size = (10 + Math.random() * 18) * zoomScale;
                p.maxAlpha = (0.45 + Math.random() * 0.4) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.spriteIdx = sprColl.underwater.length > 0 ? Math.floor(Math.random() * sprColl.underwater.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'sunlight': {
                const spd = (20 + Math.random() * 30) * speedMultiplier;
                p.vx = Math.cos(rad) * spd + (Math.random() - 0.5) * 12;
                p.vy = Math.sin(rad) * spd * 0.6 + (Math.random() - 0.5) * 8;
                p.size = (12 + Math.random() * 16) * zoomScale;
                p.maxAlpha = (0.45 + Math.random() * 0.45) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.spriteIdx = sprColl.sunlight.length > 0 ? Math.floor(Math.random() * sprColl.sunlight.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'fireflies': {
                const spd = (16 + Math.random() * 22) * speedMultiplier;
                p.vx = Math.cos(rad) * spd * 0.4;
                p.vy = Math.sin(rad) * spd * 0.4;
                p.size = (16 + Math.random() * 20) * zoomScale;
                p.maxAlpha = (0.75 + Math.random() * 0.25) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 7 + Math.random() * 6;
                p.spriteIdx = sprColl.fireflies.length > 0 ? Math.floor(Math.random() * sprColl.fireflies.length) : 0;
                break;
            }
            case 'spores': {
                const spd = (16 + Math.random() * 24) * speedMultiplier;
                p.vx = Math.cos(rad) * spd * 0.4 + (Math.random() - 0.5) * 10;
                p.vy = -spd * 0.5 + (Math.random() - 0.5) * 8;
                p.size = (12 + Math.random() * 16) * zoomScale;
                p.maxAlpha = (0.6 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 8 + Math.random() * 8;
                p.spriteIdx = sprColl.spores.length > 0 ? Math.floor(Math.random() * sprColl.spores.length) : 0;
                break;
            }
            case 'ash': {
                const spd = (40 + Math.random() * 55) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd;
                p.size = (10 + Math.random() * 16) * zoomScale;
                p.maxAlpha = (0.65 + Math.random() * 0.3) * intensityMultiplier;
                p.alpha = p.maxAlpha;
                p.rot = Math.random() * Math.PI * 2;
                p.vRot = (Math.random() - 0.5) * 2.2;
                p.spriteIdx = sprColl.ash.length > 0 ? Math.floor(Math.random() * sprColl.ash.length) : 0;
                p.maxLife = 9999;
                break;
            }
            case 'arcane': {
                const spd = (24 + Math.random() * 36) * speedMultiplier;
                p.vx = Math.cos(rad) * spd * 0.5 + (Math.random() - 0.5) * 16;
                p.vy = -spd;
                p.size = (18 + Math.random() * 22) * zoomScale;
                p.maxAlpha = (0.7 + Math.random() * 0.3) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 5 + Math.random() * 5;
                p.spriteIdx = sprColl.arcane.length > 0 ? Math.floor(Math.random() * sprColl.arcane.length) : 0;
                break;
            }
            case 'aurora': {
                const spd = (14 + Math.random() * 20) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = (Math.random() - 0.5) * 8;
                p.size = (50 + Math.random() * 70) * zoomScale;
                p.maxAlpha = (0.35 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 6 + Math.random() * 6;
                break;
            }
            case 'void': {
                const spd = (20 + Math.random() * 28) * speedMultiplier;
                p.vx = Math.cos(rad) * spd;
                p.vy = Math.sin(rad) * spd * 0.5;
                p.size = (130 + Math.random() * 150) * zoomScale;
                p.maxAlpha = (0.45 + Math.random() * 0.35) * intensityMultiplier;
                p.alpha = 0;
                p.life = 0;
                p.maxLife = 10 + Math.random() * 8;
                p.rot = Math.random() * Math.PI * 2;
                p.vRot = (Math.random() - 0.5) * 0.25;
                p.spriteIdx = sprColl.void.length > 0 ? Math.floor(Math.random() * sprColl.void.length) : 0;
                break;
            }
            default:
                p.active = false;
                break;
        }
    }

    // =========================================================================
    // Pool Partitioning & Reseed
    // =========================================================================
    function reseedPool() {
        const numLayers = activeConfig.effects.length;
        if (numLayers === 0 || currentQuality === 'off') {
            for (let i = 0; i < MAX_POOL; i++) particles[i].active = false;
            for (let i = 0; i < MAX_SPLASHES; i++) splashes[i].active = false;
            return;
        }

        let currentIdx = 0;
        for (let k = 0; k < numLayers; k++) {
            const layer = activeConfig.effects[k];
            const budget = PARTICLE_BUDGETS[layer.preset] || { high: 100, low: 40 };
            const base = currentQuality === 'low' ? budget.low : budget.high;
            const intensity = Math.max(0.1, Math.min(1.0, layer.intensity || 0.7));
            const multiScale = numLayers === 1 ? 1.0 : (numLayers === 2 ? 0.75 : 0.6);
            const layerBudget = Math.max(5, Math.round(base * intensity * multiScale));

            for (let i = 0; i < layerBudget && currentIdx < MAX_POOL; i++, currentIdx++) {
                const p = particles[currentIdx];
                p.layerIdx = k;
                initParticle(p, true);
            }
        }

        // Deactivate unused particles in pool
        for (let i = currentIdx; i < MAX_POOL; i++) {
            particles[i].active = false;
        }
        for (let i = 0; i < MAX_SPLASHES; i++) {
            splashes[i].active = false;
        }
    }

    // =========================================================================
    // Core Animation & Render Loop
    // =========================================================================
    function step(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
        lastTime = timestamp;

        if (currentQuality === 'off' || activeConfig.effects.length === 0 || width <= 0 || height <= 0) {
            ctx.clearRect(0, 0, width, height);
            animFrameId = null;
            return;
        }

        ctx.clearRect(0, 0, width, height);

        // Hardware-accelerated Saturation Filter
        const sat = Math.max(0, Math.min(200, Math.round(activeConfig.saturation ?? 100)));
        if (sat !== 100) {
            ctx.filter = `saturate(${sat}%)`;
        } else {
            ctx.filter = 'none';
        }

        // 1. Ambient Atmospheric Washes & Tints
        for (let k = 0; k < activeConfig.effects.length; k++) {
            const layer = activeConfig.effects[k];
            if (layer.ambientWash === false) continue;

            const intensity = Math.max(0.1, Math.min(1.0, layer.intensity || 0.7));
            let washColor = null;
            let washAlpha = 0;

            switch (layer.preset) {
                case 'rain':
                    washColor = '#24354a';
                    washAlpha = 0.12 * intensity;
                    break;
                case 'storm':
                    washColor = '#0f1726';
                    washAlpha = 0.22 * intensity;
                    break;
                case 'snow':
                    washColor = '#cce3f5';
                    washAlpha = 0.08 * intensity;
                    break;
                case 'hail':
                    washColor = '#7a96b8';
                    washAlpha = 0.14 * intensity;
                    break;
                case 'fog':
                    washColor = '#cbd7e6';
                    washAlpha = 0.18 * intensity;
                    break;
                case 'sandstorm':
                    washColor = '#b88c4a';
                    washAlpha = 0.18 * intensity;
                    break;
                case 'sunlight':
                    washColor = '#f5c862';
                    washAlpha = 0.14 * intensity;
                    break;
                case 'leaves':
                    washColor = '#a65e28';
                    washAlpha = 0.08 * intensity;
                    break;
                case 'fireflies':
                    washColor = '#0a1424';
                    washAlpha = 0.22 * intensity;
                    break;
                case 'spores':
                    washColor = '#0f382e';
                    washAlpha = 0.16 * intensity;
                    break;
                case 'underwater':
                    washColor = '#0d4775';
                    washAlpha = 0.20 * intensity;
                    break;
                case 'embers':
                    washColor = '#5e1d0c';
                    washAlpha = 0.14 * intensity;
                    break;
                case 'ash':
                    washColor = '#1c1c22';
                    washAlpha = 0.24 * intensity;
                    break;
                case 'arcane':
                    washColor = '#3c185c';
                    washAlpha = 0.16 * intensity;
                    break;
                case 'aurora':
                    washColor = '#0a1d2e';
                    washAlpha = 0.18 * intensity;
                    break;
                case 'void':
                    washColor = '#0c0617';
                    washAlpha = 0.28 * intensity;
                    break;
            }

            // Blend preset wash with layer's custom Color Tint if specified
            if (washColor) {
                if (layer.colorStrength > 0.05 && layer.color) {
                    const blended = blendColorRgb(washColor, layer.color, layer.colorStrength);
                    washColor = `rgb(${blended.r}, ${blended.g}, ${blended.b})`;
                }
                ctx.save();
                ctx.fillStyle = washColor;
                ctx.globalAlpha = Math.min(0.55, washAlpha);
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }

            // Additional custom color/tint overlay if GM configured extra strength
            if (layer.colorStrength > 0 && layer.color) {
                ctx.save();
                ctx.fillStyle = layer.color;
                ctx.globalAlpha = Math.min(0.35, layer.colorStrength * 0.25);
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
            if (layer.tintOpacity > 0 && layer.tint) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(0.85, layer.tintOpacity));
                ctx.fillStyle = layer.tint;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
        }

        // 2. Render Layers
        let hasStorm = false;
        for (let k = 0; k < activeConfig.effects.length; k++) {
            const layer = activeConfig.effects[k];
            if (layer.preset === 'storm') hasStorm = true;
            renderLayer(dt, k, layer);
        }

        // 3. Render Ground Splashes (from rain/storm/hail)
        renderSplashes(dt);

        // 4. Thunderstorm Lightning Overlay
        if (hasStorm) {
            updateLightning(dt);
            if (lightningState.alpha > 0) {
                ctx.save();
                ctx.fillStyle = `rgba(235, 245, 255, ${lightningState.alpha.toFixed(2)})`;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
        }

        ctx.filter = 'none';
        animFrameId = requestAnimationFrame(step);
    }

    function renderLayer(dt, layerIdx, layer) {
        switch (layer.preset) {
            case 'rain':
                renderRainStorm(dt, layerIdx, layer, false);
                break;
            case 'storm':
                renderRainStorm(dt, layerIdx, layer, true);
                break;
            case 'snow':
                renderSnow(dt, layerIdx, layer);
                break;
            case 'hail':
                renderHail(dt, layerIdx, layer);
                break;
            case 'fog':
                renderFog(dt, layerIdx, layer);
                break;
            case 'embers':
                renderEmbers(dt, layerIdx, layer);
                break;
            case 'leaves':
                renderLeaves(dt, layerIdx, layer);
                break;
            case 'sandstorm':
                renderSandstorm(dt, layerIdx, layer);
                break;
            case 'underwater':
                renderUnderwater(dt, layerIdx, layer);
                break;
            case 'sunlight':
                renderSunlight(dt, layerIdx, layer);
                break;
            case 'fireflies':
                renderFireflies(dt, layerIdx, layer);
                break;
            case 'spores':
                renderSpores(dt, layerIdx, layer);
                break;
            case 'ash':
                renderAsh(dt, layerIdx, layer);
                break;
            case 'arcane':
                renderArcane(dt, layerIdx, layer);
                break;
            case 'aurora':
                renderAurora(dt, layerIdx, layer);
                break;
            case 'void':
                renderVoid(dt, layerIdx, layer);
                break;
        }
    }

    // --- Rain & Storm Renderer ---
    function renderRainStorm(dt, layerIdx, layer, isStorm) {
        ctx.save();
        const baseColor = layer.colorStrength > 0.05 ? layer.color : (isStorm ? '#d7ebff' : '#c8e1ff');
        ctx.lineCap = 'round';
        ctx.beginPath();

        const zoomScale = Math.max(0.5, Math.min(3.0, layer.zoom || 1.0));

        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            const tailX = p.x - (p.vx / 500) * p.length;
            const tailY = p.y - (p.vy / 500) * p.length;

            ctx.lineWidth = p.size;
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(p.x, p.y);

            if (p.y > height + 50 || p.y < -60 || p.x > width + 120 || p.x < -120) {
                if (p.y >= height - 40 && Math.random() < 0.3) {
                    spawnSplash(p.x, height - 10 - Math.random() * 20, zoomScale, baseColor);
                }
                initParticle(p, false);
            }
        }
        ctx.strokeStyle = hexToRgba(baseColor, isStorm ? 0.75 : 0.65);
        ctx.stroke();
        ctx.restore();
    }

    // --- Ground Splashes Renderer ---
    function renderSplashes(dt) {
        ctx.save();
        for (let i = 0; i < MAX_SPLASHES; i++) {
            const s = splashes[i];
            if (!s.active) continue;
            s.r += dt * (s.isHail ? 36 : 26);
            s.alpha -= dt * (s.isHail ? 2.4 : 1.8);
            if (s.alpha <= 0 || s.r >= s.maxR) {
                s.active = false;
                continue;
            }
            ctx.strokeStyle = hexToRgba(s.color || (s.isHail ? '#eaf6ff' : '#c8e1ff'), Math.max(0, s.alpha));
            if (s.isHail) {
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(s.x - s.r, s.y);
                ctx.lineTo(s.x + s.r, s.y);
                ctx.moveTo(s.x, s.y - s.r * 0.55);
                ctx.lineTo(s.x, s.y + s.r * 0.55);
                ctx.stroke();
            } else {
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(s.x, s.y, s.r, s.r * 0.45, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // --- Snow Renderer ---
    function renderSnow(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.phase += dt * 2.2;
            const sway = Math.sin(p.phase) * 22;

            p.x += (p.vx + sway) * dt;
            p.y += p.vy * dt;

            const spr = sprColl.snow[p.spriteIdx] || sprColl.snow[0];
            if (spr) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.y > height + 50 || p.y < -60 || p.x > width + 80 || p.x < -80) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Volumetric Fog Renderer ---
    function renderFog(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.life += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vRot * dt;

            const halfLife = p.maxLife / 2;
            if (p.life < halfLife) {
                p.alpha = (p.life / halfLife) * p.maxAlpha;
            } else {
                p.alpha = Math.max(0, (1 - (p.life - halfLife) / halfLife) * p.maxAlpha);
            }

            const spr = sprColl.fog[p.spriteIdx] || sprColl.fog[0];
            if (spr && p.alpha > 0.005) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }

            if (p.life >= p.maxLife || p.x > width + p.size || p.x < -p.size || p.y > height + p.size || p.y < -p.size) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Embers Renderer ---
    function renderEmbers(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.life += dt;
            p.phase += dt * 3.5;
            p.x += (p.vx + Math.sin(p.phase) * 18) * dt;
            p.y += p.vy * dt;

            const progress = p.life / p.maxLife;
            const flicker = 0.85 + Math.sin(p.phase * 2) * 0.15;
            p.alpha = Math.max(0, (1 - progress)) * p.maxAlpha * flicker;

            const spr = sprColl.embers[p.spriteIdx] || sprColl.embers[0];
            if (spr && p.alpha > 0.01) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.life >= p.maxLife || p.y < -20 || p.y > height + 30 || p.x > width + 50 || p.x < -50) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Autumn Leaves Renderer ---
    function renderLeaves(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.phase += dt * 2.8;
            const flutter = Math.sin(p.phase) * 45;
            p.x += (p.vx + flutter) * dt;
            p.y += p.vy * dt;
            p.rot += (p.vRot + Math.cos(p.phase) * 1.5) * dt;

            const spr = sprColl.leaves[p.spriteIdx] || sprColl.leaves[0];
            if (spr) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                const scaleX = Math.cos(p.phase);
                ctx.scale(scaleX, 1);
                ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }

            if (p.y > height + 50 || p.y < -50 || p.x > width + 70 || p.x < -70) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Sandstorm Renderer ---
    function renderSandstorm(dt, layerIdx, layer) {
        ctx.save();
        ctx.fillStyle = layer.colorStrength > 0.05 ? hexToRgba(layer.color, 0.08) : 'rgba(215, 175, 110, 0.08)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            const spr = sprColl.sand[p.spriteIdx] || sprColl.sand[0];
            if (spr) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.x > width + 60 || p.y > height + 60 || p.x < -60 || p.y < -60) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Underwater Renderer ---
    function renderUnderwater(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.phase += dt * 2.0;
            const wobble = Math.sin(p.phase) * 14;
            p.x += (p.vx + wobble) * dt;
            p.y += p.vy * dt;

            const spr = sprColl.underwater[p.spriteIdx] || sprColl.underwater[0];
            if (spr) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.y < -30 || p.y > height + 40 || p.x > width + 40 || p.x < -40) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Hail Renderer ---
    function renderHail(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        const zoomScale = Math.max(0.5, Math.min(3.0, layer.zoom || 1.0));
        const baseColor = layer.colorStrength > 0.05 ? layer.color : '#e2f4ff';

        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            const spr = sprColl.hail[p.spriteIdx] || sprColl.hail[0];
            if (spr) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            // Ground impact ricochet
            if (p.y >= height - 35 && p.bounces === 0 && Math.random() < 0.35) {
                p.bounces = 1;
                spawnSplash(p.x, height - 10 - Math.random() * 20, zoomScale, baseColor, true);
            }

            if (p.y > height + 40 || p.y < -50 || p.x > width + 70 || p.x < -70) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Bright Sunlight & God Rays Renderer ---
    let sunlightPhase = 0;
    function renderSunlight(dt, layerIdx, layer) {
        sunlightPhase += dt * (layer.speed || 1.0) * 0.6;
        const rad = (layer.direction ?? 65) * (Math.PI / 180);
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const intensity = Math.max(0.1, Math.min(1.0, layer.intensity || 0.7));
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];

        // 1. Draw God Rays (angled crepuscular sunbeams)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const beamColor = layer.colorStrength > 0.05 ? layer.color : '#ffecb3';
        const numBeams = 4;
        const beamWidth = width / numBeams;

        for (let b = 0; b < numBeams; b++) {
            const beamOsc = Math.sin(sunlightPhase + b * 1.6) * 0.5 + 0.5;
            const beamAlpha = (0.04 + beamOsc * 0.08) * intensity;
            if (beamAlpha <= 0.005) continue;

            const startX = b * beamWidth * 1.2 - width * 0.1;
            const slantOffset = (height + 100) * (cosA / (Math.abs(sinA) || 0.5));

            const grad = ctx.createLinearGradient(startX, 0, startX + slantOffset * 0.5, height);
            grad.addColorStop(0, hexToRgba(beamColor, beamAlpha * 1.5));
            grad.addColorStop(0.5, hexToRgba(beamColor, beamAlpha));
            grad.addColorStop(1, hexToRgba(beamColor, 0));

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(startX, -50);
            ctx.lineTo(startX + beamWidth * 0.7, -50);
            ctx.lineTo(startX + slantOffset + beamWidth * 1.2, height + 50);
            ctx.lineTo(startX + slantOffset, height + 50);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // 2. Draw drifting illuminated golden dust motes
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.phase += dt * 1.5;
            const sway = Math.sin(p.phase) * 12;
            p.x += (p.vx + sway) * dt;
            p.y += p.vy * dt;

            const spr = sprColl.sunlight[p.spriteIdx] || sprColl.sunlight[0];
            if (spr) {
                const pulse = 0.75 + Math.sin(p.phase * 2) * 0.25;
                ctx.globalAlpha = p.alpha * pulse;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.x > width + 40 || p.x < -40 || p.y > height + 40 || p.y < -40) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Night Fireflies Renderer ---
    function renderFireflies(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.life += dt;
            p.phase += dt * 2.2;

            // Organic meandering flight
            p.x += (p.vx + Math.sin(p.phase) * 22) * dt;
            p.y += (p.vy + Math.cos(p.phase * 0.8) * 18) * dt;

            // Breathing bioluminescent pulse
            const pulse = 0.35 + 0.65 * (Math.sin(p.phase * 3.0) * 0.5 + 0.5);
            const halfLife = p.maxLife / 2;
            let envelope = 1.0;
            if (p.life < halfLife) {
                envelope = p.life / halfLife;
            } else {
                envelope = Math.max(0, 1 - (p.life - halfLife) / halfLife);
            }

            p.alpha = envelope * p.maxAlpha * pulse;

            const spr = sprColl.fireflies[p.spriteIdx] || sprColl.fireflies[0];
            if (spr && p.alpha > 0.01) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.life >= p.maxLife || p.x > width + 30 || p.x < -30 || p.y > height + 30 || p.y < -30) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Underdark Fungal Spores Renderer ---
    function renderSpores(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.life += dt;
            p.phase += dt * 1.8;

            // Buoyant brownian motion drift
            p.x += (p.vx + Math.sin(p.phase) * 16) * dt;
            p.y += (p.vy + Math.sin(p.phase * 0.7) * 10) * dt;

            const halfLife = p.maxLife / 2;
            let envelope = 1.0;
            if (p.life < halfLife) {
                envelope = p.life / halfLife;
            } else {
                envelope = Math.max(0, 1 - (p.life - halfLife) / halfLife);
            }

            const pulse = 0.7 + 0.3 * Math.sin(p.phase * 2);
            p.alpha = envelope * p.maxAlpha * pulse;

            const spr = sprColl.spores[p.spriteIdx] || sprColl.spores[0];
            if (spr && p.alpha > 0.01) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.life >= p.maxLife || p.y < -30 || p.y > height + 30 || p.x > width + 40 || p.x < -40) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Volcanic Ashfall Renderer ---
    function renderAsh(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.phase += dt * 2.4;
            const sway = Math.sin(p.phase) * 18;
            p.x += (p.vx + sway) * dt;
            p.y += p.vy * dt;
            p.rot += p.vRot * dt;

            const spr = sprColl.ash[p.spriteIdx] || sprColl.ash[0];
            if (spr) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }

            if (p.y > height + 40 || p.y < -40 || p.x > width + 60 || p.x < -60) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Arcane Wisps Renderer ---
    function renderArcane(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.life += dt;
            p.phase += dt * 2.8;

            // Oscillating orbital float
            p.x += (p.vx + Math.sin(p.phase) * 20) * dt;
            p.y += p.vy * dt;

            const halfLife = p.maxLife / 2;
            let envelope = 1.0;
            if (p.life < halfLife) {
                envelope = p.life / halfLife;
            } else {
                envelope = Math.max(0, 1 - (p.life - halfLife) / halfLife);
            }

            const shimmer = 0.8 + 0.2 * Math.sin(p.phase * 4);
            p.alpha = envelope * p.maxAlpha * shimmer;

            const spr = sprColl.arcane[p.spriteIdx] || sprColl.arcane[0];
            if (spr && p.alpha > 0.01) {
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(spr, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }

            if (p.life >= p.maxLife || p.y < -30 || p.y > height + 30 || p.x > width + 40 || p.x < -40) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Aurora Borealis & Astral Ribbons Renderer ---
    let auroraWaveTimer = 0;
    function renderAurora(dt, layerIdx, layer) {
        auroraWaveTimer += dt * (layer.speed || 1.0) * 0.75;
        const intensity = Math.max(0.1, Math.min(1.0, layer.intensity || 0.7));
        const rad = (layer.direction ?? 65) * (Math.PI / 180);
        const cosA = Math.cos(rad);

        // Undulating Northern Lights wave ribbons in upper atmosphere
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const ribbons = [
            { col: '#34f5a4', yBase: height * 0.18, amp: 45, freq: 0.003, speedMult: 1.0, alpha: 0.22 * intensity },
            { col: '#3cb6ff', yBase: height * 0.26, amp: 55, freq: 0.0025, speedMult: 1.3, alpha: 0.18 * intensity },
            { col: '#b84dff', yBase: height * 0.34, amp: 40, freq: 0.0035, speedMult: 0.8, alpha: 0.16 * intensity }
        ];

        // Override color if custom layer color is specified
        if (layer.colorStrength > 0.05 && layer.color) {
            ribbons[0].col = layer.color;
            ribbons[1].col = layer.color;
        }

        ribbons.forEach(rib => {
            ctx.beginPath();
            const stepX = 30;
            ctx.moveTo(-50, rib.yBase);

            for (let x = -50; x <= width + 50; x += stepX) {
                const wave = Math.sin(x * rib.freq + auroraWaveTimer * rib.speedMult + cosA * 2) * rib.amp;
                const wave2 = Math.cos(x * rib.freq * 1.8 - auroraWaveTimer * 0.5) * (rib.amp * 0.4);
                ctx.lineTo(x, rib.yBase + wave + wave2);
            }

            ctx.lineTo(width + 50, -50);
            ctx.lineTo(-50, -50);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, rib.yBase - rib.amp * 1.5, 0, rib.yBase + rib.amp * 2);
            grad.addColorStop(0, hexToRgba(rib.col, 0));
            grad.addColorStop(0.4, hexToRgba(rib.col, rib.alpha));
            grad.addColorStop(0.85, hexToRgba(rib.col, rib.alpha * 0.4));
            grad.addColorStop(1, hexToRgba(rib.col, 0));

            ctx.fillStyle = grad;
            ctx.fill();
        });

        ctx.restore();
    }

    // --- Void Tendrils & Shadowfell Gloom Renderer ---
    function renderVoid(dt, layerIdx, layer) {
        const sprColl = spritesByLayer[layerIdx] || spritesByLayer[0];
        for (let i = 0; i < MAX_POOL; i++) {
            const p = particles[i];
            if (!p.active || p.layerIdx !== layerIdx) continue;

            p.life += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vRot * dt;

            const halfLife = p.maxLife / 2;
            let envelope = 1.0;
            if (p.life < halfLife) {
                envelope = p.life / halfLife;
            } else {
                envelope = Math.max(0, 1 - (p.life - halfLife) / halfLife);
            }

            p.alpha = envelope * p.maxAlpha;

            const spr = sprColl.void[p.spriteIdx] || sprColl.void[0];
            if (spr && p.alpha > 0.005) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }

            if (p.life >= p.maxLife || p.x > width + p.size || p.x < -p.size || p.y > height + p.size || p.y < -p.size) {
                initParticle(p, false);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // =========================================================================
    // Public Weather Engine Controller
    // =========================================================================
    function setWeather(config) {
        lightningState.active = false;
        lightningState.alpha = 0;

        let normalizedEffects = [];
        let globalSat = 100;

        if (config) {
            if (Array.isArray(config.effects)) {
                normalizedEffects = config.effects;
            } else if (config.preset && config.preset !== 'none') {
                normalizedEffects = [{
                    id: 'layer_0',
                    preset: config.preset,
                    intensity: config.intensity,
                    speed: config.speed,
                    direction: config.direction,
                    zoom: config.zoom,
                    color: config.color,
                    colorStrength: config.colorStrength,
                    tint: config.tint,
                    tintOpacity: config.tintOpacity,
                    ambientWash: config.ambientWash !== false
                }];
            }
            if (config.saturation !== undefined) {
                const s = parseFloat(config.saturation);
                if (!isNaN(s)) globalSat = Math.max(0, Math.min(200, s));
            }
        }

        // Sanitize layers, filtering out 'none' and capping at 3 active layers
        const sanitized = [];
        for (let i = 0; i < normalizedEffects.length && sanitized.length < 3; i++) {
            const eff = normalizedEffects[i];
            if (!eff || !eff.preset || eff.preset === 'none') continue;
            const rawIntensity = parseFloat(eff.intensity);
            const rawSpeed = parseFloat(eff.speed);
            const rawDir = parseFloat(eff.direction);
            const rawZoom = parseFloat(eff.zoom);
            const rawColorStr = parseFloat(eff.colorStrength);
            const rawTintOp = parseFloat(eff.tintOpacity);

            sanitized.push({
                id: eff.id || `layer_${sanitized.length}`,
                preset: eff.preset,
                intensity: !isNaN(rawIntensity) ? Math.max(0.05, Math.min(1.0, rawIntensity)) : 0.7,
                speed: !isNaN(rawSpeed) ? Math.max(0.1, Math.min(3.0, rawSpeed)) : 1.0,
                direction: !isNaN(rawDir) ? rawDir : 65,
                zoom: !isNaN(rawZoom) ? Math.max(0.5, Math.min(3.0, rawZoom)) : 1.0,
                color: (typeof eff.color === 'string' && eff.color.trim()) ? eff.color : (eff.tint || '#ffffff'),
                colorStrength: !isNaN(rawColorStr) ? Math.max(0.0, Math.min(1.0, rawColorStr)) : (rawTintOp || 0.0),
                tint: (typeof eff.tint === 'string' && eff.tint.trim()) ? eff.tint : '#000000',
                tintOpacity: !isNaN(rawTintOp) ? Math.max(0.0, Math.min(0.85, rawTintOp)) : 0.0,
                ambientWash: eff.ambientWash !== false
            });
        }

        activeConfig = {
            effects: sanitized,
            saturation: globalSat
        };

        // Re-generate tinted procedural sprites for each active layer
        for (let k = 0; k < 3; k++) {
            if (k < sanitized.length) {
                initLayerSprites(k, sanitized[k].color, sanitized[k].colorStrength);
            }
        }

        reseedPool();

        if (currentQuality !== 'off' && activeConfig.effects.length > 0) {
            if (!animFrameId) {
                lastTime = 0;
                animFrameId = requestAnimationFrame(step);
            }
        } else {
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
            ctx.clearRect(0, 0, width, height);
        }
    }

    function setQuality(quality) {
        if (quality !== 'high' && quality !== 'low' && quality !== 'off') quality = 'high';
        currentQuality = quality;
        localStorage.setItem('vtt_weather_quality', quality);
        setWeather(activeConfig);
    }

    function getQuality() {
        return currentQuality;
    }

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
        resize();
    });
    if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', () => resize());
    resize();

    // Initial check
    if (currentQuality !== 'off' && activeConfig.effects.length > 0) {
        reseedPool();
        animFrameId = requestAnimationFrame(step);
    }

    return {
        setWeather,
        setQuality,
        getQuality,
        resize,
        destroy: () => {
            if (animFrameId) cancelAnimationFrame(animFrameId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', resize);
        }
    };
}
