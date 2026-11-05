/**
 * vtt-canvas-tooltips-notes.js
 * Extracted GM & player creature stat tooltips, 5eTools notes viewer/editor modals,
 * and canvas note pin rendering pass.
 */

import { CONDITION_ICONS } from './tokens/vtt-canvas-token-rollers.js';

// Inject tooltip CSS once into document
export function injectGmTooltipStyles(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc || doc.getElementById('vtt-gm-tooltip-styles')) return;
    const style = doc.createElement('style');
    style.id = 'vtt-gm-tooltip-styles';
    style.textContent = `
        #vtt-gm-token-tooltip {
            position: fixed;
            z-index: 99999;
            width: 232px;
            background: rgba(12, 15, 24, 0.96);
            border: 1px solid rgba(212, 175, 55, 0.38);
            border-radius: 10px;
            box-shadow: 0 10px 36px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.04) inset;
            font-family: var(--font-primary, 'Inter', sans-serif);
            font-size: 12px;
            color: var(--color-text-primary, #e8e8ec);
            pointer-events: none;
            user-select: none;
            padding: 10px 12px 11px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            backdrop-filter: blur(8px);
            transition: opacity 0.1s ease;
        }
        #vtt-gm-token-tooltip .gm-tip-header {
            display: flex;
            align-items: center;
            gap: 7px;
            font-weight: 700;
            font-size: 13px;
            color: #d4af37;
            border-bottom: 1px solid rgba(212, 175, 55, 0.20);
            padding-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #vtt-gm-token-tooltip .gm-tip-row-primary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        #vtt-gm-token-tooltip .gm-tip-row-passives {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 4px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 6px;
        }
        #vtt-gm-token-tooltip .gm-tip-stat {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 6px;
            padding: 4px 6px;
            text-align: center;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-label {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8a90a0;
            margin-bottom: 1px;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-value {
            font-size: 15px;
            font-weight: 700;
            color: #fff;
            line-height: 1.1;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-value.sm {
            font-size: 11px;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #vtt-gm-token-tooltip .gm-tip-stat-value.na {
            color: #555c70;
            font-weight: 400;
        }
        #vtt-gm-token-tooltip .gm-tip-conditions {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 5px;
        }
        #vtt-gm-token-tooltip .gm-tip-cond-label {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8a90a0;
            margin-bottom: 4px;
        }
        #vtt-gm-token-tooltip .gm-tip-cond-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        #vtt-gm-token-tooltip .gm-tip-cond-pill {
            background: rgba(231, 76, 60, 0.15);
            border: 1px solid rgba(231, 76, 60, 0.35);
            border-radius: 4px;
            padding: 2px 5px;
            font-size: 10px;
            font-weight: 600;
            color: #e74c3c;
            display: flex;
            align-items: center;
            gap: 3px;
        }
    `;
    doc.head.appendChild(style);
}

// Helper: get resolved monster data for token or linked character
export function getResolvedCreatureMonsterData(token, context = {}) {
    if (!token) return null;
    if (token.monsterData) return token.monsterData;
    const campaignState = context.campaignState || (typeof window !== 'undefined' ? window.VTT?.campaignState : null);
    if (token.characterId && campaignState?.characters) {
        const char = campaignState.characters[token.characterId];
        if (char?.monsterData) return char.monsterData;
    }
    return null;
}

// Resolve AC for a token (monster or player character)
export function getTokenAC(token, context = {}) {
    if (!token) return null;
    const m = getResolvedCreatureMonsterData(token, context);
    if (m) {
        if (m.primaryAc !== undefined && m.primaryAc !== null && m.primaryAc !== '') return m.primaryAc;
        if (typeof m.ac === 'number') return m.ac;
        if (Array.isArray(m.ac) && m.ac.length > 0) {
            const entry = m.ac[0];
            if (typeof entry === 'object' && entry !== null) {
                return entry.ac ?? entry.value ?? null;
            }
            if (typeof entry === 'number') return entry;
        }
    }
    const campaignState = context.campaignState || (typeof window !== 'undefined' ? window.VTT?.campaignState : null);
    if (token.characterId && campaignState?.characters) {
        const char = campaignState.characters[token.characterId];
        if (char?.ac !== undefined && char.ac !== null && char.ac !== '') return char.ac;
    }
    if (token.ac !== undefined && token.ac !== null && token.ac !== '') return token.ac;
    return null;
}

