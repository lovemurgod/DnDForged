import test from 'node:test';
import assert from 'node:assert/strict';

import {
    renderDamageFXBurst,
    renderActiveDamageFXPass,
    triggerDamageFXAnimation
} from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

test('Test all damage types in renderDamageFXBurst', async (t) => {
    const dummyCtx = {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        strokeRect: () => {},
        fillRect: () => {},
        closePath: () => {},
        strokeText: () => {},
        fillText: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        setLineDash: () => {},
        font: '',
        textAlign: '',
        textBaseline: '',
        lineWidth: 1,
        lineJoin: '',
        strokeStyle: '',
        fillStyle: '',
        shadowColor: '',
        shadowBlur: 0
    };

    const allTypes = [
        'untyped',
        'heal',
        'temphp',
        'fire',
        'cold',
        'ice',
        'lightning',
        'electric',
        'thunder',
        'acid',
        'poison',
        'radiant',
        'necrotic',
        'force',
        'psychic',
        'slashing',
        'piercing',
        'bludgeoning'
    ];

    for (const type of allTypes) {
        await t.test(`renderDamageFXBurst with type: ${type}`, () => {
            assert.doesNotThrow(() => {
                for (let progress = 0; progress <= 1; progress += 0.1) {
                    const opacity = Math.max(0, 1 - progress);
                    renderDamageFXBurst(dummyCtx, 100, 100, 25, progress, opacity, type, 0);
                }
            });
        });
    }
});
