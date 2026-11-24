/**
 * test/test_campaign_import_and_assets.mjs
 * ForgeD VTT - Campaign Import & Asset Upload Integration Test Suite
 * Validates full campaign import, collision handling, asset path rewriting,
 * granular entity imports (maps & characters with copy/overwrite rules),
 * Roll20 format importer, multipart asset uploads, player sandboxing,
 * and path traversal security guards.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import { DATA_DIR, ASSETS_DIR, campaigns, SERVER_INTERNAL_SECRET, isValidAssetPath, generatePlayerSessionToken } from '../server/state.js';
import { campaignsRouter } from '../server/routes/campaigns.js';
import { assetsRouter } from '../server/routes/assets.js';
import {
    isRoll20CharacterJson,
    normalizeRoll20ImageUrl,
    convertRoll20Character
} from '../electron/importers/roll20-importer.js';

// Setup ephemeral Express app mounting campaigns and assets routers
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', campaignsRouter);
app.use('/api', assetsRouter);

let server = null;
let baseUrl = '';

test.before(async () => {
    // Ensure clean state for test campaign keys
    delete campaigns['camp_test_obsidian_1'];

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

test.after(async () => {
    delete campaigns['camp_test_obsidian_1'];
    // Clean up any collision campaigns created during tests
    for (const id of Object.keys(campaigns)) {
        if (id.startsWith('the_obsidian_citadel_') || id.startsWith('camp_test_obsidian_')) {
            delete campaigns[id];
        }
    }
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

// Helper for authorized API calls
function authHeaders(extra = {}) {
    return {
        'x-server-secret': SERVER_INTERNAL_SECRET,
        ...extra
    };
}

test('Campaign Import & Asset Upload Integration Suite', async (t) => {
    // =========================================================================
    // GROUP 1: FULL CAMPAIGN IMPORT & ASSET PATH REWRITING
    // =========================================================================
    await t.test('1. Full Campaign Import: imports valid campaign and assigns GM', async () => {
        const payload = {
            campaign: {
                id: 'camp_test_obsidian_1',
                name: 'The Obsidian Citadel',
                gmUsername: 'DungeonMaster',
                maps: {
                    map_gate: {
                        id: 'map_gate',
                        name: 'Citadel Gate',
                        grid: { size: 70 },
                        tokens: {
                            tok_1: { id: 'tok_1', name: 'Guard', x: 100, y: 100 }
                        }
                    }
                },
                characters: {
                    char_1: {
                        id: 'char_1',
                        name: 'Valeros',
                        hp: 35,
                        maxHp: 35
                    }
                }
            }
        };

        const res = await fetch(`${baseUrl}/api/campaigns/import`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.campaign.id, 'camp_test_obsidian_1');
        assert.equal(data.campaign.name, 'The Obsidian Citadel');
        assert.equal(data.campaign.gmUsername, 'DungeonMaster');
        assert.ok(data.campaign.maps.map_gate);
        assert.ok(data.campaign.characters.char_1);

        // Verify persisted into in-memory campaigns state
        assert.ok(campaigns['camp_test_obsidian_1']);
    });

    await t.test('2. Campaign ID Collision: generates unique ID and rewrites asset URLs', async () => {
        // Import campaign with same ID but containing asset references
        const duplicatePayload = {
            campaign: {
                id: 'camp_test_obsidian_1',
                name: 'The Obsidian Citadel',
                maps: {
                    map_inner: {
                        id: 'map_inner',
                        name: 'Inner Sanctum',
                        artwork: '/assets/campaigns/camp_test_obsidian_1/uploads/sanctum.png',
                        tokens: {
                            tok_boss: {
                                id: 'tok_boss',
                                name: 'Obsidian Lord',
                                image: '/assets/campaigns/camp_test_obsidian_1/uploads/lord.png'
                            }
                        }
                    }
                }
            }
        };

        const res = await fetch(`${baseUrl}/api/campaigns/import`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(duplicatePayload)
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);

        // ID must have been uniquely modified to prevent overwriting the existing campaign
        assert.notEqual(data.campaign.id, 'camp_test_obsidian_1');
        assert.match(data.campaign.id, /^the_obsidian_citadel_\d+$/);

        const newId = data.campaign.id;
        const map = data.campaign.maps.map_inner;

        // Asset paths must be cleanly remapped to the new campaign ID
        assert.equal(map.artwork, `/assets/campaigns/${newId}/uploads/sanctum.png`);
        assert.equal(map.tokens.tok_boss.image, `/assets/campaigns/${newId}/uploads/lord.png`);
    });

    await t.test('3. Campaign Import Validation: rejects missing or invalid campaign data', async () => {
        const res = await fetch(`${baseUrl}/api/campaigns/import`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ invalidField: true })
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /Invalid campaign data/i);
    });

    // =========================================================================
    // GROUP 2: GRANULAR ENTITY IMPORT (MAPS & CHARACTERS)
    // =========================================================================
    await t.test('4. Granular Map Import: adds map with copy suffix on collision and updates mapOrder', async () => {
        const targetCampId = 'camp_test_obsidian_1';
        const mapEntity = {
            id: 'map_gate', // Collides with existing map_gate
            name: 'Citadel Gate',
            grid: { size: 70 },
            tokens: {}
        };

        const res = await fetch(`${baseUrl}/api/campaigns/${targetCampId}/import-entity`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ entityType: 'map', entity: mapEntity })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.count, 1);

        const newMapId = data.importedIds[0];
        assert.notEqual(newMapId, 'map_gate');
        assert.match(data.campaign.maps[newMapId].name, /Citadel Gate \(Copy\)/);
        assert.ok(data.campaign.mapOrder.includes(newMapId));
    });

    await t.test('5. Granular Character Import: respects overwrite flag', async () => {
        const targetCampId = 'camp_test_obsidian_1';

        // 1. Without overwrite -> generates copy
        const copyChar = {
            id: 'char_1', // Collides with existing char_1
            name: 'Valeros',
            hp: 20
        };
        const resCopy = await fetch(`${baseUrl}/api/campaigns/${targetCampId}/import-entity`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ entityType: 'character', entity: copyChar, overwrite: false })
        });
        const dataCopy = await resCopy.json();
        const copyId = dataCopy.importedIds[0];
        assert.notEqual(copyId, 'char_1');
        assert.match(dataCopy.campaign.characters[copyId].name, /Valeros \(Copy\)/);

        // 2. With overwrite -> updates existing character in place
        const updateChar = {
            id: 'char_1',
            name: 'Valeros Enhanced',
            hp: 50,
            maxHp: 50
        };
        const resOverwrite = await fetch(`${baseUrl}/api/campaigns/${targetCampId}/import-entity`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ entityType: 'character', entity: updateChar, overwrite: true })
        });
        const dataOverwrite = await resOverwrite.json();
        assert.equal(dataOverwrite.importedIds[0], 'char_1');
        assert.equal(dataOverwrite.campaign.characters.char_1.name, 'Valeros Enhanced');
        assert.equal(dataOverwrite.campaign.characters.char_1.hp, 50);
    });

    await t.test('6. Granular Entity Import Validation: rejects non-existent campaign', async () => {
        const res = await fetch(`${baseUrl}/api/campaigns/non_existent_campaign_999/import-entity`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ entityType: 'map', entity: { name: 'Void' } })
        });

        assert.equal(res.status, 404);
    });

    // =========================================================================
    // GROUP 3: ROLL20 FORMAT CONVERTER
    // =========================================================================
    await t.test('7. Roll20 Character Importer: detects and converts Better20 format', async () => {
        const mockRoll20Data = {
            schema_version: 1,
            character: {
                attributes: {
                    name: 'Kragor Ironbreaker',
                    avatar: 'https%3A%2F%2Fs3.amazonaws.com%2Ffiles.d20.io%2Fimages%2F12345%2Fkragor.png'
                },
                attribs: [
                    { name: 'strength', current: 18 },
                    { name: 'dexterity', current: 14 },
                    { name: 'constitution', current: 16 },
                    { name: 'intelligence', current: 10 },
                    { name: 'wisdom', current: 12 },
                    { name: 'charisma', current: 8 },
                    { name: 'hp', current: 42, max: 42 },
                    { name: 'hp_max', current: 42 },
                    { name: 'ac', current: 18 },
                    { name: 'speed', current: 30 },
                    { name: 'class', current: 'Fighter' },
                    { name: 'level', current: 4 },
                    { name: 'race', current: 'Mountain Dwarf' }
                ]
            }
        };

        // 1. Detection
        assert.equal(isRoll20CharacterJson(mockRoll20Data), true);
        assert.equal(isRoll20CharacterJson({ name: 'Standard' }), false);

        // 2. Image URL normalization
        const normalizedImg = normalizeRoll20ImageUrl(mockRoll20Data.character.attributes.avatar);
        assert.equal(normalizedImg, 'https://files.d20.io/images/12345/kragor.png');

        // 3. Conversion
        const converted = await convertRoll20Character(mockRoll20Data, 'test_camp_roll20', {
            skipImageDownload: true
        });

        assert.equal(converted.name, 'Kragor Ironbreaker');
        assert.equal(converted.hpMax, 42);
        assert.equal(converted.ac, 18);
        assert.equal(converted.speed.walk, 30);
        assert.equal(converted.stats.str, 18);
        assert.equal(converted.stats.dex, 14);
        assert.equal(converted.stats.con, 16);
    });

    // =========================================================================
    // GROUP 4: ASSET UPLOADS, PERMISSIONS & SECURITY
    // =========================================================================
    await t.test('8. Asset Path Traversal Security: blocks traversal escapes outside ASSETS_DIR', async () => {
        const evilEscapes = [
            path.join(ASSETS_DIR, '../../secret.txt'),
            path.join(ASSETS_DIR, '..', '..', 'etc', 'passwd'),
            path.join(ASSETS_DIR, 'subfolder', '..', '..', '..', 'root')
        ];

        for (const escapePath of evilEscapes) {
            const isValid = isValidAssetPath(escapePath, ASSETS_DIR);
            assert.equal(isValid, false, `Path "${escapePath}" must be flagged as invalid traversal`);
        }
    });

    await t.test('9. Asset Upload: GM uploads file into custom folder', async () => {
        // Create synthetic PNG payload using FormData
        const formData = new FormData();
        const fakePngBlob = new Blob(['\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRTESTIMAGE'], { type: 'image/png' });
        formData.append('file', fakePngBlob, 'test-token.png');

        const res = await fetch(`${baseUrl}/api/assets/upload?folderPath=tokens/test_monsters`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.count, 1);
        assert.match(data.url, /^\/assets\/tokens\/test_monsters\/test-token\.png$/);

        // Verify physical file was created in ASSETS_DIR/tokens/test_monsters/test-token.png
        const targetOnDisk = path.join(ASSETS_DIR, 'tokens', 'test_monsters', 'test-token.png');
        assert.ok(fs.existsSync(targetOnDisk), 'Uploaded asset file must exist on disk');

        // Cleanup created file
        fs.unlinkSync(targetOnDisk);
    });

    await t.test('10. Player Upload Sandboxing: forces player uploads into /players directory', async () => {
        const formData = new FormData();
        const fakeBlob = new Blob(['FAKEDATA'], { type: 'image/png' });
        formData.append('file', fakeBlob, 'player-avatar.png');

        // Send WITH active player session token (no GM authorization) and attempt to target 'admin_folder'
        const playerToken = generatePlayerSessionToken({ campaignId: 'default', username: 'Alice' });
        const res = await fetch(`${baseUrl}/api/assets/upload?folderPath=admin_folder`, {
            method: 'POST',
            headers: {
                'x-forwarded-for': '203.0.113.195', // simulate non-loopback player
                'x-player-token': playerToken
            },
            body: formData
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);

        // Must be quarantined into /players regardless of requested folderPath
        assert.match(data.url, /^\/assets\/players\/player-avatar\.png$/);

        const targetOnDisk = path.join(ASSETS_DIR, 'players', 'player-avatar.png');
        assert.ok(fs.existsSync(targetOnDisk));
        fs.unlinkSync(targetOnDisk);
    });

    await t.test('11. Filename Sanitization: neutralizes illegal characters', async () => {
        const formData = new FormData();
        const fakeBlob = new Blob(['SANITIZEME'], { type: 'image/png' });
        formData.append('file', fakeBlob, 'evil_bad:file*name?.png');

        const res = await fetch(`${baseUrl}/api/assets/upload`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);

        // Colons, asterisks, and question marks must be converted to underscores
        assert.equal(data.name, 'evil_bad_file_name_.png');

        const targetOnDisk = path.join(ASSETS_DIR, 'evil_bad_file_name_.png');
        if (fs.existsSync(targetOnDisk)) fs.unlinkSync(targetOnDisk);
    });

    await t.test('12. External URL Asset: registers and deletes media URL', async () => {
        // Register URL from allowed media domain
        const res = await fetch(`${baseUrl}/api/assets/url`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                url: 'https://i.pinimg.com/736x/d4/af/37/d4af37castle.jpg',
                name: 'Castle Ruins'
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.name, 'Castle Ruins');

        // Delete registered asset
        const delRes = await fetch(`${baseUrl}/api/assets/delete`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                isUrl: true,
                name: 'Castle Ruins',
                url: data.url
            })
        });

        assert.equal(delRes.status, 200);
        const delData = await delRes.json();
        assert.equal(delData.success, true);
    });
});
