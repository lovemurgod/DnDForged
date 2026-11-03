// Test Suite for Persistent Shapes Context Menu, Z-Ordering, Layering & Creature Selection
import assert from 'node:assert';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;

console.log('--- Starting Test Suite: Persistent Shapes Context Menu ---');

const { changeShapeZOrder, getPersistentShapeAtPoint, showShapeContextMenu, isTokenIntersectingShape } =
    await import('../vtt/js/canvas/vtt-canvas-shapes.js');

// =========================================================================
// Suite 1: Z-Ordering Logic
// =========================================================================
console.log('\n[Suite 1] changeShapeZOrder calculations');
{
    const shapes = {
        s1: { id: 's1', shape: 'circle', zIndex: 0 },
        s2: { id: 's2', shape: 'square', zIndex: 5 },
        s3: { id: 's3', shape: 'cone', zIndex: 10 }
    };

    let changed = false;
    const onShapesChanged = () => {
        changed = true;
    };

    // 1.1 Bring s1 to front
    changeShapeZOrder('s1', 'front', { shapes, onShapesChanged });
    assert.strictEqual(shapes.s1.zIndex, 11, 's1 should now have zIndex 11 (max 10 + 1)');
    assert.strictEqual(changed, true);

    // 1.2 Send s3 to back
    // Other shapes: s2 (5), s1 (11) -> min is 5, so s3 becomes 4
    changed = false;
    changeShapeZOrder('s3', 'back', { shapes, onShapesChanged });
    assert.strictEqual(shapes.s3.zIndex, 4, 's3 should now have zIndex 4 (min of other shapes 5 - 1)');
    assert.strictEqual(changed, true);

    // 1.3 Bring s3 forward one step
    // Current order: s3 (-1), s2 (5), s1 (11)
    changeShapeZOrder('s3', 'front-one', { shapes, onShapesChanged });
    assert.strictEqual(shapes.s3.zIndex >= 5, true, 's3 should have swapped or moved ahead of s2');

    // 1.4 Send s1 backward one step
    changeShapeZOrder('s1', 'back-one', { shapes, onShapesChanged });
    assert.strictEqual(shapes.s1.zIndex <= shapes.s3.zIndex, true, 's1 should have moved down');

    console.log('✓ Suite 1 passed: Z-order changes front, back, front-one, back-one operate cleanly');
}

// =========================================================================
// Suite 2: Topmost Shape Hit Testing by Z-Order & Layer
// =========================================================================
console.log('\n[Suite 2] getPersistentShapeAtPoint ordering');
{
    const shapes = {
        bottom: {
            id: 'bottom',
            shape: 'circle',
            startPoint: { x: 100, y: 100 },
            endPoint: { x: 200, y: 100 },
            layer: 'token',
            zIndex: 1
        },
        top: {
            id: 'top',
            shape: 'circle',
            startPoint: { x: 100, y: 100 },
            endPoint: { x: 200, y: 100 },
            layer: 'token',
            zIndex: 10
        },
        gmShape: {
            id: 'gmShape',
            shape: 'circle',
            startPoint: { x: 100, y: 100 },
            endPoint: { x: 200, y: 100 },
            layer: 'gm',
            zIndex: 20
        }
    };

    // 2.1 Returns topmost shape
    const hit = getPersistentShapeAtPoint({ x: 100, y: 100 }, shapes, { role: 'GM' });
    assert.strictEqual(hit.id, 'gmShape', 'GM should hit highest zIndex shape (gmShape)');

    // 2.2 For non-GM with layer matching on token layer, should hit top token-layer shape
    const hitPlayer = getPersistentShapeAtPoint({ x: 100, y: 100 }, shapes, {
        role: 'Player',
        activeLayer: 'token',
        matchLayer: true
    });
    assert.strictEqual(hitPlayer.id, 'top', 'Player should hit topmost token-layer shape (top)');

    console.log('✓ Suite 2 passed: Topmost shape hit testing with Z-order & layers is accurate');
}

