import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { updateConnectionStatus, startSocketConnection } from '../vtt/js/bootstrap/vtt-session.js';
import { setupSocketSync } from '../vtt/js/canvas/vtt-canvas-socket-sync.js';

function installGlobals(dom, values = {}) {
    const keys = ['window', 'document', 'localStorage', 'fetch', 'io', 'alert', 'requestAnimationFrame'];
    const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const globals = {
        window: dom.window,
        document: dom.window.document,
        localStorage: dom.window.localStorage,
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        ...values
    };

    Object.entries(globals).forEach(([key, value]) => {
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value
        });
    });

    return () => {
        previous.forEach((descriptor, key) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        });
        dom.window.close();
    };
}

function makeFakeSocket() {
    const handlers = new Map();
    const ioHandlers = new Map();
    const emitted = [];
    let disconnected = false;

    const socket = {
        connected: false,
        id: 'sock_player_test_1',
        io: {
            on(event, handler) {
                ioHandlers.set(event, handler);
                return this;
            }
        },
        on(event, handler) {
            handlers.set(event, handler);
            return this;
        },
        emit(event, ...args) {
            emitted.push({ event, args });
            return this;
        },
        disconnect() {
            disconnected = true;
            this.connected = false;
        }
    };

    return {
        socket,
        emitted,
        trigger(event, ...args) {
            const h = handlers.get(event);
            if (h) return h(...args);
        },
        triggerIO(event, ...args) {
            const h = ioHandlers.get(event);
            if (h) return h(...args);
        },
        get isDisconnected() {
            return disconnected;
        }
    };
}

test('updateConnectionStatus toggles UI pill classes and messages accurately', async () => {
    const dom = new JSDOM(
        '<!doctype html><body><div id="vtt-connection-status-pill" class="vtt-connection-pill vtt-hidden"></div></body>',
        {
            url: 'http://localhost/'
        }
    );
    const restoreGlobals = installGlobals(dom);

    try {
        const pill = dom.window.document.getElementById('vtt-connection-status-pill');

        // 1. Initial State is hidden
        assert.equal(pill.classList.contains('vtt-hidden'), true);

        // 2. Set to reconnecting
        updateConnectionStatus('reconnecting', 'Connection lost — Retrying...');
        assert.equal(pill.classList.contains('vtt-hidden'), false);
        assert.equal(pill.classList.contains('connected'), false);
        assert.match(pill.innerHTML, /fa-spinner/);
        assert.match(pill.innerHTML, /Connection lost — Retrying\.\.\./);

        // 3. Set to connected
        updateConnectionStatus('connected', 'All Systems Online');
        assert.equal(pill.classList.contains('vtt-hidden'), false);
        assert.equal(pill.classList.contains('connected'), true);
        assert.match(pill.innerHTML, /fa-check/);
        assert.match(pill.innerHTML, /All Systems Online/);

        // 4. Set to hidden manually
        updateConnectionStatus('hidden');
        assert.equal(pill.classList.contains('vtt-hidden'), true);
        assert.equal(pill.classList.contains('connected'), false);
    } finally {
        restoreGlobals();
    }
});

test('Socket disconnect, retry attempts, and reconnect trigger appropriate UI status updates', async () => {
    const dom = new JSDOM(
        `<!doctype html><body>
        <div id="vtt-connection-status-pill" class="vtt-connection-pill vtt-hidden"></div>
        <button id="btn-join-game"></button>
        <div id="login-overlay"></div>
        <div id="vtt-workspace" class="vtt-hidden"></div>
        <span id="display-user-role"></span>
    </body>`,
        {
            url: 'http://localhost/'
        }
    );

    const fakeSock = makeFakeSocket();
    const restoreGlobals = installGlobals(dom, {
        io: () => fakeSock.socket
    });

    dom.window.VTT = {
        role: 'Player',
        username: 'PlayerOne',
        campaignState: { id: 'camp_test' }
    };

    let cancelConnection = null;

    try {
        cancelConnection = startSocketConnection('camp_test', 'PlayerOne', 'Player', null, {
            moduleInitPromise: Promise.resolve({}),
            updateTabletopPauseUI: () => {}
        });

        // 1. Initial Connect & Join
        fakeSock.socket.connected = true;
        fakeSock.trigger('connect');
        assert.equal(
            fakeSock.emitted.some((e) => e.event === 'join'),
            true
        );

        fakeSock.trigger('joined', {
            role: 'Player',
            userRole: 'Player',
            campaignState: { id: 'camp_test', allowedUsers: [] },
            chatHistory: []
        });

        const pill = dom.window.document.getElementById('vtt-connection-status-pill');
        assert.equal(pill.classList.contains('connected'), true);
        assert.match(pill.innerHTML, /Connected!/);

        // 2. Network drop -> disconnect event
        fakeSock.socket.connected = false;
        fakeSock.trigger('disconnect', 'transport close');
        assert.equal(pill.classList.contains('connected'), false);
        assert.equal(pill.classList.contains('vtt-hidden'), false);
        assert.match(pill.innerHTML, /Connection paused — Reconnecting\.\.\./);

        // 3. Reconnect attempt 2
        fakeSock.triggerIO('reconnect_attempt', 2);
        assert.match(pill.innerHTML, /Reconnecting\.\.\. \(Attempt 2\)/);

        // 4. Reconnected successfully
        fakeSock.socket.connected = true;
        fakeSock.triggerIO('reconnect');
        assert.equal(pill.classList.contains('connected'), true);
        assert.match(pill.innerHTML, /Reconnected!/);

        // Clean up pill timer before closing globals
        updateConnectionStatus('hidden');
    } finally {
        if (typeof cancelConnection === 'function') {
            cancelConnection();
        }
        // Small delay to allow any pending immediate microtasks to settle
        await new Promise((resolve) => setTimeout(resolve, 50));
        restoreGlobals();
    }
});

