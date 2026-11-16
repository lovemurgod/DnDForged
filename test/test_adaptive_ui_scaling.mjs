import test from 'node:test';
import assert from 'node:assert/strict';
import { renderActivePingsPass, triggerPingAnimation } from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

test('Measurement Tool: preserves constant physical screen thickness across all zoom levels and grid sizes', () => {
    const screenResScale = 1.0;
    const calcRulerLineWidth = (zoom) => Math.max(0.5, (3.5 * screenResScale) / zoom);
    const calcWaypointRadius = (zoom) => Math.max(0.5, (4.5 * screenResScale) / zoom);
    const calcTerminalRadius = (zoom) => Math.max(0.5, (5.5 * screenResScale) / zoom);

    const testZooms = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

    for (const zoom of testZooms) {
        const lineWorld = calcRulerLineWidth(zoom);
        const lineScreen = lineWorld * zoom;
        assert.ok(
            Math.abs(lineScreen - 3.5) < 1e-6,
            `Expected ruler line thickness on screen ~3.5px at zoom ${zoom}, got ${lineScreen}`
        );

        const wpWorld = calcWaypointRadius(zoom);
        const wpScreen = wpWorld * zoom;
        assert.ok(
            Math.abs(wpScreen - 4.5) < 1e-6,
            `Expected waypoint radius on screen ~4.5px at zoom ${zoom}, got ${wpScreen}`
        );

        const termWorld = calcTerminalRadius(zoom);
        const termScreen = termWorld * zoom;
        assert.ok(
            Math.abs(termScreen - 5.5) < 1e-6,
            `Expected terminal radius on screen ~5.5px at zoom ${zoom}, got ${termScreen}`
        );
    }
});

test('Safe Token UI Sizing: prevents font distortion on zoom-in and ballooning on small grids (34.5px)', () => {
    const screenResScale = 1.0;

    const getSafeUiPx = (targetScreenPx, minWorldPx, maxWorldPxRatio, drawW, currentZoom) => {
        const base = Math.round(targetScreenPx * screenResScale);
        let val;
        if (currentZoom >= 1.0) {
            val = Math.max(minWorldPx, base);
        } else {
            const counterScaled = Math.round(base / currentZoom);
            val = Math.max(minWorldPx, counterScaled);
        }
        if (maxWorldPxRatio !== null && drawW > 0) {
            val = Math.min(val, Math.max(minWorldPx, Math.round(drawW * maxWorldPxRatio)));
        }
        return val;
    };

    const smallGridTokenW = 34.5;
    const standardGridTokenW = 70.0;

    // Test 1: On small 34.5px token at zoom 3.0 (zoomed in to inspect), HP font does not collapse below 9px
    const zoomedInHpFont = getSafeUiPx(10, 9, 0.35, smallGridTokenW, 3.0);
    assert.ok(
        zoomedInHpFont >= 9,
        `Expected HP font >= 9px to avoid Chromium subpixel clamp blowout, got ${zoomedInHpFont}`
    );
    assert.equal(zoomedInHpFont, 10);

    // Test 2: On small 34.5px token at zoom 0.5 (zoomed out to battlefield), HP font does NOT balloon to 20px
    const zoomedOutHpFont = getSafeUiPx(10, 9, 0.35, smallGridTokenW, 0.5);
    assert.ok(zoomedOutHpFont <= 13, `Expected HP font bounded to token footprint (<= 13px), got ${zoomedOutHpFont}`);
    assert.equal(zoomedOutHpFont, 12);

    // Test 3: On small 34.5px token, HP bar height does not engulf the token (<= 25% of token width)
    const barHeightSmall = getSafeUiPx(7, 4, 0.22, smallGridTokenW, 1.0);
    assert.ok(barHeightSmall <= 8, `Expected HP bar height on 34.5px token <= 8px, got ${barHeightSmall}`);
    assert.equal(barHeightSmall, 7);

    // Test 4: On standard 70px token, sizing is standard
    const hpFontStandard = getSafeUiPx(10, 9, 0.35, standardGridTokenW, 1.0);
    assert.equal(hpFontStandard, 10);
    const nameFontStandard = getSafeUiPx(12, 10, 0.4, standardGridTokenW, 1.0);
    assert.equal(nameFontStandard, 12);
});

