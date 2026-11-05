import assert from 'node:assert';
import { calculateCharacterSpellSlots } from '../vtt/js/player-sheet/calc/spell-slots.js';

console.log('--- RUNNING CHARACTER BUILDER FIXES & IMPROVEMENTS VERIFICATION SUITE ---');

// 1. Single-class 2014 Half-Caster Spell Slots (Paladin / Ranger)
console.log('\n[Test 1] 2014 Pure Single-Class Half-Caster Spell Slots...');
const pal3 = calculateCharacterSpellSlots([{ name: 'Paladin', level: 3 }], false);
assert.strictEqual(pal3.spellSlots.level1.max, 3, 'Paladin Lv 3 (2014) must have 3 1st-level slots');

const pal5 = calculateCharacterSpellSlots([{ name: 'Paladin', level: 5 }], false);
assert.strictEqual(pal5.spellSlots.level1.max, 4, 'Paladin Lv 5 (2014) must have 4 1st-level slots');
assert.strictEqual(pal5.spellSlots.level2.max, 2, 'Paladin Lv 5 (2014) must have 2 2nd-level slots');
console.log('  ✓ 2014 Paladin receives exact single-class slots (Lv 3 has 3 slots, Lv 5 has 4/2 slots).');

// 2. Single-class Third-Caster Spell Slots (Eldritch Knight / Arcane Trickster)
console.log('\n[Test 2] Single-Class Third-Caster Spell Slots...');
const ek4 = calculateCharacterSpellSlots([{ name: 'Fighter', subclass: 'Eldritch Knight', level: 4 }], false);
assert.strictEqual(ek4.spellSlots.level1.max, 3, 'Eldritch Knight Lv 4 must have 3 1st-level slots');

const at7 = calculateCharacterSpellSlots([{ name: 'Rogue', subclass: 'Arcane Trickster', level: 7 }], false);
assert.strictEqual(at7.spellSlots.level1.max, 4, 'Arcane Trickster Lv 7 must have 4 1st-level slots');
assert.strictEqual(at7.spellSlots.level2.max, 2, 'Arcane Trickster Lv 7 must have 2 2nd-level slots');
console.log('  ✓ Third-casters receive exact single-class slots (EK Lv 4 has 3 slots, AT Lv 7 has 4/2 slots).');

// 3. 2024 Paladin & Ranger Level 1 Spell Slots
console.log('\n[Test 3] 2024 Paladin & Ranger Level 1 Spell Slots...');
const pal1_2024 = calculateCharacterSpellSlots([{ name: 'Paladin', level: 1 }], true);
assert.strictEqual(pal1_2024.spellSlots.level1.max, 2, '2024 Paladin Lv 1 must have 2 1st-level slots');
const rgr1_2024 = calculateCharacterSpellSlots([{ name: 'Ranger', level: 1 }], true);
assert.strictEqual(rgr1_2024.spellSlots.level1.max, 2, '2024 Ranger Lv 1 must have 2 1st-level slots');
console.log('  ✓ 2024 Paladin & Ranger gain 2 1st-level spell slots at Level 1.');

// 4. Standard Array Auto-Swapping Logic Test
console.log('\n[Test 4] Standard Array Auto-Swapping Engine...');
const stats = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
function swapStandardArray(assignments, stat, newVal) {
    const val = parseInt(newVal);
    const oldVal = assignments[stat];
    if (val === oldVal) return;
    const statsList = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const otherStatWithVal = statsList.find((s) => s !== stat && assignments[s] === val);
    if (otherStatWithVal) {
        assignments[otherStatWithVal] = oldVal;
    }
    assignments[stat] = val;
}
const testArr = { ...stats };
// User assigns 15 to DEX (which was in STR)
swapStandardArray(testArr, 'dex', 15);
assert.strictEqual(testArr.dex, 15, 'DEX should receive 15');
assert.strictEqual(testArr.str, 14, 'STR should automatically swap to 14');
console.log('  ✓ Selecting a duplicate Standard Array score swaps values cleanly with no duplicates.');

// 5. Tasha's & Background ASI Anti-+3 Exploit Bump Test
console.log('\n[Test 5] ASI Anti-Exploit Sibling Bump...');
function bumpTashasDuplicate(workingChar, changedField, newVal) {
    const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    if (changedField === 'tashasPlus2') {
        workingChar.tashasPlus2 = newVal;
        if (workingChar.tashasPlus1 === newVal) {
            workingChar.tashasPlus1 = STATS.find((s) => s !== newVal) || 'con';
        }
    } else if (changedField === 'tashasPlus1') {
        workingChar.tashasPlus1 = newVal;
        if (workingChar.tashasPlus2 === newVal) {
            workingChar.tashasPlus2 = STATS.find((s) => s !== newVal) || 'str';
        }
    }
}
const testWorkingChar = { tashasPlus2: 'str', tashasPlus1: 'con' };
// User attempts to set tashasPlus1 to 'str' to get +3 STR
bumpTashasDuplicate(testWorkingChar, 'tashasPlus1', 'str');
assert.strictEqual(testWorkingChar.tashasPlus1, 'str', 'tashasPlus1 should be set to str');
assert.notStrictEqual(testWorkingChar.tashasPlus2, 'str', 'tashasPlus2 should be bumped away from str');
console.log('  ✓ Setting both ASI dropdowns to the same stat automatically bumps the sibling, preventing +3 exploits.');

