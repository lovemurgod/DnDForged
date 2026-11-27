import test from 'node:test';
import assert from 'node:assert/strict';
import { initVttPresentation } from '../vtt/js/vtt-presentation.js';
import { setupSocketSync } from '../vtt/js/canvas/vtt-canvas-socket-sync.js';

function createMockSocket() {
    const handlers = new Map();
    const emitted = [];
    return {
        emitted,
        on(event, fn) {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(fn);
        },
        emit(event, payload) {
            emitted.push({ event, payload });
        },
        trigger(event, payload) {
            for (const fn of handlers.get(event) || []) {
                fn(payload);
            }
        }
    };
}

test('TV Presentation client uses calibrated zoom over GM zoom while preserving pan center', () => {
    const panCalls = [];
    const socket = createMockSocket();
    const client = initVttPresentation({
        isPresentationMode: true,
        socket,
        canvasEngine: {
            getCurrentMapId: () => 'map_1',
            panTo: (x, y, zoom, dur) => panCalls.push({ x, y, zoom, dur }),
            setZoom: () => {}
        }
    });

    client.setCalibratedZoom(1.75);
    socket.trigger('presentation:camSynced', { mapId: 'map_1', x: 320, y: 240, zoom: 0.8 });

    assert.equal(panCalls.length, 1);
    assert.deepEqual(panCalls[0], { x: 320, y: 240, zoom: 1.75, dur: 120 });

    // Force push bypasses camera lock
    client.setCameraLocked(true);
    socket.trigger('presentation:camSynced', { mapId: 'map_1', x: 100, y: 200, zoom: 0.9 });
    assert.equal(panCalls.length, 1);

    socket.trigger('presentation:camSynced', { mapId: 'map_1', x: 500, y: 600, zoom: 0.9, force: true });
    assert.equal(panCalls.length, 2);
    assert.equal(panCalls[1].x, 500);
    assert.equal(panCalls[1].zoom, 1.75);
});

test('GM Presentation host pushViewToTv emits forced camSync with latest camera coordinates', () => {
    const socket = createMockSocket();
    const host = initVttPresentation({
        isPresentationMode: false,
        socket
    });

    host.onGmCameraMoved({
        panX: 100,
        panY: 50,
        zoom: 2,
        currentMapId: 'map_1',
        viewportWidth: 1000,
        viewportHeight: 800
    });

    const pushed = host.pushViewToTv();
    assert.equal(pushed, true);
    const camSyncEvent = socket.emitted.find((e) => e.event === 'presentation:camSync');
    assert.ok(camSyncEvent);
    assert.equal(camSyncEvent.payload.force, true);
    assert.equal(camSyncEvent.payload.mapId, 'map_1');
    assert.equal(camSyncEvent.payload.x, 200); // (500 - 100) / 2
    assert.equal(camSyncEvent.payload.y, 175); // (400 - 50) / 2
});

test('campaign:patch applies map_meta, map_order, and map_folders deltas without reloading map', () => {
    const socket = createMockSocket();
    let loadMapCalls = 0;
    let renderAllCalls = 0;
    const vtt = {
        socket,
        campaignState: {
            activeMapId: 'map_1',
            mapOrder: ['map_1', 'map_2'],
            mapFolders: ['Dungeon'],
            maps: {
                map_1: { id: 'map_1', name: 'Crypt', folder: 'Dungeon' },
                map_2: { id: 'map_2', name: 'Tavern', folder: '' }
            }
        }
    };

    setupSocketSync({
        vtt,
        currentMapId: 'map_1',
        loadMap: () => {
            loadMapCalls++;
        },
        renderAll: () => {
            renderAllCalls++;
        }
    });

    socket.trigger('campaign:patch', {
        scope: 'map_meta',
        mapId: 'map_1',
        updates: { name: 'Crypt Level 2' }
    });
    assert.equal(vtt.campaignState.maps.map_1.name, 'Crypt Level 2');
    assert.equal(renderAllCalls, 1);
    assert.equal(loadMapCalls, 0);

    socket.trigger('campaign:patch', {
        scope: 'map_order',
        mapOrder: ['map_2', 'map_1'],
        mapId: 'map_2',
        folder: 'Dungeon'
    });
    assert.deepEqual(vtt.campaignState.mapOrder, ['map_2', 'map_1']);
    assert.equal(vtt.campaignState.maps.map_2.folder, 'Dungeon');

    socket.trigger('campaign:patch', {
        scope: 'map_folders',
        mapFolders: ['Stronghold'],
        renamedFrom: 'Dungeon',
        renamedTo: 'Stronghold'
    });
    assert.deepEqual(vtt.campaignState.mapFolders, ['Stronghold']);
    assert.equal(vtt.campaignState.maps.map_1.folder, 'Stronghold');
    assert.equal(vtt.campaignState.maps.map_2.folder, 'Stronghold');
});