// Resolve Speed for a token
export function getTokenSpeed(token, context = {}) {
    if (!token) return null;
    let speedData = null;
    const m = getResolvedCreatureMonsterData(token, context);
    const campaignState = context.campaignState || (typeof window !== 'undefined' ? window.VTT?.campaignState : null);
    if (m?.speed !== undefined && m.speed !== null) {
        speedData = m.speed;
    } else if (token.characterId && campaignState?.characters) {
        const char = campaignState.characters[token.characterId];
        if (char?.speed !== undefined && char.speed !== null && char.speed !== '') {
            speedData = char.speed;
        }
    } else if (token.speed !== undefined && token.speed !== null && token.speed !== '') {
        speedData = token.speed;
    }

    if (!speedData) return null;
    if (typeof speedData === 'number') return `${speedData} ft.`;
    if (typeof speedData === 'string') {
        return speedData.includes('ft') ? speedData : `${speedData} ft.`;
    }
    if (typeof speedData === 'object') {
        const parts = [];
        if (speedData.walk !== undefined && speedData.walk !== null) {
            const val = typeof speedData.walk === 'object' ? speedData.walk.number : speedData.walk;
            if (val) parts.push(`${val} ft.`);
        }
        ['fly', 'swim', 'climb', 'burrow'].forEach((mode) => {
            if (speedData[mode]) {
                const val = typeof speedData[mode] === 'object' ? speedData[mode].number : speedData[mode];
                if (val) {
                    const capitalized = mode.charAt(0).toUpperCase() + mode.slice(1);
                    parts.push(`${capitalized} ${val} ft.`);
                }
            }
        });
        return parts.length > 0 ? parts.join(', ') : null;
    }
    return null;
}

// Resolve Passive Perception for a token
export function getTokenPP(token, context = {}) {
    if (!token) return null;
    const m = getResolvedCreatureMonsterData(token, context);
    if (m) {
        if (m.passive !== undefined && m.passive !== null && m.passive !== '') return Number(m.passive);
        if (m.skill && m.skill.perception !== undefined) {
            return 10 + (parseInt(m.skill.perception) || 0);
        }
        if (typeof m.senses === 'string') {
            const match = m.senses.match(/passive Perception\s+(\d+)/i);
            if (match) return parseInt(match[1]);
        } else if (Array.isArray(m.senses)) {
            for (const s of m.senses) {
                const str = typeof s === 'string' ? s : s?.name || '';
                const match = str.match(/passive Perception\s+(\d+)/i);
                if (match) return parseInt(match[1]);
            }
        }
        const wis = m.wis ?? m.abilities?.wis?.score ?? 10;
        return 10 + Math.floor((wis - 10) / 2);
    }

    const campaignState = context.campaignState || (typeof window !== 'undefined' ? window.VTT?.campaignState : null);
    if (token.characterId && campaignState?.characters) {
        const char = campaignState.characters[token.characterId];
        if (!char || !char.stats) return null;

        const getMod = (score) => Math.floor((score - 10) / 2);
        const profBonus = Math.floor(((char.level || 1) - 1) / 4) + 2;

        let pp = 10 + getMod(char.stats.wis || 10);
        if (char.skills && char.skills['Perception']) pp += profBonus;
        if (char.expertise && char.expertise['Perception']) pp += profBonus;

        const customMod = char.skillMods && char.skillMods['Perception'] ? parseInt(char.skillMods['Perception']) : 0;
        if (!isNaN(customMod)) pp += customMod;

        const passMod =
            char.passiveSkillMods && char.passiveSkillMods['Perception']
                ? parseInt(char.passiveSkillMods['Perception'])
                : 0;
        if (!isNaN(passMod)) pp += passMod;

        if (char.skillToggles) {
            char.skillToggles
                .filter((t) => t.enabled)
                .forEach((t) => {
                    if (t.target === 'passive_all' || t.target === 'passive_perception') {
                        const val = parseInt(t.formula) || 0;
                        if (!isNaN(val)) pp += val;
                    }
                });
        }

        return pp;
    }
    return null;
}

