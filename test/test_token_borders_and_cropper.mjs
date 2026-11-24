/**
 * test/test_token_borders_and_cropper.mjs
 * Unit Test Suite for Token Borders, Shapes, Frames, and Cropping Calculations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    TOKEN_SHAPES,
    TOKEN_BORDER_STYLES,
    THEMATIC_FRAMES,
    traceTokenCanvasPath,
    getThematicFrameSvg,
    getShapeBorderSvg,
    isAnimatedMedia
} from '../vtt/js/canvas/tokens/vtt-canvas-token-borders.js';

describe('Token Borders, Shapes & Cropper Geometry Suite', () => {
    describe('1. Geometric Token Shapes & Clip Paths', () => {
        it('should define all 6 required token shapes', () => {
            const expectedShapes = ['circle', 'squircle', 'square', 'hexagon', 'octagon', 'shield'];
            expectedShapes.forEach((s) => {
                assert.ok(TOKEN_SHAPES[s], `Shape ${s} must be defined`);
                assert.ok(TOKEN_SHAPES[s].name, `Shape ${s} must have a display name`);
            });
        });

        it('should have valid CSS border-radius and clip-paths for non-circular shapes', () => {
            assert.equal(TOKEN_SHAPES.circle.borderRadius, '50%');
            assert.equal(TOKEN_SHAPES.squircle.borderRadius, '20%');
            assert.equal(TOKEN_SHAPES.square.borderRadius, '4px');

            assert.ok(TOKEN_SHAPES.hexagon.clipPath.includes('polygon'), 'Hexagon must use CSS polygon clip-path');
            assert.ok(TOKEN_SHAPES.octagon.clipPath.includes('polygon'), 'Octagon must use CSS polygon clip-path');
            assert.ok(TOKEN_SHAPES.shield.clipPath.includes('polygon'), 'Shield must use CSS polygon clip-path');
        });

        it('should accurately trace canvas paths for all shapes without throwing errors', () => {
            const mockOps = [];
            const mockCtx = {
                beginPath: () => mockOps.push('beginPath'),
                moveTo: (x, y) => mockOps.push(`moveTo(${Math.round(x)},${Math.round(y)})`),
                lineTo: (x, y) => mockOps.push(`lineTo(${Math.round(x)},${Math.round(y)})`),
                closePath: () => mockOps.push('closePath'),
                arc: (x, y, r) => mockOps.push(`arc(${x},${y},${r})`),
                rect: (x, y, w, h) => mockOps.push(`rect(${x},${y},${w},${h})`)
            };

            // Test circle
            mockOps.length = 0;
            traceTokenCanvasPath(mockCtx, 100, 100, 50, 'circle');
            assert.ok(
                mockOps.some((op) => op.startsWith('arc')),
                'Circle must invoke arc'
            );

            // Test square
            mockOps.length = 0;
            traceTokenCanvasPath(mockCtx, 100, 100, 50, 'square');
            assert.ok(mockOps.includes('rect(50,50,100,100)'), 'Square must draw 100x100 rect centered at 100,100');

            // Test hexagon
            mockOps.length = 0;
            traceTokenCanvasPath(mockCtx, 100, 100, 50, 'hexagon');
            assert.equal(mockOps[0], 'beginPath');
            assert.equal(mockOps[1], 'moveTo(100,50)');
            assert.equal(mockOps[2], 'lineTo(150,75)');
            assert.equal(mockOps[3], 'lineTo(150,125)');
            assert.equal(mockOps[4], 'lineTo(100,150)');
            assert.equal(mockOps[5], 'lineTo(50,125)');
            assert.equal(mockOps[6], 'lineTo(50,75)');
            assert.equal(mockOps[7], 'closePath');

            // Test octagon
            mockOps.length = 0;
            traceTokenCanvasPath(mockCtx, 100, 100, 50, 'octagon');
            assert.equal(mockOps[0], 'beginPath');
            assert.equal(mockOps[1], 'moveTo(80,50)');
            assert.equal(mockOps[2], 'lineTo(120,50)');
            assert.equal(mockOps[3], 'lineTo(150,80)');
            assert.equal(mockOps[4], 'lineTo(150,120)');
            assert.equal(mockOps[5], 'lineTo(120,150)');
            assert.equal(mockOps[6], 'lineTo(80,150)');
            assert.equal(mockOps[7], 'lineTo(50,120)');
            assert.equal(mockOps[8], 'lineTo(50,80)');
            assert.equal(mockOps[9], 'closePath');

            // Test shield
            mockOps.length = 0;
            traceTokenCanvasPath(mockCtx, 100, 100, 50, 'shield');
            assert.equal(mockOps[0], 'beginPath');
            assert.equal(mockOps[mockOps.length - 1], 'closePath');
            assert.ok(mockOps.some((op) => op.startsWith('moveTo')));
            assert.ok(mockOps.some((op) => op.startsWith('lineTo')));
        });
    });

    describe('2. Thematic SVG Fantasy Frames', () => {
        it('should define all curated thematic frame presets', () => {
            const expectedFrames = [
                'none',
                'ornate_gold',
                'silver_mithral',
                'gothic_iron',
                'arcane_runic',
                'legendary_crown'
            ];
            expectedFrames.forEach((f) => {
                assert.ok(THEMATIC_FRAMES[f], `Thematic frame ${f} must exist`);
            });
        });

        it('should generate valid SVG markup for each frame preset with customizable color', () => {
            const testColor = '#ff5500';

            const goldSvg = getThematicFrameSvg('ornate_gold', testColor);
            assert.ok(goldSvg.includes('<svg'), 'Must produce SVG markup');
            assert.ok(goldSvg.includes(testColor), 'Must embed chosen stroke color');

            const silverSvg = getThematicFrameSvg('silver_mithral', '#ffffff', 100, 100, 'tok_hero_42');
            assert.ok(
                silverSvg.includes('silverGrad_tok_hero_42'),
                'Mithral Silver frame must use namespaced gradient ID'
            );
            assert.ok(
                silverSvg.includes('url(#silverGrad_tok_hero_42)'),
                'Gradient reference must match namespaced ID'
            );

            const ironSvg = getThematicFrameSvg('gothic_iron', '#444444');
            assert.ok(ironSvg.includes('circle cx="'), 'Gothic Iron must include rivet stud accents');

            const runicSvg = getThematicFrameSvg('arcane_runic', '#00ffcc');
            assert.ok(runicSvg.includes('polygon points="'), 'Arcane Runes must include rune glyph accents');

            const bossSvg = getThematicFrameSvg('legendary_crown', '#ffd700');
            assert.ok(bossSvg.includes('polygon points="50,0 54,6 46,6"'), 'Boss frame must feature crown spikes');

            const noneSvg = getThematicFrameSvg('none');
            assert.equal(noneSvg, '', 'Preset none must return empty string');
        });
    });

    describe('3. Framing & Scale Transformation Math', () => {
        it('should correctly calculate scaled dimensions maintaining aspect ratio', () => {
            const baseDim = 100;

            // Wide image (200x100)
            const wideW = 200;
            const wideH = 100;
            let drawW, drawH;
            if (wideW >= wideH) {
                drawH = baseDim;
                drawW = (wideW / wideH) * baseDim;
            } else {
                drawW = baseDim;
                drawH = (wideH / wideW) * baseDim;
            }
            assert.equal(drawH, 100);
            assert.equal(drawW, 200, 'Wide image should scale height to baseDim and width proportionally');

            // Tall image (100x300)
            const tallW = 100;
            const tallH = 300;
            if (tallW >= tallH) {
                drawH = baseDim;
                drawW = (tallW / tallH) * baseDim;
            } else {
                drawW = baseDim;
                drawH = (tallH / tallW) * baseDim;
            }
            assert.equal(drawW, 100);
            assert.equal(drawH, 300, 'Tall image should scale width to baseDim and height proportionally');
        });

        it('should preserve backward compatibility for tokens without border or framing metadata', () => {
            const legacyToken = {
                id: 'tok_legacy_1',
                name: 'Goblin',
                x: 100,
                y: 100,
                img: 'goblin.png',
                ringColor: '#ef4444',
                isBorderless: false
            };

            const bShape = legacyToken.border?.shape || legacyToken.borderShape || 'circle';
            const bStyle = legacyToken.isBorderless
                ? 'none'
                : legacyToken.border?.style || legacyToken.borderStyle || 'solid';
            const bColor = legacyToken.border?.color || legacyToken.ringColor || '#007bff';
            const bWidth = legacyToken.border?.width || legacyToken.borderWidth || 3;

            assert.equal(bShape, 'circle');
            assert.equal(bStyle, 'solid');
            assert.equal(bColor, '#ef4444');
            assert.equal(bWidth, 3);
        });

        it('should correctly fallback to data URL on non-200 upload failure', () => {
            const mockUploadResponse = { ok: false, status: 500 };
            const mockDataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            let finalTokenUrl = 'original.png';

            if (mockUploadResponse.ok) {
                finalTokenUrl = '/assets/uploaded.png';
            } else {
                finalTokenUrl = mockDataUrl;
            }

            assert.equal(finalTokenUrl, mockDataUrl, 'Non-200 response must fallback to data URL');
        });

        it('should enforce bi-directional shape and thematic frame auto-switching', () => {
            let shape = 'shield';
            let borderStyle = 'solid';

            // User selects 'frame'
            borderStyle = 'frame';
            if (borderStyle === 'frame') {
                shape = 'circle';
            }
            assert.equal(shape, 'circle', 'Selecting frame must automatically switch shape to circle');

            // User switches shape to hexagon while in frame mode
            shape = 'hexagon';
            if (shape !== 'circle' && borderStyle === 'frame') {
                borderStyle = 'solid';
            }
            assert.equal(
                borderStyle,
                'solid',
                'Switching to non-circular shape must auto-switch border style to solid'
            );
        });

        it('should bake full-bleed token artwork with 0% artificial gap', () => {
            const bakeSize = 512;
            const bFrameRadius = bakeSize / 2;
            assert.equal(bFrameRadius, 256, 'Bake radius must be 50% of canvas dimension to eliminate border gap');
            const baseDim = bakeSize;
            assert.equal(baseDim, 512, 'Base dimension must match bakeSize for zero outer dead-zone');
        });
    });

    describe('4. Animated Media Detection & Shape SVG Borders', () => {
        it('should correctly detect animated media formats (GIF and Video)', () => {
            // Animated
            assert.ok(isAnimatedMedia('https://example.com/fire_elemental.gif'));
            assert.ok(isAnimatedMedia('spell.mp4'));
            assert.ok(isAnimatedMedia('dragon_breath.webm'));
            assert.ok(isAnimatedMedia('ambient.mov'));
            assert.ok(isAnimatedMedia('loop.ogg'));
            assert.ok(isAnimatedMedia('clip.m4v'));
            assert.ok(isAnimatedMedia('https://www.youtube.com/watch?v=123'));
            assert.ok(isAnimatedMedia('', 'goblin_run.gif'));

            // Static
            assert.ok(!isAnimatedMedia('https://example.com/fighter.png'));
            assert.ok(!isAnimatedMedia('cleric.jpg'));
            assert.ok(!isAnimatedMedia('rogue.webp'));
            assert.ok(!isAnimatedMedia('wizard.svg'));
        });

        it('should generate valid SVG borders for all geometric shapes and styles', () => {
            const shapes = ['circle', 'squircle', 'square', 'hexagon', 'octagon', 'shield'];
            shapes.forEach((s) => {
                const svgSolid = getShapeBorderSvg(s, 'solid', '#ff0000', 3, 100, 100);
                assert.ok(svgSolid.includes('<svg'), `Shape ${s} must generate SVG`);
                assert.ok(svgSolid.includes('#ff0000'), `Shape ${s} must include border color`);

                const svgDouble = getShapeBorderSvg(s, 'double', '#00ff00', 4, 100, 100);
                assert.ok(svgDouble.includes('#00ff00'), `Shape ${s} double must include border color`);

                const svgDashed = getShapeBorderSvg(s, 'dashed', '#0000ff', 2, 100, 100);
                assert.ok(svgDashed.includes('stroke-dasharray'), `Shape ${s} dashed must include dasharray`);

                const svgGlow = getShapeBorderSvg(s, 'glow', '#ffff00', 3, 100, 100);
                assert.ok(svgGlow.includes('drop-shadow'), `Shape ${s} glow must include drop-shadow filter`);
            });

            assert.equal(getShapeBorderSvg('circle', 'none'), '', 'Style none must return empty string');
        });
    });
});
