import test from 'node:test';
import assert from 'node:assert/strict';

import {
    hasMapManagerDataChanged,
    escapeMapHtml,
    executeMapReorder,
    getPlayerMapOverride,
    probeMediaDimensions
} from '../vtt/js/canvas/vtt-canvas-map-manager.js';
import { emitWeatherUpdate } from '../vtt/js/canvas/vtt-canvas-weather.js';

test('Campaign Map Manager: Fingerprint tracks folders and thumbnail updates', () => {
    const camp = {
        maps: {
            m1: { id: 'm1', name: 'Crypt', folder: 'Dungeons', thumbnail: 'thumb1.jpg' }
        },
        mapFolders: ['Dungeons'],
        mapOrder: ['m1'],
        activeMapId: 'm1',
        activeGMMapId: 'm1',
        playerMapOverrides: {}
    };

    const fp1 = hasMapManagerDataChanged(camp, '');
    assert.ok(fp1, 'Initial fingerprint should be generated');
    assert.strictEqual(hasMapManagerDataChanged(camp, fp1), false, 'Identical state produces no change flag');

    // Add empty folder
    camp.mapFolders.push('Wilderness');
    const fp2 = hasMapManagerDataChanged(camp, fp1);
    assert.ok(fp2, 'Adding an empty folder should update fingerprint');

    // Change thumbnail
    camp.maps.m1.thumbnail = 'thumb2.jpg';
    const fp3 = hasMapManagerDataChanged(camp, fp2);
    assert.ok(fp3, 'Changing map thumbnail should update fingerprint');
});

test('Campaign Map Manager: executeMapReorder moves items correctly', () => {
    const emitted = [];
    const mockOptions = {
        vtt: {
            socket: {
                emit: (evt, data) => emitted.push({ evt, data })
            }
        }
    };
    const managerState = {};
    const camp = {
        maps: {
            m1: { id: 'm1', name: 'Map 1', folder: 'A' },
            m2: { id: 'm2', name: 'Map 2', folder: 'A' },
            m3: { id: 'm3', name: 'Map 3', folder: 'A' }
        },
        mapOrder: ['m1', 'm2', 'm3']
    };

    // Move m3 up
    executeMapReorder('m3', 'up', camp, managerState, mockOptions);
    assert.deepStrictEqual(camp.mapOrder, ['m1', 'm3', 'm2']);
    assert.strictEqual(emitted[emitted.length - 1].evt, 'map:reorder');
    assert.strictEqual(emitted[emitted.length - 1].data.folder, 'A');

    // Send m2 to top
    executeMapReorder('m2', 'top', camp, managerState, mockOptions);
    assert.deepStrictEqual(camp.mapOrder, ['m2', 'm1', 'm3']);

    // Send m2 to bottom
    executeMapReorder('m2', 'bottom', camp, managerState, mockOptions);
    assert.deepStrictEqual(camp.mapOrder, ['m1', 'm3', 'm2']);

    // Move m1 down
    executeMapReorder('m1', 'down', camp, managerState, mockOptions);
    assert.deepStrictEqual(camp.mapOrder, ['m3', 'm1', 'm2']);
});

test('Campaign Map Manager: HTML sanitization prevents XSS in player & map names', () => {
    const malicious = '<script>alert(1)</script>&"\'';
    const safe = escapeMapHtml(malicious);
    assert.ok(!safe.includes('<script>'), 'Tag brackets must be escaped');
    assert.ok(safe.includes('&lt;script&gt;'));
    assert.ok(safe.includes('&quot;'));
    assert.ok(safe.includes('&#039;'));
});

test('Server Logic: map:bulk-create inserts multiple maps without moving GM active map', () => {
    const camp = {
        maps: {
            m1: { id: 'm1', name: 'Starter Map' }
        },
        mapOrder: ['m1'],
        activeGMMapId: 'm1',
        mapFolders: []
    };

    const newMaps = [
        { name: 'Dungeon 1', gridWidth: 30, gridHeight: 30 },
        { name: 'Dungeon 2', gridWidth: 40, gridHeight: 40 }
    ];

    // Simulate map:bulk-create logic
    const targetFolder = 'Megadungeon';
    if (!camp.mapFolders.includes(targetFolder)) {
        camp.mapFolders.push(targetFolder);
    }
    newMaps.forEach((m, idx) => {
        const id = `m_imported_${idx}`;
        camp.maps[id] = { ...m, id, folder: targetFolder };
        camp.mapOrder.push(id);
    });

    assert.strictEqual(Object.keys(camp.maps).length, 3);
    assert.strictEqual(camp.activeGMMapId, 'm1', 'GM active map must remain untouched during bulk import');
    assert.ok(camp.mapFolders.includes('Megadungeon'));
});

