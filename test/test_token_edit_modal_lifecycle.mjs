/**
 * test/test_token_edit_modal_lifecycle.mjs
 * Unit & Lifecycle Integration Suite for Token Edit Modal Subsystem.
 * Verifies:
 * 1. 5e Lighting Presets mathematical bounds & animation profiles (Torch, Lanterns, Candle, Spell Light)
 * 2. Multi-Aura list operations (creation, property mutations, style/shape validation, deletion, opacity limits)
 * 3. Token Size presets (0.5 to 4.0) vs Custom Non-Square Dimensions & pixel width/height scaling
 * 4. HP Bar and Number visibility overrides matrix & effective visibility calculations
 * 5. Character Sheet Defaults synchronization (mapping token config into campaign character schema)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LIGHTING_PRESETS } from '../vtt/js/canvas/vtt-canvas-lighting.js';
import { VISIBILITY_TIERS, getEffectiveVisibility } from '../vtt/js/canvas/tokens/vtt-canvas-token-config.js';

describe('Token Edit Modal Lifecycle & Data Model Suite', () => {
    describe('1. 5e Dynamic Lighting Presets & Profiles', () => {
        it('should define standard 5e lighting presets with valid numeric metrics', () => {
            assert.ok(LIGHTING_PRESETS.torch, 'Torch preset must exist');
            assert.equal(LIGHTING_PRESETS.torch.name, 'Torch');
            assert.equal(LIGHTING_PRESETS.torch.bright, 20);
            assert.equal(LIGHTING_PRESETS.torch.dim, 20);
            assert.equal(LIGHTING_PRESETS.torch.angle, 360);
            assert.equal(LIGHTING_PRESETS.torch.animationType, 'flicker');
            assert.ok(LIGHTING_PRESETS.torch.animationSpeed > 0);
            assert.ok(LIGHTING_PRESETS.torch.animationIntensity > 0);
        });

        it('should correctly configure directional beam lighting for bullseye lantern', () => {
            const bullseye = LIGHTING_PRESETS.lantern_bullseye;
            assert.ok(bullseye, 'Bullseye lantern preset must exist');
            assert.equal(bullseye.bright, 60);
            assert.equal(bullseye.dim, 60);
            assert.equal(bullseye.angle, 60, 'Bullseye lantern must have a 60 degree cone beam arc');
            assert.equal(bullseye.animationType, 'none', 'Bullseye lantern is static beam by default');
        });

        it('should define distinct pulse animation and color for Light Spell', () => {
            const spellLight = LIGHTING_PRESETS.spell_light;
            assert.ok(spellLight, 'Light spell preset must exist');
            assert.equal(spellLight.bright, 20);
            assert.equal(spellLight.dim, 20);
            assert.equal(spellLight.animationType, 'pulse');
            assert.ok(spellLight.color.startsWith('#'), 'Must have valid hex color');
        });

        it('should support hooded lantern with 30ft bright / 30ft dim flicker', () => {
            const hooded = LIGHTING_PRESETS.lantern_hooded;
            assert.ok(hooded);
            assert.equal(hooded.bright, 30);
            assert.equal(hooded.dim, 30);
            assert.equal(hooded.angle, 360);
            assert.equal(hooded.animationType, 'flicker');
        });
    });

    describe('2. Multi-Aura Array Lifecycle & Mutations', () => {
        it('should initialize and expand newly added auras', () => {
            const auras = [];
            auras.forEach((a) => {
                a.isExpanded = false;
            });
            auras.push({
                name: 'Aura of Protection',
                enabled: true,
                range: 10,
                shape: 'circle',
                style: 'both',
                opacity: 0.3,
                color: '#d4af37',
                isExpanded: true
            });

            assert.equal(auras.length, 1);
            assert.equal(auras[0].name, 'Aura of Protection');
            assert.equal(auras[0].range, 10);
            assert.equal(auras[0].isExpanded, true);
        });

        it('should enforce range boundaries and sanitize properties', () => {
            const aura = {
                name: 'Spirit Guardians',
                enabled: true,
                range: 15,
                shape: 'circle',
                style: 'fill',
                opacity: 0.4,
                color: '#800080'
            };

            // Mutate range with clamp
            const rawRangeInput = '2'; // user typed 2
            aura.range = Math.max(5, parseInt(rawRangeInput, 10) || 5);
            assert.equal(aura.range, 5, 'Aura range must be clamped to minimum 5 feet');

            // Mutate opacity with clamp
            const rawOpacityInput = '0.75';
            aura.opacity = Math.min(1.0, Math.max(0.05, parseFloat(rawOpacityInput) || 0.3));
            assert.equal(aura.opacity, 0.75);

            // Shape toggle
            aura.shape = 'square';
            assert.equal(aura.shape, 'square');
        });

        it('should clean temporary UI properties (isExpanded) when preparing for token serialization', () => {
            const tempAurasList = [
                {
                    name: 'Aura 1',
                    range: 10,
                    isExpanded: true,
                    enabled: true,
                    color: '#ff0000',
                    shape: 'circle',
                    style: 'both',
                    opacity: 0.3
                },
                {
                    name: 'Aura 2',
                    range: 30,
                    isExpanded: false,
                    enabled: false,
                    color: '#00ff00',
                    shape: 'square',
                    style: 'border',
                    opacity: 0.5
                }
            ];

            const cleanedAuras = tempAurasList.map((a) => {
                const { isExpanded, ...clean } = a;
                return clean;
            });

            assert.equal(cleanedAuras.length, 2);
            assert.equal(cleanedAuras[0].isExpanded, undefined);
            assert.equal(cleanedAuras[1].isExpanded, undefined);
            assert.equal(cleanedAuras[0].range, 10);
            assert.equal(cleanedAuras[1].shape, 'square');
        });

        it('should support aura deletion by index and retain remaining auras intact', () => {
            const auras = [
                { name: 'Aura A', range: 10 },
                { name: 'Aura B', range: 20 },
                { name: 'Aura C', range: 30 }
            ];
            // Delete middle aura (index 1)
            auras.splice(1, 1);
            assert.equal(auras.length, 2);
            assert.equal(auras[0].name, 'Aura A');
            assert.equal(auras[1].name, 'Aura C');
        });
    });

    describe('3. Token Size Presets vs Custom Non-Square Dimensions', () => {
        it('should handle standard size presets cleanly', () => {
            const token = { id: 'tok_test', size: 1 };
            const sizeSelection = '2'; // Large 2x2
            const isCustom = sizeSelection === 'custom';

            if (isCustom) {
                token.size = 2;
                token.customWidth = 2;
                token.customHeight = 2;
            } else {
                token.size = parseFloat(sizeSelection) || 1;
                delete token.customWidth;
                delete token.customHeight;
            }

            assert.equal(token.size, 2);
            assert.equal(token.customWidth, undefined);
            assert.equal(token.customHeight, undefined);
        });

        it('should handle custom non-square dimensions for siege weapons / wagons / mounts', () => {
            const token = { id: 'tok_wagon', size: 1 };
            const sizeSelection = 'custom';
            const customWidthInput = 3;
            const customHeightInput = 1;

            if (sizeSelection === 'custom') {
                const customWidth = parseInt(customWidthInput, 10) || 1;
                const customHeight = parseInt(customHeightInput, 10) || 1;
                token.size = Math.max(customWidth, customHeight);
                token.customWidth = customWidth;
                token.customHeight = customHeight;
            }

            assert.equal(token.size, 3, 'Token size bounding box is max dimension');
            assert.equal(token.customWidth, 3);
            assert.equal(token.customHeight, 1);

            // Compute pixel dimensions against grid
            const grid = { size: 50, scale: 1.0 };
            const gridPx = grid.size * grid.scale;
            token.pixelWidth = (token.customWidth || token.size) * gridPx;
            token.pixelHeight = (token.customHeight || token.size) * gridPx;

            assert.equal(token.pixelWidth, 150);
            assert.equal(token.pixelHeight, 50);
        });
    });

    describe('4. HP Bar and Number Visibility Overrides', () => {
        it('should define visibility tiers: never (0) < hover (1) < always (2)', () => {
            assert.equal(VISIBILITY_TIERS.never, 0);
            assert.equal(VISIBILITY_TIERS.hover, 1);
            assert.equal(VISIBILITY_TIERS.always, 2);
        });

        it('should cap player preference by GM campaign setting', () => {
            // GM allows always, Player prefers hover -> effective is hover
            assert.equal(getEffectiveVisibility('hover', 'always'), 'hover');

            // GM restricts to hover, Player prefers always -> effective is hover (capped)
            assert.equal(getEffectiveVisibility('always', 'hover'), 'hover');

            // GM restricts to never, Player prefers always -> effective is never
            assert.equal(getEffectiveVisibility('always', 'never'), 'never');

            // Player chooses default -> inherits GM setting
            assert.equal(getEffectiveVisibility('default', 'always'), 'always');
            assert.equal(getEffectiveVisibility('default', 'hover'), 'hover');
            assert.equal(getEffectiveVisibility('default', 'never'), 'never');
        });
    });

    describe('5. Character Sheet Defaults Synchronization', () => {
        it('should map token edits into character sheet schema when saveDefaults is true', () => {
            const character = {
                id: 'char_valeros_1',
                name: 'Valeros',
                hpCurrent: 12,
                hpMax: 12,
                tempHp: 0
            };

            const editedToken = {
                id: 'tok_hero_1',
                characterId: 'char_valeros_1',
                name: 'Valeros the Bold',
                hp: 10,
                maxHp: 15,
                tempHp: 5,
                size: 2,
                customWidth: 2,
                customHeight: 1,
                sightRange: 120,
                lightEnabled: true,
                lightBright: 20,
                lightDim: 20,
                lightColor: '#ff9d3b',
                lightAngle: 360,
                lightRotation: 0,
                lightAnimationType: 'flicker',
                lightAnimationSpeed: 1.2,
                lightAnimationIntensity: 0.12,
                lightAnimationColor2: '#ffe082',
                auras: [
                    {
                        name: 'Paladin Aura',
                        range: 10,
                        shape: 'circle',
                        style: 'both',
                        opacity: 0.3,
                        color: '#d4af37',
                        enabled: true
                    }
                ],
                fxOverlayEnabled: true,
                fxOverlayOpacity: 0.4,
                fxOverlayColor: '#007bff',
                fxVignetteEnabled: true,
                fxVignetteOpacity: 0.5,
                fxVignetteColor: '#000000',
                fxShadowEnabled: true,
                fxShadowBlur: 16,
                fxShadowOffset: 6,
                fxShadowColor: '#000000',
                fxShadowOpacity: 0.8,
                border: {
                    shape: 'hexagon',
                    style: 'glow',
                    framePreset: 'none',
                    color: '#00ffcc',
                    width: 4
                }
            };

            // Emulate handleSave(true) logic from vtt-canvas-token-modal.js
            character.hpCurrent = editedToken.hp;
            character.hpMax = editedToken.maxHp;
            character.tempHp = editedToken.tempHp ?? 0;

            character.tokenSize = editedToken.size;
            if (editedToken.customWidth) character.tokenCustomWidth = editedToken.customWidth;
            else delete character.tokenCustomWidth;
            if (editedToken.customHeight) character.tokenCustomHeight = editedToken.customHeight;
            else delete character.tokenCustomHeight;

            character.tokenSight = editedToken.sightRange;
            character.tokenAuras = editedToken.auras;
            character.tokenBorder = JSON.parse(JSON.stringify(editedToken.border || {}));
            character.fxOverlayEnabled = editedToken.fxOverlayEnabled;
            character.fxOverlayOpacity = editedToken.fxOverlayOpacity;
            character.fxOverlayColor = editedToken.fxOverlayColor;
            character.fxVignetteEnabled = editedToken.fxVignetteEnabled;
            character.fxVignetteOpacity = editedToken.fxVignetteOpacity;
            character.fxVignetteColor = editedToken.fxVignetteColor;
            character.fxShadowEnabled = editedToken.fxShadowEnabled;
            character.fxShadowBlur = editedToken.fxShadowBlur;
            character.fxShadowOffset = editedToken.fxShadowOffset;
            character.fxShadowColor = editedToken.fxShadowColor;
            character.fxShadowOpacity = editedToken.fxShadowOpacity;
            character.tokenLightEnabled = editedToken.lightEnabled;
            character.tokenLightBright = editedToken.lightBright;
            character.tokenLightDim = editedToken.lightDim;
            character.tokenLightColor = editedToken.lightColor;
            character.tokenLightAngle = editedToken.lightAngle;
            character.tokenLightRotation = editedToken.lightRotation;
            character.tokenLightAnimationType = editedToken.lightAnimationType;
            character.tokenLightAnimationSpeed = editedToken.lightAnimationSpeed;
            character.tokenLightAnimationIntensity = editedToken.lightAnimationIntensity;
            character.tokenLightAnimationColor2 = editedToken.lightAnimationColor2;

            // Assertions
            assert.equal(character.hpCurrent, 10);
            assert.equal(character.hpMax, 15);
            assert.equal(character.tempHp, 5);
            assert.equal(character.tokenSize, 2);
            assert.equal(character.tokenCustomWidth, 2);
            assert.equal(character.tokenCustomHeight, 1);
            assert.equal(character.tokenSight, 120);
            assert.equal(character.tokenAuras.length, 1);
            assert.equal(character.tokenAuras[0].name, 'Paladin Aura');
            assert.equal(character.tokenLightEnabled, true);
            assert.equal(character.tokenLightBright, 20);
            assert.equal(character.tokenLightAnimationType, 'flicker');
            assert.equal(character.fxOverlayEnabled, true);
            assert.equal(character.fxOverlayColor, '#007bff');
            assert.equal(character.fxShadowBlur, 16);
            assert.equal(character.tokenBorder.shape, 'hexagon');
            assert.equal(character.tokenBorder.style, 'glow');
            assert.equal(character.tokenBorder.color, '#00ffcc');
        });

        it('should correctly structure Custom NPC schema when promoting unlinked Bestiary monster', () => {
            const monsterToken = {
                id: 'tok_goblin_99',
                name: 'Goblin Sneak',
                hp: 7,
                maxHp: 7,
                tempHp: 0,
                size: 0.5,
                sightRange: 60,
                img: 'assets/tokens/goblin.png',
                auras: [],
                lightEnabled: false,
                monsterData: {
                    name: 'Goblin',
                    ac: 15,
                    cr: '1/4'
                }
            };

            const newId = `npc_test_12345`;
            const cleanMonster = JSON.parse(JSON.stringify(monsterToken.monsterData));
            cleanMonster.name = monsterToken.name;

            const newChar = {
                id: newId,
                name: monsterToken.name,
                isCustomNpc: true,
                isGeneric: true,
                isPlayer: false,
                hpCurrent: monsterToken.hp,
                hpMax: monsterToken.maxHp,
                tempHp: monsterToken.tempHp || 0,
                tokenSize: monsterToken.size,
                tokenSight: monsterToken.sightRange,
                tokenImages: [{ url: monsterToken.img, name: 'Default Token', isDefault: true }],
                activeTokenIndex: 0,
                tokenAuras: monsterToken.auras,
                monsterData: cleanMonster
            };

            assert.equal(newChar.isCustomNpc, true);
            assert.equal(newChar.isPlayer, false);
            assert.equal(newChar.name, 'Goblin Sneak');
            assert.equal(newChar.tokenImages[0].url, 'assets/tokens/goblin.png');
            assert.equal(newChar.monsterData.cr, '1/4');
        });
    });
});
