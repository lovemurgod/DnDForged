/**
 * vtt-canvas-touch.js
 * Touch gesture drag-and-drop, mobile drag pill hud, and active measurement cancellation.
 */

import { calcPortalCenter } from './vtt-canvas-portals.js';
import { distToSegmentSq } from './vtt-canvas-traps.js';

let lastTouchMeasureEmitTime = 0;

function getLineIntersection(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
    const s1_x = p1_x - p0_x;
    const s1_y = p1_y - p0_y;
    const s2_x = p3_x - p2_x;
    const s2_y = p3_y - p2_y;
    const denom = -s2_x * s1_y + s1_x * s2_y;
    if (denom === 0) return null;
    const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / denom;
    const t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return { x: p0_x + t * s1_x, y: p0_y + t * s1_y, t };
    }
    return null;
}

export function cancelActiveMeasurement(context = {}) {
    let changed = false;
    if (context.localIsMeasuring || context.isTokenMeasuring || context.localIsShaping) {
        context.localIsMeasuring = false;
        context.isTokenMeasuring = false;
        context.localIsShaping = false;
        context.localMeasureStart = null;
        context.localMeasureEnd = null;
        context.localShapeStart = null;
        context.localShapeEnd = null;
        context.measureAnchorPoints = [];
        if (context.vtt?.socket) {
            context.vtt.socket.emit('measure:clear', { mapId: context.currentMapId, username: context.vtt.username });
        }
        changed = true;
    }
    const dragPill = typeof document !== 'undefined' ? document.getElementById('vtt-mobile-drag-pill') : null;
    if (dragPill && !dragPill.classList.contains('vtt-hidden')) {
        dragPill.classList.add('vtt-hidden');
        changed = true;
    }
    if (changed) context.renderAll?.();
}

export function cancelTokenDrag(context = {}) {
    let hadMoved = false;
    if (context.tokenDragOriginalPositions && Object.keys(context.tokenDragOriginalPositions).length > 0) {
        Object.entries(context.tokenDragOriginalPositions).forEach(([id, orig]) => {
            const tok = context.tokens?.[id];
            if (tok && orig) {
                if (tok.x !== orig.x || tok.y !== orig.y) hadMoved = true;
                tok.x = orig.x;
                tok.y = orig.y;
            }
        });
    } else if (context.dragTargetId) {
        const originalPos = context.tokenDragOriginalPositions?.[context.dragTargetId];
        const targetToken = context.tokens?.[context.dragTargetId];
        if (originalPos && targetToken) {
            if (targetToken.x !== originalPos.x || targetToken.y !== originalPos.y) hadMoved = true;
            targetToken.x = originalPos.x;
            targetToken.y = originalPos.y;
        }
    }
    if (hadMoved) context.emitTokenUpdates?.(context.tokens);
    context.dragTargetId = null;
    context.tokenDragOriginalPositions = {};
    const dragPill = typeof document !== 'undefined' ? document.getElementById('vtt-mobile-drag-pill') : null;
    if (dragPill) dragPill.classList.add('vtt-hidden');
    cancelActiveMeasurement(context);
    context.renderAll?.();
}

export function startTouchTokenDrag(tokenId, clientX, clientY, context = {}) {
    const t = context.tokens?.[tokenId];
    if (!t || !context.isTokenControlledByPlayer?.(t)) return false;

    context.dragTargetId = tokenId;
    const mouse = context.getCanvasMouseCoords?.({ clientX, clientY }) || { x: 0, y: 0 };
    context.dragOffsetX = mouse.x - t.x;
    context.dragOffsetY = mouse.y - t.y;

    context.hideGmTokenTooltip?.();

    if (!context.selectedTokenIds.has(tokenId)) {
        context.selectedTokenIds.clear();
        context.selectedTokenIds.add(tokenId);
    }
    context.selectedTokenId = tokenId;

    context.tokenDragOriginalPositions = {};
    context.selectedTokenIds.forEach((id) => {
        const selected = context.tokens?.[id];
        if (selected) {
            context.tokenDragOriginalPositions[id] = { x: selected.x, y: selected.y };
        }
    });

    context.isTokenMeasuring = true;
    context.localIsMeasuring = true;
    const { drawW, drawH } = context.getTokenDrawDimensions?.(t) || { drawW: 50, drawH: 50 };
    context.localMeasureStart = { x: t.x + drawW / 2, y: t.y + drawH / 2 };
    context.localMeasureEnd = context.localMeasureStart;
    context.measureAnchorPoints = [context.localMeasureStart];

    context.renderAll?.();
    return true;
}

