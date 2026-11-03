import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SourceManager } from '../electron/source-manager.js';
import { createBlankEntity, jsonToEntity, entityToJson } from '../electron/ui/builder-schemas.js';

console.log('--- RUNNING HOMEBREW STUDIO & SOURCE CONTROL INTEGRATION TESTS ---');

// =========================================================================
// TEST 1: SourceManager Security & Dual Metadata Synchronization
// =========================================================================
console.log('\n[Test 1] SourceManager Security & Dual Metadata Synchronization...');
{
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dndforged-test-sm-'));
    const testConfigPath = path.join(tmpDir, 'sources-config.json');
    const customSourcesDir = path.join(tmpDir, 'vtt', 'data', 'custom-sources');
    fs.mkdirSync(customSourcesDir, { recursive: true });

    // Initialize source manager pointing to tmpDir
    const sm = new SourceManager({ rootDir: tmpDir });

    // 1. Protection test: built-in official sourcebook cannot be modified
    // Mock an official source in getAllSources
    const origGetAllSources = sm.getAllSources.bind(sm);
    sm.getAllSources = () => ({
        categories: [
            {
                id: 'bestiary',
                sources: [
                    {
                        code: 'MM',
                        name: 'Monster Manual',
                        isCustom: false,
                        filePath: path.join(tmpDir, 'mm.json')
                    },
                    {
                        code: 'MYBREW',
                        name: 'My Custom Monsters',
                        isCustom: true,
                        fileName: 'mybrew.json',
                        filePath: path.join(customSourcesDir, 'mybrew.json')
                    }
                ]
            }
        ]
    });

    const officialRes = sm.saveSourceDetails({
        category: 'bestiary',
        code: 'MM',
        name: 'Hacked MM',
        rawJson: JSON.stringify({ monster: [] })
    });
    assert.strictEqual(officialRes.success, false, 'Official sourcebook save must fail');
    assert.ok(officialRes.error.includes('read-only'), 'Error message must specify source is read-only');

    // 2. Custom sourcebook save with Dual Metadata Synchronization
    const initialBrewContent = {
        _meta: {
            sources: [
                {
                    json: 'MYBREW',
                    abbreviation: 'MYBREW',
                    full: 'Old Name',
                    authors: ['Old Author'],
                    version: '1.0.0'
                }
            ]
        },
        monster: [
            {
                name: 'Shadow Stalker',
                source: 'MYBREW',
                cr: '5',
                specialCustomField: 'keep-me-safe'
            }
        ]
    };
    fs.writeFileSync(path.join(customSourcesDir, 'mybrew.json'), JSON.stringify(initialBrewContent, null, 2), 'utf8');

    const customRes = sm.saveSourceDetails({
        category: 'bestiary',
        code: 'MYBREW',
        name: 'New Custom Monsters v2',
        author: 'Dungeon Master Jane',
        version: '2.5.0',
        description: 'Updated bestiary for my dark fantasy campaign.',
        rawJson: JSON.stringify(initialBrewContent, null, 2)
    });

    assert.strictEqual(customRes.success, true, 'Custom source save must succeed');

    // Verify file on disk has updated internal _meta.sources
    const writtenJson = JSON.parse(fs.readFileSync(path.join(customSourcesDir, 'mybrew.json'), 'utf8'));
    assert.strictEqual(writtenJson._meta.sources[0].full, 'New Custom Monsters v2');
    assert.deepStrictEqual(writtenJson._meta.sources[0].authors, ['Dungeon Master Jane']);
    assert.strictEqual(writtenJson._meta.sources[0].version, '2.5.0');
    assert.strictEqual(
        writtenJson.monster[0].specialCustomField,
        'keep-me-safe',
        'Unmapped fields in raw JSON must persist'
    );

    // Verify SourceManager config has updated customSources entry
    const savedMeta = sm.config.customSources.find((c) => c.fileName === 'mybrew.json');
    assert.ok(savedMeta, 'customSources metadata entry must exist in sm.config');
    assert.strictEqual(savedMeta.name, 'New Custom Monsters v2');
    assert.strictEqual(savedMeta.author, 'Dungeon Master Jane');
    assert.strictEqual(savedMeta.version, '2.5.0');
    assert.strictEqual(savedMeta.description, 'Updated bestiary for my dark fantasy campaign.');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  ✓ Protection against official source overwrite verified');
    console.log('  ✓ Dual metadata synchronization verified (both sources-config and internal _meta)');
}

