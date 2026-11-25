/**
 * vtt-canvas-token-borders.js
 * Geometric token shapes, CSS clip-paths, border styling presets,
 * canvas path geometry tracing, and curated thematic SVG fantasy frames.
 */

export const TOKEN_SHAPES = {
    circle: {
        id: 'circle',
        name: 'Circle',
        borderRadius: '50%',
        clipPath: null,
        description: 'Standard round token'
    },
    squircle: {
        id: 'squircle',
        name: 'Rounded Square',
        borderRadius: '20%',
        clipPath: null,
        description: 'Smooth squircle, blends tactical grid with organic token feel'
    },
    square: {
        id: 'square',
        name: 'Square',
        borderRadius: '4px',
        clipPath: null,
        description: 'Grid-aligned square for objects, swarms, and tactical units'
    },
    hexagon: {
        id: 'hexagon',
        name: 'Hexagon',
        borderRadius: '0',
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        description: 'Hexagonal silhouette for hex grids, sci-fi, and aberrations'
    },
    octagon: {
        id: 'octagon',
        name: 'Octagon',
        borderRadius: '0',
        clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
        description: 'Sturdy octagon for fortified foes and constructs'
    },
    shield: {
        id: 'shield',
        name: 'Shield',
        borderRadius: '0',
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)',
        description: 'Heraldic crest for paladins, knights, and guardians'
    }
};

export const TOKEN_BORDER_STYLES = {
    solid: { id: 'solid', name: 'Solid Line' },
    double: { id: 'double', name: 'Double Ring' },
    dashed: { id: 'dashed', name: 'Dashed Ring' },
    glow: { id: 'glow', name: 'Neon Glow' },
    frame: { id: 'frame', name: 'Thematic Frame' },
    none: { id: 'none', name: 'Borderless' }
};

export const THEMATIC_FRAMES = {
    none: { id: 'none', name: 'None' },
    ornate_gold: {
        id: 'ornate_gold',
        name: 'Ornate Gold',
        description: 'Classic heroic gold filigree frame with corner notches'
    },
    silver_mithral: {
        id: 'silver_mithral',
        name: 'Mithral Silver',
        description: 'Lustrous beveled silver ring with inner hairline'
    },
    gothic_iron: {
        id: 'gothic_iron',
        name: 'Gothic Iron',
        description: 'Heavy spiked iron band with dark rivet accents'
    },
    arcane_runic: {
        id: 'arcane_runic',
        name: 'Arcane Runes',
        description: 'Luminous magical ring inscribed with eldritch runes'
    },
    legendary_crown: {
        id: 'legendary_crown',
        name: 'Legendary Boss',
        description: 'Imperial spiked crown frame distinguishing major campaign bosses'
    }
};

/**
 * Traces the boundary path of a token on an HTML5 2D Canvas context.
 * Used for interaction glows, ghost drag tokens, and canvas clipping.
 */
export function traceTokenCanvasPath(ctx, cx, cy, radius, shape = 'circle') {
    ctx.beginPath();
    switch (shape) {
        case 'square': {
            const size = radius * 2;
            const x = cx - radius;
            const y = cy - radius;
            ctx.rect(x, y, size, size);
            break;
        }
        case 'squircle': {
            const size = radius * 2;
            const x = cx - radius;
            const y = cy - radius;
            const r = radius * 0.4;
            ctx.roundRect ? ctx.roundRect(x, y, size, size, r) : ctx.rect(x, y, size, size);
            break;
        }
        case 'hexagon': {
            ctx.moveTo(cx, cy - radius);
            ctx.lineTo(cx + radius, cy - radius * 0.5);
            ctx.lineTo(cx + radius, cy + radius * 0.5);
            ctx.lineTo(cx, cy + radius);
            ctx.lineTo(cx - radius, cy + radius * 0.5);
            ctx.lineTo(cx - radius, cy - radius * 0.5);
            ctx.closePath();
            break;
        }
        case 'octagon': {
            ctx.moveTo(cx - radius * 0.4, cy - radius);
            ctx.lineTo(cx + radius * 0.4, cy - radius);
            ctx.lineTo(cx + radius, cy - radius * 0.4);
            ctx.lineTo(cx + radius, cy + radius * 0.4);
            ctx.lineTo(cx + radius * 0.4, cy + radius);
            ctx.lineTo(cx - radius * 0.4, cy + radius);
            ctx.lineTo(cx - radius, cy + radius * 0.4);
            ctx.lineTo(cx - radius, cy - radius * 0.4);
            ctx.closePath();
            break;
        }
        case 'shield': {
            const x = cx - radius;
            const y = cy - radius;
            const w = radius * 2;
            const h = radius * 2;
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + h * 0.65);
            ctx.lineTo(cx, y + h);
            ctx.lineTo(x, y + h * 0.65);
            ctx.closePath();
            break;
        }
        case 'circle':
        default:
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            break;
    }
}

