// DnDForged VTT Shared Utility Library
// Consolidates common URL, HTML, Math, and timing helpers with dual ES module and window.VTT.utils exports

/**
 * Normalizes and secures media URLs, proxying Discord CDN assets to avoid CORS/expiration issues.
 * @param {string} url - Target URL or relative path
 * @returns {string} Safe resolved URL
 */
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|gif|webp|avif|svg\+xml);base64,[a-z0-9+/=\s]+$/i;
const URL_SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

export function getSafeVttUrl(url) {
    if (!url || typeof url !== 'string') return url;
    const cleaned = Array.from(url)
        .filter((ch) => {
            const code = ch.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .trim();
    if (!cleaned) return '';

    const schemeMatch = cleaned.match(URL_SCHEME_RE);
    if (schemeMatch) {
        const scheme = schemeMatch[1].toLowerCase();
        if (scheme === 'data') {
            if (!SAFE_DATA_IMAGE_RE.test(cleaned)) return '';
        } else if (scheme !== 'http' && scheme !== 'https' && scheme !== 'blob' && scheme !== 'forgedvtt-asset') {
            return '';
        }
    }

    const isStaticWeb = typeof window !== 'undefined' && Boolean(window.__FORGEDVTT_STATIC_WEB__);
    if (schemeMatch && (schemeMatch[1].toLowerCase() === 'http' || schemeMatch[1].toLowerCase() === 'https')) {
        try {
            const parsed = new URL(cleaned);
            const host = parsed.hostname.toLowerCase();
            if (
                host === 'discordapp.com' ||
                host.endsWith('.discordapp.com') ||
                host === 'discordapp.net' ||
                host.endsWith('.discordapp.net')
            ) {
                if (isStaticWeb) return cleaned;
                return '/api/proxy-discord?url=' + encodeURIComponent(cleaned);
            }
        } catch {
            return '';
        }
    }
    if (
        typeof window !== 'undefined' &&
        window.VTT?.socket &&
        typeof window.VTT.socket.resolveAssetUrl === 'function'
    ) {
        const resolved = window.VTT.socket.resolveAssetUrl(cleaned);
        if (resolved) return resolved;
    }
    if (typeof window !== 'undefined' && typeof window.__resolveStaticAssetUrl === 'function') {
        const resolved = window.__resolveStaticAssetUrl(cleaned);
        if (resolved) return resolved;
    }
    if (cleaned.startsWith('img/bestiary/tokens/') || cleaned.startsWith('/img/bestiary/tokens/')) {
        let outUrl = cleaned;
        if (isStaticWeb && outUrl.toLowerCase().endsWith('.webp')) {
            outUrl = outUrl.slice(0, -5) + '.svg';
        }
        const sep = outUrl.includes('?') ? '&' : '?';
        const version = (typeof window !== 'undefined' && window?.VTT?.buildVersion) || '1';
        return outUrl + sep + 'v=' + encodeURIComponent(version);
    }
    return cleaned;
}

// Global CSP-safe fallback image & stopPropagation delegation for dynamic innerHTML templates
if (
    typeof document !== 'undefined' &&
    typeof document.addEventListener === 'function' &&
    !globalThis.__vttCspDelegationAttached
) {
    globalThis.__vttCspDelegationAttached = true;
    document.addEventListener(
        'error',
        (e) => {
            const el = e.target;
            if (!(el instanceof HTMLImageElement)) return;
            const fallback = el.getAttribute('data-fallback-src');
            if (fallback && el.getAttribute('src') !== fallback) {
                el.src = fallback;
            } else if (el.hasAttribute('data-fallback-hide-parent')) {
                if (el.parentElement) el.parentElement.style.display = 'none';
            } else if (el.hasAttribute('data-fallback-hide-prev-show-next')) {
                el.style.display = 'none';
                if (el.previousElementSibling) el.previousElementSibling.style.display = 'none';
                if (el.nextElementSibling) el.nextElementSibling.style.display = 'block';
            } else if (el.hasAttribute('data-fallback-hide-show-next')) {
                el.style.display = 'none';
                if (el.nextElementSibling) el.nextElementSibling.style.display = 'flex';
            } else if (el.hasAttribute('data-fallback-monogram-letters')) {
                const div = document.createElement('div');
                div.className = 'init-monogram-avatar';
                div.style.background = el.getAttribute('data-fallback-monogram-bg') || '';
                div.style.borderColor = el.getAttribute('data-fallback-monogram-border') || '';
                div.style.color = el.getAttribute('data-fallback-monogram-color') || '';
                div.textContent = el.getAttribute('data-fallback-monogram-letters') || '';
                if (el.parentElement) {
                    el.parentElement.innerHTML = '';
                    el.parentElement.appendChild(div);
                }
            } else if (el.hasAttribute('data-fallback-hide')) {
                el.style.display = 'none';
            } else if (el.hasAttribute('data-fallback-arcane') && !el.dataset.arcaneApplied) {
                el.dataset.arcaneApplied = '1';
                const arcaneName = el.getAttribute('data-fallback-arcane') || 'Creature';
                if (window.VTT?.generateArcaneToken) {
                    el.src = window.VTT.generateArcaneToken(arcaneName, 'monster');
                } else {
                    el.src = 'favicon.svg';
                }
            }
        },
        true
    );
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target instanceof Element && target.closest('[data-stop-propagation="true"]')) {
            e.stopPropagation();
        }
    });
}

/**
 * Normalizes a creature name to the canonical token filename (preserving spaces/hyphens).
 * @param {string} name
 * @returns {string}
 */
export function normalizeMonsterTokenFilename(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Æ/g, 'AE')
        .replace(/æ/g, 'ae')
        .replace(/[<>:"/\\|?*]/g, '')
        .trim();
}

/**
 * Resolves the canonical bestiary token image URL for a monster object,
 * using .svg in Static Web / SRD-only mode and .webp otherwise.
 * @param {object} monster
 * @returns {string|null}
 */
export function resolveMonsterTokenUrl(monster) {
    if (!monster) return null;
    if (monster.tokenImg) return monster.tokenImg;
    if (monster.tokenUrl) return monster.tokenUrl;
    if (monster.imgUrl) return monster.imgUrl;
    const isStaticWeb = typeof window !== 'undefined' && Boolean(window.__FORGEDVTT_STATIC_WEB__);
    const ext = isStaticWeb || (typeof window !== 'undefined' && window.VTT?.srdTokensOnly) ? 'svg' : 'webp';
    const src = monster.source || 'MM';
    const cleanName =
        typeof Parser !== 'undefined' && Parser?.nameToTokenName
            ? Parser.nameToTokenName(monster.name)
            : normalizeMonsterTokenFilename(monster.name);
    if (!cleanName) return null;
    return `img/bestiary/tokens/${src}/${cleanName}.${ext}`;
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
        normalizeMonsterTokenFilename,
        resolveMonsterTokenUrl,
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
    if (!window.resolveMonsterTokenUrl) {
        window.resolveMonsterTokenUrl = resolveMonsterTokenUrl;
    }
}
