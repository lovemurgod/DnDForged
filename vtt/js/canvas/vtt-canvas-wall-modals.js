// DnDForged Canvas Wall, Door & Window Settings Modals Module
// Manages creation, configuration, and destruction of wall-related modal dialogs

export function closeAnyWallModal() {
    const oldPopup = document.getElementById('vtt-wall-settings-modal');
    if (oldPopup) oldPopup.remove();
    const oldContext = document.getElementById('vtt-wall-context-menu');
    if (oldContext) oldContext.remove();
}

export function createWallSettingsModalContainer(clientX, clientY, width = 280) {
    closeAnyWallModal();
    const popup = document.createElement('div');
    popup.id = 'vtt-wall-settings-modal';
    popup.className = 'glassmorphism floating-tool-panel';
    popup.style.position = 'fixed';
    popup.style.left = `${Math.min(window.innerWidth - width - 20, Math.max(10, clientX))}px`;
    popup.style.top = `${Math.min(window.innerHeight - 380, Math.max(10, clientY))}px`;
    popup.style.zIndex = '10000';
    popup.style.padding = '14px 16px';
    popup.style.borderRadius = '8px';
    popup.style.width = `${width}px`;
    popup.style.background = 'rgba(18, 22, 33, 0.98)';
    popup.style.border = '1px solid var(--color-border-subtle)';
    popup.style.boxShadow = '0 10px 36px rgba(0, 0, 0, 0.6)';
    return popup;
}

export function setupModalOutsideClick(popup) {
    const closeOnOutside = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            window.removeEventListener('mousedown', closeOnOutside);
        }
    };
    setTimeout(() => {
        window.addEventListener('mousedown', closeOnOutside);
    }, 120);
}

