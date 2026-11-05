/**
 * vtt-canvas-interaction-walls.js
 * Renders GM wall segments, door/window outlines, swing arcs, hinges,
 * measurement overlays, and standalone lighting emitters onto interaction canvas.
 */

import { getWallCoordinatesForRaycasting as getWallCoordsDefault } from './vtt-canvas-visibility.js';
import { drawMeasurementTemplate as drawMeasureDefault } from './vtt-canvas-measure.js';

export function renderGmWallSegmentsPass(ctxInteraction, options = {}) {
    const vtt = options.vtt || {};
    const grid = options.grid || null;
    const activeLayer = options.activeLayer;
    const walls = options.walls || [];
    const selectedWallIdx = options.selectedWallIdx;
    const selectedWallIdxs = options.selectedWallIdxs || new Set();
    const hoveredWallIdx = options.hoveredWallIdx;
    const isRectInViewport = options.isRectInViewport || (() => true);
    const getWallCoordinatesForRaycasting = options.getWallCoordinatesForRaycasting || getWallCoordsDefault;
    const otherMeasurements = options.otherMeasurements || {};
    const currentMapId = options.currentMapId;
    const drawMeasurementTemplate = options.drawMeasurementTemplate || drawMeasureDefault;
    const hoveredWallVertex = options.hoveredWallVertex || null;
    const isDrawingWall = Boolean(options.isDrawingWall);
    const wallStartPoint = options.wallStartPoint || null;
    const getCanvasMouseCoords = options.getCanvasMouseCoords || (() => ({ x: 0, y: 0 }));
    const lastMouseEvent = options.lastMouseEvent || null;
    const snapToGrid = options.snapToGrid || ((x, y) => ({ x, y }));
    const currentLightingType = options.currentLightingType || 'wall';
    const currentWallShape = options.currentWallShape || 'line';
    const isPointVisible = options.isPointVisible || (() => true);
    const localIsShaping = Boolean(options.localIsShaping);
    const localShapeStart = options.localShapeStart || null;
    const localShapeEnd = options.localShapeEnd || null;
    const measureAnchorPoints = options.measureAnchorPoints || [];
    const localIsMeasuring = Boolean(options.localIsMeasuring);
    const localMeasureStart = options.localMeasureStart || null;
    const localMeasureEnd = options.localMeasureEnd || null;
    const isTokenMeasuring = Boolean(options.isTokenMeasuring);
    const resolveRulerPortalBending = options.resolveRulerPortalBending || null;
    const zoom = options.zoom || 1.0;

    // 1. Draw GM Wall Segments if in GM mode
    if (vtt.role === 'GM') {
        const isLightingActive = activeLayer === 'lighting';
        ctxInteraction.save();

        if (!isLightingActive) {
            ctxInteraction.globalAlpha = 0.2; // Fade walls to 20% opacity unless in Lighting Layer
        }
        walls.forEach((wall, idx) => {
            const isSelected = selectedWallIdx === idx || selectedWallIdxs.has(idx);
            const isHovered = hoveredWallIdx === idx;
            const minWX = Math.min(wall.x1, wall.x2);
            const maxWX = Math.max(wall.x1, wall.x2);
            const minWY = Math.min(wall.y1, wall.y2);
            const maxWY = Math.max(wall.y1, wall.y2);
            if (!isSelected && !isHovered && !isRectInViewport(minWX, minWY, maxWX - minWX, maxWY - minWY, 200)) {
                return;
            }
            if (wall.type === 'door' || wall.type === 'window') {
                // Draw Interactive Object for GM (rotated if open)
                const activeCoords = getWallCoordinatesForRaycasting(wall) || {
                    x1: wall.x1,
                    y1: wall.y1,
                    x2: wall.x2,
                    y2: wall.y2
                };
                const midX = (activeCoords.x1 + activeCoords.x2) / 2;
                const midY = (activeCoords.y1 + activeCoords.y2) / 2;
                // Draw faint closed guide if open and hinged
                if (wall.isOpen && wall.hasHinge) {
                    ctxInteraction.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctxInteraction.lineWidth = 1;
                    ctxInteraction.setLineDash([2, 2]);
                    ctxInteraction.beginPath();
                    ctxInteraction.moveTo(wall.x1, wall.y1);
                    ctxInteraction.lineTo(wall.x2, wall.y2);
                    ctxInteraction.stroke();
                    ctxInteraction.setLineDash([]);
                }
                // Choose colors based on door state: open, closed, locked
                let strokeCol = 'rgba(253, 126, 20, 0.9)'; // closed (orange)
                let handleCol = '#fd7e14';
                let doorSymbol = '🚪';
                if (wall.type === 'window') {
                    strokeCol = 'rgba(13, 202, 240, 0.9)'; // window (cyan)
                    handleCol = '#0dcaf0';
                    doorSymbol = '🪟';
                }
                if (wall.isOpen) {
                    strokeCol = wall.type === 'window' ? 'rgba(13, 202, 240, 0.5)' : 'rgba(40, 167, 69, 0.8)'; // open
                    handleCol = wall.type === 'window' ? '#0dcaf0' : '#28a745';
                    doorSymbol = wall.type === 'window' ? '🌫️' : '🔓';
                } else if (wall.isLocked) {
                    strokeCol = 'rgba(220, 53, 69, 0.9)'; // locked (red)
                    handleCol = '#dc3545';
                    doorSymbol = '🔒';
                }
                if (isSelected) {
                    strokeCol = '#ffc107'; // yellow for selected segment
                } else if (isHovered) {
                    strokeCol = '#fd7e14';
                }
                ctxInteraction.strokeStyle = strokeCol;
                ctxInteraction.lineWidth = isLightingActive ? (isSelected ? 6 : 4) : 2;
                if (wall.isOpen) {
                    ctxInteraction.setLineDash([4, 4]);
                }
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(activeCoords.x1, activeCoords.y1);
                ctxInteraction.lineTo(activeCoords.x2, activeCoords.y2);
                ctxInteraction.stroke();
                ctxInteraction.setLineDash([]);
                // Draw interactive circle handle(s) along the line
                const segDx = activeCoords.x2 - activeCoords.x1;
                const segDy = activeCoords.y2 - activeCoords.y1;
                const segLen = Math.hypot(segDx, segDy);
                const uX = segLen > 0 ? segDx / segLen : 1;
                const uY = segLen > 0 ? segDy / segLen : 0;
                // Check if one-way vision/light indicator should be drawn
                if (wall.oneWay && wall.oneWay !== 'none') {
                    const perpX = -uY * 4;
                    const perpY = uX * 4;
                    const seeThroughDir = wall.oneWay === 'left' ? 1 : -1;
                    ctxInteraction.save();
                    // Green dashed line on see-through side
                    ctxInteraction.strokeStyle = '#28a745';
                    ctxInteraction.lineWidth = 2.5;
                    ctxInteraction.setLineDash([4, 3]);
                    ctxInteraction.beginPath();
                    ctxInteraction.moveTo(
                        activeCoords.x1 + perpX * seeThroughDir,
                        activeCoords.y1 + perpY * seeThroughDir
                    );
                    ctxInteraction.lineTo(
                        activeCoords.x2 + perpX * seeThroughDir,
                        activeCoords.y2 + perpY * seeThroughDir
                    );
                    ctxInteraction.stroke();
                    // Red solid line on blocked side
                    ctxInteraction.strokeStyle = '#dc3545';
                    ctxInteraction.lineWidth = 2.5;
                    ctxInteraction.setLineDash([]);
                    ctxInteraction.beginPath();
                    ctxInteraction.moveTo(
                        activeCoords.x1 - perpX * seeThroughDir,
                        activeCoords.y1 - perpY * seeThroughDir
                    );
                    ctxInteraction.lineTo(
                        activeCoords.x2 - perpX * seeThroughDir,
                        activeCoords.y2 - perpY * seeThroughDir
                    );
                    ctxInteraction.stroke();
                    ctxInteraction.restore();
                }
                // 1. Open/Close toggle (ALWAYS DEAD CENTER)
                ctxInteraction.fillStyle = handleCol;
                ctxInteraction.strokeStyle = isSelected ? '#ffc107' : '#ffffff';
                ctxInteraction.lineWidth = isSelected ? 2.5 : 1.5;
                ctxInteraction.beginPath();
                ctxInteraction.arc(midX, midY, isSelected ? 12 : 10, 0, Math.PI * 2);
                ctxInteraction.fill();
                ctxInteraction.stroke();

                ctxInteraction.fillStyle = '#ffffff';
                ctxInteraction.font = isSelected ? 'bold 11px Inter' : '9px Inter';
                ctxInteraction.textAlign = 'center';
                ctxInteraction.textBaseline = 'middle';
                ctxInteraction.fillText(doorSymbol, midX, midY);
                // 2. Settings Cog for GM (Cleanly off-center)
                const cogDist = Math.min(22, Math.max(16, segLen * 0.28));
                const cogX = midX + uX * cogDist;
                const cogY = midY + uY * cogDist;
                ctxInteraction.fillStyle = '#1e232d';
                ctxInteraction.strokeStyle = isSelected ? '#ffc107' : 'rgba(255,255,255,0.7)';
                ctxInteraction.lineWidth = isSelected ? 2.0 : 1.2;
                ctxInteraction.beginPath();
                ctxInteraction.arc(cogX, cogY, isSelected ? 10 : 8.5, 0, Math.PI * 2);
                ctxInteraction.fill();
                ctxInteraction.stroke();
                ctxInteraction.fillStyle = '#ffc107';
                ctxInteraction.font = isSelected ? '10px Inter' : '8.5px Inter';
                ctxInteraction.textAlign = 'center';
                ctxInteraction.textBaseline = 'middle';
                ctxInteraction.fillText('⚙️', cogX, cogY);
                // Draw hinge pivot indicator if GM and lighting layer is active
                if (wall.hasHinge && isLightingActive) {
                    const hx = wall.hingeEndpoint === 1 ? wall.x1 : wall.x2;
                    const hy = wall.hingeEndpoint === 1 ? wall.y1 : wall.y2;
                    ctxInteraction.fillStyle = 'rgba(18, 22, 33, 0.95)';
                    ctxInteraction.strokeStyle = 'var(--color-gold-base)';
                    ctxInteraction.lineWidth = 1.5;
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(hx, hy, 6, 0, Math.PI * 2);
                    ctxInteraction.fill();
                    ctxInteraction.stroke();
                    ctxInteraction.fillStyle = 'var(--color-gold-base)';
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(hx, hy, 2, 0, Math.PI * 2);
                    ctxInteraction.fill();
                }
                // Draw end handles if active or selected/hovered in Lighting layer
                if (isLightingActive) {
                    // Endpoint 1
                    const isVertex1Hovered =
                        hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 1;
                    ctxInteraction.fillStyle = isVertex1Hovered ? '#ffffff' : '#ffc107';
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(wall.x1, wall.y1, isVertex1Hovered ? 6 : 4, 0, Math.PI * 2);
                    ctxInteraction.fill();
                    if (isVertex1Hovered) {
                        ctxInteraction.strokeStyle = '#ffc107';
                        ctxInteraction.lineWidth = 1.5;
                        ctxInteraction.stroke();
                    }
                    // Endpoint 2
                    const isVertex2Hovered =
                        hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 2;
                    ctxInteraction.fillStyle = isVertex2Hovered ? '#ffffff' : '#ffc107';
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(wall.x2, wall.y2, isVertex2Hovered ? 6 : 4, 0, Math.PI * 2);
                    ctxInteraction.fill();
                    if (isVertex2Hovered) {
                        ctxInteraction.strokeStyle = '#ffc107';
                        ctxInteraction.lineWidth = 1.5;
                        ctxInteraction.stroke();
                    }
                }
            } else {
                // Draw normal wall for GM
                ctxInteraction.strokeStyle = isSelected ? '#ffc107' : isHovered ? '#fd7e14' : '#dc3545';
                ctxInteraction.lineWidth = isLightingActive ? (isSelected ? 6 : 4) : 2;
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(wall.x1, wall.y1);
                ctxInteraction.lineTo(wall.x2, wall.y2);
                ctxInteraction.stroke();
                const segDx = wall.x2 - wall.x1;
                const segDy = wall.y2 - wall.y1;
                const segLen = Math.hypot(segDx, segDy);
                const uX = segLen > 0 ? segDx / segLen : 1;
                const uY = segLen > 0 ? segDy / segLen : 0;
                const midX = (wall.x1 + wall.x2) / 2;
                const midY = (wall.y1 + wall.y2) / 2;
                // One-way indicator lines for normal walls
                if (wall.oneWay && wall.oneWay !== 'none') {
                    const perpX = -uY * 4;
                    const perpY = uX * 4;
                    const seeThroughDir = wall.oneWay === 'left' ? 1 : -1;
                    ctxInteraction.save();
                    // Green dashed line on see-through side
                    ctxInteraction.strokeStyle = '#28a745';
                    ctxInteraction.lineWidth = 2.5;
                    ctxInteraction.setLineDash([4, 3]);
                    ctxInteraction.beginPath();
                    ctxInteraction.moveTo(wall.x1 + perpX * seeThroughDir, wall.y1 + perpY * seeThroughDir);
                    ctxInteraction.lineTo(wall.x2 + perpX * seeThroughDir, wall.y2 + perpY * seeThroughDir);
                    ctxInteraction.stroke();
                    // Red solid line on blocked side
                    ctxInteraction.strokeStyle = '#dc3545';
                    ctxInteraction.lineWidth = 2.5;
                    ctxInteraction.setLineDash([]);
                    ctxInteraction.beginPath();
                    ctxInteraction.moveTo(wall.x1 - perpX * seeThroughDir, wall.y1 - perpY * seeThroughDir);
                    ctxInteraction.lineTo(wall.x2 - perpX * seeThroughDir, wall.y2 - perpY * seeThroughDir);
                    ctxInteraction.stroke();
                    ctxInteraction.restore();
                }
                // Draw Settings Cog at midpoint if in Lighting Layer or hovered/selected
                if (isLightingActive || isSelected || isHovered) {
                    ctxInteraction.fillStyle = '#1e232d';
                    ctxInteraction.strokeStyle = isSelected ? '#ffc107' : '#fd7e14';
                    ctxInteraction.lineWidth = isSelected ? 2.0 : 1.2;
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(midX, midY, isSelected ? 10 : 8.5, 0, Math.PI * 2);
                    ctxInteraction.fill();
                    ctxInteraction.stroke();
                    ctxInteraction.fillStyle = '#ffc107';
                    ctxInteraction.font = isSelected ? '10px Inter' : '8.5px Inter';
                    ctxInteraction.textAlign = 'center';
                    ctxInteraction.textBaseline = 'middle';
                    ctxInteraction.fillText('⚙️', midX, midY);
                }
                // Draw end handles (only visible in Lighting Layer)
                if (isLightingActive) {
                    // Endpoint 1
                    const isVertex1Hovered =
                        hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 1;
                    ctxInteraction.fillStyle = isVertex1Hovered ? '#ffffff' : '#ffc107';
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(wall.x1, wall.y1, isVertex1Hovered ? 6 : 4, 0, Math.PI * 2);
                    ctxInteraction.fill();
                    if (isVertex1Hovered) {
                        ctxInteraction.strokeStyle = '#ffc107';
                        ctxInteraction.lineWidth = 1.5;
                        ctxInteraction.stroke();
                    }
                    // Endpoint 2
                    const isVertex2Hovered =
                        hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 2;
                    ctxInteraction.fillStyle = isVertex2Hovered ? '#ffffff' : '#ffc107';
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(wall.x2, wall.y2, isVertex2Hovered ? 6 : 4, 0, Math.PI * 2);
                    ctxInteraction.fill();
                    if (isVertex2Hovered) {
                        ctxInteraction.strokeStyle = '#ffc107';
                        ctxInteraction.lineWidth = 1.5;
                        ctxInteraction.stroke();
                    }
                }
            }
        });
        // Draw current active wall segment/shape in progress
        if (isDrawingWall && wallStartPoint) {
            const mouse = getCanvasMouseCoords(lastMouseEvent);
            const p1 = wallStartPoint;
            const p2 = lastMouseEvent && lastMouseEvent.altKey ? mouse : snapToGrid(mouse.x, mouse.y);

            ctxInteraction.strokeStyle =
                currentLightingType === 'door' ? '#fd7e14' : currentLightingType === 'window' ? '#0dcaf0' : '#ffc107';
            ctxInteraction.lineWidth = 3;
            ctxInteraction.setLineDash([6, 6]);
            if (currentLightingType === 'wall' && currentWallShape === 'rect') {
                ctxInteraction.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            } else if (currentLightingType === 'wall' && currentWallShape === 'circle') {
                const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                ctxInteraction.beginPath();
                ctxInteraction.arc(p1.x, p1.y, r, 0, Math.PI * 2);
                ctxInteraction.stroke();
            } else if (currentLightingType === 'wall' && currentWallShape === 'arc') {
                const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                ctxInteraction.beginPath();
                ctxInteraction.arc(p1.x, p1.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
                ctxInteraction.stroke();
            } else {
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(p1.x, p1.y);
                ctxInteraction.lineTo(p2.x, p2.y);
                ctxInteraction.stroke();
            }
            ctxInteraction.setLineDash([]);
        }
        ctxInteraction.restore();
    } else {
        // Visible tokens and map assets are rendered via the DOM overlay layer (#vtt-html-overlays / #vtt-map-html-overlays).
        // Interactive doors and windows for players:
        walls.forEach((wall) => {
            if (wall.type !== 'door' && wall.type !== 'window') return;
            if (wall.isSecret && vtt.role !== 'GM') return;

            const activeCoords = getWallCoordinatesForRaycasting(wall) || {
                x1: wall.x1,
                y1: wall.y1,
                x2: wall.x2,
                y2: wall.y2
            };
            const midX = (activeCoords.x1 + activeCoords.x2) / 2;
            const midY = (activeCoords.y1 + activeCoords.y2) / 2;

            const segDx = activeCoords.x2 - activeCoords.x1;
            const segDy = activeCoords.y2 - activeCoords.y1;
            const segLen = Math.hypot(segDx, segDy);
            const nx = segLen > 0 ? -segDy / segLen : 0;
            const ny = segLen > 0 ? segDx / segLen : 0;
            // Visible if midpoint or either side of wall normal is visible in player LOS
            const isSide1Vis = isPointVisible(midX + nx * 6, midY + ny * 6);
            const isSide2Vis = isPointVisible(midX - nx * 6, midY - ny * 6);
            const isCenterVis = isPointVisible(midX, midY);
            if (!isSide1Vis && !isSide2Vis && !isCenterVis) return;
            let strokeCol = 'rgba(253, 126, 20, 0.8)'; // closed
            let handleCol = '#fd7e14';
            let doorSymbol = '🚪';
            if (wall.type === 'window') {
                strokeCol = 'rgba(13, 202, 240, 0.8)'; // window (cyan)
                handleCol = '#0dcaf0';
                doorSymbol = '🪟';
            }
            if (wall.isOpen) {
                strokeCol = wall.type === 'window' ? 'rgba(13, 202, 240, 0.5)' : 'rgba(40, 167, 69, 0.7)'; // open
                handleCol = wall.type === 'window' ? '#0dcaf0' : '#28a745';
                doorSymbol = '🔓';
            } else if (wall.isLocked && !wall.isSecret) {
                strokeCol = 'rgba(220, 53, 69, 0.8)'; // locked (red)
                handleCol = '#dc3545';
                doorSymbol = '🔒';
            }
            ctxInteraction.strokeStyle = strokeCol;
            ctxInteraction.lineWidth = 2;
            if (wall.isOpen) {
                ctxInteraction.setLineDash([4, 4]);
            }
            ctxInteraction.beginPath();
            ctxInteraction.moveTo(activeCoords.x1, activeCoords.y1);
            ctxInteraction.lineTo(activeCoords.x2, activeCoords.y2);
            ctxInteraction.stroke();
            ctxInteraction.setLineDash([]);
            // Open/Close toggle (ALWAYS DEAD CENTER on line for players)
            ctxInteraction.fillStyle = handleCol;
            ctxInteraction.strokeStyle = '#ffffff';
            ctxInteraction.lineWidth = 1.2;
            ctxInteraction.beginPath();
            ctxInteraction.arc(midX, midY, 9.5, 0, Math.PI * 2);
            ctxInteraction.fill();
            ctxInteraction.stroke();

            ctxInteraction.fillStyle = '#ffffff';
            ctxInteraction.font = '8.5px Inter';
            ctxInteraction.textAlign = 'center';
            ctxInteraction.textBaseline = 'middle';
            ctxInteraction.fillText(doorSymbol, midX, midY);
        });
    }
    // Draw live shapes/measurements for everyone (Moved out of GM-only block)
    if (typeof localIsShaping !== 'undefined' && localIsShaping && localShapeStart && localShapeEnd) {
        const rawShape = document.getElementById('measure-shape')?.value || 'circle';
        const color = document.getElementById('measure-color')?.value || '#00ffff';
        const anchor = document.getElementById('measure-square-anchor')?.value || 'center';
        const beamW = parseFloat(document.getElementById('measure-beam-width')?.value || 5);
        const points =
            rawShape === 'line' && measureAnchorPoints.length > 0 ? [...measureAnchorPoints, localShapeEnd] : null;
        drawMeasurementTemplate(
            ctxInteraction,
            localShapeStart,
            localShapeEnd,
            rawShape,
            anchor,
            beamW,
            color,
            vtt.username,
            null,
            points,
            true,
            grid,
            resolveRulerPortalBending,
            zoom
        );
    }
    if (localIsMeasuring && localMeasureStart && localMeasureEnd) {
        const rawShape = isTokenMeasuring ? 'line' : document.getElementById('measure-shape')?.value || 'line';
        const color = document.getElementById('measure-color')?.value || '#00ffff';
        const anchor = document.getElementById('measure-square-anchor')?.value || 'center';
        const beamW = parseFloat(document.getElementById('measure-beam-width')?.value || 5);
        const points =
            rawShape === 'line' && measureAnchorPoints.length > 0 ? [...measureAnchorPoints, localMeasureEnd] : null;
        drawMeasurementTemplate(
            ctxInteraction,
            localMeasureStart,
            localMeasureEnd,
            rawShape,
            anchor,
            beamW,
            color,
            vtt.username,
            null,
            points,
            true,
            grid,
            resolveRulerPortalBending,
            zoom
        );
    }
    if (typeof otherMeasurements !== 'undefined') {
        Object.values(otherMeasurements).forEach((m) => {
            if (m.start && m.end && m.mapId === currentMapId) {
                drawMeasurementTemplate(
                    ctxInteraction,
                    m.start,
                    m.end,
                    m.shape || 'line',
                    m.squareAnchor || 'center',
                    m.beamWidth || 5,
                    m.color || '#00ffff',
                    m.username,
                    null,
                    m.points || null,
                    m.showDistance !== false,
                    grid,
                    resolveRulerPortalBending,
                    zoom
                );
            }
        });
    }
}

export function renderStandaloneLightsInteractionPass(ctxInteraction, options = {}) {
    const vtt = options.vtt || {};
    const activeLayer = options.activeLayer;
    if (vtt.role !== 'GM' || activeLayer !== 'lighting') return;
    const lights = options.lights || [];
    const selectedLightId = options.selectedLightId;
    const hoveredLightId = options.hoveredLightId;
    const isRectInViewport = options.isRectInViewport || (() => true);

    // 1.2 Draw Standalone Light Emitters (GM only, when Lighting layer is active)
    if (vtt.role === 'GM' && activeLayer === 'lighting') {
        lights.forEach((light) => {
            const isSelected = selectedLightId === light.id;
            const isHovered = hoveredLightId === light.id;
            if (!isSelected && !isHovered && !isRectInViewport(light.x - 20, light.y - 20, 40, 40, 100)) return;

            ctxInteraction.fillStyle = isSelected ? '#ffc107' : light.lightColor || '#ffaa00';
            ctxInteraction.strokeStyle = isHovered ? '#0dcaf0' : '#ffffff';
            ctxInteraction.lineWidth = isSelected || isHovered ? 2 : 1;

            // Draw light icon background
            ctxInteraction.beginPath();
            ctxInteraction.arc(light.x, light.y, 12, 0, Math.PI * 2);
            ctxInteraction.fill();
            ctxInteraction.stroke();
            // Draw lightbulb emoji
            ctxInteraction.fillStyle = '#ffffff';
            ctxInteraction.font = '12px Inter';
            ctxInteraction.textAlign = 'center';
            ctxInteraction.textBaseline = 'middle';
            ctxInteraction.fillText('💡', light.x, light.y);
            // Draw rotation handle and directional cone guide if angular light and selected
            if (isSelected && light.lightAngle && light.lightAngle < 360) {
                const facing = ((light.lightRotation || 0) * Math.PI) / 180;
                const arc = (light.lightAngle * Math.PI) / 180;
                const hx = light.x + Math.cos(facing) * 36;
                const hy = light.y + Math.sin(facing) * 36;
                ctxInteraction.save();
                ctxInteraction.strokeStyle = 'rgba(255, 170, 0, 0.7)';
                ctxInteraction.lineWidth = 1.5;
                ctxInteraction.setLineDash([3, 3]);
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(light.x, light.y);
                ctxInteraction.lineTo(
                    light.x + Math.cos(facing - arc / 2) * 55,
                    light.y + Math.sin(facing - arc / 2) * 55
                );
                ctxInteraction.moveTo(light.x, light.y);
                ctxInteraction.lineTo(
                    light.x + Math.cos(facing + arc / 2) * 55,
                    light.y + Math.sin(facing + arc / 2) * 55
                );
                ctxInteraction.stroke();
                ctxInteraction.setLineDash([]);
                // Direction line to handle
                ctxInteraction.strokeStyle = '#ffc107';
                ctxInteraction.lineWidth = 2;
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(light.x, light.y);
                ctxInteraction.lineTo(hx, hy);
                ctxInteraction.stroke();
                // Rotation handle circle
                ctxInteraction.beginPath();
                ctxInteraction.arc(hx, hy, 5.5, 0, Math.PI * 2);
                ctxInteraction.fillStyle = '#ffc107';
                ctxInteraction.fill();
                ctxInteraction.strokeStyle = '#ffffff';
                ctxInteraction.lineWidth = 1.5;
                ctxInteraction.stroke();
                ctxInteraction.restore();
            }
        });
    }
}
