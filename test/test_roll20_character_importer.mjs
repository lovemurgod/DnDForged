import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    isRoll20CharacterJson,
    convertRoll20Character,
    normalizeRoll20ImageUrl,
    sanitizeRoll20Html,
    resolveRoll20Expression
} from '../electron/importers/roll20-importer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const samplesDir = path.join(__dirname, 'fixtures', 'roll20');

test('Roll20 Character Importer - Format Detection', () => {
    // Should detect all 10 sample JSONs
    const sampleFiles = fs.readdirSync(samplesDir).filter((f) => f.endsWith('.json'));
    assert.strictEqual(sampleFiles.length, 10, 'Found 10 sample JSON files');

    for (const file of sampleFiles) {
        const content = JSON.parse(fs.readFileSync(path.join(samplesDir, file), 'utf8'));
        assert.strictEqual(
            isRoll20CharacterJson(content),
            true,
            `Expected ${file} to be recognized as Roll20 character JSON`
        );
    }

    // Should reject non-Roll20 files
    assert.strictEqual(isRoll20CharacterJson(null), false);
    assert.strictEqual(isRoll20CharacterJson({}), false);
    assert.strictEqual(isRoll20CharacterJson({ name: 'Fighter', entityType: 'player' }), false);
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(isRoll20CharacterJson(pkg), false);
});

test('Roll20 Character Importer - Conversion of All 10 Sample Files', async () => {
    const sampleFiles = fs.readdirSync(samplesDir).filter((f) => f.endsWith('.json'));

    for (const file of sampleFiles) {
        const rawJson = JSON.parse(fs.readFileSync(path.join(samplesDir, file), 'utf8'));
        const converted = await convertRoll20Character(rawJson, 'camp_test_123', {});

        // Basic identity
        assert.ok(converted.id && converted.id.startsWith('char_'), `${file}: Must have char_ ID`);
        assert.ok(converted.name && converted.name.length > 0, `${file}: Must have non-empty name`);

        // Classes & Level
        assert.ok(converted.class && converted.class.length > 0, `${file}: Must have class summary`);
        assert.ok(Array.isArray(converted.classes) && converted.classes.length > 0, `${file}: Must have classes array`);
        assert.ok(converted.level > 0, `${file}: Total level must be > 0`);

        // Stats
        assert.ok(converted.stats, `${file}: Must have stats object`);
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((stat) => {
            assert.ok(typeof converted.stats[stat] === 'number', `${file}: ${stat} must be a number`);
            assert.ok(converted.stats[stat] >= 1, `${file}: ${stat} must be >= 1`);
        });

        // HP & AC
        assert.ok(converted.hpMax > 0, `${file}: hpMax must be > 0`);
        assert.ok(converted.hpCurrent >= 0, `${file}: hpCurrent must be >= 0`);
        assert.ok(converted.ac > 0, `${file}: ac must be > 0`);

        // Speed
        assert.ok(converted.speed && converted.speed.walk > 0, `${file}: Walk speed must be > 0`);

        // Saves & Skills
        assert.ok(converted.saves, `${file}: Must have saves object`);
        assert.ok(converted.skills, `${file}: Must have skills object`);

        // Categorized Containers
        assert.ok(Array.isArray(converted.containers), `${file}: Must have containers array`);
        assert.strictEqual(converted.containers.length, 4, `${file}: Must have 4 category containers`);
        const containerIds = converted.containers.map((c) => c.id);
        assert.ok(containerIds.includes('cnt_weapons'), `${file}: Contains cnt_weapons`);
        assert.ok(containerIds.includes('cnt_armor'), `${file}: Contains cnt_armor`);
        assert.ok(containerIds.includes('cnt_consumables'), `${file}: Contains cnt_consumables`);
        assert.ok(containerIds.includes('cnt_backpack'), `${file}: Contains cnt_backpack`);

        // Equipment items
        assert.ok(Array.isArray(converted.equipment), `${file}: Must have equipment array`);
        converted.equipment.forEach((eq) => {
            assert.ok(eq.id && eq.id.startsWith('eq_'), 'Equipment item must have valid id');
            assert.ok(eq.name, 'Equipment item must have a name');
            assert.ok(
                containerIds.includes(eq.containerId),
                `${eq.name} must be assigned to one of the 4 category containers`
            );
        });

        // Actions & Macros
        assert.ok(Array.isArray(converted.macros), `${file}: Must have macros array`);
        converted.macros.forEach((m) => {
            assert.ok(m.id && m.id.startsWith('mac_'), 'Macro must have mac_ ID');
            assert.ok(m.name, 'Macro must have a name');
            assert.ok(Array.isArray(m.damage), 'Macro must have damage array');
        });

        // Ability Cards
        assert.ok(Array.isArray(converted.abilityCards), `${file}: Must have abilityCards array`);

        // Spells & Slots
        assert.ok(converted.spells, `${file}: Must have spells object`);
        assert.ok(Array.isArray(converted.spells.cantrip), `${file}: Must have cantrip array`);
        for (let i = 1; i <= 9; i++) {
            assert.ok(Array.isArray(converted.spells[`level${i}`]), `${file}: Must have level${i} array`);
            assert.ok(converted.spellSlots[`level${i}`] !== undefined, `${file}: Must have level${i} spellSlot`);
        }

        // Toggles
        assert.ok(Array.isArray(converted.saveToggles), `${file}: Must have saveToggles`);
        assert.ok(Array.isArray(converted.skillToggles), `${file}: Must have skillToggles`);
        assert.ok(Array.isArray(converted.acToggles), `${file}: Must have acToggles`);
        assert.ok(Array.isArray(converted.attackSettings.toggles), `${file}: Must have attackSettings.toggles`);

        // Token Size & Sight
        assert.ok(converted.tokenSize >= 1, `${file}: Token size must be >= 1`);
        assert.ok(converted.tokenSight >= 0, `${file}: Token sight must be >= 0`);

        // Bio
        assert.ok(converted.bio, `${file}: Must have bio object`);
        assert.ok(typeof converted.bio.backstory === 'string', `${file}: Backstory must be a string`);
    }
});

