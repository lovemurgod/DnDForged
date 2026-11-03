import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('CSS: Initiative tracker z-index, sheet layering, and circular layout', () => {
    const cssPath = path.join(rootDir, 'vtt', 'css', 'components', 'initiative.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    const creatureSheetCss = fs.readFileSync(
        path.join(rootDir, 'vtt', 'css', 'components', 'creature-sheet.css'),
        'utf8'
    );
    const playerSheetCss = fs.readFileSync(path.join(rootDir, 'vtt', 'css', 'components', 'player-sheet.css'), 'utf8');

    // 1. Verify container z-index is 25 (strictly lower than sheets at 60)
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\s*\{[^}]*z-index:\s*25\s*!important;/s,
        'Initiative container must have z-index: 25 !important'
    );

    // 2. Verify sheets have z-index: 60 !important
    assert.match(
        creatureSheetCss,
        /#creature-sheet-panel\s*\{[^}]*z-index:\s*60\s*!important;/s,
        'Creature sheet panel must have z-index: 60 !important'
    );
    assert.match(
        playerSheetCss,
        /#player-sheet-panel\s*\{[^}]*z-index:\s*60\s*!important;/s,
        'Player sheet panel must have z-index: 60 !important'
    );

    // 3. Verify pos-right uses --sidebar-width for snug docking
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\.pos-right\s*\{[^}]*right:\s*calc\(var\(--sidebar-width,\s*380px\)\s*\+\s*4px\);/s,
        'pos-right must dock against --sidebar-width + 4px'
    );

    // 4. Verify slim capsule pods for controls and 64px container
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\s*\{[^}]*width:\s*64px\s*!important;/s,
        'Initiative container must have width: 64px !important'
    );
    assert.match(
        cssContent,
        /\.init-controls-top\s*\{[^}]*width:\s*56px\s*!important;/s,
        'Top controls must be a 56px capsule pod'
    );
    assert.match(
        cssContent,
        /\.init-controls-bottom\s*\{[^}]*width:\s*56px\s*!important;/s,
        'Bottom controls must be a 56px capsule pod'
    );

    // 5. Verify circular cards, delete button, and expanded in-place editor
    assert.match(
        cssContent,
        /\.init-card-del-btn\s*\{[^}]*z-index:\s*25\s*!important;/s,
        'Delete button must have z-index 25'
    );
    assert.match(cssContent, /\.init-card-hover-tooltip\s*\{[^}]*opacity:\s*0;/s, 'Floating hover tooltip must exist');
    assert.match(
        cssContent,
        /\.init-card-score\.is-editing\s*\{[^}]*width:\s*64px\s*!important;/s,
        'Editing score badge must expand to 64px'
    );
    assert.match(
        cssContent,
        /\.pos-top\s+\.init-carousel-card\.init-carousel-card--active[\s\S]*?\{[^}]*width:\s*52px\s*!important;/s,
        'Horizontal active card must be a 52px pure circle'
    );

    // 6. Verify arrow position options in index.html (symbols only, no words)
    const indexHtml = fs.readFileSync(path.join(rootDir, 'vtt', 'index.html'), 'utf8');
    assert.match(
        indexHtml,
        /<select id="hud-init-position"[^>]*>[\s\S]*?value="right"[^>]*>&#8594;<\/option>[\s\S]*?value="custom"[^>]*>&#10021;<\/option>/s,
        'Position dropdown must contain symbols only without words'
    );
});

