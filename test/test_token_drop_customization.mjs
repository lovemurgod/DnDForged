// Test Suite: Token-Canvas Customization (Bestiary, Custom NPCs, Companions)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import {
    DEFAULT_TOKEN_DROP_CONFIG,
    DISPOSITION_COLORS,
    parseHpFormula,
    evaluateMonsterHp,
    resolveDuplicateTokenName,
    resolveDispositionColor,
    getTokenDropConfig,
    saveTokenDropConfig
} from '../vtt/js/canvas/tokens/vtt-canvas-token-drop-config.js';

test('DEFAULT_TOKEN_DROP_CONFIG has separate sections with expected defaults', () => {
    assert.ok(DEFAULT_TOKEN_DROP_CONFIG.bestiary, 'Should have bestiary section');
    assert.ok(DEFAULT_TOKEN_DROP_CONFIG.customNpc, 'Should have customNpc section');
    assert.ok(DEFAULT_TOKEN_DROP_CONFIG.companion, 'Should have companion section');

    // Bestiary defaults
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.bestiary.hpMode, 'average');
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.bestiary.importSenses, true);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.bestiary.autoNumberDuplicates, true);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.bestiary.defaultHidden, false);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.bestiary.autoRollInitiative, false);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.bestiary.dispositionRing, 'hostile');

    // Custom NPC defaults
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.customNpc.hpMode, 'average');
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.customNpc.importSenses, true);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.customNpc.autoNumberDuplicates, false);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.customNpc.dispositionRing, 'neutral');

    // Companion defaults
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.companion.hpMode, 'average');
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.companion.importSenses, true);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.companion.autoNumberDuplicates, false);
    assert.equal(DEFAULT_TOKEN_DROP_CONFIG.companion.dispositionRing, 'friendly');
});

test('parseHpFormula parses standard and compound D&D dice expressions correctly', () => {
    const f1 = parseHpFormula('13d12 + 39');
    assert.equal(f1.count, 13);
    assert.equal(f1.die, 12);
    assert.equal(f1.modifier, 39);

    const f2 = parseHpFormula('3d8');
    assert.equal(f2.count, 3);
    assert.equal(f2.die, 8);
    assert.equal(f2.modifier, 0);

    const f3 = parseHpFormula('2d6-2');
    assert.equal(f3.count, 2);
    assert.equal(f3.die, 6);
    assert.equal(f3.modifier, -2);

    // Compound formula with multiple modifiers: 9d8 + 18 + 20
    const f4 = parseHpFormula('9d8 + 18 + 20');
    assert.equal(f4.count, 9);
    assert.equal(f4.die, 8);
    assert.equal(f4.modifier, 38);

    // Compound formula with multiple dice terms: 2d8 + 1d6 + 3
    const f5 = parseHpFormula('2d8 + 1d6 + 3');
    assert.equal(f5.dice.length, 2);
    assert.equal(f5.modifier, 3);

    const f6 = parseHpFormula('invalid');
    assert.equal(f6, null);

    const f7 = parseHpFormula(null);
    assert.equal(f7, null);
});

test('evaluateMonsterHp resolves average, max, and rolled HP accurately for standard and compound expressions', () => {
    const monster = {
        name: 'Hill Giant',
        hp: 105,
        hpFormula: '10d12 + 40'
    };

    // 1. Average HP
    const avg = evaluateMonsterHp(monster, 'average');
    assert.equal(avg.hp, 105);
    assert.equal(avg.maxHp, 105);
    assert.equal(avg.rollDetails, null);

    // 2. Max HP: 10 * 12 + 40 = 160
    const max = evaluateMonsterHp(monster, 'max');
    assert.equal(max.hp, 160);
    assert.equal(max.maxHp, 160);
    assert.equal(max.rollDetails?.type, 'max');
    assert.equal(max.rollDetails?.result, 160);

    // 3. Roll HP: min 10*1 + 40 = 50, max 10*12 + 40 = 160
    for (let i = 0; i < 20; i++) {
        const rolled = evaluateMonsterHp(monster, 'roll');
        assert.ok(rolled.hp >= 50 && rolled.hp <= 160, `Rolled HP ${rolled.hp} out of bounds [50, 160]`);
        assert.equal(rolled.maxHp, rolled.hp);
        assert.equal(rolled.rollDetails?.type, 'roll');
        assert.equal(rolled.rollDetails?.rolls.length, 10);
    }

    // 4. Compound monster: 9d8 + 18 + 20 (Max = 9*8 + 38 = 110)
    const compoundMonster = {
        name: 'Doty X',
        hp: 75,
        hpFormula: '9d8 + 18 + 20'
    };
    const compMax = evaluateMonsterHp(compoundMonster, 'max');
    assert.equal(compMax.hp, 110);
});

