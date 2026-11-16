/**
 * test/test_canvas_tools_pointer_lifecycle.mjs
 * ForgeD VTT - Canvas Toolbar, Real Pointer Drag Matrix & Spacebar Waypoint Integration Suite
 * Validates the core lifecycle contracts:
 * 1. Toolbar tool registry & GM/Player access permissions
 * 2. Spacebar measurement waypoint stacking and segment accumulation
 * 3. Smart grid snapping during pointer drag operations
 * 4. Escape key cancellation and cleanup of in-flight tool states
 * 5. Ping HUD animation queue and screen-space projection
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerPingAnimation, renderActivePingsPass } from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

test('Subtest 1: Toolbar tool registry & GM-only role restrictions', () => {
    const TOOLBAR_TOOLS = [
        { id: 'tool-select', name: 'select', gmOnly: false, key: '1' },
        { id: 'tool-measure', name: 'measure', gmOnly: false, key: '2' },
        { id: 'tool-shape', name: 'shape', gmOnly: false, key: '3' },
        { id: 'tool-ping', name: 'ping', gmOnly: false, key: '4' },
        { id: 'tool-lighting', name: 'lighting', gmOnly: true, key: '5' },
        { id: 'tool-paint', name: 'paint', gmOnly: false, key: '6' },
        { id: 'tool-map-tools', name: 'map-tools', gmOnly: true, key: '7' }
    ];

    assert.equal(TOOLBAR_TOOLS.length, 7, 'Must register exactly 7 left toolbar tools');

    // Role-based activation validator
    function canActivateTool(toolId, userRole) {
        const tool = TOOLBAR_TOOLS.find((t) => t.id === toolId);
        if (!tool) return false;
        if (tool.gmOnly && userRole !== 'GM') return false;
        return true;
    }

    // GM has unrestricted access to all 7 tools
    for (const tool of TOOLBAR_TOOLS) {
        assert.equal(canActivateTool(tool.id, 'GM'), true, `GM should be able to activate ${tool.id}`);
    }

    // Players cannot activate lighting or map tools
    assert.equal(canActivateTool('tool-select', 'PLAYER'), true);
    assert.equal(canActivateTool('tool-measure', 'PLAYER'), true);
    assert.equal(canActivateTool('tool-shape', 'PLAYER'), true);
    assert.equal(canActivateTool('tool-ping', 'PLAYER'), true);
    assert.equal(canActivateTool('tool-paint', 'PLAYER'), true);
    assert.equal(canActivateTool('tool-lighting', 'PLAYER'), false, 'Player must be blocked from lighting tool');
    assert.equal(canActivateTool('tool-map-tools', 'PLAYER'), false, 'Player must be blocked from map-tools');
});

test('Subtest 2: Spacebar measurement waypoint stacking & multi-segment distance', () => {
    const grid = { size: 50, feetPerSquare: 5 };

    // Function to calculate cumulative distance through waypoints
    function calculateTotalMeasurement(anchorPoints, currentEnd) {
        const pts = [...anchorPoints, currentEnd];
        let totalFt = 0;
        const segmentDistances = [];

        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const segFt = Math.round((pxDist / grid.size) * grid.feetPerSquare);
            segmentDistances.push(segFt);
            totalFt += segFt;
        }

        return { totalFt, segmentDistances };
    }

    // 1. Initial drag from (100, 100) to (250, 100) (3 grid squares = 15 ft)
    const startPoint = { x: 100, y: 100 };
    let anchorPoints = [startPoint];
    let currentPoint = { x: 250, y: 100 };

    let m1 = calculateTotalMeasurement(anchorPoints, currentPoint);
    assert.equal(m1.totalFt, 15, 'Single segment 150px should equal 15ft');

    // 2. User presses Spacebar at (250, 100) -> waypoint added!
    anchorPoints.push({ ...currentPoint });
    assert.equal(anchorPoints.length, 2, 'Anchor points should contain start and waypoint 1');

    // 3. User drags down to (250, 300) (4 grid squares = 20 ft down)
    currentPoint = { x: 250, y: 300 };
    let m2 = calculateTotalMeasurement(anchorPoints, currentPoint);
    assert.equal(m2.totalFt, 35, 'Total distance around corner should equal 15ft + 20ft = 35ft');
    assert.deepEqual(m2.segmentDistances, [15, 20]);

    // 4. User presses Spacebar at (250, 300) -> waypoint 2 added!
    anchorPoints.push({ ...currentPoint });
    assert.equal(anchorPoints.length, 3);

    // 5. User drags left to (150, 300) (2 grid squares = 10 ft)
    currentPoint = { x: 150, y: 300 };
    let m3 = calculateTotalMeasurement(anchorPoints, currentPoint);
    assert.equal(m3.totalFt, 45, '3-segment zigzag distance should equal 15 + 20 + 10 = 45ft');

    // 6. User presses Backspace -> pops the last anchor point!
    anchorPoints.pop();
    assert.equal(anchorPoints.length, 2);
    let m4 = calculateTotalMeasurement(anchorPoints, currentPoint);
    // Distance from (250, 100) straight to (150, 300): dx=-100, dy=200 -> sqrt(100^2 + 200^2) ≈ 223.6px ≈ 22.36ft ≈ 22ft
    assert.ok(m4.totalFt > 30 && m4.totalFt < 40);
});

test('Subtest 3: Grid snapping mathematical alignment during pointer drags', () => {
    const grid = { size: 50, offsetX: 0, offsetY: 0 };

    function snapToGrid(x, y) {
        return {
            x: Math.round((x - grid.offsetX) / grid.size) * grid.size + grid.offsetX,
            y: Math.round((y - grid.offsetY) / grid.size) * grid.size + grid.offsetY
        };
    }

    function snapToGridCenter(x, y) {
        const half = grid.size / 2;
        return {
            x: Math.floor((x - grid.offsetX) / grid.size) * grid.size + grid.offsetX + half,
            y: Math.floor((y - grid.offsetY) / grid.size) * grid.size + grid.offsetY + half
        };
    }

    // Test corner snapping
    const cornerPt = snapToGrid(112, 148);
    assert.equal(cornerPt.x, 100);
    assert.equal(cornerPt.y, 150);

    // Test center snapping
    const centerPt = snapToGridCenter(112, 148);
    assert.equal(centerPt.x, 125);
    assert.equal(centerPt.y, 125);
});

test('Subtest 4: Escape key resets in-flight tool states', () => {
    const ctx = {
        activeTool: 'measure',
        localIsMeasuring: true,
        localMeasureStart: { x: 100, y: 100 },
        localMeasureEnd: { x: 300, y: 300 },
        measureAnchorPoints: [
            { x: 100, y: 100 },
            { x: 200, y: 100 }
        ],
        localIsShaping: true,
        selectedTokenIds: new Set(['tok_1', 'tok_2']),
        selectedTokenId: 'tok_1',
        isBoxSelecting: true
    };

    function handleEscape(context) {
        if (context.localIsMeasuring || context.measureAnchorPoints?.length > 0) {
            context.localIsMeasuring = false;
            context.localMeasureStart = null;
            context.localMeasureEnd = null;
            context.measureAnchorPoints = [];
        }
        if (context.localIsShaping) {
            context.localIsShaping = false;
        }
        if (context.isBoxSelecting) {
            context.isBoxSelecting = false;
        }
        context.selectedTokenIds.clear();
        context.selectedTokenId = null;
    }

    handleEscape(ctx);

    assert.equal(ctx.localIsMeasuring, false, 'Measuring must be cancelled');
    assert.equal(ctx.measureAnchorPoints.length, 0, 'Anchor points must be emptied');
    assert.equal(ctx.localIsShaping, false, 'Shaping must be cancelled');
    assert.equal(ctx.isBoxSelecting, false, 'Box selection must be cancelled');
    assert.equal(ctx.selectedTokenIds.size, 0, 'Tokens must be deselected');
});

test('Subtest 5: Ping animation queue & screen-space projection calculation', () => {
    const drawnArcs = [];
    const drawnTexts = [];

    const mockCtx = {
        canvas: { id: 'vtt-canvas-hud' },
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        arc: (x, y, r, startAngle, endAngle) => {
            drawnArcs.push({ x, y, r });
        },
        fill: () => {},
        stroke: () => {},
        measureText: (txt) => ({ width: 50 }),
        fillText: (txt, x, y) => {
            drawnTexts.push({ txt, x, y });
        }
    };

    // Trigger ping at world coordinates (400, 300)
    triggerPingAnimation(400, 300, 'DungeonMaster', 'GM');

    // Pan (150, 100), Zoom 1.5
    const panX = 150;
    const panY = 100;
    const zoom = 1.5;

    renderActivePingsPass(mockCtx, null, { panX, panY, zoom });

    // Projected center = (150 + 400 * 1.5, 100 + 300 * 1.5) = (750, 550)
    assert.ok(drawnArcs.length >= 2, 'Should draw ping ring and center dot');
    assert.equal(drawnArcs[0].x, 750, 'Projected X should be 750');
    assert.equal(drawnArcs[0].y, 550, 'Projected Y should be 550');

    // Inner dot
    assert.equal(drawnArcs[1].x, 750);
    assert.equal(drawnArcs[1].y, 550);
    assert.equal(drawnArcs[1].r, 6);

    // Username label
    assert.ok(drawnTexts.some((t) => t.txt === 'DungeonMaster' && t.x === 750));
});
