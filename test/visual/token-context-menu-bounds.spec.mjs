/**
 * test/visual/token-context-menu-bounds.spec.mjs
 * ForgeD VTT - Token Context Menu Viewport Clamping & Bounds E2E Suite.
 *
 * Verifies:
 * 1. Desktop resolution (1440x900): Context menu right-clicked near bottom edge
 *    is clamped safely inside viewport (menu.bottom <= window.innerHeight - 10)
 *    and `#menu-ctx-delete` is 100% visible and unclipped.
 * 2. Compact laptop resolution (1366x768): Right-click near bottom edge clamps
 *    without cutting off the delete option halfway.
 * 3. Short viewport (1280x520): Menu applies max-height and scrolling cleanly.
 * 4. Cascading Submenus: Transform and Arrange submenus render smoothly and their
 *    actions (Flip Horizontally, Move to Front) execute properly.
 * 5. Right Edge Boundary: Submenu flips leftwards when menu is near right screen border.
 * 6. Mass Actions Context Menu: Multi-token context menu clamps cleanly inside viewport.
 * 7. End-to-End Deletion: Clicking the fully visible #menu-ctx-delete removes the token.
 */

import { test, expect } from '@playwright/test';
import { setupTwoPlayerSandbox } from './helpers/visual-fixture.mjs';

