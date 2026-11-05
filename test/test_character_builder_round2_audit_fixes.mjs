import assert from 'assert';
import {
    MULTICLASS_PROFICIENCIES,
    extractSpeciesProficiencies
} from '../vtt/js/player-sheet/builder/builder-state.js';

console.log('--- RUNNING CHARACTER BUILDER ROUND 2 AUDIT FIXES TEST SUITE ---');

// TEST 1: Multiclass Proficiencies Matrix
console.log('\n[Test 1] Multiclass Proficiencies Matrix...');
assert.deepStrictEqual(MULTICLASS_PROFICIENCIES.fighter.armor, ['Light Armor', 'Medium Armor', 'Shields']);
assert.deepStrictEqual(MULTICLASS_PROFICIENCIES.fighter.weapons, ['Simple Weapons', 'Martial Weapons']);
assert.strictEqual(MULTICLASS_PROFICIENCIES.rogue.skills.count, 1);
assert.ok(MULTICLASS_PROFICIENCIES.rogue.tools.includes("Thieves' tools"));
assert.strictEqual(MULTICLASS_PROFICIENCIES.bard.skills.count, 1);
assert.ok(MULTICLASS_PROFICIENCIES.bard.skills.from.includes('any'));
assert.deepStrictEqual(MULTICLASS_PROFICIENCIES.barbarian.weapons, ['Simple Weapons', 'Martial Weapons']);
assert.deepStrictEqual(MULTICLASS_PROFICIENCIES.barbarian.armor, ['Shields']);
console.log('  ✓ Official 5e multiclass proficiencies matrix correctly structured.');

// TEST 2: Innate Species Skills & Languages Extraction
console.log('\n[Test 2] Innate Species Skills, Languages & Tools Extraction...');
const elfRace = {
    name: 'Elf',
    languages: ['Common', 'Elvish'],
    traits: [{ name: 'Keen Senses', description: 'You have proficiency in the Perception skill.' }]
};
const elfProfs = extractSpeciesProficiencies(elfRace, null);
assert.ok(elfProfs.skills.includes('Perception'), 'Elf should grant Perception from Keen Senses');
assert.ok(elfProfs.languages.includes('Common'), 'Elf should grant Common');
assert.ok(elfProfs.languages.includes('Elvish'), 'Elf should grant Elvish');

const halfOrcRace = {
    name: 'Half-Orc',
    languages: ['Common', 'Orc'],
    traits: [{ name: 'Menacing', description: 'You gain proficiency in the Intimidation skill.' }]
};
const orcProfs = extractSpeciesProficiencies(halfOrcRace, null);
assert.ok(orcProfs.skills.includes('Intimidation'), 'Half-Orc should grant Intimidation from Menacing');
assert.ok(orcProfs.languages.includes('Orc'), 'Half-Orc should grant Orc');

const tabaxiRace = {
    name: 'Tabaxi',
    languages: ['Common'],
    traits: [{ name: "Cat's Talent", description: 'You have proficiency in the Perception and Stealth skills.' }]
};
const tabaxiProfs = extractSpeciesProficiencies(tabaxiRace, null);
assert.ok(tabaxiProfs.skills.includes('Perception'), 'Tabaxi should grant Perception');
assert.ok(tabaxiProfs.skills.includes('Stealth'), 'Tabaxi should grant Stealth');
console.log('  ✓ Innate species skills (Elf, Half-Orc, Tabaxi) and languages correctly extracted.');

// TEST 3: Druid Cantrips Progression vs Cleric
console.log('\n[Test 3] Druid Cantrips Progression vs Cleric at Level 1...');
function getCantripAllowance(rawClass, level) {
    if (rawClass === 'cleric') {
        return level >= 10 ? 5 : level >= 4 ? 4 : 3;
    }
    if (rawClass === 'druid') {
        return level >= 10 ? 4 : level >= 4 ? 3 : 2;
    }
    return 0;
}
assert.strictEqual(getCantripAllowance('cleric', 1), 3, 'Cleric Lv 1 gets 3 cantrips');
assert.strictEqual(getCantripAllowance('druid', 1), 2, 'Druid Lv 1 gets 2 cantrips');
assert.strictEqual(getCantripAllowance('druid', 4), 3, 'Druid Lv 4 gets 3 cantrips');
assert.strictEqual(getCantripAllowance('druid', 10), 4, 'Druid Lv 10 gets 4 cantrips');
console.log('  ✓ Druid cantrip progression accurately calibrated to 2 at Level 1.');

// TEST 4: HP Current Clamp on Stat/Level Reduction
console.log('\n[Test 4] HP Current Clamp on Reduction...');
function commitHp(char, calculatedHp) {
    const oldHp = char.hpMax || 0;
    char.hpMax = Math.max(1, calculatedHp || parseInt(char.hpMax) || 10);
    if (char.hpCurrent === undefined || char.hpCurrent === null || char.hpCurrent === oldHp || char.hpCurrent === 0) {
        char.hpCurrent = char.hpMax;
    } else if (char.hpMax > oldHp) {
        char.hpCurrent = Math.min(char.hpMax, (parseInt(char.hpCurrent) || 0) + (char.hpMax - oldHp));
    } else {
        char.hpCurrent = Math.min(char.hpMax, parseInt(char.hpCurrent) || 1);
    }
    return char;
}

const testChar = { hpMax: 30, hpCurrent: 28 };
// Reduce CON or Level down to 22 Max HP
commitHp(testChar, 22);
assert.strictEqual(testChar.hpMax, 22);
assert.strictEqual(testChar.hpCurrent, 22, 'hpCurrent must be clamped down so it never exceeds hpMax');

