import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderProjectedPortals, drawTargetRoomContent } from '../vtt/js/canvas/vtt-canvas-portals.js';
import {
    applyDamageToTokens,
    changeMassTokenZOrder,
    showMassRollContextMenu
} from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';
import { setupViewportControls } from '../vtt/js/canvas/vtt-canvas-interaction-tools.js';
import { setupKeyboardShortcuts } from '../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js';
import { initVttDataBridge } from '../vtt/js/vtt-data-bridge.js';

describe('Portal See-Through Reconnected Bridges', () => {
    it('drawTargetRoomContent resolves target map from campaignState', () => {
        let drawImageCalls = [];
        const fakeCtx = {
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            closePath: () => {},
            clip: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fill: () => {},
            arc: () => {},
            fillRect: () => {},
            fillText: () => {},
            rotate: () => {},
            drawImage: (...args) => drawImageCalls.push(args),
            setTransform: () => {},
            scale: () => {},
            translate: () => {}
        };

        const targetMap = {
            id: 'map_b',
            title: 'Destination Room',
            width: 2000,
            height: 2000,
            mapImage: 'http://localhost:5050/maps/room_b.png',
            tokens: {
                tok_dest: { id: 'tok_dest', x: 200, y: 200, width: 50, height: 50, isPlayer: false }
            },
            walls: []
        };

        const currentMap = {
            id: 'map_a',
            title: 'Origin Room',
            width: 2000,
            height: 2000
        };

        const campaignState = {
            maps: {
                map_a: currentMap,
                map_b: targetMap
            }
        };

        const fakeVtt = {
            campaignState,
            currentMapId: 'map_a'
        };

        const fakeImageCache = {
            has: () => true,
            get: () => ({ complete: true, naturalWidth: 1000, naturalHeight: 1000 })
        };

        assert.doesNotThrow(() => {
            drawTargetRoomContent(
                fakeCtx,
                targetMap,
                'map_b',
                2000,
                2000,
                targetMap.tokens,
                targetMap.walls,
                { x: 100, y: 100 },
                { x: 500, y: 500 },
                {
                    currentMapId: 'map_a',
                    campaignState,
                    vtt: fakeVtt,
                    imageCache: fakeImageCache,
                    getSafeVttUrl: (u) => u
                }
            );
        });
    });

    it('renderProjectedPortals passes campaignState and destination correctly', () => {
        let roomContentRendered = false;
        const fakeCtx = {
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            closePath: () => {},
            clip: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fill: () => {},
            arc: () => {},
            rect: () => {},
            translate: () => {},
            rotate: () => {},
            scale: () => {},
            setLineDash: () => {},
            clearRect: () => {}
        };

        const targetPortal = {
            id: 'p2',
            shape: 'line',
            geom: { x1: 500, y1: 500, x2: 600, y2: 500 }
        };

        const currentMap = { id: 'map_a', width: 1000, height: 1000 };
        const targetMap = { id: 'map_b', width: 1000, height: 1000, tokens: {}, walls: [], portals: [targetPortal] };
        const campaignState = {
            maps: { map_a: currentMap, map_b: targetMap }
        };

        const portals = [
            {
                id: 'p1',
                shape: 'line',
                geom: { x1: 100, y1: 100, x2: 200, y2: 100 },
                targetMapId: 'map_b',
                targetPortalId: 'p2',
                oneWay: false,
                viewThrough: true,
                reflectMode: 'none',
                color: '#00ffff'
            }
        ];

        const tokens = {
            t1: { id: 't1', x: 150, y: 50, size: 1, sightRange: 60, isPlayer: true }
        };

        renderProjectedPortals(fakeCtx, portals, {
            vtt: { campaignState, role: 'GM' },
            campaignState,
            currentMapId: 'map_a',
            tokens,
            walls: [],
            selectedTokenIds: new Set(['t1']),
            getTokenCenter: (t) => ({ x: t.x + 25, y: t.y + 25 }),
            getTokenDrawDimensions: (t) => ({ drawW: 50, drawH: 50, tokenRadius: 25 }),
            getWallCoordinatesForRaycasting: () => [],
            drawTargetRoomContent: (ctx, tMap, tMapId, tw, th, tToks, tWalls, cA, cB, opts) => {
                roomContentRendered = true;
                assert.equal(tMapId, 'map_b');
            }
        });

        assert.equal(roomContentRendered, true, 'Projected portals drew target room content');
    });
});

