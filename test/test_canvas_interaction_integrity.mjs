/**
 * test_canvas_interaction_integrity.mjs
 * Canvas Interaction & Submodule Integrity Verification.
 * Standardized with node:test and centralized test/helpers/ infrastructure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as espree from 'espree';
import * as escope from 'eslint-scope';

import { setupPointerInteraction } from '../vtt/js/canvas/vtt-canvas-interaction.js';
import { setupKeyboardShortcuts } from '../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js';
import {
    handleMapToolMouseDown,
    handleMapToolMouseMove,
    handleMapToolMouseUp
} from '../vtt/js/canvas/vtt-canvas-map-tools.js';

import { setupVttEnvironment, teardownVttEnvironment } from './helpers/vtt-environment.mjs';
import { createMockToken } from './helpers/factories.mjs';

test('Canvas Interaction & Submodule Integrity', async (t) => {
    t.after(() => {
        teardownVttEnvironment();
    });

    // ============================================================================
    // Suite 1: AST Scope Analysis on Canvas Submodules
    // ============================================================================
    await t.test('Suite 1: AST Scope Analysis on Canvas Submodules', () => {
        const standardGlobals = new Set([
            'Array',
            'Boolean',
            'Date',
            'Error',
            'Function',
            'JSON',
            'Math',
            'Number',
            'Object',
            'Promise',
            'RegExp',
            'Set',
            'Map',
            'WeakMap',
            'Proxy',
            'Reflect',
            'String',
            'Symbol',
            'TypeError',
            'RangeError',
            'ReferenceError',
            'SyntaxError',
            'console',
            'document',
            'window',
            'globalThis',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'parseFloat',
            'parseInt',
            'isNaN',
            'isFinite',
            'encodeURIComponent',
            'decodeURIComponent',
            'encodeURI',
            'decodeURI',
            'undefined',
            'NaN',
            'Infinity',
            'URL',
            'Blob',
            'File',
            'FileReader',
            'FormData',
            'fetch',
            'Headers',
            'Request',
            'Response',
            'AbortController',
            'performance',
            'crypto',
            'CustomEvent',
            'Event',
            'MouseEvent',
            'KeyboardEvent',
            'Image',
            'Audio',
            'HTMLCanvasElement',
            'CanvasRenderingContext2D',
            'DOMParser',
            'prompt',
            'alert',
            'confirm',
            'localStorage',
            'sessionStorage',
            'Uint8Array',
            'Uint16Array',
            'Uint32Array',
            'Int8Array',
            'Int16Array',
            'Int32Array',
            'Float32Array',
            'Float64Array',
            'DOMMatrix',
            'MutationObserver',
            'ResizeObserver',
            'IntersectionObserver',
            'BroadcastChannel',
            'URLSearchParams',
            'getComputedStyle',
            'navigator',
            'structuredClone',
            'THREE',
            'CANNON',
            'DOMPurify',
            'JqueryUtil',
            'Parser',
            'Renderer',
            'io',
            'define',
            'VTT',
            'vtt'
        ]);

        function getJsFiles(dir) {
            let results = [];
            if (!fs.existsSync(dir)) return results;
            for (const f of fs.readdirSync(dir)) {
                const full = path.join(dir, f);
                if (fs.statSync(full).isDirectory()) results.push(...getJsFiles(full));
                else if (f.endsWith('.js')) results.push(full);
            }
            return results;
        }

        const canvasFiles = getJsFiles('vtt/js/canvas');
        assert.ok(canvasFiles.length >= 10, 'Expected at least 10 canvas JS files to be audited');

        let totalUnresolved = 0;
        const failureDetails = [];

        for (const file of canvasFiles) {
            const code = fs.readFileSync(file, 'utf8');
            let ast;
            try {
                ast = espree.parse(code, {
                    ecmaVersion: 'latest',
                    sourceType: 'module',
                    loc: true,
                    range: true
                });
            } catch (err) {
                failureDetails.push({ file, error: `Parse error: ${err.message}` });
                totalUnresolved++;
                continue;
            }

            const sm = escope.analyze(ast, {
                ecmaVersion: 2022,
                sourceType: 'module'
            });

            const unres = new Set();
            for (const ref of sm.globalScope.through) {
                if (!standardGlobals.has(ref.identifier.name)) {
                    unres.add(ref.identifier.name);
                }
            }

            if (unres.size > 0) {
                totalUnresolved += unres.size;
                failureDetails.push({ file, unresolved: [...unres].sort() });
            }
        }

        assert.strictEqual(
            totalUnresolved,
            0,
            `Expected 0 unresolved canvas variables across all ${canvasFiles.length} canvas files, found ${totalUnresolved}: ${JSON.stringify(failureDetails, null, 2)}`
        );
    });

    // ============================================================================
    // Suite 2: Simulated Pointer Interaction (Pan, Select, Drag, Box Select)
    // ============================================================================
    await t.test('Suite 2: Simulated Pointer Interaction (Pan, Select, Drag, Box Select)', () => {
        const dom = setupVttEnvironment({
            html: `<!DOCTYPE html>
            <html>
            <body>
                <div id="vtt-canvas-viewport" style="width: 1000px; height: 800px; position: relative;">
                    <div id="canvas-container" style="position: absolute; top: 0; left: 0;">
                        <canvas id="vtt-canvas-interaction" width="1000" height="800"></canvas>
                    </div>
                </div>
                <div id="vtt-coordinates-indicator">
                    <span id="val-coord-x">0</span>
                    <span id="val-coord-y">0</span>
                </div>
            </body>
            </html>`
        });

        const canvasInteractionEl = dom.window.document.getElementById('vtt-canvas-interaction');
        canvasInteractionEl.getBoundingClientRect = () => ({
            top: 0,
            left: 0,
            width: 1000,
            height: 800,
            right: 1000,
            bottom: 800,
            x: 0,
            y: 0,
            toJSON: () => {}
        });

        const mockWarrior = createMockToken({
            id: 'tok-warrior',
            name: 'Fighter',
            x: 100,
            y: 100,
            isPlayer: true
        });

        const mockTokens = {
            'tok-warrior': mockWarrior
        };

        let emittedTokenUpdates = null;
        let renderAllCallCount = 0;
        let containerTransformUpdated = false;

        const ctx = {
            vtt: {
                role: 'GM',
                username: 'DungeonMaster',
                socket: { emit: () => {} }
            },
            canvasInteraction: canvasInteractionEl,
            tokens: mockTokens,
            walls: [],
            lights: [],
            notes: [],
            shapes: {},
            drawings: {},
            traps: [],
            portals: [],
            selectedTokenIds: new Set(),
            selectedShapeIds: new Set(),
            selectedDrawingIds: new Set(),
            selectedTokenId: null,
            dragTargetId: null,
            panX: 0,
            panY: 0,
            zoom: 1.0,
            isPanning: false,
            hasPanned: false,
            activeTool: 'select',
            activeLayer: 'token',
            currentMapId: 'map-dungeon-1',
            tokenDragOriginalPositions: {},
            renderAll: () => {
                renderAllCallCount++;
            },
            updateContainerTransform: () => {
                containerTransformUpdated = true;
            },
            updateCoordinateDisplay: (coords) => {
                const xEl = dom.window.document.getElementById('val-coord-x');
                const yEl = dom.window.document.getElementById('val-coord-y');
                if (xEl && coords) xEl.textContent = Math.round(coords.x);
                if (yEl && coords) yEl.textContent = Math.round(coords.y);
            },
            getCanvasMouseCoords: (e) => ({
                x: (e.clientX - ctx.panX) / ctx.zoom,
                y: (e.clientY - ctx.panY) / ctx.zoom
            }),
            getTokenAtPoint: (pt) => {
                for (const id in ctx.tokens) {
                    const t = ctx.tokens[id];
                    if (pt.x >= t.x && pt.x <= t.x + 50 && pt.y >= t.y && pt.y <= t.y + 50) {
                        return t;
                    }
                }
                return null;
            },
            isTokenControlledByPlayer: () => true,
            emitTokenUpdates: (t) => {
                emittedTokenUpdates = t;
            }
        };

        dom.window.emitTokenUpdates = (t) => {
            emittedTokenUpdates = t;
        };

        setupPointerInteraction(ctx);

        // 2.1 Right-Click Panning
        const panDownEvent = new dom.window.MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: 200,
            clientY: 150
        });
        canvasInteractionEl.dispatchEvent(panDownEvent);
        assert.strictEqual(ctx.isPanning, true);
        assert.strictEqual(ctx.hasPanned, false);

        const panMoveEvent = new dom.window.MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: 260,
            clientY: 210
        });
        dom.window.dispatchEvent(panMoveEvent);
        assert.strictEqual(ctx.isPanning, true);
        assert.strictEqual(ctx.hasPanned, true);
        assert.strictEqual(ctx.panX, 60);
        assert.strictEqual(ctx.panY, 60);

        const panUpEvent = new dom.window.MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: 260,
            clientY: 210
        });
        dom.window.dispatchEvent(panUpEvent);
        assert.strictEqual(ctx.isPanning, false);
        assert.strictEqual(ctx.panX, 60);

        // 2.2 Left-Click Token Selection & Dragging
        ctx.panX = 0;
        ctx.panY = 0;
        const tokenDownEvent = new dom.window.MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 120,
            clientY: 120
        });
        canvasInteractionEl.dispatchEvent(tokenDownEvent);
        assert.ok(ctx.selectedTokenIds.has('tok-warrior'));
        assert.strictEqual(ctx.selectedTokenId, 'tok-warrior');
        assert.strictEqual(ctx.dragTargetId, 'tok-warrior');

        const tokenDragEvent = new dom.window.MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: 150,
            clientY: 150
        });
        dom.window.dispatchEvent(tokenDragEvent);
        assert.strictEqual(ctx.tokens['tok-warrior'].x, 130);
        assert.strictEqual(ctx.tokens['tok-warrior'].y, 130);

        const tokenUpEvent = new dom.window.MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 150,
            clientY: 150
        });
        dom.window.dispatchEvent(tokenUpEvent);
        assert.strictEqual(ctx.dragTargetId, null);

        // 2.3 Empty Canvas Box Selection
        const boxDownEvent = new dom.window.MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 400,
            clientY: 400
        });
        canvasInteractionEl.dispatchEvent(boxDownEvent);
        assert.strictEqual(ctx.isBoxSelecting, true);
        assert.strictEqual(ctx.selectedTokenIds.size, 0);

        const boxMoveEvent = new dom.window.MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: 500,
            clientY: 500
        });
        dom.window.dispatchEvent(boxMoveEvent);
        assert.strictEqual(ctx.boxSelectEnd.x, 500);
        assert.strictEqual(ctx.boxSelectEnd.y, 500);

        const boxUpEvent = new dom.window.MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 500,
            clientY: 500
        });
        dom.window.dispatchEvent(boxUpEvent);
        assert.strictEqual(ctx.isBoxSelecting, false);

        // 2.4 Keyboard Shortcuts Integration
        setupKeyboardShortcuts(ctx);
        ctx.panX = 100;
        ctx.panY = 100;

        const panKeyEvent = new dom.window.KeyboardEvent('keydown', {
            code: 'Numpad6',
            bubbles: true,
            cancelable: true
        });
        dom.window.dispatchEvent(panKeyEvent);
        assert.ok(ctx.panX !== 100, 'Numpad6 keydown should pan camera ctx.panX');

        ctx.selectedTokenIds.add('tok-warrior');
        const initialTokenX = ctx.tokens['tok-warrior'].x;
        const nudgeKeyEvent = new dom.window.KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true
        });
        dom.window.dispatchEvent(nudgeKeyEvent);
        assert.strictEqual(ctx.tokens['tok-warrior'].x, initialTokenX + 50);
    });

    // ============================================================================
    // Suite 3: Bridge Context Getter/Setter Contract Integrity Check
    // ============================================================================
    await t.test('Suite 3: Bridge Context Contract (Missing Setters Prevention)', () => {
        const canvasMainContent = fs.readFileSync('vtt/js/vtt-canvas.js', 'utf8');

        // Verify interactionContext
        const intStart = canvasMainContent.indexOf('const interactionContext = {');
        const intEnd = canvasMainContent.indexOf('setupPointerInteractionExt(interactionContext);', intStart);
        assert.ok(intStart > 0 && intEnd > intStart, 'interactionContext block must be present in vtt-canvas.js');
        const interactionBlock = canvasMainContent.substring(intStart, intEnd);

        const interactionSubmoduleJs = fs.readFileSync('vtt/js/canvas/vtt-canvas-interaction.js', 'utf8');
        const interactionAssigns = [
            ...new Set([...interactionSubmoduleJs.matchAll(/ctx\.([a-zA-Z0-9_]+)\s*=/g)].map((m) => m[1]))
        ];

        const intGetters = new Set([...interactionBlock.matchAll(/get\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));
        const intSetters = new Set([...interactionBlock.matchAll(/set\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));

        const intFailures = interactionAssigns.filter((p) => intGetters.has(p) && !intSetters.has(p));
        assert.strictEqual(
            intFailures.length,
            0,
            `Properties assigned in vtt-canvas-interaction.js have getters but missing setters in interactionContext: ${intFailures.join(', ')}`
        );

        // Verify clipboardContext
        const clipStart = canvasMainContent.indexOf('const clipboardContext = {');
        const clipEnd = canvasMainContent.indexOf('setupKeyboardShortcutsExt(clipboardContext);', clipStart);
        assert.ok(clipStart > 0 && clipEnd > clipStart, 'clipboardContext block must be present in vtt-canvas.js');
        const clipBlock = canvasMainContent.substring(clipStart, clipEnd);

        const clipSubmoduleJs = fs.readFileSync('vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js', 'utf8');
        const clipAssigns = [...new Set([...clipSubmoduleJs.matchAll(/ctx\.([a-zA-Z0-9_]+)\s*=/g)].map((m) => m[1]))];

        const clipGetters = new Set([...clipBlock.matchAll(/get\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));
        const clipSetters = new Set([...clipBlock.matchAll(/set\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));

        const clipFailures = clipAssigns.filter((p) => clipGetters.has(p) && !clipSetters.has(p));
        assert.strictEqual(
            clipFailures.length,
            0,
            `Properties assigned in vtt-canvas-clipboard-shortcuts.js have getters but missing setters in clipboardContext: ${clipFailures.join(', ')}`
        );
    });

    // ============================================================================
    // Suite 4: Token Grid Snapping & Portal Handle Hit Contracts
    // ============================================================================
    await t.test('Suite 4: Token Grid Snapping & Portal Handles Contract', async () => {
        const { snapToGrid } = await import('../vtt/js/canvas/vtt-canvas-grid-renderer.js');
        const { getPortalHandleUnderMouse } = await import('../vtt/js/canvas/vtt-canvas-map-tools.js');

        const sampleGrid = { size: 50, scale: 1, offsetX: 0, offsetY: 0, type: 'square' };

        const snapStandard = snapToGrid(123, 187, true, sampleGrid);
        const snapSwapped = snapToGrid(123, 187, sampleGrid, true);
        assert.strictEqual(snapStandard.x, 100);
        assert.strictEqual(snapStandard.y, 200);
        assert.deepStrictEqual(snapStandard, snapSwapped);

        const samplePortal = {
            id: 'portal-1',
            type: 'portal',
            shape: 'line',
            geom: { x1: 100, y1: 100, x2: 300, y2: 100 },
            facingAngle: 90,
            isRadial: false
        };
        const portalHit = getPortalHandleUnderMouse({ x: 100, y: 100 }, 20, {
            portals: [samplePortal],
            selectedMapToolItem: samplePortal,
            activeLayer: 'portals',
            activeTool: 'maptools',
            zoom: 1,
            isGM: true
        });
        assert.ok(portalHit);
        assert.strictEqual(portalHit.type, 'resize');
    });

    // ============================================================================
    // Suite 5: Shortcuts, Portal Reflection Scaling & Chatcard Action Wiring
    // ============================================================================
    await t.test('Suite 5: Shortcuts, Portal Reflection Scaling & Chatcard Actions', async () => {
        const dom = setupVttEnvironment();

        const warrior = createMockToken({
            id: 'tok-warrior',
            rotation: 0,
            flipX: false,
            flipY: false
        });

        const ctx = {
            selectedTokenIds: new Set(['tok-warrior']),
            tokens: { 'tok-warrior': warrior },
            isTokenControlledByPlayer: () => true,
            renderAll: () => {}
        };

        setupKeyboardShortcuts(ctx);

        // Press 'e' (rotate +45 deg)
        dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
        assert.strictEqual(ctx.tokens['tok-warrior'].rotation, 45);

        // Press 'q' with Shift (rotate -5 deg)
        dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'q', shiftKey: true, bubbles: true }));
        assert.strictEqual(ctx.tokens['tok-warrior'].rotation, 40);

        // Press 'f' (flip horizontal true)
        dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'f', bubbles: true }));
        assert.strictEqual(ctx.tokens['tok-warrior'].flipX, true);

        // Press 'r' (flip vertical true)
        dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        assert.strictEqual(ctx.tokens['tok-warrior'].flipY, true);

        // Reflected Token Dimensions in drawTargetRoomContent
        const { drawTargetRoomContent } = await import('../vtt/js/canvas/vtt-canvas-portals.js');
        let requestedDimsForToken = null;
        const mockCtx = new Proxy(
            {},
            {
                get: (target, prop) => {
                    if (typeof prop === 'string' && prop.startsWith('set')) return () => {};
                    return () => {};
                },
                set: () => true
            }
        );

        const largeToken = createMockToken({ id: 'large-ogre', size: 2, x: 200, y: 200 });
        drawTargetRoomContent(
            mockCtx,
            { grid: { size: 50, scale: 1 }, tokens: [largeToken] },
            'map-1',
            2000,
            1500,
            [largeToken],
            [],
            { x: 500, y: 500 },
            { x: 500, y: 500 },
            {
                getTokenDrawDimensions: (t) => {
                    requestedDimsForToken = t.id;
                    return { drawW: 100, drawH: 100, tokenRadius: 50 };
                }
            }
        );
        assert.strictEqual(requestedDimsForToken, 'large-ogre');

        // handleCardAction with selectedTokenIds wiring
        const { handleCardAction } = await import('../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js');
        let appliedDamageTotal = 0;
        const testMonster = createMockToken({ id: 'tok-target', name: 'Goblin', hp: 20, maxHp: 20 });
        handleCardAction({ dmgRolls: [{ roll: { total: 10 }, type: 'slashing' }] }, 'full', {
            vtt: { role: 'GM' },
            selectedTokenIds: new Set(['tok-target']),
            tokens: { 'tok-target': testMonster },
            syncHpFn: (tokensList) => {
                appliedDamageTotal = 20 - tokensList[0].hp;
            }
        });
        assert.strictEqual(appliedDamageTotal, 10);
    });
});
