// DnDForged Canvas Portals Subsystem
// Manages portal geometry, non-euclidean coordinate mapping, ruler portal bending, and rendering

import {
    isPointInsideGeometry,
    findEarliestPathIntersection,
    checkLineIntersection,
    checkLineCircleIntersection,
    distToSegmentSq,
    calcGeometryCenter
} from './vtt-canvas-traps.js';

import { drawMeasurementTemplate } from './vtt-canvas-measure.js';
import { isHexGrid, getNearestHexFeatures } from './vtt-canvas-grid-renderer.js';
import { escapeHtml } from '../vtt-utils.js';

export function calcPortalCenter(portal) {
    if (!portal || !portal.geom) return { x: 0, y: 0 };
    return calcGeometryCenter(portal.shape, portal.geom);
}

export function getPortalNormalVector(portal, approachVector = null) {
    if (!portal || !portal.geom) return { dx: 0, dy: -1 };

    // If radial/omnidirectional portal and approachVector is provided
    if (portal.isRadial && approachVector) {
        const len = Math.hypot(approachVector.dx, approachVector.dy) || 1;
        return { dx: approachVector.dx / len, dy: approachVector.dy / len };
    }

    let dx = 0,
        dy = -1;
    if (portal.facingAngle !== undefined && portal.facingAngle !== null && !isNaN(portal.facingAngle)) {
        const rad = (portal.facingAngle * Math.PI) / 180;
        dx = Math.cos(rad);
        dy = Math.sin(rad);
    } else if (portal.shape === 'line') {
        const g = portal.geom;
        const lx = g.x2 - g.x1;
        const ly = g.y2 - g.y1;
        const len = Math.hypot(lx, ly) || 1;
        dx = -ly / len;
        dy = lx / len;
    } else {
        dx = 0;
        dy = -1;
    }

    if (portal.viewSideFlipped) {
        dx = -dx;
        dy = -dy;
    }
    if (Object.is(dx, -0)) dx = 0;
    if (Object.is(dy, -0)) dy = 0;
    return { dx, dy };
}

export function getPortalRotationHandlePos(portal) {
    if (!portal || !portal.geom) return null;
    const center = calcPortalCenter(portal);
    const norm = getPortalNormalVector(portal);
    let radius = 30;
    const g = portal.geom;
    if (portal.shape === 'circle') radius = g.r !== undefined ? g.r : Math.hypot(g.endX - g.cx, g.endY - g.cy) || 30;
    else if (portal.shape === 'rect') radius = Math.hypot(g.w || 50, g.h || 50) / 2;
    else if (portal.shape === 'line') radius = Math.hypot(g.x2 - g.x1 || 0, g.y2 - g.y1 || 0) / 2;
    else if (portal.shape === 'polygon' && Array.isArray(g.points) && g.points.length > 0) {
        radius = g.points.reduce((max, p) => Math.max(max, Math.hypot(p.x - center.x, p.y - center.y)), 30);
    }
    const dist = Math.max(35, radius + 24);
    return {
        center,
        x: center.x + norm.dx * dist,
        y: center.y + norm.dy * dist,
        angleDeg: Math.round(((Math.atan2(norm.dy, norm.dx) * 180) / Math.PI + 360) % 360)
    };
}

export function checkOneWayPortalEntry(portal, fromPos, toPos) {
    if (!portal.isOneWay || portal.isRadial) return true;
    const norm = getPortalNormalVector(portal);
    const moveDx = toPos.x - fromPos.x;
    const moveDy = toPos.y - fromPos.y;
    const dot = moveDx * norm.dx + moveDy * norm.dy;
    return dot < 0; // Negative dot product means entering facing the active face
}

export function isTokenCollidingWithPortal(token, portal, fromPos = null, toPos = null, getTokenDrawDimensions = null) {
    if (!token || !portal || !portal.geom) return false;
    const g = portal.geom;
    const { drawW, drawH } = getTokenDrawDimensions ? getTokenDrawDimensions(token) : { drawW: 50, drawH: 50 };

    let evalCenter;
    if (toPos && toPos.x !== undefined && toPos.y !== undefined) {
        evalCenter = toPos;
    } else if (fromPos && fromPos.x !== undefined && fromPos.y !== undefined) {
        evalCenter = fromPos;
    } else {
        evalCenter = { x: token.x + drawW / 2, y: token.y + drawH / 2 };
    }

    if (portal.shape === 'line') {
        if (fromPos && toPos) {
            const hit = checkLineIntersection(fromPos, toPos, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
            if (hit) return true;
        }
        const effectiveRadius = Math.max(4, Math.min(drawW, drawH) / 2);
        return distToSegmentSq(evalCenter, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }) <= (effectiveRadius * effectiveRadius);
    } else if (portal.shape === 'rect') {
        if (isPointInsideGeometry(evalCenter, 'rect', g)) return true;
        if (fromPos && toPos && findEarliestPathIntersection(fromPos, toPos, 'rect', g)) return true;
        return false;
    } else if (portal.shape === 'circle') {
        const r = g.r !== undefined ? g.r : Math.hypot(g.endX - g.cx, g.endY - g.cy) || 25;
        const dist = Math.hypot(evalCenter.x - g.cx, evalCenter.y - g.cy);
        if (dist <= r) return true;
        if (fromPos && toPos && checkLineCircleIntersection(fromPos, toPos, { x: g.cx, y: g.cy }, r)) return true;
        return false;
    } else if (portal.shape === 'polygon') {
        if (isPointInsideGeometry(evalCenter, 'polygon', g)) return true;
        if (fromPos && toPos && findEarliestPathIntersection(fromPos, toPos, 'polygon', g)) return true;
        return false;
    }

    return false;
}

export function calcSpatialPortalDestination(
    sourcePortal,
    targetPortal,
    fromCenter,
    toCenter,
    targetMap = null,
    token = null,
    options = {}
) {
    if (!targetPortal) return { x: 0, y: 0 };
    const {
        grid = { size: 50, scale: 1 },
        getTokenDrawDimensions = (t) => ({ drawW: 50, drawH: 50 }),
        isHexGrid = (type) => false,
        getNearestHexFeatures = null
    } = options;

    const centerA = sourcePortal ? calcPortalCenter(sourcePortal) : calcPortalCenter(targetPortal);
    const normA = sourcePortal ? getPortalNormalVector(sourcePortal) : { dx: 0, dy: -1 };
    const centerB = calcPortalCenter(targetPortal);
    const normB = getPortalNormalVector(targetPortal);

    const targetGrid = targetMap?.grid || grid;
    const unitSize =
        (targetGrid && targetGrid.size ? targetGrid.size : 50) *
        (targetGrid && targetGrid.scale ? targetGrid.scale : 1);

    const isReflect =
        sourcePortal &&
        (sourcePortal.reflectMode === 'one-way' ||
            sourcePortal.reflectMode === 'two-way' ||
            targetPortal.reflectMode === 'two-way');

    function isPadPortal(p) {
        if (!p || !p.geom) return false;
        if (p.shape === 'rect') {
            return (p.geom.w || 50) <= unitSize * 1.25 && (p.geom.h || 50) <= unitSize * 1.25;
        }
        if (p.shape === 'circle') {
            const r = p.geom.r !== undefined ? p.geom.r : 25;
            return r <= unitSize * 0.65;
        }
        return false;
    }

    let targetCenterX, targetCenterY;

    const isSinglePad = isPadPortal(sourcePortal) || isPadPortal(targetPortal);
    if (isSinglePad) {
        // Dedicated 1-square pad: map cleanly center-to-center
        targetCenterX = centerB.x;
        targetCenterY = centerB.y;
    } else if (isReflect || (sourcePortal?.isRadial && targetPortal?.isRadial)) {
        // Direct 1:1 offset translation (top-down pits, shafts, or radial pads)
        const relX = toCenter.x - centerA.x;
        const relY = toCenter.y - centerA.y;
        targetCenterX = centerB.x + relX;
        targetCenterY = centerB.y + relY;
    } else {
        // Relative orientation rotation between Portal A and Portal B (angleB - angleA)
        const angleA = Math.atan2(normA.dy, normA.dx);
        const angleB = Math.atan2(normB.dy, normB.dx);
        const thetaRot = angleB - angleA;

        const relX = toCenter.x - centerA.x;
        const relY = toCenter.y - centerA.y;
        const cosRot = Math.cos(thetaRot);
        const sinRot = Math.sin(thetaRot);
        const rotX = relX * cosRot - relY * sinRot;
        const rotY = relX * sinRot + relY * cosRot;

        targetCenterX = centerB.x + rotX;
        targetCenterY = centerB.y + rotY;

        // Only push forward if destination is a 1D line doorway:
        if (targetPortal.shape === 'line') {
            if (sourcePortal && sourcePortal.shape === 'line') {
                const distPast = (targetCenterX - centerB.x) * normB.dx + (targetCenterY - centerB.y) * normB.dy;
                if (distPast < unitSize * 0.4) {
                    const push = unitSize * 0.5 - distPast;
                    targetCenterX += normB.dx * push;
                    targetCenterY += normB.dy * push;
                }
            } else {
                // Stepping from an area pad into a line doorway: place token in front of doorway
                targetCenterX = centerB.x + normB.dx * (unitSize * 0.6);
                targetCenterY = centerB.y + normB.dy * (unitSize * 0.6);
            }
        }
    }

    const { drawW, drawH } = token ? getTokenDrawDimensions(token) : { drawW: unitSize, drawH: unitSize };
    if (isHexGrid && isHexGrid(targetGrid?.type) && getNearestHexFeatures) {
        const hex = getNearestHexFeatures(targetCenterX, targetCenterY, targetGrid, unitSize);
        return { x: hex.cx - drawW / 2, y: hex.cy - drawH / 2 };
    }
    const offX = targetGrid?.offsetX || 0;
    const offY = targetGrid?.offsetY || 0;
    const snappedX = Math.round((targetCenterX - drawW / 2 - offX) / unitSize) * unitSize + offX;
    const snappedY = Math.round((targetCenterY - drawH / 2 - offY) / unitSize) * unitSize + offY;
    return { x: snappedX, y: snappedY };
}

