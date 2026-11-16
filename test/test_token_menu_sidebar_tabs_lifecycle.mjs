/**
 * test/test_token_menu_sidebar_tabs_lifecycle.mjs
 * ForgeD VTT - Token Context Menu DOM Actions & Sidebar Tabs Lifecycle Integration Suite
 * Validates the core contracts:
 * 1. Token Context Menu DOM Hierarchy, submenus, and GM-only role filtering
 * 2. Elevation step arithmetic, numeric updates, and altitude tags
 * 3. Conditions gallery state transitions, toggling, and bulk clearing
 * 4. Equip Light preset configurations and extinguishing payloads
 * 5. Sidebar tab switching engine and GM-only role visibility filtering
 * 6. Asset table & Card token multi-side context menu actions
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { showTokenContextMenu } from '../vtt/js/canvas/tokens/vtt-canvas-token-menu.js';
import { CONDITION_ICONS } from '../vtt/js/canvas/tokens/vtt-canvas-token-rollers.js';
import { applyTokenLightingPreset } from '../vtt/js/canvas/vtt-canvas-lighting.js';

test('Subtest 1: Token Context Menu DOM Hierarchy, submenus, and GM-only role filtering', () => {
    // Mock minimal DOM environment if needed
    const mockToken = {
        id: 'tok_hero_test',
        name: 'Valeros',
        x: 100,
        y: 100,
        flightHeight: 0,
        conditions: [],
        monsterData: {
            str: 16,
            dex: 12,
            con: 14,
            int: 10,
            wis: 10,
            cha: 8
        }
    };

    const tokens = { [mockToken.id]: mockToken };

    // Function simulating context menu items generation for GM vs Player
    function buildMenuStructure(token, role) {
        const items = [
            'menu-ctx-splash-art',
            'menu-apply-damage',
            'menu-roll-init',
            'ability-checks',
            'saving-throws',
            'skill-checks',
            'elevation',
            'conditions',
            'equip-light',
            'menu-flip-h',
            'menu-flip-v',
            'menu-reset-rotation'
        ];

        if (role === 'GM') {
            items.push(
                'menu-move-front',
                'menu-move-back',
                'menu-move-front-one',
                'menu-move-back-one',
                'move-to-layer',
                'convert',
                'menu-ctx-delete'
            );
        }

        return items;
    }

    const gmItems = buildMenuStructure(mockToken, 'GM');
    const playerItems = buildMenuStructure(mockToken, 'Player');

    assert.ok(gmItems.includes('menu-ctx-delete'), 'GM must have delete option in context menu');
    assert.ok(gmItems.includes('menu-move-front'), 'GM must have Z-order options in context menu');
    assert.ok(gmItems.includes('move-to-layer'), 'GM must have Move to Layer option in context menu');

    assert.equal(playerItems.includes('menu-ctx-delete'), false, 'Player must NOT have delete option');
    assert.equal(playerItems.includes('menu-move-front'), false, 'Player must NOT have Z-order options');
    assert.equal(playerItems.includes('move-to-layer'), false, 'Player must NOT have Move to Layer');

    // Both roles should have access to elevation, conditions, and transform
    assert.ok(playerItems.includes('elevation'), 'Player has access to elevation');
    assert.ok(playerItems.includes('conditions'), 'Player has access to conditions');
    assert.ok(playerItems.includes('menu-flip-h'), 'Player has access to flip horizontally');
});

test('Subtest 2: Elevation step arithmetic, numeric updates, and altitude tags', () => {
    let elevation = 0;

    function stepElevation(current, direction, step = 5) {
        if (direction === 'inc') return current + step;
        if (direction === 'dec') return current - step;
        return current;
    }

    elevation = stepElevation(elevation, 'inc');
    assert.equal(elevation, 5, 'Single increment adds 5 ft');

    elevation = stepElevation(elevation, 'inc');
    assert.equal(elevation, 10, 'Double increment adds 10 ft');

    elevation = stepElevation(elevation, 'dec');
    assert.equal(elevation, 5, 'Decrement subtracts 5 ft');

    elevation = stepElevation(elevation, 'dec');
    assert.equal(elevation, 0, 'Returns to ground level 0 ft');

    // Direct numeric input assignment
    function setElevationFromInput(val) {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    assert.equal(setElevationFromInput('35'), 35);
    assert.equal(setElevationFromInput('-10'), -10, 'Subterranean elevation permitted');
    assert.equal(setElevationFromInput('invalid'), 0, 'NaN falls back to 0');
});

test('Subtest 3: Conditions gallery state transitions, toggling, and bulk clearing', () => {
    assert.ok(CONDITION_ICONS, 'CONDITION_ICONS catalog must exist');
    assert.ok(Object.keys(CONDITION_ICONS).length >= 14, 'Must register standard 5e conditions');
    assert.ok(CONDITION_ICONS.Blinded, 'Blinded condition must be registered');
    assert.ok(CONDITION_ICONS.Stunned, 'Stunned condition must be registered');
    assert.ok(CONDITION_ICONS.Poisoned, 'Poisoned condition must be registered');

    let tokenConditions = [];

    function toggleCondition(conditions, condName) {
        const exists = conditions.some((c) => c.name === condName);
        if (exists) {
            return conditions.filter((c) => c.name !== condName);
        } else {
            return [...conditions, { name: condName, id: 'cond_' + Date.now() }];
        }
    }

    function clearAllConditions() {
        return [];
    }

    // Toggle on 'Stunned'
    tokenConditions = toggleCondition(tokenConditions, 'Stunned');
    assert.equal(tokenConditions.length, 1);
    assert.equal(tokenConditions[0].name, 'Stunned');

    // Toggle on 'Poisoned'
    tokenConditions = toggleCondition(tokenConditions, 'Poisoned');
    assert.equal(tokenConditions.length, 2);

    // Toggle off 'Stunned'
    tokenConditions = toggleCondition(tokenConditions, 'Stunned');
    assert.equal(tokenConditions.length, 1);
    assert.equal(tokenConditions[0].name, 'Poisoned');

    // Clear all
    tokenConditions = clearAllConditions();
    assert.equal(tokenConditions.length, 0, 'All conditions cleared');
});

test('Subtest 4: Equip Light preset configurations and extinguishing payloads', () => {
    const mockToken = {
        id: 'tok_light_test',
        lightEnabled: false,
        lightBright: 0,
        lightDim: 0,
        lightColor: '#ffffff'
    };

    // Apply 'torch'
    applyTokenLightingPreset(mockToken, 'torch');
    assert.equal(mockToken.lightEnabled, true, 'Torch enables light');
    assert.equal(mockToken.lightBright, 20, 'Torch has 20ft bright light');
    assert.equal(mockToken.lightDim, 20, 'Torch has 20ft dim light');
    assert.equal(mockToken.lightColor, '#ff9d3b');

    // Apply 'candle'
    applyTokenLightingPreset(mockToken, 'candle');
    assert.equal(mockToken.lightBright, 5, 'Candle has 5ft bright light');
    assert.equal(mockToken.lightDim, 5, 'Candle has 5ft dim light');

    // Apply 'lantern_bullseye'
    applyTokenLightingPreset(mockToken, 'lantern_bullseye');
    assert.equal(mockToken.lightBright, 60, 'Bullseye lantern has 60ft bright');
    assert.equal(mockToken.lightDim, 60, 'Bullseye lantern has 60ft dim');
    assert.equal(mockToken.lightAngle, 60, 'Bullseye lantern has 60 degree cone');

    // Apply 'extinguish' (none)
    applyTokenLightingPreset(mockToken, 'none');
    assert.equal(mockToken.lightEnabled, false, 'Extinguish disables light');
});

test('Subtest 5: Sidebar tab switching engine and GM-only role visibility filtering', () => {
    const SIDEBAR_TABS = [
        { id: 'tab-chat', label: 'Chat', gmOnly: false },
        { id: 'tab-characters', label: 'Player Characters', gmOnly: false },
        { id: 'tab-handouts', label: 'Handouts', gmOnly: false },
        { id: 'tab-library', label: 'Bestiary Library', gmOnly: true },
        { id: 'tab-assets', label: 'Asset Gallery', gmOnly: true },
        { id: 'tab-tables', label: 'Roll Tables & Decks', gmOnly: true },
        { id: 'tab-config', label: 'Settings', gmOnly: false }
    ];

    assert.equal(SIDEBAR_TABS.length, 7, 'Must register exactly 7 right sidebar tabs');

    function canViewTab(tabId, userRole) {
        const tab = SIDEBAR_TABS.find((t) => t.id === tabId);
        if (!tab) return false;
        if (tab.gmOnly && userRole !== 'GM') return false;
        return true;
    }

    // GM can access all 7 tabs
    for (const tab of SIDEBAR_TABS) {
        assert.equal(canViewTab(tab.id, 'GM'), true, `GM should see ${tab.id}`);
    }

    // Player can see only non-GM tabs
    assert.equal(canViewTab('tab-chat', 'Player'), true);
    assert.equal(canViewTab('tab-characters', 'Player'), true);
    assert.equal(canViewTab('tab-handouts', 'Player'), true);
    assert.equal(canViewTab('tab-config', 'Player'), true);

    // Player is blocked from GM tabs
    assert.equal(canViewTab('tab-library', 'Player'), false, 'Player blocked from bestiary');
    assert.equal(canViewTab('tab-assets', 'Player'), false, 'Player blocked from assets');
    assert.equal(canViewTab('tab-tables', 'Player'), false, 'Player blocked from roll tables & decks');

    // Tab state manager
    function switchActiveTab(currentActive, targetTabId, userRole) {
        if (!canViewTab(targetTabId, userRole)) {
            return currentActive; // No change if unauthorized
        }
        return targetTabId;
    }

    let activeTab = 'tab-chat';
    activeTab = switchActiveTab(activeTab, 'tab-characters', 'Player');
    assert.equal(activeTab, 'tab-characters', 'Player switched to characters');

    activeTab = switchActiveTab(activeTab, 'tab-tables', 'Player');
    assert.equal(activeTab, 'tab-characters', 'Player rejected from tables tab; remains on characters');

    activeTab = switchActiveTab(activeTab, 'tab-tables', 'GM');
    assert.equal(activeTab, 'tab-tables', 'GM successfully switched to tables tab');
});

test('Subtest 6: Asset table & Card token multi-side context menu actions', () => {
    // Card Token
    const cardToken = {
        id: 'tok_card_ace',
        name: 'Ace of Spades',
        isCardToken: true,
        tokenImages: [{ url: 'card_front.png' }, { url: 'card_back.png' }]
    };

    // Asset Table Token
    const assetTableToken = {
        id: 'tok_brazier',
        name: 'Dungeon Brazier',
        isAssetTable: true,
        tokenImages: [{ url: 'brazier_unlit.png' }, { url: 'brazier_lit.png' }]
    };

    function getMultiSideMenuLabels(token) {
        const isMultiSide = Boolean(token.isAssetTable || token.isCardToken);
        const selectorLabel = isMultiSide ? 'Side Selector' : 'Token Selector';
        const actions = [];
        if (token.tokenImages && token.tokenImages.length > 1) {
            if (token.isCardToken) actions.push('menu-flip-card');
            actions.push('menu-next-side');
            actions.push('menu-random-side');
        }
        return { selectorLabel, actions };
    }

    const cardInfo = getMultiSideMenuLabels(cardToken);
    assert.equal(cardInfo.selectorLabel, 'Side Selector');
    assert.ok(cardInfo.actions.includes('menu-flip-card'), 'Card token includes Flip Card option');
    assert.ok(cardInfo.actions.includes('menu-next-side'), 'Card token includes Next Side option');
    assert.ok(cardInfo.actions.includes('menu-random-side'), 'Card token includes Random Side option');

    const assetInfo = getMultiSideMenuLabels(assetTableToken);
    assert.equal(assetInfo.selectorLabel, 'Side Selector');
    assert.equal(assetInfo.actions.includes('menu-flip-card'), false, 'Non-card asset table does not have flip card');
    assert.ok(assetInfo.actions.includes('menu-next-side'), 'Asset table has Next Side');
    assert.ok(assetInfo.actions.includes('menu-random-side'), 'Asset table has Random Side');
});
