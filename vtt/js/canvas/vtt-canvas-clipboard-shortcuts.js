/**
 * vtt-canvas-clipboard-shortcuts.js
 * Multi-entity clipboard (tokens, walls, lights, shapes), deletion,
 * and keyboard shortcut orchestrator.
 */

import { calcPortalCenter } from './vtt-canvas-portals.js';
import { distToSegmentSq } from './vtt-canvas-traps.js';
import { getLineIntersection } from './vtt-canvas-visibility.js';
import {
    cancelCameraAnimation as cancelCameraAnimationExt,
    updateContainerTransform as updateContainerTransformExt
} from './vtt-canvas-camera.js';
import { snapToGridCenter as snapToGridCenterExt } from './vtt-canvas-grid-renderer.js';

export function setupKeyboardShortcuts(ctx = {}) {
    const vtt = ctx.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    let lastBackquoteTime = 0;
    let isLayerShortcutModifierDown = false;
    if (!ctx.measureAnchorPoints) ctx.measureAnchorPoints = [];

    const updateContainerTransform = ctx.updateContainerTransform || (() => updateContainerTransformExt(ctx));
    const cancelCameraAnimation = ctx.cancelCameraAnimation || (() => cancelCameraAnimationExt());
    const getTokenDrawDimensions =
        ctx.getTokenDrawDimensions || ((t) => ({ drawW: t?.width || 50, drawH: t?.height || 50 }));
    const cancelMapToolDrawing = ctx.cancelMapToolDrawing || (() => {});
    const snapToGridCenter = ctx.snapToGridCenter || ((x, y) => snapToGridCenterExt(x, y, ctx.grid));

    function deleteSelection() {
        let changedTokens = false;
        let changedShapes = false;
        let changedWalls = false;
        let changedLights = false;

        if (ctx.selectedTokenIds.size > 0) {
            ctx.selectedTokenIds.forEach((id) => {
                const t = ctx.tokens[id];
                if (t && (t.layer === 'map' || t.isBackground) && t.isAsset) return; // Protect map artwork
                if (ctx.isTokenControlledByPlayer(t)) {
                    if (typeof ctx.cleanupYouTubePingPongForId === 'function') ctx.cleanupYouTubePingPongForId(id);
                    delete ctx.tokens[id];
                }
            });
            ctx.selectedTokenIds.clear();
            ctx.selectedTokenId = null;
            changedTokens = true;
        }

        if (typeof ctx.selectedShapeIds !== 'undefined' && ctx.selectedShapeIds.size > 0) {
            ctx.selectedShapeIds.forEach((id) => {
                const s = ctx.shapes[id];
                if (s && ctx.isShapeControlledByPlayer(s)) {
                    delete ctx.shapes[id];
                    changedShapes = true;
                }
            });
            ctx.selectedShapeIds.clear();
        } else if (ctx.selectedShapeId) {
            const s = ctx.shapes[ctx.selectedShapeId];
            if (s && ctx.isShapeControlledByPlayer(s)) {
                delete ctx.shapes[ctx.selectedShapeId];
                changedShapes = true;
            }
            ctx.selectedShapeId = null;
            ctx.selectedShapeComponent = null;
        }

        if (typeof ctx.selectedWallIdxs !== 'undefined' && ctx.selectedWallIdxs.size > 0) {
            const sortedIdxs = Array.from(ctx.selectedWallIdxs).sort((a, b) => b - a);
            sortedIdxs.forEach((idx) => {
                if (ctx.walls[idx]) ctx.walls.splice(idx, 1);
            });
            ctx.selectedWallIdxs.clear();
            changedWalls = true;
        } else if (typeof ctx.selectedWallIdx === 'number' && ctx.selectedWallIdx !== -1 && ctx.walls) {
            ctx.walls.splice(ctx.selectedWallIdx, 1);
            ctx.selectedWallIdx = -1;
            changedWalls = true;
        }

        if (ctx.selectedLightId && Array.isArray(ctx.lights)) {
            const idx = ctx.lights.findIndex((l) => l.id === ctx.selectedLightId);
            if (idx !== -1) {
                ctx.lights.splice(idx, 1);
                ctx.selectedLightId = null;
                ctx.hoveredLightId = null;
                changedLights = true;
            }
        }

        // Notes deletion
        if (ctx.selectedNoteId && ctx.activeLayer === 'notes') {
            ctx.notes = ctx.notes.filter((n) => n.id !== ctx.selectedNoteId);
            ctx.selectedNoteId = null;
            if ('hoveredNoteId' in ctx) ctx.hoveredNoteId = null;
            vtt.socket.emit('notes:update', { mapId: ctx.currentMapId, notes: ctx.notes });
            ctx.renderAll();
            return;
        }

        if (typeof ctx.selectedDrawingIds !== 'undefined' && ctx.selectedDrawingIds.size > 0) {
            ctx.selectedDrawingIds.forEach((id) => {
                const d = ctx.drawings[id];
                if (d && ctx.isDrawingControlledByPlayer(d)) {
                    ctx.paintUndoStack.push({ action: 'delete', drawing: { ...d } });
                    delete ctx.drawings[id];
                }
            });
            ctx.paintRedoStack = [];
            ctx.selectedDrawingIds.clear();
            ctx.selectedDrawingId = null;
            ctx.emitDrawingsUpdate();
        } else if (ctx.selectedDrawingId) {
            const d = ctx.drawings[ctx.selectedDrawingId];
            if (d && ctx.isDrawingControlledByPlayer(d)) {
                ctx.paintUndoStack.push({ action: 'delete', drawing: { ...d } });
                ctx.paintRedoStack = [];
                delete ctx.drawings[ctx.selectedDrawingId];
                ctx.emitDrawingsUpdate();
            }
            ctx.selectedDrawingId = null;
        }

        if (changedTokens) window.emitTokenUpdates(ctx.tokens);
        if (changedShapes) vtt.socket.emit('shapes:update', { mapId: ctx.currentMapId, shapes: ctx.shapes });
        if (changedLights) vtt.socket.emit('lights:update', { mapId: ctx.currentMapId, lights: ctx.lights });
        if (changedWalls) {
            if ('hoveredWallIdx' in ctx) ctx.hoveredWallIdx = -1;
            vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
        }
        if (changedTokens || changedShapes || changedWalls || changedLights) ctx.renderAll();
    }

    function copySelectionToClipboard() {
        if (ctx.activeLayer === 'lighting') {
            const items = [];
            if (typeof ctx.selectedWallIdxs !== 'undefined' && ctx.selectedWallIdxs.size > 0) {
                ctx.selectedWallIdxs.forEach((idx) => items.push(JSON.parse(JSON.stringify(ctx.walls[idx]))));
            } else if (ctx.selectedWallIdx !== -1) {
                items.push(JSON.parse(JSON.stringify(ctx.walls[ctx.selectedWallIdx])));
            }
            if (ctx.selectedLightId) {
                const l = ctx.lights.find((l) => l.id === ctx.selectedLightId);
                if (l) items.push(JSON.parse(JSON.stringify(l)));
            }

            if (items.length > 0) {
                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;
                items.forEach((i) => {
                    if (i.x !== undefined) {
                        minX = Math.min(minX, i.x);
                        minY = Math.min(minY, i.y);
                        maxX = Math.max(maxX, i.x);
                        maxY = Math.max(maxY, i.y);
                    } else {
                        minX = Math.min(minX, i.x1, i.x2);
                        minY = Math.min(minY, i.y1, i.y2);
                        maxX = Math.max(maxX, i.x1, i.x2);
                        maxY = Math.max(maxY, i.y1, i.y2);
                    }
                });
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;
                ctx.vttClipboard = { type: 'lighting', items, cx, cy };
            }
        } else {
            const items = [];
            let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
            if (ctx.selectedTokenIds.size > 0) {
                ctx.selectedTokenIds.forEach((id) => {
                    const t = ctx.tokens[id];
                    if (t) {
                        items.push({ type: 'token', data: JSON.parse(JSON.stringify(t)) });
                        minX = Math.min(minX, t.x);
                        minY = Math.min(minY, t.y);
                        maxX = Math.max(maxX, t.x);
                        maxY = Math.max(maxY, t.y);
                    }
                });
            }
            const shapeIdsToCopy = new Set(ctx.selectedShapeIds || []);
            if (ctx.selectedShapeId) shapeIdsToCopy.add(ctx.selectedShapeId);
            if (shapeIdsToCopy.size > 0) {
                shapeIdsToCopy.forEach((id) => {
                    const s = ctx.shapes[id];
                    if (s && ctx.isShapeControlledByPlayer(s)) {
                        items.push({ type: 'shape', data: JSON.parse(JSON.stringify(s)) });
                        if (s.startPoint) {
                            minX = Math.min(minX, s.startPoint.x, s.endPoint.x);
                            minY = Math.min(minY, s.startPoint.y, s.endPoint.y);
                            maxX = Math.max(maxX, s.startPoint.x, s.endPoint.x);
                            maxY = Math.max(maxY, s.startPoint.y, s.endPoint.y);
                        }
                    }
                });
            }

            if (items.length > 0) {
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;
                ctx.vttClipboard = { type: 'objects', items, cx, cy };
            }
        }
    }

    function pasteClipboard() {
        if (!ctx.vttClipboard || !ctx.vttClipboard.items || ctx.vttClipboard.items.length === 0) return;

        const dx = ctx.currentMouseCoords.x - ctx.vttClipboard.cx;
        const dy = ctx.currentMouseCoords.y - ctx.vttClipboard.cy;

        if (ctx.vttClipboard.type === 'lighting' && ctx.activeLayer === 'lighting') {
            let changedLights = false;
            let changedWalls = false;

            if (typeof ctx.selectedWallIdxs !== 'undefined') ctx.selectedWallIdxs.clear();
            ctx.selectedLightId = null;

            ctx.vttClipboard.items.forEach((item) => {
                const newItem = JSON.parse(JSON.stringify(item));
                if (newItem.x !== undefined) {
                    newItem.id = 'light_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    newItem.x += dx;
                    newItem.y += dy;
                    if (!Array.isArray(ctx.lights)) ctx.lights = [];
                    ctx.lights.push(newItem);
                    ctx.selectedLightId = newItem.id;
                    changedLights = true;
                } else {
                    newItem.id = 'wall_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    newItem.x1 += dx;
                    newItem.y1 += dy;
                    newItem.x2 += dx;
                    newItem.y2 += dy;
                    if (!Array.isArray(ctx.walls)) ctx.walls = [];
                    ctx.walls.push(newItem);
                    if (typeof ctx.selectedWallIdxs !== 'undefined') ctx.selectedWallIdxs.add(ctx.walls.length - 1);
                    changedWalls = true;
                }
            });
            if (changedLights) vtt.socket.emit('lights:update', { mapId: ctx.currentMapId, lights: ctx.lights });
            if (changedWalls) vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
            ctx.renderAll();
        } else if (ctx.vttClipboard.type === 'objects' && ctx.activeLayer !== 'lighting') {
            let changedTokens = false;
            let changedShapes = false;

            ctx.selectedTokenIds.clear();
            if (typeof ctx.selectedShapeIds !== 'undefined') ctx.selectedShapeIds.clear();

            ctx.vttClipboard.items.forEach((item) => {
                if (item.type === 'token') {
                    const t = JSON.parse(JSON.stringify(item.data));
                    t.layer = ctx.activeLayer; // Paste to current layer
                    t.x += dx;
                    t.y += dy;
                    const existingZ = Object.values(ctx.tokens).map((tk) => tk.zIndex || 0);
                    const maxZ = existingZ.length > 0 ? Math.max(...existingZ) : 0;
                    t.zIndex = maxZ + 1;
                    const newId = 'token_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    t.id = newId;
                    ctx.tokens[newId] = t;
                    ctx.selectedTokenIds.add(newId);
                    changedTokens = true;
                } else if (item.type === 'shape') {
                    const s = JSON.parse(JSON.stringify(item.data));
                    s.layer = ctx.activeLayer;
                    s.startPoint.x += dx;
                    s.startPoint.y += dy;
                    s.endPoint.x += dx;
                    s.endPoint.y += dy;
                    if (s.points) {
                        s.points.forEach((p) => {
                            p.x += dx;
                            p.y += dy;
                        });
                    }
                    const newId = 'shape_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    s.id = newId;
                    s.ownerUsername = vtt.username;
                    if (typeof ctx.shapes === 'undefined') window.shapes = {};
                    ctx.shapes[newId] = s;
                    if (typeof ctx.selectedShapeIds !== 'undefined') ctx.selectedShapeIds.add(newId);
                    changedShapes = true;
                }
            });
            if (changedTokens) window.emitTokenUpdates(ctx.tokens);
            if (changedShapes) vtt.socket.emit('shapes:update', { mapId: ctx.currentMapId, shapes: ctx.shapes });
            ctx.renderAll();
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
            const isInputActive =
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) ||
                document.activeElement?.isContentEditable ||
                e.target?.isContentEditable;
            if (isInputActive) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key ? e.key.toLowerCase() : '';
            const code = e.code || '';

            if (e.key === 'Enter' && ctx.isDrawingMapTool && ctx.currentMapToolShape === 'polygon') {
                e.preventDefault();
                ctx.finalizeMapToolPolygon();
                return;
            }

            // Layer switching shortcuts: ` + 1..6 (e.g. `+6 for Portals layer)
            if (e.key === '`' || e.code === 'Backquote' || e.key === '~') {
                isLayerShortcutModifierDown = true;
                lastBackquoteTime = Date.now();
            }

            if (isLayerShortcutModifierDown && vtt.role === 'GM') {
                const layerMap = {
                    1: 'token',
                    2: 'gm',
                    3: 'lighting',
                    4: 'notes',
                    5: 'map',
                    6: 'portals'
                };
                if (layerMap[e.key]) {
                    e.preventDefault();
                    const targetLayer = layerMap[e.key];
                    if (typeof ctx.switchActiveLayer === 'function') {
                        ctx.switchActiveLayer(targetLayer);
                    }
                    const layerPanel = document.getElementById('panel-layers-config');
                    if (layerPanel) {
                        const layerBtns = layerPanel.querySelectorAll('.layer-btn');
                        layerBtns.forEach((lb) => {
                            if (lb.getAttribute('data-layer') === targetLayer) lb.click();
                        });
                    }
                    lastBackquoteTime = 0;
                    return;
                }
            }

            if (
                Date.now() - lastBackquoteTime < 1500 &&
                ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', '1', '2', '3', '4', '5', '6'].includes(
                    e.code || e.key
                )
            ) {
                const num = e.code && e.code.startsWith('Digit') ? e.code.replace('Digit', '') : e.key;
                const layerMap = { 1: 'token', 2: 'gm', 3: 'lighting', 4: 'notes', 5: 'map', 6: 'portals' };
                if (layerMap[num]) {
                    e.preventDefault();
                    if (typeof ctx.switchActiveLayer === 'function') {
                        ctx.switchActiveLayer(layerMap[num]);
                    }
                    lastBackquoteTime = 0;
                    return;
                }
            }

            // Tool selection shortcuts (keys 1-6 when backquote modifier is not active)
            if (!isLayerShortcutModifierDown && Date.now() - lastBackquoteTime >= 1500 && !isCtrl && !e.altKey) {
                const isDigit =
                    code.startsWith('Digit') ||
                    (!code.startsWith('Numpad') && ['1', '2', '3', '4', '5', '6'].includes(e.key));
                if (isDigit) {
                    const toolMap = {
                        1: 'tool-select',
                        2: 'tool-measure',
                        3: 'tool-shape',
                        4: 'tool-ping',
                        5: vtt.role === 'GM' ? 'tool-lighting' : null,
                        6: 'tool-paint'
                    };
                    const toolId = toolMap[e.key];
                    if (toolId) {
                        e.preventDefault();
                        document.getElementById(toolId)?.click();
                        return;
                    }
                }
            }

            // Paint Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
            if (isCtrl && (key === 'z' || key === 'y')) {
                if (key === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        if (typeof ctx.paintRedo === 'function') ctx.paintRedo();
                    } else {
                        e.preventDefault();
                        if (typeof ctx.paintUndo === 'function') ctx.paintUndo();
                    }
                    return;
                } else if (key === 'y') {
                    e.preventDefault();
                    if (typeof ctx.paintRedo === 'function') ctx.paintRedo();
                    return;
                }
            }

            // Shift+X: Cinematic Splash Art Zoom Shortcut
            if (e.shiftKey && key === 'x' && !isCtrl && !e.altKey) {
                e.preventDefault();
                if (typeof ctx.isSplashOverlayOpen === 'function' && ctx.isSplashOverlayOpen()) {
                    if (typeof ctx.closeSplashOverlay === 'function') ctx.closeSplashOverlay();
                } else if (typeof ctx.triggerSplashForSelection === 'function') {
                    ctx.triggerSplashForSelection();
                }
                return;
            }

            // Numpad 5: Center view to token / centroid / player character / map center
            // (or Shift+Numpad 5: GM broadcast view to players)
            if (code === 'Numpad5') {
                e.preventDefault();
                if (e.shiftKey && vtt.role === 'GM') {
                    ctx.broadcastViewToPlayers();
                } else {
                    ctx.centerOnTokenOrMap();
                }
                return;
            }

            // Numpad Zoom (+ / -) and standard +/- keys
            if (
                code === 'NumpadAdd' ||
                (e.key === '+' && !isCtrl && !e.altKey) ||
                (e.key === '=' && !isCtrl && !e.altKey)
            ) {
                e.preventDefault();
                ctx.stepZoom(0.1);
                return;
            }
            if (
                code === 'NumpadSubtract' ||
                (e.key === '-' && !isCtrl && !e.altKey) ||
                (e.key === '_' && !isCtrl && !e.altKey)
            ) {
                e.preventDefault();
                ctx.stepZoom(-0.1);
                return;
            }

            // Numpad Panning: 4 (left), 8 (up), 6 (right), 2 (down) + diagonals 7, 9, 1, 3
            const isNumpad4 = code === 'Numpad4';
            const isNumpad8 = code === 'Numpad8';
            const isNumpad6 = code === 'Numpad6';
            const isNumpad2 = code === 'Numpad2';
            const isNumpad7 = code === 'Numpad7';
            const isNumpad9 = code === 'Numpad9';
            const isNumpad1 = code === 'Numpad1';
            const isNumpad3 = code === 'Numpad3';

            if (isNumpad4 || isNumpad8 || isNumpad6 || isNumpad2 || isNumpad7 || isNumpad9 || isNumpad1 || isNumpad3) {
                e.preventDefault();
                cancelCameraAnimation();
                const step = e.repeat ? 180 : 120;
                let dx = 0;
                let dy = 0;

                if (isNumpad4) dx += step;
                if (isNumpad6) dx -= step;
                if (isNumpad8) dy += step;
                if (isNumpad2) dy -= step;
                if (isNumpad7) {
                    dx += step * 0.707;
                    dy += step * 0.707;
                }
                if (isNumpad9) {
                    dx -= step * 0.707;
                    dy += step * 0.707;
                }
                if (isNumpad1) {
                    dx += step * 0.707;
                    dy += step * 0.707;
                }
                if (isNumpad3) {
                    dx += step * 0.707;
                    dy += step * 0.707;
                }

                ctx.panX += dx;
                ctx.panY += dy;
                updateContainerTransform();
                ctx.renderAll();
                return;
            }

            const activeTool = ctx.activeTool || 'select';
            if (e.key === ' ' && (ctx.isTokenMeasuring || ctx.localIsMeasuring || ctx.localIsShaping)) {
                const rawShapeMeasure = document.getElementById('measure-shape')?.value || 'line';
                if (
                    ctx.isTokenMeasuring ||
                    ((activeTool === 'measure' || activeTool === 'shape') && rawShapeMeasure === 'line')
                ) {
                    e.preventDefault();
                    (ctx.measureAnchorPoints = ctx.measureAnchorPoints || []).push(
                        e.altKey
                            ? ctx.currentMouseCoords
                            : snapToGridCenter(ctx.currentMouseCoords.x, ctx.currentMouseCoords.y)
                    );
                    if (ctx.localIsMeasuring) ctx.localMeasureEnd = ctx.currentMouseCoords;
                    if (ctx.localIsShaping) ctx.localShapeEnd = ctx.currentMouseCoords;
                    ctx.renderAll();
                    return;
                }
            }

            if (
                (e.key === 'Backspace' || e.key === 'Delete') &&
                (ctx.isTokenMeasuring || ctx.localIsMeasuring || ctx.localIsShaping)
            ) {
                e.preventDefault();
                if (ctx.measureAnchorPoints && ctx.measureAnchorPoints.length > 1) {
                    ctx.measureAnchorPoints.pop();
                    ctx.renderAll();
                }
                return;
            }

            if (e.key === 'Escape') {
                if (typeof ctx.isSplashOverlayOpen === 'function' && ctx.isSplashOverlayOpen()) {
                    if (typeof ctx.closeSplashOverlay === 'function') ctx.closeSplashOverlay();
                }
                const menu = document.getElementById('vtt-token-context-menu');
                if (menu) menu.remove();
                const hasActiveTextarea =
                    typeof ctx.activeDrawingTextarea === 'function'
                        ? ctx.activeDrawingTextarea()
                        : ctx.activeDrawingTextarea;
                if (hasActiveTextarea && typeof ctx.cancelDrawingTextInput === 'function') {
                    ctx.cancelDrawingTextInput();
                }
                if (ctx.isDrawingMapTool) {
                    cancelMapToolDrawing();
                }
                // Clear active measurements or ctx.shapes
                const dragTargetId = ctx.dragTargetId;
                if (ctx.localIsMeasuring || ctx.localIsShaping || ctx.isTokenMeasuring || dragTargetId) {
                    if (dragTargetId) {
                        const originalPos = ctx.tokenDragOriginalPositions?.[dragTargetId];
                        if (originalPos && ctx.tokens[dragTargetId]) {
                            ctx.tokens[dragTargetId].x = originalPos.x;
                            ctx.tokens[dragTargetId].y = originalPos.y;
                            if (typeof window !== 'undefined' && window.emitTokenUpdates) {
                                window.emitTokenUpdates(ctx.tokens);
                            }
                        }
                        ctx.dragTargetId = null;
                    }
                    if (ctx.isTokenMeasuring) {
                        ctx.isTokenMeasuring = false;
                    }
                    if (ctx.localIsMeasuring) {
                        ctx.localIsMeasuring = false;
                        vtt.socket.emit('measure:clear', { mapId: ctx.currentMapId, username: vtt.username });
                        ctx.localMeasureStart = null;
                        ctx.localMeasureEnd = null;
                    }
                    if (ctx.localIsShaping) {
                        ctx.localIsShaping = false;
                        ctx.localShapeStart = null;
                        ctx.localShapeEnd = null;
                    }
                    ctx.measureAnchorPoints = [];
                }

                // Close note viewer if open
                const noteViewer = document.getElementById('vtt-note-viewer');
                if (noteViewer) {
                    noteViewer.remove();
                    return;
                }
                ctx.selectedTokenIds.clear();
                ctx.gmTokenVisionMode = false;
                if (typeof ctx.selectedShapeIds !== 'undefined') ctx.selectedShapeIds.clear();
                if (typeof ctx.selectedDrawingIds !== 'undefined') ctx.selectedDrawingIds.clear();
                if (typeof ctx.selectedWallIdxs !== 'undefined') ctx.selectedWallIdxs.clear();
                ctx.selectedShapeId = null;
                ctx.selectedDrawingId = null;
                ctx.selectedLightId = null;
                ctx.hoveredLightId = null;
                if ('hoveredWallIdx' in ctx) ctx.hoveredWallIdx = -1;
                ctx.selectedNoteId = null;
                ctx.renderAll();
                return;
            }

            if (e.shiftKey && key === 'l' && vtt.role === 'GM') {
                e.preventDefault();
                ctx.gmTokenVisionMode = !ctx.gmTokenVisionMode;
                if (ctx.gmTokenVisionMode && ctx.selectedTokenIds.size === 0) {
                    ctx.gmTokenVisionMode = false;
                }
                ctx.renderAll();
                return;
            }

            if (isCtrl && key === 'a') {
                e.preventDefault();
                ctx.selectedTokenIds.clear();
                if (typeof ctx.selectedShapeIds !== 'undefined') ctx.selectedShapeIds.clear();
                if (typeof ctx.selectedDrawingIds !== 'undefined') ctx.selectedDrawingIds.clear();
                if (typeof ctx.selectedWallIdxs !== 'undefined') ctx.selectedWallIdxs.clear();
                ctx.selectedLightId = null;
                ctx.selectedShapeId = null;
                ctx.selectedDrawingId = null;

                if (ctx.activeLayer === 'lighting') {
                    if (typeof ctx.walls !== 'undefined') ctx.walls.forEach((w, idx) => ctx.selectedWallIdxs.add(idx));
                } else {
                    if (typeof ctx.tokens !== 'undefined') {
                        Object.keys(ctx.tokens).forEach((id) => {
                            const t = ctx.tokens[id];
                            const tokenLayer = t?.layer || 'token';
                            if (t && tokenLayer === ctx.activeLayer && ctx.isTokenControlledByPlayer(t)) {
                                ctx.selectedTokenIds.add(id);
                            }
                        });
                    }
                    if (typeof ctx.shapes !== 'undefined') {
                        Object.keys(ctx.shapes).forEach((id) => {
                            const s = ctx.shapes[id];
                            const shapeLayer = s?.layer || 'token';
                            if (s && shapeLayer === ctx.activeLayer && ctx.isShapeControlledByPlayer(s)) {
                                ctx.selectedShapeIds.add(id);
                            }
                        });
                    }
                    if (typeof ctx.drawings !== 'undefined') {
                        Object.keys(ctx.drawings).forEach((id) => {
                            const d = ctx.drawings[id];
                            const drawingLayer = d?.layer || 'token';
                            if (d && drawingLayer === ctx.activeLayer && ctx.isDrawingControlledByPlayer(d)) {
                                ctx.selectedDrawingIds.add(id);
                            }
                        });
                    }
                }
                ctx.renderAll();
                return;
            }

            if (isCtrl && key === 'c') {
                e.preventDefault();
                copySelectionToClipboard();
                return;
            }

            if (isCtrl && key === 'x') {
                e.preventDefault();
                copySelectionToClipboard();
                deleteSelection();
                return;
            }

            if (isCtrl && key === 'v') {
                e.preventDefault();
                pasteClipboard();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelection();
                return;
            }

            // Token Rotation (Q / E) & Flipping (W / A / S / D)
            if (!isCtrl && !e.altKey && ctx.selectedTokenIds && ctx.selectedTokenIds.size > 0) {
                if (key === 'q' || key === 'e') {
                    e.preventDefault();
                    const step = e.shiftKey ? 5 : 45;
                    const delta = key === 'q' ? -step : step;
                    let updated = false;
                    ctx.selectedTokenIds.forEach((id) => {
                        const token = ctx.tokens[id];
                        if (token && ctx.isTokenControlledByPlayer(token)) {
                            let cur = token.rotation || 0;
                            let next = (cur + delta) % 360;
                            if (next < 0) next += 360;
                            token.rotation = next;
                            updated = true;
                        }
                    });
                    if (updated) {
                        if (typeof window !== 'undefined' && window.emitTokenUpdates) {
                            window.emitTokenUpdates(ctx.tokens);
                        } else if (typeof ctx.emitTokenUpdates === 'function') {
                            ctx.emitTokenUpdates(ctx.tokens);
                        }
                        ctx.renderAll();
                        return;
                    }
                }
                if (['w', 'a', 's', 'd'].includes(key)) {
                    let updated = false;
                    ctx.selectedTokenIds.forEach((id) => {
                        const token = ctx.tokens[id];
                        if (token && ctx.isTokenControlledByPlayer(token)) {
                            if (key === 'w' && token.flipY !== false) {
                                token.flipY = false;
                                updated = true;
                            } else if (key === 's' && token.flipY !== true) {
                                token.flipY = true;
                                updated = true;
                            } else if (key === 'a' && token.flipX !== true) {
                                token.flipX = true;
                                updated = true;
                            } else if (key === 'd' && token.flipX !== false) {
                                token.flipX = false;
                                updated = true;
                            }
                        }
                    });
                    if (updated) {
                        e.preventDefault();
                        if (typeof window !== 'undefined' && window.emitTokenUpdates) {
                            window.emitTokenUpdates(ctx.tokens);
                        } else if (typeof ctx.emitTokenUpdates === 'function') {
                            ctx.emitTokenUpdates(ctx.tokens);
                        }
                        ctx.renderAll();
                        return;
                    }
                }
            }

            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (
                    ctx.selectedTokenIds.size > 0 ||
                    (typeof ctx.selectedShapeIds !== 'undefined' && ctx.selectedShapeIds.size > 0) ||
                    ctx.selectedShapeId ||
                    ctx.selectedDrawingId ||
                    (typeof ctx.selectedDrawingIds !== 'undefined' && ctx.selectedDrawingIds.size > 0)
                ) {
                    e.preventDefault();
                    let dx = 0;
                    let dy = 0;
                    const unitSize =
                        (ctx.grid && ctx.grid.size ? ctx.grid.size : 50) *
                        (ctx.grid && ctx.grid.scale ? ctx.grid.scale : 1);
                    if (e.key === 'ArrowUp') dy = -unitSize;
                    if (e.key === 'ArrowDown') dy = unitSize;
                    if (e.key === 'ArrowLeft') dx = -unitSize;
                    if (e.key === 'ArrowRight') dx = unitSize;

                    let changedTokens = false;
                    let changedShapes = false;
                    let changedDrawings = false;

                    const drawingsToNudge = new Set(ctx.selectedDrawingIds || []);
                    if (ctx.selectedDrawingId) drawingsToNudge.add(ctx.selectedDrawingId);
                    if (drawingsToNudge.size > 0) {
                        drawingsToNudge.forEach((id) => {
                            const d = ctx.drawings[id];
                            if (d && ctx.isDrawingControlledByPlayer(d)) {
                                if (d.points)
                                    d.points.forEach((p) => {
                                        p.x += dx;
                                        p.y += dy;
                                    });
                                if (d.startPoint) {
                                    d.startPoint.x += dx;
                                    d.startPoint.y += dy;
                                }
                                if (d.endPoint) {
                                    d.endPoint.x += dx;
                                    d.endPoint.y += dy;
                                }
                                if (d.x !== undefined) d.x += dx;
                                if (d.y !== undefined) d.y += dy;
                                changedDrawings = true;
                            }
                        });
                    }

                    ctx.selectedTokenIds.forEach((id) => {
                        const t = ctx.tokens[id];
                        if (ctx.isTokenControlledByPlayer(t)) {
                            if (t._portalTransitLock && Date.now() < t._portalTransitLock) return;
                            let logicalX = t.x;
                            let logicalY = t.y;
                            if (ctx.tokenAnimations && ctx.tokenAnimations[id]) {
                                logicalX = ctx.tokenAnimations[id].endX;
                                logicalY = ctx.tokenAnimations[id].endY;
                            }
                            let nx = logicalX + dx;
                            let ny = logicalY + dy;

                            const currentMap = vtt.campaignState?.maps?.[ctx.currentMapId];
                            if (vtt.role !== 'GM' && currentMap?.lightingSettings?.restrictMovement) {
                                const { drawW, drawH } = getTokenDrawDimensions(t);
                                const radius = Math.min(drawW, drawH) / 2;
                                const startCenter = { x: logicalX + drawW / 2, y: logicalY + drawH / 2 };
                                const endCenter = { x: nx + drawW / 2, y: ny + drawH / 2 };

                                let closestT = 1.0;
                                let collisionPoint = null;
                                const portals = ctx.portals || [];

                                ctx.walls.forEach((wall) => {
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
                                                      : po.shape === 'line' && po.geom
                                                        ? Math.hypot(po.geom.x2 - po.geom.x1, po.geom.y2 - po.geom.y1) /
                                                          2
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
                                    const length = Math.hypot(dx, dy);
                                    if (length > 0) {
                                        const backupT = Math.max(0, collisionPoint.t - (radius - 2) / length);
                                        nx = startCenter.x + dx * backupT - drawW / 2;
                                        ny = startCenter.y + dy * backupT - drawH / 2;
                                    }
                                }
                            }

                            if (logicalX !== nx || logicalY !== ny) {
                                t.x = nx;
                                t.y = ny;
                                const originalPos = { x: logicalX, y: logicalY };
                                const triggerRes =
                                    typeof ctx.checkTokenMoveTriggers === 'function'
                                        ? ctx.checkTokenMoveTriggers(t, originalPos)
                                        : null;
                                if (triggerRes?.action === 'teleport' || triggerRes?.action === 'trap') {
                                    delete t._animReq;
                                    if (ctx.tokenAnimations && ctx.tokenAnimations[id]) delete ctx.tokenAnimations[id];
                                    if (triggerRes?.action === 'teleport' && ctx.tokens[id]) {
                                        ctx.selectedTokenIds.clear();
                                        ctx.selectedTokenIds.add(id);
                                        ctx.selectedTokenId = id;
                                    }
                                } else {
                                    t._animReq = {
                                        startX: originalPos.x,
                                        startY: originalPos.y,
                                        endX: t.x,
                                        endY: t.y,
                                        waypoints: [],
                                        timestamp: Date.now(),
                                        duration: 300
                                    };
                                }
                                changedTokens = true;
                            }
                        }
                    });

                    const shapeIdsToNudge = new Set(ctx.selectedShapeIds || []);
                    if (ctx.selectedShapeId) shapeIdsToNudge.add(ctx.selectedShapeId);
                    if (shapeIdsToNudge.size > 0) {
                        shapeIdsToNudge.forEach((id) => {
                            const s = ctx.shapes[id];
                            if (s && ctx.isShapeControlledByPlayer(s)) {
                                s.startPoint.x += dx;
                                s.startPoint.y += dy;
                                s.endPoint.x += dx;
                                s.endPoint.y += dy;
                                if (s.points)
                                    s.points.forEach((p) => {
                                        p.x += dx;
                                        p.y += dy;
                                    });
                                changedShapes = true;
                            }
                        });
                    }

                    if (changedTokens) {
                        if (typeof window !== 'undefined' && typeof window.emitTokenUpdates === 'function') {
                            window.emitTokenUpdates(ctx.tokens);
                        } else if (typeof ctx.emitTokenUpdates === 'function') {
                            ctx.emitTokenUpdates(ctx.tokens);
                        }
                        if (typeof ctx.processTokenAnimReqs === 'function') {
                            ctx.processTokenAnimReqs(ctx.tokens);
                        }
                    }
                    if (changedShapes && vtt?.socket?.emit) {
                        vtt.socket.emit('shapes:update', { mapId: ctx.currentMapId, shapes: ctx.shapes });
                    }
                    if (changedDrawings && typeof ctx.emitDrawingsUpdate === 'function') {
                        ctx.emitDrawingsUpdate();
                    }
                    if (changedTokens || changedShapes || changedDrawings) {
                        if (typeof ctx.renderAll === 'function') ctx.renderAll();
                    }
                }
                return;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
                isLayerShortcutModifierDown = false;
            }
        });
    }

    return {
        deleteSelection: () => deleteSelection(),
        copySelectionToClipboard: () => copySelectionToClipboard(),
        pasteClipboard: () => pasteClipboard()
    };
}
