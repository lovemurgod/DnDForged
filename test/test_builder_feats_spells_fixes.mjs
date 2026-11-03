import assert from 'assert';
import { toSpellTitleCase } from '../vtt/js/creature-sheet/creature-parser.js';
import { ensureNpcSpells, buildSpellcastingHtml } from '../vtt/js/creature-sheet/creature-spells.js';
import { getFeatAndAsiBonuses, extractGrantedSpells } from '../vtt/js/player-sheet/builder/builder-state.js';

console.log('--- RUNNING CHARACTER BUILDER & CREATURE SPELLS VERIFICATION TESTS ---');

// =========================================================================
// TEST 1: Creature Spells Defense & Formatting
// =========================================================================
console.log('\n[Test 1] Creature Spells Defense & Formatting...');
{
    // Test toSpellTitleCase with null, object, number, malformed strings
    assert.strictEqual(toSpellTitleCase(null), '');
    assert.strictEqual(toSpellTitleCase(undefined), '');
    assert.strictEqual(toSpellTitleCase(123), '');
    assert.strictEqual(toSpellTitleCase({ name: 'fireball [XPHB]' }), 'Fireball [XPHB]');
    assert.strictEqual(toSpellTitleCase('{@spell misty step}'), 'Misty Step');
    assert.strictEqual(toSpellTitleCase('hold person'), 'Hold Person');

    // Test ensureNpcSpells with edge-case creature objects
    const monsterWithBadSpell = {
        name: 'Archmage Aberration',
        spellcasting: [
            {
                name: 'Spellcasting',
                headerEntries: ['The mage is an 18th-level spellcaster.'],
                spells: {
                    1: {
                        slots: 4,
                        spells: [
                            { name: 'magic missile' },
                            { spell: 'shield' },
                            { invalid: 123 }, // No name or spell property
                            null,
                            'detect magic'
                        ]
                    }
                },
                will: ['light', { name: 'mage hand' }],
                daily: {
                    '1e': ['globe of invulnerability'],
                    2: [{ spell: 'invisibility' }]
                }
            }
        ]
    };

    // Should not throw!
    ensureNpcSpells(monsterWithBadSpell);
    assert.ok(monsterWithBadSpell.spells && typeof monsterWithBadSpell.spells === 'object');
    assert.ok(Array.isArray(monsterWithBadSpell.spells.level1));
    assert.ok(monsterWithBadSpell.spells.level1.length > 0);

    // Verify buildSpellcastingHtml does not throw and generates proper html
    const html = buildSpellcastingHtml(monsterWithBadSpell, null);
    assert.ok(typeof html === 'string');
    assert.ok(html.includes('Magic Missile'));
    assert.ok(html.includes('Shield'));
    assert.ok(html.includes('Detect Magic'));
    assert.ok(html.includes('Mage Hand'));
    assert.ok(html.includes('Globe of Invulnerability'));
    assert.ok(html.includes('Invisibility'));
    console.log('  ? Creature sheet defensive formatting passed without throwing');
}

// =========================================================================
// TEST 2: Background Source Parsing & Origin Feat Detection
// =========================================================================
console.log('\n[Test 2] Background Source Parsing & Origin Feat Detection...');
{
    const val2024 = 'Acolyte::XPHB';
    const val2014 = 'Acolyte::PHB';

    const [name2024, src2024] = val2024.split('::');
    assert.strictEqual(name2024, 'Acolyte');
    assert.strictEqual(src2024, 'XPHB');

    const [name2014, src2014] = val2014.split('::');
    assert.strictEqual(name2014, 'Acolyte');
    assert.strictEqual(src2014, 'PHB');

    // Mock background catalog with both 2014 and 2024
    const catalog = [
        { name: 'Acolyte', source: 'PHB', description: 'Shelter of the Faithful' },
        {
            name: 'Acolyte',
            source: 'XPHB',
            features: [
                {
                    name: 'Feat',
                    description: 'You gain the **Magic Initiate (Cleric)** feat.'
                }
            ],
            description: '**Ability Scores:** Wisdom, Intelligence, Charisma\n**Feat:** Magic Initiate (Cleric)'
        }
    ];

    const matched2024 = catalog.find((b) => b.name === name2024 && b.source.toUpperCase() === src2024.toUpperCase());
    assert.ok(matched2024);
    assert.strictEqual(matched2024.source, 'XPHB');

    // Feat regex extraction test matching builder-modal logic
    let bgFeatName = '';
    const mFeat = matched2024.description.match(/\*\*Feat:\*\*\s*([^\n\r]+)/i);
    if (mFeat) bgFeatName = mFeat[1].trim();

    assert.strictEqual(bgFeatName, 'Magic Initiate (Cleric)');
    console.log('  ? Background source resolution and feat extraction verified: ' + bgFeatName);
}

