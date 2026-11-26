import { SheetWindowManager } from '../vtt-sheet-popout.js';
import { initVttCreatureSheet } from '../vtt-creature-sheet.js';
import { initVttSpellManager } from '../vtt-spell-manager.js';
import { initVttPlayerSheet } from '../vtt-player-sheet.js';

document.querySelectorAll('.standalone-logo').forEach((img) => {
    img.addEventListener('error', () => {
        img.style.display = 'none';
    });
});

// Parse query params
const urlParams = new URLSearchParams(window.location.search);
const sheetType = urlParams.get('type') || 'player';
const sheetId = urlParams.get('id');
const tokenId = urlParams.get('tokenId');
const characterId = urlParams.get('characterId');
const monsterName = urlParams.get('name');
const monsterSource = urlParams.get('source');
const dataKey = urlParams.get('dataKey');

// Extract session credentials from URL, opener, or storage
const savedCampaign =
    urlParams.get('campaign') ||
    (window.opener && window.opener.VTT && window.opener.VTT.campaignId) ||
    localStorage.getItem('vtt_campaign') ||
    'default';
const savedUser =
    urlParams.get('username') ||
    (window.opener && window.opener.VTT && window.opener.VTT.username) ||
    localStorage.getItem('vtt_username') ||
    'Game Master';
const savedRole =
    urlParams.get('role') ||
    (window.opener && window.opener.VTT && window.opener.VTT.role) ||
    localStorage.getItem('vtt_role') ||
    'GM';

const keyId = sheetId || tokenId || characterId || (monsterName ? `${monsterName}_${monsterSource || ''}` : Date.now());
const sheetKey = SheetWindowManager.getSheetKey(sheetType, keyId);

// Global VTT Context for standalone sheet
window.VTT = {
    socket: null,
    campaignId: savedCampaign,
    username: savedUser,
    role: savedRole,
    campaignState: null,
    creatureSheet: null,
    playerSheet: null,
    isStandaloneSheet: true,
    sheetWindowManager: SheetWindowManager
};

const titleEl = document.getElementById('header-sheet-title');
const campBadge = document.getElementById('header-campaign-badge');
const dockBtn = document.getElementById('btn-dock-sheet');

if (campBadge) campBadge.textContent = `Campaign: ${savedCampaign}`;

// Initialize 3D Dice Renderer
if (window.Dice3D) {
    window.Dice3D.init({ containerId: 'dice-box-canvas-container' });
}

// Initialize Socket.IO or Static/P2P BroadcastChannel Relay Connection
const isStaticOrNoIo =
    Boolean(window.__FORGEDVTT_STATIC_WEB__) || typeof io === 'undefined' || Boolean(urlParams.get('p2p'));
const socketListeners = new Map();
const makeLocalRelaySocket = () => {
    const s = {
        connected: true,
        id: 'sheet_relay_' + Math.random().toString(36).slice(2, 8),
        on: (evt, cb) => {
            if (!socketListeners.has(evt)) socketListeners.set(evt, new Set());
            socketListeners.get(evt).add(cb);
        },
        off: (evt, cb) => {
            if (socketListeners.has(evt)) {
                if (cb) socketListeners.get(evt).delete(cb);
                else socketListeners.delete(evt);
            }
        },
        emit: (evt, ...args) => {
            if (evt === 'join') return;
            SheetWindowManager.broadcast({ action: 'SHEET_SOCKET_EMIT', event: evt, args });
        },
        _dispatch: (evt, ...args) => {
            if (socketListeners.has(evt)) {
                for (const cb of socketListeners.get(evt)) {
                    try {
                        cb(...args);
                    } catch (e) {}
                }
            }
        }
    };
    SheetWindowManager.onSocketEvent((pkt) => {
        if (pkt?.event) s._dispatch(pkt.event, ...(Array.isArray(pkt.args) ? pkt.args : []));
    });
    return s;
};

