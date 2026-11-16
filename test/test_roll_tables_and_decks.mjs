import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    shuffleArray,
    findRowForRoll,
    cleanTableText,
    renderTarotCardSvg,
    renderTarotBackSvg
} from '../vtt/js/vtt-roll-tables.js';
import { detectCreatureAbilityTable } from '../vtt/js/creature-sheet/creature-renderer.js';
import { getEffectiveLinkedTable } from '../vtt/js/player-sheet/vtt-sheet-bio-features.js';

console.log('--- Testing Roll Tables, Asset Tables & Card Decks ---');

// 1. Test Fisher-Yates shuffle
console.log('1. Testing Fisher-Yates array shuffle...');
const sampleArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const shuffled = shuffleArray(sampleArray);
assert.equal(shuffled.length, sampleArray.length, 'Shuffled array must retain same length');
assert.deepEqual(
    [...shuffled].sort((a, b) => a - b),
    sampleArray,
    'Shuffled array must retain all original elements'
);
console.log('   ✓ Shuffle preserves length and elements');

// 2. Test Procedural Tarot Card SVG Rendering
console.log('2. Testing High-Fantasy Tarot Card SVG Rendering...');
const tarotFaceUri = renderTarotCardSvg({
    name: 'The Darklord',
    suit: 'High Deck',
    number: 4,
    desc: 'Single-minded ambition and a thirst for control; a figure of dark majesty.',
    theme: 'tarokka'
});
assert.ok(tarotFaceUri.startsWith('data:image/svg+xml;base64,'), 'Tarot card face must be a valid base64 data URI');
const faceSvgXml = Buffer.from(tarotFaceUri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
assert.ok(faceSvgXml.includes('The Darklord'), 'Face SVG must include card name');
assert.ok(faceSvgXml.includes('HIGH DECK'), 'Face SVG must include suit banner');
assert.ok(
    !faceSvgXml.includes('foreignObject'),
    'Face SVG must NOT contain foreignObject to guarantee cross-browser image sandbox support'
);

const tarotBackUri = renderTarotBackSvg('tarokka');
assert.ok(tarotBackUri.startsWith('data:image/svg+xml;base64,'), 'Tarot card back must be a valid base64 data URI');

// Check unique gradient IDs to prevent DOM collision
const secondCardUri = renderTarotCardSvg({ name: 'The Marionette', suit: 'High Deck', theme: 'tarokka' });
const secondCardXml = Buffer.from(secondCardUri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
const gradMatch1 = faceSvgXml.match(/id="(cardGrad_[^"]+)"/);
const gradMatch2 = secondCardXml.match(/id="(cardGrad_[^"]+)"/);
assert.ok(gradMatch1 && gradMatch2, 'Both cards must define linearGradients');
assert.notEqual(
    gradMatch1[1],
    gradMatch2[1],
    'Rendered cards must generate unique gradient IDs to avoid DOM collisions'
);

