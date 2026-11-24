import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import {
    parseCrToNumeric,
    formatCrDisplay,
    formatAbilityModifier,
    getCreatureTokenUrl,
    openCreatureSelectorModal
} from '../vtt/js/modals/creature-selector-modal.js';

test('parseCrToNumeric correctly parses all fractional, integer, and object CRs', () => {
    assert.equal(parseCrToNumeric(0), 0);
    assert.equal(parseCrToNumeric('0'), 0);
    assert.equal(parseCrToNumeric('1/8'), 0.125);
    assert.equal(parseCrToNumeric('1/4'), 0.25);
    assert.equal(parseCrToNumeric('1/2'), 0.5);
    assert.equal(parseCrToNumeric('1'), 1);
    assert.equal(parseCrToNumeric('5'), 5);
    assert.equal(parseCrToNumeric(20), 20);
    assert.equal(parseCrToNumeric({ cr: '1/4' }), 0.25);
    assert.equal(parseCrToNumeric({ cr: '3' }), 3);
    assert.equal(parseCrToNumeric(undefined), 0);
    assert.equal(parseCrToNumeric(null), 0);
    assert.equal(parseCrToNumeric('invalid'), 0);
});

test('formatCrDisplay formats plain and object CR values', () => {
    assert.equal(formatCrDisplay('1/4'), '1/4');
    assert.equal(formatCrDisplay(5), '5');
    assert.equal(formatCrDisplay({ cr: '1/2' }), '1/2');
    assert.equal(formatCrDisplay(undefined), '0');
    assert.equal(formatCrDisplay(null), '0');
});

test('formatAbilityModifier returns standard 5e modifiers', () => {
    assert.equal(formatAbilityModifier(10), '+0');
    assert.equal(formatAbilityModifier(11), '+0');
    assert.equal(formatAbilityModifier(12), '+1');
    assert.equal(formatAbilityModifier(14), '+2');
    assert.equal(formatAbilityModifier(16), '+3');
    assert.equal(formatAbilityModifier(18), '+4');
    assert.equal(formatAbilityModifier(20), '+5');
    assert.equal(formatAbilityModifier(8), '-1');
    assert.equal(formatAbilityModifier(7), '-2');
    assert.equal(formatAbilityModifier(1), '-5');
    assert.equal(formatAbilityModifier('invalid'), '+0');
});

test('getCreatureTokenUrl resolves custom image URLs and standard paths', () => {
    assert.equal(getCreatureTokenUrl({ tokenImg: 'custom/token.png' }), 'custom/token.png');
    assert.equal(getCreatureTokenUrl({ tokenUrl: 'custom/url.webp' }), 'custom/url.webp');
    assert.equal(getCreatureTokenUrl({ imgUrl: 'custom/img.jpg' }), 'custom/img.jpg');

    const standardToken = getCreatureTokenUrl({ name: 'Dire Wolf', source: 'MM' });
    assert.ok(standardToken.includes('img/bestiary/tokens/MM/Dire Wolf.webp'));

    assert.equal(getCreatureTokenUrl(null), 'favicon.svg');
});

