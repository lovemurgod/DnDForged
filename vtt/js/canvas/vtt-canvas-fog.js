// DnDForged Canvas Fog of War Subsystem
// Handles fog exploration masking, GM semi-translucent overlay, light cutouts, and raycast culling

import { computeVisibilityPolygon } from './vtt-canvas-visibility.js';
import { interpolateColors, getTokenEffectiveLightFacing } from './vtt-canvas-lighting.js';

export function renderFogOfWarLayer(width, height, options = {}) {
    const {
        ctxFog = null,
        canvasFog = null,
        scratchLightCanvas = null,
        ctxScratchLight = null,
        vtt = {},
        currentMapId = null,
        selectedTokenIds = new Set(),
        tokens = {},
        lights = [],
        walls = [],
        wallsVersion = 1,
        grid = { size: 50, scale: 1, feetPerSquare: 5 },
        defaultSightRadius = 60,
        dragTargetId = null,
        tokenDragOriginalPositions = {},
        isRectInViewport = () => true,
        getTokenCenter = (t) => ({ x: t.x + 25, y: t.y + 25 }),
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50, tokenRadius: 25 }),
        isTokenControlledByPlayer = () => true,
        checkLightingAnimationLoop = () => {},
        computeVisPolyFn = computeVisibilityPolygon,
        spatialIndex = null,
        wallSpatialIndex = null
    } = options;

    const activeSpatialIndex = spatialIndex || wallSpatialIndex;

    if (!ctxFog || !canvasFog) return [];

    let gmVisionMode = options.gmTokenVisionMode || false;
    const useFogLod = width > 2500 || height > 2500;
    const fogScale = useFogLod ? 0.5 : 1.0;

    const currentMap = vtt.campaignState?.maps?.[currentMapId];
    const isFogEnabled = currentMap?.lightingSettings?.fogOfWar !== false;
    if (!isFogEnabled) {
        ctxFog.clearRect(0, 0, canvasFog.width, canvasFog.height);
        if (options.ctxFloor) {
            options.ctxFloor.clearRect(0, 0, width, height);
            renderLightFloorWashPass(options.ctxFloor, width, height, options);
        }
        return [];
    }

    ctxFog.save();
    if (useFogLod) {
        ctxFog.scale(fogScale, fogScale);
    }
    ctxFog.clearRect(0, 0, width, height);

    if (vtt.role === 'GM' && gmVisionMode && selectedTokenIds.size === 0) {
        gmVisionMode = false;
        if (options.onGmVisionModeReset) options.onGmVisionModeReset();
    }

    if (vtt.role === 'GM') {
        ctxFog.fillStyle = gmVisionMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.25)';
        ctxFog.fillRect(0, 0, width, height);
    } else {
        ctxFog.fillStyle = '#000000';
        ctxFog.fillRect(0, 0, width, height);
    }

    const visionPolygons = [];
    const playerLosPolygons = [];

    const visionSources = Object.values(tokens).filter((token) => {
        const grantsVision = Boolean(
            token.isPlayer ||
            token.isCompanion ||
            token.characterId ||
            (token.characterId && vtt.campaignState?.characters?.[token.characterId]?.isPlayer)
        );
        if (vtt.role === 'GM') {
            if (gmVisionMode) return selectedTokenIds.has(token.id);
            if (selectedTokenIds.size > 0) return selectedTokenIds.has(token.id);
            return grantsVision;
        }
        return grantsVision && isTokenControlledByPlayer(token, true);
    });

    ctxFog.globalCompositeOperation = 'destination-out';

    const isDaylightMode = currentMap?.lightingSettings?.daylightMode;
    const updateOnDrop = currentMap?.lightingSettings?.updateOnDrop !== false;
    const maxLosRadius = Math.max(width, height) * 1.5;

    visionSources.forEach((source) => {
        let cx, cy;
        const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(source);

        if (
            updateOnDrop &&
            dragTargetId &&
            (dragTargetId === source.id || selectedTokenIds.has(source.id)) &&
            tokenDragOriginalPositions[source.id]
        ) {
            cx = tokenDragOriginalPositions[source.id].x + drawW / 2;
            cy = tokenDragOriginalPositions[source.id].y + drawH / 2;
        } else {
            const center = getTokenCenter(source);
            cx = center.x;
            cy = center.y;
        }

        // Calculate token's personal unobstructed Line of Sight (LOS) polygon across the map (stopping at walls)
        const losCacheKey = `${cx.toFixed(1)}_${cy.toFixed(1)}_los_${wallsVersion}`;
        let losPolygon;
        if (source._losPolyCache && source._losPolyCache.key === losCacheKey) {
            losPolygon = source._losPolyCache.polygon;
        } else {
            losPolygon = computeVisPolyFn(
                cx,
                cy,
                maxLosRadius,
                width,
                height,
                360,
                0,
                null,
                null,
                walls,
                activeSpatialIndex
            );
            source._losPolyCache = { key: losCacheKey, polygon: losPolygon };
        }
        if (losPolygon && losPolygon.length > 2) {
            playerLosPolygons.push(losPolygon);
        }

        let sightRange = source.sightRange !== undefined ? parseInt(source.sightRange) : defaultSightRadius;
        if (isDaylightMode) sightRange = 99999;

        const sightDistPx = (sightRange / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1);
        const radius = sightRange > 0 ? tokenRadius + sightDistPx : isDaylightMode ? 99999 : 0;

        if (radius <= 0) return;

        const cacheKey = `${cx.toFixed(1)}_${cy.toFixed(1)}_${radius.toFixed(1)}_${wallsVersion}`;
        let visibilityPolygon;
        if (source._polyCache && source._polyCache.key === cacheKey) {
            visibilityPolygon = source._polyCache.polygon;
        } else {
            visibilityPolygon = computeVisPolyFn(
                cx,
                cy,
                radius,
                width,
                height,
                360,
                0,
                null,
                null,
                walls,
                activeSpatialIndex
            );
            source._polyCache = { key: cacheKey, polygon: visibilityPolygon };
        }

        if (visibilityPolygon && visibilityPolygon.length > 2) {
            visionPolygons.push(visibilityPolygon);

            ctxFog.beginPath();
            ctxFog.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
            for (let i = 1; i < visibilityPolygon.length; i++) {
                ctxFog.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
            }
            ctxFog.closePath();

            if (isDaylightMode) {
                ctxFog.fillStyle = 'rgba(255, 255, 255, 1.0)';
            } else {
                const innerRadius = Math.max(tokenRadius, tokenRadius + sightDistPx * 0.8);
                const grad = ctxFog.createRadialGradient
                    ? ctxFog.createRadialGradient(cx, cy, innerRadius, cx, cy, radius)
                    : null;
                if (grad) {
                    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
                    ctxFog.fillStyle = grad;
                } else {
                    ctxFog.fillStyle = 'rgba(255, 255, 255, 1.0)';
                }
            }
            ctxFog.fill();
        }
    });

    const lightSources = [];
    const nowSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    let anyLightHasAnimation = false;

    Object.values(tokens).forEach((t) => {
        if (t.lightEnabled) {
            const center = getTokenCenter(t);
            const { drawW, drawH } = getTokenDrawDimensions(t);
            const tokenRadius = Math.max(drawW, drawH) / 2;
            const animType = t.lightAnimationType || 'none';
            if (animType !== 'none') anyLightHasAnimation = true;
            lightSources.push({
                id: t.id,
                x: center.x,
                y: center.y,
                isToken: true,
                tokenRadius: tokenRadius,
                lightBright: parseFloat(t.lightBright) || 0,
                lightDim: parseFloat(t.lightDim) || 0,
                lightColor: t.lightColor || '#ffffff',
                lightAngle: t.lightAngle !== undefined ? parseFloat(t.lightAngle) : 360,
                lightRotation: getTokenEffectiveLightFacing(t),
                animationType: animType,
                animationSpeed: parseFloat(t.lightAnimationSpeed) || 1.0,
                animationIntensity: parseFloat(t.lightAnimationIntensity) || 0.1,
                animationColor2: t.lightAnimationColor2 || '#ffe082',
                sourceEntity: t
            });
        }
    });

    lights.forEach((l) => {
        const animType = l.animationType || 'none';
        if (animType !== 'none') anyLightHasAnimation = true;
        lightSources.push({
            id: l.id,
            x: l.x,
            y: l.y,
            isToken: false,
            tokenRadius: 0,
            lightBright: parseFloat(l.lightBright) || 0,
            lightDim: parseFloat(l.lightDim) || 0,
            lightColor: l.lightColor || '#ffffff',
            lightAngle: l.lightAngle !== undefined ? parseFloat(l.lightAngle) : 360,
            lightRotation: l.lightRotation !== undefined ? parseFloat(l.lightRotation) : 0,
            animationType: animType,
            animationSpeed: parseFloat(l.animationSpeed) || 1.0,
            animationIntensity: parseFloat(l.animationIntensity) || 0.1,
            animationColor2: l.animationColor2 || '#ffe082',
            sourceEntity: l
        });
    });

    const litPolygons = [];
    const isRestrictedByPlayerVision = vtt.role !== 'GM' || gmVisionMode;

    if (scratchLightCanvas && ctxScratchLight) {
        const canRenderLights =
            lightSources.length > 0 && (!isRestrictedByPlayerVision || playerLosPolygons.length > 0);

        if (canRenderLights) {
            if (isRestrictedByPlayerVision) {
                ctxFog.save();
                ctxFog.beginPath();
                playerLosPolygons.forEach((poly) => {
                    if (poly && poly.length > 2) {
                        ctxFog.moveTo(poly[0].x, poly[0].y);
                        for (let i = 1; i < poly.length; i++) {
                            ctxFog.lineTo(poly[i].x, poly[i].y);
                        }
                        ctxFog.closePath();
                    }
                });
                if (typeof ctxFog.clip === 'function') {
                    ctxFog.clip();
                }
            }

            lightSources.forEach((light) => {
                const tokenRadius = light.tokenRadius || 0;
                const baseBrightDist =
                    (light.lightBright / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1);
                const baseDimDist =
                    (light.lightDim / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1);

                const baseRadiusBright =
                    baseBrightDist > 0
                        ? tokenRadius + baseBrightDist
                        : light.isToken && baseDimDist > 0
                          ? tokenRadius
                          : 0;
                const baseRadiusDim = baseDimDist > 0 ? baseRadiusBright + baseDimDist : baseRadiusBright;
                const nominalMaxRadius = Math.max(baseRadiusBright, baseRadiusDim);

                if (nominalMaxRadius <= 0) return;
                if (
                    !isRectInViewport(
                        light.x - nominalMaxRadius,
                        light.y - nominalMaxRadius,
                        nominalMaxRadius * 2,
                        nominalMaxRadius * 2,
                        200
                    )
                ) {
                    return;
                }

                let effectiveColor = light.lightColor;
                let radMultiplier = 1.0;
                if (light.animationType && light.animationType !== 'none') {
                    const speed = light.animationSpeed || 1.0;
                    const intensity = light.animationIntensity || 0.1;
                    const seed = typeof light.id === 'string' ? (light.id.charCodeAt(0) || 1) * 17 : 42;
                    const phase = nowSec * speed * 2 + seed;

                    if (light.animationType === 'flicker') {
                        const jitter =
                            Math.sin(phase * 3.7) * 0.5 + Math.sin(phase * 7.1) * 0.3 + Math.sin(phase * 13.9) * 0.2;
                        radMultiplier = Math.max(0.7, 1.0 + jitter * intensity);
                    } else if (light.animationType === 'pulse') {
                        const pulse = Math.sin(phase * 0.8) * intensity;
                        radMultiplier = Math.max(0.7, 1.0 + pulse);
                    } else if (light.animationType === 'color_shift') {
                        const t = (Math.sin(phase * 0.9) + 1) / 2;
                        effectiveColor = interpolateColors(light.lightColor, light.animationColor2 || '#ffe082', t);
                        radMultiplier = 1.0 + Math.sin(phase * 1.8) * 0.05 * intensity;
                    }
                }

                const radiusBright =
                    baseBrightDist > 0
                        ? tokenRadius + baseBrightDist * radMultiplier
                        : light.isToken && baseDimDist > 0
                          ? tokenRadius
                          : 0;
                const radiusDim = baseDimDist > 0 ? radiusBright + baseDimDist * radMultiplier : radiusBright;
                const maxRadius = Math.max(radiusBright, radiusDim);
                if (maxRadius <= 0) return;

                const isAngular =
                    typeof light.lightAngle === 'number' && light.lightAngle < 360 && light.lightAngle > 0;

                const cacheKey = `${light.x.toFixed(1)}_${light.y.toFixed(1)}_${light.lightAngle}_${light.lightRotation.toFixed(1)}_${nominalMaxRadius.toFixed(1)}_${wallsVersion}`;
                let visibilityPolygon;
                if (
                    light.sourceEntity &&
                    light.sourceEntity._polyCache &&
                    light.sourceEntity._polyCache.key === cacheKey
                ) {
                    visibilityPolygon = light.sourceEntity._polyCache.polygon;
                } else {
                    visibilityPolygon = computeVisPolyFn(
                        light.x,
                        light.y,
                        nominalMaxRadius,
                        width,
                        height,
                        light.lightAngle,
                        light.lightRotation,
                        null,
                        null,
                        walls,
                        activeSpatialIndex
                    );
                    if (light.sourceEntity) {
                        light.sourceEntity._polyCache = { key: cacheKey, polygon: visibilityPolygon };
                    }
                }
                if (!visibilityPolygon || visibilityPolygon.length < 3) return;

                litPolygons.push(visibilityPolygon);

                const d = Math.max(16, Math.ceil(maxRadius * 2));
                if (scratchLightCanvas.width !== d || scratchLightCanvas.height !== d) {
                    scratchLightCanvas.width = d;
                    scratchLightCanvas.height = d;
                } else {
                    ctxScratchLight.clearRect(0, 0, d, d);
                }

                const centerX = maxRadius;
                const centerY = maxRadius;

                const grad = ctxScratchLight.createRadialGradient
                    ? ctxScratchLight.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius)
                    : null;
                const innerStop = Math.min(1.0, Math.max(0.0, tokenRadius / maxRadius));
                const brightStop = Math.min(1.0, Math.max(0.0, radiusBright / maxRadius));

                if (grad) {
                    if (baseBrightDist > 0) {
                        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                        if (brightStop < 1.0) {
                            grad.addColorStop(brightStop, 'rgba(255, 255, 255, 1.0)');
                            grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
                        } else {
                            grad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');
                        }
                    } else {
                        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                        if (innerStop > 0 && innerStop < 1.0) {
                            grad.addColorStop(innerStop, 'rgba(255, 255, 255, 1.0)');
                            grad.addColorStop(Math.min(1.0, innerStop + 0.01), 'rgba(255, 255, 255, 0.85)');
                        }
                        grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
                    }
                    ctxScratchLight.fillStyle = grad;
                    ctxScratchLight.fillRect(0, 0, d, d);
                }

                if (isAngular && typeof ctxScratchLight.createConicGradient === 'function') {
                    const facingRad = ((light.lightRotation || 0) * Math.PI) / 180;
                    const arcRad = (light.lightAngle * Math.PI) / 180;
                    const featherRad = Math.min(arcRad * 0.2, (12 * Math.PI) / 180);

                    const conic = ctxScratchLight.createConicGradient(facingRad - Math.PI, centerX, centerY);
                    const halfArcNorm = arcRad / 2 / (2 * Math.PI);
                    const featherNorm = featherRad / (2 * Math.PI);
                    const centerStop = 0.5;

                    const startAngleNorm = Math.max(0, centerStop - halfArcNorm);
                    const solidStartNorm = Math.min(1, startAngleNorm + featherNorm);
                    const solidEndNorm = Math.max(0, centerStop + halfArcNorm - featherNorm);
                    const endAngleNorm = Math.min(1, centerStop + halfArcNorm);

                    conic.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    if (startAngleNorm > 0) conic.addColorStop(startAngleNorm, 'rgba(0, 0, 0, 0)');
                    conic.addColorStop(solidStartNorm, 'rgba(255, 255, 255, 1.0)');
                    conic.addColorStop(solidEndNorm, 'rgba(255, 255, 255, 1.0)');
                    conic.addColorStop(endAngleNorm, 'rgba(0, 0, 0, 0)');
                    if (endAngleNorm < 1) conic.addColorStop(1, 'rgba(0, 0, 0, 0)');

                    ctxScratchLight.globalCompositeOperation = 'destination-in';
                    ctxScratchLight.fillStyle = conic;
                    ctxScratchLight.fillRect(0, 0, d, d);
                    ctxScratchLight.globalCompositeOperation = 'source-over';
                }

                ctxFog.save();
                ctxFog.beginPath();
                ctxFog.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
                for (let i = 1; i < visibilityPolygon.length; i++) {
                    ctxFog.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
                }
                ctxFog.closePath();
                if (typeof ctxFog.clip === 'function') {
                    ctxFog.clip();
                }

                ctxFog.globalCompositeOperation = 'destination-out';
                ctxFog.drawImage(scratchLightCanvas, light.x - maxRadius, light.y - maxRadius);
                ctxFog.restore();

                if (!options.ctxFloor && effectiveColor && effectiveColor !== '#ffffff') {
                    ctxFog.save();
                    ctxFog.beginPath();
                    ctxFog.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
                    for (let i = 1; i < visibilityPolygon.length; i++) {
                        ctxFog.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
                    }
                    ctxFog.closePath();
                    if (typeof ctxFog.clip === 'function') {
                        ctxFog.clip();
                    }

                    ctxFog.globalCompositeOperation = 'source-over';

                    let r = 255,
                        g = 255,
                        b = 255;
                    if (effectiveColor.startsWith('rgb')) {
                        const parts = effectiveColor.match(/\d+/g);
                        if (parts && parts.length >= 3) {
                            r = parseInt(parts[0], 10);
                            g = parseInt(parts[1], 10);
                            b = parseInt(parts[2], 10);
                        }
                    } else {
                        const hex = effectiveColor.replace('#', '');
                        r = parseInt(hex.substring(0, 2), 16) || 255;
                        g = parseInt(hex.substring(2, 4), 16) || 255;
                        b = parseInt(hex.substring(4, 6), 16) || 255;
                    }

                    const tintGrad = ctxFog.createRadialGradient
                        ? ctxFog.createRadialGradient(light.x, light.y, 0, light.x, light.y, maxRadius)
                        : null;
                    if (tintGrad) {
                        tintGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
                        if (baseBrightDist > 0 && brightStop < 1.0) {
                            tintGrad.addColorStop(brightStop, `rgba(${r}, ${g}, ${b}, 0.20)`);
                        }
                        tintGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
                        ctxFog.fillStyle = tintGrad;
                        ctxFog.fill();
                    }
                    ctxFog.restore();
                }
            });

            if (isRestrictedByPlayerVision) {
                ctxFog.restore();
            }
        }
    }

    if (options.ctxFloor) {
        options.ctxFloor.clearRect(0, 0, width, height);
        renderLightFloorWashPass(options.ctxFloor, width, height, {
            ...options,
            playerLosPolygons
        });
    }

    if (anyLightHasAnimation) {
        checkLightingAnimationLoop();
    }

    ctxFog.globalCompositeOperation = 'source-over';
    ctxFog.restore();
    visionPolygons.playerLosPolygons = playerLosPolygons;
    visionPolygons.litPolygons = litPolygons;
    return visionPolygons;
}

