// DnDForged Procedural Vector FX Subsystem
// Renders distinct procedural vector signatures for all 13 D&D damage types plus Healing and Temp HP.
// Built as hardware-accelerated inline SVG overlays for 100% reliable visibility on #vtt-html-overlays.
// Enhanced with two-tone high-contrast vector lines, real-time stroke-dashoffset tracing, and zero filter overhead.

export const DAMAGE_TYPE_COLORS = {
    fire: '#f97316',
    cold: '#38bdf8',
    ice: '#38bdf8',
    lightning: '#facc15',
    electric: '#facc15',
    thunder: '#7dd3fc',
    acid: '#a3e635',
    poison: '#4ade80',
    radiant: '#fef08a',
    necrotic: '#c084fc',
    force: '#e879f9',
    psychic: '#f472b6',
    slashing: '#ef4444',
    piercing: '#f87171',
    bludgeoning: '#fb7185'
};

/**
 * Generates an animated procedural SVG string for the specified damage or healing type.
 * @param {string} type - Normalized damage type (e.g. 'fire', 'slashing', 'heal')
 * @param {number} radius - Base token radius
 * @param {Object} options - Optional overrides (angle, flipX)
 * @returns {string} Inline SVG markup
 */
export function generateDamageTypeSVG(type, radius = 25, options = {}) {
    const norm = (type || 'untyped').trim().toLowerCase();
    const size = Math.max(70, Math.round(radius * 2.8));
    const half = size / 2;
    const r = radius * 1.05;

    let content = '';

    if (norm.includes('heal')) {
        // Healing: Soothing Emerald Bloom + Two-Tone Verdant Sparkle Stars
        let sparkles = '';
        for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI) / 4;
            const dist = r * (0.35 + (i % 3) * 0.25);
            const sx = (half + Math.cos(ang) * dist).toFixed(1);
            const sy = (half + Math.sin(ang) * (dist * 0.7) - (i % 2) * 8).toFixed(1);
            const rOuter = (2.8 - (i % 2) * 0.8).toFixed(1);
            const rInner = (rOuter * 0.55).toFixed(1);
            sparkles += `
                <circle cx="${sx}" cy="${sy}" r="${rOuter}" fill="#16a34a" class="vtt-sparkle-float"/>
                <circle cx="${sx}" cy="${sy}" r="${rInner}" fill="#ffffff" class="vtt-sparkle-float"/>
            `;
        }
        content = `
            <defs>
                <radialGradient id="grad_heal_${size}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                    <stop offset="35%" stop-color="#86efac" stop-opacity="0.85"/>
                    <stop offset="70%" stop-color="#22c55e" stop-opacity="0.45"/>
                    <stop offset="100%" stop-color="#15803d" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" fill="url(#grad_heal_${size})" class="vtt-fx-bloom"/>
            ${sparkles}
        `;
    } else if (norm.includes('temphp') || norm.includes('temp_hp')) {
        // Temp HP: Protective Sapphire Ward Ring + Two-Tone Barrier Brackets
        let brackets = '';
        for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            const bx = (half + Math.cos(ang) * (r * 1.05)).toFixed(1);
            const by = (half + Math.sin(ang) * (r * 1.05)).toFixed(1);
            brackets += `
                <circle cx="${bx}" cy="${by}" r="4.2" fill="#0284c7"/>
                <circle cx="${bx}" cy="${by}" r="2.2" fill="#ffffff"/>
            `;
        }
        content = `
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" stroke="#0284c7" stroke-width="4.5" fill="none" class="vtt-fx-expand"/>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" stroke="#38bdf8" stroke-width="2.5" fill="none" class="vtt-fx-expand"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.82).toFixed(1)}" stroke="#ffffff" stroke-width="1.8" fill="none" opacity="0.9"/>
            ${brackets}
        `;
    } else if (norm.includes('fire')) {
        // 1. Fire: Blooming incandescent core + Two-Tone dancing ember sparks
        let embers = '';
        for (let i = 0; i < 8; i++) {
            const ang = (i * 1.618 * Math.PI * 2) % (Math.PI * 2);
            const dist = r * (0.35 + (i % 4) * 0.2);
            const ex = (half + Math.cos(ang) * dist).toFixed(1);
            const ey = (half + Math.sin(ang) * (dist * 0.6) - (i % 3) * 6).toFixed(1);
            const rOuter = (3.2 - (i % 2) * 0.8).toFixed(1);
            const rInner = (rOuter * 0.55).toFixed(1);
            embers += `
                <circle cx="${ex}" cy="${ey}" r="${rOuter}" fill="#ea580c" class="vtt-ember-rise"/>
                <circle cx="${ex}" cy="${ey}" r="${rInner}" fill="#ffffff" class="vtt-ember-rise"/>
            `;
        }
        content = `
            <defs>
                <radialGradient id="grad_fire_${size}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="25%" stop-color="#fff5b4" stop-opacity="0.95"/>
                    <stop offset="55%" stop-color="#f97316" stop-opacity="0.8"/>
                    <stop offset="85%" stop-color="#dc2626" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#991b1b" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" fill="url(#grad_fire_${size})" class="vtt-fx-bloom"/>
            ${embers}
        `;
    } else if (norm.includes('cold') || norm.includes('ice')) {
        // 2. Cold: Glacial frost core + 6 Two-Tone branching snowflake arms with diamond tips
        let arms = '';
        for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3;
            const armLen = r * 1.15;
            const ex = half + Math.cos(ang) * armLen;
            const ey = half + Math.sin(ang) * armLen;
            const midX = half + Math.cos(ang) * (armLen * 0.55);
            const midY = half + Math.sin(ang) * (armLen * 0.55);
            const bAng1 = ang + Math.PI / 4;
            const bAng2 = ang - Math.PI / 4;
            const bLen = armLen * 0.25;

            arms += `
                <line x1="${half}" y1="${half}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round"/>
                <line x1="${half}" y1="${half}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                <line x1="${midX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(midX + Math.cos(bAng1) * bLen).toFixed(1)}" y2="${(midY + Math.sin(bAng1) * bLen).toFixed(1)}" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
                <line x1="${midX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(midX + Math.cos(bAng1) * bLen).toFixed(1)}" y2="${(midY + Math.sin(bAng1) * bLen).toFixed(1)}" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="${midX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(midX + Math.cos(bAng2) * bLen).toFixed(1)}" y2="${(midY + Math.sin(bAng2) * bLen).toFixed(1)}" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
                <line x1="${midX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${(midX + Math.cos(bAng2) * bLen).toFixed(1)}" y2="${(midY + Math.sin(bAng2) * bLen).toFixed(1)}" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
                <rect x="${(ex - 3).toFixed(1)}" y="${(ey - 3).toFixed(1)}" width="6" height="6" fill="#0284c7" transform="rotate(45, ${ex.toFixed(1)}, ${ey.toFixed(1)})"/>
                <rect x="${(ex - 1.5).toFixed(1)}" y="${(ey - 1.5).toFixed(1)}" width="3" height="3" fill="#ffffff" transform="rotate(45, ${ex.toFixed(1)}, ${ey.toFixed(1)})"/>
            `;
        }
        content = `
            <defs>
                <radialGradient id="grad_cold_${size}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="40%" stop-color="#67e8f9" stop-opacity="0.85"/>
                    <stop offset="80%" stop-color="#0284c7" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#0369a1" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" fill="url(#grad_cold_${size})" class="vtt-fx-bloom"/>
            ${arms}
        `;
    } else if (norm.includes('lightning') || norm.includes('electric')) {
        // 3. Lightning: High-intensity arc flash + 3 Two-Tone jagged bolts with pathLength
        let bolts = '';
        for (let b = 0; b < 3; b++) {
            const baseAng = (b * Math.PI * 2) / 3 + 0.35;
            let points = `${half},${half}`;
            const steps = 5;
            for (let s = 1; s <= steps; s++) {
                const dist = r * 1.25 * (s / steps);
                const jitter = ((s % 2 === 0 ? 1 : -1) * 9).toFixed(1);
                const nx = (half + Math.cos(baseAng) * dist - Math.sin(baseAng) * jitter).toFixed(1);
                const ny = (half + Math.sin(baseAng) * dist + Math.cos(baseAng) * jitter).toFixed(1);
                points += ` ${nx},${ny}`;
            }
            bolts += `
                <polyline points="${points}" stroke="#ca8a04" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="bevel" fill="none" pathLength="100" class="vtt-lightning-bolt" opacity="0.7"/>
                <polyline points="${points}" stroke="#facc15" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="bevel" fill="none" pathLength="100" class="vtt-lightning-bolt"/>
                <polyline points="${points}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="bevel" fill="none" pathLength="100" class="vtt-lightning-bolt"/>
            `;
        }
        content = `
            <circle cx="${half}" cy="${half}" r="${(r * 0.85).toFixed(1)}" fill="#fef08a" opacity="0.45" class="vtt-fx-bloom"/>
            ${bolts}
        `;
    } else if (norm.includes('thunder')) {
        // 4. Thunder: Triple acoustic shockwave rings + Two-Tone radial compression dashes
        let dashes = '';
        for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI) / 4;
            const d1 = r * 0.55;
            const d2 = r * 1.15;
            const x1 = (half + Math.cos(ang) * d1).toFixed(1);
            const y1 = (half + Math.sin(ang) * d1).toFixed(1);
            const x2 = (half + Math.cos(ang) * d2).toFixed(1);
            const y2 = (half + Math.sin(ang) * d2).toFixed(1);
            dashes += `
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round"/>
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
            `;
        }
        content = `
            <circle cx="${half}" cy="${half}" r="${(r * 0.65).toFixed(1)}" stroke="#0284c7" stroke-width="4.5" fill="none" opacity="0.9" class="vtt-fx-expand"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.65).toFixed(1)}" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.95" class="vtt-fx-expand"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.95).toFixed(1)}" stroke="#0284c7" stroke-width="3.5" fill="none" opacity="0.8" class="vtt-fx-expand"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.95).toFixed(1)}" stroke="#bae6fd" stroke-width="1.8" fill="none" opacity="0.85" class="vtt-fx-expand"/>
            <circle cx="${half}" cy="${half}" r="${(r * 1.25).toFixed(1)}" stroke="#38bdf8" stroke-width="2.2" fill="none" opacity="0.6" class="vtt-fx-expand"/>
            ${dashes}
        `;
    } else if (norm.includes('acid')) {
        // 5. Acid: Caustic sizzling puddle + Two-Tone effervescent popping bubbles
        let bubbles = '';
        for (let i = 0; i < 7; i++) {
            const bAng = i * 0.9 * Math.PI;
            const bDist = r * 0.7 * ((i % 4) / 4 + 0.25);
            const bx = (half + Math.cos(bAng) * bDist).toFixed(1);
            const by = (half + Math.sin(bAng) * bDist + (i % 2) * 5).toFixed(1);
            const bRadius = (3.5 - (i % 2) * 0.8).toFixed(1);
            const bInnerR = (bRadius * 0.45).toFixed(1);
            bubbles += `
                <circle cx="${bx}" cy="${by}" r="${bRadius}" fill="#65a30d" stroke="#a3e635" stroke-width="1.5" class="vtt-bubble-pop"/>
                <circle cx="${(parseFloat(bx) - 0.7).toFixed(1)}" cy="${(parseFloat(by) - 0.7).toFixed(1)}" r="${bInnerR}" fill="#ffffff" class="vtt-bubble-pop"/>
            `;
        }
        content = `
            <defs>
                <radialGradient id="grad_acid_${size}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="30%" stop-color="#d9f99d" stop-opacity="0.9"/>
                    <stop offset="65%" stop-color="#84cc16" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="#4d7c0f" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" fill="url(#grad_acid_${size})" class="vtt-fx-bloom"/>
            ${bubbles}
        `;
    } else if (norm.includes('poison')) {
        // 6. Poison: 5 Two-Tone swirling billowing toxic miasma smoke puffs
        let puffs = '';
        for (let i = 0; i < 5; i++) {
            const ang = (i * Math.PI * 2) / 5;
            const dist = r * 0.45;
            const px = (half + Math.cos(ang) * dist).toFixed(1);
            const py = (half + Math.sin(ang) * dist).toFixed(1);
            const puffR = (r * 0.65).toFixed(1);
            const innerPuffR = (r * 0.38).toFixed(1);
            puffs += `
                <circle cx="${px}" cy="${py}" r="${puffR}" fill="rgba(22, 101, 52, 0.45)" stroke="#15803d" stroke-width="2" class="vtt-fx-expand"/>
                <circle cx="${px}" cy="${py}" r="${innerPuffR}" fill="rgba(74, 222, 128, 0.55)" stroke="#86efac" stroke-width="1" class="vtt-fx-expand"/>
            `;
        }
        content = puffs;
    } else if (norm.includes('radiant')) {
        // 7. Radiant: Sacred golden celestial halo + Two-Tone 4-point holy starburst flare
        const rayLen = r * 1.45;
        const diagLen = rayLen * 0.55;
        content = `
            <defs>
                <radialGradient id="grad_radiant_${size}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
                    <stop offset="30%" stop-color="#fef08a" stop-opacity="0.85"/>
                    <stop offset="70%" stop-color="#eab308" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#ca8a04" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${(r * 1.15).toFixed(1)}" fill="url(#grad_radiant_${size})" class="vtt-fx-bloom"/>
            <polygon points="${half},${(half - rayLen).toFixed(1)} ${(half + 5.5).toFixed(1)},${half} ${half},${(half + rayLen).toFixed(1)} ${(half - 5.5).toFixed(1)},${half}" fill="#ca8a04" class="vtt-star-flare"/>
            <polygon points="${half},${(half - rayLen * 0.9).toFixed(1)} ${(half + 3.2).toFixed(1)},${half} ${half},${(half + rayLen * 0.9).toFixed(1)} ${(half - 3.2).toFixed(1)},${half}" fill="#ffffff" class="vtt-star-flare"/>
            <polygon points="${(half - rayLen).toFixed(1)},${half} ${half},${(half - 5.5).toFixed(1)} ${(half + rayLen).toFixed(1)},${half} ${half},${(half + 5.5).toFixed(1)}" fill="#ca8a04" class="vtt-star-flare"/>
            <polygon points="${(half - rayLen * 0.9).toFixed(1)},${half} ${half},${(half - 3.2).toFixed(1)} ${(half + rayLen * 0.9).toFixed(1)},${half} ${half},${(half + 3.2).toFixed(1)}" fill="#ffffff" class="vtt-star-flare"/>
            <line x1="${(half - diagLen).toFixed(1)}" y1="${(half - diagLen).toFixed(1)}" x2="${(half + diagLen).toFixed(1)}" y2="${(half + diagLen).toFixed(1)}" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/>
            <line x1="${(half - diagLen).toFixed(1)}" y1="${(half - diagLen).toFixed(1)}" x2="${(half + diagLen).toFixed(1)}" y2="${(half + diagLen).toFixed(1)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            <line x1="${(half - diagLen).toFixed(1)}" y1="${(half + diagLen).toFixed(1)}" x2="${(half + diagLen).toFixed(1)}" y2="${(half - diagLen).toFixed(1)}" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/>
            <line x1="${(half - diagLen).toFixed(1)}" y1="${(half + diagLen).toFixed(1)}" x2="${(half + diagLen).toFixed(1)}" y2="${(half - diagLen).toFixed(1)}" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        `;
    } else if (norm.includes('necrotic')) {
        // 8. Necrotic: Obsidian dark void core + 5 Two-Tone writhing dark soul tendrils
        let tendrils = '';
        for (let i = 0; i < 5; i++) {
            const ang = (i * Math.PI * 2) / 5;
            const c1x = (half + Math.cos(ang) * (r * 0.5) + (i % 2 === 0 ? 8 : -8)).toFixed(1);
            const c1y = (half + Math.sin(ang) * (r * 0.5) + (i % 2 === 0 ? -8 : 8)).toFixed(1);
            const ex = (half + Math.cos(ang) * (r * 1.3)).toFixed(1);
            const ey = (half + Math.sin(ang) * (r * 1.3)).toFixed(1);
            tendrils += `
                <path d="M ${half} ${half} Q ${c1x} ${c1y} ${ex} ${ey}" stroke="#3b0764" stroke-width="5" stroke-linecap="round" fill="none"/>
                <path d="M ${half} ${half} Q ${c1x} ${c1y} ${ex} ${ey}" stroke="#c084fc" stroke-width="3" stroke-linecap="round" fill="none"/>
                <path d="M ${half} ${half} Q ${c1x} ${c1y} ${ex} ${ey}" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>
            `;
        }
        content = `
            <defs>
                <radialGradient id="grad_necrotic_${size}">
                    <stop offset="0%" stop-color="#0f0a19" stop-opacity="0.95"/>
                    <stop offset="40%" stop-color="#581c87" stop-opacity="0.85"/>
                    <stop offset="80%" stop-color="#9333ea" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#3b0764" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" fill="url(#grad_necrotic_${size})" class="vtt-fx-bloom"/>
            ${tendrils}
        `;
    } else if (norm.includes('force')) {
        // 9. Force: Double concentric dimensional distortion rings + Two-Tone orbiting kinetic pulse beads
        let beads = '';
        for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3;
            const bx = (half + Math.cos(ang) * r).toFixed(1);
            const by = (half + Math.sin(ang) * r).toFixed(1);
            beads += `
                <circle cx="${bx}" cy="${by}" r="4" fill="#a21caf"/>
                <circle cx="${bx}" cy="${by}" r="2" fill="#ffffff"/>
            `;
        }
        content = `
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" stroke="#701a75" stroke-width="5.5" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" stroke="#e879f9" stroke-width="3.5" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${half}" cy="${half}" r="${r.toFixed(1)}" stroke="#ffffff" stroke-width="1.6" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.65).toFixed(1)}" stroke="#ffffff" stroke-width="1.8" fill="none" opacity="0.85"/>
            ${beads}
        `;
    } else if (norm.includes('psychic')) {
        // 10. Psychic: 2 concentric undulating telepathic brain-wave sine curves with Two-Tone lines
        let waves = '';
        for (let w = 0; w < 2; w++) {
            const waveR = r * (0.65 + w * 0.45);
            let pathD = '';
            const pts = 24;
            for (let p = 0; p <= pts; p++) {
                const th = (p / pts) * Math.PI * 2;
                const waveOffset = Math.sin(th * 6 + w * 2) * 5;
                const curR = waveR + waveOffset;
                const px = (half + Math.cos(th) * curR).toFixed(1);
                const py = (half + Math.sin(th) * curR).toFixed(1);
                pathD += (p === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
            }
            pathD += ' Z';
            waves += `
                <path d="${pathD}" stroke="#831843" stroke-width="4.5" fill="none" opacity="${w === 0 ? 0.95 : 0.75}" class="vtt-fx-expand"/>
                <path d="${pathD}" stroke="#f472b6" stroke-width="2.8" fill="none" opacity="${w === 0 ? 0.95 : 0.75}" class="vtt-fx-expand"/>
                <path d="${pathD}" stroke="#ffffff" stroke-width="1.2" fill="none" opacity="${w === 0 ? 1 : 0.85}" class="vtt-fx-expand"/>
            `;
        }
        content = waves;
    } else if (norm.includes('slashing')) {
        // 11. Slashing: Curved white blade arc cutting diagonally with Two-Tone pathLength drawing
        const startX = (half - r * 0.95).toFixed(1);
        const startY = (half - r * 0.85).toFixed(1);
        const endX = (half + r * 0.95).toFixed(1);
        const endY = (half + r * 0.85).toFixed(1);
        const ctrlX = (half + r * 0.25).toFixed(1);
        const ctrlY = (half - r * 0.25).toFixed(1);
        content = `
            <path d="M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}" stroke="rgba(220, 38, 38, 0.75)" stroke-width="8" stroke-linecap="round" fill="none" pathLength="100" class="vtt-slash-trail"/>
            <path d="M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}" stroke="#dc2626" stroke-width="5" stroke-linecap="round" fill="none" pathLength="100" class="vtt-slash-cut"/>
            <path d="M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" fill="none" pathLength="100" class="vtt-slash-cut"/>
        `;
    } else if (norm.includes('piercing')) {
        // 12. Piercing: Pinpoint puncture spark + penetrating Two-Tone thrust line + cone shockwaves
        const px1 = (half - r * 0.9).toFixed(1);
        const py1 = (half - r * 0.9).toFixed(1);
        content = `
            <line x1="${px1}" y1="${py1}" x2="${half}" y2="${half}" stroke="#b91c1c" stroke-width="5" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${px1}" y1="${py1}" x2="${half}" y2="${half}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <circle cx="${half}" cy="${half}" r="6" fill="#b91c1c"/>
            <circle cx="${half}" cy="${half}" r="3" fill="#ffffff"/>
            <path d="M ${(half - r * 0.6).toFixed(1)} ${(half + r * 0.2).toFixed(1)} Q ${half} ${(half + r * 0.8).toFixed(1)} ${(half + r * 0.6).toFixed(1)} ${(half + r * 0.2).toFixed(1)}" stroke="#ef4444" stroke-width="3" fill="none" stroke-linecap="round" class="vtt-fx-expand"/>
            <path d="M ${(half - r * 0.6).toFixed(1)} ${(half + r * 0.2).toFixed(1)} Q ${half} ${(half + r * 0.8).toFixed(1)} ${(half + r * 0.6).toFixed(1)} ${(half + r * 0.2).toFixed(1)}" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round" class="vtt-fx-expand"/>
        `;
    } else if (norm.includes('bludgeoning')) {
        // 13. Bludgeoning: Concussive heavy compression shockwave with Two-Tone lines + kinetic debris flecks
        let debris = '';
        for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3 + 0.25;
            const dist = r * 0.85;
            const dx = (half + Math.cos(ang) * dist).toFixed(1);
            const dy = (half + Math.sin(ang) * dist).toFixed(1);
            debris += `
                <circle cx="${dx}" cy="${dy}" r="3.5" fill="#475569"/>
                <circle cx="${dx}" cy="${dy}" r="1.8" fill="${i % 2 === 0 ? '#ffffff' : '#94a3b8'}"/>
            `;
        }
        content = `
            <circle cx="${half}" cy="${half}" r="${(r * 0.95).toFixed(1)}" stroke="#9f1239" stroke-width="6" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.95).toFixed(1)}" stroke="#fb7185" stroke-width="3.5" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            <circle cx="${half}" cy="${half}" r="${(r * 0.95).toFixed(1)}" stroke="#ffffff" stroke-width="1.8" fill="none" class="vtt-fx-expand vtt-concussive-pop"/>
            ${debris}
        `;
    } else {
        // 14. Untyped / Generic Physical Fallback: Dual Two-Tone cross-slash (X strike) with pathLength
        const d = r * 0.7;
        content = `
            <defs>
                <radialGradient id="grad_untyped_${size}">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                    <stop offset="35%" stop-color="#ef4444" stop-opacity="0.8"/>
                    <stop offset="100%" stop-color="#b91c1c" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <circle cx="${half}" cy="${half}" r="${(r * 0.9).toFixed(1)}" fill="url(#grad_untyped_${size})" class="vtt-fx-bloom"/>
            <line x1="${(half - d).toFixed(1)}" y1="${(half - d).toFixed(1)}" x2="${(half + d).toFixed(1)}" y2="${(half + d).toFixed(1)}" stroke="#991b1b" stroke-width="5" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${(half - d).toFixed(1)}" y1="${(half - d).toFixed(1)}" x2="${(half + d).toFixed(1)}" y2="${(half + d).toFixed(1)}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${(half + d).toFixed(1)}" y1="${(half - d).toFixed(1)}" x2="${(half - d).toFixed(1)}" y2="${(half + d).toFixed(1)}" stroke="#991b1b" stroke-width="5" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
            <line x1="${(half + d).toFixed(1)}" y1="${(half - d).toFixed(1)}" x2="${(half - d).toFixed(1)}" y2="${(half + d).toFixed(1)}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" pathLength="100" class="vtt-slash-cut"/>
        `;
    }

    // Recommendation 4: Strike Angle & Direction Variance
    let transformStr = '';
    const isDirectional = norm.includes('slashing') || norm.includes('piercing') || norm === 'untyped' || norm.includes('physical');
    if (isDirectional) {
        const angle = options.angle !== undefined ? options.angle : (Math.random() * 70 - 35).toFixed(1);
        const flipX = options.flipX !== undefined ? options.flipX : (Math.random() > 0.5);
        transformStr = `transform="rotate(${angle} ${half} ${half})${flipX ? ` translate(${size}, 0) scale(-1, 1)` : ''}"`;
    } else {
        const angle = options.angle !== undefined ? options.angle : (Math.random() * 360).toFixed(1);
        transformStr = `transform="rotate(${angle} ${half} ${half})"`;
    }

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="vtt-procedural-vector-fx ${norm}">
            <g ${transformStr}>
                ${content}
            </g>
        </svg>
    `.trim();
}

/**
 * Mounts procedural vector SVG graphics directly into #vtt-html-overlays.
 */
export function spawnProceduralCombatFX(x, y, radius, damageTypes, meta = {}, isHeal = false, isTempHp = false) {
    if (typeof document === 'undefined') return;
    const overlayContainer =
        document.getElementById('vtt-html-overlays') ||
        document.getElementById('canvas-container') ||
        document.body;
    if (!overlayContainer) return;

    let posX = x;
    let posY = y;
    const tokenId = meta && meta.tokenId;

    // Anchor precisely on the token DOM element if present
    if (tokenId) {
        const tokenNode = document.getElementById('asset_node_' + tokenId);
        const uiNode = document.getElementById('token_ui_' + tokenId);
        if (tokenNode && tokenNode.style.left) {
            const left = parseFloat(tokenNode.style.left);
            const top = parseFloat(tokenNode.style.top);
            const width = parseFloat(tokenNode.style.width) || ((radius || 25) * 2);
            const height = parseFloat(tokenNode.style.height) || ((radius || 25) * 2);
            if (!isNaN(left) && !isNaN(top)) {
                posX = left + width / 2;
                posY = top + height / 2;
            }
        } else if (uiNode) {
            const width = parseFloat(uiNode.style.width) || ((radius || 25) * 2);
            const height = parseFloat(uiNode.style.height) || ((radius || 25) * 2);
            const matrixMatch = uiNode.style.transform && uiNode.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
            if (matrixMatch) {
                posX = parseFloat(matrixMatch[1]) + width / 2;
                posY = parseFloat(matrixMatch[2]) + height / 2;
            }
        }
    }

    const types = Array.isArray(damageTypes) && damageTypes.length > 0 ? damageTypes : ['untyped'];
    const rawType = (types[0] ? String(types[0]) : 'untyped').trim().toLowerCase();

    let typeClass = 'untyped';

    if (isHeal || rawType.includes('heal')) {
        typeClass = 'heal';
    } else if (isTempHp || rawType.includes('temphp') || rawType.includes('temp_hp')) {
        typeClass = 'temphp';
    } else {
        const knownTypes = [
            'fire', 'cold', 'ice', 'lightning', 'electric', 'thunder',
            'acid', 'poison', 'radiant', 'necrotic', 'force', 'psychic',
            'slashing', 'piercing', 'bludgeoning'
        ];
        for (const key of knownTypes) {
            if (rawType.includes(key)) {
                typeClass = key;
                break;
            }
        }
    }

    // Mount the Procedural Vector SVG Container (500ms Hyper-Snappy playback)
    try {
        const container = document.createElement('div');
        container.className = `vtt-procedural-fx-container ${typeClass}`;
        container.style.left = `${posX}px`;
        container.style.top = `${posY}px`;
        container.innerHTML = generateDamageTypeSVG(typeClass, radius || 25, meta);

        const cleanup = () => {
            if (typeof container.remove === 'function') container.remove();
            else if (container.parentNode && typeof container.parentNode.removeChild === 'function') container.parentNode.removeChild(container);
        };
        container.onanimationend = cleanup;
        setTimeout(cleanup, 900);
        overlayContainer.appendChild(container);
    } catch (e) {
        console.warn('[VTT] Error mounting procedural vector FX node:', e);
    }
}
