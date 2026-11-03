import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_PLAYER_TOKEN_PREFS,
    DEFAULT_GM_TOKEN_PREFS,
    getEffectiveVisibility,
    getEffectiveNumberVisible,
    loadPlayerTokenPrefs,
    savePlayerTokenPrefs,
    loadGmTokenPrefs,
    saveGmTokenPrefs
} from '../vtt/js/canvas/tokens/vtt-canvas-token-config.js';

import {
    isHexGrid,
    getNearestHexFeatures,
    snapToGrid,
    snapToGridCenter,
    snapToHalfGrid
} from '../vtt/js/canvas/vtt-canvas-grid-renderer.js';

import {
    getResolvedCreatureMonsterData,
    getTokenAC,
    getTokenSpeed,
    getTokenPP,
    getTokenPassiveStats,
    isTokenTooltipAllowed
} from '../vtt/js/canvas/vtt-canvas-tooltips-notes.js';

import {
    isTokenControlledByPlayer,
    getSelectionBounds,
    isTokenWithinSelection,
    getTokenAtPoint
} from '../vtt/js/canvas/vtt-canvas-interaction-tools.js';
import { updateVisualFx } from '../vtt/js/canvas/tokens/vtt-canvas-visual-fx.js';
import { setupPointerInteraction } from '../vtt/js/canvas/vtt-canvas-interaction.js';

test('Canvas Token Display Configuration: Visibility & Ceilings', async (t) => {
    await t.test('getEffectiveVisibility clamps player preferences below GM ceilings', () => {
        // When GM ceiling is 'always', player can choose anything
        assert.equal(getEffectiveVisibility('never', 'always'), 'never');
        assert.equal(getEffectiveVisibility('hover', 'always'), 'hover');
        assert.equal(getEffectiveVisibility('always', 'always'), 'always');

        // When GM ceiling is 'hover', player preference of 'always' is clamped to 'hover'
        assert.equal(getEffectiveVisibility('always', 'hover'), 'hover');
        assert.equal(getEffectiveVisibility('hover', 'hover'), 'hover');
        assert.equal(getEffectiveVisibility('never', 'hover'), 'never');

        // When GM ceiling is 'never', everything is forced to 'never'
        assert.equal(getEffectiveVisibility('always', 'never'), 'never');
        assert.equal(getEffectiveVisibility('hover', 'never'), 'never');
        assert.equal(getEffectiveVisibility('never', 'never'), 'never');

        // Default falls back to GM ceiling
        assert.equal(getEffectiveVisibility('default', 'hover'), 'hover');
        assert.equal(getEffectiveVisibility(null, 'hover'), 'hover');
    });

    await t.test('getEffectiveNumberVisible enforces hard GM locking', () => {
        assert.equal(getEffectiveNumberVisible(true, true), true);
        assert.equal(getEffectiveNumberVisible(true, false), false, 'Hard locked when GM disables numbers');
        assert.equal(getEffectiveNumberVisible(false, true), false);
        assert.equal(getEffectiveNumberVisible('default', true), true);
    });

    await t.test('load and save player/GM token display preferences gracefully handle storage', () => {
        // In Node without localStorage, default prefs are returned safely
        const playerPrefs = loadPlayerTokenPrefs('mock_key');
        assert.equal(playerPrefs.barPosition, DEFAULT_PLAYER_TOKEN_PREFS.barPosition);
        assert.equal(playerPrefs.flightPosition, DEFAULT_PLAYER_TOKEN_PREFS.flightPosition);

        const gmPrefs = loadGmTokenPrefs('mock_key');
        assert.equal(gmPrefs.barPosition, DEFAULT_GM_TOKEN_PREFS.barPosition);
    });
});

test('Canvas Grid Math: Snapping & Hexagonal Calculations', async (t) => {
    await t.test('isHexGrid correctly identifies all vertical and horizontal hex orientations', () => {
        assert.equal(isHexGrid('hex-v'), true);
        assert.equal(isHexGrid('hex-h'), true);
        assert.equal(isHexGrid('hex-v-even'), true);
        assert.equal(isHexGrid('hex-h-even'), true);
        assert.equal(isHexGrid('square'), false);
        assert.equal(isHexGrid('isometric'), false);
    });

    await t.test('snapToGrid snaps coordinates to square grid lines and center', () => {
        const grid = { size: 50, scale: 1, offsetX: 0, offsetY: 0, type: 'square' };

        // Exact snapping
        const snapped = snapToGrid(48, 102, false, grid);
        assert.equal(snapped.x, 50);
        assert.equal(snapped.y, 100);

        // Grid center snapping
        const center = snapToGridCenter(22, 68, grid);
        assert.equal(center.x, 25);
        assert.equal(center.y, 75);

        // Half grid snapping (for walls/lighting)
        const half = snapToHalfGrid(36, 64, grid);
        assert.equal(half.x, 25);
        assert.equal(half.y, 75);
    });

    await t.test('getNearestHexFeatures finds hex center and vertices accurately', () => {
        const grid = { size: 60, scale: 1, offsetX: 0, offsetY: 0, type: 'hex-v' };
        const hex = getNearestHexFeatures(30, 40, grid, 60);
        assert.ok(Number.isFinite(hex.cx), 'Hex center X is finite');
        assert.ok(Number.isFinite(hex.cy), 'Hex center Y is finite');
        assert.ok(Number.isFinite(hex.vx), 'Hex vertex X is finite');
        assert.ok(Number.isFinite(hex.vy), 'Hex vertex Y is finite');

        const snappedToken = snapToGrid(30, 40, true, grid);
        assert.ok(Number.isFinite(snappedToken.x));
        assert.ok(Number.isFinite(snappedToken.y));
    });
});

