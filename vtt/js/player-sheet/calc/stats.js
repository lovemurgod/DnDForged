/**
 * Core Character Stat & Roll Calculation Engine
 */

import { simulateRoll } from '../vtt-sheet-rolls.js';

export function getTotalStat(char, ab) {
    if (!char) return 10;
    const key = (ab || 'str').toLowerCase();
    const base = parseInt(char.stats && char.stats[key]) || 10;
    const mod = parseInt(char.statMods && char.statMods[key]) || 0;
    return base + mod;
}

export function getMod(score) {
    return Math.floor(((parseInt(score) || 10) - 10) / 2);
}

export function getProfBonus(level) {
    const l = parseInt(level) || 1;
    return Math.ceil(l / 4) + 1;
}

export const STANDARD_HIT_DICE = {
    artificer: 'd8',
    barbarian: 'd12',
    bard: 'd8',
    cleric: 'd8',
    druid: 'd8',
    fighter: 'd10',
    monk: 'd8',
    paladin: 'd10',
    ranger: 'd10',
    rogue: 'd8',
    sorcerer: 'd6',
    warlock: 'd8',
    wizard: 'd6',
    'blood hunter': 'd10',
    pugilist: 'd10',
    gunslinger: 'd8',
    illrigger: 'd10',
    psion: 'd6',
    scholar: 'd8',
    warden: 'd10',
    captain: 'd8',
    messenger: 'd8',
    tamer: 'd8',
    'monster hunter': 'd10',
    'treasure hunter': 'd8',
    mystic: 'd8'
};

export function getClassHitDie(className, classCatalog = null) {
    if (!className) return 'd8';
    const name = className
        .replace(/\s*\[.*?\]$/, '')
        .toLowerCase()
        .trim();
    if (STANDARD_HIT_DICE[name]) return STANDARD_HIT_DICE[name];
    if (Array.isArray(classCatalog)) {
        const matched = classCatalog.find((cls) => cls && cls.name && cls.name.toLowerCase() === name);
        if (matched && matched.hitDie) return matched.hitDie;
    }
    return 'd8';
}

