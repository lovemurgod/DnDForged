import { RenderSpells } from './render-spells.js?v=2';
export function initVttPlayerSheet(vtt) {
    const panel = document.getElementById('player-sheet-panel');
    const minimizeBtn = document.getElementById('player-sheet-minimize-btn');
    const contentEl = document.getElementById('player-sheet-content');
    const activeSheetEl = document.getElementById('player-sheet-active');
    const placeholderEl = document.getElementById('player-sheet-placeholder');
    const tabCharacters = document.getElementById('tab-characters');
    const charListEl = document.getElementById('character-list');
    const btnCharAdd = document.getElementById('btn-char-add');

    if (!panel || !minimizeBtn || !contentEl) {
        console.warn('[PlayerSheet] Panel elements not found in DOM.');
        return {};
    }

    let isMinimized = false;
    let currentChar = null;
    let spellCache = null;
    let builderCache = null;
    let activeSpellTab = 'cantrip';

        function injectDiceChips(text) {
        if (!text) return '';
        let result = text;
        result = result.replace(/(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?(?![^<]*>)/gi, (match, count, faces, sign, mod) => {
            let formula = `${count}d${faces}`;
            if (sign && mod) formula += `${sign}${mod}`;
            return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${match.trim()}</button>`;
        });
        result = result.replace(/\+(\d+)\s+to\s+hit(?![^<]*>)/gi, (match, bonus) => {
            const formula = `1d20+${bonus}`;
            return `<button class="dice-chip" data-formula="${formula}" title="Roll attack: ${formula}">+${bonus} to hit</button>`;
        });
        result = result.replace(/DC\s+(\d+)(?![^<]*>)/gi, (match, dcVal) => {
            return `<button class="dice-chip dc-chip" data-dc="${dcVal}" style="border-color: var(--color-gold-base);" title="Ping DC ${dcVal} to Chat">DC ${dcVal}</button>`;
        });
        return result;
    }

    function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp) {
        if (!spellCache) return;
        
        const spell = spellCache.find(s => s.name.toLowerCase() === spellName.toLowerCase());
        let metaHtml = '';
        if (window.Parser) {
            let time = sp?.castingTime || (spell ? Parser.spTimeListToFull(spell.time, spell.meta) : '');
            let range = sp?.range || (spell ? Parser.spRangeToFull(spell.range) : '');
            let components = sp?.components || (spell ? Parser.spComponentsToFull(spell.components, spell.level) : '');
            let duration = sp?.duration || (spell ? Parser.spDurationToFull(spell.duration) : '');
            
            time = typeof time === 'string' ? time : (spell ? Parser.spTimeListToFull(spell.time, spell.meta) : '');
            range = typeof range === 'string' ? range : (spell ? Parser.spRangeToFull(spell.range) : '');
            components = typeof components === 'string' ? components : (spell ? Parser.spComponentsToFull(spell.components, spell.level) : '');
            duration = typeof duration === 'string' ? duration : (spell ? Parser.spDurationToFull(spell.duration) : '');
            
            metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
            if (time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${time}</div>`;
            if (range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${range}</div>`;
            if (components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${components}</div>`;
            if (duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${duration}</div>`;
            metaHtml += '</div>';
        }

        if (fallbackDesc && fallbackDesc.trim() !== '') {
            containerEl.innerHTML = metaHtml + `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>`;
            return;
        }
        if (spell && RenderSpells) {
            let rawRender = RenderSpells.getRenderedSpell(spell);
            let html = "";
            if (typeof rawRender === "string") {
                html = rawRender;
            } else {
                const temp = document.createElement("table");
                try {
                    if (rawRender.appendTo) rawRender.appendTo(temp);
                    else temp.appendChild(rawRender);
                    html = temp.innerHTML;
                } catch (e) {
                    html = rawRender.outerHTML || rawRender.innerHTML || String(rawRender);
                }
            }
            html = html.replace(/<\/?tbody[^>]*>/g, '').replace(/<\/?tr[^>]*>/g, '').replace(/<\/?td[^>]*>/g, '<div>').replace(/<\/td>/g, '</div>');
            html = html.replace(/<div><b>(?:Casting Time|Range|Components|Duration):<\/b>.*?<\/div>/ig, '');
            html = injectDiceChips(html);
            containerEl.innerHTML = metaHtml + html;
        } else {
            containerEl.innerHTML = fallbackDesc ? `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>` : `<em>Could not find full text for ${spellName}</em>`;
        }
    }

    function promptUpcastLevel(baseLvl, callback) {
        const modal = document.getElementById('modal-spell-upcast-prompt');
        const select = document.getElementById('upcast-prompt-level');
        select.innerHTML = '';
        for (let i = baseLvl; i <= 9; i++) {
            select.innerHTML += `<option value="${i}">${i}${i===1?'st':i===2?'nd':i===3?'rd':'th'} Level${i === baseLvl ? ' (Base)' : ''}</option>`;
        }
        modal.classList.remove('vtt-hidden');
        
        const handleCast = () => {
            cleanup();
            callback(parseInt(select.value));
        };
        const handleCancel = () => {
            cleanup();
            callback(null);
        };
        const cleanup = () => {
            modal.classList.add('vtt-hidden');
            document.getElementById('upcast-prompt-cast').removeEventListener('click', handleCast);
            document.getElementById('upcast-prompt-cancel').removeEventListener('click', handleCancel);
        };
        
        document.getElementById('upcast-prompt-cast').addEventListener('click', handleCast);
        document.getElementById('upcast-prompt-cancel').addEventListener('click', handleCancel);
    }

function simulateRoll(formula, critRange = 20) {
    if (!window.Renderer || !window.Renderer.dice || !window.Renderer.dice.lang) return null;

    // Advantage / Disadvantage handling
    let isAdvantage = false;
    let isDisadvantage = false;
    
    if (formula.match(/^1d20/i)) {
        let rollMode = window.VTT ? window.VTT.currentRollMode : 'normal';
        const evt = window.event;
        if (evt && evt.shiftKey) rollMode = 'adv';
        else if (evt && evt.ctrlKey) rollMode = 'dis';
        if (rollMode === 'adv') isAdvantage = true;
        if (rollMode === 'dis') isDisadvantage = true;
    }

    let strippedFormula = formula.replace(/\[.*?\]/g, '');
    
    if (isAdvantage) strippedFormula = strippedFormula.replace(/^1d20/i, '2d20kh1');
    if (isDisadvantage) strippedFormula = strippedFormula.replace(/^1d20/i, '2d20kl1');

    let wrpTree;
    try {
        wrpTree = window.Renderer.dice.lang.getTree3(strippedFormula.toLowerCase());
    } catch(e) {
        return null;
    }

    if (!wrpTree) return null;

    const meta = {};
    const total = wrpTree.tree.evl(meta);

    let breakdownStr = (meta.html || []).join("");
    
    // Critical Hit detection
    let isCritSuccess = false;
    let isCritFail = false;
    const diceList = meta.diceList || [];
    if (strippedFormula.match(/d20/i)) {
        const firstD20 = diceList.find(d => d.faces === 20 && !d.isDropped);
        if (firstD20) {
            if (firstD20.val >= critRange) isCritSuccess = true;
            if (firstD20.val === 1) isCritFail = true;
        }
    }

    return {
        formula,
        diceList,
        total,
        breakdownStr,
        isCritSuccess,
        isCritFail
    };
}

    window.vttPlayerSheetAPI = {
        getSpellCache: () => spellCache,
        setSpellCache: (cache) => { spellCache = cache; },
        getSpellMetaStrings: (sp) => ({}),
        simulateRoll: (formula, crit) => simulateRoll(formula, crit),
        parseSpellToMacro: (spData, newSpell) => window.VTTSpellManager?.parseSpellToMacro(spData, newSpell),
        renderAndInjectSpell: (spellName, containerEl, fallbackDesc, spData) => renderAndInjectSpell(spellName, containerEl, fallbackDesc, spData),
        renderSpellRowHtml: (sp, slKey, idx, isAllTab) => {
            const opacity = (sp.prepared === false && slKey !== 'cantrip' && slKey !== 'legacy') ? 'opacity: 0.6;' : '';
            let badges = '';
            const spText = JSON.stringify(sp).toLowerCase();
            let isConcentration = sp.concentration;
            let isRitual = sp.ritual;

            if (isConcentration === undefined || isRitual === undefined) {
                const spellCache = window.vttPlayerSheetAPI?.getSpellCache ? window.vttPlayerSheetAPI.getSpellCache() : null;
                const cachedSp = spellCache?.find(s => s.name && s.name.toLowerCase() === (sp.name || '').toLowerCase());
                if (cachedSp) {
                    if (isConcentration === undefined) {
                        isConcentration = !!(cachedSp.duration?.some(d => d.concentration) || cachedSp.meta?.concentration);
                    }
                    if (isRitual === undefined) {
                        isRitual = !!cachedSp.meta?.ritual;
                    }
                }
            }

            if (isConcentration === undefined) {
                isConcentration = (Array.isArray(sp.duration) && sp.duration.some(d => d.concentration)) || spText.includes("concentration");
            }
            if (isRitual === undefined) {
                isRitual = (sp.meta && sp.meta.ritual) || spText.includes("ritual");
            }

            if (isConcentration) {
                badges += `<span class="badge badge-c" style="background:#f44336; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Concentration">C</span>`;
            }
            if (isRitual) {
                badges += `<span class="badge badge-r" style="background:#2196f3; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Ritual">R</span>`;
            }

            return `
                <div class="spell-row cs-spell-item glassmorphism" data-spell-name="${sp.name.toLowerCase().replace(/"/g, '&quot;')}" style="padding:8px; display:flex; flex-direction:column; gap:4px; ${opacity}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="pc-spell-prep-toggle" data-level="${slKey}" data-idx="${idx}" style="cursor: pointer; color: var(--color-gold-base); font-size: 0.8rem; display: ${slKey === 'cantrip' || slKey === 'legacy' ? 'none' : 'block'};">
                                <i class="${sp.prepared !== false ? 'fa-solid' : 'fa-regular'} fa-circle"></i>
                            </div>
                            <div class="pc-spell-expand-btn" title="Expand Details" style="cursor: pointer; color: var(--color-text-muted); font-size: 0.7rem;">
                                <i class="fa-solid fa-scroll"></i>
                                <i class="fa-solid fa-chevron-right" style="transition:transform 0.2s;"></i>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <div class="pc-spell-post-chat" data-level="${slKey}" data-idx="${idx}" style="cursor:pointer;" title="Post Spellcard to Chat">
                                    <i class="fa-solid fa-wand-magic-sparkles text-gradient-gold"></i>
                                </div>
                                <div class="pc-spell-ping-macro" data-level="${slKey}" data-idx="${idx}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary);" title="Roll Spell">
                                    <span class="pc-spell-name">${sp.name}</span>${badges}
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button class="btn btn-xxs btn-secondary pc-spell-edit" data-level="${slKey}" data-idx="${idx}"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                    <div class="pc-spell-details" style="display: none; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.8rem;">
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom: 8px;">
                            ${((sp.attackStat && sp.attackStat !== 'none') || sp.attackBonus) ? `<button class="btn btn-xxs btn-primary pc-spell-macro-attack" data-level="${slKey}" data-idx="${idx}">⚔️ Attack</button>` : ''}
                            ${sp.saveAbility ? `<button class="btn btn-xxs btn-secondary pc-spell-macro-save" data-level="${slKey}" data-idx="${idx}">🛡️ DC ${sp.saveAbility}</button>` : ''}
                            ${(sp.damageList && sp.damageList.length) ? `<button class="btn btn-xxs btn-danger pc-spell-macro-damage" data-level="${slKey}" data-idx="${idx}">💥 Damage</button>` : ''}
                        </div>
                        <div class="pc-spell-desc"><em>Loading spell details...</em></div>
                    </div>
                </div>
            `;
        }
    };

    function showVttPrompt(title, defaultValue, callback) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const box = document.createElement('div');
        box.style.backgroundColor = '#1e1e1e';
        box.style.border = '1px solid var(--color-border-subtle, #444)';
        box.style.borderRadius = '8px';
        box.style.padding = '20px';
        box.style.width = '300px';
        box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.gap = '15px';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.margin = '0';
        titleEl.style.color = 'var(--color-gold-base, #ffd700)';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue || '';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.backgroundColor = 'rgba(0,0,0,0.3)';
        input.style.border = '1px solid var(--color-border-subtle, #444)';
        input.style.color = '#fff';
        input.style.borderRadius = '4px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        
        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'btn btn-primary btn-sm';

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);

        box.appendChild(titleEl);
        box.appendChild(input);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        input.focus();
        input.select();

        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        const submit = () => {
            cleanup();
            callback(input.value);
        };

        okBtn.addEventListener('click', submit);
        cancelBtn.addEventListener('click', () => {
            cleanup();
            callback(null);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') { cleanup(); callback(null); }
        });
    }

    function ensureAssignPlayersModalExists() {
        if (document.getElementById('pc-assign-players-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-assign-players-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            <div id="pc-assign-players-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Assign Players</h3>
                    <button id="modal-assign-players-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="modal-assign-players-list" style="padding:16px; display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto;">
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.2);">
                    <button class="btn btn-secondary btn-sm" id="modal-assign-players-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="modal-assign-players-save">Save Assignments</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('modal-assign-players-close').addEventListener('click', closeAssignPlayersModal);
        document.getElementById('modal-assign-players-cancel').addEventListener('click', closeAssignPlayersModal);
        document.getElementById('modal-assign-players-save').addEventListener('click', saveAssignPlayers);
    }

    let activeAssignChar = null;

    function openAssignPlayersModal(char) {
        ensureAssignPlayersModalExists();
        activeAssignChar = char;
        const listEl = document.getElementById('modal-assign-players-list');
        listEl.innerHTML = '';

        const knownPlayers = (vtt.campaignState && vtt.campaignState.knownPlayers) ? vtt.campaignState.knownPlayers : [];
        const allowedUsers = (vtt.campaignState && vtt.campaignState.allowedUsers) ? vtt.campaignState.allowedUsers : [];
        const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];
        const assigned = char.assignedPlayers || [];

        let html = '';
        const allIsChecked = assigned.includes('*') ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom: 8px;">
                <input type="checkbox" class="pc-assign-cb" value="*" ${allIsChecked}>
                <span style="font-weight:bold; color:var(--color-gold-light);">All Players</span>
            </label>
        `;

        if (allPotentialPlayers.length === 0) {
            html += '<div style="color:var(--color-text-muted);">No other players have joined or been allowlisted yet.</div>';
        } else {
            allPotentialPlayers.forEach(p => {
                const isChecked = assigned.includes(p) ? 'checked' : '';
                html += `
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" class="pc-assign-cb" value="${p}" ${isChecked}>
                        <span>${p}</span>
                    </label>
                `;
            });
        }
        listEl.innerHTML = html;

        document.getElementById('pc-assign-players-overlay').classList.remove('vtt-hidden');
        document.getElementById('pc-assign-players-modal').classList.remove('vtt-hidden');
    }

    function closeAssignPlayersModal() {
        document.getElementById('pc-assign-players-overlay').classList.add('vtt-hidden');
        document.getElementById('pc-assign-players-modal').classList.add('vtt-hidden');
        activeAssignChar = null;
    }

    function saveAssignPlayers() {
        if (!activeAssignChar) return;
        const cbs = document.querySelectorAll('.pc-assign-cb');
        const assigned = [];
        cbs.forEach(cb => {
            if (cb.checked) assigned.push(cb.value);
        });
        activeAssignChar.assignedPlayers = assigned;
        saveAndEmit(activeAssignChar);
        closeAssignPlayersModal();
    }





    function ensureAbilityModalsExist() {
        if (document.getElementById('pc-ability-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-ability-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:999;"></div>
            <div id="pc-ability-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); padding:16px; border-radius:8px; z-index:1000; width:450px; max-height:80vh; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.5); display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Ability Card</h3>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-sm btn-secondary active" id="tab-btn-manual" style="border-radius:4px;">Manual Entry</button>
                        <button class="btn btn-sm btn-secondary" id="tab-btn-import" style="border-radius:4px;">Import Feature</button>
                    </div>
                </div>
                
                <input type="hidden" id="modal-ability-idx" value="-1">
                
                <!-- MANUAL ENTRY TAB -->
                <div id="modal-tab-manual">
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Name</label>
                        <input type="text" id="modal-ability-name" style="width:100%;">
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Description</label>
                        <textarea id="modal-ability-desc" placeholder="Details of the ability..." style="width:100%; min-height:56px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:6px 8px; font-family:var(--font-primary); font-size:0.8rem; border-radius:4px; line-height:1.4;"></textarea>
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Macro / Damage Formula <span style="font-size:0.7rem; color:var(--color-text-muted); font-weight:400;">(Optional)</span></label>
                        <input type="text" id="modal-ability-formula" placeholder="e.g. 1d6+3" style="width:100%; padding:4px; font-size:0.8rem;">
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <input type="checkbox" id="modal-ability-has-counter">
                        <label for="modal-ability-has-counter" style="margin:0; cursor:pointer; font-size:0.8rem;">Enable Resource Counter</label>
                    </div>

                    <div id="modal-ability-uses-container" style="display:flex; gap:8px; margin-bottom:8px; display:none;">
                        <div class="form-group" style="flex:1;">
                            <label>Current Uses</label>
                            <input type="number" id="modal-ability-uses-current" value="0" min="0" style="width:100%; padding:4px; font-size:0.8rem; text-align:center;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Max Uses</label>
                            <input type="number" id="modal-ability-uses-max" value="0" min="0" style="width:100%; padding:4px; font-size:0.8rem; text-align:center;">
                        </div>
                    </div>
                    
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:10px; margin-bottom:12px;">
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            Custom Fields
                            <button class="btn btn-xxs btn-secondary" id="modal-ability-add-field"><i class="fa-solid fa-plus"></i> Add Field</button>
                        </label>
                        <div id="modal-ability-fields-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
                        <button class="btn btn-danger btn-sm" id="modal-ability-delete"><i class="fa-solid fa-trash"></i> Delete Card</button>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-secondary btn-sm" id="modal-ability-cancel">Cancel</button>
                            <button class="btn btn-primary btn-sm" id="modal-ability-save">Save Card</button>
                        </div>
                    </div>
                </div>

                <!-- IMPORT FEATURE TAB -->
                <div id="modal-tab-import" class="vtt-hidden" style="display:flex; flex-direction:column; gap:8px;">
                    <div>
                        <select id="import-category-sel" style="width:100%; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:4px;">
                            <option value="class">Class Features</option>
                            <option value="feat">Feats</option>
                            <option value="race">Species</option>
                            <option value="charoption">Character Creation Options</option>
                            <option value="optionalfeature">Optional Features</option>
                        </select>
                    </div>
                    <div id="import-class-filters" style="display:flex; gap:8px;">
                        <select id="import-class-sel" style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            <option value="">-- Loading Classes... --</option>
                        </select>
                        <select id="import-subclass-sel" style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;" disabled>
                            <option value="">-- All Subclasses --</option>
                        </select>
                    </div>
                    <div>
                        <input type="text" id="import-search" placeholder="Search features..." style="width:100%; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                    </div>
                    <div id="import-feature-list" style="flex:1; min-height:200px; max-height:300px; overflow-y:auto; background:rgba(0,0,0,0.2); border:1px solid var(--color-border-subtle); border-radius:4px; padding:8px; display:flex; flex-direction:column; gap:4px;">
                        <div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Select a class to browse features</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupAbilityModalListeners();
    }

    function setupAbilityModalListeners() {
        document.getElementById('modal-ability-add-field')?.addEventListener('click', () => {
            const list = document.getElementById('modal-ability-fields-list');
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.className = 'modal-ability-field-row';
            row.innerHTML = `
                <input type="text" class="ab-field-label" placeholder="Label" style="flex:1; padding:4px; font-size:0.8rem;">
                <input type="text" class="ab-field-entry" placeholder="Entry" style="flex:2; padding:4px; font-size:0.8rem;">
                <button class="btn btn-xxs btn-danger btn-ab-field-remove"><i class="fa-solid fa-trash"></i></button>
            `;
            row.querySelector('.btn-ab-field-remove').addEventListener('click', () => row.remove());
            list.appendChild(row);
        });

        document.getElementById('modal-ability-has-counter')?.addEventListener('change', (e) => {
            const container = document.getElementById('modal-ability-uses-container');
            if (e.target.checked) {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        });

        document.getElementById('modal-ability-save')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const idx = parseInt(document.getElementById('modal-ability-idx').value);
            const name = document.getElementById('modal-ability-name').value.trim();
            if (!name) return alert("Ability Name is required.");
            const description = document.getElementById('modal-ability-desc').value.trim();
            const formula = document.getElementById('modal-ability-formula').value.trim();
            const hasCounter = document.getElementById('modal-ability-has-counter').checked;
            const usesCurrent = parseInt(document.getElementById('modal-ability-uses-current').value) || 0;
            const usesMax = parseInt(document.getElementById('modal-ability-uses-max').value) || 0;
            
            const customFields = [];
            document.querySelectorAll('.modal-ability-field-row').forEach(row => {
                const label = row.querySelector('.ab-field-label').value.trim();
                const entry = row.querySelector('.ab-field-entry').value.trim();
                if (label || entry) customFields.push({ label, entry });
            });

            const ab = { 
                id: (idx >= 0 ? char.abilityCards[idx].id : 'ab_' + Date.now()), 
                name, description, formula, customFields, hasCounter, usesCurrent, usesMax 

            };

            if (idx >= 0) char.abilityCards[idx] = ab;
            else char.abilityCards.push(ab);

            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
            saveAndEmit(char); renderSheetData(char);
        });

        document.getElementById('modal-ability-delete')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const idx = parseInt(document.getElementById('modal-ability-idx').value);
            if (idx >= 0) {
                if (confirm("Are you sure you want to delete this ability card?")) {
                    char.abilityCards.splice(idx, 1);
                    document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
                    document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
                    saveAndEmit(char); renderSheetData(char);
                }
            } else {
                document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
                document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
            }
        });

        document.getElementById('modal-ability-cancel')?.addEventListener('click', () => {
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('pc-ability-overlay')?.addEventListener('click', () => {
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
        });
    }

    
    // Leftover sets removed











    

    













    function renderSaveTogglesList() {
        const list = document.getElementById('modal-save-toggles-list');
        if (!list) return;
        const char = currentChar;
        if (!char || !char.saveToggles) return;

        let html = '';
        char.saveToggles.forEach((t, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="save-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                        <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                        <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${t.target.toUpperCase()}</span>
                        <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-xxs btn-secondary save-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-secondary save-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        list.querySelectorAll('.save-toggle-enable-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.saveToggles[idx].enabled = e.currentTarget.checked;
        }));

        list.querySelectorAll('.save-toggle-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.saveToggles[idx];
            document.getElementById('modal-save-toggle-idx').value = idx;
            document.getElementById('modal-save-toggle-name').value = t.name;
            document.getElementById('modal-save-toggle-formula').value = t.formula;
            document.getElementById('modal-save-toggle-target').value = t.target;
            document.getElementById('modal-save-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-save-toggle').classList.add('vtt-hidden');
        }));

        list.querySelectorAll('.save-toggle-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this toggle?")) {
                const idx = e.currentTarget.dataset.idx;
                char.saveToggles.splice(idx, 1);
                renderSaveTogglesList();
            }
        }));
    }

    function setupSaveSettingsListeners() {
        document.getElementById('modal-save-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-save-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-save-settings-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-save-toggle')?.addEventListener('click', () => {
            document.getElementById('modal-save-toggle-idx').value = '-1';
            document.getElementById('modal-save-toggle-name').value = '';
            document.getElementById('modal-save-toggle-formula').value = '';
            document.getElementById('modal-save-toggle-target').value = 'all';
            document.getElementById('modal-save-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-save-toggle').classList.add('vtt-hidden');
        });

        document.getElementById('modal-save-toggle-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-save-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-save-toggle').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-save-toggle-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-save-toggle-idx').value);
            const name = document.getElementById('modal-save-toggle-name').value.trim();
            const formula = document.getElementById('modal-save-toggle-formula').value.trim();
            const target = document.getElementById('modal-save-toggle-target').value;
            if (!name || !formula) return alert("Name and Formula are required.");

            const t = { id: 'stgl_' + Date.now(), name, formula, target, enabled: true };
            if (idx >= 0) {
                currentChar.saveToggles[idx] = t;
            } else {
                currentChar.saveToggles.push(t);
            }
            document.getElementById('modal-save-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-save-toggle').classList.remove('vtt-hidden');
            renderSaveTogglesList();
        });

        document.getElementById('modal-save-settings-save')?.addEventListener('click', () => {
            currentChar.globalSaveMod = parseInt(document.getElementById('modal-save-global-mod').value) || 0;

            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ab => {
                const cb = document.getElementById(`modal-save-prof-${ab}`);
                const inp = document.getElementById(`modal-save-mod-${ab}`);
                if (cb) currentChar.saves[ab] = cb.checked;
                if (inp) currentChar.saveMods[ab] = parseInt(inp.value) || 0;

                const baseInp = document.getElementById(`modal-stat-base-${ab}`);
                const tempInp = document.getElementById(`modal-stat-mod-${ab}`);
                if (baseInp) currentChar.stats[ab] = parseInt(baseInp.value) || 10;
                if (tempInp) currentChar.statMods[ab] = parseInt(tempInp.value) || 0;
            });

            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-save-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-save-settings-overlay').classList.add('vtt-hidden');
        });
    }

    function ensureSaveSettingsModalExists() {
        if (document.getElementById('pc-save-settings-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-save-settings-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            <div id="pc-save-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:500px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Stat & Save Settings</h3>
                    <button id="modal-save-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div class="form-group">
                        <label>Global Save Modifier</label>
                        <input type="number" id="modal-save-global-mod" value="0" style="width:100%;">
                    </div>
                    
                    <div>
                        <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Ability Scores & Temp Mods</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                            ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => `
                                <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                    <div style="font-weight:600; font-size:0.85rem;">${ab.toUpperCase()}</div>
                                    <div style="display:flex; gap:4px; align-items:center;">
                                        <input type="text" inputmode="numeric" id="modal-stat-base-${ab}" value="10" style="width:48px; padding:2px; box-sizing:border-box; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" title="Base Stat">
                                        <span style="color:var(--color-text-muted); font-size:0.8rem;">+</span>
                                        <input type="text" inputmode="numeric" id="modal-stat-mod-${ab}" value="0" style="width:48px; padding:2px; box-sizing:border-box; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" title="Temp Mod">
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Ability Save Proficiencies & Mods</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => `
                                <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <input type="checkbox" id="modal-save-prof-${ab}" style="cursor:pointer;">
                                        <label style="margin:0; font-weight:600; font-size:0.85rem;" for="modal-save-prof-${ab}">${ab.toUpperCase()} Save</label>
                                    </div>
                                    <input type="number" id="modal-save-mod-${ab}" value="0" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0; color:var(--color-text-primary);">Save Toggles</h4>
                            <button id="btn-add-save-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                        </div>
                        <div id="modal-save-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                            <input type="hidden" id="modal-save-toggle-idx" value="-1">
                            <div style="display:flex; gap:8px; margin-bottom:8px;">
                                <input type="text" id="modal-save-toggle-name" placeholder="Name (e.g. Bless)" style="flex:2;">
                                <input type="text" id="modal-save-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1;">
                                <select id="modal-save-toggle-target" style="flex:1;">
                                    <option value="all">All Saves</option>
                                    <option value="str">STR Save</option>
                                    <option value="dex">DEX Save</option>
                                    <option value="con">CON Save</option>
                                    <option value="int">INT Save</option>
                                    <option value="wis">WIS Save</option>
                                    <option value="cha">CHA Save</option>
                                </select>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button id="modal-save-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                                <button id="modal-save-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                            </div>
                        </div>
                        <div id="modal-save-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Save Toggles injected here -->
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-save-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupSaveSettingsListeners();
    }

    const ALL_SKILLS = [
        { name: 'Acrobatics', ability: 'dex' },
        { name: 'Animal Handling', ability: 'wis' },
        { name: 'Arcana', ability: 'int' },
        { name: 'Athletics', ability: 'str' },
        { name: 'Deception', ability: 'cha' },
        { name: 'History', ability: 'int' },
        { name: 'Insight', ability: 'wis' },
        { name: 'Intimidation', ability: 'cha' },
        { name: 'Investigation', ability: 'int' },
        { name: 'Medicine', ability: 'wis' },
        { name: 'Nature', ability: 'int' },
        { name: 'Perception', ability: 'wis' },
        { name: 'Performance', ability: 'cha' },
        { name: 'Persuasion', ability: 'cha' },
        { name: 'Religion', ability: 'int' },
        { name: 'Sleight of Hand', ability: 'dex' },
        { name: 'Stealth', ability: 'dex' },
        { name: 'Survival', ability: 'wis' }
    ];

    const STANDARD_TOOLS = [
        { name: "Alchemist's Supplies", ability: "int" },
        { name: "Brewer's Supplies", ability: "int" },
        { name: "Calligrapher's Supplies", ability: "int" },
        { name: "Carpenter's Tools", ability: "str" },
        { name: "Cartographer's Tools", ability: "int" },
        { name: "Cobbler's Tools", ability: "dex" },
        { name: "Cook's Utensils", ability: "wis" },
        { name: "Dice Set", ability: "int" },
        { name: "Dragonchess Set", ability: "int" },
        { name: "Disguise Kit", ability: "cha" },
        { name: "Forgery Kit", ability: "int" },
        { name: "Glassblower's Tools", ability: "dex" },
        { name: "Herbalism Kit", ability: "int" },
        { name: "Jeweler's Tools", ability: "dex" },
        { name: "Land Vehicles", ability: "wis" },
        { name: "Leatherworker's Tools", ability: "dex" },
        { name: "Mason's Tools", ability: "str" },
        { name: "Musical Instrument", ability: "cha" },
        { name: "Navigator's Tools", ability: "wis" },
        { name: "Painter's Supplies", ability: "dex" },
        { name: "Playing Card Set", ability: "int" },
        { name: "Poisoner's Kit", ability: "int" },
        { name: "Potter's Tools", ability: "dex" },
        { name: "Smith's Tools", ability: "str" },
        { name: "Thieves' Tools", ability: "dex" },
        { name: "Tinker's Tools", ability: "dex" },
        { name: "Water Vehicles", ability: "wis" },
        { name: "Weaver's Tools", ability: "dex" },
        { name: "Woodcarver's Tools", ability: "dex" }
    ];

    function renderSkillTogglesList() {
        const list = document.getElementById('modal-skill-toggles-list');
        if (!list) return;
        const char = currentChar;
        if (!char || !char.skillToggles) return;

        let html = '';
        char.skillToggles.forEach((t, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="skill-toggle-enable-cb" data-idx="${i}" ${t.enabled ? 'checked' : ''}>
                        <span style="font-weight:bold; font-size:0.85rem;">${t.name}</span>
                        <span style="background:var(--color-surface-hover); padding:2px 4px; border-radius:4px; font-size:0.7rem;">${t.target.toUpperCase()}</span>
                        <span style="color:var(--color-gold-base); font-size:0.8rem;">${t.formula}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-xxs btn-secondary skill-toggle-edit-btn" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-secondary skill-toggle-del-btn" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        list.querySelectorAll('.skill-toggle-enable-cb').forEach(cb => cb.addEventListener('change', (e) => {
            const idx = e.currentTarget.dataset.idx;
            char.skillToggles[idx].enabled = e.currentTarget.checked;
        }));

        list.querySelectorAll('.skill-toggle-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const t = char.skillToggles[idx];
            document.getElementById('modal-skill-toggle-idx').value = idx;
            document.getElementById('modal-skill-toggle-name').value = t.name;
            document.getElementById('modal-skill-toggle-formula').value = t.formula;
            document.getElementById('modal-skill-toggle-target').value = t.target;
            document.getElementById('modal-skill-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-skill-toggle').classList.add('vtt-hidden');
        }));

        list.querySelectorAll('.skill-toggle-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this toggle?")) {
                const idx = e.currentTarget.dataset.idx;
                char.skillToggles.splice(idx, 1);
                renderSkillTogglesList();
            }
        }));
    }

    function setupSkillSettingsListeners() {
        document.getElementById('modal-skill-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-skill-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-skill-settings-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-skill-toggle')?.addEventListener('click', () => {
            document.getElementById('modal-skill-toggle-idx').value = '-1';
            document.getElementById('modal-skill-toggle-name').value = '';
            document.getElementById('modal-skill-toggle-formula').value = '';
            document.getElementById('modal-skill-toggle-target').value = 'all';
            document.getElementById('modal-skill-toggle-form').classList.remove('vtt-hidden');
            document.getElementById('btn-add-skill-toggle').classList.add('vtt-hidden');
        });

        document.getElementById('modal-skill-toggle-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-skill-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-skill-toggle').classList.remove('vtt-hidden');
        });

        document.getElementById('modal-skill-toggle-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-skill-toggle-idx').value);
            const name = document.getElementById('modal-skill-toggle-name').value.trim();
            const formula = document.getElementById('modal-skill-toggle-formula').value.trim();
            const target = document.getElementById('modal-skill-toggle-target').value;
            if (!name || !formula) return alert("Name and Formula are required.");

            const t = { id: 'sktgl_' + Date.now(), name, formula, target, enabled: true };
            if (idx >= 0) {
                currentChar.skillToggles[idx] = t;
            } else {
                currentChar.skillToggles.push(t);
            }
            document.getElementById('modal-skill-toggle-form').classList.add('vtt-hidden');
            document.getElementById('btn-add-skill-toggle').classList.remove('vtt-hidden');
            renderSkillTogglesList();
        });

        document.getElementById('modal-skill-settings-save')?.addEventListener('click', () => {
            currentChar.globalAbilityMod = document.getElementById('modal-skill-global-mod').value.trim() || "0";

            ALL_SKILLS.forEach(skill => {
                const sName = skill.name;
                const pCb = document.getElementById(`modal-skill-prof-${sName.replace(/ /g, '_')}`);
                const eCb = document.getElementById(`modal-skill-exp-${sName.replace(/ /g, '_')}`);
                const inp = document.getElementById(`modal-skill-mod-${sName.replace(/ /g, '_')}`);
                if (pCb) currentChar.skills[sName] = pCb.checked;
                if (eCb) currentChar.expertise[sName] = eCb.checked;
                if (inp) currentChar.skillMods[sName] = inp.value.trim() || "0";
            });

            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-skill-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-skill-settings-overlay').classList.add('vtt-hidden');
        });
    }

    function ensureSkillSettingsModalExists() {
        if (document.getElementById('pc-skill-settings-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-skill-settings-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            <div id="pc-skill-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:600px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Skill Settings & Toggles</h3>
                    <button id="modal-skill-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div class="form-group">
                        <label>Global Ability Modifier (e.g. +1d4)</label>
                        <input type="text" id="modal-skill-global-mod" placeholder="0" style="width:100%;">
                    </div>
                    
                    <div>
                        <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Skill Proficiencies & Mods</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            ${ALL_SKILLS.map(skill => {
            const idSafe = skill.name.replace(/ /g, '_');
            return `
                                <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; border:1px solid var(--color-border-subtle);">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <input type="checkbox" id="modal-skill-prof-${idSafe}" title="Proficient" style="cursor:pointer;">
                                        <input type="checkbox" id="modal-skill-exp-${idSafe}" title="Expertise" style="cursor:pointer; border-radius:50%;">
                                        <label style="margin:0; font-weight:600; font-size:0.85rem;" for="modal-skill-prof-${idSafe}">${skill.name}</label>
                                    </div>
                                    <input type="text" id="modal-skill-mod-${idSafe}" value="0" style="width:50px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                                </div>
                                `;
        }).join('')}
                        </div>
                    </div>

                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h4 style="margin:0; color:var(--color-text-primary);">Skill Toggles</h4>
                            <button id="btn-add-skill-toggle" class="btn btn-xs btn-primary"><i class="fa-solid fa-plus"></i> Add Toggle</button>
                        </div>
                        <div id="modal-skill-toggle-form" class="vtt-hidden" style="background:rgba(0,0,0,0.3); padding:8px; border:1px solid var(--color-border-subtle); border-radius:4px; margin-bottom:8px;">
                            <input type="hidden" id="modal-skill-toggle-idx" value="-1">
                            <div style="display:flex; gap:8px; margin-bottom:8px;">
                                <input type="text" id="modal-skill-toggle-name" placeholder="Name (e.g. Guidance)" style="flex:2;">
                                <input type="text" id="modal-skill-toggle-formula" placeholder="Formula (e.g. +1d4)" style="flex:1;">
                            </div>
                            <div style="display:flex; gap:8px; margin-bottom:8px;">
                                <select id="modal-skill-toggle-target" style="flex:1; width:100%; background-color:#222222; color:#fff; border:1px solid var(--color-border-subtle); padding:4px; border-radius:4px;">
                                    <option value="all">All Skills</option>
                                    <option value="initiative">Initiative</option>
                                    ${ALL_SKILLS.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px;">
                                <button id="modal-skill-toggle-cancel" class="btn btn-xs btn-secondary">Cancel</button>
                                <button id="modal-skill-toggle-save" class="btn btn-xs btn-primary">Save Toggle</button>
                            </div>
                        </div>
                        <div id="modal-skill-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Skill Toggles injected here -->
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-skill-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupSkillSettingsListeners();
    }

    function ensureToolSettingsModalExists() {
        if (document.getElementById('pc-tool-settings-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-tool-settings-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            <div id="pc-tool-settings-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:650px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Tool Settings</h3>
                    <button id="modal-tool-settings-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <h4 style="margin:0 0 8px 0; color:var(--color-text-primary);">Configured Tools</h4>
                        <div id="modal-tool-toggles-list" style="display:flex; flex-direction:column; gap:8px;">
                            <!-- Tool inputs injected here -->
                        </div>
                    </div>

                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:16px;">
                        <button id="btn-add-custom-tool" class="btn btn-sm btn-secondary"><i class="fa-solid fa-plus"></i> Add Custom Tool</button>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-tool-settings-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('modal-tool-settings-close').addEventListener('click', () => {
            document.getElementById('pc-tool-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-tool-settings-overlay').classList.add('vtt-hidden');
        });
        document.getElementById('pc-tool-settings-overlay').addEventListener('click', () => {
            document.getElementById('pc-tool-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-tool-settings-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-add-custom-tool').addEventListener('click', () => {
            const list = document.getElementById('modal-tool-toggles-list');
            const idSafe = 'custom_tool_' + Date.now();
            const div = document.createElement('div');
            div.className = 'tool-settings-row';
            div.dataset.key = idSafe;
            div.dataset.custom = 'true';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.background = 'rgba(0,0,0,0.2)';
            div.style.padding = '6px';
            div.style.borderRadius = '4px';
            div.style.border = '1px solid var(--color-border-subtle)';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; flex:1;">
                    <input type="checkbox" class="tool-show" title="Show on Sheet" checked style="cursor:pointer; accent-color: var(--color-gold-base);">
                    <input type="checkbox" class="tool-prof" title="Proficient" style="cursor:pointer;">
                    <input type="checkbox" class="tool-exp" title="Expertise" style="cursor:pointer; border-radius:50%;">
                    <input type="text" class="tool-name" value="New Tool" style="width:140px; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Tool Name">
                    <select class="tool-ability" style="background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px; padding:2px;">
                        <option value="str">STR</option>
                        <option value="dex">DEX</option>
                        <option value="con">CON</option>
                        <option value="int">INT</option>
                        <option value="wis">WIS</option>
                        <option value="cha">CHA</option>
                    </select>
                </div>
                <div style="display:flex; gap:6px;">
                    <input type="text" class="tool-mod" value="0" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                    <button class="btn btn-danger btn-xxs tool-delete" style="padding:2px 6px;"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            list.appendChild(div);

            div.querySelector('.tool-delete').addEventListener('click', () => {
                div.remove();
            });
        });

        document.getElementById('modal-tool-settings-save').addEventListener('click', () => {
            if (!currentChar) return;
            const newTools = {};
            document.querySelectorAll('.tool-settings-row').forEach(row => {
                let name = '';
                if (row.dataset.custom === 'true') {
                    name = row.querySelector('.tool-name').value.trim();
                } else {
                    name = row.dataset.key;
                }
                
                if (!name) return;
                
                newTools[name] = {
                    ability: row.querySelector('.tool-ability').value,
                    show: row.querySelector('.tool-show').checked,
                    prof: row.querySelector('.tool-prof').checked,
                    exp: row.querySelector('.tool-exp').checked,
                    mod: row.querySelector('.tool-mod').value,
                    custom: row.dataset.custom === 'true'
                };
            });
            currentChar.tools = newTools;
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            
            document.getElementById('pc-tool-settings-modal').classList.add('vtt-hidden');
            document.getElementById('pc-tool-settings-overlay').classList.add('vtt-hidden');
        });
    }

    let tempPlayerAurasList = [];

    function renderPlayerAuraList() {
        const container = document.getElementById('pc-token-auras-list');
        if (!container) return;
        container.innerHTML = '';
        if (tempPlayerAurasList.length === 0) {
            container.innerHTML = `
                <div style="font-size: 0.8rem; color: var(--color-text-muted); text-align: center; padding: 20px; font-style: italic; background: rgba(0,0,0,0.1); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.06);">
                    No active auras configured for this token.
                </div>
            `;
            return;
        }

        tempPlayerAurasList.forEach((aura, idx) => {
            const range = aura.range !== undefined ? aura.range : 10;
            const shape = aura.shape || 'circle';
            const style = aura.style || 'both';
            const opacity = aura.opacity !== undefined ? aura.opacity : 0.3;
            const color = aura.color || '#d4af37';
            const isExpanded = !!aura.isExpanded;

            const card = document.createElement('div');
            card.className = 'aura-item-card glassmorphism';
            card.style.border = '1px solid rgba(255,255,255,0.06)';
            card.style.borderRadius = '6px';
            card.style.padding = '10px';
            card.style.background = 'rgba(0,0,0,0.15)';

            card.innerHTML = `
                <div class="aura-item-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; ${isExpanded ? 'transform: rotate(90deg);' : ''}"></i>
                        Aura ${idx + 1}: ${range}ft ${shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="swatch-preview" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 1px solid rgba(255,255,255,0.2);"></span>
                        <button type="button" class="btn-delete-aura btn btn-icon btn-danger btn-xxs" style="padding: 2px 4px; font-size: 0.7rem; border-radius: 4px;" title="Delete Aura">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="aura-item-details ${isExpanded ? '' : 'vtt-hidden'}" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                    <div class="flex-row">
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Range (ft)</label>
                            <input type="number" class="aura-range-input" min="5" max="150" step="5" value="${range}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                        </div>
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Shape</label>
                            <select class="aura-shape-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                <option value="circle" ${shape === 'circle' ? 'selected' : ''}>Circle</option>
                                <option value="square" ${shape === 'square' ? 'selected' : ''}>Square</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex-row mt-2">
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Render Style</label>
                            <select class="aura-style-select" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                <option value="both" ${style === 'both' ? 'selected' : ''}>Fill & Border</option>
                                <option value="fill" ${style === 'fill' ? 'selected' : ''}>Fill Only</option>
                                <option value="border" ${style === 'border' ? 'selected' : ''}>Border Only</option>
                            </select>
                        </div>
                        <div class="form-group w-50" style="margin-bottom: 0;">
                            <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Opacity</label>
                            <div style="display: flex; align-items: center; gap: 8px; height: 28px;">
                                <input type="range" class="aura-opacity-slider" min="0.05" max="1.0" step="0.05" value="${opacity}" style="flex: 1; cursor: pointer;">
                                <span class="aura-opacity-val" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">${Math.round(opacity * 100)}%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group mt-2" style="margin-bottom: 0;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Color</label>
                        <div class="aura-color-picker-row" style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                            <input type="color" class="aura-color-input" value="${color}" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(card);

            // Listeners for aura logic
            const header = card.querySelector('.aura-item-header');
            const details = card.querySelector('.aura-item-details');
            const chevron = card.querySelector('.aura-chevron');
            header.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-aura')) return;
                const collapsed = details.classList.contains('vtt-hidden');
                if (collapsed) {
                    details.classList.remove('vtt-hidden');
                    chevron.style.transform = 'rotate(90deg)';
                    tempPlayerAurasList[idx].isExpanded = true;
                } else {
                    details.classList.add('vtt-hidden');
                    chevron.style.transform = 'rotate(0deg)';
                    tempPlayerAurasList[idx].isExpanded = false;
                }
            });
            const updateAuraTitle = () => {
                card.querySelector('.aura-item-header span').innerHTML = `
                    <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; transform: rotate(${tempPlayerAurasList[idx].isExpanded ? 90 : 0}deg);"></i>
                    Aura ${idx + 1}: ${card.querySelector('.aura-range-input').value}ft ${card.querySelector('.aura-shape-select').value}
                `;
            };
            card.querySelector('.aura-range-input').addEventListener('input', (e) => { tempPlayerAurasList[idx].range = parseInt(e.target.value) || 10; updateAuraTitle(); });
            card.querySelector('.aura-shape-select').addEventListener('change', (e) => { tempPlayerAurasList[idx].shape = e.target.value; updateAuraTitle(); });
            card.querySelector('.aura-style-select').addEventListener('change', (e) => { tempPlayerAurasList[idx].style = e.target.value; });
            card.querySelector('.aura-opacity-slider').addEventListener('input', (e) => {
                const op = parseFloat(e.target.value) || 0.3;
                tempPlayerAurasList[idx].opacity = op;
                card.querySelector('.aura-opacity-val').textContent = `${Math.round(op * 100)}%`;
            });
            card.querySelector('.aura-color-input').addEventListener('input', (e) => {
                tempPlayerAurasList[idx].color = e.target.value;
                card.querySelector('.swatch-preview').style.background = e.target.value;
            });
            card.querySelector('.btn-delete-aura').addEventListener('click', () => {
                tempPlayerAurasList.splice(idx, 1);
                renderPlayerAuraList();
            });
        });
    }

    // Updates the 48px portrait circle beside the sheet name to show the correct media type
    function updateTokenPortrait(url) {
        const portrait = document.getElementById('pc-token-portrait');
        if (!portrait) return;
        // Clear existing content
        portrait.innerHTML = '';
        const cleanUrl = (url || '').split('?')[0].toLowerCase();
        const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
        const isYoutube = url && (url.includes('youtube.com/embed') || url.includes('youtube.com/watch') || url.includes('youtu.be/'));
        let mediaEl;
        if (isVideo) {
            mediaEl = document.createElement('video');
            mediaEl.src = url;
            mediaEl.muted = true;
            mediaEl.loop = true;
            mediaEl.autoplay = true;
            mediaEl.playsInline = true;
            mediaEl.draggable = false;
            mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block; pointer-events:none;';
            portrait.appendChild(mediaEl);
            mediaEl.play().catch(() => { });
        } else if (isYoutube) {
            mediaEl = document.createElement('iframe');
            mediaEl.src = url;
            mediaEl.frameBorder = '0';
            mediaEl.allow = 'autoplay; encrypted-media';
            mediaEl.style.cssText = 'width:100%; height:100%; pointer-events:none; border:none;';
            portrait.appendChild(mediaEl);
        } else {
            // Static image or GIF (GIFs animate natively in <img>)
            mediaEl = document.createElement('img');
            mediaEl.src = url || 'favicon.svg';
            mediaEl.draggable = false;
            mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            portrait.appendChild(mediaEl);
        }
    }

    function renderPlayerTokenGallery() {
        const gal = document.getElementById('pc-token-gallery');
        gal.innerHTML = '';
        if (!currentChar || !currentChar.tokenImages || currentChar.tokenImages.length === 0) {
            gal.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.8rem; font-style:italic;">No token artwork added.</span>';
            return;
        }
        currentChar.tokenImages.forEach((imgObj, idx) => {
            const isActive = currentChar.activeTokenIndex === idx;
            const url = imgObj.url || '';
            // Strip query params for extension checking (e.g. Pinterest CDN adds ?v=xxx)
            const cleanUrl = url.split('?')[0].toLowerCase();
            const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
            const isGif = cleanUrl.endsWith('.gif');
            const isYoutube = url.includes('youtube.com/embed') || url.includes('youtube.com/watch') || url.includes('youtu.be/');
            console.log('[TokenGallery] Rendering item:', { url, cleanUrl, isVideo: !!isVideo, isGif, isYoutube });

            // Build the wrapper div
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `position:relative; width:64px; height:64px; border-radius:4px; overflow:hidden; border:2px solid ${isActive ? 'var(--color-success-base)' : 'transparent'}; cursor:pointer;`;
            wrapper.className = 'pc-token-gal-item';
            wrapper.dataset.idx = idx;

            // Build the media element
            let mediaEl;
            if (isVideo) {
                mediaEl = document.createElement('video');
                mediaEl.src = imgObj.url;
                mediaEl.muted = true;
                mediaEl.loop = true;
                mediaEl.autoplay = true;
                mediaEl.playsInline = true;
                mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
                mediaEl.play().catch(() => { }); // Trigger play proactively after append
            } else if (isYoutube) {
                mediaEl = document.createElement('iframe');
                mediaEl.src = imgObj.url;
                mediaEl.frameBorder = '0';
                mediaEl.allow = 'autoplay; encrypted-media';
                mediaEl.style.cssText = 'width:100%; height:100%; pointer-events:none; border:none;';
            } else {
                // img — covers both GIFs (which animate natively) and static images
                mediaEl = document.createElement('img');
                mediaEl.src = imgObj.url;
                mediaEl.title = imgObj.name || 'Token';
                mediaEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            }
            wrapper.appendChild(mediaEl);

            // Trigger video play after element is in the wrapper (before appending to DOM)
            if (isVideo && mediaEl.paused) {
                mediaEl.play().catch(() => { });
            }

            // Active checkmark badge
            if (isActive) {
                const badge = document.createElement('div');
                badge.style.cssText = 'position:absolute; top:2px; right:2px; background:var(--color-success-base); color:#fff; border-radius:50%; width:16px; height:16px; font-size:0.6rem; display:flex; align-items:center; justify-content:center;';
                badge.innerHTML = '<i class="fa-solid fa-check"></i>';
                wrapper.appendChild(badge);
            }

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-danger btn-xxs pc-token-gal-del';
            delBtn.dataset.idx = idx;
            delBtn.style.cssText = 'position:absolute; bottom:2px; right:2px; padding:2px 4px;';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            wrapper.appendChild(delBtn);

            // Attach click listeners directly
            wrapper.addEventListener('click', (e) => {
                if (e.target.closest('.pc-token-gal-del')) return;
                currentChar.activeTokenIndex = idx;
                // Live-update the primary portrait without full re-render
                updateTokenPortrait(imgObj.url);
                renderPlayerTokenGallery();
            });
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentChar.tokenImages.splice(idx, 1);
                if (currentChar.activeTokenIndex >= currentChar.tokenImages.length) {
                    currentChar.activeTokenIndex = Math.max(0, currentChar.tokenImages.length - 1);
                } else if (currentChar.activeTokenIndex > idx) {
                    currentChar.activeTokenIndex--;
                }
                renderPlayerTokenGallery();
            });

            gal.appendChild(wrapper);

            // Force video play after DOM insertion
            if (isVideo) mediaEl.play().catch(() => { });
        });
    }

    function setupPlayerTokenEditListeners() {
        document.getElementById('modal-pc-token-edit-close').addEventListener('click', () => {
            document.getElementById('modal-pc-token-edit').classList.add('vtt-hidden');
            document.getElementById('modal-pc-token-edit-overlay').classList.add('vtt-hidden');
        });

        // Add URL
        document.getElementById('btn-pc-token-add-url').addEventListener('click', async () => {
            const urlInput = document.getElementById('pc-token-add-url');
            let rawUrl = urlInput.value.trim();
            if (rawUrl) {
                const btn = document.getElementById('btn-pc-token-add-url');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const res = await fetch('/api/player-token/url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: rawUrl })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (!currentChar.tokenImages) currentChar.tokenImages = [];
                        currentChar.tokenImages.push({ url: data.url, name: 'URL Media' });
                        currentChar.activeTokenIndex = currentChar.tokenImages.length - 1; // Auto select new
                        urlInput.value = '';
                        renderPlayerTokenGallery();
                    } else {
                        alert("Failed to process URL.");
                    }
                } catch (e) {
                    alert("Error: " + e.message);
                } finally {
                    btn.innerHTML = originalText;
                }
            }
        });

        // Upload File
        document.getElementById('btn-pc-token-upload').addEventListener('click', async () => {
            const fileInput = document.getElementById('pc-token-file');
            if (fileInput.files.length === 0) return alert("Select a file first.");
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            const btn = document.getElementById('btn-pc-token-upload');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    if (!currentChar.tokenImages) currentChar.tokenImages = [];
                    currentChar.tokenImages.push({ url: data.url, name: file.name });
                    currentChar.activeTokenIndex = currentChar.tokenImages.length - 1;
                    renderPlayerTokenGallery();
                } else {
                    alert("Upload failed.");
                }
            } catch (e) {
                alert("Error: " + e.message);
            } finally {
                btn.innerHTML = originalText;
                fileInput.value = '';
            }
        });

        // Aura add
        document.getElementById('btn-pc-token-add-aura').addEventListener('click', () => {
            tempPlayerAurasList.forEach(a => a.isExpanded = false);
            tempPlayerAurasList.push({ range: 10, shape: 'circle', style: 'both', opacity: 0.3, color: '#d4af37', isExpanded: true });
            renderPlayerAuraList();
            const listContainer = document.getElementById('pc-token-auras-list');
            setTimeout(() => { listContainer.scrollTop = listContainer.scrollHeight; }, 50);
        });

        // Tab Switching for FX
        const switchFxTab = (btnId, panelId) => {
            ['tab-btn-pc-fx-overlay', 'tab-btn-pc-fx-vignette', 'tab-btn-pc-fx-shadow'].forEach(id => document.getElementById(id).classList.remove('active'));
            ['panel-pc-fx-overlay', 'panel-pc-fx-vignette', 'panel-pc-fx-shadow'].forEach(id => document.getElementById(id).classList.add('vtt-hidden'));
            document.getElementById(btnId).classList.add('active');
            document.getElementById(panelId).classList.remove('vtt-hidden');
        };
        document.getElementById('tab-btn-pc-fx-overlay').addEventListener('click', () => switchFxTab('tab-btn-pc-fx-overlay', 'panel-pc-fx-overlay'));
        document.getElementById('tab-btn-pc-fx-vignette').addEventListener('click', () => switchFxTab('tab-btn-pc-fx-vignette', 'panel-pc-fx-vignette'));
        document.getElementById('tab-btn-pc-fx-shadow').addEventListener('click', () => switchFxTab('tab-btn-pc-fx-shadow', 'panel-pc-fx-shadow'));

        // FX Expanders
        const bindDetailToggle = (cbId, detailsId) => {
            document.getElementById(cbId).addEventListener('change', (e) => {
                if (e.target.checked) document.getElementById(detailsId).classList.remove('vtt-hidden');
                else document.getElementById(detailsId).classList.add('vtt-hidden');
            });
        };
        bindDetailToggle('pc-token-edit-fx-overlay-enabled', 'pc-fx-overlay-details');
        bindDetailToggle('pc-token-edit-fx-vignette-enabled', 'pc-fx-vignette-details');
        bindDetailToggle('pc-token-edit-fx-shadow-enabled', 'pc-fx-shadow-details');

        // FX Sliders readouts
        document.getElementById('pc-token-edit-fx-overlay-opacity').addEventListener('input', (e) => {
            document.getElementById('val-pc-fx-overlay-opacity').textContent = `${Math.round(e.target.value * 100)}%`;
        });
        document.getElementById('pc-token-edit-fx-vignette-opacity').addEventListener('input', (e) => {
            document.getElementById('val-pc-fx-vignette-opacity').textContent = `${Math.round(e.target.value * 100)}%`;
        });
        document.getElementById('pc-token-edit-fx-shadow-opacity').addEventListener('input', (e) => {
            document.getElementById('val-pc-fx-shadow-opacity').textContent = `${Math.round(e.target.value * 100)}%`;
        });

        // Save
        document.getElementById('modal-pc-token-edit-save').addEventListener('click', () => {
            if (!currentChar) return;

            currentChar.tokenSize = parseFloat(document.getElementById('pc-token-edit-size').value) || 1;
            currentChar.tokenSight = parseInt(document.getElementById('pc-token-edit-sight').value) || 60;

            // Auras
            currentChar.tokenAuras = tempPlayerAurasList.map(a => { const { isExpanded, ...clean } = a; return clean; });

            // FX
            currentChar.fxOverlayEnabled = document.getElementById('pc-token-edit-fx-overlay-enabled').checked;
            currentChar.fxOverlayOpacity = parseFloat(document.getElementById('pc-token-edit-fx-overlay-opacity').value) || 0.3;
            currentChar.fxOverlayColor = document.getElementById('pc-token-edit-fx-overlay-color').value;

            currentChar.fxVignetteEnabled = document.getElementById('pc-token-edit-fx-vignette-enabled').checked;
            currentChar.fxVignetteOpacity = parseFloat(document.getElementById('pc-token-edit-fx-vignette-opacity').value) || 0.6;
            currentChar.fxVignetteColor = document.getElementById('pc-token-edit-fx-vignette-color').value;

            currentChar.fxShadowEnabled = document.getElementById('pc-token-edit-fx-shadow-enabled').checked;
            currentChar.fxShadowBlur = parseInt(document.getElementById('pc-token-edit-fx-shadow-blur').value) || 12;
            currentChar.fxShadowOffset = parseInt(document.getElementById('pc-token-edit-fx-shadow-offset').value) || 4;
            currentChar.fxShadowColor = document.getElementById('pc-token-edit-fx-shadow-color').value;
            currentChar.fxShadowOpacity = parseFloat(document.getElementById('pc-token-edit-fx-shadow-opacity').value) || 0.7;

            // Update Char via websocket
            saveAndEmit(currentChar);
            renderSheetData(currentChar);

            // Apply immediately to matching canvas tokens
            if (window.VTT && window.VTT.canvasEngine) {
                const tokens = window.VTT.canvasEngine.getTokens();
                let canvasUpdated = false;
                Object.values(tokens).forEach(t => {
                    // Match token to character. Name is primary right now, or maybe they share ID? 
                    // Usually we might not have a direct link if they just spawned it manually.
                    // But if we injected characterId, check it, else check name matching exactly.
                    if (t.characterId === currentChar.id || (t.isPlayer && t.name === currentChar.name)) {
                        const activeImageUrl = (currentChar.tokenImages && currentChar.tokenImages.length > 0 && currentChar.activeTokenIndex >= 0 && currentChar.activeTokenIndex < currentChar.tokenImages.length) ? currentChar.tokenImages[currentChar.activeTokenIndex].url : 'favicon.svg';
                        t.img = activeImageUrl;
                        t.size = currentChar.tokenSize;
                        t.sightRange = currentChar.tokenSight;
                        const _cleanActiveUrl = activeImageUrl.split('?')[0].toLowerCase();
                        t.isVideo = _cleanActiveUrl.endsWith('.gif') || _cleanActiveUrl.endsWith('.mp4') || _cleanActiveUrl.endsWith('.webm') || activeImageUrl.includes('youtube.com');

                        t.auras = JSON.parse(JSON.stringify(currentChar.tokenAuras || []));
                        // Backward compatibility attributes for aura
                        if (t.auras.length > 0) {
                            t.auraEnabled = true;
                            t.auraRange = t.auras[0].range;
                            t.auraShape = t.auras[0].shape;
                            t.auraStyle = t.auras[0].style;
                            t.auraOpacity = t.auras[0].opacity;
                            t.auraColor = t.auras[0].color;
                        } else {
                            t.auraEnabled = false;
                        }

                        t.fxOverlayEnabled = currentChar.fxOverlayEnabled;
                        t.fxOverlayOpacity = currentChar.fxOverlayOpacity;
                        t.fxOverlayColor = currentChar.fxOverlayColor;

                        t.fxVignetteEnabled = currentChar.fxVignetteEnabled;
                        t.fxVignetteOpacity = currentChar.fxVignetteOpacity;
                        t.fxVignetteColor = currentChar.fxVignetteColor;

                        t.fxShadowEnabled = currentChar.fxShadowEnabled;
                        t.fxShadowBlur = currentChar.fxShadowBlur;
                        t.fxShadowOffset = currentChar.fxShadowOffset;
                        t.fxShadowColor = currentChar.fxShadowColor;
                        t.fxShadowOpacity = currentChar.fxShadowOpacity;

                        // We also need to keep the name in sync just in case
                        t.name = currentChar.name;
                        t.hp = currentChar.hpCurrent;
                        t.maxHp = currentChar.hpMax;
                        t.tempHp = currentChar.tempHp || 0;
                        t.characterId = currentChar.id; // Firm up the link for the future

                        canvasUpdated = true;
                    }
                });

                if (canvasUpdated) {
                    window.VTT.canvasEngine.setTokens(tokens); // this broadcasts token:update internally
                }
            }

            document.getElementById('modal-pc-token-edit').classList.add('vtt-hidden');
            document.getElementById('modal-pc-token-edit-overlay').classList.add('vtt-hidden');
        });
    }

    function ensurePlayerTokenEditModalExists() {
        if (document.getElementById('modal-pc-token-edit')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="modal-pc-token-edit-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>
            <div id="modal-pc-token-edit" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:500px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);">Player Token Settings</h3>
                    <button id="modal-pc-token-edit-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
                    <!-- Token Art Section -->
                    <div class="form-group">
                        <h4 style="margin:0 0 12px 0; color:var(--color-text-primary);">Token Artwork</h4>
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="pc-token-add-url" placeholder="Image URL..." style="flex:1;">
                            <button id="btn-pc-token-add-url" class="btn btn-secondary btn-xs">Add URL</button>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <span style="font-size:0.75rem; color:var(--color-text-muted);">OR</span>
                            <input type="file" id="pc-token-file" accept="image/*,video/mp4,video/webm" style="font-size:0.75rem; color:var(--color-text-muted);">
                            <button id="btn-pc-token-upload" class="btn btn-secondary btn-xs">Upload</button>
                        </div>
                        <div id="pc-token-gallery" style="display:flex; flex-wrap:wrap; gap:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px; min-height:80px;">
                            <!-- Gallery items injected here -->
                        </div>
                    </div>
                    
                    <div class="flex-row">
                        <div class="form-group w-50">
                            <label>Token Size Category</label>
                            <select id="pc-token-edit-size" style="width:100%;">
                                <option value="0.5">Small (0.5x0.5 Grid)</option>
                                <option value="1">Medium (1x1 Grid)</option>
                                <option value="2">Large (2x2)</option>
                                <option value="3">Huge (3x3)</option>
                                <option value="4">Gargantuan (4x4)</option>
                            </select>
                        </div>
                        <div class="form-group w-50">
                            <label>Sight Range (ft)</label>
                            <input type="number" id="pc-token-edit-sight" min="0" max="240" step="5" value="60" style="width:100%;" disabled title="Token Sight is managed automatically from the Build Tab Vision settings.">
                            <small style="color:var(--color-text-muted); font-size:0.7rem; margin-top:2px; display:block;">Managed by Build Tab</small>
                        </div>
                    </div>

                    <!-- Aura Settings Section -->
                    <div class="form-group border-top-subtle pt-3 mt-3">
                        <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; justify-content: space-between;">
                            <span><i class="fa-solid fa-circle-nodes"></i> Token Auras</span>
                            <button type="button" id="btn-pc-token-add-aura" class="btn btn-secondary btn-xxs" style="padding: 4px 8px; font-size: 0.72rem;">
                                <i class="fa-solid fa-plus"></i> Add Aura
                            </button>
                        </h4>
                        <div id="pc-token-auras-list" style="margin-top: 10px; max-height: 260px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px;">
                            <!-- Auras dynamically rendered here -->
                        </div>
                    </div>

                    <!-- Token Visual Effects Section -->
                    <div class="form-group border-top-subtle pt-3 mt-3">
                        <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Token Visual Effects
                        </h4>
                        
                        <div class="flex-row" style="gap: 4px; margin-bottom: 12px;">
                            <button type="button" id="tab-btn-pc-fx-overlay" class="btn btn-secondary btn-xxs active" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Overlay</button>
                            <button type="button" id="tab-btn-pc-fx-vignette" class="btn btn-secondary btn-xxs" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Vignette</button>
                            <button type="button" id="tab-btn-pc-fx-shadow" class="btn btn-secondary btn-xxs" style="flex: 1; padding: 4px 0; font-size: 0.7rem; border-radius: 4px;">Shadow</button>
                        </div>
                        
                        <!-- Overlay FX Panel -->
                        <div id="panel-pc-fx-overlay" class="fx-panel" style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="config-setting">
                                <label>Enable Color Overlay</label>
                                <input type="checkbox" id="pc-token-edit-fx-overlay-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                            </div>
                            <div id="pc-fx-overlay-details" class="vtt-hidden">
                                <div class="config-setting">
                                    <label>Overlay Opacity</label>
                                    <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                        <input type="range" id="pc-token-edit-fx-overlay-opacity" min="0.05" max="0.9" step="0.05" value="0.3" style="flex: 1; cursor: pointer;">
                                        <span id="val-pc-fx-overlay-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">30%</span>
                                    </div>
                                </div>
                                <div class="form-group mt-2">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Overlay Color</label>
                                    <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                        <input type="color" id="pc-token-edit-fx-overlay-color" value="#007bff" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Vignette FX Panel -->
                        <div id="panel-pc-fx-vignette" class="fx-panel vtt-hidden" style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="config-setting">
                                <label>Enable Border Vignette</label>
                                <input type="checkbox" id="pc-token-edit-fx-vignette-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                            </div>
                            <div id="pc-fx-vignette-details" class="vtt-hidden">
                                <div class="config-setting">
                                    <label>Vignette Depth</label>
                                    <div style="display: flex; align-items: center; gap: 8px; width: 150px;">
                                        <input type="range" id="pc-token-edit-fx-vignette-opacity" min="0.1" max="1.0" step="0.05" value="0.6" style="flex: 1; cursor: pointer;">
                                        <span id="val-pc-fx-vignette-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">60%</span>
                                    </div>
                                </div>
                                <div class="form-group mt-2">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Vignette Color</label>
                                    <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                        <input type="color" id="pc-token-edit-fx-vignette-color" value="#000000" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Shadow FX Panel -->
                        <div id="panel-pc-fx-shadow" class="fx-panel vtt-hidden" style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="config-setting">
                                <label>Enable Floor Shadow</label>
                                <input type="checkbox" id="pc-token-edit-fx-shadow-enabled" style="cursor: pointer; width: 14px; height: 14px;">
                            </div>
                            <div id="pc-fx-shadow-details" class="vtt-hidden">
                                <div class="flex-row">
                                    <div class="form-group w-50" style="margin-bottom: 0;">
                                        <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Blur (px)</label>
                                        <input type="number" id="pc-token-edit-fx-shadow-blur" min="0" max="40" value="12" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                    </div>
                                    <div class="form-group w-50" style="margin-bottom: 0;">
                                        <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Offset (px)</label>
                                        <input type="number" id="pc-token-edit-fx-shadow-offset" min="-20" max="20" value="4" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                                    </div>
                                </div>
                                <div class="form-group mt-2">
                                    <label style="font-size: 0.72rem; color: var(--color-text-secondary);">Shadow Color & Opacity</label>
                                    <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                                        <input type="color" id="pc-token-edit-fx-shadow-color" value="#000000" style="width: 44px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0; cursor: pointer; background: none;">
                                        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                                            <input type="range" id="pc-token-edit-fx-shadow-opacity" min="0.1" max="1.0" step="0.05" value="0.7" style="flex: 1; cursor: pointer;">
                                            <span id="val-pc-fx-shadow-opacity" style="font-family: monospace; font-size: 0.8rem; font-weight: bold; width: 36px; text-align: right;">70%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="modal-pc-token-edit-save" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        setupPlayerTokenEditListeners();
    }

    let itemCache = null;

    function ensureItemModalsExist() {
        if (document.getElementById('pc-item-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-item-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;"></div>

            <div id="pc-item-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1000; width:600px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-backpack"></i> Add Item</h3>
                    <div style="display:flex; gap:12px; align-items:center; flex:1; max-width:400px; margin:0 24px;">
                        <input type="text" id="pc-item-search" placeholder="Search items..." style="width:100%; padding:6px 12px; border-radius:20px; border:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.3);">
                    </div>
                    <button class="btn btn-icon" id="pc-item-modal-close" style="color:var(--color-text-muted);"><i class="fa-solid fa-times"></i></button>
                </div>
                <div id="pc-item-list" class="scroll-styled" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px;">
                    <div style="text-align:center; color:var(--color-text-muted);">Loading items...</div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; background:rgba(0,0,0,0.2); align-items: center;">
                    <span id="pc-item-selected-count" style="font-size: 0.9rem; color: var(--color-text-muted);">0 items selected</span>
                    <button id="pc-item-modal-add" class="btn btn-primary">Add Selected Items</button>
                </div>
            </div>

            <!-- Custom Item Modal -->
            <div id="pc-custom-item-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:1001; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                <div style="padding:16px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <h3 id="pc-custom-item-modal-title" style="margin:0; color:var(--color-gold-base);">Custom Item</h3>
                    <button class="btn btn-icon" id="pc-custom-item-modal-close" style="color:var(--color-text-muted);"><i class="fa-solid fa-times"></i></button>
                </div>
                <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Item Name</label>
                        <input type="text" id="pc-custom-item-name" style="width:100%;" class="form-control" placeholder="e.g. Health Potion">
                    </div>
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Weight (lb)</label>
                            <input type="number" id="pc-custom-item-weight" style="width:100%;" class="form-control" placeholder="0" min="0" step="any">
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Quantity</label>
                            <input type="number" id="pc-custom-item-qty" style="width:100%;" class="form-control" value="1" min="1">
                        </div>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:0.85rem; color:var(--color-text-secondary);">Description (Optional)</label>
                        <textarea id="pc-custom-item-desc" style="width:100%; height:80px; resize:vertical;" class="form-control" placeholder="Item description..."></textarea>
                    </div>
                </div>
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:flex-end; background:rgba(0,0,0,0.2);">
                    <button id="pc-custom-item-modal-add" class="btn btn-primary">Save Item</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('pc-item-modal-close').addEventListener('click', () => {
            document.getElementById('pc-item-modal').classList.add('vtt-hidden');
            document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('pc-custom-item-modal-close').addEventListener('click', () => {
            document.getElementById('pc-custom-item-modal').classList.add('vtt-hidden');
            // Keep overlay if item modal is open
            if (document.getElementById('pc-item-modal').classList.contains('vtt-hidden')) {
                document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
            }
        });

        document.getElementById('pc-custom-item-modal-add').addEventListener('click', (e) => {
            if (!currentChar) return;
            const nameInput = document.getElementById('pc-custom-item-name');
            const name = nameInput.value.trim();
            if (!name) {
                nameInput.focus();
                return;
            }
            const weight = document.getElementById('pc-custom-item-weight').value || "0";
            const qty = document.getElementById('pc-custom-item-qty').value || "1";
            const desc = document.getElementById('pc-custom-item-desc').value || "";

            const editIdx = e.currentTarget.dataset.editIdx;
            if (editIdx !== undefined) {
                const eq = currentChar.equipment[editIdx];
                if (eq) {
                    eq.name = name;
                    eq.weight = weight;
                    eq.qty = qty;
                    eq.description = desc;
                }
            } else {
                currentChar.equipment.push({
                    id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: name,
                    qty: qty,
                    weight: weight,
                    description: desc
                });
            }
            saveAndEmit(currentChar);
            renderSheetData(currentChar);

            document.getElementById('pc-custom-item-modal').classList.add('vtt-hidden');
            if (document.getElementById('pc-item-modal').classList.contains('vtt-hidden')) {
                document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
            }
        });

        document.getElementById('pc-item-search').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('.pc-item-row').forEach(row => {
                const name = row.dataset.name.toLowerCase();
                row.style.display = name.includes(q) ? 'flex' : 'none';
            });
        });

        document.getElementById('pc-item-modal-add').addEventListener('click', () => {
            if (!currentChar) return;
            const checkboxes = document.querySelectorAll('.pc-item-select:checked');
            checkboxes.forEach(cb => {
                const name = cb.dataset.name;
                const weight = cb.dataset.weight;
                const desc = cb.dataset.desc ? decodeURIComponent(cb.dataset.desc) : '';
                currentChar.equipment.push({
                    id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: name,
                    qty: 1,
                    weight: weight,
                    description: desc
                });
                cb.checked = false;
            });
            updateItemSelectedCount();
            saveAndEmit(currentChar);
            renderSheetData(currentChar);
            document.getElementById('pc-item-modal').classList.add('vtt-hidden');
            document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
        });
    }

    function updateItemSelectedCount() {
        const count = document.querySelectorAll('.pc-item-select:checked').length;
        document.getElementById('pc-item-selected-count').textContent = count + ' item(s) selected';
    }
    window.openCustomItemModal = function (editIdx = null) {
        if (!currentChar) return;
        ensureItemModalsExist();
        const isEdit = editIdx !== null;

        let name = '', weight = '', qty = '1', desc = '';
        if (isEdit) {
            const eq = currentChar.equipment[editIdx];
            name = eq.name || '';
            weight = eq.weight || '';
            qty = eq.qty || '1';
            desc = eq.description || '';
        }

        document.getElementById('pc-custom-item-name').value = name;
        document.getElementById('pc-custom-item-weight').value = weight;
        document.getElementById('pc-custom-item-qty').value = qty;
        document.getElementById('pc-custom-item-desc').value = desc;

        const saveBtn = document.getElementById('pc-custom-item-modal-add');
        if (saveBtn) {
            if (isEdit) {
                saveBtn.dataset.editIdx = editIdx;
                saveBtn.textContent = 'Save Changes';
            } else {
                delete saveBtn.dataset.editIdx;
                saveBtn.textContent = 'Save Item';
            }
        }

        const titleEl = document.getElementById('pc-custom-item-modal-title');
        if (titleEl) {
            titleEl.textContent = isEdit ? 'Edit Item' : 'Custom Item';
        }

        document.getElementById('pc-custom-item-modal').classList.remove('vtt-hidden');
        document.getElementById('pc-item-overlay').classList.remove('vtt-hidden');
        document.getElementById('pc-custom-item-name').focus();
    };

    window.openItemModal = function () {
        if (!currentChar) return;
        ensureItemModalsExist();
        document.getElementById('pc-item-modal').classList.remove('vtt-hidden');
        document.getElementById('pc-item-overlay').classList.remove('vtt-hidden');
        document.getElementById('pc-item-search').value = '';

        const listEl = document.getElementById('pc-item-list');
        listEl.innerHTML = '<div style="text-align:center; color:var(--color-text-muted);">Loading items...</div>';

        if (itemCache) {
            renderItemSearchList();
        } else {
            Promise.all([
                fetch('data/items.json').then(res => res.json()).catch(() => ({})),
                fetch('data/items-base.json').then(res => res.json()).catch(() => ({})),
                fetch('data/magicvariants.json').then(res => res.json()).catch(() => ({})),
                fetch('data/fluff-items.json').then(res => res.json()).catch(() => ({}))
            ]).then(([itemData, baseData, variantData, fluffData]) => {
                let generatedVariants = [];
                if (variantData.magicvariant && baseData.baseitem) {
                    variantData.magicvariant.forEach(variant => {
                        const reqs = variant.requires || [];
                        if (reqs.length === 0) return;

                        const matchingBaseItems = baseData.baseitem.filter(base => {
                            return reqs.some(req => {
                                for (let k in req) {
                                    if (k === 'type' && typeof req[k] === 'string') {
                                        const reqType = req[k].split('|')[0];
                                        if (base.type !== reqType) return false;
                                    } else if (req[k] !== base[k]) return false;
                                }
                                return true;
                            });
                        });

                        matchingBaseItems.forEach(base => {
                            const prefix = variant.inherits && variant.inherits.namePrefix ? variant.inherits.namePrefix : '';
                            const suffix = variant.inherits && variant.inherits.nameSuffix ? variant.inherits.nameSuffix : '';
                            if (!prefix && !suffix) return;
                            const name = prefix + base.name + suffix;
                            generatedVariants.push({
                                ...base,
                                ...(variant.inherits || {}),
                                name: name,
                                _isVariant: true,
                                weight: base.weight || (variant.inherits ? variant.inherits.weight : 0),
                                value: (variant.inherits && variant.inherits.value) ? variant.inherits.value : base.value
                            });
                        });
                    });
                }

                let rawItems = [
                    ...(itemData.item || []),
                    ...(itemData.itemGroup || []),
                    ...(baseData.baseitem || []),
                    ...(variantData.magicvariant || []),
                    ...generatedVariants
                ];

                // Deduplicate items (prevent multiple sources from causing duplicates)
                const uniqueMap = new Map();
                rawItems.forEach(it => {
                    const key = `${it.name}|${it.source || 'unknown'}`;
                    if (!uniqueMap.has(key)) uniqueMap.set(key, it);
                });
                let items = Array.from(uniqueMap.values());

                // Build a quick fluff dictionary for fast lookup
                const fluffDict = {};
                if (fluffData.itemFluff) {
                    fluffData.itemFluff.forEach(f => {
                        const key = (f.name + (f.source || '')).toLowerCase();
                        fluffDict[key] = f.entries || [];
                        if (f._copy && f._copy.name) {
                            const copyKey = (f._copy.name + (f._copy.source || f.source || '')).toLowerCase();
                            if (!fluffDict[key] && fluffDict[copyKey]) {
                                fluffDict[key] = fluffDict[copyKey];
                            }
                        }
                    });
                }
                const ruleDict = { property: {}, mastery: {} };
                if (baseData.itemProperty) {
                    baseData.itemProperty.forEach(p => {
                        if (p.entries && p.abbreviation) {
                            ruleDict.property[p.abbreviation.toLowerCase()] = p.entries;
                        }
                    });
                }
                if (baseData.itemMastery) {
                    baseData.itemMastery.forEach(m => {
                        if (m.entries) {
                            ruleDict.mastery[m.name.toLowerCase()] = m.entries;
                        }
                    });
                }

                itemCache = { items, fluffDict, ruleDict };
                renderItemSearchList();
            }).catch(err => {
                listEl.innerHTML = `<div style="color:var(--color-danger);">Error loading items: ${err.message}</div>`;
            });
        }
    };

    function renderItemSearchList() {
        if (!itemCache) return;
        const listEl = document.getElementById('pc-item-list');
        listEl.innerHTML = '';

        const { items, fluffDict, ruleDict } = itemCache;
        const sortedItems = [...items].filter(i => i.type !== "GV" && !String(i.type).startsWith("GV|")).sort((a, b) => a.name.localeCompare(b.name));

        function parseEntry(e, itemObj) {
            if (typeof e === 'string') {
                let str = e.replace(/{@\w+ ([^|}]+)[^}]*}/g, '$1');
                // Replace 5etools {=variable} syntax with inherited mechanics
                str = str.replace(/{=([^}]+)}/g, (match, p1) => {
                    if (itemObj && itemObj[p1] !== undefined) return itemObj[p1];
                    if (itemObj && itemObj.inherits && itemObj.inherits[p1] !== undefined) return itemObj.inherits[p1];
                    return match;
                });
                // Replace 5etools {#itemEntry ...} syntax to pull external text
                str = str.replace(/\{#itemEntry ([^|}]+)[^}]*\}/g, (match, p1) => {
                    // Special intercept for generic resistance items
                    if (itemObj && itemObj.resist && p1.includes("Resistance")) {
                        const type = p1.split(' ')[0].toLowerCase(); // armor, ring, potion
                        return `You have resistance to ${itemObj.resist.join(' and ')} damage while you wear or use this ${type}.`;
                    }
                    const refItem = items.find(i => i.name === p1);
                    if (refItem && refItem.entries) return parseEntry(refItem.entries, refItem);
                    if (refItem && refItem.inherits && refItem.inherits.entries) return parseEntry(refItem.inherits.entries, refItem);
                    return `See *${p1}*`;
                });
                return str;
            }
            if (Array.isArray(e)) return e.map(x => parseEntry(x, itemObj)).filter(Boolean).join('\n\n');
            if (e.type === 'list' && e.items) return e.items.map(li => '- ' + parseEntry(li, itemObj)).filter(Boolean).join('\n');
            if (e.entries) return (e.name ? `**${e.name}.** ` : '') + parseEntry(e.entries, itemObj);
            if (e.type === 'table') return '[Table]';
            return '';
        }

        let html = '';
        for (const item of sortedItems) {
            const weight = item.weight || 0;
            const source = item.source || '';
            const val = item.value ? (item.value / 100) + ' gp' : '';

            function buildMechanicalText(item) {
                let lines = [];
                const typeMap = {
                    "M": "Melee Weapon", "R": "Ranged Weapon",
                    "LA": "Light Armor", "MA": "Medium Armor", "HA": "Heavy Armor", "S": "Shield",
                    "W": "Wondrous Item", "P": "Potion", "RG": "Ring", "RD": "Rod", "ST": "Staff", "WD": "Wand", "SC": "Scroll"
                };
                const propMap = {
                    "V": "Versatile", "F": "Finesse", "L": "Light", "H": "Heavy", "2H": "Two-Handed", "T": "Thrown", "A": "Ammunition", "R": "Reach", "S": "Special", "LD": "Loading"
                };
                const dmgTypeMap = {
                    "S": "slashing", "P": "piercing", "B": "bludgeoning", "C": "cold", "F": "fire", "L": "lightning",
                    "O": "force", "N": "necrotic", "R": "radiant", "T": "thunder", "Y": "psychic", "A": "acid", "I": "poison"
                };

                const typeName = typeMap[item.type] || item.type || item.weaponCategory || "Item";
                const rarity = item.rarity ? `, ${item.rarity}` : "";
                const attune = item.reqAttune ? ` (requires attunement)` : "";
                lines.push(`*${typeName}${rarity}${attune}*`);

                if (item.ac) {
                    let acStr = String(item.ac);
                    if (item.type === 'LA') acStr += ' + Dex modifier';
                    if (item.type === 'MA') acStr += ' + Dex modifier (max 2)';
                    lines.push(`**Armor Class:** ${acStr}`);
                }
                if (item.dmg1) {
                    const dt = dmgTypeMap[item.dmgType] || item.dmgType || '';
                    let dmg = `**Damage:** ${item.dmg1} ${dt}`;
                    if (item.dmg2) dmg += ` (or ${item.dmg2} ${dt} versatile)`;
                    lines.push(dmg);
                }
                if (item.property && item.property.length > 0) {
                    const props = item.property.map(p => {
                        const propStr = typeof p === 'string' ? p : (p.uid || p.name || '');
                        const baseProp = propStr.split('|')[0];
                        const mapped = propMap[baseProp] || propMap[propStr] || baseProp;
                        if (typeof p === 'object' && p.note) return `${mapped} (${p.note})`;
                        return mapped;
                    }).filter(Boolean).join(', ');
                    if (props) lines.push(`**Properties:** ${props}`);
                }
                if (item.resist) lines.push(`**Resistance:** ${Array.isArray(item.resist) ? item.resist.join(', ') : item.resist}`);
                if (item.immune) lines.push(`**Immunity:** ${Array.isArray(item.immune) ? item.immune.join(', ') : item.immune}`);
                if (item.conditionImmune) lines.push(`**Condition Immunity:** ${Array.isArray(item.conditionImmune) ? item.conditionImmune.join(', ') : item.conditionImmune}`);

                return lines.length ? lines.join('\n') + '\n---\n' : '';
            }

            let mechText = buildMechanicalText(item);
            let parts = [];

            // 1. If variant, append base item lore/mechanics first
            if (item._isVariant && item.baseName) {
                const baseKey = (item.baseName + source).toLowerCase();
                let baseEntries = null;
                const baseItem = items.find(i => i.name === item.baseName);
                if (baseItem && baseItem.entries && baseItem.entries.length) {
                    baseEntries = baseItem.entries;
                } else if (fluffDict && fluffDict[baseKey]) {
                    baseEntries = fluffDict[baseKey];
                }
                if (baseEntries) parts.push(parseEntry(baseEntries, item));
            }

            // 2. Add specific item entries or fluff
            let itemEntries = item.entries || (item.inherits ? item.inherits.entries : null);
            if (!itemEntries || itemEntries.length === 0) {
                const key = (item.name + source).toLowerCase();
                if (fluffDict && fluffDict[key]) {
                    itemEntries = fluffDict[key];
                }
            }
            if (itemEntries) parts.push(parseEntry(itemEntries, item));

            // 3. Append explicit rule text for weapon properties and masteries
            if (ruleDict) {
                if (item.property && item.property.length > 0) {
                    item.property.forEach(prop => {
                        const propStr = typeof prop === 'string' ? prop : (prop.uid || prop.name || '');
                        const baseProp = propStr.split('|')[0].toLowerCase();
                        if (ruleDict.property[baseProp]) {
                            parts.push(parseEntry(ruleDict.property[baseProp], item));
                        }
                    });
                }
                if (item.mastery && item.mastery.length > 0) {
                    item.mastery.forEach(mastery => {
                        const masteryStr = typeof mastery === 'string' ? mastery : (mastery.uid || mastery.name || '');
                        const baseMastery = masteryStr.split('|')[0].toLowerCase();
                        if (ruleDict.mastery[baseMastery]) {
                            const masteryEntry = {
                                type: "entries",
                                name: "Mastery: " + baseMastery.charAt(0).toUpperCase() + baseMastery.slice(1),
                                entries: ruleDict.mastery[baseMastery]
                            };
                            parts.push(parseEntry(masteryEntry, item));
                        }
                    });
                }
            }

            let descText = mechText + parts.filter(Boolean).join('\n\n');

            html += `
                <label class="pc-item-row glassmorphism" data-name="${item.name.replace(/"/g, '&quot;')}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <input type="checkbox" class="pc-item-select" data-name="${item.name.replace(/"/g, '&quot;')}" data-weight="${weight}" data-desc="${encodeURIComponent(descText)}" style="cursor:pointer; width:16px; height:16px;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:bold; color:var(--color-gold-light);">${item.name}</span>
                            <span style="font-size:0.75rem; color:var(--color-text-muted);">${source} ${val ? '| ' + val : ''}</span>
                        </div>
                    </div>
                    <div style="font-size:0.85rem; color:var(--color-text-secondary);">
                        ${weight} lb
                    </div>
                </label>
            `;
        }
        listEl.innerHTML = html;
        document.querySelectorAll('.pc-item-select').forEach(cb => {
            cb.addEventListener('change', updateItemSelectedCount);
        });
        updateItemSelectedCount();
    }
    // ─── Panel open / minimize / expand ──────────────────────────────────────
    function openPanel() {
        if (window.VTT && window.VTT.creatureSheet && typeof window.VTT.creatureSheet.minimizePanel === 'function') {
            window.VTT.creatureSheet.minimizePanel();
            const creaturePanel = document.getElementById('creature-sheet-panel');
            if (creaturePanel) creaturePanel.style.zIndex = "50";
        }
        panel.style.zIndex = "55";
        panel.classList.add('open');
        panel.classList.remove('minimized');
        isMinimized = false;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        minimizeBtn.title = 'Minimize Player Sheet';
    }

    function minimizePanel() {
        panel.classList.remove('open');
        panel.classList.add('minimized');
        isMinimized = true;
        minimizeBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        minimizeBtn.title = 'Expand Player Sheet';
    }

    minimizeBtn.addEventListener('click', () => {
        if (isMinimized) {
            openPanel();
        } else {
            minimizePanel();
        }
    });

    // ─── Inner Tabs ────────────────────────────────────────────────────────
    const psTabBtns = document.querySelectorAll('.ps-tab-btn');
    const psTabContents = document.querySelectorAll('.ps-tab-content');

    psTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            psTabBtns.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--color-text-secondary)';
            });
            psTabContents.forEach(c => c.classList.add('vtt-hidden'));

            btn.classList.add('active');
            btn.style.borderBottomColor = 'var(--color-gold-base)';
            btn.style.color = 'var(--color-gold-light)';

            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.remove('vtt-hidden');
        });
    });

    // ─── Right Sidebar Character List ────────────────────────────────────────
    function renderCharacterList() {
        if (!vtt.campaignState || !vtt.campaignState.characters) return;
        let chars = Object.values(vtt.campaignState.characters);
        
        if (vtt.role !== 'GM') {
            chars = chars.filter(c => c.assignedPlayers && (c.assignedPlayers.includes(vtt.username) || c.assignedPlayers.includes('*')));
        }

        const pcs = chars.filter(c => !c.isCompanion && !c.isCustomNpc);
        const companions = chars.filter(c => c.isCompanion && !c.isCustomNpc);

        if (chars.length === 0) {
            charListEl.innerHTML = '<div class="init-empty-state">No characters yet. Click "New" to create one.</div>';
            return;
        }

        let html = '';

        if (pcs.length > 0) {
            if (companions.length > 0) {
                html += `<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-text-muted); margin:4px 0 4px 8px; text-transform:uppercase; letter-spacing:1px;">Player Characters</div>`;
            }
            html += pcs.map(c => `
                <div class="init-row char-row" data-id="${c.id}" draggable="true" style="cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; padding:12px; gap:6px;">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="init-name" style="font-size:1.05rem;">${c.name}</span>
                        <button class="btn btn-xxs btn-danger btn-char-delete" data-id="${c.id}" title="Delete Character"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-secondary);">${c.class || 'Unknown Class'} ${c.level ? `Lv${c.level}` : ''} | ${c.race || 'Unknown Species'}</div>
                    <div style="display:flex; gap:12px; font-size:0.75rem; margin-top:4px; font-family:var(--font-code);">
                        <span style="color:var(--color-gold-light);"><i class="fa-solid fa-heart"></i> ${c.hpCurrent}/${c.hpMax}</span>
                        <span style="color:var(--color-text-muted);"><i class="fa-solid fa-shield"></i> AC ${c.ac || 10}</span>
                    </div>
                </div>
            `).join('');
        }

        if (companions.length > 0) {
            if (pcs.length > 0) {
                html += `<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-text-muted); margin:12px 0 4px 8px; text-transform:uppercase; letter-spacing:1px;">Player Companions</div>`;
            }
            html += companions.map(c => `
                <div class="init-row char-row" data-id="${c.id}" data-is-companion="true" draggable="true" style="cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; padding:12px; gap:6px; border-left:3px solid var(--color-gold-base);">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="init-name" style="font-size:1.05rem;"><i class="fa-solid fa-paw" style="margin-right:4px; font-size:0.8rem;"></i> ${c.name}</span>
                        <button class="btn btn-xxs btn-danger btn-char-delete" data-id="${c.id}" title="Delete Companion"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div style="font-size:0.75rem; color:var(--color-text-secondary);">Owned by: ${c.assignedPlayers && c.assignedPlayers.length > 0 ? (c.assignedPlayers.includes('*') ? 'All Players' : c.assignedPlayers.join(', ')) : 'None'}</div>
                    <div style="display:flex; gap:12px; font-size:0.75rem; margin-top:4px; font-family:var(--font-code);">
                        <span style="color:var(--color-gold-light);"><i class="fa-solid fa-heart"></i> ${c.hpCurrent}/${c.hpMax}</span>
                        <span style="color:var(--color-text-muted);"><i class="fa-solid fa-shield"></i> AC ${c.ac || 10}</span>
                    </div>
                </div>
            `).join('');
        }

        charListEl.innerHTML = html;

        charListEl.querySelectorAll('.char-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                const id = row.dataset.id;
                const c = vtt.campaignState.characters[id];
                if (!c) {
                    e.preventDefault();
                    return;
                }

                // Check permissions: Must be GM or an assigned player
                if (vtt.role !== 'GM' && (!c.assignedPlayers || !(c.assignedPlayers.includes(vtt.username) || c.assignedPlayers.includes('*')))) {
                    e.preventDefault();
                    return;
                }

                let size = 1;
                let img = null; // Do not bundle base64 images into dataTransfer, resolve on drop

                if (c.isCompanion && c.monsterData) {
                    // Extract size from bestiary
                    const sz = c.monsterData.size ? (Array.isArray(c.monsterData.size) ? c.monsterData.size[0] : c.monsterData.size) : 'M';
                    switch (sz) {
                        case 'T': size = 0.5; break;
                        case 'S': size = 1; break;
                        case 'M': size = 1; break;
                        case 'L': size = 2; break;
                        case 'H': size = 3; break;
                        case 'G': size = 4; break;
                        default: size = 1; break;
                    }
                }

                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'player',
                    name: c.name,
                    hp: c.hpCurrent || 0,
                    maxHp: c.hpMax || 0,
                    tempHp: c.tempHp || 0,
                    size: size,
                    img: img, // Will be null for PCs, resolved by vtt-data-bridge.js
                    characterId: c.id
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });

            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-char-delete')) return;
                const id = row.dataset.id;
                openSheet(id);
            });
        });

        charListEl.querySelectorAll('.btn-char-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm("Delete this character forever?")) {
                    vtt.socket.emit('character:delete', { id });
                    if (currentChar && currentChar.id === id) {
                        closeSheet();
                    }
                }
            });
        });
    }

    const btnCharAddCompanion = document.getElementById('btn-char-add-companion');

    if (btnCharAddCompanion) {
        btnCharAddCompanion.addEventListener('click', async () => {
            // We need a modal to select a monster, then an owner.
            try {
                const indexRes = await fetch('data/bestiary/index.json');
                if (!indexRes.ok) throw new Error('Could not load bestiary index.json');
                const indexData = await indexRes.json();
                
                const fetchPromises = Object.values(indexData).map(filename => 
                    fetch(`data/bestiary/${filename}`)
                        .then(res => res.ok ? res.json() : { monster: [] })
                        .catch(() => ({ monster: [] }))
                );
                
                const results = await Promise.all(fetchPromises);
                const monsters = [];
                results.forEach(data => {
                    if (data && data.monster && Array.isArray(data.monster)) {
                        monsters.push(...data.monster);
                    }
                });
                
                // create a temporary modal
                const modalOverlay = document.createElement('div');
                modalOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;';
                
                const modal = document.createElement('div');
                modal.className = 'glassmorphism';
                modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:500px; max-height:80vh; display:flex; flex-direction:column; padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';
                
                modal.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-paw"></i> Add Player Companion</h3>
                        <button id="comp-modal-close" class="btn btn-icon btn-secondary"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="form-group">
                        <label>Search Bestiary</label>
                        <input type="text" id="comp-search" placeholder="Search monsters (e.g., Wolf)...">
                    </div>
                    <div id="comp-list" class="scroll-styled" style="flex:1; border:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.2); overflow-y:auto; padding:4px; min-height:200px;"></div>
                `;
                
                document.body.appendChild(modalOverlay);
                document.body.appendChild(modal);
                
                const listEl = modal.querySelector('#comp-list');
                const searchInput = modal.querySelector('#comp-search');
                
                const renderList = (query) => {
                    listEl.innerHTML = '';
                    const q = query.toLowerCase().trim();
                    const filtered = monsters.filter(m => {
                        const nameMatch = m.name.toLowerCase().includes(q);
                        const crStr = m.cr ? (typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr)).toLowerCase() : '0';
                        const crMatch = crStr === q || crStr.includes(q) || `cr ${crStr}`.includes(q) || `cr${crStr}`.includes(q);
                        return nameMatch || crMatch;
                    }).slice(0, 50);
                    filtered.forEach(m => {
                        const row = document.createElement('div');
                        row.style.cssText = 'padding:8px; border-bottom:1px solid var(--color-border-subtle); cursor:pointer; display:flex; justify-content:space-between;';
                        row.innerHTML = `<span>${m.name} <span style="font-size:0.75em; color:var(--color-text-muted);">[${m.source || 'Unknown'}]</span></span> <span style="color:var(--color-text-muted);">CR ${m.cr ? (m.cr.cr || m.cr) : '0'}</span>`;
                        row.addEventListener('click', () => {
                            selectOwnerForCompanion(m);
                            closeModal();
                        });
                        row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.1)';
                        row.onmouseout = () => row.style.background = 'transparent';
                        listEl.appendChild(row);
                    });
                };
                
                const closeModal = () => {
                    modalOverlay.remove();
                    modal.remove();
                };
                
                modal.querySelector('#comp-modal-close').addEventListener('click', closeModal);
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
                renderList('');
                
                const selectOwnerForCompanion = (monster) => {
                    const knownPlayers = (vtt.campaignState && vtt.campaignState.knownPlayers) ? vtt.campaignState.knownPlayers : [];
                    const allowedUsers = (vtt.campaignState && vtt.campaignState.allowedUsers) ? vtt.campaignState.allowedUsers : [];
                    const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];
                    
                    const ownerOverlay = document.createElement('div');
                    ownerOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;';
                    const ownerModal = document.createElement('div');
                    ownerModal.className = 'glassmorphism';
                    ownerModal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';
                    
                    let optionsHtml = '<option value="*">All Players</option>';
                    optionsHtml += allPotentialPlayers.map(p => `<option value="${p}">${p}</option>`).join('');
                    
                    ownerModal.innerHTML = `
                        <h4 style="margin-top:0; color:var(--color-gold-base);">Assign Owner for ${monster.name}</h4>
                        <div class="form-group">
                            <label>Select Player</label>
                            <select id="comp-owner-sel">${optionsHtml}</select>
                        </div>
                        <div class="form-group">
                            <label>Custom Nickname (Optional)</label>
                            <input type="text" id="comp-nickname" placeholder="${monster.name}">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                            <button id="comp-owner-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                            <button id="comp-owner-save" class="btn btn-primary btn-sm">Create Companion</button>
                        </div>
                    `;
                    
                    document.body.appendChild(ownerOverlay);
                    document.body.appendChild(ownerModal);
                    
                    const closeOwnerModal = () => {
                        ownerOverlay.remove();
                        ownerModal.remove();
                    };
                    
                    ownerModal.querySelector('#comp-owner-cancel').addEventListener('click', closeOwnerModal);
                    ownerModal.querySelector('#comp-owner-save').addEventListener('click', () => {
                        const owner = ownerModal.querySelector('#comp-owner-sel').value;
                        const nickname = ownerModal.querySelector('#comp-nickname').value.trim() || monster.name;
                        
                        // Calculate basic HP to render on card
                        let hp = 20;
                        if (monster.hp && monster.hp.average) hp = monster.hp.average;
                        
                        const newComp = {
                            id: 'comp_' + Date.now(),
                            name: nickname,
                            isCompanion: true,
                            assignedPlayers: owner ? [owner] : [],
                            monsterData: monster,
                            hpMax: hp,
                            hpCurrent: hp,
                            tempHp: 0,
                            ac: monster.ac ? (monster.ac[0].ac || monster.ac[0]) : 10,
                            tokenImages: []
                        };
                        
                        vtt.socket.emit('character:update', { character: newComp });
                        closeOwnerModal();
                    });
                };
            } catch (e) {
                console.error("Error loading bestiary for companion:", e);
                alert("Could not load bestiary data.");
            }
        });
    }

    if (btnCharAdd) {
        btnCharAdd.addEventListener('click', () => {
            const newChar = {
                id: 'char_' + Date.now(),
                name: "New Character",
                class: "Fighter",
                level: 1,
                race: "Human",
                background: "Acolyte",
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hpMax: 10,
                hpCurrent: 10,
                tempHp: 0,
                ac: 10,
                speed: 30,
                equipment: [],
                spells: { cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: [], legacy: [] },
                bio: { height: '', age: '', weight: '', backstory: '', notes: '' },
                abilityCards: [],
                macros: [],
                toHit: '',
                dcAbility: 'INT',
                skills: {},
                expertise: {},
                tools: {},
                tokenImages: [],
                activeTokenIndex: 0,
                assignedPlayers: []
            };
            vtt.socket.emit('character:update', { character: newChar });

            // Optimistic update
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[newChar.id] = newChar;
            renderCharacterList();
            openSheet(newChar.id);
        });
    }

    // ─── Builder Automation & rendering ──────────────────────────────────────
    function getTotalStat(char, ab) {
        const base = parseInt(char.stats && char.stats[ab]) || 10;
        const mod = parseInt(char.statMods && char.statMods[ab]) || 0;
        return base + mod;
    }

    function getMod(score) {
        return Math.floor(((parseInt(score) || 10) - 10) / 2);
    }

    function getProfBonus(level) {
        const l = parseInt(level) || 1;
        return Math.ceil(l / 4) + 1;
    }

    function recalculateDerived(char) {
        // Very basic automation for HP and AC if they aren't manually overridden heavily.
        // Actually, we'll just leave this as a manual stat manager with auto modifiers for now to keep it playable.
        // True 5etools JSON reading is massive, so we do base 5e math based on inputs.
        const conMod = getMod(getTotalStat(char, 'con'));
        const dexMod = getMod(getTotalStat(char, 'dex'));

        // This is a placeholder for derived logic. In a full builder we'd read class hit dice.
        // But for this baseline, we'll rely on the user to punch in their max HP or we give a rough estimate.
    }

    function openSheet(id) {
        if (!vtt.campaignState || !vtt.campaignState.characters) return;
        const char = vtt.campaignState.characters[id];
        if (!char) return;

        if (vtt.role !== 'GM' && (!char.assignedPlayers || !(char.assignedPlayers.includes(vtt.username) || char.assignedPlayers.includes('*')))) {
            return; // Not assigned to this player
        }

        if ((char.isCompanion || char.isCustomNpc || char.monsterData) && vtt.creatureSheet) {
            vtt.creatureSheet.openSheet(char.monsterData, null, char.id);
            return;
        }

        currentChar = char;
        placeholderEl.classList.add('vtt-hidden');
        activeSheetEl.classList.remove('vtt-hidden');

        renderSheetData(char);
        openPanel();
    }

    function closeSheet() {
        currentChar = null;
        placeholderEl.classList.remove('vtt-hidden');
        activeSheetEl.classList.add('vtt-hidden');
        minimizePanel();
    }

    let renderDebounceTimer = null;
    function debouncedRenderSheetData(char) {
        if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
        renderDebounceTimer = setTimeout(() => {
            if (char) renderSheetData(char);
        }, 300);
    }

    function renderSheetData(char) {
        if (!char) return;
        currentChar = char;
        if (window.VTTSpellManager) {
            window.VTTSpellManager.init({
                currentChar: currentChar,
                saveAndEmit: saveAndEmit,
                renderSheetData: renderSheetData,
                spellCache: spellCache
            });
            window.VTTSpellManager.ensureSpellModalsExist();
        }
        ensureAbilityModalsExist();
        ensureItemModalsExist();
        ensureSaveSettingsModalExists();
        ensureSkillSettingsModalExists();
        ensureToolSettingsModalExists();
        ensurePlayerTokenEditModalExists();
        const prof = getProfBonus(char.level);

        const calculatedAtkBonus = (m) => {
            let baseAtkMod = char.attackSettings?.atkMod || 0;
            if (char.attackSettings?.toggles) {
                char.attackSettings.toggles.filter(t => t.enabled).forEach(t => {
                    if (t.target === 'atk' || t.target === 'both') {
                        if (!t.formula.includes('d')) {
                            baseAtkMod += parseInt(t.formula) || 0;
                        }
                    }
                });
            }

            const atkStat = m.attackStat || 'none';
            if (atkStat === 'custom') {
                return m.attackBonus || '';
            }
            if (atkStat === 'none') {
                return m.attackBonus || '';
            }
            const statScore = getTotalStat(char, atkStat.toLowerCase()) || 10;
            const statMod = getMod(statScore);
            const pr = m.attackProf ? prof : 0;
            const extra = m.attackExtra !== undefined ? parseInt(m.attackExtra) : 0;
            const total = statMod + pr + extra + baseAtkMod;
            return (total >= 0 ? '+' : '') + total;
        };

        const calculatedSaveDc = (m) => {
            const dcStat = m.saveDcStat || 'none';
            if (dcStat === 'custom') {
                return m.saveDcCustom !== undefined && m.saveDcCustom !== null ? m.saveDcCustom : (m.saveDcBase || (8 + prof + getMod(getTotalStat(char, (char.dcAbility || 'INT').toLowerCase()))));
            }
            const pr = prof;
            let statMod = 0;
            if (dcStat === 'none') {
                statMod = getMod(getTotalStat(char, (char.dcAbility || 'INT').toLowerCase()) || 10);
            } else {
                statMod = getMod(getTotalStat(char, dcStat.toLowerCase()) || 10);
            }
            const extra = m.saveDcExtra !== undefined ? parseInt(m.saveDcExtra) : 0;
            return 8 + pr + statMod + extra;
        };

        char.equipment = Array.isArray(char.equipment) ? char.equipment : [{ id: 'eq_legacy', name: 'Legacy Equipment', qty: 1, description: char.equipment || '' }];
        
        if (!char.classes) {
            char.classes = [{ name: char.class || '', subclass: '', level: char.level || 1 }];
        }
        
        if (typeof char.speed === 'number' || typeof char.speed === 'string') {
            char.speed = { walk: parseInt(char.speed) || 30, climb: 0, fly: 0, burrow: 0 };
        } else if (!char.speed) {
            char.speed = { walk: 30, climb: 0, fly: 0, burrow: 0 };
        }
        
        char.senses = char.senses || { darkvision: 0, devilSight: 0, blindsight: 0, truesight: 0 };
        const maxSpecialVision = Math.max(
            parseInt(char.senses.darkvision) || 0,
            parseInt(char.senses.devilSight) || 0,
            parseInt(char.senses.blindsight) || 0,
            parseInt(char.senses.truesight) || 0
        );
        char.tokenSight = maxSpecialVision > 0 ? maxSpecialVision : 60;
        
        char.spells = (typeof char.spells === 'object' && char.spells !== null && !Array.isArray(char.spells)) ? char.spells : { cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: [], legacy: [{ id: 'sp_legacy', name: 'Legacy Spells', description: char.spells || '' }] };
        char.bio = char.bio || { height: '', age: '', weight: '', backstory: '', notes: char.info || '' };
        char.abilityCards = char.abilityCards || [];
        char.macros = char.macros || [];
        char.spellSlots = char.spellSlots || {
            level1: { current: 0, max: 0 },
            level2: { current: 0, max: 0 },
            level3: { current: 0, max: 0 },
            level4: { current: 0, max: 0 },
            level5: { current: 0, max: 0 },
            level6: { current: 0, max: 0 },
            level7: { current: 0, max: 0 },
            level8: { current: 0, max: 0 },
            level9: { current: 0, max: 0 }
        };
        char.macros = char.macros.map(m => {
            if (m.damage !== undefined && !Array.isArray(m.damage)) {
                return {
                    id: m.id || 'mac_' + Date.now(),
                    name: m.name || '',
                    attackBonus: m.bonus || '',
                    saveAbility: '',
                    saveDcBase: '',
                    damage: m.damage ? [{ id: 'dmg_' + Date.now(), formula: m.damage, type: '' }] : []
                };
            }
            return m;
        });
        char.toHit = char.toHit || '';
        char.dcAbility = char.dcAbility || 'INT';
        char.spellAbility = char.spellAbility || 'INT';
        char.skills = char.skills || {};
        char.expertise = char.expertise || {};
        char.tools = char.tools || {};
        char.saves = char.saves || {};
        char.statMods = char.statMods || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        char.deathSaves = char.deathSaves || { successes: 0, failures: 0 };
        char.globalSaveMod = char.globalSaveMod || 0;
        char.saveMods = char.saveMods || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        char.saveToggles = char.saveToggles || [];
        char.globalAbilityMod = char.globalAbilityMod || "0";
        char.skillMods = char.skillMods || {};
        char.skillToggles = char.skillToggles || [];
        char.tokenImages = char.tokenImages || [];
        char.activeTokenIndex = char.activeTokenIndex || 0;
        char.proficiencies = char.proficiencies || { languages: '', weapons: '', armor: '' };
        char.inspiration = !!char.inspiration;
        char.heroPoints = typeof char.heroPoints === 'number' ? char.heroPoints : (parseInt(char.heroPoints) || 0);

        const activeImageUrl = (char.tokenImages && char.tokenImages.length > 0 && char.activeTokenIndex < char.tokenImages.length)
            ? char.tokenImages[char.activeTokenIndex].url
            : 'favicon.svg';

        const standardHitDice = {
            'artificer': 'd8', 'barbarian': 'd12', 'bard': 'd8', 'cleric': 'd8', 'druid': 'd8',
            'fighter': 'd10', 'monk': 'd8', 'paladin': 'd10', 'ranger': 'd10', 'rogue': 'd8',
            'sorcerer': 'd6', 'warlock': 'd8', 'wizard': 'd6', 'blood hunter': 'd10'
        };

        const hdMax = {};
        if (char.classes && char.classes.length > 0) {
            char.classes.forEach(c => {
                const name = c.name.toLowerCase();
                const hd = standardHitDice[name] || 'd8';
                hdMax[hd] = (hdMax[hd] || 0) + (parseInt(c.level) || 1);
            });
        } else {
            hdMax['d8'] = char.level || 1;
        }

        char.hitDiceSpent = char.hitDiceSpent || {};

        let hdHtml = '<div class="cs-hp-row" style="display:flex; align-items:center; justify-content:flex-start; gap:16px; flex-wrap:wrap; background:rgba(0,0,0,0.1); border-top:1px solid rgba(255,255,255,0.03);">';
        hdHtml += '<div class="cs-hp-label" style="margin-right:8px; margin-bottom:0;"><i class="fa-solid fa-dice-d20"></i> Hit Dice</div>';
        Object.keys(hdMax).sort().forEach(hd => {
            const max = hdMax[hd];
            const spent = char.hitDiceSpent[hd] || 0;
            const remaining = Math.max(0, max - spent);
            
            hdHtml += '<div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">';
            hdHtml += '<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-gold-light); font-weight:bold;">' + hd.toUpperCase() + '</div>';
            hdHtml += '<div style="font-family:var(--font-code); font-size:0.85rem; color:var(--color-text-secondary);">' + remaining + '/' + max + '</div>';
            hdHtml += '<button class="pc-roll-hd btn btn-xs btn-primary" data-hd="' + hd + '" data-rem="' + remaining + '" ' + (remaining <= 0 ? 'disabled' : '') + ' style="padding:2px 6px; font-size:0.7rem;"><i class="fa-solid fa-dice"></i></button>';
            hdHtml += '<button class="pc-reset-hd btn btn-xs btn-secondary" data-hd="' + hd + '" style="padding:2px 6px; font-size:0.7rem;" title="Reset 1 spent"><i class="fa-solid fa-rotate-left"></i></button>';
            hdHtml += '</div>';
        });
        hdHtml += '</div>';

        const cleanUrl = activeImageUrl.split('?')[0].toLowerCase();
        const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
        const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
        
        let mediaHtml = '';
        if (isVideo) {
            mediaHtml = `<video src="${activeImageUrl}" draggable="false" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>`;
        } else if (isYoutube) {
            let ytUrl = activeImageUrl;
            const ytMatch = activeImageUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (ytMatch) {
                const videoId = ytMatch[1];
                ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
            }
            mediaHtml = `<iframe src="${ytUrl}" draggable="false" frameborder="0" style="width: 100%; height: 100%; pointer-events:none;"></iframe>`;
        } else {
            mediaHtml = `<img src="${activeImageUrl}" draggable="false" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        const primaryHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:12px; width:100%;">
                    <div id="pc-token-portrait" draggable="true" title="Manage / Drag to spawn Token" style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid var(--color-gold-base); cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                        ${mediaHtml}
                    </div>
                    <input type="text" id="pc-name" value="${char.name}" style="font-size:1.4rem; font-family:var(--font-heading); font-weight:700; width:100%; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); padding:4px 0;">
                    ${vtt.role === 'GM' ? '<button class="btn btn-secondary btn-sm" id="pc-assign-players-btn" style="flex-shrink:0; padding:6px 12px; margin-left:8px;" title="Assign Players to this Sheet"><i class="fa-solid fa-users"></i></button>' : ''}
                </div>
            </div>
            
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;">
                <div class="cs-stat-pill pc-inspiration-pill ${char.inspiration ? 'active' : ''}" id="pc-inspiration-toggle" style="cursor:pointer; user-select:none; flex:1; display:flex; align-items:center; justify-content:center; gap:8px; height:36px; padding:6px 12px; border-radius:20px; font-size:0.9rem; font-family:var(--font-heading); ${char.inspiration ? 'border:1.5px solid var(--color-gold-base); background:rgba(212,175,55,0.25); color:var(--color-gold-light); box-shadow:0 0 12px rgba(212,175,55,0.4);' : 'background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); opacity:0.8;'}" title="Toggle DM Inspiration">
                    <i class="fa-solid fa-dice-d20" style="font-size:1.05rem; ${char.inspiration ? 'color:var(--color-gold-light); text-shadow:0 0 8px var(--color-gold-base);' : 'color:var(--color-text-muted);'}"></i>
                    <span style="font-weight:600; font-size:0.9rem; letter-spacing:0.5px;">Inspired</span>
                </div>
                <div class="cs-stat-pill" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; height:36px; padding:6px 12px; border-radius:20px; font-size:0.9rem; font-family:var(--font-heading); background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1);" title="Hero Points">
                    <i class="fa-solid fa-shield-heart" style="font-size:1.05rem; color:var(--color-gold-base);"></i>
                    <span style="font-size:0.9rem; font-weight:600; letter-spacing:0.5px;">Hero Pts</span>
                    <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
                        <button class="cs-hp-btn" id="pc-hero-minus" style="padding:0; height:22px; width:22px; font-size:0.85rem; display:flex; align-items:center; justify-content:center;" title="Spend Hero Point">−</button>
                        <input type="text" inputmode="numeric" pattern="[0-9]*" id="pc-hero-points-input" value="${char.heroPoints || 0}" style="width:26px; background:transparent; border:none; color:var(--color-gold-light); text-align:center; font-family:var(--font-heading); font-size:1rem; font-weight:bold; padding:0;">
                        <button class="cs-hp-btn" id="pc-hero-plus" style="padding:0; height:22px; width:22px; font-size:0.85rem; display:flex; align-items:center; justify-content:center;" title="Add Hero Point">+</button>
                    </div>
                </div>
            </div>
            
            <div class="cs-hp-container" style="margin-bottom:16px;">
                <div style="display: flex; gap: 4px; margin-bottom: 8px; align-items: center;">
                    <div class="cs-hp-bar-wrap" style="flex: 1; height: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;">
                        <div class="cs-hp-bar-fill" id="pc-hp-bar" style="height: 100%; background: var(--color-success, #4caf50); width: ${char.hpMax > 0 ? Math.round(char.hpCurrent / char.hpMax * 100) : 100}%"></div>
                    </div>
                    ${char.tempHp > 0 ? `
                    <div class="cs-hp-bar-wrap" style="flex: 0 0 20%; height: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;" title="Temp HP">
                        <div class="cs-hp-bar-fill" id="pc-temp-hp-bar" style="height: 100%; background: var(--color-info, #2196f3); width: 100%;"></div>
                    </div>` : ''}
                </div>
                <div class="cs-hp-row" style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="cs-hp-label" style="font-size:0.85rem; font-weight:600; margin-bottom:0; display:flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-heart" style="color:#e53935; font-size:0.95rem;"></i> HP
                        </div>
                        <div class="cs-hp-controls" style="margin-bottom:0;">
                            <button class="cs-hp-btn" id="pc-hp-minus" title="Damage">−</button>
                            <div class="cs-hp-display" style="display:flex; align-items:center;">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="pc-hp-current-input" value="${char.hpCurrent}" style="width:32px; background:transparent; border:none; color:var(--color-text-primary); text-align:right; font-family:var(--font-heading); font-size:1rem; font-weight:700; padding:0;">
                                <span class="cs-hp-divider" style="margin:0 2px;">/</span>
                                <span id="pc-hp-max" style="font-size:1rem; font-weight:700;">${char.hpMax}</span>
                            </div>
                            <button class="cs-hp-btn" id="pc-hp-plus" title="Heal">+</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="cs-hp-label" style="font-size:0.85rem; font-weight:600; margin-bottom:0; display:flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-shield" style="color:#2196f3; font-size:0.95rem;"></i> Temp
                        </div>
                        <div class="cs-hp-controls" style="margin-bottom:0;">
                            <button class="cs-hp-btn" id="pc-temp-hp-minus" title="Reduce Temp HP">−</button>
                            <div class="cs-hp-display" style="display:flex; align-items:center; justify-content:center;">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="pc-temp-hp-current" value="${char.tempHp || 0}" style="width:32px; background:transparent; border:none; color:var(--color-text-primary); text-align:center; font-family:var(--font-heading); font-size:1rem; font-weight:700; padding:0;">
                            </div>
                            <button class="cs-hp-btn" id="pc-temp-hp-plus" title="Add Temp HP">+</button>
                        </div>
                    </div>
                </div>
                ${hdHtml}
            </div>

            <div class="cs-core-stats" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:nowrap; gap:12px;">
                <div style="flex-shrink:0;">
                    <div class="cs-stat-pill" style="font-size:1.5rem; padding:8px 16px; border:2px solid var(--color-gold-base);"><i class="fa-solid fa-shield-halved"></i><span style="font-weight:bold;">AC ${char.ac}</span></div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; align-items:center; flex:1; min-width:0;">
                    ${Object.entries(char.speed).filter(([k,v]) => v > 0).map(([k,v]) => {
                        const icons = { walk:'fa-shoe-prints', climb:'fa-mountain', fly:'fa-feather-pointed', burrow:'fa-trowel' };
                        return '<div class="cs-stat-pill"><i class="fa-solid ' + (icons[k] || 'fa-shoe-prints') + '"></i><span>' + k.charAt(0).toUpperCase() + k.slice(1) + ' ' + v + ' ft</span></div>';
                    }).join('')}
                    <div class="cs-stat-pill"><i class="fa-solid fa-star"></i><span>Prof +${prof}</span></div>
                </div>
            </div>

            <!-- Reverted Ability Grid to full width -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn btn-xs pc-save-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure Save Mods & Toggles"><i class="fa-solid fa-cog"></i></button>
                    <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Stats and Saves</h4>
                </div>
            </div>
            <div class="cs-ability-grid" style="margin-bottom: ${char.saveToggles && char.saveToggles.length > 0 ? '12px' : '24px'};">
                ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => {
            const score = getTotalStat(char, ab) || 10;
            const mod = getMod(score);
            const modStr = mod >= 0 ? '+' + mod : mod;
            return `
                        <div class="cs-ability-cell" data-ab="${ab}" data-mod="${mod}">
                            <span class="cs-ability-label">${ab.toUpperCase()}</span>
                            <span class="cs-ability-score">${score}</span>
                            <span class="cs-ability-mod">${modStr}</span>
                            <div class="cs-ability-actions" style="margin-top:4px;">
                                <span class="cs-ability-action-btn pc-roll-check" data-ab="${ab}" data-mod="${mod}" title="Roll Check">Check</span>
                                <div style="display:flex; align-items:center; gap:2px; justify-content:center; background:rgba(0,0,0,0.2); border-radius:3px; padding-left:4px;">
                                    <span class="cs-ability-action-btn pc-roll-save" data-ab="${ab}" data-mod="${mod}" title="Roll Save" style="background:none; border-radius:3px; padding: 2px 8px;">Save</span>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>

            ${char.saveToggles && char.saveToggles.length > 0 ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px;">
                ${char.saveToggles.map((t, i) => `
                    <button class="btn btn-xxs btn-secondary pc-save-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                        <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                    </button>
                `).join('')}
            </div>` : ''}

            <div style="display:block;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn btn-xs pc-skill-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure Skill Mods & Toggles"><i class="fa-solid fa-cog"></i></button>
                        <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Skill Checks</h4>
                    </div>
                    <button class="btn btn-xs btn-primary pc-roll-init" title="Roll Initiative"><i class="fa-solid fa-dice-d20"></i> Initiative</button>
                </div>
                <div id="pc-skills-list" style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom: 24px;">
                    ${[
                { name: 'Acrobatics', ability: 'dex' },
                { name: 'Animal Handling', ability: 'wis' },
                { name: 'Arcana', ability: 'int' },
                { name: 'Athletics', ability: 'str' },
                { name: 'Deception', ability: 'cha' },
                { name: 'History', ability: 'int' },
                { name: 'Insight', ability: 'wis' },
                { name: 'Intimidation', ability: 'cha' },
                { name: 'Investigation', ability: 'int' },
                { name: 'Medicine', ability: 'wis' },
                { name: 'Nature', ability: 'int' },
                { name: 'Perception', ability: 'wis' },
                { name: 'Performance', ability: 'cha' },
                { name: 'Persuasion', ability: 'cha' },
                { name: 'Religion', ability: 'int' },
                { name: 'Sleight of Hand', ability: 'dex' },
                { name: 'Stealth', ability: 'dex' },
                { name: 'Survival', ability: 'wis' }
            ].map(skill => {
                const isProf = char.skills[skill.name];
                const isExp = char.expertise[skill.name];
                const baseMod = getMod(getTotalStat(char, skill.ability) || 10);
                const totalMod = baseMod + (isProf ? prof : 0) + (isExp ? prof : 0);
                let modStr = totalMod >= 0 ? '+' + totalMod : totalMod;
                const customMod = char.skillMods[skill.name] || "0";
                if (customMod !== "0") {
                    if (customMod.includes('d')) {
                        modStr += (customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod);
                    } else {
                        const m = parseInt(customMod) || 0;
                        const newMod = totalMod + m;
                        modStr = newMod >= 0 ? '+' + newMod : newMod;
                    }
                }

                let totalAtkData = totalMod;
                if (customMod !== "0") {
                    totalAtkData = customMod.includes('d') ? totalMod + (customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod) : totalMod + parseInt(customMod);
                }

                return `
                            <div class="skill-row glassmorphism" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:0.85rem;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${isExp ? '<i class="fa-solid fa-star" style="color:var(--color-gold-base); font-size:0.7rem;" title="Expertise"></i>' : (isProf ? '<i class="fa-solid fa-star-half-stroke" style="color:var(--color-gold-base); font-size:0.7rem;" title="Proficient"></i>' : '<i class="fa-regular fa-star" style="color:var(--color-text-muted); font-size:0.7rem;" title="No Proficiency"></i>')}
                                    <span class="pc-skill-roll" data-skill="${skill.name}" data-mod="${totalAtkData}" style="cursor:pointer; font-weight:500;" title="Roll ${skill.name}">
                                        ${skill.name} <span style="color:var(--color-text-muted); font-size:0.7rem;">(${skill.ability.toUpperCase()})</span>
                                    </span>
                                </div>
                                <div style="font-family:var(--font-code); color:var(--color-gold-light); font-weight:600;">${modStr}</div>
                            </div>
                        `;
            }).join('')}
                </div>

            ${char.skillToggles && char.skillToggles.length > 0 ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px;">
                ${char.skillToggles.map((t, i) => `
                    <button class="btn btn-xxs btn-secondary pc-skill-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                        <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                    </button>
                `).join('')}
            </div>` : ''}

            <div style="display:block; margin-top:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn btn-xs pc-tool-settings-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; padding:0;" title="Configure Tool Proficiencies & Mods"><i class="fa-solid fa-cog"></i></button>
                        <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Tool Checks</h4>
                    </div>
                </div>
                <div id="pc-tools-list" style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom: 24px;">
                    ${Object.entries(char.tools || {}).filter(([k,v]) => v.show).map(([toolName, tool]) => {
                        const isProf = tool.prof;
                        const isExp = tool.exp;
                        const baseMod = getMod(getTotalStat(char, tool.ability) || 10);
                        const totalMod = baseMod + (isProf ? prof : 0) + (isExp ? prof : 0);
                        let modStr = totalMod >= 0 ? '+' + totalMod : totalMod;
                        const customMod = tool.mod || "0";
                        if (customMod !== "0") {
                            if (customMod.includes('d')) {
                                modStr += (customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod);
                            } else {
                                const m = parseInt(customMod) || 0;
                                const newMod = totalMod + m;
                                modStr = newMod >= 0 ? '+' + newMod : newMod;
                            }
                        }

                        let totalAtkData = totalMod;
                        if (customMod !== "0") {
                            totalAtkData = customMod.includes('d') ? totalMod + (customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod) : totalMod + parseInt(customMod);
                        }

                        return `
                            <div class="skill-row glassmorphism" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:0.85rem;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${isExp ? '<i class="fa-solid fa-star" style="color:var(--color-gold-base); font-size:0.7rem;" title="Expertise"></i>' : (isProf ? '<i class="fa-solid fa-star-half-stroke" style="color:var(--color-gold-base); font-size:0.7rem;" title="Proficient"></i>' : '<i class="fa-regular fa-star" style="color:var(--color-text-muted); font-size:0.7rem;" title="No Proficiency"></i>')}
                                    <span class="pc-tool-roll" data-tool="${toolName}" data-mod="${totalAtkData}" style="cursor:pointer; font-weight:500;" title="Roll ${toolName}">
                                        ${toolName} <span style="color:var(--color-text-muted); font-size:0.7rem;">(${tool.ability.toUpperCase()})</span>
                                    </span>
                                </div>
                                <div style="font-family:var(--font-code); color:var(--color-gold-light); font-weight:600;">${modStr}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            </div>

                    </div>
                </div>

                <div style="margin-top:12px; margin-bottom:12px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid var(--color-border-subtle);">
                    <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Other Proficiencies</h4>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Languages</label>
                            <input type="text" id="pc-prof-languages" value="${char.proficiencies?.languages || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="languages" data-name="Languages" title="Ping Languages to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Weapons</label>
                            <input type="text" id="pc-prof-weapons" value="${char.proficiencies?.weapons || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="weapons" data-name="Weapon Proficiencies" title="Ping Weapons to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="width:80px; font-size:0.8rem; color:var(--color-text-muted);">Armor</label>
                            <input type="text" id="pc-prof-armor" value="${char.proficiencies?.armor || ''}" style="flex:1; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                            <button class="btn btn-secondary btn-xxs pc-prof-ping" data-type="armor" data-name="Armor Proficiencies" title="Ping Armor to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:center; align-items:center; margin-top:24px; margin-bottom:12px; gap: 16px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                    <div style="display:flex; gap:4px; align-items:center;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-right:4px; font-family:var(--font-heading);">SUCCESSES</span>
                        <input type="checkbox" class="pc-ds-success" data-idx="1" ${char.deathSaves.successes >= 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <input type="checkbox" class="pc-ds-success" data-idx="2" ${char.deathSaves.successes >= 2 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <input type="checkbox" class="pc-ds-success" data-idx="3" ${char.deathSaves.successes >= 3 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                    </div>
                    <button id="pc-roll-death-save" class="btn btn-danger" style="border-radius:50%; width:48px; height:48px; display:flex; justify-content:center; align-items:center; box-shadow:0 0 10px rgba(244, 67, 54, 0.5);" title="Roll Death Save">
                        <i class="fa-solid fa-skull" style="font-size:1.5rem;"></i>
                    </button>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="1" ${char.deathSaves.failures >= 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="2" ${char.deathSaves.failures >= 2 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="3" ${char.deathSaves.failures >= 3 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:4px; font-family:var(--font-heading);">FAILURES</span>
                    </div>
                </div>
        `;
        document.getElementById('ps-primary').innerHTML = primaryHtml;
        updateTokenPortrait(activeImageUrl);
        
        document.querySelectorAll('.pc-roll-hd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hd = e.currentTarget.dataset.hd;
                const rem = parseInt(e.currentTarget.dataset.rem);
                if (rem > 0) {
                    char.hitDiceSpent[hd] = (char.hitDiceSpent[hd] || 0) + 1;
                    const conMod = getMod(getTotalStat(char, 'con'));
                    const conStr = conMod >= 0 ? '+' + conMod : '' + conMod;
                    const formula = '1' + hd + conStr;
                    vtt.socket.emit('chat:msg', {
                        text: `[${char.name || 'Player'}: Hit Dice] rolls **${formula}**`,
                        roll: simulateRoll(formula)
                    });
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });
        document.querySelectorAll('.pc-reset-hd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hd = e.currentTarget.dataset.hd;
                if (char.hitDiceSpent[hd] && char.hitDiceSpent[hd] > 0) {
                    char.hitDiceSpent[hd]--;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        const buildHtml = `
            <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Classes</h4>
                <div id="pc-classes-container" style="display:flex; flex-direction:column; gap:8px;">
                    ${char.classes.map((cls, i) => `
                        <div class="glassmorphism" style="padding:8px; display:flex; gap:8px; align-items:flex-end;">
                            <div class="form-group" style="flex:2;">
                                <label>Class</label>
                                <select class="pc-class-sel" data-idx="${i}" data-val="${cls.name}" style="width:100%;">
                                    <option value="${cls.name}">${cls.name || 'Select Class'}</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:2;">
                                <label>Subclass</label>
                                <select class="pc-subclass-sel" data-idx="${i}" data-val="${cls.subclass}" style="width:100%;">
                                    <option value="${cls.subclass}">${cls.subclass || 'None'}</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label>Level</label>
                                <input type="number" class="pc-class-level" data-idx="${i}" value="${cls.level}" min="1" max="20" style="width:100%;">
                            </div>
                            <button class="btn btn-danger btn-sm pc-class-del" data-idx="${i}" ${char.classes.length === 1 ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
                <button id="pc-add-class" class="btn btn-secondary btn-xs" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Class</button>
            </div>
            
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label>Species / Race</label>
                    <select id="pc-race" data-val="${char.race}" style="width:100%;">
                        <option value="${char.race}">${char.race || 'Select Species'}</option>
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Background</label>
                    <select id="pc-background" data-val="${char.background}" style="width:100%;">
                        <option value="${char.background}">${char.background || 'Select Background'}</option>
                    </select>
                </div>
            </div>
            
            <div style="display:flex; gap:12px; margin-bottom:16px;">
                <div class="form-group" style="flex:1;">
                    <label>Max HP</label>
                    <input type="number" id="pc-hpMax" value="${char.hpMax}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Armor Class</label>
                    <input type="number" id="pc-ac" value="${char.ac}" style="width:100%;">
                </div>
            </div>

            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Movement Speeds (ft)</h4>
            <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Walk</label>
                    <input type="number" id="pc-speed-walk" value="${char.speed.walk}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Climb</label>
                    <input type="number" id="pc-speed-climb" value="${char.speed.climb}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Fly</label>
                    <input type="number" id="pc-speed-fly" value="${char.speed.fly}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Burrow</label>
                    <input type="number" id="pc-speed-burrow" value="${char.speed.burrow}" style="width:100%;">
                </div>
            </div>
            
            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Vision (ft)</h4>
            <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Darkvision</label>
                    <input type="number" id="pc-sense-darkvision" value="${char.senses.darkvision}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Devil's Sight</label>
                    <input type="number" id="pc-sense-devilsight" value="${char.senses.devilSight}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Blindsight</label>
                    <input type="number" id="pc-sense-blindsight" value="${char.senses.blindsight}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Truesight</label>
                    <input type="number" id="pc-sense-truesight" value="${char.senses.truesight}" style="width:100%;">
                </div>
            </div>
            
            <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-family:var(--font-heading);">Character Info</h4>
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label>Age</label>
                    <input type="text" id="pc-bio-age" value="${char.bio.age}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Height (ft)</label>
                    <input type="text" id="pc-bio-height" value="${char.bio.height}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Weight (lbs)</label>
                    <input type="text" id="pc-bio-weight" value="${char.bio.weight}">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>Backstory</label>
                <textarea id="pc-bio-backstory" style="height:120px; resize:vertical;">${char.bio.backstory}</textarea>
            </div>
            <div class="form-group">
                <label>Other Notes</label>
                <textarea id="pc-bio-notes" style="height:120px; resize:vertical;">${char.bio.notes}</textarea>
            </div>
            <button id="pc-save-build" class="btn btn-primary btn-block mb-4 mt-2">Save Build & Info</button>
        `;
        document.getElementById('ps-build').innerHTML = buildHtml;
        
        function loadSubclassesForClass(className, selectEl) {
            if (!className) {
                selectEl.innerHTML = '<option value="">None</option>';
                return;
            }
            const key = className.toLowerCase();
            const file = builderCache.classIndex[key];
            if (!file) return;
            
            const currentSubclass = selectEl.dataset.val;
            fetch(`data/class/${file}`).then(r => r.json()).then(data => {
                if (data && data.subclass) {
                    let opts = '<option value="">None</option>';
                    const seen = new Set();
                    data.subclass.forEach(sc => {
                        if (!seen.has(sc.name)) {
                            seen.add(sc.name);
                            opts += `<option value="${sc.name}" ${sc.name === currentSubclass ? 'selected' : ''}>${sc.name}</option>`;
                        }
                    });
                    selectEl.innerHTML = opts;
                }
            }).catch(() => {});
        }
        
        function populateBuildDropdowns() {
            if (!builderCache) return;
            
            const raceSel = document.getElementById('pc-race');
            if (raceSel) {
                const currentRace = raceSel.dataset.val;
                let opts = '<option value="">Select Species</option>';
                builderCache.races.forEach(r => {
                    opts += `<option value="${r.name}" ${r.name === currentRace ? 'selected' : ''}>${r.name}</option>`;
                });
                raceSel.innerHTML = opts;
            }
            
            const bgSel = document.getElementById('pc-background');
            if (bgSel) {
                const currentBg = bgSel.dataset.val;
                let opts = '<option value="">Select Background</option>';
                builderCache.bgs.forEach(b => {
                    opts += `<option value="${b.name}" ${b.name === currentBg ? 'selected' : ''}>${b.name}</option>`;
                });
                bgSel.innerHTML = opts;
            }
            
            const currentClassNames = char.classes.map(c => c.name);
            document.querySelectorAll('.pc-class-sel').forEach(sel => {
                const currentCls = sel.dataset.val;
                let opts = '<option value="">Select Class</option>';
                Object.keys(builderCache.classIndex).forEach(cKey => {
                    const name = cKey.charAt(0).toUpperCase() + cKey.slice(1);
                    const disabled = currentClassNames.includes(name) && name !== currentCls ? 'disabled' : '';
                    opts += `<option value="${name}" ${name === currentCls ? 'selected' : ''} ${disabled}>${name}</option>`;
                });
                sel.innerHTML = opts;
            });
            
            document.querySelectorAll('.pc-subclass-sel').forEach(sel => {
                const idx = sel.dataset.idx;
                const clsInput = document.querySelector(`.pc-class-sel[data-idx="${idx}"]`);
                const clsVal = clsInput ? clsInput.value : '';
                if (clsVal) {
                    loadSubclassesForClass(clsVal, sel);
                }
            });
        }
        
        if (!builderCache) {
            Promise.all([
                fetch('data/races.json').then(res => res.json()).catch(() => ({})),
                fetch('data/backgrounds.json').then(res => res.json()).catch(() => ({})),
                fetch('data/class/index.json').then(res => res.json()).catch(() => ({}))
            ]).then(([raceData, bgData, classIndex]) => {
                builderCache = { races: raceData.race || [], bgs: bgData.background || [], classIndex };
                populateBuildDropdowns();
            });
        } else {
            populateBuildDropdowns();
        }

        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        const coinCount = (parseInt(char.currency.cp) || 0) + (parseInt(char.currency.sp) || 0) + (parseInt(char.currency.ep) || 0) + (parseInt(char.currency.gp) || 0) + (parseInt(char.currency.pp) || 0);
        const coinWeight = coinCount * 0.02;

        const totalWeight = char.equipment.reduce((acc, eq) => acc + ((parseFloat(eq.weight) || 0) * (parseInt(eq.qty) || 1)), 0) + coinWeight;
        const strScore = getTotalStat(char, 'str') || 10;
        const encRule = document.getElementById('config-encumbrance-rule')?.value || 'standard';

        let encumbranceStatus = `<span style="color:var(--color-success);">Normal</span>`;
        if (encRule === 'variant') {
            const encumberedThreshold = strScore * 5;
            const heavyThreshold = strScore * 10;
            const maxThreshold = strScore * 15;
            if (totalWeight > maxThreshold) {
                encumbranceStatus = `<span style="color:var(--color-danger); font-weight:bold;">Over-encumbered (0 speed)</span>`;
            } else if (totalWeight > heavyThreshold) {
                encumbranceStatus = `<span style="color:var(--color-danger);">Heavily Encumbered (-20 speed, Disadv. on checks)</span>`;
            } else if (totalWeight > encumberedThreshold) {
                encumbranceStatus = `<span style="color:var(--color-warning);">Encumbered (-10 speed)</span>`;
            }
        } else {
            const maxThreshold = strScore * 15;
            if (totalWeight > maxThreshold) {
                encumbranceStatus = `<span style="color:var(--color-danger); font-weight:bold;">Over-encumbered (0 speed)</span>`;
            }
        }

        let equipmentHtml = `
            <div style="display:flex; justify-content:center; gap:16px; margin-bottom:16px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid var(--color-border-subtle);">
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <label style="font-size:0.8rem; color:#b87333; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> CP</label>
                    <input type="number" class="form-control pc-currency-input" data-coin="cp" value="${char.currency.cp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <label style="font-size:0.8rem; color:#c0c0c0; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> SP</label>
                    <input type="number" class="form-control pc-currency-input" data-coin="sp" value="${char.currency.sp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <label style="font-size:0.8rem; color:#50c878; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> EP</label>
                    <input type="number" class="form-control pc-currency-input" data-coin="ep" value="${char.currency.ep || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <label style="font-size:0.8rem; color:var(--color-gold-base); font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> GP</label>
                    <input type="number" class="form-control pc-currency-input" data-coin="gp" value="${char.currency.gp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <label style="font-size:0.8rem; color:#e5e4e2; font-weight:bold; font-family:var(--font-heading);"><i class="fa-solid fa-coins"></i> PP</label>
                    <input type="number" class="form-control pc-currency-input" data-coin="pp" value="${char.currency.pp || 0}" min="0" style="width:60px; text-align:center; padding:4px;">
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-backpack"></i> Inventory</h4>
                <div style="display:flex; gap:8px;">
                    <button id="btn-add-equip-db" class="btn btn-secondary btn-xs"><i class="fa-solid fa-book-open"></i> Add Items</button>
                    <button id="btn-add-equip-custom" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Custom Item</button>
                </div>
            </div>
            <div id="pc-equip-list" style="display:flex; flex-direction:column; gap:8px;">
                ${char.equipment.map((eq, i) => `
                    <div class="equip-row glassmorphism" style="padding:8px; display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="pc-equip-toggle" data-idx="${i}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); flex:1; min-width:0; display:flex; align-items:center; gap:6px; padding-right:8px;" title="Click to expand/collapse description">
                                <i class="fa-solid fa-chevron-right text-gradient-gold" style="font-size:0.8rem; flex-shrink:0; transition:transform 0.2s;" id="pc-equip-chevron-${i}"></i>
                                <span style="word-break:break-word; overflow-wrap:anywhere;">${eq.name}</span>
                            </div>
                            <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
                                <span style="font-size:0.8rem; color:var(--color-text-muted);">Wt: ${eq.weight || 0} lb</span>
                                <div style="display:flex; align-items:center; gap:4px; margin: 0 4px;">
                                    <button class="btn btn-xxs btn-secondary pc-equip-qty-minus" data-idx="${i}">-</button>
                                    <span style="font-size:0.8rem; width:16px; text-align:center;">${eq.qty}</span>
                                    <button class="btn btn-xxs btn-secondary pc-equip-qty-plus" data-idx="${i}">+</button>
                                </div>
                                <button class="btn btn-xxs btn-secondary pc-equip-ping" data-idx="${i}" title="Ping Item to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                                <button class="btn btn-xxs btn-secondary pc-equip-edit" data-idx="${i}" title="Edit Item"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-xxs btn-danger pc-equip-del" data-idx="${i}" title="Delete Item"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="pc-equip-desc vtt-hidden" id="pc-equip-desc-${i}" style="padding: 8px 4px 0 16px; font-size: 0.85rem; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-subtle); margin-top: 4px; white-space: pre-wrap; line-height: 1.4;">
                            ${(function () {
                if (!eq.description) return '<i style="opacity:0.5;">No description available.</i>';
                let html = eq.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
                html = html.replace(/---/g, '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;">');
                return html;
            })()}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:16px; padding:8px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-size:0.9rem; font-family:var(--font-heading); color:var(--color-gold-light);">Total Wt:</span>
                    <span style="font-weight:bold; font-size:1.1rem; margin-left:4px;" title="Includes ${coinWeight.toFixed(2)} lb from coins">${totalWeight.toFixed(1)} lb</span>
                </div>
                <div style="font-size:0.8rem;">
                    Status: ${encumbranceStatus}
                </div>
            </div>
        `;
        document.getElementById('ps-equipment').innerHTML = equipmentHtml;

        const spellLevels = [
            { key: 'all', label: 'All Spells' },
            { key: 'cantrip', label: 'Cantrip' },
            { key: 'level1', label: '1st' },
            { key: 'level2', label: '2nd' },
            { key: 'level3', label: '3rd' },
            { key: 'level4', label: '4th' },
            { key: 'level5', label: '5th' },
            { key: 'level6', label: '6th' },
            { key: 'level7', label: '7th' },
            { key: 'level8', label: '8th' },
            { key: 'level9', label: '9th' },
            { key: 'legacy', label: 'Legacy' }
        ];
        char.spellSettings = char.spellSettings || { ability: char.spellAbility || 'INT', atkMod: 0, dcMod: 0, dmgMod: 0, toggles: [] };
        char.attackSettings = char.attackSettings || { atkMod: 0, dmgMod: 0, dcMod: 0, toggles: [] };

        const spellProf = getProfBonus(char.level);
        const spellMod = getMod(getTotalStat(char, (char.spellSettings.ability || 'INT').toLowerCase()) || 10);

        let baseDcMod = char.spellSettings.dcMod || 0;
        let baseAtkMod = char.spellSettings.atkMod || 0;
        let atkDice = '';

        if (char.spellSettings.toggles) {
            char.spellSettings.toggles.filter(t => t.enabled).forEach(t => {
                if (t.target === 'dc' || t.target === 'both') {
                    baseDcMod += parseInt(t.formula) || 0;
                }
                if (t.target === 'atk' || t.target === 'both') {
                    if (t.formula.includes('d')) {
                        atkDice += (t.formula.startsWith('+') || t.formula.startsWith('-') ? t.formula : '+' + t.formula);
                    } else {
                        baseAtkMod += parseInt(t.formula) || 0;
                    }
                }
            });
        }

        const finalDC = 8 + spellProf + spellMod + baseDcMod;
        const totalAtkMod = spellProf + spellMod + baseAtkMod;
        const finalAtkLabel = (totalAtkMod >= 0 ? '+' : '') + totalAtkMod;
        const finalAtkData = finalAtkLabel + atkDice;

        const renderSpellRowHtml = window.vttPlayerSheetAPI.renderSpellRowHtml;

        let spellsHtml = `
            <style>
                .no-spin-button::-webkit-inner-spin-button,
                .no-spin-button::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .no-spin-button {
                    -moz-appearance: textfield;
                }
            </style>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-book-open"></i> Spellbook</h4>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; gap:8px; line-height: 1.2;">
                        <button class="btn btn-xxs btn-secondary pc-spell-dc-btn" data-dc="${finalDC}" data-ability="${char.spellSettings.ability || 'INT'}" title="Ping Spell DC">🛡️ DC ${finalDC}</button>
                        <button class="btn btn-xxs btn-primary pc-spell-atk-btn" data-atk="${finalAtkData}" title="Roll Spell Attack">⚔️ Atk ${finalAtkLabel}</button>
                    </div>
                    <button class="btn btn-xxs btn-secondary pc-spell-settings-btn" title="Spell Settings"><i class="fa-solid fa-cog"></i></button>
                </div>
            </div>
            ${char.spellSettings.toggles && char.spellSettings.toggles.length > 0 ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                ${char.spellSettings.toggles.map((t, i) => `
                    <button class="btn btn-xxs btn-secondary pc-spell-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                        <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                    </button>
                `).join('')}
            </div>` : ''}
            <div style="display:flex; flex-direction:row; gap:16px; margin-bottom:12px; align-items:flex-start;">
                <!-- Left Sidebar for Tabs -->
                <div style="display:flex; flex-direction:column; gap:4px; min-width: 100px; border-right:1px solid var(--color-border-subtle); padding-right:12px;">
                    ${spellLevels.map((sl, i) => {
                        let slotHtml = '';
                        if (sl.key !== 'cantrip' && sl.key !== 'legacy' && sl.key !== 'all') {
                            const cur = char.spellSlots[sl.key]?.current || 0;
                            const max = char.spellSlots[sl.key]?.max || 0;
                            slotHtml = `
                                <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-top:2px; margin-bottom:4px; font-size:0.7rem; color:var(--color-text-muted);">
                                    <button class="btn btn-xxs btn-secondary pc-slot-btn-minus" data-level="${sl.key}" style="padding:0 4px; font-size:0.7rem; line-height:1;">-</button>
                                    <input type="number" min="0" class="pc-slot-current no-spin-button" data-level="${sl.key}" value="${cur}" style="width:20px; padding:0; font-size:0.7rem; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:var(--color-text-primary); text-align:center; border-radius:2px;">
                                    <button class="btn btn-xxs btn-secondary pc-slot-btn-plus" data-level="${sl.key}" style="padding:0 4px; font-size:0.7rem; line-height:1;">+</button>
                                    <span style="margin: 0 2px;">/</span>
                                    <input type="number" min="0" class="pc-slot-max no-spin-button" data-level="${sl.key}" value="${max}" style="width:20px; padding:0; font-size:0.7rem; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); color:var(--color-text-primary); text-align:center; border-radius:2px;">
                                </div>
                            `;
                        }
                        return `
                            <div style="display:flex; flex-direction:column; align-items:stretch;">
                                <button class="btn btn-xs pc-spell-tab-btn ${sl.key === activeSpellTab ? 'btn-primary' : 'btn-secondary'}" data-level="${sl.key}" style="text-align:left;">${sl.label}</button>
                                ${slotHtml}
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Right Area for Pages -->
                <div id="pc-spell-pages" style="flex:1; min-width:0;">
                    ${spellLevels.map((sl, i) => {
                        if (sl.key === 'all') {
                            return `
                                <div class="pc-spell-page ${sl.key === activeSpellTab ? '' : 'vtt-hidden'}" id="spell-page-${sl.key}">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px;">
                                        <span style="font-size:0.9rem; font-weight:600;">All Prepared Spells</span>
                                    </div>
                                    <div style="margin-bottom:12px;">
                                        <input type="text" id="all-spells-search" placeholder="Search spells..." style="width:100%; padding:6px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    </div>
                                    <div id="all-spells-list" style="display:flex; flex-direction:column; gap:16px;">
                                        ${spellLevels.filter(lvl => lvl.key !== 'all').map(lvl => {
                                            const allLvlSpells = char.spells[lvl.key] || [];
                                            const lvlSpellsRendered = allLvlSpells
                                                .map((sp, idx) => ({ sp, idx }))
                                                .filter(({ sp }) => sp.prepared !== false || lvl.key === 'cantrip' || lvl.key === 'legacy')
                                                .map(({ sp, idx }) => renderSpellRowHtml(sp, lvl.key, idx, true));
                                                
                                            if (lvlSpellsRendered.length === 0) return '';
                                            return `
                                                <div class="all-spells-group">
                                                    <h5 style="margin:0 0 8px 0; color:var(--color-gold-base); font-size:0.85rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${lvl.label}</h5>
                                                    <div style="display:flex; flex-direction:column; gap:8px;">
                                                        ${lvlSpellsRendered.join('')}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                        ${Object.values(char.spells).every(arr => !arr || arr.length === 0) ? '<div style="font-size:0.8rem; color:var(--color-text-muted);">No spells added.</div>' : ''}
                                    </div>
                                </div>
                            `;
                        } else {
                            const spList = char.spells[sl.key] || [];
                            return `
                                <div class="pc-spell-page ${sl.key === activeSpellTab ? '' : 'vtt-hidden'}" id="spell-page-${sl.key}">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
                                        <div style="display:flex; align-items:center; gap:12px;">
                                            <span style="font-size:0.9rem; font-weight:600;">${sl.label} Spells</span>
                                        </div>
                                        <button class="btn btn-secondary btn-xxs btn-add-spell" data-level="${sl.key}"><i class="fa-solid fa-plus"></i> Add Spell</button>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:8px;">
                                        ${spList.map((sp, idx) => renderSpellRowHtml(sp, sl.key, idx, false)).join('')}
                                        ${spList.length === 0 ? '<div style="font-size:0.8rem; color:var(--color-text-muted);">No spells added.</div>' : ''}
                                    </div>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>


        `;
        document.getElementById('ps-spells').innerHTML = spellsHtml;

        let infoHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);">Attacks & Macros</h4>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn btn-xxs btn-secondary pc-attack-settings-btn" title="Attack Settings"><i class="fa-solid fa-cog"></i></button>
                    </div>
                </div>
                ${char.attackSettings.toggles && char.attackSettings.toggles.length > 0 ? `
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                    ${char.attackSettings.toggles.map((t, i) => `
                        <button class="btn btn-xxs btn-secondary pc-attack-quick-toggle" data-idx="${i}" style="border-radius:12px; padding:2px 8px; font-size:0.75rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle);">
                            <i class="fa-solid fa-circle" style="color:${t.enabled ? '#4caf50' : '#f44336'}; font-size:0.5rem; margin-right:4px;"></i> ${t.name}
                        </button>
                    `).join('')}
                </div>` : ''}
                
                <div id="pc-macros-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                    ${char.macros.map((m, i) => `
                        <div class="macro-row glassmorphism" style="padding:8px; display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <button class="btn pc-macro-roll-all" data-idx="${i}" title="Roll all: ${m.name}" style="font-weight:600; color:var(--color-text-primary); background:transparent; border:none; padding:0; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:0.875rem; font-family:inherit; transition:color 0.15s ease;" onmouseover="this.style.color='var(--color-gold-light)'" onmouseout="this.style.color='var(--color-text-primary)'"><i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${m.name}</button>
                                <div>
                                    <button class="btn btn-xxs btn-secondary pc-macro-edit" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-xxs btn-danger pc-macro-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            ${(m.range || m.target) ? `
                            <div style="display:flex; gap:10px; font-size:0.7rem; color:var(--color-text-muted); margin-top:-2px; margin-bottom:2px; padding:0 2px;">
                                ${m.range ? `<span><i class="fa-solid fa-location-crosshairs" style="color:var(--color-gold-base); font-size:0.65rem; margin-right:4px;"></i>${m.range}</span>` : ''}
                                ${m.target ? `<span><i class="fa-solid fa-bullseye" style="color:var(--color-gold-base); font-size:0.65rem; margin-right:4px;"></i>${m.target}</span>` : ''}
                            </div>` : ''}
                            ${m.description ? `
                            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); border-radius:4px; padding:4px 6px;">
                                <span style="font-size:0.72rem; color:var(--color-text-muted); font-style:italic; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.description}</span>
                                <button class="btn btn-xxs btn-secondary pc-macro-desc-ping" data-idx="${i}" title="Ping description to chat" style="flex-shrink:0;"><i class="fa-solid fa-comment-dots"></i></button>
                            </div>` : ''}
                            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                ${((m.attackStat && m.attackStat !== 'none') || m.attackBonus) ? `<button class="btn btn-xxs btn-primary pc-macro-attack" data-idx="${i}">⚔️ Attack (${calculatedAtkBonus(m)})</button>` : ''}
                                ${m.saveAbility ? `<button class="btn btn-xxs btn-secondary pc-macro-save" data-idx="${i}">🛡️ DC ${calculatedSaveDc(m)} ${m.saveAbility}</button>` : ''}
                                ${m.damage && m.damage.length ? `<button class="btn btn-xxs btn-danger pc-macro-damage" data-idx="${i}">💥 Damage</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button id="btn-add-macro" class="btn btn-secondary btn-xs btn-block"><i class="fa-solid fa-plus"></i> Add Attack / Macro</button>

                <div id="pc-macro-modal" class="vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); padding:16px; border-radius:8px; z-index:1000; width:400px; max-height:80vh; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
                    <h3 style="margin-top:0; color:var(--color-gold-base);">Edit Macro</h3>
                    <input type="hidden" id="modal-macro-idx" value="-1">
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Name</label>
                        <input type="text" id="modal-macro-name" style="width:100%;">
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Description <span style="font-size:0.7rem; color:var(--color-text-muted); font-weight:400;">(Optional — shown at top of ping card)</span></label>
                        <textarea id="modal-macro-desc" placeholder="Flavor text, weapon range, special notes..." style="width:100%; min-height:56px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:6px 8px; font-family:var(--font-primary); font-size:0.8rem; border-radius:4px; line-height:1.4;"></textarea>
                    </div>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:1;">
                            <label>Range</label>
                            <input type="text" id="modal-macro-range" placeholder="e.g. 60 ft, 5 ft, Self" style="width:100%; padding:4px; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Target</label>
                            <input type="text" id="modal-macro-target" placeholder="e.g. 1 creature" style="width:100%; padding:4px; font-size:0.8rem;">
                        </div>
                    </div>
                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:10px; margin-bottom:12px;">
                        <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-size:0.85rem; font-family:var(--font-heading);">Attack Configuration</h4>
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                            <div class="form-group" style="flex:1.5;">
                                <label style="font-size:0.7rem;">Attack Stat</label>
                                <select id="modal-macro-atk-stat" style="width:100%; padding:4px; font-size:0.8rem;">
                                    <option value="none">None (No Attack)</option>
                                    <option value="str">STR</option>
                                    <option value="dex">DEX</option>
                                    <option value="con">CON</option>
                                    <option value="int">INT</option>
                                    <option value="wis">WIS</option>
                                    <option value="cha">CHA</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1; display:flex; flex-direction:column; align-items:center;">
                                <label style="font-size:0.7rem; margin-bottom:4px;">Add Prof</label>
                                <input type="checkbox" id="modal-macro-atk-prof" style="cursor:pointer; width:16px; height:16px;">
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label style="font-size:0.7rem;">Extra Mod</label>
                                <input type="number" id="modal-macro-atk-extra" value="0" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label style="font-size:0.7rem;">Crit Range</label>
                                <input type="number" id="modal-macro-crit-range" value="20" min="2" max="20" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                            </div>
                        </div>
                        <div class="form-group" id="modal-macro-atk-custom-container" style="margin-bottom:8px;">
                            <label style="font-size:0.7rem;">Custom Attack Formula / Bonus</label>
                            <input type="text" id="modal-macro-atk" placeholder="e.g. +5 or 1d20+5" style="width:100%; padding:4px; font-size:0.8rem;">
                        </div>
                    </div>

                    <div style="border-top:1px solid var(--color-border-subtle); padding-top:10px; margin-bottom:12px;">
                        <h4 style="margin:0 0 8px 0; color:var(--color-gold-base); font-size:0.85rem; font-family:var(--font-heading);">Save DC Configuration</h4>
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <div class="form-group" style="flex:1.5;">
                                <label style="font-size:0.7rem;">Target Save Stat</label>
                                <select id="modal-macro-save-ab" style="width:100%; padding:4px; font-size:0.8rem;">
                                    <option value="">None (No Save)</option>
                                    <option value="STR">STR</option>
                                    <option value="DEX">DEX</option>
                                    <option value="CON">CON</option>
                                    <option value="INT">INT</option>
                                    <option value="WIS">WIS</option>
                                    <option value="CHA">CHA</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1.5;">
                                <label style="font-size:0.7rem;">DC Ability Stat</label>
                                <select id="modal-macro-save-dc-stat" style="width:100%; padding:4px; font-size:0.8rem;">
                                    <option value="none">Default (Sheet Stat)</option>
                                    <option value="str">STR</option>
                                    <option value="dex">DEX</option>
                                    <option value="con">CON</option>
                                    <option value="int">INT</option>
                                    <option value="wis">WIS</option>
                                    <option value="cha">CHA</option>
                                    <option value="custom">Custom DC</option>
                                </select>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
                            <div class="form-group" style="flex:1;" id="modal-macro-save-dc-extra-container">
                                <label style="font-size:0.7rem;">Extra DC Mod</label>
                                <input type="number" id="modal-macro-save-dc-extra" value="0" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                            </div>
                            <div class="form-group" style="flex:1;" id="modal-macro-save-dc-custom-container">
                                <label style="font-size:0.7rem;">Custom DC Value</label>
                                <input type="number" id="modal-macro-save-dc" placeholder="15" style="width:100%; text-align:center; padding:4px; font-size:0.8rem;">
                            </div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:12px;">
                        <label style="display:flex; justify-content:space-between; align-items:center;">
                            Damage Rolls 
                            <button class="btn btn-xxs btn-secondary" id="modal-macro-add-dmg"><i class="fa-solid fa-plus"></i> Add Damage</button>
                        </label>
                        <div id="modal-macro-dmg-list" style="display:flex; flex-direction:column; gap:4px; margin-top:8px;"></div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                        <button class="btn btn-secondary btn-sm" id="modal-macro-cancel">Cancel</button>
                        <button class="btn btn-primary btn-sm" id="modal-macro-save">Save Macro</button>
                    </div>
                </div>
                <div id="pc-macro-overlay" class="vtt-hidden" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:999;"></div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-address-card"></i> Ability Cards</h4>
                <button id="btn-add-ability" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Card</button>
            </div>
            <div id="pc-ability-list" style="display:flex; flex-direction:column; gap:8px;">
                ${char.abilityCards.map((card, i) => `
                    <div class="ability-row glassmorphism" style="padding:8px; display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-chevron-right pc-ability-expand" data-idx="${i}" style="transition:transform 0.2s; cursor:pointer; font-size:0.7rem; color:var(--color-text-muted);"></i>
                                <div class="pc-ability-ping" data-idx="${i}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary);"><i class="fa-solid fa-bolt text-gradient-gold"></i> ${card.name}</div>
                            </div>
                            <div style="display:flex; gap:12px; align-items:center;">
                                ${card.hasCounter ? `
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button class="btn btn-xxs btn-secondary pc-ability-uses-minus" data-idx="${i}">-</button>
                                    <span style="font-size:0.8rem; font-family:monospace; min-width:24px; text-align:center;">${card.usesCurrent || 0} / ${card.usesMax || 0}</span>
                                    <button class="btn btn-xxs btn-secondary pc-ability-uses-plus" data-idx="${i}">+</button>
                                </div>
                                ` : ''}
                                <button class="btn btn-xxs btn-secondary pc-ability-edit" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                            </div>
                        </div>
                        <div class="pc-ability-details" id="pc-ability-details-${i}" style="display:none; font-size:0.8rem; margin-top:4px; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px; color:var(--color-text-muted);">
                            ${card.description ? card.description.replace(/\\n/g, '<br>') : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

        `;
        document.getElementById('ps-info').innerHTML = infoHtml;

        wireSheetEvents(char);
    }


    function wireSheetEvents(char) {
        const nameInput = document.getElementById('pc-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                char.name = nameInput.value.trim();
                saveAndEmit(char);
            });
        }

        const assignBtn = document.getElementById('pc-assign-players-btn');
        if (assignBtn) {
            assignBtn.addEventListener('click', () => {
                openAssignPlayersModal(char);
            });
        }

                document.getElementById('pc-hp-current-input')?.addEventListener('change', (e) => {
            char.hpCurrent = parseInt(e.target.value) || 0;
            saveAndEmit(char);
            debouncedRenderSheetData(char);
        });
        document.getElementById('pc-temp-hp-current')?.addEventListener('change', (e) => {
            char.tempHp = parseInt(e.target.value) || 0;
            saveAndEmit(char);
        });

        const inspirationToggle = document.getElementById('pc-inspiration-toggle');
        if (inspirationToggle) {
            inspirationToggle.addEventListener('click', () => {
                char.inspiration = !char.inspiration;
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        const heroInput = document.getElementById('pc-hero-points-input');
        if (heroInput) {
            heroInput.addEventListener('change', (e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                char.heroPoints = val;
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        ['languages', 'weapons', 'armor'].forEach(type => {
            document.getElementById(`pc-prof-${type}`)?.addEventListener('change', (e) => {
                char.proficiencies = char.proficiencies || { languages: '', weapons: '', armor: '' };
                char.proficiencies[type] = e.target.value;
                saveAndEmit(char);
            });
        });

        document.querySelectorAll('.pc-prof-ping').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                const name = e.currentTarget.dataset.name;
                const val = char.proficiencies[type] || 'None';
                vtt.socket.emit('chat:msg', {
                    text: `[${char.name || 'Player'}: ${name}]\n**Proficiencies:** ${val}`
                });
            });
        });

        document.querySelector('.pc-roll-init')?.addEventListener('click', () => {
            const dexMod = getMod(getTotalStat(char, 'dex'));
            let toggleFormulaStr = '';
            if (char.skillToggles) {
                char.skillToggles.filter(t => t.enabled).forEach(t => {
                    if (t.target === 'all' || t.target === 'initiative') {
                        toggleFormulaStr += (t.formula.startsWith('+') || t.formula.startsWith('-')) ? t.formula : '+' + t.formula;
                    }
                });
            }
            const globalMod = char.globalAbilityMod || "0";
            let modStr = dexMod >= 0 ? '+' + dexMod : dexMod;
            if (globalMod !== "0") {
                if (globalMod.includes('d')) {
                    modStr += (globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod);
                } else {
                    const m = parseInt(globalMod) || 0;
                    const newMod = dexMod + m;
                    modStr = newMod >= 0 ? '+' + newMod : newMod;
                }
            }
            const formula = `1d20${modStr}${toggleFormulaStr}`;

            const rollData = simulateRoll(formula);
            vtt.socket.emit('chat:msg', {
                text: `[${char.name}] rolls **Initiative**`,
                roll: rollData
            });

            // Automatically add selected token to Initiative tracker if it matches this character
            if (window.VTT && window.VTT.canvasEngine && window.VTT.chatEngine) {
                const selectedIds = window.VTT.canvasEngine.getSelectedTokenIds();
                const tokens = window.VTT.canvasEngine.getTokens();
                selectedIds.forEach(tokenId => {
                    const t = tokens[tokenId];
                    if (t && t.isPlayer && t.characterId === char.id) {
                        window.VTT.chatEngine.addToInitiative(t.name, rollData.total, t.id);
                    }
                });
            }
        });

        document.getElementById('pc-roll-death-save')?.addEventListener('click', () => {
            vtt.socket.emit('chat:msg', {
                text: `[${char.name}] rolls **Death Save**`,
                roll: simulateRoll('1d20')
            });
        });

        document.querySelectorAll('.pc-ds-success').forEach(cb => {
            cb.addEventListener('change', (e) => {
                char.deathSaves = char.deathSaves || { successes: 0, failures: 0 };
                const idx = parseInt(e.currentTarget.dataset.idx);
                const isChecked = e.currentTarget.checked;
                // Treat checkboxes as an exact value: the highest checked index
                if (isChecked) {
                    char.deathSaves.successes = Math.max(char.deathSaves.successes, idx);
                } else {
                    char.deathSaves.successes = idx - 1;
                }
                saveAndEmit(char);
                renderSheetData(char);
            });
        });

        document.querySelectorAll('.pc-ds-failure').forEach(cb => {
            cb.addEventListener('change', (e) => {
                char.deathSaves = char.deathSaves || { successes: 0, failures: 0 };
                const idx = parseInt(e.currentTarget.dataset.idx);
                const isChecked = e.currentTarget.checked;
                if (isChecked) {
                    char.deathSaves.failures = Math.max(char.deathSaves.failures, idx);
                } else {
                    char.deathSaves.failures = idx - 1;
                }
                saveAndEmit(char);
                renderSheetData(char);
            });
        });

        document.querySelectorAll('.pc-roll-check').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ab = e.currentTarget.dataset.ab;
                const mod = parseInt(e.currentTarget.dataset.mod);
                let modStr = mod >= 0 ? '+' + mod : mod;
                const globalMod = char.globalAbilityMod || "0";
                if (globalMod !== "0") {
                    if (globalMod.includes('d')) {
                        modStr += (globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod);
                    } else {
                        const m = parseInt(globalMod) || 0;
                        const newMod = mod + m;
                        modStr = newMod >= 0 ? '+' + newMod : newMod;
                    }
                }
                const formula = `1d20${modStr}`;
                vtt.socket.emit('chat:msg', {
                    text: `[${char.name}: ${ab.toUpperCase()} Check] rolls **Ability Check**`,
                    roll: simulateRoll(formula)
                });
            });
        });

        document.querySelectorAll('.pc-roll-save').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ab = e.currentTarget.dataset.ab;
                const isProf = char.saves[ab];
                const baseMod = parseInt(e.currentTarget.dataset.mod);
                const globalMod = char.globalSaveMod || 0;
                const customMod = (char.saveMods && char.saveMods[ab]) || 0;

                let toggleFormulaStr = '';
                if (char.saveToggles) {
                    char.saveToggles.filter(t => t.enabled).forEach(t => {
                        if (t.target === 'all' || t.target === ab) {
                            if (t.formula.startsWith('+') || t.formula.startsWith('-')) {
                                toggleFormulaStr += t.formula;
                            } else {
                                toggleFormulaStr += '+' + t.formula;
                            }
                        }
                    });
                }

                const totalMod = baseMod + (isProf ? getProfBonus(char.level) : 0) + globalMod + customMod;
                const modStr = totalMod >= 0 ? '+' + totalMod : totalMod;
                const formula = `1d20${modStr}${toggleFormulaStr}`;

                vtt.socket.emit('chat:msg', {
                    text: `[${char.name}: ${ab.toUpperCase()} Save] rolls **Saving Throw**`,
                    roll: simulateRoll(formula)
                });
            });
        });

        document.querySelector('.pc-save-settings-btn')?.addEventListener('click', () => {
            document.getElementById('modal-save-global-mod').value = char.globalSaveMod || 0;
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ab => {
                const cb = document.getElementById(`modal-save-prof-${ab}`);
                const inp = document.getElementById(`modal-save-mod-${ab}`);
                if (cb) cb.checked = !!char.saves[ab];
                if (inp) inp.value = (char.saveMods && char.saveMods[ab]) || 0;

                const baseInp = document.getElementById(`modal-stat-base-${ab}`);
                const tempInp = document.getElementById(`modal-stat-mod-${ab}`);
                if (baseInp) baseInp.value = (char.stats && char.stats[ab]) || 10;
                if (tempInp) tempInp.value = (char.statMods && char.statMods[ab]) || 0;
            });
            renderSaveTogglesList();
            document.getElementById('pc-save-settings-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-save-settings-overlay').classList.remove('vtt-hidden');
        });

        document.querySelectorAll('.pc-save-quick-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (char.saveToggles && char.saveToggles[idx]) {
                    char.saveToggles[idx].enabled = !char.saveToggles[idx].enabled;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelector('.pc-skill-settings-btn')?.addEventListener('click', () => {
            document.getElementById('modal-skill-global-mod').value = char.globalAbilityMod || "0";
            ALL_SKILLS.forEach(skill => {
                const sName = skill.name;
                const idSafe = sName.replace(/ /g, '_');
                const pCb = document.getElementById(`modal-skill-prof-${idSafe}`);
                const eCb = document.getElementById(`modal-skill-exp-${idSafe}`);
                const inp = document.getElementById(`modal-skill-mod-${idSafe}`);
                if (pCb) pCb.checked = !!char.skills[sName];
                if (eCb) eCb.checked = !!char.expertise[sName];
                if (inp) inp.value = (char.skillMods && char.skillMods[sName]) || "0";
            });
            renderSkillTogglesList();
            document.getElementById('pc-skill-settings-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-skill-settings-overlay').classList.remove('vtt-hidden');
        });

        document.querySelectorAll('.pc-skill-quick-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (char.skillToggles && char.skillToggles[idx]) {
                    char.skillToggles[idx].enabled = !char.skillToggles[idx].enabled;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelectorAll('.pc-skill-roll').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const skill = e.currentTarget.dataset.skill;
                const skillObj = ALL_SKILLS.find(s => s.name === skill);
                const ab = skillObj ? skillObj.ability : 'dex';

                const baseMod = getMod(getTotalStat(char, ab) || 10);
                const isProf = char.skills[skill];
                const isExp = char.expertise[skill];
                const profBonus = getProfBonus(char.level);
                let totalMod = baseMod + (isProf ? profBonus : 0) + (isExp ? profBonus : 0);

                let modStr = totalMod >= 0 ? '+' + totalMod : totalMod;

                const customMod = char.skillMods[skill] || "0";
                if (customMod !== "0") {
                    if (customMod.includes('d')) {
                        modStr += (customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod);
                    } else {
                        const m = parseInt(customMod) || 0;
                        const newMod = totalMod + m;
                        modStr = newMod >= 0 ? '+' + newMod : newMod;
                        totalMod = newMod;
                    }
                }

                const globalMod = char.globalAbilityMod || "0";
                if (globalMod !== "0") {
                    if (globalMod.includes('d')) {
                        modStr += (globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod);
                    } else {
                        const m = parseInt(globalMod) || 0;
                        const newMod = totalMod + m;
                        modStr = newMod >= 0 ? '+' + newMod : newMod;
                        totalMod = newMod;
                    }
                }

                let toggleFormulaStr = '';
                if (char.skillToggles) {
                    char.skillToggles.filter(t => t.enabled).forEach(t => {
                        if (t.target === 'all' || t.target === skill) {
                            toggleFormulaStr += (t.formula.startsWith('+') || t.formula.startsWith('-')) ? t.formula : '+' + t.formula;
                        }
                    });
                }

                const formula = `1d20${modStr}${toggleFormulaStr}`;
                vtt.socket.emit('chat:msg', {
                    text: `[${char.name}: ${skill}] rolls **Skill Check**`,
                    roll: simulateRoll(formula)
                });
            });
        });

        document.querySelector('.pc-tool-settings-btn')?.addEventListener('click', () => {
            const list = document.getElementById('modal-tool-toggles-list');
            list.innerHTML = '';
            
            const currentTools = char.tools || {};
            const allTools = new Set([...STANDARD_TOOLS.map(t => t.name), ...Object.keys(currentTools)]);
            
            Array.from(allTools).sort().forEach(toolName => {
                const isStandard = STANDARD_TOOLS.some(t => t.name === toolName);
                const defTool = STANDARD_TOOLS.find(t => t.name === toolName);
                const tData = currentTools[toolName] || { ability: defTool ? defTool.ability : 'dex', show: false, prof: false, exp: false, mod: 0, custom: !isStandard };
                
                const div = document.createElement('div');
                div.className = 'tool-settings-row';
                div.dataset.key = toolName;
                div.dataset.custom = tData.custom.toString();
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'space-between';
                div.style.background = 'rgba(0,0,0,0.2)';
                div.style.padding = '6px';
                div.style.borderRadius = '4px';
                div.style.border = '1px solid var(--color-border-subtle)';
                
                const selAb = (ab) => tData.ability === ab ? 'selected' : '';
                
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; flex:1;">
                        <input type="checkbox" class="tool-show" title="Show on Sheet" ${tData.show ? 'checked' : ''} style="cursor:pointer; accent-color: var(--color-gold-base);">
                        <input type="checkbox" class="tool-prof" title="Proficient" ${tData.prof ? 'checked' : ''} style="cursor:pointer;">
                        <input type="checkbox" class="tool-exp" title="Expertise" ${tData.exp ? 'checked' : ''} style="cursor:pointer; border-radius:50%;">
                        ${tData.custom ? 
                            `<input type="text" class="tool-name" value="${toolName}" style="width:140px; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);">` :
                            `<span class="tool-name-static" style="width:140px; font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${toolName}">${toolName}</span>`
                        }
                        <select class="tool-ability" style="background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px; padding:2px;">
                            <option value="str" ${selAb('str')}>STR</option>
                            <option value="dex" ${selAb('dex')}>DEX</option>
                            <option value="con" ${selAb('con')}>CON</option>
                            <option value="int" ${selAb('int')}>INT</option>
                            <option value="wis" ${selAb('wis')}>WIS</option>
                            <option value="cha" ${selAb('cha')}>CHA</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" class="tool-mod" value="${tData.mod || '0'}" style="width:40px; text-align:center; font-size:0.85rem; background:transparent; border:none; border-bottom:1px solid var(--color-border-subtle); color:var(--color-text-primary);" placeholder="Mod">
                        ${tData.custom ? `<button class="btn btn-danger btn-xxs tool-delete" style="padding:2px 6px;"><i class="fa-solid fa-trash"></i></button>` : '<div style="width:24px;"></div>'}
                    </div>
                `;
                list.appendChild(div);
                
                if (tData.custom) {
                    div.querySelector('.tool-delete').addEventListener('click', () => {
                        div.remove();
                    });
                }
            });

            document.getElementById('pc-tool-settings-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-tool-settings-overlay').classList.remove('vtt-hidden');
        });

        document.querySelectorAll('.pc-tool-roll').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolName = e.currentTarget.dataset.tool;
                const toolData = char.tools[toolName];
                if (!toolData) return;
                
                const ab = toolData.ability || 'dex';
                const baseMod = getMod(getTotalStat(char, ab) || 10);
                const isProf = toolData.prof;
                const isExp = toolData.exp;
                const profBonus = getProfBonus(char.level);
                let totalMod = baseMod + (isProf ? profBonus : 0) + (isExp ? profBonus : 0);

                let modStr = totalMod >= 0 ? '+' + totalMod : totalMod;

                const customMod = toolData.mod || "0";
                if (customMod !== "0") {
                    if (customMod.includes('d')) {
                        modStr += (customMod.startsWith('+') || customMod.startsWith('-') ? customMod : '+' + customMod);
                    } else {
                        const m = parseInt(customMod) || 0;
                        const newMod = totalMod + m;
                        modStr = newMod >= 0 ? '+' + newMod : newMod;
                    }
                }
                
                let formula = `1d20${modStr}`;
                
                const globalMod = char.globalAbilityMod || "0";
                if (globalMod !== "0") {
                    formula += (globalMod.startsWith('+') || globalMod.startsWith('-') ? globalMod : '+' + globalMod);
                }

                if (char.skillToggles) {
                    char.skillToggles.filter(t => t.enabled).forEach(t => {
                        if (t.target === 'all') {
                            formula += (t.formula.startsWith('+') || t.formula.startsWith('-') ? t.formula : '+' + t.formula);
                        }
                    });
                }

                vtt.socket.emit('chat:msg', {
                    text: `[${char.name || 'Player'}: ${toolName} Check] rolls **Tool Check**`,
                    roll: simulateRoll(formula)
                });
            });
        });

        document.getElementById('pc-dcAbility')?.addEventListener('change', (e) => { char.dcAbility = e.target.value; saveAndEmit(char); renderSheetData(char); });
        document.getElementById('pc-spellAbility')?.addEventListener('change', (e) => { char.spellAbility = e.target.value; saveAndEmit(char); renderSheetData(char); });


        let modalDamageRows = [];

        function updateModalVisibility() {
            const atkStat = document.getElementById('modal-macro-atk-stat')?.value || 'none';
            const atkCustomContainer = document.getElementById('modal-macro-atk-custom-container');
            if (atkCustomContainer) {
                if (atkStat === 'custom') {
                    atkCustomContainer.classList.remove('vtt-hidden');
                } else {
                    atkCustomContainer.classList.add('vtt-hidden');
                }
            }

            const dcStat = document.getElementById('modal-macro-save-dc-stat')?.value || 'none';
            const dcCustomContainer = document.getElementById('modal-macro-save-dc-custom-container');
            const dcExtraContainer = document.getElementById('modal-macro-save-dc-extra-container');
            if (dcCustomContainer && dcExtraContainer) {
                if (dcStat === 'custom') {
                    dcCustomContainer.classList.remove('vtt-hidden');
                    dcExtraContainer.classList.add('vtt-hidden');
                } else {
                    dcCustomContainer.classList.add('vtt-hidden');
                    dcExtraContainer.classList.remove('vtt-hidden');
                }
            }
        }

        function renderModalDamage() {
            const list = document.getElementById('modal-macro-dmg-list');
            if (!list) return;
            const dmgTypes = ["Slashing", "Piercing", "Bludgeoning", "Fire", "Cold", "Lightning", "Thunder", "Poison", "Acid", "Necrotic", "Radiant", "Force", "Psychic", "Healing"];
            list.innerHTML = modalDamageRows.map((d, i) => `
                <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                    <input type="text" class="modal-dmg-formula" data-idx="${i}" value="${d.formula || ''}" placeholder="1d8" style="width:30%; padding:4px; font-size:0.8rem;">
                    <select class="modal-dmg-stat" data-idx="${i}" style="width:25%; padding:4px; font-size:0.8rem;">
                        <option value="">+ None</option>
                        <option value="str" ${d.stat === 'str' ? 'selected' : ''}>+ STR</option>
                        <option value="dex" ${d.stat === 'dex' ? 'selected' : ''}>+ DEX</option>
                        <option value="con" ${d.stat === 'con' ? 'selected' : ''}>+ CON</option>
                        <option value="int" ${d.stat === 'int' ? 'selected' : ''}>+ INT</option>
                        <option value="wis" ${d.stat === 'wis' ? 'selected' : ''}>+ WIS</option>
                        <option value="cha" ${d.stat === 'cha' ? 'selected' : ''}>+ CHA</option>
                    </select>
                    <select class="modal-dmg-type" data-idx="${i}" style="width:30%; padding:4px; font-size:0.8rem;">
                        ${dmgTypes.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <button class="btn btn-xxs btn-danger modal-dmg-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');

            document.querySelectorAll('.modal-dmg-formula').forEach(el => el.addEventListener('change', (e) => modalDamageRows[e.target.dataset.idx].formula = e.target.value));
            document.querySelectorAll('.modal-dmg-stat').forEach(el => el.addEventListener('change', (e) => modalDamageRows[e.target.dataset.idx].stat = e.target.value));
            document.querySelectorAll('.modal-dmg-type').forEach(el => el.addEventListener('change', (e) => modalDamageRows[e.target.dataset.idx].type = e.target.value));
            document.querySelectorAll('.modal-dmg-del').forEach(el => el.addEventListener('click', (e) => {
                modalDamageRows.splice(e.currentTarget.dataset.idx, 1);
                renderModalDamage();
            }));
        }

        function openMacroModal(idx = -1) {
            document.getElementById('pc-macro-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-macro-overlay').classList.remove('vtt-hidden');
            document.getElementById('modal-macro-idx').value = idx;

            if (idx >= 0) {
                const m = char.macros[idx];
                document.getElementById('modal-macro-name').value = m.name || '';
                document.getElementById('modal-macro-desc').value = m.description || '';
                document.getElementById('modal-macro-range').value = m.range || '';
                document.getElementById('modal-macro-target').value = m.target || '';

                // Attack logic with legacy fallback
                let atkStat = m.attackStat;
                if (!atkStat && m.attackBonus) {
                    atkStat = 'custom';
                } else if (!atkStat) {
                    atkStat = 'none';
                }

                document.getElementById('modal-macro-atk-stat').value = atkStat;
                document.getElementById('modal-macro-atk-prof').checked = m.attackProf || false;
                document.getElementById('modal-macro-atk-extra').value = m.attackExtra !== undefined ? m.attackExtra : 0;
                document.getElementById('modal-macro-crit-range').value = m.critRange || 20;
                document.getElementById('modal-macro-atk').value = m.attackBonus || '';

                // Save logic with legacy fallback
                document.getElementById('modal-macro-save-ab').value = m.saveAbility || '';

                let dcStat = m.saveDcStat;
                if (!dcStat && m.saveDcBase) {
                    dcStat = 'custom';
                } else if (!dcStat) {
                    dcStat = 'none';
                }

                document.getElementById('modal-macro-save-dc-stat').value = dcStat;
                document.getElementById('modal-macro-save-dc-extra').value = m.saveDcExtra !== undefined ? m.saveDcExtra : 0;
                document.getElementById('modal-macro-save-dc').value = m.saveDcCustom !== undefined ? m.saveDcCustom : (m.saveDcBase || '');

                modalDamageRows = m.damage ? JSON.parse(JSON.stringify(m.damage)) : [];
            } else {
                document.getElementById('modal-macro-name').value = '';
                document.getElementById('modal-macro-desc').value = '';
                document.getElementById('modal-macro-range').value = '';
                document.getElementById('modal-macro-target').value = '';

                document.getElementById('modal-macro-atk-stat').value = 'none';
                document.getElementById('modal-macro-atk-prof').checked = false;
                document.getElementById('modal-macro-atk-extra').value = 0;
                document.getElementById('modal-macro-crit-range').value = 20;
                document.getElementById('modal-macro-atk').value = '';

                document.getElementById('modal-macro-save-ab').value = '';
                document.getElementById('modal-macro-save-dc-stat').value = 'none';
                document.getElementById('modal-macro-save-dc-extra').value = 0;
                document.getElementById('modal-macro-save-dc').value = '';

                modalDamageRows = [];
            }
            updateModalVisibility();
            renderModalDamage();
        }

        function closeMacroModal() {
            document.getElementById('pc-macro-modal').classList.add('vtt-hidden');
            document.getElementById('pc-macro-overlay').classList.add('vtt-hidden');
        }

        document.getElementById('btn-add-macro')?.addEventListener('click', () => openMacroModal(-1));
        document.getElementById('modal-macro-cancel')?.addEventListener('click', closeMacroModal);
        document.getElementById('pc-macro-overlay')?.addEventListener('click', closeMacroModal);

        // Listeners for dropdown changes to toggle input visibility
        document.getElementById('modal-macro-atk-stat')?.addEventListener('change', updateModalVisibility);
        document.getElementById('modal-macro-save-dc-stat')?.addEventListener('change', updateModalVisibility);

        document.getElementById('modal-macro-add-dmg')?.addEventListener('click', () => {
            modalDamageRows.push({ id: 'dmg_' + Date.now(), formula: '1d8', stat: '', type: 'Slashing' });
            renderModalDamage();
        });

        document.getElementById('modal-macro-save')?.addEventListener('click', () => {
            const idx = parseInt(document.getElementById('modal-macro-idx').value);
            const atkStat = document.getElementById('modal-macro-atk-stat').value;
            const dcStat = document.getElementById('modal-macro-save-dc-stat').value;

            const m = {
                id: idx >= 0 ? char.macros[idx].id : 'mac_' + Date.now(),
                name: document.getElementById('modal-macro-name').value || 'New Macro',
                description: document.getElementById('modal-macro-desc').value.trim(),
                range: document.getElementById('modal-macro-range').value.trim(),
                target: document.getElementById('modal-macro-target').value.trim(),

                // Attack configuration
                attackStat: atkStat,
                attackProf: document.getElementById('modal-macro-atk-prof').checked,
                attackExtra: parseInt(document.getElementById('modal-macro-atk-extra').value) || 0,
                critRange: parseInt(document.getElementById('modal-macro-crit-range').value) || 20,
                attackBonus: document.getElementById('modal-macro-atk').value,

                // Save configuration
                saveAbility: document.getElementById('modal-macro-save-ab').value,
                saveDcStat: dcStat,
                saveDcExtra: parseInt(document.getElementById('modal-macro-save-dc-extra').value) || 0,
                saveDcCustom: document.getElementById('modal-macro-save-dc').value ? parseInt(document.getElementById('modal-macro-save-dc').value) : null,

                damage: modalDamageRows
            };
            if (idx >= 0) char.macros[idx] = m;
            else char.macros.push(m);
            closeMacroModal();
            saveAndEmit(char);
            renderSheetData(char);
        });

        document.querySelectorAll('.pc-macro-edit').forEach(btn => btn.addEventListener('click', (e) => openMacroModal(e.currentTarget.dataset.idx)));
        document.querySelectorAll('.pc-macro-del').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this macro?")) {
                char.macros.splice(e.currentTarget.dataset.idx, 1);
                saveAndEmit(char); renderSheetData(char);
            }
        }));

        document.querySelectorAll('.pc-macro-desc-ping').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const m = char.macros[e.currentTarget.dataset.idx];
            if (!m || !m.description) return;
            vtt.socket.emit('chat:msg', {
                abilityCard: {
                    creatureName: char.name,
                    abilityName: m.name,
                    range: m.range || '',
                    target: m.target || '',
                    text: `<div style="font-size:0.85rem; line-height:1.5; padding:4px 0;">${m.description}</div>`
                }
            });
        }));
        function evaluateAttackRoll(m, isSpell = false) {
            let globalAtkMod = parseInt(isSpell ? (char.spellSettings?.atkMod || 0) : (char.attackSettings?.atkMod || 0));
            let atkFormula = '';
            
            const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
            if (toggles) {
                toggles.filter(t => t.enabled).forEach(t => {
                    if (t.target === 'atk' || t.target === 'both') {
                        let f = t.formula;
                        let cleanF = f.startsWith('+') || f.startsWith('-') ? f : '+' + f;
                        atkFormula += `${cleanF}[${t.name || 'Toggle'}]`;
                    }
                });
            }

            let atkStat = m.attackStat || 'none';
            if (atkStat === 'spell') {
                atkStat = char.spellSettings?.ability || char.spellAbility || 'INT';
            }
            
            if (atkStat === 'custom') {
                const raw = (m.attackBonus || '').trim();
                const formula = raw.includes('d') ? raw : `1d20${raw.startsWith('+') || raw.startsWith('-') ? raw : '+' + raw}`;
                return simulateRoll(formula + (globalAtkMod ? (globalAtkMod >= 0 ? '+' : '') + globalAtkMod + '[Global]' : '') + atkFormula, m.critRange || 20);
            }
            if (atkStat === 'none') {
                if (m.attackBonus) {
                    const hasAttack = m.attackBonus.includes('d');
                    const formula = hasAttack ? m.attackBonus : `1d20${m.attackBonus.startsWith('+') || m.attackBonus.startsWith('-') ? m.attackBonus : '+' + m.attackBonus}`;
                    return simulateRoll(formula + (globalAtkMod ? (globalAtkMod >= 0 ? '+' : '') + globalAtkMod + '[Global]' : '') + atkFormula, m.critRange || 20);
                }
                return null;
            }

            const prof = getProfBonus(char.level);
            const statScore = getTotalStat(char, atkStat.toLowerCase()) || 10;
            const statMod = getMod(statScore);
            const addProf = m.attackProf;
            const extra = m.attackExtra !== undefined ? parseInt(m.attackExtra) : 0;

            let formula = '1d20';

            if (statMod !== 0) {
                formula += `${statMod >= 0 ? '+' : ''}${statMod}[${atkStat.toUpperCase()}]`;
            }
            if (addProf) {
                formula += `+${prof}[Prof]`;
            }
            if (extra !== 0) {
                formula += `${extra >= 0 ? '+' : ''}${extra}`;
            }
            if (globalAtkMod !== 0) {
                formula += `${globalAtkMod >= 0 ? '+' : ''}${globalAtkMod}[Global]`;
            }
            formula += atkFormula;

            const rollResult = simulateRoll(formula, m.critRange || 20);
            if (rollResult && rollResult.breakdownStr) {
                rollResult.breakdownStr = rollResult.breakdownStr.replace(/^([+-]?\s*\d+(?:\(.*?\))?)/, '[$1]');
            }
            return rollResult;
        }

        function evaluateSaveDc(m, isSpell = false) {
            if (!m.saveAbility) return null;
            let dcStat = m.saveDcStat || 'none';
            if (dcStat === 'spell') {
                dcStat = char.spellSettings?.ability || char.spellAbility || 'INT';
            }
            const prof = getProfBonus(char.level);

            if (dcStat === 'custom') {
                const dc = m.saveDcCustom !== undefined && m.saveDcCustom !== null ? parseInt(m.saveDcCustom) : (parseInt(m.saveDcBase) || 10);
                return { ability: m.saveAbility, dc };
            }

            let statMod = 0;
            if (dcStat === 'none') {
                if (m.saveDcBase) {
                    return { ability: m.saveAbility, dc: parseInt(m.saveDcBase) };
                }
                statMod = getMod(getTotalStat(char, (char.dcAbility || 'INT').toLowerCase()) || 10);
            } else {
                statMod = getMod(getTotalStat(char, dcStat.toLowerCase()) || 10);
            }

            let globalDcMod = parseInt(isSpell ? (char.spellSettings?.dcMod || 0) : (char.attackSettings?.dcMod || 0));
            const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
            if (toggles) {
                toggles.filter(t => t.enabled).forEach(t => {
                    if (t.target === 'dc' || t.target === 'both') {
                        globalDcMod += parseInt(t.formula) || 0;
                    }
                });
            }

            const extra = m.saveDcExtra !== undefined ? parseInt(m.saveDcExtra) : 0;
            const dc = 8 + prof + statMod + extra + globalDcMod;
            return { ability: m.saveAbility, dc };
        }

        function evaluateDamageRolls(m, isSpell = false, isCrit = false) {
            if (!m.damage || !m.damage.length) return [];
            
            let globalDmgMod = parseInt(isSpell ? (char.spellSettings?.dmgMod || 0) : (char.attackSettings?.dmgMod || 0));
            let dmgFormula = '';
            let typedToggles = [];
            
            const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;

            if (toggles) {
                toggles.filter(t => t.enabled).forEach(t => {
                    if (t.target === 'dmg' || t.target === 'both') {
                        if (t.dmgType && t.dmgType !== '') {
                            typedToggles.push(t);
                        } else {
                            let f = t.formula;
                            let cleanF = f.startsWith('+') || f.startsWith('-') ? f : '+' + f;
                            dmgFormula += `${cleanF}[${t.name || 'Toggle'}]`;
                        }
                    }
                });
            }

            let results = m.damage.map(d => {
                let formula = (d.formula || '').trim();
                let statMod = 0;

                if (d.stat && d.stat !== 'none' && d.stat !== '') {
                    let statKey = d.stat.toLowerCase();
                    if (statKey === 'spell') {
                        statKey = (char.spellSettings?.ability || char.spellcastingAbility || 'int').toLowerCase();
                    }
                    const score = getTotalStat(char, statKey) || 10;
                    statMod = getMod(score);
                }

                let rollFormula = formula;
                if (statMod !== 0) {
                    rollFormula += `${statMod >= 0 ? '+' : ''}${statMod}[${(d.stat || 'STAT').toUpperCase()}]`;
                }
                if (d.custom && d.custom.trim() !== '') {
                    let c = d.custom.trim();
                    let cleanC = c.startsWith('+') || c.startsWith('-') ? c : '+' + c;
                    rollFormula += `${cleanC}[Custom]`;
                }
                if (globalDmgMod !== 0) {
                    rollFormula += `${globalDmgMod >= 0 ? '+' : ''}${globalDmgMod}[Global]`;
                }
                rollFormula += dmgFormula;

                if (isCrit) {
                    rollFormula = rollFormula.replace(/(\d+)\s*[dD]\s*(\d+)/g, (match, count, faces) => `${parseInt(count) * 2}d${faces}`);
                }
                const r = simulateRoll(rollFormula);
                return { formula: d.formula, type: d.type || '', roll: r };
            });

            typedToggles.forEach(t => {
                let cleanF = t.formula.startsWith('+') || t.formula.startsWith('-') ? t.formula : '+' + t.formula;
                let rollFormula = `${cleanF}[${t.name || 'Toggle'}]`;
                // Because cleanF usually starts with + or -, and formula typically shouldn't start with a sign alone,
                // we'll let simulateRoll handle it. simulateRoll handles leading signs gracefully.
                if (isCrit) {
                    rollFormula = rollFormula.replace(/(\d+)\s*[dD]\s*(\d+)/g, (match, count, faces) => `${parseInt(count) * 2}d${faces}`);
                }
                const r = simulateRoll(rollFormula);
                results.push({ formula: cleanF, type: t.dmgType, roll: r });
            });

            return results;
        }

        document.querySelectorAll('.pc-macro-attack').forEach(btn => btn.addEventListener('click', (e) => {
            const m = char.macros[e.currentTarget.dataset.idx];
            const r = evaluateAttackRoll(m);
            if (r) {
                vtt.socket.emit('chat:msg', {
                    macroCard: {
                        charName: char.name,
                        macroName: m.name,
                        description: m.description || '',
                        range: m.range || '',
                        target: m.target || '',
                        atkRoll: r
                    }
                });
            }
        }));

        document.querySelectorAll('.pc-macro-save').forEach(btn => btn.addEventListener('click', (e) => {
            const m = char.macros[e.currentTarget.dataset.idx];
            const saveInfo = evaluateSaveDc(m);
            if (saveInfo) {
                vtt.socket.emit('chat:msg', {
                    macroCard: {
                        charName: char.name,
                        macroName: m.name,
                        description: m.description || '',
                        range: m.range || '',
                        target: m.target || '',
                        saveInfo
                    }
                });
            }
        }));

        document.querySelectorAll('.pc-macro-damage').forEach(btn => btn.addEventListener('click', (e) => {
            const m = char.macros[e.currentTarget.dataset.idx];
            const dmgRolls = evaluateDamageRolls(m);
            if (!dmgRolls.length) return;

            vtt.socket.emit('chat:msg', {
                macroCard: {
                    charName: char.name,
                    macroName: m.name,
                    description: m.description || '',
                    range: m.range || '',
                    target: m.target || '',
                    dmgRolls
                }
            });
        }));

        document.querySelectorAll('.pc-macro-roll-all').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const m = char.macros[e.currentTarget.dataset.idx];
            if (!m) return;

            const atkRoll = evaluateAttackRoll(m);
            const saveInfo = evaluateSaveDc(m);
            let isCrit = atkRoll && atkRoll.isCritSuccess;
            const dmgRolls = evaluateDamageRolls(m, false, isCrit);

            vtt.socket.emit('chat:msg', {
                macroCard: {
                    charName: char.name,
                    macroName: m.name,
                    description: m.description || '',
                    range: m.range || '',
                    target: m.target || '',
                    atkRoll,
                    saveInfo,
                    dmgRolls
                }
            });
        }));

        document.getElementById('btn-add-equip-db')?.addEventListener('click', () => {
            window.openItemModal();
        });
        document.getElementById('btn-add-equip-custom')?.addEventListener('click', () => {
            window.openCustomItemModal();
        });
        document.querySelectorAll('.pc-equip-qty-minus').forEach(btn => btn.addEventListener('click', (e) => {
            const eq = char.equipment[e.currentTarget.dataset.idx];
            if (eq.qty > 1) { eq.qty = parseInt(eq.qty) - 1; saveAndEmit(char); renderSheetData(char); }
        }));
        document.querySelectorAll('.pc-equip-qty-plus').forEach(btn => btn.addEventListener('click', (e) => {
            const eq = char.equipment[e.currentTarget.dataset.idx];
            eq.qty = parseInt(eq.qty || 1) + 1; saveAndEmit(char); renderSheetData(char);
        }));
        document.querySelectorAll('.pc-equip-edit').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            window.openCustomItemModal(idx);
        }));
        document.querySelectorAll('.pc-equip-del').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this item?")) {
                char.equipment.splice(e.currentTarget.dataset.idx, 1);
                saveAndEmit(char); renderSheetData(char);
            }
        }));
        document.querySelectorAll('.pc-equip-ping').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const eq = char.equipment[idx];
            vtt.socket.emit('chat:msg', {
                itemCard: {
                    charName: char.name,
                    itemName: eq.name,
                    weight: eq.weight || 0,
                    qty: eq.qty || 1,
                    description: eq.description || ''
                }
            });
        }));

        document.querySelectorAll('.pc-equip-toggle').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const descEl = document.getElementById(`pc-equip-desc-${idx}`);
            const chevEl = document.getElementById(`pc-equip-chevron-${idx}`);
            if (descEl.classList.contains('vtt-hidden')) {
                descEl.classList.remove('vtt-hidden');
                if (chevEl) chevEl.style.transform = 'rotate(90deg)';
            } else {
                descEl.classList.add('vtt-hidden');
                if (chevEl) chevEl.style.transform = 'rotate(0deg)';
            }
        }));

        document.querySelectorAll('.pc-currency-input').forEach(input => input.addEventListener('change', (e) => {
            const coinType = e.currentTarget.dataset.coin;
            char.currency[coinType] = parseInt(e.currentTarget.value) || 0;
            saveAndEmit(char);
            renderSheetData(char);
        }));

        document.querySelectorAll('.pc-spell-tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            activeSpellTab = level;
            document.querySelectorAll('.pc-spell-tab-btn').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
            e.currentTarget.classList.add('btn-primary');
            e.currentTarget.classList.remove('btn-secondary');
            document.querySelectorAll('.pc-spell-page').forEach(p => p.classList.add('vtt-hidden'));
            document.getElementById('spell-page-' + level)?.classList.remove('vtt-hidden');
        }));








        function getUpcastedDamage(sp, castLvl, baseLvl, charLvl) {
            let list = sp.damageList && sp.damageList.length > 0 ? JSON.parse(JSON.stringify(sp.damageList)) : [];
            if (list.length === 0 && sp.damage) list.push({ formula: sp.damage, type: sp.damageType || '' });
            
            if (baseLvl === 0 && sp.cantripScale && list.length > 0) {
                let cCount = 1;
                if (charLvl >= 5) cCount = 2;
                if (charLvl >= 11) cCount = 3;
                if (charLvl >= 17) cCount = 4;
                for (let d of list) {
                    if (d.formula.match(/(?:\d+\s*)?[dD]\s*\d+/)) {
                        d.formula = d.formula.replace(/(?:\d+\s*)?([dD]\s*\d+)/, `${cCount}$1`);
                    }
                }
            } else if (castLvl > baseLvl && sp.upcastBonus && list.length > 0) {
                const extra = castLvl - baseLvl;
                const upcastMatch = sp.upcastBonus.match(/(?:(\d+)\s*)?[dD]\s*(\d+)/);
                if (upcastMatch) {
                    const diceCount = upcastMatch[1] ? parseInt(upcastMatch[1]) : 1;
                    const extraDice = diceCount * extra;
                    const uSize = "d" + upcastMatch[2];
                    
                    let merged = false;
                    for (let d of list) {
                        const diceRegex = new RegExp(`(?:(\\d+)\\s*)?[dD]\\s*${upcastMatch[2]}\\b`, 'i');
                        let m = d.formula.match(diceRegex);
                        if (m) {
                            const baseCount = m[1] ? parseInt(m[1]) : 1;
                            d.formula = d.formula.replace(diceRegex, `${baseCount + extraDice}${uSize}`);
                            merged = true;
                            break;
                        }
                    }
                    if (!merged) {
                        list[0].formula += ` + ${extraDice}${uSize}`;
                    }
                } else if (!isNaN(parseInt(sp.upcastBonus))) {
                    list[0].formula += ` + ${parseInt(sp.upcastBonus) * extra}`;
                }
            }
            return list;
        }

        document.querySelectorAll('.pc-spell-expand-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const item = e.currentTarget.closest('.cs-spell-item');
            const details = item.querySelector('.pc-spell-details');
            const nameEl = item.querySelector('.pc-spell-name');
            const spellName = nameEl.textContent.trim();
            const descEl = details.querySelector('.pc-spell-desc');
            const chevron = e.currentTarget.querySelector('.fa-chevron-right');

            const postChatBtn = item.querySelector('.pc-spell-post-chat');
            const level = postChatBtn ? postChatBtn.dataset.level : null;
            const idx = postChatBtn ? postChatBtn.dataset.idx : null;
            const sp = (level && idx !== null && char.spells[level]) ? char.spells[level][idx] : null;

            if (details.style.display === 'none') {
                details.style.display = 'block';
                chevron.style.transform = 'rotate(90deg)';
                if (!spellCache && window.DataUtil?.spell) {
                    descEl.innerHTML = `<em>Loading spell data...</em>`;
                    window.DataUtil.spell.pLoadAll().then(spells => {
                        spellCache = spells;
                        renderAndInjectSpell(spellName, descEl, sp?.description || '', sp);
                    });
                } else if (spellCache) {
                    renderAndInjectSpell(spellName, descEl, sp?.description || '', sp);
                } else {
                    descEl.innerHTML = `<em>Could not load spell data.</em>`;
                }
            } else {
                details.style.display = 'none';
                chevron.style.transform = 'rotate(0deg)';
            }
        }));

        document.querySelectorAll('.pc-spell-post-chat').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            const item = e.currentTarget.closest('.cs-spell-item');
            const descEl = item.querySelector('.pc-spell-desc');
            
            const postToChat = (html) => {
                vtt.socket.emit('chat:msg', { abilityCard: { creatureName: char.name, abilityName: sp.name, text: html } });
            };
            
            if (descEl.innerHTML.includes('Loading spell details...')) {
                const nameEl = item.querySelector('.pc-spell-name');
                const spellName = nameEl.textContent.trim();
                if (!spellCache && window.DataUtil?.spell) {
                    window.DataUtil.spell.pLoadAll().then(spells => {
                        spellCache = spells;
                        renderAndInjectSpell(spellName, descEl, sp.description || '', sp);
                        postToChat(descEl.innerHTML);
                    }).catch(() => postToChat(sp.description || ''));
                } else if (spellCache) {
                    renderAndInjectSpell(spellName, descEl, sp.description || '', sp);
                    postToChat(descEl.innerHTML);
                } else postToChat(sp.description || '');
            } else {
                postToChat(descEl.innerHTML);
            }
        }));

        document.querySelectorAll('.pc-spell-ping-macro').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            
            const emitMacro = (castLvl) => {
                let card = { charName: char.name, macroName: sp.name };
                if (castLvl) card.macroName += ` (Level ${castLvl})`;
                if (sp.macroDescription) card.description = sp.macroDescription;
                
                const r = evaluateAttackRoll(sp, true);
                if (r) card.atkRoll = r;
                
                const saveInfo = evaluateSaveDc(sp, true);
                if (saveInfo) {
                    card.saveDc = saveInfo.dc;
                    card.saveAbility = saveInfo.ability;
                    card.target = `${saveInfo.ability} Save DC ${saveInfo.dc}`;
                }

                const dmgList = getUpcastedDamage(sp, castLvl || 0, level === 'cantrip' || level === 'legacy' ? 0 : parseInt(level.replace('level', '')), char.level || 1);
                if (dmgList.length > 0) {
                    const m = { damage: dmgList };
                    let isCrit = r && r.isCritSuccess;
                    const rolls = evaluateDamageRolls(m, true, isCrit);
                    if (rolls && rolls.length) card.dmgRolls = rolls;
                }
                
                vtt.socket.emit('chat:msg', { macroCard: card });
            };

            if (level !== 'cantrip' && level !== 'legacy' && sp.upcastBonus) {
                promptUpcastLevel(parseInt(level.replace('level', '')), (lvl) => {
                    if (lvl) emitMacro(lvl);
                });
            } else {
                emitMacro(null);
            }
        }));

        document.querySelectorAll('.pc-spell-prep-toggle').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            sp.prepared = sp.prepared === false ? true : false;
            saveAndEmit(char); renderSheetData(char);
        }));

        document.querySelectorAll('.pc-spell-macro-attack').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            const r = evaluateAttackRoll(sp);
            if (r) {
                vtt.socket.emit('chat:msg', {
                    macroCard: {
                        charName: char.name,
                        macroName: sp.name + " (Spell Attack)",
                        atkRoll: r
                    }
                });
            }
        }));

        document.querySelectorAll('.pc-spell-macro-save').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            const saveInfo = evaluateSaveDc(sp, true);
            if (saveInfo) {
                vtt.socket.emit('chat:msg', {
                    macroCard: {
                        charName: char.name,
                        macroName: sp.name + " (Spell Save)",
                        saveDc: saveInfo.dc,
                        saveAbility: saveInfo.ability,
                        target: `${saveInfo.ability} Save DC ${saveInfo.dc}`
                    }
                });
            }
        }));

        document.querySelectorAll('.pc-spell-macro-damage').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            
            const emitDamage = (castLvl) => {
                const dmgList = getUpcastedDamage(sp, castLvl || 0, level === 'cantrip' || level === 'legacy' ? 0 : parseInt(level.replace('level', '')), char.level || 1);
                if (dmgList.length > 0) {
                    const m = { damage: dmgList };
                    const rolls = evaluateDamageRolls(m, true);
                    if (rolls && rolls.length) {
                        vtt.socket.emit('chat:msg', {
                            macroCard: {
                                charName: char.name,
                                macroName: sp.name + (castLvl ? ` (Level ${castLvl})` : '') + " (Damage)",
                                dmgRolls: rolls
                            }
                        });
                    }
                }
            };

            if (level !== 'cantrip' && level !== 'legacy' && sp.upcastBonus) {
                promptUpcastLevel(parseInt(level.replace('level', '')), (lvl) => {
                    if (lvl) emitDamage(lvl);
                });
            } else {
                emitDamage(null);
            }
        }));

        document.querySelectorAll('.btn-add-spell').forEach(btn => btn.addEventListener('click', (e) => {
            if (window.VTTSpellManager) { window.VTTSpellManager.openModal(e.currentTarget.dataset.level, -1, currentChar, (char) => { saveAndEmit(char); renderSheetData(char); }); }
        }));

        document.querySelectorAll('.pc-spell-edit').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.VTTSpellManager) { window.VTTSpellManager.openModal(e.currentTarget.dataset.level, e.currentTarget.dataset.idx, currentChar, (char) => { saveAndEmit(char); renderSheetData(char); }); }
        }));

        document.querySelectorAll('.pc-slot-current').forEach(inp => inp.addEventListener('change', (e) => {
            const lvl = e.currentTarget.dataset.level;
            char.spellSlots[lvl] = char.spellSlots[lvl] || { current: 0, max: 0 };
            char.spellSlots[lvl].current = parseInt(e.currentTarget.value) || 0;
            saveAndEmit(char);
        }));

        document.querySelectorAll('.pc-slot-max').forEach(inp => inp.addEventListener('change', (e) => {
            const lvl = e.currentTarget.dataset.level;
            char.spellSlots[lvl] = char.spellSlots[lvl] || { current: 0, max: 0 };
            char.spellSlots[lvl].max = parseInt(e.currentTarget.value) || 0;
            saveAndEmit(char);
        }));

        document.querySelectorAll('.pc-slot-btn-minus').forEach(btn => btn.addEventListener('click', (e) => {
            const input = e.currentTarget.nextElementSibling;
            if (input && input.classList.contains('pc-slot-current')) {
                let val = parseInt(input.value) || 0;
                if (val > 0) {
                    input.value = val - 1;
                    input.dispatchEvent(new Event('change'));
                }
            }
        }));

        document.querySelectorAll('.pc-slot-btn-plus').forEach(btn => btn.addEventListener('click', (e) => {
            const input = e.currentTarget.previousElementSibling;
            if (input && input.classList.contains('pc-slot-current')) {
                let val = parseInt(input.value) || 0;
                input.value = val + 1;
                input.dispatchEvent(new Event('change'));
            }
        }));

        document.getElementById('all-spells-search')?.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            document.querySelectorAll('#spell-page-all .spell-row').forEach(row => {
                const name = row.dataset.spellName || '';
                if (name.includes(val)) row.style.display = 'flex';
                else row.style.display = 'none';
            });
            document.querySelectorAll('.all-spells-group').forEach(group => {
                const visibleSpells = group.querySelectorAll('.spell-row[style*="display: flex"]');
                const hasVisible = visibleSpells.length > 0;
                group.style.display = hasVisible ? 'block' : 'none';
            });
        });

        // Bio saving logic moved to harvestBuildTab

        function harvestBuildTab() {
            const newClasses = [];
            document.querySelectorAll('.pc-class-sel').forEach(sel => {
                const idx = sel.dataset.idx;
                const clsName = sel.value;
                const subName = document.querySelector(`.pc-subclass-sel[data-idx="${idx}"]`)?.value || '';
                const lvl = parseInt(document.querySelector(`.pc-class-level[data-idx="${idx}"]`)?.value) || 1;
                if (clsName) {
                    newClasses.push({ name: clsName, subclass: subName, level: lvl });
                }
            });
            char.classes = newClasses.length > 0 ? newClasses : [{name: 'Fighter', subclass: '', level: 1}];
            char.class = char.classes[0].name;
            char.level = char.classes.reduce((acc, c) => acc + c.level, 0);
            
            char.race = document.getElementById('pc-race').value;
            char.background = document.getElementById('pc-background').value;
            char.hpMax = parseInt(document.getElementById('pc-hpMax').value) || 10;
            char.ac = parseInt(document.getElementById('pc-ac').value) || 10;
            char.speed = {
                walk: parseInt(document.getElementById('pc-speed-walk').value) || 0,
                climb: parseInt(document.getElementById('pc-speed-climb').value) || 0,
                fly: parseInt(document.getElementById('pc-speed-fly').value) || 0,
                burrow: parseInt(document.getElementById('pc-speed-burrow').value) || 0
            };

            char.senses = {
                darkvision: parseInt(document.getElementById('pc-sense-darkvision').value) || 0,
                devilSight: parseInt(document.getElementById('pc-sense-devilsight').value) || 0,
                blindsight: parseInt(document.getElementById('pc-sense-blindsight').value) || 0,
                truesight: parseInt(document.getElementById('pc-sense-truesight').value) || 0
            };
            const maxSpecialVision = Math.max(char.senses.darkvision, char.senses.devilSight, char.senses.blindsight, char.senses.truesight);
            char.tokenSight = maxSpecialVision > 0 ? maxSpecialVision : 60;

            if (char.hpCurrent > char.hpMax) char.hpCurrent = char.hpMax;

            char.bio.age = document.getElementById('pc-bio-age')?.value || '';
            char.bio.height = document.getElementById('pc-bio-height')?.value || '';
            char.bio.weight = document.getElementById('pc-bio-weight')?.value || '';
            char.bio.backstory = document.getElementById('pc-bio-backstory')?.value || '';
            char.bio.notes = document.getElementById('pc-bio-notes')?.value || '';
        }

        document.getElementById('pc-save-build')?.addEventListener('click', () => {
            harvestBuildTab();
            saveAndEmit(char); renderSheetData(char);
        });

        ['pc-sense-darkvision', 'pc-sense-devilsight', 'pc-sense-blindsight', 'pc-sense-truesight'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                harvestBuildTab();
                saveAndEmit(char);
            });
        });

        document.getElementById('pc-add-class')?.addEventListener('click', () => {
            harvestBuildTab();
            const currentClassNames = char.classes.map(c => c.name);
            const availableClasses = builderCache ? Object.keys(builderCache.classIndex).map(k => k.charAt(0).toUpperCase() + k.slice(1)) : [];
            const unusedClass = availableClasses.find(c => !currentClassNames.includes(c)) || '';
            char.classes.push({ name: unusedClass, subclass: '', level: 1 });
            saveAndEmit(char); renderSheetData(char);
        });

        document.querySelectorAll('.pc-class-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                harvestBuildTab();
                const idx = e.currentTarget.dataset.idx;
                char.classes.splice(idx, 1);
                saveAndEmit(char); renderSheetData(char);
            });
        });
        
        document.querySelectorAll('.pc-class-sel').forEach(sel => {
            sel.addEventListener('change', (e) => {
                harvestBuildTab();
                const idx = e.target.dataset.idx;
                if (char.classes && char.classes[idx]) {
                    char.classes[idx].subclass = ''; // Reset subclass
                }
                saveAndEmit(char); 
                renderSheetData(char); 
            });
        });

        document.querySelectorAll('.pc-subclass-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                harvestBuildTab();
                saveAndEmit(char);
            });
        });

        function renderAbilityFields(fields = []) {
            const list = document.getElementById('modal-ability-fields-list');
            list.innerHTML = '';
            fields.forEach((f, i) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '8px';
                row.className = 'modal-ability-field-row';
                row.innerHTML = `
                    <input type="text" class="ab-field-label" placeholder="Label" value="${f.label}" style="flex:1; padding:4px; font-size:0.8rem;">
                    <input type="text" class="ab-field-entry" placeholder="Entry" value="${f.entry}" style="flex:2; padding:4px; font-size:0.8rem;">
                    <button class="btn btn-xxs btn-danger btn-ab-field-remove"><i class="fa-solid fa-trash"></i></button>
                `;
                row.querySelector('.btn-ab-field-remove').addEventListener('click', () => row.remove());
                list.appendChild(row);
            });
        }

        let availableFeatures = [];
        let currentImportData = [];
        let currentCategory = 'class';

        function extractTextFromEntries(entries) {
            if (!entries) return '';
            if (typeof entries === 'string') {
                return entries.replace(/{@\w+\s+([^|}]+)\|?[^}]*}/g, '$1');
            }
            if (Array.isArray(entries)) {
                return entries.map(e => extractTextFromEntries(e)).join('\n\n');
            }
            if (typeof entries === 'object') {
                if (entries.type === 'list') {
                    return (entries.items || []).map(i => '- ' + extractTextFromEntries(i)).join('\n');
                }
                if (entries.entries) {
                    let text = entries.name ? `**${entries.name}**\n` : '';
                    return text + extractTextFromEntries(entries.entries);
                }
                if (entries.items) {
                    return extractTextFromEntries(entries.items);
                }
                if (entries.type === 'table') {
                    return '[Table omitted from description]';
                }
            }
            return '';
        }

        function switchModalTab(tabId) {
            document.querySelectorAll('#tab-btn-manual, #tab-btn-import').forEach(b => b.classList.remove('active'));
            document.getElementById('modal-tab-manual').classList.add('vtt-hidden');
            document.getElementById('modal-tab-import').classList.add('vtt-hidden');
            
            document.getElementById(`tab-btn-${tabId}`).classList.add('active');
            document.getElementById(`modal-tab-${tabId}`).classList.remove('vtt-hidden');
        }

        document.getElementById('tab-btn-manual')?.addEventListener('click', () => switchModalTab('manual'));
        document.getElementById('tab-btn-import')?.addEventListener('click', () => switchModalTab('import'));

        function renderImportFeatureList() {
            const listEl = document.getElementById('import-feature-list');
            const search = document.getElementById('import-search').value.toLowerCase();
            const subSel = document.getElementById('import-subclass-sel').value;

            if (currentImportData.length === 0 && currentCategory === 'class') {
                listEl.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Select a class to browse features</div>';
                return;
            }

            availableFeatures = [];
            
            currentImportData.forEach(f => {
                if (currentCategory === 'class') {
                    if (f.subclassShortName && subSel && f.subclassShortName !== subSel) return;
                }
                availableFeatures.push(f);
            });

            let html = '';
            availableFeatures.forEach((f, idx) => {
                const name = f.name || '';
                if (search && !name.toLowerCase().includes(search)) return;
                
                const source = f.source ? `[${f.source}]` : '';
                const isSubclass = f.subclassShortName ? `[${f.subclassShortName}] ` : '';
                let levelText = f.level !== undefined ? `Level ${f.level} ` : '';

                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:0.85rem; font-weight:bold; color:var(--color-text-primary);">${name}</span>
                            <span style="font-size:0.7rem; color:var(--color-text-muted);">${levelText}${isSubclass}${source}</span>
                        </div>
                        <button class="btn btn-xxs btn-secondary btn-import-feature-exec" data-idx="${idx}">Import</button>
                    </div>
                `;
            });

            if (!html) {
                html = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">No features found</div>';
            }

            listEl.innerHTML = html;

            listEl.querySelectorAll('.btn-import-feature-exec').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.currentTarget.dataset.idx;
                    const f = availableFeatures[idx];
                    document.getElementById('modal-ability-name').value = f.name || '';
                    document.getElementById('modal-ability-desc').value = extractTextFromEntries(f.entries).trim();
                    switchModalTab('manual');
                });
            });
        }

        document.getElementById('import-search')?.addEventListener('input', renderImportFeatureList);
        document.getElementById('import-subclass-sel')?.addEventListener('change', renderImportFeatureList);
        
        document.getElementById('import-category-sel')?.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            const classFilters = document.getElementById('import-class-filters');
            currentImportData = [];
            document.getElementById('import-search').value = '';
            
            if (currentCategory === 'class') {
                classFilters.style.display = 'flex';
                document.getElementById('import-class-sel').value = '';
                document.getElementById('import-subclass-sel').innerHTML = '<option value="">-- All Subclasses --</option>';
                document.getElementById('import-subclass-sel').disabled = true;
                renderImportFeatureList();
            } else {
                classFilters.style.display = 'none';
                let file = '';
                let key = '';
                if (currentCategory === 'feat') { file = 'data/feats.json'; key = 'feat'; }
                if (currentCategory === 'race') { file = 'data/races.json'; key = 'race'; }
                if (currentCategory === 'charoption') { file = 'data/charcreationoptions.json'; key = 'charoption'; }
                if (currentCategory === 'optionalfeature') { file = 'data/optionalfeatures.json'; key = 'optionalfeature'; }
                
                document.getElementById('import-feature-list').innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Loading...</div>';
                fetch(file).then(r => r.json()).then(data => {
                    currentImportData = data[key] || [];
                    renderImportFeatureList();
                }).catch(() => {
                    document.getElementById('import-feature-list').innerHTML = '<div style="text-align:center; color:var(--color-error); font-size:0.8rem; margin-top:20px;">Failed to load data</div>';
                });
            }
        });

        function initializeImportTab() {
            const classSel = document.getElementById('import-class-sel');
            if (!classSel || !builderCache || classSel.options.length > 1) return;

            let opts = '<option value="">-- Select Class --</option>';
            Object.keys(builderCache.classIndex).forEach(cKey => {
                const name = cKey.charAt(0).toUpperCase() + cKey.slice(1);
                opts += `<option value="${name}">${name}</option>`;
            });
            classSel.innerHTML = opts;

            classSel.addEventListener('change', () => {
                const className = classSel.value;
                const subSel = document.getElementById('import-subclass-sel');
                if (!className) {
                    currentImportData = [];
                    subSel.innerHTML = '<option value="">-- All Subclasses --</option>';
                    subSel.disabled = true;
                    renderImportFeatureList();
                    return;
                }

                const file = builderCache.classIndex[className.toLowerCase()];
                if (!file) return;

                fetch(`data/class/${file}`).then(r => r.json()).then(data => {
                    currentImportData = [];
                    if (data.classFeature) currentImportData.push(...data.classFeature);
                    if (data.subclassFeature) currentImportData.push(...data.subclassFeature);
                    
                    let subOpts = '<option value="">-- All Subclasses --</option>';
                    if (data.subclass) {
                        const seen = new Set();
                        data.subclass.forEach(sc => {
                            if (!seen.has(sc.shortName)) {
                                seen.add(sc.shortName);
                                subOpts += `<option value="${sc.shortName}">${sc.name} [${sc.source}]</option>`;
                            }
                        });
                    }
                    subSel.innerHTML = subOpts;
                    subSel.disabled = false;
                    renderImportFeatureList();
                });
            });
        }

        document.getElementById('btn-add-ability')?.addEventListener('click', () => {
            document.getElementById('modal-ability-idx').value = '-1';
            document.getElementById('modal-ability-name').value = '';
            document.getElementById('modal-ability-desc').value = '';
            document.getElementById('modal-ability-formula').value = '';
            document.getElementById('modal-ability-has-counter').checked = false;
            document.getElementById('modal-ability-uses-container').style.display = 'none';
            document.getElementById('modal-ability-uses-current').value = 0;
            document.getElementById('modal-ability-uses-max').value = 0;
            renderAbilityFields([]);
            switchModalTab('manual');
            initializeImportTab();
            document.getElementById('pc-ability-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.remove('vtt-hidden');
        });

        document.querySelectorAll('.pc-ability-edit').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            document.getElementById('modal-ability-idx').value = idx;
            document.getElementById('modal-ability-name').value = ab.name || '';
            document.getElementById('modal-ability-desc').value = ab.description || '';
            document.getElementById('modal-ability-formula').value = ab.formula || '';
            document.getElementById('modal-ability-has-counter').checked = !!ab.hasCounter;
            document.getElementById('modal-ability-uses-container').style.display = ab.hasCounter ? 'flex' : 'none';
            document.getElementById('modal-ability-uses-current').value = ab.usesCurrent || 0;
            document.getElementById('modal-ability-uses-max').value = ab.usesMax || 0;
            renderAbilityFields(ab.customFields || []);
            switchModalTab('manual');
            initializeImportTab();
            document.getElementById('pc-ability-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.remove('vtt-hidden');
        }));

        document.querySelectorAll('.pc-ability-uses-minus').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            ab.usesCurrent = Math.max(0, (ab.usesCurrent || 0) - 1);
            saveAndEmit(char); renderSheetData(char);
        }));

        document.querySelectorAll('.pc-ability-uses-plus').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            const current = ab.usesCurrent || 0;
            const max = ab.usesMax || 0;
            if (max > 0) {
                ab.usesCurrent = Math.min(max, current + 1);
                saveAndEmit(char); renderSheetData(char);
            } else {
                ab.usesCurrent = current + 1;
                saveAndEmit(char); renderSheetData(char);
            }
        }));

        document.querySelectorAll('.pc-ability-expand').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const details = document.getElementById(`pc-ability-details-${idx}`);
            if (details) {
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                } else {
                    details.style.display = 'none';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                }
            }
        }));

        document.querySelectorAll('.pc-ability-ping').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            
            let descHtml = ab.description ? ab.description.replace(/\n/g, '<br>') : '';
            if (ab.customFields && ab.customFields.length > 0) {
                if (descHtml) descHtml += '<br><br>';
                ab.customFields.forEach(f => {
                    descHtml += `<b>${f.label}:</b> ${f.entry}<br>`;
                });
            }

            const mc = {
                charName: char.name,
                macroName: ab.name,
                description: descHtml
            };

            if (ab.formula) {
                mc.dmgRolls = [{
                    type: 'Damage',
                    formula: ab.formula,
                    roll: simulateRoll(ab.formula)
                }];
            }

            vtt.socket.emit('chat:msg', {
                macroCard: mc
            });
        }));
    }


    function saveAndEmit(char) {
        if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
        vtt.campaignState.characters[char.id] = char;
        vtt.socket.emit('character:update', { character: char });
        renderCharacterList();
        syncCharHpToTokens(char);
    }

    // Push character HP/TempHP to any linked tokens on the current map
    function syncCharHpToTokens(char) {
        const canvasEngine = window.VTT?.canvasEngine;
        if (!canvasEngine) return;

        const tokens = canvasEngine.getTokens();
        let changed = false;

        Object.values(tokens).forEach(token => {
            if (token.characterId === char.id) {
                token.hp = char.hpCurrent ?? char.hp ?? token.hp;
                token.maxHp = char.hpMax ?? token.maxHp;
                token.tempHp = char.tempHp ?? 0;
                if (char.tokenSight !== undefined) {
                    token.sightRange = char.tokenSight;
                }
                changed = true;
            }
        });

        if (changed) {
            const currentMapId = canvasEngine.getCurrentMapId();
            if (currentMapId) {
                vtt.socket.emit('token:update', { mapId: currentMapId, tokens });
            }
            canvasEngine.renderAll();
        }
    }



    // ─── Socket listeners for multiplayer sync ────────────────────────────────
    if (vtt.socket) {
        vtt.socket.on('character:updated', (data) => {
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[data.character.id] = data.character;
            renderCharacterList();

            if (currentChar && currentChar.id === data.character.id && data.origin !== vtt.socket.id) {
                if (vtt.role !== 'GM' && (!data.character.assignedPlayers || !(data.character.assignedPlayers.includes(vtt.username) || data.character.assignedPlayers.includes('*')))) {
                    closeSheet();
                } else {
                    currentChar = data.character;
                    renderSheetData(currentChar);
                }
            }
        });

        vtt.socket.on('character:deleted', (data) => {
            if (vtt.campaignState.characters && vtt.campaignState.characters[data.id]) {
                delete vtt.campaignState.characters[data.id];
                renderCharacterList();
            }
            if (currentChar && currentChar.id === data.id) {
                closeSheet();
            }
        });

    
    // HP Buttons Event Delegation
    document.addEventListener('click', (e) => {
        if (!currentChar) return;
        if (e.target.closest('#pc-hp-minus')) {
            showVttPrompt('Damage amount:', '1', (val) => {
                if (val === null) return;
                const dmg = parseInt(val || '1');
                if (!isNaN(dmg)) { currentChar.hpCurrent = Math.max(0, currentChar.hpCurrent - dmg); saveAndEmit(currentChar); debouncedRenderSheetData(currentChar); }
            });
        } else if (e.target.closest('#pc-hp-plus')) {
            showVttPrompt('Heal amount:', '1', (val) => {
                if (val === null) return;
                const heal = parseInt(val || '1');
                if (!isNaN(heal)) { currentChar.hpCurrent = Math.min(currentChar.hpMax, currentChar.hpCurrent + heal); saveAndEmit(currentChar); debouncedRenderSheetData(currentChar); }
            });
        } else if (e.target.closest('#pc-temp-hp-minus')) {
            showVttPrompt('Reduce Temp HP by:', '1', (val) => {
                if (val === null) return;
                const dmg = parseInt(val || '1');
                if (!isNaN(dmg)) { currentChar.tempHp = Math.max(0, (currentChar.tempHp || 0) - dmg); saveAndEmit(currentChar); debouncedRenderSheetData(currentChar); }
            });
        } else if (e.target.closest('#pc-temp-hp-plus')) {
            showVttPrompt('Add Temp HP:', '1', (val) => {
                if (val === null) return;
                const add = parseInt(val || '1');
                if (!isNaN(add)) { currentChar.tempHp = (currentChar.tempHp || 0) + add; saveAndEmit(currentChar); debouncedRenderSheetData(currentChar); }
            });
        } else if (e.target.closest('#pc-hero-minus')) {
            if (currentChar) {
                currentChar.heroPoints = Math.max(0, (currentChar.heroPoints || 0) - 1);
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
        } else if (e.target.closest('#pc-hero-plus')) {
            if (currentChar) {
                currentChar.heroPoints = (currentChar.heroPoints || 0) + 1;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
        }
    });

    // Initial render on boot
        vtt.socket.on('campaign:state-sync', (camp) => {
            if (camp.characters) renderCharacterList();
        });
    }

    contentEl.addEventListener('click', (e) => {


        const dcBtn = e.target.closest('.pc-spell-dc-btn');
        if (dcBtn) {
            e.preventDefault();
            const dcVal = dcBtn.dataset.dc;
            const ability = dcBtn.dataset.ability;
            vtt.socket.emit('chat:msg', {
                text: `[${currentChar?.name || 'Player'}] pings Spell DC`,
                abilityCard: {
                    creatureName: currentChar?.name || 'Player',
                    abilityName: "Spell Save DC",
                    text: `<div style="font-size:1.5em; text-align:center; padding: 10px;"><strong>DC ${dcVal}</strong></div>`
                }
            });
            e.stopPropagation();
            return;
        }

        const atkBtn = e.target.closest('.pc-spell-atk-btn');
        if (atkBtn) {
            e.preventDefault();
            const atkVal = atkBtn.dataset.atk;
            const bonusFormula = `1d20${atkVal.startsWith('+') || atkVal.startsWith('-') ? atkVal : '+' + atkVal}`;
            vtt.socket.emit('chat:msg', {
                text: `[${currentChar?.name || 'Player'}] rolls **Spell Attack**`,
                roll: simulateRoll(bonusFormula)
            });
            e.stopPropagation();
            return;
        }

        const chip = e.target.closest('.dice-chip');
        if (chip) {
            const formula = chip.dataset.formula;
            if (chip.classList.contains('dc-chip')) {
                const dcVal = chip.dataset.dc;
                vtt.socket.emit('chat:msg', {
                    text: `[${currentChar?.name || 'Player'}] pings DC ${dcVal}`,
                    abilityCard: {
                        creatureName: currentChar?.name || 'Player',
                        text: `<div style="text-align: center; font-size: 1.8em; margin: 12px 0; color: var(--color-gold-base); font-weight: bold;">DC ${dcVal}</div>`
                    }
                });
            } else if (formula) {
                vtt.socket.emit('chat:msg', {
                    text: `[${currentChar?.name || 'Player'}] rolls **${formula}**`,
                    roll: simulateRoll(formula)
                });
            }
            e.stopPropagation();
            return;
        }

        const quickToggleBtn = e.target.closest('.pc-spell-quick-toggle');
        if (quickToggleBtn) {
            e.preventDefault();
            if (currentChar && currentChar.spellSettings && currentChar.spellSettings.toggles) {
                const idx = quickToggleBtn.dataset.idx;
                currentChar.spellSettings.toggles[idx].enabled = !currentChar.spellSettings.toggles[idx].enabled;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
            e.stopPropagation();
            return;
        }

        const attackQuickToggleBtn = e.target.closest('.pc-attack-quick-toggle');
        if (attackQuickToggleBtn) {
            e.preventDefault();
            if (currentChar && currentChar.attackSettings && currentChar.attackSettings.toggles) {
                const idx = attackQuickToggleBtn.dataset.idx;
                currentChar.attackSettings.toggles[idx].enabled = !currentChar.attackSettings.toggles[idx].enabled;
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
            e.stopPropagation();
            return;
        }

        const attackSettingsBtn = e.target.closest('.pc-attack-settings-btn');
        if (attackSettingsBtn) {
            e.preventDefault();
            if (currentChar && currentChar.attackSettings) {
                document.getElementById('modal-attack-settings-atk').value = currentChar.attackSettings.atkMod || 0;
                document.getElementById('modal-attack-settings-dmg').value = currentChar.attackSettings.dmgMod || 0;
                document.getElementById('modal-attack-settings-dc').value = currentChar.attackSettings.dcMod || 0;
                window.VTTSpellManager?.renderAttackTogglesList();

                document.getElementById('modal-attack-toggle-form')?.classList.add('vtt-hidden');
                document.getElementById('btn-add-attack-toggle')?.classList.remove('vtt-hidden');

                document.getElementById('pc-attack-settings-modal').classList.remove('vtt-hidden');
                document.getElementById('pc-spell-overlay').classList.remove('vtt-hidden');
            }
            e.stopPropagation();
            return;
        }

        const settingsBtn = e.target.closest('.pc-spell-settings-btn');
        if (settingsBtn) {
            e.preventDefault();
            if (currentChar && currentChar.spellSettings) {
                document.getElementById('modal-settings-ability').value = currentChar.spellSettings.ability || currentChar.spellAbility || 'INT';
                document.getElementById('modal-settings-atk').value = currentChar.spellSettings.atkMod || 0;
                document.getElementById('modal-settings-dc').value = currentChar.spellSettings.dcMod || 0;
                document.getElementById('modal-settings-dmg').value = currentChar.spellSettings.dmgMod || 0;
                window.VTTSpellManager?.renderTogglesList();

                // Hide any nested forms and reset toggle editor state
                document.getElementById('modal-toggle-form')?.classList.add('vtt-hidden');
                document.getElementById('btn-add-toggle')?.classList.remove('vtt-hidden');

                document.getElementById('pc-spell-settings-modal').classList.remove('vtt-hidden');
                document.getElementById('pc-spell-overlay').classList.remove('vtt-hidden');
            }
            e.stopPropagation();
            return;
        }

        const tokenPortrait = e.target.closest('#pc-token-portrait');
        if (tokenPortrait) {
            e.preventDefault();
            if (currentChar) {
                // Populate modal fields with current char's settings
                document.getElementById('pc-token-edit-size').value = currentChar.tokenSize || 1;
                document.getElementById('pc-token-edit-sight').value = currentChar.tokenSight !== undefined ? currentChar.tokenSight : 60;

                tempPlayerAurasList = (currentChar.tokenAuras || []).map((a, i) => ({ ...a, isExpanded: i === 0 }));
                renderPlayerAuraList();

                document.getElementById('pc-token-edit-fx-overlay-enabled').checked = !!currentChar.fxOverlayEnabled;
                document.getElementById('pc-token-edit-fx-overlay-opacity').value = currentChar.fxOverlayOpacity !== undefined ? currentChar.fxOverlayOpacity : 0.3;
                document.getElementById('val-pc-fx-overlay-opacity').textContent = `${Math.round((currentChar.fxOverlayOpacity !== undefined ? currentChar.fxOverlayOpacity : 0.3) * 100)}%`;
                document.getElementById('pc-token-edit-fx-overlay-color').value = currentChar.fxOverlayColor || '#007bff';
                if (currentChar.fxOverlayEnabled) document.getElementById('pc-fx-overlay-details').classList.remove('vtt-hidden');
                else document.getElementById('pc-fx-overlay-details').classList.add('vtt-hidden');

                document.getElementById('pc-token-edit-fx-vignette-enabled').checked = !!currentChar.fxVignetteEnabled;
                document.getElementById('pc-token-edit-fx-vignette-opacity').value = currentChar.fxVignetteOpacity !== undefined ? currentChar.fxVignetteOpacity : 0.6;
                document.getElementById('val-pc-fx-vignette-opacity').textContent = `${Math.round((currentChar.fxVignetteOpacity !== undefined ? currentChar.fxVignetteOpacity : 0.6) * 100)}%`;
                document.getElementById('pc-token-edit-fx-vignette-color').value = currentChar.fxVignetteColor || '#000000';
                if (currentChar.fxVignetteEnabled) document.getElementById('pc-fx-vignette-details').classList.remove('vtt-hidden');
                else document.getElementById('pc-fx-vignette-details').classList.add('vtt-hidden');

                document.getElementById('pc-token-edit-fx-shadow-enabled').checked = !!currentChar.fxShadowEnabled;
                document.getElementById('pc-token-edit-fx-shadow-blur').value = currentChar.fxShadowBlur !== undefined ? currentChar.fxShadowBlur : 12;
                document.getElementById('pc-token-edit-fx-shadow-offset').value = currentChar.fxShadowOffset !== undefined ? currentChar.fxShadowOffset : 4;
                document.getElementById('pc-token-edit-fx-shadow-color').value = currentChar.fxShadowColor || '#000000';
                document.getElementById('pc-token-edit-fx-shadow-opacity').value = currentChar.fxShadowOpacity !== undefined ? currentChar.fxShadowOpacity : 0.7;
                document.getElementById('val-pc-fx-shadow-opacity').textContent = `${Math.round((currentChar.fxShadowOpacity !== undefined ? currentChar.fxShadowOpacity : 0.7) * 100)}%`;
                if (currentChar.fxShadowEnabled) document.getElementById('pc-fx-shadow-details').classList.remove('vtt-hidden');
                else document.getElementById('pc-fx-shadow-details').classList.add('vtt-hidden');

                renderPlayerTokenGallery();

                document.getElementById('modal-pc-token-edit').classList.remove('vtt-hidden');
                document.getElementById('modal-pc-token-edit-overlay').classList.remove('vtt-hidden');
            }
            e.stopPropagation();
            return;
        }
    });

    contentEl.addEventListener('dragstart', (e) => {
        const tokenPortrait = e.target.closest('#pc-token-portrait');
        if (tokenPortrait && currentChar) {
            const activeImageUrl = (currentChar.tokenImages && currentChar.tokenImages.length > 0 && currentChar.activeTokenIndex >= 0 && currentChar.activeTokenIndex < currentChar.tokenImages.length)
                ? currentChar.tokenImages[currentChar.activeTokenIndex].url
                : (currentChar.monsterData && typeof window.Renderer !== 'undefined' && window.Renderer.monster ? window.Renderer.monster.getTokenUrl(currentChar.monsterData) : 'favicon.svg');
            const auras = (currentChar.tokenAuras || []).map(a => { const { isExpanded, ...clean } = a; return clean; });

            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'player',
                name: currentChar.name,
                hp: currentChar.hpCurrent,
                maxHp: currentChar.hpMax,
                tempHp: currentChar.tempHp || 0,
                size: currentChar.tokenSize || 1,
                sightRange: currentChar.tokenSight !== undefined ? currentChar.tokenSight : 60,
                img: activeImageUrl,
                characterId: currentChar.id,
                auras: auras,
                lightEnabled: currentChar.tokenLightEnabled,
                lightBright: currentChar.tokenLightBright,
                lightDim: currentChar.tokenLightDim,
                lightColor: currentChar.tokenLightColor,
                fxOverlayEnabled: currentChar.fxOverlayEnabled,
                fxOverlayOpacity: currentChar.fxOverlayOpacity,
                fxOverlayColor: currentChar.fxOverlayColor,
                fxVignetteEnabled: currentChar.fxVignetteEnabled,
                fxVignetteOpacity: currentChar.fxVignetteOpacity,
                fxVignetteColor: currentChar.fxVignetteColor,
                fxShadowEnabled: currentChar.fxShadowEnabled,
                fxShadowBlur: currentChar.fxShadowBlur,
                fxShadowOffset: currentChar.fxShadowOffset,
                fxShadowColor: currentChar.fxShadowColor,
                fxShadowOpacity: currentChar.fxShadowOpacity
            }));
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    // Initial render
    renderCharacterList();

    // ─── Public API ───────────────────────────────────────────────────────────
    return {
        openSheet,
        openPanel,
        minimizePanel,
        closeSheet
    };
}