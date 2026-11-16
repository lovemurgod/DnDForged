// Test Suite: Sheet Dock Static Portraits & Monogram Fallbacks for All Sheet Types
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ─── Setup Headless DOM & Global Environment ──────────────────────────────
const dom = new JSDOM(
    `<!DOCTYPE html>
<html>
<body>
    <div id="vtt-slideout-tabs" class="slideout-tabs-container"></div>
    <div id="creature-sheet-panel" class="vtt-hidden"></div>
    <div id="player-sheet-panel" class="vtt-hidden"></div>
    <div id="asset_node_tok_anim" style="width:50px;height:50px;"></div>
</body>
</html>`,
    { url: 'http://localhost' }
);

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.localStorage = dom.window.localStorage;
globalThis.Image = dom.window.Image;

import {
    isAnimatedMedia,
    isVideoMedia,
    getMonogramData,
    StaticPortraitCache,
    initVttSheetDock
} from '../vtt/js/vtt-sheet-dock.js';

test('1. Media format detection: isAnimatedMedia and isVideoMedia', () => {
    // Video formats
    assert.equal(isVideoMedia('tokens/goblin.webm'), true);
    assert.equal(isVideoMedia('tokens/dragon.mp4'), true);
    assert.equal(isVideoMedia('https://pinimg.com/videos/ogre.mp4'), true);
    assert.equal(isVideoMedia('https://youtu.be/xyz123'), true);
    assert.equal(isVideoMedia('tokens/static.png'), false);
    assert.equal(isVideoMedia('tokens/static.jpg'), false);
    assert.equal(isVideoMedia('tokens/static.webp'), false);
    assert.equal(isVideoMedia('tokens/anim.gif'), false);

    // Animated media (includes GIFs and videos)
    assert.equal(isAnimatedMedia('tokens/anim.gif'), true);
    assert.equal(isAnimatedMedia('tokens/goblin.webm'), true);
    assert.equal(isAnimatedMedia('tokens/dragon.mp4'), true);
    assert.equal(isAnimatedMedia('tokens/static.png'), false);
    assert.equal(isAnimatedMedia('tokens/static.webp'), false);
    assert.equal(isAnimatedMedia(null), false);
    assert.equal(isAnimatedMedia(''), false);
});

test('2. getMonogramData generates uppercase initials and role-colored markup', () => {
    const multi = getMonogramData('Goblin Scout', 'generic');
    assert.equal(multi.initials, 'GS');
    assert.equal(multi.roleClass, 'role-generic');
    assert.ok(multi.html.includes('tab-handle-monogram role-generic'));
    assert.ok(multi.html.includes('>GS</div>'));

    const single = getMonogramData('Karlach', 'player');
    assert.equal(single.initials, 'KA');
    assert.equal(single.roleClass, 'role-player');
    assert.ok(multi.html.includes('tab-handle-monogram'));
    assert.ok(single.html.includes('>KA</div>'));

    const oneLetter = getMonogramData('X', 'companion');
    assert.equal(oneLetter.initials, 'X');
    assert.equal(oneLetter.roleClass, 'role-companion');

    const empty = getMonogramData('', 'generic');
    assert.equal(empty.initials, '?');
});

test('3. StaticPortraitCache stores in-memory, persists to localStorage, and evicts LRU', () => {
    const testStorageKey = 'forgedvtt_test_thumbs_' + Date.now();
    const cache = new StaticPortraitCache(3, testStorageKey);

    cache.set('url1', 'data:image/png;base64,111');
    cache.set('url2', 'data:image/png;base64,222');
    cache.set('url3', 'data:image/png;base64,333');

    assert.equal(cache.get('url1'), 'data:image/png;base64,111');
    assert.equal(cache.get('url2'), 'data:image/png;base64,222');
    assert.equal(cache.get('url3'), 'data:image/png;base64,333');

    // Check localStorage persistence
    const raw = globalThis.localStorage.getItem(testStorageKey);
    assert.ok(raw, 'Should persist to localStorage');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.url1.dataUrl, 'data:image/png;base64,111');

    // Add 4th item to trigger LRU eviction (maxEntries = 3)
    cache.set('url4', 'data:image/png;base64,444');
    assert.equal(cache.memoryCache.size, 3, 'Should prune to maxEntries');
    assert.equal(cache.get('url4'), 'data:image/png;base64,444');
});

