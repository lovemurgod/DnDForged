import assert from 'node:assert/strict';

// Setup mock browser environment
global.window = {
    addEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    innerWidth: 1920,
    innerHeight: 1080
};
global.document = {
    getElementById: (id) => {
        if (id === 'vtt-gm-tooltip-styles') return null;
        if (id === 'vtt-canvas-viewport') {
            return {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
                clientWidth: 1920,
                clientHeight: 1080
            };
        }
        return null;
    },
    createElement: (tag) => {
        return {
            id: '',
            style: {},
            innerHTML: '',
            querySelectorAll: () => [],
            appendChild: () => {},
            remove: () => {}
        };
    },
    head: {
        appendChild: () => {}
    },
    body: {
        appendChild: () => {}
    },
    querySelectorAll: () => []
};

async function runTests() {
    console.log('--- Starting Verification Tests ---');

    // ==========================================
    // 1. Canvas Token Hover Tooltip Test
    // ==========================================
    console.log('[Test 1] Canvas Token Hover Tooltip...');
    const { isTokenTooltipAllowed, showGmTokenTooltip, injectGmTooltipStyles } = await import(
        '../vtt/js/canvas/vtt-canvas-tooltips-notes.js'
    );

    injectGmTooltipStyles(global.document);

    const mockGmToken = {
        id: 'tok_123',
        name: 'Goblin Scout',
        layer: 'token',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        ac: 15,
        speed: 30,
        monsterData: {
            dex: 14,
            wis: 12,
            passive: 13,
            speed: { walk: 30 }
        },
        conditions: [{ name: 'Poisoned' }]
    };

    const mockContext = {
        tokens: { tok_123: mockGmToken },
        activeLayer: 'token',
        selectedTokenIds: new Set(),
        vtt: { role: 'GM' },
        campaignSettings: { gmStatTooltipVisible: 'always' },
        doc: global.document,
        viewport: global.document.getElementById('vtt-canvas-viewport')
    };

    const allowed = isTokenTooltipAllowed(mockGmToken, mockContext);
    assert.equal(allowed, true, 'GM stat tooltip should be allowed for Goblin Scout token');

    let pendingId = null;
    mockContext.setPendingTokenTooltipId = (id) => {
        pendingId = id;
    };

    showGmTokenTooltip('tok_123', false, mockContext);
    assert.equal(pendingId, 'tok_123', 'Pending token tooltip ID should be set to tok_123');
    console.log('? Canvas Token Hover Tooltip passed.');

    // ==========================================
    // 2. Token Context Menu Advantage / Disadvantage Rolls
    // ==========================================
    console.log('[Test 2] Token Context Menu Rolls (Normal, Shift=Adv, Ctrl=Dis, Alt=Dis)...');
    const { rollFromToken } = await import('../vtt/js/canvas/tokens/vtt-canvas-token-rollers.js');

    const emitted = [];
    const mockSocketVtt = {
        socket: {
            emit: (channel, data) => emitted.push({ channel, data })
        },
        role: 'GM',
        username: 'GMCosmic'
    };

    // 2a. Normal Roll
    emitted.length = 0;
    const normalTotal = rollFromToken('1d20+3', 'Goblin: Initiative', 'tok_123', 0.14, {
        vtt: mockSocketVtt,
        optEvent: { shiftKey: false, ctrlKey: false, altKey: false }
    });
    assert.equal(emitted.length, 1);
    assert.match(emitted[0].data.text, /Goblin: Initiative/);
    assert.equal(emitted[0].data.roll.diceList.length, 1);
    assert.equal(emitted[0].data.roll.formula, '1d20+3');
    assert.ok(normalTotal >= 4.14 && normalTotal <= 23.14);

    // 2b. Shift-Click Roll (Advantage)
    emitted.length = 0;
    const advTotal = rollFromToken('1d20+3', 'Goblin: Stealth Check', 'tok_123', 0, {
        vtt: mockSocketVtt,
        optEvent: { shiftKey: true, ctrlKey: false, altKey: false }
    });
    assert.equal(emitted.length, 1);
    assert.match(emitted[0].data.text, /\(Advantage\)/);
    assert.equal(emitted[0].data.roll.formula, '2d20kh1+3');
    assert.equal(emitted[0].data.roll.diceList.length, 2);
    const advDropped = emitted[0].data.roll.diceList.find((d) => d.isDropped);
    const advKept = emitted[0].data.roll.diceList.find((d) => !d.isDropped);
    assert.ok(advDropped, 'One die should be dropped in advantage');
    assert.ok(advKept, 'One die should be kept in advantage');
    assert.ok(advKept.val >= advDropped.val, 'Kept die should be >= dropped die in advantage');
    assert.equal(advTotal, advKept.val + 3);

    // 2c. Ctrl-Click Roll (Disadvantage)
    emitted.length = 0;
    const disTotal = rollFromToken('1d20+3', 'Goblin: DEX Saving Throw', 'tok_123', 0, {
        vtt: mockSocketVtt,
        optEvent: { shiftKey: false, ctrlKey: true, altKey: false }
    });
    assert.equal(emitted.length, 1);
    assert.match(emitted[0].data.text, /\(Disadvantage\)/);
    assert.equal(emitted[0].data.roll.formula, '2d20kl1+3');
    assert.equal(emitted[0].data.roll.diceList.length, 2);
    const disDropped = emitted[0].data.roll.diceList.find((d) => d.isDropped);
    const disKept = emitted[0].data.roll.diceList.find((d) => !d.isDropped);
    assert.ok(disDropped, 'One die should be dropped in disadvantage');
    assert.ok(disKept, 'One die should be kept in disadvantage');
    assert.ok(disKept.val <= disDropped.val, 'Kept die should be <= dropped die in disadvantage');
    assert.equal(disTotal, disKept.val + 3);

    // 2d. Alt-Click Roll (Disadvantage)
    emitted.length = 0;
    const altTotal = rollFromToken('1d20+2', 'Goblin: Initiative', 'tok_123', 0.14, {
        vtt: mockSocketVtt,
        optEvent: { shiftKey: false, ctrlKey: false, altKey: true }
    });
    assert.equal(emitted.length, 1);
    assert.match(emitted[0].data.text, /\(Disadvantage\)/);
    assert.equal(emitted[0].data.roll.formula, '2d20kl1+2');
    console.log('? Token Context Menu Advantage/Disadvantage Rolls passed.');

    // ==========================================
    // 3. Player Character Sheet Spell Chat Card Tests
    // ==========================================
    console.log('[Test 3] Player Character Sheet Spell Chat Cards...');
    const sm = await import('../vtt/js/vtt-spell-manager.js');
    sm.initVttSpellManager(mockSocketVtt);

    const testChar = {
        name: 'Cosmic',
        level: 5,
        stats: { int: 16, wis: 12, cha: 10, dex: 14, con: 12, str: 10 },
        spellAbility: 'INT'
    };

    // Spell with Save DC and Damage (like Acid Splash)
    const spellWithSave = {
        name: 'Acid Splash',
        description: 'You throw a bubble of acid.',
        saveAbility: 'DEX',
        saveDcStat: 'spell',
        damageList: [{ formula: '1d6', type: 'Acid' }]
    };

    emitted.length = 0;
    sm.rollSpell(spellWithSave, 'cantrip', testChar, { type: 'roll' });
    assert.equal(emitted.length, 1);
    const card = emitted[0].data.macroCard;
    assert.ok(card, 'macroCard must be produced for spell roll');
    assert.equal(card.charName, 'Cosmic');
    assert.equal(card.macroName, 'Acid Splash');
    assert.equal(card.description, '', 'Roll card should remain compact without full text description');
    assert.ok(card.saveInfo, 'Save info must be present');
    assert.equal(card.saveInfo.ability, 'DEX');
    // DC = 8 + prof(3) + int(3) = 14
    assert.equal(card.saveInfo.dc, 14);
    assert.equal(card.saveDc, 14);
    assert.equal(card.saveAbility, 'DEX');
    assert.equal(card.dmgRolls.length, 1);
    assert.equal(card.dmgRolls[0].type, 'Acid');

    // Chat bubble on spellWithSave -> should ping description card (abilityCard)
    emitted.length = 0;
    sm.postSpellToChat(spellWithSave, 'cantrip', testChar.name, 'public');
    assert.equal(emitted.length, 1);
    assert.ok(emitted[0].data.abilityCard, 'Chat bubble icon must ping abilityCard');
    assert.equal(emitted[0].data.abilityCard.abilityName, 'Acid Splash');

    // Spell with Attack Roll (like Firebolt)
    const spellWithAtk = {
        name: 'Fire Bolt',
        description: 'You hurl a mote of fire.',
        attackStat: 'spell',
        attackProf: true,
        damageList: [{ formula: '1d10', type: 'Fire' }]
    };

    emitted.length = 0;
    sm.rollSpell(spellWithAtk, 'cantrip', testChar, { type: 'roll' });
    assert.equal(emitted.length, 1);
    const atkCard = emitted[0].data.macroCard;
    assert.ok(atkCard.atkRoll, 'Attack roll must be present on Fire Bolt');
    assert.match(atkCard.atkRoll.formula, /1d20 \+3\[SPELL\] \+ 3\[Prof\]/);

    // Pure Narrative Spell (like Detect Magic)
    const narrativeSpell = {
        name: 'Detect Magic',
        description: 'For the duration, you sense the presence of magic within 30 feet.',
        castingTime: '1 action',
        range: 'Self',
        duration: 'Concentration, up to 10 minutes'
    };

    emitted.length = 0;
    sm.postSpellToChat(narrativeSpell, 'level1', testChar.name, 'public');
    assert.equal(emitted.length, 1);
    assert.ok(emitted[0].data.abilityCard, 'Pure narrative spell should produce abilityCard');
    assert.equal(emitted[0].data.abilityCard.abilityName, 'Detect Magic');
    assert.match(emitted[0].data.abilityCard.text, /sense the presence of magic/);

    console.log('? Player Character Sheet Spell Chat Cards passed.');
    console.log('\n--- All Verification Tests Passed Successfully! ---');
}

runTests().catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
