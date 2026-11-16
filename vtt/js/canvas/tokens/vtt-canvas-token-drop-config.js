// DnDForged Token Drop & Canvas Customization Subsystem
// Manages configurable drop and spawn behaviors for Bestiary monsters, Custom NPCs, and Companions

export const DEFAULT_TOKEN_DROP_CONFIG = {
    bestiary: {
        hpMode: 'average', // 'average' | 'max' | 'roll'
        showHpRollInChat: false,
        importSenses: true,
        autoNumberDuplicates: true,
        defaultHidden: false,
        autoRollInitiative: false,
        initiativeTrigger: 'combat_active', // 'combat_active' | 'always'
        dispositionRing: 'hostile', // 'hostile' | 'neutral' | 'friendly' | 'custom' | 'none'
        customRingColor: '#ef4444'
    },
    customNpc: {
        hpMode: 'average',
        showHpRollInChat: false,
        importSenses: true,
        autoNumberDuplicates: false,
        defaultHidden: false,
        autoRollInitiative: false,
        initiativeTrigger: 'combat_active',
        dispositionRing: 'neutral',
        customRingColor: '#eab308'
    },
    companion: {
        hpMode: 'average',
        showHpRollInChat: false,
        importSenses: true,
        autoNumberDuplicates: false,
        defaultHidden: false,
        autoRollInitiative: false,
        initiativeTrigger: 'combat_active',
        dispositionRing: 'friendly',
        customRingColor: '#22c55e'
    }
};

export const DISPOSITION_COLORS = {
    hostile: '#ef4444',
    neutral: '#eab308',
    friendly: '#22c55e',
    none: 'transparent'
};

const STORAGE_KEY = 'vtt_token_drop_settings';

/**
 * Loads the current token drop configuration for a section or all sections.
 * Checks campaign state first, then canvasEngine settings, then localStorage, falling back to defaults.
 */
export function getTokenDropConfig(section = null, vttContext = null) {
    const vtt = vttContext || (typeof window !== 'undefined' ? window.VTT : null);
    let fullConfig = {
        bestiary: { ...DEFAULT_TOKEN_DROP_CONFIG.bestiary },
        customNpc: { ...DEFAULT_TOKEN_DROP_CONFIG.customNpc },
        companion: { ...DEFAULT_TOKEN_DROP_CONFIG.companion }
    };

    // 1. Try campaign settings from campaignState or canvasEngine
    const campSettings = vtt?.campaignState?.settings?.tokenDrop || vtt?.canvasEngine?.campaignSettings?.tokenDrop;

    if (campSettings) {
        if (campSettings.bestiary) fullConfig.bestiary = { ...fullConfig.bestiary, ...campSettings.bestiary };
        if (campSettings.customNpc) fullConfig.customNpc = { ...fullConfig.customNpc, ...campSettings.customNpc };
        if (campSettings.companion) fullConfig.companion = { ...fullConfig.companion, ...campSettings.companion };
    } else if (typeof localStorage !== 'undefined') {
        // 2. Try localStorage fallback
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.bestiary) fullConfig.bestiary = { ...fullConfig.bestiary, ...parsed.bestiary };
                if (parsed.customNpc) fullConfig.customNpc = { ...fullConfig.customNpc, ...parsed.customNpc };
                if (parsed.companion) fullConfig.companion = { ...fullConfig.companion, ...parsed.companion };
            }
        } catch (e) {
            console.warn('Failed to parse token drop settings from localStorage:', e);
        }
    }

    if (section && fullConfig[section]) {
        return { ...fullConfig[section] };
    }
    return fullConfig;
}

/**
 * Persists token drop configuration across campaign settings and localStorage.
 */
export function saveTokenDropConfig(newConfig, vttContext = null) {
    const vtt = vttContext || (typeof window !== 'undefined' ? window.VTT : null);
    if (!newConfig) return;

    // Cache locally
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
        }
    } catch (e) {
        console.warn('Failed to save token drop settings to localStorage:', e);
    }

    // Persist in campaign state and emit socket event if available
    if (vtt?.campaignState) {
        if (!vtt.campaignState.settings) vtt.campaignState.settings = {};
        vtt.campaignState.settings.tokenDrop = JSON.parse(JSON.stringify(newConfig));

        if (vtt.socket) {
            vtt.socket.emit('settings:update', { settings: vtt.campaignState.settings });
        }
    }
}

/**
 * Parses dice formulas like '13d12 + 39', '3d8', '2d6-1', and compound expressions like '9d8 + 18 + 20'.
 * Returns { count, die, modifier, dice: [{count, die}], rawFormula } or null if invalid.
 */
export function parseHpFormula(formulaStr) {
    if (!formulaStr || typeof formulaStr !== 'string') return null;
    const raw = formulaStr.trim();
    if (!raw) return null;

    // Match all dice terms and constant modifiers e.g. "9d8", "+ 18", "+ 20", "- 5"
    const termRegex = /([+-]?)\s*(?:(\d+)d(\d+)|(\d+))/gi;
    let match;
    const totalDice = [];
    let modifier = 0;
    let hasDice = false;

    while ((match = termRegex.exec(raw)) !== null) {
        const sign = match[1] === '-' ? -1 : 1;
        if (match[2] !== undefined && match[3] !== undefined) {
            // Dice term: NdX
            const count = parseInt(match[2], 10);
            const die = parseInt(match[3], 10);
            totalDice.push({ count: sign * count, die });
            hasDice = true;
        } else if (match[4] !== undefined) {
            // Static modifier
            modifier += sign * parseInt(match[4], 10);
        }
    }

    if (!hasDice) return null;

    const primaryDice = totalDice[0];
    return {
        count: primaryDice ? primaryDice.count : 0,
        die: primaryDice ? primaryDice.die : 0,
        dice: totalDice,
        modifier: modifier,
        rawFormula: raw
    };
}

