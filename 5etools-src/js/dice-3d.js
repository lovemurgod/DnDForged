/**
 * DnDForged 3D WebGL Dice Engine (Refined Authentic Edition)
 * High-performance Three.js physics dice simulation with order-preserving vertical lanes,
 * authentic UV-mapped face textures on every side, smooth physical slerp settling,
 * genuine pentagonal trapezohedron d10/d100 geometries, dual-dice percentile rolling,
 * damage-themed PBR materials, particle VFX, and Web Audio SFX.
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

    // Global Scale Multiplier (15% reduction from baseline)
    const SCALE = 0.85;

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
        Fire:        { color: '#ff3d00', bg: '#2b0b02', text: '#ffffff', border: '#ff9100', emissive: 0xdd2c00, roughness: 0.25, metalness: 0.1, particleColor: '#ff9100' },
        Cold:        { color: '#00e5ff', bg: '#021e2b', text: '#ffffff', border: '#80d8ff', emissive: 0x0091ea, roughness: 0.1,  metalness: 0.7, particleColor: '#80d8ff' },
        Lightning:   { color: '#ffd600', bg: '#292200', text: '#ffffff', border: '#ffff00', emissive: 0xffab00, roughness: 0.2,  metalness: 0.5, particleColor: '#ffff00' },
        Thunder:     { color: '#7c4dff', bg: '#1c1033', text: '#ffffff', border: '#b388ff', emissive: 0x512da8, roughness: 0.3,  metalness: 0.4, particleColor: '#b388ff' },
        Acid:        { color: '#00e676', bg: '#02240f', text: '#ffffff', border: '#69f0ae', emissive: 0x00b248, roughness: 0.2,  metalness: 0.3, particleColor: '#69f0ae' },
        Poison:      { color: '#9c27b0', bg: '#23022b', text: '#ffffff', border: '#e1bee7', emissive: 0x6a1b9a, roughness: 0.25, metalness: 0.2, particleColor: '#e1bee7' },
        Radiant:     { color: '#fff176', bg: '#2e2a05', text: '#ffffff', border: '#fff9c4', emissive: 0xffd54f, roughness: 0.1,  metalness: 0.8, particleColor: '#fff9c4' },
        Necrotic:    { color: '#37474f', bg: '#121618', text: '#cfd8dc', border: '#78909c', emissive: 0x212121, roughness: 0.4,  metalness: 0.1, particleColor: '#90a4ae' },
        Force:       { color: '#d500f9', bg: '#26022e', text: '#ffffff', border: '#ea80fc', emissive: 0xaa00ff, roughness: 0.15, metalness: 0.6, particleColor: '#ea80fc' },
        Psychic:     { color: '#ff4081', bg: '#2e0514', text: '#ffffff', border: '#ff80ab', emissive: 0xc51162, roughness: 0.2,  metalness: 0.3, particleColor: '#ff80ab' },
        Slashing:    { color: '#b0bec5', bg: '#181e21', text: '#ffffff', border: '#eceff1', emissive: 0x546e7a, roughness: 0.3,  metalness: 0.8, particleColor: '#cfd8dc' },
        Piercing:    { color: '#ffb74d', bg: '#2e1c05', text: '#ffffff', border: '#ffe0b2', emissive: 0xe65100, roughness: 0.35, metalness: 0.7, particleColor: '#ffe0b2' },
        Bludgeoning: { color: '#8d6e63', bg: '#211512', text: '#ffffff', border: '#d7ccc8', emissive: 0x4e342e, roughness: 0.6,  metalness: 0.2, particleColor: '#d7ccc8' },
        Healing:     { color: '#69f0ae', bg: '#032615', text: '#ffffff', border: '#b9f6ca', emissive: 0x00e676, roughness: 0.15, metalness: 0.5, particleColor: '#b9f6ca' },
        // Standard Polyhedral Default Colors
        d20:         { color: '#651fff', bg: '#130533', text: '#ffffff', border: '#b388ff', emissive: 0x311b92, roughness: 0.2,  metalness: 0.4, particleColor: '#b388ff' },
        d12:         { color: '#e91e63', bg: '#26030f', text: '#ffffff', border: '#f8bbd0', emissive: 0x880e4f, roughness: 0.25, metalness: 0.3, particleColor: '#f8bbd0' },
        d10:         { color: '#ff9800', bg: '#2e1700', text: '#ffffff', border: '#ffe0b2', emissive: 0xe65100, roughness: 0.25, metalness: 0.3, particleColor: '#ffe0b2' },
        d8:          { color: '#00bfa5', bg: '#002621', text: '#ffffff', border: '#e0f2f1', emissive: 0x004d40, roughness: 0.2,  metalness: 0.4, particleColor: '#e0f2f1' },
        d6:          { color: '#0288d1', bg: '#011c2b', text: '#ffffff', border: '#b3e5fc', emissive: 0x01579b, roughness: 0.25, metalness: 0.3, particleColor: '#b3e5fc' },
        d4:          { color: '#d32f2f', bg: '#2e0606', text: '#ffffff', border: '#ffcdd2', emissive: 0xb71c1c, roughness: 0.25, metalness: 0.3, particleColor: '#ffcdd2' },
        d100:        { color: '#00897b', bg: '#002420', text: '#ffffff', border: '#b2dfdb', emissive: 0x004d40, roughness: 0.2,  metalness: 0.4, particleColor: '#b2dfdb' },
        // Critical Hit / Miss Overrides
        Nat20:       { color: '#ffd700', bg: '#332700', text: '#ffffff', border: '#fff59d', emissive: 0xffb300, roughness: 0.08, metalness: 0.95, particleColor: '#fff59d' },
        Nat1:        { color: '#d50000', bg: '#2b0000', text: '#ff8a80', border: '#ff5252', emissive: 0x4a0000, roughness: 0.5,  metalness: 0.1, particleColor: '#ff8a80' }
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
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

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

    // Face Texture & Material Factory
    const TextureFactory = (function () {
        const textureCache = new Map();

        function createFaceMaterial(text, theme, isCrit = false, isDropped = false) {
            const cacheKey = `${text}_${theme.color}_${isCrit}_${isDropped}`;
            if (textureCache.has(cacheKey)) {
                return textureCache.get(cacheKey);
            }

            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Rich marble / metallic base gradient
            const bgGrad = ctx.createRadialGradient(128, 128, 20, 128, 128, 140);
            bgGrad.addColorStop(0, theme.color);
            bgGrad.addColorStop(1, theme.bg);
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 256, 256);

            // Subtle gold/metallic rim border bevel
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 10;
            ctx.strokeRect(10, 10, 236, 236);

            // Inner dark inset shadow for 3D bevel depth
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 6;
            ctx.strokeRect(16, 16, 224, 224);

            // Engraved Typography
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const str = String(text);
            const fontSize = str.length > 2 ? 80 : (str.length === 2 ? 96 : 118);
            ctx.font = `900 ${fontSize}px "Outfit", "Segoe UI", sans-serif`;

            // Deep engraved drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillText(str, 128, 133);

            // Core Inked Face Text
            ctx.fillStyle = theme.text;
            if (isCrit) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 12;
            }
            ctx.fillText(str, 128, 128);

            // Underline for 6 and 9 to distinguish them
            if (str === '6' || str === '9') {
                ctx.fillStyle = theme.text;
                ctx.fillRect(96, 185, 64, 8);
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;

            const material = new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff,
                emissive: isCrit ? (theme.emissive || 0xffb300) : 0x000000,
                emissiveIntensity: isCrit ? 0.4 : 0.0,
                roughness: theme.roughness || 0.25,
                metalness: theme.metalness || 0.4,
                transparent: true,
                opacity: isDropped ? 0.45 : 1.0
            });

            textureCache.set(cacheKey, material);
            return material;
        }

        return {
            createFaceMaterial
        };
    })();

    // Polyhedral Geometries with Face Groups & Normals
    const GeometryFactory = (function () {

        // d4: 4 faces, 4 vertices (12 non-indexed vertices)
        function createD4() {
            const r = 1.3 * SCALE;
            const geom = new THREE.TetrahedronGeometry(r, 0).toNonIndexed();
            geom.computeVertexNormals();

            // 4 faces, 3 vertices each
            geom.clearGroups();
            const faceValues = [1, 2, 3, 4];
            const normals = [];

            for (let i = 0; i < 4; i++) {
                geom.addGroup(i * 3, 3, i);
                normals.push(calculateFaceNormal(geom, i * 3));
            }

            return { geometry: geom, faceValues, normals };
        }

        // d6: 6 quad faces (36 non-indexed vertices). Standard opposite pairs sum to 7:
        // Face order: [+X, -X, +Y, -Y, +Z, -Z] -> [1, 6, 2, 5, 3, 4]
        function createD6() {
            const s = 1.55 * SCALE;
            const geom = new THREE.BoxGeometry(s, s, s).toNonIndexed();
            geom.computeVertexNormals();

            geom.clearGroups();
            const faceValues = [1, 6, 2, 5, 3, 4];
            const normals = [];

            for (let i = 0; i < 6; i++) {
                geom.addGroup(i * 6, 6, i);
                normals.push(calculateFaceNormal(geom, i * 6));
            }

            return { geometry: geom, faceValues, normals };
        }

        // d8: 8 triangular faces (24 non-indexed vertices). Standard opposite pairs sum to 9
        function createD8() {
            const r = 1.45 * SCALE;
            const geom = new THREE.OctahedronGeometry(r, 0).toNonIndexed();
            geom.computeVertexNormals();

            geom.clearGroups();
            const faceValues = [1, 8, 2, 7, 3, 6, 4, 5];
            const normals = [];

            for (let i = 0; i < 8; i++) {
                geom.addGroup(i * 3, 3, i);
                normals.push(calculateFaceNormal(geom, i * 3));
            }

            return { geometry: geom, faceValues, normals };
        }

        // d10 & d100: True Pentagonal Trapezohedron with 10 Kite Faces
        function createD10(isPercentile = false) {
            const r = 1.4 * SCALE;
            const H = r * 1.15;
            const R = r * 0.95;
            const rMid = r * 0.85;

            const topApex = [0, H, 0];
            const bottomApex = [0, -H, 0];
            const ring = [];

            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const y = (i % 2 === 0) ? (H * 0.15) : (-H * 0.15);
                const curR = (i % 2 === 0) ? R : rMid;
                ring.push([Math.cos(angle) * curR, y, Math.sin(angle) * curR]);
            }

            const vertices = [];
            const uvs = [];

            // 10 kite faces: 5 top kites, 5 bottom kites (each kite = 2 triangles = 6 vertices)
            for (let i = 0; i < 10; i++) {
                const next = (i + 1) % 10;
                const nextNext = (i + 2) % 10;

                if (i % 2 === 0) {
                    // Top kite (topApex -> ring[i] -> ring[next] -> ring[nextNext] -> topApex)
                    vertices.push(...topApex, ...ring[i], ...ring[next]);
                    vertices.push(...topApex, ...ring[next], ...ring[nextNext]);
                    uvs.push(0.5, 1, 0, 0, 0.5, 0.3);
                    uvs.push(0.5, 1, 0.5, 0.3, 1, 0);
                } else {
                    // Bottom kite
                    vertices.push(...bottomApex, ...ring[next], ...ring[i]);
                    vertices.push(...bottomApex, ...ring[nextNext], ...ring[next]);
                    uvs.push(0.5, 0, 0.5, 0.7, 0, 1);
                    uvs.push(0.5, 0, 1, 1, 0.5, 0.7);
                }
            }

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geom.computeVertexNormals();

            geom.clearGroups();
            const faceValues = isPercentile
                ? ['00', '50', '10', '60', '20', '70', '30', '80', '40', '90']
                : [1, 6, 2, 7, 3, 8, 4, 9, 5, 10];
            const normals = [];

            for (let i = 0; i < 10; i++) {
                geom.addGroup(i * 6, 6, i);
                normals.push(calculateFaceNormal(geom, i * 6));
            }

            return { geometry: geom, faceValues, normals };
        }

        // d12: 12 pentagonal faces (36 non-indexed triangles = 108 vertices). Pairs sum to 13
        function createD12() {
            const r = 1.3 * SCALE;
            const geom = new THREE.DodecahedronGeometry(r, 0).toNonIndexed();
            geom.computeVertexNormals();

            geom.clearGroups();
            const faceValues = [1, 12, 2, 11, 3, 10, 4, 9, 5, 8, 6, 7];
            const normals = [];

            // 12 pentagons * 3 triangles = 36 triangles (9 vertices per pentagon)
            for (let i = 0; i < 12; i++) {
                geom.addGroup(i * 9, 9, i);
                normals.push(calculateFaceNormal(geom, i * 9));
            }

            return { geometry: geom, faceValues, normals };
        }

        // d20: 20 triangular faces (60 non-indexed vertices). Pairs sum to 21
        function createD20() {
            const r = 1.4 * SCALE;
            const geom = new THREE.IcosahedronGeometry(r, 0).toNonIndexed();
            geom.computeVertexNormals();

            geom.clearGroups();
            const faceValues = [
                1, 20, 2, 19, 3, 18, 4, 17, 5, 16,
                6, 15, 7, 14, 8, 13, 9, 12, 10, 11
            ];
            const normals = [];

            for (let i = 0; i < 20; i++) {
                geom.addGroup(i * 3, 3, i);
                normals.push(calculateFaceNormal(geom, i * 3));
            }

            return { geometry: geom, faceValues, normals };
        }

        function calculateFaceNormal(geometry, startVertex) {
            const pos = geometry.attributes.position;
            const vA = new THREE.Vector3().fromBufferAttribute(pos, startVertex);
            const vB = new THREE.Vector3().fromBufferAttribute(pos, startVertex + 1);
            const vC = new THREE.Vector3().fromBufferAttribute(pos, startVertex + 2);

            const cb = new THREE.Vector3().subVectors(vC, vB);
            const ab = new THREE.Vector3().subVectors(vA, vB);
            cb.cross(ab).normalize();
            return cb;
        }

        function buildDie(faces, theme, isPercentile = false, isCrit = false, isDropped = false) {
            let data;
            const f = parseInt(faces, 10);

            if (f === 4) data = createD4();
            else if (f === 6) data = createD6();
            else if (f === 8) data = createD8();
            else if (f === 10) data = createD10(false);
            else if (f === 100) data = createD10(true);
            else if (f === 12) data = createD12();
            else data = createD20();

            // Build individual materials for each face
            const materials = data.faceValues.map(val => {
                return TextureFactory.createFaceMaterial(val, theme, isCrit, isDropped);
            });

            const mesh = new THREE.Mesh(data.geometry, materials);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            return {
                mesh,
                faceValues: data.faceValues,
                normals: data.normals
            };
        }

        return {
            buildDie
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

        // Camera (Perspective looking at dice playfield)
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffdf0, 1.25);
        dirLight.position.set(12, 28, 22);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x90caf9, 0.55);
        fillLight.position.set(-16, -10, 12);
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
            const geom = new THREE.SphereGeometry(0.1 + Math.random() * 0.07, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(color),
                transparent: true,
                opacity: 0.95
            });
            const pMesh = new THREE.Mesh(geom, mat);
            pMesh.position.set(x, y, z);

            const angle = Math.random() * Math.PI * 2;
            const speed = 2.2 + Math.random() * 5.8;
            const elevation = (Math.random() - 0.2) * 4.5;

            activeParticles.push({
                mesh: pMesh,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + elevation,
                vz: (Math.random() - 0.5) * speed,
                alpha: 1.0,
                decay: 0.022 + Math.random() * 0.025
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

    // Roll Trigger with Order-Preserving Physics Lanes & Dual Percentile Support
    function roll(diceList, options = {}) {
        if (!isEnabled()) return false;
        if (!isInitialized) {
            const ok = init();
            if (!ok) return false;
        }

        if (!Array.isArray(diceList) || diceList.length === 0) return false;

        // Expand any d100 rolls into a dual-dice pair: (Percentile tens + Units d10)
        const expandedDiceList = [];
        diceList.forEach(d => {
            const faces = extractFaces(d);
            const val = extractVal(d);

            if (faces === 100) {
                // Determine tens and units from 1-100 value
                const tensNum = Math.floor(((val - 1) % 100) / 10) * 10;
                const unitsNum = ((val - 1) % 10) + 1; // 1-10

                expandedDiceList.push({
                    ...d,
                    faces: 100,
                    val: tensNum === 0 ? '00' : String(tensNum),
                    isPercentileTens: true
                });
                expandedDiceList.push({
                    ...d,
                    faces: 10,
                    val: unitsNum,
                    isPercentileUnits: true
                });
            } else {
                expandedDiceList.push(d);
            }
        });

        const totalDice = expandedDiceList.length;

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

        expandedDiceList.forEach((dice, idx) => {
            const faces = extractFaces(dice);
            const val = dice.val !== undefined ? dice.val : extractVal(dice);
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

            // Determine Theme
            let theme = THEMES.d20;
            if (critType) {
                theme = THEMES[critType];
            } else if (damageType && THEMES[damageType]) {
                theme = THEMES[damageType];
            } else if (THEMES[`d${faces}`]) {
                theme = THEMES[`d${faces}`];
            }

            const built = GeometryFactory.buildDie(faces, theme, faces === 100, critType === 'Nat20', isDropped);
            const mesh = built.mesh;

            // Compute Lane Boundaries to strictly preserve left-to-right order
            const laneCenter = startX + (idx * laneWidth);
            const laneHalfWidth = (laneWidth * 0.42);
            const minX = laneCenter - laneHalfWidth;
            const maxX = laneCenter + laneHalfWidth;

            // Spawn Position
            const spawnX = laneCenter + (Math.random() - 0.5) * 0.35;
            const spawnY = visibleHeight * 0.55 + Math.random() * 2.0;
            const spawnZ = (Math.random() - 0.5) * 2.5;
            mesh.position.set(spawnX, spawnY, spawnZ);

            // Initial tumbling rotation
            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Compute Target Landing Quaternion for the rolled value
            const targetValStr = String(val);
            let targetFaceIdx = built.faceValues.findIndex(fv => String(fv) === targetValStr);
            if (targetFaceIdx === -1) targetFaceIdx = 0;

            const targetLocalNormal = built.normals[targetFaceIdx] || new THREE.Vector3(0, 1, 0);

            // Target camera vector (slightly tilted upward toward camera for optimal visibility)
            const targetWorldDir = new THREE.Vector3(0, 0.42, 0.91).normalize();
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(targetLocalNormal, targetWorldDir);

            scene.add(mesh);

            // Physics Die Entity
            const dieEntity = {
                mesh: mesh,
                faces: faces,
                val: val,
                critType: critType,
                theme: theme,
                laneCenter: laneCenter,
                minX: minX,
                maxX: maxX,
                floorY: floorY,
                vx: (Math.random() - 0.5) * 2.0,
                vy: -(12.0 + Math.random() * 5.0),
                vz: (Math.random() - 0.5) * 2.5,
                rx: (Math.random() - 0.5) * 22.0,
                ry: (Math.random() - 0.5) * 22.0,
                rz: (Math.random() - 0.5) * 22.0,
                targetQuaternion: targetQuaternion,
                preSettleQuaternion: new THREE.Quaternion(),
                settleProgress: 0,
                isSettling: false,
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

    // Animation & Physics Loop with Smooth Slerp Settling
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
        const gravity = -36.0;

        activeDice.forEach(d => {
            if (d.isDone) return;

            if (!d.isResting) {
                if (!d.isSettling) {
                    // Apply Gravity & Velocities
                    d.vy += gravity * dt;
                    d.mesh.position.x += d.vx * dt;
                    d.mesh.position.y += d.vy * dt;
                    d.mesh.position.z += d.vz * dt;

                    // Rotational Spin
                    d.mesh.rotation.x += d.rx * dt;
                    d.mesh.rotation.y += d.ry * dt;
                    d.mesh.rotation.z += d.rz * dt;

                    // Floor Collision & Bounce
                    if (d.mesh.position.y <= d.floorY) {
                        d.mesh.position.y = d.floorY;
                        d.vy = -d.vy * 0.48; // Floor restitution
                        d.vx *= 0.75;
                        d.vz *= 0.75;
                        d.rx *= 0.72;
                        d.ry *= 0.72;
                        d.rz *= 0.72;
                        d.bounceCount++;

                        AudioEngine.playFloorThump(Math.abs(d.vy) / 10.0);

                        // Trigger smooth face-up slerp settling
                        if (d.bounceCount >= 2 || Math.abs(d.vy) < 1.8) {
                            d.isSettling = true;
                            d.preSettleQuaternion.copy(d.mesh.quaternion);
                            d.settleProgress = 0;
                            d.vx = 0;
                            d.vz = 0;
                            d.rx = 0;
                            d.ry = 0;
                            d.rz = 0;
                        }
                    }

                    // Invisible Left & Right Vertical Physics Lane Barriers
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
                    if (d.mesh.position.z < -3.5) {
                        d.mesh.position.z = -3.5;
                        d.vz = Math.abs(d.vz) * 0.6;
                    } else if (d.mesh.position.z > 3.5) {
                        d.mesh.position.z = 3.5;
                        d.vz = -Math.abs(d.vz) * 0.6;
                    }
                } else {
                    // Smooth Slerp Settling Phase (0.42 seconds cubic ease-out)
                    d.settleProgress = Math.min(1.0, d.settleProgress + (dt / 0.42));
                    const t = 1 - Math.pow(1 - d.settleProgress, 3);

                    d.mesh.quaternion.slerpQuaternions(d.preSettleQuaternion, d.targetQuaternion, t);
                    d.mesh.position.y = d.floorY + Math.sin(t * Math.PI) * 0.25;

                    if (d.settleProgress >= 1.0) {
                        d.isResting = true;
                        d.mesh.quaternion.copy(d.targetQuaternion);
                        d.mesh.position.y = d.floorY;

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
            } else {
                // Resting die gentle hover if critical hit
                if (d.critType === 'Nat20') {
                    d.mesh.position.y = d.floorY + Math.sin(Date.now() * 0.005) * 0.06;
                }
            }

            // Fadeout handling
            if (d.fade) {
                d.alpha -= dt * 1.8;
                if (Array.isArray(d.mesh.material)) {
                    d.mesh.material.forEach(mat => {
                        mat.opacity = Math.max(0, d.alpha);
                    });
                } else if (d.mesh.material) {
                    d.mesh.material.opacity = Math.max(0, d.alpha);
                }

                if (d.alpha <= 0) {
                    d.isDone = true;
                    scene.remove(d.mesh);
                    if (d.mesh.geometry) d.mesh.geometry.dispose();
                    if (Array.isArray(d.mesh.material)) {
                        d.mesh.material.forEach(mat => mat.dispose());
                    } else if (d.mesh.material) {
                        d.mesh.material.dispose();
                    }
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
            p.vy -= 9.8 * dt;
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
            pos.y += 2.0;
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
            if (Array.isArray(d.mesh.material)) {
                d.mesh.material.forEach(mat => mat.dispose());
            } else if (d.mesh.material) {
                d.mesh.material.dispose();
            }
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
