import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const stageDir = path.join(rootDir, '.release-stage');

console.log(`\n======================================================`);
console.log(`📦 PREPARING CLEAN SRD DISTRIBUTION RELEASE STAGE`);
console.log(`📁 Staging Directory: ${stageDir}`);
console.log(`======================================================\n`);

// 1. Clean and initialize .release-stage
if (fs.existsSync(stageDir)) {
    console.log('🧹 Cleaning previous staging directory...');
    fs.rmSync(stageDir, { recursive: true, force: true });
}
fs.mkdirSync(stageDir, { recursive: true });

// 2. Helper to copy directory recursively with filter
function copyDirFiltered(src, dst, filterFn = () => true) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });

    for (const item of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, item.name);
        const dstPath = path.join(dst, item.name);

        if (!filterFn(srcPath, item)) continue;

        if (item.isDirectory()) {
            copyDirFiltered(srcPath, dstPath, filterFn);
        } else if (item.isFile()) {
            fs.copyFileSync(srcPath, dstPath);
        }
    }
}

// 3. Compile clean SRD data into .release-stage/vtt/data
const stageDataDir = path.join(stageDir, 'vtt', 'data');
console.log('\n⚙️ Step 1: Compiling clean SRD 5.1 & SRD 5.2 datasets...');
execFileSync('node', [path.join(rootDir, 'scripts', 'build-srd-db.mjs'), '--out', stageDataDir], {
    stdio: 'inherit',
    cwd: rootDir
});

// 4. Generate CC0 tokens into .release-stage/vtt/img/bestiary/tokens
const stageTokenDir = path.join(stageDir, 'vtt', 'img', 'bestiary', 'tokens');
const catalogFile = path.join(stageDataDir, 'bestiary-catalog.json');
console.log('\n🎨 Step 2: Generating CC0 open-license creature tokens...');
execFileSync('node', [
    path.join(rootDir, 'scripts', 'generate-cc0-tokens.mjs'),
    '--catalog', catalogFile,
    '--out', stageTokenDir
], {
    stdio: 'inherit',
    cwd: rootDir
});

// 5. Copy Brand & App Assets (Omit copyrighted covers and adventures)
console.log('\n📁 Step 3: Copying brand assets and client files...');
// Copy root images (logos only)
copyDirFiltered(path.join(rootDir, 'img'), path.join(stageDir, 'img'));
// Copy root css
copyDirFiltered(path.join(rootDir, 'css'), path.join(stageDir, 'css'));
// Copy electron
copyDirFiltered(path.join(rootDir, 'electron'), path.join(stageDir, 'electron'));
// Copy resources/bin
if (fs.existsSync(path.join(rootDir, 'resources'))) {
    copyDirFiltered(path.join(rootDir, 'resources'), path.join(stageDir, 'resources'));
}

// Copy vtt client directories
copyDirFiltered(path.join(rootDir, 'vtt', 'js'), path.join(stageDir, 'vtt', 'js'));
copyDirFiltered(path.join(rootDir, 'vtt', 'css'), path.join(stageDir, 'vtt', 'css'));
copyDirFiltered(path.join(rootDir, 'vtt', 'lib'), path.join(stageDir, 'vtt', 'lib'));
if (fs.existsSync(path.join(rootDir, 'vtt', 'audio'))) {
    copyDirFiltered(path.join(rootDir, 'vtt', 'audio'), path.join(stageDir, 'vtt', 'audio'));
}

// Copy vtt root files (HTML, icons, manifests)
for (const file of fs.readdirSync(path.join(rootDir, 'vtt'))) {
    const p = path.join(rootDir, 'vtt', file);
    if (fs.statSync(p).isFile()) {
        fs.copyFileSync(p, path.join(stageDir, 'vtt', file));
    }
}

// Copy vtt/img brand files (logos, brand icons only - no covers or adventure maps)
const stageVttImgDir = path.join(stageDir, 'vtt', 'img');
if (!fs.existsSync(stageVttImgDir)) fs.mkdirSync(stageVttImgDir, { recursive: true });
for (const f of fs.readdirSync(path.join(rootDir, 'vtt', 'img'))) {
    const srcF = path.join(rootDir, 'vtt', 'img', f);
    if (fs.statSync(srcF).isFile() && (f.endsWith('.png') || f.endsWith('.svg') || f.endsWith('.ico'))) {
        fs.copyFileSync(srcF, path.join(stageVttImgDir, f));
    }
}

// 6. Copy Root Application files
console.log('\n📄 Step 4: Staging runtime code and legal documents...');
const rootFilesToCopy = [
    'server.js',
    'launcher.js',
    'utils.js',
    'index.html',
    'LEGAL.md',
    'favicon.ico',
    'favicon.svg',
    'favicon-96x96.png',
    'apple-touch-icon.png',
    'web-app-manifest-192x192.png',
    'web-app-manifest-512x512.png',
    'site.webmanifest'
];

for (const rf of rootFilesToCopy) {
    const srcPath = path.join(rootDir, rf);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(stageDir, rf));
    }
}

// 7. Write clean package.json in .release-stage
const mainPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const stagePkg = {
    name: mainPkg.name || 'forgedvtt',
    version: mainPkg.version || '1.0.0',
    description: "ForgeDVTT Virtual Tabletop (VTT) - Clean SRD Edition",
    author: mainPkg.author,
    main: mainPkg.main || "electron/main.js",
    type: "module",
    dependencies: mainPkg.dependencies || {}
};
fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(stagePkg, null, 2), 'utf8');

// 8. Size calculation
let totalBytes = 0;
let totalFiles = 0;
function calcDir(d) {
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, item.name);
        if (item.isDirectory()) {
            calcDir(full);
        } else {
            totalFiles++;
            totalBytes += fs.statSync(full).size;
        }
    }
}
calcDir(stageDir);

console.log(`\n======================================================`);
console.log(`🎉 RELEASE STAGING COMPLETE`);
console.log(`📁 Directory: ${stageDir}`);
console.log(`📊 Total Staged Files: ${totalFiles}`);
console.log(`💾 Total Staged Size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`======================================================\n`);
