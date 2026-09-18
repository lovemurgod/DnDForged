import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const partneredDir = path.join(rootDir, '5etools-src', 'data', 'partnered');
const prereleaseDir = path.join(rootDir, '5etools-src', 'data', 'prerelease');

// Cache in-memory for multiple compiler invocations
let cachedBrewFiles = null;

export function loadAllBrewFiles({ includePartnered = true, includePrerelease = true } = {}) {
    if (cachedBrewFiles) return cachedBrewFiles;

    const dirsToScan = [];
    if (includePartnered && fs.existsSync(partneredDir)) dirsToScan.push({ dir: partneredDir, type: 'partnered' });
    if (includePrerelease && fs.existsSync(prereleaseDir)) dirsToScan.push({ dir: prereleaseDir, type: 'prerelease' });

    const files = [];

    for (const { dir, type } of dirsToScan) {
        const fileNames = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const fileName of fileNames) {
            const fullPath = path.join(dir, fileName);
            try {
                const raw = fs.readFileSync(fullPath, 'utf8');
                const json = JSON.parse(raw);
                files.push({
                    fileName,
                    fullPath,
                    type,
                    json
                });
            } catch (err) {
                console.warn(`[brew-data-loader] Warning: Failed to parse ${fileName}: ${err.message}`);
            }
        }
    }

    cachedBrewFiles = files;
    return files;
}

/**
 * Extract all entities of a given property (e.g. 'class', 'spell', 'monster', etc.)
 * across all downloaded partnered and prerelease files.
 */
export function getBrewEntities(propName, options = {}) {
    const files = loadAllBrewFiles(options);
    const results = [];

    for (const file of files) {
        const data = file.json;
        if (Array.isArray(data[propName])) {
            for (const entity of data[propName]) {
                if (!entity || typeof entity !== 'object') continue;
                // Annotate with origin metadata if not present
                if (!entity._originFile) entity._originFile = file.fileName;
                if (!entity._originType) entity._originType = file.type;
                results.push(entity);
            }
        }
    }

    return results;
}

/**
 * Standardize source codes and generate a concise UI badge label.
 */
export function getSourceBadge(source) {
    if (!source) return '';
    const s = String(source).toUpperCase().trim();
    if (s.startsWith('UA')) return 'UA';
    if (s.includes('PUGILIST')) return 'PUG24';
    if (s.includes('GRIMHOLLOW') || s.includes('GH')) return 'GH';
    if (s.includes('HUMBLEWOOD') || s.includes('HW')) return 'HW';
    if (s.includes('DRAKKENHEIM') || s.includes('DOD')) return 'DoD';
    if (s.includes('TALDOREI')) return 'CR';
    if (s.includes('FLEE') || s.includes('MCDM') || s.includes('ILLRIGGER')) return 'MCDM';
    if (s.includes('KOBOLD') || s.includes('TOB')) return 'KP';
    if (s.includes('GRIFFON')) return 'TGS';
    if (s.includes('VALDA') || s.includes('GUNSLINGER')) return 'VSoS';
    if (s.includes('LOTR')) return 'LotR';
    if (s.includes('CROOKEDMOON')) return 'CM';
    return s.length > 6 ? s.slice(0, 5) : s;
}
