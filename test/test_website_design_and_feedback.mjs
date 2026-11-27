import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.join(process.cwd(), 'docs');
const PAGES = [
    'index.html',
    'getting-started.html',
    'guide.html',
    'app-guide.html',
    'feedback.html',
    'legal.html',
    'portal-dungeons.html',
    'self-hosted-vtt.html',
    'tv-gaming-table.html'
];

test('Website Design & Feedback Page Verification Suite', async (t) => {
    await t.test('1. Verify all expected website HTML files exist', () => {
        for (const page of PAGES) {
            const filePath = path.join(ROOT_DIR, page);
            assert.ok(fs.existsSync(filePath), `File ${page} must exist`);
            const content = fs.readFileSync(filePath, 'utf8');
            assert.ok(content.length > 200, `File ${page} must not be empty`);
        }
    });

    await t.test('2. Verify header Play Online CTA and release download link on download pages', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            assert.ok(content.includes('href="play/"'), `Page ${page} must link to Play Online`);
        }
        for (const downloadPage of ['index.html', 'getting-started.html']) {
            const content = fs.readFileSync(path.join(ROOT_DIR, downloadPage), 'utf8');
            assert.ok(
                content.includes('1.5.0/ForgeDVTT-Setup-1.5.0.exe'),
                `Page ${downloadPage} must link to working release installer (1.5.0 tag with ForgeDVTT-Setup-1.5.0.exe asset)`
            );
        }
    });

    await t.test('3. Verify header navigation consistency across all pages', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            assert.ok(content.includes('href="index.html"'), `${page} must link to Home`);
            assert.ok(content.includes('href="getting-started.html"'), `${page} must link to Guide (Getting Started)`);
            assert.ok(content.includes('portal-dungeons.html'), `${page} must include Portal Dungeons in navigation`);
            assert.ok(
                content.includes('self-hosted-vtt.html'),
                `${page} must include Self-Hosted & Tunnels in navigation`
            );
            assert.ok(content.includes('tv-gaming-table.html'), `${page} must include TV Gaming Table in navigation`);
            assert.ok(/Features\s*<i/.test(content), `${page} must have Features dropdown toggle in navigation`);
            assert.ok(/>Guide<\/a>/.test(content), `${page} must have simplified Guide navigation label`);
            assert.ok(content.includes('href="prep/"'), `${page} must link to Session Prep in navigation`);
            assert.ok(content.includes('href="feedback.html"'), `${page} must link to Feedback in navigation`);
        }

        for (const guidePage of ['getting-started.html', 'guide.html', 'app-guide.html']) {
            const content = fs.readFileSync(path.join(ROOT_DIR, guidePage), 'utf8');
            assert.ok(content.includes('class="guide-switcher"'), `${guidePage} must render unified guide switcher`);
            assert.ok(content.includes('Getting Started</a>'), `${guidePage} switcher must link to Getting Started`);
            assert.ok(content.includes('Play Guide</a>'), `${guidePage} switcher must link to Play Guide`);
            assert.ok(content.includes('App Guide</a>'), `${guidePage} switcher must link to App Guide`);
        }
    });

    await t.test('4. Verify footer links across all pages', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            assert.ok(content.includes('href="feedback.html"'), `${page} footer must link to feedback.html`);
            assert.ok(content.includes('href="legal.html"'), `${page} footer must link to legal.html`);
        }
    });

    await t.test('5. Verify index.html tabletop showcase & hero copy, and getting-started.html requirements tabs', () => {
        const indexContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        assert.ok(indexContent.includes('showcase-section'), 'index.html must contain tabletop showcase section');
        assert.ok(indexContent.includes('showcase-tab-btn'), 'index.html must contain showcase tab buttons');
        assert.ok(indexContent.includes('showcase-panel'), 'index.html must contain showcase panels');
        assert.ok(indexContent.includes('showcase-mass-combat.jpg'), 'index.html must embed mass combat screenshot');
        assert.ok(indexContent.includes('showcase-spellbook.jpg'), 'index.html must embed spellbook screenshot');
        assert.ok(indexContent.includes('showcase-statblock-saves.jpg'), 'index.html must embed statblock saves screenshot');
        assert.ok(indexContent.includes('guide-callout-dual'), 'index.html must contain dual guide callouts');
        assert.ok(/Game\s+Master\s*\(DM\)/.test(indexContent), 'index.html must connect Game Master and DM');

        const startContent = fs.readFileSync(path.join(ROOT_DIR, 'getting-started.html'), 'utf8');
        assert.ok(startContent.includes('req-tab-nav'), 'getting-started.html must contain requirement tab navigation');
        assert.ok(startContent.includes('req-tab-btn'), 'getting-started.html must contain requirement tab buttons');
        assert.ok(startContent.includes('req-tab-panel'), 'getting-started.html must contain requirement tab panels');
        assert.ok(startContent.includes('req-summary-cards'), 'getting-started.html must contain requirement summary cards');
    });

    await t.test('6. Verify getting-started.html distinct setup checkpoints', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'getting-started.html'), 'utf8');
        assert.ok(
            content.includes('Start your local server'),
            'getting-started.html must have distinct local server step'
        );
        assert.ok(
            content.includes('Start your online player tunnel'),
            'getting-started.html must have distinct online tunnel step'
        );
    });

    await t.test('7. Verify guide.html mobile section documents Add to Home Screen', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'guide.html'), 'utf8');
        assert.ok(content.includes('id="guide-mobile-ui"'), 'guide.html must contain mobile section');
        assert.ok(content.includes('Add to Home Screen'), 'guide.html must document Add to Home Screen');
        assert.ok(content.includes('Install / PWA'), 'guide.html must label PWA installation');
    });

    await t.test('8. Verify feedback.html contains Google Form iframe and direct link', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'feedback.html'), 'utf8');
        assert.ok(
            content.includes('https://forms.gle/CaL1PXZyPmkehx7c7'),
            'feedback.html must contain direct forms.gle link'
        );
        assert.ok(
            content.includes(
                'docs.google.com/forms/d/e/1FAIpQLSdXQSQ10zosM_noJch0sBh0QcVPvY6XEelCbmPAeH12Bunz3g/viewform?embedded=true'
            ),
            'feedback.html must contain embedded form iframe'
        );
    });

    await t.test(
        '9. Verify SmartScreen instructions removed from index.html and present only on getting-started.html',
        () => {
            const indexContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
            assert.ok(
                !indexContent.includes('First time on Windows'),
                'index.html must not contain "First time on Windows"'
            );
            assert.ok(!indexContent.includes('Run anyway'), 'index.html must not contain "Run anyway"');
            assert.ok(!indexContent.includes('More info'), 'index.html must not contain "More info"');

            const gsContent = fs.readFileSync(path.join(ROOT_DIR, 'getting-started.html'), 'utf8');
            assert.ok(
                gsContent.includes('download-smartscreen-card'),
                'getting-started.html must format SmartScreen with card'
            );
            assert.ok(
                gsContent.includes('<kbd>More info</kbd>'),
                'getting-started.html must format More info with kbd'
            );
            assert.ok(
                gsContent.includes('<kbd>Run anyway</kbd>'),
                'getting-started.html must format Run anyway with kbd'
            );
        }
    );

    await t.test('10. Verify no visible mentions of GitHub in page copy', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('href="https://github.com/')) continue;
                assert.ok(
                    !/\bgithub\b/i.test(line),
                    `Page ${page} line ${i + 1} has visible mention of GitHub: "${line.trim()}"`
                );
            }
        }
    });

    await t.test('11. Verify strict branding as ForgeDVTT across all pages', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Allow repository path in release download link, .dndforged-data directory, "Forged Gold" color, or DnDForged repository mention in legal
                if (line.includes('https://github.com/lovemurgod/DnDForged/')) continue;
                if (line.includes('.dndforged-data')) continue;
                if (line.includes('Forged Gold')) continue;
                if (line.includes('(DnDForged)')) continue;
                assert.ok(
                    !/\bForgeD\b/.test(line),
                    `Page ${page} line ${i + 1} must use "ForgeDVTT" or "the VTT" instead of standalone "ForgeD": "${line.trim()}"`
                );
            }
        }
    });

    await t.test('12. Verify back-to-top button on all pages', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            assert.ok(
                content.includes('id="site-back-to-top"') || content.includes('id="guide-back-to-top"'),
                `Page ${page} must contain a back-to-top button element`
            );
            assert.ok(
                content.includes("scrollTo({ top: 0, behavior: 'smooth' })"),
                `Page ${page} must wire smooth scroll handler for back-to-top button`
            );
        }
    });

    await t.test('13. Verify JSON-LD schemas are valid parseable JSON', () => {
        for (const page of PAGES) {
            const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
            const matches = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
            for (let i = 0; i < matches.length; i++) {
                const jsonText = matches[i].replace(/<script type="application\/ld\+json">|<\/script>/g, '').trim();
                assert.doesNotThrow(
                    () => {
                        JSON.parse(jsonText);
                    },
                    `Page ${page} JSON-LD block ${i + 1} must be valid JSON`
                );
            }
        }
    });
});
