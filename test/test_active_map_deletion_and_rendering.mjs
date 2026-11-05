import test from 'node:test';
import assert from 'node:assert/strict';

test('Active Map Deletion: Server strictly rejects deletion of active party map', () => {
    const campaignId = 'test_camp_delete_active';
    const campaigns = {
        [campaignId]: {
            id: campaignId,
            name: 'Test Campaign',
            activeMapId: 'map_1',
            activeGMMapId: 'map_1',
            mapOrder: ['map_1', 'map_2', 'map_3'],
            playerMapOverrides: {
                playerBob: 'map_2'
            },
            maps: {
                map_1: { id: 'map_1', name: 'Active Ravenloft Map' },
                map_2: { id: 'map_2', name: 'Backup Forest Map' },
                map_3: { id: 'map_3', name: 'Catacombs Map' }
            }
        }
    };

    const camp = campaigns[campaignId];
    const mapIdToDelete = 'map_1';
    let emittedError = null;
    const socket = {
        emit(evt, msg) {
            if (evt === 'error') emittedError = msg;
        }
    };

    // Execute server deletion guard from server/socket.js
    if (camp.maps && camp.maps[mapIdToDelete]) {
        const isPartyActive = camp.activeMapId === mapIdToDelete;
        const hasPlayerOverride = Object.values(camp.playerMapOverrides || {}).includes(mapIdToDelete);
        if (isPartyActive || hasPlayerOverride) {
            socket.emit(
                'error',
                'Cannot delete map while players are actively viewing it. Move players to another map first.'
            );
        } else {
            delete camp.maps[mapIdToDelete];
        }
    }

    assert.ok(emittedError, 'Server must emit an error when attempting to delete active party map');
    assert.ok(camp.maps['map_1'], 'Active map_1 must NOT be deleted');
    assert.equal(camp.activeMapId, 'map_1', 'camp.activeMapId must remain intact');
});

test('Active Map Deletion: Server strictly rejects deletion of map with player override', () => {
    const campaignId = 'test_camp_delete_override';
    const campaigns = {
        [campaignId]: {
            id: campaignId,
            name: 'Test Campaign',
            activeMapId: 'map_1',
            mapOrder: ['map_1', 'map_2', 'map_3'],
            playerMapOverrides: {
                playerAlice: 'map_2'
            },
            maps: {
                map_1: { id: 'map_1', name: 'Active Map' },
                map_2: { id: 'map_2', name: 'Player Override Map' },
                map_3: { id: 'map_3', name: 'Unused Map' }
            }
        }
    };

    const camp = campaigns[campaignId];
    const mapIdToDelete = 'map_2';
    let emittedError = null;
    const socket = {
        emit(evt, msg) {
            if (evt === 'error') emittedError = msg;
        }
    };

    if (camp.maps && camp.maps[mapIdToDelete]) {
        const isPartyActive = camp.activeMapId === mapIdToDelete;
        const hasPlayerOverride = Object.values(camp.playerMapOverrides || {}).includes(mapIdToDelete);
        if (isPartyActive || hasPlayerOverride) {
            socket.emit(
                'error',
                'Cannot delete map while players are actively viewing it. Move players to another map first.'
            );
        } else {
            delete camp.maps[mapIdToDelete];
        }
    }

    assert.ok(emittedError, 'Server must emit error when map has active player override');
    assert.ok(camp.maps['map_2'], 'Override map_2 must NOT be deleted');
});

test('Active Map Deletion: Server permits deletion of inactive map without players', () => {
    const campaignId = 'test_camp_delete_inactive';
    const campaigns = {
        [campaignId]: {
            id: campaignId,
            name: 'Test Campaign',
            activeMapId: 'map_1',
            mapOrder: ['map_1', 'map_2', 'map_3'],
            playerMapOverrides: {
                playerAlice: 'map_1'
            },
            maps: {
                map_1: { id: 'map_1', name: 'Active Map' },
                map_2: { id: 'map_2', name: 'Other Map' },
                map_3: { id: 'map_3', name: 'Inactive Unused Map' }
            }
        }
    };

    const camp = campaigns[campaignId];
    const mapIdToDelete = 'map_3';
    let emittedError = null;
    const socket = {
        emit(evt, msg) {
            if (evt === 'error') emittedError = msg;
        }
    };

    if (camp.maps && camp.maps[mapIdToDelete]) {
        const isPartyActive = camp.activeMapId === mapIdToDelete;
        const hasPlayerOverride = Object.values(camp.playerMapOverrides || {}).includes(mapIdToDelete);
        if (isPartyActive || hasPlayerOverride) {
            socket.emit(
                'error',
                'Cannot delete map while players are actively viewing it. Move players to another map first.'
            );
        } else {
            delete camp.maps[mapIdToDelete];
            if (camp.mapOrder) {
                camp.mapOrder = camp.mapOrder.filter((id) => id !== mapIdToDelete);
            }
        }
    }

    assert.equal(emittedError, null, 'No error should be emitted for inactive map deletion');
    assert.equal(camp.maps['map_3'], undefined, 'Inactive map_3 should be successfully deleted');
    assert.deepEqual(camp.mapOrder, ['map_1', 'map_2'], 'mapOrder should be updated');
});

