/**
 * 5e & 2024 Multiclass Spell Slot & Pact Magic Calculation Engine
 */

export const MULTICLASS_SPELL_SLOT_TABLE = [
    // Lvl: [1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th]
    /*  0 */ [0, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  1 */ [2, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  2 */ [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  3 */ [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /*  4 */ [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /*  5 */ [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /*  6 */ [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /*  7 */ [4, 3, 3, 1, 0, 0, 0, 0, 0],
    /*  8 */ [4, 3, 3, 2, 0, 0, 0, 0, 0],
    /*  9 */ [4, 3, 3, 3, 1, 0, 0, 0, 0],
    /* 10 */ [4, 3, 3, 3, 2, 0, 0, 0, 0],
    /* 11 */ [4, 3, 3, 3, 2, 1, 0, 0, 0],
    /* 12 */ [4, 3, 3, 3, 2, 1, 0, 0, 0],
    /* 13 */ [4, 3, 3, 3, 2, 1, 1, 0, 0],
    /* 14 */ [4, 3, 3, 3, 2, 1, 1, 0, 0],
    /* 15 */ [4, 3, 3, 3, 2, 1, 1, 1, 0],
    /* 16 */ [4, 3, 3, 3, 2, 1, 1, 1, 0],
    /* 17 */ [4, 3, 3, 3, 2, 1, 1, 1, 1],
    /* 18 */ [4, 3, 3, 3, 3, 1, 1, 1, 1],
    /* 19 */ [4, 3, 3, 3, 3, 2, 1, 1, 1],
    /* 20 */ [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

export const WARLOCK_PACT_SLOTS = [
    // [slots, slotLevel] indexed by warlock level 0..20
    [0, 0],
    [1, 1],
    [2, 1], // 1-2: 1st lvl
    [2, 2],
    [2, 2], // 3-4: 2nd lvl
    [2, 3],
    [2, 3], // 5-6: 3rd lvl
    [2, 4],
    [2, 4], // 7-8: 4th lvl
    [2, 5],
    [2, 5], // 9-10: 5th lvl
    [3, 5],
    [3, 5],
    [3, 5], // 11-13: 3x 5th
    [3, 5],
    [3, 5],
    [3, 5], // 14-16: 3x 5th
    [4, 5],
    [4, 5],
    [4, 5],
    [4, 5] // 17-20: 4x 5th
];

export function getWarlockPactSlots(warlockLevel) {
    const l = Math.max(0, Math.min(20, parseInt(warlockLevel) || 0));
    const [max, level] = WARLOCK_PACT_SLOTS[l] || [0, 0];
    return {
        level,
        max,
        current: max
    };
}

/**
 * Calculates effective caster level from a character's class list
 */
export function calculateEffectiveCasterLevel(classes, is2024 = false) {
    if (!Array.isArray(classes) || classes.length === 0) return 0;

    let fullCasterLevels = 0;
    let artificerLevels = 0;
    let halfCasterLevels = 0;
    let thirdCasterLevels = 0;

    classes.forEach((c) => {
        const rawName = (c.name || '')
            .toLowerCase()
            .replace(/\s*\[.*?\]$/, '')
            .trim();
        const sub = (c.subclass || '').toLowerCase();
        const lvl = parseInt(c.level) || 0;
        if (lvl <= 0) return;

        // Full Casters (1.0x)
        if (['wizard', 'cleric', 'druid', 'sorcerer', 'bard'].includes(rawName)) {
            fullCasterLevels += lvl;
        }
        // Artificer (always rounds up: ceil(lvl / 2))
        else if (rawName === 'artificer') {
            artificerLevels += lvl;
        }
        // Half Casters (Paladin, Ranger)
        else if (['paladin', 'ranger'].includes(rawName)) {
            halfCasterLevels += lvl;
        }
        // One-Third Casters (Eldritch Knight Fighter, Arcane Trickster Rogue)
        else if (sub.includes('eldritch knight') || sub.includes('arcane trickster')) {
            thirdCasterLevels += lvl;
        }
    });

    const isSingleHalfCaster =
        fullCasterLevels === 0 && artificerLevels === 0 && thirdCasterLevels === 0 && halfCasterLevels > 0;

    // In 2024 (XPHB), Paladin and Ranger round up half levels (ceil(lvl / 2)) and start at level 1.
    // In 2014, single-class Paladins/Rangers get 2 slots at level 2, while multiclass uses floor(lvl / 2).
    let halfContribution = 0;
    if (is2024) {
        halfContribution = Math.ceil(halfCasterLevels / 2);
    } else {
        // 2014 rules
        if (isSingleHalfCaster) {
            // Single class paladin/ranger gains spellcasting at level 2
            halfContribution = halfCasterLevels >= 2 ? Math.floor(halfCasterLevels / 2) : 0;
        } else {
            halfContribution = Math.floor(halfCasterLevels / 2);
        }
    }

    const artificerContribution = Math.ceil(artificerLevels / 2);
    const thirdContribution = Math.floor(thirdCasterLevels / 3);

    const totalCasterLevel = fullCasterLevels + artificerContribution + halfContribution + thirdContribution;
    return Math.min(20, Math.max(0, totalCasterLevel));
}

/**
 * Calculates all spell slots for a character, accounting for Multiclassing & Pact Magic
 */
export function calculateCharacterSpellSlots(classes, is2024 = false, existingSlots = null) {
    const validClasses = (Array.isArray(classes) ? classes : []).filter((c) => (c.name || '').trim() !== '');
    const warlockClass = validClasses.find(
        (c) =>
            (c.name || '')
                .toLowerCase()
                .replace(/\s*\[.*?\]$/, '')
                .trim() === 'warlock'
    );
    const warlockLvl = warlockClass ? parseInt(warlockClass.level) || 0 : 0;

    const totalCasterLevel = calculateEffectiveCasterLevel(validClasses, is2024);
    const row = MULTICLASS_SPELL_SLOT_TABLE[totalCasterLevel] || MULTICLASS_SPELL_SLOT_TABLE[0];

    const spellSlots = {};
    for (let i = 1; i <= 9; i++) {
        const key = `level${i}`;
        const max = row[i - 1] || 0;
        let current = max;

        if (existingSlots && existingSlots[key]) {
            // Preserve user-spent slots if max didn't change, or cap to new max
            const prevCur = parseInt(existingSlots[key].current);
            const prevMax = parseInt(existingSlots[key].max);
            if (!isNaN(prevCur)) {
                if (prevMax === max) {
                    current = Math.min(max, prevCur);
                } else if (max > prevMax) {
                    // Leveled up: add the difference
                    current = Math.min(max, prevCur + (max - prevMax));
                } else {
                    current = Math.min(max, prevCur);
                }
            }
        }

        spellSlots[key] = { current, max };
    }

    // Pact Magic
    let pactSlots = null;
    if (warlockLvl > 0) {
        const pactInfo = getWarlockPactSlots(warlockLvl);
        let curPact = pactInfo.max;
        if (existingSlots && existingSlots.pact) {
            const prevPactCur = parseInt(existingSlots.pact.current);
            if (!isNaN(prevPactCur)) {
                curPact = Math.min(pactInfo.max, prevPactCur);
            }
        }
        pactSlots = {
            level: pactInfo.level,
            max: pactInfo.max,
            current: curPact
        };
        spellSlots.pact = pactSlots;
    }

    return {
        spellSlots,
        pactSlots,
        totalCasterLevel
    };
}
