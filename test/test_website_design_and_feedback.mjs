import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PAGES = ['index.html', 'getting-started.html', 'guide.html', 'app-guide.html', 'feedback.html', 'legal.html'];

test('Website Design & Feedback Page Verification Suite', async (t) => {
  await t.test('1. Verify all expected website HTML files exist', () => {
    for (const page of PAGES) {
      const filePath = path.join(ROOT_DIR, page);
      assert.ok(fs.existsSync(filePath), `File ${page} must exist`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.length > 200, `File ${page} must not be empty`);
    }
  });

  await t.test('2. Verify release download link points to valid release asset', () => {
    for (const page of PAGES) {
      const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
      assert.ok(
        content.includes('1.4.0/ForgeDVTT-Setup-1.4.1.exe'),
        `Page ${page} must link to working release installer (1.4.0 tag with ForgeDVTT-Setup-1.4.1.exe asset)`
      );
    }
  });

  await t.test('3. Verify header navigation consistency across all pages', () => {
    for (const page of PAGES) {
      const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
      assert.ok(content.includes('href="index.html"'), `${page} must link to Home`);
      assert.ok(content.includes('href="getting-started.html"'), `${page} must link to Getting Started`);
      assert.ok(content.includes('>Play Guide</a>'), `${page} must have Play Guide navigation label`);
      assert.ok(content.includes('>App Guide</a>'), `${page} must have App Guide navigation label`);
      assert.ok(content.includes('href="feedback.html"'), `${page} must link to Feedback in navigation`);
    }
  });

  await t.test('4. Verify footer links across all pages', () => {
    for (const page of PAGES) {
      const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
      assert.ok(content.includes('href="feedback.html"'), `${page} footer must link to feedback.html`);
      assert.ok(content.includes('href="legal.html"'), `${page} footer must link to legal.html`);
    }
  });

  await t.test('5. Verify index.html requirements tab switcher, summary cards & hero copy', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    assert.ok(content.includes('req-tab-nav'), 'index.html must contain requirement tab navigation');
    assert.ok(content.includes('req-tab-btn'), 'index.html must contain requirement tab buttons');
    assert.ok(content.includes('req-tab-panel'), 'index.html must contain requirement tab panels');
    assert.ok(content.includes('req-summary-cards'), 'index.html must contain requirement summary cards');
    assert.ok(content.includes('guide-callout-dual'), 'index.html must contain dual guide callouts');
    assert.ok(/Game\s+Master\s*\(DM\)/.test(content), 'index.html must connect Game Master and DM');
  });

  await t.test('6. Verify getting-started.html distinct setup checkpoints', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'getting-started.html'), 'utf8');
    assert.ok(content.includes('Start your local server'), 'getting-started.html must have distinct local server step');
    assert.ok(content.includes('Start your online player tunnel'), 'getting-started.html must have distinct online tunnel step');
  });

  await t.test('7. Verify guide.html mobile section documents Add to Home Screen', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'guide.html'), 'utf8');
    assert.ok(content.includes('id="guide-mobile-ui"'), 'guide.html must contain mobile section');
    assert.ok(content.includes('Add to Home Screen'), 'guide.html must document Add to Home Screen');
    assert.ok(content.includes('Install / PWA'), 'guide.html must label PWA installation');
  });

  await t.test('8. Verify feedback.html contains Google Form iframe and direct link', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'feedback.html'), 'utf8');
    assert.ok(content.includes('https://forms.gle/CaL1PXZyPmkehx7c7'), 'feedback.html must contain direct forms.gle link');
    assert.ok(content.includes('docs.google.com/forms/d/e/1FAIpQLSdXQSQ10zosM_noJch0sBh0QcVPvY6XEelCbmPAeH12Bunz3g/viewform?embedded=true'), 'feedback.html must contain embedded form iframe');
  });
});
