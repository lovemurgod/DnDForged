import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Regression Fix 1: GM session token 60s grace period on socket disconnect', async (t) => {
    const socketCode = fs.readFileSync(path.join(rootDir, 'server', 'socket.js'), 'utf8');

    // Confirm that disconnect does not immediately activeGmTokens.delete
    assert.match(
        socketCode,
        /socket\.on\('disconnect',\s*\(\)\s*=>\s*\{[^}]*setTimeout\(\s*\(\)\s*=>\s*\{[^}]*activeGmTokens\.delete\(tokenToPurge\)/s,
        'Disconnect must use grace period setTimeout before deleting GM session token'
    );
    assert.match(socketCode, /60000/, 'Grace period must be 60 seconds (60000ms)');
});

test('Regression Fix 2: token:update and token:update_delta cross-map mutation eliminated', async (t) => {
    const socketCode = fs.readFileSync(path.join(rootDir, 'server', 'socket.js'), 'utf8');

    // Ensure we do not loop over all maps overriding mapId if token is not found on requested mapId
    assert.doesNotMatch(
        socketCode,
        /for\s*\(\s*const\s+mId\s+in\s+campaigns\[campaignId\]\.maps\s*\)\s*\{\s*if\s*\(\s*campaigns\[campaignId\]\.maps\[mId\]\.tokens/,
        'Must not contain cross-map fallback loop overriding mapId in token:update handlers'
    );
});

test('Regression Fix 3: Reconnection deduplication and re-sync in vtt-session.js', async (t) => {
    const sessionCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'bootstrap', 'vtt-session.js'), 'utf8');

    // Verify reconnect event does NOT emit join directly (avoiding duplicate join race with connect)
    assert.doesNotMatch(
        sessionCode,
        /socket\.io\.on\('reconnect',\s*\(\)\s*=>\s*\{[^}]*socket\.emit\('join'/,
        'socket.io on reconnect must not duplicate socket.emit join'
    );

    // Verify connect handler handles join and joined handles reconnection re-sync
    assert.match(sessionCode, /socket\.on\('connect'/, 'socket.on connect must exist');
    assert.match(sessionCode, /window\.VTT\.canvasEngine\.syncCampaignState/, 'Reconnection must sync campaign state');
    assert.match(sessionCode, /window\.VTT\.chatEngine\.syncChatHistory/, 'Reconnection must sync chat history');
    assert.match(sessionCode, /window\.VTT\.handoutsEngine\.syncHandouts/, 'Reconnection must sync handouts');
});

test('Regression Fix 4: switchMapTo emits map:request_sync and portal projections use dynamic getters', async (t) => {
    const canvasCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-canvas.js'), 'utf8');

    // switchMapTo must emit map:request_sync to ensure complete map entity synchronization
    assert.match(
        canvasCode,
        /vtt\.socket\.emit\('map:request_sync',\s*\{\s*mapId:\s*targetMapId\s*\}\)/,
        'switchMapTo must emit map:request_sync'
    );

    // renderProjectedPortals must use dynamic getter for currentMapId and currentMap
    assert.match(
        canvasCode,
        /get\s+currentMapId\(\)\s*\{\s*return\s+currentMapId;\s*\}/,
        'renderProjectedPortals must use dynamic getter for currentMapId'
    );
    assert.match(
        canvasCode,
        /get\s+currentMap\(\)\s*\{\s*return\s+vtt\.campaignState\?\.maps\?\.\[currentMapId\];\s*\}/,
        'renderProjectedPortals must use dynamic getter for currentMap'
    );
});

test('Regression Fix 5: Map Manager loadMap delegates to switchMapTo', async (t) => {
    const canvasCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-canvas.js'), 'utf8');

    // Map Manager loadMap option must route to switchMapTo
    assert.match(
        canvasCode,
        /loadMap:\s*\(id\)\s*=>\s*switchMapTo\(id\)/,
        'getMapManagerOptions must route loadMap to switchMapTo'
    );
});

test('Regression Fix 6: syncCampaignState preserves local dragging token while updating map entities', async (t) => {
    const canvasCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-canvas.js'), 'utf8');

    // syncCampaignState must preserve dragTargetId
    assert.match(canvasCode, /dragTargetId\s*&&/i, 'syncCampaignState must guard against overwriting dragTargetId');
    assert.match(canvasCode, /walls\s*=\s*mapData\.walls\s*\|\|\s*\[\]/, 'Walls must be synchronized');
    assert.match(canvasCode, /lights\s*=\s*mapData\.lights\s*\|\|\s*\[\]/, 'Lights must be synchronized');
    assert.match(canvasCode, /traps\s*=\s*Array\.isArray\(mapData\.traps\)/, 'Traps must be synchronized');
    assert.match(canvasCode, /portals\s*=\s*Array\.isArray\(mapData\.portals\)/, 'Portals must be synchronized');
});

test('Regression Fix 7: token:added restores element visibility in socket-sync', async (t) => {
    const syncCode = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'canvas', 'vtt-canvas-socket-sync.js'), 'utf8');

    // token:added must unhide DOM elements if previously set display: none
    assert.match(syncCode, /'asset_node_'\s*\+\s*tokenId/, 'Must check asset node');
    assert.match(syncCode, /offNode\.style\.display\s*=\s*'block'/, 'Must reset display property on unhide');
});
