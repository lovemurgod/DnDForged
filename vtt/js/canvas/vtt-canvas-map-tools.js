// DnDForged Canvas Map Tools Subsystem
// Manages map tool state, creation, manipulation, hit testing, and controls for traps and portals

import { isPointInsideGeometry, renderPlacedTrapsList } from './vtt-canvas-traps.js';

import {
    calcPortalCenter,
    getPortalRotationHandlePos,
    populateTargetPortalsDropdown,
    cleanupPortalReferences,
    renderPlacedPortalsList
} from './vtt-canvas-portals.js';

let isDrawingMapTool = false;
let mapToolStartPoint = null;
let mapToolCurrentPoint = null;
let mapToolPolygonPoints = [];
let activeDragMapToolItem = null;
let mapToolDragStart = null;
let mapToolDragOriginalGeom = null;
let activeResizeMapToolHandle = null;
let activeRotatePortalId = null;
let hoveredRotatePortalId = null;
let hoveredMapToolHandle = null;
let currentMapToolShape = 'rect';
let activeMapToolSubmode = 'traps';

export function cloneMapToolGeom(geom) {
    if (!geom) return null;
    if (Array.isArray(geom.points)) {
        return { points: geom.points.map((p) => ({ x: p.x, y: p.y })) };
    }
    return { ...geom };
}

export function updateDraggedMapToolGeom(geom, origGeom, dx, dy) {
    if (!geom || !origGeom) return;
    if (Array.isArray(origGeom.points)) {
        geom.points = origGeom.points.map((p) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) }));
    } else if (origGeom.x !== undefined && origGeom.w !== undefined) {
        geom.x = Math.round(origGeom.x + dx);
        geom.y = Math.round(origGeom.y + dy);
    } else if (origGeom.cx !== undefined) {
        geom.cx = Math.round(origGeom.cx + dx);
        geom.cy = Math.round(origGeom.cy + dy);
    } else if (origGeom.x1 !== undefined) {
        geom.x1 = Math.round(origGeom.x1 + dx);
        geom.y1 = Math.round(origGeom.y1 + dy);
        geom.x2 = Math.round(origGeom.x2 + dx);
        geom.y2 = Math.round(origGeom.y2 + dy);
    }
}

export function getMapToolResizeHandles(item) {
    if (!item || !item.geom) return [];
    const g = item.geom;
    const handles = [];
    const shape = item.shape;

    if (shape === 'rect') {
        const minX = Math.min(g.x, g.x + g.w);
        const maxX = Math.max(g.x, g.x + g.w);
        const minY = Math.min(g.y, g.y + g.h);
        const maxY = Math.max(g.y, g.y + g.h);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        handles.push({ id: 'nw', x: minX, y: minY, cursor: 'nwse-resize' });
        handles.push({ id: 'n', x: midX, y: minY, cursor: 'ns-resize' });
        handles.push({ id: 'ne', x: maxX, y: minY, cursor: 'nesw-resize' });
        handles.push({ id: 'e', x: maxX, y: midY, cursor: 'ew-resize' });
        handles.push({ id: 'se', x: maxX, y: maxY, cursor: 'nwse-resize' });
        handles.push({ id: 's', x: midX, y: maxY, cursor: 'ns-resize' });
        handles.push({ id: 'sw', x: minX, y: maxY, cursor: 'nesw-resize' });
        handles.push({ id: 'w', x: minX, y: midY, cursor: 'ew-resize' });
    } else if (shape === 'circle') {
        const r = g.r !== undefined ? g.r : Math.hypot(g.endX - g.cx, g.endY - g.cy) || 25;
        handles.push({ id: 'r-east', x: g.cx + r, y: g.cy, cursor: 'ew-resize' });
        handles.push({ id: 'r-west', x: g.cx - r, y: g.cy, cursor: 'ew-resize' });
        handles.push({ id: 'r-south', x: g.cx, y: g.cy + r, cursor: 'ns-resize' });
        handles.push({ id: 'r-north', x: g.cx, y: g.cy - r, cursor: 'ns-resize' });
    } else if (shape === 'line') {
        handles.push({ id: 'p1', x: g.x1, y: g.y1, cursor: 'crosshair' });
        handles.push({ id: 'p2', x: g.x2, y: g.y2, cursor: 'crosshair' });
        handles.push({ id: 'mid', x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2, cursor: 'move' });
    } else if (shape === 'polygon' && Array.isArray(g.points)) {
        g.points.forEach((p, idx) => {
            handles.push({ id: `vertex-${idx}`, x: p.x, y: p.y, cursor: 'crosshair', index: idx });
        });
    }
    return handles;
}

export function getMapToolResizeHandleAt(item, mouse, tolerance = null, zoom = 1) {
    const tol = tolerance !== null ? tolerance : Math.max(24 / (zoom || 1), 20);
    const handles = getMapToolResizeHandles(item);
    for (const h of handles) {
        if (Math.hypot(mouse.x - h.x, mouse.y - h.y) <= tol) {
            return h;
        }
    }
    return null;
}

export function getPortalHandleUnderMouse(mouse, tolerance = null, options = {}) {
    const {
        isGM = true,
        activeLayer = 'tokens',
        selectedMapToolItem = null,
        activeTool = 'select',
        zoom = 1,
        portals = []
    } = options;

    if (!isGM) return null;
    if (
        activeLayer !== 'portals' &&
        selectedMapToolItem?.type !== 'portal' &&
        activeTool !== 'maptools' &&
        activeTool !== 'map-tools'
    )
        return null;
    const tol = tolerance !== null ? tolerance : Math.max(16, 24 / (zoom || 1));

    // 1. Check currently selected portal first
    if (selectedMapToolItem && selectedMapToolItem.type === 'portal') {
        const sel = portals.find((p) => p.id === selectedMapToolItem.id);
        if (sel) {
            if (!sel.isRadial) {
                const hPos = getPortalRotationHandlePos(sel);
                if (hPos && Math.hypot(mouse.x - hPos.x, mouse.y - hPos.y) <= tol) {
                    return { type: 'rotate', portal: sel, pos: hPos };
                }
            }
            const rHandle = getMapToolResizeHandleAt(sel, mouse, tol, zoom);
            if (rHandle) {
                return { type: 'resize', item: sel, handle: rHandle };
            }
        }
    }

    // 2. Check visible portals on portals layer if layer is portals or maptools is open
    if (activeLayer === 'portals' || activeTool === 'maptools' || activeTool === 'map-tools') {
        for (const p of portals) {
            if (selectedMapToolItem?.id === p.id) continue;
            const rHandle = getMapToolResizeHandleAt(p, mouse, tol, zoom);
            if (rHandle) {
                return { type: 'resize', item: p, handle: rHandle };
            }
        }
    }
    return null;
}