// Resolve Passive Insight (PI) and Passive Investigation (PInv)
export function getTokenPassiveStats(token, context = {}) {
    if (!token) return { pi: null, pinv: null };
    const m = getResolvedCreatureMonsterData(token, context);
    if (m) {
        const wis = m.wis ?? m.abilities?.wis?.score ?? 10;
        const intScore = m.int ?? m.abilities?.int?.score ?? 10;
        const wisMod = Math.floor((wis - 10) / 2);
        const intMod = Math.floor((intScore - 10) / 2);

        let pi = 10 + wisMod;
        if (m.skill && m.skill.insight !== undefined) {
            pi = 10 + (parseInt(m.skill.insight) || 0);
        }

        let pinv = 10 + intMod;
        if (m.skill && m.skill.investigation !== undefined) {
            pinv = 10 + (parseInt(m.skill.investigation) || 0);
        }

        return { pi, pinv };
    }

    const campaignState = context.campaignState || (typeof window !== 'undefined' ? window.VTT?.campaignState : null);
    if (token.characterId && campaignState?.characters) {
        const char = campaignState.characters[token.characterId];
        if (!char || !char.stats) return { pi: null, pinv: null };

        const getMod = (score) => Math.floor((score - 10) / 2);
        const profBonus = Math.floor(((char.level || 1) - 1) / 4) + 2;

        // Passive Insight
        let pi = 10 + getMod(char.stats.wis || 10);
        if (char.skills && char.skills['Insight']) pi += profBonus;
        if (char.expertise && char.expertise['Insight']) pi += profBonus;
        const insMod = char.skillMods && char.skillMods['Insight'] ? parseInt(char.skillMods['Insight']) : 0;
        if (!isNaN(insMod)) pi += insMod;
        const passInsMod =
            char.passiveSkillMods && char.passiveSkillMods['Insight'] ? parseInt(char.passiveSkillMods['Insight']) : 0;
        if (!isNaN(passInsMod)) pi += passInsMod;
        if (char.skillToggles) {
            char.skillToggles
                .filter((t) => t.enabled)
                .forEach((t) => {
                    if (t.target === 'passive_all' || t.target === 'passive_insight') {
                        const val = parseInt(t.formula) || 0;
                        if (!isNaN(val)) pi += val;
                    }
                });
        }

        // Passive Investigation
        let pinv = 10 + getMod(char.stats.int || 10);
        if (char.skills && char.skills['Investigation']) pinv += profBonus;
        if (char.expertise && char.expertise['Investigation']) pinv += profBonus;
        const invMod =
            char.skillMods && char.skillMods['Investigation'] ? parseInt(char.skillMods['Investigation']) : 0;
        if (!isNaN(invMod)) pinv += invMod;
        const passInvMod =
            char.passiveSkillMods && char.passiveSkillMods['Investigation']
                ? parseInt(char.passiveSkillMods['Investigation'])
                : 0;
        if (!isNaN(passInvMod)) pinv += passInvMod;
        if (char.skillToggles) {
            char.skillToggles
                .filter((t) => t.enabled)
                .forEach((t) => {
                    if (t.target === 'passive_all' || t.target === 'passive_investigation') {
                        const val = parseInt(t.formula) || 0;
                        if (!isNaN(val)) pinv += val;
                    }
                });
        }

        return { pi, pinv };
    }

    return { pi: null, pinv: null };
}

// Check if stat tooltip is allowed to be viewed by the current user
export function isTokenTooltipAllowed(token, context = {}) {
    if (!token) return false;
    const activeLayer = context.activeLayer || 'token';
    const tokenLayer = token.layer || 'token';
    if (tokenLayer !== activeLayer) return false;

    const selectedTokenIds = context.selectedTokenIds || new Set();
    const selectedTokenId = context.selectedTokenId;
    if (selectedTokenIds.has(token.id) || (selectedTokenId && selectedTokenId === token.id)) return false;

    const vtt = context.vtt || {};
    const campaignSettings = context.campaignSettings || {};
    if (vtt.role === 'GM') {
        return campaignSettings.gmStatTooltipVisible !== 'never';
    }
    const setting = campaignSettings.playerStatTooltipVisible || 'never';
    if (setting === 'all') return true;
    if (setting === 'controlled') {
        return typeof context.isTokenControlledByPlayer === 'function'
            ? context.isTokenControlledByPlayer(token)
            : false;
    }
    return false;
}

