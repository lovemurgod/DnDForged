import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure browser globals for module import
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        VTT: {},
        vttPlayerSheetAPI: {
            getSpellMetaStrings: () => ({})
        }
    };
}
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null
    };
}

import { buildSpellcastingHtml, extractSpellcastingStats } from '../vtt/js/creature-sheet/creature-spells.js';
import { saveCompanionEdits } from '../vtt/js/creature-sheet/creature-editor.js';

test('Creature Spells: displays introductory header text when sc.header is a string (Bestiary format)', () => {
    const arcanaloth = {
        name: 'Arcanaloth',
        cr: '12',
        int: 20,
        cha: 17,
        spellcasting: [
            {
                id: 'sc_arcanaloth_0',
                name: 'Innate Spellcasting',
                type: 'innate',
                ability: 'cha',
                dc: 15,
                atkMod: 7,
                header: "The arcanaloth's innate spellcasting ability is Charisma (spell save DC 15). The arcanaloth can innately cast the following spells, requiring no material components:",
                footer: '',
                atWill: [{ name: 'Alter Self' }],
                daily: {},
                will: ['Alter Self']
            },
            {
                id: 'sc_arcanaloth_1',
                name: 'Spellcasting',
                type: 'slot',
                ability: 'int',
                casterLevel: 16,
                dc: 17,
                atkMod: 9,
                header: 'The arcanaloth is a 16th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 17, +9 to hit with spell attacks). The arcanaloth has the following wizard spells prepared:',
                footer: '',
                spellsByLevel: {
                    0: { slots: 0, spells: [{ name: 'Fire Bolt' }] }
                },
                atWill: [],
                daily: {},
                will: []
            }
        ]
    };

    const html = buildSpellcastingHtml(arcanaloth);
    assert.ok(
        html.includes('requiring no material components'),
        'Innate spellcasting header with component exemption is rendered'
    );
    assert.ok(html.includes('The arcanaloth is a 16th-level spellcaster'), 'Spellcaster header text is rendered');
    assert.ok(html.includes('DC 15'), 'DC 15 rendered in header or stats');
    assert.ok(html.includes('DC 17'), 'DC 17 rendered in header or stats');
});

test('Creature Spells: displays psionics introductory text without components for Githyanki', () => {
    const githyanki = {
        name: 'Githyanki Knight',
        cr: '8',
        int: 14,
        spellcasting: [
            {
                id: 'sc_githyanki_0',
                name: 'Innate Spellcasting (Psionics)',
                type: 'innate',
                ability: 'int',
                dc: 13,
                atkMod: 5,
                header: "The githyanki's innate spellcasting ability is Intelligence (spell save DC 13, +5 to hit with spell attacks). It can innately cast the following spells, requiring no components:",
                footer: '',
                atWill: [{ name: 'Mage Hand' }],
                daily: {},
                will: ['Mage Hand']
            }
        ]
    };

    const html = buildSpellcastingHtml(githyanki);
    assert.ok(html.includes('requiring no components'), 'Psionics component exemption text is rendered');
    assert.ok(html.includes('Innate Spellcasting (Psionics)'), 'Block name is rendered');
});

test('Creature Spells: displays introductory header text when sc.headerEntries is an array', () => {
    const customNpc = {
        name: 'Elven Mage',
        cr: '5',
        int: 16,
        spellcasting: [
            {
                id: 'sc_custom_0',
                name: 'Spellcasting',
                type: 'slot',
                ability: 'int',
                casterLevel: 9,
                dc: 14,
                atkMod: 6,
                headerEntries: [
                    'The mage is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks).'
                ],
                spellsByLevel: {
                    0: { slots: 0, spells: [{ name: 'Light' }] }
                }
            }
        ]
    };

    const html = buildSpellcastingHtml(customNpc);
    assert.ok(
        html.includes('The mage is a 9th-level spellcaster'),
        'Array headerEntries is properly formatted and rendered'
    );
});