test('Canvas Visual FX: Hover token triggers visual FX update without off-screen arrow', () => {
    const canvasJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-canvas.js'), 'utf8');
    const visualFxJs = fs.readFileSync(
        path.join(rootDir, 'vtt', 'js', 'canvas', 'tokens', 'vtt-canvas-visual-fx.js'),
        'utf8'
    );

    // 1. Verify setInitiativeHoverToken triggers requestVisualFxUpdate()
    assert.match(
        canvasJs,
        /setInitiativeHoverToken:\s*\(tokenId\)\s*=>\s*\{[\s\S]*?initiativeHoverTokenId\s*=\s*tokenId;[\s\S]*?requestVisualFxUpdate\(\);/s,
        'setInitiativeHoverToken must call requestVisualFxUpdate()'
    );

    // 2. Verify visual FX hides offscreen indicator on initiative hover
    assert.match(
        visualFxJs,
        /if\s*\(offscreenIndicator\)\s*offscreenIndicator\.style\.display\s*=\s*'none';/s,
        'visual FX must not show offscreen indicator on hover'
    );
});

test('Initiative Tracker Logic: Off-layer filtering and player privacy rules', () => {
    const chatJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-chat.js'), 'utf8');

    // 1. Verify off-layer tokens are filtered out for players
    assert.match(
        chatJs,
        /if\s*\(vtt\.role\s*!==\s*'GM'\)\s*\{[\s\S]*?tok\.layer\s*&&\s*tok\.layer\s*!==\s*'token'/s,
        'Player view must filter out non-token layer combatants'
    );

    // 2. Verify isActiveOffLayer sets visualActiveIndex to -1 for players
    assert.match(
        chatJs,
        /isActiveOffLayer[\s\S]*?visualActiveIndex\s*=\s*-1;/s,
        'Hidden turns must hide the active visual indicator from players'
    );

    // 3. Verify creature privacy check (isCreaturePlayerView)
    assert.match(
        chatJs,
        /const isCreaturePlayerView\s*=\s*vtt\.role\s*!==\s*'GM'\s*&&\s*!isPlayerChar;/s,
        'Creatures must be flagged with isCreaturePlayerView for player clients'
    );

    // 4. Verify updateCombatantLayer export and layer syncing
    assert.match(
        chatJs,
        /function updateCombatantLayer\(tokenId,\s*newLayer\)/s,
        'updateCombatantLayer function must be defined'
    );
    assert.match(chatJs, /updateCombatantLayer,/s, 'updateCombatantLayer must be exported');

    // 5. Verify token menu layer change invokes updateCombatantLayer
    const tokenMenuJs = fs.readFileSync(
        path.join(rootDir, 'vtt', 'js', 'canvas', 'tokens', 'vtt-canvas-token-menu.js'),
        'utf8'
    );
    assert.ok(
        tokenMenuJs.includes('window.VTT?.chatEngine?.updateCombatantLayer(id, targetLayer)') ||
            tokenMenuJs.includes('window.VTT?.chatEngine?.updateCombatantLayer?.(id, targetLayer)'),
        'Layer change must notify chatEngine.updateCombatantLayer'
    );

    // 6. Verify GM right-click edit listener on card row
    assert.match(
        chatJs,
        /row\.addEventListener\('contextmenu',\s*startScoreEdit\);/s,
        'Right clicking row must trigger startScoreEdit'
    );
});

test('Audit Optimizations: Ghost Combatants, Video HUD, Selection Guard, and Mobile Action Sheet', () => {
    const chatJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-chat.js'), 'utf8');
    const initCss = fs.readFileSync(path.join(rootDir, 'vtt', 'css', 'components', 'initiative.css'), 'utf8');
    const massActionsJs = fs.readFileSync(
        path.join(rootDir, 'vtt', 'js', 'canvas', 'tokens', 'vtt-canvas-mass-actions.js'),
        'utf8'
    );
    const mobileJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-mobile-adapter.js'), 'utf8');
    const mobileCss = fs.readFileSync(path.join(rootDir, 'vtt', 'css', 'vtt-mobile.css'), 'utf8');

    // 1. Ghost Combatant retention and badge
    assert.match(
        chatJs,
        /const isGhost = Boolean\(c\.tokenId && \(!canvasEngine \|\| !canvasEngine\.getTokens\(\)\?\.\[c\.tokenId\]\)\);/,
        'Ghost combatant detection must check if token was removed from canvas'
    );
    assert.match(
        chatJs,
        /cardClasses\.push\('init-carousel-card--ghost'\);/,
        'Ghost combatants must be flagged with CSS class'
    );
    assert.match(chatJs, /init-ghost-badge.*Token removed from canvas/s, 'Ghost badge must be included on the card');
    assert.match(
        initCss,
        /\.init-carousel-card\.init-carousel-card--ghost\s*\{[^}]*opacity:\s*0\.65/s,
        'Ghost card CSS must dim and grayscale removed tokens'
    );
    assert.match(initCss, /\.init-ghost-badge\s*\{[^}]*position:\s*absolute/s, 'Ghost badge CSS must be defined');

    // 2. Video tokens in HUD: first frame / static poster only
    assert.doesNotMatch(
        chatJs,
        /<video class="init-token-avatar" src="[^"]*" autoplay muted loop/,
        'Video tokens must NOT continuously autoplay in the initiative HUD'
    );
    assert.match(
        chatJs,
        /<video class="init-token-avatar" src="\$\{safeTargetImg\}#t=0\.001"/,
        'Video tokens must use static first-frame poster snapshot'
    );

    // 3. Selection permission guard on double click
    assert.match(
        chatJs,
        /const canSelect = vtt\.role === 'GM' \|\| token\.isPlayer \|\| token\.characterId === window\.VTT\?\.activeCharacterId;/,
        'Double-click token selection must verify player ownership/GM role'
    );

    // 4. Wheel listener RAF throttling
    assert.match(
        chatJs,
        /wheelRafId = requestAnimationFrame\(\(\) => \{[\s\S]*?updateScrollButtons\(\);/s,
        'Wheel scrolling in horizontal mode must be throttled with requestAnimationFrame'
    );

    // 5. Mass layer move invokes updateCombatantLayer
    assert.match(
        massActionsJs,
        /window\.VTT(?:\.|\?\.)chatEngine(?:\.|\?\.)updateCombatantLayer\s*\(\s*t\.id,\s*targetLayer\s*\)/,
        'Mass layer actions must notify updateCombatantLayer'
    );

    // 6. Mobile Action Sheet
    assert.match(
        mobileJs,
        /function setupMobileInitiativeActionSheet\(\)/,
        'Mobile adapter must define setupMobileInitiativeActionSheet'
    );
    assert.match(mobileJs, /vtt-mobile-init-action-sheet/, 'Mobile adapter must inject action sheet element');
    assert.match(
        mobileCss,
        /\.vtt-mobile-init-sheet\s*\{[^}]*position:\s*fixed/s,
        'Mobile CSS must style .vtt-mobile-init-sheet'
    );

    // 7. UpdateCombatantScore export
    assert.match(
        chatJs,
        /function updateCombatantScore\(targetId,\s*newScore\)/,
        'updateCombatantScore must be defined'
    );
    assert.match(chatJs, /updateCombatantScore,/s, 'updateCombatantScore must be exported from chatEngine');
});

test('Fine-Tuning: Resize handle across all modes, horizontal ~720px sizing, transparent docked Top/Bottom backgrounds, centered round, and no active glow', () => {
    const cssContent = fs.readFileSync(path.join(rootDir, 'vtt', 'css', 'components', 'initiative.css'), 'utf8');
    const chatJs = fs.readFileSync(path.join(rootDir, 'vtt', 'js', 'vtt-chat.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'vtt', 'index.html'), 'utf8');

    // 1. Dropdown symbols only (no "(Right)", "(Left)", etc.)
    assert.doesNotMatch(
        indexHtml,
        /<option value="right"[^>]*>.*\(Right\)/i,
        'Dropdown must not contain "(Right)" word'
    );
    assert.doesNotMatch(
        indexHtml,
        /<option value="custom"[^>]*>.*\(Custom\)/i,
        'Dropdown must not contain "(Custom)" word'
    );

    // 2. Horizontal tracker sizing expanded to ~720px
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\.pos-top\s*\{[^}]*width:\s*min\(90vw,\s*720px\);/s,
        'pos-top width must be min(90vw, 720px)'
    );
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\.pos-top\s*\{[^}]*min-width:\s*520px;/s,
        'pos-top min-width must be 520px'
    );

    // 3. Transparent backgrounds for docked Top/Bottom and Custom Horizontal
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\.pos-top\s*\{[^}]*background:\s*transparent\s*!important;/s,
        'pos-top container background must be transparent !important'
    );
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\.pos-bottom\s*\{[^}]*background:\s*transparent\s*!important;/s,
        'pos-bottom container background must be transparent !important'
    );
    assert.match(
        cssContent,
        /#vtt-initiative-carousel-container\.pos-custom\.orientation-horizontal\s*\{[^}]*background:\s*transparent\s*!important;/s,
        'pos-custom.orientation-horizontal container background must be transparent !important'
    );

    // 4. Horizontal control pods have dark capsule styling across Top, Bottom, and Custom
    assert.match(
        cssContent,
        /\.pos-top\s+\.init-controls-top,\s*\.pos-bottom\s+\.init-controls-top,\s*\.pos-custom\.orientation-horizontal\s+\.init-controls-top\s*\{[^}]*background:\s*rgba\(10,\s*14,\s*24,\s*0\.94\)\s*!important;/s,
        'Horizontal top controls must have capsule pod background across Top, Bottom, and Custom'
    );
    assert.match(
        cssContent,
        /\.pos-top\s+\.init-controls-bottom,\s*\.pos-bottom\s+\.init-controls-bottom,\s*\.pos-custom\.orientation-horizontal\s+\.init-controls-bottom\s*\{[^}]*background:\s*rgba\(10,\s*14,\s*24,\s*0\.94\)\s*!important;/s,
        'Horizontal bottom controls must have capsule pod background across Top, Bottom, and Custom'
    );

    // 5. Centered round button in vertical mode
    assert.match(
        cssContent,
        /\.current-round\s*\{[^}]*margin:\s*0\s*auto\s*!important;/s,
        'current-round must have margin: 0 auto !important for centering'
    );

    // 6. Active combatant: no gold aura glow, keeps gold border
    assert.doesNotMatch(
        cssContent,
        /\.pos-right\s+\.init-carousel-card\.init-carousel-card--active[\s\S]*?\{[^}]*box-shadow:\s*0\s*0\s*16px\s*rgba\(212,\s*175,\s*55/s,
        'Active card in vertical mode must not have 16px gold glow box-shadow'
    );
    assert.match(
        cssContent,
        /\.pos-right\s+\.init-carousel-card\.init-carousel-card--active[\s\S]*?\{[^}]*border:\s*2px\s*solid\s*#d4af37\s*!important;/s,
        'Active card must retain 2px solid #d4af37 gold border'
    );

    // 7. Resize handle styles & JS logic
    assert.match(
        cssContent,
        /\.init-resize-handle\s*\{[^}]*cursor:\s*nwse-resize;/s,
        'init-resize-handle must have cursor: nwse-resize'
    );
    assert.match(
        cssContent,
        /\.init-resize-handle\s*\{[^}]*touch-action:\s*none;/s,
        'init-resize-handle must have touch-action: none'
    );
    assert.match(
        chatJs,
        /initContainer\.style\.maxHeight\s*=\s*`\$\{newH\}px`;/s,
        'JS resize handler must adjust maxHeight for vertical length stretching'
    );
    assert.match(
        chatJs,
        /initContainer\.style\.bottom\s*=\s*'auto';/s,
        'JS resize handler must release bottom constraint when resizing vertical docked tracker'
    );
});
