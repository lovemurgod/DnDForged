import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    generateDamageTypeSVG,
    spawnProceduralCombatFX,
    DAMAGE_TYPE_COLORS
} from '../vtt/js/canvas/tokens/vtt-canvas-procedural-fx.js';
import {
    triggerDamageFXAnimation,
    triggerHealingFXAnimation
} from '../vtt/js/canvas/tokens/vtt-canvas-token-renderer.js';

describe('Procedural Vector Damage FX & SVG Engine', () => {
    let mockContainer;
    let appendedChildren = [];

    before(() => {
        appendedChildren = [];
        mockContainer = {
            id: 'vtt-html-overlays',
            appendChild: (el) => appendedChildren.push(el)
        };

        global.document = {
            getElementById: (id) => (id === 'vtt-html-overlays' ? mockContainer : null),
            createElement: (tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    style: {},
                    textContent: '',
                    innerHTML: '',
                    parentNode: mockContainer,
                    remove: function () {
                        const idx = appendedChildren.indexOf(this);
                        if (idx !== -1) appendedChildren.splice(idx, 1);
                    }
                };
                return el;
            }
        };
    });

    after(() => {
        delete global.document;
    });

    it('All procedural damage types eliminate drop-shadow filters entirely for 60fps mobile compositing', () => {
        const types = [
            'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison',
            'radiant', 'necrotic', 'force', 'psychic', 'slashing',
            'piercing', 'bludgeoning', 'untyped', 'heal', 'temphp'
        ];
        for (const t of types) {
            const svg = generateDamageTypeSVG(t, 25);
            assert.ok(!svg.includes('drop-shadow'), `${t} must not contain any raster drop-shadow filters`);
        }
    });

    it('Slashing generates curved blade slash arc and crimson motion trail SVG with real-time pathLength drawing', () => {
        const svg = generateDamageTypeSVG('slashing', 25, { angle: 15, flipX: false });
        assert.ok(svg.includes('<svg'));
        assert.ok(svg.includes('vtt-slash-cut'));
        assert.ok(svg.includes('vtt-slash-trail'));
        assert.ok(svg.includes('stroke="#ffffff"'));
        assert.ok(svg.includes('rgba(220, 38, 38'));
        assert.ok(svg.includes('pathLength="100"'), 'Must include pathLength for real-time stroke-dashoffset tracing');
        assert.ok(svg.includes('rotate(15'));
    });

    it('Piercing generates central puncture spark, thrust line, and cone shockwaves with two-tone lines', () => {
        const svg = generateDamageTypeSVG('piercing', 25);
        assert.ok(svg.includes('<line'));
        assert.ok(svg.includes('<circle'));
        assert.ok(svg.includes('vtt-fx-expand'));
        assert.ok(svg.includes('pathLength="100"'));
        assert.ok(svg.includes('stroke="#ffffff"'));
    });

    it('Bludgeoning generates heavy compression shockwave, concussive pop, and kinetic debris flecks', () => {
        const svg = generateDamageTypeSVG('bludgeoning', 25);
        assert.ok(svg.includes('vtt-fx-expand'));
        assert.ok(svg.includes('vtt-concussive-pop'));
        assert.ok(svg.includes('#fb7185'));
        // Count debris circles (layered two-tone: outer + inner)
        const circleMatches = svg.match(/<circle /g) || [];
        assert.ok(circleMatches.length >= 12);
    });

    it('Fire generates incandescent core bloom and 8 two-tone rising ember spark particles', () => {
        const svg = generateDamageTypeSVG('fire', 25);
        assert.ok(svg.includes('grad_fire_'));
        assert.ok(svg.includes('vtt-ember-rise'));
        const emberMatches = svg.match(/vtt-ember-rise/g) || [];
        assert.equal(emberMatches.length, 16); // 8 outer + 8 inner white cores
    });

    it('Cold generates glacial frost core, 6 crystalline snowflake arms with two-tone barbs and diamond tips', () => {
        const svg = generateDamageTypeSVG('cold', 25);
        assert.ok(svg.includes('grad_cold_'));
        assert.ok(svg.includes('<rect'));
        const rectMatches = svg.match(/<rect /g) || [];
        assert.equal(rectMatches.length, 12); // 6 outer + 6 inner white diamonds
    });

    it('Lightning generates central arc flash and 3 branching jagged polyline bolts with pathLength', () => {
        const svg = generateDamageTypeSVG('lightning', 25);
        assert.ok(svg.includes('<polyline points='));
        assert.ok(svg.includes('#facc15'));
        assert.ok(svg.includes('pathLength="100"'));
        const boltMatches = svg.match(/<polyline /g) || [];
        assert.ok(boltMatches.length >= 9); // 3 base + 3 mid + 3 white cores
    });

    it('Acid generates caustic sizzling puddle and 7 two-tone effervescent popping bubbles', () => {
        const svg = generateDamageTypeSVG('acid', 25);
        assert.ok(svg.includes('grad_acid_'));
        assert.ok(svg.includes('vtt-bubble-pop'));
        const bubbleMatches = svg.match(/vtt-bubble-pop/g) || [];
        assert.equal(bubbleMatches.length, 14); // 7 outer + 7 inner white specular highlights
    });

    it('Poison generates 5 two-tone swirling billowing toxic miasma cloud puffs', () => {
        const svg = generateDamageTypeSVG('poison', 25);
        const puffMatches = svg.match(/vtt-fx-expand/g) || [];
        assert.equal(puffMatches.length, 10); // 5 outer + 5 inner cores
    });

    it('Thunder generates triple acoustic shockwave rings and 8 two-tone radial sound compression dashes', () => {
        const svg = generateDamageTypeSVG('thunder', 25);
        const ringMatches = svg.match(/vtt-fx-expand/g) || [];
        assert.ok(ringMatches.length >= 3);
        const dashMatches = svg.match(/<line /g) || [];
        assert.equal(dashMatches.length, 16); // 8 outer + 8 inner white cores
    });

    it('Radiant generates celestial halo and bold two-tone 4-point starburst flare cutting far across', () => {
        const svg = generateDamageTypeSVG('radiant', 25);
        assert.ok(svg.includes('grad_radiant_'));
        assert.ok(svg.includes('vtt-star-flare'));
        assert.ok(svg.includes('<polygon points='));
    });

    it('Necrotic generates obsidian void core and 5 two-tone writhing dark soul tendrils', () => {
        const svg = generateDamageTypeSVG('necrotic', 25);
        assert.ok(svg.includes('grad_necrotic_'));
        const tendrilMatches = svg.match(/<path d="M /g) || [];
        assert.equal(tendrilMatches.length, 15); // 5 tendrils * 3 layered two-tone paths
    });

    it('Force generates double concentric distortion rings, concussive pop, and 6 two-tone orbiting pulse beads', () => {
        const svg = generateDamageTypeSVG('force', 25);
        assert.ok(svg.includes('vtt-fx-expand'));
        assert.ok(svg.includes('vtt-concussive-pop'));
        assert.ok(svg.includes('#e879f9'));
        const beadMatches = svg.match(/<circle /g) || [];
        assert.ok(beadMatches.length >= 12);
    });

    it('Psychic generates 2 concentric undulating telepathic brain-wave sine curves with two-tone layers', () => {
        const svg = generateDamageTypeSVG('psychic', 25);
        assert.ok(svg.includes('vtt-fx-expand'));
        assert.ok(svg.includes('#f472b6'));
        assert.ok(svg.includes('stroke="#ffffff"'));
    });

    it('Untyped physical fallback generates crisp dual cross-slash (X strike) with two-tone lines and pathLength', () => {
        const svg = generateDamageTypeSVG('untyped', 25);
        assert.ok(svg.includes('vtt-slash-cut'));
        assert.ok(svg.includes('pathLength="100"'));
        const lineMatches = svg.match(/<line /g) || [];
        assert.equal(lineMatches.length, 4); // 2 cross lines * 2 layered strokes
    });

    it('Healing generates soothing emerald bloom and 8 two-tone rising verdant sparkle stars', () => {
        const svg = generateDamageTypeSVG('heal', 25);
        assert.ok(svg.includes('grad_heal_'));
        assert.ok(svg.includes('vtt-sparkle-float'));
        const sparkleMatches = svg.match(/vtt-sparkle-float/g) || [];
        assert.equal(sparkleMatches.length, 16); // 8 sparkles * 2 circles
    });

    it('Temp HP generates sapphire protective ward ring and 4 two-tone barrier bracket nodes', () => {
        const svg = generateDamageTypeSVG('temphp', 25);
        assert.ok(svg.includes('#38bdf8'));
        assert.ok(svg.includes('vtt-fx-expand'));
    });

    it('spawnProceduralCombatFX mounts procedural SVG into DOM overlay', () => {
        appendedChildren = [];
        spawnProceduralCombatFX(250, 350, 25, ['radiant'], { amount: 24, tokenId: 'tok_rad' });

        assert.equal(appendedChildren.length, 1);
        const [container] = appendedChildren;

        assert.ok(container.className.includes('vtt-procedural-fx-container'));
        assert.ok(container.className.includes('radiant'));
        assert.ok(container.innerHTML.includes('vtt-star-flare'));
        assert.equal(container.style.left, '250px');
        assert.equal(container.style.top, '350px');
    });

    it('triggerDamageFXAnimation dispatches procedural vector graphics and initiates token shudder', () => {
        appendedChildren = [];
        triggerDamageFXAnimation(100, 200, 25, ['lightning'], { amount: 33, tokenId: 'tok_light' });

        assert.ok(appendedChildren.length >= 1);
        const container = appendedChildren.find((el) => el.className.includes('vtt-procedural-fx-container'));
        assert.ok(container);
        assert.ok(container.innerHTML.includes('polyline points='));
    });

    it('triggerHealingFXAnimation dispatches healing life bloom without violent shudder', () => {
        appendedChildren = [];
        triggerHealingFXAnimation(120, 180, 25, 14, { tokenId: 'tok_heal' });

        assert.ok(appendedChildren.length >= 1);
        const container = appendedChildren.find((el) => el.className.includes('vtt-procedural-fx-container'));
        assert.ok(container);
        assert.ok(container.innerHTML.includes('vtt-sparkle-float'));
    });
});
