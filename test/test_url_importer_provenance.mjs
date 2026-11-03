import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { SourceManager } from '../electron/source-manager.js';

console.log('--- RUNNING URL IMPORTER PROVENANCE & LICENSING TESTS ---');

// Helper to start a temporary local HTTP server for testing URL import
function createTestServer(routes = {}) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const handler = routes[req.url];
            if (handler) {
                handler(req, res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        });
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${port}`,
                close: () => new Promise((cb) => server.close(cb))
            });
        });
    });
}

async function runTests() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dndforged-test-provenance-'));
    const testConfigPath = path.join(tmpDir, 'sources-config.json');

    // Sample payload without license (e.g. typical 5eTools raw JSON)
    const jsonWithoutLicense = {
        _meta: {
            sources: [
                {
                    json: 'TESTBREW',
                    abbreviation: 'TESTBREW',
                    full: 'Community Beast Pack',
                    authors: ['BrewMaster']
                }
            ]
        },
        monster: [
            {
                name: 'Gilded Griffin',
                source: 'TESTBREW',
                cr: '4'
            }
        ]
    };

    // Sample payload with explicit embedded license & attribution
    const jsonWithLicense = {
        _meta: {
            sources: [
                {
                    json: 'OPENSRD',
                    abbreviation: 'OPENSRD',
                    full: 'Open SRD Monsters',
                    authors: ['Open Author'],
                    license: 'CC-BY-4.0',
                    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
                    attribution: 'Open SRD Monsters © 2024 by Open Author is licensed under CC BY 4.0'
                }
            ]
        },
        monster: [
            {
                name: 'Solar Hawk',
                source: 'OPENSRD',
                cr: '2'
            }
        ]
    };

    const serverObj = await createTestServer({
        '/unlicensed.json': (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jsonWithoutLicense));
        },
        '/licensed.json': (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jsonWithLicense));
        }
    });

    try {
        const sm = new SourceManager({ campaignDataDir: tmpDir, rootDir: tmpDir });

        // =========================================================================
        // TEST 1: URL Import with Unspecified License (No inference from GitHub/5eTools)
        // =========================================================================
        console.log('\n[Test 1] Importing from URL without explicit license declaration...');
        const unlicensedUrl = `${serverObj.baseUrl}/unlicensed.json`;
        const res1 = await sm.importFromUrl(unlicensedUrl);

        assert.strictEqual(res1.success, true, 'Import should succeed');
        assert.strictEqual(res1.importedCount, 1, 'Should import 1 file');
        assert.strictEqual(res1.provenance.sourceUrl, unlicensedUrl, 'Preserves original URL');
        assert.ok(res1.provenance.importedAt, 'Preserves import timestamp');
        assert.strictEqual(
            res1.provenance.license,
            'Not specified',
            'Must record as "Not specified" and not infer license from 5eTools format or GitHub'
        );
        assert.strictEqual(res1.provenance.attribution, '', 'Must not invent attribution text');

        // Verify config persistence
        const configItem1 = sm.config.customSources.find((s) => s.code === 'TESTBREW');
        assert.ok(configItem1, 'Entry must be in customSources config');
        assert.strictEqual(configItem1.sourceUrl, unlicensedUrl);
        assert.strictEqual(configItem1.license, 'Not specified');

        // Verify dual persistence on disk (_meta.provenance and _meta.sources[0])
        const savedFile1 = configItem1.filePath;
        assert.ok(fs.existsSync(savedFile1), 'File must exist on disk: ' + savedFile1);
        const fileContent1 = JSON.parse(fs.readFileSync(savedFile1, 'utf8'));
        assert.ok(fileContent1._meta?.provenance, '_meta.provenance must exist');
        assert.strictEqual(fileContent1._meta.provenance.sourceUrl, unlicensedUrl);
        assert.strictEqual(fileContent1._meta.provenance.license, 'Not specified');
        assert.strictEqual(fileContent1._meta.sources[0].license, 'Not specified');
        console.log('  ✓ Unspecified license correctly defaulted to "Not specified" in both config and file disk');

        // =========================================================================
        // TEST 2: URL Import with Embedded License & Optional User Overrides
        // =========================================================================
        console.log('\n[Test 2] Importing from URL with embedded licensing metadata...');
        const licensedUrl = `${serverObj.baseUrl}/licensed.json`;
        const res2 = await sm.importFromUrl(licensedUrl);

        assert.strictEqual(res2.success, true, 'Import should succeed');
        assert.strictEqual(res2.provenance.license, 'CC-BY-4.0', 'Auto-detects embedded license');
        assert.strictEqual(res2.provenance.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
        assert.ok(res2.provenance.attribution.includes('CC BY 4.0'), 'Auto-detects embedded attribution');

        // Verify file disk dual persistence for licensed content
        const configItem2 = sm.config.customSources.find((s) => s.code === 'OPENSRD');
        assert.ok(configItem2, 'Entry must be in customSources config');
        const savedFile2 = configItem2.filePath;
        assert.ok(fs.existsSync(savedFile2), 'File must exist on disk');
        const fileContent2 = JSON.parse(fs.readFileSync(savedFile2, 'utf8'));
        assert.strictEqual(fileContent2._meta.provenance.license, 'CC-BY-4.0');
        assert.strictEqual(fileContent2._meta.provenance.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
        console.log('  ✓ Embedded licensing metadata preserved accurately without distortion');

        // =========================================================================
        // TEST 3: User Override / Entry of License Details at Import Time
        // =========================================================================
        console.log('\n[Test 3] Importing from URL with explicit user metadata inputs...');
        const res3 = await sm.importFromUrl(unlicensedUrl, {
            sourceName: 'My Verified Beasts',
            license: 'OGL-1.0a',
            licenseUrl: 'https://wizards.com/ogl',
            attribution: 'Content used under Open Game License 1.0a'
        });
        assert.strictEqual(res3.success, true);
        assert.strictEqual(res3.provenance.sourceName, 'My Verified Beasts');
        assert.strictEqual(res3.provenance.license, 'OGL-1.0a');
        assert.strictEqual(res3.provenance.attribution, 'Content used under Open Game License 1.0a');
        console.log('  ✓ User optional licensing details recorded at import time');

        // =========================================================================
        // TEST 4: getSourceDetails Returns Provenance & License Fields
        // =========================================================================
        console.log('\n[Test 4] Querying getSourceDetails for imported custom source...');
        const detailsRes = sm.getSourceDetails('bestiary', 'TESTBREW');
        assert.strictEqual(detailsRes.success, true);
        assert.strictEqual(detailsRes.source.code, 'TESTBREW');
        assert.strictEqual(detailsRes.source.sourceUrl, unlicensedUrl);
        assert.ok(detailsRes.source.importedAt);
        assert.strictEqual(detailsRes.source.license, 'OGL-1.0a');
        assert.strictEqual(detailsRes.source.licenseUrl, 'https://wizards.com/ogl');
        console.log('  ✓ getSourceDetails surfaces all provenance and licensing fields');

        // =========================================================================
        // TEST 5: saveSourceDetails Updates License & Attribution Durably
        // =========================================================================
        console.log('\n[Test 5] Updating source licensing details via saveSourceDetails...');
        const updateRes = sm.saveSourceDetails({
            category: 'bestiary',
            code: 'TESTBREW',
            name: 'Updated Beasts Edition',
            author: 'Master Jane',
            version: '2.0.0',
            description: 'Updated with corrected license.',
            license: 'CC-BY-SA-4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            attribution: 'Attribution to Jane 2026',
            rawJson: JSON.stringify(fileContent1, null, 2)
        });
        assert.strictEqual(updateRes.success, true);

        // Verify config updated
        const updatedConfig = sm.config.customSources.find((s) => s.code === 'TESTBREW');
        assert.strictEqual(updatedConfig.license, 'CC-BY-SA-4.0');
        assert.strictEqual(updatedConfig.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
        assert.strictEqual(updatedConfig.attribution, 'Attribution to Jane 2026');

        // Verify file disk updated
        const updatedFile = JSON.parse(fs.readFileSync(savedFile1, 'utf8'));
        assert.strictEqual(updatedFile._meta.provenance.license, 'CC-BY-SA-4.0');
        assert.strictEqual(updatedFile._meta.sources[0].license, 'CC-BY-SA-4.0');
        assert.strictEqual(updatedFile._meta.sources[0].attribution, 'Attribution to Jane 2026');
        console.log('  ✓ saveSourceDetails successfully synchronizes edits to both config and file disk');

        // =========================================================================
        // TEST 6: Backward Compatibility (Sources lacking license fields)
        // =========================================================================
        console.log('\n[Test 6] Backward compatibility with existing legacy sources without license fields...');
        const legacyFile = path.join(tmpDir, 'sources', 'bestiary', 'legacy.json');
        fs.writeFileSync(
            legacyFile,
            JSON.stringify({
                _meta: { sources: [{ json: 'LEGACY', full: 'Legacy Source' }] },
                monster: [{ name: 'Old Monster', source: 'LEGACY' }]
            }),
            'utf8'
        );

        const allSources = sm.getAllSources();
        const bestiaryCategory = allSources.categories.find((c) => c.id === 'bestiary');
        const legacySrc = bestiaryCategory.sources.find((s) => s.code === 'LEGACY');
        assert.ok(legacySrc, 'Legacy source must be loaded');
        assert.strictEqual(legacySrc.license, 'Not specified', 'Defaults missing license to "Not specified"');
        assert.strictEqual(legacySrc.sourceUrl, null, 'Non-URL sources have null sourceUrl');
        console.log('  ✓ Legacy source without license fields safely defaults without crashing');

        console.log('\n=============================================================');
        console.log('🎉 ALL URL IMPORTER PROVENANCE & LICENSING TESTS PASSED!');
        console.log('=============================================================');
    } finally {
        await serverObj.close();
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    }
}

runTests().catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
