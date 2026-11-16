import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { parseMediaUrl, sanitizeHtmlContent } from '../vtt/js/vtt-handouts.js';

// Setup DOMPurify on globalThis for node environment
const dom = new JSDOM('');
globalThis.DOMPurify = createDOMPurify(dom.window);

test('Handouts Lifecycle Suite', async (t) => {
    await t.test('Subtest 1: Media URL Parser matrix', () => {
        // 1. YouTube standard URL
        const yt1 = parseMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        assert.ok(yt1.includes('iframe'), 'Should generate iframe for youtube.com');
        assert.ok(yt1.includes('embed/dQw4w9WgXcQ'), 'Should extract YouTube video ID');

        // 2. YouTube short youtu.be URL
        const yt2 = parseMediaUrl('https://youtu.be/dQw4w9WgXcQ');
        assert.ok(yt2.includes('iframe'), 'Should generate iframe for youtu.be');
        assert.ok(yt2.includes('embed/dQw4w9WgXcQ'), 'Should extract YouTube short video ID');

        // 3. Vimeo URL
        const vm = parseMediaUrl('https://vimeo.com/123456789');
        assert.ok(vm.includes('iframe'), 'Should generate iframe for Vimeo');
        assert.ok(vm.includes('player.vimeo.com/video/123456789'), 'Should extract Vimeo video ID');

        // 4. Direct video files (.mp4, .webm, .ogg)
        const vidMp4 = parseMediaUrl('https://example.com/cutscenes/intro.mp4');
        assert.ok(
            vidMp4.startsWith('<video src="https://example.com/cutscenes/intro.mp4" controls'),
            'Should generate <video> tag'
        );

        const vidWebm = parseMediaUrl('https://example.com/cutscenes/loop.webm');
        assert.ok(
            vidWebm.startsWith('<video src="https://example.com/cutscenes/loop.webm" controls'),
            'Should generate <video> tag'
        );

        // 5. Image URLs (fallback)
        const imgJpg = parseMediaUrl('https://example.com/maps/phandalin.jpg');
        assert.ok(imgJpg.startsWith('<img src="https://example.com/maps/phandalin.jpg"'), 'Should generate <img> tag');

        const imgPng = parseMediaUrl('img/tokens/goblin.png');
        assert.ok(imgPng.startsWith('<img src="img/tokens/goblin.png"'), 'Should generate <img> tag');

        // 6. Empty / null URL
        assert.equal(parseMediaUrl(''), '', 'Empty string should return empty string');
        assert.equal(parseMediaUrl(null), '', 'Null should return empty string');
    });

    await t.test('Subtest 2: HTML sanitization & markup preservation', () => {
        // Safe markup
        const safeHtml = '<h4>Goblin Ambush</h4><p>Four goblins hide in the woods.</p>';
        const sanitizedSafe = sanitizeHtmlContent(safeHtml);
        assert.ok(sanitizedSafe.includes('<h4>Goblin Ambush</h4>'));
        assert.ok(sanitizedSafe.includes('<p>Four goblins hide in the woods.</p>'));

        // Script injection neutralizing
        const xss = '<script>alert("xss")</script><p>Normal text</p>';
        const sanitizedXss = sanitizeHtmlContent(xss);
        assert.ok(!sanitizedXss.includes('<script>alert'), 'Script tags must be sanitized or escaped');

        // Empty input
        assert.equal(sanitizeHtmlContent(''), '');
        assert.equal(sanitizeHtmlContent(null), '');
    });

    await t.test('Subtest 3: Source Catalog indexing & filtering', () => {
        const catPath = path.resolve('vtt/data/handouts-catalog.json');
        assert.ok(fs.existsSync(catPath), 'handouts-catalog.json must exist');

        const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
        assert.ok(Array.isArray(catalog), 'Catalog must be an array');
        assert.ok(catalog.length > 50, 'Catalog should contain 50+ source modules');

        const adventures = catalog.filter((m) => m.type === 'adventure');
        const books = catalog.filter((m) => m.type === 'book');
        assert.ok(adventures.length > 0, 'Catalog must contain adventure modules');
        assert.ok(books.length > 0, 'Catalog must contain sourcebook modules');

        // Search filtering test
        const lmop = catalog.find((m) => m.id === 'LMoP' || m.source === 'LMoP');
        assert.ok(lmop, 'LMoP should be present in catalog');
        assert.equal(lmop.name, 'Lost Mine of Phandelver');
        assert.ok(lmop.handoutCount > 100, 'LMoP should have >100 handouts');

        const cos = catalog.find((m) => m.id === 'CoS' || m.source === 'CoS');
        assert.ok(cos, 'Curse of Strahd should be present in catalog');

        const phb = catalog.find((m) => m.id === 'PHB' || m.source === 'PHB');
        assert.ok(phb, "Player's Handbook should be present in catalog");
    });

    await t.test('Subtest 4: Normalized module dataset integrity (LMoP, CoS, PHB)', () => {
        const checkModule = (code) => {
            const modPath = path.resolve(`vtt/data/handouts-normalized/handouts-${code.toLowerCase()}.json`);
            assert.ok(fs.existsSync(modPath), `Module file handouts-${code.toLowerCase()}.json must exist`);
            const items = JSON.parse(fs.readFileSync(modPath, 'utf8'));
            assert.ok(Array.isArray(items), `${code} must be an array of items`);
            assert.ok(items.length > 0, `${code} must have items`);

            // Verify structure of first item
            const first = items[0];
            assert.ok(first.id, `${code} item must have an id`);
            assert.ok(first.title, `${code} item must have a title`);
            assert.ok(first.type, `${code} item must have a type`);
            assert.ok(first.folder, `${code} item must have a folder`);
            return items.length;
        };

        const lmopCount = checkModule('LMoP');
        const cosCount = checkModule('CoS');
        const phbCount = checkModule('PHB');

        assert.ok(lmopCount >= 100, 'LMoP should have at least 100 entries');
        assert.ok(cosCount >= 50, 'CoS should have at least 50 entries');
        assert.ok(phbCount >= 50, 'PHB should have at least 50 entries');
    });

    await t.test('Subtest 5: Batch module import transformation & folder tree grouping', () => {
        // Simulate extracting items and formatting into campaign state
        const rawItems = [
            {
                id: 'ho_lmop_sty_0',
                title: 'Introduction',
                type: 'story',
                html: '<p>Intro text</p>',
                folder: 'Lost Mine of Phandelver',
                subfolder: 'Overview'
            },
            {
                id: 'ho_lmop_ins_1',
                title: 'Goblin Arrows',
                type: 'inset',
                html: '<p>Read aloud text</p>',
                folder: 'Lost Mine of Phandelver',
                subfolder: 'Chapter 1'
            }
        ];

        const campaignHandouts = [];
        const collapsedFolders = new Set(['Old Folder']);

        rawItems.forEach((it) => {
            campaignHandouts.push({
                id: 'ho_test_' + it.id,
                title: it.title,
                desc: '',
                html: it.html || '',
                url: '',
                folder: it.folder || 'Imported Handouts',
                subfolder: it.subfolder || '',
                type: it.type || 'custom',
                isVisible: false
            });
            // Auto expand imported folder
            collapsedFolders.delete(it.folder);
        });

        assert.equal(campaignHandouts.length, 2);
        assert.equal(campaignHandouts[0].folder, 'Lost Mine of Phandelver');
        assert.equal(campaignHandouts[0].isVisible, false, 'Imported handouts default to hidden from players');
        assert.ok(!collapsedFolders.has('Lost Mine of Phandelver'), 'Imported folder must be auto-expanded');
    });
});
