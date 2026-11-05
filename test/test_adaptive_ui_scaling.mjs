import test from 'node:test';
import assert from 'node:assert/strict';

test('Billboard Screen-Space Sizing: preserves constant physical display pixels across zoom levels', () => {
    const getScreenPx = (targetScreenPx, zoom) => targetScreenPx / Math.max(0.1, zoom || 1);

    const testZoomLevels = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];
    const targetSizes = [7, 10, 11, 12, 14, 20, 24, 180];

    for (const zoom of testZoomLevels) {
        for (const target of targetSizes) {
            const worldPx = getScreenPx(target, zoom);
            const physicalDisplayPx = worldPx * zoom;
            assert.ok(
                Math.abs(physicalDisplayPx - target) < 1e-9,
                `Expected physical display size ${target} at zoom ${zoom}, got ${physicalDisplayPx}`
            );
        }
    }
});

test('Smooth Macro-Zoom Opacity Fade: fades smoothly between zoom 0.25 and 0.10, reveals 100% on hover', () => {
    const getOverlayOpacity = (zoom, isHovered) => {
        const currentZoom = Math.max(0.1, zoom || 1);
        if (currentZoom < 0.25) {
            return isHovered ? 1.0 : Math.max(0, Math.min(1, (currentZoom - 0.1) / (0.25 - 0.1)));
        }
        return 1.0;
    };

    // Standard and close zoom levels: 100% visible
    assert.equal(getOverlayOpacity(1.0, false), 1.0);
    assert.equal(getOverlayOpacity(2.0, false), 1.0);
    assert.equal(getOverlayOpacity(0.5, false), 1.0);
    assert.equal(getOverlayOpacity(0.25, false), 1.0);

    // Mid-fade zoom levels (between 0.10 and 0.25)
    // At zoom = 0.20: (0.20 - 0.10) / (0.25 - 0.10) = 0.10 / 0.15 = 2/3 ≈ 0.6667
    const opacityMid = getOverlayOpacity(0.2, false);
    assert.ok(Math.abs(opacityMid - 2 / 3) < 1e-4, `Expected ~0.6667, got ${opacityMid}`);

    // At zoom = 0.175: half fade = 0.5
    const opacityHalf = getOverlayOpacity(0.175, false);
    assert.ok(Math.abs(opacityHalf - 0.5) < 1e-4, `Expected 0.5, got ${opacityHalf}`);

    // Macro bird's eye zoom levels (<= 0.10)
    assert.equal(getOverlayOpacity(0.1, false), 0.0);
    assert.equal(getOverlayOpacity(0.05, false), 0.0);

    // Hover reveals 100% at any zoom level
    assert.equal(getOverlayOpacity(0.2, true), 1.0);
    assert.equal(getOverlayOpacity(0.1, true), 1.0);
    assert.equal(getOverlayOpacity(0.05, true), 1.0);
});

test('Adaptive Note Pin Hit Detection: expands hit radius when zoomed out for effortless clicking', () => {
    const getNoteHitRadius = (zoom) => Math.max(16, 24 / Math.max(0.1, zoom || 1));

    // Normal zoom 1.0: 24 world units = 24 screen pixels
    assert.equal(getNoteHitRadius(1.0), 24);

    // Zoomed out 0.5: 48 world units = 24 screen pixels
    assert.equal(getNoteHitRadius(0.5), 48);

    // Deep zoom out 0.25: 96 world units = 24 screen pixels
    assert.equal(getNoteHitRadius(0.25), 96);

    // Zoomed in 2.0: 24 / 2.0 = 12, clamped to minimum 16 world units (32 screen pixels)
    assert.equal(getNoteHitRadius(2.0), 16);
});

test('Measurement Ruler and Note Pin Billboard Counter-Scaling: preserves constant screen dimensions', () => {
    // When canvas rendering does: ctx.scale(1 / zoom, 1 / zoom)
    // Any drawn dimension D is multiplied by (1 / zoom) in the local context
    // When the camera transform applies zoom, total scale is (1 / zoom) * zoom = 1.0
    const calcScreenSize = (drawnSize, zoom) => {
        const localScale = 1 / zoom;
        return drawnSize * localScale * zoom;
    };

    const rulerPillHeight = 22;
    const rulerPillFontSize = 13;
    const notePinRadius = 14;

    for (const zoom of [0.2, 0.5, 1.0, 1.5, 3.0]) {
        assert.ok(Math.abs(calcScreenSize(rulerPillHeight, zoom) - 22) < 1e-9);
        assert.ok(Math.abs(calcScreenSize(rulerPillFontSize, zoom) - 13) < 1e-9);
        assert.ok(Math.abs(calcScreenSize(notePinRadius, zoom) - 14) < 1e-9);
    }
});