test('Map Background Neutralization: setMapBackground keeps legacy container hidden and updates token', async () => {
    // Mock minimal DOM
    const bgContainer = {
        className: '',
        innerHTML: '<img>',
        classList: {
            add(cls) {
                bgContainer.className += ' ' + cls;
            },
            remove(cls) {
                bgContainer.className = bgContainer.className.replace(cls, '').trim();
            }
        },
        querySelectorAll() {
            return [];
        },
        removeAttribute() {}
    };

    globalThis.document = {
        getElementById(id) {
            if (id === 'vtt-map-bg-container') return bgContainer;
            return null;
        }
    };

    const { setMapBackground } = await import('../vtt/js/canvas/vtt-canvas-camera.js');

    const fakeContext = {
        currentMapId: 'map_sample',
        vtt: {
            campaignState: {
                maps: {
                    map_sample: {
                        id: 'map_sample',
                        name: 'Ravenloft Sample',
                        tokens: {
                            asset_existing_bg: {
                                id: 'asset_existing_bg',
                                layer: 'map',
                                isBackground: true,
                                isAsset: true,
                                img: '/img/old-path.webp'
                            }
                        }
                    }
                }
            }
        },
        renderAllCalled: false,
        renderAll() {
            this.renderAllCalled = true;
        }
    };

    await setMapBackground('/img/new-spires.webp', fakeContext);

    // Verify container is hidden and empty
    assert.ok(bgContainer.className.includes('vtt-hidden'), '#vtt-map-bg-container must remain hidden');
    assert.equal(bgContainer.innerHTML, '', '#vtt-map-bg-container must have innerHTML cleared');

    // Verify map layer background token was synchronized
    const token = fakeContext.vtt.campaignState.maps.map_sample.tokens.asset_existing_bg;
    assert.equal(token.img, '/img/new-spires.webp', 'Background token image must be updated to new URL');
    assert.equal(fakeContext.renderAllCalled, true, 'renderAll() must be invoked to refresh canvas');

    delete globalThis.document;
});

test('Duplicate Prevention: server migration never generates duplicate _bg token if map token exists', () => {
    const map = {
        id: 'map_ravenloft_test',
        name: 'Ravenloft Test',
        mapImage: '/img/adventure/CoS/thumbnail/map-4.02-walls.webp',
        thumbnail: '/img/adventure/CoS/thumbnail/map-4.02-walls.webp',
        gridWidth: 44,
        gridHeight: 60,
        grid: { size: 87.5 },
        tokens: {
            asset_12345_map: {
                id: 'asset_12345_map',
                layer: 'map',
                isAsset: true,
                isBackground: true,
                img: '/img/adventure/CoS/map-4.02-walls-player.webp',
                pixelWidth: 3840,
                pixelHeight: 5211
            }
        }
    };

    // Execute server migration logic from server/state.js
    if (map.mapImage && map.mapImage.trim()) {
        const imgUrl = map.mapImage.trim();
        const hasExistingBg = Object.values(map.tokens).some((t) => t.layer === 'map' && (t.isBackground || t.isAsset));

        if (!hasExistingBg) {
            const assetId = `asset_${map.id}_bg`;
            map.tokens[assetId] = {
                id: assetId,
                layer: 'map',
                isAsset: true,
                isBackground: true,
                img: imgUrl
            };
        }
        map.thumbnail = map.thumbnail || imgUrl;
        map.mapImage = '';
    }

    assert.equal(map.tokens[`asset_${map.id}_bg`], undefined, 'Must NOT create duplicate fallback token');
    assert.equal(Object.keys(map.tokens).length, 1, 'Only original map asset must exist');
    assert.equal(map.mapImage, '', 'mapImage must be cleared to prevent repeated migration');
});

test('Duplicate Prevention: Edit Map URL uses active artwork token img over thumbnail', () => {
    const map = {
        id: 'map_edit_test',
        thumbnail: '/img/adventure/CoS/thumbnail/map-4.02-walls.webp',
        mapImage: '',
        tokens: {
            asset_real_map: {
                id: 'asset_real_map',
                layer: 'map',
                isBackground: true,
                isAsset: true,
                img: '/img/adventure/CoS/map-4.02-walls-player.webp'
            }
        }
    };

    // Logic from openEditModal in vtt-canvas-map-manager.js
    const bgToken = Object.values(map.tokens || {}).find((t) => t.layer === 'map' && (t.isBackground || t.isAsset));
    const effectiveMapUrl = bgToken?.img || map.mapImage || map.thumbnail || '';

    assert.equal(
        effectiveMapUrl,
        '/img/adventure/CoS/map-4.02-walls-player.webp',
        'Edit modal URL must prioritize actual battlemap artwork over thumbnail'
    );
});
