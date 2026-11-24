// DnDForged Canvas Dynamic Lighting & Visibility Polygon Raycasting Subsystem
// Computes 2D line-of-sight visibility polygons against walls, doors, windows, and directional light cones

export function getWallCoordinatesForRaycasting(wall, originX, originY) {
    if (!wall) return null;
    if (wall.type === 'window' && (wall.isSeeThrough || wall.isDrawn === false)) {
        return null; // See-through windows do not block light or vision
    }
    if ((wall.type === 'door' || wall.type === 'window') && wall.isOpen) {
        if (wall.hasHinge) {
            // Compute rotated segment
            const angleRad = ((wall.swingAngle || 90) * Math.PI) / 180;
            const pivotX = wall.hingeEndpoint === 1 ? wall.x1 : wall.x2;
            const pivotY = wall.hingeEndpoint === 1 ? wall.y1 : wall.y2;
            const otherX = wall.hingeEndpoint === 1 ? wall.x2 : wall.x1;
            const otherY = wall.hingeEndpoint === 1 ? wall.y2 : wall.y1;

            // Rotate other point around pivot
            const dx = otherX - pivotX;
            const dy = otherY - pivotY;
            const rx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
            const ry = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

            return {
                x1: pivotX,
                y1: pivotY,
                x2: pivotX + rx,
                y2: pivotY + ry
            };
        }
        return null; // Open door without hinge does not block light
    }

    // Check one-way vision/light blocking
    if (wall.oneWay && wall.oneWay !== 'none' && originX !== undefined && originY !== undefined) {
        const segDx = wall.x2 - wall.x1;
        const segDy = wall.y2 - wall.y1;
        const midX = (wall.x1 + wall.x2) / 2;
        const midY = (wall.y1 + wall.y2) / 2;
        const nx = -segDy;
        const ny = segDx;
        const dot = (originX - midX) * nx + (originY - midY) * ny;
        if (wall.oneWay === 'left' && dot > 0) return null;
        if (wall.oneWay === 'right' && dot < 0) return null;
    }

    return {
        x1: wall.x1,
        y1: wall.y1,
        x2: wall.x2,
        y2: wall.y2
    };
}

export function getLineIntersection(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy) {
    const r_w = r_dx - r_px;
    const r_h = r_dy - r_py;
    const s_w = s_dx - s_px;
    const s_h = s_dy - s_py;

    const denom = r_w * s_h - r_h * s_w;
    if (denom === 0) return null;

    const u = ((s_px - r_px) * r_h - (s_py - r_py) * r_w) / denom;
    const t = ((s_px - r_px) * s_h - (s_py - r_py) * s_w) / denom;

    if (t >= 0.0001 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: r_px + t * r_w,
            y: r_py + t * r_h,
            t: t
        };
    }
    return null;
}

