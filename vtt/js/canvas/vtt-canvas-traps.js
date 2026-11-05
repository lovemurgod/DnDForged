// DnDForged Canvas Traps & Geometric Intersection Subsystem
// Manages trap collision detection, trigger evaluation, saving throws, and rendering

import { escapeHtml } from '../vtt-utils.js';

export function isPointInPoly(pt, poly) {
    if (!Array.isArray(poly) || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x,
            yi = poly[i].y;
        const xj = poly[j].x,
            yj = poly[j].y;
        const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

export function distToSegmentSq(p, v, w) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
}

export function checkLineIntersection(p1, p2, p3, p4) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom === 0) return null;
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return {
            x: p1.x + ua * (p2.x - p1.x),
            y: p1.y + ua * (p2.y - p1.y),
            t: ua
        };
    }
    return null;
}

export function checkLineCircleIntersection(p1, p2, center, radius) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - center.x;
    const fy = p1.y - center.y;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;
    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);
    let t = null;
    if (t1 >= 0 && t1 <= 1) t = t1;
    else if (t2 >= 0 && t2 <= 1) t = t2;
    if (t !== null) {
        return {
            x: p1.x + t * dx,
            y: p1.y + t * dy,
            t: t
        };
    }
    return null;
}

export function isPointInsideGeometry(pt, shape, geom) {
    if (!pt || !geom) return false;
    if (shape === 'rect') {
        const minX = Math.min(geom.x, geom.x + geom.w);
        const maxX = Math.max(geom.x, geom.x + geom.w);
        const minY = Math.min(geom.y, geom.y + geom.h);
        const maxY = Math.max(geom.y, geom.y + geom.h);
        return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
    } else if (shape === 'circle') {
        const r = geom.r !== undefined ? geom.r : Math.hypot(geom.endX - geom.cx, geom.endY - geom.cy);
        return Math.hypot(pt.x - geom.cx, pt.y - geom.cy) <= r;
    } else if (shape === 'line') {
        const p1 = { x: geom.x1, y: geom.y1 };
        const p2 = { x: geom.x2, y: geom.y2 };
        return distToSegmentSq(pt, p1, p2) <= 16;
    } else if (shape === 'polygon') {
        return isPointInPoly(pt, geom.points || []);
    }
    return false;
}

export function findEarliestPathIntersection(p1, p2, shape, geom) {
    if (!geom) return null;
    if (shape === 'rect') {
        const x1 = Math.min(geom.x, geom.x + geom.w);
        const x2 = Math.max(geom.x, geom.x + geom.w);
        const y1 = Math.min(geom.y, geom.y + geom.h);
        const y2 = Math.max(geom.y, geom.y + geom.h);
        const edges = [
            [
                { x: x1, y: y1 },
                { x: x2, y: y1 }
            ],
            [
                { x: x2, y: y1 },
                { x: x2, y: y2 }
            ],
            [
                { x: x2, y: y2 },
                { x: x1, y: y2 }
            ],
            [
                { x: x1, y: y2 },
                { x: x1, y: y1 }
            ]
        ];
        let best = null;
        edges.forEach(([a, b]) => {
            const hit = checkLineIntersection(p1, p2, a, b);
            if (hit && (!best || hit.t < best.t)) best = hit;
        });
        if (best) return best;
        if (isPointInsideGeometry(p2, shape, geom)) {
            return { x: p2.x, y: p2.y, t: 1 };
        }
        return null;
    } else if (shape === 'circle') {
        const r = geom.r !== undefined ? geom.r : Math.hypot(geom.endX - geom.cx, geom.endY - geom.cy);
        const hit = checkLineCircleIntersection(p1, p2, { x: geom.cx, y: geom.cy }, r);
        if (hit) return hit;
        if (isPointInsideGeometry(p2, shape, geom)) {
            return { x: p2.x, y: p2.y, t: 1 };
        }
        return null;
    } else if (shape === 'line') {
        const a = { x: geom.x1, y: geom.y1 };
        const b = { x: geom.x2, y: geom.y2 };
        const hit = checkLineIntersection(p1, p2, a, b);
        if (hit) return hit;
        return null;
    } else if (shape === 'polygon') {
        const pts = geom.points || [];
        if (pts.length < 2) return null;
        let best = null;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const hit = checkLineIntersection(p1, p2, a, b);
            if (hit && (!best || hit.t < best.t)) best = hit;
        }
        if (best) return best;
        if (isPointInsideGeometry(p2, shape, geom)) {
            return { x: p2.x, y: p2.y, t: 1 };
        }
        return null;
    }
    return null;
}