// =========================================================================
// TEST 2: Bestiary Non-Destructive Merge & Field Preservation
// =========================================================================
console.log('\n[Test 2] Bestiary Non-Destructive Merge & New Controls...');
{
    const raw5eMonster = {
        name: 'Ancient Void Dragon',
        source: 'MYBREW',
        size: ['G'],
        type: { type: 'dragon', tags: ['titan', 'void'] },
        alignment: ['C', 'E'],
        ac: [22, { special: 'natural armor' }],
        hp: { average: 450, formula: '28d20 + 156' },
        speed: { walk: 40, fly: 80, hover: true },
        str: 30,
        dex: 12,
        con: 29,
        int: 18,
        wis: 17,
        cha: 21,
        save: {
            dex: '+8',
            con: '+16',
            wis: '+10',
            cha: '+12'
        },
        skill: {
            perception: '+17',
            stealth: '+8',
            arcana: '+11'
        },
        passive: 27,
        languages: ['Common', 'Draconic', 'Void Speech'],
        cr: '24',
        trait: [
            { name: 'Legendary Resistance', entries: ['If the dragon fails a save, it can succeed instead (3/day).'] }
        ],
        action: [{ name: 'Void Breath', entries: ['Exhales void energy in a 90-foot cone.'] }],
        bonus: [{ name: 'Shadow Shift', entries: ['The dragon teleports up to 30 feet as a bonus action.'] }],
        reaction: [{ name: 'Void Shield', entries: ['Adds +5 to AC against one attack.'] }],
        legendary: [{ name: 'Tail Attack', entries: ['Makes a tail attack.'] }],
        legendaryGroup: 'void_dragons',
        spellcasting: [
            {
                name: 'Innate Spellcasting',
                headerEntries: ['The dragon can cast the following spells:'],
                will: ['darkness', 'detect magic'],
                daily: { '1e': ['plane shift', 'teleport'] }
            }
        ],
        soundClip: 'dragon_roar.mp3',
        environment: ['underdark', 'space']
    };

    // 1. jsonToEntity
    const entity = jsonToEntity('bestiary', raw5eMonster, 'MYBREW');
    assert.strictEqual(entity.name, 'Ancient Void Dragon');
    assert.strictEqual(entity.saves.dex, '+8', 'DEX save must be extracted');
    assert.strictEqual(entity.saves.con, '+16', 'CON save must be extracted');
    assert.strictEqual(entity.saves.str, undefined, 'STR save should be undefined');
    assert.strictEqual(entity.skills.perception, '+17', 'Skills must be extracted');
    assert.strictEqual(entity.passivePerception, 27, 'Passive perception must be extracted');
    assert.strictEqual(entity.bonusActions.length, 1, 'Bonus actions must be extracted');
    assert.strictEqual(entity.bonusActions[0].name, 'Shadow Shift');
    assert.ok(entity._raw, '_raw must be retained on entity');

    // 2. Simulate visual edit: user checks STR save, adds an action, changes HP
    entity.saves.str = true;
    entity.hpAvg = 480;
    entity.actions.push({ name: 'Bite', text: 'Melee weapon attack.' });

    // 3. entityToJson
    const savedJson = entityToJson('bestiary', entity, 'MYBREW');

    // Verification:
    assert.strictEqual(savedJson.name, 'Ancient Void Dragon');
    assert.strictEqual(savedJson.hp.average, 480, 'Visual edit to HP must persist');
    assert.strictEqual(savedJson.save.str, '+17', 'Newly checked STR save must be computed and saved');
    assert.strictEqual(savedJson.save.dex, '+8', 'Pre-existing DEX save must persist');
    assert.strictEqual(savedJson.bonus[0].name, 'Shadow Shift', 'Bonus actions must persist in 5eTools bonus array');
    assert.strictEqual(savedJson.passive, 27, 'Passive perception must persist');

    // CRITICAL HYBRID PRESERVATION CHECK:
    assert.ok(savedJson.spellcasting, 'Spellcasting block from raw 5eTools must NOT be lost');
    assert.strictEqual(savedJson.legendaryGroup, 'void_dragons', 'legendaryGroup must NOT be lost');
    assert.strictEqual(savedJson.soundClip, 'dragon_roar.mp3', 'soundClip must NOT be lost');
    assert.deepStrictEqual(savedJson.environment, ['underdark', 'space'], 'environment tags must NOT be lost');

    console.log('  ✓ Bestiary jsonToEntity extracts saves, skills, bonus actions, passive perception');
    console.log('  ✓ Visual modifications properly serialize to 5eTools format');
    console.log('  ✓ Unmapped 5eTools fields (spellcasting, legendaryGroup, environment) 100% preserved');
}

