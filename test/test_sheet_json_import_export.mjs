import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildCharacterExportPayload,
    parseImportedSheetJson,
    validateImportedSheetEntity,
    findImportConflict,
    prepareImportedCharacter,
    detectCrossCampaignAssetUrls,
    validateImportFileSize,
    MAX_SHEET_JSON_BYTES
} from '../vtt/js/player-sheet/vtt-sheet-json-io.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('buildCharacterExportPayload produces forgedvtt-entity-v1 for PC and Companion', () => {
    const pc = { id: 'char_1', name: 'Valeros the Bold!', class: 'Fighter', level: 5, hpMax: 44, hpCurrent: 44 };
    const pcOut = buildCharacterExportPayload(pc);
    assert.equal(pcOut.fileName, 'Valeros_the_Bold.json');
    assert.equal(pcOut.payload.format, 'forgedvtt-entity-v1');
    assert.equal(pcOut.payload.entityType, 'player');
    assert.equal(pcOut.payload.entity.name, 'Valeros the Bold!');
    assert.equal(pcOut.payload.entity.isCompanion, false);

    const comp = {
        id: 'comp_1',
        name: 'Shadow Wolf',
        isCompanion: true,
        monsterData: { name: 'Wolf', hp: { average: 11 } },
        hpMax: 11,
        hpCurrent: 11
    };
    const compOut = buildCharacterExportPayload(comp);
    assert.equal(compOut.fileName, 'Shadow_Wolf.json');
    assert.equal(compOut.payload.format, 'forgedvtt-entity-v1');
    assert.equal(compOut.payload.entityType, 'companion');
    assert.equal(compOut.payload.entity.isCompanion, true);
});

test('parseImportedSheetJson supports entity-v1, batch-v1, and raw JSON while rejecting non-sheets', () => {
    const entityJson = JSON.stringify({
        format: 'forgedvtt-entity-v1',
        entityType: 'player',
        entity: { id: 'c1', name: 'Lyra', class: 'Wizard', level: 3 }
    });
    const parsedEntity = parseImportedSheetJson(entityJson);
    assert.equal(parsedEntity.format, 'forgedvtt-entity-v1');
    assert.equal(parsedEntity.items.length, 1);
    assert.equal(parsedEntity.items[0].name, 'Lyra');

    const batchJson = JSON.stringify({
        format: 'forgedvtt-batch-v1',
        entityType: 'companion',
        items: [
            { id: 'comp_1', name: 'Owl', isCompanion: true, monsterData: { name: 'Owl' } },
            { id: 'comp_2', name: 'Wolf', isCompanion: true, monsterData: { name: 'Wolf' } }
        ]
    });
    const parsedBatch = parseImportedSheetJson(batchJson);
    assert.equal(parsedBatch.items.length, 2);
    assert.equal(parsedBatch.entityType, 'companion');

    const rawJson = JSON.stringify({ id: 'c2', name: 'Garrick', stats: { str: 16 } });
    const parsedRaw = parseImportedSheetJson(rawJson);
    assert.equal(parsedRaw.format, 'raw-character-json');
    assert.equal(parsedRaw.items[0].name, 'Garrick');

    assert.throws(
        () => parseImportedSheetJson('{"format":"forgedvtt-campaign-v1","campaign":{}}'),
        /campaign backups/i
    );
    assert.throws(
        () => parseImportedSheetJson('{"format":"forgedvtt-entity-v1","entityType":"map","entity":{}}'),
        /Unsupported entity type/i
    );
    assert.throws(() => parseImportedSheetJson('not valid json'), /Invalid JSON/);
});

test('validateImportedSheetEntity enforces GM-only companion import and rejects maps/NPCs', () => {
    const rawPc = { name: 'Aeliana', class: 'Cleric', level: 4, stats: { wis: 18 } };
    const validatedPc = validateImportedSheetEntity(rawPc, { isGM: false });
    assert.equal(validatedPc.isCompanion, false);
    assert.equal(validatedPc.entity.name, 'Aeliana');

    const rawComp = { name: 'Dire Wolf', isCompanion: true, monsterData: { name: 'Dire Wolf' } };
    assert.throws(() => validateImportedSheetEntity(rawComp, { isGM: false }), /Only the GM can import Companion/i);

    const validatedCompGm = validateImportedSheetEntity(rawComp, { isGM: true });
    assert.equal(validatedCompGm.isCompanion, true);
    assert.equal(validatedCompGm.entity.isCompanion, true);

    assert.throws(() => validateImportedSheetEntity({ name: 'Tavern', grid: {} }, { isGM: true }), /Map JSON/i);
    assert.throws(
        () => validateImportedSheetEntity({ name: 'Bandit', isCustomNpc: true }, { isGM: true }),
        /Custom NPCs/i
    );
});