export function showDoorSettingsModal(wallIdx, clientX, clientY, ctx) {
    const { walls, currentMapId, vtt, onWallsUpdated, onWallDeleted } = ctx;
    const wall = walls[wallIdx];
    if (!wall) return;
    const popup = createWallSettingsModalContainer(clientX, clientY, 280);

    popup.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-door-closed text-gradient-gold"></i> Door Settings
            </h4>
            <button type="button" class="btn btn-secondary btn-xxs modal-close-btn" style="padding: 2px 6px;">✕</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer;">
                <span><i class="fa-solid fa-lock" style="width: 18px; color: ${wall.isLocked ? '#dc3545' : '#6c757d'};"></i> Locked Door</span>
                <input type="checkbox" id="modal-door-locked" ${wall.isLocked ? 'checked' : ''}>
            </label>

            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer;">
                <span><i class="fa-solid fa-eye-slash" style="width: 18px; color: ${wall.isSecret ? '#ffc107' : '#28a745'};"></i> Secret (Hidden to Players)</span>
                <input type="checkbox" id="modal-door-secret" ${wall.isSecret ? 'checked' : ''}>
            </label>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer; margin-bottom: 6px;">
                    <span><i class="fa-solid fa-arrows-spin" style="width: 18px; color: var(--color-gold-base);"></i> Rotating Hinge Pivot</span>
                    <input type="checkbox" id="modal-door-hinge" ${wall.hasHinge ? 'checked' : ''}>
                </label>
                <div id="modal-door-hinge-details" class="${wall.hasHinge ? '' : 'vtt-hidden'}" style="display: flex; flex-direction: column; gap: 6px; padding-left: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
                        <span>Pivot Endpoint:</span>
                        <select id="modal-door-hinge-endpoint" style="font-size: 0.75rem; padding: 2px 6px;">
                            <option value="1" ${(wall.hingeEndpoint || 1) === 1 ? 'selected' : ''}>Endpoint 1 (Start)</option>
                            <option value="2" ${(wall.hingeEndpoint || 1) === 2 ? 'selected' : ''}>Endpoint 2 (End)</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem;">
                        <span>Swing Angle (°):</span>
                        <input type="number" id="modal-door-swing-angle" min="15" max="180" step="15" value="${wall.swingAngle || 90}" style="width: 60px; font-size: 0.75rem; padding: 2px 4px;">
                    </div>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">Convert to:</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="modal-convert-to-wall" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-square-full"></i> Wall</button>
                    <button type="button" id="modal-convert-to-window" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-border-all"></i> Window</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <button type="button" id="modal-door-delete" class="btn btn-danger btn-xs" style="width: 100%; text-align: center;">
                    <i class="fa-solid fa-trash"></i> Delete Door
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    setupModalOutsideClick(popup);

    popup.querySelector('.modal-close-btn').onclick = () => popup.remove();
    
    popup.querySelector('#modal-door-locked').onchange = (e) => {
        wall.isLocked = e.target.checked;
        if (wall.isLocked && wall.isOpen) wall.isOpen = false;
        onWallsUpdated();
    };

    popup.querySelector('#modal-door-secret').onchange = (e) => {
        wall.isSecret = e.target.checked;
        onWallsUpdated();
    };

    const hingeCb = popup.querySelector('#modal-door-hinge');
    const hingeDetails = popup.querySelector('#modal-door-hinge-details');
    hingeCb.onchange = (e) => {
        wall.hasHinge = e.target.checked;
        if (wall.hasHinge && !wall.hingeEndpoint) wall.hingeEndpoint = 1;
        hingeDetails.classList.toggle('vtt-hidden', !wall.hasHinge);
        onWallsUpdated();
    };

    popup.querySelector('#modal-door-hinge-endpoint').onchange = (e) => {
        wall.hingeEndpoint = parseInt(e.target.value) || 1;
        onWallsUpdated();
    };

    popup.querySelector('#modal-door-swing-angle').onchange = (e) => {
        wall.swingAngle = parseInt(e.target.value) || 90;
        onWallsUpdated();
    };

    popup.querySelector('#modal-convert-to-wall').onclick = () => {
        wall.type = 'wall';
        onWallsUpdated();
        popup.remove();
    };

    popup.querySelector('#modal-convert-to-window').onclick = () => {
        wall.type = 'window';
        onWallsUpdated();
        popup.remove();
    };

    popup.querySelector('#modal-door-delete').onclick = () => {
        walls.splice(wallIdx, 1);
        if (typeof onWallDeleted === 'function') onWallDeleted(wallIdx);
        popup.remove();
    };
}

