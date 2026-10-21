// DnDForged Player Sheet - Roll Simulations, Formulas & Feature Parsers
import { VTTDiceParser } from '../vtt-dice-parser.js';

export function cleanId(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function resolveCharClassLevel(char, targetClassName) {
    if (!char || !char.classes || !Array.isArray(char.classes)) return 0;
    const target = (targetClassName || '').replace(/\s*\[.*?\]$/, '').trim().toLowerCase();
    const c = char.classes.find(cl => {
        const raw = (cl.name || '').replace(/\s*\[.*?\]$/, '').trim().toLowerCase();
        return raw === target || (cl.name || '').trim().toLowerCase() === target;
    });
    return c ? (parseInt(c.level) || 1) : 0;
}

export function injectDiceChips(html) {
    if (!html) return '';
    let clean = html;

    // Strip any existing dice-chips back to their inner content to prevent nested buttons
    clean = clean.replace(/<button class="dice-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/gi, '$1');
    clean = clean.replace(/<button class="dice-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/gi, '$1');

    const parts = clean.split(/(<[^>]*>)/g);
    let inButton = false;
    let inAnchor = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        if (part.startsWith('<') && part.endsWith('>')) {
            const tagLower = part.toLowerCase();
            if (tagLower.startsWith('<button')) inButton = true;
            else if (tagLower.startsWith('</button')) inButton = false;
            else if (tagLower.startsWith('<a')) inAnchor = true;
            else if (tagLower.startsWith('</a')) inAnchor = false;
            continue;
        }

        if (!inButton && !inAnchor) {
            let text = part;
            text = text.replace(/(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?/gi, (match, count, faces, sign, mod) => {
                let formula = `${count}d${faces}`;
                if (sign && mod) formula += `${sign}${mod}`;
                return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${match.trim()}</button>`;
            });
            text = text.replace(/\+(\d+)\s+to\s+hit/gi, (match, bonus) => {
                const formula = `1d20+${bonus}`;
                return `<button class="dice-chip" data-formula="${formula}" title="Roll attack: ${formula}">+${bonus} to hit</button>`;
            });
            text = text.replace(/DC\s+(\d+)/gi, (match, dcVal) => {
                return `<button class="dice-chip dc-chip" data-dc="${dcVal}" style="border-color: var(--color-gold-base);" title="Ping DC ${dcVal} to Chat">DC ${dcVal}</button>`;
            });
            parts[i] = text;
        }
    }
    return parts.join('');
}

export function simulateRoll(formula, critRange = 20, optEvent = null) {
    if (!formula || typeof formula !== 'string') {
        return { formula: formula || '0', diceList: [], total: 0, breakdownStr: '0', compactBreakdown: '0', isCritSuccess: false, isCritFail: false };
    }

    let activeFormula = formula.trim();
    if (activeFormula.startsWith('+')) activeFormula = activeFormula.slice(1).trim();

    // Advantage / Disadvantage handling
    let isAdvantage = false;
    let isDisadvantage = false;
    
    if (activeFormula.match(/(?:^|[^0-9])(?:1)?d20/i)) {
        let rollMode = 'normal';
        try {
            rollMode = (window.VTT && window.VTT.currentRollMode) || localStorage.getItem('vtt_current_roll_mode') || 'normal';
        } catch (e) {
            rollMode = (window.VTT && window.VTT.currentRollMode) || 'normal';
        }

        const evt = optEvent || window.event;
        const isShift = (evt && evt.shiftKey) || (typeof window.VTT_isShiftPressed === 'function' && window.VTT_isShiftPressed());
        const isCtrl = (evt && evt.ctrlKey) || (typeof window.VTT_isCtrlPressed === 'function' && window.VTT_isCtrlPressed());

        if (isShift) rollMode = 'adv';
        else if (isCtrl) rollMode = 'dis';

        if (rollMode === 'adv') isAdvantage = true;
        if (rollMode === 'dis') isDisadvantage = true;
    }

    if (isAdvantage) activeFormula = activeFormula.replace(/(^|[^0-9])(?:1)?d20/gi, '$12d20kh1');
    if (isDisadvantage) activeFormula = activeFormula.replace(/(^|[^0-9])(?:1)?d20/gi, '$12d20kl1');

    if (!activeFormula) {
        return {
            formula,
            diceList: [],
            total: 0,
            breakdownStr: '',
            compactBreakdown: '',
            isCritSuccess: false,
            isCritFail: false
        };
    }

    const parser = (typeof VTTDiceParser !== 'undefined' ? VTTDiceParser : window.VTTDiceParser);
    let rollResult = null;

    if (parser && typeof parser.roll === 'function') {
        try {
            rollResult = parser.roll(activeFormula);
        } catch (e) {
            console.warn('[simulateRoll] VTTDiceParser.roll failed:', e);
        }
    }

    const strippedFormula = activeFormula.replace(/\[.*?\]/g, '').trim();

    if (!rollResult && window.Renderer?.dice?.lang?.getTree3) {
        try {
            const wrpTree = window.Renderer.dice.lang.getTree3(strippedFormula.toLowerCase());
            if (wrpTree && wrpTree.tree) {
                const meta = {};
                const total = wrpTree.tree.evl(meta);
                rollResult = {
                    total,
                    diceList: meta.diceList || [],
                    breakdownStr: (meta.html || []).join("") || `<strong>${total}</strong>`,
                    compactBreakdown: `${total}`,
                    isCritSuccess: meta.isCritSuccess || false,
                    isCritFail: meta.isCritFail || false
                };
            }
        } catch (e) {
            console.warn('[simulateRoll] Renderer.dice.lang.getTree3 failed:', e);
        }
    }

    // Standalone fallback evaluator if parsers unavailable or threw
    if (!rollResult) {
        const diceList = [];
        const breakdownParts = [];
        const parsedStr = strippedFormula.replace(/(\d*)d(\d+)(?:(kh|kl|dl|dh)(\d*))?/gi, (match, countStr, facesStr, keepDropType, keepDropNumStr) => {
            const count = parseInt(countStr || '1', 10);
            const faces = parseInt(facesStr, 10);
            if (faces <= 0 || count <= 0) return '0';
            const rolled = [];
            for (let i = 0; i < count; i++) {
                rolled.push(Math.floor(Math.random() * faces) + 1);
            }
            let droppedIndices = new Set();
            if (keepDropType) {
                const kNum = parseInt(keepDropNumStr || '1', 10);
                const indexed = rolled.map((val, idx) => ({ val, idx })).sort((a, b) => b.val - a.val);
                if (keepDropType === 'kh') indexed.slice(kNum).forEach(x => droppedIndices.add(x.idx));
                else if (keepDropType === 'kl') indexed.slice(0, -kNum).forEach(x => droppedIndices.add(x.idx));
            }
            rolled.forEach((val, idx) => {
                diceList.push({ faces, val, isDropped: droppedIndices.has(idx) });
            });
            const subtotal = rolled.reduce((acc, val, idx) => droppedIndices.has(idx) ? acc : acc + val, 0);
            const rollStrings = rolled.map((val, idx) => droppedIndices.has(idx) ? `<s>${val}</s>` : `${val}`);
            breakdownParts.push(`[${rollStrings.join(', ')}]`);
            return subtotal.toString();
        });

        let total = 0;
        try {
            const safeMath = parsedStr.replace(/[^0-9+\-*/().\s]/g, '');
            if (safeMath) total = Math.round(new Function(`"use strict"; return (${safeMath})`)());
        } catch (e) {
            total = 0;
        }

        const breakdownStr = breakdownParts.length > 0 
            ? `${breakdownParts.join(' + ')}${strippedFormula.includes('+') || strippedFormula.includes('-') ? ` = <strong>${total}</strong>` : ''}`
            : `<strong>${total}</strong>`;

        rollResult = { total, diceList, breakdownStr, isCritSuccess: false, isCritFail: false };
    }

    if ((!rollResult.diceList || rollResult.diceList.length === 0) && strippedFormula.match(/\d*d\d+/i)) {
        rollResult.diceList = [];
        const dMatches = [...strippedFormula.matchAll(/(\d*)d(\d+)/gi)];
        dMatches.forEach(m => {
            const count = parseInt(m[1] || '1', 10);
            const faces = parseInt(m[2], 10);
            for (let i = 0; i < count; i++) {
                rollResult.diceList.push({
                    faces,
                    val: Math.floor(Math.random() * faces) + 1,
                    isDropped: false
                });
            }
        });
    }

    let isCritSuccess = false;
    let isCritFail = false;
    const diceList = rollResult.diceList || [];
    if (strippedFormula.match(/d20/i) && diceList.length > 0) {
        const activeD20s = diceList.filter(d => d.faces === 20 && !d.isDropped);
        if (activeD20s.length > 0) {
            if (activeD20s.some(d => d.val >= (critRange || 20))) isCritSuccess = true;
            if (activeD20s.some(d => d.val === 1) && !isCritSuccess) isCritFail = true;
        }
    } else {
        isCritSuccess = rollResult.isCritSuccess || false;
        isCritFail = rollResult.isCritFail || false;
    }

    return {
        formula,
        diceList,
        total: rollResult.total,
        breakdownStr: rollResult.breakdownStr || `<strong>${rollResult.total}</strong>`,
        compactBreakdown: rollResult.compactBreakdown || `${rollResult.total}`,
        isCritSuccess,
        isCritFail
    };
}

export function evaluateAbilityFormula(formula, formulaConfig, char) {
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

export function evaluateAbilityMaxUses(usesMax, char) {
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

export function extractTextFromEntries(entries) {
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

export function getFeatureDescriptionText(f) {
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

export function detectFeatureCounter(f, desc, char) {
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

export function getFeatureKey(f) {
    if (!f) return '';
    return cleanId(f.name || '') + '__' + cleanId(f.source || '') + '__' + (f.level || 0);
}