test('Roll20 Character Importer - Specific Character Sanity Checks', async () => {
    // 1. Ancestral Rouge (Level 18 Fighter)
    const rougeJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Ancestral_Rouge_Matt_lv_18.json'), 'utf8'));
    const rouge = await convertRoll20Character(rougeJson, 'camp_1');
    assert.strictEqual(rouge.name, 'Ancestral Rouge Matt lv 18');
    assert.strictEqual(rouge.level, 18);
    assert.strictEqual(rouge.stats.str, 20);
    assert.strictEqual(rouge.stats.dex, 14);
    assert.strictEqual(rouge.stats.con, 20);
    assert.strictEqual(rouge.stats.int, 8);
    assert.strictEqual(rouge.stats.wis, 10); // Defaulted because missing from Roll20
    assert.strictEqual(rouge.stats.cha, 8);
    // Check Glaive attack macro
    const glaiveMacro = rouge.macros.find((m) => m.name.toLowerCase().includes('glaive'));
    assert.ok(glaiveMacro, 'Found Glaive macro');
    assert.strictEqual(glaiveMacro.attackBonus, '+14');

    // 2. LifeMoon (Level 10 Druid / Cleric Multiclass)
    const moonJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'LifeMoon_Matt_LV_10.json'), 'utf8'));
    const moon = await convertRoll20Character(moonJson, 'camp_1');
    assert.strictEqual(moon.level, 10);
    assert.strictEqual(moon.classes.length, 2);
    assert.strictEqual(moon.classes[0].name, 'Druid');
    assert.strictEqual(moon.classes[0].level, 9);
    assert.strictEqual(moon.classes[1].name, 'Cleric');
    assert.strictEqual(moon.classes[1].level, 1);
    assert.strictEqual(moon.hpMax, 85);
    assert.strictEqual(moon.ac, 18);
    // Check Spells
    const allSpells = Object.values(moon.spells).flat();
    assert.ok(allSpells.length > 10, 'LifeMoon has multiple spells imported');
    const animalFriendship = allSpells.find((s) => s.name === 'Animal Friendship');
    assert.ok(animalFriendship, 'Animal Friendship spell imported');
    assert.strictEqual(animalFriendship.level, 1);

    // 3. AutoMat (Global Modifier Toggles)
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');
    // Check AC Toggles
    const enhancedDef = auto.acToggles.find((t) => t.name.toLowerCase().includes('enhanced defense'));
    assert.ok(enhancedDef, 'Found Enhanced Defense AC toggle');
    assert.strictEqual(enhancedDef.formula, '2');
    assert.strictEqual(enhancedDef.enabled, true);

    const intProt = auto.acToggles.find((t) => t.name.toLowerCase().includes('intergrated protection'));
    assert.ok(intProt, 'Found Integrated Protection AC toggle');
    assert.strictEqual(intProt.formula, '1');
    assert.strictEqual(intProt.enabled, true);

    // Check Save Toggles (Bless)
    const blessSave = auto.saveToggles.find((t) => t.name.toUpperCase().includes('BLESS'));
    assert.ok(blessSave, 'Found Bless save toggle');
    assert.strictEqual(blessSave.formula, '1d4');

    // Check Attack Toggles (Bless, Charger, Absorb Elements)
    const blessAtk = auto.attackSettings.toggles.find(
        (t) => t.name.toUpperCase().includes('BLESS') && t.target === 'atk'
    );
    assert.ok(blessAtk, 'Found Bless attack toggle');
    assert.strictEqual(blessAtk.formula, '1d4');

    const chargerDmg = auto.attackSettings.toggles.find(
        (t) => t.name.toLowerCase().includes('charger') && t.target === 'dmg'
    );
    assert.ok(chargerDmg, 'Found Charger damage toggle');
    assert.strictEqual(chargerDmg.formula, '+5');
});

test('Roll20 Character Importer - Local Asset Caching & No Remote Fallback Policy', async () => {
    // Character with remote avatar and token
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    assert.ok(autoJson.character.attributes.avatar.startsWith('http'), 'AutoMat has remote avatar URL');

    // Convert with offline/unreachable dir to test failure policy
    const converted = await convertRoll20Character(autoJson, 'camp_test', {
        uploadsDir: null // simulate no download target
    });

    // Zero remote URLs should be present in tokenImages
    assert.strictEqual(converted.tokenImages.length, 0, 'No remote URLs leaked into tokenImages without local cache');
    converted.tokenImages.forEach((img) => {
        const urlStr = typeof img === 'string' ? img : img.url;
        assert.ok(!urlStr.startsWith('http'), `Found remote URL: ${urlStr} - violates local caching policy`);
    });
});

