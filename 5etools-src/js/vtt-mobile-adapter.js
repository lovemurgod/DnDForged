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
    // Support user manual preference: 'true' (force mobile), 'false' (force desktop), or null (auto)
    const isMobileViewport = () => {
        const forced = localStorage.getItem('vtt_force_mobile_ui');
        if (forced === 'true') return true;
        if (forced === 'false') return false;
        return window.innerWidth <= 900 || ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) && window.innerWidth <= 1366);
    };

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
    let didLongPress = false;
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
        if (!isMobileViewport()) return;
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
            if (window.VTT?.canvasEngine?.renderAll) {
                window.VTT.canvasEngine.renderAll();
            }
        }, 120);
    }

    function onTouchStart(e) {
        if (!isMobileViewport()) return;

        // Prevent browser 300ms delays, ghost-clicks, and elastic bouncing
        if (e.cancelable) e.preventDefault();

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

        // Two-Finger Gesture: Pan & Pinch-to-Zoom OR Second-Finger Drag Cancel
        if (e.touches.length === 2) {
            cancelLongPress();

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
                activeTouchedToken = null;
                if (mobileDragPill) mobileDragPill.classList.add('vtt-hidden');
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
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
            const touch = e.touches[0];
            touchStartPos = { x: touch.clientX, y: touch.clientY };

            // Check Double-Tap (within 320ms and 24px)
            const now = Date.now();
            const timeSinceLast = now - lastTapInfo.time;
            const distFromLast = Math.hypot(touch.clientX - lastTapInfo.x, touch.clientY - lastTapInfo.y);

            if (timeSinceLast > 40 && timeSinceLast < 320 && distFromLast < 24) {
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
                touchedToken = canvasEngine.getTokenAtPoint(mouseCoords, true, true, touchRadius);
            }

            // If in Select mode and touching empty canvas ground -> SMART 1-FINGER PAN!
            if (activeTool === 'select' && !touchedToken) {
                is1FingerPanning = true;
                panStartPos = { x: touch.clientX, y: touch.clientY };
                isSingleTouching = true;
                activeTouchedToken = null;
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
                return;
            }

            // Otherwise, touching an owned token or active tool (Measure, Shape, Ping, Lighting)
            is1FingerPanning = false;
            isSingleTouching = true;
            activeTouchedToken = touchedToken;
            touchMoveDist = 0;

            // If in Select mode with an owned token, start direct first-class touch token drag!
            if (activeTool === 'select' && touchedToken && canvasEngine?.startTouchTokenDrag) {
                canvasEngine.startTouchTokenDrag(touchedToken.id, touch.clientX, touch.clientY);
            }

            // Start 500ms Long-Press Timer for Right-Click Context Menu
            longPressTimer = setTimeout(() => {
                didLongPress = true;
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
        if (!isMobileViewport()) return;

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

        // Single-Finger Smart Pan on Empty Canvas
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

            // Cancel long press & hide quick action bar if finger moved > 8px
            if (touchMoveDist > 8) {
                cancelLongPress();
                if (mobileTokenActions) mobileTokenActions.classList.add('vtt-hidden');
            }

            if (!didLongPress) {
                const canvasEngine = window.VTT?.canvasEngine;
                if (activeTouchedToken && canvasEngine?.moveTouchTokenDrag && canvasEngine?.isDraggingToken?.()) {
                    canvasEngine.moveTouchTokenDrag(touch.clientX, touch.clientY);
                } else {
                    dispatchSyntheticMouseEvent('mousemove', touch.clientX, touch.clientY, 0);
                }
            }
        }
    }

    function onTouchEnd(e) {
        if (!isMobileViewport()) return;

        cancelLongPress();

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
                    if (activeTouchedToken && canvasEngine?.endTouchTokenDrag && canvasEngine?.isDraggingToken?.()) {
                        canvasEngine.endTouchTokenDrag(changedTouch.clientX, changedTouch.clientY);
                    } else {
                        dispatchSyntheticMouseEvent('mouseup', changedTouch.clientX, changedTouch.clientY, 0);
                    }

                    // If tap on token with negligible movement, show Quick Action Bar
                    if (activeTouchedToken && touchMoveDist < 8) {
                        showMobileTokenActions(changedTouch.clientX, changedTouch.clientY, activeTouchedToken);
                    }
                }
            }
            activeTouchedToken = null;
            isSingleTouching = false;
            didLongPress = false;
        }
    }

    function onTouchCancel() {
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
        didLongPress = false;
        activeTouchedToken = null;
    }

    function cancelLongPress() {
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

        // Setup Modal Backdrop Click/Tap Dismissal
        setupModalBackdropDismissal();

        // Setup Mobile Token Quick Action Bar
        setupMobileTokenActions();

        // Setup Live Turn Badge Polling
        setupTurnBadgeObserver();
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
    }

    function openMobilePlayerSheet() {
        if (!playerSheetPanel) return;

        // Open sheet overlay
        playerSheetPanel.classList.remove('minimized');
        playerSheetPanel.classList.add('open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');

        // Update mobile topbar data from current character if present
        syncPlayerSheetTopbar();
    }

    function openMobileInitiativeDrawer() {
        if (!initContainer) return;

        initContainer.classList.remove('vtt-hidden');
        initContainer.classList.add('mobile-init-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
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
                ` : `
                <div class="mobile-more-card" data-action="characters">
                    <i class="fa-solid fa-users" style="font-size: 1.8rem; color: #f5c242;"></i>
                    <span style="font-weight: 600;">Characters</span>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Party members</span>
                </div>
                `}
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
        // Enforce player parity: players cannot activate lighting or switch layers
        const isGM = (vtt.role || 'Player') === 'GM';
        if ((toolKey === 'lighting' || toolKey === 'layers' || toolKey === 'map') && !isGM) {
            return;
        }

        const desktopToolMap = {
            'select': 'tool-select',
            'measure': 'tool-measure',
            'shape': 'tool-shape',
            'ping': 'tool-ping',
            'lighting': 'tool-lighting',
            'layers': 'btn-layers',
            'map': 'btn-change-map'
        };

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

    function setupModalBackdropDismissal() {
        const dismissModal = (e) => {
            if (e.target.classList && e.target.classList.contains('vtt-modal')) {
                e.target.classList.add('vtt-hidden');
            }
        };
        document.addEventListener('click', dismissModal);
        document.addEventListener('touchend', dismissModal);
    }

    function setupMobileTokenActions() {
        if (!mobileTokenActions) return;

        const btnSheet = document.getElementById('vtt-mobile-action-sheet');
        const btnCond = document.getElementById('vtt-mobile-action-cond');
        const btnEdit = document.getElementById('vtt-mobile-action-edit');

        if (btnSheet) {
            btnSheet.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileTokenActions.classList.add('vtt-hidden');
                if (!activeTouchedToken) return;
                if (activeTouchedToken.characterId) {
                    openMobilePlayerSheet();
                } else if (activeTouchedToken.monsterData || activeTouchedToken.isNpc) {
                    if (window.VTT?.creatureSheet?.loadMonster) {
                        window.VTT.creatureSheet.loadMonster(activeTouchedToken.monsterData);
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

        if (btnCond) {
            btnCond.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileTokenActions.classList.add('vtt-hidden');
                if (activeTouchedToken?.id) {
                    const canvasEngine = window.VTT?.canvasEngine;
                    const existing = document.getElementById('vtt-gm-token-tooltip');
                    if (existing) {
                        if (canvasEngine?.hideGmTokenTooltip) {
                            canvasEngine.hideGmTokenTooltip();
                        } else {
                            existing.remove();
                        }
                    } else if (canvasEngine?.showGmTokenTooltip) {
                        canvasEngine.showGmTokenTooltip(activeTouchedToken.id, true);
                    }
                }
            });
        }

        if (btnEdit) {
            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileTokenActions.classList.add('vtt-hidden');
                if (activeTouchedToken?.id && window.VTT?.canvasEngine?.openTokenEditModal) {
                    window.VTT.canvasEngine.openTokenEditModal(activeTouchedToken.id);
                }
            });
        }
    }

    function showMobileTokenActions(x, y, token) {
        if (!mobileTokenActions || !token) return;
        activeTouchedToken = token;
        mobileTokenActions.style.left = `${Math.min(window.innerWidth - 90, Math.max(90, x))}px`;
        mobileTokenActions.style.top = `${Math.max(70, y - 30)}px`;
        mobileTokenActions.classList.remove('vtt-hidden');
    }

    // ========================================================================
    // 5. LIVE INITIATIVE TURN BADGE OBSERVER
    // ========================================================================
    function setupTurnBadgeObserver() {
        const roundNumEl = document.getElementById('init-round-num');
        const initListEl = document.getElementById('init-list');

        function updateBadge() {
            const badge = document.getElementById('mobile-init-badge');
            if (!badge) return;

            const round = roundNumEl ? roundNumEl.textContent.trim() : '1';
            const hasCombatants = initListEl && !initListEl.querySelector('.init-empty-state');

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

    // Re-check role on socket campaign ready
    if (vtt.socket) {
        vtt.socket.on('campaign:state', () => {
            const role = vtt.role || 'Player';
            renderMobileNavTabs(role);
            updateMobileToolsRoleVisibility(role);
        });
    }

    console.log('[MobileAdapter] ForgeD VTT mobile touch engine and adaptive navigation initialized.');

    const adapter = {
        setActiveNavTab,
        closeAllDrawers,
        openMobileSidebarTab,
        openMobilePlayerSheet,
        syncPlayerSheetTopbar,
        syncCreatureSheetTopbar
    };
    window.VTT = window.VTT || {};
    window.VTT.mobileAdapter = adapter;
    return adapter;
}