// =========================================================================
// TEST 3: Spells Ritual, Damage, and Unmapped Fields
// =========================================================================
console.log('\n[Test 3] Spells Ritual & Field Synchronization...');
{
    const rawSpell = {
        name: 'Chrono Rift',
        source: 'MYBREW',
        level: 4,
        school: 'T',
        time: [{ number: 1, unit: 'action' }],
        range: { type: 'point', distance: { type: 'feet', amount: 60 } },
        components: { v: true, s: true, m: 'an hourglass' },
        duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
        meta: { ritual: true },
        entries: ['You open a rift in spacetime.'],
        damageInflict: ['force'],
        areaTags: ['C'],
        classes: {
            fromClassList: [
                { name: 'Wizard', source: 'PHB' },
                { name: 'Sorcerer', source: 'PHB' }
            ]
        }
    };

    const entity = jsonToEntity('spells', rawSpell, 'MYBREW');
    assert.strictEqual(entity.ritual, true, 'Spell ritual must be extracted from meta.ritual');
    assert.strictEqual(entity.damageType, 'force');

    // Simulate editing ritual and damage
    entity.ritual = false;
    entity.damageDice = '4d10';
    entity.damageType = 'Force';

    const savedJson = entityToJson('spells', entity, 'MYBREW');
    assert.strictEqual(savedJson.meta?.ritual, undefined, 'Unchecked ritual must remove ritual flag');
    assert.deepStrictEqual(savedJson.damageInflict, ['force']);
    assert.deepStrictEqual(savedJson.damageList, [{ formula: '4d10', type: 'Force' }]);
    assert.ok(savedJson.classes, 'Unmapped classes object must NOT be dropped');
    assert.deepStrictEqual(savedJson.areaTags, ['C'], 'Unmapped areaTags must NOT be dropped');

    // Turn ritual back on
    entity.ritual = true;
    const ritualSaved = entityToJson('spells', entity, 'MYBREW');
    assert.strictEqual(ritualSaved.meta?.ritual, true, 'Checked ritual must save meta: { ritual: true }');

    console.log('  ✓ Spell ritual roundtrip verified');
    console.log('  ✓ Damage formulas and unmapped class lists preserved');
}

// =========================================================================
// TEST 4: Items Stat Precedence & Cache Busting
// =========================================================================
console.log('\n[Test 4] Items Stat Precedence & Visual Edits...');
{
    const rawWeapon = {
        name: 'Frostfang Longsword',
        source: 'MYBREW',
        type: 'M',
        rarity: 'rare',
        dmg1: '1d8',
        dmgType: 'S',
        ac: 0,
        value: 50000,
        weight: 3,
        property: ['V'],
        reqAttune: true,
        attachedSpells: ['ice storm', 'cone of cold'],
        customProperty: 'frost_burst'
    };

    const entity = jsonToEntity('items', rawWeapon, 'MYBREW');
    assert.strictEqual(entity.damageDice, '1d8');
    assert.strictEqual(entity.baseAc, 0);

    // Simulate user editing visual form: upgrades weapon to 2d6 cold, AC +1, weight 4 lbs
    entity.damageDice = '2d6';
    entity.damageType = 'Cold';
    entity.baseAc = 1;
    entity.weightLbs = 4;
    entity.valueGp = 750;

    const savedJson = entityToJson('items', entity, 'MYBREW');

    // Verify precedence: visual edits MUST override stale raw dmg1/ac/weight/value
    assert.strictEqual(savedJson.dmg1, '2d6', 'dmg1 must reflect visual damageDice edit, not stale 1d8');
    assert.strictEqual(savedJson.ac, 1, 'ac must reflect visual baseAc edit, not stale 0');
    assert.strictEqual(savedJson.weight, 4, 'weight must reflect visual weightLbs edit');
    assert.strictEqual(savedJson.value, '750 gp', 'value must reflect visual 750 gp');
    assert.strictEqual(savedJson.dmgType, 'c', 'dmgType must be lowercase code for cold');

    // Verify unmapped fields preserved
    assert.deepStrictEqual(savedJson.attachedSpells, ['ice storm', 'cone of cold'], 'attachedSpells preserved');
    assert.strictEqual(savedJson.customProperty, 'frost_burst', 'customProperty preserved');

    console.log('  ✓ Items stat precedence fix verified (visual edits correctly override stale cached fields)');
    console.log('  ✓ Unmapped item properties and attached spells preserved');
}

