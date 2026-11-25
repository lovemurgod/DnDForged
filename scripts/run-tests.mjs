import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const useCoverage = process.argv.includes('--coverage');
const testDir = path.resolve(process.cwd(), 'test');
const testFiles = fs
    .readdirSync(testDir)
    .filter((file) => file.startsWith('test_') && file.endsWith('.mjs'))
    .sort()
    .map((file) => path.join('test', file));

if (testFiles.length === 0) {
    console.error('No test files matching test/test_*.mjs were found.');
    process.exit(1);
}

const nodeArgs = ['--test', '--test-concurrency=4'];
if (useCoverage) {
    nodeArgs.push('--experimental-test-coverage');
}
nodeArgs.push(...testFiles);

const result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
if (result.error) {
    console.error(result.error);
    process.exit(1);
}
process.exit(result.status ?? 1);
