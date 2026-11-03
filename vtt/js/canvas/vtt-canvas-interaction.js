/**
 * vtt-canvas-interaction.js
 * Canvas pointer interaction listeners (mousedown, mousemove, mouseup),
 * interactive doors, dragging, drawing, and tool event loops.
 */

import {
    cancelCameraAnimation as cancelCameraAnimationExt,
    panTo as panToExt,
    setZoom as setZoomExt,
    updateContainerTransform as updateContainerTransformExt,
    updateCoordinateDisplay as updateCoordinateDisplayExt
} from './vtt-canvas-camera.js';
import {
    triggerPingAnimation as triggerPingAnimationExt,
    processTokenAnimReqs as processTokenAnimReqsExt
} from './tokens/vtt-canvas-token-renderer.js';
import {
    getDrawingBoundingBox as getDrawingBoundingBoxExt,
    getDrawingResizeHandles as getDrawingResizeHandlesExt,
    getDrawingResizeHandleAtPoint as getDrawingResizeHandleAtPointExt,
    applyDrawingResize as applyDrawingResizeExt,
    getDrawingAtPoint as getDrawingAtPointExt,
    isDrawingControlledByPlayer as isDrawingControlledByPlayerExt
} from './vtt-canvas-drawings.js';
import {
    getShapeCenterPoint as getShapeCenterPointExt,
    getShapePolyPoints as getShapePolyPointsExt,
    getShapeBoundingBox as getShapeBoundingBoxExt,
    isShapeControlledByPlayer as isShapeControlledByPlayerExt,
    isPointInsideShape as isPointInsideShapeExt
} from './vtt-canvas-shapes.js';
import {
    calcPortalCenter as calcPortalCenterExt,
    calcSpatialPortalDestination as calcSpatialPortalDestinationExt,
    checkOneWayPortalEntry as checkOneWayPortalEntryExt,
    isTokenCollidingWithPortal as isTokenCollidingWithPortalExt,
    getPortalRotationHandlePos as getPortalRotationHandlePosExt,
    renderPlacedPortalsList as renderPlacedPortalsListExt
} from './vtt-canvas-portals.js';
import {
    renderPlacedTrapsList as renderPlacedTrapsListExt,
    distToSegmentSq as distToSegmentSqExt
} from './vtt-canvas-traps.js';
import { getLineIntersection as getLineIntersectionExt } from './vtt-canvas-visibility.js';
import {
    cloneMapToolGeom as cloneMapToolGeomExt,
    getMapToolResizeHandleAt as getMapToolResizeHandleAtExt,
    applyMapToolResize as applyMapToolResizeExt,
    updateDraggedMapToolGeom as updateDraggedMapToolGeomExt,
    deselectMapToolItem as deselectMapToolItemExt,
    selectMapToolItem as selectMapToolItemExt,
    getPortalHandleUnderMouse as getPortalHandleUnderMouseExt
} from './vtt-canvas-map-tools.js';
import {
    getTokenAtPoint as getTokenAtPointExt,
    isTokenControlledByPlayer as isTokenControlledByPlayerExt,
    isTokenWithinSelection as isTokenWithinSelectionExt,
    getSelectionBounds as getSelectionBoundsExt
} from './vtt-canvas-interaction-tools.js';
import {
    hideGmTokenTooltip as hideGmTokenTooltipExt,
    showGmTokenTooltip as showGmTokenTooltipExt,
    isTokenTooltipAllowed as isTokenTooltipAllowedExt,
    openNoteViewer as openNoteViewerExt,
    openNoteEditor as openNoteEditorExt,
    showNoteContextMenu as showNoteContextMenuExt,
    showAddNoteContextMenu as showAddNoteContextMenuExt
} from './vtt-canvas-tooltips-notes.js';
import { syncLightPanelWithLight as syncLightPanelWithLightExt } from './vtt-canvas-lighting.js';
import {
    openWallSettingsModal as openWallSettingsModalExt,
    showDoorSettingsModal as showDoorSettingsModalExt,
    showWindowSettingsModal as showWindowSettingsModalExt,
    showWallSettingsModal as showWallSettingsModalExt,
    closeAnyWallModal as closeAnyWallModalExt
} from './vtt-canvas-wall-modals.js';

