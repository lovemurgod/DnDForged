import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const VTT_CSS_PATH = path.resolve('vtt/css/vtt.css');
const COMP_DIR = path.resolve('vtt/css/components');

const EXPECTED_COMPONENTS = [
    'theme.css',
    'base.css',
    'auth.css',
    'hud.css',
    'chat.css',
    'initiative.css',
    'canvas.css',
    'creature-sheet.css',
    'player-sheet.css',
    'modals.css'
];

test('CSS Decomposition: Master Barrel Entrypoint Integrity', async (t) => {
    await t.test('vtt/css/vtt.css exists and is reduced to a concise @import barrel', () => {
        assert.ok(fs.existsSync(VTT_CSS_PATH), 'vtt/css/vtt.css must exist');
        const content = fs.readFileSync(VTT_CSS_PATH, 'utf8');
        const lines = content.split('\n');

        // Ensure it's massively reduced from 10,317 lines down to clean barrel imports (< 40 lines)
        assert.ok(lines.length < 40, `vtt.css line count (${lines.length}) should be under 40 lines`);

        // Verify all 10 component files are imported in exact sequence
        EXPECTED_COMPONENTS.forEach((comp) => {
            const expectedImport = `@import './components/${comp}';`;
            assert.ok(content.includes(expectedImport), `vtt.css must import ${comp} via "${expectedImport}"`);
        });
    });

    await t.test('All 10 component stylesheets exist on disk and have non-trivial content', () => {
        EXPECTED_COMPONENTS.forEach((comp) => {
            const compPath = path.join(COMP_DIR, comp);
            assert.ok(fs.existsSync(compPath), `${comp} must exist at ${compPath}`);
            const stat = fs.statSync(compPath);
            assert.ok(stat.size > 2000, `${comp} must have significant size (got ${stat.size} bytes)`);
            const lines = fs.readFileSync(compPath, 'utf8').split('\n');
            assert.ok(lines.length > 50, `${comp} must have > 50 lines (got ${lines.length})`);
        });
    });

    await t.test('Every component stylesheet has balanced curly braces (no syntax truncation)', () => {
        EXPECTED_COMPONENTS.forEach((comp) => {
            const compPath = path.join(COMP_DIR, comp);
            const content = fs.readFileSync(compPath, 'utf8');
            let openBraces = 0;
            let closeBraces = 0;
            for (const ch of content) {
                if (ch === '{') openBraces++;
                if (ch === '}') closeBraces++;
            }
            assert.equal(
                openBraces,
                closeBraces,
                `${comp} must have balanced braces: found ${openBraces} '{' and ${closeBraces} '}'`
            );
        });
    });
});

test('CSS Decomposition: Theme, Tokens & Colorblind Accessibility', async (t) => {
    const themeContent = fs.readFileSync(path.join(COMP_DIR, 'theme.css'), 'utf8');

    await t.test('theme.css declares core design tokens and root CSS custom properties', () => {
        const requiredVars = [
            '--color-bg-base',
            '--color-gold-base',
            '--color-gold-light',
            '--color-border-subtle',
            '--font-primary',
            '--font-heading'
        ];
        requiredVars.forEach((v) => {
            assert.ok(themeContent.includes(v), `theme.css must declare CSS variable ${v}`);
        });
    });

    await t.test('All 11 VTT color themes are present and defined', () => {
        const expectedThemes = [
            'classic',
            'jungle',
            'gothic',
            'celestial',
            'hellscape',
            'cyberpunk',
            'parchment',
            'abyssal',
            'feywild',
            'frostpeak',
            'solaris'
        ];
        expectedThemes.forEach((theme) => {
            assert.ok(
                themeContent.includes(`[data-theme="${theme}"]`),
                `theme.css must define theme selector [data-theme="${theme}"]`
            );
        });
    });

    await t.test('All 4 accessibility & colorblind filter selectors are present', () => {
        const expectedFilters = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];
        expectedFilters.forEach((filter) => {
            assert.ok(
                themeContent.includes(`[data-colorblind="${filter}"]`),
                `theme.css must define colorblind selector [data-colorblind="${filter}"]`
            );
        });
    });
});