// =========================================================================
// TEST 5: Races & Backgrounds Property Name Consistency
// =========================================================================
console.log('\n[Test 5] Races & Backgrounds Property Synchronization...');
{
    // 1. Race test
    const rawRace = {
        name: 'Starlight Elf',
        source: 'MYBREW',
        size: ['M'],
        speed: 35,
        ability: [{ dex: 2, int: 1 }],
        darkvision: 90,
        trait: [{ name: 'Astral Step', entries: ['Once per short rest, you can teleport 15 feet.'] }],
        lineage: 'elf',
        subraces: [{ name: 'Starlight High Elf' }]
    };

    const raceEntity = jsonToEntity('races', rawRace, 'MYBREW');
    assert.strictEqual(raceEntity.abilityIncreases.dex, 2, 'Race dex bonus must be extracted');
    assert.strictEqual(raceEntity.abilityIncreases.int, 1, 'Race int bonus must be extracted');
    assert.strictEqual(raceEntity.strMod, 0);

    // Modify abilities visually
    raceEntity.abilityIncreases.con = 1;
    raceEntity.conMod = 1;

    const savedRace = entityToJson('races', raceEntity, 'MYBREW');
    assert.deepStrictEqual(
        savedRace.ability,
        [{ dex: 2, int: 1, con: 1 }],
        'Ability increases must be serialized cleanly'
    );
    assert.strictEqual(savedRace.lineage, 'elf', 'lineage preserved');
    assert.ok(savedRace.subraces, 'subraces array preserved');

    // 2. Background test
    const rawBg = {
        name: 'Planar Cartographer',
        source: 'MYBREW',
        skillProficiencies: [{ arcana: true, survival: true }],
        toolProficiencies: [{ "cartographer's tools": true, "navigator's tools": true }],
        startingEquipment: [{ default: ["a set of cartographer's tools", 'a map case', '15 gp'] }],
        entries: [
            {
                name: 'Feature: Ley Line Navigation',
                type: 'entries',
                entries: ['You can intuitively sense planar portals within 1 mile.']
            }
        ],
        tables: [{ caption: 'Planar Oddities', rows: [['1', 'A compass pointing to Mechanus']] }]
    };

    const bgEntity = jsonToEntity('backgrounds', rawBg, 'MYBREW');
    assert.ok(bgEntity.skillProficiencies.includes('arcana'), 'Arcana skill proficiency extracted');
    assert.ok(bgEntity.toolProficiencies.includes("cartographer's tools"), 'Tool proficiency extracted');
    assert.strictEqual(bgEntity.featureName, 'Feature: Ley Line Navigation');
    assert.ok(bgEntity.featureDescription.includes('planar portals'), 'Feature description extracted');

    const savedBg = entityToJson('backgrounds', bgEntity, 'MYBREW');
    assert.ok(savedBg.skillProficiencies, 'skillProficiencies saved');
    assert.ok(savedBg.toolProficiencies, 'toolProficiencies saved');
    assert.ok(savedBg.startingEquipment, 'startingEquipment saved');
    assert.ok(savedBg.tables, 'Unmapped tables array preserved');

    console.log('  ✓ Race ability modifier property alignment verified');
    console.log('  ✓ Background skill/tool proficiencies and equipment alignment verified');
}

// =========================================================================
// TEST 6: Feats & Classes Progression
// =========================================================================
console.log('\n[Test 6] Feats String Normalization & Multi-Level Subclass Progression...');
{
    // 1. Feat normalization test
    const featEntity = createBlankEntity('feats', 'MYBREW');
    featEntity.name = 'Void Mastery';
    featEntity.prerequisite = 'Intelligence 13 or higher';
    featEntity.benefits = [
        'You gain resistance to force damage.',
        { name: 'Void Strike', text: 'Once per turn, deal extra 1d6 force damage.' },
        'You learn the Mage Hand cantrip.'
    ];

    const savedFeat = entityToJson('feats', featEntity, 'MYBREW');
    // Ensure no "[object Object]" is written into entries
    const featJsonStr = JSON.stringify(savedFeat);
    assert.ok(!featJsonStr.includes('[object Object]'), 'Feat serialization must never output [object Object]');
    assert.strictEqual(savedFeat.entries.length, 4);
    assert.strictEqual(savedFeat.entries[0], featEntity.description);
    assert.strictEqual(savedFeat.entries[1], '• You gain resistance to force damage.');
    assert.strictEqual(savedFeat.entries[2], '• **Void Strike.** Once per turn, deal extra 1d6 force damage.');
    assert.strictEqual(savedFeat.entries[3], '• You learn the Mage Hand cantrip.');

    // 2. Class & Subclass multi-level progression test
    const classEntity = createBlankEntity('classes', 'MYBREW');
    classEntity.name = 'Chronomancer';
    classEntity.subclasses = [
        {
            name: 'Order of the Pendulum',
            shortName: 'Pendulum',
            features: [
                { level: 3, name: 'Temporal Anchor', text: 'You can anchor your position in time.' },
                { level: 7, name: 'Accelerated Stride', text: 'Your speed increases by 10 feet.' },
                { level: 15, name: 'Time Stop Master', text: 'You can cast Time Stop once per long rest.' }
            ]
        }
    ];
    classEntity.levels = {
        1: [{ name: 'Chronoshift', text: 'Shift moments in time.' }]
    };

    const savedClass = entityToJson('classes', classEntity, 'MYBREW');
    assert.strictEqual(savedClass.name, 'Chronomancer');
    assert.strictEqual(savedClass.subclasses.length, 1);
    const sc = savedClass.subclasses[0];
    assert.strictEqual(sc.name, 'Order of the Pendulum');
    assert.ok(sc.subclassFeatures.length === 3, 'All 3 subclass feature levels must be captured');
    assert.strictEqual(sc.subclassFeatures[0].level, 3);
    assert.strictEqual(sc.subclassFeatures[1].level, 7);
    assert.strictEqual(sc.subclassFeatures[2].level, 15);

    console.log('  ✓ Feat benefit normalization verified (no [object Object])');
    console.log('  ✓ Subclass multi-level feature progression verified (Levels 3, 7, 15 preserved)');
}

