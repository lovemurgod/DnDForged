import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT_DIR = process.cwd();
const HTML_PATH = path.join(ROOT_DIR, 'vtt', 'index.html');
const MOBILE_ADAPTER_JS_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'vtt-mobile-adapter.js');
const MOBILE_CSS_PATH = path.join(ROOT_DIR, 'vtt', 'css', 'vtt-mobile.css');

test('Mobile Fullscreen API and PWA Standalone Integration Suite', async (t) => {
    const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
    const cssContent = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');
    const jsContent = fs.readFileSync(MOBILE_ADAPTER_JS_PATH, 'utf8');

    await t.test('1. vtt/index.html defines iOS PWA standalone meta tags', () => {
        assert.ok(
            htmlContent.includes('<meta name="apple-mobile-web-app-capable" content="yes">'),
            'Must contain apple-mobile-web-app-capable'
        );
        assert.ok(
            htmlContent.includes('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'),
            'Must contain apple-mobile-web-app-status-bar-style'
        );
        assert.ok(
            htmlContent.includes('<meta name="apple-mobile-web-app-title" content="ForgeD VTT">'),
            'Must contain apple-mobile-web-app-title'
        );
    });

    await t.test('2. vtt/index.html defines Fullscreen FAB tool button and Install Banner markup', () => {
        assert.ok(
            htmlContent.includes('id="mobile-tool-fullscreen"'),
            'Must contain mobile-tool-fullscreen in tools menu'
        );
        assert.ok(htmlContent.includes('data-tool="fullscreen"'), 'Must have data-tool="fullscreen" attribute');
        assert.ok(
            htmlContent.includes('id="vtt-mobile-install-banner"'),
            'Must contain vtt-mobile-install-banner container'
        );
        assert.ok(htmlContent.includes('id="btn-mobile-install-action"'), 'Must contain btn-mobile-install-action');
        assert.ok(htmlContent.includes('id="btn-mobile-install-dismiss"'), 'Must contain btn-mobile-install-dismiss');
    });

    await t.test('3. vtt/css/vtt-mobile.css styles install banner and honors desktop overrides', () => {
        assert.ok(
            cssContent.includes('#vtt-mobile-install-banner'),
            'Must include rules for #vtt-mobile-install-banner'
        );
        assert.ok(
            cssContent.includes('#vtt-mobile-install-banner.vtt-hidden'),
            'Must include hidden selector rule for install banner'
        );
        assert.ok(
            cssContent.includes('html.force-desktop-ui #vtt-mobile-install-banner'),
            'Must hide install banner when desktop UI is forced'
        );
    });

    await t.test('4. vtt-mobile-adapter.js integrates Fullscreen into FAB and More Tab', () => {
        assert.ok(jsContent.includes("toolKey === 'fullscreen'"), 'activateTool must handle fullscreen toolKey');
        assert.ok(
            jsContent.includes('id="more-card-fullscreen"'),
            'injectMobileMoreTab must render more-card-fullscreen'
        );
        assert.ok(
            jsContent.includes("action === 'toggle-fullscreen'"),
            'More tab listener must handle toggle-fullscreen action'
        );
        assert.ok(
            jsContent.includes('setupMobileFullscreenController()'),
            'setupMobileNavigation must invoke setupMobileFullscreenController'
        );
        assert.ok(
            jsContent.includes('setupMobileInstallBanner()'),
            'setupMobileNavigation must invoke setupMobileInstallBanner'
        );
    });

    await t.test('5. Mobile adapter Fullscreen & Install Banner runtime behavior in JSDOM', () => {
        const dom = new JSDOM(htmlContent, {
            url: 'http://localhost:3000/vtt/',
            pretendToBeVisual: true
        });
        const { window } = dom;

        // Force mobile UI mode
        window.localStorage.clear();
        window.localStorage.setItem('vtt_force_mobile_ui', 'true');

        // Polyfill mobile/touch environment in JSDOM
        Object.defineProperty(window, 'innerWidth', { value: 768, writable: true, configurable: true });
        Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, writable: true, configurable: true });
        window.ontouchstart = () => {};
        if (!window.matchMedia) {
            window.matchMedia = (query) => ({
                matches: query.includes('coarse') || query.includes('max-width'),
                addListener: () => {},
                removeListener: () => {}
            });
        }

        // Track and clear intervals created during adapter initialization so Node event loop exits
        const origSetInterval = globalThis.setInterval;
        const activeIntervals = [];
        globalThis.setInterval = (...args) => {
            const id = origSetInterval(...args);
            activeIntervals.push(id);
            return id;
        };

        // Track toast messages
        let lastToast = null;
        window.showToast = (msg, type) => {
            lastToast = { msg, type };
        };

        // Mock Fullscreen API
        let fullscreenElement = null;
        let requestFullscreenCalled = false;
        let exitFullscreenCalled = false;

        window.document.documentElement.requestFullscreen = async () => {
            requestFullscreenCalled = true;
            fullscreenElement = window.document.documentElement;
            window.document.fullscreenElement = fullscreenElement;
            window.document.dispatchEvent(new window.Event('fullscreenchange'));
        };

        window.document.exitFullscreen = async () => {
            exitFullscreenCalled = true;
            fullscreenElement = null;
            window.document.fullscreenElement = null;
            window.document.dispatchEvent(new window.Event('fullscreenchange'));
        };

        // Mock VTT context
        const mockVtt = {
            role: 'GM',
            canvasEngine: { renderAll: () => {} },
            chatEngine: { appendSystemMessage: () => {} }
        };

        // Assign necessary DOM globals on globalThis for the evaluated module
        const origLocalStorage = globalThis.localStorage;
        const origMutationObserver = globalThis.MutationObserver;
        globalThis.localStorage = window.localStorage;
        globalThis.MutationObserver = window.MutationObserver;

        try {
            // Execute mobile adapter factory (strip ES module export for new Function evaluation)
            const runnableJs = jsContent.replace(
                'export function initVttMobileAdapter',
                'function initVttMobileAdapter'
            );
            const factory = new Function(
                'vtt',
                'window',
                'document',
                `${runnableJs}\nreturn initVttMobileAdapter(vtt);`
            );
            const adapter = factory(mockVtt, window, window.document);

            assert.ok(adapter, 'initMobileAdapter must return adapter');
            assert.equal(typeof adapter.toggleFullscreen, 'function', 'adapter must expose toggleFullscreen');
            assert.equal(typeof adapter.isFullscreen, 'function', 'adapter must expose isFullscreen');

            // Test Fullscreen toggle entry
            assert.equal(adapter.isFullscreen(), false, 'Initially not fullscreen');
            adapter.toggleFullscreen();
            assert.ok(requestFullscreenCalled, 'requestFullscreen should be called');

            // Test Fullscreen toggle exit
            adapter.toggleFullscreen();
            assert.ok(exitFullscreenCalled, 'exitFullscreen should be called');

            // Test Install Banner dismiss flow
            const banner = window.document.getElementById('vtt-mobile-install-banner');
            assert.ok(banner, 'Install banner DOM element must exist');

            banner.classList.remove('vtt-hidden');
            assert.equal(banner.classList.contains('vtt-hidden'), false);

            const dismissBtn = window.document.getElementById('btn-mobile-install-dismiss');
            assert.ok(dismissBtn, 'Dismiss button must exist');
            dismissBtn.click();

            assert.ok(banner.classList.contains('vtt-hidden'), 'Banner must be hidden on dismiss click');
            assert.equal(
                window.localStorage.getItem('vtt_dismiss_install_banner'),
                'true',
                'Dismissal must be stored in localStorage'
            );
        } finally {
            activeIntervals.forEach((id) => clearInterval(id));
            globalThis.setInterval = origSetInterval;
            if (origLocalStorage !== undefined) globalThis.localStorage = origLocalStorage;
            else delete globalThis.localStorage;
            if (origMutationObserver !== undefined) globalThis.MutationObserver = origMutationObserver;
            else delete globalThis.MutationObserver;
        }
    });
});
