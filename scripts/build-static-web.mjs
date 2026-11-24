import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const docsPlayDir = path.join(rootDir, 'docs', 'play');
const docsPrepDir = path.join(rootDir, 'docs', 'prep');

console.log('\n======================================================');
console.log('🌐 BUILDING STATIC WEB P2P EDITION (docs/play & docs/prep)');
console.log('======================================================\n');

function copyDir(src, dst) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const item of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, item.name);
        const d = path.join(dst, item.name);
        if (item.isDirectory()) {
            copyDir(s, d);
        } else if (item.isFile()) {
            fs.copyFileSync(s, d);
        }
    }
}

// 1. Clean previous docs/play and docs/prep
for (const dir of [docsPlayDir, docsPrepDir]) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

// 2. Build clean SRD 5.1 & SRD 5.2 data + CC0 tokens into docs/play
const playDataDir = path.join(docsPlayDir, 'data');
console.log('⚙️ Step 1: Compiling clean SRD 5.1 & 5.2 datasets into docs/play/data...');
execFileSync('node', [path.join(rootDir, 'scripts', 'build-srd-db.mjs'), '--out', playDataDir], {
    stdio: 'inherit',
    cwd: rootDir
});

const playTokenDir = path.join(docsPlayDir, 'img', 'bestiary', 'tokens');
const catalogFile = path.join(playDataDir, 'bestiary-catalog.json');
console.log('\n🎨 Step 2: Generating CC0 creature tokens into docs/play/img/bestiary/tokens...');
execFileSync(
    'node',
    [path.join(rootDir, 'scripts', 'generate-cc0-tokens.mjs'), '--catalog', catalogFile, '--out', playTokenDir],
    {
        stdio: 'inherit',
        cwd: rootDir
    }
);

// 3. Copy VTT frontend into docs/play
console.log('\n📁 Step 3: Syncing VTT client into docs/play...');
copyDir(path.join(rootDir, 'vtt', 'js'), path.join(docsPlayDir, 'js'));
copyDir(path.join(rootDir, 'vtt', 'css'), path.join(docsPlayDir, 'css'));
copyDir(path.join(rootDir, 'vtt', 'lib'), path.join(docsPlayDir, 'lib'));
if (fs.existsSync(path.join(rootDir, 'vtt', 'audio'))) {
    copyDir(path.join(rootDir, 'vtt', 'audio'), path.join(docsPlayDir, 'audio'));
}

const vttImgDir = path.join(rootDir, 'vtt', 'img');
const playImgDir = path.join(docsPlayDir, 'img');
if (fs.existsSync(vttImgDir)) {
    fs.mkdirSync(playImgDir, { recursive: true });
    for (const f of fs.readdirSync(vttImgDir)) {
        const srcF = path.join(vttImgDir, f);
        if (fs.statSync(srcF).isFile() && /\.(png|svg|ico|webp|jpg)$/i.test(f)) {
            fs.copyFileSync(srcF, path.join(playImgDir, f));
        }
    }
}

for (const file of fs.readdirSync(path.join(rootDir, 'vtt'))) {
    const p = path.join(rootDir, 'vtt', file);
    if (fs.statSync(p).isFile()) {
        fs.copyFileSync(p, path.join(docsPlayDir, file));
    }
}

// Rewrite docs/play/index.html and sheet.html for static /play/ base path
const playIndex = path.join(docsPlayDir, 'index.html');
if (fs.existsSync(playIndex)) {
    let html = fs.readFileSync(playIndex, 'utf8');
    html = html.replace('<base href="/vtt/">', '<base href="/play/">');
    html = html.replace(
        '    <script src="/socket.io/socket.io.js"></script>\n',
        '    <script>window.__FORGEDVTT_STATIC_WEB__ = true;</script>\n'
    );
    html = html.replace(
        '    <script src="/socket.io/socket.io.js"></script>\r\n',
        '    <script>window.__FORGEDVTT_STATIC_WEB__ = true;</script>\r\n'
    );
    fs.writeFileSync(playIndex, html, 'utf8');
}

const playSheet = path.join(docsPlayDir, 'sheet.html');
if (fs.existsSync(playSheet)) {
    let sheetHtml = fs.readFileSync(playSheet, 'utf8');
    if (!sheetHtml.includes('<base href=')) {
        sheetHtml = sheetHtml.replace(/<head>/i, '<head>\n    <base href="/play/">');
    } else {
        sheetHtml = sheetHtml.replace(/<base href="\/vtt\/">/i, '<base href="/play/">');
    }
    sheetHtml = sheetHtml.replace(
        /<script src="\/socket\.io\/socket\.io\.js"><\/script>/i,
        '<script>window.__FORGEDVTT_STATIC_WEB__ = true;</script>\n    <script src="js/network/vtt-static-shim.js"></script>'
    );
    fs.writeFileSync(playSheet, sheetHtml, 'utf8');
}

// 4. Sync Control Center UI into docs/prep
console.log('📁 Step 4: Syncing Control Center into docs/prep...');
copyDir(path.join(rootDir, 'electron', 'ui'), docsPrepDir);
const iconSrc = path.join(rootDir, 'electron', 'icon.png');
if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(docsPrepDir, 'icon.png'));
}

const prepIndex = path.join(docsPrepDir, 'index.html');
if (fs.existsSync(prepIndex)) {
    let prepHtml = fs.readFileSync(prepIndex, 'utf8');
    prepHtml = prepHtml.replace(
        '<link rel="icon" type="image/png" href="../icon.png">',
        '<link rel="icon" type="image/png" href="icon.png">'
    );
    prepHtml = prepHtml.replace(
        '<script src="static-storage-driver.js"></script>',
        '<script>window.__FORGEDVTT_STATIC_WEB__ = true;</script>\n  <script src="static-storage-driver.js"></script>'
    );
    fs.writeFileSync(prepIndex, prepHtml, 'utf8');
}

console.log('\n✅ Static Web build complete: docs/play/ & docs/prep/ are ready!\n');