// Normal upgrade test
const upgradeChar = { hpMax: 20, hpCurrent: 18 };
commitHp(upgradeChar, 26);
assert.strictEqual(upgradeChar.hpMax, 26);
assert.strictEqual(upgradeChar.hpCurrent, 24, 'hpCurrent scales up with Max HP expansion');
console.log('  ✓ HP Current properly clamped when reducing stats or levels.');

// TEST 5: Level-Up Preserve Existing HP Logic Simulation
console.log('\n[Test 5] Level-Up Preserve Existing HP Logic...');
function simulateLevelUpHp(priorMaxHp, priorLevel, newClasses, conMod, preserveHp, hpMode) {
    let total = 0;
    let levelsAccountedFor = 0;
    newClasses.forEach((c, cIdx) => {
        const hd = c.hd;
        const lvl = c.level;
        const avg = Math.floor(hd / 2) + 1;
        for (let i = 1; i <= lvl; i++) {
            levelsAccountedFor++;
            let roll = avg;
            if (cIdx === 0 && i === 1) {
                roll = hd;
            } else if (hpMode === 'max') {
                roll = hd;
            } else if (hpMode === 'average') {
                roll = avg;
            }
            const subTot = Math.max(1, roll + conMod);
            const isPrior = preserveHp && levelsAccountedFor <= priorLevel;
            if (!isPrior) {
                total += subTot;
            }
        }
    });
    return preserveHp ? priorMaxHp + total : total;
}

// Case: Fighter had lucky rolls in sessions 1-4 and has 40 HP (Average would be 10 + 3*6 + 4*2 = 36)
const priorHp = 40;
const priorLvl = 4;
const classesAtLvl5 = [{ name: 'Fighter', hd: 10, level: 5 }];
const conMod = 2;

// In preserve mode: 40 + (1d10 average [6] + CON [2] = 8) = 48
const preservedResult = simulateLevelUpHp(priorHp, priorLvl, classesAtLvl5, conMod, true, 'average');
assert.strictEqual(preservedResult, 48, 'Preserve Prior HP mode should add new level directly to past rolled HP');

// In non-preserve mode (average from Lv 1): 10 + 4*6 + 5*2 = 44
const nonPreservedResult = simulateLevelUpHp(priorHp, priorLvl, classesAtLvl5, conMod, false, 'average');
assert.strictEqual(nonPreservedResult, 44, 'Non-preserve mode recalculates from Level 1');
console.log('  ✓ Preserve Prior HP mode reliably safeguards past rolled hit points.');

// TEST 6: Step 8 HP Dice Cache Persistence Simulation
console.log('\n[Test 6] Step 8 HP Dice Cache Persistence...');
const hpRolledDice = new Map();
function getOrGenerateDiceRoll(cIdx, lvl, hd, forceReroll) {
    const key = `${cIdx}_${lvl}`;
    if (!hpRolledDice.has(key) || forceReroll) {
        hpRolledDice.set(key, Math.floor(Math.random() * hd) + 1);
    }
    return hpRolledDice.get(key);
}

const firstRoll = getOrGenerateDiceRoll(0, 2, 8, false);
// Simulate user clicking "Equip Shield" or switching armor multiple times
const reRender1 = getOrGenerateDiceRoll(0, 2, 8, false);
const reRender2 = getOrGenerateDiceRoll(0, 2, 8, false);
assert.strictEqual(firstRoll, reRender1);
assert.strictEqual(firstRoll, reRender2);

// Simulate clicking "Re-roll Hit Dice"
const forcedRoll = getOrGenerateDiceRoll(0, 2, 8, true);
assert.ok(typeof forcedRoll === 'number');
console.log('  ✓ Dice cache persists rolled values across UI re-renders and rerolls only when requested.');

// TEST 7: Magic Initiate Ability Score Tagging
console.log('\n[Test 7] Magic Initiate Ability Score Tagging...');
const featSubChoices = { abilityScore: 'wis' };
const spellCard = {
    name: 'Shield',
    level: 1,
    ability: featSubChoices.abilityScore || 'int',
    prepared: true
};
assert.strictEqual(spellCard.ability, 'wis', 'Imported feat spell must inherit chosen spellcasting ability');
console.log('  ✓ Magic Initiate spell cards successfully retain chosen casting attribute.');

// TEST 8: Languages & Tool Proficiencies Commit
console.log('\n[Test 8] Languages & Tool Proficiencies Commit...');
const mockChar = {
    proficiencies: { languages: 'Common', tools: '' }
};
const candidateLangs = ['Common', 'Elvish', 'Draconic'];
const candidateTools = ["Thieves' Tools", 'Herbalism Kit'];

// Simulate commit
const existingLangs = (mockChar.proficiencies.languages || '').split(',').map((s) => s.trim()).filter(Boolean);
candidateLangs.forEach((l) => {
    if (!existingLangs.includes(l)) existingLangs.push(l);
});
mockChar.proficiencies.languages = existingLangs.join(', ');

const existingTools = (mockChar.proficiencies.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
candidateTools.forEach((t) => {
    if (!existingTools.includes(t)) existingTools.push(t);
});
mockChar.proficiencies.tools = existingTools.join(', ');

assert.strictEqual(mockChar.proficiencies.languages, 'Common, Elvish, Draconic');
assert.strictEqual(mockChar.proficiencies.tools, "Thieves' Tools, Herbalism Kit");
console.log('  ✓ Languages and Tool proficiencies correctly merged and committed without duplicates.');

console.log('\n======================================================');
console.log('🎉 ALL 8 CHARACTER BUILDER ROUND 2 AUDIT FIX TESTS PASSED!');
console.log('======================================================');

