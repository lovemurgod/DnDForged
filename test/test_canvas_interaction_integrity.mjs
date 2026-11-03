import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import * as espree from 'espree';
import * as escope from 'eslint-scope';

import { setupPointerInteraction } from '../vtt/js/canvas/vtt-canvas-interaction.js';
import { setupKeyboardShortcuts } from '../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js';
import {
    handleMapToolMouseDown,
    handleMapToolMouseMove,
    handleMapToolMouseUp
} from '../vtt/js/canvas/vtt-canvas-map-tools.js';

console.log('--- Running Canvas Interaction & Submodule Integrity Tests ---');

// ============================================================================
// Test Suite 1: AST Unresolved Identifiers Verification Across Canvas Submodules
// ============================================================================
console.log('\n[Suite 1] AST Scope Analysis on Canvas Submodules');

const standardGlobals = new Set([
    'Array',
    'Boolean',
    'Date',
    'Error',
    'Function',
    'JSON',
    'Math',
    'Number',
    'Object',
    'Promise',
    'RegExp',
    'Set',
    'Map',
    'Proxy',
    'Reflect',
    'String',
    'Symbol',
    'TypeError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'console',
    'document',
    'window',
    'globalThis',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'parseFloat',
    'parseInt',
    'isNaN',
    'isFinite',
    'encodeURIComponent',
    'decodeURIComponent',
    'encodeURI',
    'decodeURI',
    'undefined',
    'NaN',
    'Infinity',
    'URL',
    'Blob',
    'File',
    'FileReader',
    'FormData',
    'fetch',
    'Headers',
    'Request',
    'Response',
    'AbortController',
    'performance',
    'crypto',
    'CustomEvent',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'Image',
    'Audio',
    'HTMLCanvasElement',
    'CanvasRenderingContext2D',
    'DOMParser',
    'prompt',
    'alert',
    'confirm',
    'localStorage',
    'sessionStorage',
    'Uint8Array',
    'Uint16Array',
    'Uint32Array',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Float32Array',
    'Float64Array',
    'DOMMatrix',
    'MutationObserver',
    'ResizeObserver',
    'IntersectionObserver',
    'BroadcastChannel',
    'URLSearchParams',
    'getComputedStyle',
    'navigator',
    'structuredClone',
    'THREE',
    'CANNON',
    'DOMPurify',
    'JqueryUtil',
    'Parser',
    'Renderer',
    'io',
    'define',
    'VTT',
    'vtt'
]);

function getJsFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) results.push(...getJsFiles(full));
        else if (f.endsWith('.js')) results.push(full);
    }
    return results;
}

const canvasFiles = getJsFiles('vtt/js/canvas');
assert.ok(canvasFiles.length >= 10, 'Expected at least 10 canvas JS files to be audited');

let totalUnresolved = 0;
const failureDetails = [];

for (const file of canvasFiles) {
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try {
        ast = espree.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            loc: true,
            range: true
        });
    } catch (err) {
        failureDetails.push({ file, error: `Parse error: ${err.message}` });
        totalUnresolved++;
        continue;
    }

    const sm = escope.analyze(ast, {
        ecmaVersion: 2022,
        sourceType: 'module'
    });

    const unres = new Set();
    for (const ref of sm.globalScope.through) {
        if (!standardGlobals.has(ref.identifier.name)) {
            unres.add(ref.identifier.name);
        }
    }

    if (unres.size > 0) {
        totalUnresolved += unres.size;
        failureDetails.push({ file, unresolved: [...unres].sort() });
    }
}

if (failureDetails.length > 0) {
    console.error('Failed AST Scope Check. Unresolved variables found:', JSON.stringify(failureDetails, null, 2));
}
assert.strictEqual(
    totalUnresolved,
    0,
    `Expected 0 unresolved canvas variables across all ${canvasFiles.length} canvas files, found ${totalUnresolved}`
);
console.log(`  ✓ Passed AST verification across ${canvasFiles.length} canvas files with 0 unresolved identifiers.`);

// ============================================================================
// Test Suite 2: Simulated Pointer Event Sequence & Panning Ergonomics
// ============================================================================
console.log('\n[Suite 2] Simulated Pointer Interaction (Pan, Select, Drag, Box Select)');

