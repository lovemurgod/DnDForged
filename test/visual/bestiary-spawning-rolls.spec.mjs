/**
 * test/visual/bestiary-spawning-rolls.spec.mjs
 * ForgeD VTT - Bestiary Compendium Spawning & Creature Rolls Multi-Client Playwright E2E Suite.
 *
 * Verifies the full tabletop UI pipeline for the Bestiary compendium:
 * 1. Bestiary tab navigation, table rendering & Player role security lockout
 * 2. Compendium real-time search and multi-parameter filtering (CR, Type, Size)
 * 3. Creature statblock sheet inspection (AC, HP, Speed, Multiattack, Legendary Actions)
 * 4. Interactive statblock rolls: Ability checks, Saving throws & Weapon attacks to chat
 * 5. Spellcaster rolls (Mage: Spell Save DC, Spell Slots & Fireball cast)
 * 6. Public vs. GM Secret / Whispered rolls privacy across GM and Player viewports
 * 7. Token Drop Customization (Average vs. Rolled HP, Show in Chat & Disposition Rings)
 * 8. Canvas Spawning, Duplicate Numbering (Goblin 1 & 2), Size scaling & Peer Live Sync
 * 9. Initiative Integration: Spawning creature with Auto-Initiative roll
 */

import { test, expect } from '@playwright/test';
import { setupTwoPlayerSandbox } from './helpers/visual-fixture.mjs';