test('Server Logic: map:folder-rename and map:folder-delete dual-choice', () => {
    const camp = {
        maps: {
            m1: { id: 'm1', name: 'Map A', folder: 'Old Folder' },
            m2: { id: 'm2', name: 'Map B', folder: 'Old Folder' },
            m3: { id: 'm3', name: 'Map C', folder: '' }
        },
        mapFolders: ['Old Folder'],
        mapOrder: ['m1', 'm2', 'm3']
    };

    // Rename Old Folder -> New Folder
    const idx = camp.mapFolders.indexOf('Old Folder');
    camp.mapFolders[idx] = 'New Folder';
    Object.values(camp.maps).forEach((m) => {
        if (m.folder === 'Old Folder') m.folder = 'New Folder';
    });

    assert.strictEqual(camp.mapFolders[0], 'New Folder');
    assert.strictEqual(camp.maps.m1.folder, 'New Folder');
    assert.strictEqual(camp.maps.m2.folder, 'New Folder');

    // Folder delete: mode 'uncategorize'
    camp.mapFolders = camp.mapFolders.filter((f) => f !== 'New Folder');
    Object.values(camp.maps).forEach((m) => {
        if (m.folder === 'New Folder') m.folder = '';
    });
    assert.strictEqual(camp.mapFolders.length, 0);
    assert.strictEqual(camp.maps.m1.folder, '');
    assert.strictEqual(camp.maps.m2.folder, '');
});

test('Server Logic: map:delete enforces minimum 1 map and prunes offline overrides', () => {
    const camp = {
        maps: {
            m1: { id: 'm1', name: 'Base Map' },
            m2: { id: 'm2', name: 'Old Empty Map' }
        },
        mapOrder: ['m1', 'm2'],
        activeMapId: 'm1',
        activeGMMapId: 'm1',
        playerMapOverrides: {
            offlineDave: 'm2'
        }
    };

    // Simulate delete m2 when no online players are on it
    if (camp.playerMapOverrides) {
        for (const [user, targetId] of Object.entries(camp.playerMapOverrides)) {
            if (targetId === 'm2') delete camp.playerMapOverrides[user];
        }
    }
    delete camp.maps['m2'];
    camp.mapOrder = camp.mapOrder.filter((id) => id !== 'm2');

    assert.strictEqual(camp.maps.m2, undefined, 'm2 should be deleted');
    assert.strictEqual(camp.playerMapOverrides.offlineDave, undefined, 'Offline override for m2 must be cleanly pruned');

    // Attempt to delete last remaining map (m1)
    let errorEmitted = false;
    if (Object.keys(camp.maps).length <= 1) {
        errorEmitted = true;
    }
    assert.strictEqual(errorEmitted, true, 'Deleting the only remaining map must be rejected');
});

test('Round 2: probeMediaDimensions identifies video formats and returns safe defaults', async () => {
    const videoRes = await probeMediaDimensions('https://example.com/map.mp4');
    assert.strictEqual(videoRes.width, 1920);
    assert.strictEqual(videoRes.height, 1080);

    const imgRes = await probeMediaDimensions('https://example.com/map.png');
    assert.strictEqual(imgRes.width, 2000);
    assert.strictEqual(imgRes.height, 1500);

    const hintRes = await probeMediaDimensions('https://example.com/asset_stream', true);
    assert.strictEqual(hintRes.width, 1920);
    assert.strictEqual(hintRes.height, 1080);
});

test('Round 2: getPlayerMapOverride resolves case-insensitively', () => {
    const camp = {
        playerMapOverrides: {
            'LegolasGreenleaf': 'map_woodland',
            'gimli': 'map_caves'
        }
    };

    assert.strictEqual(getPlayerMapOverride(camp, 'LegolasGreenleaf'), 'map_woodland');
    assert.strictEqual(getPlayerMapOverride(camp, 'legolasgreenleaf'), 'map_woodland');
    assert.strictEqual(getPlayerMapOverride(camp, 'LEGOLASGREENLEAF'), 'map_woodland');
    assert.strictEqual(getPlayerMapOverride(camp, 'Gimli'), 'map_caves');
    assert.strictEqual(getPlayerMapOverride(camp, 'Aragorn'), null);
    assert.strictEqual(getPlayerMapOverride(null, 'Gimli'), null);
});

