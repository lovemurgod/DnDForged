// DnDForged Canvas Measurement & Template Engine
// Handles distance calculations, grid units, and geometric spell/ruler measurement templates

export function getGridDistanceSettings(g) {
    const val =
        g && typeof g.distancePerSquare === 'number' && !isNaN(g.distancePerSquare) && g.distancePerSquare > 0
            ? g.distancePerSquare
            : g && typeof g.feetPerSquare === 'number' && !isNaN(g.feetPerSquare) && g.feetPerSquare > 0
              ? g.feetPerSquare
              : 5;
    const unit =
        g && g.distanceUnit && typeof g.distanceUnit === 'string' && g.distanceUnit.trim()
            ? g.distanceUnit.trim()
            : 'ft';
    const diagonalRule = g && g.diagonalRule === '5-10-5' ? '5-10-5' : '5ft';
    return { val, unit, diagonalRule };
}

export function calcPointsDistance(p1, p2, g, carryOverDiagonals = 0) {
    if (!p1 || !p2) return { distance: 0, diagonals: 0 };
    const pxPerCell = (g?.size || 50) * (g?.scale || 1.0) || 50;
    const { val, diagonalRule } = getGridDistanceSettings(g);
    const isHex = typeof g?.type === 'string' && g.type.startsWith('hex');

    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);

    if (isHex) {
        const distPx = Math.hypot(dx, dy);
        const cells = distPx / pxPerCell;
        return { distance: cells * val, diagonals: 0 };
    }

    const cellDx = dx / pxPerCell;
    const cellDy = dy / pxPerCell;

    if (diagonalRule === '5ft') {
        const cells = Math.max(cellDx, cellDy);
        return { distance: cells * val, diagonals: 0 };
    }

    // 5-10-5 (DMG Variant)
    const minCells = Math.min(cellDx, cellDy);
    const maxCells = Math.max(cellDx, cellDy);
    const straightCells = maxCells - minCells;

    const fullDiagonals = Math.floor(minCells);
    const fracDiagonal = minCells - fullDiagonals;

    let diagonalDistance = 0;
    for (let i = 1; i <= fullDiagonals; i++) {
        const diagIndex = carryOverDiagonals + i;
        diagonalDistance += (diagIndex % 2 === 0 ? 2 : 1) * val;
    }
    if (fracDiagonal > 0) {
        const nextDiagIndex = carryOverDiagonals + fullDiagonals + 1;
        const nextStepCost = (nextDiagIndex % 2 === 0 ? 2 : 1) * val;
        diagonalDistance += fracDiagonal * nextStepCost;
    }

    const totalDist = straightCells * val + diagonalDistance;
    return {
        distance: totalDist,
        diagonals: fullDiagonals + fracDiagonal
    };
}

export function calcPolylineGridDistance(points, g) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    let totalDist = 0;
    let carryDiagonals = 0;
    for (let i = 1; i < points.length; i++) {
        const seg = calcPointsDistance(points[i - 1], points[i], g, carryDiagonals);
        totalDist += seg.distance;
        carryDiagonals += seg.diagonals;
    }
    return totalDist;
}

export function formatDistanceResult(totalDist, g) {
    const { val, unit } = getGridDistanceSettings(g);
    let roundedDist;
    if (unit.toLowerCase() === 'ft' && val === 5) {
        roundedDist = Math.round(totalDist / 5) * 5;
    } else if (val >= 1) {
        roundedDist = Math.round(totalDist * 10) / 10;
        if (Number.isInteger(roundedDist)) roundedDist = Math.round(roundedDist);
    } else {
        roundedDist = Math.round(totalDist * 100) / 100;
    }

    return {
        distance: roundedDist,
        unit: unit,
        label: `${roundedDist} ${unit}`
    };
}

export function calcDistanceFormatted(pixelsOrDistance, g, pointsOrCoords = null) {
    if (Array.isArray(pointsOrCoords) && pointsOrCoords.length >= 2) {
        const totalDist = calcPolylineGridDistance(pointsOrCoords, g);
        return formatDistanceResult(totalDist, g);
    } else if (pointsOrCoords && pointsOrCoords.start && pointsOrCoords.end) {
        const totalDist = calcPointsDistance(pointsOrCoords.start, pointsOrCoords.end, g).distance;
        return formatDistanceResult(totalDist, g);
    } else if (typeof pixelsOrDistance === 'number') {
        const pxPerCell = (g?.size || 50) * (g?.scale || 1.0) || 50;
        const { val } = getGridDistanceSettings(g);
        const cells = pixelsOrDistance / pxPerCell;
        return formatDistanceResult(cells * val, g);
    }
    return formatDistanceResult(0, g);
}