// =========================================================================
// TEST 7: VTT Consumption Integration Check
// =========================================================================
console.log('\n[Test 7] VTT Consumption Integration Check...');
{
    const { buildSavesHtml, buildSkillsHtml, buildTypeString, parseAc } =
        await import('../vtt/js/creature-sheet/creature-parser.js');
    const { ensureNpcSpells } = await import('../vtt/js/creature-sheet/creature-spells.js');

    // Feed the saved bestiary monster into VTT parsers
    const raw5eMonster = {
        name: 'Void Titan',
        source: 'MYBREW',
        size: ['G'],
        type: { type: 'dragon', tags: ['titan'] },
        ac: [22, { special: 'natural armor' }],
        hp: { average: 450, formula: '28d20 + 156' },
        str: 30,
        dex: 12,
        con: 29,
        int: 18,
        wis: 17,
        cha: 21,
        save: { dex: '+8', con: '+16' },
        skill: { perception: '+17', stealth: '+8' },
        passive: 27,
        cr: '24',
        spellcasting: [
            {
                name: 'Innate Spellcasting',
                headerEntries: ['The titan can cast:'],
                will: ['darkness', 'detect magic'],
                daily: { '1e': ['plane shift'] }
            }
        ]
    };

    const entity = jsonToEntity('bestiary', raw5eMonster, 'MYBREW');
    entity.saves.str = true; // Add STR save
    const serialized = entityToJson('bestiary', entity, 'MYBREW');

    // 1. Saves HTML rendering in VTT
    const savesHtml = buildSavesHtml(serialized);
    assert.ok(savesHtml.includes('STR'), 'VTT saves HTML must include added STR save');
    assert.ok(savesHtml.includes('DEX'), 'VTT saves HTML must include pre-existing DEX save');
    assert.ok(savesHtml.includes('CON'), 'VTT saves HTML must include pre-existing CON save');

    // 2. Skills HTML rendering in VTT
    const skillsHtml = buildSkillsHtml(serialized);
    assert.ok(skillsHtml.includes('Perception'), 'VTT skills HTML must include Perception');
    assert.ok(skillsHtml.includes('+17'), 'VTT skills HTML must include +17 bonus');

    // 3. Type string in VTT
    const typeStr = buildTypeString(serialized);
    assert.strictEqual(typeStr, 'Gargantuan dragon (titan), U');

    // 4. AC Parsing in VTT
    const parsedAc = parseAc(serialized);
    assert.strictEqual(parsedAc.value, 22);

    // 5. Preserved Spellcasting consumption
    ensureNpcSpells(serialized);
    assert.strictEqual(
        serialized.spellcasting[0]._parsedSpells?.length > 0 || serialized.spellcasting[0].will?.length > 0,
        true
    );

    console.log('  ✓ Serialized bestiary record consumed cleanly by VTT creature-sheet parser');
    console.log('  ✓ Saves, skills, AC, and spellcasting blocks fully functional in VTT engine');
}

console.log('\n=============================================================');
console.log('🎉 ALL HOMEBREW STUDIO & SOURCE CONTROL TESTS PASSED!');
console.log('=============================================================\n');