test('resolveDuplicateTokenName numbers duplicate creature tokens sequentially and avoids repeating trailing numbers', () => {
    // Empty map with plain name -> Goblin 1
    assert.equal(resolveDuplicateTokenName('Goblin', {}), 'Goblin 1');

    // Empty map with already numbered name -> preserves Goblin 1 without double-suffixing
    assert.equal(resolveDuplicateTokenName('Goblin 1', {}), 'Goblin 1');

    // One unnumbered Goblin -> next is Goblin 2
    const tokens1 = {
        t1: { name: 'Goblin' }
    };
    assert.equal(resolveDuplicateTokenName('Goblin', tokens1), 'Goblin 2');
    assert.equal(resolveDuplicateTokenName('Goblin 1', tokens1), 'Goblin 2');

    // Existing Goblin 1 and Goblin 2 -> next is Goblin 3
    const tokens2 = {
        t1: { name: 'Goblin 1' },
        t2: { name: 'Goblin 2' },
        t3: { name: 'Orc 1' }
    };
    assert.equal(resolveDuplicateTokenName('Goblin', tokens2), 'Goblin 3');
    assert.equal(resolveDuplicateTokenName('Goblin 1', tokens2), 'Goblin 3');

    // Preserves other names
    assert.equal(resolveDuplicateTokenName('Skeleton', tokens2), 'Skeleton 1');
});

test('resolveDispositionColor maps hostile, neutral, and friendly to designated colors', () => {
    assert.equal(resolveDispositionColor('hostile'), '#ef4444');
    assert.equal(resolveDispositionColor('neutral'), '#eab308');
    assert.equal(resolveDispositionColor('friendly'), '#22c55e');
    assert.equal(resolveDispositionColor('none'), null);
    assert.equal(resolveDispositionColor('custom', '#9333ea'), '#9333ea');
});

test('getTokenDropConfig and saveTokenDropConfig persist across campaign state and mock localStorage', () => {
    const mockStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k)
    };

    const mockVtt = {
        campaignState: {
            settings: {}
        },
        socket: {
            emitted: [],
            emit(evt, data) {
                this.emitted.push({ evt, data });
            }
        }
    };

    // Initial read returns defaults
    const initial = getTokenDropConfig('bestiary', mockVtt);
    assert.equal(initial.hpMode, 'average');
    assert.equal(initial.dispositionRing, 'hostile');

    // Save customized profile
    const customConfig = {
        bestiary: {
            ...DEFAULT_TOKEN_DROP_CONFIG.bestiary,
            hpMode: 'roll',
            dispositionRing: 'custom',
            customRingColor: '#6366f1'
        },
        customNpc: { ...DEFAULT_TOKEN_DROP_CONFIG.customNpc },
        companion: { ...DEFAULT_TOKEN_DROP_CONFIG.companion }
    };

    saveTokenDropConfig(customConfig, mockVtt);

    // Verify campaign settings updated
    assert.equal(mockVtt.campaignState.settings.tokenDrop.bestiary.hpMode, 'roll');
    assert.equal(mockVtt.campaignState.settings.tokenDrop.bestiary.customRingColor, '#6366f1');

    // Verify socket emitted
    assert.equal(mockVtt.socket.emitted.length, 1);
    assert.equal(mockVtt.socket.emitted[0].evt, 'settings:update');

    // Verify localStorage fallback
    const savedLocal = JSON.parse(mockStorage.get('vtt_token_drop_settings'));
    assert.equal(savedLocal.bestiary.hpMode, 'roll');

    // Retrieve single section
    const retrieved = getTokenDropConfig('bestiary', mockVtt);
    assert.equal(retrieved.hpMode, 'roll');
    assert.equal(retrieved.customRingColor, '#6366f1');
});

test('Dual-source fallback in getTokenDropConfig reads from canvasEngine.campaignSettings', () => {
    const mockVttWithoutState = {
        canvasEngine: {
            campaignSettings: {
                tokenDrop: {
                    bestiary: {
                        ...DEFAULT_TOKEN_DROP_CONFIG.bestiary,
                        hpMode: 'max'
                    }
                }
            }
        }
    };
    const cfg = getTokenDropConfig('bestiary', mockVttWithoutState);
    assert.equal(cfg.hpMode, 'max', 'Should read from canvasEngine.campaignSettings if campaignState is absent');
});

test('Socket sync updates vtt.campaignState.settings on settings:updated', () => {
    const syncCode = fs.readFileSync(path.resolve('vtt/js/canvas/vtt-canvas-socket-sync.js'), 'utf8');
    assert.ok(
        syncCode.includes('vtt.campaignState.settings = data.settings;'),
        'Socket sync must mirror settings into vtt.campaignState.settings'
    );
});