export function computeVisibilityPolygon(
    cx,
    cy,
    sightRadius,
    width,
    height,
    beamArc = 360,
    beamFacing = 0,
    ignoreWallFilter = null,
    wallsOverride = null,
    walls = [],
    spatialIndex = null
) {
    const isAngular = typeof beamArc === 'number' && beamArc < 360 && beamArc > 0;
    const facingRad = (((beamFacing || 0) * Math.PI) / 180) % (Math.PI * 2);
    const normFacing = facingRad < 0 ? facingRad + Math.PI * 2 : facingRad;
    const arcRad = (beamArc * Math.PI) / 180;
    const halfArc = arcRad / 2;

    const isAngleInCone = (ang) => {
        if (!isAngular) return true;
        let diff = (ang - normFacing) % (Math.PI * 2);
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        return Math.abs(diff) <= halfArc + 0.001;
    };

    const angles = new Set();

    // Setup boundary walls for ray casting
    const borderWalls = [
        { x1: 0, y1: 0, x2: width, y2: 0 },
        { x1: width, y1: 0, x2: width, y2: height },
        { x1: width, y1: height, x2: 0, y2: height },
        { x1: 0, y1: height, x2: 0, y2: 0 }
    ];

    // Spatial AABB bounding box for rapid O(W_local) pruning
    const boundPad = 15;
    const minX = cx - sightRadius - boundPad;
    const maxX = cx + sightRadius + boundPad;
    const minY = cy - sightRadius - boundPad;
    const maxY = cy + sightRadius + boundPad;
    const shouldPrune = sightRadius < 50000;

    const processedWalls = [];
    const indexToUse = spatialIndex || (wallsOverride && wallsOverride.spatialIndex);
    const rawWalls =
        indexToUse && typeof indexToUse.querySightRadius === 'function' && !wallsOverride
            ? indexToUse.querySightRadius(cx, cy, sightRadius)
            : Array.isArray(wallsOverride)
              ? wallsOverride
              : walls;
    const wallsToUse = Array.isArray(rawWalls) ? rawWalls : [];

    wallsToUse.forEach((w) => {
        if (!w || (typeof ignoreWallFilter === 'function' && ignoreWallFilter(w))) return;
        const coords = getWallCoordinatesForRaycasting(w, cx, cy);
        if (coords) {
            // Filter out degenerate zero-length wall segments (points)
            if (coords.x1 === coords.x2 && coords.y1 === coords.y2) {
                return;
            }
            if (shouldPrune) {
                const wMinX = Math.min(coords.x1, coords.x2);
                const wMaxX = Math.max(coords.x1, coords.x2);
                const wMinY = Math.min(coords.y1, coords.y2);
                const wMaxY = Math.max(coords.y1, coords.y2);
                if (wMaxX < minX || wMinX > maxX || wMaxY < minY || wMinY > maxY) {
                    return;
                }
            }
            processedWalls.push({
                x1: coords.x1,
                y1: coords.y1,
                x2: coords.x2,
                y2: coords.y2,
                isDoor: w.isDoor,
                isOpen: w.isOpen
            });
        }
    });
    const allWalls = [...processedWalls, ...borderWalls];

    if (isAngular) {
        let startAng = (normFacing - halfArc) % (Math.PI * 2);
        if (startAng < 0) startAng += Math.PI * 2;
        let endAng = (normFacing + halfArc) % (Math.PI * 2);
        if (endAng < 0) endAng += Math.PI * 2;
        angles.add(startAng);
        angles.add(endAng);

        const steps = Math.max(12, Math.round(beamArc / 6));
        const stepRad = arcRad / steps;
        for (let s = 0; s <= steps; s++) {
            let a = (normFacing - halfArc + s * stepRad) % (Math.PI * 2);
            if (a < 0) a += Math.PI * 2;
            angles.add(a);
        }
    } else {
        const boundaryPoints = [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height }
        ];
        boundaryPoints.forEach((p) => {
            let angle = Math.atan2(p.y - cy, p.x - cx);
            if (angle < 0) angle += Math.PI * 2;
            angles.add(angle);
        });
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
            angles.add(a);
        }
    }

    const seen = new Set();
    allWalls.forEach((w) => {
        [
            { x: w.x1, y: w.y1 },
            { x: w.x2, y: w.y2 }
        ].forEach((p) => {
            const key = `${Math.round(p.x)},${Math.round(p.y)}`;
            if (!seen.has(key)) {
                seen.add(key);
                let angle = Math.atan2(p.y - cy, p.x - cx);
                if (angle < 0) angle += Math.PI * 2;
                if (isAngleInCone(angle)) {
                    angles.add(angle);
                    let aMinus = angle - 0.0001;
                    if (aMinus < 0) aMinus += Math.PI * 2;
                    if (isAngleInCone(aMinus)) angles.add(aMinus);
                    let aPlus = angle + 0.0001;
                    if (aPlus >= Math.PI * 2) aPlus -= Math.PI * 2;
                    if (isAngleInCone(aPlus)) angles.add(aPlus);
                }
            }
        });
    });

    allWalls.forEach((wall) => {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const fx = wall.x1 - cx;
        const fy = wall.y1 - cy;
        const a = dx * dx + dy * dy;
        if (a === 0) return;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - sightRadius * sightRadius;
        const discriminant = b * b - 4 * a * c;
        if (discriminant > 0) {
            const sqrtD = Math.sqrt(discriminant);
            const t1 = (-b - sqrtD) / (2 * a);
            const t2 = (-b + sqrtD) / (2 * a);
            [t1, t2].forEach((t) => {
                if (t >= 0 && t <= 1) {
                    const ix = wall.x1 + t * dx;
                    const iy = wall.y1 + t * dy;
                    let angle = Math.atan2(iy - cy, ix - cx);
                    if (angle < 0) angle += Math.PI * 2;
                    if (isAngleInCone(angle)) {
                        angles.add(angle);
                        let aMinus = angle - 0.0001;
                        if (aMinus < 0) aMinus += Math.PI * 2;
                        if (isAngleInCone(aMinus)) angles.add(aMinus);
                        let aPlus = angle + 0.0001;
                        if (aPlus >= Math.PI * 2) aPlus -= Math.PI * 2;
                        if (isAngleInCone(aPlus)) angles.add(aPlus);
                    }
                }
            });
        }
    });

    let sortedAngles;
    if (isAngular) {
        const startAng = (normFacing - halfArc) % (Math.PI * 2);
        const normStart = startAng < 0 ? startAng + Math.PI * 2 : startAng;
        sortedAngles = Array.from(angles)
            .map((ang) => {
                let rel = (ang - normStart) % (Math.PI * 2);
                if (rel < 0) rel += Math.PI * 2;
                return { ang, rel };
            })
            .filter((item) => item.rel <= arcRad + 0.002)
            .sort((a, b) => a.rel - b.rel)
            .map((item) => item.ang);
    } else {
        sortedAngles = Array.from(angles).sort((a, b) => a - b);
    }

    const polygon = [];
    if (isAngular) {
        polygon.push({ x: cx, y: cy });
    }

    sortedAngles.forEach((angle) => {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const rx = cx + dx * sightRadius;
        const ry = cy + dy * sightRadius;

        let closestT = 1.0;
        let intersectX = rx;
        let intersectY = ry;

        allWalls.forEach((wall) => {
            const intersect = getLineIntersection(cx, cy, rx, ry, wall.x1, wall.y1, wall.x2, wall.y2);
            if (intersect && intersect.t < closestT) {
                closestT = intersect.t;
                intersectX = intersect.x;
                intersectY = intersect.y;
            }
        });

        polygon.push({ x: intersectX, y: intersectY });
    });

    if (isAngular) {
        polygon.push({ x: cx, y: cy });
    }

    return polygon;
}