const dom = new JSDOM(
    `
<!DOCTYPE html>
<html>
<body>
    <div id="vtt-canvas-viewport" style="width: 1000px; height: 800px; position: relative;">
        <div id="canvas-container" style="position: absolute; top: 0; left: 0;">
            <canvas id="vtt-canvas-interaction" width="1000" height="800"></canvas>
        </div>
    </div>
    <div id="vtt-coordinates-indicator">
        <span id="val-coord-x">0</span>
        <span id="val-coord-y">0</span>
    </div>
</body>
</html>
`,
    { url: 'http://localhost:5050/vtt/' }
);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

const canvasInteractionEl = document.getElementById('vtt-canvas-interaction');
canvasInteractionEl.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    width: 1000,
    height: 800,
    right: 1000,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => {}
});

// Mock VTT and Engine State
const mockTokens = {
    'tok-warrior': {
        id: 'tok-warrior',
        name: 'Fighter',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        isPlayer: true
    }
};

let emittedTokenUpdates = null;
let renderAllCallCount = 0;
let containerTransformUpdated = false;

const ctx = {
    vtt: {
        role: 'GM',
        username: 'DungeonMaster',
        socket: {
            emit: (event, payload) => {}
        }
    },
    canvasInteraction: canvasInteractionEl,
    tokens: mockTokens,
    walls: [],
    lights: [],
    notes: [],
    shapes: {},
    drawings: {},
    traps: [],
    portals: [],
    selectedTokenIds: new Set(),
    selectedShapeIds: new Set(),
    selectedDrawingIds: new Set(),
    selectedTokenId: null,
    dragTargetId: null,
    panX: 0,
    panY: 0,
    zoom: 1.0,
    isPanning: false,
    hasPanned: false,
    activeTool: 'select',
    activeLayer: 'token',
    currentMapId: 'map-dungeon-1',
    tokenDragOriginalPositions: {},
    renderAll: () => {
        renderAllCallCount++;
    },
    updateContainerTransform: () => {
        containerTransformUpdated = true;
    },
    updateCoordinateDisplay: (coords) => {
        const xEl = document.getElementById('val-coord-x');
        const yEl = document.getElementById('val-coord-y');
        if (xEl && coords) xEl.textContent = Math.round(coords.x);
        if (yEl && coords) yEl.textContent = Math.round(coords.y);
    },
    getCanvasMouseCoords: (e) => ({
        x: (e.clientX - ctx.panX) / ctx.zoom,
        y: (e.clientY - ctx.panY) / ctx.zoom
    }),
    getTokenAtPoint: (pt, requireControl = true) => {
        for (const id in ctx.tokens) {
            const t = ctx.tokens[id];
            if (pt.x >= t.x && pt.x <= t.x + 50 && pt.y >= t.y && pt.y <= t.y + 50) {
                return t;
            }
        }
        return null;
    },
    isTokenControlledByPlayer: () => true,
    emitTokenUpdates: (t) => {
        emittedTokenUpdates = t;
    }
};

window.emitTokenUpdates = (t) => {
    emittedTokenUpdates = t;
};

// Initialize interaction subsystem
setupPointerInteraction(ctx);

// ----------------------------------------------------------------------------
// Test 2.1: Right-Click Panning (Strict button === 2)
// ----------------------------------------------------------------------------
console.log('  Testing Right-Click Canvas Panning...');

const panDownEvent = new dom.window.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 200,
    clientY: 150
});
canvasInteractionEl.dispatchEvent(panDownEvent);

assert.strictEqual(ctx.isPanning, true, 'Right click mousedown must set ctx.isPanning to true');
assert.strictEqual(ctx.hasPanned, false, 'Initial mousedown should not yet flag hasPanned');

const panMoveEvent = new dom.window.MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: 260,
    clientY: 210 // Delta: dx = +60, dy = +60
});
window.dispatchEvent(panMoveEvent);

assert.strictEqual(ctx.isPanning, true, 'ctx.isPanning must remain true during mousemove');
assert.strictEqual(ctx.hasPanned, true, 'ctx.hasPanned must be true after drag');
assert.strictEqual(ctx.panX, 60, 'ctx.panX should equal clientX delta (+60)');
assert.strictEqual(ctx.panY, 60, 'ctx.panY should equal clientY delta (+60)');

const panUpEvent = new dom.window.MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 260,
    clientY: 210
});
window.dispatchEvent(panUpEvent);

