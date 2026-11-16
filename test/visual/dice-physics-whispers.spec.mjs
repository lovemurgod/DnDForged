/**
 * test/visual/dice-physics-whispers.spec.mjs
 * ForgeD VTT - 3D Dice Physics, Crit Bursts & Secret GM Whisper Rolls Test Suite
 * Validates 3D rigid-body dice physics, multi-tier grid distribution,
 * Nat 20/Nat 1 floating banner badges, public roll vs. private GM whisper comparison,
 * mobile player whisper isolation, and skin theme customization.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupTwoPlayerSandbox, joinAsPlayer, freezeDynamicElements } from './helpers/visual-fixture.mjs';

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
    } catch (e) {}
}

test.describe('3D Dice Physics, Crit Bursts & Secret GM Whisper Rolls Suite', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        resetSandboxFixtures();
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 1440, height: 900 },
            playerUsername: 'PlayerOne',
            playerHasTouch: false
        });
    });

    test.afterAll(async () => {
        if (sandbox?.gmPage) {
            try {
                await sandbox.gmPage.evaluate(() => {
                    window.Dice3D?.clear?.();
                    window.Dice3D?.setSkin?.('obsidian_gold');
                });
            } catch (e) {}
        }
        resetSandboxFixtures();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Test 1: Public Roll vs Secret GM Whisper Roll Comparison', async () => {
        const { gmPage, playerPage } = sandbox;

        // Count initial messages
        const initialPlayerMsgCount = await playerPage.evaluate(() => {
            return document.querySelectorAll('#chat-messages .chat-message').length;
        });

        // 1. GM sends a public roll
        await gmPage.fill('#chat-input', '/r 1d20+5');
        await gmPage.click('#btn-chat-send');

        // Player receives the public roll
        await playerPage.waitForFunction(
            (expectedCount) => {
                const count = document.querySelectorAll('#chat-messages .chat-message').length;
                return count > expectedCount;
            },
            initialPlayerMsgCount,
            { timeout: 10000 }
        );

        const currentMsgCount = await playerPage.evaluate(() => {
            return document.querySelectorAll('#chat-messages .chat-message').length;
        });

        // 2. GM performs a secret whisper roll (e.g. stealth or monster recharge)
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('chat:whisper', {
                text: '[Stealth: Goblin] rolls **Stealth**',
                roll: {
                    diceList: [{ sides: 20, val: 17 }],
                    modifier: 4,
                    total: 21,
                    formula: '1d20+4'
                }
            });
        });

        // GM receives private whisper card
        await gmPage.waitForFunction(
            () => {
                const whispers = document.querySelectorAll('#chat-messages .whisper-card');
                return (
                    whispers.length > 0 &&
                    Array.from(whispers).some(
                        (w) => w.textContent.includes('Private') && w.textContent.includes('Stealth')
                    )
                );
            },
            { timeout: 10000 }
        );

        // Allow brief settle
        await playerPage.waitForTimeout(600);

        // Player strictly receives 0 new messages and 0 whisper cards
        const finalPlayerMsgCount = await playerPage.evaluate(() => {
            const msgs = document.querySelectorAll('#chat-messages .chat-message').length;
            const whispers = document.querySelectorAll('#chat-messages .whisper-card').length;
            return { msgs, whispers };
        });

        expect(finalPlayerMsgCount.msgs).toBe(currentMsgCount);
        expect(finalPlayerMsgCount.whispers).toBe(0);
    });

    test('Test 2: Mobile Player Whisper Isolation Guard', async () => {
        const { gmPage } = sandbox;
        const browser = gmPage.context().browser();

        // Spawn a Mobile Player browser context
        const mobileContext = await browser.newContext({
            viewport: { width: 393, height: 851 },
            isMobile: true,
            hasTouch: true
        });
        const mobilePage = await mobileContext.newPage();
        await joinAsPlayer(mobilePage, 'MobilePlayer');

        // GM emits another secret whisper check
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('chat:whisper', {
                text: 'Hidden Trap DC check (DC 15)',
                roll: {
                    diceList: [{ sides: 20, val: 18 }],
                    modifier: 2,
                    total: 20
                }
            });
        });

        // Wait brief delay to confirm zero transport bleed
        await mobilePage.waitForTimeout(600);

        // Mobile player verifies zero whisper cards
        const mobileWhispers = await mobilePage.evaluate(() => {
            return document.querySelectorAll('#chat-messages .whisper-card').length;
        });
        expect(mobileWhispers).toBe(0);

        // Mobile 3D dice container has 0 active floating badges
        const mobileBadges = await mobilePage.evaluate(() => {
            return document.querySelectorAll('#dice-box-canvas-container .dice3d-floating-badge').length;
        });
        expect(mobileBadges).toBe(0);

        await mobileContext.close();
    });

    test('Test 3: 3D Polyhedral Dice Physics & Multi-Tier Grid Distribution', async () => {
        const { gmPage } = sandbox;

        // Trigger a 6d6 mass damage roll in the 3D physics box
        const gridData = await gmPage.evaluate(() => {
            const grid = window.Dice3D.computeOptimalGrid(6, 1.77);
            window.Dice3D.roll([
                { sides: 6, val: 3 },
                { sides: 6, val: 4 },
                { sides: 6, val: 5 },
                { sides: 6, val: 2 },
                { sides: 6, val: 6 },
                { sides: 6, val: 4 }
            ]);
            return grid;
        });

        // Grid must divide 6 dice into 2 rows of 3 columns
        expect(gridData.rows).toBe(2);
        expect(gridData.cols).toBe(3);
        expect(gridData.distribution).toEqual([3, 3]);

        // Canvas container must be visible and active
        const canvasContainer = gmPage.locator('#dice-box-canvas-container');
        await expect(canvasContainer).toBeVisible();

        // Canvas element itself must be present inside container
        const canvasEl = gmPage.locator('#dice-box-canvas-container canvas');
        await expect(canvasEl).toBeVisible();
    });

    test('Test 4: Nat 20 Critical Hit Starburst & Banner Badge', async () => {
        const { gmPage } = sandbox;

        // Clear existing dice and roll a natural 20 on d20
        await gmPage.evaluate(() => {
            window.Dice3D.clear();
            window.Dice3D.roll([{ sides: 20, val: 20 }]);
        });

        // Floating Nat 20 banner badge mounts in DOM
        const badge = gmPage.locator('.dice3d-floating-badge.badge-nat20');
        await expect(badge).toBeVisible({ timeout: 10000 });

        const badgeText = await badge.textContent();
        expect(badgeText).toContain('NAT 20');
    });

    test('Test 5: Nat 1 Critical Failure Blast & Banner Badge', async () => {
        const { gmPage } = sandbox;

        // Clear existing dice and roll a natural 1 on d20
        await gmPage.evaluate(() => {
            window.Dice3D.clear();
            window.Dice3D.roll([{ sides: 20, val: 1 }]);
        });

        // Floating Nat 1 banner badge mounts in DOM
        const badge = gmPage.locator('.dice3d-floating-badge.badge-nat1');
        await expect(badge).toBeVisible({ timeout: 10000 });

        const badgeText = await badge.textContent();
        expect(badgeText).toContain('NAT 1');
    });

    test('Test 6: 3D Dice Skin Theme & Audio Profile Customization', async () => {
        const { gmPage } = sandbox;

        // Switch to ruby_ember skin and set custom volume/SFX settings
        await gmPage.evaluate(() => {
            window.Dice3D.setSkin('ruby_ember');
            window.Dice3D.setVolume(0.85);
            window.Dice3D.setSfxEnabled(true);
        });

        // Verify localStorage persistence
        const skinKey = await gmPage.evaluate(() => localStorage.getItem('vtt_3d_dice_skin'));
        const volume = await gmPage.evaluate(() => localStorage.getItem('vtt_3d_dice_volume'));
        const sfx = await gmPage.evaluate(() => localStorage.getItem('vtt_3d_dice_sfx'));

        expect(skinKey).toBe('ruby_ember');
        expect(volume).toBe('0.85');
        expect(sfx).toBe('true');

        // Roll with new skin
        await gmPage.evaluate(() => {
            window.Dice3D.clear();
            window.Dice3D.roll([{ sides: 8, val: 7 }]);
        });

        await gmPage.waitForTimeout(500);
        const canvasEl = gmPage.locator('#dice-box-canvas-container canvas');
        await expect(canvasEl).toBeVisible();
    });

    test('Test 7: Visual regression snapshot of floating Nat 20 critical badge', async () => {
        const { gmPage } = sandbox;

        // Trigger Nat 20 roll and freeze
        await gmPage.evaluate(() => {
            window.Dice3D.clear();
            window.Dice3D.roll([{ sides: 20, val: 20 }]);
        });

        const badge = gmPage.locator('.dice3d-floating-badge.badge-nat20');
        await expect(badge).toBeVisible({ timeout: 10000 });

        await gmPage.addStyleTag({
            content: `
              #dice-box-canvas-container {
                  background: #111827 !important;
                  z-index: 999999 !important;
              }
              #dice-box-canvas-container canvas {
                  opacity: 0 !important;
              }
              .dice3d-floating-badge {
                  position: fixed !important;
                  left: 400px !important;
                  top: 300px !important;
                  animation: none !important;
                  transform: translate(-50%, -100%) scale(1) !important;
              }
            `
        });

        await freezeDynamicElements(gmPage);

        // Capture deterministic screenshot of the Nat 20 badge element
        await expect(badge).toHaveScreenshot('nat20-crit-badge.png', {
            maxDiffPixelRatio: 0.05
        });
    });
});
