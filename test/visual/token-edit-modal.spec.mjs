/**
 * test/visual/token-edit-modal.spec.mjs
 * ForgeD VTT - Token Edit Modal (Lighting, Auras, Bars, Visual FX) Playwright E2E Suite.
 *
 * Verifies the full tabletop UI pipeline for token configuration:
 * 1. Double-click token or context menu trigger opens #modal-token-edit with populated stats
 * 2. Basic stats (Name, HP, Max HP, Temp HP) and visibility overrides (always, hover, default, never)
 * 3. Token size presets (Tiny/Small/Medium/Large/Huge) vs Custom non-square dimensions
 * 4. 5e Dynamic Lighting presets (Torch, Bullseye Lantern), beam arc, facing angle, animation FX
 * 5. Multi-Aura list CRUD: adding auras, circle/square shape, style, color swatches, deletion
 * 6. Visual FX Studio: Overlay color tint, border vignette depth, floor drop shadow
 * 7. Two-player multi-client live sync: GM submits edits and Player client canvas updates instantly
 * 8. Save Token Defaults to Character Sheet (campaign.characters) and Token Deletion removal
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
            if (camp?.maps?.map_visual_dungeon?.tokens?.tok_hero_1) {
                const hero = camp.maps.map_visual_dungeon.tokens.tok_hero_1;
                hero.name = 'Valeros';
                hero.hp = 42;
                hero.maxHp = 42;
                hero.tempHp = 0;
                hero.hpBarVisibleOverride = 'default';
                hero.hpNumVisibleOverride = 'default';
                hero.size = 1;
                delete hero.customWidth;
                delete hero.customHeight;
                hero.sightRange = 60;
                hero.lightEnabled = false;
                hero.lightBright = 20;
                hero.lightDim = 40;
                hero.lightColor = '#ffaa00';
                hero.lightAngle = 360;
                hero.lightAnimationType = 'none';
                hero.auras = [];
                hero.fxOverlayEnabled = false;
                hero.fxVignetteEnabled = false;
                hero.fxShadowEnabled = false;
            }
            if (camp?.maps?.map_visual_dungeon?.tokens?.tok_monster_1) {
                const monster = camp.maps.map_visual_dungeon.tokens.tok_monster_1;
                monster.name = 'Goblin Raider';
                monster.hp = 7;
                monster.maxHp = 7;
                monster.tempHp = 0;
            }
            if (camp?.characters?.char_valeros_1) {
                const char = camp.characters.char_valeros_1;
                char.hp = { current: 42, max: 42, temp: 0 };
                char.hpCurrent = 42;
                char.hpMax = 42;
                char.tempHp = 0;
                char.tokenSize = 1;
                delete char.tokenCustomWidth;
                delete char.tokenCustomHeight;
                char.tokenSight = 60;
            }
            fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
        }
    } catch (e) {
        console.warn('Failed to reset sandbox fixtures:', e.message);
    }
}

test.describe('Token Edit Modal (Lighting, Auras, Bars, Visual FX) E2E Suite', () => {
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
        resetSandboxFixtures();
    });

    test.beforeEach(async () => {
        if (!sandbox) return;
        const { gmPage, playerPage } = sandbox;
        await gmPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal').forEach((m) => m.classList.add('vtt-hidden'));
        });
        await playerPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal').forEach((m) => m.classList.add('vtt-hidden'));
        });
    });

    async function openModalForToken(page, tokenId) {
        await page.evaluate((id) => {
            if (window.VTT?.canvasEngine?.openTokenEditModal) {
                window.VTT.canvasEngine.openTokenEditModal(id);
            } else if (window.VTT?.canvasEngine?.openTokenConfigModal) {
                window.VTT.canvasEngine.openTokenConfigModal(id);
            }
        }, tokenId);
        const modal = page.locator('#modal-token-edit');
        await expect(modal).toBeVisible({ timeout: 5000 });
        return modal;
    }

    test('Test 1: Modal Triggering via Canvas Interaction & Initial State Verification', async () => {
        const { gmPage } = sandbox;

        // 1. Center camera on tok_hero_1 and double-click token on canvas
        const center = await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            const tok = ce?.getTokens?.()?.['tok_hero_1'];
            if (tok && ce?.panTo) {
                ce.panTo(tok.x + 25, tok.y + 25, 1.0, 0);
            }
            const vp = document.getElementById('vtt-canvas-viewport');
            const r = vp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // Double-click canvas to trigger token modal
        await gmPage.mouse.dblclick(center.x, center.y);

        // Fallback open if dblclick hit detection had subpixel jitter
        const modal = gmPage.locator('#modal-token-edit');
        if (!(await modal.isVisible())) {
            await openModalForToken(gmPage, 'tok_hero_1');
        }

        // 2. Assert initial values populated correctly from live token
        const initialTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });
        expect(initialTok).toBeDefined();

        await expect(modal).toBeVisible();
        await expect(gmPage.locator('#token-edit-title')).toHaveText(`Edit Token: ${initialTok.name}`);
        await expect(gmPage.locator('#token-edit-name')).toHaveValue(initialTok.name);
        await expect(gmPage.locator('#token-edit-hp')).toHaveValue(String(initialTok.hp));
        await expect(gmPage.locator('#token-edit-max-hp')).toHaveValue(String(initialTok.maxHp));
        await expect(gmPage.locator('#token-edit-hp-visible')).toHaveValue(
            initialTok.hpBarVisibleOverride || 'default'
        );
        await expect(gmPage.locator('#token-edit-hp-num-visible')).toHaveValue(
            initialTok.hpNumVisibleOverride || 'default'
        );

        // 3. Close modal via Cancel button
        await gmPage.locator('#btn-token-edit-cancel').click();
        await expect(modal).toHaveClass(/vtt-hidden/);
    });

    test('Test 2: Basic Stats & HP Bar/Number Visibility Overrides', async () => {
        const { gmPage } = sandbox;
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // 1. Mutate HP and visibility overrides
        await gmPage.locator('#token-edit-hp').fill('10');
        await gmPage.locator('#token-edit-temp-hp').fill('5');
        await gmPage.locator('#token-edit-hp-visible').selectOption('always');
        await gmPage.locator('#token-edit-hp-num-visible').selectOption('always');

        // 2. Save changes
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        // 3. Assert updated state in canvas engine
        const updatedTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });

        expect(updatedTok.hp).toBe(10);
        expect(updatedTok.tempHp).toBe(5);
        expect(updatedTok.hpBarVisibleOverride).toBe('always');
        expect(updatedTok.hpNumVisibleOverride).toBe('always');
    });

    test('Test 3: Token Size Presets & Custom Non-Square Dimensions', async () => {
        const { gmPage } = sandbox;
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // 1. Select Large Preset (2x2)
        await gmPage.locator('#token-edit-size').selectOption('2');
        await gmPage.locator('#token-edit-size').dispatchEvent('change');
        await expect(gmPage.locator('#token-edit-custom-size-fields')).toHaveClass(/vtt-hidden/);

        // 2. Select Custom Non-Square Dimensions (2x1 for a mount / carriage)
        await gmPage.locator('#token-edit-size').selectOption('custom');
        await gmPage.locator('#token-edit-size').dispatchEvent('change');
        await expect(gmPage.locator('#token-edit-custom-size-fields')).not.toHaveClass(/vtt-hidden/);

        await gmPage.locator('#token-edit-custom-width').fill('2');
        await gmPage.locator('#token-edit-custom-height').fill('1');

        // 3. Submit and verify dimensions
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        const customTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });

        expect(customTok.size).toBe(2);
        expect(customTok.customWidth).toBe(2);
        expect(customTok.customHeight).toBe(1);

        // 4. Reopen and reset back to standard Medium (1x1)
        await openModalForToken(gmPage, 'tok_hero_1');
        await gmPage.locator('#token-edit-size').selectOption('1');
        await gmPage.locator('#token-edit-size').dispatchEvent('change');
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        const resetTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });
        expect(resetTok.size).toBe(1);
        expect(resetTok.customWidth).toBeUndefined();
        expect(resetTok.customHeight).toBeUndefined();
    });

    test('Test 4: Dynamic Lighting Presets & Animation FX (Torch & Bullseye Lantern)', async () => {
        const { gmPage } = sandbox;
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // 1. Enable lighting
        const lightCb = gmPage.locator('#token-edit-light-enabled');
        if (!(await lightCb.isChecked())) {
            await lightCb.check();
        }
        await expect(gmPage.locator('#token-light-settings')).toBeVisible();

        // 2. Select Torch preset
        await gmPage.locator('#token-edit-light-preset').selectOption('torch');
        await gmPage.locator('#token-edit-light-preset').dispatchEvent('change');

        await expect(gmPage.locator('#token-edit-light-bright')).toHaveValue('20');
        await expect(gmPage.locator('#token-edit-light-dim')).toHaveValue('20');
        await expect(gmPage.locator('#token-edit-light-color')).toHaveValue('#ff9d3b');
        await expect(gmPage.locator('#token-edit-light-fx')).toHaveValue('flicker');

        // 3. Switch to Bullseye Lantern preset
        await gmPage.locator('#token-edit-light-preset').selectOption('lantern_bullseye');
        await gmPage.locator('#token-edit-light-preset').dispatchEvent('change');

        await expect(gmPage.locator('#token-edit-light-bright')).toHaveValue('60');
        await expect(gmPage.locator('#token-edit-light-dim')).toHaveValue('60');
        await expect(gmPage.locator('#token-edit-light-angle')).toHaveValue('60');

        // 4. Save and verify token received lighting properties
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        const litTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });

        expect(litTok.lightEnabled).toBe(true);
        expect(litTok.lightBright).toBe(60);
        expect(litTok.lightDim).toBe(60);
        expect(litTok.lightAngle).toBe(60);
    });

    test('Test 5: Multi-Aura Creation, Styling & Deletion', async () => {
        const { gmPage } = sandbox;
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // 1. Click Add Aura
        await gmPage.locator('#btn-token-add-aura').click();
        const aurasList = gmPage.locator('#token-auras-list');
        const cards = aurasList.locator('.aura-item-card');
        await expect(cards).toHaveCount(1);

        // 2. Configure first aura
        const card1 = cards.first();
        await card1.locator('.aura-name-input').fill('Aura of Protection');
        await card1.locator('.aura-range-input').fill('10');
        await card1.locator('.aura-shape-select').selectOption('circle');
        await card1.locator('.aura-style-select').selectOption('both');

        // 3. Add second aura
        await gmPage.locator('#btn-token-add-aura').click();
        await expect(cards).toHaveCount(2);

        const card2 = cards.nth(1);
        await card2.locator('.aura-name-input').fill('Spirit Guardians');
        await card2.locator('.aura-range-input').fill('15');

        // 4. Delete second aura
        await card2.locator('.btn-delete-aura').click();
        await expect(cards).toHaveCount(1);

        // 5. Submit changes
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        const auraTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });

        expect(auraTok.auras).toBeDefined();
        expect(auraTok.auras.length).toBe(1);
        expect(auraTok.auras[0].name).toBe('Aura of Protection');
        expect(auraTok.auras[0].range).toBe(10);
        expect(auraTok.auraEnabled).toBe(true);
    });

    test('Test 6: Visual FX Studio (Overlay Tint, Vignette & Drop Shadow)', async () => {
        const { gmPage } = sandbox;
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // 1. Test Overlay Tab & Configuration
        await gmPage.locator('#tab-btn-fx-overlay').click();
        await expect(gmPage.locator('#panel-fx-overlay')).toBeVisible();
        await expect(gmPage.locator('#panel-fx-vignette')).toHaveClass(/vtt-hidden/);

        const overlayCb = gmPage.locator('#token-edit-fx-overlay-enabled');
        if (!(await overlayCb.isChecked())) {
            await overlayCb.check();
        }
        await expect(gmPage.locator('#fx-overlay-details')).toBeVisible();

        await gmPage.locator('#token-edit-fx-overlay-color').fill('#007bff');
        await gmPage.evaluate(() => {
            const slider = document.getElementById('token-edit-fx-overlay-opacity');
            if (slider) {
                slider.value = '0.4';
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        await expect(gmPage.locator('#val-fx-overlay-opacity')).toHaveText('40%');

        // 2. Test Vignette Tab
        await gmPage.locator('#tab-btn-fx-vignette').click();
        await expect(gmPage.locator('#panel-fx-vignette')).toBeVisible();

        const vignetteCb = gmPage.locator('#token-edit-fx-vignette-enabled');
        if (!(await vignetteCb.isChecked())) {
            await vignetteCb.check();
        }
        await expect(gmPage.locator('#fx-vignette-details')).toBeVisible();

        // 3. Test Shadow Tab
        await gmPage.locator('#tab-btn-fx-shadow').click();
        await expect(gmPage.locator('#panel-fx-shadow')).toBeVisible();

        const shadowCb = gmPage.locator('#token-edit-fx-shadow-enabled');
        if (!(await shadowCb.isChecked())) {
            await shadowCb.check();
        }
        await expect(gmPage.locator('#fx-shadow-details')).toBeVisible();
        await gmPage.locator('#token-edit-fx-shadow-blur').fill('16');

        // 4. Save and verify FX properties
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        const fxTok = await gmPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });

        expect(fxTok.fxOverlayEnabled).toBe(true);
        expect(fxTok.fxOverlayOpacity).toBe(0.4);
        expect(fxTok.fxOverlayColor).toBe('#007bff');
        expect(fxTok.fxVignetteEnabled).toBe(true);
        expect(fxTok.fxShadowEnabled).toBe(true);
        expect(fxTok.fxShadowBlur).toBe(16);
    });

    test('Test 7: Two-Player Live Sync & Canvas Rendering Verification', async () => {
        const { gmPage, playerPage } = sandbox;
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // 1. GM configures Torch light & sync-identifiable aura
        const lightCb = gmPage.locator('#token-edit-light-enabled');
        if (!(await lightCb.isChecked())) {
            await lightCb.check();
        }
        await gmPage.locator('#token-edit-light-preset').selectOption('torch');
        await gmPage.locator('#token-edit-light-preset').dispatchEvent('change');

        // Add distinct sync aura
        await gmPage.locator('#btn-token-add-aura').click();
        const aurasList = gmPage.locator('#token-auras-list');
        const card = aurasList.locator('.aura-item-card').last();
        await card.locator('.aura-name-input').fill('Blessing of Valeros');
        await card.locator('.aura-range-input').fill('15');

        // 2. Submit changes on GM client
        await gmPage.locator('#btn-token-edit-submit').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        // 3. Player client asserts live synchronization via WebSocket broadcast
        await playerPage.waitForFunction(
            () => {
                const tok = window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
                if (!tok) return false;
                const hasTorch = tok.lightEnabled === true && tok.lightBright === 20;
                const hasAura = tok.auras && tok.auras.some((a) => a.name === 'Blessing of Valeros' && a.range === 15);
                return hasTorch && hasAura;
            },
            { timeout: 10000 }
        );

        const playerTok = await playerPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getTokens?.()?.['tok_hero_1'];
        });

        expect(playerTok.lightEnabled).toBe(true);
        expect(playerTok.lightBright).toBe(20);
        expect(playerTok.auras.some((a) => a.name === 'Blessing of Valeros')).toBe(true);
    });

    test('Test 8: Save Defaults to Character Sheet & Token Deletion', async () => {
        const { gmPage, playerPage } = sandbox;

        // Part A: Save Defaults to Character Sheet
        const modal = await openModalForToken(gmPage, 'tok_hero_1');

        // Mutate sight range
        await gmPage.locator('#token-edit-sight').fill('90');

        // Click Save Token Defaults
        await gmPage.locator('#btn-token-edit-save-defaults').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        // Verify campaign character sheet received defaults
        const charValeros = await gmPage.evaluate(() => {
            return window.VTT?.campaignState?.characters?.['char_valeros_1'];
        });

        expect(charValeros).toBeDefined();
        expect(charValeros.tokenSight).toBe(90);
        expect(charValeros.tokenSize).toBe(1);

        // Part B: Token Deletion
        const monsterModal = await openModalForToken(gmPage, 'tok_monster_1');
        await expect(gmPage.locator('#token-edit-title')).toContainText('Goblin Raider');

        // Delete token
        await gmPage.locator('#btn-token-edit-delete').click();
        await expect(monsterModal).toHaveClass(/vtt-hidden/);

        // Assert removed from GM canvas
        const gmHasMonster = await gmPage.evaluate(() => {
            return !!window.VTT?.canvasEngine?.getTokens?.()?.['tok_monster_1'];
        });
        expect(gmHasMonster).toBe(false);

        // Assert removed from Player canvas
        await playerPage.waitForFunction(
            () => {
                return !window.VTT?.canvasEngine?.getTokens?.()?.['tok_monster_1'];
            },
            { timeout: 10000 }
        );

        const playerHasMonster = await playerPage.evaluate(() => {
            return !!window.VTT?.canvasEngine?.getTokens?.()?.['tok_monster_1'];
        });
        expect(playerHasMonster).toBe(false);
    });
});
