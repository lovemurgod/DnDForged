// DnDForged Canvas Drawings & Annotations Subsystem
// Handles freehand brush, shapes, text, eraser (destination-out), bounding boxes, resize handles, and flood-fill

export function isDrawingControlledByPlayer(drawing, userRole, username) {
    if (!drawing) return false;
    if (userRole === 'GM') return true;
    if (drawing.ownerUsername && drawing.ownerUsername === username) return true;
    return false;
}

export function getDrawingBoundingBox(d, ctxInteraction = null) {
    if (!d) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (d.type === 'pencil' || d.type === 'brush' || d.type === 'eraser' || d.type === 'polygon') {
        const pts = Array.isArray(d.points) ? d.points : [];
        if (pts.length === 0) return null;
        pts.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        const pad = Math.max(4, (d.strokeWidth || 4) / 2);
        return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad, w: Math.max(1, (maxX - minX) + pad * 2), h: Math.max(1, (maxY - minY) + pad * 2) };
    } else if (d.type === 'line' || d.type === 'arrow' || d.type === 'rect' || d.type === 'circle') {
        const p1 = d.startPoint || { x: 0, y: 0 };
        const p2 = d.endPoint || { x: 0, y: 0 };
        minX = Math.min(p1.x, p2.x);
        maxX = Math.max(p1.x, p2.x);
        minY = Math.min(p1.y, p2.y);
        maxY = Math.max(p1.y, p2.y);
        const pad = Math.max(4, (d.strokeWidth || 4) / 2);
        return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad, w: Math.max(1, (maxX - minX) + pad * 2), h: Math.max(1, (maxY - minY) + pad * 2) };
    } else if (d.type === 'fill') {
        return { minX: d.x, minY: d.y, maxX: d.x + (d.width || 0), maxY: d.y + (d.height || 0), w: Math.max(1, d.width || 0), h: Math.max(1, d.height || 0) };
    } else if (d.type === 'text') {
        const fs = d.fontSize || 16;
        const lines = (d.text || '').split('\n');
        let maxLineW = 30;
        if (ctxInteraction) {
            ctxInteraction.save();
            ctxInteraction.font = `${fs}px ${d.fontFamily || 'Open Sans, sans-serif'}`;
            lines.forEach(l => {
                const w = ctxInteraction.measureText(l).width;
                if (w > maxLineW) maxLineW = w;
            });
            ctxInteraction.restore();
        } else {
            maxLineW = Math.max(...lines.map(l => l.length * fs * 0.6), 30);
        }
        const totalH = lines.length * (fs * 1.25);
        return { minX: d.x, minY: d.y - fs, maxX: d.x + maxLineW, maxY: d.y - fs + totalH, w: maxLineW, h: totalH };
    }
    return null;
}

export function getDrawingResizeHandles(d, ctxInteraction = null) {
    const bbox = getDrawingBoundingBox(d, ctxInteraction);
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) return {};
    const { minX, minY, maxX, maxY, w, h } = bbox;
    const midX = minX + w / 2;
    const midY = minY + h / 2;
    return {
        nw: { x: minX, y: minY },
        n:  { x: midX, y: minY },
        ne: { x: maxX, y: minY },
        e:  { x: maxX, y: midY },
        se: { x: maxX, y: maxY },
        s:  { x: midX, y: maxY },
        sw: { x: minX, y: maxY },
        w:  { x: minX, y: midY }
    };
}

export function getDrawingResizeHandleAtPoint(d, pt, zoom = 1.0, ctxInteraction = null) {
    if (!d) return null;
    const handles = getDrawingResizeHandles(d, ctxInteraction);
    const threshold = 9 / Math.max(0.01, zoom);
    for (const [key, pos] of Object.entries(handles)) {
        if (Math.hypot(pt.x - pos.x, pt.y - pos.y) <= threshold) {
            return key;
        }
    }
    return null;
}

