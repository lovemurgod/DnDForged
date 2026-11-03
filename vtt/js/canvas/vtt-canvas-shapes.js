/**
 * vtt-canvas-shapes.js
 * Persistent AOE measurement and spell templates (Circle, Cone, Line, Square, Beam).
 */

export function isShapeControlledByPlayer(shape, role, username) {
    if (!shape) return false;
    if (role === 'GM') return true;
    if (shape.ownerUsername && username && shape.ownerUsername.toLowerCase() === username.toLowerCase()) return true;
    return false;
}

export function getShapeCenterPoint(shapeObj) {
    if (!shapeObj || !shapeObj.startPoint || !shapeObj.endPoint) return { x: 0, y: 0 };
    const p1 = shapeObj.startPoint;
    const p2 = shapeObj.endPoint;

    if (shapeObj.shape === 'circle' || (shapeObj.shape === 'square' && shapeObj.squareAnchor === 'center')) {
        return p1;
    } else if (shapeObj.shape === 'line' && Array.isArray(shapeObj.points) && shapeObj.points.length > 0) {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        shapeObj.points.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
    } else {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }
}

export function getShapePolyPoints(shapeObj) {
    if (!shapeObj) return [];
    if (shapeObj.shape === 'line' && Array.isArray(shapeObj.points) && shapeObj.points.length >= 2) {
        return shapeObj.points;
    }
    if (shapeObj.startPoint && shapeObj.endPoint) {
        return [shapeObj.startPoint, shapeObj.endPoint];
    }
    return [];
}

export function getShapeBoundingBox(s) {
    if (!s) return null;
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    if (s.shape === 'line' && Array.isArray(s.points) && s.points.length > 0) {
        s.points.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
    } else if (s.startPoint && s.endPoint) {
        const p1 = s.startPoint;
        const p2 = s.endPoint;
        if (s.shape === 'circle') {
            const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            minX = p1.x - radius;
            maxX = p1.x + radius;
            minY = p1.y - radius;
            maxY = p1.y + radius;
        } else if (s.shape === 'cone') {
            const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            minX = Math.min(p1.x - radius, p2.x);
            maxX = Math.max(p1.x + radius, p2.x);
            minY = Math.min(p1.y - radius, p2.y);
            maxY = Math.max(p1.y + radius, p2.y);
        } else {
            minX = Math.min(p1.x, p2.x);
            maxX = Math.max(p1.x, p2.x);
            minY = Math.min(p1.y, p2.y);
            maxY = Math.max(p1.y, p2.y);
        }
    } else {
        return null;
    }
    return { minX, minY, maxX, maxY };
}

export function isPointInsideShape(pt, s, options = {}) {
    if (!s || !pt || !s.startPoint || !s.endPoint) return false;
    const p1 = s.startPoint;
    const p2 = s.endPoint;
    const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const getDistanceToSegment =
        options.getDistanceToSegment ||
        ((x, y, x1, y1, x2, y2) => {
            const l2 = Math.hypot(x2 - x1, y2 - y1) ** 2;
            if (l2 === 0) return Math.hypot(x - x1, y - y1);
            let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
        });

    if (s.shape === 'circle') {
        return Math.hypot(pt.x - p1.x, pt.y - p1.y) <= radius;
    } else if (s.shape === 'square') {
        const halfSide = radius;
        let rx, ry;
        if (s.squareAnchor === 'center') {
            rx = p1.x - halfSide;
            ry = p1.y - halfSide;
        } else {
            rx = Math.min(p1.x, p2.x);
            ry = Math.min(p1.y, p2.y);
        }
        const side = halfSide * 2;
        return pt.x >= rx && pt.x <= rx + side && pt.y >= ry && pt.y <= ry + side;
    } else if (s.shape === 'cone') {
        const dist = Math.hypot(pt.x - p1.x, pt.y - p1.y);
        if (dist > radius) return false;
        if (dist < 1) return true;
        const ptAng = Math.atan2(pt.y - p1.y, pt.x - p1.x);
        const coneAng = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let diff = Math.abs(ptAng - coneAng);
        while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
        return diff <= Math.PI / 4;
    } else if (s.shape === 'beam') {
        const activeGrid = options.grid || { size: 50, scale: 1, feetPerSquare: 5 };
        const pxPerFt = (activeGrid.size * (activeGrid.scale || 1.0)) / (activeGrid.feetPerSquare || 5);
        const halfWidth = ((s.beamWidth || 5) * pxPerFt) / 2;
        return getDistanceToSegment(pt.x, pt.y, p1.x, p1.y, p2.x, p2.y) <= halfWidth;
    } else if (s.shape === 'line' && Array.isArray(s.points) && s.points.length >= 2) {
        const activeGrid = options.grid || { size: 50, scale: 1, feetPerSquare: 5 };
        const pxPerFt = (activeGrid.size * (activeGrid.scale || 1.0)) / (activeGrid.feetPerSquare || 5);
        const halfWidth = ((s.beamWidth || 5) * pxPerFt) / 2;
        for (let i = 0; i < s.points.length - 1; i++) {
            if (
                getDistanceToSegment(pt.x, pt.y, s.points[i].x, s.points[i].y, s.points[i + 1].x, s.points[i + 1].y) <=
                halfWidth
            ) {
                return true;
            }
        }
        return false;
    }
    return false;
}