test('openCreatureSelectorModal renders two-column split modal, filters, sorts, and previews', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: 'http://localhost/'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    const mockMonsters = [
        {
            id: 'wolf',
            name: 'Wolf',
            source: 'MM',
            type: 'beast',
            size: 'M',
            alignment: 'unaligned',
            cr: '1/4',
            hp: { average: 11, formula: '2d8 + 2' },
            ac: [13],
            speed: { walk: 40 },
            str: 12,
            dex: 15,
            con: 12,
            int: 3,
            wis: 12,
            cha: 6,
            action: [{ name: 'Bite', entries: ['Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage.'] }]
        },
        {
            id: 'bear',
            name: 'Brown Bear',
            source: 'MM',
            type: 'beast',
            size: 'L',
            alignment: 'unaligned',
            cr: '1',
            hp: { average: 34, formula: '4d10 + 12' },
            ac: [11],
            speed: { walk: 40, climb: 30 },
            str: 19,
            dex: 10,
            con: 16,
            int: 2,
            wis: 13,
            cha: 7
        },
        {
            id: 'skeleton',
            name: 'Skeleton',
            source: 'MM',
            type: 'undead',
            size: 'M',
            alignment: 'lawful evil',
            cr: '1/4',
            hp: { average: 13, formula: '2d8 + 4' },
            ac: [13],
            str: 10,
            dex: 14,
            con: 15,
            int: 6,
            wis: 8,
            cha: 5
        },
        {
            id: 'adult-red-dragon',
            name: 'Adult Red Dragon',
            source: 'MM',
            type: 'dragon',
            size: 'H',
            alignment: 'chaotic evil',
            cr: '17',
            hp: { average: 256, formula: '19d12 + 133' },
            ac: [19],
            str: 27,
            dex: 10,
            con: 25,
            int: 16,
            wis: 13,
            cha: 21
        }
    ];

    let selectedResult = null;
    let selectedFullResult = null;

    await openCreatureSelectorModal({
        title: 'Add Player Companion',
        confirmLabel: 'Choose Companion',
        confirmIcon: 'fa-paw',
        catalog: mockMonsters,
        onSelect: (monster, fullMonster) => {
            selectedResult = monster;
            selectedFullResult = fullMonster;
        }
    });

    const modal = document.querySelector('.creature-selector-modal');
    assert.ok(modal, 'Modal should be appended to the DOM');

    // Header checks
    const titleEl = modal.querySelector('.creature-selector-title');
    assert.ok(titleEl.textContent.includes('Add Player Companion'));

    // Left pane checks
    const listPane = modal.querySelector('.creature-selector-list-pane');
    assert.ok(listPane, 'List pane must be present');

    // Right preview pane checks
    const previewPane = modal.querySelector('.creature-selector-preview-pane');
    assert.ok(previewPane, 'Preview pane must be present');

    // Rows rendered
    const rows = modal.querySelectorAll('.csm-row');
    assert.equal(rows.length, 4, 'All 4 mock creatures should be initially listed');

    // Sorting: default name ascending
    const names = Array.from(modal.querySelectorAll('.csm-col-name-text')).map((el) => el.textContent.trim());
    assert.deepEqual(names, ['Adult Red Dragon', 'Brown Bear', 'Skeleton', 'Wolf']);

    // Sort by CR
    const crHeader = modal.querySelector('.csm-th-cr');
    crHeader.click();
    const crNamesAsc = Array.from(modal.querySelectorAll('.csm-col-name-text')).map((el) => el.textContent.trim());
    assert.deepEqual(crNamesAsc, ['Skeleton', 'Wolf', 'Brown Bear', 'Adult Red Dragon']);

    // Sort by CR descending
    crHeader.click();
    const crNamesDesc = Array.from(modal.querySelectorAll('.csm-col-name-text')).map((el) => el.textContent.trim());
    assert.deepEqual(crNamesDesc, ['Adult Red Dragon', 'Brown Bear', 'Skeleton', 'Wolf']);

    // Quick Filter by Type: Beast
    const typeSelect = modal.querySelector('#csm-type-sel');
    typeSelect.value = 'beast';
    typeSelect.dispatchEvent(new dom.window.Event('change'));

    const beastNames = Array.from(modal.querySelectorAll('.csm-col-name-text')).map((el) => el.textContent.trim());
    assert.deepEqual(beastNames, ['Brown Bear', 'Wolf']);

    // Filter by CR Max: 1/4 (only Wolf should remain among beasts)
    const crMaxSelect = modal.querySelector('#csm-cr-max');
    crMaxSelect.value = '1/4';
    crMaxSelect.dispatchEvent(new dom.window.Event('change'));

    const wolfOnly = Array.from(modal.querySelectorAll('.csm-col-name-text')).map((el) => el.textContent.trim());
    assert.deepEqual(wolfOnly, ['Wolf']);

    // Preview check: Wolf statblock should be rendered
    const previewBody = modal.querySelector('#csm-preview-body');
    assert.ok(previewBody.textContent.includes('Wolf'), 'Preview pane should contain Wolf name');
    assert.ok(previewBody.textContent.includes('Armor Class'), 'Preview pane should display AC');
    assert.ok(previewBody.textContent.includes('Hit Points'), 'Preview pane should display HP');
    assert.ok(previewBody.textContent.includes('STR'), 'Preview pane should display ability score STR');

    // Stacking Context: Modal must strictly stack above overlay
    const overlayEl = document.querySelector('.creature-selector-overlay');
    assert.ok(overlayEl, 'Overlay should exist in DOM');
    assert.equal(modal.style.zIndex, '3110', 'Modal element must have zIndex 3110 to avoid overlay intercepting clicks');

    // Confirm button click
    const confirmBtn = modal.querySelector('#csm-confirm-btn');
    assert.ok(confirmBtn, 'Confirm button should exist');
    assert.ok(confirmBtn.textContent.includes('Choose Companion'));
    confirmBtn.click();

    assert.equal(selectedResult?.name, 'Wolf');
    assert.ok(!document.querySelector('.creature-selector-modal'), 'Modal should be dismissed on confirmation');
});