export function evaluateAttackRoll(char, m, isSpell = false, optEvent = null) {
    if (!char || !m) return null;
    let globalAtkMod = parseInt(isSpell ? char.spellSettings?.atkMod || 0 : char.attackSettings?.atkMod || 0) || 0;
    let atkFormula = '';

    const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
    if (toggles && Array.isArray(toggles)) {
        toggles
            .filter((t) => t.enabled)
            .forEach((t) => {
                if (t.target === 'atk' || t.target === 'both') {
                    let f = t.formula || '0';
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
        return simulateRoll(
            formula + (globalAtkMod ? (globalAtkMod >= 0 ? '+' : '') + globalAtkMod + '[Global]' : '') + atkFormula,
            m.critRange || 20,
            optEvent
        );
    }
    if (atkStat === 'none') {
        if (m.attackBonus) {
            const hasAttack = m.attackBonus.includes('d');
            const formula = hasAttack
                ? m.attackBonus
                : `1d20${m.attackBonus.startsWith('+') || m.attackBonus.startsWith('-') ? m.attackBonus : '+' + m.attackBonus}`;
            return simulateRoll(
                formula + (globalAtkMod ? (globalAtkMod >= 0 ? '+' : '') + globalAtkMod + '[Global]' : '') + atkFormula,
                m.critRange || 20,
                optEvent
            );
        }
        return null;
    }

    const prof = getProfBonus(char.level);
    const statScore = getTotalStat(char, atkStat.toLowerCase()) || 10;
    const statMod = getMod(statScore);
    const addProf = !!m.attackProf;
    const extra = m.attackExtra !== undefined ? parseInt(m.attackExtra) || 0 : 0;

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

    return simulateRoll(formula, m.critRange || 20, optEvent);
}

export function evaluateSaveDc(char, m, isSpell = false) {
    if (!char || !m || !m.saveAbility) return null;
    let dcStat = m.saveDcStat || 'none';
    if (dcStat === 'spell') {
        dcStat = char.spellSettings?.ability || char.spellAbility || 'INT';
    }
    const prof = getProfBonus(char.level);

    if (dcStat === 'custom') {
        const dc =
            m.saveDcCustom !== undefined && m.saveDcCustom !== null
                ? parseInt(m.saveDcCustom)
                : parseInt(m.saveDcBase) || 10;
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

    let globalDcMod = parseInt(isSpell ? char.spellSettings?.dcMod || 0 : char.attackSettings?.dcMod || 0) || 0;
    const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
    if (toggles && Array.isArray(toggles)) {
        toggles
            .filter((t) => t.enabled)
            .forEach((t) => {
                if (t.target === 'dc' || t.target === 'both') {
                    globalDcMod += parseInt(t.formula) || 0;
                }
            });
    }

    const extra = m.saveDcExtra !== undefined ? parseInt(m.saveDcExtra) || 0 : 0;
    const dc = 8 + prof + statMod + extra + globalDcMod;
    return { ability: m.saveAbility, dc };
}

export function evaluateDamageRolls(char, m, isSpell = false, isCrit = false, optEvent = null) {
    if (!char || !m || !m.damage || !m.damage.length) return [];

    let globalDmgMod = parseInt(isSpell ? char.spellSettings?.dmgMod || 0 : char.attackSettings?.dmgMod || 0) || 0;
    let dmgFormula = '';
    let typedToggles = [];

    const toggles = isSpell ? char.spellSettings?.toggles : char.attackSettings?.toggles;
    if (toggles && Array.isArray(toggles)) {
        toggles
            .filter((t) => t.enabled)
            .forEach((t) => {
                if (t.target === 'dmg' || t.target === 'both') {
                    if (t.dmgType && t.dmgType !== '') {
                        typedToggles.push(t);
                    } else {
                        let f = t.formula || '0';
                        let cleanF = f.startsWith('+') || f.startsWith('-') ? f : '+' + f;
                        dmgFormula += `${cleanF}[${t.name || 'Toggle'}]`;
                    }
                }
            });
    }

    const results = m.damage.map((d) => {
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
        if (d.custom && d.custom.trim() !== '') {
            const cleanCustom = d.custom.trim();
            rollFormula += `${cleanCustom.startsWith('+') || cleanCustom.startsWith('-') ? '' : '+'}${cleanCustom}`;
        }
        if (globalDmgMod !== 0) {
            rollFormula += `${globalDmgMod >= 0 ? '+' : ''}${globalDmgMod}[Global]`;
        }
        rollFormula += dmgFormula;

        return {
            type: d.type || 'Bludgeoning',
            result: simulateRoll(rollFormula, 20, optEvent, isCrit)
        };
    });

    // Append typed toggles (e.g. +1d6 Fire)
    typedToggles.forEach((t) => {
        let f = (t.formula || '').trim();
        results.push({
            type: t.dmgType,
            result: simulateRoll(f, 20, optEvent, isCrit)
        });
    });

    return results;
}

/**
 * Calculate effective HP taking baseHpMax and hpToggles into account.
 * Adjusts current HP by the change in Max HP and clamps between 0 and new hpMax.
 */
export function calculateEffectiveHp(char) {
    if (!char) return { hpMax: 10, hpCurrent: 10 };
    if (char.baseHpMax === undefined || char.baseHpMax === null) {
        char.baseHpMax = parseInt(char.hpMax) || 10;
    }
    const baseHp = parseInt(char.baseHpMax) || 10;
    let bonus = 0;
    if (char.hpToggles && Array.isArray(char.hpToggles)) {
        char.hpToggles
            .filter((t) => t && t.enabled)
            .forEach((t) => {
                const val = parseInt(t.formula) || 0;
                bonus += val;
            });
    }

    const prevHpMax = char.hpMax !== undefined ? parseInt(char.hpMax) : baseHp;
    const newHpMax = Math.max(1, baseHp + bonus);
    const delta = newHpMax - prevHpMax;

    char.hpMax = newHpMax;
    if (char.hpCurrent !== undefined) {
        let cur = parseInt(char.hpCurrent) || 0;
        cur = cur + delta;
        char.hpCurrent = Math.max(0, Math.min(newHpMax, cur));
    } else {
        char.hpCurrent = newHpMax;
    }

    return { hpMax: char.hpMax, hpCurrent: char.hpCurrent };
}

/**
 * Parse an AC toggle formula string into an integer bonus/penalty.
 * Supports integers (+2, -1) and ability modifiers (+dex, +int, etc.).
 */
export function parseAcFormula(formula, char) {
    if (!formula) return 0;
    let str = formula.toString().toLowerCase().trim();
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((ab) => {
        const regex = new RegExp(`\\b${ab}\\b`, 'g');
        if (regex.test(str)) {
            const mod = getMod(getTotalStat(char, ab) || 10);
            str = str.replace(regex, mod >= 0 ? `+${mod}` : `${mod}`);
        }
    });
    const matches = str.match(/[+-]?\s*\d+/g);
    if (!matches) return 0;
    return matches.reduce((sum, term) => sum + (parseInt(term.replace(/\s+/g, '')) || 0), 0);
}

/**
 * Calculate effective AC taking baseAc, acMod, and acToggles into account.
 */
export function calculateEffectiveAc(char) {
    if (!char) return 10;
    if (char.baseAc === undefined || char.baseAc === null) {
        char.baseAc = parseInt(char.ac) || 10;
    }
    const baseAc = parseInt(char.baseAc) || 10;
    const acMod = parseInt(char.acMod) || 0;
    let toggleBonus = 0;

    if (char.acToggles && Array.isArray(char.acToggles)) {
        char.acToggles
            .filter((t) => t && t.enabled)
            .forEach((t) => {
                toggleBonus += parseAcFormula(t.formula, char);
            });
    }

    char.ac = Math.max(1, baseAc + acMod + toggleBonus);
    return char.ac;
}
