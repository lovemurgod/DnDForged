import { test, expect } from '@playwright/test';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

test.describe('Mobile Viewport & Adaptations Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await joinAsGM(page);
    });

    test('renders mobile workspace layout and navigation bar', async ({ page }) => {
        await freezeDynamicElements(page);
        await page.waitForTimeout(500);

        // Verify mobile navigation and bottom FAB controls
        await expect(page).toHaveScreenshot('mobile-workspace-baseline.png', {
            mask: [page.locator('#vtt-fps-counter'), page.locator('.chat-timestamp'), page.locator('.msg-timestamp')]
        });
    });

    test('renders mobile responsive character sheet', async ({ page }) => {
        // Open player sheet for Valeros in mobile view
        await page.evaluate(() => {
            if (window.VTT.playerSheet) {
                window.VTT.playerSheet.openSheet('char_valeros_1');
            }
        });

        await page.waitForSelector('#player-sheet-panel:not(.minimized)', { state: 'visible', timeout: 5000 });
        await freezeDynamicElements(page);
        await page.waitForTimeout(500);

        const playerSheet = page.locator('#player-sheet-panel');
        await expect(playerSheet).toHaveScreenshot('mobile-player-sheet.png');
    });
});