export function calcDistanceFt(pixelsOrDistance, g, pointsOrCoords = null) {
    return calcDistanceFormatted(pixelsOrDistance, g, pointsOrCoords).distance;
}

export function drawMeasurementTemplate(
    ctx,
    startPoint,
    endPoint,
    shapeType,
    squareAnchor,
    beamWidth,
    color,
    ownerUsername,
    _unused,
    points,
    showDistance,
    gridRef = null,
    resolveRulerPortalBendingFn = null,
    zoomLevel = 1.0,
    panCoords = null
) {
    if (!startPoint || !endPoint) return;
    const fillColor = color || '#00ffff';
    const strokeColor = fillColor;
    const activeGrid = gridRef || { size: 50, scale: 1.0, distancePerSquare: 5, distanceUnit: 'ft' };
    const zoom = zoomLevel || (ctx.getTransform ? ctx.getTransform()?.a : 1) || 1;
    const safeZoom = Math.max(0.05, zoom);
    const screenResScale =
        typeof window !== 'undefined' && window.innerWidth
            ? Math.max(0.8, Math.min(2.0, window.innerWidth / 1920))
            : 1.0;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    const isScreenSpace = Boolean(panCoords);
    const toScreenX = (wx) => (isScreenSpace ? panCoords.panX + wx * zoom : wx);
    const toScreenY = (wy) => (isScreenSpace ? panCoords.panY + wy * zoom : wy);

    ctx.lineWidth = isScreenSpace ? Math.max(1, 2.5 * screenResScale) : Math.max(0.5, (2 * screenResScale) / zoom);
    ctx.setLineDash([]);

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const radius = Math.hypot(dx, dy);

    const sStart = { x: toScreenX(startPoint.x), y: toScreenY(startPoint.y) };
    const sEnd = { x: toScreenX(endPoint.x), y: toScreenY(endPoint.y) };
    const sRadius = isScreenSpace ? radius * zoom : radius;

    let distancePx = radius;
    let labelAtX = endPoint.x;
    let labelAtY = endPoint.y;
    let shapeDistInfo = null;

    if (shapeType === 'circle') {
        ctx.beginPath();
        ctx.arc(sStart.x, sStart.y, sRadius, 0, Math.PI * 2);
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        ctx.setLineDash(isScreenSpace ? [5 * screenResScale, 5 * screenResScale] : [4 / zoom, 4 / zoom]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        distancePx = radius;
        shapeDistInfo = calcDistanceFormatted(null, activeGrid, { start: startPoint, end: endPoint });
    } else if (shapeType === 'square') {
        const halfSide = radius;
        let rx = startPoint.x,
            ry = startPoint.y;
        if (squareAnchor === 'center') {
            rx = startPoint.x - halfSide;
            ry = startPoint.y - halfSide;
        } else {
            rx = Math.min(startPoint.x, endPoint.x);
            ry = Math.min(startPoint.y, endPoint.y);
        }
        const side = halfSide * 2;
        const sRx = toScreenX(rx);
        const sRy = toScreenY(ry);
        const sSide = isScreenSpace ? side * zoom : side;

        ctx.beginPath();
        ctx.rect(sRx, sRy, sSide, sSide);
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        distancePx = side;
        shapeDistInfo = calcDistanceFormatted(side, activeGrid);
    } else if (shapeType === 'cone') {
        const angle = Math.atan2(dy, dx);
        const halfAngle = Math.PI / 4; // 90 degree cone
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.arc(sStart.x, sStart.y, sRadius, angle - halfAngle, angle + halfAngle);
        ctx.closePath();
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        distancePx = radius;
        shapeDistInfo = calcDistanceFormatted(null, activeGrid, { start: startPoint, end: endPoint });
    } else if (shapeType === 'beam') {
        const angle = Math.atan2(dy, dx);
        const length = radius;
        const sLength = isScreenSpace ? length * zoom : length;
        const distPerCell = activeGrid.distancePerSquare || activeGrid.feetPerSquare || 5;
        const pxPerUnit = (activeGrid.size * (activeGrid.scale || 1.0)) / distPerCell;
        const halfWidth = ((beamWidth || 5) * pxPerUnit) / 2;
        const sHalfWidth = isScreenSpace ? halfWidth * zoom : halfWidth;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const perpX = -sin * sHalfWidth;
        const perpY = cos * sHalfWidth;

        ctx.beginPath();
        ctx.moveTo(sStart.x + perpX, sStart.y + perpY);
        ctx.lineTo(sStart.x + cos * sLength + perpX, sStart.y + sin * sLength + perpY);
        ctx.lineTo(sStart.x + cos * sLength - perpX, sStart.y + sin * sLength - perpY);
        ctx.lineTo(sStart.x - perpX, sStart.y - perpY);
        ctx.closePath();
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        distancePx = length;
        shapeDistInfo = calcDistanceFormatted(null, activeGrid, { start: startPoint, end: endPoint });
    } else {
        // Default: line (polyline if points array given, else simple line)
        const polyPoints = Array.isArray(points) && points.length >= 2 ? points : [startPoint, endPoint];
        const bentSegments =
            typeof resolveRulerPortalBendingFn === 'function'
                ? resolveRulerPortalBendingFn(polyPoints)
                : (() => {
                      let total = 0;
                      for (let i = 1; i < polyPoints.length; i++) {
                          total += Math.hypot(
                              polyPoints[i].x - polyPoints[i - 1].x,
                              polyPoints[i].y - polyPoints[i - 1].y
                          );
                      }
                      return [
                          {
                              points: polyPoints,
                              length: total,
                              isTerminal: true
                          }
                      ];
                  })();

        let totalLen = 0;
        let lastPt = polyPoints[polyPoints.length - 1];

        bentSegments.forEach((seg) => {
            ctx.beginPath();
            ctx.moveTo(toScreenX(seg.points[0].x), toScreenY(seg.points[0].y));
            for (let i = 1; i < seg.points.length; i++) {
                ctx.lineTo(toScreenX(seg.points[i].x), toScreenY(seg.points[i].y));
            }
            // Crisp, constant physical screen thickness (approx 3.5 physical screen pixels)
            ctx.lineWidth = isScreenSpace
                ? Math.max(1, 3.5 * screenResScale)
                : Math.max(0.5, (3.5 * screenResScale) / zoom);
            ctx.globalAlpha = 0.7;
            ctx.stroke();

            if (seg.isPortalJunction) {
                ctx.save();
                ctx.beginPath();
                const pt = seg.points[seg.points.length - 1];
                const pJuncRadius = isScreenSpace ? 4.5 * screenResScale : Math.max(0.5, (4.5 * screenResScale) / zoom);
                ctx.arc(toScreenX(pt.x), toScreenY(pt.y), pJuncRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#38bdf8';
                ctx.globalAlpha = 0.9;
                ctx.fill();
                ctx.restore();
            }

            if (seg.isTerminal) {
                ctx.beginPath();
                const pt = seg.points[seg.points.length - 1];
                const termRadius = isScreenSpace ? 5.5 * screenResScale : Math.max(0.5, (5.5 * screenResScale) / zoom);
                ctx.arc(toScreenX(pt.x), toScreenY(pt.y), termRadius, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.globalAlpha = 1.0;
                ctx.fill();
                lastPt = pt;
            }
            totalLen += seg.length;
        });

        // Draw start point and intermediate waypoint circle markers
        if (polyPoints.length >= 2) {
            ctx.save();
            ctx.beginPath();
            const startRadius = isScreenSpace ? 4 * screenResScale : Math.max(0.5, (4 * screenResScale) / zoom);
            ctx.arc(toScreenX(polyPoints[0].x), toScreenY(polyPoints[0].y), startRadius, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.globalAlpha = 0.9;
            ctx.fill();
            ctx.restore();

            for (let i = 1; i < polyPoints.length - 1; i++) {
                const wp = polyPoints[i];
                ctx.save();
                ctx.beginPath();
                const wpRadius = isScreenSpace ? 4.5 * screenResScale : Math.max(0.5, (4.5 * screenResScale) / zoom);
                ctx.arc(toScreenX(wp.x), toScreenY(wp.y), wpRadius, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.globalAlpha = 0.95;
                ctx.fill();
                ctx.lineWidth = isScreenSpace ? 1.5 * screenResScale : Math.max(0.5, (1.5 * screenResScale) / zoom);
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                ctx.restore();
            }
        }

        let totalDist = 0;
        let carryDiagonals = 0;
        bentSegments.forEach((seg) => {
            if (Array.isArray(seg.points) && seg.points.length >= 2) {
                for (let i = 1; i < seg.points.length; i++) {
                    const res = calcPointsDistance(seg.points[i - 1], seg.points[i], activeGrid, carryDiagonals);
                    totalDist += res.distance;
                    carryDiagonals += res.diagonals;
                }
            }
        });
        shapeDistInfo = formatDistanceResult(totalDist, activeGrid);

        distancePx = totalLen;
        labelAtX = lastPt.x;
        labelAtY = lastPt.y;
    }

    // Distance label — shown only during live drawing
    if (showDistance && (distancePx > 0 || (shapeDistInfo && shapeDistInfo.distance > 0))) {
        const distInfo = shapeDistInfo || calcDistanceFormatted(distancePx, activeGrid);
        const label = distInfo.label;
        const livePill = typeof document !== 'undefined' ? document.getElementById('vtt-live-measure-pill') : null;
        if (livePill) livePill.style.display = 'none';

        if (isScreenSpace) {
            const pillX = toScreenX(labelAtX) + 14 * screenResScale;
            const pillY = toScreenY(labelAtY) - 22 * screenResScale;

            ctx.save();
            ctx.globalAlpha = 1.0;
            const pillFontSize = Math.round(13 * screenResScale);
            ctx.font = `bold ${pillFontSize}px "Open Sans", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(label).width;
            const padX = Math.round(9 * screenResScale);
            const pillW = tw + padX * 2;
            const pillH = Math.round(22 * screenResScale);
            const r = pillH / 2;

            ctx.fillStyle = 'rgba(15, 15, 20, 0.88)';
            ctx.beginPath();
            ctx.arc(pillX - pillW / 2 + r, pillY, r, Math.PI / 2, Math.PI * 1.5);
            ctx.arc(pillX + pillW / 2 - r, pillY, r, -Math.PI / 2, Math.PI / 2);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = Math.max(1, 1.5 * screenResScale);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, pillX, pillY);
            ctx.restore();
        } else {
            ctx.save();
            ctx.globalAlpha = 1.0;
            const pillX = labelAtX + (14 * screenResScale) / zoom;
            const pillY = labelAtY - (22 * screenResScale) / zoom;

            ctx.translate(pillX, pillY);
            ctx.scale(1 / zoom, 1 / zoom);

            const pillFontSize = Math.round(13 * screenResScale);
            ctx.font = `bold ${pillFontSize}px "Open Sans", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(label).width;
            const padX = Math.round(8 * screenResScale);
            const padY = Math.round(4 * screenResScale);
            const pillW = tw + padX * 2;
            const pillH = Math.round(22 * screenResScale);
            const r = pillH / 2;

            ctx.fillStyle = 'rgba(15, 15, 20, 0.82)';
            ctx.beginPath();
            ctx.moveTo(-pillW / 2 + r, -pillH / 2);
            ctx.arcTo(pillW / 2, -pillH / 2, pillW / 2, pillH / 2, r);
            ctx.arcTo(pillW / 2, pillH / 2, -pillW / 2, pillH / 2, r);
            ctx.arcTo(-pillW / 2, pillH / 2, -pillW / 2, -pillH / 2, r);
            ctx.arcTo(-pillW / 2, -pillH / 2, pillW / 2, -pillH / 2, r);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = Math.max(1, 1.5 * screenResScale);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, 0, 0);
            ctx.restore();
        }
    }

    // Owner label
    if (ownerUsername) {
        if (isScreenSpace) {
            const lx = toScreenX((startPoint.x + endPoint.x) / 2);
            const ly = toScreenY(Math.min(startPoint.y, endPoint.y)) - 10 * screenResScale;

            ctx.save();
            ctx.globalAlpha = 1.0;
            const ownerFontSize = Math.round(11 * screenResScale);
            ctx.font = `bold ${ownerFontSize}px "Open Sans", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(ownerUsername).width;
            const padX = Math.round(7 * screenResScale);
            const pillW = tw + padX * 2;
            const pillH = Math.round(18 * screenResScale);
            const r = Math.round(4 * screenResScale);

            ctx.fillStyle = 'rgba(15, 15, 20, 0.88)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(lx - pillW / 2, ly - pillH / 2, pillW, pillH, r);
            } else {
                ctx.rect(lx - pillW / 2, ly - pillH / 2, pillW, pillH);
            }
            ctx.fill();

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = 1.5 * screenResScale;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(ownerUsername, lx, ly);
            ctx.restore();
        } else {
            const lx = (startPoint.x + endPoint.x) / 2;
            const ly = Math.min(startPoint.y, endPoint.y) - (4 * screenResScale) / zoom;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.scale(1 / zoom, 1 / zoom);

            const ownerFontSize = Math.round(11 * screenResScale);
            ctx.font = `${ownerFontSize}px "Open Sans", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            const tw = ctx.measureText(ownerUsername).width + 8 * screenResScale;
            ctx.fillRect(-tw / 2, -13 * screenResScale, tw, 14 * screenResScale);
            ctx.fillStyle = fillColor;
            ctx.fillText(ownerUsername, 0, 0);
            ctx.restore();
        }
    }

    ctx.restore();
}
