import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('1. builder-modal.js defines chaMod and calculates 2024 Draconic and Dance Bard AC', () => {
    const file = readFileSync(resolve('vtt/js/player-sheet/builder/builder-modal.js'), 'utf-8');
    assert.match(file, /const\s+chaMod\s*=\s*getMod\(stats\.cha\);/, 'chaMod should be extracted from stats');
    assert.match(
        file,
        /name:\s*`Draconic Resilience \(10 \+ DEX \[\$\{dexMod\}\] \+ CHA \[\$\{chaMod\}\]\)`/,
        'Draconic uses chaMod'
    );
    assert.match(
        file,
        /name:\s*`Dance Bard Unarmored Defense \(10 \+ DEX \[\$\{dexMod\}\] \+ CHA \[\$\{chaMod\}\]\)`/,
        'Dance Bard uses chaMod'
    );
});

test('2. vtt-canvas.js defines single grid accessor pair on syncContext with working setter', () => {
    const file = readFileSync(resolve('vtt/js/vtt-canvas.js'), 'utf-8');
    // Find syncContext block
    const syncContextMatch = file.match(/const syncContext = \{([\s\S]*?)\n\s*\};/);
    assert.ok(syncContextMatch, 'syncContext should exist');
    const syncContextBody = syncContextMatch[1];

    // Count occurrences of 'get grid()' in syncContext
    const gridMatches = syncContextBody.match(/get\s+grid\s*\(\)/g);
    assert.equal(gridMatches?.length, 1, 'syncContext should have exactly 1 get grid() definition');
    assert.match(syncContextBody, /set\s+grid\s*\(v\)\s*\{/, 'syncContext should have set grid(v)');
});

test('3. vtt-canvas-traps.js escapes HTML in renderPlacedTrapsList', () => {
    const file = readFileSync(resolve('vtt/js/canvas/vtt-canvas-traps.js'), 'utf-8');
    assert.match(file, /import\s*\{\s*escapeHtml\s*\}\s*from\s*['"]\.\.\/vtt-utils\.js['"];/, 'escapeHtml is imported');
    assert.match(file, /const\s+safeName\s*=\s*escapeHtml\(trap\.name/, 'trap.name is escaped');
    assert.match(file, /<span>\$\{safeName\}<\/span>/, 'safeName is interpolated into card innerHTML');
});

test('4. vtt-handouts.js sanitizes handout HTML before innerHTML assignment', () => {
    const file = readFileSync(resolve('vtt/js/vtt-handouts.js'), 'utf-8');
    assert.match(file, /sanitizeHtmlContent/, 'sanitizeHtmlContent helper is defined');
    assert.match(
        file,
        /viewDesc\.innerHTML\s*=\s*sanitizeHtmlContent\(handout\.html\);/,
        'viewDesc uses sanitized HTML'
    );
    assert.match(file, /htmlBox\.innerHTML\s*=\s*sanitizeHtmlContent\(item\.html\);/, 'htmlBox uses sanitized HTML');
});

test('5. server/socket.js guards traps:update with GM check', () => {
    const file = readFileSync(resolve('server/socket.js'), 'utf-8');
    const trapHandler = file.match(/socket\.on\('traps:update',[\s\S]*?\n\s*\}\);/);
    assert.ok(trapHandler, 'traps:update handler exists');
    assert.match(trapHandler[0], /if\s*\(socket\.role\s*!==\s*'GM'\)\s*return;/, 'traps:update rejects non-GM sockets');
});

test('6. server/socket.js sanitizes inactive maps for players (no GM tokens, walls, or lights leaked)', () => {
    const file = readFileSync(resolve('server/socket.js'), 'utf-8');
    assert.match(
        file,
        /if\s*\(!activeIds\.has\(mapId\)\)\s*\{[\s\S]*?if\s*\(role\s*!==\s*'GM'\)\s*\{/,
        'inactive maps have separate player sanitization'
    );
    assert.match(file, /safeInactiveTokens\[tId\]\s*=\s*tok;/, 'inactive map tokens filter hidden and GM tokens');
    assert.match(file, /walls:\s*\[\],[\s\S]*?lights:\s*\[\]/, 'inactive map walls and lights stripped for non-GM');
});

test('7. server/socket.js enforces ownership on shapes:update, drawings:update, and initiative:update', () => {
    const file = readFileSync(resolve('server/socket.js'), 'utf-8');

    // shapes:update
    const shapesHandler = file.match(/socket\.on\('shapes:update',[\s\S]*?\n\s*\}\);/);
    assert.ok(shapesHandler, 'shapes:update handler exists');
    assert.match(shapesHandler[0], /if\s*\(role\s*!==\s*'GM'\)\s*\{/, 'shapes:update has non-GM branch');
    assert.match(shapesHandler[0], /ownerUsername:\s*username/, 'shapes:update enforces username ownership');

    // drawings:update
    const drawingsHandler = file.match(/socket\.on\('drawings:update',[\s\S]*?\n\s*\}\);/);
    assert.ok(drawingsHandler, 'drawings:update handler exists');
    assert.match(drawingsHandler[0], /if\s*\(role\s*!==\s*'GM'\)\s*\{/, 'drawings:update has non-GM branch');
    assert.match(drawingsHandler[0], /ownerUsername:\s*username/, 'drawings:update enforces username ownership');

    // initiative:update
    const initHandler = file.match(/socket\.on\('initiative:update',[\s\S]*?\n\s*\}\);/);
    assert.ok(initHandler, 'initiative:update handler exists');
    assert.match(initHandler[0], /if\s*\(role\s*===\s*'GM'\)\s*\{/, 'initiative:update distinguishes GM from player');
    assert.match(
        initHandler[0],
        /isTokenControlledBySocket|isCharacterControlledBySocket/,
        'initiative:update validates combatant control for players'
    );
});

test('8. vtt-canvas-token-renderer.js culls off-screen tokens before sorting zIndex', () => {
    const file = readFileSync(resolve('vtt/js/canvas/tokens/vtt-canvas-token-renderer.js'), 'utf-8');
    const sortPos = file.indexOf('visibleTokens\n        .sort');
    const cullPos = file.indexOf('visibleTokens.push(');
    assert.ok(sortPos > -1, 'visibleTokens.sort exists');
    assert.ok(cullPos > -1, 'visibleTokens.push exists');
    assert.ok(cullPos < sortPos, 'culling must happen before sorting');
});
