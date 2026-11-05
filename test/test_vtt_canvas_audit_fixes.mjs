import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('[Audit Fix 1] Shortcut suppression when modal overlays are active', async () => {
    const shortcutsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js'),
        'utf8'
    );
    assert.match(
        shortcutsContent,
        /const\s+isModalActive\s*=\s*Boolean\([\s\S]*?\.modal\.show[\s\S]*?\.swal2-container/,
        'setupKeyboardShortcuts must detect active modal overlays'
    );
    assert.match(
        shortcutsContent,
        /if\s*\(isInputActive\s*\|\|\s*isModalActive\)\s*return;/,
        'setupKeyboardShortcuts must exit early if any modal overlay is active'
    );
});

test('[Audit Fix 2] Ctrl+Click token deselect clears dragTargetId', async () => {
    const interactionContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
        'utf8'
    );
    assert.match(
        interactionContent,
        /if\s*\(e\.ctrlKey\)\s*\{[\s\S]*?ctx\.selectedTokenIds\.delete\(clickedId\);[\s\S]*?if\s*\(ctx\.dragTargetId\s*===\s*clickedId\)\s*\{\s*ctx\.dragTargetId\s*=\s*null;/,
        'Ctrl+Click token deselection must clear ctx.dragTargetId'
    );
});

test('[Audit Fix 3] Multi-token formation-preserving waypoints', async () => {
    const interactionContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
        'utf8'
    );
    assert.match(
        interactionContent,
        /const\s+offX\s*=\s*originalPos\.x\s*-\s*leadOrig\.x;[\s\S]*?const\s+offY\s*=\s*originalPos\.y\s*-\s*leadOrig\.y;[\s\S]*?wp\.x\s*\+\s*offX[\s\S]*?wp\.y\s*\+\s*offY/,
        'Token animation requests must calculate relative waypoint offsets for secondary tokens'
    );
});

test('[Audit Fix 4] Paint eraser layer typo correction', async () => {
    const interactionContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
        'utf8'
    );
    assert.doesNotMatch(
        interactionContent,
        /ctx\.activeLayer\s*===\s*'ctx\.notes'/,
        "Typo 'ctx.notes' must be fixed"
    );
    assert.match(
        interactionContent,
        /ctx\.activeLayer\s*===\s*'lighting'\s*\|\|\s*ctx\.activeLayer\s*===\s*'notes'/,
        "Eraser layer must check for 'notes'"
    );
});

test('[Audit Fix 5] Touch drag completion multi-token parity', async () => {
    const touchContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-touch.js'),
        'utf8'
    );
    assert.match(
        touchContent,
        /const\s+movedTokensList\s*=\s*Array\.from\(context\.selectedTokenIds\s*\|\|\s*\[\]\)/,
        'endTouchTokenDrag must iterate over all selected tokens'
    );
    assert.match(
        touchContent,
        /movedTokensList\.forEach\(\(t\)\s*=>\s*\{[\s\S]*?context\.checkTokenMoveTriggers/,
        'endTouchTokenDrag must evaluate movement triggers for all moved tokens'
    );
});

test('[Audit Fix 6] Panel idempotency guards on map tools and paint ribbon', async () => {
    const mapToolsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-map-tools.js'),
        'utf8'
    );
    assert.match(
        mapToolsContent,
        /if\s*\(panel\.dataset\.mapToolsInitialized\s*===\s*'true'\)\s*return;[\s\S]*?panel\.dataset\.mapToolsInitialized\s*=\s*'true';/,
        'setupMapToolsControls must guard against duplicate listener initialization'
    );

    const drawingsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-drawings.js'),
        'utf8'
    );
    assert.match(
        drawingsContent,
        /if\s*\(ribbon\.dataset\.paintRibbonInitialized\s*===\s*'true'\)\s*return;[\s\S]*?ribbon\.dataset\.paintRibbonInitialized\s*=\s*'true';/,
        'setupPaintRibbonControls must guard against duplicate listener initialization'
    );
});

test('[Audit Fix 7] Safe emitTokenUpdates fallback in portals and interaction', async () => {
    const portalsContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-portals.js'),
        'utf8'
    );
    assert.match(
        portalsContent,
        /if\s*\(typeof\s+window\s*!==\s*'undefined'\s*&&\s*typeof\s+window\.emitTokenUpdates\s*===\s*'function'\)[\s\S]*?context\.emitTokenUpdates\(tokens\)/,
        'checkTokenMoveTriggers in portals must safely fall back to context.emitTokenUpdates'
    );

    const interactionContent = fs.readFileSync(
        path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
        'utf8'
    );
    assert.match(
        interactionContent,
        /const\s+emitTokenUpdates\s*=\s*ctx\.emitTokenUpdates\s*\|\|/,
        'vtt-canvas-interaction.js must provide safe emitTokenUpdates fallback'
    );
});
