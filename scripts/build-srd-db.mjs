import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Target directory for SRD datasets
const outArgIdx = process.argv.indexOf('--out');
const targetDataDir = outArgIdx !== -1 && process.argv[outArgIdx + 1]
    ? path.resolve(rootDir, process.argv[outArgIdx + 1])
    : path.join(rootDir, '.release-stage', 'vtt', 'data');

console.log(`\n======================================================`);
console.log(`⚔️  BUILDING CLEAN SRD 5.1 & SRD 5.2 COMPENDIUM`);
console.log(`📁 Target Output: ${targetDataDir}`);
console.log(`======================================================\n`);

if (!fs.existsSync(targetDataDir)) {
    fs.mkdirSync(targetDataDir, { recursive: true });
}

function runScript(scriptName) {
    const scriptPath = path.join(rootDir, 'scripts', scriptName);
    console.log(`\n▶️ Running ${scriptName} (--srd-only)...`);
    execFileSync('node', [scriptPath, '--srd-only', '--out', targetDataDir], {
        stdio: 'inherit',
        cwd: rootDir
    });
}

// 1. Compile Spells
runScript('build-spell-db.mjs');

// 2. Compile Creatures
runScript('build-creature-db.mjs');

// 3. Compile Items
runScript('build-item-db.mjs');

// 4. Compile Compendium (Classes, Races, Feats, Backgrounds)
runScript('build-compendium-db.mjs');

// 5. Compile Handouts & Rules
runScript('build-handout-db.mjs');

// 6. Export clean SRD class files to targetDataDir/class
console.log('\n▶️ Generating clean SRD class definitions in class/...');
const srcClassDir = path.join(rootDir, '5etools-src', 'data', 'class');
const dstClassDir = path.join(targetDataDir, 'class');
if (!fs.existsSync(dstClassDir)) {
    fs.mkdirSync(dstClassDir, { recursive: true });
}

if (fs.existsSync(srcClassDir)) {
    for (const file of fs.readdirSync(srcClassDir)) {
        if (!file.startsWith('class-') || !file.endsWith('.json')) continue;
        const filePath = path.join(srcClassDir, file);
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const cleanObj = {};

            // Filter class array to SRD
            if (Array.isArray(raw.class)) {
                cleanObj.class = raw.class.filter(c => c.srd !== undefined || c.srd52 !== undefined);
            }

            // Filter subclass array to SRD
            if (Array.isArray(raw.subclass)) {
                cleanObj.subclass = raw.subclass.filter(sc => sc.srd !== undefined || sc.srd52 !== undefined);
            }

            // Filter classFeature array to SRD class features
            if (Array.isArray(raw.classFeature)) {
                cleanObj.classFeature = raw.classFeature.filter(cf => cf.srd !== undefined || cf.srd52 !== undefined);
            }

            // Filter subclassFeature array to SRD subclass features
            if (Array.isArray(raw.subclassFeature)) {
                cleanObj.subclassFeature = raw.subclassFeature.filter(sf => sf.srd !== undefined || sf.srd52 !== undefined);
            }

            if ((cleanObj.class && cleanObj.class.length > 0) || (cleanObj.subclass && cleanObj.subclass.length > 0)) {
                fs.writeFileSync(path.join(dstClassDir, file), JSON.stringify(cleanObj, null, 2), 'utf8');
            }
        } catch (err) {
            console.warn(`[build-srd-db] Notice copying class file ${file}:`, err.message);
        }
    }
}

// 7. Summary calculation
let totalBytes = 0;
let fileCount = 0;
function calcSize(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
            calcSize(full);
        } else {
            fileCount++;
            totalBytes += fs.statSync(full).size;
        }
    }
}
calcSize(targetDataDir);

console.log(`\n======================================================`);
console.log(`✅ CLEAN SRD DATABASE COMPLETE`);
console.log(`📊 Total Files: ${fileCount}`);
console.log(`💾 Total Size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`======================================================\n`);
