import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isTokenResizableAsset,
    getTokenResizeHandles,
    getTokenResizeHandleAt,
    applyTokenResize
} from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

test('isTokenResizableAsset: identifies assets, map layer artwork, and backgrounds', () => {
    assert.equal(isTokenResizableAsset({ isAsset: true }), true);
    assert.equal(isTokenResizableAsset({ layer: 'map' }), true);
    assert.equal(isTokenResizableAsset({ isBackground: true }), true);
    assert.equal(isTokenResizableAsset({ isAsset: false, layer: 'token', isPlayer: true }), false);
    assert.equal(isTokenResizableAsset(null), false);
});

test('getTokenResizeHandles: generates all 8 handles with correct positions and cursors', () => {
    const token = {
        id: 'map_art',
        x: 100,
        y: 200,
        pixelWidth: 400,
        pixelHeight: 300,
        layer: 'map',
        isAsset: true
    };

    const getDims = (t) => ({ drawW: t.pixelWidth, drawH: t.pixelHeight });
    const handles = getTokenResizeHandles(token, getDims);

    assert.ok(handles, 'Handles should be returned');
    const expectedKeys = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    assert.deepEqual(Object.keys(handles).sort(), expectedKeys.sort());

    // Corner handles
    assert.deepEqual(handles.nw, { id: 'nw', x: 100, y: 200, cursor: 'nwse-resize' });
    assert.deepEqual(handles.ne, { id: 'ne', x: 500, y: 200, cursor: 'nesw-resize' });
    assert.deepEqual(handles.se, { id: 'se', x: 500, y: 500, cursor: 'nwse-resize' });
    assert.deepEqual(handles.sw, { id: 'sw', x: 100, y: 500, cursor: 'nesw-resize' });

    // Edge centers
    assert.deepEqual(handles.n, { id: 'n', x: 300, y: 200, cursor: 'ns-resize' });
    assert.deepEqual(handles.e, { id: 'e', x: 500, y: 350, cursor: 'ew-resize' });
    assert.deepEqual(handles.s, { id: 's', x: 300, y: 500, cursor: 'ns-resize' });
    assert.deepEqual(handles.w, { id: 'w', x: 100, y: 350, cursor: 'ew-resize' });
});

test('getTokenResizeHandleAt: detects all 8 handles across camera zoom levels', () => {
    const token = {
        id: 'map_art',
        x: 0,
        y: 0,
        pixelWidth: 200,
        pixelHeight: 200,
        layer: 'map',
        isAsset: true
    };
    const getDims = (t) => ({ drawW: t.pixelWidth, drawH: t.pixelHeight });

    // Normal zoom 1.0 (threshold = 12 world units)
    assert.equal(getTokenResizeHandleAt(token, { x: 2, y: 2 }, 1.0, getDims)?.id, 'nw');
    assert.equal(getTokenResizeHandleAt(token, { x: 100, y: 3 }, 1.0, getDims)?.id, 'n');
    assert.equal(getTokenResizeHandleAt(token, { x: 198, y: 1 }, 1.0, getDims)?.id, 'ne');
    assert.equal(getTokenResizeHandleAt(token, { x: 202, y: 100 }, 1.0, getDims)?.id, 'e');
    assert.equal(getTokenResizeHandleAt(token, { x: 199, y: 199 }, 1.0, getDims)?.id, 'se');
    assert.equal(getTokenResizeHandleAt(token, { x: 100, y: 201 }, 1.0, getDims)?.id, 's');
    assert.equal(getTokenResizeHandleAt(token, { x: 2, y: 198 }, 1.0, getDims)?.id, 'sw');
    assert.equal(getTokenResizeHandleAt(token, { x: 3, y: 100 }, 1.0, getDims)?.id, 'w');

    // Far bird-eye zoom 0.25 (threshold expands to 12 / 0.25 = 48 world units for effortless clicking)
    assert.equal(getTokenResizeHandleAt(token, { x: 25, y: 25 }, 0.25, getDims)?.id, 'nw');
    assert.equal(getTokenResizeHandleAt(token, { x: 175, y: 175 }, 0.25, getDims)?.id, 'se');

    // Miss: far away point
    assert.equal(getTokenResizeHandleAt(token, { x: 500, y: 500 }, 1.0, getDims), null);
});

