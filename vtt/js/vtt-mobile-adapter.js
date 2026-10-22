/**
 * ============================================================================
 * ForgeD VTT - Mobile & Touch Interaction Adapter (vtt-mobile-adapter.js)
 * ============================================================================
 * Bridges touch events (pinch-to-zoom, 2-finger pan, smart 1-finger pan on
 * empty canvas, 1-finger token dragging, long-press context menu, double-tap
 * sheet opening) to the tabletop canvas engine without modifying desktop mouse
 * behaviors. Manages the mobile bottom navigation bar, floating tool palette
 * FAB, full-screen drawer overlays, and token context menu touch accordions.
 * ============================================================================
 */

export function initVttMobileAdapter(vtt) {
    // Detect if device supports touch/coarse pointer input (phones, iPads, tablets, touchscreens)
    const isTouchDevice = () => {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    };

    // Support user manual preference: 'true' (force mobile), 'false' (force desktop), or null (auto)
    // Phone UI layout (bottom nav, full drawer overlays) applies when forced, on narrow screens (<= 900px), or coarse touch devices (<= 1366px)
    const isMobileViewport = () => {
        const forced = localStorage.getItem('vtt_force_mobile_ui');
        if (forced === 'true') return true;
        if (forced === 'false') return false;
        return window.innerWidth <= 900 || ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) && window.innerWidth <= 1366);
    };

    // Universal touch gestures (pan, pinch-to-zoom, hold-drag) work on any touch-capable screen
    const isTouchSupported = () => isTouchDevice() || isMobileViewport();

    // Apply document-level override class on initial load
    const forcedMode = localStorage.getItem('vtt_force_mobile_ui');
    if (forcedMode === 'false') {
        document.documentElement.classList.add('force-desktop-ui');
        document.documentElement.classList.remove('force-mobile-ui');
    } else if (forcedMode === 'true') {
        document.documentElement.classList.add('force-mobile-ui');
        document.documentElement.classList.remove('force-desktop-ui');
    }

    let activeNavTab = 'map';
    let longPressTimer = null;
    let tokenHoldDragTimer = null;
    let didLongPress = false;
    let isTokenDragEngaged = false;
    let lastTapInfo = { time: 0, x: 0, y: 0 };
    let initialPinchDist = 0;
    let lastPinchMid = null;
    let isPinching = false;
    let isSingleTouching = false;
    let is1FingerPanning = false;
    let isDragCancelled = false;
    let activeTouchedToken = null;
    let touchMoveDist = 0;
    let panStartPos = { x: 0, y: 0 };
    let touchStartPos = { x: 0, y: 0 };
    let resizeDebounce = null;

    // Mobile Phase 1 State
    let isTapToPlaceActive = false;
    let pendingPlacementPayload = null;
    let updateFloatingCombatPillFn = null;

    // Mobile Phase 2 State
    let currentRadialToken = null;
    let isEcoModeActive = false;
    let previousWeatherQuality = 'high';

    // DOM references
    const canvasInteraction = document.getElementById('vtt-canvas-interaction');
    const mobileNav = document.getElementById('vtt-mobile-nav');
    const mobileFab = document.getElementById('vtt-mobile-tools-fab');
    const mobileToolsMenu = document.getElementById('vtt-mobile-tools-menu');
    const mobileBackdrop = document.getElementById('vtt-mobile-backdrop');
    const mobileShapePill = document.getElementById('vtt-mobile-shape-pill');
    const mobileShapeSheet = document.getElementById('vtt-mobile-shape-sheet');
    const mobileDragPill = document.getElementById('vtt-mobile-drag-pill');
    const mobileTokenActions = document.getElementById('vtt-mobile-token-actions');
    const mobileRadialDial = document.getElementById('vtt-mobile-radial-dial');
    const mobileSheetCarousel = document.getElementById('vtt-mobile-sheet-carousel');
    const mobileSheetTrack = document.getElementById('vtt-mobile-sheet-track');
    const mobileFabEcoBadge = document.getElementById('mobile-fab-eco-badge');
    const mobileToolEco = document.getElementById('mobile-tool-eco');
    const mobilePlacementBanner = document.getElementById('vtt-mobile-placement-banner');
    const mobileCombatPill = document.getElementById('vtt-mobile-combat-pill');
    const mobileMaptoolsSheet = document.getElementById('vtt-mobile-maptools-sheet');
    const sidebar = document.getElementById('vtt-sidebar');
    const playerSheetPanel = document.getElementById('player-sheet-panel');
    const creatureSheetPanel = document.getElementById('creature-sheet-panel');
    const initContainer = document.getElementById('vtt-initiative-carousel-container');

    // ========================================================================
    // 1. CANVAS TOUCH & GESTURE SUBSYSTEM (WITH SMART 1-FINGER PANNING)
    // ========================================================================
    function setupCanvasTouchGestures() {
        if (!canvasInteraction) return;

        canvasInteraction.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: false });
        window.addEventListener('touchcancel', onTouchCancel, { passive: false });

        // Orientation and Viewport Resize Observer
        window.addEventListener('resize', handleViewportResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                handleViewportResize();
                if (window.VTT?.canvasEngine?.centerOnToken) {
                    window.VTT.canvasEngine.centerOnToken();
                }
            }, 300);
        });

        // Mobile Token Context Menu Accordion Submenu Handler
        setupContextMenuAccordion();
    }

    function handleViewportResize() {
        if (!isTouchSupported()) return;
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
            if (window.VTT?.canvasEngine?.renderAll) {
                window.VTT.canvasEngine.renderAll();
            }
        }, 120);
    }

    function onTouchStart(e) {
        if (!isTouchSupported()) return;

        // Prevent browser 300ms delays, ghost-clicks, and elastic bouncing
        if (e.cancelable) e.preventDefault();

        // Tap-to-Place Token Mode: Swallow touch gestures and wait for placement tap in onTouchEnd
        if (isTapToPlaceActive) {
            return;
        }

        // Dismiss open token context menu or stat tooltip when tapping outside on touchscreens
        const openCtxMenu = document.getElementById('vtt-token-context-menu');
        if (openCtxMenu) {
            const touch = e.touches[0];
            const menuRect = openCtxMenu.getBoundingClientRect();
            const isInside = touch && touch.clientX >= menuRect.left && touch.clientX <= menuRect.right &&
                             touch.clientY >= menuRect.top && touch.clientY <= menuRect.bottom;
            if (!isInside) {
                openCtxMenu.remove();
                cancelLongPress();
                is1FingerPanning = false;
                isSingleTouching = false;
                return;
            }
        }

        const openTooltip = document.getElementById('vtt-gm-token-tooltip');
        if (openTooltip) {
            const touch = e.touches[0];
            const tipRect = openTooltip.getBoundingClientRect();
            const isInside = touch && touch.clientX >= tipRect.left && touch.clientX <= tipRect.right &&
                             touch.clientY >= tipRect.top && touch.clientY <= tipRect.bottom;
            if (!isInside) {
                if (window.VTT?.canvasEngine?.hideGmTokenTooltip) {
                    window.VTT.canvasEngine.hideGmTokenTooltip();
                } else {
                    openTooltip.remove();
                }
            }
        }

        // Dismiss open radial dial when tapping outside on touchscreens
        if (mobileRadialDial && !mobileRadialDial.classList.contains('vtt-hidden')) {
            const touch = e.touches[0];
            const dialRect = mobileRadialDial.getBoundingClientRect();
            const isInside = touch && touch.clientX >= dialRect.left && touch.clientX <= dialRect.right &&
                             touch.clientY >= dialRect.top && touch.clientY <= dialRect.bottom;
            if (!isInside) {
                hideMobileRadialDial();
            }
        }

        // Two-Finger Gesture: Pan & Pinch-to-Zoom OR Second-Finger Drag Cancel
        if (e.touches.length === 2) {
            cancelHoldDrag();
            cancelLongPress();
            hideMobileRadialDial();

            // Second-finger tap during token drag (Esc equivalent: restores token position)
            const canvasEngine = window.VTT?.canvasEngine;
            if (isSingleTouching && (canvasEngine?.isDraggingToken?.() || activeTouchedToken)) {
                if (canvasEngine?.cancelTouchTokenDrag) {
                    canvasEngine.cancelTouchTokenDrag();
                } else if (canvasEngine?.cancelTokenDrag) {
                    canvasEngine.cancelTokenDrag();
                }
                if (navigator.vibrate) navigator.vibrate(30);
                isDragCancelled = true;
                isSingleTouching = false;
                is1FingerPanning = false;
                isPinching = false;
                isTokenDragEngaged = false;
                activeTouchedToken = null;
                if (mobileDragPill) mobileDragPill.classList.add('vtt-hidden');
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
                hideMobileRadialDial();
                return;
            }

            if (is1FingerPanning) {
                is1FingerPanning = false;
            }
            if (isSingleTouching) {
                // Terminate any ongoing single-touch token drag
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.endTouchTokenDrag && canvasEngine?.isDraggingToken?.()) {
                    canvasEngine.endTouchTokenDrag(e.touches[0].clientX, e.touches[0].clientY);
                } else {
                    dispatchSyntheticMouseEvent('mouseup', e.touches[0].clientX, e.touches[0].clientY, 0);
                }
                isSingleTouching = false;
                isTokenDragEngaged = false;
            }

            isPinching = true;
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            lastPinchMid = {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            };
            return;
        }

        // Single-Finger Gesture: Smart Pan vs Token Drag vs Tool Action
        if (e.touches.length === 1) {
            isPinching = false;
            didLongPress = false;
            isTokenDragEngaged = false;
            const touch = e.touches[0];
            touchStartPos = { x: touch.clientX, y: touch.clientY };

            // Check Double-Tap (within 320ms and 24px)
            const now = Date.now();
            const timeSinceLast = now - lastTapInfo.time;
            const distFromLast = Math.hypot(touch.clientX - lastTapInfo.x, touch.clientY - lastTapInfo.y);

            if (timeSinceLast > 40 && timeSinceLast < 320 && distFromLast < 24) {
                cancelHoldDrag();
                cancelLongPress();
                is1FingerPanning = false;
                isSingleTouching = false;

                const canvasEngine = window.VTT?.canvasEngine;
                let touchedToken = null;
                if (canvasEngine?.getCanvasMouseCoords && canvasEngine?.getTokenAtPoint) {
                    const mouseCoords = canvasEngine.getCanvasMouseCoords({ clientX: touch.clientX, clientY: touch.clientY });
                    const zoom = canvasEngine.getZoom ? canvasEngine.getZoom() : 1;
                    const touchRadius = 24 / Math.max(0.1, zoom);
                    touchedToken = canvasEngine.getTokenAtPoint(mouseCoords, true, true, touchRadius);
                }

                if (touchedToken) {
                    // Dispatch dblclick to open character or creature sheet
                    dispatchSyntheticMouseEvent('dblclick', touch.clientX, touch.clientY, 0);
                } else {
                    // Double-tap on empty canvas -> center on active token!
                    if (window.VTT?.canvasEngine?.centerOnToken) {
                        window.VTT.canvasEngine.centerOnToken();
                        if (navigator.vibrate) navigator.vibrate(35);
                    }
                }
                lastTapInfo = { time: 0, x: 0, y: 0 };
                return;
            }

            // Hit-test: Check if touch begins on an owned token or empty map canvas
            const canvasEngine = window.VTT?.canvasEngine;
            const activeToolBtn = document.querySelector('.control-btn.active');
            const activeTool = activeToolBtn ? activeToolBtn.id.replace('tool-', '') : 'select';

            let touchedToken = null;
            if (canvasEngine?.getCanvasMouseCoords && canvasEngine?.getTokenAtPoint) {
                const mouseCoords = canvasEngine.getCanvasMouseCoords({ clientX: touch.clientX, clientY: touch.clientY });
                const zoom = canvasEngine.getZoom ? canvasEngine.getZoom() : 1;
                // Generous screen touch slop radius (24px in screen units) converted to world coords
                const touchRadius = 24 / Math.max(0.1, zoom);
                // requireControl is true: unowned tokens return null, ensuring unowned tokens pass through to panning
                touchedToken = canvasEngine.getTokenAtPoint(mouseCoords, true, true, touchRadius);
            }

            let touchedDrawing = null;
            if (activeTool === 'select' && !touchedToken && canvasEngine?.getDrawingAtPoint) {
                const mouseCoords = canvasEngine.getCanvasMouseCoords({ clientX: touch.clientX, clientY: touch.clientY });
                touchedDrawing = canvasEngine.getDrawingAtPoint(mouseCoords, true);
            }

            // If in Select mode and touching empty canvas ground OR unowned token -> SMART 1-FINGER PAN!
            if (activeTool === 'select' && !touchedToken && !touchedDrawing) {
                is1FingerPanning = true;
                panStartPos = { x: touch.clientX, y: touch.clientY };
                isSingleTouching = true;
                activeTouchedToken = null;
                isTokenDragEngaged = false;
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
                hideMobileRadialDial();
                return;
            }

            // Otherwise, touching an owned token or active tool (Measure, Shape, Ping, Lighting)
            is1FingerPanning = false;
            isSingleTouching = true;
            activeTouchedToken = touchedToken;
            isTokenDragEngaged = false;
            touchMoveDist = 0;

            // Dedicated Selection Tap & Hold-to-Drag Paradigm:
            // When an owned token is tapped, select it immediately so selection ring appears.
            // Do NOT engage drag immediately to prevent accidental displacement while panning.
            if (activeTool === 'select' && touchedToken) {
                if (canvasEngine?.selectToken) {
                    canvasEngine.selectToken(touchedToken.id);
                }
                cancelHoldDrag();
                tokenHoldDragTimer = setTimeout(() => {
                    if (isSingleTouching && activeTouchedToken && !isDragCancelled && !is1FingerPanning) {
                        isTokenDragEngaged = true;
                        if (navigator.vibrate) navigator.vibrate(25);
                        if (canvasEngine?.startTouchTokenDrag) {
                            canvasEngine.startTouchTokenDrag(activeTouchedToken.id, touch.clientX, touch.clientY);
                        }
                    }
                }, 150);
            }

            // Start 500ms Long-Press Timer for Right-Click Context Menu
            longPressTimer = setTimeout(() => {
                didLongPress = true;
                cancelHoldDrag();
                if (navigator.vibrate) navigator.vibrate(40);
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.cancelTouchTokenDrag) {
                    canvasEngine.cancelTouchTokenDrag();
                } else if (canvasEngine?.cancelTokenDrag) {
                    canvasEngine.cancelTokenDrag();
                }
                if (canvasEngine?.cancelActiveMeasurement) {
                    canvasEngine.cancelActiveMeasurement();
                }
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
                if (mobileDragPill) mobileDragPill.classList.add('vtt-hidden');

                if (activeTouchedToken?.id && canvasEngine?.showTokenContextMenu) {
                    canvasEngine.showTokenContextMenu(activeTouchedToken.id, touch.clientX, touch.clientY);
                } else {
                    dispatchSyntheticMouseEvent('contextmenu', touch.clientX, touch.clientY, 2);
                }
            }, 500);

            // For non-select tools (measure, shape, ping, lighting), dispatch mousedown
            if (activeTool !== 'select' || !touchedToken) {
                dispatchSyntheticMouseEvent('mousedown', touch.clientX, touch.clientY, 0);
            }
        }
    }

    function onTouchMove(e) {
        if (!isTouchSupported()) return;

        if (isDragCancelled) return;

        // CRITICAL: Only prevent default if handling an active canvas gesture.
        // Touches inside modals, sheets, sidebars, or drawers MUST scroll naturally!
        const hasActiveCanvasGesture = isPinching || is1FingerPanning || isSingleTouching;
        if (!hasActiveCanvasGesture) return;

        if (e.cancelable) e.preventDefault();

        // Two-Finger Pan & Pinch-to-Zoom
        if (e.touches.length === 2 && isPinching) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const newMid = {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            };

            const canvasEngine = window.VTT?.canvasEngine;
            if (canvasEngine) {
                // 1. Zoom Delta
                if (initialPinchDist > 0 && Math.abs(newDist - initialPinchDist) > 1) {
                    const zoomRatio = newDist / initialPinchDist;
                    const currentZoom = (canvasEngine.getZoom ? canvasEngine.getZoom() : 1);
                    const targetZoom = Math.min(5.0, Math.max(0.1, currentZoom * zoomRatio));
                    if (canvasEngine.setZoom) {
                        canvasEngine.setZoom(targetZoom, newMid.x, newMid.y);
                    }
                    initialPinchDist = newDist;
                }

                // 2. Pan Delta
                if (lastPinchMid) {
                    const dx = newMid.x - lastPinchMid.x;
                    const dy = newMid.y - lastPinchMid.y;
                    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                        if (canvasEngine.panBy) {
                            canvasEngine.panBy(dx, dy);
                        }
                    }
                }
            }

            lastPinchMid = newMid;
            return;
        }

        // Single-Finger Smart Pan on Empty Canvas or Unowned Token
        if (e.touches.length === 1 && is1FingerPanning) {
            const touch = e.touches[0];
            const dx = touch.clientX - panStartPos.x;
            const dy = touch.clientY - panStartPos.y;
            const canvasEngine = window.VTT?.canvasEngine;
            if (canvasEngine?.panBy && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
                canvasEngine.panBy(dx, dy);
            }
            panStartPos = { x: touch.clientX, y: touch.clientY };
            return;
        }

        // Single-Finger Token Move or Tool Drawing
        if (e.touches.length === 1 && isSingleTouching) {
            const touch = e.touches[0];
            touchMoveDist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);

            // Cancel long press & hide quick action bar / radial dial if finger moved > 8px
            if (touchMoveDist > 8) {
                cancelLongPress();
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
                hideMobileRadialDial();
            }

            // Drag threshold: if finger moves >= 10px before the 150ms hold, engage drag immediately!
            const activeToolBtn = document.querySelector('.control-btn.active');
            const activeTool = activeToolBtn ? activeToolBtn.id.replace('tool-', '') : 'select';
            if (activeTool === 'select' && activeTouchedToken && !isTokenDragEngaged && touchMoveDist >= 10) {
                cancelHoldDrag();
                isTokenDragEngaged = true;
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.startTouchTokenDrag) {
                    canvasEngine.startTouchTokenDrag(activeTouchedToken.id, touchStartPos.x, touchStartPos.y);
                }
            }

            if (!didLongPress) {
                const canvasEngine = window.VTT?.canvasEngine;
                if (activeTouchedToken && isTokenDragEngaged && canvasEngine?.moveTouchTokenDrag && canvasEngine?.isDraggingToken?.()) {
                    canvasEngine.moveTouchTokenDrag(touch.clientX, touch.clientY);
                } else if (!activeTouchedToken) {
                    dispatchSyntheticMouseEvent('mousemove', touch.clientX, touch.clientY, 0);
                }
            }
        }
    }

    function onTouchEnd(e) {
        if (!isTouchSupported()) return;

        cancelHoldDrag();
        cancelLongPress();

        // Tap-to-Place Token Mode: Intercept tap on canvas interaction surface and spawn at coords
        if (isTapToPlaceActive && pendingPlacementPayload) {
            if (e.cancelable) e.preventDefault();
            const touch = e.changedTouches ? e.changedTouches[0] : null;
            if (touch && window.VTT?.canvasEngine?.getCanvasMouseCoords) {
                const coords = window.VTT.canvasEngine.getCanvasMouseCoords({ clientX: touch.clientX, clientY: touch.clientY });
                if (coords) {
                    executeTapPlacement(coords.x, coords.y);
                }
            }
            cancelTapToPlaceMode();
            return;
        }

        if (e.touches.length === 0) {
            isDragCancelled = false;
        }

        if (isPinching && e.touches.length < 2) {
            isPinching = false;
            lastPinchMid = null;
            initialPinchDist = 0;
            return;
        }

        if (is1FingerPanning && e.touches.length === 0) {
            is1FingerPanning = false;
            isSingleTouching = false;
            const changedTouch = e.changedTouches[0];
            if (changedTouch) {
                lastTapInfo = {
                    time: Date.now(),
                    x: changedTouch.clientX,
                    y: changedTouch.clientY
                };
            }
            return;
        }

        if (isSingleTouching && e.touches.length === 0) {
            const changedTouch = e.changedTouches[0];
            if (changedTouch) {
                lastTapInfo = {
                    time: Date.now(),
                    x: changedTouch.clientX,
                    y: changedTouch.clientY
                };

                if (!didLongPress && !isDragCancelled) {
                    const canvasEngine = window.VTT?.canvasEngine;
                    if (activeTouchedToken && isTokenDragEngaged && canvasEngine?.endTouchTokenDrag && canvasEngine?.isDraggingToken?.()) {
                        // Token drag completed!
                        canvasEngine.endTouchTokenDrag(changedTouch.clientX, changedTouch.clientY);
                    } else if (activeTouchedToken) {
                        // Clean tap on token (no drag threshold engaged)
                        if (canvasEngine?.cancelTouchTokenDrag) {
                            canvasEngine.cancelTouchTokenDrag();
                        }
                        if (touchMoveDist < 10) {
                            showMobileRadialDial(changedTouch.clientX, changedTouch.clientY, activeTouchedToken);
                        }
                    } else {
                        dispatchSyntheticMouseEvent('mouseup', changedTouch.clientX, changedTouch.clientY, 0);
                    }
                }
            }
            activeTouchedToken = null;
            isTokenDragEngaged = false;
            isSingleTouching = false;
            didLongPress = false;
        }
    }

    function onTouchCancel() {
        cancelHoldDrag();
        cancelLongPress();
        const canvasEngine = window.VTT?.canvasEngine;
        if (canvasEngine?.cancelTouchTokenDrag) {
            canvasEngine.cancelTouchTokenDrag();
        } else if (canvasEngine?.cancelTokenDrag) {
            canvasEngine.cancelTokenDrag();
        }
        isPinching = false;
        isSingleTouching = false;
        is1FingerPanning = false;
        isTokenDragEngaged = false;
        didLongPress = false;
        activeTouchedToken = null;
    }

    function cancelHoldDrag() {
        if (tokenHoldDragTimer) {
            clearTimeout(tokenHoldDragTimer);
            tokenHoldDragTimer = null;
        }
    }

    function cancelLongPress() {
        cancelHoldDrag();
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function dispatchSyntheticMouseEvent(type, clientX, clientY, button = 0) {
        if (!canvasInteraction) return;
        const target = (type === 'mousemove' || type === 'mouseup') ? window : canvasInteraction;
        const evt = new MouseEvent(type, {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: clientX,
            clientY: clientY,
            button: button,
            buttons: type === 'mouseup' ? 0 : 1
        });
        target.dispatchEvent(evt);
    }

    // Mobile Token Context Menu Accordion Submenu Handler
    function setupContextMenuAccordion() {
        document.addEventListener('click', (e) => {
            if (!isMobileViewport()) return;
            const menuItem = e.target.closest('.vtt-token-menu-item');
            if (menuItem && menuItem.querySelector('.vtt-token-submenu')) {
                e.stopPropagation();
                menuItem.classList.toggle('submenu-expanded');
            }
        });
    }

    // ========================================================================
    // 2. MOBILE BOTTOM NAVIGATION & DRAWER SYSTEM
    // ========================================================================
    function setupMobileNavigation() {
        if (!mobileNav) return;

        const role = vtt.role || 'Player';
        renderMobileNavTabs(role);

        // Backdrop click to dismiss any open drawer
        if (mobileBackdrop) {
            mobileBackdrop.addEventListener('click', () => {
                closeAllDrawers();
                setActiveNavTab('map');
            });
        }

        // Setup Sheet Mobile Topbars
        injectSheetMobileTopbar(playerSheetPanel, 'Player Character', () => {
            closeAllDrawers();
            setActiveNavTab('map');
        }, false, true);

        injectSheetMobileTopbar(creatureSheetPanel, 'Creature Statblock', () => {
            closeAllDrawers();
            setActiveNavTab('map');
        }, true, false);

        // Setup Mobile Drawer Header in Right Sidebar
        injectSidebarMobileHeader();

        // Setup Dedicated Mobile More Tab
        injectMobileMoreTab();

        // Setup Fast Dice Haptics
        setupFastDiceHaptics();

        // Setup Initiative Mobile Header
        injectInitiativeMobileHeader();

        // Setup Floating Tool FAB
        setupMobileToolsFab();

        // Setup Mobile Shape & Color Bottom Sheet
        setupMobileShapeUI();

        // Setup Mobile Paint Studio Drawer
        setupMobilePaintDrawer();

        // Setup Mobile Map Tools Bottom Sheet
        setupMobileMapToolsUI();

        // Setup Modal Backdrop Click/Tap Dismissal
        setupModalBackdropDismissal();

        // Setup Mobile Token Radial Touch Dial
        setupMobileRadialDial();

        // Setup Mobile Sheet Switcher Carousel
        setupMobileSheetCarousel();

        // Setup Mobile Eco / Battery Saver Mode
        setupMobileEcoMode();

        // Setup Live Turn Badge Polling
        setupTurnBadgeObserver();

        // Setup Floating Combat Initiative Pill
        setupFloatingCombatPill();

        // Setup Tap-to-Place Token Mode
        setupTapToPlaceMode();
    }

    function renderMobileNavTabs(role) {
        mobileNav.innerHTML = '';

        let tabs = [];
        if (role === 'GM') {
            tabs = [
                { id: 'map', icon: 'fa-map', label: 'Map' },
                { id: 'chat', icon: 'fa-comments', label: 'Chat/Dice' },
                { id: 'initiative', icon: 'fa-list-ol', label: 'Combat', hasBadge: true },
                { id: 'library', icon: 'fa-book-skull', label: 'Bestiary' },
                { id: 'more', icon: 'fa-bars', label: 'More' }
            ];
        } else {
            // Player Navigation: Direct Characters access to select PC before viewing sheet
            tabs = [
                { id: 'map', icon: 'fa-map', label: 'Map' },
                { id: 'characters', icon: 'fa-users', label: 'Characters' },
                { id: 'sheet', icon: 'fa-user-shield', label: 'Sheet' },
                { id: 'chat', icon: 'fa-comments', label: 'Chat/Dice' },
                { id: 'initiative', icon: 'fa-list-ol', label: 'Combat', hasBadge: true }
            ];
        }

        tabs.forEach(tab => {
            const btn = document.createElement('button');
            btn.className = `mobile-nav-btn ${tab.id === activeNavTab ? 'active' : ''}`;
            btn.dataset.tab = tab.id;
            btn.innerHTML = `
                <i class="fa-solid ${tab.icon}"></i>
                <span>${tab.label}</span>
                ${tab.hasBadge ? `<span class="mobile-nav-badge vtt-hidden" id="mobile-init-badge">1</span>` : ''}
            `;

            btn.addEventListener('click', () => handleNavTabClick(tab.id));
            mobileNav.appendChild(btn);
        });
    }

    function handleNavTabClick(tabId) {
        // Tapping the currently active drawer tab closes it and returns to map
        if (activeNavTab === tabId && tabId !== 'map') {
            closeAllDrawers();
            setActiveNavTab('map');
            return;
        }

        closeAllDrawers();
        setActiveNavTab(tabId);

        switch (tabId) {
            case 'map':
                // Everything closed, canvas full screen
                break;

            case 'characters':
                openMobileSidebarTab('tab-characters');
                break;

            case 'sheet':
                openMobilePlayerSheet();
                break;

            case 'chat':
                openMobileSidebarTab('tab-chat');
                break;

            case 'initiative':
                openMobileInitiativeDrawer();
                break;

            case 'library':
                openMobileSidebarTab('tab-library');
                break;

            case 'handouts':
                openMobileSidebarTab('tab-handouts');
                break;

            case 'more':
                openMobileSidebarTab('tab-mobile-more', false);
                break;
        }
    }

    function setActiveNavTab(tabId) {
        activeNavTab = tabId;
        const btns = mobileNav.querySelectorAll('.mobile-nav-btn');
        btns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        if (mobileSheetCarousel) {
            if (tabId === 'map' || playerSheetPanel?.classList.contains('open') || creatureSheetPanel?.classList.contains('open')) {
                mobileSheetCarousel.classList.remove('vtt-hidden');
            } else {
                mobileSheetCarousel.classList.add('vtt-hidden');
            }
        }
    }

    function closeAllDrawers() {
        if (sidebar) sidebar.classList.remove('mobile-drawer-open');
        if (playerSheetPanel) {
            playerSheetPanel.classList.remove('open');
            playerSheetPanel.classList.add('minimized');
        }
        if (creatureSheetPanel) {
            creatureSheetPanel.classList.remove('open');
            creatureSheetPanel.classList.add('minimized');
        }
        if (initContainer) initContainer.classList.remove('mobile-init-open');
        if (mobileBackdrop) mobileBackdrop.classList.remove('active');
        if (mobileToolsMenu) mobileToolsMenu.classList.remove('active');
        if (mobileFab) mobileFab.classList.remove('active');
        if (mobileShapeSheet) mobileShapeSheet.classList.add('vtt-hidden');
        if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
        hideMobileRadialDial();
        if (activeNavTab === 'map' && mobileSheetCarousel) {
            mobileSheetCarousel.classList.remove('vtt-hidden');
        }
        const mobilePaintModal = document.getElementById('modal-mobile-paint-drawer');
        if (mobilePaintModal) mobilePaintModal.classList.add('vtt-hidden');
        const maptoolsSheet = document.getElementById('vtt-mobile-maptools-sheet');
        if (maptoolsSheet) maptoolsSheet.classList.add('vtt-hidden');
    }

    function openMobileSidebarTab(targetTabId, isSubPanel = false) {
        if (!sidebar) return;

        // Activate matching desktop tab content
        const tabBtns = sidebar.querySelectorAll('.tab-header');
        const tabPanels = sidebar.querySelectorAll('.tab-panel');

        tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === targetTabId));
        tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === targetTabId));

        // Update drawer header title & icon
        const drawerTitle = document.getElementById('mobile-drawer-title-text');
        const drawerIcon = document.getElementById('mobile-drawer-icon');
        const backBtn = document.getElementById('mobile-drawer-back-btn');

        const titleMap = {
            'tab-chat': { title: 'Game Chat & Dice', icon: 'fa-comments' },
            'tab-characters': { title: 'Player Characters', icon: 'fa-users' },
            'tab-handouts': { title: 'Campaign Handouts', icon: 'fa-file-lines' },
            'tab-library': { title: 'Monster Bestiary', icon: 'fa-book-skull' },
            'tab-assets': { title: 'Asset Gallery', icon: 'fa-images' },
            'tab-config': { title: 'Settings & Tools', icon: 'fa-gear' },
            'tab-mobile-more': { title: 'More Options', icon: 'fa-bars' }
        };

        const info = titleMap[targetTabId] || { title: 'Tabletop Panel', icon: 'fa-scroll' };
        if (drawerTitle) drawerTitle.textContent = info.title;
        if (drawerIcon) drawerIcon.className = `fa-solid ${info.icon}`;

        if (backBtn) {
            if (isSubPanel) {
                backBtn.classList.remove('vtt-hidden');
            } else {
                backBtn.classList.add('vtt-hidden');
            }
        }

        sidebar.classList.add('mobile-drawer-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        if (mobileSheetCarousel) mobileSheetCarousel.classList.add('vtt-hidden');
    }

    function openMobilePlayerSheet() {
        if (!playerSheetPanel) return;

        // Open sheet overlay
        playerSheetPanel.classList.remove('minimized');
        playerSheetPanel.classList.add('open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        if (mobileSheetCarousel) mobileSheetCarousel.classList.remove('vtt-hidden');

        // Update mobile topbar data from current character if present
        syncPlayerSheetTopbar();
    }

    function openMobileInitiativeDrawer() {
        if (!initContainer) return;

        initContainer.classList.remove('vtt-hidden');
        initContainer.classList.add('mobile-init-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        if (mobileSheetCarousel) mobileSheetCarousel.classList.add('vtt-hidden');
    }

    // ========================================================================
    // 3. MOBILE SHEET TOPBARS, MORE HUB & DRAWER HEADERS
    // ========================================================================
    function injectMobileMoreTab() {
        if (!sidebar) return;
        const contentEl = sidebar.querySelector('.sidebar-content');
        if (!contentEl || contentEl.querySelector('#tab-mobile-more')) return;

        const morePanel = document.createElement('div');
        morePanel.id = 'tab-mobile-more';
        morePanel.className = 'tab-panel mobile-only';
        morePanel.style.overflowY = 'auto';

        const role = vtt.role || 'Player';
        const isGM = role === 'GM';

        morePanel.innerHTML = `
            <div class="mobile-more-grid">
                <div class="mobile-more-card" data-action="handouts">
                    <i class="fa-solid fa-file-lines" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Handouts</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Campaign lore & notes</span>
                </div>
                ${isGM ? `
                <div class="mobile-more-card" data-action="maps">
                    <i class="fa-solid fa-map-location-dot" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Map Manager</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Change & manage maps</span>
                </div>
                <div class="mobile-more-card" data-action="characters">
                    <i class="fa-solid fa-users" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Characters</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Party & companions</span>
                </div>
                <div class="mobile-more-card" data-action="assets">
                    <i class="fa-solid fa-images" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Asset Gallery</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Media & tokens</span>
                </div>
                <div class="mobile-more-card" data-action="map-tools">
                    <i class="fa-solid fa-dungeon" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Map Tools</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Traps & Portals</span>
                </div>
                ` : `
                <div class="mobile-more-card" data-action="characters">
                    <i class="fa-solid fa-users" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Characters</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Party members</span>
                </div>
                `}
                <div class="mobile-more-card" data-action="paint">
                    <i class="fa-solid fa-palette" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Paint Tools</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Draw, shapes & text</span>
                </div>
                <div class="mobile-more-card" data-action="config">
                    <i class="fa-solid fa-gear" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Settings</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Preferences & audio</span>
                </div>
                <div class="mobile-more-card" data-action="center-token">
                    <i class="fa-solid fa-crosshairs" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Center Map</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Focus active token</span>
                </div>
                <div class="mobile-more-card" id="more-card-eco" data-action="toggle-eco" style="border-color: ${isEcoModeActive ? 'rgba(34, 197, 94, 0.5)' : ''};">
                    <i class="fa-solid fa-leaf" style="font-size: 1.8rem; color: #22c55e;"></i>
                    <span style="font-weight: 600;">Battery / Eco Mode</span>
                    <span class="eco-status-text" style="font-size: 0.75rem; color: ${isEcoModeActive ? '#22c55e' : '#94a3b8'};">
                        ${isEcoModeActive ? 'Active (Particles & 3D Paused)' : 'Disabled (Full Effects)'}
                    </span>
                </div>
                <div class="mobile-more-card" data-action="toggle-desktop-ui">
                    <i class="fa-solid fa-desktop" style="font-size: 1.8rem; color: #38bdf8;"></i>
                    <span style="font-weight: 600;">Desktop UI</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Switch to desktop mode</span>
                </div>
                <div class="mobile-more-card" data-action="exit" style="border-color: rgba(239, 68, 68, 0.4);">
                    <i class="fa-solid fa-right-from-bracket" style="font-size: 1.8rem; color: #ef4444;"></i>
                    <span style="font-weight: 600; color: #ef4444;">Exit Tabletop</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Leave session</span>
                </div>
            </div>
        `;

        morePanel.querySelectorAll('.mobile-more-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                if (action === 'maps') {
                    closeAllDrawers();
                    setActiveNavTab('map');
                    const btnChangeMap = document.getElementById('btn-change-map');
                    if (btnChangeMap) btnChangeMap.click();
                } else if (action === 'paint') {
                    closeAllDrawers();
                    setActiveNavTab('map');
                    activateTool('paint');
                } else if (action === 'map-tools') {
                    closeAllDrawers();
                    setActiveNavTab('map');
                    activateTool('maptools');
                } else if (action === 'characters') {
                    openMobileSidebarTab('tab-characters', true);
                } else if (action === 'handouts') {
                    openMobileSidebarTab('tab-handouts', true);
                } else if (action === 'assets') {
                    openMobileSidebarTab('tab-assets', true);
                } else if (action === 'config') {
                    openMobileSidebarTab('tab-config', true);
                } else if (action === 'center-token') {
                    closeAllDrawers();
                    setActiveNavTab('map');
                    if (window.VTT?.canvasEngine?.centerOnToken) {
                        window.VTT.canvasEngine.centerOnToken();
                    }
                } else if (action === 'toggle-eco') {
                    toggleEcoMode();
                } else if (action === 'toggle-desktop-ui') {
                    localStorage.setItem('vtt_force_mobile_ui', 'false');
                    document.documentElement.classList.add('force-desktop-ui');
                    document.documentElement.classList.remove('force-mobile-ui');
                    const toggle = document.getElementById('config-toggle-mobile-ui');
                    if (toggle) toggle.checked = false;
                    closeAllDrawers();
                    if (window.VTT?.canvasEngine?.renderAll) {
                        window.VTT.canvasEngine.renderAll();
                    }
                } else if (action === 'exit') {
                    const btnLogout = document.getElementById('btn-logout');
                    if (btnLogout) btnLogout.click();
                }
            });
        });

        contentEl.appendChild(morePanel);
    }

    function setupFastDiceHaptics() {
        document.querySelectorAll('.fast-dice').forEach(btn => {
            btn.addEventListener('click', () => {
                if (navigator.vibrate) navigator.vibrate(25);
            });
        });
    }

    function injectSheetMobileTopbar(panelEl, defaultTitle, onClose, isCreature = false, isPlayer = false) {
        if (!panelEl) return;
        if (panelEl.querySelector('.mobile-sheet-topbar')) return;

        const showSpawn = isCreature || isPlayer;
        const topbar = document.createElement('div');
        topbar.className = 'mobile-sheet-topbar';
        topbar.innerHTML = `
            <div class="mobile-sheet-info">
                <img src="favicon.svg" alt="Avatar" class="mobile-sheet-avatar">
                <div class="mobile-sheet-details">
                    <span class="mobile-sheet-name">${defaultTitle}</span>
                    <span class="mobile-sheet-hp-pill">HP: Active</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${showSpawn ? `
                <button class="mobile-sheet-spawn-btn" title="Spawn Token on Canvas">
                    <i class="fa-solid fa-plus"></i>
                    <span>Spawn</span>
                </button>
                ` : ''}
                <button class="mobile-sheet-close-btn" title="Close Sheet (Return to Map)">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        if (showSpawn) {
            const spawnBtn = topbar.querySelector('.mobile-sheet-spawn-btn');
            if (spawnBtn) {
                spawnBtn.addEventListener('click', () => {
                    if (isCreature) {
                        const monster = window.VTT?.creatureSheet?.getCurrentMonster?.() || window.vttCreatureSheetAPI?.getCurrentMonster?.();
                        if (monster && window.VTT?.spawnMonsterAtCenter) {
                            window.VTT.spawnMonsterAtCenter(monster);
                        }
                    } else if (isPlayer) {
                        const char = window.VTT?.playerSheet?.getCurrentChar?.();
                        if (char && window.VTT?.spawnCharacterAtCenter) {
                            window.VTT.spawnCharacterAtCenter(char);
                        }
                    }
                });
            }
        }

        const closeBtn = topbar.querySelector('.mobile-sheet-close-btn');
        closeBtn.addEventListener('click', onClose);

        panelEl.insertBefore(topbar, panelEl.firstChild);
    }

    function syncPlayerSheetTopbar() {
        if (!playerSheetPanel) return;
        const topbar = playerSheetPanel.querySelector('.mobile-sheet-topbar');
        if (!topbar) return;

        // Look for character title or active sheet name
        const nameEl = playerSheetPanel.querySelector('.ps-hero-name') || playerSheetPanel.querySelector('h2');
        const hpEl = playerSheetPanel.querySelector('.ps-hp-current');
        const maxHpEl = playerSheetPanel.querySelector('.ps-hp-max');
        const avatarEl = playerSheetPanel.querySelector('.ps-hero-avatar') || playerSheetPanel.querySelector('.token-avatar');

        if (nameEl) {
            const nameSpan = topbar.querySelector('.mobile-sheet-name');
            if (nameSpan) nameSpan.textContent = nameEl.value || nameEl.textContent || 'Character Sheet';
        }
        if (hpEl && maxHpEl) {
            const hpSpan = topbar.querySelector('.mobile-sheet-hp-pill');
            if (hpSpan) hpSpan.textContent = `HP: ${hpEl.value || hpEl.textContent} / ${maxHpEl.value || maxHpEl.textContent}`;
        }
        if (avatarEl && avatarEl.src) {
            const topbarAvatar = topbar.querySelector('.mobile-sheet-avatar');
            if (topbarAvatar) topbarAvatar.src = avatarEl.src;
        }
    }

    function syncCreatureSheetTopbar() {
        if (!creatureSheetPanel) return;
        const topbar = creatureSheetPanel.querySelector('.mobile-sheet-topbar');
        if (!topbar) return;
        const monster = window.VTT?.creatureSheet?.getCurrentMonster?.() || window.vttCreatureSheetAPI?.getCurrentMonster?.();
        if (monster) {
            const nameSpan = topbar.querySelector('.mobile-sheet-name');
            if (nameSpan) nameSpan.textContent = monster.name || 'Creature Statblock';
            const hpSpan = topbar.querySelector('.mobile-sheet-hp-pill');
            if (hpSpan && monster.hp) {
                const hpVal = typeof monster.hp === 'object' ? (monster.hp.average || monster.hp.formula) : monster.hp;
                hpSpan.textContent = `HP: ${hpVal}`;
            }
            const avatarImg = topbar.querySelector('.mobile-sheet-avatar');
            if (avatarImg) {
                let img = monster.tokenImg;
                if (!img && monster.tokenImages && monster.tokenImages.length > 0) {
                    const idx = monster.activeTokenIndex >= 0 ? monster.activeTokenIndex : 0;
                    img = monster.tokenImages[idx]?.url;
                }
                if (!img) {
                    img = (window.VTT?.dataBridge?.getMonsterImageUrl ? window.VTT.dataBridge.getMonsterImageUrl(monster) : 'favicon.svg');
                }
                avatarImg.src = img || 'favicon.svg';
            }
        }
    }

    function injectSidebarMobileHeader() {
        if (!sidebar) return;
        const contentEl = sidebar.querySelector('.sidebar-content');
        if (!contentEl || contentEl.querySelector('.mobile-drawer-header')) return;

        const header = document.createElement('div');
        header.className = 'mobile-drawer-header';
        header.innerHTML = `
            <div class="mobile-drawer-left">
                <button class="mobile-drawer-back-btn vtt-hidden" id="mobile-drawer-back-btn" title="Back">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div class="mobile-drawer-title">
                    <i class="fa-solid fa-scroll" id="mobile-drawer-icon"></i>
                    <span id="mobile-drawer-title-text">Tabletop Panel</span>
                </div>
            </div>
            <button class="mobile-drawer-close" title="Close Panel">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        const backBtn = header.querySelector('#mobile-drawer-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                openMobileSidebarTab('tab-mobile-more', false);
            });
        }

        header.querySelector('.mobile-drawer-close').addEventListener('click', () => {
            closeAllDrawers();
            setActiveNavTab('map');
        });

        contentEl.insertBefore(header, contentEl.firstChild);
    }

    function injectInitiativeMobileHeader() {
        if (!initContainer) return;
        if (initContainer.querySelector('.mobile-drawer-header')) return;

        const header = document.createElement('div');
        header.className = 'mobile-drawer-header';
        header.innerHTML = `
            <div class="mobile-drawer-title">
                <i class="fa-solid fa-list-ol"></i>
                <span>Combat Initiative</span>
            </div>
            <button class="mobile-drawer-close" title="Close Initiative">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        header.querySelector('.mobile-drawer-close').addEventListener('click', () => {
            closeAllDrawers();
            setActiveNavTab('map');
        });

        initContainer.insertBefore(header, initContainer.firstChild);
    }

    // ========================================================================
    // 4. FLOATING TABLETOP TOOLS FAB & PALETTE
    // ========================================================================
    function setupMobileToolsFab() {
        if (!mobileFab || !mobileToolsMenu) return;

        updateMobileToolsRoleVisibility(vtt.role || 'Player');

        mobileFab.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = mobileToolsMenu.classList.contains('active');
            if (isActive) {
                mobileToolsMenu.classList.remove('active');
                mobileFab.classList.remove('active');
            } else {
                mobileToolsMenu.classList.add('active');
                mobileFab.classList.add('active');
            }
        });

        // Close FAB menu when clicking outside
        window.addEventListener('click', (e) => {
            if (!mobileFab.contains(e.target) && !mobileToolsMenu.contains(e.target)) {
                mobileToolsMenu.classList.remove('active');
                mobileFab.classList.remove('active');
            }
        });

        // Attach Tool Actions to Desktop Toolbar equivalents
        const toolButtons = mobileToolsMenu.querySelectorAll('.mobile-tool-item');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const toolKey = btn.dataset.tool;
                activateTool(toolKey);
                if (toolKey !== 'fit' && toolKey !== 'zoom-in' && toolKey !== 'zoom-out') {
                    toolButtons.forEach(b => b.classList.toggle('active', b === btn));
                }
                mobileToolsMenu.classList.remove('active');
                mobileFab.classList.remove('active');
            });
        });
    }

    function updateMobileToolsRoleVisibility(role) {
        if (!mobileToolsMenu) return;
        const isGM = role === 'GM';
        mobileToolsMenu.querySelectorAll('.mobile-tool-item.gm-only').forEach(el => {
            if (isGM) {
                el.classList.remove('vtt-hidden');
                el.style.removeProperty('display');
            } else {
                el.classList.add('vtt-hidden');
                el.style.display = 'none';
            }
        });
    }

    function activateTool(toolKey) {
        // Enforce player parity: players cannot activate lighting, switch layers, or access GM map tools
        const isGM = (vtt.role || 'Player') === 'GM';
        if ((toolKey === 'lighting' || toolKey === 'layers' || toolKey === 'map' || toolKey === 'maptools') && !isGM) {
            return;
        }

        const desktopToolMap = {
            'select': 'tool-select',
            'measure': 'tool-measure',
            'shape': 'tool-shape',
            'ping': 'tool-ping',
            'lighting': 'tool-lighting',
            'paint': 'tool-paint',
            'maptools': 'tool-map-tools',
            'layers': 'btn-layers',
            'map': 'btn-change-map'
        };

        if (toolKey === 'eco') {
            toggleEcoMode();
            return;
        }

        if (toolKey === 'fit') {
            if (window.VTT?.canvasEngine?.centerOnToken) {
                window.VTT.canvasEngine.centerOnToken();
            } else if (window.VTT?.canvasEngine?.setZoom) {
                window.VTT.canvasEngine.setZoom(1.0);
            }
            return;
        }

        if (toolKey === 'zoom-in') {
            if (window.VTT?.canvasEngine?.stepZoom) {
                window.VTT.canvasEngine.stepZoom(0.1);
            }
            return;
        }

        if (toolKey === 'zoom-out') {
            if (window.VTT?.canvasEngine?.stepZoom) {
                window.VTT.canvasEngine.stepZoom(-0.1);
            }
            return;
        }

        if (toolKey === 'measure' || toolKey === 'shape') {
            // Cleanly open the shape selection modal on mobile
            if (mobileShapePill) mobileShapePill.classList.add('vtt-hidden');
            if (mobileShapeSheet) mobileShapeSheet.classList.remove('vtt-hidden');
            if (mobileBackdrop) mobileBackdrop.classList.add('active');
        } else if (toolKey === 'paint') {
            // Open full-screen paint studio drawer modal on mobile
            const paintModal = document.getElementById('modal-mobile-paint-drawer');
            if (paintModal) {
                paintModal.classList.remove('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.add('active');
            }
        } else if (toolKey === 'maptools') {
            // Open mobile map tools bottom sheet
            const maptoolsSheet = document.getElementById('vtt-mobile-maptools-sheet');
            if (maptoolsSheet) {
                maptoolsSheet.classList.remove('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.add('active');
            }
        } else {
            // Hide shape selector and pill when switching to any other tool
            if (mobileShapePill) mobileShapePill.classList.add('vtt-hidden');
            if (mobileShapeSheet) {
                mobileShapeSheet.classList.add('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('active');
            }
        }

        const btnId = desktopToolMap[toolKey];
        if (btnId) {
            const desktopBtn = document.getElementById(btnId);
            if (desktopBtn) desktopBtn.click();
        }
    }

    function setupMobileShapeUI() {
        if (!mobileShapeSheet || !mobileShapePill) return;

        const desktopShapeSelect = document.getElementById('measure-shape');
        const desktopColorSelect = document.getElementById('measure-color');
        const shapeOpts = mobileShapeSheet.querySelectorAll('.vtt-shape-opt');
        const colorSwatches = mobileShapeSheet.querySelectorAll('.vtt-color-swatch');
        const closeBtn = document.getElementById('btn-close-shape-sheet');
        const pillText = document.getElementById('vtt-mobile-shape-pill-text');
        const pillIcon = document.getElementById('vtt-mobile-shape-pill-icon');
        const pillColor = document.getElementById('vtt-mobile-shape-pill-color');

        const shapeIconMap = {
            'line': 'fa-solid fa-ruler',
            'circle': 'fa-regular fa-circle',
            'square': 'fa-regular fa-square',
            'cone': 'fa-solid fa-pizza-slice',
            'beam': 'fa-solid fa-grip-lines-vertical'
        };

        const shapeNameMap = {
            'line': 'Line',
            'circle': 'Circle',
            'square': 'Square',
            'cone': 'Cone',
            'beam': 'Beam'
        };

        const colorHexMap = {
            'gold': '#eab308',
            'red': '#ef4444',
            'blue': '#3b82f6',
            'green': '#22c55e',
            'purple': '#a855f7'
        };

        function minimizeShapeSheet(defaultToLine = false) {
            if (defaultToLine) {
                if (!desktopShapeSelect?.value || desktopShapeSelect.value === '') {
                    if (desktopShapeSelect) {
                        desktopShapeSelect.value = 'line';
                        desktopShapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    shapeOpts.forEach(b => b.classList.toggle('active', b.dataset.shape === 'line'));
                    if (pillText) pillText.textContent = 'Line';
                    if (pillIcon) pillIcon.className = shapeIconMap['line'];
                }
            }
            mobileShapeSheet.classList.add('vtt-hidden');
            if (mobileBackdrop) mobileBackdrop.classList.remove('active');
            mobileShapePill.classList.remove('vtt-hidden');
        }

        function openShapeSheet() {
            mobileShapePill.classList.add('vtt-hidden');
            mobileShapeSheet.classList.remove('vtt-hidden');
            if (mobileBackdrop) mobileBackdrop.classList.add('active');
        }

        shapeOpts.forEach(btn => {
            btn.addEventListener('click', () => {
                const shape = btn.dataset.shape;
                shapeOpts.forEach(b => b.classList.toggle('active', b === btn));
                if (desktopShapeSelect) {
                    desktopShapeSelect.value = shape;
                    desktopShapeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (pillText) pillText.textContent = shapeNameMap[shape] || shape;
                if (pillIcon) pillIcon.className = shapeIconMap[shape] || 'fa-solid fa-shapes';
                // Minimize modal to top-left pill
                minimizeShapeSheet(false);
            });
        });

        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.dataset.color;
                colorSwatches.forEach(s => s.classList.toggle('active', s === swatch));
                if (desktopColorSelect) {
                    desktopColorSelect.value = color;
                    desktopColorSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (pillColor) pillColor.style.background = colorHexMap[color] || '#eab308';
            });
        });

        // Minimized shape pill re-opens the shape selector modal
        const handlePillClick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            openShapeSheet();
        };
        mobileShapePill.addEventListener('click', handlePillClick);
        mobileShapePill.addEventListener('touchend', handlePillClick);

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                minimizeShapeSheet(true);
            });
        }

        // Tap away on backdrop minimizes to pill with default Line if unselected
        if (mobileBackdrop) {
            mobileBackdrop.addEventListener('click', () => {
                if (!mobileShapeSheet.classList.contains('vtt-hidden')) {
                    minimizeShapeSheet(true);
                }
            });
            mobileBackdrop.addEventListener('touchend', () => {
                if (!mobileShapeSheet.classList.contains('vtt-hidden')) {
                    minimizeShapeSheet(true);
                }
            });
        }
    }

    function setupMobilePaintDrawer() {
        const modal = document.getElementById('modal-mobile-paint-drawer');
        if (!modal) return;

        const subtoolBtns = modal.querySelectorAll('.mobile-paint-tool-btn');
        const sizeSlider = document.getElementById('mobile-paint-size-slider');
        const sizeVal = document.getElementById('mobile-paint-size-val');
        const swatches = modal.querySelectorAll('.mobile-paint-swatch');
        const closeBtn = document.getElementById('btn-close-mobile-paint');
        const startBtn = document.getElementById('btn-mobile-start-drawing');

        subtoolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                subtoolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const subtool = btn.dataset.subtool;
                if (window.VTT?.canvasEngine?.setPaintSubTool) {
                    window.VTT.canvasEngine.setPaintSubTool(subtool);
                }
            });
        });

        if (sizeSlider) {
            sizeSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value) || 4;
                if (sizeVal) sizeVal.textContent = `${val}px`;
                if (window.VTT?.canvasEngine?.setPaintStrokeWidth) {
                    window.VTT.canvasEngine.setPaintStrokeWidth(val);
                }
            });
        }

        swatches.forEach(sw => {
            sw.addEventListener('click', () => {
                swatches.forEach(s => s.classList.remove('active'));
                sw.classList.add('active');
                const color = sw.dataset.color;
                if (window.VTT?.canvasEngine?.setPaintColor) {
                    window.VTT.canvasEngine.setPaintColor(color);
                }
            });
        });

        const hideDrawer = () => {
            modal.classList.add('vtt-hidden');
            if (mobileBackdrop) mobileBackdrop.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', hideDrawer);
        if (startBtn) startBtn.addEventListener('click', hideDrawer);
    }

    function setupMobileMapToolsUI() {
        const sheet = document.getElementById('vtt-mobile-maptools-sheet');
        if (!sheet) return;

        const closeBtn = document.getElementById('btn-close-maptools-sheet');
        const modeBtns = sheet.querySelectorAll('.mobile-maptools-mode-btn');
        const shapeBtns = sheet.querySelectorAll('.vtt-shape-opt');
        const cancelBtn = document.getElementById('btn-mobile-maptools-cancel');
        const doneBtn = document.getElementById('btn-mobile-maptools-done');
        const deleteBtn = document.getElementById('btn-mobile-maptools-delete');

        const shapeSection = document.getElementById('mobile-maptools-shape-section');
        const trapForm = document.getElementById('mobile-maptools-trap-form');
        const portalForm = document.getElementById('mobile-maptools-portal-form');
        const headerTitle = document.getElementById('mobile-maptools-header-title');

        // Trap form controls
        const trapNameInput = document.getElementById('mobile-trap-name-input');
        const trapAbilitySelect = document.getElementById('mobile-trap-ability-select');
        const trapDcVal = document.getElementById('mobile-trap-dc-val');
        const trapDcMinus = document.getElementById('btn-mobile-trap-dc-minus');
        const trapDcPlus = document.getElementById('btn-mobile-trap-dc-plus');
        const trapDamageInput = document.getElementById('mobile-trap-damage-input');
        const trapAutoCheck = document.getElementById('mobile-trap-auto-check');
        const trapRepeatCheck = document.getElementById('mobile-trap-repeat-check');
        const damageChips = sheet.querySelectorAll('.mobile-chip-btn');

        // Portal form controls
        const portalNameInput = document.getElementById('mobile-portal-name-input');
        const portalTargetMapSelect = document.getElementById('mobile-portal-target-map-select');
        const portalTargetPortalSelect = document.getElementById('mobile-portal-target-portal-select');
        const portalWalkCheck = document.getElementById('mobile-portal-walkthrough-check');
        const portalRevealCheck = document.getElementById('mobile-portal-revealed-check');

        // Desktop controls to bridge with
        const desktopTrapName = document.getElementById('maptools-trap-name');
        const desktopTrapAbility = document.getElementById('maptools-trap-ability');
        const desktopTrapDc = document.getElementById('maptools-trap-dc');
        const desktopTrapDamage = document.getElementById('maptools-trap-damage');
        const desktopTrapAuto = document.getElementById('maptools-trap-auto');
        const desktopTrapRepeat = document.getElementById('maptools-trap-repeat');
        const desktopSaveTrapBtn = document.getElementById('btn-save-trap');
        const desktopDeleteTrapBtn = document.getElementById('btn-delete-selected-trap');
        const desktopCancelEditTrapBtn = document.getElementById('btn-cancel-edit-trap');

        const desktopPortalName = document.getElementById('maptools-portal-name');
        const desktopPortalTargetMap = document.getElementById('maptools-portal-target-map');
        const desktopPortalTargetPortal = document.getElementById('maptools-portal-target-portal');
        const desktopPortalWalk = document.getElementById('maptools-portal-walkthrough');
        const desktopPortalReveal = document.getElementById('maptools-portal-revealed');
        const desktopSavePortalBtn = document.getElementById('btn-save-portal');
        const desktopDeletePortalBtn = document.getElementById('btn-delete-selected-portal');

        function resetToShapeSelection() {
            if (shapeSection) shapeSection.classList.remove('vtt-hidden');
            if (trapForm) trapForm.classList.add('vtt-hidden');
            if (portalForm) portalForm.classList.add('vtt-hidden');
            if (doneBtn) doneBtn.classList.add('vtt-hidden');
            if (deleteBtn) deleteBtn.classList.add('vtt-hidden');
            if (headerTitle) headerTitle.textContent = 'Map Tools';
        }

        function showTrapConfig() {
            if (shapeSection) shapeSection.classList.add('vtt-hidden');
            if (portalForm) portalForm.classList.add('vtt-hidden');
            if (trapForm) trapForm.classList.remove('vtt-hidden');
            if (doneBtn) doneBtn.classList.remove('vtt-hidden');
            if (deleteBtn) deleteBtn.classList.remove('vtt-hidden');
            if (headerTitle) headerTitle.textContent = 'Configure Trap';

            modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === 'traps'));

            // Sync from desktop inputs
            if (desktopTrapName && trapNameInput) trapNameInput.value = desktopTrapName.value;
            if (desktopTrapAbility && trapAbilitySelect) trapAbilitySelect.value = desktopTrapAbility.value;
            if (desktopTrapDc && trapDcVal) trapDcVal.textContent = desktopTrapDc.value || '15';
            if (desktopTrapDamage && trapDamageInput) trapDamageInput.value = desktopTrapDamage.value;
            if (desktopTrapAuto && trapAutoCheck) trapAutoCheck.checked = desktopTrapAuto.checked;
            if (desktopTrapRepeat && trapRepeatCheck) trapRepeatCheck.checked = desktopTrapRepeat.checked;
        }

        function showPortalConfig() {
            if (shapeSection) shapeSection.classList.add('vtt-hidden');
            if (trapForm) trapForm.classList.add('vtt-hidden');
            if (portalForm) portalForm.classList.remove('vtt-hidden');
            if (doneBtn) doneBtn.classList.remove('vtt-hidden');
            if (deleteBtn) deleteBtn.classList.remove('vtt-hidden');
            if (headerTitle) headerTitle.textContent = 'Configure Portal';

            modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === 'portals'));

            // Sync dropdown options from desktop
            if (desktopPortalTargetMap && portalTargetMapSelect) {
                portalTargetMapSelect.innerHTML = desktopPortalTargetMap.innerHTML;
                portalTargetMapSelect.value = desktopPortalTargetMap.value;
            }
            if (desktopPortalTargetPortal && portalTargetPortalSelect) {
                portalTargetPortalSelect.innerHTML = desktopPortalTargetPortal.innerHTML;
                portalTargetPortalSelect.value = desktopPortalTargetPortal.value;
            }

            // Sync inputs from desktop
            if (desktopPortalName && portalNameInput) portalNameInput.value = desktopPortalName.value;
            if (desktopPortalWalk && portalWalkCheck) portalWalkCheck.checked = desktopPortalWalk.checked;
            if (desktopPortalReveal && portalRevealCheck) portalRevealCheck.checked = desktopPortalReveal.checked;
        }

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sheet.classList.add('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('active');
            });
        }

        // Mode buttons (Traps / Portals)
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.mode;
                if (window.VTT?.canvasEngine?.setMapToolSubmode) {
                    window.VTT.canvasEngine.setMapToolSubmode(mode);
                }
                resetToShapeSelection();
            });
        });

        // Shape buttons (tap to set shape & minimize sheet to canvas so user can draw)
        shapeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                shapeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const shape = btn.dataset.shape;
                if (window.VTT?.canvasEngine?.setMapToolShape) {
                    window.VTT.canvasEngine.setMapToolShape(shape);
                }
                // Minimize sheet so user can draw freely on canvas
                sheet.classList.add('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('active');
                if (navigator.vibrate) navigator.vibrate(20);
            });
        });

        // Trap DC Stepper
        if (trapDcMinus) {
            trapDcMinus.addEventListener('click', () => {
                let cur = parseInt(trapDcVal.textContent) || 15;
                if (cur > 1) {
                    cur--;
                    trapDcVal.textContent = cur;
                    if (desktopTrapDc) desktopTrapDc.value = cur;
                    if (navigator.vibrate) navigator.vibrate(15);
                }
            });
        }
        if (trapDcPlus) {
            trapDcPlus.addEventListener('click', () => {
                let cur = parseInt(trapDcVal.textContent) || 15;
                if (cur < 30) {
                    cur++;
                    trapDcVal.textContent = cur;
                    if (desktopTrapDc) desktopTrapDc.value = cur;
                    if (navigator.vibrate) navigator.vibrate(15);
                }
            });
        }

        // Trap Damage Quick Chips
        damageChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const dmg = chip.dataset.damage;
                if (dmg) {
                    if (trapDamageInput) trapDamageInput.value = dmg;
                    if (desktopTrapDamage) desktopTrapDamage.value = dmg;
                    if (navigator.vibrate) navigator.vibrate(20);
                }
            });
        });

        // Two-way sync: mobile inputs to desktop
        if (trapNameInput && desktopTrapName) {
            trapNameInput.addEventListener('input', () => { desktopTrapName.value = trapNameInput.value; });
        }
        if (trapAbilitySelect && desktopTrapAbility) {
            trapAbilitySelect.addEventListener('change', () => { desktopTrapAbility.value = trapAbilitySelect.value; });
        }
        if (trapDamageInput && desktopTrapDamage) {
            trapDamageInput.addEventListener('input', () => { desktopTrapDamage.value = trapDamageInput.value; });
        }
        if (trapAutoCheck && desktopTrapAuto) {
            trapAutoCheck.addEventListener('change', () => { desktopTrapAuto.checked = trapAutoCheck.checked; });
        }
        if (trapRepeatCheck && desktopTrapRepeat) {
            trapRepeatCheck.addEventListener('change', () => { desktopTrapRepeat.checked = trapRepeatCheck.checked; });
        }

        if (portalNameInput && desktopPortalName) {
            portalNameInput.addEventListener('input', () => { desktopPortalName.value = portalNameInput.value; });
        }
        if (portalTargetMapSelect && desktopPortalTargetMap) {
            portalTargetMapSelect.addEventListener('change', () => {
                desktopPortalTargetMap.value = portalTargetMapSelect.value;
                desktopPortalTargetMap.dispatchEvent(new Event('change', { bubbles: true }));
                setTimeout(() => {
                    if (desktopPortalTargetPortal && portalTargetPortalSelect) {
                        portalTargetPortalSelect.innerHTML = desktopPortalTargetPortal.innerHTML;
                        portalTargetPortalSelect.value = desktopPortalTargetPortal.value;
                    }
                }, 80);
            });
        }
        if (portalTargetPortalSelect && desktopPortalTargetPortal) {
            portalTargetPortalSelect.addEventListener('change', () => {
                desktopPortalTargetPortal.value = portalTargetPortalSelect.value;
            });
        }
        if (portalWalkCheck && desktopPortalWalk) {
            portalWalkCheck.addEventListener('change', () => { desktopPortalWalk.checked = portalWalkCheck.checked; });
        }
        if (portalRevealCheck && desktopPortalReveal) {
            portalRevealCheck.addEventListener('change', () => { desktopPortalReveal.checked = portalRevealCheck.checked; });
        }

        // Done button: Save changes & dismiss sheet
        if (doneBtn) {
            doneBtn.addEventListener('click', () => {
                const isTrap = !trapForm.classList.contains('vtt-hidden');
                if (isTrap) {
                    if (desktopSaveTrapBtn) desktopSaveTrapBtn.click();
                } else {
                    if (desktopSavePortalBtn) desktopSavePortalBtn.click();
                }
                if (desktopCancelEditTrapBtn) desktopCancelEditTrapBtn.click();
                resetToShapeSelection();
                sheet.classList.add('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('active');
                if (navigator.vibrate) navigator.vibrate(30);
            });
        }

        // Delete button
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const isTrap = !trapForm.classList.contains('vtt-hidden');
                if (isTrap) {
                    if (desktopDeleteTrapBtn) desktopDeleteTrapBtn.click();
                } else {
                    if (desktopDeletePortalBtn) desktopDeletePortalBtn.click();
                }
                if (desktopCancelEditTrapBtn) desktopCancelEditTrapBtn.click();
                resetToShapeSelection();
                sheet.classList.add('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('active');
                if (navigator.vibrate) navigator.vibrate(40);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (window.VTT?.canvasEngine?.cancelMapToolDrawing) {
                    window.VTT.canvasEngine.cancelMapToolDrawing();
                }
                resetToShapeSelection();
                sheet.classList.add('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('active');
            });
        }

        // Auto slide-up Observer: Detect when desktop selects a trap or portal
        const trapBanner = document.getElementById('maptools-trap-edit-banner');
        const portalActions = document.getElementById('maptools-portal-edit-actions');

        const handleMapToolSelectionChange = () => {
            if (!isMobileViewport()) return;

            const isTrapSelected = trapBanner && !trapBanner.classList.contains('vtt-hidden');
            const isPortalSelected = portalActions && !portalActions.classList.contains('vtt-hidden');

            if (isTrapSelected) {
                showTrapConfig();
                sheet.classList.remove('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.add('active');
                if (navigator.vibrate) navigator.vibrate(30);
            } else if (isPortalSelected) {
                showPortalConfig();
                sheet.classList.remove('vtt-hidden');
                if (mobileBackdrop) mobileBackdrop.classList.add('active');
                if (navigator.vibrate) navigator.vibrate(30);
            } else {
                resetToShapeSelection();
            }
        };

        if (trapBanner) {
            const trapObs = new MutationObserver(handleMapToolSelectionChange);
            trapObs.observe(trapBanner, { attributes: true, attributeFilter: ['class'] });
        }
        if (portalActions) {
            const portalObs = new MutationObserver(handleMapToolSelectionChange);
            portalObs.observe(portalActions, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function setupModalBackdropDismissal() {
        const dismissModal = (e) => {
            if (e.target.classList && e.target.classList.contains('vtt-modal')) {
                e.target.classList.add('vtt-hidden');
            }
        };
        document.addEventListener('click', dismissModal);
        document.addEventListener('touchend', dismissModal);
    }

    // ========================================================================
    // 4B. UNIFIED FLOATING RADIAL TOUCH DIAL (TOKEN ACTIONS, SIZE & ROTATION)
    // ========================================================================
    function setupMobileRadialDial() {
        if (!mobileRadialDial) return;

        const hubBtn = document.getElementById('radial-hub-btn');
        const btnSheet = document.getElementById('radial-node-sheet');
        const btnRotCw = document.getElementById('radial-node-rot-cw');
        const btnSizePlus = document.getElementById('radial-node-size-plus');
        const btnEdit = document.getElementById('radial-node-edit');
        const btnCond = document.getElementById('radial-node-cond');
        const btnSizeMinus = document.getElementById('radial-node-size-minus');
        const btnRotCcw = document.getElementById('radial-node-rot-ccw');

        // Hub button closes the dial
        if (hubBtn) {
            hubBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hideMobileRadialDial();
            });
        }

        // Sheet Node: Opens Character or Creature sheet
        if (btnSheet) {
            btnSheet.addEventListener('click', (e) => {
                e.stopPropagation();
                const tok = currentRadialToken;
                hideMobileRadialDial();
                if (!tok) return;

                if (tok.characterId) {
                    if (window.VTT?.playerSheet?.openSheet) {
                        window.VTT.playerSheet.openSheet(tok.characterId);
                    }
                    openMobilePlayerSheet();
                } else if (tok.monsterData || tok.isNpc) {
                    if (window.VTT?.creatureSheet?.loadMonster) {
                        window.VTT.creatureSheet.loadMonster(tok.monsterData);
                    }
                    if (creatureSheetPanel) {
                        creatureSheetPanel.classList.remove('minimized');
                        creatureSheetPanel.classList.add('open');
                        if (mobileBackdrop) mobileBackdrop.classList.add('active');
                    }
                } else {
                    openMobilePlayerSheet();
                }
            });
        }

        // Rotate +45° Clockwise Node
        if (btnRotCw) {
            btnRotCw.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentRadialToken?.id) return;
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.stepTokenRotation) {
                    const newRot = canvasEngine.stepTokenRotation(currentRadialToken.id, 45);
                    currentRadialToken.rotation = newRot;
                    if (navigator.vibrate) navigator.vibrate(25);
                }
            });
        }

        // Size + Node (Increases token size: 0.5 -> 1 -> 2 -> 3 -> 4)
        if (btnSizePlus) {
            btnSizePlus.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentRadialToken?.id) return;
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.stepTokenSize) {
                    const newSize = canvasEngine.stepTokenSize(currentRadialToken.id, 1);
                    currentRadialToken.size = newSize;
                    const hubSizeEl = document.getElementById('radial-hub-size');
                    if (hubSizeEl) hubSizeEl.textContent = `${newSize}x${newSize}`;
                    if (navigator.vibrate) navigator.vibrate(25);
                }
            });
        }

        // Edit Node: Opens token config modal
        if (btnEdit) {
            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                const tok = currentRadialToken;
                hideMobileRadialDial();
                if (tok?.id && window.VTT?.canvasEngine?.openTokenEditModal) {
                    window.VTT.canvasEngine.openTokenEditModal(tok.id);
                }
            });
        }

        // Status & Conditions Node
        if (btnCond) {
            btnCond.addEventListener('click', (e) => {
                e.stopPropagation();
                const tok = currentRadialToken;
                hideMobileRadialDial();
                if (tok?.id) {
                    const canvasEngine = window.VTT?.canvasEngine;
                    const existing = document.getElementById('vtt-gm-token-tooltip');
                    if (existing) {
                        if (canvasEngine?.hideGmTokenTooltip) {
                            canvasEngine.hideGmTokenTooltip();
                        } else {
                            existing.remove();
                        }
                    } else if (canvasEngine?.showGmTokenTooltip) {
                        canvasEngine.showGmTokenTooltip(tok.id, true);
                    }
                }
            });
        }

        // Size − Node (Decreases token size)
        if (btnSizeMinus) {
            btnSizeMinus.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentRadialToken?.id) return;
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.stepTokenSize) {
                    const newSize = canvasEngine.stepTokenSize(currentRadialToken.id, -1);
                    currentRadialToken.size = newSize;
                    const hubSizeEl = document.getElementById('radial-hub-size');
                    if (hubSizeEl) hubSizeEl.textContent = `${newSize}x${newSize}`;
                    if (navigator.vibrate) navigator.vibrate(25);
                }
            });
        }

        // Rotate −45° Counter-Clockwise Node
        if (btnRotCcw) {
            btnRotCcw.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentRadialToken?.id) return;
                const canvasEngine = window.VTT?.canvasEngine;
                if (canvasEngine?.stepTokenRotation) {
                    const newRot = canvasEngine.stepTokenRotation(currentRadialToken.id, -45);
                    currentRadialToken.rotation = newRot;
                    if (navigator.vibrate) navigator.vibrate(25);
                }
            });
        }
    }

    function showMobileRadialDial(x, y, token) {
        if (!mobileRadialDial || !token) return;
        currentRadialToken = token;

        // Anchor to exact token center if canvas coordinate bridge is available
        let targetX = x;
        let targetY = y;
        const canvasEngine = window.VTT?.canvasEngine;
        if (canvasEngine?.getTokenScreenCoords) {
            const coords = canvasEngine.getTokenScreenCoords(token.id);
            if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
                targetX = coords.x;
                targetY = coords.y;
            }
        }

        // Clamp so the 170px dial ring doesn't clip offscreen edges
        const halfDial = 92;
        const clampedX = Math.max(halfDial + 8, Math.min(window.innerWidth - halfDial - 8, targetX));
        const clampedY = Math.max(halfDial + 8, Math.min(window.innerHeight - halfDial - 70, targetY));

        mobileRadialDial.style.left = `${clampedX}px`;
        mobileRadialDial.style.top = `${clampedY}px`;

        // Update hub size text
        const hubSizeEl = document.getElementById('radial-hub-size');
        if (hubSizeEl) {
            const sz = token.size || 1;
            hubSizeEl.textContent = `${sz}x${sz}`;
        }

        mobileRadialDial.classList.remove('vtt-hidden');
        if (navigator.vibrate) navigator.vibrate(20);
    }

    function hideMobileRadialDial() {
        if (!mobileRadialDial) return;
        mobileRadialDial.classList.add('vtt-hidden');
        currentRadialToken = null;
    }

    // ========================================================================
    // 4C. MOBILE SHEET SWITCHER CAROUSEL (PERSISTENT AVATAR DOCK)
    // ========================================================================
    function setupMobileSheetCarousel() {
        if (!mobileSheetCarousel || !mobileSheetTrack) return;
        renderMobileSheetCarousel();
    }

    function renderMobileSheetCarousel() {
        if (!mobileSheetTrack || !mobileSheetCarousel) return;
        mobileSheetTrack.innerHTML = '';

        const items = [];
        const seenKeys = new Set();

        // 1. Gather party characters from campaignState
        if (vtt.campaignState?.characters) {
            Object.entries(vtt.campaignState.characters).forEach(([charId, c]) => {
                if (c && !seenKeys.has(charId)) {
                    seenKeys.add(charId);
                    items.push({
                        id: charId,
                        name: c.name || 'Hero',
                        avatar: c.avatar || c.tokenImage || 'img/logo.png',
                        type: 'player',
                        roleCategory: 'pc',
                        characterId: charId
                    });
                }
            });
        }

        // 2. Gather docked sheets from sheetDock tabs
        if (vtt.sheetDock?.tabs) {
            vtt.sheetDock.tabs.forEach((tab, key) => {
                const id = tab.characterId || tab.id || key;
                if (!seenKeys.has(id)) {
                    seenKeys.add(id);
                    const isPc = tab.roleCategory === 'player' || tab.type === 'player';
                    const isNpc = tab.roleCategory === 'companion' || tab.isCustomNpc;
                    items.push({
                        id: id,
                        name: tab.tabName || 'Creature',
                        avatar: tab.tabAvatar || 'img/logo.png',
                        type: isPc ? 'player' : 'creature',
                        roleCategory: isPc ? 'pc' : (isNpc ? 'npc' : 'creature'),
                        characterId: tab.characterId,
                        monsterData: tab.monsterData,
                        tokenId: tab.activeTokenId || tab.tokenId,
                        tabKey: key
                    });
                }
            });
        }

        // 3. Gather active canvas tokens for creatures / NPCs
        const canvasEngine = window.VTT?.canvasEngine;
        if (canvasEngine?.tokens) {
            Object.values(canvasEngine.tokens).forEach(t => {
                if (!t) return;
                const tKey = t.characterId ? t.characterId : (t.monsterData?.name || t.name || t.id);
                if (tKey && !seenKeys.has(tKey) && (t.characterId || t.monsterData || t.isNpc)) {
                    seenKeys.add(tKey);
                    const isPc = !!t.characterId;
                    const isNpc = !!t.isNpc;
                    items.push({
                        id: t.id,
                        name: t.name || 'Token',
                        avatar: t.image || t.avatar || 'img/logo.png',
                        type: isPc ? 'player' : 'creature',
                        roleCategory: isPc ? 'pc' : (isNpc ? 'npc' : 'creature'),
                        characterId: t.characterId,
                        monsterData: t.monsterData,
                        tokenId: t.id
                    });
                }
            });
        }

        if (items.length === 0) {
            mobileSheetCarousel.classList.add('vtt-hidden');
            return;
        }

        if (activeNavTab === 'map' || playerSheetPanel?.classList.contains('open') || creatureSheetPanel?.classList.contains('open')) {
            mobileSheetCarousel.classList.remove('vtt-hidden');
        }

        let lastChipTapTime = 0;
        let lastChipTapId = null;

        items.forEach(item => {
            const chip = document.createElement('div');
            chip.className = `mobile-sheet-chip chip-${item.roleCategory || 'creature'}`;
            chip.dataset.id = item.id;
            chip.title = `${item.name} (Tap: open sheet | Double-tap: focus token)`;

            const isPlayerOpen = playerSheetPanel && playerSheetPanel.classList.contains('open');
            if (item.type === 'player' && isPlayerOpen) {
                chip.classList.add('chip-active');
            }

            const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
            chip.innerHTML = `
                <img src="${item.avatar}" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                <span class="chip-monogram" style="display: none;">${initial}</span>
            `;

            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const now = Date.now();
                const isDoubleTap = (lastChipTapId === item.id) && (now - lastChipTapTime < 350);
                lastChipTapTime = now;
                lastChipTapId = item.id;

                if (isDoubleTap) {
                    // Double-tap: Center map on token!
                    let tokId = item.tokenId;
                    if (!tokId && item.characterId && canvasEngine?.tokens) {
                        const match = Object.values(canvasEngine.tokens).find(tok => tok.characterId === item.characterId);
                        if (match) tokId = match.id;
                    }
                    if (tokId && canvasEngine?.selectToken) {
                        canvasEngine.selectToken(tokId);
                    }
                    if (canvasEngine?.centerOnToken) {
                        canvasEngine.centerOnToken();
                    }
                    // Close open sheets so player sees the centered token
                    if (playerSheetPanel) {
                        playerSheetPanel.classList.remove('open');
                        playerSheetPanel.classList.add('minimized');
                    }
                    if (creatureSheetPanel) {
                        creatureSheetPanel.classList.remove('open');
                        creatureSheetPanel.classList.add('minimized');
                    }
                    if (mobileBackdrop) mobileBackdrop.classList.remove('active');
                    if (navigator.vibrate) navigator.vibrate(35);
                    return;
                }

                // Single tap: Open corresponding sheet
                mobileSheetTrack.querySelectorAll('.mobile-sheet-chip').forEach(c => c.classList.remove('chip-active'));
                chip.classList.add('chip-active');
                if (navigator.vibrate) navigator.vibrate(20);

                if (item.tabKey && vtt.sheetDock?.activateTab) {
                    vtt.sheetDock.activateTab(item.tabKey);
                    if (item.type === 'player') {
                        openMobilePlayerSheet();
                    } else if (creatureSheetPanel) {
                        creatureSheetPanel.classList.remove('minimized');
                        creatureSheetPanel.classList.add('open');
                        if (mobileBackdrop) mobileBackdrop.classList.add('active');
                    }
                } else if (item.type === 'player') {
                    if (window.VTT?.playerSheet?.openSheet) {
                        window.VTT.playerSheet.openSheet(item.characterId || item.id);
                    }
                    openMobilePlayerSheet();
                } else {
                    if (item.monsterData && window.VTT?.creatureSheet?.openSheet) {
                        window.VTT.creatureSheet.openSheet(item.monsterData, item.tokenId, item.characterId);
                    } else if (item.monsterData && window.VTT?.creatureSheet?.loadMonster) {
                        window.VTT.creatureSheet.loadMonster(item.monsterData);
                    }
                    if (creatureSheetPanel) {
                        creatureSheetPanel.classList.remove('minimized');
                        creatureSheetPanel.classList.add('open');
                        if (mobileBackdrop) mobileBackdrop.classList.add('active');
                    }
                }
            });

            mobileSheetTrack.appendChild(chip);
        });
    }

    // ========================================================================
    // 4D. ONE-TAP BATTERY / ECO MODE CONTROLLER
    // ========================================================================
    function setupMobileEcoMode() {
        const savedEco = localStorage.getItem('vtt_eco_mode') === 'true';
        if (savedEco) {
            setEcoMode(true, false);
        }

        if (mobileToolEco) {
            mobileToolEco.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleEcoMode();
            });
        }
    }

    function isEcoMode() {
        return isEcoModeActive;
    }

    function setEcoMode(enable, showToast = true) {
        isEcoModeActive = !!enable;
        localStorage.setItem('vtt_eco_mode', isEcoModeActive ? 'true' : 'false');

        // Weather Engine particle pause/resume
        const weather = vtt.weatherEngine || window.VTT?.weatherEngine;
        if (weather) {
            if (isEcoModeActive) {
                previousWeatherQuality = weather.getQuality?.() || localStorage.getItem('vtt_weather_quality') || 'high';
                weather.setQuality('off');
            } else {
                const restoreQ = previousWeatherQuality && previousWeatherQuality !== 'off' ? previousWeatherQuality : 'high';
                weather.setQuality(restoreQ);
            }
        }

        // 3D Dice physics pause/resume (falls back automatically to 2D chat dice)
        if (window.Dice3D) {
            window.Dice3D.setEnabled(!isEcoModeActive);
        }

        // Update FAB Eco Badge
        if (mobileFabEcoBadge) {
            if (isEcoModeActive) {
                mobileFabEcoBadge.classList.remove('vtt-hidden');
            } else {
                mobileFabEcoBadge.classList.add('vtt-hidden');
            }
        }

        // Update FAB Menu Eco Button
        if (mobileToolEco) {
            mobileToolEco.classList.toggle('active', isEcoModeActive);
        }

        // Update More Tab Eco Card
        const ecoCard = document.getElementById('more-card-eco');
        if (ecoCard) {
            const desc = ecoCard.querySelector('.eco-status-text');
            if (desc) {
                desc.textContent = isEcoModeActive ? 'Active (Particles & 3D Paused)' : 'Disabled (Full Effects)';
                desc.style.color = isEcoModeActive ? '#22c55e' : '#94a3b8';
            }
            ecoCard.style.borderColor = isEcoModeActive ? 'rgba(34, 197, 94, 0.5)' : '';
        }

        if (showToast && window.VTT?.chatEngine?.appendSystemMessage) {
            const msg = isEcoModeActive
                ? '🌿 Eco Mode Enabled: Weather particles & 3D dice paused to preserve battery.'
                : '✨ Eco Mode Disabled: Full weather effects & 3D dice restored.';
            window.VTT.chatEngine.appendSystemMessage(msg);
        }
        if (navigator.vibrate) navigator.vibrate(25);
    }

    function toggleEcoMode() {
        setEcoMode(!isEcoModeActive, true);
    }

    // ========================================================================
    // 5. LIVE INITIATIVE TURN BADGE & FLOATING COMBAT PILL OBSERVER
    // ========================================================================
    function setupTurnBadgeObserver() {
        const roundNumEl = document.getElementById('init-round-num');
        const initListEl = document.getElementById('init-list');

        function updateBadge() {
            const badge = document.getElementById('mobile-init-badge');
            if (!badge) return;

            const round = roundNumEl ? roundNumEl.textContent.trim() : '1';
            const hasCombatants = initListEl && !initListEl.querySelector('.init-empty-state') && initListEl.children.length > 0;

            if (hasCombatants && round) {
                badge.textContent = `R${round}`;
                badge.classList.remove('vtt-hidden');
            } else {
                badge.classList.add('vtt-hidden');
            }
        }

        // Periodic light observer for round and active combat updates
        setInterval(updateBadge, 2000);
    }

    function setupFloatingCombatPill() {
        const combatPill = document.getElementById('vtt-mobile-combat-pill');
        if (!combatPill) return;

        const pillAvatar = document.getElementById('mobile-combat-pill-avatar');
        const pillName = document.getElementById('mobile-combat-pill-name');
        const pillRound = document.getElementById('mobile-combat-pill-round');
        const pillHp = document.getElementById('mobile-combat-pill-hp');
        const prevBtn = document.getElementById('btn-mobile-combat-prev');
        const nextBtn = document.getElementById('btn-mobile-combat-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const desktopPrev = document.getElementById('btn-init-prev');
                if (desktopPrev) desktopPrev.click();
                if (navigator.vibrate) navigator.vibrate(25);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const desktopNext = document.getElementById('btn-init-next');
                if (desktopNext) desktopNext.click();
                if (navigator.vibrate) navigator.vibrate(25);
            });
        }

        // Tapping the pill opens the full initiative drawer
        combatPill.addEventListener('click', (e) => {
            if (e.target.closest('#btn-mobile-combat-prev') || e.target.closest('#btn-mobile-combat-next')) return;
            openMobileInitiativeDrawer();
            setActiveNavTab('initiative');
        });

        function updateFloatingCombatPill() {
            if (!isMobileViewport()) {
                combatPill.classList.add('vtt-hidden');
                return;
            }

            const initList = document.getElementById('init-list');
            const roundNumEl = document.getElementById('init-round-num');
            const hasCombatants = initList && !initList.querySelector('.init-empty-state') && initList.children.length > 0;

            if (!hasCombatants) {
                combatPill.classList.add('vtt-hidden');
                return;
            }

            const activeCard = initList.querySelector('.init-carousel-card--active') ||
                               initList.querySelector('.init-carousel-card.active') ||
                               initList.querySelector('.init-carousel-card');

            if (!activeCard) {
                combatPill.classList.add('vtt-hidden');
                return;
            }

            // Name
            const nameEl = activeCard.querySelector('.init-card-name');
            const name = nameEl ? nameEl.textContent.trim() : 'Combatant';
            if (pillName) pillName.textContent = name;

            // Round
            const round = roundNumEl ? roundNumEl.textContent.trim() : '1';
            if (pillRound) pillRound.textContent = `Round ${round}`;

            // HP
            const hpPill = activeCard.querySelector('.init-card-hp-pill');
            if (pillHp) {
                if (hpPill && hpPill.textContent.trim()) {
                    pillHp.textContent = `HP: ${hpPill.textContent.trim()}`;
                    pillHp.style.background = hpPill.style.background || 'rgba(34, 197, 94, 0.2)';
                    pillHp.classList.remove('vtt-hidden');
                } else {
                    pillHp.classList.add('vtt-hidden');
                }
            }

            // Avatar
            const avatarImg = activeCard.querySelector('.init-card-img img');
            if (pillAvatar) {
                if (avatarImg && avatarImg.src && !avatarImg.src.endsWith('favicon.svg')) {
                    pillAvatar.src = avatarImg.src;
                } else {
                    pillAvatar.src = 'favicon.svg';
                }
            }

            // Role check for GM chevrons
            const role = vtt.role || 'Player';
            const actionsWrap = combatPill.querySelector('.mobile-combat-pill-actions');
            if (actionsWrap) {
                actionsWrap.style.display = (role === 'GM') ? 'flex' : 'none';
            }

            combatPill.classList.remove('vtt-hidden');
        }

        updateFloatingCombatPillFn = updateFloatingCombatPill;

        // Live observation on init-list mutations
        const initList = document.getElementById('init-list');
        if (initList) {
            const observer = new MutationObserver(() => updateFloatingCombatPill());
            observer.observe(initList, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }

        // Periodic fallback sync
        setInterval(updateFloatingCombatPill, 1500);

        // Run immediately
        updateFloatingCombatPill();

        return updateFloatingCombatPill;
    }

    // ========================================================================
    // 5B. TAP-TO-PLACE TOKEN SYSTEM
    // ========================================================================
    function executeTapPlacement(x, y) {
        if (!pendingPlacementPayload) return;
        const p = pendingPlacementPayload;
        try {
            if (p.type === 'monster') {
                if (window.VTT?.spawnMonsterAtCoords) window.VTT.spawnMonsterAtCoords(p.monster, x, y);
                else if (window.VTT?.dataBridge?.spawnMonsterAtCoords) window.VTT.dataBridge.spawnMonsterAtCoords(p.monster, x, y);
            } else if (p.type === 'customNpc') {
                if (window.VTT?.spawnCustomNpcAtCoords) window.VTT.spawnCustomNpcAtCoords(p.npc, x, y);
                else if (window.VTT?.dataBridge?.spawnCustomNpcAtCoords) window.VTT.dataBridge.spawnCustomNpcAtCoords(p.npc, x, y);
            } else if (p.type === 'character') {
                if (window.VTT?.spawnCharacterAtCoords) window.VTT.spawnCharacterAtCoords(p.char, x, y);
                else if (window.VTT?.dataBridge?.spawnCharacterAtCoords) window.VTT.dataBridge.spawnCharacterAtCoords(p.char, x, y);
            } else if (p.type === 'asset') {
                if (window.VTT?.spawnAssetAtCoords) window.VTT.spawnAssetAtCoords(p.asset, x, y);
                else if (window.VTT?.dataBridge?.spawnAssetAtCoords) window.VTT.dataBridge.spawnAssetAtCoords(p.asset, x, y);
            }
            if (navigator.vibrate) navigator.vibrate(35);
        } catch (err) {
            console.error('[MobileAdapter] Error executing tap placement:', err);
        }
    }

    function startTapToPlaceMode(payload) {
        if (!payload) return;
        isTapToPlaceActive = true;
        pendingPlacementPayload = payload;

        const banner = document.getElementById('vtt-mobile-placement-banner');
        const targetName = document.getElementById('mobile-placement-target-name');
        if (targetName) {
            targetName.textContent = payload.name || payload.title || 'Token';
        }
        if (banner) {
            banner.classList.remove('vtt-hidden');
        }

        // Close any open drawers so user sees canvas clearly
        closeAllDrawers();
        setActiveNavTab('map');
        if (navigator.vibrate) navigator.vibrate(30);
    }

    function cancelTapToPlaceMode() {
        isTapToPlaceActive = false;
        pendingPlacementPayload = null;
        const banner = document.getElementById('vtt-mobile-placement-banner');
        if (banner) {
            banner.classList.add('vtt-hidden');
        }
    }

    function setupTapToPlaceMode() {
        if (!canvasInteraction) return;

        // Also intercept direct clicks for touch emulation / hybrid tablets
        canvasInteraction.addEventListener('click', (e) => {
            if (isTapToPlaceActive && pendingPlacementPayload) {
                e.stopPropagation();
                e.preventDefault();
                if (window.VTT?.canvasEngine?.getCanvasMouseCoords) {
                    const coords = window.VTT.canvasEngine.getCanvasMouseCoords({ clientX: e.clientX, clientY: e.clientY });
                    if (coords) {
                        executeTapPlacement(coords.x, coords.y);
                    }
                }
                cancelTapToPlaceMode();
            }
        }, true);

        const cancelPlacementBtn = document.getElementById('btn-mobile-placement-cancel');
        if (cancelPlacementBtn) {
            cancelPlacementBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cancelTapToPlaceMode();
                if (navigator.vibrate) navigator.vibrate(20);
            });
        }
    }

    // ========================================================================
    // 6. DRAWER EDGE-SWIPE & SWIPE-DOWN DISMISSAL
    // ========================================================================
    function setupDrawerSwipeDismiss() {
        const panels = [
            sidebar,
            playerSheetPanel,
            creatureSheetPanel,
            initContainer
        ].filter(Boolean);

        panels.forEach(panel => {
            let startY = 0;
            let startX = 0;
            let startTime = 0;
            let isTracking = false;

            panel.addEventListener('touchstart', (e) => {
                if (!isMobileViewport()) return;
                if (e.touches.length !== 1) {
                    isTracking = false;
                    return;
                }

                const touch = e.touches[0];
                startY = touch.clientY;
                startX = touch.clientX;
                startTime = Date.now();

                // Check if touch starts on header bar, or scrollable area is at top, or near screen edges
                const target = e.target;
                const isHeader = target.closest('.mobile-drawer-header') || target.closest('.mobile-sheet-topbar') || target.closest('.init-controls-top');
                const scrollableAncestor = target.closest('.scroll-styled, .tab-panel, .sidebar-content, #chat-messages, .ps-tabs-body');
                const isAtScrollTop = !scrollableAncestor || scrollableAncestor.scrollTop <= 2;
                const isEdge = touch.clientY <= 100 || touch.clientX <= 25 || touch.clientX >= (window.innerWidth - 25);

                if (isHeader || isAtScrollTop || isEdge) {
                    isTracking = true;
                } else {
                    isTracking = false;
                }
            }, { passive: true });

            panel.addEventListener('touchend', (e) => {
                if (!isTracking || !isMobileViewport()) return;
                isTracking = false;

                const touch = e.changedTouches[0];
                if (!touch) return;

                const deltaY = touch.clientY - startY;
                const deltaX = touch.clientX - startX;
                const elapsed = Date.now() - startTime;

                // Detect swipe down (pulling down to close)
                const isSwipeDown = deltaY > 65 && deltaY > Math.abs(deltaX) * 1.25;
                // Detect fast flick down
                const isFlickDown = deltaY > 40 && elapsed < 250 && deltaY > Math.abs(deltaX) * 1.5;

                if (isSwipeDown || isFlickDown) {
                    closeAllDrawers();
                    setActiveNavTab('map');
                    if (navigator.vibrate) navigator.vibrate(30);
                }
            }, { passive: true });
        });
    }

    function setupMobileUiToggle() {
        const toggle = document.getElementById('config-toggle-mobile-ui');
        if (!toggle) return;

        toggle.checked = isMobileViewport();
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                localStorage.setItem('vtt_force_mobile_ui', 'true');
                document.documentElement.classList.add('force-mobile-ui');
                document.documentElement.classList.remove('force-desktop-ui');
            } else {
                localStorage.setItem('vtt_force_mobile_ui', 'false');
                document.documentElement.classList.add('force-desktop-ui');
                document.documentElement.classList.remove('force-mobile-ui');
                closeAllDrawers();
            }
            if (window.VTT?.canvasEngine?.renderAll) {
                window.VTT.canvasEngine.renderAll();
            }
        });
    }

    // ========================================================================
    // 7. INITIALIZE
    // ========================================================================
    setupCanvasTouchGestures();
    setupMobileNavigation();
    setupDrawerSwipeDismiss();
    setupMobileUiToggle();
    setupMobilePaintDrawer();
    setupMobileMapToolsUI();

    // Re-check role and refresh sheet carousel on socket campaign ready
    if (vtt.socket) {
        vtt.socket.on('campaign:state', () => {
            const role = vtt.role || 'Player';
            renderMobileNavTabs(role);
            updateMobileToolsRoleVisibility(role);
            renderMobileSheetCarousel();
        });
    }

    console.log('[MobileAdapter] ForgeD VTT mobile touch engine and adaptive navigation initialized.');

    const adapter = {
        setActiveNavTab,
        closeAllDrawers,
        openMobileSidebarTab,
        openMobilePlayerSheet,
        syncPlayerSheetTopbar,
        syncCreatureSheetTopbar,
        isMobileViewport,
        startTapToPlaceMode,
        cancelTapToPlaceMode,
        updateFloatingCombatPill: () => updateFloatingCombatPillFn?.(),
        showMobileRadialDial,
        hideMobileRadialDial,
        renderMobileSheetCarousel,
        setEcoMode,
        toggleEcoMode,
        isEcoMode: () => isEcoMode()
    };
    window.VTT = window.VTT || {};
    window.VTT.mobileAdapter = adapter;
    return adapter;
}