test('Idempotency Guard on session re-join delegates to sync hooks without re-initializing modules', async () => {
    const dom = new JSDOM(
        `<!doctype html><body>
        <div id="vtt-connection-status-pill" class="vtt-connection-pill vtt-hidden"></div>
        <button id="btn-join-game"></button>
        <div id="login-overlay" class="vtt-hidden"></div>
        <div id="vtt-workspace"></div>
        <span id="display-user-role"></span>
    </body>`,
        {
            url: 'http://localhost/'
        }
    );

    const fakeSock = makeFakeSocket();
    const restoreGlobals = installGlobals(dom, {
        io: () => fakeSock.socket
    });

    let syncCampaignCalls = 0;
    let syncChatCalls = 0;
    let syncHandoutsCalls = 0;

    const mockCampaignState = {
        id: 'camp_test',
        activeMapId: 'map_crypt',
        maps: { map_crypt: { id: 'map_crypt', name: 'Crypt', tokens: {} } },
        handouts: [{ id: 'handout_1', title: 'Ancient Parchment' }]
    };
    const mockChatHistory = [{ id: 'msg_1', author: 'GM', text: 'Roll for initiative!' }];

    dom.window.VTT = {
        role: 'Player',
        username: 'PlayerOne',
        _modulesInitialized: true,
        _modulesInitializationState: 'initialized',
        campaignState: null,
        canvasEngine: {
            syncCampaignState: (camp) => {
                syncCampaignCalls += 1;
                assert.deepEqual(camp, mockCampaignState);
            }
        },
        chatEngine: {
            syncChatHistory: (chat) => {
                syncChatCalls += 1;
                assert.deepEqual(chat, mockChatHistory);
            }
        },
        handoutsEngine: {
            syncHandouts: (handouts) => {
                syncHandoutsCalls += 1;
                assert.equal(handouts.length, 1);
            }
        }
    };

    let cancelConnection = null;
    let moduleInitPromiseAwaited = false;

    try {
        cancelConnection = startSocketConnection('camp_test', 'PlayerOne', 'Player', null, {
            moduleInitPromise: new Promise((resolve) => {
                setTimeout(() => {
                    moduleInitPromiseAwaited = true;
                    resolve({});
                }, 100);
            }),
            updateTabletopPauseUI: () => {}
        });

        // Trigger 'joined' after reconnection
        await fakeSock.trigger('joined', {
            role: 'Player',
            userRole: 'Player',
            campaignState: mockCampaignState,
            chatHistory: mockChatHistory
        });

        // Verify: moduleInitPromise was NOT awaited
        assert.equal(moduleInitPromiseAwaited, false, 'Should not await moduleInitPromise during re-join');
        assert.equal(dom.window.VTT._modulesInitializationState, 'initialized');
        // Verify: sync functions were called exactly once
        assert.equal(syncCampaignCalls, 1, 'Should call syncCampaignState');
        assert.equal(syncChatCalls, 1, 'Should call syncChatHistory');
        assert.equal(syncHandoutsCalls, 1, 'Should call syncHandouts');

        updateConnectionStatus('hidden');
    } finally {
        if (typeof cancelConnection === 'function') {
            cancelConnection();
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        restoreGlobals();
    }
});

test('setupSocketSync reconciles authoritative server tokens while preserving in-flight drag targets', () => {
    const dom = new JSDOM(
        `<!doctype html><body>
        <div id="modal-upload-map" class="vtt-hidden"></div>
    </body>`,
        {
            url: 'http://localhost/'
        }
    );
    const restoreGlobals = installGlobals(dom);

    const fakeSock = makeFakeSocket();
    let renderAllCalled = 0;

    const ctx = {
        currentMapId: 'map_crypt',
        dragTargetId: 'tok_hero', // Client is actively dragging this token
        tokens: {
            tok_hero: { id: 'tok_hero', x: 200, y: 300, name: 'Valeros' },
            tok_goblin_1: { id: 'tok_goblin_1', x: 100, y: 100, name: 'Goblin Scout' },
            tok_deleted_monster: { id: 'tok_deleted_monster', x: 50, y: 50, name: 'Zombie' }
        },
        selectedTokenIds: new Set(['tok_deleted_monster']),
        selectedTokenId: 'tok_deleted_monster',
        renderAll: () => {
            renderAllCalled += 1;
        },
        loadMap: () => {},
        updatePreviewBanner: () => {}
    };

    ctx.vtt = {
        socket: fakeSock.socket,
        role: 'Player',
        username: 'PlayerOne',
        campaignState: null
    };

    try {
        setupSocketSync(ctx);

        // Server sends updated campaign state after player reconnects:
        // - tok_hero has server position (100, 100), but client is actively dragging it -> should preserve client's drag coords (200, 300)
        // - tok_goblin_1 moved to (150, 150) -> should be updated
        // - tok_new_boss spawned at (400, 400) -> should be added
        // - tok_deleted_monster was killed and removed on server -> should be deleted from client tokens & selection
        const updatedServerCampaign = {
            activeMapId: 'map_crypt',
            maps: {
                map_crypt: {
                    id: 'map_crypt',
                    tokens: {
                        tok_hero: { id: 'tok_hero', x: 100, y: 100, name: 'Valeros' },
                        tok_goblin_1: { id: 'tok_goblin_1', x: 150, y: 150, name: 'Goblin Scout' },
                        tok_new_boss: { id: 'tok_new_boss', x: 400, y: 400, name: 'Bugbear Chief' }
                    }
                }
            }
        };

        fakeSock.trigger('campaign:state-sync', updatedServerCampaign);

        // Assertions
        assert.equal(ctx.tokens.tok_hero.x, 200, 'Actively dragged token position must be preserved');
        assert.equal(ctx.tokens.tok_hero.y, 300, 'Actively dragged token position must be preserved');
        assert.equal(ctx.tokens.tok_goblin_1.x, 150, 'Updated token must adopt server coordinates');
        assert.equal(ctx.tokens.tok_goblin_1.y, 150, 'Updated token must adopt server coordinates');
        assert.equal(ctx.tokens.tok_new_boss.name, 'Bugbear Chief', 'Newly spawned server token must be added');
        assert.equal(
            ctx.tokens.tok_deleted_monster,
            undefined,
            'Deleted server token must be removed from client state'
        );
        assert.equal(
            ctx.selectedTokenIds.has('tok_deleted_monster'),
            false,
            'Deleted token must be removed from selection set'
        );
        assert.equal(ctx.selectedTokenId, null, 'Deleted token must clear selectedTokenId');
        assert.ok(renderAllCalled >= 1, 'renderAll must be triggered after state reconciliation');
    } finally {
        restoreGlobals();
    }
});

test('Tabletop pause state received on reconnect dispatches to updateTabletopPauseUI', async () => {
    const dom = new JSDOM('<!doctype html><body></body>', {
        url: 'http://localhost/'
    });
    const fakeSock = makeFakeSocket();
    const restoreGlobals = installGlobals(dom, {
        io: () => fakeSock.socket
    });

    let pauseStateReceived = null;
    let cancelConnection = null;

    dom.window.VTT = {
        role: 'Player',
        username: 'PlayerOne',
        _modulesInitialized: true
    };

    try {
        cancelConnection = startSocketConnection('camp_test', 'PlayerOne', 'Player', null, {
            moduleInitPromise: Promise.resolve({}),
            updateTabletopPauseUI: (state) => {
                pauseStateReceived = state;
            }
        });

        // Trigger 'game:pause_state' event
        fakeSock.trigger('game:pause_state', { isPaused: true, source: 'gm' });

        assert.deepEqual(pauseStateReceived, { isPaused: true, source: 'gm' });
    } finally {
        if (typeof cancelConnection === 'function') {
            cancelConnection();
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        restoreGlobals();
    }
});