export function triggerTokenStepThroughAnimation(
    tokenId,
    startX,
    startY,
    endX,
    endY,
    duration = 260,
    tokenAnimations = {},
    onAnimate = null
) {
    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist < 1) return;
    tokenAnimations[tokenId] = {
        startX,
        startY,
        endX,
        endY,
        startTime: Date.now(),
        duration,
        totalDist: dist,
        segments: [{ start: { x: startX, y: startY }, end: { x: endX, y: endY }, dist }],
        currentPos: { x: startX, y: startY }
    };
    if (onAnimate) onAnimate();
}

export function precacheConnectedMapAssets(
    currentPortals,
    campaignState,
    currentMapId,
    imageCache = {},
    getSafeVttUrl = null
) {
    if (!Array.isArray(currentPortals) || !campaignState?.maps) return;
    const connectedMapIds = new Set();
    currentPortals.forEach((p) => {
        if (p.targetMapId && p.targetMapId !== currentMapId) {
            connectedMapIds.add(p.targetMapId);
        }
    });

    const safeUrlFn =
        getSafeVttUrl || (typeof window !== 'undefined' && window.getSafeVttUrl ? window.getSafeVttUrl : (u) => u);

    connectedMapIds.forEach((mapId) => {
        const tMap = campaignState.maps[mapId];
        if (!tMap) return;
        if (tMap.mapImage && typeof Image !== 'undefined') {
            const safeUrl = safeUrlFn(tMap.mapImage);
            if (!imageCache[safeUrl] && !imageCache[tMap.mapImage]) {
                const img = new Image();
                img.src = safeUrl;
                imageCache[safeUrl] = img;
                imageCache[tMap.mapImage] = img;
            }
        }
        if (tMap.tokens && typeof Image !== 'undefined') {
            Object.values(tMap.tokens).forEach((tok) => {
                const imgUrl = tok.img || tok.customImg || tok.tokenImg;
                if (imgUrl) {
                    const safeTokenUrl = safeUrlFn(imgUrl);
                    if (!imageCache[safeTokenUrl] && !imageCache[imgUrl]) {
                        const tImg = new Image();
                        tImg.src = safeTokenUrl;
                        imageCache[safeTokenUrl] = tImg;
                        imageCache[imgUrl] = tImg;
                    }
                }
            });
        }
    });
}

export function resolveRulerPortalBending(polyPoints, portals, currentMapId) {
    if (!Array.isArray(polyPoints) || polyPoints.length < 2) return [];
    if (!Array.isArray(portals) || portals.length === 0) {
        let totalLen = 0;
        for (let i = 1; i < polyPoints.length; i++) {
            totalLen += Math.hypot(polyPoints[i].x - polyPoints[i - 1].x, polyPoints[i].y - polyPoints[i - 1].y);
        }
        return [{ points: polyPoints, length: totalLen, isTerminal: true }];
    }

    const visitedPortalIds = new Set();
    const segments = [];
    let currentLeg = [polyPoints[0]];
    let currentLegLen = 0;

    for (let i = 0; i < polyPoints.length - 1; i++) {
        const p1 = polyPoints[i];
        const p2 = polyPoints[i + 1];

        // Find earliest portal intersection along p1 -> p2
        let bestHit = null;
        let hitPortal = null;

        for (const po of portals) {
            if (!po.targetPortalId || !po.geom || visitedPortalIds.has(po.id)) continue;
            if (po.isOneWay && !checkOneWayPortalEntry(po, p1, p2)) continue;
            const hit = findEarliestPathIntersection(p1, p2, po.shape, po.geom);
            if (hit && (!bestHit || hit.t < bestHit.t)) {
                bestHit = hit;
                hitPortal = po;
            }
        }

        if (bestHit && hitPortal) {
            visitedPortalIds.add(hitPortal.id);
            currentLeg.push({ x: bestHit.x, y: bestHit.y });
            currentLegLen += Math.hypot(bestHit.x - p1.x, bestHit.y - p1.y);
            const isInterMap = hitPortal.targetMapId && hitPortal.targetMapId !== currentMapId;
            const remDist = Math.hypot(p2.x - bestHit.x, p2.y - bestHit.y);

            if (isInterMap) {
                segments.push({
                    points: currentLeg,
                    length: currentLegLen + remDist,
                    isTerminal: true
                });
                return segments;
            } else {
                const targetPortal = portals.find((p) => p.id === hitPortal.targetPortalId);
                if (targetPortal) {
                    segments.push({
                        points: currentLeg,
                        length: currentLegLen,
                        isPortalJunction: true
                    });

                    const srcCenter = calcPortalCenter(hitPortal);
                    const srcNorm = getPortalNormalVector(hitPortal);
                    const srcTangent = { dx: -srcNorm.dy, dy: srcNorm.dx };
                    const targetCenter = calcPortalCenter(targetPortal);
                    const targetNorm = getPortalNormalVector(targetPortal);
                    const targetTangent = { dx: -targetNorm.dy, dy: targetNorm.dx };

                    const relX = bestHit.x - srcCenter.x;
                    const relY = bestHit.y - srcCenter.y;
                    const lateralOffset = relX * srcTangent.dx + relY * srcTangent.dy;
                    const exitThresholdPoint = {
                        x: targetCenter.x + targetTangent.dx * lateralOffset,
                        y: targetCenter.y + targetTangent.dy * lateralOffset
                    };

                    const incomingAngle = Math.atan2(p2.y - bestHit.y, p2.x - bestHit.x);
                    const srcAngle = Math.atan2(srcNorm.dy, srcNorm.dx);
                    const targetAngle = Math.atan2(targetNorm.dy, targetNorm.dx);
                    const angleDelta = targetAngle - srcAngle;
                    const outAngle = incomingAngle + angleDelta;

                    const exitEndPoint = {
                        x: exitThresholdPoint.x + Math.cos(outAngle) * remDist,
                        y: exitThresholdPoint.y + Math.sin(outAngle) * remDist
                    };

                    currentLeg = [exitThresholdPoint, exitEndPoint];
                    currentLegLen = remDist;
                    continue;
                } else {
                    currentLegLen += remDist;
                }
            }
        } else {
            currentLeg.push(p2);
            currentLegLen += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }
    }

    if (currentLeg.length >= 2) {
        segments.push({
            points: currentLeg,
            length: currentLegLen,
            isTerminal: true
        });
    }

    return segments.length > 0 ? segments : [{ points: polyPoints, length: currentLegLen, isTerminal: true }];
}

