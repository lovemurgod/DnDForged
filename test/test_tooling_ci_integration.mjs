import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();

test('Tooling & CI Suite: jsconfig.json configuration', () => {
    const configPath = path.join(rootDir, 'jsconfig.json');
    assert.ok(fs.existsSync(configPath), 'jsconfig.json must exist in root');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(config.compilerOptions, 'compilerOptions must be defined');
    assert.equal(config.compilerOptions.target, 'ES2022', 'target must be ES2022');
    assert.equal(config.compilerOptions.module, 'NodeNext', 'module must be NodeNext');
    assert.equal(config.compilerOptions.checkJs, false, 'checkJs must be false for pure JS repo');
    assert.ok(Array.isArray(config.compilerOptions.lib), 'lib must be an array');
    assert.ok(config.compilerOptions.lib.includes('DOM'), 'lib must include DOM');
    assert.ok(config.compilerOptions.lib.includes('ES2022'), 'lib must include ES2022');
    assert.ok(Array.isArray(config.include), 'include array must be defined');
    assert.ok(Array.isArray(config.exclude), 'exclude array must be defined');
});

test('Tooling & CI Suite: eslint.config.js configuration', async () => {
    const eslintPath = path.join(rootDir, 'eslint.config.js');
    assert.ok(fs.existsSync(eslintPath), 'eslint.config.js must exist');

    const eslintContent = fs.readFileSync(eslintPath, 'utf8');
    assert.ok(eslintContent.includes('export default'), 'Must export default flat config');
    assert.ok(eslintContent.includes('globals'), 'Must configure globals');
    assert.ok(eslintContent.includes('ecmaVersion'), 'Must set ecmaVersion');
});

test('Tooling & CI Suite: .prettierrc and .prettierignore configuration', () => {
    const prettierrcPath = path.join(rootDir, '.prettierrc');
    const prettierignorePath = path.join(rootDir, '.prettierignore');

    assert.ok(fs.existsSync(prettierrcPath), '.prettierrc must exist');
    assert.ok(fs.existsSync(prettierignorePath), '.prettierignore must exist');

    const prettierConfig = JSON.parse(fs.readFileSync(prettierrcPath, 'utf8'));
    assert.equal(prettierConfig.semi, true, 'semi must be true');
    assert.equal(prettierConfig.singleQuote, true, 'singleQuote must be true');
    assert.equal(prettierConfig.tabWidth, 4, 'tabWidth must be 4');

    const ignoreContent = fs.readFileSync(prettierignorePath, 'utf8');
    assert.ok(ignoreContent.includes('node_modules'), 'must ignore node_modules');
    assert.ok(ignoreContent.includes('dist'), 'must ignore dist');
    assert.ok(ignoreContent.includes('vtt/lib'), 'must ignore vtt/lib');
});

test('Tooling & CI Suite: GitHub Actions CI workflow (.github/workflows/ci.yml)', () => {
    const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
    assert.ok(fs.existsSync(ciPath), '.github/workflows/ci.yml must exist');

    const ciContent = fs.readFileSync(ciPath, 'utf8');
    assert.ok(ciContent.includes('name: CI'), 'Workflow name must be CI');
    assert.ok(ciContent.includes('ubuntu-latest'), 'Matrix must include ubuntu-latest');
    assert.ok(ciContent.includes('windows-latest'), 'Matrix must include windows-latest');
    assert.ok(ciContent.includes('20.x'), 'Matrix must test Node 20.x');
    assert.ok(ciContent.includes('22.x'), 'Matrix must test Node 22.x');
    assert.ok(ciContent.includes('npm run lint'), 'CI must run npm run lint');
    assert.ok(ciContent.includes('npm run typecheck'), 'CI must run npm run typecheck');
    assert.ok(ciContent.includes('npm test'), 'CI must run npm test');
});

test('Tooling & CI Suite: package.json script integrity', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.ok(pkg.scripts.lint, 'package.json must contain lint script');
    assert.ok(pkg.scripts['lint:fix'], 'package.json must contain lint:fix script');
    assert.ok(pkg.scripts.format, 'package.json must contain format script');
    assert.ok(pkg.scripts['format:check'], 'package.json must contain format:check script');
    assert.ok(pkg.scripts.typecheck, 'package.json must contain typecheck script');
    assert.ok(pkg.scripts.test, 'package.json must contain test script');
});

test('Tooling & CI Suite: typecheck CLI execution completes successfully', () => {
    const result = execSync('npm run typecheck', { cwd: rootDir, encoding: 'utf8' });
    assert.ok(!result.includes('error TS'), 'TypeScript check should emit 0 errors');
});
