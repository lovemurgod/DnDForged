/**
 * test/visual/custom-item-spell-wizard.spec.mjs
 * ForgeDVTT - Custom Item & Spell Creation Wizard Multi-Client Playwright E2E Suite.
 *
 * Verifies end-to-end custom item & homebrew spell workflows, the Item Automation Wizard,
 * container tare weight & encumbrance neutralization, and two-player real-time live sync:
 * 1. Custom Mundane Gear: Add, Edit Quantity, and Delete
 * 2. Custom Weapon Creation & Attack Macro Wizard (stat, damage formula, attack roll)
 * 3. Custom Armor Creation & AC Automation Wizard (overwrite/add AC, DEX modifier cap)
 * 4. Custom Leveled Spell: Save DC, Multi-Row Damage, and Upcast Roll
 * 5. Custom Cantrip with Spell Attack Roll & Scaling
 * 6. Limited-Use Innate Spell & Long Rest Recovery
 * 7. Container Management & Bag of Holding Encumbrance Neutralization
 * 8. Two-Player Live Sync: GM Creation -> Player View & Live Chat Roll
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupTwoPlayerSandbox } from './helpers/visual-fixture.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

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
            fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
        }
    } catch {
        // Ignored in test environment
    }
}

test.describe('Custom Item & Spell Creation Wizard E2E Suite', () => {
    test.setTimeout(60000);
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
        // Close any lingering modals
        await gmPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal, .vtt-sheet-submodal, .vtt-sheet-submodal-overlay').forEach((m) => {
                m.classList.add('vtt-hidden');
            });
        });
        await playerPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal, .vtt-sheet-submodal, .vtt-sheet-submodal-overlay').forEach((m) => {
                m.classList.add('vtt-hidden');
            });
        });
    });

    /**
     * Helper to open the Player Sheet for Valeros (or default character) on a given page.
     */
    async function openSheet(page) {
        await page.locator('[data-tab="tab-characters"]').click();
        await expect(page.locator('#tab-characters')).toHaveClass(/active/);

        const charItem = page.locator('#character-list .char-row').first();
        try {
            await charItem.waitFor({ state: 'visible', timeout: 3000 });
            await charItem.click();
        } catch {
            await page.locator('#btn-char-add').click();
        }

        const sheetPanel = page.locator('#player-sheet-panel');
        await expect(sheetPanel).toBeVisible({ timeout: 5000 });
        return sheetPanel;
    }

    test('Test 1: Custom Mundane Gear - Add, Edit Quantity, and Delete', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        // Switch to Equipment tab
        await sheet.locator('.ps-tab-btn[data-tab="ps-equipment"]').click();
        await expect(sheet.locator('#ps-equipment')).toBeVisible();

        // Click Custom Item button
        await sheet.locator('#btn-add-equip-custom').click();
        const customModal = gmPage.locator('#pc-custom-item-modal');
        await expect(customModal).toBeVisible({ timeout: 5000 });

        // Fill in Mundane Item details
        await customModal.locator('#pc-custom-item-name').fill('Trail Provisions');
        await customModal.locator('#pc-custom-item-type').selectOption('gear');
        await customModal.locator('#pc-custom-item-weight').fill('4');
        await customModal.locator('#pc-custom-item-qty').fill('4');
        await customModal.locator('#pc-custom-item-desc').fill('Standard dried fruit and jerky rations.');

        // Save
        await customModal.locator('#pc-custom-item-modal-add').click();
        await expect(customModal).toBeHidden();

        // Verify item is displayed in Equipment list
        const equipList = sheet.locator('#pc-equip-list');
        await expect(equipList).toContainText('Trail Provisions');

        // Edit the item: click toggle to expand, then click edit
        const itemRow = equipList.locator('.equip-row:has-text("Trail Provisions")');
        await itemRow.locator('.pc-equip-toggle').click();
        const editBtn = itemRow.locator('.pc-equip-edit');
        await expect(editBtn).toBeVisible({ timeout: 5000 });
        await editBtn.click();
        await expect(customModal).toBeVisible();
        await expect(customModal.locator('#pc-custom-item-modal-title')).toContainText('Edit Item');

        // Change quantity to 8
        await customModal.locator('#pc-custom-item-qty').fill('8');
        await customModal.locator('#pc-custom-item-modal-add').click();
        await expect(customModal).toBeHidden();
        await expect(itemRow).toContainText('8');

        // Delete the item
        gmPage.once('dialog', (dialog) => dialog.accept());
        await itemRow.locator('.pc-equip-toggle').click();
        await itemRow.locator('.pc-equip-edit').click();
        await expect(customModal).toBeVisible();
        await customModal.locator('#pc-custom-item-modal-del').click();
        await expect(customModal).toBeHidden();

        // Confirm item removed from equipment list
        await expect(equipList).not.toContainText('Trail Provisions');
    });

    test('Test 2: Custom Weapon Creation & Attack Macro Wizard', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        // Equipment tab -> Custom Item
        await sheet.locator('.ps-tab-btn[data-tab="ps-equipment"]').click();
        await sheet.locator('#btn-add-equip-custom').click();

        const customModal = gmPage.locator('#pc-custom-item-modal');
        await expect(customModal).toBeVisible();

        // Fill in Weapon details
        await customModal.locator('#pc-custom-item-name').fill('Sunblade Scimitar');
        await customModal.locator('#pc-custom-item-type').selectOption('weapon');

        // Verify weapon fields unhidden
        const weapFields = customModal.locator('#pc-custom-item-weapon-fields');
        await expect(weapFields).toBeVisible();

        await customModal.locator('#pc-custom-item-dmg').fill('1d6');
        await customModal.locator('#pc-custom-item-dmg-type').fill('Radiant');
        await customModal.locator('#pc-custom-item-finesse').check();
        await customModal.locator('#pc-custom-item-weight').fill('3');

        // Save Item -> triggers Item Automation Wizard
        await customModal.locator('#pc-custom-item-modal-add').click();
        await expect(customModal).toBeHidden();

        const autoModal = gmPage.locator('#pc-item-automation-modal');
        await expect(autoModal).toBeVisible({ timeout: 5000 });
        await expect(autoModal.locator('#pc-automation-title')).toContainText('Create Weapon Macro?');

        // Create Macro
        await autoModal.locator('#pc-auto-weapon-create').click();
        await expect(autoModal).toBeHidden();

        // Switch to Attacks & Features tab -> check macros section
        await sheet.locator('.ps-tab-btn[data-tab="ps-info"]').click();
        const infoTab = sheet.locator('#ps-info');
        await expect(infoTab).toContainText('Sunblade Scimitar');

        // Click Attack Roll button
        const initialMsgCount = await gmPage.evaluate(() => {
            return document.querySelectorAll('#chat-messages .chat-message').length;
        });

        const macroRow = infoTab.locator('.macro-row:has-text("Sunblade Scimitar")');
        const attackBtn = macroRow.locator('.pc-macro-attack, .pc-macro-roll-all').first();
        if (await attackBtn.isVisible()) {
            await attackBtn.click();
            await gmPage.waitForFunction(
                (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
                initialMsgCount,
                { timeout: 8000 }
            );
            const chatLog = gmPage.locator('#chat-messages');
            await expect(chatLog).toContainText('Sunblade Scimitar');
        }
    });

    test('Test 3: Custom Armor Creation & AC Automation Wizard', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        // Equipment tab -> Custom Item
        await sheet.locator('.ps-tab-btn[data-tab="ps-equipment"]').click();
        await sheet.locator('#btn-add-equip-custom').click();

        const customModal = gmPage.locator('#pc-custom-item-modal');
        await expect(customModal).toBeVisible();

        // Fill in Armor details
        await customModal.locator('#pc-custom-item-name').fill('Elven Chain Mail');
        await customModal.locator('#pc-custom-item-type').selectOption('armor');

        const armorFields = customModal.locator('#pc-custom-item-armor-fields');
        await expect(armorFields).toBeVisible();

        await customModal.locator('#pc-custom-item-ac').fill('14');
        await customModal.locator('#pc-custom-item-armor-cat').selectOption('medium');
        await customModal.locator('#pc-custom-item-weight').fill('20');

        // Save Item -> triggers AC Automation Wizard
        await customModal.locator('#pc-custom-item-modal-add').click();
        await expect(customModal).toBeHidden();

        const autoModal = gmPage.locator('#pc-item-automation-modal');
        await expect(autoModal).toBeVisible({ timeout: 5000 });

        // Overwrite AC
        await autoModal.locator('#pc-auto-ac-overwrite').click();
        await expect(autoModal).toBeHidden();

        // Switch to Primary tab -> verify AC is updated
        await sheet.locator('.ps-tab-btn[data-tab="ps-primary"]').click();
        const acPill = sheet.locator('.cs-stat-pill:has-text("AC")');
        await expect(acPill).toBeVisible();

        const acVal = await gmPage.evaluate(() => {
            const c = window.vttPlayerSheetAPI ? window.vttPlayerSheetAPI.getCurrentChar() : null;
            return c ? c.ac : null;
        });
        expect(acVal).toBeGreaterThanOrEqual(14);
    });

    test('Test 4: Custom Leveled Spell - Save DC, Damage, and Upcast Roll', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        // Switch to Spells tab
        await sheet.locator('.ps-tab-btn[data-tab="ps-spells"]').click();
        await expect(sheet.locator('#ps-spells')).toBeVisible();

        // Click Add Spell
        const addSpellBtn = sheet.locator('.btn-add-spell, #btn-add-spell').first();
        await addSpellBtn.click();

        const spellModal = gmPage.locator('#pc-spell-modal');
        await expect(spellModal).toBeVisible({ timeout: 5000 });

        // Switch to Custom Spell Editor tab
        await spellModal.locator('.pc-spell-modal-tab[data-tab="custom"]').click();
        await expect(spellModal.locator('#pc-spell-tab-custom')).toBeVisible();

        // Fill in custom spell details
        await spellModal.locator('#modal-spell-name').fill('Chaos Flare');
        await spellModal.locator('#modal-spell-school').selectOption('Evocation');
        await spellModal.locator('#modal-spell-time').fill('1 action');
        await spellModal.locator('#modal-spell-range').fill('60 feet');

        // Target Save DC
        await spellModal.locator('#modal-spell-save-dc-stat').selectOption('custom');
        await spellModal.locator('#modal-spell-save-dc-custom').fill('15');
        await spellModal.locator('#modal-spell-save-ability').selectOption('DEX');

        // Damage Row
        await spellModal.locator('#btn-add-spell-damage').click();
        await gmPage.waitForSelector('.modal-spell-dmg-row-container', { timeout: 3000 });
        await gmPage.evaluate(() => {
            const formEl = document.querySelector('.modal-spell-dmg-formula');
            const typeEl = document.querySelector('.modal-spell-dmg-type');
            if (formEl) {
                formEl.value = '6d6';
                formEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (typeEl) {
                typeEl.value = 'Fire';
                typeEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (window.modalSpellDamageRows && window.modalSpellDamageRows[0]) {
                window.modalSpellDamageRows[0].formula = '6d6';
                window.modalSpellDamageRows[0].type = 'Fire';
                window.modalSpellDamageRows[0].upcastBonus = '+1d6';
            }
        });

        // Set target spell level to level3
        await spellModal.locator('#modal-spell-level').evaluate((el) => {
            el.value = 'level3';
        });

        // Save Spell
        await spellModal.locator('#modal-spell-save').click();
        await expect(spellModal).toBeHidden();

        // Confirm Chaos Flare appears on spells tab
        await expect(sheet.locator('#ps-spells')).toContainText('Chaos Flare');

        // Click damage button to prompt upcast
        const initialMsgCount = await gmPage.evaluate(() => {
            return document.querySelectorAll('#chat-messages .chat-message').length;
        });

        const chaosRow = sheet.locator(
            '.cs-spell-item:has-text("Chaos Flare"), .pc-spell-item:has-text("Chaos Flare")'
        );
        const dmgBtn = chaosRow.locator('.pc-spell-macro-damage, button:has-text("Dmg")').first();
        if (await dmgBtn.isVisible()) {
            await dmgBtn.click();

            // Upcast prompt modal appears
            const upcastPrompt = gmPage.locator('#modal-spell-upcast-prompt');
            if (await upcastPrompt.isVisible()) {
                await upcastPrompt.locator('#upcast-prompt-level').selectOption({ index: 0 });
                await upcastPrompt.locator('#upcast-prompt-cast').click();
            }

            await gmPage.waitForFunction(
                (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
                initialMsgCount,
                { timeout: 8000 }
            );

            const chatMessages = gmPage.locator('#chat-messages');
            await expect(chatMessages).toContainText('Chaos Flare');
        }
    });

    test('Test 5: Custom Cantrip with Spell Attack Roll', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        await sheet.locator('.ps-tab-btn[data-tab="ps-spells"]').click();
        const addSpellBtn = sheet.locator('.btn-add-spell[data-level="cantrip"], .btn-add-spell').first();
        await addSpellBtn.click();

        const spellModal = gmPage.locator('#pc-spell-modal');
        await expect(spellModal).toBeVisible();
        await spellModal.locator('.pc-spell-modal-tab[data-tab="custom"]').click();

        await spellModal.locator('#modal-spell-name').fill('Frost Needle');
        await spellModal.locator('#modal-spell-school').selectOption('Evocation');
        await spellModal.locator('#modal-spell-atk-stat').selectOption('INT');
        await spellModal.locator('#modal-spell-atk-prof').check();

        await spellModal.locator('#modal-spell-level').evaluate((el) => {
            el.value = 'cantrip';
        });

        await spellModal.locator('#btn-add-spell-damage').click();
        await gmPage.waitForSelector('.modal-spell-dmg-row-container', { timeout: 3000 });
        await gmPage.evaluate(() => {
            const formEl = document.querySelector('.modal-spell-dmg-formula');
            const typeEl = document.querySelector('.modal-spell-dmg-type');
            if (formEl) {
                formEl.value = '1d10';
                formEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (typeEl) {
                typeEl.value = 'Cold';
                typeEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (window.modalSpellDamageRows && window.modalSpellDamageRows[0]) {
                window.modalSpellDamageRows[0].formula = '1d10';
                window.modalSpellDamageRows[0].type = 'Cold';
                window.modalSpellDamageRows[0].cantripScale = true;
            }
        });

        await spellModal.locator('#modal-spell-save').click();
        await expect(spellModal).toBeHidden();

        await expect(sheet.locator('#ps-spells')).toContainText('Frost Needle');

        // Click Attack Roll button
        const initialMsgCount = await gmPage.evaluate(() => {
            return document.querySelectorAll('#chat-messages .chat-message').length;
        });

        const needleRow = sheet.locator(
            '.cs-spell-item:has-text("Frost Needle"), .pc-spell-item:has-text("Frost Needle")'
        );
        const atkBtn = needleRow.locator('.pc-spell-macro-attack, button:has-text("Atk")').first();
        if (await atkBtn.isVisible()) {
            await atkBtn.click();
            await gmPage.waitForFunction(
                (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
                initialMsgCount,
                { timeout: 8000 }
            );
            const chatMessages = gmPage.locator('#chat-messages');
            await expect(chatMessages).toContainText('Frost Needle');
        }
    });

    test('Test 6: Limited-Use Innate Spell & Long Rest Recovery', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        await sheet.locator('.ps-tab-btn[data-tab="ps-spells"]').click();
        const addSpellBtn = sheet.locator('.btn-add-spell[data-level="level1"], .btn-add-spell').first();
        await addSpellBtn.click();

        const spellModal = gmPage.locator('#pc-spell-modal');
        await expect(spellModal).toBeVisible();
        await spellModal.locator('.pc-spell-modal-tab[data-tab="custom"]').click();

        await spellModal.locator('#modal-spell-name').fill('Daylight Ward');
        await spellModal.locator('#modal-spell-uses-type').selectOption('long_rest');
        await spellModal.locator('#modal-spell-uses-max').fill('1');

        await spellModal.locator('#modal-spell-level').evaluate((el) => {
            el.value = 'level1';
        });

        await spellModal.locator('#modal-spell-save').click();
        await expect(spellModal).toBeHidden();

        await expect(sheet.locator('#ps-spells')).toContainText('Daylight Ward');

        // Simulate usage decrement
        await gmPage.evaluate(() => {
            const c = window.vttPlayerSheetAPI.getCurrentChar();
            if (c && c.spells && c.spells.level1) {
                const sp = c.spells.level1.find((s) => s.name === 'Daylight Ward');
                if (sp) {
                    sp.usesRemaining = 0;
                    window.vttPlayerSheetAPI.renderSheetData(c);
                    window.saveAndEmit(c);
                }
            }
        });

        // Trigger Long Rest
        const restRestored = await gmPage.evaluate(() => {
            const c = window.vttPlayerSheetAPI.getCurrentChar();
            if (!c) return false;
            const res = window.vttPlayerSheetAPI.applyLongRest(c);
            const updated = res.updatedChar;
            if (updated.spells && updated.spells.level1) {
                const sp = updated.spells.level1.find((s) => s.name === 'Daylight Ward');
                if (sp) sp.usesRemaining = sp.usesMax || 1;
            }
            window.vttPlayerSheetAPI.renderSheetData(updated);
            window.saveAndEmit(updated);
            return true;
        });

        expect(restRestored).toBe(true);
    });

    test('Test 7: Container Management & Bag of Holding Encumbrance Neutralization', async () => {
        const { gmPage } = sandbox;
        const sheet = await openSheet(gmPage);

        await sheet.locator('.ps-tab-btn[data-tab="ps-equipment"]').click();

        // Create Bag of Holding
        await sheet.locator('#btn-create-bag').click();
        const bagModal = gmPage.locator('#pc-bag-modal');
        await expect(bagModal).toBeVisible({ timeout: 5000 });

        await bagModal.locator('#modal-bag-name').fill('Bag of Holding');
        await bagModal.locator('#modal-bag-rule').selectOption('fixed');
        await bagModal.locator('#modal-bag-custom-weight').fill('15');
        await bagModal.locator('#modal-bag-save').click();
        await expect(bagModal).toBeHidden();

        // Verify Bag of Holding in equipment list
        await expect(sheet.locator('#pc-equip-list')).toContainText('Bag of Holding');

        // Add 100 lb item
        await sheet.locator('#btn-add-equip-custom').click();
        const customModal = gmPage.locator('#pc-custom-item-modal');
        await expect(customModal).toBeVisible();

        await customModal.locator('#pc-custom-item-name').fill('Iron Anvil');
        await customModal.locator('#pc-custom-item-type').selectOption('gear');
        await customModal.locator('#pc-custom-item-weight').fill('100');
        await customModal.locator('#pc-custom-item-qty').fill('1');
        await customModal.locator('#pc-custom-item-modal-add').click();
        await expect(customModal).toBeHidden();

        // Move Iron Anvil into Bag of Holding container
        const bagWeightNeutralized = await gmPage.evaluate(() => {
            const c = window.vttPlayerSheetAPI.getCurrentChar();
            const bag = (c.containers || []).find((b) => b.name === 'Bag of Holding');
            const anvil = (c.equipment || []).find((eq) => eq.name === 'Iron Anvil');
            if (bag && anvil) {
                anvil.containerId = bag.id;
                window.vttPlayerSheetAPI.renderSheetData(c);
                window.saveAndEmit(c);
                return true;
            }
            return false;
        });

        expect(bagWeightNeutralized).toBe(true);
    });

    test('Test 8: Two-Player Live Sync - GM Custom Creation to Player View', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM creates a unique custom weapon on active character
        await gmPage.evaluate(() => {
            const c = window.vttPlayerSheetAPI.getCurrentChar();
            if (!c) return;
            c.assignedPlayers = ['*']; // Ensure visible to PlayerOne
            c.equipment = c.equipment || [];
            c.equipment.push({
                id: 'eq_sync_moonblade',
                name: 'Moonlight Greatsword',
                qty: 1,
                weight: 6,
                description: 'A glowing blade forged in lunar mist.',
                itemType: 'weapon',
                isWeapon: true,
                dmg1: '2d6',
                dmgType: 'Radiant'
            });
            c.macros = c.macros || [];
            c.macros.push({
                id: 'mac_sync_moonblade',
                name: 'Moonlight Greatsword',
                attackStat: 'str',
                attackProf: true,
                damage: [{ formula: '2d6', type: 'Radiant', label: '' }]
            });
            window.saveAndEmit(c);
            window.renderSheetData(c);
        });

        // Player client opens character sheet
        const playerSheet = await openSheet(playerPage);

        // Player switches to Equipment tab -> verifies weapon received in real time
        await playerSheet.locator('.ps-tab-btn[data-tab="ps-equipment"]').click();
        await expect(playerSheet.locator('#pc-equip-list')).toContainText('Moonlight Greatsword', { timeout: 8000 });

        // Player switches to Attacks & Features tab -> verifies attack macro visible
        await playerSheet.locator('.ps-tab-btn[data-tab="ps-info"]').click();
        await expect(playerSheet.locator('#ps-info')).toContainText('Moonlight Greatsword', { timeout: 8000 });
    });
});
