import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DATA_DIR = process.env.FORGEDVTT_DATA_DIR || path.join(rootDir, '.dndforged-data');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const BESTIARY_CATALOG_FILE = path.join(rootDir, '5etools-src', 'data', 'bestiary-catalog.json');
const IMG_BASE_DIR = path.join(rootDir, '5etools-src', 'img');

console.log('🚀 Starting Offline Token & Asset Importer...');

// 1. Collect all tokens & adventure images referenced in campaigns.json
const assetsToFetch = new Set(); // relative paths like 'bestiary/tokens/MM/Goblin.webp' or 'adventure/CoS/008-cos201.webp'

if (fs.existsSync(CAMPAIGNS_FILE)) {
    try {
        const rawCampaigns = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
        const campaignsData = JSON.parse(rawCampaigns);

        function scanObj(obj) {
            if (!obj || typeof obj !== 'object') return;

            // Check tokenImg / img / url
            const checkUrl = (url) => {
                if (typeof url !== 'string') return;
                // Check 5etools URLs
                const m5e = url.match(/https?:\/\/(?:2014\.)?5e\.tools\/img\/(.+)/i);
                if (m5e && m5e[1]) {
                    assetsToFetch.add(decodeURIComponent(m5e[1]));
                    return;
                }
                // Check relative img/ paths
                const mRel = url.match(/^(?:\/)?img\/(.+)/i);
                if (mRel && mRel[1]) {
                    assetsToFetch.add(decodeURIComponent(mRel[1]));
                    return;
                }
            };

            if (obj.tokenImg) checkUrl(obj.tokenImg);
            if (obj.img) checkUrl(obj.img);
            if (obj.avatarUrl) checkUrl(obj.avatarUrl);
            if (obj.tokenUrl) checkUrl(obj.tokenUrl);

            for (const key of Object.keys(obj)) {
                scanObj(obj[key]);
            }
        }

        scanObj(campaignsData);
        console.log(`📋 Found ${assetsToFetch.size} unique assets referenced across active campaigns.`);

        // Rewrite 5e.tools URLs in campaigns.json to local /img/ paths
        const rewrittenCampaigns = rawCampaigns
            .replace(/https?:\/\/(?:2014\.)?5e\.tools\/img\//g, '/img/')
            .replace(/http:\/\/localhost:5050\/img\//g, '/img/');

        if (rewrittenCampaigns !== rawCampaigns) {
            fs.writeFileSync(CAMPAIGNS_FILE, rewrittenCampaigns, 'utf8');
            console.log('💾 Successfully rewritten remote 5e.tools URLs in campaigns.json to local /img/ paths.');
        }
    } catch (err) {
        console.error('Error scanning campaigns.json:', err);
    }
}

// 2. Also add all Monster Manual (MM) and Curse of Strahd (CoS) creatures from bestiary catalog
if (fs.existsSync(BESTIARY_CATALOG_FILE)) {
    try {
        const catalog = JSON.parse(fs.readFileSync(BESTIARY_CATALOG_FILE, 'utf8'));
        let coreAdded = 0;
        for (const mon of catalog) {
            const src = (mon.source || '').toUpperCase();
            if (src === 'MM' || src === 'COS' || src === 'XMM') {
                if (mon.tokenImg) {
                    const cleanRel = mon.tokenImg.replace(/^img\//, '');
                    assetsToFetch.add(decodeURIComponent(cleanRel));
                    coreAdded++;
                }
            }
        }
        console.log(`📦 Added ${coreAdded} core tokens (MM, CoS, XMM) from Bestiary catalog to offline library.`);
    } catch (err) {
        console.error('Error reading bestiary catalog:', err);
    }
}

console.log(`🎯 Total assets queued for offline import: ${assetsToFetch.size}`);

// 3. Downloader engine with retry & mirror failover
async function downloadAsset(relPath) {
    const localFile = path.join(IMG_BASE_DIR, relPath);
    if (fs.existsSync(localFile) && fs.statSync(localFile).size > 100) {
        return { status: 'already_exists', relPath };
    }

    const safeRel = relPath.replace(/\\/g, '/');
    const candidates = [
        `https://raw.githubusercontent.com/5etools-mirror-2/5etools-img/main/${encodeURI(safeRel)}`,
        `https://5e.tools/img/${encodeURI(safeRel)}`,
        `https://raw.githubusercontent.com/5etools-mirror-1/5etools-img/main/${encodeURI(safeRel)}`
    ];

    if (safeRel.includes(' ')) {
        const hyp = safeRel.replace(/ /g, '-');
        candidates.push(`https://raw.githubusercontent.com/5etools-mirror-2/5etools-img/main/${encodeURI(hyp)}`);
        candidates.push(`https://5e.tools/img/${encodeURI(hyp)}`);
    } else if (safeRel.includes('-')) {
        const spc = safeRel.replace(/-/g, ' ');
        candidates.push(`https://raw.githubusercontent.com/5etools-mirror-2/5etools-img/main/${encodeURI(spc)}`);
        candidates.push(`https://5e.tools/img/${encodeURI(spc)}`);
    }

    for (const url of candidates) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000)
            });
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length > 50) {
                    const dir = path.dirname(localFile);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(localFile, buf);
                    return { status: 'downloaded', relPath, size: buf.length };
                }
            }
        } catch (e) {
            // Try next candidate
        }
    }

    return { status: 'failed', relPath };
}

// 4. Concurrency pool
async function runImport() {
    const list = Array.from(assetsToFetch);
    const CONCURRENCY = 10;
    let completed = 0;
    let downloadedCount = 0;
    let existingCount = 0;
    let failedCount = 0;

    console.log(`⚡ Downloading with concurrency ${CONCURRENCY}...`);

    let index = 0;
    async function worker() {
        while (index < list.length) {
            const current = list[index++];
            const result = await downloadAsset(current);
            completed++;
            if (result.status === 'downloaded') downloadedCount++;
            else if (result.status === 'already_exists') existingCount++;
            else failedCount++;

            if (completed % 25 === 0 || completed === list.length) {
                const pct = Math.round((completed / list.length) * 100);
                process.stdout.write(`\rProgress: ${completed}/${list.length} (${pct}%) | New: ${downloadedCount} | Cached: ${existingCount} | Failed: ${failedCount}`);
            }
        }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    console.log('\n\n✅ Offline Token & Asset Import Complete!');
    console.log(`- Newly downloaded: ${downloadedCount}`);
    console.log(`- Already existed:  ${existingCount}`);
    console.log(`- Unresolved/absent: ${failedCount}`);
}

runImport().catch(console.error);
