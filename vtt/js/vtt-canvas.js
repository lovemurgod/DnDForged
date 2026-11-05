import { getSafeVttUrl, getPlayerMapOverride } from './vtt-utils.js';
import { vttEventBus } from './vtt-event-bus.js';
import { WallSpatialIndex } from './canvas/vtt-spatial-quadtree.js';
import { vttImageCache } from './canvas/vtt-canvas-cache.js';
import { initCanvasLifecycle, teardownMapTransientState } from './canvas/vtt-canvas-lifecycle.js';
import { updateVisualFx as updateVisualFxExt } from './canvas/tokens/vtt-canvas-visual-fx.js';
import { setupPointerInteraction as setupPointerInteractionExt } from './canvas/vtt-canvas-interaction.js';
import { setupSocketSync as setupSocketSyncExt } from './canvas/vtt-canvas-socket-sync.js';
import {
    renderGmWallSegmentsPass,
    renderStandaloneLightsInteractionPass
} from './canvas/vtt-canvas-interaction-walls.js';
import { setupKeyboardShortcuts as setupKeyboardShortcutsExt } from './canvas/vtt-canvas-clipboard-shortcuts.js';
import {
    isTokenControlledByPlayer as isTokenControlledByPlayerExt,
    getSelectionBounds as getSelectionBoundsExt,
    isTokenWithinSelection as isTokenWithinSelectionExt,
    getTokenAtPoint as getTokenAtPointExt,
    hideAllToolPanels as hideAllToolPanelsExt,
    setupViewportControls as setupViewportControlsExt,
    setupToolControls as setupToolControlsExt,
    setupLayersControls as setupLayersControlsExt
} from './canvas/vtt-canvas-interaction-tools.js';
import {
    cancelActiveMeasurement as cancelActiveMeasurementExt,
    cancelTokenDrag as cancelTokenDragExt,
    startTouchTokenDrag as startTouchTokenDragExt,
    moveTouchTokenDrag as moveTouchTokenDragExt,
    endTouchTokenDrag as endTouchTokenDragExt
} from './canvas/vtt-canvas-touch.js';
import {
    cancelCameraAnimation as cancelCameraAnimationExt,
    panTo as panToExt,
    setZoom as setZoomExt,
    stepZoom as stepZoomExt,
    centerOnTokenOrMap as centerOnTokenOrMapExt,
    broadcastViewToPlayers as broadcastViewToPlayersExt,
    setupZoomHudControls as setupZoomHudControlsExt,
    updateContainerTransform as updateContainerTransformExt,
    updateCoordinateDisplay as updateCoordinateDisplayExt,
    setMapBackground as setMapBackgroundExt
} from './canvas/vtt-canvas-camera.js';
import {
    ytPingPongControllers,
    cleanupAllYouTubePingPong,
    cleanupYouTubePingPongForId,
    cleanupMediaElement,
    ensureYouTubeIframeApi,
    renderTokenAurasPass as renderTokenAurasPassExt,
    renderTokensLayer as renderTokensLayerExt,
    renderActivePingsPass as renderActivePingsPassExt,
    renderActiveDamageFXPass as renderActiveDamageFXPassExt,
    cleanupOrphanedTokenOverlays as cleanupOrphanedTokenOverlaysExt,
    triggerPingAnimation as triggerPingAnimationExt,
    animatePings as animatePingsExt,
    triggerDamageFXAnimation as triggerDamageFXAnimationExt,
    triggerHealingFXAnimation as triggerHealingFXAnimationExt,
    animateDamageFX as animateDamageFXExt,
    renderDamageFXBurst as renderDamageFXBurstExt,
    processTokenAnimReqs as processTokenAnimReqsExt,
    animateTokens as animateTokensExt,
    getTokenCategory as getTokenCategoryExt,
    getCategoryColor as getCategoryColorExt,
    isTokenResizableAsset as isTokenResizableAssetExt,
    getTokenResizeHandles as getTokenResizeHandlesExt,
    getTokenResizeHandleAt as getTokenResizeHandleAtExt,
    applyTokenResize as applyTokenResizeExt
} from './canvas/tokens/vtt-canvas-token-renderer.js';

import {
    isDrawingControlledByPlayer as isDrawingControlledByPlayerExt,
    getDrawingBoundingBox as getDrawingBoundingBoxExt,
    getDrawingResizeHandles as getDrawingResizeHandlesExt,
    getDrawingResizeHandleAtPoint as getDrawingResizeHandleAtPointExt,
    applyDrawingResize as applyDrawingResizeExt,
    getDrawingAtPoint as getDrawingAtPointExt,
    drawDrawingObject as drawDrawingObjectExt,
    renderDrawingsPass as renderDrawingsPassExt,
    performCanvasFloodFill as performCanvasFloodFillExt,
    hexToRgb as hexToRgbExt,
    openDrawingTextInput as openDrawingTextInputExt,
    commitDrawingTextInput as commitDrawingTextInputExt,
    cancelDrawingTextInput as cancelDrawingTextInputExt,
    eraseDrawingsAtPoint as eraseDrawingsAtPointExt,
    paintUndo as paintUndoExt,
    paintRedo as paintRedoExt,
    showDrawingContextMenu as showDrawingContextMenuExt,
    setupPaintRibbonControls as setupPaintRibbonControlsExt
} from './canvas/vtt-canvas-drawings.js';
import {
    showPortalContextMenu as showPortalContextMenuExt,
    playPortalTeleportFX as playPortalTeleportFXExt
} from './canvas/vtt-canvas-portals.js';
import {
    isShapeControlledByPlayer as isShapeControlledByPlayerExt,
    getShapeCenterPoint as getShapeCenterPointExt,
    getShapePolyPoints as getShapePolyPointsExt,
    getShapeBoundingBox as getShapeBoundingBoxExt,
    isPointInsideShape as isPointInsideShapeExt,
    isTokenIntersectingShape as isTokenIntersectingShapeExt,
    getPersistentShapeAtPoint as getPersistentShapeAtPointExt,
    showShapeContextMenu as showShapeContextMenuExt,
    changeShapeZOrder as changeShapeZOrderExt,
    getShapeComponentAtCoord as getShapeComponentAtCoordExt,
    drawShapeComponentHandles as drawShapeComponentHandlesExt
} from './canvas/vtt-canvas-shapes.js';
import {
    injectGmTooltipStyles,
    getResolvedCreatureMonsterData as getResolvedCreatureMonsterDataExt,
    getTokenAC as getTokenACExt,
    getTokenSpeed as getTokenSpeedExt,
    getTokenPP as getTokenPPExt,
    getTokenPassiveStats as getTokenPassiveStatsExt,
    isTokenTooltipAllowed as isTokenTooltipAllowedExt,
    showGmTokenTooltip as showGmTokenTooltipExt,
    _positionGmTooltip as _positionGmTooltipExt,
    hideGmTokenTooltip as hideGmTokenTooltipExt,
    openNoteViewer as openNoteViewerExt,
    openNoteEditor as openNoteEditorExt,
    closeNoteContextMenu as closeNoteContextMenuExt,
    showNoteContextMenu as showNoteContextMenuExt,
    showAddNoteContextMenu as showAddNoteContextMenuExt,
    renderNotePins as renderNotePinsExt
} from './canvas/vtt-canvas-tooltips-notes.js';

// DnDForged Map & Canvas Rendering Engine
import { createRenderScheduler } from './canvas/vtt-canvas-scheduler.js';
import {
    closeAnyWallModal as closeAnyWallModalExt,
    openWallSettingsModal as openWallSettingsModalExt,
    showDoorSettingsModal as showDoorSettingsModalExt,
    showWindowSettingsModal as showWindowSettingsModalExt,
    showWallSettingsModal as showWallSettingsModalExt
} from './canvas/vtt-canvas-wall-modals.js';
import {
    getGridDistanceSettings as getGridDistanceSettingsExt,
    calcDistanceFormatted as calcDistanceFormattedExt,
    calcDistanceFt as calcDistanceFtExt,
    drawMeasurementTemplate as drawMeasurementTemplateExt
} from './canvas/vtt-canvas-measure.js';
import {
    isPointInPoly as isPointInPolyExt,
    distToSegmentSq as distToSegmentSqExt,
    checkLineIntersection as checkLineIntersectionExt,
    checkLineCircleIntersection as checkLineCircleIntersectionExt,
    isPointInsideGeometry as isPointInsideGeometryExt,
    findEarliestPathIntersection as findEarliestPathIntersectionExt,
    calcGeometryCenter as calcGeometryCenterExt,
    renderTraps as renderTrapsExt,
    rollTrapSave as rollTrapSaveExt,
    renderPlacedTrapsList as renderPlacedTrapsListExt,
    triggerTrapSpringFX as triggerTrapSpringFXExt,
    postTrapTriggerChatCard as postTrapTriggerChatCardExt
} from './canvas/vtt-canvas-traps.js';
import {
    checkTokenMoveTriggers as checkTokenMoveTriggersExt,
    calcPortalCenter as calcPortalCenterExt,
    getPortalNormalVector as getPortalNormalVectorExt,
    getPortalRotationHandlePos as getPortalRotationHandlePosExt,
    checkOneWayPortalEntry as checkOneWayPortalEntryExt,
    isTokenCollidingWithPortal as isTokenCollidingWithPortalExt,
    calcSpatialPortalDestination as calcSpatialPortalDestinationExt,
    triggerTokenStepThroughAnimation as triggerTokenStepThroughAnimationExt,
    precacheConnectedMapAssets as precacheConnectedMapAssetsExt,
    resolveRulerPortalBending as resolveRulerPortalBendingExt,
    drawTargetRoomContent as drawTargetRoomContentExt,
    renderProjectedPortals as renderProjectedPortalsExt,
    renderPortals as renderPortalsExt,
    renderPlacedPortalsList as renderPlacedPortalsListExt,
    populateTargetPortalsDropdown as populateTargetPortalsDropdownExt,
    cleanupPortalReferences as cleanupPortalReferencesExt,
    showGMInterMapPortalToast as showGMInterMapPortalToastExt,
    showPlayerInterMapPortalToast as showPlayerInterMapPortalToastExt,
    getOrLoadTokenImage as getOrLoadTokenImageExt,
    resolveTokenImageSrc as resolveTokenImageSrcExt
} from './canvas/vtt-canvas-portals.js';
import {
    handleMapToolMouseDown as handleMapToolMouseDownExt,
    handleMapToolMouseMove as handleMapToolMouseMoveExt,
    handleMapToolMouseUp as handleMapToolMouseUpExt,
    cloneMapToolGeom as cloneMapToolGeomExt,
    updateDraggedMapToolGeom as updateDraggedMapToolGeomExt,
    getMapToolResizeHandles as getMapToolResizeHandlesExt,
    getMapToolResizeHandleAt as getMapToolResizeHandleAtExt,
    getPortalHandleUnderMouse as getPortalHandleUnderMouseExt,
    applyMapToolResize as applyMapToolResizeExt,
    getMapToolItemAtCoord as getMapToolItemAtCoordExt,
    selectMapToolItem as selectMapToolItemExt,
    deselectMapToolItem as deselectMapToolItemExt,
    saveSelectedMapToolItem as saveSelectedMapToolItemExt,
    deleteSelectedMapToolItem as deleteSelectedMapToolItemExt,
    updateMapToolDrawingUI as updateMapToolDrawingUIExt,
    commitNewMapToolItem as commitNewMapToolItemExt,
    renderSelectedMapToolHighlight as renderSelectedMapToolHighlightExt,
    renderMapToolDrawingPreview as renderMapToolDrawingPreviewExt,
    setupMapToolsControls as setupMapToolsControlsExt
} from './canvas/vtt-canvas-map-tools.js';
import {
    getWallCoordinatesForRaycasting as getWallCoordinatesForRaycastingExt,
    getLineIntersection as getLineIntersectionExt,
    computeVisibilityPolygon as computeVisibilityPolygonExt
} from './canvas/vtt-canvas-visibility.js';
import {
    LIGHTING_PRESETS,
    applyTokenLightingPreset as applyTokenLightingPresetExt,
    applyStandaloneLightingPreset as applyStandaloneLightingPresetExt,
    getTokenEffectiveLightFacing as getTokenEffectiveLightFacingExt,
    getLocalLightFacingFromWorldAngle as getLocalLightFacingFromWorldAngleExt,
    interpolateColors as interpolateColorsExt,
    getLightAtCoord as getLightAtCoordExt,
    setupLightingPanelControls as setupLightingPanelControlsExt,
    syncLightPanelWithLight as syncLightPanelWithLightExt
} from './canvas/vtt-canvas-lighting.js';
import { renderFogOfWarLayer as renderFogOfWarLayerExt } from './canvas/vtt-canvas-fog.js';
import {
    CONDITION_ICONS,
    getPcRollFormula as getPcRollFormulaExt,
    getTokenSaveMod as getTokenSaveModExt,
    rollSavingThrowToken as rollSavingThrowTokenExt,
    postSaveResolutionChatCard as postSaveResolutionChatCardExt,
    resolveSaveFromChat as resolveSaveFromChatExt,
    rollFromToken as rollFromTokenExt,
    showAddCustomConditionModal as showAddCustomConditionModalExt
} from './canvas/tokens/vtt-canvas-token-rollers.js';
import {
    _hasResistanceType as _hasResistanceTypeExt,
    syncTokensHpToCharacters as syncTokensHpToCharactersExt,
    applyDamageToTokens as applyDamageToTokensExt,
    applyCardDamageToToken as applyCardDamageToTokenExt,
    applyCompositeDamageToTokens as applyCompositeDamageToTokensExt,
    promptMassAttackDistribution as promptMassAttackDistributionExt,
    processMassAttackFromChat as processMassAttackFromChatExt,
    executeMassAttackResolution as executeMassAttackResolutionExt,
    processCardFullResolution as processCardFullResolutionExt,
    handleCardAction as handleCardActionExt,
    changeMassTokenZOrder as changeMassTokenZOrderExt,
    showApplyDamageModal as showApplyDamageModalExt,
    showMassRollContextMenu as showMassRollContextMenuExt
} from './canvas/tokens/vtt-canvas-mass-actions.js';
import {
    changeTokenZOrder as changeTokenZOrderExt,
    showTokenContextMenu as showTokenContextMenuExt
} from './canvas/tokens/vtt-canvas-token-menu.js';
import {
    WEATHER_CATEGORIES,
    WEATHER_PRESET_OPTIONS,
    parseWeatherSettings,
    emitWeatherUpdate as emitWeatherUpdateExt,
    renderWeatherLayersUI as renderWeatherLayersUIExt,
    setupWeatherControls as setupWeatherControlsExt
} from './canvas/vtt-canvas-weather.js';
import { setupTokenLocatorPanel as setupTokenLocatorPanelExt } from './canvas/vtt-canvas-token-locator.js';
import {
    syncGridConfigInputs as syncGridConfigInputsExt,
    hasMapManagerDataChanged as hasMapManagerDataChangedExt,
    escapeMapHtml as escapeMapHtmlExt,
    detectMapMediaType as detectMapMediaTypeExt,
    buildMapThumbnailMarkup as buildMapThumbnailMarkupExt,
    attachThumbnailHoverPreview as attachThumbnailHoverPreviewExt,
    initMapManagerControls as initMapManagerControlsExt,
    renderMapSidebar as renderMapSidebarExt,
    createMapCard as createMapCardExt,
    renderMapGrid as renderMapGridExt,
    setupEditMapModal as setupEditMapModalExt,
    openEditMapModal as openEditMapModalExt,
    setupMapUploadControls as setupMapUploadControlsExt,
    setupPushPlayersModal as setupPushPlayersModalExt,
    openPushPlayersModal as openPushPlayersModalExt
} from './canvas/vtt-canvas-map-manager.js';
import {
    isHexGrid as isHexGridExt,
    getNearestHexFeatures as getNearestHexFeaturesExt,
    snapToGrid as snapToGridExt,
    snapToGridCenter as snapToGridCenterExt,
    snapToHalfGrid as snapToHalfGridExt,
    renderGridLayer as renderGridLayerExt
} from './canvas/vtt-canvas-grid-renderer.js';
import {
    DEFAULT_PLAYER_TOKEN_PREFS,
    DEFAULT_GM_TOKEN_PREFS,
    VISIBILITY_TIERS,
    loadPlayerTokenPrefs,
    savePlayerTokenPrefs,
    loadGmTokenPrefs,
    saveGmTokenPrefs,
    getEffectiveVisibility as getEffectiveVisibilityExt,
    getEffectiveNumberVisible as getEffectiveNumberVisibleExt,
    isSplashOverlayOpen as isSplashOverlayOpenExt,
    closeSplashOverlay as closeSplashOverlayExt,
    showSplashOverlay as showSplashOverlayExt,
    triggerSplashForSelection as triggerSplashForSelectionExt
} from './canvas/tokens/vtt-canvas-token-config.js';
import {
    renderAuraList as renderAuraListExt,
    setupTokenEditModal as setupTokenEditModalExt,
    openTokenEditModal as openTokenEditModalExt
} from './canvas/tokens/vtt-canvas-token-modal.js';
import {
    setupHpSettingsControls as setupHpSettingsControlsExt,
    syncHpSettingsInputs as syncHpSettingsInputsExt,
    setupSettingsAccordionBehavior as setupSettingsAccordionBehaviorExt,
    setupPlayerTokenSettingsControls as setupPlayerTokenSettingsControlsExt,
    syncPlayerTokenSettingsUI as syncPlayerTokenSettingsUIExt,
    updateTokenPreviewMockup as updateTokenPreviewMockupExt,
    setupGmTokenSettingsControls as setupGmTokenSettingsControlsExt,
    syncGmTokenSettingsUI as syncGmTokenSettingsUIExt,
    updateGmTokenPreviewMockup as updateGmTokenPreviewMockupExt
} from './canvas/tokens/vtt-canvas-token-preferences.js';

