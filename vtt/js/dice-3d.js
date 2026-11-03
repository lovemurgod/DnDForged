/**
 * DnDForged 3D WebGL Dice Engine (Powered by Sarah Rosanna Busch / Teal Dice Architecture)
 * Full Cannon.js rigid-body physics, chamfered polyhedral geometries,
 * polar UV-mapped face textures, order-preserving barrier lanes, multi-skin themes,
 * predetermined outcome shifting, and Web Audio SFX.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Dice3D = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Settings Keys
    const STORAGE_KEY_ENABLED = 'vtt_3d_dice_enabled';
    const STORAGE_KEY_SFX = 'vtt_3d_dice_sfx';
    const STORAGE_KEY_VOLUME = 'vtt_3d_dice_volume';
    const STORAGE_KEY_SKIN = 'vtt_3d_dice_skin';

    // Global Scale Multiplier (Reduced by an additional 20% for balanced tabletop proportions)
    const SCALE_FACTOR = 0.43;

    // State
    let isInitialized = false;
    let containerEl = null;
    let canvasEl = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let physicsWorld = null;
    let groundMaterial = null;
    let diceMaterial = null;
    let barrierMaterial = null;
    let animFrameId = null;
    let activeDice = [];
    let activeParticles = [];
    let activeBadges = [];
    let activeWalls = [];

    // Multi-tier Dynamic Grid & Wave Management
    const MAX_WAVE_SIZE = 12;
    let pendingWaves = [];
    let waveTransitionTimeout = null;
    let waveSafetyTimeout = null;
    let isWaveTransitionScheduled = false;

    // Skin Theme Presets
    const SKINS = {
        obsidian_gold: {
            name: 'Obsidian & Gold',
            bg: '#141416',
            border: '#d4af37',
            text: '#ffd700',
            emissive: 0x332500,
            roughness: 0.25,
            metalness: 0.6,
            particleColor: '#ffd700'
        },
        ruby_ember: {
            name: 'Ruby Ember',
            bg: '#2b0305',
            border: '#ff1744',
            text: '#ff5252',
            emissive: 0x3d0000,
            roughness: 0.3,
            metalness: 0.4,
            particleColor: '#ff5252'
        },
        sapphire_frost: {
            name: 'Sapphire Frost',
            bg: '#04162e',
            border: '#00b0ff',
            text: '#00e5ff',
            emissive: 0x00263d,
            roughness: 0.2,
            metalness: 0.7,
            particleColor: '#80d8ff'
        },
        amethyst_void: {
            name: 'Amethyst Void',
            bg: '#1c052e',
            border: '#d500f9',
            text: '#e040fb',
            emissive: 0x2e003d,
            roughness: 0.25,
            metalness: 0.5,
            particleColor: '#ea80fc'
        },
        classic_ivory: {
            name: 'Classic Ivory',
            bg: '#eae5d9',
            border: '#8c8270',
            text: '#1a1a1a',
            emissive: 0x111111,
            roughness: 0.4,
            metalness: 0.1,
            particleColor: '#d7ccc8'
        },
        jade_emerald: {
            name: 'Jade Emerald',
            bg: '#042211',
            border: '#00b44b',
            text: '#00e676',
            emissive: 0x003d15,
            roughness: 0.25,
            metalness: 0.5,
            particleColor: '#00e676'
        },
        solar_flare: {
            name: 'Solar Flare',
            bg: '#2b1200',
            border: '#ff8f00',
            text: '#ffb300',
            emissive: 0x3d1f00,
            roughness: 0.2,
            metalness: 0.7,
            particleColor: '#ffc107'
        },
        abyssal_trench: {
            name: 'Abyssal Trench',
            bg: '#031726',
            border: '#0097a7',
            text: '#00e5ff',
            emissive: 0x002633,
            roughness: 0.3,
            metalness: 0.6,
            particleColor: '#00e5ff'
        }
    };

    function getActiveSkin() {
        const key = localStorage.getItem(STORAGE_KEY_SKIN) || 'obsidian_gold';
        return SKINS[key] || SKINS.obsidian_gold;
    }

    // Audio Engine
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

        let activeThemeProfile = localStorage.getItem('vtt_theme') || 'classic';

        function setThemeProfile(theme) {
            activeThemeProfile = theme || 'classic';
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

            // Profile specific frequencies
            let startFreq = 110;
            let endFreq = 35;
            let lowpassFreq = 320;
            let decayTime = 0.09;

            if (activeThemeProfile === 'hellscape') {
                startFreq = 80;
                endFreq = 22;
                lowpassFreq = 200;
                decayTime = 0.12;
            } else if (activeThemeProfile === 'jungle') {
                startFreq = 160;
                endFreq = 50;
                lowpassFreq = 420;
                decayTime = 0.08;
            } else if (activeThemeProfile === 'abyssal') {
                startFreq = 70;
                endFreq = 20;
                lowpassFreq = 160;
                decayTime = 0.14;
            } else if (activeThemeProfile === 'frostpeak') {
                startFreq = 180;
                endFreq = 75;
                lowpassFreq = 750;
                decayTime = 0.06;
            } else if (activeThemeProfile === 'cyberpunk') {
                startFreq = 260;
                endFreq = 45;
                lowpassFreq = 600;
                decayTime = 0.07;
            }

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(lowpassFreq, now);

            gain.gain.setValueAtTime(vol * 0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + decayTime + 0.02);

            // Shimmer / overtone for ethereal themes (Celestial, Feywild, Solaris)
            if (
                activeThemeProfile === 'celestial' ||
                activeThemeProfile === 'feywild' ||
                activeThemeProfile === 'solaris'
            ) {
                const chimeOsc = ctx.createOscillator();
                const chimeGain = ctx.createGain();
                chimeOsc.type = 'sine';
                const chimeFreq =
                    activeThemeProfile === 'celestial' ? 1046.5 : activeThemeProfile === 'feywild' ? 1318.5 : 880;
                chimeOsc.frequency.setValueAtTime(chimeFreq, now);
                chimeOsc.frequency.exponentialRampToValueAtTime(chimeFreq * 0.9, now + 0.12);
                chimeGain.gain.setValueAtTime(vol * 0.12, now);
                chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
                chimeOsc.connect(chimeGain);
                chimeGain.connect(ctx.destination);
                chimeOsc.start(now);
                chimeOsc.stop(now + 0.15);
            }
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

            let centerFreq = 1800 + Math.random() * 800;
            let qVal = 4.0;
            if (activeThemeProfile === 'frostpeak') {
                centerFreq = 3400 + Math.random() * 800;
                qVal = 6.0;
            } else if (activeThemeProfile === 'jungle') {
                centerFreq = 950 + Math.random() * 400;
                qVal = 2.5;
            } else if (activeThemeProfile === 'hellscape') {
                centerFreq = 1100 + Math.random() * 400;
                qVal = 3.0;
            } else if (activeThemeProfile === 'gothic') {
                centerFreq = 2400 + Math.random() * 600;
                qVal = 5.0;
            } else if (activeThemeProfile === 'cyberpunk') {
                centerFreq = 3000 + Math.random() * 1000;
                qVal = 4.5;
            }

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(centerFreq, now);
            filter.Q.setValueAtTime(qVal, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            noiseSource.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            noiseSource.start(now);
        }

        function playUiClick(freq = 600) {
            if (!isSfxEnabled()) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            const vol = getVolume() * 0.35;
            if (vol <= 0.001) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            let pitch = freq;
            if (activeThemeProfile === 'celestial') pitch = 950;
            else if (activeThemeProfile === 'cyberpunk') pitch = 1200;
            else if (activeThemeProfile === 'hellscape') pitch = 280;
            else if (activeThemeProfile === 'gothic') pitch = 450;
            else if (activeThemeProfile === 'frostpeak') pitch = 1400;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, now);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.035);

            gain.gain.setValueAtTime(vol * 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        }

        function playNat20Fanfare() {
            if (!isSfxEnabled()) return;
            const ctx = getAudioContext();
            if (!ctx) return;

            const vol = getVolume();
            if (vol <= 0.001) return;

            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

            notes.forEach((freq, idx) => {
                const noteTime = now + idx * 0.07;
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

    // Constants from Sarah Rosanna Busch / Teal Dice
    const CONSTS = {
        dice_face_range: {
            d4: [1, 4],
            d6: [1, 6],
            d8: [1, 8],
            d10: [0, 9],
            d12: [1, 12],
            d20: [1, 20],
            d100: [0, 9]
        },
        dice_mass: {
            d4: 300,
            d6: 300,
            d8: 340,
            d10: 350,
            d12: 350,
            d20: 400,
            d100: 350
        },
        dice_inertia: {
            d4: 5,
            d6: 13,
            d8: 10,
            d10: 9,
            d12: 8,
            d20: 6,
            d100: 9
        },
        standard_d20_labels: [
            ' ',
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            '10',
            '11',
            '12',
            '13',
            '14',
            '15',
            '16',
            '17',
            '18',
            '19',
            '20'
        ],
        standard_d100_labels: [' ', '00', '10', '20', '30', '40', '50', '60', '70', '80', '90'],
        d4_labels: [
            [[], [0, 0, 0], [2, 4, 3], [1, 3, 4], [2, 1, 4], [1, 2, 3]],
            [[], [0, 0, 0], [2, 3, 4], [3, 1, 4], [2, 4, 1], [3, 2, 1]],
            [[], [0, 0, 0], [4, 3, 2], [3, 4, 1], [4, 2, 1], [3, 1, 2]],
            [[], [0, 0, 0], [4, 2, 3], [1, 4, 3], [4, 1, 2], [1, 3, 2]]
        ]
    };

    // Material and Texture Manager
    const MaterialManager = (function () {
        const materialCache = new Map();

        // Draw die-specific geometric inset border polygon
        function drawFaceBorder(ctx, type, size, skin) {
            if (!skin.border) return;

            ctx.save();
            ctx.strokeStyle = skin.border;
            ctx.lineWidth = 3.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            const cx = size / 2;
            const cy = size / 2;

            ctx.beginPath();
            if (type === 'd6') {
                const r = size * 0.4;
                const cr = 14;
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, cr);
                } else {
                    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
                }
            } else if (type === 'd12') {
                const r = size * 0.43;
                for (let i = 0; i < 5; i++) {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
            } else if (type === 'd10' || type === 'd100') {
                const rx = size * 0.4;
                const ryTop = size * 0.44;
                const ryBot = size * 0.44;
                ctx.moveTo(cx, cy - ryTop);
                ctx.lineTo(cx + rx, cy);
                ctx.lineTo(cx, cy + ryBot);
                ctx.lineTo(cx - rx, cy);
                ctx.closePath();
            } else {
                // Triangular faces: d4, d8, d20 (and default)
                const r = size * 0.44;
                for (let i = 0; i < 3; i++) {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
            }

            ctx.stroke();
            ctx.restore();
        }

        function createFaceTexture(label, skin, isD4 = false, type = 'd20') {
            const canvas = document.createElement('canvas');
            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Draw Background
            ctx.fillStyle = skin.bg;
            ctx.fillRect(0, 0, size, size);

            if (!label || (Array.isArray(label) && label.length === 0)) {
                const tex = new THREE.CanvasTexture(canvas);
                tex.generateMipmaps = true;
                return tex;
            }

            const str = String(label).trim();
            if (str.length === 0) {
                // Chamfer/edge face (empty label)
                const tex = new THREE.CanvasTexture(canvas);
                tex.generateMipmaps = true;
                return tex;
            }

            // Draw Geometric Inset Border Rim on numbered faces
            drawFaceBorder(ctx, type, size, skin);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isD4 && Array.isArray(label)) {
                // d4 3-number triangle orientation
                ctx.font = 'bold 58px "Outfit", "Segoe UI", sans-serif';
                for (let i = 0; i < label.length; i++) {
                    const numStr = String(label[i]);

                    // Layer 1: Deep drop shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                    ctx.fillText(numStr, size / 2, size / 2 - size * 0.3 + 3);

                    // Layer 2: Accent contour stroke
                    ctx.save();
                    ctx.strokeStyle = skin.border || skin.text;
                    ctx.lineWidth = 3.5;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(numStr, size / 2, size / 2 - size * 0.3);
                    ctx.restore();

                    // Layer 3: Vibrant core numeral fill
                    ctx.fillStyle = skin.text;
                    ctx.fillText(numStr, size / 2, size / 2 - size * 0.3);

                    ctx.translate(size / 2, size / 2);
                    ctx.rotate((Math.PI * 2) / 3);
                    ctx.translate(-size / 2, -size / 2);
                }
            } else {
                // Standard Die Numeral
                const fontSize = str.length > 2 ? 80 : str.length === 2 ? 100 : 124;
                ctx.font = `900 ${fontSize}px "Outfit", "Segoe UI", sans-serif`;

                // Layer 1: Deep Drop Shadow for depth against dark faces
                ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
                ctx.fillText(str, size / 2, size / 2 + 5);

                // Layer 2: Accent Contour Stroke
                ctx.save();
                ctx.strokeStyle = skin.border || skin.text;
                ctx.lineWidth = 4.5;
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.strokeText(str, size / 2, size / 2);
                ctx.restore();

                // Layer 3: Vibrant Core Numeral Fill
                ctx.fillStyle = skin.text;
                ctx.fillText(str, size / 2, size / 2);

                // Orientation dot/line for 6 and 9
                if (str === '6' || str === '9') {
                    ctx.fillStyle = skin.text;
                    ctx.fillRect(size / 2 - 24, size / 2 + 52, 48, 6);
                }
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            return tex;
        }

        function getMaterialsForType(type, skin, d4Shift = 0) {
            const cacheKey = `${type}_${skin.name}_${d4Shift}`;
            if (materialCache.has(cacheKey)) {
                return materialCache.get(cacheKey);
            }

            let labels;
            let isD4 = false;

            if (type === 'd4') {
                labels = CONSTS.d4_labels[d4Shift % 4];
                isD4 = true;
            } else if (type === 'd100') {
                labels = CONSTS.standard_d100_labels;
            } else {
                labels = CONSTS.standard_d20_labels;
            }

            const mats = labels.map((lbl) => {
                const tex = createFaceTexture(lbl, skin, isD4, type);
                return new THREE.MeshStandardMaterial({
                    map: tex,
                    color: 0xffffff,
                    emissive: skin.emissive || 0x111111,
                    emissiveIntensity: 0.15,
                    roughness: skin.roughness || 0.25,
                    metalness: skin.metalness || 0.5,
                    transparent: true,
                    opacity: 1.0
                });
            });

            materialCache.set(cacheKey, mats);
            return mats;
        }

        return {
            getMaterialsForType
        };
    })();

    // Chamfered Polyhedral Geometry Factory (Sarah Rosanna Busch / Teal Algorithm)
    const GeometryFactory = (function () {
        const geomCache = new Map();

        function chamferVectorsAndFaces(vectors, faces, chamfer) {
            const chamferVectors = [];
            const chamferFaces = [];
            const cornerFaces = new Array(vectors.length);
            for (let i = 0; i < vectors.length; ++i) cornerFaces[i] = [];

            for (let i = 0; i < faces.length; ++i) {
                const ii = faces[i];
                const fl = ii.length - 1;
                const centerPoint = new THREE.Vector3();
                const face = new Array(fl);

                for (let j = 0; j < fl; ++j) {
                    const vv = vectors[ii[j]].clone();
                    centerPoint.add(vv);
                    cornerFaces[ii[j]].push((face[j] = chamferVectors.push(vv) - 1));
                }
                centerPoint.divideScalar(fl);
                for (let j = 0; j < fl; ++j) {
                    const vv = chamferVectors[face[j]];
                    vv.subVectors(vv, centerPoint).multiplyScalar(chamfer).addVectors(vv, centerPoint);
                }
                face.push(ii[fl]);
                chamferFaces.push(face);
            }

            for (let i = 0; i < faces.length - 1; ++i) {
                for (let j = i + 1; j < faces.length; ++j) {
                    const pairs = [];
                    let lastm = -1;
                    for (let m = 0; m < faces[i].length - 1; ++m) {
                        const n = faces[j].indexOf(faces[i][m]);
                        if (n >= 0 && n < faces[j].length - 1) {
                            if (lastm >= 0 && m !== lastm + 1) pairs.unshift([i, m], [j, n]);
                            else pairs.push([i, m], [j, n]);
                            lastm = m;
                        }
                    }
                    if (pairs.length !== 4) continue;
                    chamferFaces.push([
                        chamferFaces[pairs[0][0]][pairs[0][1]],
                        chamferFaces[pairs[1][0]][pairs[1][1]],
                        chamferFaces[pairs[3][0]][pairs[3][1]],
                        chamferFaces[pairs[2][0]][pairs[2][1]],
                        -1
                    ]);
                }
            }

            for (let i = 0; i < cornerFaces.length; ++i) {
                const cf = cornerFaces[i];
                const face = [cf[0]];
                let count = cf.length - 1;
                while (count) {
                    for (let m = faces.length; m < chamferFaces.length; ++m) {
                        let index = chamferFaces[m].indexOf(face[face.length - 1]);
                        if (index >= 0 && index < 4) {
                            if (--index === -1) index = 3;
                            const nextVertex = chamferFaces[m][index];
                            if (cf.indexOf(nextVertex) >= 0) {
                                face.push(nextVertex);
                                break;
                            }
                        }
                    }
                    --count;
                }
                face.push(-1);
                chamferFaces.push(face);
            }

            return { vectors: chamferVectors, faces: chamferFaces };
        }

        function createCannonShape(vertices, faces, radius) {
            const cv = new Array(vertices.length);
            const cf = new Array(faces.length);
            for (let i = 0; i < vertices.length; ++i) {
                const v = vertices[i];
                cv[i] = new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius);
            }
            for (let i = 0; i < faces.length; ++i) {
                cf[i] = faces[i].slice(0, faces[i].length - 1);
            }
            return new CANNON.ConvexPolyhedron(cv, cf);
        }

        function buildBufferGeometry(vertices, faces, radius, tab, af) {
            const posArr = [];
            const uvArr = [];
            const groups = [];
            const faceNormals = [];
            let vertOffset = 0;

            for (let i = 0; i < faces.length; ++i) {
                const ii = faces[i];
                const fl = ii.length - 1;
                const aa = (Math.PI * 2) / fl;
                const matIndex = ii[fl] + 1; // 0 is default/chamfer, 1..N are numbered faces

                const startIdx = vertOffset;

                for (let j = 0; j < fl - 2; ++j) {
                    const v0 = vertices[ii[0]].clone().multiplyScalar(radius);
                    const v1 = vertices[ii[j + 1]].clone().multiplyScalar(radius);
                    const v2 = vertices[ii[j + 2]].clone().multiplyScalar(radius);

                    posArr.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);

                    // Polar UV Mapping
                    const u0 = (Math.cos(af) + 1 + tab) / 2 / (1 + tab);
                    const v0_uv = (Math.sin(af) + 1 + tab) / 2 / (1 + tab);
                    const u1 = (Math.cos(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab);
                    const v1_uv = (Math.sin(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab);
                    const u2 = (Math.cos(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab);
                    const v2_uv = (Math.sin(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab);

                    uvArr.push(u0, v0_uv, u1, v1_uv, u2, v2_uv);
                    vertOffset += 3;

                    // Face Normal
                    const norm = new THREE.Vector3()
                        .crossVectors(new THREE.Vector3().subVectors(v1, v0), new THREE.Vector3().subVectors(v2, v0))
                        .normalize();
                    faceNormals.push({ normal: norm, materialIndex: matIndex, groupIdx: groups.length });
                }

                const count = vertOffset - startIdx;
                groups.push({ start: startIdx, count: count, materialIndex: Math.max(0, matIndex) });
            }

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
            geom.computeVertexNormals();

            groups.forEach((g) => {
                geom.addGroup(g.start, g.count, g.materialIndex);
            });

            geom.userData = {
                faceNormals: faceNormals,
                originalGroups: groups.map((g) => ({ ...g }))
            };

            return geom;
        }

        function createGeom(verticesRaw, facesRaw, radius, tab, af, chamfer) {
            const vectors = verticesRaw.map((v) => new THREE.Vector3(...v).normalize());
            const cg = chamferVectorsAndFaces(vectors, facesRaw, chamfer);
            const geom = buildBufferGeometry(cg.vectors, cg.faces, radius, tab, af);
            geom.userData.cannonShape = createCannonShape(vectors, facesRaw, radius);
            return geom;
        }

        function getGeometry(type) {
            if (geomCache.has(type)) {
                return geomCache.get(type);
            }

            const scale = 2.4 * SCALE_FACTOR;
            let geom;

            if (type === 'd4') {
                const vertices = [
                    [1, 1, 1],
                    [-1, -1, 1],
                    [-1, 1, -1],
                    [1, -1, -1]
                ];
                const faces = [
                    [1, 0, 2, 1],
                    [0, 1, 3, 2],
                    [0, 3, 2, 3],
                    [1, 2, 3, 4]
                ];
                geom = createGeom(vertices, faces, scale * 1.2, -0.1, (Math.PI * 7) / 6, 0.96);
            } else if (type === 'd6') {
                const vertices = [
                    [-1, -1, -1],
                    [1, -1, -1],
                    [1, 1, -1],
                    [-1, 1, -1],
                    [-1, -1, 1],
                    [1, -1, 1],
                    [1, 1, 1],
                    [-1, 1, 1]
                ];
                const faces = [
                    [0, 3, 2, 1, 1],
                    [1, 2, 6, 5, 2],
                    [0, 1, 5, 4, 3],
                    [3, 7, 6, 2, 4],
                    [0, 4, 7, 3, 5],
                    [4, 5, 6, 7, 6]
                ];
                geom = createGeom(vertices, faces, scale * 1.1, 0.1, Math.PI / 4, 0.96);
            } else if (type === 'd8') {
                const vertices = [
                    [1, 0, 0],
                    [-1, 0, 0],
                    [0, 1, 0],
                    [0, -1, 0],
                    [0, 0, 1],
                    [0, 0, -1]
                ];
                const faces = [
                    [0, 2, 4, 1],
                    [0, 4, 3, 2],
                    [0, 3, 5, 3],
                    [0, 5, 2, 4],
                    [1, 3, 4, 5],
                    [1, 4, 2, 6],
                    [1, 2, 5, 7],
                    [1, 5, 3, 8]
                ];
                geom = createGeom(vertices, faces, scale, 0, -Math.PI / 8, 0.965);
            } else if (type === 'd10' || type === 'd100') {
                const a = (Math.PI * 2) / 10;
                const h = 0.105;
                const v = -1;
                const vertices = [];
                for (let i = 0, b = 0; i < 10; ++i, b += a) {
                    vertices.push([Math.cos(b), Math.sin(b), h * (i % 2 ? 1 : -1)]);
                }
                vertices.push([0, 0, -1], [0, 0, 1]);
                const faces = [
                    [5, 7, 11, 0],
                    [4, 2, 10, 1],
                    [1, 3, 11, 2],
                    [0, 8, 10, 3],
                    [7, 9, 11, 4],
                    [8, 6, 10, 5],
                    [9, 1, 11, 6],
                    [2, 0, 10, 7],
                    [3, 5, 11, 8],
                    [6, 4, 10, 9],
                    [1, 0, 2, v],
                    [1, 2, 3, v],
                    [3, 2, 4, v],
                    [3, 4, 5, v],
                    [5, 4, 6, v],
                    [5, 6, 7, v],
                    [7, 6, 8, v],
                    [7, 8, 9, v],
                    [9, 8, 0, v],
                    [9, 0, 1, v]
                ];
                geom = createGeom(vertices, faces, scale * 0.9, 0, (Math.PI * 6) / 5, 0.945);
            } else if (type === 'd12') {
                const p = (1 + Math.sqrt(5)) / 2;
                const q = 1 / p;
                const vertices = [
                    [0, q, p],
                    [0, q, -p],
                    [0, -q, p],
                    [0, -q, -p],
                    [p, 0, q],
                    [p, 0, -q],
                    [-p, 0, q],
                    [-p, 0, -q],
                    [q, p, 0],
                    [q, -p, 0],
                    [-q, p, 0],
                    [-q, -p, 0],
                    [1, 1, 1],
                    [1, 1, -1],
                    [1, -1, 1],
                    [1, -1, -1],
                    [-1, 1, 1],
                    [-1, 1, -1],
                    [-1, -1, 1],
                    [-1, -1, -1]
                ];
                const faces = [
                    [2, 14, 4, 12, 0, 1],
                    [15, 9, 11, 19, 3, 2],
                    [16, 10, 17, 7, 6, 3],
                    [6, 7, 19, 11, 18, 4],
                    [6, 18, 2, 0, 16, 5],
                    [18, 11, 9, 14, 2, 6],
                    [1, 17, 10, 8, 13, 7],
                    [1, 13, 5, 15, 3, 8],
                    [13, 8, 12, 4, 5, 9],
                    [5, 4, 14, 9, 15, 10],
                    [0, 12, 8, 10, 16, 11],
                    [3, 19, 7, 17, 1, 12]
                ];
                geom = createGeom(vertices, faces, scale * 0.9, 0.2, -Math.PI / 8, 0.968);
            } else {
                // d20
                const t = (1 + Math.sqrt(5)) / 2;
                const vertices = [
                    [-1, t, 0],
                    [1, t, 0],
                    [-1, -t, 0],
                    [1, -t, 0],
                    [0, -1, t],
                    [0, 1, t],
                    [0, -1, -t],
                    [0, 1, -t],
                    [t, 0, -1],
                    [t, 0, 1],
                    [-t, 0, -1],
                    [-t, 0, 1]
                ];
                const faces = [
                    [0, 11, 5, 1],
                    [0, 5, 1, 2],
                    [0, 1, 7, 3],
                    [0, 7, 10, 4],
                    [0, 10, 11, 5],
                    [1, 5, 9, 6],
                    [5, 11, 4, 7],
                    [11, 10, 2, 8],
                    [10, 7, 6, 9],
                    [7, 1, 8, 10],
                    [3, 9, 4, 11],
                    [3, 4, 2, 12],
                    [3, 2, 6, 13],
                    [3, 6, 8, 14],
                    [3, 8, 9, 15],
                    [4, 9, 5, 16],
                    [2, 4, 11, 17],
                    [6, 2, 10, 18],
                    [8, 6, 7, 19],
                    [9, 8, 1, 20]
                ];
                geom = createGeom(vertices, faces, scale, -0.2, -Math.PI / 8, 0.955);
            }

            geomCache.set(type, geom);
            return geom;
        }

        return {
            getGeometry
        };
    })();

    // Physics Entity Creator
    function createDiceMesh(type, skin, d4Shift = 0) {
        const baseGeom = GeometryFactory.getGeometry(type);
        const geom = baseGeom.clone();
        geom.userData = {
            cannonShape: baseGeom.userData.cannonShape,
            faceNormals: baseGeom.userData.faceNormals.map((fn) => ({ ...fn })),
            originalGroups: baseGeom.userData.originalGroups.map((g) => ({ ...g }))
        };

        const mats = MaterialManager.getMaterialsForType(type, skin, d4Shift);
        const mesh = new THREE.Mesh(geom, mats);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.diceType = type;
        return mesh;
    }

    // Predetermined Result Shifter (Sarah Rosanna Busch / Teal Algorithm)
    function shiftDiceFaces(mesh, targetVal, landedMatIndex) {
        const type = mesh.diceType;
        const r = CONSTS.dice_face_range[type];
        if (!r) return;

        const geom = mesh.geometry;
        geom.clearGroups();

        if (type === 'd100') {
            // Percentile Tens Die ('00', '10', '20', ..., '90')
            const targetDigit = Math.floor((targetVal % 100) / 10);
            const landedDigit = landedMatIndex - 1; // 0..9
            let delta = (targetDigit - landedDigit) % 10;
            if (delta < 0) delta += 10;

            geom.userData.originalGroups.forEach((g) => {
                let matIndex = g.materialIndex;
                if (matIndex > 0) {
                    const digit = matIndex - 1;
                    const shiftedDigit = (digit + delta) % 10;
                    matIndex = shiftedDigit + 1;
                }
                geom.addGroup(g.start, g.count, matIndex);
            });
        } else if (type === 'd10') {
            // Single Digit Units Die ('0', '1', '2', ..., '9')
            const targetDigit = targetVal % 10;
            const landedDigit = (landedMatIndex - 1) % 10;
            let delta = (targetDigit - landedDigit) % 10;
            if (delta < 0) delta += 10;

            geom.userData.originalGroups.forEach((g) => {
                let matIndex = g.materialIndex;
                if (matIndex > 0) {
                    const digit = (matIndex - 1) % 10;
                    const shiftedDigit = (digit + delta) % 10;
                    matIndex = shiftedDigit + 1;
                }
                geom.addGroup(g.start, g.count, matIndex);
            });
        } else if (type === 'd4') {
            // d4 uses 4 material sets
            const landedVal = landedMatIndex;
            let delta = (targetVal - landedVal) % 4;
            if (delta < 0) delta += 4;

            geom.userData.originalGroups.forEach((g) => {
                let matIndex = g.materialIndex;
                if (matIndex > 0) {
                    matIndex = ((matIndex - 1 + delta) % 4) + 1;
                }
                geom.addGroup(g.start, g.count, matIndex);
            });

            if (delta !== 0) {
                mesh.material = MaterialManager.getMaterialsForType('d4', getActiveSkin(), delta);
            }
        } else {
            // Standard polyhedral dice (d6, d8, d12, d20) with range [1, N]
            const numFaces = r[1];
            const landedVal = landedMatIndex - 1; // 1..N
            let delta = (targetVal - landedVal) % numFaces;
            if (delta < 0) delta += numFaces;

            geom.userData.originalGroups.forEach((g) => {
                let matIndex = g.materialIndex;
                if (matIndex > 0) {
                    matIndex = ((((matIndex - 2 + delta) % numFaces) + numFaces) % numFaces) + 2;
                }
                geom.addGroup(g.start, g.count, matIndex);
            });
        }
    }

    function getLandedValue(mesh, body) {
        const type = mesh.diceType;
        const targetVector = new THREE.Vector3(0, 0, type === 'd4' ? -1 : 1);
        let closestAngle = Math.PI * 2;
        let closestMatIndex = 1;

        const normals = mesh.geometry.userData.faceNormals;
        for (let i = 0; i < normals.length; i++) {
            const fn = normals[i];
            if (fn.materialIndex === 0) continue;
            const worldNorm = fn.normal.clone().applyQuaternion(body.quaternion);
            const angle = worldNorm.angleTo(targetVector);
            if (angle < closestAngle) {
                closestAngle = angle;
                closestMatIndex = fn.materialIndex;
            }
        }

        return closestMatIndex;
    }

    // Initialize 3D Scene and Cannon.js Physics
    function init(options = {}) {
        if (isInitialized) return true;

        if (typeof THREE === 'undefined' || typeof CANNON === 'undefined') {
            console.warn('[Dice3D] THREE or CANNON is not loaded.');
            return false;
        }

        const containerId = options.containerId || 'dice-box-canvas-container';
        containerEl = document.getElementById(containerId);

        if (!containerEl) {
            containerEl = document.createElement('div');
            containerEl.id = containerId;
            document.body.appendChild(containerEl);
        }

        containerEl.style.position = 'fixed';
        containerEl.style.top = '0';
        containerEl.style.left = '0';
        containerEl.style.width = '100vw';
        containerEl.style.height = '100vh';
        containerEl.style.pointerEvents = 'none';
        containerEl.style.zIndex = '99999';
        containerEl.style.overflow = 'hidden';

        // Three.js Scene
        scene = new THREE.Scene();

        // Perspective Camera
        const aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(40, aspect, 1, 1000);
        camera.position.set(0, 0, 32);
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

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
        scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xfffdf0, 1.4);
        spotLight.position.set(16, 28, 30);
        spotLight.castShadow = true;
        scene.add(spotLight);

        const fillLight = new THREE.DirectionalLight(0x90caf9, 0.45);
        fillLight.position.set(-16, -14, 16);
        scene.add(fillLight);

        // Cannon.js Physics World (Sloped Felt Tabletop Gravity)
        physicsWorld = new CANNON.World();
        physicsWorld.gravity.set(0, -9.8 * 1.8, -9.8 * 24.0);
        physicsWorld.broadphase = new CANNON.NaiveBroadphase();
        physicsWorld.solver.iterations = 16;

        // Ground Floor Plane
        groundMaterial = new CANNON.Material();
        diceMaterial = new CANNON.Material();
        barrierMaterial = new CANNON.Material();

        const contactMat = new CANNON.ContactMaterial(groundMaterial, diceMaterial, {
            friction: 0.3,
            restitution: 0.45
        });
        physicsWorld.addContactMaterial(contactMat);

        const barrierContactMat = new CANNON.ContactMaterial(barrierMaterial, diceMaterial, {
            friction: 0.05,
            restitution: 0.7
        });
        physicsWorld.addContactMaterial(barrierContactMat);

        const groundBody = new (CANNON.Body || CANNON.RigidBody)({
            mass: 0,
            shape: new CANNON.Plane(),
            material: groundMaterial
        });
        physicsWorld.add(groundBody);

        window.addEventListener('resize', onWindowResize);

        isInitialized = true;
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

    function setSkin(skinKey) {
        if (SKINS[skinKey]) {
            localStorage.setItem(STORAGE_KEY_SKIN, skinKey);
        }
    }

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
            const speed = 2.4 + Math.random() * 5.5;
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

    function spawnBannerBadge(mesh, text, isSuccess) {
        if (!containerEl) return null;
        const badge = document.createElement('div');
        badge.className = `dice3d-floating-badge ${isSuccess ? 'badge-nat20' : 'badge-nat1'} animated-pop-in`;
        badge.innerHTML = `<span>${text}</span>`;
        containerEl.appendChild(badge);

        const badgeObj = {
            el: badge,
            mesh: mesh,
            alpha: 1.0,
            isDone: false
        };

        activeBadges.push(badgeObj);
        return badgeObj;
    }

    // Compute dynamic multi-tier grid (rows & columns) based on dice count and aspect ratio
    function computeOptimalGrid(count, aspect = 1.77) {
        if (count <= 1) return { rows: 1, cols: 1, distribution: [1] };
        if (count === 2) return { rows: 1, cols: 2, distribution: [2] };
        if (count === 3) return { rows: 1, cols: 3, distribution: [3] };
        if (count === 4) return { rows: 2, cols: 2, distribution: [2, 2] };
        if (count === 5) return { rows: 2, cols: 3, distribution: [3, 2] };
        if (count === 6) return { rows: 2, cols: 3, distribution: [3, 3] };
        if (count === 7) return { rows: 2, cols: 4, distribution: [4, 3] };
        if (count === 8) return { rows: 2, cols: 4, distribution: [4, 4] };
        if (count === 9) return { rows: 3, cols: 3, distribution: [3, 3, 3] };
        if (count === 10) return { rows: 3, cols: 4, distribution: [4, 3, 3] };
        if (count === 11) return { rows: 3, cols: 4, distribution: [4, 4, 3] };
        if (count === 12) return { rows: 3, cols: 4, distribution: [4, 4, 4] };

        // Fallback for counts up to 16
        if (count <= 16) {
            const rows = 4;
            const cols = 4;
            const dist = [];
            let rem = count;
            for (let r = 0; r < rows; r++) {
                const c = Math.min(cols, Math.ceil(rem / (rows - r)));
                dist.push(c);
                rem -= c;
            }
            return { rows, cols, distribution: dist };
        }

        const cols = Math.ceil(Math.sqrt(count * (aspect || 1.77)));
        const rows = Math.ceil(count / cols);
        const dist = [];
        let rem = count;
        for (let r = 0; r < rows; r++) {
            const c = Math.min(cols, Math.ceil(rem / (rows - r)));
            dist.push(c);
            rem -= c;
        }
        return { rows, cols, distribution: dist };
    }

    // Launch a single wave of 3D dice across the dynamic multi-tier pocket grid
    function launchWave(waveDiceList) {
        if (!waveDiceList || waveDiceList.length === 0) return false;

        const totalDice = waveDiceList.length;

        // Calculate 3D viewport bounds
        const vFOV = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
        const visibleWidth = visibleHeight * camera.aspect;

        // Use expansive screen area (up to 78% width and 68% height)
        const gridWidth = Math.min(visibleWidth * 0.78, 34);
        const gridHeight = Math.min(visibleHeight * 0.68, 20);

        const grid = computeOptimalGrid(totalDice, camera.aspect);
        const rows = grid.rows;
        const rowHeight = gridHeight / rows;

        const skin = getActiveSkin();

        // Audio Clatter
        AudioEngine.playDiceClatter(1.0);

        // Clear existing walls
        activeWalls.forEach((w) => {
            if (physicsWorld) physicsWorld.remove(w);
        });
        activeWalls = [];

        // 1. Horizontal Shelf Rails (Boundary Rails & Shelf Floors between tiers)
        // Top boundary rail
        const topRailY = gridHeight / 2;
        const topRail = new (CANNON.Body || CANNON.RigidBody)({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(gridWidth * 0.55, 0.2, 40)),
            material: barrierMaterial
        });
        topRail.position.set(0, topRailY, 0);
        physicsWorld.add(topRail);
        activeWalls.push(topRail);

        // Shelf rails between tiers (stops dice from sliding down due to tabletop tilt gravity)
        for (let r = 1; r < rows; r++) {
            const shelfY = gridHeight / 2 - r * rowHeight;
            const shelf = new (CANNON.Body || CANNON.RigidBody)({
                mass: 0,
                shape: new CANNON.Box(new CANNON.Vec3(gridWidth * 0.55, 0.2, 40)),
                material: barrierMaterial
            });
            shelf.position.set(0, shelfY, 0);
            physicsWorld.add(shelf);
            activeWalls.push(shelf);
        }

        // Bottom Bumper Cushion Rail
        const bottomRailY = -gridHeight / 2;
        const bottomRail = new (CANNON.Body || CANNON.RigidBody)({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(gridWidth * 0.55, 0.2, 40)),
            material: barrierMaterial
        });
        bottomRail.position.set(0, bottomRailY, 0);
        physicsWorld.add(bottomRail);
        activeWalls.push(bottomRail);

        // 2. Outer Left & Right Perimeter Walls
        const leftWall = new (CANNON.Body || CANNON.RigidBody)({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(0.2, gridHeight * 0.55, 40)),
            material: barrierMaterial
        });
        leftWall.position.set(-gridWidth / 2, 0, 0);
        physicsWorld.add(leftWall);
        activeWalls.push(leftWall);

        const rightWall = new (CANNON.Body || CANNON.RigidBody)({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(0.2, gridHeight * 0.55, 40)),
            material: barrierMaterial
        });
        rightWall.position.set(gridWidth / 2, 0, 0);
        physicsWorld.add(rightWall);
        activeWalls.push(rightWall);

        // 3. Vertical Pocket Dividers per tier
        for (let r = 0; r < rows; r++) {
            const diceInThisRow = grid.distribution[r] || 1;
            if (diceInThisRow > 1) {
                const pocketWidth = gridWidth / diceInThisRow;
                const rowCenterY = gridHeight / 2 - (r + 0.5) * rowHeight;
                for (let c = 1; c < diceInThisRow; c++) {
                    const wallX = -gridWidth / 2 + c * pocketWidth;
                    const divider = new (CANNON.Body || CANNON.RigidBody)({
                        mass: 0,
                        shape: new CANNON.Box(new CANNON.Vec3(0.12, rowHeight * 0.48, 40)),
                        material: barrierMaterial
                    });
                    divider.position.set(wallX, rowCenterY, 0);
                    physicsWorld.add(divider);
                    activeWalls.push(divider);
                }
            }
        }

        // 4. Spawn Dice Entities into their respective pockets
        const spawnedEntities = [];
        let diceIdx = 0;

        for (let r = 0; r < rows; r++) {
            const diceInThisRow = grid.distribution[r] || 1;
            const pocketWidth = gridWidth / diceInThisRow;
            const rowCenterY = gridHeight / 2 - (r + 0.5) * rowHeight;

            for (let c = 0; c < diceInThisRow && diceIdx < totalDice; c++) {
                const dice = waveDiceList[diceIdx++];
                const type = dice.type;
                const targetVal = dice.val;
                const mesh = createDiceMesh(type, skin);

                const pocketCenterX = -gridWidth / 2 + (c + 0.5) * pocketWidth;
                const pocketCenterY = rowCenterY;

                const spawnX = pocketCenterX + (Math.random() - 0.5) * (pocketWidth * 0.2);
                const spawnY = pocketCenterY - rowHeight * 0.1 + (Math.random() - 0.5) * (rowHeight * 0.2);
                const spawnZ = 12.0 + Math.random() * 2.0;

                const mass = CONSTS.dice_mass[type] || 350;
                const shape = mesh.geometry.userData.cannonShape;
                const body = new (CANNON.Body || CANNON.RigidBody)({
                    mass: mass,
                    shape: shape,
                    material: diceMaterial
                });

                body.position.set(spawnX, spawnY, spawnZ);

                // Velocity scaled to pocket dimensions
                const maxVx = Math.min(pocketWidth * 0.45, 3.2);
                const vx = (Math.random() - 0.5) * maxVx * 2;
                const vy = 2.8 + Math.random() * 2.2;
                const vz = -11.0 - Math.random() * 2.5;
                body.velocity.set(vx, vy, vz);

                const inertia = CONSTS.dice_inertia[type] || 8;
                body.angularVelocity.set(
                    (Math.random() - 0.5) * inertia * 3.5,
                    (Math.random() - 0.5) * inertia * 3.5,
                    (Math.random() - 0.5) * inertia * 3.5
                );

                body.linearDamping = 0.09;
                body.angularDamping = 0.09;

                scene.add(mesh);
                physicsWorld.add(body);

                let critType = null;
                if (type === 'd20') {
                    if (targetVal === 20) critType = 'Nat20';
                    else if (targetVal === 1) critType = 'Nat1';
                }

                const entity = {
                    mesh: mesh,
                    body: body,
                    type: type,
                    targetVal: targetVal,
                    critType: critType,
                    badge: null,
                    pocketCenterX: pocketCenterX,
                    pocketCenterY: pocketCenterY,
                    isResting: false,
                    fade: false,
                    alpha: 1.0,
                    isDone: false
                };

                spawnedEntities.push(entity);
                activeDice.push(entity);
            }
        }

        // Safety fallback: Ensure non-resting dice force-settle after 3.5s so transitions never block
        if (waveSafetyTimeout) {
            clearTimeout(waveSafetyTimeout);
        }
        waveSafetyTimeout = setTimeout(() => {
            spawnedEntities.forEach((e) => {
                if (!e.isResting && !e.fade) {
                    e.isResting = true;
                }
            });
        }, 3500);

        // Run fast-forward physics emulation to find naturally landed face and shift geometry
        emulateAndShiftOutcome(spawnedEntities);
        startAnimationLoop();
        return true;
    }

    // Roll with Multi-Tier Dynamic Pocket Grid & Sequential Waves
    function roll(diceList, options = {}) {
        if (!isEnabled()) return false;
        if (!isInitialized) {
            const ok = init();
            if (!ok) return false;
        }

        if (!Array.isArray(diceList) || diceList.length === 0) return false;

        // Cancel any pending wave transitions and clear existing dice
        if (waveTransitionTimeout) {
            clearTimeout(waveTransitionTimeout);
            waveTransitionTimeout = null;
        }
        if (waveSafetyTimeout) {
            clearTimeout(waveSafetyTimeout);
            waveSafetyTimeout = null;
        }
        isWaveTransitionScheduled = false;
        pendingWaves = [];

        clear();

        // Expand any d100 rolls into dual-dice pair: (Percentile tens + Units d10)
        const expandedDiceList = [];
        diceList.forEach((d) => {
            const faces = extractFaces(d);
            const val = extractVal(d);

            if (faces === 100) {
                const tensVal = val === 100 ? 0 : Math.floor(val / 10) * 10;
                const unitsVal = val % 10 === 0 ? 0 : val % 10;

                expandedDiceList.push({
                    ...d,
                    type: 'd100',
                    faces: 100,
                    val: tensVal,
                    isPercentileTens: true
                });
                expandedDiceList.push({
                    ...d,
                    type: 'd10',
                    faces: 10,
                    val: unitsVal,
                    isPercentileUnits: true
                });
            } else {
                expandedDiceList.push({
                    ...d,
                    type: `d${faces}`,
                    faces: faces,
                    val: val
                });
            }
        });

        // Launch single wave if within threshold
        if (expandedDiceList.length <= MAX_WAVE_SIZE) {
            return launchWave(expandedDiceList);
        }

        // Split into chunks of MAX_WAVE_SIZE for sequential waves
        const chunks = [];
        for (let i = 0; i < expandedDiceList.length; i += MAX_WAVE_SIZE) {
            chunks.push(expandedDiceList.slice(i, i + MAX_WAVE_SIZE));
        }

        pendingWaves = chunks.slice(1);
        return launchWave(chunks[0]);
    }

    function emulateAndShiftOutcome(entities) {
        // Save initial positions
        const savedStates = entities.map((e) => ({
            pos: e.body.position.clone(),
            quat: e.body.quaternion.clone(),
            vel: e.body.velocity.clone(),
            angVel: e.body.angularVelocity.clone()
        }));

        // Emulate forward 180 physics steps
        for (let step = 0; step < 180; step++) {
            physicsWorld.step(1 / 60);
        }

        // Determine landed value and shift face groups to match target value
        entities.forEach((e) => {
            const landedVal = getLandedValue(e.mesh, e.body);
            shiftDiceFaces(e.mesh, e.targetVal, landedVal);
        });

        // Restore initial physics state for real-time visual rolling
        entities.forEach((e, idx) => {
            const s = savedStates[idx];
            e.body.position.copy(s.pos);
            e.body.quaternion.copy(s.quat);
            e.body.velocity.copy(s.vel);
            e.body.angularVelocity.copy(s.angVel);
            e.mesh.position.copy(s.pos);
            e.mesh.quaternion.copy(s.quat);
        });
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

    // Animation & Physics Loop (Auto-sleeps when idle to preserve GPU/CPU)
    function startAnimationLoop() {
        if (animFrameId) return;

        let lastTime = performance.now();

        function animate(now) {
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            updatePhysics(dt);
            updateParticles(dt);
            updateBadges();

            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }

            // Auto-Sleep Check: Put 3D engine to sleep if there are no active dice, particles, or banners
            if (activeDice.length === 0 && activeParticles.length === 0 && activeBadges.length === 0) {
                if (animFrameId) {
                    cancelAnimationFrame(animFrameId);
                    animFrameId = null;
                }
                return;
            }

            animFrameId = requestAnimationFrame(animate);
        }

        animFrameId = requestAnimationFrame(animate);
    }

    let physicsAccumulator = 0;
    const FIXED_PHYSICS_STEP = 1 / 60;

    function updatePhysics(dt) {
        if (!physicsWorld) return;

        // Step Cannon.js Physics capped at 60 FPS
        physicsAccumulator += dt;
        if (physicsAccumulator > 0.1) physicsAccumulator = 0.1;
        while (physicsAccumulator >= FIXED_PHYSICS_STEP) {
            physicsWorld.step(FIXED_PHYSICS_STEP);
            physicsAccumulator -= FIXED_PHYSICS_STEP;
        }

        // Sequential Wave Transition: When all current dice settle and pending waves exist
        if (pendingWaves.length > 0 && !isWaveTransitionScheduled) {
            const allResting = activeDice.length > 0 && activeDice.every((d) => d.isResting);
            if (allResting) {
                isWaveTransitionScheduled = true;
                waveTransitionTimeout = setTimeout(() => {
                    waveTransitionTimeout = null;
                    isWaveTransitionScheduled = false;

                    // Fade out current wave and decouple from physics
                    activeDice.forEach((d) => {
                        d.fade = true;
                        if (d.body && physicsWorld) {
                            physicsWorld.remove(d.body);
                            d.body = null;
                        }
                    });

                    const nextWave = pendingWaves.shift();
                    if (nextWave && nextWave.length > 0) {
                        launchWave(nextWave);
                    }
                }, 1300);
            }
        }

        activeDice.forEach((d) => {
            if (d.isDone) return;

            // Sync Three.js Mesh with Cannon.js Body if physics is active
            if (d.body) {
                d.mesh.position.copy(d.body.position);
                d.mesh.quaternion.copy(d.body.quaternion);

                const velSq = d.body.velocity.lengthSquared();
                const angSq = d.body.angularVelocity.lengthSquared();

                if (!d.isResting) {
                    // Check if die has settled
                    if (velSq < 0.15 && angSq < 0.15 && d.body.position.z < 2.0) {
                        d.isResting = true;
                        AudioEngine.playFloorThump(0.6);

                        // Critical Fanfare & VFX
                        if (d.critType === 'Nat20') {
                            AudioEngine.playNat20Fanfare();
                            spawnParticleBurst(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z, '#ffd700', 36);
                            d.badge = spawnBannerBadge(d.mesh, '★ NAT 20! ★', true);
                        } else if (d.critType === 'Nat1') {
                            AudioEngine.playNat1Fail();
                            spawnParticleBurst(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z, '#ff1744', 24);
                            d.badge = spawnBannerBadge(d.mesh, '⚠ NAT 1! ⚠', false);
                        }

                        // Schedule fadeout after 2.5s (only if no upcoming waves in this roll)
                        if (pendingWaves.length === 0) {
                            setTimeout(() => {
                                d.fade = true;
                            }, 2500);
                        }
                    }
                }
            }

            // Fadeout handling without disposing shared materials
            if (d.fade) {
                d.alpha -= dt * 1.8;
                if (d.mesh) {
                    d.mesh.position.z -= dt * 4.0; // Gentle drop
                }
                if (d.badge && d.badge.el) {
                    d.badge.el.style.opacity = Math.max(0, d.alpha);
                }

                if (d.alpha <= 0) {
                    d.isDone = true;
                    scene.remove(d.mesh);
                    if (d.mesh && d.mesh.geometry) d.mesh.geometry.dispose();
                    if (d.body && physicsWorld) physicsWorld.remove(d.body);
                    if (d.badge) {
                        if (d.badge.el) d.badge.el.remove();
                        d.badge.isDone = true;
                    }
                }
            }
        });

        activeDice = activeDice.filter((d) => !d.isDone);
    }

    function updateParticles(dt) {
        activeParticles.forEach((p) => {
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

        activeParticles = activeParticles.filter((p) => p.alpha > 0);
    }

    function updateBadges() {
        if (!camera || !renderer) return;

        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;

        activeBadges.forEach((b) => {
            if (b.isDone || !b.mesh || !b.el) {
                if (b.el) b.el.remove();
                b.isDone = true;
                return;
            }

            const pos = b.mesh.position.clone();
            pos.y += 1.3;
            pos.project(camera);

            const screenX = pos.x * halfW + halfW;
            const screenY = -(pos.y * halfH) + halfH;

            b.el.style.left = `${screenX}px`;
            b.el.style.top = `${screenY}px`;
        });

        activeBadges = activeBadges.filter((b) => !b.isDone);
    }

    function clear() {
        if (waveTransitionTimeout) {
            clearTimeout(waveTransitionTimeout);
            waveTransitionTimeout = null;
        }
        if (waveSafetyTimeout) {
            clearTimeout(waveSafetyTimeout);
            waveSafetyTimeout = null;
        }
        isWaveTransitionScheduled = false;
        pendingWaves = [];

        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        activeDice.forEach((d) => {
            scene.remove(d.mesh);
            if (d.mesh && d.mesh.geometry) d.mesh.geometry.dispose();
            if (d.body && physicsWorld) physicsWorld.remove(d.body);
            if (d.badge && d.badge.el) d.badge.el.remove();
        });
        activeDice = [];

        if (physicsWorld && activeWalls.length > 0) {
            activeWalls.forEach((w) => physicsWorld.remove(w));
            activeWalls = [];
        }

        activeParticles.forEach((p) => {
            scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
        });
        activeParticles = [];

        activeBadges.forEach((b) => {
            if (b.el) b.el.remove();
        });
        activeBadges = [];
    }

    return {
        init,
        roll,
        clear,
        computeOptimalGrid,
        isEnabled,
        setEnabled,
        setSfxEnabled,
        setVolume,
        setSkin,
        setThemeAudioProfile: AudioEngine.setThemeProfile,
        playUiClick: AudioEngine.playUiClick,
        SKINS
    };
});
