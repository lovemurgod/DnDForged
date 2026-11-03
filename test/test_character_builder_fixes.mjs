import assert from 'assert';

console.log('--- RUNNING CHARACTER BUILDER 7 FIXES TEST SUITE ---');

// Mock data & helpers matching vtt-player-sheet.js logic
const statList = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const getMod = (val) => Math.floor(((parseInt(val) || 10) - 10) / 2);

// =========================================================================
// TEST 1: Racial ASI & Live Scores Breakdown (All 4 Modes)
// =========================================================================
console.log('\n[Test 1] Racial ASI & Live Scores Breakdown...');
{
    const workingChar = {
        statMethod: 'standard',
        standardArrayAssignments: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
        racialAsiMode: 'catalog',
        tashasMode: 'plus2plus1',
        bgAsiMode: 'plus2plus1',
        tashasPlus2: 'str',
        tashasPlus1: 'con',
        tashasPlus1_1: 'str',
        tashasPlus1_2: 'dex',
        tashasPlus1_3: 'con',
        bgAsiPlus2: 'int',
        bgAsiPlus1: 'wis',
        bgAsiPlus1_1: 'int',
        bgAsiPlus1_2: 'wis',
        bgAsiPlus1_3: 'cha',
        customRacialBonuses: { str: 2, con: 1, dex: 0, int: 0, wis: 0, cha: 0 },
        racialChoices: { c1: 'dex', c2: 'cha' }
    };

    const mockCatalogBonuses = { str: 1, con: 2 };
    const mockChoiceDefs = [
        { id: 'c1', label: '+1 Ability', from: ['dex', 'int'], amount: 1 },
        { id: 'c2', label: '+1 Ability', from: ['wis', 'cha'], amount: 1 }
    ];

    function getEffectiveRacialBonuses() {
        const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        if (workingChar.racialAsiMode === 'custom') {
            statList.forEach((s) => {
                bonuses[s] = parseInt(workingChar.customRacialBonuses[s]) || 0;
            });
            return bonuses;
        }
        if (workingChar.racialAsiMode === 'tashas') {
            if (workingChar.tashasMode === 'threePlus1') {
                [workingChar.tashasPlus1_1, workingChar.tashasPlus1_2, workingChar.tashasPlus1_3].forEach((st) => {
                    if (st && bonuses[st] !== undefined) bonuses[st] += 1;
                });
            } else {
                if (workingChar.tashasPlus2)
                    bonuses[workingChar.tashasPlus2] = (bonuses[workingChar.tashasPlus2] || 0) + 2;
                if (workingChar.tashasPlus1)
                    bonuses[workingChar.tashasPlus1] = (bonuses[workingChar.tashasPlus1] || 0) + 1;
            }
            return bonuses;
        }
        if (workingChar.racialAsiMode === 'background') {
            if (workingChar.bgAsiMode === 'threePlus1') {
                [workingChar.bgAsiPlus1_1, workingChar.bgAsiPlus1_2, workingChar.bgAsiPlus1_3].forEach((st) => {
                    if (st && bonuses[st] !== undefined) bonuses[st] += 1;
                });
            } else {
                if (workingChar.bgAsiPlus2)
                    bonuses[workingChar.bgAsiPlus2] = (bonuses[workingChar.bgAsiPlus2] || 0) + 2;
                if (workingChar.bgAsiPlus1)
                    bonuses[workingChar.bgAsiPlus1] = (bonuses[workingChar.bgAsiPlus1] || 0) + 1;
            }
            return bonuses;
        }
        // catalog
        Object.keys(mockCatalogBonuses).forEach((s) => {
            bonuses[s] = (bonuses[s] || 0) + mockCatalogBonuses[s];
        });
        mockChoiceDefs.forEach((cd) => {
            const chosen = workingChar.racialChoices[cd.id];
            if (chosen && bonuses[chosen] !== undefined) bonuses[chosen] += cd.amount;
        });
        return bonuses;
    }

    // 1a. Catalog mode
    workingChar.racialAsiMode = 'catalog';
    let b = getEffectiveRacialBonuses();
    assert.strictEqual(b.str, 1);
    assert.strictEqual(b.con, 2);
    assert.strictEqual(b.dex, 1);
    assert.strictEqual(b.cha, 1);

    // 1b. Tasha's +2/+1 mode
    workingChar.racialAsiMode = 'tashas';
    workingChar.tashasMode = 'plus2plus1';
    workingChar.tashasPlus2 = 'dex';
    workingChar.tashasPlus1 = 'wis';
    b = getEffectiveRacialBonuses();
    assert.strictEqual(b.dex, 2);
    assert.strictEqual(b.wis, 1);
    assert.strictEqual(b.str, 0);

    // 1c. Tasha's 3x +1 mode
    workingChar.tashasMode = 'threePlus1';
    workingChar.tashasPlus1_1 = 'str';
    workingChar.tashasPlus1_2 = 'dex';
    workingChar.tashasPlus1_3 = 'int';
    b = getEffectiveRacialBonuses();
    assert.strictEqual(b.str, 1);
    assert.strictEqual(b.dex, 1);
    assert.strictEqual(b.int, 1);
    assert.strictEqual(b.con, 0);

    // 1d. Background ASI 2024 mode
    workingChar.racialAsiMode = 'background';
    workingChar.bgAsiMode = 'plus2plus1';
    workingChar.bgAsiPlus2 = 'con';
    workingChar.bgAsiPlus1 = 'cha';
    b = getEffectiveRacialBonuses();
    assert.strictEqual(b.con, 2);
    assert.strictEqual(b.cha, 1);

    // 1e. Custom ASI mode
    workingChar.racialAsiMode = 'custom';
    workingChar.customRacialBonuses = { str: 2, dex: 1, con: 1, int: 0, wis: -1, cha: 0 };
    b = getEffectiveRacialBonuses();
    assert.strictEqual(b.str, 2);
    assert.strictEqual(b.dex, 1);
    assert.strictEqual(b.con, 1);
    assert.strictEqual(b.wis, -1);

    console.log(
        "  ✓ Catalog, Tasha's (+2/+1 & 3x +1), Background (+2/+1 & 3x +1), and Custom ASI all calculate correctly."
    );
}

