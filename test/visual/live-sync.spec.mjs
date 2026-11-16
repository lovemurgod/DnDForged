import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupTwoPlayerSandbox } from './helpers/visual-fixture.mjs';

function resetVisualChatLog() {
    try {
        const chatPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'chat-log.json');
        const pristine = {
            visual_test_campaign: [
                {
                    id: 'msg_1',
                    author: 'DungeonMaster',
                    text: 'Welcome to the Sunken Crypt. The torchlight flickers off the stone walls.',
                    timestamp: '2026-11-09T08:00:00.000Z',
                    type: 'narration'
                },
                {
                    id: 'msg_2',
                    author: 'Valeros',
                    text: 'I ready my longsword and shield, keeping watch on the shadows.',
                    timestamp: '2026-11-09T08:01:00.000Z',
                    type: 'chat'
                }
            ]
        };
        fs.writeFileSync(chatPath, JSON.stringify(pristine, null, 2));
    } catch (e) {
        // Ignored
    }
}

test.describe('Two-Player Live Synchronization (Desktop GM <-> Desktop Player)', () => {
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
        resetVisualChatLog();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Step 1: Real-time token movement broadcasts from GM to Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM moves hero token to (x: 450, y: 350)
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tokens = ce.getTokens();
            const tok = tokens['tok_hero_1'];
            tok.x = 450;
            tok.y = 350;
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: tok });
            ce.renderAll();
        });

        // Player's canvasEngine receives WebSocket delta and updates coordinates
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.();
                const tok = tokens?.['tok_hero_1'];
                return tok && tok.x === 450 && tok.y === 350;
            },
            { timeout: 10000 }
        );

        const playerPos = await playerPage.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_hero_1'];
            return { x: tok.x, y: tok.y };
        });
        expect(playerPos).toEqual({ x: 450, y: 350 });
    });

    test('Step 2: Token HP damage and status conditions broadcast to Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM updates monster token with 4 damage (HP 7 -> 3) and applies 'stunned'
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tokens = ce.getTokens();
            const tok = tokens['tok_monster_1'];
            tok.hp = 3;
            tok.conditions = ['stunned'];
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: tok });
            ce.renderAll();
        });

        // Player receives live HP deduction and condition markers
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.();
                const tok = tokens?.['tok_monster_1'];
                return tok && tok.hp === 3 && Array.isArray(tok.conditions) && tok.conditions.includes('stunned');
            },
            { timeout: 10000 }
        );

        const monsterState = await playerPage.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_monster_1'];
            return { hp: tok.hp, conditions: tok.conditions };
        });
        expect(monsterState.hp).toBe(3);
        expect(monsterState.conditions).toContain('stunned');
    });

    test('Step 3: Combat initiative activation and turn advancement broadcast to Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM starts combat with 2 combatants and sets active turn to Valeros
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('initiative:update', {
                initiative: {
                    combatants: [
                        { id: 'tok_hero_1', name: 'Valeros', initiative: 18, isVisible: true },
                        { id: 'tok_monster_1', name: 'Goblin Raider', initiative: 12, isVisible: true }
                    ],
                    currentRound: 1,
                    activeTurnIndex: 0,
                    isVisible: true
                }
            });
        });

        // Player's initiative state synchronizes
        await playerPage.waitForFunction(
            () => {
                const init = window.VTT.campaignState?.initiative;
                return init && init.isVisible === true && init.activeTurnIndex === 0 && init.combatants?.length === 2;
            },
            { timeout: 10000 }
        );

        const initData = await playerPage.evaluate(() => {
            return window.VTT.campaignState.initiative;
        });
        expect(initData.isVisible).toBe(true);
        expect(initData.activeTurnIndex).toBe(0);
        expect(initData.combatants.length).toBe(2);
    });

    test('Step 4: Live chat message broadcasts to Player chat container', async () => {
        const { gmPage, playerPage } = sandbox;

        const uniqueMsg = `Prepare for battle! TestToken-${Date.now()}`;

        // GM broadcasts in chat
        await gmPage.evaluate(
            ({ uniqueMsg }) => {
                window.VTT.socket.emit('chat:msg', {
                    text: uniqueMsg,
                    sender: 'DungeonMaster',
                    role: 'GM',
                    timestamp: Date.now()
                });
            },
            { uniqueMsg }
        );

        // Player receives message in chat container
        await playerPage.waitForFunction(
            ({ uniqueMsg }) => {
                const container = document.getElementById('chat-messages') || document.querySelector('.chat-messages');
                return container && container.textContent.includes(uniqueMsg);
            },
            { uniqueMsg },
            { timeout: 10000 }
        );

        const chatText = await playerPage.evaluate(() => {
            const container = document.getElementById('chat-messages') || document.querySelector('.chat-messages');
            return container ? container.textContent : '';
        });
        expect(chatText).toContain(uniqueMsg);
    });

    test('Step 5: Map pointer ping broadcasts to Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // Attach receiver hook on Player
        await playerPage.evaluate(() => {
            window._lastPing = null;
            window.VTT.socket.on('map:pinged', (data) => {
                window._lastPing = data;
            });
        });

        // GM emits a map ping at coordinates (500, 300)
        await gmPage.evaluate(() => {
            window.VTT.socket.emit('map:ping', {
                x: 500,
                y: 300,
                color: '#e74c3c'
            });
        });

        // Player receives the ping with exact coordinates
        await playerPage.waitForFunction(
            () => {
                return window._lastPing && window._lastPing.x === 500 && window._lastPing.y === 300;
            },
            { timeout: 10000 }
        );

        const ping = await playerPage.evaluate(() => window._lastPing);
        expect(ping.x).toBe(500);
        expect(ping.y).toBe(300);
    });

    test('Step 6: Synchronized tabletop visual regression baseline', async () => {
        const { playerPage } = sandbox;
        await playerPage.waitForTimeout(400);
        await expect(playerPage).toHaveScreenshot('player-live-sync-desktop.png');
    });
});

