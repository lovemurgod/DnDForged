import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function getFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            results = results.concat(getFiles(full));
        } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
            results.push(full);
        }
    }
    return results;
}

function resolveFile(filePath) {
    if (fs.existsSync(filePath)) {
        if (fs.statSync(filePath).isDirectory()) {
            const index = path.join(filePath, 'index.js');
            if (fs.existsSync(index)) return index;
        }
        return filePath;
    }
    if (fs.existsSync(filePath + '.js')) return filePath + '.js';
    return null;
}

function getExports(file, visited = new Set()) {
    if (visited.has(file)) return new Set();
    visited.add(file);
    const exports = new Set();
    if (!fs.existsSync(file)) return exports;

    const content = fs.readFileSync(file, 'utf8');

    const declRegex = /export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([a-zA-Z0-9_$]+)/g;
    let m;
    while ((m = declRegex.exec(content)) !== null) {
        exports.add(m[1]);
    }

    const blockRegex = /export\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
    while ((m = blockRegex.exec(content)) !== null) {
        const inside = m[1];
        const fromFile = m[2];
        if (fromFile) {
            const resolved = resolveFile(path.resolve(path.dirname(file), fromFile));
            if (resolved) {
                const childExports = getExports(resolved, visited);
                const items = inside
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                for (const item of items) {
                    const parts = item.split(/\s+as\s+/);
                    const original = parts[0].trim();
                    const alias = (parts[1] || parts[0]).trim();
                    if (childExports.has(original)) {
                        exports.add(alias);
                    }
                }
            }
        } else {
            const items = inside
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            for (const item of items) {
                const parts = item.split(/\s+as\s+/);
                const alias = (parts[1] || parts[0]).trim();
                exports.add(alias);
            }
        }
    }

    const starRegex = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
    while ((m = starRegex.exec(content)) !== null) {
        const resolved = resolveFile(path.resolve(path.dirname(file), m[1]));
        if (resolved) {
            const childExports = getExports(resolved, visited);
            for (const exp of childExports) {
                exports.add(exp);
            }
        }
    }

    return exports;
}

function validateImportsInDirectory(dir) {
    const files = getFiles(dir);
    const errors = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const importRegex = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const namedImports = match[1];
            const importPath = match[2];
            if (!importPath.startsWith('.')) continue;

            const resolved = resolveFile(path.resolve(path.dirname(file), importPath));
            if (!resolved) {
                errors.push({ file, importPath, error: 'Target file does not exist' });
                continue;
            }

            const fileExports = getExports(resolved);
            const names = namedImports
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean)
                .map((n) => {
                    const parts = n.split(/\s+as\s+/);
                    return parts[0].trim();
                });

            for (const name of names) {
                if (!fileExports.has(name)) {
                    errors.push({ file, importPath, resolvedTarget: resolved, missingExport: name });
                }
            }
        }
    }
    return errors;
}

describe('ES Module Export Integrity', () => {
    it('should verify all named imports across vtt/js resolve to valid exported identifiers', () => {
        const errors = validateImportsInDirectory('vtt/js');
        assert.deepEqual(errors, [], `Missing exports found in vtt/js: ${JSON.stringify(errors, null, 2)}`);
    });

    it('should verify all named imports across server/ resolve to valid exported identifiers', () => {
        const errors = validateImportsInDirectory('server');
        assert.deepEqual(errors, [], `Missing exports found in server: ${JSON.stringify(errors, null, 2)}`);
    });
});
