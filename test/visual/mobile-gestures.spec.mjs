/**
 * test/visual/mobile-gestures.spec.mjs
 * ForgeD VTT - Mobile Gesture & Touch Interaction Automated Test Suite
 * Validates smart 1-finger pan, 2-finger pinch-to-zoom, touch token drag
 * with floating distance pill, 2-finger drag cancel, double-tap actions,
 * 500ms long-press context menu, and mobile landscape adaptation.
 */

import { test, expect } from '@playwright/test';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

/**
 * Dispatches a synthetic W3C TouchEvent on the interaction layer or window.
 */
async function dispatchTouchEvent(
    page,
    type,
    touches = [],
    changedTouches = null,
    targetSelector = '#vtt-canvas-interaction'
) {
    await page.evaluate(
        ({ type, touches, changedTouches, targetSelector }) => {
            const target = document.querySelector(targetSelector) || document.body;

            function createTouchList(list) {
                return list.map((t, idx) => {
                    return new Touch({
                        identifier: t.id !== undefined ? t.id : idx,
                        target: target,
                        clientX: t.x,
                        clientY: t.y,
                        screenX: t.x,
                        screenY: t.y,
                        pageX: t.x,
                        pageY: t.y
                    });
                });
            }

            const activeTouches = createTouchList(touches || []);
            const changed = changedTouches ? createTouchList(changedTouches) : activeTouches;

            const touchEvent = new TouchEvent(type, {
                cancelable: true,
                bubbles: true,
                touches: activeTouches,
                targetTouches: activeTouches,
                changedTouches: changed
            });

            if (type === 'touchstart') {
                target.dispatchEvent(touchEvent);
            } else {
                window.dispatchEvent(touchEvent);
            }
        },
        { type, touches, changedTouches, targetSelector }
    );
}

/**
 * Computes exact token center in client screen coordinates relative to viewport.
 */
async function getTokenScreenCenter(page, tokenId) {
    return await page.evaluate((id) => {
        const ce = window.VTT.canvasEngine;
        const tok = ce.getTokens()[id];
        if (!tok) return null;
        const { panX, panY } = ce.getPan();
        const zoom = ce.getZoom();
        const vr = document.getElementById('vtt-canvas-viewport').getBoundingClientRect();
        const centerX = tok.x + 35;
        const centerY = tok.y + 35;
        return {
            x: Math.round(vr.left + panX + centerX * zoom),
            y: Math.round(vr.top + panY + centerY * zoom)
        };
    }, tokenId);
}