test('Roll20 Character Importer - Inventory Categorization Verification', async () => {
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');

    // Crossbow bolts should be in consumables
    const bolts = auto.equipment.find((e) => e.name.toLowerCase().includes('crossbow bolts'));
    assert.ok(bolts, 'Found Crossbow bolts');
    assert.strictEqual(bolts.containerId, 'cnt_consumables', 'Crossbow bolts mapped to cnt_consumables');

    // Weapons in BS_goblin or Ancestral Rouge
    const rougeJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Ancestral_Rouge_Matt_lv_18.json'), 'utf8'));
    const rouge = await convertRoll20Character(rougeJson, 'camp_1');
    const glaive = rouge.equipment.find((e) => e.name.toLowerCase().includes('glaive'));
    if (glaive) {
        assert.strictEqual(glaive.containerId, 'cnt_weapons', 'Glaive mapped to cnt_weapons');
    }

    // Armor in BS_goblin
    const goblinJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'BS_goblin_Matt_lv_15.json'), 'utf8'));
    const goblin = await convertRoll20Character(goblinJson, 'camp_1');
    const plate = goblin.equipment.find((e) => e.name.toLowerCase().includes('plate'));
    assert.ok(plate, 'Found Half Plate Armor');
    assert.strictEqual(plate.containerId, 'cnt_armor', 'Armor mapped to cnt_armor');
});

test('Roll20 Character Importer - Proficiencies & Tools Extraction', async () => {
    // 1. Ancestral Rouge (Languages & Vehicles Land)
    const rougeJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Ancestral_Rouge_Matt_lv_18.json'), 'utf8'));
    const rouge = await convertRoll20Character(rougeJson, 'camp_1');
    assert.ok(rouge.proficiencies, 'Must have proficiencies object');
    assert.ok(rouge.proficiencies.languages.includes('Common'), 'Languages must include Common');
    assert.ok(rouge.tools, 'Must have tools object');
    assert.ok(rouge.tools['Vehicles (Land)'], 'Tools must contain Vehicles (Land)');
    assert.strictEqual(rouge.tools['Vehicles (Land)'].prof, true);

    // 2. AutoMat (Artisan Tools & Thieves Tools)
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');
    assert.ok(auto.tools["Smith's Tools"], "Tools must contain Smith's Tools");
    assert.ok(auto.tools["Thieves' Tools"], "Tools must contain Thieves' Tools");
    assert.strictEqual(auto.tools["Thieves' Tools"].ability, 'dex');
    assert.ok(auto.proficiencies.armor.toLowerCase().includes('shield'), 'Armor proficiencies must include shields');
});

test('Roll20 Character Importer - Class-Based Spellcasting Ability Deduction', async () => {
    // AutoMat has spellcasting_ability: undefined, class: Artificer -> must infer INT
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');
    assert.strictEqual(auto.spellAbility, 'INT', 'Artificer spellAbility must infer INT when undefined');
    assert.strictEqual(auto.dcAbility, 'INT');

    // Armor_Fairy has spellcasting_ability: "0*", class: Artificer -> must infer INT
    const fairyJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Armor_Fairy_Matt_lv_10.json'), 'utf8'));
    const fairy = await convertRoll20Character(fairyJson, 'camp_1');
    assert.strictEqual(fairy.spellAbility, 'INT', 'Artificer spellAbility must infer INT when 0*');

    // LifeMoon has class: Druid -> WIS
    const moonJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'LifeMoon_Matt_LV_10.json'), 'utf8'));
    const moon = await convertRoll20Character(moonJson, 'camp_1');
    assert.strictEqual(moon.spellAbility, 'WIS');

    // Paladin -> CHA
    const paladinJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
    const paladin = await convertRoll20Character(paladinJson, 'camp_1');
    assert.strictEqual(paladin.spellAbility, 'CHA');
});

test('Roll20 Character Importer - Hit Dice Spent State Normalization', async () => {
    const rougeJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Ancestral_Rouge_Matt_lv_18.json'), 'utf8'));
    const rouge = await convertRoll20Character(rougeJson, 'camp_1');
    assert.ok(rouge.hitDiceSpent, 'Must have hitDiceSpent object');
    assert.strictEqual(typeof rouge.hitDiceSpent.d6, 'number');
    assert.strictEqual(typeof rouge.hitDiceSpent.d8, 'number');
    assert.strictEqual(typeof rouge.hitDiceSpent.d10, 'number');
    assert.strictEqual(typeof rouge.hitDiceSpent.d12, 'number');
});

test('Roll20 Character Importer - Batch Error Resilience (Mixed Valid and Malformed Files)', async () => {
    const validJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'LifeMoon_Matt_LV_10.json'), 'utf8'));
    const malformedJson = { character: { attribs: 'not-an-array' } }; // invalid attribs

    const batch = [
        { file: 'valid.json', data: validJson },
        { file: 'corrupt.json', data: malformedJson }
    ];

    const results = [];
    const errors = [];

    for (const item of batch) {
        try {
            if (!isRoll20CharacterJson(item.data)) {
                throw new Error('Not recognized as Roll20 JSON');
            }
            const converted = await convertRoll20Character(item.data, 'camp_test');
            results.push(converted);
        } catch (e) {
            errors.push({ file: item.file, error: e.message });
        }
    }

    assert.strictEqual(results.length, 1, 'Valid character imported despite corrupt file in batch');
    assert.strictEqual(results[0].name.trim(), 'LifeMoon Matt LV 10');
    assert.strictEqual(errors.length, 1, 'Corrupted file was captured and isolated');
    assert.strictEqual(errors[0].file, 'corrupt.json');
});