test('Creature Spells: extractSpellcastingStats extracts DC, Atk, Ability from sc.header string', () => {
    const monster = {
        name: 'Test Caster',
        spellcasting: [
            {
                header: "The creature's innate spellcasting ability is Charisma (spell save DC 16, +8 to hit with spell attacks)."
            }
        ]
    };

    const stats = extractSpellcastingStats(monster);
    assert.equal(stats.dc, 16, 'Extracts DC 16 from header string');
    assert.equal(stats.atk, 8, 'Extracts +8 atk from header string');
    assert.equal(stats.ability, 'CHA', 'Extracts CHA ability from header string');
});

test('Creature Editor: saveCompanionEdits extracts and persists sc.header and sc.headerEntries', () => {
    const mockContent = {
        querySelector: (sel) => {
            if (sel === '#cs-edit-name') return { value: 'Updated Mage' };
            if (sel === '#cs-edit-type') return { value: 'humanoid' };
            if (sel === '#cs-edit-type-custom') return { value: '' };
            if (sel === '#cs-edit-tags') return { value: '' };
            if (sel === '#cs-edit-cr') return { value: '6' };
            if (sel === '#cs-edit-ac') return { value: '15' };
            if (sel === '#cs-edit-ac-from') return { value: 'Mage Armor' };
            if (sel === '#cs-edit-hp') return { value: '45' };
            if (sel === '#cs-edit-hp-formula') return { value: '9d8' };
            if (sel === '#cs-edit-speed') return { value: '30 ft.' };
            if (sel === '#cs-edit-senses') return { value: '' };
            if (sel === '#cs-edit-languages') return { value: 'Common' };
            return { value: '' };
        },
        querySelectorAll: (sel) => {
            if (sel === '#cs-edit-spellcasting-blocks-list .cs-edit-sc-card') {
                return [
                    {
                        querySelector: (subSel) => {
                            if (subSel === '.sc-edit-name') return { value: 'Innate Spellcasting' };
                            if (subSel === '.sc-edit-type') return { value: 'innate' };
                            if (subSel === '.sc-edit-recharge') return { value: 'long_rest' };
                            if (subSel === '.sc-edit-ability') return { value: 'cha' };
                            if (subSel === '.sc-edit-caster-level') return { value: '0' };
                            if (subSel === '.sc-edit-dc') return { value: '15' };
                            if (subSel === '.sc-edit-atk-mod') return { value: '+7' };
                            if (subSel === '.sc-edit-header')
                                return {
                                    value: "The arcanaloth's innate spellcasting ability is Charisma (spell save DC 15). The arcanaloth can innately cast the following spells, requiring no material components:"
                                };
                            return null;
                        },
                        querySelectorAll: (subSel) => []
                    }
                ];
            }
            return [];
        }
    };

    const targetMonster = {
        name: 'Arcanaloth',
        spellcasting: [{ id: 'sc_0', name: 'Innate Spellcasting' }]
    };
    const mockChar = { id: 'char_123', monsterData: targetMonster };
    const mockCtx = {
        getContentEl: () => mockContent,
        getLinkedCharacterId: () => 'char_123',
        getVtt: () => ({
            campaignState: { characters: { char_123: mockChar } },
            socket: { emit: () => {} }
        })
    };

    const origGetElementById = globalThis.document.getElementById;
    globalThis.document.getElementById = (id) => {
        if (id === 'cs-edit-modal-content') return mockContent;
        if (id === 'cs-edit-modal-overlay') return { remove: () => {} };
        return null;
    };

    try {
        saveCompanionEdits(targetMonster, 'char_123', mockCtx);

        assert.ok(targetMonster.spellcasting && targetMonster.spellcasting.length === 1, 'Block is saved');
        const savedBlock = targetMonster.spellcasting[0];
        assert.equal(
            savedBlock.header,
            "The arcanaloth's innate spellcasting ability is Charisma (spell save DC 15). The arcanaloth can innately cast the following spells, requiring no material components:",
            'Header string is preserved'
        );
        assert.deepEqual(
            savedBlock.headerEntries,
            [
                "The arcanaloth's innate spellcasting ability is Charisma (spell save DC 15). The arcanaloth can innately cast the following spells, requiring no material components:"
            ],
            'Header entries array is populated and preserved'
        );
    } finally {
        globalThis.document.getElementById = origGetElementById;
    }
});
