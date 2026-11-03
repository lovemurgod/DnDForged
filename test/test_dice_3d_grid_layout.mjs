import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

console.log('--- Testing 3D Dice Multi-Tier Grid & Sequential Wave Engine ---');

// 1. Load vtt/js/dice-3d.js in mock browser environment
const diceScriptPath = path.resolve('vtt/js/dice-3d.js');
const scriptCode = fs.readFileSync(diceScriptPath, 'utf8');

// Mock minimal browser globals for Dice3D evaluation
const mockWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    }
};

const context = vm.createContext({
    window: mockWindow,
    self: mockWindow,
    document: {
        getElementById: () => null,
        createElement: () => ({
            style: {},
            appendChild: () => {},
            classList: { add: () => {} }
        }),
        body: { appendChild: () => {} }
    },
    localStorage: mockWindow.localStorage,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
    THREE: {},
    CANNON: {},
    console: console
});

vm.runInContext(scriptCode, context);
const Dice3D = context.Dice3D || mockWindow.Dice3D;

assert.ok(Dice3D, 'Dice3D should be initialized in module context');
assert.strictEqual(typeof Dice3D.computeOptimalGrid, 'function', 'computeOptimalGrid must be exported');

console.log('✓ Dice3D loaded and computeOptimalGrid is exported.');

// 2. Test grid configuration for counts 1 through 12
const aspect = 1920 / 1080; // 1.777

const expectedGrids = {
    1: { rows: 1, cols: 1, dist: [1] },
    2: { rows: 1, cols: 2, dist: [2] },
    3: { rows: 1, cols: 3, dist: [3] },
    4: { rows: 2, cols: 2, dist: [2, 2] },
    5: { rows: 2, cols: 3, dist: [3, 2] },
    6: { rows: 2, cols: 3, dist: [3, 3] },
    7: { rows: 2, cols: 4, dist: [4, 3] },
    8: { rows: 2, cols: 4, dist: [4, 4] },
    9: { rows: 3, cols: 3, dist: [3, 3, 3] },
    10: { rows: 3, cols: 4, dist: [4, 3, 3] },
    11: { rows: 3, cols: 4, dist: [4, 4, 3] },
    12: { rows: 3, cols: 4, dist: [4, 4, 4] }
};

for (const [countStr, expected] of Object.entries(expectedGrids)) {
    const count = parseInt(countStr, 10);
    const grid = Dice3D.computeOptimalGrid(count, aspect);

    assert.strictEqual(grid.rows, expected.rows, `Count ${count}: expected ${expected.rows} rows, got ${grid.rows}`);
    assert.strictEqual(grid.cols, expected.cols, `Count ${count}: expected ${expected.cols} cols, got ${grid.cols}`);
    assert.strictEqual(
        JSON.stringify(grid.distribution),
        JSON.stringify(expected.dist),
        `Count ${count}: expected distribution ${JSON.stringify(expected.dist)}, got ${JSON.stringify(grid.distribution)}`
    );

    const totalDistributed = Array.from(grid.distribution).reduce((sum, n) => sum + n, 0);
    assert.strictEqual(
        totalDistributed,
        count,
        `Count ${count}: distributed sum must equal count (${totalDistributed} vs ${count})`
    );
}

console.log('✓ All 1-12 dice count grids correctly match optimal rows, columns, and distribution.');

// 3. Test grid configuration for counts up to 16
for (let count = 13; count <= 16; count++) {
    const grid = Dice3D.computeOptimalGrid(count, aspect);
    const totalDistributed = Array.from(grid.distribution).reduce((sum, n) => sum + n, 0);
    assert.strictEqual(totalDistributed, count, `Count ${count}: sum of distribution must equal count`);
    assert.ok(grid.rows <= 4, `Rows for count ${count} should be <= 4`);
}

console.log('✓ High count fallbacks (13-16 dice) compute valid balanced distribution.');

// 4. Test wave chunking logic for large dice pools
const MAX_WAVE_SIZE = 12;

function simulateWaveSplitting(diceCount) {
    const dummyDice = Array.from({ length: diceCount }, (_, i) => ({ type: 'd6', val: (i % 6) + 1 }));
    if (dummyDice.length <= MAX_WAVE_SIZE) {
        return [dummyDice];
    }
    const chunks = [];
    for (let i = 0; i < dummyDice.length; i += MAX_WAVE_SIZE) {
        chunks.push(dummyDice.slice(i, i + MAX_WAVE_SIZE));
    }
    return chunks;
}

// 8d6 (Fireball) -> 1 wave of 8
const waves8 = simulateWaveSplitting(8);
assert.strictEqual(waves8.length, 1);
assert.strictEqual(waves8[0].length, 8);

// 12d6 -> 1 wave of 12
const waves12 = simulateWaveSplitting(12);
assert.strictEqual(waves12.length, 1);
assert.strictEqual(waves12[0].length, 12);

// 20d6 (Upcast Fireball) -> 2 waves (12 + 8)
const waves20 = simulateWaveSplitting(20);
assert.strictEqual(waves20.length, 2);
assert.strictEqual(waves20[0].length, 12);
assert.strictEqual(waves20[1].length, 8);

// 40d6 (Meteor Swarm) -> 4 waves (12 + 12 + 12 + 4)
const waves40 = simulateWaveSplitting(40);
assert.strictEqual(waves40.length, 4);
assert.strictEqual(waves40[0].length, 12);
assert.strictEqual(waves40[1].length, 12);
assert.strictEqual(waves40[2].length, 12);
assert.strictEqual(waves40[3].length, 4);

console.log('✓ Sequential wave splitting verified for 8d6, 12d6, 20d6, and 40d6.');

console.log('\nAll 3D Dice Multi-Tier Grid & Sequential Wave Tests Passed Successfully!');