/**
 * Generates an SVG string for a thematic decorative token frame overlay.
 */
export function getThematicFrameSvg(framePreset, color = '#d4af37', width = 100, height = 100, tokenId = 'default') {
    if (!framePreset || framePreset === 'none') return '';

    const strokeCol = color || '#d4af37';
    const safeTokenId = String(tokenId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    switch (framePreset) {
        case 'ornate_gold':
            return `
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="${strokeCol}" stroke-width="3.5" filter="drop-shadow(0 0 2px rgba(0,0,0,0.8))"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="${strokeCol}" stroke-width="1" stroke-opacity="0.8" stroke-dasharray="3,2"/>
                    <!-- Ornate Cardinal Notches -->
                    <circle cx="50" cy="3" r="2.5" fill="${strokeCol}"/>
                    <circle cx="50" cy="97" r="2.5" fill="${strokeCol}"/>
                    <circle cx="3" cy="50" r="2.5" fill="${strokeCol}"/>
                    <circle cx="97" cy="50" r="2.5" fill="${strokeCol}"/>
                    <!-- Diagonal accents -->
                    <rect x="48.5" y="0.5" width="3" height="3" fill="${strokeCol}" transform="rotate(45 50 2)"/>
                    <rect x="48.5" y="94.5" width="3" height="3" fill="${strokeCol}" transform="rotate(45 50 96)"/>
                    <rect x="1.5" y="48.5" width="3" height="3" fill="${strokeCol}" transform="rotate(45 3 50)"/>
                    <rect x="95.5" y="48.5" width="3" height="3" fill="${strokeCol}" transform="rotate(45 97 50)"/>
                </svg>
            `;
        case 'silver_mithral':
            return `
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="silverGrad_${safeTokenId}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#ffffff"/>
                            <stop offset="35%" stop-color="#c0c0c0"/>
                            <stop offset="65%" stop-color="#808080"/>
                            <stop offset="100%" stop-color="#e0e0e0"/>
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="48" fill="none" stroke="url(#silverGrad_${safeTokenId})" stroke-width="4"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.6"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#222222" stroke-width="1" stroke-opacity="0.5"/>
                </svg>
            `;
        case 'gothic_iron':
            return `
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="#1f2421" stroke-width="4.5"/>
                    <circle cx="50" cy="50" r="48" fill="none" stroke="${strokeCol}" stroke-width="1.5" stroke-opacity="0.6"/>
                    <!-- Rivets / Studs -->
                    ${[0, 45, 90, 135, 180, 225, 270, 315]
                        .map((deg) => {
                            const rad = (deg * Math.PI) / 180;
                            const rx = 50 + 47.5 * Math.cos(rad);
                            const ry = 50 + 47.5 * Math.sin(rad);
                            return `<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="1.8" fill="#e0e0e0" stroke="#000" stroke-width="0.5"/>`;
                        })
                        .join('')}
                </svg>
            `;
        case 'arcane_runic':
            return `
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="${strokeCol}" stroke-width="2.5" filter="drop-shadow(0 0 3px ${strokeCol})"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="${strokeCol}" stroke-width="1" stroke-opacity="0.7"/>
                    <!-- Arcane Glyphs / Runes along ring -->
                    ${[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]
                        .map((deg) => {
                            const rad = (deg * Math.PI) / 180;
                            const gx = 50 + 46 * Math.cos(rad);
                            const gy = 50 + 46 * Math.sin(rad);
                            return `<polygon points="${gx},${gy - 1.5} ${gx + 1.5},${gy + 1.5} ${gx - 1.5},${gy + 1.5}" fill="${strokeCol}" opacity="0.85"/>`;
                        })
                        .join('')}
                </svg>
            `;
        case 'legendary_crown':
            return `
                <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="47.5" fill="none" stroke="${strokeCol}" stroke-width="3" filter="drop-shadow(0 0 4px ${strokeCol})"/>
                    <circle cx="50" cy="50" r="43.5" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-opacity="0.9"/>
                    <!-- Imperial 4-Corner Crown Spikes -->
                    <polygon points="50,0 54,6 46,6" fill="${strokeCol}" stroke="#000" stroke-width="0.5"/>
                    <polygon points="50,100 54,94 46,94" fill="${strokeCol}" stroke="#000" stroke-width="0.5"/>
                    <polygon points="0,50 6,54 6,46" fill="${strokeCol}" stroke="#000" stroke-width="0.5"/>
                    <polygon points="100,50 94,54 94,46" fill="${strokeCol}" stroke="#000" stroke-width="0.5"/>
                    <!-- Diagonal Crown Gems -->
                    <circle cx="17" cy="17" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                    <circle cx="83" cy="17" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                    <circle cx="17" cy="83" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                    <circle cx="83" cy="83" r="2.5" fill="#ef4444" stroke="#ffd700" stroke-width="0.8"/>
                </svg>
            `;
        default:
            return '';
    }
}

/**
 * Checks whether a URL or filename represents animated media (GIF or Video).
 */
export function isAnimatedMedia(url = '', fileName = '') {
    const target = `${url || ''} ${fileName || ''}`.toLowerCase().split('?')[0].trim();
    return (
        target.endsWith('.gif') ||
        target.includes('.gif') ||
        target.endsWith('.mp4') ||
        target.endsWith('.webm') ||
        target.endsWith('.ogg') ||
        target.endsWith('.m4v') ||
        target.endsWith('.mov') ||
        target.includes('.mp4') ||
        target.includes('.webm') ||
        target.includes('.ogg') ||
        target.includes('.m4v') ||
        target.includes('.mov') ||
        target.includes('youtube.com') ||
        target.includes('youtu.be')
    );
}

/**
 * Generates an SVG string for geometric token shape borders.
 * Renders in a 100x100 viewBox, perfectly attached to the token shape's outer boundary.
 */
export function getShapeBorderSvg(
    shape = 'circle',
    style = 'solid',
    color = '#007bff',
    width = 3,
    drawW = 100,
    drawH = 100,
    tokenId = 'default'
) {
    if (!style || style === 'none') return '';
    const strokeCol = color || '#007bff';
    const strokeW = Math.max(1, width || 2);
    const strokeScale = 100 / Math.max(drawW, 1);
    const strokeWidthAttr = Math.max(0.75, strokeW * strokeScale).toFixed(2);

    let dashAttr = '';
    if (style === 'dashed') {
        dashAttr = 'stroke-dasharray="6,4"';
    }

    let filterAttr = '';
    if (style === 'glow') {
        filterAttr = `filter="drop-shadow(0 0 3px ${strokeCol})"`;
    }

    let pathMarkup = '';
    let innerPathMarkup = '';

    switch (shape) {
        case 'hexagon':
            pathMarkup = `<polygon points="50,1 99,25.5 99,74.5 50,99 1,74.5 1,25.5" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthAttr}" stroke-linejoin="round" ${dashAttr} ${filterAttr}/>`;
            if (style === 'double') {
                const innerW = Math.max(0.6, strokeWidthAttr * 0.5);
                innerPathMarkup = `<polygon points="50,6 94,28 94,72 50,94 6,72 6,28" fill="none" stroke="${strokeCol}" stroke-width="${innerW}" stroke-linejoin="round"/>`;
            }
            break;
        case 'octagon':
            pathMarkup = `<polygon points="30,1 70,1 99,30 99,70 70,99 30,99 1,70 1,30" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthAttr}" stroke-linejoin="round" ${dashAttr} ${filterAttr}/>`;
            if (style === 'double') {
                const innerW = Math.max(0.6, strokeWidthAttr * 0.5);
                innerPathMarkup = `<polygon points="31,6 69,6 94,31 94,69 69,94 31,94 6,69 6,31" fill="none" stroke="${strokeCol}" stroke-width="${innerW}" stroke-linejoin="round"/>`;
            }
            break;
        case 'shield':
            pathMarkup = `<polygon points="1,1 99,1 99,65 50,99 1,65" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthAttr}" stroke-linejoin="round" ${dashAttr} ${filterAttr}/>`;
            if (style === 'double') {
                const innerW = Math.max(0.6, strokeWidthAttr * 0.5);
                innerPathMarkup = `<polygon points="6,6 94,6 94,63 50,94 6,63" fill="none" stroke="${strokeCol}" stroke-width="${innerW}" stroke-linejoin="round"/>`;
            }
            break;
        case 'squircle':
            pathMarkup = `<rect x="1" y="1" width="98" height="98" rx="20" ry="20" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthAttr}" ${dashAttr} ${filterAttr}/>`;
            if (style === 'double') {
                const innerW = Math.max(0.6, strokeWidthAttr * 0.5);
                innerPathMarkup = `<rect x="6" y="6" width="88" height="88" rx="16" ry="16" fill="none" stroke="${strokeCol}" stroke-width="${innerW}"/>`;
            }
            break;
        case 'square':
            pathMarkup = `<rect x="1" y="1" width="98" height="98" rx="4" ry="4" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthAttr}" ${dashAttr} ${filterAttr}/>`;
            if (style === 'double') {
                const innerW = Math.max(0.6, strokeWidthAttr * 0.5);
                innerPathMarkup = `<rect x="6" y="6" width="88" height="88" rx="2" ry="2" fill="none" stroke="${strokeCol}" stroke-width="${innerW}"/>`;
            }
            break;
        case 'circle':
        default: {
            const r = Math.max(1, 50 - strokeWidthAttr / 2).toFixed(2);
            pathMarkup = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthAttr}" ${dashAttr} ${filterAttr}/>`;
            if (style === 'double') {
                const innerW = Math.max(0.6, strokeWidthAttr * 0.5);
                const innerR = Math.max(1, 50 - strokeWidthAttr - 2).toFixed(2);
                innerPathMarkup = `<circle cx="50" cy="50" r="${innerR}" fill="none" stroke="${strokeCol}" stroke-width="${innerW}"/>`;
            }
            break;
        }
    }

    return `
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="position:absolute; top:0; left:0; pointer-events:none; z-index:3; overflow:visible;" xmlns="http://www.w3.org/2000/svg">
            ${pathMarkup}
            ${innerPathMarkup}
        </svg>
    `;
}

