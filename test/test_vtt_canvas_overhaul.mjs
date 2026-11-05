import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('[Overhaul 1] Keybinding configuration: WASD moves tokens, Shift+WASD pans, R/F flip', async () => {
    const fileContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js'),
        'utf8'
    );

    // Verify 'r' flips vertical
    assert.match(
        fileContent,
        /key\s*===\s*'r'[\s\S]*?token\.flipY\s*=\s*!token\.flipY/,
        'R key must toggle token.flipY'
    );

    // Verify 'f' flips horizontal
    assert.match(
        fileContent,
        /key\s*===\s*'f'[\s\S]*?token\.flipX\s*=\s*!token\.flipX/,
        'F key must toggle token.flipX'
    );

    // Verify Shift+WASD camera pan
    assert.match(
        fileContent,
        /e\.shiftKey[\s\S]*?\['w',\s*'a',\s*'s',\s*'d'\]\.includes\(key\)[\s\S]*?ctx\.panX/,
        'Shift+WASD must trigger camera pan'
    );

    // Verify WASD without shift nudges tokens by 1 grid cell
    assert.match(
        fileContent,
        /isWasdMove[\s\S]*?\['w',\s*'a',\s*'s',\s*'d'\]\.includes\(key\)/,
        'WASD must be recognized as movement keys'
    );
});

test('[Overhaul 2] Spatial index synchronization on wall additions and deletions', async () => {
    const shortcutsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js'),
        'utf8'
    );
    assert.match(
        shortcutsContent,
        /deleteSelection[\s\S]*?syncWallSpatialIndex/,
        'deleteSelection must invoke syncWallSpatialIndex'
    );
    assert.match(
        shortcutsContent,
        /pasteClipboard[\s\S]*?syncWallSpatialIndex/,
        'pasteClipboard must invoke syncWallSpatialIndex'
    );

    const interactionContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
        'utf8'
    );
    assert.match(
        interactionContent,
        /ctx\.walls\.push[\s\S]*?syncWallSpatialIndex/,
        'Wall segment creation must invoke syncWallSpatialIndex'
    );

    const canvasContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/vtt-canvas.js'),
        'utf8'
    );
    assert.match(
        canvasContent,
        /onWallsUpdated:\s*\(\)\s*=>\s*\{[\s\S]*?syncWallSpatialIndex\(\)/,
        'onWallsUpdated must trigger syncWallSpatialIndex'
    );
    assert.match(
        canvasContent,
        /onWallDeleted:\s*\(\)\s*=>\s*\{[\s\S]*?syncWallSpatialIndex\(\)/,
        'onWallDeleted must trigger syncWallSpatialIndex'
    );
});

test('[Overhaul 3] Measurement template screen-space scaling & double click consolidation', async () => {
    const measureContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-measure.js'),
        'utf8'
    );
    assert.match(
        measureContent,
        /zoomLevel\s*=\s*1\.0/,
        'drawMeasurementTemplate must accept zoomLevel parameter'
    );
    assert.match(
        measureContent,
        /const\s+zoom\s*=\s*zoomLevel[\s\S]*?ctx\.scale\(1\s*\/\s*zoom,\s*1\s*\/\s*zoom\)/,
        'Distance pill badge must scale inversely by zoomLevel'
    );

    const canvasContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/vtt-canvas.js'),
        'utf8'
    );
    assert.doesNotMatch(
        canvasContent,
        /canvasInteraction\.addEventListener\('dblclick'[\s\S]*?canvasInteraction\.addEventListener\('dblclick'/,
        'Duplicate dblclick listeners on canvasInteraction must be consolidated'
    );
});

test('[Overhaul 4] Flood fill vector contour tracing and drawing z-index handlers', async () => {
    const drawingsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-drawings.js'),
        'utf8'
    );
    assert.match(
        drawingsContent,
        /menu-draw-forward/,
        'menu-draw-forward click handler must be implemented'
    );
    assert.match(
        drawingsContent,
        /menu-draw-backward/,
        'menu-draw-backward click handler must be implemented'
    );
    assert.match(
        drawingsContent,
        /simplifyDP/,
        'Flood fill must perform vector Douglas-Peucker polygon simplification'
    );
});

test('[Overhaul 5] Lighting slider debounce and scratchpad memory reuse', async () => {
    const lightingContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-lighting.js'),
        'utf8'
    );
    assert.match(
        lightingContent,
        /lightUpdateDebounceTimer/,
        'Light property input sliders must be debounced'
    );

    const fogContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-fog.js'),
        'utf8'
    );
    assert.match(
        fogContent,
        /ctxScratchLight\.clearRect\(0,\s*0,\s*d,\s*d\)/,
        'Scratchpad lighting canvas must be cleared without reallocation churn'
    );
});