export function renderLightFloorWashPass(ctxFloor, width, height, options = {}) {
    if (!ctxFloor) return;
    const {
        vtt = {},
        tokens = {},
        lights = [],
        walls = [],
        wallsVersion = 1,
        grid = { size: 50, scale: 1, feetPerSquare: 5 },
        isRectInViewport = () => true,
        getTokenCenter = (t) => ({ x: t.x + 25, y: t.y + 25 }),
        getTokenDrawDimensions = () => ({ drawW: 50, drawH: 50, tokenRadius: 25 }),
        computeVisPolyFn = computeVisibilityPolygon,
        spatialIndex = null,
        wallSpatialIndex = null,
        playerLosPolygons = null,
        checkLightingAnimationLoop = () => {}
    } = options;

    const activeSpatialIndex = spatialIndex || wallSpatialIndex;
    const lightSources = [];
    const nowSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    let anyLightHasAnimation = false;

    Object.values(tokens).forEach((t) => {
        if (t.lightEnabled) {
            const center = getTokenCenter(t);
            const { drawW, drawH } = getTokenDrawDimensions(t);
            const tokenRadius = Math.max(drawW, drawH) / 2;
            const animType = t.lightAnimationType || 'none';
            if (animType !== 'none') anyLightHasAnimation = true;
            lightSources.push({
                id: t.id,
                x: center.x,
                y: center.y,
                isToken: true,
                tokenRadius: tokenRadius,
                lightBright: parseFloat(t.lightBright) || 0,
                lightDim: parseFloat(t.lightDim) || 0,
                lightColor: t.lightColor || '#ffffff',
                lightAngle: t.lightAngle !== undefined ? parseFloat(t.lightAngle) : 360,
                lightRotation: getTokenEffectiveLightFacing(t),
                animationType: animType,
                animationSpeed: parseFloat(t.lightAnimationSpeed) || 1.0,
                animationIntensity: parseFloat(t.lightAnimationIntensity) || 0.1,
                animationColor2: t.lightAnimationColor2 || '#ffe082',
                sourceEntity: t
            });
        }
    });

    lights.forEach((l) => {
        const animType = l.animationType || 'none';
        if (animType !== 'none') anyLightHasAnimation = true;
        lightSources.push({
            id: l.id,
            x: l.x,
            y: l.y,
            isToken: false,
            tokenRadius: 0,
            lightBright: parseFloat(l.lightBright) || 0,
            lightDim: parseFloat(l.lightDim) || 0,
            lightColor: l.lightColor || '#ffffff',
            lightAngle: l.lightAngle !== undefined ? parseFloat(l.lightAngle) : 360,
            lightRotation: l.lightRotation !== undefined ? parseFloat(l.lightRotation) : 0,
            animationType: animType,
            animationSpeed: parseFloat(l.animationSpeed) || 1.0,
            animationIntensity: parseFloat(l.animationIntensity) || 0.1,
            animationColor2: l.animationColor2 || '#ffe082',
            sourceEntity: l
        });
    });

    if (lightSources.length === 0) return;

    const isRestrictedByPlayerVision =
        playerLosPolygons && playerLosPolygons.length > 0 && (vtt.role !== 'GM' || options.gmTokenVisionMode);
    if (isRestrictedByPlayerVision) {
        ctxFloor.save();
        ctxFloor.beginPath();
        playerLosPolygons.forEach((poly) => {
            if (poly && poly.length > 2) {
                ctxFloor.moveTo(poly[0].x, poly[0].y);
                for (let i = 1; i < poly.length; i++) {
                    ctxFloor.lineTo(poly[i].x, poly[i].y);
                }
                ctxFloor.closePath();
            }
        });
        if (typeof ctxFloor.clip === 'function') {
            ctxFloor.clip();
        }
    }

    lightSources.forEach((light) => {
        const tokenRadius = light.tokenRadius || 0;
        const baseBrightDist = (light.lightBright / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1);
        const baseDimDist = (light.lightDim / (grid.feetPerSquare || 5)) * (grid.size || 50) * (grid.scale || 1);

        const baseRadiusBright =
            baseBrightDist > 0 ? tokenRadius + baseBrightDist : light.isToken && baseDimDist > 0 ? tokenRadius : 0;
        const baseRadiusDim = baseDimDist > 0 ? baseRadiusBright + baseDimDist : baseRadiusBright;
        const nominalMaxRadius = Math.max(baseRadiusBright, baseRadiusDim);

        if (nominalMaxRadius <= 0) return;
        if (
            !isRectInViewport(
                light.x - nominalMaxRadius,
                light.y - nominalMaxRadius,
                nominalMaxRadius * 2,
                nominalMaxRadius * 2,
                200
            )
        ) {
            return;
        }

        let effectiveColor = light.lightColor;
        if (!effectiveColor || effectiveColor === '#ffffff' || effectiveColor.toLowerCase() === '#fff') return;

        let radMultiplier = 1.0;
        if (light.animationType && light.animationType !== 'none') {
            const speed = light.animationSpeed || 1.0;
            const intensity = light.animationIntensity || 0.1;
            const seed = typeof light.id === 'string' ? (light.id.charCodeAt(0) || 1) * 17 : 42;
            const phase = nowSec * speed * 2 + seed;

            if (light.animationType === 'flicker') {
                const jitter = Math.sin(phase * 3.7) * 0.5 + Math.sin(phase * 7.1) * 0.3 + Math.sin(phase * 13.9) * 0.2;
                radMultiplier = Math.max(0.7, 1.0 + jitter * intensity);
            } else if (light.animationType === 'pulse') {
                const pulse = Math.sin(phase * 0.8) * intensity;
                radMultiplier = Math.max(0.7, 1.0 + pulse);
            } else if (light.animationType === 'color_shift') {
                const t = (Math.sin(phase * 0.9) + 1) / 2;
                effectiveColor = interpolateColors(light.lightColor, light.animationColor2 || '#ffe082', t);
                radMultiplier = 1.0 + Math.sin(phase * 1.8) * 0.05 * intensity;
            }
        }

        const radiusBright =
            baseBrightDist > 0
                ? tokenRadius + baseBrightDist * radMultiplier
                : light.isToken && baseDimDist > 0
                  ? tokenRadius
                  : 0;
        const radiusDim = baseDimDist > 0 ? radiusBright + baseDimDist * radMultiplier : radiusBright;
        const maxRadius = Math.max(radiusBright, radiusDim);
        if (maxRadius <= 0) return;

        const brightStop = Math.min(1.0, Math.max(0.0, radiusBright / maxRadius));
        const cacheKey = `${light.x.toFixed(1)}_${light.y.toFixed(1)}_${light.lightAngle}_${light.lightRotation.toFixed(1)}_${nominalMaxRadius.toFixed(1)}_${wallsVersion}`;
        let visibilityPolygon;
        if (light.sourceEntity && light.sourceEntity._polyCache && light.sourceEntity._polyCache.key === cacheKey) {
            visibilityPolygon = light.sourceEntity._polyCache.polygon;
        } else {
            visibilityPolygon = computeVisPolyFn(
                light.x,
                light.y,
                nominalMaxRadius,
                width,
                height,
                light.lightAngle,
                light.lightRotation,
                null,
                null,
                walls,
                activeSpatialIndex
            );
            if (light.sourceEntity) {
                light.sourceEntity._polyCache = { key: cacheKey, polygon: visibilityPolygon };
            }
        }
        if (!visibilityPolygon || visibilityPolygon.length < 3) return;

        let r = 255,
            g = 255,
            b = 255;
        if (effectiveColor.startsWith('rgb')) {
            const parts = effectiveColor.match(/\d+/g);
            if (parts && parts.length >= 3) {
                r = parseInt(parts[0], 10);
                g = parseInt(parts[1], 10);
                b = parseInt(parts[2], 10);
            }
        } else {
            const hex = effectiveColor.replace('#', '');
            r = parseInt(hex.substring(0, 2), 16) || 255;
            g = parseInt(hex.substring(2, 4), 16) || 255;
            b = parseInt(hex.substring(4, 6), 16) || 255;
        }

        ctxFloor.save();
        ctxFloor.beginPath();
        ctxFloor.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
        for (let i = 1; i < visibilityPolygon.length; i++) {
            ctxFloor.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
        }
        ctxFloor.closePath();
        if (typeof ctxFloor.clip === 'function') {
            ctxFloor.clip();
        }

        ctxFloor.globalCompositeOperation = 'source-over';
        const tintGrad = ctxFloor.createRadialGradient
            ? ctxFloor.createRadialGradient(light.x, light.y, 0, light.x, light.y, maxRadius)
            : null;
        if (tintGrad) {
            tintGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
            if (baseBrightDist > 0 && brightStop < 1.0) {
                tintGrad.addColorStop(brightStop, `rgba(${r}, ${g}, ${b}, 0.20)`);
            }
            tintGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
            ctxFloor.fillStyle = tintGrad;
            ctxFloor.fill();
        }
        ctxFloor.restore();
    });

    if (isRestrictedByPlayerVision) {
        ctxFloor.restore();
    }

    if (anyLightHasAnimation && typeof checkLightingAnimationLoop === 'function') {
        checkLightingAnimationLoop();
    }
}