export function showGmTokenTooltip(tokenId, force = false, context = {}) {
    const tokens = context.tokens || {};
    const token = tokens[tokenId];
    if (!token) return;

    if (!force && !isTokenTooltipAllowed(token, context)) return;

    hideGmTokenTooltip(context.doc || (typeof document !== 'undefined' ? document : null), context);

    if (context.setPendingTokenTooltipId) {
        context.setPendingTokenTooltipId(tokenId);
    }

    const ac = getTokenAC(token, context);
    const pp = getTokenPP(token, context);
    const speed = getTokenSpeed(token, context);
    const { pi, pinv } = getTokenPassiveStats(token, context);
    const conditions = Array.isArray(token.conditions) ? token.conditions : [];
    const hasConditions = conditions.length > 0;

    const acDisplay = ac !== null && ac !== undefined && ac !== '' ? String(ac) : null;
    const speedDisplay = speed !== null && speed !== undefined && speed !== '' ? String(speed) : null;
    const ppDisplay = pp !== null && pp !== undefined && pp !== '' ? String(pp) : null;
    const piDisplay = pi !== null && pi !== undefined && pi !== '' ? String(pi) : null;
    const pinvDisplay = pinv !== null && pinv !== undefined && pinv !== '' ? String(pinv) : null;

    let conditionsHtml = '';
    if (hasConditions) {
        const pills = conditions
            .map((c) => {
                if (c.isCustom) {
                    return `<div class="gm-tip-cond-pill" title="${c.name}" style="border-color: ${c.color}; color: ${c.color};">
                    <i class="fa-solid fa-circle"></i>
                    <span>${c.name}</span>
                </div>`;
                }
                const iconClass = CONDITION_ICONS[c.name] || 'fa-circle-exclamation';
                return `<div class="gm-tip-cond-pill" title="${c.name}">
                <i class="fa-solid ${iconClass}"></i>
                <span>${c.name}</span>
            </div>`;
            })
            .join('');
        conditionsHtml = `
            <div class="gm-tip-conditions">
                <div class="gm-tip-cond-label">Conditions</div>
                <div class="gm-tip-cond-pills">${pills}</div>
            </div>`;
    }

    const tokenTypeIcon = token.isPlayer ? 'fa-user' : 'fa-dragon';
    const doc = context.doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;

    const tooltip = doc.createElement('div');
    tooltip.id = 'vtt-gm-token-tooltip';
    tooltip.innerHTML = `
        <div class="gm-tip-header">
            <i class="fa-solid ${tokenTypeIcon}"></i>
            <span title="${token.name}">${token.name || 'Unknown'}</span>
        </div>
        <div class="gm-tip-row-primary">
            <div class="gm-tip-stat">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-shield-halved"></i> AC</div>
                <div class="gm-tip-stat-value ${acDisplay === null ? 'na' : ''}">${acDisplay !== null ? acDisplay : '—'}</div>
            </div>
            <div class="gm-tip-stat">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-person-running"></i> Speed</div>
                <div class="gm-tip-stat-value sm ${speedDisplay === null ? 'na' : ''}" title="${speedDisplay || ''}">${speedDisplay !== null ? speedDisplay : '—'}</div>
            </div>
        </div>
        <div class="gm-tip-row-passives">
            <div class="gm-tip-stat" title="Passive Perception">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-eye"></i> PP</div>
                <div class="gm-tip-stat-value ${ppDisplay === null ? 'na' : ''}">${ppDisplay !== null ? ppDisplay : '—'}</div>
            </div>
            <div class="gm-tip-stat" title="Passive Insight">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-brain"></i> PI</div>
                <div class="gm-tip-stat-value ${piDisplay === null ? 'na' : ''}">${piDisplay !== null ? piDisplay : '—'}</div>
            </div>
            <div class="gm-tip-stat" title="Passive Investigation">
                <div class="gm-tip-stat-label"><i class="fa-solid fa-magnifying-glass"></i> PInv</div>
                <div class="gm-tip-stat-value ${pinvDisplay === null ? 'na' : ''}">${pinvDisplay !== null ? pinvDisplay : '—'}</div>
            </div>
        </div>
        ${conditionsHtml}
    `;

    doc.body.appendChild(tooltip);
    _positionGmTooltip(tooltip, token, context);
}

export function _positionGmTooltip(tooltip, token, context = {}) {
    const viewport = context.viewport;
    if (!viewport || !tooltip || !token) return;
    const vr = viewport.getBoundingClientRect();
    const getTokenDrawDimensions =
        context.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50, tokenRadius: 25 }));
    const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(token);

    const zoom = context.zoom ?? 1;
    const panX = context.panX ?? 0;
    const panY = context.panY ?? 0;

    // Token center in screen/viewport space
    const cx = (token.x + drawW / 2) * zoom + panX + vr.left;
    const cy = (token.y + drawH / 2) * zoom + panY + vr.top;
    const screenRadius = tokenRadius * zoom;

    const tipW = tooltip.offsetWidth || 232;
    const tipH = tooltip.offsetHeight || 160;

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;

    let left = cx + screenRadius + 14;
    if (left + tipW > winW - 10) {
        left = cx - screenRadius - tipW - 14;
    }
    if (left < 10) {
        left = Math.max(10, Math.min(cx - tipW / 2, winW - tipW - 10));
    }
    let top = cy - tipH / 2;
    const maxTop = winH <= 900 ? winH - tipH - 74 : winH - tipH - 10;
    top = Math.max(10, Math.min(top, maxTop));

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
}

export function hideGmTokenTooltip(doc = typeof document !== 'undefined' ? document : null, context = {}) {
    if (context.clearTooltipTimeout) {
        context.clearTooltipTimeout();
    }
    if (doc) {
        const existing = doc.getElementById('vtt-gm-token-tooltip');
        if (existing) existing.remove();
    }
}

