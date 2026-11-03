/**
 * vtt-canvas-interaction-tools.js
 * Canvas viewport listeners, token selection collisions, tool selection HUD,
 * and tabletop layers switching controls.
 */

export function isTokenControlledByPlayer(token, ignorePause = false, context = {}) {
    if (!token) return false;
    const vtt = context.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    if (vtt.role === 'GM') return true;
    if (!ignorePause) {
        if (vtt.role !== 'GM' && (vtt.isPaused || (typeof window !== 'undefined' && window.VTT?.isPaused)))
            return false;
    }
    const username = vtt.username;
    if (!username) return false;
    const uLower = username.toLowerCase();

    const matchUser = (val) => typeof val === 'string' && (val === '*' || val.toLowerCase() === uLower);
    const matchArr = (arr) => Array.isArray(arr) && arr.some(matchUser);

    // Direct ownership on the token object
    if (matchUser(token.ownerUsername) || matchUser(token.owner) || matchUser(token.playerOwner)) return true;
    if (matchArr(token.players) || matchArr(token.assignedPlayers)) return true;

    // Linked character or companion ownership
    const charId = token.characterId || token.sourceCharacterId;
    if (charId) {
        const char = vtt.campaignState?.characters?.[charId];
        if (char) {
            if (matchArr(char.assignedPlayers) || matchArr(char.players)) return true;
            if (matchUser(char.owner) || matchUser(char.ownerUsername)) return true;
        }
    }
    return false;
}

export function getSelectionBounds(start, end) {
    if (!start || !end) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    return {
        x1: Math.min(start.x, end.x),
        y1: Math.min(start.y, end.y),
        x2: Math.max(start.x, end.x),
        y2: Math.max(start.y, end.y)
    };
}

export function isTokenWithinSelection(token, rect, getTokenDrawDimensions) {
    if (!token || !rect) return false;
    const dims = getTokenDrawDimensions ? getTokenDrawDimensions(token) : { drawW: 50, drawH: 50 };
    const cx = token.x + dims.drawW / 2;
    const cy = token.y + dims.drawH / 2;
    return cx >= rect.x1 && cx <= rect.x2 && cy >= rect.y1 && cy <= rect.y2;
}

export function getTokenAtPoint(mouse, requireControl = true, matchLayer = true, touchRadius = 0, context = {}) {
    const tokens = context.tokens;
    if (!tokens || !mouse) return null;
    const vtt = context.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    if (
        requireControl &&
        vtt.role !== 'GM' &&
        (vtt.isPaused || (typeof window !== 'undefined' && window.VTT?.isPaused))
    )
        return null;

    const tokenEntries = Object.entries(tokens).map(([id, t], idx) => ({ id, token: t, originalIndex: idx }));
    // Sort descending by zIndex, then descending by original insertion index (topmost visual element first)
    tokenEntries.sort((a, b) => {
        const zDiff = (b.token.zIndex || 0) - (a.token.zIndex || 0);
        if (zDiff !== 0) return zDiff;
        return b.originalIndex - a.originalIndex;
    });

    const r = Math.max(0, touchRadius || 0);
    const activeLayer = context.activeLayer || 'token';
    const isControlFn = context.isTokenControlledByPlayer || ((t) => isTokenControlledByPlayer(t, false, context));
    const getDimsFn = context.getTokenDrawDimensions || (() => ({ drawW: 50, drawH: 50 }));
    const isVisibleFn = context.isPointVisible || (() => true);

    for (const { token } of tokenEntries) {
        if (!token) continue;
        const tokenLayer = token.layer || 'token';
        if (matchLayer && tokenLayer !== activeLayer) continue;
        if (tokenLayer === 'gm' && vtt.role !== 'GM') continue;
        if (token.isVisible === false && vtt.role !== 'GM') continue;
        if (requireControl && !isControlFn(token)) continue;

        const { drawW, drawH } = getDimsFn(token);
        const tx = token.x + drawW / 2;
        const ty = token.y + drawH / 2;
        if (vtt.role !== 'GM' && !isVisibleFn(tx, ty)) continue;

        if (token.rotation) {
            const cx = token.x + drawW / 2;
            const cy = token.y + drawH / 2;
            const rad = (-token.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx = mouse.x - cx;
            const dy = mouse.y - cy;
            const localX = cos * dx - sin * dy + drawW / 2;
            const localY = sin * dx + cos * dy + drawH / 2;
            if (localX >= -r && localX <= drawW + r && localY >= -r && localY <= drawH + r) {
                return token;
            }
        } else {
            if (
                mouse.x >= token.x - r &&
                mouse.x <= token.x + drawW + r &&
                mouse.y >= token.y - r &&
                mouse.y <= token.y + drawH + r
            ) {
                return token;
            }
        }
    }
    return null;
}

export function hideAllToolPanels() {
    [
        'panel-lighting-config',
        'panel-measure-config',
        'panel-layers-config',
        'panel-paint-ribbon',
        'panel-map-tools'
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('vtt-hidden');
    });
}