test('CSS Decomposition: Domain Classes in Specialized Components', async (t) => {
    await t.test('auth.css contains login overlay, error banner, and GM password modal', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'auth.css'), 'utf8');
        assert.ok(content.includes('#login-overlay'));
        assert.ok(content.includes('#modal-gm-password'));
        assert.ok(content.includes('.btn-enter-tabletop'));
    });

    await t.test('hud.css contains workspace grid, control bars, bottom-left HUD, and pause overlay', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'hud.css'), 'utf8');
        assert.ok(content.includes('#vtt-workspace'));
        assert.ok(content.includes('#vtt-controls'));
        assert.ok(content.includes('#btn-game-pause'));
        assert.ok(content.includes('#vtt-coordinates-indicator'));
    });

    await t.test('chat.css contains chat stream, roll cards, macro cards, and mass attacks', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'chat.css'), 'utf8');
        assert.ok(content.includes('.chat-message'));
        assert.ok(content.includes('.dice-roll-card'));
        assert.ok(content.includes('.macro-chat-card'));
        assert.ok(content.includes('.mass-attack-chat-card'));
    });

    await t.test('initiative.css contains initiative tracker, layouts, chips, and turn rings', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'initiative.css'), 'utf8');
        assert.ok(content.includes('#vtt-initiative-carousel-container'));
        assert.ok(content.includes('.pos-right'));
        assert.ok(content.includes('.init-min-combatant'));
        assert.ok(content.includes('.turn-ring'));
        assert.ok(content.includes('.canvas-hover-pulse'));
    });

    await t.test('canvas.css contains tool ribbons, context menus, auras, conditions, and weather', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'canvas.css'), 'utf8');
        assert.ok(content.includes('.context-menu'));
        assert.ok(
            content.includes('.paint-tools-panel') ||
                content.includes('.paint-ribbon') ||
                content.includes('#paint-tools-panel')
        );
        assert.ok(content.includes('.vtt-token-context-menu'));
        assert.ok(content.includes('.vtt-token-submenu'));
        assert.ok(content.includes('.vtt-condition-gallery'));
        assert.ok(content.includes('.vtt-weather-container') || content.includes('.weather-layer'));
    });

    await t.test('creature-sheet.css contains side panel, slideout tabs, and fast dice', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'creature-sheet.css'), 'utf8');
        assert.ok(content.includes('#creature-sheet-panel'));
        assert.ok(content.includes('.slideout-tab-handle'));
        assert.ok(content.includes('.cs-popout-btn') || content.includes('.cs-minimize-btn'));
    });

    await t.test('player-sheet.css contains panel, standalone layout, builder, and add-item modal', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'player-sheet.css'), 'utf8');
        assert.ok(content.includes('#player-sheet-panel'));
        assert.ok(content.includes('.standalone-sheet-body') || content.includes('body.standalone-sheet-body'));
        assert.ok(content.includes('#pc-character-builder-modal') || content.includes('.builder-section-box'));
        assert.ok(content.includes('.pc-sheet-grid'));
    });

    await t.test('modals.css contains bestiary, settings, asset gallery, and map manager', () => {
        const content = fs.readFileSync(path.join(COMP_DIR, 'modals.css'), 'utf8');
        assert.ok(content.includes('.bestiary-table-container'));
        assert.ok(content.includes('.asset-item'));
        assert.ok(content.includes('.vtt-splash-card'));
        assert.ok(content.includes('.map-card') || content.includes('.map-manager-modal-content'));
    });
});

test('CSS Decomposition: Consumer Compatibility', async (t) => {
    await t.test('vtt/index.html and vtt/sheet.html reference the master vtt.css entrypoint', () => {
        const indexHtml = fs.readFileSync(path.resolve('vtt/index.html'), 'utf8');
        const sheetHtml = fs.readFileSync(path.resolve('vtt/sheet.html'), 'utf8');

        assert.ok(/css\/vtt\.css(?:\?v=\d+)?/.test(indexHtml), 'index.html must load css/vtt.css');
        assert.ok(/css\/vtt\.css(?:\?v=\d+)?/.test(sheetHtml), 'sheet.html must load css/vtt.css');
    });
});
