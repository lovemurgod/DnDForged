import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
    getSafeVttUrl,
    escapeHtml,
    stripHtml,
    clamp,
    lerp,
    normalizeAngleRad,
    debounce,
    throttle
} from '../vtt/js/vtt-utils.js';
import { VttEventBus, vttEventBus } from '../vtt/js/vtt-event-bus.js';
import {
    intersectsAABB,
    containsAABB,
    computeWallAABB,
    SpatialQuadTree,
    WallSpatialIndex
} from '../vtt/js/canvas/vtt-spatial-quadtree.js';
import { computeVisibilityPolygon } from '../vtt/js/canvas/vtt-canvas-visibility.js';

test('Suite 18: vtt-utils.js utility primitives', async (t) => {
    await t.test('getSafeVttUrl properly proxies Discord and preserves clean URLs', () => {
        assert.equal(getSafeVttUrl(null), null);
        assert.equal(getSafeVttUrl(123), 123);
        assert.equal(getSafeVttUrl('assets/map.png'), 'assets/map.png');

        const discordUrl = 'https://cdn.discordapp.com/attachments/123/456/token.png';
        const proxied = getSafeVttUrl(discordUrl);
        assert.ok(proxied.startsWith('/api/proxy-discord?url='), 'Must proxy discord URL');
        assert.ok(proxied.includes(encodeURIComponent(discordUrl)));

        const bestiaryUrl = 'img/bestiary/tokens/MM/Goblin.webp';
        const safeBestiary = getSafeVttUrl(bestiaryUrl);
        assert.ok(safeBestiary.startsWith('img/bestiary/tokens/MM/Goblin.webp?v='), 'Must version bestiary token URL');
    });

    await t.test('escapeHtml and stripHtml sanitize strings', () => {
        assert.equal(escapeHtml(null), '');
        assert.equal(escapeHtml('Hello <World> & "Friends"'), 'Hello &lt;World&gt; &amp; &quot;Friends&quot;');
        assert.equal(stripHtml('<p>Text with <b>bold</b></p>'), 'Text with bold');
        assert.equal(stripHtml(''), '');
    });

    await t.test('clamp, lerp, and normalizeAngleRad mathematical primitives', () => {
        assert.equal(clamp(5, 0, 10), 5);
        assert.equal(clamp(-5, 0, 10), 0);
        assert.equal(clamp(15, 0, 10), 10);
        assert.equal(clamp(NaN, 0, 10), 0);

        assert.equal(lerp(0, 100, 0.5), 50);
        assert.equal(lerp(10, 20, 0), 10);
        assert.equal(lerp(10, 20, 1), 20);

        assert.ok(Math.abs(normalizeAngleRad(0) - 0) < 0.0001);
        assert.ok(Math.abs(normalizeAngleRad(Math.PI * 2) - 0) < 0.0001);
        assert.ok(Math.abs(normalizeAngleRad(-Math.PI / 2) - Math.PI * 1.5) < 0.0001);
    });

    await t.test('debounce and throttle timing functions', async () => {
        let debouncedCalls = 0;
        const debounced = debounce(() => {
            debouncedCalls++;
        }, 20);
        debounced();
        debounced();
        debounced();
        assert.equal(debouncedCalls, 0, 'Debounced calls must not execute immediately');
        await new Promise((r) => setTimeout(r, 40));
        assert.equal(debouncedCalls, 1, 'Debounced calls must execute exactly once');

        let throttledCalls = 0;
        const throttled = throttle(() => {
            throttledCalls++;
        }, 20);
        throttled();
        throttled();
        assert.equal(throttledCalls, 1, 'Throttled calls must execute leading invocation immediately');
        await new Promise((r) => setTimeout(r, 30));
        throttled();
        assert.equal(throttledCalls, 2, 'Throttled calls must execute after interval');
    });
});