export function setupViewportControls(context = {}) {
    const canvasInteraction =
        context.canvasInteraction ||
        (typeof document !== 'undefined' ? document.getElementById('vtt-canvas-interaction') : null);
    if (!canvasInteraction) return;
    const viewport =
        context.viewport || (typeof document !== 'undefined' ? document.getElementById('vtt-canvas-viewport') : null);

    canvasInteraction.addEventListener('wheel', (e) => {
        e.preventDefault();
        context.cancelCameraAnimation?.();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        if (!viewport) return;
        const vr = viewport.getBoundingClientRect();
        const mouseX = e.clientX - vr.left;
        const mouseY = e.clientY - vr.top;

        const targetX = (mouseX - context.panX) / context.zoom;
        const targetY = (mouseY - context.panY) / context.zoom;

        const nextZoom = Math.min(5.0, Math.max(0.1, context.zoom * delta));
        context.zoom = nextZoom;

        context.panX = mouseX - targetX * context.zoom;
        context.panY = mouseY - targetY * context.zoom;

        context.updateContainerTransform?.();
        context.renderAll?.();
    });

    canvasInteraction.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (context.hasPanned) return;

        const mouse = context.getCanvasMouseCoords?.(e) || { x: 0, y: 0 };
        const vtt = context.vtt || (typeof window !== 'undefined' ? window.VTT : {});

        let portalUnderMouse = null;
        if (vtt.role === 'GM') {
            const hitTool = context.getMapToolItemAtCoord?.(mouse.x, mouse.y);
            portalUnderMouse = hitTool && hitTool.type === 'portal' ? hitTool.item : null;
            if (!portalUnderMouse && Array.isArray(context.portals) && context.isTokenCollidingWithPortal) {
                portalUnderMouse = context.portals
                    .slice()
                    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                    .find((p) =>
                        context.isTokenCollidingWithPortal({ x: mouse.x - 4, y: mouse.y - 4, drawW: 8, drawH: 8 }, p)
                    );
            }
        }

        const token = getTokenAtPoint(mouse, true, true, 0, context);

        if (portalUnderMouse && (!token || context.activeLayer === 'portals' || context.activeTool === 'maptools')) {
            e.stopPropagation();
            e.preventDefault();
            context.selectMapToolItem?.('portal', portalUnderMouse.id);
            context.renderAll?.();
            context.showPortalContextMenu?.(portalUnderMouse.id, e.clientX, e.clientY);
            return;
        }

        if (token) {
            e.stopPropagation();
            e.preventDefault();
            if (context.selectedTokenIds && context.selectedTokenIds.has(token.id) && context.selectedTokenIds.size > 1) {
                context.showMassRollContextMenu?.(Array.from(context.selectedTokenIds), e.clientX, e.clientY);
                return;
            }
            context.showTokenContextMenu?.(token.id, e.clientX, e.clientY);
            return;
        }

        if (vtt.role === 'GM' && (context.activeTool === 'select' || context.activeTool === 'shape')) {
            if (context.localIsMeasuring || context.localIsShaping) {
                e.stopPropagation();
                e.preventDefault();
                context.cancelActiveMeasurement?.();
                return;
            }

            const shape = context.getPersistentShapeAtPoint?.(mouse);
            if (shape) {
                e.stopPropagation();
                e.preventDefault();
                context.selectShape?.(shape.id);
                context.renderAll?.();
                context.showShapeContextMenu?.(shape, e.clientX, e.clientY);
                return;
            }
        }

        if (context.activeTool === 'shape' || context.activeTool === 'measure') {
            e.stopPropagation();
            e.preventDefault();
            context.cancelActiveMeasurement?.();
            return;
        }

        if (context.activeTool === 'paint') {
            e.stopPropagation();
            e.preventDefault();
            context.showDrawingContextMenu?.(e.clientX, e.clientY);
            return;
        }

        if (context.activeLayer === 'notes' && vtt.role === 'GM') {
            e.stopPropagation();
            e.preventDefault();
            context.showAddNoteContextMenu?.(e.clientX, e.clientY, mouse.x, mouse.y);
            return;
        }

        if (vtt.role === 'GM') {
            const hitTool = context.getMapToolItemAtCoord?.(mouse.x, mouse.y);
            if (hitTool) {
                e.stopPropagation();
                e.preventDefault();
                context.selectMapToolItem?.(hitTool.type, hitTool.item.id);
                context.renderAll?.();
                return;
            }
        }
    });
}