// ── 5eTools Note Viewer & Editor Modals ────────────────────────────────────────

export function openNoteViewer(note, context = {}) {
    const doc = context.doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || !note) return;

    const existing = doc.getElementById('vtt-note-viewer');
    if (existing) existing.remove();

    let renderedHtml = '';
    try {
        const win = typeof window !== 'undefined' ? window : null;
        if (note.content && win?.Renderer) {
            const renderer = win.Renderer.get();
            const stack = [];
            renderer.recursiveRender(note.content, stack, { depth: 0 });
            renderedHtml = stack.join('');
        } else if (note.content) {
            renderedHtml = `<pre style="white-space:pre-wrap;font-size:12px;">${JSON.stringify(note.content, null, 2)}</pre>`;
        }
    } catch (e) {
        renderedHtml = `<p style="color:#e74c3c;">Error rendering note content: ${e.message}</p>`;
    }

    const overlay = doc.createElement('div');
    overlay.id = 'vtt-note-viewer';
    overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(10,12,20,0.75)',
        'backdrop-filter:blur(4px)'
    ].join(';');

    const modal = doc.createElement('div');
    modal.style.cssText = [
        'position:relative',
        'width:min(700px,92vw)',
        'max-height:80vh',
        'background:linear-gradient(135deg,#12161f,#1a1d2b)',
        'border:1px solid rgba(212,175,55,0.35)',
        'border-radius:12px',
        'box-shadow:0 24px 80px rgba(0,0,0,0.7)',
        'display:flex',
        'flex-direction:column',
        'overflow:hidden'
    ].join(';');

    // Header
    const header = doc.createElement('div');
    header.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:16px 20px',
        'border-bottom:1px solid rgba(212,175,55,0.2)',
        'background:rgba(212,175,55,0.06)',
        'flex-shrink:0'
    ].join(';');

    const title = doc.createElement('h2');
    title.style.cssText =
        'margin:0;font-size:17px;font-weight:700;color:#d4af37;font-family:var(--font-primary,Inter);';
    title.textContent = `📍 ${note.name || `Area ${note.areaId || ''}`}`;

    const headerLeft = doc.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.alignItems = 'center';
    headerLeft.appendChild(title);

    const headerRight = doc.createElement('div');
    headerRight.style.display = 'flex';
    headerRight.style.alignItems = 'center';
    headerRight.style.gap = '12px';

    const vtt = context.vtt || {};
    if (vtt.role === 'GM') {
        const editBtn = doc.createElement('button');
        editBtn.innerHTML = '✏️ Edit';
        editBtn.style.cssText = [
            'background:rgba(212,175,55,0.15)',
            'border:1px solid rgba(212,175,55,0.3)',
            'color:#d4af37',
            'padding:4px 10px',
            'border-radius:4px',
            'font-size:12px',
            'cursor:pointer',
            'transition:background 0.2s'
        ].join(';');
        editBtn.onmouseover = () => {
            editBtn.style.background = 'rgba(212,175,55,0.25)';
        };
        editBtn.onmouseout = () => {
            editBtn.style.background = 'rgba(212,175,55,0.15)';
        };
        editBtn.onclick = () => {
            overlay.remove();
            openNoteEditor(note, false, context);
        };
        headerRight.appendChild(editBtn);
    }

    const closeBtn = doc.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = [
        'background:none',
        'border:none',
        'color:#888',
        'font-size:24px',
        'line-height:1',
        'cursor:pointer',
        'padding:0',
        'display:flex',
        'align-items:center',
        'justify-content:center'
    ].join(';');
    closeBtn.onclick = () => overlay.remove();
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = doc.createElement('div');
    body.className = 'vtt-note-content';
    body.style.cssText = [
        'padding:20px 24px',
        'overflow-y:auto',
        'flex:1',
        'font-family:var(--font-primary,Inter)',
        'font-size:14px',
        'line-height:1.65',
        'color:#d0d4de'
    ].join(';');
    body.innerHTML = renderedHtml || '<p style="color:#666;font-style:italic;">This note is empty.</p>';

    // Footer
    const footer = doc.createElement('div');
    footer.style.cssText = [
        'padding:12px 20px',
        'border-top:1px solid rgba(255,255,255,0.06)',
        'background:rgba(0,0,0,0.2)',
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'font-size:12px',
        'color:#666',
        'flex-shrink:0'
    ].join(';');

    const footerStatus = doc.createElement('span');
    if (vtt.role === 'GM') {
        footerStatus.textContent = note.visibleToPlayers ? '👁 Visible to players' : '🔒 GM Only';
        footerStatus.style.color = note.visibleToPlayers ? '#4caf50' : '#888';
    }
    footer.appendChild(footerStatus);

    const closeFooterBtn = doc.createElement('button');
    closeFooterBtn.textContent = 'Close';
    closeFooterBtn.style.cssText = [
        'background:rgba(255,255,255,0.08)',
        'border:1px solid rgba(255,255,255,0.15)',
        'color:#ccc',
        'padding:6px 16px',
        'border-radius:6px',
        'cursor:pointer'
    ].join(';');
    closeFooterBtn.onclick = () => overlay.remove();
    footer.appendChild(closeFooterBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

export function openNoteEditor(note, isNew = false, context = {}) {
    const doc = context.doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || !note) return;

    const existing = doc.getElementById('vtt-note-editor');
    if (existing) existing.remove();

    const overlay = doc.createElement('div');
    overlay.id = 'vtt-note-editor';
    overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(10,12,20,0.75)',
        'backdrop-filter:blur(4px)'
    ].join(';');

    const modal = doc.createElement('div');
    modal.style.cssText = [
        'position:relative',
        'width:min(600px,92vw)',
        'max-height:85vh',
        'background:linear-gradient(135deg,#12161f,#1a1d2b)',
        'border:1px solid rgba(212,175,55,0.35)',
        'border-radius:12px',
        'box-shadow:0 24px 80px rgba(0,0,0,0.7)',
        'display:flex',
        'flex-direction:column',
        'overflow:hidden'
    ].join(';');

    // Header
    const header = doc.createElement('div');
    header.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:16px 20px',
        'border-bottom:1px solid rgba(212,175,55,0.2)',
        'background:rgba(212,175,55,0.06)',
        'flex-shrink:0'
    ].join(';');

    const title = doc.createElement('h2');
    title.style.cssText =
        'margin:0;font-size:16px;font-weight:700;color:#d4af37;font-family:var(--font-primary,Inter);';
    title.textContent = isNew ? '📍 Add Map Note' : `📍 Edit Note: ${note.name || `Area ${note.areaId || ''}`}`;

    const closeBtn = doc.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = [
        'background:none',
        'border:none',
        'color:#888',
        'font-size:24px',
        'line-height:1',
        'cursor:pointer',
        'padding:0'
    ].join(';');
    closeBtn.onclick = () => {
        overlay.remove();
        if (isNew && context.notes) {
            context.notes = context.notes.filter((n) => n.id !== note.id);
            if (context.renderAll) context.renderAll();
        }
    };

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body Form
    const body = doc.createElement('div');
    body.style.cssText = 'padding:20px 24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:14px;';

    // Note Name
    const nameGroup = doc.createElement('div');
    nameGroup.innerHTML = `
        <label style="display:block;font-size:12px;font-weight:600;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Note Title / Label</label>
        <input id="note-edit-name" type="text" value="${note.name ? note.name.replace(/"/g, '&quot;') : ''}" placeholder="e.g. 1. Guard Barracks" style="width:100%;box-sizing:border-box;background:#0d1017;border:1px solid #2d3345;color:#fff;padding:8px 12px;border-radius:6px;font-size:14px;">
    `;
    body.appendChild(nameGroup);

    // Initial content parsing
    let rawContentText = '';
    if (typeof note.content === 'string') {
        rawContentText = note.content;
    } else if (Array.isArray(note.content)) {
        rawContentText = note.content
            .map((entry) => {
                if (typeof entry === 'string') return entry;
                if (entry && entry.entries) return (entry.name ? `**${entry.name}**\n` : '') + entry.entries.join('\n');
                return JSON.stringify(entry);
            })
            .join('\n\n');
    }

    // Note Content
    const contentGroup = doc.createElement('div');
    contentGroup.style.display = 'flex';
    contentGroup.style.flexDirection = 'column';
    contentGroup.style.flex = '1';
    contentGroup.innerHTML = `
        <label style="display:block;font-size:12px;font-weight:600;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Content (Plain text or 5eTools format)</label>
        <textarea id="note-edit-content" rows="9" placeholder="Enter room description, monster details, or trap notes..." style="width:100%;box-sizing:border-box;background:#0d1017;border:1px solid #2d3345;color:#fff;padding:10px 12px;border-radius:6px;font-size:13px;resize:vertical;font-family:var(--font-primary,Inter);line-height:1.5;">${rawContentText.replace(/</g, '&lt;')}</textarea>
    `;
    body.appendChild(contentGroup);

    // Player Visibility Toggle
    const visGroup = doc.createElement('div');
    visGroup.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;';
    const visCheckbox = doc.createElement('input');
    visCheckbox.type = 'checkbox';
    visCheckbox.id = 'note-edit-visible';
    visCheckbox.checked = !!note.visibleToPlayers;
    visCheckbox.style.cursor = 'pointer';

    const visLabel = doc.createElement('label');
    visLabel.htmlFor = 'note-edit-visible';
    visLabel.textContent = '👁 Visible to players (can click and read this note)';
    visLabel.style.cssText = 'font-size:13px;color:#ccc;cursor:pointer;user-select:none;';

    visGroup.appendChild(visCheckbox);
    visGroup.appendChild(visLabel);
    body.appendChild(visGroup);

    // Footer
    const footer = doc.createElement('div');
    footer.style.cssText = [
        'padding:14px 20px',
        'border-top:1px solid rgba(255,255,255,0.06)',
        'background:rgba(0,0,0,0.2)',
        'display:flex',
        'align-items:center',
        'justify-content:flex-end',
        'gap:10px',
        'flex-shrink:0'
    ].join(';');

    const cancelBtn = doc.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = [
        'background:rgba(255,255,255,0.08)',
        'border:1px solid rgba(255,255,255,0.15)',
        'color:#ccc',
        'padding:8px 18px',
        'border-radius:6px',
        'cursor:pointer'
    ].join(';');
    cancelBtn.onclick = () => {
        overlay.remove();
        if (isNew && context.notes) {
            context.notes = context.notes.filter((n) => n.id !== note.id);
            if (context.renderAll) context.renderAll();
        }
    };

    const saveBtn = doc.createElement('button');
    saveBtn.textContent = 'Save Note';
    saveBtn.style.cssText = [
        'background:rgba(212,175,55,0.25)',
        'border:1px solid #d4af37',
        'color:#d4af37',
        'padding:8px 20px',
        'border-radius:6px',
        'font-weight:700',
        'cursor:pointer'
    ].join(';');
    saveBtn.onclick = () => {
        const nameVal = doc.getElementById('note-edit-name')?.value.trim();
        const contentVal = doc.getElementById('note-edit-content')?.value.trim();
        const visibleVal = doc.getElementById('note-edit-visible')?.checked;

        note.name = nameVal || (note.areaId ? `Area ${note.areaId}` : 'Note');
        note.content = [contentVal];
        note.visibleToPlayers = visibleVal;

        overlay.remove();

        const vtt = context.vtt || {};
        if (vtt.socket && context.notes) {
            vtt.socket.emit('notes:update', { mapId: context.currentMapId, notes: context.notes });
        }
        if (context.renderAll) context.renderAll();
        if (isNew) openNoteViewer(note, context);
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);
}