test('Initiative calculation includes DEX tiebreaker rule', () => {
    const bridgeCode = fs.readFileSync(path.resolve('vtt/js/vtt-data-bridge.js'), 'utf8');
    assert.ok(
        bridgeCode.includes('vtt?.campaignState?.settings?.initDexTiebreaker !== false'),
        'Initiative auto-roll must check initDexTiebreaker'
    );
    assert.ok(
        bridgeCode.includes('Math.round(dexScore) / 100'),
        'Initiative auto-roll must apply DEX / 100 tiebreaker calculation'
    );
});

test('Strict baseline vision override in vtt-data-bridge sets 5 ft when importSenses is false', () => {
    const bridgeCode = fs.readFileSync(path.resolve('vtt/js/vtt-data-bridge.js'), 'utf8');
    // Monster drop handler
    assert.ok(
        bridgeCode.includes(
            'const resolvedSight = dropConfig.importSenses !== false ? parseMonsterVision(data.monsterData) : 5;'
        ),
        'Bestiary drop must enforce 5 ft baseline when importSenses is false'
    );
    // Player/NPC drop handler
    assert.ok(
        bridgeCode.includes(
            'if (dropConfig && dropConfig.importSenses === false) {\n                    resolvedSight = 5;'
        ),
        'Player/NPC/Companion drop must prioritize importSenses === false with 5 ft baseline'
    );
    // Center spawns
    assert.ok(
        bridgeCode.includes('const sightRange = dropConfig.importSenses === false\n            ? 5'),
        bridgeCode.includes(
            'dropConfig.importSenses !== false ? parseMonsterVision(monster.monsterData || monster) : 5'
        ),
        'spawnCustomNpcAtCenter must enforce 5 ft baseline when importSenses is false'
    );
    assert.ok(
        bridgeCode.includes(
            'if (dropConfig && dropConfig.importSenses === false) {\n            sightRange = 5;\n        }'
        ),
        'spawnCharacterAtCenter must enforce 5 ft baseline when importSenses is false'
    );
});

test('vtt/index.html contains settings cogs in Bestiary, Custom NPC, and Companion sections', () => {
    const htmlPath = path.resolve('vtt/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Bestiary cog button
    assert.ok(
        html.includes('id="btn-bestiary-token-settings"'),
        'Bestiary section must include #btn-bestiary-token-settings'
    );

    // Custom NPC cog button
    assert.ok(
        html.includes('id="btn-custom-npc-token-settings"'),
        'Custom NPC section must include #btn-custom-npc-token-settings'
    );

    // Companion cog button
    assert.ok(
        html.includes('id="btn-companion-token-settings"'),
        'Companion section must include #btn-companion-token-settings'
    );

    // Modal markup
    assert.ok(html.includes('id="modal-token-drop-settings"'), 'Must include #modal-token-drop-settings');
    assert.ok(html.includes('id="btn-save-token-drop-settings"'), 'Must include save button');
    assert.ok(html.includes('id="btn-reset-token-drop-settings"'), 'Must include reset button');
});

test('Modal DOM initializes and tab switching functions correctly', () => {
    const htmlPath = path.resolve('vtt/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const modal = doc.getElementById('modal-token-drop-settings');
    assert.ok(modal, 'Modal element should exist in DOM');

    const tabBtns = modal.querySelectorAll('.token-drop-tab-btn');
    assert.equal(tabBtns.length, 3, 'Should have 3 section tabs (Bestiary, Custom NPCs, Companions)');

    const panels = modal.querySelectorAll('.token-drop-panel');
    assert.equal(panels.length, 3, 'Should have 3 section panels');

    // Verify all control inputs exist for bestiary
    assert.ok(doc.getElementById('td-bestiary-hp-mode'), 'Bestiary HP mode select should exist');
    assert.ok(doc.getElementById('td-bestiary-hp-chat'), 'Bestiary HP chat toggle should exist');
    assert.ok(doc.getElementById('td-bestiary-import-senses'), 'Bestiary senses toggle should exist');
    assert.ok(doc.getElementById('td-bestiary-autonumber'), 'Bestiary autonumber toggle should exist');
    assert.ok(doc.getElementById('td-bestiary-hidden'), 'Bestiary hidden toggle should exist');
    assert.ok(doc.getElementById('td-bestiary-auto-init'), 'Bestiary auto-init toggle should exist');
    assert.ok(doc.getElementById('td-bestiary-disposition'), 'Bestiary disposition select should exist');

    // Verify controls exist for custom NPCs
    assert.ok(doc.getElementById('td-customNpc-hp-mode'), 'Custom NPC HP mode select should exist');
    assert.ok(doc.getElementById('td-customNpc-import-senses'), 'Custom NPC senses toggle should exist');

    // Verify controls exist for companions
    assert.ok(doc.getElementById('td-companion-hp-mode'), 'Companion HP mode select should exist');
    assert.ok(doc.getElementById('td-companion-import-senses'), 'Companion senses toggle should exist');
});
