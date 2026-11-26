import { test, expect } from '@playwright/test';
import { joinAsGM } from './helpers/visual-fixture.mjs';

test.describe('Themes & Color-Blindness Accessibility E2E', () => {
    test.beforeEach(async ({ page }) => {
        await joinAsGM(page);
    });

    test('switches all 11 themes and decouples colorblind warning tokens from theme accents', async ({ page }) => {
        // Open Settings tab and Appearance & Themes accordion
        await page.click('[data-tab="tab-config"]');
        await page.locator('#tab-config details.config-accordion-section').first().evaluate((el) => {
            el.open = true;
        });

        const themeSelect = page.locator('#config-visual-theme-select');
        await expect(themeSelect).toBeVisible();

        const darkAccentThemes = ['jungle', 'gothic', 'hellscape', 'cyberpunk', 'parchment', 'abyssal'];
        const lightAccentThemes = ['classic', 'celestial', 'feywild', 'frostpeak', 'solaris'];

        for (const themeId of darkAccentThemes) {
            await themeSelect.selectOption(themeId);
            const attrs = await page.evaluate(() => {
                const cs = getComputedStyle(document.documentElement);
                return {
                    theme: document.documentElement.getAttribute('data-theme'),
                    onGold: cs.getPropertyValue('--color-on-gold').trim().toLowerCase()
                };
            });
            expect(attrs.theme).toBe(themeId);
            expect(attrs.onGold).toBe('#ffffff');
        }

        for (const themeId of lightAccentThemes) {
            await themeSelect.selectOption(themeId);
            const attrs = await page.evaluate(() => {
                const cs = getComputedStyle(document.documentElement);
                return {
                    theme: document.documentElement.getAttribute('data-theme'),
                    onGold: cs.getPropertyValue('--color-on-gold').trim().toLowerCase()
                };
            });
            expect(attrs.theme).toBe(themeId);
            expect(attrs.onGold).toBe('#111111');
        }

        // Select Gothic theme, record its --color-gold-base, then enable Protanopia & Achromatopsia
        await themeSelect.selectOption('gothic');
        const gothicGoldBefore = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--color-gold-base').trim()
        );

        const cbSelect = page.locator('#config-colorblind-select');
        await cbSelect.selectOption('protanopia');
        const protanState = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            return {
                cb: document.documentElement.getAttribute('data-colorblind'),
                gold: cs.getPropertyValue('--color-gold-base').trim(),
                warning: cs.getPropertyValue('--color-warning-base').trim().toLowerCase()
            };
        });
        expect(protanState.cb).toBe('protanopia');
        expect(protanState.gold).toBe(gothicGoldBefore);
        expect(protanState.warning).toBe('#f0e442');

        await cbSelect.selectOption('achromatopsia');
        const achromState = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            return {
                cb: document.documentElement.getAttribute('data-colorblind'),
                gold: cs.getPropertyValue('--color-gold-base').trim(),
                onSuccess: cs.getPropertyValue('--color-on-success').trim().toLowerCase(),
                healthyBg: document.querySelector('#colorblind-preview-strip .cb-pill')?.style.backgroundColor,
                healthyColor: document.querySelector('#colorblind-preview-strip .cb-pill')?.style.color
            };
        });
        expect(achromState.cb).toBe('achromatopsia');
        expect(achromState.gold).toBe(gothicGoldBefore);
        expect(achromState.onSuccess).toBe('#111111');
        expect(achromState.healthyBg).toBe('rgb(255, 255, 255)');
        expect(achromState.healthyColor).toBe('rgb(17, 17, 17)');
    });

    test('renders 4 preview pills for every colorblind mode and updates HP bar colors by threshold', async ({ page }) => {
        await page.click('[data-tab="tab-config"]');
        await page.locator('#tab-config details.config-accordion-section').first().evaluate((el) => {
            el.open = true;
        });

        const cbSelect = page.locator('#config-colorblind-select');
        for (const mode of ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) {
            await cbSelect.selectOption(mode);
            const pillCount = await page.locator('#colorblind-preview-strip .cb-pill').count();
            expect(pillCount).toBe(4);
        }

        // Verify .cs-hp-bar-fill transitions across healthy, injured, and danger under Protanopia
        await cbSelect.selectOption('protanopia');
        const colors = await page.evaluate(() => {
            const bar = document.createElement('div');
            bar.className = 'cs-hp-bar-fill';
            document.body.appendChild(bar);
            const healthy = getComputedStyle(bar).backgroundColor;
            bar.classList.add('injured');
            const injured = getComputedStyle(bar).backgroundColor;
            bar.classList.remove('injured');
            bar.classList.add('danger');
            const danger = getComputedStyle(bar).backgroundColor;
            bar.remove();
            return { healthy, injured, danger };
        });

        expect(colors.healthy).toBe('rgb(0, 114, 178)'); // #0072b2
        expect(colors.injured).toBe('rgb(240, 228, 66)'); // #f0e442
        expect(colors.danger).toBe('rgb(213, 94, 0)'); // #d55e00
    });
});