export function applyMapToolResize(item, origGeom, handle, mouse, e, snapToGrid = null) {
    if (!item || !origGeom || !handle) return;
    const g = item.geom;
    const shape = item.shape;
    const doSnap = !(e && e.altKey);
    const snapPos = doSnap && snapToGrid ? snapToGrid(mouse.x, mouse.y, false) : { x: mouse.x, y: mouse.y };
    const mx = snapPos.x;
    const my = snapPos.y;

    if (shape === 'rect') {
        const origX1 = Math.min(origGeom.x, origGeom.x + origGeom.w);
        const origX2 = Math.max(origGeom.x, origGeom.x + origGeom.w);
        const origY1 = Math.min(origGeom.y, origGeom.y + origGeom.h);
        const origY2 = Math.max(origGeom.y, origGeom.y + origGeom.h);

        let newX1 = origX1,
            newX2 = origX2,
            newY1 = origY1,
            newY2 = origY2;
        if (handle.id === 'nw') {
            newX1 = Math.min(mx, origX2 - 10);
            newY1 = Math.min(my, origY2 - 10);
        } else if (handle.id === 'n') {
            newY1 = Math.min(my, origY2 - 10);
        } else if (handle.id === 'ne') {
            newX2 = Math.max(mx, origX1 + 10);
            newY1 = Math.min(my, origY2 - 10);
        } else if (handle.id === 'e') {
            newX2 = Math.max(mx, origX1 + 10);
        } else if (handle.id === 'se') {
            newX2 = Math.max(mx, origX1 + 10);
            newY2 = Math.max(my, origY1 + 10);
        } else if (handle.id === 's') {
            newY2 = Math.max(my, origY1 + 10);
        } else if (handle.id === 'sw') {
            newX1 = Math.min(mx, origX2 - 10);
            newY2 = Math.max(my, origY1 + 10);
        } else if (handle.id === 'w') {
            newX1 = Math.min(mx, origX2 - 10);
        }

        g.x = Math.round(newX1);
        g.y = Math.round(newY1);
        g.w = Math.round(newX2 - newX1);
        g.h = Math.round(newY2 - newY1);
    } else if (shape === 'circle') {
        const newR = Math.max(10, Math.round(Math.hypot(mx - origGeom.cx, my - origGeom.cy)));
        g.r = newR;
    } else if (shape === 'line') {
        if (handle.id === 'p1') {
            g.x1 = Math.round(mx);
            g.y1 = Math.round(my);
        } else if (handle.id === 'p2') {
            g.x2 = Math.round(mx);
            g.y2 = Math.round(my);
        } else if (handle.id === 'mid') {
            const origMidX = (origGeom.x1 + origGeom.x2) / 2;
            const origMidY = (origGeom.y1 + origGeom.y2) / 2;
            const dx = mx - origMidX;
            const dy = my - origMidY;
            g.x1 = Math.round(origGeom.x1 + dx);
            g.y1 = Math.round(origGeom.y1 + dy);
            g.x2 = Math.round(origGeom.x2 + dx);
            g.y2 = Math.round(origGeom.y2 + dy);
        }
    } else if (shape === 'polygon' && Array.isArray(g.points) && handle.index !== undefined) {
        if (g.points[handle.index]) {
            g.points[handle.index].x = Math.round(mx);
            g.points[handle.index].y = Math.round(my);
        }
    }
}

export function getMapToolItemAtCoord(x, y, options = {}) {
    const { isGM = true, activeLayer = 'tokens', portals = [], traps = [] } = options;
    if (!isGM) return null;
    const pt = { x, y };

    if (activeLayer === 'portals') {
        const sortedPortals = [...portals].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
        for (const p of sortedPortals) {
            if (isPointInsideGeometry(pt, p.shape, p.geom)) {
                return { type: 'portal', item: p };
            }
        }
        return null;
    }

    for (let i = traps.length - 1; i >= 0; i--) {
        const t = traps[i];
        if (isPointInsideGeometry(pt, t.shape, t.geom)) {
            return { type: 'trap', item: t };
        }
    }

    return null;
}

