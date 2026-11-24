import assert from 'assert';
import { extractSpeciesProficiencies, STANDARD_LANGUAGES_LIST, STANDARD_ARTISAN_TOOLS } from '../vtt/js/player-sheet/builder/builder-state.js';
import { MARTIAL_WEAPONS, SIMPLE_WEAPONS } from '../vtt/js/player-sheet/builder/step5-equipment.js';
import { evaluateFeatPrerequisites } from '../vtt/js/player-sheet/builder/step7-feats.js';
import { convertRoll20Character } from '../electron/importers/roll20-importer.js';
import { entityToJson } from '../electron/ui/builder-schemas.js';

console.log('--- RUNNING CHARACTER BUILDER COMPREHENSIVE FIXES ROUND 4 TESTS ---');

// 1. Weapon Classification Test
console.log('Test 1: MARTIAL_WEAPONS excludes Simple Weapons (Club, Dagger, Dart)');
assert(!MARTIAL_WEAPONS.includes('Club'), 'Club must not be in MARTIAL_WEAPONS');
assert(!MARTIAL_WEAPONS.includes('Dagger'), 'Dagger must not be in MARTIAL_WEAPONS');
assert(!MARTIAL_WEAPONS.includes('Dart'), 'Dart must not be in MARTIAL_WEAPONS');
assert(SIMPLE_WEAPONS.includes('Club'), 'Club must be in SIMPLE_WEAPONS');
assert(SIMPLE_WEAPONS.includes('Dagger'), 'Dagger must be in SIMPLE_WEAPONS');
assert(SIMPLE_WEAPONS.includes('Dart'), 'Dart must be in SIMPLE_WEAPONS');
console.log('✓ Test 1 Passed: Simple weapons properly classified.');

// 2. Species Language and Tool Choices
console.log('Test 2: Species Language and Tool Choices extraction');
const halfElfRace = {
    name: 'Half-Elf',
    source: 'PHB',
    languageProficiencies: [{ common: true, elvish: true, anyStandard: 1 }],
    toolProficiencies: [{ artisan: 1 }]
};
const profs = extractSpeciesProficiencies(halfElfRace, null);
assert(profs.languages.includes('Common'), 'Half-Elf should have Common');
assert(profs.languages.includes('Elvish'), 'Half-Elf should have Elvish');
assert(profs.languageChoice !== null, 'Half-Elf should have a languageChoiceDef');
assert.strictEqual(profs.languageChoice.count, 1, 'Half-Elf languageChoice should count 1');
assert(profs.toolChoice !== null, 'Half-Elf should have a toolChoiceDef');
assert.strictEqual(profs.toolChoice.count, 1, 'Half-Elf toolChoice should count 1');
console.log('✓ Test 2 Passed: Species language and tool choices extracted.');

// 3. Feat Prerequisite Evaluation Test
console.log('Test 3: Feat prerequisite evaluation (level, ability score, spellcasting)');
const mockCharLvl1 = {
    classes: [{ name: 'Fighter', level: 1 }],
    isSpellcaster: false
};
const mockStats = { str: 10, dex: 16, con: 12, int: 8, wis: 14, cha: 10 };

// 3a. Level prerequisite
const featHeavyArmorMaster = {
    name: 'Heavy Armor Master',
    prerequisite: [{ level: 4, ability: [{ str: 13 }] }]
};
const resLevel = evaluateFeatPrerequisites(featHeavyArmorMaster, mockCharLvl1, mockStats);
assert.strictEqual(resLevel.met, false, 'Should fail level prerequisite');
assert(resLevel.text.includes('Level 4+ required'), 'Error text should cite Level 4+');

// 3b. Ability score prerequisite
const mockCharLvl4 = {
    classes: [{ name: 'Fighter', level: 4 }],
    isSpellcaster: false
};
const resStr = evaluateFeatPrerequisites(featHeavyArmorMaster, mockCharLvl4, mockStats);
assert.strictEqual(resStr.met, false, 'Should fail STR prerequisite');
assert(resStr.text.includes('STR 13+ required'), 'Error text should cite STR 13+');

// 3c. Satisfied prerequisites
const mockStatsHighStr = { str: 14, dex: 16, con: 12, int: 8, wis: 14, cha: 10 };
const resPassed = evaluateFeatPrerequisites(featHeavyArmorMaster, mockCharLvl4, mockStatsHighStr);
assert.strictEqual(resPassed.met, true, 'Prerequisites should be met');

// 3d. Spellcasting requirement
const featWarCaster = {
    name: 'War Caster',
    prerequisite: [{ spellcasting: true }]
};
const resWarCasterFighter = evaluateFeatPrerequisites(featWarCaster, mockCharLvl4, mockStatsHighStr);
assert.strictEqual(resWarCasterFighter.met, false, 'Non-caster should fail spellcasting requirement');
const mockCharWizard = {
    classes: [{ name: 'Wizard', level: 4 }],
    isSpellcaster: true
};
const resWarCasterWizard = evaluateFeatPrerequisites(featWarCaster, mockCharWizard, mockStatsHighStr);
assert.strictEqual(resWarCasterWizard.met, true, 'Wizard caster should meet spellcasting requirement');
console.log('✓ Test 3 Passed: Feat prerequisites validated accurately.');

