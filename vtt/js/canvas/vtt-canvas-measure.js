// DnDForged Canvas Measurement & Template Engine
// Handles distance calculations, grid units, and geometric spell/ruler measurement templates

export function getGridDistanceSettings(g) {
    const val = (g && typeof g.distancePerSquare === 'number' && !isNaN(g.distancePerSquare) && g.distancePerSquare > 0)
        ? g.distancePerSquare
        : (g && typeof g.feetPerSquare === 'number' && !isNaN(g.feetPerSquare) && g.feetPerSquare > 0 ? g.feetPerSquare : 5);
    const unit = (g && g.distanceUnit && typeof g.distanceUnit === 'string' && g.distanceUnit.trim())
        ? g.distanceUnit.trim()
        : 'ft';
    return { val, unit };
}

export function calcDistanceFormatted(pixels, g) {
    const pxPerCell = (g?.size || 50) * (g?.scale || 1.0);
    const { val, unit } = getGridDistanceSettings(g);
    const cells = pixels / (pxPerCell || 50);
    const totalDist = cells * val;

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

export function calcDistanceFt(pixels, g) {
    return calcDistanceFormatted(pixels, g).distance;
}

export function drawMeasurementTemplate(ctx, startPoint, endPoint, shapeType, squareAnchor, beamWidth, color, ownerUsername, _unused, points, showDistance, gridRef = null, resolveRulerPortalBendingFn = null) {
    if (!startPoint || !endPoint) return;
    const fillColor = color || '#00ffff';
    const strokeColor = fillColor;
    const activeGrid = gridRef || { size: 50, scale: 1.0, distancePerSquare: 5, distanceUnit: 'ft' };

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const radius = Math.hypot(dx, dy);

    let distancePx = radius;
    let labelAtX = endPoint.x;
    let labelAtY = endPoint.y;

    if (shapeType === 'circle') {
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);

        distancePx = radius;

    } else if (shapeType === 'square') {
        const halfSide = radius;
        let rx = startPoint.x, ry = startPoint.y;
        if (squareAnchor === 'center') {
            rx = startPoint.x - halfSide;
            ry = startPoint.y - halfSide;
        } else {
            rx = Math.min(startPoint.x, endPoint.x);
            ry = Math.min(startPoint.y, endPoint.y);
        }
        const side = halfSide * 2;
        ctx.beginPath();
        ctx.rect(rx, ry, side, side);
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        distancePx = side;

    } else if (shapeType === 'cone') {
        const angle = Math.atan2(dy, dx);
        const halfAngle = Math.PI / 4; // 90 degree cone
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.arc(startPoint.x, startPoint.y, radius, angle - halfAngle, angle + halfAngle);
        ctx.closePath();
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        distancePx = radius;

    } else if (shapeType === 'beam') {
        const angle = Math.atan2(dy, dx);
        const length = radius;
        const distPerCell = activeGrid.distancePerSquare || activeGrid.feetPerSquare || 5;
        const pxPerUnit = (activeGrid.size * (activeGrid.scale || 1.0)) / distPerCell;
        const halfWidth = ((beamWidth || 5) * pxPerUnit) / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const perpX = -sin * halfWidth;
        const perpY = cos * halfWidth;

        ctx.beginPath();
        ctx.moveTo(startPoint.x + perpX, startPoint.y + perpY);
        ctx.lineTo(startPoint.x + cos * length + perpX, startPoint.y + sin * length + perpY);
        ctx.lineTo(startPoint.x + cos * length - perpX, startPoint.y + sin * length - perpY);
        ctx.lineTo(startPoint.x - perpX, startPoint.y - perpY);
        ctx.closePath();
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

        distancePx = length;

    } else {
        // Default: line (polyline if points array given, else simple line)
        const polyPoints = (Array.isArray(points) && points.length >= 2) ? points : [startPoint, endPoint];
        const bentSegments = typeof resolveRulerPortalBendingFn === 'function' 
            ? resolveRulerPortalBendingFn(polyPoints) 
            : [{ points: polyPoints, length: Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y), isTerminal: true }];

        let totalLen = 0;
        let lastPt = polyPoints[polyPoints.length - 1];

        bentSegments.forEach(seg => {
            ctx.beginPath();
            ctx.moveTo(seg.points[0].x, seg.points[0].y);
            for (let i = 1; i < seg.points.length; i++) {
                ctx.lineTo(seg.points[i].x, seg.points[i].y);
            }
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.7;
            ctx.stroke();

            if (seg.isPortalJunction) {
                ctx.save();
                ctx.beginPath();
                const pt = seg.points[seg.points.length - 1];
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#38bdf8';
                ctx.globalAlpha = 0.9;
                ctx.fill();
                ctx.restore();
            }

            if (seg.isTerminal) {
                ctx.beginPath();
                const pt = seg.points[seg.points.length - 1];
                ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.globalAlpha = 1.0;
                ctx.fill();
                lastPt = pt;
            }
            totalLen += seg.length;
        });

        distancePx = totalLen;
        labelAtX = lastPt.x;
        labelAtY = lastPt.y;
    }

    // Distance label — shown only during live drawing
    if (showDistance && distancePx > 0) {
        const distInfo = calcDistanceFormatted(distancePx, activeGrid);
        const label = distInfo.label;
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.font = 'bold 13px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width;
        const padX = 8;
        const padY = 4;
        const pillW = tw + padX * 2;
        const pillH = 22;
        const pillX = labelAtX + 14;
        const pillY = labelAtY - 22;
        const r = pillH / 2;

        ctx.fillStyle = 'rgba(15, 15, 20, 0.82)';
        ctx.beginPath();
        ctx.moveTo(pillX - pillW / 2 + r, pillY - pillH / 2);
        ctx.arcTo(pillX + pillW / 2, pillY - pillH / 2, pillX + pillW / 2, pillY + pillH / 2, r);
        ctx.arcTo(pillX + pillW / 2, pillY + pillH / 2, pillX - pillW / 2, pillY + pillH / 2, r);
        ctx.arcTo(pillX - pillW / 2, pillY + pillH / 2, pillX - pillW / 2, pillY - pillH / 2, r);
        ctx.arcTo(pillX - pillW / 2, pillY - pillH / 2, pillX + pillW / 2, pillY - pillH / 2, r);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = fillColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, pillX, pillY);
        ctx.restore();
    }

    // Owner label
    if (ownerUsername) {
        ctx.font = '11px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const lx = (startPoint.x + endPoint.x) / 2;
        const ly = Math.min(startPoint.y, endPoint.y) - 2;
        const tw = ctx.measureText(ownerUsername).width + 8;
        ctx.fillRect(lx - tw / 2, ly - 13, tw, 14);
        ctx.fillStyle = fillColor;
        ctx.fillText(ownerUsername, lx, ly);
    }

    ctx.restore();
}
