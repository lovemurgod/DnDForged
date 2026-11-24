/**
 * vtt-token-cropper.js
 * Interactive Token Cropper, Zooming, and Stamping Studio.
 * Allows users to pan, zoom, rotate, shape-mask, and frame portraits into clean 1:1 VTT tokens.
 */

import {
    TOKEN_SHAPES,
    TOKEN_BORDER_STYLES,
    THEMATIC_FRAMES,
    traceTokenCanvasPath
} from './vtt-canvas-token-borders.js';

let cropperModalEl = null;

export function openTokenCropper(options = {}) {
    const { sourceUrl, initialFraming = {}, initialBorder = {}, tokenName = 'Token', onSave = () => {} } = options;

    if (!sourceUrl) return;

    ensureCropperModalExists();

    const modal = document.getElementById('modal-token-cropper');
    const overlay = document.getElementById('modal-token-cropper-overlay');
    if (!modal || !overlay) return;

    // State for interactive manipulation
    const state = {
        img: new Image(),
        imgLoaded: false,
        sourceUrl: sourceUrl,
        scale: initialFraming.scale !== undefined ? initialFraming.scale : 1.0,
        offsetX: initialFraming.offsetX !== undefined ? initialFraming.offsetX : 0,
        offsetY: initialFraming.offsetY !== undefined ? initialFraming.offsetY : 0,
        rotation: initialFraming.rotation !== undefined ? initialFraming.rotation : 0,
        shape: initialBorder.shape || 'circle',
        borderStyle: initialBorder.style || 'solid',
        framePreset: initialBorder.framePreset || 'none',
        borderColor: initialBorder.color || '#007bff',
        borderWidth: initialBorder.width !== undefined ? initialBorder.width : 3,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        baseOffsetX: 0,
        baseOffsetY: 0
    };

    const canvas = document.getElementById('token-cropper-canvas');
    const ctx = canvas.getContext('2d');
    const size = 360; // Internal preview canvas size
    canvas.width = size;
    canvas.height = size;

    const zoomSlider = document.getElementById('token-cropper-zoom');
    const zoomVal = document.getElementById('token-cropper-zoom-val');
    const shapeSelect = document.getElementById('token-cropper-shape');
    const borderStyleSelect = document.getElementById('token-cropper-border-style');
    const framePresetGroup = document.getElementById('token-cropper-frame-preset-group');
    const framePresetSelect = document.getElementById('token-cropper-frame-preset');
    const borderColorInput = document.getElementById('token-cropper-border-color');
    const borderWidthSlider = document.getElementById('token-cropper-border-width');
    const borderWidthVal = document.getElementById('token-cropper-border-width-val');

    // Populate controls from state
    if (zoomSlider) zoomSlider.value = state.scale;
    if (zoomVal) zoomVal.textContent = `${Math.round(state.scale * 100)}%`;
    if (shapeSelect) shapeSelect.value = state.shape;
    if (borderStyleSelect) borderStyleSelect.value = state.borderStyle;
    if (framePresetSelect) framePresetSelect.value = state.framePreset;
    if (borderColorInput) borderColorInput.value = state.borderColor;
    if (borderWidthSlider) borderWidthSlider.value = state.borderWidth;
    if (borderWidthVal) borderWidthVal.textContent = `${state.borderWidth}px`;
    if (framePresetGroup) {
        framePresetGroup.classList.toggle('vtt-hidden', state.borderStyle !== 'frame');
    }

    const render = () => {
        ctx.clearRect(0, 0, size, size);

        // 1. Draw Checkerboard backdrop for transparency preview
        const tileSize = 12;
        for (let y = 0; y < size; y += tileSize) {
            for (let x = 0; x < size; x += tileSize) {
                ctx.fillStyle = (x / tileSize + y / tileSize) % 2 === 0 ? '#181b20' : '#22262d';
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }

        const cx = size / 2;
        const cy = size / 2;
        const frameRadius = size * 0.44; // Active token boundary radius

        if (state.imgLoaded) {
            ctx.save();

            // Setup translation and scale centered on canvas
            ctx.translate(cx + state.offsetX, cy + state.offsetY);
            if (state.rotation) {
                ctx.rotate((state.rotation * Math.PI) / 180);
            }
            ctx.scale(state.scale, state.scale);

            // Compute draw dimensions maintaining aspect ratio centered
            const naturalW = state.img.naturalWidth || 100;
            const naturalH = state.img.naturalHeight || 100;
            const baseDim = frameRadius * 2;
            let drawW, drawH;
            if (naturalW >= naturalH) {
                drawH = baseDim;
                drawW = (naturalW / naturalH) * baseDim;
            } else {
                drawW = baseDim;
                drawH = (naturalH / naturalW) * baseDim;
            }

            ctx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        }

        // 2. Draw Dimmed Mask outside the active token shape
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, size, size);

        // Cut out the active token shape using destination-out
        ctx.globalCompositeOperation = 'destination-out';
        traceTokenCanvasPath(ctx, cx, cy, frameRadius, state.shape);
        ctx.fill();
        ctx.restore();

        // 3. Draw Border Frame preview on top
        if (state.borderStyle !== 'none') {
            ctx.save();
            ctx.strokeStyle = state.borderColor;
            ctx.lineWidth = state.borderWidth;

            if (state.borderStyle === 'dashed') {
                ctx.setLineDash([8, 6]);
            } else if (state.borderStyle === 'glow') {
                ctx.shadowColor = state.borderColor;
                ctx.shadowBlur = 10;
            }

            traceTokenCanvasPath(ctx, cx, cy, frameRadius, state.shape);
            ctx.stroke();

            if (state.borderStyle === 'double') {
                ctx.lineWidth = Math.max(1, state.borderWidth * 0.5);
                traceTokenCanvasPath(ctx, cx, cy, frameRadius - state.borderWidth - 2, state.shape);
                ctx.stroke();
            }

            ctx.restore();
        }
    };

    // Load source image safely with cross-origin handling
    state.img.crossOrigin = 'anonymous';
    state.img.onload = () => {
        state.imgLoaded = true;
        render();
    };
    state.img.onerror = () => {
        console.warn('Token Cropper: Failed to load source image:', state.sourceUrl);
    };
    state.img.src = state.sourceUrl;

    // Mouse & Touch Drag Event Listeners on Canvas
    const onPointerDown = (e) => {
        state.isDragging = true;
        state.dragStartX = e.clientX || e.touches?.[0]?.clientX || 0;
        state.dragStartY = e.clientY || e.touches?.[0]?.clientY || 0;
        state.baseOffsetX = state.offsetX;
        state.baseOffsetY = state.offsetY;
        canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (e) => {
        if (!state.isDragging) return;
        const curX = e.clientX || e.touches?.[0]?.clientX || 0;
        const curY = e.clientY || e.touches?.[0]?.clientY || 0;
        state.offsetX = state.baseOffsetX + (curX - state.dragStartX);
        state.offsetY = state.baseOffsetY + (curY - state.dragStartY);
        render();
    };

    const onPointerUp = () => {
        state.isDragging = false;
        canvas.style.cursor = 'grab';
    };

    canvas.onmousedown = onPointerDown;
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.ontouchstart = onPointerDown;
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);

    // Mouse Wheel Zoom
    canvas.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        state.scale = Math.max(0.4, Math.min(4.0, state.scale + delta));
        if (zoomSlider) zoomSlider.value = state.scale;
        if (zoomVal) zoomVal.textContent = `${Math.round(state.scale * 100)}%`;
        render();
    };

    // UI Input Event Handlers
    zoomSlider.oninput = (e) => {
        state.scale = parseFloat(e.target.value) || 1.0;
        if (zoomVal) zoomVal.textContent = `${Math.round(state.scale * 100)}%`;
        render();
    };

    shapeSelect.onchange = (e) => {
        state.shape = e.target.value;
        if (state.shape !== 'circle' && state.borderStyle === 'frame') {
            state.borderStyle = 'solid';
            if (borderStyleSelect) borderStyleSelect.value = 'solid';
            if (framePresetGroup) framePresetGroup.classList.add('vtt-hidden');
        }
        render();
    };

    borderStyleSelect.onchange = (e) => {
        state.borderStyle = e.target.value;
        if (state.borderStyle === 'frame') {
            state.shape = 'circle';
            if (shapeSelect) shapeSelect.value = 'circle';
        }
        if (framePresetGroup) {
            framePresetGroup.classList.toggle('vtt-hidden', state.borderStyle !== 'frame');
        }
        render();
    };

    framePresetSelect.onchange = (e) => {
        state.framePreset = e.target.value;
        render();
    };

    borderColorInput.oninput = (e) => {
        state.borderColor = e.target.value;
        render();
    };

    borderWidthSlider.oninput = (e) => {
        state.borderWidth = parseInt(e.target.value) || 3;
        if (borderWidthVal) borderWidthVal.textContent = `${state.borderWidth}px`;
        render();
    };

    // Swatches
    document.querySelectorAll('.token-cropper-swatch').forEach((sw) => {
        sw.onclick = () => {
            const c = sw.dataset.color;
            if (c) {
                state.borderColor = c;
                borderColorInput.value = c;
                render();
            }
        };
    });

    // Preset Buttons: Focus Face, Center, Fit
    document.getElementById('btn-cropper-focus-face').onclick = () => {
        // Move image up so the upper portion (face/head) aligns with center
        state.offsetX = 0;
        state.offsetY = size * 0.18;
        state.scale = Math.max(1.15, state.scale);
        if (zoomSlider) zoomSlider.value = state.scale;
        if (zoomVal) zoomVal.textContent = `${Math.round(state.scale * 100)}%`;
        render();
    };

    document.getElementById('btn-cropper-center').onclick = () => {
        state.offsetX = 0;
        state.offsetY = 0;
        render();
    };

    document.getElementById('btn-cropper-fit').onclick = () => {
        state.offsetX = 0;
        state.offsetY = 0;
        state.scale = 1.0;
        if (zoomSlider) zoomSlider.value = 1.0;
        if (zoomVal) zoomVal.textContent = '100%';
        render();
    };

    // Rotate Buttons
    document.getElementById('btn-cropper-rotate-ccw').onclick = () => {
        state.rotation = (state.rotation - 90 + 360) % 360;
        render();
    };

    document.getElementById('btn-cropper-rotate-cw').onclick = () => {
        state.rotation = (state.rotation + 90) % 360;
        render();
    };

    const cleanup = () => {
        modal.classList.add('vtt-hidden');
        overlay.classList.add('vtt-hidden');
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
    };

    document.getElementById('btn-cropper-cancel').onclick = cleanup;
    document.getElementById('btn-cropper-close').onclick = cleanup;
    overlay.onclick = cleanup;

    // Apply & Save Action
    document.getElementById('btn-cropper-apply').onclick = async () => {
        const btnApply = document.getElementById('btn-cropper-apply');
        const origText = btnApply.innerHTML;
        btnApply.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btnApply.disabled = true;

        try {
            // 1. Bake offscreen 512x512 crisp token
            const bakeCanvas = document.createElement('canvas');
            const bakeSize = 512;
            bakeCanvas.width = bakeSize;
            bakeCanvas.height = bakeSize;
            const bCtx = bakeCanvas.getContext('2d');

            const bcx = bakeSize / 2;
            const bcy = bakeSize / 2;
            const bFrameRadius = bakeSize / 2;
            const previewFrameRadius = (canvas.width || 360) * 0.44;
            const bakeScaleRatio = bakeSize / (previewFrameRadius * 2);

            // Clip to active token shape
            bCtx.save();
            traceTokenCanvasPath(bCtx, bcx, bcy, bFrameRadius, state.shape);
            bCtx.clip();

            if (state.imgLoaded) {
                bCtx.translate(bcx + state.offsetX * bakeScaleRatio, bcy + state.offsetY * bakeScaleRatio);
                if (state.rotation) {
                    bCtx.rotate((state.rotation * Math.PI) / 180);
                }
                bCtx.scale(state.scale * bakeScaleRatio, state.scale * bakeScaleRatio);

                const naturalW = state.img.naturalWidth || 100;
                const naturalH = state.img.naturalHeight || 100;
                const baseDim = bakeSize;
                let drawW, drawH;
                if (naturalW >= naturalH) {
                    drawH = baseDim;
                    drawW = (naturalW / naturalH) * baseDim;
                } else {
                    drawW = baseDim;
                    drawH = (naturalH / naturalW) * baseDim;
                }

                bCtx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
            }
            bCtx.restore();

            // Convert to Blob and upload as clean token asset
            const blob = await new Promise((resolve) => bakeCanvas.toBlob(resolve, 'image/png'));
            let finalTokenUrl = state.sourceUrl;

            if (blob) {
                const formData = new FormData();
                const safeName = (tokenName || 'token').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
                formData.append('file', blob, `${safeName}_token_${Date.now()}.png`);

                const authHeaders =
                    typeof window !== 'undefined' && typeof window.vttAuthHeaders === 'function'
                        ? window.vttAuthHeaders()
                        : window.VTT?.gmSessionToken
                          ? { 'x-gm-token': window.VTT.gmSessionToken }
                          : {};

                try {
                    const res = await fetch('/api/assets/upload', {
                        method: 'POST',
                        headers: authHeaders,
                        body: formData
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.url) finalTokenUrl = data.url;
                    } else {
                        console.warn(
                            'Token Cropper: Upload failed with status',
                            res.status,
                            'falling back to data URL'
                        );
                        finalTokenUrl = bakeCanvas.toDataURL('image/png');
                    }
                } catch (e) {
                    console.warn('Token Cropper: Upload failed, falling back to data URL', e);
                    finalTokenUrl = bakeCanvas.toDataURL('image/png');
                }
            }

            const framingMeta = {
                scale: state.scale,
                offsetX: state.offsetX,
                offsetY: state.offsetY,
                rotation: state.rotation,
                originalUrl: state.sourceUrl
            };

            const borderMeta = {
                shape: state.shape,
                style: state.borderStyle,
                framePreset: state.framePreset,
                color: state.borderColor,
                width: state.borderWidth
            };

            onSave({
                url: finalTokenUrl,
                originalUrl: state.sourceUrl,
                framing: framingMeta,
                border: borderMeta
            });

            cleanup();
        } catch (err) {
            alert('Failed to crop token: ' + err.message);
        } finally {
            btnApply.innerHTML = origText;
            btnApply.disabled = false;
        }
    };

    modal.classList.remove('vtt-hidden');
    overlay.classList.remove('vtt-hidden');
    render();
}