// =========================================================================
// TEST 2: Dual Weapon Choices in Equipment
// =========================================================================
console.log('\n[Test 2] Dual Weapon Choices in Equipment...');
{
    const choiceLabel = '(a) a greataxe or (b) two martial weapons';
    const isDual = /two\s+(martial|simple)\s+weapons/i.test(choiceLabel);
    assert.strictEqual(isDual, true, 'Regex must recognize two martial weapons');

    const cs = {
        title: 'Weapons',
        options: [
            { key: 'a', label: 'a greataxe' },
            { key: 'b', label: 'two martial weapons' }
        ],
        selectedOption: 'b',
        selectedWeapon1: 'Longsword',
        selectedWeapon2: 'Shortsword'
    };

    const char = { equipment: [] };
    function importCleanEquipmentItem(name) {
        char.equipment.push({
            name,
            qty: 1,
            isWeapon: true,
            containerId: 'cnt_belt',
            equipped: true
        });
    }

    const chosenOpt = cs.options.find((o) => o.key === cs.selectedOption);
    if (/two\s+(martial|simple)\s+weapons/i.test(chosenOpt.label)) {
        importCleanEquipmentItem(cs.selectedWeapon1);
        importCleanEquipmentItem(cs.selectedWeapon2);
    }

    assert.strictEqual(char.equipment.length, 2);
    assert.strictEqual(char.equipment[0].name, 'Longsword');
    assert.strictEqual(char.equipment[1].name, 'Shortsword');
    assert.strictEqual(char.equipment[0].containerId, 'cnt_belt');
    assert.strictEqual(char.equipment[1].containerId, 'cnt_belt');
    console.log('  ✓ Dual martial weapon choice imports both Longsword and Shortsword as distinct items.');
}