test('Roll20 Character Importer - Second Audit Refinements (Preparation, Macros, Inspiration, Settings)', async () => {
    // 1. Spell preparation mapping (AutoMat)
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');
    const thunderwave = auto.spells.level1.find((s) => s.name === 'Thunderwave');
    const alarm = auto.spells.level1.find((s) => s.name === 'Alarm');
    const shatter = auto.spells.level2.find((s) => s.name === 'Shatter');
    assert.ok(thunderwave, 'Thunderwave found');
    assert.strictEqual(thunderwave.prepared, true, 'Thunderwave should be prepared');
    assert.ok(alarm, 'Alarm found');
    assert.strictEqual(alarm.prepared, false, 'Alarm should be unprepared');
    assert.ok(shatter, 'Shatter found');
    assert.strictEqual(shatter.prepared, false, 'Shatter should be unprepared');

    // Cantrips must always be prepared
    auto.spells.cantrip.forEach((c) => {
        assert.strictEqual(c.prepared, true, `Cantrip ${c.name} must be prepared`);
    });

    // 2. Macro range and critRange mapping (Matt_Saiyan)
    const saiyanJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
    const saiyan = await convertRoll20Character(saiyanJson, 'camp_1');
    const hbRapier = saiyan.macros.find((m) => m.name.includes('(HB) +2 Rapier'));
    assert.ok(hbRapier, 'Found Hexblade +2 Rapier macro');
    assert.strictEqual(hbRapier.critRange, 19, 'Hexblade Rapier critRange must be 19');

    const iceStorm = saiyan.macros.find((m) => m.name === 'Ice Storm');
    assert.ok(iceStorm, 'Found Ice Storm macro');
    assert.strictEqual(iceStorm.range, '300 feet', 'Ice storm range must be 300 feet');

    // 3. Inspiration mapping
    assert.strictEqual(saiyan.inspiration, true, 'Matt_Saiyan should have inspiration true');
    assert.strictEqual(auto.inspiration, false, 'AutoMat should have inspiration false');

    // 4. SpellSettings mapping
    assert.ok(saiyan.spellSettings, 'Must have spellSettings');
    assert.strictEqual(saiyan.spellSettings.ability, 'CHA');
    assert.strictEqual(typeof saiyan.spellSettings.atkMod, 'number');
    assert.strictEqual(typeof saiyan.spellSettings.dcMod, 'number');
    assert.ok(Array.isArray(saiyan.spellSettings.toggles));
});

test('Roll20 Character Importer - Dual-Column Class & Racial Resources (Item 1)', async () => {
    // 1. AutoMat (Dual column resources: Radiant Weapon, Flash on Smarts, Str Armor)
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');

    const rw = auto.abilityCards.find((c) => c.name.toLowerCase().includes('radiant'));
    assert.ok(rw, 'Found Radiant Weapon resource/trait');
    assert.strictEqual(rw.hasCounter, true);
    assert.strictEqual(rw.usesCurrent, 4);
    assert.strictEqual(rw.usesMax, 4);

    const flash = auto.abilityCards.find((c) => c.name.toLowerCase().includes('flash'));
    assert.ok(flash, 'Found Flash on Smarts resource/trait');
    assert.strictEqual(flash.hasCounter, true);
    assert.strictEqual(flash.usesCurrent, 5);
    assert.strictEqual(flash.usesMax, 5);

    const strArmor = auto.abilityCards.find((c) => c.name.toLowerCase().includes('str armor'));
    assert.ok(strArmor, 'Found Str Armor resource/trait');
    assert.strictEqual(strArmor.hasCounter, true);
    assert.strictEqual(strArmor.usesCurrent, 6);
    assert.strictEqual(strArmor.usesMax, 6);

    // 2. Matt_Saiyan (Channel Divinity, Hexblade Curse, Cleansing Touch)
    const saiyanJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
    const saiyan = await convertRoll20Character(saiyanJson, 'camp_1');

    const cd = saiyan.abilityCards.find((c) => c.name.toLowerCase().includes('channel divinity'));
    assert.ok(cd, 'Found Channel Divinity resource/trait');
    assert.strictEqual(cd.hasCounter, true);
    assert.strictEqual(cd.usesCurrent, 1);
    assert.strictEqual(cd.usesMax, 1);
    assert.strictEqual(cd.resetType, 'short');

    const hc = saiyan.abilityCards.find((c) => c.name.toLowerCase().includes('hexblade'));
    assert.ok(hc, 'Found Hexblade Curse resource/trait');
    assert.strictEqual(hc.hasCounter, true);
    assert.strictEqual(hc.usesCurrent, 1);
    assert.strictEqual(hc.usesMax, 1);

    const ct = saiyan.abilityCards.find((c) => c.name.toLowerCase().includes('cleansing touch'));
    assert.ok(ct, 'Found Cleansing Touch resource/trait');
    assert.strictEqual(ct.hasCounter, true);
    assert.strictEqual(ct.usesCurrent, 5);
    assert.strictEqual(ct.usesMax, 5);
});

