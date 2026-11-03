import express from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import dns from 'dns';
import multer from 'multer';
import {
    DATA_DIR,
    ASSETS_DIR,
    DISCORD_CACHE_DIR,
    rootDir,
    VTT_DIR,
    extractSubdomain,
    isDiscordHost,
    isAllowedMediaUrl,
    verifyGmOrSecret
} from '../state.js';

export const mediaRouter = express.Router();
export const imageRouter = express.Router();

// Setup file upload engine for maps and tokens (per-campaign subdomain isolated)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let sub = extractSubdomain(req.headers.host) || req.body.campaignId || 'default';
        sub =
            String(sub)
                .replace(/[^a-zA-Z0-9_-]/g, '')
                .trim() || 'default';
        const campaignsRoot = path.resolve(DATA_DIR, 'campaigns');
        const targetDir = path.resolve(campaignsRoot, sub, 'uploads');
        const rel = path.relative(campaignsRoot, targetDir);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            return cb(new Error('Invalid upload destination: path traversal detected'));
        }
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path
            .basename(file.originalname, ext)
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
        cb(null, `${base}-${Date.now()}${ext}`);
    }
});
const ALLOWED_UPLOAD_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.webm', '.mp4', '.gif', '.svg']);

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB cap to prevent disk flooding
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
            return cb(new Error('Invalid file type: only image and video media files permitted'));
        }
        cb(null, true);
    }
});

export function isPrivateOrLoopbackIp(ip) {
    if (!ip || typeof ip !== 'string') return true;
    const cleanIp = ip.replace(/^::ffff:/, ''); // IPv4-mapped IPv6
    // Loopback
    if (cleanIp === '::1' || cleanIp === 'localhost' || cleanIp.startsWith('127.')) return true;
    // Unspecified / broadcast
    if (cleanIp === '0.0.0.0' || cleanIp === '255.255.255.255' || cleanIp === '::') return true;
    // Private IPv4 (RFC 1918)
    if (cleanIp.startsWith('10.')) return true;
    if (cleanIp.startsWith('192.168.')) return true;
    const m = cleanIp.match(/^172\.(\d+)\./);
    if (m) {
        const octet = parseInt(m[1], 10);
        if (octet >= 16 && octet <= 31) return true;
    }
    // Link-local / Cloud metadata (169.254.0.0/16)
    if (cleanIp.startsWith('169.254.')) return true;
    // Carrier-grade NAT (100.64.0.0/10)
    const mCg = cleanIp.match(/^100\.(\d+)\./);
    if (mCg) {
        const octet = parseInt(mCg[1], 10);
        if (octet >= 64 && octet <= 127) return true;
    }
    // IPv6 private / link-local / unique local
    if (
        cleanIp.toLowerCase().startsWith('fe80:') ||
        cleanIp.toLowerCase().startsWith('fc00:') ||
        cleanIp.toLowerCase().startsWith('fd')
    ) {
        return true;
    }
    return false;
}

export async function safeFetchMedia(targetUrl, maxRedirects = 3) {
    let currentUrl = targetUrl;
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
        if (!currentUrl || typeof currentUrl !== 'string') {
            throw new Error('Invalid URL provided');
        }

        let parsed;
        try {
            parsed = new URL(currentUrl.trim());
        } catch {
            throw new Error('Invalid URL format');
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error(`Forbidden protocol: ${parsed.protocol}`);
        }

        if (!isAllowedMediaUrl(currentUrl)) {
            throw new Error(`Target domain '${parsed.hostname}' is not permitted for media scraping`);
        }

        // DNS resolution check: block hostnames that resolve to private or loopback IPs
        try {
            const records = await dns.promises.lookup(parsed.hostname, { all: true });
            for (const record of records) {
                if (isPrivateOrLoopbackIp(record.address)) {
                    throw new Error(`Target host resolved to prohibited IP address: ${record.address}`);
                }
            }
        } catch (e) {
            if (e.message && e.message.includes('prohibited IP address')) {
                throw e;
            }
            throw new Error(`DNS resolution failed for ${parsed.hostname}: ${e.message}`, { cause: e });
        }

        const res = await fetch(currentUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            },
            redirect: 'manual'
        });

        // Handle redirect
        if ([301, 302, 303, 307, 308].includes(res.status)) {
            const location = res.headers.get('location');
            if (!location) {
                throw new Error('Redirect response missing location header');
            }
            const nextUrl = new URL(location, currentUrl).toString();
            redirectCount++;
            if (redirectCount > maxRedirects) {
                throw new Error('Too many redirects encountered while resolving media');
            }
            currentUrl = nextUrl;
            continue;
        }

        return { response: res, finalUrl: currentUrl };
    }

    throw new Error('Too many redirects');
}