export function calcGeometryCenter(shape, geom) {
    if (!geom) return { x: 0, y: 0 };
    if (shape === 'rect') {
        return { x: geom.x + geom.w / 2, y: geom.y + geom.h / 2 };
    } else if (shape === 'circle') {
        return { x: geom.cx, y: geom.cy };
    } else if (shape === 'line') {
        return { x: (geom.x1 + geom.x2) / 2, y: (geom.y1 + geom.y2) / 2 };
    } else if (shape === 'polygon') {
        const pts = geom.points || [];
        if (pts.length === 0) return { x: 0, y: 0 };
        let sx = 0,
            sy = 0;
        pts.forEach((p) => {
            sx += p.x;
            sy += p.y;
        });
        return { x: sx / pts.length, y: sy / pts.length };
    }
    return { x: 0, y: 0 };
}

export function renderTraps(ctx, traps, isGM, zoom = 1) {
    if (!Array.isArray(traps) || traps.length === 0) return;

    traps.forEach((trap) => {
        if (!isGM && !trap.isRevealed) return;

        ctx.save();
        const isSpent = trap.isSpent && !trap.repeatTrigger;
        const strokeColor = isSpent ? 'rgba(239, 68, 68, 0.4)' : '#ef4444';
        const fillColor = isSpent ? 'rgba(100, 116, 139, 0.15)' : 'rgba(239, 68, 68, 0.18)';

        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = fillColor;
        ctx.lineWidth = 2.5 / zoom;
        ctx.setLineDash([8 / zoom, 5 / zoom]);

        const g = trap.geom;
        if (!g) {
            ctx.restore();
            return;
        }

        ctx.beginPath();
        if (trap.shape === 'rect') {
            ctx.rect(g.x, g.y, g.w, g.h);
        } else if (trap.shape === 'circle') {
            ctx.arc(g.cx, g.cy, g.r !== undefined ? g.r : 20, 0, Math.PI * 2);
        } else if (trap.shape === 'line') {
            ctx.moveTo(g.x1, g.y1);
            ctx.lineTo(g.x2, g.y2);
        } else if (trap.shape === 'polygon' && g.points && g.points.length >= 2) {
            ctx.moveTo(g.points[0].x, g.points[0].y);
            for (let i = 1; i < g.points.length; i++) {
                ctx.lineTo(g.points[i].x, g.points[i].y);
            }
            ctx.closePath();
        }

        if (trap.shape !== 'line') ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Center Badge
        const center = calcGeometryCenter(trap.shape, g);

        // Draw status icon / label
        ctx.fillStyle = isSpent ? '#94a3b8' : '#fee2e2';
        ctx.font = `bold ${Math.max(10, 13 / zoom)}px "Open Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = isSpent ? '⚡ [Sprung]' : `⚠️ ${trap.name || 'Trap'}`;
        ctx.fillText(label, center.x, center.y);

        ctx.restore();
    });
}

export function rollTrapSave(trapId, tokenId, ability, dc, options = {}) {
    if (!ability || ability === 'NONE') return;
    const { tokens = {}, vtt = {}, rollFn = null } = options;
    const t = tokens[tokenId];
    const ab = ability.toLowerCase();
    let charName = t?.name || 'Creature';
    let totalMod = 0;
    let toggleFormulaStr = '';

    if (t && t.characterId && vtt.campaignState?.characters?.[t.characterId]) {
        const char = vtt.campaignState.characters[t.characterId];
        charName = char.name || charName;
        const score =
            (char.stats && char.stats[ab]) ||
            (char.abilities && (char.abilities[ab]?.score || char.abilities[ab])) ||
            10;
        const statMod = (char.statMods && char.statMods[ab]) || 0;
        const baseMod = Math.floor((score + statMod - 10) / 2);
        const isProf = char.saves ? !!char.saves[ab] : char.abilities?.[ab]?.saveProf || false;
        const level = char.level || 1;
        const pb = Math.floor((level - 1) / 4) + 2;
        const globalMod = char.globalSaveMod || 0;
        const customMod = (char.saveMods && char.saveMods[ab]) || 0;

        if (char.saveToggles) {
            char.saveToggles
                .filter((tg) => tg.enabled)
                .forEach((tg) => {
                    if (tg.target === 'all' || tg.target === ab) {
                        if (tg.formula.startsWith('+') || tg.formula.startsWith('-')) {
                            toggleFormulaStr += tg.formula;
                        } else {
                            toggleFormulaStr += '+' + tg.formula;
                        }
                    }
                });
        }

        totalMod = baseMod + (isProf ? pb : 0) + globalMod + customMod;
    } else if (t) {
        const score = t.abilities?.[ab]?.score || t.abilities?.[ab] || 10;
        totalMod = Math.floor((score - 10) / 2);
    }

    const modStr = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
    const formula = `1d20${modStr}${toggleFormulaStr}`;
    const effectiveRollFn =
        rollFn ||
        window?.vttPlayerSheetAPI?.simulateRoll ||
        (typeof window !== 'undefined' && typeof window.simulateRoll === 'function' ? window.simulateRoll : null);
    const rollData = effectiveRollFn ? effectiveRollFn(formula) : null;
    const finalRoll = rollData || { formula, total: Math.floor(Math.random() * 20) + 1 + totalMod };

    if (typeof window !== 'undefined') {
        window.VTT = window.VTT || {};
        window.VTT._lastTrapSaves = window.VTT._lastTrapSaves || {};
        window.VTT._lastTrapSaves[`${trapId}_${tokenId}`] = {
            total: finalRoll.total,
            dc: parseInt(dc) || 15,
            passed: finalRoll.total >= (parseInt(dc) || 15)
        };
    }

    if (vtt.socket) {
        vtt.socket.emit('chat:msg', {
            text: `[${charName}: ${ability.toUpperCase()} Save] rolls **Saving Throw**`,
            roll: finalRoll,
            trapSaveResult: {
                trapId,
                tokenId,
                total: finalRoll.total,
                dc: parseInt(dc) || 15,
                passed: finalRoll.total >= (parseInt(dc) || 15)
            }
        });
    }
}

export function triggerTrapSpringFX(data) {
    // Quiet presentation per user choice: no camera shake
}

export function postTrapTriggerChatCard(data) {
    // Chat cards are now handled officially via server broadcast into the persistent chat feed
}

export function renderPlacedTrapsList(traps, selectedMapToolItem, callbacks = {}) {
    const { onSelect, onPanTo, onUpdate, onDeselect, renderAll, zoom = 1, currentMapId = null, vtt = {} } = callbacks;
    const countEl = document.getElementById('maptools-traps-count');
    const listEl = document.getElementById('maptools-traps-list');
    if (countEl) countEl.textContent = traps.length;
    if (!listEl) return;

    if (traps.length === 0) {
        listEl.innerHTML =
            '<div class="maptools-empty-note">No traps placed on this map. Click & drag on the canvas to place one.</div>';
        return;
    }

    listEl.innerHTML = '';
    traps.forEach((trap, idx) => {
        const isSelected =
            selectedMapToolItem && selectedMapToolItem.type === 'trap' && selectedMapToolItem.id === trap.id;
        const isSpent = trap.isSpent && !trap.repeatTrigger;
        const isDisarmed = !!trap.isDisarmed;
        const card = document.createElement('div');
        card.className = `maptools-item-card ${isSpent || isDisarmed ? 'is-spent' : ''} ${isSelected ? 'is-selected' : ''}`;
        const safeName = escapeHtml(trap.name || 'Trap');
        const safeShape = escapeHtml(String(trap.shape || '').toUpperCase());
        const safeDc = escapeHtml(trap.saveDc ?? '');
        const safeAbility = escapeHtml(trap.saveAbility ?? '');
        const safeDamage = escapeHtml(trap.damage ?? '');
        const safeId = escapeHtml(trap.id ?? '');

        let statusBadge = '';
        if (isDisarmed) {
            statusBadge = '<span style="color:#38bdf8; font-weight:600; margin-left:4px;">[Disarmed]</span>';
        } else if (isSpent) {
            statusBadge = '<span style="color:#f87171; font-weight:600; margin-left:4px;">[Sprung]</span>';
        }

        const iconColor = isDisarmed ? '#38bdf8' : isSpent ? '#94a3b8' : '#ef4444';
        const iconClass = isDisarmed ? 'fa-shield-halved' : isSpent ? 'fa-bolt-lightning text-muted' : 'fa-triangle-exclamation';

        card.innerHTML = `
            <div class="maptools-item-info">
                <div class="maptools-item-name">
                    <i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i>
                    <span>${safeName}</span>
                </div>
                <div class="maptools-item-meta">
                    ${safeShape} | DC ${safeDc} ${safeAbility} | ${safeDamage}
                    ${statusBadge}
                </div>
            </div>
            <div class="maptools-item-actions">
                <button type="button" class="maptools-action-btn btn-edit ${isSelected ? 'active' : ''}" title="Select & Edit Trap" data-id="${safeId}">
                    <i class="fa-solid fa-pen"></i>
                </button>
                ${
                    isSpent || isDisarmed || trap.isRevealed
                        ? `
                    <button type="button" class="maptools-action-btn btn-rearm" title="Reset & Re-arm Trap (Hide & Re-arm)" data-idx="${idx}">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                `
                        : `
                    <button type="button" class="maptools-action-btn btn-disarm" title="Safely Disarm Trap" data-idx="${idx}">
                        <i class="fa-solid fa-shield-halved"></i>
                    </button>
                `
                }
                <button type="button" class="maptools-action-btn btn-focus" title="Center View on Trap" data-idx="${idx}">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="maptools-action-btn btn-delete" title="Delete Trap" data-id="${safeId}" data-idx="${idx}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        card.querySelector('.maptools-item-info')?.addEventListener('click', () => {
            if (onSelect) onSelect('trap', trap.id);
        });

        card.querySelector('.btn-edit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onSelect) onSelect('trap', trap.id);
        });

        card.querySelector('.btn-focus')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const center = calcGeometryCenter(trap.shape, trap.geom);
            if (onPanTo) onPanTo(center.x, center.y, zoom, 300);
        });

        card.querySelector('.btn-rearm')?.addEventListener('click', (e) => {
            e.stopPropagation();
            trap.isSpent = false;
            trap.isRevealed = false;
            trap.isDisarmed = false;
            if (vtt.socket) vtt.socket.emit('traps:update', { mapId: currentMapId, traps });
            if (onUpdate) onUpdate();
            if (renderAll) renderAll();
        });

        card.querySelector('.btn-disarm')?.addEventListener('click', (e) => {
            e.stopPropagation();
            trap.isSpent = true;
            trap.isRevealed = true;
            trap.isDisarmed = true;
            if (vtt.socket) vtt.socket.emit('traps:update', { mapId: currentMapId, traps });
            if (onUpdate) onUpdate();
            if (renderAll) renderAll();
        });

        card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const [deleted] = traps.splice(idx, 1);
            if (callbacks.mapToolUndoStack && deleted) {
                callbacks.mapToolUndoStack.push({ action: 'delete', type: 'trap', item: JSON.parse(JSON.stringify(deleted)) });
                if (callbacks.mapToolRedoStack) callbacks.mapToolRedoStack.length = 0;
            }
            if (vtt.campaignState?.maps?.[currentMapId]) {
                vtt.campaignState.maps[currentMapId].traps = traps;
            }
            if (vtt.socket) vtt.socket.emit('traps:update', { mapId: currentMapId, traps });
            if (selectedMapToolItem && selectedMapToolItem.type === 'trap' && selectedMapToolItem.id === trap.id) {
                if (onDeselect) onDeselect();
            } else {
                if (onUpdate) onUpdate();
                if (renderAll) renderAll();
            }
        });

        listEl.appendChild(card);
    });
}