export function closeNoteContextMenu() {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('vtt-note-context-menu');
    if (existing) existing.remove();
    if (typeof window !== 'undefined') {
        window.removeEventListener('click', closeNoteContextMenu);
        window.removeEventListener('contextmenu', closeNoteContextMenu);
    }
}

export function showNoteContextMenu(noteId, clientX, clientY, context = {}) {
    closeNoteContextMenu();
    const notes = context.notes || [];
    const note = notes.find((n) => n.id === noteId);
    if (!note || typeof document === 'undefined') return;

    const menu = document.createElement('div');
    menu.id = 'vtt-note-context-menu';
    menu.style.cssText = `position:fixed; left:${clientX}px; top:${clientY}px; z-index:9999; background:#1e2330; border:1px solid #3a4155; border-radius:6px; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:4px 0; min-width:160px; font-family:var(--font-primary,Inter); font-size:13px; color:#ccc;`;

    const addItem = (text, icon, onClick) => {
        const item = document.createElement('div');
        item.style.cssText =
            'padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s;';
        item.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
        item.onmouseover = () => {
            item.style.background = 'rgba(255,255,255,0.1)';
            item.style.color = '#fff';
        };
        item.onmouseout = () => {
            item.style.background = 'transparent';
            item.style.color = '#ccc';
        };
        item.onmousedown = (e) => {
            e.stopPropagation();
            onClick();
            closeNoteContextMenu();
        };
        menu.appendChild(item);
    };

    const vtt = context.vtt || {};
    addItem('Edit', '✏️', () => openNoteEditor(note, false, context));
    if (note.visibleToPlayers) {
        addItem('Make Private', '✋', () => {
            note.visibleToPlayers = false;
            vtt.socket?.emit('notes:update', { mapId: context.currentMapId, notes });
            context.renderAll?.();
        });
    } else {
        addItem('Share with Players', '👁', () => {
            note.visibleToPlayers = true;
            vtt.socket?.emit('notes:update', { mapId: context.currentMapId, notes });
            context.renderAll?.();
        });
    }
    addItem('Delete', '🗑️', () => {
        if (context.onDeleteNote) {
            context.onDeleteNote(noteId);
        } else if (context.notes) {
            const idx = context.notes.findIndex((n) => n.id === noteId);
            if (idx !== -1) context.notes.splice(idx, 1);
        }
        vtt.socket?.emit('notes:update', { mapId: context.currentMapId, notes: context.notes });
        context.renderAll?.();
    });

    document.body.appendChild(menu);
    if (typeof window !== 'undefined') {
        setTimeout(() => {
            window.addEventListener('click', closeNoteContextMenu);
            window.addEventListener('contextmenu', closeNoteContextMenu);
        }, 10);
    }
}

