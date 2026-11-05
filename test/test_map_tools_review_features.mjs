import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseDamageFormulaAndType,
    STANDARD_DAMAGE_TYPES,
    populateTargetMapsDropdown
} from '../vtt/js/canvas/vtt-canvas-map-tools.js';

import {
    populateTargetPortalsDropdown,
    computePortalSightFrustum,
    getPortalAperturePoints
} from '../vtt/js/canvas/vtt-canvas-portals.js';

import { handleCardAction } from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';

test('Map Tools Review Features & Fixes', async (t) => {
    await t.test('parseDamageFormulaAndType parses and auto-detects standard 5e damage types', () => {
        // Explicit type
        const res1 = parseDamageFormulaAndType('4d6', 'fire');
        assert.equal(res1.dice, '4d6');
        assert.equal(res1.type, 'fire');

        // Embedded type in formula string
        const res2 = parseDamageFormulaAndType('4d6 piercing', '');
        assert.equal(res2.dice, '4d6');
        assert.equal(res2.type, 'piercing');

        const res3 = parseDamageFormulaAndType('2d10 poison', '');
        assert.equal(res3.dice, '2d10');
        assert.equal(res3.type, 'poison');

        const res4 = parseDamageFormulaAndType('3d8 + 4 radiant', '');
        assert.equal(res4.dice, '3d8 + 4');
        assert.equal(res4.type, 'radiant');

        // Fallback default
        const res5 = parseDamageFormulaAndType('1d4', '');
        assert.equal(res5.dice, '1d4');
        assert.equal(res5.type, 'piercing');
    });

    await t.test('populateTargetMapsDropdown builds options for all campaign maps', () => {
        // Mock DOM select element
        const createdOptions = [];
        const mockSelect = {
            id: 'maptools-portal-target-map',
            innerHTML: '',
            value: '',
            appendChild(opt) {
                createdOptions.push(opt);
            },
            querySelector(sel) {
                return createdOptions.find((o) => `option[value="${o.value}"]` === sel);
            }
        };

        globalThis.document = {
            getElementById(id) {
                if (id === 'maptools-portal-target-map') return mockSelect;
                return null;
            },
            createElement(tag) {
                return { tag, value: '', textContent: '' };
            }
        };

        const campaignState = {
            maps: {
                map_dungeon: { name: 'Dungeon Level 1' },
                map_crypt: { name: 'Catacombs' },
                map_boss: { name: 'Lich Chamber' }
            }
        };

        populateTargetMapsDropdown(campaignState, 'map_dungeon', 'map_crypt');

        assert.equal(createdOptions.length, 3, 'Should have intra-map + 2 external maps');
        assert.equal(createdOptions[0].value, 'map_dungeon', 'First option is intra-map');
        assert.equal(createdOptions[0].textContent, '-- Active Map (Intra-Map) --');
        assert.equal(createdOptions[1].value, 'map_crypt');
        assert.match(createdOptions[1].textContent, /Catacombs/);
        assert.equal(createdOptions[2].value, 'map_boss');
        assert.match(createdOptions[2].textContent, /Lich Chamber/);
        assert.equal(mockSelect.value, 'map_crypt', 'Preserved target map selection');
    });

    await t.test('populateTargetPortalsDropdown shows disabled note when target map has no portals', () => {
        const portalOptions = [];
        const mockPortalSelect = {
            id: 'maptools-portal-target-portal',
            innerHTML: '',
            value: '',
            appendChild(opt) {
                portalOptions.push(opt);
            }
        };

        globalThis.document = {
            getElementById(id) {
                if (id === 'maptools-portal-target-portal') return mockPortalSelect;
                if (id === 'maptools-portal-target-map') return { value: 'map_empty' };
                return null;
            },
            createElement(tag) {
                return { tag, value: '', textContent: '', disabled: false };
            }
        };

        const campaignState = {
            maps: {
                map_empty: { name: 'Empty Map', portals: [] }
            }
        };

        populateTargetPortalsDropdown([], 'map_current', campaignState, null, 'map_empty');

        assert.equal(portalOptions.length, 1);
        assert.equal(portalOptions[0].textContent, '-- No portals on this map --');
        assert.equal(portalOptions[0].disabled, true);
    });

    await t.test('computePortalSightFrustum computes valid aperture frustum for line and circle portals', () => {
        // Line portal
        const linePortal = {
            shape: 'line',
            geom: { x1: 100, y1: 100, x2: 200, y2: 100 }
        };
        const sourceCenter = { x: 150, y: 200 };
        const frustumLine = computePortalSightFrustum(linePortal, sourceCenter, 100);

        assert.ok(Array.isArray(frustumLine), 'Frustum must be an array of points');
        assert.ok(frustumLine.length >= 4, 'Must have at least 4 boundary points');
        assert.deepEqual(frustumLine[0], { x: 100, y: 100 });
        assert.deepEqual(frustumLine[frustumLine.length - 1], { x: 200, y: 100 });

        // Circle portal
        const circlePortal = {
            shape: 'circle',
            geom: { cx: 300, cy: 300, r: 25 }
        };
        const frustumCircle = computePortalSightFrustum(circlePortal, { x: 300, y: 400 }, 60);
        assert.ok(Array.isArray(frustumCircle));
        assert.ok(frustumCircle.length >= 4);
    });

    await t.test('Sprung Trap Chat Card Resolution: targets victim token, applies Full/Half damage, and respects saves', () => {
        const tokens = {
            victim_1: {
                id: 'victim_1',
                name: 'Rogue',
                hp: 30,
                maxHp: 30,
                tempHp: 0
            }
        };

        const vtt = {
            role: 'GM',
            campaignState: {
                maps: { map_1: { tokens } }
            },
            _lastTrapSaves: {}
        };

        const trapCardData = {
            isTrap: true,
            trapId: 'trap_flame',
            tokenId: 'victim_1',
            saveAbility: 'DEX',
            saveDc: 15,
            damage: '10',
            damageType: 'fire',
            damageRoll: { total: 10 }
        };

        // 1. Process fails if save not rolled yet
        const processedBeforeSave = handleCardAction(trapCardData, 'process', {
            vtt,
            tokens,
            selectedTokenIds: new Set()
        });
        assert.equal(processedBeforeSave, false, 'Must require save to be rolled first');
        assert.equal(tokens.victim_1.hp, 30, 'Victim took no damage before save');

        // 2. Full Damage applied directly
        const fullHandled = handleCardAction(trapCardData, 'full', {
            vtt,
            tokens,
            selectedTokenIds: new Set()
        });
        assert.equal(fullHandled, true);
        assert.equal(tokens.victim_1.hp, 20, 'Victim took 10 full fire damage (30 - 10 = 20)');

        // 3. Half Damage applied directly
        const halfHandled = handleCardAction(trapCardData, 'half', {
            vtt,
            tokens,
            selectedTokenIds: new Set()
        });
        assert.equal(halfHandled, true);
        assert.equal(tokens.victim_1.hp, 15, 'Victim took 5 half fire damage (20 - 5 = 15)');

        // 4. Save Passed -> Process applies Half Damage (5 HP)
        vtt._lastTrapSaves['trap_flame_victim_1'] = {
            total: 18,
            dc: 15,
            passed: true
        };
        const passProcessed = handleCardAction(trapCardData, 'process', {
            vtt,
            tokens,
            selectedTokenIds: new Set()
        });
        assert.equal(passProcessed, true);
        assert.equal(tokens.victim_1.hp, 10, 'Victim took 5 half damage on passed save (15 - 5 = 10)');

        // 5. Save Failed -> Process applies Full Damage (10 HP)
        vtt._lastTrapSaves['trap_flame_victim_1'] = {
            total: 11,
            dc: 15,
            passed: false
        };
        const failProcessed = handleCardAction(trapCardData, 'process', {
            vtt,
            tokens,
            selectedTokenIds: new Set()
        });
        assert.equal(failProcessed, true);
        assert.equal(tokens.victim_1.hp, 0, 'Victim took 10 full damage on failed save (10 - 10 = 0)');
    });
});
