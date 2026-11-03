/**
 * Rest & Recovery Engine (Short Rest & Long Rest)
 */

import { getClassHitDie } from './stats.js';
import { getWarlockPactSlots } from './spell-slots.js';

/**
 * Calculates state updates after taking a Short Rest
 */
export function applyShortRest(char) {
    if (!char) return { updatedChar: char, restoredAbilities: [], restoredPactSlots: false };
    const cloned = structuredClone(char);
    const restoredAbilities = [];
    let restoredPactSlots = false;

    // 1. Recover Warlock Pact Magic slots
    const classesList = Array.isArray(cloned.classes) ? cloned.classes : [];
    const warlockClass = classesList.find(
        (c) =>
            (c.name || '')
                .toLowerCase()
                .replace(/\s*\[.*?\]$/, '')
                .trim() === 'warlock'
    );

    if (warlockClass && cloned.spellSlots) {
        const wLvl = parseInt(warlockClass.level) || 1;
        const isPureWarlock = classesList.filter((c) => (c.name || '').trim() !== '').length === 1;

        if (isPureWarlock) {
            // Pure Warlock: Restore all slots
            Object.keys(cloned.spellSlots).forEach((lvl) => {
                const sl = cloned.spellSlots[lvl];
                if (sl && sl.max > 0 && sl.current < sl.max) {
                    sl.current = sl.max;
                    restoredPactSlots = true;
                }
            });
        } else {
            // Multiclass Warlock: restore dedicated pact slots or up to pact slot level
            if (cloned.spellSlots.pact) {
                if (cloned.spellSlots.pact.current < cloned.spellSlots.pact.max) {
                    cloned.spellSlots.pact.current = cloned.spellSlots.pact.max;
                    restoredPactSlots = true;
                }
            } else {
                const pactInfo = getWarlockPactSlots(wLvl);
                const targetKey = `level${pactInfo.level}`;
                if (cloned.spellSlots[targetKey]) {
                    const sl = cloned.spellSlots[targetKey];
                    const newCur = Math.min(sl.max, (sl.current || 0) + pactInfo.max);
                    if (newCur > sl.current) {
                        sl.current = newCur;
                        restoredPactSlots = true;
                    }
                }
            }
        }
    }

    // 2. Recover Short Rest abilities
    if (Array.isArray(cloned.abilities)) {
        cloned.abilities.forEach((ab) => {
            if (ab.resetType === 'short' && ab.hasCounter && ab.usesMax) {
                const max = parseInt(ab.usesMax) || 0;
                if ((ab.usesCurrent || 0) < max) {
                    ab.usesCurrent = max;
                    restoredAbilities.push(ab.name || 'Ability');
                }
            }
        });
    }

    return {
        updatedChar: cloned,
        restoredAbilities,
        restoredPactSlots
    };
}

/**
 * Calculates state updates after taking a Long Rest
 */
export function applyLongRest(char) {
    if (!char) return { updatedChar: char, restoredAbilities: [], restoredHp: 0, restoredHitDice: 0 };
    const cloned = structuredClone(char);
    const restoredAbilities = [];

    // 1. HP Restoration
    const hpMax = parseInt(cloned.hpMax) || 10;
    const hpPrev = parseInt(cloned.hpCurrent) || 0;
    const restoredHp = Math.max(0, hpMax - hpPrev);
    cloned.hpCurrent = hpMax;
    cloned.tempHp = 0;

    // 2. Spell Slots Restoration
    if (cloned.spellSlots) {
        Object.keys(cloned.spellSlots).forEach((lvl) => {
            const sl = cloned.spellSlots[lvl];
            if (sl && sl.max > 0) {
                sl.current = sl.max;
            }
        });
    }

    // 3. Ability Uses Restoration (both short and long rest reset types)
    if (Array.isArray(cloned.abilities)) {
        cloned.abilities.forEach((ab) => {
            if ((ab.resetType === 'long' || ab.resetType === 'short') && ab.hasCounter && ab.usesMax) {
                const max = parseInt(ab.usesMax) || 0;
                if ((ab.usesCurrent || 0) < max) {
                    ab.usesCurrent = max;
                    restoredAbilities.push(ab.name || 'Ability');
                }
            }
        });
    }

    // 4. Hit Dice Recovery (half total hit dice rounded down, min 1 if any spent)
    let totalHitDice = 0;
    let spentHitDice = 0;
    cloned.hitDiceSpent = cloned.hitDiceSpent || {};

    const classesList = Array.isArray(cloned.classes) ? cloned.classes : [];
    classesList.forEach((c) => {
        const lvl = parseInt(c.level) || 0;
        totalHitDice += lvl;
        const hd = getClassHitDie(c.name);
        const spent = parseInt(cloned.hitDiceSpent[hd]) || 0;
        spentHitDice += spent;
    });

    const recoveryTarget = Math.max(1, Math.floor(totalHitDice / 2));
    let recoveredCount = 0;

    if (spentHitDice > 0) {
        // Recover starting from largest hit dice to smallest
        const hdKeys = Object.keys(cloned.hitDiceSpent).sort((a, b) => {
            const dA = parseInt(a.replace(/\D/g, '')) || 0;
            const dB = parseInt(b.replace(/\D/g, '')) || 0;
            return dB - dA;
        });

        let remainingRecovery = recoveryTarget;
        for (const hd of hdKeys) {
            const spent = parseInt(cloned.hitDiceSpent[hd]) || 0;
            if (spent > 0) {
                const restoreThis = Math.min(spent, remainingRecovery);
                cloned.hitDiceSpent[hd] = spent - restoreThis;
                recoveredCount += restoreThis;
                remainingRecovery -= restoreThis;
                if (remainingRecovery <= 0) break;
            }
        }
    }

    return {
        updatedChar: cloned,
        restoredAbilities,
        restoredHp,
        restoredHitDice: recoveredCount
    };
}