export function resolveTokenImageSrc(token, campaignState = null) {
    if (!token) return null;
    if (token.img) return token.img;
    const charId = token.characterId;
    if (charId && campaignState?.characters?.[charId]) {
        const c = campaignState.characters[charId];
        if (c.tokenImages && c.activeTokenIndex !== undefined && c.tokenImages[c.activeTokenIndex]?.url) {
            return c.tokenImages[c.activeTokenIndex].url;
        }
        if (c.img) return c.img;
        if (c.avatar) return c.avatar;
        if (c.tokenUrl) return c.tokenUrl;
        if (c.monsterData?.tokenUrl) return c.monsterData.tokenUrl;
        if (c.monsterData?.source && c.name) {
            const cleanName =
                typeof Parser !== 'undefined'
                    ? Parser.nameToTokenName(c.name)
                    : (c.name || '').replace(/"/g, '').trim();
            return `img/bestiary/tokens/${c.monsterData.source}/${cleanName}.webp`;
        }
    }
    return null;
}

export function getOrLoadTokenImage(token, options = {}) {
    if (!token) return null;
    const { campaignState = null, imageCache = {}, renderAll = null, getSafeVttUrl = (u) => u } = options;
    if (token.id && typeof document !== 'undefined') {
        const domNode = document.getElementById('asset_node_' + token.id);
        if (domNode && domNode.tagName === 'IMG' && domNode.complete && domNode.naturalWidth > 0) {
            return domNode;
        }
        if (domNode && domNode.tagName === 'VIDEO' && domNode.readyState >= 2) {
            return domNode;
        }
    }
    const imgSrc = resolveTokenImageSrc(token, campaignState);
    if (imgSrc) {
        const safeUrl = typeof getSafeVttUrl === 'function' ? getSafeVttUrl(imgSrc) : imgSrc;
        const getImage = (u) => (typeof imageCache?.get === 'function' ? imageCache.get(u) : imageCache?.[u]);
        const setImage = (u, val) => {
            if (typeof imageCache?.set === 'function') imageCache.set(u, val);
            else if (imageCache) imageCache[u] = val;
        };

        const cached = getImage(imgSrc) || getImage(safeUrl);
        if (cached && cached.complete && cached.naturalWidth > 0) {
            return cached;
        }
        if (!cached && typeof Image !== 'undefined') {
            const img = new Image();
            img.src = safeUrl;
            img.onload = () => {
                if (renderAll) renderAll();
            };
            setImage(imgSrc, img);
            setImage(safeUrl, img);
        }
    }
    return null;
}

export function drawTargetRoomContent(
    ctx,
    targetMap,
    targetMapId,
    targetW,
    targetH,
    targetTokens,
    targetWalls,
    centerA,
    centerB,
    options = {}
) {
    const {
        currentMapId = null,
        vtt = {},
        imageCache = {},
        grid = { size: 50, scale: 1 },
        getOrLoadTokenImage: customGetImage = null,
        getTokenDrawDimensions = options.getTokenDrawDimensions ||
            ((t) => {
                const unit = (grid.size || 50) * (grid.scale || 1);
                const sz = parseFloat(t?.size) || 1;
                const w = unit * sz;
                const h = unit * sz;
                return { drawW: w, drawH: h, tokenRadius: w / 2 };
            }),
        renderAll = () => {},
        getSafeVttUrl = (u) => u
    } = options;

    const resolvedTokens = Array.isArray(targetTokens)
        ? targetTokens
        : targetTokens && typeof targetTokens === 'object'
          ? Object.values(targetTokens)
          : targetMap?.tokens
            ? Array.isArray(targetMap.tokens)
                ? targetMap.tokens
                : Object.values(targetMap.tokens)
            : [];
    const resolvedWalls = Array.isArray(targetWalls) ? targetWalls : targetMap?.walls || [];

    const tokenImgFn =
        customGetImage ||
        ((t) =>
            getOrLoadTokenImage(t, {
                campaignState: options.campaignState || vtt.campaignState,
                imageCache,
                renderAll,
                getSafeVttUrl
            }));

    let bgDrawn = false;
    const campaignState = options.campaignState || vtt.campaignState;
    const currentMap = options.currentMap || campaignState?.maps?.[currentMapId];
    const mapImgSrc = targetMap?.mapImage || (targetMapId === currentMapId ? currentMap?.mapImage : null);
    if (mapImgSrc) {
        const safeUrl = typeof getSafeVttUrl === 'function' ? getSafeVttUrl(mapImgSrc) : mapImgSrc;
        const getImage = (u) => (typeof imageCache?.get === 'function' ? imageCache.get(u) : imageCache?.[u]);
        const setImage = (u, val) => {
            if (typeof imageCache?.set === 'function') imageCache.set(u, val);
            if (imageCache) imageCache[u] = val;
        };

        let img = getImage(safeUrl) || getImage(mapImgSrc);
        if (!img && targetMapId === currentMapId && typeof document !== 'undefined') {
            const bgEl = document.querySelector('#vtt-map-bg-container img');
            if (bgEl && bgEl.complete && bgEl.naturalWidth > 0) img = bgEl;
        }
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, targetW, targetH);
            bgDrawn = true;
        } else if (!getImage(mapImgSrc) && !getImage(safeUrl) && typeof Image !== 'undefined') {
            const newImg = new Image();
            newImg.src = safeUrl;
            newImg.onload = () => {
                if (typeof renderAll === 'function') renderAll();
            };
            setImage(mapImgSrc, newImg);
            setImage(safeUrl, newImg);
        }
    }

    const mapAssets = resolvedTokens.filter((t) => t.layer === 'map' || t.isBackground);
    if (mapAssets.length > 0) {
        mapAssets.forEach((mAsset) => {
            const aImg = tokenImgFn(mAsset);
            const { drawW, drawH } = getTokenDrawDimensions(mAsset);
            if (aImg) {
                ctx.save();
                ctx.translate(mAsset.x + drawW / 2, mAsset.y + drawH / 2);
                if (mAsset.rotation) ctx.rotate((mAsset.rotation * Math.PI) / 180);
                ctx.drawImage(aImg, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
                bgDrawn = true;
            }
        });
    }

    if (!bgDrawn) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, targetW, targetH);
    }

    const tGrid = targetMap?.grid || grid;
    const gSize = (tGrid.size || 50) * (tGrid.scale || 1.0);
    if (gSize > 10) {
        ctx.save();
        ctx.strokeStyle = tGrid.color || '#ffffff';
        ctx.globalAlpha = (tGrid.opacity !== undefined ? tGrid.opacity : 0.25) * 0.7;
        ctx.lineWidth = 1;
        for (let x = 0; x <= targetW; x += gSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, targetH);
            ctx.stroke();
        }
        for (let y = 0; y <= targetH; y += gSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(targetW, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    if (Array.isArray(resolvedWalls) && resolvedWalls.length > 0) {
        ctx.save();
        resolvedWalls.forEach((w) => {
            if (w.isOpen) return;
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            if (w.isDoor) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3.5;
            } else if (w.isWindow) {
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2.5;
            } else {
                ctx.strokeStyle = w.color || '#475569';
                ctx.lineWidth = w.thickness || 3;
            }
            ctx.lineCap = 'round';
            ctx.stroke();
        });
        ctx.restore();
    }

    // Draw Target Room Persistent Shapes / Spell Areas visible through the portal
    const targetShapes = targetMap?.shapes ? Object.values(targetMap.shapes) : [];
    if (targetShapes.length > 0) {
        targetShapes.forEach((s) => {
            if (s.layer === 'gm' && vtt.role !== 'GM') return;
            try {
                drawMeasurementTemplate(
                    ctx,
                    s.startPoint,
                    s.endPoint,
                    s.shape,
                    s.squareAnchor,
                    s.beamWidth,
                    s.color,
                    s.ownerUsername,
                    null,
                    s.points || null,
                    false,
                    tGrid
                );
            } catch (shapeErr) {
                // Ignore transient shape render issues in target room projection
            }
        });
    }

    resolvedTokens.forEach((t) => {
        if (t.layer === 'gm' && vtt.role !== 'GM') return;
        if (t.isVisible === false && vtt.role !== 'GM') return;
        if (t.layer === 'map' || t.isBackground) return;

        if (targetMapId === currentMapId && Math.hypot(t.x - centerA.x, t.y - centerA.y) < 70) return;

        const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(t);
        const tImg = tokenImgFn(t);

        ctx.save();
        ctx.translate(t.x + drawW / 2, t.y + drawH / 2);
        if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
        if (t.flipX) ctx.scale(-1, 1);
        if (t.flipY) ctx.scale(1, -1);

        if (tImg) {
            if (!t.isAsset) {
                ctx.beginPath();
                ctx.arc(0, 0, tokenRadius, 0, Math.PI * 2);
                ctx.clip();
            }
            ctx.drawImage(tImg, -drawW / 2, -drawH / 2, drawW, drawH);
            if (!t.isAsset && !t.isBorderless) {
                ctx.strokeStyle = t.isPlayer ? 'rgba(0, 123, 255, 0.95)' : 'rgba(220, 53, 69, 0.95)';
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, tokenRadius, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient
                ? ctx.createRadialGradient(0, 0, tokenRadius * 0.2, 0, 0, tokenRadius)
                : null;
            if (grad) {
                if (t.isPlayer) {
                    grad.addColorStop(0, '#60a5fa');
                    grad.addColorStop(1, '#1d4ed8');
                } else {
                    grad.addColorStop(0, '#f87171');
                    grad.addColorStop(1, '#b91c1c');
                }
                ctx.fillStyle = t.color || grad;
            } else {
                ctx.fillStyle = t.color || (t.isPlayer ? '#1d4ed8' : '#b91c1c');
            }
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            const initial = (t.name || 'C').charAt(0).toUpperCase();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(tokenRadius * 0.85)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initial, 0, 0);
        }
        ctx.restore();
    });
}

function getLineIntersectionInternal(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy) {
    const r_w = r_dx - r_px;
    const r_h = r_dy - r_py;
    const s_w = s_dx - s_px;
    const s_h = s_dy - s_py;

    const denom = r_w * s_h - r_h * s_w;
    if (denom === 0) return null; // Parallel

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

export function getPortalAperturePoints(portal, observerPoint) {
    if (!portal || !portal.geom) return null;
    const g = portal.geom;
    if (portal.shape === 'line') {
        return { p1: { x: g.x1, y: g.y1 }, p2: { x: g.x2, y: g.y2 } };
    }
    const center = calcPortalCenter(portal);
    if (portal.shape === 'circle') {
        const r = g.r !== undefined ? g.r : 25;
        const dEye = Math.hypot(center.x - observerPoint.x, center.y - observerPoint.y) || 1;
        if (dEye <= r) {
            const norm = getPortalNormalVector(portal);
            return {
                p1: { x: center.x - norm.dy * r, y: center.y + norm.dx * r },
                p2: { x: center.x + norm.dy * r, y: center.y - norm.dx * r }
            };
        }
        const angC = Math.atan2(center.y - observerPoint.y, center.x - observerPoint.x);
        const alpha = Math.asin(Math.min(0.999, r / dEye));
        return {
            p1: { x: observerPoint.x + Math.cos(angC - alpha) * dEye, y: observerPoint.y + Math.sin(angC - alpha) * dEye },
            p2: { x: observerPoint.x + Math.cos(angC + alpha) * dEye, y: observerPoint.y + Math.sin(angC + alpha) * dEye }
        };
    }
    if (portal.shape === 'rect' || (portal.shape === 'polygon' && g?.points?.length >= 3)) {
        const pts = portal.shape === 'rect'
            ? [{ x: g.x, y: g.y }, { x: g.x + g.w, y: g.y }, { x: g.x + g.w, y: g.y + g.h }, { x: g.x, y: g.y + g.h }]
            : g.points;
        let minA = Infinity, maxA = -Infinity;
        let minP = pts[0], maxP = pts[0];
        const refA = Math.atan2(center.y - observerPoint.y, center.x - observerPoint.x);
        pts.forEach((p) => {
            const a = Math.atan2(p.y - observerPoint.y, p.x - observerPoint.x);
            let diff = (a - refA) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < minA) { minA = diff; minP = p; }
            if (diff > maxA) { maxA = diff; maxP = p; }
        });
        return { p1: minP, p2: maxP };
    }
    const norm = getPortalNormalVector(portal);
    return {
        p1: { x: center.x - norm.dy * 25, y: center.y + norm.dx * 25 },
        p2: { x: center.x + norm.dy * 25, y: center.y - norm.dx * 25 }
    };
}

export function computePortalSightFrustum(portal, sourceCenter, remainingSight) {
    const ap = getPortalAperturePoints(portal, sourceCenter);
    if (!ap) return null;
    const { p1, p2 } = ap;

    const d1X = p1.x - sourceCenter.x;
    const d1Y = p1.y - sourceCenter.y;
    const len1 = Math.hypot(d1X, d1Y) || 1;
    const e1 = {
        x: p1.x + (d1X / len1) * remainingSight,
        y: p1.y + (d1Y / len1) * remainingSight
    };

    const d2X = p2.x - sourceCenter.x;
    const d2Y = p2.y - sourceCenter.y;
    const len2 = Math.hypot(d2X, d2Y) || 1;
    const e2 = {
        x: p2.x + (d2X / len2) * remainingSight,
        y: p2.y + (d2Y / len2) * remainingSight
    };

    const ang1 = Math.atan2(e1.y - sourceCenter.y, e1.x - sourceCenter.x);
    const ang2 = Math.atan2(e2.y - sourceCenter.y, e2.x - sourceCenter.x);
    let span = (ang2 - ang1) % (Math.PI * 2);
    if (span < -Math.PI) span += Math.PI * 2;
    if (span > Math.PI) span -= Math.PI * 2;

    const steps = Math.max(4, Math.round(Math.abs(span) * 8));
    const arcPts = [];
    const totalDist = Math.max(len1, len2) + remainingSight;
    for (let s = 1; s < steps; s++) {
        const a = ang1 + (span * s) / steps;
        arcPts.push({
            x: sourceCenter.x + Math.cos(a) * totalDist,
            y: sourceCenter.y + Math.sin(a) * totalDist
        });
    }

    return [p1, e1, ...arcPts, e2, p2];
}