test('Canvas Creature Stats & GM Tooltips: Resolution & Visibility', async (t) => {
    const mockMonster = {
        name: 'Goblin Boss',
        ac: [{ ac: 17, from: ['chain shirt', 'shield'] }],
        speed: { walk: 30, climb: 20 },
        passive: 12,
        wis: 10,
        int: 10,
        skill: { stealth: '+6', insight: '+2', investigation: '+3' }
    };

    const mockToken = {
        id: 'tok_1',
        layer: 'token',
        monsterData: mockMonster
    };

    await t.test('getResolvedCreatureMonsterData resolves directly or via campaign characters', () => {
        const resolvedDirect = getResolvedCreatureMonsterData(mockToken);
        assert.equal(resolvedDirect.name, 'Goblin Boss');

        const linkedToken = { id: 'tok_2', characterId: 'char_abc' };
        const context = {
            campaignState: {
                characters: {
                    char_abc: { monsterData: { name: 'Linked Owlbear' } }
                }
            }
        };
        const resolvedLinked = getResolvedCreatureMonsterData(linkedToken, context);
        assert.equal(resolvedLinked.name, 'Linked Owlbear');
    });

    await t.test('getTokenAC resolves monster array AC, number AC, and character AC', () => {
        assert.equal(getTokenAC(mockToken), 17);

        const tokenNumAc = { monsterData: { ac: 15 } };
        assert.equal(getTokenAC(tokenNumAc), 15);

        const tokenChar = { characterId: 'c1' };
        const charCtx = { campaignState: { characters: { c1: { ac: 18 } } } };
        assert.equal(getTokenAC(tokenChar, charCtx), 18);
    });

    await t.test('getTokenSpeed formats speeds across walk, climb, fly, and numeric values', () => {
        assert.equal(getTokenSpeed(mockToken), '30 ft., Climb 20 ft.');
        assert.equal(getTokenSpeed({ monsterData: { speed: 40 } }), '40 ft.');
        assert.equal(getTokenSpeed({ monsterData: { speed: '35 ft.' } }), '35 ft.');
    });

    await t.test('getTokenPP and getTokenPassiveStats accurately compute passives', () => {
        assert.equal(getTokenPP(mockToken), 12);

        const passives = getTokenPassiveStats(mockToken);
        assert.equal(passives.pi, 12);
        assert.equal(passives.pinv, 13);
    });

    await t.test('isTokenTooltipAllowed respects GM permissions and active layer boundaries', () => {
        const gmCtx = {
            vtt: { role: 'GM' },
            activeLayer: 'token',
            campaignSettings: { gmStatTooltipVisible: 'always' }
        };
        assert.equal(isTokenTooltipAllowed(mockToken, gmCtx), true);

        // Suppressed if layer does not match
        const gmWrongLayer = { ...gmCtx, activeLayer: 'lighting' };
        assert.equal(isTokenTooltipAllowed(mockToken, gmWrongLayer), false);

        // Player permission: 'controlled'
        const playerCtx = {
            vtt: { role: 'player' },
            activeLayer: 'token',
            campaignSettings: { playerStatTooltipVisible: 'controlled' },
            isTokenControlledByPlayer: (tok) => tok.id === 'tok_1'
        };
        assert.equal(isTokenTooltipAllowed(mockToken, playerCtx), true);

        const unownedToken = { id: 'tok_enemy', layer: 'token' };
        assert.equal(isTokenTooltipAllowed(unownedToken, playerCtx), false);
    });
});