export function setupToolControls(context = {}) {
    const vtt = context.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    const tools = [
        'tool-select',
        'tool-lighting',
        'tool-measure',
        'tool-shape',
        'tool-ping',
        'tool-paint',
        'tool-map-tools'
    ];
    tools.forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if ((id === 'tool-lighting' || id === 'tool-map-tools') && vtt.role !== 'GM') return;
                tools.forEach((otherId) => {
                    const el = document.getElementById(otherId);
                    if (el) el.classList.remove('active');
                });
                btn.classList.add('active');
                context.activeTool = id.replace('tool-', '');

                if (context.activeDrawingTextarea) context.commitDrawingTextInput?.();
                if (context.activeTool !== 'paint') {
                    context.polygonPoints = [];
                    context.currentPaintStroke = null;
                    context.isDrawingPaint = false;
                }
                if (context.activeTool !== 'maptools' && context.activeTool !== 'map-tools') {
                    context.cancelMapToolDrawing?.();
                }

                hideAllToolPanels();

                if (context.activeTool === 'lighting') {
                    document.getElementById('panel-lighting-config')?.classList.remove('vtt-hidden');
                } else if (context.activeTool === 'measure' || context.activeTool === 'shape') {
                    document.getElementById('panel-measure-config')?.classList.remove('vtt-hidden');
                } else if (context.activeTool === 'paint') {
                    const ribbon = document.getElementById('panel-paint-ribbon');
                    if (ribbon) {
                        ribbon.classList.remove('vtt-hidden');
                        const lName =
                            (context.activeLayer || 'token').charAt(0).toUpperCase() +
                            (context.activeLayer || 'token').slice(1);
                        const lEl = document.getElementById('paint-active-layer-name');
                        if (lEl) lEl.textContent = `${lName} Layer`;
                    }
                } else if (context.activeTool === 'maptools' || context.activeTool === 'map-tools') {
                    document.getElementById('panel-map-tools')?.classList.remove('vtt-hidden');
                    context.populateTargetPortalsDropdown?.();
                    context.renderPlacedTrapsList?.();
                    context.renderPlacedPortalsList?.();
                }
            });
        }
    });

    context.setupPaintRibbonControls?.();
    context.setupMapToolsControls?.();

    document.getElementById('measure-broadcast')?.addEventListener('change', (e) => {
        if (!e.target.checked && context.localIsMeasuring) {
            vtt.socket?.emit('measure:clear', { mapId: context.currentMapId, username: vtt.username });
        }
    });
}

export function setupLayersControls(context = {}) {
    const vtt = context.vtt || (typeof window !== 'undefined' ? window.VTT : {});
    const btn = document.getElementById('btn-layers');
    if (btn) {
        btn.addEventListener('click', () => {
            if (vtt.role !== 'GM') return;
            const panel = document.getElementById('panel-layers-config');
            if (panel) {
                const isHidden = panel.classList.contains('vtt-hidden');
                hideAllToolPanels();
                if (isHidden) panel.classList.remove('vtt-hidden');
            }
        });
    }

    const updateLayerButtonIcon = (layer) => {
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

    updateLayerButtonIcon(context.activeLayer || 'token');

    const layerPanel = document.getElementById('panel-layers-config');

    function switchActiveLayer(layer) {
        if (!layer) return;
        if (layerPanel) {
            const layerBtns = layerPanel.querySelectorAll('.layer-btn');
            layerBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-layer') === layer));
        }
        context.activeLayer = layer;
        context.clearAllSelections?.();
        updateLayerButtonIcon(layer);
        const lName =
            (context.activeLayer || 'token').charAt(0).toUpperCase() + (context.activeLayer || 'token').slice(1);
        const lEl = document.getElementById('paint-active-layer-name');
        if (lEl) lEl.textContent = `${lName} Layer`;
        context.renderAll?.();
    }

    if (layerPanel) {
        const layerBtns = layerPanel.querySelectorAll('.layer-btn');
        layerBtns.forEach((b) => {
            b.addEventListener('click', () => {
                const layer = b.getAttribute('data-layer');
                switchActiveLayer(layer);
            });
        });
    }

    return { switchActiveLayer, updateLayerButtonIcon };
}
