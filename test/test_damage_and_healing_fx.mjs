import test from 'node:test';
import assert from 'node:assert/strict';

import {
    triggerDamageFXAnimation,
    triggerHealingFXAnimation,
    activeTokenShudders,
    triggerTokenShudder,
    getTokenShudderOffset,
    renderFloatingDamageText,
    renderDamageFXBurst
} from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

import { applyDamageToTokens } from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

test('Damage & Healing FX: Triggering and Shudder Separation', async (t) => {
    await t.test('triggerHealingFXAnimation does not shake token and records healing metadata', () => {
        const dummyTokenId = 'tok_heal_test_1';
        // Clear shudders
        for (const k in activeTokenShudders) delete activeTokenShudders[k];

        triggerHealingFXAnimation(100, 100, 25, 15, { tokenId: dummyTokenId });

        // Healing must NOT trigger a violent physical token shudder
        const shudderOffset = getTokenShudderOffset(dummyTokenId);
        assert.equal(shudderOffset.x, 0, 'Healing should not displace token horizontally');
        assert.equal(shudderOffset.y, 0, 'Healing should not displace token vertically');
    });

    await t.test('triggerDamageFXAnimation triggers physical token shudder', () => {
        const dummyTokenId = 'tok_damage_test_1';
        triggerDamageFXAnimation(100, 100, 25, ['slashing'], { amount: 12, tokenId: dummyTokenId });

        const shudder = activeTokenShudders[dummyTokenId];
        assert.ok(shudder, 'Active shudder must be registered for damage');
        assert.equal(shudder.duration, 200, 'Shudder duration must be 200ms');

        const offset = getTokenShudderOffset(dummyTokenId);
        assert.ok(typeof offset.x === 'number' && typeof offset.y === 'number');
    });

    await t.test('applyDamageToTokens with mode: heal calls triggerHealingFXAnimation', () => {
        let healCalled = false;
        let healAmount = 0;
        let damageCalled = false;

        const fakeToken = { id: 't1', hp: 20, maxHp: 30, x: 50, y: 50, width: 50, height: 50 };
        const tokens = { t1: fakeToken };

        applyDamageToTokens(
            ['t1'],
            8,
            'untyped',
            'heal',
            {},
            {
                tokens,
                getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
                triggerHealingFXAnimation: (x, y, r, amt) => {
                    healCalled = true;
                    healAmount = amt;
                },
                triggerDamageFXAnimation: () => {
                    damageCalled = true;
                }
            }
        );

        assert.equal(fakeToken.hp, 28, 'Token HP should increase from 20 to 28');
        assert.equal(healCalled, true, 'Healing FX should be triggered');
        assert.equal(healAmount, 8, 'Healed amount should be 8');
        assert.equal(damageCalled, false, 'Damage FX must not be triggered on heal');
    });

    await t.test('applyDamageToTokens with mode: full calls triggerDamageFXAnimation', () => {
        let damageCalled = false;
        let dmgAmount = 0;
        let healCalled = false;

        const fakeToken = { id: 't2', hp: 25, maxHp: 30, x: 50, y: 50, width: 50, height: 50 };
        const tokens = { t2: fakeToken };

        applyDamageToTokens(
            ['t2'],
            10,
            'fire',
            'full',
            {},
            {
                tokens,
                getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 }),
                triggerHealingFXAnimation: () => {
                    healCalled = true;
                },
                triggerDamageFXAnimation: (x, y, r, types, meta) => {
                    damageCalled = true;
                    dmgAmount = meta.amount;
                }
            }
        );

        assert.equal(fakeToken.hp, 15, 'Token HP should decrease from 25 to 15');
        assert.equal(damageCalled, true, 'Damage FX must be called');
        assert.equal(dmgAmount, 10, 'Damage amount must be 10');
        assert.equal(healCalled, false, 'Healing FX must not be called on damage');
    });

    await t.test('renderDamageFXBurst runs cleanly for heal and temphp without errors', () => {
        const dummyCtx = {
            createRadialGradient: () => ({ addColorStop: () => {} }),
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {}
        };

        // Must run smoothly without throwing
        assert.doesNotThrow(() => {
            renderDamageFXBurst(dummyCtx, 100, 100, 25, 0.5, 0.5, 'heal', 0);
            renderDamageFXBurst(dummyCtx, 100, 100, 25, 0.5, 0.5, 'temphp', 0);
        });
    });
});
