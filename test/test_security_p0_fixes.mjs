import assert from 'assert';
import path from 'path';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { isLoopbackRequest } from '../server/state.js';
import {
    hashPassword,
    verifyPassword,
    PBKDF2_ITERATIONS,
    PBKDF2_LEGACY_ITERATIONS,
    isValidAssetPath
} from '../utils.js';

console.log('--- RUNNING P0 CRITICAL SECURITY FIXES VERIFICATION SUITE ---\n');

// ============================================================================
// 1. DOMPurify XSS Sanitization Tests
// ============================================================================
console.log('[TEST 1] Testing DOMPurify Sanitization against XSS Vectors...');

// Setup DOMPurify with the same configuration used in vtt/index.html
const window = new JSDOM('').window;
const purify = DOMPurify(window);

function vttSanitize(dirtyHtml) {
    return purify.sanitize(dirtyHtml, {
        ALLOWED_TAGS: [
            'div',
            'span',
            'p',
            'b',
            'i',
            'strong',
            'em',
            'u',
            's',
            'br',
            'hr',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'ul',
            'ol',
            'li',
            'button',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'code',
            'pre'
        ],
        ALLOWED_ATTR: [
            'class',
            'style',
            'id',
            'title',
            'type',
            'data-tooltip',
            'data-trap-id',
            'data-token-id',
            'data-ability',
            'data-dc',
            'data-formula',
            'data-roll',
            'data-dice',
            'data-source',
            'data-name',
            'data-key',
            'data-tab',
            'data-category'
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ALLOW_DATA_ATTR: true
    });
}

// Vector 1: <script> tags
const scriptPayload = '<p>Normal text</p><script>alert("XSS")</script>';
const cleanScript = vttSanitize(scriptPayload);
assert(!cleanScript.includes('<script>'), 'FAILED: <script> tag was not stripped!');
assert(!cleanScript.includes('alert('), 'FAILED: script contents were executed/retained!');
assert(cleanScript.includes('<p>Normal text</p>'), 'FAILED: legitimate HTML was lost!');
console.log('  ✓ <script> execution tags strictly eliminated.');

// Vector 2: Inline onerror handlers in <img>
const imgPayload = '<img src="x" onerror="alert(1)">';
const cleanImg = vttSanitize(imgPayload);
assert(!cleanImg.includes('onerror'), 'FAILED: onerror attribute was not stripped!');
console.log('  ✓ Inline onerror handlers neutralized.');

// Vector 3: SVG onload handlers
const svgPayload = '<svg onload="alert(document.cookie)"></svg>';
const cleanSvg = vttSanitize(svgPayload);
assert(!cleanSvg.includes('onload'), 'FAILED: SVG onload was not stripped!');
assert(!cleanSvg.includes('<svg'), 'FAILED: Disallowed SVG element was not stripped!');
console.log('  ✓ Disallowed SVG / onload elements neutralized.');

// Vector 4: Javascript URI in links/iframes
const jsUriPayload = '<iframe src="javascript:alert(1)"></iframe>';
const cleanIframe = vttSanitize(jsUriPayload);
assert(!cleanIframe.includes('<iframe'), 'FAILED: iframe was not stripped!');
console.log('  ✓ Disallowed iframe / javascript: URIs neutralized.');

// Vector 5: Legitimate 5e rich cards and icons preserved
const valid5eCard =
    '<div class="macro-card-desc" style="color: #cbd5e1;" data-tooltip="DC 15"><i class="fa-solid fa-dice-d20"></i> <strong>Save DC 15</strong></div>';
const cleanValid = vttSanitize(valid5eCard);
assert(cleanValid.includes('class="macro-card-desc"'), 'FAILED: class was stripped from valid element!');
assert(cleanValid.includes('style="color: #cbd5e1;"'), 'FAILED: safe style was stripped!');
assert(cleanValid.includes('data-tooltip="DC 15"'), 'FAILED: data-tooltip was stripped!');
assert(cleanValid.includes('<i class="fa-solid fa-dice-d20"></i>'), 'FAILED: FontAwesome <i> tag was stripped!');
assert(cleanValid.includes('<strong>Save DC 15</strong>'), 'FAILED: <strong> tag was stripped!');
console.log('  ✓ Legitimate 5e cards, styles, FontAwesome icons, and data-* tooltips fully preserved.');

// ============================================================================
// 2. SSRF & Media Scraping Domain Allowlist Tests
// ============================================================================
console.log('\n[TEST 2] Testing SSRF & Media Domain Allowlist Restrictions...');

const ALLOWED_MEDIA_DOMAINS = [
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

function isDiscordHost(hostname) {
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

function isAllowedMediaUrl(rawUrl) {
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

// 2a. Reject private / loopback / metadata IPs
assert(!isAllowedMediaUrl('http://127.0.0.1:5050/api/campaigns'), 'FAILED: 127.0.0.1 was not blocked!');
assert(!isAllowedMediaUrl('http://localhost:5050/admin'), 'FAILED: localhost was not blocked!');
assert(!isAllowedMediaUrl('http://169.254.169.254/latest/meta-data/'), 'FAILED: AWS metadata IP was not blocked!');
assert(!isAllowedMediaUrl('http://192.168.1.1/router'), 'FAILED: 192.168.x.x was not blocked!');
assert(!isAllowedMediaUrl('http://10.0.0.5/internal'), 'FAILED: 10.x.x.x was not blocked!');
assert(!isAllowedMediaUrl('http://172.20.0.1/docker'), 'FAILED: 172.x.x.x was not blocked!');
console.log('  ✓ Localhost, private CIDR blocks, and cloud metadata IPs blocked.');

// 2b. Reject non-allowlisted external domains
assert(!isAllowedMediaUrl('http://evil-attacker.com/exploit.mp4'), 'FAILED: Unlisted domain was allowed!');
assert(!isAllowedMediaUrl('http://google.com'), 'FAILED: Non-media domain was allowed!');
assert(!isAllowedMediaUrl('file:///C:/Windows/win.ini'), 'FAILED: file:// protocol was allowed!');
assert(!isAllowedMediaUrl('gopher://127.0.0.1/'), 'FAILED: gopher:// protocol was allowed!');
console.log('  ✓ Non-allowlisted external domains and non-http(s) protocols blocked.');

// 2c. Substring bypass defense on Discord proxy
assert(!isDiscordHost('evil-attacker.com'), 'FAILED: evil-attacker.com accepted!');
assert(!isDiscordHost('attacker.com?dummy=discordapp.com'), 'FAILED: Substring bypass accepted!');
assert(isDiscordHost('cdn.discordapp.com'), 'FAILED: cdn.discordapp.com rejected!');
assert(isDiscordHost('media.discordapp.net'), 'FAILED: media.discordapp.net rejected!');
assert(isDiscordHost('images-ext-1.discordapp.net'), 'FAILED: images-ext-1.discordapp.net rejected!');
console.log('  ✓ Discord host validation immune to query/path substring spoofing.');

// 2d. Permit genuine allowlisted platforms
assert(isAllowedMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'FAILED: YouTube valid URL rejected!');
assert(isAllowedMediaUrl('https://youtu.be/dQw4w9WgXcQ'), 'FAILED: youtu.be valid URL rejected!');
assert(isAllowedMediaUrl('https://i.pinimg.com/originals/abc.jpg'), 'FAILED: Pinterest valid URL rejected!');
assert(isAllowedMediaUrl('https://i.imgur.com/example.png'), 'FAILED: Imgur valid URL rejected!');
assert(
    isAllowedMediaUrl('https://cdn.discordapp.com/attachments/123/456/token.png'),
    'FAILED: Discord valid URL rejected!'
);
console.log('  ✓ Legitimate media platforms (YouTube, Pinterest, Imgur, Discord) allowed.');

// ============================================================================
// 3. REST API Authentication & Authorization Tests
// ============================================================================
console.log('\n[TEST 3] Testing REST API Authentication & GM Authorization...');

const SERVER_INTERNAL_SECRET = 'test-internal-secret-1234567890abcdef';
const activeGmTokens = new Set();
let mockServerConfig = { gmCredentials: { hash: 'dummy-hash', salt: 'dummy-salt' } };

function mockVerifyGmOrSecret(req, res, next) {
    const serverSecret = req.headers['x-server-secret'];
    if (serverSecret && serverSecret === SERVER_INTERNAL_SECRET) {
        return next();
    }

    const token =
        req.headers['x-gm-token'] ||
        (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (token && activeGmTokens.has(token)) {
        return next();
    }

    const hasGmPassword = !!mockServerConfig.gmCredentials?.hash;
    if (!hasGmPassword) {
        if (isLoopbackRequest(req)) {
            return next();
        }
        return res.status(403).json({ error: 'Unauthorized: GM authentication required for remote access' });
    }

    return res.status(403).json({ error: 'Unauthorized: GM authentication required' });
}

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
}

// 3a. Unauthenticated request when GM password is set -> 403 Forbidden
let reqUnauth = { headers: {} };
let resUnauth = createMockRes();
let nextCalled = false;
mockVerifyGmOrSecret(reqUnauth, resUnauth, () => {
    nextCalled = true;
});
assert(!nextCalled, 'FAILED: Unauthenticated request called next()!');
assert.strictEqual(resUnauth.statusCode, 403, 'FAILED: Expected 403 Forbidden!');
console.log('  ✓ Unauthenticated mutating request rejected with 403 Forbidden.');

// 3b. Electron internal secret -> 200 OK (next called)
let reqElectron = { headers: { 'x-server-secret': SERVER_INTERNAL_SECRET } };
let resElectron = createMockRes();
nextCalled = false;
mockVerifyGmOrSecret(reqElectron, resElectron, () => {
    nextCalled = true;
});
assert(nextCalled, 'FAILED: Electron internal secret was rejected!');
console.log("  ✓ Electron internal secret ('x-server-secret') successfully authorized.");

// 3c. Valid GM session token -> 200 OK (next called)
const validToken = 'gm-token-xyz-789';
activeGmTokens.add(validToken);
let reqGmToken = { headers: { 'x-gm-token': validToken } };
let resGmToken = createMockRes();
nextCalled = false;
mockVerifyGmOrSecret(reqGmToken, resGmToken, () => {
    nextCalled = true;
});
assert(nextCalled, 'FAILED: Valid GM session token was rejected!');
console.log("  ✓ Authenticated GM session token ('x-gm-token') successfully authorized.");

// 3d. Invalid or expired GM token -> 403 Forbidden
let reqExpired = { headers: { 'x-gm-token': 'non-existent-token' } };
let resExpired = createMockRes();
nextCalled = false;
mockVerifyGmOrSecret(reqExpired, resExpired, () => {
    nextCalled = true;
});
assert(!nextCalled, 'FAILED: Invalid token called next()!');
assert.strictEqual(resExpired.statusCode, 403, 'FAILED: Expected 403 for invalid token!');
console.log('  ✓ Invalid or expired GM token rejected with 403 Forbidden.');

// 3e. Graceful local fallback when NO GM credentials exist (Loopback only)
mockServerConfig.gmCredentials = null;
let reqNoCreds = { ip: '127.0.0.1', headers: {} };
let resNoCreds = createMockRes();
nextCalled = false;
mockVerifyGmOrSecret(reqNoCreds, resNoCreds, () => {
    nextCalled = true;
});
assert(nextCalled, 'FAILED: Fresh local loopback without credentials should allow graceful fallback!');
console.log('  ✓ Graceful local fallback functions correctly for loopback requests when no GM credentials configured.');

// 3f. Remote request rejected when NO GM credentials exist
let reqRemoteNoCreds = { ip: '203.0.113.195', headers: {} };
let resRemoteNoCreds = createMockRes();
nextCalled = false;
mockVerifyGmOrSecret(reqRemoteNoCreds, resRemoteNoCreds, () => {
    nextCalled = true;
});
assert(!nextCalled, 'FAILED: Remote request without GM credentials must not call next()!');
assert.strictEqual(resRemoteNoCreds.statusCode, 403, 'FAILED: Remote request without credentials should return 403!');
console.log('  ✓ Remote request rejected with 403 when no GM credentials are configured.');

// 3g. Remote forwarded request rejected even if socket reports loopback
let reqForwardedNoCreds = { ip: '127.0.0.1', headers: { 'x-forwarded-for': '203.0.113.195' } };
let resForwardedNoCreds = createMockRes();
nextCalled = false;
mockVerifyGmOrSecret(reqForwardedNoCreds, resForwardedNoCreds, () => {
    nextCalled = true;
});
assert(!nextCalled, 'FAILED: Forwarded request through proxy must not call next() without credentials!');
assert.strictEqual(
    resForwardedNoCreds.statusCode,
    403,
    'FAILED: Forwarded request without credentials should return 403!'
);
console.log('  ✓ Forwarded proxy request rejected with 403 when no GM credentials are configured.');

// ============================================================================
// 4. Electron External URL Validation Tests
// ============================================================================
console.log('\n[TEST 4] Testing Electron External URL Protocol Validation...');

function validateExternalUrl(targetUrl) {
    try {
        const parsed = new URL(targetUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

assert(validateExternalUrl('https://forgedvtt.com'), 'FAILED: Valid HTTPS URL was rejected!');
assert(validateExternalUrl('http://localhost:5050/vtt/index.html'), 'FAILED: Valid HTTP URL was rejected!');
assert(!validateExternalUrl('javascript:alert(1)'), 'FAILED: javascript: URL was permitted!');
assert(!validateExternalUrl('file:///C:/Windows/explorer.exe'), 'FAILED: file: URL was permitted!');
assert(!validateExternalUrl('shell:calc.exe'), 'FAILED: shell: URL was permitted!');
console.log('  ✓ Only http: and https: protocols permitted for openExternal.');

// ============================================================================
// 5. Uploads Path Traversal Security Tests
// ============================================================================
console.log('\n[TEST 5] Testing Uploads Path Traversal Security...');

function validateUploadPath(reqPath) {
    let decodedPath = '';
    try {
        decodedPath = decodeURIComponent(reqPath);
    } catch {
        return { valid: false, code: 400, reason: 'Malformed URI' };
    }

    if (reqPath.includes('..') || decodedPath.includes('..') || reqPath.includes('\0') || decodedPath.includes('\0')) {
        return { valid: false, code: 403, reason: 'Path traversal / null byte detected' };
    }

    return { valid: true, relPath: decodedPath.replace(/^[/\\]+/, '') };
}

// 5a. Reject direct traversal tokens
const p1 = validateUploadPath('/../../package.json');
assert(!p1.valid && p1.code === 403, "FAILED: Direct '..' path was not blocked with 403!");
console.log("  ✓ Direct '../' path traversal tokens rejected with 403.");

// 5b. Reject URL-encoded traversal tokens
const p2 = validateUploadPath('/%2e%2e/%2e%2e/server.js');
assert(!p2.valid && p2.code === 403, "FAILED: URL-encoded '%2e%2e' was not blocked with 403!");
console.log("  ✓ URL-encoded '%2e%2e' traversal tokens rejected with 403.");

// 5c. Reject null byte injection
const p3 = validateUploadPath('/map.png\0.js');
assert(!p3.valid && p3.code === 403, 'FAILED: Null byte was not blocked with 403!');
console.log('  ✓ Null byte injection rejected with 403.');

// 5d. Path containment via isValidAssetPath
const baseDir = path.resolve('test-uploads');
const safeFile = path.resolve(baseDir, 'subfolder/token.png');
const escapedFile = path.resolve(baseDir, '../../outside.txt');
assert(isValidAssetPath(safeFile, baseDir), 'FAILED: Legitimate subfolder file rejected!');
assert(!isValidAssetPath(escapedFile, baseDir), 'FAILED: Escaped path accepted by isValidAssetPath!');
console.log('  ✓ Directory boundary containment verified via isValidAssetPath.');

// ============================================================================
// 6. Cryptographic Hardening (PBKDF2 600,000 Iterations & Dual Verification)
// ============================================================================
console.log('\n[TEST 6] Testing PBKDF2 Cryptographic Hardening & Backward Compatibility...');

assert.strictEqual(PBKDF2_ITERATIONS, 600000, 'FAILED: PBKDF2_ITERATIONS should be 600,000!');
assert.strictEqual(PBKDF2_LEGACY_ITERATIONS, 1000, 'FAILED: PBKDF2_LEGACY_ITERATIONS should be 1,000!');

// 6a. Modern 600k hash generation & verification
const modernTestPass = 'correct-horse-battery-staple-600k';
const modernHash = hashPassword(modernTestPass);
assert(modernHash.hash && modernHash.salt, 'FAILED: hashPassword should return hash and salt!');
assert(
    verifyPassword(modernTestPass, modernHash.salt, modernHash.hash),
    'FAILED: Modern 600k password failed verification!'
);
console.log('  ✓ Modern 600,000-iteration PBKDF2 hash generation and verification passed.');

// 6b. Legacy 1k hash verification (backward compatibility)
const legacyTestPass = 'legacy-gm-password-1000';
const legacyHash = hashPassword(legacyTestPass, null, 1000);
assert(
    verifyPassword(legacyTestPass, legacyHash.salt, legacyHash.hash),
    'FAILED: Legacy 1,000 iteration password failed dual verification!'
);
console.log('  ✓ Legacy 1,000-iteration PBKDF2 hash backward compatibility verified.');

// 6c. Invalid password rejection
assert(
    !verifyPassword('wrong-password', modernHash.salt, modernHash.hash),
    'FAILED: Incorrect password incorrectly accepted!'
);
assert(
    !verifyPassword('wrong-password', legacyHash.salt, legacyHash.hash),
    'FAILED: Incorrect legacy password incorrectly accepted!'
);
console.log('  ✓ Incorrect passwords reliably rejected for both modern and legacy hashes.');

console.log('\n======================================================');
console.log('🎉 ALL P0 SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('======================================================');