// =========================================================================
// TEST 3: Half-Feat & ASI Bonuses Calculation
// =========================================================================
console.log('\n[Test 3] Half-Feat & ASI Bonuses Calculation...');
{
    const asiTiers = [
        {
            tierType: 'origin_feat_background',
            feat: 'Fey Touched',
            halfFeatStat: 'wis',
            featSubChoices: {
                halfFeatStat: 'wis',
                spellChoices: { level1: 'Bless' }
            }
        },
        {
            tierType: 'class_asi',
            feat: 'Shadow Touched',
            halfFeatStat: 'int',
            featSubChoices: {
                halfFeatStat: 'int',
                spellChoices: { level1: 'Disguise Self' }
            }
        },
        {
            tierType: 'class_asi',
            feat: null,
            mode: 'split',
            splitStat1: 'con',
            splitStat2: 'dex'
        }
    ];

    const bonuses = getFeatAndAsiBonuses(asiTiers);
    assert.strictEqual(bonuses.wis, 1, 'Wisdom should get +1 from Fey Touched half-feat');
    assert.strictEqual(bonuses.int, 1, 'Intelligence should get +1 from Shadow Touched half-feat');
    assert.strictEqual(bonuses.con, 1, 'Constitution should get +1 from split ASI');
    assert.strictEqual(bonuses.dex, 1, 'Dexterity should get +1 from split ASI');
    assert.strictEqual(bonuses.str, 0);
    assert.strictEqual(bonuses.cha, 0);
    console.log('  ? Half-feat stat contributions and ASI calculations verified');
}

// =========================================================================
// TEST 4: Feat Spell Choices & Injections
// =========================================================================
console.log('\n[Test 4] Feat Spell Choices & Injections...');
{
    const mockSpellsCatalog = [
        { name: 'Misty Step', level: 2, school: 'Conjuration', castingTime: '1 bonus action', source: 'PHB' },
        { name: 'Bless', level: 1, school: 'Enchantment', castingTime: '1 action', source: 'PHB' },
        { name: 'Sacred Flame', level: 0, school: 'Evocation', castingTime: '1 action', source: 'PHB' },
        { name: 'Guidance', level: 0, school: 'Divination', castingTime: '1 action', source: 'PHB' },
        { name: 'Healing Word', level: 1, school: 'Evocation', castingTime: '1 bonus action', source: 'PHB' }
    ];

    // Simulate harvesting sub-choices for Magic Initiate (Cleric)
    const magicInitiateT = {
        tierType: 'origin_feat_background',
        feat: 'Magic Initiate (Cleric)',
        featSubChoices: {
            cantrip1: 'Sacred Flame',
            cantrip2: 'Guidance',
            level1: 'Healing Word'
        }
    };

    const spellsToGrant = [];
    if (magicInitiateT.featSubChoices?.cantrip1) {
        spellsToGrant.push({ name: magicInitiateT.featSubChoices.cantrip1, level: 0 });
    }
    if (magicInitiateT.featSubChoices?.cantrip2) {
        spellsToGrant.push({ name: magicInitiateT.featSubChoices.cantrip2, level: 0 });
    }
    if (magicInitiateT.featSubChoices?.level1) {
        spellsToGrant.push({ name: magicInitiateT.featSubChoices.level1, level: 1 });
    }

    assert.strictEqual(spellsToGrant.length, 3);
    assert.deepStrictEqual(
        spellsToGrant.map((s) => s.name),
        ['Sacred Flame', 'Guidance', 'Healing Word']
    );

    // Check mapping into character spells
    const char = { spells: { cantrip: [], level1: [], level2: [] } };
    spellsToGrant.forEach((spReq) => {
        const spObj = mockSpellsCatalog.find((s) => s.name.toLowerCase() === spReq.name.toLowerCase());
        const sLvl = spObj ? spObj.level : spReq.level;
        const sKey = sLvl === 0 ? 'cantrip' : 'level' + sLvl;
        char.spells[sKey].push({
            id: 'sp_test_' + spObj.name,
            name: spObj.name,
            source: spObj.source,
            level: sLvl,
            school: spObj.school,
            time: spObj.castingTime,
            prepared: true
        });
    });

    assert.strictEqual(char.spells.cantrip.length, 2);
    assert.strictEqual(char.spells.level1.length, 1);
    assert.strictEqual(char.spells.level1[0].name, 'Healing Word');
    assert.strictEqual(char.spells.level1[0].time, '1 bonus action');
    assert.strictEqual(char.spells.level1[0].source, 'PHB');
    console.log('  ? Feat spell choices properly saved and mapped to character spell list');
}

// =========================================================================
// TEST 5: Extract Granted Spells & Source Metadata
// =========================================================================
console.log('\n[Test 5] Extract Granted Spells & Source Metadata...');
{
    const highElfRace = {
        name: 'High Elf',
        traits: [
            {
                name: 'Cantrip',
                description: 'You know one cantrip of your choice from the wizard spell list. {@spell Fire Bolt}'
            }
        ]
    };

    const mockSpells = [
        { name: 'Fire Bolt', level: 0, school: 'Evocation', castingTime: '1 action', source: 'PHB' },
        { name: 'Misty Step', level: 2, school: 'Conjuration', castingTime: '1 bonus action', source: 'PHB' }
    ];

    const granted = extractGrantedSpells(highElfRace, null, null, 1, mockSpells);
    assert.strictEqual(granted.length, 1);
    assert.strictEqual(granted[0].name, 'Fire Bolt');
    assert.strictEqual(granted[0].source, 'PHB');
    assert.strictEqual(granted[0].time, '1 action');
    assert.strictEqual(granted[0].sourceLabel, 'Species');
    console.log('  ? extractGrantedSpells correctly captures spell and metadata');
}

console.log('\n? ALL 5 CHARACTER BUILDER & CREATURE SPELLS TESTS PASSED SUCCESSFULLY!\n');