export function applyDrawingResize(d, origBbox, handle, mouse, origState) {
    if (!origBbox || !origState) return;
    let minX = origBbox.minX;
    let minY = origBbox.minY;
    let maxX = origBbox.maxX;
    let maxY = origBbox.maxY;

    if (handle.includes('w')) minX = Math.min(mouse.x, origBbox.maxX - 10);
    if (handle.includes('e')) maxX = Math.max(mouse.x, origBbox.minX + 10);
    if (handle.includes('n')) minY = Math.min(mouse.y, origBbox.maxY - 10);
    if (handle.includes('s')) maxY = Math.max(mouse.y, origBbox.minY + 10);

    const newW = Math.max(10, maxX - minX);
    const newH = Math.max(10, maxY - minY);
    const scaleX = newW / Math.max(1, origBbox.w);
    const scaleY = newH / Math.max(1, origBbox.h);

    if (origState.type === 'pencil' || origState.type === 'brush' || origState.type === 'polygon') {
        if (origState.points) {
            d.points = origState.points.map(p => ({
                x: minX + (p.x - origBbox.minX) * scaleX,
                y: minY + (p.y - origBbox.minY) * scaleY
            }));
        }
    } else if (origState.type === 'line' || origState.type === 'arrow' || origState.type === 'rect' || origState.type === 'circle') {
        if (origState.startPoint && origState.endPoint) {
            d.startPoint = {
                x: minX + (origState.startPoint.x - origBbox.minX) * scaleX,
                y: minY + (origState.startPoint.y - origBbox.minY) * scaleY
            };
            d.endPoint = {
                x: minX + (origState.endPoint.x - origBbox.minX) * scaleX,
                y: minY + (origState.endPoint.y - origBbox.minY) * scaleY
            };
        }
    } else if (origState.type === 'fill') {
        d.x = minX;
        d.y = minY;
        d.width = newW;
        d.height = newH;
    } else if (origState.type === 'text') {
        d.x = minX;
        d.y = minY + (origState.fontSize || 16);
        d.fontSize = Math.max(10, Math.round((origState.fontSize || 16) * scaleY));
    }
}

export function getDrawingAtPoint(pt, drawings, activeLayer, userRole, matchLayer = true, ctxInteraction = null) {
    const sorted = Object.values(drawings).sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    for (const d of sorted) {
        const drawingLayer = d.layer || 'token';
        if (matchLayer && drawingLayer !== activeLayer && userRole !== 'GM') continue;
        if (matchLayer && userRole === 'GM' && drawingLayer !== activeLayer) continue;

        const bbox = getDrawingBoundingBox(d, ctxInteraction);
        if (!bbox) continue;

        if (pt.x >= bbox.minX - 6 && pt.x <= bbox.maxX + 6 && pt.y >= bbox.minY - 6 && pt.y <= bbox.maxY + 6) {
            return d;
        }
    }
    return null;
}

