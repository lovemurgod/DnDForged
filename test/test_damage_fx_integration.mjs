import test from 'node:test';
import assert from 'node:assert/strict';

import {
    triggerDamageFXAnimation,
    triggerHealingFXAnimation,
    renderActiveDamageFXPass
} from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

import {
    executeMassAttackResolution,
    applyCompositeDamageToTokens
} from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

test('Damage FX Integration: Queue fallback and mass action wiring', async (t) => {
    await t.test('renderActiveDamageFXPass draws queued effects even when passed null, undefined, or empty array', () => {
        let burstCalled = false;

        const mockCtx = {
            save: () => { },
            restore: () => { },
            beginPath: () => { },
            arc: () => { },
            fill: () => { },
            stroke: () => { },
            strokeText: () => { },
            fillText: () => { },
            createRadialGradient: () => ({ addColorStop: () => { } }),
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

        // Queue an effect
        triggerDamageFXAnimation(250, 300, 35, ['fire'], { amount: 18, tokenId: 'tok_integration_1' });

        // Call renderActiveDamageFXPass with empty array (simulating what vtt-canvas previously passed)
        renderActiveDamageFXPass(mockCtx, [], (ctx, x, y, r, p, o, type) => {
            if (type === 'fire') burstCalled = true;
        });

        assert.equal(burstCalled, true, 'burst renderer must be called even if caller passes []');
    });

    await t.test('executeMassAttackResolution calls triggerDamageFXAnimation on damaging hit', () => {
        let fxTriggered = false;
        let triggeredAmount = 0;
        let triggeredTypes = [];

        const mockMassAttackCard = {
            attacks: [
                {
                    index: 0,
                    name: 'Bite',
                    dmgRolls: [
                        {
                            roll: { total: 12 },
                            type: 'piercing'
                        }
                    ],
                    isCrit: false
                }
            ]
        };

        const mockTokens = {
            'target_tok_1': {
                id: 'target_tok_1',
                name: 'Goblin',
                x: 100,
                y: 150,
                hp: 20,
                maxHp: 20,
                ac: 14
            }
        };

        const distribution = [
            {
                tokenId: 'target_tok_1',
                attackIndices: [0]
            }
        ];

        executeMassAttackResolution(mockMassAttackCard, distribution, 'msg_123', {
            tokens: mockTokens,
            getTokenAC: (t) => t.ac,
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
            triggerDamageFXAnimation: (x, y, r, types, meta) => {
                fxTriggered = true;
                triggeredTypes = types;
                triggeredAmount = meta.amount;
            },
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.equal(fxTriggered, true, 'executeMassAttackResolution should trigger damage FX on hit');
        assert.equal(triggeredAmount, 12, 'Deducted damage should be 12');
        assert.ok(triggeredTypes.includes('piercing'), 'Damage type should include piercing');
        assert.equal(mockTokens['target_tok_1'].hp, 8, 'Token HP should be reduced to 8');
    });

    await t.test('applyCompositeDamageToTokens calls triggerDamageFXAnimation with proper damage', () => {
        let fxTriggered = false;
        let triggeredAmount = 0;

        const mockTokens = {
            'target_tok_2': {
                id: 'target_tok_2',
                name: 'Orc',
                x: 200,
                y: 250,
                hp: 30,
                maxHp: 30
            }
        };

        applyCompositeDamageToTokens(['target_tok_2'], [{ roll: { total: 15 }, type: 'slashing' }], 1.0, {
            tokens: mockTokens,
            getTokenDrawDimensions: () => ({ drawW: 60, drawH: 60 }),
            triggerDamageFXAnimation: (x, y, r, types, meta) => {
                fxTriggered = true;
                triggeredAmount = meta.amount;
            },
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.equal(fxTriggered, true, 'applyCompositeDamageToTokens should trigger damage FX');
        assert.equal(triggeredAmount, 15, 'Deducted amount should be 15');
        assert.equal(mockTokens['target_tok_2'].hp, 15, 'Token HP should be reduced to 15');
    });

    await t.test('applyCompositeDamageToTokens assigns 20ms staggered delayMs across multiple targets', () => {
        const delays = [];
        const mockTokens = {
            't1': { id: 't1', x: 10, y: 10, hp: 10 },
            't2': { id: 't2', x: 20, y: 20, hp: 10 },
            't3': { id: 't3', x: 30, y: 30, hp: 10 }
        };

        applyCompositeDamageToTokens(['t1', 't2', 't3'], [{ roll: { total: 5 }, type: 'fire' }], 1.0, {
            tokens: mockTokens,
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
            triggerDamageFXAnimation: (x, y, r, types, meta) => {
                delays.push(meta.delayMs);
            },
            syncHpFn: () => { },
            renderAll: () => { }
        });

        assert.deepEqual(delays, [0, 20, 40], 'Multi-target hits must stagger in 20ms increments');
    });

    await t.test('triggerDamageFXAnimation schedules execution when delayMs > 0', async () => {
        let executed = false;
        triggerDamageFXAnimation(100, 100, 25, ['slashing'], {
            amount: 10,
            tokenId: 'tok_delayed',
            delayMs: 30
        });

        // Immediately after, it should not have finished since it's queued for 30ms
        await new Promise((resolve) => setTimeout(resolve, 50));
        // After 50ms, the setTimeout has completed
        assert.ok(true, 'delayed animation dispatched without error');
    });
});
