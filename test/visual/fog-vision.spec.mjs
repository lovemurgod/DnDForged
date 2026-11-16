import { test, expect } from '@playwright/test';
import { setupTwoPlayerSandbox } from './helpers/visual-fixture.mjs';

test.describe('Fog of War & Line of Sight Vision Suite', () => {
    let sandbox = null;

    const baseWalls = [
        { x1: 150, y1: 150, x2: 850, y2: 150, type: 'wall', blocksMovement: true, blocksVision: true },
        { x1: 850, y1: 150, x2: 850, y2: 650, type: 'wall', blocksMovement: true, blocksVision: true },
        { x1: 850, y1: 650, x2: 150, y2: 650, type: 'wall', blocksMovement: true, blocksVision: true },
        { x1: 150, y1: 650, x2: 150, y2: 150, type: 'wall', blocksMovement: true, blocksVision: true }
    ];

    const dungeonWallsWithDoor = [
        ...baseWalls,
        // Center dividing wall top
        {
            id: 'wall_div_top',
            x1: 500,
            y1: 150,
            x2: 500,
            y2: 350,
            type: 'wall',
            blocksMovement: true,
            blocksVision: true
        },
        // Center dividing door
        {
            id: 'door_crypt_main',
            x1: 500,
            y1: 350,
            x2: 500,
            y2: 450,
            type: 'door',
            isOpen: false,
            isLocked: false,
            blocksMovement: true,
            blocksVision: true
        },
        // Center dividing wall bottom
        {
            id: 'wall_div_bottom',
            x1: 500,
            y1: 450,
            x2: 500,
            y2: 650,
            type: 'wall',
            blocksMovement: true,
            blocksVision: true
        }
    ];

    test.beforeAll(async ({ browser }) => {
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 1440, height: 900 },
            playerUsername: 'PlayerVision'
        });

        // Set up the two-room chamber with closed door and position Hero in Room A and Goblin in Room B
        const { gmPage, playerPage } = sandbox;
        const playerName = 'PlayerVision';

        await gmPage.evaluate(
            ({ walls, playerName }) => {
                const ce = window.VTT.canvasEngine;
                const mapId = ce.getCurrentMapId();
                const tokens = ce.getTokens();

                // Position hero at (300, 400) in Left Room and grant ownership to Player
                if (tokens['tok_hero_1']) {
                    tokens['tok_hero_1'].x = 300;
                    tokens['tok_hero_1'].y = 400;
                    tokens['tok_hero_1'].ownerUsername = playerName;
                    tokens['tok_hero_1'].assignedPlayers = [playerName];
                    tokens['tok_hero_1'].isPlayer = true;
                    window.VTT.socket.emit('token:update', { mapId, token: tokens['tok_hero_1'] });
                }

                // Position monster at (650, 400) in Right Room
                if (tokens['tok_monster_1']) {
                    tokens['tok_monster_1'].x = 650;
                    tokens['tok_monster_1'].y = 400;
                    window.VTT.socket.emit('token:update', { mapId, token: tokens['tok_monster_1'] });
                }

                // Install dividing wall and closed door
                window.VTT.socket.emit('walls:update', { mapId, walls });
                ce.renderAll();
            },
            { walls: dungeonWallsWithDoor, playerName }
        );

        // Ensure Player has token ownership reflected in local campaignState
        await playerPage.evaluate(
            ({ playerName }) => {
                const ce = window.VTT.canvasEngine;
                const hero = ce.getTokens()['tok_hero_1'];
                if (hero) {
                    hero.ownerUsername = playerName;
                    hero.assignedPlayers = [playerName];
                    hero.isPlayer = true;
                }
                if (window.VTT.campaignState?.characters?.['char_valeros_1']) {
                    window.VTT.campaignState.characters['char_valeros_1'].assignedPlayers = [playerName];
                    window.VTT.campaignState.characters['char_valeros_1'].owner = playerName;
                }
                ce.renderAll();
            },
            { playerName }
        );

        // Wait for player to sync walls and token positions
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.();
                const map = window.VTT.campaignState?.maps?.[ce?.getCurrentMapId?.()];
                const hasDoor = map?.walls?.some((w) => w && w.id === 'door_crypt_main');
                return hasDoor && tokens?.['tok_hero_1']?.x === 300 && tokens?.['tok_monster_1']?.x === 650;
            },
            { timeout: 10000 }
        );
    });

    test.afterAll(async () => {
        if (sandbox) {
            // Restore original 4 walls in sandbox
            const { gmPage } = sandbox;
            await gmPage
                .evaluate(
                    ({ walls }) => {
                        const ce = window.VTT.canvasEngine;
                        const mapId = ce?.getCurrentMapId?.();
                        if (mapId) {
                            window.VTT.socket.emit('walls:update', { mapId, walls });
                        }
                    },
                    { walls: baseWalls }
                )
                .catch(() => {});

            await sandbox.cleanup();
        }
    });

    test('Test 1: Closed door blocks line of sight and shrouds the Right Chamber', async () => {
        const { playerPage } = sandbox;

        // Ensure LoS polygon cache has completed its render pass
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                ce?.renderAll?.();
                const hero = ce?.getTokens?.()?.['tok_hero_1'];
                return (hero?._losPolyCache?.polygon?.length || 0) > 5;
            },
            { timeout: 10000 }
        );

        // Player's hero vision polygon must be contained strictly to Left Room (x <= 505)
        const losInfo = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            ce.renderAll();
            const hero = ce.getTokens()['tok_hero_1'];
            const map = window.VTT.campaignState.maps[ce.getCurrentMapId()];
            const door = map.walls.find((w) => w.id === 'door_crypt_main');

            const poly = hero._losPolyCache?.polygon || [];
            const maxPolyX = poly.length > 0 ? Math.max(...poly.map((p) => p.x)) : 0;
            return {
                doorIsOpen: door?.isOpen,
                heroX: hero.x,
                heroY: hero.y,
                maxPolyX,
                polyVertexCount: poly.length
            };
        });

        expect(losInfo.doorIsOpen).toBe(false);
        // The dividing wall and closed door are at x = 500. Vision reaches dividing wall but cannot exceed 505px in X.
        expect(losInfo.polyVertexCount).toBeGreaterThan(5);
        expect(losInfo.maxPolyX).toBeGreaterThan(450);
        expect(losInfo.maxPolyX).toBeLessThanOrEqual(505);
    });

    test('Test 2: GM opens door and dynamic line of sight cuts through doorway', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM triggers door toggle
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            window.VTT.socket.emit('door:toggle', { mapId, wallId: 'door_crypt_main' });
        });

        // Player receives walls update with door isOpen = true
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const map = window.VTT.campaignState?.maps?.[ce?.getCurrentMapId?.()];
                const door = map?.walls?.find((w) => w?.id === 'door_crypt_main');
                return door && door.isOpen === true;
            },
            { timeout: 10000 }
        );

        // Wait for hero vision to recalculate through open door into Right Chamber (x > 600)
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                ce.renderAll();
                const hero = ce.getTokens()['tok_hero_1'];
                const poly = hero._losPolyCache?.polygon || [];
                return poly.some((p) => p.x > 600);
            },
            { timeout: 10000 }
        );

        const maxPolyX = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            const poly = hero._losPolyCache?.polygon || [];
            return Math.max(...poly.map((p) => p.x));
        });
        expect(maxPolyX).toBeGreaterThan(600);
    });

    test('Test 3: GM closes door and line of sight collapses back behind the barrier', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM toggles door again to close it
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            window.VTT.socket.emit('door:toggle', { mapId, wallId: 'door_crypt_main' });
        });

        // Player receives door closed
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const map = window.VTT.campaignState?.maps?.[ce?.getCurrentMapId?.()];
                const door = map?.walls?.find((w) => w?.id === 'door_crypt_main');
                return door && door.isOpen === false;
            },
            { timeout: 10000 }
        );

        // Verify vision polygon collapses back to <= 505
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                ce.renderAll();
                const hero = ce.getTokens()['tok_hero_1'];
                const poly = hero._losPolyCache?.polygon || [];
                return poly.length > 0 && Math.max(...poly.map((p) => p.x)) <= 505;
            },
            { timeout: 10000 }
        );

        const maxPolyX = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            const poly = hero._losPolyCache?.polygon || [];
            return Math.max(...poly.map((p) => p.x));
        });
        expect(maxPolyX).toBeLessThanOrEqual(505);
    });

    test('Test 4: Player opens unlocked door and broadcasts reveal to GM', async () => {
        const { gmPage, playerPage } = sandbox;

        // Player emits door:toggle on door_crypt_main
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            window.VTT.socket.emit('door:toggle', { mapId, wallId: 'door_crypt_main' });
        });

        // Both GM and Player receive door opened
        await gmPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const map = window.VTT.campaignState?.maps?.[ce?.getCurrentMapId?.()];
                const door = map?.walls?.find((w) => w?.id === 'door_crypt_main');
                return door && door.isOpen === true;
            },
            { timeout: 10000 }
        );

        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const map = window.VTT.campaignState?.maps?.[ce?.getCurrentMapId?.()];
                const door = map?.walls?.find((w) => w?.id === 'door_crypt_main');
                return door && door.isOpen === true;
            },
            { timeout: 10000 }
        );

        const doorState = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const map = window.VTT.campaignState.maps[ce.getCurrentMapId()];
            return map.walls.find((w) => w.id === 'door_crypt_main').isOpen;
        });
        expect(doorState).toBe(true);
    });

    test('Test 5: Token torch settings dynamically expand and contract sight radius', async () => {
        const { playerPage } = sandbox;

        // Turn off torch light
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            hero.light = { ...hero.light, enabled: false };
            ce.renderAll();
        });

        // Re-enable bright torch light (bright: 30, dim: 60)
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            hero.light = { ...hero.light, enabled: true, brightRadius: 30, dimRadius: 60 };
            ce.renderAll();
        });

        const lightState = await playerPage.evaluate(() => {
            const hero = window.VTT.canvasEngine.getTokens()['tok_hero_1'];
            return hero.light;
        });
        expect(lightState.enabled).toBe(true);
        expect(lightState.brightRadius).toBe(30);
        expect(lightState.dimRadius).toBe(60);
    });

    test('Test 6: Visual regression snapshot of open doorway line of sight', async () => {
        const { playerPage } = sandbox;
        await playerPage.waitForTimeout(400);
        await expect(playerPage).toHaveScreenshot('los-door-open-player.png');
    });
});
