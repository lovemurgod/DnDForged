/**
 * test/visual/token-context-sidebar-tabs.spec.mjs
 * ForgeD VTT - Token Context Menu DOM Actions & Sidebar Tabs Test Suite
 * Validates the full tabletop UI interaction pipeline:
 * 1. Real pointer right-click on canvas token opens #vtt-token-context-menu
 * 2. Elevation stepper (+/-) updates altitude and synchronizes live to Player client
 * 3. Conditions gallery tile clicks toggle status condition and clear-all removes them
 * 4. Equip Light preset (Torch) activates illumination radius and Extinguish disables it
 * 5. Transform horizontal/vertical flips toggle token flip state across peers
 * 6. GM token deletion removes entity from canvas and synchronizes deletion to Player
 * 7. Player right-click security guard: GM-only items omitted from Player context menu
 * 8. GM sidebar tabs switching matrix across all 7 tabs (including Roll Tables & Decks)
 * 9. Player sidebar role security guard: GM-only tabs hidden with .vtt-hidden
 * 10. Visual regression snapshot of the Token Context Menu glassmorphism card
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupTwoPlayerSandbox, freezeDynamicElements } from './helpers/visual-fixture.mjs';

function resetSandboxFixtures() {
    try {
        const campPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'campaigns.json');
        if (fs.existsSync(campPath)) {
            const campData = JSON.parse(fs.readFileSync(campPath, 'utf8'));
            const camp = campData.visual_test_campaign;
            if (camp?.maps?.map_visual_dungeon) {
                const mapTokens = camp.maps.map_visual_dungeon.tokens || {};
                // Remove ephemeral tokens created during test runs
                Object.keys(mapTokens).forEach((k) => {
                    if (
                        k.startsWith('token_table_') ||
                        k.startsWith('token_1794') ||
                        k.startsWith('tok_delete_') ||
                        k === 'tok_to_delete_test'
                    ) {
                        delete mapTokens[k];
                    }
                });
                mapTokens.tok_monster_1 = {
                    id: 'tok_monster_1',
                    name: 'Goblin Raider',
                    x: 650,
                    y: 400,
                    hp: 7,
                    maxHp: 7,
                    tempHp: 0,
                    size: 1,
                    flightHeight: 0,
                    conditions: [],
                    lightEnabled: false,
                    flipX: false,
                    flipY: false,
                    layer: 'token',
                    monsterData: {
                        name: 'Goblin Raider',
                        hp: 7,
                        maxHp: 7,
                        str: 8,
                        dex: 14,
                        con: 10,
                        int: 10,
                        wis: 8,
                        cha: 8
                    }
                };
                if (mapTokens.tok_hero_1) {
                    mapTokens.tok_hero_1.ownerUsername = 'PlayerOne';
                }
            }
            fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
        }
    } catch (e) {}
}

test.describe('Token Context Menu DOM Actions & Sidebar Tabs Suite', () => {
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
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test.beforeEach(async () => {
        if (!sandbox) return;
        const { gmPage, playerPage } = sandbox;
        await gmPage.evaluate(() => {
            const old = document.getElementById('vtt-token-context-menu');
            if (old) old.remove();
            const ce = window.VTT?.canvasEngine;
            if (ce) {
                ce.dragTargetId = null;
                ce.isPanning = false;
            }
            const tokens = ce?.getTokens?.() || {};
            if (!tokens['tok_monster_1']) {
                ce?.addToken?.({
                    id: 'tok_monster_1',
                    name: 'Goblin Raider',
                    x: 650,
                    y: 400,
                    hp: 7,
                    maxHp: 7,
                    tempHp: 0,
                    size: 1,
                    flightHeight: 0,
                    conditions: [],
                    lightEnabled: false,
                    flipX: false,
                    flipY: false,
                    layer: 'token',
                    monsterData: {
                        name: 'Goblin Raider',
                        hp: 7,
                        maxHp: 7,
                        str: 8,
                        dex: 14,
                        con: 10,
                        int: 10,
                        wis: 8,
                        cha: 8
                    }
                });
            } else {
                tokens['tok_monster_1'].x = 650;
                tokens['tok_monster_1'].y = 400;
                tokens['tok_monster_1'].flightHeight = 0;
                tokens['tok_monster_1'].conditions = [];
                tokens['tok_monster_1'].lightEnabled = false;
                tokens['tok_monster_1'].flipX = false;
                tokens['tok_monster_1'].flipY = false;
                ce?.renderAll?.();
            }
        });
    });

    async function ensureTokenMenuOpen(page, tokenId = 'tok_monster_1') {
        const menu = page.locator('#vtt-token-context-menu');
        if (!(await menu.isVisible())) {
            const center = await page.evaluate((id) => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.[id];
                if (tok && ce?.panTo) {
                    ce.panTo(tok.x + 25, tok.y + 25, 1.0, 0);
                }
                const vp = document.getElementById('vtt-canvas-viewport');
                const r = vp.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }, tokenId);
            await page.mouse.click(center.x, center.y, { button: 'right' });
            await expect(menu).toBeVisible();
        }
        return menu;
    }

    test('Test 1: Right-Click Token on Canvas opens Menu', async () => {
        const { gmPage } = sandbox;

        // 1. Center camera on tok_monster_1 at (650, 400)
        const center = await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            const tokens = ce?.getTokens?.() || {};
            const tok = tokens['tok_monster_1'];
            if (tok && ce?.panTo) {
                ce.panTo(tok.x + 25, tok.y + 25, 1.0, 0);
            }
            const vp = document.getElementById('vtt-canvas-viewport');
            const r = vp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // 2. Right-click on the canvas token
        await gmPage.mouse.click(center.x, center.y, { button: 'right' });

        // 3. Verify context menu is visible in DOM
        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible();

        // 4. Verify menu header displays token name
        const header = menu.locator('.vtt-token-menu-header');
        await expect(header).toContainText('Goblin Raider');
    });

    test('Test 2: Elevation Stepper Interaction & Altitude Sync', async () => {
        const { gmPage, playerPage } = sandbox;
        const menu = await ensureTokenMenuOpen(gmPage);

        const inputFlight = menu.locator('.menu-input-flight');
        const startVal = parseInt(await inputFlight.inputValue(), 10) || 0;

        // 1. Click elevation increment button (+) once
        const btnInc = menu.locator('.menu-btn-flight-inc');
        await btnInc.click();

        const expectedVal = startVal + 5;
        await expect(inputFlight).toHaveValue(String(expectedVal));

        // 2. Player client must receive expectedVal
        await playerPage.waitForFunction(
            (target) => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && tok.flightHeight === target;
            },
            expectedVal,
            { timeout: 10000 }
        );

        // 3. Click decrement button (-) once
        const btnDec = menu.locator('.menu-btn-flight-dec');
        await btnDec.click();
        await expect(inputFlight).toHaveValue(String(startVal));

        // Player client must receive startVal
        await playerPage.waitForFunction(
            (target) => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && (tok.flightHeight || 0) === target;
            },
            startVal,
            { timeout: 10000 }
        );
    });

    test('Test 3: Conditions Gallery Toggle & Clear All', async () => {
        const { gmPage, playerPage } = sandbox;
        const menu = await ensureTokenMenuOpen(gmPage);

        // 1. Hover/find Conditions item to open submenu
        await menu.locator('.vtt-token-menu-item:has-text("Conditions")').hover();

        const stunnedTile = menu.locator('.menu-toggle-condition[data-cond="Stunned"]');
        await stunnedTile.click({ force: true });
        await expect(stunnedTile).toHaveClass(/is-active/);

        // 2. Player client receives condition update
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && tok.conditions && tok.conditions.some((c) => c.name === 'Stunned');
            },
            { timeout: 10000 }
        );

        // 3. Click Clear All Conditions button
        const btnClear = menu.locator('.menu-clear-all-conditions');
        await btnClear.click({ force: true });

        // 4. Verify stunned tile is no longer active
        await expect(stunnedTile).not.toHaveClass(/is-active/);

        // 5. Player client reflects 0 conditions
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && (!tok.conditions || tok.conditions.length === 0);
            },
            { timeout: 10000 }
        );
    });

    test('Test 4: Equip Light Preset (Torch) & Extinguish Sync', async () => {
        const { gmPage, playerPage } = sandbox;
        const menu = await ensureTokenMenuOpen(gmPage);

        // Hover over Equip Light submenu
        await menu.locator('.vtt-token-menu-item:has-text("Equip Light")').hover();

        // 1. Click Torch preset
        const torchOption = menu.locator('.menu-ctx-equip-light[data-preset="torch"]');
        await torchOption.click({ force: true });

        // 2. Player client verifies lightEnabled: true, lightBright: 20
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && tok.lightEnabled === true && tok.lightBright === 20;
            },
            { timeout: 10000 }
        );

        // 3. Re-open context menu on tok_monster_1
        const reMenu = await ensureTokenMenuOpen(gmPage);

        // 4. Click Extinguish Light
        await reMenu.locator('.vtt-token-menu-item:has-text("Equip Light")').hover();
        const extinguishOption = reMenu.locator('.menu-ctx-equip-light[data-preset="extinguish"]');
        await extinguishOption.click({ force: true });

        // 5. Player client verifies lightEnabled: false
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && tok.lightEnabled === false;
            },
            { timeout: 10000 }
        );
    });

    test('Test 5: Transform Flip H/V & Rotation Reset', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. Center on tok_monster_1 and open context menu
        const startFlipX = await gmPage.evaluate(
            () => window.VTT?.canvasEngine?.getTokens?.()?.['tok_monster_1']?.flipX ?? false
        );
        const menu = await ensureTokenMenuOpen(gmPage);

        // 2. Click Flip Horizontally inside Transform submenu
        await menu.locator('#menu-ctx-transform').hover();
        await menu.locator('#menu-flip-h').click();

        // Player client verifies flipX toggled
        await playerPage.waitForFunction(
            (expected) => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && tok.flipX === expected;
            },
            !startFlipX,
            { timeout: 10000 }
        );

        // 3. Re-open and click Flip Vertically inside Transform submenu
        const startFlipY = await gmPage.evaluate(
            () => window.VTT?.canvasEngine?.getTokens?.()?.['tok_monster_1']?.flipY ?? false
        );
        const reMenu = await ensureTokenMenuOpen(gmPage);
        await reMenu.locator('#menu-ctx-transform').hover();
        await reMenu.locator('#menu-flip-v').click();

        // Player client verifies flipY toggled
        await playerPage.waitForFunction(
            (expected) => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_monster_1'];
                return tok && tok.flipY === expected;
            },
            !startFlipY,
            { timeout: 10000 }
        );
    });

    test('Test 6: GM Token Deletion & Peer Removal', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM adds a temporary token to the canvas
        await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            ce?.addToken?.({
                id: 'tok_to_delete_test',
                name: 'Disposable Dummy',
                x: 400,
                y: 400,
                size: 1,
                layer: 'token'
            });
        });

        // 2. Center on the dummy token
        const center = await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            ce?.panTo?.(425, 425, 1.0, 0);
            const vp = document.getElementById('vtt-canvas-viewport');
            const r = vp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // 3. Player must see the dummy token
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                return !!ce?.getTokens?.()?.['tok_to_delete_test'];
            },
            { timeout: 10000 }
        );

        // 4. GM right-clicks dummy token and clicks Delete
        await gmPage.mouse.click(center.x, center.y, { button: 'right' });
        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible();

        const btnDelete = menu.locator('#menu-ctx-delete');
        await expect(btnDelete).toBeVisible();
        await btnDelete.click();

        // 5. Dummy token must disappear from both GM and Player engines
        await gmPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                return !ce?.getTokens?.()?.['tok_to_delete_test'];
            },
            { timeout: 10000 }
        );

        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                return !ce?.getTokens?.()?.['tok_to_delete_test'];
            },
            { timeout: 10000 }
        );
    });

    test('Test 7: Player Right-Click Role Security Guard', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM assigns ownership of tok_hero_1 to PlayerOne
        await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            const tokens = ce?.getTokens?.();
            if (tokens && tokens['tok_hero_1']) {
                tokens['tok_hero_1'].ownerUsername = 'PlayerOne';
                tokens['tok_hero_1'].players = ['PlayerOne'];
                window.emitTokenUpdates?.(tokens);
            }
        });

        // 2. Player waits for token ownership synchronization
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                const tok = ce?.getTokens?.()?.['tok_hero_1'];
                return tok && (tok.ownerUsername === 'PlayerOne' || tok.players?.includes('PlayerOne'));
            },
            { timeout: 10000 }
        );

        // 3. Player centers on their hero token tok_hero_1
        const center = await playerPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            const tok = ce?.getTokens?.()?.['tok_hero_1'];
            if (tok && ce?.panTo) {
                ce.panTo(tok.x + 25, tok.y + 25, 1.0, 0);
            }
            const vp = document.getElementById('vtt-canvas-viewport');
            const r = vp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // 4. Player right-clicks the hero token
        await playerPage.mouse.click(center.x, center.y, { button: 'right' });

        const menu = playerPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible();

        // 5. Verify GM-only items do NOT exist in Player menu
        const btnDelete = menu.locator('#menu-ctx-delete');
        expect(await btnDelete.count()).toBe(0);

        const btnMoveFront = menu.locator('#menu-move-front');
        expect(await btnMoveFront.count()).toBe(0);

        const moveLayer = menu.locator('.menu-ctx-move-layer');
        expect(await moveLayer.count()).toBe(0);

        // Player must still see common items (e.g. elevation, transform)
        expect(await menu.locator('.menu-btn-flight-inc').count()).toBe(1);
        expect(await menu.locator('#menu-flip-h').count()).toBe(1);

        // Close menu
        await playerPage.keyboard.press('Escape');
    });

    test('Test 8: Sidebar Tabs Switching Matrix (All 7 Tabs)', async () => {
        const { gmPage } = sandbox;

        const tabsToTest = [
            { id: 'tab-characters', tabBtn: 'button.tab-header[data-tab="tab-characters"]', panel: '#tab-characters' },
            { id: 'tab-handouts', tabBtn: 'button.tab-header[data-tab="tab-handouts"]', panel: '#tab-handouts' },
            { id: 'tab-library', tabBtn: 'button.tab-header[data-tab="tab-library"]', panel: '#tab-library' },
            { id: 'tab-assets', tabBtn: 'button.tab-header[data-tab="tab-assets"]', panel: '#tab-assets' },
            { id: 'tab-tables', tabBtn: 'button.tab-header[data-tab="tab-tables"]', panel: '#tab-tables' },
            { id: 'tab-config', tabBtn: 'button.tab-header[data-tab="tab-config"]', panel: '#tab-config' },
            { id: 'tab-chat', tabBtn: 'button.tab-header[data-tab="tab-chat"]', panel: '#tab-chat' }
        ];

        for (const { tabBtn, panel } of tabsToTest) {
            const btn = gmPage.locator(tabBtn);
            await expect(btn).toBeVisible();
            await btn.click();

            await expect(btn).toHaveClass(/active/);
            const panelEl = gmPage.locator(panel);
            await expect(panelEl).toHaveClass(/active/);
        }
    });

    test('Test 9: Sidebar GM-Only Tab Security Filter for Players', async () => {
        const { playerPage } = sandbox;

        // Verify GM-only tabs have .vtt-hidden on player client
        const libraryTab = playerPage.locator('button.tab-header[data-tab="tab-library"]');
        await expect(libraryTab).toHaveClass(/vtt-hidden/);

        const assetsTab = playerPage.locator('button.tab-header[data-tab="tab-assets"]');
        await expect(assetsTab).toHaveClass(/vtt-hidden/);

        const tablesTab = playerPage.locator('button.tab-header[data-tab="tab-tables"]');
        await expect(tablesTab).toHaveClass(/vtt-hidden/);

        // Verify player can still switch among permitted tabs
        const charTab = playerPage.locator('button.tab-header[data-tab="tab-characters"]');
        await charTab.click();
        await expect(charTab).toHaveClass(/active/);
        await expect(playerPage.locator('#tab-characters')).toHaveClass(/active/);

        const chatTab = playerPage.locator('button.tab-header[data-tab="tab-chat"]');
        await chatTab.click();
        await expect(chatTab).toHaveClass(/active/);
        await expect(playerPage.locator('#tab-chat')).toHaveClass(/active/);
    });

    test('Test 10: Visual Regression Snapshot of Token Context Menu', async () => {
        const { gmPage } = sandbox;

        // Center on tok_monster_1
        const center = await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            const tok = ce?.getTokens?.()?.['tok_monster_1'];
            if (tok && ce?.panTo) {
                ce.panTo(tok.x + 25, tok.y + 25, 1.0, 0);
            }
            const vp = document.getElementById('vtt-canvas-viewport');
            const r = vp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // Right-click to open context menu
        await gmPage.mouse.click(center.x, center.y, { button: 'right' });
        const menu = gmPage.locator('#vtt-token-context-menu');
        await expect(menu).toBeVisible();

        // Freeze dynamic animations and timestamps
        await freezeDynamicElements(gmPage);

        // Snapshot of the Token Context Menu
        await expect(menu).toHaveScreenshot('token-context-menu-glass.png', {
            maxDiffPixelRatio: 0.05
        });
    });

    test('Test 11: In-Flight Camera Pan Real-Time Synchronization for Token UI HUD', async () => {
        const { gmPage } = sandbox;

        // Dismiss any open menus or overlays
        await gmPage.keyboard.press('Escape');
        await gmPage.locator('#vtt-canvas-viewport').click({ position: { x: 50, y: 50 } });

        // Center camera on tok_monster_1
        await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            const tok = ce?.getTokens?.()?.['tok_monster_1'];
            if (tok && ce?.panTo) {
                ce.panTo(tok.x + 25, tok.y + 25, 1.0, 0);
            }
        });

        const tokenUi = gmPage.locator('#token_ui_tok_monster_1');
        await expect(tokenUi).toBeVisible();

        const initialBox = await tokenUi.boundingBox();
        expect(initialBox).not.toBeNull();

        // 1. Right-Click Drag In-Flight Mid-Drag Assertion
        const startX = initialBox.x + 250;
        const startY = initialBox.y + 250;

        await gmPage.mouse.move(startX, startY);
        await gmPage.mouse.down({ button: 'right' });
        await gmPage.mouse.move(startX + 120, startY + 80, { steps: 5 });

        // CRITICAL IN-FLIGHT ASSERTION: Token UI must have moved while mouse button is STILL PRESSED
        const midDragBox = await tokenUi.boundingBox();
        expect(Math.abs(midDragBox.x - (initialBox.x + 120))).toBeLessThanOrEqual(2.5);
        expect(Math.abs(midDragBox.y - (initialBox.y + 80))).toBeLessThanOrEqual(2.5);

        const hudTransformMid = await gmPage.locator('#vtt-token-hud-layer').evaluate((el) => el.style.transform);
        expect(hudTransformMid).toContain('translate3d(120px, 80px, 0');

        // Release mouse button to complete pan
        await gmPage.mouse.up({ button: 'right' });

        const hudTransformFinal = await gmPage.locator('#vtt-token-hud-layer').evaluate((el) => el.style.transform);
        expect(hudTransformFinal).toBe('');

        await gmPage.waitForFunction(
            ({ initialX, initialY }) => {
                const el = document.getElementById('token_ui_tok_monster_1');
                if (!el) return false;
                const r = el.getBoundingClientRect();
                return Math.abs(r.x - (initialX + 120)) <= 2.5 && Math.abs(r.y - (initialY + 80)) <= 2.5;
            },
            { initialX: initialBox.x, initialY: initialBox.y },
            { timeout: 3000 }
        );

        const finalBox = await tokenUi.boundingBox();
        expect(Math.abs(finalBox.x - (initialBox.x + 120))).toBeLessThanOrEqual(2.5);
        expect(Math.abs(finalBox.y - (initialBox.y + 80))).toBeLessThanOrEqual(2.5);

        // 2. Spacebar CAD Pan Mode In-Flight Mid-Drag Assertion
        await gmPage.keyboard.down('Space');
        await gmPage.mouse.move(startX, startY);
        await gmPage.mouse.down({ button: 'left' });
        await gmPage.mouse.move(startX - 90, startY - 60, { steps: 5 });

        const midSpaceBox = await tokenUi.boundingBox();
        expect(Math.abs(midSpaceBox.x - (finalBox.x - 90))).toBeLessThanOrEqual(2.5);
        expect(Math.abs(midSpaceBox.y - (finalBox.y - 60))).toBeLessThanOrEqual(2.5);

        await gmPage.mouse.up({ button: 'left' });
        await gmPage.keyboard.up('Space');

        const spaceTransformFinal = await gmPage.locator('#vtt-token-hud-layer').evaluate((el) => el.style.transform);
        expect(spaceTransformFinal).toBe('');
    });
});
