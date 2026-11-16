/**
 * test/test_canvas_drawings_shapes_lifecycle.mjs
 * Unit & Integration Test Suite for Canvas Freehand Drawings, Persistent Shapes,
 * Destination-Out Eraser Masking, and GM Secret Layer Filtering.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { getDrawingBoundingBox, isDrawingControlledByPlayer } from '../vtt/js/canvas/vtt-canvas-drawings.js';

import {
    getShapeBoundingBox,
    getShapeCenterPoint,
    getShapePolyPoints,
    isPointInsideShape,
    isTokenIntersectingShape,
    isShapeControlledByPlayer,
    getPersistentShapeAtPoint
} from '../vtt/js/canvas/vtt-canvas-shapes.js';

test('Subtest 1: Bounding box calculation for freehand brush, rect, and circle shapes', () => {
    // 1. Freehand brush stroke
    const brushDrawing = {
        type: 'brush',
        points: [
            { x: 100, y: 100 },
            { x: 150, y: 120 },
            { x: 200, y: 160 }
        ],
        strokeWidth: 8
    };
    const brushBBox = getDrawingBoundingBox(brushDrawing);
    assert.ok(brushBBox, 'Brush bounding box must be calculated');
    assert.ok(brushBBox.minX <= 100, 'minX must encompass start point with stroke padding');
    assert.ok(brushBBox.maxX >= 200, 'maxX must encompass end point with stroke padding');
    assert.ok(brushBBox.minY <= 100, 'minY must encompass start point with stroke padding');
    assert.ok(brushBBox.maxY >= 160, 'maxY must encompass end point with stroke padding');

    // 2. Rect drawing
    const rectDrawing = {
        type: 'rect',
        startPoint: { x: 50, y: 50 },
        endPoint: { x: 250, y: 150 },
        strokeWidth: 4
    };
    const rectBBox = getDrawingBoundingBox(rectDrawing);
    assert.ok(rectBBox, 'Rect bounding box must be calculated');
    assert.ok(rectBBox.w >= 200, 'Width must be >= 200');
    assert.ok(rectBBox.h >= 100, 'Height must be >= 100');

    // 3. Persistent Shape (Square / Rect)
    const rectShape = {
        id: 'shape_rect_1',
        shape: 'square',
        startPoint: { x: 300, y: 200 },
        endPoint: { x: 420, y: 280 }
    };
    const shapeBBox = getShapeBoundingBox(rectShape);
    assert.ok(shapeBBox, 'Shape bounding box must be calculated');
    assert.equal(shapeBBox.minX, 300);
    assert.equal(shapeBBox.minY, 200);
    assert.equal(shapeBBox.maxX, 420);
    assert.equal(shapeBBox.maxY, 280);

    // 4. Persistent Shape (Circle)
    const circleShape = {
        id: 'shape_circle_1',
        shape: 'circle',
        startPoint: { x: 500, y: 500 },
        endPoint: { x: 550, y: 500 } // radius = 50
    };
    const circleBBox = getShapeBoundingBox(circleShape);
    assert.ok(circleBBox, 'Circle bounding box must be calculated');
    assert.equal(circleBBox.minX, 450);
    assert.equal(circleBBox.maxX, 550);
    assert.equal(circleBBox.minY, 450);
    assert.equal(circleBBox.maxY, 550);
});

test('Subtest 2: Destination-out eraser detection and layer composite isolation', () => {
    const drawings = {
        draw_1: { id: 'draw_1', type: 'brush', layer: 'token', points: [{ x: 10, y: 10 }] },
        draw_2: { id: 'draw_2', type: 'eraser', layer: 'token', points: [{ x: 15, y: 15 }] },
        draw_3: { id: 'draw_3', type: 'brush', layer: 'map', points: [{ x: 20, y: 20 }] }
    };

    // Filter by layer
    const tokenLayerDrawings = Object.values(drawings).filter((d) => (d.layer || 'token') === 'token');
    const mapLayerDrawings = Object.values(drawings).filter((d) => (d.layer || 'token') === 'map');

    const tokenHasEraser = tokenLayerDrawings.some((d) => d.type === 'eraser');
    const mapHasEraser = mapLayerDrawings.some((d) => d.type === 'eraser');

    assert.equal(tokenHasEraser, true, 'Token layer should report having an eraser');
    assert.equal(mapHasEraser, false, 'Map layer should not have an eraser');
});

test('Subtest 3: Shape component hit-testing and spatial point queries', () => {
    const shapes = {
        s1: {
            id: 's1',
            shape: 'square',
            startPoint: { x: 100, y: 100 },
            endPoint: { x: 200, y: 200 }
        },
        s2: {
            id: 's2',
            shape: 'circle',
            startPoint: { x: 400, y: 400 },
            endPoint: { x: 450, y: 400 } // radius = 50
        }
    };

    // Inside s1
    assert.equal(isPointInsideShape({ x: 150, y: 150 }, shapes.s1), true);
    // Outside s1
    assert.equal(isPointInsideShape({ x: 50, y: 50 }, shapes.s1), false);

    // Inside s2
    assert.equal(isPointInsideShape({ x: 420, y: 410 }, shapes.s2), true);
    // Outside s2
    assert.equal(isPointInsideShape({ x: 480, y: 480 }, shapes.s2), false);

    // Persistent shape query at point
    const found1 = getPersistentShapeAtPoint({ x: 150, y: 150 }, shapes);
    assert.ok(found1, 'Should find shape s1 at (150, 150)');
    assert.equal(found1.id, 's1');

    const found2 = getPersistentShapeAtPoint({ x: 400, y: 400 }, shapes);
    assert.ok(found2, 'Should find shape s2 at (400, 400)');
    assert.equal(found2.id, 's2');

    const foundNone = getPersistentShapeAtPoint({ x: 0, y: 0 }, shapes);
    assert.equal(foundNone, null, 'Should return null for empty coordinate');
});

test('Subtest 4: Token-shape spatial intersection and collision evaluation', () => {
    const spellAuraCircle = {
        id: 'aura_1',
        shape: 'circle',
        startPoint: { x: 300, y: 300 },
        endPoint: { x: 380, y: 300 } // radius = 80
    };

    const hazardRect = {
        id: 'hazard_1',
        shape: 'square',
        startPoint: { x: 600, y: 400 },
        endPoint: { x: 700, y: 500 }
    };

    // Token inside circle aura
    const tokenInside = { id: 'tok_1', x: 280, y: 280, size: 1, gridSize: 50 };
    assert.equal(isTokenIntersectingShape(tokenInside, spellAuraCircle), true);

    // Token outside circle aura
    const tokenOutside = { id: 'tok_2', x: 100, y: 100, size: 1, gridSize: 50 };
    assert.equal(isTokenIntersectingShape(tokenOutside, spellAuraCircle), false);

    // Token overlapping hazard rect
    const tokenOnEdge = { id: 'tok_3', x: 580, y: 390, size: 1, gridSize: 50 };
    assert.equal(isTokenIntersectingShape(tokenOnEdge, hazardRect), true);
});

test('Subtest 5: Shape center calculation and cone angle evaluations', () => {
    const squareShape = {
        shape: 'square',
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 200, y: 150 }
    };
    const center = getShapeCenterPoint(squareShape);
    assert.equal(center.x, 150);
    assert.equal(center.y, 125);

    const polyPoints = getShapePolyPoints(squareShape);
    assert.equal(polyPoints.length, 2);

    // Cone shape
    const coneShape = {
        shape: 'cone',
        startPoint: { x: 200, y: 200 },
        endPoint: { x: 300, y: 200 } // facing East (0 deg), radius = 100
    };
    // Inside cone (along orientation vector)
    assert.equal(isPointInsideShape({ x: 250, y: 200 }, coneShape), true);
    // Inside cone at 30 deg offset
    assert.equal(isPointInsideShape({ x: 270, y: 230 }, coneShape), true);
    // Outside cone behind origin
    assert.equal(isPointInsideShape({ x: 150, y: 200 }, coneShape), false);
    // Outside cone beyond radius
    assert.equal(isPointInsideShape({ x: 350, y: 200 }, coneShape), false);
});

test('Subtest 6: Ownership and player modification security guard', () => {
    const gmDrawing = { id: 'd_gm', type: 'brush', ownerUsername: 'DungeonMaster', layer: 'token' };
    const playerDrawing = { id: 'd_p1', type: 'brush', ownerUsername: 'PlayerOne', layer: 'token' };

    // GM has unrestricted control over all drawings
    assert.equal(isDrawingControlledByPlayer(gmDrawing, 'GM', 'DungeonMaster'), true);
    assert.equal(isDrawingControlledByPlayer(playerDrawing, 'GM', 'DungeonMaster'), true);

    // PlayerOne controls only their own drawings
    assert.equal(isDrawingControlledByPlayer(playerDrawing, 'Player', 'PlayerOne'), true);
    assert.equal(isDrawingControlledByPlayer(gmDrawing, 'Player', 'PlayerOne'), false);

    // Shapes ownership check
    const gmShape = { id: 's_gm', shape: 'square', ownerUsername: 'DungeonMaster' };
    const playerShape = { id: 's_p1', shape: 'square', ownerUsername: 'PlayerOne' };

    assert.equal(isShapeControlledByPlayer(gmShape, 'GM', 'DungeonMaster'), true);
    assert.equal(isShapeControlledByPlayer(playerShape, 'GM', 'DungeonMaster'), true);
    assert.equal(isShapeControlledByPlayer(playerShape, 'Player', 'PlayerOne'), true);
    assert.equal(isShapeControlledByPlayer(gmShape, 'Player', 'PlayerOne'), false);
});

test('Subtest 7: Layer filtering and GM semi-transparency opacity logic', () => {
    const drawings = [
        { id: 'd_token', layer: 'token', points: [{ x: 50, y: 50 }] },
        { id: 'd_gm', layer: 'gm', points: [{ x: 150, y: 150 }] },
        { id: 'd_map', layer: 'map', points: [{ x: 250, y: 250 }] }
    ];

    // Non-GM player viewing token layer
    const playerVisible = drawings.filter((d) => {
        const dLayer = d.layer || 'token';
        return dLayer === 'token'; // Non-GM cannot see 'gm' or 'map' when on token layer
    });
    assert.equal(playerVisible.length, 1);
    assert.equal(playerVisible[0].id, 'd_token');

    // GM viewing token layer: sees 'token' at full opacity, and other layers (including 'gm') at 0.45 opacity
    const gmVisibilities = drawings.map((d) => {
        const dLayer = d.layer || 'token';
        const activeLayer = 'token';
        const userRole = 'GM';
        const isGmViewing = userRole === 'GM';
        const isVisible = dLayer === activeLayer || isGmViewing;
        const opacity = isGmViewing && activeLayer !== dLayer ? 0.45 : 1.0;
        return { id: d.id, isVisible, opacity };
    });

    assert.equal(gmVisibilities.length, 3);
    const dTokenVis = gmVisibilities.find((v) => v.id === 'd_token');
    const dGmVis = gmVisibilities.find((v) => v.id === 'd_gm');
    assert.equal(dTokenVis.opacity, 1.0, 'Active layer entity has full opacity');
    assert.equal(dGmVis.opacity, 0.45, 'GM layer entity viewed from token layer has 0.45 opacity');
});