describe('Measurement & Shape Context Synchronization', () => {
    it('keyboard shortcuts reset ctx measurement and shaping properties', () => {
        let clearedMeasure = false;
        let rendered = false;
        let keydownHandler = null;

        // Mock window and document for unit test
        global.window = {
            addEventListener: (ev, handler) => {
                if (ev === 'keydown') keydownHandler = handler;
            }
        };
        global.document = {
            activeElement: { tagName: 'BODY', isContentEditable: false },
            getElementById: () => null
        };

        const ctx = {
            vtt: {
                role: 'GM',
                username: 'DM',
                socket: {
                    emit: (ev) => {
                        if (ev === 'measure:clear') clearedMeasure = true;
                    }
                }
            },
            currentMapId: 'map_1',
            activeTool: 'select',
            localIsMeasuring: true,
            isTokenMeasuring: true,
            localIsShaping: true,
            localMeasureStart: { x: 10, y: 10 },
            localMeasureEnd: { x: 50, y: 50 },
            localShapeStart: { x: 20, y: 20 },
            localShapeEnd: { x: 80, y: 80 },
            measureAnchorPoints: [
                { x: 10, y: 10 },
                { x: 30, y: 30 }
            ],
            gmTokenVisionMode: true,
            selectedTokenIds: new Set(['tok1']),
            renderAll: () => {
                rendered = true;
            }
        };

        setupKeyboardShortcuts(ctx);
        assert.ok(keydownHandler, 'keydown handler registered');

        // Simulate Escape keydown
        keydownHandler({
            key: 'Escape',
            target: { tagName: 'CANVAS', isContentEditable: false },
            preventDefault: () => {}
        });

        // Verify that Escape cleared measurement, shaping, anchor points, and gm vision mode on ctx!
        assert.equal(ctx.localIsMeasuring, false, 'ctx.localIsMeasuring was reset to false');
        assert.equal(ctx.isTokenMeasuring, false, 'ctx.isTokenMeasuring was reset to false');
        assert.equal(ctx.localIsShaping, false, 'ctx.localIsShaping was reset to false');
        assert.equal(ctx.localMeasureStart, null, 'ctx.localMeasureStart was reset to null');
        assert.equal(ctx.localMeasureEnd, null, 'ctx.localMeasureEnd was reset to null');
        assert.equal(ctx.localShapeStart, null, 'ctx.localShapeStart was reset to null');
        assert.equal(ctx.localShapeEnd, null, 'ctx.localShapeEnd was reset to null');
        assert.equal(ctx.measureAnchorPoints.length, 0, 'ctx.measureAnchorPoints was cleared');
        assert.equal(ctx.gmTokenVisionMode, false, 'ctx.gmTokenVisionMode was reset');
        assert.equal(clearedMeasure, true, 'measure:clear socket event was emitted');
        assert.equal(rendered, true, 'renderAll was called');

        delete global.window;
        delete global.document;
    });
});

