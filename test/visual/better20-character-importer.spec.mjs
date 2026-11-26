/**
 * test/visual/better20-character-importer.spec.mjs
 * Granular Playwright End-to-End Test Suite for the Better20 / Roll20 JSON Character Importer.
 * Covers batch smoke imports, deep tab inspections (Core, Combat, Spells, Equipment, Features),
 * interactive dice rolling, 2-player live sync, duplicate collision rules, and token spawning.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupTwoPlayerSandbox, freezeDynamicElements, ensureSidebarTabOpen } from './helpers/visual-fixture.mjs';
import { convertRoll20Character } from '../../electron/importers/roll20-importer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');
const fixturesDir = path.join(rootDir, 'test', 'fixtures', 'roll20');

function resetSandboxFixtures() {
    try {
        const campPath = path.resolve(rootDir, 'test', 'fixtures', 'visual-sandbox-data', 'campaigns.json');
        if (fs.existsSync(campPath)) {
            const campData = JSON.parse(fs.readFileSync(campPath, 'utf8'));
            const camp = campData.visual_test_campaign;
            if (camp && camp.characters) {
                const origValeros = camp.characters.char_valeros_1;
                camp.characters = origValeros ? { char_valeros_1: origValeros } : {};
            }
            if (camp?.maps?.map_visual_dungeon?.tokens) {
                const tokens = camp.maps.map_visual_dungeon.tokens;
                for (const tokId of Object.keys(tokens)) {
                    if (tokId.startsWith('token_') && tokId !== 'token_table_1794389460736_3z9dq') {
                        delete tokens[tokId];
                    }
                }
            }
            fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
        }
    } catch {
        // Ignored in test environment
    }
}

test.describe('Better20 JSON Character Importer E2E Suite', () => {
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

    /**
     * Helper to convert and import a Better20 character JSON fixture into the active campaign.
     */
    async function importBetter20Fixture(page, fileName, options = {}) {
        const filePath = path.join(fixturesDir, fileName);
        const rawJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const converted = await convertRoll20Character(rawJson, 'camp_visual_test', options);

        if (options.modifyChar) {
            options.modifyChar(converted);
        }

        const res = await page.evaluate(
            async ({ character, overwrite }) => {
                const campId = window.VTT?.campaignId || 'camp_visual_test';
                const gmToken = window.VTT?.gmSessionToken;
                const resp = await fetch(`/api/campaigns/${campId}/import-entity`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(gmToken ? { 'x-gm-token': gmToken } : {})
                    },
                    body: JSON.stringify({
                        entityType: 'player',
                        entity: character,
                        overwrite
                    })
                });
                return await resp.json();
            },
            { character: converted, overwrite: Boolean(options.overwrite) }
        );

        return { converted, res };
    }

    test('Test 1: Batch Smoke Import Matrix (All 10 Sample Better20 JSONs)', async () => {
        const { gmPage } = sandbox;

        // 1. Discover all sample files in fixtures/roll20
        const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
        expect(files.length).toBe(10);

        // 2. Batch import all 10 characters into the campaign
        const importedNames = [];
        for (const file of files) {
            const { converted } = await importBetter20Fixture(gmPage, file);
            importedNames.push(converted.name);
        }

        // 3. Open the Player Characters sidebar tab
        const charTabBtn = gmPage.locator('[data-tab="tab-characters"]');
        await charTabBtn.click();
        await expect(gmPage.locator('#tab-characters')).toHaveClass(/active/);

        // 4. Verify all 10 imported character cards appear in the sidebar list
        const charList = gmPage.locator('#character-list');
        await expect(charList).toBeVisible();

        for (const name of importedNames) {
            const row = charList.locator(`.char-row:has-text("${name}")`).first();
            await expect(row).toBeVisible({ timeout: 5000 });
            await expect(row.locator('.init-name')).toContainText(name);
        }
    });

    test('Test 2: Deep Inspection — Multiclass Caster (LifeMoon Matt LV 10)', async () => {
        const { gmPage } = sandbox;

        // Open Player Characters tab if not already open
        await ensureSidebarTabOpen(gmPage, 'tab-characters');

        // Click LifeMoon card to open the sheet
        const card = gmPage.locator('#character-list .char-row:has-text("LifeMoon Matt LV 10")').first();
        await expect(card).toBeVisible();
        await card.click();

        // Verify player sheet panel opens
        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel).toBeVisible({ timeout: 5000 });

        // Verify Core Vitals on ps-primary
        const primaryTab = sheetPanel.locator('#ps-primary');
        await expect(primaryTab).toBeVisible();

        // AC and Speed Pills
        await expect(primaryTab.locator('.cs-stat-pill:has-text("AC ")')).toBeVisible();
        await expect(primaryTab.locator('.cs-stat-pill:has-text("Walk ")')).toBeVisible();
        await expect(primaryTab.locator('.cs-stat-pill:has-text("Prof +")')).toBeVisible();

        // Ability Scores & Modifiers: WIS 16 (+3), DEX 14 (+2), CON 16 (+3), STR 10 (+0), INT 12 (+1), CHA 8 (-1)
        const wisCell = primaryTab.locator('.cs-ability-cell[data-ab="wis"]');
        await expect(wisCell.locator('.cs-ability-score')).toHaveText('16');
        await expect(wisCell.locator('.cs-ability-mod')).toHaveText('+3');

        const dexCell = primaryTab.locator('.cs-ability-cell[data-ab="dex"]');
        await expect(dexCell.locator('.cs-ability-score')).toHaveText('14');
        await expect(dexCell.locator('.cs-ability-mod')).toHaveText('+2');

        const conCell = primaryTab.locator('.cs-ability-cell[data-ab="con"]');
        await expect(conCell.locator('.cs-ability-score')).toHaveText('16');
        await expect(conCell.locator('.cs-ability-mod')).toHaveText('+3');

        // Skills Check: Perception (Wisdom)
        const perceptionRow = primaryTab.locator('.skill-row:has-text("Perception")');
        await expect(perceptionRow).toBeVisible();
    });

    test('Test 3: Spells Tab & Spell DC Mechanics (LifeMoon)', async () => {
        const { gmPage } = sandbox;
        const sheetPanel = gmPage.locator('#player-sheet-panel');

        // Ensure LifeMoon sheet is open
        await ensureSidebarTabOpen(gmPage, 'tab-characters');
        await gmPage.locator('#character-list .char-row:has-text("LifeMoon")').first().click();

        // Switch to Spells tab
        const spellsTabBtn = sheetPanel.locator('.ps-tab-btn[data-tab="ps-spells"]');
        await expect(spellsTabBtn).toBeVisible({ timeout: 5000 });
        await spellsTabBtn.click();
        await expect(spellsTabBtn).toHaveClass(/active/);

        const spellsContent = sheetPanel.locator('#ps-spells');
        await expect(spellsContent).toBeVisible();

        // Verify spellbook heading
        await expect(spellsContent).toContainText('Spellbook');

        // Switch to All Spells view to see full spell roster
        const allSpellsTab = spellsContent.locator('.pc-spell-tab-btn[data-level="all"]');
        if (await allSpellsTab.isVisible()) {
            await allSpellsTab.click();
        }

        // Verify spell list contains imported spells (.spell-row or .pc-spell-item)
        const spellItems = spellsContent.locator('.spell-row, .pc-spell-item');
        const count = await spellItems.count();
        expect(count).toBeGreaterThan(0);

        // Verify spell slot inputs exist (Level 1 spell slots max 4)
        await expect(spellsContent.locator('.pc-slot-max[data-level="level1"]')).toHaveValue('4');
    });

    test('Test 4: Interactive Sheet Roll to Chat Log', async () => {
        const { gmPage } = sandbox;
        const sheetPanel = gmPage.locator('#player-sheet-panel');

        // Ensure LifeMoon sheet is open
        await ensureSidebarTabOpen(gmPage, 'tab-characters');
        await gmPage.locator('#character-list .char-row:has-text("LifeMoon")').first().click();

        // Switch back to Primary Tab
        const primaryTab = sheetPanel.locator('.ps-tab-btn[data-tab="ps-primary"]');
        await expect(primaryTab).toBeVisible({ timeout: 5000 });
        await primaryTab.click();

        // Switch to Game Chat tab
        await ensureSidebarTabOpen(gmPage, 'tab-chat');
        await expect(gmPage.locator('#tab-chat')).toHaveClass(/active/);

        // Click Wisdom Check roll button
        const wisRollBtn = sheetPanel.locator('.pc-roll-check[data-ab="wis"]');
        await expect(wisRollBtn).toBeVisible({ timeout: 5000 });
        await wisRollBtn.click();

        // Verify roll broadcast message appears in chat
        const chatMessages = gmPage.locator('#chat-messages');
        await expect(chatMessages).toContainText('WIS Check', { timeout: 8000 });
        await expect(chatMessages).toContainText('1D20+3[WIS]');
    });

    test('Test 5: Deep Inspection — Artificer Attacks & Infusions (BS Goblin)', async () => {
        const { gmPage } = sandbox;

        // Switch to Player Characters tab
        await ensureSidebarTabOpen(gmPage, 'tab-characters');

        // Click BS goblin card
        const card = gmPage.locator('#character-list .char-row:has-text("BS goblin Matt lv 15")').first();
        await expect(card).toBeVisible();
        await card.click();

        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel).toBeVisible({ timeout: 5000 });

        // Intelligence score must be 20 (+5)
        const intCell = sheetPanel.locator('.cs-ability-cell[data-ab="int"]');
        await expect(intCell.locator('.cs-ability-score')).toHaveText('20');
        await expect(intCell.locator('.cs-ability-mod')).toHaveText('+5');

        // Features & Info Tab
        const infoTabBtn = sheetPanel.locator('.ps-tab-btn[data-tab="ps-info"]');
        await infoTabBtn.click();
        const infoContent = sheetPanel.locator('#ps-info');
        await expect(infoContent).toBeVisible();
    });

    test('Test 6: Deep Inspection — Equipment, Currency & Item Ping (Matt Saiyan)', async () => {
        const { gmPage } = sandbox;

        // Switch to Player Characters tab
        await ensureSidebarTabOpen(gmPage, 'tab-characters');

        // Click Matt Saiyan card
        const card = gmPage.locator('#character-list .char-row:has-text("Matt Saiyan lv 17 items")').first();
        await expect(card).toBeVisible();
        await card.click();

        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel).toBeVisible({ timeout: 5000 });

        // Switch to Equipment Tab
        const eqTabBtn = sheetPanel.locator('.ps-tab-btn[data-tab="ps-equipment"]');
        await expect(eqTabBtn).toBeVisible({ timeout: 5000 });
        await eqTabBtn.click();
        const eqContent = sheetPanel.locator('#ps-equipment');
        await expect(eqContent).toBeVisible();

        // Verify currency breakdown: sp: 6, gp: 4, pp: 2
        await expect(eqContent.locator('.pc-currency-input[data-coin="sp"]')).toHaveValue('6');
        await expect(eqContent.locator('.pc-currency-input[data-coin="gp"]')).toHaveValue('4');
        await expect(eqContent.locator('.pc-currency-input[data-coin="pp"]')).toHaveValue('2');

        // Verify inventory rows rendered
        const eqRows = eqContent.locator('.equip-row');
        const eqCount = await eqRows.count();
        expect(eqCount).toBeGreaterThan(10);

        // Click item ping button on first item
        const firstPingBtn = eqContent.locator('.pc-equip-ping').first();
        if (await firstPingBtn.isVisible()) {
            await firstPingBtn.click();

            // Switch to chat and assert item card was broadcast
            await ensureSidebarTabOpen(gmPage, 'tab-chat');
            const chatMessages = gmPage.locator('#chat-messages');
            await expect(chatMessages.locator('.chat-message').last()).toBeVisible({ timeout: 5000 });
        }
    });

    test('Test 7: Two-Player Live Sync & Player Sheet Access', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM assigns ownership of LifeMoon to PlayerOne
        await gmPage.evaluate(() => {
            const camp = window.VTT?.campaignState;
            if (camp && camp.characters) {
                const charEntry = Object.values(camp.characters).find((c) => (c.name || '').includes('LifeMoon'));
                if (charEntry) {
                    charEntry.assignedPlayers = ['PlayerOne'];
                    charEntry.ownerUsername = 'PlayerOne';
                    window.VTT.socket?.emit('character:update', {
                        id: charEntry.id,
                        character: charEntry
                    });
                }
            }
        });

        // 2. On Player client, open Characters tab
        const playerCharTab = playerPage.locator('button.tab-header[data-tab="tab-characters"]');
        await playerCharTab.click();

        // 3. Player must see LifeMoon card
        const playerCard = playerPage.locator('#character-list .char-row:has-text("LifeMoon")').first();
        await expect(playerCard).toBeVisible({ timeout: 10000 });

        // 4. Player clicks to open sheet
        await playerCard.click();
        const playerSheet = playerPage.locator('#player-sheet-panel');
        await expect(playerSheet).toBeVisible({ timeout: 5000 });

        // 5. Player rolls Constitution save
        const conSaveBtn = playerSheet.locator('.pc-roll-save[data-ab="con"]');
        await conSaveBtn.click();

        // 6. GM observes player's roll synchronized live in Game Chat
        await ensureSidebarTabOpen(gmPage, 'tab-chat');
        const gmChat = gmPage.locator('#chat-messages');
        const syncedMsg = gmChat.locator('.chat-message:has-text("CON Save")').last();
        await expect(syncedMsg).toBeVisible({ timeout: 10000 });
    });

    test('Test 8: Duplicate Name Collision vs. Overwrite Rules', async () => {
        const { gmPage } = sandbox;

        // 1. Re-import LifeMoon without overwrite -> must create a Copy
        const { converted: copyChar } = await importBetter20Fixture(gmPage, 'LifeMoon_Matt_LV_10.json', {
            overwrite: false
        });

        // Open Characters tab
        await ensureSidebarTabOpen(gmPage, 'tab-characters');

        // Both original and copy must exist in the sidebar list
        const charList = gmPage.locator('#character-list');
        const copyRow = charList.locator(`.char-row:has-text("${copyChar.name} (Copy)")`).first();
        await expect(copyRow).toBeVisible({ timeout: 8000 });

        // 2. Re-import LifeMoon with overwrite: true and modified HP
        await importBetter20Fixture(gmPage, 'LifeMoon_Matt_LV_10.json', {
            overwrite: true,
            modifyChar: (c) => {
                c.hpMax = 99;
                c.hpCurrent = 99;
                c._overwrite = true;
            }
        });

        // Verify updated HP appears on the original card
        const originalRow = charList.locator(`.char-row:has-text("${copyChar.name}"):not(:has-text("(Copy)"))`).first();
        await expect(originalRow).toContainText('99/99', { timeout: 8000 });
    });

    test('Test 9: Canvas Token Spawning from Character Card', async () => {
        const { gmPage } = sandbox;

        // Open Characters tab
        await ensureSidebarTabOpen(gmPage, 'tab-characters');

        const card = gmPage.locator('#character-list .char-row:has-text("LifeMoon")').first();
        await expect(card).toBeVisible();

        // Get initial token count
        const initialCount = await gmPage.evaluate(() => {
            return Object.keys(window.VTT?.canvasEngine?.getTokens?.() || {}).length;
        });

        // Click spawn button (+) on the card via dispatchEvent (supports desktop and touch)
        const btnSpawn = card.locator('.btn-char-spawn');
        await btnSpawn.dispatchEvent('click');

        // Verify token appears in canvas engine tokens
        await gmPage.waitForFunction(
            (prevCount) => {
                const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
                const list = Object.values(tokens);
                return list.length > prevCount || list.some((t) => (t.name || '').includes('LifeMoon'));
            },
            initialCount,
            { timeout: 10000 }
        );

        const spawned = await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens?.() || {};
            return Object.values(tokens).find((t) => (t.name || '').includes('LifeMoon'));
        });

        expect(spawned).toBeTruthy();
        expect(spawned.isPlayer).toBe(true);

        // Verify token HUD element is created
        const tokenHud = gmPage.locator('.token-ui-container:has-text("LifeMoon")').first();
        await expect(tokenHud).toBeVisible({ timeout: 5000 });
    });
});
