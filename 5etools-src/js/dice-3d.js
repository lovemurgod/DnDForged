/**
 * DnDForged Professional 3D WebGL Dice Engine
 * Architecture: Three.js + Cannon.js Physics with Planar UV-Mapped Polyhedra,
 * Order-Preserving Collision Barrier Lanes, Multi-Skin Themes,
 * Zero-Distortion Planar Face Texturing, and Web Audio SFX.
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
    const STORAGE_KEY_SKIN = 'vtt_3d_dice_skin';

    // Global Scale Multiplier (15% reduction for optimal tabletop ergonomics)
    const SCALE = 0.85;

    // State
    let isInitialized = false;
    let containerEl = null;
    let canvasEl = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let physicsWorld = null;
    let animFrameId = null;
    let activeDice = [];
    let activeParticles = [];
    let activeBadges = [];
    let activeWalls = [];

    // Dice Skin Presets
    const SKINS = {
        obsidian_gold: {
            name: 'Obsidian & Gold',
            bg: '#121214',
            bgLight: '#26262b',
            border: '#ffd700',
            text: '#fff8e7',
            shadow: 'rgba(0, 0, 0, 0.95)',
            emissive: 0x221a00,
            roughness: 0.2,
            metalness: 0.7,
            particleColor: '#ffd700'
        },
        ruby_ember: {
            name: 'Ruby Ember',
            bg: '#2b0305',
            bgLight: '#54080c',
            border: '#ff5252',
            text: '#ffffff',
            shadow: 'rgba(0, 0, 0, 0.95)',
            emissive: 0x330000,
            roughness: 0.25,
            metalness: 0.4,
            particleColor: '#ff5252'
        },
        sapphire_frost: {
            name: 'Sapphire Frost',
            bg: '#04162e',
            bgLight: '#0a2e5c',
            border: '#00e5ff',
            text: '#ffffff',
            shadow: 'rgba(0, 0, 0, 0.95)',
            emissive: 0x002233,
            roughness: 0.15,
            metalness: 0.8,
            particleColor: '#80d8ff'
        },
        amethyst_void: {
            name: 'Amethyst Void',
            bg: '#1c052e',
            bgLight: '#390b5e',
            border: '#d500f9',
            text: '#ffffff',
            shadow: 'rgba(0, 0, 0, 0.95)',
            emissive: 0x220033,
            roughness: 0.2,
            metalness: 0.6,
            particleColor: '#ea80fc'
        },
        classic_ivory: {
            name: 'Classic Ivory',
            bg: '#eae5d9',
            bgLight: '#f7f4ec',
            border: '#c2b8a3',
            text: '#1a1a1a',
            shadow: 'rgba(0, 0, 0, 0.25)',
            emissive: 0x111111,
            roughness: 0.45,
            metalness: 0.1,
            particleColor: '#d7ccc8'
        }
    };

    function getActiveSkin() {
        const key = localStorage.getItem(STORAGE_KEY_SKIN) || 'obsidian_gold';
        return SKINS[key] || SKINS.obsidian_gold;
    }

    // Web Audio Synthesizer (Zero-Asset Dependencies)
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

    // Planar Face Texture Generator with Zero-Distortion UV Coordinates
    const TextureFactory = (function () {
        const cache = new Map();

        function createFaceMaterial(val, skin, shapeType = 'tri', isCrit = false, isDropped = false) {
            const cacheKey = `${val}_${skin.name}_${shapeType}_${isCrit}_${isDropped}`;
            if (cache.has(cacheKey)) {
                return cache.get(cacheKey);
            }

            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Draw Background with Specular Vignette
            const bgGrad = ctx.createRadialGradient(128, 128, 20, 128, 128, 140);
            bgGrad.addColorStop(0, skin.bgLight);
            bgGrad.addColorStop(1, skin.bg);
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, 256, 256);

            // Shape-specific Bevel Border Outline
            ctx.strokeStyle = skin.border;
            ctx.lineWidth = 10;

            if (shapeType === 'quad') {
                // d6 square
                ctx.strokeRect(10, 10, 236, 236);
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 6;
                ctx.strokeRect(16, 16, 224, 224);
            } else if (shapeType === 'pentagon') {
                // d12 pentagon border
                drawPolygonBorder(ctx, 5, 128, 128, 115);
            } else if (shapeType === 'kite') {
                // d10/d100 kite border
                drawKiteBorder(ctx, 128, 128, 115);
            } else {
                // Triangle border (d4, d8, d20)
                drawTriangleBorder(ctx, 128, 128, 115);
            }

            // Engraved Typography
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const str = String(val);
            const fontSize = str.length > 2 ? 80 : (str.length === 2 ? 96 : 120);
            ctx.font = `900 ${fontSize}px "Outfit", "Cinzel", "Segoe UI", sans-serif`;

            // Deep engraved drop shadow
            ctx.fillStyle = skin.shadow;
            ctx.fillText(str, 128, 134);

            // Core Inked Face Text
            ctx.fillStyle = skin.text;
            if (isCrit) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 14;
            }
            ctx.fillText(str, 128, 128);

            // Underline for 6 and 9 to distinguish orientation
            if (str === '6' || str === '9') {
                ctx.fillStyle = skin.text;
                ctx.fillRect(96, 186, 64, 8);
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;

            const material = new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff,
                emissive: isCrit ? (skin.emissive || 0xffb300) : 0x000000,
                emissiveIntensity: isCrit ? 0.45 : 0.0,
                roughness: skin.roughness || 0.2,
                metalness: skin.metalness || 0.6,
                transparent: true,
                opacity: isDropped ? 0.45 : 1.0
            });

            cache.set(cacheKey, material);
            return material;
        }

        function drawTriangleBorder(ctx, cx, cy, r) {
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        function drawPolygonBorder(ctx, sides, cx, cy, r) {
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        function drawKiteBorder(ctx, cx, cy, r) {
            ctx.beginPath();
            ctx.moveTo(cx, cy - r * 0.95);      // Top apex
            ctx.lineTo(cx + r * 0.85, cy);      // Right wing
            ctx.lineTo(cx, cy + r * 0.95);      // Bottom apex
            ctx.lineTo(cx - r * 0.85, cy);      // Left wing
            ctx.closePath();
            ctx.stroke();
        }

        return {
            createFaceMaterial
        };
    })();

    // Authentic Polyhedral Geometries with Mathematically Mapped Planar UVs
    const GeometryFactory = (function () {

        // d4: Tetrahedron (4 triangular faces with planar UV coordinates)
        function buildD4(skin, isCrit, isDropped) {
            const r = 1.35 * SCALE;
            const v = [
                new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(r),
                new THREE.Vector3(-1, -1, 1).normalize().multiplyScalar(r),
                new THREE.Vector3(-1, 1, -1).normalize().multiplyScalar(r),
                new THREE.Vector3(1, -1, -1).normalize().multiplyScalar(r)
            ];

            const faceIndices = [
                [0, 1, 2], // Face 1
                [0, 2, 3], // Face 2
                [0, 3, 1], // Face 3
                [1, 3, 2]  // Face 4
            ];

            const faceValues = [1, 2, 3, 4];
            return assemblePolyhedron(v, faceIndices, faceValues, 'tri', skin, isCrit, isDropped);
        }

        // d6: Cube (6 quad faces with standard opposite sum = 7)
        function buildD6(skin, isCrit, isDropped) {
            const s = 1.45 * SCALE;
            const h = s / 2;

            // 6 faces * 4 vertices = 24 vertices
            const vertices = [];
            const uvs = [];
            const normals = [];
            const faceValues = [1, 6, 2, 5, 3, 4]; // +X, -X, +Y, -Y, +Z, -Z
            const faceNormals = [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, -1, 0),
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 0, -1)
            ];

            const faceQuads = [
                // +X: (h, -h, -h) -> (h, h, -h) -> (h, h, h) -> (h, -h, h)
                [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]],
                // -X: (-h, -h, h) -> (-h, h, h) -> (-h, h, -h) -> (-h, -h, -h)
                [[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]],
                // +Y: (-h, h, -h) -> (h, h, -h) -> (h, h, h) -> (-h, h, h)
                [[-h, h, -h], [h, h, -h], [h, h, h], [-h, h, h]],
                // -Y: (-h, -h, h) -> (h, -h, h) -> (h, -h, -h) -> (-h, -h, -h)
                [[-h, -h, h], [h, -h, h], [h, -h, -h], [-h, -h, -h]],
                // +Z: (-h, -h, h) -> (h, -h, h) -> (h, h, h) -> (-h, h, h)
                [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]],
                // -Z: (h, -h, -h) -> (-h, -h, -h) -> (-h, h, -h) -> (h, h, -h)
                [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]]
            ];

            const geom = new THREE.BufferGeometry();
            const posArr = [];
            const uvArr = [];
            const groupMaterials = [];

            faceQuads.forEach((quad, idx) => {
                // Triangle 1: 0, 1, 2
                posArr.push(...quad[0], ...quad[1], ...quad[2]);
                uvArr.push(0, 0, 1, 0, 1, 1);
                // Triangle 2: 0, 2, 3
                posArr.push(...quad[0], ...quad[2], ...quad[3]);
                uvArr.push(0, 0, 1, 1, 0, 1);

                geom.addGroup(idx * 6, 6, idx);
                groupMaterials.push(TextureFactory.createFaceMaterial(faceValues[idx], skin, 'quad', isCrit, isDropped));
            });

            geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
            geom.computeVertexNormals();

            return {
                mesh: new THREE.Mesh(geom, groupMaterials),
                faceValues: faceValues,
                normals: faceNormals
            };
        }

        // d8: Octahedron (8 triangular faces with opposite sum = 9)
        function buildD8(skin, isCrit, isDropped) {
            const r = 1.35 * SCALE;
            const v = [
                new THREE.Vector3(0, r, 0),  // 0: +Y
                new THREE.Vector3(0, -r, 0), // 1: -Y
                new THREE.Vector3(r, 0, 0),  // 2: +X
                new THREE.Vector3(-r, 0, 0), // 3: -X
                new THREE.Vector3(0, 0, r),  // 4: +Z
                new THREE.Vector3(0, 0, -r)  // 5: -Z
            ];

            const faceIndices = [
                [0, 2, 4], [1, 4, 2], // 1 & 8
                [0, 4, 3], [1, 3, 4], // 2 & 7
                [0, 3, 5], [1, 5, 3], // 3 & 6
                [0, 5, 2], [1, 2, 5]  // 4 & 5
            ];

            const faceValues = [1, 8, 2, 7, 3, 6, 4, 5];
            return assemblePolyhedron(v, faceIndices, faceValues, 'tri', skin, isCrit, isDropped);
        }

        // d10 & d100: True Pentagonal Trapezohedron with 10 Kite Faces
        function buildD10(skin, isPercentile = false, isCrit = false, isDropped = false) {
            const r = 1.35 * SCALE;
            const H = r * 1.2;
            const R = r * 0.95;
            const rMid = r * 0.85;

            const topApex = new THREE.Vector3(0, H, 0);
            const botApex = new THREE.Vector3(0, -H, 0);
            const ring = [];

            for (let i = 0; i < 10; i++) {
                const angle = (i * Math.PI) / 5;
                const y = (i % 2 === 0) ? (H * 0.15) : (-H * 0.15);
                const curR = (i % 2 === 0) ? R : rMid;
                ring.push(new THREE.Vector3(Math.cos(angle) * curR, y, Math.sin(angle) * curR));
            }

            const posArr = [];
            const uvArr = [];
            const normals = [];
            const geom = new THREE.BufferGeometry();
            const groupMaterials = [];

            const faceValues = isPercentile
                ? ['00', '50', '10', '60', '20', '70', '30', '80', '40', '90']
                : [1, 6, 2, 7, 3, 8, 4, 9, 5, 10];

            for (let i = 0; i < 10; i++) {
                const next = (i + 1) % 10;
                const nextNext = (i + 2) % 10;

                let tri1, tri2;
                if (i % 2 === 0) {
                    // Top Kite: topApex -> ring[i] -> ring[next] -> ring[nextNext]
                    tri1 = [topApex, ring[i], ring[next]];
                    tri2 = [topApex, ring[next], ring[nextNext]];
                } else {
                    // Bottom Kite: botApex -> ring[next] -> ring[i] -> ring[nextNext]
                    tri1 = [botApex, ring[next], ring[i]];
                    tri2 = [botApex, ring[nextNext], ring[next]];
                }

                posArr.push(tri1[0].x, tri1[0].y, tri1[0].z, tri1[1].x, tri1[1].y, tri1[1].z, tri1[2].x, tri1[2].y, tri1[2].z);
                uvArr.push(0.5, 0.95, 0.05, 0.35, 0.5, 0.05);

                posArr.push(tri2[0].x, tri2[0].y, tri2[0].z, tri2[1].x, tri2[1].y, tri2[1].z, tri2[2].x, tri2[2].y, tri2[2].z);
                uvArr.push(0.5, 0.95, 0.5, 0.05, 0.95, 0.35);

                // Compute normal of the kite
                const n1 = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(tri1[1], tri1[0]),
                    new THREE.Vector3().subVectors(tri1[2], tri1[0])
                ).normalize();
                normals.push(n1);

                geom.addGroup(i * 6, 6, i);
                groupMaterials.push(TextureFactory.createFaceMaterial(faceValues[i], skin, 'kite', isCrit, isDropped));
            }

            geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
            geom.computeVertexNormals();

            return {
                mesh: new THREE.Mesh(geom, groupMaterials),
                faceValues: faceValues,
                normals: normals
            };
        }

        // d12: Dodecahedron (12 regular pentagons with opposite sum = 13)
        function buildD12(skin, isCrit, isDropped) {
            const r = 1.25 * SCALE;
            const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
            const a = 1 / Math.sqrt(3);
            const b = a / phi;
            const c = a * phi;

            // 20 vertices
            const rawV = [
                [-a, -a, -a], [-a, -a, a], [-a, a, -a], [-a, a, a],
                [a, -a, -a], [a, -a, a], [a, a, -a], [a, a, a],
                [0, -b, -c], [0, -b, c], [0, b, -c], [0, b, c],
                [-b, -c, 0], [-b, c, 0], [b, -c, 0], [b, c, 0],
                [-c, 0, -b], [-c, 0, b], [c, 0, -b], [c, 0, b]
            ].map(p => new THREE.Vector3(p[0] * r, p[1] * r, p[2] * r));

            // 12 pentagons (5 vertices each)
            const pentagonIndices = [
                [3, 11, 7, 15, 13],  [0, 8, 4, 14, 12],  // 1 & 12
                [1, 9, 5, 14, 12],   [2, 10, 6, 15, 13], // 2 & 11
                [7, 19, 5, 9, 11],   [0, 16, 2, 10, 8],  // 3 & 10
                [3, 17, 1, 9, 11],   [4, 18, 6, 10, 8],  // 4 & 9
                [2, 16, 0, 12, 13],  [5, 19, 7, 15, 14], // 5 & 8
                [6, 18, 4, 14, 15],  [1, 17, 3, 13, 12]  // 6 & 7
            ];

            const faceValues = [1, 12, 2, 11, 3, 10, 4, 9, 5, 8, 6, 7];
            const posArr = [];
            const uvArr = [];
            const normals = [];
            const geom = new THREE.BufferGeometry();
            const groupMaterials = [];

            pentagonIndices.forEach((pIdxs, fIdx) => {
                const center = new THREE.Vector3();
                pIdxs.forEach(idx => center.add(rawV[idx]));
                center.divideScalar(5);

                const norm = center.clone().normalize();
                normals.push(norm);

                // 5 triangles radiating from pentagon center
                for (let i = 0; i < 5; i++) {
                    const next = (i + 1) % 5;
                    const v1 = rawV[pIdxs[i]];
                    const v2 = rawV[pIdxs[next]];

                    posArr.push(center.x, center.y, center.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);

                    const a1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                    const a2 = (next * 2 * Math.PI) / 5 - Math.PI / 2;
                    uvArr.push(0.5, 0.5, 0.5 + Math.cos(a1) * 0.45, 0.5 + Math.sin(a1) * 0.45, 0.5 + Math.cos(a2) * 0.45, 0.5 + Math.sin(a2) * 0.45);
                }

                geom.addGroup(fIdx * 15, 15, fIdx);
                groupMaterials.push(TextureFactory.createFaceMaterial(faceValues[fIdx], skin, 'pentagon', isCrit, isDropped));
            });

            geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
            geom.computeVertexNormals();

            return {
                mesh: new THREE.Mesh(geom, groupMaterials),
                faceValues: faceValues,
                normals: normals
            };
        }

        // d20: Icosahedron (20 equilateral triangular faces with opposite sum = 21)
        function buildD20(skin, isCrit, isDropped) {
            const r = 1.35 * SCALE;
            const t = (1 + Math.sqrt(5)) / 2;

            // 12 vertices
            const v = [
                [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
                [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
            ].map(p => new THREE.Vector3(p[0], p[1], p[2]).normalize().multiplyScalar(r));

            // 20 faces organized in standard opposite pairs summing to 21
            const faceIndices = [
                [0, 11, 5], [3, 9, 4],   // 1 & 20
                [0, 5, 1],  [3, 6, 2],   // 2 & 19
                [0, 1, 7],  [3, 2, 4],   // 3 & 18
                [0, 7, 10], [3, 8, 9],   // 4 & 17
                [0, 10, 11],[3, 4, 8],   // 5 & 16
                [1, 5, 9],  [2, 6, 10],  // 6 & 15
                [5, 11, 4], [7, 8, 6],   // 7 & 14
                [11, 10, 2],[1, 9, 8],   // 8 & 13
                [10, 7, 6], [5, 4, 9],   // 9 & 12
                [7, 1, 8],  [11, 2, 4]   // 10 & 11
            ];

            const faceValues = [
                1, 20, 2, 19, 3, 18, 4, 17, 5, 16,
                6, 15, 7, 14, 8, 13, 9, 12, 10, 11
            ];

            return assemblePolyhedron(v, faceIndices, faceValues, 'tri', skin, isCrit, isDropped);
        }

        function assemblePolyhedron(vertices, faceIndices, faceValues, shapeType, skin, isCrit, isDropped) {
            const posArr = [];
            const uvArr = [];
            const normals = [];
            const geom = new THREE.BufferGeometry();
            const groupMaterials = [];

            faceIndices.forEach((f, idx) => {
                const v0 = vertices[f[0]];
                const v1 = vertices[f[1]];
                const v2 = vertices[f[2]];

                posArr.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
                uvArr.push(0.5, 0.95, 0.05, 0.1, 0.95, 0.1);

                const norm = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v1, v0),
                    new THREE.Vector3().subVectors(v2, v0)
                ).normalize();
                normals.push(norm);

                geom.addGroup(idx * 3, 3, idx);
                groupMaterials.push(TextureFactory.createFaceMaterial(faceValues[idx], skin, shapeType, isCrit, isDropped));
            });

            geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
            geom.computeVertexNormals();

            return {
                mesh: new THREE.Mesh(geom, groupMaterials),
                faceValues: faceValues,
                normals: normals
            };
        }

        function createDie(faces, skin, isPercentile = false, isCrit = false, isDropped = false) {
            const f = parseInt(faces, 10);
            if (f === 4) return buildD4(skin, isCrit, isDropped);
            if (f === 6) return buildD6(skin, isCrit, isDropped);
            if (f === 8) return buildD8(skin, isCrit, isDropped);
            if (f === 10) return buildD10(skin, false, isCrit, isDropped);
            if (f === 100) return buildD10(skin, true, isCrit, isDropped);
            if (f === 12) return buildD12(skin, isCrit, isDropped);
            return buildD20(skin, isCrit, isDropped);
        }

        return {
            createDie
        };
    })();

    // Initialize Global Three.js Scene, Cannon.js Physics & Overlay
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffdf0, 1.3);
        dirLight.position.set(12, 28, 22);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x90caf9, 0.5);
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

    function setSkin(skinKey) {
        if (SKINS[skinKey]) {
            localStorage.setItem(STORAGE_KEY_SKIN, skinKey);
        }
    }

    // Particle Burst System (for Nat 20 / Nat 1)
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

    // Roll Trigger with Order-Preserving Physics Barrier Lanes & Dual Percentile Support
    function roll(diceList, options = {}) {
        if (!isEnabled()) return false;
        if (!isInitialized) {
            const ok = init();
            if (!ok) return false;
        }

        if (!Array.isArray(diceList) || diceList.length === 0) return false;

        // Automatically expand any d100 rolls into a dual-dice pair: (Percentile tens + Units d10)
        const expandedDiceList = [];
        diceList.forEach(d => {
            const faces = extractFaces(d);
            const val = extractVal(d);

            if (faces === 100) {
                // Tens: 00-90, Units: 1-10 (or 0)
                const tensNum = Math.floor(((val - 1) % 100) / 10) * 10;
                const unitsNum = ((val - 1) % 10) + 1;

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

        const skin = getActiveSkin();

        // Initial Audio Clatter
        AudioEngine.playDiceClatter(1.0);

        expandedDiceList.forEach((dice, idx) => {
            const faces = extractFaces(dice);
            const val = dice.val !== undefined ? dice.val : extractVal(dice);
            const isDropped = Boolean(dice && typeof dice === 'object' && (dice.dropped || dice.isDropped || dice.discarded));

            let critType = null;
            if (faces === 20 || (dice && typeof dice === 'object' && (dice.isCritSuccess || dice.isCritFail))) {
                if (val === 20 || (dice && typeof dice === 'object' && dice.isCritSuccess)) {
                    critType = 'Nat20';
                } else if (val === 1 || (dice && typeof dice === 'object' && dice.isCritFail)) {
                    critType = 'Nat1';
                }
            }

            const built = GeometryFactory.createDie(faces, skin, faces === 100, critType === 'Nat20', isDropped);
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

            // Compute Target Landing Quaternion for the predetermined rolled value
            const targetValStr = String(val);
            let targetFaceIdx = built.faceValues.findIndex(fv => String(fv) === targetValStr);
            if (targetFaceIdx === -1) targetFaceIdx = 0;

            const targetLocalNormal = built.normals[targetFaceIdx] || new THREE.Vector3(0, 1, 0);

            // Target camera vector (slightly tilted upward toward camera for optimal readability)
            const targetWorldDir = new THREE.Vector3(0, 0.45, 0.89).normalize();
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(targetLocalNormal, targetWorldDir);

            scene.add(mesh);

            // Physics Die Entity
            const dieEntity = {
                mesh: mesh,
                faces: faces,
                val: val,
                critType: critType,
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
                    d.mesh.position.y = d.floorY + Math.sin(t * Math.PI) * 0.22;

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

                        // Auto fade-out timer (2.5s resting visibility)
                        if (!d.fadeTimerStarted) {
                            d.fadeTimerStarted = true;
                            setTimeout(() => { d.fade = true; }, 2500);
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
        setSkin,
        SKINS
    };
}));