describe('Token Mass Actions Parameter Wiring', () => {
    it('applyDamageToTokens correctly extracts options.tokens and applies damage', () => {
        let rendered = false;

        const fakeTokens = {
            tok1: { id: 'tok1', hp: 20, maxHp: 20, tempHp: 0 }
        };

        const options = {
            tokens: fakeTokens,
            currentMapId: 'map_1',
            vtt: { socket: { emit: () => {} } },
            renderAll: () => {
                rendered = true;
            },
            syncTokensHpToCharacters: () => {}
        };

        // Signature: (tokenIds, amount, type, mode, attackMeta, options)
        applyDamageToTokens(['tok1'], 10, 'slashing', 'damage', {}, options);

        assert.equal(fakeTokens.tok1.hp, 10, 'Token took 10 damage');
        assert.equal(rendered, true, 'Render was requested');
    });

    it('changeMassTokenZOrder accepts tokenIds array and applies action', () => {
        let rendered = false;
        const fakeTokens = {
            tok1: { id: 'tok1', zIndex: 1 },
            tok2: { id: 'tok2', zIndex: 5 }
        };

        const options = {
            tokens: fakeTokens,
            selectedTokenIds: new Set(['tok1', 'tok2']),
            currentMapId: 'map_1',
            vtt: { socket: { emit: () => {} } },
            renderAll: () => {
                rendered = true;
            }
        };

        changeMassTokenZOrder(['tok1'], 'front', options);
        assert.ok(fakeTokens.tok1.zIndex > 5, 'tok1 brought to front of all tokens');
        assert.equal(rendered, true);
    });

    it('showMassRollContextMenu accepts tokenIds array first', () => {
        global.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: () => {} };
        global.document = {
            getElementById: () => null,
            createElement: () => ({
                appendChild: () => {},
                setAttribute: () => {},
                style: {},
                classList: { add: () => {} },
                addEventListener: () => {},
                remove: () => {},
                getBoundingClientRect: () => ({ width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }),
                querySelector: () => null,
                querySelectorAll: () => []
            }),
            body: { appendChild: () => {} }
        };

        const fakeTokens = {
            tok1: { id: 'tok1', name: 'Goblin 1', hp: 7, maxHp: 7 }
        };

        const options = {
            tokens: fakeTokens,
            selectedTokenIds: new Set(['tok1']),
            vtt: { role: 'GM' },
            currentMapId: 'map_1',
            renderAll: () => {},
            promptMassAttackDistribution: () => {},
            rollSavingThrowToken: () => {},
            showApplyDamageModal: () => {},
            changeMassTokenZOrder: () => {}
        };

        assert.doesNotThrow(() => {
            showMassRollContextMenu(['tok1'], 100, 200, options);
        });

        delete global.document;
    });

    it('canvas contextmenu triggers showMassRollContextMenu when right-clicking a token in a multi-token selection', () => {
        let listeners = {};
        const mockCanvas = {
            addEventListener: (ev, fn) => {
                listeners[ev] = fn;
            },
            removeEventListener: () => {}
        };
        let massRollCalledWith = null;
        let singleTokenMenuCalledWith = null;
        const selectedTokenIds = new Set(['tok1', 'tok2']);

        const mockContext = {
            canvasInteraction: mockCanvas,
            viewport: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }) },
            vtt: { role: 'GM' },
            activeLayer: 'token',
            selectedTokenIds,
            getCanvasMouseCoords: () => ({ x: 25, y: 25 }),
            showMassRollContextMenu: (tokens, x, y) => {
                massRollCalledWith = { tokens, x, y };
            },
            showTokenContextMenu: (id, x, y) => {
                singleTokenMenuCalledWith = { id, x, y };
            },
            tokens: {
                tok1: { id: 'tok1', x: 0, y: 0, layer: 'token' },
                tok2: { id: 'tok2', x: 100, y: 100, layer: 'token' }
            }
        };

        setupViewportControls(mockContext);
        assert.ok(listeners.contextmenu, 'contextmenu listener attached');

        let defaultPrevented = false;
        let propagationStopped = false;
        const fakeEvt = {
            clientX: 150,
            clientY: 250,
            preventDefault: () => {
                defaultPrevented = true;
            },
            stopPropagation: () => {
                propagationStopped = true;
            }
        };

        listeners.contextmenu(fakeEvt);
        assert.ok(defaultPrevented, 'default prevented');
        assert.ok(propagationStopped, 'propagation stopped');
        assert.deepEqual(massRollCalledWith, { tokens: ['tok1', 'tok2'], x: 150, y: 250 });
        assert.equal(singleTokenMenuCalledWith, null);
    });

    it('canvas contextmenu preserves multi-selection and triggers showTokenContextMenu when right-clicking an unselected token', () => {
        let listeners = {};
        const mockCanvas = {
            addEventListener: (ev, fn) => {
                listeners[ev] = fn;
            },
            removeEventListener: () => {}
        };
        let massRollCalledWith = null;
        let singleTokenMenuCalledWith = null;
        const selectedTokenIds = new Set(['tok1', 'tok2']);

        const mockContext = {
            canvasInteraction: mockCanvas,
            viewport: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }) },
            vtt: { role: 'GM' },
            activeLayer: 'token',
            selectedTokenIds,
            getCanvasMouseCoords: () => ({ x: 220, y: 220 }),
            showMassRollContextMenu: (tokens, x, y) => {
                massRollCalledWith = { tokens, x, y };
            },
            showTokenContextMenu: (id, x, y) => {
                singleTokenMenuCalledWith = { id, x, y };
            },
            tokens: {
                tok1: { id: 'tok1', x: 0, y: 0, layer: 'token' },
                tok2: { id: 'tok2', x: 100, y: 100, layer: 'token' },
                tok3: { id: 'tok3', x: 200, y: 200, layer: 'token' }
            }
        };

        setupViewportControls(mockContext);

        const fakeEvt = {
            clientX: 300,
            clientY: 400,
            preventDefault: () => {},
            stopPropagation: () => {}
        };

        listeners.contextmenu(fakeEvt);
        assert.equal(massRollCalledWith, null, 'massRollContextMenu should not be called');
        assert.deepEqual(singleTokenMenuCalledWith, { id: 'tok3', x: 300, y: 400 });
        assert.equal(selectedTokenIds.size, 2);
        assert.ok(selectedTokenIds.has('tok1'));
        assert.ok(selectedTokenIds.has('tok2'));
    });
});

