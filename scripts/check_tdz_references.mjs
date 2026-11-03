import fs from 'fs';
import path from 'path';
import * as espree from 'espree';
import * as escope from 'eslint-scope';

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

const files = [...getFiles('vtt/js'), ...getFiles('server')];
let allIssues = [];

for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try {
        ast = espree.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            loc: true,
            range: true
        });
    } catch (e) {
        console.error('Parse error in', file, e.message);
        continue;
    }

    const scopeManager = escope.analyze(ast, {
        ecmaVersion: 2022,
        sourceType: 'module'
    });

    for (const scope of scopeManager.scopes) {
        for (const variable of scope.variables) {
            // We only care about const and let (and class) declarations because var and function are hoisted
            const def = variable.defs[0];
            if (!def || (def.type !== 'Variable' && def.type !== 'ClassName')) continue;
            if (def.node && def.parent && def.parent.kind !== 'const' && def.parent.kind !== 'let') continue;

            const defStart = def.node.range[0];

            for (const ref of variable.references) {
                // If reference appears BEFORE defStart in code position
                if (ref.identifier.range[0] < defStart) {
                    // Check if reference is inside a function body that could be called later,
                    // OR if it's evaluated immediately in an object literal, expression statement, etc.
                    let curr = ref.from;
                    // If the reference scope is the exact same scope as the variable declaration
                    // (e.g. inside the function body, at top-level of that function)
                    if (curr === scope) {
                        allIssues.push({
                            file,
                            name: variable.name,
                            refLoc: ref.identifier.loc.start,
                            defLoc: def.node.loc.start,
                            kind: def.parent?.kind || 'const/let'
                        });
                    }
                }
            }
        }
    }
}

console.log('Checked', files.length, 'files in vtt/js.');
console.log('Found TDZ references at immediate scope level:', allIssues.length);
console.log(JSON.stringify(allIssues, null, 2));