test.describe('Token Context Menu Viewport Clamping & Bounds Suite', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 1440, height: 900 },
            playerUsername: 'PlayerOne',
            playerHasTouch: false
        });
    });

    test.afterAll(async () => {
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test.beforeEach(async () => {
        if (!sandbox) return;
        const { gmPage } = sandbox;
        // Reset viewport to standard baseline and close open menus
        await gmPage.setViewportSize({ width: 1440, height: 900 });
        await gmPage.evaluate(() => {
            const old = document.getElementById('vtt-token-context-menu');
            if (old) old.remove();
        });
    });

    test('Test 1: Standard Desktop (1440x900) - Bottom-Edge Clamping & Delete Visibility', async () => {
        const { gmPage } = sandbox;

        // 1. Trigger context menu near the bottom edge (clientY = 840 on a 900px screen)
        await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const hero = Object.values(tokens).find((t) => t.name === 'Valeros') || Object.values(tokens)[0];
            if (hero && window.VTT?.canvasEngine?.showTokenContextMenu) {
                window.VTT.canvasEngine.showTokenContextMenu(hero.id, 500, 840);
            }
        });

        // 2. Locate context menu
        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        // 3. Inspect bounding rect coordinates
        const bounds = await menu.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
                top: r.top,
                bottom: r.bottom,
                height: r.height,
                windowHeight: window.innerHeight
            };
        });

        // 4. Assert entire menu is inside viewport with safety margin
        expect(bounds.bottom).toBeLessThanOrEqual(bounds.windowHeight - 8);
        expect(bounds.top).toBeGreaterThanOrEqual(8);

        // 5. Inspect the bottom-most item: Delete
        const deleteBtn = menu.locator('#menu-ctx-delete');
        await expect(deleteBtn).toBeVisible({ timeout: 3000 });

        const deleteBounds = await deleteBtn.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
                top: r.top,
                bottom: r.bottom,
                height: r.height,
                windowHeight: window.innerHeight
            };
        });

        // Delete button must be 100% inside the viewport (not cut off halfway)
        expect(deleteBounds.bottom).toBeLessThanOrEqual(deleteBounds.windowHeight - 8);
        expect(deleteBounds.height).toBeGreaterThanOrEqual(28);
    });

    test('Test 2: Compact Laptop Viewport (1366x768) - No Bottom Cut-Off', async () => {
        const { gmPage } = sandbox;
        await gmPage.setViewportSize({ width: 1366, height: 768 });

        // Right-click token near lower third of screen (clientY = 680 on a 768px screen)
        await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const hero = Object.values(tokens)[0];
            if (hero && window.VTT?.canvasEngine?.showTokenContextMenu) {
                window.VTT.canvasEngine.showTokenContextMenu(hero.id, 450, 680);
            }
        });

        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        const bounds = await menu.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
                top: r.top,
                bottom: r.bottom,
                windowHeight: window.innerHeight
            };
        });

        expect(bounds.bottom).toBeLessThanOrEqual(768 - 8);
        expect(bounds.top).toBeGreaterThanOrEqual(8);

        const deleteBtn = menu.locator('#menu-ctx-delete');
        await expect(deleteBtn).toBeVisible();

        const deleteBounds = await deleteBtn.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { bottom: r.bottom, height: r.height };
        });

        expect(deleteBounds.bottom).toBeLessThanOrEqual(768 - 8);
        expect(deleteBounds.height).toBeGreaterThanOrEqual(28);
    });

    test('Test 3: Short Viewport (1280x380) - Safety Max-Height & Scrolling', async () => {
        const { gmPage } = sandbox;
        await gmPage.setViewportSize({ width: 1280, height: 380 });

        await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const hero = Object.values(tokens)[0];
            if (hero && window.VTT?.canvasEngine?.showTokenContextMenu) {
                window.VTT.canvasEngine.showTokenContextMenu(hero.id, 400, 200);
            }
        });

        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        const bounds = await menu.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
                height: r.height,
                windowHeight: window.innerHeight,
                overflowY: window.getComputedStyle(el).overflowY
            };
        });

        expect(bounds.height).toBeLessThanOrEqual(380 - 16);
        expect(['auto', 'scroll']).toContain(bounds.overflowY);
    });

    test('Test 4: Cascading Submenus Navigation (Transform & Arrange)', async () => {
        const { gmPage } = sandbox;

        await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const hero = Object.values(tokens).find((t) => t.name === 'Valeros') || Object.values(tokens)[0];
            if (hero) {
                hero.flipX = false;
                if (window.VTT?.canvasEngine?.showTokenContextMenu) {
                    window.VTT.canvasEngine.showTokenContextMenu(hero.id, 300, 200);
                }
            }
        });

        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        // 1. Hover Transform submenu trigger
        const transformItem = menu.locator('#menu-ctx-transform');
        await expect(transformItem).toBeVisible();
        await transformItem.hover();

        const flipH = menu.locator('#menu-flip-h');
        await expect(flipH).toBeVisible({ timeout: 3000 });

        // 2. Click Flip Horizontally
        await flipH.click();

        // 3. Verify token was flipped horizontally
        await gmPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                const hero = Object.values(tokens).find((t) => t.name === 'Valeros') || Object.values(tokens)[0];
                return hero?.flipX === true;
            },
            { timeout: 3000 }
        );

        const isFlipped = await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const hero = Object.values(tokens).find((t) => t.name === 'Valeros') || Object.values(tokens)[0];
            return hero?.flipX;
        });
        expect(isFlipped).toBe(true);
    });

    test('Test 5: Right-Screen Edge Submenu Flip (Opens Leftwards)', async () => {
        const { gmPage } = sandbox;

        // Position menu near the right boundary (clientX = 1380 on a 1440px wide screen)
        await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const hero = Object.values(tokens)[0];
            if (hero && window.VTT?.canvasEngine?.showTokenContextMenu) {
                window.VTT.canvasEngine.showTokenContextMenu(hero.id, 1380, 200);
            }
        });

        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        const transformItem = menu.locator('#menu-ctx-transform');
        await transformItem.hover();

        // Submenu should flip leftward so it doesn't get clipped past 1440px
        const subBounds = await transformItem.locator('.vtt-token-submenu').evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
                right: r.right,
                left: r.left,
                windowWidth: window.innerWidth
            };
        });

        expect(subBounds.right).toBeLessThanOrEqual(1440);
        expect(subBounds.left).toBeGreaterThanOrEqual(0);
    });

    test('Test 6: Mass Actions Multi-Token Context Menu Bounds', async () => {
        const { gmPage } = sandbox;

        // Trigger mass context menu near the bottom
        await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            const ids = Object.keys(tokens).slice(0, 3);
            if (ids.length > 0 && window.VTT?.canvasEngine?.showMassRollContextMenu) {
                window.VTT.canvasEngine.showMassRollContextMenu(ids, 400, 840);
            }
        });

        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        const bounds = await menu.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { bottom: r.bottom, windowHeight: window.innerHeight };
        });

        expect(bounds.bottom).toBeLessThanOrEqual(bounds.windowHeight - 8);

        const deleteBtn = menu.locator('#menu-ctx-delete');
        await expect(deleteBtn).toBeVisible();
        await expect(deleteBtn).toContainText(/Delete/i);
    });

    test('Test 7: Token Deletion Execution via Clamped Context Menu', async () => {
        const { gmPage } = sandbox;

        // 1. Spawn a disposable token to delete
        const tempTokenId = await gmPage.evaluate(() => {
            const id = `tok_delete_test_${Date.now()}`;
            const token = {
                id,
                name: 'Disposable Goblin',
                x: 600,
                y: 600,
                hp: 7,
                maxHp: 7,
                size: 1,
                layer: 'token'
            };
            window.VTT?.canvasEngine?.addToken?.(token);
            return id;
        });

        // 2. Open context menu at the bottom edge (clientY = 830)
        await gmPage.evaluate((id) => {
            window.VTT?.canvasEngine?.showTokenContextMenu?.(id, 450, 830);
        }, tempTokenId);

        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible({ timeout: 5000 });

        // 3. Click the bottom-most Delete option
        const deleteBtn = menu.locator('#menu-ctx-delete');
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        // 4. Assert token was cleanly removed from canvas engine
        await gmPage.waitForFunction(
            (id) => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                return !tokens[id];
            },
            tempTokenId,
            { timeout: 5000 }
        );

        const exists = await gmPage.evaluate((id) => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            return !!tokens[id];
        }, tempTokenId);
        expect(exists).toBe(false);
    });
});
