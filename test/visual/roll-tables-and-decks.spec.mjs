/**
 * test/visual/roll-tables-and-decks.spec.mjs
 * ForgeDVTT - Roll Tables, Flippable Asset Tables & Card Decks Multi-Client Playwright E2E Suite.
 *
 * Verifies end-to-end Roll Table and Card Deck workflows:
 * 1. Custom Roll Table Creation & Public Roll to Chat
 * 2. GM Secret Table Roll (Whisper Mode) & Player Verification
 * 3. Compendium Table Preset Import (Wild Magic Surge)
 * 4. Card Deck Creation & Compendium Tarokka Deck Import
 * 5. Deck State Lifecycle (Shuffle, Draw to Chat, View Cards Modal, Discard, Recall)
 * 6. Card Placement on Canvas & Tabletop Card Flipping
 * 7. Multi-Sided Asset Table Placement & State Cycling
 * 8. Two-Player Live Sync: GM Draws / Places Card -> Player Real-Time Reception
 * 9. Item Roll Table Integration: Inventory Drawer & Chat Ping
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
            if (camp) {
                if (camp.characters) {
                    const origValeros = camp.characters.char_valeros_1;
                    camp.characters = origValeros ? { char_valeros_1: origValeros } : {};
                }
                if (camp.rollTables) {
                    delete camp.rollTables;
                }
                if (camp.maps) {
                    for (const map of Object.values(camp.maps)) {
                        if (map.tokens) {
                            for (const tid of Object.keys(map.tokens)) {
                                if (
                                    tid.startsWith('token_card_') ||
                                    tid.startsWith('token_table_') ||
                                    map.tokens[tid]?.isCardToken ||
                                    map.tokens[tid]?.multiSided
                                ) {
                                    delete map.tokens[tid];
                                }
                            }
                        }
                    }
                }
            }
            fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
        }
    } catch {
        // Ignored in test environment
    }
}

test.describe('Roll Tables & Card Decks E2E Suite', () => {
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
        const handleDialog = async (d) => {
            try {
                await d.accept();
            } catch {
                // Ignore if already handled
            }
        };
        sandbox.gmPage.on('dialog', handleDialog);
        sandbox.playerPage.on('dialog', handleDialog);
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
        // Close any open modals
        await gmPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal, .vtt-modal-backdrop, #modal-draw-destination').forEach((m) => {
                m.classList.add('vtt-hidden');
                if (m.id === 'modal-draw-destination') m.remove();
            });
            const menu = document.getElementById('vtt-token-context-menu');
            if (menu) menu.remove();
        });
        await playerPage.evaluate(() => {
            document.querySelectorAll('.vtt-modal, .vtt-modal-backdrop, #modal-draw-destination').forEach((m) => {
                m.classList.add('vtt-hidden');
                if (m.id === 'modal-draw-destination') m.remove();
            });
            const menu = document.getElementById('vtt-token-context-menu');
            if (menu) menu.remove();
        });
    });

    /**
     * Helper to open the Roll Tables sidebar tab on the GM page.
     */
    async function openTablesTab(page, subtab = 'subtab-roll-tables') {
        const isAlreadyActive = await page.evaluate(() => {
            const btn = document.querySelector('.tab-header[data-tab="tab-tables"]');
            return btn ? btn.classList.contains('active') : false;
        });
        if (!isAlreadyActive) {
            const tabBtn = page.locator('.tab-header[data-tab="tab-tables"]');
            await tabBtn.click();
        }
        await expect(page.locator('#tab-tables')).toBeVisible();

        const subtabBtn = page.locator(`.tables-subtab-btn[data-subtab="${subtab}"]`);
        await subtabBtn.click();
        await expect(page.locator(`#${subtab}`)).toBeVisible();
    }

    /**
     * Helper to right-click a token on canvas and open its context menu.
     */
    async function openTokenContextMenu(page, tokenId) {
        const menu = page.locator('#vtt-token-context-menu');
        await page.evaluate((id) => {
            const ce = window.VTT?.canvasEngine;
            if (ce && ce.showTokenContextMenu) {
                const vp = document.getElementById('vtt-canvas-viewport');
                const r = vp ? vp.getBoundingClientRect() : { left: 200, top: 200, width: 400, height: 400 };
                ce.showTokenContextMenu(id, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
            }
        }, tokenId);

        await expect(menu).toBeVisible({ timeout: 5000 });
        return menu;
    }

    /**
     * Helper to ensure at least one card deck is loaded in the campaign.
     */
    async function ensureDeckLoaded(page) {
        await openTablesTab(page, 'subtab-card-decks');
        const count = await page.locator('#card-decks-list .rolltable-card').count();
        if (count > 0) return;

        await page.locator('#btn-load-preset-decks').click();
        const pickerModal = page.locator('#modal-table-picker');
        await expect(pickerModal).toBeVisible();

        const deckCard = pickerModal.locator('.picker-deck-card').first();
        await expect(deckCard).toBeVisible({ timeout: 10000 });
        await deckCard.click();
        await pickerModal.locator('#btn-preview-load-deck').click();
        await expect(pickerModal).toBeHidden({ timeout: 10000 });
        await expect(page.locator('#card-decks-list .rolltable-card').first()).toBeVisible();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Custom Roll Table Creation & Public Roll to Chat
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 1: Custom Roll Table Creation & Public Roll to Chat', async () => {
        const { gmPage } = sandbox;
        await openTablesTab(gmPage, 'subtab-roll-tables');

        // Click New Table
        await gmPage.locator('#btn-new-roll-table').click();
        const modal = gmPage.locator('#modal-edit-roll-table');
        await expect(modal).toBeVisible();

        // Fill table metadata
        await modal.locator('#edit-table-name').fill('Dungeon Hazards');
        await modal.locator('#edit-table-desc').fill('Dangerous dungeon traps and atmospheric hazards.');

        // Add 3 entries
        const addEntryBtn = modal.locator('.btn-add-table-entry');
        await addEntryBtn.click();
        await addEntryBtn.click();
        await addEntryBtn.click();

        const rows = modal.locator('.table-entry-row');
        await rows.nth(0).locator('.entry-name').fill('Falling Rocks');
        await rows.nth(0).locator('.entry-text').fill('Deals 2d6 bludgeoning damage.');

        await rows.nth(1).locator('.entry-name').fill('Poison Dart');
        await rows.nth(1).locator('.entry-text').fill('DC 13 CON save or 1d10 poison damage.');

        await rows.nth(2).locator('.entry-name').fill('Pit Trap');
        await rows.nth(2).locator('.entry-text').fill('10-ft deep pit, DC 12 DEX save to avoid.');

        // Save table
        await modal.locator('#btn-save-roll-table').click();
        await expect(modal).toBeHidden();

        // Verify table in list
        const tableCard = gmPage.locator('#roll-tables-list .rolltable-card:has-text("Dungeon Hazards")');
        await expect(tableCard).toBeVisible();
        await expect(tableCard).toContainText('1d3');

        // Roll table publicly
        const initialCount = await gmPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );
        await tableCard.locator('.btn-table-roll-public').click();

        await gmPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            initialCount,
            { timeout: 8000 }
        );

        const chat = gmPage.locator('#chat-messages');
        await expect(chat).toContainText('Dungeon Hazards');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: GM Secret Table Roll (Whisper Mode) & Player Verification
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 2: GM Secret Table Roll (Whisper Mode) & Player Verification', async () => {
        const { gmPage, playerPage } = sandbox;
        await openTablesTab(gmPage, 'subtab-roll-tables');

        const tableCard = gmPage.locator('#roll-tables-list .rolltable-card:has-text("Dungeon Hazards")');
        await expect(tableCard).toBeVisible();

        const gmInitialCount = await gmPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );
        const playerInitialCount = await playerPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );

        // Click Whisper Roll
        await tableCard.locator('.btn-table-roll-whisper').click();

        // GM receives whisper message
        await gmPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            gmInitialCount,
            { timeout: 8000 }
        );
        const gmChat = gmPage.locator('#chat-messages');
        await expect(gmChat).toContainText('Dungeon Hazards');

        // Player client should NOT receive the whisper roll
        await playerPage.waitForTimeout(1000);
        const playerFinalCount = await playerPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );
        expect(playerFinalCount).toBe(playerInitialCount);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Compendium Table Preset Import (Wild Magic Surge)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 3: Compendium Table Preset Import (Wild Magic Surge)', async () => {
        const { gmPage } = sandbox;
        await openTablesTab(gmPage, 'subtab-roll-tables');

        // Open Table Picker Modal
        await gmPage.locator('#btn-load-preset-tables').click();
        const pickerModal = gmPage.locator('#modal-table-picker');
        await expect(pickerModal).toBeVisible();

        // Search for Wild Magic in #picker-search-input
        const searchInput = pickerModal.locator('#picker-search-input');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('Wild Magic');

        // Wait for table row to appear
        const tableRow = pickerModal.locator('.picker-row:has-text("Wild Magic")').first();
        await expect(tableRow).toBeVisible({ timeout: 10000 });

        // Click row to preview
        await tableRow.click();
        await expect(pickerModal.locator('#preview-table-name')).toContainText('Wild Magic');

        // Load Table to campaign
        const loadBtn = pickerModal.locator('#btn-preview-load-camp');
        await loadBtn.click();
        await expect(pickerModal).toBeHidden({ timeout: 10000 });

        // Verify imported table is present in campaign roll tables list
        const rollList = gmPage.locator('#roll-tables-list');
        const importedCard = rollList.locator('.rolltable-card:has-text("Wild Magic")').first();
        await expect(importedCard).toBeVisible();

        // Roll on imported table
        const initialCount = await gmPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );
        await importedCard.locator('.btn-table-roll-public').click();

        await gmPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            initialCount,
            { timeout: 8000 }
        );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Card Deck Creation & Compendium Tarokka Deck Import
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 4: Card Deck Creation & Compendium Tarokka Deck Import', async () => {
        const { gmPage } = sandbox;
        await openTablesTab(gmPage, 'subtab-card-decks');

        // Open Deck Picker Modal
        await gmPage.locator('#btn-load-preset-decks').click();
        const pickerModal = gmPage.locator('#modal-table-picker');
        await expect(pickerModal).toBeVisible();

        // Wait for first compendium deck card
        const deckCard = pickerModal.locator('.picker-deck-card').first();
        await expect(deckCard).toBeVisible({ timeout: 10000 });

        // Click deck card to preview
        await deckCard.click();
        await expect(pickerModal.locator('#preview-deck-name')).not.toBeEmpty();

        // Click Load Deck into Campaign
        const loadBtn = pickerModal.locator('#btn-preview-load-deck');
        await loadBtn.click();
        await expect(pickerModal).toBeHidden({ timeout: 10000 });

        // Verify deck rendered in campaign Card Decks tab
        const cardDecksList = gmPage.locator('#card-decks-list');
        const importedDeck = cardDecksList.locator('.rolltable-card').first();
        await expect(importedDeck).toBeVisible();
        await expect(importedDeck).toContainText('Draw:');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Deck State Lifecycle (Shuffle, Draw to Chat, View Cards Modal, Discard, Recall)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 5: Deck State Lifecycle (Shuffle, Draw to Chat, View Cards Modal, Discard, Recall)', async () => {
        const { gmPage } = sandbox;
        await ensureDeckLoaded(gmPage);

        const deckCard = gmPage.locator('#card-decks-list .rolltable-card').first();
        await expect(deckCard).toBeVisible();

        // 1. Shuffle Deck
        await deckCard.locator('.btn-deck-shuffle').click();

        // 2. Draw card to Chat
        await deckCard.locator('.btn-deck-draw').click();
        const drawModal = gmPage.locator('#modal-draw-destination');
        await expect(drawModal).toBeVisible();

        const initialMsgCount = await gmPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );
        await drawModal.locator('.btn-dest-chat').click();
        await expect(drawModal).toBeHidden();

        // Verify card appeared in chat
        await gmPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            initialMsgCount,
            { timeout: 8000 }
        );
        const chat = gmPage.locator('#chat-messages');
        await expect(chat.locator('.card-draw-chat').last()).toBeVisible();

        // 3. Open Deck Cards Viewer
        await deckCard.locator('.btn-deck-view-cards').click();
        const cardsModal = gmPage.locator('#modal-view-deck-cards');
        await expect(cardsModal).toBeVisible();

        // 4. Verify drawn card in viewer & Discard it
        const drawnItem = cardsModal.locator('.deck-drawn-card-item').first();
        await expect(drawnItem).toBeVisible();
        await drawnItem.locator('.btn-card-discard').click();

        // Close viewer
        await cardsModal.locator('.vtt-modal-close').first().click();
        await expect(cardsModal).toBeHidden();

        // 5. Recall all cards back to deck
        await deckCard.locator('.btn-deck-recall').click();

        // Verify Discard counter is 0
        await expect(deckCard).toContainText('Discard: 0');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 6: Card Placement on Canvas & Tabletop Card Flipping
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 6: Card Placement on Canvas & Tabletop Card Flipping', async () => {
        const { gmPage } = sandbox;
        await ensureDeckLoaded(gmPage);

        const deckCard = gmPage.locator('#card-decks-list .rolltable-card').first();
        await expect(deckCard).toBeVisible();

        // Draw card directly to Canvas
        await deckCard.locator('.btn-deck-draw').click();
        const drawModal = gmPage.locator('#modal-draw-destination');
        await expect(drawModal).toBeVisible();
        await drawModal.locator('.btn-dest-canvas').click();
        await expect(drawModal).toBeHidden();

        // Locate card token on canvas
        await gmPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens() || {};
                return Object.values(tokens).some((t) => t.isCardToken);
            },
            { timeout: 8000 }
        );

        const cardTokenId = await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens() || {};
            const cardTok = Object.values(tokens).find((t) => t.isCardToken);
            return cardTok ? cardTok.id : null;
        });
        expect(cardTokenId).not.toBeNull();

        // Verify initial state is Face (activeTokenIndex === 0)
        const initialSide = await gmPage.evaluate((id) => {
            return window.VTT?.canvasEngine?.getTokens()?.[id]?.activeTokenIndex;
        }, cardTokenId);
        expect(initialSide).toBe(0);

        // Open Token Context Menu on the card token
        const menu = await openTokenContextMenu(gmPage, cardTokenId);
        const flipBtn = menu.locator('#menu-flip-card');
        await expect(flipBtn).toBeVisible();

        // Flip card
        await flipBtn.click();
        await expect(menu).toBeHidden();

        // Verify token art flipped to Back (activeTokenIndex === 1)
        const flippedSide = await gmPage.evaluate((id) => {
            return window.VTT?.canvasEngine?.getTokens()?.[id]?.activeTokenIndex;
        }, cardTokenId);
        expect(flippedSide).toBe(1);

        // Flip back to Face
        const menu2 = await openTokenContextMenu(gmPage, cardTokenId);
        await menu2.locator('#menu-flip-card').click();
        await expect(menu2).toBeHidden();

        const restoredSide = await gmPage.evaluate((id) => {
            return window.VTT?.canvasEngine?.getTokens()?.[id]?.activeTokenIndex;
        }, cardTokenId);
        expect(restoredSide).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 7: Multi-Sided Asset Table Placement & State Cycling
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 7: Multi-Sided Asset Table Placement & State Cycling', async () => {
        const { gmPage } = sandbox;

        // Switch to Assets Tab -> Asset Tables View
        await gmPage.locator('.tab-header[data-tab="tab-assets"]').click();
        const subtabBtn = gmPage.locator('.asset-subtab-btn[data-subtab="asset-tables-view"]');
        await subtabBtn.click();
        await expect(gmPage.locator('#asset-tables-view')).toBeVisible();

        // Create Multi-Sided Asset Table programmatically to guarantee 3 clear states
        await gmPage.evaluate(() => {
            const state = window.VTT.rollTablesEngine;
            const campTables = window.VTT.campaignState.rollTables;
            campTables.assetTables = campTables.assetTables || [];
            campTables.assetTables = campTables.assetTables.filter((t) => t.id !== 'table_chest_asset');
            campTables.assetTables.push({
                id: 'table_chest_asset',
                name: 'Treasure Chest',
                defaultTokenSize: 1,
                entries: [
                    { id: 'side_1', name: 'Closed Chest', url: 'favicon.svg' },
                    { id: 'side_2', name: 'Open Chest', url: 'vtt/img/covers/PHB.webp' },
                    { id: 'side_3', name: 'Mimic Teeth', url: 'vtt/img/covers/XPHB.webp' }
                ]
            });
            state.renderAllViews();
        });

        const assetCard = gmPage.locator('#asset-tables-list .rolltable-card:has-text("Treasure Chest")');
        await expect(assetCard).toBeVisible();

        // Place on Canvas
        await assetCard.locator('.btn-asset-table-place').click();

        // Find token on canvas
        await gmPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens() || {};
                return Object.values(tokens).some((t) => t.isAssetTable && t.name === 'Treasure Chest');
            },
            { timeout: 8000 }
        );

        const chestTokenId = await gmPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens() || {};
            const tok = Object.values(tokens).find((t) => t.isAssetTable && t.name === 'Treasure Chest');
            return tok ? tok.id : null;
        });
        expect(chestTokenId).not.toBeNull();

        // Open context menu and cycle to next side
        const menu = await openTokenContextMenu(gmPage, chestTokenId);
        const nextSideBtn = menu.locator('#menu-next-side');
        await expect(nextSideBtn).toBeVisible();
        await nextSideBtn.click();
        await expect(menu).toBeHidden();

        // Verify side updated to index 1 (Open Chest)
        const updatedIdx = await gmPage.evaluate((id) => {
            return window.VTT?.canvasEngine?.getTokens()?.[id]?.activeTokenIndex;
        }, chestTokenId);
        expect(updatedIdx).toBe(1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 8: Two-Player Live Sync - GM Actions Broadcast to Player Client
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 8: Two-Player Live Sync - GM Actions Broadcast to Player Client', async () => {
        const { gmPage, playerPage } = sandbox;
        await ensureDeckLoaded(gmPage);

        const deckCard = gmPage.locator('#card-decks-list .rolltable-card').first();
        await expect(deckCard).toBeVisible();

        // 1. GM draws card to chat
        await deckCard.locator('.btn-deck-draw').click();
        const drawModal = gmPage.locator('#modal-draw-destination');
        await expect(drawModal).toBeVisible();

        const playerInitialChatCount = await playerPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );
        await drawModal.locator('.btn-dest-chat').click();
        await expect(drawModal).toBeHidden();

        // Player client receives live card broadcast in chat
        await playerPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            playerInitialChatCount,
            { timeout: 8000 }
        );

        // Ensure player chat tab is active
        const playerChatTabActive = await playerPage.evaluate(() => {
            const btn = document.querySelector('.tab-header[data-tab="tab-chat"]');
            return btn ? btn.classList.contains('active') : false;
        });
        if (!playerChatTabActive) {
            await playerPage.locator('.tab-header[data-tab="tab-chat"]').click();
        }

        const playerChat = playerPage.locator('#chat-messages');
        await expect(playerChat.locator('.card-draw-chat').last()).toBeVisible();

        // 2. GM plays card to canvas
        await deckCard.locator('.btn-deck-draw').click();
        const drawModal2 = gmPage.locator('#modal-draw-destination');
        await expect(drawModal2).toBeVisible();
        await drawModal2.locator('.btn-dest-canvas').click();
        await expect(drawModal2).toBeHidden();

        // Player client sees the placed card token on their canvas
        await playerPage.waitForFunction(
            () => {
                const tokens = window.VTT?.canvasEngine?.getTokens() || {};
                return Object.values(tokens).some((t) => t.isCardToken);
            },
            { timeout: 8000 }
        );

        const syncedToken = await playerPage.evaluate(() => {
            const tokens = window.VTT?.canvasEngine?.getTokens() || {};
            return Object.values(tokens).find((t) => t.isCardToken);
        });
        expect(syncedToken).toBeTruthy();

        // 3. GM flips card token
        const menu = await openTokenContextMenu(gmPage, syncedToken.id);
        await menu.locator('#menu-flip-card').click();
        await expect(menu).toBeHidden();

        // Player client observes card flipped in real time
        await playerPage.waitForFunction(
            (id) => {
                const tok = window.VTT?.canvasEngine?.getTokens()?.[id];
                return tok && tok.activeTokenIndex === 1;
            },
            syncedToken.id,
            { timeout: 8000 }
        );

        const playerFlippedSide = await playerPage.evaluate((id) => {
            return window.VTT?.canvasEngine?.getTokens()?.[id]?.activeTokenIndex;
        }, syncedToken.id);
        expect(playerFlippedSide).toBe(1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 9: Item Roll Table Integration (Inventory & Chat Ping)
    // ─────────────────────────────────────────────────────────────────────────
    test('Test 9: Item Roll Table Integration - Wand of Wonder roll from inventory and chat ping', async () => {
        const { gmPage } = sandbox;

        // 1. Inject Wand of Wonder into Valeros's inventory and ensure catalog is pre-warmed
        await gmPage.evaluate(async () => {
            if (window.VTT?.rollTablesEngine?.ensureCompendiumCatalog) {
                await window.VTT.rollTablesEngine.ensureCompendiumCatalog();
            }
            const char = window.VTT?.campaignState?.characters?.['char_valeros_1'];
            if (char) {
                if (!char.equipment) char.equipment = [];
                char.equipment = char.equipment.filter((e) => e.name !== 'Wand of Wonder');
                char.equipment.unshift({
                    id: 'eq_wand_of_wonder_test',
                    name: 'Wand of Wonder',
                    qty: 1,
                    weight: 1,
                    description: 'While holding this wand, you can roll d100 on the table to discover what happens.'
                });
                if (window.VTT.playerSheet && window.VTT.playerSheet.currentCharacter?.id === 'char_valeros_1') {
                    window.VTT.playerSheet.render();
                }
            }
        });

        // 2. Open Valeros Player Sheet
        await gmPage.evaluate(() => {
            if (window.VTT?.playerSheet) {
                window.VTT.playerSheet.openSheet('char_valeros_1');
            }
        });

        const sheetPanel = gmPage.locator('#player-sheet-panel');
        await expect(sheetPanel).toBeVisible({ timeout: 5000 });

        // Switch to Equipment Tab
        await sheetPanel.locator('.ps-tab-btn[data-tab="ps-equipment"]').click();
        await expect(sheetPanel.locator('#ps-equipment')).toBeVisible();

        // 3. Find Wand of Wonder row
        const wowRow = sheetPanel.locator('.equip-row').filter({ hasText: 'Wand of Wonder' }).first();
        await expect(wowRow).toBeVisible();

        // Expand description drawer
        const toggle = wowRow.locator('.pc-equip-toggle');
        await toggle.click();

        // Verify the roll table button is present inside the drawer
        const rollBtn = wowRow.locator('.pc-item-table-roll-btn');
        await expect(rollBtn).toBeVisible({ timeout: 4000 });
        await expect(rollBtn).toContainText('Roll Table');

        // 4. Click the Roll Table button
        const initialMsgCount = await gmPage.evaluate(
            () => document.querySelectorAll('#chat-messages .chat-message').length
        );

        await rollBtn.click();

        // Wait for rolltable-chat-card to appear in chat
        await gmPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            initialMsgCount,
            { timeout: 8000 }
        );

        // Ensure chat tab is active so chat messages are visible
        const chatTabActive = await gmPage.evaluate(() => {
            const btn = document.querySelector('.tab-header[data-tab="tab-chat"]');
            return btn ? btn.classList.contains('active') : false;
        });
        if (!chatTabActive) {
            await gmPage.locator('.tab-header[data-tab="tab-chat"]').click();
        }

        const lastChatMsg = gmPage.locator('#chat-messages .chat-message').last();
        await expect(lastChatMsg.locator('.rolltable-chat-card')).toBeVisible();
        await expect(lastChatMsg.locator('.rolltable-chat-card')).toContainText('Wand of Wonder');

        // 5. Ping Item to Chat
        const pingBtn = wowRow.locator('.pc-equip-ping');
        await pingBtn.click();

        // Wait for item card in chat
        await gmPage.waitForFunction(
            (cnt) => document.querySelectorAll('#chat-messages .chat-message').length > cnt,
            initialMsgCount + 1,
            { timeout: 8000 }
        );

        const itemCardMsg = gmPage.locator('#chat-messages .chat-message').last();
        await expect(itemCardMsg.locator('.macro-chat-card')).toBeVisible();
        const chatRollBtn = itemCardMsg.locator('.btn-chat-roll-table');
        await expect(chatRollBtn).toBeVisible();
        await expect(chatRollBtn).toContainText('Roll Table');
    });
});
