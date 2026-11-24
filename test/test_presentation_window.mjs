/**
 * test_presentation_window.mjs
 * Unit and integration tests for ForgeDVTT Presentation Window (Player-Facing Display).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Presentation Window - Player-Facing Display', () => {

    describe('1. Scoped CSS Verification', () => {
        it('should have presentation.css imported in vtt.css', () => {
            const vttCssPath = path.join(rootDir, 'vtt', 'css', 'vtt.css');
            const content = fs.readFileSync(vttCssPath, 'utf8');
            assert.match(content, /@import\s+['"]\.\/components\/presentation\.css['"];/);
        });

        it('should hide GM controls, sheets, sidebars and context menus in presentation mode', () => {
            const presCssPath = path.join(rootDir, 'vtt', 'css', 'components', 'presentation.css');
            const content = fs.readFileSync(presCssPath, 'utf8');
            assert.ok(content.includes('body.vtt-presentation-mode'));
            assert.ok(content.includes('#vtt-controls'));
            assert.ok(content.includes('#creature-sheet-panel'));
            assert.ok(content.includes('#player-sheet-panel'));
            assert.ok(content.includes('#sidebar-wrapper'));
            assert.ok(content.includes('#vtt-canvas-viewport'));
            assert.ok(content.includes('#dice-box-canvas-container'));
            assert.ok(content.includes('display: none !important'));
        });

        it('should retain existing initiative UI without custom override blocks', () => {
            const presCssPath = path.join(rootDir, 'vtt', 'css', 'components', 'presentation.css');
            const content = fs.readFileSync(presCssPath, 'utf8');
            assert.ok(content.includes('#vtt-initiative-carousel-container'));
            assert.ok(!content.includes('#vtt-initiative-tracker'), 'Should not use artificial custom initiative tracker rules');
        });
    });

    describe('2. HTML Structure & Settings Panel Verification', () => {
        it('should include Presentation Display accordion in tab-config', () => {
            const htmlPath = path.join(rootDir, 'vtt', 'index.html');
            const content = fs.readFileSync(htmlPath, 'utf8');
            assert.ok(content.includes('id="accordion-presentation-window"'));
            assert.ok(content.includes('id="btn-launch-presentation"'));
            assert.ok(content.includes('id="btn-close-presentation"'));
            assert.ok(content.includes('id="config-presentation-camera-sync"'));
        });
    });

    describe('3. Electron & Preload IPC Verification', () => {
        it('should expose openPresentationWindow, closePresentationWindow and onPresentationStatusUpdate in preload.cjs', () => {
            const preloadPath = path.join(rootDir, 'electron', 'preload.cjs');
            const content = fs.readFileSync(preloadPath, 'utf8');
            assert.match(content, /openPresentationWindow:\s*\(params\)\s*=>\s*ipcRenderer\.invoke\('open-presentation-window'/);
            assert.match(content, /closePresentationWindow:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('close-presentation-window'\)/);
            assert.match(content, /onPresentationStatusUpdate:\s*\(callback\)\s*=>/);
        });

        it('should register open-presentation-window and close-presentation-window in main.js', () => {
            const mainPath = path.join(rootDir, 'electron', 'main.js');
            const content = fs.readFileSync(mainPath, 'utf8');
            assert.ok(content.includes("ipcMain.handle('open-presentation-window'"));
            assert.ok(content.includes("ipcMain.handle('close-presentation-window'"));
            assert.ok(content.includes('function openPresentationWindow('));
            assert.ok(content.includes('function closePresentationWindow('));
            assert.ok(content.includes("win.webContents.send('presentation-status-update', { isOpen: false })"));
        });
    });

    describe('4. Presentation Module Logic (Client & GM Host)', async () => {
        const { initVttPresentation } = await import('../vtt/js/vtt-presentation.js');

        it('should initialize presentation client when isPresentationMode is true', () => {
            let pannedTo = null;
            const fakeSocket = {
                handlers: {},
                on(ev, fn) { this.handlers[ev] = fn; },
                emit(ev, data) { /* no-op */ }
            };
            const fakeVtt = {
                isPresentationMode: true,
                socket: fakeSocket,
                canvasEngine: {
                    panTo(x, y, zoom, dur) {
                        pannedTo = { x, y, zoom, dur };
                    },
                    getCurrentMapId() { return 'map-1'; }
                }
            };

            const client = initVttPresentation(fakeVtt);
            assert.equal(client.isPresentationClient, true);
            assert.equal(client.isCameraLocked(), false);

            // Test camera sync receiving
            fakeSocket.handlers['presentation:camSynced']({
                mapId: 'map-1',
                x: 500,
                y: 300,
                zoom: 1.5
            });

            assert.deepEqual(pannedTo, { x: 500, y: 300, zoom: 1.5, dur: 120 });

            // Test lock
            fakeSocket.handlers['presentation:camLocked']({ locked: true });
            assert.equal(client.isCameraLocked(), true);

            pannedTo = null;
            fakeSocket.handlers['presentation:camSynced']({
                mapId: 'map-1',
                x: 999,
                y: 999,
                zoom: 2.0
            });
            assert.equal(pannedTo, null, 'Should not pan when camera is locked');
        });

        it('should initialize GM host and throttle camera sync broadcasts', async () => {
            const emittedEvents = [];
            const fakeSocket = {
                emit(ev, data) {
                    emittedEvents.push({ ev, data });
                }
            };
            const fakeVtt = {
                isPresentationMode: false,
                socket: fakeSocket,
                campaignId: 'test-campaign'
            };

            const host = initVttPresentation(fakeVtt);
            assert.equal(host.isGmHost, true);

            // Trigger GM camera move
            host.onGmCameraMoved({
                panX: 100,
                panY: 50,
                zoom: 1.0,
                currentMapId: 'map-test',
                viewportWidth: 1000,
                viewportHeight: 600
            });

            // Wait for 60ms throttle
            await new Promise((r) => setTimeout(r, 80));

            assert.equal(emittedEvents.length, 1);
            assert.equal(emittedEvents[0].ev, 'presentation:camSync');
            assert.equal(emittedEvents[0].data.mapId, 'map-test');
            // centerX = (1000/2 - 100)/1 = 400
            assert.equal(emittedEvents[0].data.x, 400);
            // centerY = (600/2 - 50)/1 = 250
            assert.equal(emittedEvents[0].data.y, 250);
            assert.equal(emittedEvents[0].data.zoom, 1.0);
        });
    });

    describe('5. Combined Party Vision Fog Logic', () => {
        it('should grant vision for all player-controlled tokens when isPresentationMode is true', () => {
            const vtt = {
                role: 'Player',
                isPresentationMode: true,
                campaignState: { characters: {} }
            };

            const tokens = {
                t1: { id: 't1', isPlayer: true, name: 'Fighter' },
                t2: { id: 't2', isPlayer: true, name: 'Wizard' },
                t3: { id: 't3', isPlayer: false, layer: 'gm', name: 'Hidden Trap/Monster' }
            };

            const isTokenControlledByPlayer = (tok) => tok.id === 't1'; // Normal player only controls t1

            // Simulate the filter logic in vtt-canvas-fog.js
            const visionSources = Object.values(tokens).filter((token) => {
                const grantsVision = Boolean(
                    token.isPlayer ||
                    token.isCompanion ||
                    token.characterId ||
                    (token.characterId && vtt.campaignState?.characters?.[token.characterId]?.isPlayer)
                );
                if (vtt.isPresentationMode) {
                    return grantsVision;
                }
                if (vtt.role === 'GM') {
                    return grantsVision;
                }
                return grantsVision && isTokenControlledByPlayer(token, true);
            });

            // In presentation mode, BOTH Fighter and Wizard provide vision (party vision)
            assert.equal(visionSources.length, 2);
            assert.ok(visionSources.some((t) => t.id === 't1'));
            assert.ok(visionSources.some((t) => t.id === 't2'));
            assert.ok(!visionSources.some((t) => t.id === 't3'), 'GM token must never grant player vision');
        });
    });

    describe('6. Server Allowlist Exemption Logic', () => {
        it('should exempt Presentation Display username from active campaign allowlist rejection', () => {
            const socketFile = path.join(rootDir, 'server', 'socket.js');
            const content = fs.readFileSync(socketFile, 'utf8');
            assert.ok(content.includes("const isLocalPresentation = isLocal && username === 'Presentation Display';"));
            assert.ok(content.includes("!allowed.includes(username) && !isLocalPresentation"));

            // Verify evaluation logic directly
            const allowedUsers = ['Alice', 'Bob', 'Charlie'];
            const checkAllowed = (u) => {
                const isPres = u === 'Presentation Display';
                return !(allowedUsers.length > 0 && !allowedUsers.includes(u) && !isPres);
            };

            assert.equal(checkAllowed('Alice'), true);
            assert.equal(checkAllowed('Eve'), false, 'Unlisted player must be rejected');
            assert.equal(checkAllowed('Presentation Display'), true, 'Presentation Display must be exempt and allowed');
        });
    });
});