export function setupPointerInteraction(ctx = {}) {
    const vtt = ctx.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    const canvasInteraction =
        ctx.canvasInteraction ||
        (typeof document !== 'undefined' ? document.getElementById('vtt-canvas-interaction') : null);
    if (!canvasInteraction) return;

    if (!ctx.selectedTokenIds) ctx.selectedTokenIds = new Set();
    if (!ctx.selectedShapeIds) ctx.selectedShapeIds = new Set();
    if (!ctx.selectedDrawingIds) ctx.selectedDrawingIds = new Set();

    // Transient interaction state variables
    let lastMouseEvent = null;
    let pingHoldTimeout = null;
    let pingForceSelectTimeout = null;
    let startPanX = 0;
    let startPanY = 0;
    if (!ctx.measureAnchorPoints) ctx.measureAnchorPoints = [];
    let boxSelectAdditive = false;
    let shapeDragOriginalPositions = {};
    let drawingDragOriginalPositions = {};
    let activeDrawingResizeHandle = null;
    let drawingOriginalState = null;
    let drawingResizeOriginalBBox = null;
    let drawingDragStart = null;
    let activeResizeTokenId = null;
    let activeRotateTokenId = null;
    let resizeDragStartMouse = null;
    let resizeDragStartDims = null;
    let rotateInitialTokenRotation = 0;
    let rotateStartMouseAngle = 0;
    let draggingNoteId = null;
    let noteDragStartMouse = null;
    let wallDragOffsetX1 = 0;
    let wallDragOffsetY1 = 0;
    let wallDragOffsetX2 = 0;
    let wallDragOffsetY2 = 0;
    let wallsVersion = 0;
    let mapToolDragOriginalGeom = null;
    let hoveredResizeTokenId = null;
    let hoveredRotateTokenId = null;
    let hoveredRotatePortalId = null;
    let tokenInsidePortals = ctx.tokenInsidePortals || new Map();
    let tokenPortalDebounce = ctx.tokenPortalDebounce || new Map();
    let gmTokenTooltipTimeout = null;
    let gmTokenTooltipTokenId = null;
    let tokenTooltipPendingId = null;
    let pendingFocusTokenId = null;
    let pendingFocusTokenExpiry = 0;
    let paintFillColor = '#ffffff';
    let paintFillMode = 'fill';
    let paintGridSnap = false;
    let paintStrokeColor = '#ff0000';
    let paintStrokeWidth = 3;
    let paintSubTool = 'brush';
    let polygonPoints = [];
    let currentPaintStroke = null;

    const traps = new Proxy([], {
        get(target, prop) {
            const arr = ctx.traps || [];
            if (prop === Symbol.iterator) return arr[Symbol.iterator].bind(arr);
            const val = Reflect.get(arr, prop);
            return typeof val === 'function' ? val.bind(arr) : val;
        },
        set(target, prop, val) {
            const arr = ctx.traps || [];
            return Reflect.set(arr, prop, val);
        }
    });

    const portals = new Proxy([], {
        get(target, prop) {
            const arr = ctx.portals || [];
            if (prop === Symbol.iterator) return arr[Symbol.iterator].bind(arr);
            const val = Reflect.get(arr, prop);
            return typeof val === 'function' ? val.bind(arr) : val;
        },
        set(target, prop, val) {
            const arr = ctx.portals || [];
            return Reflect.set(arr, prop, val);
        }
    });

    let lastBroadcastedTokens = ctx.lastBroadcastedTokens || {};

    // Direct and context-delegated function bindings
    const getCanvasMouseCoords = ctx.getCanvasMouseCoords || ((e) => {
        const rect = canvasInteraction.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - (ctx.panX || 0)) / (ctx.zoom || 1),
            y: (e.clientY - rect.top - (ctx.panY || 0)) / (ctx.zoom || 1)
        };
    });
    const renderAll = ctx.renderAll || (() => {});
    const updateContainerTransform = ctx.updateContainerTransform || (() => updateContainerTransformExt(ctx));
    const updateCoordinateDisplay = ctx.updateCoordinateDisplay || ((coords) => updateCoordinateDisplayExt(coords));
    const cancelCameraAnimation = ctx.cancelCameraAnimation || (() => cancelCameraAnimationExt());
    const panTo = ctx.panTo || ((...args) => panToExt(...args, ctx));
    const setZoom = ctx.setZoom || ((...args) => setZoomExt(...args, ctx));
    const snapToGrid = ctx.snapToGrid || ((x, y) => ({ x, y }));
    const snapToGridCenter = ctx.snapToGridCenter || ((x, y) => ({ x, y }));
    const snapToHalfGrid = ctx.snapToHalfGrid || ((x, y) => ({ x, y }));
    const isPointVisible = ctx.isPointVisible || (() => true);
    const getWallCoordinatesForRaycasting = ctx.getWallCoordinatesForRaycasting || ((w) => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }));
    const getWallVertexAtCoord = ctx.getWallVertexAtCoord || (() => null);
    const getWallSegmentAtCoord = ctx.getWallSegmentAtCoord || (() => -1);
    const getLightAtCoord = ctx.getLightAtCoord || (() => null);
    const getShapeComponentAtCoord = ctx.getShapeComponentAtCoord || (() => null);
    const getPersistentShapeAtPoint = ctx.getPersistentShapeAtPoint || (() => null);
    const checkTokenMoveTriggers = ctx.checkTokenMoveTriggers || (() => null);
    const calcDistanceFormatted = ctx.calcDistanceFormatted || (() => '0 ft');
    const emitTokenUpdates = ctx.emitTokenUpdates || ((t) => {
        if (typeof window !== 'undefined' && window.emitTokenUpdates) window.emitTokenUpdates(t);
    });
    const emitDrawingsUpdate = ctx.emitDrawingsUpdate || (() => {});
    const emitMeasureUpdateThrottled = ctx.emitMeasureUpdateThrottled || (() => {});
    const cancelActiveMeasurement = ctx.cancelActiveMeasurement || (() => {});
    const clearAllSelections = ctx.clearAllSelections || (() => {});
    const performCanvasFloodFill = ctx.performCanvasFloodFill || (() => {});
    const eraseDrawingsAtPoint = ctx.eraseDrawingsAtPoint || (() => {});
    const openDrawingTextInput = ctx.openDrawingTextInput || (() => {});
    const handleMapToolMouseDown = ctx.handleMapToolMouseDown || (() => {});
    const handleMapToolMouseMove = ctx.handleMapToolMouseMove || (() => {});
    const handleMapToolMouseUp = ctx.handleMapToolMouseUp || (() => {});
    const getMapToolItemAtCoord = ctx.getMapToolItemAtCoord || (() => null);
    const selectMapToolItem = ctx.selectMapToolItem || ((...args) => selectMapToolItemExt(...args));
    const deselectMapToolItem = ctx.deselectMapToolItem || (() => deselectMapToolItemExt(ctx));
    const cloneMapToolGeom = ctx.cloneMapToolGeom || cloneMapToolGeomExt;
    const getMapToolResizeHandleAt = ctx.getMapToolResizeHandleAt || getMapToolResizeHandleAtExt;
    const applyMapToolResize = ctx.applyMapToolResize || applyMapToolResizeExt;
    const updateDraggedMapToolGeom = ctx.updateDraggedMapToolGeom || updateDraggedMapToolGeomExt;
    const renderPlacedTrapsList = ctx.renderPlacedTrapsList || (() => renderPlacedTrapsListExt(traps, ctx.selectedMapToolItem));
    const renderPlacedPortalsList = ctx.renderPlacedPortalsList || (() => renderPlacedPortalsListExt(portals, ctx.selectedMapToolItem));
    const syncLightPanelWithLight = ctx.syncLightPanelWithLight || syncLightPanelWithLightExt;
    const openWallSettingsModal = ctx.openWallSettingsModal || ((...args) => openWallSettingsModalExt(...args));
    const openNoteViewer = ctx.openNoteViewer || ((...args) => openNoteViewerExt(...args));
    const hideGmTokenTooltip = ctx.hideGmTokenTooltip || ((...args) => hideGmTokenTooltipExt(args[0] || (typeof document !== 'undefined' ? document : null), ctx));
    const showGmTokenTooltip = ctx.showGmTokenTooltip || ((tokenId, force = false) => showGmTokenTooltipExt(tokenId, force, ctx));
    const isTokenTooltipAllowed = ctx.isTokenTooltipAllowed || ((token) => isTokenTooltipAllowedExt(token, ctx));
    const getNoteAtCoord = ctx.getNoteAtCoord || (() => null);
    const getTokenAtPoint = (m, req = true, match = true, r = 0) =>
        ctx.getTokenAtPoint ? ctx.getTokenAtPoint(m, req, match, r) : getTokenAtPointExt(m, req, match, r, ctx);
    const isTokenControlledByPlayer = (t, ignorePause = false) =>
        ctx.isTokenControlledByPlayer ? ctx.isTokenControlledByPlayer(t, ignorePause) : isTokenControlledByPlayerExt(t, ignorePause, ctx);
    const getTokenDrawDimensions = ctx.getTokenDrawDimensions || ((t) => ({ drawW: t?.width || 50, drawH: t?.height || 50 }));
    const getTokenCenter = ctx.getTokenCenter || ((t) => {
        const dims = getTokenDrawDimensions(t);
        return { x: (t?.x || 0) + (dims.drawW || 50) / 2, y: (t?.y || 0) + (dims.drawH || 50) / 2 };
    });
    const getTokenEffectiveLightFacing = ctx.getTokenEffectiveLightFacing || ((t) => t?.lightRotation || 0);
    const getLocalLightFacingFromWorldAngle = ctx.getLocalLightFacingFromWorldAngle || ((t, deg) => deg);
    const getTokenRotationHandlePos = ctx.getTokenRotationHandlePos || (() => null);
    const getTokenResizeHandlePos = ctx.getTokenResizeHandlePos || (() => null);
    const triggerPingAnimation = ctx.triggerPingAnimation || triggerPingAnimationExt;
    const processTokenAnimReqs = ctx.processTokenAnimReqs || processTokenAnimReqsExt;
    const getDrawingBoundingBox = ctx.getDrawingBoundingBox || getDrawingBoundingBoxExt;
    const getDrawingResizeHandles = ctx.getDrawingResizeHandles || getDrawingResizeHandlesExt;
    const getDrawingResizeHandleAtPoint = ctx.getDrawingResizeHandleAtPoint || getDrawingResizeHandleAtPointExt;
    const applyDrawingResize = ctx.applyDrawingResize || applyDrawingResizeExt;
    const getDrawingAtPoint = ctx.getDrawingAtPoint || getDrawingAtPointExt;
    const isDrawingControlledByPlayer = ctx.isDrawingControlledByPlayer || isDrawingControlledByPlayerExt;
    const getShapeCenterPoint = ctx.getShapeCenterPoint || getShapeCenterPointExt;
    const getShapePolyPoints = ctx.getShapePolyPoints || getShapePolyPointsExt;
    const getShapeBoundingBox = ctx.getShapeBoundingBox || getShapeBoundingBoxExt;
    const isShapeControlledByPlayer =
        ctx.isShapeControlledByPlayer || ((s) => isShapeControlledByPlayerExt(s, vtt.role, vtt.username));
    const isPointInsideShape = ctx.isPointInsideShape || isPointInsideShapeExt;
    const calcPortalCenter = ctx.calcPortalCenter || calcPortalCenterExt;
    const calcSpatialPortalDestination = (sp, tp, fc, tc, tm = null, tok = null) => {
        if (typeof ctx.calcSpatialPortalDestination === 'function') {
            return ctx.calcSpatialPortalDestination(sp, tp, fc, tc, tm, tok);
        }
        return calcSpatialPortalDestinationExt(sp, tp, fc, tc, tm, tok, {
            grid: tm?.grid || ctx.grid,
            getTokenDrawDimensions
        });
    };
    const checkOneWayPortalEntry = ctx.checkOneWayPortalEntry || checkOneWayPortalEntryExt;
    const isTokenCollidingWithPortal = (tok, po, from = null, to = null) => {
        if (typeof ctx.isTokenCollidingWithPortal === 'function') {
            return ctx.isTokenCollidingWithPortal(tok, po, from, to);
        }
        return isTokenCollidingWithPortalExt(tok, po, from, to, getTokenDrawDimensions);
    };
    const getPortalHandleUnderMouse = (mouse, tolerance = null) => {
        if (typeof ctx.getPortalHandleUnderMouse === 'function') {
            return ctx.getPortalHandleUnderMouse(mouse, tolerance);
        }
        return getPortalHandleUnderMouseExt(mouse, tolerance, {
            portals: ctx.portals || [],
            selectedMapToolItem: ctx.selectedMapToolItem,
            activeLayer: ctx.activeLayer,
            activeTool: ctx.activeTool,
            zoom: ctx.zoom,
            isGM: (window.vtt?.role === 'GM')
        });
    };
    const getPortalRotationHandlePos = ctx.getPortalRotationHandlePos || getPortalRotationHandlePosExt;
    const distToSegmentSq = ctx.distToSegmentSq || distToSegmentSqExt;
    const getLineIntersection = ctx.getLineIntersection || getLineIntersectionExt;
    const isTokenWithinSelection = (t, r) =>
        ctx.isTokenWithinSelection ? ctx.isTokenWithinSelection(t, r) : isTokenWithinSelectionExt(t, r, getTokenDrawDimensions);
    const getSelectionBounds = ctx.getSelectionBounds || getSelectionBoundsExt;
    const isMobileViewport = () =>
        typeof window !== 'undefined'
            ? window.innerWidth <= 768 || Boolean(window.VTT?.mobileAdapter?.isMobileViewport?.())
            : false;

    function getInteractiveDoorAtCoord(x, y) {
        for (let i = ctx.walls.length - 1; i >= 0; i--) {
            const wall = ctx.walls[i];
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
            const uX = segLen > 0 ? segDx / segLen : 1;
            const uY = segLen > 0 ? segDy / segLen : 0;

            if (wall.type === 'door' || wall.type === 'window') {
                if (vtt.role === 'GM') {
                    // 1. Dead center: Open/Close toggle
                    if (Math.hypot(x - midX, y - midY) <= 13) return { wallIdx: i, action: 'toggleOpen' };
                    // 2. Off-center cog: Settings modal
                    const cogDist = Math.min(22, Math.max(16, segLen * 0.28));
                    const cogX = midX + uX * cogDist;
                    const cogY = midY + uY * cogDist;
                    if (Math.hypot(x - cogX, y - cogY) <= 11) return { wallIdx: i, action: 'openSettings' };
                } else {
                    if (wall.isSecret) continue;
                    const nx = segLen > 0 ? -segDy / segLen : 0;
                    const ny = segLen > 0 ? segDx / segLen : 0;
                    const isVis =
                        isPointVisible(midX + nx * 6, midY + ny * 6) ||
                        isPointVisible(midX - nx * 6, midY - ny * 6) ||
                        isPointVisible(midX, midY);
                    if (!isVis) continue;

                    // Players only see and can toggle Open/Close dead center
                    if (Math.hypot(x - midX, y - midY) <= 12) return { wallIdx: i, action: 'toggleOpen' };
                }
            } else {
                // Normal wall: GM Settings Cog at midpoint if lighting layer is active or wall is selected/hovered
                const isLightingActive = ctx.activeLayer === 'lighting';
                if (
                    vtt.role === 'GM' &&
                    (isLightingActive ||
                        ctx.selectedWallIdx === i ||
                        ctx.selectedWallIdxs.has(i) ||
                        ctx.hoveredWallIdx === i)
                ) {
                    if (Math.hypot(x - midX, y - midY) <= 12) return { wallIdx: i, action: 'openSettings' };
                }
            }
        }
        return null;
    }

    canvasInteraction.addEventListener('mousedown', (e) => {
        try {
            lastMouseEvent = e;
            const mouse = getCanvasMouseCoords(e);

            if (e.button === 0) {
                if (pingHoldTimeout) {
                    clearTimeout(pingHoldTimeout);
                    pingHoldTimeout = null;
                }
                if (pingForceSelectTimeout) {
                    clearTimeout(pingForceSelectTimeout);
                    pingForceSelectTimeout = null;
                }
                if (ctx.activeTool !== 'measure' && ctx.activeTool !== 'shape') {
                    const isShift = e.shiftKey;
                    const isGM = vtt.role === 'GM';
                    const startMouseX = mouse.x;
                    const startMouseY = mouse.y;
                    const tokenUnderPing = getTokenAtPoint({ x: startMouseX, y: startMouseY }, false, true);

                    pingHoldTimeout = setTimeout(() => {
                        pingHoldTimeout = null;
                        if (isShift && isGM) {
                            vtt.socket.emit('map:panTo', { mapId: ctx.currentMapId, x: startMouseX, y: startMouseY });
                        }
                        vtt.socket.emit('map:ping', {
                            mapId: ctx.currentMapId,
                            x: startMouseX,
                            y: startMouseY,
                            username: vtt.username,
                            role: vtt.role
                        });
                        triggerPingAnimation(startMouseX, startMouseY, vtt.username, vtt.role);

                        // If a token is on the ping, holding down for an additional 500ms forces GM to select the token
                        if (tokenUnderPing && vtt.socket) {
                            pingForceSelectTimeout = setTimeout(() => {
                                pingForceSelectTimeout = null;
                                vtt.socket.emit('token:force_select_gm', {
                                    tokenId: tokenUnderPing.id,
                                    mapId: ctx.currentMapId,
                                    username: vtt.username
                                });
                            }, 500);
                        }
                    }, 1000);
                }
            }

            const doorAction = getInteractiveDoorAtCoord(mouse.x, mouse.y);
            if (doorAction) {
                if (doorAction.action === 'openSettings') {
                    openWallSettingsModal(doorAction.wallIdx, e.clientX, e.clientY);
                    return;
                }
                const wall = ctx.walls[doorAction.wallIdx];
                if (e.button === 0) {
                    // left click
                    if (doorAction.action === 'toggleOpen') {
                        if (wall.isLocked && vtt.role !== 'GM') {
                            if (typeof JqueryUtil !== 'undefined' && JqueryUtil.doToast) {
                                JqueryUtil.doToast({
                                    type: 'warning',
                                    content: wall.type === 'window' ? 'That window is locked.' : 'That door is locked.'
                                });
                            }
                        } else {
                            wall.isOpen = !wall.isOpen;
                            vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                            wallsVersion++;
                            renderAll();
                        }
                    }
                } else if (e.button === 2 && vtt.role === 'GM') {
                    openWallSettingsModal(doorAction.wallIdx, e.clientX, e.clientY);
                }
                return;
            }

            if (e.button === 1 || e.button === 2) {
                if (e.button === 2 && ctx.activeTool === 'select' && ctx.dragTargetId) {
                    const t = ctx.tokens[ctx.dragTargetId];
                    const tOriginalPos = ctx.tokenDragOriginalPositions[ctx.dragTargetId];
                    const { drawW, drawH } = t ? getTokenDrawDimensions(t) : { drawW: 0, drawH: 0 };
                    const currentCenter = t ? { x: t.x + drawW / 2, y: t.y + drawH / 2 } : mouse;
                    if (!ctx.localIsMeasuring) {
                        ctx.isTokenMeasuring = true;
                        ctx.localIsMeasuring = true;
                        ctx.localMeasureStart = tOriginalPos
                            ? { x: tOriginalPos.x + drawW / 2, y: tOriginalPos.y + drawH / 2 }
                            : mouse;
                        ctx.localMeasureEnd = currentCenter;
                        ctx.measureAnchorPoints = [ctx.localMeasureStart];
                        renderAll();
                    } else {
                        ctx.measureAnchorPoints.push(currentCenter);
                        ctx.localMeasureEnd = currentCenter;
                        renderAll();
                    }
                    return;
                }

                if (e.button === 2) {
                    const rawShapeMeasure = document.getElementById('measure-shape')?.value || 'line';
                    if (
                        (ctx.activeTool === 'measure' && rawShapeMeasure === 'line') ||
                        (ctx.activeTool === 'shape' && rawShapeMeasure === 'line')
                    ) {
                        if (ctx.localIsMeasuring || ctx.localIsShaping) {
                            ctx.measureAnchorPoints.push(e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y));
                            if (ctx.localIsMeasuring) ctx.localMeasureEnd = mouse;
                            if (ctx.localIsShaping) ctx.localShapeEnd = mouse;
                            renderAll();
                            return;
                        }
                    }
                }

                cancelCameraAnimation();
                ctx.isPanning = true;
                ctx.hasPanned = false;
                startPanX = e.clientX - ctx.panX;
                startPanY = e.clientY - ctx.panY;
                return;
            }

            if (e.button === 0 && e.shiftKey && ctx.activeTool === 'select') {
                const token = getTokenAtPoint(mouse);
                if (token) {
                    let charRef = null;
                    if (token.characterId && window.VTT?.campaignState?.characters) {
                        charRef = window.VTT.campaignState.characters[token.characterId];
                    }

                    if (window.VTT?.sheetDock?.openSheet) {
                        if (charRef && (charRef.isCustomNpc || charRef.isCompanion)) {
                            window.VTT.sheetDock.openSheet({
                                type: 'creature',
                                monsterData: charRef.monsterData,
                                tokenId: token.id,
                                characterId: token.characterId,
                                isCompanion: Boolean(charRef.isCompanion),
                                isCustomNpc: Boolean(charRef.isCustomNpc),
                                isGeneric: Boolean(charRef.isGeneric),
                                isVideo:
                                    token.isVideo ||
                                    charRef.isVideo ||
                                    Boolean((token.img || charRef.avatar)?.match(/\.(mp4|webm|ogg)$/i)),
                                name: charRef.name,
                                avatar: charRef.avatar || token.img
                            });
                        } else if (token.characterId) {
                            window.VTT.sheetDock.openSheet({
                                type: 'player',
                                id: token.characterId,
                                tokenId: token.id,
                                isVideo:
                                    token.isVideo ||
                                    charRef?.isVideo ||
                                    Boolean((token.img || charRef?.avatar)?.match(/\.(mp4|webm|ogg)$/i)),
                                name: charRef?.name || token.name,
                                avatar: charRef?.avatar || token.img
                            });
                        } else if (token.monsterData) {
                            const isCustom = Boolean(
                                token.isCustomNpc || token.monsterData?.isCustomNpc || charRef?.isCustomNpc
                            );
                            const isComp = Boolean(
                                token.isCompanion || token.monsterData?.isCompanion || charRef?.isCompanion
                            );
                            const isGen =
                                token.isGeneric !== undefined
                                    ? token.isGeneric
                                    : token.monsterData?.isGeneric !== undefined
                                      ? token.monsterData.isGeneric
                                      : !(isCustom || isComp);
                            window.VTT.sheetDock.openSheet({
                                type: 'creature',
                                monsterData: token.monsterData,
                                tokenId: token.id,
                                characterId: token.characterId || null,
                                isCompanion: isComp,
                                isCustomNpc: isCustom,
                                isGeneric: isGen,
                                isVideo: token.isVideo || Boolean(token.img?.match(/\.(mp4|webm|ogg)$/i)),
                                name: token.name || token.monsterData?.name,
                                avatar: token.img || token.monsterData?.tokenUrl || token.monsterData?.img
                            });
                        }
                    } else {
                        // Fallback to legacy single sheet
                        if (charRef && (charRef.isCustomNpc || charRef.isCompanion)) {
                            if (window.VTT?.creatureSheet?.openSheet) {
                                window.VTT.creatureSheet.openSheet(charRef.monsterData, token.id, token.characterId);
                            }
                        } else if (window.VTT?.playerSheet?.openSheet && token.characterId) {
                            window.VTT.playerSheet.openSheet(token.characterId);
                        } else if (window.VTT?.creatureSheet?.openSheet && token.monsterData) {
                            if (token.isCustomNpc) {
                                token.monsterData.isCustomNpc = true;
                                if (token.isGeneric !== undefined) token.monsterData.isGeneric = token.isGeneric;
                            }
                            window.VTT.creatureSheet.openSheet(token.monsterData, token.id, token.characterId || null);
                        }
                    }
                    return;
                }
            }

            // Notes layer click / drag start (GM) or view (Player)
            if (ctx.activeTool === 'select' && e.button === 0) {
                const clickedNoteId = getNoteAtCoord(mouse.x, mouse.y);
                if (clickedNoteId) {
                    if (vtt.role === 'GM') {
                        ctx.selectedNoteId = clickedNoteId;
                        const note = ctx.notes.find((n) => n.id === clickedNoteId);
                        if (note) {
                            draggingNoteId = clickedNoteId;
                            ctx.noteDragOffsetX = mouse.x - note.x;
                            ctx.noteDragOffsetY = mouse.y - note.y;
                            noteDragStartMouse = { x: mouse.x, y: mouse.y };
                        }
                        renderAll();
                        return;
                    } else {
                        const note = ctx.notes.find((n) => n.id === clickedNoteId);
                        if (note) openNoteViewer(note);
                        return;
                    }
                } else if (vtt.role === 'GM' && ctx.activeLayer === 'ctx.notes') {
                    ctx.selectedNoteId = null;
                    renderAll();
                }
            }

            // Check for clicking light rotation handle
            if (e.button === 0) {
                if (ctx.selectedLightId) {
                    const l = ctx.lights.find((item) => item.id === ctx.selectedLightId);
                    if (l && l.lightAngle && l.lightAngle < 360) {
                        const facing = ((l.lightRotation || 0) * Math.PI) / 180;
                        const hx = l.x + Math.cos(facing) * 36;
                        const hy = l.y + Math.sin(facing) * 36;
                        if (Math.hypot(mouse.x - hx, mouse.y - hy) <= 9) {
                            ctx.isRotatingLight = true;
                            ctx.rotatingLightEntity = { type: 'light', id: l.id };
                            return;
                        }
                    }
                }
                const currentSelectedToken =
                    (ctx.selectedTokenId && ctx.tokens[ctx.selectedTokenId]) ||
                    (ctx.selectedTokenIds.size === 1 ? ctx.tokens[Array.from(ctx.selectedTokenIds)[0]] : null);
                if (
                    currentSelectedToken &&
                    currentSelectedToken.lightEnabled &&
                    currentSelectedToken.lightAngle &&
                    currentSelectedToken.lightAngle < 360
                ) {
                    const center = getTokenCenter(currentSelectedToken);
                    const { drawW, drawH } = getTokenDrawDimensions(currentSelectedToken);
                    const r = Math.max(drawW, drawH) / 2;
                    const effFacing = getTokenEffectiveLightFacing(currentSelectedToken);
                    const facing = (effFacing * Math.PI) / 180;
                    const hx = center.x + Math.cos(facing) * (r + 20);
                    const hy = center.y + Math.sin(facing) * (r + 20);
                    if (Math.hypot(mouse.x - hx, mouse.y - hy) <= 9) {
                        ctx.isRotatingLight = true;
                        ctx.rotatingLightEntity = { type: 'token', id: currentSelectedToken.id };
                        return;
                    }
                }
            }

            if (ctx.activeTool === 'select') {
                if (ctx.activeLayer === 'lighting') {
                    if (ctx.hoveredLightId) {
                        ctx.selectedLightId = ctx.hoveredLightId;
                        ctx.activeDragLightId = ctx.hoveredLightId;
                        const light = ctx.lights.find((l) => l.id === ctx.hoveredLightId);
                        if (light) {
                            ctx.lightDragOffsetX = mouse.x - light.x;
                            ctx.lightDragOffsetY = mouse.y - light.y;
                            syncLightPanelWithLight(light);
                            document.getElementById('lighting-light-options')?.classList.remove('vtt-hidden');
                        }
                        if (!e.ctrlKey && !e.shiftKey) {
                            ctx.selectedWallIdxs.clear();
                        }
                        renderAll();
                    } else if (ctx.hoveredWallVertex) {
                        ctx.activeDragWallVertex = ctx.hoveredWallVertex;
                        ctx.selectedLightId = null;
                        if (!e.ctrlKey && !e.shiftKey) ctx.selectedWallIdxs.clear();
                    } else if (ctx.hoveredWallIdx !== -1) {
                        ctx.selectedWallIdx = ctx.hoveredWallIdx;
                        ctx.activeDragWallSegmentIdx = ctx.hoveredWallIdx;
                        ctx.selectedLightId = null;
                        if (!e.ctrlKey && !e.shiftKey) {
                            ctx.selectedWallIdxs.clear();
                            ctx.selectedWallIdxs.add(ctx.hoveredWallIdx);
                        } else {
                            ctx.selectedWallIdxs.add(ctx.hoveredWallIdx);
                        }
                        const w = ctx.walls[ctx.hoveredWallIdx];
                        wallDragOffsetX1 = mouse.x - w.x1;
                        wallDragOffsetY1 = mouse.y - w.y1;
                        wallDragOffsetX2 = mouse.x - w.x2;
                        wallDragOffsetY2 = mouse.y - w.y2;
                        renderAll();
                    } else if (e.button === 0) {
                        ctx.selectedWallIdx = -1;
                        ctx.selectedLightId = null;
                        boxSelectAdditive = e.ctrlKey || e.shiftKey;
                        if (!boxSelectAdditive) {
                            ctx.selectedWallIdxs.clear();
                        }
                        ctx.isBoxSelecting = true;
                        ctx.boxSelectStart = mouse;
                        ctx.boxSelectEnd = mouse;
                        renderAll();
                    }
                } else {
                    // Check if clicking a drawing resize handle (for currently selected drawing)
                    let clickedDrawingHandle = null;
                    if (ctx.selectedDrawingId && ctx.drawings[ctx.selectedDrawingId]) {
                        const selD = ctx.drawings[ctx.selectedDrawingId];
                        if (isDrawingControlledByPlayer(selD)) {
                            clickedDrawingHandle = getDrawingResizeHandleAtPoint(selD, mouse);
                        }
                    }

                    if (clickedDrawingHandle) {
                        activeDrawingResizeHandle = clickedDrawingHandle;
                        ctx.activeDragDrawingId = ctx.selectedDrawingId;
                        drawingOriginalState = JSON.parse(JSON.stringify(ctx.drawings[ctx.selectedDrawingId]));
                        drawingResizeOriginalBBox = getDrawingBoundingBox(ctx.drawings[ctx.selectedDrawingId]);
                        drawingDragStart = { x: mouse.x, y: mouse.y };
                        renderAll();
                        return;
                    }

                    // Check if clicking a drawing body
                    const clickedDrawing = getDrawingAtPoint(mouse, true);
                    if (clickedDrawing && isDrawingControlledByPlayer(clickedDrawing)) {
                        if (e.ctrlKey || e.shiftKey) {
                            if (ctx.selectedDrawingIds.has(clickedDrawing.id)) {
                                if (e.ctrlKey) ctx.selectedDrawingIds.delete(clickedDrawing.id);
                            } else {
                                ctx.selectedDrawingIds.add(clickedDrawing.id);
                            }
                        } else {
                            if (!ctx.selectedDrawingIds.has(clickedDrawing.id)) {
                                ctx.selectedTokenIds.clear();
                                ctx.selectedTokenId = null;
                                ctx.selectedShapeIds.clear();
                                ctx.selectedShapeId = null;
                                ctx.selectedDrawingIds.clear();
                                ctx.selectedDrawingIds.add(clickedDrawing.id);
                            }
                        }
                        ctx.selectedDrawingId = clickedDrawing.id;
                        ctx.activeDragDrawingId = clickedDrawing.id;
                        drawingOriginalState = JSON.parse(JSON.stringify(clickedDrawing));
                        drawingResizeOriginalBBox = getDrawingBoundingBox(clickedDrawing);
                        drawingDragStart = { x: mouse.x, y: mouse.y };
                        renderAll();
                        return;
                    } else if (e.button === 0 && !ctx.hoveredShapeComponent) {
                        ctx.selectedDrawingId = null;
                    }

                    if (ctx.hoveredShapeComponent) {
                        const shape = ctx.shapes[ctx.hoveredShapeComponent.shapeId];
                        const shapeLayer = shape?.layer || 'token';
                        if (shape && shapeLayer === ctx.activeLayer && isShapeControlledByPlayer(shape)) {
                            if (e.ctrlKey || e.shiftKey) {
                                if (ctx.selectedShapeIds.has(ctx.hoveredShapeComponent.shapeId)) {
                                    if (e.ctrlKey) ctx.selectedShapeIds.delete(ctx.hoveredShapeComponent.shapeId);
                                } else {
                                    ctx.selectedShapeIds.add(ctx.hoveredShapeComponent.shapeId);
                                }
                            } else {
                                if (!ctx.selectedShapeIds.has(ctx.hoveredShapeComponent.shapeId)) {
                                    ctx.selectedTokenIds.clear();
                                    ctx.selectedTokenId = null;
                                    ctx.selectedDrawingIds.clear();
                                    ctx.selectedDrawingId = null;
                                    ctx.selectedShapeIds.clear();
                                    ctx.selectedShapeIds.add(ctx.hoveredShapeComponent.shapeId);
                                }
                            }
                            ctx.selectedShapeId = ctx.hoveredShapeComponent.shapeId;
                            ctx.selectedShapeComponent = ctx.hoveredShapeComponent;
                            ctx.activeDragShapeId = ctx.hoveredShapeComponent.shapeId;
                            ctx.activeDragShapeComponent = ctx.hoveredShapeComponent;

                            if (ctx.hoveredShapeComponent.type === 'shape') {
                                const center = getShapeCenterPoint(shape);
                                ctx.shapeDragOffsetX = mouse.x - center.x;
                                ctx.shapeDragOffsetY = mouse.y - center.y;
                            } else if (ctx.hoveredShapeComponent.type === 'anchor') {
                                ctx.shapeComponentDragStart = {
                                    x: shape.startPoint.x,
                                    y: shape.startPoint.y,
                                    ex: shape.endPoint.x,
                                    ey: shape.endPoint.y
                                };
                            }
                            renderAll();
                            return;
                        }
                    }

                    ctx.selectedShapeId = null;
                    ctx.selectedShapeComponent = null;

                    if (vtt.role === 'GM' && e.button === 0) {
                        const handleHit = getPortalHandleUnderMouse(mouse);
                        if (handleHit) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (handleHit.type === 'rotate') {
                                ctx.activeRotatePortalId = handleHit.portal.id;
                                selectMapToolItem('portal', handleHit.portal.id);
                                renderAll();
                                return;
                            } else if (handleHit.type === 'resize') {
                                selectMapToolItem('portal', handleHit.item.id);
                                ctx.activeResizeMapToolHandle = {
                                    type: 'portal',
                                    id: handleHit.item.id,
                                    handle: handleHit.handle,
                                    origGeom: cloneMapToolGeom(handleHit.item.geom)
                                };
                                renderAll();
                                return;
                            }
                        }

                        if (ctx.selectedMapToolItem && ctx.selectedMapToolItem.type === 'trap') {
                            const selItem = traps.find((t) => t.id === ctx.selectedMapToolItem.id);
                            if (selItem) {
                                const rHandle = getMapToolResizeHandleAt(selItem, mouse);
                                if (rHandle) {
                                    ctx.activeResizeMapToolHandle = {
                                        type: 'trap',
                                        id: selItem.id,
                                        handle: rHandle,
                                        origGeom: cloneMapToolGeom(selItem.geom)
                                    };
                                    renderAll();
                                    return;
                                }
                            }
                        }
                    }

                    let clickedResizeTokenId = null;
                    let clickedRotateTokenId = null;
                    if (e.button === 0) {
                        ctx.selectedTokenIds.forEach((id) => {
                            const t = ctx.tokens[id];
                            const tokenLayer = t?.layer || 'token';
                            if (t && isTokenControlledByPlayer(t) && tokenLayer === ctx.activeLayer) {
                                if (t.isAsset) {
                                    const rh = getTokenResizeHandlePos(t);
                                    if (rh) {
                                        if (
                                            mouse.x >= rh.x - 8 &&
                                            mouse.x <= rh.x + 8 &&
                                            mouse.y >= rh.y - 8 &&
                                            mouse.y <= rh.y + 8
                                        ) {
                                            clickedResizeTokenId = id;
                                        }
                                    }
                                }
                                const h = getTokenRotationHandlePos(t);
                                if (h && !clickedResizeTokenId) {
                                    const dist = Math.hypot(mouse.x - h.x, mouse.y - h.y);
                                    if (dist <= 10 / ctx.zoom) {
                                        clickedRotateTokenId = id;
                                    }
                                }
                            }
                        });
                    }

                    if (clickedResizeTokenId) {
                        activeResizeTokenId = clickedResizeTokenId;
                        const token = ctx.tokens[clickedResizeTokenId];
                        const { drawW, drawH } = getTokenDrawDimensions(token);
                        resizeDragStartMouse = { x: mouse.x, y: mouse.y };
                        resizeDragStartDims = { pixelWidth: drawW, pixelHeight: drawH };
                        renderAll();
                        return;
                    }

                    if (clickedRotateTokenId) {
                        activeRotateTokenId = clickedRotateTokenId;
                        const token = ctx.tokens[clickedRotateTokenId];
                        rotateInitialTokenRotation = token.rotation || 0;
                        const h = getTokenRotationHandlePos(token);
                        rotateStartMouseAngle = (Math.atan2(mouse.y - h.cy, mouse.x - h.cx) * 180) / Math.PI;
                        renderAll();
                        return;
                    }

                    const clickedToken = getTokenAtPoint(mouse, true);
                    const clickedId = clickedToken ? clickedToken.id : null;

                    if (clickedId) {
                        if (
                            ctx.tokens[clickedId]?._portalTransitLock &&
                            Date.now() < ctx.tokens[clickedId]._portalTransitLock
                        ) {
                            return;
                        }
                        if (ctx.selectedMapToolItem) {
                            deselectMapToolItem();
                        }
                        ctx.dragTargetId = clickedId;
                        const t = ctx.tokens[clickedId];
                        ctx.dragOffsetX = mouse.x - t.x;
                        ctx.dragOffsetY = mouse.y - t.y;

                        // Hide stat tooltip as soon as dragging begins
                        hideGmTokenTooltip();

                        if (e.ctrlKey || e.shiftKey) {
                            if (ctx.selectedTokenIds.has(clickedId)) {
                                if (e.ctrlKey) {
                                    ctx.selectedTokenIds.delete(clickedId);
                                }
                            } else {
                                ctx.selectedTokenIds.add(clickedId);
                            }
                        } else {
                            if (!ctx.selectedTokenIds.has(clickedId)) {
                                ctx.selectedTokenIds.clear();
                                ctx.selectedTokenIds.add(clickedId);
                            }
                        }
                        ctx.selectedTokenId = clickedId;

                        ctx.tokenDragOriginalPositions = {};
                        if (ctx.selectedTokenIds) {
                            ctx.selectedTokenIds.forEach((id) => {
                                const selected = ctx.tokens ? ctx.tokens[id] : null;
                                if (selected) {
                                    ctx.tokenDragOriginalPositions[id] = { x: selected.x, y: selected.y };
                                }
                            });
                        }
                        shapeDragOriginalPositions = {};
                        if (ctx.selectedShapeIds) {
                            ctx.selectedShapeIds.forEach((id) => {
                                const s = ctx.shapes ? ctx.shapes[id] : null;
                                if (s) {
                                    shapeDragOriginalPositions[id] = {
                                        startPoint: { ...s.startPoint },
                                        endPoint: { ...s.endPoint },
                                        points: s.points ? s.points.map((p) => ({ ...p })) : null
                                    };
                                }
                            });
                        }
                        drawingDragOriginalPositions = {};
                        if (ctx.selectedDrawingIds) {
                            ctx.selectedDrawingIds.forEach((id) => {
                                const d = ctx.drawings ? ctx.drawings[id] : null;
                                if (d) {
                                    drawingDragOriginalPositions[id] = {
                                        x: d.x,
                                        y: d.y,
                                        startPoint: d.startPoint ? { ...d.startPoint } : null,
                                        endPoint: d.endPoint ? { ...d.endPoint } : null,
                                        points: d.points ? d.points.map((p) => ({ ...p })) : null
                                    };
                                }
                            });
                        }

                        if (isMobileViewport() && isTokenControlledByPlayer(t)) {
                            ctx.isTokenMeasuring = true;
                            ctx.localIsMeasuring = true;
                            const { drawW, drawH } = getTokenDrawDimensions(t);
                            ctx.localMeasureStart = { x: t.x + drawW / 2, y: t.y + drawH / 2 };
                            ctx.localMeasureEnd = ctx.localMeasureStart;
                            ctx.measureAnchorPoints = [ctx.localMeasureStart];
                        }

                        renderAll();
                    } else if (e.button === 0) {
                        // Check if clicking a portal or trap resize/rotate handle first (highest priority)
                        if (vtt.role === 'GM') {
                            const handleHit = getPortalHandleUnderMouse(mouse);
                            if (handleHit) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (handleHit.type === 'rotate') {
                                    ctx.activeRotatePortalId = handleHit.portal.id;
                                    selectMapToolItem('portal', handleHit.portal.id);
                                    renderAll();
                                    return;
                                } else if (handleHit.type === 'resize') {
                                    selectMapToolItem('portal', handleHit.item.id);
                                    ctx.activeResizeMapToolHandle = {
                                        type: 'portal',
                                        id: handleHit.item.id,
                                        handle: handleHit.handle,
                                        origGeom: cloneMapToolGeom(handleHit.item.geom)
                                    };
                                    renderAll();
                                    return;
                                }
                            }

                            if (ctx.selectedMapToolItem && ctx.selectedMapToolItem.type === 'trap') {
                                const selTrap = traps.find((t) => t.id === ctx.selectedMapToolItem.id);
                                if (selTrap) {
                                    const rHandle = getMapToolResizeHandleAt(selTrap, mouse);
                                    if (rHandle) {
                                        ctx.activeResizeMapToolHandle = {
                                            type: 'trap',
                                            id: selTrap.id,
                                            handle: rHandle,
                                            origGeom: cloneMapToolGeom(selTrap.geom)
                                        };
                                        renderAll();
                                        return;
                                    }
                                }
                            }

                            // Next Priority: check clicking a trap or portal body on canvas in select tool
                            const hitTool = getMapToolItemAtCoord(mouse.x, mouse.y);
                            if (hitTool) {
                                selectMapToolItem(hitTool.type, hitTool.item.id);
                                ctx.activeDragMapToolItem = { type: hitTool.type, id: hitTool.item.id };
                                ctx.mapToolDragStart = { x: mouse.x, y: mouse.y };
                                mapToolDragOriginalGeom = cloneMapToolGeom(hitTool.item.geom);
                                renderAll();
                                return;
                            } else if (ctx.selectedMapToolItem && ctx.activeLayer !== 'portals') {
                                deselectMapToolItem();
                            }
                        }
                        boxSelectAdditive = e.ctrlKey || e.shiftKey;
                        if (!boxSelectAdditive) {
                            ctx.selectedTokenIds.clear();
                            ctx.selectedTokenId = null;
                            ctx.selectedShapeIds.clear();
                            ctx.selectedShapeId = null;
                            ctx.selectedDrawingIds.clear();
                            ctx.selectedDrawingId = null;
                        }
                        ctx.isBoxSelecting = true;
                        ctx.boxSelectStart = mouse;
                        ctx.boxSelectEnd = mouse;
                        renderAll();
                    }
                }
            } else if (ctx.activeTool === 'ping') {
                vtt.socket.emit('map:ping', {
                    mapId: ctx.currentMapId,
                    x: mouse.x,
                    y: mouse.y,
                    username: vtt.username,
                    role: vtt.role
                });
                triggerPingAnimation(mouse.x, mouse.y, vtt.username, vtt.role);
            } else if (ctx.activeTool === 'measure') {
                ctx.localIsMeasuring = true;
                ctx.localMeasureStart = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                ctx.localMeasureEnd = ctx.localMeasureStart;
                ctx.measureAnchorPoints = [ctx.localMeasureStart];
                renderAll();
            } else if (ctx.activeTool === 'shape') {
                ctx.localIsShaping = true;
                ctx.localShapeStart = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                ctx.localShapeEnd = ctx.localShapeStart;
                ctx.measureAnchorPoints = [ctx.localShapeStart];
                renderAll();
            } else if (ctx.activeTool === 'lighting') {
                if (ctx.currentLightingType === 'light') {
                    if (ctx.hoveredLightId) {
                        ctx.selectedLightId = ctx.hoveredLightId;
                        ctx.activeDragLightId = ctx.hoveredLightId;
                        const light = ctx.lights.find((l) => l.id === ctx.hoveredLightId);
                        if (light) {
                            ctx.lightDragOffsetX = mouse.x - light.x;
                            ctx.lightDragOffsetY = mouse.y - light.y;
                        }
                        renderAll();
                    } else {
                        const lightBright = parseInt(document.getElementById('light-bright')?.value) || 20;
                        const lightDim = parseInt(document.getElementById('light-dim')?.value) || 40;
                        const lightColor = document.getElementById('light-color')?.value || '#ffffff';
                        const lightAngle = parseInt(document.getElementById('light-angle')?.value) || 360;
                        const lightRotation = parseInt(document.getElementById('light-rotation')?.value) || 0;
                        const animationType = document.getElementById('light-fx')?.value || 'none';
                        const animationSpeed = parseFloat(document.getElementById('light-speed')?.value) || 1.0;
                        const animationIntensity = parseFloat(document.getElementById('light-intensity')?.value) || 0.1;
                        const animationColor2 = document.getElementById('light-color2')?.value || '#ffe082';
                        const newLight = {
                            id: 'light_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            x: mouse.x,
                            y: mouse.y,
                            lightBright,
                            lightDim,
                            lightColor,
                            lightAngle,
                            lightRotation,
                            animationType,
                            animationSpeed,
                            animationIntensity,
                            animationColor2
                        };
                        if (!Array.isArray(ctx.lights)) ctx.lights = [];
                        ctx.lights.push(newLight);
                        vtt.socket.emit('lights:update', { mapId: ctx.currentMapId, lights: ctx.lights });
                        // vtt.socket.emit('chat:msg', { text: `[System] Placed light source at ${Math.round(mouse.x)}, ${Math.round(mouse.y)}.` });
                        renderAll();
                    }
                } else if (ctx.hoveredWallVertex) {
                    ctx.activeDragWallVertex = ctx.hoveredWallVertex;
                    ctx.selectedLightId = null;
                } else if (ctx.hoveredWallIdx !== -1) {
                    ctx.selectedWallIdx = ctx.hoveredWallIdx;
                    ctx.activeDragWallSegmentIdx = ctx.hoveredWallIdx;
                    ctx.selectedLightId = null;
                    const w = ctx.walls[ctx.hoveredWallIdx];
                    wallDragOffsetX1 = mouse.x - w.x1;
                    wallDragOffsetY1 = mouse.y - w.y1;
                    wallDragOffsetX2 = mouse.x - w.x2;
                    wallDragOffsetY2 = mouse.y - w.y2;
                    renderAll();
                } else {
                    ctx.selectedWallIdx = -1;
                    ctx.selectedLightId = null;
                    ctx.isDrawingWall = true;
                    ctx.wallStartPoint = e.altKey ? mouse : snapToGrid(mouse.x, mouse.y);
                    renderAll();
                }
            } else if (ctx.activeTool === 'paint') {
                if (paintSubTool === 'text') {
                    openDrawingTextInput(mouse.x, mouse.y);
                    return;
                }
                if (paintSubTool === 'fill') {
                    performCanvasFloodFill(mouse.x, mouse.y);
                    return;
                }
                if (paintSubTool === 'polygon') {
                    const pt = paintGridSnap ? snapToGridCenter(mouse.x, mouse.y) : mouse;
                    if (ctx.polygonPoints.length >= 2) {
                        const startPt = ctx.polygonPoints[0];
                        if (Math.hypot(pt.x - startPt.x, pt.y - startPt.y) <= 14 / ctx.zoom) {
                            // Close polygon
                            const newD = {
                                id: 'draw_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                type: 'polygon',
                                points: [...polygonPoints],
                                strokeColor: paintStrokeColor,
                                fillColor: paintFillColor,
                                strokeWidth: paintStrokeWidth,
                                fillMode: paintFillMode,
                                layer:
                                    ctx.activeLayer === 'lighting' || ctx.activeLayer === 'ctx.notes'
                                        ? 'token'
                                        : ctx.activeLayer,
                                ownerUsername: vtt.username,
                                timestamp: Date.now()
                            };
                            if (!ctx.drawings) ctx.drawings = {};
                            ctx.drawings[newD.id] = newD;
                            ctx.paintUndoStack.push({ action: 'add', drawing: { ...newD } });
                            ctx.paintRedoStack = [];
                            ctx.polygonPoints = [];
                            emitDrawingsUpdate();
                            renderAll();
                            return;
                        }
                    }
                    ctx.polygonPoints.push(pt);
                    renderAll();
                    return;
                }
                if (paintSubTool === 'eraser') {
                    ctx.isDrawingPaint = true;
                    ctx.currentPaintStroke = {
                        id: 'draw_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        type: 'eraser',
                        points: [{ x: mouse.x, y: mouse.y }],
                        strokeWidth: Math.max(16, paintStrokeWidth * 3),
                        layer:
                            ctx.activeLayer === 'lighting' || ctx.activeLayer === 'ctx.notes'
                                ? 'token'
                                : ctx.activeLayer,
                        ownerUsername: vtt.username,
                        timestamp: Date.now()
                    };
                    renderAll();
                    return;
                }
                if (paintSubTool === 'pencil' || paintSubTool === 'brush') {
                    ctx.isDrawingPaint = true;
                    const w =
                        paintSubTool === 'pencil'
                            ? Math.max(1, Math.min(3, Math.round(paintStrokeWidth / 2)))
                            : paintStrokeWidth;
                    ctx.currentPaintStroke = {
                        id: 'draw_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        type: paintSubTool,
                        points: [{ x: mouse.x, y: mouse.y }],
                        strokeColor: paintStrokeColor,
                        strokeWidth: w,
                        layer:
                            ctx.activeLayer === 'lighting' || ctx.activeLayer === 'ctx.notes'
                                ? 'token'
                                : ctx.activeLayer,
                        ownerUsername: vtt.username,
                        timestamp: Date.now()
                    };
                    renderAll();
                    return;
                }
                if (
                    paintSubTool === 'line' ||
                    paintSubTool === 'arrow' ||
                    paintSubTool === 'rect' ||
                    paintSubTool === 'circle'
                ) {
                    ctx.isDrawingPaint = true;
                    const startPt = paintGridSnap ? snapToGridCenter(mouse.x, mouse.y) : { x: mouse.x, y: mouse.y };
                    ctx.currentPaintStroke = {
                        id: 'draw_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        type: paintSubTool,
                        startPoint: startPt,
                        endPoint: { ...startPt },
                        strokeColor: paintStrokeColor,
                        fillColor: paintFillColor,
                        strokeWidth: paintStrokeWidth,
                        fillMode: paintFillMode,
                        layer:
                            ctx.activeLayer === 'lighting' || ctx.activeLayer === 'ctx.notes'
                                ? 'token'
                                : ctx.activeLayer,
                        ownerUsername: vtt.username,
                        timestamp: Date.now()
                    };
                    renderAll();
                    return;
                }
            } else if (ctx.activeTool === 'maptools' || ctx.activeTool === 'map-tools') {
                handleMapToolMouseDown(mouse, e);
                return;
            }
        } catch (err) {
            console.error('VTT Canvas Interaction Error (mousedown):', err);
        }
    });

    if (typeof window !== 'undefined') {
        window.addEventListener('mousemove', (e) => {
            lastMouseEvent = e;
            ctx.currentMouseCoords = getCanvasMouseCoords(e);
            updateCoordinateDisplay(ctx.currentMouseCoords);
            if (ctx.isPanning) {
                hideGmTokenTooltip();
                ctx.hasPanned = true;
                ctx.panX = e.clientX - startPanX;
                ctx.panY = e.clientY - startPanY;
                updateContainerTransform();
                return;
            }

            if (ctx.isBoxSelecting) {
                const mouse = getCanvasMouseCoords(e);
                ctx.boxSelectEnd = mouse;
                renderAll();
                return;
            }

            if (ctx.activeRotatePortalId) {
                const mouse = getCanvasMouseCoords(e);
                const portal = portals.find((p) => p.id === ctx.activeRotatePortalId);
                if (portal) {
                    const center = calcPortalCenter(portal);
                    let deg = Math.round(
                        ((Math.atan2(mouse.y - center.y, mouse.x - center.x) * 180) / Math.PI + 360) % 360
                    );
                    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
                    portal.facingAngle = deg;
                    portal.viewSideFlipped = false;

                    const angleSlider = document.getElementById('maptools-portal-facing-angle');
                    const angleNum = document.getElementById('maptools-portal-facing-angle-num');
                    const angleVal = document.getElementById('maptools-portal-facing-angle-val');
                    if (angleSlider) angleSlider.value = deg;
                    if (angleNum) angleNum.value = deg;
                    if (angleVal) angleVal.textContent = `${deg}°`;

                    canvasInteraction.style.cursor = 'grabbing';
                    renderAll();
                }
                return;
            }

            // Hover check for portal handles (rotation & resize)
            hoveredRotatePortalId = null;
            ctx.hoveredMapToolHandle = null;
            if (
                vtt.role === 'GM' &&
                (ctx.activeLayer === 'portals' ||
                    ctx.selectedMapToolItem?.type === 'portal' ||
                    ctx.activeTool === 'maptools' ||
                    ctx.activeTool === 'map-tools') &&
                !ctx.activeResizeMapToolHandle &&
                !ctx.activeDragMapToolItem &&
                !ctx.activeRotatePortalId
            ) {
                const handleHit = getPortalHandleUnderMouse(ctx.currentMouseCoords);
                if (handleHit) {
                    ctx.hoveredMapToolHandle = handleHit;
                    if (handleHit.type === 'rotate') {
                        hoveredRotatePortalId = handleHit.portal.id;
                        canvasInteraction.style.cursor = 'grab';
                        renderAll();
                    } else if (handleHit.type === 'resize') {
                        canvasInteraction.style.cursor = handleHit.handle.cursor || 'pointer';
                        renderAll();
                    }
                }
            }

            if (ctx.isRotatingLight && ctx.rotatingLightEntity) {
                const mouse = getCanvasMouseCoords(e);
                let center = null;
                if (ctx.rotatingLightEntity.type === 'light') {
                    const l = ctx.lights.find((item) => item.id === ctx.rotatingLightEntity.id);
                    if (l) center = { x: l.x, y: l.y };
                } else if (ctx.rotatingLightEntity.type === 'token') {
                    const t = ctx.tokens[ctx.rotatingLightEntity.id];
                    if (t) center = getTokenCenter(t);
                }
                if (center) {
                    let deg = Math.round((Math.atan2(mouse.y - center.y, mouse.x - center.x) * 180) / Math.PI);
                    if (deg < 0) deg += 360;
                    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
                    if (ctx.rotatingLightEntity.type === 'light') {
                        const l = ctx.lights.find((item) => item.id === ctx.rotatingLightEntity.id);
                        if (l) {
                            l.lightRotation = deg;
                            const rotEl = document.getElementById('light-rotation');
                            if (rotEl) rotEl.value = deg;
                        }
                    } else if (ctx.rotatingLightEntity.type === 'token') {
                        const t = ctx.tokens[ctx.rotatingLightEntity.id];
                        if (t) {
                            const localDeg = getLocalLightFacingFromWorldAngle(t, deg);
                            t.lightRotation = localDeg;
                            const rotEl = document.getElementById('token-edit-light-rotation');
                            if (rotEl) rotEl.value = localDeg;
                        }
                    }
                    renderAll();
                }
                return;
            }

            if (ctx.activeTool === 'select') {
                const mouse = getCanvasMouseCoords(e);

                // Map tool resize in progress
                if (ctx.activeResizeMapToolHandle) {
                    const item =
                        ctx.activeResizeMapToolHandle.type === 'trap'
                            ? traps.find((t) => t.id === ctx.activeResizeMapToolHandle.id)
                            : portals.find((p) => p.id === ctx.activeResizeMapToolHandle.id);
                    if (item) {
                        applyMapToolResize(
                            item,
                            ctx.activeResizeMapToolHandle.origGeom,
                            ctx.activeResizeMapToolHandle.handle,
                            mouse,
                            e
                        );
                        renderAll();
                    }
                    return;
                }

                // Map tool drag reposition in progress
                if (ctx.activeDragMapToolItem && ctx.mapToolDragStart && mapToolDragOriginalGeom) {
                    const dx = mouse.x - ctx.mapToolDragStart.x;
                    const dy = mouse.y - ctx.mapToolDragStart.y;
                    const item =
                        ctx.activeDragMapToolItem.type === 'trap'
                            ? traps.find((t) => t.id === ctx.activeDragMapToolItem.id)
                            : portals.find((p) => p.id === ctx.activeDragMapToolItem.id);
                    if (item) {
                        updateDraggedMapToolGeom(item.geom, mapToolDragOriginalGeom, dx, dy);
                        renderAll();
                    }
                    return;
                }

                // Map tool resize handles hover cursor
                if (ctx.selectedMapToolItem && !ctx.activeResizeMapToolHandle && !ctx.activeDragMapToolItem) {
                    const selItem =
                        ctx.selectedMapToolItem.type === 'trap'
                            ? traps.find((t) => t.id === ctx.selectedMapToolItem.id)
                            : portals.find((p) => p.id === ctx.selectedMapToolItem.id);
                    if (selItem) {
                        const rHandle = getMapToolResizeHandleAt(selItem, mouse);
                        if (rHandle) {
                            canvasInteraction.style.cursor = rHandle.cursor;
                        }
                        if (ctx.selectedMapToolItem.type === 'portal' && !selItem.isRadial) {
                            const hPos = getPortalRotationHandlePos(selItem);
                            if (hPos && Math.hypot(mouse.x - hPos.x, mouse.y - hPos.y) <= 14 / ctx.zoom) {
                                canvasInteraction.style.cursor = 'grab';
                            }
                        }
                    }
                }

                // Drawing resize handles hover cursor
                if (ctx.selectedDrawingId && ctx.drawings[ctx.selectedDrawingId] && !ctx.activeDragDrawingId) {
                    const selD = ctx.drawings[ctx.selectedDrawingId];
                    const handle = getDrawingResizeHandleAtPoint(selD, mouse);
                    if (handle) {
                        const cursors = {
                            nw: 'nwse-resize',
                            se: 'nwse-resize',
                            ne: 'nesw-resize',
                            sw: 'nesw-resize',
                            n: 'ns-resize',
                            s: 'ns-resize',
                            w: 'ew-resize',
                            e: 'ew-resize'
                        };
                        canvasInteraction.style.cursor = cursors[handle] || 'pointer';
                    }
                }

                // Drawing Move / Resize in progress
                if (ctx.activeDragDrawingId && ctx.drawings[ctx.activeDragDrawingId] && drawingOriginalState) {
                    const d = ctx.drawings[ctx.activeDragDrawingId];
                    if (activeDrawingResizeHandle && drawingResizeOriginalBBox) {
                        applyDrawingResize(
                            d,
                            drawingResizeOriginalBBox,
                            activeDrawingResizeHandle,
                            mouse,
                            drawingOriginalState
                        );
                    } else if (drawingDragStart) {
                        const dx = mouse.x - drawingDragStart.x;
                        const dy = mouse.y - drawingDragStart.y;
                        if (drawingOriginalState.points) {
                            d.points = drawingOriginalState.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
                        }
                        if (drawingOriginalState.startPoint) {
                            d.startPoint = {
                                x: drawingOriginalState.startPoint.x + dx,
                                y: drawingOriginalState.startPoint.y + dy
                            };
                        }
                        if (drawingOriginalState.endPoint) {
                            d.endPoint = {
                                x: drawingOriginalState.endPoint.x + dx,
                                y: drawingOriginalState.endPoint.y + dy
                            };
                        }
                        if (drawingOriginalState.x !== undefined) {
                            d.x = drawingOriginalState.x + dx;
                        }
                        if (drawingOriginalState.y !== undefined) {
                            d.y = drawingOriginalState.y + dy;
                        }
                    }
                    renderAll();
                    return;
                }

                // Note pin drag
                if (draggingNoteId) {
                    const note = ctx.notes.find((n) => n.id === draggingNoteId);
                    if (note) {
                        note.x = mouse.x - ctx.noteDragOffsetX;
                        note.y = mouse.y - ctx.noteDragOffsetY;
                        renderAll();
                    }
                    return;
                }

                if (activeResizeTokenId) {
                    const token = ctx.tokens[activeResizeTokenId];
                    if (token && resizeDragStartDims) {
                        const gridPx = (ctx.grid.size || 50) * (ctx.grid.scale || 1.0);
                        let rawW = Math.max(20, mouse.x - token.x);
                        let rawH = Math.max(20, mouse.y - token.y);

                        // Shift key: preserve aspect ratio
                        if (e.shiftKey && resizeDragStartDims.pixelWidth > 0 && resizeDragStartDims.pixelHeight > 0) {
                            const aspect = resizeDragStartDims.pixelWidth / resizeDragStartDims.pixelHeight;
                            if (rawW / rawH > aspect) {
                                rawW = rawH * aspect;
                            } else {
                                rawH = rawW / aspect;
                            }
                        }

                        let newPixelW, newPixelH;
                        if (e.altKey) {
                            // Alt key: free unsnapped pixel resize
                            newPixelW = Math.round(rawW);
                            newPixelH = Math.round(rawH);
                        } else {
                            // Default: ctx.grid-cell snapped resize
                            let widthUnits = Math.max(1, Math.round(rawW / gridPx));
                            let heightUnits = Math.max(1, Math.round(rawH / gridPx));
                            newPixelW = widthUnits * gridPx;
                            newPixelH = heightUnits * gridPx;
                            if (
                                e.shiftKey &&
                                resizeDragStartDims.pixelWidth > 0 &&
                                resizeDragStartDims.pixelHeight > 0
                            ) {
                                const aspect = resizeDragStartDims.pixelWidth / resizeDragStartDims.pixelHeight;
                                if (widthUnits / heightUnits > aspect) {
                                    newPixelW = Math.round(newPixelH * aspect);
                                } else {
                                    newPixelH = Math.round(newPixelW / aspect);
                                }
                            }
                        }

                        token.pixelWidth = newPixelW;
                        token.pixelHeight = newPixelH;

                        // Sync ctx.grid dimensions
                        const customW = Math.max(1, Math.round((newPixelW / gridPx) * 100) / 100);
                        const customH = Math.max(1, Math.round((newPixelH / gridPx) * 100) / 100);
                        token.customWidth = customW;
                        token.customHeight = customH;
                        token.size = Math.max(customW, customH);

                        renderAll();
                    }
                    return;
                }

                if (activeRotateTokenId) {
                    const token = ctx.tokens[activeRotateTokenId];
                    if (token) {
                        const { drawW, drawH } = getTokenDrawDimensions(token);
                        const renderPos = ctx.tokenAnimations[token.id]?.currentPos || { x: token.x, y: token.y };
                        const cx = renderPos.x + drawW / 2;
                        const cy = renderPos.y + drawH / 2;
                        const currentMouseAngle = (Math.atan2(mouse.y - cy, mouse.x - cx) * 180) / Math.PI;

                        let delta = currentMouseAngle - rotateStartMouseAngle;
                        let newAngle = (rotateInitialTokenRotation + delta) % 360;
                        if (newAngle < 0) newAngle += 360;

                        if (e.shiftKey) {
                            newAngle = (Math.round(newAngle / 15) * 15) % 360;
                        } else {
                            newAngle = Math.round(newAngle * 10) / 10;
                        }

                        token.rotation = newAngle;
                        renderAll();
                    }
                    return;
                }

                let newHoveredResizeTokenId = null;
                let newHoveredRotateTokenId = null;
                if (ctx.activeTool === 'select' && !ctx.dragTargetId && !activeRotateTokenId && !activeResizeTokenId) {
                    ctx.selectedTokenIds.forEach((id) => {
                        const token = ctx.tokens[id];
                        const tokenLayer = token?.layer || 'token';
                        if (token && isTokenControlledByPlayer(token) && tokenLayer === ctx.activeLayer) {
                            if (token.isAsset) {
                                const rh = getTokenResizeHandlePos(token);
                                if (rh) {
                                    if (
                                        mouse.x >= rh.x - 8 &&
                                        mouse.x <= rh.x + 8 &&
                                        mouse.y >= rh.y - 8 &&
                                        mouse.y <= rh.y + 8
                                    ) {
                                        newHoveredResizeTokenId = id;
                                    }
                                }
                            }
                            const h = getTokenRotationHandlePos(token);
                            if (h && !newHoveredResizeTokenId) {
                                const dist = Math.hypot(mouse.x - h.x, mouse.y - h.y);
                                if (dist <= 10 / ctx.zoom) {
                                    newHoveredRotateTokenId = id;
                                }
                            }
                        }
                    });
                }
                if (hoveredResizeTokenId !== newHoveredResizeTokenId) {
                    hoveredResizeTokenId = newHoveredResizeTokenId;
                    if (hoveredResizeTokenId) canvasInteraction.style.cursor = 'nwse-resize';
                    renderAll();
                }
                if (hoveredRotateTokenId !== newHoveredRotateTokenId) {
                    hoveredRotateTokenId = newHoveredRotateTokenId;
                    if (hoveredRotateTokenId) canvasInteraction.style.cursor = 'grab';
                    renderAll();
                }
                // Interactive doors/windows hover
                const hoveredDoorAction = getInteractiveDoorAtCoord(mouse.x, mouse.y);
                if (hoveredDoorAction) {
                    canvasInteraction.style.cursor = 'pointer';
                    const w = ctx.walls[hoveredDoorAction.wallIdx];
                    let tip = '';
                    if (hoveredDoorAction.action === 'toggleOpen') {
                        tip =
                            w.isLocked && vtt.role !== 'GM'
                                ? w.type === 'window'
                                    ? 'Locked Window'
                                    : 'Locked Door'
                                : w.isOpen
                                  ? 'Close'
                                  : 'Open';
                    } else if (hoveredDoorAction.action === 'toggleLock') {
                        tip = w.isLocked ? 'Unlock (GM)' : 'Lock (GM)';
                    } else if (hoveredDoorAction.action === 'toggleSecret') {
                        tip = w.isSecret ? 'Make Visible to Players (GM)' : 'Make Secret (GM)';
                    } else if (hoveredDoorAction.action === 'toggleSeeThrough') {
                        const isST = w.isSeeThrough !== undefined ? w.isSeeThrough : !w.isDrawn;
                        tip = isST ? 'Make Window Opaque (GM)' : 'Make Window See-Through (GM)';
                    }
                    canvasInteraction.title = tip;
                } else if (canvasInteraction.title) {
                    canvasInteraction.title = '';
                }

                if (
                    !hoveredResizeTokenId &&
                    !hoveredRotateTokenId &&
                    !ctx.hoverTokenId &&
                    !ctx.hoveredNoteId &&
                    !ctx.dragTargetId &&
                    !activeResizeTokenId &&
                    !activeRotateTokenId &&
                    !hoveredDoorAction
                ) {
                    canvasInteraction.style.cursor = '';
                }

                if (
                    !ctx.activeDragShapeId &&
                    !ctx.dragTargetId &&
                    !ctx.activeDragLightId &&
                    !ctx.activeDragWallVertex &&
                    ctx.activeDragWallSegmentIdx === -1
                ) {
                    ctx.hoveredShapeComponent = null;

                    // Note hover detection
                    const newHoveredNote = getNoteAtCoord(mouse.x, mouse.y);
                    if (newHoveredNote !== ctx.hoveredNoteId) {
                        ctx.hoveredNoteId = newHoveredNote;
                        canvasInteraction.style.cursor = ctx.hoveredNoteId ? 'pointer' : '';
                        renderAll();
                    }

                    // Token hover detection
                    if (ctx.activeLayer === 'map' || ctx.activeLayer === 'token' || ctx.activeLayer === 'gm') {
                        const newHoveredToken = getTokenAtPoint(mouse, false, true);
                        const newHoverTokenId = newHoveredToken ? newHoveredToken.id : null;
                        if (newHoverTokenId !== ctx.hoverTokenId) {
                            ctx.hoverTokenId = newHoverTokenId;
                            if (ctx.hoverTokenId) canvasInteraction.style.cursor = 'pointer';
                            else if (!ctx.hoveredNoteId) canvasInteraction.style.cursor = '';
                            if (window.VTT?.sheetDock?.highlightTabForToken) {
                                window.VTT.sheetDock.highlightTabForToken(ctx.hoverTokenId);
                            }
                            renderAll();
                        }

                        // Stat tooltip — schedule on hover, hide on leave
                        if (newHoverTokenId !== tokenTooltipPendingId) {
                            tokenTooltipPendingId = newHoverTokenId;
                            if (gmTokenTooltipTimeout) {
                                clearTimeout(gmTokenTooltipTimeout);
                                gmTokenTooltipTimeout = null;
                            }

                            if (
                                newHoverTokenId &&
                                ctx.tokens[newHoverTokenId] &&
                                !ctx.selectedTokenIds.has(newHoverTokenId) &&
                                isTokenTooltipAllowed(ctx.tokens[newHoverTokenId])
                            ) {
                                const delay = gmTokenTooltipTokenId ? 80 : 220;
                                gmTokenTooltipTimeout = setTimeout(() => {
                                    gmTokenTooltipTimeout = null;
                                    showGmTokenTooltip(newHoverTokenId);
                                }, delay);
                            } else {
                                hideGmTokenTooltip();
                            }
                        }
                    } else if (ctx.hoverTokenId !== null) {
                        ctx.hoverTokenId = null;
                        if (!ctx.hoveredNoteId) canvasInteraction.style.cursor = '';
                        renderAll();
                        hideGmTokenTooltip();
                    }

                    if (ctx.activeLayer !== 'lighting') {
                        const component = getShapeComponentAtCoord(mouse.x, mouse.y);
                        if (component) {
                            const shape = ctx.shapes[component.shapeId];
                            const shapeLayer = shape?.layer || 'token';
                            if (shape && shapeLayer === ctx.activeLayer && isShapeControlledByPlayer(shape)) {
                                ctx.hoveredShapeComponent = component;
                            }
                        }
                    }
                }

                if (ctx.activeLayer === 'lighting') {
                    if (ctx.activeDragLightId) {
                        const nx = mouse.x;
                        const ny = mouse.y;
                        const light = ctx.lights.find((l) => l.id === ctx.activeDragLightId);
                        if (light) {
                            light.x = nx - ctx.lightDragOffsetX;
                            light.y = ny - ctx.lightDragOffsetY;
                            if (!e.altKey && ctx.grid) {
                                const snapped = snapToGrid(light.x, light.y);
                                light.x = snapped.x;
                                light.y = snapped.y;
                            }
                        }
                        renderAll();
                    } else if (ctx.activeDragWallVertex) {
                        const nx = e.altKey ? mouse.x : snapToGrid(mouse.x, mouse.y).x;
                        const ny = e.altKey ? mouse.y : snapToGrid(mouse.x, mouse.y).y;
                        if (ctx.activeDragWallVertex.endpoint === 1) {
                            ctx.walls[ctx.activeDragWallVertex.wallIdx].x1 = nx;
                            ctx.walls[ctx.activeDragWallVertex.wallIdx].y1 = ny;
                        } else {
                            ctx.walls[ctx.activeDragWallVertex.wallIdx].x2 = nx;
                            ctx.walls[ctx.activeDragWallVertex.wallIdx].y2 = ny;
                        }
                        renderAll();
                    } else if (ctx.activeDragWallSegmentIdx !== -1) {
                        let nx = mouse.x;
                        let ny = mouse.y;
                        if (!e.altKey && ctx.grid) {
                            const snapped = snapToGrid(nx, ny);
                            nx = snapped.x;
                            ny = snapped.y;
                        }
                        const w = ctx.walls[ctx.activeDragWallSegmentIdx];
                        w.x1 = nx - wallDragOffsetX1;
                        w.y1 = ny - wallDragOffsetY1;
                        w.x2 = nx - wallDragOffsetX2;
                        w.y2 = ny - wallDragOffsetY2;
                        renderAll();
                    } else {
                        ctx.hoveredWallVertex = getWallVertexAtCoord(mouse.x, mouse.y);
                        ctx.hoveredWallIdx = ctx.hoveredWallVertex ? -1 : getWallSegmentAtCoord(mouse.x, mouse.y);
                        ctx.hoveredLightId = getLightAtCoord(mouse.x, mouse.y);
                        renderAll();
                    }
                }
            }

            if (ctx.activeDragShapeId && ctx.activeTool === 'select') {
                const mouse = getCanvasMouseCoords(e);
                const s = ctx.shapes[ctx.activeDragShapeId];
                if (s && isShapeControlledByPlayer(s)) {
                    if (ctx.activeDragShapeComponent.type === 'shape') {
                        let nx = mouse.x - ctx.shapeDragOffsetX;
                        let ny = mouse.y - ctx.shapeDragOffsetY;
                        if (!e.altKey && ctx.grid) {
                            const snapped = snapToHalfGrid(nx, ny);
                            nx = snapped.x;
                            ny = snapped.y;
                        }

                        const center = getShapeCenterPoint(s);
                        const dx = nx - center.x;
                        const dy = ny - center.y;

                        if (dx !== 0 || dy !== 0) {
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

                            // If multiple ctx.shapes are selected, move them together by the same delta
                            if (
                                typeof ctx.selectedShapeIds !== 'undefined' &&
                                ctx.selectedShapeIds &&
                                ctx.selectedShapeIds.size > 1 &&
                                ctx.selectedShapeIds.has(ctx.activeDragShapeId)
                            ) {
                                ctx.selectedShapeIds.forEach((id) => {
                                    if (id === ctx.activeDragShapeId) return;
                                    const otherShape = ctx.shapes[id];
                                    if (otherShape && isShapeControlledByPlayer(otherShape)) {
                                        otherShape.startPoint.x += dx;
                                        otherShape.startPoint.y += dy;
                                        otherShape.endPoint.x += dx;
                                        otherShape.endPoint.y += dy;
                                        if (otherShape.points) {
                                            otherShape.points.forEach((p) => {
                                                p.x += dx;
                                                p.y += dy;
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    } else if (ctx.activeDragShapeComponent.type === 'anchor') {
                        let nx = mouse.x;
                        let ny = mouse.y;
                        if (!e.altKey && ctx.grid) {
                            const snapped = snapToHalfGrid(nx, ny);
                            nx = snapped.x;
                            ny = snapped.y;
                        }
                        const idx = ctx.activeDragShapeComponent.index;
                        if (s.points) {
                            s.points[idx].x = nx;
                            s.points[idx].y = ny;
                            if (idx === 0) s.startPoint = s.points[0];
                            if (idx === s.points.length - 1) s.endPoint = s.points[idx];
                        } else {
                            if (idx === 0) {
                                s.startPoint.x = nx;
                                s.startPoint.y = ny;
                            } else {
                                s.endPoint.x = nx;
                                s.endPoint.y = ny;
                            }
                        }
                    }
                    renderAll();
                }
            } else if (ctx.dragTargetId && ctx.activeTool === 'select') {
                const mouse = getCanvasMouseCoords(e);
                const t = ctx.tokens[ctx.dragTargetId];
                if (t) {
                    let nx = mouse.x - ctx.dragOffsetX;
                    let ny = mouse.y - ctx.dragOffsetY;

                    if (!e.altKey && ctx.grid) {
                        const snapped = snapToGrid(nx, ny, true);
                        nx = snapped.x;
                        ny = snapped.y;
                    }

                    const sourceOriginal = ctx.tokenDragOriginalPositions[ctx.dragTargetId] || { x: t.x, y: t.y };

                    const currentMap = vtt.campaignState?.maps?.[ctx.currentMapId];
                    if (vtt.role !== 'GM' && currentMap?.lightingSettings?.restrictMovement) {
                        const { drawW, drawH } = getTokenDrawDimensions(t);
                        const radius = Math.min(drawW, drawH) / 2;
                        const startCenter = { x: sourceOriginal.x + drawW / 2, y: sourceOriginal.y + drawH / 2 };
                        const endCenter = { x: nx + drawW / 2, y: ny + drawH / 2 };

                        let closestT = 1.0;
                        let collisionPoint = null;

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

                    if (ctx.selectedTokenIds.has(ctx.dragTargetId) && ctx.selectedTokenIds.size > 1) {
                        ctx.selectedTokenIds.forEach((id) => {
                            const original = ctx.tokenDragOriginalPositions[id];
                            if (!original || !ctx.tokens[id]) return;
                            if (!isTokenControlledByPlayer(ctx.tokens[id])) return; // Prevent dragging unowned ctx.tokens
                            ctx.tokens[id].x = original.x + deltaX;
                            ctx.tokens[id].y = original.y + deltaY;
                        });
                    } else {
                        if (isTokenControlledByPlayer(t)) {
                            t.x = nx;
                            t.y = ny;
                        }
                    }

                    if (ctx.selectedShapeIds && ctx.selectedShapeIds.size > 0) {
                        ctx.selectedShapeIds.forEach((id) => {
                            const s = ctx.shapes[id];
                            const original = shapeDragOriginalPositions[id];
                            if (!s || !original || !isShapeControlledByPlayer(s)) return;
                            s.startPoint.x = original.startPoint.x + deltaX;
                            s.startPoint.y = original.startPoint.y + deltaY;
                            s.endPoint.x = original.endPoint.x + deltaX;
                            s.endPoint.y = original.endPoint.y + deltaY;
                            if (s.points && original.points) {
                                s.points.forEach((p, idx) => {
                                    if (original.points[idx]) {
                                        p.x = original.points[idx].x + deltaX;
                                        p.y = original.points[idx].y + deltaY;
                                    }
                                });
                            }
                        });
                    }

                    if (ctx.selectedDrawingIds && ctx.selectedDrawingIds.size > 0) {
                        ctx.selectedDrawingIds.forEach((id) => {
                            const d = ctx.drawings[id];
                            const original = drawingDragOriginalPositions[id];
                            if (!d || !original || !isDrawingControlledByPlayer(d)) return;
                            if (d.x !== undefined && original.x !== undefined) d.x = original.x + deltaX;
                            if (d.y !== undefined && original.y !== undefined) d.y = original.y + deltaY;
                            if (d.startPoint && original.startPoint) {
                                d.startPoint.x = original.startPoint.x + deltaX;
                                d.startPoint.y = original.startPoint.y + deltaY;
                            }
                            if (d.endPoint && original.endPoint) {
                                d.endPoint.x = original.endPoint.x + deltaX;
                                d.endPoint.y = original.endPoint.y + deltaY;
                            }
                            if (d.points && original.points) {
                                d.points.forEach((p, idx) => {
                                    if (original.points[idx]) {
                                        p.x = original.points[idx].x + deltaX;
                                        p.y = original.points[idx].y + deltaY;
                                    }
                                });
                            }
                        });
                    }
                    if (ctx.localIsMeasuring && ctx.isTokenMeasuring) {
                        const { drawW, drawH } = getTokenDrawDimensions(t);
                        const tokenCenter = { x: t.x + drawW / 2, y: t.y + drawH / 2 };
                        ctx.localMeasureEnd = tokenCenter;
                        const color = document.getElementById('measure-color')?.value || '#00ffff';
                        const anchor = document.getElementById('measure-square-anchor')?.value || 'center';
                        const beamW = parseFloat(document.getElementById('measure-beam-width')?.value || 5);
                        const points =
                            ctx.measureAnchorPoints.length > 0 ? [...ctx.measureAnchorPoints, ctx.localMeasureEnd] : null;
                        const broadcast = document.getElementById('measure-broadcast')?.checked ?? true;
                        if (broadcast) {
                            emitMeasureUpdateThrottled({
                                mapId: ctx.currentMapId,
                                username: vtt.username,
                                start: ctx.localMeasureStart,
                                end: ctx.localMeasureEnd,
                                shape: 'line',
                                color,
                                squareAnchor: anchor,
                                beamWidth: beamW,
                                points
                            });
                        }

                        if (isMobileViewport()) {
                            const distInfo = calcDistanceFormatted(
                                Math.hypot(
                                    ctx.localMeasureEnd.x - ctx.localMeasureStart.x,
                                    ctx.localMeasureEnd.y - ctx.localMeasureStart.y
                                )
                            );
                            const dragPill = document.getElementById('vtt-mobile-drag-pill');
                            if (dragPill) {
                                const distSpan = document.getElementById('vtt-mobile-drag-dist');
                                if (distSpan) distSpan.textContent = distInfo.label;
                                dragPill.style.left = `${e.clientX || 0}px`;
                                dragPill.style.top = `${(e.clientY || 0) - 20}px`;
                                dragPill.classList.remove('vtt-hidden');
                            }
                        }
                    }
                    renderAll();
                }
            } else if (ctx.localIsMeasuring && (ctx.activeTool === 'measure' || ctx.isTokenMeasuring)) {
                const mouse = getCanvasMouseCoords(e);
                ctx.localMeasureEnd = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                const rawShape = ctx.isTokenMeasuring ? 'line' : document.getElementById('measure-shape')?.value || 'line';
                const color = document.getElementById('measure-color')?.value || '#00ffff';
                const anchor = document.getElementById('measure-square-anchor')?.value || 'center';
                const beamW = parseFloat(document.getElementById('measure-beam-width')?.value || 5);
                const points =
                    rawShape === 'line' && ctx.measureAnchorPoints.length > 0
                        ? [...ctx.measureAnchorPoints, ctx.localMeasureEnd]
                        : null;
                const broadcast = document.getElementById('measure-broadcast')?.checked ?? true;
                if (broadcast) {
                    emitMeasureUpdateThrottled({
                        mapId: ctx.currentMapId,
                        username: vtt.username,
                        start: ctx.localMeasureStart,
                        end: ctx.localMeasureEnd,
                        shape: rawShape,
                        color,
                        squareAnchor: anchor,
                        beamWidth: beamW,
                        points
                    });
                }
                renderAll();
            } else if (ctx.localIsShaping && ctx.activeTool === 'shape') {
                const mouse = getCanvasMouseCoords(e);
                ctx.localShapeEnd = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                renderAll();
            } else if (ctx.activeTool === 'lighting') {
                const mouse = getCanvasMouseCoords(e);
                if (ctx.activeDragLightId) {
                    const nx = mouse.x;
                    const ny = mouse.y;
                    const light = ctx.lights.find((l) => l.id === ctx.activeDragLightId);
                    if (light) {
                        light.x = nx - ctx.lightDragOffsetX;
                        light.y = ny - ctx.lightDragOffsetY;
                        if (!e.altKey && ctx.grid) {
                            const snapped = snapToGrid(light.x, light.y);
                            light.x = snapped.x;
                            light.y = snapped.y;
                        }
                    }
                    renderAll();
                } else if (ctx.activeDragWallVertex) {
                    const nx = e.altKey ? mouse.x : snapToGrid(mouse.x, mouse.y).x;
                    const ny = e.altKey ? mouse.y : snapToGrid(mouse.x, mouse.y).y;
                    if (ctx.activeDragWallVertex.endpoint === 1) {
                        ctx.walls[ctx.activeDragWallVertex.wallIdx].x1 = nx;
                        ctx.walls[ctx.activeDragWallVertex.wallIdx].y1 = ny;
                    } else {
                        ctx.walls[ctx.activeDragWallVertex.wallIdx].x2 = nx;
                        ctx.walls[ctx.activeDragWallVertex.wallIdx].y2 = ny;
                    }
                    renderAll();
                } else if (ctx.activeDragWallSegmentIdx !== -1) {
                    let nx = mouse.x;
                    let ny = mouse.y;
                    if (!e.altKey && ctx.grid) {
                        const snapped = snapToGrid(nx, ny);
                        nx = snapped.x;
                        ny = snapped.y;
                    }
                    const w = ctx.walls[ctx.activeDragWallSegmentIdx];
                    w.x1 = nx - wallDragOffsetX1;
                    w.y1 = ny - wallDragOffsetY1;
                    w.x2 = nx - wallDragOffsetX2;
                    w.y2 = ny - wallDragOffsetY2;
                    renderAll();
                } else if (ctx.isDrawingWall) {
                    renderAll();
                } else {
                    ctx.hoveredWallVertex = getWallVertexAtCoord(mouse.x, mouse.y);
                    ctx.hoveredWallIdx = ctx.hoveredWallVertex ? -1 : getWallSegmentAtCoord(mouse.x, mouse.y);
                    ctx.hoveredLightId = getLightAtCoord(mouse.x, mouse.y);
                    renderAll();
                }
            } else if (ctx.activeTool === 'paint') {
                if (paintSubTool === 'text') {
                    canvasInteraction.style.cursor = 'text';
                } else if (paintSubTool === 'eraser') {
                    canvasInteraction.style.cursor = 'cell';
                } else {
                    canvasInteraction.style.cursor = 'crosshair';
                }
                const mouse = getCanvasMouseCoords(e);
                if (paintSubTool === 'eraser' && !ctx.isDrawingPaint) {
                    renderAll();
                }
                if (ctx.isDrawingPaint && ctx.currentPaintStroke) {
                    if (
                        ctx.currentPaintStroke.type === 'pencil' ||
                        ctx.currentPaintStroke.type === 'brush' ||
                        ctx.currentPaintStroke.type === 'eraser'
                    ) {
                        const pts = ctx.currentPaintStroke.points;
                        const lastPt = pts[pts.length - 1];
                        if (Math.hypot(mouse.x - lastPt.x, mouse.y - lastPt.y) >= 2) {
                            pts.push({ x: mouse.x, y: mouse.y });
                            renderAll();
                        }
                    } else if (
                        ctx.currentPaintStroke.type === 'line' ||
                        ctx.currentPaintStroke.type === 'arrow' ||
                        ctx.currentPaintStroke.type === 'rect' ||
                        ctx.currentPaintStroke.type === 'circle'
                    ) {
                        let endPt = paintGridSnap ? snapToGridCenter(mouse.x, mouse.y) : { x: mouse.x, y: mouse.y };
                        if (e.shiftKey) {
                            const sp = ctx.currentPaintStroke.startPoint;
                            const dx = endPt.x - sp.x;
                            const dy = endPt.y - sp.y;
                            if (ctx.currentPaintStroke.type === 'rect' || ctx.currentPaintStroke.type === 'circle') {
                                const side = Math.max(Math.abs(dx), Math.abs(dy));
                                endPt = {
                                    x: sp.x + (dx >= 0 ? side : -side),
                                    y: sp.y + (dy >= 0 ? side : -side)
                                };
                            } else {
                                const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                                const dist = Math.hypot(dx, dy);
                                endPt = {
                                    x: sp.x + Math.cos(angle) * dist,
                                    y: sp.y + Math.sin(angle) * dist
                                };
                            }
                        }
                        ctx.currentPaintStroke.endPoint = endPt;
                        renderAll();
                    }
                }
            } else if (ctx.activeTool === 'maptools' || ctx.activeTool === 'map-tools') {
                const mouse = ctx.currentMouseCoords || getCanvasMouseCoords(e);
                handleMapToolMouseMove(mouse, e);
            }
        });
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('mouseup', (e) => {
            if (pingHoldTimeout) {
                clearTimeout(pingHoldTimeout);
                pingHoldTimeout = null;
            }
            if (pingForceSelectTimeout) {
                clearTimeout(pingForceSelectTimeout);
                pingForceSelectTimeout = null;
            }
            if (ctx.isPanning) {
                ctx.isPanning = false;
                if (ctx.hasPanned) {
                    renderAll();
                }
                return;
            }
            if (e.button !== 0) return;

            if (ctx.isRotatingLight) {
                ctx.isRotatingLight = false;
                if (ctx.rotatingLightEntity) {
                    if (ctx.rotatingLightEntity.type === 'light') {
                        vtt.socket.emit('lights:update', { mapId: ctx.currentMapId, lights: ctx.lights });
                    } else if (ctx.rotatingLightEntity.type === 'token') {
                        const t = ctx.tokens[ctx.rotatingLightEntity.id];
                        if (t && window.emitTokenUpdates) window.emitTokenUpdates(ctx.tokens);
                    }
                    ctx.rotatingLightEntity = null;
                }
                renderAll();
                return;
            }

            if (ctx.activeRotatePortalId) {
                const livePortals = ctx.portals || portals;
                if (vtt.campaignState?.maps?.[ctx.currentMapId]) {
                    vtt.campaignState.maps[ctx.currentMapId].portals = livePortals;
                }
                vtt.socket.emit('portals:update', { mapId: ctx.currentMapId, portals: livePortals });
                ctx.activeRotatePortalId = null;
                renderAll();
                return;
            }

            if (activeResizeTokenId) {
                activeResizeTokenId = null;
                resizeDragStartMouse = null;
                resizeDragStartDims = null;
                if (vtt.socket) window.emitTokenUpdates(ctx.tokens);
                renderAll();
                return;
            }

            if (activeRotateTokenId) {
                activeRotateTokenId = null;
                if (vtt.socket) window.emitTokenUpdates(ctx.tokens);
                renderAll();
                return;
            }

            if (ctx.isBoxSelecting) {
                if (ctx.boxSelectStart && ctx.boxSelectEnd) {
                    const bounds = getSelectionBounds(ctx.boxSelectStart, ctx.boxSelectEnd);
                    if (ctx.activeTool === 'select' && ctx.activeLayer === 'lighting') {
                        if (!boxSelectAdditive) {
                            ctx.selectedWallIdxs.clear();
                        }
                        ctx.walls.forEach((wall, idx) => {
                            if (
                                (wall.x1 >= bounds.x1 &&
                                    wall.x1 <= bounds.x2 &&
                                    wall.y1 >= bounds.y1 &&
                                    wall.y1 <= bounds.y2) ||
                                (wall.x2 >= bounds.x1 &&
                                    wall.x2 <= bounds.x2 &&
                                    wall.y2 >= bounds.y1 &&
                                    wall.y2 <= bounds.y2)
                            ) {
                                ctx.selectedWallIdxs.add(idx);
                            }
                        });

                        ctx.lights.forEach((light) => {
                            if (
                                light.x >= bounds.x1 &&
                                light.x <= bounds.x2 &&
                                light.y >= bounds.y1 &&
                                light.y <= bounds.y2
                            ) {
                                ctx.selectedLightId = light.id;
                            }
                        });
                    } else {
                        if (!boxSelectAdditive) {
                            ctx.selectedTokenIds.clear();
                            ctx.selectedTokenId = null;
                            ctx.selectedShapeIds.clear();
                            ctx.selectedShapeId = null;
                            ctx.selectedDrawingIds.clear();
                            ctx.selectedDrawingId = null;
                        }

                        // 1. Tokens on ctx.activeLayer
                        const tokenIds = Object.keys(ctx.tokens);
                        tokenIds.forEach((id) => {
                            const t = ctx.tokens[id];
                            if (!t) return;
                            const tokenLayer = t.layer || 'token';
                            if (tokenLayer !== ctx.activeLayer) return;
                            if (tokenLayer === 'gm' && vtt.role !== 'GM') return;
                            if (!isTokenControlledByPlayer(t)) return;

                            if (isTokenWithinSelection(t, bounds)) {
                                ctx.selectedTokenIds.add(id);
                            }
                        });

                        // 2. Shapes on ctx.activeLayer
                        if (typeof ctx.shapes !== 'undefined') {
                            Object.entries(ctx.shapes).forEach(([id, s]) => {
                                if (!s) return;
                                const shapeLayer = s.layer || 'token';
                                if (shapeLayer !== ctx.activeLayer) return;
                                if (shapeLayer === 'gm' && vtt.role !== 'GM') return;
                                if (!isShapeControlledByPlayer(s)) return;

                                const sBBox = getShapeBoundingBox(s);
                                if (
                                    sBBox &&
                                    sBBox.minX <= bounds.x2 &&
                                    sBBox.maxX >= bounds.x1 &&
                                    sBBox.minY <= bounds.y2 &&
                                    sBBox.maxY >= bounds.y1
                                ) {
                                    ctx.selectedShapeIds.add(id);
                                }
                            });
                        }

                        // 3. Drawings on ctx.activeLayer
                        if (typeof ctx.drawings !== 'undefined') {
                            Object.entries(ctx.drawings).forEach(([id, d]) => {
                                if (!d) return;
                                const drawingLayer = d.layer || 'token';
                                if (drawingLayer !== ctx.activeLayer) return;
                                if (drawingLayer === 'gm' && vtt.role !== 'GM') return;
                                if (!isDrawingControlledByPlayer(d)) return;

                                const dBBox = getDrawingBoundingBox(d);
                                if (
                                    dBBox &&
                                    dBBox.minX <= bounds.x2 &&
                                    dBBox.maxX >= bounds.x1 &&
                                    dBBox.minY <= bounds.y2 &&
                                    dBBox.maxY >= bounds.y1
                                ) {
                                    ctx.selectedDrawingIds.add(id);
                                }
                            });
                        }
                    }
                    renderAll();
                }
                ctx.isBoxSelecting = false;
                ctx.boxSelectStart = null;
                ctx.boxSelectEnd = null;
                boxSelectAdditive = false;
                renderAll();
                return;
            }

            if (draggingNoteId) {
                const wasDrag =
                    noteDragStartMouse &&
                    Math.hypot(
                        (ctx.currentMouseCoords?.x ?? 0) - noteDragStartMouse.x,
                        (ctx.currentMouseCoords?.y ?? 0) - noteDragStartMouse.y
                    ) > 5;
                if (wasDrag) {
                    vtt.socket.emit('notes:update', { mapId: ctx.currentMapId, notes: ctx.notes });
                } else {
                    // It was a click — open the note viewer
                    const note = ctx.notes.find((n) => n.id === draggingNoteId);
                    if (note) openNoteViewer(note);
                }
                draggingNoteId = null;
                noteDragStartMouse = null;
            } else if (ctx.activeDragDrawingId && ctx.activeTool === 'select') {
                const d = ctx.drawings[ctx.activeDragDrawingId];
                if (d && drawingOriginalState) {
                    ctx.paintUndoStack.push({
                        action: 'transform',
                        drawingId: ctx.activeDragDrawingId,
                        before: drawingOriginalState,
                        after: JSON.parse(JSON.stringify(d))
                    });
                    ctx.paintRedoStack = [];
                    emitDrawingsUpdate();
                }
                ctx.activeDragDrawingId = null;
                activeDrawingResizeHandle = null;
                drawingDragStart = null;
                drawingOriginalState = null;
                drawingResizeOriginalBBox = null;
                renderAll();
            } else if (ctx.activeResizeMapToolHandle) {
                if (ctx.activeResizeMapToolHandle.type === 'trap') {
                    const liveTraps = ctx.traps || traps;
                    if (vtt.campaignState?.maps?.[ctx.currentMapId]) {
                        vtt.campaignState.maps[ctx.currentMapId].traps = liveTraps;
                    }
                    vtt.socket.emit('traps:update', { mapId: ctx.currentMapId, traps: liveTraps });
                    renderPlacedTrapsList();
                } else {
                    const livePortals = ctx.portals || portals;
                    if (vtt.campaignState?.maps?.[ctx.currentMapId]) {
                        vtt.campaignState.maps[ctx.currentMapId].portals = livePortals;
                    }
                    vtt.socket.emit('portals:update', { mapId: ctx.currentMapId, portals: livePortals });
                    renderPlacedPortalsList();
                }
                ctx.activeResizeMapToolHandle = null;
                renderAll();
            } else if (ctx.activeDragMapToolItem) {
                if (ctx.activeDragMapToolItem.type === 'trap') {
                    const liveTraps = ctx.traps || traps;
                    if (vtt.campaignState?.maps?.[ctx.currentMapId]) {
                        vtt.campaignState.maps[ctx.currentMapId].traps = liveTraps;
                    }
                    vtt.socket.emit('traps:update', { mapId: ctx.currentMapId, traps: liveTraps });
                    renderPlacedTrapsList();
                } else {
                    const livePortals = ctx.portals || portals;
                    if (vtt.campaignState?.maps?.[ctx.currentMapId]) {
                        vtt.campaignState.maps[ctx.currentMapId].portals = livePortals;
                    }
                    vtt.socket.emit('portals:update', { mapId: ctx.currentMapId, portals: livePortals });
                    renderPlacedPortalsList();
                }
                ctx.activeDragMapToolItem = null;
                ctx.mapToolDragStart = null;
                mapToolDragOriginalGeom = null;
                renderAll();
            } else if (ctx.activeDragShapeId && ctx.activeTool === 'select') {
                const s = ctx.shapes[ctx.activeDragShapeId];
                if (s && isShapeControlledByPlayer(s)) {
                    vtt.socket.emit('shapes:update', { mapId: ctx.currentMapId, shapes: ctx.shapes });
                }
                ctx.activeDragShapeId = null;
                ctx.activeDragShapeComponent = null;
            } else if (ctx.dragTargetId && ctx.activeTool === 'select') {
                const movedTokensList = Array.from(ctx.selectedTokenIds)
                    .map((id) => ctx.tokens[id])
                    .filter(Boolean);
                if (!movedTokensList.some((t) => t.id === ctx.dragTargetId) && ctx.tokens[ctx.dragTargetId]) {
                    movedTokensList.push(ctx.tokens[ctx.dragTargetId]);
                }

                // Check if any moved token entered an inter-map portal (colliding with any square)
                let interMapPortalTrigger = null;
                for (const t of movedTokensList) {
                    const originalPos = ctx.tokenDragOriginalPositions[t.id] || { x: t.x, y: t.y };
                    if (originalPos.x !== t.x || originalPos.y !== t.y) {
                        const { drawW, drawH } = getTokenDrawDimensions(t);
                        const from = { x: originalPos.x + drawW / 2, y: originalPos.y + drawH / 2 };
                        const to = { x: t.x + drawW / 2, y: t.y + drawH / 2 };
                        const hitPortal = portals.find((po) => {
                            if (!po.walkThrough) return false;
                            if (tokenPortalDebounce.has(t.id) && tokenPortalDebounce.get(t.id).portalId === po.id)
                                return false;
                            if (!checkOneWayPortalEntry(po, from, to)) return false;
                            return isTokenCollidingWithPortal(t, po, from, to);
                        });

                        if (
                            hitPortal &&
                            hitPortal.targetPortalId &&
                            hitPortal.targetMapId &&
                            hitPortal.targetMapId !== ctx.currentMapId
                        ) {
                            interMapPortalTrigger = { leadToken: t, portal: hitPortal };
                            break;
                        }
                    }
                }

                if (interMapPortalTrigger) {
                    const { leadToken, portal } = interMapPortalTrigger;
                    const targetMapId = portal.targetMapId;
                    const targetMap = vtt.campaignState?.maps?.[targetMapId];
                    const targetPortal = targetMap?.portals?.find((p) => p.id === portal.targetPortalId);

                    if (targetPortal) {
                        const transitions = [];

                        movedTokensList.forEach((t) => {
                            delete t._animReq;
                            if (ctx.tokenAnimations[t.id]) delete ctx.tokenAnimations[t.id];
                            tokenPortalDebounce.set(t.id, { portalId: targetPortal.id, time: Date.now() });
                            t._portalTransitLock = Date.now() + 200;

                            const origPos = ctx.tokenDragOriginalPositions[t.id] || { x: t.x, y: t.y };
                            const { drawW: tW, drawH: tH } = getTokenDrawDimensions(t);
                            const tFrom = { x: origPos.x + tW / 2, y: origPos.y + tH / 2 };
                            const tTo = { x: t.x + tW / 2, y: t.y + tH / 2 };
                            const finalPos = calcSpatialPortalDestination(
                                portal,
                                targetPortal,
                                tFrom,
                                tTo,
                                targetMap,
                                t
                            );

                            // Pre-populate target map cache
                            if (targetMap) {
                                if (!targetMap.tokens) targetMap.tokens = {};
                                const moved = { ...t, x: finalPos.x, y: finalPos.y };
                                targetMap.tokens[t.id] = moved;
                            }

                            delete ctx.tokens[t.id];
                            delete lastBroadcastedTokens[t.id];

                            transitions.push({
                                tokenId: t.id,
                                targetX: finalPos.x,
                                targetY: finalPos.y,
                                targetPortalId: targetPortal.id,
                                username: vtt.username
                            });
                        });

                        pendingFocusTokenId = leadToken.id;
                        pendingFocusTokenExpiry = Date.now() + 30000;
                        window._portalTransitInfo = {
                            tokenId: leadToken.id,
                            targetMapId: targetMapId,
                            targetPortalId: targetPortal.id,
                            exitPos: { x: transitions[0].targetX, y: transitions[0].targetY },
                            timestamp: Date.now()
                        };

                        if (transitions.length > 1) {
                            vtt.socket.emit('portal:teleport_inter_map_batch', {
                                sourceMapId: ctx.currentMapId,
                                targetMapId: targetMapId,
                                targetPortalId: targetPortal.id,
                                transitions
                            });
                        } else if (transitions.length === 1) {
                            vtt.socket.emit('portal:teleport_inter_map', {
                                sourceMapId: ctx.currentMapId,
                                targetMapId: targetMapId,
                                targetPortalId: targetPortal.id,
                                tokenId: leadToken.id,
                                targetX: transitions[0].targetX,
                                targetY: transitions[0].targetY,
                                username: vtt.username
                            });
                        }
                        renderAll();
                    }
                } else {
                    // Regular triggers (traps, intra-map portals) for each moved token
                    movedTokensList.forEach((t) => {
                        const originalPos = ctx.tokenDragOriginalPositions[t.id] || { x: t.x, y: t.y };
                        if (originalPos.x !== t.x || originalPos.y !== t.y) {
                            if (tokenInsidePortals.has(t.id)) {
                                const insideSet = tokenInsidePortals.get(t.id);
                                const { drawW: dW, drawH: dH } = getTokenDrawDimensions(t);
                                const currentCenter = { x: t.x + dW / 2, y: t.y + dH / 2 };
                                insideSet.forEach((pId) => {
                                    const pObj = portals.find((p) => p.id === pId);
                                    if (!pObj || !isTokenCollidingWithPortal(t, pObj, null, currentCenter)) {
                                        insideSet.delete(pId);
                                    }
                                });
                                if (insideSet.size === 0) tokenInsidePortals.delete(t.id);
                            }
                            const triggerRes = checkTokenMoveTriggers(t, originalPos);
                            if (triggerRes?.action === 'teleport' || triggerRes?.action === 'trap') {
                                delete t._animReq;
                                if (ctx.tokenAnimations[t.id]) delete ctx.tokenAnimations[t.id];
                                if (triggerRes?.action === 'teleport' && ctx.tokens[t.id]) {
                                    ctx.selectedTokenIds.clear();
                                    ctx.selectedTokenIds.add(t.id);
                                    ctx.selectedTokenId = t.id;
                                }
                            } else {
                                t._animReq = {
                                    startX: originalPos.x,
                                    startY: originalPos.y,
                                    endX: t.x,
                                    endY: t.y,
                                    waypoints: ctx.isTokenMeasuring ? ctx.measureAnchorPoints.slice(1) : [],
                                    timestamp: Date.now(),
                                    duration: 500
                                };
                            }
                        }
                    });
                }
                window.emitTokenUpdates(ctx.tokens);
                processTokenAnimReqs(ctx.tokens);
                if (ctx.selectedShapeIds && ctx.selectedShapeIds.size > 0) {
                    vtt.socket.emit('shapes:update', { mapId: ctx.currentMapId, shapes: ctx.shapes });
                }
                if (ctx.selectedDrawingIds && ctx.selectedDrawingIds.size > 0) {
                    emitDrawingsUpdate();
                }
                ctx.dragTargetId = null;
                ctx.tokenDragOriginalPositions = {};
                shapeDragOriginalPositions = {};
                drawingDragOriginalPositions = {};
                const dragPill = document.getElementById('vtt-mobile-drag-pill');
                if (dragPill) dragPill.classList.add('vtt-hidden');
                if (ctx.isTokenMeasuring) {
                    ctx.isTokenMeasuring = false;
                    ctx.localIsMeasuring = false;
                    ctx.measureAnchorPoints = [];
                    vtt.socket.emit('measure:clear', { mapId: ctx.currentMapId, username: vtt.username });
                    ctx.localMeasureStart = null;
                    ctx.localMeasureEnd = null;
                }
            } else if (ctx.localIsMeasuring && ctx.activeTool === 'measure') {
                ctx.localIsMeasuring = false;
                ctx.measureAnchorPoints = [];
                vtt.socket.emit('measure:clear', { mapId: ctx.currentMapId, username: vtt.username });
                ctx.localMeasureStart = null;
                ctx.localMeasureEnd = null;
                renderAll();
            } else if (
                ctx.activeTool === 'lighting' ||
                (ctx.activeTool === 'select' && ctx.activeLayer === 'lighting')
            ) {
                if (ctx.activeDragLightId) {
                    vtt.socket.emit('lights:update', { mapId: ctx.currentMapId, lights: ctx.lights });
                    ctx.activeDragLightId = null;
                } else if (ctx.activeDragWallVertex) {
                    vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                    ctx.activeDragWallVertex = null;
                } else if (ctx.activeDragWallSegmentIdx !== -1) {
                    vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                    ctx.activeDragWallSegmentIdx = -1;
                } else if (ctx.isDrawingWall) {
                    ctx.isDrawingWall = false;
                    if (ctx.wallStartPoint) {
                        const mouse = getCanvasMouseCoords(e);
                        const endPoint = e.altKey ? mouse : snapToGrid(mouse.x, mouse.y);
                        if (!Array.isArray(ctx.walls)) ctx.walls = [];

                        const createSegment = (x1, y1, x2, y2, type = ctx.currentLightingType) => ({
                            id: 'wall_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            x1,
                            y1,
                            x2,
                            y2,
                            type,
                            isOpen: false,
                            isLocked: false,
                            isSecret: false,
                            isSeeThrough: type === 'window' ? false : undefined
                        });

                        if (ctx.currentLightingType === 'wall' && ctx.currentWallShape === 'rect') {
                            const minX = Math.min(ctx.wallStartPoint.x, endPoint.x);
                            const maxX = Math.max(ctx.wallStartPoint.x, endPoint.x);
                            const minY = Math.min(ctx.wallStartPoint.y, endPoint.y);
                            const maxY = Math.max(ctx.wallStartPoint.y, endPoint.y);
                            if (maxX - minX > 5 && maxY - minY > 5) {
                                ctx.walls.push(createSegment(minX, minY, maxX, minY));
                                ctx.walls.push(createSegment(maxX, minY, maxX, maxY));
                                ctx.walls.push(createSegment(maxX, maxY, minX, maxY));
                                ctx.walls.push(createSegment(minX, maxY, minX, minY));
                                vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                            }
                        } else if (ctx.currentLightingType === 'wall' && ctx.currentWallShape === 'circle') {
                            const r = Math.hypot(endPoint.x - ctx.wallStartPoint.x, endPoint.y - ctx.wallStartPoint.y);
                            if (r > 8) {
                                const numSegments = 24;
                                const dTheta = (Math.PI * 2) / numSegments;
                                for (let s = 0; s < numSegments; s++) {
                                    const a1 = s * dTheta;
                                    const a2 = (s + 1) * dTheta;
                                    const sx1 = ctx.wallStartPoint.x + r * Math.cos(a1);
                                    const sy1 = ctx.wallStartPoint.y + r * Math.sin(a1);
                                    const sx2 = ctx.wallStartPoint.x + r * Math.cos(a2);
                                    const sy2 = ctx.wallStartPoint.y + r * Math.sin(a2);
                                    ctx.walls.push(createSegment(sx1, sy1, sx2, sy2));
                                }
                                vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                            }
                        } else if (ctx.currentLightingType === 'wall' && ctx.currentWallShape === 'arc') {
                            const r = Math.hypot(endPoint.x - ctx.wallStartPoint.x, endPoint.y - ctx.wallStartPoint.y);
                            if (r > 8) {
                                const baseAngle = Math.atan2(
                                    endPoint.y - ctx.wallStartPoint.y,
                                    endPoint.x - ctx.wallStartPoint.x
                                );
                                const startArc = baseAngle - Math.PI / 2;
                                const numSegments = 12;
                                const dTheta = Math.PI / numSegments;
                                for (let s = 0; s < numSegments; s++) {
                                    const a1 = startArc + s * dTheta;
                                    const a2 = startArc + (s + 1) * dTheta;
                                    const sx1 = ctx.wallStartPoint.x + r * Math.cos(a1);
                                    const sy1 = ctx.wallStartPoint.y + r * Math.sin(a1);
                                    const sx2 = ctx.wallStartPoint.x + r * Math.cos(a2);
                                    const sy2 = ctx.wallStartPoint.y + r * Math.sin(a2);
                                    ctx.walls.push(createSegment(sx1, sy1, sx2, sy2));
                                }
                                vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                            }
                        } else {
                            if (Math.hypot(endPoint.x - ctx.wallStartPoint.x, endPoint.y - ctx.wallStartPoint.y) > 5) {
                                ctx.walls.push(
                                    createSegment(ctx.wallStartPoint.x, ctx.wallStartPoint.y, endPoint.x, endPoint.y)
                                );
                                vtt.socket.emit('walls:update', { mapId: ctx.currentMapId, walls: ctx.walls });
                            }
                        }
                    }
                    ctx.wallStartPoint = null;
                    renderAll();
                }
            } else if (ctx.localIsShaping && ctx.activeTool === 'shape') {
                ctx.localIsShaping = false;
                if (ctx.localShapeStart && ctx.localShapeEnd) {
                    const rawShape = document.getElementById('measure-shape')?.value || 'circle';
                    const color = document.getElementById('measure-color')?.value || '#00ffff';

                    let shapeData = {
                        id: 'shape_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        color,
                        ownerUsername: vtt.username,
                        layer: ctx.activeLayer || 'token',
                        shape: rawShape,
                        type: rawShape,
                        startPoint: ctx.localShapeStart,
                        endPoint: ctx.localShapeEnd,
                        squareAnchor: document.getElementById('measure-square-anchor')?.value || 'center',
                        beamWidth: parseFloat(document.getElementById('measure-beam-width')?.value || 5),
                        points:
                            rawShape === 'line' && ctx.measureAnchorPoints.length > 0
                                ? [...ctx.measureAnchorPoints, ctx.localShapeEnd]
                                : null
                    };

                    if (!ctx.shapes) ctx.shapes = {};
                    ctx.shapes[shapeData.id] = shapeData;
                    vtt.socket.emit('shapes:update', { mapId: ctx.currentMapId, shapes: ctx.shapes });
                }
                ctx.measureAnchorPoints = [];
                ctx.localShapeStart = null;
                ctx.localShapeEnd = null;
                renderAll();
            } else if (ctx.activeTool === 'paint') {
                if (ctx.isDrawingPaint) {
                    ctx.isDrawingPaint = false;
                    if (ctx.currentPaintStroke) {
                        if (!ctx.drawings) ctx.drawings = {};
                        ctx.drawings[ctx.currentPaintStroke.id] = ctx.currentPaintStroke;
                        ctx.paintUndoStack.push({ action: 'add', drawing: { ...ctx.currentPaintStroke } });
                        ctx.paintRedoStack = [];
                        ctx.currentPaintStroke = null;
                        emitDrawingsUpdate();
                        renderAll();
                    }
                }
            } else if (ctx.activeTool === 'maptools' || ctx.activeTool === 'map-tools') {
                const mouse = ctx.currentMouseCoords || getCanvasMouseCoords(e);
                handleMapToolMouseUp(mouse, e);
            }
        });

        canvasInteraction.addEventListener('mouseleave', () => {
            if (gmTokenTooltipTimeout) {
                clearTimeout(gmTokenTooltipTimeout);
                gmTokenTooltipTimeout = null;
            }
            tokenTooltipPendingId = null;
            hideGmTokenTooltip();
        });
    }

    return {
        getInteractiveDoorAtCoord
    };
}
