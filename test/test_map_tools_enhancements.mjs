import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupKeyboardShortcuts } from '../vtt/js/canvas/vtt-canvas-clipboard-shortcuts.js';
import { checkTokenMoveTriggers } from '../vtt/js/canvas/vtt-canvas-portals.js';
import { handleCardAction } from '../vtt/js/canvas/tokens/vtt-canvas-mass-actions.js';
import { mapToolUndo, mapToolRedo } from '../vtt/js/canvas/vtt-canvas-map-tools.js';

describe('Map Tools Enhancements: Delete Shortcut, Elevation Filter, Rearm/Disarm, Mass Saves & Undo/Redo', () => {
    it('1. Delete / Backspace key deletes selected map tool (trap or portal)', () => {
        let deletedType = null;
        let rendered = false;
        const ctx = {
            selectedMapToolItem: { id: 'trap_123', type: 'trap' },
            deleteSelectedMapToolItem: (type) => {
                deletedType = type;
                ctx.selectedMapToolItem = null;
            },
            renderAll: () => {
                rendered = true;
            },
            selectedTokenIds: new Set()
        };

        const { deleteSelection } = setupKeyboardShortcuts(ctx);
        deleteSelection();

        assert.equal(deletedType, 'trap', 'deleteSelection must invoke deleteSelectedMapToolItem with "trap"');
        assert.equal(ctx.selectedMapToolItem, null, 'Selected map tool must be cleared after deletion');
        assert.equal(rendered, true, 'Canvas must be re-rendered after deletion');
    });

    it('2. Elevation (flight) filter: Airborne tokens do not trigger ground traps', () => {
        const traps = [
            {
                id: 'spike_pit_1',
                name: 'Spike Pit',
                shape: 'rect',
                geom: { x: 100, y: 100, w: 100, h: 100 },
                minElevation: 0,
                maxElevation: 5,
                isSpent: false,
                isRevealed: false
            }
        ];

        let sprungTrapId = null;
        const context = {
            traps,
            portals: [],
            triggerTrapSpringFX: (x, y, tr) => {
                sprungTrapId = tr.id;
            },
            postTrapTriggerChatCard: () => {},
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
        };

        // Case A: Flying creature at 30 ft elevation walks through the trap
        const flyingToken = {
            id: 'bird_hero',
            name: 'Aarakocra',
            x: 120,
            y: 120,
            elevation: 30
        };
        const flyingOrig = { x: 50, y: 50 };
        const flyResult = checkTokenMoveTriggers(flyingToken, flyingOrig, context);
        assert.equal(flyResult, null, 'Flying token at 30ft must NOT trigger ground trap (0-5ft)');
        assert.equal(sprungTrapId, null);

        // Case B: Ground creature at 0 ft elevation walks through the trap
        const walkingToken = {
            id: 'dwarf_hero',
            name: 'Gimli',
            x: 120,
            y: 120,
            elevation: 0
        };
        const walkingOrig = { x: 50, y: 50 };
        const groundResult = checkTokenMoveTriggers(walkingToken, walkingOrig, context);
        assert.ok(groundResult, 'Ground token at 0ft must trigger ground trap');
        assert.equal(groundResult.action, 'trap');
    });

    it('3. Disarmed traps do not trigger, and Rearm restores active state', () => {
        const trap = {
            id: 'needle_trap',
            name: 'Needle Trap',
            shape: 'rect',
            geom: { x: 100, y: 100, w: 100, h: 100 },
            isSpent: false,
            isRevealed: false,
            isDisarmed: true
        };

        const context = {
            traps: [trap],
            portals: [],
            getTokenDrawDimensions: () => ({ drawW: 50, drawH: 50 })
        };

        const token = { id: 'rogue', x: 120, y: 120, elevation: 0 };
        const orig = { x: 50, y: 50 };

        // Disarmed trap should not trigger
        const res = checkTokenMoveTriggers(token, orig, context);
        assert.equal(res, null, 'Disarmed trap must not trigger on token move');

        // Rearm trap
        trap.isDisarmed = false;
        trap.isSpent = false;
        trap.isRevealed = false;

        const resRearmed = checkTokenMoveTriggers(token, orig, context);
        assert.ok(resRearmed, 'Rearmed trap must trigger on token move');
    });

    it('4. Multi-Target AoE Trap: Full and Half damage apply to all selected tokens', () => {
        const trapCardData = {
            isTrap: true,
            trapId: 'fire_rune',
            name: 'Explosive Rune',
            damage: '12',
            damageType: 'fire',
            damageRoll: { total: 12 }
        };

        const tokens = {
            p1: { id: 'p1', name: 'Paladin', hp: 30, maxHp: 30 },
            p2: { id: 'p2', name: 'Ranger', hp: 25, maxHp: 25 },
            p3: { id: 'p3', name: 'Mage', hp: 20, maxHp: 20 }
        };

        const vtt = { role: 'GM', username: 'DM' };

        // Full damage to all 3 selected tokens
        const fullRes = handleCardAction(trapCardData, 'full', {
            vtt,
            tokens,
            selectedTokenIds: new Set(['p1', 'p2', 'p3'])
        });
        assert.equal(fullRes, true);
        assert.equal(tokens.p1.hp, 18, 'Paladin takes 12 damage: 30 - 12 = 18');
        assert.equal(tokens.p2.hp, 13, 'Ranger takes 12 damage: 25 - 12 = 13');
        assert.equal(tokens.p3.hp, 8, 'Mage takes 12 damage: 20 - 12 = 8');

        // Half damage (6 HP) to all 3 selected tokens
        const halfRes = handleCardAction(trapCardData, 'half', {
            vtt,
            tokens,
            selectedTokenIds: new Set(['p1', 'p2', 'p3'])
        });
        assert.equal(halfRes, true);
        assert.equal(tokens.p1.hp, 12, 'Paladin takes 6 half damage: 18 - 6 = 12');
        assert.equal(tokens.p2.hp, 7, 'Ranger takes 6 half damage: 13 - 6 = 7');
        assert.equal(tokens.p3.hp, 2, 'Mage takes 6 half damage: 8 - 6 = 2');
    });

    it('5. Map Tool Undo / Redo restores geometry and handles deletion recovery', () => {
        const traps = [
            { id: 'trap_a', shape: 'rect', geom: { x: 10, y: 10, w: 50, h: 50 } }
        ];
        const portals = [];
        const mapToolUndoStack = [];
        const mapToolRedoStack = [];

        // Simulate moving trap from (10,10) to (100,100)
        const beforeGeom = { x: 10, y: 10, w: 50, h: 50 };
        traps[0].geom = { x: 100, y: 100, w: 50, h: 50 };
        mapToolUndoStack.push({
            action: 'geom',
            type: 'trap',
            id: 'trap_a',
            before: beforeGeom,
            after: { x: 100, y: 100, w: 50, h: 50 }
        });

        // Trigger Undo
        mapToolUndo({
            mapToolUndoStack,
            mapToolRedoStack,
            traps,
            portals,
            currentMapId: 'map_1'
        });

        assert.equal(traps[0].geom.x, 10, 'Undo must revert geom.x back to 10');
        assert.equal(traps[0].geom.y, 10, 'Undo must revert geom.y back to 10');
        assert.equal(mapToolRedoStack.length, 1, 'Redo stack must have 1 operation');

        // Trigger Redo
        mapToolRedo({
            mapToolUndoStack,
            mapToolRedoStack,
            traps,
            portals,
            currentMapId: 'map_1'
        });

        assert.equal(traps[0].geom.x, 100, 'Redo must reapply geom.x to 100');
        assert.equal(traps[0].geom.y, 100, 'Redo must reapply geom.y to 100');
    });
});