export function showTrapContextMenu(trapId, clientX, clientY, context = {}) {
    if (typeof document === 'undefined') return;
    const oldMenu = document.getElementById('vtt-token-context-menu');
    if (oldMenu) oldMenu.remove();

    const traps = context.traps || [];
    const trap = traps.find((t) => t.id === trapId);
    const role = context.role || 'GM';
    if (!trap || role !== 'GM') return;

    const menu = document.createElement('div');
    menu.id = 'vtt-token-context-menu';
    menu.className = 'vtt-token-context-menu';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    const isSpent = trap.isSpent && !trap.repeatTrigger;
    const isDisarmed = !!trap.isDisarmed;

    const html = `
        <div class="vtt-token-menu-header">
            <i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(trap.name || 'Trap')}
        </div>
        ${
            isSpent || isDisarmed || trap.isRevealed
                ? `
            <div class="vtt-token-menu-item" id="menu-trap-rearm">
                <span><i class="fa-solid fa-arrows-rotate item-icon"></i> Reset & Re-arm Trap</span>
            </div>
        `
                : `
            <div class="vtt-token-menu-item" id="menu-trap-disarm">
                <span><i class="fa-solid fa-shield-halved item-icon"></i> Disarm Trap</span>
            </div>
        `
        }
        <div class="vtt-token-menu-item" id="menu-trap-edit">
            <span><i class="fa-solid fa-pen-to-square item-icon"></i> Edit Trap</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item text-danger" id="menu-trap-delete" style="color: var(--color-danger);">
            <span><i class="fa-solid fa-trash item-icon"></i> Delete Trap</span>
        </div>
    `;

    menu.innerHTML = html;
    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    if (clientX + menuRect.width > window.innerWidth) menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    if (clientY + menuRect.height > window.innerHeight)
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;

    function syncTraps() {
        if (context.campaignState?.maps?.[context.currentMapId]) {
            context.campaignState.maps[context.currentMapId].traps = traps;
        }
        if (context.socket) context.socket.emit('traps:update', { mapId: context.currentMapId, traps });
        if (context.renderPlacedTrapsList) context.renderPlacedTrapsList();
        if (context.renderAll) context.renderAll();
    }

    const closeMenu = (e) => {
        if (!e || !menu.contains(e.target)) {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('contextmenu', closeMenu);
            window.removeEventListener('pointerdown', closeMenu);
            if (menu.parentNode) menu.remove();
        }
    };
    setTimeout(() => {
        window.addEventListener('click', closeMenu);
        window.addEventListener('contextmenu', closeMenu);
        window.addEventListener('pointerdown', closeMenu);
    }, 50);

    menu.querySelector('#menu-trap-rearm')?.addEventListener('click', () => {
        trap.isSpent = false;
        trap.isRevealed = false;
        trap.isDisarmed = false;
        syncTraps();
        closeMenu();
    });

    menu.querySelector('#menu-trap-disarm')?.addEventListener('click', () => {
        trap.isSpent = true;
        trap.isRevealed = true;
        trap.isDisarmed = true;
        syncTraps();
        closeMenu();
    });

    menu.querySelector('#menu-trap-edit')?.addEventListener('click', () => {
        if (context.selectMapToolItem) context.selectMapToolItem('trap', trapId);
        closeMenu();
    });

    menu.querySelector('#menu-trap-delete')?.addEventListener('click', () => {
        if (context.deleteSelectedMapToolItem) {
            context.deleteSelectedMapToolItem('trap', trapId);
        } else {
            const idx = traps.findIndex((t) => t.id === trapId);
            if (idx !== -1) {
                const [deleted] = traps.splice(idx, 1);
                if (context.mapToolUndoStack && deleted) {
                    context.mapToolUndoStack.push({ action: 'delete', type: 'trap', item: JSON.parse(JSON.stringify(deleted)) });
                    if (context.mapToolRedoStack) context.mapToolRedoStack.length = 0;
                }
                syncTraps();
            }
        }
        closeMenu();
    });
}
