/**
 * test/visual/helpers/visual-fixture.mjs
 * Shared helpers for ForgeDVTT Playwright visual regression tests.
 * Handles deterministic login, animation pausing, and UI panel triggers.
 */

/**
 * Log into the VTT as GM without any password modal prompt.
 * @param {import('@playwright/test').Page} page
 */
export async function joinAsGM(page) {
    await page.goto('/vtt.html', { waitUntil: 'domcontentloaded' });

    // Wait for login overlay to be present and options loaded
    await page.waitForSelector('#login-overlay:not(.vtt-hidden)', { state: 'visible', timeout: 10000 });

    // Ensure campaign options populate
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('login-campaign');
            return sel && sel.options && sel.options.length > 0;
        },
        { timeout: 10000 }
    );

    // Configure credentials for the test campaign
    await page.evaluate(() => {
        const roleEl = document.getElementById('login-role');
        const userEl = document.getElementById('login-username');
        const campEl = document.getElementById('login-campaign');
        if (roleEl) roleEl.value = 'GM';
        if (userEl) userEl.value = 'DungeonMaster';
        if (campEl && campEl.options.length > 0) {
            campEl.selectedIndex = 0;
        }
    });

    // Click join and wait for full module initialization
    await page.click('#btn-join-game');

    // Wait until login overlay closes and modules initialize
    await page.waitForSelector('#login-overlay.vtt-hidden', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(
        () => {
            return (
                window.VTT &&
                (window.VTT._modulesInitialized === true || window.VTT._modulesInitializationState === 'initialized') &&
                !!window.VTT.canvasEngine
            );
        },
        { timeout: 15000 }
    );

    // Freeze animations and dynamic elements immediately
    await freezeDynamicElements(page);
}

/**
 * Freeze CSS animations, 3D dice physics, weather particles, and mask dynamic timestamps.
 * @param {import('@playwright/test').Page} page
 */
export async function freezeDynamicElements(page) {
    // Inject CSS to instantly disable transitions and animations
    await page.addStyleTag({
        content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      .chat-timestamp, .msg-timestamp, #display-network-latency, #vtt-fps-counter {
        visibility: hidden !important;
      }
    `
    });

    // Pause runtime canvas engines if running
    await page.evaluate(() => {
        try {
            if (window.VTT?.weatherEngine?.stop) {
                window.VTT.weatherEngine.stop();
            }
            if (window.VTT?.dice3d?.clearAll) {
                window.VTT.dice3d.clearAll();
            }
        } catch (e) {
            // Ignored in test harness
        }
    });

    // Short pause to ensure DOM settle
    await page.waitForTimeout(300);
}

/**
 * Log into the VTT as a Player without any password prompt.
 * @param {import('@playwright/test').Page} page
 * @param {string} [username='PlayerOne']
 */
export async function joinAsPlayer(page, username = 'PlayerOne') {
    await page.goto('/vtt.html', { waitUntil: 'domcontentloaded' });

    // Wait for login overlay to be present and options loaded
    await page.waitForSelector('#login-overlay:not(.vtt-hidden)', { state: 'visible', timeout: 10000 });

    // Ensure campaign options populate
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('login-campaign');
            return sel && sel.options && sel.options.length > 0;
        },
        { timeout: 10000 }
    );

    // Configure credentials for Player
    await page.evaluate(
        ({ username }) => {
            const roleEl = document.getElementById('login-role');
            const userEl = document.getElementById('login-username');
            const campEl = document.getElementById('login-campaign');
            if (roleEl) roleEl.value = 'Player';
            if (userEl) userEl.value = username;
            if (campEl && campEl.options.length > 0) {
                campEl.selectedIndex = 0;
            }
        },
        { username }
    );

    // Click join and wait for full module initialization
    await page.click('#btn-join-game');

    // Wait until login overlay closes and modules initialize
    await page.waitForSelector('#login-overlay.vtt-hidden', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(
        () => {
            return (
                window.VTT &&
                (window.VTT._modulesInitialized === true || window.VTT._modulesInitializationState === 'initialized') &&
                !!window.VTT.canvasEngine
            );
        },
        { timeout: 15000 }
    );

    // Freeze animations and dynamic elements immediately
    await freezeDynamicElements(page);
}

/**
 * Creates two isolated BrowserContexts for GM and Player.
 * @param {import('@playwright/test').Browser} browser
 * @param {Object} [options]
 */
export async function setupTwoPlayerSandbox(browser, options = {}) {
    const gmViewport = options.gmViewport || { width: 1440, height: 900 };
    const playerViewport = options.playerViewport || { width: 1440, height: 900 };
    const playerHasTouch = options.playerHasTouch ?? false;

    // Create 2 completely isolated browser contexts (clean storage/cookies)
    const gmContext = await browser.newContext({
        viewport: gmViewport,
        hasTouch: false
    });
    const playerContext = await browser.newContext({
        viewport: playerViewport,
        hasTouch: playerHasTouch
    });

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    // Join both in parallel
    await Promise.all([joinAsGM(gmPage), joinAsPlayer(playerPage, options.playerUsername || 'PlayerOne')]);

    return {
        gmContext,
        playerContext,
        gmPage,
        playerPage,
        async cleanup() {
            await Promise.all([gmContext.close().catch(() => {}), playerContext.close().catch(() => {})]);
        }
    };
}

/**
 * Ensures the VTT sidebar is expanded and the requested tab panel is active
 * without accidentally toggling the sidebar closed if the tab is already active.
 */
export async function ensureSidebarTabOpen(page, tabId) {
    await page.evaluate((targetTabId) => {
        const sidebar = document.getElementById('vtt-sidebar');
        if (sidebar && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
        }
        const btn = document.querySelector(`button.tab-header[data-tab="${targetTabId}"]`);
        const panel = document.getElementById(targetTabId);
        if (btn && panel && (!btn.classList.contains('active') || !panel.classList.contains('active'))) {
            btn.click();
            if (sidebar && sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
            }
        }
    }, tabId);
}