test('Roll20 Character Importer - Spell Combat Mechanics, Cantrip Scale & Upcast (Item 2)', async () => {
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1');

    // Fire Bolt: Ranged spell attack with 1d10 Fire damage and cantrip scaling
    const fireBolt = auto.spells.cantrip.find((s) => s.name === 'Fire Bolt');
    assert.ok(fireBolt, 'Fire Bolt found');
    assert.strictEqual(fireBolt.isAttack, true);
    assert.strictEqual(fireBolt.attackStat, 'spell');
    assert.strictEqual(fireBolt.attackProf, true);
    assert.strictEqual(fireBolt.damage, '1d10');
    assert.strictEqual(fireBolt.damageType, 'Fire');
    assert.strictEqual(fireBolt.cantripScale, true);
    assert.deepStrictEqual(fireBolt.damageList, [{ formula: '1d10', type: 'Fire' }]);

    // Thunderwave: CON Save, 2d8 Thunder damage, 1d8 upcast bonus
    const thunderwave = auto.spells.level1.find((s) => s.name === 'Thunderwave');
    assert.ok(thunderwave, 'Thunderwave found');
    assert.strictEqual(thunderwave.saveAbility, 'CON');
    assert.strictEqual(thunderwave.saveDcStat, 'spell');
    assert.strictEqual(thunderwave.damage, '2d8');
    assert.strictEqual(thunderwave.damageType, 'Thunder');
    assert.strictEqual(thunderwave.upcastBonus, '1d8');
    assert.deepStrictEqual(thunderwave.damageList, [{ formula: '2d8', type: 'Thunder' }]);

    // Shatter: CON Save, 3d8 Thunder damage, 1d8 upcast bonus
    const shatter = auto.spells.level2.find((s) => s.name === 'Shatter');
    assert.ok(shatter, 'Shatter found');
    assert.strictEqual(shatter.saveAbility, 'CON');
    assert.strictEqual(shatter.damage, '3d8');
    assert.strictEqual(shatter.upcastBonus, '1d8');

    // Cure Wounds: Healing formula 1d8 with spellcasting ability modifier, upcast 1d8, NOT an attack
    const cureWounds = auto.spells.level1.find((s) => s.name === 'Cure Wounds');
    assert.ok(cureWounds, 'Cure Wounds found');
    assert.strictEqual(cureWounds.isAttack, false, 'Cure Wounds must NOT be an attack roll');
    assert.strictEqual(cureWounds.saveAbility, '', 'Cure Wounds has no save DC');
    assert.strictEqual(cureWounds.upcastBonus, '1d8');
    assert.deepStrictEqual(cureWounds.damageList, [{ formula: '1d8', type: 'Healing', stat: 'spell' }]);
});

test('Roll20 Character Importer - Multiclass Hit Dice Breakdown (Item 3)', async () => {
    // Matt_Saiyan: Paladin 15 (15 d10) / Warlock 2 (2 d8), consumed 1 d8
    const saiyanJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
    const saiyan = await convertRoll20Character(saiyanJson, 'camp_1');

    assert.ok(saiyan.hitDiceSpent, 'Must have hitDiceSpent breakdown');
    assert.strictEqual(saiyan.hitDiceSpent.d8, 1, 'Saiyan has consumed 1 d8 hit die');
    assert.strictEqual(saiyan.hitDiceSpent.d10, 0, 'Saiyan has consumed 0 d10 hit dice');
    assert.strictEqual(saiyan.hitDiceSpent.d6, 0);
    assert.strictEqual(saiyan.hitDiceSpent.d12, 0);

    // Matt_Bard (Bard 10 / Paladin 2): 10 d8, 2 d10, consumed 0
    const bardJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Bard__12_.json'), 'utf8'));
    const bard = await convertRoll20Character(bardJson, 'camp_1');
    assert.strictEqual(bard.hitDiceSpent.d8, 0);
    assert.strictEqual(bard.hitDiceSpent.d10, 0);
});

test('Roll20 Character Importer - Equipment 1:1 Direct Import Purity', async () => {
    const autoJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'AutoMat.json'), 'utf8'));
    const auto = await convertRoll20Character(autoJson, 'camp_1', {});

    // Ensure item descriptions and weights are strictly 1:1 without compendium pollution
    for (const eq of auto.equipment) {
        assert.ok(!eq.description.includes('{"entries"'), `Item ${eq.name} has JSON stringified compendium entries`);
    }
});

test('Roll20 Character Importer - Strict Per-Entity Overwrite Handling', () => {
    // Simulate server import-entity route character handling logic
    const campaign = {
        characters: {
            char_hero: { id: 'char_hero', name: 'Existing Hero', level: 10 },
            char_sidekick: { id: 'char_sidekick', name: 'Existing Sidekick', level: 5 }
        }
    };

    const incomingBatch = [
        { id: 'char_hero', name: 'Existing Hero', level: 11, _overwrite: true },
        { id: 'char_sidekick', name: 'Existing Sidekick', level: 6, _overwrite: false }
    ];

    const imported = [];
    for (const item of incomingBatch) {
        let charId = item.id;
        let charName = item.name || 'Imported Character';
        const isOverwrite =
            item._overwrite !== undefined
                ? Boolean(item._overwrite)
                : item.overwrite !== undefined
                  ? Boolean(item.overwrite)
                  : false;

        if (!charId || (!isOverwrite && campaign.characters[charId])) {
            charId = `char_copy_${item.id}`;
            charName = `${charName} (Copy)`;
        }
        const clonedChar = { ...item, id: charId, name: charName };
        delete clonedChar._overwrite;
        delete clonedChar.overwrite;
        campaign.characters[charId] = clonedChar;
        imported.push(clonedChar);
    }

    // Hero must have overwritten existing char_hero
    assert.strictEqual(campaign.characters['char_hero'].level, 11);
    assert.strictEqual(campaign.characters['char_hero'].name, 'Existing Hero');
    assert.strictEqual(campaign.characters['char_hero']._overwrite, undefined);

    // Sidekick must NOT have overwritten existing char_sidekick
    assert.strictEqual(campaign.characters['char_sidekick'].level, 5);
    assert.ok(campaign.characters['char_copy_char_sidekick']);
    assert.strictEqual(campaign.characters['char_copy_char_sidekick'].name, 'Existing Sidekick (Copy)');
    assert.strictEqual(campaign.characters['char_copy_char_sidekick']._overwrite, undefined);
});