export function drawDrawingObject(ctx, d, isSelected = false, activeTool = 'select', zoom = 1.0, drawingImageCache = null, renderAllFn = null, ctxInteraction = null) {
    if (!d) return;
    ctx.save();
    ctx.globalAlpha = d.opacity !== undefined ? d.opacity : 1.0;

    if (isSelected) {
        ctx.shadowColor = '#d4af37';
        ctx.shadowBlur = 8;
    }

    const strokeCol = d.strokeColor || '#eab308';
    const fillCol = d.fillColor || strokeCol;
    const strokeW = d.strokeWidth || 4;
    const isFilled = d.fillMode === 'fill' || d.fillMode === 'both';
    const hasStroke = !d.fillMode || d.fillMode === 'stroke' || d.fillMode === 'both';

    ctx.strokeStyle = strokeCol;
    ctx.fillStyle = fillCol;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (d.type === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = d.strokeWidth || 24;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const pts = d.points || [];
        if (pts.length > 1) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
                const xc = (pts[i].x + pts[i + 1].x) / 2;
                const yc = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.stroke();
        } else if (pts.length === 1) {
            ctx.beginPath();
            ctx.arc(pts[0].x, pts[0].y, (d.strokeWidth || 24) / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        return;
    }

    if (d.type === 'pencil' || d.type === 'brush') {
        const pts = d.points || [];
        if (pts.length > 1) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
                const xc = (pts[i].x + pts[i + 1].x) / 2;
                const yc = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.stroke();
        } else if (pts.length === 1) {
            ctx.beginPath();
            ctx.arc(pts[0].x, pts[0].y, strokeW / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (d.type === 'line') {
        const p1 = d.startPoint || { x: 0, y: 0 };
        const p2 = d.endPoint || { x: 0, y: 0 };
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    } else if (d.type === 'arrow') {
        const p1 = d.startPoint || { x: 0, y: 0 };
        const p2 = d.endPoint || { x: 0, y: 0 };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const headLen = Math.max(12, strokeW * 3);

        const shaftEndDist = Math.max(0, dist - headLen * 0.75);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x + Math.cos(angle) * shaftEndDist, p1.y + Math.sin(angle) * shaftEndDist);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = strokeCol;
        ctx.fill();
        ctx.stroke();
    } else if (d.type === 'rect') {
        const p1 = d.startPoint || { x: 0, y: 0 };
        const p2 = d.endPoint || { x: 0, y: 0 };
        const rx = Math.min(p1.x, p2.x);
        const ry = Math.min(p1.y, p2.y);
        const rw = Math.abs(p2.x - p1.x);
        const rh = Math.abs(p2.y - p1.y);
        if (isFilled) ctx.fillRect(rx, ry, rw, rh);
        if (hasStroke) ctx.strokeRect(rx, ry, rw, rh);
    } else if (d.type === 'circle') {
        const p1 = d.startPoint || { x: 0, y: 0 };
        const p2 = d.endPoint || { x: 0, y: 0 };
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const rx = Math.abs(p2.x - p1.x) / 2;
        const ry = Math.abs(p2.y - p1.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        if (hasStroke) ctx.stroke();
    } else if (d.type === 'polygon') {
        const pts = d.points || [];
        if (pts.length > 1) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            if (d.isClosed !== false) ctx.closePath();
            if (isFilled && d.isClosed !== false) ctx.fill();
            if (hasStroke) ctx.stroke();
        }
    } else if (d.type === 'fill') {
        if (d.imageData) {
            let img = drawingImageCache?.get(d.imageData);
            if (!img && drawingImageCache) {
                img = new Image();
                img.src = d.imageData;
                if (typeof renderAllFn === 'function') {
                    img.onload = () => renderAllFn();
                }
                drawingImageCache.set(d.imageData, img);
            }
            if (img && img.complete) {
                ctx.drawImage(img, d.x, d.y, d.width, d.height);
            }
        }
    } else if (d.type === 'text') {
        const fs = d.fontSize || 16;
        ctx.font = `${fs}px ${d.fontFamily || 'Open Sans, sans-serif'}`;
        ctx.fillStyle = strokeCol;
        const lines = (d.text || '').split('\n');
        lines.forEach((l, idx) => {
            ctx.fillText(l, d.x, d.y + idx * (fs * 1.25));
        });
    }

    ctx.restore();

    if (isSelected && activeTool === 'select') {
        drawDrawingSelectionHandles(ctx, d, zoom, ctxInteraction);
    }
}

export function drawDrawingSelectionHandles(ctx, d, zoom = 1.0, ctxInteraction = null) {
    const bbox = getDrawingBoundingBox(d, ctxInteraction);
    if (!bbox) return;

    ctx.save();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5 / Math.max(0.01, zoom);
    ctx.setLineDash([4 / Math.max(0.01, zoom), 3 / Math.max(0.01, zoom)]);
    ctx.strokeRect(bbox.minX, bbox.minY, bbox.w, bbox.h);
    ctx.setLineDash([]);

    const handles = getDrawingResizeHandles(d, ctxInteraction);
    const handleRadius = 4.5 / Math.max(0.01, zoom);

    for (const [key, pos] of Object.entries(handles)) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5 / Math.max(0.01, zoom);
        ctx.stroke();
    }
    ctx.restore();
}

export function renderDrawingsPass(targetLayer, ctxInteraction, drawings, activeLayer, userRole, selectedDrawingId, selectedDrawingIds, currentPaintStroke, offDrawingCanvas, offDrawingCtx, isRectInViewportFn, drawingImageCache, renderAllFn, zoom = 1.0, activeTool = 'select') {
    const isGmViewing = userRole === 'GM';
    const layerDrawings = Object.values(drawings)
        .filter(d => (d.layer || 'token') === targetLayer)
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    const hasEraser = layerDrawings.some(d => d.type === 'eraser') || 
        (currentPaintStroke && currentPaintStroke.type === 'eraser' && (currentPaintStroke.layer || 'token') === targetLayer);

    if (!hasEraser) {
        layerDrawings.forEach(d => {
            const drawingLayer = d.layer || 'token';
            if (drawingLayer !== activeLayer && !isGmViewing) return;
            const isControlled = isDrawingControlledByPlayer(d, userRole);
            const isSelected = isControlled && (selectedDrawingId === d.id || selectedDrawingIds?.has(d.id));

            const bbox = getDrawingBoundingBox(d, ctxInteraction);
            if (bbox && !isSelected && typeof isRectInViewportFn === 'function' && !isRectInViewportFn(bbox.minX, bbox.minY, bbox.w, bbox.h, 200)) {
                return;
            }

            ctxInteraction.save();
            if (userRole === 'GM' && activeLayer !== drawingLayer) {
                ctxInteraction.globalAlpha = 0.45;
            }
            drawDrawingObject(ctxInteraction, d, isSelected, activeTool, zoom, drawingImageCache, renderAllFn, ctxInteraction);
            ctxInteraction.restore();
        });
        return;
    }

    const mapW = ctxInteraction.canvas.width;
    const mapH = ctxInteraction.canvas.height;
    if (offDrawingCanvas.width !== mapW || offDrawingCanvas.height !== mapH) {
        offDrawingCanvas.width = mapW;
        offDrawingCanvas.height = mapH;
    } else {
        offDrawingCtx.clearRect(0, 0, mapW, mapH);
    }

    layerDrawings.forEach(d => {
        const drawingLayer = d.layer || 'token';
        if (drawingLayer !== activeLayer && !isGmViewing) return;
        const isControlled = isDrawingControlledByPlayer(d, userRole);
        const isSelected = isControlled && (selectedDrawingId === d.id || selectedDrawingIds?.has(d.id));

        const bbox = getDrawingBoundingBox(d, ctxInteraction);
        if (bbox && !isSelected && typeof isRectInViewportFn === 'function' && !isRectInViewportFn(bbox.minX, bbox.minY, bbox.w, bbox.h, 200)) {
            return;
        }

        offDrawingCtx.save();
        drawDrawingObject(offDrawingCtx, d, isSelected, activeTool, zoom, drawingImageCache, renderAllFn, ctxInteraction);
        offDrawingCtx.restore();
    });

    if (currentPaintStroke && currentPaintStroke.type === 'eraser' && (currentPaintStroke.layer || 'token') === targetLayer) {
        offDrawingCtx.save();
        drawDrawingObject(offDrawingCtx, currentPaintStroke, false, activeTool, zoom, drawingImageCache, renderAllFn, ctxInteraction);
        offDrawingCtx.restore();
    }

    ctxInteraction.save();
    if (userRole === 'GM' && activeLayer !== targetLayer) {
        ctxInteraction.globalAlpha = 0.45;
    }
    ctxInteraction.drawImage(offDrawingCanvas, 0, 0);
    ctxInteraction.restore();
}

// Named compatibility aliases
export { drawDrawingSelectionHandles as drawDrawingHandles, getDrawingAtPoint as isPointInDrawing };

