import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('[Re-Audit 1] Vision & Fog of War integrity', async () => {
    const canvasContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/vtt-canvas.js'),
        'utf8'
    );
    // isPointVisible returns true if fogOfWar is false
    assert.match(
        canvasContent,
        /lightingSettings\?\.fogOfWar\s*===\s*false[\s\S]*?return\s*true;/,
        'isPointVisible must immediately return true if fogOfWar is disabled'
    );
    // isPointVisible returns true if daylight and no active vision polygons
    assert.match(
        canvasContent,
        /lightingSettings\?\.daylightMode[\s\S]*?visionPolygons\.length\s*===\s*0[\s\S]*?return\s*true;/,
        'isPointVisible must return true in daylight when no vision polygons exist'
    );

    const fogContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-fog.js'),
        'utf8'
    );
    // Verify that GM vision mode is strictly gated behind gmVisionMode and dead line 93 is removed
    assert.doesNotMatch(
        fogContent,
        /if\s*\(selectedTokenIds\.size\s*>\s*0\)\s*return\s*selectedTokenIds\.has\(token\.id\);/,
        'renderFogOfWarLayer must not restrict GM vision unless gmVisionMode is explicitly enabled'
    );
    assert.match(
        fogContent,
        /if\s*\(vtt\.role\s*===\s*'GM'\)\s*\{[\s\S]*?if\s*\(gmVisionMode\s*&&\s*selectedTokenIds\.size\s*>\s*0\)\s*return\s*selectedTokenIds\.has\(token\.id\);[\s\S]*?return\s*grantsVision;/,
        'GM vision filtering must be governed by gmVisionMode'
    );
});

test('[Re-Audit 2] Multi-Token Drag Formation & Socket Guard', async () => {
    const shortcutsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js'),
        'utf8'
    );
    // Escape key restores all dragged tokens
    assert.match(
        shortcutsContent,
        /Object\.entries\(ctx\.tokenDragOriginalPositions[\s\S]*?x\s*=\s*orig\.x[\s\S]*?y\s*=\s*orig\.y/,
        'Escape key must restore all tokens tracked in tokenDragOriginalPositions'
    );

    const touchContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-touch.js'),
        'utf8'
    );
    // cancelTokenDrag restores all dragged tokens
    assert.match(
        touchContent,
        /Object\.entries\(context\.tokenDragOriginalPositions\)[\s\S]*?tok\.x\s*=\s*orig\.x[\s\S]*?tok\.y\s*=\s*orig\.y/,
        'cancelTokenDrag must restore all tokens tracked in tokenDragOriginalPositions'
    );

    const socketContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-socket-sync.js'),
        'utf8'
    );
    // token:updated and token:updated_delta guards
    assert.match(
        socketContent,
        /id\s*===\s*ctx\.dragTargetId\s*\|\|\s*\(ctx\.dragTargetId\s*&&\s*ctx\.selectedTokenIds\?\.has\(id\)\)/,
        'Socket token updates must guard against overwriting any token in the active multi-selection drag'
    );
});

test('[Re-Audit 3] Motion Animation Loop Guard', async () => {
    const rendererContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/tokens/vtt-canvas-token-renderer.js'),
        'utf8'
    );
    assert.match(
        rendererContent,
        /const\s+duration\s*=\s*Number\.isFinite\(anim\.duration\)\s*&&\s*anim\.duration\s*>\s*0\s*\?\s*anim\.duration\s*:\s*300;/,
        'animateTokens must guard against zero or invalid duration to prevent infinite rAF loops'
    );
});

test('[Re-Audit 4] Drawing Eraser Destination-Out Pixel Masking & Layer Isolation', async () => {
    const drawingsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-drawings.js'),
        'utf8'
    );
    assert.match(
        drawingsContent,
        /targetLayer\s*=\s*options\.activeLayer[\s\S]*?\(d\.layer\s*\|\|\s*'token'\)\s*!==\s*targetLayer\)\s*return;/,
        'eraseDrawingsAtPoint must isolate erasing to the active layer'
    );

    const canvasContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/vtt-canvas.js'),
        'utf8'
    );
    // Eraser strokes rendered to ctxInteraction
    assert.doesNotMatch(
        canvasContent,
        /if\s*\(currentPaintStroke\s*&&\s*currentPaintStroke\.type\s*!==\s*'eraser'\)/,
        'Active eraser strokes must be rendered during interaction'
    );
});

test('[Re-Audit 5] Zoom-Aware Hit Testing, Circular Hitboxes & CAD Panning', async () => {
    const toolsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction-tools.js'),
        'utf8'
    );
    // Circular hitbox detection
    assert.match(
        toolsContent,
        /Math\.hypot\(mouse\.x\s*-\s*tx,\s*mouse\.y\s*-\s*ty\)\s*<=\s*tokenRadius\s*\+\s*r/,
        'getTokenAtPoint must use true circular radial distance for non-asset tokens'
    );
    // CAD trackpad panning vs wheel zoom
    assert.match(
        toolsContent,
        /isZoomGesture[\s\S]*?context\.panX\s*-=\s*e\.deltaX[\s\S]*?context\.panY\s*-=\s*e\.deltaY/,
        'wheel handler must support two-finger trackpad panning when isZoomGesture is false'
    );

    const interactionContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
        'utf8'
    );
    // Zoom scaled thresholds in getInteractiveDoorAtCoord
    assert.match(
        interactionContent,
        /const\s+z\s*=\s*Math\.max\(0\.1,\s*ctx\.zoom\s*\|\|\s*1\);[\s\S]*?toggleThresh\s*=\s*Math\.max\(13,\s*16\s*\/\s*z\);/,
        'getInteractiveDoorAtCoord must scale click thresholds inversely by zoom factor'
    );

    const canvasContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/vtt-canvas.js'),
        'utf8'
    );
    // Wall vertex zoom scaling
    assert.match(
        canvasContent,
        /minDistance\s*=\s*Math\.max\(12,\s*16\s*\/\s*Math\.max\(0\.1,\s*zoom\s*\|\|\s*1\)\)/,
        'getWallVertexAtCoord must scale vertex grab distance inversely by zoom'
    );
    // getNoteAtCoord reverse order iteration
    assert.match(
        canvasContent,
        /for\s*\(let\s+i\s*=\s*notes\.length\s*-\s*1;\s*i\s*>=\s*0;\s*i--\)/,
        'getNoteAtCoord must iterate in reverse to select topmost rendered notes first'
    );
});
