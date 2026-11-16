/**
 * test/visual/portals-traps.spec.mjs
 * ForgeD VTT - Inter-Map Portals & Interactive Trap Trigger Test Suite
 * Validates intra-map portal jumps, transit locks, GM portal locking,
 * inter-map teleportation with split-party map navigation, hidden trap auto-reveals,
 * chat saving-throw cards, and spent-state guards.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupTwoPlayerSandbox, freezeDynamicElements } from './helpers/visual-fixture.mjs';

function resetSandboxFixtures() {
    try {
        const chatPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'chat-log.json');
        const pristineChat = {
            visual_test_campaign: [
                {
                    id: 'msg_1',
                    author: 'DungeonMaster',
                    text: 'Welcome to the Sunken Crypt. The torchlight flickers off the stone walls.',
                    timestamp: '2026-11-09T08:00:00.000Z',
                    type: 'narration'
                },
                {
                    id: 'msg_2',
                    author: 'Valeros',
                    text: 'I ready my longsword and shield, keeping watch on the shadows.',
                    timestamp: '2026-11-09T08:01:00.000Z',
                    type: 'chat'
                }
            ]
        };
        fs.writeFileSync(chatPath, JSON.stringify(pristineChat, null, 2));

        const campPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'campaigns.json');
        if (fs.existsSync(campPath)) {
            const campData = JSON.parse(fs.readFileSync(campPath, 'utf8'));
            const camp = campData.visual_test_campaign;
            if (camp && camp.maps) {
                if (camp.maps.map_visual_crypt_lower?.tokens?.['tok_hero_1']) {
                    camp.maps.map_visual_dungeon.tokens['tok_hero_1'] =
                        camp.maps.map_visual_crypt_lower.tokens['tok_hero_1'];
                    delete camp.maps.map_visual_crypt_lower.tokens['tok_hero_1'];
                }
                if (camp.maps.map_visual_dungeon?.tokens?.['tok_hero_1']) {
                    const tok = camp.maps.map_visual_dungeon.tokens['tok_hero_1'];
                    tok.x = 500;
                    tok.y = 250;
                    delete tok._portalTransitLock;
                    tok.ownerUsername = 'PlayerPortals';
                    tok.assignedPlayers = ['PlayerVision', 'PlayerPortals', 'PlayerOne'];
                }
                if (camp.maps.map_visual_dungeon?.traps?.[0]) {
                    camp.maps.map_visual_dungeon.traps[0].isRevealed = false;
                    camp.maps.map_visual_dungeon.traps[0].isSpent = false;
                }
                if (camp.maps.map_visual_dungeon?.portals?.[1]) {
                    camp.maps.map_visual_dungeon.portals[1].isLocked = false;
                }
                camp.playerMapOverrides = camp.playerMapOverrides || {};
                camp.playerMapOverrides['PlayerPortals'] = 'map_visual_dungeon';
                fs.writeFileSync(campPath, JSON.stringify(campData));
            }
        }
    } catch (e) {}
}

test.describe('Inter-Map Portals & Interactive Trap Trigger Suite', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        resetSandboxFixtures();
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 1440, height: 900 },
            playerUsername: 'PlayerPortals',
            playerHasTouch: false
        });
    });

    test.afterAll(async () => {
        if (sandbox?.playerPage) {
            try {
                await sandbox.playerPage.evaluate(() => {
                    window.VTT?.socket?.emit('player:map_override', { mapId: 'map_visual_dungeon' });
                });
            } catch (e) {}
        }
        if (sandbox?.gmPage) {
            try {
                await sandbox.gmPage.evaluate(() => {
                    const mapId = 'map_visual_dungeon';
                    const map = window.VTT?.campaignState?.maps?.[mapId];
                    if (map?.traps?.[0]) {
                        map.traps[0].isRevealed = false;
                        map.traps[0].isSpent = false;
                    }
                    if (map?.portals?.[1]) {
                        map.portals[1].isLocked = false;
                    }
                    window.VTT?.socket?.emit('traps:update', { mapId, traps: map?.traps || [] });
                    window.VTT?.socket?.emit('portals:update', { mapId, portals: map?.portals || [] });
                });
            } catch (e) {}
        }
        resetSandboxFixtures();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Test 1: Intra-map portal step teleports token and applies transit lock', async () => {
        const { gmPage, playerPage } = sandbox;

        // Player moves hero token onto Portal Alpha (250, 250)
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            const oldPos = { x: 100, y: 100 };
            tok.x = 225;
            tok.y = 225;
            ce.checkTokenMoveTriggers(tok, oldPos);
        });

        // Player token position updates near Portal Beta (500, 250)
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tok = ce?.getTokens?.()['tok_hero_1'];
                return tok && Math.abs(tok.x - 500) < 60 && Math.abs(tok.y - 250) < 60;
            },
            { timeout: 10000 }
        );

        // GM observes synchronized destination coordinates
        await gmPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tok = ce?.getTokens?.()['tok_hero_1'];
                return tok && Math.abs(tok.x - 500) < 60 && Math.abs(tok.y - 250) < 60;
            },
            { timeout: 10000 }
        );

        // Verify transit lock was engaged
        const hasTransitLock = await playerPage.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_hero_1'];
            return tok && typeof tok._portalTransitLock === 'number' && tok._portalTransitLock > Date.now() - 5000;
        });
        expect(hasTransitLock).toBe(true);
    });

    test('Test 2: GM locking portal blocks player transit attempt', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM locks Portal Beta
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const map = window.VTT.campaignState.maps[mapId];
            const pBeta = map.portals.find((p) => p.id === 'portal_intra_2');
            if (pBeta) pBeta.isLocked = true;
            window.VTT.socket.emit('portals:update', { mapId, portals: map.portals });
        });

        // Wait for player to sync locked portal state
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const mapId = ce.getCurrentMapId();
                const pBeta = window.VTT.campaignState?.maps?.[mapId]?.portals?.find((p) => p.id === 'portal_intra_2');
                return pBeta && pBeta.isLocked === true;
            },
            { timeout: 10000 }
        );

        // Player attempts to step through the locked portal
        const transitResult = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            const oldPos = { x: 500, y: 150 };
            // Clear transit lock to test lock property rejection
            delete tok._portalTransitLock;
            tok.x = 475;
            tok.y = 225;
            return ce.checkTokenMoveTriggers(tok, oldPos);
        });

        // Teleport action must not be triggered
        expect(transitResult).toBeNull();
    });

    test('Test 3: Inter-map stairs down transitions Player to Lower Crypt while GM stays on Upper Level', async () => {
        const { gmPage, playerPage } = sandbox;

        // Player steps into stairs down (725, 475)
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            const oldPos = { x: 600, y: 475 };
            delete tok._portalTransitLock;
            tok.x = 700;
            tok.y = 450;
            ce.checkTokenMoveTriggers(tok, oldPos);
        });

        // Player's canvas switches map to map_visual_crypt_lower
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                return ce?.getCurrentMapId?.() === 'map_visual_crypt_lower';
            },
            { timeout: 15000 }
        );

        // GM strictly remains on map_visual_dungeon (Split-Party Navigation verified)
        const gmCurrentMap = await gmPage.evaluate(() => {
            return window.VTT.canvasEngine.getCurrentMapId();
        });
        expect(gmCurrentMap).toBe('map_visual_dungeon');

        // Player's token is positioned near portal_stairs_up (275, 275) on the lower crypt
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tok = ce?.getTokens?.()['tok_hero_1'];
                return tok && Math.abs(tok.x - 275) < 70 && Math.abs(tok.y - 275) < 70;
            },
            { timeout: 10000 }
        );
    });

    test('Test 4: Hidden spike trap auto-reveals on canvas and generates chat card with DC and damage', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM relocates hero token back to main dungeon map
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('portal:teleport_inter_map', {
                sourceMapId: 'map_visual_crypt_lower',
                targetMapId: 'map_visual_dungeon',
                targetPortalId: 'portal_stairs_down',
                tokenId: 'tok_hero_1',
                targetX: 200,
                targetY: 275,
                username: 'PlayerPortals'
            });
        });

        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                return ce?.getCurrentMapId?.() === 'map_visual_dungeon' && !!ce?.getTokens?.()['tok_hero_1'];
            },
            { timeout: 10000 }
        );

        // Verify trap is initially hidden
        const isHiddenInitial = await playerPage.evaluate(() => {
            const map = window.VTT.campaignState?.maps?.['map_visual_dungeon'];
            const trap = map?.traps?.find((t) => t.id === 'trap_crypt_spikes');
            return !!(trap && trap.isRevealed === false);
        });
        expect(isHiddenInitial).toBe(true);

        // Player moves token through concealed spike trap coordinates (375, 275)
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            const oldPos = { x: 250, y: 275 };
            delete tok._portalTransitLock;
            tok.x = 375;
            tok.y = 275;
            ce.checkTokenMoveTriggers(tok, oldPos);
        });

        // Trap automatically reveals on Player's campaign state and canvas
        await playerPage.waitForFunction(
            () => {
                const map = window.VTT.campaignState.maps['map_visual_dungeon'];
                const trap = map?.traps?.find((t) => t.id === 'trap_crypt_spikes');
                return trap && trap.isRevealed === true;
            },
            { timeout: 10000 }
        );

        // Persistent chat log receives trap card
        await playerPage.waitForFunction(
            () => {
                const chat = document.getElementById('chat-messages');
                return (
                    chat &&
                    chat.textContent.includes('TRAP TRIGGERED') &&
                    chat.textContent.includes('Concealed Spike Pit')
                );
            },
            { timeout: 10000 }
        );
    });

    test('Test 5: Spent non-repeating trap guards against duplicate trigger spam', async () => {
        const { playerPage } = sandbox;

        // Count existing trap trigger cards in chat
        const initialTriggerCount = await playerPage.evaluate(() => {
            const text = document.getElementById('chat-messages')?.textContent || '';
            const matches = text.match(/TRAP TRIGGERED/g);
            return matches ? matches.length : 0;
        });

        // Move token back and forth over the spent trap
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            const oldPos = { x: 375, y: 275 };
            delete tok._portalTransitLock;
            tok.x = 425;
            tok.y = 275;
            return ce.checkTokenMoveTriggers(tok, oldPos);
        });

        // Wait brief delay to confirm 0 new socket events
        await playerPage.waitForTimeout(500);

        const newTriggerCount = await playerPage.evaluate(() => {
            const text = document.getElementById('chat-messages')?.textContent || '';
            const matches = text.match(/TRAP TRIGGERED/g);
            return matches ? matches.length : 0;
        });

        expect(newTriggerCount).toBe(initialTriggerCount);
    });

    test('Test 6: Visual regression snapshot of the revealed trap and tabletop canvas', async () => {
        const { playerPage } = sandbox;

        await freezeDynamicElements(playerPage);

        // Visual screenshot of the revealed trap on canvas container
        const canvasContainer = playerPage.locator('#canvas-container');
        await expect(canvasContainer).toBeVisible();
        await expect(canvasContainer).toHaveScreenshot('revealed-trap-canvas.png');
    });
});
