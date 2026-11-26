import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

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

test.describe('UI Controls, Chat & Dock Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        resetVisualChatLog();
        await joinAsGM(page);
    });

    test('renders collapsible right sidebar and chat panel', async ({ page }) => {
        // Ensure chat tab is active
        await page.evaluate(() => {
            const tabChatBtn = document.querySelector('[data-tab="tab-chat"]');
            if (tabChatBtn) tabChatBtn.click();
        });

        await freezeDynamicElements(page);
        await page.waitForTimeout(400);

        const sidebar = page.locator('#vtt-sidebar');
        await expect(sidebar).toHaveScreenshot('sidebar-chat-dock.png', {
            mask: [page.locator('.chat-timestamp'), page.locator('.msg-timestamp')]
        });
    });

    test('renders initiative tracker carousel overlay', async ({ page }) => {
        // Toggle initiative tracker on
        await page.evaluate(() => {
            const btn = document.getElementById('btn-toggle-initiative');
            const initContainer = document.getElementById('vtt-initiative-carousel-container');
            if (initContainer && initContainer.classList.contains('vtt-hidden')) {
                btn?.click();
            }
        });

        await page.waitForSelector('#vtt-initiative-carousel-container:not(.vtt-hidden)', {
            state: 'visible',
            timeout: 5000
        });
        await freezeDynamicElements(page);
        await page.waitForTimeout(400);

        const initContainer = page.locator('#vtt-initiative-carousel-container');
        await expect(initContainer).toHaveScreenshot('initiative-carousel.png', {
            animations: 'disabled',
            maxDiffPixelRatio: 0.08
        });
    });

    test('renders left controls toolbar', async ({ page }) => {
        await freezeDynamicElements(page);
        const leftControls = page.locator('#vtt-controls');
        await expect(leftControls).toHaveScreenshot('left-controls-toolbar.png');
    });
});