describe('Drag and Drop Wire Verification', () => {
    it('attaches dragover and drop handlers to viewport, canvas-container, and interaction canvas', () => {
        const listeners = {
            viewport: {},
            container: {},
            canvas: {}
        };

        const createMockTarget = (name) => ({
            addEventListener: (ev, handler) => {
                listeners[name][ev] = handler;
            },
            removeEventListener: () => {}
        });

        const mockViewport = createMockTarget('viewport');
        const mockContainer = createMockTarget('container');
        const mockCanvas = createMockTarget('canvas');

        global.document = {
            getElementById: (id) => {
                if (id === 'vtt-canvas-viewport') return mockViewport;
                if (id === 'canvas-container') return mockContainer;
                if (id === 'vtt-canvas-interaction') return mockCanvas;
                return {
                    addEventListener: () => {},
                    removeEventListener: () => {}
                };
            },
            querySelector: () => null,
            querySelectorAll: () => []
        };

        global.localStorage = {
            getItem: () => null,
            setItem: () => {}
        };
        global.window = {
            location: { search: '' },
            localStorage: global.localStorage,
            VTT: {
                canvasEngine: {
                    getGrid: () => ({ size: 50, scale: 1 }),
                    getActiveLayer: () => 'token',
                    getCanvasMouseCoords: () => ({ x: 100, y: 100 }),
                    addToken: () => {}
                }
            }
        };

        initVttDataBridge(global.window.VTT);

        // Verify that dragover and drop are registered on ALL three targets
        assert.ok(typeof listeners.viewport.dragover === 'function', 'viewport has dragover');
        assert.ok(typeof listeners.viewport.drop === 'function', 'viewport has drop');
        assert.ok(typeof listeners.container.dragover === 'function', 'container has dragover');
        assert.ok(typeof listeners.container.drop === 'function', 'container has drop');
        assert.ok(typeof listeners.canvas.dragover === 'function', 'canvas has dragover');
        assert.ok(typeof listeners.canvas.drop === 'function', 'canvas has drop');

        // Verify dragover calls preventDefault() and sets dropEffect = copy
        let prevented = false;
        const dragOverEv = {
            preventDefault: () => {
                prevented = true;
            },
            dataTransfer: {}
        };
        listeners.canvas.dragover(dragOverEv);
        assert.equal(prevented, true, 'canvas dragover calls preventDefault');
        assert.equal(dragOverEv.dataTransfer.dropEffect, 'copy', 'canvas dragover sets copy');

        delete global.document;
        delete global.window;
        delete global.localStorage;
    });
});