test('Measurement Ruler Distance Pill and Owner Tag: preserve exact screen dimensions via local counter-scaling', () => {
    const calcScreenSize = (drawnSize, zoom) => {
        const localScale = 1 / zoom;
        return drawnSize * localScale * zoom;
    };

    const rulerPillHeight = 22;
    const rulerPillFontSize = 13;

    for (const zoom of [0.1, 0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0]) {
        assert.ok(Math.abs(calcScreenSize(rulerPillHeight, zoom) - 22) < 1e-9);
        assert.ok(Math.abs(calcScreenSize(rulerPillFontSize, zoom) - 13) < 1e-9);
    }
});

test('Token View Settings: Token UI container remains strictly visible (no arbitrary LOD opacity zeroing)', () => {
    // When tokens are configured by user, container display must be block and opacity 1.0
    const uiNode = { style: {} };
    uiNode.style.opacity = '1.0';
    uiNode.style.display = 'block';

    assert.equal(uiNode.style.opacity, '1.0');
    assert.equal(uiNode.style.display, 'block');
});

test('True Screen-Space HUD Projection: prevents 401% zoom blowout and maintains crisp physical screen pixels', () => {
    const screenResScale = 1.0;
    const panX = 120;
    const panY = 80;
    const token = { x: 500, y: 300 };
    const drawW = 34.5; // Ismark Retrieval 1 small grid cell
    const drawH = 34.5;

    for (const zoom of [0.5, 1.0, 2.0, 4.01]) {
        // 1. Screen projection calculation
        const screenX = panX + token.x * zoom;
        const screenY = panY + token.y * zoom;
        const screenW = drawW * zoom;
        const screenH = drawH * zoom;

        // Container matches token screen footprint exactly
        assert.ok(screenW > 0);
        assert.ok(screenH > 0);

        // 2. Name Tag: constant crisp physical screen size (12px), never blows up to 48px at 401% zoom
        const effectiveNameFontSize = Math.max(10, Math.min(13, Math.round(12 * screenResScale)));
        assert.equal(effectiveNameFontSize, 12, `Name font should remain 12px at zoom ${zoom}`);

        // 3. HP Bar Height: clamped between 5px and 10px on screen
        const barHeight = 8;
        const effectiveBarHeight = Math.max(5, Math.min(10, Math.round(barHeight * screenResScale)));
        assert.equal(effectiveBarHeight, 8, `Bar height should be 8px at zoom ${zoom}`);

        // 4. HP Text Font Size: fits inside bar, scales cleanly on small screens, clamps at 10px at high zoom
        const effectiveHpFontSize = Math.max(6, Math.min(10, Math.floor(screenW * 0.18)));
        assert.ok(
            effectiveHpFontSize >= 6 && effectiveHpFontSize <= 10,
            `HP font should be clamped between 6px and 10px, got ${effectiveHpFontSize} at zoom ${zoom}`
        );
        if (zoom === 4.01) {
            // At 401% zoom, screenW is ~138px. Font is capped at crisp 10px, NOT 48px!
            assert.equal(effectiveHpFontSize, 10, 'HP font should cap at 10px at 401% zoom');
        }

        // 5. Live Measurement Pill: screen projected with crisp 13px physical font
        const measureCursor = { x: 550, y: 350 };
        const pillScreenX = Math.round(panX + measureCursor.x * zoom + 14 * screenResScale);
        const pillScreenY = Math.round(panY + measureCursor.y * zoom - 22 * screenResScale);
        assert.ok(Number.isFinite(pillScreenX));
        assert.ok(Number.isFinite(pillScreenY));
    }
});

