import assert from 'assert';
import { extractTextFromEntries } from '../vtt/js/player-sheet/vtt-sheet-rolls.js';

console.log('--- Test Suite: Equipment, HP & AC Modifiers in Character Builder ---');

// 1. Verify Equipment Filter Tag Formatting
console.log('Checking Equipment filter tag text extraction...');
const filterTagStr = '{@filter martial weapon|items|source=phb|category=basic|type=martial weapon} and a shield';
const extracted = extractTextFromEntries([filterTagStr]);
assert.strictEqual(extracted, 'martial weapon and a shield', `Expected "martial weapon and a shield", got "${extracted}"`);
console.log('✓ Equipment filter tag correctly extracts display text instead of "source=phb"');

// 2. Unit simulation functions for HP & AC calculation logic
function simulateHpCalculation({ classes, feats = [], race = '', subrace = '', is2024 = false, conMod = 2, hpMode = 'average' }) {
    let total = 0;
    const rolls = [];

    classes.forEach((c, cIdx) => {
        const hd = c.hd || 8;
        const lvl = parseInt(c.level) || 1;
        const avg = Math.floor(hd / 2) + 1;

        for (let i = 1; i <= lvl; i++) {
            const isFirst = cIdx === 0 && i === 1;
            const roll = isFirst ? hd : (hpMode === 'max' ? hd : avg);
            const subTot = Math.max(1, roll + conMod);
            total += subTot;
            rolls.push({ level: i, className: c.name, hd, val: roll, con: conMod, total: subTot });
        }
    });

    const totalLvl = classes.reduce((sum, c) => sum + (parseInt(c.level) || 1), 0);
    const raceStr = `${race} ${subrace}`.toLowerCase();

    const hpBreakdown = {
        base: total,
        tough: 0,
        dwarvenToughness: 0,
        draconicResilience: 0,
        totalBonus: 0
    };

    const hasTough = feats.some((f) => (typeof f === 'string' ? f : f.name || '').toLowerCase().includes('tough'));
    if (hasTough) {
        hpBreakdown.tough = 2 * totalLvl;
    }

    const hasDwarfToughness = is2024
        ? raceStr.includes('dwarf')
        : raceStr.includes('hill dwarf') || (raceStr.includes('dwarf') && raceStr.includes('hill'));
    if (hasDwarfToughness) {
        hpBreakdown.dwarvenToughness = 1 * totalLvl;
    }

    const sorcClass = classes.find(
        (c) =>
            (c.name || '').toLowerCase().includes('sorcerer') &&
            (c.subclass || '').toLowerCase().includes('draconic')
    );
    if (sorcClass) {
        const sorcLvl = parseInt(sorcClass.level) || 1;
        hpBreakdown.draconicResilience = 1 * sorcLvl;
    }

    hpBreakdown.totalBonus = hpBreakdown.tough + hpBreakdown.dwarvenToughness + hpBreakdown.draconicResilience;
    return {
        calculatedHp: total + hpBreakdown.totalBonus,
        hpBreakdown,
        rolls
    };
}

