import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT_DIR = process.cwd();
const MOBILE_CSS_PATH = path.join(ROOT_DIR, 'vtt', 'css', 'vtt-mobile.css');
const MOBILE_ADAPTER_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'vtt-mobile-adapter.js');
const CANVAS_TOOLS_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'canvas', 'vtt-canvas-interaction-tools.js');
const MODALS_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'bootstrap', 'vtt-modals.js');
const SOCKET_SYNC_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'canvas', 'vtt-canvas-socket-sync.js');

test('Audit Remediation Fixes Suite', async (t) => {
    await t.test('Finding 1: Auto Mobile Mode unhides mobile shape sheet and maptools sheet', () => {
        assert.ok(fs.existsSync(MOBILE_CSS_PATH), 'vtt-mobile.css must exist');
        const css = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');

        // Locate @media screen and (max-width: 900px) block
        const mediaIdx = css.indexOf('@media screen and (max-width: 900px)');
        assert.ok(mediaIdx !== -1, 'Media query for mobile/tablet must exist');
        const manualOverridesIdx = css.indexOf('MANUAL UI OVERRIDES');
        const mediaSection = css.substring(mediaIdx, manualOverridesIdx !== -1 ? manualOverridesIdx : undefined);

        assert.ok(
            mediaSection.includes('#vtt-mobile-shape-sheet:not(.vtt-hidden)'),
            'Media query must display #vtt-mobile-shape-sheet when not vtt-hidden'
        );
        assert.ok(
            mediaSection.includes('#vtt-mobile-maptools-sheet:not(.vtt-hidden)'),
            'Media query must display #vtt-mobile-maptools-sheet when not vtt-hidden'
        );
    });

    await t.test('Finding 2: Floating tool panels dismiss on Escape and outside click', () => {
        const modalsJs = fs.readFileSync(MODALS_PATH, 'utf8');
        assert.ok(
            modalsJs.includes("document.querySelectorAll('.floating-tool-panel:not(.vtt-hidden)')"),
            'vtt-modals.js Escape handler must query open floating-tool-panels'
        );
        assert.ok(
            modalsJs.includes("openFloatingPanels.forEach((p) => p.classList.add('vtt-hidden'))"),
            'vtt-modals.js Escape handler must dismiss open floating-tool-panels'
        );

        const toolsJs = fs.readFileSync(CANVAS_TOOLS_PATH, 'utf8');
        assert.ok(
            toolsJs.includes("document.querySelectorAll('.floating-tool-panel:not(.vtt-hidden)')"),
            'vtt-canvas-interaction-tools.js must query open floating panels on pointerdown'
        );
        assert.ok(
            toolsJs.includes('hideAllToolPanels();'),
            'vtt-canvas-interaction-tools.js must call hideAllToolPanels on outside click'
        );
    });

    await t.test('Finding 3: Desktop Map Tools panel is hidden on mobile viewports', () => {
        const css = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');
        assert.ok(
            css.includes('#panel-measure-config,\n    #panel-map-tools {\n        display: none !important;'),
            'Desktop map tools panel must be hidden on mobile media query'
        );

        const adapterJs = fs.readFileSync(MOBILE_ADAPTER_PATH, 'utf8');
        assert.ok(
            adapterJs.includes("const desktopMapTools = document.getElementById('panel-map-tools');"),
            'closeAllDrawers must ensure desktop map tools panel is closed'
        );
    });

    await t.test('Finding 4 & Risk 1: Layers and Lighting panels docked as bottom sheets on mobile', () => {
        const css = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');
        assert.ok(
            css.includes('#panel-layers-config:not(.vtt-hidden),\n    #panel-lighting-config:not(.vtt-hidden)'),
            'Layers and Lighting panels must be styled for mobile viewports'
        );
        assert.ok(
            css.includes('bottom: var(--total-bottom-space, 56px) !important;'),
            'Panels must be docked to bottom space'
        );
        assert.ok(
            css.includes('max-height: 70dvh !important;'),
            'Panels must constrain max-height to 70dvh to avoid vertical clipping'
        );
    });

    await t.test('Finding 5: Mobile tools FAB and shape pill use safe-area-inset', () => {
        const css = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');
        assert.ok(
            css.includes('top: calc(14px + env(safe-area-inset-top, 0px)) !important;'),
            'Tools FAB must use safe-area-inset-top'
        );
        assert.ok(
            css.includes('left: calc(14px + env(safe-area-inset-left, 0px)) !important;'),
            'Tools FAB must use safe-area-inset-left'
        );
        assert.ok(
            css.includes('left: calc(68px + env(safe-area-inset-left, 0px)) !important;'),
            'Shape pill must use safe-area-inset-left'
        );
    });

    await t.test('Finding 6: Floating combat pill synchronizes with full initiative drawer visibility', () => {
        const adapterJs = fs.readFileSync(MOBILE_ADAPTER_PATH, 'utf8');
        assert.ok(
            adapterJs.includes("initContainer.classList.contains('mobile-init-open')") &&
                adapterJs.includes("!initContainer.classList.contains('vtt-hidden')"),
            'updateFloatingCombatPill must check if initiative drawer is open'
        );
        assert.ok(
            adapterJs.includes("if (mobileCombatPill) mobileCombatPill.classList.add('vtt-hidden');"),
            'openMobileInitiativeDrawer must hide the floating combat pill'
        );
    });

    await t.test('Risk 2: Cross-map ping filter prevents drawing pings from other maps', () => {
        const socketJs = fs.readFileSync(SOCKET_SYNC_PATH, 'utf8');
        assert.ok(
            socketJs.includes('if (data && data.mapId && ctx.currentMapId && data.mapId !== ctx.currentMapId) return;'),
            'socket map:pinged handler must filter pings matching currentMapId'
        );
    });
});
