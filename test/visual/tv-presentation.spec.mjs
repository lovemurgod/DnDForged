import { test, expect } from '@playwright/test';
import { joinAsGM } from './helpers/visual-fixture.mjs';

test.describe('TV Table / Presentation Mode E2E', () => {
    test('renders TV utility pill and persists 1-inch grid calibration in presentation mode', async ({ page }) => {
        await page.goto('/vtt/?mode=presentation&campaign=default');
        await page.waitForSelector('body.vtt-presentation-mode');

        await expect(page.locator('#login-overlay')).toBeHidden();
        await expect(page.locator('#vtt-controls')).toBeHidden();

        const utilityPill = page.locator('#vtt-tv-utility-pill');
        await expect(utilityPill).toBeVisible();
        await expect(page.locator('#btn-tv-fullscreen')).toBeVisible();

        const btnCalibrate = page.locator('#btn-tv-calibrate');
        await expect(btnCalibrate).toBeVisible();
        await btnCalibrate.click();

        const calModal = page.locator('#vtt-tv-cal-modal');
        await expect(calModal).toBeVisible();

        const slider = page.locator('#vtt-tv-cal-slider');
        await slider.fill('1.6');
        await slider.dispatchEvent('input');

        const savedZoom = await page.evaluate(() => localStorage.getItem('vtt_tv_calibrated_zoom'));
        expect(savedZoom).toBe('1.6');

        await page.click('#btn-tv-cal-reset');
        const clearedZoom = await page.evaluate(() => localStorage.getItem('vtt_tv_calibrated_zoom'));
        expect(clearedZoom).toBeNull();

        await page.click('#btn-tv-cal-done');
        await expect(calModal).toBeHidden();
    });

    test('GM Presentation controls launch TV window and toggle Live/Frozen sync pill', async ({ page }) => {
        await joinAsGM(page);

        await page.click('[data-tab="tab-config"]');
        const presAccordion = page
            .locator('#tab-config details.config-accordion-section')
            .filter({ hasText: 'Presentation Display' });
        await presAccordion.evaluate((el) => {
            el.open = true;
        });

        await expect(page.locator('#btn-copy-presentation-url')).toBeVisible();
        await expect(page.locator('#btn-push-presentation-view')).toBeVisible();

        const popupPromise = page.waitForEvent('popup');
        await page.click('#btn-launch-presentation');
        const popup = await popupPromise;
        await popup.waitForSelector('body.vtt-presentation-mode');

        const tvPill = page.locator('#vtt-tv-sync-pill');
        await expect(tvPill).toBeVisible();

        const freezeBtn = page.locator('#btn-tv-pill-freeze');
        await expect(freezeBtn).toHaveText('TV: Live');
        await freezeBtn.click();
        await expect(freezeBtn).toHaveText('TV: Frozen');
        await expect(tvPill).toHaveClass(/is-frozen/);

        await page.click('#btn-tv-pill-push');
        await popup.close();
    });
});
