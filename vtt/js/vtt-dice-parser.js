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
            return { total: 0, diceList: [], breakdownStr: '0', isCritSuccess: false, isCritFail: false };
        }

        const cleanFormula = formula.replace(/\[.*?\]/g, '').trim().toLowerCase();
        const diceList = [];
        const breakdownParts = [];
        let isCritSuccess = false;
        let isCritFail = false;

        // Tokenize into dice expressions and operators
        // Match expressions like: 2d20kh1, 4d6dl1, 1d20!, 1d10ro<2, 2d6, 5
        const parsedStr = cleanFormula.replace(/(\d*)d(\d+)(?:(kh|kl|dl|dh)(\d*))?(?:ro(<|<=|>|>=)?(\d+))?(!)?/gi, 
            (match, countStr, facesStr, keepDropType, keepDropNumStr, roComp, roTargetStr, explode) => {
                const count = parseInt(countStr || '1', 10);
                const faces = parseInt(facesStr, 10);
                if (faces <= 0 || count <= 0 || count > 100) return '0';

                const rolled = [];
                for (let i = 0; i < count; i++) {
                    let val = Math.floor(Math.random() * faces) + 1;
                    
                    // Reroll logic
                    if (roTargetStr) {
                        const target = parseInt(roTargetStr, 10);
                        const comp = roComp || '<=';
                        let shouldReroll = false;
                        if (comp === '<' && val < target) shouldReroll = true;
                        else if (comp === '<=' && val <= target) shouldReroll = true;
                        else if (comp === '>' && val > target) shouldReroll = true;
                        else if (comp === '>=' && val >= target) shouldReroll = true;
                        else if (val === target) shouldReroll = true;

                        if (shouldReroll) {
                            val = Math.floor(Math.random() * faces) + 1;
                        }
                    }

                    // Exploding dice
                    rolled.push(val);
                    if (explode && val === faces) {
                        let extra = Math.floor(Math.random() * faces) + 1;
                        rolled.push(extra);
                        if (extra === faces) {
                            rolled.push(Math.floor(Math.random() * faces) + 1);
                        }
                    }
                }

                // Keep / drop logic
                let kept = [...rolled];
                let droppedIndices = new Set();

                if (keepDropType) {
                    const kNum = parseInt(keepDropNumStr || '1', 10);
                    const indexed = rolled.map((val, idx) => ({ val, idx }));
                    indexed.sort((a, b) => b.val - a.val); // descending

                    if (keepDropType === 'kh') {
                        const keepSet = new Set(indexed.slice(0, kNum).map(x => x.idx));
                        indexed.slice(kNum).forEach(x => droppedIndices.add(x.idx));
                    } else if (keepDropType === 'kl') {
                        const keepSet = new Set(indexed.slice(-kNum).map(x => x.idx));
                        indexed.slice(0, -kNum).forEach(x => droppedIndices.add(x.idx));
                    } else if (keepDropType === 'dl') {
                        indexed.slice(-kNum).forEach(x => droppedIndices.add(x.idx));
                    } else if (keepDropType === 'dh') {
                        indexed.slice(0, kNum).forEach(x => droppedIndices.add(x.idx));
                    }
                }

                // Add to diceList for 3D simulation
                rolled.forEach((val, idx) => {
                    const isDropped = droppedIndices.has(idx);
                    diceList.push({ faces, val, isDropped });
                });

                // Detect crits on d20
                if (faces === 20) {
                    const activeD20s = rolled.filter((_, idx) => !droppedIndices.has(idx));
                    if (activeD20s.includes(20)) isCritSuccess = true;
                    if (activeD20s.includes(1) && !activeD20s.includes(20)) isCritFail = true;
                }

                const subtotal = rolled.reduce((acc, val, idx) => droppedIndices.has(idx) ? acc : acc + val, 0);
                
                // Formatted breakdown string
                const rollStrings = rolled.map((val, idx) => {
                    if (droppedIndices.has(idx)) return `<s>${val}</s>`;
                    return `${val}`;
                });
                breakdownParts.push(`[${rollStrings.join(', ')}]`);

                return subtotal.toString();
            }
        );

        // Safely evaluate remaining math expression (e.g. "15 + 4 - 2")
        let total = 0;
        try {
            // Sanitize: only allow numbers, +, -, *, /, (, ), and whitespace
            const safeMath = parsedStr.replace(/[^0-9+\-*/().\s]/g, '');
            if (safeMath) {
                // Function-based arithmetic evaluator (safe without eval access to variables)
                total = Math.round(new Function(`"use strict"; return (${safeMath})`)());
            }
        } catch (e) {
            total = 0;
        }

        const breakdownStr = breakdownParts.length > 0 
            ? `${breakdownParts.join(' + ')}${cleanFormula.includes('+') || cleanFormula.includes('-') ? ` = <strong>${total}</strong>` : ''}`
            : `<strong>${total}</strong>`;

        return {
            total,
            diceList,
            breakdownStr,
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
