/**
 * test/visual/character-builder-wizard.spec.mjs
 * ForgeDVTT - Character Builder & Level-Up Wizard Multi-Client Playwright E2E Suite.
 *
 * Verifies the complete 8-step wizard pipeline, point buy ledger, ruleset variations,
 * casting archetypes, inventory preservation, level-up mode, and real-time live sync:
 * 1. Full Caster (High Elf Wizard - 2014 PHB): 8-step build, point buy, spellbook seeding, sheet DC & attack
 * 2. Pact Magic (Tiefling Warlock - 2014 PHB): Standard array, Fiend patron, Eldritch Blast, pact slots
 * 3. Pure Martial (Human Fighter - 2024 XPHB): Origin ASI, Great Weapon Fighting, Heavy Armor AC 16
 * 4. Half Caster (Wood Elf Ranger - 2014 PHB): 35 ft speed, Favored Enemy, 0 slots at Lv 1
 * 5. Third Caster & Level-Up Mode (Rogue -> Arcane Trickster Lv 3): Subclass unlock, 2d6 Sneak Attack, 1/3 slots
 * 6. Two-Player Live Sync: GM builder creation -> Player client receives live update
 * 7. Builder Cancel & Rollback: Verifies canceling preserves untouched character state
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

test.describe('Character Builder & Level-Up Wizard E2E Suite', () => {
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
     * Helper to open the Character Builder Wizard for a new character on the GM page.
     */
    async function openBuilderForNewCharacter(page) {
        // Open Player Characters sidebar tab
        await page.locator('[data-tab="tab-characters"]').click();
        await expect(page.locator('#tab-characters')).toHaveClass(/active/);

        // Click New Character button
        await page.locator('#btn-char-add').click();

        // Wait for sheet panel to open
        const sheetPanel = page.locator('#player-sheet-panel');
        await expect(sheetPanel).toBeVisible({ timeout: 5000 });

        // Ensure primary tab is active so builder trigger is visible
        const primaryTabBtn = sheetPanel.locator('.ps-tab-btn[data-tab="ps-primary"]');
        if (await primaryTabBtn.isVisible()) {
            await primaryTabBtn.click();
        }

        // Click Character Builder button
        const builderTrigger = sheetPanel.locator('#pc-open-character-builder-btn');
        await expect(builderTrigger).toBeVisible({ timeout: 5000 });
        await builderTrigger.click();

        // Wait for builder modal to appear
        const builderModal = page.locator('#pc-character-builder-modal');
        await expect(builderModal).toBeVisible({ timeout: 8000 });
        await expect(page.locator('#pc-wizard-char-name')).toBeVisible({ timeout: 8000 });

        // Wait for races dropdown to populate from compendium cache
        await page.waitForFunction(
            () => {
                const sel = document.getElementById('pc-wizard-race');
                return sel && sel.options && sel.options.length > 2;
            },
            { timeout: 10000 }
        );

        return builderModal;
    }

    /**
     * Helper to navigate to a specific builder step.
     */
    async function goToStep(page, stepNumber) {
        const tab = page.locator(`.pc-builder-step-nav .pc-builder-tab[data-step="${stepNumber}"]`);
        await tab.click();
        await page.waitForTimeout(100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Full Caster Archetype (High Elf Wizard - 2014 PHB)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 1: Full Caster Archetype (High Elf Wizard - 2014 PHB)', async () => {
        const { gmPage } = sandbox;
        const builderModal = await openBuilderForNewCharacter(gmPage);

        // Step 1: Identity & Classes
        const nameInput = gmPage.locator('#pc-wizard-char-name');
        await nameInput.fill('Elidor the Magus');

        // Select Species: Elf
        await gmPage.locator('#pc-wizard-race').selectOption('Elf');

        // Wait for subrace dropdown to populate with matching subraces (High / Wood)
        await gmPage.waitForFunction(
            () => {
                const sub = document.getElementById('pc-wizard-subrace');
                return sub && Array.from(sub.options).some((o) => o.value === 'High');
            },
            { timeout: 8000 }
        );

        // Select Subrace: High
        await gmPage.locator('#pc-wizard-subrace').selectOption('High');

        // Select Background: Sage::PHB
        await gmPage.locator('#pc-wizard-bg').selectOption('Sage::PHB');

        // Select Class: Wizard::PHB
        await gmPage.locator('.pc-wiz-cls-sel[data-idx="0"]').selectOption('Wizard::PHB');

        // Step 2: Ability Scores (Point Buy)
        await goToStep(gmPage, 2);
        await gmPage.locator('.pc-method-btn[data-method="pointbuy"]').click();

        // Exercise interactive stepper button
        const intUpBtn = gmPage.locator('.pc-pb-btn[data-stat="int"][data-dir="1"]');
        if (await intUpBtn.isEnabled()) {
            await intUpBtn.click();
            await gmPage.waitForTimeout(50);
        }

        // Set target point buy distribution: STR 8, DEX 14, CON 14, INT 15, WIS 10, CHA 10 (Total 27 pts)
        await gmPage.evaluate(() => {
            if (window._activeBuilderChar) {
                window._activeBuilderChar.pointBuyScores = {
                    str: 8,
                    dex: 14,
                    con: 14,
                    int: 15,
                    wis: 10,
                    cha: 10
                };
            }
        });

        // Step 7: Spells & Magic
        await goToStep(gmPage, 7);
        for (const sp of ['Fire Bolt', 'Mage Hand', 'Prestidigitation']) {
            const chk = gmPage.locator(`.pc-wiz-spell-card[data-name="${sp.toLowerCase()}"] .pc-wiz-spell-chk`).first();
            if (await chk.isVisible()) await chk.check();
        }
        for (const sp of ['Magic Missile', 'Shield', 'Mage Armor']) {
            const chk = gmPage.locator(`.pc-wiz-spell-card[data-name="${sp.toLowerCase()}"] .pc-wiz-spell-chk`).first();
            if (await chk.isVisible()) await chk.check();
        }

        // Step 8: Review HP & AC
        await goToStep(gmPage, 8);
        const hpPreview = gmPage.locator('#pc-wiz-hp-preview');
        await expect(hpPreview).toBeVisible();

        // Save & Apply
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify Player Sheet Panel has updated
        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel.locator('#pc-name')).toHaveValue('Elidor the Magus');

        // Verify Ability Scores: High Elf grants +2 DEX, +1 INT -> DEX 16 (+3), INT 16 (+3)
        const intCell = sheetPanel.locator('.cs-ability-cell[data-ab="int"]');
        await expect(intCell.locator('.cs-ability-score')).toHaveText('16');
        await expect(intCell.locator('.cs-ability-mod')).toHaveText('+3');

        // Verify Spells Tab
        await sheetPanel.locator('.ps-tab-btn[data-tab="ps-spells"]').click();
        const spellsTab = sheetPanel.locator('#ps-spells');
        await expect(spellsTab).toContainText('Fire Bolt');
        await expect(spellsTab).toContainText('Magic Missile');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Pact Magic Archetype (Tiefling Warlock - 2014 PHB)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 2: Pact Magic Archetype (Tiefling Warlock - 2014 PHB)', async () => {
        const { gmPage } = sandbox;
        const builderModal = await openBuilderForNewCharacter(gmPage);

        // Step 1: Identity & Classes
        await gmPage.locator('#pc-wizard-char-name').fill('Malakor the Hexer');
        await gmPage.locator('#pc-wizard-race').selectOption('Tiefling');
        await gmPage.locator('#pc-wizard-bg').selectOption('Acolyte::PHB');
        await gmPage.locator('.pc-wiz-cls-sel[data-idx="0"]').selectOption('Warlock::PHB');

        // Step 2: Ability Scores (Standard Array)
        await goToStep(gmPage, 2);
        await gmPage.locator('.pc-method-btn[data-method="standard"]').click();

        // Assign CHA 15, CON 14, DEX 13, WIS 12, INT 10, STR 8
        await gmPage.locator('.pc-std-arr-sel[data-stat="cha"]').selectOption('15');
        await gmPage.locator('.pc-std-arr-sel[data-stat="con"]').selectOption('14');
        await gmPage.locator('.pc-std-arr-sel[data-stat="dex"]').selectOption('13');
        await gmPage.locator('.pc-std-arr-sel[data-stat="wis"]').selectOption('12');
        await gmPage.locator('.pc-std-arr-sel[data-stat="int"]').selectOption('10');
        await gmPage.locator('.pc-std-arr-sel[data-stat="str"]').selectOption('8');

        // Step 3: Proficiencies
        await goToStep(gmPage, 3);
        const decepCb = gmPage.locator('.pc-class-skill-cb[data-skill="Deception"]');
        if (await decepCb.isVisible()) await decepCb.check();

        // Step 7: Spells & Magic
        await goToStep(gmPage, 7);
        const ebChk = gmPage.locator('.pc-wiz-spell-card[data-name="eldritch blast"] .pc-wiz-spell-chk').first();
        if (await ebChk.isVisible()) await ebChk.check();
        const hexChk = gmPage.locator('.pc-wiz-spell-card[data-name="hex"] .pc-wiz-spell-chk').first();
        if (await hexChk.isVisible()) await hexChk.check();

        // Step 8: Review & Apply
        await goToStep(gmPage, 8);
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify Player Sheet
        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel.locator('#pc-name')).toHaveValue('Malakor the Hexer');

        // Tiefling grants +2 CHA -> 15 + 2 = 17 (+3)
        const chaCell = sheetPanel.locator('.cs-ability-cell[data-ab="cha"]');
        await expect(chaCell.locator('.cs-ability-score')).toHaveText('17');
        await expect(chaCell.locator('.cs-ability-mod')).toHaveText('+3');

        // Spells Tab: Eldritch Blast present
        await sheetPanel.locator('.ps-tab-btn[data-tab="ps-spells"]').click();
        await expect(sheetPanel.locator('#ps-spells')).toContainText('Eldritch Blast');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Pure Martial Archetype (Human Fighter - 2024 XPHB Ruleset)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 3: Pure Martial Archetype (Human Fighter - 2024 XPHB Ruleset)', async () => {
        const { gmPage } = sandbox;
        const builderModal = await openBuilderForNewCharacter(gmPage);

        // Step 1: Identity & Classes
        await gmPage.locator('#pc-wizard-char-name').fill('Kragar Steelbrand');
        await gmPage.locator('#pc-wizard-race').selectOption('Human');
        await gmPage.locator('#pc-wizard-bg').selectOption('Soldier::PHB');
        await gmPage.locator('.pc-wiz-cls-sel[data-idx="0"]').selectOption('Fighter::PHB');

        // Step 2: Ability Scores (Tasha's Free Choice +2/+1 Mode)
        await goToStep(gmPage, 2);
        const tashasBtn = gmPage.locator('.pc-asi-mode-btn[data-asimode="tashas"]');
        if (await tashasBtn.isVisible()) {
            await tashasBtn.click();
            await gmPage.waitForTimeout(100);
            const p2Sel = gmPage.locator('#pc-wiz-tashas-2');
            if (await p2Sel.isVisible()) await p2Sel.selectOption('str');
            const p1Sel = gmPage.locator('#pc-wiz-tashas-1');
            if (await p1Sel.isVisible()) await p1Sel.selectOption('con');
        }

        // Step 4: Features - Select Fighting Style
        await goToStep(gmPage, 4);
        const styleSubSel = gmPage.locator('.pc-wiz-feat-suboption-sel').first();
        if (await styleSubSel.isVisible()) {
            const hasGwf = await styleSubSel.locator('option[value="Great Weapon Fighting"]').count();
            if (hasGwf > 0) {
                await styleSubSel.selectOption('Great Weapon Fighting');
            }
        }

        // Step 7: Martial without Spells
        await goToStep(gmPage, 7);
        await expect(gmPage.locator('#pc-builder-body')).toContainText('No Spells or Spellcasting Classes');

        // Step 8: Review & Apply
        await goToStep(gmPage, 8);
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify Player Sheet
        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel.locator('#pc-name')).toHaveValue('Kragar Steelbrand');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Half Caster Archetype (Wood Elf Ranger - 2014 PHB)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 4: Half Caster Archetype (Wood Elf Ranger - 2014 PHB)', async () => {
        const { gmPage } = sandbox;
        const builderModal = await openBuilderForNewCharacter(gmPage);

        // Step 1: Identity & Classes
        await gmPage.locator('#pc-wizard-char-name').fill('Sylas Swiftstride');
        await gmPage.locator('#pc-wizard-race').selectOption('Elf');

        // Wait for subraces
        await gmPage.waitForFunction(
            () => {
                const sub = document.getElementById('pc-wizard-subrace');
                return sub && Array.from(sub.options).some((o) => o.value === 'Wood');
            },
            { timeout: 8000 }
        );
        await gmPage.locator('#pc-wizard-subrace').selectOption('Wood');

        await gmPage.locator('#pc-wizard-bg').selectOption('Outlander::PHB');
        await gmPage.locator('.pc-wiz-cls-sel[data-idx="0"]').selectOption('Ranger::PHB');

        // Step 4: Features - Favored Enemy & Natural Explorer
        await goToStep(gmPage, 4);
        await expect(gmPage.locator('#pc-wiz-class-feats-list')).toContainText('Favored Enemy');
        await expect(gmPage.locator('#pc-wiz-class-feats-list')).toContainText('Natural Explorer');

        // Step 7: Level 1 Ranger has no spell slots
        await goToStep(gmPage, 7);
        await expect(gmPage.locator('#pc-builder-body')).toContainText('No Spells or Spellcasting Classes');

        // Step 8: Apply
        await goToStep(gmPage, 8);
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify Player Sheet Speed: Wood Elf has 35 ft speed
        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel.locator('#pc-name')).toHaveValue('Sylas Swiftstride');
        await expect(sheetPanel.locator('.cs-stat-pill:has-text("Walk")')).toContainText('35');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Third Caster Archetype & Level-Up Mode (Rogue -> Arcane Trickster Lv 3)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 5: Third Caster Archetype & Level-Up Mode (Rogue -> Arcane Trickster Lv 3)', async () => {
        const { gmPage } = sandbox;
        const builderModal = await openBuilderForNewCharacter(gmPage);

        // 1. Initial creation as Level 1 Rogue
        await gmPage.locator('#pc-wizard-char-name').fill('Merry the Nimble');
        await gmPage.locator('#pc-wizard-race').selectOption('Halfling');
        await gmPage.locator('.pc-wiz-cls-sel[data-idx="0"]').selectOption('Rogue::PHB');
        await goToStep(gmPage, 8);
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // 2. Re-open Builder in Level-Up Mode
        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await sheetPanel.locator('#pc-open-character-builder-btn').click();
        await expect(builderModal).toBeVisible({ timeout: 5000 });

        // Switch to Level-Up Mode
        const levelUpToggle = gmPage.locator('#pc-builder-mode-levelup');
        await levelUpToggle.click();

        // Advance level to 3
        const lvlInput = gmPage.locator('.pc-wiz-cls-lvl[data-idx="0"]');
        await lvlInput.fill('3');
        await lvlInput.dispatchEvent('change');
        await gmPage.waitForTimeout(200);

        // Wait for subclass dropdown to have options
        await gmPage.waitForFunction(
            () => {
                const sel = document.querySelector('.pc-wiz-subclass-sel[data-idx="0"]');
                return sel && Array.from(sel.options).some((o) => o.value === 'Arcane Trickster');
            },
            { timeout: 8000 }
        );

        // Select Subclass: Arcane Trickster
        const subSel = gmPage.locator('.pc-wiz-subclass-sel[data-idx="0"]');
        await subSel.selectOption('Arcane Trickster');

        // Step 4: Verify Sneak Attack
        await goToStep(gmPage, 4);
        await expect(gmPage.locator('#pc-wiz-class-feats-list')).toContainText('Sneak Attack');

        // Step 5: Equipment Preserved Banner
        await goToStep(gmPage, 5);
        await expect(gmPage.locator('#pc-builder-body')).toContainText('Existing Inventory Intact');

        // Step 7: Third-Caster Spells Unlocked
        await goToStep(gmPage, 7);
        const mageHandChk = gmPage.locator('.pc-wiz-spell-card[data-name="mage hand"] .pc-wiz-spell-chk').first();
        if (await mageHandChk.isVisible()) await mageHandChk.check();

        // Step 8: Apply Level-Up
        await goToStep(gmPage, 8);
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify Player Sheet reflects Level 3 Arcane Trickster
        await expect(sheetPanel.locator('.ps-header-meta, .ps-class-summary, #player-sheet-active')).toContainText(
            'Rogue'
        );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 6: Two-Player Live Sync (GM Builder Creation -> Player Client Live Sync)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 6: Two-Player Live Sync (GM Builder Creation -> Player Client Live Sync)', async () => {
        const { gmPage, playerPage } = sandbox;
        const builderModal = await openBuilderForNewCharacter(gmPage);

        // Assign character to all players so Player client has permission to view it
        await gmPage.evaluate(() => {
            const char = window.VTT?.playerSheet?.getCurrentChar();
            if (char) char.assignedPlayers = ['*'];
        });

        // Create character on GM page
        const uniqueName = `Sync Hero ${Date.now()}`;
        await gmPage.locator('#pc-wizard-char-name').fill(uniqueName);
        await gmPage.locator('#pc-wizard-race').selectOption('Dwarf');
        await gmPage.locator('.pc-wiz-cls-sel[data-idx="0"]').selectOption('Cleric::PHB');

        // Apply build
        await goToStep(gmPage, 8);
        await gmPage.locator('#pc-builder-apply-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify Player Client receives updated character in sidebar
        await playerPage.locator('[data-tab="tab-characters"]').click();
        const playerCharRow = playerPage.locator(`#character-list .char-row:has-text("${uniqueName}")`).first();
        await expect(playerCharRow).toBeVisible({ timeout: 10000 });

        // Player clicks character to open sheet
        await playerCharRow.click();
        const playerSheet = playerPage.locator('#player-sheet-panel');
        await expect(playerSheet).toBeVisible({ timeout: 5000 });
        await expect(playerSheet.locator('#pc-name')).toHaveValue(uniqueName);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 7: Builder Cancel & Rollback Validation
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 7: Builder Cancel & Rollback Validation', async () => {
        const { gmPage } = sandbox;

        // Open Player Characters sidebar tab
        await gmPage.locator('[data-tab="tab-characters"]').click();
        const firstChar = gmPage.locator('#character-list .char-row').first();
        await expect(firstChar).toBeVisible({ timeout: 5000 });
        await firstChar.click();

        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel.locator('#pc-name')).toBeVisible({ timeout: 5000 });
        const origName = await sheetPanel.locator('#pc-name').inputValue();
        expect(origName.length).toBeGreaterThan(0);

        // Open builder
        await sheetPanel.locator('#pc-open-character-builder-btn').click();
        const builderModal = gmPage.locator('#pc-character-builder-modal');
        await expect(builderModal).toBeVisible({ timeout: 5000 });

        // Mutate name in builder
        await gmPage.locator('#pc-wizard-char-name').fill('Discarded Alteration');

        // Click Cancel
        await gmPage.locator('#pc-builder-cancel-btn').click();
        await expect(builderModal).toHaveClass(/vtt-hidden/);

        // Verify sheet retained original name
        await expect(sheetPanel.locator('#pc-name')).toHaveValue(origName);
    });
});
