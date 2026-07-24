// vtt-spell-manager.js

export function initVttSpellManager(vtt) {
    let spellCache = null;
    let activeSpellEditContext = { char: null, onSave: null };
    let spellBulkSelection = new Set();
    let classSet = new Set();
    let subclassSet = new Set();
    let modalSpellDamageRows = [];

    let currentChar = null;
    let saveAndEmit = null;
    let renderSheetData = null;

    function parseSpellToMacro(spData, newSpell) {
        if (!spData || !spData.entries) return;

        if (window.Parser) {
            if (spData.time) newSpell.castingTime = window.Parser.spTimeListToFull(spData.time, spData.meta);
            if (spData.range) newSpell.range = window.Parser.spRangeToFull(spData.range);
            if (spData.components) newSpell.components = window.Parser.spComponentsToFull(spData.components, spData.level);
            if (spData.duration) newSpell.duration = window.Parser.spDurationToFull(spData.duration);
        }

        const text = JSON.stringify(spData.entries).toLowerCase();

        if (text.includes("spell attack") || text.includes("{@atk ms}") || text.includes("{@atk rs}") || text.includes("{@atk ms,rs}")) {
            newSpell.attackStat = "spell";
            newSpell.attackProf = true;
            newSpell.attackExtra = 0;
            newSpell.attackBonus = "";
        } else {
            newSpell.attackStat = "none";
            newSpell.attackProf = false;
        }

        const saveMatch = text.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/);
        if (saveMatch) {
            newSpell.saveDcStat = "spell";
            newSpell.saveDcExtra = 0;
            newSpell.saveDcCustom = null;
            newSpell.saveAbility = saveMatch[1].substring(0, 3).toUpperCase();
        } else {
            newSpell.saveDcStat = "none";
            newSpell.saveAbility = "";
        }

        const dmgRegex = /\{@damage\s+(\d+)d(\d+)[^}]*\}(?:\s*([a-z]+)\s+damage)?/gi;
        let match;
        const damageList = [];
        while ((match = dmgRegex.exec(text)) !== null) {
            let formula = "";
            let type = match[3] ? match[3].charAt(0).toUpperCase() + match[3].slice(1) : "";
            if (spData.level === 0) {
                formula = `1d${match[2]}`;
                newSpell.cantripScale = true;
                damageList.push({ formula, type, id: 'dmg_' + Date.now() + Math.random() });
                break;
            } else {
                formula = match[1] + 'd' + match[2];
                damageList.push({ formula, type, id: 'dmg_' + Date.now() + Math.random() });
            }
        }

        if (damageList.length === 0) {
            const rawMatch = text.match(/(\d+)d(\d+)(?:[^a-z]*([a-z]+)\s+damage)?/i);
            if (rawMatch) {
                let formula = "";
                let type = rawMatch[3] ? rawMatch[3].charAt(0).toUpperCase() + rawMatch[3].slice(1) : "";
                if (spData.level === 0) {
                    formula = `1d${rawMatch[2]}`;
                    newSpell.cantripScale = true;
                } else {
                    formula = rawMatch[1] + 'd' + rawMatch[2];
                }
                damageList.push({ formula, type, id: 'dmg_' + Date.now() + Math.random() });
            }
        }
        newSpell.damageList = damageList;

        if (window.Renderer && spData.entries) {
            try {
                const temp = document.createElement('div');
                temp.innerHTML = window.Renderer.get().render({ entries: spData.entries });
                newSpell.description = temp.textContent || temp.innerText || "";
            } catch (e) { }
        }

        if (spData.entriesHigherLevel) {
            const hl = JSON.stringify(spData.entriesHigherLevel).toLowerCase();
            let hlMatch = hl.match(/\{@scaledamage [^|]+\|[^|]+\|([^}]+)\}/);
            if (hlMatch) {
                newSpell.upcastBonus = hlMatch[1];
            } else {
                hlMatch = hl.match(/increases by (?:\{@damage )?(\d+d\d+)/);
                if (hlMatch) {
                    newSpell.upcastBonus = hlMatch[1];
                } else {
                    hlMatch = hl.match(/(\d+)d(\d+)/);
                    if (hlMatch) {
                        newSpell.upcastBonus = hlMatch[1] + 'd' + hlMatch[2];
                    }
                }
            }
        }
    }

    function ensureSpellModalsExist() {
        if (document.getElementById('pc-spell-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <!-- Spell Modal Overlay -->
            <div id="pc-spell-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            
            <!-- Main Add Spell Modal -->
            <div id="pc-spell-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:600px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);" id="pc-spell-modal-title">Add Spell</h3>
                    <button id="modal-spell-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                
                <input type="hidden" id="modal-spell-level" value="">
                <input type="hidden" id="modal-spell-idx" value="-1">

                <div style="display:flex; border-bottom:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.2);">
                    <button class="btn btn-xs pc-spell-modal-tab active" data-tab="search" style="flex:1; border-radius:0; border:none; border-bottom:2px solid var(--color-gold-base); background:transparent; color:var(--color-text-primary); padding:8px;">Search Database</button>
                    <button class="btn btn-xs pc-spell-modal-tab" data-tab="custom" style="flex:1; border-radius:0; border:none; border-bottom:2px solid transparent; background:transparent; color:var(--color-text-muted); padding:8px;">Custom Spell</button>
                </div>

                <!-- Search Tab -->
                <div id="pc-spell-tab-search" style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="modal-spell-search-input" placeholder="Search spells..." style="flex:1;">
                        <button class="btn btn-secondary btn-sm" id="modal-spell-filter-btn"><i class="fa-solid fa-filter"></i> Filters</button>
                    </div>
                    <!-- Applied filters readout -->
                    <div id="modal-spell-active-filters" style="font-size:0.75rem; color:var(--color-gold-base); display:none;"></div>
                    <div id="modal-spell-search-results" style="border:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.3); flex:1; min-height:300px; overflow-y:auto; padding:4px;">
                        <div style="padding:12px; text-align:center; color:var(--color-text-muted);">Loading spells...</div>
                    </div>
                </div>

                <!-- Custom Tab -->
                <div id="pc-spell-tab-custom" class="vtt-hidden" style="padding:16px; overflow-y:auto; flex:1;">
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Spell Name</label>
                        <input type="text" id="modal-spell-name" style="width:100%;">
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Casting Time</label>
                            <input type="text" id="modal-spell-time" placeholder="e.g. 1 action" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Range</label>
                            <input type="text" id="modal-spell-range" placeholder="e.g. 120 feet" style="width:100%;">
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <div class="form-group" style="flex:1;">
                            <label>Components</label>
                            <input type="text" id="modal-spell-components" placeholder="e.g. V, S, M" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Duration</label>
                            <input type="text" id="modal-spell-duration" placeholder="e.g. 1 round" style="width:100%;">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:12px;">
                        <label>Spell Description (Optional)</label>
                        <textarea id="modal-spell-desc" style="width:100%; min-height:80px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:8px; font-family:var(--font-primary); font-size:0.8rem;"></textarea>
                    </div>
                    <h4 style="margin:8px 0; color:var(--color-gold-base);">Attack & Macro Settings</h4>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Macro Description (Optional Chat Text)</label>
                        <input type="text" id="modal-spell-macro-desc" placeholder="e.g. You hurl a mote of fire." style="width:100%;">
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Attack Roll</label>
                            <select id="modal-spell-atk-stat" style="width:100%;">
                                <option value="none">None</option>
                                <option value="spell">Spellcasting Stat</option>
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Proficient</label>
                            <div style="padding-top:4px;"><input type="checkbox" id="modal-spell-atk-prof"></div>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Extra Atk Bonus</label>
                            <input type="number" id="modal-spell-atk-extra" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Custom Bonus</label>
                            <input type="text" id="modal-spell-atk-custom" placeholder="e.g. 1d4+2" style="width:100%;">
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Save DC Stat</label>
                            <select id="modal-spell-save-dc-stat" style="width:100%;">
                                <option value="none">None</option>
                                <option value="spell">Spellcasting Stat</option>
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                                <option value="custom">Custom Fixed</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Extra DC Bonus</label>
                            <input type="number" id="modal-spell-save-dc-extra" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Fixed DC</label>
                            <input type="number" id="modal-spell-save-dc-custom" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Save Type (Target)</label>
                            <select id="modal-spell-save-ability" style="width:100%;">
                                <option value="">None</option>
                                <option value="STR">STR Save</option>
                                <option value="DEX">DEX Save</option>
                                <option value="CON">CON Save</option>
                                <option value="INT">INT Save</option>
                                <option value="WIS">WIS Save</option>
                                <option value="CHA">CHA Save</option>
                            </select>
                        </div>
                    </div>
                    <div id="modal-spell-damage-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
                    <button class="btn btn-secondary btn-xxs" id="btn-add-spell-damage" style="margin-bottom:8px;">+ Add Damage Row</button>
                    <div class="form-group" style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="modal-spell-cantrip-scale">
                        <label style="margin:0;">Enable Cantrip Player Level Scaling</label>
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Upcast Formula (per slot level above base)</label>
                        <input type="text" id="modal-spell-upcast" placeholder="e.g. 1d8" style="width:100%;">
                    </div>
                </div>

                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2);">
                    <div id="modal-spell-selection-count" style="font-size:0.8rem; color:var(--color-text-muted);">0 spells selected</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="btn btn-danger btn-sm vtt-hidden" id="modal-spell-delete" style="margin-right:16px;">Delete Spell</button>
                        <button class="btn btn-secondary btn-sm" id="modal-spell-cancel">Cancel</button>
                        <button class="btn btn-primary btn-sm" id="modal-spell-save">Bulk Add Selected (0)</button>
                    </div>
                </div>
            </div>

            <!-- Filter Modal -->
            <div id="pc-spell-filter-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1001; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Filter Spells</h3>
                    <button id="modal-spell-filter-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <div class="form-group">
                        <label>Level</label>
                        <select id="modal-spell-filter-level" style="width:100%;">
                            <option value="">Any Level</option>
                            <option value="0">Cantrip</option>
                            <option value="1">1st Level</option>
                            <option value="2">2nd Level</option>
                            <option value="3">3rd Level</option>
                            <option value="4">4th Level</option>
                            <option value="5">5th Level</option>
                            <option value="6">6th Level</option>
                            <option value="7">7th Level</option>
                            <option value="8">8th Level</option>
                            <option value="9">9th Level</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>School</label>
                        <select id="modal-spell-filter-school" style="width:100%;">
                            <option value="">Any School</option>
                            <option value="A">Abjuration</option>
                            <option value="C">Conjuration</option>
                            <option value="D">Divination</option>
                            <option value="E">Enchantment</option>
                            <option value="V">Evocation</option>
                            <option value="I">Illusion</option>
                            <option value="N">Necromancy</option>
                            <option value="T">Transmutation</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Class</label>
                        <select id="modal-spell-filter-class" style="width:100%;">
                            <option value="">Any Class</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Subclass</label>
                        <select id="modal-spell-filter-subclass" style="width:100%;">
                            <option value="">Any Subclass</option>
                        </select>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.2);">
                    <button class="btn btn-secondary btn-sm" id="modal-spell-filter-clear">Clear Filters</button>
                    <button class="btn btn-primary btn-sm" id="modal-spell-filter-apply">Apply Filters</button>
                </div>
            </div>
            
            <!-- Spell Settings Modal -->
            <div id="pc-spell-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:500px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Spell Settings & Toggles</h3>
                    <button id="modal-spell-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; gap:12px;">
                        <div class="form-group" style="flex:1;">
                            <label>Spellcasting Ability</label>
                            <select id="modal-settings-ability" style="width:100%;">
                                <option value="STR">STR</option>
                                <option value="DEX">DEX</option>
                                <option value="CON">CON</option>
                                <option value="INT">INT</option>
                                <option value="WIS">WIS</option>
                                <option value="CHA">CHA</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label>Add'l Atk Mod</label>
                            <input type="number" id="modal-settings-atk" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label>Add'l DC Mod</label>
                            <input type="number" id="modal-settings-dc" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:80px;">
                            <label>Add'l Dmg Mod</label>
                            <input type="number" id="modal-settings-dmg" value="0" style="width:100%;">
                        </div>
                    </div>
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0;">Toggles</h4>
                            <button id="btn-add-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                        </div>
                        <div id="modal-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                            <input type="hidden" id="modal-toggle-idx" value="-1">
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                <input type="text" id="modal-toggle-name" placeholder="Name (e.g. Bless)" style="flex:1; min-width:120px;">
                                <input type="text" id="modal-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1; min-width:100px;">
                                <select id="modal-toggle-target" style="flex:1; min-width:120px;">
                                    <option value="both">Both</option>
                                    <option value="atk">Attack</option>
                                    <option value="dc">DC (Static Only)</option>
                                    <option value="dmg">Damage</option>
                                </select>
                                <select id="modal-toggle-type" style="flex:1; min-width:120px;">
                                    <option value="">None (Base Damage)</option>
                                    <option value="Slashing">Slashing</option>
                                    <option value="Piercing">Piercing</option>
                                    <option value="Bludgeoning">Bludgeoning</option>
                                    <option value="Fire">Fire</option>
                                    <option value="Cold">Cold</option>
                                    <option value="Lightning">Lightning</option>
                                    <option value="Thunder">Thunder</option>
                                    <option value="Poison">Poison</option>
                                    <option value="Acid">Acid</option>
                                    <option value="Necrotic">Necrotic</option>
                                    <option value="Radiant">Radiant</option>
                                    <option value="Force">Force</option>
                                    <option value="Psychic">Psychic</option>
                                    <option value="Healing">Healing</option>
                                </select>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button id="modal-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                                <button id="modal-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                            </div>
                        </div>
                        <div id="modal-settings-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Toggles injected here -->
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
            </div>
            
            <!-- Attack Settings Modal -->
            <div id="pc-attack-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:500px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Attack Settings & Toggles</h3>
                    <button id="modal-attack-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <div class="form-group" style="flex:1; min-width:100px;">
                            <label>Global Atk Mod</label>
                            <input type="number" id="modal-attack-settings-atk" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:100px;">
                            <label>Global Dmg Mod</label>
                            <input type="number" id="modal-attack-settings-dmg" value="0" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1; min-width:100px;">
                            <label>Global DC Mod</label>
                            <input type="number" id="modal-attack-settings-dc" value="0" style="width:100%;">
                        </div>
                    </div>
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0;">Toggles</h4>
                            <button id="btn-add-attack-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                        </div>
                        <div id="modal-attack-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                            <input type="hidden" id="modal-attack-toggle-idx" value="-1">
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                <input type="text" id="modal-attack-toggle-name" placeholder="Name (e.g. Sharpshooter)" style="flex:1; min-width:120px;">
                                <input type="text" id="modal-attack-toggle-formula" placeholder="Formula (e.g. +2)" style="flex:1; min-width:100px;">
                                <select id="modal-attack-toggle-target" style="flex:1; min-width:120px;">
                                    <option value="both">Both</option>
                                    <option value="atk">Attack</option>
                                    <option value="dmg">Damage</option>
                                    <option value="dc">DC (Static Only)</option>
                                </select>
                                <select id="modal-attack-toggle-type" style="flex:1; min-width:120px;">
                                    <option value="">None (Base Damage)</option>
                                    <option value="Slashing">Slashing</option>
                                    <option value="Piercing">Piercing</option>
                                    <option value="Bludgeoning">Bludgeoning</option>
                                    <option value="Fire">Fire</option>
                                    <option value="Cold">Cold</option>
                                    <option value="Lightning">Lightning</option>
                                    <option value="Thunder">Thunder</option>
                                    <option value="Poison">Poison</option>
                                    <option value="Acid">Acid</option>
                                    <option value="Necrotic">Necrotic</option>
                                    <option value="Radiant">Radiant</option>
                                    <option value="Force">Force</option>
                                    <option value="Psychic">Psychic</option>
                                    <option value="Healing">Healing</option>
                                </select>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button id="modal-attack-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                                <button id="modal-attack-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                            </div>
                        </div>
                        <div id="modal-attack-settings-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Toggles injected here -->
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-attack-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>

            <!-- Upcast Prompt Modal -->
            <div id="modal-spell-upcast-prompt" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:300px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <h4 style="margin:0 0 12px 0; color:var(--color-gold-base);">Cast Spell</h4>
                <div class="form-group" style="margin-bottom:16px;">
                    <label>Cast at what level?</label>
                    <select id="upcast-prompt-level" style="width:100%; padding:6px;"></select>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="upcast-prompt-cancel" class="btn btn-sm btn-secondary">Cancel</button>
                    <button id="upcast-prompt-cast" class="btn btn-sm btn-primary">Cast</button>
                </div>
            </div>
            
            <!-- Delete Prompt Modal -->
            <div id="modal-spell-delete-prompt" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1002; width:300px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <h4 style="margin:0 0 12px 0; color:var(--color-gold-base);">Delete Spell</h4>
                <div class="form-group" style="margin-bottom:16px;">
                    <label style="color:var(--color-text-primary);">Are you sure you want to delete this spell?</label>
                </div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="delete-prompt-cancel" class="btn btn-sm btn-secondary">Cancel</button>
                    <button id="delete-prompt-confirm" class="btn btn-sm btn-danger">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupSpellModalListeners();
        setupSpellSettingsListeners();
        setupAttackSettingsListeners();
    }

    function updateBulkAddButton() {
        const count = spellBulkSelection.size;
        const countEl = document.getElementById('modal-spell-selection-count');
        const saveEl = document.getElementById('modal-spell-save');
        if (countEl) countEl.textContent = `${count} spells selected`;
        if (saveEl) saveEl.textContent = `Bulk Add Selected (${count})`;
    }

    function populateFilterDropdowns() {
        if (!spellCache) return;
        if (window.Renderer?.spell?.getCombinedClasses) {
            spellCache.forEach(sp => {
                const clsList = window.Renderer.spell.getCombinedClasses(sp, "fromClassList") || [];
                const variantList = window.Renderer.spell.getCombinedClasses(sp, "fromClassListVariant") || [];
                clsList.concat(variantList).forEach(c => classSet.add(c.name));
                const subList = window.Renderer.spell.getCombinedClasses(sp, "fromSubclass");
                if (subList) subList.forEach(c => subclassSet.add(c.subclass.name));
            });
            const clsSelect = document.getElementById('modal-spell-filter-class');
            if (clsSelect) {
                Array.from(classSet).sort().forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    clsSelect.appendChild(opt);
                });
            }
            const subSelect = document.getElementById('modal-spell-filter-subclass');
            if (subSelect) {
                Array.from(subclassSet).sort().forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    subSelect.appendChild(opt);
                });
            }
        }
    }

    function renderSpellSearchList() {
        const container = document.getElementById('modal-spell-search-results');
        if (!container) return;
        if (!spellCache) {
            container.innerHTML = '<div style="padding:12px; text-align:center; color:var(--color-text-muted);">Loading spells...</div>';
            if (window.DataUtil?.spell) {
                window.DataUtil.spell.pLoadAll().then(spells => {
                    spellCache = spells;
                    populateFilterDropdowns();
                    renderSpellSearchList();
                });
            } else {
                container.innerHTML = '<div style="padding:12px; text-align:center; color:var(--color-text-muted);">DataUtil not available</div>';
            }
            return;
        }

        const searchStr = document.getElementById('modal-spell-search-input')?.value.toLowerCase() || '';
        const filterLvl = document.getElementById('modal-spell-filter-level')?.value || '';
        const filterSch = document.getElementById('modal-spell-filter-school')?.value || '';
        const filterCls = document.getElementById('modal-spell-filter-class')?.value || '';
        const filterSub = document.getElementById('modal-spell-filter-subclass')?.value || '';

        const filtered = spellCache.filter(sp => {
            if (searchStr && !sp.name.toLowerCase().includes(searchStr)) return false;
            if (filterLvl !== '' && String(sp.level) !== String(filterLvl)) return false;
            if (filterSch !== '' && sp.school !== filterSch) return false;
            if (filterCls !== '' && window.Renderer?.spell?.getCombinedClasses) {
                const clsList = window.Renderer.spell.getCombinedClasses(sp, "fromClassList") || [];
                const variantList = window.Renderer.spell.getCombinedClasses(sp, "fromClassListVariant") || [];
                const combined = clsList.concat(variantList);
                if (!combined.some(c => c.name === filterCls)) return false;
            }
            if (filterSub !== '' && window.Renderer?.spell?.getCombinedClasses) {
                const subList = window.Renderer.spell.getCombinedClasses(sp, "fromSubclass");
                if (!subList || !subList.some(c => c.subclass.name === filterSub)) return false;
            }
            return true;
        });

        const displaySpells = filtered.slice(0, 200);
        if (displaySpells.length === 0) {
            container.innerHTML = '<div style="padding:12px; text-align:center; color:var(--color-text-muted);">No spells found matching filters.</div>';
            return;
        }

        let html = '';
        displaySpells.forEach(sp => {
            const isSelected = spellBulkSelection.has(sp.name);
            html += `
                <label style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; margin:0;">
                    <input type="checkbox" class="spell-bulk-cb" data-name="${sp.name.replace(/"/g, '&quot;')}" ${isSelected ? 'checked' : ''}>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:600; font-size:0.85rem;">${sp.name}</span>
                        <span style="font-size:0.7rem; color:var(--color-text-muted);">Level ${sp.level} • ${sp.source}</span>
                    </div>
                </label>
            `;
        });
        if (filtered.length > 200) {
            html += `<div style="padding:8px; text-align:center; font-size:0.8rem; color:var(--color-text-muted);">Showing 200 of ${filtered.length} results. Please refine search.</div>`;
        }
        container.innerHTML = html;

        container.querySelectorAll('.spell-bulk-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const name = e.currentTarget.dataset.name;
            if (e.currentTarget.checked) {
                spellBulkSelection.add(name);
            } else {
                spellBulkSelection.delete(name);
            }
            updateBulkAddButton();
        }));
    }

    function openSpellModal(level, idx = -1, customChar = null, onSaveCallback = null) {
        ensureSpellModalsExist();
        activeSpellEditContext = { char: customChar || currentChar, onSave: onSaveCallback };
        const lvlInput = document.getElementById('modal-spell-level');
        const idxInput = document.getElementById('modal-spell-idx');
        if (lvlInput) lvlInput.value = level;
        if (idxInput) idxInput.value = idx;

        const tabSearch = document.getElementById('pc-spell-tab-search');
        const tabCustom = document.getElementById('pc-spell-tab-custom');
        const btnSearch = document.querySelector('.pc-spell-modal-tab[data-tab="search"]');
        const btnCustom = document.querySelector('.pc-spell-modal-tab[data-tab="custom"]');

        const char = activeSpellEditContext.char;
        if (idx >= 0 && char) {
            const sp = char.spells[level][idx];
            document.getElementById('pc-spell-modal-title').textContent = "Edit Spell";
            document.getElementById('modal-spell-name').value = sp.name || '';
            let desc = sp.description || '';
            if (!desc && spellCache) {
                const spData = spellCache.find(s => s.name.toLowerCase() === sp.name.toLowerCase());
                if (spData && spData.entries && window.Renderer) {
                    try {
                        const temp = document.createElement('div');
                        temp.innerHTML = window.Renderer.get().render({ entries: spData.entries });
                        desc = temp.textContent || temp.innerText || "";
                    } catch (e) { }
                }
            }
            document.getElementById('modal-spell-desc').value = desc;
            
            const timeEl = document.getElementById('modal-spell-time');
            if (timeEl) timeEl.value = sp.castingTime || '';
            const rangeEl = document.getElementById('modal-spell-range');
            if (rangeEl) rangeEl.value = sp.range || '';
            const compEl = document.getElementById('modal-spell-components');
            if (compEl) compEl.value = sp.components || '';
            const durEl = document.getElementById('modal-spell-duration');
            if (durEl) durEl.value = sp.duration || '';

            const macroDescEl = document.getElementById('modal-spell-macro-desc');
            if (macroDescEl) macroDescEl.value = sp.macroDescription || '';

            document.getElementById('modal-spell-atk-stat').value = sp.attackStat || 'none';
            document.getElementById('modal-spell-atk-prof').checked = !!sp.attackProf;
            document.getElementById('modal-spell-atk-extra').value = sp.attackExtra || 0;
            document.getElementById('modal-spell-atk-custom').value = sp.attackBonus || '';
            document.getElementById('modal-spell-save-dc-stat').value = sp.saveDcStat || 'none';
            document.getElementById('modal-spell-save-dc-extra').value = sp.saveDcExtra || 0;
            document.getElementById('modal-spell-save-dc-custom').value = sp.saveDcCustom ?? '';
            document.getElementById('modal-spell-save-ability').value = sp.saveAbility || '';

            let dmgList = sp.damageList || [];
            if (!sp.damageList && sp.damage) {
                dmgList = [{ formula: sp.damage, type: sp.damageType || '' }];
            }
            modalSpellDamageRows = JSON.parse(JSON.stringify(dmgList));

            const cantripScaleEl = document.getElementById('modal-spell-cantrip-scale');
            if (cantripScaleEl) cantripScaleEl.checked = sp.cantripScale === undefined ? level === 'cantrip' : sp.cantripScale;

            const deleteBtn = document.getElementById('modal-spell-delete');
            if (deleteBtn) {
                deleteBtn.classList.remove('vtt-hidden');
                deleteBtn.dataset.level = level;
                deleteBtn.dataset.idx = idx;
            }

            const upcastEl = document.getElementById('modal-spell-upcast');
            if (upcastEl) upcastEl.value = sp.upcastBonus || '';

            if (tabSearch) tabSearch.classList.add('vtt-hidden');
            if (tabCustom) tabCustom.classList.remove('vtt-hidden');
            if (btnSearch) { btnSearch.classList.remove('active'); btnSearch.style.borderBottomColor = 'transparent'; btnSearch.style.color = 'var(--color-text-muted)'; }
            if (btnCustom) { btnCustom.classList.add('active'); btnCustom.style.borderBottomColor = 'var(--color-gold-base)'; btnCustom.style.color = 'var(--color-text-primary)'; }
            const saveBtn = document.getElementById('modal-spell-save');
            if (saveBtn) saveBtn.textContent = "Save Changes";
        } else {
            spellBulkSelection.clear();
            const titleEl = document.getElementById('pc-spell-modal-title');
            if (titleEl) titleEl.textContent = "Add Spell";
            const nameInput = document.getElementById('modal-spell-name');
            if (nameInput) nameInput.value = '';
            const descInput = document.getElementById('modal-spell-desc');
            if (descInput) descInput.value = '';
            const macroDescInput = document.getElementById('modal-spell-macro-desc');
            if (macroDescInput) macroDescInput.value = '';

            const atkStatInput = document.getElementById('modal-spell-atk-stat');
            if (atkStatInput) atkStatInput.value = 'none';
            const atkProfInput = document.getElementById('modal-spell-atk-prof');
            if (atkProfInput) atkProfInput.checked = false;
            const atkExtraInput = document.getElementById('modal-spell-atk-extra');
            if (atkExtraInput) atkExtraInput.value = '0';
            const atkCustomInput = document.getElementById('modal-spell-atk-custom');
            if (atkCustomInput) atkCustomInput.value = '';
            const saveDcStatInput = document.getElementById('modal-spell-save-dc-stat');
            if (saveDcStatInput) saveDcStatInput.value = 'none';
            const saveDcExtraInput = document.getElementById('modal-spell-save-dc-extra');
            if (saveDcExtraInput) saveDcExtraInput.value = '0'; const saveDcCustomInput = document.getElementById('modal-spell-save-dc-custom');
            if (saveDcCustomInput) saveDcCustomInput.value = '';
            const saveAbilityInput = document.getElementById('modal-spell-save-ability');
            if (saveAbilityInput) saveAbilityInput.value = '';
            modalSpellDamageRows = [];

            const cantripScaleEl = document.getElementById('modal-spell-cantrip-scale');
            if (cantripScaleEl) cantripScaleEl.checked = level === 'cantrip';

            const deleteBtn = document.getElementById('modal-spell-delete');
            if (deleteBtn) deleteBtn.classList.add('vtt-hidden');

            const upcastInput = document.getElementById('modal-spell-upcast');
            if (upcastInput) upcastInput.value = '';

            if (tabCustom) tabCustom.classList.add('vtt-hidden');
            if (tabSearch) tabSearch.classList.remove('vtt-hidden');
            if (btnCustom) { btnCustom.classList.remove('active'); btnCustom.style.borderColor = 'transparent'; btnCustom.style.color = 'var(--color-text-muted)'; }
            if (btnSearch) { btnSearch.classList.add('active'); btnSearch.style.borderColor = 'var(--color-gold-base)'; btnSearch.style.color = 'var(--color-text-primary)'; }
            const saveBtn = document.getElementById('modal-spell-save');
            if (saveBtn) saveBtn.textContent = "Add Spells";

            const lvlMap = { cantrip: '0', level1: '1', level2: '2', level3: '3', level4: '4', level5: '5', level6: '6', level7: '7', level8: '8', level9: '9' };
            const startingLvl = lvlMap[level] || '';
            const flvl = document.getElementById('modal-spell-filter-level');
            if (flvl) flvl.value = startingLvl;
            const fsch = document.getElementById('modal-spell-filter-school');
            if (fsch) fsch.value = '';
            const fcls = document.getElementById('modal-spell-filter-class');
            if (fcls) fcls.value = '';
            const fsub = document.getElementById('modal-spell-filter-subclass');
            if (fsub) fsub.value = '';
            const sInp = document.getElementById('modal-spell-search-input');
            if (sInp) sInp.value = '';

            const activeEl = document.getElementById('modal-spell-active-filters');
            if (activeEl) {
                activeEl.style.display = 'none';
            }
            updateBulkAddButton();
            renderSpellSearchList();
        }

        renderModalSpellDamage();
        const modal = document.getElementById('pc-spell-modal');
        const overlay = document.getElementById('pc-spell-overlay');
        if (modal) modal.classList.remove('vtt-hidden');
        if (overlay) overlay.classList.remove('vtt-hidden');
    }

    function closeSpellModal() {
        document.getElementById('pc-spell-overlay')?.classList.add('vtt-hidden');
        document.getElementById('pc-spell-modal')?.classList.add('vtt-hidden');
        document.getElementById('pc-spell-filter-modal')?.classList.add('vtt-hidden');
    }

    function renderModalSpellDamage() {
        const list = document.getElementById('modal-spell-damage-list');
        if (!list) return;
        const dmgTypes = ["Slashing", "Piercing", "Bludgeoning", "Fire", "Cold", "Lightning", "Thunder", "Poison", "Acid", "Necrotic", "Radiant", "Force", "Psychic", "Healing"];
        list.innerHTML = modalSpellDamageRows.map((d, i) => `
            <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                <input type="text" class="modal-spell-dmg-formula" data-idx="${i}" value="${d.formula || ''}" placeholder="1d8" style="width:40%; padding:4px; font-size:0.8rem;">
                <select class="modal-spell-dmg-type" data-idx="${i}" style="width:40%; padding:4px; font-size:0.8rem;">
                    <option value="">Type</option>
                    ${dmgTypes.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <button class="btn btn-xs btn-secondary modal-spell-dmg-del" data-idx="${i}" style="width:20%;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

        document.querySelectorAll('.modal-spell-dmg-formula').forEach(el => el.addEventListener('change', (e) => modalSpellDamageRows[e.target.dataset.idx].formula = e.target.value));
        document.querySelectorAll('.modal-spell-dmg-type').forEach(el => el.addEventListener('change', (e) => modalSpellDamageRows[e.target.dataset.idx].type = e.target.value));
        document.querySelectorAll('.modal-spell-dmg-del').forEach(el => el.addEventListener('click', (e) => {
            modalSpellDamageRows.splice(e.currentTarget.dataset.idx, 1);
            renderModalSpellDamage();
        }));
    }

    function setupSpellModalListeners() {
        document.getElementById('pc-spell-overlay')?.addEventListener('click', closeSpellModal);
        document.getElementById('modal-spell-close')?.addEventListener('click', closeSpellModal);
        document.getElementById('modal-spell-cancel')?.addEventListener('click', closeSpellModal);

        document.querySelectorAll('.pc-spell-modal-tab').forEach(btn => btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            const tabSearch = document.getElementById('pc-spell-tab-search');
            const tabCustom = document.getElementById('pc-spell-tab-custom');
            const btnSearch = document.querySelector('.pc-spell-modal-tab[data-tab="search"]');
            const btnCustom = document.querySelector('.pc-spell-modal-tab[data-tab="custom"]');

            if (tab === 'search') {
                if (tabCustom) tabCustom.classList.add('vtt-hidden');
                if (tabSearch) tabSearch.classList.remove('vtt-hidden');
                if (btnCustom) { btnCustom.classList.remove('active'); btnCustom.style.borderBottomColor = 'transparent'; btnCustom.style.color = 'var(--color-text-muted)'; }
                if (btnSearch) { btnSearch.classList.add('active'); btnSearch.style.borderBottomColor = 'var(--color-gold-base)'; btnSearch.style.color = 'var(--color-text-primary)'; }
                const saveBtn = document.getElementById('modal-spell-save');
                if (saveBtn) saveBtn.textContent = 'Add Spells';
            } else {
                if (tabSearch) tabSearch.classList.add('vtt-hidden');
                if (tabCustom) tabCustom.classList.remove('vtt-hidden');
                if (btnSearch) { btnSearch.classList.remove('active'); btnSearch.style.borderBottomColor = 'transparent'; btnSearch.style.color = 'var(--color-text-muted)'; }
                if (btnCustom) { btnCustom.classList.add('active'); btnCustom.style.borderBottomColor = 'var(--color-gold-base)'; btnCustom.style.color = 'var(--color-text-primary)'; }
                const saveBtn = document.getElementById('modal-spell-save');
                if (saveBtn) saveBtn.textContent = document.getElementById('modal-spell-idx').value >= 0 ? 'Save Changes' : 'Add Spell';
            }
        }));

        document.getElementById('modal-spell-delete')?.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            if (level && idx !== undefined) {
                const promptModal = document.getElementById('modal-spell-delete-prompt');
                if (promptModal) {
                    promptModal.classList.remove('vtt-hidden');
                    const confirmBtn = document.getElementById('delete-prompt-confirm');
                    if (confirmBtn) {
                        confirmBtn.dataset.level = level;
                        confirmBtn.dataset.idx = idx;
                    }
                }
            }
        });

        document.getElementById('delete-prompt-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-spell-delete-prompt')?.classList.add('vtt-hidden');
        });

        document.getElementById('delete-prompt-confirm')?.addEventListener('click', (e) => {
            const char = currentChar;
            if (!char) return;
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            if (level && idx !== undefined) {
                char.spells[level].splice(idx, 1);
                document.getElementById('modal-spell-delete-prompt')?.classList.add('vtt-hidden');
                closeSpellModal();
                saveAndEmit(char);
                renderSheetData(char);
            }
        });

        document.getElementById('btn-add-spell-damage')?.addEventListener('click', () => {
            modalSpellDamageRows.push({ id: 'dmg_' + Date.now(), formula: '1d8', type: '' });
            renderModalSpellDamage();
        });

        function updateFilterReadout() {
            const filterLvl = document.getElementById('modal-spell-filter-level').value;
            const filterSch = document.getElementById('modal-spell-filter-school').value;
            const filterCls = document.getElementById('modal-spell-filter-class').value;
            const filterSub = document.getElementById('modal-spell-filter-subclass').value;
            const activeEl = document.getElementById('modal-spell-active-filters');
            let txt = [];
            if (filterLvl) txt.push(`Level: ${filterLvl}`);
            if (filterSch) txt.push(`School: ${filterSch}`);
            if (filterCls) txt.push(`Class: ${filterCls}`);
            if (filterSub) txt.push(`Subclass: ${filterSub}`);
            if (txt.length > 0) {
                activeEl.textContent = `Active Filters: ${txt.join(', ')}`;
                activeEl.style.display = 'block';
            } else {
                activeEl.style.display = 'none';
            }
        }

        document.getElementById('modal-spell-filter-apply')?.addEventListener('click', () => {
            updateFilterReadout();
            renderSpellSearchList();
            document.getElementById('pc-spell-filter-modal').classList.add('vtt-hidden');
        });

        document.getElementById('modal-spell-filter-clear')?.addEventListener('click', () => {
            document.getElementById('modal-spell-filter-level').value = '';
            document.getElementById('modal-spell-filter-school').value = '';
            document.getElementById('modal-spell-filter-class').value = '';
            document.getElementById('modal-spell-filter-subclass').value = '';
            updateFilterReadout();
            renderSpellSearchList();
        });

        document.getElementById('modal-spell-filter-close')?.addEventListener('click', () => {
            document.getElementById('pc-spell-filter-modal').classList.add('vtt-hidden');
        });

        document.getElementById('modal-spell-search-input')?.addEventListener('input', () => {
            renderSpellSearchList();
        });

        document.getElementById('modal-spell-filter-btn')?.addEventListener('click', () => {
            document.getElementById('pc-spell-filter-modal').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-spell-save')?.addEventListener('click', () => {
            const char = activeSpellEditContext && activeSpellEditContext.char ? activeSpellEditContext.char : currentChar;
            if (!char) return;
            const isCustomTab = !document.getElementById('pc-spell-tab-custom').classList.contains('vtt-hidden');
            const targetLevel = document.getElementById('modal-spell-level').value;

            if (isCustomTab) {
                const level = targetLevel;
                const idx = parseInt(document.getElementById('modal-spell-idx').value);
                const name = document.getElementById('modal-spell-name').value.trim();
                const description = document.getElementById('modal-spell-desc').value;
                const castingTime = document.getElementById('modal-spell-time')?.value || '';
                const range = document.getElementById('modal-spell-range')?.value || '';
                const components = document.getElementById('modal-spell-components')?.value || '';
                const duration = document.getElementById('modal-spell-duration')?.value || '';
                const macroDescription = document.getElementById('modal-spell-macro-desc')?.value || '';
                const attackStat = document.getElementById('modal-spell-atk-stat').value;
                const attackProf = document.getElementById('modal-spell-atk-prof').checked;
                const attackExtra = parseInt(document.getElementById('modal-spell-atk-extra').value) || 0;
                const attackBonus = document.getElementById('modal-spell-atk-custom').value;
                const saveDcStat = document.getElementById('modal-spell-save-dc-stat').value;
                const saveDcExtra = parseInt(document.getElementById('modal-spell-save-dc-extra').value) || 0;
                const saveDcCustom = document.getElementById('modal-spell-save-dc-custom').value !== '' ? parseInt(document.getElementById('modal-spell-save-dc-custom').value) : null;
                const saveAbility = document.getElementById('modal-spell-save-ability').value;
                const damageList = modalSpellDamageRows;
                const cantripScale = document.getElementById('modal-spell-cantrip-scale') ? document.getElementById('modal-spell-cantrip-scale').checked : false;
                const upcastBonus = document.getElementById('modal-spell-upcast').value;

                if (!name) return alert("Spell name is required.");
                if (!char.spells) char.spells = {};
                if (!char.spells[level]) char.spells[level] = [];

                if (idx >= 0) {
                    char.spells[level][idx] = { ...char.spells[level][idx], name, description, castingTime, range, components, duration, macroDescription, attackStat, attackProf, attackExtra, attackBonus, saveDcStat, saveDcExtra, saveDcCustom, saveAbility, damageList, cantripScale, upcastBonus };
                } else {
                    char.spells[level].push({ id: 'sp_' + Date.now() + Math.random(), name, description, castingTime, range, components, duration, macroDescription, prepared: false, attackStat, attackProf, attackExtra, attackBonus, saveDcStat, saveDcExtra, saveDcCustom, saveAbility, damageList, cantripScale, upcastBonus });
                }
            } else {
                if (spellBulkSelection.size === 0) return alert("No spells selected.");
                const lvlMapInverse = { 0: 'cantrip', 1: 'level1', 2: 'level2', 3: 'level3', 4: 'level4', 5: 'level5', 6: 'level6', 7: 'level7', 8: 'level8', 9: 'level9' };

                Array.from(spellBulkSelection).forEach(spellName => {
                    const spData = spellCache.find(s => s.name === spellName);
                    if (spData) {
                        const levelKey = lvlMapInverse[spData.level] || targetLevel;
                        if (!char.spells) char.spells = {};
                        if (!char.spells[levelKey]) char.spells[levelKey] = [];
                        if (!char.spells[levelKey].find(s => s.name === spellName)) {
                            const newSpell = { id: 'sp_' + Date.now() + Math.random(), name: spellName, description: '', prepared: false };
                            parseSpellToMacro(spData, newSpell);
                            char.spells[levelKey].push(newSpell);
                        }
                    }
                });
            }

            closeSpellModal();
            if (activeSpellEditContext && activeSpellEditContext.onSave) {
                activeSpellEditContext.onSave(char);
            } else {
                saveAndEmit(char);
                renderSheetData(char);
            }
        });
    }

    function renderTogglesList() {
        const list = document.getElementById('modal-settings-toggles-list');
        if (!list) return;
        const char = currentChar;
        if (!char || !char.spellSettings || !char.spellSettings.toggles) {
            list.innerHTML = '';
            return;
        }

        let html = '';
        char.spellSettings.toggles.forEach((t, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                        <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                        <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${t.target.toUpperCase()}</span>
                        ${t.dmgType ? `<span style="color:var(--color-text-subtle); font-size:0.7rem; border:1px solid currentColor; border-radius:4px; padding:1px 3px;">${t.dmgType}</span>` : ''}
                        <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-xxs btn-secondary toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-secondary toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        list.querySelectorAll('.toggle-enable-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.spellSettings.toggles[idx].enabled = e.currentTarget.checked;
        }));

        list.querySelectorAll('.toggle-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.spellSettings.toggles[idx];
            document.getElementById('modal-toggle-idx').value = idx;
            document.getElementById('modal-toggle-name').value = t.name;
            document.getElementById('modal-toggle-formula').value = t.formula;
            document.getElementById('modal-toggle-target').value = t.target;
            document.getElementById('modal-toggle-type').value = t.dmgType || '';
            document.getElementById('modal-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.add('vtt-hidden');
        }));

        list.querySelectorAll('.toggle-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this toggle?")) {
                const idx = e.currentTarget.dataset.idx;
                char.spellSettings.toggles.splice(idx, 1);
                renderTogglesList();
            }
        }));
    }

    function renderAttackTogglesList() {
        const list = document.getElementById('modal-attack-settings-toggles-list');
        if (!list) return;
        const char = currentChar;
        if (!char || !char.attackSettings || !char.attackSettings.toggles) {
            list.innerHTML = '';
            return;
        }

        let html = '';
        char.attackSettings.toggles.forEach((t, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="attack-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                        <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                        <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${t.target.toUpperCase()}</span>
                        ${t.dmgType ? `<span style="color:var(--color-text-subtle); font-size:0.7rem; border:1px solid currentColor; border-radius:4px; padding:1px 3px;">${t.dmgType}</span>` : ''}
                        <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-xxs btn-secondary attack-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-secondary attack-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        list.querySelectorAll('.attack-toggle-enable-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.attackSettings.toggles[idx].enabled = e.currentTarget.checked;
        }));

        list.querySelectorAll('.attack-toggle-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.attackSettings.toggles[idx];
            document.getElementById('modal-attack-toggle-idx').value = idx;
            document.getElementById('modal-attack-toggle-name').value = t.name;
            document.getElementById('modal-attack-toggle-formula').value = t.formula;
            document.getElementById('modal-attack-toggle-target').value = t.target;
            document.getElementById('modal-attack-toggle-type').value = t.dmgType || '';
            document.getElementById('modal-attack-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.add('vtt-hidden');
        }));

        list.querySelectorAll('.attack-toggle-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this toggle?")) {
                const idx = e.currentTarget.dataset.idx;
                char.attackSettings.toggles.splice(idx, 1);
                renderAttackTogglesList();
            }
        }));
    }

    function setupAttackSettingsListeners() {
        document.getElementById('modal-attack-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-attack-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-attack-toggle')?.addEventListener('click', () => {
            document.getElementById('modal-attack-toggle-idx').value = '-1';
            document.getElementById('modal-attack-toggle-name').value = '';
            document.getElementById('modal-attack-toggle-formula').value = '';
            document.getElementById('modal-attack-toggle-target').value = 'both';
            document.getElementById('modal-attack-toggle-type').value = '';
            document.getElementById('modal-attack-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.add('vtt-hidden');
        });

        document.getElementById('modal-attack-toggle-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-attack-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-attack-toggle-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-attack-toggle-idx').value);
            const name = document.getElementById('modal-attack-toggle-name').value.trim();
            const formula = document.getElementById('modal-attack-toggle-formula').value.trim();
            const target = document.getElementById('modal-attack-toggle-target').value;
            const dmgType = document.getElementById('modal-attack-toggle-type').value;
            if (!name || !formula) return alert("Name and Formula are required.");

            const t = { id: 'atk_tgl_' + Date.now(), name, formula, target, dmgType, enabled: true };
            if (idx >= 0) {
                currentChar.attackSettings.toggles[idx] = t;
            } else {
                currentChar.attackSettings.toggles.push(t);
            }
            document.getElementById('modal-attack-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-attack-toggle').classList.remove('vtt-hidden');
            renderAttackTogglesList();
        });

        document.getElementById('modal-attack-settings-save')?.addEventListener('click', () => {
            currentChar.attackSettings.atkMod = parseInt(document.getElementById('modal-attack-settings-atk').value) || 0;
            currentChar.attackSettings.dmgMod = parseInt(document.getElementById('modal-attack-settings-dmg').value) || 0;
            currentChar.attackSettings.dcMod = parseInt(document.getElementById('modal-attack-settings-dc').value) || 0;
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-attack-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });
    }

    function setupSpellSettingsListeners() {
        document.getElementById('modal-spell-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-spell-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-toggle')?.addEventListener('click', () => {
            document.getElementById('modal-toggle-idx').value = '-1';
            document.getElementById('modal-toggle-name').value = '';
            document.getElementById('modal-toggle-formula').value = '';
            document.getElementById('modal-toggle-target').value = 'both';
            document.getElementById('modal-toggle-type').value = '';
            document.getElementById('modal-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.add('vtt-hidden');
        });

        document.getElementById('modal-toggle-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-toggle-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-toggle-idx').value);
            const name = document.getElementById('modal-toggle-name').value.trim();
            const formula = document.getElementById('modal-toggle-formula').value.trim();
            const target = document.getElementById('modal-toggle-target').value;
            const dmgType = document.getElementById('modal-toggle-type').value;
            if (!name || !formula) return alert("Name and Formula are required.");

            const t = { id: 'tgl_' + Date.now(), name, formula, target, dmgType, enabled: true };
            if (idx >= 0) {
                currentChar.spellSettings.toggles[idx] = t;
            } else {
                currentChar.spellSettings.toggles.push(t);
            }
            document.getElementById('modal-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-toggle').classList.remove('vtt-hidden');
            renderTogglesList();
        });

        document.getElementById('modal-settings-save')?.addEventListener('click', () => {
            currentChar.spellSettings.ability = document.getElementById('modal-settings-ability').value;
            currentChar.spellSettings.atkMod = parseInt(document.getElementById('modal-settings-atk').value) || 0;
            currentChar.spellSettings.dcMod = parseInt(document.getElementById('modal-settings-dc').value) || 0;
            currentChar.spellSettings.dmgMod = parseInt(document.getElementById('modal-settings-dmg').value) || 0;
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-spell-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-spell-overlay').classList.add('vtt-hidden');
        });
    }

    // Expose global API
    window.VTTSpellManager = {
        init: (ctx) => {
            currentChar = ctx.currentChar;
            saveAndEmit = ctx.saveAndEmit;
            renderSheetData = ctx.renderSheetData;
            spellCache = ctx.spellCache;
        },
        openModal: (level, idx, customChar, onSaveCallback) => {
            openSpellModal(level, idx, customChar, onSaveCallback);
        },
        getSpellCache: () => spellCache,
        setSpellCache: (cache) => { spellCache = cache; },
        parseSpellToMacro: (spData, newSpell) => parseSpellToMacro(spData, newSpell),
        ensureSpellModalsExist: () => ensureSpellModalsExist()
    };
}
