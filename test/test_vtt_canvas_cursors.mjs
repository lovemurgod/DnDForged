import test from 'node:test';
import assert from 'node:assert/strict';

import {
    THEME_CURSOR_PROFILES,
    resolveCanvasCursor,
    getCursorCssValue,
    applyCanvasCursor
} from '../vtt/js/canvas/vtt-canvas-cursors.js';

const ALL_THEMES = [
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

const ALL_CURSOR_KEYS = [
    'default',
    'pointer',
    'locked',
    'grab',
    'grabbing',
    'ping',
    'measure',
    'shape',
    'wall',
    'paint',
    'crosshair',
    'eraser',
    'text',
    'rotate',
    'nwse-resize',
    'nesw-resize',
    'ns-resize',
    'ew-resize'
];

test('VTT Canvas Cursors', async (t) => {
    await t.test('all 11 themes are registered with valid SVG cursor outputs', () => {
        for (const themeId of ALL_THEMES) {
            assert.ok(THEME_CURSOR_PROFILES[themeId], `Missing cursor profile for theme: ${themeId}`);
            for (const key of ALL_CURSOR_KEYS) {
                const cssVal = getCursorCssValue(key, themeId, true);
                assert.match(
                    cssVal,
                    /^url\("data:image\/svg\+xml,[^"]+"\) \d+ \d+, [a-z-]+$/,
                    `Invalid themed cursor CSS value for ${themeId}:${key} -> ${cssVal}`
                );
            }
        }

        for (const gameKey of ['default', 'pointer', 'grab', 'grabbing', 'ping', 'locked']) {
            const uniqueOutputs = new Set(ALL_THEMES.map((t) => getCursorCssValue(gameKey, t, true)));
            assert.equal(
                uniqueOutputs.size,
                ALL_THEMES.length,
                `Expected 11 distinct cursor SVGs for ${gameKey}, got ${uniqueOutputs.size}`
            );
        }
    });

    await t.test('standard fallback mode returns native CSS cursor keywords', () => {
        assert.equal(getCursorCssValue('default', 'classic', false), 'default');
        assert.equal(getCursorCssValue('pointer', 'cyberpunk', false), 'pointer');
        assert.equal(getCursorCssValue('locked', 'gothic', false), 'not-allowed');
        assert.equal(getCursorCssValue('grab', 'feywild', false), 'grab');
        assert.equal(getCursorCssValue('grabbing', 'solaris', false), 'grabbing');
        assert.equal(getCursorCssValue('measure', 'abyssal', false), 'crosshair');
        assert.equal(getCursorCssValue('text', 'parchment', false), 'text');
        assert.equal(getCursorCssValue('eraser', 'jungle', false), 'cell');
    });

    await t.test('resolveCanvasCursor enforces strict priority order', () => {
        // 1. Active pan / rotate beats everything
        assert.equal(
            resolveCanvasCursor({
                isPanning: true,
                isSpacePressed: true,
                hoveredDoorLocked: true,
                activeTool: 'measure'
            }),
            'grabbing'
        );
        assert.equal(
            resolveCanvasCursor({
                isRotating: true,
                hoveredInteractive: true,
                activeTool: 'select'
            }),
            'grabbing'
        );

        // 2. Active resize beats spacebar / hover / tool
        assert.equal(
            resolveCanvasCursor({
                activeResizeCursor: 'nwse-resize',
                isSpacePressed: true,
                hoveredInteractive: true
            }),
            'nwse-resize'
        );

        // 3. Spacebar beats hover & active tool
        assert.equal(
            resolveCanvasCursor({
                isSpacePressed: true,
                hoveredInteractive: true,
                activeTool: 'wall'
            }),
            'grab'
        );

        // 4. Locked door beats generic interactive hover
        assert.equal(
            resolveCanvasCursor({
                hoveredDoorLocked: true,
                hoveredInteractive: true,
                activeTool: 'select'
            }),
            'locked'
        );

        // 5. Hover handles & interactive objects beat active tool
        assert.equal(resolveCanvasCursor({ hoveredRotateHandle: true, activeTool: 'select' }), 'grab');
        assert.equal(resolveCanvasCursor({ hoveredResizeCursor: 'ew-resize', activeTool: 'select' }), 'ew-resize');
        assert.equal(resolveCanvasCursor({ hoveredInteractive: true, activeTool: 'select' }), 'pointer');

        // 6. Active tool modes & paint subtools
        assert.equal(resolveCanvasCursor({ activeTool: 'measure' }), 'measure');
        assert.equal(resolveCanvasCursor({ activeTool: 'shape' }), 'shape');
        assert.equal(resolveCanvasCursor({ activeTool: 'ping' }), 'ping');
        assert.equal(resolveCanvasCursor({ activeTool: 'wall' }), 'wall');
        assert.equal(resolveCanvasCursor({ activeTool: 'lighting' }), 'wall');
        assert.equal(resolveCanvasCursor({ activeTool: 'paint', paintSubTool: 'text' }), 'text');
        assert.equal(resolveCanvasCursor({ activeTool: 'paint', paintSubTool: 'eraser' }), 'eraser');
        assert.equal(resolveCanvasCursor({ activeTool: 'paint', paintSubTool: 'brush' }), 'paint');
        assert.equal(resolveCanvasCursor({ activeTool: 'select' }), 'default');
    });

    await t.test('applyCanvasCursor avoids redundant DOM writes when state is unchanged', () => {
        let writes = 0;
        const mockEl = {
            dataset: {},
            style: {
                _cursor: '',
                set cursor(v) {
                    writes++;
                    this._cursor = v;
                },
                get cursor() {
                    return this._cursor;
                }
            }
        };

        applyCanvasCursor('default', mockEl, { themeId: 'classic', themed: true });
        applyCanvasCursor('default', mockEl, { themeId: 'classic', themed: true });
        assert.equal(writes, 1);

        applyCanvasCursor('grab', mockEl, { themeId: 'classic', themed: true });
        assert.equal(writes, 2);

        applyCanvasCursor('grab', mockEl, { themeId: 'classic', themed: false });
        assert.equal(writes, 3);
        assert.equal(mockEl.style.cursor, 'grab');
    });
});