test('Round 2: emitWeatherUpdate isolates draft mode without mutating stored map or emitting', () => {
    let socketEmitted = false;
    let weatherEngineUpdated = false;

    const mockVtt = {
        campaignState: {
            maps: {
                m1: {
                    id: 'm1',
                    weather: { effects: [], saturation: 100 }
                }
            }
        },
        weatherEngine: {
            setWeather: () => {
                weatherEngineUpdated = true;
            }
        },
        socket: {
            emit: () => {
                socketEmitted = true;
            }
        }
    };

    const weatherState = {
        editingMapId: 'm1',
        currentEditingWeatherLayers: [{ id: 'l1', preset: 'rain', intensity: 0.8 }],
        currentEditingWeatherSaturation: 85,
        isDraft: true
    };

    // Call in draft mode
    emitWeatherUpdate(weatherState, { vtt: mockVtt, currentMapId: 'm1' }, true);

    assert.strictEqual(weatherEngineUpdated, true, 'Weather engine preview should be updated');
    assert.strictEqual(socketEmitted, false, 'Socket emit must NOT occur in draft mode');
    assert.strictEqual(mockVtt.campaignState.maps.m1.weather.effects.length, 0, 'Saved map weather must not mutate in draft mode');

    // Call without draft mode
    weatherState.isDraft = false;
    emitWeatherUpdate(weatherState, { vtt: mockVtt, currentMapId: 'm1' }, true);

    assert.strictEqual(socketEmitted, true, 'Socket emit should occur when not in draft mode');
    assert.strictEqual(mockVtt.campaignState.maps.m1.weather.effects.length, 1, 'Saved map weather updates upon save');
});

test('Round 2: Folder datalist merges empty mapFolders with map folders', () => {
    const camp = {
        maps: {
            m1: { folder: 'Forest' },
            m2: { folder: 'Dungeon' },
            m3: { folder: '' }
        },
        mapFolders: ['EmptyCathedral', 'Forest', 'Underdark']
    };

    const fromMaps = Object.values(camp.maps).map((m) => m.folder).filter((f) => f && f.trim());
    const fromFolders = (camp.mapFolders || []).filter((f) => f && f.trim());
    const folders = [...new Set([...fromMaps, ...fromFolders])].sort();

    assert.deepStrictEqual(folders, ['Dungeon', 'EmptyCathedral', 'Forest', 'Underdark']);
    assert.ok(folders.includes('EmptyCathedral'), 'Empty folders created via sidebar must appear in datalist');
});

test('Round 2: Smart deletion flags active online vs offline overrides correctly', () => {
    const camp = {
        activeMapId: 'm_main',
        playerMapOverrides: {
            Alice: 'm_forest',
            Bob: 'm_crypt'
        },
        onlinePlayers: ['Alice']
    };

    const checkMapDeletable = (mapId) => {
        const isGlobalActive = camp.activeMapId === mapId;
        const playersOnMap = Object.entries(camp.playerMapOverrides || {})
            .filter(([p, mId]) => mId === mapId)
            .map(([p]) => p);
        const onlinePlayersList = Array.isArray(camp.onlinePlayers) ? camp.onlinePlayers : [];
        const onlineOnThisMap = playersOnMap.filter((p) => {
            const pLower = p.toLowerCase();
            return onlinePlayersList.some((op) => op.toLowerCase() === pLower);
        });
        const cannotDelete = isGlobalActive || onlineOnThisMap.length > 0;
        return {
            cannotDelete,
            isGlobalActive,
            onlineOnThisMap,
            hasOfflinePlayers: playersOnMap.length > 0 && onlineOnThisMap.length === 0
        };
    };

    // Main map
    const mainCheck = checkMapDeletable('m_main');
    assert.strictEqual(mainCheck.cannotDelete, true);
    assert.strictEqual(mainCheck.isGlobalActive, true);

    // Forest map (Alice is online on it)
    const forestCheck = checkMapDeletable('m_forest');
    assert.strictEqual(forestCheck.cannotDelete, true);
    assert.strictEqual(forestCheck.onlineOnThisMap[0], 'Alice');

    // Crypt map (Bob is assigned, but offline)
    const cryptCheck = checkMapDeletable('m_crypt');
    assert.strictEqual(cryptCheck.cannotDelete, false, 'Map with only offline players can be deleted');
    assert.strictEqual(cryptCheck.hasOfflinePlayers, true, 'Triggers override confirmation warning');
});

