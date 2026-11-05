import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCampaignTemplate } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Error Discovery Fixes: Tier 1 & 2 Verification Suite', async (t) => {
    await t.test('1. Role-Permissive Assets Upload Sandboxes Non-GMs to /players', () => {
        const assetsRouteSrc = fs.readFileSync(path.join(rootDir, 'server', 'routes', 'assets.js'), 'utf8');

        // Check isAuthorizedGmOrSecret imported and used
        assert.ok(assetsRouteSrc.includes('isAuthorizedGmOrSecret'), 'Must import isAuthorizedGmOrSecret in assets router');

        // Check non-GM targetPath enforcement
        assert.ok(
            assetsRouteSrc.includes("targetPath = path.join(ASSETS_DIR, 'players')"),
            'Non-GMs must be sandboxed strictly into ASSETS_DIR/players'
        );

        // Check that /assets/upload does not have verifyGmOrSecret middleware blocking players
        assert.ok(
            !assetsRouteSrc.includes("assetsRouter.post('/assets/upload', verifyGmOrSecret"),
            '/assets/upload must not reject non-GMs with verifyGmOrSecret'
        );
    });

    await t.test('2. Campaign Duplication & Template Preserves Standard Initiative Schema', () => {
        const campRouteSrc = fs.readFileSync(path.join(rootDir, 'server', 'routes', 'campaigns.js'), 'utf8');
        assert.ok(
            !campRouteSrc.includes('cloned.initiative = [];'),
            'cloned.initiative must not be reset to an empty array'
        );
        assert.ok(
            campRouteSrc.includes('combatants: []') && campRouteSrc.includes('currentRound: 1'),
            'cloned.initiative must serialize standard object schema'
        );

        const template = createCampaignTemplate('test_camp', 'Test Campaign');
        assert.ok(template.initiative && typeof template.initiative === 'object' && !Array.isArray(template.initiative), 'Template initiative must be an object');
        assert.deepEqual(template.initiative.combatants, [], 'Initiative combatants must default to empty array');
        assert.equal(template.initiative.currentRound, 1, 'Initiative currentRound must default to 1');
        assert.equal(template.initiative.activeTurnIndex, -1, 'Initiative activeTurnIndex must default to -1');
    });

    await t.test('3. Mobile Slideout Tabs Offset to 130px to Clear FAB and Menu', () => {
        const mobileCss = fs.readFileSync(path.join(rootDir, 'vtt', 'css', 'vtt-mobile.css'), 'utf8');
        const creatureCss = fs.readFileSync(path.join(rootDir, 'vtt', 'css', 'components', 'creature-sheet.css'), 'utf8');

        assert.match(
            mobileCss,
            /\.slideout-tabs-container\s*\{[^}]*top:\s*130px\s*!important/s,
            'vtt-mobile.css must position slideout tabs at top: 130px !important'
        );
        assert.match(
            creatureCss,
            /\.slideout-tabs-container\s*\{[^}]*top:\s*130px\s*!important/s,
            'creature-sheet.css must position slideout tabs at top: 130px !important on touch viewports'
        );
    });

    await t.test('4. Mobile Paint Studio Exposes Grid Snap & Fill Mode Controls and Canvas Engine Methods', () => {
        const indexHtml = fs.readFileSync(path.join(rootDir, 'vtt', 'index.html'), 'utf8');
        const mobileAdapterJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-mobile-adapter.js'), 'utf8');
        const vttCanvasJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-canvas.js'), 'utf8');

        // Check HTML elements inside mobile paint drawer
        assert.ok(indexHtml.includes('id="btn-mobile-paint-gridsnap"'), 'HTML must include mobile grid snap button');
        assert.ok(indexHtml.includes('class="mobile-paint-fillmode-btns"'), 'HTML must include mobile fill mode buttons container');
        assert.ok(indexHtml.includes('data-fillmode="stroke"'), 'HTML must include stroke fill mode');
        assert.ok(indexHtml.includes('data-fillmode="both"'), 'HTML must include both fill mode');
        assert.ok(indexHtml.includes('data-fillmode="fill"'), 'HTML must include fill only mode');

        // Check canvasEngine exposes setters
        assert.ok(vttCanvasJs.includes('setPaintGridSnap:'), 'vttCanvas must expose setPaintGridSnap');
        assert.ok(vttCanvasJs.includes('setPaintFillMode:'), 'vttCanvas must expose setPaintFillMode');

        // Check mobile adapter wires listeners
        assert.ok(mobileAdapterJs.includes('btn-mobile-paint-gridsnap'), 'Mobile adapter must wire grid snap button');
        assert.ok(mobileAdapterJs.includes('mobile-paint-fillmode-btn'), 'Mobile adapter must wire fill mode buttons');
    });

    await t.test('5. Handout Importer Mobile Live Preview Includes Direct Selection Toggle', () => {
        const indexHtml = fs.readFileSync(path.join(rootDir, 'vtt', 'index.html'), 'utf8');
        const handoutsJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-handouts.js'), 'utf8');

        assert.ok(
            indexHtml.includes('id="btn-import-preview-toggle-select"'),
            'HTML preview pane header must include preview toggle selection button'
        );
        assert.ok(
            handoutsJs.includes('btn-import-preview-toggle-select'),
            'vtt-handouts.js must bind preview selection toggle button'
        );
        assert.ok(
            handoutsJs.includes('Included in Import') && handoutsJs.includes('Include in Import'),
            'vtt-handouts.js must toggle button state between Included and Include in Import'
        );
    });

    await t.test('6. setMapBackground Broadcasts Token Updates Across Clients', () => {
        const cameraJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'canvas', 'vtt-canvas-camera.js'), 'utf8');

        assert.ok(
            cameraJs.includes('context.emitTokenUpdates') || cameraJs.includes("vtt.socket.emit('token:update'"),
            'setMapBackground must broadcast updated background token to prevent player desync'
        );
    });
});