export function selectMapToolItem(type, id, state, callbacks = {}) {
    state.selectedMapToolItem = { type, id };
    const { traps = [], portals = [], currentMapId = null, campaignState = {}, renderAll = null } = callbacks;

    if (typeof document === 'undefined') return;
    const panel = document.getElementById('panel-map-tools');
    if (panel && panel.classList.contains('vtt-hidden')) {
        panel.classList.remove('vtt-hidden');
    }

    if (type === 'trap') {
        const trap = traps.find((t) => t.id === id);
        if (!trap) return;

        state.activeMapToolSubmode = 'traps';
        state.currentMapToolShape = trap.shape || 'rect';

        panel?.querySelectorAll('.maptools-tab-btn').forEach((b) => {
            b.classList.toggle('active', (b.dataset.submode || b.dataset.tab) === 'traps');
        });
        document.getElementById('subpanel-maptools-traps')?.classList.remove('vtt-hidden');
        document.getElementById('subpanel-maptools-portals')?.classList.add('vtt-hidden');

        const activeSubpanel = document.getElementById('subpanel-maptools-traps');
        activeSubpanel?.querySelectorAll('.maptools-shape-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.shape === trap.shape);
        });

        const nameEl = document.getElementById('maptools-trap-name');
        if (nameEl) nameEl.value = trap.name || 'Spike Pit';
        const abilityEl = document.getElementById('maptools-trap-ability');
        if (abilityEl) abilityEl.value = trap.saveAbility || 'DEX';
        const dcEl = document.getElementById('maptools-trap-dc');
        if (dcEl) dcEl.value = trap.saveDc || 15;
        const dmgEl = document.getElementById('maptools-trap-damage');
        if (dmgEl) dmgEl.value = trap.damage || '4d6 piercing';
        const autoEl = document.getElementById('maptools-trap-auto');
        if (autoEl) autoEl.checked = trap.triggerAuto !== false;
        const repeatEl = document.getElementById('maptools-trap-repeat');
        if (repeatEl) repeatEl.checked = trap.repeatTrigger === true;

        const banner = document.getElementById('maptools-trap-edit-banner');
        const title = document.getElementById('maptools-trap-edit-title');
        const actions = document.getElementById('maptools-trap-edit-actions');
        if (banner) banner.classList.remove('vtt-hidden');
        if (title) title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editing: ${trap.name || 'Trap'}`;
        if (actions) actions.classList.remove('vtt-hidden');

        document.getElementById('maptools-portal-edit-banner')?.classList.add('vtt-hidden');
        document.getElementById('maptools-portal-edit-actions')?.classList.add('vtt-hidden');
    } else {
        const portal = portals.find((p) => p.id === id);
        if (!portal) return;

        state.activeMapToolSubmode = 'portals';
        state.currentMapToolShape = portal.shape || 'line';

        panel?.querySelectorAll('.maptools-tab-btn').forEach((b) => {
            b.classList.toggle('active', (b.dataset.submode || b.dataset.tab) === 'portals');
        });
        document.getElementById('subpanel-maptools-portals')?.classList.remove('vtt-hidden');
        document.getElementById('subpanel-maptools-traps')?.classList.add('vtt-hidden');

        const activeSubpanel = document.getElementById('subpanel-maptools-portals');
        activeSubpanel?.querySelectorAll('.maptools-shape-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.shape === portal.shape);
        });

        const nameEl = document.getElementById('maptools-portal-name');
        if (nameEl) nameEl.value = portal.name || 'Mystic Portal';
        const mapEl = document.getElementById('maptools-portal-target-map');
        if (mapEl) mapEl.value = portal.targetMapId || '';

        populateTargetPortalsDropdown(portals, currentMapId, campaignState, portal.id);

        const portalSelect = document.getElementById('maptools-portal-target-portal');
        if (portalSelect) portalSelect.value = portal.targetPortalId || '';
        const linkEl = document.getElementById('maptools-portal-linkback');
        if (linkEl) linkEl.checked = portal.linkBack !== false;
        const walkEl = document.getElementById('maptools-portal-walkthrough');
        if (walkEl) walkEl.checked = portal.walkThrough !== false;
        const viewEl = document.getElementById('maptools-portal-viewthrough');
        if (viewEl) viewEl.checked = portal.viewThrough === true;
        const oneWayEl = document.getElementById('maptools-portal-oneway');
        if (oneWayEl) oneWayEl.checked = portal.isOneWay === true;
        const revEl = document.getElementById('maptools-portal-revealed');
        if (revEl) revEl.checked = portal.isRevealed !== false;
        const reflectEl = document.getElementById('maptools-portal-reflect-mode');
        if (reflectEl) reflectEl.value = portal.reflectMode || 'none';
        const radialEl = document.getElementById('maptools-portal-radial');
        if (radialEl) radialEl.checked = portal.isRadial === true;
        const angleVal =
            portal.facingAngle !== undefined && portal.facingAngle !== null ? Math.round(portal.facingAngle) : 270;
        const angleSlider = document.getElementById('maptools-portal-facing-angle');
        const angleNum = document.getElementById('maptools-portal-facing-angle-num');
        const angleText = document.getElementById('maptools-portal-facing-angle-val');
        if (angleSlider) angleSlider.value = angleVal;
        if (angleNum) angleNum.value = angleVal;
        if (angleText) angleText.textContent = `${angleVal}°`;

        const actions = document.getElementById('maptools-portal-edit-actions');
        if (actions) actions.classList.remove('vtt-hidden');

        document.getElementById('maptools-trap-edit-banner')?.classList.add('vtt-hidden');
        document.getElementById('maptools-trap-edit-actions')?.classList.add('vtt-hidden');
    }

    if (callbacks.onRenderLists) callbacks.onRenderLists();
    if (renderAll) renderAll();
}

export function deselectMapToolItem(state, callbacks = {}) {
    state.selectedMapToolItem = null;
    if (typeof document !== 'undefined') {
        document.getElementById('maptools-trap-edit-banner')?.classList.add('vtt-hidden');
        document.getElementById('maptools-trap-edit-actions')?.classList.add('vtt-hidden');
        document.getElementById('maptools-portal-edit-actions')?.classList.add('vtt-hidden');
        if (callbacks.activeTool === 'select') {
            document.getElementById('panel-map-tools')?.classList.add('vtt-hidden');
        }
    }
    if (callbacks.onRenderLists) callbacks.onRenderLists();
    if (callbacks.renderAll) callbacks.renderAll();
}

export function saveSelectedMapToolItem(type, state, callbacks = {}) {
    if (!state.selectedMapToolItem || state.selectedMapToolItem.type !== type) return;
    const id = state.selectedMapToolItem.id;
    const {
        traps = [],
        portals = [],
        currentMapId = null,
        campaignState = {},
        socket = null,
        renderAll = null
    } = callbacks;

    if (type === 'trap') {
        const trap = traps.find((t) => t.id === id);
        if (!trap) return;

        if (typeof document !== 'undefined') {
            trap.name = document.getElementById('maptools-trap-name')?.value || trap.name;
            trap.saveAbility = document.getElementById('maptools-trap-ability')?.value || trap.saveAbility;
            trap.saveDc = parseInt(document.getElementById('maptools-trap-dc')?.value) || trap.saveDc;
            trap.damage = document.getElementById('maptools-trap-damage')?.value || trap.damage;
            trap.triggerAuto = document.getElementById('maptools-trap-auto')?.checked ?? trap.triggerAuto;
            trap.repeatTrigger = document.getElementById('maptools-trap-repeat')?.checked ?? trap.repeatTrigger;
        }

        if (campaignState?.maps?.[currentMapId]) {
            campaignState.maps[currentMapId].traps = traps;
        }
        if (socket) socket.emit('traps:update', { mapId: currentMapId, traps });
        if (callbacks.onRenderTrapsList) callbacks.onRenderTrapsList();

        const title = document.getElementById('maptools-trap-edit-title');
        if (title) title.innerHTML = `<i class="fa-solid fa-check text-success"></i> Updated: ${trap.name}`;
    } else {
        const portal = portals.find((p) => p.id === id);
        if (!portal) return;

        const prevTargetMapId = portal.targetMapId || currentMapId;
        const prevTargetPortalId = portal.targetPortalId || '';

        if (typeof document !== 'undefined') {
            portal.name = document.getElementById('maptools-portal-name')?.value || portal.name;
            portal.targetMapId = document.getElementById('maptools-portal-target-map')?.value || currentMapId;
            portal.targetPortalId = document.getElementById('maptools-portal-target-portal')?.value || '';
            portal.linkBack = document.getElementById('maptools-portal-linkback')?.checked ?? true;
            portal.walkThrough = document.getElementById('maptools-portal-walkthrough')?.checked ?? true;
            portal.viewThrough = document.getElementById('maptools-portal-viewthrough')?.checked ?? false;
            portal.isOneWay = document.getElementById('maptools-portal-oneway')?.checked ?? false;
            portal.isRevealed = document.getElementById('maptools-portal-revealed')?.checked ?? true;
            portal.reflectMode = document.getElementById('maptools-portal-reflect-mode')?.value || 'none';
            portal.isRadial = document.getElementById('maptools-portal-radial')?.checked ?? false;
            const inputAngle = parseInt(document.getElementById('maptools-portal-facing-angle')?.value);
            portal.facingAngle = isNaN(inputAngle) ? 270 : ((inputAngle % 360) + 360) % 360;
        }

        const newTargetMapId = portal.targetMapId;
        const newTargetPortalId = portal.targetPortalId;

        if (
            prevTargetPortalId &&
            (prevTargetPortalId !== newTargetPortalId || prevTargetMapId !== newTargetMapId || !portal.linkBack)
        ) {
            if (prevTargetMapId === currentMapId) {
                const prevTarget = portals.find((p) => p.id === prevTargetPortalId);
                if (prevTarget && prevTarget.targetPortalId === portal.id) {
                    prevTarget.targetPortalId = '';
                }
            } else if (campaignState?.maps?.[prevTargetMapId]?.portals) {
                const prevList = campaignState.maps[prevTargetMapId].portals;
                const prevTarget = prevList.find((p) => p.id === prevTargetPortalId);
                if (prevTarget && prevTarget.targetPortalId === portal.id) {
                    prevTarget.targetPortalId = '';
                    if (socket) socket.emit('portals:update', { mapId: prevTargetMapId, portals: prevList });
                }
            }
        }

        if (newTargetPortalId) {
            if (portal.linkBack) {
                if (newTargetMapId === currentMapId) {
                    const target = portals.find((p) => p.id === newTargetPortalId);
                    if (target) {
                        target.targetPortalId = portal.id;
                        target.targetMapId = currentMapId;
                        target.linkBack = true;
                        if (portal.viewThrough) target.viewThrough = true;
                    }
                } else if (campaignState?.maps?.[newTargetMapId]?.portals) {
                    const targetList = campaignState.maps[newTargetMapId].portals;
                    const target = targetList.find((p) => p.id === newTargetPortalId);
                    if (target) {
                        target.targetPortalId = portal.id;
                        target.targetMapId = currentMapId;
                        target.linkBack = true;
                        if (portal.viewThrough) target.viewThrough = true;
                        if (socket) socket.emit('portals:update', { mapId: newTargetMapId, portals: targetList });
                    }
                }
            } else {
                if (newTargetMapId === currentMapId) {
                    const target = portals.find((p) => p.id === newTargetPortalId);
                    if (target && target.targetPortalId === portal.id) {
                        target.targetPortalId = '';
                    }
                } else if (campaignState?.maps?.[newTargetMapId]?.portals) {
                    const targetList = campaignState.maps[newTargetMapId].portals;
                    const target = targetList.find((p) => p.id === newTargetPortalId);
                    if (target && target.targetPortalId === portal.id) {
                        target.targetPortalId = '';
                        if (socket) socket.emit('portals:update', { mapId: newTargetMapId, portals: targetList });
                    }
                }
            }
        }

        if (campaignState?.maps?.[currentMapId]) {
            campaignState.maps[currentMapId].portals = portals;
        }
        if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
        if (callbacks.onRenderPortalsList) callbacks.onRenderPortalsList();
        populateTargetPortalsDropdown(portals, currentMapId, campaignState, portal.id);

        const title = document.getElementById('maptools-portal-edit-title');
        if (title) title.innerHTML = `<i class="fa-solid fa-check text-success"></i> Updated: ${portal.name}`;
    }

    if (renderAll) renderAll();
}

export function deleteSelectedMapToolItem(type, state, callbacks = {}) {
    if (!state.selectedMapToolItem || state.selectedMapToolItem.type !== type) return;
    const id = state.selectedMapToolItem.id;
    const { traps = [], portals = [], currentMapId = null, campaignState = {}, socket = null } = callbacks;

    if (type === 'trap') {
        const idx = traps.findIndex((t) => t.id === id);
        if (idx !== -1) {
            traps.splice(idx, 1);
            if (campaignState?.maps?.[currentMapId]) {
                campaignState.maps[currentMapId].traps = traps;
            }
            if (socket) socket.emit('traps:update', { mapId: currentMapId, traps });
        }
    } else {
        const idx = portals.findIndex((p) => p.id === id);
        if (idx !== -1) {
            portals.splice(idx, 1);
            cleanupPortalReferences(id, portals, currentMapId, campaignState, socket);
            if (campaignState?.maps?.[currentMapId]) {
                campaignState.maps[currentMapId].portals = portals;
            }
            if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
        }
    }

    deselectMapToolItem(state, callbacks);
}

export function updateMapToolDrawingUI(isDrawing, activeMapToolSubmode = 'traps') {
    if (typeof document === 'undefined') return;
    const trapIndicator = document.getElementById('maptools-trap-drawing-indicator');
    const portalIndicator = document.getElementById('maptools-portal-drawing-indicator');
    if (activeMapToolSubmode === 'traps') {
        if (trapIndicator) trapIndicator.classList.toggle('vtt-hidden', !isDrawing);
        if (portalIndicator) portalIndicator.classList.add('vtt-hidden');
    } else {
        if (portalIndicator) portalIndicator.classList.toggle('vtt-hidden', !isDrawing);
        if (trapIndicator) trapIndicator.classList.add('vtt-hidden');
    }
}

export function commitNewMapToolItem(start, end, polyPts, state, callbacks = {}) {
    const {
        traps = [],
        portals = [],
        currentMapId = null,
        campaignState = {},
        socket = null,
        renderAll = null,
        onSelect = null
    } = callbacks;

    const id = 'mt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    let geom = null;

    if (state.currentMapToolShape === 'rect') {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        geom = { x, y, w, h };
    } else if (state.currentMapToolShape === 'circle') {
        const cx = start.x;
        const cy = start.y;
        const r = Math.hypot(end.x - start.x, end.y - start.y);
        geom = { cx, cy, r };
    } else if (state.currentMapToolShape === 'line') {
        geom = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    } else if (state.currentMapToolShape === 'polygon') {
        geom = { points: polyPts || [] };
    }

    if (state.activeMapToolSubmode === 'traps') {
        let name = 'Spike Pit',
            saveAbility = 'DEX',
            saveDc = 15,
            damage = '4d6 piercing',
            triggerAuto = true,
            repeatTrigger = false;
        if (typeof document !== 'undefined') {
            name = document.getElementById('maptools-trap-name')?.value || name;
            saveAbility = document.getElementById('maptools-trap-ability')?.value || saveAbility;
            saveDc = parseInt(document.getElementById('maptools-trap-dc')?.value) || saveDc;
            damage = document.getElementById('maptools-trap-damage')?.value || damage;
            triggerAuto = document.getElementById('maptools-trap-auto')?.checked ?? triggerAuto;
            repeatTrigger = document.getElementById('maptools-trap-repeat')?.checked ?? repeatTrigger;
        }

        const newTrap = {
            id,
            mapId: currentMapId,
            name,
            shape: state.currentMapToolShape,
            geom,
            triggerAuto,
            repeatTrigger,
            isRevealed: false,
            isSpent: false,
            saveAbility,
            saveDc,
            damage,
            flavor: 'A concealed hazard is sprung upon entry!'
        };

        traps.push(newTrap);
        if (campaignState?.maps?.[currentMapId]) {
            campaignState.maps[currentMapId].traps = traps;
        }
        if (socket) socket.emit('traps:update', { mapId: currentMapId, traps });
        if (callbacks.onRenderTrapsList) callbacks.onRenderTrapsList();
        if (onSelect) onSelect('trap', id);
    } else {
        let name = 'Mystic Portal',
            targetMapId = currentMapId,
            targetPortalId = '',
            linkBack = true,
            walkThrough = true,
            viewThrough = false,
            isOneWay = false,
            isRevealed = true,
            reflectMode = 'none',
            isRadial = false;
        let facingAngle = 270;

        if (typeof document !== 'undefined') {
            name = document.getElementById('maptools-portal-name')?.value || name;
            targetMapId = document.getElementById('maptools-portal-target-map')?.value || currentMapId;
            targetPortalId = document.getElementById('maptools-portal-target-portal')?.value || '';
            linkBack = document.getElementById('maptools-portal-linkback')?.checked ?? true;
            walkThrough = document.getElementById('maptools-portal-walkthrough')?.checked ?? true;
            viewThrough = document.getElementById('maptools-portal-viewthrough')?.checked ?? false;
            isOneWay = document.getElementById('maptools-portal-oneway')?.checked ?? false;
            isRevealed = document.getElementById('maptools-portal-revealed')?.checked ?? true;
            reflectMode = document.getElementById('maptools-portal-reflect-mode')?.value || 'none';
            isRadial = document.getElementById('maptools-portal-radial')?.checked ?? false;
            const inputAngle = parseInt(document.getElementById('maptools-portal-facing-angle')?.value);
            if (!isNaN(inputAngle)) {
                facingAngle = ((inputAngle % 360) + 360) % 360;
            } else if (state.currentMapToolShape === 'line' && geom) {
                const lx = geom.x2 - geom.x1;
                const ly = geom.y2 - geom.y1;
                facingAngle = Math.round(((Math.atan2(lx, -ly) * 180) / Math.PI + 360) % 360);
            }
        }

        const newPortal = {
            id,
            mapId: currentMapId,
            name,
            layer: 'portals',
            zIndex: 1,
            shape: state.currentMapToolShape,
            geom,
            targetMapId,
            targetPortalId,
            linkBack,
            walkThrough,
            viewThrough,
            isOneWay,
            viewSideFlipped: false,
            reflectMode,
            isRadial,
            facingAngle,
            isRevealed
        };

        portals.push(newPortal);

        if (linkBack && targetPortalId) {
            if (targetMapId === currentMapId) {
                const target = portals.find((p) => p.id === targetPortalId);
                if (target) {
                    target.targetPortalId = id;
                    target.targetMapId = currentMapId;
                    target.linkBack = true;
                    if (viewThrough) target.viewThrough = true;
                }
            } else if (campaignState?.maps?.[targetMapId]?.portals) {
                const targetList = campaignState.maps[targetMapId].portals;
                const target = targetList.find((p) => p.id === targetPortalId);
                if (target) {
                    target.targetPortalId = id;
                    target.targetMapId = currentMapId;
                    target.linkBack = true;
                    if (viewThrough) target.viewThrough = true;
                    if (socket) socket.emit('portals:update', { mapId: targetMapId, portals: targetList });
                }
            }
        }

        if (campaignState?.maps?.[currentMapId]) {
            campaignState.maps[currentMapId].portals = portals;
        }
        if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
        if (callbacks.onRenderPortalsList) callbacks.onRenderPortalsList();
        populateTargetPortalsDropdown(portals, currentMapId, campaignState, id);
        if (onSelect) onSelect('portal', id);
    }

    if (renderAll) renderAll();
}

export function renderSelectedMapToolHighlight(ctx, selectedMapToolItem, traps, portals, isGM, zoom = 1, options = {}) {
    if (!selectedMapToolItem || !isGM) return;
    const { type, id } = selectedMapToolItem;
    const item = type === 'trap' ? traps.find((t) => t.id === id) : portals.find((p) => p.id === id);
    if (!item || !item.geom) return;

    const { hoveredMapToolHandle = null, activeRotatePortalId = null, hoveredRotatePortalId = null } = options;

    const isTrap = type === 'trap';
    const color = isTrap ? '#ef4444' : '#c084fc';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 / zoom;
    if (isTrap) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 8 / zoom;
    } else {
        ctx.fillStyle = 'transparent';
    }

    const g = item.geom;

    function drawHandle(hx, hy, handleId = null) {
        const isHovered = hoveredMapToolHandle && hoveredMapToolHandle.handle?.id === handleId;
        ctx.save();
        ctx.fillStyle = isHovered ? '#e879f9' : '#ffffff';
        ctx.strokeStyle = isHovered ? '#a855f7' : color;
        ctx.lineWidth = (isHovered ? 2.5 : 2) / zoom;
        if (isHovered) {
            ctx.shadowColor = '#e879f9';
            ctx.shadowBlur = 10 / zoom;
        }
        ctx.beginPath();
        ctx.arc(hx, hy, (isHovered ? 6.5 : 5) / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    ctx.beginPath();
    if (item.shape === 'rect') {
        const x = Math.min(g.x, g.x + g.w);
        const y = Math.min(g.y, g.y + g.h);
        const w = Math.abs(g.w);
        const h = Math.abs(g.h);
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.rect(x, y, w, h);
        ctx.stroke();
        ctx.setLineDash([]);
        drawHandle(x, y, 'nw');
        drawHandle(x + w, y, 'ne');
        drawHandle(x + w, y + h, 'se');
        drawHandle(x, y + h, 'sw');
        drawHandle(x + w / 2, y, 'n');
        drawHandle(x + w / 2, y + h, 's');
        drawHandle(x, y + h / 2, 'w');
        drawHandle(x + w, y + h / 2, 'e');
    } else if (item.shape === 'circle') {
        const r = g.r !== undefined ? g.r : 20;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.arc(g.cx, g.cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        drawHandle(g.cx + r, g.cy, 'r-east');
        drawHandle(g.cx - r, g.cy, 'r-west');
        drawHandle(g.cx, g.cy + r, 'r-south');
        drawHandle(g.cx, g.cy - r, 'r-north');
    } else if (item.shape === 'line') {
        ctx.moveTo(g.x1, g.y1);
        ctx.lineTo(g.x2, g.y2);
        ctx.stroke();
        drawHandle(g.x1, g.y1, 'p1');
        drawHandle(g.x2, g.y2, 'p2');
        drawHandle((g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2, 'mid');
    } else if (item.shape === 'polygon' && g.points) {
        ctx.moveTo(g.points[0].x, g.points[0].y);
        for (let i = 1; i < g.points.length; i++) {
            ctx.lineTo(g.points[i].x, g.points[i].y);
        }
        ctx.closePath();
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
        g.points.forEach((p, idx) => drawHandle(p.x, p.y, 'vertex-' + idx));
    }

    // Interactive Rotation Handle for Portals
    if (!isTrap) {
        const rotHandle = getPortalRotationHandlePos(item);
        if (rotHandle && !item.isRadial) {
            ctx.save();
            ctx.setLineDash([4 / zoom, 3 / zoom]);
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 1.5 / zoom;
            ctx.beginPath();
            ctx.moveTo(rotHandle.center.x, rotHandle.center.y);
            ctx.lineTo(rotHandle.x, rotHandle.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const hRadius = 8 / zoom;
            ctx.beginPath();
            ctx.arc(rotHandle.x, rotHandle.y, hRadius, 0, Math.PI * 2);
            ctx.fillStyle =
                activeRotatePortalId === item.id
                    ? '#a855f7'
                    : hoveredRotatePortalId === item.id
                      ? '#e879f9'
                      : '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#9333ea';
            ctx.lineWidth = 2 / zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(rotHandle.x, rotHandle.y, 2.5 / zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#9333ea';
            ctx.fill();
            ctx.restore();
        }
    }

    // Selected Floating Badge
    const center = calcPortalCenter(item);
    const text = `Selected: ${item.name || (isTrap ? 'Trap' : 'Portal')}`;
    ctx.font = `bold ${Math.max(11, 13 / zoom)}px "Open Sans", sans-serif`;
    const textW = ctx.measureText(text).width;
    const padX = 8 / zoom;
    const padY = 4 / zoom;
    const badgeY = center.y - 24 / zoom;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(
            center.x - textW / 2 - padX,
            badgeY - 10 / zoom - padY,
            textW + padX * 2,
            20 / zoom + padY * 2,
            4 / zoom
        );
    } else {
        ctx.rect(center.x - textW / 2 - padX, badgeY - 10 / zoom - padY, textW + padX * 2, 20 / zoom + padY * 2);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, center.x, badgeY);

    ctx.restore();
}

export function renderMapToolDrawingPreview(ctx, drawingState, zoom = 1) {
    const {
        isDrawing = false,
        activeMapToolSubmode = 'traps',
        currentMapToolShape = 'rect',
        mapToolStartPoint = null,
        mapToolCurrentPoint = null,
        mapToolPolygonPoints = []
    } = drawingState;

    if (!isDrawing) return;
    ctx.save();

    const isTraps = activeMapToolSubmode === 'traps';
    ctx.strokeStyle = isTraps ? '#ef4444' : '#a855f7';
    ctx.fillStyle = isTraps ? 'rgba(239, 68, 68, 0.22)' : 'rgba(168, 85, 247, 0.22)';
    ctx.lineWidth = 2.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);

    if (currentMapToolShape === 'polygon') {
        if (mapToolPolygonPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(mapToolPolygonPoints[0].x, mapToolPolygonPoints[0].y);
            for (let i = 1; i < mapToolPolygonPoints.length; i++) {
                ctx.lineTo(mapToolPolygonPoints[i].x, mapToolPolygonPoints[i].y);
            }
            if (mapToolCurrentPoint) {
                ctx.lineTo(mapToolCurrentPoint.x, mapToolCurrentPoint.y);
            }
            ctx.stroke();

            mapToolPolygonPoints.forEach((p, idx) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, (idx === 0 ? 6 : 4.5) / zoom, 0, Math.PI * 2);
                ctx.fillStyle = idx === 0 ? '#10b981' : '#ffd700';
                ctx.fill();
                ctx.stroke();
            });
        }
    } else if (mapToolStartPoint && mapToolCurrentPoint) {
        const s = mapToolStartPoint;
        const c = mapToolCurrentPoint;
        ctx.beginPath();
        if (currentMapToolShape === 'rect') {
            const x = Math.min(s.x, c.x);
            const y = Math.min(s.y, c.y);
            const w = Math.abs(c.x - s.x);
            const h = Math.abs(c.y - s.y);
            ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();
        } else if (currentMapToolShape === 'circle') {
            const r = Math.hypot(c.x - s.x, c.y - s.y);
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (currentMapToolShape === 'line') {
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
        }
    }

    ctx.restore();
}

export function setupMapToolsControls(state, callbacks = {}) {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('panel-map-tools');
    if (!panel) return;

    const {
        switchActiveLayer = null,
        updateLayerButtonIcon = null,
        cancelDrawing = null,
        saveItem = null,
        deleteItem = null,
        deselectItem = null,
        renderAll = null,
        portals = [],
        currentMapId = null,
        campaignState = {},
        socket = null
    } = callbacks;

    // Submode Tabs (Traps vs Portals)
    panel.querySelectorAll('.maptools-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.maptools-tab-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeMapToolSubmode = btn.dataset.submode || btn.dataset.tab || 'traps';

            document
                .getElementById('subpanel-maptools-traps')
                ?.classList.toggle('vtt-hidden', state.activeMapToolSubmode !== 'traps');
            document
                .getElementById('subpanel-maptools-portals')
                ?.classList.toggle('vtt-hidden', state.activeMapToolSubmode !== 'portals');

            if (state.activeMapToolSubmode === 'portals') {
                if (switchActiveLayer) {
                    switchActiveLayer('portals');
                } else if (updateLayerButtonIcon) {
                    updateLayerButtonIcon('portals');
                }
            }

            const activeSubpanel = document.getElementById(
                state.activeMapToolSubmode === 'traps' ? 'subpanel-maptools-traps' : 'subpanel-maptools-portals'
            );
            const activeShapeBtn = activeSubpanel?.querySelector('.maptools-shape-btn.active');
            if (activeShapeBtn) {
                state.currentMapToolShape =
                    activeShapeBtn.dataset.shape || (state.activeMapToolSubmode === 'traps' ? 'rect' : 'line');
            }
            if (cancelDrawing) cancelDrawing();
        });
    });

    // Shape Selection Grid
    panel.querySelectorAll('.maptools-shape-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('.maptools-subpanel');
            if (parent) {
                parent.querySelectorAll('.maptools-shape-btn').forEach((b) => b.classList.remove('active'));
            }
            btn.classList.add('active');
            state.currentMapToolShape = btn.dataset.shape || 'rect';
            if (cancelDrawing) cancelDrawing();
        });
    });

    // Target map dropdown change -> refresh portal dropdown
    document.getElementById('maptools-portal-target-map')?.addEventListener('change', () => {
        populateTargetPortalsDropdown(
            portals,
            currentMapId,
            campaignState,
            state.selectedMapToolItem?.type === 'portal' ? state.selectedMapToolItem.id : null
        );
    });

    // Facing angle slider & number input listeners
    const angleSlider = document.getElementById('maptools-portal-facing-angle');
    const angleNum = document.getElementById('maptools-portal-facing-angle-num');
    const angleVal = document.getElementById('maptools-portal-facing-angle-val');

    function updatePortalAngle(val) {
        val = parseInt(val);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(359, val));
        if (angleSlider) angleSlider.value = val;
        if (angleNum) angleNum.value = val;
        if (angleVal) angleVal.textContent = `${val}°`;

        if (state.selectedMapToolItem && state.selectedMapToolItem.type === 'portal') {
            const p = portals.find((item) => item.id === state.selectedMapToolItem.id);
            if (p) {
                p.facingAngle = val;
                if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
                if (renderAll) renderAll();
            }
        }
    }

    angleSlider?.addEventListener('input', (e) => updatePortalAngle(e.target.value));
    angleNum?.addEventListener('input', (e) => updatePortalAngle(e.target.value));

    // Radial mode toggle
    document.getElementById('maptools-portal-radial')?.addEventListener('change', (e) => {
        const isRadial = !!e.target.checked;
        document.getElementById('group-portal-facing-angle')?.classList.toggle('vtt-hidden', isRadial);
        if (state.selectedMapToolItem && state.selectedMapToolItem.type === 'portal') {
            const p = portals.find((item) => item.id === state.selectedMapToolItem.id);
            if (p) {
                p.isRadial = isRadial;
                if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
                if (renderAll) renderAll();
            }
        }
    });

    // Reflect mode select
    document.getElementById('maptools-portal-reflect-mode')?.addEventListener('change', (e) => {
        const reflectMode = e.target.value;
        if (state.selectedMapToolItem && state.selectedMapToolItem.type === 'portal') {
            const p = portals.find((item) => item.id === state.selectedMapToolItem.id);
            if (p) {
                p.reflectMode = reflectMode;
                if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
                if (renderAll) renderAll();
            }
        }
    });

    // Flip side button
    document.getElementById('btn-maptools-portal-flip')?.addEventListener('click', () => {
        if (state.selectedMapToolItem && state.selectedMapToolItem.type === 'portal') {
            const p = portals.find((item) => item.id === state.selectedMapToolItem.id);
            if (p) {
                p.facingAngle = ((p.facingAngle !== undefined ? p.facingAngle : 270) + 180) % 360;
                p.viewSideFlipped = !p.viewSideFlipped;
                updatePortalAngle(p.facingAngle);
                if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
                if (renderAll) renderAll();
                return;
            }
        }
        if (portals.length > 0) {
            const last = portals[portals.length - 1];
            last.facingAngle = ((last.facingAngle !== undefined ? last.facingAngle : 270) + 180) % 360;
            last.viewSideFlipped = !last.viewSideFlipped;
            updatePortalAngle(last.facingAngle);
            if (socket) socket.emit('portals:update', { mapId: currentMapId, portals });
            if (renderAll) renderAll();
        }
    });

    // Trap Edit Actions: Save, Delete, Cancel/Done
    document.getElementById('btn-save-trap')?.addEventListener('click', () => {
        if (saveItem) saveItem('trap');
    });
    document.getElementById('btn-delete-selected-trap')?.addEventListener('click', () => {
        if (deleteItem) deleteItem('trap');
    });
    document.getElementById('btn-cancel-edit-trap')?.addEventListener('click', () => {
        if (deselectItem) deselectItem();
    });

    // Portal Edit Actions: Save, Delete, Cancel/Done
    document.getElementById('btn-save-portal')?.addEventListener('click', () => {
        if (saveItem) saveItem('portal');
    });
    document.getElementById('maptools-portal-target-portal')?.addEventListener('change', () => {
        if (state.selectedMapToolItem && state.selectedMapToolItem.type === 'portal') {
            if (saveItem) saveItem('portal');
        }
    });
    document.getElementById('maptools-portal-linkback')?.addEventListener('change', () => {
        if (state.selectedMapToolItem && state.selectedMapToolItem.type === 'portal') {
            if (saveItem) saveItem('portal');
        }
    });
    document.getElementById('btn-delete-selected-portal')?.addEventListener('click', () => {
        if (deleteItem) deleteItem('portal');
    });
    document.getElementById('btn-cancel-edit-portal')?.addEventListener('click', () => {
        if (deselectItem) deselectItem();
    });

    // Cancel buttons on drawing hints
    document.getElementById('btn-cancel-trap-draw')?.addEventListener('click', () => {
        if (cancelDrawing) cancelDrawing();
    });
    document.getElementById('btn-cancel-portal-draw')?.addEventListener('click', () => {
        if (cancelDrawing) cancelDrawing();
    });
}

export function handleMapToolMouseDown(mouse, e, context = {}) {
    const vtt = context.vtt || {};
    const mapToolState = context.mapToolState || {};
    const activeLayer = context.activeLayer;
    const switchActiveLayer = context.switchActiveLayer;
    const getPortalHandleUnderMouse = context.getPortalHandleUnderMouse;
    const selectMapToolItem = context.selectMapToolItem;
    const renderAll = context.renderAll || (() => {});
    const cloneMapToolGeom = context.cloneMapToolGeom;
    const getMapToolResizeHandleAt = context.getMapToolResizeHandleAt;
    const selectedMapToolItem = mapToolState.selectedItem;
    const updateMapToolDrawingUI = context.updateMapToolDrawingUI;
    const portals = context.portals || [];
    const traps = context.traps || [];
    const currentMapId = context.currentMapId;
    const commitNewMapToolItem = context.commitNewMapToolItem;
    const finalizeMapToolPolygon = context.finalizeMapToolPolygon || (() => {});

    if (vtt.role !== 'GM') return;
    if (e.button !== 0) return;

    if (activeMapToolSubmode === 'portals' && activeLayer !== 'portals') {
        if (typeof switchActiveLayer === 'function') {
            switchActiveLayer('portals');
        } else if (context) {
            context.activeLayer = 'portals';
        }
    }

    const handleHit = getPortalHandleUnderMouse(mouse);
    if (handleHit) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (handleHit.type === 'rotate') {
            activeRotatePortalId = handleHit.portal.id;
            selectMapToolItem('portal', handleHit.portal.id);
            renderAll();
            return;
        } else if (handleHit.type === 'resize') {
            selectMapToolItem('portal', handleHit.item.id);
            activeResizeMapToolHandle = {
                type: 'portal',
                id: handleHit.item.id,
                handle: handleHit.handle,
                origGeom: cloneMapToolGeom(handleHit.item.geom)
            };
            renderAll();
            return;
        }
    }

    if (selectedMapToolItem && selectedMapToolItem.type === 'trap') {
        const selItem = traps.find((t) => t.id === selectedMapToolItem.id);
        if (selItem) {
            const rHandle = getMapToolResizeHandleAt(selItem, mouse);
            if (rHandle) {
                activeResizeMapToolHandle = {
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

    const hit = getMapToolItemAtCoord(mouse.x, mouse.y);
    if (hit) {
        selectMapToolItem(hit.type, hit.item.id);
        activeDragMapToolItem = { type: hit.type, id: hit.item.id };
        mapToolDragStart = { x: mouse.x, y: mouse.y };
        mapToolDragOriginalGeom = cloneMapToolGeom(hit.item.geom);
        isDrawingMapTool = false;
        updateMapToolDrawingUI(false);
        renderAll();
        return;
    }

    if (selectedMapToolItem) {
        deselectMapToolItem();
    }

    if (currentMapToolShape === 'polygon') {
        if (mapToolPolygonPoints.length === 0) {
            mapToolPolygonPoints.push({ x: mouse.x, y: mouse.y });
            isDrawingMapTool = true;
            updateMapToolDrawingUI(true);
        } else {
            const firstPt = mapToolPolygonPoints[0];
            const distToFirst = Math.hypot(mouse.x - firstPt.x, mouse.y - firstPt.y);
            if (mapToolPolygonPoints.length >= 3 && distToFirst <= 15) {
                finalizeMapToolPolygon();
                return;
            }
            mapToolPolygonPoints.push({ x: mouse.x, y: mouse.y });
        }
        renderAll();
    } else {
        isDrawingMapTool = true;
        mapToolStartPoint = { x: mouse.x, y: mouse.y };
        mapToolCurrentPoint = { x: mouse.x, y: mouse.y };
        updateMapToolDrawingUI(true);
        renderAll();
    }
}

export function handleMapToolMouseMove(mouse, e, context = {}) {
    const vtt = context.vtt || {};
    const mapToolState = context.mapToolState || {};
    const renderAll = context.renderAll || (() => {});
    const applyMapToolResize = context.applyMapToolResize;
    const updateDraggedMapToolGeom = context.updateDraggedMapToolGeom;
    const getPortalRotationHandlePos = context.getPortalRotationHandlePos;
    const portals = context.portals || [];
    const traps = context.traps || [];
    const currentMapId = context.currentMapId;
    const activeLayer = context.activeLayer || 'tokens';
    const selectedMapToolItem = mapToolState.selectedItem || context.selectedMapToolItem || null;
    const canvasInteraction =
        context.canvasInteraction ||
        (typeof document !== 'undefined' ? document.getElementById('vtt-canvas-interaction') : null);
    const viewport =
        context.viewport || (typeof document !== 'undefined' ? document.getElementById('vtt-canvas-viewport') : null);

    if (activeResizeMapToolHandle) {
        const item =
            activeResizeMapToolHandle.type === 'trap'
                ? traps.find((t) => t.id === activeResizeMapToolHandle.id)
                : portals.find((p) => p.id === activeResizeMapToolHandle.id);
        if (item) {
            applyMapToolResize(item, activeResizeMapToolHandle.origGeom, activeResizeMapToolHandle.handle, mouse, e);
            renderAll();
        }
        return;
    }

    if (activeDragMapToolItem && mapToolDragStart && mapToolDragOriginalGeom) {
        const dx = mouse.x - mapToolDragStart.x;
        const dy = mouse.y - mapToolDragStart.y;
        const item =
            activeDragMapToolItem.type === 'trap'
                ? traps.find((t) => t.id === activeDragMapToolItem.id)
                : portals.find((p) => p.id === activeDragMapToolItem.id);
        if (item) {
            updateDraggedMapToolGeom(item.geom, mapToolDragOriginalGeom, dx, dy);
            renderAll();
        }
        return;
    }

    hoveredRotatePortalId = null;
    hoveredMapToolHandle = null;
    if (activeLayer === 'portals') {
        const handleHit = getPortalHandleUnderMouse(mouse);
        if (handleHit) {
            hoveredMapToolHandle = handleHit;
            if (handleHit.type === 'rotate') {
                hoveredRotatePortalId = handleHit.portal.id;
                canvasInteraction.style.cursor = 'grab';
                if (viewport) viewport.style.cursor = 'grab';
                renderAll();
                return;
            } else if (handleHit.type === 'resize') {
                canvasInteraction.style.cursor = handleHit.handle.cursor || 'pointer';
                if (viewport) viewport.style.cursor = handleHit.handle.cursor || 'pointer';
                renderAll();
                return;
            }
        }
    } else if (selectedMapToolItem && selectedMapToolItem.type === 'trap') {
        const selItem = traps.find((t) => t.id === selectedMapToolItem.id);
        if (selItem) {
            const rHandle = getMapToolResizeHandleAt(selItem, mouse);
            if (rHandle) {
                canvasInteraction.style.cursor = rHandle.cursor;
                if (viewport) viewport.style.cursor = rHandle.cursor;
                return;
            }
        }
    }
    canvasInteraction.style.cursor = '';
    if (viewport) viewport.style.cursor = '';

    if (!isDrawingMapTool) return;
    mapToolCurrentPoint = { x: mouse.x, y: mouse.y };
    renderAll();
}

export function handleMapToolMouseUp(mouse, e, context = {}) {
    const vtt = context.vtt || {};
    const mapToolState = context.mapToolState || {};
    const renderAll = context.renderAll || (() => {});
    const commitNewMapToolItem = context.commitNewMapToolItem;
    const currentMapId = context.currentMapId;
    const traps = context.traps || [];
    const portals = context.portals || [];

    if (activeResizeMapToolHandle) {
        if (activeResizeMapToolHandle.type === 'trap') {
            if (vtt.campaignState?.maps?.[currentMapId]) {
                vtt.campaignState.maps[currentMapId].traps = traps;
            }
            vtt.socket.emit('traps:update', { mapId: currentMapId, traps });
            renderPlacedTrapsList();
        } else {
            if (vtt.campaignState?.maps?.[currentMapId]) {
                vtt.campaignState.maps[currentMapId].portals = portals;
            }
            vtt.socket.emit('portals:update', { mapId: currentMapId, portals });
            renderPlacedPortalsList();
        }
        activeResizeMapToolHandle = null;
        renderAll();
        return;
    }

    if (activeDragMapToolItem) {
        if (activeDragMapToolItem.type === 'trap') {
            if (vtt.campaignState?.maps?.[currentMapId]) {
                vtt.campaignState.maps[currentMapId].traps = traps;
            }
            vtt.socket.emit('traps:update', { mapId: currentMapId, traps });
            renderPlacedTrapsList();
        } else {
            if (vtt.campaignState?.maps?.[currentMapId]) {
                vtt.campaignState.maps[currentMapId].portals = portals;
            }
            vtt.socket.emit('portals:update', { mapId: currentMapId, portals });
            renderPlacedPortalsList();
        }
        activeDragMapToolItem = null;
        mapToolDragStart = null;
        mapToolDragOriginalGeom = null;
        renderAll();
        return;
    }

    if (!isDrawingMapTool) return;
    if (currentMapToolShape === 'polygon') return;

    const start = mapToolStartPoint;
    const end = mouse;
    if (!start) return;

    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist >= 10) {
        commitNewMapToolItem(start, end);
    }

    isDrawingMapTool = false;
    mapToolStartPoint = null;
    mapToolCurrentPoint = null;
    updateMapToolDrawingUI(false);
    renderAll();
}