let socket;
if (isStaticOrNoIo) {
    socket = makeLocalRelaySocket();
    window.VTT.socket = socket;
    setTimeout(async () => {
        let camp = window.opener?.VTT?.campaignState || null;
        if (!camp && typeof fetch === 'function') {
            try {
                const res = await fetch(`/api/campaigns/${encodeURIComponent(savedCampaign)}`);
                if (res.ok) camp = await res.json();
            } catch (_) {}
        }
        if (!camp && !window.opener && window.__FORGEDVTT_STATIC_WEB__ && urlParams.get('p2p')) {
            const titleEl = document.getElementById('header-sheet-title');
            if (titleEl) {
                titleEl.textContent = 'Keep the main VTT tab open to sync this popped-out sheet.';
            }
        }
        socket._dispatch('joined', {
            campaignState: camp || { id: savedCampaign, name: 'Campaign', characters: {} }
        });
    }, 20);
} else {
    socket = io({
        query: {
            campaignId: savedCampaign,
            username: savedUser,
            role: savedRole
        }
    });
    window.VTT.socket = socket;

    socket.on('connect', () => {
        console.log(`[Standalone Sheet] Connected to campaign "${savedCampaign}"`);
        let gmSessionToken = window.opener?.VTT?.gmSessionToken || null;
        try {
            if (!gmSessionToken) gmSessionToken = sessionStorage.getItem('forgedvtt_gm_token_vtt') || null;
        } catch (_) {}
        if (gmSessionToken) window.VTT.gmSessionToken = gmSessionToken;
        socket.emit('join', {
            campaignId: savedCampaign,
            username: savedUser,
            role: savedRole,
            gmSessionToken,
            isSubWindow: true
        });
    });
}

// Initialize Modules
window.VTT.creatureSheet = initVttCreatureSheet(window.VTT);
window.VTT.spellManager = initVttSpellManager(window.VTT);
window.VTT.playerSheet = initVttPlayerSheet(window.VTT);

let hasEarlyRendered = false;

async function bootEarly() {
    if (sheetType !== 'player') {
        let monster = null;
        const storageKey = dataKey || `forgedvtt_popout_data_${sheetKey}`;
        try {
            const raw = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
            if (raw) {
                monster = JSON.parse(raw);
                sessionStorage.setItem(storageKey, raw);
            }
            localStorage.removeItem(storageKey);
        } catch (e) {}

        if (!monster && monsterName) {
            monster = await loadBestiaryMonster(monsterName, monsterSource);
        }
        if (monster) {
            const cPanel = document.getElementById('creature-sheet-panel');
            if (cPanel) cPanel.classList.remove('vtt-hidden');
            const displayName = monster.name || monsterName || 'Creature';
            document.title = `${displayName} - ForgeD VTT`;
            if (titleEl) titleEl.textContent = displayName;
            window.VTT.creatureSheet.openSheet(monster, tokenId, characterId);
            hasEarlyRendered = true;
            SheetWindowManager.registerStandalone(sheetKey, {
                type: sheetType,
                monsterData: monster,
                tokenId: tokenId,
                characterId: characterId,
                name: monster.name,
                source: monster.source
            });
        }
    }
}

// Attempt early render for creatures if data is available immediately
bootEarly();

// Setup Player Sheet Tab switching
document.querySelectorAll('.ps-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.ps-tab-btn').forEach((b) => {
            b.classList.remove('active');
            b.style.color = 'var(--color-text-secondary)';
            b.style.borderBottom = '2px solid transparent';
        });
        document.querySelectorAll('.ps-tab-content').forEach((c) => c.classList.add('vtt-hidden'));

        btn.classList.add('active');
        btn.style.color = 'var(--color-text-primary)';
        btn.style.borderBottom = '2px solid var(--color-gold-base)';

        const tabId = btn.dataset.tab;
        const tabEl = document.getElementById(tabId);
        if (tabEl) tabEl.classList.remove('vtt-hidden');
    });
});

// Handle joined event from server
socket.on('joined', async ({ campaignState }) => {
    console.log('[Standalone Sheet] Joined campaign successfully');
    window.VTT.campaignState = campaignState;
    await bootSheet();
});

// Fallback for campaign:loaded event
socket.on('campaign:loaded', async (data) => {
    window.VTT.campaignState = data;
    await bootSheet();
});