test.describe('Two-Player Live Synchronization (Desktop GM <-> Mobile Player)', () => {
    let sandbox = null;

    test.beforeAll(async ({ browser }) => {
        sandbox = await setupTwoPlayerSandbox(browser, {
            gmViewport: { width: 1440, height: 900 },
            playerViewport: { width: 390, height: 844 },
            playerUsername: 'MobilePlayer',
            playerHasTouch: true
        });
    });

    test.afterAll(async () => {
        resetVisualChatLog();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Step 1: Token movement broadcasts from Desktop GM to Mobile Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM moves token to (350, 400)
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tokens = ce.getTokens();
            const tok = tokens['tok_hero_1'];
            tok.x = 350;
            tok.y = 400;
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: tok });
            ce.renderAll();
        });

        // Mobile Player receives position update
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.();
                const tok = tokens?.['tok_hero_1'];
                return tok && tok.x === 350 && tok.y === 400;
            },
            { timeout: 10000 }
        );

        const playerPos = await playerPage.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_hero_1'];
            return { x: tok.x, y: tok.y };
        });
        expect(playerPos).toEqual({ x: 350, y: 400 });
    });

    test('Step 2: Token HP and conditions broadcast to Mobile Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM sets monster HP to 1 and adds 'poisoned'
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tokens = ce.getTokens();
            const tok = tokens['tok_monster_1'];
            tok.hp = 1;
            tok.conditions = ['poisoned'];
            window.VTT.socket.emit('token:update', { mapId: ce.getCurrentMapId(), token: tok });
            ce.renderAll();
        });

        // Mobile Player verifies condition and HP
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const tokens = ce?.getTokens?.();
                const tok = tokens?.['tok_monster_1'];
                return tok && tok.hp === 1 && Array.isArray(tok.conditions) && tok.conditions.includes('poisoned');
            },
            { timeout: 10000 }
        );

        const monsterState = await playerPage.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_monster_1'];
            return { hp: tok.hp, conditions: tok.conditions };
        });
        expect(monsterState.hp).toBe(1);
        expect(monsterState.conditions).toContain('poisoned');
    });

    test('Step 3: Combat initiative tracker broadcasts to Mobile Player', async () => {
        const { gmPage, playerPage } = sandbox;

        await gmPage.evaluate(() => {
            window.VTT.socket.emit('initiative:update', {
                initiative: {
                    combatants: [
                        { id: 'tok_hero_1', name: 'Valeros', initiative: 20, isVisible: true },
                        { id: 'tok_monster_1', name: 'Goblin Raider', initiative: 8, isVisible: true }
                    ],
                    currentRound: 2,
                    activeTurnIndex: 1,
                    isVisible: true
                }
            });
        });

        await playerPage.waitForFunction(
            () => {
                const init = window.VTT.campaignState?.initiative;
                return init && init.isVisible === true && init.currentRound === 2 && init.activeTurnIndex === 1;
            },
            { timeout: 10000 }
        );

        const initData = await playerPage.evaluate(() => window.VTT.campaignState.initiative);
        expect(initData.currentRound).toBe(2);
        expect(initData.activeTurnIndex).toBe(1);
    });

    test('Step 4: Live chat message broadcasts to Mobile Player', async () => {
        const { gmPage, playerPage } = sandbox;

        const mobileMsg = `Mobile alert: goblin down! ${Date.now()}`;

        await gmPage.evaluate(
            ({ mobileMsg }) => {
                window.VTT.socket.emit('chat:msg', {
                    text: mobileMsg,
                    sender: 'DungeonMaster',
                    role: 'GM',
                    timestamp: Date.now()
                });
            },
            { mobileMsg }
        );

        await playerPage.waitForFunction(
            ({ mobileMsg }) => {
                const container = document.getElementById('chat-messages') || document.querySelector('.chat-messages');
                return container && container.textContent.includes(mobileMsg);
            },
            { mobileMsg },
            { timeout: 10000 }
        );

        const chatText = await playerPage.evaluate(() => {
            const container = document.getElementById('chat-messages') || document.querySelector('.chat-messages');
            return container ? container.textContent : '';
        });
        expect(chatText).toContain(mobileMsg);
    });

    test('Step 5: Map pointer ping broadcasts to Mobile Player', async () => {
        const { gmPage, playerPage } = sandbox;

        await playerPage.evaluate(() => {
            window._lastMobilePing = null;
            window.VTT.socket.on('map:pinged', (data) => {
                window._lastMobilePing = data;
            });
        });

        await gmPage.evaluate(() => {
            window.VTT.socket.emit('map:ping', {
                x: 400,
                y: 400,
                color: '#3498db'
            });
        });

        await playerPage.waitForFunction(
            () => {
                return window._lastMobilePing && window._lastMobilePing.x === 400 && window._lastMobilePing.y === 400;
            },
            { timeout: 10000 }
        );

        const ping = await playerPage.evaluate(() => window._lastMobilePing);
        expect(ping.x).toBe(400);
        expect(ping.y).toBe(400);
    });

    test('Step 6: Synchronized mobile tabletop visual regression baseline', async () => {
        const { playerPage } = sandbox;
        await playerPage.waitForTimeout(400);
        await expect(playerPage).toHaveScreenshot('player-live-sync-mobile.png');
    });
});
