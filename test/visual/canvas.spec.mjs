import { test, expect } from '@playwright/test';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

test.describe('Tabletop Canvas Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await joinAsGM(page);
    });

    test('renders battle map and tokens baseline', async ({ page }) => {
        // Reset view to center on hero token Valeros
        await page.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            if (ce) {
                if (ce.centerOnToken) {
                    ce.centerOnToken('tok_hero_1');
                } else if (ce.panTo) {
                    ce.panTo(300, 300);
                }
                if (ce.setZoom) ce.setZoom(1.0);
                ce.renderAll?.();
            }
        });

        await freezeDynamicElements(page);
        await page.waitForTimeout(500);

        const canvasViewport = page.locator('#vtt-canvas-viewport');
        await expect(canvasViewport).toHaveScreenshot('canvas-baseline.png', {
            mask: [page.locator('#vtt-fps-counter'), page.locator('.hud-overlay-transient')]
        });
    });

    test('renders token selection ring and toolbar', async ({ page }) => {
        // Select the hero token "Valeros" (id: tok_hero_1)
        await page.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            if (ce) {
                if (ce.centerOnToken) {
                    ce.centerOnToken('tok_hero_1');
                } else if (ce.panTo) {
                    ce.panTo(300, 300);
                }
                if (ce.setZoom) ce.setZoom(1.0);
                if (ce.selectToken) {
                    ce.selectToken('tok_hero_1');
                }
                ce.renderAll?.();
            }
        });

        await freezeDynamicElements(page);
        await page.waitForTimeout(500);

        const canvasViewport = page.locator('#vtt-canvas-viewport');
        await expect(canvasViewport).toHaveScreenshot('canvas-token-selected.png', {
            mask: [page.locator('#vtt-fps-counter')]
        });
    });

    test('renders ruler measurement tool mode', async ({ page }) => {
        // Activate measurement tool button on left toolbar
        await page.click('#tool-measure');
        await freezeDynamicElements(page);
        await page.waitForTimeout(300);

        const leftToolbar = page.locator('#vtt-controls');
        await expect(leftToolbar).toHaveScreenshot('toolbar-measure-active.png');
    });
});
