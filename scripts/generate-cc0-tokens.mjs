import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const outArgIdx = process.argv.indexOf('--out');
const targetTokenDir =
    outArgIdx !== -1 && process.argv[outArgIdx + 1]
        ? path.resolve(rootDir, process.argv[outArgIdx + 1])
        : path.join(rootDir, '.release-stage', 'vtt', 'img', 'bestiary', 'tokens');

const catalogPathArg = process.argv.indexOf('--catalog');
const catalogPath =
    catalogPathArg !== -1 && process.argv[catalogPathArg + 1]
        ? path.resolve(rootDir, process.argv[catalogPathArg + 1])
        : path.join(rootDir, '.release-stage', 'vtt', 'data', 'bestiary-catalog.json');

console.log(`\n======================================================`);
console.log(`🎨 GENERATING CC0 OPEN-LICENSE SRD CREATURE TOKENS`);
console.log(`📁 Target Directory: ${targetTokenDir}`);
console.log(`======================================================\n`);

if (!fs.existsSync(targetTokenDir)) {
    fs.mkdirSync(targetTokenDir, { recursive: true });
}

// Creature type color palettes for CC0 archetype tokens
const TYPE_COLORS = {
    aberration: { primary: '#7c3aed', secondary: '#c084fc', border: '#a855f7' },
    beast: { primary: '#15803d', secondary: '#86efac', border: '#22c55e' },
    celestial: { primary: '#ca8a04', secondary: '#fef08a', border: '#eab308' },
    construct: { primary: '#475569', secondary: '#cbd5e1', border: '#94a3b8' },
    dragon: { primary: '#b91c1c', secondary: '#fca5a5', border: '#ef4444' },
    elemental: { primary: '#c2410c', secondary: '#fdba74', border: '#f97316' },
    fey: { primary: '#059669', secondary: '#6ee7b7', border: '#10b981' },
    fiend: { primary: '#991b1b', secondary: '#f87171', border: '#dc2626' },
    giant: { primary: '#0369a1', secondary: '#7dd3fc', border: '#0ea5e9' },
    humanoid: { primary: '#1d4ed8', secondary: '#93c5fd', border: '#3b82f6' },
    monstrosity: { primary: '#4c1d95', secondary: '#c4b5fd', border: '#8b5cf6' },
    ooze: { primary: '#65a30d', secondary: '#bef264', border: '#84cc16' },
    plant: { primary: '#166534', secondary: '#a7f3d0', border: '#16a34a' },
    undead: { primary: '#374151', secondary: '#9ca3af', border: '#6b7280' }
};

function generateSvgToken(name, typeStr) {
    const cleanName = (name || 'Creature').trim();
    const words = cleanName.split(/\s+/).filter(Boolean);
    let initials = words.length > 1 ? words[0][0] + words[1][0] : cleanName.slice(0, 2);
    initials = (initials || 'C').toUpperCase();

    const cleanType = String(typeStr || 'monstrosity')
        .toLowerCase()
        .trim();
    const matchedType = Object.keys(TYPE_COLORS).find((t) => cleanType.includes(t)) || 'monstrosity';
    const palette = TYPE_COLORS[matchedType];

    return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="70%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.secondary}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${palette.primary}" stop-opacity="0.1"/>
    </radialGradient>
  </defs>
  
  <!-- Token Base Circle -->
  <circle cx="64" cy="64" r="60" fill="url(#bgGrad)"/>
  <circle cx="64" cy="64" r="54" fill="url(#ringGrad)"/>
  
  <!-- Outer Gold & Type Border Rings -->
  <circle cx="64" cy="64" r="60" fill="none" stroke="${palette.border}" stroke-width="4"/>
  <circle cx="64" cy="64" r="56" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-opacity="0.7"/>
  <circle cx="64" cy="64" r="48" fill="none" stroke="#d4af37" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.4"/>
  
  <!-- Creature Initials -->
  <text x="65" y="70" font-family="'Cinzel', 'Georgia', serif" font-size="34" font-weight="bold" fill="#000000" text-anchor="middle" opacity="0.8">${initials}</text>
  <text x="64" y="69" font-family="'Cinzel', 'Georgia', serif" font-size="34" font-weight="bold" fill="${palette.secondary}" text-anchor="middle">${initials}</text>
  
  <!-- Creature Subtype Badge at bottom -->
  <text x="64" y="104" font-family="'Inter', sans-serif" font-size="9" font-weight="600" letter-spacing="1" fill="#94a3b8" text-anchor="middle">${matchedType.toUpperCase()}</text>
</svg>`;
}

function normalizeTokenName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Æ/g, 'AE')
        .replace(/æ/g, 'ae')
        .replace(/[<>:"/\\|?*]/g, '')
        .trim();
}

function resolveRelativeTokenSvgPath(creature) {
    const rawUrl = creature.tokenUrl || creature.tokenImg || '';
    const match = String(rawUrl).match(/^\/?img\/bestiary\/tokens\/(.+)$/i);
    if (match && match[1]) {
        return match[1].replace(/\.[^.]+$/, '.svg');
    }
    const source = creature.source || 'MM';
    const cleanName = normalizeTokenName(creature.name);
    return cleanName ? `${source}/${cleanName}.svg` : null;
}

let generatedCount = 0;

if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    for (const creature of catalog) {
        const relSvgPath = resolveRelativeTokenSvgPath(creature);
        if (!relSvgPath) continue;

        const svgPath = path.join(targetTokenDir, ...relSvgPath.split('/'));
        const srcDir = path.dirname(svgPath);
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir, { recursive: true });
        }

        // Write genuine SVG token only (never write SVG XML into .webp files)
        fs.writeFileSync(svgPath, generateSvgToken(creature.name, creature.type), 'utf8');

        // Remove any legacy fake .webp file matching this token name if present
        const legacyWebpPath = svgPath.replace(/\.svg$/i, '.webp');
        if (fs.existsSync(legacyWebpPath)) {
            fs.unlinkSync(legacyWebpPath);
        }

        generatedCount++;
    }
}

console.log(`✅ Generated ${generatedCount} CC0 open-license creature tokens in ${targetTokenDir}`);
