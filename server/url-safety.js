import http from 'http';
import https from 'https';
import dns from 'dns';

export const ALLOWED_MEDIA_DOMAINS = [
    'youtube.com',
    'youtu.be',
    'pinterest.com',
    'pin.it',
    'pinimg.com',
    'discordapp.com',
    'discordapp.net',
    'discord.com',
    'imgur.com'
];

export function isDiscordHost(hostname) {
    const h = (hostname || '').toLowerCase();
    return (
        h === 'discordapp.com' ||
        h.endsWith('.discordapp.com') ||
        h === 'discordapp.net' ||
        h.endsWith('.discordapp.net') ||
        h === 'discord.com' ||
        h.endsWith('.discord.com')
    );
}

export function isAllowedMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();

        // Explicitly reject loopback, internal CIDR, cloud metadata addresses
        if (/^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|::1|localhost)/.test(host)) {
            return false;
        }

        return ALLOWED_MEDIA_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
    } catch {
        return false;
    }
}

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

function requestWithPinnedLookup(targetUrl, resolvedRecord, headers, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(targetUrl);
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.request(
            parsed,
            {
                method: 'GET',
                headers,
                lookup: (hostname, options, cb) => {
                    if (typeof options === 'function') {
                        return options(null, resolvedRecord.address, resolvedRecord.family);
                    }
                    if (options && options.all) {
                        return cb(null, [{ address: resolvedRecord.address, family: resolvedRecord.family }]);
                    }
                    return cb(null, resolvedRecord.address, resolvedRecord.family);
                }
            },
            (res) => {
                const status = res.statusCode || 200;
                if ([301, 302, 303, 307, 308].includes(status)) {
                    res.resume();
                    return resolve({
                        status,
                        ok: false,
                        headers: { get: (k) => res.headers[String(k).toLowerCase()] ?? null },
                        text: async () => ''
                    });
                }
                const chunks = [];
                let totalBytes = 0;
                const MAX_FETCH_BYTES = 25 * 1024 * 1024;
                res.on('data', (chunk) => {
                    totalBytes += chunk.length;
                    if (totalBytes > MAX_FETCH_BYTES) {
                        req.destroy(new Error('Remote response exceeds maximum allowed size'));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    const buf = Buffer.concat(chunks);
                    resolve({
                        status,
                        statusText: res.statusMessage || '',
                        ok: status >= 200 && status < 300,
                        headers: { get: (k) => res.headers[String(k).toLowerCase()] ?? null },
                        text: async () => buf.toString('utf8'),
                        buffer: async () => buf
                    });
                });
                res.on('error', reject);
            }
        );
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error('Remote request timed out'));
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * Fetches a public URL with SSRF protection (rejects private/loopback IPs and pins DNS resolution).
 */
export async function safeFetchPublicUrl(
    targetUrl,
    { requireAllowedMediaDomain = false, maxRedirects = 3, headers = {} } = {}
) {
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

        if (requireAllowedMediaDomain && !isAllowedMediaUrl(currentUrl)) {
            throw new Error(`Target domain '${parsed.hostname}' is not permitted for media scraping`);
        }

        if (isPrivateOrLoopbackIp(parsed.hostname)) {
            throw new Error(`Target host resolved to prohibited IP address: ${parsed.hostname}`);
        }

        let selectedRecord;
        try {
            const records = await dns.promises.lookup(parsed.hostname, { all: true });
            if (!records || records.length === 0) {
                throw new Error(`No DNS records found for ${parsed.hostname}`);
            }
            for (const record of records) {
                if (isPrivateOrLoopbackIp(record.address)) {
                    throw new Error(`Target host resolved to prohibited IP address: ${record.address}`);
                }
            }
            selectedRecord = records[0];
        } catch (e) {
            if (e.message && e.message.includes('prohibited IP address')) {
                throw e;
            }
            throw new Error(`DNS resolution failed for ${parsed.hostname}: ${e.message}`, { cause: e });
        }

        const res = await requestWithPinnedLookup(currentUrl, selectedRecord, {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            ...headers
        });

        if ([301, 302, 303, 307, 308].includes(res.status)) {
            const location = res.headers.get('location');
            if (!location) {
                throw new Error('Redirect response missing location header');
            }
            const nextUrl = new URL(location, currentUrl).toString();
            redirectCount++;
            if (redirectCount > maxRedirects) {
                throw new Error('Too many redirects encountered while resolving URL');
            }
            currentUrl = nextUrl;
            continue;
        }

        return { response: res, finalUrl: currentUrl };
    }

    throw new Error('Too many redirects');
}