export function isTokenIntersectingShape(token, s, options = {}) {
    if (!token || !s || !s.startPoint || !s.endPoint) return false;
    const getTokenDrawDimensions = options.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50 }));
    const { drawW, drawH } = getTokenDrawDimensions(token);
    const tokX1 = token.x;
    const tokY1 = token.y;
    const tokX2 = token.x + drawW;
    const tokY2 = token.y + drawH;
    const tokCx = token.x + drawW / 2;
    const tokCy = token.y + drawH / 2;
    const tokR = Math.max(drawW, drawH) / 2;

    const p1 = s.startPoint;
    const p2 = s.endPoint;
    const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const getDistanceToSegment =
        options.getDistanceToSegment ||
        ((x, y, x1, y1, x2, y2) => {
            const l2 = Math.hypot(x2 - x1, y2 - y1) ** 2;
            if (l2 === 0) return Math.hypot(x - x1, y - y1);
            let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
        });

    if (s.shape === 'circle') {
        const centerDist = Math.hypot(tokCx - p1.x, tokCy - p1.y);
        return centerDist <= radius + tokR;
    } else if (s.shape === 'square') {
        const halfSide = radius;
        let rx, ry;
        if (s.squareAnchor === 'center') {
            rx = p1.x - halfSide;
            ry = p1.y - halfSide;
        } else {
            rx = Math.min(p1.x, p2.x);
            ry = Math.min(p1.y, p2.y);
        }
        const side = halfSide * 2;
        const sqX2 = rx + side;
        const sqY2 = ry + side;
        return !(tokX1 > sqX2 || tokX2 < rx || tokY1 > sqY2 || tokY2 < ry);
    } else if (s.shape === 'cone') {
        const centerDist = Math.hypot(tokCx - p1.x, tokCy - p1.y);
        if (centerDist > radius + tokR) return false;
        if (centerDist <= tokR) return true;
        const ptAng = Math.atan2(tokCy - p1.y, tokCx - p1.x);
        const coneAng = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let diff = Math.abs(ptAng - coneAng);
        while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
        const angSlack = Math.asin(Math.min(1.0, tokR / Math.max(1, centerDist)));
        return diff <= Math.PI / 4 + angSlack;
    } else if (s.shape === 'beam') {
        const activeGrid = options.grid || { size: 50, scale: 1, feetPerSquare: 5 };
        const pxPerFt = (activeGrid.size * (activeGrid.scale || 1.0)) / (activeGrid.feetPerSquare || 5);
        const halfWidth = ((s.beamWidth || 5) * pxPerFt) / 2;
        return getDistanceToSegment(tokCx, tokCy, p1.x, p1.y, p2.x, p2.y) <= halfWidth + tokR;
    } else if (s.shape === 'line' && Array.isArray(s.points) && s.points.length >= 2) {
        const activeGrid = options.grid || { size: 50, scale: 1, feetPerSquare: 5 };
        const pxPerFt = (activeGrid.size * (activeGrid.scale || 1.0)) / (activeGrid.feetPerSquare || 5);
        const halfWidth = ((s.beamWidth || 5) * pxPerFt) / 2;
        for (let i = 0; i < s.points.length - 1; i++) {
            if (
                getDistanceToSegment(
                    tokCx,
                    tokCy,
                    s.points[i].x,
                    s.points[i].y,
                    s.points[i + 1].x,
                    s.points[i + 1].y
                ) <=
                halfWidth + tokR
            ) {
                return true;
            }
        }
        return false;
    }
    return false;
}