export function showWindowSettingsModal(wallIdx, clientX, clientY, ctx) {
    const { walls, currentMapId, vtt, onWallsUpdated, onWallDeleted } = ctx;
    const wall = walls[wallIdx];
    if (!wall) return;
    const popup = createWallSettingsModalContainer(clientX, clientY, 290);

    let initialVisionMode = 'both_blocked';
    if (wall.oneWay && wall.oneWay !== 'none') {
        initialVisionMode = 'one_way';
    } else if (wall.isSeeThrough || wall.isDrawn === false) {
        initialVisionMode = 'both_seethrough';
    }

    popup.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-border-all text-gradient-gold"></i> Window Settings
            </h4>
            <button type="button" class="btn btn-secondary btn-xxs modal-close-btn" style="padding: 2px 6px;">✕</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer;">
                <span><i class="fa-solid fa-lock" style="width: 18px; color: ${wall.isLocked ? '#dc3545' : '#6c757d'};"></i> Locked (Blocks Pass-Through)</span>
                <input type="checkbox" id="modal-window-locked" ${wall.isLocked ? 'checked' : ''}>
            </label>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.78rem; font-weight: 500; margin-bottom: 6px; color: var(--color-gold-base);">Vision & Light Mode:</div>
                <select id="modal-window-vision-mode" style="width: 100%; font-size: 0.75rem; padding: 4px 8px; margin-bottom: 6px;">
                    <option value="both_seethrough" ${initialVisionMode === 'both_seethrough' ? 'selected' : ''}>Both Sides See-Through (Transparent)</option>
                    <option value="both_blocked" ${initialVisionMode === 'both_blocked' ? 'selected' : ''}>Both Sides Blocked (Opaque Glass)</option>
                    <option value="one_way" ${initialVisionMode === 'one_way' ? 'selected' : ''}>One-Way Vision (Tinted / Mirrored)</option>
                </select>
                
                <div id="modal-window-oneway-controls" class="${initialVisionMode === 'one_way' ? '' : 'vtt-hidden'}" style="background: rgba(0,0,0,0.25); padding: 8px; border-radius: 4px; display: flex; flex-direction: column; gap: 6px;">
                    <button type="button" id="modal-window-flip-direction" class="btn btn-secondary btn-xs" style="width: 100%;">
                        <i class="fa-solid fa-arrows-rotate"></i> Flip Direction (Swap Sides)
                    </button>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 2px;"></span> Green Dashed: See-Through
                    </div>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #dc3545; border-radius: 2px;"></span> Red Solid: Blocked
                    </div>
                </div>
            </div>

            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <span><i class="fa-solid fa-eye-slash" style="width: 18px; color: ${wall.isSecret ? '#ffc107' : '#28a745'};"></i> Secret (Hidden to Players)</span>
                <input type="checkbox" id="modal-window-secret" ${wall.isSecret ? 'checked' : ''}>
            </label>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">Convert to:</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="modal-convert-to-wall" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-square-full"></i> Wall</button>
                    <button type="button" id="modal-convert-to-door" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-door-closed"></i> Door</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <button type="button" id="modal-window-delete" class="btn btn-danger btn-xs" style="width: 100%; text-align: center;">
                    <i class="fa-solid fa-trash"></i> Delete Window
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    setupModalOutsideClick(popup);

    popup.querySelector('.modal-close-btn').onclick = () => popup.remove();
    
    popup.querySelector('#modal-window-locked').onchange = (e) => {
        wall.isLocked = e.target.checked;
        if (wall.isLocked && wall.isOpen) wall.isOpen = false;
        onWallsUpdated();
    };

    const visionModeSelect = popup.querySelector('#modal-window-vision-mode');
    const onewayControls = popup.querySelector('#modal-window-oneway-controls');
    visionModeSelect.onchange = (e) => {
        const mode = e.target.value;
        if (mode === 'both_seethrough') {
            wall.isSeeThrough = true;
            wall.isDrawn = false;
            wall.oneWay = 'none';
            onewayControls.classList.add('vtt-hidden');
        } else if (mode === 'both_blocked') {
            wall.isSeeThrough = false;
            wall.isDrawn = true;
            wall.oneWay = 'none';
            onewayControls.classList.add('vtt-hidden');
        } else if (mode === 'one_way') {
            wall.isSeeThrough = false;
            wall.isDrawn = true;
            if (!wall.oneWay || wall.oneWay === 'none') wall.oneWay = 'left';
            onewayControls.classList.remove('vtt-hidden');
        }
        onWallsUpdated();
    };

    popup.querySelector('#modal-window-flip-direction').onclick = () => {
        wall.oneWay = wall.oneWay === 'left' ? 'right' : 'left';
        onWallsUpdated();
    };

    popup.querySelector('#modal-window-secret').onchange = (e) => {
        wall.isSecret = e.target.checked;
        onWallsUpdated();
    };

    popup.querySelector('#modal-convert-to-wall').onclick = () => {
        wall.type = 'wall';
        onWallsUpdated();
        popup.remove();
    };

    popup.querySelector('#modal-convert-to-door').onclick = () => {
        wall.type = 'door';
        onWallsUpdated();
        popup.remove();
    };

    popup.querySelector('#modal-window-delete').onclick = () => {
        walls.splice(wallIdx, 1);
        if (typeof onWallDeleted === 'function') onWallDeleted(wallIdx);
        popup.remove();
    };
}

