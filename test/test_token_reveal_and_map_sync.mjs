import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import getPlayerMapOverride from vtt-utils.js
import { getPlayerMapOverride } from '../vtt/js/vtt-utils.js';

test('[Test 1] getPlayerMapOverride case-insensitive resolution', () => {
    const mockCampaign = {
        playerMapOverrides: {
            Alice: 'map_dungeon',
            Bob_The_Slayer: 'map_crypt'
        }
    };

    assert.strictEqual(getPlayerMapOverride(mockCampaign, 'Alice'), 'map_dungeon');
    assert.strictEqual(getPlayerMapOverride(mockCampaign, 'alice'), 'map_dungeon');
    assert.strictEqual(getPlayerMapOverride(mockCampaign, 'ALICE'), 'map_dungeon');
    assert.strictEqual(getPlayerMapOverride(mockCampaign, 'bob_the_slayer'), 'map_crypt');
    assert.strictEqual(getPlayerMapOverride(mockCampaign, 'BOB_THE_SLAYER'), 'map_crypt');
    assert.strictEqual(getPlayerMapOverride(mockCampaign, 'Charlie'), null);
    assert.strictEqual(getPlayerMapOverride(null, 'Alice'), null);
    assert.strictEqual(getPlayerMapOverride(mockCampaign, null), null);
});

test('[Test 2] vtt-canvas-token-renderer.js guards token.hidden for UI and media', () => {
    const rendererCode = fs.readFileSync(
        path.join(rootDir, 'vtt', 'js', 'canvas', 'tokens', 'vtt-canvas-token-renderer.js'),
        'utf8'
    );

    // Verify isHiddenFromPlayer includes token.hidden
    assert.match(
        rendererCode,
        /isHiddenFromPlayer\s*=\s*[\s\S]*?token\.hidden\s*&&\s*vtt\.role\s*!==\s*'GM'/,
        'isHiddenFromPlayer must check token.hidden'
    );

    // Verify shouldPauseMedia includes token.hidden
    assert.match(
        rendererCode,
        /shouldPauseMedia\s*=\s*[\s\S]*?token\.hidden\s*&&\s*vtt\.role\s*!==\s*'GM'/,
        'shouldPauseMedia must check token.hidden'
    );

    // Verify isVisible UI container includes token.hidden
    assert.match(
        rendererCode,
        /const\s+isVisible\s*=\s*!\s*\(\s*\(\s*tokenLayer\s*===\s*'gm'\s*\|\|\s*token\.isVisible\s*===\s*false\s*\|\|\s*token\.hidden\s*\)\s*&&\s*vtt\.role\s*!==\s*'GM'\s*\);/,
        'isVisible UI container check must include token.hidden'
    );
});

test('[Test 3] Door toggle and walls sync invalidates wallsVersion and token caches', () => {
    const canvasCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-canvas.js'), 'utf8');

    // syncWallSpatialIndex must increment wallsVersion and invalidate token caches
    assert.match(
        canvasCode,
        /function\s+syncWallSpatialIndex[\s\S]*?wallsVersion\+\+[\s\S]*?delete\s+tokens\[id\]\._polyCache[\s\S]*?delete\s+tokens\[id\]\._losPolyCache/,
        'syncWallSpatialIndex must increment wallsVersion and clear token _polyCache & _losPolyCache'
    );

    // syncContext must expose wallsVersion and syncWallSpatialIndex
    assert.match(canvasCode, /get\s+wallsVersion\(\)/, 'syncContext must provide wallsVersion getter');
    assert.match(canvasCode, /syncWallSpatialIndex:\s*\(w,\s*h\)\s*=>\s*syncWallSpatialIndex\(w,\s*h\)/, 'syncContext must provide syncWallSpatialIndex');
});

test('[Test 4] vtt-canvas-socket-sync.js triggers syncWallSpatialIndex on walls:updated and map:request_sync on map:activated', () => {
    const syncCode = fs.readFileSync(
        path.join(rootDir, 'vtt', 'js', 'canvas', 'vtt-canvas-socket-sync.js'),
        'utf8'
    );

    // walls:updated must trigger syncWallSpatialIndex
    assert.match(
        syncCode,
        /socket\.on\('walls:updated'[\s\S]*?ctx\.syncWallSpatialIndex\(\)/,
        'walls:updated must trigger ctx.syncWallSpatialIndex'
    );

    // map:activated must emit map:request_sync
    assert.match(
        syncCode,
        /socket\.on\('map:activated'[\s\S]*?socket\.emit\('map:request_sync',\s*\{\s*mapId\s*\}\)/,
        'map:activated must emit map:request_sync'
    );

    // campaign:state-sync must use getPlayerMapOverride
    assert.match(
        syncCode,
        /getPlayerMapOverride\(camp,\s*vtt\.username\)/,
        'campaign:state-sync must resolve player map override case-insensitively'
    );
});

test('[Test 5] server/socket.js uses getPlayerMapOverride case-insensitively', () => {
    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'socket.js'), 'utf8');

    // getPlayerMapOverride definition must exist
    assert.match(serverCode, /function\s+getPlayerMapOverride\s*\(/, 'getPlayerMapOverride function must be defined');

    // getSanitizedCampaignSync must use getPlayerMapOverride
    assert.match(
        serverCode,
        /getPlayerMapOverride\(camp,\s*username\)/,
        'getSanitizedCampaignSync must use getPlayerMapOverride'
    );
});