export function getPersistentShapeAtPoint(pt, shapes, options = {}) {
    if (!shapes || !pt) return null;
    const comp = getShapeComponentAtCoord(pt.x, pt.y, shapes, { ...options, requireControl: false });
    if (comp && shapes[comp.shapeId]) {
        return shapes[comp.shapeId];
    }
    const shapeList = Object.values(shapes).sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    for (let i = 0; i < shapeList.length; i++) {
        const s = shapeList[i];
        if (options.matchLayer && options.activeLayer) {
            const shapeLayer = s.layer || 'token';
            if (shapeLayer !== options.activeLayer && options.role !== 'GM') continue;
        }
        if (isPointInsideShape(pt, s, options)) {
            return s;
        }
    }
    return null;
}

export function getShapeComponentAtCoord(x, y, shapes, options = {}) {
    let found = null;
    let minDistance = 16;
    const requireControl = options.requireControl ?? true;
    const role = options.role || 'GM';
    const username = options.username || '';
    const getDistanceToSegment =
        options.getDistanceToSegment ||
        ((px, py, x1, y1, x2, y2) => {
            const l2 = Math.hypot(x2 - x1, y2 - y1) ** 2;
            if (l2 === 0) return Math.hypot(px - x1, py - y1);
            let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
        });

    const sortedShapes = Object.entries(shapes || {}).sort((a, b) => (b[1].zIndex || 0) - (a[1].zIndex || 0));

    sortedShapes.forEach(([id, s]) => {
        if (requireControl && !isShapeControlledByPlayer(s, role, username)) return;
        if (options.matchLayer && options.activeLayer) {
            const shapeLayer = s.layer || 'token';
            if (shapeLayer !== options.activeLayer && role !== 'GM') return;
        }
        const center = getShapeCenterPoint(s);
        const centerDist = Math.hypot(x - center.x, y - center.y);
        if (centerDist < minDistance) {
            minDistance = centerDist;
            found = { shapeId: id, type: 'shape', index: -1 };
        }

        const polyPoints = getShapePolyPoints(s);
        polyPoints.forEach((point, index) => {
            const dist = Math.hypot(x - point.x, y - point.y);
            if (dist < minDistance) {
                minDistance = dist;
                found = { shapeId: id, type: 'anchor', index };
            }
        });

        if (s.shape === 'line') {
            for (let i = 0; i < polyPoints.length - 1; i++) {
                const A = polyPoints[i];
                const B = polyPoints[i + 1];
                const dist = getDistanceToSegment(x, y, A.x, A.y, B.x, B.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    found = { shapeId: id, type: 'segment', index: i };
                }
            }
        }
    });

    return found;
}