assert.strictEqual(ctx.isPanning, false, 'mouseup must set ctx.isPanning to false');
assert.strictEqual(ctx.panX, 60, 'ctx.panX must remain at 60 after pan release');
console.log('  ✓ Right-Click Canvas Panning verified successfully.');

// ----------------------------------------------------------------------------
// Test 2.2: Left-Click Token Selection & Dragging
// ----------------------------------------------------------------------------
console.log('  Testing Left-Click Token Selection and Movement...');

// Reset pan to origin for clean coordinates
ctx.panX = 0;
ctx.panY = 0;

// Click inside tok-warrior (token is at 100, 100 with width 50, 50)
const tokenDownEvent = new dom.window.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 120,
    clientY: 120
});
canvasInteractionEl.dispatchEvent(tokenDownEvent);

assert.ok(ctx.selectedTokenIds.has('tok-warrior'), 'Token tok-warrior must be selected on click');
assert.strictEqual(ctx.selectedTokenId, 'tok-warrior', 'ctx.selectedTokenId must match clicked token id');
assert.strictEqual(ctx.dragTargetId, 'tok-warrior', 'ctx.dragTargetId must be set to tok-warrior for drag');

// Drag token by +30, +30
const tokenDragEvent = new dom.window.MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: 150,
    clientY: 150
});
window.dispatchEvent(tokenDragEvent);

assert.strictEqual(ctx.tokens['tok-warrior'].x, 130, 'Token X should have updated during drag');
assert.strictEqual(ctx.tokens['tok-warrior'].y, 130, 'Token Y should have updated during drag');

const tokenUpEvent = new dom.window.MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 150,
    clientY: 150
});
window.dispatchEvent(tokenUpEvent);

assert.strictEqual(ctx.dragTargetId, null, 'ctx.dragTargetId must be cleared after mouseup');
console.log('  ✓ Token selection and dragging verified successfully.');

// ----------------------------------------------------------------------------
// Test 2.3: Empty Canvas Box Selection
// ----------------------------------------------------------------------------
console.log('  Testing Empty Canvas Box-Select...');

const boxDownEvent = new dom.window.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 400,
    clientY: 400
});
canvasInteractionEl.dispatchEvent(boxDownEvent);

assert.strictEqual(ctx.isBoxSelecting, true, 'Clicking empty canvas must activate isBoxSelecting');
assert.strictEqual(ctx.selectedTokenIds.size, 0, 'Clicking empty canvas should clear previous token selection');

const boxMoveEvent = new dom.window.MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: 500,
    clientY: 500
});
window.dispatchEvent(boxMoveEvent);

assert.strictEqual(ctx.boxSelectEnd.x, 500, 'boxSelectEnd.x must track cursor during box select');
assert.strictEqual(ctx.boxSelectEnd.y, 500, 'boxSelectEnd.y must track cursor during box select');

const boxUpEvent = new dom.window.MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 500,
    clientY: 500
});
window.dispatchEvent(boxUpEvent);

assert.strictEqual(ctx.isBoxSelecting, false, 'isBoxSelecting must be false after mouseup');
console.log('  ✓ Box-selection lifecycle verified successfully.');

// ----------------------------------------------------------------------------
// Test 2.4: Keyboard Shortcuts Integration
// ----------------------------------------------------------------------------
console.log('  Testing Keyboard Shortcuts Camera Panning & Token Nudge...');

setupKeyboardShortcuts(ctx);

ctx.panX = 100;
ctx.panY = 100;

// Numpad6 pans camera left/right
const panKeyEvent = new dom.window.KeyboardEvent('keydown', {
    code: 'Numpad6',
    bubbles: true,
    cancelable: true
});
window.dispatchEvent(panKeyEvent);

assert.ok(ctx.panX !== 100, 'Numpad6 keydown should pan camera ctx.panX');
console.log('  ✓ Keyboard shortcuts camera panning verified successfully.');

// ArrowRight nudges selected token
ctx.selectedTokenIds.add('tok-warrior');
const initialTokenX = ctx.tokens['tok-warrior'].x;
const nudgeKeyEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true
});
window.dispatchEvent(nudgeKeyEvent);

assert.strictEqual(
    ctx.tokens['tok-warrior'].x,
    initialTokenX + 50,
    'ArrowRight keydown should nudge token x by unitSize (50)'
);
console.log('  ✓ Keyboard shortcuts token nudging verified successfully.');

