/**
 * DnDForged 3D WebGL Dice Engine
 * High-performance Three.js physics dice simulation with order-preserving vertical lanes,
 * procedural polyhedral geometries, damage-themed materials, particle VFX, and Web Audio SFX.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Dice3D = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Settings Keys
    const STORAGE_KEY_ENABLED = 'vtt_3d_dice_enabled';
    const STORAGE_KEY_SFX = 'vtt_3d_dice_sfx';
    const STORAGE_KEY_VOLUME = 'vtt_3d_dice_volume';

    // State
    let isInitialized = false;
    let containerEl = null;
    let canvasEl = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let animFrameId = null;
    let activeDice = [];
    let activeParticles = [];
    let activeBadges = [];

    // Damage Theme Palettes
    const THEMES = {
        Fire:        { color: 0xff3d00, emissive: 0xdd2c00, roughness: 0.25, metalness: 0.1, particleColor: '#ff9100', sfx: 'fire' },
        Cold:        { color: 0x00e5ff, emissive: 0x0091ea, roughness: 0.1,  metalness: 0.7, particleColor: '#80d8ff', sfx: 'ice' },
        Lightning:   { color: 0xffd600, emissive: 0xffab00, roughness: 0.2,  metalness: 0.5, particleColor: '#ffff00', sfx: 'electric' },
        Thunder:     { color: 0x7c4dff, emissive: 0x512da8, roughness: 0.3,  metalness: 0.4, particleColor: '#b388ff', sfx: 'thunder' },
        Acid:        { color: 0x00e676, emissive: 0x00b248, roughness: 0.2,  metalness: 0.3, particleColor: '#69f0ae', sfx: 'acid' },
        Poison:      { color: 0x9c27b0, emissive: 0x6a1b9a, roughness: 0.25, metalness: 0.2, particleColor: '#e1bee7', sfx: 'poison' },
        Radiant:     { color: 0xfff176, emissive: 0xffd54f, roughness: 0.1,  metalness: 0.8, particleColor: '#fff9c4', sfx: 'radiant' },
        Necrotic:    { color: 0x37474f, emissive: 0x212121, roughness: 0.4,  metalness: 0.1, particleColor: '#90a4ae', sfx: 'necrotic' },
        Force:       { color: 0xd500f9, emissive: 0xaa00ff, roughness: 0.15, metalness: 0.6, particleColor: '#ea80fc', sfx: 'arcane' },
        Psychic:     { color: 0xff4081, emissive: 0xc51162, roughness: 0.2,  metalness: 0.3, particleColor: '#ff80ab', sfx: 'psychic' },
        Slashing:    { color: 0xb0bec5, emissive: 0x546e7a, roughness: 0.3,  metalness: 0.8, particleColor: '#cfd8dc', sfx: 'metal' },
        Piercing:    { color: 0xffb74d, emissive: 0xe65100, roughness: 0.35, metalness: 0.7, particleColor: '#ffe0b2', sfx: 'metal' },
        Bludgeoning: { color: 0x8d6e63, emissive: 0x4e342e, roughness: 0.6,  metalness: 0.2, particleColor: '#d7ccc8', sfx: 'stone' },
        Healing:     { color: 0x69f0ae, emissive: 0x00e676, roughness: 0.15, metalness: 0.5, particleColor: '#b9f6ca', sfx: 'heal' },
        // Standard Polyhedral Default Colors
        d20:         { color: 0x651fff, emissive: 0x311b92, roughness: 0.2,  metalness: 0.4, particleColor: '#b388ff' },
        d12:         { color: 0xe91e63, emissive: 0x880e4f, roughness: 0.25, metalness: 0.3, particleColor: '#f8bbd0' },
        d10:         { color: 0xff9800, emissive: 0xe65100, roughness: 0.25, metalness: 0.3, particleColor: '#ffe0b2' },
        d8:          { color: 0x00bfa5, emissive: 0x004d40, roughness: 0.2,  metalness: 0.4, particleColor: '#e0f2f1' },
        d6:          { color: 0x0288d1, emissive: 0x01579b, roughness: 0.25, metalness: 0.3, particleColor: '#b3e5fc' },
        d4:          { color: 0xd32f2f, emissive: 0xb71c1c, roughness: 0.25, metalness: 0.3, particleColor: '#ffcdd2' },
        d100:        { color: 0x00897b, emissive: 0x004d40, roughness: 0.2,  metalness: 0.4, particleColor: '#b2dfdb' },
        // Critical Hit / Miss Overrides
        Nat20:       { color: 0xffd700, emissive: 0xffb300, roughness: 0.08, metalness: 0.95, particleColor: '#fff59d', sfx: 'nat20' },
        Nat1:        { color: 0xd50000, emissive: 0x4a0000, roughness: 0.5,  metalness: 0.1, particleColor: '#ff8a80', sfx: 'nat1' }
    };

    // Web Audio Synthesizer for Zero-Dependency Authentic Dice SFX
    const AudioEngine = (function () {
        let audioCtx = null;

        function getAudioContext() {
            if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }
            return audioCtx;
        }

        function isSfxEnabled() {
            const val = localStorage.getItem(STORAGE_KEY_SFX);
            return val === null ? true : val === 'true';
        }

        function getVolume() {
            const val = localStorage.getItem(STORAGE_KEY_VOLUME);
            return val !== null ? Math.max(0, Math.min(1, parseFloat(val))) : 0.6;
        }

        function playFloorThump(intensity = 1.0) {
            if (!isSfxEnabled()) return;
            const ctx = getAudioContext();
            if (!ctx) return;

            const vol = getVolume() * Math.min(1.0, intensity);
            if (vol <= 0.001) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Low frequency impact thump
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(35, now + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(320, now);

            gain.gain.setValueAtTime(vol * 0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.1);
        }

        function playDiceClatter(intensity = 1.0) {
            if (!isSfxEnabled()) return;
            const ctx = getAudioContext();
            if (!ctx) return;

            const vol = getVolume() * Math.min(1.0, intensity);
            if (vol <= 0.001) return;

            const now = ctx.currentTime;
            const bufferSize = Math.floor(ctx.sampleRate * 0.06);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
            }

            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1800 + Math.random() * 800, now);
            filter.Q.setValueAtTime(4.0, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            noiseSource.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            noiseSource.start(now);
        }

        function playNat20Fanfare() {
            if (!isSfxEnabled()) return;
            const ctx = getAudioContext();
            if (!ctx) return;

            const vol = getVolume();
            if (vol <= 0.001) return;

            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major Arpeggio)

            notes.forEach((freq, idx) => {
                const noteTime = now + (idx * 0.07);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0, noteTime);
                gain.gain.linearRampToValueAtTime(vol * 0.3, noteTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.45);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(noteTime);
                osc.stop(noteTime + 0.5);
            });
        }

        function playNat1Fail() {
            if (!isSfxEnabled()) return;
            const ctx = getAudioContext();
            if (!ctx) return;

            const vol = getVolume();
            if (vol <= 0.001) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.linearRampToValueAtTime(70, now + 0.35);

            gain.gain.setValueAtTime(vol * 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.42);
        }

        return {
            playFloorThump,
            playDiceClatter,
            playNat20Fanfare,
            playNat1Fail
        };
    })();

    // Geometry & Texture Factory
    const GeometryFactory = (function () {
        function createD4Geometry(radius = 1.3) {
            return new THREE.TetrahedronGeometry(radius, 0);
        }

        function createD6Geometry(size = 1.7) {
            return new THREE.BoxGeometry(size, size, size);
        }

        function createD8Geometry(radius = 1.5) {
            return new THREE.OctahedronGeometry(radius, 0);
        }

        function createD10Geometry(radius = 1.5) {
            const geom = new THREE.BufferGeometry();
            const vertices = [];
            const H = radius * 1.1;
            const R = radius * 0.95;
            const rMid = radius * 0.85;

            // 10-sided pentagonal trapezohedron
            const topApex = [0, H, 0];
            const bottomApex = [0, -H, 0];
            const ring = [];

            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const y = (i % 2 === 0) ? (H * 0.15) : (-H * 0.15);
                const currentR = (i % 2 === 0) ? R : rMid;
                ring.push([Math.cos(angle) * currentR, y, Math.sin(angle) * currentR]);
            }

            for (let i = 0; i < 10; i++) {
                const next = (i + 1) % 10;
                if (i % 2 === 0) {
                    vertices.push(...topApex, ...ring[i], ...ring[next]);
                    const nextNext = (i + 2) % 10;
                    vertices.push(...bottomApex, ...ring[nextNext], ...ring[next]);
                }
            }

            geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geom.computeVertexNormals();
            return geom;
        }

        function createD12Geometry(radius = 1.4) {
            return new THREE.DodecahedronGeometry(radius, 0);
        }

        function createD20Geometry(radius = 1.55) {
            return new THREE.IcosahedronGeometry(radius, 0);
        }

        function getGeometry(faces) {
            const f = parseInt(faces, 10);
            if (f === 4) return createD4Geometry();
            if (f === 6) return createD6Geometry();
            if (f === 8) return createD8Geometry();
            if (f === 10 || f === 100) return createD10Geometry();
            if (f === 12) return createD12Geometry();
            return createD20Geometry();
        }

        return {
            getGeometry
        };
    })();

    // Initialize Global Three.js Scene and Overlay
    function init(options = {}) {
        if (isInitialized) return true;

        if (typeof THREE === 'undefined') {
            console.warn('[Dice3D] THREE is not loaded. 3D Dice will be disabled.');
            return false;
        }

        const containerId = options.containerId || 'dice-box-canvas-container';
        containerEl = document.getElementById(containerId);

        if (!containerEl) {
            containerEl = document.createElement('div');
            containerEl.id = containerId;
            document.body.appendChild(containerEl);
        }

        // Apply clean CSS overlay positioning
        containerEl.style.position = 'fixed';
        containerEl.style.top = '0';
        containerEl.style.left = '0';
        containerEl.style.width = '100vw';
        containerEl.style.height = '100vh';
        containerEl.style.pointerEvents = 'none';
        containerEl.style.zIndex = '99999';
        containerEl.style.overflow = 'hidden';

        // Scene
        scene = new THREE.Scene();

        // Camera (Perspective, wide FOV looking down at table angle)
        const aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.set(0, 0, 24);
        camera.lookAt(0, 0, 0);

        // WebGL Renderer
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        canvasEl = renderer.domElement;
        canvasEl.style.width = '100%';
        canvasEl.style.height = '100%';
        containerEl.appendChild(canvasEl);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffdf0, 1.1);
        dirLight.position.set(10, 25, 20);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x90caf9, 0.45);
        fillLight.position.set(-15, -10, 10);
        scene.add(fillLight);

        // Window resize listener
        window.addEventListener('resize', onWindowResize);

        isInitialized = true;
        startAnimationLoop();
        return true;
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function isEnabled() {
        const val = localStorage.getItem(STORAGE_KEY_ENABLED);
        return val === null ? true : val === 'true';
    }

    function setEnabled(enabled) {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(Boolean(enabled)));
    }

    function setSfxEnabled(enabled) {
        localStorage.setItem(STORAGE_KEY_SFX, String(Boolean(enabled)));
    }

    function setVolume(volume) {
        const clamped = Math.max(0, Math.min(1, parseFloat(volume) || 0));
        localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    }

    // Particle Burst System (for Nat 20 / Nat 1 / Damage effects)
    function spawnParticleBurst(x, y, z, color = '#ffd700', count = 28) {
        for (let i = 0; i < count; i++) {
            const geom = new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(color),
                transparent: true,
                opacity: 0.95
            });
            const pMesh = new THREE.Mesh(geom, mat);
            pMesh.position.set(x, y, z);

            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 6.5;
            const elevation = (Math.random() - 0.2) * 5.0;

            activeParticles.push({
                mesh: pMesh,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + elevation,
                vz: (Math.random() - 0.5) * speed,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.025
            });

            scene.add(pMesh);
        }
    }

    // 2D Billboard Banner Overlays (Nat 20 / Nat 1)
    function spawnBannerBadge(die, text, isSuccess) {
        const badge = document.createElement('div');
        badge.className = `dice3d-floating-badge ${isSuccess ? 'badge-nat20' : 'badge-nat1'} animated-pop-in`;
        badge.innerHTML = `<span>${text}</span>`;
        containerEl.appendChild(badge);

        activeBadges.push({
            el: badge,
            die: die,
            alpha: 1.0
        });
    }

    // Roll Trigger with Order-Preserving Physics Lanes
    function roll(diceList, options = {}) {
        if (!isEnabled()) return false;
        if (!isInitialized) {
            const ok = init();
            if (!ok) return false;
        }

        if (!Array.isArray(diceList) || diceList.length === 0) return false;

        const totalDice = diceList.length;

        // Calculate 3D viewport boundaries at Z = 0
        const vFOV = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
        const visibleWidth = visibleHeight * camera.aspect;

        const activeAreaWidth = Math.min(visibleWidth * 0.82, 34);
        const laneWidth = activeAreaWidth / totalDice;
        const startX = -activeAreaWidth / 2 + laneWidth / 2;
        const floorY = -visibleHeight * 0.32; // Lower third of screen

        // Initial Audio Clatter
        AudioEngine.playDiceClatter(1.0);

        diceList.forEach((dice, idx) => {
            const faces = extractFaces(dice);
            const val = extractVal(dice);
            const damageType = (dice && dice.damageType) || options.damageType || null;
            const isDropped = Boolean(dice && typeof dice === 'object' && (dice.dropped || dice.isDropped || dice.discarded));

            let critType = null;
            if (faces === 20 || (dice && typeof dice === 'object' && (dice.isCritSuccess || dice.isCritFail))) {
                if (val === 20 || (dice && typeof dice === 'object' && dice.isCritSuccess)) {
                    critType = 'Nat20';
                } else if (val === 1 || (dice && typeof dice === 'object' && dice.isCritFail)) {
                    critType = 'Nat1';
                }
            }

            // Determine Theme & Material
            let theme = THEMES.d20;
            if (critType) {
                theme = THEMES[critType];
            } else if (damageType && THEMES[damageType]) {
                theme = THEMES[damageType];
            } else if (THEMES[`d${faces}`]) {
                theme = THEMES[`d${faces}`];
            }

            const geometry = GeometryFactory.getGeometry(faces);

            // PBR Standard Material with glowing bevels & crisp metallic reflection
            const material = new THREE.MeshStandardMaterial({
                color: theme.color,
                emissive: theme.emissive,
                emissiveIntensity: critType === 'Nat20' ? 0.6 : 0.25,
                roughness: theme.roughness,
                metalness: theme.metalness,
                transparent: true,
                opacity: isDropped ? 0.45 : 1.0
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Compute Lane Boundaries to strictly preserve left-to-right order
            const laneCenter = startX + (idx * laneWidth);
            const laneHalfWidth = (laneWidth * 0.42);
            const minX = laneCenter - laneHalfWidth;
            const maxX = laneCenter + laneHalfWidth;

            // Spawn Position
            const spawnX = laneCenter + (Math.random() - 0.5) * 0.4;
            const spawnY = visibleHeight * 0.55 + Math.random() * 2.0;
            const spawnZ = (Math.random() - 0.5) * 3.0;
            mesh.position.set(spawnX, spawnY, spawnZ);

            // Random tumbling spin
            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // 2D Canvas Face Number Decal Sprite attached in center
            const numberSprite = createNumberSprite(val, critType === 'Nat20', isDropped);
            numberSprite.position.set(0, 0, 0);
            mesh.add(numberSprite);

            scene.add(mesh);

            // Physics Die Entity
            const dieEntity = {
                mesh: mesh,
                sprite: numberSprite,
                faces: faces,
                val: val,
                critType: critType,
                theme: theme,
                laneCenter: laneCenter,
                minX: minX,
                maxX: maxX,
                floorY: floorY,
                vx: (Math.random() - 0.5) * 2.2,
                vy: -(12.0 + Math.random() * 6.0),
                vz: (Math.random() - 0.5) * 3.0,
                rx: (Math.random() - 0.5) * 24.0,
                ry: (Math.random() - 0.5) * 24.0,
                rz: (Math.random() - 0.5) * 24.0,
                bounceCount: 0,
                isResting: false,
                fadeTimerStarted: false,
                fade: false,
                alpha: isDropped ? 0.45 : 1.0,
                isDone: false
            };

            activeDice.push(dieEntity);
        });

        return true;
    }

    function createNumberSprite(val, isNat20, isDropped) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 110px "Outfit", "Segoe UI", sans-serif';

        // Outer Dark Glow
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 14;
        ctx.lineJoin = 'round';
        ctx.strokeText(String(val), 128, 128);

        // Core Fill
        ctx.fillStyle = isNat20 ? '#ffd700' : '#ffffff';
        ctx.shadowColor = isNat20 ? 'rgba(255,215,0,0.9)' : 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = isNat20 ? 16 : 8;
        ctx.fillText(String(val), 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: isDropped ? 0.5 : 1.0,
            depthTest: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.2, 2.2, 1.0);
        return sprite;
    }

    function extractFaces(dice) {
        if (!dice) return 6;
        if (typeof dice === 'number') return dice;
        const raw = dice.faces ?? dice.type ?? dice.d ?? dice.numFaces ?? dice.sides ?? 6;
        if (typeof raw === 'number') return raw;
        const match = String(raw).match(/\d+/);
        return match ? parseInt(match[0], 10) : 6;
    }

    function extractVal(dice) {
        if (!dice) return 1;
        if (typeof dice === 'number') return dice;
        const raw = dice.val ?? dice.value ?? dice.v ?? dice.result ?? 1;
        if (typeof raw === 'number') return raw;
        const match = String(raw).match(/\d+/);
        return match ? parseInt(match[0], 10) : 1;
    }

    // Animation & Physics Loop
    function startAnimationLoop() {
        if (animFrameId) return;

        let lastTime = performance.now();

        function animate(now) {
            animFrameId = requestAnimationFrame(animate);

            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            updatePhysics(dt);
            updateParticles(dt);
            updateBadges();

            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        }

        animFrameId = requestAnimationFrame(animate);
    }

    function updatePhysics(dt) {
        const gravity = -38.0;

        activeDice.forEach(d => {
            if (d.isDone) return;

            if (!d.isResting) {
                // Apply Gravity & Velocity
                d.vy += gravity * dt;
                d.mesh.position.x += d.vx * dt;
                d.mesh.position.y += d.vy * dt;
                d.mesh.position.z += d.vz * dt;

                // Apply Rotational Spin
                d.mesh.rotation.x += d.rx * dt;
                d.mesh.rotation.y += d.ry * dt;
                d.mesh.rotation.z += d.rz * dt;

                // Floor Collision & Bounce
                if (d.mesh.position.y <= d.floorY) {
                    d.mesh.position.y = d.floorY;
                    d.vy = -d.vy * 0.52; // Floor restitution
                    d.vx *= 0.78; // Friction
                    d.vz *= 0.78;
                    d.rx *= 0.75;
                    d.ry *= 0.75;
                    d.rz *= 0.75;
                    d.bounceCount++;

                    // Sound impact
                    AudioEngine.playFloorThump(Math.abs(d.vy) / 10.0);

                    // Settle conditions
                    if (d.bounceCount >= 3 || Math.abs(d.vy) < 0.8) {
                        d.isResting = true;
                        d.vy = 0;
                        d.vx = 0;
                        d.vz = 0;
                        d.rx = 0;
                        d.ry = 0;
                        d.rz = 0;

                        // Trigger Critical Fanfare & VFX
                        if (d.critType === 'Nat20') {
                            AudioEngine.playNat20Fanfare();
                            spawnParticleBurst(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z, '#ffd700', 36);
                            spawnBannerBadge(d, '★ NAT 20! ★', true);
                        } else if (d.critType === 'Nat1') {
                            AudioEngine.playNat1Fail();
                            spawnParticleBurst(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z, '#ff1744', 24);
                            spawnBannerBadge(d, '⚠ NAT 1! ⚠', false);
                        }

                        // Auto fade-out timer (2.6s resting visibility)
                        if (!d.fadeTimerStarted) {
                            d.fadeTimerStarted = true;
                            setTimeout(() => { d.fade = true; }, 2600);
                        }
                    }
                }

                // Invisible Left & Right Vertical Physics Lane Barriers (Enforcing Roll Order)
                if (d.mesh.position.x <= d.minX) {
                    d.mesh.position.x = d.minX;
                    d.vx = Math.abs(d.vx) * 0.65;
                    AudioEngine.playDiceClatter(0.3);
                } else if (d.mesh.position.x >= d.maxX) {
                    d.mesh.position.x = d.maxX;
                    d.vx = -Math.abs(d.vx) * 0.65;
                    AudioEngine.playDiceClatter(0.3);
                }

                // Front & Back Screen Bounds
                if (d.mesh.position.z < -4.0) {
                    d.mesh.position.z = -4.0;
                    d.vz = Math.abs(d.vz) * 0.6;
                } else if (d.mesh.position.z > 4.0) {
                    d.mesh.position.z = 4.0;
                    d.vz = -Math.abs(d.vz) * 0.6;
                }
            } else {
                // Resting die gentle hover/pulse if critical
                if (d.critType === 'Nat20') {
                    d.mesh.position.y = d.floorY + Math.sin(Date.now() * 0.005) * 0.08;
                }
            }

            // Fadeout handling
            if (d.fade) {
                d.alpha -= dt * 1.8;
                if (d.mesh.material) {
                    d.mesh.material.opacity = Math.max(0, d.alpha);
                }
                if (d.sprite && d.sprite.material) {
                    d.sprite.material.opacity = Math.max(0, d.alpha);
                }

                if (d.alpha <= 0) {
                    d.isDone = true;
                    scene.remove(d.mesh);
                    if (d.mesh.geometry) d.mesh.geometry.dispose();
                    if (d.mesh.material) d.mesh.material.dispose();
                }
            }
        });

        // Filter out finished dice
        activeDice = activeDice.filter(d => !d.isDone);
    }

    function updateParticles(dt) {
        activeParticles.forEach(p => {
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.vy -= 9.8 * dt; // Particle gravity
            p.alpha -= p.decay;

            if (p.mesh.material) {
                p.mesh.material.opacity = Math.max(0, p.alpha);
            }

            if (p.alpha <= 0) {
                scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
            }
        });

        activeParticles = activeParticles.filter(p => p.alpha > 0);
    }

    function updateBadges() {
        if (!camera || !renderer) return;

        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;

        activeBadges.forEach(b => {
            if (!b.die || b.die.isDone || b.die.alpha <= 0) {
                b.el.remove();
                b.isDone = true;
                return;
            }

            // Project 3D coordinate to 2D screen coordinate
            const pos = b.die.mesh.position.clone();
            pos.y += 2.2; // Above the die
            pos.project(camera);

            const screenX = (pos.x * halfW) + halfW;
            const screenY = -(pos.y * halfH) + halfH;

            b.el.style.left = `${screenX}px`;
            b.el.style.top = `${screenY}px`;
            b.el.style.opacity = String(b.die.alpha);
        });

        activeBadges = activeBadges.filter(b => !b.isDone);
    }

    function clear() {
        activeDice.forEach(d => {
            scene.remove(d.mesh);
            if (d.mesh.geometry) d.mesh.geometry.dispose();
            if (d.mesh.material) d.mesh.material.dispose();
        });
        activeDice = [];

        activeParticles.forEach(p => {
            scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
        });
        activeParticles = [];

        activeBadges.forEach(b => b.el.remove());
        activeBadges = [];
    }

    return {
        init,
        roll,
        clear,
        isEnabled,
        setEnabled,
        setSfxEnabled,
        setVolume,
        THEMES
    };
}));