export async function processMediaUrl(url) {
    let finalUrl = url;

    // Try to parse YouTube URLs to Embed format
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1];
        const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
        let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1`;
        if (listMatch && listMatch[1]) {
            embedUrl += `&list=${listMatch[1]}`;
        } else {
            embedUrl += `&playlist=${videoId}`;
        }
        return embedUrl;
    }

    // Fast path: If it already looks like a direct media link, return it immediately
    if (url.match(/\.(mp4|webm|ogg|jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) {
        return url;
    }

    // For non-direct links, scrape for OpenGraph or structured data tags
    try {
        const { response, finalUrl: safeUrl } = await safeFetchMedia(url);
        finalUrl = safeUrl;
        const html = await response.text();

        // Pinterest specific matching (sometimes lacks extensions or uses contentUrl)
        const pinVideoMatch = html.match(/"contentUrl":"([^"]+\.mp4)"/i);
        const pinImageMatch = html.match(/"image":"([^"]+)"/i);

        // Generic OpenGraph matching
        const ogVideoMatch =
            html.match(/<meta[^>]+property=["']og:video:secure_url["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+property=["']og:video["'][^>]*content=["']([^"']+)["']/i);

        const ogImageMatch =
            html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);

        if (pinVideoMatch && pinVideoMatch[1]) {
            finalUrl = pinVideoMatch[1].replace(/\\u002F/g, '/');
        } else if (ogVideoMatch && ogVideoMatch[1]) {
            finalUrl = ogVideoMatch[1].replace(/\\u002F/g, '/');
        } else if (pinImageMatch && pinImageMatch[1] && !pinImageMatch[1].includes('{')) {
            finalUrl = pinImageMatch[1].replace(/\\u002F/g, '/');
        } else if (ogImageMatch && ogImageMatch[1]) {
            finalUrl = ogImageMatch[1].replace(/\\u002F/g, '/');
        }
    } catch (e) {
        console.error(`Failed to scrape URL ${url}:`, e);
    }

    return finalUrl;
}

// Proxy for Discord CDN to bypass expiring signatures with strict hostname checking
mediaRouter.get('/proxy-discord', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).send('No URL provided');
    }

    let parsed;
    try {
        parsed = new URL(targetUrl.trim());
    } catch {
        return res.status(400).send('Invalid URL format');
    }

    if (parsed.protocol !== 'https:' || !isDiscordHost(parsed.hostname)) {
        return res.status(400).send('Invalid Discord URL');
    }

    const hash = crypto.createHash('md5').update(targetUrl).digest('hex');
    const extMatch = targetUrl.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
    const ext = extMatch ? `.${extMatch[1]}` : '';
    const cachedFilePath = path.join(DISCORD_CACHE_DIR, `${hash}${ext}`);

    if (fs.existsSync(cachedFilePath)) {
        return res.sendFile(cachedFilePath);
    }

    https
        .get(targetUrl, (response) => {
            if (response.statusCode === 200) {
                const fileStream = fs.createWriteStream(cachedFilePath);
                response.pipe(fileStream);
                response.pipe(res);

                fileStream.on('error', (err) => {
                    console.error('Error writing to discord cache:', err);
                });
            } else {
                res.status(response.statusCode).send('Failed to fetch from Discord');
            }
        })
        .on('error', (err) => {
            res.status(500).send('Proxy error: ' + err.message);
        });
});

// Resolve media URL (e.g. Pinterest pin.it shortlinks, pinterest.com pin pages, shortlinks)
mediaRouter.get('/resolve-media-url', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'No URL provided' });
    }

    const cleanTarget = targetUrl.trim();

    // Fast check: if already direct video or YouTube
    const isVideoExt = !!cleanTarget.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || cleanTarget.includes('pinimg.com/videos');
    const isYoutube = cleanTarget.includes('youtube.com') || cleanTarget.includes('youtu.be');
    const isDirectImage = !!cleanTarget.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i);

    if (
        isVideoExt ||
        isYoutube ||
        (isDirectImage && !cleanTarget.includes('pin.it') && !cleanTarget.includes('pinterest.com/pin/'))
    ) {
        return res.json({
            resolvedUrl: cleanTarget,
            isVideo: isVideoExt || isYoutube,
            isYoutube
        });
    }

    try {
        const { response: fetchRes, finalUrl } = await safeFetchMedia(cleanTarget);
        const html = await fetchRes.text();

        // 1. Look for Pinterest video stream (v1.pinimg.com / v.pinimg.com / .mp4 matches)
        const pinVideoMatch =
            html.match(/(https?:\/\/[a-z0-9.]*pinimg\.com\/videos\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*)/i) ||
            html.match(/(https?:\/\/[^\s"'<>\\]+\.mp4(?:\?[^\s"'<>\\]*)?)/i) ||
            html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i);

        if (pinVideoMatch && pinVideoMatch[1]) {
            let videoUrl = pinVideoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            return res.json({
                resolvedUrl: videoUrl,
                isVideo: true,
                originalUrl: targetUrl
            });
        }

        // 2. Look for high-res Pinterest image (i.pinimg.com/originals/...) or og:image
        const pinImageMatch =
            html.match(/(https:\/\/i\.pinimg\.com\/(?:originals|[0-9]+x)\/[^\s"'<>\\]+)/i) ||
            html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i);

        if (pinImageMatch && pinImageMatch[1]) {
            let imageUrl = pinImageMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            imageUrl = imageUrl.replace(/\/i\.pinimg\.com\/[0-9]+x\//, '/i.pinimg.com/originals/');
            const isGif = imageUrl.toLowerCase().split('?')[0].endsWith('.gif');
            return res.json({
                resolvedUrl: imageUrl,
                isVideo: isGif,
                isGif,
                originalUrl: targetUrl
            });
        }

        // 3. Fallback to OpenGraph or final resolved redirect URL
        const ogMatch =
            html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
            let ogUrl = ogMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            const isGif = ogUrl.toLowerCase().split('?')[0].endsWith('.gif');
            return res.json({
                resolvedUrl: ogUrl,
                isVideo: isGif,
                isGif,
                originalUrl: targetUrl
            });
        }

        res.json({
            resolvedUrl: finalUrl,
            isVideo: false,
            originalUrl: targetUrl
        });
    } catch (err) {
        console.error(`[ResolveMedia] Error resolving ${cleanTarget}:`, err.message);
        if (
            err.message &&
            (err.message.includes('prohibited IP address') ||
                err.message.includes('not permitted for media scraping') ||
                err.message.includes('Forbidden protocol') ||
                err.message.includes('Too many redirects'))
        ) {
            return res.status(403).json({ error: err.message });
        }
        res.json({
            resolvedUrl: cleanTarget,
            isVideo: false,
            originalUrl: targetUrl
        });
    }
});

// Player token URL processor
mediaRouter.post('/player-token/url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    const finalUrl = await processMediaUrl(url);
    res.json({ url: finalUrl });
});

// Upload media file (map/token image - GM or local loopback only)
mediaRouter.post('/upload', verifyGmOrSecret, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const relativeUrl = `/vtt-uploads/${req.file.filename}`;
    res.json({ url: relativeUrl });
});

export function sendImageFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    let mimeType =
        ext === '.webp'
            ? 'image/webp'
            : ext === '.png'
              ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.svg'
                  ? 'image/svg+xml'
                  : ext === '.gif'
                    ? 'image/gif'
                    : 'application/octet-stream';

    // If a file is labeled .webp but actually contains SVG XML, serve as svg+xml to prevent decode failure
    if (ext === '.webp') {
        try {
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(16);
            fs.readSync(fd, buf, 0, 16, 0);
            fs.closeSync(fd);
            if (buf.toString('utf8').trim().startsWith('<svg')) {
                mimeType = 'image/svg+xml';
            }
        } catch (e) {}
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.sendFile(filePath);
}

export function isRealWebpFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(12);
        fs.readSync(fd, buf, 0, 12, 0);
        fs.closeSync(fd);
        return buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
    } catch (e) {
        return false;
    }
}

// Local Image Route for /img/* and /vtt/img/* (Tokens, Bestiary, Items, Adventure Maps) with On-Demand Mirror Fallback
imageRouter.get(['/img/*', '/vtt/img/*'], async (req, res, next) => {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(req.path);
    } catch (e) {
        decodedPath = req.path;
    }

    // Prevent path traversal and normalize vtt prefix
    let safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
    safePath = safePath.replace(/^[\\/]?(?:vtt[\\/])/i, '');
    if (!safePath.startsWith('img') && !safePath.startsWith('/img') && !safePath.startsWith('\\img')) {
        safePath = path.join('img', safePath);
    }

    const userTarget = path.join(ASSETS_DIR, safePath);
    if (fs.existsSync(userTarget) && fs.statSync(userTarget).isFile()) {
        return sendImageFile(userTarget, res);
    }
    if (safePath.includes(' ')) {
        const userHyphen = path.join(ASSETS_DIR, safePath.replace(/ /g, '-'));
        if (fs.existsSync(userHyphen) && fs.statSync(userHyphen).isFile()) {
            return sendImageFile(userHyphen, res);
        }
    } else if (safePath.includes('-')) {
        const userSpace = path.join(ASSETS_DIR, safePath.replace(/-/g, ' '));
        if (fs.existsSync(userSpace) && fs.statSync(userSpace).isFile()) {
            return sendImageFile(userSpace, res);
        }
    }

    const vttTarget = path.join(VTT_DIR, safePath);
    const localTarget = path.join(rootDir, '5etools-src', safePath);

    // If vttTarget exists and is a real WebP, serve it immediately
    if (fs.existsSync(vttTarget) && fs.statSync(vttTarget).isFile()) {
        if (isRealWebpFile(vttTarget) || !isRealWebpFile(localTarget)) {
            return sendImageFile(vttTarget, res);
        }
    }

    // If localTarget in 5etools-src is a real WebP, prioritize it over fake SVG tokens
    if (fs.existsSync(localTarget) && fs.statSync(localTarget).isFile()) {
        return sendImageFile(localTarget, res);
    }

    // Check variants in vtt/
    if (safePath.includes(' ')) {
        const vttHyphen = path.join(VTT_DIR, safePath.replace(/ /g, '-'));
        if (fs.existsSync(vttHyphen) && fs.statSync(vttHyphen).isFile()) {
            return sendImageFile(vttHyphen, res);
        }
    } else if (safePath.includes('-')) {
        const vttSpace = path.join(VTT_DIR, safePath.replace(/-/g, ' '));
        if (fs.existsSync(vttSpace) && fs.statSync(vttSpace).isFile()) {
            return sendImageFile(vttSpace, res);
        }
    }

    // Check variants in 5etools-src
    if (safePath.includes(' ')) {
        const hyphenVariant = path.join(rootDir, '5etools-src', safePath.replace(/ /g, '-'));
        if (fs.existsSync(hyphenVariant) && fs.statSync(hyphenVariant).isFile()) {
            return sendImageFile(hyphenVariant, res);
        }
    } else if (safePath.includes('-')) {
        const spaceVariant = path.join(rootDir, '5etools-src', safePath.replace(/-/g, ' '));
        if (fs.existsSync(spaceVariant) && fs.statSync(spaceVariant).isFile()) {
            return sendImageFile(spaceVariant, res);
        }
    }

    // Also check raw encoded path locally
    const rawRel = req.path.replace(/^[\\/]?(?:vtt[\\/])/i, '');
    const rawTarget = path.join(rootDir, '5etools-src', rawRel);
    if (fs.existsSync(rawTarget) && fs.statSync(rawTarget).isFile()) {
        return sendImageFile(rawTarget, res);
    }

    // If vttTarget existed (e.g. valid SVG fallback), serve it now
    if (fs.existsSync(vttTarget) && fs.statSync(vttTarget).isFile()) {
        return sendImageFile(vttTarget, res);
    }

    // On-demand Mirror Fetch & Cache:
    const cleanRel = safePath.replace(/^[\\/]?img[\\/]/i, '').replace(/\\/g, '/');
    const candidateRels = new Set([cleanRel]);

    if (cleanRel.includes(' ')) {
        candidateRels.add(cleanRel.replace(/ /g, '-'));
    } else if (cleanRel.includes('-')) {
        candidateRels.add(cleanRel.replace(/-/g, ' '));
    }

    // Normalize canonical source casing for bestiary tokens (e.g. COS -> CoS, OOTA -> OotA)
    const canonicalSources = {
        cos: 'CoS',
        oota: 'OotA',
        toa: 'ToA',
        wdh: 'WDH',
        wdmm: 'WDMM',
        idrotf: 'IDRotF',
        bgdia: 'BGDIA',
        gos: 'GoS',
        hotdq: 'HotDQ',
        rot: 'RoT',
        lmop: 'LMoP',
        dosi: 'DoSI',
        xmm: 'XMM',
        mm: 'MM',
        vgm: 'VGM',
        mtf: 'MTF',
        ftd: 'FTD',
        mpmm: 'MPMM',
        egw: 'EGW',
        erlw: 'ERLW',
        ggr: 'GGR',
        mot: 'MOT',
        scc: 'SCC',
        dsotdq: 'DSotDQ',
        lox: 'LoX',
        pabtso: 'PaBTSO',
        tftyp: 'TftYP',
        pota: 'PotA',
        ai: 'AI',
        psz: 'PSZ',
        skt: 'SKT',
        vrgr: 'VRGR',
        veor: 'VEoR',
        mabjov: 'MaBJoV',
        imr: 'IMR'
    };

    for (const rel of Array.from(candidateRels)) {
        const parts = rel.split('/');
        if (parts.length >= 3 && parts[0] === 'bestiary' && parts[1] === 'tokens') {
            const srcLower = parts[2].toLowerCase();
            if (canonicalSources[srcLower] && canonicalSources[srcLower] !== parts[2]) {
                const fixedParts = [...parts];
                fixedParts[2] = canonicalSources[srcLower];
                candidateRels.add(fixedParts.join('/'));
            }
        }
    }

    const mirrorHosts = [
        'https://raw.githubusercontent.com/5etools-mirror-2/5etools-img/main/',
        'https://5e.tools/img/',
        'https://raw.githubusercontent.com/5etools-mirror-1/5etools-img/main/'
    ];

    const candidates = [];
    for (const host of mirrorHosts) {
        for (const rel of candidateRels) {
            candidates.push(`${host}${encodeURI(rel)}`);
        }
    }

    // Partnered / homebrew / 3rd-party repositories (e.g. Kobold Press ToB1-2023, ToB, etc.)
    for (const rel of candidateRels) {
        const parts = rel.split('/');
        if (parts.length >= 4 && parts[0] === 'bestiary' && parts[1] === 'tokens') {
            const src = parts[2];
            const fileName = parts.slice(3).join('/');
            // TheGiddyLimit/homebrew-img uses: img/{source}/bestiary/tokens/{name}
            candidates.push(
                `https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/img/${encodeURI(src)}/bestiary/tokens/${encodeURI(fileName)}`
            );
            candidates.push(
                `https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/img/bestiary/tokens/${encodeURI(src)}/${encodeURI(fileName)}`
            );
            candidates.push(`https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/img/${encodeURI(rel)}`);
        }
    }

    for (const mirrorUrl of candidates) {
        try {
            const response = await fetch(mirrorUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000)
            });

            if (response.ok) {
                const buf = Buffer.from(await response.arrayBuffer());
                if (buf.length > 50) {
                    // Cache in user assets directory (writable even in packaged mode)
                    try {
                        const userDir = path.dirname(userTarget);
                        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
                        fs.writeFileSync(userTarget, buf);
                    } catch (cacheErr) {
                        // Notice log only; never fail the download response due to disk cache notice
                    }

                    // If not running in packaged asar, also cache in dev directories if writable
                    if (!rootDir.includes('.asar')) {
                        for (const devTarget of [localTarget, vttTarget]) {
                            try {
                                const dir = path.dirname(devTarget);
                                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                                fs.writeFileSync(devTarget, buf);
                            } catch (e) {}
                        }
                    }

                    const ext = path.extname(userTarget).toLowerCase();
                    const mimeType =
                        ext === '.webp'
                            ? 'image/webp'
                            : ext === '.png'
                              ? 'image/png'
                              : ext === '.jpg' || ext === '.jpeg'
                                ? 'image/jpeg'
                                : ext === '.svg'
                                  ? 'image/svg+xml'
                                  : ext === '.gif'
                                    ? 'image/gif'
                                    : response.headers.get('content-type') || 'application/octet-stream';

                    res.setHeader('Content-Type', mimeType);
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    return res.send(buf);
                }
            }
        } catch (e) {
            // Try next mirror candidate
        }
    }

    // Bestiary Token Fallback: If a specific source token was not found (e.g. FleeMortals/Specter.webp or OotA/Zhentarim Thug.webp),
    // check if MM or XMM has a matching token for this creature.
    const tokenMatch = cleanRel.match(/^bestiary\/tokens\/[^\/]+\/(.+)$/i);
    if (tokenMatch) {
        const rawFileName = tokenMatch[1];
        const fileBase = path.basename(rawFileName, path.extname(rawFileName));
        const words = fileBase.split(/[\s_-]+/);
        const candidateNames = [rawFileName, `${words[words.length - 1]}.webp`];

        for (const candName of candidateNames) {
            for (const fallbackSrc of ['MM', 'XMM', 'CoS']) {
                const fallbackRel = path.join('img', 'bestiary', 'tokens', fallbackSrc, candName);
                const vttFb = path.join(VTT_DIR, fallbackRel);
                if (fs.existsSync(vttFb) && isRealWebpFile(vttFb)) {
                    return sendImageFile(vttFb, res);
                }
                const srcFb = path.join(rootDir, '5etools-src', fallbackRel);
                if (fs.existsSync(srcFb) && isRealWebpFile(srcFb)) {
                    return sendImageFile(srcFb, res);
                }
            }
        }
    }

    // Local asset not found - return clean 404 (handled offline by client token generator)
    res.status(404).send('Image not found');
});