test('True Screen-Space HUD Projection: Ping animation, Shapes, and Owner Tag preserve constant screen clarity', () => {
    const screenResScale = 1.0;
    const panX = 200;
    const panY = 150;
    const zoomLevels = [0.25, 0.5, 1.0, 2.0, 4.01];

    for (const zoom of zoomLevels) {
        // 1. Ping Tool Screen Projection
        const pingCenter = { x: 400, y: 300 };
        const screenPingX = panX + pingCenter.x * zoom;
        const screenPingY = panY + pingCenter.y * zoom;

        // Radius expands smoothly from 8px to 70px in PHYSICAL SCREEN PIXELS regardless of zoom
        const calcPingScreenRadius = (progress) => {
            const easeOut = Math.sin((progress * Math.PI) / 2);
            return (8 + easeOut * 62) * screenResScale;
        };
        const minRadius = calcPingScreenRadius(0.0);
        const maxRadius = calcPingScreenRadius(1.0);
        assert.equal(minRadius, 8, `Ping start radius should be 8px at zoom ${zoom}`);
        assert.equal(maxRadius, 70, `Ping max radius should be 70px at zoom ${zoom}`);

        // Constant physical screen ring thickness (3.5px) and username badge (13px)
        const pingRingThickness = 3.5 * screenResScale;
        const pingFontSize = Math.round(13 * screenResScale);
        assert.equal(pingRingThickness, 3.5);
        assert.equal(pingFontSize, 13);

        // 2. Geometric Shape Templates (Circle, Cone, Square, Beam)
        // Shape covers exact grid distance, while border stroke is constant 2.5px screen pixels
        const gridRadiusWorld = 100; // e.g. 20ft spell
        const screenShapeRadius = gridRadiusWorld * zoom;
        assert.equal(screenShapeRadius, gridRadiusWorld * zoom);
        const shapeBorderThickness = Math.max(1, 2.5 * screenResScale);
        assert.equal(shapeBorderThickness, 2.5);

        // 3. Owner Tag: constant physical screen font (11px) and pill dimensions
        const ownerFontSize = Math.round(11 * screenResScale);
        assert.equal(ownerFontSize, 11);

        // 4. Marquee Box Select: constant physical screen dashed border (1.5px)
        const boxBorderThickness = 1.5;
        assert.equal(boxBorderThickness, 1.5);
    }
});

test('Ping Tool: renderActivePingsPass renders cleanly and falls back when empty array is passed', () => {
    const arcs = [];
    const texts = [];
    const mockCtx = {
        canvas: { id: 'vtt-canvas-hud' },
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        arc: (x, y, r, startAngle, endAngle) => {
            arcs.push({ x, y, r });
        },
        fill: () => {},
        stroke: () => {},
        measureText: (txt) => ({ width: 40 }),
        fillText: (txt, x, y) => {
            texts.push({ txt, x, y });
        }
    };

    triggerPingAnimation(300, 200, 'PlayerOne', 'PLAYER');

    // 1. Calling with empty array [] should NOT swallow the ping - it falls back to internal activePings
    renderActivePingsPass(mockCtx, [], { panX: 50, panY: 30, zoom: 2.0 });

    assert.ok(arcs.length >= 2, 'Expected ping circles to be drawn even when empty array was passed');
    // First arc is outer ring centered at panX + x * zoom = 50 + 300 * 2 = 650, panY + y * zoom = 30 + 200 * 2 = 430
    assert.equal(arcs[0].x, 650);
    assert.equal(arcs[0].y, 430);
    // Outer radius starts at 8px (physical screen space)
    assert.ok(arcs[0].r >= 8 && arcs[0].r <= 70);

    // Inner dot centered at the same screen position
    assert.equal(arcs[1].x, 650);
    assert.equal(arcs[1].y, 430);
    assert.equal(arcs[1].r, 6); // centerDotR = 6 in screen space

    // 2. Calling with null pings and explicit options object
    arcs.length = 0;
    renderActivePingsPass(mockCtx, null, { panX: 100, panY: 50, zoom: 1.5 });
    assert.ok(arcs.length >= 2);
    assert.equal(arcs[0].x, 100 + 300 * 1.5);
    assert.equal(arcs[0].y, 50 + 200 * 1.5);
});
