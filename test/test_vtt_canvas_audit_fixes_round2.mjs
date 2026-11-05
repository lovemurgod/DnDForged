import assert from 'node:assert';
import { setMapBackground } from '../vtt/js/canvas/vtt-canvas-camera.js';
import { setupModalOutsideClick } from '../vtt/js/canvas/vtt-canvas-wall-modals.js';
import { isTokenCollidingWithPortal } from '../vtt/js/canvas/vtt-canvas-portals.js';
import { isTokenWithinSelection } from '../vtt/js/canvas/vtt-canvas-interaction-tools.js';

console.log('--- Running VTT Canvas Audit Fixes Round 2 Verification Suite ---');

// Test 1: F-01 - setMapBackground does not overwrite decorative props with isAsset: true
{
    global.document = {
        getElementById: () => null
    };
    const mapId = 'test_map_1';
    const mockVtt = {
        campaignState: {
            activeMapId: mapId,
            maps: {
                [mapId]: {
                    tokens: {
                        prop_tree: {
                            id: 'prop_tree',
                            layer: 'map',
                            isAsset: true,
                            isBackground: false,
                            img: 'tree.png'
                        }
                    }
                }
            }
        }
    };
    const ctx = { vtt: mockVtt, currentMapId: mapId };
    await setMapBackground('new_map.png', ctx);

    // Tree prop must remain untouched
    assert.strictEqual(
        mockVtt.campaignState.maps[mapId].tokens.prop_tree.img,
        'tree.png',
        'Tree prop on map layer should not be overwritten'
    );
    // Background token should be created under asset_${mapId}_bg
    const bgToken = mockVtt.campaignState.maps[mapId].tokens[`asset_${mapId}_bg`];
    assert.ok(bgToken, 'Dedicated background asset token should be created');
    assert.strictEqual(bgToken.img, 'new_map.png');
    assert.strictEqual(bgToken.isBackground, true);
    console.log('✓ Test 1 Passed: Map assets on map layer are protected from background overwrite');
}

// Test 2: F-03 - setupModalOutsideClick listener cleanup
{
    let listenerCount = 0;
    const windowMock = {
        addEventListener: (event, fn) => {
            if (event === 'mousedown') listenerCount++;
        },
        removeEventListener: (event, fn) => {
            if (event === 'mousedown') listenerCount--;
        }
    };
    global.window = windowMock;
    global.document = {
        body: {
            contains: () => true
        }
    };

    const dummyPopup = {
        contains: () => false,
        remove: () => {}
    };

    setupModalOutsideClick(dummyPopup);
    // Give timeout time to fire
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.strictEqual(listenerCount, 1, 'Mousedown listener should be registered after delay');

    // Trigger cleanup
    dummyPopup._cleanupOutsideClick();
    assert.strictEqual(listenerCount, 0, 'Mousedown listener should be removed on cleanup');
    console.log('✓ Test 2 Passed: Modal outside-click listener is properly cleaned up on dismiss');
}

// Test 3: F-04 - Line portal collision footprint
{
    const portal = {
        shape: 'line',
        geom: {
            x1: 100,
            y1: 100,
            x2: 100,
            y2: 300
        }
    };

    // 50px wide token whose center is at x=115 (15px away from the segment, but body reaches x=90 to 140)
    // Old implementation failed because distSq = 15*15 = 225 > 16.
    const token = { x: 90, y: 150 };
    const getTokenDims = () => ({ drawW: 50, drawH: 50 });

    const colliding = isTokenCollidingWithPortal(token, portal, null, null, getTokenDims);
    assert.strictEqual(colliding, true, 'Token stepping on line portal within radius should collide');

    // Token completely far away (x=160, center=185 -> dist=85 > 25)
    const tokenFar = { x: 160, y: 150 };
    const collidingFar = isTokenCollidingWithPortal(tokenFar, portal, null, null, getTokenDims);
    assert.strictEqual(collidingFar, false, 'Far token should not collide');
    console.log('✓ Test 3 Passed: Line portal collision accounts for token radius footprint');
}

// Test 4: F-05 - Marquee box selection intersects token bounding box
{
    // A Large token (100x100) from (100, 100) to (200, 200). Center is at (150, 150).
    const largeToken = { x: 100, y: 100 };
    const dims = () => ({ drawW: 100, drawH: 100 });

    // Marquee rect that covers (50, 50) to (120, 120).
    // It overlaps 20px into the token's top-left corner, but does NOT contain center (150, 150).
    const rectCorner = { x1: 50, y1: 50, x2: 120, y2: 120 };

    const selected = isTokenWithinSelection(largeToken, rectCorner, dims);
    assert.strictEqual(selected, true, 'Bounding box overlap should select token');

    // Non-overlapping rect
    const rectOutside = { x1: 0, y1: 0, x2: 50, y2: 50 };
    const notSelected = isTokenWithinSelection(largeToken, rectOutside, dims);
    assert.strictEqual(notSelected, false, 'Non-overlapping rect should not select token');
    console.log('✓ Test 4 Passed: Marquee selection works with token AABB intersection');
}

console.log('\nAll VTT Canvas Audit Round 2 Fix tests passed successfully!');
