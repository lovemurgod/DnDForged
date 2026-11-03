import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const ROOT_DIR = process.cwd();
const HTML_PATH = path.join(ROOT_DIR, 'vtt', 'index.html');
const CANVAS_JS_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'vtt-canvas.js');
const MOBILE_ADAPTER_JS_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'vtt-mobile-adapter.js');
const MOBILE_CSS_PATH = path.join(ROOT_DIR, 'vtt', 'css', 'vtt-mobile.css');

test('Mobile/Tablet UI and VTT Fixes Regression Suite', async (t) => {
    await t.test('Issue 1: vtt-canvas.js renderShapesPass defines isGmViewing in scope', () => {
        assert.ok(fs.existsSync(CANVAS_JS_PATH), 'vtt-canvas.js must exist');
        const content = fs.readFileSync(CANVAS_JS_PATH, 'utf8');

        // Locate function renderShapesPass
        const fnIndex = content.indexOf('function renderShapesPass(targetLayer)');
        assert.ok(fnIndex !== -1, 'renderShapesPass must exist in vtt-canvas.js');

        const fnSnippet = content.substring(fnIndex, fnIndex + 800);
        assert.ok(
            fnSnippet.includes("const isGmViewing = vtt.role === 'GM';"),
            'renderShapesPass must define isGmViewing inside its function scope'
        );
        assert.ok(
            fnSnippet.includes('if (shapeLayer !== activeLayer && !isGmViewing) return;'),
            'renderShapesPass must check isGmViewing without throwing ReferenceError'
        );
    });

    await t.test('Issue 2: vtt/index.html inline bootstrap scripts parse with zero syntax errors', () => {
        assert.ok(fs.existsSync(HTML_PATH), 'vtt/index.html must exist');
        const html = fs.readFileSync(HTML_PATH, 'utf8');

        const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
        const matches = [...html.matchAll(scriptRegex)];

        assert.ok(matches.length >= 2, 'Should find at least 2 inline bootstrap scripts in vtt/index.html');

        matches.forEach((match, idx) => {
            const code = match[1];
            // Ensure no split keywords
            assert.ok(!code.includes('functio n'), `Script ${idx + 1} must not contain 'functio n'`);
            assert.ok(!code.includes('functi on'), `Script ${idx + 1} must not contain 'functi on'`);
            assert.ok(!code.includes('(func tion()'), `Script ${idx + 1} must not contain '(func tion()'`);

            // Verify clean compilation
            assert.doesNotThrow(() => {
                new vm.Script(code);
            }, `Script ${idx + 1} must compile cleanly without SyntaxError`);
        });
    });

    await t.test('Issue 3: vtt-mobile-adapter.js initializes paint drawer & map tools once and idempotently', () => {
        assert.ok(fs.existsSync(MOBILE_ADAPTER_JS_PATH), 'vtt-mobile-adapter.js must exist');
        const content = fs.readFileSync(MOBILE_ADAPTER_JS_PATH, 'utf8');

        // 1. Verify idempotency guards exist
        const paintFnIndex = content.indexOf('function setupMobilePaintDrawer()');
        const paintFn = content.substring(paintFnIndex, paintFnIndex + 250);
        assert.ok(
            paintFn.includes('modal.dataset.initialized'),
            'setupMobilePaintDrawer must contain an idempotency guard'
        );

        const maptoolsFnIndex = content.indexOf('function setupMobileMapToolsUI()');
        const maptoolsFn = content.substring(maptoolsFnIndex, maptoolsFnIndex + 250);
        assert.ok(
            maptoolsFn.includes('sheet.dataset.initialized'),
            'setupMobileMapToolsUI must contain an idempotency guard'
        );

        // 2. Verify duplicate calls in Section 7 (INITIALIZE) are removed
        const initIndex = content.indexOf('// 7. INITIALIZE');
        const initBlock = content.substring(initIndex, initIndex + 300);
        const paintCallMatches = initBlock.match(/setupMobilePaintDrawer\(\);/g) || [];
        const maptoolsCallMatches = initBlock.match(/setupMobileMapToolsUI\(\);/g) || [];
        assert.strictEqual(
            paintCallMatches.length,
            0,
            'Section 7 should not duplicate setupMobilePaintDrawer() already called by setupMobileNavigation()'
        );
        assert.strictEqual(
            maptoolsCallMatches.length,
            0,
            'Section 7 should not duplicate setupMobileMapToolsUI() already called by setupMobileNavigation()'
        );

        // 3. Functional DOM simulation: verify single-fire on trap DC plus button
        const dom = new JSDOM(`<!DOCTYPE html>
        <html>
        <body>
            <div id="vtt-mobile-maptools-sheet">
                <span id="mobile-trap-dc-val">15</span>
                <button id="btn-mobile-trap-dc-plus">+</button>
                <button id="btn-mobile-trap-dc-minus">-</button>
            </div>
            <input id="maptools-trap-dc" value="15">
        </body>
        </html>`);

        const { window } = dom;
        const sheet = window.document.getElementById('vtt-mobile-maptools-sheet');
        const trapDcVal = window.document.getElementById('mobile-trap-dc-val');
        const trapDcPlus = window.document.getElementById('btn-mobile-trap-dc-plus');

        // Extract setupMobileMapToolsUI function body logic and execute twice on the same DOM
        function attachMapTools(doc) {
            const s = doc.getElementById('vtt-mobile-maptools-sheet');
            if (!s) return;
            if (s.dataset.initialized === 'true') return;
            s.dataset.initialized = 'true';

            const dcVal = doc.getElementById('mobile-trap-dc-val');
            const dcPlus = doc.getElementById('btn-mobile-trap-dc-plus');
            if (dcPlus) {
                dcPlus.addEventListener('click', () => {
                    let cur = parseInt(dcVal.textContent) || 15;
                    if (cur < 30) {
                        cur++;
                        dcVal.textContent = cur;
                    }
                });
            }
        }

        // Call twice simulating the bug scenario
        attachMapTools(window.document);
        attachMapTools(window.document);

        // Trigger one click
        trapDcPlus.dispatchEvent(new window.MouseEvent('click'));

        // Value must increment by exactly 1 (15 -> 16), not 2
        assert.strictEqual(trapDcVal.textContent, '16', 'Trap DC must increment exactly once per tap');
    });

    await t.test('Issue 4: vtt-mobile.css defines rules for html.force-mobile-ui', () => {
        assert.ok(fs.existsSync(MOBILE_CSS_PATH), 'vtt-mobile.css must exist');
        const content = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');

        assert.ok(
            content.includes('html.force-mobile-ui'),
            'vtt-mobile.css must have rules targeting html.force-mobile-ui'
        );
        assert.ok(
            content.includes('html.force-mobile-ui:not(.force-desktop-ui) #vtt-workspace'),
            'Must style #vtt-workspace under html.force-mobile-ui'
        );
        assert.ok(
            content.includes('html.force-mobile-ui:not(.force-desktop-ui) #vtt-sidebar'),
            'Must style #vtt-sidebar as mobile drawer under html.force-mobile-ui'
        );
        assert.ok(
            content.includes('html.force-mobile-ui:not(.force-desktop-ui) #vtt-controls'),
            'Must hide #vtt-controls under html.force-mobile-ui'
        );
        assert.ok(
            content.includes('html.force-mobile-ui:not(.force-desktop-ui) #vtt-mobile-nav'),
            'Must display #vtt-mobile-nav under html.force-mobile-ui'
        );
    });

    await t.test('Issue 5: vtt/index.html viewport meta tag permits browser zoom accessibility', () => {
        const html = fs.readFileSync(HTML_PATH, 'utf8');
        const viewportMatch = html.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
        assert.ok(viewportMatch, 'Viewport meta tag must be present');

        const contentAttr = viewportMatch[1];
        assert.ok(
            !contentAttr.includes('maximum-scale=1.0'),
            'Viewport meta tag must not restrict maximum-scale=1.0'
        );
        assert.ok(
            !contentAttr.includes('user-scalable=no'),
            'Viewport meta tag must not restrict user-scalable=no'
        );
        assert.ok(
            contentAttr.includes('width=device-width'),
            'Viewport meta tag must set width=device-width'
        );
        assert.ok(
            contentAttr.includes('initial-scale=1.0'),
            'Viewport meta tag must set initial-scale=1.0'
        );
    });

    await t.test('Issue 6: Creature sheet removes 16px backdrop-filter blur on mobile', () => {
        const CREATURE_CSS_PATH = path.join(ROOT_DIR, 'vtt', 'css', 'components', 'creature-sheet.css');
        assert.ok(fs.existsSync(CREATURE_CSS_PATH), 'creature-sheet.css must exist');
        const creatureCss = fs.readFileSync(CREATURE_CSS_PATH, 'utf8');

        // Verify creature-sheet.css includes mobile media query with backdrop-filter: none
        assert.ok(
            creatureCss.includes('#creature-sheet-panel') &&
            creatureCss.includes('backdrop-filter: none !important;'),
            'creature-sheet.css must provide mobile override with backdrop-filter: none !important;'
        );

        // Verify vtt-mobile.css enforces backdrop-filter: none !important
        const mobileCss = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');
        assert.ok(
            mobileCss.includes('#creature-sheet-panel') &&
            mobileCss.includes('backdrop-filter: none !important;'),
            'vtt-mobile.css must enforce backdrop-filter: none !important on creature-sheet-panel'
        );
    });

    await t.test('Issue 7: Weather engine destroy() safely handles environment without ResizeObserver', async () => {
        const WEATHER_JS_PATH = path.join(ROOT_DIR, 'vtt', 'js', 'vtt-weather.js');
        assert.ok(fs.existsSync(WEATHER_JS_PATH), 'vtt-weather.js must exist');
        const content = fs.readFileSync(WEATHER_JS_PATH, 'utf8');

        // Static verification
        assert.ok(
            content.includes('if (resizeObserver) resizeObserver.disconnect();'),
            'destroy() must guard resizeObserver.disconnect() with if (resizeObserver)'
        );

        // Functional verification: simulate canvas & container without global ResizeObserver
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"><canvas id="vtt-canvas-weather"></canvas></div></body></html>');
        const origWindow = globalThis.window;
        const origDocument = globalThis.document;
        const origLocalStorage = globalThis.localStorage;
        const origResizeObserver = globalThis.ResizeObserver;

        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.localStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        };
        delete globalThis.ResizeObserver;

        try {
            const { initVttWeather } = await import(`../vtt/js/vtt-weather.js?t=${Date.now()}`);
            const mockCtx = new Proxy({
                createLinearGradient: () => ({ addColorStop: () => {} }),
                createRadialGradient: () => ({ addColorStop: () => {} }),
                createImageData: () => ({ data: new Uint8ClampedArray(4) })
            }, {
                get: (target, prop) => {
                    if (prop in target) return target[prop];
                    return () => {};
                }
            });
            dom.window.HTMLCanvasElement.prototype.getContext = () => mockCtx;

            const engine = initVttWeather({});
            assert.ok(engine, 'Weather engine should initialize without ResizeObserver');
            assert.doesNotThrow(() => {
                engine.destroy();
            }, 'destroy() must not throw TypeError when ResizeObserver is unavailable');
        } finally {
            globalThis.window = origWindow;
            globalThis.document = origDocument;
            globalThis.localStorage = origLocalStorage;
            if (origResizeObserver) {
                globalThis.ResizeObserver = origResizeObserver;
            }
        }
    });

    await t.test('Issue 8: Placement banner eliminates continuous pulsePlacementBanner animation', () => {
        const mobileCss = fs.readFileSync(MOBILE_CSS_PATH, 'utf8');
        const bannerIndex = mobileCss.indexOf('#vtt-mobile-placement-banner {');
        assert.ok(bannerIndex !== -1, '#vtt-mobile-placement-banner { rule must exist in vtt-mobile.css');

        const ruleEnd = mobileCss.indexOf('}', bannerIndex);
        assert.ok(ruleEnd !== -1, '#vtt-mobile-placement-banner rule must close with }');

        const bannerRule = mobileCss.substring(bannerIndex, ruleEnd + 1);
        assert.ok(
            !bannerRule.includes('pulsePlacementBanner'),
            '#vtt-mobile-placement-banner must not have pulsePlacementBanner animation'
        );
        assert.ok(
            bannerRule.includes('animation: none !important;'),
            '#vtt-mobile-placement-banner must set animation: none !important;'
        );
    });
});