test('4. SheetDockManager renders static images or monograms, never <video> tags', () => {
    const mockVtt = {
        campaignId: 'camp_static_test',
        campaignState: {
            characters: {
                pc_warrior: {
                    id: 'pc_warrior',
                    name: 'Sir Galahad',
                    avatar: 'img/tokens/warrior.png'
                },
                comp_bear: {
                    id: 'comp_bear',
                    name: 'Barnaby Bear',
                    isCompanion: true,
                    avatar: 'img/tokens/bear.webm' // Animated WebM!
                },
                npc_mystic: {
                    id: 'npc_mystic',
                    name: 'Mystic Seer',
                    isCustomNpc: true,
                    avatar: 'img/tokens/seer.gif' // Animated GIF!
                }
            }
        },
        canvasEngine: {
            getTokens: () => ({
                tok_pc: { characterId: 'pc_warrior', name: 'Sir Galahad', img: 'img/tokens/warrior.png' },
                tok_bear: { characterId: 'comp_bear', name: 'Barnaby Bear', img: 'img/tokens/bear.webm' },
                tok_gob_1: {
                    id: 'tok_gob_1',
                    name: 'Goblin Skirmisher',
                    img: 'img/tokens/goblin.webm', // Animated WebM!
                    monsterData: { name: 'Goblin Skirmisher', source: 'MM' }
                }
            })
        },
        creatureSheet: { openSheet: () => {}, minimizePanel: () => {} },
        playerSheet: { openSheet: () => {}, minimizePanel: () => {} }
    };

    const dock = initVttSheetDock(mockVtt);

    // 1. Open Player Character (Static PNG)
    dock.openSheet({
        type: 'player',
        id: 'pc_warrior',
        name: 'Sir Galahad',
        avatar: 'img/tokens/warrior.png'
    });

    // 2. Open Companion (Animated WebM)
    dock.openSheet({
        type: 'creature',
        characterId: 'comp_bear',
        isCompanion: true,
        name: 'Barnaby Bear',
        avatar: 'img/tokens/bear.webm'
    });

    // 3. Open Custom NPC (Animated GIF)
    dock.openSheet({
        type: 'creature',
        characterId: 'npc_mystic',
        isCustomNpc: true,
        name: 'Mystic Seer',
        avatar: 'img/tokens/seer.gif'
    });

    // 4. Open Generic Bestiary Monster (Animated WebM)
    dock.openSheet({
        type: 'creature',
        name: 'Goblin Skirmisher',
        monsterData: { name: 'Goblin Skirmisher', source: 'MM', tokenUrl: 'img/tokens/goblin.webm' }
    });

    // 5. Open Creature with no image
    dock.openSheet({
        type: 'creature',
        name: 'Shadow Stalker',
        monsterData: { name: 'Shadow Stalker', source: 'MM' }
    });

    // Verify DOM: Must NOT have any <video> elements!
    const videoElements = dock.containerEl.querySelectorAll('video');
    assert.equal(videoElements.length, 0, 'No <video> elements may ever exist in sheet dock buttons');

    // Check Player Character handle: should render <img> with warrior.png
    const pcWrapper = dock.containerEl.querySelector('.slideout-tab-wrapper[data-tab-key="pc_warrior"]');
    assert.ok(pcWrapper, 'Player wrapper exists');
    const pcImg = pcWrapper.querySelector('img.tab-handle-avatar');
    assert.ok(pcImg, 'Player tab renders <img> thumbnail');
    assert.equal(pcImg.getAttribute('src'), 'img/tokens/warrior.png');

    // Check error fallback on image: dispatching 'error' dynamically replaces <img> with monogram
    pcImg.dispatchEvent(new dom.window.Event('error'));
    const pcMonogram = pcWrapper.querySelector('.tab-handle-monogram.role-player');
    assert.ok(pcMonogram, 'Image error replaces <img> with role-player monogram');
    assert.equal(pcMonogram.textContent, 'SG');

    // Check Companion with WebM: Uncached animated video renders role-companion monogram badge
    const bearWrapper = dock.containerEl.querySelector('.slideout-tab-wrapper[data-tab-key="comp_bear"]');
    assert.ok(bearWrapper, 'Companion wrapper exists');
    const bearMonogram = bearWrapper.querySelector('.tab-handle-monogram.role-companion');
    assert.ok(bearMonogram, 'Companion with WebM renders role-companion monogram before cached');
    assert.equal(bearMonogram.textContent, 'BB');

    // Check Custom NPC with GIF: Uncached animated GIF renders role-companion monogram badge
    const mysticWrapper = dock.containerEl.querySelector('.slideout-tab-wrapper[data-tab-key="npc_mystic"]');
    assert.ok(mysticWrapper, 'Custom NPC wrapper exists');
    const mysticMonogram = mysticWrapper.querySelector('.tab-handle-monogram.role-companion');
    assert.ok(mysticMonogram, 'Custom NPC with GIF renders monogram badge');
    assert.equal(mysticMonogram.textContent, 'MS');

    // Check Shadow Stalker with no image: renders role-generic monogram badge
    const shadowWrapper = dock.containerEl.querySelector('.slideout-tab-wrapper[data-tab-key="gen_mm_shadow_stalker"]');
    assert.ok(shadowWrapper, 'Shadow stalker wrapper exists');
    const shadowMonogram = shadowWrapper.querySelector('.tab-handle-monogram.role-generic');
    assert.ok(shadowMonogram, 'Creature with no image renders role-generic monogram badge');
    assert.equal(shadowMonogram.textContent, 'SS');

    // Test cached resolution: when cache has entry, it renders <img>
    dock.portraitCache.set('img/tokens/bear.webm', 'data:image/png;base64,cached_bear_16x16');
    dock.renderTabs();

    const updatedBearWrapper = dock.containerEl.querySelector('.slideout-tab-wrapper[data-tab-key="comp_bear"]');
    const bearCachedImg = updatedBearWrapper.querySelector('img.tab-handle-avatar');
    assert.ok(bearCachedImg, 'Companion with cached thumbnail now renders <img>');
    assert.equal(bearCachedImg.getAttribute('src'), 'data:image/png;base64,cached_bear_16x16');
});