socket.on('character:update', (data) => {
    const char = data?.character || data;
    if (!char || !char.id || !window.VTT.campaignState) return;
    window.VTT.campaignState.characters = window.VTT.campaignState.characters || {};
    window.VTT.campaignState.characters[char.id] = char;

    if (sheetType === 'player' && (char.id === sheetId || char.id === characterId)) {
        window.VTT.playerSheet.renderSheetData(char);
        document.title = `${char.name} - ForgeD VTT`;
        if (titleEl) titleEl.textContent = char.name;
    } else if (
        (sheetType === 'creature' || sheetType === 'npc' || sheetType === 'companion') &&
        char.id === characterId
    ) {
        if (char.monsterData) {
            window.VTT.creatureSheet.openSheet(char.monsterData, tokenId, char.id);
            document.title = `${char.name} - ForgeD VTT`;
            if (titleEl) titleEl.textContent = char.name;
        }
    }
});

socket.on('character:updated', (data) => {
    const char = data?.character || data;
    if (!char || !char.id || !window.VTT.campaignState) return;
    window.VTT.campaignState.characters = window.VTT.campaignState.characters || {};
    window.VTT.campaignState.characters[char.id] = char;

    if (sheetType === 'player' && (char.id === sheetId || char.id === characterId)) {
        window.VTT.playerSheet.renderSheetData(char);
        document.title = `${char.name} - ForgeD VTT`;
        if (titleEl) titleEl.textContent = char.name;
    } else if (
        (sheetType === 'creature' || sheetType === 'npc' || sheetType === 'companion') &&
        char.id === characterId
    ) {
        if (char.monsterData) {
            window.VTT.creatureSheet.openSheet(char.monsterData, tokenId, char.id);
            document.title = `${char.name} - ForgeD VTT`;
            if (titleEl) titleEl.textContent = char.name;
        }
    }
});

socket.on('token:updated', (tokenData) => {
    if (tokenId && tokenData.id === tokenId && window.VTT.creatureSheet) {
        const currentHpEl = document.getElementById('cs-hp-current');
        if (currentHpEl && tokenData.hp !== undefined) {
            currentHpEl.textContent = tokenData.hp;
        }
    }
});

// 3D Dice roll events on tabletop and standalone sheet
socket.on('chat:msg', (msg) => {
    if (msg.hidden && window.VTT.role !== 'GM') return;
    if (msg.whisperToGM && window.VTT.role !== 'GM' && msg.username !== window.VTT.username) return;

    if (window.Dice3D && window.Dice3D.isEnabled()) {
        const parseFormulaToDice = (formula) => {
            if (!formula || typeof formula !== 'string') return [];
            const diceList = [];
            const matches = [...formula.matchAll(/(\d*)d(\d+)/gi)];
            matches.forEach((m) => {
                const count = Math.min(parseInt(m[1] || '1', 10), 20);
                const faces = parseInt(m[2], 10);
                if (faces > 0 && count > 0) {
                    for (let i = 0; i < count; i++) {
                        diceList.push({ faces, val: Math.floor(Math.random() * faces) + 1 });
                    }
                }
            });
            return diceList;
        };

        if (msg.macroCard) {
            const allDice = [];
            const mc = msg.macroCard;
            if (mc.atkRoll) {
                const atk = mc.atkRoll;
                const atkDice = atk.diceList || (atk.roll && atk.roll.diceList);
                if (Array.isArray(atkDice) && atkDice.length > 0) {
                    atkDice.forEach((d) =>
                        allDice.push({
                            ...d,
                            damageType: null,
                            isCritSuccess: Boolean(atk.isCritSuccess),
                            isCritFail: Boolean(atk.isCritFail)
                        })
                    );
                } else {
                    const f = atk.formula || (atk.roll && atk.roll.formula) || '1d20';
                    const syn = parseFormulaToDice(f);
                    syn.forEach((d) =>
                        allDice.push({
                            ...d,
                            damageType: null,
                            isCritSuccess: Boolean(atk.isCritSuccess),
                            isCritFail: Boolean(atk.isCritFail)
                        })
                    );
                }
            }
            (mc.dmgRolls || []).forEach((dr) => {
                const dmgDice =
                    dr.roll && Array.isArray(dr.roll.diceList)
                        ? dr.roll.diceList
                        : Array.isArray(dr.diceList)
                          ? dr.diceList
                          : null;
                if (Array.isArray(dmgDice) && dmgDice.length > 0) {
                    dmgDice.forEach((d) => allDice.push({ ...d, damageType: dr.type || null }));
                } else {
                    const f = (dr.roll && dr.roll.formula) || dr.formula || '';
                    if (f) {
                        const syn = parseFormulaToDice(f);
                        syn.forEach((d) => allDice.push({ ...d, damageType: dr.type || null }));
                    }
                }
            });
            if (allDice.length > 0) window.Dice3D.roll(allDice);
        } else if (msg.roll) {
            const dice = msg.roll.diceList || (Array.isArray(msg.roll) ? msg.roll : null);
            if (Array.isArray(dice) && dice.length > 0) {
                window.Dice3D.roll(dice);
            } else if (typeof msg.roll.formula === 'string') {
                const syn = parseFormulaToDice(msg.roll.formula);
                if (syn.length > 0) window.Dice3D.roll(syn);
            }
        }
    }
});