test('Search debounce: typing in search input uses debounce and clear button resets instantly', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: 'http://localhost/'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    const mockMonsters = [
        { id: 'wolf', name: 'Wolf', source: 'MM', type: 'beast', cr: '1/4' },
        { id: 'bear', name: 'Brown Bear', source: 'MM', type: 'beast', cr: '1' }
    ];

    await openCreatureSelectorModal({
        catalog: mockMonsters
    });

    const modal = document.querySelector('.creature-selector-modal');
    const searchInput = modal.querySelector('#csm-search-input');
    const searchClear = modal.querySelector('#csm-search-clear');

    searchInput.value = 'Bear';
    searchInput.dispatchEvent(new dom.window.Event('input'));

    // Before debounce timer fires: still showing 2 rows
    assert.equal(modal.querySelectorAll('.csm-row').length, 2);

    // Wait for 120ms debounce
    await new Promise((resolve) => setTimeout(resolve, 130));
    assert.equal(modal.querySelectorAll('.csm-row').length, 1);
    assert.equal(modal.querySelector('.csm-col-name-text').textContent.trim(), 'Brown Bear');

    // Clear search
    searchClear.click();
    assert.equal(modal.querySelectorAll('.csm-row').length, 2);
    assert.equal(searchInput.value, '');

    modal.querySelector('#csm-close-btn').click();
});

test('CSS Cleanliness: modals.css contains exactly one .creature-selector-modal definition block and valid stacking order', () => {
    const modalsCss = fs.readFileSync(path.resolve('vtt/css/components/modals.css'), 'utf8');

    // Ensure no duplicate section definitions
    const headerMatches = modalsCss.match(/Creature Selector Modal \(Companion & Custom NPC Creation\)/g);
    assert.equal(headerMatches ? headerMatches.length : 0, 1, 'modals.css must contain exactly one Creature Selector Modal section');

    // Ensure z-index 3110 is specified for the modal and 3100 for overlay
    assert.ok(
        modalsCss.includes('z-index: 3110 !important;'),
        'modals.css must set z-index: 3110 !important for .creature-selector-modal'
    );
    assert.ok(
        modalsCss.includes('.creature-selector-overlay {\n    z-index: 3100 !important;'),
        'modals.css must set z-index: 3100 !important for .creature-selector-overlay'
    );
});

test('Integration: vtt-player-sheet.js, vtt-data-bridge.js, and vtt-session.js contain creature selector integrations', () => {
    const playerSheetCode = fs.readFileSync(path.resolve('vtt/js/vtt-player-sheet.js'), 'utf8');
    assert.ok(
        playerSheetCode.includes("openCreatureSelectorModal"),
        'vtt-player-sheet.js must import and call openCreatureSelectorModal'
    );
    assert.ok(
        playerSheetCode.includes("title: 'Add Player Companion'"),
        'vtt-player-sheet.js must configure Add Player Companion selector'
    );

    const dataBridgeCode = fs.readFileSync(path.resolve('vtt/js/vtt-data-bridge.js'), 'utf8');
    assert.ok(
        dataBridgeCode.includes("openCreatureSelectorModal"),
        'vtt-data-bridge.js must import and call openCreatureSelectorModal'
    );
    assert.ok(
        dataBridgeCode.includes("title: 'Import Bestiary Template'"),
        'vtt-data-bridge.js must configure Import Bestiary Template selector'
    );

    const sessionCode = fs.readFileSync(path.resolve('vtt/js/bootstrap/vtt-session.js'), 'utf8');
    assert.ok(
        sessionCode.includes("creature-selector-modal.js"),
        'vtt-session.js must load creature-selector-modal.js'
    );

    const modalsCss = fs.readFileSync(path.resolve('vtt/css/components/modals.css'), 'utf8');
    assert.ok(
        modalsCss.includes(".creature-selector-modal"),
        'modals.css must define .creature-selector-modal styles'
    );
    assert.ok(
        modalsCss.includes(".csm-mobile-preview-active"),
        'modals.css must define mobile responsive sliding view styles'
    );
});
