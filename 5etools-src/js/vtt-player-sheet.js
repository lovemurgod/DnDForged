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
    }

    let isMinimized = false;
    let currentChar = null;
    let spellCache = null;
    let builderCache = null;
    let activeSpellTab = 'cantrip';

    function getDisplaySourceBadge(source) {
        if (!source) return '';
        const s = String(source).toUpperCase().trim();
        if (s === 'PHB') return 'PHB';
        if (s === 'XPHB') return 'XPHB';
        if (s === 'XDMG') return 'XDMG';
        if (s === 'XMM') return 'XMM';
        if (s.startsWith('UA') || s.startsWith('XUA')) return 'UA';
        if (s.includes('PUGILIST')) return 'PUG24';
        if (s.includes('GRIMHOLLOW') || s.includes('GH')) return 'GH';
        if (s.includes('HUMBLEWOOD') || s.includes('HW')) return 'HW';
        if (s.includes('DRAKKENHEIM') || s.includes('DOD')) return 'DoD';
        if (s.includes('TALDOREI')) return 'CR';
        if (s.includes('FLEE') || s.includes('MCDM') || s.includes('ILLRIGGER')) return 'MCDM';
        if (s.includes('KOBOLD') || s.includes('TOB')) return 'KP';
        if (s.includes('GRIFFON')) return 'TGS';
        if (s.includes('VALDA') || s.includes('GUNSLINGER')) return 'VSoS';
        if (s.includes('LOTR')) return 'LotR';
        if (s.includes('CROOKEDMOON')) return 'CM';
        return s.length > 6 ? s.slice(0, 5) : s;
    }

    let builderPromise = null;
    function ensureBuilderCache() {
        if (builderCache) return Promise.resolve(builderCache);
        if (builderPromise) return builderPromise;
        builderPromise = Promise.all([
            fetch('data/races-catalog.json').then(r => r.json()).catch(() => fetch('data/races.json').then(r => r.json()).catch(() => ({}))),
            fetch('data/backgrounds-catalog.json').then(r => r.json()).catch(() => fetch('data/backgrounds.json').then(r => r.json()).catch(() => ({}))),
            fetch('data/classes-catalog.json').then(r => r.json()).catch(() => fetch('data/class/index.json').then(res => res.json()).catch(() => ({}))),
            fetch('data/class/index.json').then(r => r.json()).catch(() => ({}))
        ]).then(([raceData, bgData, classCatalog, classIndex]) => {
            builderCache = {
                races: Array.isArray(raceData) ? raceData : (raceData.race || []),
                bgs: Array.isArray(bgData) ? bgData : (bgData.background || []),
                classes: Array.isArray(classCatalog) ? classCatalog : null,
                classIndex: classIndex || {}
            };
            return builderCache;
        }).catch(err => {
            console.error('[PlayerSheet] Failed loading builderCache:', err);
            return null;
        });
        return builderPromise;
    }

    function getClassHitDie(className) {
        if (!className) return 'd8';
        const name = className.replace(/\s*\[.*?\]$/, '').toLowerCase().trim();
        const standardHitDice = {
            'artificer': 'd8', 'barbarian': 'd12', 'bard': 'd8', 'cleric': 'd8', 'druid': 'd8',
            'fighter': 'd10', 'monk': 'd8', 'paladin': 'd10', 'ranger': 'd10', 'rogue': 'd8',
            'sorcerer': 'd6', 'warlock': 'd8', 'wizard': 'd6', 'blood hunter': 'd10',
            'pugilist': 'd10', 'gunslinger': 'd8', 'illrigger': 'd10', 'psion': 'd6',
            'scholar': 'd8', 'warden': 'd10', 'captain': 'd8', 'messenger': 'd8',
            'tamer': 'd8', 'monster hunter': 'd10', 'treasure hunter': 'd8', 'mystic': 'd8'
        };
        if (standardHitDice[name]) return standardHitDice[name];
        if (builderCache && Array.isArray(builderCache.classes)) {
            const matched = builderCache.classes.find(cls => cls.name.toLowerCase() === name);
            if (matched && matched.hitDie) return matched.hitDie;
        }
        return 'd8';
    }

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

    function getSpellMetaStrings(sp, slKey) {
        if (window.VTTSpellManager && window.VTTSpellManager.getSpellMetaStrings) {
            return window.VTTSpellManager.getSpellMetaStrings(sp, slKey);
        }
        if (!sp || typeof sp !== 'object') return {};
        
        let school = sp.school || '';
        let levelVal = sp.level !== undefined ? sp.level : '';
        let level = '';
        if (levelVal !== undefined && levelVal !== null && levelVal !== '') {
            let levelNum = Number(levelVal);
            if (!isNaN(levelNum)) {
                level = levelNum === 0 ? 'Cantrip' : `Level ${levelNum}`;
            } else {
                level = String(levelVal);
            }
        } else if (slKey) {
            if (slKey === 'cantrip') level = 'Cantrip';
            else if (typeof slKey === 'string' && slKey.startsWith('level')) {
                const num = slKey.replace('level', '');
                level = `Level ${num}`;
            } else {
                level = String(slKey);
            }
        }

        let time = sp.castingTime || '';
        let range = sp.range || '';
        let components = sp.components || '';
        let duration = sp.duration || '';

        return { school, level, time, range, components, duration };
    }

    function cleanSpellHtml(html) {
        if (!html) return '';
        let cleaned = html;
        cleaned = cleaned.replace(/<div class="spell-meta"[^>]*>[\s\S]*?<\/div>/ig, '');
        return cleaned.trim();
    }

    function renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey) {
        if (window.VTTSpellManager && window.VTTSpellManager.renderAndInjectSpell) {
            return window.VTTSpellManager.renderAndInjectSpell(spellName, containerEl, fallbackDesc, sp, slKey);
        }
        let metaHtml = '';
        let meta = getSpellMetaStrings(sp || { name: spellName }, slKey);
        let level = meta.level || (sp?.level !== undefined ? (sp.level === 0 ? 'Cantrips' : sp.level) : '');
        let school = meta.school || sp?.school || '';
        let time = meta.time || sp?.castingTime || '';
        let range = meta.range || sp?.range || '';
        let components = meta.components || sp?.components || '';
        let duration = meta.duration || sp?.duration || '';
        
        metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
        if (level !== undefined && level !== '') metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${level}</div>`;
        if (school) metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${school}</div>`;
        if (time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${time}</div>`;
        if (range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${range}</div>`;
        if (components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${components}</div>`;
        if (duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${duration}</div>`;
        metaHtml += '</div>';

        let rawBody = sp?.description || fallbackDesc || '';
        if (typeof injectDiceChips === 'function') {
            rawBody = injectDiceChips(rawBody);
        }

        if (!rawBody && !metaHtml) {
            containerEl.innerHTML = fallbackDesc ? `<div>${fallbackDesc.replace(/\n/g, '<br>')}</div>` : `<em>Could not find full text for ${spellName}</em>`;
        } else {
            containerEl.innerHTML = metaHtml + rawBody;
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

    let strippedFormula = formula.replace(/\[.*?\]/g, '').trim();
    if (strippedFormula.startsWith('+')) strippedFormula = strippedFormula.slice(1).trim();
    
    if (isAdvantage) strippedFormula = strippedFormula.replace(/^1d20/i, '2d20kh1');
    if (isDisadvantage) strippedFormula = strippedFormula.replace(/^1d20/i, '2d20kl1');

    if (!strippedFormula) {
        return {
            formula,
            diceList: [],
            total: 0,
            breakdownStr: '',
            isCritSuccess: false,
            isCritFail: false
        };
    }

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
        getSpellCache: () => spellCache || (window.VTTSpellManager?.getSpellCache ? window.VTTSpellManager.getSpellCache() : null),
        setSpellCache: (cache) => { spellCache = cache; },
        getSpellMetaStrings: (sp) => getSpellMetaStrings(sp),
        simulateRoll: (formula, crit) => simulateRoll(formula, crit),
        parseSpellToMacro: (spData, newSpell) => window.VTTSpellManager?.parseSpellToMacro(spData, newSpell),
        renderAndInjectSpell: (spellName, containerEl, fallbackDesc, spData) => renderAndInjectSpell(spellName, containerEl, fallbackDesc, spData),
        renderSpellRowHtml: (sp, slKey, idx, isAllTab) => {
            if (window.VTTSpellManager && window.VTTSpellManager.renderSpellRowHtml) {
                return window.VTTSpellManager.renderSpellRowHtml(sp, slKey, idx, { allowEdit: true, isAllTab, classPrefix: 'pc-spell-' });
            }
            if (!sp) return '';
            const spName = typeof sp === 'string' ? sp.replace(/{@spell ([^|}]+).*?}/, '$1') : (sp?.name || 'Unknown');
            const isPrepared = typeof sp === 'object' && sp !== null ? sp.prepared !== false : true;
            const opacity = (!isPrepared && slKey !== 'cantrip' && slKey !== 'legacy') ? 'opacity: 0.6;' : '';
            let badges = '';
            const spText = typeof sp === 'object' && sp !== null ? JSON.stringify(sp).toLowerCase() : String(spName).toLowerCase();
            let isConcentration = typeof sp === 'object' && sp !== null ? sp.concentration : undefined;
            let isRitual = typeof sp === 'object' && sp !== null ? sp.ritual : undefined;

            if (isConcentration === undefined) {
                isConcentration = !!(
                    (typeof sp === 'object' && sp !== null && sp.concentration) ||
                    (typeof sp === 'object' && sp !== null && typeof sp.duration === 'string' && sp.duration.toLowerCase().includes('concentration')) ||
                    (typeof sp === 'object' && sp !== null && Array.isArray(sp.duration) && sp.duration.some(d => d.concentration)) ||
                    spText.includes("concentration")
                );
            }
            if (isRitual === undefined) {
                isRitual = !!(
                    (typeof sp === 'object' && sp !== null && sp.ritual) ||
                    (typeof sp === 'object' && sp !== null && sp.meta && sp.meta.ritual) ||
                    (typeof sp === 'object' && sp !== null && typeof sp.components === 'string' && sp.components.toLowerCase().includes('r')) ||
                    spText.includes("ritual")
                );
            }

            if (isConcentration) {
                badges += `<span class="badge badge-c" style="background:#f44336; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Concentration">C</span>`;
            }
            if (isRitual) {
                badges += `<span class="badge badge-r" style="background:#2196f3; color:#fff; border-radius:4px; padding:2px 4px; font-size:0.6rem; margin-left:4px;" title="Ritual">R</span>`;
            }

            const attrName = spName.toLowerCase().replace(/"/g, '&quot;');

            return `
                <div class="spell-row cs-spell-item glassmorphism" data-spell-name="${attrName}" data-level="${slKey}" data-idx="${idx}" data-prepared="${isPrepared}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s; ${opacity}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="pc-spell-drag-handle" data-level="${slKey}" data-idx="${idx}" title="Click and drag to reorder spell" style="cursor:grab; padding:2px 6px 2px 2px; opacity:0.6; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="if(!this.dataset.disabled){this.style.opacity='1'; this.style.color='var(--color-gold-base)';}" onmouseout="if(!this.dataset.disabled){this.style.opacity='0.6'; this.style.color='inherit';}">
                                <i class="fa-solid fa-grip-vertical" style="font-size:0.85rem;"></i>
                            </div>
                            <div class="pc-spell-prep-toggle" data-level="${slKey}" data-idx="${idx}" style="cursor: pointer; color: var(--color-gold-base); font-size: 0.8rem; display: ${slKey === 'cantrip' || slKey === 'legacy' ? 'none' : 'block'};">
                                <i class="${isPrepared ? 'fa-solid' : 'fa-regular'} fa-circle"></i>
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
                                    <span class="pc-spell-name">${spName}</span>${badges}
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button class="btn btn-xxs btn-secondary pc-spell-edit" data-level="${slKey}" data-idx="${idx}"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                    <div class="pc-spell-details" style="display: none; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.8rem;">
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

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                callback(null);
            }
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
            <div id="pc-assign-players-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-assign-players-modal" class="vtt-sheet-submodal vtt-hidden" style="width:400px;">
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

        document.getElementById('pc-assign-players-overlay').addEventListener('click', closeAssignPlayersModal);
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





    function cleanId(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    }

    function resolveCharClassLevel(char, targetClassName) {
        if (!char || !char.classes || !Array.isArray(char.classes)) return 0;
        const target = (targetClassName || '').replace(/\s*\[.*?\]$/, '').trim().toLowerCase();
        const c = char.classes.find(cl => {
            const raw = (cl.name || '').replace(/\s*\[.*?\]$/, '').trim().toLowerCase();
            return raw === target || (cl.name || '').trim().toLowerCase() === target;
        });
        return c ? (parseInt(c.level) || 1) : 0;
    }

    function evaluateAbilityFormula(formula, formulaConfig, char) {
        if (!char) return formula || '';
        
        if (formulaConfig && typeof formulaConfig === 'object') {
            const base = (formulaConfig.baseDice || '').trim();
            const sc = formulaConfig.scalingMod || 'none';
            const extra = parseInt(formulaConfig.extraBonus) || 0;
            let modVal = 0;
            let hasMod = false;

            if (sc === 'classLevel') {
                const cls = formulaConfig.modClass || (char.classes?.[0]?.name) || '';
                modVal = resolveCharClassLevel(char, cls);
                hasMod = true;
            } else if (sc === 'level') {
                modVal = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
                hasMod = true;
            } else if (sc === 'PB') {
                const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
                modVal = Math.ceil(lvl / 4) + 1;
                hasMod = true;
            } else if (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(sc)) {
                const statKey = sc.toLowerCase();
                modVal = (char.statMods && char.statMods[statKey] !== undefined) ? parseInt(char.statMods[statKey]) : 0;
                hasMod = true;
            }

            let result = base;
            if (hasMod) {
                const sign = modVal >= 0 ? '+' : '';
                result = result ? `${result}${sign}${modVal}` : `${modVal}`;
            }
            if (extra !== 0) {
                const sign = extra >= 0 ? '+' : '';
                result = result ? `${result}${sign}${extra}` : `${extra}`;
            }
            return result.replace(/\s+/g, '').replace(/\+\+/g, '+').replace(/\+-/g, '-');
        }

        if (!formula || typeof formula !== 'string') return '';

        let resolved = formula;
        resolved = resolved.replace(/@classes\.([a-zA-Z0-9_-]+)\.level/gi, (m, cName) => {
            return String(resolveCharClassLevel(char, cName));
        });
        resolved = resolved.replace(/@level/gi, () => {
            const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
            return String(lvl);
        });
        resolved = resolved.replace(/@pb/gi, () => {
            const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
            return String(Math.ceil(lvl / 4) + 1);
        });
        resolved = resolved.replace(/@(str|dex|con|int|wis|cha)/gi, (m, statKey) => {
            const k = statKey.toLowerCase();
            return String((char.statMods && char.statMods[k] !== undefined) ? parseInt(char.statMods[k]) : 0);
        });

        return resolved.replace(/\s+/g, '').replace(/\+\+/g, '+').replace(/\+-/g, '-');
    }

    function evaluateAbilityMaxUses(usesMax, char) {
        if (!usesMax) return 0;
        if (typeof usesMax === 'number') return usesMax;
        const s = String(usesMax).trim().toUpperCase();
        if (s === 'PB') {
            const lvl = char.level || (char.classes || []).reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) || 1;
            return Math.ceil(lvl / 4) + 1;
        }
        if (['CHA', 'WIS', 'INT', 'CON', 'DEX', 'STR'].includes(s)) {
            const modKey = s.toLowerCase();
            return Math.max(1, (char.statMods && char.statMods[modKey] !== undefined) ? parseInt(char.statMods[modKey]) : 1);
        }
        const parsed = parseInt(s);
        return !isNaN(parsed) ? parsed : 1;
    }

    function populateScalingModDropdown(char, selectedVal) {
        const sel = document.getElementById('modal-ability-scaling-mod');
        if (!sel) return;
        let opts = `
            <option value="none">None (+0)</option>
            <option value="level">Character Level (@level)</option>
        `;
        (char.classes || []).forEach(c => {
            if (c.name) {
                const clean = cleanId(c.name);
                opts += `<option value="classLevel:${c.name}">${c.name} Level (@classes.${clean}.level)</option>`;
            }
        });
        opts += `
            <option value="PB">Proficiency Bonus (@pb)</option>
            <option value="STR">STR Mod (@str)</option>
            <option value="DEX">DEX Mod (@dex)</option>
            <option value="CON">CON Mod (@con)</option>
            <option value="INT">INT Mod (@int)</option>
            <option value="WIS">WIS Mod (@wis)</option>
            <option value="CHA">CHA Mod (@cha)</option>
        `;
        sel.innerHTML = opts;
        if (selectedVal) sel.value = selectedVal;
    }

    function updateFormulaBuilderOutputs(char) {
        const base = (document.getElementById('modal-ability-base-dice')?.value || '').trim();
        const sc = document.getElementById('modal-ability-scaling-mod')?.value || 'none';
        const extra = parseInt(document.getElementById('modal-ability-extra-bonus')?.value) || 0;
        
        let fmla = base;
        let modClass = '';
        let scalingMod = sc;

        if (sc.startsWith('classLevel:')) {
            modClass = sc.replace('classLevel:', '');
            scalingMod = 'classLevel';
            const clean = cleanId(modClass);
            if (fmla) fmla += ` + @classes.${clean}.level`;
            else fmla = `@classes.${clean}.level`;
        } else if (sc === 'level') {
            if (fmla) fmla += ` + @level`;
            else fmla = `@level`;
        } else if (sc === 'PB') {
            if (fmla) fmla += ` + @pb`;
            else fmla = `@pb`;
        } else if (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(sc)) {
            if (fmla) fmla += ` + @${sc.toLowerCase()}`;
            else fmla = `@${sc.toLowerCase()}`;
        }

        if (extra !== 0) {
            if (fmla) fmla += (extra > 0 ? ` + ${extra}` : ` - ${Math.abs(extra)}`);
            else fmla = String(extra);
        }

        const formulaInput = document.getElementById('modal-ability-formula');
        if (formulaInput) formulaInput.value = fmla;
        
        const cfg = { baseDice: base, scalingMod, modClass, extraBonus: extra };
        const evalFormula = evaluateAbilityFormula(fmla, cfg, char);
        const previewEl = document.getElementById('modal-ability-formula-preview');
        if (previewEl) previewEl.innerText = evalFormula || 'None';
    }

    function extractTextFromEntries(entries) {
        if (!entries) return '';
        if (typeof entries === 'string') {
            return entries.replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, content) => {
                const parts = content.split('|');
                if (tag === 'dice' || tag === 'damage') return parts[0];
                if (parts.length >= 3 && parts[2]) return parts[2];
                return parts[0];
            });
        }
        if (Array.isArray(entries)) {
            return entries.map(e => extractTextFromEntries(e)).filter(Boolean).join('\n\n');
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

    function getFeatureDescriptionText(f) {
        if (!f) return '';
        if (f.description) return f.description.trim();
        let desc = extractTextFromEntries(f.rawEntries || f.entries).trim();
        if (!desc && f.entriesHtml) {
            desc = f.entriesHtml
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<li>/gi, '- ')
                .replace(/<\/li>/gi, '\n')
                .replace(/<div class="compendium-subentry">(?:<div class="compendium-subentry">)?<strong>(.*?)<\/strong>/gi, '\n**$1**\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }
        return desc;
    }

    function detectFeatureCounter(f, desc, char) {
        let hasCounter = f.hasCounter || false;
        let usesMax = f.usesMax || null;
        let resetType = f.resetType || 'short';

        if (!hasCounter) {
            const plain = ((f.name || '') + ' ' + (desc || '')).toLowerCase();
            const restMatch = plain.match(/(?:can(?:\'t|not))\s+(?:use\s+(?:it|this\s+feature)|do\s+so)\s+again\s+until\s+you\s+finish\s+a\s+(short\s+(?:or\s+long|and\s+long)|short|long)\s+rest/i);
            if (restMatch) {
                hasCounter = true;
                usesMax = 1;
                resetType = restMatch[1].includes('short') ? 'short' : 'long';
            } else if (plain.includes('action surge') || plain.includes('second wind')) {
                hasCounter = true; usesMax = 1; resetType = 'short';
            } else if (plain.includes('bardic inspiration')) {
                hasCounter = true; usesMax = 'CHA'; resetType = 'long';
            } else if (plain.includes('rage') && (f.className === 'Barbarian' || plain.includes('barbarian'))) {
                hasCounter = true; usesMax = 2; resetType = 'long';
            } else if (plain.includes('moxie points') || (f.name && f.name.toLowerCase() === 'moxie')) {
                hasCounter = true;
                const pug = (char?.classes || []).find(c => (c.name || '').toLowerCase() === 'pugilist');
                usesMax = pug ? (parseInt(pug.level) || 1) : (char?.level || 1);
                resetType = 'short';
            } else if (plain.includes('ki points') || plain.includes('focus points') || (f.name && (f.name.toLowerCase() === 'ki' || f.name.toLowerCase() === "monk's focus"))) {
                hasCounter = true;
                const mnk = (char?.classes || []).find(c => (c.name || '').toLowerCase() === 'monk');
                usesMax = mnk ? (parseInt(mnk.level) || 1) : (char?.level || 1);
                resetType = 'short';
            } else if (plain.includes('sorcery points') || (f.name && f.name.toLowerCase() === 'font of magic')) {
                hasCounter = true;
                const src = (char?.classes || []).find(c => (c.name || '').toLowerCase() === 'sorcerer');
                usesMax = src ? (parseInt(src.level) || 2) : (char?.level || 2);
                resetType = 'long';
            } else if (plain.includes('grit points') || (f.name && f.name.toLowerCase().includes('grit'))) {
                hasCounter = true;
                usesMax = 'WIS';
                resetType = 'short';
            } else if (plain.match(/(?:finish|complete) a (?:short or long|short) rest before you can use (?:it|this (?:feature|trait|action)) again/)) {
                hasCounter = true; usesMax = 1; resetType = 'short';
            } else if (plain.match(/(?:finish|complete) a long rest before you can use (?:it|this (?:feature|trait|action)) again/)) {
                hasCounter = true; usesMax = 1; resetType = 'long';
            } else if (plain.match(/proficiency bonus.*?regain/)) {
                hasCounter = true; usesMax = 'PB'; resetType = plain.includes('short rest') ? 'short' : 'long';
            }
        }

        return { hasCounter, usesMax, resetType };
    }

    let availableFeatures = [];
    let currentImportData = [];
    let currentCategory = 'class';
    let pendingImportFeatures = [];
    let selectedImportFeatures = new Map();

    function getFeatureKey(f) {
        if (!f) return '';
        if (f.id) return f.id;
        return `${currentCategory}_${f.name}_${f.source || ''}_${f.level || ''}_${f.subclassShortName || ''}`;
    }

    function switchModalTab(tabId) {
        document.querySelectorAll('#tab-btn-manual, #tab-btn-import').forEach(b => b.classList.remove('active'));
        document.getElementById('modal-tab-manual')?.classList.add('vtt-hidden');
        document.getElementById('modal-tab-import')?.classList.add('vtt-hidden');
        
        document.getElementById(`tab-btn-${tabId}`)?.classList.add('active');
        document.getElementById(`modal-tab-${tabId}`)?.classList.remove('vtt-hidden');
    }

    function getSuggestedCategoryName(features) {
        if (currentCategory === 'class') {
            const classSel = document.getElementById('import-class-sel');
            const className = classSel ? classSel.value : '';
            const subSel = document.getElementById('import-subclass-sel');
            const subName = subSel && subSel.value && subSel.value !== '__base__' ? subSel.options[subSel.selectedIndex]?.text.split('[')[0].trim() : '';

            if (features && features.length === 1 && features[0].subclassShortName) {
                return `Subclass - ${subName || features[0].subclassShortName}`;
            }
            if (subName) {
                return `Subclass - ${subName}`;
            }
            return className ? `Class - ${className}` : 'Class Features';
        }
        if (currentCategory === 'feat') return 'Feats';
        if (currentCategory === 'race') {
            return (features && features.length === 1) ? `Species - ${features[0].name}` : 'Species Traits';
        }
        if (currentCategory === 'background') {
            return (features && features.length === 1) ? `Background - ${features[0].name}` : 'Background Features';
        }
        if (currentCategory === 'charoption') return 'Character Options';
        if (currentCategory === 'optionalfeature') return 'Optional Features';
        return 'Special Features';
    }

    function updateImportBatchButton() {
        const count = selectedImportFeatures.size;
        const countEl = document.getElementById('import-selected-count');
        const btn = document.getElementById('btn-import-batch');
        if (countEl) countEl.innerText = count;
        if (btn) btn.disabled = (count === 0);

        const listEl = document.getElementById('import-feature-list');
        const selectAll = document.getElementById('import-select-all');
        const allChks = listEl ? listEl.querySelectorAll('.import-feature-chk') : [];
        const checkedVisible = listEl ? listEl.querySelectorAll('.import-feature-chk:checked') : [];
        if (selectAll) {
            selectAll.checked = (allChks.length > 0 && checkedVisible.length === allChks.length);
        }
    }

    function promptImportDestinationCategory(features, defaultCatName) {
        pendingImportFeatures = features || [];
        if (pendingImportFeatures.length === 0) return;

        const char = currentChar;
        const modal = document.getElementById('pc-ability-import-cat-modal');
        const overlay = document.getElementById('pc-ability-import-cat-overlay');
        const sel = document.getElementById('import-cat-select');
        const summaryEl = document.getElementById('import-cat-modal-summary');
        const newNameInput = document.getElementById('import-cat-new-name');

        if (!modal || !sel) return;

        if (summaryEl) {
            summaryEl.innerText = `Importing ${pendingImportFeatures.length} item${pendingImportFeatures.length > 1 ? 's' : ''} to character.`;
        }

        let opts = '';
        const suggested = defaultCatName || 'Class Features';
        opts += `<option value="__new__" selected>✨ Create New: "${suggested}"</option>`;
        
        if (char && char.abilityCategories && char.abilityCategories.length > 0) {
            char.abilityCategories.forEach(cat => {
                opts += `<option value="${cat.id}">📁 ${cat.name}</option>`;
            });
        }
        opts += `<option value="__uncategorized__">Uncategorized</option>`;

        sel.innerHTML = opts;
        if (newNameInput) {
            newNameInput.value = suggested;
            newNameInput.style.display = 'block';
        }

        modal.classList.remove('vtt-hidden');
        overlay.classList.remove('vtt-hidden');
    }

    async function populateManualTabWithFeature(f) {
        const rawName = f.name || '';
        const badge = getDisplaySourceBadge(f.source);
        const tag = badge ? ` [${badge}]` : (f.source ? ` [${f.source}]` : '');
        const displayName = (badge && !rawName.includes('[') && !rawName.includes(badge)) ? `${rawName}${tag}` : rawName;
        document.getElementById('modal-ability-name').value = displayName;
        let desc = getFeatureDescriptionText(f);
        if (!desc && f.traits && f.traits.length > 0) {
            desc = f.traits.map(t => `**${t.name}**: ${t.description}`).join('\n\n');
        }
        if (!desc && f.source && f.id) {
            let cType = currentCategory === 'feat' ? 'feats' : (currentCategory === 'race' ? 'races' : (currentCategory === 'background' ? 'backgrounds' : ''));
            if (cType) {
                try {
                    const res = await fetch(`/api/compendium/${cType}/${encodeURIComponent(f.source)}/${encodeURIComponent(f.id)}`);
                    if (res.ok) {
                        const full = await res.json();
                        desc = full.descriptionHtml || full.description || extractTextFromEntries(full.rawEntries || full.entries).trim();
                    }
                } catch(err) {}
            }
        }
        document.getElementById('modal-ability-desc').value = desc;

        // Action type
        const actSel = document.getElementById('modal-ability-action-type');
        if (actSel) {
            let actionType = f.actionType || 'passive';
            if (!f.actionType) {
                const plain = ((f.name || '') + ' ' + desc).toLowerCase();
                if (plain.includes('bonus action')) actionType = 'bonus';
                else if (plain.includes('reaction')) actionType = 'reaction';
                else if (plain.includes('as an action') || plain.includes('action to')) actionType = 'action';
            }
            actSel.value = actionType;
        }

        // Formula & builder
        const char = currentChar;
        let baseDice = '';
        let scalingMod = 'none';
        let extraBonus = 0;
        let formulaStr = f.formula || '';

        if (f.formulaConfig) {
            baseDice = f.formulaConfig.baseDice || '';
            scalingMod = f.formulaConfig.modClass ? `classLevel:${f.formulaConfig.modClass}` : (f.formulaConfig.scalingMod || 'none');
            extraBonus = f.formulaConfig.extraBonus || 0;
        }

        populateScalingModDropdown(char, scalingMod);
        if (document.getElementById('modal-ability-base-dice')) document.getElementById('modal-ability-base-dice').value = baseDice;
        if (document.getElementById('modal-ability-extra-bonus')) document.getElementById('modal-ability-extra-bonus').value = extraBonus;
        if (document.getElementById('modal-ability-formula')) document.getElementById('modal-ability-formula').value = formulaStr;
        
        if (char) {
            const evalFormula = evaluateAbilityFormula(formulaStr, f.formulaConfig, char);
            const previewEl = document.getElementById('modal-ability-formula-preview');
            if (previewEl) previewEl.innerText = evalFormula || 'None';
        }

        // Active resource counter
        const counterInfo = detectFeatureCounter(f, desc, char);
        let hasCounter = counterInfo.hasCounter;
        let usesMax = counterInfo.usesMax;
        let resetType = counterInfo.resetType;

        const counterCheckbox = document.getElementById('modal-ability-has-counter');
        const usesContainer = document.getElementById('modal-ability-uses-container');
        const usesMaxInput = document.getElementById('modal-ability-uses-max');
        const usesCurrentInput = document.getElementById('modal-ability-uses-current');
        const resetSelect = document.getElementById('modal-ability-reset-type');

        if (hasCounter && counterCheckbox) {
            counterCheckbox.checked = true;
            if (usesContainer) usesContainer.style.display = 'flex';
            const resolvedMax = evaluateAbilityMaxUses(usesMax, char);
            if (usesMaxInput) usesMaxInput.value = resolvedMax;
            if (usesCurrentInput) usesCurrentInput.value = resolvedMax;
            if (resetSelect) resetSelect.value = resetType || 'short';
        } else if (counterCheckbox) {
            counterCheckbox.checked = false;
            if (usesContainer) usesContainer.style.display = 'none';
            if (usesMaxInput) usesMaxInput.value = 0;
            if (usesCurrentInput) usesCurrentInput.value = 0;
        }

        switchModalTab('manual');
    }

    function renderImportFeatureList() {
        const listEl = document.getElementById('import-feature-list');
        if (!listEl) return;
        const search = (document.getElementById('import-search')?.value || '').toLowerCase().trim();
        const subSel = document.getElementById('import-subclass-sel')?.value || '';
        const activeEdition = window.activeImportEditionFilter || 'all';

        if (currentImportData.length === 0 && currentCategory === 'class') {
            listEl.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Select a class to browse features</div>';
            updateImportBatchButton();
            return;
        }

        availableFeatures = [];
        
        currentImportData.forEach(f => {
            if (currentCategory === 'class') {
                if (subSel === '__base__') {
                    if (f.subclassShortName) return;
                } else if (subSel) {
                    if (f.subclassShortName !== subSel) return;
                }
            }
            if (activeEdition !== 'all') {
                const src = (f.source || '').toUpperCase();
                if (activeEdition === 'phb' && src !== 'PHB') return;
                if (activeEdition === 'xphb' && !['XPHB', 'XDMG', 'XMM'].includes(src)) return;
            }
            availableFeatures.push(f);
        });

        let html = '';
        availableFeatures.forEach((f, idx) => {
            const rawName = f.name || '';
            const badge = getDisplaySourceBadge(f.source);
            const tag = badge ? ` [${badge}]` : (f.source ? ` [${f.source}]` : '');
            const displayName = (badge && !rawName.includes('[') && !rawName.includes(badge)) ? `${rawName}${tag}` : rawName;
            if (search && !displayName.toLowerCase().includes(search) && !rawName.toLowerCase().includes(search)) return;
            
            const fKey = getFeatureKey(f);
            const isChecked = selectedImportFeatures.has(fKey) ? 'checked' : '';

            const source = f.source ? `[${f.source}]` : '';
            const isSubclass = f.subclassShortName ? `<span style="color:#d4af37; font-weight:600;">[${f.subclassShortName}]</span> ` : '';
            let levelText = f.level !== undefined ? `Lvl ${f.level} • ` : '';

            // Action badge
            let actionBadge = '';
            const act = f.actionType || '';
            if (act === 'bonus') {
                actionBadge = `<span style="font-size:0.65rem; background:rgba(230,126,34,0.25); color:#e67e22; border:1px solid rgba(230,126,34,0.4); padding:1px 5px; border-radius:3px;">Bonus</span>`;
            } else if (act === 'reaction') {
                actionBadge = `<span style="font-size:0.65rem; background:rgba(155,89,182,0.25); color:#9b59b6; border:1px solid rgba(155,89,182,0.4); padding:1px 5px; border-radius:3px;">Reaction</span>`;
            } else if (act === 'action') {
                actionBadge = `<span style="font-size:0.65rem; background:rgba(52,152,219,0.25); color:#3498db; border:1px solid rgba(52,152,219,0.4); padding:1px 5px; border-radius:3px;">Action</span>`;
            }

            // Formula badge
            let formulaBadge = '';
            if (f.formula) {
                formulaBadge = `<span style="font-size:0.65rem; background:rgba(212,175,55,0.2); color:#d4af37; border:1px solid rgba(212,175,55,0.4); padding:1px 5px; border-radius:3px; display:inline-flex; align-items:center; gap:2px;"><i class="fa-solid fa-dice-d20" style="font-size:0.6rem;"></i> ${f.formula}</span>`;
            }

            // Counter badge
            let counterBadge = '';
            if (f.hasCounter) {
                const rTxt = f.resetType === 'short' ? 'SR' : 'LR';
                const uMax = f.usesMax || 1;
                counterBadge = `<span style="font-size:0.65rem; background:rgba(46,204,113,0.2); color:#2ecc71; border:1px solid rgba(46,204,113,0.4); padding:1px 5px; border-radius:3px;">${uMax}/${rTxt}</span>`;
            }

            // Traits badge if species
            let traitsBadge = '';
            if (f.traits && f.traits.length > 0) {
                traitsBadge = `<span style="font-size:0.65rem; background:rgba(41,128,185,0.2); color:#5dade2; border:1px solid rgba(41,128,185,0.4); padding:1px 5px; border-radius:3px;"><i class="fa-solid fa-dna" style="font-size:0.6rem;"></i> ${f.traits.length} Traits</span>`;
            }

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; gap:8px; border:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                        <input type="checkbox" class="import-feature-chk" data-idx="${idx}" data-key="${fKey}" ${isChecked} style="cursor:pointer; flex-shrink:0;">
                        <div style="display:flex; flex-direction:column; overflow:hidden;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-size:0.85rem; font-weight:bold; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
                                ${actionBadge}
                                ${formulaBadge}
                                ${counterBadge}
                                ${traitsBadge}
                            </div>
                            <span style="font-size:0.7rem; color:var(--color-text-muted);">${levelText}${isSubclass}${source}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                        <button class="btn btn-xxs btn-primary btn-import-feature-quick" data-idx="${idx}" title="Quick Import to Category" style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; padding:0;"><i class="fa-solid fa-plus"></i></button>
                        <button class="btn btn-xxs btn-secondary btn-import-feature-exec" data-idx="${idx}" title="Edit before importing"><i class="fa-solid fa-pen-to-square" style="font-size:0.7rem;"></i></button>
                    </div>
                </div>
            `;
        });

        if (!html) {
            html = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">No features found</div>';
        }

        listEl.innerHTML = html;
        updateImportBatchButton();

        // Checkbox changes - update selectedImportFeatures Map
        listEl.querySelectorAll('.import-feature-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const f = availableFeatures[idx];
                if (f) {
                    const key = e.target.dataset.key || getFeatureKey(f);
                    if (e.target.checked) {
                        selectedImportFeatures.set(key, f);
                    } else {
                        selectedImportFeatures.delete(key);
                    }
                }
                updateImportBatchButton();
            });
        });

        // 1-Click quick import
        listEl.querySelectorAll('.btn-import-feature-quick').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const f = availableFeatures[idx];
                if (!f) return;
                if (currentCategory === 'background' || f.skillsData || f.toolsData || f.equipmentData) {
                    promptBackgroundImportModal(f, currentChar);
                    return;
                }
                const defaultCat = getSuggestedCategoryName([f]);
                promptImportDestinationCategory([f], defaultCat);
            });
        });

        // Edit before importing
        listEl.querySelectorAll('.btn-import-feature-exec').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = e.currentTarget.dataset.idx;
                const f = availableFeatures[idx];
                if (!f) return;
                if (currentCategory === 'background' || f.skillsData || f.toolsData || f.equipmentData) {
                    promptBackgroundImportModal(f, currentChar);
                    return;
                }
                populateManualTabWithFeature(f);
            });
        });
    }

    function initializeImportTab() {
        const classSel = document.getElementById('import-class-sel');
        if (!classSel || classSel.options.length > 1) return;
        if (!builderCache) {
            ensureBuilderCache().then(() => initializeImportTab());
            return;
        }

        let opts = '<option value="">-- Select Class --</option>';
        if (builderCache.classes && Array.isArray(builderCache.classes)) {
            const classMap = new Map();
            builderCache.classes.forEach(c => {
                const badge = getDisplaySourceBadge(c.source);
                const tag = badge ? ` [${badge}]` : (c.source ? ` [${c.source}]` : '');
                const fullName = `${c.name}${tag}`;
                if (!classMap.has(fullName)) {
                    classMap.set(fullName, { ...c, fullName, tag });
                }
            });
            Array.from(classMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach(c => {
                opts += `<option value="${c.fullName}" data-id="${c.id}" data-name="${c.name}" data-source="${c.source}">${c.fullName}</option>`;
            });
        } else if (builderCache.classIndex) {
            Object.keys(builderCache.classIndex).forEach(cKey => {
                const name = cKey.charAt(0).toUpperCase() + cKey.slice(1);
                opts += `<option value="${name}">${name}</option>`;
            });
        }
        classSel.innerHTML = opts;

        classSel.addEventListener('change', async () => {
            const selectedOpt = classSel.options[classSel.selectedIndex];
            const classId = selectedOpt?.dataset?.id;
            const classSource = selectedOpt?.dataset?.source;
            const rawClassName = selectedOpt?.dataset?.name || classSel.value.replace(/\s*\[.*?\]$/, '').trim();
            const fullClassName = classSel.value;
            const subSel = document.getElementById('import-subclass-sel');
            if (!fullClassName) {
                currentImportData = [];
                subSel.innerHTML = '<option value="">-- All Subclasses --</option>';
                subSel.disabled = true;
                renderImportFeatureList();
                return;
            }

            currentImportData = [];

            if (builderCache && Array.isArray(builderCache.classes)) {
                let matchedClass = null;
                if (classId) {
                    matchedClass = builderCache.classes.find(c => c.id === classId);
                }
                if (!matchedClass && classSource) {
                    matchedClass = builderCache.classes.find(c => c.name.toLowerCase() === rawClassName.toLowerCase() && (c.source || '').toLowerCase() === classSource.toLowerCase());
                }
                if (!matchedClass) {
                    matchedClass = builderCache.classes.find(c => c.name.toLowerCase() === rawClassName.toLowerCase());
                }
                if (matchedClass) {
                    try {
                        const res = await fetch(`/api/compendium/classes/${encodeURIComponent(matchedClass.source)}/${encodeURIComponent(matchedClass.id)}`);
                        if (res.ok) {
                            const full = await res.json();
                            if (full.features) {
                                full.features.forEach(f => {
                                    f.className = rawClassName;
                                    f.classFullName = fullClassName;
                                    currentImportData.push(f);
                                });
                            }
                            if (full.subclasses) {
                                full.subclasses.forEach(sc => {
                                    (sc.features || []).forEach(f => {
                                        f.className = rawClassName;
                                        f.classFullName = fullClassName;
                                        f.subclassShortName = sc.shortName;
                                        f.subclassName = sc.name;
                                        f.subclassSource = sc.source;
                                        currentImportData.push(f);
                                    });
                                });
                            }

                            let subOpts = '<option value="">-- All Subclasses --</option>';
                            subOpts += '<option value="__base__">[Base Class Features Only]</option>';
                            if (full.subclasses) {
                                full.subclasses.forEach(sc => {
                                    const badge = getDisplaySourceBadge(sc.source);
                                    const tag = badge ? ` [${badge}]` : '';
                                    subOpts += `<option value="${sc.shortName}">${sc.name}${tag}</option>`;
                                });
                            }
                            subSel.innerHTML = subOpts;
                            subSel.disabled = false;
                            renderImportFeatureList();
                            return;
                        }
                    } catch (e) {}
                }
            }

            const file = builderCache?.classIndex ? builderCache.classIndex[rawClassName.toLowerCase()] : null;
            if (!file) {
                renderImportFeatureList();
                return;
            }

            fetch(`data/class/${file}`).then(r => r.json()).then(data => {
                currentImportData = [];
                if (data.classFeature) {
                    data.classFeature.forEach(f => {
                        f.className = className;
                        currentImportData.push(f);
                    });
                }
                if (data.subclassFeature) {
                    data.subclassFeature.forEach(f => {
                        f.className = className;
                        currentImportData.push(f);
                    });
                }
                
                let subOpts = '<option value="">-- All Subclasses --</option>';
                subOpts += '<option value="__base__">[Base Class Features Only]</option>';
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
            }).catch(() => {});
        });
    }

    function ensureAbilityModalsExist() {
        if (document.getElementById('pc-ability-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-ability-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-ability-modal" class="vtt-sheet-submodal vtt-hidden" style="width:480px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-address-card"></i> Ability Card</h3>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-sm btn-secondary active" id="tab-btn-manual" style="border-radius:4px;">Manual Entry</button>
                        <button class="btn btn-sm btn-secondary" id="tab-btn-import" style="border-radius:4px;"><i class="fa-solid fa-cloud-arrow-down"></i> Import Features</button>
                    </div>
                </div>
                
                <input type="hidden" id="modal-ability-idx" value="-1">
                
                <!-- MANUAL ENTRY TAB -->
                <div id="modal-tab-manual">
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <div class="form-group" style="flex:2;">
                            <label>Name</label>
                            <input type="text" id="modal-ability-name" style="width:100%;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Action Economy</label>
                            <select id="modal-ability-action-type" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                                <option value="passive">Passive</option>
                                <option value="action">Action</option>
                                <option value="bonus">Bonus Action</option>
                                <option value="reaction">Reaction</option>
                                <option value="special">Special</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Category</label>
                        <select id="modal-ability-category" style="width:100%; padding:4px; font-size:0.8rem;">
                            <option value="">Uncategorized</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Description</label>
                        <textarea id="modal-ability-desc" placeholder="Details of the ability..." style="width:100%; min-height:56px; resize:vertical; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:6px 8px; font-family:var(--font-primary); font-size:0.8rem; border-radius:4px; line-height:1.4;"></textarea>
                    </div>

                    <!-- FORMULA BUILDER SECTION -->
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--color-border-subtle); border-radius:6px; padding:8px; margin-bottom:8px;">
                        <label style="font-weight:600; color:var(--color-gold-base); font-size:0.8rem; margin-bottom:6px; display:block;">
                            <i class="fa-solid fa-dice-d20"></i> Dice Formula Builder
                        </label>
                        <div style="display:flex; gap:6px; margin-bottom:6px;">
                            <div style="flex:1;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Base Dice</label>
                                <input type="text" id="modal-ability-base-dice" placeholder="e.g. 1d10, 2d6" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            </div>
                            <div style="flex:1.6;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Scaling Modifier</label>
                                <select id="modal-ability-scaling-mod" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                                    <option value="none">None (+0)</option>
                                    <option value="level">Character Level (@level)</option>
                                    <option value="PB">Proficiency Bonus (@pb)</option>
                                    <option value="STR">STR Mod (@str)</option>
                                    <option value="DEX">DEX Mod (@dex)</option>
                                    <option value="CON">CON Mod (@con)</option>
                                    <option value="INT">INT Mod (@int)</option>
                                    <option value="WIS">WIS Mod (@wis)</option>
                                    <option value="CHA">CHA Mod (@cha)</option>
                                </select>
                            </div>
                            <div style="flex:0.8;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Extra Bonus</label>
                                <input type="number" id="modal-ability-extra-bonus" value="0" style="width:100%; padding:4px; font-size:0.8rem; text-align:center; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:flex-end;">
                            <div style="flex:1;">
                                <label style="font-size:0.7rem; color:var(--color-text-muted);">Formula String</label>
                                <input type="text" id="modal-ability-formula" placeholder="e.g. 1d10 + @classes.fighter.level" style="width:100%; padding:4px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                            </div>
                            <div style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); padding:4px 8px; border-radius:4px; min-width:110px; text-align:center;">
                                <span style="font-size:0.65rem; color:var(--color-text-muted); display:block;">Live Evaluation</span>
                                <span id="modal-ability-formula-preview" style="font-size:0.82rem; font-family:monospace; color:var(--color-gold-base); font-weight:bold;">None</span>
                            </div>
                        </div>
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
                        <div class="form-group" style="flex:1.2;">
                            <label>Reset On</label>
                            <select id="modal-ability-reset-type" style="width:100%; padding:4px; font-size:0.8rem; height:29px; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                                <option value="long">Long Rest</option>
                                <option value="short">Short Rest</option>
                                <option value="none">None / Manual</option>
                            </select>
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
                            <button class="btn btn-primary btn-sm" id="modal-ability-save"><i class="fa-solid fa-floppy-disk"></i> Save Card</button>
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
                            <option value="background">Backgrounds</option>
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
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="text" id="import-search" placeholder="Search features..." style="flex:1; padding:4px; font-size:0.8rem; background:#2a2a2a; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                        <div class="btn-group" id="import-edition-filter-group" style="display:inline-flex; border-radius:4px; overflow:hidden; border:1px solid var(--color-border-subtle); flex-shrink:0;">
                            <button type="button" class="btn btn-xxs import-filter-edition active" data-edition="all" style="padding:4px 8px; font-size:0.75rem; background:var(--color-gold-base); color:#000; font-weight:bold;">All</button>
                            <button type="button" class="btn btn-xxs import-filter-edition" data-edition="phb" style="padding:4px 8px; font-size:0.75rem; background:#2a2a2a; color:var(--color-text-secondary);">PHB</button>
                            <button type="button" class="btn btn-xxs import-filter-edition" data-edition="xphb" style="padding:4px 8px; font-size:0.75rem; background:#2a2a2a; color:var(--color-text-secondary);">XPHB</button>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="checkbox" id="import-select-all" style="cursor:pointer;">
                            <label for="import-select-all" style="margin:0; font-size:0.75rem; cursor:pointer; color:var(--color-text-muted);">Select All</label>
                        </div>
                        <button class="btn btn-xs btn-primary" id="btn-import-batch" disabled style="display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-file-import"></i> Import Selected (<span id="import-selected-count">0</span>)</button>
                    </div>
                    <div id="import-feature-list" style="flex:1; min-height:220px; max-height:320px; overflow-y:auto; background:rgba(0,0,0,0.2); border:1px solid var(--color-border-subtle); border-radius:4px; padding:8px; display:flex; flex-direction:column; gap:4px;">
                        <div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Select a class to browse features</div>
                    </div>
                </div>
            </div>

            <!-- IMPORT DESTINATION CATEGORY PROMPT MODAL -->
            <div id="pc-ability-import-cat-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden"></div>
            <div id="pc-ability-import-cat-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="width:380px; padding:16px;">
                <h4 style="margin:0; color:var(--color-gold-base); font-size:0.95rem; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-folder-tree"></i> Import Destination Category</h4>
                <div style="font-size:0.8rem; color:var(--color-text-secondary);" id="import-cat-modal-summary">Importing features to character.</div>
                <div class="form-group" style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:0.75rem; color:var(--color-text-muted);">Choose Category:</label>
                    <select id="import-cat-select" style="width:100%; padding:6px; font-size:0.82rem; background:#181818; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
                    </select>
                    <input type="text" id="import-cat-new-name" placeholder="Enter new category name..." style="width:100%; padding:6px; font-size:0.82rem; background:#181818; color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px; display:none; margin-top:4px;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                    <button class="btn btn-secondary btn-sm" id="btn-import-cat-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="btn-import-cat-confirm"><i class="fa-solid fa-check"></i> Import</button>
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

        // Formula builder change listeners
        ['modal-ability-base-dice', 'modal-ability-scaling-mod', 'modal-ability-extra-bonus'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                if (currentChar) updateFormulaBuilderOutputs(currentChar);
            });
            document.getElementById(id)?.addEventListener('change', () => {
                if (currentChar) updateFormulaBuilderOutputs(currentChar);
            });
        });

        document.getElementById('modal-ability-formula')?.addEventListener('input', () => {
            if (currentChar) {
                const raw = document.getElementById('modal-ability-formula').value.trim();
                const evalFormula = evaluateAbilityFormula(raw, null, currentChar);
                const previewEl = document.getElementById('modal-ability-formula-preview');
                if (previewEl) previewEl.innerText = evalFormula || 'None';
            }
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
            const actionType = document.getElementById('modal-ability-action-type')?.value || 'passive';
            const categoryId = document.getElementById('modal-ability-category')?.value || null;
            const description = document.getElementById('modal-ability-desc').value.trim();
            
            const baseDice = (document.getElementById('modal-ability-base-dice')?.value || '').trim();
            const sc = document.getElementById('modal-ability-scaling-mod')?.value || 'none';
            let modClass = '';
            let scalingMod = sc;
            if (sc.startsWith('classLevel:')) {
                modClass = sc.replace('classLevel:', '');
                scalingMod = 'classLevel';
            }
            const extraBonus = parseInt(document.getElementById('modal-ability-extra-bonus')?.value) || 0;
            const formula = document.getElementById('modal-ability-formula').value.trim();
            const formulaConfig = (baseDice || scalingMod !== 'none' || extraBonus !== 0) ? {
                baseDice,
                scalingMod,
                modClass,
                extraBonus
            } : null;

            const hasCounter = document.getElementById('modal-ability-has-counter').checked;
            const usesCurrent = parseInt(document.getElementById('modal-ability-uses-current').value) || 0;
            const usesMax = parseInt(document.getElementById('modal-ability-uses-max').value) || 0;
            const resetType = document.getElementById('modal-ability-reset-type')?.value || 'long';
            
            const customFields = [];
            document.querySelectorAll('.modal-ability-field-row').forEach(row => {
                const label = row.querySelector('.ab-field-label').value.trim();
                const entry = row.querySelector('.ab-field-entry').value.trim();
                if (label || entry) customFields.push({ label, entry });
            });

            const ab = { 
                id: (idx >= 0 && char.abilityCards && char.abilityCards[idx] ? char.abilityCards[idx].id : 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)), 
                name, actionType, categoryId, description, formula, formulaConfig, customFields, hasCounter, usesCurrent, usesMax, resetType 
            };

            if (idx >= 0 && char.abilityCards && char.abilityCards[idx]) {
                char.abilityCards[idx] = ab;
            } else {
                if (!char.abilityCards) char.abilityCards = [];
                char.abilityCards.push(ab);
            }

            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
            saveAndEmit(char); renderSheetData(char);
        });

        document.getElementById('modal-ability-delete')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char) return;
            const idx = parseInt(document.getElementById('modal-ability-idx').value);
            if (idx >= 0 && char.abilityCards && char.abilityCards[idx]) {
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
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('pc-ability-overlay')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');
        });

        // Tab switching
        document.getElementById('tab-btn-manual')?.addEventListener('click', () => switchModalTab('manual'));
        document.getElementById('tab-btn-import')?.addEventListener('click', () => switchModalTab('import'));

        // Import filters
        document.getElementById('import-search')?.addEventListener('input', renderImportFeatureList);
        document.getElementById('import-subclass-sel')?.addEventListener('change', renderImportFeatureList);

        document.getElementById('import-category-sel')?.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            selectedImportFeatures.clear();
            updateImportBatchButton();
            const classFilters = document.getElementById('import-class-filters');
            currentImportData = [];
            const searchInput = document.getElementById('import-search');
            if (searchInput) searchInput.value = '';
            
            if (currentCategory === 'class') {
                if (classFilters) classFilters.style.display = 'flex';
                const classSel = document.getElementById('import-class-sel');
                if (classSel) classSel.value = '';
                const subSel = document.getElementById('import-subclass-sel');
                if (subSel) {
                    subSel.innerHTML = '<option value="">-- All Subclasses --</option>';
                    subSel.disabled = true;
                }
                renderImportFeatureList();
            } else {
                if (classFilters) classFilters.style.display = 'none';
                let file = '';
                let key = '';
                let fallback = '';
                if (currentCategory === 'feat') { file = 'data/feats-catalog.json'; key = 'feat'; fallback = 'data/feats.json'; }
                if (currentCategory === 'race') { file = 'data/races-catalog.json'; key = 'race'; fallback = 'data/races.json'; }
                if (currentCategory === 'background') { file = 'data/backgrounds-catalog.json'; key = 'background'; fallback = 'data/backgrounds.json'; }
                if (currentCategory === 'charoption') { file = 'data/charcreationoptions.json'; key = 'charoption'; }
                if (currentCategory === 'optionalfeature') { file = 'data/optionalfeatures.json'; key = 'optionalfeature'; }
                
                const listEl = document.getElementById('import-feature-list');
                if (listEl) listEl.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.8rem; margin-top:20px;">Loading...</div>';
                
                fetch(file).then(r => {
                    if (!r.ok) throw new Error('Not found');
                    return r.json();
                }).then(data => {
                    currentImportData = Array.isArray(data) ? data : (data[key] || []);
                    renderImportFeatureList();
                }).catch(() => {
                    if (fallback) {
                        fetch(fallback).then(r => r.json()).then(data => {
                            currentImportData = Array.isArray(data) ? data : (data[key] || []);
                            renderImportFeatureList();
                        }).catch(() => {
                            if (listEl) listEl.innerHTML = '<div style="text-align:center; color:var(--color-error); font-size:0.8rem; margin-top:20px;">Failed to load data</div>';
                        });
                    } else {
                        if (listEl) listEl.innerHTML = '<div style="text-align:center; color:var(--color-error); font-size:0.8rem; margin-top:20px;">Failed to load data</div>';
                    }
                });
            }
        });

        // Edition filter buttons & search listener in Import tab
        document.querySelectorAll('.import-filter-edition').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.import-filter-edition').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#2a2a2a';
                    b.style.color = 'var(--color-text-secondary)';
                    b.style.fontWeight = 'normal';
                });
                const t = e.currentTarget;
                t.classList.add('active');
                t.style.background = 'var(--color-gold-base)';
                t.style.color = '#000';
                t.style.fontWeight = 'bold';
                window.activeImportEditionFilter = t.dataset.edition || 'all';
                renderImportFeatureList();
            });
        });

        document.getElementById('import-search')?.addEventListener('input', () => {
            renderImportFeatureList();
        });

        // Batch selection
        document.getElementById('import-select-all')?.addEventListener('change', (e) => {
            const listEl = document.getElementById('import-feature-list');
            if (!listEl) return;
            const chks = listEl.querySelectorAll('.import-feature-chk');
            chks.forEach(chk => {
                chk.checked = e.target.checked;
                const idx = parseInt(chk.dataset.idx);
                const f = availableFeatures[idx];
                if (f) {
                    const key = chk.dataset.key || getFeatureKey(f);
                    if (e.target.checked) {
                        selectedImportFeatures.set(key, f);
                    } else {
                        selectedImportFeatures.delete(key);
                    }
                }
            });
            updateImportBatchButton();
        });

        document.getElementById('btn-import-batch')?.addEventListener('click', () => {
            const selectedFeatures = Array.from(selectedImportFeatures.values());
            if (selectedFeatures.length === 0) return;
            if (selectedFeatures.length === 1 && (currentCategory === 'background' || selectedFeatures[0].skillsData || selectedFeatures[0].toolsData || selectedFeatures[0].equipmentData)) {
                promptBackgroundImportModal(selectedFeatures[0], currentChar);
                return;
            }
            const defaultCat = getSuggestedCategoryName(selectedFeatures);
            promptImportDestinationCategory(selectedFeatures, defaultCat);
        });

        // Category modal listeners
        document.getElementById('import-cat-select')?.addEventListener('change', (e) => {
            const newNameInput = document.getElementById('import-cat-new-name');
            if (newNameInput) {
                newNameInput.style.display = (e.target.value === '__new__') ? 'block' : 'none';
                if (e.target.value === '__new__') newNameInput.focus();
            }
        });

        document.getElementById('btn-import-cat-cancel')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-import-cat-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-import-cat-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('pc-ability-import-cat-overlay')?.addEventListener('click', () => {
            selectedImportFeatures.clear();
            updateImportBatchButton();
            document.getElementById('pc-ability-import-cat-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-import-cat-overlay').classList.add('vtt-hidden');
        });

        document.getElementById('btn-import-cat-confirm')?.addEventListener('click', () => {
            const char = currentChar;
            if (!char || pendingImportFeatures.length === 0) return;

            const sel = document.getElementById('import-cat-select');
            const newNameInput = document.getElementById('import-cat-new-name');
            const selVal = sel ? sel.value : '__uncategorized__';

            let targetCatId = null;
            if (selVal === '__new__') {
                const catName = (newNameInput ? newNameInput.value.trim() : '') || 'Imported Features';
                if (!char.abilityCategories) char.abilityCategories = [];
                let existing = char.abilityCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                if (existing) {
                    targetCatId = existing.id;
                } else {
                    targetCatId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                    char.abilityCategories.push({
                        id: targetCatId,
                        name: catName,
                        collapsed: false
                    });
                }
            } else if (selVal !== '__uncategorized__') {
                targetCatId = selVal;
            }

            if (!char.abilityCards) char.abilityCards = [];

            pendingImportFeatures.forEach((f, i) => {
                // If item is a Species with pre-unpacked traits in database, unpack into separate cards
                if (Array.isArray(f.traits) && f.traits.length > 0) {
                    f.traits.forEach((t, ti) => {
                        const desc = (t.description || '').trim();
                        const actionType = t.actionType || 'passive';
                        const hasCounter = t.hasCounter || false;
                        const usesMax = t.usesMax || null;
                        const resetType = t.resetType || 'short';
                        const resolvedMax = hasCounter ? evaluateAbilityMaxUses(usesMax, char) : 0;
                        const formula = t.formula || '';
                        const formulaConfig = t.formulaConfig || null;

                        char.abilityCards.push({
                            id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + i + '_' + ti,
                            name: t.name || `${f.name} Trait`,
                            actionType,
                            categoryId: targetCatId,
                            description: desc,
                            formula,
                            formulaConfig,
                            customFields: [],
                            hasCounter,
                            usesCurrent: resolvedMax,
                            usesMax: resolvedMax,
                            resetType
                        });
                    });
                } else if (f.skillsData || f.toolsData || f.equipmentData) {
                    // Background imported via multi-batch category prompt
                    char.background = char.background || f.name;
                    const appliedSkills = [];
                    if (f.skillsData && f.skillsData.fixed) {
                        char.skills = char.skills || {};
                        f.skillsData.fixed.forEach(s => {
                            const norm = normalizeSkill(s);
                            if (norm) { char.skills[norm] = true; appliedSkills.push(norm); }
                        });
                    }
                    const appliedTools = [];
                    if (f.toolsData && f.toolsData.fixed) {
                        char.tools = char.tools || {};
                        f.toolsData.fixed.forEach(t => {
                            const norm = normalizeTool(t);
                            if (norm) {
                                const defTool = STANDARD_TOOLS.find(st => st.name.toLowerCase() === norm.toLowerCase());
                                const ab = defTool ? defTool.ability : 'dex';
                                char.tools[norm] = { ability: ab, show: true, prof: true, exp: false, mod: "0", custom: !defTool };
                                appliedTools.push(norm);
                            }
                        });
                    }
                    const appliedItems = [];
                    let addedGold = 0;
                    if (f.equipmentData) {
                        char.equipment = Array.isArray(char.equipment) ? char.equipment : [];
                        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                        if (f.equipmentData.fixedGold) {
                            addedGold = f.equipmentData.fixedGold;
                            char.currency.gp = (char.currency.gp || 0) + addedGold;
                        }
                        if (Array.isArray(f.equipmentData.fixedItems)) {
                            f.equipmentData.fixedItems.forEach(it => {
                                const itemName = it.name ? it.name.trim() : 'Item';
                                const itemQty = parseInt(it.quantity) || 1;
                                char.equipment.push({
                                    id: 'eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                                    name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
                                    qty: itemQty,
                                    weight: parseFloat(it.weight) || 0,
                                    containerId: null,
                                    description: ''
                                });
                                appliedItems.push(itemQty > 1 ? `${itemQty}x ${itemName}` : itemName);
                            });
                        }
                    }

                    // Card 1: Feature cards
                    const bgFeatures = (Array.isArray(f.features) && f.features.length > 0) ? f.features : [
                        { name: `Feature: ${f.name}`, description: f.description || '' }
                    ];
                    bgFeatures.forEach((feat, fi) => {
                        char.abilityCards.push({
                            id: 'ab_bg_feat_' + Date.now() + '_' + i + '_' + fi,
                            name: feat.name || `Feature: ${f.name}`,
                            actionType: 'passive',
                            categoryId: targetCatId,
                            description: feat.description || '',
                            formula: '',
                            formulaConfig: null,
                            customFields: [],
                            hasCounter: false,
                            usesCurrent: 0,
                            usesMax: 0,
                            resetType: 'none'
                        });
                    });

                    // Card 2: Summary card
                    let summaryDesc = `**Background:** ${f.name} [${f.source || 'PHB'}]\n\n`;
                    summaryDesc += `**Skill Proficiencies:** ${appliedSkills.length > 0 ? appliedSkills.join(', ') : 'None'}\n`;
                    summaryDesc += `**Tool Proficiencies:** ${appliedTools.length > 0 ? appliedTools.join(', ') : 'None'}\n`;
                    if (f.languages) summaryDesc += `**Languages:** ${f.languages}\n`;
                    summaryDesc += `**Starting Equipment:** ${appliedItems.length > 0 ? appliedItems.join(', ') : 'None'} (${addedGold} gp)\n\n`;
                    if (f.description) {
                        const cleanDesc = f.description.replace(/^#+\s+/gm, '').trim().slice(0, 500);
                        summaryDesc += cleanDesc + (f.description.length > 500 ? '...' : '');
                    }

                    char.abilityCards.push({
                        id: 'ab_bg_summary_' + Date.now() + '_' + i,
                        name: `Background: ${f.name}`,
                        actionType: 'passive',
                        categoryId: targetCatId,
                        description: summaryDesc,
                        formula: '',
                        formulaConfig: null,
                        customFields: [],
                        hasCounter: false,
                        usesCurrent: 0,
                        usesMax: 0,
                        resetType: 'none'
                    });
                } else {
                    // Regular single feature / feat / background
                    let desc = getFeatureDescriptionText(f);
                    
                    const counterInfo = detectFeatureCounter(f, desc, char);
                    let hasCounter = counterInfo.hasCounter;
                    let usesMax = counterInfo.usesMax;
                    let resetType = counterInfo.resetType;

                    let resolvedMax = 0;
                    let resolvedCurrent = 0;
                    if (hasCounter) {
                        resolvedMax = evaluateAbilityMaxUses(usesMax, char);
                        resolvedCurrent = resolvedMax;
                    }

                    let actionType = f.actionType || 'passive';
                    if (!f.actionType) {
                        const plain = ((f.name || '') + ' ' + desc).toLowerCase();
                        if (plain.includes('bonus action')) actionType = 'bonus';
                        else if (plain.includes('reaction')) actionType = 'reaction';
                        else if (plain.includes('as an action') || plain.includes('action to')) actionType = 'action';
                    }

                    let formula = f.formula || '';
                    let formulaConfig = f.formulaConfig || null;

                    const rawName = f.name || 'Untitled Ability';
                    const badge = getDisplaySourceBadge(f.source);
                    const tag = badge ? ` [${badge}]` : (f.source ? ` [${f.source}]` : '');
                    const cardName = (badge && !rawName.includes('[') && !rawName.includes(badge)) ? `${rawName}${tag}` : rawName;

                    char.abilityCards.push({
                        id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + i,
                        name: cardName,
                        actionType,
                        categoryId: targetCatId,
                        description: desc,
                        formula,
                        formulaConfig,
                        customFields: [],
                        hasCounter,
                        usesCurrent: resolvedCurrent,
                        usesMax: resolvedMax,
                        resetType
                    });
                }
            });

            selectedImportFeatures.clear();
            updateImportBatchButton();

            document.getElementById('pc-ability-import-cat-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-import-cat-overlay').classList.add('vtt-hidden');
            document.getElementById('pc-ability-modal').classList.add('vtt-hidden');
            document.getElementById('pc-ability-overlay').classList.add('vtt-hidden');

            pendingImportFeatures = [];
            saveAndEmit(char);
            renderSheetData(char);
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
            document.getElementById('pc-save-settings-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-save-settings-overlay')?.classList.add('vtt-hidden');
        });

        document.getElementById('modal-save-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-save-settings-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-save-settings-overlay')?.classList.add('vtt-hidden');
        });
        document.getElementById('pc-save-settings-overlay')?.addEventListener('click', () => {
            document.getElementById('pc-save-settings-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-save-settings-overlay')?.classList.add('vtt-hidden');
        });
    }

    function ensureSaveSettingsModalExists() {
        if (document.getElementById('pc-save-settings-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-save-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-save-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:500px;">
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

    const SKILL_NAMES_MASTER = [
        'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
        'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
        'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
        'Sleight of Hand', 'Stealth', 'Survival'
    ];

    function normalizeSkill(s) {
        if (!s) return '';
        const found = SKILL_NAMES_MASTER.find(x => x.toLowerCase() === s.trim().toLowerCase());
        return found || s.trim();
    }

    function normalizeTool(t) {
        if (!t) return '';
        const clean = t.trim();
        if (/vehicles?\s*\(\s*water\s*\)/i.test(clean)) return 'Water Vehicles';
        if (/vehicles?\s*\(\s*land\s*\)/i.test(clean)) return 'Land Vehicles';
        if (/thieves'?\s*tools?/i.test(clean)) return "Thieves' Tools";
        if (/navigator'?s?\s*tools?/i.test(clean)) return "Navigator's Tools";
        if (/cartographer'?s?\s*tools?/i.test(clean)) return "Cartographer's Tools";
        if (/cook'?s?\s*utensils?/i.test(clean)) return "Cook's Utensils";
        if (/alchemist'?s?\s*supplies?/i.test(clean)) return "Alchemist's Supplies";
        if (/brewer'?s?\s*supplies?/i.test(clean)) return "Brewer's Supplies";
        if (/calligrapher'?s?\s*supplies?/i.test(clean)) return "Calligrapher's Supplies";
        if (/carpenter'?s?\s*tools?/i.test(clean)) return "Carpenter's Tools";
        if (/cobbler'?s?\s*tools?/i.test(clean)) return "Cobbler's Tools";
        if (/glassblower'?s?\s*tools?/i.test(clean)) return "Glassblower's Tools";
        if (/herbalism\s*kit/i.test(clean)) return "Herbalism Kit";
        if (/jeweler'?s?\s*tools?/i.test(clean)) return "Jeweler's Tools";
        if (/leatherworker'?s?\s*tools?/i.test(clean)) return "Leatherworker's Tools";
        if (/mason'?s?\s*tools?/i.test(clean)) return "Mason's Tools";
        if (/painter'?s?\s*supplies?/i.test(clean)) return "Painter's Supplies";
        if (/poisoner'?s?\s*kit/i.test(clean)) return "Poisoner's Kit";
        if (/potter'?s?\s*tools?/i.test(clean)) return "Potter's Tools";
        if (/smith'?s?\s*tools?/i.test(clean)) return "Smith's Tools";
        if (/tinker'?s?\s*tools?/i.test(clean)) return "Tinker's Tools";
        if (/weaver'?s?\s*tools?/i.test(clean)) return "Weaver's Tools";
        if (/woodcarver'?s?\s*tools?/i.test(clean)) return "Woodcarver's Tools";
        if (/disguise\s*kit/i.test(clean)) return "Disguise Kit";
        if (/forgery\s*kit/i.test(clean)) return "Forgery Kit";
        return clean;
    }

    function expandToolOptions(fromList) {
        const ARTISAN_TOOLS = [
            "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
            "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
            "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
            "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
            "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools"
        ];
        const GAMING_SETS = ["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set"];
        const MUSICAL_INSTRUMENTS = ["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol"];

        const res = [];
        (fromList || []).forEach(f => {
            if (/AnyArtisansTools?|Artisan's Tools/i.test(f)) {
                res.push(...ARTISAN_TOOLS);
            } else if (/AnyGamingSet|Gaming Set/i.test(f)) {
                res.push(...GAMING_SETS);
            } else if (/Musical Instrument/i.test(f)) {
                res.push(...MUSICAL_INSTRUMENTS);
            } else {
                res.push(normalizeTool(f));
            }
        });
        return Array.from(new Set(res));
    }

    function ensureBackgroundImportModalExists() {
        if (document.getElementById('pc-bg-import-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-bg-import-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-bg-import-modal" class="vtt-sheet-submodal vtt-hidden" style="width:580px;">
                <div style="padding:14px 18px; border-bottom:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-scroll text-gradient-gold" style="font-size:1.3rem;"></i>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="bg-import-modal-title">
                                Import Background
                            </h3>
                            <span id="bg-import-modal-source" class="badge" style="background:rgba(212,175,55,0.15); color:var(--color-gold-light); font-size:0.7rem; border:1px solid rgba(212,175,55,0.3); padding:1px 6px; border-radius:4px;">PHB</span>
                        </div>
                    </div>
                    <button id="bg-import-modal-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;" title="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div style="padding:16px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; flex:1;" class="scroll-styled" id="bg-import-modal-body">
                </div>

                <div style="padding:12px 18px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.35);">
                    <button id="bg-import-modal-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                    <button id="bg-import-modal-apply" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-check"></i> Apply to Character</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    function promptBackgroundImportModal(bgData, char, onCancel, onApplied) {
        if (!bgData || !char) return;
        ensureBackgroundImportModalExists();

        const modal = document.getElementById('pc-bg-import-modal');
        const overlay = document.getElementById('pc-bg-import-overlay');
        const titleEl = document.getElementById('bg-import-modal-title');
        const sourceEl = document.getElementById('bg-import-modal-source');
        const bodyEl = document.getElementById('bg-import-modal-body');

        if (!modal || !overlay || !bodyEl) return;

        titleEl.innerText = bgData.name || 'Background';
        if (sourceEl) sourceEl.innerText = bgData.source || 'PHB';

        const skillsData = bgData.skillsData || { fixed: [], choose: null };
        const toolsData = bgData.toolsData || { fixed: [], choose: null };
        const equipData = bgData.equipmentData || { fixedItems: [], fixedGold: 0, choiceSets: [] };
        const features = bgData.features || [];

        // 1. Overview description snippet
        let descSnippet = '';
        if (bgData.description) {
            const clean = bgData.description.replace(/^#+\s+/gm, '').trim();
            const firstPara = clean.split('\n\n')[0] || '';
            if (firstPara) {
                descSnippet = `<div style="font-size:0.8rem; color:var(--color-text-secondary); line-height:1.4; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:8px 12px; border-radius:6px;">${firstPara.slice(0, 300)}${firstPara.length > 300 ? '...' : ''}</div>`;
            }
        }

        // 2. Skill Proficiencies HTML
        const fixedSkills = (skillsData.fixed || []).map(normalizeSkill);
        const skillBadges = fixedSkills.map(s => `
            <span style="background:rgba(46,204,113,0.15); border:1px solid rgba(46,204,113,0.4); color:#2ecc71; padding:3px 8px; border-radius:4px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-check"></i> ${s}
            </span>
        `).join('');

        let chooseSkillHtml = '';
        if (skillsData.choose && Array.isArray(skillsData.choose.from)) {
            const count = skillsData.choose.count || 1;
            const fromSkills = skillsData.choose.from.map(normalizeSkill);
            chooseSkillHtml = `
                <div style="margin-top:6px;">
                    <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px;">
                        Choose <strong style="color:var(--color-gold-base);">${count}</strong> skill${count > 1 ? 's' : ''}:
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;" class="bg-skill-choice-group" data-count="${count}">
                        ${fromSkills.map((s, idx) => `
                            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:4px 8px; border-radius:4px; margin:0;">
                                <input type="checkbox" class="bg-skill-choice-chk" value="${s}" ${idx < count ? 'checked' : ''} style="cursor:pointer; accent-color:var(--color-gold-base);">
                                <span>${s}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const skillsHtml = `
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
                <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-graduation-cap"></i> Skill Proficiencies
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${skillBadges || (skillsData.choose ? '' : '<span style="font-size:0.8rem; color:var(--color-text-muted);">None</span>')}
                </div>
                ${chooseSkillHtml}
            </div>
        `;

        // 3. Tool Proficiencies HTML
        const fixedTools = (toolsData.fixed || []).map(normalizeTool);
        const toolBadges = fixedTools.map(t => `
            <span style="background:rgba(52,152,219,0.15); border:1px solid rgba(52,152,219,0.4); color:#3498db; padding:3px 8px; border-radius:4px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-wrench"></i> ${t}
            </span>
        `).join('');

        let chooseToolHtml = '';
        if (toolsData.choose && Array.isArray(toolsData.choose.from)) {
            const count = toolsData.choose.count || 1;
            const expandedTools = expandToolOptions(toolsData.choose.from);
            chooseToolHtml = `
                <div style="margin-top:6px;">
                    <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px;">
                        Choose <strong style="color:var(--color-gold-base);">${count}</strong> tool${count > 1 ? 's' : ''}:
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${Array.from({ length: count }).map((_, idx) => `
                            <select class="bg-tool-choice-sel" style="width:100%; padding:5px 8px; font-size:0.8rem; background:#222; color:#fff; border:1px solid var(--color-border-subtle); border-radius:4px;">
                                ${expandedTools.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const toolsHtml = `
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
                <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-toolbox"></i> Tool Proficiencies
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${toolBadges || (toolsData.choose ? '' : '<span style="font-size:0.8rem; color:var(--color-text-muted);">None</span>')}
                </div>
                ${chooseToolHtml}
            </div>
        `;

        // 4. Starting Equipment & Gold HTML
        const fixedItems = equipData.fixedItems || [];
        const fixedGold = equipData.fixedGold || 0;
        const choiceSets = equipData.choiceSets || [];

        let fixedEquipSummary = [];
        fixedItems.forEach(it => {
            fixedEquipSummary.push((it.quantity > 1 ? `${it.quantity}x ` : '') + (it.name || 'item'));
        });
        if (fixedGold > 0) fixedEquipSummary.push(`${fixedGold} gp`);

        let choiceSetsHtml = '';
        if (choiceSets.length > 0) {
            choiceSetsHtml = choiceSets.map((set, si) => `
                <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">Equipment Package:</div>
                    ${set.options.map((opt, oi) => {
                        const optLabel = opt.label || (opt.items.map(it => (it.quantity > 1 ? `${it.quantity}x ` : '') + it.name).join(', ') + (opt.gold ? ` + ${opt.gold} gp` : ''));
                        return `
                            <label style="display:flex; align-items:flex-start; gap:8px; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); padding:6px 10px; border-radius:4px; margin:0;">
                                <input type="radio" name="bg-equip-set-${si}" value="${oi}" ${oi === 0 ? 'checked' : ''} style="cursor:pointer; accent-color:var(--color-gold-base); margin-top:2px;">
                                <div style="flex:1;">
                                    <strong style="color:var(--color-gold-light);">Option ${opt.key || String.fromCharCode(65 + oi)}:</strong>
                                    <span style="color:var(--color-text-primary); margin-left:4px;">${optLabel}</span>
                                </div>
                            </label>
                        `;
                    }).join('')}
                </div>
            `).join('');
        }

        const equipHtml = `
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
                <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-sack-dollar"></i> Starting Equipment & Gold
                </div>
                ${fixedEquipSummary.length > 0 ? `
                    <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:6px;">
                        <strong>Standard Gear:</strong> ${fixedEquipSummary.join(', ')}
                    </div>
                ` : ''}
                ${choiceSetsHtml}

                <div style="margin-top:10px; padding:8px 10px; background:rgba(0,0,0,0.35); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px; font-weight:600;">Inventory Handling:</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                            <input type="radio" name="bg-inv-handling" value="append" checked style="cursor:pointer; accent-color:var(--color-gold-base);">
                            <span><strong>Append to Inventory</strong> (Keep existing items & add background equipment)</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                            <input type="radio" name="bg-inv-handling" value="replace" style="cursor:pointer; accent-color:var(--color-gold-base);">
                            <span><strong>Replace Inventory</strong> (Clear current items & replace with background equipment)</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // 5. Ability Cards & Feature HTML
        const featureNames = features.map(f => f.name).join(', ') || 'Background Feature';
        const cardsHtml = `
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--color-border-subtle); border-radius:6px; padding:10px 12px;">
                <div style="font-size:0.85rem; font-weight:600; color:var(--color-gold-base); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-address-card"></i> Ability Cards
                </div>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; margin:0;">
                    <input type="checkbox" id="bg-import-create-cards" checked style="cursor:pointer; accent-color:var(--color-gold-base);">
                    <span>Create Ability Cards in <strong>"Background Features"</strong> category</span>
                </label>
                <div style="font-size:0.72rem; color:var(--color-text-muted); margin-left:20px; margin-top:3px; line-height:1.3;">
                    Creates rules card for <em>${featureNames}</em> plus a complete Background Summary card.
                </div>
            </div>
        `;

        bodyEl.innerHTML = descSnippet + skillsHtml + toolsHtml + equipHtml + cardsHtml;

        // Interactive limit on skill choice checkboxes
        bodyEl.querySelectorAll('.bg-skill-choice-group').forEach(group => {
            const count = parseInt(group.dataset.count) || 1;
            const chks = group.querySelectorAll('.bg-skill-choice-chk');
            const updateSkillLimit = () => {
                const checked = Array.from(chks).filter(c => c.checked);
                if (checked.length >= count) {
                    chks.forEach(c => { if (!c.checked) c.disabled = true; });
                } else {
                    chks.forEach(c => { c.disabled = false; });
                }
            };
            chks.forEach(c => c.addEventListener('change', updateSkillLimit));
            updateSkillLimit();
        });

        // Close / Cancel wiring
        const closeModal = () => {
            modal.classList.add('vtt-hidden');
            overlay.classList.add('vtt-hidden');
        };

        const cancelBtn = document.getElementById('bg-import-modal-cancel');
        const closeBtn = document.getElementById('bg-import-modal-close');
        const applyBtn = document.getElementById('bg-import-modal-apply');

        const onCancelHandler = () => {
            closeModal();
            if (onCancel) onCancel();
        };

        cancelBtn.onclick = onCancelHandler;
        closeBtn.onclick = onCancelHandler;
        overlay.onclick = onCancelHandler;

        // Apply wiring
        applyBtn.onclick = () => {
            const selectedSkills = [...fixedSkills];
            bodyEl.querySelectorAll('.bg-skill-choice-chk:checked').forEach(c => {
                selectedSkills.push(c.value);
            });

            const selectedTools = [...fixedTools];
            bodyEl.querySelectorAll('.bg-tool-choice-sel').forEach(s => {
                if (s.value) selectedTools.push(s.value);
            });

            const selectedItems = [...fixedItems];
            let totalGold = fixedGold;

            choiceSets.forEach((set, si) => {
                const checkedRadio = bodyEl.querySelector(`input[name="bg-equip-set-${si}"]:checked`);
                const optIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
                const opt = set.options[optIdx];
                if (opt) {
                    if (Array.isArray(opt.items)) selectedItems.push(...opt.items);
                    if (opt.gold) totalGold += opt.gold;
                }
            });

            const invHandling = bodyEl.querySelector('input[name="bg-inv-handling"]:checked')?.value || 'append';
            const createCards = !!document.getElementById('bg-import-create-cards')?.checked;

            applyBackgroundToCharacter(char, bgData, {
                skills: selectedSkills,
                tools: selectedTools,
                items: selectedItems,
                gold: totalGold,
                invHandling,
                createCards
            });

            closeModal();
            if (onApplied) onApplied();
        };

        modal.classList.remove('vtt-hidden');
        overlay.classList.remove('vtt-hidden');
    }

    function applyBackgroundToCharacter(char, bgData, choices) {
        if (!char || !bgData) return;

        const badge = getDisplaySourceBadge(bgData.source);
        const srcTag = badge ? ` [${badge}]` : (bgData.source ? ` [${bgData.source}]` : '');
        char.background = `${bgData.name}${srcTag}`;

        // 1. Skills
        char.skills = char.skills || {};
        const appliedSkills = [];
        (choices.skills || []).forEach(s => {
            const norm = normalizeSkill(s);
            if (norm) {
                char.skills[norm] = true;
                appliedSkills.push(norm);
            }
        });

        // 2. Tools
        char.tools = char.tools || {};
        const appliedTools = [];
        (choices.tools || []).forEach(t => {
            const norm = normalizeTool(t);
            if (norm) {
                const defTool = STANDARD_TOOLS.find(st => st.name.toLowerCase() === norm.toLowerCase());
                const ab = defTool ? defTool.ability : 'dex';
                char.tools[norm] = {
                    ability: ab,
                    show: true,
                    prof: true,
                    exp: false,
                    mod: "0",
                    custom: !defTool
                };
                appliedTools.push(norm);
            }
        });

        // 3. Equipment & Currency
        char.equipment = Array.isArray(char.equipment) ? char.equipment : [];
        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

        const addedGold = parseInt(choices.gold) || 0;
        if (choices.invHandling === 'replace') {
            char.equipment = [];
            char.currency.gp = addedGold;
        } else {
            char.currency.gp = (char.currency.gp || 0) + addedGold;
        }

        const appliedItems = [];
        (choices.items || []).forEach(it => {
            const itemName = it.name ? it.name.trim() : 'Item';
            const itemQty = parseInt(it.quantity) || 1;
            const itemWeight = parseFloat(it.weight) || 0;
            char.equipment.push({
                id: 'eq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
                qty: itemQty,
                weight: itemWeight,
                containerId: null,
                description: ''
            });
            appliedItems.push(itemQty > 1 ? `${itemQty}x ${itemName}` : itemName);
        });

        // 4. Ability Cards
        if (choices.createCards) {
            char.abilityCategories = char.abilityCategories || [];
            char.abilityCards = char.abilityCards || [];

            let bgCat = char.abilityCategories.find(c => c.name.toLowerCase() === 'background features' || c.name.toLowerCase() === 'background');
            if (!bgCat) {
                bgCat = {
                    id: 'cat_bg_' + Date.now(),
                    name: 'Background Features',
                    collapsed: false
                };
                char.abilityCategories.push(bgCat);
            }

            // Card 1: Background Feature(s)
            const features = (Array.isArray(bgData.features) && bgData.features.length > 0) ? bgData.features : [
                { name: `Feature: ${bgData.name}`, description: bgData.description || '' }
            ];

            features.forEach((feat, fi) => {
                char.abilityCards.push({
                    id: 'ab_bg_feat_' + Date.now() + '_' + fi,
                    name: feat.name || `Feature: ${bgData.name}`,
                    actionType: 'passive',
                    categoryId: bgCat.id,
                    description: feat.description || '',
                    formula: '',
                    formulaConfig: null,
                    customFields: [],
                    hasCounter: false,
                    usesCurrent: 0,
                    usesMax: 0,
                    resetType: 'none'
                });
            });

            // Card 2: Background Details & Proficiencies Summary
            let summaryDesc = `**Background:** ${bgData.name} [${bgData.source || 'PHB'}]\n\n`;
            summaryDesc += `**Skill Proficiencies:** ${appliedSkills.length > 0 ? appliedSkills.join(', ') : 'None'}\n`;
            summaryDesc += `**Tool Proficiencies:** ${appliedTools.length > 0 ? appliedTools.join(', ') : 'None'}\n`;
            if (bgData.languages) summaryDesc += `**Languages:** ${bgData.languages}\n`;
            summaryDesc += `**Starting Equipment:** ${appliedItems.length > 0 ? appliedItems.join(', ') : 'None'} (${addedGold} gp)\n\n`;
            if (bgData.description) {
                const cleanDesc = bgData.description.replace(/^#+\s+/gm, '').trim().slice(0, 500);
                summaryDesc += cleanDesc + (bgData.description.length > 500 ? '...' : '');
            }

            char.abilityCards.push({
                id: 'ab_bg_summary_' + Date.now(),
                name: `Background: ${bgData.name}`,
                actionType: 'passive',
                categoryId: bgCat.id,
                description: summaryDesc,
                formula: '',
                formulaConfig: null,
                customFields: [],
                hasCounter: false,
                usesCurrent: 0,
                usesMax: 0,
                resetType: 'none'
            });
        }

        saveAndEmit(char);
        renderSheetData(char);
    }

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
            document.getElementById('pc-skill-settings-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-skill-settings-overlay')?.classList.add('vtt-hidden');
        });

        document.getElementById('modal-skill-settings-close')?.addEventListener('click', () => {
            document.getElementById('pc-skill-settings-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-skill-settings-overlay')?.classList.add('vtt-hidden');
        });
        document.getElementById('pc-skill-settings-overlay')?.addEventListener('click', () => {
            document.getElementById('pc-skill-settings-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-skill-settings-overlay')?.classList.add('vtt-hidden');
        });
    }

    function ensureSkillSettingsModalExists() {
        if (document.getElementById('pc-skill-settings-modal')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div id="pc-skill-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-skill-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:600px;">
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
            <div id="pc-tool-settings-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="pc-tool-settings-modal" class="vtt-sheet-submodal vtt-hidden" style="width:650px;">
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
            if (aura.enabled === undefined) aura.enabled = true;
            const isEnabled = aura.enabled !== false;
            const auraName = aura.name || '';
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
            card.style.background = isEnabled ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
            card.style.opacity = isEnabled ? '1' : '0.7';

            card.innerHTML = `
                <div class="aura-item-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <i class="fa-solid fa-chevron-right aura-chevron" style="transition: transform 0.2s; font-size: 0.75rem; color: var(--color-text-muted); ${isExpanded ? 'transform: rotate(90deg);' : ''}"></i>
                        <label class="aura-toggle-wrapper" style="margin: 0; display: flex; align-items: center; cursor: pointer;" title="${isEnabled ? 'Disable Aura' : 'Enable Aura'}">
                            <input type="checkbox" class="aura-enable-toggle" ${isEnabled ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-gold-base);">
                        </label>
                        <span class="aura-title-text" style="font-size: 0.8rem; font-weight: bold; color: ${isEnabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${auraName ? `<strong>${auraName}</strong>` : `Aura ${idx + 1}`}: <span style="font-weight: normal; opacity: 0.85;">${range}ft ${shape.charAt(0).toUpperCase() + shape.slice(1)}</span>
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                        <span class="swatch-preview" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 1px solid rgba(255,255,255,0.2); opacity: ${isEnabled ? '1' : '0.4'};"></span>
                        <button type="button" class="btn-delete-aura btn btn-icon btn-danger btn-xxs" style="padding: 2px 4px; font-size: 0.7rem; border-radius: 4px;" title="Delete Aura">
                            <i class="fa-solid fa-trash pointer-events-none"></i>
                        </button>
                    </div>
                </div>
                
                <div class="aura-item-details ${isExpanded ? '' : 'vtt-hidden'}" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
                    <div class="form-group" style="margin-bottom: 8px;">
                        <label style="font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 2px;">Aura Label / Name</label>
                        <input type="text" class="aura-name-input" placeholder="e.g. Spirit Guardians, Aura of Courage" value="${auraName}" style="width: 100%; font-size: 0.8rem; padding: 4px 8px;">
                    </div>
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
                if (e.target.closest('.btn-delete-aura') || e.target.closest('.aura-toggle-wrapper')) return;
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

            const enableToggle = card.querySelector('.aura-enable-toggle');
            const nameInput = card.querySelector('.aura-name-input');
            const swatchPreview = card.querySelector('.swatch-preview');
            const titleText = card.querySelector('.aura-title-text');

            const updateAuraTitle = () => {
                const rng = card.querySelector('.aura-range-input').value;
                const shp = card.querySelector('.aura-shape-select').value;
                const curName = tempPlayerAurasList[idx].name;
                const isEn = tempPlayerAurasList[idx].enabled !== false;
                titleText.innerHTML = `
                    ${curName ? `<strong>${curName}</strong>` : `Aura ${idx + 1}`}: <span style="font-weight: normal; opacity: 0.85;">${rng}ft ${shp.charAt(0).toUpperCase() + shp.slice(1)}</span>
                `;
                titleText.style.color = isEn ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
            };

            enableToggle.addEventListener('change', (e) => {
                e.stopPropagation();
                const en = enableToggle.checked;
                tempPlayerAurasList[idx].enabled = en;
                updateAuraTitle();
                swatchPreview.style.opacity = en ? '1' : '0.4';
                card.style.opacity = en ? '1' : '0.7';
                card.style.background = en ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
            });

            nameInput.addEventListener('input', () => {
                tempPlayerAurasList[idx].name = nameInput.value.trim();
                updateAuraTitle();
            });

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
                swatchPreview.style.background = e.target.value;
            });
            card.querySelector('.btn-delete-aura').addEventListener('click', (e) => {
                e.stopPropagation();
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
        document.getElementById('modal-pc-token-edit-close')?.addEventListener('click', () => {
            document.getElementById('modal-pc-token-edit')?.classList.add('vtt-hidden');
            document.getElementById('modal-pc-token-edit-overlay')?.classList.add('vtt-hidden');
        });
        document.getElementById('modal-pc-token-edit-overlay')?.addEventListener('click', () => {
            document.getElementById('modal-pc-token-edit')?.classList.add('vtt-hidden');
            document.getElementById('modal-pc-token-edit-overlay')?.classList.add('vtt-hidden');
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
            tempPlayerAurasList.push({ name: '', enabled: true, range: 10, shape: 'circle', style: 'both', opacity: 0.3, color: '#d4af37', isExpanded: true });
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
                        t.isGif = _cleanActiveUrl.endsWith('.gif');
                        t.isVideo = !t.isGif && (_cleanActiveUrl.endsWith('.mp4') || _cleanActiveUrl.endsWith('.webm') || _cleanActiveUrl.endsWith('.ogg') || activeImageUrl.includes('youtube.com'));

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
                    if (window.VTT?.chatEngine?.updateCombatantTokenArt) {
                        const activeImageUrl = (currentChar.tokenImages && currentChar.tokenImages.length > 0 && currentChar.activeTokenIndex >= 0 && currentChar.activeTokenIndex < currentChar.tokenImages.length) ? currentChar.tokenImages[currentChar.activeTokenIndex].url : 'favicon.svg';
                        window.VTT.chatEngine.updateCombatantTokenArt(null, activeImageUrl, currentChar.id);
                    }
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
            <div id="modal-pc-token-edit-overlay" class="vtt-sheet-submodal-overlay vtt-hidden"></div>
            <div id="modal-pc-token-edit" class="vtt-sheet-submodal vtt-hidden" style="width:500px;">
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
            <div id="pc-item-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>

            <div id="pc-item-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3010; width:600px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
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
            <div id="pc-custom-item-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3025; width:400px; max-width:90vw; display:flex; flex-direction:column; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
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
                <div style="padding:12px 16px; border-top:1px solid var(--color-border-subtle); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2);">
                    <button id="pc-custom-item-modal-del" class="btn btn-danger btn-xs" style="display:none;"><i class="fa-solid fa-trash"></i> Delete Item</button>
                    <button id="pc-custom-item-modal-add" class="btn btn-primary btn-xs">Save Item</button>
                </div>
            </div>

            <!-- Item Automation Wizard Modal -->
            <div id="pc-item-automation-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); backdrop-filter:blur(3px); z-index:3020;"></div>
            <div id="pc-item-automation-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden glassmorphism" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#18181b; border:1px solid var(--color-gold-base); border-radius:10px; z-index:3025; width:480px; max-width:92vw; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.7); overflow:hidden; font-family:var(--font-primary, sans-serif);">
                <div style="padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.35); display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i id="pc-automation-icon" class="fa-solid fa-wand-magic-sparkles text-gradient-gold" style="font-size:1.15rem;"></i>
                        <h3 id="pc-automation-title" style="margin:0; font-size:1.05rem; color:var(--color-gold-base); font-family:var(--font-heading);">Item Automation</h3>
                    </div>
                    <span id="pc-automation-step-indicator" style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:10px;">Step 1 of 1</span>
                </div>
                <div id="pc-automation-body" style="padding:18px; font-size:0.875rem; line-height:1.5; color:var(--color-text-primary);">
                    <!-- Injected step content -->
                </div>
                <div id="pc-automation-actions" style="padding:12px 18px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end; gap:8px; background:rgba(0,0,0,0.25);">
                    <!-- Injected step action buttons -->
                </div>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('pc-item-modal-close').addEventListener('click', () => {
            document.getElementById('pc-item-modal').classList.add('vtt-hidden');
            document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
        });

        // Backdrop tap-to-dismiss for items overlay
        document.getElementById('pc-item-overlay').addEventListener('click', () => {
            const customModal = document.getElementById('pc-custom-item-modal');
            const itemModal = document.getElementById('pc-item-modal');
            if (customModal && !customModal.classList.contains('vtt-hidden')) {
                customModal.classList.add('vtt-hidden');
                if (itemModal && itemModal.classList.contains('vtt-hidden')) {
                    document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
                }
            } else if (itemModal && !itemModal.classList.contains('vtt-hidden')) {
                itemModal.classList.add('vtt-hidden');
                document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
            }
        });

        document.getElementById('pc-item-automation-overlay').addEventListener('click', () => {
            document.getElementById('pc-item-automation-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-item-automation-overlay')?.classList.add('vtt-hidden');
        });

        document.getElementById('pc-custom-item-modal-close').addEventListener('click', () => {
            document.getElementById('pc-custom-item-modal').classList.add('vtt-hidden');
            // Keep overlay if item modal is open
            if (document.getElementById('pc-item-modal').classList.contains('vtt-hidden')) {
                document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
            }
        });

        document.getElementById('pc-custom-item-modal-del').addEventListener('click', () => {
            if (!currentChar) return;
            const saveBtn = document.getElementById('pc-custom-item-modal-add');
            const editIdx = saveBtn?.dataset.editIdx;
            if (editIdx !== undefined && editIdx !== null && editIdx !== '') {
                if (confirm("Delete this item?")) {
                    currentChar.equipment.splice(parseInt(editIdx), 1);
                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                    document.getElementById('pc-custom-item-modal').classList.add('vtt-hidden');
                    if (document.getElementById('pc-item-modal').classList.contains('vtt-hidden')) {
                        document.getElementById('pc-item-overlay').classList.add('vtt-hidden');
                    }
                }
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

        let itemSearchDebounce = null;
        document.getElementById('pc-item-search').addEventListener('input', (e) => {
            const q = e.target.value;
            clearTimeout(itemSearchDebounce);
            itemSearchDebounce = setTimeout(() => {
                renderItemSearchList(q);
            }, 100);
        });

        document.getElementById('pc-item-modal-add').addEventListener('click', async () => {
            if (!currentChar) return;
            const selectedList = window._vttSelectedItemMap ? Array.from(window._vttSelectedItemMap.values()) : [];
            if (!selectedList.length) return;

            window._vttSelectedItemMap.clear();
            updateItemSelectedCount();
            document.getElementById('pc-item-modal').classList.add('vtt-hidden');
            document.getElementById('pc-item-overlay').classList.add('vtt-hidden');

            const automationQueue = [];

            for (const sel of selectedList) {
                const catItem = sel.catItem;

                // ─── 1. Automatic Pack Unpacking ─────────────────────────────
                if (catItem && Array.isArray(catItem.packContents) && catItem.packContents.length > 0) {
                    for (const packEntry of catItem.packContents) {
                        if (typeof packEntry === 'string') {
                            const [pName, pSrc] = packEntry.split('|');
                            const found = itemCache?.items?.find(it => it.name.toLowerCase() === pName.toLowerCase());
                            currentChar.equipment.push({
                                id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                name: found ? found.name : (pName.charAt(0).toUpperCase() + pName.slice(1)),
                                qty: 1,
                                weight: found ? (found.weight || 0) : 0,
                                description: found ? (found.descriptionMarkdown || found.descriptionHtml || '') : '',
                                source: found?.source || pSrc || sel.source
                            });
                        } else if (typeof packEntry === 'object' && packEntry !== null) {
                            if (packEntry.item) {
                                const [pName, pSrc] = packEntry.item.split('|');
                                const found = itemCache?.items?.find(it => it.name.toLowerCase() === pName.toLowerCase());
                                currentChar.equipment.push({
                                    id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                    name: found ? found.name : (pName.charAt(0).toUpperCase() + pName.slice(1)),
                                    qty: packEntry.quantity || 1,
                                    weight: found ? (found.weight || 0) : 0,
                                    description: found ? (found.descriptionMarkdown || found.descriptionHtml || '') : '',
                                    source: found?.source || pSrc || sel.source
                                });
                            } else if (packEntry.special) {
                                currentChar.equipment.push({
                                    id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                    name: packEntry.special,
                                    qty: packEntry.quantity || 1,
                                    weight: 0,
                                    description: '',
                                    source: sel.source
                                });
                            }
                        }
                    }
                } else {
                    // Standard item
                    let fullDesc = catItem?.descriptionMarkdown || sel.desc || catItem?.descriptionHtml || '';
                    if (!fullDesc && sel.source && sel.itemId) {
                        try {
                            const res = await fetch(`/api/item/${encodeURIComponent(sel.source)}/${encodeURIComponent(sel.itemId)}`);
                            if (res.ok) {
                                const fullItem = await res.json();
                                fullDesc = fullItem.descriptionMarkdown || fullItem.descriptionHtml || (Array.isArray(fullItem.entries) ? fullItem.entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n') : '');
                            }
                        } catch(e) {}
                    }

                    currentChar.equipment.push({
                        id: 'eq_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        name: sel.name,
                        qty: 1,
                        weight: sel.weight,
                        description: fullDesc,
                        source: sel.source
                    });

                    // ─── 2. Detect Weapon Macro Automation ───────────────────
                    const isWeap = !!(catItem.macroTemplate || catItem.isWeapon || catItem.dmg1 || catItem.weaponCategory || catItem.rawType === 'M' || catItem.rawType === 'R' || (catItem.type && catItem.type.toLowerCase().includes('weapon')));
                    if (isWeap) {
                        automationQueue.push({
                            type: 'weapon',
                            item: catItem,
                            name: sel.name,
                            desc: fullDesc
                        });
                    }

                    // ─── 3. Detect AC Modification Automation ────────────────
                    const isArm = !!(catItem.isArmor || (catItem.ac !== null && catItem.ac !== undefined) || catItem.bonusAc || catItem.armor || catItem.rawType === 'LA' || catItem.rawType === 'MA' || catItem.rawType === 'HA' || catItem.rawType === 'S' || (catItem.type && (catItem.type.toLowerCase().includes('armor') || catItem.type === 'Shield')));
                    if (isArm) {
                        automationQueue.push({
                            type: 'ac',
                            item: catItem,
                            name: sel.name,
                            desc: fullDesc
                        });
                    }

                    // ─── 4. Detect Granted Spells Automation ────────────────
                    let hasSpells = false;
                    let spellsList = [];
                    if (catItem.attachedSpells) {
                        if (Array.isArray(catItem.attachedSpells)) {
                            spellsList = catItem.attachedSpells;
                        } else if (typeof catItem.attachedSpells === 'object') {
                            function extractSpells(obj) {
                                const res = [];
                                for (const k in obj) {
                                    if (typeof obj[k] === 'string') res.push(obj[k]);
                                    else if (Array.isArray(obj[k])) {
                                        for (const sub of obj[k]) {
                                            if (typeof sub === 'string') res.push(sub);
                                            else if (typeof sub === 'object') res.push(...extractSpells(sub));
                                        }
                                    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                                        res.push(...extractSpells(obj[k]));
                                    }
                                }
                                return res;
                            }
                            spellsList = Array.from(new Set(extractSpells(catItem.attachedSpells)));
                        }
                        if (spellsList.length > 0) hasSpells = true;
                    }

                    if (hasSpells) {
                        automationQueue.push({
                            type: 'spells',
                            item: catItem,
                            name: sel.name,
                            desc: fullDesc,
                            spells: spellsList
                        });
                    }
                }
            }

            saveAndEmit(currentChar);
            renderSheetData(currentChar);

            if (automationQueue.length > 0) {
                runItemAutomationWizard(automationQueue);
            }
        });
    }

    function updateItemSelectedCount() {
        const count = window._vttSelectedItemMap ? window._vttSelectedItemMap.size : document.querySelectorAll('.pc-item-select:checked').length;
        const countEl = document.getElementById('pc-item-selected-count');
        if (countEl) countEl.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
    }

    async function runItemAutomationWizard(queue) {
        if (!queue || !queue.length || !currentChar) return;
        ensureItemModalsExist();

        const overlay = document.getElementById('pc-item-automation-overlay');
        const modal = document.getElementById('pc-item-automation-modal');
        const iconEl = document.getElementById('pc-automation-icon');
        const titleEl = document.getElementById('pc-automation-title');
        const stepIndEl = document.getElementById('pc-automation-step-indicator');
        const bodyEl = document.getElementById('pc-automation-body');
        const actionsEl = document.getElementById('pc-automation-actions');

        if (!overlay || !modal) return;

        overlay.classList.remove('vtt-hidden');
        modal.classList.remove('vtt-hidden');

        let stepIndex = 0;

        function nextStep() {
            stepIndex++;
            if (stepIndex < queue.length) {
                renderStep(queue[stepIndex]);
            } else {
                overlay.classList.add('vtt-hidden');
                modal.classList.add('vtt-hidden');
                saveAndEmit(currentChar);
                renderSheetData(currentChar);
            }
        }

        async function renderStep(step) {
            stepIndEl.textContent = `Step ${stepIndex + 1} of ${queue.length}`;

            if (step.type === 'weapon') {
                iconEl.className = 'fa-solid fa-burst text-gradient-gold';
                titleEl.textContent = 'Create Weapon Macro?';

                const tmpl = step.item.macroTemplate || {};
                const rawProps = Array.isArray(step.item.properties) ? step.item.properties : [];
                const props = rawProps.map(p => typeof p === 'string' ? p.toLowerCase() : '');
                const isFinesse = tmpl.isFinesse !== undefined ? tmpl.isFinesse : props.some(p => p.includes('finesse'));
                const isRanged = tmpl.isRanged !== undefined ? tmpl.isRanged : (step.item.rawType === 'R' || (step.item.type || '').toLowerCase().includes('ranged') || props.some(p => p.includes('ammunition')));

                const strVal = parseInt(currentChar.stats?.str) || 10;
                const dexVal = parseInt(currentChar.stats?.dex) || 10;
                let chosenStat = 'str';
                if (isRanged) chosenStat = 'dex';
                else if (isFinesse) chosenStat = dexVal >= strVal ? 'dex' : 'str';
                else if (tmpl.attackStat && tmpl.attackStat !== 'auto') chosenStat = tmpl.attackStat;

                let bonusVal = tmpl.attackExtra !== undefined ? tmpl.attackExtra : 0;
                if (!bonusVal && step.item.bonusWeapon) {
                    bonusVal = parseInt(step.item.bonusWeapon) || 0;
                } else if (!bonusVal) {
                    const match = step.name.match(/\+(\d+)/);
                    if (match) bonusVal = parseInt(match[1]) || 0;
                }

                const rangeVal = tmpl.range || '5 ft';
                const targetVal = tmpl.target || '1 target';

                // Zero-parsing: Build dmgRows directly using pre-compiled database template
                const dmgRows = (tmpl.damageRows && tmpl.damageRows.length > 0)
                    ? tmpl.damageRows.map((r, rIdx) => ({
                        id: 'dmg_' + Date.now() + '_' + rIdx,
                        formula: r.formula,
                        stat: r.stat === 'auto' ? chosenStat : (r.stat || ''),
                        extra: r.extra !== undefined ? r.extra : (rIdx === 0 ? bonusVal : 0),
                        type: r.type || '',
                        label: r.label || ''
                    }))
                    : [{
                        id: 'dmg_' + Date.now(),
                        formula: step.item.dmg1 || '1d6',
                        stat: chosenStat,
                        extra: bonusVal,
                        type: step.item.dmgType ? (step.item.dmgType.charAt(0).toUpperCase() + step.item.dmgType.slice(1)) : 'Slashing',
                        label: ''
                    }];

                const damageDisplay = dmgRows.map(r => {
                    let s = `${r.formula}`;
                    if (r.stat) s += ` + ${r.stat.toUpperCase()}`;
                    if (r.extra) s += ` + ${r.extra}`;
                    s += ` ${r.type}`;
                    if (r.label) s += ` (${r.label})`;
                    return s;
                }).join(' + ');

                const versatileVal = tmpl.versatile || step.item.dmg2;
                const versatileText = versatileVal ? `<span style="color:var(--color-text-muted); font-size:0.75rem;">(Versatile: ${versatileVal})</span>` : '';

                bodyEl.innerHTML = `
                    <div style="margin-bottom:12px;">
                        Would you like to generate an attack macro for <strong style="color:var(--color-gold-light); font-size:1rem;">${step.name}</strong> in the <strong>Attacks & Macros</strong> section?
                    </div>
                    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--color-text-secondary);">Optimal Stat:</span>
                            <span style="font-weight:bold; color:var(--color-gold-light);">${chosenStat.toUpperCase()} ${isFinesse ? '(Finesse)' : (isRanged ? '(Ranged)' : '(Melee)')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--color-text-secondary);">Attack Bonus:</span>
                            <span style="font-weight:bold; color:#4caf50;">Proficiency + ${chosenStat.toUpperCase()} Mod ${bonusVal > 0 ? `+ ${bonusVal}` : ''}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--color-text-secondary);">Base Damage:</span>
                            <span style="font-weight:bold; color:var(--color-text-primary);">${damageDisplay} ${versatileText}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--color-text-secondary);">Target Category:</span>
                            <span style="font-weight:bold; color:var(--color-gold-base);"><i class="fa-solid fa-folder"></i> Weapons</span>
                        </div>
                    </div>
                `;

                actionsEl.innerHTML = `
                    <button id="pc-auto-weapon-skip" class="btn btn-secondary btn-sm">Skip</button>
                    <button id="pc-auto-weapon-create" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Create Macro</button>
                `;

                document.getElementById('pc-auto-weapon-skip').onclick = () => nextStep();
                document.getElementById('pc-auto-weapon-create').onclick = () => {
                    let descNote = step.desc || '';
                    if (versatileVal) {
                        descNote += (descNote ? '\n\n' : '') + `*Versatile:* Two-handed attack deals ${versatileVal} damage.`;
                    }

                    if (!currentChar.macroCategories) currentChar.macroCategories = [];
                    let weapCat = currentChar.macroCategories.find(c => c.name.toLowerCase() === 'weapons');
                    if (!weapCat) {
                        weapCat = { id: 'cat_weapons', name: 'Weapons', collapsed: false };
                        currentChar.macroCategories.unshift(weapCat);
                    }

                    if (!currentChar.macros) currentChar.macros = [];
                    currentChar.macros.push({
                        id: 'mac_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        name: step.name,
                        categoryId: weapCat.id,
                        description: descNote,
                        range: rangeVal,
                        target: targetVal,
                        attackStat: chosenStat,
                        attackProf: true,
                        attackExtra: bonusVal,
                        critRange: 20,
                        attackBonus: '',
                        saveAbility: '',
                        saveDcStat: 'none',
                        saveDcExtra: 0,
                        saveDcCustom: null,
                        damage: dmgRows
                    });

                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                    nextStep();
                };

            } else if (step.type === 'ac') {
                iconEl.className = 'fa-solid fa-shield-halved text-gradient-gold';
                titleEl.textContent = 'Update AC?';

                const currentAC = parseInt(currentChar.ac) || 10;
                const dexMod = Math.floor(((parseInt(currentChar.stats?.dex) || 10) - 10) / 2);

                const itemType = (step.item.rawType || step.item.type || '').toUpperCase();
                const bonusAc = step.item.bonusAc ? (parseInt(step.item.bonusAc) || 0) : 0;

                let overwriteAC = currentAC;
                let addAC = currentAC;
                let calcDetail = '';

                if (itemType === 'HA' || itemType.includes('HEAVY')) {
                    const baseAc = (step.item.ac !== null && step.item.ac !== undefined) ? step.item.ac : 16;
                    overwriteAC = baseAc + bonusAc;
                    addAC = currentAC + (bonusAc || 0);
                    calcDetail = `Heavy Armor (Base ${baseAc}${bonusAc ? ` + ${bonusAc}` : ''}, no DEX mod)`;
                } else if (itemType === 'MA' || itemType.includes('MEDIUM')) {
                    const baseAc = (step.item.ac !== null && step.item.ac !== undefined) ? step.item.ac : 14;
                    const cappedDex = Math.min(2, Math.max(0, dexMod));
                    overwriteAC = baseAc + cappedDex + bonusAc;
                    addAC = currentAC + (bonusAc || 0);
                    calcDetail = `Medium Armor (Base ${baseAc} + DEX max 2 [${cappedDex}]${bonusAc ? ` + ${bonusAc}` : ''})`;
                } else if (itemType === 'LA' || itemType.includes('LIGHT')) {
                    const baseAc = (step.item.ac !== null && step.item.ac !== undefined) ? step.item.ac : 11;
                    const uncappedDex = Math.max(0, dexMod);
                    overwriteAC = baseAc + uncappedDex + bonusAc;
                    addAC = currentAC + (bonusAc || 0);
                    calcDetail = `Light Armor (Base ${baseAc} + DEX [${uncappedDex}]${bonusAc ? ` + ${bonusAc}` : ''})`;
                } else if (itemType === 'S' || itemType.includes('SHIELD')) {
                    const shieldBonus = (step.item.ac !== null && step.item.ac !== undefined) ? step.item.ac : (2 + bonusAc);
                    addAC = currentAC + shieldBonus;
                    overwriteAC = addAC;
                    calcDetail = `Shield (+${shieldBonus} AC)`;
                } else {
                    const bonus = bonusAc || (step.item.ac || 1);
                    addAC = currentAC + bonus;
                    overwriteAC = addAC;
                    calcDetail = `AC Bonus Item (+${bonus} AC)`;
                }

                bodyEl.innerHTML = `
                    <div style="margin-bottom:12px;">
                        <strong style="color:var(--color-gold-light); font-size:1rem;">${step.name}</strong> modifies Armor Class. How would you like to update your AC?
                    </div>
                    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:6px; padding:12px; margin-bottom:12px; font-size:0.85rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="color:var(--color-text-secondary);">Current AC:</span>
                            <span style="font-size:1.15rem; font-weight:bold; color:var(--color-gold-base);">${currentAC}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--color-text-muted);">${calcDetail}</div>
                    </div>
                `;

                actionsEl.innerHTML = `
                    <button id="pc-auto-ac-skip" class="btn btn-secondary btn-sm">Keep Current (${currentAC})</button>
                    <button id="pc-auto-ac-add" class="btn btn-secondary btn-sm" style="border-color:var(--color-gold-base);"><i class="fa-solid fa-plus"></i> Add (${addAC})</button>
                    <button id="pc-auto-ac-overwrite" class="btn btn-primary btn-sm"><i class="fa-solid fa-check"></i> Overwrite (${overwriteAC})</button>
                `;

                document.getElementById('pc-auto-ac-skip').onclick = () => nextStep();
                document.getElementById('pc-auto-ac-add').onclick = () => {
                    currentChar.ac = addAC;
                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                    nextStep();
                };
                document.getElementById('pc-auto-ac-overwrite').onclick = () => {
                    currentChar.ac = overwriteAC;
                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                    nextStep();
                };

            } else if (step.type === 'spells') {
                iconEl.className = 'fa-solid fa-wand-magic-sparkles text-gradient-gold';
                titleEl.textContent = 'Add Spells?';

                const dcMatch = (step.desc || '').match(/(?:save DC|DC)\s*(\d+)/i);
                const fixedDc = dcMatch ? parseInt(dcMatch[1]) : null;
                const atkMatch = (step.desc || '').match(/(?:spell attack bonus of|spell attack bonus)\s*\+?(\d+)/i);
                const fixedAtk = atkMatch ? parseInt(atkMatch[1]) : null;

                const spellNamesFormatted = (step.spells || []).map(s => {
                    if (typeof s === 'object' && s !== null) {
                        return s.name + (s.castLevel ? ` (${s.castLevel}th-level)` : '');
                    }
                    const str = String(s).split('|')[0];
                    const [b, u] = str.split('#');
                    return (b.charAt(0).toUpperCase() + b.slice(1)) + (u ? ` (${u}th-level)` : '');
                });

                bodyEl.innerHTML = `
                    <div style="margin-bottom:12px;">
                        <strong style="color:var(--color-gold-light); font-size:1rem;">${step.name}</strong> grants the following spell(s):
                    </div>
                    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); border-radius:6px; padding:12px; margin-bottom:12px;">
                        <ul style="margin:0 0 0 16px; padding:0; font-size:0.85rem; color:var(--color-text-primary);">
                            ${spellNamesFormatted.map(s => `<li style="margin-bottom:2px; font-weight:600;">${s}</li>`).join('')}
                        </ul>
                        <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08); font-size:0.75rem; color:var(--color-text-muted); display:flex; justify-content:space-between;">
                            <span>Spell Save DC:</span>
                            <span style="font-weight:bold; color:var(--color-gold-light);">${fixedDc ? `Fixed DC ${fixedDc}` : `Character Spell DC (${currentChar.spellSettings?.ability || 'INT'})`}</span>
                        </div>
                    </div>
                `;

                actionsEl.innerHTML = `
                    <button id="pc-auto-spells-skip" class="btn btn-secondary btn-sm">Skip</button>
                    <button id="pc-auto-spells-add" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Add Spells</button>
                `;

                document.getElementById('pc-auto-spells-skip').onclick = () => nextStep();
                document.getElementById('pc-auto-spells-add').onclick = async () => {
                    let spellsCatalog = window.vttPlayerSheetAPI?.getSpellCache ? window.vttPlayerSheetAPI.getSpellCache() : null;
                    if (!spellsCatalog) {
                        try {
                            const res = await fetch('/data/spells-catalog.json?v=' + Date.now());
                            if (res.ok) {
                                spellsCatalog = await res.json();
                                if (window.vttPlayerSheetAPI?.setSpellCache) window.vttPlayerSheetAPI.setSpellCache(spellsCatalog);
                            }
                        } catch(e) {}
                    }

                    if (!currentChar.spells || typeof currentChar.spells !== 'object' || Array.isArray(currentChar.spells)) {
                        currentChar.spells = { cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: [] };
                    }

                    for (const sItem of step.spells) {
                        let cleanSName = '';
                        let castLvl = null;
                        let displayName = '';
                        if (typeof sItem === 'object' && sItem !== null) {
                            cleanSName = (sItem.cleanName || sItem.name || '').trim().toLowerCase();
                            castLvl = sItem.castLevel || null;
                            displayName = sItem.name || cleanSName;
                        } else {
                            const rawStr = String(sItem).trim();
                            const [cleanPart] = rawStr.split('|');
                            const [basePart, upcastPart] = cleanPart.split('#');
                            cleanSName = basePart.trim().toLowerCase();
                            castLvl = upcastPart ? parseInt(upcastPart) : null;
                            displayName = basePart.trim();
                        }

                        const spData = spellsCatalog ? spellsCatalog.find(s => (s.name || '').toLowerCase() === cleanSName) : null;

                        const baseLvl = spData?.level !== undefined ? spData.level : 1;
                        const levelKey = baseLvl === 0 ? 'cantrip' : `level${baseLvl}`;
                        if (!currentChar.spells[levelKey]) currentChar.spells[levelKey] = [];

                        const existing = currentChar.spells[levelKey].find(s => (s.name || '').toLowerCase() === cleanSName);
                        if (!existing) {
                            const castTime = spData?.time ? (typeof spData.time === 'string' ? spData.time : `${spData.time[0]?.number || 1} ${spData.time[0]?.unit || 'action'}`) : '1 action';
                            const rangeStr = spData?.range ? (typeof spData.range === 'string' ? spData.range : (spData.range.type || '')) : '';
                            const compStr = spData?.components ? (typeof spData.components === 'string' ? spData.components : Object.keys(spData.components).join(', ').toUpperCase()) : '';
                            const durStr = spData?.duration ? (typeof spData.duration === 'string' ? spData.duration : (spData.duration[0]?.type === 'timed' ? `${spData.duration[0]?.duration?.amount} ${spData.duration[0]?.duration?.type}` : spData.duration[0]?.type)) : 'Instantaneous';

                            const note = `*(Granted by item: ${step.name}${castLvl ? `, cast as ${castLvl}th-level spell` : ''})*`;
                            currentChar.spells[levelKey].push({
                                id: 'sp_item_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                name: spData ? spData.name : (displayName.charAt(0).toUpperCase() + displayName.slice(1)),
                                school: spData?.school || '',
                                castingTime: castTime,
                                range: rangeStr,
                                components: compStr,
                                duration: durStr,
                                concentration: !!spData?.concentration,
                                ritual: !!spData?.meta?.ritual,
                                description: (spData?.entriesHtml || (Array.isArray(spData?.entries) ? spData.entries.join('\n\n') : '')) + `\n\n${note}`,
                                saveAbility: spData?.savingThrow ? (spData.savingThrow[0]?.toUpperCase() || '') : '',
                                saveDcStat: fixedDc ? 'custom' : 'none',
                                saveDcCustom: fixedDc || null,
                                attackBonus: fixedAtk ? `+${fixedAtk}` : '',
                                damageList: spData?.damageList || [],
                                castLvl: castLvl || baseLvl,
                                itemOrigin: step.name
                            });
                        }
                    }

                    saveAndEmit(currentChar);
                    renderSheetData(currentChar);
                    if (window.VTTSpellManager?.renderSpellbookTab) {
                        try { window.VTTSpellManager.renderSpellbookTab(currentChar); } catch(e) {}
                    }
                    nextStep();
                };
            }
        }

        renderStep(queue[0]);
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

        const delBtn = document.getElementById('pc-custom-item-modal-del');
        if (delBtn) {
            delBtn.style.display = isEdit ? 'inline-block' : 'none';
        }

        document.getElementById('pc-custom-item-modal').classList.remove('vtt-hidden');
        document.getElementById('pc-item-overlay').classList.remove('vtt-hidden');
        document.getElementById('pc-custom-item-name').focus();
    };

    window.openItemModal = function () {
        if (!currentChar) return;
        ensureItemModalsExist();
        window._vttSelectedItemMap = new Map();
        updateItemSelectedCount();
        document.getElementById('pc-item-modal').classList.remove('vtt-hidden');
        document.getElementById('pc-item-overlay').classList.remove('vtt-hidden');
        document.getElementById('pc-item-search').value = '';

        const listEl = document.getElementById('pc-item-list');
        listEl.innerHTML = '<div style="text-align:center; color:var(--color-text-muted);">Loading items...</div>';

        if (itemCache) {
            renderItemSearchList();
        } else {
            fetch('/data/items-catalog.json?v=' + Date.now())
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
                .then(catalogItems => {
                    itemCache = { items: catalogItems, fluffDict: {}, ruleDict: { property: {}, mastery: {} }, isCatalog: true };
                    renderItemSearchList();
                })
                .catch(() => {
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
        });
    }
};

    function renderItemSearchList(query = '') {
        if (!itemCache) return;
        const listEl = document.getElementById('pc-item-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const { items, fluffDict, ruleDict } = itemCache;
        if (!window._vttCurrentSortedItems) {
            window._vttCurrentSortedItems = [...items].filter(i => i.type !== "GV" && !String(i.type).startsWith("GV|")).sort((a, b) => a.name.localeCompare(b.name));
        }
        const sortedItems = window._vttCurrentSortedItems;

        const q = (query || '').trim().toLowerCase();
        const filteredItems = q
            ? sortedItems.filter(it => {
                const name = (it.name || '').toLowerCase();
                if (name.includes(q)) return true;
                const type = (it.type || it.weaponCategory || '').toLowerCase();
                if (type.includes(q)) return true;
                return false;
            })
            : sortedItems;

        const maxDisplay = 60;
        const displayItems = filteredItems.slice(0, maxDisplay);

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

        let html = '';
        for (let i = 0; i < displayItems.length; i++) {
            const item = displayItems[i];
            const weight = item.weight || 0;
            const source = item.source || '';
            const val = item.value ? (item.value / 100) + ' gp' : '';
            const itemKey = (item.id || (item.name + '::' + source)).toLowerCase();
            const isChecked = window._vttSelectedItemMap ? window._vttSelectedItemMap.has(itemKey) : false;

            let mechText = buildMechanicalText(item);
            let parts = [];

            // 1. If variant, append base item lore/mechanics first
            if (item._isVariant && item.baseName) {
                const baseKey = (item.baseName + source).toLowerCase();
                let baseEntries = null;
                const baseItem = items.find(it => it.name === item.baseName);
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

            let descText = item.descriptionMarkdown || (mechText + parts.filter(Boolean).join('\n\n'));
            const is2024 = (source || '').toUpperCase() === 'XPHB' || (source || '').toUpperCase() === 'XDMG';
            const badgeBg = is2024 ? '#059669' : ((source || '').toUpperCase() === 'PHB' ? '#2563eb' : '#475569');

            html += `
                <label class="pc-item-row glassmorphism" data-name="${item.name.replace(/"/g, '&quot;')}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <input type="checkbox" class="pc-item-select" data-key="${itemKey}" data-idx="${sortedItems.indexOf(item)}" data-name="${item.name.replace(/"/g, '&quot;')}" data-weight="${weight}" data-desc="${encodeURIComponent(descText)}" data-source="${source}" data-id="${item.id || ''}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
                        <div style="display:flex; flex-direction:column;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-weight:bold; color:var(--color-gold-light);">${item.name}</span>
                                ${source ? `<span style="background:${badgeBg}; color:#fff; border-radius:3px; padding:1px 4px; font-size:0.55rem; font-weight:700; text-transform:uppercase;">${source}</span>` : ''}
                            </div>
                            <span style="font-size:0.75rem; color:var(--color-text-muted);">${item.type || ''} ${val ? '| ' + val : ''}</span>
                        </div>
                    </div>
                    <div style="font-size:0.85rem; color:var(--color-text-secondary);">
                        ${weight} lb
                    </div>
                </label>
            `;
        }

        if (filteredItems.length > maxDisplay) {
            html += `<div style="text-align:center; padding:10px 12px; font-size:0.75rem; color:var(--color-text-muted); font-style:italic;">Showing top ${maxDisplay} of ${filteredItems.length} matching items. Type to refine search.</div>`;
        } else if (filteredItems.length === 0) {
            html = `<div style="text-align:center; padding:20px; color:var(--color-text-muted);">No items found matching "${query}".</div>`;
        }

        listEl.innerHTML = html;

        listEl.querySelectorAll('.pc-item-select').forEach(cb => {
            cb.addEventListener('change', () => {
                const key = cb.dataset.key;
                if (!window._vttSelectedItemMap) window._vttSelectedItemMap = new Map();
                if (cb.checked) {
                    const idx = parseInt(cb.dataset.idx);
                    const item = (!isNaN(idx) && sortedItems[idx]) ? sortedItems[idx] : null;
                    const desc = cb.dataset.desc ? decodeURIComponent(cb.dataset.desc) : '';
                    window._vttSelectedItemMap.set(key, {
                        name: cb.dataset.name,
                        weight: cb.dataset.weight || '0',
                        desc: desc,
                        source: cb.dataset.source || '',
                        itemId: cb.dataset.id || '',
                        catItem: item || { name: cb.dataset.name, weight: cb.dataset.weight || '0', source: cb.dataset.source || '', id: cb.dataset.id || '' }
                    });
                } else {
                    window._vttSelectedItemMap.delete(key);
                }
                updateItemSelectedCount();
            });
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
        if (window.VTT?.mobileAdapter?.syncPlayerSheetTopbar) {
            window.VTT.mobileAdapter.syncPlayerSheetTopbar();
        }
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
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button class="btn-mobile-spawn-token btn-char-spawn" data-id="${c.id}" title="Spawn on Map"><i class="fa-solid fa-plus pointer-events-none"></i></button>
                            <button class="btn btn-xxs btn-danger btn-char-delete" data-id="${c.id}" title="Delete Character"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                        </div>
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
            companions.forEach(c => {
                if (!c.tokenImages || c.tokenImages.length === 0) {
                    const m = c.monsterData || {};
                    let tokenUrl = m.tokenImg || m.tokenUrl || m.imgUrl;
                    if (!tokenUrl && typeof window.Renderer !== 'undefined' && window.Renderer.monster?.getTokenUrl) {
                        try { tokenUrl = window.Renderer.monster.getTokenUrl(m); } catch (e) {}
                    }
                    if (!tokenUrl && (m.source || m.name)) {
                        const cleanName = typeof window.Parser !== 'undefined' ? window.Parser.nameToTokenName(m.name) : (m.name || '').replace(/ /g, '-').toLowerCase();
                        const source = m.source || 'MM';
                        tokenUrl = `img/bestiary/tokens/${source}/${cleanName}.webp`;
                    }
                    if (tokenUrl) {
                        c.tokenImages = [{ url: tokenUrl, name: 'Default Token', isDefault: true }];
                        c.activeTokenIndex = 0;
                        if (vtt.socket) vtt.socket.emit('character:update', { character: c });
                    }
                }
            });

            if (pcs.length > 0) {
                html += `<div style="font-family:var(--font-heading); font-size:0.8rem; color:var(--color-text-muted); margin:12px 0 4px 8px; text-transform:uppercase; letter-spacing:1px;">Player Companions</div>`;
            }
            html += companions.map(c => `
                <div class="init-row char-row" data-id="${c.id}" data-is-companion="true" draggable="true" style="cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; padding:12px; gap:6px; border-left:3px solid var(--color-gold-base);">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span class="init-name" style="font-size:1.05rem;"><i class="fa-solid fa-paw" style="margin-right:4px; font-size:0.8rem;"></i> ${c.name}</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button class="btn-mobile-spawn-token btn-char-spawn" data-id="${c.id}" title="Spawn on Map"><i class="fa-solid fa-plus pointer-events-none"></i></button>
                            <button class="btn btn-xxs btn-danger btn-char-delete" data-id="${c.id}" title="Delete Companion"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                        </div>
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
                    size: c.tokenSize !== undefined ? c.tokenSize : size,
                    customWidth: c.tokenCustomWidth,
                    customHeight: c.tokenCustomHeight,
                    img: img, // Will be null for PCs, resolved by vtt-data-bridge.js
                    characterId: c.id,
                    isCompanion: !!c.isCompanion,
                    isPlayer: !c.isCompanion && !c.isCustomNpc,
                    sightRange: c.tokenSight !== undefined ? c.tokenSight : (c.monsterData ? (window.parseMonsterVision ? window.parseMonsterVision(c.monsterData) : 0) : 0)
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });

            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-char-delete') || e.target.closest('.btn-char-spawn')) return;
                const id = row.dataset.id;
                openSheet(id);
            });
        });

        charListEl.querySelectorAll('.btn-char-spawn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (window.VTT?.spawnCharacterAtCenter) {
                    window.VTT.spawnCharacterAtCenter(id);
                }
            });
        });

        charListEl.querySelectorAll('.btn-char-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const char = vtt.campaignState?.characters?.[id];
                const entityName = char?.name ? `"${char.name}"` : (char?.isCompanion ? 'this companion' : 'this character');
                if (confirm(`Delete ${entityName} forever?`)) {
                    // Optimistically delete from local state and update UI immediately
                    if (vtt.campaignState?.characters && vtt.campaignState.characters[id]) {
                        delete vtt.campaignState.characters[id];
                        renderCharacterList();
                    }
                    if (currentChar && currentChar.id === id) {
                        closeSheet();
                    }
                    if (vtt.creatureSheet && typeof vtt.creatureSheet.getLinkedCharacterId === 'function') {
                        if (vtt.creatureSheet.getLinkedCharacterId() === id) {
                            if (typeof vtt.creatureSheet.resetSheet === 'function') {
                                vtt.creatureSheet.resetSheet();
                            } else if (typeof vtt.creatureSheet.minimizePanel === 'function') {
                                vtt.creatureSheet.minimizePanel();
                            }
                        }
                    }
                    if (vtt.socket) {
                        vtt.socket.emit('character:delete', { id });
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
                let catRes = await fetch('/api/bestiary/catalog');
                if (!catRes.ok) catRes = await fetch('/data/bestiary-catalog.json');
                if (!catRes.ok) throw new Error('Could not load bestiary catalog');
                const monsters = await catRes.json();
                
                // create a temporary modal
                const modalOverlay = document.createElement('div');
                modalOverlay.className = 'vtt-sheet-submodal-overlay';
                modalOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;';
                
                const modal = document.createElement('div');
                modal.className = 'vtt-sheet-submodal glassmorphism';
                modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:3010; width:min(500px, 92vw); max-height:80vh; display:flex; flex-direction:column; padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';
                
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
                        const crMatch = crStr === q || crStr.includes(q) || `cr ${crStr}`.includes(query) || `cr${crStr}`.includes(q);
                        return nameMatch || crMatch;
                    }).slice(0, 50);
                    filtered.forEach(m => {
                        const row = document.createElement('div');
                        row.style.cssText = 'padding:8px; border-bottom:1px solid var(--color-border-subtle); cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
                        const spellBadge = m.hasSpellcasting ? `<span style="color:var(--color-gold-base); margin-left:4px;" title="Spellcaster"><i class="fa-solid fa-wand-magic-sparkles"></i></span>` : '';
                        row.innerHTML = `<span><strong>${m.name}</strong>${spellBadge} <span style="font-size:0.75em; color:var(--color-text-muted);">[${m.source || 'Unknown'} ${m.edition || ''}]</span></span> <span style="color:var(--color-text-muted);">CR ${m.cr ? (m.cr.cr || m.cr) : '0'}</span>`;
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
                modalOverlay.addEventListener('click', closeModal);
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
                renderList('');
                
                const selectOwnerForCompanion = (monster) => {
                    const knownPlayers = (vtt.campaignState && vtt.campaignState.knownPlayers) ? vtt.campaignState.knownPlayers : [];
                    const allowedUsers = (vtt.campaignState && vtt.campaignState.allowedUsers) ? vtt.campaignState.allowedUsers : [];
                    const allPotentialPlayers = [...new Set([...knownPlayers, ...allowedUsers])];
                    
                    const ownerOverlay = document.createElement('div');
                    ownerOverlay.className = 'vtt-sheet-submodal-overlay vtt-sheet-submodal-high';
                    ownerOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3020;';
                    const ownerModal = document.createElement('div');
                    ownerModal.className = 'vtt-sheet-submodal vtt-sheet-submodal-high glassmorphism';
                    ownerModal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:3025; width:min(400px, 92vw); padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';
                    
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
                            <button id="comp-owner-save" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Create Companion</button>
                        </div>
                    `;
                    
                    document.body.appendChild(ownerOverlay);
                    document.body.appendChild(ownerModal);
                    
                    const closeOwnerModal = () => {
                        ownerOverlay.remove();
                        ownerModal.remove();
                    };
                    
                    ownerModal.querySelector('#comp-owner-cancel').addEventListener('click', closeOwnerModal);
                    ownerOverlay.addEventListener('click', closeOwnerModal);
                    ownerModal.querySelector('#comp-owner-save').addEventListener('click', async () => {
                        const owner = ownerModal.querySelector('#comp-owner-sel').value;
                        const nickname = ownerModal.querySelector('#comp-nickname').value.trim() || monster.name;
                        
                        let hp = 20;
                        if (typeof monster.hp === 'number') hp = monster.hp;
                        else if (monster.hp && monster.hp.average) hp = monster.hp.average;
                        
                        // Hydrate full normalized creature data
                        let fullMonster = null;
                        if (window.fetchFullCreature) {
                            fullMonster = await window.fetchFullCreature(monster.source, monster.id || monster.name);
                        } else {
                            try {
                                const r = await fetch(`/api/creature/${encodeURIComponent(monster.source)}/${encodeURIComponent(monster.id || monster.name)}`);
                                if (r.ok) fullMonster = await r.json();
                            } catch (err) {}
                            if (!fullMonster) {
                                try {
                                    const partRes = await fetch(`/data/bestiary-normalized/bestiary-${monster.source.toLowerCase()}.json`);
                                    if (partRes.ok) {
                                        const partition = await partRes.json();
                                        const clean = (monster.id || monster.name).toLowerCase();
                                        fullMonster = partition.find(m => m.id?.toLowerCase() === clean || m.name?.toLowerCase() === clean);
                                    }
                                } catch (err) {}
                            }
                        }
                        const finalMonsterData = fullMonster || monster;

                        let defaultToken = finalMonsterData.tokenImg || finalMonsterData.tokenUrl || finalMonsterData.imgUrl;
                        if (!defaultToken && typeof window.Renderer !== 'undefined' && window.Renderer.monster?.getTokenUrl) {
                            try { defaultToken = window.Renderer.monster.getTokenUrl(finalMonsterData); } catch (e) {}
                        }
                        if (!defaultToken && (finalMonsterData.source || finalMonsterData.name)) {
                            const cleanName = typeof window.Parser !== 'undefined' ? window.Parser.nameToTokenName(finalMonsterData.name) : (finalMonsterData.name || '').replace(/ /g, '-').toLowerCase();
                            const source = finalMonsterData.source || 'MM';
                            defaultToken = `img/bestiary/tokens/${source}/${cleanName}.webp`;
                        }
                        const initialTokens = defaultToken ? [{ url: defaultToken, name: 'Default Token', isDefault: true }] : [];

                        const newComp = {
                            id: 'comp_' + Date.now(),
                            name: nickname,
                            isCompanion: true,
                            assignedPlayers: owner ? [owner] : [],
                            monsterData: finalMonsterData,
                            hpMax: hp,
                            hpCurrent: hp,
                            tempHp: 0,
                            ac: monster.ac ? (Array.isArray(monster.ac) ? (monster.ac[0].ac || monster.ac[0]) : (typeof monster.ac === 'object' ? monster.ac.ac : monster.ac)) : 10,
                            tokenImages: initialTokens,
                            activeTokenIndex: 0
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
            const assigned = (vtt.role !== 'GM' && vtt.username) ? [vtt.username] : [];
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
                abilityCategories: [],
                macros: [],
                macroCategories: [],
                toHit: '',
                dcAbility: 'INT',
                skills: {},
                expertise: {},
                tools: {},
                tokenImages: [],
                activeTokenIndex: 0,
                assignedPlayers: assigned
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

        // Check if this player sheet is already open in a popped-out tab/window
        const sheetKey = window.SheetWindowManager ? window.SheetWindowManager.getSheetKey('player', id) : null;
        if (!vtt.isStandaloneSheet && sheetKey && window.SheetWindowManager && window.SheetWindowManager.isSheetPoppedOut(sheetKey)) {
            window.SheetWindowManager.focusPoppedOut(sheetKey);
            return;
        }

        if ((char.isCompanion || char.isCustomNpc || char.monsterData) && vtt.creatureSheet) {
            vtt.creatureSheet.openSheet(char.monsterData, null, char.id);
            return;
        }

        currentChar = char;
        placeholderEl.classList.add('vtt-hidden');
        activeSheetEl.classList.remove('vtt-hidden');

        ensureBuilderCache();

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
            if (typeof window.VTTSpellManager.init === 'function') {
                window.VTTSpellManager.init({
                    currentChar: currentChar,
                    saveAndEmit: saveAndEmit,
                    renderSheetData: renderSheetData,
                    spellCache: spellCache
                });
            }
            if (typeof window.VTTSpellManager.ensureSpellModalsExist === 'function') {
                window.VTTSpellManager.ensureSpellModalsExist();
            }
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
        if (char.tokenSight === undefined) {
            char.tokenSight = maxSpecialVision;
        }
        
        char.spells = (typeof char.spells === 'object' && char.spells !== null && !Array.isArray(char.spells)) ? char.spells : { cantrip: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: [], legacy: [{ id: 'sp_legacy', name: 'Legacy Spells', description: char.spells || '' }] };
        char.bio = char.bio || { height: '', age: '', weight: '', backstory: '', notes: char.info || '' };
        char.abilityCards = char.abilityCards || [];
        char.abilityCategories = char.abilityCategories || [];
        char.abilityCards.forEach(c => { if (c.categoryId === undefined) c.categoryId = null; });
        char.macros = char.macros || [];
        char.macroCategories = char.macroCategories || [];
        char.macros.forEach(m => { if (m.categoryId === undefined) m.categoryId = null; });
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

        const hdMax = {};
        if (char.classes && char.classes.length > 0) {
            char.classes.forEach(c => {
                const hd = getClassHitDie(c.name);
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

        let restHtml = '<div style="display:flex; align-items:center; justify-content:flex-start; gap:12px; padding:6px 12px; background:rgba(0,0,0,0.15); border-top:1px solid rgba(255,255,255,0.06); border-bottom:1px solid rgba(255,255,255,0.06); margin-top:8px; border-radius:4px; width:100%;">';
        restHtml += '<span style="font-family:var(--font-heading); font-size:0.75rem; color:var(--color-gold-base); text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-right:4px; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-campground"></i> Rests</span>';
        restHtml += '<button class="btn btn-xs btn-secondary" id="pc-short-rest-btn" style="padding:3px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:6px;" title="Restore Short Rest Abilities"><i class="fa-solid fa-mug-hot"></i> Short Rest</button>';
        restHtml += '<button class="btn btn-xs btn-primary" id="pc-long-rest-btn" style="padding:3px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:6px;" title="Restore all Abilities, HP, Spell Slots & regain half Hit Dice"><i class="fa-solid fa-bed"></i> Long Rest</button>';
        restHtml += '</div>';

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
                    ${!vtt.isStandaloneSheet ? '<button class="btn btn-secondary btn-sm pc-popout-btn" id="pc-btn-popout" style="flex-shrink:0; padding:6px 12px; margin-left:8px;" title="Open Sheet in New Tab"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>' : ''}
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
                ${restHtml}
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
                        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-right:4px; font-family:var(--font-heading);">FAILURES</span>
                        <input type="checkbox" class="pc-ds-failure" data-idx="3" ${char.deathSaves.failures >= 3 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="2" ${char.deathSaves.failures >= 2 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                        <input type="checkbox" class="pc-ds-failure" data-idx="1" ${char.deathSaves.failures >= 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #f44336;">
                    </div>
                    <button id="pc-roll-death-save" class="btn btn-danger" style="border-radius:50%; width:48px; height:48px; display:flex; justify-content:center; align-items:center; box-shadow:0 0 10px rgba(244, 67, 54, 0.5);" title="Roll Death Save">
                        <i class="fa-solid fa-skull" style="font-size:1.5rem;"></i>
                    </button>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <input type="checkbox" class="pc-ds-success" data-idx="1" ${char.deathSaves.successes >= 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <input type="checkbox" class="pc-ds-success" data-idx="2" ${char.deathSaves.successes >= 2 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <input type="checkbox" class="pc-ds-success" data-idx="3" ${char.deathSaves.successes >= 3 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color: #4caf50;">
                        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:4px; font-family:var(--font-heading);">SUCCESSES</span>
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

        // Short Rest Execution
        document.getElementById('pc-short-rest-btn')?.addEventListener('click', () => {
            let restoredAbilities = [];
            if (char.abilityCards && Array.isArray(char.abilityCards)) {
                char.abilityCards.forEach(ab => {
                    if (ab.hasCounter && ab.resetType === 'short') {
                        if (ab.usesCurrent !== ab.usesMax) {
                            ab.usesCurrent = ab.usesMax || 0;
                            restoredAbilities.push(ab.name);
                        }
                    }
                });
            }

            // Warlock Pact Magic Slot Recovery on Short Rest
            const classesList = (char.classes && char.classes.length > 0)
                ? char.classes
                : [{ name: char.class || '', level: char.level || 1 }];

            const validClasses = classesList.filter(c => (c.name || '').trim() !== '');
            const warlockClass = validClasses.find(c => (c.name || '').trim().toLowerCase() === 'warlock');

            if (warlockClass && char.spellSlots) {
                const isPureWarlock = validClasses.length === 1;
                let slotsRestored = false;

                if (isPureWarlock) {
                    // Pure Warlock: Restore all active spell slot levels
                    Object.keys(char.spellSlots).forEach(lvl => {
                        if (char.spellSlots[lvl] && char.spellSlots[lvl].max > 0) {
                            if (char.spellSlots[lvl].current < char.spellSlots[lvl].max) {
                                slotsRestored = true;
                                char.spellSlots[lvl].current = char.spellSlots[lvl].max;
                            }
                        }
                    });
                } else {
                    // Multiclassed Warlock: Restore up to Pact Magic slots for the Warlock level
                    const wLvl = parseInt(warlockClass.level) || 1;
                    let slotLevelNum = 1;
                    let slotCount = 1;
                    if (wLvl >= 17) { slotLevelNum = 5; slotCount = 4; }
                    else if (wLvl >= 11) { slotLevelNum = 5; slotCount = 3; }
                    else if (wLvl >= 9) { slotLevelNum = 5; slotCount = 2; }
                    else if (wLvl >= 7) { slotLevelNum = 4; slotCount = 2; }
                    else if (wLvl >= 5) { slotLevelNum = 3; slotCount = 2; }
                    else if (wLvl >= 3) { slotLevelNum = 2; slotCount = 2; }
                    else if (wLvl >= 2) { slotLevelNum = 1; slotCount = 2; }
                    else { slotLevelNum = 1; slotCount = 1; }

                    const targetLevelKey = `level${slotLevelNum}`;
                    if (char.spellSlots[targetLevelKey]) {
                        const cur = char.spellSlots[targetLevelKey].current || 0;
                        const max = char.spellSlots[targetLevelKey].max || 0;
                        const newCur = Math.min(max, cur + slotCount);
                        if (newCur > cur) {
                            char.spellSlots[targetLevelKey].current = newCur;
                            slotsRestored = true;
                        }
                    }
                }

                if (slotsRestored) {
                    restoredAbilities.push('Pact Spell Slots');
                }
            }
            
            let msgText = `☕ **${char.name || 'Player'}** completed a **Short Rest**.`;
            if (restoredAbilities.length > 0) {
                msgText += ` Restored resources: ${restoredAbilities.join(', ')}.`;
            } else {
                msgText += ` No Short Rest resources required resetting.`;
            }
            
            vtt.socket.emit('chat:msg', { text: msgText });
            saveAndEmit(char);
            renderSheetData(char);
        });

        // Long Rest Execution
        document.getElementById('pc-long-rest-btn')?.addEventListener('click', () => {
            let restoredAbilities = [];
            
            // 1. Restore abilities (short + long rest)
            if (char.abilityCards && Array.isArray(char.abilityCards)) {
                char.abilityCards.forEach(ab => {
                    if (ab.hasCounter && ab.resetType !== 'none') {
                        if (ab.usesCurrent !== ab.usesMax) {
                            ab.usesCurrent = ab.usesMax || 0;
                            restoredAbilities.push(ab.name);
                        }
                    }
                });
            }

            // 2. Full HP restoration
            char.hpCurrent = char.hpMax || 0;

            // 3. Spell slots restoration
            let spellSlotsRestored = false;
            if (char.spellSlots) {
                Object.keys(char.spellSlots).forEach(lvl => {
                    if (char.spellSlots[lvl] && char.spellSlots[lvl].max > 0) {
                        if (char.spellSlots[lvl].current < char.spellSlots[lvl].max) {
                            spellSlotsRestored = true;
                        }
                        char.spellSlots[lvl].current = char.spellSlots[lvl].max;
                    }
                });
            }

            // 4. Hit Dice recovery (half total HD rounded down, min 1 if spent > 0)
            const hdMax = {};
            let totalHitDice = 0;
            if (char.classes && char.classes.length > 0) {
                char.classes.forEach(c => {
                    const hd = getClassHitDie(c.name);
                    const count = (parseInt(c.level) || 1);
                    hdMax[hd] = (hdMax[hd] || 0) + count;
                    totalHitDice += count;
                });
            } else {
                const count = char.level || 1;
                hdMax['d8'] = count;
                totalHitDice = count;
            }

            char.hitDiceSpent = char.hitDiceSpent || {};
            let totalSpent = 0;
            Object.keys(char.hitDiceSpent).forEach(hd => {
                totalSpent += char.hitDiceSpent[hd] || 0;
            });

            let regainedHdCount = 0;
            if (totalSpent > 0) {
                let hdToRecover = Math.max(1, Math.floor(totalHitDice / 2));
                hdToRecover = Math.min(hdToRecover, totalSpent);
                regainedHdCount = hdToRecover;

                // Priority to largest die types first (d12 > d10 > d8 > d6)
                const dieRank = { 'd12': 12, 'd10': 10, 'd8': 8, 'd6': 6 };
                const sortedHdTypes = Object.keys(char.hitDiceSpent).sort((a, b) => {
                    const valA = dieRank[a] || 8;
                    const valB = dieRank[b] || 8;
                    return valB - valA;
                });

                for (const hd of sortedHdTypes) {
                    while (hdToRecover > 0 && char.hitDiceSpent[hd] > 0) {
                        char.hitDiceSpent[hd]--;
                        hdToRecover--;
                    }
                }
            }

            let msgText = `🌙 **${char.name || 'Player'}** completed a **Long Rest**. Fully restored HP (${char.hpCurrent}/${char.hpMax})`;
            if (regainedHdCount > 0) {
                msgText += `, regained ${regainedHdCount} Hit ${regainedHdCount === 1 ? 'Die' : 'Dice'}`;
            }
            if (spellSlotsRestored) {
                msgText += `, restored Spell Slots`;
            }
            if (restoredAbilities.length > 0) {
                msgText += `, and restored abilities: ${restoredAbilities.join(', ')}`;
            }
            msgText += `.`;

            vtt.socket.emit('chat:msg', { text: msgText });
            saveAndEmit(char);
            renderSheetData(char);
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
            
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:120px;">
                    <label>Species / Race</label>
                    <select id="pc-race" data-val="${char.race}" style="width:100%;">
                        <option value="${char.race}">${char.race || 'Select Species'}</option>
                    </select>
                </div>
                <div class="form-group" style="flex:1; min-width:120px;">
                    <label>Background</label>
                    <select id="pc-background" data-val="${char.background}" style="width:100%;">
                        <option value="${char.background}">${char.background || 'Select Background'}</option>
                    </select>
                </div>
            </div>
            
            <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:80px;">
                    <label>Max HP</label>
                    <input type="number" id="pc-hpMax" value="${char.hpMax}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:80px;">
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
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:70px;">
                    <label>Age</label>
                    <input type="text" id="pc-bio-age" value="${char.bio.age}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:70px;">
                    <label>Height (ft)</label>
                    <input type="text" id="pc-bio-height" value="${char.bio.height}" style="width:100%;">
                </div>
                <div class="form-group" style="flex:1; min-width:70px;">
                    <label>Weight (lbs)</label>
                    <input type="text" id="pc-bio-weight" value="${char.bio.weight}" style="width:100%;">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>Backstory</label>
                <textarea id="pc-bio-backstory" class="scroll-styled" style="height:120px; resize:vertical; background:rgba(0,0,0,0.35); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:10px 14px; border-radius:6px; font-family:var(--font-primary); font-size:0.9rem; line-height:1.5;">${char.bio.backstory}</textarea>
            </div>
            <div class="form-group">
                <label>Other Notes</label>
                <textarea id="pc-bio-notes" class="scroll-styled" style="height:120px; resize:vertical; background:rgba(0,0,0,0.35); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); padding:10px 14px; border-radius:6px; font-family:var(--font-primary); font-size:0.9rem; line-height:1.5;">${char.bio.notes}</textarea>
            </div>
            <button id="pc-save-build" class="btn btn-primary btn-block mb-4 mt-2">Save Build & Info</button>
        `;
        document.getElementById('ps-build').innerHTML = buildHtml;
        
        function loadSubclassesForClass(className, selectEl) {
            if (!className) {
                selectEl.innerHTML = '<option value="">None</option>';
                return;
            }
            const currentSubclass = selectEl.dataset.val;
            const rawClassName = className.replace(/\s*\[.*?\]$/, '').trim().toLowerCase();

            if (builderCache && Array.isArray(builderCache.classes)) {
                const matchedClasses = builderCache.classes.filter(c => c.name.toLowerCase() === rawClassName);
                if (matchedClasses.length > 0) {
                    let opts = '<option value="">None</option>';
                    const allSubclasses = [];
                    const seen = new Set();
                    matchedClasses.forEach(cls => {
                        (cls.subclasses || []).forEach(sc => {
                            const badge = getDisplaySourceBadge(sc.source);
                            const tag = badge ? ` [${badge}]` : (sc.source ? ` [${sc.source}]` : '');
                            const fullSubName = `${sc.name}${tag}`;
                            const subKey = `${sc.name.toLowerCase()}|${(sc.source || '').toLowerCase()}`;
                            if (!seen.has(subKey)) {
                                seen.add(subKey);
                                allSubclasses.push({
                                    ...sc,
                                    fullSubName,
                                    badge,
                                    tag
                                });
                            }
                        });
                    });
                    allSubclasses.sort((a, b) => a.fullSubName.localeCompare(b.fullSubName));
                    allSubclasses.forEach(sc => {
                        const isSel = (sc.fullSubName === currentSubclass || sc.name === currentSubclass);
                        opts += `<option value="${sc.fullSubName}" data-name="${sc.name}" data-source="${sc.source}" ${isSel ? 'selected' : ''}>${sc.fullSubName}</option>`;
                    });
                    selectEl.innerHTML = opts;
                    return;
                }
            }

            const file = builderCache?.classIndex ? builderCache.classIndex[rawClassName] : null;
            if (!file) {
                selectEl.innerHTML = '<option value="">None</option>';
                return;
            }

            fetch(`data/class/${file}`).then(r => r.json()).then(data => {
                if (data && data.subclass) {
                    let opts = '<option value="">None</option>';
                    const seen = new Set();
                    const list = [];
                    data.subclass.forEach(sc => {
                        const badge = getDisplaySourceBadge(sc.source);
                        const tag = badge ? ` [${badge}]` : (sc.source ? ` [${sc.source}]` : '');
                        const fullSubName = `${sc.name}${tag}`;
                        const subKey = `${sc.name.toLowerCase()}|${(sc.source || '').toLowerCase()}`;
                        if (!seen.has(subKey)) {
                            seen.add(subKey);
                            list.push({ ...sc, fullSubName });
                        }
                    });
                    list.sort((a, b) => a.fullSubName.localeCompare(b.fullSubName));
                    list.forEach(sc => {
                        const isSel = (sc.fullSubName === currentSubclass || sc.name === currentSubclass);
                        opts += `<option value="${sc.fullSubName}" ${isSel ? 'selected' : ''}>${sc.fullSubName}</option>`;
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
                const seenRaces = new Set();
                builderCache.races.forEach(r => {
                    const badge = getDisplaySourceBadge(r.source);
                    const srcTag = badge ? ` [${badge}]` : (r.source ? ` [${r.source}]` : '');
                    const fullVal = `${r.name}${srcTag}`;
                    if (seenRaces.has(fullVal)) return;
                    seenRaces.add(fullVal);
                    const isSel = (fullVal === currentRace || r.name === currentRace || (r.id && r.id === currentRace));
                    opts += `<option value="${fullVal}" data-id="${r.id || ''}" data-name="${r.name}" data-source="${r.source || ''}" ${isSel ? 'selected' : ''}>${fullVal}</option>`;
                });
                raceSel.innerHTML = opts;
            }

            const bgSel = document.getElementById('pc-background');
            if (bgSel) {
                const currentBg = bgSel.dataset.val;
                let opts = '<option value="">Select Background</option>';
                const seenBgs = new Set();
                builderCache.bgs.forEach(b => {
                    const badge = getDisplaySourceBadge(b.source);
                    const srcTag = badge ? ` [${badge}]` : (b.source ? ` [${b.source}]` : '');
                    const fullVal = `${b.name}${srcTag}`;
                    if (seenBgs.has(fullVal)) return;
                    seenBgs.add(fullVal);
                    const isSel = (fullVal === currentBg || b.name === currentBg || (b.id && b.id === currentBg));
                    opts += `<option value="${fullVal}" data-id="${b.id || ''}" data-name="${b.name}" data-source="${b.source || ''}" ${isSel ? 'selected' : ''}>${fullVal}</option>`;
                });
                bgSel.innerHTML = opts;
            }

            const currentClassNames = char.classes.map(c => c.name);
            document.querySelectorAll('.pc-class-sel').forEach(sel => {
                const currentCls = sel.dataset.val;
                let opts = '<option value="">Select Class</option>';
                if (builderCache.classes && Array.isArray(builderCache.classes)) {
                    const classMap = new Map();
                    builderCache.classes.forEach(c => {
                        const badge = getDisplaySourceBadge(c.source);
                        const tag = badge ? ` [${badge}]` : (c.source ? ` [${c.source}]` : '');
                        const fullName = `${c.name}${tag}`;
                        if (!classMap.has(fullName)) {
                            classMap.set(fullName, { ...c, fullName });
                        }
                    });
                    const sortedClasses = Array.from(classMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
                    sortedClasses.forEach(c => {
                        const fullName = c.fullName;
                        const isSel = (fullName === currentCls || c.name === currentCls || (currentCls && currentCls.startsWith(c.name) && currentCls.includes(c.source)));
                        const disabled = currentClassNames.includes(fullName) && fullName !== currentCls ? 'disabled' : '';
                        opts += `<option value="${fullName}" data-name="${c.name}" data-source="${c.source}" data-id="${c.id}" ${isSel ? 'selected' : ''} ${disabled}>${fullName}</option>`;
                    });
                } else if (builderCache.classIndex) {
                    Object.keys(builderCache.classIndex).forEach(cKey => {
                        const name = cKey.charAt(0).toUpperCase() + cKey.slice(1);
                        const disabled = currentClassNames.includes(name) && name !== currentCls ? 'disabled' : '';
                        opts += `<option value="${name}" ${name === currentCls ? 'selected' : ''} ${disabled}>${name}</option>`;
                    });
                }
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

        ensureBuilderCache().then(() => {
            populateBuildDropdowns();
        });

        char.currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        char.containers = char.containers || [];
        char.equipment = char.equipment || [];
        char.equipment.forEach(eq => { if (eq.containerId === undefined) eq.containerId = null; });

        const coinCount = (parseInt(char.currency.cp) || 0) + (parseInt(char.currency.sp) || 0) + (parseInt(char.currency.ep) || 0) + (parseInt(char.currency.gp) || 0) + (parseInt(char.currency.pp) || 0);
        const coinWeight = coinCount * 0.02;

        // Container weight calculation
        const getContainerEffectiveWeight = (c) => {
            const cItems = char.equipment.filter(eq => eq.containerId === c.id);
            const rawWeight = cItems.reduce((acc, eq) => acc + ((parseFloat(eq.weight) || 0) * (parseInt(eq.qty) || 1)), 0);
            if (c.weightRule === 'fixed') {
                return parseFloat(c.customWeight) || 0;
            } else if (c.weightRule === 'weightless') {
                return 0;
            }
            return rawWeight;
        };

        const unbaggedWeight = char.equipment.filter(eq => !eq.containerId).reduce((acc, eq) => acc + ((parseFloat(eq.weight) || 0) * (parseInt(eq.qty) || 1)), 0);
        const totalEquipWeight = unbaggedWeight + char.containers.reduce((acc, c) => acc + getContainerEffectiveWeight(c), 0);
        const totalWeight = totalEquipWeight + coinWeight;

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

        const renderEquipRowHtml = (eq, i) => `
            <div class="equip-row glassmorphism" data-idx="${i}" data-container-id="${eq.containerId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="pc-equip-drag-handle" data-idx="${i}" title="Click and drag to move/reorder item" style="cursor:grab; padding:2px 8px 2px 2px; opacity:0.6; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                        <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                    </div>
                    <div class="pc-equip-toggle" data-idx="${i}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); flex:1; min-width:0; display:flex; align-items:center; gap:6px; padding-right:8px;" title="Click to expand/collapse description">
                        <i class="fa-solid fa-chevron-right text-gradient-gold" style="font-size:0.8rem; flex-shrink:0; transition:transform 0.2s;" id="pc-equip-chevron-${i}"></i>
                        <span style="word-break:break-word; overflow-wrap:anywhere;">${eq.name}</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                        <span style="font-size:0.8rem; color:var(--color-text-muted);">Wt: ${eq.weight || 0} lb</span>
                        <div style="display:flex; align-items:center; gap:4px; margin: 0 2px;">
                            <button class="btn btn-xxs btn-secondary pc-equip-qty-minus" data-idx="${i}">-</button>
                            <span style="font-size:0.8rem; width:16px; text-align:center;">${eq.qty}</span>
                            <button class="btn btn-xxs btn-secondary pc-equip-qty-plus" data-idx="${i}">+</button>
                        </div>
                        <button class="btn btn-xxs btn-secondary pc-equip-ping" data-idx="${i}" title="Ping Item to Chat"><i class="fa-solid fa-comment-dots"></i></button>
                    </div>
                </div>
                <div class="pc-equip-desc vtt-hidden" id="pc-equip-desc-${i}" style="padding: 8px 4px 0 16px; font-size: 0.85rem; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-subtle); margin-top: 4px; line-height: 1.4;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.75rem; color:var(--color-text-muted);"><i class="fa-solid fa-box-archive" style="color:var(--color-gold-base);"></i> Move to:</span>
                            <select class="pc-equip-container-select" data-idx="${i}" title="Move to Bag" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.75rem; border-radius:4px; padding:2px 6px; max-width:140px;">
                                <option value="" ${!eq.containerId ? 'selected' : ''}>Main Inventory</option>
                                ${(char.containers || []).map(c => `
                                    <option value="${c.id}" ${eq.containerId === c.id ? 'selected' : ''}>📦 ${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <button class="btn btn-xxs btn-secondary pc-equip-edit" data-idx="${i}" title="Edit Item"><i class="fa-solid fa-pen"></i> Edit Item</button>
                    </div>
                    <div style="white-space: pre-wrap;">
                        ${(function () {
                            if (!eq.description) return '<i style="opacity:0.5;">No description available.</i>';
                            let html = eq.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            html = html.replace(/\*\*(.*?)\*\*(.*?)\*\*/g, '<b>$1</b>');
                            html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
                            html = html.replace(/---/g, '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;">');
                            return html;
                        })()}
                    </div>
                </div>
            </div>
        `;

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
                    <button id="btn-create-bag" class="btn btn-secondary btn-xs"><i class="fa-solid fa-sack-xmark"></i> Create Bag</button>
                    <button id="btn-add-equip-db" class="btn btn-secondary btn-xs"><i class="fa-solid fa-book-open"></i> Add Items</button>
                    <button id="btn-add-equip-custom" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Custom Item</button>
                </div>
            </div>
            <div id="pc-equip-list" style="display:flex; flex-direction:column; gap:8px;">
                ${(function() {
                    let html = '';
                    // 1. Bags / Containers Accordions
                    (char.containers || []).forEach((c, cIdx) => {
                        const cItems = char.equipment.map((eq, i) => ({ eq, i })).filter(({ eq }) => eq.containerId === c.id);
                        const itemWeightSum = cItems.reduce((acc, { eq }) => acc + ((parseFloat(eq.weight) || 0) * (parseInt(eq.qty) || 1)), 0);
                        
                        let weightLabel = `${itemWeightSum.toFixed(1)} lb`;
                        if (c.weightRule === 'fixed') {
                            weightLabel = `${(parseFloat(c.customWeight) || 0).toFixed(1)} lb (Fixed)`;
                        } else if (c.weightRule === 'weightless') {
                            weightLabel = `0.0 lb (Weightless)`;
                        }

                        html += `
                            <div class="pc-bag-card glassmorphism" data-container-id="${c.id}" data-container-idx="${cIdx}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                                <div class="pc-bag-header" data-container-id="${c.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                    <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                        <div class="pc-bag-drag-handle" data-container-idx="${cIdx}" title="Click and drag to reorder bag" style="cursor:grab; opacity:0.5; padding-right:4px;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.5'; this.style.color='inherit';" onclick="event.stopPropagation();">
                                            <i class="fa-solid fa-grip-vertical"></i>
                                        </div>
                                        <i class="fa-solid ${c.icon || 'fa-sack-xmark'} text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                        <i class="fa-solid fa-chevron-right text-gradient-gold pc-bag-chevron" data-container-id="${c.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${c.collapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"></i>
                                        <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
                                        <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${cItems.length} item${cItems.length !== 1 ? 's' : ''} • ${weightLabel}</span>
                                    </div>
                                    <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" onclick="event.stopPropagation();">
                                        <button class="btn btn-xxs btn-secondary pc-bag-edit" data-container-id="${c.id}" title="Edit Bag"><i class="fa-solid fa-pen"></i></button>
                                        <button class="btn btn-xxs btn-danger pc-bag-del" data-container-id="${c.id}" title="Delete Bag"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                                <div class="pc-bag-contents ${c.collapsed ? 'vtt-hidden' : ''}" data-container-id="${c.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                    ${cItems.map(({ eq, i }) => renderEquipRowHtml(eq, i)).join('')}
                                    ${cItems.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this bag.</div>` : ''}
                                </div>
                            </div>
                        `;
                    });

                    // 2. Main Inventory (Unbagged items)
                    const unbaggedItems = char.equipment.map((eq, i) => ({ eq, i })).filter(({ eq }) => !eq.containerId);
                    html += `
                        <div class="pc-bag-card glassmorphism" data-container-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                            <div class="pc-bag-header pc-main-inv-header" data-container-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                    <i class="fa-solid fa-backpack text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                    <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Main Inventory (Carried)</span>
                                    <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${unbaggedItems.length} item${unbaggedItems.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            <div class="pc-bag-contents" data-container-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                                ${unbaggedItems.map(({ eq, i }) => renderEquipRowHtml(eq, i)).join('')}
                                ${unbaggedItems.length === 0 && (char.containers || []).length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All items are packed into bags.</div>` : ''}
                                ${char.equipment.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No items added yet.</div>` : ''}
                            </div>
                        </div>
                    `;
                    return html;
                })()}
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
                                        <span style="font-size:0.9rem; font-weight:600;">All Spells</span>
                                        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; color:var(--color-text-secondary); user-select:none;">
                                            <input type="checkbox" id="all-spells-prep-only" style="cursor:pointer;">
                                            <span>Show Prepared Only</span>
                                        </label>
                                    </div>
                                    <div style="margin-bottom:12px;">
                                        <input type="text" id="all-spells-search" placeholder="Search spells..." style="width:100%; padding:6px; font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                                    </div>
                                    <div id="all-spells-list" style="display:flex; flex-direction:column; gap:16px;">
                                        ${spellLevels.filter(lvl => lvl.key !== 'all').map(lvl => {
                                            const allLvlSpells = char.spells[lvl.key] || [];
                                            const lvlSpellsRendered = allLvlSpells
                                                .map((sp, idx) => ({ sp, idx }))
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

        document.querySelectorAll('#ps-spells .btn-add-spell').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.currentTarget.dataset.level || 'cantrip';
                const openFn = (window.VTTSpellManager && window.VTTSpellManager.openModal) || window.openSpellModal;
                if (openFn) {
                    openFn(level, -1, char, (updatedChar) => {
                        if (updatedChar) {
                            Object.assign(char, updatedChar);
                            saveAndEmit(char);
                            renderSheetData(char);
                        }
                    });
                }
            });
        });

        document.querySelectorAll('#ps-spells .pc-spell-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.currentTarget.dataset.level;
                const idx = parseInt(e.currentTarget.dataset.idx);
                const openFn = (window.VTTSpellManager && window.VTTSpellManager.openModal) || window.openSpellModal;
                if (level && idx >= 0 && openFn) {
                    openFn(level, idx, char, (updatedChar) => {
                        if (updatedChar) {
                            Object.assign(char, updatedChar);
                            saveAndEmit(char);
                            renderSheetData(char);
                        }
                    });
                }
            });
        });

        const renderMacroRowHtml = (m, i) => `
            <div class="macro-row glassmorphism" data-idx="${i}" data-category-id="${m.categoryId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:6px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                        <div class="pc-macro-drag-handle" data-idx="${i}" title="Click and drag to move/reorder macro" style="cursor:grab; opacity:0.6; padding-right:4px; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                            <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                        </div>
                        <button class="btn pc-macro-roll-all" data-idx="${i}" title="Roll all: ${m.name}" style="font-weight:600; color:var(--color-text-primary); background:transparent; border:none; padding:0; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:0.875rem; font-family:inherit; transition:color 0.15s ease; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" onmouseover="this.style.color='var(--color-gold-light)'" onmouseout="this.style.color='var(--color-text-primary)'"><i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${m.name}</button>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
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
                <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${((m.attackStat && m.attackStat !== 'none') || m.attackBonus) ? `<button class="btn btn-xxs btn-primary pc-macro-attack" data-idx="${i}">⚔️ Attack (${calculatedAtkBonus(m)})</button>` : ''}
                        ${m.saveAbility ? `<button class="btn btn-xxs btn-secondary pc-macro-save" data-idx="${i}">🛡️ DC ${calculatedSaveDc(m)} ${m.saveAbility}</button>` : ''}
                        ${m.damage && m.damage.length ? `<button class="btn btn-xxs btn-danger pc-macro-damage" data-idx="${i}">💥 Damage</button>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
                        <span style="font-size:0.7rem; color:var(--color-text-muted);"><i class="fa-solid fa-folder" style="color:var(--color-gold-base); font-size:0.65rem;"></i></span>
                        <select class="pc-macro-cat-select" data-idx="${i}" title="Move to Category" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.7rem; border-radius:4px; padding:1px 4px; max-width:120px;">
                            <option value="" ${!m.categoryId ? 'selected' : ''}>Uncategorized</option>
                            ${(char.macroCategories || []).map(c => `
                                <option value="${c.id}" ${m.categoryId === c.id ? 'selected' : ''}>📁 ${c.name}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;

        const formatAbilityCardDescription = (card) => {
            if (!card) return '';
            let raw = (card.description || '').trim();
            if (!raw && (!card.customFields || card.customFields.length === 0)) {
                return '<i style="opacity:0.6;">No description provided.</i>';
            }

            // Escape HTML entities to prevent malformed tags
            let safe = raw
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Standard clean markdown formatting:
            // Bold **text**
            safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--color-gold-light); font-weight:600;">$1</strong>');
            // Italic *text*
            safe = safe.replace(/(^|[^*])\*(?!\*)([^*]+)\*/g, '$1<em>$2</em>');

            // Handle newlines: normalize \r\n to \n
            safe = safe.replace(/\r\n/g, '\n');

            // Handle bullet items (e.g. "- Item" or "* Item" at start of line)
            safe = safe.replace(/^[ \t]*[-*][ \t]+(.+)$/gm, '&bull; $1');

            // Convert consecutive newlines to double break, single newline to single break
            safe = safe.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');

            // Append custom fields matching chat-card format
            if (Array.isArray(card.customFields) && card.customFields.length > 0) {
                const fieldsHtml = card.customFields.map(f => {
                    const l = (f.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const e = (f.entry || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<strong style="color:var(--color-gold-light); font-weight:600;">${l}:</strong> ${e}`;
                }).join('<br>');

                if (safe) {
                    safe += `<br><br>${fieldsHtml}`;
                } else {
                    safe = fieldsHtml;
                }
            }

            return safe;
        };

        const renderAbilityRowHtml = (card, i) => {
            const actionPill = (card.actionType && card.actionType !== 'passive') ? (
                card.actionType === 'bonus' ? `<span class="badge" style="background:#d97706; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Bonus</span>` :
                card.actionType === 'reaction' ? `<span class="badge" style="background:#2563eb; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Reaction</span>` :
                card.actionType === 'action' ? `<span class="badge" style="background:#16a34a; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">Action</span>` :
                `<span class="badge" style="background:#9333ea; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:3px; font-weight:600; text-transform:uppercase;">${card.actionType}</span>`
            ) : '';

            const evalFormula = evaluateAbilityFormula(card.formula, card.formulaConfig, char);
            const rollChipHtml = evalFormula ? `
                <button class="btn btn-xxs btn-secondary pc-ability-roll-chip" data-idx="${i}" data-formula="${evalFormula}" data-name="${card.name}" title="Click to Roll: ${evalFormula}" style="font-family:monospace; border-color:var(--color-gold-base); font-size:0.75rem; padding:2px 6px; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-dice-d20 text-gradient-gold"></i> ${evalFormula}
                </button>
            ` : '';

            return `
            <div class="ability-row glassmorphism" data-idx="${i}" data-category-id="${card.categoryId || ''}" draggable="true" style="padding:8px; display:flex; flex-direction:column; gap:4px; transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <div class="pc-ability-drag-handle" data-idx="${i}" title="Click and drag to move/reorder ability card" style="cursor:grab; opacity:0.6; padding-right:4px; display:flex; align-items:center; user-select:none; transition:opacity 0.15s, color 0.15s;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.6'; this.style.color='inherit';">
                            <i class="fa-solid fa-grip-vertical" style="font-size:0.9rem;"></i>
                        </div>
                        <i class="fa-solid fa-chevron-right pc-ability-expand" data-idx="${i}" style="transition:transform 0.2s; cursor:pointer; font-size:0.7rem; color:var(--color-text-muted);"></i>
                        <div class="pc-ability-ping" data-idx="${i}" style="cursor:pointer; font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-bolt text-gradient-gold"></i> ${card.name}
                            ${actionPill}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${rollChipHtml}
                        ${card.hasCounter ? `
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button class="btn btn-xxs btn-secondary pc-ability-uses-minus" data-idx="${i}">-</button>
                            <span style="font-size:0.8rem; font-family:monospace; min-width:24px; text-align:center;">${card.usesCurrent || 0} / ${card.usesMax || 0}</span>
                            <button class="btn btn-xxs btn-secondary pc-ability-uses-plus" data-idx="${i}">+</button>
                            <span style="font-size:0.65rem; color:var(--color-text-muted); opacity:0.8; margin-left:2px;" title="Resets on ${card.resetType === 'short' ? 'Short Rest' : card.resetType === 'none' ? 'Manual' : 'Long Rest'}">[${card.resetType === 'short' ? 'SR' : card.resetType === 'none' ? 'Man' : 'LR'}]</span>
                        </div>
                        ` : ''}
                        <button class="btn btn-xxs btn-secondary pc-ability-edit" data-idx="${i}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-xxs btn-danger pc-ability-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="pc-ability-details" id="pc-ability-details-${i}" style="display:none; font-size:0.85rem; margin-top:6px; border-top:1px solid rgba(255,255,255,0.08); padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:4px; line-height:1.5; color:var(--color-text-secondary); word-break:break-word;">
                    <div class="pc-ability-desc-content" style="white-space:normal;">${formatAbilityCardDescription(card)}</div>
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:0.72rem; color:var(--color-text-muted);"><i class="fa-solid fa-folder" style="color:var(--color-gold-base);"></i> Category:</span>
                            <select class="pc-ability-cat-select" data-idx="${i}" title="Move to Category" style="background:rgba(0,0,0,0.5); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); font-size:0.75rem; border-radius:4px; padding:2px 6px; max-width:140px;">
                                <option value="" ${!card.categoryId ? 'selected' : ''}>Uncategorized</option>
                                ${(char.abilityCategories || []).map(c => `
                                    <option value="${c.id}" ${card.categoryId === c.id ? 'selected' : ''}>📁 ${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            `;
        };

        let infoHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-burst"></i> Attacks & Macros</h4>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button id="btn-create-macro-cat" class="btn btn-secondary btn-xs"><i class="fa-solid fa-folder-plus"></i> Category</button>
                        <button id="btn-add-macro" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Attack</button>
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
                
                <div id="pc-macros-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                    ${(function() {
                        let html = '';
                        (char.macroCategories || []).forEach((c, cIdx) => {
                            const cItems = char.macros.map((m, i) => ({ m, i })).filter(({ m }) => m.categoryId === c.id);
                            html += `
                                <div class="pc-macro-cat-card glassmorphism" data-category-id="${c.id}" data-category-idx="${cIdx}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                                    <div class="pc-macro-cat-header" data-category-id="${c.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                        <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                            <div class="pc-macro-cat-drag-handle" data-category-idx="${cIdx}" title="Click and drag to reorder category" style="cursor:grab; opacity:0.5; padding-right:4px;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.5'; this.style.color='inherit';" onclick="event.stopPropagation();">
                                                <i class="fa-solid fa-grip-vertical"></i>
                                            </div>
                                            <i class="fa-solid fa-folder text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                            <i class="fa-solid fa-chevron-right text-gradient-gold pc-macro-cat-chevron" data-category-id="${c.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${c.collapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"></i>
                                            <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
                                            <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${cItems.length} item${cItems.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" onclick="event.stopPropagation();">
                                            <button class="btn btn-xxs btn-secondary pc-macro-cat-edit" data-category-id="${c.id}" title="Edit Category"><i class="fa-solid fa-pen"></i></button>
                                            <button class="btn btn-xxs btn-danger pc-macro-cat-del" data-category-id="${c.id}" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <div class="pc-macro-cat-contents ${c.collapsed ? 'vtt-hidden' : ''}" data-category-id="${c.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                        ${cItems.map(({ m, i }) => renderMacroRowHtml(m, i)).join('')}
                                        ${cItems.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this category.</div>` : ''}
                                    </div>
                                </div>
                            `;
                        });

                        const uncatMacros = char.macros.map((m, i) => ({ m, i })).filter(({ m }) => !m.categoryId);
                        html += `
                            <div class="pc-macro-cat-card glassmorphism" data-category-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                                <div class="pc-macro-cat-header pc-main-macro-header" data-category-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                    <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                        <i class="fa-solid fa-burst text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                        <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Uncategorized Attacks / Macros</span>
                                        <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${uncatMacros.length} item${uncatMacros.length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <div class="pc-macro-cat-contents" data-category-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                                    ${uncatMacros.map(({ m, i }) => renderMacroRowHtml(m, i)).join('')}
                                    ${uncatMacros.length === 0 && (char.macroCategories || []).length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All macros are organized into categories.</div>` : ''}
                                    ${char.macros.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No macros added yet.</div>` : ''}
                                </div>
                            </div>
                        `;
                        return html;
                    })()}
                </div>


            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="margin:0; color:var(--color-gold-base); font-family:var(--font-heading);"><i class="fa-solid fa-address-card"></i> Ability Cards</h4>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button id="btn-create-ability-cat" class="btn btn-secondary btn-xs"><i class="fa-solid fa-folder-plus"></i> Category</button>
                    <button id="btn-add-ability" class="btn btn-secondary btn-xs"><i class="fa-solid fa-plus"></i> Add Card</button>
                </div>
            </div>
            <div style="margin-bottom:8px; display:flex; gap:8px;">
                <input type="text" id="pc-ability-search" placeholder="Search ability cards by name or details..." style="flex:1; padding:4px 8px; font-size:0.8rem; background:rgba(0,0,0,0.3); color:var(--color-text-primary); border:1px solid var(--color-border-subtle); border-radius:4px;">
            </div>
            <div id="pc-ability-list" style="display:flex; flex-direction:column; gap:8px;">
                ${(function() {
                    let html = '';
                    (char.abilityCategories || []).forEach((c, cIdx) => {
                        const cItems = char.abilityCards.map((card, i) => ({ card, i })).filter(({ card }) => card.categoryId === c.id);
                        html += `
                            <div class="pc-ability-cat-card glassmorphism" data-category-id="${c.id}" data-category-idx="${cIdx}" draggable="true" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden; transition:border-color 0.15s, box-shadow 0.15s;">
                                <div class="pc-ability-cat-header" data-category-id="${c.id}" style="padding:8px 12px; background:rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                    <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                        <div class="pc-ability-cat-drag-handle" data-category-idx="${cIdx}" title="Click and drag to reorder category" style="cursor:grab; opacity:0.5; padding-right:4px;" onmouseover="this.style.opacity='1'; this.style.color='var(--color-gold-base)';" onmouseout="this.style.opacity='0.5'; this.style.color='inherit';" onclick="event.stopPropagation();">
                                            <i class="fa-solid fa-grip-vertical"></i>
                                        </div>
                                        <i class="fa-solid fa-folder text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                        <i class="fa-solid fa-chevron-right text-gradient-gold pc-ability-cat-chevron" data-category-id="${c.id}" style="font-size:0.75rem; flex-shrink:0; transition:transform 0.2s; transform:${c.collapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"></i>
                                        <span style="font-weight:700; font-size:0.875rem; color:var(--color-text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
                                        <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${cItems.length} item${cItems.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;" onclick="event.stopPropagation();">
                                        <button class="btn btn-xxs btn-secondary pc-ability-cat-edit" data-category-id="${c.id}" title="Edit Category"><i class="fa-solid fa-pen"></i></button>
                                        <button class="btn btn-xxs btn-danger pc-ability-cat-del" data-category-id="${c.id}" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                                <div class="pc-ability-cat-contents ${c.collapsed ? 'vtt-hidden' : ''}" data-category-id="${c.id}" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px; border-left:3px solid var(--color-gold-base); background:rgba(0,0,0,0.15);">
                                    ${cItems.map(({ card, i }) => renderAbilityRowHtml(card, i)).join('')}
                                    ${cItems.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">Drag items here or drop onto header to move into this category.</div>` : ''}
                                </div>
                            </div>
                        `;
                    });

                    const uncatAbilities = char.abilityCards.map((card, i) => ({ card, i })).filter(({ card }) => !card.categoryId);
                    html += `
                        <div class="pc-ability-cat-card glassmorphism" data-category-id="" style="border:1px solid var(--color-border-subtle); border-radius:8px; margin-bottom:4px; overflow:hidden;">
                            <div class="pc-ability-cat-header pc-main-ability-header" data-category-id="" style="padding:8px 12px; background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                                    <i class="fa-solid fa-address-card text-gradient-gold" style="font-size:0.95rem; flex-shrink:0;"></i>
                                    <span style="font-weight:700; font-size:0.875rem; color:var(--color-gold-light);">Uncategorized Abilities</span>
                                    <span style="font-size:0.75rem; color:var(--color-text-muted); background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:12px;">${uncatAbilities.length} item${uncatAbilities.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            <div class="pc-ability-cat-contents" data-category-id="" style="padding:8px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:8px;">
                                ${uncatAbilities.map(({ card, i }) => renderAbilityRowHtml(card, i)).join('')}
                                ${uncatAbilities.length === 0 && (char.abilityCategories || []).length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center; font-style:italic;">All abilities are organized into categories.</div>` : ''}
                                ${char.abilityCards.length === 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted); padding:8px; text-align:center;">No ability cards added yet.</div>` : ''}
                            </div>
                        </div>
                    `;
                    return html;
                })()}
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

        const popoutBtn = document.getElementById('pc-btn-popout');
        if (popoutBtn) {
            popoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.SheetWindowManager && currentChar) {
                    window.SheetWindowManager.openPopout({
                        type: 'player',
                        id: currentChar.id,
                        name: currentChar.name
                    });
                    minimizePanel();
                }
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
            const dexScore = getTotalStat(char, 'dex') || 10;
            const dexMod = getMod(dexScore);
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

            let isTiebreaker = true;
            if (window.VTT?.campaignState?.settings?.initDexTiebreaker !== undefined) {
                isTiebreaker = !!window.VTT.campaignState.settings.initDexTiebreaker;
            } else if (window.VTT?.canvasEngine?.getCampaignSettings) {
                isTiebreaker = window.VTT.canvasEngine.getCampaignSettings().initDexTiebreaker !== false;
            }

            if (isTiebreaker && rollData && typeof rollData.total === 'number') {
                const dexTiebreaker = Math.round(dexScore) / 100;
                rollData.total = Math.round((rollData.total + dexTiebreaker) * 100) / 100;
            }

            vtt.socket.emit('chat:msg', {
                text: `[${char.name}] rolls **Initiative**`,
                roll: rollData
            });

            // Automatically link or auto-spawn token on canvas and register to Initiative tracker
            if (window.VTT && window.VTT.chatEngine) {
                const canvasEngine = window.VTT.canvasEngine;
                let linkedToken = null;

                if (canvasEngine) {
                    const tokens = canvasEngine.getTokens ? canvasEngine.getTokens() : {};
                    const selectedIds = canvasEngine.getSelectedTokenIds ? canvasEngine.getSelectedTokenIds() : [];

                    // 1. Check if an active selected token belongs to this character
                    for (const id of selectedIds) {
                        const t = tokens[id];
                        if (t && (t.characterId === char.id || (t.isPlayer && t.name === char.name))) {
                            linkedToken = t;
                            break;
                        }
                    }

                    // 2. If not selected, check if any token on the canvas belongs to this character
                    if (!linkedToken) {
                        for (const id in tokens) {
                            const t = tokens[id];
                            if (t && (t.characterId === char.id || (t.isPlayer && t.name === char.name))) {
                                linkedToken = t;
                                break;
                            }
                        }
                    }

                    // 3. If still no token exists on the canvas, auto-spawn one at canvas viewport center
                    if (!linkedToken && canvasEngine.addToken) {
                        let spawnX = 200;
                        let spawnY = 200;
                        if (canvasEngine.getCanvasMouseCoords) {
                            const center = canvasEngine.getCanvasMouseCoords({
                                clientX: window.innerWidth / 2,
                                clientY: window.innerHeight / 2
                            });
                            if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
                                spawnX = Math.round(center.x);
                                spawnY = Math.round(center.y);
                            }
                        }

                        const activeImg = char.tokenImage || char.avatar || char.img || 'favicon.svg';
                        const newToken = {
                            id: 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                            name: char.name,
                            characterId: char.id,
                            isPlayer: true,
                            layer: 'token',
                            x: spawnX,
                            y: spawnY,
                            hp: char.hpCurrent !== undefined ? char.hpCurrent : (char.hp?.current || 10),
                            maxHp: char.hpMax !== undefined ? char.hpMax : (char.hp?.max || 10),
                            tempHp: char.tempHp || 0,
                            size: char.tokenSize || 1,
                            sightRange: char.tokenSight !== undefined ? char.tokenSight : 60,
                            img: activeImg
                        };

                        canvasEngine.addToken(newToken);
                        linkedToken = newToken;
                    }
                }

                // Register into initiative roster
                const tokenId = linkedToken ? linkedToken.id : null;
                const tokenImg = linkedToken ? linkedToken.img : (char.tokenImage || char.avatar || char.img || null);
                window.VTT.chatEngine.addToInitiative(char.name, rollData.total, tokenId, tokenImg);
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
                    <input type="text" class="modal-dmg-formula" data-idx="${i}" value="${d.formula || d.dice || ''}" placeholder="1d8" style="width:30%; padding:4px; font-size:0.8rem;">
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
                        ${dmgTypes.map(t => `<option value="${t}" ${(d.type || '').toLowerCase() === t.toLowerCase() ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <button class="btn btn-xxs btn-danger modal-dmg-del" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `).join('');

            document.querySelectorAll('.modal-dmg-formula').forEach(el => {
                el.addEventListener('input', (e) => { if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].formula = e.target.value; });
                el.addEventListener('change', (e) => { if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].formula = e.target.value; });
            });
            document.querySelectorAll('.modal-dmg-stat').forEach(el => el.addEventListener('change', (e) => { if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].stat = e.target.value; }));
            document.querySelectorAll('.modal-dmg-type').forEach(el => el.addEventListener('change', (e) => { if (modalDamageRows[e.target.dataset.idx]) modalDamageRows[e.target.dataset.idx].type = e.target.value; }));
            document.querySelectorAll('.modal-dmg-del').forEach(el => el.addEventListener('click', (e) => {
                modalDamageRows.splice(e.currentTarget.dataset.idx, 1);
                renderModalDamage();
            }));
        }

        let _initialMacroSnapshot = '';
        function getMacroModalSnapshot() {
            const m = document.getElementById('pc-macro-modal');
            if (!m) return '';
            const inputs = Array.from(m.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')).map(el => {
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            });
            return JSON.stringify(inputs);
        }

        function ensureMacroModalExists() {
            if (document.getElementById('pc-macro-modal')) return;

            const container = document.createElement('div');
            container.id = 'pc-macro-modal-container';
            container.innerHTML = `
                <div id="pc-macro-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
                <div id="pc-macro-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); padding:16px; border-radius:8px; z-index:3010; width:400px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                        <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="modal-macro-title"><i class="fa-solid fa-dice-d20"></i> Edit Macro</h3>
                        <button id="modal-macro-close-btn" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="modal-macro-idx" value="-1">
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Name</label>
                        <input type="text" id="modal-macro-name" style="width:100%;">
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Category</label>
                        <select id="modal-macro-category" style="width:100%; padding:4px; font-size:0.8rem;">
                            <option value="">Uncategorized</option>
                        </select>
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
            `;
            document.body.appendChild(container);

            document.getElementById('modal-macro-close-btn')?.addEventListener('click', () => closeMacroModal(false));
            document.getElementById('modal-macro-cancel')?.addEventListener('click', () => closeMacroModal(false));
            document.getElementById('pc-macro-overlay')?.addEventListener('click', () => closeMacroModal(false));

            document.getElementById('modal-macro-atk-stat')?.addEventListener('change', updateModalVisibility);
            document.getElementById('modal-macro-save-dc-stat')?.addEventListener('change', updateModalVisibility);

            document.getElementById('modal-macro-add-dmg')?.addEventListener('click', () => {
                modalDamageRows.push({ id: 'dmg_' + Date.now(), formula: '1d8', stat: '', type: 'Slashing' });
                renderModalDamage();
            });
        }

        function openMacroModal(idx = -1) {
            ensureMacroModalExists();
            document.getElementById('pc-macro-modal').classList.remove('vtt-hidden');
            document.getElementById('pc-macro-overlay').classList.remove('vtt-hidden');
            document.getElementById('modal-macro-idx').value = idx;

            if (idx >= 0) {
                const m = char.macros[idx];
                document.getElementById('modal-macro-name').value = m.name || '';
                const catSel = document.getElementById('modal-macro-category');
                if (catSel) {
                    catSel.innerHTML = '<option value="">Uncategorized</option>' + (char.macroCategories || []).map(c => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                    catSel.value = m.categoryId || '';
                }
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
                modalDamageRows.forEach(r => {
                    if (!r.formula && r.dice) r.formula = r.dice;
                });
            } else {
                document.getElementById('modal-macro-name').value = '';
                const catSel = document.getElementById('modal-macro-category');
                if (catSel) {
                    catSel.innerHTML = '<option value="">Uncategorized</option>' + (char.macroCategories || []).map(c => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                    catSel.value = '';
                }
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
            _initialMacroSnapshot = getMacroModalSnapshot();
        }

        function closeMacroModal(force = false) {
            if (!force && _initialMacroSnapshot && getMacroModalSnapshot() !== _initialMacroSnapshot) {
                if (!confirm('Discard unsaved changes?')) {
                    return;
                }
            }
            document.getElementById('pc-macro-modal')?.classList.add('vtt-hidden');
            document.getElementById('pc-macro-overlay')?.classList.add('vtt-hidden');
            _initialMacroSnapshot = '';
        }

        document.getElementById('btn-add-macro')?.addEventListener('click', () => openMacroModal(-1));

        // Re-bind save listener so it always uses latest active character
        const saveMacroBtn = document.getElementById('modal-macro-save');
        if (saveMacroBtn) {
            saveMacroBtn.onclick = () => {
                const activeChar = currentChar || char;
                if (!activeChar) return;
                const idx = parseInt(document.getElementById('modal-macro-idx').value);
                const atkStat = document.getElementById('modal-macro-atk-stat').value;
                const dcStat = document.getElementById('modal-macro-save-dc-stat').value;

                // Synchronously harvest live DOM values for damage rows
                const updatedDamageRows = [];
                document.querySelectorAll('#modal-macro-dmg-list > div').forEach((rowEl, i) => {
                    const formulaInp = rowEl.querySelector('.modal-dmg-formula');
                    const statSel = rowEl.querySelector('.modal-dmg-stat');
                    const typeSel = rowEl.querySelector('.modal-dmg-type');
                    const prev = modalDamageRows[i] || {};
                    updatedDamageRows.push({
                        id: prev.id || ('dmg_' + Date.now() + '_' + i),
                        formula: formulaInp ? formulaInp.value.trim() : (prev.formula || prev.dice || ''),
                        stat: statSel ? statSel.value : (prev.stat || ''),
                        extra: prev.extra !== undefined ? prev.extra : 0,
                        type: typeSel ? typeSel.value : (prev.type || ''),
                        label: prev.label || ''
                    });
                });

                const m = {
                    id: idx >= 0 ? activeChar.macros[idx].id : 'mac_' + Date.now(),
                    name: document.getElementById('modal-macro-name').value || 'New Macro',
                    categoryId: document.getElementById('modal-macro-category')?.value || null,
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

                    damage: updatedDamageRows.length ? updatedDamageRows : modalDamageRows
                };
                if (idx >= 0) activeChar.macros[idx] = m;
                else activeChar.macros.push(m);
                closeMacroModal(true);
                saveAndEmit(activeChar);
                renderSheetData(activeChar);
            };
        }

        document.querySelectorAll('.pc-macro-edit').forEach(btn => btn.addEventListener('click', (e) => openMacroModal(e.currentTarget.dataset.idx)));
        document.querySelectorAll('.pc-macro-del').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Delete this macro?")) {
                char.macros.splice(e.currentTarget.dataset.idx, 1);
                saveAndEmit(char); renderSheetData(char);
            }
        }));

        // Macro Category Management
        document.getElementById('btn-create-macro-cat')?.addEventListener('click', () => openCategoryModal('macro'));

        document.querySelectorAll('.pc-macro-cat-edit').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCategoryModal('macro', e.currentTarget.dataset.categoryId);
        }));

        document.querySelectorAll('.pc-macro-cat-del').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCategoryDeleteModal('macro', e.currentTarget.dataset.categoryId);
        }));

        document.querySelectorAll('.pc-macro-cat-header').forEach(hdr => hdr.addEventListener('click', (e) => {
            const cId = e.currentTarget.dataset.categoryId;
            if (!cId) return;
            const cat = (char.macroCategories || []).find(c => c.id === cId);
            if (cat) {
                cat.collapsed = !cat.collapsed;
                saveAndEmit(char);
                renderSheetData(char);
            }
        }));

        document.querySelectorAll('.pc-macro-cat-select').forEach(sel => sel.addEventListener('change', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const newCatId = e.currentTarget.value || null;
            if (char.macros && char.macros[idx]) {
                char.macros[idx].categoryId = newCatId;
                saveAndEmit(char);
                renderSheetData(char);
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
                let formula = (d.formula || d.dice || '').trim();
                let statMod = 0;

                let statKey = (d.stat || '').replace(/^\+/, '').trim().toLowerCase();
                if (statKey === 'auto') {
                    statKey = (m.attackStat || 'str').toLowerCase();
                }
                if (statKey && statKey !== 'none') {
                    if (statKey === 'spell') {
                        statKey = (char.spellSettings?.ability || char.spellcastingAbility || 'int').toLowerCase();
                    }
                    const score = getTotalStat(char, statKey) || 10;
                    statMod = getMod(score);
                }

                let rollFormula = formula;
                if (statMod !== 0) {
                    rollFormula += `${statMod >= 0 ? '+' : ''}${statMod}[${(statKey || 'STAT').toUpperCase()}]`;
                }
                if (d.extra && parseInt(d.extra)) {
                    const ex = parseInt(d.extra);
                    rollFormula += `${ex >= 0 ? '+' : ''}${ex}[Bonus]`;
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
                return { formula: d.formula || d.dice || formula, type: d.type || '', roll: r, label: d.label || '' };
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

        // Category Modal & Management Logic
        function ensureCategoryModalExists() {
            if (document.getElementById('pc-category-modal')) return;

            const modalHtml = `
                <div id="pc-category-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
                <div id="pc-category-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3010; width:380px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                        <h3 style="margin:0; color:var(--color-gold-base); font-size:1.05rem;" id="modal-cat-title"><i class="fa-solid fa-folder-plus"></i> Add Category</h3>
                        <button id="modal-cat-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="modal-cat-type" value="macro">
                    <input type="hidden" id="modal-cat-id" value="">
                    <div class="form-group" style="margin-bottom:16px;">
                        <label style="font-size:0.8rem; font-weight:600; margin-bottom:6px; display:block; color:var(--color-text-primary);">Category Name</label>
                        <input type="text" id="modal-cat-name" placeholder="e.g. Melee Attacks, Class Features, Feats" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                        <button id="modal-cat-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                        <button id="modal-cat-save" class="btn btn-primary btn-xs">Save Category</button>
                    </div>
                </div>
            `;
            const div = document.createElement('div');
            div.innerHTML = modalHtml;
            document.body.appendChild(div);

            const closeCatModal = () => {
                document.getElementById('pc-category-modal').classList.add('vtt-hidden');
                document.getElementById('pc-category-overlay').classList.add('vtt-hidden');
            };

            document.getElementById('modal-cat-close').addEventListener('click', closeCatModal);
            document.getElementById('modal-cat-cancel').addEventListener('click', closeCatModal);
            document.getElementById('pc-category-overlay').addEventListener('click', closeCatModal);

            document.getElementById('modal-cat-name').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('modal-cat-save').click();
                }
            });

            document.getElementById('modal-cat-save').addEventListener('click', () => {
                const type = document.getElementById('modal-cat-type').value;
                const id = document.getElementById('modal-cat-id').value;
                const name = document.getElementById('modal-cat-name').value.trim();
                if (!name) return alert("Category name is required.");

                if (type === 'macro') {
                    char.macroCategories = char.macroCategories || [];
                    if (id) {
                        const cat = char.macroCategories.find(c => c.id === id);
                        if (cat) cat.name = name;
                    } else {
                        char.macroCategories.push({
                            id: 'mcat_' + Date.now() + Math.random().toString(36).substr(2, 4),
                            name,
                            collapsed: false
                        });
                    }
                } else if (type === 'ability') {
                    char.abilityCategories = char.abilityCategories || [];
                    if (id) {
                        const cat = char.abilityCategories.find(c => c.id === id);
                        if (cat) cat.name = name;
                    } else {
                        char.abilityCategories.push({
                            id: 'acat_' + Date.now() + Math.random().toString(36).substr(2, 4),
                            name,
                            collapsed: false
                        });
                    }
                }
                closeCatModal();
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        function openCategoryModal(type = 'macro', catId = null) {
            ensureCategoryModalExists();
            const modal = document.getElementById('pc-category-modal');
            const overlay = document.getElementById('pc-category-overlay');
            const titleEl = document.getElementById('modal-cat-title');
            const typeInp = document.getElementById('modal-cat-type');
            const idInp = document.getElementById('modal-cat-id');
            const nameInp = document.getElementById('modal-cat-name');

            typeInp.value = type;
            idInp.value = catId || '';

            const list = type === 'macro' ? (char.macroCategories || []) : (char.abilityCategories || []);
            const catName = catId ? (list.find(c => c.id === catId)?.name || '') : '';

            if (catId) {
                titleEl.innerHTML = `<i class="fa-solid fa-pen"></i> Edit Category`;
                nameInp.value = catName;
            } else {
                const typeLabel = type === 'macro' ? 'Attack' : 'Ability';
                titleEl.innerHTML = `<i class="fa-solid fa-folder-plus"></i> Create ${typeLabel} Category`;
                nameInp.value = '';
            }

            modal.classList.remove('vtt-hidden');
            overlay.classList.remove('vtt-hidden');
            setTimeout(() => nameInp.focus(), 50);
        }

        function ensureCategoryDeleteModalExists() {
            if (document.getElementById('pc-category-delete-modal')) return;

            const modalHtml = `
                <div id="pc-category-delete-overlay" class="vtt-sheet-submodal-overlay vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3020;"></div>
                <div id="pc-category-delete-modal" class="vtt-sheet-submodal vtt-sheet-submodal-high vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3025; width:380px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                        <h3 style="margin:0; color:#f44336; font-size:1.05rem;"><i class="fa-solid fa-trash"></i> Delete Category</h3>
                        <button id="modal-cat-del-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="modal-cat-del-type" value="macro">
                    <input type="hidden" id="modal-cat-del-id" value="">
                    <p style="font-size:0.85rem; color:var(--color-text-secondary); line-height:1.4; margin-bottom:16px;" id="modal-cat-del-msg">Are you sure you want to delete this category?</p>
                    <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                        <button id="modal-cat-del-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                        <button id="modal-cat-del-confirm" class="btn btn-danger btn-xs"><i class="fa-solid fa-trash"></i> Delete Category</button>
                    </div>
                </div>
            `;
            const div = document.createElement('div');
            div.innerHTML = modalHtml;
            document.body.appendChild(div);

            const closeDelModal = () => {
                document.getElementById('pc-category-delete-modal').classList.add('vtt-hidden');
                document.getElementById('pc-category-delete-overlay').classList.add('vtt-hidden');
            };

            document.getElementById('modal-cat-del-close').addEventListener('click', closeDelModal);
            document.getElementById('modal-cat-del-cancel').addEventListener('click', closeDelModal);
            document.getElementById('pc-category-delete-overlay').addEventListener('click', closeDelModal);

            document.getElementById('modal-cat-del-confirm').addEventListener('click', () => {
                const type = document.getElementById('modal-cat-del-type').value;
                const id = document.getElementById('modal-cat-del-id').value;

                if (type === 'macro') {
                    (char.macros || []).filter(m => m.categoryId === id).forEach(m => { m.categoryId = null; });
                    char.macroCategories = (char.macroCategories || []).filter(c => c.id !== id);
                } else if (type === 'ability') {
                    (char.abilityCards || []).filter(card => card.categoryId === id).forEach(card => { card.categoryId = null; });
                    char.abilityCategories = (char.abilityCategories || []).filter(c => c.id !== id);
                }

                closeDelModal();
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        function openCategoryDeleteModal(type, catId) {
            ensureCategoryDeleteModalExists();
            const modal = document.getElementById('pc-category-delete-modal');
            const overlay = document.getElementById('pc-category-delete-overlay');
            const typeInp = document.getElementById('modal-cat-del-type');
            const idInp = document.getElementById('modal-cat-del-id');
            const msgEl = document.getElementById('modal-cat-del-msg');

            typeInp.value = type;
            idInp.value = catId;

            const list = type === 'macro' ? (char.macroCategories || []) : (char.abilityCategories || []);
            const cat = list.find(c => c.id === catId);
            const catName = cat ? cat.name : 'this category';

            msgEl.innerHTML = `Are you sure you want to delete <b>"${catName}"</b>?<br><br><span style="font-size:0.8rem; color:var(--color-text-muted);">Contained items will return to <i>Uncategorized</i>.</span>`;

            modal.classList.remove('vtt-hidden');
            overlay.classList.remove('vtt-hidden');
        }

        // Bags & Pouches Modal & Management Logic
        function ensureBagModalExists() {
            if (document.getElementById('pc-bag-modal')) return;

            const modalHtml = `
                <div id="pc-bag-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:3000;"></div>
                <div id="pc-bag-modal" class="vtt-sheet-submodal vtt-hidden" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e1e1e; border:1px solid var(--color-border-subtle); border-radius:8px; z-index:3010; width:420px; max-width:92vw; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-subtle); padding-bottom:10px; margin-bottom:12px;">
                        <h3 style="margin:0; color:var(--color-gold-base); font-size:1.1rem;" id="modal-bag-title"><i class="fa-solid fa-sack-xmark"></i> Create Bag / Pouch</h3>
                        <button id="modal-bag-close" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="modal-bag-id" value="">
                    <div class="form-group" style="margin-bottom:12px;">
                        <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Container Name</label>
                        <input type="text" id="modal-bag-name" placeholder="e.g. Bag of Holding, Belt Pouch, Backpack" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                        <div class="form-group" style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Icon</label>
                            <select id="modal-bag-icon" style="width:100%; padding:6px; font-size:0.85rem; background:#222; border:1px solid var(--color-border-subtle); color:#fff; border-radius:4px;">
                                <option value="fa-sack-xmark">🎒 Sack (X)</option>
                                <option value="fa-sack-dollar">💰 Sack ($)</option>
                                <option value="fa-backpack">🎒 Backpack</option>
                                <option value="fa-box-archive">📦 Box / Chest</option>
                                <option value="fa-gem">👛 Pouch / Purse</option>
                                <option value="fa-briefcase">💼 Satchel / Case</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Weight Rule</label>
                            <select id="modal-bag-rule" style="width:100%; padding:6px; font-size:0.85rem; background:#222; border:1px solid var(--color-border-subtle); color:#fff; border-radius:4px;">
                                <option value="standard">Standard (Sums contents)</option>
                                <option value="fixed">Fixed Container Weight</option>
                                <option value="weightless">Weightless Contents (0 lb)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" id="modal-bag-custom-weight-group" style="margin-bottom:16px; display:none;">
                        <label style="font-size:0.8rem; font-weight:600; margin-bottom:4px; display:block; color:var(--color-text-primary);">Container Empty Weight (lbs)</label>
                        <input type="number" step="0.1" id="modal-bag-custom-weight" value="15" style="width:100%; padding:6px; font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--color-border-subtle); color:var(--color-text-primary); border-radius:4px;">
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--color-border-subtle); padding-top:12px;">
                        <button id="modal-bag-cancel" class="btn btn-secondary btn-xs">Cancel</button>
                        <button id="modal-bag-save" class="btn btn-primary btn-xs">Save Bag</button>
                    </div>
                </div>
            `;
            const div = document.createElement('div');
            div.innerHTML = modalHtml;
            document.body.appendChild(div);

            const ruleSelect = document.getElementById('modal-bag-rule');
            const customWeightGroup = document.getElementById('modal-bag-custom-weight-group');
            ruleSelect.addEventListener('change', () => {
                customWeightGroup.style.display = ruleSelect.value === 'fixed' ? 'block' : 'none';
            });

            const closeBagModal = () => {
                document.getElementById('pc-bag-modal').classList.add('vtt-hidden');
                document.getElementById('pc-bag-overlay').classList.add('vtt-hidden');
            };

            document.getElementById('modal-bag-close').addEventListener('click', closeBagModal);
            document.getElementById('modal-bag-cancel').addEventListener('click', closeBagModal);
            document.getElementById('pc-bag-overlay').addEventListener('click', closeBagModal);

            document.getElementById('modal-bag-save').addEventListener('click', () => {
                const id = document.getElementById('modal-bag-id').value;
                const name = document.getElementById('modal-bag-name').value.trim() || 'New Bag';
                const icon = document.getElementById('modal-bag-icon').value;
                const weightRule = document.getElementById('modal-bag-rule').value;
                const customWeight = parseFloat(document.getElementById('modal-bag-custom-weight').value) || 0;

                char.containers = char.containers || [];
                if (id) {
                    const bag = char.containers.find(c => c.id === id);
                    if (bag) {
                        bag.name = name;
                        bag.icon = icon;
                        bag.weightRule = weightRule;
                        bag.customWeight = customWeight;
                    }
                } else {
                    const newBag = {
                        id: 'bag_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        name,
                        icon,
                        weightRule,
                        customWeight,
                        collapsed: false
                    };
                    char.containers.push(newBag);
                }
                closeBagModal();
                saveAndEmit(char);
                renderSheetData(char);
            });
        }

        function openBagModal(bagId = null) {
            ensureBagModalExists();
            const modal = document.getElementById('pc-bag-modal');
            const overlay = document.getElementById('pc-bag-overlay');
            const titleEl = document.getElementById('modal-bag-title');
            const idInp = document.getElementById('modal-bag-id');
            const nameInp = document.getElementById('modal-bag-name');
            const iconSel = document.getElementById('modal-bag-icon');
            const ruleSel = document.getElementById('modal-bag-rule');
            const weightInp = document.getElementById('modal-bag-custom-weight');
            const customWeightGroup = document.getElementById('modal-bag-custom-weight-group');

            char.containers = char.containers || [];
            if (bagId) {
                const bag = char.containers.find(c => c.id === bagId);
                if (bag) {
                    titleEl.innerHTML = `<i class="fa-solid fa-pen"></i> Edit Container`;
                    idInp.value = bag.id;
                    nameInp.value = bag.name || '';
                    iconSel.value = bag.icon || 'fa-sack-xmark';
                    ruleSel.value = bag.weightRule || 'standard';
                    weightInp.value = bag.customWeight !== undefined ? bag.customWeight : 15;
                    customWeightGroup.style.display = bag.weightRule === 'fixed' ? 'block' : 'none';
                }
            } else {
                titleEl.innerHTML = `<i class="fa-solid fa-sack-xmark"></i> Create Bag / Pouch`;
                idInp.value = '';
                nameInp.value = '';
                iconSel.value = 'fa-sack-xmark';
                ruleSel.value = 'standard';
                weightInp.value = 15;
                customWeightGroup.style.display = 'none';
            }

            modal.classList.remove('vtt-hidden');
            overlay.classList.remove('vtt-hidden');
        }

        document.getElementById('btn-create-bag')?.addEventListener('click', () => openBagModal(null));

        document.querySelectorAll('.pc-bag-edit').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openBagModal(e.currentTarget.dataset.containerId);
        }));

        document.querySelectorAll('.pc-bag-del').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const cId = e.currentTarget.dataset.containerId;
            const bag = (char.containers || []).find(c => c.id === cId);
            if (!bag) return;

            const cItems = char.equipment.filter(eq => eq.containerId === cId);
            if (cItems.length > 0) {
                const choice = confirm(`Delete container "${bag.name}"?\n\nClick OK to unpack items into Main Inventory.\nClick Cancel to abort deletion.`);
                if (!choice) return;
                cItems.forEach(eq => { eq.containerId = null; });
            }
            char.containers = char.containers.filter(c => c.id !== cId);
            saveAndEmit(char);
            renderSheetData(char);
        }));

        document.querySelectorAll('.pc-bag-header').forEach(hdr => hdr.addEventListener('click', (e) => {
            const cId = e.currentTarget.dataset.containerId;
            if (!cId) return;
            const bag = (char.containers || []).find(c => c.id === cId);
            if (bag) {
                bag.collapsed = !bag.collapsed;
                saveAndEmit(char);
                renderSheetData(char);
            }
        }));

        document.querySelectorAll('.pc-equip-container-select').forEach(sel => sel.addEventListener('change', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const newContainerId = e.currentTarget.value || null;
            if (char.equipment[idx]) {
                char.equipment[idx].containerId = newContainerId;
                saveAndEmit(char);
                renderSheetData(char);
            }
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

        // Upgraded Multi-Target Drag-and-Drop Logic (Items, Bags, Macros, Abilities & Spells)
        let equipDragHandlePressed = false;
        let equipDraggedIdx = null;
        let bagDragHandlePressed = false;
        let bagDraggedIdx = null;

        let macroDragHandlePressed = false;
        let macroDraggedIdx = null;
        let macroCatDragHandlePressed = false;
        let macroCatDraggedIdx = null;

        let abilityDragHandlePressed = false;
        let abilityDraggedIdx = null;
        let abilityCatDragHandlePressed = false;
        let abilityCatDraggedIdx = null;

        let spellDragHandlePressed = false;
        let spellDraggedIdx = null;
        let spellDraggedLevel = null;

        const clearAllDropIndicators = () => {
            document.querySelectorAll('#pc-equip-list .equip-row, #pc-macros-list .macro-row, #pc-ability-list .ability-row, #ps-spells .spell-row').forEach(row => {
                row.style.borderTop = '';
                row.style.borderBottom = '';
                row.style.boxShadow = '';
                row.style.opacity = '';
            });
            document.querySelectorAll('#pc-equip-list .pc-bag-header, #pc-macros-list .pc-macro-cat-header, #pc-ability-list .pc-ability-cat-header').forEach(hdr => {
                hdr.style.outline = '';
                hdr.style.background = '';
            });
            document.querySelectorAll('#pc-equip-list .pc-bag-card, #pc-macros-list .pc-macro-cat-card, #pc-ability-list .pc-ability-cat-card').forEach(card => {
                card.style.borderTop = '';
                card.style.borderBottom = '';
                card.style.opacity = '';
            });
            document.querySelectorAll('#ps-spells .spell-row').forEach(row => {
                row.style.borderTop = '';
                row.style.borderBottom = '';
                row.style.boxShadow = '';
                row.style.opacity = '';
            });
        };

        document.querySelectorAll('.pc-equip-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { equipDragHandlePressed = true; });
        });
        document.querySelectorAll('.pc-bag-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { bagDragHandlePressed = true; });
        });
        document.querySelectorAll('.pc-macro-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { macroDragHandlePressed = true; });
        });
        document.querySelectorAll('.pc-macro-cat-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { macroCatDragHandlePressed = true; });
        });
        document.querySelectorAll('.pc-ability-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { abilityDragHandlePressed = true; });
        });
        document.querySelectorAll('.pc-ability-cat-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { abilityCatDragHandlePressed = true; });
        });
        document.querySelectorAll('.pc-spell-drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', () => { spellDragHandlePressed = true; });
        });

        window.addEventListener('mouseup', () => {
            equipDragHandlePressed = false;
            bagDragHandlePressed = false;
            macroDragHandlePressed = false;
            macroCatDragHandlePressed = false;
            abilityDragHandlePressed = false;
            abilityCatDragHandlePressed = false;
            spellDragHandlePressed = false;
        });

        // 1. Item Dragging onto Rows and Bag Headers
        document.querySelectorAll('#pc-equip-list .equip-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                if (!equipDragHandlePressed) {
                    e.preventDefault();
                    return;
                }
                equipDraggedIdx = parseInt(row.dataset.idx);
                e.dataTransfer.setData('text/plain', equipDraggedIdx.toString());
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { row.style.opacity = '0.4'; }, 0);
            });

            row.addEventListener('dragover', (e) => {
                if (equipDraggedIdx === null || equipDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-equip-list .equip-row[data-idx="${equipDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                if (e.clientY < midY) {
                    row.style.borderTop = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 -4px 8px -2px rgba(212, 175, 55, 0.6)';
                } else {
                    row.style.borderBottom = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 4px 8px -2px rgba(212, 175, 55, 0.6)';
                }
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = equipDraggedIdx;
                const targetIdx = parseInt(row.dataset.idx);
                const targetContainerId = row.dataset.containerId || null;
                equipDraggedIdx = null;
                equipDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedItem] = char.equipment.splice(fromIdx, 1);
                movedItem.containerId = targetContainerId;
                char.equipment.splice(insertAt, 0, movedItem);
                saveAndEmit(char);
                renderSheetData(char);
            });

            row.addEventListener('dragend', () => {
                equipDraggedIdx = null;
                equipDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        // 2. Item Dragging onto Bag Headers (Move into Bag)
        document.querySelectorAll('#pc-equip-list .pc-bag-header').forEach(hdr => {
            hdr.addEventListener('dragover', (e) => {
                if (equipDraggedIdx === null || equipDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-equip-list .equip-row[data-idx="${equipDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                hdr.style.outline = '2px dashed var(--color-gold-base)';
                hdr.style.background = 'rgba(212, 175, 55, 0.15)';
            });

            hdr.addEventListener('drop', (e) => {
                if (equipDraggedIdx === null || equipDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = equipDraggedIdx;
                const targetContainerId = hdr.dataset.containerId || null;
                equipDraggedIdx = null;
                equipDragHandlePressed = false;

                if (!isNaN(fromIdx) && char.equipment[fromIdx]) {
                    char.equipment[fromIdx].containerId = targetContainerId;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        // 3. Container Card Dragging (Reorder Bags)
        document.querySelectorAll('#pc-equip-list .pc-bag-card[data-container-idx]').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                if (!bagDragHandlePressed) return;
                bagDraggedIdx = parseInt(card.dataset.containerIdx);
                e.dataTransfer.setData('text/plain', 'bag_' + bagDraggedIdx);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { card.style.opacity = '0.4'; }, 0);
            });

            card.addEventListener('dragover', (e) => {
                if (bagDraggedIdx === null || bagDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedCard = document.querySelector(`#pc-equip-list .pc-bag-card[data-container-idx="${bagDraggedIdx}"]`);
                if (draggedCard) draggedCard.style.opacity = '0.4';

                if (e.clientY < midY) {
                    card.style.borderTop = '2px solid var(--color-gold-base)';
                } else {
                    card.style.borderBottom = '2px solid var(--color-gold-base)';
                }
            });

            card.addEventListener('drop', (e) => {
                if (bagDraggedIdx === null || bagDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = bagDraggedIdx;
                const targetIdx = parseInt(card.dataset.containerIdx);
                bagDraggedIdx = null;
                bagDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedContainer] = char.containers.splice(fromIdx, 1);
                char.containers.splice(insertAt, 0, movedContainer);
                saveAndEmit(char);
                renderSheetData(char);
            });

            card.addEventListener('dragend', () => {
                bagDraggedIdx = null;
                bagDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        // 4. Spell Dragging onto Spell Rows (Reorder within Level)
        document.querySelectorAll('#ps-spells .spell-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                const searchInput = document.getElementById('all-spells-search');
                if (searchInput && searchInput.value.trim() !== '') {
                    e.preventDefault();
                    return;
                }
                if (!spellDragHandlePressed) {
                    e.preventDefault();
                    return;
                }
                spellDraggedIdx = parseInt(row.dataset.idx);
                spellDraggedLevel = row.dataset.level;
                e.dataTransfer.setData('text/plain', `spell_${spellDraggedLevel}_${spellDraggedIdx}`);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { row.style.opacity = '0.4'; }, 0);
            });

            row.addEventListener('dragover', (e) => {
                if (spellDraggedIdx === null || spellDraggedIdx === undefined || !spellDraggedLevel) return;
                const searchInput = document.getElementById('all-spells-search');
                if (searchInput && searchInput.value.trim() !== '') return;

                const targetLevel = row.dataset.level;
                if (targetLevel !== spellDraggedLevel) return;

                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();

                const draggedRow = document.querySelector(`#ps-spells .spell-row[data-level="${spellDraggedLevel}"][data-idx="${spellDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                if (e.clientY < midY) {
                    row.style.borderTop = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 -4px 8px -2px rgba(212, 175, 55, 0.6)';
                } else {
                    row.style.borderBottom = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 4px 8px -2px rgba(212, 175, 55, 0.6)';
                }
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = spellDraggedIdx;
                const fromLevel = spellDraggedLevel;
                const targetIdx = parseInt(row.dataset.idx);
                const targetLevel = row.dataset.level;
                spellDraggedIdx = null;
                spellDraggedLevel = null;
                spellDragHandlePressed = false;

                if (fromLevel !== targetLevel || isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                if (char.spells[fromLevel] && char.spells[fromLevel][fromIdx]) {
                    const [movedSpell] = char.spells[fromLevel].splice(fromIdx, 1);
                    char.spells[fromLevel].splice(insertAt, 0, movedSpell);
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });

            row.addEventListener('dragend', () => {
                spellDraggedIdx = null;
                spellDraggedLevel = null;
                spellDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        // 5. Macro Row & Macro Category Drag-and-Drop
        document.querySelectorAll('#pc-macros-list .macro-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                if (!macroDragHandlePressed) {
                    e.preventDefault();
                    return;
                }
                macroDraggedIdx = parseInt(row.dataset.idx);
                e.dataTransfer.setData('text/plain', `macro_${macroDraggedIdx}`);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { row.style.opacity = '0.4'; }, 0);
            });

            row.addEventListener('dragover', (e) => {
                if (macroDraggedIdx === null || macroDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-macros-list .macro-row[data-idx="${macroDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                if (e.clientY < midY) {
                    row.style.borderTop = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 -4px 8px -2px rgba(212, 175, 55, 0.6)';
                } else {
                    row.style.borderBottom = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 4px 8px -2px rgba(212, 175, 55, 0.6)';
                }
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = macroDraggedIdx;
                const targetIdx = parseInt(row.dataset.idx);
                const targetCategoryId = row.dataset.categoryId || null;
                macroDraggedIdx = null;
                macroDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedItem] = char.macros.splice(fromIdx, 1);
                movedItem.categoryId = targetCategoryId;
                char.macros.splice(insertAt, 0, movedItem);
                saveAndEmit(char);
                renderSheetData(char);
            });

            row.addEventListener('dragend', () => {
                macroDraggedIdx = null;
                macroDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        document.querySelectorAll('#pc-macros-list .pc-macro-cat-header').forEach(hdr => {
            hdr.addEventListener('dragover', (e) => {
                if (macroDraggedIdx === null || macroDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-macros-list .macro-row[data-idx="${macroDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                hdr.style.outline = '2px dashed var(--color-gold-base)';
                hdr.style.background = 'rgba(212, 175, 55, 0.15)';
            });

            hdr.addEventListener('drop', (e) => {
                if (macroDraggedIdx === null || macroDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = macroDraggedIdx;
                const targetCategoryId = hdr.dataset.categoryId || null;
                macroDraggedIdx = null;
                macroDragHandlePressed = false;

                if (!isNaN(fromIdx) && char.macros[fromIdx]) {
                    char.macros[fromIdx].categoryId = targetCategoryId;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelectorAll('#pc-macros-list .pc-macro-cat-card[data-category-idx]').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                if (!macroCatDragHandlePressed) return;
                macroCatDraggedIdx = parseInt(card.dataset.categoryIdx);
                e.dataTransfer.setData('text/plain', 'mcat_' + macroCatDraggedIdx);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { card.style.opacity = '0.4'; }, 0);
            });

            card.addEventListener('dragover', (e) => {
                if (macroCatDraggedIdx === null || macroCatDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedCard = document.querySelector(`#pc-macros-list .pc-macro-cat-card[data-category-idx="${macroCatDraggedIdx}"]`);
                if (draggedCard) draggedCard.style.opacity = '0.4';

                if (e.clientY < midY) {
                    card.style.borderTop = '2px solid var(--color-gold-base)';
                } else {
                    card.style.borderBottom = '2px solid var(--color-gold-base)';
                }
            });

            card.addEventListener('drop', (e) => {
                if (macroCatDraggedIdx === null || macroCatDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = macroCatDraggedIdx;
                const targetIdx = parseInt(card.dataset.categoryIdx);
                macroCatDraggedIdx = null;
                macroCatDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedContainer] = char.macroCategories.splice(fromIdx, 1);
                char.macroCategories.splice(insertAt, 0, movedContainer);
                saveAndEmit(char);
                renderSheetData(char);
            });

            card.addEventListener('dragend', () => {
                macroCatDraggedIdx = null;
                macroCatDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        // 6. Ability Card Row & Ability Category Drag-and-Drop
        document.querySelectorAll('#pc-ability-list .ability-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                if (!abilityDragHandlePressed) {
                    e.preventDefault();
                    return;
                }
                abilityDraggedIdx = parseInt(row.dataset.idx);
                e.dataTransfer.setData('text/plain', `ability_${abilityDraggedIdx}`);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { row.style.opacity = '0.4'; }, 0);
            });

            row.addEventListener('dragover', (e) => {
                if (abilityDraggedIdx === null || abilityDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-ability-list .ability-row[data-idx="${abilityDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                if (e.clientY < midY) {
                    row.style.borderTop = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 -4px 8px -2px rgba(212, 175, 55, 0.6)';
                } else {
                    row.style.borderBottom = '2px solid var(--color-gold-base)';
                    row.style.boxShadow = '0 4px 8px -2px rgba(212, 175, 55, 0.6)';
                }
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = abilityDraggedIdx;
                const targetIdx = parseInt(row.dataset.idx);
                const targetCategoryId = row.dataset.categoryId || null;
                abilityDraggedIdx = null;
                abilityDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedItem] = char.abilityCards.splice(fromIdx, 1);
                movedItem.categoryId = targetCategoryId;
                char.abilityCards.splice(insertAt, 0, movedItem);
                saveAndEmit(char);
                renderSheetData(char);
            });

            row.addEventListener('dragend', () => {
                abilityDraggedIdx = null;
                abilityDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

        document.querySelectorAll('#pc-ability-list .pc-ability-cat-header').forEach(hdr => {
            hdr.addEventListener('dragover', (e) => {
                if (abilityDraggedIdx === null || abilityDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                clearAllDropIndicators();
                const draggedRow = document.querySelector(`#pc-ability-list .ability-row[data-idx="${abilityDraggedIdx}"]`);
                if (draggedRow) draggedRow.style.opacity = '0.4';

                hdr.style.outline = '2px dashed var(--color-gold-base)';
                hdr.style.background = 'rgba(212, 175, 55, 0.15)';
            });

            hdr.addEventListener('drop', (e) => {
                if (abilityDraggedIdx === null || abilityDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = abilityDraggedIdx;
                const targetCategoryId = hdr.dataset.categoryId || null;
                abilityDraggedIdx = null;
                abilityDragHandlePressed = false;

                if (!isNaN(fromIdx) && char.abilityCards[fromIdx]) {
                    char.abilityCards[fromIdx].categoryId = targetCategoryId;
                    saveAndEmit(char);
                    renderSheetData(char);
                }
            });
        });

        document.querySelectorAll('#pc-ability-list .pc-ability-cat-card[data-category-idx]').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                if (!abilityCatDragHandlePressed) return;
                abilityCatDraggedIdx = parseInt(card.dataset.categoryIdx);
                e.dataTransfer.setData('text/plain', 'acat_' + abilityCatDraggedIdx);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { card.style.opacity = '0.4'; }, 0);
            });

            card.addEventListener('dragover', (e) => {
                if (abilityCatDraggedIdx === null || abilityCatDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                const draggedCard = document.querySelector(`#pc-ability-list .pc-ability-cat-card[data-category-idx="${abilityCatDraggedIdx}"]`);
                if (draggedCard) draggedCard.style.opacity = '0.4';

                if (e.clientY < midY) {
                    card.style.borderTop = '2px solid var(--color-gold-base)';
                } else {
                    card.style.borderBottom = '2px solid var(--color-gold-base)';
                }
            });

            card.addEventListener('drop', (e) => {
                if (abilityCatDraggedIdx === null || abilityCatDraggedIdx === undefined) return;
                e.preventDefault();
                e.stopPropagation();
                clearAllDropIndicators();

                const fromIdx = abilityCatDraggedIdx;
                const targetIdx = parseInt(card.dataset.categoryIdx);
                abilityCatDraggedIdx = null;
                abilityCatDragHandlePressed = false;

                if (isNaN(fromIdx) || isNaN(targetIdx) || fromIdx === targetIdx) return;

                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertAt = targetIdx;
                if (e.clientY >= midY) {
                    insertAt = targetIdx + 1;
                }
                if (fromIdx < insertAt) {
                    insertAt--;
                }

                const [movedContainer] = char.abilityCategories.splice(fromIdx, 1);
                char.abilityCategories.splice(insertAt, 0, movedContainer);
                saveAndEmit(char);
                renderSheetData(char);
            });

            card.addEventListener('dragend', () => {
                abilityCatDraggedIdx = null;
                abilityCatDragHandlePressed = false;
                clearAllDropIndicators();
            });
        });

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
            if (list.length === 0 && sp.damage) list.push({ formula: sp.damage, type: sp.damageType || '', label: '' });
            
            const scaleFn = window.VTTSpellManager?.scaleUpcastFormula || window.scaleUpcastFormula;

            if (baseLvl === 0 && list.length > 0) {
                let cCount = 1;
                if (charLvl >= 5) cCount = 2;
                if (charLvl >= 11) cCount = 3;
                if (charLvl >= 17) cCount = 4;
                for (let idx = 0; idx < list.length; idx++) {
                    const d = list[idx];
                    const rowCantripScale = d.cantripScale !== undefined ? Boolean(d.cantripScale) : (idx === 0 ? Boolean(sp.cantripScale !== false) : false);
                    if (rowCantripScale && d.formula && /(?:\d+\s*)?[dD]\s*\d+/.test(d.formula)) {
                        d.formula = d.formula.replace(/^(?:(\d+)\s*)?([dD]\s*\d+)/, (m, countStr, die) => {
                            const count = countStr !== undefined && countStr !== '' ? parseInt(countStr) : 1;
                            if (count === 0) {
                                const extraDice = cCount - 1;
                                return extraDice > 0 ? `${extraDice}${die}` : '0';
                            }
                            return `${cCount * count}${die}`;
                        });
                    }
                }
            } else if (castLvl > baseLvl && list.length > 0) {
                let rowSpecificScaled = false;
                for (let idx = 0; idx < list.length; idx++) {
                    const d = list[idx];
                    const rowUpcast = d.upcastBonus !== undefined ? d.upcastBonus : (idx === 0 ? sp.upcastBonus : '');
                    if (rowUpcast && String(rowUpcast).trim() !== '') {
                        const step = d.upcastScaleStep || sp.upcastScaleStep || 1;
                        const extra = Math.floor((castLvl - baseLvl) / step);
                        if (extra > 0) {
                            if (scaleFn) {
                                const scaledUpcastStr = scaleFn(rowUpcast, extra);
                                if (scaledUpcastStr) {
                                    d.formula = `${d.formula || ''} ${scaledUpcastStr}`.trim();
                                    rowSpecificScaled = true;
                                }
                            }
                        }
                    }
                }

                if (!rowSpecificScaled && sp.upcastBonus && list[0] && scaleFn) {
                    const step = sp.upcastScaleStep || 1;
                    const extra = Math.floor((castLvl - baseLvl) / step);
                    if (extra > 0) {
                        const scaledUpcastStr = scaleFn(sp.upcastBonus, extra);
                        if (scaledUpcastStr) {
                            list[0].formula = `${list[0].formula || ''} ${scaledUpcastStr}`.trim();
                        }
                    }
                }
            }
            return list;
        }

        document.querySelectorAll('.pc-spell-expand-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const item = e.currentTarget.closest('.cs-spell-item, .pc-spell-item') || e.currentTarget.closest('[data-level]');
            if (!item) return;
            const details = item.querySelector('.pc-spell-details');
            const nameEl = item.querySelector('.pc-spell-name');
            const spellName = nameEl ? nameEl.textContent.trim() : 'Spell';
            const descEl = details ? details.querySelector('.pc-spell-desc') : null;
            const chevron = e.currentTarget.querySelector('.fa-chevron-right');

            const postChatBtn = item.querySelector('.pc-spell-post-chat');
            const level = item.dataset.level || (postChatBtn ? postChatBtn.dataset.level : null);
            const idx = item.dataset.idx !== undefined ? parseInt(item.dataset.idx) : (postChatBtn ? parseInt(postChatBtn.dataset.idx) : null);
            const sp = (level && idx !== null && !isNaN(idx) && char?.spells?.[level]) ? char.spells[level][idx] : null;

            if (details) {
                if (details.style.display === 'none') {
                    details.style.display = 'block';
                    if (chevron) chevron.style.transform = 'rotate(90deg)';
                    if (sp && window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                        await window.VTTSpellManager.ensureSpellIsParsed(sp);
                    }
                    if (window.VTTSpellManager && window.VTTSpellManager.renderAndInjectSpell) {
                        window.VTTSpellManager.renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level);
                    } else {
                        renderAndInjectSpell(spellName, descEl, sp?.description || '', sp, level);
                    }
                } else {
                    details.style.display = 'none';
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            }
        }));

        document.querySelectorAll('.pc-spell-post-chat').forEach(btn => btn.addEventListener('click', async (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char?.spells?.[level]?.[idx];
            if (!sp) return;

            if (window.VTTSpellManager && window.VTTSpellManager.ensureSpellIsParsed) {
                await window.VTTSpellManager.ensureSpellIsParsed(sp);
            }

            const visibility = typeof getVisibilitySetting === 'function' ? getVisibilitySetting() : 'public';
            if (window.VTTSpellManager && window.VTTSpellManager.postSpellToChat) {
                window.VTTSpellManager.postSpellToChat(sp, level, char.name, visibility);
            } else {
                const meta = getSpellMetaStrings(sp, level);
                let metaHtml = '';
                if (meta && (meta.level || meta.school || meta.time || meta.range || meta.components || meta.duration)) {
                    metaHtml = '<div class="spell-meta" style="margin-bottom: 8px;">';
                    if (meta.level) metaHtml += `<div><i class="fa-solid fa-layer-group" style="width: 16px; text-align: center; margin-right: 4px;" title="Level"></i> <strong>Level:</strong> ${meta.level}</div>`;
                    if (meta.school) metaHtml += `<div><i class="fa-solid fa-graduation-cap" style="width: 16px; text-align: center; margin-right: 4px;" title="School"></i> <strong>School:</strong> ${meta.school}</div>`;
                    if (meta.time) metaHtml += `<div><i class="fa-solid fa-clock" style="width: 16px; text-align: center; margin-right: 4px;" title="Casting Time"></i> <strong>Casting Time:</strong> ${meta.time}</div>`;
                    if (meta.range) metaHtml += `<div><i class="fa-solid fa-ruler" style="width: 16px; text-align: center; margin-right: 4px;" title="Range"></i> <strong>Range:</strong> ${meta.range}</div>`;
                    if (meta.components) metaHtml += `<div><i class="fa-solid fa-hand-sparkles" style="width: 16px; text-align: center; margin-right: 4px;" title="Components"></i> <strong>Components:</strong> ${meta.components}</div>`;
                    if (meta.duration) metaHtml += `<div><i class="fa-solid fa-stopwatch" style="width: 16px; text-align: center; margin-right: 4px;" title="Duration"></i> <strong>Duration:</strong> ${meta.duration}</div>`;
                    metaHtml += '</div>';
                }
                let bodyText = sp.description || '';
                if (typeof cleanSpellHtml === 'function') bodyText = cleanSpellHtml(bodyText);
                vtt.socket.emit('chat:msg', { abilityCard: { creatureName: char.name, abilityName: sp.name, text: metaHtml + bodyText, ...meta } });
            }
        }));

        document.querySelectorAll('.pc-spell-ping-macro').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            if (!sp) return;
            
            const hasUpcast = sp.upcastBonus || (sp.damageList && sp.damageList.some(d => d.upcastBonus && String(d.upcastBonus).trim() !== ''));
            const upcastFn = window.VTTSpellManager?.promptUpcastLevel || promptUpcastLevel;
            if (level !== 'cantrip' && level !== 'legacy' && hasUpcast && upcastFn) {
                upcastFn(parseInt(level.replace('level', '')) || 1, (lvl) => {
                    if (lvl) {
                        if (window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                            window.VTTSpellManager.rollSpell(sp, level, char, { type: 'roll', castLvl: lvl });
                        }
                    }
                });
            } else {
                if (window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                    window.VTTSpellManager.rollSpell(sp, level, char, { type: 'roll' });
                }
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
            if (sp && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                window.VTTSpellManager.rollSpell(sp, level, char, { type: 'attack' });
            }
        }));

        document.querySelectorAll('.pc-spell-macro-save').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            if (sp && window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                window.VTTSpellManager.rollSpell(sp, level, char, { type: 'save' });
            }
        }));

        document.querySelectorAll('.pc-spell-macro-damage').forEach(btn => btn.addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            const idx = e.currentTarget.dataset.idx;
            const sp = char.spells[level][idx];
            if (!sp) return;
            
            const hasUpcast = sp.upcastBonus || (sp.damageList && sp.damageList.some(d => d.upcastBonus && String(d.upcastBonus).trim() !== ''));
            const upcastFn = window.VTTSpellManager?.promptUpcastLevel || promptUpcastLevel;
            if (level !== 'cantrip' && level !== 'legacy' && hasUpcast && upcastFn) {
                upcastFn(parseInt(level.replace('level', '')) || 1, (lvl) => {
                    if (lvl) {
                        if (window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                            window.VTTSpellManager.rollSpell(sp, level, char, { type: 'damage', castLvl: lvl });
                        }
                    }
                });
            } else {
                if (window.VTTSpellManager && window.VTTSpellManager.rollSpell) {
                    window.VTTSpellManager.rollSpell(sp, level, char, { type: 'damage' });
                }
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

        const applyAllSpellsFilters = () => {
            const val = document.getElementById('all-spells-search')?.value.toLowerCase().trim() || '';
            const isPrepOnly = document.getElementById('all-spells-prep-only')?.checked || false;
            const isSearching = val !== '';

            document.querySelectorAll('#spell-page-all .pc-spell-drag-handle').forEach(handle => {
                if (isSearching) {
                    handle.dataset.disabled = 'true';
                    handle.style.opacity = '0.2';
                    handle.style.cursor = 'not-allowed';
                    handle.title = 'Reordering disabled during search';
                } else {
                    delete handle.dataset.disabled;
                    handle.style.opacity = '0.6';
                    handle.style.cursor = 'grab';
                    handle.title = 'Click and drag to reorder spell';
                }
            });

            document.querySelectorAll('#spell-page-all .spell-row').forEach(row => {
                const name = (row.dataset.spellName || '').toLowerCase();
                const isPrep = row.dataset.prepared === 'true' || row.dataset.level === 'cantrip' || row.dataset.level === 'legacy';
                const matchesSearch = !val || name.includes(val);
                const matchesPrep = !isPrepOnly || isPrep;
                row.style.display = (matchesSearch && matchesPrep) ? 'flex' : 'none';
            });

            document.querySelectorAll('.all-spells-group').forEach(group => {
                const visibleSpells = Array.from(group.querySelectorAll('.spell-row')).filter(row => row.style.display !== 'none');
                group.style.display = visibleSpells.length > 0 ? 'block' : 'none';
            });
        };

        document.getElementById('all-spells-search')?.addEventListener('input', applyAllSpellsFilters);
        document.getElementById('all-spells-prep-only')?.addEventListener('change', applyAllSpellsFilters);

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
            char.tokenSight = maxSpecialVision;

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

        document.getElementById('pc-background')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val) return;
            const openBgModal = (bgs) => {
                const bg = (bgs || []).find(b => {
                    const badge = getDisplaySourceBadge(b.source);
                    const tag = badge ? ` [${badge}]` : (b.source ? ` [${b.source}]` : '');
                    return `${b.name}${tag}` === val || `${b.name} [${b.source}]` === val || b.name === val || b.id === val;
                });
                if (bg) {
                    promptBackgroundImportModal(bg, char, () => {
                        const sel = document.getElementById('pc-background');
                        if (sel) sel.value = char.background || '';
                    });
                }
            };

            if (builderCache && builderCache.bgs && builderCache.bgs.length > 0) {
                openBgModal(builderCache.bgs);
            } else {
                fetch('data/backgrounds-catalog.json')
                    .then(r => r.json())
                    .then(data => openBgModal(Array.isArray(data) ? data : (data.background || [])))
                    .catch(() => {
                        fetch('data/backgrounds.json')
                            .then(r => r.json())
                            .then(data => openBgModal(Array.isArray(data) ? data : (data.background || [])));
                    });
            }
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
            let availableClasses = [];
            if (builderCache && Array.isArray(builderCache.classes)) {
                const seen = new Set();
                builderCache.classes.forEach(c => {
                    const badge = getDisplaySourceBadge(c.source);
                    const tag = badge ? ` [${badge}]` : (c.source ? ` [${c.source}]` : '');
                    const fullName = `${c.name}${tag}`;
                    if (!seen.has(fullName)) {
                        seen.add(fullName);
                        availableClasses.push(fullName);
                    }
                });
            } else if (builderCache?.classIndex) {
                availableClasses = Object.keys(builderCache.classIndex).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            }
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

        document.getElementById('btn-add-ability')?.addEventListener('click', () => {
            document.getElementById('modal-ability-idx').value = '-1';
            document.getElementById('modal-ability-name').value = '';
            const catSel = document.getElementById('modal-ability-category');
            if (catSel) {
                catSel.innerHTML = '<option value="">Uncategorized</option>' + (char.abilityCategories || []).map(c => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                catSel.value = '';
            }
            const actSel = document.getElementById('modal-ability-action-type');
            if (actSel) actSel.value = 'passive';
            document.getElementById('modal-ability-desc').value = '';

            populateScalingModDropdown(char);
            if (document.getElementById('modal-ability-base-dice')) document.getElementById('modal-ability-base-dice').value = '';
            if (document.getElementById('modal-ability-scaling-mod')) document.getElementById('modal-ability-scaling-mod').value = 'none';
            if (document.getElementById('modal-ability-extra-bonus')) document.getElementById('modal-ability-extra-bonus').value = 0;
            if (document.getElementById('modal-ability-formula')) document.getElementById('modal-ability-formula').value = '';
            if (document.getElementById('modal-ability-formula-preview')) document.getElementById('modal-ability-formula-preview').innerText = 'None';

            document.getElementById('modal-ability-has-counter').checked = false;
            document.getElementById('modal-ability-uses-container').style.display = 'none';
            document.getElementById('modal-ability-uses-current').value = 0;
            document.getElementById('modal-ability-uses-max').value = 0;
            if (document.getElementById('modal-ability-reset-type')) document.getElementById('modal-ability-reset-type').value = 'long';
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
            const catSel = document.getElementById('modal-ability-category');
            if (catSel) {
                catSel.innerHTML = '<option value="">Uncategorized</option>' + (char.abilityCategories || []).map(c => `<option value="${c.id}">📁 ${c.name}</option>`).join('');
                catSel.value = ab.categoryId || '';
            }
            const actSel = document.getElementById('modal-ability-action-type');
            if (actSel) actSel.value = ab.actionType || 'passive';
            document.getElementById('modal-ability-desc').value = ab.description || '';

            let baseDice = '';
            let scalingMod = 'none';
            let extraBonus = 0;
            if (ab.formulaConfig) {
                baseDice = ab.formulaConfig.baseDice || '';
                scalingMod = ab.formulaConfig.modClass ? `classLevel:${ab.formulaConfig.modClass}` : (ab.formulaConfig.scalingMod || 'none');
                extraBonus = ab.formulaConfig.extraBonus || 0;
            }
            populateScalingModDropdown(char, scalingMod);
            if (document.getElementById('modal-ability-base-dice')) document.getElementById('modal-ability-base-dice').value = baseDice;
            if (document.getElementById('modal-ability-extra-bonus')) document.getElementById('modal-ability-extra-bonus').value = extraBonus;
            if (document.getElementById('modal-ability-formula')) document.getElementById('modal-ability-formula').value = ab.formula || '';
            
            const evalFormula = evaluateAbilityFormula(ab.formula, ab.formulaConfig, char);
            if (document.getElementById('modal-ability-formula-preview')) {
                document.getElementById('modal-ability-formula-preview').innerText = evalFormula || 'None';
            }

            document.getElementById('modal-ability-has-counter').checked = !!ab.hasCounter;
            document.getElementById('modal-ability-uses-container').style.display = ab.hasCounter ? 'flex' : 'none';
            document.getElementById('modal-ability-uses-current').value = ab.usesCurrent || 0;
            document.getElementById('modal-ability-uses-max').value = ab.usesMax || 0;
            if (document.getElementById('modal-ability-reset-type')) document.getElementById('modal-ability-reset-type').value = ab.resetType || 'long';
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

        // Ability Category Management
        document.getElementById('btn-create-ability-cat')?.addEventListener('click', () => openCategoryModal('ability'));

        document.querySelectorAll('.pc-ability-cat-edit').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCategoryModal('ability', e.currentTarget.dataset.categoryId);
        }));

        document.querySelectorAll('.pc-ability-cat-del').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCategoryDeleteModal('ability', e.currentTarget.dataset.categoryId);
        }));

        document.querySelectorAll('.pc-ability-cat-header').forEach(hdr => hdr.addEventListener('click', (e) => {
            const cId = e.currentTarget.dataset.categoryId;
            if (!cId) return;
            const cat = (char.abilityCategories || []).find(c => c.id === cId);
            if (cat) {
                cat.collapsed = !cat.collapsed;
                saveAndEmit(char);
                renderSheetData(char);
            }
        }));

        document.querySelectorAll('.pc-ability-cat-select').forEach(sel => sel.addEventListener('change', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const newCatId = e.currentTarget.value || null;
            if (char.abilityCards && char.abilityCards[idx]) {
                char.abilityCards[idx].categoryId = newCatId;
                saveAndEmit(char);
                renderSheetData(char);
            }
        }));

        document.querySelectorAll('.pc-ability-del').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.idx);
            if (!isNaN(idx) && char.abilityCards[idx]) {
                if (confirm("Delete this ability card?")) {
                    char.abilityCards.splice(idx, 1);
                    saveAndEmit(char);
                    renderSheetData(char);
                }
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
            if (!ab) return;
            
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
                const evalFormula = evaluateAbilityFormula(ab.formula, ab.formulaConfig, char);
                mc.dmgRolls = [{
                    type: 'Roll',
                    formula: evalFormula || ab.formula,
                    roll: simulateRoll(evalFormula || ab.formula)
                }];
            }

            vtt.socket.emit('chat:msg', {
                macroCard: mc
            });
        }));

        // 1-Click Roll Chip directly on the card face
        document.querySelectorAll('.pc-ability-roll-chip').forEach(chip => chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = e.currentTarget.dataset.idx;
            const ab = char.abilityCards[idx];
            if (!ab || !ab.formula) return;
            const evalFormula = evaluateAbilityFormula(ab.formula, ab.formulaConfig, char);
            const rollVal = simulateRoll(evalFormula || ab.formula);

            const mc = {
                charName: char.name,
                macroName: ab.name,
                description: ab.description ? ab.description.replace(/\n/g, '<br>') : '',
                dmgRolls: [{
                    type: 'Roll',
                    formula: evalFormula || ab.formula,
                    roll: rollVal
                }]
            };
            vtt.socket.emit('chat:msg', { macroCard: mc });
        }));

        // Quick Ability Cards Search Filter
        const abilitySearch = document.getElementById('pc-ability-search');
        if (abilitySearch) {
            abilitySearch.oninput = (e) => {
                const query = e.target.value.toLowerCase().trim();
                document.querySelectorAll('#pc-ability-list .ability-row').forEach(row => {
                    const txt = row.innerText.toLowerCase();
                    row.style.display = (!query || txt.includes(query)) ? 'flex' : 'none';
                });
                // Also hide category containers if all items in them are hidden
                document.querySelectorAll('#pc-ability-list .pc-ability-cat-card').forEach(card => {
                    const visibleRows = card.querySelectorAll('.ability-row:not([style*="display: none"])');
                    card.style.display = (visibleRows.length > 0) ? 'block' : 'none';
                });
            };
        }
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
            if (vtt.creatureSheet && typeof vtt.creatureSheet.getLinkedCharacterId === 'function') {
                if (vtt.creatureSheet.getLinkedCharacterId() === data.id) {
                    if (typeof vtt.creatureSheet.resetSheet === 'function') {
                        vtt.creatureSheet.resetSheet();
                    } else if (typeof vtt.creatureSheet.minimizePanel === 'function') {
                        vtt.creatureSheet.minimizePanel();
                    }
                }
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
                document.getElementById('pc-token-edit-sight').value = currentChar.tokenSight !== undefined ? currentChar.tokenSight : 0;

                tempPlayerAurasList = (currentChar.tokenAuras || []).map((a, i) => ({
                    ...a,
                    enabled: a.enabled !== undefined ? a.enabled : true,
                    name: a.name || '',
                    isExpanded: i === 0
                }));
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

    // Global Escape Key Listener for Player Sheet Sub-Modals
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            // High priority / nested submodals first
            const highModals = [
                { modal: 'pc-custom-item-modal', overlay: 'pc-item-overlay' },
                { modal: 'pc-item-automation-modal', overlay: 'pc-item-automation-overlay' },
                { modal: 'pc-category-delete-modal', overlay: 'pc-category-delete-overlay' },
                { modal: 'pc-ability-import-cat-modal', overlay: 'pc-ability-overlay' },
                { modal: 'pc-bg-import-modal', overlay: 'pc-bg-import-overlay' },
                { modal: 'modal-pc-token-edit', overlay: 'modal-pc-token-edit-overlay' }
            ];
            for (const item of highModals) {
                const m = document.getElementById(item.modal);
                if (m && !m.classList.contains('vtt-hidden')) {
                    if (m._initialModalSnapshot !== undefined) {
                        const curSnapshot = JSON.stringify(Array.from(m.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')).map(el => el.type === 'checkbox' ? el.checked : el.value));
                        if (curSnapshot !== m._initialModalSnapshot) {
                            if (!confirm("Discard unsaved changes?")) {
                                e.stopPropagation();
                                return;
                            }
                        }
                    }
                    m.classList.add('vtt-hidden');
                    if (item.overlay) {
                        if (item.modal === 'pc-custom-item-modal') {
                            const parent = document.getElementById('pc-item-modal');
                            if (!parent || parent.classList.contains('vtt-hidden')) {
                                document.getElementById(item.overlay)?.classList.add('vtt-hidden');
                            }
                        } else {
                            document.getElementById(item.overlay)?.classList.add('vtt-hidden');
                        }
                    }
                    e.stopPropagation();
                    return;
                }
            }

            // Standard sub-modals next
            const standardModals = [
                { modal: 'pc-item-modal', overlay: 'pc-item-overlay' },
                { modal: 'pc-macro-modal', overlay: 'pc-macro-overlay' },
                { modal: 'pc-category-modal', overlay: 'pc-category-overlay' },
                { modal: 'pc-bag-modal', overlay: 'pc-bag-overlay' },
                { modal: 'pc-ability-modal', overlay: 'pc-ability-overlay' },
                { modal: 'pc-save-settings-modal', overlay: 'pc-save-settings-overlay' },
                { modal: 'pc-skill-settings-modal', overlay: 'pc-skill-settings-overlay' },
                { modal: 'pc-tool-settings-modal', overlay: 'pc-tool-settings-overlay' },
                { modal: 'pc-assign-players-modal', overlay: 'pc-assign-players-overlay' }
            ];
            for (const item of standardModals) {
                const m = document.getElementById(item.modal);
                if (m && !m.classList.contains('vtt-hidden')) {
                    if (item.modal === 'pc-macro-modal') {
                        closeMacroModal(false);
                        if (m.classList.contains('vtt-hidden')) {
                            e.stopPropagation();
                            return;
                        }
                        e.stopPropagation();
                        return;
                    }
                    if (m._initialModalSnapshot !== undefined) {
                        const curSnapshot = JSON.stringify(Array.from(m.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')).map(el => el.type === 'checkbox' ? el.checked : el.value));
                        if (curSnapshot !== m._initialModalSnapshot) {
                            if (!confirm("Discard unsaved changes?")) {
                                e.stopPropagation();
                                return;
                            }
                        }
                    }
                    m.classList.add('vtt-hidden');
                    if (item.overlay) {
                        document.getElementById(item.overlay)?.classList.add('vtt-hidden');
                    }
                    e.stopPropagation();
                    return;
                }
            }
        }
    });

    // Initial render
    renderCharacterList();

    // ─── Public API ───────────────────────────────────────────────────────────
    return {
        openSheet,
        openPanel,
        minimizePanel,
        closeSheet,
        getCurrentChar: () => currentChar
    };
}