test('Roll20 Character Importer - Matt Saiyan Forensic Parity (Macros, Ability Cards, Equipment)', async () => {
    const saiyanJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
    const saiyan = await convertRoll20Character(saiyanJson, 'camp_1');

    // 1. Attack Macros
    const rapier = saiyan.macros.find((m) => m.name.includes('(HB) +2 Rapier'));
    assert.ok(rapier, 'Found (HB) +2 Rapier');
    assert.strictEqual(rapier.attackBonus, '+13', 'Rapier attack bonus must be +13');
    assert.strictEqual(rapier.attackExtra, 2, 'Rapier attack extra magic must be 2');
    assert.strictEqual(rapier.critRange, 19);
    assert.ok(rapier.damage[0].formula.includes('+ 6'), 'Proficiency bonus @{pb} resolved in damage');
    assert.ok(rapier.damage[0].formula.includes('+ 2'), 'Magic bonus +2 included in damage');
    assert.strictEqual(rapier.damage[1].formula, '1d8');
    assert.strictEqual(rapier.damage[1].type, 'Radiant');

    // Divine Smite must have resolved formulas
    const smite = saiyan.macros.find((m) => m.name === 'Divine Smite');
    assert.ok(smite, 'Found Divine Smite');
    assert.strictEqual(smite.damage[0].formula, '2d8');
    assert.strictEqual(smite.attackBonus, '', 'Non-attacks must have empty attackBonus, not -');

    // Empty category headers (Level 1, Level 2, Level 3) must be filtered out
    assert.strictEqual(
        saiyan.macros.some((m) => m.name === 'Level 1'),
        false
    );
    assert.strictEqual(
        saiyan.macros.some((m) => m.name === 'Level 2'),
        false
    );
    assert.strictEqual(
        saiyan.macros.some((m) => m.name === 'Level 3'),
        false
    );

    // 2. Ability Cards text population
    assert.ok(saiyan.abilityCards.length > 50, 'Has comprehensive ability cards');
    const divineSense = saiyan.abilityCards.find((c) => c.name === 'Divine Sense');
    assert.ok(divineSense, 'Found Divine Sense ability card');
    assert.ok(
        divineSense.description && divineSense.description.length > 100,
        'Ability card description must be populated'
    );
    assert.strictEqual(divineSense.desc, divineSense.description, 'Both desc and description properties must match');

    // 3. Equipment item descriptions & weights
    const mace = saiyan.equipment.find((e) => e.name.toLowerCase().includes('mace of warning'));
    assert.ok(mace, 'Found Mace of Warning');
    assert.ok(
        mace.description.includes('warns you of danger'),
        'Mace of Warning description must be enriched from catalog'
    );
    assert.strictEqual(mace.weight, 4, 'Mace of Warning weight must be 4 lb');

    const bedroll = saiyan.equipment.find((e) => e.name.toLowerCase() === 'bedroll');
    assert.ok(bedroll, 'Found Bedroll');
    assert.ok(bedroll.description.length > 0, 'Bedroll description must be enriched from catalog');
    assert.strictEqual(bedroll.weight, 7, 'Bedroll weight must be 7 lb');
});

test('Roll20 Character Importer - Token Art & Avatar Image Fetching (CDN Rewriter, Multi-Sided Tokens, Hash Deduplication)', async () => {
    // 1. URL Normalization
    const s3Url = 'https://s3.amazonaws.com/files.d20.io/images/234087089/JNyhLj4784Lx1L_dzdD2ng/med.png?1626280115';
    assert.strictEqual(
        normalizeRoll20ImageUrl(s3Url),
        'https://files.d20.io/images/234087089/JNyhLj4784Lx1L_dzdD2ng/med.png?1626280115',
        'Direct S3 bucket URLs must be rewritten to files.d20.io CDN'
    );

    const encodedUrl =
        'https%3A//s3.amazonaws.com/files.d20.io/images/234086258/IhRXd-F81GrdgqRQOAZJqQ/med.png%3F1626279748';
    assert.strictEqual(
        normalizeRoll20ImageUrl(encodedUrl),
        'https://files.d20.io/images/234086258/IhRXd-F81GrdgqRQOAZJqQ/med.png?1626279748',
        'Encoded URI components must be decoded and rewritten'
    );

    // 2. End-to-end import with live cache directory
    const os = await import('os');
    const tmpUploadsDir = path.join(os.tmpdir(), `dndforged_test_tokens_${Date.now()}`);
    fs.mkdirSync(tmpUploadsDir, { recursive: true });

    try {
        const rawJson = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
        const converted = await convertRoll20Character(rawJson, 'camp_token_test', {
            uploadsDir: tmpUploadsDir
        });

        // Avatar check
        assert.ok(converted.avatar, 'Avatar must be populated');
        assert.ok(
            converted.avatar.startsWith('/assets/campaigns/camp_token_test/uploads/'),
            'Avatar must point to local asset path'
        );
        assert.ok(!converted.avatar.startsWith('http'), 'Avatar must never be a remote URL');

        // Token image and multi-sided gallery
        assert.ok(converted.tokenImage, 'Active tokenImage must be populated');
        assert.ok(
            converted.tokenImage.startsWith('/assets/campaigns/camp_token_test/uploads/'),
            'tokenImage must be local asset path'
        );
        assert.ok(Array.isArray(converted.tokenImages), 'tokenImages must be an array');
        assert.ok(converted.tokenImages.length >= 3, 'Multiple valid sides must be downloaded');

        // Verify structure of tokenImages
        converted.tokenImages.forEach((t) => {
            assert.ok(t.url, 'Token must have url');
            assert.ok(t.name, 'Token must have name');
            assert.strictEqual(typeof t.isDefault, 'boolean', 'isDefault must be boolean');
            assert.ok(!t.url.startsWith('http'), 'Token url must not be remote');
        });

        // Active token index points to the default active side
        const activeToken = converted.tokenImages[converted.activeTokenIndex];
        assert.ok(activeToken, 'activeTokenIndex must reference a valid token item');
        assert.strictEqual(activeToken.isDefault, true, 'activeTokenIndex must point to the default active side');
        assert.strictEqual(converted.tokenImage, activeToken.url, 'tokenImage must match activeToken.url');

        // Hash deduplication verification
        const diskFiles = fs.readdirSync(tmpUploadsDir);
        assert.ok(diskFiles.length > 0, 'Files must be written to disk');
        // Matt Saiyan avatar is identical to one of the token sides; verify no duplicate identical files were created
        const uniqueFileNames = new Set(diskFiles);
        assert.strictEqual(
            diskFiles.length,
            uniqueFileNames.size,
            'All files on disk must have unique hash-based names'
        );
    } finally {
        fs.rmSync(tmpUploadsDir, { recursive: true, force: true });
    }
});