// =========================================================================
// Suite 3: Context Menu DOM & Actions
// =========================================================================
console.log('\n[Suite 3] showShapeContextMenu DOM & Action Dispatch');
{
    const shape = {
        id: 'shape_test_1',
        shape: 'circle',
        layer: 'token',
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 200, y: 100 }
    };

    let selectedFilter = null;
    let movedLayer = null;
    let zOrderAction = null;
    let deletedShapeId = null;

    const context = {
        role: 'GM',
        onSelectCreatures: (s, filter) => {
            selectedFilter = filter;
        },
        onMoveToLayer: (id, layer) => {
            movedLayer = layer;
        },
        onZOrderChange: (id, action) => {
            zOrderAction = action;
        },
        onDeleteShape: (id) => {
            deletedShapeId = id;
        }
    };

    // 3.1 Render menu
    showShapeContextMenu(shape, 200, 300, context);
    const menuEl = document.getElementById('vtt-token-context-menu');
    assert.ok(menuEl, 'Context menu DOM element should exist');

    // 3.2 Verify submenus exist
    const creatureItems = menuEl.querySelectorAll('.menu-shape-select-creatures');
    assert.strictEqual(creatureItems.length, 3, 'Should have 3 creature select filter options (all, pc, npc)');

    const layerItems = menuEl.querySelectorAll('.menu-shape-move-layer');
    assert.strictEqual(layerItems.length, 3, 'Should have 3 layer options (token, gm, map)');

    const frontBtn = menuEl.querySelector('#menu-shape-front');
    const deleteBtn = menuEl.querySelector('#menu-shape-delete');
    assert.ok(frontBtn, 'Bring to front button should exist');
    assert.ok(deleteBtn, 'Delete shape button should exist');

    // 3.3 Test clicking creature select
    const pcItem = Array.from(creatureItems).find((el) => el.dataset.filter === 'pc');
    pcItem.click();
    assert.strictEqual(selectedFilter, 'pc', 'Should trigger onSelectCreatures with pc filter');

    // 3.4 Re-open and test layer move
    showShapeContextMenu(shape, 200, 300, context);
    const newMenuEl = document.getElementById('vtt-token-context-menu');
    const gmLayerItem = Array.from(newMenuEl.querySelectorAll('.menu-shape-move-layer')).find(
        (el) => el.dataset.layer === 'gm'
    );
    gmLayerItem.click();
    assert.strictEqual(movedLayer, 'gm', 'Should trigger onMoveToLayer with gm layer');

    // 3.5 Re-open and test Z-order click
    showShapeContextMenu(shape, 200, 300, context);
    const zMenu = document.getElementById('vtt-token-context-menu');
    zMenu.querySelector('#menu-shape-front').click();
    assert.strictEqual(zOrderAction, 'front', 'Should trigger onZOrderChange with front');

    // 3.6 Re-open and test Delete click
    showShapeContextMenu(shape, 200, 300, context);
    const delMenu = document.getElementById('vtt-token-context-menu');
    delMenu.querySelector('#menu-shape-delete').click();
    assert.strictEqual(deletedShapeId, 'shape_test_1', 'Should trigger onDeleteShape with shape id');

    console.log('✓ Suite 3 passed: Context menu renders cleanly and dispatches all actions');
}

// =========================================================================
// Suite 4: Creature Selection & Filtering
// =========================================================================
console.log('\n[Suite 4] Creature intersection & PC/NPC filtering');
{
    const circleShape = {
        id: 'aoe_circle',
        shape: 'circle',
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 150, y: 100 } // radius = 50
    };

    const tokens = {
        tok_pc: { id: 'tok_pc', x: 110, y: 110, isPlayer: true },
        tok_npc: { id: 'tok_npc', x: 120, y: 120, isPlayer: false },
        tok_far: { id: 'tok_far', x: 500, y: 500, isPlayer: false }
    };

    const getDims = () => ({ drawW: 50, drawH: 50 });

    const filterCreatures = (filterType) => {
        const targetIds = [];
        Object.entries(tokens).forEach(([id, tok]) => {
            if (!isTokenIntersectingShape(tok, circleShape, { getTokenDrawDimensions: getDims })) return;
            const isPlayerTok = Boolean(tok.isPlayer);
            if (filterType === 'pc' && !isPlayerTok) return;
            if (filterType === 'npc' && isPlayerTok) return;
            targetIds.push(id);
        });
        return targetIds;
    };

    assert.deepStrictEqual(filterCreatures('all').sort(), ['tok_npc', 'tok_pc'].sort());
    assert.deepStrictEqual(filterCreatures('pc'), ['tok_pc']);
    assert.deepStrictEqual(filterCreatures('npc'), ['tok_npc']);

    console.log('✓ Suite 4 passed: Creature intersection and PC/NPC filtering works as expected');
}

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