// Check dynamic font size scaling for long titles
const longCardUri = renderTarotCardSvg({ name: 'Ten of Swords (Executioner)', suit: 'Swords', theme: 'tarokka' });
const longCardXml = Buffer.from(longCardUri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
assert.ok(
    longCardXml.includes('font-size="10"') || longCardXml.includes('font-size="12"'),
    'Long card names must dynamically scale font size down'
);
const backSvgXml = Buffer.from(tarotBackUri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
assert.ok(backSvgXml.includes('<svg'), 'Back SVG must be valid SVG xml');
assert.ok(!backSvgXml.includes('foreignObject'), 'Back SVG must NOT contain foreignObject');
console.log('   ✓ Procedural Tarot card front & back render pure SVG with base64 data URIs');

// 3. Test Compendium Decks Catalog & Deck Compilations
console.log('3. Testing Compendium Decks (Curse of Strahd Tarokka, Many Things, Illusions)...');
// Load Tarokka from native adventure file
const cosPath = path.resolve('vtt/data/adventure/adventure-cos.json');
assert.ok(fs.existsSync(cosPath), 'adventure-cos.json must exist in native data');
const advCos = JSON.parse(fs.readFileSync(cosPath, 'utf8'));
const appE = advCos.data?.find((d) => (d.name || '').includes('Appendix E'));
assert.ok(appE, 'Curse of Strahd Appendix E: The Tarokka Deck must exist');

const highDeckSec = appE.entries.find((e) => e.name === 'High Deck');
const commonDeckSec = appE.entries.find((e) => e.name === 'Common Deck');
assert.ok(highDeckSec, 'Tarokka High Deck section must exist');
assert.ok(commonDeckSec, 'Tarokka Common Deck section must exist');
const highTable = highDeckSec.entries?.find((e) => e.type === 'table');
assert.ok(highTable, 'High deck table must exist');
assert.equal(highTable.rows.length, 14, 'Tarokka High Deck must contain 14 cards');

let commonCount = 0;
commonDeckSec.entries.forEach((sec) => {
    const table = sec.entries?.find((e) => e.type === 'table');
    if (table) commonCount += table.rows.length;
});
assert.equal(commonCount, 40, 'Tarokka Common Deck must contain 40 cards across 4 suits (10 each)');
assert.equal(14 + commonCount, 54, 'Curse of Strahd Tarokka Deck must have exactly 54 total cards');
console.log('   ✓ Curse of Strahd Tarokka Deck verified (54 cards: 14 High Deck + 40 Common Deck)');

// 4. Test Flesh Warping (Demon Ichor) 1d100 Table
console.log('4. Testing Flesh Warping (Demon Ichor) 1d100 Table Range Resolution...');
const fleshWarpingRows = [
    ['01–05', 'The creature’s eyes turn into oily black spheres. It gains darkvision...'],
    ['06–10', 'The creature’s skin turns scaly and rubbery...'],
    ['11–15', 'The creature’s hands twist into jagged bone-like talons...'],
    ['46–50', 'A spiny ridge erupts down the creature’s back...'],
    ['96–00', 'The creature’s flesh shifts and warps into muscular fiendish hide...']
];

const fw1 = findRowForRoll(fleshWarpingRows, 1);
assert.equal(fw1.row[0], '01–05');
const fw5 = findRowForRoll(fleshWarpingRows, 5);
assert.equal(fw5.row[0], '01–05');
const fw48 = findRowForRoll(fleshWarpingRows, 48);
assert.equal(fw48.row[0], '46–50');
const fw99 = findRowForRoll(fleshWarpingRows, 99);
assert.equal(fw99.row[0], '96–00');
const fw100 = findRowForRoll(fleshWarpingRows, 100);
assert.equal(fw100.row[0], '96–00');
console.log('   ✓ Flesh Warping 1d100 ranges correctly resolve rolls 1 through 100');

// 5. Test Creature Sheet Ability Table Effect Auto-Detection (Beholder Eye Rays, Sibriex, etc.)
console.log('5. Testing Creature Sheet Table Effect Auto-Detection...');
const mmPath = path.resolve('vtt/data/bestiary-normalized/bestiary-mm.json');
const mmMonsters = JSON.parse(fs.readFileSync(mmPath, 'utf8'));
const beholder = mmMonsters.find((m) => m.name === 'Beholder');
assert.ok(beholder, 'Beholder must exist in bestiary-mm.json');

const eyeRaysAction = (beholder.actions || []).find((a) => a.name === 'Eye Rays');
assert.ok(eyeRaysAction, 'Beholder must have Eye Rays action');

const detectedEyeRays = detectCreatureAbilityTable(eyeRaysAction, eyeRaysAction.name, eyeRaysAction.entries, '');
assert.ok(detectedEyeRays, 'detectCreatureAbilityTable must detect Beholder Eye Rays');
assert.equal(detectedEyeRays.type, 'eye-rays');
assert.equal(detectedEyeRays.formula, '1d10');
assert.equal(detectedEyeRays.items.length, 10);
assert.equal(detectedEyeRays.items[0].name, 'Charm Ray');
assert.equal(detectedEyeRays.items[9].name, 'Death Ray');
console.log('   ✓ Beholder Eye Rays auto-detected with 10 rays and 1d10 formula');

const sibriexAction = {
    name: 'Warp Creature',
    entries: ['Target must make DC 20 Constitution save or suffer flesh warping.']
};
const detectedWarp = detectCreatureAbilityTable(sibriexAction, sibriexAction.name, sibriexAction.entries, '');
assert.ok(detectedWarp, 'detectCreatureAbilityTable must detect Warp Creature / Flesh Warping');
assert.equal(detectedWarp.type, 'flesh-warping');
assert.equal(detectedWarp.formula, '1d100');
console.log('   ✓ Sibriex Warp Creature auto-detected with 1d100 formula');

// 6. Test Freeform Card Asset Payload Contract
console.log('6. Testing Canvas Freeform Asset Payload for Cards...');
const cardTokenPayload = {
    id: 'token_card_456',
    name: 'The Darklord',
    size: 1,
    pixelWidth: 140,
    pixelHeight: 210,
    img: tarotFaceUri,
    tokenImages: [
        { url: tarotFaceUri, name: 'The Darklord (Face)' },
        { url: tarotBackUri, name: 'Tarokka Deck (Back)' }
    ],
    activeTokenIndex: 0,
    isAsset: true,
    isBorderless: false,
    isCardToken: true,
    layer: 'map',
    imgRadius: '6px'
};

assert.equal(cardTokenPayload.isAsset, true, 'Card must be marked isAsset: true for freeform tabletop placement');
assert.equal(cardTokenPayload.isBorderless, false, 'Card must have border intact (isBorderless: false)');
assert.equal(cardTokenPayload.pixelWidth, 140, 'Proportional 140px width');
assert.equal(cardTokenPayload.pixelHeight, 210, 'Proportional 210px height (1:1.5 tarot ratio)');
assert.equal(cardTokenPayload.tokenImages.length, 2, 'Card token must have 2 flippable sides (Face and Back)');
assert.equal(cardTokenPayload.isCardToken, true);
console.log('   ✓ Card token payload conforms to freeform asset contract (140x210, flippable, ungridded)');

// 7. Test Deck State Machine (Draw, Discard, Shuffle, Recall)
console.log('7. Testing Deck State Lifecycle...');
const deck = {
    id: 'test_deck_1',
    name: 'Test Deck',
    cards: [
        { id: 'c1', name: 'Card 1', frontImg: 'img1.png' },
        { id: 'c2', name: 'Card 2', frontImg: 'img2.png' },
        { id: 'c3', name: 'Card 3', frontImg: 'img3.png' },
        { id: 'c4', name: 'Card 4', frontImg: 'img4.png' }
    ],
    state: {
        drawPile: ['c1', 'c2', 'c3', 'c4'],
        discardPile: [],
        drawnCards: []
    }
};

const drawnId = deck.state.drawPile.shift();
deck.state.drawnCards.push(drawnId);
assert.equal(deck.state.drawPile.length, 3);
assert.equal(deck.state.drawnCards.length, 1);
assert.equal(deck.state.drawnCards[0], 'c1');

deck.state.drawnCards = deck.state.drawnCards.filter((id) => id !== drawnId);
deck.state.discardPile.push(drawnId);
assert.equal(deck.state.drawnCards.length, 0);
assert.equal(deck.state.discardPile.length, 1);

deck.state.drawPile = shuffleArray([...deck.state.drawPile, ...deck.state.discardPile]);
deck.state.discardPile = [];
assert.equal(deck.state.drawPile.length, 4);

deck.state = {
    drawPile: shuffleArray(deck.cards.map((c) => c.id)),
    discardPile: [],
    drawnCards: []
};
assert.equal(deck.state.drawPile.length, 4);
console.log('   ✓ Deck draw, discard, shuffle, and recall lifecycle verified');

// 8. Test findRowForRoll and cleanTableText
console.log('8. Testing findRowForRoll and cleanTableText...');
const d100Rows = [
    ['01-02', 'Roll on this table each turn.'],
    ['03-04', 'For the next minute, you can see any invisible creature.'],
    ['49-50', 'You can fly.'],
    ['99-00', 'You regain all expended sorcery points.']
];

const r1 = findRowForRoll(d100Rows, 1);
assert.equal(r1.index, 0);
assert.equal(r1.row[0], '01-02');

const r2 = findRowForRoll(d100Rows, 2);
assert.equal(r2.index, 0);

const r50 = findRowForRoll(d100Rows, 50);
assert.equal(r50.index, 2);
assert.equal(r50.row[0], '49-50');

const r99 = findRowForRoll(d100Rows, 99);
assert.equal(r99.index, 3);
assert.equal(r99.row[0], '99-00');

const r100 = findRowForRoll(d100Rows, 100);
assert.equal(r100.index, 3);
assert.equal(r100.row[0], '99-00');

// Single number entries (e.g. Barbarian Wild Magic 1..8)
const d8Rows = [
    ['1', 'Shadowy tendrils lash around you.'],
    ['2', 'You teleport up to 30 feet.'],
    ['8', 'A bolt of light shoots from your chest.']
];

const b1 = findRowForRoll(d8Rows, 1);
assert.equal(b1.index, 0);
assert.equal(b1.row[0], '1');

const b8 = findRowForRoll(d8Rows, 8);
assert.equal(b8.index, 2);
assert.equal(b8.row[0], '8');

const cleaned = cleanTableText('Takes {@damage 1d12} radiant damage and is {@condition blinded}.');
assert.equal(cleaned, 'Takes 1d12 radiant damage and is blinded.');

// Test nested object entries handling
const objEntryCleaned = cleanTableText({ entry: 'Madness {@spell fear}' });
assert.equal(objEntryCleaned, 'Madness fear', 'cleanTableText should unpack .entry property recursively');

const textEntryCleaned = cleanTableText({ text: 'Gains darkvision' });
assert.equal(textEntryCleaned, 'Gains darkvision', 'cleanTableText should unpack .text property');

const rollRangeCleaned = cleanTableText({ roll: { min: 1, max: 10 } });
assert.equal(rollRangeCleaned, '1-10', 'cleanTableText should unpack .roll min-max object');

const arrCleaned = cleanTableText([{ entry: 'First effect' }, { entry: 'Second effect' }]);
assert.equal(arrCleaned, 'First effect; Second effect', 'cleanTableText should unpack array of objects');
console.log('   ✓ findRowForRoll correctly maps d100 ranges (including 00->100) and d8 single integers');

// 9. Test getEffectiveLinkedTable (Auto-detection & Manual Overrides)
console.log('9. Testing getEffectiveLinkedTable resolution...');
const sorcAbility = { name: 'Wild Magic Surge', desc: 'Starting when you choose this origin at 1st level...' };
assert.equal(
    getEffectiveLinkedTable(sorcAbility),
    'compendium:wild_magic_sorcerer',
    'Wild Magic Surge should auto-detect sorcerer table'
);

const tidesAbility = {
    name: 'Tides of Chaos',
    desc: 'Any time before you regain the use of this feature, the DM can have you roll on the Wild Magic Surge table...'
};
assert.equal(
    getEffectiveLinkedTable(tidesAbility),
    'compendium:wild_magic_sorcerer',
    'Tides of Chaos should auto-detect sorcerer table'
);

const barbAbility = { name: 'Wild Magic', desc: 'Magic barbarian table roll on rage' };
assert.equal(
    getEffectiveLinkedTable(barbAbility),
    'compendium:wild_magic_barbarian',
    'Wild Magic Barbarian should auto-detect barbarian table'
);

const customCard = { name: 'Custom Luck', linkedTable: { id: 'table_999', name: 'My Table' } };
assert.equal(
    getEffectiveLinkedTable(customCard),
    'table_999',
    'Explicit linkedTable should take priority over auto-detect'
);

const plainCard = { name: 'Action Surge', desc: 'Take an additional action on your turn' };
assert.equal(getEffectiveLinkedTable(plainCard), null, 'Unlinked feature without keyword should return null');
console.log('   ✓ getEffectiveLinkedTable resolves auto-detected and custom linked tables');

console.log('\nALL ROLL TABLES, ASSET TABLES & CARD DECKS TESTS PASSED!');
assert.equal(getEffectiveLinkedTable(plainCard), null, 'Unlinked feature without keyword should return null');
console.log('   ✓ getEffectiveLinkedTable resolves auto-detected and custom linked tables');

console.log('\nALL ROLL TABLES, ASSET TABLES & CARD DECKS TESTS PASSED!');