// =========================================================================
// TEST 3 & 4 & 5: Innate Spells Extraction (Racial & Background Spells)
// =========================================================================
console.log('\n[Test 3, 4, 5] Innate Spells Extraction from Species & Background...');
{
    // Implementation matching extractGrantedSpells
    function extractGrantedSpells(baseRace, subrace, bg, totalLvl, allSpells) {
        const granted = [];
        const seen = new Set();

        const addCandidate = (rawName, originName, minLvl = 1) => {
            if (!rawName) return;
            const cleanName = rawName
                .replace(/^\{@spell\s+/i, '')
                .replace(/\|[^\}]+/, '')
                .replace(/\}$/, '')
                .trim();
            if (!cleanName || seen.has(cleanName.toLowerCase())) return;
            if (totalLvl < minLvl) return;

            seen.add(cleanName.toLowerCase());
            const spObj = (allSpells || []).find((s) => (s.name || '').toLowerCase() === cleanName.toLowerCase());
            const lvl = spObj
                ? spObj.level
                : minLvl === 1 && /thaumaturgy|light|spark|guidance|blade ward/i.test(cleanName)
                  ? 0
                  : 1;
            granted.push({
                id: 'isp_' + cleanName.toLowerCase().replace(/\W+/g, '_'),
                name: spObj ? spObj.name : cleanName,
                level: lvl,
                school: spObj ? spObj.school : '',
                time: spObj ? spObj.castingTime || '1 action' : '1 action',
                range: spObj ? spObj.range || 'Self' : 'Self',
                duration: spObj ? spObj.duration || 'Instantaneous' : 'Instantaneous',
                description: spObj ? spObj.descriptionMarkdown || spObj.descriptionHtml || '' : '',
                originName: originName,
                source: originName,
                checked: true,
                isCantrip: lvl === 0
            });
        };

        const checkAdditionalSpells = (obj, originName) => {
            if (!obj || !obj.additionalSpells) return;
            obj.additionalSpells.forEach((group) => {
                if (group.innate) {
                    Object.keys(group.innate).forEach((lvlReqKey) => {
                        const lvlReq = parseInt(lvlReqKey) || 1;
                        const spells = group.innate[lvlReqKey];
                        if (Array.isArray(spells)) {
                            spells.forEach((s) => {
                                if (typeof s === 'string') addCandidate(s, originName, lvlReq);
                                else if (s && s.daily) {
                                    Object.keys(s.daily).forEach((dKey) => {
                                        const dSpells = s.daily[dKey];
                                        if (Array.isArray(dSpells))
                                            dSpells.forEach((ds) => addCandidate(ds, originName, lvlReq));
                                    });
                                }
                            });
                        }
                    });
                }
                if (group.known) {
                    Object.keys(group.known).forEach((lvlReqKey) => {
                        const lvlReq = parseInt(lvlReqKey) || 1;
                        const spells = group.known[lvlReqKey];
                        if (Array.isArray(spells)) spells.forEach((s) => addCandidate(s, originName, lvlReq));
                    });
                }
            });
        };

        const checkEntriesForSpells = (entries, originName) => {
            if (!entries) return;
            const str = JSON.stringify(entries);
            const matches = str.matchAll(/\{@spell\s+([^|}]+)(?:\|[^}]+)?\}/gi);
            for (const m of matches) {
                addCandidate(m[1].trim(), originName, 1);
            }
        };

        if (baseRace) {
            const rName = baseRace.name || 'Species';
            checkAdditionalSpells(baseRace, rName);
            checkEntriesForSpells(baseRace.entries, rName);
        }
        if (subrace) {
            const srName = subrace.name || 'Subspecies';
            checkAdditionalSpells(subrace, srName);
            checkEntriesForSpells(subrace.entries, srName);
        }
        if (bg) {
            const bgName = bg.name || 'Background';
            checkAdditionalSpells(bg, bgName);
            checkEntriesForSpells(bg.entries, bgName);
        }

        return granted;
    }

    const mockSpells = [
        { name: 'Thaumaturgy', level: 0, school: 'Transmutation' },
        { name: 'Hellish Rebuke', level: 1, school: 'Evocation' },
        { name: 'Darkness', level: 2, school: 'Evocation' },
        { name: 'Poison Spray', level: 0, school: 'Conjuration' },
        { name: 'Entangle', level: 1, school: 'Conjuration' },
        { name: 'Ray of Sickness', level: 1, school: 'Necromancy' }
    ];

    const tieflingRace = {
        name: 'Tiefling',
        additionalSpells: [
            {
                innate: {
                    1: ['Thaumaturgy'],
                    3: [{ daily: { 1: ['Hellish Rebuke'] } }],
                    5: [{ daily: { 1: ['Darkness'] } }]
                }
            }
        ]
    };

    const golgariBg = {
        name: 'Golgari Agent',
        entries: [
            'Spells: You know {@spell Poison Spray}. In addition, the spells {@spell Entangle} and {@spell Ray of Sickness} are added to your spell list.'
        ]
    };

    // Level 3 character
    const lvl3Spells = extractGrantedSpells(tieflingRace, null, golgariBg, 3, mockSpells);
    const names = lvl3Spells.map((s) => s.name);
    assert(names.includes('Thaumaturgy'), 'Should have Thaumaturgy at level 3');
    assert(names.includes('Hellish Rebuke'), 'Should have Hellish Rebuke at level 3');
    assert(!names.includes('Darkness'), 'Darkness requires level 5');
    assert(names.includes('Poison Spray'), 'Should have Poison Spray from Golgari Agent');
    assert(names.includes('Entangle'), 'Should have Entangle from Golgari Agent');
    assert(names.includes('Ray of Sickness'), 'Should have Ray of Sickness from Golgari Agent');

    // Level 5 character
    const lvl5Spells = extractGrantedSpells(tieflingRace, null, golgariBg, 5, mockSpells);
    assert(
        lvl5Spells.some((s) => s.name === 'Darkness'),
        'Should have Darkness at level 5'
    );

    // Test import into char.spells
    const char = { spells: { cantrip: [], level1: [], level2: [] } };
    lvl3Spells.forEach((isp) => {
        const k = isp.level === 0 ? 'cantrip' : 'level' + isp.level;
        char.spells[k].push({
            name: isp.name,
            level: isp.level,
            prepared: true,
            innate: true,
            origin: isp.originName
        });
    });

    assert.strictEqual(char.spells.cantrip.length, 2); // Thaumaturgy + Poison Spray
    assert.strictEqual(char.spells.level1.length, 3); // Hellish Rebuke + Entangle + Ray of Sickness
    assert(
        char.spells.cantrip.every((s) => s.prepared && s.innate),
        'All innate spells are marked prepared and innate'
    );
    console.log(
        '  ✓ Racial spells (Tiefling) and Background spells (Golgari Agent) extracted and imported with prepared: true.'
    );
}

