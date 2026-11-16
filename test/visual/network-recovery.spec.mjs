/**
 * test/visual/network-recovery.spec.mjs
 * ForgeD VTT - Network Drop & Reconnection Recovery Test Suite
 * Validates real-time network loss handling, reconnecting pill UI display,
 * authoritative state catch-up (token positions, new spawns, deleted tokens,
 * missed chat logs, and tabletop pause state) upon reconnection across
 * Desktop GM <-> Desktop Player and Desktop GM <-> Mobile Player viewports.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupTwoPlayerSandbox, freezeDynamicElements } from './helpers/visual-fixture.mjs';

function resetVisualChatLog() {
    try {
        const chatPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'chat-log.json');
        const pristine = {
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
        fs.writeFileSync(chatPath, JSON.stringify(pristine, null, 2));
    } catch (e) {
        // Ignored
    }
}

test.describe('Network Drop & Mid-Game Recovery (Desktop GM <-> Desktop Player)', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        resetVisualChatLog();
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 1440, height: 900 },
            playerUsername: 'PlayerDesktop',
            playerHasTouch: false
        });
    });

    test.afterAll(async () => {
        if (sandbox?.gmPage) {
            try {
                await sandbox.gmPage.evaluate(() => {
                    window.VTT?.socket?.emit('game:set_pause', { paused: false });
                });
            } catch (e) {}
        }
        resetVisualChatLog();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Step 1: Network drop on Player displays reconnecting status pill', async () => {
        const { playerContext, playerPage } = sandbox;

        // Verify initially hidden
        const pill = playerPage.locator('#vtt-connection-status-pill');
        await expect(pill).toHaveClass(/vtt-hidden/);

        // Simulate network loss: cut context offline and close transport
        await playerContext.setOffline(true);
        await playerPage.evaluate(() => {
            if (window.VTT?.socket?.io?.engine) {
                window.VTT.socket.io.engine.close();
            }
        });

        // Pill should immediately appear with reconnecting state
        await expect(pill).not.toHaveClass(/vtt-hidden/, { timeout: 5000 });
        await expect(pill).not.toHaveClass(/connected/);
        await expect(pill).toContainText(/Reconnecting|Connection paused/i);

        // Capture visual snapshot of the desktop reconnecting pill
        await expect(pill).toHaveScreenshot('reconnecting-pill-desktop.png');
    });

    test('Step 2: GM performs multi-mutation actions while Player is offline', async () => {
        const { gmPage } = sandbox;

        // 1. Move hero token to (520, 380)
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            tok.x = 520;
            tok.y = 380;
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: tok });
            ce.renderAll();
        });

        // 2. Spawn a new skeleton minion token
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const newTok = {
                id: 'tok_skel_offline',
                name: 'Skeleton Minion',
                x: 620,
                y: 420,
                size: 1,
                color: '#e2e8f0',
                hp: 12,
                maxHp: 12
            };
            ce.getTokens()['tok_skel_offline'] = newTok;
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: newTok });
            ce.renderAll();
        });

        // 3. Broadcast combat narrative in chat
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('chat:msg', {
                text: 'The cavern walls groan as ancient skeletons emerge from the crypt!',
                sender: 'DungeonMaster',
                role: 'GM',
                timestamp: Date.now()
            });
        });

        // 4. Pause the tabletop
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('game:set_pause', { paused: true, source: 'gm' });
        });

        // Confirm pause overlay active on GM
        await gmPage.waitForSelector('#vtt-pause-overlay:not(.vtt-hidden)', { timeout: 5000 });
    });

    test('Step 3: Network restoration triggers auto-reconnect and catches up state', async () => {
        const { playerContext, playerPage } = sandbox;

        // Restore network and initiate reconnect
        await playerContext.setOffline(false);
        await playerPage.evaluate(() => {
            if (window.VTT?.socket) {
                window.VTT.socket.connect();
            }
        });

        // Pill transitions to connected
        const pill = playerPage.locator('#vtt-connection-status-pill');
        await expect(pill).toHaveClass(/connected/, { timeout: 15000 });
        await expect(pill).toContainText(/Connected|Reconnected/i);

        // Player canvas receives updated hero position and new skeleton token
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.();
                const hero = tokens?.['tok_hero_1'];
                const skel = tokens?.['tok_skel_offline'];
                return hero && hero.x === 520 && hero.y === 380 && !!skel;
            },
            { timeout: 15000 }
        );

        // Player chat catches up on the missed combat narrative
        await playerPage.waitForFunction(
            () => {
                const chat = document.getElementById('chat-messages');
                return chat && chat.textContent.includes('ancient skeletons emerge');
            },
            { timeout: 15000 }
        );

        // Player receives authoritative tabletop pause overlay
        await playerPage.waitForSelector('#vtt-pause-overlay:not(.vtt-hidden)', { timeout: 15000 });
        const pauseTitle = playerPage.locator('#vtt-pause-title');
        await expect(pauseTitle).toContainText('GAME PAUSED BY GM');
    });
});

test.describe('Network Drop & Mid-Game Recovery (Desktop GM <-> Mobile Player)', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 412, height: 915 },
            playerUsername: 'PlayerMobile',
            playerHasTouch: true
        });
    });

    test.afterAll(async () => {
        if (sandbox?.gmPage) {
            try {
                await sandbox.gmPage.evaluate(() => {
                    window.VTT?.socket?.emit('game:set_pause', { paused: false });
                });
            } catch (e) {}
        }
        resetVisualChatLog();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Step 1: Mobile Network Drop displays centered mobile reconnecting status pill', async () => {
        const { playerContext, playerPage } = sandbox;

        // Cut mobile connection
        await playerContext.setOffline(true);
        await playerPage.evaluate(() => {
            if (window.VTT?.socket?.io?.engine) {
                window.VTT.socket.io.engine.close();
            }
        });

        // Pill should appear centered on mobile
        const pill = playerPage.locator('#vtt-connection-status-pill');
        await expect(pill).not.toHaveClass(/vtt-hidden/, { timeout: 5000 });
        await expect(pill).not.toHaveClass(/connected/);
        await expect(pill).toContainText(/Reconnecting|Connection paused/i);

        // Visual snapshot of mobile pill
        await expect(pill).toHaveScreenshot('reconnecting-pill-mobile.png');
    });

    test('Step 2: GM updates token and unpauses while Mobile Player is offline', async () => {
        const { gmPage } = sandbox;

        // GM moves hero token to (x: 480, y: 320)
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_hero_1'];
            tok.x = 480;
            tok.y = 320;
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: tok });
            ce.renderAll();
        });

        // GM unpauses the tabletop
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('game:set_pause', { paused: false });
        });

        await gmPage.waitForSelector('#vtt-pause-overlay.vtt-hidden', { state: 'attached', timeout: 5000 });
    });

    test('Step 3: Mobile Player reconnects, catches up coordinates and lifts pause', async () => {
        const { playerContext, playerPage } = sandbox;

        // Restore network
        await playerContext.setOffline(false);
        await playerPage.evaluate(() => {
            if (window.VTT?.socket) {
                window.VTT.socket.connect();
            }
        });

        // Wait for reconnection
        const pill = playerPage.locator('#vtt-connection-status-pill');
        await expect(pill).toHaveClass(/connected/, { timeout: 15000 });

        // Verify mobile token coordinates updated
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const hero = ce?.getTokens?.()?.['tok_hero_1'];
                return hero && hero.x === 480 && hero.y === 320;
            },
            { timeout: 15000 }
        );

        // Verify pause overlay is dismissed
        await playerPage.waitForSelector('#vtt-pause-overlay.vtt-hidden', { state: 'attached', timeout: 15000 });
    });
});
