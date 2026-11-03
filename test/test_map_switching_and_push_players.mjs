/**
 * test_map_switching_and_push_players.mjs
 * Comprehensive tests for map switching, push-to-players instant synchronization,
 * fast-path event emission, and Map Manager options preservation.
 */

import assert from 'node:assert';
import {
    initMapManagerControls,
    renderMapGrid,
    setupPushPlayersModal,
    openPushPlayersModal
} from '../vtt/js/canvas/vtt-canvas-map-manager.js';
import { setupSocketSync } from '../vtt/js/canvas/vtt-canvas-socket-sync.js';

console.log('--- RUNNING MAP SWITCHING & PUSH TO PLAYERS TEST SUITE ---\n');

// Mock DOM environment helper
function createMockDom() {
    const elements = new Map();

    function createElement(tag) {
        const el = {
            tagName: tag.toUpperCase(),
            style: {},
            classList: {
                classes: new Set(),
                add(c) {
                    this.classes.add(c);
                },
                remove(c) {
                    this.classes.delete(c);
                },
                contains(c) {
                    return this.classes.has(c);
                },
                toggle(c, force) {
                    if (force !== undefined) {
                        if (force) this.add(c);
                        else this.remove(c);
                        return force;
                    }
                    if (this.contains(c)) {
                        this.remove(c);
                        return false;
                    }
                    this.add(c);
                    return true;
                }
            },
            listeners: {},
            children: [],
            dataset: {},
            value: '',
            checked: false,
            innerHTML: '',
            textContent: '',
            addEventListener(ev, fn) {
                if (!this.listeners[ev]) this.listeners[ev] = [];
                this.listeners[ev].push(fn);
            },
            dispatchEvent(event) {
                const list = this.listeners[event.type] || [];
                for (const fn of list) fn(event);
            },
            querySelector(sel) {
                if (sel.startsWith('.')) {
                    const cls = sel.slice(1);
                    return this.children.find((c) => c.classList?.contains(cls)) || null;
                }
                return null;
            },
            querySelectorAll(sel) {
                if (sel === 'input[type="checkbox"]') {
                    return this.children.filter(
                        (c) =>
                            c.tagName === 'INPUT' || (c.children && c.children.some((sub) => sub.tagName === 'INPUT'))
                    );
                }
                if (sel === 'input[type="checkbox"]:checked') {
                    return this.children.filter(
                        (c) => c.checked || (c.children && c.children.some((sub) => sub.checked))
                    );
                }
                return [];
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            remove() {}
        };
        return el;
    }

    const doc = {
        createElement,
        createDocumentFragment() {
            return {
                children: [],
                appendChild(c) {
                    this.children.push(c);
                }
            };
        },
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, createElement('div'));
            }
            return elements.get(id);
        },
        body: createElement('body')
    };

    return { doc, elements };
}

// ==========================================
// TEST 1: Map Manager Options Preservation
// ==========================================
console.log('[Test 1] Map Manager Options Preservation across Navigation...');
{
    const { doc } = createMockDom();
    global.document = doc;

    let loadedMapId = null;
    let pushModalOpenedWithMapId = null;

    const mockVtt = {
        role: 'GM',
        campaignState: {
            activeMapId: 'map_1',
            activeGMMapId: 'map_1',
            maps: {
                map_1: { id: 'map_1', name: 'Tavern Floor 1', folder: 'City' },
                map_2: { id: 'map_2', name: 'Dungeon Cellar', folder: 'Dungeons' }
            }
        }
    };

    const managerState = {
        activeMapFolder: '__ALL__',
        currentMapViewMode: 'grid',
        mapSearchQuery: '',
        mapManagerControlsInitialized: false
    };

    const options = {
        vtt: mockVtt,
        getCurrentMapId: () => 'map_1',
        getSafeVttUrl: (u) => u,
        loadMap: (id) => {
            loadedMapId = id;
        },
        openPushPlayersModal: (id) => {
            pushModalOpenedWithMapId = id;
        },
        renderMapGrid: () => {}
    };

    // Render initial grid
    renderMapGrid(managerState, options);
    assert.strictEqual(
        managerState.lastOptions.getCurrentMapId(),
        'map_1',
        'Initial options should be recorded in managerState'
    );

    // Simulate search query update which triggers debounced renderMapGrid
    const searchInput = doc.getElementById('map-search-input');
    searchInput.value = 'dungeon';
    searchInput.dispatchEvent({ type: 'input' });

    // Ensure effectiveOptions retains loadMap and openPushPlayersModal
    assert.strictEqual(typeof managerState.lastOptions.loadMap, 'function', 'loadMap must be preserved across search');
    assert.strictEqual(
        typeof managerState.lastOptions.openPushPlayersModal,
        'function',
        'openPushPlayersModal must be preserved'
    );

    console.log('  ✔ Options retained completely across search input');
}