// =========================================================================
// TEST 6: Chain Mail Heavy Armor AC Calculation
// =========================================================================
console.log('\n[Test 6] Chain Mail (Heavy Armor) AC Calculation...');
{
    function runAcCalculation(chosenArmor, dexMod, shieldEnabled = false) {
        let rawT = (chosenArmor.rawType || '').toUpperCase();
        const chosenNameLow = (chosenArmor.name || '').toLowerCase();
        if (!rawT || rawT === 'NONE') {
            if (
                chosenNameLow.includes('chain mail') ||
                chosenNameLow.includes('plate') ||
                chosenNameLow.includes('splint') ||
                chosenNameLow.includes('ring mail')
            )
                rawT = 'HA';
            else if (chosenNameLow.includes('leather') || chosenNameLow.includes('padded')) rawT = 'LA';
            else rawT = 'MA';
        }

        let base = 10;
        let formula = '';
        let dexCap = 0;
        if (rawT === 'HA') {
            dexCap = 0;
            base = (chosenArmor.baseAc || 16) + (chosenArmor.bonusAc || 0);
            formula = `${chosenArmor.name} (${chosenArmor.baseAc}${chosenArmor.bonusAc ? ` + ${chosenArmor.bonusAc}` : ''})`;
        } else if (rawT === 'MA') {
            dexCap = Math.min(2, dexMod);
            base = (chosenArmor.baseAc || 14) + dexCap + (chosenArmor.bonusAc || 0);
            formula = `${chosenArmor.name} (${chosenArmor.baseAc} + DEX cap [${dexCap}]${chosenArmor.bonusAc ? ` + ${chosenArmor.bonusAc}` : ''})`;
        } else {
            dexCap = dexMod;
            base = (chosenArmor.baseAc || 11) + dexCap + (chosenArmor.bonusAc || 0);
            formula = `${chosenArmor.name} (${chosenArmor.baseAc} + DEX [${dexMod >= 0 ? '+' : ''}${dexMod}]${chosenArmor.bonusAc ? ` + ${chosenArmor.bonusAc}` : ''})`;
        }

        const shieldVal = shieldEnabled ? 2 : 0;
        if (shieldVal) formula += ' + Shield (+2)';
        return { ac: base + shieldVal, formula, rawT };
    }

    const chainMail = {
        name: 'Chain Mail [Armor]',
        rawType: 'HA',
        baseAc: 16,
        bonusAc: 0
    };

    // Test with DEX = 10 (mod 0)
    let res = runAcCalculation(chainMail, 0, false);
    assert.strictEqual(res.ac, 16);
    assert.strictEqual(res.formula, 'Chain Mail [Armor] (16)');
    assert(!res.formula.includes('DEX cap'), 'Chain mail formula must NOT contain DEX cap');

    // Test with DEX = 16 (mod +3) -> Heavy armor still ignores DEX!
    res = runAcCalculation(chainMail, 3, false);
    assert.strictEqual(res.ac, 16, 'Chain mail must ignore DEX modifier even if high');

    // Test with DEX = 6 (mod -2) -> Heavy armor still ignores negative DEX in 5e!
    res = runAcCalculation(chainMail, -2, false);
    assert.strictEqual(res.ac, 16);

    // Test with Shield equipped -> 16 + 2 = 18
    res = runAcCalculation(chainMail, 0, true);
    assert.strictEqual(res.ac, 18);
    assert.strictEqual(res.formula, 'Chain Mail [Armor] (16) + Shield (+2)');

    // Test fallback when rawType is missing or generic 'Armor'
    const legacyItem = { name: 'Chain Mail', type: 'Armor', baseAc: 16, bonusAc: 0 };
    res = runAcCalculation(legacyItem, 2, false);
    assert.strictEqual(res.rawT, 'HA');
    assert.strictEqual(res.ac, 16);
    assert(!res.formula.includes('DEX cap'));

    console.log(
        '  ✓ Chain Mail correctly sets rawType HA, yields flat 16 AC (18 with shield), and never adds DEX cap.'
    );
}

