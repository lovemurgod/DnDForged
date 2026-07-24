// DnDForged Map & Canvas Rendering Engine

export function initVttCanvas(vtt) {
    const viewport = document.getElementById('vtt-canvas-viewport');
    const container = document.getElementById('canvas-container');

    
    const canvasGrid = document.getElementById('vtt-canvas-grid');
    const canvasFog = document.getElementById('vtt-canvas-fog');

    const canvasInteraction = document.getElementById('vtt-canvas-interaction');

    const ctxGrid = canvasGrid.getContext('2d');
    const ctxFog = canvasFog.getContext('2d');
    const ctxInteraction = canvasInteraction.getContext('2d');

    // Image preloader cache to prevent infinite loader instantiation loops
    const imageCache = {};

    function getSafeVttUrl(url) {
        if (!url || typeof url !== 'string') return url;
        if (url.includes('discordapp.com') || url.includes('discordapp.net')) {
            return '/api/proxy-discord?url=' + encodeURIComponent(url);
        }
        return url;
    }

    const CONDITION_ICONS = {
        'Blinded': 'fa-eye-slash',
        'Charmed': 'fa-heart',
        'Deafened': 'fa-ear-deaf',
        'Exhaustion': 'fa-battery-empty',
        'Frightened': 'fa-ghost',
        'Grappled': 'fa-hand-fist',
        'Incapacitated': 'fa-ban',
        'Invisible': 'fa-mask',
        'Paralyzed': 'fa-bolt',
        'Petrified': 'fa-gem',
        'Poisoned': 'fa-skull-crossbones',
        'Prone': 'fa-arrow-down',
        'Restrained': 'fa-link',
        'Stunned': 'fa-star',
        'Unconscious': 'fa-skull'
    };

    // Pan & Zoom viewport state
    let panX = 100;
    let panY = 100;
    let zoom = 1.0;
    let isPanning = false;
    let hasPanned = false;
    let startPanX = 0;
    let startPanY = 0;

    // Canvas Active Tool State
    let activeTool = 'select'; // select, grid, lighting, ping, measure
    let currentLightingType = 'wall';
    let pingHoldTimeout = null;
    
    // Active Layer State
    let activeLayer = 'token'; // token, gm, lighting, map

    // GM Lighting/Wall select, edit and delete state
    let selectedWallIdx = -1;
    let selectedLightId = null;
    let hoveredLightId = null;
    let activeDragLightId = null;
    let lightDragOffsetX = 0, lightDragOffsetY = 0;
    let hoveredWallIdx = -1;
    let hoveredWallVertex = null; // { wallIdx, endpoint }
    let activeDragWallVertex = null; // { wallIdx, endpoint }
    let activeDragWallSegmentIdx = -1;
    let wallDragOffsetX1 = 0, wallDragOffsetY1 = 0;
    let wallDragOffsetX2 = 0, wallDragOffsetY2 = 0;

    // Advanced Multi-Selection states
    const selectedTokenIds = new Set();
    const selectedShapeIds = new Set();
    const selectedWallIdxs = new Set();

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

    let activeResizeTokenId = null;
    let contextMenuTargetId = null;
    let dragTargetId = null;
    let currentMouseCoords = { x: 0, y: 0 };

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
            if (isInteractable && Math.hypot(note.x - x, note.y - y) < 24) {
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
        let minDistance = 14; // 14px threshold to grab a light node
        let foundLightId = null;
        
        lights.forEach(light => {
            const dist = Math.hypot(x - light.x, y - light.y);
            if (dist < minDistance) {
                minDistance = dist;
                foundLightId = light.id;
            }
        });
        
        return foundLightId;
    }

    function getWallSegmentAtCoord(x, y) {
        let minDistance = 10; // 10px threshold for segment selection hover
        let foundIdx = -1;
        
        walls.forEach((wall, idx) => {
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
            drawW = Number.isFinite(token.pixelWidth) && token.pixelWidth > 0
                ? token.pixelWidth
                : (parseTokenDimension(token.customWidth) ?? parseTokenDimension(token.size) ?? 1) * grid.size * grid.scale;
            drawH = Number.isFinite(token.pixelHeight) && token.pixelHeight > 0
                ? token.pixelHeight
                : (parseTokenDimension(token.customHeight) ?? parseTokenDimension(token.size) ?? 1) * grid.size * grid.scale;
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

    // Line-of-sight vision polygons for players
    let visionPolygons = [];

    // Ray-casting point-in-polygon containment check
    function isPointInPolygon(point, vs) {
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;
            
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Determine if a point is visible to active players
    function isPointVisible(x, y) {
        if (vtt.role === 'GM') return true;
        
        const pt = { x, y };
        for (let i = 0; i < visionPolygons.length; i++) {
            if (isPointInPolygon(pt, visionPolygons[i])) {
                return true;
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

    // Interactive door/window helper: find an object within 20px radius of click coordinates
    function getWallCoordinatesForRaycasting(wall) {
        if (wall.type === 'window' && !wall.isDrawn) {
            return null; // Undrawn windows do not block light
        }
        if ((wall.type === 'door' || wall.type === 'window') && wall.isOpen) {
            if (wall.hasHinge) {
                // Compute rotated segment
                const angleRad = (wall.swingAngle || 90) * Math.PI / 180;
                const pivotX = wall.hingeEndpoint === 1 ? wall.x1 : wall.x2;
                const pivotY = wall.hingeEndpoint === 1 ? wall.y1 : wall.y2;
                const otherX = wall.hingeEndpoint === 1 ? wall.x2 : wall.x1;
                const otherY = wall.hingeEndpoint === 1 ? wall.y2 : wall.y1;

                // Rotate other point around pivot
                const dx = otherX - pivotX;
                const dy = otherY - pivotY;
                const rx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
                const ry = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

                return {
                    x1: pivotX,
                    y1: pivotY,
                    x2: pivotX + rx,
                    y2: pivotY + ry
                };
            }
            return null; // Open door without hinge does not block light
        }
        return {
            x1: wall.x1,
            y1: wall.y1,
            x2: wall.x2,
            y2: wall.y2
        };
    }

    let activeHingeVertex = null; // { wallIdx, endpoint }

    function showHingePopup(vertex, clientX, clientY) {
        activeHingeVertex = vertex;
        const door = walls[vertex.wallIdx];

        // Remove any existing hinge popup first
        const oldPopup = document.getElementById('vtt-hinge-popup');
        if (oldPopup) oldPopup.remove();

        const popup = document.createElement('div');
        popup.id = 'vtt-hinge-popup';
        popup.className = 'glassmorphism floating-tool-panel';
        popup.style.position = 'fixed';
        popup.style.left = `${clientX}px`;
        popup.style.top = `${clientY}px`;
        popup.style.zIndex = '10000';
        popup.style.padding = '14px';
        popup.style.borderRadius = '8px';
        popup.style.width = '240px';
        popup.style.background = 'rgba(18, 22, 33, 0.98)';
        popup.style.border = '1px solid var(--color-border-subtle)';
        popup.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';

        // Check if hinge is currently defined for this endpoint
        const isHingeEnabled = door.hasHinge && door.hingeEndpoint === vertex.endpoint;
        const currentAngle = door.swingAngle || 90;

        popup.innerHTML = `
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-dungeon text-gradient-gold"></i> Door Hinge Settings
            </h4>
            <div class="form-group" style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; color: var(--color-text-secondary); user-select: none;">
                    <input type="checkbox" id="hinge-enable-cb" ${isHingeEnabled ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px;"> Define Hinge at Vertex ${vertex.endpoint}
                </label>
            </div>
            <div id="hinge-config-area" style="display: ${isHingeEnabled ? 'block' : 'none'}; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
                <div class="form-group" style="margin-bottom: 12px;">
                    <label for="hinge-swing-angle" style="font-size: 0.75rem; color: var(--color-text-secondary); display: block; margin-bottom: 6px;">Swing Angle: <span id="val-hinge-angle-txt" style="font-family: monospace; color: var(--color-gold-light); font-weight: bold;">${currentAngle}°</span></label>
                    <input type="range" id="hinge-swing-angle" min="-180" max="180" step="15" value="${currentAngle}" style="width: 100%; cursor: pointer;">
                </div>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button id="btn-hinge-cancel" class="btn btn-secondary btn-xs" style="flex: 1; padding: 6px 0;">Cancel</button>
                <button id="btn-hinge-save" class="btn btn-primary btn-xs" style="flex: 1; padding: 6px 0;">Save</button>
            </div>
        `;

        document.body.appendChild(popup);

        // Bind interactive elements inside the popup
        const enableCb = document.getElementById('hinge-enable-cb');
        const configArea = document.getElementById('hinge-config-area');
        const angleSlider = document.getElementById('hinge-swing-angle');
        const angleTxt = document.getElementById('val-hinge-angle-txt');

        enableCb.addEventListener('change', () => {
            configArea.style.display = enableCb.checked ? 'block' : 'none';
        });

        angleSlider.addEventListener('input', () => {
            angleTxt.textContent = `${angleSlider.value}°`;
        });

        document.getElementById('btn-hinge-cancel').addEventListener('click', () => {
            popup.remove();
        });

        document.getElementById('btn-hinge-save').addEventListener('click', () => {
            const hasHinge = enableCb.checked;
            if (hasHinge) {
                door.hasHinge = true;
                door.hingeEndpoint = vertex.endpoint;
                door.swingAngle = parseInt(angleSlider.value);
            } else {
                // If it was defined at this endpoint, remove it
                if (door.hingeEndpoint === vertex.endpoint) {
                    door.hasHinge = false;
                    delete door.hingeEndpoint;
                    delete door.swingAngle;
                }
            }

            // Sync with other players
            vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
            renderAll();
            popup.remove();
        });

        // Close popup if clicking outside
        const closeHingePopupOnOutsideClick = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                window.removeEventListener('click', closeHingePopupOnOutsideClick);
            }
        };
        // Delay listening to prevent immediate closing from the same right-click
        setTimeout(() => {
            window.addEventListener('click', closeHingePopupOnOutsideClick);
        }, 100);
    }

    function showWallContextMenu(wallIdx, clientX, clientY) {
        const wall = walls[wallIdx];

        // Remove any existing wall context menu first
        const oldPopup = document.getElementById('vtt-wall-context-menu');
        if (oldPopup) oldPopup.remove();

        const popup = document.createElement('div');
        popup.id = 'vtt-wall-context-menu';
        popup.className = 'glassmorphism floating-tool-panel';
        popup.style.position = 'fixed';
        popup.style.left = `${clientX}px`;
        popup.style.top = `${clientY}px`;
        popup.style.zIndex = '10000';
        popup.style.padding = '14px';
        popup.style.borderRadius = '8px';
        popup.style.width = '240px';
        popup.style.background = 'rgba(18, 22, 33, 0.98)';
        popup.style.border = '1px solid var(--color-border-subtle)';
        popup.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';

        popup.innerHTML = `
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-layer-group text-gradient-gold"></i> Wall Segment
            </h4>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
                <button id="btn-wall-type-wall" class="btn btn-secondary btn-xs" style="text-align: left; padding: 6px 12px;">
                    <i class="fa-solid fa-square-full" style="width: 20px;"></i> Set as Wall
                </button>
                <button id="btn-wall-type-door" class="btn btn-secondary btn-xs" style="text-align: left; padding: 6px 12px;">
                    <i class="fa-solid fa-door-closed" style="width: 20px;"></i> Set as Door
                </button>
                <button id="btn-wall-type-window" class="btn btn-secondary btn-xs" style="text-align: left; padding: 6px 12px;">
                    <i class="fa-solid fa-border-all" style="width: 20px;"></i> Set as Window
                </button>
                <hr style="border-color: rgba(255, 255, 255, 0.1); margin: 4px 0;">
                <button id="btn-wall-delete" class="btn btn-danger btn-xs" style="text-align: left; padding: 6px 12px;">
                    <i class="fa-solid fa-trash" style="width: 20px;"></i> Delete Segment
                </button>
            </div>
        `;

        document.body.appendChild(popup);

        const updateWallType = (newType) => {
            walls[wallIdx].type = newType;
            vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
            renderAll();
            popup.remove();
        };

        document.getElementById('btn-wall-type-wall').addEventListener('click', () => updateWallType('wall'));
        document.getElementById('btn-wall-type-door').addEventListener('click', () => updateWallType('door'));
        document.getElementById('btn-wall-type-window').addEventListener('click', () => updateWallType('window'));
        
        document.getElementById('btn-wall-delete').addEventListener('click', () => {
            walls.splice(wallIdx, 1);
            vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
            // Cleanup any selection or hover state involving this wall
            hoveredWallIdx = -1;
            selectedWallIdxs.clear();
            renderAll();
            popup.remove();
        });

        // Close popup if clicking outside
        const closeMenuOnOutsideClick = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                window.removeEventListener('click', closeMenuOnOutsideClick);
                window.removeEventListener('contextmenu', closeMenuOnOutsideClick);
            }
        };
        setTimeout(() => {
            window.addEventListener('click', closeMenuOnOutsideClick);
            window.addEventListener('contextmenu', closeMenuOnOutsideClick);
        }, 100);
    }

    function getInteractiveObjectAtCoord(x, y) {
        let found = null;
        let minDistance = 20; // 20px active radius for door clicking
        
        walls.forEach((wall, idx) => {
            if (wall.type !== 'door' && wall.type !== 'window') return;
            
            // Object midpoint (rotated if open)
            const coords = getWallCoordinatesForRaycasting(wall) || { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
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
    let shapeDragOffsetX1 = 0, shapeDragOffsetY1 = 0;
    let shapeDragOffsetX2 = 0, shapeDragOffsetY2 = 0;

    function getShapeCenterPoint(shapeObj) {
        if (!shapeObj || !shapeObj.startPoint || !shapeObj.endPoint) return { x: 0, y: 0 };
        const p1 = shapeObj.startPoint;
        const p2 = shapeObj.endPoint;
        
        if (shapeObj.shape === 'circle' || (shapeObj.shape === 'square' && shapeObj.squareAnchor === 'center')) {
            return p1;
        } else if (shapeObj.shape === 'line' && Array.isArray(shapeObj.points) && shapeObj.points.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            shapeObj.points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
            return {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            };
        } else {
            return {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };
        }
    }

    function getShapePolyPoints(shapeObj) {
        if (!shapeObj) return [];
        if (shapeObj.shape === 'line' && Array.isArray(shapeObj.points) && shapeObj.points.length >= 2) {
            return shapeObj.points;
        }
        if (shapeObj.startPoint && shapeObj.endPoint) {
            return [shapeObj.startPoint, shapeObj.endPoint];
        }
        return [];
    }

    function getShapeComponentAtCoord(x, y) {
        let found = null;
        let minDistance = 16;

        Object.entries(shapes).forEach(([id, s]) => {
            const center = getShapeCenterPoint(s);
            const centerDist = Math.hypot(x - center.x, y - center.y);
            if (centerDist < minDistance) {
                minDistance = centerDist;
                found = { shapeId: id, type: 'shape', index: -1 };
            }

            const polyPoints = getShapePolyPoints(s);
            polyPoints.forEach((point, index) => {
                const dist = Math.hypot(x - point.x, y - point.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    found = { shapeId: id, type: 'anchor', index };
                }
            });

            if (s.shape === 'line') {
                for (let i = 0; i < polyPoints.length - 1; i++) {
                    const A = polyPoints[i];
                    const B = polyPoints[i + 1];
                    const dist = getDistanceToSegment(x, y, A.x, A.y, B.x, B.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        found = { shapeId: id, type: 'segment', index: i };
                    }
                }
            }
        });

        return found;
    }

    function drawShapeComponentHandles(ctx, shapeObj, shapeId) {
        if (!shapeObj) return;
        const polyPoints = getShapePolyPoints(shapeObj);
        const isSelectedShape = selectedShapeIds.has(shapeId) || selectedShapeId === shapeId;
        const isHoveredShape = hoveredShapeComponent && hoveredShapeComponent.shapeId === shapeId;
        const isComponentSelected = selectedShapeComponent && selectedShapeComponent.shapeId === shapeId;
        if (!isSelectedShape && !isHoveredShape && !isComponentSelected) return;

        ctx.save();
        for (let i = 0; i < polyPoints.length; i++) {
            const point = polyPoints[i];
            const isAnchorSelected = isComponentSelected && selectedShapeComponent.type === 'anchor' && selectedShapeComponent.index === i;
            const isAnchorHovered = hoveredShapeComponent && hoveredShapeComponent.shapeId === shapeId && hoveredShapeComponent.type === 'anchor' && hoveredShapeComponent.index === i;
            const radius = isAnchorSelected ? 7 : isAnchorHovered ? 6 : 4;
            const fill = isAnchorSelected ? 'rgba(255, 220, 0, 0.95)' : isAnchorHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)';
            const stroke = isAnchorSelected ? '#ff8c00' : 'rgba(0, 0, 0, 0.65)';
            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = isAnchorSelected ? 2 : 1;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        const isSegmentHovered = hoveredShapeComponent && hoveredShapeComponent.shapeId === shapeId && hoveredShapeComponent.type === 'segment';
        if ((isComponentSelected && selectedShapeComponent.type === 'segment') || isSegmentHovered) {
            const segmentIndex = (isComponentSelected && selectedShapeComponent.type === 'segment') ? selectedShapeComponent.index : hoveredShapeComponent.index;
            if (segmentIndex >= 0 && segmentIndex < polyPoints.length - 1) {
                const A = polyPoints[segmentIndex];
                const B = polyPoints[segmentIndex + 1];
                const midX = (A.x + B.x) / 2;
                const midY = (A.y + B.y) / 2;
                ctx.fillStyle = isSegmentHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 123, 255, 0.95)';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(midX, midY, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        ctx.restore();
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
    
    // Grid alignment settings
    let grid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
    
    // Wall and Door Segment states
    let walls = [];
    let lights = [];
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

    // GM Token Hover Tooltip state
    let gmTokenTooltipTimeout = null;
    let gmTokenTooltipTokenId = null; // ID of token tooltip is currently anchored to
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
        gmMonsterHpBarVisible: 'always',
        gmMonsterHpNumVisible: true,
        gmMonsterNameVisible: 'always',
        gmPlayerHpBarVisible: 'always',
        gmPlayerHpNumVisible: true,
        gmPlayerNameVisible: 'always',
        gmTempHpBarVisible: 'always',
        gmTempHpNumVisible: true,
        tempHpBarStyle: 'stacked'
    };

    let currentMapId = null;

    function loadMap(mapId) {
        if (!vtt.campaignState || !vtt.campaignState.maps || !vtt.campaignState.maps[mapId]) return;
        
        currentMapId = mapId;
        const mapData = vtt.campaignState.maps[mapId];

        // Reset transient interaction state so maps stay isolated.
        selectedTokenIds.clear();
        selectedShapeIds.clear();
        selectedWallIdxs.clear();
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
        const overlayLayer = document.getElementById('vtt-html-overlays');
        if (overlayLayer) {
            overlayLayer.querySelectorAll('[id^="asset_node_"], [id^="token_ui_"]').forEach(node => node.remove());
        }
        const menu = document.getElementById('vtt-token-context-menu');
        if (menu) menu.remove();

        // 1. Set background image
        if (mapData.mapImage) {
            setMapBackground(mapData.mapImage);
        } else {
            // Clear map background image and redraw grid
            const container = document.getElementById('vtt-map-bg-container');
            if(container) {
                container.innerHTML = '';
                container.classList.add('vtt-hidden');
            }
            renderAll();
        }

        // 2. Load grid config
        grid = mapData.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
        syncGridConfigInputs();

        // 3. Load tokens, walls, shapes
        tokens = mapData.tokens || {};
        walls = mapData.walls || [];
        lights = mapData.lights || [];
        notes = mapData.notes || [];
        shapes = mapData.shapes || {};
        
        // Backward compatibility for old wall schema
        walls.forEach(w => {
            if (w.type === undefined) {
                w.type = w.isDoor ? 'door' : 'wall';
            }
        });

        // 4. Update the preview indicator banner (GM Only)
        updatePreviewBanner();

        // 5. Redraw everything
        renderAll();
    }

    function updatePreviewBanner() {
        const banner = document.getElementById('vtt-map-preview-banner');
        if (!banner) return;

        if (vtt.role === 'GM' && vtt.campaignState && vtt.campaignState.activeMapId && currentMapId !== vtt.campaignState.activeMapId) {
            banner.classList.remove('vtt-hidden');
            
            const previewMapName = vtt.campaignState.maps[currentMapId]?.name || "Preview Map";
            const activeMapName = vtt.campaignState.maps[vtt.campaignState.activeMapId]?.name || "Active Map";
            
            const bannerNameSpan = document.getElementById('banner-previewing-map-name');
            if (bannerNameSpan) {
                bannerNameSpan.textContent = `"${previewMapName}" (Players are on "${activeMapName}")`;
            }
        } else {
            banner.classList.add('vtt-hidden');
        }
    }

    // Load initial VTT states
    if (vtt.campaignState) {
        if (vtt.campaignState.settings) {
            campaignSettings = { ...campaignSettings, ...vtt.campaignState.settings };
        }
        
        if (vtt.campaignState.maps) {
            const targetMapId = (vtt.role === 'GM') ? (vtt.campaignState.activeGMMapId || vtt.campaignState.activeMapId) : (vtt.campaignState.playerMapOverrides?.[vtt.username] || vtt.campaignState.activeMapId);
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
                walls.forEach(w => {
                    if (w.type === undefined) {
                        w.type = w.isDoor ? 'door' : 'wall';
                    }
                });
            }
            if (vtt.campaignState.tokens) {
                tokens = vtt.campaignState.tokens;
            }
            if (vtt.campaignState.shapes) {
                shapes = vtt.campaignState.shapes;
            }
        }
    }

    // Connect WebSockets
    setupSocketSync();

    // Setup viewport mouse & wheel pan/zoom
    setupViewportControls();
    
    // Setup toolbar tool listeners
    setupToolControls();

    // Setup tabletop layers listeners
    if (vtt.role === 'GM') {
        setupLayersControls();
    }

    // Setup interactive drawing/action layers
    setupInteractionControls();

    // Setup edit map modal
    setupEditMapModal();

    // Setup upload map background handling
    setupMapUploadControls();
    setupPushPlayersModal();

    // Setup token edit modal actions
    setupTokenEditModal();

    // Setup spell shapes floating panel controls
    setupMeasurePanelControls();
    
    // Setup lighting object panel controls
    setupLightingPanelControls();

    // Setup global HP and Temp HP visibility controls
    if (vtt.role === 'GM') {
        setupHpSettingsControls();
    }
    syncHpSettingsInputs();

    // Rerender loop
    function updateContainerTransform() {
        if (container) {
            container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        }
    }
    function renderAll() {
        const isGmViewing = vtt.role === 'GM';
        let width = 1000;
        let height = 800;
        const currentMap = vtt.campaignState?.maps?.[currentMapId];

        if (!currentMap || !currentMap.mapImage) {
            // No map selected yet, render a blank tactical blueprint
            width = viewport.clientWidth || 1000;
            height = viewport.clientHeight || 800;
            
            canvasGrid.width = width;
            canvasGrid.height = height;
            canvasInteraction.width = width;
            canvasInteraction.height = height;
            canvasFog.width = width;
            canvasFog.height = height;
            
            ctxGrid.fillStyle = '#0d0f16';
            ctxGrid.fillRect(0, 0, width, height);
            
            ctxGrid.strokeStyle = 'rgba(212, 175, 55, 0.15)';
            ctxGrid.lineWidth = 1;
            
            const size = grid.size * grid.scale;
            for (let x = grid.offsetX; x < width; x += size) {
                ctxGrid.beginPath(); ctxGrid.moveTo(x, 0); ctxGrid.lineTo(x, height); ctxGrid.stroke();
            }
            for (let y = grid.offsetY; y < height; y += size) {
                ctxGrid.beginPath(); ctxGrid.moveTo(0, y); ctxGrid.lineTo(width, y); ctxGrid.stroke();
            }
        } else {
            const bgContainer = document.getElementById('vtt-map-bg-container');
            width = parseInt(bgContainer?.dataset?.naturalWidth) || 1000;
            height = parseInt(bgContainer?.dataset?.naturalHeight) || 1000;

            if (currentMap.gridWidth) {
                width = currentMap.gridWidth * grid.size * (grid.scale || 1.0);
            }
            if (currentMap.gridHeight) {
                height = currentMap.gridHeight * grid.size * (grid.scale || 1.0);
            }

            if(bgContainer) {
                bgContainer.style.width = `${width}px`;
                bgContainer.style.height = `${height}px`;
            }
            
            // Resize the main draggable #canvas-container so it doesn't clip the map bounds
            if(container) {
                container.style.width = `${width}px`;
                container.style.height = `${height}px`;
            }

            // Size canvases to match map dimensions
            if (canvasGrid.width !== width || canvasGrid.height !== height) {
                canvasGrid.width = width;
                canvasGrid.height = height;
                canvasGrid.style.width = `${width}px`;
                canvasGrid.style.height = `${height}px`;
                canvasInteraction.width = width;
                canvasInteraction.height = height;
                canvasInteraction.style.width = `${width}px`;
                canvasInteraction.style.height = `${height}px`;
                canvasFog.width = width;
                canvasFog.height = height;
                canvasFog.style.width = `${width}px`;
                canvasFog.style.height = `${height}px`;
            }

            // 1. Render Grid
            renderGridLayer(width, height);
        }

        // 2. Render Fog of War (Dynamic Raycasting)
        renderFogOfWarLayer(width, height);

        // 3. Render Interaction & Visuals (Tokens, Walls overlays, etc.)
        renderInteractionLayer();
    }

    function renderGridLayer(width, height) {
        ctxGrid.clearRect(0, 0, width, height);
        
        // 1. Draw Map Layer Assets (Movable background items under grid/fog)
        Object.entries(tokens)
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
            .forEach(([id, token]) => {
            const tokenLayer = token.layer || 'token';
            if (tokenLayer !== 'map') return; // Only render map layer assets here

            const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(token);
            const tx = token.x + drawW / 2;
            const ty = token.y + drawH / 2;

            ctxGrid.save();
            
            // Draw map assets as rectangular tiles
            if (token.img) {
                if (!imageCache[token.img]) {
                    const img = new Image();
                    img.onload = () => renderAll();
                    img.src = getSafeVttUrl(token.img);
                    imageCache[token.img] = img;
                }
                
                const cachedImg = imageCache[token.img];
                if (cachedImg.complete && cachedImg.naturalWidth > 0) {
                    if (vtt.role === 'GM' && activeLayer !== 'map') {
                        ctxGrid.globalAlpha = 0.5; // Faintly dim inactive map assets for GM
                    }
                    if (token.flipX || token.flipY) {
                        ctxGrid.save();
                        const cx = token.x + drawW / 2;
                        const cy = token.y + drawH / 2;
                        ctxGrid.translate(cx, cy);
                        ctxGrid.scale(token.flipX ? -1 : 1, token.flipY ? -1 : 1);
                        ctxGrid.drawImage(cachedImg, -drawW / 2, -drawH / 2, drawW, drawH);
                        ctxGrid.restore();
                    } else {
                        ctxGrid.drawImage(cachedImg, token.x, token.y, drawW, drawH);
                    }
                } else {
                    ctxGrid.fillStyle = 'rgba(100, 100, 100, 0.4)';
                    ctxGrid.fillRect(token.x, token.y, drawW, drawH);
                }
            } else {
                ctxGrid.fillStyle = 'rgba(100, 100, 100, 0.4)';
                ctxGrid.fillRect(token.x, token.y, drawW, drawH);
            }

            // Draw a subtle border outline only when GM is actively editing the Map Layer
            if (vtt.role === 'GM' && activeLayer === 'map') {
                ctxGrid.strokeStyle = 'var(--color-gold-base)';
                ctxGrid.lineWidth = 2;
                ctxGrid.strokeRect(token.x, token.y, drawW, drawH);

                // Draw name tag if editing
                ctxGrid.fillStyle = 'rgba(0,0,0,0.6)';
                const tagW = ctxGrid.measureText(token.name).width + 12;
                ctxGrid.fillRect(tx - tagW/2, token.y + drawH + 4, tagW, 16);
                ctxGrid.fillStyle = '#ffffff';
                ctxGrid.font = 'bold 10px Inter';
                ctxGrid.textAlign = 'center';
                ctxGrid.fillText(token.name, tx, token.y + drawH + 12);
            }

            ctxGrid.restore();
        });

        // 2. Draw tactical grid lines on top of background & map assets
        const opacity = grid.opacity !== undefined ? parseFloat(grid.opacity) : 0.3;
        const strokeColor = grid.color || '#888888';
        
        ctxGrid.strokeStyle = strokeColor;
        ctxGrid.globalAlpha = opacity;
        ctxGrid.lineWidth = 1;

        const size = grid.size * grid.scale;
        const offX = grid.offsetX || 0;
        const offY = grid.offsetY || 0;

        if (grid.type === 'hex-v' || grid.type === 'hex-h') {
            const isVert = grid.type === 'hex-v';
            const R = size / Math.sqrt(3);
            
            const drawHex = (cx, cy) => {
                ctxGrid.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle_deg = isVert ? (60 * i - 30) : (60 * i);
                    const angle_rad = Math.PI / 180 * angle_deg;
                    const hx = cx + R * Math.cos(angle_rad);
                    const hy = cy + R * Math.sin(angle_rad);
                    if (i === 0) ctxGrid.moveTo(hx, hy);
                    else ctxGrid.lineTo(hx, hy);
                }
                ctxGrid.closePath();
                ctxGrid.stroke();
            };

            if (isVert) {
                const W = Math.sqrt(3) * R;
                const ySpacing = 1.5 * R;
                
                let startCol = Math.floor(-offX / W) - 1;
                let endCol = Math.ceil((width - offX) / W) + 1;
                let startRow = Math.floor(-offY / ySpacing) - 1;
                let endRow = Math.ceil((height - offY) / ySpacing) + 1;
                
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        // For pointy top, odd rows are shifted right
                        const cx = offX + c * W + (Math.abs(r) % 2 === 1 ? W / 2 : 0);
                        const cy = offY + r * ySpacing;
                        drawHex(cx, cy);
                    }
                }
            } else {
                const H = Math.sqrt(3) * R;
                const xSpacing = 1.5 * R;
                
                let startCol = Math.floor(-offX / xSpacing) - 1;
                let endCol = Math.ceil((width - offX) / xSpacing) + 1;
                let startRow = Math.floor(-offY / H) - 1;
                let endRow = Math.ceil((height - offY) / H) + 1;
                
                for (let c = startCol; c <= endCol; c++) {
                    for (let r = startRow; r <= endRow; r++) {
                        // For flat top, odd columns are shifted down
                        const cx = offX + c * xSpacing;
                        const cy = offY + r * H + (Math.abs(c) % 2 === 1 ? H / 2 : 0);
                        drawHex(cx, cy);
                    }
                }
            }
        } else {
            // Draw vertical grid lines
            let startX = offX % size;
            if (startX > 0) startX -= size;
            for (let x = startX; x < width; x += size) {
                ctxGrid.beginPath();
                ctxGrid.moveTo(x, 0);
                ctxGrid.lineTo(x, height);
                ctxGrid.stroke();
            }

            // Draw horizontal grid lines
            let startY = offY % size;
            if (startY > 0) startY -= size;
            for (let y = startY; y < height; y += size) {
                ctxGrid.beginPath();
                ctxGrid.moveTo(0, y);
                ctxGrid.lineTo(width, y);
                ctxGrid.stroke();
            }
        }
        
        ctxGrid.globalAlpha = 1.0;
    }

    // Dynamic 2D Raycasting Fog of War
    function renderFogOfWarLayer(width, height) {
        ctxFog.clearRect(0, 0, width, height);

        if (vtt.role === 'GM' && gmTokenVisionMode && selectedTokenIds.size === 0) {
            gmTokenVisionMode = false; // Auto-exit if no tokens are selected
        }

        if (vtt.role === 'GM') {
            // Render a semi-translucent dark overlay over the whole map for GMs to see boundaries easily
            ctxFog.fillStyle = gmTokenVisionMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.25)';
            ctxFog.fillRect(0, 0, width, height);
        } else {
            // Fill complete workspace in pitch black (unexplored) for players
            ctxFog.fillStyle = '#000000';
            ctxFog.fillRect(0, 0, width, height);
        }

        // Reset vision polygons array
        visionPolygons = [];

        // Collect all tokens that grant vision (Player tokens only for actual sight)
        const visionSources = Object.values(tokens).filter(token => {
            if (vtt.role === 'GM' && gmTokenVisionMode) {
                return selectedTokenIds.has(token.id);
            }
            // GM sees all player tokens, players only see tokens they control
            return token.isPlayer && isTokenControlledByPlayer(token);
        });

        // Create temporary visibility layer to clip
        ctxFog.globalCompositeOperation = 'destination-out';

        // 1. Process standard Player Vision (completely clears fog)
        const currentMap = vtt.campaignState?.maps?.[currentMapId];
        const isDaylightMode = currentMap?.lightingSettings?.daylightMode;
        const updateOnDrop = currentMap?.lightingSettings?.updateOnDrop !== false;

        visionSources.forEach(source => {
            let cx, cy;
            
            // Update on Drop logic: if dragging this token, use original position for vision raycast
            if (updateOnDrop && dragTargetId && (dragTargetId === source.id || selectedTokenIds.has(source.id)) && tokenDragOriginalPositions[source.id]) {
                const { drawW, drawH } = getTokenDrawDimensions(source);
                cx = tokenDragOriginalPositions[source.id].x + drawW / 2;
                cy = tokenDragOriginalPositions[source.id].y + drawH / 2;
            } else {
                const center = getTokenCenter(source);
                cx = center.x;
                cy = center.y;
            }

            let sightRange = source.sightRange !== undefined ? parseInt(source.sightRange) : defaultSightRadius;
            if (isDaylightMode) sightRange = 99999;
            
            const radius = (sightRange / grid.feetPerSquare) * grid.size * grid.scale; // convert feet to grid pixels properly scaled

            if (radius <= 0) return;

            // Compute the 2D visibility polygon using raycasting
            const visibilityPolygon = computeVisibilityPolygon(cx, cy, radius, width, height);
            
            if (visibilityPolygon.length > 2) {
                visionPolygons.push(visibilityPolygon);
                // Clear out Fog within the visibility polygon
                ctxFog.beginPath();
                ctxFog.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
                for (let i = 1; i < visibilityPolygon.length; i++) {
                    ctxFog.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
                }
                ctxFog.closePath();
                
                // Soft fade for standard vision edge
                if (isDaylightMode) {
                    ctxFog.fillStyle = 'rgba(255, 255, 255, 1.0)';
                } else {
                    const grad = ctxFog.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius);
                    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
                    ctxFog.fillStyle = grad;
                }
                ctxFog.fill();
            }
        });

        // 2. Gather and Process Light Sources (Tokens with lights + Standalone lights)
        const lightSources = [];
        Object.values(tokens).forEach(t => {
            if (t.lightEnabled) {
                const center = getTokenCenter(t);
                lightSources.push({
                    x: center.x,
                    y: center.y,
                    lightBright: parseFloat(t.lightBright) || 0,
                    lightDim: parseFloat(t.lightDim) || 0,
                    lightColor: t.lightColor || '#ffffff'
                });
            }
        });
        lights.forEach(l => {
            lightSources.push({
                x: l.x,
                y: l.y,
                lightBright: parseFloat(l.lightBright) || 0,
                lightDim: parseFloat(l.lightDim) || 0,
                lightColor: l.lightColor || '#ffffff'
            });
        });

        lightSources.forEach(light => {
            const radiusBright = (light.lightBright / grid.feetPerSquare) * grid.size * grid.scale;
            const radiusDim = (light.lightDim / grid.feetPerSquare) * grid.size * grid.scale;
            const maxRadius = Math.max(radiusBright, radiusDim);

            if (maxRadius <= 0) return;

            const visibilityPolygon = computeVisibilityPolygon(light.x, light.y, maxRadius, width, height);
            if (visibilityPolygon.length < 3) return;

            // Trace polygon path
            ctxFog.beginPath();
            ctxFog.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
            for (let i = 1; i < visibilityPolygon.length; i++) {
                ctxFog.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
            }
            ctxFog.closePath();

            // Hole punching
            ctxFog.globalCompositeOperation = 'destination-out';
            
            const grad = ctxFog.createRadialGradient(light.x, light.y, 0, light.x, light.y, maxRadius);
            if (radiusBright > 0) {
                const brightStop = radiusBright / maxRadius;
                grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                if (brightStop < 1) {
                    grad.addColorStop(brightStop, 'rgba(255, 255, 255, 1.0)');
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
                }
            } else {
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            }
            ctxFog.fillStyle = grad;
            ctxFog.fill();

            // Add Color Tint
            if (light.lightColor && light.lightColor !== '#ffffff') {
                ctxFog.globalCompositeOperation = 'source-over';
                
                // Parse hex color to rgba
                const hex = light.lightColor.replace('#', '');
                const rVal = parseInt(hex.substring(0, 2), 16);
                const gVal = parseInt(hex.substring(2, 4), 16);
                const bVal = parseInt(hex.substring(4, 6), 16);
                const r = isNaN(rVal) ? 255 : rVal;
                const g = isNaN(gVal) ? 255 : gVal;
                const b = isNaN(bVal) ? 255 : bVal;
                
                const tintGrad = ctxFog.createRadialGradient(light.x, light.y, 0, light.x, light.y, maxRadius);
                tintGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
                
                if (radiusBright > 0) {
                    const brightStop = radiusBright / maxRadius;
                    if (brightStop < 1) {
                        tintGrad.addColorStop(brightStop, `rgba(${r}, ${g}, ${b}, 0.20)`);
                    }
                }
                
                tintGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
                
                ctxFog.fillStyle = tintGrad;
                ctxFog.fill();
            }
        });

        ctxFog.globalCompositeOperation = 'source-over';
    }

    function computeVisibilityPolygon(cx, cy, sightRadius, width, height) {
        // Collect rays and angles
        const angles = new Set();
        
        // Add extreme map corners to keep boundaries
        const boundaryPoints = [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height }
        ];

        // Setup boundary walls for ray casting
        const borderWalls = [
            { x1: 0, y1: 0, x2: width, y2: 0 },
            { x1: width, y1: 0, x2: width, y2: height },
            { x1: width, y1: height, x2: 0, y2: height },
            { x1: 0, y1: height, x2: 0, y2: 0 }
        ];

        // Process walls for active layout/collision calculations (e.g. including hinged open doors)
        const processedWalls = [];
        walls.forEach(w => {
            const coords = getWallCoordinatesForRaycasting(w);
            if (coords) {
                processedWalls.push({
                    x1: coords.x1,
                    y1: coords.y1,
                    x2: coords.x2,
                    y2: coords.y2,
                    isDoor: w.isDoor,
                    isOpen: w.isOpen
                });
            }
        });
        const allWalls = [...processedWalls, ...borderWalls];

        // Gather all unique wall vertices
        const points = [];
        allWalls.forEach(w => {
            points.push({ x: w.x1, y: w.y1 });
            points.push({ x: w.x2, y: w.y2 });
        });

        // Add boundary points
        points.push(...boundaryPoints);

        // Get unique points to prevent duplicates
        const uniquePoints = [];
        const seen = new Set();
        points.forEach(p => {
            const key = `${Math.round(p.x)},${Math.round(p.y)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePoints.push(p);
            }
        });

        // For each vertex, calculate ray angle and cast rays (slightly offset to catch wall edges)
        uniquePoints.forEach(p => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            let angle = Math.atan2(dy, dx);
            if (angle < 0) angle += Math.PI * 2;
            
            angles.add(angle);
            
            let aMinus = angle - 0.0001;
            if (aMinus < 0) aMinus += Math.PI * 2;
            angles.add(aMinus);
            
            let aPlus = angle + 0.0001;
            if (aPlus >= Math.PI * 2) aPlus -= Math.PI * 2;
            angles.add(aPlus);
        });

        // Add exact points where walls intersect the sight radius to prevent diagonal cuts
        allWalls.forEach(wall => {
            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const fx = wall.x1 - cx;
            const fy = wall.y1 - cy;
            
            const a = dx*dx + dy*dy;
            if (a === 0) return; // Skip zero-length walls

            const b = 2 * (fx*dx + fy*dy);
            const c = (fx*fx + fy*fy) - (sightRadius * sightRadius);
            
            const discriminant = b*b - 4*a*c;
            if (discriminant > 0) {
                const sqrtD = Math.sqrt(discriminant);
                const t1 = (-b - sqrtD) / (2*a);
                const t2 = (-b + sqrtD) / (2*a);
                
                [t1, t2].forEach(t => {
                    if (t >= 0 && t <= 1) {
                        const ix = wall.x1 + t * dx;
                        const iy = wall.y1 + t * dy;
                        let angle = Math.atan2(iy - cy, ix - cx);
                        if (angle < 0) angle += Math.PI * 2;
                        
                        angles.add(angle);
                        
                        let aMinus = angle - 0.0001;
                        if (aMinus < 0) aMinus += Math.PI * 2;
                        angles.add(aMinus);
                        
                        let aPlus = angle + 0.0001;
                        if (aPlus >= Math.PI * 2) aPlus -= Math.PI * 2;
                        angles.add(aPlus);
                    }
                });
            }
        });

        // Add regular interval rays to smooth circular sight bounds
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
            angles.add(a);
        }

        const sortedAngles = Array.from(angles).sort((a, b) => a - b);
        const polygon = [];

        sortedAngles.forEach(angle => {
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            // Construct Ray
            const rx = cx + dx * sightRadius;
            const ry = cy + dy * sightRadius;
            
            let closestT = 1.0;
            let intersectX = rx;
            let intersectY = ry;

            // Find closest wall intersection along ray
            allWalls.forEach(wall => {
                const intersect = getLineIntersection(
                    cx, cy, rx, ry,
                    wall.x1, wall.y1, wall.x2, wall.y2
                );

                if (intersect && intersect.t < closestT) {
                    closestT = intersect.t;
                    intersectX = intersect.x;
                    intersectY = intersect.y;
                }
            });

            polygon.push({ x: intersectX, y: intersectY });
        });

        return polygon;
    }

    // Standard ray-line intersection resolver
    function getLineIntersection(r_px, r_py, r_dx, r_dy, s_px, s_py, s_dx, s_dy) {
        const r_w = r_dx - r_px;
        const r_h = r_dy - r_py;
        const s_w = s_dx - s_px;
        const s_h = s_dy - s_py;

        const denom = r_w * s_h - r_h * s_w;
        if (denom === 0) return null; // Parallel

        const u = ((s_px - r_px) * r_h - (s_py - r_py) * r_w) / denom;
        const t = ((s_px - r_px) * s_h - (s_py - r_py) * s_w) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: r_px + t * r_w,
                y: r_py + t * r_h,
                t: t
            };
        }

        return null;
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

                if (wall.type === 'door' || wall.type === 'window') {
                    // Draw Interactive Object for GM (rotated if open)
                    const activeCoords = getWallCoordinatesForRaycasting(wall) || { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
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
                    } else if (wall.isLocked && !wall.isSecret) {
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

                    // Draw interactive circle handle(s)
                    if (wall.type === 'window') {
                        // Open/Close toggle
                        ctxInteraction.fillStyle = handleCol;
                        ctxInteraction.strokeStyle = isSelected ? '#ffc107' : '#ffffff';
                        ctxInteraction.lineWidth = isSelected ? 2.5 : 1.5;
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(midX - 12, midY, isSelected ? 12 : 10, 0, Math.PI * 2);
                        ctxInteraction.fill();
                        ctxInteraction.stroke();
                        
                        ctxInteraction.fillStyle = '#ffffff';
                        ctxInteraction.font = isSelected ? 'bold 11px Inter' : '9px Inter';
                        ctxInteraction.textAlign = 'center';
                        ctxInteraction.textBaseline = 'middle';
                        ctxInteraction.fillText(doorSymbol, midX - 12, midY);

                        // Draw/Undraw toggle
                        ctxInteraction.fillStyle = wall.isDrawn ? '#28a745' : '#6c757d'; // Green if drawn, gray if undrawn
                        ctxInteraction.strokeStyle = isSelected ? '#ffc107' : '#ffffff';
                        ctxInteraction.lineWidth = isSelected ? 2.5 : 1.5;
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(midX + 12, midY, isSelected ? 12 : 10, 0, Math.PI * 2);
                        ctxInteraction.fill();
                        ctxInteraction.stroke();
                        
                        ctxInteraction.fillStyle = '#ffffff';
                        ctxInteraction.font = isSelected ? 'bold 11px Inter' : '9px Inter';
                        ctxInteraction.fillText(wall.isDrawn ? '👁️' : '🕶️', midX + 12, midY);
                    } else {
                        // Open/Close toggle
                        ctxInteraction.fillStyle = handleCol;
                        ctxInteraction.strokeStyle = isSelected ? '#ffc107' : '#ffffff';
                        ctxInteraction.lineWidth = isSelected ? 2.5 : 1.5;
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(midX - 12, midY, isSelected ? 12 : 10, 0, Math.PI * 2);
                        ctxInteraction.fill();
                        ctxInteraction.stroke();
                        
                        ctxInteraction.fillStyle = '#ffffff';
                        ctxInteraction.font = isSelected ? 'bold 11px Inter' : '9px Inter';
                        ctxInteraction.textAlign = 'center';
                        ctxInteraction.textBaseline = 'middle';
                        ctxInteraction.fillText(doorSymbol, midX - 12, midY);

                        // Secret toggle
                        ctxInteraction.fillStyle = wall.isSecret ? '#6c757d' : '#28a745'; // Gray if secret, green if visible
                        ctxInteraction.strokeStyle = isSelected ? '#ffc107' : '#ffffff';
                        ctxInteraction.lineWidth = isSelected ? 2.5 : 1.5;
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(midX + 12, midY, isSelected ? 12 : 10, 0, Math.PI * 2);
                        ctxInteraction.fill();
                        ctxInteraction.stroke();
                        
                        ctxInteraction.fillStyle = '#ffffff';
                        ctxInteraction.font = isSelected ? 'bold 11px Inter' : '9px Inter';
                        ctxInteraction.fillText(wall.isSecret ? '🕶️' : '👁️', midX + 12, midY);
                    }

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
                        const isVertex1Hovered = hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 1;
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
                        const isVertex2Hovered = hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 2;
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
                    ctxInteraction.strokeStyle = isSelected ? '#ffc107' : (isHovered ? '#fd7e14' : '#dc3545');
                    ctxInteraction.lineWidth = isLightingActive ? (isSelected ? 6 : 4) : 2;
                    ctxInteraction.beginPath();
                    ctxInteraction.moveTo(wall.x1, wall.y1);
                    ctxInteraction.lineTo(wall.x2, wall.y2);
                    ctxInteraction.stroke();

                    // Draw end handles (only visible in Lighting Layer)
                    if (isLightingActive) {
                        // Endpoint 1
                        const isVertex1Hovered = hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 1;
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
                        const isVertex2Hovered = hoveredWallVertex && hoveredWallVertex.wallIdx === idx && hoveredWallVertex.endpoint === 2;
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

            // Draw current active wall segment in progress
            if (isDrawingWall && wallStartPoint) {
                ctxInteraction.strokeStyle = currentLightingType === 'door' ? '#fd7e14' : currentLightingType === 'window' ? '#0dcaf0' : '#ffc107';
                ctxInteraction.lineWidth = 3;
                ctxInteraction.setLineDash([6, 6]);
                ctxInteraction.beginPath();
                ctxInteraction.moveTo(wallStartPoint.x, wallStartPoint.y);
                
                // Track current mouse
                const mouse = getCanvasMouseCoords(lastMouseEvent);
                ctxInteraction.lineTo(mouse.x, mouse.y);
                ctxInteraction.stroke();
                ctxInteraction.setLineDash([]);
            }


            ctxInteraction.restore();
        } else {
            // Draw visible interactive objects for players
            
            // --- DRAW TOKENS ---
            Object.values(tokens || {}).forEach(t => {
                if (t.isVisible === false && !isGmViewing) return; // Players can't see explicitly hidden tokens
                if (t.layer !== activeLayer && !isGmViewing) return; // Players only see 'token' layer unless GM

                const cx = t.x * grid.size * grid.scale;
                const cy = t.y * grid.size * grid.scale;
                const sz = (t.size || 1) * grid.size * grid.scale;

                // Draw selection highlight
                if (selectedTokenIds.has(t.id)) {
                    ctxInteraction.strokeStyle = '#ffc107';
                    ctxInteraction.lineWidth = 3;
                    ctxInteraction.strokeRect(cx, cy, sz, sz);
                }

                // Draw token image
                if (t.imageUrl) {
                    const img = new Image();
                    img.src = t.imageUrl;
                    if (img.complete) {
                        ctxInteraction.drawImage(img, cx, cy, sz, sz);
                    } else {
                        img.onload = () => renderAll();
                    }
                } else {
                    // Fallback colored circle if no image
                    ctxInteraction.fillStyle = t.isPlayer ? '#28a745' : '#dc3545';
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(cx + sz/2, cy + sz/2, sz/2, 0, Math.PI*2);
                    ctxInteraction.fill();
                }

                // Draw HP bar
                if (t.maxHp) {
                    const hpPercent = Math.max(0, Math.min(1, (t.hp || 0) / t.maxHp));
                    ctxInteraction.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctxInteraction.fillRect(cx, cy + sz + 2, sz, 6);
                    ctxInteraction.fillStyle = hpPercent > 0.5 ? '#28a745' : (hpPercent > 0.2 ? '#ffc107' : '#dc3545');
                    ctxInteraction.fillRect(cx, cy + sz + 2, sz * hpPercent, 6);
                }
                
                // Draw Nameplate
                if (t.name) {
                    ctxInteraction.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    const textWidth = ctxInteraction.measureText(t.name).width;
                    ctxInteraction.fillRect(cx + sz/2 - textWidth/2 - 4, cy - 20, textWidth + 8, 16);
                    ctxInteraction.fillStyle = '#ffffff';
                    ctxInteraction.font = '12px Arial';
                    ctxInteraction.textAlign = 'center';
                    ctxInteraction.fillText(t.name, cx + sz/2, cy - 8);
                    ctxInteraction.textAlign = 'left';
                }
                
                // Draw conditions
                if (t.conditions && t.conditions.length > 0) {
                    const condSz = 12;
                    t.conditions.forEach((cond, idx) => {
                        ctxInteraction.fillStyle = cond.color || '#ff00ff';
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(cx + condSz/2 + (idx * (condSz+2)), cy + condSz/2, condSz/2, 0, Math.PI*2);
                        ctxInteraction.fill();
                    });
                }
            });

            walls.forEach(wall => {
                if (wall.type !== 'door' && wall.type !== 'window') return;
                
                const activeCoords = getWallCoordinatesForRaycasting(wall) || { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
                const midX = (activeCoords.x1 + activeCoords.x2) / 2;
                const midY = (activeCoords.y1 + activeCoords.y2) / 2;
                
                if (!isPointVisible(midX, midY)) return;
                if (wall.isSecret && vtt.role !== 'GM') return;

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
                    doorSymbol = wall.type === 'window' ? '🌫️' : '🔓';
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

                // Open/Close toggle (centered for players)
                ctxInteraction.fillStyle = handleCol;
                ctxInteraction.strokeStyle = '#ffffff';
                ctxInteraction.lineWidth = 1;
                ctxInteraction.beginPath();
                ctxInteraction.arc(midX, midY, 9, 0, Math.PI * 2);
                ctxInteraction.fill();
                ctxInteraction.stroke();
                
                ctxInteraction.fillStyle = '#ffffff';
                ctxInteraction.font = '8px Inter';
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
            const points = (rawShape === 'line' && measureAnchorPoints.length > 0) ? [...measureAnchorPoints, localShapeEnd] : null;
            drawMeasurementTemplate(ctxInteraction, localShapeStart, localShapeEnd, rawShape, anchor, beamW, color, vtt.username, null, points, true);
        }
        if (localIsMeasuring && localMeasureStart && localMeasureEnd) {
            const rawShape = isTokenMeasuring ? 'line' : (document.getElementById('measure-shape')?.value || 'line');
            const color = document.getElementById('measure-color')?.value || '#00ffff';
            const anchor = document.getElementById('measure-square-anchor')?.value || 'center';
            const beamW = parseFloat(document.getElementById('measure-beam-width')?.value || 5);
            const points = (rawShape === 'line' && measureAnchorPoints.length > 0) ? [...measureAnchorPoints, localMeasureEnd] : null;
            drawMeasurementTemplate(ctxInteraction, localMeasureStart, localMeasureEnd, rawShape, anchor, beamW, color, vtt.username, null, points, true);
        }
        if (typeof otherMeasurements !== 'undefined') {
            Object.values(otherMeasurements).forEach(m => {
                if (m.start && m.end) {
                    drawMeasurementTemplate(ctxInteraction, m.start, m.end, m.shape || 'line', m.squareAnchor || 'center', m.beamWidth || 5, m.color || '#00ffff', m.username, null, null, true);
                }
            });
        }

        // 1.2 Draw Standalone Light Emitters (GM only, when Lighting layer is active)
        if (vtt.role === 'GM' && activeLayer === 'lighting') {
            lights.forEach(light => {
                const isSelected = selectedLightId === light.id;
                const isHovered = hoveredLightId === light.id;
                
                ctxInteraction.fillStyle = isSelected ? '#ffc107' : (light.lightColor || '#ffaa00');
                ctxInteraction.strokeStyle = isHovered ? '#0dcaf0' : '#ffffff';
                ctxInteraction.lineWidth = (isSelected || isHovered) ? 2 : 1;
                
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
            });
        }

        // Helper: draw a spell effect/shape template on a canvas context
        function drawMeasurementTemplate(ctx, startPoint, endPoint, shapeType, squareAnchor, beamWidth, color, ownerUsername, _unused, points, showDistance) {
            if (!startPoint || !endPoint) return;
            const fillColor = color || '#00ffff';
            const strokeColor = fillColor;

            ctx.save();
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([]);

            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const radius = Math.hypot(dx, dy);

            // Track the pixel measurement relevant to each shape type for the distance label
            let distancePx = radius;
            let labelAtX = endPoint.x;
            let labelAtY = endPoint.y;

            if (shapeType === 'circle') {
                ctx.beginPath();
                ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.stroke();

                // Draw radius line
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.lineTo(endPoint.x, endPoint.y);
                ctx.stroke();
                ctx.setLineDash([]);

                distancePx = radius; // radius in pixels

            } else if (shapeType === 'square') {
                const halfSide = radius;
                let rx = startPoint.x, ry = startPoint.y;
                if (squareAnchor === 'center') {
                    rx = startPoint.x - halfSide;
                    ry = startPoint.y - halfSide;
                } else {
                    // corner anchor: draw from startPoint toward endPoint
                    rx = Math.min(startPoint.x, endPoint.x);
                    ry = Math.min(startPoint.y, endPoint.y);
                }
                const side = halfSide * 2;
                ctx.beginPath();
                ctx.rect(rx, ry, side, side);
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.stroke();

                distancePx = side; // show the full side length

            } else if (shapeType === 'cone') {
                const angle = Math.atan2(dy, dx);
                const halfAngle = Math.PI / 4; // 90 degree cone
                ctx.beginPath();
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.arc(startPoint.x, startPoint.y, radius, angle - halfAngle, angle + halfAngle);
                ctx.closePath();
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.stroke();

                distancePx = radius; // cone length

            } else if (shapeType === 'beam') {
                const angle = Math.atan2(dy, dx);
                const length = radius;
                // beamWidth is in feet — convert to canvas pixels using the grid scale
                const pxPerFt = (grid.size * (grid.scale || 1.0)) / (grid.feetPerSquare || 5);
                const halfWidth = ((beamWidth || 5) * pxPerFt) / 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const perpX = -sin * halfWidth;
                const perpY = cos * halfWidth;

                ctx.beginPath();
                ctx.moveTo(startPoint.x + perpX, startPoint.y + perpY);
                ctx.lineTo(startPoint.x + cos * length + perpX, startPoint.y + sin * length + perpY);
                ctx.lineTo(startPoint.x + cos * length - perpX, startPoint.y + sin * length - perpY);
                ctx.lineTo(startPoint.x - perpX, startPoint.y - perpY);
                ctx.closePath();
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.stroke();

                distancePx = length; // beam length

            } else {
                // Default: line (polyline if points array given, else simple line)
                const polyPoints = (Array.isArray(points) && points.length >= 2) ? points : [startPoint, endPoint];
                ctx.beginPath();
                ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
                for (let i = 1; i < polyPoints.length; i++) {
                    ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
                }
                ctx.lineWidth = 8;
                ctx.globalAlpha = 0.7;
                ctx.stroke();

                // Draw endpoint dot
                ctx.beginPath();
                ctx.arc(polyPoints[polyPoints.length - 1].x, polyPoints[polyPoints.length - 1].y, 6, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.globalAlpha = 1.0;
                ctx.fill();

                // Total polyline path length in pixels
                let totalLen = 0;
                for (let i = 1; i < polyPoints.length; i++) {
                    totalLen += Math.hypot(polyPoints[i].x - polyPoints[i - 1].x, polyPoints[i].y - polyPoints[i - 1].y);
                }
                distancePx = totalLen;
                labelAtX = polyPoints[polyPoints.length - 1].x;
                labelAtY = polyPoints[polyPoints.length - 1].y;
            }

            // Distance label — shown only during live drawing (showDistance === true)
            if (showDistance && distancePx > 0) {
                const distFt = calcDistanceFt(distancePx);
                const label = `${distFt} ft`;
                ctx.save();
                ctx.globalAlpha = 1.0;
                ctx.font = 'bold 13px Inter, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const tw = ctx.measureText(label).width;
                const padX = 8;
                const padY = 4;
                const pillW = tw + padX * 2;
                const pillH = 22;
                // Position the pill above and slightly to the right of the endpoint
                const pillX = labelAtX + 14;
                const pillY = labelAtY - 22;
                const r = pillH / 2;
                // Draw pill background
                ctx.fillStyle = 'rgba(15, 15, 20, 0.82)';
                ctx.beginPath();
                ctx.moveTo(pillX - pillW / 2 + r, pillY - pillH / 2);
                ctx.arcTo(pillX + pillW / 2, pillY - pillH / 2, pillX + pillW / 2, pillY + pillH / 2, r);
                ctx.arcTo(pillX + pillW / 2, pillY + pillH / 2, pillX - pillW / 2, pillY + pillH / 2, r);
                ctx.arcTo(pillX - pillW / 2, pillY + pillH / 2, pillX - pillW / 2, pillY - pillH / 2, r);
                ctx.arcTo(pillX - pillW / 2, pillY - pillH / 2, pillX + pillW / 2, pillY - pillH / 2, r);
                ctx.closePath();
                ctx.fill();
                // Draw pill border in shape color
                ctx.strokeStyle = fillColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                // Draw text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, pillX, pillY);
                ctx.restore();
            }

            // Owner label
            if (ownerUsername) {
                ctx.font = '11px Inter, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                const lx = (startPoint.x + endPoint.x) / 2;
                const ly = Math.min(startPoint.y, endPoint.y) - 2;
                const tw = ctx.measureText(ownerUsername).width + 8;
                ctx.fillRect(lx - tw / 2, ly - 13, tw, 14);
                ctx.fillStyle = fillColor;
                ctx.fillText(ownerUsername, lx, ly);
            }

            ctx.restore();
        }

        // 1.5 Draw Persistent Shapes/Effects Layer (Underneath Tokens)
        Object.values(shapes).forEach(s => {
            if (s.layer !== activeLayer && !isGmViewing) return;
            const isSelected = selectedShapeId === s.id || selectedShapeIds.has(s.id);
            
            ctxInteraction.save();
            if (isSelected) {
                ctxInteraction.shadowColor = 'var(--color-gold-light)';
                ctxInteraction.shadowBlur = 8;
            }
            
            drawMeasurementTemplate(ctxInteraction, s.startPoint, s.endPoint, s.shape, s.squareAnchor, s.beamWidth, s.color, s.ownerUsername, null, s.points || null, false);
            drawShapeComponentHandles(ctxInteraction, s, s.id);
            ctxInteraction.restore();
            
            // If select tool is active, draw a premium center target anchor ring
            if (activeTool === 'select') {
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

        // 2.0 Draw Token Auras Pass (Floor Projection Mode)
        Object.entries(tokens)
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
            .forEach(([id, token]) => {
                let auras = [];
                if (token.auras && Array.isArray(token.auras)) {
                    auras = token.auras;
                } else if (token.auraEnabled) {
                    auras = [{
                        range: token.auraRange !== undefined ? token.auraRange : 10,
                        shape: token.auraShape || 'circle',
                        style: token.auraStyle || 'both',
                        opacity: token.auraOpacity !== undefined ? token.auraOpacity : 0.3,
                        color: token.auraColor || '#d4af37'
                    }];
                }
                
                if (auras.length === 0) return;
                
                const tokenLayer = token.layer || 'token';
                if (tokenLayer === 'map') return;
                if (tokenLayer === 'gm' && vtt.role !== 'GM') return;
                
                const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(token);
                const tx = token.x + drawW / 2;
                const ty = token.y + drawH / 2;
                
                // Respect Fog of War / Player Line of Sight
                if (vtt.role === 'Player' && !isPointVisible(tx, ty)) {
                    return;
                }
                
                auras.forEach(aura => {
                    const auraRange = parseFloat(aura.range) || 10;
                    const auraRangePx = (auraRange / grid.feetPerSquare) * grid.size * grid.scale;
                    const auraShape = aura.shape || 'circle';
                    const auraColor = aura.color || '#d4af37';
                    const auraOpacity = parseFloat(aura.opacity) || 0.3;
                    const auraStyle = aura.style || 'both';
                    
                    ctxInteraction.save();
                    
                    // Respect visual transparency/dimming based on VTT active layers
                    if (tokenLayer === 'gm') {
                        ctxInteraction.globalAlpha = 0.5;
                    }
                    if (vtt.role === 'GM' && activeLayer !== tokenLayer) {
                        ctxInteraction.globalAlpha = tokenLayer === 'gm' ? 0.25 : 0.6;
                    }
                    
                    ctxInteraction.beginPath();
                    if (auraShape === 'circle') {
                        const radiusPx = tokenRadius + auraRangePx;
                        ctxInteraction.arc(tx, ty, radiusPx, 0, Math.PI * 2);
                    } else { // square
                        const x1 = token.x - auraRangePx;
                        const y1 = token.y - auraRangePx;
                        const w = drawW + 2 * auraRangePx;
                        const h = drawH + 2 * auraRangePx;
                        if (ctxInteraction.roundRect) {
                            ctxInteraction.roundRect(x1, y1, w, h, 8);
                        } else {
                            ctxInteraction.rect(x1, y1, w, h);
                        }
                    }
                    
                    const baseAlpha = ctxInteraction.globalAlpha;
                    
                    // Draw Fill
                    if (auraStyle === 'both' || auraStyle === 'fill') {
                        ctxInteraction.fillStyle = auraColor;
                        ctxInteraction.globalAlpha = baseAlpha * auraOpacity;
                        ctxInteraction.fill();
                    }
                    
                    // Draw Border with glowing effect
                    if (auraStyle === 'both' || auraStyle === 'border') {
                        ctxInteraction.strokeStyle = auraColor;
                        ctxInteraction.globalAlpha = baseAlpha * Math.min(1.0, auraOpacity + 0.35);
                        ctxInteraction.lineWidth = 2.5;
                        ctxInteraction.shadowColor = auraColor;
                        ctxInteraction.shadowBlur = 6;
                        ctxInteraction.stroke();
                    }
                    
                    ctxInteraction.restore();
                });
            });

        // 2. Draw Tokens Layer
        Object.entries(tokens)
            .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
            .forEach(([id, token], sortedIndex) => {
            const tokenLayer = token.layer || 'token';
            // Sync DOM Node for ALL tokens
            const htmlOverlayLayer = document.getElementById('vtt-html-overlays');
            if (htmlOverlayLayer) {
                let node = document.getElementById('asset_node_' + id);
                
                // Determine what tag type we need
                const cleanImgUrl = token.img ? token.img.split('?')[0].toLowerCase() : '';
                const isActuallyVideo = token.isVideo || (cleanImgUrl && cleanImgUrl.match(/\.(mp4|webm|ogg)$/i));
                const needsIframe = token.img && token.img.includes('youtube.com');
                const needsImg = token.img && !needsIframe && (!isActuallyVideo || cleanImgUrl.endsWith('.gif'));
                const needsVideo = token.img && !needsIframe && !needsImg && isActuallyVideo;
                const needsDiv = !token.img;
                
                const neededTag = needsIframe ? 'IFRAME' : needsImg ? 'IMG' : needsVideo ? 'VIDEO' : 'DIV';
                
                // If node exists but is wrong element type (e.g. switched from image to video), destroy and recreate
                if (node && node.tagName !== neededTag) {
                    node.remove();
                    node = null;
                }
                
                if (!node) {
                    if (needsIframe) {
                        node = document.createElement('iframe');
                        node.setAttribute('src', getSafeVttUrl(token.img));
                        node.frameBorder = "0";
                        node.setAttribute('allow', 'autoplay; encrypted-media');
                    } else if (needsImg) {
                        node = document.createElement('img');
                        node.setAttribute('src', getSafeVttUrl(token.img));
                        node.draggable = false;
                    } else if (needsVideo) {
                        node = document.createElement('video');
                        node.setAttribute('src', getSafeVttUrl(token.img));
                        node.autoplay = true;
                        node.loop = true;
                        node.muted = true;
                        node.playsInline = true;
                    } else {
                        node = document.createElement('div');
                    }
                    node.id = 'asset_node_' + id;
                    node.style.position = 'absolute';
                    node.style.pointerEvents = 'none';
                    htmlOverlayLayer.appendChild(node);
                } else if (token.img && node.getAttribute('src') !== token.img) {
                    // Update src if it changed (e.g. player swapped token artwork)
                    node.setAttribute('src', getSafeVttUrl(token.img));
                    if (node.tagName === 'VIDEO') node.load();
                }
                
                if (needsDiv) {
                    node.style.backgroundColor = token.color || '#333333';
                }
                
                // Determine size
                const { drawW, drawH } = getTokenDrawDimensions(token);
                
                // Sync position and size
                node.style.left = `${token.x}px`;
                node.style.top = `${token.y}px`;
                node.style.width = `${drawW}px`;
                node.style.height = `${drawH}px`;
                node.style.zIndex = sortedIndex;
                
                // Apply circular clipping if it is a standard Token
                if (!token.isAsset) {
                    node.style.borderRadius = '50%';
                    node.style.objectFit = 'cover';
                    if (!token.isBorderless) {
                        const borderColor = token.isPlayer ? 'rgba(0, 123, 255, 0.8)' : 'rgba(220, 53, 69, 0.8)';
                        node.style.border = `2px solid ${borderColor}`;
                        node.style.boxSizing = 'border-box';
                    } else {
                        node.style.border = 'none';
                    }
                } else {
                    node.style.borderRadius = '0';
                    node.style.objectFit = 'fill';
                    node.style.border = 'none';
                }
                // Apply flip transform
                let transformStr = '';
                if (token.flipX) transformStr += 'scaleX(-1) ';
                if (token.flipY) transformStr += 'scaleY(-1)';
                transformStr = transformStr.trim();
                node.style.transform = transformStr || 'none';
                
                // Render customizable Floor Shadow via CSS
                if (token.fxShadowEnabled) {
                    const sBlur = token.fxShadowBlur !== undefined ? token.fxShadowBlur : 12;
                    const sOffset = token.fxShadowOffset !== undefined ? token.fxShadowOffset : 4;
                    const sColor = token.fxShadowColor || '#000000';
                    const sOpacity = token.fxShadowOpacity !== undefined ? token.fxShadowOpacity : 0.7;
                    
                    let shadowColorRgba = 'rgba(0,0,0,0.7)';
                    if (sColor.startsWith('#')) {
                        const r = parseInt(sColor.slice(1, 3), 16) || 0;
                        const g = parseInt(sColor.slice(3, 5), 16) || 0;
                        const b = parseInt(sColor.slice(5, 7), 16) || 0;
                        shadowColorRgba = `rgba(${r}, ${g}, ${b}, ${sOpacity})`;
                    }
                    node.style.filter = `drop-shadow(${sOffset}px ${sOffset}px ${sBlur}px ${shadowColorRgba})`;
                } else {
                    node.style.filter = 'none';
                }
                
                // Hide if on wrong layer or explicitly hidden
                if ((tokenLayer === 'gm' && vtt.role !== 'GM') || 
                    (token.isVisible === false && vtt.role !== 'GM')) {
                    node.style.display = 'none';
                } else {
                    node.style.display = 'block';
                    node.style.opacity = (tokenLayer === 'gm' && vtt.role === 'GM') ? '0.5' : '1.0';
                }
            }

            // Skip rendering Map Layer assets on this canvas (drawn on Grid canvas)
            // UNLESS the asset is hovered or dragged, in which case we draw the selection glow here.
            if (tokenLayer === 'map') {
                if (vtt.role === 'GM' && activeLayer === 'map' && (id === activeDragTokenId || id === hoverTokenId)) {
                    const { drawW, drawH } = getTokenDrawDimensions(token);
                    ctxInteraction.strokeStyle = 'var(--color-gold-base)';
                    ctxInteraction.lineWidth = 4;
                    ctxInteraction.shadowColor = 'var(--color-gold-light)';
                    ctxInteraction.shadowBlur = 10;
                    ctxInteraction.strokeRect(token.x - 2, token.y - 2, drawW + 4, drawH + 4);
                    ctxInteraction.shadowBlur = 0; // reset
                }
                const uiNode = document.getElementById('token_ui_' + id);
                if (uiNode) uiNode.style.display = 'none';
                return;
            }

            // GM Layer tokens are hidden from players
            if (tokenLayer === 'gm' && vtt.role !== 'GM') {
                const uiNode = document.getElementById('token_ui_' + id);
                if (uiNode) uiNode.style.display = 'none';
                return;
            }

            const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(token);
            const tx = token.x + drawW / 2;
            const ty = token.y + drawH / 2;

            // Draw ghost token if currently dragging this token
            if (id === dragTargetId) {
                const originalPos = tokenDragOriginalPositions[id];
                if (originalPos) {
                    ctxInteraction.save();
                    ctxInteraction.globalAlpha = 0.4;
                    const cachedImg = token.img ? imageCache[token.img] : null;
                    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
                        ctxInteraction.save();
                        if (!token.isAsset) {
                            ctxInteraction.beginPath();
                            ctxInteraction.arc(originalPos.x + drawW / 2, originalPos.y + drawH / 2, tokenRadius, 0, Math.PI * 2);
                            ctxInteraction.clip();
                        }
                        if (token.flipX || token.flipY) {
                            ctxInteraction.save();
                            const cx = originalPos.x + drawW / 2;
                            const cy = originalPos.y + drawH / 2;
                            ctxInteraction.translate(cx, cy);
                            ctxInteraction.scale(token.flipX ? -1 : 1, token.flipY ? -1 : 1);
                            ctxInteraction.drawImage(cachedImg, -drawW / 2, -drawH / 2, drawW, drawH);
                            ctxInteraction.restore();
                        } else {
                            ctxInteraction.drawImage(cachedImg, originalPos.x, originalPos.y, drawW, drawH);
                        }
                        ctxInteraction.restore();
                    } else {
                        ctxInteraction.fillStyle = token.color || '#333333';
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(originalPos.x + drawW / 2, originalPos.y + drawH / 2, tokenRadius, 0, Math.PI * 2);
                        ctxInteraction.fill();
                    }
                    if (!token.isAsset && !token.isBorderless) {
                        ctxInteraction.strokeStyle = token.isPlayer ? 'rgba(0, 123, 255, 0.8)' : 'rgba(220, 53, 69, 0.8)';
                        ctxInteraction.lineWidth = 2;
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(originalPos.x + drawW / 2, originalPos.y + drawH / 2, tokenRadius - 1, 0, Math.PI * 2);
                        ctxInteraction.stroke();
                    }
                    ctxInteraction.restore();
                }
            }

            ctxInteraction.save();

            // Set visual transparency/dimming based on layers state
            if (tokenLayer === 'gm') {
                ctxInteraction.globalAlpha = 0.5; // GM layer is translucent
            }
            if (vtt.role === 'GM' && activeLayer !== tokenLayer) {
                // Dim inactive layers for clarity
                ctxInteraction.globalAlpha = tokenLayer === 'gm' ? 0.25 : 0.6;
            }

            // Draw selection glow outline if hovered, dragged, or multi-selected
            const isTokenSelected = selectedTokenIds.has(id);
            if (id === activeDragTokenId || id === hoverTokenId || isTokenSelected) {
                ctxInteraction.strokeStyle = isTokenSelected ? 'var(--color-gold-base)' : 'rgba(212, 175, 55, 0.6)';
                ctxInteraction.lineWidth = isTokenSelected ? 4.5 : 3;
                ctxInteraction.shadowColor = 'var(--color-gold-light)';
                ctxInteraction.shadowBlur = isTokenSelected ? 12 : 8;
                
                if (token.isAsset) {
                    ctxInteraction.strokeRect(token.x - 2, token.y - 2, drawW + 4, drawH + 4);
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius + (isTokenSelected ? 3.5 : 2), 0, Math.PI * 2);
                    ctxInteraction.stroke();
                }

                if (isTokenSelected) {
                    // Draw inner white-gold dashed ring for a highly polished UI feel
                    ctxInteraction.save();
                    ctxInteraction.strokeStyle = '#ffffff';
                    ctxInteraction.lineWidth = 1;
                    ctxInteraction.setLineDash([4, 4]);
                    
                    if (token.isAsset) {
                        ctxInteraction.strokeRect(token.x, token.y, drawW, drawH);
                    } else {
                        ctxInteraction.beginPath();
                        ctxInteraction.arc(tx, ty, tokenRadius + 1, 0, Math.PI * 2);
                        ctxInteraction.stroke();
                    }
                    ctxInteraction.restore();
                }
                
                ctxInteraction.shadowBlur = 0; // reset
            }

            // Render Color Overlay FX
            if (token.fxOverlayEnabled) {
                ctxInteraction.save();
                const oColor = token.fxOverlayColor || '#007bff';
                const oOpacity = token.fxOverlayOpacity !== undefined ? token.fxOverlayOpacity : 0.3;
                
                ctxInteraction.globalAlpha = oOpacity;
                ctxInteraction.fillStyle = oColor;
                if (token.isAsset) {
                    ctxInteraction.fillRect(token.x, token.y, drawW, drawH);
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius, 0, Math.PI * 2);
                    ctxInteraction.fill();
                }
                ctxInteraction.restore();
            }

            // Render Vignette Frame FX
            if (token.fxVignetteEnabled) {
                ctxInteraction.save();
                const vColor = token.fxVignetteColor || '#000000';
                const vOpacity = token.fxVignetteOpacity !== undefined ? token.fxVignetteOpacity : 0.6;
                
                const grad = ctxInteraction.createRadialGradient(
                    tx, ty, tokenRadius * 0.4,
                    tx, ty, tokenRadius
                );
                
                let vigColorRgba = 'rgba(0,0,0,0.6)';
                if (vColor.startsWith('#')) {
                    const r = parseInt(vColor.slice(1, 3), 16) || 0;
                    const g = parseInt(vColor.slice(3, 5), 16) || 0;
                    const b = parseInt(vColor.slice(5, 7), 16) || 0;
                    vigColorRgba = `rgba(${r}, ${g}, ${b}, ${vOpacity})`;
                }
                
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, vigColorRgba);
                
                ctxInteraction.fillStyle = grad;
                if (token.isAsset) {
                    ctxInteraction.fillRect(token.x, token.y, drawW, drawH);
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius, 0, Math.PI * 2);
                    ctxInteraction.fill();
                }
                ctxInteraction.restore();
            }
            
            ctxInteraction.restore(); // Restores context globalAlpha and clipping path

            // Render token border frame
            if (!token.isVideo) {
                ctxInteraction.strokeStyle = token.isPlayer ? 'rgba(0, 123, 255, 0.8)' : 'rgba(220, 53, 69, 0.8)';
                if (token.isAsset || token.isBorderless) ctxInteraction.strokeStyle = 'transparent'; // No border for freeform image assets or borderless tokens
                ctxInteraction.lineWidth = 2;
                if (token.isAsset || token.isBorderless) {
                    // No default border for assets or borderless tokens
                } else {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(tx, ty, tokenRadius - 1, 0, Math.PI * 2);
                    ctxInteraction.stroke();
                }
            }

            // ── Dying glow: red pulsing ring when linked player HP = 0 ──
            if (token.isPlayer && token.maxHp > 0 && token.hp <= 0) {
                ctxInteraction.save();
                ctxInteraction.shadowBlur = 18;
                ctxInteraction.shadowColor = 'rgba(220, 53, 69, 1)';
                ctxInteraction.strokeStyle = 'rgba(220, 53, 69, 0.9)';
                ctxInteraction.lineWidth = 3;
                ctxInteraction.beginPath();
                ctxInteraction.arc(tx, ty, tokenRadius + 3, 0, Math.PI * 2);
                ctxInteraction.stroke();
                ctxInteraction.restore();
            }

            // --- DOM Overlay Sync for Token UI ---
            if (htmlOverlayLayer) {
                const uiNodeId = 'token_ui_' + id;
                let uiNode = document.getElementById(uiNodeId);
                
                const { drawW, drawH } = getTokenDrawDimensions(token);
                // Only render UI if the token is visible (visibility by fog handled via CSS z-index)
                const isVisible = !(tokenLayer === 'gm' && vtt.role !== 'GM');
                
                if (isVisible) {
                    if (!uiNode) {
                        uiNode = document.createElement('div');
                        uiNode.id = uiNodeId;
                        uiNode.className = 'token-ui-container';
                        uiNode.style.position = 'absolute';
                        uiNode.style.pointerEvents = 'none';
                        uiNode.style.overflow = 'hidden';
                        uiNode.style.transformOrigin = 'top left';
                        uiNode.style.zIndex = '1000';
                        
                        // Internal structure
                        uiNode.innerHTML = `
                            <div class="token-name-tag" style="position:absolute; top:4px; left:4px; right:4px; transform:none; background:rgba(0,0,0,0.75); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:12px; font-weight:bold; font-family:var(--font-primary); padding:2px 6px; border-radius:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 8px); pointer-events:none;"></div>
                            <div class="token-condition-container" style="display:none; position:absolute; top:4px; right:4px; flex-direction:column; align-items:flex-end; gap:2px; width:auto; max-width:calc(100% - 8px); pointer-events:none;"></div>
                            <div class="token-hp-bar-bg" style="position:absolute; bottom:4px; left:4px; right:4px; height:8px; background:rgba(0,0,0,0.8); border:1px solid var(--color-border-subtle); border-radius:4px; display:none; overflow:hidden; z-index:1;">
                                <div class="token-hp-bar-fill" style="height:100%; background:var(--color-success); border-radius:2px; transition:width 0.3s ease;"></div>
                            </div>
                            <div class="token-temp-hp-fill-wrapper" style="position:absolute; bottom:4px; left:4px; right:4px; height:8px; display:none; overflow:hidden; z-index:2;">
                                <div class="token-temp-hp-fill" style="height:100%; background:#007bff; border-radius:2px;"></div>
                            </div>
                            <div class="token-hp-number" style="position:absolute; bottom:14px; left:50%; transform:translateX(-50%); color:white; font-size:10px; font-weight:bold; text-shadow:0 0 2px black; display:none; white-space:nowrap; pointer-events:none; z-index:3;"></div>
                            <div class="token-flight-container" style="display:none; position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.8); border:1px solid var(--color-gold-base); color:white; font-family:var(--font-primary); width:24px; height:24px; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center;">
                                <i class="fa-solid fa-feather" style="font-size:10px; margin-bottom:1px; line-height:1;"></i>
                                <span class="flight-altitude" style="font-size:9px; line-height:1; font-weight:bold;"></span>
                            </div>
                            <div class="token-health-bar-container" style="display:none;"></div>
                            <div class="token-health-text" style="display:none;"></div>
                        `;
                        htmlOverlayLayer.appendChild(uiNode);
                    }
                    
                    // 1. Position Container using hardware-accelerated transform
                    const { drawW, drawH } = getTokenDrawDimensions(token);
                    uiNode.style.transform = `translate3d(${token.x}px, ${token.y}px, 0)`;
                    uiNode.style.width = `${drawW}px`;
                    uiNode.style.height = `${drawH}px`;
                    uiNode.style.display = 'block';
                    
                    // 2. Name Tag
                    const nameNode = uiNode.querySelector('.token-name-tag');
                    if (nameNode.textContent !== token.name) {
                        nameNode.textContent = token.name;
                    }
                    nameNode.style.top = '4px';

                    const isHovered = id === hoverTokenId;
                    const rolePrefix = vtt.role === 'GM' ? 'gm' : 'player';
                    const targetType = token.isPlayer ? 'Player' : 'Monster';

                    // Name Tag Visibility
                    let nameVisibleSetting = campaignSettings[`${rolePrefix}${targetType}NameVisible`] ?? 'always';
                    let showName = nameVisibleSetting === 'always' || (nameVisibleSetting === 'hover' && isHovered);
                    
                    if (showName) {
                        nameNode.style.display = 'block';
                    } else {
                        nameNode.style.display = 'none';
                    }
                    
                    // 3. Health Bar & Text
                    const hpContainer = uiNode.querySelector('.token-hp-bar-bg');
                    const hpText = uiNode.querySelector('.token-hp-number');
                    const hpFill = uiNode.querySelector('.token-hp-bar-fill');
                    const tempHpWrapper = uiNode.querySelector('.token-temp-hp-fill-wrapper');
                    const tempHpFill = uiNode.querySelector('.token-temp-hp-fill');
                    
                    if (token.maxHp > 0) {
                        const tempHp = token.tempHp || 0;
                        let barVisibleSetting = token.hpBarVisibleOverride || 'default';
                        if (barVisibleSetting === 'default') {
                            barVisibleSetting = campaignSettings[`${rolePrefix}${targetType}HpBarVisible`] ?? 'always';
                        }
                        
                        let showBar = barVisibleSetting === 'always' || (barVisibleSetting === 'hover' && isHovered);
                        
                        let numVisibleOverride = token.hpNumVisibleOverride || 'default';
                        let showNumSetting;
                        if (numVisibleOverride === 'default') {
                            showNumSetting = campaignSettings[`${rolePrefix}${targetType}HpNumVisible`] ?? true;
                        } else {
                            showNumSetting = (numVisibleOverride === 'always');
                        }
                        let showNum = showBar && showNumSetting; 
                        
                        // temp hp
                        let tempHpBarVisible = campaignSettings[`${rolePrefix}TempHpBarVisible`] ?? 'always';
                        
                        let showTempBar = tempHpBarVisible === 'always' || (tempHpBarVisible === 'hover' && isHovered);
                        let showTempNumSetting = campaignSettings[`${rolePrefix}TempHpNumVisible`] ?? true;
                        let showTempNum = showTempBar && showTempNumSetting; 
                        
                        if (showBar) {
                            hpContainer.style.display = 'block';
                            
                            let hpColor = 'hsl(145, 63%, 42%)';
                            const rawHpPct = token.hp / token.maxHp;
                            if (rawHpPct < 0.25) hpColor = 'hsl(354, 70%, 54%)';
                            else if (rawHpPct < 0.5) hpColor = 'hsl(43, 65%, 52%)';
                            hpFill.style.backgroundColor = hpColor;
                            
                            // Reset common styles
                            hpContainer.style.left = '4px';
                            hpContainer.style.right = '4px';
                            hpContainer.style.width = 'auto';
                            tempHpWrapper.style.left = '4px';
                            tempHpWrapper.style.right = '4px';
                            tempHpWrapper.style.width = 'auto';
                            tempHpWrapper.style.bottom = '4px';
                            
                            let style = campaignSettings.tempHpBarStyle || 'stacked';
                            if (style !== 'stacked' && showTempBar && tempHp > 0) {
                                tempHpWrapper.style.background = 'rgba(0,0,0,0.8)';
                                tempHpWrapper.style.border = '1px solid var(--color-border-subtle)';
                                tempHpWrapper.style.borderRadius = '4px';
                            } else {
                                tempHpWrapper.style.background = 'none';
                                tempHpWrapper.style.border = 'none';
                                tempHpWrapper.style.borderRadius = '0';
                            }
                            
                            if (style === 'appended' && showTempBar && tempHp > 0) {
                                const totalMax = token.maxHp + tempHp;
                                const maxHpPct = Math.max(0, token.maxHp / totalMax);
                                const tempHpPct = Math.max(0, tempHp / totalMax);
                                
                                hpContainer.style.right = 'auto';
                                hpContainer.style.width = `calc(${maxHpPct} * (100% - 8px))`;
                                const hpFillPct = Math.max(0, token.hp / token.maxHp);
                                hpFill.style.width = `${hpFillPct * 100}%`;
                                
                                tempHpWrapper.style.left = `calc(4px + ${maxHpPct} * (100% - 8px))`;
                                tempHpWrapper.style.width = `calc(${tempHpPct} * (100% - 8px))`;
                                tempHpWrapper.style.right = 'auto';
                                tempHpFill.style.width = '100%';
                            } else if (style === 'split' && showTempBar && tempHp > 0) {
                                hpContainer.style.right = 'auto';
                                hpContainer.style.width = `calc(0.5 * (100% - 8px))`;
                                const hpFillPct = Math.max(0, Math.min(1, token.hp / token.maxHp));
                                hpFill.style.width = `${hpFillPct * 100}%`;
                                
                                tempHpWrapper.style.left = `calc(50%)`;
                                tempHpWrapper.style.width = `calc(0.5 * (100% - 8px))`;
                                tempHpWrapper.style.right = 'auto';
                                const tempFillPct = Math.max(0, Math.min(1, tempHp / token.maxHp));
                                tempHpFill.style.width = `${tempFillPct * 100}%`;
                            } else if (style === 'layered' && showTempBar && tempHp > 0) {
                                const hpPct = Math.max(0, Math.min(1, token.hp / token.maxHp));
                                const tempPct = Math.max(0, Math.min(1, tempHp / token.maxHp));
                                hpFill.style.width = `${hpPct * 100}%`;
                                
                                tempHpWrapper.style.bottom = '13px';
                                tempHpFill.style.width = `${tempPct * 100}%`;
                            } else {
                                // Stacked or no temp HP
                                const hpPct = Math.max(0, Math.min(1, token.hp / token.maxHp));
                                const tempPct = Math.max(0, Math.min(1, tempHp / token.maxHp));
                                hpFill.style.width = `${hpPct * 100}%`;
                                tempHpFill.style.width = `${tempPct * 100}%`;
                            }
                            
                            if (tempHp > 0 && showTempBar) {
                                tempHpWrapper.style.display = 'block';
                            } else {
                                tempHpWrapper.style.display = 'none';
                            }
                        } else {
                            hpContainer.style.display = 'none';
                            tempHpWrapper.style.display = 'none';
                        }
                        
                        if (showNum || (tempHp > 0 && showTempNum)) {
                            hpText.style.display = 'block';
                            let hpString = '';
                            if (showNum) {
                                hpString += `${token.hp} / ${token.maxHp}`;
                            }
                            if (tempHp > 0 && showTempNum) {
                                if (hpString !== '') hpString += ` `;
                                hpString += `(+${tempHp})`;
                            }
                            if (hpText.textContent !== hpString) {
                                hpText.textContent = hpString;
                            }
                            hpText.style.bottom = '3px';
                            hpText.style.textShadow = '0 0 3px black, 0 0 3px black, 0 0 3px black';
                        } else {
                            hpText.style.display = 'none';
                        }
                    } else {
                        hpContainer.style.display = 'none';
                        hpText.style.display = 'none';
                        tempHpWrapper.style.display = 'none';
                    }
                    
                    // 4. Conditions
                    const condContainer = uiNode.querySelector('.token-condition-container');
                    const hasConditions = token.conditions && token.conditions.length > 0;
                    if (hasConditions) {
                        const CONDITION_ICONS = {
                            'Blinded': 'fa-eye-slash', 'Charmed': 'fa-heart', 'Deafened': 'fa-ear-deaf',
                            'Exhaustion': 'fa-battery-empty', 'Frightened': 'fa-ghost', 'Grappled': 'fa-hand-fist',
                            'Incapacitated': 'fa-ban', 'Invisible': 'fa-mask', 'Paralyzed': 'fa-bolt',
                            'Petrified': 'fa-gem', 'Poisoned': 'fa-skull-crossbones', 'Prone': 'fa-arrow-down',
                            'Restrained': 'fa-link', 'Stunned': 'fa-star', 'Unconscious': 'fa-skull'
                        };
                        const iconsHtml = token.conditions.map(c => {
                            if (c.isCustom) {
                                return `<div title="${c.name}" style="background: ${c.color || 'var(--color-gold-base)'}; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; min-width: 20px; min-height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 4px black; cursor: help; pointer-events: auto;">&nbsp;</div>`;
                            }
                            const iconClass = CONDITION_ICONS[c.name] || 'fa-circle-exclamation';
                            return `<div style="background: rgba(0,0,0,0.8); border: 1px solid var(--color-gold-base); border-radius: 50%; width: 20px; height: 20px; min-width: 20px; min-height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; text-shadow: 1px 1px 2px black; pointer-events: auto;">
                                        <i class="fa-solid ${iconClass}"></i>
                                    </div>`;
                        }).join('');
                        if (condContainer.innerHTML !== iconsHtml) condContainer.innerHTML = iconsHtml;
                        condContainer.style.display = 'flex';
                    } else {
                        condContainer.style.display = 'none';
                    }
                    
                    // 5. Flight
                    const flightContainer = uiNode.querySelector('.token-flight-container');
                    const altitude = token.flightHeight || token.altitude || 0;
                    if (altitude !== 0) {
                        const altSpan = flightContainer.querySelector('.flight-altitude');
                        const altStr = altitude > 0 ? `+${altitude}` : `${altitude}`;
                        if (altSpan && altSpan.textContent !== altStr) altSpan.textContent = altStr;
                        flightContainer.style.display = 'flex';
                    } else {
                        flightContainer.style.display = 'none';
                    }
                } else if (uiNode) {
                    uiNode.style.display = 'none';
                }
            }
            // Draw Resize Handle for Assets
            if (token.isAsset && isTokenSelected && activeTool === 'select' && (vtt.role === 'GM' || tokenLayer !== 'gm')) {
                ctxInteraction.save();
                ctxInteraction.fillStyle = '#ffffff';
                ctxInteraction.strokeStyle = 'var(--color-gold-base)';
                ctxInteraction.lineWidth = 2;
                ctxInteraction.beginPath();
                const { drawW, drawH } = getTokenDrawDimensions(token);
                ctxInteraction.rect(token.x + drawW - 8, token.y + drawH - 8, 16, 16);
                ctxInteraction.fill();
                ctxInteraction.stroke();
                
                // Draw 3 subtle lines for "grip"
                ctxInteraction.beginPath();
                ctxInteraction.strokeStyle = '#aaaaaa';
                ctxInteraction.lineWidth = 1;
                ctxInteraction.moveTo(token.x + drawW - 2, token.y + drawH - 5);
                ctxInteraction.lineTo(token.x + drawW + 5, token.y + drawH + 2);
                ctxInteraction.moveTo(token.x + drawW - 5, token.y + drawH - 2);
                ctxInteraction.stroke();
                ctxInteraction.restore();
            }
        });

        // Render Note Pins
        if ((isGmViewing && activeLayer === 'notes') || vtt.role !== 'GM') {
            notes.forEach(note => {
                const isPlayer = vtt.role !== 'GM';
                if (isPlayer && !note.visibleToPlayers) return;

                const isHovered = hoveredNoteId === note.id;
                const isSelected = selectedNoteId === note.id;
                const r = isHovered ? (isPlayer ? 15 : 17) : (isPlayer ? 12 : 14);
                
                ctxInteraction.save();
                
                // Selection glow ring (GM only)
                if (isSelected && !isPlayer) {
                    ctxInteraction.beginPath();
                    ctxInteraction.arc(note.x, note.y, r + 6, 0, Math.PI * 2);
                    ctxInteraction.strokeStyle = 'rgba(212, 175, 55, 0.9)';
                    ctxInteraction.lineWidth = 2.5;
                    ctxInteraction.stroke();
                }
                
                // Pin circle
                ctxInteraction.beginPath();
                ctxInteraction.arc(note.x, note.y, r, 0, Math.PI * 2);
                
                if (isPlayer) {
                    ctxInteraction.fillStyle = isHovered ? '#5c90ff' : 'rgba(60, 120, 255, 0.85)';
                } else {
                    ctxInteraction.fillStyle = isHovered ? '#d4af37' : 'rgba(212, 175, 55, 0.85)';
                }
                
                ctxInteraction.strokeStyle = '#1a1d27';
                ctxInteraction.lineWidth = 2;
                ctxInteraction.fill();
                ctxInteraction.stroke();
                
                // Pin icon
                ctxInteraction.font = `${r}px serif`;
                ctxInteraction.textAlign = 'center';
                ctxInteraction.textBaseline = 'middle';
                ctxInteraction.fillStyle = '#ffffff';
                ctxInteraction.fillText('📍', note.x, note.y);
                
                // Visibility badge (GM only, if shared)
                if (!isPlayer && note.visibleToPlayers) {
                    ctxInteraction.font = '10px serif';
                    ctxInteraction.fillText('👁', note.x + r - 2, note.y - r + 2);
                }

                // Name label below pin
                ctxInteraction.font = 'bold 11px var(--font-primary, Inter)';
                ctxInteraction.fillStyle = '#ffffff';
                ctxInteraction.shadowColor = 'rgba(0,0,0,0.9)';
                ctxInteraction.shadowBlur = 4;
                ctxInteraction.textAlign = 'center';
                ctxInteraction.textBaseline = 'top';
                ctxInteraction.fillText(note.name || (note.areaId ? `Area ${note.areaId}` : 'Note'), note.x, note.y + r + 4);
                
                ctxInteraction.restore();
            });
        }

        // Render active pings
        if (activePings && activePings.length > 0) {
            const now = Date.now();
            activePings.forEach(p => {
                const elapsed = now - p.startTime;
                if (elapsed >= p.duration) return;
                
                const progress = elapsed / p.duration;
                // Easing out sine wave for smooth expansion
                const easeOut = Math.sin((progress * Math.PI) / 2);
                const radius = 5 + (easeOut * 80);
                const opacity = 1.0 - progress;
                
                ctxInteraction.save();
                const color = p.role === 'GM' ? '255, 60, 60' : '60, 160, 255';
                
                // Outer expanding ring
                ctxInteraction.beginPath();
                ctxInteraction.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctxInteraction.strokeStyle = `rgba(${color}, ${opacity})`;
                ctxInteraction.lineWidth = 4;
                ctxInteraction.stroke();
                
                // Inner static dot
                ctxInteraction.beginPath();
                ctxInteraction.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctxInteraction.fillStyle = `rgba(${color}, ${opacity})`;
                ctxInteraction.fill();
                
                // Username label
                if (p.username) {
                    ctxInteraction.font = 'bold 13px var(--font-primary)';
                    ctxInteraction.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctxInteraction.textAlign = 'center';
                    ctxInteraction.shadowColor = 'rgba(0,0,0,1)';
                    ctxInteraction.shadowBlur = 4;
                    ctxInteraction.fillText(p.username, p.x, p.y - Math.max(radius, 20) - 8);
                }
                ctxInteraction.restore();
            });
        }

        // Cleanup orphaned token overlays for deleted tokens
        const cleanupOverlayLayer = document.getElementById('vtt-html-overlays');
        if (cleanupOverlayLayer) {
            const validTokenIds = new Set(Object.keys(tokens));
            cleanupOverlayLayer.querySelectorAll('[id^="asset_node_"], [id^="token_ui_"]').forEach(node => {
                let tokenId = '';
                if (node.id.startsWith('asset_node_')) tokenId = node.id.substring(11);
                else if (node.id.startsWith('token_ui_')) tokenId = node.id.substring(9);
                if (tokenId && !validTokenIds.has(tokenId)) {
                    node.remove();
                }
            });
        }
    }

    function setMapBackground(url) {
        const bgContainer = document.getElementById('vtt-map-bg-container');
        if (!bgContainer) return;

        if (!url) {
            bgContainer.innerHTML = '';
            bgContainer.classList.add('vtt-hidden');
            bgContainer.removeAttribute('data-natural-width');
            bgContainer.removeAttribute('data-natural-height');
            renderAll();
            return;
        }

        const setBackgroundDimensions = (width, height) => {
            if (!width || !height) return;
            bgContainer.dataset.naturalWidth = String(width);
            bgContainer.dataset.naturalHeight = String(height);
            const w = viewport.clientWidth;
            const h = viewport.clientHeight;
            panX = (w - width) / 2;
            panY = (h - height) / 2;
            zoom = 1.0;
            updateContainerTransform();
            renderAll();
        };

        bgContainer.innerHTML = '';
        bgContainer.classList.remove('vtt-hidden');
        bgContainer.style.pointerEvents = 'none';
        bgContainer.removeAttribute('data-natural-width');
        bgContainer.removeAttribute('data-natural-height');

        if (url.trim().startsWith('<iframe')) {
            bgContainer.innerHTML = url;
            const iframe = bgContainer.querySelector('iframe');
            if (iframe) {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.pointerEvents = 'none';
                iframe.style.border = 'none';
            }
            setTimeout(() => setBackgroundDimensions(1000, 1000), 500);
            return;
        }

        const isVideo = url.match(/\.(mp4|webm|ogg)(\?.*)?$/i);
        const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');

        let mediaEl;

        if (isYoutube) {
            mediaEl = document.createElement('iframe');
            let ytUrl = url;
            const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (ytMatch) {
                const videoId = ytMatch[1];
                ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
            }
            mediaEl.src = ytUrl;
            mediaEl.style.width = '100%';
            mediaEl.style.height = '100%';
            mediaEl.style.border = 'none';
            mediaEl.style.pointerEvents = 'none';
            bgContainer.appendChild(mediaEl);
            setTimeout(() => setBackgroundDimensions(1000, 1000), 500);

        } else if (isVideo) {
            mediaEl = document.createElement('video');
            mediaEl.src = url;
            mediaEl.autoplay = true;
            mediaEl.loop = true;
            mediaEl.muted = true;
            mediaEl.playsInline = true;
            mediaEl.style.width = '100%';
            mediaEl.style.height = '100%';
            mediaEl.style.objectFit = 'fill';
            bgContainer.appendChild(mediaEl);
            mediaEl.play().catch(()=>{});

            mediaEl.onloadedmetadata = () => {
                setBackgroundDimensions(mediaEl.videoWidth, mediaEl.videoHeight);
            };
        } else {
            mediaEl = document.createElement('img');
            mediaEl.src = url;
            mediaEl.draggable = false;
            mediaEl.style.width = '100%';
            mediaEl.style.height = '100%';
            mediaEl.style.objectFit = 'fill';
            bgContainer.appendChild(mediaEl);

            mediaEl.onload = () => {
                setBackgroundDimensions(mediaEl.naturalWidth || mediaEl.width, mediaEl.naturalHeight || mediaEl.height);
            };
        }
    }

    function triggerPingAnimation(x, y, username, role) {
        activePings.push({
            x,
            y,
            username,
            role,
            startTime: Date.now(),
            duration: 3000
        });
        if (!pingAnimFrame) {
            animatePings();
        }
    }

    function animatePings() {
        const now = Date.now();
        activePings = activePings.filter(p => now - p.startTime < p.duration);
        
        renderAll();
        
        if (activePings.length > 0) {
            pingAnimFrame = requestAnimationFrame(animatePings);
        } else {
            pingAnimFrame = null;
        }
    }

    function processTokenAnimReqs(tokensObj, retainReqs = false) {
        let startAnim = false;
        const now = Date.now();
        for (const id in tokensObj) {
            if (tokensObj[id]._animReq) {
                const req = tokensObj[id]._animReq;
                if (now - req.timestamp < 2000) {
                    if (tokenAnimations[id] && tokenAnimations[id].timestamp === req.timestamp) {
                        if (!retainReqs) delete tokensObj[id]._animReq;
                        continue;
                    }
                    let totalDist = 0;
                    let segments = [];
                    const t = tokensObj[id];
                    let adjustedWaypoints = [];
                    if (req.waypoints && req.waypoints.length > 0 && t) {
                        const { drawW, drawH } = getTokenDrawDimensions(t);
                        adjustedWaypoints = req.waypoints.map(wp => ({
                            x: wp.x - drawW / 2,
                            y: wp.y - drawH / 2
                        }));
                    }
                    const points = [{x: req.startX, y: req.startY}, ...adjustedWaypoints, {x: req.endX, y: req.endY}];
                    for (let i = 0; i < points.length - 1; i++) {
                        const dx = points[i+1].x - points[i].x;
                        const dy = points[i+1].y - points[i].y;
                        const dist = Math.hypot(dx, dy);
                        segments.push({ start: points[i], end: points[i+1], dist: dist });
                        totalDist += dist;
                    }
                    tokenAnimations[id] = {
                        ...req,
                        startTime: now,
                        segments,
                        totalDist
                    };
                    tokensObj[id].x = req.startX;
                    tokensObj[id].y = req.startY;
                    startAnim = true;
                }
                if (!retainReqs) {
                    delete tokensObj[id]._animReq;
                }
            }
        }
        if (startAnim && !tokenAnimFrame) {
            tokenAnimFrame = requestAnimationFrame(animateTokens);
        }
    }

    let tokenAnimations = {};
    let tokenAnimFrame = null;

    function animateTokens() {
        let hasActive = false;
        const now = Date.now();
        for (const id in tokenAnimations) {
            const anim = tokenAnimations[id];
            const t = tokens[id];
            if (!t) {
                delete tokenAnimations[id];
                continue;
            }

            const elapsed = now - anim.startTime;
            const progress = Math.min(elapsed / anim.duration, 1);
            
            if (anim.totalDist === 0) {
                t.x = anim.endX;
                t.y = anim.endY;
                delete tokenAnimations[id];
                continue;
            }

            const targetDist = progress * anim.totalDist;
            let currentDist = 0;
            let currentPos = {x: anim.endX, y: anim.endY};

            for (let i = 0; i < anim.segments.length; i++) {
                const seg = anim.segments[i];
                if (currentDist + seg.dist >= targetDist) {
                    const segProgress = seg.dist === 0 ? 1 : (targetDist - currentDist) / seg.dist;
                    currentPos = {
                        x: seg.start.x + (seg.end.x - seg.start.x) * segProgress,
                        y: seg.start.y + (seg.end.y - seg.start.y) * segProgress
                    };
                    break;
                }
                currentDist += seg.dist;
            }

            t.x = currentPos.x;
            t.y = currentPos.y;

            if (progress >= 1) {
                t.x = anim.endX;
                t.y = anim.endY;
                delete tokenAnimations[id];
            } else {
                hasActive = true;
            }
        }

        if (hasActive) {
            renderAll();
            tokenAnimFrame = requestAnimationFrame(animateTokens);
        } else {
            tokenAnimFrame = null;
            renderAll();
        }
    }

    let visualFxAnimFrame = null;

    function animateVisualFx() {
        const overlayContainer = document.getElementById('vtt-html-overlays');
        if (!overlayContainer) {
            visualFxAnimFrame = requestAnimationFrame(animateVisualFx);
            return;
        }

        let glowNode = document.getElementById('vtt-active-initiative-glow');
        
        let activeToken = null;
        if (vtt.campaignState && vtt.campaignState.initiative && vtt.campaignState.initiative.combatants) {
            const combatants = vtt.campaignState.initiative.combatants;
            const activeIdx = vtt.campaignState.initiative.activeTurnIndex;
            if (activeIdx >= 0 && activeIdx < combatants.length) {
                const tokenId = combatants[activeIdx].tokenId;
                if (tokenId && tokens[tokenId]) {
                    activeToken = tokens[tokenId];
                }
            }
        }

        if (activeToken && (activeToken.layer === activeLayer || vtt.role === 'GM')) {
            if (!glowNode) {
                glowNode = document.createElement('div');
                glowNode.id = 'vtt-active-initiative-glow';
                glowNode.style.position = 'absolute';
                glowNode.style.pointerEvents = 'none';
                glowNode.style.zIndex = '-1'; // Ensure it renders below ALL tokens
                overlayContainer.appendChild(glowNode);
            }
            
            const { drawW, drawH } = getTokenDrawDimensions(activeToken);
            
            // Sync geometry with the active token
            glowNode.style.left = `${activeToken.x}px`;
            glowNode.style.top = `${activeToken.y}px`;
            glowNode.style.width = `${drawW}px`;
            glowNode.style.height = `${drawH}px`;
            
            if (!activeToken.isAsset) {
                glowNode.style.borderRadius = '50%';
            } else {
                glowNode.style.borderRadius = '0';
            }

            const turnStartTime = vtt.campaignState.initiative.lastTurnStartTime || Date.now();
            const elapsed = Math.max(0, Date.now() - turnStartTime);
            const progress = Math.min(elapsed / 30000, 1.0);
            const freq = 0.5 + 2.5 * progress;
            let pulse = (Math.sin(elapsed * 0.001 * Math.PI * 2 * freq) + 1) / 2;
            if (elapsed >= 30000) pulse = 1.0;
            
            let colorStr = '220, 53, 69'; // Default Red for Enemies
            if (activeToken.isPlayer) {
                colorStr = '32, 138, 255'; // Blue for Player
            }
            if (vtt.campaignState && vtt.campaignState.characters && activeToken.characterId) {
                const char = vtt.campaignState.characters[activeToken.characterId];
                if (char) {
                    if (char.isCompanion) {
                        colorStr = '40, 167, 69'; // Green for Companions
                    } else if (char.isPlayer && !char.isCustomNpc) {
                        colorStr = '32, 138, 255'; // Blue for Player
                    }
                }
            }

            const glowAlpha = 0.3 + 0.6 * pulse;
            const glowBlur = 10 + 20 * pulse;
            const glowSpread = 4 + 8 * pulse;
            
            glowNode.style.boxShadow = `0 0 ${glowBlur}px ${glowSpread}px rgba(${colorStr}, ${glowAlpha})`;
            glowNode.style.backgroundColor = `rgba(${colorStr}, ${glowAlpha * 0.5})`; // Inner fill for a solid glow core
        } else {
            if (glowNode) {
                glowNode.remove();
            }
        }
        
        visualFxAnimFrame = requestAnimationFrame(animateVisualFx);
    }

    
window.emitTokenUpdates = function(currentTokens) {
    if (!vtt.socket || !currentMapId) return;
    
    // Find deletes
    for (const id in lastBroadcastedTokens) {
        if (!currentTokens[id]) {
            vtt.socket.emit('token:delete', { mapId: currentMapId, tokenId: id });
        }
    }
    
    // Find adds and updates
    for (const id in currentTokens) {
        if (!lastBroadcastedTokens[id]) {
            vtt.socket.emit('token:add', { mapId: currentMapId, tokenId: id, token: currentTokens[id] });
        } else {
            // Delta check
            const oldToken = lastBroadcastedTokens[id];
            const newToken = currentTokens[id];
            const changes = {};
            let hasChanges = false;
            
            // Check for added or modified properties
            for (const key in newToken) {
                if (JSON.stringify(newToken[key]) !== JSON.stringify(oldToken[key])) {
                    changes[key] = newToken[key];
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
                vtt.socket.emit('token:update_delta', { mapId: currentMapId, tokenId: id, changes });
            }
        }
    }
    
    // Update snapshot
    lastBroadcastedTokens = JSON.parse(JSON.stringify(currentTokens));
};


    function setupSocketSync() {
        const socket = vtt.socket;
        
        socket.on('campaign:state-sync', (camp) => {
            console.log('[campaign:state-sync] received, maps count:', camp?.maps ? Object.keys(camp.maps).length : 0, 'activeGMMapId:', camp?.activeGMMapId);
            vtt.campaignState = camp;
            const targetMapId = (vtt.role === 'GM') ? (camp.activeGMMapId || camp.activeMapId) : (camp.playerMapOverrides?.[vtt.username] || camp.activeMapId);
            loadMap(targetMapId);
            // Refresh map manager grid if it is open — use rAF so DOM state from
            // loadMap() has fully settled before re-drawing the card list.
            const mapModal = document.getElementById('modal-upload-map');
            const isModalOpen = mapModal && !mapModal.classList.contains('vtt-hidden');
            console.log('[campaign:state-sync] modal open?', isModalOpen);
            if (isModalOpen) {
                requestAnimationFrame(() => renderMapGrid());
            }
        });

        socket.on('token:updated', (data) => {
            if (data.origin === vtt.socket.id) return;
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].tokens = data.tokens;
            }
            if (data.mapId === currentMapId) {
                tokens = data.tokens;
                lastBroadcastedTokens = JSON.parse(JSON.stringify(tokens));
                processTokenAnimReqs(tokens);
                renderAll();
                if (window.VTT?.chatEngine?.refreshInitiative) window.VTT.chatEngine.refreshInitiative();
            }
        });

        socket.on('token:added', (data) => {
            if (data.origin === vtt.socket.id) return;
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].tokens[data.tokenId] = data.token;
            }
            if (data.mapId === currentMapId) {
                tokens[data.tokenId] = data.token;
                lastBroadcastedTokens[data.tokenId] = JSON.parse(JSON.stringify(data.token));
                renderAll();
                if (window.VTT?.chatEngine?.refreshInitiative) window.VTT.chatEngine.refreshInitiative();
            }
        });

        socket.on('token:updated_delta', (data) => {
            if (data.origin === vtt.socket.id) return;
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                const mapTokens = vtt.campaignState.maps[data.mapId].tokens;
                if (mapTokens[data.tokenId]) Object.assign(mapTokens[data.tokenId], data.changes);
            }
            if (data.mapId === currentMapId) {
                if (tokens[data.tokenId]) {
                    Object.assign(tokens[data.tokenId], data.changes);
                    lastBroadcastedTokens[data.tokenId] = JSON.parse(JSON.stringify(tokens[data.tokenId]));
                    renderAll();
                    if (window.VTT?.chatEngine?.refreshInitiative) window.VTT.chatEngine.refreshInitiative();
                }
            }
        });

        socket.on('token:deleted', (data) => {
            if (data.origin === vtt.socket.id) return;
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                delete vtt.campaignState.maps[data.mapId].tokens[data.tokenId];
            }
            if (data.mapId === currentMapId) {
                delete tokens[data.tokenId];
                delete lastBroadcastedTokens[data.tokenId];
                renderAll();
                if (window.VTT?.chatEngine?.refreshInitiative) window.VTT.chatEngine.refreshInitiative();
            }
        });

        socket.on('grid:updated', (data) => {
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].grid = data.grid;
            }
            if (data.mapId === currentMapId) {
                grid = data.grid;
                syncGridConfigInputs();
                renderAll();
            }
        });

        socket.on('map:updated', (data) => {
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].mapImage = data.mapImage;
            }
            if (data.mapId === currentMapId) {
                setMapBackground(data.mapImage);
                renderAll();
            }
        });

        socket.on('walls:updated', (data) => {
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].walls = data.walls;
            }
            if (data.mapId === currentMapId) {
                walls = data.walls;
                renderAll();
            }
        });

        socket.on('lights:updated', (data) => {
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].lights = data.lights;
            }
            if (data.mapId === currentMapId) {
                lights = data.lights;
                renderAll();
            }
        });

        socket.on('notes:updated', (data) => {
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].notes = data.notes;
            }
            if (data.mapId === currentMapId) {
                notes = data.notes || [];
                renderAll();
            }
        });

        socket.on('map:pinged', (data) => {
            triggerPingAnimation(data.x, data.y, data.username, data.role);
        });

        socket.on('map:pannedTo', (data) => {
            panX = (viewport.clientWidth / 2) - (data.x * zoom);
            panY = (viewport.clientHeight / 2) - (data.y * zoom);
            updateContainerTransform();
            renderAll();
        });

        socket.on('measure:updated', (data) => {
            otherMeasurements[data.socketId] = data;
            renderAll();
        });

        socket.on('measure:cleared', (data) => {
            delete otherMeasurements[data.socketId];
            renderAll();
        });

        socket.on('shapes:updated', (data) => {
            if (vtt.campaignState && vtt.campaignState.maps && vtt.campaignState.maps[data.mapId]) {
                vtt.campaignState.maps[data.mapId].shapes = data.shapes;
            }
            if (data.mapId === currentMapId) {
                shapes = data.shapes;
                renderAll();
            }
        });

        socket.on('settings:updated', (data) => {
            campaignSettings = data.settings;
            syncHpSettingsInputs();
            renderAll();
        });

        // ── Live HP sync: refresh token bars when a character sheet HP changes ──
        socket.on('character:updated', (data) => {
            if (!data.character) return;
            const char = data.character;

            // Update campaign state
            if (vtt.campaignState) {
                if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
                vtt.campaignState.characters[char.id] = char;
            }

            // Push HP to any linked tokens on the current map
            let changed = false;
            Object.values(tokens).forEach(token => {
                if (token.characterId === char.id) {
                    token.hp     = char.hpCurrent ?? char.hp ?? token.hp;
                    token.maxHp  = char.hpMax     ?? token.maxHp;
                    token.tempHp = char.tempHp    ?? 0;

                    // Update token image
                    if (char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex !== -1) {
                        const idx = char.activeTokenIndex || 0;
                        if (idx >= 0 && idx < char.tokenImages.length) {
                            token.img = char.tokenImages[idx].url;
                        }
                    } else if (char.monsterData && char.monsterData.hasToken) {
                        const cleanName = typeof Parser !== 'undefined' ? Parser.nameToTokenName(char.monsterData.name) : char.monsterData.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '_');
                        token.img = `img/bestiary/tokens/${char.monsterData.source}/${cleanName}.webp`;
                    } else if (!char.monsterData && (!char.tokenImages || char.tokenImages.length === 0)) {
                        token.img = 'favicon.svg';
                    }

                    if (token.img && typeof token.img === 'string') {
                        const lower = token.img.toLowerCase();
                        const _c = lower.split('?')[0];
                        token.isVideo = _c.endsWith('.gif') || _c.endsWith('.mp4') || _c.endsWith('.webm') || lower.includes('youtube.com');
                    }
                    
                    changed = true;
                }
            });
            if (changed) renderAll();
        });
    }

    // Grid Panel UI alignment controllers
    function syncGridConfigInputs() {
        // Obsolete: Grid config moved to Edit Map modal
    }

    function renderMapGrid() {
        const container = document.getElementById('maps-list-container');
        if (!container || !vtt.campaignState || !vtt.campaignState.maps) {
            console.warn('[renderMapGrid] early return - container:', !!container, 'campaignState:', !!vtt.campaignState, 'maps:', !!(vtt.campaignState && vtt.campaignState.maps));
            return;
        }
        
        container.innerHTML = '';
        const camp = vtt.campaignState;
        const mapEntries = Object.values(camp.maps);
        console.log('[renderMapGrid] rendering', mapEntries.length, 'maps, currentMapId:', currentMapId);
        if (mapEntries.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; color: var(--color-text-muted); font-size: 0.85rem; gap: 12px; opacity: 0.6;">
                    <i class="fa-solid fa-map" style="font-size: 2.5rem; color: var(--color-gold-base); opacity: 0.4;"></i>
                    <span>No maps yet. Click <strong>+ Create New Map</strong> to get started.</span>
                </div>
            `;
            return;
        }
        
        mapEntries.forEach(map => {
            const camp = vtt.campaignState;
            const isGlobalActive = camp.activeMapId === map.id;
            const playersOnMap = Object.entries(camp.playerMapOverrides || {}).filter(([p, mId]) => mId === map.id).map(([p]) => p);
            const isPlayerActive = isGlobalActive || playersOnMap.length > 0;
            let activeText = "Live";
            let activeClass = "var(--color-success-base)";
            if (playersOnMap.length > 0 && !isGlobalActive) {
                activeText = playersOnMap.length === 1 ? `Live (${playersOnMap[0]})` : `Live (${playersOnMap.length} Players)`;
                activeClass = "var(--color-blue-base)";
            } else if (isGlobalActive && Object.keys(camp.playerMapOverrides || {}).length > 0) {
                activeText = `Live (Global - Overrides Active)`;
                activeClass = "var(--color-orange-base)";
            }

            const isGmViewing = currentMapId === map.id;
            
            const card = document.createElement('div');
            card.className = 'glassmorphism map-card';
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.border = isGmViewing ? '1px solid var(--color-gold-base)' : '1px solid var(--color-border-subtle)';
            card.style.borderRadius = '10px';
            card.style.overflow = 'hidden';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.position = 'relative';
            card.style.transition = 'var(--transition-smooth)';
            
            // Image preview
            const thumbUrl = map.mapImage || '';
            const hasThumb = !!thumbUrl;
            
            card.innerHTML = `
                <div class="map-card-thumb" style="height: 120px; width: 100%; background: ${hasThumb ? `url('${thumbUrl}') center/cover no-repeat` : 'radial-gradient(circle, rgba(13,15,22,1) 0%, rgba(26,30,43,1) 100%)'}; position: relative; border-bottom: 1px solid var(--color-border-subtle); display: flex; align-items: center; justify-content: center;">
                    ${!hasThumb ? '<i class="fa-solid fa-grip-both" style="font-size: 2rem; color: rgba(212,175,55,0.15)"></i>' : ''}
                    <div style="position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 5;">
                        ${isPlayerActive ? `<span style="font-size: 0.65rem; background: ${activeClass}; color: #fff; padding: 2px 8px; border-radius: 20px; font-weight: bold; box-shadow: var(--shadow-premium);"><i class="fa-solid fa-users"></i> ${activeText}</span>` : ''}
                        ${isGmViewing ? '<span style="font-size: 0.65rem; background: var(--color-gold-base); color: #111; padding: 2px 8px; border-radius: 20px; font-weight: bold; box-shadow: var(--shadow-premium);"><i class="fa-solid fa-eye"></i> Viewing</span>' : ''}
                    </div>
                </div>
                
                <div class="map-card-body" style="padding: 12px; display: flex; flex-direction: column; gap: 8px; flex: 1;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="map-name-txt" style="font-family: var(--font-heading); font-weight: 600; font-size: 0.9rem; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">${map.name}</span>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn-edit-map btn btn-secondary btn-xxs" title="Edit Map" style="padding: 3px 6px;"><i class="fa-solid fa-pen"></i></button>
                            ${!isPlayerActive ? `<button class="btn-delete-map btn btn-danger btn-xxs" title="Delete Map" style="padding: 3px 6px;"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 8px;">
                        ${!isGmViewing ? `
                            <button class="btn-view-map btn btn-secondary btn-xs" style="width: 100%; justify-content: center; font-size: 0.75rem;">
                                <i class="fa-solid fa-eye"></i> Secret Preview
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-xs" disabled style="width: 100%; justify-content: center; font-size: 0.75rem; opacity: 0.5;">
                                <i class="fa-solid fa-check"></i> Currently Viewing
                            </button>
                        `}
                        
                        ${!isPlayerActive ? `
                            <button class="btn-activate-map btn btn-primary btn-xs" style="width: 100%; justify-content: center; font-size: 0.75rem;">
                                <i class="fa-solid fa-bullhorn"></i> Push Players Here
                            </button>
                        ` : `
                            <button class="btn-activate-map btn btn-primary btn-xs" style="width: 100%; justify-content: center; font-size: 0.75rem; background: ${activeClass}; color: #fff; border-color: transparent;">
                                <i class="fa-solid fa-users"></i> Push More Players
                            </button>
                        `}
                    </div>
                </div>
            `;
            
            container.appendChild(card);
            
            // Actions
            card.querySelector('.btn-edit-map').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditMapModal(map);
            });
            
            const btnDel = card.querySelector('.btn-delete-map');
            if (btnDel) {
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you absolutely sure you want to delete map "${map.name}"? This action is permanent.`)) {
                        vtt.socket.emit('map:delete', { mapId: map.id });
                    }
                });
            }
            
            const btnView = card.querySelector('.btn-view-map');
            if (btnView) {
                btnView.addEventListener('click', () => {
                    vtt.socket.emit('map:switch-gm', { mapId: map.id });
                    loadMap(map.id);
                    renderMapGrid(); // refresh status highlights
                });
            }
            
            const btnAct = card.querySelector('.btn-activate-map');
            if (btnAct) {
                btnAct.addEventListener('click', () => {
                    openPushPlayersModal(map.id);
                });
            }
        });
    }

    let editingMapId = null;

    function setupEditMapModal() {
        const modal = document.getElementById('modal-edit-map');
        if (!modal) return;
        
        document.getElementById('btn-edit-map-close').addEventListener('click', () => {
            modal.classList.add('vtt-hidden');
            editingMapId = null;
        });

        const updateMapField = (field, type) => {
            const val = document.getElementById(`edit-map-${field}`).value;
            const finalVal = type === 'number' ? (val === '' ? null : Number(val)) : val;
            
            const map = vtt.campaignState.maps[editingMapId];
            let delta = {};
            
            if (field.startsWith('grid-size') || field.startsWith('grid-type') || field.startsWith('offset-')) {
                if (!map.grid) map.grid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5, type: 'square' };
                if (field === 'grid-size') map.grid.size = finalVal || 50;
                if (field === 'grid-type') map.grid.type = finalVal || 'square';
                if (field === 'offset-x') map.grid.offsetX = finalVal || 0;
                if (field === 'offset-y') map.grid.offsetY = finalVal || 0;
                delta = { grid: map.grid };
            } else if (field === 'name') {
                map.name = finalVal;
                delta = { name: finalVal };
            } else if (field === 'url') {
                if (finalVal && (finalVal.startsWith('http://') || finalVal.startsWith('https://'))) {
                    fetch('/api/player-token/url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: finalVal })
                    }).then(res => res.json()).then(data => {
                        if (data.url) {
                            map.mapImage = data.url;
                            if (currentMapId === editingMapId) {
                                setMapBackground(data.url);
                                renderAll();
                            }
                            vtt.socket.emit('map:edit', { mapId: editingMapId, updates: { mapImage: data.url } });
                        }
                    });
                    return;
                }
                map.mapImage = finalVal;
                delta = { mapImage: finalVal };
                if (currentMapId === editingMapId) setMapBackground(finalVal);
            } else if (field === 'grid-width') {
                map.gridWidth = finalVal;
                delta = { gridWidth: finalVal };
            } else if (field === 'grid-height') {
                map.gridHeight = finalVal;
                delta = { gridHeight: finalVal };
            }

            if (currentMapId === editingMapId) {
                if (map.grid) grid = Object.assign({}, map.grid);
                renderAll();
            } else {
                renderMapGrid();
            }
            
            vtt.socket.emit('map:edit', { mapId: editingMapId, updates: delta });
        };

        const inputs = ['name', 'url', 'grid-width', 'grid-height', 'grid-type', 'grid-size', 'offset-x', 'offset-y'];
        inputs.forEach(f => {
            const el = document.getElementById(`edit-map-${f}`);
            if(el) {
                if (f === 'url' || f === 'grid-type') {
                    el.addEventListener('change', () => updateMapField(f, 'string'));
                } else {
                    el.addEventListener('input', () => updateMapField(f, f.startsWith('grid-') || f.startsWith('offset-') ? 'number' : 'string'));
                }
            }
        });

        const gridOpacityEl = document.getElementById('edit-map-grid-opacity');
        if (gridOpacityEl) gridOpacityEl.addEventListener('input', () => {
            if (!editingMapId || !vtt.campaignState.maps[editingMapId]) return;
            const map = vtt.campaignState.maps[editingMapId];
            if (!map.grid) map.grid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
            map.grid.color = document.getElementById('edit-map-grid-color').value;
            map.grid.opacity = gridOpacityEl.value;
            vtt.socket.emit('map:edit', { mapId: editingMapId, updates: { grid: map.grid } });
            if (currentMapId === editingMapId) { grid = Object.assign({}, map.grid); renderAll(); }
        });
        
        const gridColorEl = document.getElementById('edit-map-grid-color');
        if (gridColorEl) gridColorEl.addEventListener('input', () => {
            if (!editingMapId || !vtt.campaignState.maps[editingMapId]) return;
            const map = vtt.campaignState.maps[editingMapId];
            if (!map.grid) map.grid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
            map.grid.color = gridColorEl.value;
            map.grid.opacity = document.getElementById('edit-map-grid-opacity').value;
            vtt.socket.emit('map:edit', { mapId: editingMapId, updates: { grid: map.grid } });
            if (currentMapId === editingMapId) { grid = Object.assign({}, map.grid); renderAll(); }
        });

        const lightingInputs = ['daylight-mode', 'restrict-movement', 'update-on-drop'];
        lightingInputs.forEach(f => {
            const el = document.getElementById(`edit-map-${f}`);
            if (el) el.addEventListener('change', () => {
                if (!editingMapId || !vtt.campaignState.maps[editingMapId]) return;
                const map = vtt.campaignState.maps[editingMapId];
                if (!map.lightingSettings) map.lightingSettings = { daylightMode: false, restrictMovement: false, updateOnDrop: true };
                if (f === 'daylight-mode') map.lightingSettings.daylightMode = el.checked;
                if (f === 'restrict-movement') map.lightingSettings.restrictMovement = el.checked;
                if (f === 'update-on-drop') map.lightingSettings.updateOnDrop = el.checked;
                vtt.socket.emit('map:edit', { mapId: editingMapId, updates: { lightingSettings: map.lightingSettings } });
                if (currentMapId === editingMapId) renderAll();
            });
        });
    }

    function openEditMapModal(map) {
        editingMapId = map.id;
        document.getElementById('edit-map-name').value = map.name || '';
        document.getElementById('edit-map-url').value = map.mapImage || '';
        document.getElementById('edit-map-grid-width').value = map.gridWidth || '';
        document.getElementById('edit-map-grid-height').value = map.gridHeight || '';
        
        const g = map.grid || { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5, type: 'square' };
        document.getElementById('edit-map-grid-type').value = g.type || 'square';
        document.getElementById('edit-map-grid-size').value = g.size || 50;
        document.getElementById('edit-map-offset-x').value = g.offsetX || 0;
        document.getElementById('edit-map-offset-y').value = g.offsetY || 0;
        document.getElementById('edit-map-grid-color').value = g.color || '#888888';
        document.getElementById('edit-map-grid-opacity').value = g.opacity || 0.3;
        
        const ls = map.lightingSettings || { daylightMode: false, restrictMovement: false, updateOnDrop: true };
        document.getElementById('edit-map-daylight-mode').checked = !!ls.daylightMode;
        document.getElementById('edit-map-restrict-movement').checked = !!ls.restrictMovement;
        document.getElementById('edit-map-update-on-drop').checked = ls.updateOnDrop !== false;
        
        document.getElementById('modal-edit-map').classList.remove('vtt-hidden');
    }

    // Modal background change logic
    function setupMapUploadControls() {
        const btnChangeMap = document.getElementById('btn-change-map');
        const modal = document.getElementById('modal-upload-map');
        const cancel = document.getElementById('btn-map-modal-cancel');

        const mapSelect = document.getElementById('map-select-source');
        const uploadPanel = document.getElementById('map-upload-panel');
        const urlPanel = document.getElementById('map-url-panel');
        
        const fileInput = document.getElementById('map-file-input');
        const fileNameSpan = document.getElementById('map-file-name');
        const urlInput = document.getElementById('map-url-input');
        
        // 5eTools specific elements
        const toolsPanel = document.getElementById('map-5etools-panel');
        const advSelect = document.getElementById('map-5etools-adventure');
        const mapDropdown = document.getElementById('map-5etools-map');

        // Create Panel toggles
        const btnOpenImport = document.getElementById('btn-map-modal-open-import');
        const btnOpenCreate = document.getElementById('btn-map-modal-open-create');
        const createPanel = document.getElementById('map-create-panel');
        const btnCreateCancel = document.getElementById('btn-map-create-cancel');
        const btnCreateSubmit = document.getElementById('btn-map-create-submit');
        const btnBulkImport = document.getElementById('btn-map-bulk-import');
        const newMapNameInput = document.getElementById('new-map-name');

        if (btnChangeMap) {
            btnChangeMap.addEventListener('click', () => {
                if (modal) modal.classList.remove('vtt-hidden');
                if (createPanel) createPanel.classList.add('vtt-hidden'); // hide creation panel on open
                renderMapGrid();
            });
        }
        
        if (cancel) cancel.addEventListener('click', () => { if (modal) modal.classList.add('vtt-hidden'); });

        if (btnOpenImport) {
            btnOpenImport.addEventListener('click', () => {
                if (createPanel) createPanel.classList.remove('vtt-hidden');
                if (newMapNameInput) newMapNameInput.value = '';
                if (urlInput) urlInput.value = '';
                if (fileInput) fileInput.value = '';
                if (fileNameSpan) fileNameSpan.textContent = 'No file selected.';
                
                // Directly switch to 5eTools import view
                if (mapSelect) mapSelect.value = '5etools';
                if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                if (urlPanel) urlPanel.classList.add('vtt-hidden');
                if (toolsPanel) {
                    toolsPanel.classList.remove('vtt-hidden');
                    if (window.VTT?.dataBridge?.load5eToolsMapCatalog) {
                        window.VTT.dataBridge.load5eToolsMapCatalog(advSelect, mapDropdown);
                    }
                }
                
                const modalContent = document.querySelector('#modal-upload-map .modal-content');
                if (modalContent) setTimeout(() => modalContent.scrollTop = 0, 50);
            });
        }

        if (btnOpenCreate) {
            btnOpenCreate.addEventListener('click', () => {
                if (createPanel) createPanel.classList.remove('vtt-hidden');
                if (newMapNameInput) newMapNameInput.value = '';
                if (urlInput) urlInput.value = '';
                if (fileInput) fileInput.value = '';
                if (fileNameSpan) fileNameSpan.textContent = 'No file selected.';
                // Reset source selector to 'blank' (safest default — no file needed)
                if (mapSelect) mapSelect.value = 'blank';
                if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                if (urlPanel) urlPanel.classList.add('vtt-hidden');
                if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
                
                // Scroll the modal-content down to show the create panel
                const modalContent = document.querySelector('#modal-upload-map .modal-content');
                if (modalContent) setTimeout(() => modalContent.scrollTop = 0, 50);
            });
        }

        if (btnCreateCancel) btnCreateCancel.addEventListener('click', () => { if (createPanel) createPanel.classList.add('vtt-hidden'); });

        if (advSelect) {
            advSelect.addEventListener('change', () => {
                setTimeout(() => {
                    if (advSelect.value && mapDropdown && mapDropdown.options.length > 1) {
                        if (btnBulkImport) btnBulkImport.disabled = false;
                    } else {
                        if (btnBulkImport) btnBulkImport.disabled = true;
                    }
                }, 100);
            });
        }

        if (btnBulkImport) {
            btnBulkImport.addEventListener('click', async () => {
                const advId = advSelect ? advSelect.value : null;
                if (!advId) return;

                const mapOptions = mapDropdown ? Array.from(mapDropdown.options).filter(opt => opt.value) : [];
                if (mapOptions.length === 0) return alert("No maps found for this adventure.");

                if (!confirm(`This adventure has ${mapOptions.length} maps. Are you sure you want to bulk import all of them? This may take a minute.`)) {
                    return;
                }

                btnBulkImport.disabled = true;
                if (btnCreateSubmit) btnCreateSubmit.disabled = true;
                const originalText = btnBulkImport.innerHTML;

                for (let i = 0; i < mapOptions.length; i++) {
                    const mapId = mapOptions[i].value;
                    const mapName = mapOptions[i].textContent;

                    btnBulkImport.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Importing ${i + 1}/${mapOptions.length}...`;
                    
                    try {
                        if (window.VTT?.dataBridge?.import5etoolsMap) {
                            const importedMap = await window.VTT.dataBridge.import5etoolsMap(advId, mapId);
                            if (importedMap) {
                                importedMap.name = mapName;
                                console.log(`[bulk-import] Emitting map:create for ${mapName}...`);
                                vtt.socket.emit('map:create', importedMap);
                            }
                        }
                    } catch (e) {
                        console.error(`Error importing map ${mapName}:`, e);
                    }

                    // Delay to prevent server overload
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                btnBulkImport.innerHTML = originalText;
                btnBulkImport.disabled = false;
                if (btnCreateSubmit) btnCreateSubmit.disabled = false;
                
                if (createPanel) createPanel.classList.add('vtt-hidden');
                renderMapGrid();
            });
        }

        if (mapSelect) {
            mapSelect.addEventListener('change', () => {
                if (mapSelect.value === 'upload') {
                    if (uploadPanel) uploadPanel.classList.remove('vtt-hidden');
                    if (urlPanel) urlPanel.classList.add('vtt-hidden');
                    if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
                } else if (mapSelect.value === 'url') {
                    if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                    if (urlPanel) urlPanel.classList.remove('vtt-hidden');
                    if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
                } else if (mapSelect.value === '5etools') {
                    if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                    if (urlPanel) urlPanel.classList.add('vtt-hidden');
                    if (toolsPanel) {
                        toolsPanel.classList.remove('vtt-hidden');
                        if (window.VTT?.dataBridge?.load5eToolsMapCatalog) {
                            window.VTT.dataBridge.load5eToolsMapCatalog(advSelect, mapDropdown);
                        }
                    }
                } else {
                    // blank
                    if (uploadPanel) uploadPanel.classList.add('vtt-hidden');
                    if (urlPanel) urlPanel.classList.add('vtt-hidden');
                    if (toolsPanel) toolsPanel.classList.add('vtt-hidden');
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0 && fileNameSpan) {
                    fileNameSpan.textContent = fileInput.files[0].name;
                }
            });
        }

        if (btnCreateSubmit) {
            btnCreateSubmit.addEventListener('click', async () => {
            const name = newMapNameInput.value.trim();
            console.log('[map:create] Submit clicked, name:', name, 'source:', mapSelect.value);
            if (!name) return alert("Please enter a map name");

            if (mapSelect.value === 'blank') {
                console.log('[map:create] Emitting map:create for blank map...');
                vtt.socket.emit('map:create', { name, mapImage: "" });
                createPanel.classList.add('vtt-hidden');
                // Optimistic placeholder render (server will follow with state-sync)
                renderMapGrid();
            } else if (mapSelect.value === 'url') {
                const url = urlInput.value.trim();
                if (!url) return alert("Please enter image URL");
                
                console.log('[map:create] Emitting map:create for URL map...');
                vtt.socket.emit('map:create', { name, mapImage: url });
                createPanel.classList.add('vtt-hidden');
                renderMapGrid();
            } else if (mapSelect.value === '5etools') {
                const advId = advSelect.value;
                const mapId = mapDropdown.value;
                if(!advId || !mapId) return alert("Please select an adventure and a map to import.");
                
                if(window.VTT && window.VTT.dataBridge && window.VTT.dataBridge.import5etoolsMap) {
                    const importedMap = await window.VTT.dataBridge.import5etoolsMap(advId, mapId);
                    if(importedMap) {
                        importedMap.name = name; // Override with user's name
                        console.log('[map:create] Emitting map:create for 5etools map...', importedMap);
                        vtt.socket.emit('map:create', importedMap);
                        createPanel.classList.add('vtt-hidden');
                        renderMapGrid();
                    } else {
                        alert("Error parsing the selected map.");
                    }
                }
            } else {
                // File upload via REST api
                if (fileInput.files.length === 0) return alert("Select a file first");
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('image', file);

                try {
                    btnCreateSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        vtt.socket.emit('map:create', { name, mapImage: data.url });
                        createPanel.classList.add('vtt-hidden');
                        renderMapGrid();
                    } else {
                        alert("Upload failed.");
                    }
                } catch(e) {
                    alert("Error: " + e.message);
                } finally {
                    btnCreateSubmit.innerHTML = 'Create Map';
                }
            }
        });
        }

        // Banner Push button listener
        const bannerPushBtn = document.getElementById('btn-banner-push-players');
        if (bannerPushBtn) {
            bannerPushBtn.addEventListener('click', () => {
                if (currentMapId) {
                    openPushPlayersModal(currentMapId);
                }
            });
        }
    }

    let mapToPushId = null;
    function setupPushPlayersModal() {
        const modal = document.getElementById('modal-push-players');
        if (!modal) return;
        
        document.getElementById('btn-push-players-cancel').addEventListener('click', () => {
            modal.classList.add('vtt-hidden');
            mapToPushId = null;
        });

        document.getElementById('push-players-all').addEventListener('change', (e) => {
            const list = document.getElementById('push-players-list');
            const checkboxes = list.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });

        const list = document.getElementById('push-players-list');
        if (list) {
            list.addEventListener('change', () => {
                const checkboxes = list.querySelectorAll('input[type="checkbox"]');
                const checked = list.querySelectorAll('input[type="checkbox"]:checked');
                document.getElementById('push-players-all').checked = (checkboxes.length > 0 && checkboxes.length === checked.length);
            });
        }
        
        document.getElementById('btn-push-players-confirm').addEventListener('click', () => {
            if (!mapToPushId) return;
            const isAll = document.getElementById('push-players-all').checked;
            
            let targetPlayers = 'all';
            if (!isAll) {
                const list = document.getElementById('push-players-list');
                const checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
                targetPlayers = Array.from(checkboxes).map(cb => cb.value);
            }
            
            vtt.socket.emit('map:activate-players', { mapId: mapToPushId, targetPlayers });
            modal.classList.add('vtt-hidden');
            mapToPushId = null;
        });
    }

    function openPushPlayersModal(mapId) {
        mapToPushId = mapId;
        const modal = document.getElementById('modal-push-players');
        const list = document.getElementById('push-players-list');
        const camp = vtt.campaignState;
        
        // Populate player list
        const knownPlayers = camp.knownPlayers || [];
        const allowedUsers = camp.allowedUsers || [];
        const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];
        
        list.innerHTML = '';
        allPotentialPlayers.forEach(p => {
            const currentMapId = camp.playerMapOverrides?.[p] || camp.activeMapId;
            const isAlreadyHere = currentMapId === mapId;
            const div = document.createElement('label');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';
            div.style.cursor = 'pointer';
            div.style.padding = '4px 8px';
            
            div.innerHTML = `<input type="checkbox" value="${p}" checked> ${p} ${isAlreadyHere ? '<span style="font-size:0.7rem; color:var(--color-text-muted);">(Already Here)</span>' : ''}`;
            list.appendChild(div);
        });
        
        if (allPotentialPlayers.length === 0) {
            list.innerHTML = '<div style="color:var(--color-text-muted); padding: 8px;">No players available.</div>';
        }
        
        document.getElementById('push-players-all').checked = true;
        
        modal.classList.remove('vtt-hidden');
    }

    let selectedTokenIdForEdit = null;
    let tempAurasList = [];

    function renderAuraList() {
        const container = document.getElementById('token-auras-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (tempAurasList.length === 0) {
            container.innerHTML = `
                <div style="font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 20px; font-style: italic; background: rgba(0,0,0,0.1); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.06);">
                    No active auras configured for this token.
                </div>
            `;
            return;
        }
        
        tempAurasList.forEach((aura, idx) => {
            const range = aura.range !== undefined ? aura.range : 10;
            const shape = aura.shape || 'circle';
            const style = aura.style || 'both';
            const opacity = aura.opacity !== undefined ? aura.opacity : 0.3;
            const color = aura.color || '#d4af37';
            const isExpanded = !!aura.isExpanded;
            
            const card = document.createElement('div');
            card.className = 'aura-item-card glassmorphism';
            card.style.border = '1px solid rgba(255,255,255,0.06)';
            card.style.borderRadius = '6px';
            card.style.padding = '10px';
            card.style.background = 'rgba(0,0,0,0.15)';
            card.dataset.index = idx;
            
            card.innerHTML = `
                <div class="aura-item-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; ${isExpanded ? 'transform: rotate(90deg);' : ''}"></i>
                        Aura ${idx + 1}: ${range}ft ${shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="swatch-preview" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 1px solid rgba(255,255,255,0.2);"></span>
                        <button type="button" class="btn-delete-aura btn btn-icon btn-danger btn-xxs" style="padding: 2px 4px; font-size: 0.7rem; border-radius: 4px;" title="Delete Aura">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="aura-item-details ${isExpanded ? '' : 'vtt-hidden'}" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                    <div class="flex-row">
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Range (ft)</label>
                            <input type="number" class="aura-range-input" min="5" max="150" step="5" value="${range}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                        </div>
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Shape</label>
                            <select class="aura-shape-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                <option value="circle" ${shape === 'circle' ? 'selected' : ''}>Circle</option>
                                <option value="square" ${shape === 'square' ? 'selected' : ''}>Square</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex-row mt-2">
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Render Style</label>
                            <select class="aura-style-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                <option value="both" ${style === 'both' ? 'selected' : ''}>Fill & Border</option>
                                <option value="fill" ${style === 'fill' ? 'selected' : ''}>Fill Only</option>
                                <option value="border" ${style === 'border' ? 'selected' : ''}>Border Only</option>
                            </select>
                        </div>
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Opacity</label>
                            <div style="display: flex; align-items: center; gap: 8px; height: 28px;">
                                <input type="range" class="aura-opacity-slider" min="0.05" max="1.0" step="0.05" value="${opacity}" style="flex: 1; cursor: pointer;">
                                <span class="aura-opacity-val" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">${Math.round(opacity * 100)}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group mt-2" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Color</label>
                        <div class="aura-color-picker-row" style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                            <input type="color" class="aura-color-input" value="${color}" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                            <div class="aura-color-swatches" style="display: flex; gap: 6px; flex: 1; justify-content: flex-start;">
                                <button type="button" class="swatch ${color.toLowerCase() === '#d4af37' ? 'active' : ''}" data-color="#d4af37" style="width: 24px; height: 24px; border-radius: 50%; background: #d4af37; border: 2px solid transparent; cursor: pointer;" title="Gold"></button>
                                <button type="button" class="swatch ${color.toLowerCase() === '#dc3545' ? 'active' : ''}" data-color="#dc3545" style="width: 24px; height: 24px; border-radius: 50%; background: #dc3545; border: 2px solid transparent; cursor: pointer;" title="Spellfire Red"></button>
                                <button type="button" class="swatch ${color.toLowerCase() === '#007bff' ? 'active' : ''}" data-color="#007bff" style="width: 24px; height: 24px; border-radius: 50%; background: #007bff; border: 2px solid transparent; cursor: pointer;" title="Mana Blue"></button>
                                <button type="button" class="swatch ${color.toLowerCase() === '#28a745' ? 'active' : ''}" data-color="#28a745" style="width: 24px; height: 24px; border-radius: 50%; background: #28a745; border: 2px solid transparent; cursor: pointer;" title="Acid Green"></button>
                                <button type="button" class="swatch ${color.toLowerCase() === '#6f42c1' ? 'active' : ''}" data-color="#6f42c1" style="width: 24px; height: 24px; border-radius: 50%; background: #6f42c1; border: 2px solid transparent; cursor: pointer;" title="Void Purple"></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
            
            // Accordion expand/collapse trigger
            const header = card.querySelector('.aura-item-header');
            const details = card.querySelector('.aura-item-details');
            const chevron = card.querySelector('.aura-chevron');
            
            header.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-aura')) return;
                
                const collapsed = details.classList.contains('vtt-hidden');
                if (collapsed) {
                    details.classList.remove('vtt-hidden');
                    chevron.style.transform = 'rotate(90deg)';
                    tempAurasList[idx].isExpanded = true;
                } else {
                    details.classList.add('vtt-hidden');
                    chevron.style.transform = 'rotate(0deg)';
                    tempAurasList[idx].isExpanded = false;
                }
            });
            
            // Input changes synchronization
            const rangeInput = card.querySelector('.aura-range-input');
            const shapeSelect = card.querySelector('.aura-shape-select');
            const styleSelect = card.querySelector('.aura-style-select');
            const opacitySlider = card.querySelector('.aura-opacity-slider');
            const opacityVal = card.querySelector('.aura-opacity-val');
            const colorInput = card.querySelector('.aura-color-input');
            const colorSwatches = card.querySelectorAll('.aura-color-swatches .swatch');
            const swatchPreview = card.querySelector('.swatch-preview');
            
            const updateAuraTitle = () => {
                const rng = rangeInput.value;
                const shp = shapeSelect.value;
                const shpTitle = shp.charAt(0).toUpperCase() + shp.slice(1);
                card.querySelector('.aura-item-header span').innerHTML = `
                    <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; transform: rotate(${tempAurasList[idx].isExpanded ? 90 : 0}deg);"></i>
                    Aura ${idx + 1}: ${rng}ft ${shpTitle}
                `;
            };
            
            rangeInput.addEventListener('input', () => {
                tempAurasList[idx].range = parseInt(rangeInput.value) || 10;
                updateAuraTitle();
            });
            
            shapeSelect.addEventListener('change', () => {
                tempAurasList[idx].shape = shapeSelect.value;
                updateAuraTitle();
            });
            
            styleSelect.addEventListener('change', () => {
                tempAurasList[idx].style = styleSelect.value;
            });
            
            opacitySlider.addEventListener('input', () => {
                const op = parseFloat(opacitySlider.value) || 0.3;
                tempAurasList[idx].opacity = op;
                opacityVal.textContent = `${Math.round(op * 100)}%`;
            });
            
            colorInput.addEventListener('input', () => {
                const col = colorInput.value;
                tempAurasList[idx].color = col;
                swatchPreview.style.background = col;
                
                const hex = col.toLowerCase();
                colorSwatches.forEach(sw => {
                    if (sw.dataset.color.toLowerCase() === hex) {
                        sw.classList.add('active');
                    } else {
                        sw.classList.remove('active');
                    }
                });
            });
            
            colorSwatches.forEach(sw => {
                sw.addEventListener('click', () => {
                    colorSwatches.forEach(s => s.classList.remove('active'));
                    sw.classList.add('active');
                    colorInput.value = sw.dataset.color;
                    tempAurasList[idx].color = sw.dataset.color;
                    swatchPreview.style.background = sw.dataset.color;
                });
            });
            
            // Delete button handling
            const btnDeleteAura = card.querySelector('.btn-delete-aura');
            btnDeleteAura.addEventListener('click', () => {
                tempAurasList.splice(idx, 1);
                renderAuraList();
            });
        });
    }

    function setupTokenEditModal() {
        const modal = document.getElementById('modal-token-edit');
        const cancel = document.getElementById('btn-token-edit-cancel');
        const submit = document.getElementById('btn-token-edit-submit');
        const btnDelete = document.getElementById('btn-token-edit-delete');
        const btnAddAura = document.getElementById('btn-token-add-aura');
        const tokenEditSizeSelect = document.getElementById('token-edit-size');
        const tokenEditCustomSizeFields = document.getElementById('token-edit-custom-size-fields');
        const tokenEditCustomWidth = document.getElementById('token-edit-custom-width');
        const tokenEditCustomHeight = document.getElementById('token-edit-custom-height');

        const updateCustomSizeVisibility = () => {
            if (tokenEditSizeSelect.value === 'custom') {
                tokenEditCustomSizeFields.classList.remove('vtt-hidden');
            } else {
                tokenEditCustomSizeFields.classList.add('vtt-hidden');
            }
        };
        tokenEditSizeSelect.addEventListener('change', updateCustomSizeVisibility);

        const tokenEditLightEnabledCb = document.getElementById('token-edit-light-enabled');
        const tokenLightSettingsPanel = document.getElementById('token-light-settings');
        tokenEditLightEnabledCb.addEventListener('change', () => {
            if (tokenEditLightEnabledCb.checked) {
                tokenLightSettingsPanel.classList.remove('vtt-hidden');
            } else {
                tokenLightSettingsPanel.classList.add('vtt-hidden');
            }
        });

        // Visual FX Tab switching logic
        const tabBtnOverlay = document.getElementById('tab-btn-fx-overlay');
        const tabBtnVignette = document.getElementById('tab-btn-fx-vignette');
        const tabBtnShadow = document.getElementById('tab-btn-fx-shadow');
        
        const panelOverlay = document.getElementById('panel-fx-overlay');
        const panelVignette = document.getElementById('panel-fx-vignette');
        const panelShadow = document.getElementById('panel-fx-shadow');
        
        const switchFxTab = (activeTab, activePanel) => {
            [tabBtnOverlay, tabBtnVignette, tabBtnShadow].forEach(t => t.classList.remove('active'));
            [panelOverlay, panelVignette, panelShadow].forEach(p => p.classList.add('vtt-hidden'));
            
            activeTab.classList.add('active');
            activePanel.classList.remove('vtt-hidden');
        };
        
        tabBtnOverlay.addEventListener('click', () => switchFxTab(tabBtnOverlay, panelOverlay));
        tabBtnVignette.addEventListener('click', () => switchFxTab(tabBtnVignette, panelVignette));
        tabBtnShadow.addEventListener('click', () => switchFxTab(tabBtnShadow, panelShadow));

        // Visual FX UI Bindings: Color Overlay
        const overlayEnabledCb = document.getElementById('token-edit-fx-overlay-enabled');
        const overlayDetails = document.getElementById('fx-overlay-details');
        const overlayOpacitySlider = document.getElementById('token-edit-fx-overlay-opacity');
        const valOverlayOpacity = document.getElementById('val-fx-overlay-opacity');
        const overlayColorInput = document.getElementById('token-edit-fx-overlay-color');
        const overlaySwatches = document.querySelectorAll('.fx-overlay-swatches .swatch');

        // Visual FX UI Bindings: Vignette Frame
        const vignetteEnabledCb = document.getElementById('token-edit-fx-vignette-enabled');
        const vignetteDetails = document.getElementById('fx-vignette-details');
        const vignetteOpacitySlider = document.getElementById('token-edit-fx-vignette-opacity');
        const valVignetteOpacity = document.getElementById('val-fx-vignette-opacity');
        const vignetteColorInput = document.getElementById('token-edit-fx-vignette-color');
        const vignetteSwatches = document.querySelectorAll('.fx-vignette-swatches .swatch');

        // Visual FX UI Bindings: Floor Shadow
        const shadowEnabledCb = document.getElementById('token-edit-fx-shadow-enabled');
        const shadowDetails = document.getElementById('fx-shadow-details');
        const shadowBlurInput = document.getElementById('token-edit-fx-shadow-blur');
        const shadowOffsetInput = document.getElementById('token-edit-fx-shadow-offset');
        const shadowColorInput = document.getElementById('token-edit-fx-shadow-color');
        const shadowOpacitySlider = document.getElementById('token-edit-fx-shadow-opacity');
        const valShadowOpacity = document.getElementById('val-fx-shadow-opacity');

        // FX Details Toggle bindings
        const bindFxDetailToggle = (enabledCb, detailsDiv) => {
            enabledCb.addEventListener('change', () => {
                if (enabledCb.checked) {
                    detailsDiv.classList.remove('vtt-hidden');
                } else {
                    detailsDiv.classList.add('vtt-hidden');
                }
            });
        };
        bindFxDetailToggle(overlayEnabledCb, overlayDetails);
        bindFxDetailToggle(vignetteEnabledCb, vignetteDetails);
        bindFxDetailToggle(shadowEnabledCb, shadowDetails);

        // FX Sliders readouts sync
        overlayOpacitySlider.addEventListener('input', () => {
            valOverlayOpacity.textContent = `${Math.round(overlayOpacitySlider.value * 100)}%`;
        });
        vignetteOpacitySlider.addEventListener('input', () => {
            valVignetteOpacity.textContent = `${Math.round(vignetteOpacitySlider.value * 100)}%`;
        });
        shadowOpacitySlider.addEventListener('input', () => {
            valShadowOpacity.textContent = `${Math.round(shadowOpacitySlider.value * 100)}%`;
        });

        // FX Swatches sync row helpers
        const syncFxSwatchesRow = (swatchesList, pickerInput) => {
            swatchesList.forEach(sw => {
                sw.addEventListener('click', () => {
                    swatchesList.forEach(s => s.classList.remove('active'));
                    sw.classList.add('active');
                    pickerInput.value = sw.dataset.color;
                });
            });
            pickerInput.addEventListener('input', () => {
                const hex = pickerInput.value.toLowerCase();
                swatchesList.forEach(sw => {
                    if (sw.dataset.color.toLowerCase() === hex) {
                        sw.classList.add('active');
                    } else {
                        sw.classList.remove('active');
                    }
                });
            });
        };
        syncFxSwatchesRow(overlaySwatches, overlayColorInput);
        syncFxSwatchesRow(vignetteSwatches, vignetteColorInput);

        btnAddAura.addEventListener('click', () => {
            tempAurasList.forEach(a => a.isExpanded = false);
            tempAurasList.push({
                range: 10,
                shape: 'circle',
                style: 'both',
                opacity: 0.3,
                color: '#d4af37',
                isExpanded: true
            });
            renderAuraList();
            
            const listContainer = document.getElementById('token-auras-list');
            setTimeout(() => {
                listContainer.scrollTop = listContainer.scrollHeight;
            }, 50);
        });

        const handleSave = (saveDefaults) => {
            if (!selectedTokenIdForEdit || !tokens[selectedTokenIdForEdit]) return;
            
            const name = document.getElementById('token-edit-name').value.trim();
            const hp = parseInt(document.getElementById('token-edit-hp').value) || 0;
            const maxHp = parseInt(document.getElementById('token-edit-max-hp').value) || 0;
            const tempHp = parseInt(document.getElementById('token-edit-temp-hp').value) || 0;
            const hpBarVisibleOverride = document.getElementById('token-edit-hp-visible').value;
            const hpNumVisibleOverride = document.getElementById('token-edit-hp-num-visible').value;
            const sizeSelection = document.getElementById('token-edit-size').value;
            const sightRange = parseInt(document.getElementById('token-edit-sight').value) || 60;

            const lightEnabled = document.getElementById('token-edit-light-enabled').checked;
            const lightBright = parseInt(document.getElementById('token-edit-light-bright').value) || 0;
            const lightDim = parseInt(document.getElementById('token-edit-light-dim').value) || 0;
            const lightColor = document.getElementById('token-edit-light-color').value;

            // Save basic fields
            tokens[selectedTokenIdForEdit].name = name;
            tokens[selectedTokenIdForEdit].hp = hp;
            tokens[selectedTokenIdForEdit].maxHp = maxHp;
            tokens[selectedTokenIdForEdit].tempHp = tempHp;
            tokens[selectedTokenIdForEdit].hpBarVisibleOverride = hpBarVisibleOverride;
            tokens[selectedTokenIdForEdit].hpNumVisibleOverride = hpNumVisibleOverride;
            if (sizeSelection === 'custom') {
                const customWidth = parseInt(tokenEditCustomWidth.value) || 1;
                const customHeight = parseInt(tokenEditCustomHeight.value) || 1;
                tokens[selectedTokenIdForEdit].size = Math.max(customWidth, customHeight);
                tokens[selectedTokenIdForEdit].customWidth = customWidth;
                tokens[selectedTokenIdForEdit].customHeight = customHeight;
            } else {
                const size = parseFloat(sizeSelection) || 1;
                tokens[selectedTokenIdForEdit].size = size;
                delete tokens[selectedTokenIdForEdit].customWidth;
                delete tokens[selectedTokenIdForEdit].customHeight;
            }
            tokens[selectedTokenIdForEdit].sightRange = sightRange;
            tokens[selectedTokenIdForEdit].lightEnabled = lightEnabled;
            tokens[selectedTokenIdForEdit].lightBright = lightBright;
            tokens[selectedTokenIdForEdit].lightDim = lightDim;
            tokens[selectedTokenIdForEdit].lightColor = lightColor;

            // Save Auras array (stripping details expand UI state)
            tokens[selectedTokenIdForEdit].auras = tempAurasList.map(a => {
                const { isExpanded, ...clean } = a;
                return clean;
            });

            // Backward compatibility flag
            if (tempAurasList.length > 0) {
                tokens[selectedTokenIdForEdit].auraEnabled = true;
                tokens[selectedTokenIdForEdit].auraRange = tempAurasList[0].range;
                tokens[selectedTokenIdForEdit].auraShape = tempAurasList[0].shape;
                tokens[selectedTokenIdForEdit].auraStyle = tempAurasList[0].style;
                tokens[selectedTokenIdForEdit].auraOpacity = tempAurasList[0].opacity;
                tokens[selectedTokenIdForEdit].auraColor = tempAurasList[0].color;
            } else {
                tokens[selectedTokenIdForEdit].auraEnabled = false;
            }

            // Save Visual FX fields
            tokens[selectedTokenIdForEdit].fxOverlayEnabled = overlayEnabledCb.checked;
            tokens[selectedTokenIdForEdit].fxOverlayOpacity = parseFloat(overlayOpacitySlider.value) || 0.3;
            tokens[selectedTokenIdForEdit].fxOverlayColor = overlayColorInput.value;

            tokens[selectedTokenIdForEdit].fxVignetteEnabled = vignetteEnabledCb.checked;
            tokens[selectedTokenIdForEdit].fxVignetteOpacity = parseFloat(vignetteOpacitySlider.value) || 0.6;
            tokens[selectedTokenIdForEdit].fxVignetteColor = vignetteColorInput.value;

            tokens[selectedTokenIdForEdit].fxShadowEnabled = shadowEnabledCb.checked;
            tokens[selectedTokenIdForEdit].fxShadowBlur = parseInt(shadowBlurInput.value) || 12;
            tokens[selectedTokenIdForEdit].fxShadowOffset = parseInt(shadowOffsetInput.value) || 4;
            tokens[selectedTokenIdForEdit].fxShadowColor = shadowColorInput.value;
            tokens[selectedTokenIdForEdit].fxShadowOpacity = parseFloat(shadowOpacitySlider.value) || 0.7;

            if (vtt.role === 'GM') {
                const layer = document.getElementById('token-edit-layer').value;
                tokens[selectedTokenIdForEdit].layer = layer;
            }

            // ── Bi-directional HP sync & Visual Defaults ──
            const editedToken = tokens[selectedTokenIdForEdit];

            if (editedToken && editedToken.characterId) {
                const chars = vtt.campaignState?.characters;
                if (chars && chars[editedToken.characterId]) {
                    const char = chars[editedToken.characterId];
                    char.hpCurrent = editedToken.hp;
                    char.hpMax     = editedToken.maxHp;
                    char.tempHp    = editedToken.tempHp ?? 0;

                    if (saveDefaults) {
                        char.tokenSize = editedToken.size;
                        char.tokenSight = editedToken.sightRange;
                        char.tokenAuras = editedToken.auras;
                        char.fxOverlayEnabled = editedToken.fxOverlayEnabled;
                        char.fxOverlayOpacity = editedToken.fxOverlayOpacity;
                        char.fxOverlayColor = editedToken.fxOverlayColor;
                        char.fxVignetteEnabled = editedToken.fxVignetteEnabled;
                        char.fxVignetteOpacity = editedToken.fxVignetteOpacity;
                        char.fxVignetteColor = editedToken.fxVignetteColor;
                        char.fxShadowEnabled = editedToken.fxShadowEnabled;
                        char.fxShadowBlur = editedToken.fxShadowBlur;
                        char.fxShadowOffset = editedToken.fxShadowOffset;
                        char.fxShadowColor = editedToken.fxShadowColor;
                        char.fxShadowOpacity = editedToken.fxShadowOpacity;
                        char.tokenLightEnabled = editedToken.lightEnabled;
                        char.tokenLightBright = editedToken.lightBright;
                        char.tokenLightDim = editedToken.lightDim;
                        char.tokenLightColor = editedToken.lightColor;
                    }

                    vtt.socket.emit('character:update', { character: char });
                }
            }

            window.emitTokenUpdates(tokens);

            modal.classList.add('vtt-hidden');
            renderAll();
        };

        submit.addEventListener('click', () => handleSave(false));
        const btnSaveDefaults = document.getElementById('btn-token-edit-save-defaults');
        if (btnSaveDefaults) {
            btnSaveDefaults.addEventListener('click', () => handleSave(true));
        }

        cancel.addEventListener('click', () => modal.classList.add('vtt-hidden'));

        btnDelete.addEventListener('click', () => {
            if (!selectedTokenIdForEdit) return;
            delete tokens[selectedTokenIdForEdit];
            if (window.VTT?.chatEngine) {
                window.VTT.chatEngine.removeFromInitiative(selectedTokenIdForEdit);
            }
            
            window.emitTokenUpdates(tokens);
            modal.classList.add('vtt-hidden');
            renderAll();
        });
    }

    function openTokenEditModal(tokenId) {
        // Player restrictions
        if (!isTokenControlledByPlayer(tokens[tokenId])) {
            return; // Can only edit GM sheets if GM
        }
        
        selectedTokenIdForEdit = tokenId;
        const token = tokens[tokenId];

        document.getElementById('token-edit-title').textContent = `Edit Token: ${token.name}`;
        document.getElementById('token-edit-name').value = token.name;
        document.getElementById('token-edit-hp').value = token.hp;
        document.getElementById('token-edit-max-hp').value = token.maxHp;
        document.getElementById('token-edit-temp-hp').value = token.tempHp !== undefined ? token.tempHp : 0;
        document.getElementById('token-edit-hp-visible').value = token.hpBarVisibleOverride || 'default';
        document.getElementById('token-edit-hp-num-visible').value = token.hpNumVisibleOverride || 'default';
        if (token.customWidth || token.customHeight) {
            document.getElementById('token-edit-size').value = 'custom';
            document.getElementById('token-edit-custom-width').value = token.customWidth || token.size || 1;
            document.getElementById('token-edit-custom-height').value = token.customHeight || token.size || 1;
            document.getElementById('token-edit-custom-size-fields').classList.remove('vtt-hidden');
        } else {
            document.getElementById('token-edit-size').value = token.size;
            document.getElementById('token-edit-custom-width').value = token.size || 1;
            document.getElementById('token-edit-custom-height').value = token.size || 1;
            document.getElementById('token-edit-custom-size-fields').classList.add('vtt-hidden');
        }
        document.getElementById('token-edit-sight').value = token.sightRange !== undefined ? token.sightRange : 60;
        if (token.isPlayer) {
            document.getElementById('token-edit-sight').disabled = true;
            document.getElementById('token-edit-sight').title = "Token Sight is managed automatically from the Character Sheet Build Tab Vision settings.";
            document.getElementById('token-edit-sight').style.opacity = "0.6";
        } else {
            document.getElementById('token-edit-sight').disabled = false;
            document.getElementById('token-edit-sight').title = "";
            document.getElementById('token-edit-sight').style.opacity = "1";
        }

        const isLightEnabled = token.lightEnabled || false;
        document.getElementById('token-edit-light-enabled').checked = isLightEnabled;
        document.getElementById('token-edit-light-bright').value = token.lightBright !== undefined ? token.lightBright : 20;
        document.getElementById('token-edit-light-dim').value = token.lightDim !== undefined ? token.lightDim : 40;
        document.getElementById('token-edit-light-color').value = token.lightColor || '#ffaa00';
        
        if (isLightEnabled) {
            document.getElementById('token-light-settings').classList.remove('vtt-hidden');
        } else {
            document.getElementById('token-light-settings').classList.add('vtt-hidden');
        }

        // Convert older single aura attributes if array is missing
        let parsedAuras = [];
        if (token.auras && Array.isArray(token.auras)) {
            parsedAuras = token.auras.map(a => ({ ...a }));
        } else if (token.auraEnabled) {
            parsedAuras = [{
                range: token.auraRange !== undefined ? token.auraRange : 10,
                shape: token.auraShape || 'circle',
                style: token.auraStyle || 'both',
                opacity: token.auraOpacity !== undefined ? token.auraOpacity : 0.3,
                color: token.auraColor || '#d4af37'
            }];
        }

        // Clone into temporary active state and set the first one expanded
        tempAurasList = parsedAuras.map((a, i) => ({
            ...a,
            isExpanded: i === 0
        }));

        renderAuraList();

        // Load FX values: Color Overlay
        const overlayEnabledCb = document.getElementById('token-edit-fx-overlay-enabled');
        const overlayDetails = document.getElementById('fx-overlay-details');
        const overlayOpacitySlider = document.getElementById('token-edit-fx-overlay-opacity');
        const valOverlayOpacity = document.getElementById('val-fx-overlay-opacity');
        const overlayColorInput = document.getElementById('token-edit-fx-overlay-color');
        const overlaySwatches = document.querySelectorAll('.fx-overlay-swatches .swatch');

        const overlayEnabled = !!token.fxOverlayEnabled;
        overlayEnabledCb.checked = overlayEnabled;
        if (overlayEnabled) overlayDetails.classList.remove('vtt-hidden');
        else overlayDetails.classList.add('vtt-hidden');

        const overlayOpacity = token.fxOverlayOpacity !== undefined ? token.fxOverlayOpacity : 0.3;
        overlayOpacitySlider.value = overlayOpacity;
        valOverlayOpacity.textContent = `${Math.round(overlayOpacity * 100)}%`;

        const overlayColor = token.fxOverlayColor || '#007bff';
        overlayColorInput.value = overlayColor;
        overlaySwatches.forEach(sw => {
            if (sw.dataset.color.toLowerCase() === overlayColor.toLowerCase()) {
                sw.classList.add('active');
            } else {
                sw.classList.remove('active');
            }
        });

        // Load FX values: Border Vignette
        const vignetteEnabledCb = document.getElementById('token-edit-fx-vignette-enabled');
        const vignetteDetails = document.getElementById('fx-vignette-details');
        const vignetteOpacitySlider = document.getElementById('token-edit-fx-vignette-opacity');
        const valVignetteOpacity = document.getElementById('val-fx-vignette-opacity');
        const vignetteColorInput = document.getElementById('token-edit-fx-vignette-color');
        const vignetteSwatches = document.querySelectorAll('.fx-vignette-swatches .swatch');

        const vignetteEnabled = !!token.fxVignetteEnabled;
        vignetteEnabledCb.checked = vignetteEnabled;
        if (vignetteEnabled) vignetteDetails.classList.remove('vtt-hidden');
        else vignetteDetails.classList.add('vtt-hidden');

        const vignetteOpacity = token.fxVignetteOpacity !== undefined ? token.fxVignetteOpacity : 0.6;
        vignetteOpacitySlider.value = vignetteOpacity;
        valVignetteOpacity.textContent = `${Math.round(vignetteOpacity * 100)}%`;

        const vignetteColor = token.fxVignetteColor || '#000000';
        vignetteColorInput.value = vignetteColor;
        vignetteSwatches.forEach(sw => {
            if (sw.dataset.color.toLowerCase() === vignetteColor.toLowerCase()) {
                sw.classList.add('active');
            } else {
                sw.classList.remove('active');
            }
        });

        // Load FX values: Floor Shadow
        const shadowEnabledCb = document.getElementById('token-edit-fx-shadow-enabled');
        const shadowDetails = document.getElementById('fx-shadow-details');
        const shadowBlurInput = document.getElementById('token-edit-fx-shadow-blur');
        const shadowOffsetInput = document.getElementById('token-edit-fx-shadow-offset');
        const shadowColorInput = document.getElementById('token-edit-fx-shadow-color');
        const shadowOpacitySlider = document.getElementById('token-edit-fx-shadow-opacity');
        const valShadowOpacity = document.getElementById('val-fx-shadow-opacity');

        const shadowEnabled = !!token.fxShadowEnabled;
        shadowEnabledCb.checked = shadowEnabled;
        if (shadowEnabled) shadowDetails.classList.remove('vtt-hidden');
        else shadowDetails.classList.add('vtt-hidden');

        shadowBlurInput.value = token.fxShadowBlur !== undefined ? token.fxShadowBlur : 12;
        shadowOffsetInput.value = token.fxShadowOffset !== undefined ? token.fxShadowOffset : 4;
        
        const shadowColor = token.fxShadowColor || '#000000';
        shadowColorInput.value = shadowColor;

        const shadowOpacity = token.fxShadowOpacity !== undefined ? token.fxShadowOpacity : 0.7;
        shadowOpacitySlider.value = shadowOpacity;
        valShadowOpacity.textContent = `${Math.round(shadowOpacity * 100)}%`;

        // Active tab reset inside openTokenEditModal
        const tabBtnOverlay = document.getElementById('tab-btn-fx-overlay');
        const panelOverlay = document.getElementById('panel-fx-overlay');
        const tabBtnVignette = document.getElementById('tab-btn-fx-vignette');
        const panelVignette = document.getElementById('panel-fx-vignette');
        const tabBtnShadow = document.getElementById('tab-btn-fx-shadow');
        const panelShadow = document.getElementById('panel-fx-shadow');

        [tabBtnOverlay, tabBtnVignette, tabBtnShadow].forEach(t => t.classList.remove('active'));
        [panelOverlay, panelVignette, panelShadow].forEach(p => p.classList.add('vtt-hidden'));
        tabBtnOverlay.classList.add('active');
        panelOverlay.classList.remove('vtt-hidden');

        if (vtt.role === 'GM') {
            document.getElementById('token-edit-layer').value = token.layer || 'token';
        }

        document.getElementById('modal-token-edit').classList.remove('vtt-hidden');
    }

    // API exposing to other scripts (like bridge)
    const engine = {
        renderAll,
        getGrid: () => grid,
        getTokens: () => tokens,
        getSelectedTokenIds: () => Array.from(selectedTokenIds),
        selectToken: (tokenId) => {
            selectedTokenIds.clear();
            if (tokenId) selectedTokenIds.add(tokenId);
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
            tokens[token.id] = token;
            window.emitTokenUpdates(tokens);
            renderAll();
            if (window.VTT?.chatEngine?.refreshInitiative) {
                window.VTT.chatEngine.refreshInitiative();
            }
        }
    };

    // =========================================================================
    // TOKEN ACTIONS RIGHT-CLICK CONTEXT MENU & ROLLERS SYSTEM
    // =========================================================================

    function getPcRollFormula(char, rollType, key) {
        let baseMod = 0;
        let toggles = [];
        let globalMod = 0;
        let profBonus = Math.floor(((char.level || 1) - 1) / 4) + 2;

        const getMod = (score) => Math.floor((score - 10) / 2);

        if (rollType === 'initiative') {
            baseMod = getMod(char.stats.dex || 10);
            toggles = (char.skillToggles || []).filter(t => t.enabled && (t.target === 'all' || t.target === 'initiative'));
            globalMod = char.globalAbilityMod || "0";
        } else if (rollType === 'ability' || rollType === 'skill') {
            let abKey = key;
            if (rollType === 'skill') {
                const ALL_SKILLS = [
                    {name: "Acrobatics", ability: "dex"}, {name: "Animal Handling", ability: "wis"},
                    {name: "Arcana", ability: "int"}, {name: "Athletics", ability: "str"},
                    {name: "Deception", ability: "cha"}, {name: "History", ability: "int"},
                    {name: "Insight", ability: "wis"}, {name: "Intimidation", ability: "cha"},
                    {name: "Investigation", ability: "int"}, {name: "Medicine", ability: "wis"},
                    {name: "Nature", ability: "int"}, {name: "Perception", ability: "wis"},
                    {name: "Performance", ability: "cha"}, {name: "Persuasion", ability: "cha"},
                    {name: "Religion", ability: "int"}, {name: "Sleight of Hand", ability: "dex"},
                    {name: "Stealth", ability: "dex"}, {name: "Survival", ability: "wis"}
                ];
                // key might be 'acrobatics' but the sheet stores 'Acrobatics'
                const skillDef = ALL_SKILLS.find(s => s.name.toLowerCase() === key.toLowerCase() || s.name.replace(/ /g,'_') === key);
                abKey = skillDef ? skillDef.ability : 'str';
                baseMod = getMod(char.stats[abKey] || 10);
                if (char.skills && skillDef && char.skills[skillDef.name]) baseMod += profBonus;
                if (char.expertise && skillDef && char.expertise[skillDef.name]) baseMod += profBonus;
                const customMod = (char.skillMods && skillDef && char.skillMods[skillDef.name]) ? parseInt(char.skillMods[skillDef.name]) : 0;
                if (!isNaN(customMod)) baseMod += customMod;
            } else {
                baseMod = getMod(char.stats[key] || 10);
            }
            toggles = (char.skillToggles || []).filter(t => t.enabled && (t.target === 'all' || t.target === key));
            globalMod = char.globalAbilityMod || "0";
        } else if (rollType === 'save') {
            baseMod = getMod(char.stats[key] || 10);
            if (char.saves && char.saves[key]) baseMod += profBonus;
            const customMod = (char.saveMods && char.saveMods[key]) ? parseInt(char.saveMods[key]) : 0;
            if (!isNaN(customMod)) baseMod += customMod;
            toggles = (char.saveToggles || []).filter(t => t.enabled && (t.target === 'all' || t.target === key));
            globalMod = char.globalSaveMod || "0";
        }

        let toggleFormulaStr = '';
        toggles.forEach(t => {
            toggleFormulaStr += (t.formula.startsWith('+') || t.formula.startsWith('-')) ? t.formula : '+' + t.formula;
        });

        let modStr = baseMod >= 0 ? '+' + baseMod : baseMod;
        if (globalMod !== "0" && globalMod !== 0) {
            let gStr = String(globalMod);
            if (gStr.includes('d')) {
                modStr += (gStr.startsWith('+') || gStr.startsWith('-') ? gStr : '+' + gStr);
            } else {
                const m = parseInt(globalMod) || 0;
                const newMod = baseMod + m;
                modStr = newMod >= 0 ? '+' + newMod : newMod;
            }
        }

        return `1d20${modStr}${toggleFormulaStr}`;
    }

    function showTokenContextMenu(tokenId, clientX, clientY) {
        // Remove any existing menu first
        const oldMenu = document.getElementById('vtt-token-context-menu');
        if (oldMenu) oldMenu.remove();

        const token = tokens[tokenId];
        if (!token) return;

        let monsterData = token.monsterData;
        if (!monsterData && token.characterId && window.VTT?.campaignState?.characters?.[token.characterId]) {
            const char = window.VTT.campaignState.characters[token.characterId];
            if (char.isCompanion && char.monsterData) {
                monsterData = char.monsterData;
            }
        }

        // Create container
        const menu = document.createElement('div');
        menu.id = 'vtt-token-context-menu';
        menu.className = 'vtt-token-context-menu';
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;

        // Ability List
        const abilities = [
            { key: 'str', label: 'Strength' },
            { key: 'dex', label: 'Dexterity' },
            { key: 'con', label: 'Constitution' },
            { key: 'int', label: 'Intelligence' },
            { key: 'wis', label: 'Wisdom' },
            { key: 'cha', label: 'Charisma' }
        ];

        // Skill List with standard 5e skills & associated abilities
        const skills = [
            { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
            { key: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
            { key: 'arcana', label: 'Arcana', ability: 'int' },
            { key: 'athletics', label: 'Athletics', ability: 'str' },
            { key: 'deception', label: 'Deception', ability: 'cha' },
            { key: 'history', label: 'History', ability: 'int' },
            { key: 'insight', label: 'Insight', ability: 'wis' },
            { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
            { key: 'investigation', label: 'Investigation', ability: 'int' },
            { key: 'medicine', label: 'Medicine', ability: 'wis' },
            { key: 'nature', label: 'Nature', ability: 'int' },
            { key: 'perception', label: 'Perception', ability: 'wis' },
            { key: 'performance', label: 'Performance', ability: 'cha' },
            { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
            { key: 'religion', label: 'Religion', ability: 'int' },
            { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
            { key: 'stealth', label: 'Stealth', ability: 'dex' },
            { key: 'survival', label: 'Survival', ability: 'wis' }
        ];

        // Header with token name
        let html = `
            <div class="vtt-token-menu-header">
                <i class="fa-solid fa-dice-d20"></i> ${token.name}
            </div>
            <div class="vtt-token-menu-item" id="menu-apply-damage">
                <span><i class="fa-solid fa-heart-crack item-icon"></i> Apply Damage</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-roll-init">
                <span><i class="fa-solid fa-swords item-icon"></i> Roll Initiative</span>
            </div>
            <div class="vtt-token-menu-divider"></div>
        `;

        // 1. Ability Checks Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-arrows-to-eye item-icon"></i> Ability Checks</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled">
        `;
        abilities.forEach(ab => {
            const score = monsterData ? (monsterData[ab.key] || 10) : 10;
            const mod = Math.floor((score - 10) / 2);
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            const badgeStr = monsterData ? `<span class="modifier-badge">${modStr}</span>` : '';
            html += `
                <div class="vtt-submenu-item menu-roll-ability" data-ability="${ab.key}" data-label="${ab.label}">
                    <span>${ab.label}</span>
                    ${badgeStr}
                </div>
            `;
        });
        html += `
                    </div>
                </div>
            </div>
        `;

        // 2. Saving Throws Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-shield-halved item-icon"></i> Saving Throws</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled">
        `;
        abilities.forEach(ab => {
            let mod = 0;
            if (monsterData) {
                const score = monsterData[ab.key] || 10;
                mod = Math.floor((score - 10) / 2);
                if (monsterData.save && monsterData.save[ab.key] !== undefined) {
                    mod = parseInt(monsterData.save[ab.key]);
                }
            }
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            const badgeStr = monsterData ? `<span class="modifier-badge">${modStr}</span>` : '';
            html += `
                <div class="vtt-submenu-item menu-roll-save" data-ability="${ab.key}" data-label="${ab.label}">
                    <span>${ab.label}</span>
                    ${badgeStr}
                </div>
            `;
        });
        html += `
                    </div>
                </div>
            </div>
        `;

        // 3. Skill Checks Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-wand-magic-sparkles item-icon"></i> Skill Checks</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled">
        `;
        skills.forEach(sk => {
            let mod = 0;
            if (monsterData) {
                const score = monsterData[sk.ability] || 10;
                mod = Math.floor((score - 10) / 2);
                if (monsterData.skill && monsterData.skill[sk.key] !== undefined) {
                    mod = parseInt(monsterData.skill[sk.key]);
                }
            }
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            const badgeStr = monsterData ? `<span class="modifier-badge">${modStr}</span>` : '';
            html += `
                <div class="vtt-submenu-item menu-roll-skill" data-skill="${sk.key}" data-label="${sk.label}">
                    <span>${sk.label}</span>
                    ${badgeStr}
                </div>
            `;
        });
        html += `
                    </div>
                </div>
            </div>
        `;

        // 3.4 Elevation
        const elevation = token.flightHeight || 0;
        html += `
            <div class="vtt-token-menu-item" style="cursor: default; display: flex; justify-content: space-between; align-items: center; padding-right: 8px;">
                <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Elevation</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button class="menu-btn-flight-dec" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">-</button>
                    <input type="number" class="menu-input-flight" value="${elevation}" step="5" style="width: 40px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; text-align: center; border-radius: 4px; font-size: 12px; height: 20px; padding: 0;">
                    <button class="menu-btn-flight-inc" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                </div>
            </div>
        `;

        // 3.5 Conditions Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-heart-pulse item-icon"></i> Conditions</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled" style="max-height: 280px;">
                        <div class="vtt-submenu-item menu-add-custom-condition" style="cursor: pointer; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--color-gold-base); font-weight: bold; text-align: center; background: rgba(255,255,255,0.05); transition: background 0.2s;">
                            <i class="fa-solid fa-plus"></i> Add Custom Condition...
                        </div>
        `;
        
        const sortedConditions = Object.keys(CONDITION_ICONS).sort();
        const activeConditionsMap = new Map();
        if (token.conditions) {
            token.conditions.forEach(c => activeConditionsMap.set(`${c.name}_${c.source}`, true));
        }

        sortedConditions.forEach(condName => {
            const iconClass = CONDITION_ICONS[condName];
            const isPhbActive = activeConditionsMap.has(`${condName}_PHB`);
            const isXphbActive = activeConditionsMap.has(`${condName}_XPHB`);
            
            html += `
                <div class="vtt-submenu-item" style="cursor: default; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-weight: bold; color: var(--color-gold-base);"><i class="fa-solid ${iconClass}"></i> ${condName}</div>
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <div class="menu-toggle-condition" data-cond="${condName}" data-source="PHB" style="flex: 1; text-align: center; cursor: pointer; padding: 2px 4px; border-radius: 4px; background: ${isPhbActive ? 'var(--color-gold-base)' : 'rgba(255,255,255,0.1)'}; color: ${isPhbActive ? '#000' : '#fff'}; transition: all 0.2s;">PHB</div>
                        <div class="menu-toggle-condition" data-cond="${condName}" data-source="XPHB" style="flex: 1; text-align: center; cursor: pointer; padding: 2px 4px; border-radius: 4px; background: ${isXphbActive ? 'var(--color-gold-base)' : 'rgba(255,255,255,0.1)'}; color: ${isXphbActive ? '#000' : '#fff'}; transition: all 0.2s;">XPHB</div>
                    </div>
                </div>
            `;
        });
        
        if (token.conditions) {
            token.conditions.forEach((c, idx) => {
                if (c.isCustom) {
                    html += `
                        <div class="vtt-submenu-item" style="cursor: default; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <div style="font-weight: bold; color: var(--color-gold-base); display: flex; align-items: center; gap: 6px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${c.color}; border: 1px solid var(--color-gold-base);"></div>
                                ${c.name}
                            </div>
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <div class="menu-toggle-custom-condition" data-custom-idx="${idx}" style="flex: 1; text-align: center; cursor: pointer; padding: 2px 4px; border-radius: 4px; background: var(--color-gold-base); color: #000; transition: all 0.2s;">Active (Click to Remove)</div>
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;

        // 3.6 Token Selector
        const charSheet = (token.characterId && window.VTT?.campaignState?.characters) ? window.VTT.campaignState.characters[token.characterId] : null;
        
        const availableTokens = [];

        // Helper to get default monster token
        const getMonsterTokenUrl = (monster) => {
            if (monster && monster.hasToken) {
                if (typeof window.Renderer !== 'undefined' && window.Renderer.monster && window.Renderer.monster.getTokenUrl) {
                    return window.Renderer.monster.getTokenUrl(monster);
                }
                const cleanName = typeof window.Parser !== 'undefined' ? window.Parser.nameToTokenName(monster.name) : monster.name.replace(/ /g, '-').toLowerCase();
                const source = monster.source;
                return `img/bestiary/tokens/${source}/${cleanName}.webp`;
            }
            return null;
        };

        // 1. Add Default Token if NPC or Companion
        let defaultTokenUrl = null;
        if (charSheet && (charSheet.isCompanion || charSheet.isCustomNpc || charSheet.monsterData)) {
            defaultTokenUrl = getMonsterTokenUrl(charSheet.monsterData || {});
        } else if (token.monsterData) {
            defaultTokenUrl = getMonsterTokenUrl(token.monsterData);
        }

        if (defaultTokenUrl) {
            availableTokens.push({
                url: defaultTokenUrl,
                idx: -1,
                isDefault: true
            });
        }

        // 2. Add custom Token Images from the gallery
        if (charSheet && charSheet.tokenImages && charSheet.tokenImages.length > 0) {
            charSheet.tokenImages.forEach((imgObj, idx) => {
                const url = typeof imgObj === 'string' ? imgObj : (imgObj.url || '');
                if (url) {
                    availableTokens.push({
                        url: url,
                        idx: idx,
                        isDefault: false
                    });
                }
            });
        }

        if (availableTokens.length > 0) {
            let galleryHtml = '';
            availableTokens.forEach((tData) => {
                let isActive = false;
                if (charSheet && charSheet.activeTokenIndex !== undefined && charSheet.activeTokenIndex !== null) {
                    isActive = charSheet.activeTokenIndex === tData.idx;
                } else {
                    isActive = token.img === tData.url;
                }
                galleryHtml += `<img src="${tData.url}" class="menu-token-selector-img" data-idx="${tData.idx}" data-url="${tData.url}" title="${tData.isDefault ? 'Default Token' : 'Custom Token'}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 2px solid ${isActive ? 'var(--color-success-base)' : 'rgba(255,255,255,0.2)'};" onerror="this.style.display='none'">`;
            });

            html += `
                <div class="vtt-token-menu-item">
                    <span><i class="fa-solid fa-images item-icon"></i> Token Selector</span>
                    <i class="fa-solid fa-chevron-right chevron-icon"></i>
                    <div class="vtt-token-submenu">
                        <div class="vtt-token-submenu-list scroll-styled" style="width: 240px; padding: 12px; cursor: default; max-height: 400px; display: flex; gap: 8px; flex-wrap: wrap;">
                            ${galleryHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        // 4. Transform options (All Users)
        html += `
            <div class="vtt-token-menu-divider"></div>
            <div class="vtt-token-menu-item" id="menu-flip-h">
                <span><i class="fa-solid fa-arrows-left-right item-icon"></i> Flip Horizontally</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-flip-v">
                <span><i class="fa-solid fa-arrows-up-down item-icon"></i> Flip Vertically</span>
            </div>
        `;

        // 5. Z-ordering (GM Only)
        if (vtt.role === 'GM') {
            html += `
                <div class="vtt-token-menu-divider"></div>
                <div class="vtt-token-menu-item" id="menu-move-front">
                    <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Front</span>
                </div>
                <div class="vtt-token-menu-item" id="menu-move-back">
                    <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Back</span>
                </div>
                <div class="vtt-token-menu-item" id="menu-move-front-one">
                    <span><i class="fa-solid fa-angle-up item-icon"></i> Move Front One</span>
                </div>
                <div class="vtt-token-menu-item" id="menu-move-back-one">
                    <span><i class="fa-solid fa-angle-down item-icon"></i> Move Back One</span>
                </div>
                <div class="vtt-token-menu-divider"></div>
                <div class="vtt-token-menu-item">
                    <span><i class="fa-solid fa-layer-group item-icon"></i> Move to Layer</span>
                    <i class="fa-solid fa-chevron-right chevron-icon"></i>
                    <div class="vtt-token-submenu" style="min-width: 180px;">
                        <div class="vtt-token-submenu-list scroll-styled">
                            <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="token">
                                <span><i class="fa-solid fa-users" style="width: 16px; text-align: center; margin-right: 8px;"></i> Token Layer</span>
                            </div>
                            <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="gm">
                                <span><i class="fa-solid fa-user-secret" style="width: 16px; text-align: center; margin-right: 8px;"></i> GM Layer</span>
                            </div>
                            <div class="vtt-submenu-item menu-ctx-move-layer" data-layer="map">
                                <span><i class="fa-solid fa-map" style="width: 16px; text-align: center; margin-right: 8px;"></i> Map Layer</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="vtt-token-menu-divider"></div>
                <div class="vtt-token-menu-item">
                    <span><i class="fa-solid fa-sync item-icon"></i> Convert</span>
                    <i class="fa-solid fa-chevron-right chevron-icon"></i>
                    <div class="vtt-token-submenu" style="min-width: 220px;">
                        <div class="vtt-token-submenu-list scroll-styled">
                            <div class="vtt-submenu-item" id="menu-ctx-convert-freeform">
                                <span><i class="fa-solid fa-image" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Freeform Asset</span>
                            </div>
                            <div class="vtt-submenu-item" id="menu-ctx-convert-borderless">
                                <span><i class="fa-solid fa-circle" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Borderless Token</span>
                            </div>
                            <div class="vtt-submenu-item" id="menu-ctx-convert-bordered">
                                <span><i class="fa-solid fa-ring" style="width: 16px; text-align: center; margin-right: 8px;"></i> To Bordered Token</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="vtt-token-menu-item text-danger" id="menu-ctx-delete" style="color: var(--color-danger);">
                    <span><i class="fa-solid fa-trash item-icon"></i> Delete</span>
                </div>
            `;
        }

        menu.innerHTML = html;
        document.body.appendChild(menu);

        // Position adjustment to avoid screen edge clipping
        const menuRect = menu.getBoundingClientRect();
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        let adjustedX = clientX;
        let adjustedY = clientY;
        if (clientX + menuRect.width > screenW) {
            adjustedX = screenW - menuRect.width - 10;
        }
        if (clientY + menuRect.height > screenH) {
            adjustedY = screenH - menuRect.height - 10;
        }
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;

        // Wire click handlers
        // Apply Damage
        const btnApplyDamage = menu.querySelector('#menu-apply-damage');
        if (btnApplyDamage) {
            btnApplyDamage.addEventListener('click', () => {
                showApplyDamageModal([tokenId]);
                menu.remove();
            });
        }

        // Initiative
        menu.querySelector('#menu-roll-init').addEventListener('click', () => {
            let formula = '';
            if (monsterData) {
                const score = monsterData.dex || 10;
                let mod = Math.floor((score - 10) / 2);
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            } else if (token.isPlayer && token.characterId && window.VTT?.campaignState?.characters?.[token.characterId]) {
                const char = window.VTT.campaignState.characters[token.characterId];
                formula = getPcRollFormula(char, 'initiative');
            } else {
                const input = prompt(`Enter Initiative Modifier for ${token.name}:`, "0");
                if (input === null) { menu.remove(); return; }
                let mod = parseInt(input) || 0;
                formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
            }

            const label = `${token.name}: Initiative`;
            const resultTotal = rollFromToken(formula, label, tokenId);

            // Automatically add to Turn Tracker!
            if (window.VTT?.chatEngine) {
                window.VTT.chatEngine.addToInitiative(token.name, resultTotal, tokenId);
            }
            menu.remove();
        });

        // Abilities
        menu.querySelectorAll('.menu-roll-ability').forEach(item => {
            item.addEventListener('click', () => {
                const abKey = item.dataset.ability;
                const abLabel = item.dataset.label;
                let formula = '';
                if (monsterData) {
                    const score = monsterData[abKey] || 10;
                    let mod = Math.floor((score - 10) / 2);
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (token.isPlayer && token.characterId && window.VTT?.campaignState?.characters?.[token.characterId]) {
                    const char = window.VTT.campaignState.characters[token.characterId];
                    formula = getPcRollFormula(char, 'ability', abKey);
                } else {
                    const input = prompt(`Enter modifier for ${abLabel} Check:`, "0");
                    if (input === null) { menu.remove(); return; }
                    let mod = parseInt(input) || 0;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${token.name}: ${abLabel.toUpperCase()} Check`;
                rollFromToken(formula, label, tokenId);
                menu.remove();
            });
        });

        // Saves
        menu.querySelectorAll('.menu-roll-save').forEach(item => {
            item.addEventListener('click', () => {
                const abKey = item.dataset.ability;
                const abLabel = item.dataset.label;
                let formula = '';
                if (monsterData) {
                    const score = monsterData[abKey] || 10;
                    let mod = Math.floor((score - 10) / 2);
                    if (monsterData.save && monsterData.save[abKey] !== undefined) {
                        mod = parseInt(monsterData.save[abKey]);
                    }
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (token.isPlayer && token.characterId && window.VTT?.campaignState?.characters?.[token.characterId]) {
                    const char = window.VTT.campaignState.characters[token.characterId];
                    formula = getPcRollFormula(char, 'save', abKey);
                } else {
                    const input = prompt(`Enter modifier for ${abLabel} Save:`, "0");
                    if (input === null) { menu.remove(); return; }
                    let mod = parseInt(input) || 0;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${token.name}: ${abLabel.toUpperCase()} Saving Throw`;
                rollFromToken(formula, label, tokenId);
                menu.remove();
            });
        });

        // Skills
        menu.querySelectorAll('.menu-roll-skill').forEach(item => {
            item.addEventListener('click', () => {
                const skKey = item.dataset.skill;
                const skLabel = item.dataset.label;
                let formula = '';
                if (monsterData) {
                    const skillObj = skills.find(s => s.key === skKey);
                    const score = monsterData[skillObj.ability] || 10;
                    let mod = Math.floor((score - 10) / 2);
                    if (monsterData.skill && monsterData.skill[skKey] !== undefined) {
                        mod = parseInt(monsterData.skill[skKey]);
                    }
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (token.isPlayer && token.characterId && window.VTT?.campaignState?.characters?.[token.characterId]) {
                    const char = window.VTT.campaignState.characters[token.characterId];
                    formula = getPcRollFormula(char, 'skill', skKey);
                } else {
                    const input = prompt(`Enter modifier for ${skLabel} Check:`, "0");
                    if (input === null) { menu.remove(); return; }
                    let mod = parseInt(input) || 0;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${token.name}: ${skLabel} Check`;
                rollFromToken(formula, label, tokenId);
                menu.remove();
            });
        });

        // Conditions
        // Elevation events
        const updateFlight = (newHeight) => {
            const activeToken = tokens[tokenId];
            if (!activeToken) return;
            activeToken.flightHeight = newHeight;
            if (vtt.socket) {
                window.emitTokenUpdates(tokens);
            }
            renderAll();
        };

        const btnFlightDec = menu.querySelector('.menu-btn-flight-dec');
        const btnFlightInc = menu.querySelector('.menu-btn-flight-inc');
        const inputFlight = menu.querySelector('.menu-input-flight');
        if (btnFlightDec && btnFlightInc && inputFlight) {
            btnFlightDec.addEventListener('click', (e) => {
                e.stopPropagation();
                let val = parseInt(inputFlight.value) || 0;
                val -= 5;
                inputFlight.value = val;
                updateFlight(val);
            });
            btnFlightInc.addEventListener('click', (e) => {
                e.stopPropagation();
                let val = parseInt(inputFlight.value) || 0;
                val += 5;
                inputFlight.value = val;
                updateFlight(val);
            });
            inputFlight.addEventListener('change', (e) => {
                e.stopPropagation();
                updateFlight(parseInt(inputFlight.value) || 0);
            });
            inputFlight.addEventListener('click', (e) => e.stopPropagation());
        }

        menu.querySelectorAll('.menu-toggle-condition').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent closing the menu instantly if we want to toggle multiple
                const activeToken = tokens[tokenId];
                if (!activeToken) return;
                
                const condName = item.dataset.cond;
                const source = item.dataset.source;
                
                if (!activeToken.conditions) activeToken.conditions = [];
                const existingIdx = activeToken.conditions.findIndex(c => c.name === condName && c.source === source);
                
                if (existingIdx !== -1) {
                    // Remove condition
                    activeToken.conditions.splice(existingIdx, 1);
                    item.style.background = 'rgba(255,255,255,0.1)';
                    item.style.color = '#fff';
                } else {
                    // Add condition
                    activeToken.conditions.push({ name: condName, source: source });
                    item.style.background = 'var(--color-gold-base)';
                    item.style.color = '#000';
                }
                
                window.emitTokenUpdates(tokens);
                renderAll();
            });
        });

        const btnAddCustom = menu.querySelector('.menu-add-custom-condition');
        if (btnAddCustom) {
            btnAddCustom.addEventListener('mouseenter', () => btnAddCustom.style.background = 'rgba(255,255,255,0.1)');
            btnAddCustom.addEventListener('mouseleave', () => btnAddCustom.style.background = 'rgba(255,255,255,0.05)');
            btnAddCustom.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.remove();
                contextMenuTargetId = null;
                showAddCustomConditionModal(tokenId);
            });
        }

        menu.querySelectorAll('.menu-toggle-custom-condition').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const activeToken = tokens[tokenId];
                if (!activeToken || !activeToken.conditions) return;
                const idx = parseInt(item.dataset.customIdx);
                activeToken.conditions.splice(idx, 1);
                window.emitTokenUpdates(tokens);
                
                // Keep the menu open and just re-render everything
                // Alternatively, close menu. We will close it for simplicity.
                menu.remove();
                contextMenuTargetId = null;
                renderAll();
            });
        });


        // Token Selector Click
        menu.querySelectorAll('.menu-token-selector-img').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = e.target.dataset.url;
                const idx = parseInt(e.target.dataset.idx);

                const t = tokens[tokenId];
                if (!t) return;
                
                t.url = url;
                t.img = url;
                
                const cleanUrl = url.split('?')[0].toLowerCase();
                t.isVideo = !!cleanUrl.match(/\.(mp4|webm|ogg)$/i) || url.includes('youtube.com');

                // Update default on sheet
                if (t.characterId) {
                    const char = window.VTT?.campaignState?.characters?.[t.characterId];
                    if (char) {
                        char.activeTokenIndex = idx;
                        char.tokenSize = t.size;
                        char.tokenSight = t.sightRange;
                        char.tokenAuras = t.auras;
                        char.fxOverlayEnabled = t.fxOverlayEnabled;
                        char.fxOverlayOpacity = t.fxOverlayOpacity;
                        char.fxOverlayColor = t.fxOverlayColor;
                        char.fxVignetteEnabled = t.fxVignetteEnabled;
                        char.fxVignetteOpacity = t.fxVignetteOpacity;
                        char.fxVignetteColor = t.fxVignetteColor;
                        char.fxShadowEnabled = t.fxShadowEnabled;
                        char.fxShadowBlur = t.fxShadowBlur;
                        char.fxShadowOffset = t.fxShadowOffset;
                        char.fxShadowColor = t.fxShadowColor;
                        char.fxShadowOpacity = t.fxShadowOpacity;
                        char.tokenLightEnabled = t.lightEnabled;
                        char.tokenLightBright = t.lightBright;
                        char.tokenLightDim = t.lightDim;
                        char.tokenLightColor = t.lightColor;

                        if (vtt.socket) {
                            vtt.socket.emit('character:update', { id: t.characterId, character: char });
                        }
                    }
                }

                if (vtt.socket) {
                    window.emitTokenUpdates(tokens);
                }
                renderAll();
                menu.remove();
            });
        });
        // Flip Token
        const btnFlipH = menu.querySelector('#menu-flip-h');
        if (btnFlipH) {
            btnFlipH.addEventListener('click', () => {
                const t = tokens[tokenId];
                if (t) {
                    t.flipX = !t.flipX;
                    if (vtt.socket) window.emitTokenUpdates(tokens);
                    renderAll();
                }
                menu.remove();
            });
        }
        
        const btnFlipV = menu.querySelector('#menu-flip-v');
        if (btnFlipV) {
            btnFlipV.addEventListener('click', () => {
                const t = tokens[tokenId];
                if (t) {
                    t.flipY = !t.flipY;
                    if (vtt.socket) window.emitTokenUpdates(tokens);
                    renderAll();
                }
                menu.remove();
            });
        }


        // Z-Ordering functions (GM Only)
        if (vtt.role === 'GM') {
            menu.querySelector('#menu-move-front').addEventListener('click', () => {
                changeTokenZOrder(tokenId, 'front');
                menu.remove();
            });
            menu.querySelector('#menu-move-back').addEventListener('click', () => {
                changeTokenZOrder(tokenId, 'back');
                menu.remove();
            });
            menu.querySelector('#menu-move-front-one').addEventListener('click', () => {
                changeTokenZOrder(tokenId, 'front-one');
                menu.remove();
            });
            menu.querySelector('#menu-move-back-one').addEventListener('click', () => {
                changeTokenZOrder(tokenId, 'back-one');
                menu.remove();
            });
            menu.querySelectorAll('.menu-ctx-move-layer').forEach(item => {
                item.addEventListener('click', () => {
                    token.layer = item.dataset.layer;
                    window.emitTokenUpdates(tokens);
                    renderAll();
                    menu.remove();
                });
            });
            menu.querySelector('#menu-ctx-convert-freeform').addEventListener('click', () => {
                // Compute draw dimensions before flipping to asset mode
                const { drawW, drawH } = getTokenDrawDimensions(token);
                token.isAsset = true;
                token.isBorderless = false; // Reset to default
                token.pixelWidth = drawW;
                token.pixelHeight = drawH;
                token.imgRadius = '0';
                window.emitTokenUpdates(tokens);
                renderAll();
                menu.remove();
            });
            menu.querySelector('#menu-ctx-convert-borderless').addEventListener('click', () => {
                token.isAsset = false;
                token.isBorderless = true;
                const snap = snapToGrid(token.x, token.y, true);
                token.x = snap.x;
                token.y = snap.y;
                token.size = 1;
                if (token.assetType === 'video' || (token.url && token.url.split('?')[0].toLowerCase().endsWith('.gif'))) {
                    token.imgRadius = '50%';
                }
                window.emitTokenUpdates(tokens);
                renderAll();
                menu.remove();
            });
            menu.querySelector('#menu-ctx-convert-bordered').addEventListener('click', () => {
                token.isAsset = false;
                token.isBorderless = false;
                const snap = snapToGrid(token.x, token.y, true);
                token.x = snap.x;
                token.y = snap.y;
                token.size = 1;
                if (token.assetType === 'video' || (token.url && token.url.split('?')[0].toLowerCase().endsWith('.gif'))) {
                    token.imgRadius = '50%';
                }
                window.emitTokenUpdates(tokens);
                renderAll();
                menu.remove();
            });
            menu.querySelector('#menu-ctx-delete').addEventListener('click', () => {
                delete tokens[tokenId];
                window.emitTokenUpdates(tokens);
                renderAll();
                menu.remove();
            });
        }
    }

    function changeTokenZOrder(tokenId, action) {
        const tokenList = Object.values(tokens);
        if (tokenList.length <= 1) return;

        // Current token details
        const selectedToken = tokens[tokenId];
        if (!selectedToken) return;

        // Extract zIndices of all other tokens
        const otherZIndexes = tokenList
            .filter(t => t.id !== tokenId)
            .map(t => t.zIndex || 0);

        const maxZ = otherZIndexes.length > 0 ? Math.max(...otherZIndexes) : 0;
        const minZ = otherZIndexes.length > 0 ? Math.min(...otherZIndexes) : 0;

        if (action === 'front') {
            selectedToken.zIndex = maxZ + 1;
        } else if (action === 'back') {
            selectedToken.zIndex = minZ - 1;
        } else if (action === 'front-one' || action === 'back-one') {
            // Sort all tokens by zIndex
            const sortedTokens = [...tokenList].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            const curIdx = sortedTokens.findIndex(t => t.id === tokenId);
            if (action === 'front-one') {
                if (curIdx < sortedTokens.length - 1) {
                    const targetToken = sortedTokens[curIdx + 1];
                    const temp = selectedToken.zIndex || 0;
                    selectedToken.zIndex = targetToken.zIndex || 0;
                    targetToken.zIndex = temp;
                    // If they had the exact same zIndex originally, make sure selected is higher
                    if (selectedToken.zIndex === targetToken.zIndex) {
                        selectedToken.zIndex += 1;
                    }
                }
            } else {
                if (curIdx > 0) {
                    const targetToken = sortedTokens[curIdx - 1];
                    const temp = selectedToken.zIndex || 0;
                    selectedToken.zIndex = targetToken.zIndex || 0;
                    targetToken.zIndex = temp;
                    // If they had the exact same zIndex originally, make sure selected is lower
                    if (selectedToken.zIndex === targetToken.zIndex) {
                        selectedToken.zIndex -= 1;
                    }
                }
            }
        }

        // Broadcast token changes to server and render
        window.emitTokenUpdates(tokens);
        renderAll();
    }

    function showMassRollContextMenu(tokenIds, clientX, clientY) {
        // Remove any existing menu first
        const oldMenu = document.getElementById('vtt-token-context-menu');
        if (oldMenu) oldMenu.remove();

        // Create container
        const menu = document.createElement('div');
        menu.id = 'vtt-token-context-menu';
        menu.className = 'vtt-token-context-menu';
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;

        // Ability List
        const abilities = [
            { key: 'str', label: 'Strength' },
            { key: 'dex', label: 'Dexterity' },
            { key: 'con', label: 'Constitution' },
            { key: 'int', label: 'Intelligence' },
            { key: 'wis', label: 'Wisdom' },
            { key: 'cha', label: 'Charisma' }
        ];

        // Skill List with standard 5e skills & associated abilities
        const skills = [
            { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
            { key: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
            { key: 'arcana', label: 'Arcana', ability: 'int' },
            { key: 'athletics', label: 'Athletics', ability: 'str' },
            { key: 'deception', label: 'Deception', ability: 'cha' },
            { key: 'history', label: 'History', ability: 'int' },
            { key: 'insight', label: 'Insight', ability: 'wis' },
            { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
            { key: 'investigation', label: 'Investigation', ability: 'int' },
            { key: 'medicine', label: 'Medicine', ability: 'wis' },
            { key: 'nature', label: 'Nature', ability: 'int' },
            { key: 'perception', label: 'Perception', ability: 'wis' },
            { key: 'performance', label: 'Performance', ability: 'cha' },
            { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
            { key: 'religion', label: 'Religion', ability: 'int' },
            { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
            { key: 'stealth', label: 'Stealth', ability: 'dex' },
            { key: 'survival', label: 'Survival', ability: 'wis' }
        ];

        // Header showing Mass Roll title
        let html = `
            <div class="vtt-token-menu-header">
                <i class="fa-solid fa-dice-d20"></i> Mass Roll (${tokenIds.length} Tokens)
            </div>
            <div class="vtt-token-menu-item" id="menu-apply-damage">
                <span><i class="fa-solid fa-heart-crack item-icon"></i> Apply Damage</span>
            </div>
            <div class="vtt-token-menu-item" id="menu-roll-init">
                <span><i class="fa-solid fa-swords item-icon"></i> Roll Initiative for All</span>
            </div>
            <div class="vtt-token-menu-divider"></div>
        `;

        // 1. Ability Checks Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-arrows-to-eye item-icon"></i> Ability Checks</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled">
        `;
        abilities.forEach(ab => {
            html += `
                <div class="vtt-submenu-item menu-roll-ability" data-ability="${ab.key}" data-label="${ab.label}">
                    <span>${ab.label}</span>
                </div>
            `;
        });
        html += `
                    </div>
                </div>
            </div>
        `;

        // 2. Saving Throws Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-shield-halved item-icon"></i> Saving Throws</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled">
        `;
        abilities.forEach(ab => {
            html += `
                <div class="vtt-submenu-item menu-roll-save" data-ability="${ab.key}" data-label="${ab.label}">
                    <span>${ab.label}</span>
                </div>
            `;
        });
        html += `
                    </div>
                </div>
            </div>
        `;

        // 3. Skill Checks Submenu
        html += `
            <div class="vtt-token-menu-item">
                <span><i class="fa-solid fa-wand-magic-sparkles item-icon"></i> Skill Checks</span>
                <i class="fa-solid fa-chevron-right chevron-icon"></i>
                <div class="vtt-token-submenu">
                    <div class="vtt-token-submenu-list scroll-styled">
        `;
        skills.forEach(sk => {
            html += `
                <div class="vtt-submenu-item menu-roll-skill" data-skill="${sk.key}" data-label="${sk.label}">
                    <span>${sk.label}</span>
                </div>
            `;
        });
        html += `
                    </div>
                </div>
            </div>
        `;

        menu.innerHTML = html;
        document.body.appendChild(menu);

        // Position adjustment to avoid screen edge clipping
        const menuRect = menu.getBoundingClientRect();
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        let adjustedX = clientX;
        let adjustedY = clientY;
        if (clientX + menuRect.width > screenW) {
            adjustedX = screenW - menuRect.width - 10;
        }
        if (clientY + menuRect.height > screenH) {
            adjustedY = screenH - menuRect.height - 10;
        }
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;

        const getResolvedMonsterData = (t) => {
            if (t.monsterData) return t.monsterData;
            if (t.characterId && window.VTT?.campaignState?.characters?.[t.characterId]) {
                const char = window.VTT.campaignState.characters[t.characterId];
                if (char.isCompanion && char.monsterData) return char.monsterData;
            }
            return null;
        };

        // Helper to prompt for fallback modifier for tokens that don't have stats, but do it ONCE
        const getFallbackModIfNeeded = (tokensList, checkLabel) => {
            const hasStatless = tokensList.some(t => !getResolvedMonsterData(t) && !(t.isPlayer && t.characterId && window.VTT?.campaignState?.characters?.[t.characterId]));
            if (!hasStatless) return 0;
            
            const input = prompt(`Enter custom modifier for tokens lacking a stat block (for ${checkLabel}):`, "0");
            if (input === null) return null; // Cancelled
            return parseInt(input) || 0;
        };

        // Wire click handlers

        // Apply Damage
        const btnApplyDamage = menu.querySelector('#menu-apply-damage');
        if (btnApplyDamage) {
            btnApplyDamage.addEventListener('click', () => {
                showApplyDamageModal(tokenIds);
                menu.remove();
            });
        }

        // Initiative
        menu.querySelector('#menu-roll-init').addEventListener('click', () => {
            // Check if any token is stat-less
            const targetTokens = tokenIds.map(id => tokens[id]);
            const fallbackMod = getFallbackModIfNeeded(targetTokens, "Initiative");
            if (fallbackMod === null) { menu.remove(); return; }

            targetTokens.forEach(t => {
                let formula = '';
                const mData = getResolvedMonsterData(t);
                if (mData) {
                    const score = mData.dex || 10;
                    let mod = Math.floor((score - 10) / 2);
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                } else if (t.isPlayer && t.characterId && window.VTT?.campaignState?.characters?.[t.characterId]) {
                    const char = window.VTT.campaignState.characters[t.characterId];
                    formula = getPcRollFormula(char, 'initiative');
                } else {
                    let mod = fallbackMod;
                    formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                }
                const label = `${t.name}: Initiative`;
                const resultTotal = rollFromToken(formula, label, t.id);

                if (window.VTT?.chatEngine) {
                    window.VTT.chatEngine.addToInitiative(t.name, resultTotal, t.id);
                }
            });
            menu.remove();
        });

        // Abilities
        menu.querySelectorAll('.menu-roll-ability').forEach(item => {
            item.addEventListener('click', () => {
                const abKey = item.dataset.ability;
                const abLabel = item.dataset.label;

                const targetTokens = tokenIds.map(id => tokens[id]);
                const fallbackMod = getFallbackModIfNeeded(targetTokens, `${abLabel} Check`);
                if (fallbackMod === null) { menu.remove(); return; }

                targetTokens.forEach(t => {
                    let formula = '';
                    const mData = getResolvedMonsterData(t);
                    if (mData) {
                        const score = mData[abKey] || 10;
                        let mod = Math.floor((score - 10) / 2);
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    } else if (t.isPlayer && t.characterId && window.VTT?.campaignState?.characters?.[t.characterId]) {
                        const char = window.VTT.campaignState.characters[t.characterId];
                        formula = getPcRollFormula(char, 'ability', abKey);
                    } else {
                        let mod = fallbackMod;
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    }
                    const label = `${t.name}: ${abLabel.toUpperCase()} Check`;
                    rollFromToken(formula, label, t.id);
                });
                menu.remove();
            });
        });

        // Saves
        menu.querySelectorAll('.menu-roll-save').forEach(item => {
            item.addEventListener('click', () => {
                const abKey = item.dataset.ability;
                const abLabel = item.dataset.label;

                const targetTokens = tokenIds.map(id => tokens[id]);
                const fallbackMod = getFallbackModIfNeeded(targetTokens, `${abLabel} Save`);
                if (fallbackMod === null) { menu.remove(); return; }

                targetTokens.forEach(t => {
                    let formula = '';
                    const mData = getResolvedMonsterData(t);
                    if (mData) {
                        const score = mData[abKey] || 10;
                        let mod = Math.floor((score - 10) / 2);
                        if (mData.save && mData.save[abKey] !== undefined) {
                            mod = parseInt(mData.save[abKey]);
                        }
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    } else if (t.isPlayer && t.characterId && window.VTT?.campaignState?.characters?.[t.characterId]) {
                        const char = window.VTT.campaignState.characters[t.characterId];
                        formula = getPcRollFormula(char, 'save', abKey);
                    } else {
                        let mod = fallbackMod;
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    }
                    const label = `${t.name}: ${abLabel.toUpperCase()} Saving Throw`;
                    rollFromToken(formula, label, t.id);
                });
                menu.remove();
            });
        });

        // Skills
        menu.querySelectorAll('.menu-roll-skill').forEach(item => {
            item.addEventListener('click', () => {
                const skKey = item.dataset.skill;
                const skLabel = item.dataset.label;

                const targetTokens = tokenIds.map(id => tokens[id]);
                const fallbackMod = getFallbackModIfNeeded(targetTokens, `${skLabel} Check`);
                if (fallbackMod === null) { menu.remove(); return; }

                const skillObj = skills.find(s => s.key === skKey);

                targetTokens.forEach(t => {
                    let formula = '';
                    const mData = getResolvedMonsterData(t);
                    if (mData) {
                        const score = mData[skillObj.ability] || 10;
                        let mod = Math.floor((score - 10) / 2);
                        if (mData.skill && mData.skill[skKey] !== undefined) {
                            mod = parseInt(mData.skill[skKey]);
                        }
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    } else if (t.isPlayer && t.characterId && window.VTT?.campaignState?.characters?.[t.characterId]) {
                        const char = window.VTT.campaignState.characters[t.characterId];
                        formula = getPcRollFormula(char, 'skill', skKey);
                    } else {
                        let mod = fallbackMod;
                        formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
                    }
                    const label = `${t.name}: ${skLabel} Check`;
                    rollFromToken(formula, label, t.id);
                });
                menu.remove();
            });
        });
    }

    function showAddCustomConditionModal(tokenId) {
        const oldModal = document.getElementById('vtt-add-custom-condition-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'vtt-add-custom-condition-modal';
        modal.className = 'vtt-modal';
        
        const presetColors = [
            '#ff4444', '#ff8800', '#ffcc00', '#00C851', '#33b5e5', '#2BBBAD',
            '#4285F4', '#aa66cc', '#ffbb33', '#007E33', '#CC0000', '#ffffff'
        ];
        
        modal.innerHTML = `
            <div class="vtt-modal-content" style="max-width: 320px;">
                <div class="vtt-modal-header">
                    <h3><i class="fa-solid fa-paintbrush"></i> Custom Condition</h3>
                    <button class="vtt-modal-close"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="vtt-modal-body">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Label</label>
                        <input type="text" id="custom-condition-label" class="vtt-input" placeholder="e.g. Bleeding" style="width: 100%;" autofocus>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Color</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;" id="custom-condition-presets">
                            ${presetColors.map(c => `<div class="preset-color" data-color="${c}" style="width: 24px; height: 24px; border-radius: 50%; background: ${c}; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s;"></div>`).join('')}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label>Custom:</label>
                            <input type="color" id="custom-condition-color" value="#ff4444" style="cursor: pointer;">
                        </div>
                    </div>
                </div>
                <div class="vtt-modal-footer">
                    <button class="vtt-btn vtt-btn-secondary" id="btn-cancel-custom-condition">Cancel</button>
                    <button class="vtt-btn vtt-btn-primary" id="btn-apply-custom-condition">Add Condition</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Styling the modal appropriately (overlay behavior in CSS handles rest)
        modal.style.display = 'flex';
        
        const inputLabel = modal.querySelector('#custom-condition-label');
        const inputColor = modal.querySelector('#custom-condition-color');
        const btnClose = modal.querySelector('.vtt-modal-close');
        const btnCancel = modal.querySelector('#btn-cancel-custom-condition');
        const btnApply = modal.querySelector('#btn-apply-custom-condition');
        const presets = modal.querySelectorAll('.preset-color');

        let selectedColor = presetColors[0];
        const updateSelection = () => {
            presets.forEach(p => {
                p.style.borderColor = p.dataset.color === selectedColor ? 'var(--color-gold-base)' : 'transparent';
                p.style.transform = p.dataset.color === selectedColor ? 'scale(1.2)' : 'scale(1)';
            });
            inputColor.value = selectedColor;
        };
        updateSelection();

        presets.forEach(p => {
            p.addEventListener('click', () => {
                selectedColor = p.dataset.color;
                updateSelection();
            });
        });

        inputColor.addEventListener('input', (e) => {
            selectedColor = e.target.value;
            presets.forEach(p => {
                p.style.borderColor = 'transparent';
                p.style.transform = 'scale(1)';
            });
        });

        const close = () => modal.remove();
        btnClose.addEventListener('click', close);
        btnCancel.addEventListener('click', close);

        const apply = () => {
            const label = inputLabel.value.trim();
            if (!label) {
                alert("Please enter a condition label.");
                return;
            }
            const activeToken = tokens[tokenId];
            if (activeToken) {
                if (!activeToken.conditions) activeToken.conditions = [];
                activeToken.conditions.push({
                    name: label,
                    color: selectedColor,
                    isCustom: true
                });
                window.emitTokenUpdates(tokens);
                renderAll();
            }
            close();
        };

        btnApply.addEventListener('click', apply);
        inputLabel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') apply();
        });
        
        // Select text automatically
        inputLabel.select();
    }

    function showApplyDamageModal(tokenIds) {
        const oldModal = document.getElementById('vtt-apply-damage-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'vtt-apply-damage-modal';
        modal.className = 'vtt-modal';
        
        const damageTypes = [
            'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 
            'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
        ];
        
        modal.innerHTML = `
            <div class="vtt-modal-content" style="max-width: 300px;">
                <div class="vtt-modal-header">
                    <h3><i class="fa-solid fa-heart-crack"></i> Apply Damage (${tokenIds.length} Token${tokenIds.length > 1 ? 's' : ''})</h3>
                    <button class="vtt-modal-close"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="vtt-modal-body">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Damage Amount</label>
                        <input type="number" id="apply-damage-amount" class="vtt-input" value="0" min="0" style="width: 100%;" autofocus>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px;">Damage Type</label>
                        <select id="apply-damage-type" class="vtt-input" style="width: 100%;">
                            <option value="untyped">Untyped</option>
                            ${damageTypes.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="vtt-btn vtt-btn-danger" id="btn-apply-full" style="flex: 1;"><i class="fa-solid fa-droplet"></i> Full</button>
                        <button class="vtt-btn vtt-btn-warning" id="btn-apply-half" style="flex: 1;"><i class="fa-solid fa-shield-halved"></i> Half</button>
                        <button class="vtt-btn vtt-btn-success" id="btn-apply-heal" style="flex: 1;"><i class="fa-solid fa-heart"></i> Heal</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handlers
        const closeBtn = modal.querySelector('.vtt-modal-close');
        closeBtn.addEventListener('click', () => modal.remove());

        const inputEl = modal.querySelector('#apply-damage-amount');
        const selectEl = modal.querySelector('#apply-damage-type');

        const applyFn = (mode) => {
            const amount = parseInt(inputEl.value) || 0;
            if (amount > 0) {
                applyDamageToTokens(tokenIds, amount, selectEl.value, mode);
            }
            modal.remove();
        };

        modal.querySelector('#btn-apply-full').addEventListener('click', () => applyFn('full'));
        modal.querySelector('#btn-apply-half').addEventListener('click', () => applyFn('half'));
        modal.querySelector('#btn-apply-heal').addEventListener('click', () => applyFn('heal'));
        
        // Enter key to apply full
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applyFn('full');
        });
    }

    function _hasResistanceType(arr, dmgType) {
        if (!arr || !Array.isArray(arr)) return false;
        return arr.some(r => {
            if (typeof r === 'string') return r.toLowerCase() === dmgType.toLowerCase();
            if (typeof r === 'object' && r.resist) {
                return _hasResistanceType(r.resist, dmgType);
            }
            if (typeof r === 'object' && r.immune) {
                return _hasResistanceType(r.immune, dmgType);
            }
            if (typeof r === 'object' && r.vulnerable) {
                return _hasResistanceType(r.vulnerable, dmgType);
            }
            return false;
        });
    }

    function applyDamageToTokens(tokenIds, amount, type, mode) {
        if (!vtt.socket || tokenIds.length === 0) return;

        let appliedCount = 0;
        
        tokenIds.forEach(tokenId => {
            const token = tokens[tokenId];
            if (!token) return;

            let finalAmount = amount;

            if (mode !== 'heal' && type !== 'untyped' && token.monsterData) {
                const md = token.monsterData;
                let multiplier = 1;

                if (md.immune && _hasResistanceType(md.immune, type)) multiplier = 0;
                else if (md.vulnerable && _hasResistanceType(md.vulnerable, type)) multiplier = 2;
                else if (md.resist && _hasResistanceType(md.resist, type)) multiplier = 0.5;

                finalAmount = Math.floor(finalAmount * multiplier);
            } else if (mode !== 'heal' && type !== 'untyped' && token.isPlayer && token.characterId && window.VTT?.campaignState?.characters?.[token.characterId]) {
                const char = window.VTT.campaignState.characters[token.characterId];
                let multiplier = 1;
                if (char.immune && char.immune.includes(type)) multiplier = 0;
                else if (char.vulnerable && char.vulnerable.includes(type)) multiplier = 2;
                else if (char.resist && char.resist.includes(type)) multiplier = 0.5;
                finalAmount = Math.floor(finalAmount * multiplier);
            }

            if (mode === 'half') {
                finalAmount = Math.floor(finalAmount / 2);
            }

            if (mode === 'heal') {
                if (token.hp !== undefined && token.maxHp !== undefined) {
                    token.hp = Math.min(token.hp + finalAmount, token.maxHp);
                    appliedCount++;
                }
            } else {
                if (token.hp !== undefined) {
                    let tempDamage = 0;
                    if (token.tempHp && token.tempHp > 0) {
                        tempDamage = Math.min(token.tempHp, finalAmount);
                        token.tempHp -= tempDamage;
                        finalAmount -= tempDamage;
                    }
                    if (finalAmount > 0) {
                        token.hp = Math.max(0, token.hp - finalAmount);
                    }
                    appliedCount++;
                }
            }
        });

        if (appliedCount > 0) {
            window.emitTokenUpdates(tokens);
            renderAll();
        }
    }

    function rollFromToken(formula, label, tokenId) {
        if (!vtt.socket) return 0;

        const regex = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i;
        const match = formula.match(regex);
        let total = 0;
        let diceList = [];
        let finalModifier = 0;

        if (match) {
            const count = parseInt(match[1]);
            const faces = parseInt(match[2]);
            const sign = match[3] || '+';
            const modifier = match[4] ? parseInt(match[4]) : 0;
            let subtotal = 0;

            for (let i = 0; i < count; i++) {
                const val = Math.floor(Math.random() * faces) + 1;
                diceList.push({ faces, val });
                subtotal += val;
            }

            finalModifier = sign === '-' ? -modifier : modifier;
            total = subtotal + finalModifier;
        }

        const rollResult = {
            formula,
            count: 1,
            faces: 20,
            diceList,
            modifier: finalModifier,
            total
        };

        const rollVisibility = document.getElementById('config-roll-visibility')?.value || 'public';
        const msgText = `[${label}] rolls **${formula}**`;

        if (rollVisibility === 'private' && vtt.role === 'GM') {
            // Whisper only to this GM
            vtt.socket.emit('chat:whisper', {
                to: vtt.username,
                text: msgText,
                roll: rollResult
            });
        } else {
            vtt.socket.emit('chat:msg', {
                text: msgText,
                roll: rollResult
            });
        }

        return total;
    }

    // Close token context menu on window events
    const closeTokenMenuOnOutsideClick = (e) => {
        const menu = document.getElementById('vtt-token-context-menu');
        if (menu && !menu.contains(e.target)) {
            menu.remove();
        }
    };
    window.addEventListener('click', closeTokenMenuOnOutsideClick);
    window.addEventListener('contextmenu', closeTokenMenuOnOutsideClick);

    window.addEventListener('keydown', (e) => {
        if (e.key === '`' || e.key === '~') {
            isLayerShortcutModifierDown = true;
        }

        const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;

        if (isLayerShortcutModifierDown && vtt.role === 'GM' && !isInputActive) {
            const layerMap = {
                '1': 'token',
                '2': 'gm',
                '3': 'lighting',
                '4': 'notes',
                '5': 'map'
            };

            if (layerMap[e.key]) {
                const targetLayer = layerMap[e.key];
                const layerPanel = document.getElementById('panel-layers-config');
                if (layerPanel) {
                    const layerBtns = layerPanel.querySelectorAll('.layer-btn');
                    layerBtns.forEach(lb => {
                        if (lb.getAttribute('data-layer') === targetLayer) {
                            lb.click();
                        }
                    });
                }
            }
        }

        if (e.key === 'Escape') {
            const menu = document.getElementById('vtt-token-context-menu');
            if (menu) menu.remove();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTokenIds.size > 0 && !isInputActive) {
            selectedTokenIds.forEach(id => delete tokens[id]);
            selectedTokenIds.clear();
            tokenDragOriginalPositions = {};
            window.emitTokenUpdates(tokens);
            renderAll();
        }
        
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId && !isInputActive) {
            delete shapes[selectedShapeId];
            selectedShapeId = null;
            selectedShapeComponent = null;
            vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
            renderAll();
        }

        if (!isInputActive && selectedTokenIds.size > 0) {
            const k = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(k)) {
                let updated = false;
                selectedTokenIds.forEach(id => {
                    const token = tokens[id];
                    if (token) {
                        if (k === 'w' && token.flipY !== false) { token.flipY = false; updated = true; }
                        else if (k === 's' && token.flipY !== true) { token.flipY = true; updated = true; }
                        else if (k === 'a' && token.flipX !== true) { token.flipX = true; updated = true; }
                        else if (k === 'd' && token.flipX !== false) { token.flipX = false; updated = true; }
                    }
                });
                if (updated) {
                    if (vtt.socket) window.emitTokenUpdates(tokens);
                    renderAll();
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === '`' || key === '~') {
            isLayerShortcutModifierDown = false;
        }
    });

    function setupHpSettingsControls() {
        if (vtt.role !== 'GM') return;
        
        const controls = [
            { id: 'config-player-monster-hp-visible', key: 'playerMonsterHpBarVisible', type: 'select' },
            { id: 'config-player-monster-hp-num-visible', key: 'playerMonsterHpNumVisible', type: 'checkbox' },
            { id: 'config-player-monster-name-visible', key: 'playerMonsterNameVisible', type: 'select' },
            { id: 'config-player-player-hp-visible', key: 'playerPlayerHpBarVisible', type: 'select' },
            { id: 'config-player-player-hp-num-visible', key: 'playerPlayerHpNumVisible', type: 'checkbox' },
            { id: 'config-player-player-name-visible', key: 'playerPlayerNameVisible', type: 'select' },
            { id: 'config-player-temp-hp-visible', key: 'playerTempHpBarVisible', type: 'select' },
            { id: 'config-player-temp-hp-num-visible', key: 'playerTempHpNumVisible', type: 'checkbox' },
            { id: 'config-gm-monster-hp-visible', key: 'gmMonsterHpBarVisible', type: 'select' },
            { id: 'config-gm-monster-hp-num-visible', key: 'gmMonsterHpNumVisible', type: 'checkbox' },
            { id: 'config-gm-monster-name-visible', key: 'gmMonsterNameVisible', type: 'select' },
            { id: 'config-gm-player-hp-visible', key: 'gmPlayerHpBarVisible', type: 'select' },
            { id: 'config-gm-player-hp-num-visible', key: 'gmPlayerHpNumVisible', type: 'checkbox' },
            { id: 'config-gm-player-name-visible', key: 'gmPlayerNameVisible', type: 'select' },
            { id: 'config-gm-temp-hp-visible', key: 'gmTempHpBarVisible', type: 'select' },
            { id: 'config-gm-temp-hp-num-visible', key: 'gmTempHpNumVisible', type: 'checkbox' },
            { id: 'config-temp-hp-style', key: 'tempHpBarStyle', type: 'select' }
        ];
        
        controls.forEach(c => {
            const el = document.getElementById(c.id);
            if (!el) return;
            el.addEventListener('change', () => {
                const val = c.type === 'checkbox' ? el.checked : el.value;
                campaignSettings[c.key] = val;
                
                vtt.socket.emit('settings:update', { settings: campaignSettings });
                renderAll();
            });
        });
    }

    function syncHpSettingsInputs() {
        const controls = [
            { id: 'config-player-monster-hp-visible', key: 'playerMonsterHpBarVisible', type: 'select' },
            { id: 'config-player-monster-hp-num-visible', key: 'playerMonsterHpNumVisible', type: 'checkbox' },
            { id: 'config-player-monster-name-visible', key: 'playerMonsterNameVisible', type: 'select' },
            { id: 'config-player-player-hp-visible', key: 'playerPlayerHpBarVisible', type: 'select' },
            { id: 'config-player-player-hp-num-visible', key: 'playerPlayerHpNumVisible', type: 'checkbox' },
            { id: 'config-player-player-name-visible', key: 'playerPlayerNameVisible', type: 'select' },
            { id: 'config-player-temp-hp-visible', key: 'playerTempHpBarVisible', type: 'select' },
            { id: 'config-player-temp-hp-num-visible', key: 'playerTempHpNumVisible', type: 'checkbox' },
            { id: 'config-gm-monster-hp-visible', key: 'gmMonsterHpBarVisible', type: 'select' },
            { id: 'config-gm-monster-hp-num-visible', key: 'gmMonsterHpNumVisible', type: 'checkbox' },
            { id: 'config-gm-monster-name-visible', key: 'gmMonsterNameVisible', type: 'select' },
            { id: 'config-gm-player-hp-visible', key: 'gmPlayerHpBarVisible', type: 'select' },
            { id: 'config-gm-player-hp-num-visible', key: 'gmPlayerHpNumVisible', type: 'checkbox' },
            { id: 'config-gm-player-name-visible', key: 'gmPlayerNameVisible', type: 'select' },
            { id: 'config-gm-temp-hp-visible', key: 'gmTempHpBarVisible', type: 'select' },
            { id: 'config-gm-temp-hp-num-visible', key: 'gmTempHpNumVisible', type: 'checkbox' },
            { id: 'config-temp-hp-style', key: 'tempHpBarStyle', type: 'select' }
        ];
        
        controls.forEach(c => {
            const el = document.getElementById(c.id);
            if (!el) return;
            const val = campaignSettings[c.key];
            if (val !== undefined) {
                if (c.type === 'checkbox') el.checked = !!val;
                else el.value = val;
            }
        });
    }

    
    
    function getCanvasMouseCoords(e) {
        // Use viewport rect + explicit pan/zoom math so there's no ambiguity.
        // (canvasInteraction.getBoundingClientRect().left === viewport.left + panX after CSS transform,
        //  which would require NOT subtracting panX — using viewport rect makes the intent clear.)
        const vr = viewport.getBoundingClientRect();
        const x = (e.clientX - vr.left - panX) / zoom;
        const y = (e.clientY - vr.top - panY) / zoom;
        return { x, y };
    }

    // ── GM Token Hover Tooltip ────────────────────────────────────────────────

    // Inject tooltip CSS once into <head>
    (function injectGmTooltipStyles() {
        if (document.getElementById('vtt-gm-tooltip-styles')) return;
        const style = document.createElement('style');
        style.id = 'vtt-gm-tooltip-styles';
        style.textContent = `
            #vtt-gm-token-tooltip {
                position: fixed;
                z-index: 99999;
                width: 210px;
                background: rgba(12, 15, 24, 0.97);
                border: 1px solid rgba(212, 175, 55, 0.30);
                border-radius: 10px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.03) inset;
                font-family: var(--font-primary, 'Inter', sans-serif);
                font-size: 12px;
                color: var(--color-text-primary, #e8e8ec);
                pointer-events: none;
                user-select: none;
                backdrop-filter: blur(8px);
                animation: gmTooltipFadeIn 0.18s cubic-bezier(0.22,1,0.36,1) forwards;
                transform-origin: top left;
            }
            @keyframes gmTooltipFadeIn {
                from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
            #vtt-gm-token-tooltip .gm-tip-header {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 9px 12px 7px;
                border-bottom: 1px solid rgba(212,175,55,0.15);
                color: #d4af37;
                font-weight: 700;
                font-size: 12.5px;
                font-family: var(--font-heading, 'Cinzel', serif);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #vtt-gm-token-tooltip .gm-tip-header i {
                font-size: 11px;
                flex-shrink: 0;
                opacity: 0.9;
            }
            #vtt-gm-token-tooltip .gm-tip-stats {
                display: flex;
                gap: 0;
                padding: 8px 12px 8px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            #vtt-gm-token-tooltip .gm-tip-stat {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }
            #vtt-gm-token-tooltip .gm-tip-stat:not(:last-child) {
                border-right: 1px solid rgba(255,255,255,0.06);
            }
            #vtt-gm-token-tooltip .gm-tip-stat-label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 9.5px;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: rgba(212,175,55,0.7);
            }
            #vtt-gm-token-tooltip .gm-tip-stat-label i {
                font-size: 8.5px;
            }
            #vtt-gm-token-tooltip .gm-tip-stat-value {
                font-size: 18px;
                font-weight: 800;
                color: #ffffff;
                line-height: 1;
                font-variant-numeric: tabular-nums;
                text-shadow: 0 1px 6px rgba(0,0,0,0.5);
            }
            #vtt-gm-token-tooltip .gm-tip-stat-value.na {
                font-size: 14px;
                color: rgba(255,255,255,0.3);
            }
            #vtt-gm-token-tooltip .gm-tip-conditions {
                padding: 7px 12px 9px;
            }
            #vtt-gm-token-tooltip .gm-tip-cond-label {
                font-size: 9px;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.3);
                margin-bottom: 6px;
            }
            #vtt-gm-token-tooltip .gm-tip-cond-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            #vtt-gm-token-tooltip .gm-tip-cond-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: rgba(220,53,69,0.18);
                border: 1px solid rgba(220,53,69,0.35);
                border-radius: 20px;
                padding: 3px 8px 3px 6px;
                font-size: 10.5px;
                font-weight: 600;
                color: #e88;
                white-space: nowrap;
            }
            #vtt-gm-token-tooltip .gm-tip-cond-pill i {
                font-size: 9px;
                opacity: 0.85;
            }
            #vtt-gm-token-tooltip .gm-tip-no-cond {
                font-size: 10px;
                color: rgba(255,255,255,0.2);
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    })();

    // Resolve AC for a token (monster or player character)
    function getTokenAC(token) {
        if (token.monsterData) {
            const ac = token.monsterData.ac;
            if (Array.isArray(ac) && ac.length > 0) {
                const entry = ac[0];
                return typeof entry === 'object' && entry !== null ? (entry.ac ?? null) : entry;
            }
            if (typeof ac === 'number') return ac;
        }
        if (token.characterId) {
            const char = vtt.campaignState?.characters?.[token.characterId];
            if (char?.ac !== undefined && char.ac !== null) return char.ac;
        }
        return null;
    }

    // Resolve Passive Perception for a token
    // PP = 10 + Wis modifier [+ proficiency bonus if proficient] [+ proficiency again if expert] [+ custom skill mod]
    function getTokenPP(token) {
        // Monster: use the stored passive field directly
        if (token.monsterData?.passive !== undefined) return token.monsterData.passive;

        // Player character: calculate from stats
        if (token.characterId) {
            const char = vtt.campaignState?.characters?.[token.characterId];
            if (!char || !char.stats) return null;

            const getMod = (score) => Math.floor((score - 10) / 2);
            const profBonus = Math.floor(((char.level || 1) - 1) / 4) + 2;

            let pp = 10 + getMod(char.stats.wis || 10);

            // Add Perception proficiency / expertise
            if (char.skills && char.skills['Perception']) pp += profBonus;
            if (char.expertise && char.expertise['Perception']) pp += profBonus;

            // Add any custom Perception skill modifier
            const customMod = (char.skillMods && char.skillMods['Perception'])
                ? parseInt(char.skillMods['Perception']) : 0;
            if (!isNaN(customMod)) pp += customMod;

            return pp;
        }
        return null;
    }

    function showGmTokenTooltip(tokenId) {
        const token = tokens[tokenId];
        if (!token || vtt.role !== 'GM') return;

        hideGmTokenTooltip(); // Remove any existing tooltip first

        gmTokenTooltipTokenId = tokenId;

        const ac = getTokenAC(token);
        const pp = getTokenPP(token);
        const conditions = Array.isArray(token.conditions) ? token.conditions : [];
        const hasConditions = conditions.length > 0;

        const acDisplay = ac !== null && ac !== undefined ? String(ac) : null;
        const ppDisplay = pp !== null && pp !== undefined ? String(pp) : null;

        // Build conditions HTML
        let conditionsHtml = '';
        if (hasConditions) {
            const pills = conditions.map(c => {
                if (c.isCustom) {
                    return `<div class="gm-tip-cond-pill" title="${c.name}" style="border-color: ${c.color}; color: ${c.color};">
                        <i class="fa-solid fa-circle"></i>
                        <span>${c.name}</span>
                    </div>`;
                }
                const iconClass = CONDITION_ICONS[c.name] || 'fa-circle-exclamation';
                return `<div class="gm-tip-cond-pill" title="${c.name}">
                    <i class="fa-solid ${iconClass}"></i>
                    <span>${c.name}</span>
                </div>`;
            }).join('');
            conditionsHtml = `
                <div class="gm-tip-conditions">
                    <div class="gm-tip-cond-label">Conditions</div>
                    <div class="gm-tip-cond-pills">${pills}</div>
                </div>`;
        }

        const tokenTypeIcon = token.isPlayer ? 'fa-user' : 'fa-dragon';

        const tooltip = document.createElement('div');
        tooltip.id = 'vtt-gm-token-tooltip';
        tooltip.innerHTML = `
            <div class="gm-tip-header">
                <i class="fa-solid ${tokenTypeIcon}"></i>
                <span title="${token.name}">${token.name || 'Unknown'}</span>
            </div>
            <div class="gm-tip-stats">
                <div class="gm-tip-stat">
                    <div class="gm-tip-stat-label"><i class="fa-solid fa-shield-halved"></i> AC</div>
                    <div class="gm-tip-stat-value ${acDisplay === null ? 'na' : ''}">${acDisplay !== null ? acDisplay : '—'}</div>
                </div>
                <div class="gm-tip-stat">
                    <div class="gm-tip-stat-label"><i class="fa-solid fa-eye"></i> PP</div>
                    <div class="gm-tip-stat-value ${ppDisplay === null ? 'na' : ''}">${ppDisplay !== null ? ppDisplay : '—'}</div>
                </div>
            </div>
            ${conditionsHtml}
        `;

        document.body.appendChild(tooltip);

        // Position the tooltip anchored to the token on-screen
        _positionGmTooltip(tooltip, token);
    }

    function _positionGmTooltip(tooltip, token) {
        const vr = viewport.getBoundingClientRect();
        const { drawW, drawH, tokenRadius } = getTokenDrawDimensions(token);

        // Token center in screen/viewport space
        const cx = (token.x + drawW / 2) * zoom + panX + vr.left;
        const cy = (token.y + drawH / 2) * zoom + panY + vr.top;

        // Token radius in screen pixels
        const screenRadius = tokenRadius * zoom;

        const tipW = 214; // matches CSS width + padding
        const tipH = tooltip.offsetHeight || 160;

        // Try right side first, fall back to left
        let left = cx + screenRadius + 14;
        if (left + tipW > window.innerWidth - 8) {
            left = cx - screenRadius - tipW - 14;
        }
        // Centre vertically on token
        let top = cy - tipH / 2;
        top = Math.max(8, Math.min(top, window.innerHeight - tipH - 8));

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top  = `${Math.round(top)}px`;
    }

    function hideGmTokenTooltip() {
        if (gmTokenTooltipTimeout) {
            clearTimeout(gmTokenTooltipTimeout);
            gmTokenTooltipTimeout = null;
        }
        gmTokenTooltipTokenId = null;
        const existing = document.getElementById('vtt-gm-token-tooltip');
        if (existing) existing.remove();
    }


    function setupViewportControls() {

        if (!canvasInteraction) return;
        
        canvasInteraction.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            
            // Use viewport rect so mouse coords are viewport-relative.
            // This avoids double-subtracting panX (canvas rect already bakes panX in).
            const vr = viewport.getBoundingClientRect();
            const mouseX = e.clientX - vr.left;
            const mouseY = e.clientY - vr.top;
            
            // Canvas coordinate under the mouse (must stay fixed after zoom)
            const targetX = (mouseX - panX) / zoom;
            const targetY = (mouseY - panY) / zoom;
            
            zoom *= delta;
            
            panX = mouseX - targetX * zoom;
            panY = mouseY - targetY * zoom;
            
            updateContainerTransform();
            renderAll();
        });
        
        canvasInteraction.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (hasPanned || localIsMeasuring || localIsShaping || isTokenMeasuring) return;

            const mouse = getCanvasMouseCoords(e);
            
            // Note Context Menu
            if (vtt.role === 'GM' && activeLayer === 'notes' && activeTool === 'select') {
                const clickedNoteId = getNoteAtCoord(mouse.x, mouse.y);
                if (clickedNoteId) {
                    showNoteContextMenu(clickedNoteId, e.clientX, e.clientY);
                } else {
                    showAddNoteContextMenu(mouse.x, mouse.y, e.clientX, e.clientY);
                }
                return;
            }

            const token = getTokenAtPoint(mouse);
            if (token) {
                e.stopPropagation();
                if (selectedTokenIds.has(token.id) && selectedTokenIds.size > 1) {
                    showMassRollContextMenu(Array.from(selectedTokenIds), e.clientX, e.clientY);
                } else {
                    showTokenContextMenu(token.id, e.clientX, e.clientY);
                }
            }
        });
    }

    function isTokenControlledByPlayer(token) {
        if (!token) return false;
        if (vtt.role === 'GM') return true;
        if (token.ownerUsername === vtt.username) return true;
        if (token.characterId) {
            const char = vtt.campaignState?.characters?.[token.characterId];
            if (char && char.assignedPlayers) {
                return char.assignedPlayers.includes(vtt.username) || char.assignedPlayers.includes('*');
            }
        }
        return false;
    }

    function getTokenAtPoint(mouse, requireControl = true) {
        const tokenIds = Object.keys(tokens || {});
        for (let i = tokenIds.length - 1; i >= 0; i--) {
            const token = tokens[tokenIds[i]];
            if (!token) continue;
            if (token.layer !== activeLayer && activeLayer !== 'gm') continue;
            if (token.layer === 'gm' && vtt.role !== 'GM') continue;
            if (requireControl && !isTokenControlledByPlayer(token)) continue;

            const { drawW, drawH } = getTokenDrawDimensions(token);
            const tx = token.x + drawW / 2;
            const ty = token.y + drawH / 2;
            if (vtt.role === 'Player' && !isPointVisible(tx, ty)) continue;

            if (mouse.x >= token.x && mouse.x <= token.x + drawW && mouse.y >= token.y && mouse.y <= token.y + drawH) {
                return token;
            }
        }
        return null;
    }

    function getSelectionBounds(start, end) {
        return {
            x1: Math.min(start.x, end.x),
            y1: Math.min(start.y, end.y),
            x2: Math.max(start.x, end.x),
            y2: Math.max(start.y, end.y)
        };
    }

    function isTokenWithinSelection(token, rect) {
        const { drawW, drawH } = getTokenDrawDimensions(token);
        const tokenRect = {
            x1: token.x,
            y1: token.y,
            x2: token.x + drawW,
            y2: token.y + drawH
        };
        return tokenRect.x1 <= rect.x2 && tokenRect.x2 >= rect.x1 && tokenRect.y1 <= rect.y2 && tokenRect.y2 >= rect.y1;
    }

    function getNearestHexFeatures(x, y, grid, unitSize) {
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;
        const isVert = grid.type === 'hex-v';
        const R = unitSize / Math.sqrt(3);
        
        let bestDistCenter = Infinity;
        let bestCx = x, bestCy = y;
        
        let bestDistVertex = Infinity;
        let bestVx = x, bestVy = y;

        const checkHex = (cx, cy) => {
            const cDist = (cx - x) ** 2 + (cy - y) ** 2;
            if (cDist < bestDistCenter) {
                bestDistCenter = cDist;
                bestCx = cx;
                bestCy = cy;
            }
            for (let i = 0; i < 6; i++) {
                const angle_deg = isVert ? (60 * i - 30) : (60 * i);
                const angle_rad = Math.PI / 180 * angle_deg;
                const vx = cx + R * Math.cos(angle_rad);
                const vy = cy + R * Math.sin(angle_rad);
                const vDist = (vx - x) ** 2 + (vy - y) ** 2;
                if (vDist < bestDistVertex) {
                    bestDistVertex = vDist;
                    bestVx = vx;
                    bestVy = vy;
                }
            }
        };

        if (isVert) {
            const W = Math.sqrt(3) * R;
            const ySpacing = 1.5 * R;
            const estC = Math.round((x - offsetX) / W);
            const estR = Math.round((y - offsetY) / ySpacing);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = estR + dr;
                    const c = estC + dc;
                    const cx = offsetX + c * W + (Math.abs(r) % 2 === 1 ? W / 2 : 0);
                    const cy = offsetY + r * ySpacing;
                    checkHex(cx, cy);
                }
            }
        } else {
            const H = Math.sqrt(3) * R;
            const xSpacing = 1.5 * R;
            const estC = Math.round((x - offsetX) / xSpacing);
            const estR = Math.round((y - offsetY) / H);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = estR + dr;
                    const c = estC + dc;
                    const cx = offsetX + c * xSpacing;
                    const cy = offsetY + r * H + (Math.abs(c) % 2 === 1 ? H / 2 : 0);
                    checkHex(cx, cy);
                }
            }
        }
        return { cx: bestCx, cy: bestCy, vx: bestVx, vy: bestVy };
    }

    function snapToGrid(x, y, isToken = false) {
        if (!grid || !grid.size) return { x, y };
        const unitSize = (grid.size || 50) * (grid.scale || 1);
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;

        if (grid.type === 'hex-v' || grid.type === 'hex-h') {
            let px = x;
            let py = y;
            if (isToken) {
                px += unitSize / 2;
                py += unitSize / 2;
            }
            const hex = getNearestHexFeatures(px, py, grid, unitSize);
            if (isToken) {
                return { x: hex.cx - unitSize / 2, y: hex.cy - unitSize / 2 };
            } else {
                return { x: hex.vx, y: hex.vy };
            }
        }

        return {
            x: Math.round((x - offsetX) / unitSize) * unitSize + offsetX,
            y: Math.round((y - offsetY) / unitSize) * unitSize + offsetY
        };
    }

    function snapToGridCenter(x, y) {
        if (!grid || !grid.size) return { x, y };
        const unitSize = (grid.size || 50) * (grid.scale || 1);
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;

        if (grid.type === 'hex-v' || grid.type === 'hex-h') {
            const hex = getNearestHexFeatures(x, y, grid, unitSize);
            return { x: hex.cx, y: hex.cy };
        }

        return {
            x: Math.floor((x - offsetX) / unitSize) * unitSize + offsetX + unitSize / 2,
            y: Math.floor((y - offsetY) / unitSize) * unitSize + offsetY + unitSize / 2
        };
    }

    function snapToHalfGrid(x, y) {
        if (!grid || !grid.size) return { x, y };
        const unitSize = (grid.size || 50) * (grid.scale || 1);
        
        if (grid.type === 'hex-v' || grid.type === 'hex-h') {
            const hex = getNearestHexFeatures(x, y, grid, unitSize);
            return { x: hex.cx, y: hex.cy };
        }

        const halfSize = unitSize / 2;
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;
        return {
            x: Math.round((x - offsetX) / halfSize) * halfSize + offsetX,
            y: Math.round((y - offsetY) / halfSize) * halfSize + offsetY
        };
    }

    // Convert a pixel distance to feet, rounded to nearest 5 ft (D&D standard).
    function calcDistanceFt(pixels) {
        const pxPerCell = (grid.size || 50) * (grid.scale || 1.0);
        const feet = (pixels / pxPerCell) * (grid.feetPerSquare || 5);
        return Math.round(feet / 5) * 5;
    }

    function hideAllToolPanels() {
        ['panel-lighting-config', 'panel-measure-config', 'panel-layers-config'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('vtt-hidden');
        });
    }

    function setupToolControls() {
        const tools = ['tool-select', 'tool-lighting', 'tool-measure', 'tool-shape', 'tool-ping'];
        tools.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    tools.forEach(otherId => {
                        const el = document.getElementById(otherId);
                        if (el) el.classList.remove('active');
                    });
                    btn.classList.add('active');
                    activeTool = id.replace('tool-', '');
                    
                    hideAllToolPanels();
                    
                    if (activeTool === 'lighting') {
                        document.getElementById('panel-lighting-config')?.classList.remove('vtt-hidden');
                    } else if (activeTool === 'measure' || activeTool === 'shape') {
                        document.getElementById('panel-measure-config')?.classList.remove('vtt-hidden');
                    }
                });
            }
        });
    }

    function setupLayersControls() {
        const btn = document.getElementById('btn-layers');
        if (btn) {
            btn.addEventListener('click', () => {
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
                case 'token': iconClass = 'fa-solid fa-users'; layerName = 'Token'; break;
                case 'gm': iconClass = 'fa-solid fa-eye-slash'; layerName = 'GM'; break;
                case 'lighting': iconClass = 'fa-solid fa-lightbulb'; layerName = 'Lighting'; break;
                case 'map': iconClass = 'fa-solid fa-map'; layerName = 'Map'; break;
                case 'notes': iconClass = 'fa-solid fa-book-journal-whills'; layerName = 'Notes'; break;
            }
            
            icon.className = iconClass;
            btn.title = `Switch Layers (Active: ${layerName} Layer)`;
        };
        
        updateLayerButtonIcon(activeLayer);

        const layerPanel = document.getElementById('panel-layers-config');
        if (layerPanel) {
            const layerBtns = layerPanel.querySelectorAll('.layer-btn');
            layerBtns.forEach(lb => {
                lb.addEventListener('click', () => {
                    const layer = lb.getAttribute('data-layer');
                    if (layer) {
                        layerBtns.forEach(b => b.classList.remove('active'));
                        lb.classList.add('active');
                        activeLayer = layer;
                        updateLayerButtonIcon(layer);
                        // vtt.socket.emit('chat:msg', { text: `[System] Switched to ${activeLayer.toUpperCase()} layer.` });
                        renderAll();
                    }
                });
            });
        }
    }

    function setupLightingPanelControls() {
        const lightingPanel = document.getElementById('panel-lighting-config');
        if (!lightingPanel) return;
        const lightingBtns = lightingPanel.querySelectorAll('.lighting-btn');
        lightingBtns.forEach(lb => {
            lb.addEventListener('click', () => {
                const lType = lb.getAttribute('data-lighting');
                if (lType) {
                    lightingBtns.forEach(b => b.classList.remove('active'));
                    lb.classList.add('active');
                    currentLightingType = lType;
                    
                    const lightOptions = document.getElementById('lighting-light-options');
                    if (lightOptions) {
                        if (lType === 'light') {
                            lightOptions.classList.remove('vtt-hidden');
                        } else {
                            lightOptions.classList.add('vtt-hidden');
                        }
                    }
                }
            });
        });
    }

    
    function openNoteViewer(note) {
        // Remove any existing viewer
        const existing = document.getElementById('vtt-note-viewer');
        if (existing) existing.remove();

        // Render 5eTools entry content
        let renderedHtml = '';
        try {
            if (note.content && window.Renderer) {
                const renderer = window.Renderer.get();
                const stack = [];
                renderer.recursiveRender(note.content, stack, { depth: 0 });
                renderedHtml = stack.join('');
            } else if (note.content) {
                // Fallback: plain JSON display
                renderedHtml = `<pre style="white-space:pre-wrap;font-size:12px;">${JSON.stringify(note.content, null, 2)}</pre>`;
            }
        } catch (e) {
            renderedHtml = `<p style="color:#e74c3c;">Error rendering note content: ${e.message}</p>`;
        }

        const overlay = document.createElement('div');
        overlay.id = 'vtt-note-viewer';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(10,12,20,0.75)', 'backdrop-filter:blur(4px)'
        ].join(';');

        const modal = document.createElement('div');
        modal.style.cssText = [
            'position:relative', 'width:min(700px,92vw)', 'max-height:80vh',
            'background:linear-gradient(135deg,#12161f,#1a1d2b)',
            'border:1px solid rgba(212,175,55,0.35)', 'border-radius:12px',
            'box-shadow:0 24px 80px rgba(0,0,0,0.7)', 'display:flex',
            'flex-direction:column', 'overflow:hidden'
        ].join(';');

        // Header
        const header = document.createElement('div');
        header.style.cssText = [
            'display:flex', 'align-items:center', 'justify-content:space-between',
            'padding:16px 20px', 'border-bottom:1px solid rgba(212,175,55,0.2)',
            'background:rgba(212,175,55,0.06)', 'flex-shrink:0'
        ].join(';');

        const title = document.createElement('h2');
        title.style.cssText = 'margin:0;font-size:17px;font-weight:700;color:#d4af37;font-family:var(--font-primary,Inter);';
        title.textContent = `📍 ${note.name || `Area ${note.areaId}`}`;

        const headerLeft = document.createElement('div');
        headerLeft.style.display = 'flex';
        headerLeft.style.alignItems = 'center';
        headerLeft.appendChild(title);

        const headerRight = document.createElement('div');
        headerRight.style.display = 'flex';
        headerRight.style.alignItems = 'center';
        headerRight.style.gap = '12px';

        if (vtt.role === 'GM') {
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✏️ Edit';
            editBtn.style.cssText = [
                'background:rgba(212,175,55,0.15)', 'border:1px solid rgba(212,175,55,0.3)',
                'color:#d4af37', 'padding:4px 10px', 'border-radius:4px', 'font-size:12px',
                'cursor:pointer', 'transition:background 0.2s'
            ].join(';');
            editBtn.onmouseover = () => { editBtn.style.background = 'rgba(212,175,55,0.25)'; };
            editBtn.onmouseout = () => { editBtn.style.background = 'rgba(212,175,55,0.15)'; };
            editBtn.onclick = () => {
                overlay.remove();
                openNoteEditor(note, false);
            };
            headerRight.appendChild(editBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = [
            'background:none', 'border:none', 'color:#888', 'font-size:24px',
            'cursor:pointer', 'line-height:1', 'padding:0 4px',
            'transition:color 0.15s'
        ].join(';');
        closeBtn.onmouseover = () => { closeBtn.style.color = '#fff'; };
        closeBtn.onmouseout = () => { closeBtn.style.color = '#888'; };
        closeBtn.onclick = () => overlay.remove();
        headerRight.appendChild(closeBtn);

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        // Body
        const body = document.createElement('div');
        body.style.cssText = [
            'padding:20px 24px', 'overflow-y:auto', 'flex:1',
            'color:#ccd0de', 'font-family:var(--font-primary,Inter)',
            'font-size:14px', 'line-height:1.65'
        ].join(';');

        if (renderedHtml) {
            body.innerHTML = renderedHtml;
        } else {
            body.innerHTML = `<p style="color:#888;font-style:italic;">No content available for this note.</p>`;
        }

        modal.appendChild(header);
        modal.appendChild(body);

        if (vtt.role === 'GM') {
            const footer = document.createElement('div');
            footer.style.cssText = [
                'display:flex', 'align-items:center', 'padding:12px 20px',
                'border-top:1px solid rgba(255,255,255,0.05)', 'background:rgba(0,0,0,0.2)',
                'font-size:13px', 'color:#aaa'
            ].join(';');

            const visToggle = document.createElement('label');
            visToggle.style.cssText = 'display:flex;align-items:center;cursor:pointer;gap:8px;';
            const visCheckbox = document.createElement('input');
            visCheckbox.type = 'checkbox';
            visCheckbox.checked = !!note.visibleToPlayers;
            visCheckbox.style.cursor = 'pointer';
            visCheckbox.onchange = (e) => {
                note.visibleToPlayers = e.target.checked;
                vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
                renderAll();
            };
            visToggle.appendChild(visCheckbox);
            visToggle.appendChild(document.createTextNode('👁 Visible to Players'));
            footer.appendChild(visToggle);
            modal.appendChild(footer);
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    function openNoteEditor(note, isNew) {
        const existing = document.getElementById('vtt-note-viewer');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'vtt-note-viewer';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(10,12,20,0.75)', 'backdrop-filter:blur(4px)'
        ].join(';');

        const modal = document.createElement('div');
        modal.style.cssText = [
            'position:relative', 'width:min(700px,92vw)', 'max-height:80vh',
            'background:linear-gradient(135deg,#12161f,#1a1d2b)',
            'border:1px solid rgba(212,175,55,0.35)', 'border-radius:12px',
            'box-shadow:0 24px 80px rgba(0,0,0,0.7)', 'display:flex',
            'flex-direction:column', 'overflow:hidden'
        ].join(';');

        // Header
        const header = document.createElement('div');
        header.style.cssText = [
            'display:flex', 'align-items:center', 'padding:16px 20px',
            'border-bottom:1px solid rgba(212,175,55,0.2)', 'background:rgba(212,175,55,0.06)'
        ].join(';');

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = note.name || (note.areaId ? `Area ${note.areaId}` : '');
        titleInput.placeholder = 'Note Title...';
        titleInput.style.cssText = [
            'flex:1', 'background:none', 'border:none', 'color:#d4af37',
            'font-size:17px', 'font-weight:700', 'font-family:var(--font-primary,Inter)',
            'outline:none'
        ].join(';');
        header.appendChild(titleInput);

        // Body with Rich Text Editor
        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;gap:4px;padding:8px 20px;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.05);';
        
        const tools = [
            { icon: 'B', cmd: 'bold', title: 'Bold' },
            { icon: 'I', cmd: 'italic', title: 'Italic' },
            { icon: '•', cmd: 'insertUnorderedList', title: 'Bullet List' },
            { icon: '1.', cmd: 'insertOrderedList', title: 'Numbered List' }
        ];

        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.innerHTML = t.icon;
            btn.title = t.title;
            btn.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 10px;cursor:pointer;';
            btn.onclick = () => { document.execCommand(t.cmd, false, null); };
            toolbar.appendChild(btn);
        });

        const editorArea = document.createElement('div');
        editorArea.contentEditable = 'true';
        editorArea.style.cssText = [
            'padding:20px 24px', 'overflow-y:auto', 'flex:1',
            'color:#ccd0de', 'font-family:var(--font-primary,Inter)',
            'font-size:14px', 'line-height:1.65', 'outline:none', 'min-height:200px'
        ].join(';');

        // Extract existing HTML content if any
        if (note.content && note.content.type === 'entries' && note.content.entries && note.content.entries[0] && note.content.entries[0].type === 'html') {
            editorArea.innerHTML = note.content.entries[0].html;
        } else if (note.content) {
            // For older imported notes, render them via Renderer and use that html
            let renderedHtml = '';
            try {
                if (window.Renderer) {
                    const renderer = window.Renderer.get();
                    const stack = [];
                    renderer.recursiveRender(note.content, stack, { depth: 0 });
                    renderedHtml = stack.join('');
                }
            } catch (e) {}
            editorArea.innerHTML = renderedHtml || JSON.stringify(note.content);
        }

        body.appendChild(toolbar);
        body.appendChild(editorArea);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = [
            'display:flex', 'align-items:center', 'justify-content:space-between',
            'padding:16px 20px', 'border-top:1px solid rgba(255,255,255,0.05)',
            'background:rgba(0,0,0,0.2)'
        ].join(';');

        const visToggle = document.createElement('label');
        visToggle.style.cssText = 'display:flex;align-items:center;cursor:pointer;gap:8px;color:#aaa;font-size:13px;';
        const visCheckbox = document.createElement('input');
        visCheckbox.type = 'checkbox';
        visCheckbox.checked = !!note.visibleToPlayers;
        visCheckbox.style.cursor = 'pointer';
        visToggle.appendChild(visCheckbox);
        visToggle.appendChild(document.createTextNode('👁 Visible to Players'));
        footer.appendChild(visToggle);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:12px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:14px;';
        cancelBtn.onclick = () => {
            if (isNew) {
                notes = notes.filter(n => n.id !== note.id);
            }
            overlay.remove();
        };

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Note';
        saveBtn.style.cssText = 'background:#d4af37;color:#000;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-weight:bold;font-size:14px;';
        saveBtn.onclick = () => {
            note.name = titleInput.value.trim();
            note.visibleToPlayers = visCheckbox.checked;
            note.content = {
                type: 'entries',
                name: note.name,
                entries: [{ type: 'html', html: editorArea.innerHTML }]
            };
            vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
            renderAll();
            overlay.remove();
            if (isNew) openNoteViewer(note);
        };

        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        footer.appendChild(actions);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Don't close on backdrop click when editing to prevent data loss
    }

    function closeNoteContextMenu() {
        const existing = document.getElementById('vtt-note-context-menu');
        if (existing) existing.remove();
        window.removeEventListener('click', closeNoteContextMenu);
        window.removeEventListener('contextmenu', closeNoteContextMenu);
    }

    function showNoteContextMenu(noteId, clientX, clientY) {
        closeNoteContextMenu();
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        const menu = document.createElement('div');
        menu.id = 'vtt-note-context-menu';
        menu.style.cssText = `position:fixed; left:${clientX}px; top:${clientY}px; z-index:9999; background:#1e2330; border:1px solid #3a4155; border-radius:6px; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:4px 0; min-width:160px; font-family:var(--font-primary,Inter); font-size:13px; color:#ccc;`;

        const addItem = (text, icon, onClick) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s;';
            item.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
            item.onmouseover = () => { item.style.background = 'rgba(255,255,255,0.1)'; item.style.color = '#fff'; };
            item.onmouseout = () => { item.style.background = 'transparent'; item.style.color = '#ccc'; };
            item.onmousedown = (e) => { e.stopPropagation(); onClick(); closeNoteContextMenu(); };
            menu.appendChild(item);
        };

        addItem('Edit', '✏️', () => openNoteEditor(note, false));
        if (note.visibleToPlayers) {
            addItem('Make Private', '✋', () => {
                note.visibleToPlayers = false;
                vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
                renderAll();
            });
        } else {
            addItem('Share with Players', '👁', () => {
                note.visibleToPlayers = true;
                vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
                renderAll();
            });
        }
        addItem('Delete', '🗑️', () => {
            notes = notes.filter(n => n.id !== noteId);
            selectedNoteId = null;
            hoveredNoteId = null;
            vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
            renderAll();
        });

        document.body.appendChild(menu);
        setTimeout(() => {
            window.addEventListener('click', closeNoteContextMenu);
            window.addEventListener('contextmenu', closeNoteContextMenu);
        }, 10);
    }

    function showAddNoteContextMenu(x, y, clientX, clientY) {
        closeNoteContextMenu();

        const menu = document.createElement('div');
        menu.id = 'vtt-note-context-menu';
        menu.style.cssText = `position:fixed; left:${clientX}px; top:${clientY}px; z-index:9999; background:#1e2330; border:1px solid #3a4155; border-radius:6px; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:4px 0; min-width:160px; font-family:var(--font-primary,Inter); font-size:13px; color:#ccc;`;

        const item = document.createElement('div');
        item.style.cssText = 'padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s;';
        item.innerHTML = `<span>➕</span> <span>Add Note Here</span>`;
        item.onmouseover = () => { item.style.background = 'rgba(255,255,255,0.1)'; item.style.color = '#fff'; };
        item.onmouseout = () => { item.style.background = 'transparent'; item.style.color = '#ccc'; };
        item.onmousedown = (e) => { 
            e.stopPropagation(); 
            closeNoteContextMenu();
            const newNote = {
                id: 'note_' + Date.now() + Math.random().toString(36).substring(2, 7),
                name: '',
                content: '',
                x: x,
                y: y,
                visibleToPlayers: false
            };
            notes.push(newNote);
            openNoteEditor(newNote, true);
        };
        menu.appendChild(item);

        document.body.appendChild(menu);
        setTimeout(() => {
            window.addEventListener('click', closeNoteContextMenu);
            window.addEventListener('contextmenu', closeNoteContextMenu);
        }, 10);
    }

    function setupInteractionControls() {

        if (!canvasInteraction) return;

        let dragOffsetX = 0;
        let dragOffsetY = 0;

        // Hide GM tooltip when cursor leaves the canvas entirely
        canvasInteraction.addEventListener('mouseleave', () => {
            if (vtt.role === 'GM') hideGmTokenTooltip();
        });

        canvasInteraction.addEventListener('dblclick', e => {
            if (activeTool !== 'select') return;
            const mouse = getCanvasMouseCoords(e);
            const token = getTokenAtPoint(mouse);
            if (token) {
                e.preventDefault();
                openTokenEditModal(token.id);
            }
        });

        canvasInteraction.addEventListener('mousedown', e => {
            lastMouseEvent = e;
            const mouse = getCanvasMouseCoords(e);

            if (e.button === 0) {
                if (pingHoldTimeout) clearTimeout(pingHoldTimeout);
                const isShift = e.shiftKey;
                const isGM = vtt.role === 'GM';
                const startMouseX = mouse.x;
                const startMouseY = mouse.y;
                
                pingHoldTimeout = setTimeout(() => {
                    pingHoldTimeout = null;
                    if (isShift && isGM) {
                        vtt.socket.emit('map:panTo', { mapId: currentMapId, x: startMouseX, y: startMouseY });
                    }
                    vtt.socket.emit('map:ping', { mapId: currentMapId, x: startMouseX, y: startMouseY, username: vtt.username, role: vtt.role });
                    triggerPingAnimation(startMouseX, startMouseY, vtt.username, vtt.role);
                }, 1000);
            }

            // Check for interactive doors/windows
            function getInteractiveDoorAtCoord(x, y) {
                for (let i = walls.length - 1; i >= 0; i--) {
                    const wall = walls[i];
                    if (wall.type !== 'door' && wall.type !== 'window') continue;
                    
                    const activeCoords = getWallCoordinatesForRaycasting(wall) || { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
                    const midX = (activeCoords.x1 + activeCoords.x2) / 2;
                    const midY = (activeCoords.y1 + activeCoords.y2) / 2;
                    
                    if (vtt.role === 'GM') {
                        if (Math.hypot(x - (midX - 12), y - midY) <= 12) return { wallIdx: i, action: 'toggleOpen' };
                        if (wall.type === 'window') {
                            if (Math.hypot(x - (midX + 12), y - midY) <= 12) return { wallIdx: i, action: 'toggleDrawn' };
                        } else {
                            if (Math.hypot(x - (midX + 12), y - midY) <= 12) return { wallIdx: i, action: 'toggleSecret' };
                        }
                    } else {
                        if (wall.isSecret && wall.type !== 'window') continue;
                        if (Math.hypot(x - midX, y - midY) <= 12) return { wallIdx: i, action: 'toggleOpen' };
                    }
                }
                return null;
            }
            
            const doorAction = getInteractiveDoorAtCoord(mouse.x, mouse.y);
            if (doorAction) {
                const wall = walls[doorAction.wallIdx];
                if (e.button === 0) { // left click
                    if (doorAction.action === 'toggleOpen') {
                        if (wall.isLocked && vtt.role !== 'GM') {
                            // vtt.socket.emit('chat:msg', { text: `[System] That door is locked.` });
                        } else {
                            wall.isOpen = !wall.isOpen;
                            vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                            renderAll();
                        }
                    } else if (doorAction.action === 'toggleDrawn') {
                        wall.isDrawn = !wall.isDrawn;
                        vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                        renderAll();
                    } else if (doorAction.action === 'toggleSecret') {
                        wall.isSecret = !wall.isSecret;
                        vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                        renderAll();
                    }
                } else if (e.button === 2 && vtt.role === 'GM' && doorAction.action === 'toggleOpen') {
                    wall.isLocked = !wall.isLocked;
                    vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                    renderAll();
                }
                return;
            }

            if (e.button === 2) {
                if (activeTool === 'select' && dragTargetId) {
                    const tOriginalPos = tokenDragOriginalPositions[dragTargetId];
                    if (!localIsMeasuring) {
                        isTokenMeasuring = true;
                        localIsMeasuring = true;
                        localMeasureStart = tOriginalPos ? { x: tOriginalPos.x + getTokenDrawDimensions(tokens[dragTargetId]).drawW / 2, y: tOriginalPos.y + getTokenDrawDimensions(tokens[dragTargetId]).drawH / 2 } : mouse;
                        localMeasureEnd = mouse;
                        measureAnchorPoints = [localMeasureStart, e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y)];
                        renderAll();
                    } else {
                        measureAnchorPoints.push(e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y));
                        localMeasureEnd = mouse;
                        renderAll();
                    }
                    return;
                }
                
                const rawShapeMeasure = document.getElementById('measure-shape')?.value || 'line';
                if ((activeTool === 'measure' && rawShapeMeasure === 'line') || 
                    (activeTool === 'shape' && rawShapeMeasure === 'line')) {
                    if (localIsMeasuring || localIsShaping) {
                        measureAnchorPoints.push(e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y));
                        if (localIsMeasuring) localMeasureEnd = mouse;
                        if (localIsShaping) localShapeEnd = mouse;
                        renderAll();
                        return;
                    }
                }

                isPanning = true;
                hasPanned = false;
                startPanX = e.clientX - panX;
                startPanY = e.clientY - panY;
                return;
            }

            if (e.button === 0 && e.shiftKey && activeTool === 'select') {
                const token = getTokenAtPoint(mouse);
                if (token) {
                    let charRef = null;
                    if (token.characterId && window.VTT?.campaignState?.characters) {
                        charRef = window.VTT.campaignState.characters[token.characterId];
                    }

                    if (charRef && (charRef.isCustomNpc || charRef.isCompanion)) {
                        if (window.VTT?.creatureSheet?.openSheet) {
                            window.VTT.creatureSheet.openSheet(charRef.monsterData, token.id, token.characterId);
                        }
                    } else if (window.VTT?.playerSheet?.openSheet && token.characterId) {
                        window.VTT.playerSheet.openSheet(token.characterId);
                    } else if (window.VTT?.creatureSheet?.openSheet && token.monsterData) {
                        window.VTT.creatureSheet.openSheet(token.monsterData, token.id, token.characterId);
                    }
                    return;
                }
            }
            
            // Notes layer click / drag start (GM) or view (Player)
            if (activeTool === 'select' && e.button === 0) {
                const clickedNoteId = getNoteAtCoord(mouse.x, mouse.y);
                if (clickedNoteId) {
                    if (vtt.role === 'GM') {
                        selectedNoteId = clickedNoteId;
                        const note = notes.find(n => n.id === clickedNoteId);
                        if (note) {
                            draggingNoteId = clickedNoteId;
                            noteDragOffsetX = mouse.x - note.x;
                            noteDragOffsetY = mouse.y - note.y;
                            noteDragStartMouse = { x: mouse.x, y: mouse.y };
                        }
                        renderAll();
                        return;
                    } else {
                        const note = notes.find(n => n.id === clickedNoteId);
                        if (note) openNoteViewer(note);
                        return;
                    }
                } else if (vtt.role === 'GM' && activeLayer === 'notes') {
                    selectedNoteId = null;
                    renderAll();
                }
            }

            if (activeTool === 'select') {
                if (activeLayer === 'lighting') {
                    if (hoveredLightId) {
                        selectedLightId = hoveredLightId;
                        activeDragLightId = hoveredLightId;
                        const light = lights.find(l => l.id === hoveredLightId);
                        if (light) {
                            lightDragOffsetX = mouse.x - light.x;
                            lightDragOffsetY = mouse.y - light.y;
                        }
                        if (!e.ctrlKey && !e.shiftKey) {
                            selectedWallIdxs.clear();
                        }
                        renderAll();
                    } else if (hoveredWallVertex) {
                        activeDragWallVertex = hoveredWallVertex;
                        selectedLightId = null;
                        if (!e.ctrlKey && !e.shiftKey) selectedWallIdxs.clear();
                    } else if (hoveredWallIdx !== -1) {
                        selectedWallIdx = hoveredWallIdx;
                        activeDragWallSegmentIdx = hoveredWallIdx;
                        selectedLightId = null;
                        if (!e.ctrlKey && !e.shiftKey) {
                            selectedWallIdxs.clear();
                            selectedWallIdxs.add(hoveredWallIdx);
                        } else {
                            selectedWallIdxs.add(hoveredWallIdx);
                        }
                        const w = walls[hoveredWallIdx];
                        wallDragOffsetX1 = mouse.x - w.x1;
                        wallDragOffsetY1 = mouse.y - w.y1;
                        wallDragOffsetX2 = mouse.x - w.x2;
                        wallDragOffsetY2 = mouse.y - w.y2;
                        renderAll();
                    } else if (e.button === 0) {
                        selectedWallIdx = -1;
                        selectedLightId = null;
                        boxSelectAdditive = e.ctrlKey || e.shiftKey;
                        if (!boxSelectAdditive) {
                            selectedWallIdxs.clear();
                        }
                        isBoxSelecting = true;
                        boxSelectStart = mouse;
                        boxSelectEnd = mouse;
                        renderAll();
                    }
                } else {
                    if (hoveredShapeComponent) {
                        const shape = shapes[hoveredShapeComponent.shapeId];
                        if (shape && (shape.layer === activeLayer || activeLayer === 'gm')) {
                            selectedTokenIds.clear();
                            selectedShapeId = hoveredShapeComponent.shapeId;
                            selectedShapeComponent = hoveredShapeComponent;
                            activeDragShapeId = hoveredShapeComponent.shapeId;
                            activeDragShapeComponent = hoveredShapeComponent;
                            
                            if (hoveredShapeComponent.type === 'shape') {
                                const center = getShapeCenterPoint(shape);
                                shapeDragOffsetX = mouse.x - center.x;
                                shapeDragOffsetY = mouse.y - center.y;
                            } else if (hoveredShapeComponent.type === 'anchor') {
                                shapeComponentDragStart = { x: shape.startPoint.x, y: shape.startPoint.y, ex: shape.endPoint.x, ey: shape.endPoint.y };
                            }
                            renderAll();
                            return;
                        }
                    }

                    selectedShapeId = null;
                    selectedShapeComponent = null;

                    let clickedId = null;
                    const tokenIds = Object.keys(tokens);
                    for (let i = tokenIds.length - 1; i >= 0; i--) {
                        const t = tokens[tokenIds[i]];
                        if (t.layer !== activeLayer && activeLayer !== 'gm') continue;
                        if (!isTokenControlledByPlayer(t)) continue;
                        
                        const { drawW, drawH } = getTokenDrawDimensions(t);
                        if (mouse.x >= t.x && mouse.x <= t.x + drawW && mouse.y >= t.y && mouse.y <= t.y + drawH) {
                            clickedId = t.id;
                            break;
                        }
                    }
                    
                    if (clickedId) {
                        dragTargetId = clickedId;
                        const t = tokens[clickedId];
                        dragOffsetX = mouse.x - t.x;
                        dragOffsetY = mouse.y - t.y;

                        // Hide GM tooltip as soon as dragging begins
                        if (vtt.role === 'GM') hideGmTokenTooltip();

                        if (e.ctrlKey || e.shiftKey) {
                            if (selectedTokenIds.has(clickedId)) {
                                if (e.ctrlKey) {
                                    selectedTokenIds.delete(clickedId);
                                }
                            } else {
                                selectedTokenIds.add(clickedId);
                            }
                        } else {
                            if (!selectedTokenIds.has(clickedId)) {
                                selectedTokenIds.clear();
                                selectedTokenIds.add(clickedId);
                            }
                        }

                        tokenDragOriginalPositions = {};
                        selectedTokenIds.forEach(id => {
                            const selected = tokens[id];
                            if (selected) {
                                tokenDragOriginalPositions[id] = { x: selected.x, y: selected.y };
                            }
                        });
                        renderAll();
                    } else if (e.button === 0) {
                        boxSelectAdditive = e.ctrlKey || e.shiftKey;
                        if (!boxSelectAdditive) {
                            selectedTokenIds.clear();
                        }
                        isBoxSelecting = true;
                        boxSelectStart = mouse;
                        boxSelectEnd = mouse;
                        renderAll();
                    }
                }
            } else if (activeTool === 'ping') {
                vtt.socket.emit('map:ping', { mapId: currentMapId, x: mouse.x, y: mouse.y, username: vtt.username, role: vtt.role });
                triggerPingAnimation(mouse.x, mouse.y, vtt.username, vtt.role);
            } else if (activeTool === 'measure') {
                localIsMeasuring = true;
                localMeasureStart = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                localMeasureEnd = localMeasureStart;
                measureAnchorPoints = [localMeasureStart];
                renderAll();
            } else if (activeTool === 'shape') {
                localIsShaping = true;
                localShapeStart = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                localShapeEnd = localShapeStart;
                measureAnchorPoints = [localShapeStart];
                renderAll();
            } else if (activeTool === 'lighting') {
                if (currentLightingType === 'light') {
                    if (hoveredLightId) {
                        selectedLightId = hoveredLightId;
                        activeDragLightId = hoveredLightId;
                        const light = lights.find(l => l.id === hoveredLightId);
                        if (light) {
                            lightDragOffsetX = mouse.x - light.x;
                            lightDragOffsetY = mouse.y - light.y;
                        }
                        renderAll();
                    } else {
                        const lightBright = parseInt(document.getElementById('light-bright')?.value) || 20;
                        const lightDim = parseInt(document.getElementById('light-dim')?.value) || 40;
                        const lightColor = document.getElementById('light-color')?.value || '#ffffff';
                        const newLight = {
                            id: 'light_' + Date.now() + Math.random().toString(36).substr(2,5),
                            x: mouse.x,
                            y: mouse.y,
                            lightBright,
                            lightDim,
                            lightColor
                        };
                        if (!Array.isArray(lights)) lights = [];
                        lights.push(newLight);
                        vtt.socket.emit('lights:update', { mapId: currentMapId, lights });
                        // vtt.socket.emit('chat:msg', { text: `[System] Placed light source at ${Math.round(mouse.x)}, ${Math.round(mouse.y)}.` });
                        renderAll();
                    }
                } else if (hoveredWallVertex) {
                    activeDragWallVertex = hoveredWallVertex;
                    selectedLightId = null;
                } else if (hoveredWallIdx !== -1) {
                    selectedWallIdx = hoveredWallIdx;
                    activeDragWallSegmentIdx = hoveredWallIdx;
                    selectedLightId = null;
                    const w = walls[hoveredWallIdx];
                    wallDragOffsetX1 = mouse.x - w.x1;
                    wallDragOffsetY1 = mouse.y - w.y1;
                    wallDragOffsetX2 = mouse.x - w.x2;
                    wallDragOffsetY2 = mouse.y - w.y2;
                    renderAll();
                } else {
                    selectedWallIdx = -1;
                    selectedLightId = null;
                    isDrawingWall = true;
                    wallStartPoint = e.altKey ? mouse : snapToGrid(mouse.x, mouse.y);
                    renderAll();
                }
            }
        });

        window.addEventListener('mousemove', e => {
            lastMouseEvent = e;
            currentMouseCoords = getCanvasMouseCoords(e);
            if (isPanning) {
                hasPanned = true;
                panX = e.clientX - startPanX;
                panY = e.clientY - startPanY;
                updateContainerTransform();
                renderAll();
                return;
            }
            
            if (isBoxSelecting) {
                const mouse = getCanvasMouseCoords(e);
                boxSelectEnd = mouse;
                renderAll();
                return;
            }

            if (activeTool === 'select') {
                const mouse = getCanvasMouseCoords(e);

                // Note pin drag
                if (draggingNoteId) {
                    const note = notes.find(n => n.id === draggingNoteId);
                    if (note) {
                        note.x = mouse.x - noteDragOffsetX;
                        note.y = mouse.y - noteDragOffsetY;
                        renderAll();
                    }
                    return;
                }
                
                if (!activeDragShapeId && !dragTargetId && !activeDragLightId && !activeDragWallVertex && activeDragWallSegmentIdx === -1) {
                    hoveredShapeComponent = null;

                    // Note hover detection
                    const newHoveredNote = getNoteAtCoord(mouse.x, mouse.y);
                    if (newHoveredNote !== hoveredNoteId) {
                        hoveredNoteId = newHoveredNote;
                        canvasInteraction.style.cursor = hoveredNoteId ? 'pointer' : '';
                        renderAll();
                    }

                    // Token hover detection
                    if (activeLayer === 'map' || activeLayer === 'token' || activeLayer === 'gm') {
                        const newHoveredToken = getTokenAtPoint(mouse, false);
                        const newHoverTokenId = newHoveredToken ? newHoveredToken.id : null;
                        if (newHoverTokenId !== hoverTokenId) {
                            hoverTokenId = newHoverTokenId;
                            if (hoverTokenId) canvasInteraction.style.cursor = 'pointer';
                            else if (!hoveredNoteId) canvasInteraction.style.cursor = '';
                            renderAll();
                        }

                        // GM tooltip — schedule on hover, hide on leave
                        if (vtt.role === 'GM') {
                            if (newHoverTokenId !== gmTokenTooltipTokenId) {
                                // Cancel any pending scheduled show
                                if (gmTokenTooltipTimeout) {
                                    clearTimeout(gmTokenTooltipTimeout);
                                    gmTokenTooltipTimeout = null;
                                }
                                // Hide immediately if no longer over a token
                                const existingTip = document.getElementById('vtt-gm-token-tooltip');
                                if (existingTip) existingTip.remove();
                                gmTokenTooltipTokenId = null;

                                if (newHoverTokenId) {
                                    // Schedule show after 300ms of stable hover
                                    gmTokenTooltipTimeout = setTimeout(() => {
                                        gmTokenTooltipTimeout = null;
                                        showGmTokenTooltip(newHoverTokenId);
                                    }, 300);
                                }
                            }
                        }
                    } else if (hoverTokenId !== null) {
                        hoverTokenId = null;
                        if (!hoveredNoteId) canvasInteraction.style.cursor = '';
                        renderAll();
                        // Hide GM tooltip if we switch layers
                        if (vtt.role === 'GM') hideGmTokenTooltip();
                    }

                    if (activeLayer !== 'lighting') {
                        const component = getShapeComponentAtCoord(mouse.x, mouse.y);
                        if (component) {
                            const shape = shapes[component.shapeId];
                            if (shape && (shape.layer === activeLayer || activeLayer === 'gm')) {
                                hoveredShapeComponent = component;
                            }
                        }
                    }
                }

                if (activeLayer === 'lighting') {
                    if (activeDragLightId) {
                        const nx = mouse.x;
                        const ny = mouse.y;
                        const light = lights.find(l => l.id === activeDragLightId);
                        if (light) {
                            light.x = nx - lightDragOffsetX;
                            light.y = ny - lightDragOffsetY;
                            if (!e.altKey && grid) {
                                const snapped = snapToGrid(light.x, light.y);
                                light.x = snapped.x;
                                light.y = snapped.y;
                            }
                        }
                        renderAll();
                    } else if (activeDragWallVertex) {
                        const nx = e.altKey ? mouse.x : snapToGrid(mouse.x, mouse.y).x;
                        const ny = e.altKey ? mouse.y : snapToGrid(mouse.x, mouse.y).y;
                        if (activeDragWallVertex.endpoint === 1) {
                            walls[activeDragWallVertex.wallIdx].x1 = nx;
                            walls[activeDragWallVertex.wallIdx].y1 = ny;
                        } else {
                            walls[activeDragWallVertex.wallIdx].x2 = nx;
                            walls[activeDragWallVertex.wallIdx].y2 = ny;
                        }
                        renderAll();
                    } else if (activeDragWallSegmentIdx !== -1) {
                        let nx = mouse.x;
                        let ny = mouse.y;
                        if (!e.altKey && grid) {
                            const snapped = snapToGrid(nx, ny);
                            nx = snapped.x;
                            ny = snapped.y;
                        }
                        const w = walls[activeDragWallSegmentIdx];
                        w.x1 = nx - wallDragOffsetX1;
                        w.y1 = ny - wallDragOffsetY1;
                        w.x2 = nx - wallDragOffsetX2;
                        w.y2 = ny - wallDragOffsetY2;
                        renderAll();
                    } else {
                        hoveredWallVertex = getWallVertexAtCoord(mouse.x, mouse.y);
                        hoveredWallIdx = hoveredWallVertex ? -1 : getWallSegmentAtCoord(mouse.x, mouse.y);
                        hoveredLightId = getLightAtCoord(mouse.x, mouse.y);
                        renderAll();
                    }
                }
            }

            if (activeDragShapeId && activeTool === 'select') {
                const mouse = getCanvasMouseCoords(e);
                const s = shapes[activeDragShapeId];
                if (s) {
                    if (activeDragShapeComponent.type === 'shape') {
                        let nx = mouse.x - shapeDragOffsetX;
                        let ny = mouse.y - shapeDragOffsetY;
                        if (!e.altKey && grid) {
                            const snapped = snapToGrid(nx, ny);
                            nx = snapped.x;
                            ny = snapped.y;
                        }
                        
                        const center = getShapeCenterPoint(s);
                        const dx = nx - center.x;
                        const dy = ny - center.y;
                        
                        s.startPoint.x += dx;
                        s.startPoint.y += dy;
                        s.endPoint.x += dx;
                        s.endPoint.y += dy;
                        
                        if (s.points) {
                            s.points.forEach(p => { p.x += dx; p.y += dy; });
                        }
                    } else if (activeDragShapeComponent.type === 'anchor') {
                        let nx = mouse.x;
                        let ny = mouse.y;
                        if (!e.altKey && grid) {
                            const snapped = snapToHalfGrid(nx, ny);
                            nx = snapped.x;
                            ny = snapped.y;
                        }
                        const idx = activeDragShapeComponent.index;
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
            } else if (dragTargetId && activeTool === 'select') {
                const mouse = getCanvasMouseCoords(e);
                const t = tokens[dragTargetId];
                if (t) {
                    let nx = mouse.x - dragOffsetX;
                    let ny = mouse.y - dragOffsetY;
                    
                    if (!e.altKey && grid) {
                        const snapped = snapToGrid(nx, ny, true);
                        nx = snapped.x;
                        ny = snapped.y;
                    }

                    const sourceOriginal = tokenDragOriginalPositions[dragTargetId] || { x: t.x, y: t.y };

                    const currentMap = vtt.campaignState?.maps?.[currentMapId];
                    if (vtt.role !== 'GM' && currentMap?.lightingSettings?.restrictMovement) {
                        const { drawW, drawH } = getTokenDrawDimensions(t);
                        const radius = Math.min(drawW, drawH) / 2;
                        const startCenter = { x: sourceOriginal.x + drawW / 2, y: sourceOriginal.y + drawH / 2 };
                        const endCenter = { x: nx + drawW / 2, y: ny + drawH / 2 };
                        
                        let closestT = 1.0;
                        let collisionPoint = null;
                        
                        walls.forEach(wall => {
                            if (wall.isOpen) return;
                            
                            const intersect = getLineIntersection(startCenter.x, startCenter.y, endCenter.x, endCenter.y, wall.x1, wall.y1, wall.x2, wall.y2);
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
                                const backupT = Math.max(0, collisionPoint.t - ((radius - 2) / length));
                                nx = startCenter.x + dx * backupT - drawW / 2;
                                ny = startCenter.y + dy * backupT - drawH / 2;
                            }
                        }
                    }

                    const deltaX = nx - sourceOriginal.x;
                    const deltaY = ny - sourceOriginal.y;

                    if (selectedTokenIds.has(dragTargetId) && selectedTokenIds.size > 1) {
                        selectedTokenIds.forEach(id => {
                            const original = tokenDragOriginalPositions[id];
                            if (!original || !tokens[id]) return;
                            if (!isTokenControlledByPlayer(tokens[id])) return; // Prevent dragging unowned tokens
                            tokens[id].x = original.x + deltaX;
                            tokens[id].y = original.y + deltaY;
                        });
                    } else {
                        if (isTokenControlledByPlayer(t)) {
                            t.x = nx;
                            t.y = ny;
                        }
                    }
                    renderAll();
                }
            } else if (localIsMeasuring && (activeTool === 'measure' || isTokenMeasuring)) {
                const mouse = getCanvasMouseCoords(e);
                localMeasureEnd = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                const rawShape = isTokenMeasuring ? 'line' : (document.getElementById('measure-shape')?.value || 'line');
                const color = document.getElementById('measure-color')?.value || '#00ffff';
                const anchor = document.getElementById('measure-square-anchor')?.value || 'center';
                const beamW = parseFloat(document.getElementById('measure-beam-width')?.value || 5);
                const points = (rawShape === 'line' && measureAnchorPoints.length > 0) ? [...measureAnchorPoints, localMeasureEnd] : null;
                vtt.socket.emit('measure:updated', { mapId: currentMapId, username: vtt.username, start: localMeasureStart, end: localMeasureEnd, shape: rawShape, color, squareAnchor: anchor, beamWidth: beamW, points });
                renderAll();
            } else if (localIsShaping && activeTool === 'shape') {
                const mouse = getCanvasMouseCoords(e);
                localShapeEnd = e.altKey ? mouse : snapToGridCenter(mouse.x, mouse.y);
                renderAll();
            } else if (activeTool === 'lighting') {
                const mouse = getCanvasMouseCoords(e);
                if (activeDragLightId) {
                    const nx = mouse.x;
                    const ny = mouse.y;
                    const light = lights.find(l => l.id === activeDragLightId);
                    if (light) {
                        light.x = nx - lightDragOffsetX;
                        light.y = ny - lightDragOffsetY;
                        if (!e.altKey && grid) {
                            const snapped = snapToGrid(light.x, light.y);
                            light.x = snapped.x;
                            light.y = snapped.y;
                        }
                    }
                    renderAll();
                } else if (activeDragWallVertex) {
                    const nx = e.altKey ? mouse.x : snapToGrid(mouse.x, mouse.y).x;
                    const ny = e.altKey ? mouse.y : snapToGrid(mouse.x, mouse.y).y;
                    if (activeDragWallVertex.endpoint === 1) {
                        walls[activeDragWallVertex.wallIdx].x1 = nx;
                        walls[activeDragWallVertex.wallIdx].y1 = ny;
                    } else {
                        walls[activeDragWallVertex.wallIdx].x2 = nx;
                        walls[activeDragWallVertex.wallIdx].y2 = ny;
                    }
                    renderAll();
                } else if (activeDragWallSegmentIdx !== -1) {
                    let nx = mouse.x;
                    let ny = mouse.y;
                    if (!e.altKey && grid) {
                        const snapped = snapToGrid(nx, ny);
                        nx = snapped.x;
                        ny = snapped.y;
                    }
                    const w = walls[activeDragWallSegmentIdx];
                    w.x1 = nx - wallDragOffsetX1;
                    w.y1 = ny - wallDragOffsetY1;
                    w.x2 = nx - wallDragOffsetX2;
                    w.y2 = ny - wallDragOffsetY2;
                    renderAll();
                } else if (isDrawingWall) {
                    renderAll();
                } else {
                    hoveredWallVertex = getWallVertexAtCoord(mouse.x, mouse.y);
                    hoveredWallIdx = hoveredWallVertex ? -1 : getWallSegmentAtCoord(mouse.x, mouse.y);
                    hoveredLightId = getLightAtCoord(mouse.x, mouse.y);
                    renderAll();
                }
            }
        });

        window.addEventListener('mouseup', e => {
            if (pingHoldTimeout) {
                clearTimeout(pingHoldTimeout);
                pingHoldTimeout = null;
            }
            if (isPanning) {
                isPanning = false;
                return;
            }
            if (e.button !== 0) return;

            if (isBoxSelecting) {
                if (boxSelectStart && boxSelectEnd) {
                    const bounds = getSelectionBounds(boxSelectStart, boxSelectEnd);
                    if (activeTool === 'select' && activeLayer === 'lighting') {
                        if (!boxSelectAdditive) {
                            selectedWallIdxs.clear();
                        }
                        walls.forEach((wall, idx) => {
                            if ((wall.x1 >= bounds.x1 && wall.x1 <= bounds.x2 && wall.y1 >= bounds.y1 && wall.y1 <= bounds.y2) ||
                                (wall.x2 >= bounds.x1 && wall.x2 <= bounds.x2 && wall.y2 >= bounds.y1 && wall.y2 <= bounds.y2)) {
                                selectedWallIdxs.add(idx);
                            }
                        });
                        
                        lights.forEach(light => {
                            if (light.x >= bounds.x1 && light.x <= bounds.x2 && light.y >= bounds.y1 && light.y <= bounds.y2) {
                                selectedLightId = light.id;
                            }
                        });
                    } else {
                        const tokenIds = Object.keys(tokens);
                        tokenIds.forEach(id => {
                            const t = tokens[id];
                            if (!t) return;
                            if (t.layer !== activeLayer && activeLayer !== 'gm') return;
                            if (t.layer === 'gm' && vtt.role !== 'GM') return;
                            if (!isTokenControlledByPlayer(t)) return;

                            if (isTokenWithinSelection(t, bounds)) {
                                selectedTokenIds.add(id);
                            }
                        });
                    }
                    renderAll();
                }
                isBoxSelecting = false;
                boxSelectStart = null;
                boxSelectEnd = null;
                boxSelectAdditive = false;
                renderAll();
                return;
            }
            
            if (draggingNoteId) {
                const wasDrag = noteDragStartMouse && (
                    Math.hypot(
                        (currentMouseCoords?.x ?? 0) - noteDragStartMouse.x,
                        (currentMouseCoords?.y ?? 0) - noteDragStartMouse.y
                    ) > 5
                );
                if (wasDrag) {
                    vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
                } else {
                    // It was a click — open the note viewer
                    const note = notes.find(n => n.id === draggingNoteId);
                    if (note) openNoteViewer(note);
                }
                draggingNoteId = null;
                noteDragStartMouse = null;
            } else if (activeDragShapeId && activeTool === 'select') {
                vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                activeDragShapeId = null;
                activeDragShapeComponent = null;
            } else if (dragTargetId && activeTool === 'select') {
                const t = tokens[dragTargetId];
                if (t) {
                    const originalPos = tokenDragOriginalPositions[dragTargetId] || {x: t.x, y: t.y};
                    if (originalPos.x !== t.x || originalPos.y !== t.y) {
                        t._animReq = {
                            startX: originalPos.x,
                            startY: originalPos.y,
                            endX: t.x,
                            endY: t.y,
                            waypoints: isTokenMeasuring ? [...measureAnchorPoints] : [],
                            timestamp: Date.now(),
                            duration: 500
                        };
                    }
                }
                processTokenAnimReqs(tokens, true);
                window.emitTokenUpdates(tokens);
                dragTargetId = null;
                tokenDragOriginalPositions = {};
                if (isTokenMeasuring) {
                    isTokenMeasuring = false;
                    localIsMeasuring = false;
                    measureAnchorPoints = [];
                    vtt.socket.emit('measure:cleared', { mapId: currentMapId, username: vtt.username });
                    localMeasureStart = null;
                    localMeasureEnd = null;
                }
            } else if (localIsMeasuring && activeTool === 'measure') {
                localIsMeasuring = false;
                measureAnchorPoints = [];
                vtt.socket.emit('measure:cleared', { mapId: currentMapId, username: vtt.username });
                localMeasureStart = null;
                localMeasureEnd = null;
                renderAll();
            } else if (activeTool === 'lighting' || (activeTool === 'select' && activeLayer === 'lighting')) {
                if (activeDragLightId) {
                    vtt.socket.emit('lights:update', { mapId: currentMapId, lights });
                    activeDragLightId = null;
                } else if (activeDragWallVertex) {
                    vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                    activeDragWallVertex = null;
                } else if (activeDragWallSegmentIdx !== -1) {
                    vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                    activeDragWallSegmentIdx = -1;
                } else if (isDrawingWall) {
                    isDrawingWall = false;
                    if (wallStartPoint) {
                        const mouse = getCanvasMouseCoords(e);
                        const endPoint = e.altKey ? mouse : snapToGrid(mouse.x, mouse.y);
                        
                        if (Math.hypot(endPoint.x - wallStartPoint.x, endPoint.y - wallStartPoint.y) > 5) {
                            const newWall = {
                                id: 'wall_' + Date.now() + Math.random().toString(36).substr(2,5),
                                x1: wallStartPoint.x,
                                y1: wallStartPoint.y,
                                x2: endPoint.x,
                                y2: endPoint.y,
                                type: currentLightingType
                            };
                            if (!Array.isArray(walls)) walls = [];
                            walls.push(newWall);
                            vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                        }
                    }
                    wallStartPoint = null;
                    renderAll();
                }
            } else if (localIsShaping && activeTool === 'shape') {
                localIsShaping = false;
                if (localShapeStart && localShapeEnd) {
                    const rawShape = document.getElementById('measure-shape')?.value || 'circle';
                    const color = document.getElementById('measure-color')?.value || '#00ffff';
                    
                    let shapeData = {
                        id: 'shape_' + Date.now() + Math.random().toString(36).substr(2,5),
                        color,
                        ownerUsername: vtt.username,
                        layer: activeLayer,
                        shape: rawShape,
                        startPoint: localShapeStart,
                        endPoint: localShapeEnd,
                        squareAnchor: document.getElementById('measure-square-anchor')?.value || 'center',
                        beamWidth: parseFloat(document.getElementById('measure-beam-width')?.value || 5),
                        points: (rawShape === 'line' && measureAnchorPoints.length > 0) ? [...measureAnchorPoints, localShapeEnd] : null
                    };
                    
                    if (typeof shapes === 'undefined') window.shapes = {};
                    shapes[shapeData.id] = shapeData;
                    vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                }
                measureAnchorPoints = [];
                localShapeStart = null;
                localShapeEnd = null;
                renderAll();
            }
        });

        function deleteSelection() {
            let changedTokens = false;
            let changedShapes = false;
            let changedWalls = false;
            let changedLights = false;

            if (selectedTokenIds.size > 0) {
                selectedTokenIds.forEach(id => {
                    const t = tokens[id];
                    if (isTokenControlledByPlayer(t)) {
                        delete tokens[id];
                    }
                });
                selectedTokenIds.clear();
                changedTokens = true;
            }

            if (typeof selectedShapeIds !== 'undefined' && selectedShapeIds.size > 0) {
                selectedShapeIds.forEach(id => {
                    delete shapes[id];
                });
                selectedShapeIds.clear();
                changedShapes = true;
            }

            if (typeof selectedWallIdxs !== 'undefined' && selectedWallIdxs.size > 0) {
                const sortedIdxs = Array.from(selectedWallIdxs).sort((a, b) => b - a);
                sortedIdxs.forEach(idx => {
                    if (walls[idx]) walls.splice(idx, 1);
                });
                selectedWallIdxs.clear();
                changedWalls = true;
            } else if (selectedWallIdx !== -1) {
                walls.splice(selectedWallIdx, 1);
                selectedWallIdx = -1;
                changedWalls = true;
            }
            
            if (selectedLightId) {
                const idx = lights.findIndex(l => l.id === selectedLightId);
                if (idx !== -1) {
                    lights.splice(idx, 1);
                    selectedLightId = null;
                    hoveredLightId = null;
                    changedLights = true;
                }
            }

            // Notes deletion
            if (selectedNoteId && activeLayer === 'notes') {
                notes = notes.filter(n => n.id !== selectedNoteId);
                selectedNoteId = null;
                hoveredNoteId = null;
                vtt.socket.emit('notes:update', { mapId: currentMapId, notes });
                renderAll();
                return;
            }

            if (changedTokens) window.emitTokenUpdates(tokens);
            if (changedShapes) vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
            if (changedLights) vtt.socket.emit('lights:update', { mapId: currentMapId, lights });
            if (changedWalls) {
                hoveredWallIdx = -1;
                vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
            }
            if (changedTokens || changedShapes || changedWalls || changedLights) renderAll();
        }

        function copySelectionToClipboard() {
            if (activeLayer === 'lighting') {
                const items = [];
                if (typeof selectedWallIdxs !== 'undefined' && selectedWallIdxs.size > 0) {
                    selectedWallIdxs.forEach(idx => items.push(JSON.parse(JSON.stringify(walls[idx]))));
                } else if (selectedWallIdx !== -1) {
                    items.push(JSON.parse(JSON.stringify(walls[selectedWallIdx])));
                }
                if (selectedLightId) {
                    const l = lights.find(l => l.id === selectedLightId);
                    if (l) items.push(JSON.parse(JSON.stringify(l)));
                }
                
                if (items.length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    items.forEach(i => {
                        if (i.x !== undefined) {
                            minX = Math.min(minX, i.x); minY = Math.min(minY, i.y);
                            maxX = Math.max(maxX, i.x); maxY = Math.max(maxY, i.y);
                        } else {
                            minX = Math.min(minX, i.x1, i.x2); minY = Math.min(minY, i.y1, i.y2);
                            maxX = Math.max(maxX, i.x1, i.x2); maxY = Math.max(maxY, i.y1, i.y2);
                        }
                    });
                    const cx = (minX + maxX) / 2;
                    const cy = (minY + maxY) / 2;
                    vttClipboard = { type: 'lighting', items, cx, cy };
                }
            } else {
                const items = [];
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                if (selectedTokenIds.size > 0) {
                    selectedTokenIds.forEach(id => {
                        const t = tokens[id];
                        if (t) {
                            items.push({ type: 'token', data: JSON.parse(JSON.stringify(t)) });
                            minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
                            maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y);
                        }
                    });
                }
                if (typeof selectedShapeIds !== 'undefined' && selectedShapeIds.size > 0) {
                    selectedShapeIds.forEach(id => {
                        const s = shapes[id];
                        if (s) {
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
                    vttClipboard = { type: 'objects', items, cx, cy };
                }
            }
        }

        function pasteClipboard() {
            if (!vttClipboard || !vttClipboard.items || vttClipboard.items.length === 0) return;
            
            const dx = currentMouseCoords.x - vttClipboard.cx;
            const dy = currentMouseCoords.y - vttClipboard.cy;
            
            if (vttClipboard.type === 'lighting' && activeLayer === 'lighting') {
                let changedLights = false;
                let changedWalls = false;
                
                if (typeof selectedWallIdxs !== 'undefined') selectedWallIdxs.clear();
                selectedLightId = null;
                
                vttClipboard.items.forEach(item => {
                    const newItem = JSON.parse(JSON.stringify(item));
                    if (newItem.x !== undefined) {
                        newItem.id = 'light_' + Date.now() + Math.random().toString(36).substr(2,5);
                        newItem.x += dx;
                        newItem.y += dy;
                        if (!Array.isArray(lights)) lights = [];
                        lights.push(newItem);
                        selectedLightId = newItem.id;
                        changedLights = true;
                    } else {
                        newItem.id = 'wall_' + Date.now() + Math.random().toString(36).substr(2,5);
                        newItem.x1 += dx; newItem.y1 += dy;
                        newItem.x2 += dx; newItem.y2 += dy;
                        if (!Array.isArray(walls)) walls = [];
                        walls.push(newItem);
                        if (typeof selectedWallIdxs !== 'undefined') selectedWallIdxs.add(walls.length - 1);
                        changedWalls = true;
                    }
                });
                if (changedLights) vtt.socket.emit('lights:update', { mapId: currentMapId, lights });
                if (changedWalls) vtt.socket.emit('walls:update', { mapId: currentMapId, walls });
                renderAll();
            } else if (vttClipboard.type === 'objects' && activeLayer !== 'lighting') {
                let changedTokens = false;
                let changedShapes = false;
                
                selectedTokenIds.clear();
                if (typeof selectedShapeIds !== 'undefined') selectedShapeIds.clear();
                
                vttClipboard.items.forEach(item => {
                    if (item.type === 'token') {
                        const t = JSON.parse(JSON.stringify(item.data));
                        t.layer = activeLayer; // Paste to current layer
                        t.x += dx;
                        t.y += dy;
                        const newId = 'token_' + Date.now() + Math.random().toString(36).substr(2,5);
                        t.id = newId;
                        tokens[newId] = t;
                        selectedTokenIds.add(newId);
                        changedTokens = true;
                    } else if (item.type === 'shape') {
                        const s = JSON.parse(JSON.stringify(item.data));
                        s.layer = activeLayer;
                        s.startPoint.x += dx; s.startPoint.y += dy;
                        s.endPoint.x += dx; s.endPoint.y += dy;
                        if (s.points) {
                            s.points.forEach(p => { p.x += dx; p.y += dy; });
                        }
                        const newId = 'shape_' + Date.now() + Math.random().toString(36).substr(2,5);
                        s.id = newId;
                        if (typeof shapes === 'undefined') window.shapes = {};
                        shapes[newId] = s;
                        if (typeof selectedShapeIds !== 'undefined') selectedShapeIds.add(newId);
                        changedShapes = true;
                    }
                });
                if (changedTokens) window.emitTokenUpdates(tokens);
                if (changedShapes) vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                renderAll();
            }
        }

        window.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key ? e.key.toLowerCase() : '';

            if (e.key === ' ' && (isTokenMeasuring || localIsMeasuring || localIsShaping)) {
                const rawShapeMeasure = document.getElementById('measure-shape')?.value || 'line';
                if (isTokenMeasuring || ((activeTool === 'measure' || activeTool === 'shape') && rawShapeMeasure === 'line')) {
                    e.preventDefault();
                    measureAnchorPoints.push(e.altKey ? currentMouseCoords : snapToGridCenter(currentMouseCoords.x, currentMouseCoords.y));
                    if (localIsMeasuring) localMeasureEnd = currentMouseCoords;
                    if (localIsShaping) localShapeEnd = currentMouseCoords;
                    renderAll();
                    return;
                }
            }

            if ((e.key === 'Backspace' || e.key === 'Delete') && (isTokenMeasuring || localIsMeasuring || localIsShaping)) {
                e.preventDefault();
                if (measureAnchorPoints.length > 1) {
                    measureAnchorPoints.pop();
                    renderAll();
                }
                return;
            }

            if (e.key === 'Escape') {
                // Clear active measurements or shapes
                if (localIsMeasuring || localIsShaping || isTokenMeasuring || dragTargetId) {
                    if (dragTargetId) {
                        const originalPos = tokenDragOriginalPositions[dragTargetId];
                        if (originalPos && tokens[dragTargetId]) {
                            tokens[dragTargetId].x = originalPos.x;
                            tokens[dragTargetId].y = originalPos.y;
                            window.emitTokenUpdates(tokens);
                        }
                        dragTargetId = null; 
                    }
                    if (isTokenMeasuring) {
                        isTokenMeasuring = false;
                    }
                    if (localIsMeasuring) {
                        localIsMeasuring = false;
                        vtt.socket.emit('measure:cleared', { mapId: currentMapId, username: vtt.username });
                        localMeasureStart = null;
                        localMeasureEnd = null;
                    }
                    if (localIsShaping) {
                        localIsShaping = false;
                        localShapeStart = null;
                        localShapeEnd = null;
                    }
                    measureAnchorPoints = [];
                }

                // Close note viewer if open
                const noteViewer = document.getElementById('vtt-note-viewer');
                if (noteViewer) { noteViewer.remove(); return; }
                selectedTokenIds.clear();
                gmTokenVisionMode = false;
                if (typeof selectedShapeIds !== 'undefined') selectedShapeIds.clear();
                if (typeof selectedWallIdxs !== 'undefined') selectedWallIdxs.clear();
                selectedLightId = null;
                hoveredLightId = null;
                hoveredWallIdx = -1;
                selectedNoteId = null;
                renderAll();
                return;
            }

            if (e.shiftKey && key === 'l' && vtt.role === 'GM') {
                e.preventDefault();
                gmTokenVisionMode = !gmTokenVisionMode;
                if (gmTokenVisionMode && selectedTokenIds.size === 0) {
                    gmTokenVisionMode = false;
                }
                renderAll();
                return;
            }

            if (isCtrl && key === 'a') {
                e.preventDefault();
                selectedTokenIds.clear();
                if (typeof selectedShapeIds !== 'undefined') selectedShapeIds.clear();
                if (typeof selectedWallIdxs !== 'undefined') selectedWallIdxs.clear();
                selectedLightId = null;
                
                if (activeLayer === 'lighting') {
                    if (typeof walls !== 'undefined') walls.forEach((w, idx) => selectedWallIdxs.add(idx));
                } else {
                    if (typeof tokens !== 'undefined') {
                        Object.keys(tokens).forEach(id => {
                            const t = tokens[id];
                            if (t && (t.layer === activeLayer || (activeLayer === 'gm' && t.layer === 'gm'))) {
                                selectedTokenIds.add(id);
                            }
                        });
                    }
                    if (typeof shapes !== 'undefined') {
                        Object.keys(shapes).forEach(id => {
                            const s = shapes[id];
                            if (s && s.layer === activeLayer) {
                                selectedShapeIds.add(id);
                            }
                        });
                    }
                }
                renderAll();
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

            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (selectedTokenIds.size > 0 || (typeof selectedShapeIds !== 'undefined' && selectedShapeIds.size > 0)) {
                    e.preventDefault();
                    let dx = 0;
                    let dy = 0;
                    const unitSize = (grid && grid.size ? grid.size : 50) * (grid && grid.scale ? grid.scale : 1);
                    if (e.key === 'ArrowUp') dy = -unitSize;
                    if (e.key === 'ArrowDown') dy = unitSize;
                    if (e.key === 'ArrowLeft') dx = -unitSize;
                    if (e.key === 'ArrowRight') dx = unitSize;

                    let changedTokens = false;
                    let changedShapes = false;

                    selectedTokenIds.forEach(id => {
                        const t = tokens[id];
                        if (isTokenControlledByPlayer(t)) {
                            let logicalX = t.x;
                            let logicalY = t.y;
                            if (tokenAnimations[id]) {
                                logicalX = tokenAnimations[id].endX;
                                logicalY = tokenAnimations[id].endY;
                            }
                            let nx = logicalX + dx;
                            let ny = logicalY + dy;

                            const currentMap = vtt.campaignState?.maps?.[currentMapId];
                            if (vtt.role !== 'GM' && currentMap?.lightingSettings?.restrictMovement) {
                                const { drawW, drawH } = getTokenDrawDimensions(t);
                                const radius = Math.min(drawW, drawH) / 2;
                                const startCenter = { x: logicalX + drawW / 2, y: logicalY + drawH / 2 };
                                const endCenter = { x: nx + drawW / 2, y: ny + drawH / 2 };
                                
                                let closestT = 1.0;
                                let collisionPoint = null;
                                
                                walls.forEach(wall => {
                                    if (wall.isOpen) return;
                                    const intersect = getLineIntersection(startCenter.x, startCenter.y, endCenter.x, endCenter.y, wall.x1, wall.y1, wall.x2, wall.y2);
                                    if (intersect && intersect.t < closestT) {
                                        closestT = intersect.t;
                                        collisionPoint = intersect;
                                    }
                                });
                                
                                if (collisionPoint) {
                                    const length = Math.hypot(dx, dy);
                                    if (length > 0) {
                                        const backupT = Math.max(0, collisionPoint.t - ((radius - 2) / length));
                                        nx = startCenter.x + dx * backupT - drawW / 2;
                                        ny = startCenter.y + dy * backupT - drawH / 2;
                                    }
                                }
                            }
                            
                            if (logicalX !== nx || logicalY !== ny) {
                                t._animReq = {
                                    startX: t.x,
                                    startY: t.y,
                                    endX: nx,
                                    endY: ny,
                                    waypoints: [],
                                    timestamp: Date.now(),
                                    duration: 300
                                };
                            }
                            
                            t.x = nx;
                            t.y = ny;
                            changedTokens = true;
                        }
                    });
                    
                    if (typeof selectedShapeIds !== 'undefined') {
                        selectedShapeIds.forEach(id => {
                            const s = shapes[id];
                            if (s) {
                                s.startPoint.x += dx; s.startPoint.y += dy;
                                s.endPoint.x += dx; s.endPoint.y += dy;
                                if (s.points) s.points.forEach(p => { p.x += dx; p.y += dy; });
                                changedShapes = true;
                            }
                        });
                    }

                    if (changedTokens) {
                        processTokenAnimReqs(tokens, true);
                        window.emitTokenUpdates(tokens);
                    }
                    if (changedShapes) vtt.socket.emit('shapes:update', { mapId: currentMapId, shapes });
                    if (changedTokens || changedShapes) renderAll();
                }
                return;
            }
        });
    }

    // Initial render
    setTimeout(() => renderAll(), 500);
    
    // Start Visual FX continuous loop
    animateVisualFx();

    return engine;
}
