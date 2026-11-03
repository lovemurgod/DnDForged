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
        process.exit(1);
    }

    const scopeManager = escope.analyze(ast, {
        ecmaVersion: 2022,
        sourceType: 'module'
    });

    for (const scope of scopeManager.scopes) {
        for (const variable of scope.variables) {
            const def = variable.defs[0];
            if (!def || (def.type !== 'Variable' && def.type !== 'ClassName')) continue;
            if (def.node && def.parent && def.parent.kind !== 'const' && def.parent.kind !== 'let') continue;

            const defStart = def.node.range[0];

            for (const ref of variable.references) {
                if (ref.identifier.range[0] < defStart) {
                    let curr = ref.from;
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

console.log(`Checked ${files.length} files across vtt/js and server.`);
if (allIssues.length > 0) {
    console.error(`Found ${allIssues.length} TDZ references:`);
    console.error(JSON.stringify(allIssues, null, 2));
    process.exit(1);
}

console.log('✓ Zero TDZ references detected.');
process.exit(0);