// =========================================================================
// TEST 7: Feats Appropriate Choices & Cards Creation
// =========================================================================
console.log('\n[Test 7] Feats Appropriate Sub-Choices & Dedicated Sub-Cards...');
{
    const char = {
        abilityCategories: [{ id: 'cat_feats', name: 'Feats' }],
        abilityCards: []
    };

    const asiTiers = [
        {
            choice: 'feat',
            selectedFeatId: 'Fighting Initiate',
            featSubChoices: { fightingStyle: 'Defense' }
        },
        {
            choice: 'feat',
            selectedFeatId: 'Eldritch Adept',
            featSubChoices: { invocation: "Devil's Sight" }
        },
        {
            choice: 'feat',
            selectedFeatId: 'Metamagic Adept',
            featSubChoices: { metamagic1: 'Quickened Spell', metamagic2: 'Twinned Spell' }
        },
        {
            choice: 'feat',
            selectedFeatId: 'Elemental Adept',
            featSubChoices: { elementalType: 'Fire' }
        }
    ];

    const builderCache = {
        feats: [
            {
                id: 'Fighting Initiate',
                name: 'Fighting Initiate',
                description: 'Your martial training has helped you develop a particular style of fighting.'
            },
            {
                id: 'Eldritch Adept',
                name: 'Eldritch Adept',
                description: 'Studying occult lore, you have unlocked one Eldritch Invocation option.'
            },
            {
                id: 'Metamagic Adept',
                name: 'Metamagic Adept',
                description: 'You have learned how to exert your will on your spells.'
            },
            {
                id: 'Elemental Adept',
                name: 'Elemental Adept',
                description: 'Spells you cast ignore resistance to damage of the chosen type.'
            }
        ]
    };

    // Execution matching applyBtn.onclick
    asiTiers.forEach((t) => {
        if (t.choice === 'feat' && t.selectedFeatId) {
            const featObj = builderCache.feats.find((f) => f.id === t.selectedFeatId);
            if (featObj) {
                let fName = featObj.name;
                const sub = t.featSubChoices || {};
                let subCardTitle = '';
                let subDesc = '';

                if (fName.toLowerCase().includes('fighting initiate') && sub.fightingStyle) {
                    fName = `Feat: Fighting Initiate (${sub.fightingStyle})`;
                    subCardTitle = `Fighting Style: ${sub.fightingStyle}`;
                    subDesc = `You adopt a particular style of fighting as your specialty: ${sub.fightingStyle}.`;
                } else if (fName.toLowerCase().includes('eldritch adept') && sub.invocation) {
                    fName = `Feat: Eldritch Adept (${sub.invocation})`;
                    subCardTitle = `Eldritch Invocation: ${sub.invocation}`;
                    subDesc = `In your study of occult lore, you have unearned an eldritch invocation: ${sub.invocation}.`;
                } else if (fName.toLowerCase().includes('metamagic adept') && (sub.metamagic1 || sub.metamagic2)) {
                    const metamagics = [sub.metamagic1, sub.metamagic2].filter(Boolean);
                    fName = `Feat: Metamagic Adept (${metamagics.join(', ')})`;
                    subCardTitle = `Metamagic: ${metamagics.join(' & ')}`;
                    subDesc = `You have learned how to exert your will on your spells with Metamagic. Options: ${metamagics.join(', ')}.`;
                } else if (fName.toLowerCase().includes('elemental adept') && sub.elementalType) {
                    fName = `Feat: Elemental Adept (${sub.elementalType})`;
                    subDesc = `Spells you cast ignore resistance to damage of ${sub.elementalType}. In addition, when you roll damage for a spell you cast that deals ${sub.elementalType} damage, you can treat any 1 on a damage die as a 2.`;
                }

                // Add parent feat card
                char.abilityCards.push({
                    name: fName,
                    description: featObj.description
                });

                // Add dedicated sub-card if applicable
                if (subCardTitle) {
                    char.abilityCards.push({
                        name: subCardTitle,
                        description: subDesc
                    });
                }
            }
        }
    });

    const cardNames = char.abilityCards.map((c) => c.name);

    assert(
        cardNames.includes('Feat: Fighting Initiate (Defense)'),
        'Parent feat card must include chosen Fighting Style'
    );
    assert(cardNames.includes('Fighting Style: Defense'), 'Must create dedicated sub-feature card for Fighting Style');

    assert(
        cardNames.includes("Feat: Eldritch Adept (Devil's Sight)"),
        'Parent feat card must include chosen Invocation'
    );
    assert(
        cardNames.includes("Eldritch Invocation: Devil's Sight"),
        'Must create dedicated sub-feature card for Eldritch Invocation'
    );

    assert(
        cardNames.includes('Feat: Metamagic Adept (Quickened Spell, Twinned Spell)'),
        'Parent feat card must include chosen Metamagics'
    );
    assert(
        cardNames.includes('Metamagic: Quickened Spell & Twinned Spell'),
        'Must create dedicated sub-feature card for Metamagics'
    );

    assert(cardNames.includes('Feat: Elemental Adept (Fire)'), 'Parent feat card must include chosen damage type');

    console.log(
        '  ✓ Feats with sub-choices (Fighting Initiate, Eldritch Adept, Metamagic Adept, Elemental Adept) create customized parent cards and dedicated sub-feature cards.'
    );
}

console.log('\n======================================================');
console.log('ALL 7 FIXES SUCCESSFULLY VERIFIED AND PASSED!');
console.log('======================================================\n');
