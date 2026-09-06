// DnDForged Unified Chat, Roll Parser & 3D Dice Simulation

export function initVttChat(vtt, chatHistory) {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-chat-send');
    const fastRollBtns = document.querySelectorAll('.fast-dice');
    const chatRollModeBtns = document.querySelectorAll('.chat-roll-mode .roll-mode-btn');

    // Initialize global roll mode
    vtt.currentRollMode = vtt.currentRollMode || 'normal';
    vtt.whisperGM = vtt.whisperGM || false;
    
    // Combat initiative DOM bindings
    const initContainer = document.getElementById('vtt-initiative-carousel-container');
    const initMinTab = document.getElementById('vtt-initiative-minimized-tab');
    const initMinName = document.getElementById('init-min-name');
    const initList = document.getElementById('init-list');
    const roundDisplay = document.getElementById('init-round-num');
    
    // Combat state
    let combatants = [];
    let currentRound = 1;
    let activeTurnIndex = -1;
    let initiativeVisible = false;
    let active3dDice = [];

    // Load initial persistent state
    if (vtt.campaignState && vtt.campaignState.initiative) {
        combatants = vtt.campaignState.initiative.combatants || [];
        currentRound = vtt.campaignState.initiative.currentRound || 1;
        activeTurnIndex = vtt.campaignState.initiative.activeTurnIndex !== undefined ? vtt.campaignState.initiative.activeTurnIndex : -1;
        initiativeVisible = vtt.campaignState.initiative.isVisible !== undefined ? vtt.campaignState.initiative.isVisible : true;
    }

    // Load initial chat history
    if (chatHistory && chatHistory.length > 0) {
        chatMessages.innerHTML = '';
        chatHistory.forEach(msg => appendMessageToDom(msg, true));
    }

    // Connect WebSocket hooks
    setupChatSocketSync();

    // Setup input controllers
    setupChatInputs();

    // Setup Initiative controllers
    setupInitiativeControls();
    
    // Render initial state
    renderInitiativeList();

    // Setup Context Menu for Fast Dice
    setupFastDiceContextMenu();

    // 3D Animated Dice overlay system
    if (window.Dice3D) {
        window.Dice3D.init({ containerId: 'dice-box-canvas-container' });
    }


    function setupChatSocketSync() {
        vtt.socket.on('chat:msg', (msg) => {
            // Apply visibility filtering for socket event handling
            if (msg.hidden && vtt.role !== 'GM') return;
            if (msg.whisperToGM && vtt.role !== 'GM' && msg.username !== vtt.username) return;

            appendMessageToDom(msg);
            
            // Trigger 3D physics roll animations if there's dice data
            if (msg.roll && msg.roll.diceList) {
                trigger3dDiceRoll(msg.roll.diceList);
            }
        });

        vtt.socket.on('chat:deleted', (data) => {
            const msgEl = chatMessages.querySelector(`[data-msg-id="${data.id}"]`);
            if (msgEl) msgEl.remove();
        });

        vtt.socket.on('chat:hidden_toggled', (data) => {
            const msgEl = chatMessages.querySelector(`[data-msg-id="${data.id}"]`);
            if (msgEl) {
                if (vtt.role !== 'GM' && data.hidden) {
                    msgEl.remove();
                } else {
                    if (data.hidden) {
                        msgEl.classList.add('msg-hidden');
                        const btn = msgEl.querySelector('.btn-chat-toggle-hide');
                        if (btn) btn.innerHTML = '<i class="fa-regular fa-eye"></i> Unhide';
                    } else {
                        msgEl.classList.remove('msg-hidden');
                        const btn = msgEl.querySelector('.btn-chat-toggle-hide');
                        if (btn) btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i> Hide';
                    }
                }
            }
        });

        vtt.socket.on('initiative:updated', (data) => {
            if (data.initiative) {
                if (!vtt.campaignState) vtt.campaignState = {};
                vtt.campaignState.initiative = data.initiative;
                
                combatants = data.initiative.combatants || [];
                currentRound = data.initiative.currentRound || 1;
                activeTurnIndex = data.initiative.activeTurnIndex !== undefined ? data.initiative.activeTurnIndex : -1;
                if (data.initiative.isVisible !== undefined) {
                    initiativeVisible = data.initiative.isVisible;
                }
                renderInitiativeList();
            }
        });
    }

    function setupChatInputs() {
        btnSend.addEventListener('click', () => sendMessage());
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Fast Dice rolling quickbar buttons
        fastRollBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const formula = btn.dataset.formula;
                rollAndSend(formula);
            });
        });

        // Chat bar roll mode toggles
        chatRollModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.id === 'btn-gm-whisper') {
                    vtt.whisperGM = !vtt.whisperGM;
                    btn.classList.toggle('active', vtt.whisperGM);
                    btn.classList.toggle('gm-whisper', vtt.whisperGM);
                    return;
                }
                vtt.currentRollMode = btn.dataset.mode;
                chatRollModeBtns.forEach(b => {
                    if (b.id === 'btn-gm-whisper') return;
                    b.classList.remove('active', 'adv', 'dis');
                    if (b.dataset.mode === vtt.currentRollMode) {
                        b.classList.add('active');
                        if (vtt.currentRollMode === 'adv') b.classList.add('adv');
                        if (vtt.currentRollMode === 'dis') b.classList.add('dis');
                    }
                });
            });
        });

        // 3D Dice Settings Controls Bindings
        const cfg3dEnable = document.getElementById('config-3d-dice-enable');
        const cfg3dSkin = document.getElementById('config-3d-dice-skin');
        const cfg3dSfx = document.getElementById('config-3d-dice-sfx');
        const cfg3dVol = document.getElementById('config-3d-dice-volume');

        if (cfg3dEnable && window.Dice3D) {
            cfg3dEnable.checked = window.Dice3D.isEnabled();
            cfg3dEnable.addEventListener('change', (e) => {
                window.Dice3D.setEnabled(e.target.checked);
            });
        }

        if (cfg3dSkin && window.Dice3D) {
            const savedSkin = localStorage.getItem('vtt_3d_dice_skin') || 'obsidian_gold';
            cfg3dSkin.value = savedSkin;
            cfg3dSkin.addEventListener('change', (e) => {
                window.Dice3D.setSkin(e.target.value);
            });
        }

        if (cfg3dSfx && window.Dice3D) {
            const savedSfx = localStorage.getItem('vtt_3d_dice_sfx');
            cfg3dSfx.checked = savedSfx === null ? true : savedSfx === 'true';
            cfg3dSfx.addEventListener('change', (e) => {
                window.Dice3D.setSfxEnabled(e.target.checked);
            });
        }

        if (cfg3dVol && window.Dice3D) {
            const savedVol = localStorage.getItem('vtt_3d_dice_volume');
            cfg3dVol.value = savedVol !== null ? Math.round(parseFloat(savedVol) * 100) : 60;
            cfg3dVol.addEventListener('input', (e) => {
                window.Dice3D.setVolume(parseFloat(e.target.value) / 100);
            });
        }

        // Click delegation for dice chips, native rollers, and chat actions
        chatMessages.addEventListener('click', (e) => {
            // Chat menu actions
            const menuBtn = e.target.closest('.btn-chat-menu');
            if (menuBtn) {
                const menu = menuBtn.nextElementSibling;
                // Close all others
                document.querySelectorAll('.chat-msg-menu').forEach(m => {
                    if (m !== menu) m.classList.add('vtt-hidden');
                });
                menu.classList.toggle('vtt-hidden');
                e.stopPropagation();
            }

            const hideBtn = e.target.closest('.btn-chat-toggle-hide');
            if (hideBtn) {
                const msgEl = hideBtn.closest('.chat-message');
                if (msgEl && msgEl.dataset.msgId) {
                    vtt.socket.emit('chat:hide', msgEl.dataset.msgId);
                }
                hideBtn.closest('.chat-msg-menu').classList.add('vtt-hidden');
                e.stopPropagation();
            }

            const delBtn = e.target.closest('.btn-chat-delete');
            if (delBtn) {
                const msgEl = delBtn.closest('.chat-message');
                if (msgEl && msgEl.dataset.msgId) {
                    vtt.socket.emit('chat:delete', msgEl.dataset.msgId);
                }
                delBtn.closest('.chat-msg-menu').classList.add('vtt-hidden');
                e.stopPropagation();
            }

            const target = e.target.closest('.dice-chip, .render-roller');
            if (target) {
                let formula = target.dataset.formula;
                if (!formula && target.classList.contains('render-roller')) {
                    formula = target.textContent.trim();
                }
                if (formula) rollAndSend(formula);
                e.stopPropagation();
            }
        });

        // Close menus when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.chat-msg-menu').forEach(m => m.classList.add('vtt-hidden'));
        });

        // Global Popover Tooltip for data-tooltip
        let popoverEl = document.getElementById('vtt-global-tooltip');
        if (!popoverEl) {
            popoverEl = document.createElement('div');
            popoverEl.id = 'vtt-global-tooltip';
            popoverEl.popover = 'manual';
            popoverEl.className = 'vtt-popover-tooltip';
            document.body.appendChild(popoverEl);
        }

        let tooltipHoverTimer;
        
        chatMessages.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                clearTimeout(tooltipHoverTimer);
                const text = target.getAttribute('data-tooltip');
                if (!text) return;
                
                popoverEl.innerHTML = text;
                
                // Show popover to compute its dimensions
                popoverEl.showPopover();
                
                const rect = target.getBoundingClientRect();
                const popRect = popoverEl.getBoundingClientRect();
                
                let top = rect.top - popRect.height - 8;
                let left = rect.left + (rect.width / 2) - (popRect.width / 2);
                
                // boundary checks
                if (top < 0) top = rect.bottom + 8; // flip to bottom
                if (left < 0) left = 8;
                if (left + popRect.width > window.innerWidth) left = window.innerWidth - popRect.width - 8;
                
                popoverEl.style.top = top + 'px';
                popoverEl.style.left = left + 'px';
            }
        });

        chatMessages.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                if (!e.relatedTarget || !target.contains(e.relatedTarget)) {
                    tooltipHoverTimer = setTimeout(() => {
                        popoverEl.hidePopover();
                    }, 50);
                }
            }
        });
    }

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';

        // Check if message is a dice roll command
        if (text.startsWith('/roll ') || text.startsWith('/r ')) {
            const formula = text.replace(/^\/(roll|r)\s+/i, '');
            rollAndSend(formula);
        } else {
            // Standard text message
            vtt.socket.emit('chat:msg', { text, whisperToGM: vtt.whisperGM });
        }
    }

    function rollAndSend(formula) {
        if (!window.Renderer || !window.Renderer.dice || !window.Renderer.dice.lang) {
            vtt.socket.emit('chat:msg', { text: `Dice engine not loaded. Please wait a moment.`, whisperToGM: vtt.whisperGM });
            return;
        }

        const strippedFormula = formula.replace(/\[.*?\]/g, '');

        let wrpTree;
        try {
            wrpTree = window.Renderer.dice.lang.getTree3(strippedFormula.toLowerCase());
        } catch(e) {
            vtt.socket.emit('chat:msg', { text: `Invalid roll formula: **${formula}**`, whisperToGM: vtt.whisperGM });
            return;
        }

        if (!wrpTree) {
            vtt.socket.emit('chat:msg', { text: `Invalid roll formula: **${formula}**`, whisperToGM: vtt.whisperGM });
            return;
        }

        const meta = {};
        const total = wrpTree.tree.evl(meta);
        
        let isCritSuccess = false;
        let isCritFail = false;
        const diceList = meta.diceList || [];
        if (strippedFormula.match(/d20/i)) {
            const firstD20 = diceList.find(d => d.faces === 20);
            if (firstD20) {
                if (firstD20.val === 20) isCritSuccess = true;
                if (firstD20.val === 1) isCritFail = true;
            }
        }

        const rollResult = {
            formula,
            diceList,
            total,
            breakdownStr: (meta.html || []).join(""),
            isCritSuccess,
            isCritFail
        };

        // Broadcast to chat room
        vtt.socket.emit('chat:msg', {
            text: `rolls **${formula}**`,
            roll: rollResult,
            whisperToGM: vtt.whisperGM
        });
    }

    // Inject dice expression chips into plain text for chat display
    function injectDiceChipsChat(text) {
        if (!text) return '';
        let result = text;

        // 1. XdY+Z or XdY-Z or XdY (runs first to avoid double wrapping generated buttons)
        result = result.replace(/(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?/gi, (match, count, faces, sign, mod) => {
            let formula = `${count}d${faces}`;
            if (sign && mod) formula += `${sign}${mod}`;
            return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${match.trim()}</button>`;
        });

        // 2. +N to hit → roll chip (runs second so its output is not parsed by the d-matcher)
        result = result.replace(/\+(\d+)\s+to\s+hit/gi, (match, bonus) => {
            const formula = `1d20+${bonus}`;
            return `<button class="dice-chip" data-formula="${formula}" title="Roll attack">+${bonus} to hit</button>`;
        });

        return result;
    }

    function parseSimpleMarkdown(text) {
        if (!text) return '';
        return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.+?)\*/g, '<em>$1</em>');
    }

    function appendMessageToDom(msg, isHistorical = false) {
        if (msg.hidden && vtt.role !== 'GM') return;
        if (msg.whisperToGM && vtt.role !== 'GM' && msg.username !== vtt.username) return;

        const isSelf = msg.username === vtt.username;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message animated-fade-in ${msg.role === 'GM' ? 'gm-card' : 'player-card'}`;
        if (msg.hidden) {
            messageDiv.classList.add('msg-hidden');
        }
        if (msg.whisperToGM) {
            messageDiv.classList.add('gm-whisper-card');
        }
        if (msg.id) {
            messageDiv.dataset.msgId = msg.id;
        }
        
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let actionsHtml = '';
        if (vtt.role === 'GM' && msg.id) {
            actionsHtml = `
                <div class="chat-msg-actions">
                    <button class="btn-chat-action btn-chat-menu" title="Message Options">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    <div class="chat-msg-menu vtt-hidden">
                        <button class="btn-chat-menu-item btn-chat-toggle-hide">
                            <i class="fa-regular ${msg.hidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${msg.hidden ? 'Unhide' : 'Hide'}
                        </button>
                        <button class="btn-chat-menu-item btn-chat-delete text-danger">
                            <i class="fa-regular fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }

        let headerText = `<div class="chat-message-header"><span class="username">${msg.username}${msg.whisperToGM ? ' <span class="whisper-label" style="font-size:0.8rem; opacity:0.8; font-style:italic;">(Whisper to GM)</span>' : ''}</span><span class="timestamp">${time}</span>${actionsHtml}</div>`;
        let bodyText = msg.text ? `<span class="message-text">${parseSimpleMarkdown(msg.text)}</span>` : '';

        // Structured ability card from creature sheet
        if (msg.abilityCard) {
            const ac = msg.abilityCard;
            let descHtml = parseSimpleMarkdown(ac.text);
            
            bodyText = `
                <div class="ability-chat-card">
                    <div class="ability-chat-header">
                        <span class="ability-chat-creature">${ac.creatureName}</span>
                        <i class="fa-solid fa-bolt ability-chat-icon"></i>
                    </div>
                    <div class="ability-chat-name">${ac.abilityName}</div>
                    <div class="ability-chat-desc">${descHtml}</div>
                </div>
            `;
        }
        // If there's parsed rolls, append dice roll cards
        else if (msg.roll) {
            let breakdownHtml = "";
            if (msg.roll.breakdownStr) {
                breakdownHtml = msg.roll.breakdownStr;
            } else {
                // Fallback for legacy roll objects
                const listStr = msg.roll.diceList ? msg.roll.diceList.map(d => d.val).join(', ') : '';
                const modStr = msg.roll.modifier !== undefined && msg.roll.modifier !== 0 ? ` ${msg.roll.modifier > 0 ? '+' : '-'} ${Math.abs(msg.roll.modifier)}` : '';
                breakdownHtml = `[${listStr}]${modStr}`;
            }
            
            let rollTitle = "";
            let rollSub = "";
            
            const matchLabel = msg.text.match(/^\[([^\]:]+)(?::\s*([^\]]+))?\]\s*rolls\s*\*\*([^*]+)\*\*/i);
            if (matchLabel) {
                rollTitle = matchLabel[1];
                rollSub = matchLabel[2] ? matchLabel[2] : 'Roll';
            } else {
                rollTitle = "Dice Roll";
                rollSub = "";
            }
            
            let critClass = "";
            let critLabel = "";
            if (msg.roll.isCritSuccess) {
                critClass = "roll-crit-success";
                critLabel = `<div style="font-size:0.96rem; color:#81c784; font-weight:bold; text-align:center; margin-top:4px;"><i class="fa-regular fa-star"></i> CRITICAL SUCCESS!</div>`;
            } else if (msg.roll.isCritFail) {
                critClass = "roll-crit-fail";
                critLabel = `<div style="font-size:0.96rem; color:#e57373; font-weight:bold; text-align:center; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> CRITICAL FAILURE!</div>`;
            }

            bodyText = `
                <div class="dice-roll-card">
                    <div class="roll-card-header">
                        <div class="roll-card-header-left">
                            <span class="roll-card-title">${rollTitle}</span>
                            ${rollSub ? `<span class="roll-card-subtitle">${rollSub}</span>` : ''}
                        </div>
                        <span class="roll-card-formula">${msg.roll.formula.toUpperCase()}</span>
                    </div>
                    <div class="roll-card-result ${critClass}">${msg.roll.total}</div>
                    <div class="roll-card-breakdown">${breakdownHtml}</div>
                    ${critLabel}
                </div>
            `;
        }
        // Combined macro card: attack + save + per-type damage rows
        else if (msg.macroCard) {
            const mc = msg.macroCard;

            // Collect all dice for 3D animation
            const allDice = [];
            if (mc.atkRoll && mc.atkRoll.diceList) {
                mc.atkRoll.diceList.forEach(d => allDice.push({ ...d, damageType: null, isCritSuccess: mc.atkRoll.isCritSuccess, isCritFail: mc.atkRoll.isCritFail }));
            }
            (mc.dmgRolls || []).forEach(dr => {
                if (dr.roll && dr.roll.diceList) {
                    dr.roll.diceList.forEach(d => allDice.push({ ...d, damageType: dr.type || null }));
                }
            });
            if (!isHistorical && allDice.length > 0) trigger3dDiceRoll(allDice);

            // Damage type color map
            const dmgColors = {
                Fire: '#ff6b35', Cold: '#64b5f6', Lightning: '#ffd54f', Thunder: '#b39ddb',
                Poison: '#81c784', Acid: '#aed581', Necrotic: '#9e9e9e', Radiant: '#fff176',
                Force: '#ce93d8', Psychic: '#f48fb1', Slashing: '#ef9a9a', Piercing: '#ffcc80',
                Bludgeoning: '#bcaaa4', Healing: '#a5d6a7', 'Temp HP': '#80cbc4', 'Temporary Hit Points': '#80cbc4'
            };

            const dmgIcons = {
                Fire: 'fa-solid fa-fire', Cold: 'fa-regular fa-snowflake', Lightning: 'fa-solid fa-bolt', Thunder: 'fa-solid fa-ear-deaf',
                Poison: 'fa-solid fa-skull-crossbones', Acid: 'fa-solid fa-flask', Necrotic: 'fa-solid fa-skull', Radiant: 'fa-regular fa-sun',
                Force: 'fa-regular fa-circle-dot', Psychic: 'fa-regular fa-eye', Slashing: 'fa-solid fa-droplet-slash', Piercing: 'fa-solid fa-trowel',
                Bludgeoning: 'fa-solid fa-gavel', Healing: 'fa-regular fa-heart', 'Temp HP': 'fa-solid fa-shield-heart', 'Temporary Hit Points': 'fa-solid fa-shield-heart'
            };

            // Description section
            const descSection = mc.description
                ? `<div class="macro-card-desc">${parseSimpleMarkdown(mc.description)}</div>`
                : '';

            // Attack roll row
            let atkSection = '';
            if (mc.atkRoll) {
                const bd = mc.atkRoll.breakdownStr || (mc.atkRoll.diceList ? `[${mc.atkRoll.diceList.map(d => d.val).join(', ')}]` : '');
                const formulaText = (mc.atkRoll.formula || '').toUpperCase();
                const tooltipText = formulaText ? `${formulaText} → ${bd}` : bd;
                let critClass = "";
                let critLabel = "";
                if (mc.atkRoll.isCritSuccess) {
                    critClass = "roll-crit-success";
                    critLabel = `<div style="font-size:0.9rem; color:#81c784; font-weight:bold; margin-top:2px;"><i class="fa-regular fa-star"></i> CRITICAL HIT!</div>`;
                } else if (mc.atkRoll.isCritFail) {
                    critClass = "roll-crit-fail";
                    critLabel = `<div style="font-size:0.9rem; color:#e57373; font-weight:bold; margin-top:2px;"><i class="fa-solid fa-triangle-exclamation"></i> CRITICAL MISS!</div>`;
                }

                atkSection = `
                    <div class="macro-card-row" style="align-items: flex-start; padding: 10px 12px;">
                        <div class="macro-row-label" style="padding-top: 2px;"><i class="fa-solid fa-crosshairs macro-row-icon" style="color:#90caf9;"></i> Attack Roll</div>
                        <div class="macro-row-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex:1;">
                            <span class="macro-row-total ${critClass}" style="font-size:1.35rem; line-height:1; min-width:auto; color:var(--color-gold-light);" data-tooltip="${tooltipText.replace(/"/g, '&quot;')}">${mc.atkRoll.total}</span>
                            ${critLabel}
                        </div>
                    </div>`;
            }

            // Save DC row
            let saveSection = '';
            const saveObj = mc.saveInfo || (mc.saveDc && mc.saveAbility ? { ability: mc.saveAbility, dc: mc.saveDc } : null);
            if (saveObj) {
                saveSection = `
                    <div class="macro-card-row">
                        <div class="macro-row-label"><i class="fa-solid fa-shield-halved macro-row-icon" style="color:#a5d6a7;"></i> ${saveObj.ability} Save DC</div>
                        <div class="macro-row-right">
                            <span class="macro-row-total" style="color:#a5d6a7;">${saveObj.dc}</span>
                        </div>
                    </div>`;
            }

            // Per-type damage rows
            const dmgSections = (mc.dmgRolls || []).map(dr => {
                const color = dmgColors[dr.type] || '#ef9a9a';
                const icon = dmgIcons[dr.type] || 'fa-solid fa-droplet';
                const bd = dr.roll ? (dr.roll.breakdownStr || (dr.roll.diceList ? `[${dr.roll.diceList.map(d => d.val).join(', ')}]` : '')) : '';
                const total = dr.roll ? dr.roll.total : 0;
                const formulaText = (dr.formula || '').toUpperCase();
                const tooltipText = formulaText ? `${formulaText} → ${bd}` : bd;
                const labelText = dr.label && dr.label.trim() && dr.label.trim().toLowerCase() !== (dr.type || '').trim().toLowerCase()
                    ? ` <span style="font-size:0.75rem; opacity:0.8; font-weight:normal; margin-left:4px;">(${dr.label.trim()})</span>`
                    : '';
                return `
                    <div class="macro-card-row">
                        <div class="macro-row-label">
                            <i class="${icon} macro-row-icon" style="color:${color};"></i>
                            <span>${dr.type || 'Damage'}</span>${labelText}
                        </div>
                        <div class="macro-row-right">
                            <span class="macro-row-total" style="color:${color};" data-tooltip="${tooltipText.replace(/"/g, '&quot;')}">${total}</span>
                        </div>
                    </div>`;
            }).join('');

            bodyText = `
                <div class="macro-chat-card">
                    <div class="macro-card-header">
                        <div class="macro-card-header-left">
                            <i class="fa-solid fa-dice-d20 macro-card-icon"></i>
                            <div>
                                <span class="macro-card-charname">${mc.charName}</span>
                                <span class="macro-card-name">${mc.macroName}</span>
                            </div>
                        </div>
                    </div>
                    ${descSection}
                    <div class="macro-card-rows">
                        ${atkSection}
                        ${saveSection}
                        ${dmgSections}
                    </div>
                </div>
            `;
        }
        // Stylized item card for pinging inventory items
        else if (msg.itemCard) {
            const ic = msg.itemCard;
            let descHtml = ic.description ? ic.description.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '<i>No description provided.</i>';
            descHtml = descHtml.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            descHtml = descHtml.replace(/\*(.*?)\*/g, '<i>$1</i>');
            descHtml = descHtml.replace(/---/g, '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;">');
            descHtml = descHtml.replace(/\n/g, '<br>');
            bodyText = `
                <div class="macro-chat-card">
                    <div class="macro-card-header">
                        <div class="macro-card-header-left">
                            <i class="fa-solid fa-backpack macro-card-icon" style="color:var(--color-gold-base);"></i>
                            <div>
                                <span class="macro-card-charname">${ic.charName} pings an item</span>
                                <span class="macro-card-name" style="color:var(--color-gold-light);">${ic.itemName}</span>
                            </div>
                        </div>
                    </div>
                    <div class="macro-card-desc" style="font-size:0.96rem; color:var(--color-text-muted); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:6px;">
                        <strong>Weight:</strong> ${ic.weight} lb &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Quantity:</strong> ${ic.qty}
                    </div>
                    <div class="macro-card-desc" style="font-size:0.9rem; color:var(--color-text-secondary);">
                        ${descHtml}
                    </div>
                </div>
            `;
        }

        messageDiv.innerHTML = headerText + bodyText;
        chatMessages.appendChild(messageDiv);
        
        // Auto scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function extractFaces(dice) {
        if (!dice) return 6;
        if (typeof dice === 'number') return dice;
        const raw = dice.faces ?? dice.type ?? dice.d ?? dice.numFaces ?? dice.sides ?? 6;
        if (typeof raw === 'number') return raw;
        const match = String(raw).match(/\d+/);
        return match ? parseInt(match[0], 10) : 6;
    }

    function extractVal(dice) {
        if (!dice) return 1;
        if (typeof dice === 'number') return dice;
        const raw = dice.val ?? dice.value ?? dice.v ?? dice.result ?? 1;
        if (typeof raw === 'number') return raw;
        const match = String(raw).match(/\d+/);
        return match ? parseInt(match[0], 10) : 1;
    }

    // 3D Physics simulated dice animation routines
    function trigger3dDiceRoll(diceList, options = {}) {
        if (window.Dice3D && window.Dice3D.isEnabled()) {
            window.Dice3D.roll(diceList, options);
        }
    }

    // Initiative tracker engine logic
    function setupInitiativeControls() {
        const btnClear = document.getElementById('btn-init-clear');
        const btnNext = document.getElementById('btn-init-next');
        const btnPrev = document.getElementById('btn-init-prev');
        const btnMinimize = document.getElementById('btn-init-minimize');
        
        // Position settings
        const configPosition = document.getElementById('config-init-position');
        const configVisibility = document.getElementById('config-init-visible-global');

        if (vtt.role !== 'GM') {
            document.querySelectorAll('.init-turn-controls.gm-only, .init-carousel-header .header-actions .gm-only').forEach(el => el.classList.add('vtt-hidden'));
        }

        btnClear.addEventListener('click', () => {
            combatants = [];
            currentRound = 1;
            activeTurnIndex = -1;
            broadcastInitiative();
        });

        btnNext.addEventListener('click', () => {
            if (combatants.length === 0) return;
            activeTurnIndex++;
            if (activeTurnIndex >= combatants.length) {
                activeTurnIndex = 0;
                currentRound++;
            }
            broadcastInitiative();
        });

        btnPrev.addEventListener('click', () => {
            if (combatants.length === 0) return;
            activeTurnIndex--;
            if (activeTurnIndex < 0) {
                activeTurnIndex = combatants.length - 1;
                currentRound = Math.max(1, currentRound - 1);
            }
            broadcastInitiative();
        });

        // Global GM Toggle
        const btnToggleGlobalInit = document.getElementById('btn-toggle-initiative');
        if (btnToggleGlobalInit && vtt.role === 'GM') {
            btnToggleGlobalInit.title = "Toggle Initiative Tracker";
            btnToggleGlobalInit.addEventListener('click', () => {
                initiativeVisible = !initiativeVisible;
                // vtt.socket.emit('chat:msg', {
                //     text: `GM has ${initiativeVisible ? 'opened' : 'closed'} the initiative tracker.`
                // });
                broadcastInitiative();
            });
        }

        // Minimize / Maximize logic
        btnMinimize.addEventListener('click', () => {
            initContainer.classList.add('is-minimized');
        });

        // Position, Orientation & Free-Drag settings
        const hudPosition = document.getElementById('hud-init-position');
        const btnDrag = document.getElementById('btn-init-drag');
        const btnOrientation = document.getElementById('btn-init-orientation');
        const btnResize = document.getElementById('init-resize-handle');
        const btnScrollLeft = document.getElementById('btn-init-scroll-left');
        const btnScrollRight = document.getElementById('btn-init-scroll-right');

        let currentOrientation = localStorage.getItem('vtt_initiative_orientation') || 'vertical';

        function updateChevronIcons(pos) {
            const prevIcon = document.querySelector('#btn-init-prev i');
            const nextIcon = document.querySelector('#btn-init-next i');
            if (!prevIcon || !nextIcon) return;

            const isHorizontal = currentOrientation === 'horizontal' || pos === 'top' || pos === 'bottom';
            if (isHorizontal) {
                prevIcon.className = 'fa-solid fa-chevron-left';
                nextIcon.className = 'fa-solid fa-chevron-right';
            } else {
                prevIcon.className = 'fa-solid fa-chevron-up';
                nextIcon.className = 'fa-solid fa-chevron-down';
            }
        }

        function updateScrollButtons() {
            if (!btnScrollLeft || !btnScrollRight || !initList) return;
            if (currentOrientation !== 'horizontal') {
                btnScrollLeft.style.display = 'none';
                btnScrollRight.style.display = 'none';
                return;
            }

            const hasOverflow = initList.scrollWidth > initList.clientWidth + 5;
            if (!hasOverflow) {
                btnScrollLeft.style.display = 'none';
                btnScrollRight.style.display = 'none';
                return;
            }

            btnScrollLeft.style.display = initList.scrollLeft > 5 ? 'flex' : 'none';
            btnScrollRight.style.display = (initList.scrollLeft + initList.clientWidth < initList.scrollWidth - 5) ? 'flex' : 'none';
        }

        function setOrientation(orientation, forceCustom = false) {
            currentOrientation = orientation;
            localStorage.setItem('vtt_initiative_orientation', orientation);
            
            initContainer.classList.remove('orientation-horizontal', 'orientation-vertical');
            initContainer.classList.add(`orientation-${orientation}`);

            if (btnOrientation) {
                btnOrientation.title = orientation === 'horizontal' ? 'Switch to Vertical Orientation' : 'Switch to Horizontal Orientation';
                const icon = btnOrientation.querySelector('i');
                if (icon) {
                    icon.className = orientation === 'horizontal' ? 'fa-solid fa-arrows-up-down' : 'fa-solid fa-arrows-left-right';
                }
            }

            const currentPos = localStorage.getItem('vtt_initiative_position_style') || 'right';
            updateChevronIcons(forceCustom ? 'custom' : currentPos);
            setTimeout(updateScrollButtons, 50);
        }

        function setPositionStyle(pos, coords = null, size = null) {
            initContainer.classList.remove('pos-right', 'pos-left', 'pos-top', 'pos-bottom', 'pos-custom');
            initContainer.classList.add(`pos-${pos}`);

            if (pos === 'top' || pos === 'bottom') {
                currentOrientation = 'horizontal';
            } else if (pos === 'right' || pos === 'left') {
                currentOrientation = 'vertical';
            }

            setOrientation(currentOrientation);

            if (pos !== 'custom') {
                initContainer.style.top = '';
                initContainer.style.left = '';
                initContainer.style.right = '';
                initContainer.style.bottom = '';
                initContainer.style.width = '';
                initContainer.style.height = '';
            } else {
                if (coords && Number.isFinite(coords.left) && Number.isFinite(coords.top)) {
                    initContainer.style.left = `${coords.left}px`;
                    initContainer.style.top = `${coords.top}px`;
                    initContainer.style.right = 'auto';
                    initContainer.style.bottom = 'auto';
                }
                if (size && Number.isFinite(size.width)) {
                    initContainer.style.width = `${size.width}px`;
                }
                if (size && Number.isFinite(size.height)) {
                    initContainer.style.height = `${size.height}px`;
                }
            }

            updateChevronIcons(pos);

            if (configPosition) configPosition.value = pos;
            if (hudPosition) hudPosition.value = pos;
            localStorage.setItem('vtt_initiative_position_style', pos);
            setTimeout(updateScrollButtons, 50);
        }

        if (configPosition) {
            configPosition.addEventListener('change', (e) => setPositionStyle(e.target.value));
        }
        if (hudPosition) {
            hudPosition.addEventListener('change', (e) => setPositionStyle(e.target.value));
        }

        // Orientation Toggle Button
        if (btnOrientation) {
            btnOrientation.addEventListener('click', () => {
                const newOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
                const currentPos = localStorage.getItem('vtt_initiative_position_style') || 'right';

                // If docked in a preset that contradicts the new orientation, switch to custom floating mode smoothly
                if (currentPos !== 'custom') {
                    const rect = initContainer.getBoundingClientRect();
                    initContainer.classList.remove('pos-right', 'pos-left', 'pos-top', 'pos-bottom');
                    initContainer.classList.add('pos-custom');
                    initContainer.style.left = `${Math.round(rect.left)}px`;
                    initContainer.style.top = `${Math.round(rect.top)}px`;
                    initContainer.style.right = 'auto';
                    initContainer.style.bottom = 'auto';
                    localStorage.setItem('vtt_initiative_position_style', 'custom');
                    localStorage.setItem('vtt_initiative_custom_coords', JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));

                    [configPosition, hudPosition].forEach(sel => {
                        if (sel && !sel.querySelector('option[value="custom"]')) {
                            const opt = document.createElement('option');
                            opt.value = 'custom';
                            opt.textContent = 'Custom Dragged';
                            sel.appendChild(opt);
                        }
                        if (sel) sel.value = 'custom';
                    });
                }

                // Adjust default width/height on orientation flip if custom
                if (newOrientation === 'horizontal') {
                    initContainer.style.height = '';
                } else {
                    initContainer.style.width = '';
                }

                setOrientation(newOrientation, true);
            });
        }

        // Scroll Buttons & Wheel Scroll for Horizontal Mode
        if (btnScrollLeft && btnScrollRight && initList) {
            btnScrollLeft.addEventListener('click', (e) => {
                e.stopPropagation();
                initList.scrollBy({ left: -180, behavior: 'smooth' });
            });
            btnScrollRight.addEventListener('click', (e) => {
                e.stopPropagation();
                initList.scrollBy({ left: 180, behavior: 'smooth' });
            });
            initList.addEventListener('scroll', () => {
                updateScrollButtons();
            });
            initList.addEventListener('wheel', (e) => {
                if (currentOrientation === 'horizontal') {
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        e.preventDefault();
                        initList.scrollLeft += e.deltaY;
                        updateScrollButtons();
                    }
                }
            }, { passive: false });
        }
        // Free dragging implementation (preserves orientation)
        if (btnDrag && initContainer) {
            let isDragging = false;
            let startX = 0, startY = 0;
            let startLeft = 0, startTop = 0;

            const onPointerDown = (e) => {
                isDragging = true;
                initContainer.classList.add('is-dragging');
                document.body.style.userSelect = 'none';
                const rect = initContainer.getBoundingClientRect();
                startX = e.clientX;
                startY = e.clientY;
                startLeft = rect.left;
                startTop = rect.top;

                // Determine orientation based on current preset if dragging from docked
                const currentPos = localStorage.getItem('vtt_initiative_position_style') || 'right';
                if (currentPos === 'top' || currentPos === 'bottom') {
                    currentOrientation = 'horizontal';
                } else if (currentPos === 'right' || currentPos === 'left') {
                    currentOrientation = 'vertical';
                }

                initContainer.style.left = `${startLeft}px`;
                initContainer.style.top = `${startTop}px`;
                initContainer.style.right = 'auto';
                initContainer.style.bottom = 'auto';
                initContainer.classList.remove('pos-right', 'pos-left', 'pos-top', 'pos-bottom');
                initContainer.classList.add('pos-custom', `orientation-${currentOrientation}`);

                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', onPointerUp);
                e.preventDefault();
            };

            const onPointerMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = Math.max(0, Math.min(window.innerWidth - 100, startLeft + dx));
                const newTop = Math.max(0, Math.min(window.innerHeight - 60, startTop + dy));

                initContainer.style.left = `${newLeft}px`;
                initContainer.style.top = `${newTop}px`;
            };

            const onPointerUp = () => {
                if (!isDragging) return;
                isDragging = false;
                initContainer.classList.remove('is-dragging');
                document.body.style.userSelect = '';
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);

                const finalRect = initContainer.getBoundingClientRect();
                const coords = { left: Math.round(finalRect.left), top: Math.round(finalRect.top) };
                localStorage.setItem('vtt_initiative_custom_coords', JSON.stringify(coords));
                localStorage.setItem('vtt_initiative_position_style', 'custom');
                localStorage.setItem('vtt_initiative_orientation', currentOrientation);

                [configPosition, hudPosition].forEach(sel => {
                    if (sel && !sel.querySelector('option[value="custom"]')) {
                        const opt = document.createElement('option');
                        opt.value = 'custom';
                        opt.textContent = 'Custom Dragged';
                        sel.appendChild(opt);
                    }
                    if (sel) sel.value = 'custom';
                });
                updateChevronIcons('custom');
                updateScrollButtons();
            };

            btnDrag.addEventListener('pointerdown', onPointerDown);
        }

        // Corner resizing implementation in free-drag mode
        if (btnResize && initContainer) {
            let isResizing = false;
            let startW = 0, startH = 0;
            let startX = 0, startY = 0;

            const onResizeDown = (e) => {
                isResizing = true;
                initContainer.classList.add('is-dragging');
                document.body.style.userSelect = 'none';
                const rect = initContainer.getBoundingClientRect();
                startW = rect.width;
                startH = rect.height;
                startX = e.clientX;
                startY = e.clientY;

                document.addEventListener('pointermove', onResizeMove);
                document.addEventListener('pointerup', onResizeUp);
                e.preventDefault();
                e.stopPropagation();
            };

            const onResizeMove = (e) => {
                if (!isResizing) return;
                const dw = e.clientX - startX;
                const dh = e.clientY - startY;

                const newW = Math.max(160, Math.min(window.innerWidth * 0.95, startW + dw));
                const newH = Math.max(70, Math.min(window.innerHeight * 0.95, startH + dh));

                if (currentOrientation === 'horizontal') {
                    initContainer.style.width = `${newW}px`;
                } else {
                    initContainer.style.height = `${newH}px`;
                }
                updateScrollButtons();
            };

            const onResizeUp = () => {
                if (!isResizing) return;
                isResizing = false;
                initContainer.classList.remove('is-dragging');
                document.body.style.userSelect = '';
                document.removeEventListener('pointermove', onResizeMove);
                document.removeEventListener('pointerup', onResizeUp);

                const rect = initContainer.getBoundingClientRect();
                const size = { width: Math.round(rect.width), height: Math.round(rect.height) };
                localStorage.setItem('vtt_initiative_custom_size', JSON.stringify(size));
            };

            btnResize.addEventListener('pointerdown', onResizeDown);
        }

        // Restore saved position, orientation, and size on load
        const savedPosStyle = localStorage.getItem('vtt_initiative_position_style') || 'right';
        const savedOrientation = localStorage.getItem('vtt_initiative_orientation') || (savedPosStyle === 'top' || savedPosStyle === 'bottom' ? 'horizontal' : 'vertical');
        currentOrientation = savedOrientation;

        if (savedPosStyle === 'custom') {
            try {
                const savedCoords = JSON.parse(localStorage.getItem('vtt_initiative_custom_coords'));
                let savedSize = null;
                try {
                    savedSize = JSON.parse(localStorage.getItem('vtt_initiative_custom_size'));
                } catch (e) {}

                if (savedCoords) {
                    [configPosition, hudPosition].forEach(sel => {
                        if (sel && !sel.querySelector('option[value="custom"]')) {
                            const opt = document.createElement('option');
                            opt.value = 'custom';
                            opt.textContent = 'Custom Dragged';
                            sel.appendChild(opt);
                        }
                    });
                    setPositionStyle('custom', savedCoords, savedSize);
                } else {
                    setPositionStyle('right');
                }
            } catch (err) {
                setPositionStyle('right');
            }
        } else {
            setPositionStyle(savedPosStyle);
        }
        
        if (configVisibility && vtt.role === 'GM') {
            configVisibility.addEventListener('change', () => {
                broadcastInitiative(); // Re-render to players without HP/etc if needed, or hide container
                // Actually if global visibility is changed, we should emit an event.
                vtt.socket.emit('initiative:settings', { visible: configVisibility.value === 'visible' });
            });
        }
        
        vtt.socket.on('initiative:settings', (settings) => {
            if (vtt.role !== 'GM') {
                if (settings.visible) {
                    initContainer.style.display = '';
                    initMinTab.style.display = '';
                } else {
                    initContainer.style.display = 'none';
                    initMinTab.style.display = 'none';
                }
            }
        });
    }

    function addToInitiative(name, score, tokenId) {
        combatants.push({ name, score, tokenId });
        
        // Sort descending by initiative score
        combatants.sort((a, b) => b.score - a.score);

        if (activeTurnIndex === -1) activeTurnIndex = 0;

        broadcastInitiative();
        renderInitiativeList();
    }

    function broadcastInitiative() {
        if (!vtt.campaignState) vtt.campaignState = {};
        vtt.campaignState.initiative = {
            combatants,
            currentRound,
            activeTurnIndex,
            isVisible: initiativeVisible
        };

        vtt.socket.emit('initiative:update', {
            initiative: vtt.campaignState.initiative
        });
        renderInitiativeList();
    }

    function removeFromInitiative(tokenId) {
        if (!combatants || combatants.length === 0) return;
        const index = combatants.findIndex(c => c.tokenId === tokenId);
        if (index === -1) return;

        combatants.splice(index, 1);
        if (combatants.length === 0) {
            activeTurnIndex = -1;
            currentRound = 1;
        } else if (index < activeTurnIndex) {
            activeTurnIndex--;
        } else if (index === activeTurnIndex) {
            // Keep same index, but wrap around if it was the last element
            if (activeTurnIndex >= combatants.length) {
                activeTurnIndex = 0;
                currentRound++;
            }
        }
        broadcastInitiative();
    }

    function renderInitiativeList() {
        // Clean up video decoders to prevent lag when re-rendering
        initList.querySelectorAll('video').forEach(v => {
            v.pause();
            v.removeAttribute('src');
            v.load();
        });
        
        initList.innerHTML = '';
        roundDisplay.textContent = currentRound;

        if (!initiativeVisible) {
            initContainer.classList.add('vtt-hidden');
            return;
        }

        if (combatants.length === 0) {
            initList.innerHTML = '<div class="init-empty-state">No creatures in combat yet. Drag creatures onto map or click "Add".</div>';
            initContainer.classList.remove('vtt-hidden');
            return;
        }

        initContainer.classList.remove('vtt-hidden');

        const canvasEngine = window.VTT?.canvasEngine;
        
        const len = combatants.length;
        let renderList = [];
        if (len > 0) {
            let activeIdx = activeTurnIndex;
            if (activeIdx < 0 || activeIdx >= len) activeIdx = 0;
            renderList = [...combatants.slice(activeIdx), ...combatants.slice(0, activeIdx)];
        }
        
        const visualActiveIndex = renderList.length > 0 ? 0 : -1;

        renderList.forEach((c, idx) => {
            const row = document.createElement('div');
            row.className = `init-carousel-card ${idx === visualActiveIndex ? 'init-carousel-card--active' : ''}`;
            row.style.position = 'relative'; // For absolute positioning the delete button
            
            let name = c.name;
            let hpText = '';
            let hpColor = '#333';
            let imgHtml = '';
            
            let token = canvasEngine ? canvasEngine.getTokens()[c.tokenId] : null;
            
            // Allow clicking token to pan canvas or open sheet, and un-minimize if active
            row.addEventListener('click', (e) => {
                if (initContainer.classList.contains('is-minimized')) {
                    if (idx === visualActiveIndex) {
                        initContainer.classList.remove('is-minimized');
                        e.stopPropagation();
                    }
                    return;
                }
                
                if (token && window.VTT?.canvasEngine) {
                    window.VTT.canvasEngine.panTo(token.x, token.y);
                    if (e.shiftKey && vtt.role === 'GM') {
                        window.VTT.canvasEngine.selectToken(token.id);
                    }
                }
            });

            row.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (token && window.VTT?.canvasEngine) {
                    window.VTT.canvasEngine.panTo(token.x, token.y, null, 350);
                    window.VTT.canvasEngine.selectToken(token.id);
                }
            });

            imgHtml = `<div style="width: 36px; height: 36px; border-radius: 50%; background: #333; margin: 0; border: 2px solid #555; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #aaa;">?</div>`;
            if (token) {
                // If GM config hides HP, we don't set hpText.
                const gmHideHp = document.getElementById('config-monster-hp-visible')?.value === 'never' && vtt.role !== 'GM' && !token.isPlayer;
                if (!gmHideHp) {
                    hpText = `${token.hp}/${token.maxHp}`;
                    const ratio = token.hp / (token.maxHp || 1);
                    if (ratio > 0.5) hpColor = '#28a745';
                    else if (ratio > 0.15) hpColor = '#ffc107';
                    else hpColor = '#dc3545';
                }
                
                const needsIframe = token.img && token.img.includes('youtube.com');
                const needsImg = token.img && !needsIframe && (!token.isVideo || token.img.split('?')[0].toLowerCase().endsWith('.gif'));
                const needsVideo = token.img && !needsIframe && !needsImg && token.isVideo;
                
                if (needsIframe) {
                    imgHtml = `<div style="width: 36px; height: 36px; border-radius: 50%; background: #222; margin: 0; border: 2px solid ${hpColor}; display: flex; align-items: center; justify-content: center; font-size: 1rem; color: #aaa;" title="YouTube Token">📺</div>`;
                } else if (needsVideo) {
                    imgHtml = `<video src="${token.img}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; margin: 0; border: 2px solid ${hpColor}" muted loop playsinline preload="metadata"></video>`;
                } else {
                    imgHtml = `<img src="${token.img}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; margin: 0; border: 2px solid ${hpColor}">`;
                }
            }

            const hpPillHtml = hpText ? `<div class="init-card-hp-pill" style="background: ${hpColor};">${hpText}</div>` : '';
            
            let delBtnHtml = '';
            if (vtt.role === 'GM') {
                delBtnHtml = `<button class="init-card-del-btn" data-token-id="${c.tokenId}" title="Remove from Tracker"><i class="fa-solid fa-times"></i></button>`;
            }

            row.innerHTML = `
                ${delBtnHtml}
                <div class="init-card-content" style="display: flex; flex-direction: row; align-items: center; width: 100%;">
                    <div class="init-card-img" style="flex-shrink: 0; margin-right: 6px;">${imgHtml}</div>
                    <div class="init-card-details" style="display: flex; flex-direction: column; flex-grow: 1; align-items: flex-start; overflow: hidden;">
                        <div class="init-card-name" style="font-weight: bold; font-size: 0.85rem; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${name}</div>
                        ${hpPillHtml}
                    </div>
                    <div class="init-card-score" style="flex-shrink: 0; margin-left: auto;" ${vtt.role === 'GM' ? 'title="Right-click to edit"' : ''}>${c.score}</div>
                </div>
            `;
            
            // Delete button listener
            if (vtt.role === 'GM') {
                const delBtn = row.querySelector('.init-card-del-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeFromInitiative(c.tokenId);
                    });
                }

                // Edit initiative score listener
                const scoreEl = row.querySelector('.init-card-score');
                if (scoreEl) {
                    scoreEl.style.cursor = 'context-menu';
                    scoreEl.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (scoreEl.querySelector('input')) return; // Already editing

                        const currentScore = c.score;
                        scoreEl.innerHTML = `<input type="number" step="any" class="init-score-edit-input" value="${currentScore}" style="width: 52px; text-align: center; background: rgba(0,0,0,0.5); border: 1px solid var(--color-gold-base, #cca35a); color: var(--color-text-primary, white); border-radius: 4px; padding: 2px; font-weight: bold; outline: none;">`;
                        
                        const inputEl = scoreEl.querySelector('input');
                        inputEl.focus();
                        inputEl.select();

                        let isSaved = false;

                        const saveEdit = () => {
                            if (isSaved) return;
                            isSaved = true;
                            const newScore = parseFloat(inputEl.value);
                            if (!isNaN(newScore) && newScore !== currentScore) {
                                // Explicitly find and update in the master array to avoid stale closures
                                const targetIdx = combatants.findIndex(cb => cb.tokenId === c.tokenId);
                                if (targetIdx !== -1) {
                                    combatants[targetIdx].score = newScore;
                                } else {
                                    c.score = newScore;
                                }
                                
                                // Keep track of active token
                                let activeTokenId = null;
                                if (combatants.length > 0 && activeTurnIndex >= 0 && activeTurnIndex < combatants.length) {
                                    activeTokenId = combatants[activeTurnIndex].tokenId;
                                }

                                // Sort descending by initiative score
                                combatants.sort((a, b) => b.score - a.score);

                                // Find new active index
                                if (activeTokenId !== null) {
                                    const newIdx = combatants.findIndex(cb => cb.tokenId === activeTokenId);
                                    if (newIdx !== -1) {
                                        activeTurnIndex = newIdx;
                                    }
                                }

                                broadcastInitiative();
                            } else {
                                scoreEl.innerHTML = currentScore;
                            }
                        };

                        inputEl.addEventListener('blur', saveEdit);
                        inputEl.addEventListener('keydown', (ke) => {
                            if (ke.key === 'Enter') {
                                saveEdit();
                            } else if (ke.key === 'Escape') {
                                isSaved = true;
                                scoreEl.innerHTML = currentScore;
                            }
                        });
                        
                        // Prevent click on input from triggering token pan
                        inputEl.addEventListener('click', (ce) => {
                            ce.stopPropagation();
                        });
                    });
                }
            }

            // Video hover listeners
            const videoEl = row.querySelector('video');
            if (videoEl) {
                row.addEventListener('mouseenter', () => videoEl.play().catch(()=>{}));
                row.addEventListener('mouseleave', () => videoEl.pause());
            }

            // Highlight token on canvas when hovering over card
            row.addEventListener('mouseenter', () => {
                if (c.tokenId && window.VTT?.canvasEngine?.setInitiativeHoverToken) {
                    window.VTT.canvasEngine.setInitiativeHoverToken(c.tokenId);
                }
            });
            row.addEventListener('mouseleave', () => {
                if (window.VTT?.canvasEngine?.setInitiativeHoverToken) {
                    window.VTT.canvasEngine.setInitiativeHoverToken(null);
                }
            });

            initList.appendChild(row);
        });

        if (typeof updateScrollButtons === 'function') {
            setTimeout(updateScrollButtons, 50);
        }
    }

    function appendWhisperMessage(msg, isHistorical = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message whisper-card animated-fade-in';
        
        const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let headerText = `<span class="username">🔒 ${msg.username || vtt.username} <span class="whisper-badge">Private</span><span class="timestamp">${time}</span></span>`;
        let bodyText = `<span class="message-text">${msg.text}</span>`;

        // Structured ability card (private)
        if (msg.abilityCard) {
            const ac = msg.abilityCard;
            const descHtml = ac.text;
            bodyText = `
                <div class="ability-chat-card">
                    <div class="ability-chat-header">
                        <span class="ability-chat-creature">${ac.creatureName}</span>
                        <i class="fa-solid fa-bolt ability-chat-icon"></i>
                    </div>
                    ${ac.abilityName ? `<div class="ability-chat-name">${ac.abilityName}</div>` : ''}
                    <div class="ability-chat-desc">${descHtml}</div>
                </div>
            `;
        } else if (msg.roll) {
            const listStr = msg.roll.diceList.map(d => d.val).join(', ');
            const modStr = msg.roll.modifier !== 0 ? ` ${msg.roll.modifier > 0 ? '+' : '-'} ${Math.abs(msg.roll.modifier)}` : '';
            
            let rollTitle = "";
            let rollSub = "";
            
            const matchLabel = msg.text.match(/^\[([^\]:]+)(?::\s*([^\]]+))?\]\s*rolls\s*\*\*([^*]+)\*\*/i);
            if (matchLabel) {
                rollTitle = matchLabel[1];
                rollSub = matchLabel[2] ? matchLabel[2] : 'Roll';
            } else {
                rollTitle = "Dice Roll";
                rollSub = "";
            }
            
            bodyText = `
                <div class="dice-roll-card">
                    <div class="roll-card-header">
                        <div class="roll-card-header-left">
                            <span class="roll-card-title">${rollTitle}</span>
                            ${rollSub ? `<span class="roll-card-subtitle">${rollSub}</span>` : ''}
                        </div>
                        <span class="roll-card-formula">${msg.roll.formula.toUpperCase()}</span>
                    </div>
                    <div class="roll-card-result">${msg.roll.total}</div>
                    <div class="roll-card-breakdown">[${listStr}]${modStr}</div>
                </div>
            `;
            // Trigger 3D dice animation for whispers too
            if (!isHistorical) trigger3dDiceRoll(msg.roll.diceList);
        }

        messageDiv.innerHTML = headerText + bodyText;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
 
    // Setup Context Menu for Fast Dice Buttons
    function setupFastDiceContextMenu() {
        let menu = document.getElementById('dice-fast-roll-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'dice-fast-roll-menu';
            menu.className = 'dice-context-menu';
            menu.style.display = 'none';
            document.body.appendChild(menu);
        }
 
        let targetFormula = '';
        let targetFaces = 6;
 
        fastRollBtns.forEach(btn => {
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                
                const formula = btn.dataset.formula;
                const match = formula.match(/1?d(\d+)/i);
                if (!match) return;
                
                targetFaces = parseInt(match[1]);
                targetFormula = formula;
 
                menu.style.display = 'block';
                menu.style.left = `${e.pageX}px`;
                
                const menuHeight = 280;
                let topPos = e.pageY;
                if (topPos + menuHeight > window.innerHeight + window.scrollY) {
                    topPos = window.innerHeight + window.scrollY - menuHeight - 10;
                }
                menu.style.top = `${topPos}px`;
 
                renderContextMenuContent();
            });
        });
 
        function renderContextMenuContent() {
            menu.innerHTML = `
                <div class="dice-menu-header">Roll d${targetFaces}</div>
                <div class="dice-menu-options">
                    ${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `
                        <div class="dice-menu-option" data-count="${num}">
                            Roll ${num}d${targetFaces}
                        </div>
                    `).join('')}
                </div>
                <div class="dice-menu-divider"></div>
                <div class="dice-menu-custom">
                    <input type="number" id="dice-menu-custom-input" min="1" max="50" value="1">
                    <button id="dice-menu-custom-btn">Roll</button>
                </div>
            `;
 
            menu.querySelectorAll('.dice-menu-option').forEach(option => {
                option.addEventListener('click', () => {
                    const count = option.dataset.count;
                    const formula = `${count}d${targetFaces}`;
                    rollAndSend(formula);
                    hideMenu();
                });
            });
 
            const customInput = menu.querySelector('#dice-menu-custom-input');
            const customBtn = menu.querySelector('#dice-menu-custom-btn');
 
            customBtn.addEventListener('click', () => {
                const count = parseInt(customInput.value) || 1;
                if (count > 0) {
                    const formula = `${count}d${targetFaces}`;
                    rollAndSend(formula);
                }
                hideMenu();
            });
 
            customInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    customBtn.click();
                }
            });
        }
 
        function hideMenu() {
            menu.style.display = 'none';
        }
 
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) {
                hideMenu();
            }
        });
 
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideMenu();
            }
        });
    }

    function appendSystemMessage(text, timestamp) {
        appendMessageToDom({
            username: 'SYSTEM',
            role: 'SYSTEM',
            text: text,
            timestamp: timestamp || Date.now()
        });
    }

    return {
        appendSystemMessage,
        appendWhisperMessage,
        addToInitiative,
        removeFromInitiative,
        refreshInitiative: renderInitiativeList
    };
}