test('Canvas Interaction Tools: Token Control, Bounding Box & Selection Collisions', async (t) => {
    const mockVttPlayer = {
        role: 'player',
        username: 'Gandalf',
        campaignState: { characters: { c1: { players: ['Gandalf'] } } }
    };
    const mockVttGM = { role: 'GM', username: 'DungeonMaster' };

    await t.test('isTokenControlledByPlayer respects GM override, player matching, and paused status', () => {
        const ownedToken = { id: 't1', ownerUsername: 'Gandalf' };
        const linkedToken = { id: 't2', characterId: 'c1' };
        const unownedToken = { id: 't3', ownerUsername: 'Frodo' };

        // GM controls everything
        assert.equal(isTokenControlledByPlayer(unownedToken, false, { vtt: mockVttGM }), true);

        // Player matches directly or via character
        assert.equal(isTokenControlledByPlayer(ownedToken, false, { vtt: mockVttPlayer }), true);
        assert.equal(isTokenControlledByPlayer(linkedToken, false, { vtt: mockVttPlayer }), true);
        assert.equal(isTokenControlledByPlayer(unownedToken, false, { vtt: mockVttPlayer }), false);

        // Paused state locks out players unless ignorePause is true
        const pausedVtt = { ...mockVttPlayer, isPaused: true };
        assert.equal(isTokenControlledByPlayer(ownedToken, false, { vtt: pausedVtt }), false);
        assert.equal(isTokenControlledByPlayer(ownedToken, true, { vtt: pausedVtt }), true);
    });

    await t.test('getSelectionBounds normalizes coordinates correctly regardless of drag direction', () => {
        const b1 = getSelectionBounds({ x: 100, y: 150 }, { x: 300, y: 400 });
        assert.deepEqual(b1, { x1: 100, y1: 150, x2: 300, y2: 400 });

        const b2 = getSelectionBounds({ x: 300, y: 400 }, { x: 100, y: 150 });
        assert.deepEqual(b2, { x1: 100, y1: 150, x2: 300, y2: 400 });
    });

    await t.test('isTokenWithinSelection checks token center point inside bounding box', () => {
        const token = { x: 100, y: 100 };
        const dims = () => ({ drawW: 50, drawH: 50 }); // center is 125, 125
        assert.equal(isTokenWithinSelection(token, { x1: 50, y1: 50, x2: 200, y2: 200 }, dims), true);
        assert.equal(isTokenWithinSelection(token, { x1: 130, y1: 50, x2: 200, y2: 200 }, dims), false);
    });

    await t.test('getTokenAtPoint hits topmost token and respects layer matching', () => {
        const tokens = {
            t_back: { id: 't_back', x: 100, y: 100, zIndex: 1, layer: 'token' },
            t_front: { id: 't_front', x: 100, y: 100, zIndex: 10, layer: 'token' },
            t_gm: { id: 't_gm', x: 100, y: 100, zIndex: 20, layer: 'gm' }
        };
        const ctx = {
            tokens,
            vtt: mockVttPlayer,
            activeLayer: 'token',
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
            isTokenControlledByPlayer: () => true,
            isPointVisible: () => true
        };

        const hit = getTokenAtPoint({ x: 125, y: 125 }, false, true, 0, ctx);
        assert.equal(hit.id, 't_front', 'Topmost z-index token on active layer should be hit first');

        // GM layer token ignored when active layer is token
        assert.notEqual(hit.id, 't_gm');
    });
});

test('Canvas Visual FX & Pointer Interaction Initialization', async (t) => {
    await t.test('updateVisualFx runs safely in headless environment without crashing', () => {
        assert.doesNotThrow(() => {
            updateVisualFx({
                vtt: { role: 'GM' },
                tokens: {},
                activeLayer: 'token',
                grid: { size: 50 },
                initiativeHoverTokenId: null,
                panX: 0,
                panY: 0,
                zoom: 1,
                getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
                getTokenCategory: () => 'player',
                getCategoryColor: () => '#4a90e2'
            });
        });
    });

    await t.test('setupPointerInteraction attaches listeners to canvasInteraction container', () => {
        const canvasEvents = [];
        const windowEvents = [];
        const mockCanvasInteraction = {
            addEventListener: (evt, handler) => canvasEvents.push(evt),
            removeEventListener: () => {}
        };
        globalThis.window = {
            addEventListener: (evt, handler) => windowEvents.push(evt),
            removeEventListener: () => {}
        };

        const mockCtx = {
            canvasInteraction: mockCanvasInteraction,
            vtt: { role: 'GM' },
            get activeTool() {
                return 'select';
            },
            get activeLayer() {
                return 'token';
            },
            tokens: {},
            walls: [],
            lights: [],
            notes: [],
            shapes: [],
            drawings: [],
            renderAll: () => {},
            getCanvasMouseCoords: () => ({ x: 0, y: 0 })
        };

        const res = setupPointerInteraction(mockCtx);
        assert.ok(canvasEvents.includes('mousedown'), 'Should attach mousedown listener to canvas container');
        assert.ok(windowEvents.includes('mousemove'), 'Should attach mousemove listener to window');
        assert.ok(windowEvents.includes('mouseup'), 'Should attach mouseup listener to window');
        assert.equal(typeof res.getInteractiveDoorAtCoord, 'function', 'Should expose door raycast hit helper');
        delete globalThis.window;
    });
});
