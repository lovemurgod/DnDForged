import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SourceManager, SOURCE_CATEGORIES } from '../electron/source-manager.js';
import { createBlankEntity, jsonToEntity, entityToJson } from '../electron/ui/builder-schemas.js';
import { isRoll20TableJson, convertRoll20TableToVTT } from '../electron/importers/roll20-importer.js';

console.log('--- RUNNING ELECTRON TABLE SOURCE CONTROL & BUILDER INTEGRATION TESTS ---');

// =========================================================================
// TEST 1: SourceManager Built-in Table Scanning & Sourcebook Categorization
// =========================================================================
console.log('\n[Test 1] SourceManager Built-in Table Scanning & Granular Source Partitioning...');
{
    // Verify SOURCE_CATEGORIES contains 'tables'
    const tableCategory = SOURCE_CATEGORIES.find((c) => c.id === 'tables');
    assert.ok(tableCategory, "SOURCE_CATEGORIES must include 'tables' category");
    assert.strictEqual(tableCategory.name, 'Rollable Tables');

    // Instantiate SourceManager pointing to repo root
    const sm = new SourceManager({ rootDir: process.cwd() });
    const allSources = sm.getAllSources();
    const tablesCat = allSources.categories.find((c) => c.id === 'tables');
    assert.ok(tablesCat, "getAllSources must include 'tables' category");
    assert.ok(Array.isArray(tablesCat.sources), 'tables category must contain a sources array');
    assert.ok(tablesCat.sources.length > 0, 'tables category must index built-in rulebook table sources');

    console.log(`  Indexed ${tablesCat.sources.length} table rulebook sources.`);
    const dmgSource = tablesCat.sources.find((s) => s.code === 'DMG');
    assert.ok(dmgSource, "Built-in tables must index 'DMG' source");
    assert.ok(dmgSource.entryCount > 0, `DMG tables entryCount must be > 0 (found ${dmgSource.entryCount})`);

    // Search compendium in tables category
    const searchRes = sm.searchCompendium('tables', 'Wild Magic');
    assert.ok(searchRes && searchRes.results, 'searchCompendium should return results');
    assert.ok(searchRes.results.length > 0, "Should find 'Wild Magic' tables in compendium catalog");
    console.log(`  Found ${searchRes.results.length} matching table(s) for 'Wild Magic'.`);

    // Verify getEntityFullData returns the full table definition
    const target = searchRes.results[0];
    const fullRes = sm.getEntityFullData('tables', target.name, target.source);
    assert.ok(fullRes && fullRes.success && fullRes.entity, 'getEntityFullData must retrieve full table data');
    assert.strictEqual(fullRes.entity.name, target.name, 'Full data name must match target');
    assert.ok(Array.isArray(fullRes.entity.rows), 'Table full data must contain rows array');

    console.log('  [PASS] Built-in Table Scanning & Granular Source Partitioning verified.');
}