export function showAddNoteContextMenu(x, y, clientX, clientY, context = {}) {
    closeNoteContextMenu();
    if (typeof document === 'undefined') return;

    const menu = document.createElement('div');
    menu.id = 'vtt-note-context-menu';
    menu.style.cssText = `position:fixed; left:${clientX}px; top:${clientY}px; z-index:9999; background:#1e2330; border:1px solid #3a4155; border-radius:6px; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:4px 0; min-width:160px; font-family:var(--font-primary,Inter); font-size:13px; color:#ccc;`;

    const item = document.createElement('div');
    item.style.cssText =
        'padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s;';
    item.innerHTML = `<span>➕</span> <span>Add Note Here</span>`;
    item.onmouseover = () => {
        item.style.background = 'rgba(255,255,255,0.1)';
        item.style.color = '#fff';
    };
    item.onmouseout = () => {
        item.style.background = 'transparent';
        item.style.color = '#ccc';
    };
    item.onmousedown = (e) => {
        e.stopPropagation();
        closeNoteContextMenu();
        const newNote = {
            id: 'note_' + Date.now() + Math.random().toString(36).substring(2, 7),
            name: '',
            content: '',
            x: x,
            y: y,
            visibleToPlayers: false
        };
        if (context.notes) {
            context.notes.push(newNote);
        }
        openNoteEditor(newNote, true, context);
    };
    menu.appendChild(item);

    document.body.appendChild(menu);
    if (typeof window !== 'undefined') {
        setTimeout(() => {
            window.addEventListener('click', closeNoteContextMenu);
            window.addEventListener('contextmenu', closeNoteContextMenu);
        }, 10);
    }
}