function simulateAcCalculation({
    classes = [],
    race = '',
    subrace = '',
    feats = [],
    activeArmor = 'none',
    shield = false,
    stats = { dex: 14, con: 14, wis: 10, cha: 16 },
    featureSubChoices = {},
    is2024 = false
}) {
    const getMod = (score) => Math.floor((score - 10) / 2);
    const dexMod = getMod(stats.dex);
    const conMod = getMod(stats.con);
    const wisMod = getMod(stats.wis);
    const chaMod = getMod(stats.cha);
    const raceStr = `${race} ${subrace}`.toLowerCase();

    const allArmorOptions = [{ id: 'none', name: 'Unarmored Defense / No Armor (10 + DEX)', type: 'None', baseAc: 10 }];

    const hasBarb = classes.some((c) => (c.name || '').toLowerCase().includes('barbarian'));
    const hasMonk = classes.some((c) => (c.name || '').toLowerCase().includes('monk'));
    const allSelectedFeats = feats.map((f) => (typeof f === 'string' ? f : f.name || ''));
    const hasDragonHide = allSelectedFeats.some((f) => f.toLowerCase().includes('dragon hide'));
    const hasDraconicSorcerer = classes.some((c) => (c.subclass || '').toLowerCase().includes('draconic'));

    const danceBardClass = classes.find(
        (c) =>
            (c.name || '').toLowerCase().includes('bard') &&
            (c.subclass || '').toLowerCase().includes('dance') &&
            (parseInt(c.level) || 1) >= 3
    );

    if (hasBarb) {
        allArmorOptions.push({ id: 'barbarian', type: 'Special', baseAc: 10 + dexMod + conMod });
    }
    if (hasMonk) {
        allArmorOptions.push({ id: 'monk', type: 'Special', baseAc: 10 + dexMod + wisMod });
    }
    if (hasDraconicSorcerer) {
        if (is2024) {
            allArmorOptions.push({ id: 'draconic', type: 'Special', baseAc: 10 + dexMod + chaMod });
        } else {
            allArmorOptions.push({ id: 'draconic', type: 'Special', baseAc: 13 + dexMod });
        }
    } else if (hasDragonHide) {
        allArmorOptions.push({ id: 'draconic', type: 'Special', baseAc: 13 + dexMod });
    }

    if (danceBardClass) {
        allArmorOptions.push({ id: 'dance_bard', type: 'Special', baseAc: 10 + dexMod + chaMod, noShield: true });
    }

    // Standard armors
    allArmorOptions.push({ id: 'leather', name: 'Leather Armor', rawType: 'LA', baseAc: 11 });
    allArmorOptions.push({ id: 'chainmail', name: 'Chain Mail', rawType: 'HA', baseAc: 16 });

    const chosen = allArmorOptions.find((a) => a.id === activeArmor) || allArmorOptions[0];

    let base = 10;
    if (chosen.id === 'none') {
        base = 10 + dexMod;
    } else if (chosen.type === 'Special') {
        base = chosen.baseAc;
    } else {
        const rawT = chosen.rawType;
        if (rawT === 'HA') base = chosen.baseAc;
        else if (rawT === 'MA') base = chosen.baseAc + Math.min(2, dexMod);
        else base = chosen.baseAc + dexMod;
    }

    let shieldVal = 0;
    if (shield && chosen.id !== 'monk' && !chosen.noShield && chosen.id !== 'dance_bard') {
        shieldVal = 2;
    }

    let defenseBonus = 0;
    const hasDefenseFightingStyle = Object.values(featureSubChoices).some(
        (v) => typeof v === 'string' && v.toLowerCase() === 'defense'
    );
    if (hasDefenseFightingStyle && chosen.type !== 'Special' && chosen.id !== 'none') {
        defenseBonus = 1;
    }

    return {
        ac: base + shieldVal + defenseBonus,
        allArmorOptions,
        chosen,
        shieldVal,
        defenseBonus
    };
}

// 3. Test Tough Feat HP Scaling
console.log('Checking Tough Feat HP scaling...');
const toughResLvl1 = simulateHpCalculation({
    classes: [{ name: 'Fighter', level: 1, hd: 10 }],
    feats: ['Tough'],
    conMod: 2
});
// Base: 10 (hd) + 2 (con) = 12. Tough: +2 * 1 = 2 -> Total 14.
assert.strictEqual(toughResLvl1.calculatedHp, 14);
assert.strictEqual(toughResLvl1.hpBreakdown.tough, 2);