// =========================================================================
// TEST 2: SourceManager Custom Table Source Creation & Inspection
// =========================================================================
console.log('\n[Test 2] SourceManager Custom Table Source Creation & Lifecycle...');
{
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dndforged-test-table-sm-'));
    try {
        const sm = new SourceManager({ rootDir: tmpDir });
        const createRes = sm.createCustomSource({
            category: 'tables',
            code: 'MYLOOT',
            name: 'Custom Campaign Loot Tables',
            author: 'Dungeon Master',
            description: 'Custom table pack'
        });
        assert.ok(createRes.success, 'createCustomSource for tables must succeed');
        const filePath = createRes.source?.filePath;
        assert.ok(filePath && fs.existsSync(filePath), 'Custom table file must exist on disk');

        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        assert.strictEqual(fileContent.source, 'MYLOOT');
        assert.ok(Array.isArray(fileContent.table), 'Custom table file must initialize empty table array');

        // Add a table to custom source and save
        fileContent.table.push({
            name: 'Wand of Wonder Custom Surge',
            source: 'MYLOOT',
            diceExpression: '1d4',
            rows: [
                [1, 1, 'Target turns invisible.'],
                [2, 2, 'Fireball erupts at target location.'],
                [3, 4, 'Target sprouts butterfly wings and hovers.']
            ]
        });

        const saveRes = sm.saveSourceDetails({
            category: 'tables',
            code: 'MYLOOT',
            name: 'Custom Campaign Loot Tables',
            rawJson: JSON.stringify(fileContent, null, 2)
        });
        assert.ok(saveRes.success, 'saveSourceDetails for custom tables must succeed');

        // Inspect import file detection
        const inspectRes = sm.inspectImportFiles([filePath]);
        assert.ok(inspectRes.success, 'inspectImportFiles must succeed');
        assert.ok(inspectRes.candidates.length > 0, 'Candidate must be identified');
        assert.strictEqual(inspectRes.candidates[0].detectedCategory, 'tables');
        console.log('  [PASS] Custom Table Source creation, save, and file inspection verified.');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

// =========================================================================
// TEST 3: Visual Builder Schemas for Tables & Linked Tables
// =========================================================================
console.log('\n[Test 3] Homebrew Studio Builder Schemas (Tables & Linked Table Controls)...');
{
    // 1. Create blank table entity
    const blankTable = createBlankEntity('tables');
    assert.strictEqual(blankTable.name, 'New Roll Table');
    assert.strictEqual(blankTable.dice, '1d100');
    assert.ok(Array.isArray(blankTable.rows), 'Blank table must have rows array');
    assert.ok(blankTable.rows.length >= 2, 'Blank table should have initial default rows');

    // 2. Table serialization (entityToJson) and deserialization (jsonToEntity)
    const customTableEntity = {
        name: 'Wild Magic Surge Table',
        source: 'MYBREW',
        dice: '1d20',
        caption: 'Unpredictable magical surges',
        colLabels: ['d20', 'Magical Surge Effect'],
        rows: [
            { min: 1, max: 5, text: 'Roll on this table every turn for 1 minute.' },
            { min: 6, max: 15, text: 'You cast Feather Fall on yourself.' },
            { min: 16, max: 20, text: 'You regain your highest-level expended spell slot.' }
        ]
    };

    const serializedTableJson = entityToJson('tables', customTableEntity);
    assert.strictEqual(serializedTableJson.name, 'Wild Magic Surge Table');
    assert.strictEqual(serializedTableJson.dice, '1d20');
    assert.strictEqual(serializedTableJson.caption, 'Unpredictable magical surges');
    assert.deepStrictEqual(serializedTableJson.colLabels, ['d20', 'Magical Surge Effect']);
    assert.strictEqual(serializedTableJson.rows.length, 3);
    assert.deepStrictEqual(serializedTableJson.rows[0], ['1-5', 'Roll on this table every turn for 1 minute.']);

    const deserializedTable = jsonToEntity('tables', serializedTableJson);
    assert.strictEqual(deserializedTable.name, customTableEntity.name);
    assert.strictEqual(deserializedTable.dice, customTableEntity.dice);
    assert.strictEqual(deserializedTable.caption, customTableEntity.caption);
    assert.deepStrictEqual(deserializedTable.rows, customTableEntity.rows);

    // 3. Bestiary Trait & Action Linked Table Persistence
    const creatureEntity = {
        name: 'Chaos Eye Beholder',
        source: 'MYBREW',
        traits: [
            {
                name: 'Chaotic Aura',
                text: 'Whenever a spell is cast within 30 feet, roll on the surge table.',
                linkedTable: 'Wild Magic Surge Table'
            }
        ],
        actions: [
            {
                name: 'Random Eye Ray',
                text: 'The beholder shoots a random ray.',
                linkedTable: 'Beholder Eye Rays'
            }
        ]
    };

    const serializedCreature = entityToJson('bestiary', creatureEntity);
    assert.ok(Array.isArray(serializedCreature.trait));
    assert.strictEqual(serializedCreature.trait[0].linkedTable, 'Wild Magic Surge Table');
    assert.ok(Array.isArray(serializedCreature.action));
    assert.strictEqual(serializedCreature.action[0].linkedTable, 'Beholder Eye Rays');

    const deserializedCreature = jsonToEntity('bestiary', serializedCreature);
    assert.strictEqual(deserializedCreature.traits[0].linkedTable, 'Wild Magic Surge Table');
    assert.strictEqual(deserializedCreature.actions[0].linkedTable, 'Beholder Eye Rays');

    // 4. Item Linked Table Persistence
    const itemEntity = {
        name: 'Wand of Wonder',
        source: 'DMG',
        type: 'WD',
        rarity: 'rare',
        entries: ['This wand has 7 charges.'],
        linkedTable: 'Wand of Wonder Effects'
    };

    const serializedItem = entityToJson('items', itemEntity);
    assert.strictEqual(serializedItem.linkedTable, 'Wand of Wonder Effects');

    const deserializedItem = jsonToEntity('items', serializedItem);
    assert.strictEqual(deserializedItem.linkedTable, 'Wand of Wonder Effects');

    console.log('  [PASS] Builder schemas, table round-trip, and linkedTable controls verified.');
}

// =========================================================================
// TEST 4: Roll20 Rollable Table Detection & Conversion
// =========================================================================
console.log('\n[Test 4] Roll20 Rollable Table Auto-Detection & Conversion...');
{
    // Test 1: Detection
    const textOnlyRoll20Table = {
        schema_version: 2,
        name: 'Random Dungeon Encounters',
        rollabletable: {
            name: 'Random Dungeon Encounters',
            items: [
                { name: '2d4 Goblins lurking in shadows', weight: 3 },
                { name: '1 Owlbear feeding on a carcass', weight: 1 },
                { name: 'Abandoned trap mechanism', weight: 2 }
            ]
        }
    };

    assert.ok(isRoll20TableJson(textOnlyRoll20Table), 'isRoll20TableJson must identify rollabletable manifest');

    // Test 2: Conversion of text-only table into Custom Roll Table
    const tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'dndforged-test-uploads-'));
    try {
        const convertedTextTable = await convertRoll20TableToVTT(textOnlyRoll20Table, tmpUploads, 'camp-test-1');
        assert.ok(Array.isArray(convertedTextTable.customTables), 'Should create customTables array');
        assert.strictEqual(convertedTextTable.customTables.length, 1);

        const tbl = convertedTextTable.customTables[0];
        assert.strictEqual(tbl.name, 'Random Dungeon Encounters');
        assert.strictEqual(tbl.diceFormula, '1d6', 'Total weight is 3+1+2 = 6, dice should be 1d6');
        assert.strictEqual(tbl.rows.length, 3);
        assert.deepStrictEqual(tbl.rows[0], { min: 1, max: 3, text: '2d4 Goblins lurking in shadows' });
        assert.deepStrictEqual(tbl.rows[1], { min: 4, max: 4, text: '1 Owlbear feeding on a carcass' });
        assert.deepStrictEqual(tbl.rows[2], { min: 5, max: 6, text: 'Abandoned trap mechanism' });

        // Test 3: Conversion of multi-sided avatar table into Asset Table
        const multiSidedRoll20Table = {
            schema_version: 2,
            name: 'Shapeshifter Form Tokens',
            rollabletable: {
                name: 'Shapeshifter Form Tokens',
                items: [
                    { name: 'Wolf Form', avatar: 'uploads/wolf.png', weight: 1 },
                    { name: 'Bear Form', avatar: 'uploads/bear.png', weight: 1 },
                    { name: 'Humanoid Form', avatar: 'uploads/human.png', weight: 1 }
                ]
            }
        };

        assert.ok(isRoll20TableJson(multiSidedRoll20Table), 'isRoll20TableJson must identify avatar rollabletable');
        const convertedAssetTable = await convertRoll20TableToVTT(multiSidedRoll20Table, tmpUploads, 'camp-test-1');
        assert.ok(Array.isArray(convertedAssetTable.assetTables), 'Should create assetTables array');
        assert.strictEqual(convertedAssetTable.assetTables.length, 1);

        const assetTbl = convertedAssetTable.assetTables[0];
        assert.strictEqual(assetTbl.name, 'Shapeshifter Form Tokens');
        assert.strictEqual(assetTbl.sides.length, 3);
        assert.strictEqual(assetTbl.sides[0].name, 'Wolf Form');
        assert.strictEqual(assetTbl.sides[0].assetPath, 'uploads/wolf.png');

        console.log('  [PASS] Roll20 rollable table auto-detection and conversion verified.');
    } finally {
        fs.rmSync(tmpUploads, { recursive: true, force: true });
    }
}

