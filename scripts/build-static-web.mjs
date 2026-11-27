import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import * as esbuild from 'esbuild';

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
copyDir(path.join(rootDir, 'vtt', 'vendor'), path.join(docsPlayDir, 'vendor'));
if (fs.existsSync(path.join(rootDir, 'vtt', 'audio'))) {
    copyDir(path.join(rootDir, 'vtt', 'audio'), path.join(docsPlayDir, 'audio'));
}

const vttImgDir = path.join(rootDir, 'vtt', 'img');
const playImgDir = path.join(docsPlayDir, 'img');
if (fs.existsSync(vttImgDir)) {
    fs.mkdirSync(playImgDir, { recursive: true });
    for (const f of fs.readdirSync(vttImgDir)) {
        if (f === 'logo-full.png') continue; // Duplicate of logo.png
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

// Helper to rewrite HTML files in docs/play for relative subpath-safe assets & P2P boot
fs.writeFileSync(path.join(docsPlayDir, 'static-flag.js'), 'window.__FORGEDVTT_STATIC_WEB__ = true;\n', 'utf8');
function transformPlayHtml(html, { isSheet = false } = {}) {
    let out = html;
    // Strip <base href="/vtt/"> so relative asset paths resolve cleanly under any mount (/play/ or /repo/play/) without speculative preload 404s
    out = out.replace(/<base href="\/vtt\/">\s*/i, '');
    // Tighten static HTTPS deployment connect-src (no ws:/http: needed on GitHub Pages)
    out = out.replace(/connect-src 'self' ws: wss: https: http:/i, "connect-src 'self' wss: https:");
    out = out.replace(/<script(?:\s+defer)?\s+src="\/socket\.io\/socket\.io\.js"><\/script>/i, () => {
        if (!isSheet) {
            return '<script defer src="static-flag.js"></script>';
        }
        const parts = ['<script defer src="static-flag.js"></script>'];
        if (!out.includes('js/network/vtt-static-shim.js')) {
            parts.push('    <script defer src="js/network/vtt-static-shim.js"></script>');
        }
        return parts.join('\n');
    });
    return out;
}

const playIndex = path.join(docsPlayDir, 'index.html');
if (fs.existsSync(playIndex)) {
    fs.writeFileSync(playIndex, transformPlayHtml(fs.readFileSync(playIndex, 'utf8'), { isSheet: false }), 'utf8');
}

const playSheet = path.join(docsPlayDir, 'sheet.html');
if (fs.existsSync(playSheet)) {
    fs.writeFileSync(playSheet, transformPlayHtml(fs.readFileSync(playSheet, 'utf8'), { isSheet: true }), 'utf8');
}

// 4. Sync Control Center UI into docs/prep
console.log('📁 Step 4: Syncing Control Center into docs/prep...');
copyDir(path.join(rootDir, 'electron', 'ui'), docsPrepDir);
const iconSrc = path.join(rootDir, 'electron', 'icon.png');
if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(docsPrepDir, 'icon.png'));
}

const resolverSrc = path.join(rootDir, 'vtt', 'js', 'vtt-entry-resolver.js');
if (!fs.existsSync(resolverSrc)) {
    throw new Error(`Missing required static /prep dependency: ${resolverSrc}`);
}
fs.copyFileSync(resolverSrc, path.join(docsPrepDir, 'vtt-entry-resolver.js'));

const prepSchemasPath = path.join(docsPrepDir, 'builder-schemas.js');
if (fs.existsSync(prepSchemasPath)) {
    let schemasJs = fs.readFileSync(prepSchemasPath, 'utf8');
    schemasJs = schemasJs.replaceAll('../../vtt/js/vtt-entry-resolver.js', './vtt-entry-resolver.js');
    if (schemasJs.includes('../../vtt/')) {
        throw new Error('docs/prep/builder-schemas.js still contains unbundled ../../vtt/ imports.');
    }
    fs.writeFileSync(prepSchemasPath, schemasJs, 'utf8');
}

const prepIndex = path.join(docsPrepDir, 'index.html');
fs.writeFileSync(path.join(docsPrepDir, 'static-flag.js'), 'window.__FORGEDVTT_STATIC_WEB__ = true;\n', 'utf8');
if (fs.existsSync(prepIndex)) {
    let prepHtml = fs.readFileSync(prepIndex, 'utf8');
    prepHtml = prepHtml.replace(
        '<link rel="icon" type="image/png" href="icon.png">',
        '<link rel="icon" type="image/x-icon" href="../favicon.ico">\n  <link rel="icon" type="image/svg+xml" href="../favicon.svg">\n  <link rel="icon" type="image/png" sizes="96x96" href="../favicon-96x96.png">\n  <link rel="apple-touch-icon" sizes="180x180" href="../apple-touch-icon.png">'
    );
    prepHtml = prepHtml.replace(
        '<script src="static-storage-driver.js"></script>',
        '<script src="static-flag.js"></script>\n  <script src="static-storage-driver.js"></script>'
    );
    if (!prepHtml.includes('static-flag.js')) {
        throw new Error('Failed to inject static-flag.js into docs/prep/index.html');
    }
    fs.writeFileSync(prepIndex, prepHtml, 'utf8');
}

console.log('🗜️ Step 5: Bundling CSS & minifying JS/CSS for static web...');

function collectFiles(dir, ext, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) collectFiles(full, ext, out);
        else if (item.isFile() && item.name.endsWith(ext)) out.push(full);
    }
    return out;
}

// Flatten & minify vtt.css (@imports -> single CSS file) + remove redundant components dir
const playVttCss = path.join(docsPlayDir, 'css', 'vtt.css');
if (fs.existsSync(playVttCss)) {
    await esbuild.build({
        entryPoints: [playVttCss],
        outfile: playVttCss,
        bundle: true,
        minify: true,
        allowOverwrite: true,
        logLevel: 'silent'
    });
    fs.rmSync(path.join(docsPlayDir, 'css', 'components'), { recursive: true, force: true });
}

for (const cssFile of [
    path.join(docsPlayDir, 'css', 'vtt-mobile.css'),
    path.join(docsPlayDir, 'css', 'dice-3d.css'),
    path.join(docsPrepDir, 'dashboard.css')
]) {
    if (fs.existsSync(cssFile)) {
        const res = await esbuild.transform(fs.readFileSync(cssFile, 'utf8'), { loader: 'css', minify: true });
        fs.writeFileSync(cssFile, res.code, 'utf8');
    }
}

const jsFilesToMinify = [...collectFiles(path.join(docsPlayDir, 'js'), '.js'), ...collectFiles(docsPrepDir, '.js')];
let minifiedCount = 0;
for (const jsFile of jsFilesToMinify) {
    if (path.basename(jsFile) === 'static-flag.js') continue;
    const src = fs.readFileSync(jsFile, 'utf8');
    const res = await esbuild.transform(src, { loader: 'js', minify: true });
    fs.writeFileSync(jsFile, res.code, 'utf8');
    minifiedCount++;
}

console.log(`✅ Minified ${minifiedCount} JS files & bundled/minified CSS for docs/play/ and docs/prep/.`);
console.log('\n✅ Static Web build complete: docs/play/ & docs/prep/ are ready!\n');
