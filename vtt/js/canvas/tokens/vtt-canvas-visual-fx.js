// DnDForged Canvas Visual Effects & Overlays Module
// Handles DOM overlay effects: active turn glow outline, initiative card hover highlight, and GM off-screen indicator

export function updateVisualFx(ctx) {
    const {
        vtt,
        tokens,
        activeLayer,
        grid,
        initiativeHoverTokenId,
        panX,
        panY,
        zoom,
        getTokenDrawDimensions,
        getTokenCategory,
        getCategoryColor
    } = ctx;

    if (typeof document === 'undefined') return;
    const overlayContainer = document.getElementById('vtt-html-overlays');
    if (!overlayContainer) return;

    // =====================================================================
    // 1. ACTIVE INITIATIVE TOKEN SOLID OUTLINE (5% cell width, no glow/fade)
    // =====================================================================
    let glowNode = document.getElementById('vtt-active-initiative-glow');

    let activeToken = null;
    if (vtt.campaignState && vtt.campaignState.initiative && vtt.campaignState.initiative.combatants) {
        const combatants = vtt.campaignState.initiative.combatants;
        const activeIdx = vtt.campaignState.initiative.activeTurnIndex;
        if (activeIdx >= 0 && activeIdx < combatants.length) {
            const tokenId = combatants[activeIdx].tokenId;
            if (tokenId && tokens[tokenId]) {
                activeToken = tokens[tokenId];
            }
        }
    }

    if (activeToken && (activeToken.layer === activeLayer || vtt.role === 'GM')) {
        if (!glowNode) {
            glowNode = document.createElement('div');
            glowNode.id = 'vtt-active-initiative-glow';
            glowNode.style.position = 'absolute';
            glowNode.style.pointerEvents = 'none';
            glowNode.style.zIndex = '10';
            overlayContainer.appendChild(glowNode);
        }

        const { drawW, drawH } = getTokenDrawDimensions(activeToken);
        const cellWidth = grid && grid.size ? grid.size : 50;
        const outlineThickness = Math.max(2, Math.round(cellWidth * 0.05));
        const category = getTokenCategory(activeToken);
        const solidColor = getCategoryColor(category);

        // Tightly hug the outer perimeter of the token without obscuring token art
        glowNode.style.left = `${activeToken.x - outlineThickness}px`;
        glowNode.style.top = `${activeToken.y - outlineThickness}px`;
        glowNode.style.width = `${drawW + outlineThickness * 2}px`;
        glowNode.style.height = `${drawH + outlineThickness * 2}px`;
        glowNode.style.boxSizing = 'border-box';
        glowNode.style.border = `${outlineThickness}px solid ${solidColor}`;
        glowNode.style.borderRadius = !activeToken.isAsset ? '50%' : '0';
        glowNode.style.boxShadow = 'none';
        glowNode.style.backgroundColor = 'transparent';
        glowNode.style.opacity = '1';
    } else {
        if (glowNode) {
            glowNode.remove();
        }
    }

    // =====================================================================
    // 2. INITIATIVE CARD HOVER HIGHLIGHT & OFF-SCREEN INDICATOR
    // =====================================================================
    let hoverNode = document.getElementById('vtt-initiative-hover-glow');
    let offscreenIndicator = document.getElementById('vtt-offscreen-indicator');

    if (initiativeHoverTokenId && tokens[initiativeHoverTokenId]) {
        const hToken = tokens[initiativeHoverTokenId];
        if (hToken.layer === activeLayer || vtt.role === 'GM') {
            const { drawW: hW, drawH: hH } = getTokenDrawDimensions(hToken);
            const screenLeft = panX + hToken.x * zoom;
            const screenTop = panY + hToken.y * zoom;
            const screenRight = screenLeft + hW * zoom;
            const screenBottom = screenTop + hH * zoom;
            const vpW = window.innerWidth;
            const vpH = window.innerHeight;

            const isOffScreen = screenRight < 40 || screenLeft > vpW - 40 || screenBottom < 40 || screenTop > vpH - 40;
            const hCat = getTokenCategory(hToken);
            const hColor = getCategoryColor(hCat);

            if (offscreenIndicator) offscreenIndicator.style.display = 'none';

            if (isOffScreen) {
                if (hoverNode) hoverNode.style.display = 'none';
            } else {
                if (!hoverNode) {
                    hoverNode = document.createElement('div');
                    hoverNode.id = 'vtt-initiative-hover-glow';
                    hoverNode.style.position = 'absolute';
                    hoverNode.style.pointerEvents = 'none';
                    hoverNode.style.zIndex = '12';
                    overlayContainer.appendChild(hoverNode);
                }

                const cellWidth = grid && grid.size ? grid.size : 50;
                const hOutline = Math.max(3, Math.round(cellWidth * 0.06));

                hoverNode.style.display = 'block';
                hoverNode.style.left = `${hToken.x - hOutline}px`;
                hoverNode.style.top = `${hToken.y - hOutline}px`;
                hoverNode.style.width = `${hW + hOutline * 2}px`;
                hoverNode.style.height = `${hH + hOutline * 2}px`;
                hoverNode.style.boxSizing = 'border-box';
                hoverNode.style.border = `${hOutline}px solid ${hColor}`;
                hoverNode.style.borderRadius = !hToken.isAsset ? '50%' : '0';
                hoverNode.style.boxShadow = `0 0 16px ${hColor}, inset 0 0 8px ${hColor}`;
                hoverNode.style.backgroundColor = 'transparent';
            }
        } else {
            if (hoverNode) hoverNode.style.display = 'none';
            if (offscreenIndicator) offscreenIndicator.style.display = 'none';
        }
    } else {
        if (hoverNode) hoverNode.style.display = 'none';
        if (offscreenIndicator) offscreenIndicator.style.display = 'none';
    }
}