export function drawShapeComponentHandles(ctx, shapeObj, shapeId, options = {}) {
    if (!ctx || !shapeObj) return;
    const role = options.role || 'GM';
    const username = options.username || '';
    if (!isShapeControlledByPlayer(shapeObj, role, username)) return;

    const polyPoints = getShapePolyPoints(shapeObj);
    const selectedShapeIds = options.selectedShapeIds || new Set();
    const selectedShapeId = options.selectedShapeId;
    const isSelectedShape = selectedShapeIds.has(shapeId) || selectedShapeId === shapeId;
    const hoveredShapeComponent = options.hoveredShapeComponent;
    const selectedShapeComponent = options.selectedShapeComponent;
    const isHoveredShape = hoveredShapeComponent && hoveredShapeComponent.shapeId === shapeId;
    const isComponentSelected = selectedShapeComponent && selectedShapeComponent.shapeId === shapeId;
    if (!isSelectedShape && !isHoveredShape && !isComponentSelected) return;

    ctx.save();
    for (let i = 0; i < polyPoints.length; i++) {
        const point = polyPoints[i];
        const isAnchorSelected =
            isComponentSelected && selectedShapeComponent.type === 'anchor' && selectedShapeComponent.index === i;
        const isAnchorHovered =
            hoveredShapeComponent &&
            hoveredShapeComponent.shapeId === shapeId &&
            hoveredShapeComponent.type === 'anchor' &&
            hoveredShapeComponent.index === i;
        const radius = isAnchorSelected ? 7 : isAnchorHovered ? 6 : 4;
        const fill = isAnchorSelected
            ? 'rgba(255, 220, 0, 0.95)'
            : isAnchorHovered
              ? 'rgba(255, 255, 255, 0.95)'
              : 'rgba(255, 255, 255, 0.7)';
        const stroke = isAnchorSelected ? '#ff8c00' : 'rgba(0, 0, 0, 0.65)';
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = isAnchorSelected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    const isSegmentHovered =
        hoveredShapeComponent && hoveredShapeComponent.shapeId === shapeId && hoveredShapeComponent.type === 'segment';
    if ((isComponentSelected && selectedShapeComponent.type === 'segment') || isSegmentHovered) {
        const segmentIndex =
            isComponentSelected && selectedShapeComponent.type === 'segment'
                ? selectedShapeComponent.index
                : hoveredShapeComponent.index;
        if (segmentIndex >= 0 && segmentIndex < polyPoints.length - 1) {
            const A = polyPoints[segmentIndex];
            const B = polyPoints[segmentIndex + 1];
            const midX = (A.x + B.x) / 2;
            const midY = (A.y + B.y) / 2;
            ctx.fillStyle = isSegmentHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 123, 255, 0.95)';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(midX, midY, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    ctx.restore();
}

export function changeShapeZOrder(shapeId, action, options = {}) {
    const { shapes = {}, onShapesChanged = null } = options;

    const shapeList = Object.values(shapes);
    if (shapeList.length <= 1) return;

    const selectedShape = shapes[shapeId];
    if (!selectedShape) return;

    const otherZIndexes = shapeList.filter((s) => s.id !== shapeId).map((s) => s.zIndex || 0);

    const maxZ = otherZIndexes.length > 0 ? Math.max(...otherZIndexes) : 0;
    const minZ = otherZIndexes.length > 0 ? Math.min(...otherZIndexes) : 0;

    if (action === 'front') {
        selectedShape.zIndex = maxZ + 1;
    } else if (action === 'back') {
        selectedShape.zIndex = minZ - 1;
    } else if (action === 'front-one' || action === 'back-one') {
        const sortedShapes = [...shapeList].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        const curIdx = sortedShapes.findIndex((s) => s.id === shapeId);
        if (action === 'front-one') {
            if (curIdx < sortedShapes.length - 1) {
                const targetShape = sortedShapes[curIdx + 1];
                const temp = selectedShape.zIndex || 0;
                selectedShape.zIndex = targetShape.zIndex || 0;
                targetShape.zIndex = temp;
                if (selectedShape.zIndex === targetShape.zIndex) {
                    selectedShape.zIndex += 1;
                }
            }
        } else {
            if (curIdx > 0) {
                const targetShape = sortedShapes[curIdx - 1];
                const temp = selectedShape.zIndex || 0;
                selectedShape.zIndex = targetShape.zIndex || 0;
                targetShape.zIndex = temp;
                if (selectedShape.zIndex === targetShape.zIndex) {
                    selectedShape.zIndex -= 1;
                }
            }
        }
    }

    if (onShapesChanged) onShapesChanged();
}

export function showShapeContextMenu(shape, clientX, clientY, context = {}) {
    if (typeof document === 'undefined') return;
    const oldMenu = document.getElementById('vtt-token-context-menu');
    if (oldMenu) oldMenu.remove();

    const role = context.role || 'GM';
    if (!shape || role !== 'GM') return;

    const menu = document.createElement('div');
    menu.id = 'vtt-token-context-menu';
    menu.className = 'vtt-token-context-menu';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    const shapeType = shape.shape ? shape.shape.charAt(0).toUpperCase() + shape.shape.slice(1) : 'Shape';
    const currentLayer = shape.layer || 'token';
    const layerNames = { token: 'Token Layer', gm: 'GM Layer', map: 'Map Layer' };

    menu.innerHTML = `
        <div class="vtt-token-menu-header" style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-shapes" style="color:var(--color-gold-base);"></i>
            <span>${shapeType} Shape (${layerNames[currentLayer] || currentLayer})</span>
        </div>
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-users item-icon"></i> Select Creatures</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu" style="min-width: 190px;">
                <div class="vtt-token-submenu-list scroll-styled">
                    <div class="vtt-submenu-item menu-shape-select-creatures" data-filter="all">
                        <span><i class="fa-solid fa-users" style="width: 16px; text-align: center; margin-right: 8px;"></i> All Creatures</span>
                    </div>
                    <div class="vtt-submenu-item menu-shape-select-creatures" data-filter="pc">
                        <span><i class="fa-solid fa-user-shield" style="width: 16px; text-align: center; margin-right: 8px;"></i> Player Characters only</span>
                    </div>
                    <div class="vtt-submenu-item menu-shape-select-creatures" data-filter="npc">
                        <span><i class="fa-solid fa-dragon" style="width: 16px; text-align: center; margin-right: 8px;"></i> Monsters / NPCs only</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item">
            <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Layer</span>
            <i class="fa-solid fa-chevron-right chevron-icon"></i>
            <div class="vtt-token-submenu" style="min-width: 180px;">
                <div class="vtt-token-submenu-list scroll-styled">
                    <div class="vtt-submenu-item menu-shape-move-layer ${currentLayer === 'token' ? 'active' : ''}" data-layer="token">
                        <span><i class="fa-solid fa-users" style="width: 16px; text-align: center; margin-right: 8px;"></i> Token Layer ${currentLayer === 'token' ? '✓' : ''}</span>
                    </div>
                    <div class="vtt-submenu-item menu-shape-move-layer ${currentLayer === 'gm' ? 'active' : ''}" data-layer="gm">
                        <span><i class="fa-solid fa-user-secret" style="width: 16px; text-align: center; margin-right: 8px;"></i> GM Layer ${currentLayer === 'gm' ? '✓' : ''}</span>
                    </div>
                    <div class="vtt-submenu-item menu-shape-move-layer ${currentLayer === 'map' ? 'active' : ''}" data-layer="map">
                        <span><i class="fa-solid fa-map" style="width: 16px; text-align: center; margin-right: 8px;"></i> Map Layer ${currentLayer === 'map' ? '✓' : ''}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item" id="menu-shape-front">
            <span><i class="fa-solid fa-angles-up item-icon"></i> Bring to Front</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-shape-forward">
            <span><i class="fa-solid fa-angle-up item-icon"></i> Bring Forward</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-shape-backward">
            <span><i class="fa-solid fa-angle-down item-icon"></i> Send Backward</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-shape-back">
            <span><i class="fa-solid fa-angles-down item-icon"></i> Send to Back</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item text-danger" id="menu-shape-delete" style="color:var(--color-danger);">
            <span><i class="fa-solid fa-trash item-icon"></i> Delete Shape</span>
        </div>
    `;

    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    if (clientX + menuRect.width > window.innerWidth) menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    if (clientY + menuRect.height > window.innerHeight)
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;

    // Creature selection clicks
    menu.querySelectorAll('.menu-shape-select-creatures').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterType = item.dataset.filter || 'all';
            menu.remove();
            if (context.onSelectCreatures) {
                context.onSelectCreatures(shape, filterType);
            } else if (context.onSelectIntersectingTokens) {
                context.onSelectIntersectingTokens(shape);
            }
        });
    });

    // Move to layer clicks
    menu.querySelectorAll('.menu-shape-move-layer').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetLayer = item.dataset.layer;
            menu.remove();
            context.onMoveToLayer?.(shape.id, targetLayer);
        });
    });

    // Z-order clicks
    menu.querySelector('#menu-shape-front')?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        context.onZOrderChange?.(shape.id, 'front');
    });

    menu.querySelector('#menu-shape-forward')?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        context.onZOrderChange?.(shape.id, 'front-one');
    });

    menu.querySelector('#menu-shape-backward')?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        context.onZOrderChange?.(shape.id, 'back-one');
    });

    menu.querySelector('#menu-shape-back')?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        context.onZOrderChange?.(shape.id, 'back');
    });

    // Delete shape click
    menu.querySelector('#menu-shape-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        context.onDeleteShape?.(shape.id);
    });

    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                window.removeEventListener('click', closeMenu);
                window.removeEventListener('contextmenu', closeMenu);
            }
        };
        window.addEventListener('click', closeMenu);
        window.addEventListener('contextmenu', closeMenu);
    }, 10);
}
