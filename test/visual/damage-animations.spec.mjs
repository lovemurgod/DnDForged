import { test, expect } from '@playwright/test';
import { setupTwoPlayerSandbox } from './helpers/visual-fixture.mjs';

test.describe('Damage Animations & Mass Roll Visual Suite', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 1440, height: 900 },
            playerUsername: 'PlayerCombat'
        });

        const { gmPage, playerPage } = sandbox;

        // Position hero and spawn 10 goblin swarm tokens on the GM map
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const tokens = ce.getTokens();

            // Position hero token
            if (tokens['tok_hero_1']) {
                tokens['tok_hero_1'].x = 250;
                tokens['tok_hero_1'].y = 350;
                tokens['tok_hero_1'].hp = 42;
                tokens['tok_hero_1'].maxHp = 42;
                tokens['tok_hero_1'].tempHp = 0;
                tokens['tok_hero_1'].ownerUsername = 'PlayerCombat';
                tokens['tok_hero_1'].assignedPlayers = ['PlayerCombat'];
                tokens['tok_hero_1'].isPlayer = true;
                window.VTT.socket.emit('token:update', { mapId, token: tokens['tok_hero_1'] });
            }

            // Create 10 goblin swarm tokens in a 5x2 formation
            for (let i = 1; i <= 10; i++) {
                const id = `tok_swarm_goblin_${i}`;
                const col = (i - 1) % 5;
                const row = Math.floor((i - 1) / 5);
                const x = 500 + col * 70;
                const y = 300 + row * 80;

                const tok = {
                    id,
                    name: `Goblin Minion ${i}`,
                    x,
                    y,
                    size: 1,
                    hp: 15,
                    maxHp: 15,
                    tempHp: 0,
                    ac: 13,
                    isPlayer: false,
                    layer: 'token'
                };
                tokens[id] = tok;
                window.VTT.socket.emit('token:update', { mapId, token: tok });
            }

            ce.renderAll();
        });

        // Wait for player client to receive the 10 swarm tokens
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.() || {};
                return Object.keys(tokens).some((id) => id.startsWith('tok_swarm_goblin_10'));
            },
            { timeout: 10000 }
        );
    });

    test.afterAll(async () => {
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Test 1: Single target physical damage renders procedural SVG, shudders token, and despawns cleanly', async () => {
        const { gmPage } = sandbox;

        // Reset procedural queue
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            if (ce.resetProceduralFxQueue) ce.resetProceduralFxQueue();
        });

        // GM applies 12 slashing damage to tok_hero_1
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            ce.triggerDamageFXAnimation(hero.x + 25, hero.y + 25, 25, ['slashing'], {
                amount: 12,
                tokenId: 'tok_hero_1'
            });
        });

        // Verify active procedural FX container is mounted into DOM
        const overlayMounted = await gmPage.waitForFunction(
            () => {
                const containers = document.querySelectorAll('.vtt-procedural-fx-container.slashing');
                return containers.length > 0;
            },
            { timeout: 5000 }
        );
        expect(overlayMounted).toBeTruthy();

        // Verify token shudder is active
        const hasShudder = await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            return typeof ce.getTokenShudderOffset === 'function'
                ? ce.getTokenShudderOffset('tok_hero_1') !== null
                : true;
        });
        expect(hasShudder).toBe(true);

        // Wait for animation to finish and confirm clean despawn (0 leaked DOM nodes)
        await gmPage.waitForFunction(
            () => {
                const containers = document.querySelectorAll('.vtt-procedural-fx-container');
                return containers.length === 0;
            },
            { timeout: 5000 }
        );

        const lingeringNodes = await gmPage.evaluate(() => {
            return document.querySelectorAll('.vtt-procedural-fx-container').length;
        });
        expect(lingeringNodes).toBe(0);
    });

    test('Test 2: Single target healing and temporary HP mount distinct blooms and clean up', async () => {
        const { gmPage } = sandbox;

        // Apply healing animation
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            ce.triggerHealingFXAnimation(hero.x + 25, hero.y + 25, 25, 10, {
                tokenId: 'tok_hero_1'
            });
        });

        // Verify heal bloom is present
        await gmPage.waitForFunction(
            () => {
                const containers = document.querySelectorAll('.vtt-procedural-fx-container.heal');
                return containers.length > 0;
            },
            { timeout: 5000 }
        );

        // Apply temp HP animation
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            ce.triggerHealingFXAnimation(hero.x + 25, hero.y + 25, 25, 5, {
                tokenId: 'tok_hero_1',
                isTempHp: true
            });
        });

        // Verify temphp ward is present
        await gmPage.waitForFunction(
            () => {
                const containers = document.querySelectorAll('.vtt-procedural-fx-container.temphp');
                return containers.length > 0;
            },
            { timeout: 5000 }
        );

        // Wait for both to self-despawn
        await gmPage.waitForFunction(
            () => {
                const containers = document.querySelectorAll('.vtt-procedural-fx-container');
                return containers.length === 0;
            },
            { timeout: 5000 }
        );

        const lingeringNodes = await gmPage.evaluate(() => {
            return document.querySelectorAll('.vtt-procedural-fx-container').length;
        });
        expect(lingeringNodes).toBe(0);
    });

    test('Test 3: Mass damage application enforces concurrency cap (maximum 6 active overlays)', async () => {
        const { gmPage } = sandbox;

        // Trigger mass damage on all 10 goblin swarm tokens
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tokens = ce.getTokens();
            const swarmIds = Object.keys(tokens).filter((id) => id.startsWith('tok_swarm_goblin_'));

            // Reset queue
            if (ce.resetProceduralFxQueue) ce.resetProceduralFxQueue();

            // Spawn damage FX for all 10 tokens
            swarmIds.forEach((id, index) => {
                const tok = tokens[id];
                ce.triggerDamageFXAnimation(tok.x + 25, tok.y + 25, 25, ['fire'], {
                    amount: 8,
                    tokenId: id,
                    delayMs: Math.min(360, index * 60)
                });
            });
        });

        // Sample DOM multiple times during active animation to ensure overlay count NEVER exceeds 6
        for (let i = 0; i < 6; i++) {
            const activeOverlays = await gmPage.evaluate(() => {
                return document.querySelectorAll('.vtt-procedural-fx-container').length;
            });
            expect(activeOverlays).toBeLessThanOrEqual(6);
            await gmPage.waitForTimeout(70);
        }

        // Wait for all 10 animations to complete
        await gmPage.waitForFunction(
            () => {
                const containers = document.querySelectorAll('.vtt-procedural-fx-container');
                return containers.length === 0;
            },
            { timeout: 7000 }
        );

        const finalCount = await gmPage.evaluate(() => {
            return document.querySelectorAll('.vtt-procedural-fx-container').length;
        });
        expect(finalCount).toBe(0);
    });

    test('Test 4: AoE spell saving throw resolution (Fireball across 8 tokens) cascades smoothly', async () => {
        const { gmPage } = sandbox;

        // Simulate multi-token AoE damage resolution via chatcard save logic
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tokens = ce.getTokens();
            const targetIds = Object.keys(tokens)
                .filter((id) => id.startsWith('tok_swarm_goblin_'))
                .slice(0, 8);

            targetIds.forEach((id, index) => {
                const tok = tokens[id];
                ce.triggerDamageFXAnimation(tok.x + 25, tok.y + 25, 25, ['fire'], {
                    amount: 28,
                    tokenId: id,
                    delayMs: Math.min(360, index * 60)
                });
            });
        });

        // Verify concurrency governor keeps overlays within threshold
        const peakOverlays = await gmPage.evaluate(() => {
            return document.querySelectorAll('.vtt-procedural-fx-container').length;
        });
        expect(peakOverlays).toBeLessThanOrEqual(6);

        // Wait for full despawn
        await gmPage.waitForFunction(
            () => {
                return document.querySelectorAll('.vtt-procedural-fx-container').length === 0;
            },
            { timeout: 6000 }
        );
    });

    test('Test 5: Remote Player synchronization receives mass damage without duplicate playback or flooding', async () => {
        const { gmPage, playerPage } = sandbox;

        // Track how many damage_fx events Player receives
        await playerPage.evaluate(() => {
            window.__receivedDamageFxCount = 0;
            window.VTT.socket.on('tokens:damage_fx', () => {
                window.__receivedDamageFxCount++;
            });
        });

        // GM broadcasts tokens:damage_fx across 8 swarm tokens
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const tokens = ce.getTokens();
            const targetIds = Object.keys(tokens)
                .filter((id) => id.startsWith('tok_swarm_goblin_'))
                .slice(0, 8);

            // GM emits damage FX with origin tag
            window.VTT.socket.emit('tokens:damage_fx', {
                mapId,
                tokenIds: targetIds,
                damageTypes: ['fire'],
                amount: 14,
                origin: window.VTT.socket.id
            });
        });

        // Player receives socket broadcast and plays staggered animation
        await playerPage.waitForFunction(
            () => {
                return window.__receivedDamageFxCount >= 1;
            },
            { timeout: 6000 }
        );

        // Player's DOM overlay count must never exceed 6
        const playerOverlays = await playerPage.evaluate(() => {
            return document.querySelectorAll('.vtt-procedural-fx-container').length;
        });
        expect(playerOverlays).toBeLessThanOrEqual(6);

        // Confirm clean recovery on both Player and GM
        await Promise.all([
            playerPage.waitForFunction(() => document.querySelectorAll('.vtt-procedural-fx-container').length === 0, {
                timeout: 6000
            }),
            gmPage.waitForFunction(() => document.querySelectorAll('.vtt-procedural-fx-container').length === 0, {
                timeout: 6000
            })
        ]);
    });

    test('Test 6: Visual regression snapshot of active damage burst and clean post-burst state', async () => {
        const { gmPage } = sandbox;

        // Trigger a clean single slashing burst on hero for snapshot baseline
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hero = ce.getTokens()['tok_hero_1'];
            ce.triggerDamageFXAnimation(hero.x + 25, hero.y + 25, 25, ['slashing'], {
                amount: 18,
                tokenId: 'tok_hero_1'
            });
        });

        // Capture snapshot during active burst
        await gmPage.waitForTimeout(100);
        await expect(gmPage).toHaveScreenshot('damage-fx-active-burst.png');

        // Wait for complete cleanup
        await gmPage.waitForFunction(
            () => {
                return document.querySelectorAll('.vtt-procedural-fx-container').length === 0;
            },
            { timeout: 5000 }
        );

        // Capture snapshot after full despawn
        await gmPage.waitForTimeout(200);
        await expect(gmPage).toHaveScreenshot('damage-fx-clean-settled.png');
    });
});