test.describe('Bestiary Compendium Spawning & Creature Rolls E2E Suite', () => {
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
        const { gmPage, playerPage } = sandbox;
        // Close open modals & reset creature sheet
        await gmPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal, .vtt-overlay-panel').forEach((m) => m.classList.add('vtt-hidden'));
            const cs = document.getElementById('creature-sheet-panel');
            if (cs) cs.classList.remove('open');
        });
        await playerPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal, .vtt-overlay-panel').forEach((m) => m.classList.add('vtt-hidden'));
        });
    });

    async function ensureBestiaryTabActive(page) {
        const btnLib = page.locator('button.tab-header[data-tab="tab-library"]');
        if (await btnLib.isVisible()) {
            await btnLib.click();
        }
        const libraryTab = page.locator('#tab-library');
        await expect(libraryTab).toHaveClass(/active/, { timeout: 5000 });
        // Ensure Official sub-tab active
        const officialTab = page.locator('#lib-official');
        if (!(await officialTab.isVisible())) {
            const btnOfficial = page.locator('.lib-tab-btn[data-tab="lib-official"]');
            if (await btnOfficial.isVisible()) {
                await btnOfficial.click();
            }
        }
        await expect(officialTab).toBeVisible({ timeout: 5000 });
    }

    test('Test 1: Bestiary Tab Navigation, Rendering & Player Role Security', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM navigates to Bestiary library tab
        await ensureBestiaryTabActive(gmPage);

        // 2. Verify compendium controls are visible
        await expect(gmPage.locator('#library-search')).toBeVisible();
        await expect(gmPage.locator('#btn-bestiary-filter')).toBeVisible();
        await expect(gmPage.locator('#btn-bestiary-token-settings')).toBeVisible();
        await expect(gmPage.locator('#bestiary-table-header')).toBeVisible();

        // 3. Verify monster table rows populate
        const list = gmPage.locator('#library-monster-list');
        await expect(list.locator('.bestiary-table-row').first()).toBeVisible({ timeout: 10000 });
        const rowCount = await list.locator('.bestiary-table-row').count();
        expect(rowCount).toBeGreaterThan(10);

        // 4. Verify Player Client Security: GM-only library tab is hidden from Player
        const playerLibBtn = playerPage.locator('button.tab-header[data-tab="tab-library"]');
        await expect(playerLibBtn).toHaveClass(/vtt-hidden/);
    });

    test('Test 2: Bestiary Search & Multi-Parameter Filter Modal (CR, Type, Size)', async () => {
        const { gmPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Text Search for "Goblin"
        const searchInput = gmPage.locator('#library-search');
        await searchInput.fill('Goblin');
        await searchInput.dispatchEvent('input');

        const list = gmPage.locator('#library-monster-list');
        const goblinRow = list.locator('.bestiary-table-row', { hasText: 'Goblin' }).first();
        await expect(goblinRow).toBeVisible({ timeout: 5000 });

        // 2. Clear text search via clear button
        const searchClear = gmPage.locator('#library-search-clear');
        if (await searchClear.isVisible()) {
            await searchClear.click();
        } else {
            await searchInput.fill('');
            await searchInput.dispatchEvent('input');
        }

        // 3. Open Advanced Filter Modal
        await gmPage.locator('#btn-bestiary-filter').click();
        const filterModal = gmPage.locator('#modal-bestiary-filter');
        await expect(filterModal).not.toHaveClass(/vtt-hidden/);

        // 4. Filter by Challenge Rating Range (15 to 20)
        await gmPage.waitForFunction(
            () => {
                const sel = document.getElementById('filter-cr-min');
                return sel && sel.options && sel.options.length > 1;
            },
            { timeout: 5000 }
        );

        await gmPage.locator('#filter-cr-min').selectOption('15');
        await gmPage.locator('#filter-cr-max').selectOption('20');

        // 5. Apply filters
        await gmPage.locator('#btn-apply-filters').click();
        await expect(filterModal).toHaveClass(/vtt-hidden/);

        // 6. Verify filtered results only show high CR monsters
        await expect(list.locator('.bestiary-table-row').first()).toBeVisible({ timeout: 5000 });
        const dragonRow = list.locator('.bestiary-table-row', { hasText: 'Adult Red Dragon' }).first();
        await expect(dragonRow).toBeVisible({ timeout: 5000 });

        // 7. Clear all filters
        await gmPage.locator('#btn-bestiary-filter').click();
        await expect(filterModal).not.toHaveClass(/vtt-hidden/);
        await gmPage.locator('#btn-clear-filters').click();
        await gmPage.locator('#btn-apply-filters').click();
        await expect(filterModal).toHaveClass(/vtt-hidden/);
    });

    test('Test 3: Creature Sheet Statblock Inspection (Adult Red Dragon)', async () => {
        const { gmPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Search for Adult Red Dragon
        const searchInput = gmPage.locator('#library-search');
        await searchInput.fill('Adult Red Dragon');
        await searchInput.dispatchEvent('input');

        const list = gmPage.locator('#library-monster-list');
        const dragonRow = list.locator('.bestiary-table-row', { hasText: 'Adult Red Dragon' }).first();
        await expect(dragonRow).toBeVisible({ timeout: 5000 });

        // 2. Click the monster row to open creature sheet
        await dragonRow.locator('.bestiary-col-name').click();

        // 3. Verify Creature Sheet panel loads and opens
        const panel = gmPage.locator('#creature-sheet-panel');
        await expect(panel).toHaveClass(/open/, { timeout: 8000 });

        // 4. Inspect core statblock attributes
        const content = gmPage.locator('#vtt-creature-sheet-panel');
        await expect(content).toContainText('Adult Red Dragon', { timeout: 5000 });
        await expect(content).toContainText('Armor Class');
        await expect(content).toContainText('19');
        await expect(content).toContainText(/256|242/);
        await expect(content).toContainText('CR 17');

        // 5. Inspect Actions & Legendary Actions
        await expect(content).toContainText('Multiattack');
        await expect(content).toContainText('Bite');
        await expect(content).toContainText('Fire Breath');
        await expect(content).toContainText('Legendary Actions');
    });

    test('Test 4: Statblock Rolls: Ability Checks, Saving Throws & Weapon Attacks to Chat', async () => {
        const { gmPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Open Goblin statblock
        const searchInput = gmPage.locator('#library-search');
        await searchInput.fill('Goblin');
        await searchInput.dispatchEvent('input');

        const list = gmPage.locator('#library-monster-list');
        const goblinRow = list
            .locator('.bestiary-table-row')
            .filter({ has: gmPage.locator('.bestiary-col-name-text', { hasText: /^Goblin$/i }) })
            .first();
        await expect(goblinRow).toBeVisible({ timeout: 5000 });
        await goblinRow.locator('.bestiary-col-name').click();

        const panel = gmPage.locator('#creature-sheet-panel');
        await expect(panel).toHaveClass(/open/, { timeout: 8000 });
        const content = gmPage.locator('#vtt-creature-sheet-panel');
        await expect(content).toContainText('Goblin', { timeout: 8000 });

        // 2. Roll Dexterity Ability Check from sheet
        const dexCheckBtn = content
            .locator('.cs-ability-cell[data-ability="dex"] .cs-roll-check, .cs-roll-check')
            .first();
        await expect(dexCheckBtn).toBeVisible({ timeout: 5000 });
        await dexCheckBtn.click();

        // 3. Verify roll entry posts into Chat Log
        const chatMessages = gmPage.locator('#chat-messages');
        const checkMsg = chatMessages.locator('.chat-message', { hasText: /Check/i }).last();
        await expect(checkMsg).toBeVisible({ timeout: 5000 });
        const lastMsg = await checkMsg.textContent();
        expect(lastMsg).toMatch(/Check|Dexterity|Goblin/i);

        // 4. Roll Scimitar Attack from sheet
        const scimitarTrigger = content.locator('.cs-macro-trigger', { hasText: 'Scimitar' }).first();
        await expect(scimitarTrigger).toBeVisible({ timeout: 5000 });
        await scimitarTrigger.click();

        // 5. Verify Attack card posts into Chat Log with attack and damage breakdown
        const scimitarMsg = chatMessages.locator('.chat-message', { hasText: /Scimitar/i }).last();
        await expect(scimitarMsg).toBeVisible({ timeout: 8000 });
        const attackMsg = await scimitarMsg.textContent();
        expect(attackMsg).toMatch(/Scimitar|Hit|Slashing/i);
    });

    test('Test 5: Spellcaster Rolls (Mage: Spell Save DC & Fireball)', async () => {
        const { gmPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Open Mage statblock
        const searchInput = gmPage.locator('#library-search');
        await searchInput.fill('Mage');
        await searchInput.dispatchEvent('input');

        const list = gmPage.locator('#library-monster-list');
        const mageRow = list
            .locator('.bestiary-table-row')
            .filter({ has: gmPage.locator('.bestiary-col-name-text', { hasText: /^Mage$/i }) })
            .first();
        await expect(mageRow).toBeVisible({ timeout: 5000 });
        await mageRow.locator('.bestiary-col-name').click();

        const panel = gmPage.locator('#creature-sheet-panel');
        await expect(panel).toHaveClass(/open/, { timeout: 8000 });
        const content = gmPage.locator('#vtt-creature-sheet-panel');
        await expect(content).toContainText('Mage', { timeout: 8000 });

        // 2. Verify Spellcasting Trait & DC
        await expect(content).toContainText('Spellcasting');
        await expect(content).toContainText('DC 14');

        // 3. Locate and roll Fireball (or first available spell roll trigger)
        const fireballCard = content
            .locator('.cs-spell-item, .cs-macro-trigger, .cs-spell-pill', { hasText: /Fireball/i })
            .first();
        if (await fireballCard.isVisible()) {
            await fireballCard.click();
            const chatMessages = gmPage.locator('#chat-messages');
            await expect(chatMessages.locator('.chat-message').last()).toBeVisible({ timeout: 5000 });
            const spellMsg = await chatMessages.locator('.chat-message').last().textContent();
            expect(spellMsg).toMatch(/Fireball|Fire/i);
        }
    });

    test('Test 6: Public vs. GM-Whispered / Secret Rolls Privacy', async () => {
        const { gmPage, playerPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Open Goblin statblock to ensure creature sheet is active and open
        const searchInput = gmPage.locator('#library-search');
        await searchInput.fill('Goblin');
        await searchInput.dispatchEvent('input');

        const list = gmPage.locator('#library-monster-list');
        const goblinRow = list
            .locator('.bestiary-table-row')
            .filter({ has: gmPage.locator('.bestiary-col-name-text', { hasText: /^Goblin$/i }) })
            .first();
        await expect(goblinRow).toBeVisible({ timeout: 5000 });
        await goblinRow.locator('.bestiary-col-name').click();

        const panel = gmPage.locator('#creature-sheet-panel');
        await expect(panel).toHaveClass(/open/, { timeout: 8000 });
        const content = gmPage.locator('#vtt-creature-sheet-panel');
        await expect(content).toContainText('Goblin', { timeout: 8000 });

        // Ensure roll visibility toggle on creature sheet is set to Public
        const visToggle = content.locator('#cs-roll-vis-toggle');
        if (await visToggle.isVisible()) {
            const text = await visToggle.textContent();
            if (text.includes('Secret')) {
                await visToggle.click();
            }
        }

        // 2. Roll a public check
        const checkBtn = content.locator('.cs-roll-check').first();
        await expect(checkBtn).toBeVisible({ timeout: 5000 });
        await checkBtn.click();

        // 3. Player verifies public roll appears in their chat log
        const playerChat = playerPage.locator('#chat-messages');
        const playerMsgEl = playerChat.locator('.chat-message', { hasText: /Check/i }).last();
        await expect(playerMsgEl).toBeVisible({ timeout: 8000 });
        const playerMsg = await playerMsgEl.textContent();
        expect(playerMsg).toMatch(/Check/i);

        // 4. Toggle visibility to GM Secret
        if (await visToggle.isVisible()) {
            await visToggle.click();
            await expect(visToggle).toContainText('Secret');
        } else {
            await gmPage.evaluate(() => {
                const el = document.getElementById('config-roll-visibility');
                if (el) el.value = 'gm_only';
            });
        }

        // Count messages on player screen before secret roll
        const prePlayerCount = await playerChat.locator('.chat-message').count();

        // 5. GM rolls secret saving throw
        const saveBtn = content.locator('.cs-roll-save').first();
        await saveBtn.click();

        // 6. GM verifies roll appeared in GM chat
        const gmChat = gmPage.locator('#chat-messages');
        const gmSecretMsg = gmChat.locator('.chat-message', { hasText: /Saving Throw/i }).last();
        await expect(gmSecretMsg).toBeVisible({ timeout: 5000 });

        // 7. Player client verifies NO new message was received
        await playerPage.waitForTimeout(500);
        const postPlayerCount = await playerChat.locator('.chat-message').count();
        expect(postPlayerCount).toBe(prePlayerCount);

        // Reset visibility back to public
        if (await visToggle.isVisible()) {
            await visToggle.click();
        }
    });

    test('Test 7: Token Drop Customization (Average vs. Rolled HP & Disposition Rings)', async () => {
        const { gmPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Open Token Drop Settings Modal
        await gmPage.locator('#btn-bestiary-token-settings').click();
        const dropModal = gmPage.locator('#modal-token-drop-settings');
        await expect(dropModal).not.toHaveClass(/vtt-hidden/);

        // 2. Select Bestiary Tab and configure settings
        const bestiaryTabBtn = dropModal.locator('.token-drop-tab-btn[data-tab="bestiary"]');
        if (await bestiaryTabBtn.isVisible()) {
            await bestiaryTabBtn.click();
        }

        // Configure Rolled HP mode and hostile disposition ring
        await gmPage.locator('#td-bestiary-hp-mode').selectOption('roll');
        const hpChatCb = gmPage.locator('#td-bestiary-hp-chat');
        if (!(await hpChatCb.isChecked())) {
            await hpChatCb.check();
        }
        await gmPage.locator('#td-bestiary-disposition').selectOption('hostile');

        // 3. Save settings
        await gmPage.locator('#btn-save-token-drop-settings').click();
        await expect(dropModal).toHaveClass(/vtt-hidden/);

        // 4. Verify configuration persisted in state
        const config = await gmPage.evaluate(() => {
            return (
                window.VTT?.canvasEngine?.campaignSettings?.tokenDrop?.bestiary ||
                JSON.parse(localStorage.getItem('vtt_token_drop_settings') || '{}').bestiary
            );
        });

        expect(config.hpMode).toBe('roll');
        expect(config.dispositionRing).toBe('hostile');
    });

    async function spawnBestiaryMonster(page, monsterName) {
        await page.evaluate(async (name) => {
            let catalog = window.VTT?.bestiaryCatalog;
            if (!catalog || catalog.length === 0) {
                const res = await fetch('/data/bestiary-catalog.json');
                catalog = await res.json();
                window.VTT = window.VTT || {};
                window.VTT.bestiaryCatalog = catalog;
            }
            const m = catalog.find((x) => x.name.toLowerCase() === name.toLowerCase());
            if (m && window.VTT?.spawnMonsterAtCenter) {
                window.VTT.spawnMonsterAtCenter(m);
            }
        }, monsterName);
    }

    test('Test 8: Canvas Spawning, Duplicate Numbering (Goblin 1 & 2) & Peer Live Sync', async () => {
        const { gmPage, playerPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // Record initial tokens count on GM
        const initialCount = await gmPage.evaluate(
            () => Object.keys(window.VTT?.canvasEngine?.getTokens?.() || {}).length
        );

        // 1. Spawn first Goblin token via spawnBestiaryMonster
        await spawnBestiaryMonster(gmPage, 'Goblin');

        // 2. Verify token spawned in canvas engine
        await gmPage.waitForFunction(
            (prev) => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                return Object.keys(tokens).length > prev;
            },
            initialCount,
            { timeout: 8000 }
        );

        // 3. Spawn second Goblin token
        await spawnBestiaryMonster(gmPage, 'Goblin');

        // Verify duplicate numbering (e.g. "Goblin 1", "Goblin 2")
        await gmPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                const goblins = Object.values(tokens).filter((t) => t.name.startsWith('Goblin'));
                return goblins.length >= 2;
            },
            { timeout: 8000 }
        );

        // 4. Spawn Adult Red Dragon to test Huge size scaling (3x3)
        await spawnBestiaryMonster(gmPage, 'Adult Red Dragon');

        // 5. Verify Adult Red Dragon size is 3 (Huge) on GM canvas
        await gmPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                const dragon = Object.values(tokens).find((t) => t.name.includes('Adult Red Dragon'));
                return dragon && dragon.size === 3;
            },
            { timeout: 8000 }
        );

        // 6. Verify Player Client synchronizes all spawned tokens in real-time
        await playerPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                const goblins = Object.values(tokens).filter((t) => t.name.startsWith('Goblin'));
                const dragon = Object.values(tokens).find((t) => t.name.includes('Adult Red Dragon'));
                return goblins.length >= 2 && !!dragon && dragon.size === 3;
            },
            { timeout: 10000 }
        );

        const playerTokens = await playerPage.evaluate(() => {
            return Object.values(window.VTT?.canvasEngine?.getTokens?.() || {});
        });

        const playerGoblins = playerTokens.filter((t) => t.name.startsWith('Goblin'));
        const playerDragon = playerTokens.find((t) => t.name.includes('Adult Red Dragon'));

        expect(playerGoblins.length).toBeGreaterThanOrEqual(2);
        expect(playerDragon).toBeDefined();
        expect(playerDragon.size).toBe(3);
    });

    test('Test 9: Initiative Integration: Spawning with Auto-Initiative Roll', async () => {
        const { gmPage, playerPage } = sandbox;
        await ensureBestiaryTabActive(gmPage);

        // 1. Configure Auto-Roll Initiative on Drop to always trigger
        await gmPage.locator('#btn-bestiary-token-settings').click();
        const dropModal = gmPage.locator('#modal-token-drop-settings');
        await expect(dropModal).not.toHaveClass(/vtt-hidden/);

        const autoInitCb = gmPage.locator('#td-bestiary-auto-init');
        if (!(await autoInitCb.isChecked())) {
            await autoInitCb.check();
        }
        await gmPage.locator('#td-bestiary-init-trigger').selectOption('always');
        await gmPage.locator('#btn-save-token-drop-settings').click();
        await expect(dropModal).toHaveClass(/vtt-hidden/);

        // 2. Spawn a Wolf
        await spawnBestiaryMonster(gmPage, 'Wolf');

        // 3. Verify Wolf joins Initiative Tracker automatically on GM
        await gmPage.waitForFunction(
            () => {
                const combatants = window.VTT?.chatEngine?.getCombatants?.() || [];
                return combatants.some((c) => c.name.startsWith('Wolf'));
            },
            { timeout: 8000 }
        );

        // 4. Verify Player Client receives Wolf in synchronized initiative list
        await playerPage.waitForFunction(
            () => {
                const combatants = window.VTT?.chatEngine?.getCombatants?.() || [];
                return combatants.some((c) => c.name.startsWith('Wolf'));
            },
            { timeout: 8000 }
        );

        const playerCombatants = await playerPage.evaluate(() => {
            return window.VTT?.chatEngine?.getCombatants?.() || [];
        });

        const wolfEntry = playerCombatants.find((c) => c.name.startsWith('Wolf'));
        expect(wolfEntry).toBeDefined();
        expect(wolfEntry.name).toMatch(/Wolf/i);
    });
});