test('findImportConflict and prepareImportedCharacter handle copy and overwrite modes', () => {
    const existing = {
        char_1: {
            id: 'char_1',
            name: 'Thorin',
            owner: 'alice',
            assignedPlayers: ['alice']
        },
        char_2: {
            id: 'char_2',
            name: 'Elara',
            owner: 'bob',
            assignedPlayers: ['bob']
        }
    };

    const conflictOwned = findImportConflict({ id: 'char_1', name: 'Thorin' }, existing, {
        isGM: false,
        username: 'alice'
    });
    assert.equal(conflictOwned.conflictTarget.id, 'char_1');
    assert.equal(conflictOwned.canOverwrite, true);

    const conflictOther = findImportConflict({ id: 'char_2', name: 'Elara' }, existing, {
        isGM: false,
        username: 'alice'
    });
    assert.equal(conflictOther.conflictTarget.id, 'char_2');
    assert.equal(conflictOther.canOverwrite, false);

    const copyPrepared = prepareImportedCharacter(
        { id: 'char_1', name: 'Thorin', class: 'Fighter' },
        { mode: 'copy', conflictTarget: existing.char_1, existingCharacters: existing, isGM: false, username: 'alice' }
    );
    assert.notEqual(copyPrepared.id, 'char_1');
    assert.equal(copyPrepared.name, 'Thorin (Copy)');
    assert.deepEqual(copyPrepared.assignedPlayers, ['alice']);

    const overwritePrepared = prepareImportedCharacter(
        { id: 'different_id', name: 'Thorin', class: 'Paladin' },
        {
            mode: 'overwrite',
            conflictTarget: existing.char_1,
            existingCharacters: existing,
            isGM: false,
            username: 'alice'
        }
    );
    assert.equal(overwritePrepared.id, 'char_1');
    assert.equal(overwritePrepared.name, 'Thorin');
    assert.equal(overwritePrepared.class, 'Paladin');
});

test('server, P2P host, and VTT HTML include required import/export UI and security guards', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'vtt/index.html'), 'utf8');
    assert.ok(indexHtml.includes('id="btn-char-import-json"'), 'Missing Import button in VTT HTML');
    assert.ok(indexHtml.includes('id="input-char-import-json"'), 'Missing hidden file input in VTT HTML');

    const socketJs = fs.readFileSync(path.join(ROOT, 'server/socket.js'), 'utf8');
    assert.ok(
        socketJs.includes('delete sanitizedCharacter.isCompanion;'),
        'server/socket.js must strip isCompanion on non-GM character creation'
    );

    const p2pHostJs = fs.readFileSync(path.join(ROOT, 'vtt/js/network/vtt-p2p-host-engine.js'), 'utf8');
    assert.ok(
        p2pHostJs.includes('delete sanitized.isCompanion;'),
        'vtt-p2p-host-engine.js must strip isCompanion on non-GM character creation'
    );
});

test('cross-type conflict, non-GM companion overwrite, asset URL detection, and file size guard', () => {
    const existing = {
        comp_wolf: {
            id: 'comp_wolf',
            name: 'Wolf',
            isCompanion: true,
            assignedPlayers: ['alice']
        }
    };

    // Player importing a PC named "Wolf" must NOT be allowed to overwrite Companion "Wolf"
    const crossConflict = findImportConflict({ name: 'Wolf', isCompanion: false }, existing, {
        isGM: false,
        username: 'alice'
    });
    assert.equal(crossConflict.conflictTarget, null);
    assert.equal(crossConflict.canOverwrite, false);

    // Non-GM cannot overwrite a Companion even by ID
    const idCrossConflict = findImportConflict({ id: 'comp_wolf', name: 'Wolf', isCompanion: true }, existing, {
        isGM: false,
        username: 'alice'
    });
    assert.equal(idCrossConflict.canOverwrite, false);

    // Cross-campaign upload URL detection
    const charWithAssets = {
        name: 'Lyra',
        tokenImages: [
            { url: '/assets/campaigns/other_camp/uploads/lyra.webp' },
            { url: '/assets/campaigns/my_camp/uploads/sword.webp' },
            { url: 'https://example.com/avatar.png' }
        ]
    };
    const crossUrls = detectCrossCampaignAssetUrls(charWithAssets, 'my_camp');
    assert.deepEqual(crossUrls, ['/assets/campaigns/other_camp/uploads/lyra.webp']);

    // File size guard
    assert.doesNotThrow(() => validateImportFileSize({ size: 1024 }));
    assert.throws(() => validateImportFileSize({ size: MAX_SHEET_JSON_BYTES + 1 }), /too large/i);
});
