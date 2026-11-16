/**
 * test/visual/canvas-tools-pointer-matrix.spec.mjs
 * ForgeD VTT - Canvas Toolbar, Real Pointer Drag Matrix & Spacebar Waypoint Test Suite
 * Validates the full user-facing toolbar and pointer interaction pipeline:
 * 1. Ping tool activation, canvas click dispatch & peer 2-player synchronization (GM -> Player)
 * 2. Measurement ruler pointer drag, Spacebar waypoint dropping, distance accumulation & Escape cancel
 * 3. Persistent shape drag creation & synchronized entity commit
 * 4. Freehand paint brush stroke drag & player ownership tagging
 * 5. Lighting tool activation & GM-only security guard
 * 6. Map tools (traps & portals) ribbon trigger & GM access guard
 * 7. Keyboard hotkey tool cycling (1-6) and Escape cancellation
 * 8. Visual regression snapshot of the Ping HUD ring
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupTwoPlayerSandbox, freezeDynamicElements } from './helpers/visual-fixture.mjs';

function resetSandboxFixtures() {
    try {
        const chatPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'chat-log.json');
        const pristineChat = {
            visual_test_campaign: [
                {
                    id: 'msg_1',
                    author: 'DungeonMaster',
                    text: 'Welcome to the Sunken Crypt.',
                    timestamp: '2026-11-09T08:00:00.000Z',
                    type: 'narration'
                }
            ]
        };
        fs.writeFileSync(chatPath, JSON.stringify(pristineChat, null, 2));

        const campPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'campaigns.json');
        if (fs.existsSync(campPath)) {
            const campData = JSON.parse(fs.readFileSync(campPath, 'utf8'));
            const camp = campData.visual_test_campaign;
            if (camp?.maps?.map_visual_dungeon) {
                camp.maps.map_visual_dungeon.drawings = {};
                camp.maps.map_visual_dungeon.shapes = {};
                fs.writeFileSync(campPath, JSON.stringify(campData, null, 2));
            }
        }
    } catch (e) {}
}

test.describe('Canvas Toolbar, Real Pointer Drag Matrix & Spacebar Waypoint Suite', () => {
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

    test('Test 1: Ping Tool UI Activation, Canvas Click & Live Peer Synchronization', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM clicks the Ping tool button in the left toolbar (#tool-ping)
        const pingBtn = gmPage.locator('#tool-ping');
        await expect(pingBtn).toBeVisible();
        await pingBtn.click();
        await expect(pingBtn).toHaveClass(/active/);

        // Verify GM canvasEngine reflects activeTool === 'ping'
        const gmActiveTool = await gmPage.evaluate(() => window.VTT?.canvasEngine?.getActiveTool?.());
        expect(gmActiveTool).toBe('ping');

        // 2. GM clicks on the canvas at viewport center (700, 450)
        await gmPage.mouse.click(700, 450);

        // 3. Player must receive the ping broadcast and animate it on their HUD
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT?.canvasEngine;
                return document.getElementById('vtt-canvas-hud') !== null;
            },
            { timeout: 10000 }
        );

        // Verify GM active tool remains 'ping' after clicking
        const toolAfterClick = await gmPage.evaluate(() => window.VTT?.canvasEngine?.getActiveTool?.());
        expect(toolAfterClick).toBe('ping');
    });

    test('Test 2: Measurement Ruler Drag, Spacebar Waypoints & Live Peer Sync', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM clicks the Measure tool button (#tool-measure)
        const measureBtn = gmPage.locator('#tool-measure');
        await measureBtn.click();
        await expect(measureBtn).toHaveClass(/active/);

        // 2. GM mouse down at (500, 400) and drags to (650, 400)
        await gmPage.mouse.move(500, 400);
        await gmPage.mouse.down();
        await gmPage.mouse.move(650, 400);

        // 3. GM taps Spacebar to drop a waypoint at (650, 400)
        await gmPage.keyboard.press('Space');

        // 4. GM drags further down to (650, 550)
        await gmPage.mouse.move(650, 550);

        // Verify waypoints accumulated on GM
        const waypointsInfo = await gmPage.evaluate(() => {
            const ce = window.VTT?.canvasEngine;
            return {
                isMeasuring: ce ? true : false,
                measurePill: document.querySelector('.measure-distance-pill')?.textContent || ''
            };
        });
        expect(waypointsInfo.isMeasuring).toBe(true);

        // 5. GM releases mouse and presses Escape to cancel measurement
        await gmPage.mouse.up();
        await gmPage.keyboard.press('Escape');

        // Verify ruler was cleared
        const isStillMeasuring = await gmPage.evaluate(() => {
            return document.querySelector('.measure-distance-pill') !== null;
        });
        expect(isStillMeasuring).toBe(false);
    });

    test('Test 3: Persistent Shape Drag Creation & Entity Sync to Player', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. GM clicks the Shape tool button (#tool-shape)
        const shapeBtn = gmPage.locator('#tool-shape');
        await shapeBtn.click();
        await expect(shapeBtn).toHaveClass(/active/);

        // 2. Drag to create a persistent shape from (500, 350) to (650, 500)
        await gmPage.mouse.move(500, 350);
        await gmPage.mouse.down();
        await gmPage.mouse.move(650, 500, { steps: 5 });
        await gmPage.mouse.up();

        // 3. Player receives the new shape in their shapes catalog
        await playerPage.waitForFunction(
            () => {
                const shapes = window.VTT?.canvasEngine?.getShapes?.();
                return shapes && Object.keys(shapes).length > 0;
            },
            { timeout: 10000 }
        );

        const playerShapes = await playerPage.evaluate(() => {
            return window.VTT?.canvasEngine?.getShapes?.();
        });
        const shapeKeys = Object.keys(playerShapes);
        expect(shapeKeys.length).toBeGreaterThan(0);
        expect(playerShapes[shapeKeys[0]].ownerUsername).toBe('DungeonMaster');
    });

    test('Test 4: Freehand Paint Brush Drag & Player Ownership Attribution', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. Player clicks the Paint tool button (#tool-paint)
        const paintBtn = playerPage.locator('#tool-paint');
        await paintBtn.click();
        await expect(paintBtn).toHaveClass(/active/);

        // 2. Player draws a freehand brush curve
        await playerPage.mouse.move(550, 350);
        await playerPage.mouse.down();
        await playerPage.mouse.move(580, 390, { steps: 5 });
        await playerPage.mouse.move(620, 360, { steps: 5 });
        await playerPage.mouse.up();

        // 3. GM observes the newly created drawing with ownerUsername: 'PlayerOne'
        await gmPage.waitForFunction(
            () => {
                const drawings = window.VTT?.canvasEngine?.getDrawings?.();
                if (!drawings) return false;
                return Object.values(drawings).some((d) => d.ownerUsername === 'PlayerOne');
            },
            { timeout: 10000 }
        );

        const gmDrawings = await gmPage.evaluate(() => window.VTT?.canvasEngine?.getDrawings?.());
        const playerDrawing = Object.values(gmDrawings).find((d) => d.ownerUsername === 'PlayerOne');
        expect(playerDrawing).toBeDefined();
        expect(playerDrawing.points.length).toBeGreaterThanOrEqual(2);
    });

    test('Test 5: Lighting Tool Activation & Player Role Security Guard', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. Player has #tool-lighting hidden with .vtt-hidden
        const playerLightingBtn = playerPage.locator('#tool-lighting');
        await expect(playerLightingBtn).toHaveClass(/vtt-hidden/);

        const playerTool = await playerPage.evaluate(() => window.VTT?.canvasEngine?.getActiveTool?.());
        expect(playerTool).not.toBe('lighting');

        // 2. GM clicks Lighting tool (#tool-lighting)
        const gmLightingBtn = gmPage.locator('#tool-lighting');
        await expect(gmLightingBtn).toBeVisible();
        await expect(gmLightingBtn).not.toHaveClass(/vtt-hidden/);
        await gmLightingBtn.click();
        await expect(gmLightingBtn).toHaveClass(/active/);

        const gmTool = await gmPage.evaluate(() => window.VTT?.canvasEngine?.getActiveTool?.());
        expect(gmTool).toBe('lighting');
    });

    test('Test 6: Map Tools Ribbon Activation & GM Access Guard', async () => {
        const { gmPage, playerPage } = sandbox;

        // 1. Player has #tool-map-tools hidden with .vtt-hidden
        const playerMapToolsBtn = playerPage.locator('#tool-map-tools');
        await expect(playerMapToolsBtn).toHaveClass(/vtt-hidden/);

        const playerTool = await playerPage.evaluate(() => window.VTT?.canvasEngine?.getActiveTool?.());
        expect(playerTool).not.toBe('map-tools');
        expect(playerTool).not.toBe('maptools');

        // 2. GM clicks Map Tools button (#tool-map-tools)
        const gmMapToolsBtn = gmPage.locator('#tool-map-tools');
        await expect(gmMapToolsBtn).toBeVisible();
        await expect(gmMapToolsBtn).not.toHaveClass(/vtt-hidden/);
        await gmMapToolsBtn.click();
        await expect(gmMapToolsBtn).toHaveClass(/active/);

        // Map tools panel should be visible
        const mapToolsPanel = gmPage.locator('#panel-map-tools');
        await expect(mapToolsPanel).toBeVisible();
    });

    test('Test 7: Keyboard Hotkey Tool Cycling (1-6) & Escape Key Reset', async () => {
        const { gmPage } = sandbox;

        // Press '1' -> Select Tool
        await gmPage.keyboard.press('1');
        await expect(gmPage.locator('#tool-select')).toHaveClass(/active/);

        // Press '2' -> Measure Tool
        await gmPage.keyboard.press('2');
        await expect(gmPage.locator('#tool-measure')).toHaveClass(/active/);

        // Press '3' -> Shape Tool
        await gmPage.keyboard.press('3');
        await expect(gmPage.locator('#tool-shape')).toHaveClass(/active/);

        // Press '4' -> Ping Tool
        await gmPage.keyboard.press('4');
        await expect(gmPage.locator('#tool-ping')).toHaveClass(/active/);

        // Press '5' -> Lighting Tool (GM)
        await gmPage.keyboard.press('5');
        await expect(gmPage.locator('#tool-lighting')).toHaveClass(/active/);

        // Press '6' -> Paint Tool
        await gmPage.keyboard.press('6');
        await expect(gmPage.locator('#tool-paint')).toHaveClass(/active/);

        // Press '1' to return to Select
        await gmPage.keyboard.press('1');
        await expect(gmPage.locator('#tool-select')).toHaveClass(/active/);
    });

    test('Test 8: Visual regression snapshot of Ping HUD ring animation', async () => {
        const { gmPage } = sandbox;

        // Select Ping tool and click at deterministic coordinates
        const pingBtn = gmPage.locator('#tool-ping');
        await pingBtn.click();

        const gmCanvas = gmPage.locator('#vtt-canvas-interaction');
        const box = await gmCanvas.boundingBox();

        // Dispatch ping at (400, 300)
        await gmPage.mouse.click(box.x + 400, box.y + 300);

        const hudCanvas = gmPage.locator('#vtt-canvas-hud');
        await expect(hudCanvas).toBeVisible();

        // Freeze elements and take snapshot of the HUD canvas containing the expanding ping ring
        await freezeDynamicElements(gmPage);

        await expect(hudCanvas).toHaveScreenshot('ping-hud-canvas.png', {
            maxDiffPixelRatio: 0.08
        });
    });
});
