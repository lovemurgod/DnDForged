/**
 * ForgeDVTT Standalone Dice Parser & Expression Evaluator
 * Supports polyhedral dice (d4, d6, d8, d10, d12, d20, d100),
 * advantage/disadvantage (2d20kh1, 2d20kl1), keep/drop (4d6kh3, 4d6dl1),
 * exploding dice (1d6!), reroll (1d10ro<2), flat modifiers, and math expressions.
 * Provides a drop-in replacement for window.Renderer.dice.lang.getTree3.
 */

export class VTTDiceParser {
    /**
     * Parses and evaluates a dice expression formula string.
     * @param {string} formula
     * @returns {{ total: number, diceList: Array<{faces: number, val: number}>, breakdownStr: string, isCritSuccess: boolean, isCritFail: boolean }}
     */
    static roll(formula) {
        if (!formula || typeof formula !== 'string') {
            return { total: 0, diceList: [], breakdownStr: '0', compactBreakdown: '0', isCritSuccess: false, isCritFail: false };
        }

        let trimmedFormula = formula.trim();
        if (trimmedFormula.startsWith('+')) trimmedFormula = trimmedFormula.slice(1).trim();

        const diceList = [];
        const detailedParts = [];
        const compactParts = [];
        let isCritSuccess = false;
        let isCritFail = false;

        // Tokenize terms: sign, dice expression / number, and optional bracketed label [LABEL]
        const termRegex = /([+\-*/]?)\s*([0-9]*d[0-9]+(?:(?:kh|kl|dl|dh)[0-9]*)?(?:ro(?:<=|>=|<|>|=)?[0-9]+)?!?|[0-9]+(?:\.[0-9]+)?)\s*(?:\[([^\]]*)\])?/gi;

        let evalExpression = '';
        let match;
        let matchCount = 0;