test('Suite 18: vtt-event-bus.js pub/sub and legacy shims', async (t) => {
    await t.test('on, off, emit, and once event dispatching', () => {
        const bus = new VttEventBus();
        const received = [];
        const unsub = bus.on('test:event', (data) => received.push(data));

        bus.emit('test:event', { id: 1 });
        bus.emit('test:event', { id: 2 });
        assert.deepEqual(received, [{ id: 1 }, { id: 2 }]);

        unsub();
        bus.emit('test:event', { id: 3 });
        assert.equal(received.length, 2, 'Should not receive after unsubscribe');

        let onceVal = 0;
        bus.once('once:event', (v) => {
            onceVal = v;
        });
        bus.emit('once:event', 42);
        bus.emit('once:event', 99);
        assert.equal(onceVal, 42, 'once listener must only fire once');
    });

    await t.test('wildcard listeners and error boundary isolation', () => {
        const bus = new VttEventBus();
        const wildcardReceived = [];
        bus.on('token:*', (data, topic) => wildcardReceived.push({ topic, data }));

        bus.emit('token:update', { token: 't1' });
        bus.emit('token:delete', { token: 't2' });
        bus.emit('other:event', { token: 't3' });

        assert.equal(wildcardReceived.length, 2);
        assert.equal(wildcardReceived[0].topic, 'token:update');
        assert.equal(wildcardReceived[1].topic, 'token:delete');

        // Error boundary: listener throws, but second listener still receives event
        let safeReceived = false;
        bus.on('error:test', () => {
            throw new Error('Simulated listener failure');
        });
        bus.on('error:test', () => {
            safeReceived = true;
        });

        bus.emit('error:test', {});
        assert.ok(safeReceived, 'Throwing listener must not halt execution of other listeners');
    });

    await t.test('backward compatibility shims via window.VTT.eventBus', () => {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost:5050'
        });
        global.window = dom.window;

        // Initialize shims in window environment
        const bus = new VttEventBus();
        window.VTT = { eventBus: bus };
        window.emitTokenUpdates = (d) => bus.emit('token:update', d);
        window.switchActiveLayer = (l) => bus.emit('layer:change', l);
        window.showToast = (msg, type) => bus.emit('toast:show', { msg, type });

        let tokenUpdated = null;
        let layerChanged = null;
        let toastShown = null;

        bus.on('token:update', (d) => {
            tokenUpdated = d;
        });
        bus.on('layer:change', (l) => {
            layerChanged = l;
        });
        bus.on('toast:show', (t) => {
            toastShown = t;
        });

        window.emitTokenUpdates([{ id: 'tok_1' }]);
        window.switchActiveLayer('walls');
        window.showToast('Wall saved', 'success');

        assert.deepEqual(tokenUpdated, [{ id: 'tok_1' }]);
        assert.equal(layerChanged, 'walls');
        assert.deepEqual(toastShown, { msg: 'Wall saved', type: 'success' });
    });
});