export function moveTouchTokenDrag(clientX, clientY, context = {}) {
    if (!context.dragTargetId) return;
    const t = context.tokens?.[context.dragTargetId];
    if (!t) return;

    const mouse = context.getCanvasMouseCoords?.({ clientX, clientY }) || { x: 0, y: 0 };
    let nx = mouse.x - (context.dragOffsetX || 0);
    let ny = mouse.y - (context.dragOffsetY || 0);

    if (context.grid && context.snapToGrid) {
        const snapped = context.snapToGrid(nx, ny, true);
        nx = snapped.x;
        ny = snapped.y;
    }

    const sourceOriginal = context.tokenDragOriginalPositions?.[context.dragTargetId] || { x: t.x, y: t.y };
    const currentMap = context.vtt?.campaignState?.maps?.[context.currentMapId];
    if (context.vtt?.role !== 'GM' && currentMap?.lightingSettings?.restrictMovement) {
        const { drawW, drawH } = context.getTokenDrawDimensions?.(t) || { drawW: 50, drawH: 50 };
        const radius = Math.min(drawW, drawH) / 2;
        const startCenter = { x: sourceOriginal.x + drawW / 2, y: sourceOriginal.y + drawH / 2 };
        const endCenter = { x: nx + drawW / 2, y: ny + drawH / 2 };

        let closestT = 1.0;
        let collisionPoint = null;

        const walls = context.wallSpatialIndex?.tree
            ? context.wallSpatialIndex.tree.queryRange({
                  minX: Math.min(startCenter.x, endCenter.x) - radius - 15,
                  minY: Math.min(startCenter.y, endCenter.y) - radius - 15,
                  maxX: Math.max(startCenter.x, endCenter.x) + radius + 15,
                  maxY: Math.max(startCenter.y, endCenter.y) + radius + 15
              })
            : context.walls || [];
        const portals = context.portals || [];
        walls.forEach((wall) => {
            if (wall.isOpen) return;
            if (
                Array.isArray(portals) &&
                portals.some((po) => {
                    if (!po.walkThrough) return false;
                    const pRad =
                        po.shape === 'circle' && po.geom?.r
                            ? po.geom.r
                            : po.shape === 'rect' && po.geom
                              ? Math.max(po.geom.w, po.geom.h) / 2
                              : 45;
                    const threshSq = Math.max(pRad * pRad * 1.5, 55 * 55);
                    return (
                        distToSegmentSq(
                            calcPortalCenter(po),
                            { x: wall.x1, y: wall.y1 },
                            { x: wall.x2, y: wall.y2 }
                        ) <= threshSq
                    );
                })
            )
                return;
            const intersect = getLineIntersection(
                startCenter.x,
                startCenter.y,
                endCenter.x,
                endCenter.y,
                wall.x1,
                wall.y1,
                wall.x2,
                wall.y2
            );
            if (intersect && intersect.t < closestT) {
                closestT = intersect.t;
                collisionPoint = intersect;
            }
        });

        if (collisionPoint) {
            const dx = endCenter.x - startCenter.x;
            const dy = endCenter.y - startCenter.y;
            const length = Math.hypot(dx, dy);
            if (length > 0) {
                const backupT = Math.max(0, collisionPoint.t - (radius - 2) / length);
                nx = startCenter.x + dx * backupT - drawW / 2;
                ny = startCenter.y + dy * backupT - drawH / 2;
            }
        }
    }

    const deltaX = nx - sourceOriginal.x;
    const deltaY = ny - sourceOriginal.y;

    if (context.selectedTokenIds?.has(context.dragTargetId) && context.selectedTokenIds.size > 1) {
        context.selectedTokenIds.forEach((id) => {
            const original = context.tokenDragOriginalPositions?.[id];
            if (!original || !context.tokens?.[id]) return;
            if (!context.isTokenControlledByPlayer?.(context.tokens[id])) return;
            context.tokens[id].x = original.x + deltaX;
            context.tokens[id].y = original.y + deltaY;
        });
    } else {
        if (context.isTokenControlledByPlayer?.(t)) {
            t.x = nx;
            t.y = ny;
        }
    }

    if (context.localIsMeasuring && context.isTokenMeasuring) {
        const { drawW, drawH } = context.getTokenDrawDimensions?.(t) || { drawW: 50, drawH: 50 };
        const tokenCenter = { x: t.x + drawW / 2, y: t.y + drawH / 2 };
        context.localMeasureEnd = tokenCenter;
        const color =
            (typeof document !== 'undefined' ? document.getElementById('measure-color')?.value : null) || '#00ffff';
        const anchor =
            (typeof document !== 'undefined' ? document.getElementById('measure-square-anchor')?.value : null) ||
            'center';
        const beamW = parseFloat(
            (typeof document !== 'undefined' ? document.getElementById('measure-beam-width')?.value : null) || 5
        );
        const points =
            context.measureAnchorPoints?.length > 0 ? [...context.measureAnchorPoints, context.localMeasureEnd] : null;
        const broadcast =
            (typeof document !== 'undefined' ? document.getElementById('measure-broadcast')?.checked : true) ?? true;

        if (broadcast && context.vtt?.socket) {
            const now = Date.now();
            if (now - lastTouchMeasureEmitTime >= 50) {
                lastTouchMeasureEmitTime = now;
                context.vtt.socket.emit('measure:update', {
                    mapId: context.currentMapId,
                    username: context.vtt.username,
                    start: context.localMeasureStart,
                    end: context.localMeasureEnd,
                    shape: 'line',
                    color,
                    squareAnchor: anchor,
                    beamWidth: beamW,
                    points
                });
            }
        }

        const distInfo = context.calcDistanceFormatted?.(
            Math.hypot(
                context.localMeasureEnd.x - context.localMeasureStart.x,
                context.localMeasureEnd.y - context.localMeasureStart.y
            )
        ) || { label: '0 ft' };
        const dragPill = typeof document !== 'undefined' ? document.getElementById('vtt-mobile-drag-pill') : null;
        if (dragPill) {
            const distSpan = document.getElementById('vtt-mobile-drag-dist');
            if (distSpan) distSpan.textContent = distInfo.label;
            dragPill.style.left = `${clientX || 0}px`;
            dragPill.style.top = `${(clientY || 0) - 20}px`;
            dragPill.classList.remove('vtt-hidden');
        }
    }
    context.renderAll?.();
}

