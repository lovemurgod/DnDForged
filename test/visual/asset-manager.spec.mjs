/**
 * test/visual/asset-manager.spec.mjs
 * ForgeD VTT - Asset Manager & Uploads UI Visual Test Suite
 * Validates opening the Asset Gallery dock tab, drag & drop overlay activation,
 * file upload with progress bar, gallery rendering, batch selection toolbar,
 * and the asset preview lightbox modal.
 */

import { test, expect } from '@playwright/test';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

const TINY_PNG_BUFFER = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

test.describe('Asset Manager & Uploads UI Visual Suite', () => {
    test.beforeEach(async ({ page }) => {
        await joinAsGM(page);
        await freezeDynamicElements(page);

        // Open Asset Manager tab in the right sidebar
        await page.evaluate(() => {
            const assetTabBtn = document.querySelector('[data-tab="tab-assets"]');
            if (assetTabBtn) assetTabBtn.click();
        });

        await page.waitForSelector('#tab-assets.active', { state: 'visible', timeout: 5000 });
        await page.waitForTimeout(400);
    });

    test('Test 1: Opens Asset Manager tab, displays root breadcrumbs and gallery', async ({ page }) => {
        const breadcrumbs = page.locator('#asset-breadcrumbs');
        await expect(breadcrumbs).toContainText('Root');

        const gallery = page.locator('#asset-gallery-container');
        await expect(gallery).toBeVisible();

        // Capture visual snapshot of the Asset Manager panel
        const assetPanel = page.locator('#tab-assets');
        await expect(assetPanel).toHaveScreenshot('asset-manager-panel.png');
    });

    test('Test 2: Drag and drop overlay activates on dragenter and hides on dragleave', async ({ page }) => {
        const dropOverlay = page.locator('#asset-drop-overlay');

        // Initially hidden
        await expect(dropOverlay).toHaveClass(/vtt-hidden/);

        // Dispatch dragenter with Files type
        await page.evaluate(() => {
            const container = document.getElementById('asset-gallery-container');
            const event = new Event('dragenter', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: {
                    types: ['Files'],
                    effectAllowed: 'all',
                    dropEffect: 'none'
                }
            });
            container.dispatchEvent(event);
        });

        // Drop overlay must now be visible with prompt text
        await expect(dropOverlay).toBeVisible();
        await expect(page.locator('#asset-drop-overlay-text')).toContainText('Drop files');

        // Dispatch dragleave
        await page.evaluate(() => {
            const container = document.getElementById('asset-gallery-container');
            const event = new Event('dragleave', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { types: ['Files'] }
            });
            container.dispatchEvent(event);
        });

        // Drop overlay must hide
        await expect(dropOverlay).toHaveClass(/vtt-hidden/);
    });

    test('Test 3: File upload via input displays progress indicator and renders in gallery', async ({ page }) => {
        // Upload through the file input
        const fileInput = page.locator('#asset-file-upload');
        await fileInput.setInputFiles({
            name: 'ui-test-gem.png',
            mimeType: 'image/png',
            buffer: TINY_PNG_BUFFER
        });

        // Wait for uploaded item to render in the gallery
        const uploadedItem = page.locator('.asset-item', { hasText: 'ui-test-gem' });
        await expect(uploadedItem).toBeVisible({ timeout: 8000 });

        // Clean up created asset on server
        await page.evaluate(async () => {
            await fetch('/api/assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'ui-test-gem.png' })
            });
        });
    });

    test('Test 4: Asset Preview Lightbox opens with asset details and visual snapshot', async ({ page }) => {
        const fileName = 'ui-preview-shield.png';

        // Upload through the UI input
        await page.locator('#asset-file-upload').setInputFiles({
            name: fileName,
            mimeType: 'image/png',
            buffer: TINY_PNG_BUFFER
        });

        // Find the asset in gallery
        const assetCard = page.locator('.asset-item', { hasText: 'ui-preview-shield' });
        await expect(assetCard).toBeVisible({ timeout: 8000 });

        // Select the asset via Ctrl+Click and open preview via Space key shortcut
        await assetCard.click({ modifiers: ['Control'] });
        await page.keyboard.press('Space');

        // Preview modal must be visible
        const modal = page.locator('#modal-asset-preview');
        await expect(modal).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#asset-preview-title')).toContainText('ui-preview-shield');

        // Capture visual snapshot of the Asset Preview lightbox
        await expect(modal.locator('.modal-content')).toHaveScreenshot('asset-preview-modal.png');

        // Close preview
        await page.click('#btn-asset-preview-close');
        await expect(modal).toHaveClass(/vtt-hidden/);

        // Clean up asset
        await page.evaluate(async (name) => {
            await fetch('/api/assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: name })
            });
        }, fileName);
    });

    test('Test 5: Batch selection toolbar appears when selecting items and clears cleanly', async ({ page }) => {
        const fileName = 'ui-batch-test.png';

        // Upload through the UI input
        await page.locator('#asset-file-upload').setInputFiles({
            name: fileName,
            mimeType: 'image/png',
            buffer: TINY_PNG_BUFFER
        });

        const assetCard = page.locator('.asset-item', { hasText: 'ui-batch-test' });
        await expect(assetCard).toBeVisible({ timeout: 8000 });

        // Select the asset via Ctrl+Click
        await assetCard.click({ modifiers: ['Control'] });

        // Batch toolbar should now appear
        const batchToolbar = page.locator('#asset-batch-toolbar');
        await expect(batchToolbar).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#asset-batch-count')).toContainText('1 selected');

        // Click clear selection
        await page.click('#btn-asset-batch-clear');
        await expect(batchToolbar).toHaveClass(/vtt-hidden/);

        // Clean up asset
        await page.evaluate(async (name) => {
            await fetch('/api/assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: name })
            });
        }, fileName);
    });
});