test('Suite 18: vtt-spatial-quadtree.js primitives', async (t) => {
    await t.test('AABB intersection and containment helpers', () => {
        const a = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        const b = { minX: 50, minY: 50, maxX: 150, maxY: 150 };
        const c = { minX: 200, minY: 200, maxX: 300, maxY: 300 };

        assert.ok(intersectsAABB(a, b), 'a and b should intersect');
        assert.ok(!intersectsAABB(a, c), 'a and c should not intersect');

        const parent = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
        assert.ok(containsAABB(parent, a), 'parent should contain a');
        assert.ok(!containsAABB(a, parent), 'a should not contain parent');

        const wall = { x1: 10, y1: 20, x2: 30, y2: 40 };
        const wallBox = computeWallAABB(wall, 5);
        assert.equal(wallBox.minX, 5);
        assert.equal(wallBox.minY, 15);
        assert.equal(wallBox.maxX, 35);
        assert.equal(wallBox.maxY, 45);
    });

    await t.test('SpatialQuadTree insertion, subdivision, and range queries', () => {
        const tree = new SpatialQuadTree({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, 4, 4);

        // Insert items in various quadrants
        for (let i = 0; i < 20; i++) {
            const x = i * 40;
            const y = i * 40;
            tree.insert({ id: `item_${i}` }, { minX: x, minY: y, maxX: x + 10, maxY: y + 10 });
        }

        assert.equal(tree.size, 20);

        // Query top-left corner
        const tlResults = tree.queryRange({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
        assert.ok(tlResults.length > 0, 'Should find items in top-left quadrant');
        assert.ok(tlResults.some((item) => item.id === 'item_0'));

        // Query bottom-right
        const brResults = tree.queryRange({ minX: 700, minY: 700, maxX: 900, maxY: 900 });
        assert.ok(brResults.length > 0, 'Should find items in bottom-right quadrant');
        assert.ok(brResults.some((item) => item.id === 'item_19'));

        // Query disjoint area
        const emptyResults = tree.queryRange({ minX: 0, minY: 800, maxX: 100, maxY: 900 });
        assert.equal(emptyResults.length, 0, 'Disjoint area must return 0 items');

        // Query point
        const pointResults = tree.queryPoint(0, 0, 20);
        assert.ok(pointResults.some((item) => item.id === 'item_0'));

        // Clear
        tree.clear();
        assert.equal(tree.size, 0);
        assert.equal(tree.queryRange({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }).length, 0);
    });
});

test('Suite 18: WallSpatialIndex & Raycasting Parity + Benchmark', async (t) => {
    // Generate synthetic dungeon map with 500 walls
    const mapWidth = 4000;
    const mapHeight = 4000;
    const walls = [];

    // Deterministic pseudo-random walls
    let seed = 123456789;
    function rand() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    }

    for (let i = 0; i < 500; i++) {
        const x1 = Math.floor(rand() * (mapWidth - 200));
        const y1 = Math.floor(rand() * (mapHeight - 200));
        const length = 50 + rand() * 150;
        const angle = rand() * Math.PI * 2;
        const x2 = Math.floor(x1 + Math.cos(angle) * length);
        const y2 = Math.floor(y1 + Math.sin(angle) * length);

        walls.push({
            id: `wall_${i}`,
            x1,
            y1,
            x2,
            y2,
            type: 'wall'
        });
    }

    // Surround with 4 perimeter walls
    walls.push({ id: 'p1', x1: 0, y1: 0, x2: mapWidth, y2: 0, type: 'wall' });
    walls.push({ id: 'p2', x1: mapWidth, y1: 0, x2: mapWidth, y2: mapHeight, type: 'wall' });
    walls.push({ id: 'p3', x1: mapWidth, y1: mapHeight, x2: 0, y2: mapHeight, type: 'wall' });
    walls.push({ id: 'p4', x1: 0, y1: mapHeight, x2: 0, y2: 0, type: 'wall' });

    const spatialIndex = new WallSpatialIndex(mapWidth, mapHeight);
    spatialIndex.rebuild(walls, mapWidth, mapHeight);

    assert.equal(spatialIndex.count, walls.length, 'All walls must be indexed');

    await t.test('computeVisibilityPolygon parity check (with vs without spatialIndex)', () => {
        const tokenX = 2000;
        const tokenY = 2000;
        const sightRadius = 400; // Typical torch/darkvision radius

        // 1. Compute without spatial index (baseline linear scan)
        const polyBaseline = computeVisibilityPolygon(
            tokenX,
            tokenY,
            sightRadius,
            mapWidth,
            mapHeight,
            360,
            0,
            null,
            null,
            walls,
            null
        );

        // 2. Compute with spatial index (QuadTree range acceleration)
        const polyAccelerated = computeVisibilityPolygon(
            tokenX,
            tokenY,
            sightRadius,
            mapWidth,
            mapHeight,
            360,
            0,
            null,
            null,
            walls,
            spatialIndex
        );

        assert.ok(polyBaseline.length > 0, 'Baseline polygon must have vertices');
        assert.ok(polyAccelerated.length > 0, 'Accelerated polygon must have vertices');

        // Verify polygon vertices match identically
        assert.equal(polyAccelerated.length, polyBaseline.length, 'Polygon vertex counts must match exactly');
        for (let i = 0; i < polyBaseline.length; i++) {
            assert.ok(
                Math.abs(polyAccelerated[i].x - polyBaseline[i].x) < 0.01,
                `Vertex ${i} X mismatch: ${polyAccelerated[i].x} vs ${polyBaseline[i].x}`
            );
            assert.ok(
                Math.abs(polyAccelerated[i].y - polyBaseline[i].y) < 0.01,
                `Vertex ${i} Y mismatch: ${polyAccelerated[i].y} vs ${polyBaseline[i].y}`
            );
        }
    });

    await t.test('Raycasting Performance Benchmark with 500+ walls', () => {
        const tokenX = 2000;
        const tokenY = 2000;
        const sightRadius = 400;
        const iterations = 50;

        // Benchmark Linear
        const t0 = performance.now();
        for (let i = 0; i < iterations; i++) {
            computeVisibilityPolygon(tokenX, tokenY, sightRadius, mapWidth, mapHeight, 360, 0, null, null, walls, null);
        }
        const timeLinear = performance.now() - t0;

        // Benchmark QuadTree
        const t1 = performance.now();
        for (let i = 0; i < iterations; i++) {
            computeVisibilityPolygon(
                tokenX,
                tokenY,
                sightRadius,
                mapWidth,
                mapHeight,
                360,
                0,
                null,
                null,
                walls,
                spatialIndex
            );
        }
        const timeQuadTree = performance.now() - t1;

        console.log(
            `[Benchmark 500 Walls / ${iterations} Iterations] Linear: ${timeLinear.toFixed(2)}ms | QuadTree: ${timeQuadTree.toFixed(2)}ms`
        );
        assert.ok(timeQuadTree < timeLinear * 1.5, 'QuadTree range queries must execute without degrading performance');
    });
});