/**
 * Prompts user when animated media (GIF or Video) is detected on upload,
 * allowing them to choose between keeping animation intact or cropping a static frame.
 */
export function promptAnimatedMediaChoice(options = {}) {
    const { url = '', fileName = '', onDirect = () => {}, onCrop = () => {}, onCancel = () => {} } = options;
    if (typeof document === 'undefined') return onDirect();

    const existingOverlay = document.getElementById('modal-animated-media-prompt-overlay');
    if (existingOverlay) existingOverlay.remove();

    const isVideo = url.match(/\.(mp4|webm|ogg|m4v|mov)$/i) || fileName.match(/\.(mp4|webm|ogg|m4v|mov)$/i);

    const overlay = document.createElement('div');
    overlay.id = 'modal-animated-media-prompt-overlay';
    overlay.className = 'vtt-sheet-submodal-overlay vtt-sheet-submodal-high';
    overlay.style.cssText =
        'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); z-index:10050; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);';

    const card = document.createElement('div');
    card.className = 'login-card glassmorphism animated-fade-in';
    card.style.cssText =
        'max-width:420px; width:90%; background:var(--color-bg-secondary, #1a1d24); border:1px solid var(--color-gold-base, #d4af37); border-radius:8px; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.8); text-align:center;';

    const mediaPreview = isVideo
        ? `<video src="${url}" autoplay loop muted playsinline style="max-width:140px; max-height:140px; border-radius:8px; border:2px solid var(--color-border-subtle, #333); margin:0 auto 12px; display:block; object-fit:cover;"></video>`
        : `<img src="${url}" style="max-width:140px; max-height:140px; border-radius:8px; border:2px solid var(--color-border-subtle, #333); margin:0 auto 12px; display:block; object-fit:cover;">`;

    card.innerHTML = `
        <div style="font-size:1.6rem; color:var(--color-gold-base, #d4af37); margin-bottom:8px;">
            <i class="fa-solid fa-film"></i>
        </div>
        <h3 style="margin:0 0 8px 0; font-size:1.15rem; color:var(--color-text-primary, #fff); font-family:var(--font-heading, serif);">
            Animated Media Detected
        </h3>
        <p style="font-size:0.82rem; color:var(--color-text-secondary, #94a3b8); margin:0 0 14px 0; line-height:1.4;">
            This file contains animation. Would you like to keep it playing live on the tabletop, or crop a static frame?
        </p>
        ${mediaPreview}
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:14px;">
            <button id="btn-animated-direct" class="btn btn-primary" style="padding:8px 12px; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-play"></i> Keep Animated (Direct)
            </button>
            <button id="btn-animated-crop" class="btn btn-secondary" style="padding:8px 12px; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-crop"></i> Crop into Static Token
            </button>
            <button id="btn-animated-cancel" class="btn btn-ghost" style="padding:4px 8px; font-size:0.8rem; color:var(--color-text-muted, #888); margin-top:4px;">
                Cancel
            </button>
        </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
        overlay.remove();
    };

    card.querySelector('#btn-animated-direct').onclick = () => {
        cleanup();
        onDirect();
    };

    card.querySelector('#btn-animated-crop').onclick = () => {
        cleanup();
        onCrop();
    };

    card.querySelector('#btn-animated-cancel').onclick = () => {
        cleanup();
        onCancel();
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            cleanup();
            onCancel();
        }
    };
}