// ── Note Pins Canvas Rendering Pass ──────────────────────────────────────────

export function renderNotePins(ctx, context = {}) {
    if (!ctx) return;
    const vtt = context.vtt || {};
    const isGmViewing = context.isGmViewing ?? vtt.role === 'GM';
    const activeLayer = context.activeLayer || 'token';
    const notes = context.notes || [];

    if (!((isGmViewing && activeLayer === 'notes') || vtt.role !== 'GM')) return;

    const isRectInViewport = context.isRectInViewport || (() => true);
    const hoveredNoteId = context.hoveredNoteId;
    const selectedNoteId = context.selectedNoteId;
    const zoom = (ctx.getTransform ? ctx.getTransform()?.a : 1) || 1;

    notes.forEach((note) => {
        const isPlayer = vtt.role !== 'GM';
        if (isPlayer && !note.visibleToPlayers) return;

        if (!isRectInViewport(note.x - 25, note.y - 25, 50, 50, 200)) return;

        const isHovered = hoveredNoteId === note.id;
        const isSelected = selectedNoteId === note.id;
        const r = isHovered ? (isPlayer ? 15 : 17) : isPlayer ? 12 : 14;

        ctx.save();
        ctx.translate(note.x, note.y);
        ctx.scale(1 / zoom, 1 / zoom);

        // Selection glow ring (GM only)
        if (isSelected && !isPlayer) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.9)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // Pin circle
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);

        if (isPlayer) {
            ctx.fillStyle = isHovered ? '#5c90ff' : 'rgba(60, 120, 255, 0.85)';
        } else {
            ctx.fillStyle = isHovered ? '#d4af37' : 'rgba(212, 175, 55, 0.85)';
        }

        ctx.strokeStyle = '#1a1d27';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Pin icon
        ctx.font = `${r}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('📍', 0, 0);

        // Visibility badge (GM only, if shared)
        if (!isPlayer && note.visibleToPlayers) {
            ctx.font = '10px serif';
            ctx.fillText('👁', r - 2, -r + 2);
        }

        // Name label below pin
        ctx.font = 'bold 11px var(--font-primary, Inter)';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(note.name || (note.areaId ? `Area ${note.areaId}` : 'Note'), 0, r + 4);

        ctx.restore();
    });
}
