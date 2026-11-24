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
    const existingMultiActiveGlows = overlayContainer.querySelectorAll('.vtt-active-initiative-glow-multi');
    existingMultiActiveGlows.forEach((el) => el.remove());

    let activeTokens = [];
    if (vtt.campaignState && vtt.campaignState.initiative && vtt.campaignState.initiative.combatants) {
        const combatants = vtt.campaignState.initiative.combatants;
        const activeIdx = vtt.campaignState.initiative.activeTurnIndex;
        if (activeIdx >= 0 && activeIdx < combatants.length) {
            const combatant = combatants[activeIdx];
            const activeIds =
                Array.isArray(combatant.tokenIds) && combatant.tokenIds.length > 0
                    ? combatant.tokenIds
                    : combatant.tokenId
                      ? [combatant.tokenId]
                      : [];
            activeTokens = activeIds.map((id) => tokens[id]).filter(Boolean);
        }
    }

    if (activeTokens.length > 0) {
        const cellWidth = grid && grid.size ? grid.size : 50;
        const outlineThickness = Math.max(2, Math.round(cellWidth * 0.05));

        let renderedAny = false;
        activeTokens.forEach((actTok) => {
            if (actTok.layer !== activeLayer && vtt.role !== 'GM') return;

            let targetNode;
            if (!renderedAny) {
                if (!glowNode) {
                    glowNode = document.createElement('div');
                    glowNode.id = 'vtt-active-initiative-glow';
                    glowNode.style.position = 'absolute';
                    glowNode.style.pointerEvents = 'none';
                    glowNode.style.zIndex = '10';
                    overlayContainer.appendChild(glowNode);
                }
                targetNode = glowNode;
            } else {
                targetNode = document.createElement('div');
                targetNode.className = 'vtt-active-initiative-glow-multi';
                targetNode.style.position = 'absolute';
                targetNode.style.pointerEvents = 'none';
                targetNode.style.zIndex = '10';
                overlayContainer.appendChild(targetNode);
            }
            renderedAny = true;

            const { drawW, drawH } = getTokenDrawDimensions(actTok);
            const category = getTokenCategory(actTok);
            const solidColor = getCategoryColor(category);

            targetNode.style.display = 'block';
            targetNode.style.left = `${actTok.x - outlineThickness}px`;
            targetNode.style.top = `${actTok.y - outlineThickness}px`;
            targetNode.style.width = `${drawW + outlineThickness * 2}px`;
            targetNode.style.height = `${drawH + outlineThickness * 2}px`;
            targetNode.style.boxSizing = 'border-box';
            targetNode.style.border = `${outlineThickness}px solid ${solidColor}`;
            targetNode.style.borderRadius = !actTok.isAsset ? '50%' : '0';
            targetNode.style.boxShadow = 'none';
            targetNode.style.backgroundColor = 'transparent';
            targetNode.style.opacity = '1';
        });

        if (!renderedAny && glowNode) {
            glowNode.remove();
        }
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

    const existingMultiHoverGlows = overlayContainer.querySelectorAll('.vtt-initiative-hover-glow-multi');
    existingMultiHoverGlows.forEach((el) => el.remove());

    const hoverIds = Array.isArray(initiativeHoverTokenId)
        ? initiativeHoverTokenId.filter(Boolean)
        : initiativeHoverTokenId
          ? [initiativeHoverTokenId]
          : [];

    const validHoverTokens = hoverIds.map((id) => tokens[id]).filter(Boolean);

    if (validHoverTokens.length > 0) {
        if (offscreenIndicator) offscreenIndicator.style.display = 'none';

        const cellWidth = grid && grid.size ? grid.size : 50;
        const hOutline = Math.max(3, Math.round(cellWidth * 0.06));

        let renderedAny = false;
        validHoverTokens.forEach((hToken) => {
            if (hToken.layer !== activeLayer && vtt.role !== 'GM') return;

            const { drawW: hW, drawH: hH } = getTokenDrawDimensions(hToken);
            const screenLeft = panX + hToken.x * zoom;
            const screenTop = panY + hToken.y * zoom;
            const screenRight = screenLeft + hW * zoom;
            const screenBottom = screenTop + hH * zoom;
            const vpW = window.innerWidth;
            const vpH = window.innerHeight;

            const isOffScreen = screenRight < 40 || screenLeft > vpW - 40 || screenBottom < 40 || screenTop > vpH - 40;
            if (isOffScreen) return;

            const hCat = getTokenCategory(hToken);
            const hColor = getCategoryColor(hCat);

            let node;
            if (!renderedAny) {
                if (!hoverNode) {
                    hoverNode = document.createElement('div');
                    hoverNode.id = 'vtt-initiative-hover-glow';
                    hoverNode.style.position = 'absolute';
                    hoverNode.style.pointerEvents = 'none';
                    hoverNode.style.zIndex = '12';
                    overlayContainer.appendChild(hoverNode);
                }
                node = hoverNode;
            } else {
                node = document.createElement('div');
                node.className = 'vtt-initiative-hover-glow-multi';
                node.style.position = 'absolute';
                node.style.pointerEvents = 'none';
                node.style.zIndex = '12';
                overlayContainer.appendChild(node);
            }
            renderedAny = true;

            node.style.display = 'block';
            node.style.left = `${hToken.x - hOutline}px`;
            node.style.top = `${hToken.y - hOutline}px`;
            node.style.width = `${hW + hOutline * 2}px`;
            node.style.height = `${hH + hOutline * 2}px`;
            node.style.boxSizing = 'border-box';
            node.style.border = `${hOutline}px solid ${hColor}`;
            node.style.borderRadius = !hToken.isAsset ? '50%' : '0';
            node.style.boxShadow = `0 0 16px ${hColor}, inset 0 0 8px ${hColor}`;
            node.style.backgroundColor = 'transparent';
        });

        if (!renderedAny && hoverNode) {
            hoverNode.style.display = 'none';
        }
    } else {
        if (hoverNode) hoverNode.style.display = 'none';
        if (offscreenIndicator) offscreenIndicator.style.display = 'none';
    }
}