async function bootSheet() {
    if (sheetType !== 'player' && hasEarlyRendered) {
        return;
    }
    let loadedData = null;
    let displayName = 'Sheet';

    if (sheetType === 'player') {
        const pPanel = document.getElementById('player-sheet-panel');
        if (pPanel) pPanel.classList.remove('vtt-hidden');

        const char = window.VTT.campaignState?.characters?.[sheetId || characterId];
        if (char) {
            displayName = char.name;
            loadedData = { type: 'player', id: char.id };
            window.VTT.playerSheet.openSheet(char.id);
        } else {
            if (titleEl) titleEl.textContent = 'Character not found';
            return;
        }
    } else {
        const cPanel = document.getElementById('creature-sheet-panel');
        if (cPanel) cPanel.classList.remove('vtt-hidden');

        let monster = null;
        const storageKey = dataKey || `forgedvtt_popout_data_${sheetKey}`;
        try {
            const raw = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
            if (raw) {
                monster = JSON.parse(raw);
                sessionStorage.setItem(storageKey, raw);
            }
            localStorage.removeItem(storageKey);
        } catch (e) {}

        if (!monster && characterId && window.VTT.campaignState?.characters?.[characterId]) {
            const char = window.VTT.campaignState.characters[characterId];
            monster = char.monsterData;
            displayName = char.name;
        }

        if (!monster && monsterName) {
            displayName = monsterName;
            monster = await loadBestiaryMonster(monsterName, monsterSource);
        }

        if (monster) {
            displayName = monster.name || displayName;
            loadedData = {
                type: sheetType,
                monsterData: monster,
                tokenId: tokenId,
                characterId: characterId,
                name: monster.name,
                source: monster.source
            };
            window.VTT.creatureSheet.openSheet(monster, tokenId, characterId);
        } else {
            if (titleEl) titleEl.textContent = 'Creature stat block not found';
            return;
        }
    }

    document.title = `${displayName} - ForgeD VTT`;
    if (titleEl) titleEl.textContent = displayName;

    SheetWindowManager.registerStandalone(sheetKey, loadedData);
}

async function loadBestiaryMonster(name, source) {
    if (!name) return null;
    const qName = name.toLowerCase().trim();
    const qSource = source ? source.toLowerCase().trim() : null;

    if (qSource) {
        try {
            const res = await fetch(`/api/creature/${encodeURIComponent(qSource)}/${encodeURIComponent(qName)}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {}

        try {
            const partRes = await fetch(`data/bestiary-normalized/bestiary-${qSource}.json`);
            if (partRes.ok) {
                const list = await partRes.json();
                const found = list.find((m) => m.name.toLowerCase() === qName || m.id?.toLowerCase() === qName);
                if (found) return found;
            }
        } catch (e) {}
    }

    try {
        const sheetCampId = urlParams.get('campaignId') || urlParams.get('campaign') || '';
        const qs = sheetCampId ? `?campaignId=${encodeURIComponent(sheetCampId)}` : '';
        let catRes = await fetch(`/api/bestiary/catalog${qs}`);
        if (!catRes.ok) catRes = await fetch(`data/bestiary-catalog.json${qs}`);
        if (catRes.ok) {
            const catalog = await catRes.json();
            const match = catalog.find(
                (m) => m.name.toLowerCase() === qName && (!qSource || m.source.toLowerCase() === qSource)
            );
            if (match && match.source) {
                return await loadBestiaryMonster(match.name, match.source);
            }
        }
    } catch (e) {}

    return null;
}
window.fetchFullCreature = loadBestiaryMonster;

if (dockBtn) {
    dockBtn.addEventListener('click', () => {
        SheetWindowManager.dockBackToMain();
    });
}