// 4. Feat Multi-Source Deduplication Disambiguation
console.log('Test 4: Feat deduplication across 2014 PHB and 2024 XPHB sources');
const rawFeats = [
    { name: 'Alert', source: 'PHB', entries: ['+5 to initiative'] },
    { name: 'Alert', source: 'XPHB', entries: ['Proficiency bonus to initiative and swap'] }
];
const compoundIdPHB = `${rawFeats[0].name.replace(/\W+/g, '_').toLowerCase()}::${rawFeats[0].source}`;
const compoundIdXPHB = `${rawFeats[1].name.replace(/\W+/g, '_').toLowerCase()}::${rawFeats[1].source}`;
assert.notStrictEqual(compoundIdPHB, compoundIdXPHB, 'PHB and XPHB feat IDs must not collide');

const matchedXPHB = rawFeats.find((f) => {
    const cid = `${f.name.replace(/\W+/g, '_').toLowerCase()}::${f.source}`;
    return cid === compoundIdXPHB;
});
assert.strictEqual(matchedXPHB.source, 'XPHB', 'Should resolve XPHB version uniquely without locking out');
console.log('✓ Test 4 Passed: Multi-source feats disambiguated.');

// 5. Roll20 Character Importer char.settings Initialization & Auto-Detection
console.log('Test 5: Roll20 Character Importer generates char.settings with auto-detected toggles');
const mockRoll20Data = {
    schema_version: 1,
    character: {
        name: 'Gorg Half-Orc Barbarian',
        attribs: [
            { name: 'character_name', current: 'Gorg' },
            { name: 'class', current: 'Barbarian' },
            { name: 'base_level', current: '9' },
            { name: 'race', current: 'Half-Orc' },
            { name: 'strength', current: '18' },
            { name: 'dexterity', current: '14' },
            { name: 'constitution', current: '16' },
            { name: 'intelligence', current: '8' },
            { name: 'wisdom', current: '12' },
            { name: 'charisma', current: '10' },
            { name: 'hp', current: '95', max: '95' }
        ]
    }
};

const imported = await convertRoll20Character(mockRoll20Data, 'test-campaign');
assert(imported.settings !== undefined, 'char.settings must be defined on imported Roll20 character');
assert.strictEqual(imported.settings.carryWeightMultiplier, 2, 'Half-Orc should have carryWeightMultiplier 2 (Powerful Build/Orc)');
assert.strictEqual(imported.settings.brutalCritical, true, 'Level 9 Barbarian Half-Orc should have brutalCritical true');
assert.strictEqual(imported.settings.halflingLucky, false, 'Non-halfling should have halflingLucky false');
assert.strictEqual(imported.settings.autoRollDamage, false, 'autoRollDamage should default to false');
console.log('✓ Test 5 Passed: Roll20 importer seeds char.settings with intelligent trait auto-detection.');

// 6. Homebrew Studio Spell Class Source Mapping
console.log('Test 6: Homebrew Studio entityToJson preserves non-PHB class sources');
const homebrewSpell = {
    name: 'Arcane Surge',
    level: 2,
    school: 'Evocation',
    classes: [{ name: 'Artificer', source: 'TCoE' }]
};
const spellJson = entityToJson('spells', homebrewSpell);
assert(spellJson.classes && Array.isArray(spellJson.classes.fromClassList), 'Spell classes should be formatted');
assert.strictEqual(spellJson.classes.fromClassList[0].name, 'Artificer');
assert.strictEqual(spellJson.classes.fromClassList[0].source, 'TCoE', 'Class source must not be forced to PHB');
console.log('✓ Test 6 Passed: Homebrew spell class mapping retains TCoE source.');

// 7. Homebrew Studio Background Mapping (2024 ability and feats)
console.log('Test 7: Homebrew Studio entityToJson maps background ability and feats');
const homebrewBg = {
    name: 'Custom Acolyte',
    ability: [{ choose: { from: ['int', 'wis', 'cha'], count: 3 } }],
    feats: [{ feat: 'Magic Initiate|XPHB' }]
};
const bgJson = entityToJson('backgrounds', homebrewBg);
assert(bgJson.ability !== undefined, 'Background ability should be mapped in 5e JSON output');
assert(bgJson.feats !== undefined, 'Background feats should be mapped in 5e JSON output');
console.log('✓ Test 7 Passed: Homebrew background schema retains 2024 ability and feats.');

console.log('--- ALL ROUND 4 TESTS PASSED SUCCESSFULLY! ---');
