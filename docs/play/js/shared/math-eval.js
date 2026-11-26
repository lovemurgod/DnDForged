/**
 * Safe recursive-descent arithmetic expression evaluator.
 * Supports +, -, *, /, unary +/-, parentheses, and ceil/floor/round (with optional Math. prefix).
 * Never uses eval() or new Function().
 */

/**
 * Tokenizes an arithmetic expression string.
 * @param {string} expr
 * @returns {Array<{type: string, value: string|number}>|null}
 */
function tokenizeMath(expr) {
    const tokens = [];
    let i = 0;
    const len = expr.length;
    while (i < len) {
        const ch = expr[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if ((ch >= '0' && ch <= '9') || ch === '.') {
            let numStr = '';
            let dotCount = 0;
            while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
                if (expr[i] === '.') dotCount++;
                if (dotCount > 1) return null;
                numStr += expr[i++];
            }
            const val = Number(numStr);
            if (!Number.isFinite(val)) return null;
            tokens.push({ type: 'num', value: val });
            continue;
        }
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
            let ident = '';
            while (i < len && /[a-zA-Z.]/.test(expr[i])) {
                ident += expr[i++];
            }
            const norm = ident.replace(/^Math\./, '').toLowerCase();
            if (norm !== 'ceil' && norm !== 'floor' && norm !== 'round') {
                return null;
            }
            tokens.push({ type: 'fn', value: norm });
            continue;
        }
        if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
        }
        return null;
    }
    return tokens;
}

/**
 * Evaluates a safe arithmetic expression without eval/Function.
 * @param {string} expr
 * @returns {number} Evaluated finite number, or NaN if invalid.
 */
export function evaluateSafeMath(expr) {
    if (typeof expr !== 'string') return NaN;
    const trimmed = expr.trim();
    if (!trimmed || trimmed.length > 1024) return NaN;

    const tokens = tokenizeMath(trimmed);
    if (!tokens || tokens.length === 0) return NaN;

    let pos = 0;
    let depth = 0;
    const MAX_DEPTH = 64;
    const peek = () => tokens[pos] || null;
    const consume = () => tokens[pos++] || null;

    function parseExpr() {
        if (++depth > MAX_DEPTH) {
            depth--;
            return NaN;
        }
        try {
            let left = parseTerm();
            if (Number.isNaN(left)) return NaN;
            while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
                const op = consume().value;
                const right = parseTerm();
                if (Number.isNaN(right)) return NaN;
                left = op === '+' ? left + right : left - right;
            }
            return left;
        } finally {
            depth--;
        }
    }

    function parseTerm() {
        let left = parseUnary();
        if (Number.isNaN(left)) return NaN;
        while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
            const op = consume().value;
            const right = parseUnary();
            if (Number.isNaN(right)) return NaN;
            if (op === '/') {
                if (right === 0) return NaN;
                left = left / right;
            } else {
                left = left * right;
            }
        }
        return left;
    }

    function parseUnary() {
        if (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
            const op = consume().value;
            const val = parseUnary();
            return op === '-' ? -val : val;
        }
        return parsePrimary();
    }

    function parsePrimary() {
        const tok = peek();
        if (!tok) return NaN;
        if (tok.type === 'num') {
            consume();
            return tok.value;
        }
        if (tok.type === 'fn') {
            const fnName = consume().value;
            if (peek()?.type !== 'op' || peek().value !== '(') return NaN;
            consume();
            const arg = parseExpr();
            if (Number.isNaN(arg) || peek()?.type !== 'op' || peek().value !== ')') return NaN;
            consume();
            if (fnName === 'ceil') return Math.ceil(arg);
            if (fnName === 'floor') return Math.floor(arg);
            if (fnName === 'round') return Math.round(arg);
            return NaN;
        }
        if (tok.type === 'op' && tok.value === '(') {
            consume();
            const val = parseExpr();
            if (Number.isNaN(val) || peek()?.type !== 'op' || peek().value !== ')') return NaN;
            consume();
            return val;
        }
        return NaN;
    }

    const result = parseExpr();
    if (pos !== tokens.length || !Number.isFinite(result)) return NaN;
    return result;
}
