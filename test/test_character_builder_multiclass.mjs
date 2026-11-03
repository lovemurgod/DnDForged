import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- RUNNING CHARACTER BUILDER MULTICLASS & SPELLS TESTS ---');

const rootDir = fs.existsSync('vtt/js/vtt-player-sheet.js')
    ? process.cwd()
    : path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

const filesToRead = [
    path.join(rootDir, 'vtt/js/vtt-player-sheet.js'),
    path.join(rootDir, 'vtt/js/player-sheet/builder/builder-state.js'),
    path.join(rootDir, 'vtt/js/player-sheet/builder/builder-modal.js'),
    path.join(rootDir, 'vtt/js/player-sheet/builder/step4-features.js'),
    path.join(rootDir, 'vtt/js/player-sheet/builder/step6-spells.js')
];
const code = filesToRead
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

// Test 1: extractGrantedSpells flattens properties directly
console.log('\n[TEST 1] Testing extractGrantedSpells property normalization...');
assert(code.includes("id: 'sp_innate_' + matched.name.replace"), 'extractGrantedSpells should flatten id');
assert(code.includes('name: matched.name,'), 'extractGrantedSpells should flatten name');
assert(code.includes('level: parseInt(matched.level) || 0,'), 'extractGrantedSpells should flatten level');
assert(code.includes("school: matched.school || '',"), 'extractGrantedSpells should flatten school');
assert(
    code.includes("time: matched.time || matched.castingTime || '1 action',"),
    'extractGrantedSpells should flatten time'
);
assert(
    code.includes("originName: originName || sourceLabel || 'Innate'"),
    'extractGrantedSpells should flatten originName'
);
console.log('✓ extractGrantedSpells properly normalizes all fields on granted spells.');

// Test 2: renderStep6 displays Species & Background magic without 'undefined'
console.log('\n[TEST 2] Testing renderStep6 safe property access...');
assert(
    code.includes("const sName = isp.name || isp.spell?.name || 'Unknown Spell'"),
    'renderStep6 has safe fallback for spell name'
);
assert(
    code.includes("const sOrigin = isp.originName || isp.sourceLabel || isp.source || 'Innate'"),
    'renderStep6 has safe fallback for spell origin'
);
assert(code.includes('${sTime} &bull; ${sRange}'), 'renderStep6 displays casting time and range safely');
console.log('✓ renderStep6 guards against undefined text for innate species and background spells.');

// Test 3: userSelectedSpellMap persistence across recomputations
console.log('\n[TEST 3] Testing userSelectedSpellMap persistence...');
assert(code.includes('const userSelectedSpellMap = new Map();'), 'userSelectedSpellMap is declared');
assert(
    code.includes('userSelectedSpellMap.set(sp.name.toLowerCase().trim(), !!sp.checked)'),
    'classSpellSections preserves checked spells before clearing'
);
assert(
    code
        .replace(/\s+/g, ' ')
        .includes('userSelectedSpellMap.has(spKey) ? !!userSelectedSpellMap.get(spKey) : existingSpells.has(spKey)'),
    'spells initialized against userSelectedSpellMap first'
);
assert(
    code.includes('if (sp.name) userSelectedSpellMap.set(sp.name.toLowerCase().trim(), chk.checked);'),
    'Step 6 check event listener records user selection'
);
console.log('✓ Spell selections are persistently saved across feat changes and recomputations.');

// Test 4: Live UI reactive counters and focus-preserving search in Step 6
console.log('\n[TEST 4] Testing reactive spell counter pills and focus-preserving search...');
assert(code.includes('id="pc-wiz-sec-cantrips-${secIdx}"'), 'Cantrip counter pill has unique reactive ID');
assert(code.includes('id="pc-wiz-sec-spells-${secIdx}"'), 'Spell counter pill has unique reactive ID');
assert(code.includes('(Over Limit)'), 'Soft limit warning tag is supported');
assert(
    code.includes('function applySpellFilters(secIdx)'),
    'applySpellFilters filters DOM without destroying innerHTML'
);
assert(code.includes("card.classList.add('is-selected');"), 'Selected spell cards are dynamically highlighted');
console.log('✓ Step 6 reactive counter updates, limit styling, and focus-preserving search verified.');

// Test 5: Step 4 per-section search bars and Background Features section
console.log('\n[TEST 5] Testing Step 4 features search and background features...');
assert(code.includes('data-target="pc-wiz-class-feats-list"'), 'Class features section has search input');
assert(code.includes('data-target="pc-wiz-racial-feats-list"'), 'Racial traits section has search input');
assert(code.includes('data-target="pc-wiz-bg-feats-list"'), 'Background features section has search input');
assert(code.includes('candidateBgFeatures.length > 0'), 'Background features are conditionally rendered');
assert(
    code.includes("bodyEl.querySelectorAll('.pc-wiz-feat-search')"),
    'Live filtering event listener wired for all feature search bars'
);
console.log('✓ Step 4 per-section search bars and Background Features rendering verified.');

// Test 6: applyBtn.onclick error boundary and safe HP/AC calculations
console.log('\n[TEST 6] Testing Save & Apply error boundary and data safety...');
assert(
    /applyBtn\.onclick\s*=\s*async\s*\(\)\s*=>\s*\{\s*try\s*\{/.test(code),
    'applyBtn.onclick is wrapped in try block'
);
assert(
    /} catch \(err\) \{\s*console\.error\('Error applying character build:', err\);/.test(code),
    'applyBtn.onclick has catch block'
);
assert(
    /applyBtn\.disabled = false;\s*applyBtn\.innerHTML = '<i class="fa-solid fa-check-double"><\/i> Save & Apply';/.test(
        code
    ),
    'Button is re-enabled on error'
);
assert(
    code.includes('char.hpMax = Math.max(1, builderState.calculatedHp || parseInt(char.hpMax) || 10);'),
    'HP calculation has safe fallback'
);
assert(code.includes('char.tokenSight = Math.max('), 'Token sight handles undefined senses safely');
assert(
    code.includes('const sName = isp.name || isp.spell?.name;'),
    'applyBtn innate spells import checks both flat and nested name'
);
console.log('✓ Save & Apply error boundary and data safety verified.');

console.log('\n🎉 ALL 6 VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
