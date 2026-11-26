import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES, COLORBLIND_MODES } from '../vtt/js/vtt-themes.js';
import {
    DISPOSITION_COLORS,
    resolveDispositionColor,
    resolveRenderDispositionColor,
    COLORBLIND_DISPOSITION_COLORS
} from '../vtt/js/canvas/tokens/vtt-canvas-token-drop-config.js';

function parseCssColorToRgb(colorStr) {
    const str = colorStr.trim().toLowerCase();
    if (str.startsWith('#')) {
        let hex = str.slice(1);
        if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    const hslMatch = str.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
    if (hslMatch) {
        const h = Number(hslMatch[1]) / 360;
        const s = Number(hslMatch[2]) / 100;
        const l = Number(hslMatch[3]) / 100;
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [
            Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
            Math.round(hue2rgb(p, q, h) * 255),
            Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
        ];
    }
    throw new Error(`Unsupported color format: ${colorStr}`);
}

function relativeLuminance(rgb) {
    const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(c1, c2) {
    const l1 = relativeLuminance(parseCssColorToRgb(c1));
    const l2 = relativeLuminance(parseCssColorToRgb(c2));
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('Themes & Colorblindness Remediation Integrity', async (t) => {
    await t.test('All 20 Colorblind preview pills meet WCAG AA (>= 4.5:1) text contrast', () => {
        for (const mode of Object.values(COLORBLIND_MODES)) {
            const pairs = [
                ['success', mode.preview.success, mode.preview.successText || '#ffffff'],
                ['warning', mode.preview.warning, '#000000'],
                ['danger', mode.preview.danger, mode.preview.dangerText || '#ffffff'],
                ['temphp', mode.preview.temphp, mode.preview.temphpText || '#ffffff']
            ];
            for (const [label, bg, fg] of pairs) {
                const ratio = contrastRatio(bg, fg);
                assert.ok(
                    ratio >= 4.5,
                    `${mode.id} ${label} pill (${fg} on ${bg}) contrast ${ratio.toFixed(2)}:1 is below 4.5:1`
                );
            }
        }
    });

    await t.test('Every theme defaultDice skin exists in dice-3d.js SKINS', () => {
        const diceSrc = fs.readFileSync(path.resolve('vtt/js/dice-3d.js'), 'utf8');
        for (const theme of Object.values(THEMES)) {
            assert.ok(
                diceSrc.includes(`${theme.defaultDice}:`),
                `dice-3d.js SKINS must define ${theme.defaultDice} for theme ${theme.id}`
            );
        }
    });

    await t.test('Player and Creature sheets compute initial HP bar state classes without inline color locks', () => {
        const psSrc = fs.readFileSync(path.resolve('vtt/js/vtt-player-sheet.js'), 'utf8');
        const hpBarLine = psSrc.split('\n').find((line) => line.includes('id="pc-hp-bar"'));
        assert.ok(hpBarLine, '#pc-hp-bar element must exist in vtt-player-sheet.js');
        assert.ok(
            !hpBarLine.includes('background-color:'),
            '#pc-hp-bar must not have inline background-color that blocks .injured/.danger classes'
        );
        assert.ok(psSrc.includes('hpStateClass'), 'vtt-player-sheet.js must compute initial injured/danger class');

        const csSrc = fs.readFileSync(path.resolve('vtt/js/creature-sheet/creature-renderer.js'), 'utf8');
        assert.ok(
            csSrc.includes('csHpStateClass'),
            'creature-renderer.js must compute initial injured/danger class for #cs-hp-bar'
        );
    });

    await t.test('Injured HP bars use --color-warning-base across sheets, initiative, and tokens', () => {
        const csCss = fs.readFileSync(path.resolve('vtt/css/components/creature-sheet.css'), 'utf8');
        const initCss = fs.readFileSync(path.resolve('vtt/css/components/initiative.css'), 'utf8');
        const tokenRenderer = fs.readFileSync(
            path.resolve('vtt/js/canvas/tokens/vtt-canvas-token-renderer.js'),
            'utf8'
        );
        assert.ok(csCss.includes('var(--color-warning-base)'), 'creature-sheet.css must use --color-warning-base');
        assert.ok(initCss.includes('var(--color-warning-base)'), 'initiative.css must use --color-warning-base');
        assert.ok(
            tokenRenderer.includes('var(--color-warning-base)'),
            'vtt-canvas-token-renderer.js must use --color-warning-base'
        );
    });

    await t.test('Contrast tokens (--color-on-success/danger/temphp) are defined and used across UI badges', () => {
        const themeCss = fs.readFileSync(path.resolve('vtt/css/components/theme.css'), 'utf8');
        const baseCss = fs.readFileSync(path.resolve('vtt/css/components/base.css'), 'utf8');
        const mapMgr = fs.readFileSync(path.resolve('vtt/js/canvas/vtt-canvas-map-manager.js'), 'utf8');
        const csEditor = fs.readFileSync(path.resolve('vtt/js/creature-sheet/creature-editor.js'), 'utf8');
        const tokenModal = fs.readFileSync(path.resolve('vtt/js/player-sheet/modals/token-modal.js'), 'utf8');

        assert.ok(themeCss.includes('--color-on-gold'), 'theme.css must declare --color-on-gold');
        assert.ok(!themeCss.includes('--theme-ambient-glow'), 'theme.css must remove unused --theme-ambient-glow');
        assert.ok(baseCss.includes('var(--color-on-gold'), 'base.css .btn-primary must use --color-on-gold');
        assert.ok(themeCss.includes('--color-on-success'), 'theme.css must declare --color-on-success');
        assert.ok(themeCss.includes('--color-on-danger'), 'theme.css must declare --color-on-danger');
        assert.ok(themeCss.includes('--color-on-temphp'), 'theme.css must declare --color-on-temphp');
        assert.ok(baseCss.includes('var(--color-on-success'), 'base.css must use --color-on-success');
        assert.ok(baseCss.includes('var(--color-on-danger'), 'base.css must use --color-on-danger');
        assert.ok(!baseCss.includes('#2e7d32'), 'base.css must not hardcode #2e7d32 on roll-mode buttons');
        assert.ok(!baseCss.includes('#b71c1c'), 'base.css must not hardcode #b71c1c on roll-mode buttons');
        assert.ok(mapMgr.includes('var(--color-on-success'), 'map manager live badge must use --color-on-success');
        assert.ok(csEditor.includes('var(--color-on-success'), 'creature-editor badge must use --color-on-success');
        assert.ok(tokenModal.includes('var(--color-on-success'), 'token-modal badge must use --color-on-success');

        const chatSrc = fs.readFileSync(path.resolve('vtt/js/vtt-chat.js'), 'utf8');
        assert.ok(!chatSrc.includes('color:#81c784'), 'vtt-chat.js must not hardcode #81c784 for crit success');
        assert.ok(!chatSrc.includes('color:#e57373'), 'vtt-chat.js must not hardcode #e57373 for crit fail');

        const psSrc = fs.readFileSync(path.resolve('vtt/js/vtt-player-sheet.js'), 'utf8');
        const csSrc = fs.readFileSync(path.resolve('vtt/js/creature-sheet/creature-renderer.js'), 'utf8');
        assert.ok(!psSrc.includes('color:#e53935'), 'vtt-player-sheet.js must not hardcode #e53935 heart icon');
        assert.ok(!csSrc.includes('color: #e53935'), 'creature-renderer.js must not hardcode #e53935 heart icon');
        assert.ok(!psSrc.includes('accent-color: #f44336'), 'vtt-player-sheet.js must not hardcode #f44336 death saves');
        assert.ok(!psSrc.includes('accent-color: #4caf50'), 'vtt-player-sheet.js must not hardcode #4caf50 death saves');
    });

    await t.test('resolveDispositionColor stays canonical and resolveRenderDispositionColor adapts at render time', () => {
        const prevDoc = globalThis.document;
        try {
            globalThis.document = {
                documentElement: {
                    getAttribute: (attr) => (attr === 'data-colorblind' ? 'protanopia' : null)
                }
            };
            assert.equal(resolveDispositionColor('hostile'), DISPOSITION_COLORS.hostile);
            assert.equal(resolveDispositionColor('friendly'), DISPOSITION_COLORS.friendly);
            assert.equal(
                resolveRenderDispositionColor(DISPOSITION_COLORS.hostile),
                COLORBLIND_DISPOSITION_COLORS.protanopia.hostile
            );
            assert.equal(
                resolveRenderDispositionColor(DISPOSITION_COLORS.friendly),
                COLORBLIND_DISPOSITION_COLORS.protanopia.friendly
            );
        } finally {
            globalThis.document = prevDoc;
        }
    });

    await t.test('Popout sheet-boot.js listens to storage events for live theme/colorblind/font sync', () => {
        const bootSrc = fs.readFileSync(path.resolve('vtt/js/bootstrap/sheet-boot.js'), 'utf8');
        assert.ok(bootSrc.includes("window.addEventListener('storage'"), 'sheet-boot.js must listen for storage events');
        assert.ok(bootSrc.includes('vtt_theme'), 'sheet-boot.js must sync vtt_theme');
        assert.ok(bootSrc.includes('vtt_colorblind_mode'), 'sheet-boot.js must sync vtt_colorblind_mode');
        assert.ok(bootSrc.includes('vtt_font_scale_v2'), 'sheet-boot.js must sync vtt_font_scale_v2');
    });
});