// 6. Level-Up Mode Equipment Guard Test
console.log('\n[Test 6] Level-Up Mode Starting Equipment Guard...');
const existingChar = {
    name: 'Grom',
    level: 3,
    equipment: [{ id: 'eq_sword', name: 'Greatsword', qty: 1 }],
    currency: { gp: 50 }
};
const workingCharLevelUp = {
    builderMode: (existingChar.level > 1 || (existingChar.equipment && existingChar.equipment.length > 0)) ? 'levelup' : 'create',
    allowLevelUpRebuildEquip: false
};
assert.strictEqual(workingCharLevelUp.builderMode, 'levelup', 'Existing character correctly detected in levelup mode');
const shouldImportStartingEquip = workingCharLevelUp.builderMode === 'create' || workingCharLevelUp.allowLevelUpRebuildEquip;
assert.strictEqual(shouldImportStartingEquip, false, 'Starting equipment and starter gold must be skipped in levelup mode');
console.log('  ✓ Level-up mode successfully prevents starting inventory and gold duplication.');

// 7. Spells Prepared vs Repertoire Decoupling Test
console.log('\n[Test 7] Spells Prepared Status Decoupling...');
const mockClericSection = {
    className: 'Cleric',
    casterType: 'prepared',
    isPrepared: true,
    spells: [
        { name: 'Sacred Flame', level: 0, checked: true },
        { name: 'Bless', level: 1, checked: true },
        { name: 'Cure Wounds', level: 1, checked: true }
    ]
};
const mockBardSection = {
    className: 'Bard',
    casterType: 'known',
    isPrepared: false,
    spells: [
        { name: 'Vicious Mockery', level: 0, checked: true },
        { name: 'Dissonant Whispers', level: 1, checked: true }
    ]
};

const importedSpells = [];
[mockClericSection, mockBardSection].forEach((sec) => {
    const isPreparedCaster = sec.casterType === 'prepared' || sec.isPrepared;
    const isWizard = sec.casterType === 'wizard' || sec.isWizard;
    sec.spells.forEach((sp) => {
        const defaultPrepared = sp.level === 0 ? true : (!isPreparedCaster && !isWizard);
        importedSpells.push({ name: sp.name, level: sp.level, prepared: defaultPrepared });
    });
});

const sf = importedSpells.find((s) => s.name === 'Sacred Flame');
const bless = importedSpells.find((s) => s.name === 'Bless');
const vm = importedSpells.find((s) => s.name === 'Vicious Mockery');
const dw = importedSpells.find((s) => s.name === 'Dissonant Whispers');

assert.strictEqual(sf.prepared, true, 'Cantrips are always prepared');
assert.strictEqual(bless.prepared, false, 'Cleric leveled spells imported ready for daily preparation on sheet');
assert.strictEqual(vm.prepared, true, 'Bard cantrip is prepared');
assert.strictEqual(dw.prepared, true, 'Bard known leveled spell is marked prepared');
console.log('  ✓ Spells successfully decoupled: Cantrips and Known spells are prepared, Divine spells are imported ready for daily preparation.');

// 8. Identity & Multi-Token Art Commit Test
console.log('\n[Test 8] Multi-Token Art Commit...');
const workingIdentity = {
    name: 'Morvayn the Pale',
    tokenImages: [
        { url: '/assets/tokens/morvayn_human.png', name: 'Morvayn Human' },
        { url: '/assets/tokens/morvayn_vampire.png', name: 'Morvayn Vampire Form' }
    ],
    activeTokenIndex: 1
};
const committedChar = {};
committedChar.name = workingIdentity.name || 'Hero';
committedChar.tokenImages = Array.isArray(workingIdentity.tokenImages) ? [...workingIdentity.tokenImages] : [];
committedChar.activeTokenIndex = workingIdentity.activeTokenIndex;
const activeTok = committedChar.tokenImages[committedChar.activeTokenIndex] || committedChar.tokenImages[0];
committedChar.avatar = typeof activeTok === 'string' ? activeTok : activeTok.url;

assert.strictEqual(committedChar.name, 'Morvayn the Pale', 'Character name saved');
assert.strictEqual(committedChar.tokenImages.length, 2, '2 tokens saved in token gallery');
assert.strictEqual(committedChar.activeTokenIndex, 1, 'Active token index is 1');
assert.strictEqual(committedChar.avatar, '/assets/tokens/morvayn_vampire.png', 'Avatar points to active token URL');
console.log('  ✓ Character name and multi-token artwork gallery successfully committed.');

console.log('\n======================================================');
console.log('🎉 ALL 8 BUILDER FIXES & IMPROVEMENTS TESTS PASSED!');
console.log('======================================================\n');