/**
 * Evaluates HP based on creature/monster data and hpMode ('average', 'max', 'roll').
 * Returns { hp, maxHp, rollDetails }
 */
export function evaluateMonsterHp(monster, hpMode = 'average', options = {}) {
    if (!monster) return { hp: 20, maxHp: 20, rollDetails: null };

    // Extract average HP
    let averageHp = 20;
    if (typeof monster.hp === 'number') {
        averageHp = monster.hp;
    } else if (monster.hp && typeof monster.hp.average === 'number') {
        averageHp = monster.hp.average;
    } else if (typeof monster.maxHp === 'number') {
        averageHp = monster.maxHp;
    } else if (typeof monster.hpCurrent === 'number') {
        averageHp = monster.hpMax || monster.hpCurrent;
    }

    // Extract hit dice formula
    const formulaStr =
        monster.hpFormula ||
        (monster.hp && typeof monster.hp.formula === 'string' ? monster.hp.formula : null) ||
        monster.monsterData?.hpFormula ||
        (monster.monsterData?.hp && typeof monster.monsterData.hp.formula === 'string'
            ? monster.monsterData.hp.formula
            : null);

    const parsed = parseHpFormula(formulaStr);

    if (hpMode === 'max' && parsed) {
        let maxVal = parsed.modifier;
        const diceList = parsed.dice || [{ count: parsed.count, die: parsed.die }];
        for (const d of diceList) {
            maxVal += d.count * d.die;
        }
        maxVal = Math.max(1, maxVal);
        return {
            hp: maxVal,
            maxHp: maxVal,
            rollDetails: { formula: parsed.rawFormula, type: 'max', result: maxVal }
        };
    }

    if (hpMode === 'roll' && parsed) {
        let rolledTotal = parsed.modifier;
        const rolls = [];
        const diceList = parsed.dice || [{ count: parsed.count, die: parsed.die }];
        for (const d of diceList) {
            for (let i = 0; i < Math.abs(d.count); i++) {
                const roll = Math.floor(Math.random() * d.die) + 1;
                rolls.push(roll);
                rolledTotal += (d.count >= 0 ? 1 : -1) * roll;
            }
        }
        const finalHp = Math.max(1, rolledTotal);

        return {
            hp: finalHp,
            maxHp: finalHp,
            rollDetails: {
                formula: parsed.rawFormula,
                type: 'roll',
                rolls,
                modifier: parsed.modifier,
                result: finalHp
            }
        };
    }

    // Default to average
    return {
        hp: averageHp,
        maxHp: averageHp,
        rollDetails: null
    };
}

/**
 * Checks existing tokens on canvas for duplicate names and appends sequential numbering.
 * Handles both plain names ("Goblin") and already-numbered names ("Goblin 1", "Guard 2").
 * E.g., dropping 'Goblin' with existing ['Goblin', 'Goblin 2'] -> returns 'Goblin 3'.
 * E.g., dropping 'Goblin 1' on empty canvas -> returns 'Goblin 1'.
 */
export function resolveDuplicateTokenName(baseName, existingTokens = {}) {
    if (!baseName || typeof baseName !== 'string') return 'Token';
    const cleanBase = baseName.trim();

    const tokenList = Array.isArray(existingTokens)
        ? existingTokens
        : typeof existingTokens === 'object' && existingTokens !== null
          ? Object.values(existingTokens)
          : [];

    // Extract root name and optional existing suffix number (e.g. "Goblin 1" -> "Goblin", 1)
    const matchBase = cleanBase.match(/^(.*?)(?:\s+(\d+))$/);
    const rootName = matchBase ? matchBase[1].trim() : cleanBase;
    const hasExplicitTrailingNum = !!matchBase;

    if (tokenList.length === 0) {
        return hasExplicitTrailingNum ? cleanBase : `${cleanBase} 1`;
    }

    const escaped = rootName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}(?:\\s+(\\d+))?$`, 'i');

    let highestNum = 0;
    let foundAny = false;

    for (const t of tokenList) {
        if (!t || !t.name) continue;
        const match = t.name.trim().match(regex);
        if (match) {
            foundAny = true;
            const num = match[1] ? parseInt(match[1], 10) : 1;
            if (num > highestNum) highestNum = num;
        }
    }

    if (!foundAny) {
        return hasExplicitTrailingNum ? cleanBase : `${cleanBase} 1`;
    }

    return `${rootName} ${highestNum + 1}`;
}

/**
 * Resolves token ring/border color based on disposition choice.
 */
export function resolveDispositionColor(disposition, customColor = null) {
    if (!disposition || disposition === 'none') return null;
    if (disposition === 'custom') return customColor || '#ef4444';
    return DISPOSITION_COLORS[disposition] || null;
}