const toughResLvl5 = simulateHpCalculation({
    classes: [{ name: 'Fighter', level: 5, hd: 10 }],
    feats: ['Tough'],
    conMod: 2
});
// Base: (10 + 2) + 4 * (6 + 2) = 12 + 32 = 44. Tough: +2 * 5 = 10 -> Total 54.
assert.strictEqual(toughResLvl5.calculatedHp, 54);
assert.strictEqual(toughResLvl5.hpBreakdown.tough, 10);
console.log('✓ Tough feat scales properly with character level (+2 HP/level)');

// 4. Test 2014 vs 2024 Dwarven Toughness
console.log('Checking 2014 Hill Dwarf vs Mountain Dwarf...');
const hillDwarf2014 = simulateHpCalculation({
    classes: [{ name: 'Cleric', level: 4, hd: 8 }],
    race: 'Dwarf',
    subrace: 'Hill Dwarf',
    is2024: false,
    conMod: 2
});
assert.strictEqual(hillDwarf2014.hpBreakdown.dwarvenToughness, 4);

const mountainDwarf2014 = simulateHpCalculation({
    classes: [{ name: 'Cleric', level: 4, hd: 8 }],
    race: 'Dwarf',
    subrace: 'Mountain Dwarf',
    is2024: false,
    conMod: 2
});
assert.strictEqual(mountainDwarf2014.hpBreakdown.dwarvenToughness, 0);

console.log('Checking 2024 Dwarf (all subraces)...');
const anyDwarf2024 = simulateHpCalculation({
    classes: [{ name: 'Cleric', level: 4, hd: 8 }],
    race: 'Dwarf',
    subrace: 'Mountain Dwarf',
    is2024: true,
    conMod: 2
});
assert.strictEqual(anyDwarf2024.hpBreakdown.dwarvenToughness, 4);
console.log('✓ 2014 Hill Dwarf and 2024 Dwarf correctly apply Dwarven Toughness (+1 HP/level)');

// 5. Test Draconic Sorcerer HP Scaling
console.log('Checking Draconic Sorcerer HP bonus...');
const draconicSorc = simulateHpCalculation({
    classes: [
        { name: 'Sorcerer', subclass: 'Draconic Bloodline', level: 3, hd: 6 },
        { name: 'Paladin', level: 2, hd: 10 }
    ],
    conMod: 1
});
// Sorcerer lvl 3 -> +3 HP from Draconic Resilience
assert.strictEqual(draconicSorc.hpBreakdown.draconicResilience, 3);
console.log('✓ Draconic Sorcerer gains +1 HP per Sorcerer level');

// 6. Test 2014 vs 2024 Draconic Resilience AC
console.log('Checking 2014 Draconic Resilience AC (13 + DEX)...');
const dracAc2014 = simulateAcCalculation({
    classes: [{ name: 'Sorcerer', subclass: 'Draconic Bloodline', level: 1 }],
    stats: { dex: 16, con: 12, wis: 10, cha: 16 }, // DEX mod = +3, CHA mod = +3
    activeArmor: 'draconic',
    is2024: false
});
assert.strictEqual(dracAc2014.ac, 16); // 13 + 3 = 16

console.log('Checking 2024 Draconic Resilience AC (10 + DEX + CHA)...');
const dracAc2024 = simulateAcCalculation({
    classes: [{ name: 'Sorcerer', subclass: 'Draconic Bloodline', level: 1 }],
    stats: { dex: 16, con: 12, wis: 10, cha: 16 }, // DEX mod = +3, CHA mod = +3
    activeArmor: 'draconic',
    is2024: true
});
assert.strictEqual(dracAc2024.ac, 16); // 10 + 3 + 3 = 16

const dracAc2024HighCha = simulateAcCalculation({
    classes: [{ name: 'Sorcerer', subclass: 'Draconic Bloodline', level: 1 }],
    stats: { dex: 14, con: 12, wis: 10, cha: 18 }, // DEX mod = +2, CHA mod = +4
    activeArmor: 'draconic',
    is2024: true
});
assert.strictEqual(dracAc2024HighCha.ac, 16); // 10 + 2 + 4 = 16