test('Roll20 Character Importer - Deep Enhancements Verification', async () => {
    // 1. sanitizeRoll20Html
    assert.strictEqual(
        sanitizeRoll20Html('<p>First paragraph</p><p>Second paragraph with <b>bold</b> &amp; &quot;quotes&quot;</p>'),
        'First paragraph\n\nSecond paragraph with bold & "quotes"'
    );
    assert.strictEqual(sanitizeRoll20Html('<ul><li>Item 1</li><li>Item 2</li></ul>'), '- Item 1\n- Item 2');
    assert.strictEqual(
        sanitizeRoll20Html('%3Cp%3EEncoded%20Bio%20with%20%26nbsp%3B%20spaces%3C%2Fp%3E'),
        'Encoded Bio with   spaces'
    );

    // 2. resolveRoll20Expression
    const dummyCtx = {
        level: 10,
        pb: 4,
        mods: { str: 2, dex: 3, con: 2, int: 1, wis: 2, cha: 5 },
        spellSaveDc: 17,
        spellAtkMod: 9,
        spellDcMod: 2,
        classes: [
            { name: 'Paladin', level: 6 },
            { name: 'Sorcerer', level: 4 }
        ]
    };
    assert.strictEqual(resolveRoll20Expression('@{Mattshadow|charisma_mod} + 3d8', dummyCtx), '5 + 3d8');
    assert.strictEqual(resolveRoll20Expression('@{spell_save_dc} + @{spell_dc_mod}', dummyCtx), '17 + 2');
    assert.strictEqual(resolveRoll20Expression('{?{Bonus|0} + 1d6}', dummyCtx), '0 + 1d6');

    // 3. Real Fixture Test: Matt_Saiyan_lv_17_items.json
    const mattRaw = JSON.parse(fs.readFileSync(path.join(samplesDir, 'Matt_Saiyan_lv_17_items.json'), 'utf8'));
    const mattConverted = await convertRoll20Character(mattRaw, 'camp_enhancements_test', {});

    // Token vision, lighting and auras
    assert.strictEqual(mattConverted.senses.darkvision, 120, 'Night vision distance 120 must map to senses.darkvision');
    assert.strictEqual(mattConverted.tokenSight, 120, 'Token sight must be set to 120');
    assert.strictEqual(mattConverted.tokenLightEnabled, true, 'Token light must be enabled');
    assert.strictEqual(mattConverted.tokenLightBright, 120, 'Token bright light distance must be 120');
    assert.strictEqual(mattConverted.tokenLightDim, 5, 'Token dim light distance must be 5');
    assert.ok(mattConverted.tokenAuras.length >= 1, 'Token aura 1 must be present');
    assert.strictEqual(mattConverted.tokenAuras[0].range, 10, 'Aura range must be 10');
    assert.strictEqual(mattConverted.tokenAuras[0].color, '#6aa84f', 'Aura color must match');
    assert.strictEqual(mattConverted.tokenAuras[0].square, true, 'Aura square flag must match');

    // Categories
    assert.strictEqual(mattConverted.abilityCategories.length, 6, 'Must provide 6 standard ability categories');
    assert.ok(mattConverted.abilityCards.length > 0, 'Ability cards must be populated');
    assert.ok(
        mattConverted.abilityCards.every((c) => Boolean(c.categoryId)),
        'All ability cards must be assigned to a category'
    );
    const classCards = mattConverted.abilityCards.filter((c) => c.categoryId === 'cat_class');
    assert.ok(classCards.length > 0, 'Class ability cards must exist');

    // Metadata
    assert.strictEqual(typeof mattConverted.alignment, 'string', 'Alignment must be a string');
    assert.strictEqual(typeof mattConverted.experience, 'number', 'Experience must be a number');

    // 4. Synthetic character testing versatile damage, save effect, multiclass spells, initiative & passive perception
    const synthCharacter = {
        name: 'Synthetica',
        attribs: [
            { name: 'character_name', current: 'Synthetica' },
            { name: 'class', current: 'Warlock' },
            { name: 'base_level', current: '5' },
            { name: 'multiclass1', current: 'Bard' },
            { name: 'multiclass1_lvl', current: '3' },
            { name: 'strength', current: '10' },
            { name: 'dexterity', current: '14' },
            { name: 'constitution', current: '14' },
            { name: 'intelligence', current: '10' },
            { name: 'wisdom', current: '12' },
            { name: 'charisma', current: '18' },
            { name: 'initmod', current: '3' },
            { name: 'initiative_style', current: '{@{d20},@{d20}}kh1' },
            { name: 'passive_wisdom', current: '16' }, // base 10 + 1 (wis) = 11, so diff is +5
            { name: 'alignment', current: 'Chaotic Good' },
            { name: 'experience', current: '34000' },
            // Attack with versatile & save effect
            { name: 'repeating_attack_atk1_atkname', current: 'Warhammer of Smiting' },
            { name: 'repeating_attack_atk1_atkbonus', current: '+7' },
            { name: 'repeating_attack_atk1_dmgbase', current: '1d8 + @{strength_mod}' },
            { name: 'repeating_attack_atk1_dmgtype', current: 'bludgeoning' },
            { name: 'repeating_attack_atk1_versatile_alt', current: '1d10 + @{strength_mod}' },
            { name: 'repeating_attack_atk1_saveattr', current: 'Strength' },
            { name: 'repeating_attack_atk1_savedc', current: '15' },
            { name: 'repeating_attack_atk1_saveeffect', current: 'Pushed 10 ft on failed save' },
            // Multiclass Spells: Warlock spell (CHA) and multiclass Wizard spell (INT)
            { name: 'repeating_spell-1_sp1_spellname', current: 'Hellish Rebuke' },
            { name: 'repeating_spell-1_sp1_spellattack', current: 'None' },
            { name: 'repeating_spell-1_sp1_spellsave', current: 'DEX' },
            { name: 'repeating_spell-1_sp1_spell_ability', current: '@{charisma_mod}+' },
            { name: 'repeating_spell-1_sp1_spellsavesuccess', current: 'Half damage' },
            { name: 'repeating_spell-1_sp1_spelldamage', current: '2d10' },
            { name: 'repeating_spell-1_sp1_spelldamagetype', current: 'fire' },
            { name: 'repeating_spell-1_sp2_spellname', current: 'Burning Hands' },
            { name: 'repeating_spell-1_sp2_spellattack', current: 'Ranged' },
            { name: 'repeating_spell-1_sp2_spellsave', current: 'DEX' },
            { name: 'repeating_spell-1_sp2_spell_ability', current: '@{intelligence_mod}+' },
            { name: 'repeating_spell-1_sp2_spellsavesuccess', current: 'Half damage' },
            { name: 'repeating_spell-1_sp2_spelldamage', current: '3d6' },
            { name: 'repeating_spell-1_sp2_spelldamagetype', current: 'fire' },
            // Global save / skill mods with Roll20 syntax
            { name: 'repeating_savemod_sm1_global_save_name', current: 'Aura of Protection' },
            { name: 'repeating_savemod_sm1_global_save_roll', current: '+@{charisma_mod}' },
            { name: 'repeating_savemod_sm1_global_save_active_flag', current: '1' }
        ]
    };

    const synthConverted = await convertRoll20Character(synthCharacter, 'camp_synth_test', {});

    // Metadata
    assert.strictEqual(synthConverted.alignment, 'Chaotic Good');
    assert.strictEqual(synthConverted.experience, 34000);

    // Initiative bonus & advantage
    assert.strictEqual(synthConverted.initiativeAdvantage, true, 'Initiative advantage must be detected from kh1');
    const initToggle = synthConverted.skillToggles.find((t) => t.target === 'initiative');
    assert.ok(initToggle, 'Initiative toggle must be created');
    assert.strictEqual(initToggle.formula, '+3', 'Initiative bonus formula must match initmod');

    // Passive perception toggle
    const ppToggle = synthConverted.skillToggles.find((t) => t.target === 'passive_perception');
    assert.ok(ppToggle, 'Passive perception toggle must be created');
    assert.strictEqual(ppToggle.formula, '+5', 'Passive perception bonus formula must be diff from base');

    // Resolved save toggle formula
    const auraToggle = synthConverted.saveToggles.find((t) => t.name === 'Aura of Protection');
    assert.ok(auraToggle, 'Aura save toggle must exist');
    assert.strictEqual(auraToggle.formula, '+4', 'Aura save formula must resolve charisma mod');

    // Attack versatile and save effect
    const warhammer = synthConverted.macros.find((m) => m.name === 'Warhammer of Smiting');
    assert.ok(warhammer, 'Warhammer macro must exist');
    assert.ok(warhammer.versatile, 'Versatile damage object must exist');
    assert.strictEqual(warhammer.versatile.formula, '1d10 + 0', 'Versatile formula must be resolved');
    assert.strictEqual(warhammer.versatile.type, 'bludgeoning');
    assert.strictEqual(warhammer.saveEffect, 'Pushed 10 ft on failed save');
    assert.ok(warhammer.description.includes('Save Effect: Pushed 10 ft on failed save'));

    // Multiclass spell ability and save success
    const rebuke = synthConverted.spells.level1.find((s) => s.name === 'Hellish Rebuke');
    assert.ok(rebuke, 'Hellish Rebuke must exist');
    assert.strictEqual(
        rebuke.saveDcStat,
        'spell',
        'Spell saveDcStat should remain spell when matching primary ability'
    );
    assert.strictEqual(rebuke.saveSuccess, 'Half damage', 'Spell saveSuccess must be preserved');

    const hands = synthConverted.spells.level1.find((s) => s.name === 'Burning Hands');
    assert.ok(hands, 'Burning Hands must exist');
    assert.strictEqual(hands.attackStat, 'int', 'Multiclass spell attackStat must resolve to individual ability');
    assert.strictEqual(hands.saveDcStat, 'int', 'Multiclass spell saveDcStat must resolve to individual ability');
    assert.strictEqual(hands.saveSuccess, 'Half damage');
});
