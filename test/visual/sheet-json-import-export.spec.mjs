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

test.describe('Sheet JSON Import & Export E2E', () => {
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
        if (sandbox) await sandbox.cleanup();
        resetSandboxFixtures();
    });

    test('GM exports character, Player imports PC, overwrites open sheet, and is blocked from importing Companion', async () => {
        const { gmPage, playerPage } = sandbox;

        await ensureSidebarTabOpen(gmPage, 'tab-characters');
        await ensureSidebarTabOpen(playerPage, 'tab-characters');

        // 1. GM exports Valeros
        const exportBtn = gmPage.locator('#character-list .btn-char-export').first();
        await expect(exportBtn).toBeVisible({ timeout: 10000 });
        const [download] = await Promise.all([gmPage.waitForEvent('download'), exportBtn.click()]);
        expect(download.suggestedFilename()).toMatch(/\.json$/i);

        const downloadPath = await download.path();
        const exportedRaw = fs.readFileSync(downloadPath, 'utf8');
        const exportedJson = JSON.parse(exportedRaw);
        expect(exportedJson.format).toBe('forgedvtt-entity-v1');
        expect(exportedJson.entityType).toBe('player');
        expect(exportedJson.entity.isCompanion).toBe(false);

        // 2. Player imports a new PC JSON
        const tempPcPath = path.join(path.dirname(downloadPath), 'imported_lyra.json');
        fs.writeFileSync(
            tempPcPath,
            JSON.stringify({
                format: 'forgedvtt-entity-v1',
                entityType: 'player',
                entity: {
                    id: 'char_lyra_e2e',
                    name: 'Lyra E2E',
                    class: 'Wizard',
                    level: 3,
                    hpMax: 20,
                    hpCurrent: 20,
                    ac: 14,
                    stats: { str: 8, dex: 14, con: 12, int: 17, wis: 12, cha: 10 }
                }
            })
        );

        await playerPage.locator('#input-char-import-json').setInputFiles(tempPcPath);
        const lyraRowPlayer = playerPage.locator('#character-list .char-row', { hasText: 'Lyra E2E' });
        await expect(lyraRowPlayer).toBeVisible({ timeout: 10000 });

        // Verify live sync to GM
        const lyraRowGm = gmPage.locator('#character-list .char-row', { hasText: 'Lyra E2E' });
        await expect(lyraRowGm).toBeVisible({ timeout: 10000 });

        // 3. Open Lyra's sheet on Player, then overwrite via JSON import and verify active sheet refreshes
        await lyraRowPlayer.click();
        await expect(playerPage.locator('#player-sheet-active')).toBeVisible({ timeout: 10000 });

        const updatedPcPath = path.join(path.dirname(downloadPath), 'updated_lyra.json');
        fs.writeFileSync(
            updatedPcPath,
            JSON.stringify({
                format: 'forgedvtt-entity-v1',
                entityType: 'player',
                entity: {
                    id: 'char_lyra_e2e',
                    name: 'Lyra E2E',
                    class: 'Wizard',
                    level: 5,
                    hpMax: 32,
                    hpCurrent: 32,
                    ac: 15,
                    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 }
                }
            })
        );

        await playerPage.locator('#input-char-import-json').setInputFiles(updatedPcPath);
        await expect(playerPage.locator('#imp-conflict-overwrite')).toBeVisible({ timeout: 5000 });
        await playerPage.locator('#imp-conflict-overwrite').click();

        // Active sheet and card should reflect Lv5 / HP 32
        await expect(lyraRowPlayer).toContainText('Lv5', { timeout: 10000 });
        await expect(playerPage.locator('#player-sheet-active')).toContainText('32', { timeout: 10000 });

        // 4. Player attempting to import a Companion JSON is blocked
        const tempCompPath = path.join(path.dirname(downloadPath), 'blocked_companion.json');
        fs.writeFileSync(
            tempCompPath,
            JSON.stringify({
                format: 'forgedvtt-entity-v1',
                entityType: 'companion',
                entity: {
                    id: 'comp_blocked_e2e',
                    name: 'Blocked Wolf',
                    isCompanion: true,
                    monsterData: { name: 'Wolf', hp: { average: 11 } }
                }
            })
        );

        let dialogMessage = '';
        playerPage.once('dialog', async (dialog) => {
            dialogMessage = dialog.message();
            await dialog.accept();
        });
        await playerPage.locator('#input-char-import-json').setInputFiles(tempCompPath);
        await expect.poll(() => dialogMessage, { timeout: 5000 }).toMatch(/Only the GM/i);
        await expect(playerPage.locator('#character-list .char-row', { hasText: 'Blocked Wolf' })).toHaveCount(0);
    });
});
