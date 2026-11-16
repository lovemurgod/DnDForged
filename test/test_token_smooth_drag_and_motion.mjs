import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Token Smooth Drag & Motion Animation', () => {
    it('1. Regular token drag produces empty waypoints array without jitter trail', () => {
        const interactionCode = fs.readFileSync(
            path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
            'utf8'
        );

        // Ensure baseWaypoints when not measuring is empty [] rather than tokenDragTrail
        assert.match(
            interactionCode,
            /const\s+baseWaypoints\s*=\s*ctx\.isTokenMeasuring\s*\?\s*ctx\.measureAnchorPoints\.slice\(1\)\s*:\s*\[\];/,
            'baseWaypoints must be empty [] when not measuring'
        );

        // Ensure mousemove does not push jitter into tokenDragTrail
        assert.doesNotMatch(
            interactionCode,
            /trail\.push\(\{ x: nx, y: ny \}\)/,
            'mousemove must not record raw cursor coordinates into trail during drag'
        );
    });

    it('2. Synchronized adaptive duration scales with distance and applies to selection groups', () => {
        const interactionCode = fs.readFileSync(
            path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-interaction.js'),
            'utf8'
        );

        // Verify adaptive duration formula exists
        assert.match(
            interactionCode,
            /const\s+moveDuration\s*=\s*Math\.min\(450,\s*Math\.max\(160,\s*Math\.round\(140\s*\+\s*leadDist\s*\*\s*0\.28\)\)\);/,
            'Interaction drag must compute adaptive duration clamped between 160ms and 450ms'
        );

        // Test the math directly:
        // 1-square hop (50px)
        const dShort = 50;
        const durShort = Math.min(450, Math.max(160, Math.round(140 + dShort * 0.28)));
        assert.strictEqual(durShort, 160, 'Short 1-square hop should be ~160ms');

        // Medium hop (500px / 10 squares)
        const dMed = 500;
        const durMed = Math.min(450, Math.max(160, Math.round(140 + dMed * 0.28)));
        assert.strictEqual(durMed, 280, 'Medium hop should scale smoothly to 280ms');

        // Long haul (1500px / 30 squares)
        const dLong = 1500;
        const durLong = Math.min(450, Math.max(160, Math.round(140 + dLong * 0.28)));
        assert.strictEqual(durLong, 450, 'Long move should clamp at 450ms');
    });

    it('3. Touch drag applies adaptive duration and empty waypoints for direct drags', () => {
        const touchCode = fs.readFileSync(path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-touch.js'), 'utf8');

        assert.match(
            touchCode,
            /const\s+moveDuration\s*=\s*Math\.min\(450,\s*Math\.max\(160,\s*Math\.round\(140\s*\+\s*leadDist\s*\*\s*0\.28\)\)\);/,
            'Touch drag must compute adaptive duration'
        );
        assert.match(touchCode, /duration:\s*moveDuration/, 'Touch drag must assign adaptive moveDuration to animReq');
    });

    it('4. Keyboard arrow nudging uses responsive duration', () => {
        const keyboardCode = fs.readFileSync(
            path.join(process.cwd(), 'vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js'),
            'utf8'
        );

        assert.match(
            keyboardCode,
            /const\s+nudgeDuration\s*=\s*Math\.min\(\s*300,\s*Math\.max\(\s*160,\s*Math\.round\(\s*140\s*\+\s*nudgeDist\s*\*\s*0\.28\s*\)\s*\)\s*\);/,
            'Keyboard nudge must compute responsive duration'
        );
    });

    it('5. animateTokens applies cubic ease-out deceleration without overshoot or destination wiggle', () => {
        const rendererCode = fs.readFileSync(
            path.join(process.cwd(), 'vtt/js/canvas/tokens/vtt-canvas-token-renderer.js'),
            'utf8'
        );

        assert.match(
            rendererCode,
            /const\s+easedProgress\s*=\s*1\s*-\s*Math\.pow\(1\s*-\s*progress,\s*3\);/,
            'animateTokens must use cubic ease-out curve 1 - (1 - progress)^3'
        );

        // Verify ease-out curve mathematical properties:
        const easeOut = (p) => 1 - Math.pow(1 - p, 3);

        // At p = 0, starts at 0
        assert.strictEqual(easeOut(0), 0);

        // At p = 0.5 (halfway in time), token has completed 87.5% of travel (brisk start)
        assert.strictEqual(easeOut(0.5), 0.875);

        // At p = 0.8, token has completed 99.2% of travel (smooth, gentle deceleration)
        assert.strictEqual(easeOut(0.8), 0.992);

        // At p = 1.0, token exactly reaches 1.0 (destination)
        assert.strictEqual(easeOut(1.0), 1.0);
    });
});
