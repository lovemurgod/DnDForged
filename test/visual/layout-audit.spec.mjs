import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { joinAsGM, freezeDynamicElements } from './helpers/visual-fixture.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const auditResultsPath = path.resolve(__dirname, 'audit-results.json');

/**
 * Inspects all visible DOM nodes on screen and collects layout flaws.
 */
async function auditScreen(page, screenName, deviceName) {
    return await page.evaluate(
        ({ screenName, deviceName }) => {
            const defects = [];
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const allEls = Array.from(document.querySelectorAll('*'));
            for (const el of allEls) {
                if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;

                // 1. Horizontal Overflow (bleeding outside right screen edge)
                if (rect.right > vw + 4 && rect.left < vw) {
                    const isCanvas =
                        el.tagName === 'CANVAS' ||
                        el.id === 'vtt-canvas-viewport' ||
                        el.id === 'canvas-container' ||
                        el.closest('#canvas-container');
                    if (!isCanvas) {
                        defects.push({
                            type: 'HORIZONTAL_OVERFLOW',
                            severity: 'HIGH',
                            element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`,
                            sampleText: el.textContent.trim().slice(0, 40),
                            parent: el.parentElement
                                ? `${el.parentElement.tagName.toLowerCase()}${el.parentElement.id ? '#' + el.parentElement.id : ''}${el.parentElement.className ? '.' + el.parentElement.className : ''}`
                                : '',
                            details: `Bleeds ${Math.round(rect.right - vw)}px past screen edge (${Math.round(rect.right)}px > screen ${vw}px). Cuts off content or causes sideways wobbling.`
                        });
                    }
                }

                // 2. Microscopic Text (< 11px font size)
                if (el.children.length === 0 && el.textContent.trim().length > 1) {
                    const fontSize = parseFloat(style.fontSize);
                    if (fontSize > 0 && fontSize < 11) {
                        defects.push({
                            type: 'MICROSCOPIC_TEXT',
                            severity: 'MEDIUM',
                            element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`,
                            parent: el.parentElement
                                ? `${el.parentElement.tagName.toLowerCase()}${el.parentElement.id ? '#' + el.parentElement.id : ''}${el.parentElement.className && typeof el.parentElement.className === 'string' ? '.' + el.parentElement.className.split(' ').slice(0, 2).join('.') : ''}`
                                : '',
                            sampleText: el.textContent.trim().slice(0, 25),
                            details: `Font size is only ${fontSize}px. Too small to read on phone/tablet without zooming.`
                        });
                    }
                }

                // 3. Tiny Touch Targets (< 32px interactive buttons)
                const isInteractive =
                    ['BUTTON', 'INPUT', 'SELECT', 'A'].includes(el.tagName) ||
                    el.getAttribute('role') === 'button' ||
                    (typeof el.className === 'string' &&
                        (el.className.includes('btn') || el.className.includes('control-btn')));
                if (isInteractive && rect.width > 0 && rect.height > 0) {
                    if (rect.width < 32 || rect.height < 32) {
                        defects.push({
                            type: 'TINY_TOUCH_TARGET',
                            severity: 'HIGH',
                            element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`,
                            details: `Touch size is ${Math.round(rect.width)}x${Math.round(rect.height)}px. Standard finger tap size is 44x44px. Tough to tap with a thumb.`
                        });
                    }
                }
            }

            // 4. Overlapping Buttons / Element Collisions
            const getVisibleRect = (el) => {
                let r = el.getBoundingClientRect();
                let curr = el.parentElement;
                while (curr && curr !== document.body && curr !== document.documentElement) {
                    const s = window.getComputedStyle(curr);
                    if (
                        s.overflowY === 'hidden' ||
                        s.overflowY === 'auto' ||
                        s.overflowY === 'scroll' ||
                        s.overflowX === 'hidden' ||
                        s.overflowX === 'auto' ||
                        s.overflowX === 'scroll'
                    ) {
                        const pr = curr.getBoundingClientRect();
                        const left = Math.max(r.left, pr.left);
                        const top = Math.max(r.top, pr.top);
                        const right = Math.min(r.right, pr.right);
                        const bottom = Math.min(r.bottom, pr.bottom);
                        r = {
                            left,
                            top,
                            right,
                            bottom,
                            width: Math.max(0, right - left),
                            height: Math.max(0, bottom - top)
                        };
                    }
                    curr = curr.parentElement;
                }
                return r;
            };

            const interactives = allEls.filter((el) => {
                if (!el.offsetParent && el.offsetWidth === 0) return false;
                const s = window.getComputedStyle(el);
                if (s.display === 'none' || s.visibility === 'hidden') return false;
                return (
                    ['BUTTON', 'INPUT', 'SELECT'].includes(el.tagName) ||
                    (typeof el.className === 'string' &&
                        (el.className.includes('btn') || el.className.includes('control-btn')))
                );
            });

            for (let i = 0; i < interactives.length; i++) {
                for (let j = i + 1; j < interactives.length; j++) {
                    const a = interactives[i];
                    const b = interactives[j];
                    if (a.contains(b) || b.contains(a)) continue;
                    const ra = getVisibleRect(a);
                    const rb = getVisibleRect(b);
                    if (ra.width === 0 || ra.height === 0 || rb.width === 0 || rb.height === 0) continue;
                    if (ra.bottom < 0 || ra.top > vh || rb.bottom < 0 || rb.top > vh) continue;

                    const overlapX = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
                    const overlapY = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
                    const getElDesc = (el) => {
                        const id = el.id ? '#' + el.id : '';
                        const cls =
                            el.className && typeof el.className === 'string'
                                ? '.' +
                                  el.className
                                      .split(' ')
                                      .filter((c) => c && !c.startsWith('animated'))
                                      .slice(0, 2)
                                      .join('.')
                                : '';
                        const tool = el.dataset?.tool ? `[tool=${el.dataset.tool}]` : '';
                        const tab = el.dataset?.tab ? `[tab=${el.dataset.tab}]` : '';
                        return `${el.tagName.toLowerCase()}${id}${cls}${tool}${tab}`;
                    };

                    if (overlapX > 10 && overlapY > 10) {
                        defects.push({
                            type: 'BUTTON_OVERLAP_COLLISION',
                            severity: 'CRITICAL',
                            elementA: getElDesc(a),
                            elementB: getElDesc(b),
                            details: `Overlaps by ${Math.round(overlapX)}x${Math.round(overlapY)}px. One button blocks tapping the other.`
                        });
                    }
                }
            }

            // 5. Buttons Covered by Fixed Toolbars/Overlays
            for (const el of interactives) {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                if (cx >= 0 && cx <= vw && cy >= 0 && cy <= vh) {
                    const topEl = document.elementFromPoint(cx, cy);
                    if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
                        const topStyle = window.getComputedStyle(topEl);
                        if (
                            topStyle.position === 'fixed' ||
                            topStyle.position === 'sticky' ||
                            topEl.closest('#vtt-mobile-nav, #vtt-controls, .mobile-combat-pill')
                        ) {
                            defects.push({
                                type: 'OBSCURED_BY_OVERLAY',
                                severity: 'HIGH',
                                element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
                                coveredBy: `${topEl.tagName.toLowerCase()}${topEl.id ? '#' + topEl.id : ''}`,
                                details: `Center of button is blocked by fixed overlay (${topEl.id || topEl.className}). Finger tap will hit the overlay instead.`
                            });
                        }
                    }
                }
            }

            return { screenName, deviceName, viewport: `${vw}x${vh}`, defectsCount: defects.length, defects };
        },
        { screenName, deviceName }
    );
}

test.describe('Mobile & Tablet Visual Layout Defect Audit', () => {
    test.use({ hasTouch: true });
    const auditReport = [];

    test.afterAll(() => {
        fs.writeFileSync(auditResultsPath, JSON.stringify(auditReport, null, 2), 'utf-8');
    });

    const testDevices = [
        { name: 'iPhone 14 / Mobile (Portrait)', width: 390, height: 844 },
        { name: 'Compact Android (Portrait)', width: 360, height: 800 },
        { name: 'Phone Landscape', width: 800, height: 360 },
        { name: 'iPad / Tablet (Portrait)', width: 820, height: 1180 },
        { name: 'Tablet Landscape', width: 1180, height: 820 }
    ];

    for (const dev of testDevices) {
        test(`audits layout defects on ${dev.name} (${dev.width}x${dev.height})`, async ({ page }) => {
            await page.setViewportSize({ width: dev.width, height: dev.height });
            await joinAsGM(page);
            await freezeDynamicElements(page);
            await page.waitForTimeout(600);

            // State 1: Main Tabletop Screen
            const r1 = await auditScreen(page, 'Main Tabletop & HUD', dev.name);
            auditReport.push(r1);

            // State 2: Character Sheet Open
            await page.evaluate(() => {
                if (window.VTT.playerSheet) window.VTT.playerSheet.openSheet('char_valeros_1');
            });
            await page.waitForTimeout(600);
            const r2 = await auditScreen(page, 'Player Character Sheet', dev.name);
            auditReport.push(r2);

            // State 3: Creature Sheet Open
            await page.evaluate(() => {
                if (window.VTT.creatureSheet) {
                    window.VTT.creatureSheet.openSheet(
                        {
                            name: 'Goblin Raider',
                            hp: { average: 7, formula: '2d6' },
                            ac: [15],
                            speed: { walk: 30 }
                        },
                        'tok_monster_1'
                    );
                }
            });
            await page.waitForTimeout(600);
            const r3 = await auditScreen(page, 'Creature Statblock Sheet', dev.name);
            auditReport.push(r3);

            // State 4: Chat Dock Active
            await page.evaluate(() => {
                const chatBtn = document.querySelector('[data-tab="tab-chat"]');
                if (chatBtn) chatBtn.click();
            });
            await page.waitForTimeout(600);
            const r4 = await auditScreen(page, 'Chat Dock & Right Sidebar', dev.name);
            auditReport.push(r4);

            // State 5: Character Builder - Step 1 (Identity & Ancestry)
            await page.evaluate(() => {
                // Ensure player sheet is open then click builder trigger
                if (window.VTT.playerSheet) window.VTT.playerSheet.openSheet('char_valeros_1');
                const builderBtn = document.getElementById('pc-open-character-builder-btn');
                if (builderBtn) builderBtn.click();
            });
            await page.waitForTimeout(600);
            const r5 = await auditScreen(page, 'Character Builder - Step 1 (Identity)', dev.name);
            auditReport.push(r5);

            // State 6: Character Builder - Step 2 (Point Buy & Abilities)
            await page.evaluate(() => {
                const step2Tab = document.querySelector('button.pc-builder-tab[data-step="2"]');
                if (step2Tab) step2Tab.click();
            });
            await page.waitForTimeout(600);
            const r6 = await auditScreen(page, 'Character Builder - Step 2 (Abilities)', dev.name);
            auditReport.push(r6);

            // Close Character Builder & Sheet
            await page.evaluate(() => {
                const closeBtn = document.getElementById('pc-builder-close-btn');
                if (closeBtn) closeBtn.click();
                if (window.VTT.playerSheet) window.VTT.playerSheet.closeSheet();
            });
            await page.waitForTimeout(400);

            // State 7: Mobile AOE Shape Sheet
            await page.evaluate(() => {
                const shapeSheet = document.getElementById('vtt-mobile-shape-sheet');
                if (shapeSheet) shapeSheet.classList.remove('vtt-hidden');
            });
            await page.waitForTimeout(500);
            const r7 = await auditScreen(page, 'Mobile AOE Shape Sheet', dev.name);
            auditReport.push(r7);

            // Close Shape Sheet
            await page.evaluate(() => {
                const shapeSheet = document.getElementById('vtt-mobile-shape-sheet');
                if (shapeSheet) shapeSheet.classList.add('vtt-hidden');
            });
            await page.waitForTimeout(300);

            // State 8: Mobile Map Tools Sheet
            await page.evaluate(() => {
                const maptoolsSheet = document.getElementById('vtt-mobile-maptools-sheet');
                if (maptoolsSheet) maptoolsSheet.classList.remove('vtt-hidden');
            });
            await page.waitForTimeout(500);
            const r8 = await auditScreen(page, 'Mobile Map Tools Sheet', dev.name);
            auditReport.push(r8);

            // Close Map Tools Sheet
            await page.evaluate(() => {
                const maptoolsSheet = document.getElementById('vtt-mobile-maptools-sheet');
                if (maptoolsSheet) maptoolsSheet.classList.add('vtt-hidden');
            });
            await page.waitForTimeout(300);
        });
    }
});
