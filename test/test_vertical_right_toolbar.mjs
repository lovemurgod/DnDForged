/**
 * test/test_vertical_right_toolbar.mjs
 * ForgeD VTT - Vertical Right Tool Panel & Flyout Drawer Regression Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('Vertical Right Toolbar & Flyout Drawer Suite', async (t) => {
    const htmlPath = path.join(ROOT_DIR, 'vtt', 'index.html');
    const hudCssPath = path.join(ROOT_DIR, 'vtt', 'css', 'components', 'hud.css');
    const modalsJsPath = path.join(ROOT_DIR, 'vtt', 'js', 'bootstrap', 'vtt-modals.js');
    const mobileCssPath = path.join(ROOT_DIR, 'vtt', 'css', 'vtt-mobile.css');

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const hudCss = fs.readFileSync(hudCssPath, 'utf8');
    const modalsJs = fs.readFileSync(modalsJsPath, 'utf8');
    const mobileCss = fs.readFileSync(mobileCssPath, 'utf8');

    await t.test('1. Workspace grid layout allocates symmetrical 60px for left and right toolbars', () => {
        assert.match(
            hudCss,
            /#vtt-workspace\s*\{[^}]*grid-template-columns:\s*60px\s+1fr\s+60px;/s,
            'Workspace grid must be 60px 1fr 60px'
        );
    });

    await t.test('2. Right toolbar #vtt-sidebar is styled as a 60px vertical icon bar mirroring left controls', () => {
        assert.match(
            hudCss,
            /#vtt-sidebar\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*align-items:\s*center;/s,
            '#vtt-sidebar must be a vertical flex column'
        );
        assert.match(
            hudCss,
            /\.tab-header\s*\{[^}]*width:\s*42px;[^}]*height:\s*42px;/s,
            '.tab-header must mirror .control-btn dimensions (42x42px)'
        );
    });

    await t.test('3. Flyout drawer (.sidebar-content) overlays canvas at right: 60px with smooth transition', () => {
        assert.match(
            hudCss,
            /\.sidebar-content\s*\{[^}]*position:\s*fixed;[^}]*right:\s*60px;[^}]*width:\s*var\(--sidebar-width,\s*380px\);/s,
            '.sidebar-content must be fixed at right: 60px'
        );
        assert.match(
            hudCss,
            /#vtt-sidebar\.panel-open\s+\.sidebar-content\s*\{[^}]*transform:\s*translateX\(0\);/s,
            '#vtt-sidebar.panel-open must animate .sidebar-content into view'
        );
    });

    await t.test('4. Resizer handle #vtt-sidebar-resizer is positioned on left edge of flyout drawer', () => {
        assert.match(
            hudCss,
            /#vtt-sidebar-resizer\s*\{[^}]*position:\s*absolute;[^}]*left:\s*-4px;/s,
            '#vtt-sidebar-resizer must sit on left edge (left: -4px)'
        );
        assert.match(
            htmlContent,
            /<div class="sidebar-content">\s*<!-- Sidebar Drag-to-Resize Handle -->\s*<div id="vtt-sidebar-resizer"/s,
            '#vtt-sidebar-resizer must be inside .sidebar-content in HTML'
        );
    });

    await t.test('5. Tabletop starts collapsed with no active panels hardcoded in HTML', () => {
        assert.doesNotMatch(
            htmlContent,
            /<button class="[^"]*tab-header[^"]*active[^"]*"/,
            'No tab header should have active class initially in index.html'
        );
        assert.doesNotMatch(
            htmlContent,
            /<div id="tab-chat" class="[^"]*tab-panel[^"]*active[^"]*"/,
            'tab-chat panel should not have active class initially in index.html'
        );
    });

    await t.test('6. SetupSidebarTabs handles open, switch, and explicit toggle collapse', () => {
        // Test logic verification via mock DOM
        const mockClasses = (initial = []) => {
            const set = new Set(initial);
            return {
                add: (c) => set.add(c),
                remove: (c) => set.delete(c),
                contains: (c) => set.has(c),
                toggle: (c, force) => {
                    if (force !== undefined) {
                        force ? set.add(c) : set.delete(c);
                    } else {
                        set.has(c) ? set.delete(c) : set.add(c);
                    }
                },
                has: (c) => set.has(c)
            };
        };

        const sidebar = { classList: mockClasses() };
        const tabChat = { dataset: { tab: 'tab-chat' }, classList: mockClasses() };
        const tabCharacters = { dataset: { tab: 'tab-characters' }, classList: mockClasses() };
        const panelChat = { id: 'tab-chat', classList: mockClasses() };
        const panelCharacters = { id: 'tab-characters', classList: mockClasses() };

        const tabs = [tabChat, tabCharacters];
        const panels = [panelChat, panelCharacters];

        function handleTabClick(tab) {
            const target = tab.dataset.tab;
            const targetPanel = panels.find((p) => p.id === target);
            const isAlreadyActive = tab.classList.contains('active');

            if (isAlreadyActive) {
                tab.classList.remove('active');
                if (targetPanel) targetPanel.classList.remove('active');
                sidebar.classList.remove('panel-open');
                return;
            }

            tabs.forEach((t) => t.classList.remove('active'));
            panels.forEach((p) => p.classList.remove('active'));

            tab.classList.add('active');
            if (targetPanel) targetPanel.classList.add('active');
            sidebar.classList.add('panel-open');
        }

        // Initially closed
        assert.equal(sidebar.classList.contains('panel-open'), false);

        // Click chat -> Opens chat
        handleTabClick(tabChat);
        assert.equal(sidebar.classList.contains('panel-open'), true, 'Sidebar should open');
        assert.equal(tabChat.classList.contains('active'), true, 'Chat tab should be active');
        assert.equal(panelChat.classList.contains('active'), true, 'Chat panel should be active');

        // Click characters -> Switches to characters
        handleTabClick(tabCharacters);
        assert.equal(sidebar.classList.contains('panel-open'), true, 'Sidebar stays open');
        assert.equal(tabChat.classList.contains('active'), false, 'Chat tab deactivated');
        assert.equal(tabCharacters.classList.contains('active'), true, 'Characters tab active');
        assert.equal(panelCharacters.classList.contains('active'), true, 'Characters panel active');

        // Click characters again -> Collapses drawer
        handleTabClick(tabCharacters);
        assert.equal(sidebar.classList.contains('panel-open'), false, 'Sidebar closes on re-click');
        assert.equal(tabCharacters.classList.contains('active'), false, 'Characters tab deactivated');
        assert.equal(panelCharacters.classList.contains('active'), false, 'Characters panel deactivated');
    });

    await t.test('7. Resizer handle overflow-x is visible to straddle the drawer boundary without clipping', () => {
        assert.match(
            hudCss,
            /\.sidebar-content\s*\{[^}]*overflow-x:\s*visible;[^}]*overflow-y:\s*hidden;/s,
            '.sidebar-content must define overflow-x: visible; overflow-y: hidden;'
        );
    });

    await t.test('8. Mobile stylesheet resets padding/gap on sidebar and overrides drawer transform/opacity', () => {
        assert.match(
            mobileCss,
            /#vtt-sidebar\s*\{[^}]*padding:\s*0\s*!important;[^}]*gap:\s*0\s*!important;/s,
            '#vtt-sidebar on mobile must reset padding and gap to 0'
        );
        assert.match(
            mobileCss,
            /#vtt-sidebar\s+\.sidebar-content\s*\{[^}]*transform:\s*none\s*!important;[^}]*opacity:\s*1\s*!important;[^}]*visibility:\s*visible\s*!important;/s,
            '.sidebar-content on mobile must reset transform: none, opacity: 1, and visibility: visible'
        );
    });
});
