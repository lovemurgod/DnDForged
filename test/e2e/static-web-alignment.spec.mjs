import { test, expect } from '@playwright/test';

const LOCAL_ORIGIN = 'http://127.0.0.1:5052';

function attachErrorCollector(page) {
    const errors = {
        consoleErrors: [],
        pageErrors: [],
        failedResponses: []
    };

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            errors.consoleErrors.push(msg.text());
        }
    });
    page.on('pageerror', (err) => {
        errors.pageErrors.push(err.message);
    });
    page.on('response', (res) => {
        const url = res.url();
        if (url.startsWith(LOCAL_ORIGIN) && res.status() >= 400) {
            errors.failedResponses.push(`${res.status()} ${url}`);
        }
    });

    return errors;
}

async function assertNoHorizontalOverflow(page, label) {
    const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
    }));
    expect(
        overflow.scrollWidth,
        `${label}: scrollWidth (${overflow.scrollWidth}) must not exceed innerWidth (${overflow.innerWidth})`
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test.describe('Static Web Alignment: Website, Prep & Play', () => {
    test('Website pages render cleanly with Online-first CTAs and Offline Option', async ({ page }) => {
        const errors = attachErrorCollector(page);

        await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('header.site-header a.site-download')).toContainText('Play Online');
        await expect(page.locator('header.site-header a.site-download')).toHaveAttribute('href', 'play/');
        await expect(page.locator('.hero-actions a[href="play/"]')).toBeVisible();
        await expect(page.locator('.hero-actions a[href="prep/"]')).toBeVisible();
        await expect(page.locator('#offline-option')).toBeVisible();
        await expect(page.locator('#offline-option a[href*="ForgeDVTT-Setup-1.5.0.exe"]')).toBeVisible();
        await assertNoHorizontalOverflow(page, 'index.html');

        for (const subpage of ['/getting-started.html', '/self-hosted-vtt.html', '/app-guide.html']) {
            await page.goto(subpage, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('header.site-header a.site-download')).toContainText('Play Online');
            await assertNoHorizontalOverflow(page, subpage);
        }

        await page.goto('/getting-started.html', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#browser-host-steps')).toBeVisible();
        await expect(page.locator('#host-steps')).toBeVisible();

        expect(errors.consoleErrors, 'Console errors on website pages').toEqual([]);
        expect(errors.pageErrors, 'Uncaught page errors on website pages').toEqual([]);
        expect(errors.failedResponses, 'Failed local responses on website pages').toEqual([]);
    });

    test('Session Prep (/prep/) runs in static-web-mode, lands on GM Dashboard, and persists campaigns', async ({
        page
    }) => {
        const errors = attachErrorCollector(page);

        await page.goto('/prep/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.classList.contains('static-web-mode'), { timeout: 10000 });

        await expect(page.locator('#tab-btn-hosting')).toBeHidden();
        await expect(page.locator('#view-hosting')).toBeHidden();
        await expect(page.locator('#tab-btn-gm')).toHaveClass(/active/);
        await expect(page.locator('#view-gm')).toHaveClass(/active/);

        await expect(page.locator('.prep-static-nav a[href="../"]')).toBeVisible();
        await expect(page.locator('.prep-static-nav a[href="../play/"]')).toBeVisible();

        await expect(page.locator('#prep-static-launch-card')).toBeVisible();
        const initialCode = (await page.locator('#prep-static-p2p-code').textContent())?.trim() || '';
        expect(initialCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

        await page.click('#btn-prep-regen-p2p-code');
        await page.waitForFunction(
            (prev) => {
                const el = document.getElementById('prep-static-p2p-code');
                const next = el ? el.textContent.trim() : '';
                return next && next !== '----' && next !== prev;
            },
            initialCode,
            { timeout: 5000 }
        );

        await expect(page.locator('#btn-gm-export-backup')).toBeVisible();
        await expect(page.locator('#btn-gm-restore-backup')).toBeVisible();

        await page.click('#btn-gm-new-campaign');
        await expect(page.locator('#modal-create-campaign')).toBeVisible();
        await page.fill('#new-camp-name-input', 'Playwright Static Campaign');
        await page.click('#btn-create-modal-submit');
        await expect(page.locator('#gm-campaign-list')).toContainText('Playwright Static Campaign', {
            timeout: 10000
        });

        await page.click('#tab-btn-sources');
        await expect(page.locator('#view-sources')).toHaveClass(/active/);
        await page.click('#tab-btn-gm');
        await expect(page.locator('#view-gm')).toHaveClass(/active/);

        await assertNoHorizontalOverflow(page, '/prep/');

        expect(errors.consoleErrors, 'Console errors on /prep/').toEqual([]);
        expect(errors.pageErrors, 'Uncaught page errors on /prep/').toEqual([]);
        expect(errors.failedResponses, 'Failed local responses on /prep/').toEqual([]);
    });

    test('Play Page (/play/) runs in static-web-mode with Online (Direct P2P) and cross-page links work', async ({
        page,
        context
    }) => {
        const errors = attachErrorCollector(page);

        await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
        await page.click('header.site-header a.site-download');
        await page.waitForURL('**/play/**', { timeout: 10000 });

        await expect(page.locator('#login-overlay .login-header p')).toContainText('Online & Offline Virtual Tabletop');
        await expect(page.locator('#tab-login-server')).toBeHidden();
        await expect(page.locator('#tab-login-p2p')).toBeVisible();
        await expect(page.locator('#tab-login-p2p')).toContainText('Online (Direct P2P)');
        await expect(page.locator('#login-p2p-group')).toBeVisible();
        await assertNoHorizontalOverflow(page, '/play/');

        await page.goto('/prep/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.classList.contains('static-web-mode'), { timeout: 10000 });
        const prepCode = (await page.locator('#prep-static-p2p-code').textContent())?.trim() || '';

        const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#btn-prep-open-play')]);
        await popup.waitForLoadState('domcontentloaded');
        expect(popup.url()).toContain(`p2p=${prepCode}`);
        await expect(popup.locator('#login-p2p-code')).toHaveValue(prepCode);
        await popup.close();

        expect(errors.consoleErrors, 'Console errors on /play/').toEqual([]);
        expect(errors.pageErrors, 'Uncaught page errors on /play/').toEqual([]);
        expect(errors.failedResponses, 'Failed local responses on /play/').toEqual([]);
    });
});