// =========================================================================
// TEST 5: Table Rows Clearing & Card Block Linked Table Synchronization
// =========================================================================
console.log('\n[Test 5] Table Rows Clearing & Card Block Linked Table Synchronization...');
{
    // Test that an empty rows array serializes properly without resurrecting defaults
    const tableWithEmptyRows = {
        name: 'Empty Staging Table',
        source: 'MYBREW',
        dice: '1d100',
        caption: 'Staging Table',
        colLabels: ['d100', 'Effect'],
        rows: []
    };

    const serializedEmpty = entityToJson('tables', tableWithEmptyRows);
    assert.strictEqual(serializedEmpty.name, 'Empty Staging Table');
    assert.deepStrictEqual(serializedEmpty.rows, [], 'Empty table rows must remain empty');

    const deserializedEmpty = jsonToEntity('tables', serializedEmpty);
    assert.deepStrictEqual(deserializedEmpty.rows, [], 'Deserialized empty table rows must remain empty');

    // Test creature action linkedTable serialization
    const creatureWithActionTable = {
        name: 'Gazer',
        source: 'VGM',
        actions: [
            {
                name: 'Eye Rays',
                text: 'The gazer shoots two rays randomly.',
                linkedTable: 'Gazer Eye Rays Table'
            }
        ]
    };

    const serializedGazer = entityToJson('bestiary', creatureWithActionTable);
    assert.ok(Array.isArray(serializedGazer.action));
    assert.strictEqual(serializedGazer.action[0].linkedTable, 'Gazer Eye Rays Table');

    const deserializedGazer = jsonToEntity('bestiary', serializedGazer);
    assert.strictEqual(deserializedGazer.actions[0].linkedTable, 'Gazer Eye Rays Table');

    console.log('  [PASS] Empty rows preservation and action linked table round-trip verified.');
}

console.log('\n=======================================================');
console.log('ALL ELECTRON TABLE SOURCE CONTROL TESTS PASSED (5/5)!');
console.log('=======================================================');