        while ((match = termRegex.exec(trimmedFormula)) !== null) {
            if (match.index === termRegex.lastIndex) {
                termRegex.lastIndex++;
            }
            matchCount++;
            const op = match[1] || (matchCount === 1 ? '' : '+');
            const token = match[2];
            const label = match[3] ? match[3].trim() : '';

            // Check if token is a dice expression
            const diceMatch = token.match(/^(\d*)d(\d+)(?:(kh|kl|dl|dh)(\d*))?(?:ro(<=|>=|<|>|=)?(\d+))?(!)?$/i);
            if (diceMatch) {
                const countStr = diceMatch[1];
                const facesStr = diceMatch[2];
                const keepDropType = diceMatch[3];
                const keepDropNumStr = diceMatch[4];
                const roComp = diceMatch[5];
                const roTargetStr = diceMatch[6];
                const explode = diceMatch[7];

                const count = parseInt(countStr || '1', 10);
                const faces = parseInt(facesStr, 10);
                const rolled = [];

                if (faces > 0 && count > 0 && count <= 100) {
                    for (let i = 0; i < count; i++) {
                        let val = Math.floor(Math.random() * faces) + 1;
                        if (roTargetStr) {
                            const target = parseInt(roTargetStr, 10);
                            const comp = roComp || '<=';
                            let shouldReroll = false;
                            if (comp === '<' && val < target) shouldReroll = true;
                            else if (comp === '<=' && val <= target) shouldReroll = true;
                            else if (comp === '>' && val > target) shouldReroll = true;
                            else if (comp === '>=' && val >= target) shouldReroll = true;
                            else if (comp === '=' && val === target) shouldReroll = true;
                            else if (val === target) shouldReroll = true;
                            if (shouldReroll) val = Math.floor(Math.random() * faces) + 1;
                        }
                        rolled.push(val);
                        if (explode && val === faces) {
                            let currentVal = val;
                            let safety = 50;
                            while (currentVal === faces && safety-- > 0) {
                                currentVal = Math.floor(Math.random() * faces) + 1;
                                rolled.push(currentVal);
                            }
                        }
                    }
                }

                // Keep / drop logic
                let droppedIndices = new Set();
                if (keepDropType) {
                    const kNum = parseInt(keepDropNumStr || '1', 10);
                    const indexed = rolled.map((val, idx) => ({ val, idx }));
                    indexed.sort((a, b) => b.val - a.val);
                    if (kNum > 0) {
                        if (keepDropType === 'kh') {
                            indexed.slice(kNum).forEach(x => droppedIndices.add(x.idx));
                        } else if (keepDropType === 'kl') {
                            indexed.slice(0, -kNum).forEach(x => droppedIndices.add(x.idx));
                        } else if (keepDropType === 'dl') {
                            indexed.slice(-kNum).forEach(x => droppedIndices.add(x.idx));
                        } else if (keepDropType === 'dh') {
                            indexed.slice(0, kNum).forEach(x => droppedIndices.add(x.idx));
                        }
                    }
                }

                rolled.forEach((val, idx) => {
                    const isDropped = droppedIndices.has(idx);
                    diceList.push({ faces, val, isDropped });
                });

                if (faces === 20) {
                    const activeD20s = rolled.filter((_, idx) => !droppedIndices.has(idx));
                    if (activeD20s.includes(20)) {
                        isCritSuccess = true;
                        isCritFail = false;
                    } else if (activeD20s.includes(1) && !isCritSuccess) {
                        isCritFail = true;
                    }
                }

                const subtotal = rolled.reduce((acc, val, idx) => droppedIndices.has(idx) ? acc : acc + val, 0);

                const rollStrings = rolled.map((val, idx) => {
                    if (droppedIndices.has(idx)) return `<s>${val}</s>`;
                    return `${val}`;
                });

                const diceName = token.toLowerCase();
                const diceRollVal = `[${rollStrings.join(', ')}]`;
                let detailedTerm = `${diceName} ${diceRollVal}`;
                if (label) detailedTerm += ` [${label}]`;

                if (op && matchCount > 1) {
                    detailedParts.push(`${op} ${detailedTerm}`);
                    compactParts.push(`${op}[${subtotal}]`);
                    evalExpression += ` ${op} ${subtotal}`;
                } else {
                    detailedParts.push(detailedTerm);
                    compactParts.push(`[${subtotal}]`);
                    evalExpression += `${subtotal}`;
                }
            } else {
                // Flat number
                const numVal = parseFloat(token) || 0;
                let detailedTerm = `${numVal}`;
                if (label) detailedTerm += ` [${label}]`;

                if (op && matchCount > 1) {
                    detailedParts.push(`${op} ${detailedTerm}`);
                    compactParts.push(`${op}${numVal}`);
                    evalExpression += ` ${op} ${numVal}`;
                } else {
                    const sign = (op === '-' ? '-' : '');
                    detailedParts.push(`${sign}${detailedTerm}`);
                    compactParts.push(`${sign}${numVal}`);
                    evalExpression += `${sign}${numVal}`;
                }
            }
        }

        let total = 0;
        try {
            const safeMath = evalExpression.replace(/[^0-9+\-*/().\s]/g, '');
            if (safeMath) {
                total = Math.round(new Function(`"use strict"; return (${safeMath})`)());
            }
        } catch (e) {
            total = 0;
        }

        const breakdownStr = detailedParts.length > 0 ? detailedParts.join(' ') : `<strong>${total}</strong>`;
        const compactBreakdown = compactParts.length > 0 ? compactParts.join('') : `${total}`;

        return {
            total,
            diceList,
            breakdownStr,
            compactBreakdown,
            isCritSuccess,
            isCritFail
        };
    }

    /**
     * Polyfill / compatibility wrapper for window.Renderer.dice.lang.getTree3
     */
    static getTree3(formula) {
        return {
            tree: {
                evl(meta = {}) {
                    const result = VTTDiceParser.roll(formula);
                    meta.diceList = result.diceList;
                    meta.html = [result.breakdownStr];
                    meta.isCritSuccess = result.isCritSuccess;
                    meta.isCritFail = result.isCritFail;
                    return result.total;
                }
            }
        };
    }
}

// Global hook and shim
if (typeof window !== 'undefined') {
    window.VTTDiceParser = VTTDiceParser;
    if (!window.Renderer) window.Renderer = {};
    if (!window.Renderer.dice) window.Renderer.dice = {};
    if (!window.Renderer.dice.lang) {
        window.Renderer.dice.lang = {
            getTree3: (formula) => VTTDiceParser.getTree3(formula)
        };
    }
}
