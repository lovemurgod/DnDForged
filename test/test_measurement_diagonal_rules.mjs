import assert from 'node:assert';
import {
    getGridDistanceSettings,
    calcPointsDistance,
    calcPolylineGridDistance,
    calcDistanceFormatted,
    calcDistanceFt
} from '../vtt/js/canvas/vtt-canvas-measure.js';

console.log('--- Running Diagonal Measurement Rules Test Suite ---');

const grid5ft = {
    size: 50,
    scale: 1.0,
    feetPerSquare: 5,
    distancePerSquare: 5,
    distanceUnit: 'ft',
    type: 'square',
    diagonalRule: '5ft'
};

const grid5105 = {
    size: 50,
    scale: 1.0,
    feetPerSquare: 5,
    distancePerSquare: 5,
    distanceUnit: 'ft',
    type: 'square',
    diagonalRule: '5-10-5'
};

const gridHex = {
    size: 50,
    scale: 1.0,
    feetPerSquare: 5,
    distancePerSquare: 5,
    distanceUnit: 'ft',
    type: 'hex-v'
};

// 1. Settings resolution
console.log('Test: getGridDistanceSettings defaults to 5ft');
assert.strictEqual(getGridDistanceSettings(grid5ft).diagonalRule, '5ft');
assert.strictEqual(getGridDistanceSettings(grid5105).diagonalRule, '5-10-5');
assert.strictEqual(getGridDistanceSettings({}).diagonalRule, '5ft'); // Default when unspecified

// 2. 5ft / Square (PHB Standard) - Equal Diagonals
console.log('Test: 5ft/square diagonal steps');
// 1 diagonal (50px, 50px)
const d1_5ft = calcDistanceFormatted(null, grid5ft, { start: { x: 0, y: 0 }, end: { x: 50, y: 50 } });
assert.strictEqual(d1_5ft.distance, 5, '1 diagonal on 5ft/square should be 5 ft');
assert.strictEqual(d1_5ft.label, '5 ft');

// 2 diagonals (100px, 100px)
const d2_5ft = calcDistanceFormatted(null, grid5ft, { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } });
assert.strictEqual(d2_5ft.distance, 10, '2 diagonals on 5ft/square should be 10 ft');

// 3 diagonals (150px, 150px)
const d3_5ft = calcDistanceFormatted(null, grid5ft, { start: { x: 0, y: 0 }, end: { x: 150, y: 150 } });
assert.strictEqual(d3_5ft.distance, 15, '3 diagonals on 5ft/square should be 15 ft');

// 4 diagonals (200px, 200px)
const d4_5ft = calcDistanceFormatted(null, grid5ft, { start: { x: 0, y: 0 }, end: { x: 200, y: 200 } });
assert.strictEqual(d4_5ft.distance, 20, '4 diagonals on 5ft/square should be 20 ft');

// Mixed movement: 2 squares horizontal, 1 vertical
const knight_5ft = calcDistanceFormatted(null, grid5ft, { start: { x: 0, y: 0 }, end: { x: 100, y: 50 } });
assert.strictEqual(knight_5ft.distance, 10, 'max(2, 1) on 5ft/square should be 10 ft');

// 3. 5-10-5 (DMG Variant) - Alternating Diagonals
console.log('Test: 5-10-5 diagonal steps');
// 1 diagonal (50px, 50px) -> 5 ft
const d1_5105 = calcDistanceFormatted(null, grid5105, { start: { x: 0, y: 0 }, end: { x: 50, y: 50 } });
assert.strictEqual(d1_5105.distance, 5, '1 diagonal on 5-10-5 should be 5 ft');

// 2 diagonals (100px, 100px) -> 5 + 10 = 15 ft
const d2_5105 = calcDistanceFormatted(null, grid5105, { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } });
assert.strictEqual(d2_5105.distance, 15, '2 diagonals on 5-10-5 should be 15 ft');

// 3 diagonals (150px, 150px) -> 15 + 5 = 20 ft
const d3_5105 = calcDistanceFormatted(null, grid5105, { start: { x: 0, y: 0 }, end: { x: 150, y: 150 } });
assert.strictEqual(d3_5105.distance, 20, '3 diagonals on 5-10-5 should be 20 ft');

// 4 diagonals (200px, 200px) -> 20 + 10 = 30 ft
const d4_5105 = calcDistanceFormatted(null, grid5105, { start: { x: 0, y: 0 }, end: { x: 200, y: 200 } });
assert.strictEqual(d4_5105.distance, 30, '4 diagonals on 5-10-5 should be 30 ft');

// Mixed movement on 5-10-5: 2 squares horizontal, 1 vertical -> 1 diagonal (5ft) + 1 straight (5ft) = 10 ft
const knight_5105 = calcDistanceFormatted(null, grid5105, { start: { x: 0, y: 0 }, end: { x: 100, y: 50 } });
assert.strictEqual(knight_5105.distance, 10, '2 horizontal 1 vertical on 5-10-5 should be 10 ft');

// 4. Multi-segment Polyline (Waypoints)
console.log('Test: Multi-segment waypoints distance tracking');
// Waypoints on 5ft/square: (0,0) -> (50,50) [1 diag: 5ft] -> (100,100) [1 diag: 5ft] -> total 10 ft
const waypoints_5ft = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
    { x: 100, y: 100 }
];
const wpDist_5ft = calcDistanceFormatted(null, grid5ft, waypoints_5ft);
assert.strictEqual(wpDist_5ft.distance, 10, 'Two 1-diagonal segments on 5ft/square should be 10 ft');

// Waypoints on 5-10-5: (0,0) -> (50,50) [1st diag: 5ft] -> (100,100) [2nd diag: 10ft] -> total 15 ft
const waypoints_5105 = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },
    { x: 100, y: 100 }
];
const wpDist_5105 = calcDistanceFormatted(null, grid5105, waypoints_5105);
assert.strictEqual(wpDist_5105.distance, 15, 'Two 1-diagonal segments on 5-10-5 should carry over diagonal alternation (15 ft)');

// Waypoints with straight segment between diagonals on 5-10-5:
// 1 diag (5ft) -> 2 straight (10ft) -> 1 diag (2nd diag: 10ft) -> total 25 ft (DMG p. 252 example)
const dmgExampleWaypoints = [
    { x: 0, y: 0 },
    { x: 50, y: 50 },     // 1 diag (5ft)
    { x: 150, y: 50 },    // 2 straight (10ft)
    { x: 200, y: 100 }    // 1 diag (2nd diag, counts as 10ft) -> 25ft
];
const wpDmg = calcDistanceFormatted(null, grid5105, dmgExampleWaypoints);
assert.strictEqual(wpDmg.distance, 25, 'DMG example with straight between diagonals should carry over diagonal count (25 ft)');

// 5. Hex Grid Behavior
console.log('Test: Hex grid Euclidean distance preservation');
const hexDist = calcDistanceFormatted(null, gridHex, { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } });
// 141.42 px / 50 * 5 = 14.14 -> rounds to 15 ft
assert.strictEqual(hexDist.distance, 15, 'Hex grid should compute geometric distance');

// 6. Backward Compatibility for Pixel-only calls
console.log('Test: Pixel-only distance formatting compatibility');
const pxOnly = calcDistanceFormatted(100, grid5ft);
assert.strictEqual(pxOnly.distance, 10);
assert.strictEqual(calcDistanceFt(100, grid5ft), 10);

console.log('All diagonal measurement tests passed successfully!');