test('5. Multi-token instance switcher updates active token and portrait', () => {
    const mockVtt = {
        campaignId: 'camp_instance_test',
        campaignState: { characters: {} },
        canvasEngine: {
            getTokens: () => ({
                tok_gob_1: {
                    id: 'tok_gob_1',
                    name: 'Goblin Scout',
                    img: 'img/tokens/goblin1.png',
                    monsterData: { name: 'Goblin Scout' }
                },
                tok_gob_2: {
                    id: 'tok_gob_2',
                    name: 'Goblin Scout',
                    img: 'img/tokens/goblin2.png',
                    monsterData: { name: 'Goblin Scout' }
                }
            })
        },
        creatureSheet: { openSheet: () => {}, minimizePanel: () => {} },
        playerSheet: { openSheet: () => {}, minimizePanel: () => {} }
    };

    const dock = initVttSheetDock(mockVtt);

    const tab = dock.openSheet({
        type: 'creature',
        name: 'Goblin Scout',
        tokenId: 'tok_gob_1',
        isGeneric: true,
        monsterData: { name: 'Goblin Scout' }
    });

    assert.equal(tab.activeTokenId, 'tok_gob_1');
    assert.equal(tab.avatar, 'img/tokens/goblin1.png');

    // Switch instance to tok_gob_2
    dock.switchTokenInstance(tab.key, 'tok_gob_2');

    assert.equal(tab.activeTokenId, 'tok_gob_2');
    assert.equal(tab.avatar, 'img/tokens/goblin2.png');
    const wrap = dock.containerEl.querySelector(`[data-tab-key="${tab.key}"]`);
    const img = wrap.querySelector('img.tab-handle-avatar');
    assert.equal(img.getAttribute('src'), 'img/tokens/goblin2.png');
});

test('6. Name with quotes and apostrophes escapes safely without syntax errors', () => {
    const mockVtt = {
        campaignId: 'camp_quotes_test',
        campaignState: { characters: {} },
        canvasEngine: { getTokens: () => ({}) },
        creatureSheet: { openSheet: () => {}, minimizePanel: () => {} },
        playerSheet: { openSheet: () => {}, minimizePanel: () => {} }
    };

    const dock = initVttSheetDock(mockVtt);

    // Name with apostrophe and quotes
    const tab = dock.openSheet({
        type: 'creature',
        name: 'Ol\' Grog "The Smasher"',
        avatar: 'invalid/broken_url.png',
        monsterData: { name: 'Ol\' Grog "The Smasher"' }
    });

    const wrap = dock.containerEl.querySelector(`[data-tab-key="${tab.key}"]`);
    assert.ok(wrap, 'Wrapper with complex name exists');
    const img = wrap.querySelector('img.tab-handle-avatar');
    assert.ok(img, 'Image rendered');

    // Trigger error event to replace with monogram
    img.dispatchEvent(new dom.window.Event('error'));
    const monogram = wrap.querySelector('.tab-handle-monogram');
    assert.ok(monogram, 'Monogram rendered safely');
    assert.equal(monogram.textContent, 'OG');
});
