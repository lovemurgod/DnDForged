import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const partneredDir = path.join(rootDir, '5etools-src', 'data', 'partnered');
const prereleaseDir = path.join(rootDir, '5etools-src', 'data', 'prerelease');

const HOMEBREW_ROOT = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/';
const PRERELEASE_ROOT = 'https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/';

const args = process.argv.slice(2);
const isForce = args.includes('--force');
const isPartneredOnly = args.includes('--partnered-only');
const isUaOnly = args.includes('--ua-only');

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} (${url})`);
    return await res.json();
}

async function downloadFile(url, destPath) {
    if (!isForce && fs.existsSync(destPath) && fs.statSync(destPath).size > 10) {
        return { downloaded: false, path: destPath };
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    // Validate JSON before saving
    JSON.parse(text);
    fs.writeFileSync(destPath, text, 'utf8');
    return { downloaded: true, path: destPath };
}

async function runQueue(tasks, concurrency = 5, onProgress = () => {}) {
    let index = 0;
    let completed = 0;
    const total = tasks.length;

    async function worker() {
        while (index < tasks.length) {
            const currentIdx = index++;
            const task = tasks[currentIdx];
            try {
                await task();
            } catch (err) {
                console.error(`\n❌ Error processing item ${currentIdx + 1}: ${err.message}`);
            }
            completed++;
            onProgress(completed, total);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);
}

async function syncPartnered() {
    console.log('\n📦 [1/2] Syncing Partnered Content (37 Publications)...');
    if (!fs.existsSync(partneredDir)) fs.mkdirSync(partneredDir, { recursive: true });

    const [meta, props] = await Promise.all([
        fetchJson(`${HOMEBREW_ROOT}_generated/index-meta.json`),
        fetchJson(`${HOMEBREW_ROOT}_generated/index-props.json`)
    ]);

    const allPaths = new Set();
    for (const fileMap of Object.values(props)) {
        for (const filePath of Object.keys(fileMap)) {
            allPaths.add(filePath);
        }
    }

    const partneredFiles = [];
    for (const p of allPaths) {
        const filename = p.split('/').pop();
        if (meta[filename]?.p === 1) {
            partneredFiles.push({
                remotePath: p,
                filename,
                destPath: path.join(partneredDir, filename)
            });
        }
    }

    // Deduplicate by filename
    const seen = new Set();
    const uniquePartnered = partneredFiles.filter(item => {
        if (seen.has(item.filename)) return false;
        seen.add(item.filename);
        return true;
    });

    console.log(`Found ${uniquePartnered.length} partnered sourcebooks to sync.`);

    const tasks = uniquePartnered.map((item, idx) => async () => {
        const url = `${HOMEBREW_ROOT}${encodeURI(item.remotePath)}`;
        const res = await downloadFile(url, item.destPath);
        return res;
    });

    await runQueue(tasks, 5, (done, total) => {
        process.stdout.write(`\r   Progress: [${done}/${total}] Partnered books synced...`);
    });
    console.log('\n✅ Partnered content sync complete.');
}

async function syncPrerelease() {
    console.log('\n📜 [2/2] Syncing Unearthed Arcana (Prerelease) Archive (106 Articles)...');
    if (!fs.existsSync(prereleaseDir)) fs.mkdirSync(prereleaseDir, { recursive: true });

    const props = await fetchJson(`${PRERELEASE_ROOT}_generated/index-props.json`);

    const allPaths = new Set();
    for (const fileMap of Object.values(props)) {
        for (const filePath of Object.keys(fileMap)) {
            allPaths.add(filePath);
        }
    }

    const uaFiles = [];
    for (const p of allPaths) {
        const filename = p.split('/').pop();
        uaFiles.push({
            remotePath: p,
            filename,
            destPath: path.join(prereleaseDir, filename)
        });
    }

    // Deduplicate
    const seen = new Set();
    const uniqueUa = uaFiles.filter(item => {
        if (seen.has(item.filename)) return false;
        seen.add(item.filename);
        return true;
    });

    console.log(`Found ${uniqueUa.length} Unearthed Arcana files to sync.`);

    const tasks = uniqueUa.map((item, idx) => async () => {
        const url = `${PRERELEASE_ROOT}${encodeURI(item.remotePath)}`;
        const res = await downloadFile(url, item.destPath);
        return res;
    });

    await runQueue(tasks, 6, (done, total) => {
        process.stdout.write(`\r   Progress: [${done}/${total}] UA articles synced...`);
    });
    console.log('\n✅ Unearthed Arcana sync complete.');
}

async function main() {
    console.log('🚀 ForgeDVTT Content Sync Starting...');
    const t0 = Date.now();

    if (!isUaOnly) {
        await syncPartnered();
    }
    if (!isPartneredOnly) {
        await syncPrerelease();
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n🎉 All content sync operations completed successfully in ${elapsed}s!`);
}

main().catch(err => {
    console.error('\n💥 Fatal Sync Error:', err);
    process.exit(1);
});
