import { JSDOM } from 'jsdom';
import fs from 'fs';

async function run() {
    const html = fs.readFileSync('vtt/index.html', 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://localhost:5000/?campaign=default',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });

    const setGlobal = (key, val) => {
        try {
            globalThis[key] = val;
        } catch {
            try {
                Object.defineProperty(globalThis, key, { value: val, configurable: true, writable: true });
            } catch {}
        }
    };

    setGlobal('window', dom.window);
    setGlobal('document', dom.window.document);
    setGlobal('navigator', dom.window.navigator);
    setGlobal('location', dom.window.location);
    setGlobal('localStorage', dom.window.localStorage);
    setGlobal('sessionStorage', dom.window.sessionStorage);
    setGlobal('HTMLElement', dom.window.HTMLElement);
    setGlobal('HTMLCanvasElement', dom.window.HTMLCanvasElement);
    setGlobal('CustomEvent', dom.window.CustomEvent);
    setGlobal('Event', dom.window.Event);
    setGlobal('MouseEvent', dom.window.MouseEvent);
    setGlobal('KeyboardEvent', dom.window.KeyboardEvent);
    setGlobal('MutationObserver', dom.window.MutationObserver);
    setGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 16));
    setGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    setGlobal('fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => ''
    }));

    // Mock Canvas 2D Context
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setTransform: () => {},
        resetTransform: () => {},
        drawImage: () => {},
        save: () => {},
        fillText: () => {},
        strokeText: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        ellipse: () => {},
        rect: () => {},
        measureText: () => ({ width: 10 }),
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createPattern: () => ({ setTransform: () => {} }),
        setLineDash: () => {},
        getLineDash: () => []
    });

    // Mock VTT global
    const mockVtt = {
        role: 'GM',
        username: 'GMCosmic',
        campaignId: 'default',
        campaignState: {
            id: 'default',
            activeMapId: 'map_1',
            maps: {
                map_1: {
                    id: 'map_1',
                    name: 'Dungeon Entrance',
                    mapImage: 'https://example.com/map1.png',
                    portals: [{ id: 'p1', targetMapId: 'map_2', x: 100, y: 100 }],
                    tokens: {
                        tok_1: { id: 'tok_1', name: 'Ranger', x: 50, y: 50, img: 'https://example.com/ranger.png' }
                    }
                },
                map_2: {
                    id: 'map_2',
                    name: 'Dungeon Vault',
                    mapImage: 'https://example.com/map2.png',
                    portals: [{ id: 'p2', targetMapId: 'map_1', x: 200, y: 200 }],
                    tokens: {}
                }
            },
            tokens: {},
            allowedUsers: []
        },
        socket: {
            on: () => {},
            emit: () => {},
            off: () => {}
        }
    };
    window.VTT = mockVtt;

    console.log('--- Step 1: Testing module imports ---');
    const modules = [
        '../vtt/js/vtt-utils.js',
        '../vtt/js/vtt-event-bus.js',
        '../vtt/js/vtt-weather.js',
        '../vtt/js/vtt-canvas.js',
        '../vtt/js/vtt-chat.js',
        '../vtt/js/vtt-spell-manager.js',
        '../vtt/js/vtt-player-sheet.js',
        '../vtt/js/vtt-creature-sheet.js',
        '../vtt/js/vtt-handouts.js',
        '../vtt/js/vtt-data-bridge.js',
        '../vtt/js/vtt-sheet-popout.js',
        '../vtt/js/vtt-mobile-adapter.js',
        '../vtt/js/vtt-themes.js',
        '../vtt/js/vtt-sheet-dock.js'
    ];

    const loaded = {};
    for (const modPath of modules) {
        try {
            const m = await import(modPath);
            loaded[modPath] = m;
            console.log('✓ Loaded:', modPath);
        } catch (e) {
            console.error('✗ FAILED TO IMPORT:', modPath, e);
        }
    }

    console.log('\n--- Step 2: Testing Initializers ---');
    const inits = [
        ['initVttWeather', '../vtt/js/vtt-weather.js', (m) => m.initVttWeather(mockVtt)],
        [
            'initVttCanvas (GM)',
            '../vtt/js/vtt-canvas.js',
            (m) => {
                m.initVttCanvas(mockVtt);
                if (window.VTT?.canvasEngine?.loadMap) {
                    window.VTT.canvasEngine.loadMap('map_1', false);
                }
            }
        ],
        [
            'initVttCanvas (Player Login Simulation)',
            '../vtt/js/vtt-canvas.js',
            (m) => {
                const playerMockVtt = {
                    ...mockVtt,
                    role: 'Player',
                    username: 'CosmicPlayer',
                    campaignState: {
                        ...mockVtt.campaignState,
                        maps: {
                            ...mockVtt.campaignState.maps,
                            map_1: {
                                ...mockVtt.campaignState.maps.map_1,
                                tokens: {
                                    tok_player: {
                                        id: 'tok_player',
                                        name: 'Valeros',
                                        isPlayer: true,
                                        ownerUsername: 'CosmicPlayer',
                                        x: 100,
                                        y: 100
                                    }
                                }
                            }
                        }
                    }
                };
                window.VTT = playerMockVtt;
                m.initVttCanvas(playerMockVtt);
            }
        ],
        ['initVttChat', '../vtt/js/vtt-chat.js', (m) => m.initVttChat(mockVtt, [])],
        ['initVttSpellManager', '../vtt/js/vtt-spell-manager.js', (m) => m.initVttSpellManager(mockVtt)],
        ['initVttPlayerSheet', '../vtt/js/vtt-player-sheet.js', (m) => m.initVttPlayerSheet(mockVtt)],
        ['initVttCreatureSheet', '../vtt/js/vtt-creature-sheet.js', (m) => m.initVttCreatureSheet(mockVtt)],
        ['initVttHandouts', '../vtt/js/vtt-handouts.js', (m) => m.initVttHandouts(mockVtt)],
        ['initVttDataBridge', '../vtt/js/vtt-data-bridge.js', (m) => m.initVttDataBridge(mockVtt)],
        ['initVttMobileAdapter', '../vtt/js/vtt-mobile-adapter.js', (m) => m.initVttMobileAdapter(mockVtt)],
        ['initVttThemes', '../vtt/js/vtt-themes.js', (m) => m.initVttThemes(mockVtt)],
        ['initVttSheetDock', '../vtt/js/vtt-sheet-dock.js', (m) => m.initVttSheetDock(mockVtt)]
    ];

    for (const [name, modPath, fn] of inits) {
        try {
            const m = loaded[modPath];
            if (m) {
                console.log(`Executing ${name}...`);
                fn(m);
                console.log(`✓ ${name} succeeded!`);
            } else {
                console.warn(`! Skipped ${name} because module failed to load`);
                hasErrors = true;
            }
        } catch (e) {
            console.error(`✗ ERROR in ${name}:`, e.message, '\nStack:', e.stack);
            hasErrors = true;
        }
    }

    console.log('\n--- Step 3: Testing Sheet Window Manager & Standalone Sheet ---');
    try {
        const popout = loaded['../vtt/js/vtt-sheet-popout.js'];
        if (popout && popout.SheetWindowManager) {
            console.log('✓ SheetWindowManager loaded');
        }
    } catch (e) {
        console.error('✗ ERROR in SheetWindowManager:', e);
        hasErrors = true;
    }

    // Allow throttled render frames and microtasks to flush
    console.log('\n--- Step 4: Flushing Render Ticks ---');
    await new Promise((resolve) => setTimeout(resolve, 200));
    console.log('✓ Render loop flushed without unhandled exceptions');

    if (hasErrors) {
        throw new Error('Simulation completed with initialization errors!');
    }
    console.log('\n=== ALL VTT MODULES INITIALIZED AND SIMULATED CLEANLY ===');
    process.exit(0);
}

let hasErrors = false;
run().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
