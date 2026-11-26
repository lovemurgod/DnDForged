/**
 * test/visual/handouts-and-adventure-import.spec.mjs
 * Granular Playwright End-to-End Test Suite for Handouts, Player Sharing, and 5e Adventure/Book Importer.
 * Covers:
 *  1. Navigation to Handouts Tab & empty state
 *  2. Custom Handout creation with rich Markdown/HTML & folder categorization
 *  3. Media URL rendering matrix in View Modal (Image, YouTube iframe, MP4 video)
 *  4. Real-time two-player synchronization (Visibility toggle & GM "Force Show to Players")
 *  5. In-place handout editing and updating
 *  6. Folder tree grouping & collapse/expand toggles
 *  7. 5e Adventure Import Wizard matrix (LMoP, CoS, PHB), search filters & preview pane
 *  8. Batch module import execution & handout deletion
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupTwoPlayerSandbox, ensureSidebarTabOpen } from './helpers/visual-fixture.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..', '..');

function resetSandboxFixtures() {
    try {
        const campPath = path.resolve(rootDir, 'test', 'fixtures', 'visual-sandbox-data', 'campaigns.json');
        if (fs.existsSync(campPath)) {
            const campData = JSON.parse(fs.readFileSync(campPath, 'utf8'));
            const camp = campData.visual_test_campaign;
            if (camp) {
                camp.handouts = [];
            }
            fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
        }
    } catch {
        // Ignored in test environment
    }
}

test.describe('Handouts & 5e Adventure Import E2E Suite', () => {
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
        const { gmPage } = sandbox;
        await ensureSidebarTabOpen(gmPage, 'tab-handouts');
    });

    test('1. Tab Navigation & Initial Render', async () => {
        const { gmPage, playerPage } = sandbox;

        // Switch GM to Handouts tab
        const gmTabBtn = gmPage.locator('button.tab-header[data-tab="tab-handouts"]');
        await expect(gmTabBtn).toBeVisible({ timeout: 10000 });
        await ensureSidebarTabOpen(gmPage, 'tab-handouts');

        const gmPanel = gmPage.locator('#tab-handouts');
        await expect(gmPanel).toHaveClass(/active/);
        await expect(gmPage.locator('#handout-list')).toBeVisible();

        // GM has New and Import buttons
        await expect(gmPage.locator('#btn-handout-create')).toBeVisible();
        await expect(gmPage.locator('#btn-handout-import')).toBeVisible();

        // Switch Player to Handouts tab
        const playerTabBtn = playerPage.locator('button.tab-header[data-tab="tab-handouts"]');
        await expect(playerTabBtn).toBeVisible();
        await playerTabBtn.click();

        const playerPanel = playerPage.locator('#tab-handouts');
        await expect(playerPanel).toHaveClass(/active/);

        // Player does NOT have GM-only New or Import buttons
        await expect(playerPage.locator('#btn-handout-create')).not.toBeVisible();
        await expect(playerPage.locator('#btn-handout-import')).not.toBeVisible();
    });

    test('2. Custom Handout Creation & Folder Grouping', async () => {
        const { gmPage } = sandbox;

        // Click New Handout button
        await gmPage.locator('#btn-handout-create').click();

        const modal = gmPage.locator('#modal-edit-handout');
        await expect(modal).not.toHaveClass(/vtt-hidden/);

        // Fill form fields
        await gmPage.fill('#edit-handout-name', 'Secret Letter from Gundren');
        await gmPage.fill(
            '#edit-handout-desc',
            'Meet me at the Stonehill Inn in Phandalin. Bring the wagon of mining supplies.'
        );
        await gmPage.fill('#edit-handout-url', 'https://example.com/assets/gundren_letter.png');
        await gmPage.fill('#edit-handout-folder', 'Quests');

        // Save
        await gmPage.locator('#btn-handout-save').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        // Verify folder header and card in GM list
        const folderHeader = gmPage.locator('.handout-folder-header', { hasText: 'Quests' });
        await expect(folderHeader).toBeVisible({ timeout: 5000 });

        const card = gmPage.locator('#handout-list .character-card', { hasText: 'Secret Letter from Gundren' });
        await expect(card).toBeVisible();
    });

    test('3. Media Parser Matrix in View Modal (Image, YouTube, Video)', async () => {
        const { gmPage } = sandbox;

        // 1. View the Image Handout
        const imageCard = gmPage.locator('#handout-list .character-card', { hasText: 'Secret Letter from Gundren' });
        await imageCard.click();

        const viewModal = gmPage.locator('#modal-view-handout');
        await expect(viewModal).not.toHaveClass(/vtt-hidden/);
        await expect(gmPage.locator('#view-handout-title')).toHaveText('Secret Letter from Gundren');

        const mediaImg = gmPage.locator('#view-handout-media-container img');
        await expect(mediaImg).toBeVisible();
        await expect(mediaImg).toHaveAttribute('src', 'https://example.com/assets/gundren_letter.png');

        await gmPage.locator('#btn-view-handout-close').click();
        await expect(viewModal).toHaveClass(/vtt-hidden/);

        // 2. Create and View YouTube Handout
        await gmPage.locator('#btn-handout-create').click();
        await gmPage.fill('#edit-handout-name', 'Neverwinter Cinematic Trailer');
        await gmPage.fill('#edit-handout-url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        await gmPage.fill('#edit-handout-folder', 'Cinematics');
        await gmPage.locator('#btn-handout-save').click();

        const ytCard = gmPage.locator('#handout-list .character-card', { hasText: 'Neverwinter Cinematic Trailer' });
        await expect(ytCard).toBeVisible();
        await ytCard.click();

        await expect(viewModal).not.toHaveClass(/vtt-hidden/);
        const ytIframe = gmPage.locator('#view-handout-media-container iframe');
        await expect(ytIframe).toBeVisible();
        await expect(ytIframe).toHaveAttribute('src', /youtube\.com\/embed\/dQw4w9WgXcQ/);

        await gmPage.locator('#btn-view-handout-close').click();
        await expect(viewModal).toHaveClass(/vtt-hidden/);

        // 3. Create and View MP4 Video Handout
        await gmPage.locator('#btn-handout-create').click();
        await gmPage.fill('#edit-handout-name', 'Tavern Ambience Video');
        await gmPage.fill('#edit-handout-url', 'https://example.com/assets/fireplace.mp4');
        await gmPage.fill('#edit-handout-folder', 'Cinematics');
        await gmPage.locator('#btn-handout-save').click();

        const vidCard = gmPage.locator('#handout-list .character-card', { hasText: 'Tavern Ambience Video' });
        await expect(vidCard).toBeVisible();
        await vidCard.click();

        await expect(viewModal).not.toHaveClass(/vtt-hidden/);
        const vidElem = gmPage.locator('#view-handout-media-container video');
        await expect(vidElem).toBeVisible();
        await expect(vidElem).toHaveAttribute('src', 'https://example.com/assets/fireplace.mp4');

        await gmPage.locator('#btn-view-handout-close').click();
        await expect(viewModal).toHaveClass(/vtt-hidden/);
    });

    test('4. Two-Player Live Sync — Visibility & Force Show to Players', async () => {
        const { gmPage, playerPage } = sandbox;

        const playerList = playerPage.locator('#handout-list');
        const gundrenLetterPlayer = playerList.locator('.character-card', { hasText: 'Secret Letter from Gundren' });

        // Initially hidden from player
        await expect(gundrenLetterPlayer).not.toBeVisible();

        // GM clicks visibility toggle button on Gundren card
        const gundrenCardGM = gmPage.locator('#handout-list .character-card', {
            hasText: 'Secret Letter from Gundren'
        });
        const btnVisibility = gundrenCardGM.locator('button[title*="Show to Players"]');
        await btnVisibility.click();

        // Player receives update: Gundren letter is now visible in Player's list
        await expect(gundrenLetterPlayer).toBeVisible({ timeout: 5000 });

        // Switch Player to Chat tab
        await playerPage.locator('button.tab-header[data-tab="tab-chat"]').click();
        await expect(playerPage.locator('#tab-chat')).toHaveClass(/active/);

        // GM clicks Force Show (Bullhorn button)
        const btnForceShow = gundrenCardGM.locator('button[title*="Force"]');
        await btnForceShow.click();

        // Player client automatically switches back to tab-handouts AND pops view modal!
        const playerViewModal = playerPage.locator('#modal-view-handout');
        await expect(playerViewModal).not.toHaveClass(/vtt-hidden/, { timeout: 6000 });
        await expect(playerPage.locator('#view-handout-title')).toHaveText('Secret Letter from Gundren');
        await expect(playerPage.locator('#view-handout-desc')).toContainText(
            'Meet me at the Stonehill Inn in Phandalin.'
        );

        // Player closes the modal
        await playerPage.locator('#btn-view-handout-close').click();
        await expect(playerViewModal).toHaveClass(/vtt-hidden/);

        // Close GM view modal if force-show broadcast opened it on GM client too
        const gmViewModal = gmPage.locator('#modal-view-handout');
        if (await gmViewModal.evaluate((el) => !el.classList.contains('vtt-hidden'))) {
            await gmPage.locator('#btn-view-handout-close').click();
            await expect(gmViewModal).toHaveClass(/vtt-hidden/);
        }
    });

    test('5. In-Place Handout Editing & Updating', async () => {
        const { gmPage } = sandbox;

        const gundrenCard = gmPage.locator('#handout-list .character-card', { hasText: 'Secret Letter from Gundren' });
        const btnEdit = gundrenCard.locator('button[title*="Edit"]');
        await btnEdit.click();

        const modal = gmPage.locator('#modal-edit-handout');
        await expect(modal).not.toHaveClass(/vtt-hidden/);
        await expect(gmPage.locator('#edit-handout-name')).toHaveValue('Secret Letter from Gundren');

        // Update title and desc
        await gmPage.fill('#edit-handout-name', 'Secret Letter from Gundren (Decoded)');
        await gmPage.fill('#edit-handout-desc', 'Decoded: The Black Spider has taken the mine.');
        await gmPage.locator('#btn-handout-save').click();
        await expect(modal).toHaveClass(/vtt-hidden/);

        // Assert updated card exists and old one is replaced (no duplicate)
        const updatedCard = gmPage.locator('#handout-list .character-card', {
            hasText: 'Secret Letter from Gundren (Decoded)'
        });
        await expect(updatedCard).toBeVisible({ timeout: 5000 });
        await expect(
            gmPage.locator('#handout-list .character-card', { hasText: 'Secret Letter from Gundren' })
        ).toHaveCount(1);
    });

    test('6. Folder Hierarchies & Collapse/Expand Toggles', async () => {
        const { gmPage } = sandbox;

        // Locate Quests folder group
        const questsFolderGroup = gmPage.locator('.handout-folder-group', { hasText: 'Quests' });
        await expect(questsFolderGroup).toBeVisible();
        await expect(questsFolderGroup).not.toHaveClass(/collapsed/);

        // Click folder header to collapse
        const questsHeader = questsFolderGroup.locator('.handout-folder-header');
        await questsHeader.click();
        await expect(questsFolderGroup).toHaveClass(/collapsed/);

        // Child card is now hidden
        const childCard = questsFolderGroup.locator('.character-card', { hasText: 'Secret Letter from Gundren' });
        await expect(childCard).not.toBeVisible();

        // Click again to expand
        await questsHeader.click();
        await expect(questsFolderGroup).not.toHaveClass(/collapsed/);
        await expect(childCard).toBeVisible();
    });

    test('7. 5e Adventure Import Wizard Matrix (LMoP, CoS, PHB)', async () => {
        const { gmPage } = sandbox;

        // Open Import Wizard
        await gmPage.locator('#btn-handout-import').click();

        const modalImport = gmPage.locator('#modal-import-handout');
        await expect(modalImport).not.toHaveClass(/vtt-hidden/, { timeout: 5000 });

        // 1. Source selector tabs
        const tabAdv = gmPage.locator('#btn-source-tab-adventures');
        const tabBooks = gmPage.locator('#btn-source-tab-books');
        await expect(tabAdv).toHaveClass(/active/);

        // Search Adventures
        await gmPage.fill('#import-source-search', 'Phandelver');
        const lmopCard = gmPage.locator('.import-source-card', { hasText: 'Lost Mine of Phandelver' });
        await expect(lmopCard).toBeVisible({ timeout: 5000 });

        // Switch to Books tab
        await tabBooks.click();
        await expect(tabBooks).toHaveClass(/active/);
        await gmPage.fill('#import-source-search', 'Player');
        const phbCard = gmPage.locator('.import-source-card', { hasText: "Player's Handbook" }).first();
        await expect(phbCard).toBeVisible({ timeout: 5000 });

        // Switch back to Adventures and search Strahd
        await tabAdv.click();
        await gmPage.fill('#import-source-search', 'Strahd');
        const cosCard = gmPage.locator('.import-source-card', { hasText: 'Curse of Strahd' });
        await expect(cosCard).toBeVisible({ timeout: 5000 });

        // Select Lost Mine of Phandelver
        await gmPage.fill('#import-source-search', 'Phandelver');
        await lmopCard.click();

        // Verify active source badge updates
        await expect(gmPage.locator('#import-active-source-badge')).toHaveText('Lost Mine of Phandelver');

        // Verify item tree populates
        const itemTree = gmPage.locator('#import-item-tree');
        await expect(itemTree.locator('.import-item-row')).not.toHaveCount(0, { timeout: 10000 });

        // Test Filter Bar: click Story filter
        const btnFilterStory = gmPage.locator('.import-filter-btn[data-filter="story"]');
        await btnFilterStory.click();
        await expect(btnFilterStory).toHaveClass(/active/);

        // Search within items
        await gmPage.fill('#import-item-search', 'Introduction');
        const introItem = itemTree.locator('.import-item-row', { hasText: 'Introduction' }).first();
        await expect(introItem).toBeVisible();

        // Click item to trigger Live Preview pane
        await introItem.click();

        // Verify live preview title and container render
        await expect(gmPage.locator('#import-preview-title')).toContainText('Introduction');
        const previewContainer = gmPage.locator('#import-preview-container');
        await expect(previewContainer).toContainText('Dungeon Master');

        // Toggle selection from preview pane
        const btnToggleSelect = gmPage.locator('#btn-import-preview-toggle-select');
        await expect(btnToggleSelect).toBeVisible();
        await btnToggleSelect.click();

        // Verify selection count updated
        const countSpan = gmPage.locator('#import-selected-count');
        const countVal = await countSpan.textContent();
        expect(parseInt(countVal || '0', 10)).toBeGreaterThan(0);

        // Close modal
        await gmPage.locator('#btn-import-handout-close').click();
        await expect(modalImport).toHaveClass(/vtt-hidden/);
    });

    test('8. Batch Module Import Execution & Handout Card Deletion', async () => {
        const { gmPage } = sandbox;

        // Open Import Wizard fresh
        await gmPage.locator('#btn-handout-import').click();
        const modalImport = gmPage.locator('#modal-import-handout');
        await expect(modalImport).not.toHaveClass(/vtt-hidden/, { timeout: 5000 });

        // Select LMoP
        await gmPage.fill('#import-source-search', 'Phandelver');
        const lmopCard = gmPage.locator('.import-source-card', { hasText: 'Lost Mine of Phandelver' });
        await lmopCard.click();

        // Select All visible items
        const itemTree = gmPage.locator('#import-item-tree');
        await expect(itemTree.locator('.import-item-row')).not.toHaveCount(0, { timeout: 10000 });
        await gmPage.locator('#btn-import-select-all').click();

        const countSpan = gmPage.locator('#import-selected-count');
        const countVal = await countSpan.textContent();
        expect(parseInt(countVal || '0', 10)).toBeGreaterThan(0);

        // Click Import Selected
        const btnConfirm = gmPage.locator('#btn-import-handout-confirm');
        await expect(btnConfirm).not.toBeDisabled();
        await btnConfirm.click();

        // Modal should close
        await expect(modalImport).toHaveClass(/vtt-hidden/, { timeout: 5000 });

        // Handout list should now contain "Lost Mine of Phandelver" folder
        const lmopFolder = gmPage.locator('.handout-folder-group', { hasText: 'Lost Mine of Phandelver' });
        await expect(lmopFolder).toBeVisible({ timeout: 5000 });

        // Verify imported items render inside the folder
        const importedCard = lmopFolder.locator('.character-card').first();
        await expect(importedCard).toBeVisible();

        // Test deleting a custom handout card
        // Accept the confirm dialog
        gmPage.once('dialog', async (dialog) => {
            await dialog.accept();
        });

        const customCard = gmPage.locator('#handout-list .character-card', {
            hasText: 'Secret Letter from Gundren (Decoded)'
        });
        const btnDelete = customCard.locator('button[title*="Delete"]');
        await btnDelete.click();

        // Verify it was removed
        await expect(
            gmPage.locator('#handout-list .character-card', { hasText: 'Secret Letter from Gundren (Decoded)' })
        ).toHaveCount(0);
    });
});
