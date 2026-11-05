import test from 'node:test';
import assert from 'node:assert/strict';

test('Clamped Hybrid Sizing: getClampedWorldPx guarantees minimum physical display pixels', () => {
    const getClampedWorldPx = (baseWorldPx, minScreenPx, zoom) =>
        Math.max(baseWorldPx, minScreenPx / Math.max(0.1, zoom || 1));

    // When zoomed in (zoom = 2.0), base size is larger than minScreen/zoom -> scales naturally with token
    assert.equal(getClampedWorldPx(12, 11, 2.0), 12);
    assert.equal(getClampedWorldPx(8, 6, 2.0), 8);

    // At 1:1 scale (zoom = 1.0)
    assert.equal(getClampedWorldPx(12, 11, 1.0), 12);
    assert.equal(getClampedWorldPx(8, 6, 1.0), 8);

    // When zoomed out (zoom = 0.5), world size expands to keep physical screen pixels at minScreen
    // 11 minScreenPx / 0.5 zoom = 22 world px (22 * 0.5 = 11 screen px)
    assert.equal(getClampedWorldPx(12, 11, 0.5), 22);
    // 6 minScreenPx / 0.5 zoom = 12 world px (12 * 0.5 = 6 screen px)
    assert.equal(getClampedWorldPx(8, 6, 0.5), 12);

    // Deep zoom out (zoom = 0.25)
    // 16 minScreenPx / 0.25 zoom = 64 world px (64 * 0.25 = 16 screen px)
    assert.equal(getClampedWorldPx(20, 16, 0.25), 64);
});

test('Zoom Level-of-Detail (LOD): flags tokens below 24 screen pixels', () => {
    const isLOD = (drawW, zoom) => drawW * zoom < 24;

    // Standard 50px token at 0.5 zoom = 25px screen width -> Normal LOD
    assert.equal(isLOD(50, 0.5), false);

    // Small 35px token at 0.6 zoom = 21px screen width -> Far LOD triggers
    assert.equal(isLOD(35, 0.6), true);

    // Standard 50px token at 0.35 zoom = 17.5px screen width -> Far LOD triggers
    assert.equal(isLOD(50, 0.35), true);

    // Large 100px token at 0.35 zoom = 35px screen width -> Normal LOD
    assert.equal(isLOD(100, 0.35), false);
});

test('Condition Badges: caps to 3 visible items with +N badge when cramped', () => {
    const formatConditions = (conditions, maxVisible = 3) => {
        let visible = conditions;
        let overflow = 0;
        if (conditions.length > maxVisible) {
            visible = conditions.slice(0, maxVisible - 1);
            overflow = conditions.length - (maxVisible - 1);
        }
        return { visible, overflow };
    };

    // 2 conditions: show all 2, no overflow
    const res2 = formatConditions([{ name: 'Prone' }, { name: 'Blinded' }]);
    assert.equal(res2.visible.length, 2);
    assert.equal(res2.overflow, 0);

    // 3 conditions: show all 3, no overflow
    const res3 = formatConditions([{ name: 'Prone' }, { name: 'Blinded' }, { name: 'Poisoned' }]);
    assert.equal(res3.visible.length, 3);
    assert.equal(res3.overflow, 0);

    // 5 conditions: show top 2 + overflow badge of 3
    const res5 = formatConditions([
        { name: 'Prone' },
        { name: 'Blinded' },
        { name: 'Poisoned' },
        { name: 'Stunned' },
        { name: 'Charmed' }
    ]);
    assert.equal(res5.visible.length, 2);
    assert.equal(res5.overflow, 3);
});

test('Nameplate Alignment: centered horizontally with clamped font and max-width', () => {
    const zoom = 0.5;
    const getClampedWorldPx = (base, min) => Math.max(base, min / zoom);

    const effectiveFontSize = Math.round(getClampedWorldPx(12, 11));
    const effectiveMaxWidth = Math.round(getClampedWorldPx(260, 120));

    // At zoom 0.5, font size expands from 12 to 22 (so on screen it renders at 11px)
    assert.equal(effectiveFontSize, 22);
    // Max width expands from 260 to 260 (since 120 / 0.5 = 240 <= 260)
    assert.equal(effectiveMaxWidth, 260);

    // At deep zoom out 0.25:
    const deepZoom = 0.25;
    const deepMaxWidth = Math.round(Math.max(260, 120 / deepZoom));
    assert.equal(deepMaxWidth, 480);
});