test('applyTokenResize: multi-directional resizing from corners and sides', () => {
    const grid = { size: 50, scale: 1.0 };
    const origGeom = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };

    // 1. South-East (bottom-right): expands w & h, x & y unchanged
    const tokSE = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };
    applyTokenResize(tokSE, origGeom, 'se', { x: 400, y: 400 }, { altKey: true }, grid);
    assert.equal(tokSE.x, 100);
    assert.equal(tokSE.y, 100);
    assert.equal(tokSE.pixelWidth, 300);
    assert.equal(tokSE.pixelHeight, 300);

    // 2. North-West (top-left): moves x & y with mouse, expands w & h towards bottom-right anchor (300, 300)
    const tokNW = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };
    applyTokenResize(tokNW, origGeom, 'nw', { x: 50, y: 50 }, { altKey: true }, grid);
    assert.equal(tokNW.x, 50);
    assert.equal(tokNW.y, 50);
    assert.equal(tokNW.pixelWidth, 250);
    assert.equal(tokNW.pixelHeight, 250);

    // 3. East (right side): expands width only
    const tokE = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };
    applyTokenResize(tokE, origGeom, 'e', { x: 350, y: 200 }, { altKey: true }, grid);
    assert.equal(tokE.x, 100);
    assert.equal(tokE.y, 100);
    assert.equal(tokE.pixelWidth, 250);
    assert.equal(tokE.pixelHeight, 200);

    // 4. West (left side): moves x, changes width towards right anchor (300)
    const tokW = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };
    applyTokenResize(tokW, origGeom, 'w', { x: 50, y: 200 }, { altKey: true }, grid);
    assert.equal(tokW.x, 50);
    assert.equal(tokW.y, 100);
    assert.equal(tokW.pixelWidth, 250);
    assert.equal(tokW.pixelHeight, 200);

    // 5. North (top side): moves y, changes height towards bottom anchor (300)
    const tokN = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };
    applyTokenResize(tokN, origGeom, 'n', { x: 200, y: 50 }, { altKey: true }, grid);
    assert.equal(tokN.x, 100);
    assert.equal(tokN.y, 50);
    assert.equal(tokN.pixelWidth, 200);
    assert.equal(tokN.pixelHeight, 250);

    // 6. South (bottom side): changes height only
    const tokS = { x: 100, y: 100, pixelWidth: 200, pixelHeight: 200 };
    applyTokenResize(tokS, origGeom, 's', { x: 200, y: 350 }, { altKey: true }, grid);
    assert.equal(tokS.x, 100);
    assert.equal(tokS.y, 100);
    assert.equal(tokS.pixelWidth, 200);
    assert.equal(tokS.pixelHeight, 250);
});

test('applyTokenResize: aspect ratio lock (Shift) and live map bounds synchronization', () => {
    const grid = { size: 50, scale: 1.0 };
    const origGeom = { x: 0, y: 0, pixelWidth: 400, pixelHeight: 200 }; // 2:1 aspect ratio
    const tok = { x: 0, y: 0, pixelWidth: 400, pixelHeight: 200, layer: 'map', isAsset: true };
    const currentMap = { id: 'map_test', gridWidth: 8, gridHeight: 4 };

    // Resize with Shift key (locking 2:1 aspect)
    applyTokenResize(tok, origGeom, 'se', { x: 600, y: 250 }, { altKey: true, shiftKey: true }, grid, null, currentMap);

    // 250 height -> width constrained to 250 * 2 = 500 to preserve 2:1 aspect
    assert.equal(tok.pixelWidth, 500);
    assert.equal(tok.pixelHeight, 250);

    // Live map dimensions updated in units of grid size (50)
    // 500 / 50 = 10 gridWidth, 250 / 50 = 5 gridHeight
    assert.equal(currentMap.gridWidth, 10);
    assert.equal(currentMap.gridHeight, 5);
});
