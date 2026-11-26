import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('docs/getting-started.html has mobile hosting callout card', () => {
    const html = fs.readFileSync(path.resolve('docs/getting-started.html'), 'utf-8');
    assert.match(html, /id="mobile-hosting-tips"/, 'contains mobile-hosting-tips id');
    assert.match(html, /Hosting from a Phone or Tablet\? 3 Crucial Tips/, 'contains card title');
    assert.match(html, /Keep Screen Awake/, 'mentions screen awake rule');
    assert.match(html, /Auto-Lock.*iOS Safari.*Screen Timeout.*Android Chrome/s, 'mentions OS-specific settings');
    assert.match(html, /Avoid Private Tabs/, 'mentions private tabs rule');
    assert.match(html, /Turn on Eco Mode/, 'mentions eco mode rule');
    assert.match(html, /href="app-guide\.html#app-mobile-hosting"/, 'links to full mobile guide in app-guide.html');
});

test('docs/app-guide.html has mobile hosting TOC link and feature section', () => {
    const html = fs.readFileSync(path.resolve('docs/app-guide.html'), 'utf-8');
    assert.match(html, /href="#app-mobile-hosting"[^>]*class="manual-toc-link"/, 'contains TOC link');
    assert.match(html, /id="app-mobile-hosting"/, 'contains app-mobile-hosting section anchor');
    assert.match(html, /Mobile &amp; Tablet Hosting Guide \(Browser P2P\)/, 'contains subtitle heading');
    assert.match(html, /Hosting from Mobile Browsers \(Zero-Install\)/, 'contains feature card title');
    assert.match(html, /Keep the Screen Awake \(Crucial\)/, 'details screen sleep WebRTC freeze');
    assert.match(html, /Avoid Private \/ Incognito Browsing/, 'details IndexedDB wiping in private browsing');
    assert.match(html, /Enable Battery \/ Eco Mode/, 'details WebGL eco mode toggle');
    assert.match(html, /Touch GM Ergonomics/, 'details touch GM combat and tap-to-place');
});

test('docs/prep has dismissible mobile host notice UI and logic', () => {
    const html = fs.readFileSync(path.resolve('docs/prep/index.html'), 'utf-8');
    assert.match(html, /id="mobile-host-notice"/, 'index.html contains mobile-host-notice');
    assert.match(html, /id="btn-dismiss-mobile-notice"/, 'index.html contains btn-dismiss-mobile-notice');
    assert.match(html, /Hosting from a Phone or Tablet\?/, 'index.html contains notice title');

    const css = fs.readFileSync(path.resolve('docs/prep/dashboard.css'), 'utf-8');
    assert.match(css, /\.mobile-host-notice-card/, 'dashboard.css styles notice card');
    assert.match(css, /\.btn-dismiss-notice/, 'dashboard.css styles dismiss button');

    const js = fs.readFileSync(path.resolve('docs/prep/dashboard.js'), 'utf-8');
    assert.match(js, /mobileHostNotice/, 'dashboard.js binds notice element');
    assert.match(js, /btnDismissMobileNotice/, 'dashboard.js binds dismiss button');
    assert.match(js, /forgedvtt_dismiss_mobile_host_notice/, 'dashboard.js persists dismiss state');
});
