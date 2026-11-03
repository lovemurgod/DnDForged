import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

console.log('--- Testing 3D Dice Skin Themes & Customization ---');

// 1. Load vtt/js/dice-3d.js in mock browser environment
const diceScriptPath = path.resolve('vtt/js/dice-3d.js');
const scriptCode = fs.readFileSync(diceScriptPath, 'utf8');

// Mock Canvas 2D context
class MockContext2D {
    constructor() {
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.lineWidth = 1;
        this.font = '10px sans-serif';
        this.textAlign = 'center';
        this.textBaseline = 'middle';
        this.shadowColor = '';
        this.shadowBlur = 0;
        this.calls = [];
    }
    fillRect(x, y, w, h) {
        this.calls.push({ op: 'fillRect', x, y, w, h });
    }
    strokeRect(x, y, w, h) {
        this.calls.push({ op: 'strokeRect', x, y, w, h });
    }
    roundRect(x, y, w, h, r) {
        this.calls.push({ op: 'roundRect', x, y, w, h, r });
    }
    fillText(text, x, y) {
        this.calls.push({ op: 'fillText', text, x, y, fillStyle: this.fillStyle });
    }
    strokeText(text, x, y) {
        this.calls.push({ op: 'strokeText', text, x, y, strokeStyle: this.strokeStyle });
    }
    beginPath() {
        this.calls.push({ op: 'beginPath' });
    }
    closePath() {
        this.calls.push({ op: 'closePath' });
    }
    moveTo(x, y) {
        this.calls.push({ op: 'moveTo', x, y });
    }
    lineTo(x, y) {
        this.calls.push({ op: 'lineTo', x, y });
    }
    stroke() {
        this.calls.push({ op: 'stroke' });
    }
    save() {}
    restore() {}
    translate(x, y) {}
    rotate(angle) {}
}

const mockWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
        _data: {},
        getItem(k) {
            return this._data[k] ?? null;
        },
        setItem(k, v) {
            this._data[k] = String(v);
        }
    }
};

const context = vm.createContext({
    window: mockWindow,
    self: mockWindow,
    document: {
        getElementById: () => null,
        createElement: (tag) => {
            if (tag === 'canvas') {
                return {
                    width: 256,
                    height: 256,
                    getContext: () => new MockContext2D()
                };
            }
            return {
                style: {},
                appendChild: () => {},
                classList: { add: () => {} }
            };
        },
        body: { appendChild: () => {} }
    },
    localStorage: mockWindow.localStorage,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
    THREE: {
        CanvasTexture: class {
            constructor(c) {
                this.canvas = c;
            }
        },
        LinearMipmapLinearFilter: 1008,
        MeshStandardMaterial: class {
            constructor(opts) {
                Object.assign(this, opts);
            }
        },
        Vector3: class {
            constructor(x = 0, y = 0, z = 0) {
                this.x = x;
                this.y = y;
                this.z = z;
            }
            clone() {
                return new this.constructor(this.x, this.y, this.z);
            }
            add() {
                return this;
            }
            subVectors() {
                return this;
            }
            multiplyScalar() {
                return this;
            }
            divideScalar() {
                return this;
            }
            normalize() {
                return this;
            }
            crossVectors() {
                return this;
            }
        },
        BufferGeometry: class {
            setAttribute() {}
            computeVertexNormals() {}
            addGroup() {}
        },
        Float32BufferAttribute: class {},
        Mesh: class {
            constructor(geom, mats) {
                this.geometry = geom;
                this.materials = mats;
            }
        }
    },
    CANNON: {
        Vec3: class {
            constructor(x, y, z) {
                this.x = x;
                this.y = y;
                this.z = z;
            }
        },
        ConvexPolyhedron: class {}
    },
    console: console
});

vm.runInContext(scriptCode, context);
const Dice3D = context.Dice3D || mockWindow.Dice3D;

assert.ok(Dice3D, 'Dice3D should be loaded');
assert.ok(Dice3D.SKINS, 'Dice3D.SKINS should be exposed');

// 1. Verify SKINS palette configuration
const expectedKeys = [
    'obsidian_gold',
    'ruby_ember',
    'sapphire_frost',
    'amethyst_void',
    'classic_ivory',
    'jade_emerald',
    'solar_flare',
    'abyssal_trench'
];

for (const key of expectedKeys) {
    const skin = Dice3D.SKINS[key];
    assert.ok(skin, `Skin '${key}' must exist in SKINS`);
    assert.ok(skin.name, `Skin '${key}' must have a name`);
    assert.ok(skin.bg, `Skin '${key}' must have a bg color`);
    assert.ok(skin.border, `Skin '${key}' must have a border color`);
    assert.ok(skin.text, `Skin '${key}' must have a text color`);

    if (key === 'classic_ivory') {
        assert.strictEqual(skin.text, '#1a1a1a', 'Classic ivory must have dark text');
    } else {
        // Assert text is not white or pale cream
        assert.notStrictEqual(skin.text.toLowerCase(), '#ffffff', `Skin '${key}' text must not be pure white #ffffff`);
        assert.notStrictEqual(skin.text.toLowerCase(), '#fff5d0', `Skin '${key}' text must not be pale ivory #fff5d0`);
    }
}

console.log('✓ All 8 presets in SKINS have vibrant, non-white text colors and valid border accents.');

// 2. Test Obsidian & Gold specifically
const og = Dice3D.SKINS.obsidian_gold;
assert.strictEqual(og.text, '#ffd700', 'Obsidian & Gold numeral must be rich gold #ffd700');
assert.strictEqual(og.border, '#d4af37', 'Obsidian & Gold border must be metallic gold #d4af37');
assert.strictEqual(og.bg, '#141416', 'Obsidian & Gold bg must be dark obsidian #141416');

// 3. Test Ruby Ember specifically
const ruby = Dice3D.SKINS.ruby_ember;
assert.strictEqual(ruby.text, '#ff5252', 'Ruby Ember text must be #ff5252');
assert.strictEqual(ruby.border, '#ff1744', 'Ruby Ember border must be #ff1744');

// 4. Test Sapphire Frost specifically
const sapphire = Dice3D.SKINS.sapphire_frost;
assert.strictEqual(sapphire.text, '#00e5ff', 'Sapphire Frost text must be #00e5ff');
assert.strictEqual(sapphire.border, '#00b0ff', 'Sapphire Frost border must be #00b0ff');

// 5. Test setSkin updates localStorage
Dice3D.setSkin('sapphire_frost');
assert.strictEqual(mockWindow.localStorage.getItem('vtt_3d_dice_skin'), 'sapphire_frost');

Dice3D.setSkin('obsidian_gold');
assert.strictEqual(mockWindow.localStorage.getItem('vtt_3d_dice_skin'), 'obsidian_gold');

console.log('✓ setSkin properly updates active skin in storage.');

console.log('\nAll 3D Dice Skin & Customization Tests Passed Successfully!');