// ============================================================================
// Test Suite 3: Bridge Context Getter/Setter Contract Integrity Check
// ============================================================================
console.log('\n[Suite 3] Bridge Context Contract (Missing Setters Prevention)');

const canvasMainContent = fs.readFileSync('vtt/js/vtt-canvas.js', 'utf8');

// 1. Verify interactionContext
const intStart = canvasMainContent.indexOf('const interactionContext = {');
const intEnd = canvasMainContent.indexOf('setupPointerInteractionExt(interactionContext);', intStart);
assert.ok(intStart > 0 && intEnd > intStart, 'interactionContext block must be present in vtt-canvas.js');
const interactionBlock = canvasMainContent.substring(intStart, intEnd);

const interactionSubmoduleJs = fs.readFileSync('vtt/js/canvas/vtt-canvas-interaction.js', 'utf8');
const interactionAssigns = [
    ...new Set([...interactionSubmoduleJs.matchAll(/ctx\.([a-zA-Z0-9_]+)\s*=/g)].map((m) => m[1]))
];

const intGetters = new Set([...interactionBlock.matchAll(/get\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));
const intSetters = new Set([...interactionBlock.matchAll(/set\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));

const intFailures = interactionAssigns.filter((p) => intGetters.has(p) && !intSetters.has(p));
assert.strictEqual(
    intFailures.length,
    0,
    `Properties assigned in vtt-canvas-interaction.js have getters but missing setters in interactionContext: ${intFailures.join(', ')}`
);
console.log(
    `  ✓ interactionContext verified: 0 missing setters across ${interactionAssigns.length} assigned properties.`
);

// 2. Verify clipboardContext
const clipStart = canvasMainContent.indexOf('const clipboardContext = {');
const clipEnd = canvasMainContent.indexOf('setupKeyboardShortcutsExt(clipboardContext);', clipStart);
assert.ok(clipStart > 0 && clipEnd > clipStart, 'clipboardContext block must be present in vtt-canvas.js');
const clipBlock = canvasMainContent.substring(clipStart, clipEnd);

const clipSubmoduleJs = fs.readFileSync('vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js', 'utf8');
const clipAssigns = [...new Set([...clipSubmoduleJs.matchAll(/ctx\.([a-zA-Z0-9_]+)\s*=/g)].map((m) => m[1]))];

const clipGetters = new Set([...clipBlock.matchAll(/get\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));
const clipSetters = new Set([...clipBlock.matchAll(/set\s+([a-zA-Z0-9_]+)\s*\(/g)].map((m) => m[1]));

const clipFailures = clipAssigns.filter((p) => clipGetters.has(p) && !clipSetters.has(p));
assert.strictEqual(
    clipFailures.length,
    0,
    `Properties assigned in vtt-canvas-clipboard-shortcuts.js have getters but missing setters in clipboardContext: ${clipFailures.join(', ')}`
);
console.log(`  ✓ clipboardContext verified: 0 missing setters across ${clipAssigns.length} assigned properties.`);

// ============================================================================
// Test Suite 4: Token Grid Snapping & Portal Handle Hit Contracts
// ============================================================================
console.log('\n[Suite 4] Token Grid Snapping & Portal Handles Contract');

const { snapToGrid } = await import('../vtt/js/canvas/vtt-canvas-grid-renderer.js');
const { getPortalHandleUnderMouse } = await import('../vtt/js/canvas/vtt-canvas-map-tools.js');

const sampleGrid = { size: 50, scale: 1, offsetX: 0, offsetY: 0, type: 'square' };

// Test 4.1: snapToGrid parameter order resilience
const snapStandard = snapToGrid(123, 187, true, sampleGrid);
const snapSwapped = snapToGrid(123, 187, sampleGrid, true);
assert.strictEqual(snapStandard.x, 100, 'snapToGrid must snap x=123 to 100 on 50px grid');
assert.strictEqual(snapStandard.y, 200, 'snapToGrid must snap y=187 to 200 on 50px grid');
assert.deepStrictEqual(
    snapStandard,
    snapSwapped,
    'snapToGrid must behave identically regardless of parameter order (isToken vs grid)'
);
console.log('  ✓ snapToGrid parameter order invariance and grid alignment verified.');

// Test 4.2: Portal handle hit detection under mouse
const samplePortal = {
    id: 'portal-1',
    type: 'portal',
    shape: 'line',
    geom: { x1: 100, y1: 100, x2: 300, y2: 100 },
    facingAngle: 90,
    isRadial: false
};
const portalHit = getPortalHandleUnderMouse({ x: 100, y: 100 }, 20, {
    portals: [samplePortal],
    selectedMapToolItem: samplePortal,
    activeLayer: 'portals',
    activeTool: 'maptools',
    zoom: 1,
    isGM: true
});
assert.ok(portalHit, 'getPortalHandleUnderMouse must detect handle when hovering endpoint of portal');
assert.strictEqual(portalHit.type, 'resize', 'Hovering line endpoint must detect resize handle');
console.log('  ✓ Portal handle detection and selection contracts verified.');

// ============================================================================
// Test Suite 5: Shortcuts, Portal Reflection Scaling & Chatcard Action Wiring
// ============================================================================
console.log('\n[Suite 5] Shortcuts, Portal Reflection Scaling & Chatcard Actions');

// 5.1 Test Token Rotation (Q/E) and Flipping (W/A/S/D) via keyboard shortcuts
ctx.selectedTokenIds.clear();
ctx.selectedTokenIds.add('tok-warrior');
ctx.tokens['tok-warrior'].rotation = 0;
ctx.tokens['tok-warrior'].flipX = false;
ctx.tokens['tok-warrior'].flipY = false;

// Press 'e' (rotate +45 deg)
window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
assert.strictEqual(ctx.tokens['tok-warrior'].rotation, 45, 'Pressing E must rotate token by +45 degrees');

// Press 'q' with Shift (rotate -5 deg)
window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'q', shiftKey: true, bubbles: true }));
assert.strictEqual(ctx.tokens['tok-warrior'].rotation, 40, 'Pressing Shift+Q must rotate token by -5 degrees');

// Press 'a' (flip horizontal true)
window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
assert.strictEqual(ctx.tokens['tok-warrior'].flipX, true, 'Pressing A must set flipX to true');

// Press 's' (flip vertical true)
window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 's', bubbles: true }));
assert.strictEqual(ctx.tokens['tok-warrior'].flipY, true, 'Pressing S must set flipY to true');
console.log('  ✓ Token rotation (Q/E) and flipping (W/A/S/D) shortcuts verified.');

