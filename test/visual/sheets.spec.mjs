import { test, expect } from '@playwright/test';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

test.describe('Character & Creature Sheets Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await joinAsGM(page);
    });

    test('renders player character sheet (Valeros)', async ({ page }) => {
        // Open player sheet for Valeros
        await page.evaluate(() => {
            if (window.VTT.playerSheet) {
                window.VTT.playerSheet.openSheet('char_valeros_1');
            }
        });

        await page.waitForSelector('#player-sheet-panel:not(.minimized)', { state: 'visible', timeout: 5000 });
        await freezeDynamicElements(page);
        await page.waitForTimeout(500);

        const playerSheet = page.locator('#player-sheet-panel');
        await expect(playerSheet).toHaveScreenshot('player-sheet-valeros.png');
    });

    test('renders creature statblock sheet (Goblin Raider)', async ({ page }) => {
        // Open creature sheet for Goblin Raider
        await page.evaluate(() => {
            if (window.VTT.creatureSheet) {
                window.VTT.creatureSheet.openSheet(
                    {
                        name: 'Goblin Raider',
                        size: ['S'],
                        type: 'humanoid (goblinoid)',
                        alignment: ['N', 'E'],
                        ac: [15],
                        hp: { average: 7, formula: '2d6' },
                        speed: { walk: 30 },
                        str: 8,
                        dex: 14,
                        con: 10,
                        int: 10,
                        wis: 8,
                        cha: 8,
                        skills: { stealth: '+6' },
                        senses: ['darkvision 60 ft.'],
                        passive: 9,
                        languages: ['Common', 'Goblin'],
                        cr: '1/4',
                        trait: [
                            {
                                name: 'Nimble Escape',
                                entries: [
                                    'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.'
                                ]
                            }
                        ],
                        action: [
                            {
                                name: 'Scimitar',
                                entries: [
                                    'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.'
                                ]
                            },
                            {
                                name: 'Shortbow',
                                entries: [
                                    'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.'
                                ]
                            }
                        ]
                    },
                    'tok_monster_1'
                );
            }
        });

        await page.waitForSelector('#creature-sheet-panel:not(.minimized)', { state: 'visible', timeout: 5000 });
        await freezeDynamicElements(page);
        await page.waitForTimeout(500);

        const creatureSheet = page.locator('#creature-sheet-panel');
        await expect(creatureSheet).toHaveScreenshot('creature-sheet-goblin.png');
    });
});