export function initVttCanvas(vtt) {
    const viewport = document.getElementById('vtt-canvas-viewport');
    const container = document.getElementById('canvas-container');

    const canvasFloorEffects = document.getElementById('vtt-canvas-floor-effects');
    const canvasGrid = document.getElementById('vtt-canvas-grid');
    const canvasPortals = document.getElementById('vtt-canvas-portals');
    const canvasFog = document.getElementById('vtt-canvas-fog');

    const canvasInteraction = document.getElementById('vtt-canvas-interaction');

    const ctxFloorEffects = canvasFloorEffects ? canvasFloorEffects.getContext('2d') : null;
    const ctxGrid = canvasGrid.getContext('2d');
    const ctxPortals = canvasPortals ? canvasPortals.getContext('2d') : null;
    const ctxFog = canvasFog.getContext('2d');
    const ctxInteraction = canvasInteraction.getContext('2d');

    // Bounded LRU image & texture cache
    const imageCache = vttImageCache;
    const mapAssetPrecache = {};

    // Interaction & drag state variables
    let activeDragMapToolItem = null;
    let activeDragNoteId = null;
    let activeDrawingTextCoord = null;
    let activeDrawingTextExisting = null;
    let activeResizeDrawing = null;
    let activeResizeMapToolHandle = null;
    let currentMapToolPolyPts = [];
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let drawingDragOffsetX = 0;
    let drawingDragOffsetY = 0;
    let drawingDragOriginalPoints = null;
    let mapToolDragStart = null;
    let mapToolDrawStart = null;
    let mapToolDrawCurrent = null;
    let mapToolDrawingState = null;
    let paintEraserSize = 20;
    let paintOpacity = 1.0;
    let tokenDragOriginalPos = null;
    let wallDragOffset = null;

    // Tab-visibility lifecycle manager
    const lifecycle = initCanvasLifecycle({
        onPause: () => {
            isLightingAnimationRunning = false;
            if (vtt.weatherEngine && typeof vtt.weatherEngine.pause === 'function') {
                vtt.weatherEngine.pause();
            }
            if (typeof document !== 'undefined') {
                document
                    .querySelectorAll?.(
                        '#vtt-html-overlays video, #vtt-map-html-overlays video, #vtt-map-bg-container video'
                    )
                    ?.forEach((v) => {
                        try {
                            v.pause();
                        } catch (e) { }
                    });
            }
            if (typeof ytPingPongControllers !== 'undefined' && ytPingPongControllers) {
                Object.values(ytPingPongControllers).forEach((c) => {
                    try {
                        c?.pause?.();
                    } catch (e) { }
                });
            }
        },
        onResume: () => {
            if (vtt.weatherEngine && typeof vtt.weatherEngine.resume === 'function') {
                vtt.weatherEngine.resume();
            }
            checkLightingAnimationLoop();
        },
        renderAll: () => renderAll()
    });

    // Render coalescing scheduler (initialized early to avoid TDZ ReferenceError on early calls)
    let renderScheduler = null;
    try {
        renderScheduler = createRenderScheduler(() => performRenderAll());
    } catch (e) {
        console.warn('[VTT] Render scheduler fallback:', e);
    }
    function requestRender() {
        if (renderScheduler) renderScheduler.requestRender();
        else performRenderAll();
    }
    function renderAll() {
        if (renderScheduler) renderScheduler.requestRender();
        else performRenderAll();
    }

    window.getSafeVttUrl = getSafeVttUrl;

    // Pan & Zoom viewport state
    let panX = 100;
    let panY = 100;
    let zoom = 1.0;
    let isPanning = false;
    let hasPanned = false;
    let startPanX = 0;
    let startPanY = 0;

    function isHexGrid(type) {
        return type === 'hex-v' || type === 'hex-v-even' || type === 'hex-h' || type === 'hex-h-even';
    }

    // Canvas Active Tool State
    let activeTool = 'select'; // select, grid, lighting, ping, measure
    let currentLightingType = 'wall';
    let currentWallShape = 'line'; // line, rect, circle, arc
    let isRotatingLight = false;
    let rotatingLightEntity = null; // { type: 'light'|'token', id }
    let pingHoldTimeout = null;

    // Scratch canvas for lighting rendering and feathered angular masks
    const scratchLightCanvas = document.createElement('canvas');
    const ctxScratchLight = scratchLightCanvas.getContext('2d');

    // Offscreen canvas for layer-level drawings and partial eraser masking (destination-out)
    const offDrawingCanvas = document.createElement('canvas');
    const offDrawingCtx = offDrawingCanvas.getContext('2d');

    // Active Layer State
    let activeLayer = 'token'; // token, gm, lighting, map

    // GM Lighting/Wall select, edit and delete state
    let selectedWallIdx = -1;
    let selectedLightId = null;
    let hoveredLightId = null;
    let activeDragLightId = null;
    let lightDragOffsetX = 0,
        lightDragOffsetY = 0;
    let hoveredWallIdx = -1;
    let hoveredWallVertex = null; // { wallIdx, endpoint }
    let activeDragWallVertex = null; // { wallIdx, endpoint }
    let activeDragWallSegmentIdx = -1;
    let wallDragOffsetX1 = 0,
        wallDragOffsetY1 = 0;
    let wallDragOffsetX2 = 0,
        wallDragOffsetY2 = 0;

    // Portal rotation & resize handle tracking
    let activeRotatePortalId = null;
    let hoveredRotatePortalId = null;
    let hoveredMapToolHandle = null; // { type: 'resize'|'rotate', item, handle, portal, pos }
    let lastBackquoteTime = 0;

    // Token-specific presence tracking for portals (Re-arm on Exit)
    const tokenInsidePortals = new Map(); // tokenId -> Set<portalId>
    function isTokenInsidePortal(tokId, portalId) {
        return tokenInsidePortals.has(tokId) && tokenInsidePortals.get(tokId).has(portalId);
    }
    function addTokenInsidePortal(tokId, portalId) {
        if (!tokenInsidePortals.has(tokId)) tokenInsidePortals.set(tokId, new Set());
        tokenInsidePortals.get(tokId).add(portalId);
    }
    function removeTokenInsidePortal(tokId, portalId) {
        if (tokenInsidePortals.has(tokId)) {
            tokenInsidePortals.get(tokId).delete(portalId);
            if (tokenInsidePortals.get(tokId).size === 0) tokenInsidePortals.delete(tokId);
        }
    }

    // Advanced Multi-Selection states
    let selectedTokenIds = new Set();
    let selectedTokenId = null;
    let selectedShapeIds = new Set();
    let selectedDrawingIds = new Set();
    let selectedWallIdxs = new Set();

    // Box select tracking
    let isBoxSelecting = false;
    let boxSelectStart = null; // { x, y }
    let boxSelectEnd = null; // { x, y }
    let boxSelectAdditive = false;

    // Clipboard for copy-paste operations
    let vttClipboard = null; // { type: 'token' | 'shape' | 'wall', items: [] }

    // Relative movement start offsets
    let relativeMovementOffsets = {}; // { id: { dx, dy } }
    let tokenDragOriginalPositions = {}; // { id: { x, y } }
    let shapeDragOriginalPositions = {}; // { id: { startPoint, endPoint, points } }
    let drawingDragOriginalPositions = {}; // { id: { x, y, startPoint, endPoint, points } }
    let tokenAnimations = {};
    let tokenAnimFrame = null;
    let cameraAnimFrame = null;
    let visualFxAnimFrame = null;
    let visualFxRequested = false;
    let initiativeHoverTokenId = null;
    let lastLightingTickTime = 0;
    let processedAnimKeys = new Set();

    let activeResizeTokenId = null;
    let activeResizeTokenHandle = null;
    let hoveredResizeTokenId = null;
    let hoveredResizeTokenHandle = null;
    let resizeDragStartMouse = null;
    let resizeDragStartDims = null;
    let activeRotateTokenId = null;
    let rotateStartMouseAngle = 0;
    let rotateInitialTokenRotation = 0;
    let hoveredRotateTokenId = null;
    let contextMenuTargetId = null;
    let dragTargetId = null;
    let currentMouseCoords = { x: 0, y: 0 };
    let pendingFocusTokenId = null;
    let pendingFocusTokenExpiry = 0;

    function clearAllSelections() {
        selectedTokenIds.clear();
        selectedTokenId = null;
        if (typeof selectedShapeIds !== 'undefined') selectedShapeIds.clear();
        if (typeof selectedWallIdxs !== 'undefined') selectedWallIdxs.clear();
        if (typeof selectedDrawingIds !== 'undefined') selectedDrawingIds.clear();
        selectedDrawingId = null;
        activeDragDrawingId = null;
        activeDrawingResizeHandle = null;
        selectedShapeId = null;
        selectedShapeComponent = null;
        selectedLightId = null;
        hoveredLightId = null;
        hoveredWallIdx = -1;
        hoveredWallVertex = null;
        selectedWallIdx = -1;
        selectedNoteId = null;
        hoveredNoteId = null;
        hoverTokenId = null;
        activeDragTokenId = null;
        activeResizeTokenId = null;
        activeResizeTokenHandle = null;
        activeRotateTokenId = null;
        activeDragShapeId = null;
        activeDragShapeComponent = null;
        activeDragLightId = null;
        activeDragWallVertex = null;
        activeDragWallSegmentIdx = -1;
        tokenTooltipPendingId = null;
        if (gmTokenTooltipTimeout) {
            clearTimeout(gmTokenTooltipTimeout);
            gmTokenTooltipTimeout = null;
        }
        hideGmTokenTooltip();
    }

    function getDistanceToSegment(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.hypot(dx, dy);
    }

    function getNoteAtCoord(x, y) {
        for (let note of notes) {
            let isInteractable = false;
            if (vtt.role === 'GM') {
                if (activeLayer === 'notes') isInteractable = true;
            } else {
                if (note.visibleToPlayers) isInteractable = true;
            }
            const hitThreshold = Math.max(16, 24 / Math.max(0.1, zoom || 1));
            if (isInteractable && Math.hypot(note.x - x, note.y - y) < hitThreshold) {
                return note.id;
            }
        }
        return null;
    }

    function getWallVertexAtCoord(x, y) {
        let minDistance = 12; // 12px threshold to grab endpoint vertex
        let found = null;

        walls.forEach((wall, idx) => {
            const dist1 = Math.hypot(x - wall.x1, y - wall.y1);
            if (dist1 < minDistance) {
                minDistance = dist1;
                found = { wallIdx: idx, endpoint: 1 };
            }

            const dist2 = Math.hypot(x - wall.x2, y - wall.y2);
            if (dist2 < minDistance) {
                minDistance = dist2;
                found = { wallIdx: idx, endpoint: 2 };
            }
        });

        return found;
    }

    function getLightAtCoord(x, y) {
        return getLightAtCoordExt(x, y, lights);
    }

    function getWallSegmentAtCoord(x, y) {
        let minDistance = 10; // 10px threshold for segment selection hover
        let foundIdx = -1;
        const candidates = wallSpatialIndex ? wallSpatialIndex.queryNearPoint(x, y, 15) : walls;
        candidates.forEach((wall) => {
            const idx = walls.indexOf(wall);
            if (idx === -1) return;
            const dist = getDistanceToSegment(x, y, wall.x1, wall.y1, wall.x2, wall.y2);
            if (dist < minDistance) {
                minDistance = dist;
                foundIdx = idx;
            }
        });
        return foundIdx;
    }

    function parseTokenDimension(value) {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? num : null;
    }

    function getTokenDrawDimensions(token) {
        // Determine draw width/height. For freeform assets prefer explicit pixel sizes,
        // otherwise fall back to grid-based sizing using token size units.
        let drawW, drawH;
        if (token.isAsset) {
            drawW =
                Number.isFinite(token.pixelWidth) && token.pixelWidth > 0
                    ? token.pixelWidth
                    : (parseTokenDimension(token.customWidth) ?? parseTokenDimension(token.size) ?? 1) *
                    grid.size *
                    grid.scale;
            drawH =
                Number.isFinite(token.pixelHeight) && token.pixelHeight > 0
                    ? token.pixelHeight
                    : (parseTokenDimension(token.customHeight) ?? parseTokenDimension(token.size) ?? 1) *
                    grid.size *
                    grid.scale;
        } else {
            const widthUnits = parseTokenDimension(token.customWidth) ?? parseTokenDimension(token.size) ?? 1;
            const heightUnits = parseTokenDimension(token.customHeight) ?? parseTokenDimension(token.size) ?? 1;
            drawW = widthUnits * grid.size * grid.scale;
            drawH = heightUnits * grid.size * grid.scale;
        }

        // Token radius is half the smallest dimension, ensuring circle fits within bounds
        const tokenRadius = Math.min(drawW, drawH) / 2;

        return { drawW, drawH, tokenRadius };
    }

    function getTokenRotationHandlePos(token) {
        if (!token) return null;
        const { drawW, drawH } = getTokenDrawDimensions(token);
        const renderPos = tokenAnimations[token.id]?.currentPos || { x: token.x, y: token.y };
        const cx = renderPos.x + drawW / 2;
        const cy = renderPos.y + drawH / 2;
        const rad = ((token.rotation || 0) * Math.PI) / 180;

        const stemOffset = -drawH / 2 - 22;
        const worldX = cx + (0 * Math.cos(rad) - stemOffset * Math.sin(rad));
        const worldY = cy + (0 * Math.sin(rad) + stemOffset * Math.cos(rad));

        const topCenterX = cx + (0 * Math.cos(rad) - (-drawH / 2) * Math.sin(rad));
        const topCenterY = cy + (0 * Math.sin(rad) + (-drawH / 2) * Math.cos(rad));

        return { x: worldX, y: worldY, cx, cy, rad, topCenterX, topCenterY };
    }

    function getTokenResizeHandles(token) {
        return getTokenResizeHandlesExt(token, getTokenDrawDimensions);
    }

    function getTokenResizeHandleAt(token, mouse, z = zoom) {
        return getTokenResizeHandleAtExt(token, mouse, z, getTokenDrawDimensions);
    }

    function getTokenResizeHandlePos(token) {
        const handles = getTokenResizeHandles(token);
        return handles ? handles.se : null;
    }

    // Line-of-sight vision polygons for players
    let visionPolygons = [];

    // Ray-casting point-in-polygon containment check
    function isPointInPolygon(point, vs) {
        const x = point.x,
            y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x,
                yi = vs[i].y;
            const xj = vs[j].x,
                yj = vs[j].y;

            const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Determine if a point is visible to active players
    function isPointVisible(x, y) {
        if (vtt.role === 'GM' && !gmTokenVisionMode) return true;

        const pt = { x, y };
        // 1. Check unlit darkvision / immediate token sight polygons
        for (let i = 0; i < visionPolygons.length; i++) {
            if (isPointInPolygon(pt, visionPolygons[i])) {
                return true;
            }
        }

        // 2. Check illuminated area within unobstructed player Line of Sight
        const losList = visionPolygons?.playerLosPolygons;
        const litList = visionPolygons?.litPolygons;
        if (losList && losList.length > 0 && litList && litList.length > 0) {
            let inLos = false;
            for (let i = 0; i < losList.length; i++) {
                if (isPointInPolygon(pt, losList[i])) {
                    inLos = true;
                    break;
                }
            }
            if (inLos) {
                for (let j = 0; j < litList.length; j++) {
                    if (isPointInPolygon(pt, litList[j])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function getTokenCenter(token) {
        if (!token) return { x: 0, y: 0 };
        const { drawW, drawH } = getTokenDrawDimensions(token);
        return {
            x: token.x + drawW / 2,
            y: token.y + drawH / 2
        };
    }

    function getTokenEffectiveLightFacing(token) {
        return getTokenEffectiveLightFacingExt(token);
    }

    function getLocalLightFacingFromWorldAngle(token, targetDeg) {
        return getLocalLightFacingFromWorldAngleExt(token, targetDeg);
    }

    function applyTokenLightingPreset(token, presetId) {
        return applyTokenLightingPresetExt(token, presetId);
    }

    function applyStandaloneLightingPreset(light, presetId) {
        return applyStandaloneLightingPresetExt(light, presetId);
    }

    function interpolateColors(c1, c2, factor) {
        return interpolateColorsExt(c1, c2, factor);
    }

    function getWallCoordinatesForRaycasting(wall, originX, originY) {
        return getWallCoordinatesForRaycastingExt(wall, originX, originY);
    }

    function getWallModalContext() {
        return {
            walls,
            currentMapId,
            vtt,
            onWallsUpdated: () => {
                if (vtt.socket) vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                requestRender();
            },
            onWallDeleted: () => {
                selectedWallIdx = -1;
                hoveredWallIdx = -1;
                selectedWallIdxs.clear();
                if (vtt.socket) vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                requestRender();
            }
        };
    }

    function closeAnyWallModal() {
        closeAnyWallModalExt();
    }

    function openWallSettingsModal(wallIdx, clientX, clientY) {
        openWallSettingsModalExt(wallIdx, clientX, clientY, getWallModalContext());
    }
    function getInteractiveObjectAtCoord(x, y) {
        let found = null;
        let minDistance = 20; // 20px active radius for door clicking

        walls.forEach((wall, idx) => {
            if (wall.type !== 'door' && wall.type !== 'window') return;

            // Object midpoint (rotated if open)
            const coords = getWallCoordinatesForRaycasting(wall) || {
                x1: wall.x1,
                y1: wall.y1,
                x2: wall.x2,
                y2: wall.y2
            };
            const midX = (coords.x1 + coords.x2) / 2;
            const midY = (coords.y1 + coords.y2) / 2;

            if (wall.type === 'door') {
                const dist = Math.hypot(x - midX, y - midY);
                if (dist < minDistance) {
                    minDistance = dist;
                    found = { idx, target: 'openToggle' };
                }
            } else if (wall.type === 'window') {
                // Open toggle (left node)
                const dist1 = Math.hypot(x - (midX - 12), y - midY);
                if (dist1 < minDistance) {
                    minDistance = dist1;
                    found = { idx, target: 'openToggle' };
                }

                // Vision toggle (right node)
                const dist2 = Math.hypot(x - (midX + 12), y - midY);
                if (dist2 < minDistance) {
                    minDistance = dist2;
                    found = { idx, target: 'visionToggle' };
                }
            }
        });

        return found;
    }

    // Ruler / Measurement State
    let isMeasuring = false;
    let measureStartPoint = null;
    let localMeasureStart = null;
    let localMeasureEnd = null;
    let localIsMeasuring = false;
    let localShapeStart = null;
    let localShapeEnd = null;
    let localIsShaping = false;
    let isTokenMeasuring = false;
    let measureEndPoint = null;
    let measureAnchorPoints = []; // Array of {x,y} for multi-segment polyline (line shape only)
    let otherMeasurements = {};

    let lastMeasureEmitTime = 0;
    function emitMeasureUpdateThrottled(payload) {
        if (!vtt.socket) return;
        const now = performance.now();
        if (now - lastMeasureEmitTime >= 40) {
            // ~25 updates/sec cap
            lastMeasureEmitTime = now;
            vtt.socket.emit('measure:update', payload);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Paint Tools & Persistent Drawings System
    // ═══════════════════════════════════════════════════════════════════════════
    let drawings = {};
    let selectedDrawingId = null;
    let hoveredDrawingId = null;

    // Paint Ribbon State
    let paintSubTool = 'pencil'; // pencil, brush, line, arrow, rect, circle, polygon, fill, text, eraser
    let paintStrokeColor = '#eab308';
    let paintFillColor = '#eab308';
    let paintFillMode = 'stroke'; // stroke, both, fill
    let paintStrokeWidth = 4;
    let paintGridSnap = false;

    // Drawing Interaction State
    let isDrawingPaint = false;
    let currentPaintStroke = null;
    let polygonPoints = [];
    let activeDrawingTextarea = null;
    let paintUndoStack = [];
    let paintRedoStack = [];

    // Transform & Dragging State in Tool 1 (Select)
    let activeDragDrawingId = null;
    let drawingDragStart = null;
    let drawingOriginalState = null;
    let activeDrawingResizeHandle = null; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
    let drawingResizeOppositePoint = null;
    let drawingResizeOriginalBBox = null;
    let erasedAnyDrawingInDrag = false;

    const drawingImageCache = new Map();

    function canvasToScreen(cx, cy) {
        const vr = viewport.getBoundingClientRect();
        return {
            x: vr.left + panX + cx * zoom,
            y: vr.top + panY + cy * zoom
        };
    }

    function isDrawingControlledByPlayer(drawing) {
        return isDrawingControlledByPlayerExt(drawing, vtt.role, vtt.username);
    }

    function emitDrawingsUpdate() {
        if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[currentMapId]) {
            vtt.campaignState.maps[currentMapId].drawings = drawings;
        }
        vtt.socket.emit('drawings:update', { mapId: currentMapId, drawings });
    }

    // Viewport Frustum Culling Helpers
    function getCameraViewportBounds(margin = 200) {
        const viewW = viewport ? viewport.clientWidth || window.innerWidth : window.innerWidth;
        const viewH = viewport ? viewport.clientHeight || window.innerHeight : window.innerHeight;
        const currentZoom = Math.max(0.01, zoom || 1.0);
        const minX = -panX / currentZoom - margin;
        const minY = -panY / currentZoom - margin;
        const maxX = (viewW - panX) / currentZoom + margin;
        const maxY = (viewH - panY) / currentZoom + margin;
        return { minX, minY, maxX, maxY };
    }

    function isRectInViewport(x, y, w, h, margin = 200) {
        const b = getCameraViewportBounds(margin);
        return x + w >= b.minX && x <= b.maxX && y + h >= b.minY && y <= b.maxY;
    }

    function isSegmentInViewport(x1, y1, x2, y2, margin = 200) {
        const b = getCameraViewportBounds(margin);
        return (
            Math.max(x1, x2) >= b.minX &&
            Math.min(x1, x2) <= b.maxX &&
            Math.max(y1, y2) >= b.minY &&
            Math.min(y1, y2) <= b.maxY
        );
    }

    function getDrawingBoundingBox(d) {
        return getDrawingBoundingBoxExt(d, ctxInteraction);
    }
    function getDrawingResizeHandles(d) {
        return getDrawingResizeHandlesExt(d, ctxInteraction);
    }
    function getDrawingResizeHandleAtPoint(d, pt) {
        return getDrawingResizeHandleAtPointExt(d, pt, zoom, ctxInteraction);
    }
    function applyDrawingResize(d, origBbox, handle, mouse, origState) {
        return applyDrawingResizeExt(d, origBbox, handle, mouse, origState);
    }
    function getDrawingAtPoint(pt, matchLayer = true) {
        return getDrawingAtPointExt(pt, drawings, activeLayer, vtt.role, matchLayer, ctxInteraction);
    }
    function drawDrawingObject(ctx, d, isSelected = false) {
        drawDrawingObjectExt(ctx, d, isSelected, activeTool, zoom, drawingImageCache, renderAll, ctxInteraction);
    }
    function renderDrawingsPass(targetLayer) {
        renderDrawingsPassExt(
            targetLayer,
            ctxInteraction,
            drawings,
            activeLayer,
            vtt.role,
            selectedDrawingId,
            selectedDrawingIds,
            currentPaintStroke,
            offDrawingCanvas,
            offDrawingCtx,
            isRectInViewport,
            drawingImageCache,
            renderAll,
            zoom,
            activeTool
        );
    }
    function renderShapesPass(targetLayer) {
        const isGmViewing = vtt.role === 'GM';
        const layerShapes = Object.values(shapes)
            .filter((s) => (s.layer || 'token') === targetLayer)
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        layerShapes.forEach((s) => {
            const shapeLayer = s.layer || 'token';
            if (shapeLayer !== activeLayer && !isGmViewing) return;
            if (shapeLayer === 'gm' && vtt.role !== 'GM') return;

            const isControlled = isShapeControlledByPlayer(s);
            const isSelected = isControlled && (selectedShapeId === s.id || selectedShapeIds.has(s.id));

            ctxInteraction.save();
            if (vtt.role === 'GM' && activeLayer !== shapeLayer) {
                ctxInteraction.globalAlpha = 0.45;
            }
            if (isSelected) {
                ctxInteraction.shadowColor = 'var(--color-gold-light)';
                ctxInteraction.shadowBlur = 8;
            }

            drawMeasurementTemplate(
                ctxInteraction,
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
                grid
            );
            if (isControlled) {
                drawShapeComponentHandles(ctxInteraction, s, s.id, {
                    role: vtt.role,
                    username: vtt.username,
                    selectedShapeIds,
                    selectedShapeId,
                    hoveredShapeComponent,
                    selectedShapeComponent
                });
            }
            ctxInteraction.restore();

            if (activeTool === 'select' && isControlled) {
                const center = getShapeCenterPoint(s);
                ctxInteraction.save();
                ctxInteraction.fillStyle = isSelected ? 'var(--color-gold-base)' : 'rgba(255, 255, 255, 0.7)';
                ctxInteraction.strokeStyle = isSelected ? '#ffffff' : 'var(--color-gold-base)';
                ctxInteraction.lineWidth = isSelected ? 2.5 : 1.5;
                ctxInteraction.beginPath();
                ctxInteraction.arc(center.x, center.y, 6, 0, Math.PI * 2);
                ctxInteraction.fill();
                ctxInteraction.stroke();

                ctxInteraction.fillStyle = isSelected ? '#111111' : '#ffffff';
                ctxInteraction.beginPath();
                ctxInteraction.arc(center.x, center.y, 2, 0, Math.PI * 2);
                ctxInteraction.fill();
                ctxInteraction.restore();
            }
        });
    }
    function performCanvasFloodFill(startX, startY) {
        performCanvasFloodFillExt(startX, startY, {
            canvasInteraction,
            drawings,
            activeLayer,
            username: vtt.username,
            paintFillColor,
            paintOpacity,
            drawDrawingObject,
            onNewDrawing: (nd) => {
                drawings[nd.id] = nd;
                paintUndoStack.push({ action: 'add', drawing: { ...nd } });
                paintRedoStack = [];
                emitDrawingsUpdate();
                renderAll();
            }
        });
    }
    function hexToRgb(hex) {
        return hexToRgbExt(hex);
    }
    function openDrawingTextInput(x, y, existingDrawing = null) {
        openDrawingTextInputExt(x, y, existingDrawing, {
            activeDrawingTextarea,
            commitDrawingTextInput,
            cancelDrawingTextInput,
            canvasInteraction,
            canvasToScreen,
            paintStrokeColor,
            paintStrokeWidth,
            zoom,
            setActiveDrawingTextState: (st) => {
                activeDrawingTextarea = st.textarea;
                activeDrawingTextCoord = { x: st.x, y: st.y };
                activeDrawingTextExisting = st.existingDrawing;
            }
        });
    }
    function commitDrawingTextInput() {
        commitDrawingTextInputExt(
            {
                textarea: activeDrawingTextarea,
                x: activeDrawingTextCoord?.x,
                y: activeDrawingTextCoord?.y,
                existingDrawing: activeDrawingTextExisting
            },
            {
                paintUndoStack,
                paintStrokeColor,
                paintStrokeWidth,
                activeLayer,
                username: vtt.username,
                onUpdateDrawing: (d) => {
                    emitDrawingsUpdate();
                    renderAll();
                },
                onNewDrawing: (d) => {
                    drawings[d.id] = d;
                    paintUndoStack.push({ action: 'add', drawing: { ...d } });
                    paintRedoStack = [];
                    emitDrawingsUpdate();
                    renderAll();
                }
            }
        );
        activeDrawingTextarea = null;
        activeDrawingTextCoord = null;
        activeDrawingTextExisting = null;
    }
    function cancelDrawingTextInput() {
        if (activeDrawingTextarea) {
            cancelDrawingTextInputExt({ textarea: activeDrawingTextarea });
            activeDrawingTextarea = null;
            activeDrawingTextCoord = null;
            activeDrawingTextExisting = null;
        }
    }
    function eraseDrawingsAtPoint(pt) {
        eraseDrawingsAtPointExt(pt, drawings, {
            paintEraserSize,
            zoom,
            ctx: ctxInteraction,
            paintUndoStack,
            isDrawingControlledByPlayer,
            onDrawingsChanged: () => {
                emitDrawingsUpdate();
                renderAll();
            }
        });
    }
    function paintUndo() {
        paintUndoExt({
            paintUndoStack,
            paintRedoStack,
            drawings,
            onDrawingsChanged: () => {
                emitDrawingsUpdate();
                renderAll();
            }
        });
    }
    function paintRedo() {
        paintRedoExt({
            paintUndoStack,
            paintRedoStack,
            drawings,
            onDrawingsChanged: () => {
                emitDrawingsUpdate();
                renderAll();
            }
        });
    }
    function showDrawingContextMenu(drawingId, clientX, clientY) {
        showDrawingContextMenuExt(drawingId, clientX, clientY, {
            drawings,
            paintUndoStack,
            onDrawingsChanged: () => {
                emitDrawingsUpdate();
                renderAll();
            }
        });
    }
    function showPortalContextMenu(portalId, clientX, clientY) {
        showPortalContextMenuExt(portalId, clientX, clientY, {
            portals,
            role: vtt.role,
            tokens,
            currentMapId,
            campaignState: vtt.campaignState,
            socket: vtt.socket,
            renderPlacedPortalsList,
            renderAll,
            selectMapToolItem,
            deleteSelectedMapToolItem
        });
    }
    function setupPaintRibbonControls() {
        setupPaintRibbonControlsExt(
            {
                get paintSubTool() {
                    return paintSubTool;
                },
                set paintSubTool(v) {
                    paintSubTool = v;
                },
                get paintStrokeColor() {
                    return paintStrokeColor;
                },
                set paintStrokeColor(v) {
                    paintStrokeColor = v;
                },
                get paintFillColor() {
                    return paintFillColor;
                },
                set paintFillColor(v) {
                    paintFillColor = v;
                },
                get paintFillMode() {
                    return paintFillMode;
                },
                set paintFillMode(v) {
                    paintFillMode = v;
                },
                get paintStrokeWidth() {
                    return paintStrokeWidth;
                },
                set paintStrokeWidth(v) {
                    paintStrokeWidth = v;
                },
                get paintGridSnap() {
                    return paintGridSnap;
                },
                set paintGridSnap(v) {
                    paintGridSnap = v;
                }
            },
            {
                onSubToolChange: () => {
                    polygonPoints = [];
                },
                onUndo: () => paintUndo(),
                onRedo: () => paintRedo()
            }
        );
    }

    // Map Tools (Traps & Portals) State
    let traps = [];
    let portals = [];
    let selectedMapToolItem = null;
    let activeMapToolSubmode = 'traps'; // 'traps' | 'portals'
    let currentMapToolShape = 'rect'; // 'rect' | 'circle' | 'line' | 'polygon'
    let isDrawingMapTool = false;
    let mapToolStartPoint = null;
    let mapToolCurrentPoint = null;
    let mapToolPolygonPoints = [];
    let selectedMapToolId = null;
    let tokenPortalDebounce = new Map(); // tokenId -> { portalId, time }
    let mobileMapToolTapCount = 0;

    const mapToolState = {
        get selectedMapToolItem() {
            return selectedMapToolItem;
        },
        set selectedMapToolItem(v) {
            selectedMapToolItem = v;
        },
        get activeMapToolSubmode() {
            return activeMapToolSubmode;
        },
        set activeMapToolSubmode(v) {
            activeMapToolSubmode = v;
        },
        get currentMapToolShape() {
            return currentMapToolShape;
        },
        set currentMapToolShape(v) {
            currentMapToolShape = v;
        }
    };

    const triggerContext = {
        get vtt() {
            return vtt;
        },
        get currentMapId() {
            return currentMapId;
        },
        get traps() {
            return traps;
        },
        get portals() {
            return portals;
        },
        get tokens() {
            return tokens;
        },
        get selectedTokenIds() {
            return selectedTokenIds;
        },
        get tokenPortalDebounce() {
            return tokenPortalDebounce;
        },
        get tokenInsidePortals() {
            return tokenInsidePortals;
        },
        get tokenAnimations() {
            return tokenAnimations;
        },
        get lastBroadcastedTokens() {
            return lastBroadcastedTokens;
        },
        snapToGrid: (...args) => snapToGrid(...args),
        renderAll: () => renderAll(),
        renderPlacedTrapsList: () => renderPlacedTrapsList(),
        panTo: (...args) => panTo(...args),
        getTokenDrawDimensions: (t) => getTokenDrawDimensions(t),
        isTokenInsidePortal: (...args) => isTokenInsidePortal(...args),
        addTokenInsidePortal: (...args) => addTokenInsidePortal(...args),
        removeTokenInsidePortal: (...args) => removeTokenInsidePortal(...args),
        playPortalTeleportFX: (...args) => playPortalTeleportFX(...args),
        triggerTrapSpringFX: (...args) => triggerTrapSpringFX(...args),
        postTrapTriggerChatCard: (...args) => postTrapTriggerChatCard(...args),
        switchMapTo: (id) => switchMapTo(id),
        showGMInterMapPortalToast: (...args) => showGMInterMapPortalToast(...args),
        showPlayerInterMapPortalToast: (...args) => showPlayerInterMapPortalToast(...args),
        get grid() {
            return grid;
        },
        isHexGrid: (...args) => isHexGrid(...args),
        getNearestHexFeatures: (...args) => getNearestHexFeatures(...args)
    };

    const mapToolMouseContext = {
        get vtt() {
            return vtt;
        },
        mapToolState,
        get activeLayer() {
            return activeLayer;
        },
        switchActiveLayer: (...args) => switchActiveLayer(...args),
        getPortalHandleUnderMouse: (...args) => getPortalHandleUnderMouse(...args),
        selectMapToolItem: (...args) => selectMapToolItem(...args),
        renderAll: () => renderAll(),
        cloneMapToolGeom: (...args) => cloneMapToolGeom(...args),
        getMapToolResizeHandleAt: (...args) => getMapToolResizeHandleAt(...args),
        updateMapToolDrawingUI: (...args) => updateMapToolDrawingUI(...args),
        get portals() {
            return portals;
        },
        get traps() {
            return traps;
        },
        get currentMapId() {
            return currentMapId;
        },
        commitNewMapToolItem: (...args) => commitNewMapToolItem(...args),
        applyMapToolResize: (...args) => applyMapToolResize(...args),
        updateDraggedMapToolGeom: (...args) => updateDraggedMapToolGeom(...args),
        getPortalRotationHandlePos: (...args) => getPortalRotationHandlePos(...args)
    };

    const cloneMapToolGeom = (g) => cloneMapToolGeomExt(g);
    const updateDraggedMapToolGeom = (g, og, dx, dy) => updateDraggedMapToolGeomExt(g, og, dx, dy);
    const getMapToolResizeHandles = (item) => getMapToolResizeHandlesExt(item);
    const getMapToolResizeHandleAt = (item, m, tol = null) => getMapToolResizeHandleAtExt(item, m, tol, zoom);
    const getPortalHandleUnderMouse = (m, tol = null) =>
        getPortalHandleUnderMouseExt(m, tol, {
            isGM: vtt.role === 'GM',
            activeLayer,
            selectedMapToolItem,
            activeTool,
            zoom,
            portals
        });
    const applyMapToolResize = (item, og, h, m, e) => applyMapToolResizeExt(item, og, h, m, e, snapToGrid);
    const isPointInPoly = (pt, poly) => isPointInPolyExt(pt, poly);
    const distToSegmentSq = (p, v, w) => distToSegmentSqExt(p, v, w);
    const checkLineIntersection = (p1, p2, p3, p4) => checkLineIntersectionExt(p1, p2, p3, p4);
    const checkLineCircleIntersection = (p1, p2, c, r) => checkLineCircleIntersectionExt(p1, p2, c, r);
    const isPointInsideGeometry = (pt, s, g) => isPointInsideGeometryExt(pt, s, g);
    const findEarliestPathIntersection = (p1, p2, s, g) => findEarliestPathIntersectionExt(p1, p2, s, g);
    const isTokenCollidingWithPortal = (t, p, from = null, to = null) =>
        isTokenCollidingWithPortalExt(t, p, from, to, getTokenDrawDimensions);
    const calcPortalCenter = (p) => calcPortalCenterExt(p);
    const getPortalNormalVector = (p, av = null) => getPortalNormalVectorExt(p, av);
    const getPortalRotationHandlePos = (p) => getPortalRotationHandlePosExt(p);
    const checkOneWayPortalEntry = (p, f, t) => checkOneWayPortalEntryExt(p, f, t);
    const calcSpatialPortalDestination = (sp, tp, fc, tc, tm = null, tok = null) =>
        calcSpatialPortalDestinationExt(sp, tp, fc, tc, tm, tok, {
            grid: tm && tm.grid ? tm.grid : grid,
            getTokenDrawDimensions,
            isHexGrid,
            getNearestHexFeatures
        });
    const triggerTokenStepThroughAnimation = (id, sx, sy, ex, ey, dur = 260) =>
        triggerTokenStepThroughAnimationExt(id, sx, sy, ex, ey, dur, tokenAnimations, renderAll);
    const precacheConnectedMapAssets = () =>
        precacheConnectedMapAssetsExt(portals, vtt.campaignState, currentMapId, mapAssetPrecache, getSafeVttUrl);
    const checkTokenMoveTriggers = (tok, orig) => checkTokenMoveTriggersExt(tok, orig, triggerContext);
    const postTrapTriggerChatCard = (d) => postTrapTriggerChatCardExt(d);
    const rollTrapSave = (id, tokId, ab, dc) => rollTrapSaveExt(id, tokId, ab, dc, { tokens, vtt });
    const triggerTrapSpringFX = (d) => triggerTrapSpringFXExt(d);
    const playPortalTeleportFX = (coords) => playPortalTeleportFXExt(coords, renderAll);
    const showGMInterMapPortalToast = (d) => showGMInterMapPortalToastExt(d, vtt, switchMapTo);
    const showPlayerInterMapPortalToast = (m) => showPlayerInterMapPortalToastExt(m);
    function switchMapTo(targetMapId, tokenId = null) {
        if (!targetMapId) return;
        if (tokenId) {
            pendingFocusTokenId = tokenId;
            pendingFocusTokenExpiry = Date.now() + 30000;
        }
        if (vtt.role === 'GM') {
            loadMap(targetMapId, false);
            if (vtt.socket) {
                vtt.socket.emit('map:switch-gm', { mapId: targetMapId });
                vtt.socket.emit('campaign:update', { activeGMMapId: targetMapId });
            }
        } else {
            loadMap(targetMapId, false);
            if (vtt.socket) vtt.socket.emit('map:switch-player', { mapId: targetMapId, username: vtt.username });
        }
        if (vtt.socket) {
            vtt.socket.emit('map:request_sync', { mapId: targetMapId });
        }
    }
    const getMapToolItemAtCoord = (x, y) =>
        getMapToolItemAtCoordExt(x, y, {
            traps,
            portals,
            isGM: vtt.role === 'GM',
            activeLayer,
            selectedMapToolItem,
            activeTool,
            zoom
        });
    const selectMapToolItem = (type, id) =>
        selectMapToolItemExt(type, id, mapToolState, {
            traps,
            portals,
            currentMapId,
            campaignState: vtt.campaignState,
            socket: vtt.socket,
            onRenderLists: () => {
                renderPlacedTrapsList();
                renderPlacedPortalsList();
            },
            renderAll
        });
    const deselectMapToolItem = () =>
        deselectMapToolItemExt(mapToolState, {
            onRenderLists: () => {
                renderPlacedTrapsList();
                renderPlacedPortalsList();
            },
            renderAll
        });
    const saveSelectedMapToolItem = (type) =>
        saveSelectedMapToolItemExt(type, mapToolState, {
            traps,
            portals,
            currentMapId,
            campaignState: vtt.campaignState,
            socket: vtt.socket,
            onRenderLists: () => {
                renderPlacedTrapsList();
                renderPlacedPortalsList();
            },
            renderAll
        });
    const cleanupPortalReferences = (delId) =>
        cleanupPortalReferencesExt(delId, portals, currentMapId, vtt.campaignState, vtt.socket);
    const deleteSelectedMapToolItem = (type) =>
        deleteSelectedMapToolItemExt(type, mapToolState, {
            traps,
            portals,
            currentMapId,
            campaignState: vtt.campaignState,
            socket: vtt.socket,
            onRenderLists: () => {
                renderPlacedTrapsList();
                renderPlacedPortalsList();
            },
            renderAll
        });
    const handleMapToolMouseDown = (m, e) => handleMapToolMouseDownExt(m, e, mapToolMouseContext);
    const handleMapToolMouseMove = (m, e) => handleMapToolMouseMoveExt(m, e, mapToolMouseContext);
    const handleMapToolMouseUp = (m, e) => handleMapToolMouseUpExt(m, e, mapToolMouseContext);
    const finalizeMapToolPolygon = () => {
        if (!isDrawingMapTool || currentMapToolShape !== 'polygon' || currentMapToolPolyPts.length < 3) return;
        commitNewMapToolItem(null, null, currentMapToolPolyPts);
        cancelMapToolDrawing();
    };
    const cancelMapToolDrawing = () => {
        isDrawingMapTool = false;
        mapToolDrawStart = null;
        mapToolDrawCurrent = null;
        currentMapToolPolyPts = [];
        updateMapToolDrawingUI(false, activeMapToolSubmode);
        renderAll();
    };
    const updateMapToolDrawingUI = (d, s) => updateMapToolDrawingUIExt(d, s);
    const commitNewMapToolItem = (s, e, p) =>
        commitNewMapToolItemExt(s, e, p, mapToolState, {
            traps,
            portals,
            currentMapId,
            campaignState: vtt.campaignState,
            socket: vtt.socket,
            onRenderLists: () => {
                renderPlacedTrapsList();
                renderPlacedPortalsList();
            },
            renderAll
        });
    const renderTraps = (ctx) => renderTrapsExt(ctx, traps, vtt.role === 'GM', zoom);
    const resolveTokenImageSrc = (t) => resolveTokenImageSrcExt(t, vtt.campaignState);
    const getOrLoadTokenImage = (t) =>
        getOrLoadTokenImageExt(t, {
            campaignState: vtt.campaignState,
            imageCache: vttImageCache,
            onImageLoaded: renderAll,
            isImageLoaded: (url) => vttImageCache.has(url) && !!vttImageCache.get(url)?.complete
        });
    const resolveRulerPortalBending = (pts) => resolveRulerPortalBendingExt(pts, portals, currentMapId);
    const getGridDistanceSettings = (g = grid) => getGridDistanceSettingsExt(g);
    const calcDistanceFormatted = (pixels, g = grid) => calcDistanceFormattedExt(pixels, g);
    const calcDistanceFt = (pixels, g = grid) => calcDistanceFtExt(pixels, g);
    const drawMeasurementTemplate = (...args) => drawMeasurementTemplateExt(...args);
    const drawTargetRoomContent = (ctx, tm, tmid, tw, th, tt, twalls, cA, cB, opts = {}) =>
        drawTargetRoomContentExt(ctx, tm, tmid, tw, th, tt, twalls, cA, cB, {
            grid,
            tokens,
            walls,
            getOrLoadTokenImage: (t) => getOrLoadTokenImage(t),
            getTokenDrawDimensions: (t) => getTokenDrawDimensions(t),
            get currentMapId() {
                return currentMapId;
            },
            get portals() {
                return portals;
            },
            get zoom() {
                return zoom;
            },
            vtt,
            imageCache: vttImageCache,
            renderAll,
            getSafeVttUrl,
            ...opts
        });
    const renderProjectedPortals = (ctx) =>
        renderProjectedPortalsExt(ctx, portals, {
            vtt,
            isGM: vtt.role === 'GM',
            get currentMapId() {
                return currentMapId;
            },
            get currentMap() {
                return vtt.campaignState?.maps?.[currentMapId];
            },
            get isDaylightMode() {
                return Boolean(vtt.campaignState?.maps?.[currentMapId]?.lightingSettings?.daylightMode);
            },
            gmTokenVisionMode,
            isTokenControlledByPlayer: (t, ignore) => isTokenControlledByPlayer(t, ignore),
            defaultSightRadius: 60,
            campaignState: vtt.campaignState,
            get zoom() {
                return zoom;
            },
            get grid() {
                return grid;
            },
            get tokens() {
                return tokens;
            },
            get walls() {
                return walls;
            },
            selectedTokenIds,
            getTokenCenter,
            getTokenDrawDimensions: (t) => getTokenDrawDimensions(t),
            getWallCoordinatesForRaycasting,
            drawTargetRoomContentFn: drawTargetRoomContent,
            drawTargetRoomContent,
            getOrLoadTokenImage: (t) => getOrLoadTokenImage(t),
            imageCache: vttImageCache,
            renderAll,
            getSafeVttUrl
        });
    const renderPortals = (ctx) => renderPortalsExt(ctx, portals, currentMapId, vtt.role === 'GM', zoom);
    const renderSelectedMapToolHighlight = (ctx) =>
        renderSelectedMapToolHighlightExt(ctx, selectedMapToolItem, traps, portals, vtt.role === 'GM', zoom, {
            hoveredMapToolHandle
        });
    const renderMapToolDrawingPreview = (ctx) => renderMapToolDrawingPreviewExt(ctx, mapToolDrawingState, zoom);
    const renderPlacedTrapsList = () =>
        renderPlacedTrapsListExt(traps, selectedMapToolItem, {
            currentMapId,
            campaignState: vtt.campaignState,
            onSelect: selectMapToolItem,
            onPanTo: panTo,
            onUpdate: renderPlacedTrapsList,
            onDeselect: deselectMapToolItem,
            renderAll,
            zoom,
            vtt
        });
    const renderPlacedPortalsList = () =>
        renderPlacedPortalsListExt(portals, selectedMapToolItem, {
            currentMapId,
            campaignState: vtt.campaignState,
            onSelect: selectMapToolItem,
            onPanTo: panTo,
            onUpdate: renderPlacedPortalsList,
            onDeselect: deselectMapToolItem,
            renderAll,
            zoom,
            vtt
        });
    const populateTargetPortalsDropdown = (exId = null, targetMapId = null) =>
        populateTargetPortalsDropdownExt(portals, currentMapId, vtt.campaignState, exId, targetMapId);
    const setupMapToolsControls = () =>
        setupMapToolsControlsExt(mapToolState, {
            switchActiveLayer,
            updateLayerButtonIcon,
            cancelDrawing: cancelMapToolDrawing,
            saveItem: saveSelectedMapToolItem,
            deleteItem: deleteSelectedMapToolItem,
            deselectItem: deselectMapToolItem,
            renderAll,
            portals,
            currentMapId,
            campaignState: vtt.campaignState,
            socket: vtt.socket
        });

    // Persistent Shapes/Effects State
    let shapes = {};
    let selectedShapeId = null;
    let selectedShapeComponent = null;
    let hoveredShapeComponent = null;
    let activeDragShapeId = null;
    let activeDragShapeComponent = null;
    let shapeComponentDragStart = null;
    let shapeDragOffsetX = 0;
    let shapeDragOffsetY = 0;
    let shapeComponentDragOriginalPoints = null;
    let shapeDragOffsetX1 = 0,
        shapeDragOffsetY1 = 0;
    let shapeDragOffsetX2 = 0,
        shapeDragOffsetY2 = 0;

    function isShapeControlledByPlayer(shape) {
        return isShapeControlledByPlayerExt(shape, vtt.role, vtt.username);
    }
    function getShapeCenterPoint(shapeObj) {
        return getShapeCenterPointExt(shapeObj);
    }
    function getShapePolyPoints(shapeObj) {
        return getShapePolyPointsExt(shapeObj);
    }
    function getShapeBoundingBox(s) {
        return getShapeBoundingBoxExt(s);
    }
    function isPointInsideShape(pt, s) {
        return isPointInsideShapeExt(pt, s, { grid, getDistanceToSegment });
    }
    function isTokenIntersectingShape(token, s) {
        return isTokenIntersectingShapeExt(token, s, { getTokenDrawDimensions, grid, getDistanceToSegment });
    }
    function getPersistentShapeAtPoint(pt, matchLayer = true) {
        return getPersistentShapeAtPointExt(pt, shapes, {
            grid,
            getDistanceToSegment,
            role: vtt.role,
            username: vtt.username,
            activeLayer,
            matchLayer
        });
    }
    function showShapeContextMenu(shape, clientX, clientY) {
        showShapeContextMenuExt(shape, clientX, clientY, {
            role: vtt.role,
            shapes,
            onSelectCreatures: (s, filterType = 'all') => {
                const targetIds = [];
                Object.entries(tokens).forEach(([id, tok]) => {
                    if (!isTokenIntersectingShape(tok, s)) return;

                    const isPlayerTok = Boolean(
                        tok.isPlayer || (tok.characterId && vtt.campaignState?.characters?.[tok.characterId]?.isPlayer)
                    );

                    if (filterType === 'pc' && !isPlayerTok) return;
                    if (filterType === 'npc' && isPlayerTok) return;

                    targetIds.push(id);
                });
                selectedTokenIds.clear();
                if (targetIds.length > 0) {
                    targetIds.forEach((id) => selectedTokenIds.add(id));
                    selectedTokenId = targetIds[0];
                    const label =
                        filterType === 'pc'
                            ? 'player character(s)'
                            : filterType === 'npc'
                                ? 'monster/NPC(s)'
                                : 'creature(s)';
                    if (vtt.chatEngine?.appendSystemMessage) {
                        vtt.chatEngine.appendSystemMessage(
                            `Selected ${targetIds.length} ${label} within ${s.shape || 'shape'}.`
                        );
                    }
                } else {
                    selectedTokenId = null;
                    if (vtt.chatEngine?.appendSystemMessage) {
                        vtt.chatEngine.appendSystemMessage(`No creatures found within ${s.shape || 'shape'}.`);
                    }
                }
                renderAll();
            },
            onMoveToLayer: (shapeId, targetLayer) => {
                const s = shapes[shapeId];
                if (!s) return;
                s.layer = targetLayer;
                if (vtt.socket) {
                    vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                }
                const layerNames = { token: 'Token Layer', gm: 'GM Layer', map: 'Map Layer' };
                if (vtt.chatEngine?.appendSystemMessage) {
                    vtt.chatEngine.appendSystemMessage(`Moved shape to ${layerNames[targetLayer] || targetLayer}.`);
                }
                renderAll();
            },
            onZOrderChange: (shapeId, action) => {
                changeShapeZOrderExt(shapeId, action, { shapes });
                if (vtt.socket) {
                    vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                }
                renderAll();
            },
            onDeleteShape: (shapeId) => {
                if (!shapes[shapeId]) return;
                delete shapes[shapeId];
                if (selectedShapeId === shapeId) selectedShapeId = null;
                selectedShapeIds.delete(shapeId);
                if (vtt.socket) {
                    vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                }
                if (vtt.chatEngine?.appendSystemMessage) {
                    vtt.chatEngine.appendSystemMessage('Deleted persistent shape.');
                }
                renderAll();
            }
        });
    }
    function getShapeComponentAtCoord(x, y, requireControl = true) {
        return getShapeComponentAtCoordExt(x, y, shapes, {
            requireControl,
            role: vtt.role,
            username: vtt.username,
            getDistanceToSegment
        });
    }
    function drawShapeComponentHandles(ctx, shapeObj, shapeId) {
        drawShapeComponentHandlesExt(ctx, shapeObj, shapeId, {
            role: vtt.role,
            username: vtt.username,
            selectedShapeIds,
            selectedShapeId,
            hoveredShapeComponent,
            selectedShapeComponent
        });
    }

    function setupMeasurePanelControls() {
        const shapeSelect = document.getElementById('measure-shape');
        const squareOptions = document.getElementById('measure-square-options');
        const beamOptions = document.getElementById('measure-beam-options');

        if (shapeSelect) {
            shapeSelect.addEventListener('change', () => {
                const shape = shapeSelect.value;
                if (shape === 'square') {
                    squareOptions.classList.remove('vtt-hidden');
                    beamOptions.classList.add('vtt-hidden');
                } else if (shape === 'beam') {
                    squareOptions.classList.add('vtt-hidden');
                    beamOptions.classList.remove('vtt-hidden');
                } else {
                    squareOptions.classList.add('vtt-hidden');
                    beamOptions.classList.add('vtt-hidden');
                }
                renderAll();
            });
        }

        const anchorSelect = document.getElementById('measure-square-anchor');
        if (anchorSelect) anchorSelect.addEventListener('change', () => renderAll());

        const beamWidthInput = document.getElementById('measure-beam-width');
        if (beamWidthInput) beamWidthInput.addEventListener('input', () => renderAll());

        const colorSelect = document.getElementById('measure-color');
        if (colorSelect) colorSelect.addEventListener('change', () => renderAll());
    }

    // Ping Animation State
    let activePings = [];
    let pingAnimFrame = null;
    let pingForceSelectTimeout = null;

    // Grid alignment settings
    let grid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
    let isGridDirty = true;
    function markGridDirty() {
        isGridDirty = true;
    }

    // Wall and Door Segment states
    let walls = [];
    let wallsVersion = 1;
    let wallSpatialIndex = new WallSpatialIndex();
    function syncWallSpatialIndex(w, h) {
        wallsVersion++;
        if (tokens) {
            for (const id in tokens) {
                if (tokens[id]) {
                    delete tokens[id]._polyCache;
                    delete tokens[id]._losPolyCache;
                }
            }
        }
        if (wallSpatialIndex) {
            const currentMap = vtt.campaignState?.maps?.[currentMapId];
            const gSize = grid?.size || 50;
            const gScale = grid?.scale || 1.0;
            const width = w ?? (currentMap?.gridWidth ? currentMap.gridWidth * gSize * gScale : 10000);
            const height = h ?? (currentMap?.gridHeight ? currentMap.gridHeight * gSize * gScale : 10000);
            wallSpatialIndex.rebuild(walls, width, height);
        }
    }
    let lights = [];
    let isLightingAnimationRunning = false;
    let notes = [];
    let isDrawingWall = false;
    let wallStartPoint = null;
    let lastMouseEvent = null;

    // Tokens state
    let tokens = {};
    let lastBroadcastedTokens = {};
    let localActiveInitiativeTokenId = null;
    let activeTokenStartTime = 0;
    let activeDragTokenId = null;
    let tokenDragOffsetX = 0;
    let tokenDragOffsetY = 0;
    let hoverTokenId = null;
    let hoverTokenTimeout = null;
    let tokenDragInitialPoint = null;

    // Token Hover Stat Tooltip state
    let gmTokenTooltipTimeout = null;
    let gmTokenTooltipTokenId = null; // ID of token tooltip is currently anchored to
    let tokenTooltipPendingId = null; // ID of token currently scheduled for tooltip show
    let tokenDragMeasureActive = false;

    // Notes state
    let hoveredNoteId = null;
    let selectedNoteId = null;
    let gmTokenVisionMode = false;
    let draggingNoteId = null;
    let noteDragOffsetX = 0;
    let noteDragOffsetY = 0;
    let noteDragStartMouse = null; // tracks mouse position when note drag began (to distinguish click vs drag)
    let isLayerShortcutModifierDown = false;

    // Sight range configuration
    let defaultSightRadius = 60; // 60 feet (12 grid squares)

    // Global campaign visibility settings for HP bars
    let campaignSettings = {
        playerMonsterHpBarVisible: 'hover',
        playerMonsterHpNumVisible: false,
        playerMonsterNameVisible: 'always',
        playerPlayerHpBarVisible: 'always',
        playerPlayerHpNumVisible: true,
        playerPlayerNameVisible: 'always',
        playerTempHpBarVisible: 'always',
        playerTempHpNumVisible: true,
        playerStatTooltipVisible: 'never',
        gmMonsterHpBarVisible: 'always',
        gmMonsterHpNumVisible: true,
        gmMonsterNameVisible: 'always',
        gmPlayerHpBarVisible: 'always',
        gmPlayerHpNumVisible: true,
        gmPlayerNameVisible: 'always',
        gmTempHpBarVisible: 'always',
        gmTempHpNumVisible: true,
        gmStatTooltipVisible: 'always',
        tempHpBarStyle: 'stacked',
        initDexTiebreaker: true
    };

    // ── Player Token Display Preferences & GM Ceilings ─────────────────────────────
    const TOKEN_PREFS_STORAGE_KEY = 'vtt_token_display_preferences';
    const GM_TOKEN_PREFS_STORAGE_KEY = 'vtt_gm_token_display_preferences';

    let playerTokenPrefs = loadPlayerTokenPrefs(TOKEN_PREFS_STORAGE_KEY);
    let gmTokenPrefs = loadGmTokenPrefs(GM_TOKEN_PREFS_STORAGE_KEY);

    const tokenPrefsState = {
        playerTokenPrefs,
        gmTokenPrefs
    };

    function getEffectiveVisibility(playerPref, gmSetting) {
        return getEffectiveVisibilityExt(playerPref, gmSetting);
    }

    function getEffectiveNumberVisible(playerPref, gmSetting) {
        return getEffectiveNumberVisibleExt(playerPref, gmSetting);
    }

    let currentMapId = null;

    function showMapLoadingIndicator(mapName) {
        if (typeof document === 'undefined') return;
        let indicator = document.getElementById('vtt-map-loading-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'vtt-map-loading-indicator';
            indicator.style.cssText =
                'position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(8px); border: 1px solid var(--color-gold-base, #d4af37); border-radius: 20px; padding: 6px 18px; color: #fff; font-size: 0.82rem; font-weight: 500; display: flex; align-items: center; gap: 8px; z-index: 9999; box-shadow: 0 4px 16px rgba(0,0,0,0.4); pointer-events: none; transition: opacity 0.25s ease; opacity: 1;';
            document.body.appendChild(indicator);
        }
        indicator.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-gradient-gold"></i> <span>Loading <strong>${mapName || 'Map'}</strong>...</span>`;
        indicator.style.display = 'flex';
        indicator.style.opacity = '1';

        if (indicator._timeout) clearTimeout(indicator._timeout);
        indicator._timeout = setTimeout(() => hideMapLoadingIndicator(), 2500);
    }

    function hideMapLoadingIndicator() {
        if (typeof document === 'undefined') return;
        const indicator = document.getElementById('vtt-map-loading-indicator');
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator && indicator.style.opacity === '0') {
                    indicator.style.display = 'none';
                }
            }, 250);
        }
    }

    function loadMap(mapId, preserveCamera = false) {
        if (!vtt.campaignState || !vtt.campaignState.maps || !vtt.campaignState.maps[mapId]) return;

        currentMapId = mapId;
        const mapData = vtt.campaignState.maps[mapId];
        showMapLoadingIndicator(mapData.name || 'Map');

        // Reset transient interaction state so maps stay isolated.
        selectedTokenIds.clear();
        selectedTokenId = null;
        selectedShapeIds.clear();
        selectedWallIdxs.clear();
        otherMeasurements = {};
        activeDragTokenId = null;
        hoverTokenId = null;
        hoverTokenTimeout = null;
        tokenDragInitialPoint = null;
        tokenDragMeasureActive = false;
        // Clear GM tooltip on map switch
        if (typeof hideGmTokenTooltip === 'function') hideGmTokenTooltip();
        isDrawingWall = false;
        wallStartPoint = null;
        selectedWallIdx = -1;
        selectedLightId = null;
        activeDragLightId = null;
        hoveredWallIdx = -1;
        hoveredWallVertex = null;
        activeDragWallVertex = null;
        activeDragWallSegmentIdx = -1;
        // Deep teardown of previous map transient states, media decoders, running animations, and LRU cache sweep
        teardownMapTransientState({
            vtt,
            newMapId: mapId,
            imageCache: vttImageCache,
            cancelActiveAnimations: () => {
                if (cameraAnimFrame) {
                    cancelAnimationFrame(cameraAnimFrame);
                    cameraAnimFrame = null;
                }
                if (visualFxAnimFrame) {
                    cancelAnimationFrame(visualFxAnimFrame);
                    visualFxAnimFrame = null;
                }
                if (tokenAnimFrame) {
                    cancelAnimationFrame(tokenAnimFrame);
                    tokenAnimFrame = null;
                }
            }
        });
        if (typeof cleanupAllYouTubePingPong === 'function') cleanupAllYouTubePingPong();

        // 1. Ensure Freeform Asset on the map layer exists from mapImage or artwork token
        if (mapData.mapImage && mapData.mapImage.trim() !== '') {
            const imgUrl = mapData.mapImage.trim();
            if (!mapData.tokens) mapData.tokens = {};
            const cleanUrl = (u) =>
                (u || '')
                    .trim()
                    .replace(/^[/\\]+/, '')
                    .split('?')[0]
                    .toLowerCase();
            const normImgUrl = cleanUrl(imgUrl);
            const existingAsset = Object.values(mapData.tokens).find(
                (t) => t.layer === 'map' && (t.isBackground || t.isAsset || cleanUrl(t.img) === normImgUrl)
            );
            if (!existingAsset) {
                const isVideo = !!imgUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || imgUrl.includes('pinimg.com/videos');
                const isYoutube = imgUrl.includes('youtube.com') || imgUrl.includes('youtu.be');
                const gSize = mapData.grid?.size || 50;
                const gScale = mapData.grid?.scale || 1.0;
                const gWidth = mapData.gridWidth ? Math.ceil(mapData.gridWidth) : 40;
                const gHeight = mapData.gridHeight ? Math.ceil(mapData.gridHeight) : 30;
                const pixelWidth = mapData.gridWidth ? mapData.gridWidth * gSize * gScale : 2000;
                const pixelHeight = mapData.gridHeight ? mapData.gridHeight * gSize * gScale : 1500;

                const assetId = `asset_${mapData.id}_bg`;
                mapData.tokens[assetId] = {
                    id: assetId,
                    name: `${mapData.name || 'Map'} (Artwork)`,
                    x: 0,
                    y: 0,
                    layer: 'map',
                    isAsset: true,
                    isBackground: true,
                    locked: true,
                    img: imgUrl,
                    isVideo: isVideo || isYoutube,
                    pixelWidth: pixelWidth,
                    pixelHeight: pixelHeight,
                    size: 1,
                    zIndex: 0,
                    isPlayer: false
                };
                if (!mapData.gridWidth) mapData.gridWidth = gWidth;
                if (!mapData.gridHeight) mapData.gridHeight = gHeight;
            } else if (!existingAsset.img) {
                existingAsset.img = imgUrl;
            }
            if (!mapData.thumbnail) mapData.thumbnail = imgUrl;
            // Retain mapData.mapImage as the permanent anchor!
        } else if (
            mapData.thumbnail &&
            (!mapData.tokens || !Object.values(mapData.tokens).some((t) => t.layer === 'map'))
        ) {
            // Auto-heal from thumbnail if mapImage and map tokens were missing
            mapData.mapImage = mapData.thumbnail;
            if (!mapData.tokens) mapData.tokens = {};
            const assetId = `asset_${mapData.id}_bg`;
            const gSize = mapData.grid?.size || 50;
            const gScale = mapData.grid?.scale || 1.0;
            mapData.tokens[assetId] = {
                id: assetId,
                name: `${mapData.name || 'Map'} (Artwork)`,
                x: 0,
                y: 0,
                layer: 'map',
                isAsset: true,
                isBackground: true,
                locked: true,
                img: mapData.thumbnail,
                pixelWidth: mapData.gridWidth ? mapData.gridWidth * gSize * gScale : 2000,
                pixelHeight: mapData.gridHeight ? mapData.gridHeight * gSize * gScale : 1500,
                size: 1,
                zIndex: 0,
                isPlayer: false
            };
        }

        // Clear legacy background container
        const container = document.getElementById('vtt-map-bg-container');
        if (container) {
            container.innerHTML = '';
            container.classList.add('vtt-hidden');
        }
        const underGridOverlay = document.getElementById('vtt-map-html-overlays');
        if (underGridOverlay) underGridOverlay.innerHTML = '';

        // 2. Load grid config
        grid = mapData.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
        syncGridConfigInputs();

        // 3. Load tokens, walls, shapes
        tokens = mapData.tokens || {};
        for (const id in tokens) {
            if (tokens[id]?._animReq) delete tokens[id]._animReq;
        }
        // Critical: Synchronize snapshot with current map's tokens so emitTokenUpdates doesn't diff against prior map
        lastBroadcastedTokens = JSON.parse(JSON.stringify(tokens));

        tokenAnimations = {};
        processedAnimKeys.clear();
        walls = mapData.walls || [];
        lights = mapData.lights || [];
        notes = mapData.notes || [];
        shapes = mapData.shapes || {};
        drawings = mapData.drawings || {};
        traps = Array.isArray(mapData.traps) ? mapData.traps : [];
        portals = Array.isArray(mapData.portals) ? mapData.portals : [];
        try {
            deselectMapToolItem();
            renderPlacedTrapsList();
            renderPlacedPortalsList();
            populateTargetPortalsDropdown();
            precacheConnectedMapAssets(portals);
        } catch (e) {
            console.warn('[VTT Canvas] Notice in map auxiliary tools setup:', e);
        }

        // Backward compatibility for old wall schema
        walls.forEach((w) => {
            if (w.type === undefined) {
                w.type = w.isDoor ? 'door' : 'wall';
            }
        });
        syncWallSpatialIndex();

        // 4. Update the preview indicator banner (GM Only)
        updatePreviewBanner();

        // 5. Update viewport camera and redraw everything
        const mapW = (mapData.gridWidth || 40) * (grid.size || 50) * (grid.scale || 1.0);
        const mapH = (mapData.gridHeight || 30) * (grid.size || 50) * (grid.scale || 1.0);
        const w = viewport.clientWidth || 1000;
        const h = viewport.clientHeight || 800;

        const transit = window._portalTransitInfo;
        const isPortalArrival = transit && transit.targetMapId === mapId && Date.now() - transit.timestamp < 15000;

        if (isPortalArrival) {
            const destPortal = portals.find((p) => p.id === transit.targetPortalId);
            const tok = tokens[transit.tokenId];
            const { drawW, drawH } = tok
                ? getTokenDrawDimensions(tok)
                : { drawW: grid.size || 50, drawH: grid.size || 50 };
            const destCenter = destPortal
                ? calcPortalCenter(destPortal)
                : tok
                    ? { x: tok.x + drawW / 2, y: tok.y + drawH / 2 }
                    : { x: mapW / 2, y: mapH / 2 };

            // Initialize camera directly aligned with destination portal threshold
            panX = w / 2 - destCenter.x;
            panY = h / 2 - destCenter.y;
            zoom = 1.0;

            if (tok) {
                selectedTokenIds.clear();
                selectedTokenIds.add(tok.id);
                selectedTokenId = tok.id;
                // Animate stepping forward from portal threshold into the room
                const startStepX = destCenter.x - drawW / 2;
                const startStepY = destCenter.y - drawH / 2;
                triggerTokenStepThroughAnimation(tok.id, startStepX, startStepY, tok.x, tok.y, 300);
            }

            window._portalTransitInfo = null;
            pendingFocusTokenId = null;

            updateContainerTransform();
            renderAll();
            updateCoordinateDisplay(currentMouseCoords);

            // Smoothly ease camera onto the arrived token after stepping through
            if (tok) {
                panTo(tok.x + drawW / 2, tok.y + drawH / 2, null, 400);
            }
        } else {
            if (!preserveCamera) {
                let playerToken = null;
                if (vtt.role !== 'GM') {
                    playerToken = Object.values(tokens).find(
                        (t) => (t.isPlayer || t.isCompanion) && isTokenControlledByPlayer(t, true)
                    );
                }
                if (playerToken) {
                    const { drawW, drawH } = getTokenDrawDimensions(playerToken);
                    panX = w / 2 - (playerToken.x + drawW / 2);
                    panY = h / 2 - (playerToken.y + drawH / 2);
                    zoom = 1.0;
                } else {
                    panX = (w - mapW) / 2;
                    panY = (h - mapH) / 2;
                    zoom = 1.0;
                }
            }
            updateContainerTransform();
            renderAll();
            updateCoordinateDisplay(currentMouseCoords);

            if (pendingFocusTokenId && Date.now() < pendingFocusTokenExpiry && tokens[pendingFocusTokenId]) {
                selectedTokenIds.clear();
                selectedTokenIds.add(pendingFocusTokenId);
                selectedTokenId = pendingFocusTokenId;
                const tok = tokens[pendingFocusTokenId];
                const { drawW, drawH } = getTokenDrawDimensions(tok);
                panTo(tok.x + drawW / 2, tok.y + drawH / 2, null, 350);
                pendingFocusTokenId = null;
            }
        }

        if (vtt.weatherEngine) {
            vtt.weatherEngine.resize(mapW, mapH);
            vtt.weatherEngine.setWeather(mapData.weather);
        }

        // Seamlessly dismiss loading indicator once map asset is ready
        requestAnimationFrame(() => {
            const bgNode = document.getElementById(`asset_node_asset_${mapId}_bg`);
            if (bgNode && bgNode.tagName === 'IMG') {
                if (bgNode.complete && bgNode.naturalWidth > 0) {
                    hideMapLoadingIndicator();
                } else {
                    bgNode.addEventListener('load', () => hideMapLoadingIndicator(), { once: true });
                    bgNode.addEventListener('error', () => hideMapLoadingIndicator(), { once: true });
                }
            } else {
                hideMapLoadingIndicator();
            }
        });
    }

    function updatePreviewBanner() {
        const btnLocator = document.getElementById('btn-token-locator');
        if (btnLocator) {
            if (
                vtt.role === 'GM' &&
                vtt.campaignState &&
                vtt.campaignState.activeMapId &&
                currentMapId !== vtt.campaignState.activeMapId
            ) {
                const previewMapName = vtt.campaignState.maps[currentMapId]?.name || 'Preview Map';
                btnLocator.title = `Token Locator and Map Switcher (GM Previewing: "${previewMapName}")`;
                btnLocator.style.borderColor = 'var(--color-gold-base)';
                btnLocator.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.4)';
            } else {
                btnLocator.title = 'Token Locator and Map Switcher';
                btnLocator.style.borderColor = '';
                btnLocator.style.boxShadow = '';
            }
        }
        if (typeof vtt.refreshLocatorPanel === 'function') {
            vtt.refreshLocatorPanel();
        }
    }

    // Camera animation state
    cameraAnimFrame = null;

    const cameraContext = {
        get panX() {
            return panX;
        },
        set panX(v) {
            panX = v;
        },
        get panY() {
            return panY;
        },
        set panY(v) {
            panY = v;
        },
        get zoom() {
            return zoom;
        },
        set zoom(v) {
            zoom = v;
        },
        get viewport() {
            return viewport;
        },
        get container() {
            return container;
        },
        get grid() {
            return grid;
        },
        get tokens() {
            return tokens;
        },
        get selectedTokenIds() {
            return selectedTokenIds;
        },
        get currentMapId() {
            return currentMapId;
        },
        get vtt() {
            return vtt;
        },
        getTokenDrawDimensions: (t) => getTokenDrawDimensions(t),
        isTokenControlledByPlayer: (t) => isTokenControlledByPlayer(t),
        updateContainerTransform: () => updateContainerTransform(),
        renderAll: () => renderAll()
    };

    function cancelCameraAnimation() {
        cancelCameraAnimationExt();
    }
    function panTo(targetX, targetY, targetZoom = null, duration = 350) {
        panToExt(targetX, targetY, targetZoom, duration, cameraContext);
    }
    function setZoom(targetZoom, anchorX = null, anchorY = null, animate = false) {
        setZoomExt(targetZoom, anchorX, anchorY, animate, cameraContext);
    }
    function stepZoom(deltaPercent) {
        stepZoomExt(deltaPercent, cameraContext);
    }
    function centerOnTokenOrMap() {
        centerOnTokenOrMapExt(cameraContext);
    }
    function broadcastViewToPlayers() {
        broadcastViewToPlayersExt(cameraContext);
    }
    function setupZoomHudControls() {
        setupZoomHudControlsExt(cameraContext);
    }
    function updateContainerTransform() {
        updateContainerTransformExt(container, panX, panY, zoom);
    }
    function updateCoordinateDisplay(mouse) {
        updateCoordinateDisplayExt(mouse, grid);
    }

    function performRenderAll() {
        const isGmViewing = vtt.role === 'GM';
        let width = 2000;
        let height = 1500;
        const currentMap = vtt.campaignState?.maps?.[currentMapId];

        const bgContainer = document.getElementById('vtt-map-bg-container');
        const underGridOverlay = document.getElementById('vtt-map-html-overlays');

        if (currentMap?.gridWidth) {
            width = currentMap.gridWidth * grid.size * (grid.scale || 1.0);
        } else if (bgContainer?.dataset?.naturalWidth) {
            width = parseInt(bgContainer.dataset.naturalWidth) || 2000;
        } else if (currentMap?.tokens) {
            const mapAsset = Object.values(currentMap.tokens).find((t) => t.layer === 'map');
            if (mapAsset && mapAsset.pixelWidth) width = mapAsset.pixelWidth;
        }

        if (currentMap?.gridHeight) {
            height = currentMap.gridHeight * grid.size * (grid.scale || 1.0);
        } else if (bgContainer?.dataset?.naturalHeight) {
            height = parseInt(bgContainer.dataset.naturalHeight) || 1500;
        } else if (currentMap?.tokens) {
            const mapAsset = Object.values(currentMap.tokens).find((t) => t.layer === 'map');
            if (mapAsset && mapAsset.pixelHeight) height = mapAsset.pixelHeight;
        }

        if (bgContainer) {
            bgContainer.style.width = `${width}px`;
            bgContainer.style.height = `${height}px`;
        }
        if (underGridOverlay) {
            underGridOverlay.style.width = `${width}px`;
            underGridOverlay.style.height = `${height}px`;
        }

        // Resize the main draggable #canvas-container so it doesn't clip the map bounds
        if (container) {
            container.style.width = `${width}px`;
            container.style.height = `${height}px`;
        }
        if (vtt.weatherEngine) {
            vtt.weatherEngine.resize(width, height);
        }

        // Size canvases to match map dimensions
        if (canvasGrid.width !== width || canvasGrid.height !== height) {
            isGridDirty = true;
            if (canvasFloorEffects) {
                canvasFloorEffects.width = width;
                canvasFloorEffects.height = height;
                canvasFloorEffects.style.width = `${width}px`;
                canvasFloorEffects.style.height = `${height}px`;
            }
            canvasGrid.width = width;
            canvasGrid.height = height;
            canvasGrid.style.width = `${width}px`;
            canvasGrid.style.height = `${height}px`;
            if (canvasPortals) {
                canvasPortals.width = width;
                canvasPortals.height = height;
                canvasPortals.style.width = `${width}px`;
                canvasPortals.style.height = `${height}px`;
            }
            canvasInteraction.width = width;
            canvasInteraction.height = height;
            canvasInteraction.style.width = `${width}px`;
            canvasInteraction.style.height = `${height}px`;
        }

        // Adaptive Fog LOD resolution: scale buffer to 0.5x if map > 2500px in either dimension
        const useFogLod = width > 2500 || height > 2500;
        const fogScale = useFogLod ? 0.5 : 1.0;
        const targetFogW = Math.round(width * fogScale);
        const targetFogH = Math.round(height * fogScale);
        if (canvasFog.width !== targetFogW || canvasFog.height !== targetFogH) {
            canvasFog.width = targetFogW;
            canvasFog.height = targetFogH;
            canvasFog.style.width = `${width}px`;
            canvasFog.style.height = `${height}px`;
        }

        // 1. Render Fog of War & Light Washes (Dynamic Raycasting & light floor wash)
        renderFogOfWarLayer(width, height);

        // 1.2 Render Floor Effects (Token Auras on floor underneath Grid and Tokens)
        renderFloorEffectsLayer(width, height);

        // 1.4 Render Grid (and map layer assets underneath)
        renderGridLayer(width, height);

        // 1.6 Render Portals & Projections Layer (Floor level - above Map/Grid, underneath Tokens)
        renderPortalsLayer(width, height);

        // 2. Render Interaction & Visuals (Tokens, Walls overlays, etc.)
        renderInteractionLayer();

        // 3. Update Visual FX overlays (initiative outline, offscreen indicator, hover glow)
        requestVisualFxUpdate();
    }

    function renderFloorEffectsLayer(width, height) {
        if (!ctxFloorEffects) return;
        renderTokenAurasPassExt(ctxFloorEffects, tokens, grid, vtt, activeLayer, {
            isRectInViewport,
            isPointVisible,
            getTokenDrawDimensions
        });
    }

    function renderPortalsLayer(width, height) {
        if (!ctxPortals) return;
        ctxPortals.clearRect(0, 0, width, height);
        renderProjectedPortals(ctxPortals);
        renderPortals(ctxPortals);
    }

    function renderGridLayer(width, height) {
        renderGridLayerExt(canvasGrid, ctxGrid, grid, width, height, { isGridDirty });
    }

    // Dynamic 2D Raycasting Fog of War
    function renderFogOfWarLayer(width, height) {
        visionPolygons = renderFogOfWarLayerExt(width, height, {
            ctxFog,
            canvasFog,
            ctxFloor: ctxFloorEffects,
            scratchLightCanvas,
            ctxScratchLight,
            vtt,
            currentMapId,
            selectedTokenIds,
            tokens,
            lights,
            walls,
            wallsVersion,
            wallSpatialIndex,
            spatialIndex: wallSpatialIndex,
            grid,
            defaultSightRadius,
            dragTargetId,
            tokenDragOriginalPositions,
            isRectInViewport,
            getTokenCenter,
            getTokenDrawDimensions,
            isTokenControlledByPlayer,
            checkLightingAnimationLoop: () => checkLightingAnimationLoop(),
            computeVisPolyFn: computeVisibilityPolygon,
            gmTokenVisionMode,
            onGmVisionModeReset: () => {
                gmTokenVisionMode = false;
            }
        });
    }

    let cachedHasAnimatedLight = false;
    let lastAnimatedLightScanTime = 0;

    function evaluateHasAnimatedLight() {
        return (
            (lights && lights.some((l) => l.animationType && l.animationType !== 'none')) ||
            (tokens &&
                Object.values(tokens).some(
                    (t) => t.lightEnabled && t.lightAnimationType && t.lightAnimationType !== 'none'
                ))
        );
    }

    function checkLightingAnimationLoop() {
        lastAnimatedLightScanTime = 0;
        if (isLightingAnimationRunning) return;
        cachedHasAnimatedLight = evaluateHasAnimatedLight();
        if (!cachedHasAnimatedLight) return;
        isLightingAnimationRunning = true;
        requestAnimationFrame(lightingAnimationTick);
    }

    const LIGHTING_FRAME_INTERVAL = 1000 / 30; // ~33ms, 30 FPS cap for torch flicker/pulse

    function lightingAnimationTick(now) {
        if (!canvasFog || !ctxFog || !lifecycle.isCanvasVisible()) {
            isLightingAnimationRunning = false;
            return;
        }
        const currentTime = typeof now === 'number' && now > 0 ? now : performance.now();
        // Periodically refresh cached animated light status every 500ms instead of every frame
        if (currentTime - lastAnimatedLightScanTime >= 500) {
            lastAnimatedLightScanTime = currentTime;
            cachedHasAnimatedLight = evaluateHasAnimatedLight();
        }
        if (!cachedHasAnimatedLight) {
            isLightingAnimationRunning = false;
            return;
        }
        if (currentTime - lastLightingTickTime >= LIGHTING_FRAME_INTERVAL) {
            lastLightingTickTime = currentTime;
            renderFogOfWarLayer(canvasInteraction.width, canvasInteraction.height);
            renderFloorEffectsLayer(canvasInteraction.width, canvasInteraction.height);
        }
        requestAnimationFrame(lightingAnimationTick);
    }

    function computeVisibilityPolygon(
        cx,
        cy,
        sightRadius,
        width,
        height,
        beamArc = 360,
        beamFacing = 0,
        ignoreWallFilter = null,
        wallsOverride = null
    ) {
        return computeVisibilityPolygonExt(
            cx,
            cy,
            sightRadius,
            width,
            height,
            beamArc,
            beamFacing,
            ignoreWallFilter,
            wallsOverride,
            walls,
            wallSpatialIndex
        );
    }

    // Standard ray-line intersection resolver
    function getLineIntersection(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy) {
        return getLineIntersectionExt(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy);
    }

    function renderInteractionLayer() {
        const isGmViewing = vtt.role === 'GM';
        ctxInteraction.clearRect(0, 0, canvasInteraction.width, canvasInteraction.height);

        // 1.9 Active Initiative Token Highlight removed (handled via DOM in animateVisualFx)

        if (isBoxSelecting && boxSelectStart && boxSelectEnd) {
            const bounds = getSelectionBounds(boxSelectStart, boxSelectEnd);
            ctxInteraction.save();
            ctxInteraction.fillStyle = 'rgba(32, 138, 255, 0.12)';
            ctxInteraction.strokeStyle = 'rgba(32, 138, 255, 0.8)';
            ctxInteraction.lineWidth = 2;
            ctxInteraction.setLineDash([6, 4]);
            ctxInteraction.fillRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
            ctxInteraction.strokeRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
            ctxInteraction.restore();
        }

        const htmlOverlayLayer = document.getElementById('vtt-html-overlays');
        if (htmlOverlayLayer) {
            // Transform is handled by #canvas-container CSS transform — do NOT apply it again here
            htmlOverlayLayer.style.transform = 'none';
        }

        // 1. Draw GM Wall Segments & Standalone Lights
        renderGmWallSegmentsPass(ctxInteraction, {
            vtt,
            activeLayer,
            walls,
            selectedWallIdx,
            selectedWallIdxs,
            hoveredWallIdx,
            hoveredWallVertex,
            isDrawingWall,
            wallStartPoint,
            getCanvasMouseCoords,
            lastMouseEvent,
            snapToGrid,
            currentLightingType,
            currentWallShape,
            isPointVisible,
            localIsShaping,
            localShapeStart,
            localShapeEnd,
            measureAnchorPoints,
            localIsMeasuring,
            localMeasureStart,
            localMeasureEnd,
            isTokenMeasuring,
            isRectInViewport,
            getWallCoordinatesForRaycasting,
            otherMeasurements,
            currentMapId,
            drawMeasurementTemplate,
            resolveRulerPortalBending,
            grid
        });

        renderStandaloneLightsInteractionPass(ctxInteraction, {
            vtt,
            activeLayer,
            lights,
            selectedLightId,
            hoveredLightId,
            isRectInViewport
        });

        // 1.4 Render Map Layer Drawings & Shapes
        renderDrawingsPass('map');
        renderShapesPass('map');

        // 1.5 Render Token Layer Drawings & Shapes (Underneath Tokens)
        renderDrawingsPass('token');
        renderShapesPass('token');

        // 1.6 Render GM Layer Drawings & Shapes (Visible only to GM)
        if (vtt.role === 'GM') {
            renderDrawingsPass('gm');
            renderShapesPass('gm');
        }

        // 1.8 Render Traps (Floor/Hazard Level)
        renderTraps(ctxInteraction);

        // 2. Draw Tokens Layer
        renderTokensLayerExt({
            tokens,
            tokenAnimations,
            getTokenDrawDimensions,
            selectedTokenIds,
            activeDragTokenId,
            dragTargetId,
            hoverTokenId,
            isRectInViewport,
            vtt,
            activeLayer,
            panX,
            panY,
            zoom,
            grid,
            ctxInteraction,
            isGmViewing,
            isTokenControlledByPlayer,
            isPointVisible,
            canvasToScreen,
            getCategoryColor,
            getTokenCategory,
            loadPlayerTokenPrefs,
            loadGmTokenPrefs,
            getEffectiveVisibility,
            getEffectiveNumberVisible,
            renderAll,
            openTokenEditModal,
            openPushPlayersModal,
            startTouchTokenDrag,
            moveTouchTokenDrag,
            endTouchTokenDrag,
            cancelTokenDrag,
            campaignSettings,
            currentMapId,
            showGmTokenTooltip,
            hideGmTokenTooltip
        });

        // Render Note Pins
        renderNotePinsExt(ctxInteraction, {
            vtt,
            isGmViewing,
            activeLayer,
            notes,
            isRectInViewport,
            hoveredNoteId,
            selectedNoteId
        });

        // Render active visual pings & damage FX animations
        renderActivePingsPassExt(ctxInteraction, activePings);
        renderActiveDamageFXPassExt(ctxInteraction);
        cleanupOrphanedTokenOverlaysExt(tokens);

        // Draw in-progress live Paint stroke / shape preview
        if (activeTool === 'paint') {
            if (currentPaintStroke && currentPaintStroke.type !== 'eraser') {
                drawDrawingObject(ctxInteraction, currentPaintStroke, false);
            } else if (polygonPoints.length > 0) {
                ctxInteraction.save();
                ctxInteraction.strokeStyle = paintStrokeColor;
                ctxInteraction.lineWidth = paintStrokeWidth;
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(polygonPoints[0].x, polygonPoints[0].y);
                for (let i = 1; i < polygonPoints.length; i++) {
                    ctxInteraction.lineTo(polygonPoints[i].x, polygonPoints[i].y);
                }
                if (currentMouseCoords) {
                    ctxInteraction.lineTo(currentMouseCoords.x, currentMouseCoords.y);
                }
                ctxInteraction.stroke();
                polygonPoints.forEach((p, idx) => {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(p.x, p.y, (idx === 0 ? 5.5 : 4) / zoom, 0, Math.PI * 2);
                    ctxInteraction.fillStyle = idx === 0 ? '#10b981' : '#ffd700';
                    ctxInteraction.fill();
                    ctxInteraction.strokeStyle = '#ffffff';
                    ctxInteraction.lineWidth = 1 / zoom;
                    ctxInteraction.stroke();
                });
                ctxInteraction.restore();
            }

            if (paintSubTool === 'eraser' && currentMouseCoords) {
                const eraseR = Math.max(16, paintStrokeWidth * 3) / 2;
                ctxInteraction.save();
                ctxInteraction.strokeStyle = '#ffffff';
                ctxInteraction.lineWidth = 1.5 / zoom;
                ctxInteraction.beginPath();
                ctxInteraction.arc(currentMouseCoords.x, currentMouseCoords.y, eraseR, 0, Math.PI * 2);
                ctxInteraction.stroke();
                ctxInteraction.strokeStyle = '#000000';
                ctxInteraction.setLineDash([3 / zoom, 3 / zoom]);
                ctxInteraction.stroke();
                ctxInteraction.restore();
            }
        }

        if (vtt.role === 'GM' && selectedMapToolItem) {
            renderSelectedMapToolHighlight(ctxInteraction);
        }

        if (activeTool === 'maptools' || activeTool === 'map-tools') {
            renderMapToolDrawingPreview(ctxInteraction);
        }
    }

    async function setMapBackground(url) {
        return setMapBackgroundExt(url, cameraContext);
    }

    function triggerPingAnimation(x, y, username, role) {
        triggerPingAnimationExt(x, y, username, role);
    }
    function animatePings() {
        animatePingsExt();
    }
    function triggerDamageFXAnimation(x, y, radius, damageTypes, meta = {}) {
        triggerDamageFXAnimationExt(x, y, radius, damageTypes, meta);
    }
    function triggerHealingFXAnimation(x, y, radius, amount, meta = {}) {
        triggerHealingFXAnimationExt(x, y, radius, amount, meta);
    }
    function animateDamageFX() {
        animateDamageFXExt();
    }
    function renderDamageFXBurst(ctx, x, y, baseRadius, progress, opacity, damageType, index = 0) {
        renderDamageFXBurstExt(ctx, x, y, baseRadius, progress, opacity, damageType, index);
    }
    function processTokenAnimReqs(tokensObj) {
        processTokenAnimReqsExt(tokensObj);
    }
    function animateTokens() {
        animateTokensExt();
    }
    function getTokenCategory(token) {
        return getTokenCategoryExt(token);
    }
    function getCategoryColor(category) {
        return getCategoryColorExt(category);
    }

    function requestVisualFxUpdate() {
        if (visualFxRequested) return;
        visualFxRequested = true;
        visualFxAnimFrame = requestAnimationFrame(updateVisualFx);
    }
    window.requestVisualFxUpdate = requestVisualFxUpdate;

    function updateVisualFx() {
        visualFxRequested = false;
        updateVisualFxExt({
            vtt,
            tokens,
            activeLayer,
            grid,
            initiativeHoverTokenId,
            panX,
            panY,
            zoom,
            getTokenDrawDimensions,
            getTokenCategory,
            getCategoryColor
        });
    }

    window.emitTokenUpdates = function (currentTokens) {
        if (!vtt.socket || !currentMapId) return;

        // Find deletes
        for (const id in lastBroadcastedTokens) {
            if (!currentTokens[id]) {
                // Guard: Never delete background map assets via auto-diff
                const oldTok = lastBroadcastedTokens[id];
                if (oldTok && (oldTok.layer === 'map' || oldTok.isBackground) && oldTok.isAsset) {
                    continue;
                }
                if (vtt.role !== 'GM' && !isTokenControlledByPlayer(oldTok, true)) {
                    continue;
                }
                vtt.socket.emit('token:delete', { mapId: currentMapId, tokenId: id });
            }
        }

        // Find adds and updates
        const modifiedTokenIds = new Set();
        for (const id in currentTokens) {
            if (!lastBroadcastedTokens[id]) {
                modifiedTokenIds.add(id);
                vtt.socket.emit('token:add', { mapId: currentMapId, tokenId: id, token: currentTokens[id] });
            } else {
                // Delta check
                const oldToken = lastBroadcastedTokens[id];
                const newToken = currentTokens[id];
                const changes = {};
                let hasChanges = false;

                // Check for added or modified properties (fast primitive equality bypasses JSON.stringify)
                for (const key in newToken) {
                    const newVal = newToken[key];
                    const oldVal = oldToken[key];
                    if (newVal === oldVal) continue;

                    if (
                        typeof newVal === 'object' &&
                        newVal !== null &&
                        typeof oldVal === 'object' &&
                        oldVal !== null
                    ) {
                        if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
                            changes[key] = newVal;
                            hasChanges = true;
                        }
                    } else {
                        changes[key] = newVal;
                        hasChanges = true;
                    }
                }

                // Check for explicitly deleted properties
                for (const key in oldToken) {
                    if (!(key in newToken)) {
                        changes[key] = null;
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    modifiedTokenIds.add(id);
                    vtt.socket.emit('token:update_delta', { mapId: currentMapId, tokenId: id, changes });
                }
            }
        }

        // Update snapshot incrementally (avoid full structuredClone churn on unchanged tokens)
        const snapshot = {};
        for (const id in currentTokens) {
            const tok = currentTokens[id];
            if (!tok) continue;
            if (!modifiedTokenIds.has(id) && lastBroadcastedTokens && lastBroadcastedTokens[id]) {
                snapshot[id] = lastBroadcastedTokens[id];
            } else {
                const clone =
                    typeof structuredClone === 'function' ? structuredClone(tok) : JSON.parse(JSON.stringify(tok));
                if (clone._animReq) {
                    delete clone._animReq;
                }
                snapshot[id] = clone;
            }
        }
        lastBroadcastedTokens = snapshot;
    };

    const syncContext = {
        get vtt() {
            return vtt;
        },
        get currentMapId() {
            return currentMapId;
        },
        get tokens() {
            return tokens;
        },
        set tokens(v) {
            tokens = v;
        },
        get walls() {
            return walls;
        },
        set walls(v) {
            walls = v;
            syncWallSpatialIndex();
        },
        get lights() {
            return lights;
        },
        set lights(v) {
            lights = v;
        },
        get portals() {
            return portals;
        },
        set portals(v) {
            portals = v;
        },
        get traps() {
            return traps;
        },
        set traps(v) {
            traps = v;
        },
        get notes() {
            return notes;
        },
        set notes(v) {
            notes = v;
        },
        get drawings() {
            return drawings;
        },
        set drawings(v) {
            drawings = v;
        },
        get shapes() {
            return shapes;
        },
        set shapes(v) {
            shapes = v;
        },
        get selectedTokenIds() {
            return selectedTokenIds;
        },
        get selectedTokenId() {
            return selectedTokenId;
        },
        set selectedTokenId(v) {
            selectedTokenId = v;
        },
        get dragTargetId() {
            return dragTargetId;
        },
        get lastBroadcastedTokens() {
            return lastBroadcastedTokens;
        },
        set lastBroadcastedTokens(v) {
            lastBroadcastedTokens = v;
        },
        get pendingFocusTokenId() {
            return pendingFocusTokenId;
        },
        set pendingFocusTokenId(v) {
            pendingFocusTokenId = v;
        },
        get pendingFocusTokenExpiry() {
            return pendingFocusTokenExpiry;
        },
        set pendingFocusTokenExpiry(v) {
            pendingFocusTokenExpiry = v;
        },
        loadMap: (id, reset) => loadMap(id, reset),
        renderAll: () => renderAll(),
        panTo: (...args) => panTo(...args),
        triggerPingAnimation: (...args) => triggerPingAnimation(...args),
        triggerDamageFXAnimation: (...args) => triggerDamageFXAnimation(...args),
        triggerHealingFXAnimation: (...args) => triggerHealingFXAnimation(...args),
        renderPlacedTrapsList: () => renderPlacedTrapsList(),
        renderPlacedPortalsList: () => renderPlacedPortalsList(),
        processTokenAnimReqs: (t) => processTokenAnimReqs(t),
        renderMapGrid: () => renderMapGrid(),
        updatePreviewBanner: () => updatePreviewBanner(),
        get grid() {
            return grid;
        },
        set grid(v) {
            grid = v;
        },
        get otherMeasurements() {
            return otherMeasurements;
        },
        set otherMeasurements(v) {
            otherMeasurements = v;
        },
        get campaignSettings() {
            return campaignSettings;
        },
        set campaignSettings(v) {
            campaignSettings = v;
        },
        cleanupMediaElement: (el) => cleanupMediaElement(el),
        syncGridConfigInputs: () => syncGridConfigInputs(),
        setMapBackground: (url) => setMapBackground(url),
        getTokenDrawDimensions: (tok) => getTokenDrawDimensions(tok),
        renderInteractionLayer: () => renderInteractionLayer(),
        populateTargetPortalsDropdown: (...args) => populateTargetPortalsDropdown(...args),
        triggerTrapSpringFX: (...args) => triggerTrapSpringFX(...args),
        postTrapTriggerChatCard: (...args) => postTrapTriggerChatCard(...args),
        isTokenControlledByPlayer: (...args) => isTokenControlledByPlayer(...args),
        showGMInterMapPortalToast: (...args) => showGMInterMapPortalToast(...args),
        showPlayerInterMapPortalToast: (...args) => showPlayerInterMapPortalToast(...args),
        isHexGrid: (...args) => isHexGrid(...args),
        getNearestHexFeatures: (...args) => getNearestHexFeatures(...args),
        hasMapManagerDataChanged: (camp) => hasMapManagerDataChanged(camp),
        syncHpSettingsInputs: () => syncHpSettingsInputs(),
        syncPlayerTokenSettingsUI: () => syncPlayerTokenSettingsUI(),
        syncGmTokenSettingsUI: () => syncGmTokenSettingsUI(),
        get wallsVersion() {
            return wallsVersion;
        },
        set wallsVersion(v) {
            wallsVersion = v;
        },
        syncWallSpatialIndex: (w, h) => syncWallSpatialIndex(w, h)
    };

    function setupSocketSync() {
        setupSocketSyncExt(syncContext);
    }

    const mapManagerState = {
        activeMapFolder: '__ALL__',
        currentMapViewMode: localStorage.getItem('vtt_map_manager_view_mode') || 'grid',
        mapSearchQuery: '',
        searchDebounceTimer: null,
        mapManagerControlsInitialized: false,
        draggedMapId: null,
        lastMapManagerFingerprint: '',
        editingMapId: null,
        currentEditingWeatherLayers: [],
        currentEditingWeatherSaturation: 100,
        weatherEmitTimer: null
    };

    function syncGridConfigInputs() {
        syncGridConfigInputsExt();
    }

    function hasMapManagerDataChanged(camp) {
        const fp = hasMapManagerDataChangedExt(camp, mapManagerState.lastMapManagerFingerprint);
        if (fp === false) return false;
        mapManagerState.lastMapManagerFingerprint = fp;
        return true;
    }

    function escapeMapHtml(str) {
        return escapeMapHtmlExt(str);
    }

    function buildMapThumbnailMarkup(map, safeThumb, isVideo, isGif, iconSize = '1.8rem') {
        return buildMapThumbnailMarkupExt(map, safeThumb, isVideo, isGif, iconSize);
    }

    function attachThumbnailHoverPreview(thumbWrap) {
        attachThumbnailHoverPreviewExt(thumbWrap);
    }

    function getMapManagerOptions() {
        return {
            vtt,
            getCurrentMapId: () => currentMapId,
            getSafeVttUrl,
            loadMap: (id) => switchMapTo(id),
            openPushPlayersModal,
            renderMapGrid
        };
    }

    function initMapManagerControls() {
        initMapManagerControlsExt(mapManagerState, getMapManagerOptions());
    }

    function renderMapSidebar(allMaps, allFolders, activeFolder) {
        renderMapSidebarExt(allMaps, allFolders, activeFolder, mapManagerState, getMapManagerOptions());
    }

    function createMapCard(map, allFolderNames) {
        return createMapCardExt(map, allFolderNames, mapManagerState, getMapManagerOptions());
    }

    function renderMapGrid() {
        renderMapGridExt(mapManagerState, getMapManagerOptions());
    }

    function emitWeatherUpdate(immediate = false) {
        emitWeatherUpdateExt(mapManagerState, { vtt, currentMapId }, immediate);
    }

    function renderWeatherLayersUI() {
        renderWeatherLayersUIExt(mapManagerState, {
            vtt,
            getCurrentMapId: () => currentMapId,
            currentMapId
        });
    }

    function setupEditMapModal() {
        setupEditMapModalExt(mapManagerState, {
            vtt,
            getCurrentMapId: () => currentMapId,
            setMapBackground,
            renderAll
        });
        setupWeatherControlsExt(mapManagerState, {
            vtt,
            getCurrentMapId: () => currentMapId,
            currentMapId
        });
    }

    function openEditMapModal(map) {
        openEditMapModalExt(map, mapManagerState, {
            vtt,
            getCurrentMapId: () => currentMapId,
            setMapBackground,
            renderAll,
            parseWeatherSettings,
            renderWeatherLayersUI,
            getGridDistanceSettings
        });
    }

    function setupMapUploadControls() {
        setupMapUploadControlsExt(mapManagerState, getMapManagerOptions());
    }

    function setupPushPlayersModal() {
        setupPushPlayersModalExt(getMapManagerOptions());
    }

    function openPushPlayersModal(mapId) {
        openPushPlayersModalExt(mapId, getMapManagerOptions());
    }

    function setupTokenLocatorPanel() {
        setupTokenLocatorPanelExt({
            vtt,
            getCurrentMapId: () => currentMapId,
            setCurrentMapId: (id) => {
                currentMapId = id;
            },
            tokens,
            selectedTokenIds,
            setSelectedTokenId: (id) => {
                selectedTokenId = id;
            },
            getTokenDrawDimensions,
            panTo,
            renderAll,
            loadMap,
            openPushPlayersModal,
            isTokenControlledByPlayer,
            attachThumbnailHoverPreview,
            getSafeVttUrl,
            setPendingFocusToken: (id, expiry) => {
                pendingFocusTokenId = id;
                pendingFocusTokenExpiry = expiry;
            }
        });
    }

    const tokenModalState = {
        selectedTokenIdForEdit: null,
        tempAurasList: []
    };

    function renderAuraList() {
        renderAuraListExt(tokenModalState.tempAurasList);
    }

    function setupTokenEditModal() {
        setupTokenEditModalExt(tokenModalState, {
            vtt,
            getTokens: () => tokens,
            tokens,
            getGrid: () => grid,
            grid,
            renderAll,
            parseMonsterVision:
                typeof window !== 'undefined' && typeof window.parseMonsterVision === 'function'
                    ? window.parseMonsterVision
                    : null
        });
    }

    function openTokenEditModal(tokenId) {
        openTokenEditModalExt(tokenId, tokenModalState, {
            vtt,
            getTokens: () => tokens,
            tokens,
            isTokenControlledByPlayer
        });
    }

    const isMobileViewport = () => {
        if (document.documentElement?.classList?.contains('force-desktop-ui')) return false;
        if (document.documentElement?.classList?.contains('force-mobile-ui')) return true;
        const forced = localStorage.getItem('vtt_force_mobile_ui');
        if (forced === 'true') return true;
        if (forced === 'false') return false;
        return (
            window.innerWidth <= 900 ||
            (((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window) &&
                window.innerWidth <= 1366)
        );
    };

    const touchContext = {
        get vtt() {
            return vtt;
        },
        get currentMapId() {
            return currentMapId;
        },
        get tokens() {
            return tokens;
        },
        get dragTargetId() {
            return dragTargetId;
        },
        set dragTargetId(v) {
            dragTargetId = v;
        },
        get dragOffsetX() {
            return dragOffsetX;
        },
        set dragOffsetX(v) {
            dragOffsetX = v;
        },
        get dragOffsetY() {
            return dragOffsetY;
        },
        set dragOffsetY(v) {
            dragOffsetY = v;
        },
        get tokenDragOriginalPositions() {
            return tokenDragOriginalPositions;
        },
        set tokenDragOriginalPositions(v) {
            tokenDragOriginalPositions = v;
        },
        get localIsMeasuring() {
            return localIsMeasuring;
        },
        set localIsMeasuring(v) {
            localIsMeasuring = v;
        },
        get isTokenMeasuring() {
            return isTokenMeasuring;
        },
        set isTokenMeasuring(v) {
            isTokenMeasuring = v;
        },
        get localIsShaping() {
            return localIsShaping;
        },
        set localIsShaping(v) {
            localIsShaping = v;
        },
        get localMeasureStart() {
            return localMeasureStart;
        },
        set localMeasureStart(v) {
            localMeasureStart = v;
        },
        get localMeasureEnd() {
            return localMeasureEnd;
        },
        set localMeasureEnd(v) {
            localMeasureEnd = v;
        },
        get localShapeStart() {
            return localShapeStart;
        },
        set localShapeStart(v) {
            localShapeStart = v;
        },
        get localShapeEnd() {
            return localShapeEnd;
        },
        set localShapeEnd(v) {
            localShapeEnd = v;
        },
        get measureAnchorPoints() {
            return measureAnchorPoints;
        },
        set measureAnchorPoints(v) {
            measureAnchorPoints = v;
        },
        get selectedTokenIds() {
            return selectedTokenIds;
        },
        get selectedTokenId() {
            return selectedTokenId;
        },
        set selectedTokenId(v) {
            selectedTokenId = v;
        },
        get tokenAnimations() {
            return tokenAnimations;
        },
        get grid() {
            return grid;
        },
        get walls() {
            return walls;
        },
        get portals() {
            return portals;
        },
        getCanvasMouseCoords: (...args) => getCanvasMouseCoords(...args),
        hideGmTokenTooltip: () => hideGmTokenTooltip(),
        getTokenDrawDimensions: (t) => getTokenDrawDimensions(t),
        isTokenControlledByPlayer: (...args) => isTokenControlledByPlayer(...args),
        snapToGrid: (...args) => snapToGrid(...args),
        renderAll: () => renderAll(),
        checkTokenMoveTriggers: (...args) => checkTokenMoveTriggers(...args),
        calcDistanceFormatted: (...args) => calcDistanceFormatted(...args),
        processTokenAnimReqs: (...args) => processTokenAnimReqs(...args),
        emitTokenUpdates: (...args) => window.emitTokenUpdates(...args)
    };

    function cancelActiveMeasurement() {
        cancelActiveMeasurementExt(touchContext);
    }
    function cancelTokenDrag() {
        cancelTokenDragExt(touchContext);
    }
    function startTouchTokenDrag(tokenId, clientX, clientY) {
        return startTouchTokenDragExt(tokenId, clientX, clientY, touchContext);
    }
    function moveTouchTokenDrag(clientX, clientY) {
        moveTouchTokenDragExt(clientX, clientY, touchContext);
    }
    function endTouchTokenDrag(clientX, clientY) {
        endTouchTokenDragExt(clientX, clientY, touchContext);
    }

    const engine = {
        cancelTokenDrag,
        isDraggingToken: () => !!dragTargetId,
        openTokenEditModal,
        renderAll,
        setGamePauseState: (paused) => {
            vtt.isPaused = !!paused;
            if (paused && vtt.role !== 'GM') {
                if (dragTargetId && cancelTokenDrag) {
                    cancelTokenDrag();
                }
                selectedTokenIds.clear();
                selectedTokenId = null;
            }
            if (paused) {
                document
                    .querySelectorAll?.(
                        '#vtt-html-overlays video, #vtt-map-html-overlays video, #vtt-map-bg-container video'
                    )
                    ?.forEach((v) => {
                        try {
                            v.pause();
                        } catch (e) { }
                    });
                Object.values(ytPingPongControllers).forEach((c) => {
                    try {
                        c?.pause?.();
                    } catch (e) { }
                });
            }
            renderAll();
        },
        isPaused: () => !!(vtt.isPaused || window.VTT?.isPaused),
        syncCampaignState: (newCampaignState) => {
            if (newCampaignState) {
                vtt.campaignState = newCampaignState;
                const targetMapId =
                    vtt.role === 'GM'
                        ? newCampaignState.activeGMMapId || newCampaignState.activeMapId
                        : getPlayerMapOverride(newCampaignState, vtt.username) || newCampaignState.activeMapId;
                if (targetMapId && targetMapId !== currentMapId) {
                    loadMap(targetMapId, false);
                } else if (currentMapId && newCampaignState.maps?.[currentMapId]) {
                    const mapData = newCampaignState.maps[currentMapId];
                    if (vtt.weatherEngine) {
                        vtt.weatherEngine.setWeather(mapData.weather);
                    }
                    traps = Array.isArray(mapData.traps) ? mapData.traps : [];
                    portals = Array.isArray(mapData.portals) ? mapData.portals : [];
                    lights = mapData.lights || [];
                    notes = mapData.notes || [];
                    walls = mapData.walls || [];
                    shapes = mapData.shapes || {};
                    drawings = mapData.drawings || {};
                    syncWallSpatialIndex();

                    const serverTokens = mapData.tokens || {};
                    for (const id in serverTokens) {
                        if (id === dragTargetId && tokens[id]) continue;
                        tokens[id] = JSON.parse(JSON.stringify(serverTokens[id]));
                    }
                    for (const id in tokens) {
                        const t = tokens[id];
                        if (t && (t.layer === 'map' || t.isBackground) && t.isAsset) continue;
                        if (id === dragTargetId) continue;
                        if (vtt.role === 'GM' && t && t.layer === 'gm') continue;
                        if (!serverTokens[id]) {
                            delete tokens[id];
                            if (selectedTokenIds.has(id)) selectedTokenIds.delete(id);
                            if (selectedTokenId === id) selectedTokenId = null;
                        }
                    }
                    lastBroadcastedTokens = JSON.parse(JSON.stringify(tokens));
                    renderAll();
                } else {
                    renderAll();
                }
            }
        },
        getGrid: () => grid,
        getTokens: () => tokens,
        getSelectedTokenIds: () => Array.from(selectedTokenIds),
        selectToken: (tokenId) => {
            selectedTokenIds.clear();
            if (tokenId) {
                selectedTokenIds.add(tokenId);
                selectedTokenId = tokenId;
            }
            renderAll();
        },
        highlightTokenExternal: (tokenId, isHighlighted) => {
            hoverTokenId = isHighlighted ? tokenId : null;
            renderAll();
        },
        setHoverTokenId: (tokenId) => {
            hoverTokenId = tokenId;
            renderAll();
        },
        getCanvasMouseCoords,
        getActiveLayer: () => activeLayer,
        getCurrentMapId: () => currentMapId,
        setTokens: (newTokens) => {
            tokens = newTokens;
            window.emitTokenUpdates(tokens);
            renderAll();
        },
        addToken: (token) => {
            // Guarantee layer assignment safely
            if (!token.layer) {
                token.layer = token.isPlayer ? 'token' : activeLayer;
            }
            if (token.zIndex === undefined) {
                const existingZ = Object.values(tokens).map((t) => t.zIndex || 0);
                const maxZ = existingZ.length > 0 ? Math.max(...existingZ) : 0;
                token.zIndex = maxZ + 1;
            }
            tokens[token.id] = token;
            window.emitTokenUpdates(tokens);
            renderAll();
            if (window.VTT?.chatEngine?.refreshInitiative) {
                window.VTT.chatEngine.refreshInitiative();
            }
        },
        panTo,
        panBy: (dx, dy) => {
            panX += dx;
            panY += dy;
            updateContainerTransform();
            renderAll();
        },
        setZoom,
        stepZoom,
        getZoom: () => zoom,
        getPan: () => ({ panX, panY }),
        getTokenAtPoint: (mouse, requireControl = true, matchLayer = true, touchRadius = 0) =>
            getTokenAtPoint(mouse, requireControl, matchLayer, touchRadius),
        startTouchTokenDrag,
        moveTouchTokenDrag,
        endTouchTokenDrag,
        cancelTouchTokenDrag: cancelTokenDrag,
        centerOnToken: (...args) => centerOnTokenOrMap(...args),
        broadcastViewToPlayers: (...args) => broadcastViewToPlayers(...args),
        getCampaignSettings: () => campaignSettings,
        setInitiativeHoverToken: (tokenId) => {
            initiativeHoverTokenId = tokenId;
            requestVisualFxUpdate();
        },
        getInitiativeHoverToken: () => initiativeHoverTokenId,
        showGmTokenTooltip: (...args) => showGmTokenTooltip(...args),
        hideGmTokenTooltip: () => hideGmTokenTooltip(),
        showTokenContextMenu: (...args) => showTokenContextMenu(...args),
        showMassRollContextMenu: (...args) => showMassRollContextMenu(...args),
        cancelActiveMeasurement: () => cancelActiveMeasurement(),
        setPaintSubTool: (tool) => {
            paintSubTool = tool;
            document.querySelectorAll('#panel-paint-ribbon .paint-subtool-btn').forEach((b) => {
                b.classList.toggle('active', b.dataset.subtool === tool);
            });
        },
        setPaintStrokeWidth: (w) => {
            paintStrokeWidth = w;
            document.querySelectorAll('#panel-paint-ribbon .paint-size-dot').forEach((b) => {
                b.classList.toggle('active', parseInt(b.dataset.size) === w);
            });
            const lbl = document.getElementById('paint-size-label');
            if (lbl) lbl.textContent = `${w}px`;
        },
        setPaintColor: (c) => {
            paintStrokeColor = c;
            paintFillColor = c;
            const swatch = document.getElementById('paint-custom-color');
            if (swatch) swatch.value = c;
            const ind = document.getElementById('paint-active-indicator');
            if (ind) ind.style.background = c;
        },
        setPaintGridSnap: (snap) => {
            paintGridSnap = !!snap;
            const btn = document.getElementById('btn-paint-gridsnap');
            if (btn) btn.classList.toggle('active', paintGridSnap);
            const mBtn = document.getElementById('btn-mobile-paint-gridsnap');
            if (mBtn) mBtn.classList.toggle('active', paintGridSnap);
        },
        setPaintFillMode: (mode) => {
            paintFillMode = mode;
            document.querySelectorAll('#panel-paint-ribbon .paint-opt-btn[data-fillmode]').forEach((b) => {
                b.classList.toggle('active', b.dataset.fillmode === mode);
            });
            document.querySelectorAll('.mobile-paint-fillmode-btn').forEach((b) => {
                b.classList.toggle('active', b.dataset.fillmode === mode);
            });
        },
        getPaintState: () => ({
            subTool: paintSubTool,
            strokeColor: paintStrokeColor,
            fillColor: paintFillColor,
            fillMode: paintFillMode,
            strokeWidth: paintStrokeWidth,
            gridSnap: paintGridSnap
        }),
        getDrawingAtPoint: (pt, matchLayer = true) => getDrawingAtPoint(pt, matchLayer),
        showDrawingContextMenu,
        setMapToolSubmode: (mode) => {
            activeMapToolSubmode = mode;
            document.querySelectorAll('.maptools-tab-btn').forEach((b) => {
                b.classList.toggle('active', (b.dataset.submode || b.dataset.tab) === mode);
            });
            document.getElementById('subpanel-maptools-traps')?.classList.toggle('vtt-hidden', mode !== 'traps');
            document.getElementById('subpanel-maptools-portals')?.classList.toggle('vtt-hidden', mode !== 'portals');
            const activeSubpanel = document.getElementById(
                mode === 'traps' ? 'subpanel-maptools-traps' : 'subpanel-maptools-portals'
            );
            const activeShapeBtn = activeSubpanel?.querySelector('.maptools-shape-btn.active');
            if (activeShapeBtn) {
                currentMapToolShape = activeShapeBtn.dataset.shape || (mode === 'traps' ? 'rect' : 'line');
            }
            cancelMapToolDrawing();
        },
        setMapToolShape: (shape) => {
            currentMapToolShape = shape;
            document.querySelectorAll('.maptools-shape-btn, .vtt-shape-opt').forEach((b) => {
                b.classList.toggle('active', b.dataset.shape === shape);
            });
            cancelMapToolDrawing();
        },
        cancelMapToolDrawing: () => cancelMapToolDrawing(),
        rollTrapSave: (trapId, tokenId, ability, dc) => rollTrapSave(trapId, tokenId, ability, dc),
        switchMapTo: (mapId, tokenId = null) => switchMapTo(mapId, tokenId),
        handleCardAction: (cardData, action, msgId = null) => handleCardAction(cardData, action, msgId),
        resolveSaveFromChat: (cardData, applyHalf, msgId) => resolveSaveFromChat(cardData, applyHalf, msgId),
        processMassAttackFromChat: (massAttackCard, msgId) => processMassAttackFromChat(massAttackCard, msgId),
        triggerDamageFXAnimation: (x, y, radius, damageTypes, meta) =>
            triggerDamageFXAnimation(x, y, radius, damageTypes, meta),
        triggerHealingFXAnimation: (x, y, radius, amount, meta) =>
            triggerHealingFXAnimation(x, y, radius, amount, meta),
        stepTokenSize: (tokenId, delta) => {
            const token = tokens[tokenId];
            if (!token) return null;
            const sizeLadder = [0.5, 1, 2, 3, 4];
            const curSize = parseFloat(token.size) || 1;
            let closestIdx = 1;
            let minDiff = Infinity;
            sizeLadder.forEach((s, idx) => {
                const diff = Math.abs(s - curSize);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = idx;
                }
            });
            const nextIdx = Math.max(0, Math.min(sizeLadder.length - 1, closestIdx + delta));
            token.size = sizeLadder[nextIdx];
            delete token.customWidth;
            delete token.customHeight;
            window.emitTokenUpdates(tokens);
            renderAll();
            return token.size;
        },
        stepTokenRotation: (tokenId, angleDelta = 45) => {
            const token = tokens[tokenId];
            if (!token) return null;
            let cur = (token.rotation || 0) + angleDelta;
            cur = ((cur % 360) + 360) % 360;
            token.rotation = cur;
            window.emitTokenUpdates(tokens);
            renderAll();
            return token.rotation;
        },
        getTokenScreenCoords: (tokenId) => {
            const token = tokens[tokenId];
            if (!token) return null;
            const { drawW, drawH } = getTokenDrawDimensions(token);
            const renderPos = tokenAnimations[token.id]?.currentPos || { x: token.x, y: token.y };
            const cx = renderPos.x + drawW / 2;
            const cy = renderPos.y + drawH / 2;
            const sc = canvasToScreen(cx, cy);
            return {
                x: sc.x,
                y: sc.y,
                width: drawW * zoom,
                height: drawH * zoom
            };
        }
    };

    // =========================================================================
    // TOKEN ACTIONS RIGHT-CLICK CONTEXT MENU & ROLLERS SYSTEM
    // =========================================================================

    function getPcRollFormula(char, rollType, key) {
        return getPcRollFormulaExt(char, rollType, key);
    }

    // =========================================================================
    // CINEMATIC SPLASH ART OVERLAY (Shift+X)
    // =========================================================================

    function isSplashOverlayOpen() {
        return isSplashOverlayOpenExt();
    }

    function closeSplashOverlay() {
        closeSplashOverlayExt();
    }

    function showSplashOverlay(items) {
        showSplashOverlayExt(items);
    }

    function triggerSplashForSelection(specificTokenId = null) {
        triggerSplashForSelectionExt(specificTokenId, {
            vtt,
            tokens,
            selectedTokenIds,
            hoverTokenId
        });
    }

    const splashOverlayEl = document.getElementById('vtt-splash-overlay');
    if (splashOverlayEl) {
        const backdrop = splashOverlayEl.querySelector('.vtt-splash-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => closeSplashOverlay());
        }
        const btnClose = document.getElementById('btn-vtt-splash-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => closeSplashOverlay());
        }
    }

    if (window.VTT) {
        window.VTT.showSplashModal = showSplashOverlay;
        window.VTT.closeSplashModal = closeSplashOverlay;
    }

    const showTokenContextMenu = (id, x, y) =>
        showTokenContextMenuExt(id, x, y, {
            tokens,
            selectedTokenIds,
            selectedTokenId,
            vtt,
            currentMapId,
            renderAll,
            openTokenConfigModal: (tokenId) => openTokenEditModal(tokenId),
            openTokenBulkConfigModal: () => { },
            showAddCustomConditionModal,
            showApplyDamageModal,
            showMassRollContextMenu,
            changeTokenZOrder
        });
    const changeTokenZOrder = (id, a) => changeTokenZOrderExt(id, a, { tokens, currentMapId, vtt, renderAll });
    const showMassRollContextMenu = (arg1, arg2, arg3 = null) => {
        let tokenIds, clientX, clientY;
        if (Array.isArray(arg1) || arg1 instanceof Set) {
            tokenIds = Array.from(arg1);
            clientX = arg2;
            clientY = arg3;
        } else {
            clientX = arg1;
            clientY = arg2;
            tokenIds = arg3 ? Array.from(arg3) : Array.from(selectedTokenIds);
        }
        return showMassRollContextMenuExt(tokenIds, clientX, clientY, {
            selectedTokenIds,
            tokens,
            vtt,
            campaignSettings,
            isMobileViewport,
            triggerSplashForSelection,
            getTokenDrawDimensions,
            snapToGrid,
            currentMapId,
            renderAll,
            promptMassAttackDistribution,
            rollSavingThrowToken,
            showApplyDamageModal,
            changeMassTokenZOrder
        });
    };
    const changeMassTokenZOrder = (a, tokenIds = null) =>
        changeMassTokenZOrderExt(tokenIds || Array.from(selectedTokenIds), a, {
            selectedTokenIds,
            tokens,
            currentMapId,
            vtt,
            renderAll
        });
    const showAddCustomConditionModal = (id, opts = {}) =>
        showAddCustomConditionModalExt(id, { tokens, currentMapId, vtt, renderAll, ...opts });
    const showApplyDamageModal = (ids = null, opts = {}) =>
        showApplyDamageModalExt(ids, {
            selectedTokenIds,
            tokens,
            vtt,
            currentMapId,
            renderAll,
            applyDamageToTokens,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            ...opts
        });
    const _hasResistanceType = (c, d, m = {}) => _hasResistanceTypeExt(c, d, m);
    const syncTokensHpToCharacters = (t, opts = {}) => syncTokensHpToCharactersExt(t, { vtt, ...opts });
    const applyDamageToTokens = (ids, amount, type, mode = 'damage', attackMeta = {}, opts = {}) =>
        applyDamageToTokensExt(ids, amount, type, mode, attackMeta, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            syncTokensHpToCharacters,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            ...opts
        });
    const applyCardDamageToToken = (tokOrId, dmgRolls, multiplier = 1.0, opts = {}) =>
        applyCardDamageToTokenExt(tokOrId, dmgRolls, multiplier, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            syncTokensHpToCharacters,
            ...opts
        });
    const applyCompositeDamageToTokens = (ids, dmgRolls, multiplier = 1.0, opts = {}) =>
        applyCompositeDamageToTokensExt(ids, dmgRolls, multiplier, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            syncTokensHpToCharacters,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            ...opts
        });
    const getTokenSaveMod = (tok, ab, opts = {}) => getTokenSaveModExt(tok, ab, { vtt, ...opts });
    const rollSavingThrowToken = (formula, label, tokenId, opts = {}) =>
        rollSavingThrowTokenExt(formula, label, tokenId, { vtt, getTokenSaveMod, postSaveResolutionChatCard, ...opts });
    const postSaveResolutionChatCard = (d, opts = {}) => postSaveResolutionChatCardExt(d, { vtt, ...opts });
    const resolveSaveFromChat = (saveResolveCard, applyHalf = false, msgId = null, opts = {}) =>
        resolveSaveFromChatExt(saveResolveCard, applyHalf, msgId, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            applyCardDamageToToken: (token, dmgRolls, mult) => applyCardDamageToToken(token, dmgRolls, mult),
            syncTokensHpToCharacters,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            rollSavingThrowToken,
            ...opts
        });
    const promptMassAttackDistribution = (
        massAttackCard,
        selectedIds = null,
        onConfirm = null,
        onCancel = null,
        opts = {}
    ) =>
        promptMassAttackDistributionExt(massAttackCard, selectedIds, onConfirm, onCancel, {
            selectedTokenIds,
            tokens,
            vtt,
            processMassAttackFromChat,
            getTokenAC: (t) => getTokenAC(t) ?? 10,
            ...opts
        });
    const processMassAttackFromChat = (massAttackCard, msgId = null, opts = {}) =>
        processMassAttackFromChatExt(massAttackCard, msgId, {
            vtt,
            tokens,
            selectedTokenIds,
            executeMassAttackResolutionFn: executeMassAttackResolution,
            promptMassAttackDistributionFn: promptMassAttackDistribution,
            getTokenAC: (t) => getTokenAC(t) ?? 10,
            ...opts
        });
    const executeMassAttackResolution = (massAttackCard, distribution, msgId = null, opts = {}) =>
        executeMassAttackResolutionExt(massAttackCard, distribution, msgId, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            syncTokensHpToCharacters,
            getTokenAC: (t) => getTokenAC(t) ?? 10,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            getResolvedCreatureMonsterData,
            ...opts
        });
    const processCardFullResolution = (cardData, selectedIds = null, opts = {}) =>
        processCardFullResolutionExt(cardData, selectedIds, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            syncTokensHpToCharacters,
            getTokenAC: (t) => getTokenAC(t) ?? 10,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            getResolvedCreatureMonsterData,
            ...opts
        });
    const handleCardAction = (c, d, msgId = null) =>
        handleCardActionExt(c, d, {
            tokens,
            currentMapId,
            vtt,
            renderAll,
            syncTokensHpToCharacters,
            promptMassAttackDistribution,
            rollSavingThrowToken,
            showApplyDamageModal,
            changeMassTokenZOrder,
            selectedTokenIds,
            getTokenDrawDimensions,
            triggerDamageFXAnimation,
            triggerHealingFXAnimation,
            getTokenAC: (t) => getTokenAC(t) ?? 10,
            getResolvedCreatureMonsterData,
            msgId
        });
    const rollFromToken = (f, l, id, e) => rollFromTokenExt(f, l, id, e, { vtt });

    const closeTokenMenuOnOutsideClick = (e) => {
        const menu = document.getElementById('vtt-token-context-menu');
        if (menu && !menu.contains(e.target)) menu.remove();
    };
    window.addEventListener('click', closeTokenMenuOnOutsideClick);
    window.addEventListener('contextmenu', closeTokenMenuOnOutsideClick);

    function setupHpSettingsControls() {
        setupHpSettingsControlsExt({
            vtt,
            campaignSettings,
            syncPlayerTokenSettingsUI,
            syncGmTokenSettingsUI,
            renderAll
        });
    }

    function syncHpSettingsInputs() {
        syncHpSettingsInputsExt({ campaignSettings });
    }

    function setupSettingsAccordionBehavior() {
        setupSettingsAccordionBehaviorExt();
    }

    function setupPlayerTokenSettingsControls() {
        setupPlayerTokenSettingsControlsExt(tokenPrefsState, {
            vtt,
            renderAll
        });
    }

    function syncPlayerTokenSettingsUI() {
        syncPlayerTokenSettingsUIExt(tokenPrefsState, {
            vtt,
            campaignSettings
        });
    }

    function updateTokenPreviewMockup() {
        updateTokenPreviewMockupExt(tokenPrefsState);
    }

    function setupGmTokenSettingsControls() {
        setupGmTokenSettingsControlsExt(tokenPrefsState, {
            vtt,
            campaignSettings,
            syncHpSettingsInputs,
            renderAll
        });
    }

    function syncGmTokenSettingsUI() {
        syncGmTokenSettingsUIExt(tokenPrefsState, { vtt });
    }

    function updateGmTokenPreviewMockup() {
        updateGmTokenPreviewMockupExt(tokenPrefsState);
    }

    function getCanvasMouseCoords(e) {
        // Use viewport rect + explicit pan/zoom math so there's no ambiguity.
        // Support MouseEvent, Touch, or plain { clientX, clientY } objects safely.
        const vr = viewport.getBoundingClientRect();
        const clientX =
            e?.clientX !== undefined ? e.clientX : (e?.touches?.[0]?.clientX ?? e?.changedTouches?.[0]?.clientX ?? 0);
        const clientY =
            e?.clientY !== undefined ? e.clientY : (e?.touches?.[0]?.clientY ?? e?.changedTouches?.[0]?.clientY ?? 0);
        const x = (clientX - vr.left - panX) / zoom;
        const y = (clientY - vr.top - panY) / zoom;
        return { x, y };
    }

    // ── Token Hover Stat Tooltip (AC, PP, Speed, PI, PInv) ───────────────────────

    // Inject tooltip CSS once into <head>
    injectGmTooltipStyles();

    function getResolvedCreatureMonsterData(token) {
        return getResolvedCreatureMonsterDataExt(token, { campaignState: vtt.campaignState });
    }
    function getTokenAC(token) {
        return getTokenACExt(token, { campaignState: vtt.campaignState });
    }
    function getTokenSpeed(token) {
        return getTokenSpeedExt(token, { campaignState: vtt.campaignState });
    }
    function getTokenPP(token) {
        return getTokenPPExt(token, { campaignState: vtt.campaignState });
    }
    function getTokenPassiveStats(token) {
        return getTokenPassiveStatsExt(token, { campaignState: vtt.campaignState });
    }
    function isTokenTooltipAllowed(token) {
        return isTokenTooltipAllowedExt(token, {
            activeLayer,
            selectedTokenIds,
            selectedTokenId,
            vtt,
            campaignSettings,
            isTokenControlledByPlayer
        });
    }
    function showGmTokenTooltip(tokenId, force = false) {
        showGmTokenTooltipExt(tokenId, force, {
            tokens,
            activeLayer,
            selectedTokenIds,
            selectedTokenId,
            vtt,
            campaignSettings,
            isTokenControlledByPlayer: (t) => isTokenControlledByPlayer(t),
            campaignState: window.VTT?.campaignState,
            viewport,
            panX,
            panY,
            zoom,
            getTokenDrawDimensions,
            setPendingTokenTooltipId: (id) => {
                tokenTooltipPendingId = id;
                gmTokenTooltipTokenId = id;
            },
            clearTooltipTimeout: () => {
                if (gmTokenTooltipTimeout) {
                    clearTimeout(gmTokenTooltipTimeout);
                    gmTokenTooltipTimeout = null;
                }
                tokenTooltipPendingId = null;
                gmTokenTooltipTokenId = null;
            }
        });
    }
    function _positionGmTooltip(tooltip, token) {
        _positionGmTooltipExt(tooltip, token, { viewport, panX, panY, zoom, getTokenDrawDimensions });
    }
    function hideGmTokenTooltip() {
        hideGmTokenTooltipExt(document, {
            clearTooltipTimeout: () => {
                if (gmTokenTooltipTimeout) {
                    clearTimeout(gmTokenTooltipTimeout);
                    gmTokenTooltipTimeout = null;
                }
                tokenTooltipPendingId = null;
                gmTokenTooltipTokenId = null;
            }
        });
    }

    var interactionToolsContext = {
        get vtt() {
            return vtt;
        },
        get canvasInteraction() {
            return canvasInteraction;
        },
        get viewport() {
            return viewport;
        },
        get panX() {
            return panX;
        },
        set panX(v) {
            panX = v;
        },
        get panY() {
            return panY;
        },
        set panY(v) {
            panY = v;
        },
        get zoom() {
            return zoom;
        },
        set zoom(v) {
            zoom = v;
        },
        get hasPanned() {
            return hasPanned;
        },
        get activeLayer() {
            return activeLayer;
        },
        set activeLayer(v) {
            activeLayer = v;
        },
        get activeTool() {
            return activeTool;
        },
        set activeTool(v) {
            activeTool = v;
        },
        get tokens() {
            return tokens;
        },
        get selectedTokenIds() {
            return selectedTokenIds;
        },
        get selectedTokenId() {
            return selectedTokenId;
        },
        set selectedTokenId(v) {
            selectedTokenId = v;
        },
        get portals() {
            return portals;
        },
        get currentMapId() {
            return currentMapId;
        },
        get localIsMeasuring() {
            return localIsMeasuring;
        },
        get activeDrawingTextarea() {
            return activeDrawingTextarea;
        },
        get polygonPoints() {
            return polygonPoints;
        },
        set polygonPoints(v) {
            polygonPoints = v;
        },
        get currentPaintStroke() {
            return currentPaintStroke;
        },
        set currentPaintStroke(v) {
            currentPaintStroke = v;
        },
        get isDrawingPaint() {
            return isDrawingPaint;
        },
        set isDrawingPaint(v) {
            isDrawingPaint = v;
        },
        cancelCameraAnimation: () => cancelCameraAnimation(),
        updateContainerTransform: () => updateContainerTransform(),
        renderAll: () => renderAll(),
        getCanvasMouseCoords: (e) => getCanvasMouseCoords(e),
        getMapToolItemAtCoord: (x, y) => getMapToolItemAtCoord(x, y),
        isTokenCollidingWithPortal: (tok, p) => isTokenCollidingWithPortal(tok, p),
        selectMapToolItem: (t, id) => selectMapToolItem(t, id),
        showPortalContextMenu: (id, x, y) => showPortalContextMenu(id, x, y),
        showTokenContextMenu: (id, x, y) => showTokenContextMenu(id, x, y),
        showMassRollContextMenu: (...args) => showMassRollContextMenu(...args),
        showShapeContextMenu: (s, x, y) => showShapeContextMenu(s, x, y),
        getPersistentShapeAtPoint: (pt) => getPersistentShapeAtPoint(pt),
        selectShape: (id) => {
            selectedShapeId = id;
            selectedShapeIds.clear();
            if (id) selectedShapeIds.add(id);
        },
        get shapes() {
            return shapes;
        },
        get selectedShapeId() {
            return selectedShapeId;
        },
        set selectedShapeId(v) {
            selectedShapeId = v;
        },
        get selectedShapeIds() {
            return selectedShapeIds;
        },
        get localIsShaping() {
            return localIsShaping;
        },
        get grid() {
            return grid;
        },
        cancelActiveMeasurement: () => cancelActiveMeasurement(),
        showDrawingContextMenu: (x, y) => showDrawingContextMenu(x, y),
        showAddNoteContextMenu: (cx, cy, mx, my) => showAddNoteContextMenu(cx, cy, mx, my),
        commitDrawingTextInput: () => commitDrawingTextInput(),
        cancelMapToolDrawing: () => cancelMapToolDrawing(),
        populateTargetPortalsDropdown: () => populateTargetPortalsDropdown(),
        renderPlacedTrapsList: () => renderPlacedTrapsList(),
        renderPlacedPortalsList: () => renderPlacedPortalsList(),
        setupPaintRibbonControls: () => setupPaintRibbonControls(),
        setupMapToolsControls: () => setupMapToolsControls(),
        clearAllSelections: () => clearAllSelections(),
        getTokenDrawDimensions: (tok) => getTokenDrawDimensions(tok),
        isPointVisible: (x, y) => isPointVisible(x, y)
    };

    function isTokenControlledByPlayer(t, ignorePause = false) {
        return isTokenControlledByPlayerExt(t, ignorePause, { vtt });
    }
    function getTokenAtPoint(m, req = true, match = true, r = 0) {
        return getTokenAtPointExt(m, req, match, r, interactionToolsContext);
    }
    const getSelectionBounds = (s, e) => getSelectionBoundsExt(s, e);
    const isTokenWithinSelection = (t, r) => isTokenWithinSelectionExt(t, r, getTokenDrawDimensions);
    const getNearestHexFeatures = (x, y, g = grid, u = null) => getNearestHexFeaturesExt(x, y, g, u);
    function snapToGrid(x, y, isTok = false) {
        return snapToGridExt(x, y, isTok, grid);
    }
    function snapToGridCenter(x, y) {
        return snapToGridCenterExt(x, y, grid);
    }
    function snapToHalfGrid(x, y) {
        return snapToHalfGridExt(x, y, grid);
    }
    const hideAllToolPanels = () => hideAllToolPanelsExt();
    function setupViewportControls() {
        setupViewportControlsExt(interactionToolsContext);
    }
    function setupToolControls() {
        setupToolControlsExt(interactionToolsContext);
    }
    let switchActiveLayerImpl = null;
    function switchActiveLayer(layer) {
        if (switchActiveLayerImpl) {
            return switchActiveLayerImpl(layer);
        }
        const panel = document.getElementById('panel-layers-config');
        if (panel) {
            panel
                .querySelectorAll('.layer-btn')
                .forEach((b) => b.classList.toggle('active', b.getAttribute('data-layer') === layer));
        }
        activeLayer = layer;
        clearAllSelections();
        updateLayerButtonIcon(layer);
        const lName = (activeLayer || 'token').charAt(0).toUpperCase() + (activeLayer || 'token').slice(1);
        const lEl = document.getElementById('paint-active-layer-name');
        if (lEl) lEl.textContent = `${lName} Layer`;
        renderAll();
    }
    let updateLayerButtonIcon = (layer) => {
        const btn = document.getElementById('btn-layers');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (!icon) return;
        let iconClass = 'fa-solid fa-layer-group';
        let layerName = 'Unknown';
        switch (layer) {
            case 'token':
                iconClass = 'fa-solid fa-users';
                layerName = 'Token';
                break;
            case 'gm':
                iconClass = 'fa-solid fa-eye-slash';
                layerName = 'GM';
                break;
            case 'lighting':
                iconClass = 'fa-solid fa-lightbulb';
                layerName = 'Lighting';
                break;
            case 'map':
                iconClass = 'fa-solid fa-map';
                layerName = 'Map';
                break;
            case 'notes':
                iconClass = 'fa-solid fa-book-journal-whills';
                layerName = 'Notes';
                break;
            case 'portals':
                iconClass = 'fa-solid fa-archway';
                layerName = 'Portals';
                break;
        }
        icon.className = iconClass;
        btn.title = `Switch Layers (Active: ${layerName} Layer)`;
    };
    function setupLayersControls() {
        const res = setupLayersControlsExt(interactionToolsContext);
        if (res?.switchActiveLayer) switchActiveLayerImpl = res.switchActiveLayer;
        if (res?.updateLayerButtonIcon) updateLayerButtonIcon = res.updateLayerButtonIcon;
    }

    function setupLightingPanelControls() {
        const lightingUiState = {
            get currentLightingType() {
                return currentLightingType;
            },
            set currentLightingType(v) {
                currentLightingType = v;
            },
            get currentWallShape() {
                return currentWallShape;
            },
            set currentWallShape(v) {
                currentWallShape = v;
            }
        };
        setupLightingPanelControlsExt(lightingUiState, {
            lights,
            get currentMapId() {
                return currentMapId;
            },
            socket: vtt.socket,
            renderAll,
            getSelectedLightId: () => selectedLightId
        });
    }

    function syncLightPanelWithLight(l) {
        syncLightPanelWithLightExt(l);
    }

    function openNoteViewer(note) {
        openNoteViewerExt(note, { vtt, notes, currentMapId, renderAll });
    }
    function openNoteEditor(note, isNew) {
        openNoteEditorExt(note, isNew, { vtt, notes, currentMapId, renderAll });
    }
    function closeNoteContextMenu() {
        closeNoteContextMenuExt();
    }
    function showNoteContextMenu(noteId, clientX, clientY) {
        showNoteContextMenuExt(noteId, clientX, clientY, {
            notes,
            currentMapId,
            vtt,
            renderAll,
            onDeleteNote: (id) => {
                notes = notes.filter((n) => n.id !== id);
                selectedNoteId = null;
                hoveredNoteId = null;
            }
        });
    }
    function showAddNoteContextMenu(x, y, clientX, clientY) {
        showAddNoteContextMenuExt(x, y, clientX, clientY, { notes, currentMapId, vtt, renderAll });
    }

    function setupInteractionControls() {
        if (!canvasInteraction) return;

        let dragOffsetX = 0;
        let dragOffsetY = 0;

        // Hide stat tooltip when cursor leaves the canvas entirely
        canvasInteraction.addEventListener('mouseleave', () => {
            hideGmTokenTooltip();
        });

        canvasInteraction.addEventListener('dblclick', (e) => {
            const mouse = getCanvasMouseCoords(e);
            if (activeTool === 'select' || activeTool === 'paint') {
                const clickedDrawing = getDrawingAtPoint(mouse, true);
                if (clickedDrawing && clickedDrawing.type === 'text' && isDrawingControlledByPlayer(clickedDrawing)) {
                    e.preventDefault();
                    openDrawingTextInput(clickedDrawing.x, clickedDrawing.y, clickedDrawing);
                    return;
                }
            }
            if (activeTool !== 'select') return;
            const token = getTokenAtPoint(mouse);
            if (token) {
                e.preventDefault();
                openTokenEditModal(token.id);
            }
        });

        canvasInteraction.addEventListener('dblclick', (e) => {
            if (activeTool === 'maptools' || activeTool === 'map-tools') {
                if (currentMapToolShape === 'polygon') {
                    finalizeMapToolPolygon();
                }
                return;
            }
            if (activeTool !== 'select') return;
            const mouse = getCanvasMouseCoords(e);
            let resetId = null;
            selectedTokenIds.forEach((id) => {
                const token = tokens[id];
                if (token && isTokenControlledByPlayer(token)) {
                    const h = getTokenRotationHandlePos(token);
                    if (h) {
                        const dist = Math.hypot(mouse.x - h.x, mouse.y - h.y);
                        if (dist <= 10 / zoom) {
                            resetId = id;
                        }
                    }
                }
            });
            if (resetId) {
                selectedTokenIds.forEach((id) => {
                    if (tokens[id]) tokens[id].rotation = 0;
                });
                if (vtt.socket) window.emitTokenUpdates(tokens);
                renderAll();
            }
        });

        // Check for interactive doors/windows/walls
        const interactionContext = {
            get vtt() {
                return vtt;
            },
            get canvasInteraction() {
                return canvasInteraction;
            },
            get activeTool() {
                return activeTool;
            },
            set activeTool(v) {
                activeTool = v;
            },
            get activeLayer() {
                return activeLayer;
            },
            set activeLayer(v) {
                activeLayer = v;
            },
            get currentMapId() {
                return currentMapId;
            },
            get grid() {
                return grid;
            },
            get zoom() {
                return zoom;
            },
            set zoom(v) {
                zoom = v;
            },
            get panX() {
                return panX;
            },
            set panX(v) {
                panX = v;
            },
            get panY() {
                return panY;
            },
            set panY(v) {
                panY = v;
            },
            get isPanning() {
                return isPanning;
            },
            set isPanning(v) {
                isPanning = v;
            },
            get hasPanned() {
                return hasPanned;
            },
            set hasPanned(v) {
                hasPanned = v;
            },
            get dragTargetId() {
                return dragTargetId;
            },
            set dragTargetId(v) {
                dragTargetId = v;
            },
            get dragOffsetX() {
                return dragOffsetX;
            },
            set dragOffsetX(v) {
                dragOffsetX = v;
            },
            get dragOffsetY() {
                return dragOffsetY;
            },
            set dragOffsetY(v) {
                dragOffsetY = v;
            },
            get tokenDragOriginalPositions() {
                return tokenDragOriginalPositions;
            },
            set tokenDragOriginalPositions(v) {
                tokenDragOriginalPositions = v;
            },
            get selectedTokenIds() {
                return selectedTokenIds;
            },
            set selectedTokenIds(v) {
                selectedTokenIds = v;
            },
            get selectedTokenId() {
                return selectedTokenId;
            },
            set selectedTokenId(v) {
                selectedTokenId = v;
            },
            get tokens() {
                return tokens;
            },
            set tokens(v) {
                tokens = v;
            },
            get walls() {
                return walls;
            },
            set walls(v) {
                walls = v;
                syncWallSpatialIndex();
            },
            get selectedWallIdx() {
                return selectedWallIdx;
            },
            set selectedWallIdx(v) {
                selectedWallIdx = v;
            },
            get selectedWallIdxs() {
                return selectedWallIdxs;
            },
            set selectedWallIdxs(v) {
                selectedWallIdxs = v;
            },
            get hoveredWallIdx() {
                return hoveredWallIdx;
            },
            set hoveredWallIdx(v) {
                hoveredWallIdx = v;
            },
            get hoveredWallVertex() {
                return hoveredWallVertex;
            },
            set hoveredWallVertex(v) {
                hoveredWallVertex = v;
            },
            get isDrawingWall() {
                return isDrawingWall;
            },
            set isDrawingWall(v) {
                isDrawingWall = v;
            },
            get wallStartPoint() {
                return wallStartPoint;
            },
            set wallStartPoint(v) {
                wallStartPoint = v;
            },
            get lights() {
                return lights;
            },
            set lights(v) {
                lights = v;
            },
            get selectedLightId() {
                return selectedLightId;
            },
            set selectedLightId(v) {
                selectedLightId = v;
            },
            get hoveredLightId() {
                return hoveredLightId;
            },
            set hoveredLightId(v) {
                hoveredLightId = v;
            },
            get isRotatingLight() {
                return isRotatingLight;
            },
            set isRotatingLight(v) {
                isRotatingLight = v;
            },
            get rotatingLightEntity() {
                return rotatingLightEntity;
            },
            set rotatingLightEntity(v) {
                rotatingLightEntity = v;
            },
            get notes() {
                return notes;
            },
            set notes(v) {
                notes = v;
            },
            get selectedNoteId() {
                return selectedNoteId;
            },
            set selectedNoteId(v) {
                selectedNoteId = v;
            },
            get hoveredNoteId() {
                return hoveredNoteId;
            },
            set hoveredNoteId(v) {
                hoveredNoteId = v;
            },
            get shapes() {
                return shapes;
            },
            set shapes(v) {
                shapes = v;
            },
            get selectedShapeId() {
                return selectedShapeId;
            },
            set selectedShapeId(v) {
                selectedShapeId = v;
            },
            get selectedShapeIds() {
                return selectedShapeIds;
            },
            set selectedShapeIds(v) {
                selectedShapeIds = v;
            },
            get selectedShapeComponent() {
                return selectedShapeComponent;
            },
            set selectedShapeComponent(v) {
                selectedShapeComponent = v;
            },
            get hoveredShapeComponent() {
                return hoveredShapeComponent;
            },
            set hoveredShapeComponent(v) {
                hoveredShapeComponent = v;
            },
            get drawings() {
                return drawings;
            },
            set drawings(v) {
                drawings = v;
            },
            get selectedDrawingId() {
                return selectedDrawingId;
            },
            set selectedDrawingId(v) {
                selectedDrawingId = v;
            },
            get selectedDrawingIds() {
                return selectedDrawingIds;
            },
            set selectedDrawingIds(v) {
                selectedDrawingIds = v;
            },
            get isDrawingPaint() {
                return isDrawingPaint;
            },
            set isDrawingPaint(v) {
                isDrawingPaint = v;
            },
            get currentPaintStroke() {
                return currentPaintStroke;
            },
            set currentPaintStroke(v) {
                currentPaintStroke = v;
            },
            get polygonPoints() {
                return polygonPoints;
            },
            set polygonPoints(v) {
                polygonPoints = v;
            },
            get isBoxSelecting() {
                return isBoxSelecting;
            },
            set isBoxSelecting(v) {
                isBoxSelecting = v;
            },
            get boxSelectStart() {
                return boxSelectStart;
            },
            set boxSelectStart(v) {
                boxSelectStart = v;
            },
            get boxSelectEnd() {
                return boxSelectEnd;
            },
            set boxSelectEnd(v) {
                boxSelectEnd = v;
            },
            get currentMouseCoords() {
                return currentMouseCoords;
            },
            set currentMouseCoords(v) {
                currentMouseCoords = v;
            },
            get tokenAnimations() {
                return tokenAnimations;
            },
            get tokenDragInitialPoint() {
                return tokenDragInitialPoint;
            },
            set tokenDragInitialPoint(v) {
                tokenDragInitialPoint = v;
            },
            get tokenDragMeasureActive() {
                return tokenDragMeasureActive;
            },
            set tokenDragMeasureActive(v) {
                tokenDragMeasureActive = v;
            },
            get activeDragShapeId() {
                return activeDragShapeId;
            },
            set activeDragShapeId(v) {
                activeDragShapeId = v;
            },
            get activeDragShapeComponent() {
                return activeDragShapeComponent;
            },
            set activeDragShapeComponent(v) {
                activeDragShapeComponent = v;
            },
            get shapeComponentDragStart() {
                return shapeComponentDragStart;
            },
            set shapeComponentDragStart(v) {
                shapeComponentDragStart = v;
            },
            get shapeDragOffsetX() {
                return shapeDragOffsetX;
            },
            set shapeDragOffsetX(v) {
                shapeDragOffsetX = v;
            },
            get shapeDragOffsetY() {
                return shapeDragOffsetY;
            },
            set shapeDragOffsetY(v) {
                shapeDragOffsetY = v;
            },
            get shapeComponentDragOriginalPoints() {
                return shapeComponentDragOriginalPoints;
            },
            set shapeComponentDragOriginalPoints(v) {
                shapeComponentDragOriginalPoints = v;
            },
            get shapeDragOffsetX1() {
                return shapeDragOffsetX1;
            },
            set shapeDragOffsetX1(v) {
                shapeDragOffsetX1 = v;
            },
            get shapeDragOffsetY1() {
                return shapeDragOffsetY1;
            },
            set shapeDragOffsetY1(v) {
                shapeDragOffsetY1 = v;
            },
            get shapeDragOffsetX2() {
                return shapeDragOffsetX2;
            },
            set shapeDragOffsetX2(v) {
                shapeDragOffsetX2 = v;
            },
            get shapeDragOffsetY2() {
                return shapeDragOffsetY2;
            },
            set shapeDragOffsetY2(v) {
                shapeDragOffsetY2 = v;
            },
            get activeDragDrawingId() {
                return activeDragDrawingId;
            },
            set activeDragDrawingId(v) {
                activeDragDrawingId = v;
            },
            get drawingDragOffsetX() {
                return drawingDragOffsetX;
            },
            set drawingDragOffsetX(v) {
                drawingDragOffsetX = v;
            },
            get drawingDragOffsetY() {
                return drawingDragOffsetY;
            },
            set drawingDragOffsetY(v) {
                drawingDragOffsetY = v;
            },
            get drawingDragOriginalPoints() {
                return drawingDragOriginalPoints;
            },
            set drawingDragOriginalPoints(v) {
                drawingDragOriginalPoints = v;
            },
            get activeResizeDrawing() {
                return activeResizeDrawing;
            },
            set activeResizeDrawing(v) {
                activeResizeDrawing = v;
            },
            get activeDragWallSegmentIdx() {
                return activeDragWallSegmentIdx;
            },
            set activeDragWallSegmentIdx(v) {
                activeDragWallSegmentIdx = v;
            },
            get activeDragWallVertex() {
                return activeDragWallVertex;
            },
            set activeDragWallVertex(v) {
                activeDragWallVertex = v;
            },
            get wallDragOffset() {
                return wallDragOffset;
            },
            set wallDragOffset(v) {
                wallDragOffset = v;
            },
            get activeDragLightId() {
                return activeDragLightId;
            },
            set activeDragLightId(v) {
                activeDragLightId = v;
            },
            get lightDragOffsetX() {
                return lightDragOffsetX;
            },
            set lightDragOffsetX(v) {
                lightDragOffsetX = v;
            },
            get lightDragOffsetY() {
                return lightDragOffsetY;
            },
            set lightDragOffsetY(v) {
                lightDragOffsetY = v;
            },
            get activeDragNoteId() {
                return activeDragNoteId;
            },
            set activeDragNoteId(v) {
                activeDragNoteId = v;
            },
            get noteDragOffsetX() {
                return noteDragOffsetX;
            },
            set noteDragOffsetX(v) {
                noteDragOffsetX = v;
            },
            get noteDragOffsetY() {
                return noteDragOffsetY;
            },
            set noteDragOffsetY(v) {
                noteDragOffsetY = v;
            },
            get hoverTokenId() {
                return hoverTokenId;
            },
            set hoverTokenId(v) {
                hoverTokenId = v;
            },
            get hoverTokenTimeout() {
                return hoverTokenTimeout;
            },
            set hoverTokenTimeout(v) {
                hoverTokenTimeout = v;
            },
            get activeDragTokenId() {
                return activeDragTokenId;
            },
            set activeDragTokenId(v) {
                activeDragTokenId = v;
            },
            get tokenDragOriginalPos() {
                return tokenDragOriginalPos;
            },
            set tokenDragOriginalPos(v) {
                tokenDragOriginalPos = v;
            },
            get paintUndoStack() {
                return paintUndoStack;
            },
            set paintUndoStack(v) {
                paintUndoStack = v;
            },
            get paintRedoStack() {
                return paintRedoStack;
            },
            set paintRedoStack(v) {
                paintRedoStack = v;
            },
            get paintSubTool() {
                return paintSubTool;
            },
            set paintSubTool(v) {
                paintSubTool = v;
            },
            get paintStrokeColor() {
                return paintStrokeColor;
            },
            set paintStrokeColor(v) {
                paintStrokeColor = v;
            },
            get paintFillColor() {
                return paintFillColor;
            },
            set paintFillColor(v) {
                paintFillColor = v;
            },
            get paintFillMode() {
                return paintFillMode;
            },
            set paintFillMode(v) {
                paintFillMode = v;
            },
            get paintStrokeWidth() {
                return paintStrokeWidth;
            },
            set paintStrokeWidth(v) {
                paintStrokeWidth = v;
            },
            get paintGridSnap() {
                return paintGridSnap;
            },
            set paintGridSnap(v) {
                paintGridSnap = v;
            },
            get loadedImages() {
                return vttImageCache;
            },
            get imageCache() {
                return vttImageCache;
            },
            get lifecycle() {
                return lifecycle;
            },
            get mapAssetPrecache() {
                return mapAssetPrecache;
            },
            get scratchLightCanvas() {
                return scratchLightCanvas;
            },
            get ctxScratchLight() {
                return ctxScratchLight;
            },
            get offDrawingCanvas() {
                return offDrawingCanvas;
            },
            get offDrawingCtx() {
                return offDrawingCtx;
            },
            get currentLightingType() {
                return currentLightingType;
            },
            set currentLightingType(v) {
                currentLightingType = v;
            },
            get currentWallShape() {
                return currentWallShape;
            },
            set currentWallShape(v) {
                currentWallShape = v;
            },
            get activeMapToolSubmode() {
                return activeMapToolSubmode;
            },
            set activeMapToolSubmode(v) {
                activeMapToolSubmode = v;
            },
            get selectedMapToolItem() {
                return selectedMapToolItem;
            },
            set selectedMapToolItem(v) {
                selectedMapToolItem = v;
            },
            get currentMapToolPolyPts() {
                return currentMapToolPolyPts;
            },
            set currentMapToolPolyPts(v) {
                currentMapToolPolyPts = v;
            },
            get mapToolDrawStart() {
                return mapToolDrawStart;
            },
            set mapToolDrawStart(v) {
                mapToolDrawStart = v;
            },
            get mapToolDrawCurrent() {
                return mapToolDrawCurrent;
            },
            set mapToolDrawCurrent(v) {
                mapToolDrawCurrent = v;
            },
            get mapToolDragStart() {
                return mapToolDragStart;
            },
            set mapToolDragStart(v) {
                mapToolDragStart = v;
            },
            get activeDragMapToolItem() {
                return activeDragMapToolItem;
            },
            set activeDragMapToolItem(v) {
                activeDragMapToolItem = v;
            },
            get activeResizeMapToolHandle() {
                return activeResizeMapToolHandle;
            },
            set activeResizeMapToolHandle(v) {
                activeResizeMapToolHandle = v;
            },
            get activeRotatePortalId() {
                return activeRotatePortalId;
            },
            set activeRotatePortalId(v) {
                activeRotatePortalId = v;
            },
            get hoveredMapToolHandle() {
                return hoveredMapToolHandle;
            },
            set hoveredMapToolHandle(v) {
                hoveredMapToolHandle = v;
            },
            renderAll: () => renderAll(),
            panTo: (...args) => panTo(...args),
            getCanvasMouseCoords: (e) => getCanvasMouseCoords(e),
            getNoteAtCoord: (...args) => getNoteAtCoord(...args),
            getWallVertexAtCoord: (...args) => getWallVertexAtCoord(...args),
            getWallSegmentAtCoord: (...args) => getWallSegmentAtCoord(...args),
            getLightAtCoord: (...args) => getLightAtCoord(...args),
            isPointVisible: (...args) => isPointVisible(...args),
            snapToGrid: (...args) => snapToGrid(...args),
            snapToGridCenter: (...args) => snapToGridCenter(...args),
            snapToHalfGrid: (...args) => snapToHalfGrid(...args),
            getTokenAtPoint: (...args) => getTokenAtPoint(...args),
            isTokenControlledByPlayer: (...args) => isTokenControlledByPlayer(...args),
            isShapeControlledByPlayer: (...args) => isShapeControlledByPlayer(...args),
            isDrawingControlledByPlayer: (...args) => isDrawingControlledByPlayer(...args),
            getMapToolItemAtCoord: (...args) => getMapToolItemAtCoord(...args),
            selectMapToolItem: (...args) => selectMapToolItem(...args),
            handleMapToolMouseDown: (...args) => handleMapToolMouseDown(...args),
            handleMapToolMouseMove: (...args) => handleMapToolMouseMove(...args),
            handleMapToolMouseUp: (...args) => handleMapToolMouseUp(...args),
            showTokenContextMenu: (...args) => showTokenContextMenu(...args),
            openTokenConfigModal: (id) => openTokenEditModal(id),
            showShapeContextMenu: (...args) => showShapeContextMenu(...args),
            showDrawingContextMenu: (...args) => showDrawingContextMenu(...args),
            openDrawingTextInput: (...args) => openDrawingTextInput(...args),
            showNoteContextMenu: (...args) => showNoteContextMenu(...args),
            showAddNoteContextMenu: (...args) => showAddNoteContextMenu(...args),
            openNoteViewer: (...args) => openNoteViewer(...args),
            openNoteEditor: (...args) => openNoteEditor(...args),
            openWallSettingsModal: (...args) => openWallSettingsModal(...args),
            showDoorSettingsModal: (...args) => showDoorSettingsModalExt(...args),
            showWindowSettingsModal: (...args) => showWindowSettingsModalExt(...args),
            showWallSettingsModal: (...args) => showWallSettingsModalExt(...args),
            closeAnyWallModal: () => closeAnyWallModal(),
            updateContainerTransform: () => updateContainerTransform(),
            updateCoordinateDisplay: (coords) => updateCoordinateDisplay(coords),
            cancelCameraAnimation: () => cancelCameraAnimation(),
            get traps() {
                return traps;
            },
            set traps(v) {
                traps = v;
            },
            get portals() {
                return portals;
            },
            set portals(v) {
                portals = v;
            },
            get tokenPortalDebounce() {
                return tokenPortalDebounce;
            },
            get tokenInsidePortals() {
                return tokenInsidePortals;
            },
            getPortalHandleUnderMouse: (...args) => getPortalHandleUnderMouse(...args),
            getPortalRotationHandlePos: (...args) => getPortalRotationHandlePos(...args),
            isTokenCollidingWithPortal: (...args) => isTokenCollidingWithPortal(...args),
            checkOneWayPortalEntry: (...args) => checkOneWayPortalEntry(...args),
            calcSpatialPortalDestination: (...args) => calcSpatialPortalDestination(...args),
            get lastBroadcastedTokens() {
                return lastBroadcastedTokens;
            },
            set lastBroadcastedTokens(v) {
                lastBroadcastedTokens = v;
            },
            applyDrawingResize: (...args) => applyDrawingResize(...args),
            getDrawingResizeHandleAtPoint: (...args) => getDrawingResizeHandleAtPoint(...args),
            getDrawingAtPoint: (...args) => getDrawingAtPoint(...args),
            eraseDrawingsAtPoint: (...args) => eraseDrawingsAtPoint(...args),
            performCanvasFloodFill: (...args) => performCanvasFloodFill(...args),
            getShapeComponentAtCoord: (...args) => getShapeComponentAtCoord(...args),
            getPersistentShapeAtPoint: (...args) => getPersistentShapeAtPoint(...args),
            checkTokenMoveTriggers: (...args) => checkTokenMoveTriggers(...args),
            processTokenAnimReqs: (...args) => processTokenAnimReqs(...args),
            calcDistanceFormatted: (...args) => calcDistanceFormatted(...args),
            triggerPingAnimation: (...args) => triggerPingAnimation(...args),
            getWallCoordinatesForRaycasting: (...args) => getWallCoordinatesForRaycasting(...args),
            getTokenDrawDimensions: (...args) => getTokenDrawDimensions(...args),
            getTokenResizeHandles: (...args) => getTokenResizeHandles(...args),
            getTokenResizeHandleAt: (...args) => getTokenResizeHandleAt(...args),
            getTokenResizeHandlePos: (...args) => getTokenResizeHandlePos(...args),
            applyTokenResize: (...args) => applyTokenResizeExt(...args),
            emitTokenUpdates: (...args) => window.emitTokenUpdates(...args),
            emitDrawingsUpdate: () => emitDrawingsUpdate(),
            cancelActiveMeasurement: () => cancelActiveMeasurement(),
            clearAllSelections: () => clearAllSelections(),
            get localIsMeasuring() {
                return localIsMeasuring;
            },
            set localIsMeasuring(v) {
                localIsMeasuring = v;
            },
            get isTokenMeasuring() {
                return isTokenMeasuring;
            },
            set isTokenMeasuring(v) {
                isTokenMeasuring = v;
            },
            get localIsShaping() {
                return localIsShaping;
            },
            set localIsShaping(v) {
                localIsShaping = v;
            },
            get localMeasureStart() {
                return localMeasureStart;
            },
            set localMeasureStart(v) {
                localMeasureStart = v;
            },
            get localMeasureEnd() {
                return localMeasureEnd;
            },
            set localMeasureEnd(v) {
                localMeasureEnd = v;
            },
            get localShapeStart() {
                return localShapeStart;
            },
            set localShapeStart(v) {
                localShapeStart = v;
            },
            get localShapeEnd() {
                return localShapeEnd;
            },
            set localShapeEnd(v) {
                localShapeEnd = v;
            },
            get measureAnchorPoints() {
                return measureAnchorPoints;
            },
            set measureAnchorPoints(v) {
                measureAnchorPoints = v;
            },
            emitMeasureUpdateThrottled: (...args) => emitMeasureUpdateThrottled(...args),
            setZoom: (...args) => setZoom(...args),
            getTokenCenter: (t) => getTokenCenter(t),
            showGmTokenTooltip: (tokenId, force) => showGmTokenTooltip(tokenId, force),
            hideGmTokenTooltip: () => hideGmTokenTooltip(),
            isTokenTooltipAllowed: (token) => isTokenTooltipAllowed(token)
        };

        setupPointerInteractionExt(interactionContext);

        const clipboardContext = {
            get vtt() {
                return vtt;
            },
            get currentMapId() {
                return currentMapId;
            },
            get panX() {
                return panX;
            },
            set panX(v) {
                panX = v;
            },
            get panY() {
                return panY;
            },
            set panY(v) {
                panY = v;
            },
            get activeTool() {
                return activeTool;
            },
            set activeTool(v) {
                activeTool = v;
            },
            get dragTargetId() {
                return dragTargetId;
            },
            set dragTargetId(v) {
                dragTargetId = v;
            },
            get portals() {
                return portals;
            },
            get hoveredWallIdx() {
                return hoveredWallIdx;
            },
            set hoveredWallIdx(v) {
                hoveredWallIdx = v;
            },
            get hoveredNoteId() {
                return hoveredNoteId;
            },
            set hoveredNoteId(v) {
                hoveredNoteId = v;
            },
            get gmTokenVisionMode() {
                return gmTokenVisionMode;
            },
            set gmTokenVisionMode(v) {
                gmTokenVisionMode = v;
            },
            get localIsMeasuring() {
                return localIsMeasuring;
            },
            set localIsMeasuring(v) {
                localIsMeasuring = v;
            },
            get isTokenMeasuring() {
                return isTokenMeasuring;
            },
            set isTokenMeasuring(v) {
                isTokenMeasuring = v;
            },
            get localIsShaping() {
                return localIsShaping;
            },
            set localIsShaping(v) {
                localIsShaping = v;
            },
            get localMeasureStart() {
                return localMeasureStart;
            },
            set localMeasureStart(v) {
                localMeasureStart = v;
            },
            get localMeasureEnd() {
                return localMeasureEnd;
            },
            set localMeasureEnd(v) {
                localMeasureEnd = v;
            },
            get localShapeStart() {
                return localShapeStart;
            },
            set localShapeStart(v) {
                localShapeStart = v;
            },
            get localShapeEnd() {
                return localShapeEnd;
            },
            set localShapeEnd(v) {
                localShapeEnd = v;
            },
            get measureAnchorPoints() {
                return measureAnchorPoints;
            },
            set measureAnchorPoints(v) {
                measureAnchorPoints = v;
            },
            updateContainerTransform: () => updateContainerTransform(),
            cancelCameraAnimation: () => cancelCameraAnimation(),
            getTokenDrawDimensions: (t) => getTokenDrawDimensions(t),
            cancelMapToolDrawing: () => cancelMapToolDrawing(),
            snapToGridCenter: (x, y) => snapToGridCenter(x, y),
            emitTokenUpdates: (...args) => window.emitTokenUpdates(...args),
            get tokens() {
                return tokens;
            },
            set tokens(v) {
                tokens = v;
            },
            get selectedTokenIds() {
                return selectedTokenIds;
            },
            set selectedTokenIds(v) {
                selectedTokenIds = v;
            },
            get selectedTokenId() {
                return selectedTokenId;
            },
            set selectedTokenId(v) {
                selectedTokenId = v;
            },
            get tokenDragOriginalPositions() {
                return tokenDragOriginalPositions;
            },
            set tokenDragOriginalPositions(v) {
                tokenDragOriginalPositions = v;
            },
            isTokenControlledByPlayer: (t) => isTokenControlledByPlayer(t),
            get shapes() {
                return shapes;
            },
            set shapes(v) {
                shapes = v;
            },
            get selectedShapeIds() {
                return selectedShapeIds;
            },
            set selectedShapeIds(v) {
                selectedShapeIds = v;
            },
            get selectedShapeId() {
                return selectedShapeId;
            },
            set selectedShapeId(v) {
                selectedShapeId = v;
            },
            get selectedShapeComponent() {
                return selectedShapeComponent;
            },
            set selectedShapeComponent(v) {
                selectedShapeComponent = v;
            },
            isShapeControlledByPlayer: (s) => isShapeControlledByPlayer(s),
            get walls() {
                return walls;
            },
            set walls(v) {
                walls = v;
                syncWallSpatialIndex();
            },
            get selectedWallIdxs() {
                return selectedWallIdxs;
            },
            set selectedWallIdxs(v) {
                selectedWallIdxs = v;
            },
            get selectedWallIdx() {
                return selectedWallIdx;
            },
            set selectedWallIdx(v) {
                selectedWallIdx = v;
            },
            get lights() {
                return lights;
            },
            set lights(v) {
                lights = v;
            },
            get selectedLightId() {
                return selectedLightId;
            },
            set selectedLightId(v) {
                selectedLightId = v;
            },
            get hoveredLightId() {
                return hoveredLightId;
            },
            set hoveredLightId(v) {
                hoveredLightId = v;
            },
            get notes() {
                return notes;
            },
            set notes(v) {
                notes = v;
            },
            get selectedNoteId() {
                return selectedNoteId;
            },
            set selectedNoteId(v) {
                selectedNoteId = v;
            },
            get drawings() {
                return drawings;
            },
            set drawings(v) {
                drawings = v;
            },
            get selectedDrawingIds() {
                return selectedDrawingIds;
            },
            set selectedDrawingIds(v) {
                selectedDrawingIds = v;
            },
            get selectedDrawingId() {
                return selectedDrawingId;
            },
            set selectedDrawingId(v) {
                selectedDrawingId = v;
            },
            isDrawingControlledByPlayer: (d) => isDrawingControlledByPlayer(d),
            get paintUndoStack() {
                return paintUndoStack;
            },
            set paintUndoStack(v) {
                paintUndoStack = v;
            },
            get paintRedoStack() {
                return paintRedoStack;
            },
            set paintRedoStack(v) {
                paintRedoStack = v;
            },
            get paintSubTool() {
                return paintSubTool;
            },
            set paintSubTool(v) {
                paintSubTool = v;
            },
            get paintStrokeColor() {
                return paintStrokeColor;
            },
            set paintStrokeColor(v) {
                paintStrokeColor = v;
            },
            get paintFillColor() {
                return paintFillColor;
            },
            set paintFillColor(v) {
                paintFillColor = v;
            },
            get paintFillMode() {
                return paintFillMode;
            },
            set paintFillMode(v) {
                paintFillMode = v;
            },
            get paintStrokeWidth() {
                return paintStrokeWidth;
            },
            set paintStrokeWidth(v) {
                paintStrokeWidth = v;
            },
            get paintGridSnap() {
                return paintGridSnap;
            },
            set paintGridSnap(v) {
                paintGridSnap = v;
            },
            emitDrawingsUpdate: () => emitDrawingsUpdate(),
            get vttClipboard() {
                return vttClipboard;
            },
            set vttClipboard(v) {
                vttClipboard = v;
            },
            get currentMouseCoords() {
                return currentMouseCoords;
            },
            get isDrawingMapTool() {
                return isDrawingMapTool;
            },
            get currentMapToolShape() {
                return currentMapToolShape;
            },
            set currentMapToolShape(v) {
                currentMapToolShape = v;
            },
            finalizeMapToolPolygon: () => finalizeMapToolPolygon(),
            switchActiveLayer: (l) => switchActiveLayer(l),
            get activeLayer() {
                return activeLayer;
            },
            set activeLayer(v) {
                activeLayer = v;
            },
            broadcastViewToPlayers: () => broadcastViewToPlayers(),
            centerOnTokenOrMap: () => centerOnTokenOrMap(),
            stepZoom: (z) => stepZoom(z),
            renderAll: () => renderAll(),
            get grid() {
                return grid;
            },
            checkTokenMoveTriggers: (t, o) => checkTokenMoveTriggers(t, o),
            get tokenAnimations() {
                return tokenAnimations;
            },
            processTokenAnimReqs: (t) => processTokenAnimReqs(t),
            cleanupYouTubePingPongForId: (id) => cleanupYouTubePingPongForId(id),
            paintUndo: () => paintUndo(),
            paintRedo: () => paintRedo(),
            isSplashOverlayOpen: () => isSplashOverlayOpen(),
            closeSplashOverlay: () => closeSplashOverlay(),
            triggerSplashForSelection: () => triggerSplashForSelection(),
            cancelDrawingTextInput: () => cancelDrawingTextInput(),
            get activeDrawingTextarea() {
                return activeDrawingTextarea;
            },
            set activeDrawingTextarea(v) {
                activeDrawingTextarea = v;
            }
        };

        const { deleteSelection, copySelectionToClipboard, pasteClipboard } =
            setupKeyboardShortcutsExt(clipboardContext);
    }

    // Setup interactive drawing/action layers (Pointer events, pan, select, drag)
    try {
        setupInteractionControls();
    } catch (e) {
        console.error('[VTT Canvas] Critical error initializing pointer interaction controls:', e);
    }

    // Connect WebSockets
    try {
        setupSocketSync();
    } catch (e) {
        console.warn('[VTT Canvas] Notice initializing socket sync:', e);
    }

    // Setup viewport mouse & wheel pan/zoom
    try {
        setupViewportControls();
        setupZoomHudControls();
    } catch (e) {
        console.warn('[VTT Canvas] Notice initializing viewport controls:', e);
    }

    // Setup toolbar tool listeners
    try {
        setupToolControls();
    } catch (e) {
        console.warn('[VTT Canvas] Notice initializing tool controls:', e);
    }

    // Setup tabletop layers listeners
    if (vtt.role === 'GM') {
        try {
            setupLayersControls();
        } catch (e) {
            console.warn('[VTT Canvas] Notice initializing layers controls:', e);
        }
    }

    // Setup modals, panels, and settings safely
    try {
        setupEditMapModal();
        setupMapUploadControls();
        setupPushPlayersModal();
        setupTokenLocatorPanel();
        setupTokenEditModal();
        setupMeasurePanelControls();
        setupLightingPanelControls();
    } catch (e) {
        console.warn('[VTT Canvas] Notice initializing modals and tools:', e);
    }

    try {
        if (vtt.role === 'GM') {
            setupHpSettingsControls();
            setupGmTokenSettingsControls();
        }
        syncHpSettingsInputs();
        setupSettingsAccordionBehavior();
        setupPlayerTokenSettingsControls();
        syncPlayerTokenSettingsUI();
        if (vtt.role === 'GM') {
            syncGmTokenSettingsUI();
        }
    } catch (e) {
        console.warn('[VTT Canvas] Notice initializing token/HP preferences:', e);
    }

    // Load initial VTT states and active map
    if (vtt.campaignState) {
        if (vtt.campaignState.settings) {
            campaignSettings = { ...campaignSettings, ...vtt.campaignState.settings };
        }

        if (vtt.campaignState.maps) {
            const targetMapId =
                vtt.role === 'GM'
                    ? vtt.campaignState.activeGMMapId || vtt.campaignState.activeMapId
                    : getPlayerMapOverride(vtt.campaignState, vtt.username) || vtt.campaignState.activeMapId;
            loadMap(targetMapId);
        } else {
            // Legacy backward-compatible fallback
            if (vtt.campaignState.mapImage) {
                setMapBackground(vtt.campaignState.mapImage);
            }
            if (vtt.campaignState.grid) {
                grid = vtt.campaignState.grid;
                syncGridConfigInputs();
            }
            if (vtt.campaignState.walls) {
                walls = vtt.campaignState.walls;
                walls.forEach((w) => {
                    if (w.type === undefined) {
                        w.type = w.isDoor ? 'door' : 'wall';
                    }
                });
                syncWallSpatialIndex();
            }
            if (vtt.campaignState.tokens) {
                tokens = vtt.campaignState.tokens;
            }
            if (vtt.campaignState.shapes) {
                shapes = vtt.campaignState.shapes;
            }
            if (vtt.campaignState.drawings) {
                drawings = vtt.campaignState.drawings;
            }
        }
    }

    // Initial render
    setTimeout(() => {
        renderAll();
        updateContainerTransform();
        updateCoordinateDisplay(currentMouseCoords);
    }, 500);

    // Initial render & Visual FX trigger
    requestVisualFxUpdate();

    return engine;
}