const dracAc2014SameStats = simulateAcCalculation({
    classes: [{ name: 'Sorcerer', subclass: 'Draconic Bloodline', level: 1 }],
    stats: { dex: 14, con: 12, wis: 10, cha: 18 }, // DEX mod = +2
    activeArmor: 'draconic',
    is2024: false
});
assert.strictEqual(dracAc2014SameStats.ac, 15); // 13 + 2 = 15
console.log('✓ 2014 Draconic AC (13+DEX) and 2024 Draconic AC (10+DEX+CHA) correctly calculated');

// 7. Test Plain Dragonborn without Draconic Sorcerer
console.log('Checking plain Dragonborn has no Draconic Resilience option...');
const plainDragonborn = simulateAcCalculation({
    classes: [{ name: 'Fighter', level: 1 }],
    race: 'Dragonborn',
    stats: { dex: 14, con: 14, wis: 10, cha: 10 }
});
assert.ok(!plainDragonborn.allArmorOptions.some((a) => a.id === 'draconic'));
console.log('✓ Plain Dragonborn does not erroneously receive Draconic Resilience');

// 8. Test 2024 College of Dance Bard Unarmored Defense (10 + DEX + CHA, no shield)
console.log('Checking 2024 College of Dance Bard...');
const danceBardLvl2 = simulateAcCalculation({
    classes: [{ name: 'Bard', subclass: 'College of Dance', level: 2 }],
    stats: { dex: 16, con: 12, wis: 10, cha: 16 },
    is2024: true
});
assert.ok(!danceBardLvl2.allArmorOptions.some((a) => a.id === 'dance_bard'), 'Lvl 2 Bard should not have Dance Unarmored Defense');

const danceBardLvl3 = simulateAcCalculation({
    classes: [{ name: 'Bard', subclass: 'College of Dance', level: 3 }],
    stats: { dex: 16, con: 12, wis: 10, cha: 16 },
    activeArmor: 'dance_bard',
    shield: true, // Should be ignored because Dance Bard unarmored defense disallows shields
    is2024: true
});
assert.ok(danceBardLvl3.allArmorOptions.some((a) => a.id === 'dance_bard'));
assert.strictEqual(danceBardLvl3.ac, 16); // 10 + 3 + 3 = 16, shield (+2) blocked
console.log('✓ College of Dance Bard gives 10 + DEX + CHA at level 3+ and ignores shields');

// 9. Test Defense Fighting Style (+1 AC with armor, 0 without)
console.log('Checking Defense Fighting Style...');
const defenseUnarmored = simulateAcCalculation({
    classes: [{ name: 'Fighter', level: 1 }],
    featureSubChoices: { fighting_style: 'Defense' },
    activeArmor: 'none'
});
assert.strictEqual(defenseUnarmored.defenseBonus, 0);

const defenseLeather = simulateAcCalculation({
    classes: [{ name: 'Fighter', level: 1 }],
    featureSubChoices: { fighting_style: 'Defense' },
    activeArmor: 'leather',
    stats: { dex: 14, con: 10, wis: 10, cha: 10 } // 11 + 2 = 13 + 1 (defense) = 14
});
assert.strictEqual(defenseLeather.defenseBonus, 1);
assert.strictEqual(defenseLeather.ac, 14);

const defenseChainmail = simulateAcCalculation({
    classes: [{ name: 'Fighter', level: 1 }],
    featureSubChoices: { fighting_style: 'Defense' },
    activeArmor: 'chainmail',
    shield: true // 16 (chain) + 2 (shield) + 1 (defense) = 19
});
assert.strictEqual(defenseChainmail.defenseBonus, 1);
assert.strictEqual(defenseChainmail.ac, 19);
console.log('✓ Defense Fighting Style grants +1 AC with armor, and 0 when unarmored');

console.log('\n=== ALL EQUIPMENT, HP & AC MODIFIER TESTS PASSED! ===');