export function showWallSettingsModal(wallIdx, clientX, clientY, ctx) {
    const { walls, currentMapId, vtt, onWallsUpdated, onWallDeleted } = ctx;
    const wall = walls[wallIdx];
    if (!wall) return;
    const popup = createWallSettingsModalContainer(clientX, clientY, 280);

    const isOneWay = wall.oneWay && wall.oneWay !== 'none';

    popup.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: var(--color-gold-base); font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-square-full text-gradient-gold"></i> Wall Settings
            </h4>
            <button type="button" class="btn btn-secondary btn-xxs modal-close-btn" style="padding: 2px 6px;">✕</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>
                <div style="font-size: 0.78rem; font-weight: 500; margin-bottom: 6px; color: var(--color-gold-base);">Vision & Light Blocking:</div>
                <select id="modal-wall-direction-mode" style="width: 100%; font-size: 0.75rem; padding: 4px 8px; margin-bottom: 6px;">
                    <option value="none" ${!isOneWay ? 'selected' : ''}>Two-Way Wall (Normal / Blocks Both Sides)</option>
                    <option value="one_way" ${isOneWay ? 'selected' : ''}>One-Way Wall (Parapet / Ledge / Cliff)</option>
                </select>
                
                <div id="modal-wall-oneway-controls" class="${isOneWay ? '' : 'vtt-hidden'}" style="background: rgba(0,0,0,0.25); padding: 8px; border-radius: 4px; display: flex; flex-direction: column; gap: 6px;">
                    <button type="button" id="modal-wall-flip-direction" class="btn btn-secondary btn-xs" style="width: 100%;">
                        <i class="fa-solid fa-arrows-rotate"></i> Flip Direction (Swap Sides)
                    </button>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 2px;"></span> Green Dashed: See-Through
                    </div>
                    <div style="font-size: 0.7rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width: 10px; height: 10px; background: #dc3545; border-radius: 2px;"></span> Red Solid: Blocked
                    </div>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">Convert to:</div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="modal-convert-to-door" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-door-closed"></i> Door</button>
                    <button type="button" id="modal-convert-to-window" class="btn btn-secondary btn-xxs" style="flex: 1;"><i class="fa-solid fa-border-all"></i> Window</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
                <button type="button" id="modal-wall-delete" class="btn btn-danger btn-xs" style="width: 100%; text-align: center;">
                    <i class="fa-solid fa-trash"></i> Delete Wall
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    setupModalOutsideClick(popup);

    popup.querySelector('.modal-close-btn').onclick = () => popup.remove();

    const dirModeSelect = popup.querySelector('#modal-wall-direction-mode');
    const onewayControls = popup.querySelector('#modal-wall-oneway-controls');
    dirModeSelect.onchange = (e) => {
        const mode = e.target.value;
        if (mode === 'none') {
            wall.oneWay = 'none';
            onewayControls.classList.add('vtt-hidden');
        } else {
            if (!wall.oneWay || wall.oneWay === 'none') wall.oneWay = 'left';
            onewayControls.classList.remove('vtt-hidden');
        }
        onWallsUpdated();
    };

    popup.querySelector('#modal-wall-flip-direction').onclick = () => {
        wall.oneWay = wall.oneWay === 'left' ? 'right' : 'left';
        onWallsUpdated();
    };

    popup.querySelector('#modal-convert-to-door').onclick = () => {
        wall.type = 'door';
        onWallsUpdated();
        popup.remove();
    };

    popup.querySelector('#modal-convert-to-window').onclick = () => {
        wall.type = 'window';
        onWallsUpdated();
        popup.remove();
    };

    popup.querySelector('#modal-wall-delete').onclick = () => {
        walls.splice(wallIdx, 1);
        if (typeof onWallDeleted === 'function') onWallDeleted(wallIdx);
        popup.remove();
    };
}

export function openWallSettingsModal(wallIdx, clientX, clientY, ctx) {
    const wall = ctx.walls[wallIdx];
    if (!wall) return;
    if (wall.type === 'door') showDoorSettingsModal(wallIdx, clientX, clientY, ctx);
    else if (wall.type === 'window') showWindowSettingsModal(wallIdx, clientX, clientY, ctx);
    else showWallSettingsModal(wallIdx, clientX, clientY, ctx);
}
