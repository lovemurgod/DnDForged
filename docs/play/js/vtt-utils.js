// DnDForged VTT Shared Utility Library
// Consolidates common URL, HTML, Math, and timing helpers with dual ES module and window.VTT.utils exports

/**
 * Normalizes and secures media URLs, proxying Discord CDN assets to avoid CORS/expiration issues.
 * @param {string} url - Target URL or relative path
 * @returns {string} Safe resolved URL
 */
export function getSafeVttUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('discordapp.com') || url.includes('discordapp.net')) {
        return '/api/proxy-discord?url=' + encodeURIComponent(url);
    }
    if (url.startsWith('img/bestiary/tokens/') || url.startsWith('/img/bestiary/tokens/')) {
        const sep = url.includes('?') ? '&' : '?';
        const version = (typeof window !== 'undefined' && window?.VTT?.buildVersion) || '1';
        return url + sep + 'v=' + encodeURIComponent(version);
    }
    return url;
}

/**
 * Escapes special HTML characters to prevent raw script injections.
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Strips all HTML tags, returning plain text.
 * @param {string} html - HTML string
 * @returns {string} Plain text without tags
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Clamps a numeric value between a minimum and maximum boundary.
 * @param {number} val - Input number
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Clamped number
 */
export function clamp(val, min, max) {
    if (Number.isNaN(val)) return min;
    return Math.max(min, Math.min(max, val));
}

/**
 * Linearly interpolates between two numbers.
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolant factor (0.0 to 1.0)
 * @returns {number} Interpolated value
 */
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Normalizes an angle in radians to the range [0, 2*PI).
 * @param {number} rad - Angle in radians
 * @returns {number} Normalized angle in [0, 2*PI)
 */
export function normalizeAngleRad(rad) {
    const twoPi = Math.PI * 2;
    let norm = rad % twoPi;
    if (norm < 0) norm += twoPi;
    return norm;
}

/**
 * Creates a debounced function that delays invocation until waitMs have elapsed since the last call.
 * @param {Function} fn - Function to debounce
 * @param {number} waitMs - Debounce delay in milliseconds
 * @returns {Function} Debounced function with .cancel()
 */
export function debounce(fn, waitMs = 200) {
    let timeoutId = null;
    const debounced = function (...args) {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            fn.apply(this, args);
        }, waitMs);
    };
    debounced.cancel = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    return debounced;
}

/**
 * Creates a throttled function that invokes fn at most once every waitMs.
 * @param {Function} fn - Function to throttle
 * @param {number} waitMs - Throttle interval in milliseconds
 * @returns {Function} Throttled function with .cancel()
 */
export function throttle(fn, waitMs = 100) {
    let lastCall = 0;
    let timeoutId = null;
    const throttled = function (...args) {
        const now = Date.now();
        const remaining = waitMs - (now - lastCall);
        if (remaining <= 0 || remaining > waitMs) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            fn.apply(this, args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
    throttled.cancel = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        lastCall = 0;
    };
    return throttled;
}

/**
 * Resolves a player's individual map override case-insensitively.
 * @param {object} campaign - Campaign state object
 * @param {string} username - Target username
 * @returns {string|null} Map ID if override exists, otherwise null
 */
export function getPlayerMapOverride(campaign, username) {
    if (!campaign?.playerMapOverrides || !username) return null;
    if (campaign.playerMapOverrides[username]) return campaign.playerMapOverrides[username];
    const uLower = String(username).toLowerCase();
    for (const key in campaign.playerMapOverrides) {
        if (key.toLowerCase() === uLower) return campaign.playerMapOverrides[key];
    }
    return null;
}

// Global browser registration for backward compatibility
if (typeof window !== 'undefined') {
    window.VTT = window.VTT || {};
    window.VTT.utils = {
        getSafeVttUrl,
        escapeHtml,
        stripHtml,
        clamp,
        lerp,
        normalizeAngleRad,
        debounce,
        throttle,
        getPlayerMapOverride
    };
    if (!window.getSafeVttUrl) {
        window.getSafeVttUrl = getSafeVttUrl;
    }
    if (!window.getPlayerMapOverride) {
        window.getPlayerMapOverride = getPlayerMapOverride;
    }
}