// ==========================================
// TEST 2: Push Players Modal Logic & GM Sync
// ==========================================
console.log('\n[Test 2] Push Players Modal Local GM Sync & Event Emission...');
{
    const { doc } = createMockDom();
    global.document = doc;

    let emittedEvent = null;
    let emittedData = null;
    let localGmLoadedMapId = null;
    let gridRendered = false;

    const mockSocket = {
        emit(event, data) {
            emittedEvent = event;
            emittedData = data;
        }
    };

    const mockVtt = {
        role: 'GM',
        socket: mockSocket,
        campaignState: {
            activeMapId: 'map_1',
            activeGMMapId: 'map_1',
            maps: {
                map_1: { id: 'map_1', name: 'Tavern' },
                map_2: { id: 'map_2', name: 'Crypt' }
            },
            knownPlayers: ['Alice', 'Bob']
        }
    };

    const options = {
        vtt: mockVtt,
        loadMap: (id) => {
            localGmLoadedMapId = id;
        },
        renderMapGrid: () => {
            gridRendered = true;
        }
    };

    setupPushPlayersModal(options);
    openPushPlayersModal('map_2', options);

    const pushAll = doc.getElementById('push-players-all');
    pushAll.checked = true;

    const confirmBtn = doc.getElementById('btn-push-players-confirm');
    confirmBtn.dispatchEvent({ type: 'click' });

    assert.strictEqual(emittedEvent, 'map:activate-players', 'Must emit map:activate-players socket event');
    assert.strictEqual(emittedData.mapId, 'map_2', 'Target map must be map_2');
    assert.strictEqual(emittedData.targetPlayers, 'all', 'Target players must be all');
    assert.strictEqual(mockVtt.campaignState.activeMapId, 'map_2', 'Active party map must be updated optimistically');
    assert.strictEqual(mockVtt.campaignState.activeGMMapId, 'map_2', 'Active GM map must follow party map');
    assert.strictEqual(localGmLoadedMapId, 'map_2', 'GM view must load target map immediately');
    assert.strictEqual(gridRendered, true, 'Map grid must be re-rendered to show updated active badge');

    console.log('  ✔ Push modal immediately switches GM view, syncs state, and emits map:activate-players');
}

// ==========================================
// TEST 3: Fast-Path map:activated Event
// ==========================================
console.log('\n[Test 3] Client Fast-Path map:activated Reception & Action...');
{
    const socketListeners = {};
    const mockSocket = {
        on(event, fn) {
            socketListeners[event] = fn;
        }
    };

    let playerLoadedMapId = null;
    const mockVtt = {
        role: 'Player',
        username: 'Alice',
        socket: mockSocket,
        campaignState: {
            activeMapId: 'map_1',
            maps: {
                map_1: { id: 'map_1', name: 'Tavern' },
                map_2: { id: 'map_2', name: 'Crypt' }
            }
        }
    };

    const ctx = {
        vtt: mockVtt,
        currentMapId: 'map_1',
        loadMap: (id) => {
            playerLoadedMapId = id;
        },
        renderMapGrid: () => {},
        updatePreviewBanner: () => {}
    };

    setupSocketSync(ctx);

    assert.strictEqual(
        typeof socketListeners['map:activated'],
        'function',
        'Socket sync must register map:activated handler'
    );

    // Simulate server dispatching map:activated for all players
    socketListeners['map:activated']({
        mapId: 'map_2',
        mapName: 'Crypt',
        targetPlayers: 'all',
        activeMapId: 'map_2',
        activeGMMapId: 'map_2'
    });

    assert.strictEqual(playerLoadedMapId, 'map_2', 'Player must immediately trigger loadMap upon map:activated');
    assert.strictEqual(mockVtt.campaignState.activeMapId, 'map_2', 'Campaign state activeMapId must update');

    console.log('  ✔ Fast-path map:activated immediately triggers map load on targeted player client');
}

// ==========================================
// TEST 4: Specific Player Push Filtering
// ==========================================
console.log('\n[Test 4] Specific Player Target Filtering in map:activated...');
{
    const socketListeners = {};
    const mockSocket = {
        on(event, fn) {
            socketListeners[event] = fn;
        }
    };

    let bobLoadedMap = null;
    const mockBobVtt = {
        role: 'Player',
        username: 'Bob',
        socket: mockSocket,
        campaignState: {
            activeMapId: 'map_1',
            maps: {
                map_1: { id: 'map_1', name: 'Tavern' },
                map_2: { id: 'map_2', name: 'Secret Room' }
            }
        }
    };

    const ctx = {
        vtt: mockBobVtt,
        currentMapId: 'map_1',
        loadMap: (id) => {
            bobLoadedMap = id;
        },
        renderMapGrid: () => {},
        updatePreviewBanner: () => {}
    };

    setupSocketSync(ctx);

    // Event targeting only Charlie (case-insensitive check)
    socketListeners['map:activated']({
        mapId: 'map_2',
        mapName: 'Secret Room',
        targetPlayers: ['Charlie'],
        activeMapId: 'map_1'
    });

    assert.strictEqual(bobLoadedMap, null, 'Bob should not switch map when target is Charlie');

    // Event targeting Bob (case-insensitive check: 'bob')
    socketListeners['map:activated']({
        mapId: 'map_2',
        mapName: 'Secret Room',
        targetPlayers: ['bob'],
        activeMapId: 'map_1'
    });

    assert.strictEqual(bobLoadedMap, 'map_2', 'Bob must switch map when targeted case-insensitively');

    console.log('  ✔ Specific player targeting respects username matching case-insensitively');
}

console.log('\n🎉 ALL 4 MAP SWITCHING & PUSH TO PLAYERS TESTS PASSED SUCCESSFULLY!\n');