test.describe('Mobile Gesture & Touch Interaction Suite', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
    });

    test.beforeEach(async ({ page }) => {
        await joinAsGM(page);
        await freezeDynamicElements(page);

        // Setup deterministic sandbox token on the map
        await page.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const mapId = ce.getCurrentMapId();
            const tokens = ce.getTokens();

            tokens['tok_touch_hero'] = {
                id: 'tok_touch_hero',
                name: 'Touch Valeros',
                x: 210,
                y: 210,
                size: 1,
                hp: 35,
                maxHp: 35,
                tempHp: 0,
                ac: 16,
                isPlayer: true,
                layer: 'token'
            };

            // Reset camera to neutral position
            ce.panTo(210, 210, 1.0, 0);
            ce.renderAll();
        });

        await page.waitForTimeout(300);
    });

    test('1. Smart 1-finger pan moves canvas viewport without displacing tokens', async ({ page }) => {
        const initial = await page.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_touch_hero'];
            return {
                pan: ce.getPan(),
                tokX: tok.x,
                tokY: tok.y
            };
        });

        // Swipe on empty canvas ground (bottom-right area away from token)
        const startX = 300;
        const startY = 600;
        const endX = 220;
        const endY = 510;

        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: startX, y: startY }]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchmove', [{ id: 0, x: endX, y: endY }]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: endX, y: endY }]);
        await page.waitForTimeout(100);

        const updated = await page.evaluate(() => {
            const ce = window.VTT.canvasEngine;
            const tok = ce.getTokens()['tok_touch_hero'];
            return {
                pan: ce.getPan(),
                tokX: tok.x,
                tokY: tok.y
            };
        });

        const deltaPanX = updated.pan.panX - initial.pan.panX;
        const deltaPanY = updated.pan.panY - initial.pan.panY;

        expect(deltaPanX).toBeCloseTo(endX - startX, 0);
        expect(deltaPanY).toBeCloseTo(endY - startY, 0);

        expect(updated.tokX).toBe(initial.tokX);
        expect(updated.tokY).toBe(initial.tokY);
    });

    test('2. 2-finger pinch-to-zoom scales canvas zoom level', async ({ page }) => {
        const initialZoom = await page.evaluate(() => window.VTT.canvasEngine.getZoom());

        const midX = 195;
        const midY = 420;
        const f1Start = { id: 0, x: midX - 50, y: midY };
        const f1EndZoomIn = { id: 0, x: midX - 100, y: midY };
        const f2Start = { id: 1, x: midX + 50, y: midY };
        const f2EndZoomIn = { id: 1, x: midX + 100, y: midY };

        // Spread fingers outward (zoom in)
        await dispatchTouchEvent(page, 'touchstart', [f1Start, f2Start]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchmove', [f1EndZoomIn, f2EndZoomIn]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchend', [], [f1EndZoomIn, f2EndZoomIn]);
        await page.waitForTimeout(100);

        const zoomedIn = await page.evaluate(() => window.VTT.canvasEngine.getZoom());
        expect(zoomedIn).toBeGreaterThan(initialZoom);

        // Pinch fingers inward (zoom out)
        const f1Contract = { id: 0, x: midX - 30, y: midY };
        const f2Contract = { id: 1, x: midX + 30, y: midY };

        await dispatchTouchEvent(page, 'touchstart', [f1EndZoomIn, f2EndZoomIn]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchmove', [f1Contract, f2Contract]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchend', [], [f1Contract, f2Contract]);
        await page.waitForTimeout(100);

        const zoomedOut = await page.evaluate(() => window.VTT.canvasEngine.getZoom());
        expect(zoomedOut).toBeLessThan(zoomedIn);
    });

    test('3. Touch token hold-drag displays floating distance pill and snaps on release', async ({ page }) => {
        const screenPos = await getTokenScreenCenter(page, 'tok_touch_hero');

        // Step 1: Touch down on token and hold > 150ms to engage drag
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: screenPos.x, y: screenPos.y }]);
        await page.waitForTimeout(250);

        // Step 2: Drag 2 grid squares (140px)
        const dragDestX = screenPos.x + 140;
        const dragDestY = screenPos.y;
        await dispatchTouchEvent(page, 'touchmove', [{ id: 0, x: dragDestX, y: dragDestY }]);
        await page.waitForTimeout(100);

        // Floating distance pill should now be visible and display distance in feet
        const dragPill = page.locator('#vtt-mobile-drag-pill');
        await expect(dragPill).toBeVisible();
        const distSpan = page.locator('#vtt-mobile-drag-dist');
        await expect(distSpan).toContainText('ft');

        // Capture visual snapshot of the floating distance measurement pill
        await expect(dragPill).toHaveScreenshot('mobile-token-drag-pill.png');

        // Step 3: Touch end to drop token
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: dragDestX, y: dragDestY }]);
        await page.waitForTimeout(150);

        // Pill should now be hidden
        await expect(dragPill).toHaveClass(/vtt-hidden/);

        // Token should be moved to the new location (210 + 140 = 350)
        const newTokX = await page.evaluate(() => window.VTT.canvasEngine.getTokens()['tok_touch_hero'].x);
        expect(newTokX).toBe(350);
    });

    test('4. 2-finger drag cancel aborts active token drag and restores original position', async ({ page }) => {
        const initialTokPos = await page.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_touch_hero'];
            return { x: tok.x, y: tok.y };
        });

        const screenPos = await getTokenScreenCenter(page, 'tok_touch_hero');

        // Touch down and engage hold-drag
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: screenPos.x, y: screenPos.y }]);
        await page.waitForTimeout(250);

        // Drag 140px to the right
        const dragDestX = screenPos.x + 140;
        await dispatchTouchEvent(page, 'touchmove', [{ id: 0, x: dragDestX, y: screenPos.y }]);
        await page.waitForTimeout(100);

        // Verify drag is active and pill is showing
        const dragPill = page.locator('#vtt-mobile-drag-pill');
        await expect(dragPill).toBeVisible();

        // Second finger touches screen while dragging!
        await dispatchTouchEvent(page, 'touchstart', [
            { id: 0, x: dragDestX, y: screenPos.y },
            { id: 1, x: dragDestX + 40, y: screenPos.y + 40 }
        ]);
        await page.waitForTimeout(100);

        // Pill must immediately hide upon cancel
        await expect(dragPill).toHaveClass(/vtt-hidden/);

        // Release fingers
        await dispatchTouchEvent(
            page,
            'touchend',
            [],
            [
                { id: 0, x: dragDestX, y: screenPos.y },
                { id: 1, x: dragDestX + 40, y: screenPos.y + 40 }
            ]
        );
        await page.waitForTimeout(100);

        // Token must be snapped back to original position (rollback)
        const finalTokPos = await page.evaluate(() => {
            const tok = window.VTT.canvasEngine.getTokens()['tok_touch_hero'];
            return { x: tok.x, y: tok.y };
        });
        expect(finalTokPos.x).toBe(initialTokPos.x);
        expect(finalTokPos.y).toBe(initialTokPos.y);
    });

    test('5. Double-tap token opens token configuration modal', async ({ page }) => {
        const screenPos = await getTokenScreenCenter(page, 'tok_touch_hero');

        // Tap 1
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: screenPos.x, y: screenPos.y }]);
        await page.waitForTimeout(40);
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: screenPos.x, y: screenPos.y }]);

        // Wait 120ms (well within 40ms - 320ms double-tap window)
        await page.waitForTimeout(120);

        // Tap 2
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: screenPos.x, y: screenPos.y }]);
        await page.waitForTimeout(40);
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: screenPos.x, y: screenPos.y }]);

        // Token edit modal should be revealed
        const modal = page.locator('#modal-token-edit');
        await expect(modal).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#token-edit-title')).toContainText('Touch Valeros');
    });

    test('6. Double-tap empty canvas centers viewport on active token', async ({ page }) => {
        // Pan canvas far away
        await page.evaluate(() => {
            window.VTT.canvasEngine.panTo(1200, 1200, 1.0, 0);
        });

        const pannedPan = await page.evaluate(() => window.VTT.canvasEngine.getPan());

        // Double-tap empty ground area at (195, 420)
        const tapX = 195;
        const tapY = 420;

        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: tapX, y: tapY }]);
        await page.waitForTimeout(40);
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: tapX, y: tapY }]);
        await page.waitForTimeout(120);
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: tapX, y: tapY }]);
        await page.waitForTimeout(40);
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: tapX, y: tapY }]);
        await page.waitForTimeout(200);

        // Viewport should re-center on the active token
        const centeredPan = await page.evaluate(() => window.VTT.canvasEngine.getPan());
        expect(centeredPan.panX).not.toBe(pannedPan.panX);
        expect(centeredPan.panY).not.toBe(pannedPan.panY);
    });

    test('7. 500ms long-press triggers mobile token context menu', async ({ page }) => {
        const screenPos = await getTokenScreenCenter(page, 'tok_touch_hero');

        // Touch down and hold > 520ms without moving
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: screenPos.x, y: screenPos.y }]);
        await page.waitForTimeout(550); // Exceeds 500ms long-press threshold

        // Token context menu must be rendered
        const contextMenu = page.locator('#vtt-token-context-menu');
        await expect(contextMenu).toBeVisible();

        // Capture visual snapshot of the mobile token context menu
        await expect(contextMenu).toHaveScreenshot('mobile-token-context-menu.png');

        // Release touch
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: screenPos.x, y: screenPos.y }]);
    });

    test('8. Phone Landscape orientation adaptation preserves gesture response', async ({ page }) => {
        // Rotate viewport to Phone Landscape (800x360)
        await page.setViewportSize({ width: 800, height: 360 });
        await page.waitForTimeout(300);

        // Re-center camera in new landscape viewport
        await page.evaluate(() => {
            window.VTT.canvasEngine.panTo(210, 210, 1.0, 0);
        });
        await page.waitForTimeout(100);

        const initialPan = await page.evaluate(() => window.VTT.canvasEngine.getPan());

        // Perform 1-finger pan in landscape
        await dispatchTouchEvent(page, 'touchstart', [{ id: 0, x: 600, y: 250 }]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchmove', [{ id: 0, x: 500, y: 180 }]);
        await page.waitForTimeout(50);
        await dispatchTouchEvent(page, 'touchend', [], [{ id: 0, x: 500, y: 180 }]);
        await page.waitForTimeout(100);

        const landscapePan = await page.evaluate(() => window.VTT.canvasEngine.getPan());
        expect(landscapePan.panX - initialPan.panX).toBeCloseTo(-100, 0);
        expect(landscapePan.panY - initialPan.panY).toBeCloseTo(-70, 0);
    });
});