function ensureCropperModalExists() {
    if (document.getElementById('modal-token-cropper')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div id="modal-token-cropper-overlay" class="vtt-sheet-submodal-overlay vtt-hidden" style="z-index: 10050;"></div>
        <div id="modal-token-cropper" class="vtt-modal vtt-hidden glassmorphism" style="z-index: 10051; max-width: 680px; width: 92vw; padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1px solid var(--color-border-subtle);">
            <!-- Header -->
            <div style="padding: 14px 18px; border-bottom: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3);">
                <h3 style="margin: 0; color: var(--color-gold-base); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-crop"></i> Token Cropper & Framing Studio
                </h3>
                <button type="button" id="btn-cropper-close" style="background: none; border: none; color: var(--color-text-muted); font-size: 1.2rem; cursor: pointer;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Body: Left Canvas & Right Controls -->
            <div style="display: flex; flex-wrap: wrap; padding: 16px; gap: 16px; overflow-y: auto; max-height: calc(85vh - 120px);">
                <!-- Left: Canvas Viewport -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; min-width: 280px;">
                    <div style="position: relative; width: 360px; height: 360px; max-width: 100%; aspect-ratio: 1/1; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border-subtle); box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                        <canvas id="token-cropper-canvas" style="width: 100%; height: 100%; cursor: grab; display: block; touch-action: none;"></canvas>
                        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.75); color: #ccc; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; pointer-events: none;">
                            <i class="fa-solid fa-arrows-up-down-left-right"></i> Drag to pan · Scroll to zoom
                        </div>
                    </div>

                    <!-- Alignment Presets & Rotation -->
                    <div style="display: flex; gap: 6px; width: 100%; max-width: 360px;">
                        <button type="button" id="btn-cropper-focus-face" class="btn btn-secondary btn-xs" style="flex: 1;" title="Center character face in upper frame">
                            <i class="fa-solid fa-user"></i> Focus Face
                        </button>
                        <button type="button" id="btn-cropper-center" class="btn btn-secondary btn-xs" style="flex: 1;">
                            <i class="fa-solid fa-crosshairs"></i> Center
                        </button>
                        <button type="button" id="btn-cropper-fit" class="btn btn-secondary btn-xs" style="flex: 1;">
                            <i class="fa-solid fa-compress"></i> Fit
                        </button>
                        <button type="button" id="btn-cropper-rotate-ccw" class="btn btn-secondary btn-xs" style="padding: 4px 8px;" title="Rotate 90° Counter-Clockwise">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        <button type="button" id="btn-cropper-rotate-cw" class="btn btn-secondary btn-xs" style="padding: 4px 8px;" title="Rotate 90° Clockwise">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Right: Framing & Border Controls -->
                <div style="flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 12px;">
                    <!-- Zoom Slider -->
                    <div class="form-group" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-size: 0.8rem; font-weight: bold; margin: 0;">Zoom Level</label>
                            <span id="token-cropper-zoom-val" style="font-family: monospace; font-size: 0.8rem; color: var(--color-gold-base);">100%</span>
                        </div>
                        <input type="range" id="token-cropper-zoom" min="0.4" max="4.0" step="0.05" value="1.0" style="width: 100%; cursor: pointer;">
                    </div>

                    <!-- Border Shape -->
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block;">Token Shape</label>
                        <select id="token-cropper-shape" style="width: 100%; font-size: 0.85rem; padding: 6px 8px;">
                            <option value="circle">Circle (Standard Round)</option>
                            <option value="squircle">Squircle (Rounded Square)</option>
                            <option value="square">Square (Grid Aligned)</option>
                            <option value="hexagon">Hexagon (Tactical / Sci-Fi)</option>
                            <option value="octagon">Octagon (Fortified / Boss)</option>
                            <option value="shield">Shield (Knight / Crest)</option>
                        </select>
                    </div>

                    <!-- Border Style -->
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block;">Border Style</label>
                        <select id="token-cropper-border-style" style="width: 100%; font-size: 0.85rem; padding: 6px 8px;">
                            <option value="solid">Solid Line</option>
                            <option value="double">Double Ring</option>
                            <option value="dashed">Dashed Line</option>
                            <option value="glow">Neon Glow</option>
                            <option value="frame">Thematic Fantasy Frame</option>
                            <option value="none">Borderless</option>
                        </select>
                    </div>

                    <!-- Thematic Frame Presets (Conditional) -->
                    <div id="token-cropper-frame-preset-group" class="form-group vtt-hidden" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block; color: var(--color-gold-base);">Thematic Frame Preset</label>
                        <select id="token-cropper-frame-preset" style="width: 100%; font-size: 0.85rem; padding: 6px 8px;">
                            <option value="ornate_gold">✨ Ornate Gold Filigree</option>
                            <option value="silver_mithral">🛡️ Mithral Silver Ring</option>
                            <option value="gothic_iron">⛓️ Gothic Spiked Iron</option>
                            <option value="arcane_runic">🔮 Glowing Arcane Runes</option>
                            <option value="legendary_crown">👑 Legendary Boss Crown</option>
                        </select>
                    </div>

                    <!-- Border Color & Quick Swatches -->
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; display: block;">Border Color</label>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="color" id="token-cropper-border-color" value="#007bff" style="width: 40px; height: 32px; border: 1px solid var(--color-border-subtle); border-radius: 4px; cursor: pointer; background: none; padding: 0;">
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <button type="button" class="token-cropper-swatch" data-color="#007bff" style="width: 22px; height: 22px; border-radius: 50%; background: #007bff; border: 1px solid #fff; cursor: pointer;" title="Player Blue"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#dc3545" style="width: 22px; height: 22px; border-radius: 50%; background: #dc3545; border: 1px solid #fff; cursor: pointer;" title="Hostile Red"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#eab308" style="width: 22px; height: 22px; border-radius: 50%; background: #eab308; border: 1px solid #fff; cursor: pointer;" title="Neutral Yellow"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#22c55e" style="width: 22px; height: 22px; border-radius: 50%; background: #22c55e; border: 1px solid #fff; cursor: pointer;" title="Friendly Green"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#d4af37" style="width: 22px; height: 22px; border-radius: 50%; background: #d4af37; border: 1px solid #fff; cursor: pointer;" title="Gold"></button>
                                <button type="button" class="token-cropper-swatch" data-color="#a855f7" style="width: 22px; height: 22px; border-radius: 50%; background: #a855f7; border: 1px solid #fff; cursor: pointer;" title="Purple"></button>
                            </div>
                        </div>
                    </div>

                    <!-- Border Width Slider -->
                    <div class="form-group" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-size: 0.8rem; font-weight: bold; margin: 0;">Border Thickness</label>
                            <span id="token-cropper-border-width-val" style="font-family: monospace; font-size: 0.8rem; color: var(--color-gold-base);">3px</span>
                        </div>
                        <input type="range" id="token-cropper-border-width" min="1" max="8" step="1" value="3" style="width: 100%; cursor: pointer;">
                    </div>
                </div>
            </div>

            <!-- Footer Buttons -->
            <div style="padding: 12px 18px; border-top: 1px solid var(--color-border-subtle); background: rgba(0,0,0,0.3); display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" id="btn-cropper-cancel" class="btn btn-secondary">Cancel</button>
                <button type="button" id="btn-cropper-apply" class="btn btn-primary" style="display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-check"></i> Apply & Save Token
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);
}
