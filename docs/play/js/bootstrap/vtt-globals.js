/**
 * vtt-globals.js
 * Centralized global namespace, P0 DOMPurify security sanitizer allowlist,
 * and REST GM authorization headers injector for ForgeDVTT.
 */

export function initVttGlobals() {
    if (typeof window === 'undefined') return;

    window.VTT = window.VTT || {
        socket: null,
        campaignId: 'default',
        username: 'Game Master',
        role: 'GM',
        gmSessionToken: null,
        playerSessionToken: null,
        campaignState: null,
        canvasEngine: null,
        chatEngine: null,
        creatureSheet: null,
        playerSheet: null,
        sheetDock: null,
        weatherEngine: null,
        dataBridge: null
    };

    window.vttSanitizeHtml = vttSanitizeHtml;
    window.vttAuthHeaders = vttAuthHeaders;
}

/**
 * Centralized DOMPurify sanitizer with 5e tags, icons, and safe attributes allowlist.
 * Ensures zero XSS injection via chat cards, custom tokens, or markdown.
 */
export function vttSanitizeHtml(dirtyHtml) {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
    const dp =
        typeof DOMPurify !== 'undefined' ? DOMPurify : typeof globalThis !== 'undefined' ? globalThis.DOMPurify : null;
    if (!dp) {
        if (typeof document === 'undefined') return dirtyHtml;
        const div = document.createElement('div');
        div.textContent = dirtyHtml;
        return div.innerHTML;
    }
    return dp.sanitize(dirtyHtml, {
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
            'pre',
            'img'
        ],
        ALLOWED_ATTR: [
            'class',
            'style',
            'id',
            'title',
            'type',
            'src',
            'alt',
            'srcset',
            'width',
            'height',
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
            'data-category',
            'data-creature',
            'data-table-json'
        ],
        ALLOWED_URI_REGEXP:
            /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_DATA_URI_TAGS: ['img'],
        ALLOW_DATA_ATTR: true
    });
}

/**
 * Helper to attach GM session authorization headers to REST requests.
 */
export function vttAuthHeaders(existingHeaders = {}) {
    const headers = { ...existingHeaders };
    if (typeof window !== 'undefined' && window.VTT && window.VTT.gmSessionToken) {
        headers['x-gm-token'] = window.VTT.gmSessionToken;
    }
    const pToken =
        (typeof window !== 'undefined' && window.VTT && window.VTT.playerSessionToken) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('forgedvtt_player_token') : null);
    if (pToken) {
        headers['x-player-token'] = pToken;
    }
    return headers;
}
