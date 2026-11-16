import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { clearMapArtwork, isMapBackgroundAsset, setupEditMapModal } from '../vtt/js/canvas/vtt-canvas-map-manager.js';
import { showTokenContextMenu } from '../vtt/js/canvas/tokens/vtt-canvas-token-menu.js';
import { setupKeyboardShortcuts } from '../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js';

function setDom(html) {
    const dom = new JSDOM(html, { url: 'http://localhost' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    return dom;
}

test('clearing map artwork removes background assets and preserves decorative map assets', () => {
    const map = {
        mapImage: '/maps/dungeon.webp',
        thumbnail: '/maps/dungeon-thumb.webp',
        tokens: {
            background: {
                id: 'asset_dungeon_bg',
                layer: 'map',
                isAsset: true,
                isBackground: true
            },
            decorative: {
                id: 'decorative',
                layer: 'map',
                isAsset: true,
                isBackground: false,
                img: '/assets/tree.webp'
            }
        }
    };

    assert.equal(isMapBackgroundAsset(map.tokens.background, 'dungeon'), true);
    assert.deepEqual(clearMapArtwork(map, 'dungeon'), ['background']);
    assert.equal(map.mapImage, '');
    assert.equal(map.thumbnail, '');
    assert.deepEqual(Object.keys(map.tokens), ['decorative']);
});

test('map editor persists cleared artwork and refreshes the active canvas', () => {
    const dom = setDom(`<!doctype html><body>
        <div id="modal-edit-map"></div>
        <button id="btn-edit-map-close"></button>
        <input id="edit-map-name" value="Dungeon">
        <input id="edit-map-folder" value="">
        <input id="edit-map-url" value="">
        <input id="edit-map-grid-width" value="40">
        <input id="edit-map-grid-height" value="30">
        <input id="edit-map-grid-type" value="square">
        <input id="edit-map-grid-size" value="50">
        <input id="edit-map-offset-x" value="0">
        <input id="edit-map-offset-y" value="0">
        <input id="edit-map-grid-color" value="#888888">
        <input id="edit-map-grid-opacity" value="0.3">
        <input id="edit-map-dist-val" value="5">
        <select id="edit-map-dist-unit"><option value="ft" selected>ft</option></select>
        <input id="edit-map-dist-unit-custom" value="">
        <input id="edit-map-fog-of-war" type="checkbox" checked>
        <input id="edit-map-daylight-mode" type="checkbox">
        <input id="edit-map-restrict-movement" type="checkbox">
        <input id="edit-map-update-on-drop" type="checkbox" checked>
    </body>`);

    const map = {
        id: 'dungeon',
        name: 'Dungeon',
        mapImage: '/maps/dungeon.webp',
        thumbnail: '/maps/dungeon.webp',
        gridWidth: 40,
        gridHeight: 30,
        grid: { size: 50, scale: 1, feetPerSquare: 5, distanceUnit: 'ft' },
        lightingSettings: {},
        tokens: {
            background: {
                id: 'asset_dungeon_bg',
                layer: 'map',
                isAsset: true,
                isBackground: true,
                img: '/maps/dungeon.webp'
            },
            decorative: {
                id: 'decorative',
                layer: 'map',
                isAsset: true,
                isBackground: false,
                img: '/assets/tree.webp'
            }
        }
    };
    const mapEdits = [];
    const backgroundRefreshes = [];
    let renderCount = 0;
    const managerState = { editingMapId: 'dungeon' };
    const vtt = {
        campaignState: { maps: { dungeon: map } },
        socket: { emit: (...args) => mapEdits.push(args) }
    };

    setupEditMapModal(managerState, {
        vtt,
        getCurrentMapId: () => 'dungeon',
        setMapBackground: (url) => backgroundRefreshes.push(url),
        renderAll: () => renderCount++
    });
    document.getElementById('btn-edit-map-close').click();

    assert.equal(map.mapImage, '');
    assert.equal(map.thumbnail, '');
    assert.deepEqual(Object.keys(map.tokens), ['decorative']);
    assert.equal(mapEdits.length, 1);
    assert.equal(mapEdits[0][0], 'map:edit');
    assert.equal(mapEdits[0][1].updates.mapImage, '');
    assert.equal(mapEdits[0][1].updates.thumbnail, '');
    assert.deepEqual(Object.keys(mapEdits[0][1].updates.tokens), ['decorative']);
    assert.deepEqual(backgroundRefreshes, ['']);
    assert.equal(renderCount, 1);

    dom.window.close();
});

test('token context-menu deletion delegates background asset removal to the VTT callback', () => {
    const dom = setDom('<!doctype html><body></body>');
    const map = {
        mapImage: '/maps/dungeon.webp',
        thumbnail: '/maps/dungeon.webp',
        tokens: {
            background: {
                id: 'asset_dungeon_bg',
                name: 'Dungeon Artwork',
                layer: 'map',
                isAsset: true,
                isBackground: true
            },
            decorative: {
                id: 'decorative',
                layer: 'map',
                isAsset: true,
                isBackground: false
            }
        }
    };
    const tokens = map.tokens;
    let mapUpdate = null;
    let renderCount = 0;

    showTokenContextMenu('background', 10, 10, {
        tokens,
        selectedTokenIds: new Set(),
        vtt: { role: 'GM', campaignState: { characters: {} } },
        deleteMapBackgroundAsset: (id) => {
            if (!isMapBackgroundAsset(tokens[id], 'dungeon')) return false;
            clearMapArtwork(map, 'dungeon');
            mapUpdate = {
                mapImage: map.mapImage,
                thumbnail: map.thumbnail,
                tokens: map.tokens
            };
            return true;
        },
        renderAll: () => renderCount++
    });
    document.querySelector('#menu-ctx-delete').click();

    assert.deepEqual(mapUpdate, { mapImage: '', thumbnail: '', tokens: { decorative: map.tokens.decorative } });
    assert.equal(renderCount, 1);
    assert.equal(document.querySelector('#vtt-token-context-menu'), null);

    dom.window.close();
});

test('Delete key removes selected background artwork through the VTT callback', () => {
    const dom = setDom('<!doctype html><body></body>');
    const map = {
        mapImage: '/maps/dungeon.webp',
        thumbnail: '/maps/dungeon.webp',
        tokens: {
            background: {
                id: 'asset_dungeon_bg',
                layer: 'map',
                isAsset: true,
                isBackground: true
            },
            decorative: {
                id: 'decorative',
                layer: 'map',
                isAsset: true,
                isBackground: false
            }
        }
    };
    const selectedTokenIds = new Set(['background']);
    let renderCount = 0;
    let tokenUpdateCount = 0;
    window.emitTokenUpdates = () => tokenUpdateCount++;

    setupKeyboardShortcuts({
        vtt: { role: 'GM', socket: { emit: () => {} } },
        currentMapId: 'dungeon',
        tokens: map.tokens,
        selectedTokenIds,
        isTokenControlledByPlayer: () => true,
        deleteMapBackgroundAsset: (id) => {
            if (!isMapBackgroundAsset(map.tokens[id], 'dungeon')) return false;
            clearMapArtwork(map, 'dungeon');
            return true;
        },
        renderAll: () => renderCount++
    });
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    assert.equal(map.mapImage, '');
    assert.equal(map.thumbnail, '');
    assert.deepEqual(Object.keys(map.tokens), ['decorative']);
    assert.equal(selectedTokenIds.size, 0);
    assert.equal(renderCount, 1);
    assert.equal(tokenUpdateCount, 0);

    delete window.emitTokenUpdates;
    dom.window.close();
});