export function isWallCoincidentWithPortal(w, p) {
    if (!w || !p || !p.geom) return false;
    const g = p.geom;
    if (p.shape === 'line') {
        const d1 = distToSegmentSq({ x: g.x1, y: g.y1 }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const d2 = distToSegmentSq({ x: g.x2, y: g.y2 }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        if (d1 <= 225 && d2 <= 225) return true;
        const d3 = distToSegmentSq({ x: w.x1, y: w.y1 }, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
        const d4 = distToSegmentSq({ x: w.x2, y: w.y2 }, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
        if (d3 <= 225 && d4 <= 225) return true;
    } else {
        const c = calcPortalCenter(p);
        if (distToSegmentSq(c, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) <= 400) return true;
    }
    return false;
}

export function renderProjectedPortals(ctx, portals, options = {}) {
    if (!Array.isArray(portals) || portals.length === 0) return;
    const {
        vtt = {},
        tokens = {},
        walls = [],
        currentMapId = null,
        grid = { size: 50, scale: 1 },
        selectedTokenIds = new Set(),
        gmTokenVisionMode = false,
        isTokenControlledByPlayer = () => true,
        getTokenCenter = (t) => ({ x: t.x + 25, y: t.y + 25 }),
        getTokenDrawDimensions = options.getTokenDrawDimensions ||
            ((t) => {
                const unit = (grid.size || 50) * (grid.scale || 1);
                const sz = parseFloat(t?.size) || 1;
                const w = unit * sz;
                const h = unit * sz;
                return { drawW: w, drawH: h, tokenRadius: w / 2 };
            }),
        getWallCoordinatesForRaycasting = null,
        getLineIntersection = getLineIntersectionInternal,
        drawTargetRoomContentFn = options.drawTargetRoomContent || drawTargetRoomContent
    } = options;

    const isGM = options.isGM !== undefined ? options.isGM : vtt.role === 'GM';
    const campaignState = options.campaignState || vtt.campaignState;
    const currentMap = options.currentMap || campaignState?.maps?.[currentMapId];
    const isDaylightMode = currentMap?.lightingSettings?.daylightMode;
    const defaultSightRadius = 60; // feet

    // Collect all tokens that grant vision to this client (matching reference E:\Games\ForgeDVTT line 3740)
    let visionSources = Object.values(tokens).filter((token) => {
        const grantsVision = Boolean(token.isPlayer || token.isCompanion);
        if (isGM) {
            if (gmTokenVisionMode) return selectedTokenIds.has(token.id);
            if (selectedTokenIds.size > 0) return selectedTokenIds.has(token.id);
            return grantsVision;
        }
        return grantsVision && isTokenControlledByPlayer(token, true);
    });

    // Fallback for players if no strictly owned token found: allow any player-assigned character or active player token
    if (!isGM && visionSources.length === 0) {
        visionSources = Object.values(tokens).filter((token) => token.isPlayer || token.isCompanion);
    }

    // Fallback for GM if no player tokens exist and no token selected: allow any token on map
    if (isGM && visionSources.length === 0) {
        visionSources = Object.values(tokens);
    }
    if (visionSources.length === 0) return;

    portals.forEach((portal) => {
        if (!portal.targetPortalId) return;
        if (!isGM && portal.isRevealed === false) return;

        const targetMapId = portal.targetMapId || currentMapId;
        let targetPortal = null;
        let targetMap = null;

        if (targetMapId === currentMapId) {
            targetPortal = portals.find((p) => p.id === portal.targetPortalId);
            targetMap = currentMap;
        } else if (campaignState?.maps?.[targetMapId]) {
            targetMap = campaignState.maps[targetMapId];
            targetPortal = targetMap?.portals?.find((p) => p.id === portal.targetPortalId);
        }

        if (!targetPortal) return;

        const isReflect =
            portal.reflectMode === 'one-way' ||
            portal.reflectMode === 'two-way' ||
            targetPortal.reflectMode === 'two-way';
        const isViewThrough = !!(portal.viewThrough || portal.seeThrough);

        if (!isViewThrough && !isReflect) return;

        const centerA = calcPortalCenter(portal);
        const normA = getPortalNormalVector(portal);
        const centerB = calcPortalCenter(targetPortal);
        const normB = getPortalNormalVector(targetPortal);

        const angleA = Math.atan2(normA.dy, normA.dx);
        const angleB = Math.atan2(normB.dy, normB.dx);
        let thetaRot = isReflect ? 0 : angleA - angleB + Math.PI;
        while (thetaRot > Math.PI) thetaRot -= Math.PI * 2;
        while (thetaRot <= -Math.PI) thetaRot += Math.PI * 2;

        const targetW = targetMap?.gridWidth ? targetMap.gridWidth * (grid.size || 50) * (grid.scale || 1) : 2000;
        const targetH = targetMap?.gridHeight ? targetMap.gridHeight * (grid.size || 50) * (grid.scale || 1) : 1500;
        const targetTokens =
            targetMapId === currentMapId ? Object.values(tokens) : Object.values(targetMap?.tokens || {});
        const targetWalls = targetMapId === currentMapId ? walls : targetMap?.walls || [];

        let p1A = null,
            p2A = null;
        const gA = portal.geom;
        if (portal.shape === 'line' && gA) {
            p1A = { x: gA.x1, y: gA.y1 };
            p2A = { x: gA.x2, y: gA.y2 };
        }

        function isWallCoincidentWithPortal(w, p) {
            if (!w || !p || !p.geom) return false;
            const g = p.geom;
            if (p.shape === 'line') {
                const d1 = distToSegmentSq({ x: g.x1, y: g.y1 }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
                const d2 = distToSegmentSq({ x: g.x2, y: g.y2 }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
                if (d1 <= 225 && d2 <= 225) return true;
                const d3 = distToSegmentSq({ x: w.x1, y: w.y1 }, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
                const d4 = distToSegmentSq({ x: w.x2, y: w.y2 }, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
                if (d3 <= 225 && d4 <= 225) return true;
            } else {
                const c = calcPortalCenter(p);
                if (distToSegmentSq(c, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) <= 400) return true;
            }
            return false;
        }

        visionSources.forEach((source) => {
            const sourceCenter = getTokenCenter(source);
            const vInX = centerA.x - sourceCenter.x;
            const vInY = centerA.y - sourceCenter.y;
            const distToA = Math.hypot(vInX, vInY);

            const { tokenRadius } = getTokenDrawDimensions(source);
            let sightFeet = parseInt(source.sightRange);
            if (isNaN(sightFeet) || sightFeet <= 0) {
                const lightReach = Math.max(parseFloat(source.lightBright) || 0, parseFloat(source.lightDim) || 0);
                sightFeet = lightReach > 0 ? lightReach : defaultSightRadius;
            }
            if (isDaylightMode) sightFeet = 99999;
            const sightDistPx = (sightFeet / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1);
            const maxSightDist = sightFeet > 0 ? tokenRadius + sightDistPx : isDaylightMode ? 99999 : 0;
            if (distToA > maxSightDist && !isDaylightMode && (!isGM || gmTokenVisionMode)) return;

            let blocked = false;
            for (let i = 0; i < walls.length; i++) {
                const w = walls[i];
                if (w.isOpen) continue;
                if (isWallCoincidentWithPortal(w, portal)) continue;
                if (checkLineIntersection(sourceCenter, centerA, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) {
                    blocked = true;
                    break;
                }
            }
            if (blocked && (!isGM || gmTokenVisionMode)) return;

            // 1. REFLECT PASS
            if (isReflect) {
                ctx.save();
                ctx.beginPath();
                if (portal.shape === 'circle' && gA) {
                    ctx.arc(centerA.x, centerA.y, gA.r !== undefined ? gA.r : 25, 0, Math.PI * 2);
                } else if (portal.shape === 'rect' && gA) {
                    ctx.rect(gA.x, gA.y, gA.w, gA.h);
                } else if (portal.shape === 'polygon' && gA?.points?.length >= 3) {
                    ctx.moveTo(gA.points[0].x, gA.points[0].y);
                    for (let pi = 1; pi < gA.points.length; pi++) ctx.lineTo(gA.points[pi].x, gA.points[pi].y);
                    ctx.closePath();
                } else if (portal.shape === 'line' && gA) {
                    const norm = getPortalNormalVector(portal);
                    const halfThick = 20;
                    ctx.moveTo(gA.x1 + norm.dx * halfThick, gA.y1 + norm.dy * halfThick);
                    ctx.lineTo(gA.x2 + norm.dx * halfThick, gA.y2 + norm.dy * halfThick);
                    ctx.lineTo(gA.x2 - norm.dx * halfThick, gA.y2 - norm.dy * halfThick);
                    ctx.lineTo(gA.x1 - norm.dx * halfThick, gA.y1 - norm.dy * halfThick);
                    ctx.closePath();
                } else {
                    ctx.arc(centerA.x, centerA.y, 25, 0, Math.PI * 2);
                }
                ctx.clip();

                ctx.translate(centerA.x, centerA.y);
                ctx.translate(-centerB.x, -centerB.y);

                drawTargetRoomContentFn(
                    ctx,
                    targetMap,
                    targetMapId,
                    targetW,
                    targetH,
                    targetTokens,
                    targetWalls,
                    centerA,
                    centerB,
                    options
                );
                ctx.restore();
            }

            // 2. VIEW THROUGH PASS
            const remainingSight = maxSightDist - distToA;
            if (isViewThrough && !isReflect && remainingSight > 10) {
                let canView = true;
                if (portal.isOneWay && !portal.isRadial) {
                    const inDot = vInX * normA.dx + vInY * normA.dy;
                    if (inDot >= 0) canView = false;
                }

                if (canView) {
                    const relX = sourceCenter.x - centerA.x;
                    const relY = sourceCenter.y - centerA.y;
                    const cosInv = Math.cos(-thetaRot);
                    const sinInv = Math.sin(-thetaRot);
                    const virtEyeB = {
                        x: centerB.x + (relX * cosInv - relY * sinInv),
                        y: centerB.y + (relX * sinInv + relY * cosInv)
                    };

                    const gB = targetPortal.geom;
                    let p1B = null,
                        p2B = null;
                    if (targetPortal.shape === 'line' && gB) {
                        p1B = { x: gB.x1, y: gB.y1 };
                        p2B = { x: gB.x2, y: gB.y2 };
                    } else if (targetPortal.shape === 'circle' && gB) {
                        const r = gB.r !== undefined ? gB.r : 25;
                        const dEye = Math.hypot(centerB.x - virtEyeB.x, centerB.y - virtEyeB.y) || 1;
                        if (dEye <= r) {
                            p1B = { x: centerB.x - normB.dy * r, y: centerB.y + normB.dx * r };
                            p2B = { x: centerB.x + normB.dy * r, y: centerB.y - normB.dx * r };
                        } else {
                            const angC = Math.atan2(centerB.y - virtEyeB.y, centerB.x - virtEyeB.x);
                            const alpha = Math.asin(Math.min(0.999, r / dEye));
                            p1B = {
                                x: virtEyeB.x + Math.cos(angC - alpha) * dEye,
                                y: virtEyeB.y + Math.sin(angC - alpha) * dEye
                            };
                            p2B = {
                                x: virtEyeB.x + Math.cos(angC + alpha) * dEye,
                                y: virtEyeB.y + Math.sin(angC + alpha) * dEye
                            };
                        }
                    } else if (targetPortal.shape === 'rect' && gB) {
                        const pts = [
                            { x: gB.x, y: gB.y },
                            { x: gB.x + gB.w, y: gB.y },
                            { x: gB.x + gB.w, y: gB.y + gB.h },
                            { x: gB.x, y: gB.y + gB.h }
                        ];
                        let minA = Infinity,
                            maxA = -Infinity;
                        let minP = pts[0],
                            maxP = pts[0];
                        const refA = Math.atan2(centerB.y - virtEyeB.y, centerB.x - virtEyeB.x);
                        pts.forEach((p) => {
                            const a = Math.atan2(p.y - virtEyeB.y, p.x - virtEyeB.x);
                            let diff = (a - refA) % (Math.PI * 2);
                            if (diff < -Math.PI) diff += Math.PI * 2;
                            if (diff > Math.PI) diff -= Math.PI * 2;
                            if (diff < minA) {
                                minA = diff;
                                minP = p;
                            }
                            if (diff > maxA) {
                                maxA = diff;
                                maxP = p;
                            }
                        });
                        p1B = minP;
                        p2B = maxP;
                    } else if (targetPortal.shape === 'polygon' && gB?.points?.length >= 3) {
                        const pts = gB.points;
                        let minA = Infinity,
                            maxA = -Infinity;
                        let minP = pts[0],
                            maxP = pts[0];
                        const refA = Math.atan2(centerB.y - virtEyeB.y, centerB.x - virtEyeB.x);
                        pts.forEach((p) => {
                            const a = Math.atan2(p.y - virtEyeB.y, p.x - virtEyeB.x);
                            let diff = (a - refA) % (Math.PI * 2);
                            if (diff < -Math.PI) diff += Math.PI * 2;
                            if (diff > Math.PI) diff -= Math.PI * 2;
                            if (diff < minA) {
                                minA = diff;
                                minP = p;
                            }
                            if (diff > maxA) {
                                maxA = diff;
                                maxP = p;
                            }
                        });
                        p1B = minP;
                        p2B = maxP;
                    } else {
                        p1B = { x: centerB.x - normB.dy * 25, y: centerB.y + normB.dx * 25 };
                        p2B = { x: centerB.x + normB.dy * 25, y: centerB.y - normB.dx * 25 };
                    }

                    let room2VisPoly = null;
                    if (p1B && p2B) {
                        const angMid = Math.atan2(centerB.y - virtEyeB.y, centerB.x - virtEyeB.x);
                        const getRelAngle = (a) =>
                            ((((a - angMid + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

                        const ang1 = Math.atan2(p1B.y - virtEyeB.y, p1B.x - virtEyeB.x);
                        const ang2 = Math.atan2(p2B.y - virtEyeB.y, p2B.x - virtEyeB.x);
                        const rel1 = getRelAngle(ang1);
                        const rel2 = getRelAngle(ang2);
                        const minRel = Math.min(rel1, rel2);
                        const maxRel = Math.max(rel1, rel2);
                        const apertureSpan = maxRel - minRel;

                        if (apertureSpan > 0.001 && apertureSpan < Math.PI * 0.999) {
                            const startPoint = rel1 <= rel2 ? p1B : p2B;
                            const endPoint = rel1 <= rel2 ? p2B : p1B;

                            const relAngles = new Set();
                            relAngles.add(minRel);
                            relAngles.add(maxRel);

                            const numSteps = Math.max(24, Math.round((apertureSpan * 60) / Math.PI));
                            const stepSize = apertureSpan / numSteps;
                            for (let s = 1; s < numSteps; s++) {
                                relAngles.add(minRel + s * stepSize);
                            }

                            const candidateWalls = [];
                            targetWalls.forEach((w) => {
                                if (isWallCoincidentWithPortal(w, targetPortal)) return;
                                if (getWallCoordinatesForRaycasting) {
                                    const wallType = w.type || (w.isDoor ? 'door' : w.isWindow ? 'window' : 'wall');
                                    const coords = getWallCoordinatesForRaycasting(
                                        { ...w, type: wallType },
                                        virtEyeB.x,
                                        virtEyeB.y
                                    );
                                    if (coords) candidateWalls.push(coords);
                                } else {
                                    candidateWalls.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 });
                                }
                            });

                            candidateWalls.push({ x1: 0, y1: 0, x2: targetW, y2: 0 });
                            candidateWalls.push({ x1: targetW, y1: 0, x2: targetW, y2: targetH });
                            candidateWalls.push({ x1: targetW, y1: targetH, x2: 0, y2: targetH });
                            candidateWalls.push({ x1: 0, y1: targetH, x2: 0, y2: 0 });

                            candidateWalls.forEach((cw) => {
                                [
                                    { x: cw.x1, y: cw.y1 },
                                    { x: cw.x2, y: cw.y2 }
                                ].forEach((pt) => {
                                    const distPastPortal =
                                        (pt.x - centerB.x) * normB.dx + (pt.y - centerB.y) * normB.dy;
                                    if (distPastPortal >= -5) {
                                        const angPt = Math.atan2(pt.y - virtEyeB.y, pt.x - virtEyeB.x);
                                        const rPt = getRelAngle(angPt);
                                        if (rPt >= minRel && rPt <= maxRel) {
                                            relAngles.add(rPt);
                                            if (rPt - 0.0001 >= minRel) relAngles.add(rPt - 0.0001);
                                            if (rPt + 0.0001 <= maxRel) relAngles.add(rPt + 0.0001);
                                        }
                                    }
                                });
                            });

                            const sortedRelAngles = Array.from(relAngles).sort((a, b) => a - b);
                            const distEyeToCenter = Math.hypot(virtEyeB.x - centerB.x, virtEyeB.y - centerB.y);
                            const rayReach = remainingSight + distEyeToCenter;
                            const fanPoints = [];

                            sortedRelAngles.forEach((r) => {
                                const absAng = angMid + r;
                                const rdx = Math.cos(absAng);
                                const rdy = Math.sin(absAng);
                                const rx = virtEyeB.x + rdx * rayReach;
                                const ry = virtEyeB.y + rdy * rayReach;

                                let closestT = 1.0;
                                let hitX = rx;
                                let hitY = ry;

                                for (let i = 0; i < candidateWalls.length; i++) {
                                    const cw = candidateWalls[i];
                                    const hit = getLineIntersection(
                                        virtEyeB.x,
                                        virtEyeB.y,
                                        rx,
                                        ry,
                                        cw.x1,
                                        cw.y1,
                                        cw.x2,
                                        cw.y2
                                    );
                                    if (hit && hit.t < closestT) {
                                        const dHit = (hit.x - centerB.x) * normB.dx + (hit.y - centerB.y) * normB.dy;
                                        if (dHit >= -2) {
                                            closestT = hit.t;
                                            hitX = hit.x;
                                            hitY = hit.y;
                                        }
                                    }
                                }
                                fanPoints.push({ x: hitX, y: hitY });
                            });

                            room2VisPoly = [startPoint, ...fanPoints, endPoint];
                        }
                    }

                    const frustum = computePortalSightFrustum(portal, sourceCenter, remainingSight);
                    if (!frustum || frustum.length < 3) return;

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(frustum[0].x, frustum[0].y);
                    for (let pi = 1; pi < frustum.length; pi++) {
                        ctx.lineTo(frustum[pi].x, frustum[pi].y);
                    }
                    ctx.closePath();
                    ctx.clip();

                    ctx.translate(centerA.x, centerA.y);
                    if (thetaRot !== 0) ctx.rotate(thetaRot);
                    ctx.translate(-centerB.x, -centerB.y);

                    if (Array.isArray(room2VisPoly) && room2VisPoly.length >= 3) {
                        ctx.beginPath();
                        ctx.moveTo(room2VisPoly[0].x, room2VisPoly[0].y);
                        for (let pi = 1; pi < room2VisPoly.length; pi++) {
                            ctx.lineTo(room2VisPoly[pi].x, room2VisPoly[pi].y);
                        }
                        ctx.closePath();
                        ctx.clip();
                    }

                    drawTargetRoomContentFn(
                        ctx,
                        targetMap,
                        targetMapId,
                        targetW,
                        targetH,
                        targetTokens,
                        targetWalls,
                        centerA,
                        centerB,
                        options
                    );
                    ctx.restore();
                }
            }
        });
    });
}

export function renderPortals(ctx, portals, currentMapId, isGM, zoom = 1) {
    if (!Array.isArray(portals) || portals.length === 0) return;
    if (!isGM) return; // Seamless map transitions: portals are invisible connecting seams on the player side

    const sortedPortals = [...portals].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    sortedPortals.forEach((portal) => {
        ctx.save();
        const strokeColor = '#a855f7';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2 / zoom;

        const g = portal.geom;
        if (!g) {
            ctx.restore();
            return;
        }

        const center = calcPortalCenter(portal);

        ctx.beginPath();
        if (portal.shape === 'rect') {
            ctx.rect(g.x, g.y, g.w, g.h);
        } else if (portal.shape === 'circle') {
            ctx.arc(g.cx, g.cy, g.r !== undefined ? g.r : 20, 0, Math.PI * 2);
        } else if (portal.shape === 'line') {
            ctx.moveTo(g.x1, g.y1);
            ctx.lineTo(g.x2, g.y2);
        } else if (portal.shape === 'polygon' && g.points && g.points.length >= 2) {
            ctx.moveTo(g.points[0].x, g.points[0].y);
            for (let i = 1; i < g.points.length; i++) {
                ctx.lineTo(g.points[i].x, g.points[i].y);
            }
            ctx.closePath();
        }
        ctx.stroke();

        // Portal Facing Direction Normal Arrow
        if (!portal.isRadial) {
            const norm = getPortalNormalVector(portal);
            const arrowLen = 28 / zoom;
            const ax = center.x + norm.dx * arrowLen;
            const ay = center.y + norm.dy * arrowLen;

            ctx.save();
            ctx.strokeStyle = portal.isOneWay ? '#38bdf8' : '#c084fc';
            ctx.fillStyle = portal.isOneWay ? '#38bdf8' : '#c084fc';
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();

            // Arrowhead
            const headLen = 7 / zoom;
            const angle = Math.atan2(norm.dy, norm.dx);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - headLen * Math.cos(angle - Math.PI / 6), ay - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(ax - headLen * Math.cos(angle + Math.PI / 6), ay - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Dashed Link Line to Destination Portal on Same Map
        if (portal.targetPortalId && (!portal.targetMapId || portal.targetMapId === currentMapId)) {
            const target = portals.find((p) => p.id === portal.targetPortalId);
            if (target) {
                const targetCenter = calcPortalCenter(target);
                ctx.save();
                ctx.setLineDash([6 / zoom, 6 / zoom]);
                ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
                ctx.lineWidth = 1.5 / zoom;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(targetCenter.x, targetCenter.y);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Clean subtle label for GM
        ctx.fillStyle = '#f5d0fe';
        ctx.font = `600 ${Math.max(9, 11 / zoom)}px "Open Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(portal.name || 'Portal', center.x, center.y);

        ctx.restore();
    });
}

export function populateTargetPortalsDropdown(
    portals,
    currentMapId,
    campaignState,
    selectedId = null,
    targetMapId = null
) {
    if (typeof document === 'undefined') return;
    const portalSelect = document.getElementById('maptools-portal-target-portal');
    if (!portalSelect) return;

    const chosenMapId = targetMapId || document.getElementById('maptools-portal-target-map')?.value || currentMapId;
    const currentPortalVal = portalSelect.value;
    portalSelect.innerHTML = '<option value="">-- None (Unlinked) --</option>';

    let candidatePortals = [];
    if (chosenMapId === currentMapId) {
        candidatePortals = (portals || []).filter((p) => !selectedId || p.id !== selectedId);
    } else if (campaignState?.maps?.[chosenMapId]?.portals) {
        candidatePortals = campaignState.maps[chosenMapId].portals;
    }

    if (chosenMapId !== currentMapId && candidatePortals.length === 0) {
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- No portals on this map --';
        emptyOpt.disabled = true;
        portalSelect.appendChild(emptyOpt);
    } else {
        candidatePortals.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name || 'Portal';
            portalSelect.appendChild(opt);
        });
    }

    if (currentPortalVal && candidatePortals.some((p) => p.id === currentPortalVal)) {
        portalSelect.value = currentPortalVal;
    } else {
        portalSelect.value = '';
    }
}

export function cleanupPortalReferences(deletedId, portals, currentMapId, campaignState, socket = null) {
    if (!deletedId) return;
    let changedCurrent = false;
    portals.forEach((p) => {
        if (p.targetPortalId === deletedId) {
            p.targetPortalId = '';
            changedCurrent = true;
        }
    });
    if (changedCurrent) {
        if (campaignState?.maps?.[currentMapId]) {
            campaignState.maps[currentMapId].portals = portals;
        }
        if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
    }
    if (campaignState?.maps) {
        Object.keys(campaignState.maps).forEach((mId) => {
            if (mId === currentMapId) return;
            const otherList = campaignState.maps[mId]?.portals;
            if (Array.isArray(otherList)) {
                let changed = false;
                otherList.forEach((p) => {
                    if (p.targetPortalId === deletedId) {
                        p.targetPortalId = '';
                        changed = true;
                    }
                });
                if (changed && socket) {
                    socket.emit('portals:update', { mapId: mId, portals: otherList });
                }
            }
        });
    }
}

export function playPortalTeleportFX(coords, renderAll = null) {
    if (renderAll) renderAll();
}

export function showGMInterMapPortalToast(data, vtt, onSwitchMap = null) {
    if (vtt.role !== 'GM' || typeof document === 'undefined') return;
    const container = document.getElementById('vtt-toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = 'vtt-intermap-toast glassmorphism animated-fade-in';
    toast.style.cssText =
        'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(20,10,35,0.92); border: 1px solid #a855f7; border-radius: 8px; padding: 12px 18px; z-index: 10002; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 20px rgba(168,85,247,0.4); color: #fff; font-size: 0.88rem;';
    toast.innerHTML = `
        <i class="fa-solid fa-door-open" style="color: #c084fc; font-size: 1.2rem;"></i>
        <span><strong>${data.tokenName || 'Token'}</strong> walked through portal to <strong>${data.targetMapName || 'Another Map'}</strong>.</span>
        <button type="button" class="btn btn-primary btn-xs btn-switch-map" style="margin-left: 8px; background: #a855f7; border-color: #c084fc;">
            <i class="fa-solid fa-map"></i> Switch to Map
        </button>
        <button type="button" class="btn btn-secondary btn-xs btn-close-toast"><i class="fa-solid fa-xmark"></i></button>
    `;
    toast.querySelector('.btn-switch-map')?.addEventListener('click', () => {
        if (onSwitchMap) onSwitchMap(data.targetMapId, data.tokenId || '');
        else if (window?.VTT?.canvasEngine?.switchMapTo)
            window.VTT.canvasEngine.switchMapTo(data.targetMapId, data.tokenId || '');
        toast.remove();
    });
    toast.querySelector('.btn-close-toast')?.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 12000);
}

export function showPlayerInterMapPortalToast(mapName) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('vtt-portal-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'vtt-portal-gm-toast';
    toast.style.background = 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(49, 46, 129, 0.95))';
    toast.style.borderColor = '#818cf8';
    toast.innerHTML = `
        <i class="fa-solid fa-door-open" style="color: #a5b4fc; font-size: 1.2rem;"></i>
        <span>Traveled through portal to <strong>${mapName || 'New Map'}</strong>.</span>
        <button type="button" class="btn btn-secondary btn-xs btn-close-toast"><i class="fa-solid fa-xmark"></i></button>
    `;
    toast.querySelector('.btn-close-toast')?.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 6000);
}

export function renderPlacedPortalsList(portals, selectedMapToolItem, callbacks = {}) {
    const {
        currentMapId = null,
        campaignState = {},
        onSelect = null,
        onPanTo = null,
        onUpdate = null,
        onDeselect = null,
        renderAll = null,
        zoom = 1,
        vtt = {}
    } = callbacks;

    if (typeof document === 'undefined') return;
    const countEl = document.getElementById('maptools-portals-count');
    const listEl = document.getElementById('maptools-portals-list');
    if (countEl) countEl.textContent = portals.length;
    if (!listEl) return;

    if (portals.length === 0) {
        listEl.innerHTML =
            '<div class="maptools-empty-note">No portals placed on this map. Click & drag on the canvas to place one.</div>';
        return;
    }

    listEl.innerHTML = '';
    portals.forEach((portal, idx) => {
        const isSelected =
            selectedMapToolItem && selectedMapToolItem.type === 'portal' && selectedMapToolItem.id === portal.id;
        const card = document.createElement('div');
        card.className = `maptools-item-card ${isSelected ? 'is-selected' : ''}`;
        const targetMapName =
            portal.targetMapId && portal.targetMapId !== currentMapId && campaignState?.maps?.[portal.targetMapId]
                ? campaignState.maps[portal.targetMapId].name
                : 'Current Map';

        const safePortalName = escapeHtml(portal.name || 'Portal');
        const safeTargetMapName = escapeHtml(targetMapName);

        card.innerHTML = `
            <div class="maptools-item-info">
                <div class="maptools-item-name">
                    <i class="fa-solid fa-door-open" style="color: #c084fc;"></i>
                    <span>${safePortalName}</span>
                </div>
                <div class="maptools-item-meta">
                    ${escapeHtml((portal.shape || 'line').toUpperCase())} &rarr; ${safeTargetMapName}
                    ${portal.isOneWay ? '<span style="color:#38bdf8; font-weight:600; margin-left:4px;">[1-Way]</span>' : ''}
                </div>
            </div>
            <div class="maptools-item-actions">
                <button type="button" class="maptools-action-btn btn-edit ${isSelected ? 'active' : ''}" title="Select & Edit Portal" data-id="${portal.id}">
                    <i class="fa-solid fa-pen"></i>
                </button>
                ${
                    portal.isOneWay
                        ? `
                    <button type="button" class="maptools-action-btn btn-flip" title="Flip Viewing/Entry Side" data-idx="${idx}">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                `
                        : ''
                }
                <button type="button" class="maptools-action-btn btn-focus" title="Center View on Portal" data-idx="${idx}">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button type="button" class="maptools-action-btn btn-delete" title="Delete Portal" data-id="${portal.id}" data-idx="${idx}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        card.querySelector('.maptools-item-info')?.addEventListener('click', () => {
            if (onSelect) onSelect('portal', portal.id);
        });

        card.querySelector('.btn-edit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onSelect) onSelect('portal', portal.id);
        });

        card.querySelector('.btn-focus')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const center = calcPortalCenter(portal);
            if (onPanTo) onPanTo(center.x, center.y, zoom, 300);
        });

        card.querySelector('.btn-flip')?.addEventListener('click', (e) => {
            e.stopPropagation();
            portal.viewSideFlipped = !portal.viewSideFlipped;
            if (vtt.socket) vtt.socket.emit('portals:update', { mapId: currentMapId, portals });
            if (renderAll) renderAll();
        });

        card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const pId = portal.id;
            const pIdx = portals.findIndex((p) => p.id === pId);
            if (pIdx !== -1) {
                portals.splice(pIdx, 1);
                cleanupPortalReferences(pId, portals, currentMapId, campaignState, vtt.socket);
                if (campaignState?.maps?.[currentMapId]) {
                    campaignState.maps[currentMapId].portals = portals;
                }
                if (vtt.socket) vtt.socket.emit('portals:update', { mapId: currentMapId, portals });
                if (selectedMapToolItem && selectedMapToolItem.type === 'portal' && selectedMapToolItem.id === pId) {
                    if (onDeselect) onDeselect();
                } else {
                    if (onUpdate) onUpdate();
                    populateTargetPortalsDropdown(portals, currentMapId, campaignState);
                    if (renderAll) renderAll();
                }
            }
        });

        listEl.appendChild(card);
    });
}

export function showPortalContextMenu(portalId, clientX, clientY, context = {}) {
    if (typeof document === 'undefined') return;
    const oldMenu = document.getElementById('vtt-token-context-menu');
    if (oldMenu) oldMenu.remove();

    const portals = context.portals || [];
    const portal = portals.find((p) => p.id === portalId);
    const role = context.role || 'GM';
    if (!portal || role !== 'GM') return;

    const menu = document.createElement('div');
    menu.id = 'vtt-token-context-menu';
    menu.className = 'vtt-token-context-menu';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    const html = `
        <div class="vtt-token-menu-header">
            <i class="fa-solid fa-archway"></i> ${portal.name || 'Portal'}
        </div>
        <div class="vtt-token-menu-item" id="menu-portal-front">
            <span><i class="fa-solid fa-angles-up item-icon"></i> Bring to Front</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-portal-forward">
            <span><i class="fa-solid fa-angle-up item-icon"></i> Bring Forward</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-portal-backward">
            <span><i class="fa-solid fa-angle-down item-icon"></i> Send Backward</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-portal-back">
            <span><i class="fa-solid fa-angles-down item-icon"></i> Send to Back</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item" id="menu-portal-flip">
            <span><i class="fa-solid fa-arrows-rotate item-icon"></i> Flip 180°</span>
        </div>
        <div class="vtt-token-menu-item" id="menu-portal-edit">
            <span><i class="fa-solid fa-pen-to-square item-icon"></i> Edit Portal</span>
        </div>
        <div class="vtt-token-menu-divider"></div>
        <div class="vtt-token-menu-item text-danger" id="menu-portal-delete" style="color: var(--color-danger);">
            <span><i class="fa-solid fa-trash item-icon"></i> Delete Portal</span>
        </div>
    `;

    menu.innerHTML = html;
    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    if (clientX + menuRect.width > window.innerWidth) menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    if (clientY + menuRect.height > window.innerHeight)
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;

    function syncPortals() {
        if (context.campaignState?.maps?.[context.currentMapId]) {
            context.campaignState.maps[context.currentMapId].portals = portals;
        }
        if (context.socket) context.socket.emit('portals:update', { mapId: context.currentMapId, portals });
        if (context.renderPlacedPortalsList) context.renderPlacedPortalsList();
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

    menu.querySelector('#menu-portal-front')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const tokens = context.tokens || {};
        const allZ = [...portals.map((p) => p.zIndex || 0), ...Object.values(tokens).map((t) => t.zIndex || 0)];
        const maxZ = Math.max(...allZ, 0);
        portal.zIndex = maxZ + 1;
        const idx = portals.findIndex((p) => p.id === portalId);
        if (idx !== -1 && idx < portals.length - 1) {
            const [item] = portals.splice(idx, 1);
            portals.push(item);
        }
        syncPortals();
        closeMenu();
    });

    menu.querySelector('#menu-portal-forward')?.addEventListener('click', (e) => {
        e.stopPropagation();
        portal.zIndex = (portal.zIndex || 0) + 1;
        const idx = portals.findIndex((p) => p.id === portalId);
        if (idx !== -1 && idx < portals.length - 1) {
            const temp = portals[idx];
            portals[idx] = portals[idx + 1];
            portals[idx + 1] = temp;
        }
        syncPortals();
        closeMenu();
    });

    menu.querySelector('#menu-portal-backward')?.addEventListener('click', (e) => {
        e.stopPropagation();
        portal.zIndex = (portal.zIndex || 0) - 1;
        const idx = portals.findIndex((p) => p.id === portalId);
        if (idx > 0) {
            const temp = portals[idx];
            portals[idx] = portals[idx - 1];
            portals[idx - 1] = temp;
        }
        syncPortals();
        closeMenu();
    });

    menu.querySelector('#menu-portal-back')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const tokens = context.tokens || {};
        const allZ = [...portals.map((p) => p.zIndex || 0), ...Object.values(tokens).map((t) => t.zIndex || 0)];
        const minZ = Math.min(...allZ, 0);
        portal.zIndex = minZ - 1;
        const idx = portals.findIndex((p) => p.id === portalId);
        if (idx > 0) {
            const [item] = portals.splice(idx, 1);
            portals.unshift(item);
        }
        syncPortals();
        closeMenu();
    });

    menu.querySelector('#menu-portal-flip')?.addEventListener('click', () => {
        portal.facingAngle = ((portal.facingAngle !== undefined ? portal.facingAngle : 270) + 180) % 360;
        portal.viewSideFlipped = !portal.viewSideFlipped;
        syncPortals();
        closeMenu();
    });

    menu.querySelector('#menu-portal-edit')?.addEventListener('click', () => {
        if (context.selectMapToolItem) context.selectMapToolItem('portal', portalId);
        closeMenu();
    });

    menu.querySelector('#menu-portal-delete')?.addEventListener('click', () => {
        if (context.deleteSelectedMapToolItem) context.deleteSelectedMapToolItem('portal', portalId);
        closeMenu();
    });
}

export function checkTokenMoveTriggers(token, originalPos, context = {}) {
    if (!token || !originalPos) return null;
    const vtt = context.vtt || {};
    const currentMapId = context.currentMapId;
    const traps = context.traps || [];
    const portals = context.portals || [];
    const tokens = context.tokens || {};
    const selectedTokenIds = context.selectedTokenIds || new Set();
    const tokenPortalDebounce = context.tokenPortalDebounce || new Map();
    const tokenInsidePortals = context.tokenInsidePortals || new Map();
    const tokenAnimations = context.tokenAnimations || {};
    const lastBroadcastedTokens = context.lastBroadcastedTokens || {};
    const snapToGrid = context.snapToGrid || ((x, y) => ({ x, y }));
    const renderAll = context.renderAll || (() => {});
    const renderPlacedTrapsList = context.renderPlacedTrapsList || (() => {});
    const panTo = context.panTo || (() => {});
    const getTokenDrawDimensions = context.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50 }));
    const isTokenInsidePortal =
        context.isTokenInsidePortal ||
        ((tokId, portalId) => tokenInsidePortals.has(tokId) && tokenInsidePortals.get(tokId).has(portalId));
    const addTokenInsidePortal =
        context.addTokenInsidePortal ||
        ((tokId, portalId) => {
            if (!tokenInsidePortals.has(tokId)) tokenInsidePortals.set(tokId, new Set());
            tokenInsidePortals.get(tokId).add(portalId);
        });
    const removeTokenInsidePortal =
        context.removeTokenInsidePortal ||
        ((tokId, portalId) => {
            if (tokenInsidePortals.has(tokId)) {
                tokenInsidePortals.get(tokId).delete(portalId);
                if (tokenInsidePortals.get(tokId).size === 0) tokenInsidePortals.delete(tokId);
            }
        });
    const playPortalTeleportFX = context.playPortalTeleportFX || (() => {});
    const triggerTrapSpringFX = context.triggerTrapSpringFX || (() => {});
    const postTrapTriggerChatCard = context.postTrapTriggerChatCard || (() => {});
    const switchMapTo = context.switchMapTo || (() => {});
    const showGMInterMapPortalToast = context.showGMInterMapPortalToast || (() => {});
    const showPlayerInterMapPortalToast = context.showPlayerInterMapPortalToast || (() => {});

    if (!token || !originalPos) return null;
    if (token._portalTransitLock && Date.now() < token._portalTransitLock) return null;
    const { drawW, drawH } = getTokenDrawDimensions(token);
    const from = { x: originalPos.x + drawW / 2, y: originalPos.y + drawH / 2 };
    const to = { x: token.x + drawW / 2, y: token.y + drawH / 2 };
    if (from.x === to.x && from.y === to.y) return null;

    // Debounce cleanup: clear debounce once token has physically stepped off destination portal
    if (tokenPortalDebounce.has(token.id)) {
        const db = tokenPortalDebounce.get(token.id);
        const debouncedPortal = portals.find((p) => p.id === db.portalId);
        if (debouncedPortal) {
            const isStillInside = isTokenCollidingWithPortal(token, debouncedPortal, null, to);
            if (!isStillInside) {
                tokenPortalDebounce.delete(token.id);
            }
        } else {
            tokenPortalDebounce.delete(token.id);
        }
    }

    // Prune any stale portal presence if the token is no longer colliding with that portal
    if (tokenInsidePortals.has(token.id)) {
        const insideSet = tokenInsidePortals.get(token.id);
        insideSet.forEach((pId) => {
            const pObj = portals.find((p) => p.id === pId);
            if (!pObj || !isTokenCollidingWithPortal(token, pObj, null, to)) {
                insideSet.delete(pId);
            }
        });
        if (insideSet.size === 0) tokenInsidePortals.delete(token.id);
    }

    const hits = [];

    // 1. Armed Traps
    traps.forEach((tr) => {
        if (tr.isDisarmed) return;
        if (tr.isSpent && !tr.repeatTrigger) return;

        // Elevation / altitude check (flying creatures do not trigger ground-level traps)
        const tokenElevation = Number(token.elevation ?? token.altitude ?? 0);
        const minElev = tr.minElevation !== undefined && tr.minElevation !== '' ? Number(tr.minElevation) : 0;
        const maxElev = tr.maxElevation !== undefined && tr.maxElevation !== '' ? Number(tr.maxElevation) : 5;
        if (!isNaN(minElev) && !isNaN(maxElev) && (tokenElevation < minElev || tokenElevation > maxElev)) {
            return;
        }

        const wasInside = isPointInsideGeometry(from, tr.shape, tr.geom);
        const isInside = isPointInsideGeometry(to, tr.shape, tr.geom);
        if (wasInside && !isInside) return;

        let hit = findEarliestPathIntersection(from, to, tr.shape, tr.geom);
        if (!hit && isInside) {
            hit = { x: to.x, y: to.y, t: 1 };
        }
        if (hit) {
            hits.push({ type: 'trap', entity: tr, hit, droppedInside: isInside && !wasInside });
        }
    });

    // 2. Walk-Through Portals
    portals.forEach((po) => {
        if (!po.walkThrough) return;

        if (po.shape === 'line') {
            if (tokenPortalDebounce.has(token.id) && tokenPortalDebounce.get(token.id).portalId === po.id) {
                const hitCheck = checkLineIntersection(
                    from,
                    to,
                    { x: po.geom.x1, y: po.geom.y1 },
                    { x: po.geom.x2, y: po.geom.y2 }
                );
                if (!hitCheck) {
                    tokenPortalDebounce.delete(token.id);
                }
                return;
            }

            if (!checkOneWayPortalEntry(po, from, to)) return;

            const hit = checkLineIntersection(
                from,
                to,
                { x: po.geom.x1, y: po.geom.y1 },
                { x: po.geom.x2, y: po.geom.y2 }
            );
            if (hit) {
                hits.push({ type: 'portal', entity: po, hit });
            }
        } else {
            const wasInside = isTokenInsidePortal(token.id, po.id) || isPointInsideGeometry(from, po.shape, po.geom);
            const isInsideNow = isPointInsideGeometry(to, po.shape, po.geom);

            if (wasInside && !isInsideNow) {
                removeTokenInsidePortal(token.id, po.id);
                if (tokenPortalDebounce.has(token.id) && tokenPortalDebounce.get(token.id).portalId === po.id) {
                    tokenPortalDebounce.delete(token.id);
                }
                return;
            }

            if (wasInside && isInsideNow) {
                addTokenInsidePortal(token.id, po.id);
                return;
            }

            if (!wasInside) {
                if (tokenPortalDebounce.has(token.id) && tokenPortalDebounce.get(token.id).portalId === po.id) return;
                if (!checkOneWayPortalEntry(po, from, to)) return;

                let hit = findEarliestPathIntersection(from, to, po.shape, po.geom);
                if (!hit && isInsideNow) {
                    hit = { x: to.x, y: to.y, t: 1 };
                }
                if (hit) {
                    hits.push({ type: 'portal', entity: po, hit });
                }
            }
        }
    });

    if (hits.length === 0) return null;

    hits.sort((a, b) => a.hit.t - b.hit.t);
    const first = hits[0];

    if (first.type === 'trap') {
        const trap = first.entity;
        if (first.droppedInside) {
            const snapped = snapToGrid(token.x, token.y, true);
            token.x = snapped.x;
            token.y = snapped.y;
        } else {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.hypot(dx, dy) || 1;
            const stepInX = first.hit.x + (dx / dist) * 14;
            const stepInY = first.hit.y + (dy / dist) * 14;
            const snapped = snapToGrid(stepInX - drawW / 2, stepInY - drawH / 2, true);
            token.x = snapped.x;
            token.y = snapped.y;
        }

        delete token._animReq;
        if (tokenAnimations[token.id]) delete tokenAnimations[token.id];

        if (trap.triggerAuto) {
            trap.isRevealed = true;
            if (!trap.repeatTrigger) {
                trap.isSpent = true;
            }
            vtt.socket.emit('traps:update', { mapId: currentMapId, traps });
            renderPlacedTrapsList();
            renderAll();

            let damageRoll = null;
            const rawDamage = trap.damage || '';
            const match = String(rawDamage).match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/i);
            const diceFormula = match ? match[1].replace(/\s+/g, '') : null;
            if (diceFormula) {
                try {
                    const rollFn =
                        window.vttPlayerSheetAPI?.simulateRoll ||
                        (typeof window !== 'undefined' && typeof window.simulateRoll === 'function'
                            ? window.simulateRoll
                            : null);
                    if (rollFn) {
                        damageRoll = rollFn(diceFormula);
                    }
                } catch (e) {
                    console.warn('[VTT] Failed to simulate trap damage roll:', e);
                }
            }

            const parsedDamageType =
                trap.damageType ||
                (rawDamage.replace(match ? match[0] : '', '').trim().toLowerCase()) ||
                'piercing';

            vtt.socket.emit('trap:trigger', {
                mapId: currentMapId,
                trapId: trap.id,
                trapName: trap.name || 'Concealed Trap',
                tokenId: token.id,
                tokenName: token.name || 'Creature',
                saveAbility: trap.saveAbility || 'DEX',
                saveDc: trap.saveDc || 15,
                damage: diceFormula || trap.damage || '4d6',
                damageType: parsedDamageType,
                damageRoll: damageRoll,
                flavor: trap.flavor || 'A concealed hazard is sprung upon entry!',
                coords: { x: token.x + drawW / 2, y: token.y + drawH / 2 }
            });
        }
        return { triggered: true, action: 'trap' };
    } else if (first.type === 'portal') {
        const portal = first.entity;
        const targetMapId = portal.targetMapId || currentMapId;
        const targetPortalId = portal.targetPortalId;
        if (!targetPortalId) return null;

        let targetPortal = null;
        let targetMap = null;
        if (targetMapId === currentMapId) {
            targetPortal = portals.find((p) => p.id === targetPortalId);
            targetMap = vtt.campaignState?.maps?.[currentMapId];
        } else if (vtt.campaignState?.maps?.[targetMapId]) {
            targetMap = vtt.campaignState.maps[targetMapId];
            targetPortal = targetMap?.portals?.find((p) => p.id === targetPortalId);
        }
        if (!targetPortal) return null;

        const exitPos = calcSpatialPortalDestination(portal, targetPortal, from, to, targetMap, token, {
            grid: targetMap?.grid || context.grid || { size: 50, scale: 1 },
            getTokenDrawDimensions: context.getTokenDrawDimensions || getTokenDrawDimensions,
            isHexGrid: context.isHexGrid || isHexGrid,
            getNearestHexFeatures: context.getNearestHexFeatures || getNearestHexFeatures
        });
        addTokenInsidePortal(token.id, targetPortal.id);
        tokenPortalDebounce.set(token.id, { portalId: targetPortal.id, time: Date.now() });
        token._portalTransitLock = Date.now() + 300;

        delete token._animReq;
        if (tokenAnimations[token.id]) delete tokenAnimations[token.id];

        if (targetMapId === currentMapId) {
            const { drawW, drawH } = getTokenDrawDimensions(token);
            token.x = exitPos.x;
            token.y = exitPos.y;
            selectedTokenIds.clear();
            selectedTokenIds.add(token.id);
            if ('selectedTokenId' in context) context.selectedTokenId = token.id;
            if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                window.emitTokenUpdates(tokens);
            } else if (typeof context.emitTokenUpdates === 'function') {
                context.emitTokenUpdates(tokens);
            }
            panTo(exitPos.x + drawW / 2, exitPos.y + drawH / 2, null, 300);
            renderAll();
        } else {
            token._teleportedInterMap = true;
            delete tokens[token.id];
            delete lastBroadcastedTokens[token.id];

            if (vtt.campaignState?.maps?.[targetMapId]) {
                if (!vtt.campaignState.maps[targetMapId].tokens) {
                    vtt.campaignState.maps[targetMapId].tokens = {};
                }
                const movedToken = { ...token, x: exitPos.x, y: exitPos.y };
                delete movedToken._teleportedInterMap;
                vtt.campaignState.maps[targetMapId].tokens[token.id] = movedToken;
            }

            if (context) {
                context.pendingFocusTokenId = token.id;
                context.pendingFocusTokenExpiry = Date.now() + 30000;
            }
            window._portalTransitInfo = {
                tokenId: token.id,
                targetMapId: targetMapId,
                targetPortalId: targetPortal.id,
                exitPos: { x: exitPos.x, y: exitPos.y },
                timestamp: Date.now()
            };

            vtt.socket.emit('portal:teleport_inter_map', {
                sourceMapId: currentMapId,
                targetMapId: targetMapId,
                targetPortalId: targetPortal.id,
                tokenId: token.id,
                targetX: exitPos.x,
                targetY: exitPos.y,
                username: vtt.username
            });
            renderAll();
        }
        return { triggered: true, action: 'teleport' };
    }
    return null;
}