export function endTouchTokenDrag(clientX, clientY, context = {}) {
    if (!context.dragTargetId) return;
    const movedTokensList = Array.from(context.selectedTokenIds || [])
        .map((id) => context.tokens?.[id])
        .filter(Boolean);
    if (!movedTokensList.some((t) => t.id === context.dragTargetId) && context.tokens?.[context.dragTargetId]) {
        movedTokensList.push(context.tokens[context.dragTargetId]);
    }

    let didMove = false;
    movedTokensList.forEach((t) => {
        const originalPos = context.tokenDragOriginalPositions?.[t.id] || { x: t.x, y: t.y };
        if (originalPos.x !== t.x || originalPos.y !== t.y) {
            didMove = true;
            const triggerRes = context.checkTokenMoveTriggers?.(t, originalPos);
            if (triggerRes?.action === 'teleport' || triggerRes?.action === 'trap') {
                delete t._animReq;
                if (context.tokenAnimations?.[t.id]) delete context.tokenAnimations[t.id];
                if (triggerRes?.action === 'teleport' && context.tokens?.[t.id]) {
                    context.selectedTokenIds?.clear();
                    context.selectedTokenIds?.add(t.id);
                    context.selectedTokenId = t.id;
                }
            } else {
                const leadOrig =
                    (context.dragTargetId && context.tokenDragOriginalPositions?.[context.dragTargetId]) || originalPos;
                const offX = originalPos.x - leadOrig.x;
                const offY = originalPos.y - leadOrig.y;
                const baseWaypoints = context.isTokenMeasuring ? context.measureAnchorPoints?.slice(1) || [] : [];
                const tokenWaypoints =
                    t.id === context.dragTargetId || (offX === 0 && offY === 0)
                        ? baseWaypoints
                        : baseWaypoints.map((wp) => ({ x: wp.x + offX, y: wp.y + offY }));

                t._animReq = {
                    startX: originalPos.x,
                    startY: originalPos.y,
                    endX: t.x,
                    endY: t.y,
                    waypoints: tokenWaypoints,
                    timestamp: Date.now(),
                    duration: 500
                };
            }
        }
    });
    if (didMove) {
        context.emitTokenUpdates?.(context.tokens);
        context.processTokenAnimReqs?.(context.tokens);
    }
    context.dragTargetId = null;
    context.tokenDragOriginalPositions = {};
    const dragPill = typeof document !== 'undefined' ? document.getElementById('vtt-mobile-drag-pill') : null;
    if (dragPill) dragPill.classList.add('vtt-hidden');
    if (context.isTokenMeasuring) {
        context.isTokenMeasuring = false;
        context.localIsMeasuring = false;
        context.measureAnchorPoints = [];
        if (context.vtt?.socket) {
            context.vtt.socket.emit('measure:clear', { mapId: context.currentMapId, username: context.vtt.username });
        }
        context.localMeasureStart = null;
        context.localMeasureEnd = null;
    }
    context.renderAll?.();
}
