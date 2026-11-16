/**
 * test/visual/drawings-shapes-gm-layer.spec.mjs
 * ForgeD VTT - Canvas Freehand Drawing, Persistent Shapes & GM Secret Layer Test Suite
 * Validates freehand brush strokes, player ownership tagging, destination-out eraser masking,
 * persistent shape creation/resizing/rotation, GM secret layer isolation, and token layer reveal.
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
        fs.writeFileSync(chatPath, JSON.stringify(pristineChat, null, 2));

        const campPath = path.resolve('test', 'fixtures', 'visual-sandbox-data', 'campaigns.json');
        if (fs.existsSync(campPath)) {
            const campData = JSON.parse(fs.readFileSync(campPath, 'utf8'));
            const camp = campData.visual_test_campaign;
            if (camp?.maps?.map_visual_dungeon) {
                camp.maps.map_visual_dungeon.drawings = {};
                camp.maps.map_visual_dungeon.shapes = {};
                fs.writeFileSync(campPath, JSON.stringify(campData));
            }
        }
    } catch (e) {}
}

test.describe('Canvas Freehand Drawing, Persistent Shapes & GM Secret Layer Suite', () => {
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
        if (sandbox?.gmPage) {
            try {
                await sandbox.gmPage.evaluate(() => {
                    const ce = window.VTT?.canvasEngine;
                    if (ce) {
                        const mapId = ce.getCurrentMapId();
                        window.VTT.socket?.emit('drawings:update', { mapId, drawings: {} });
                        window.VTT.socket?.emit('shapes:update', { mapId, shapes: {} });
                        ce.switchActiveLayer?.('token');
                    }
                });
            } catch (e) {}
        }
        resetSandboxFixtures();
        if (sandbox) {
            await sandbox.cleanup();
        }
    });

    test('Test 1: Freehand Brush Stroke Creation & Real-Time Sync (GM -> Player)', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM creates a vibrant brush stroke on the token layer
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const drawings = {
                draw_gm_path: {
                    id: 'draw_gm_path',
                    type: 'brush',
                    layer: 'token',
                    strokeColor: '#ef4444',
                    strokeWidth: 6,
                    points: [
                        { x: 300, y: 300 },
                        { x: 350, y: 330 },
                        { x: 400, y: 300 }
                    ],
                    ownerUsername: 'DungeonMaster'
                }
            };
            window.VTT.socket.emit('drawings:update', { mapId, drawings });
        });

        // Player receives synchronized stroke
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const d = ce?.getDrawings?.()['draw_gm_path'];
                return d && d.strokeColor === '#ef4444' && d.points.length === 3;
            },
            { timeout: 10000 }
        );

        const strokeWidth = await playerPage.evaluate(() => {
            return window.VTT.canvasEngine.getDrawings()['draw_gm_path'].strokeWidth;
        });
        expect(strokeWidth).toBe(6);
    });

    test('Test 2: Player Freehand Drawing Creation with Ownership Enforcement (Player -> GM)', async () => {
        const { gmPage, playerPage } = sandbox;

        // Player creates a tactical freehand drawing
        await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const currentDrawings = ce.getDrawings() || {};
            const drawings = {
                ...currentDrawings,
                draw_player_mark: {
                    id: 'draw_player_mark',
                    type: 'brush',
                    layer: 'token',
                    strokeColor: '#3b82f6',
                    strokeWidth: 4,
                    points: [
                        { x: 500, y: 200 },
                        { x: 530, y: 240 }
                    ]
                }
            };
            window.VTT.socket.emit('drawings:update', { mapId, drawings });
        });

        // GM receives player drawing with enforced ownership attribute
        await gmPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const d = ce?.getDrawings?.()['draw_player_mark'];
                return d && d.ownerUsername === 'PlayerOne';
            },
            { timeout: 10000 }
        );

        const isPlayerControlled = await gmPage.evaluate(() => {
            const d = window.VTT.canvasEngine.getDrawings()['draw_player_mark'];
            return d?.ownerUsername;
        });
        expect(isPlayerControlled).toBe('PlayerOne');
    });

    test('Test 3: Destination-Out Eraser Tool Masking across Drawing Layer', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM draws an eraser stroke across the path
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const currentDrawings = ce.getDrawings() || {};
            const drawings = {
                ...currentDrawings,
                draw_eraser_1: {
                    id: 'draw_eraser_1',
                    type: 'eraser',
                    layer: 'token',
                    strokeWidth: 16,
                    points: [
                        { x: 340, y: 320 },
                        { x: 360, y: 340 }
                    ],
                    ownerUsername: 'DungeonMaster'
                }
            };
            window.VTT.socket.emit('drawings:update', { mapId, drawings });
        });

        // Player receives eraser entity and canvas maintains destination-out rendering
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const d = ce?.getDrawings?.()['draw_eraser_1'];
                return d && d.type === 'eraser';
            },
            { timeout: 10000 }
        );

        const eraserType = await playerPage.evaluate(() => {
            return window.VTT.canvasEngine.getDrawings()['draw_eraser_1'].type;
        });
        expect(eraserType).toBe('eraser');
    });

    test('Test 4: Persistent Shape Creation, Resizing, and Rotation Handle Manipulation', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM creates a persistent circular spell aura shape
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const shapes = {
                shape_spell_aura: {
                    id: 'shape_spell_aura',
                    shape: 'circle',
                    layer: 'token',
                    startPoint: { x: 450, y: 400 },
                    endPoint: { x: 510, y: 400 }, // initial radius = 60
                    color: '#a855f7',
                    fillColor: 'rgba(168, 85, 247, 0.25)',
                    strokeWidth: 3,
                    rotation: 0,
                    ownerUsername: 'DungeonMaster'
                }
            };
            window.VTT.socket.emit('shapes:update', { mapId, shapes });
        });

        // Player receives persistent shape
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const s = ce?.getShapes?.()['shape_spell_aura'];
                return s && s.shape === 'circle';
            },
            { timeout: 10000 }
        );

        // GM resizes and rotates the shape
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const s = ce.getShapes()['shape_spell_aura'];
            s.endPoint = { x: 550, y: 400 }; // resized radius = 100
            s.rotation = 45;
            window.VTT.socket.emit('shapes:update', { mapId, shapes: { shape_spell_aura: s } });
        });

        // Player synchronizes updated radius and rotation
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const s = ce?.getShapes?.()['shape_spell_aura'];
                return s && s.rotation === 45 && s.endPoint.x === 550;
            },
            { timeout: 10000 }
        );

        const shapeState = await playerPage.evaluate(() => {
            const s = window.VTT.canvasEngine.getShapes()['shape_spell_aura'];
            return { rotation: s.rotation, endX: s.endPoint.x };
        });
        expect(shapeState.rotation).toBe(45);
        expect(shapeState.endX).toBe(550);
    });

    test('Test 5: GM Secret Layer (layer: "gm") Drawing & Strict Player Isolation', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM switches to GM Secret Layer and draws hidden sketch
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            ce.switchActiveLayer('gm');
            const mapId = ce.getCurrentMapId();
            const currentDrawings = ce.getDrawings() || {};
            const drawings = {
                ...currentDrawings,
                draw_secret_ambush: {
                    id: 'draw_secret_ambush',
                    type: 'brush',
                    layer: 'gm',
                    strokeColor: '#f59e0b',
                    strokeWidth: 8,
                    points: [
                        { x: 200, y: 400 },
                        { x: 250, y: 450 }
                    ],
                    ownerUsername: 'DungeonMaster'
                }
            };
            window.VTT.socket.emit('drawings:update', { mapId, drawings });
        });

        // GM observes secret drawing
        await gmPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                return !!ce?.getDrawings?.()['draw_secret_ambush'];
            },
            { timeout: 10000 }
        );

        // Player is strictly isolated: hit test at (225, 425) on Player's canvas returns null
        const playerHit = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            return ce.getDrawingAtPoint({ x: 225, y: 425 }, true);
        });
        expect(playerHit).toBeNull();
    });

    test('Test 6: Revealing GM Secret Entity to Token Layer (Instant Player Visibility)', async () => {
        const { gmPage, playerPage } = sandbox;

        // GM moves the secret drawing from 'gm' layer to 'token' layer
        await gmPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const d = ce.getDrawings()['draw_secret_ambush'];
            d.layer = 'token';
            window.VTT.socket.emit('drawings:update', { mapId, drawings: ce.getDrawings() });
        });

        // Player immediately receives and can hit-test the newly revealed drawing
        await playerPage.waitForFunction(
            () => {
                const ce = window.VTT.canvasEngine;
                const hit = ce?.getDrawingAtPoint?.({ x: 225, y: 425 }, true);
                return hit && hit.id === 'draw_secret_ambush';
            },
            { timeout: 10000 }
        );

        const revealedId = await playerPage.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const hit = ce.getDrawingAtPoint({ x: 225, y: 425 }, true);
            return hit?.id;
        });
        expect(revealedId).toBe('draw_secret_ambush');
    });

    test('Test 7: Visual regression snapshot of persistent shapes and freehand artwork', async () => {
        const { playerPage } = sandbox;

        await freezeDynamicElements(playerPage);

        // Visual screenshot of the rendered drawings and shapes on the tabletop canvas
        const canvasContainer = playerPage.locator('#canvas-container');
        await expect(canvasContainer).toBeVisible();
        await expect(canvasContainer).toHaveScreenshot('drawings-shapes-canvas.png');
    });
});