// 5.2 Test Reflected Token Dimensions in drawTargetRoomContent
const { drawTargetRoomContent } = await import('../vtt/js/canvas/vtt-canvas-portals.js');
let requestedDimsForToken = null;
const mockCtx = new Proxy(
    {},
    {
        get: (target, prop) => {
            if (typeof prop === 'string' && prop.startsWith('set')) return () => {};
            return () => {};
        },
        set: () => true
    }
);

const largeToken = { id: 'large-ogre', size: 2, x: 200, y: 200, layer: 'token' };
drawTargetRoomContent(
    mockCtx,
    { grid: { size: 50, scale: 1 }, tokens: [largeToken] },
    'map-1',
    2000,
    1500,
    [largeToken],
    [],
    { x: 500, y: 500 },
    { x: 500, y: 500 },
    {
        getTokenDrawDimensions: (t) => {
            requestedDimsForToken = t.id;
            return { drawW: 100, drawH: 100, tokenRadius: 50 };
        }
    }
);
assert.strictEqual(
    requestedDimsForToken,
    'large-ogre',
    'drawTargetRoomContent must invoke custom getTokenDrawDimensions for true scale'
);
console.log('  ✓ Reflected token dimensions scale resolution verified.');

// 5.3 Test handleCardAction with selectedTokenIds wiring
const { handleCardAction } = await import('../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js');
let appliedDamageTotal = 0;
const testMonster = { id: 'tok-target', name: 'Goblin', hp: 20, maxHp: 20 };
handleCardAction({ dmgRolls: [{ roll: { total: 10 }, type: 'slashing' }] }, 'full', {
    vtt: { role: 'GM' },
    selectedTokenIds: new Set(['tok-target']),
    tokens: { 'tok-target': testMonster },
    syncHpFn: (tokensList) => {
        appliedDamageTotal = 20 - tokensList[0].hp;
    }
});
assert.strictEqual(appliedDamageTotal, 10, 'handleCardAction full damage must apply 10 damage to selected token');
console.log('  ✓ Chatcard handleCardAction damage processing verified.');

console.log('\n--- All Canvas Interaction & Submodule Integrity Tests Passed ---');
