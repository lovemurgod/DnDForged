// DnDForged Grid Rendering & Mathematical Snapping Engine
// Handles square/hexadecimal grid line rendering, cell center/vertex snapping, and tile caching

export function isHexGrid(type) {
    return ['hex-v', 'hex-h', 'hex-v-even', 'hex-h-even'].includes(type);
}

export function getNearestHexFeatures(x, y, grid = {}, unitSize = 50) {
    const type = grid.type || 'square';
    const offsetX = grid.offsetX || 0;
    const offsetY = grid.offsetY || 0;
    const isVert = type === 'hex-v' || type === 'hex-v-even';
    const isEven = type === 'hex-v-even' || type === 'hex-h-even';
    const R = unitSize / Math.sqrt(3);

    let bestDistCenter = Infinity;
    let bestCx = x,
        bestCy = y;

    let bestDistVertex = Infinity;
    let bestVx = x,
        bestVy = y;

    const checkHex = (cx, cy) => {
        const cDist = (cx - x) ** 2 + (cy - y) ** 2;
        if (cDist < bestDistCenter) {
            bestDistCenter = cDist;
            bestCx = cx;
            bestCy = cy;
        }
        for (let i = 0; i < 6; i++) {
            const angle_deg = isVert ? 60 * i - 30 : 60 * i;
            const angle_rad = (Math.PI / 180) * angle_deg;
            const vx = cx + R * Math.cos(angle_rad);
            const vy = cy + R * Math.sin(angle_rad);
            const vDist = (vx - x) ** 2 + (vy - y) ** 2;
            if (vDist < bestDistVertex) {
                bestDistVertex = vDist;
                bestVx = vx;
                bestVy = vy;
            }
        }
    };

    if (isVert) {
        const W = Math.sqrt(3) * R;
        const ySpacing = 1.5 * R;
        const estC = Math.round((x - offsetX) / W);
        const estR = Math.round((y - offsetY) / ySpacing);
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const r = estR + dr;
                const c = estC + dc;
                const isShifted = isEven ? Math.abs(r) % 2 === 0 : Math.abs(r) % 2 === 1;
                const cx = offsetX + c * W + (isShifted ? W / 2 : 0);
                const cy = offsetY + r * ySpacing;
                checkHex(cx, cy);
            }
        }
    } else {
        const H = Math.sqrt(3) * R;
        const xSpacing = 1.5 * R;
        const estC = Math.round((x - offsetX) / xSpacing);
        const estR = Math.round((y - offsetY) / H);
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const r = estR + dr;
                const c = estC + dc;
                const isShifted = isEven ? Math.abs(c) % 2 === 0 : Math.abs(c) % 2 === 1;
                const cx = offsetX + c * xSpacing;
                const cy = offsetY + r * H + (isShifted ? H / 2 : 0);
                checkHex(cx, cy);
            }
        }
    }
    return { cx: bestCx, cy: bestCy, vx: bestVx, vy: bestVy };
}

export function snapToGrid(x, y, arg3 = false, arg4 = {}) {
    let isToken = false;
    let grid = {};
    if (typeof arg3 === 'object' && arg3 !== null) {
        grid = arg3;
        isToken = Boolean(arg4);
    } else {
        isToken = Boolean(arg3);
        grid = typeof arg4 === 'object' && arg4 !== null ? arg4 : {};
    }
    if (!grid || !grid.size) return { x, y };
    const unitSize = (grid.size || 50) * (grid.scale || 1);
    const offsetX = grid.offsetX || 0;
    const offsetY = grid.offsetY || 0;

    if (isHexGrid(grid.type)) {
        let px = x;
        let py = y;
        if (isToken) {
            px += unitSize / 2;
            py += unitSize / 2;
        }
        const hex = getNearestHexFeatures(px, py, grid, unitSize);
        if (isToken) {
            return { x: hex.cx - unitSize / 2, y: hex.cy - unitSize / 2 };
        } else {
            return { x: hex.vx, y: hex.vy };
        }
    }

    return {
        x: Math.round((x - offsetX) / unitSize) * unitSize + offsetX,
        y: Math.round((y - offsetY) / unitSize) * unitSize + offsetY
    };
}

export function snapToGridCenter(x, y, grid = {}) {
    if (!grid || !grid.size) return { x, y };
    const unitSize = (grid.size || 50) * (grid.scale || 1);
    const offsetX = grid.offsetX || 0;
    const offsetY = grid.offsetY || 0;

    if (isHexGrid(grid.type)) {
        const hex = getNearestHexFeatures(x, y, grid, unitSize);
        return { x: hex.cx, y: hex.cy };
    }

    return {
        x: Math.floor((x - offsetX) / unitSize) * unitSize + offsetX + unitSize / 2,
        y: Math.floor((y - offsetY) / unitSize) * unitSize + offsetY + unitSize / 2
    };
}

export function snapToHalfGrid(x, y, grid = {}) {
    if (!grid || !grid.size) return { x, y };
    const unitSize = (grid.size || 50) * (grid.scale || 1);

    if (isHexGrid(grid.type)) {
        const hex = getNearestHexFeatures(x, y, grid, unitSize);
        return { x: hex.cx, y: hex.cy };
    }

    const halfSize = unitSize / 2;
    const offsetX = grid.offsetX || 0;
    const offsetY = grid.offsetY || 0;
    return {
        x: Math.round((x - offsetX) / halfSize) * halfSize + offsetX,
        y: Math.round((y - offsetY) / halfSize) * halfSize + offsetY
    };
}

export function renderGridLayer(canvasGrid, ctxGrid, grid = {}, width, height, state = {}) {
    if (!canvasGrid || !ctxGrid) return;
    const gridKey = `${width}_${height}_${grid.type || 'square'}_${grid.size}_${grid.scale || 1.0}_${grid.offsetX || 0}_${grid.offsetY || 0}_${grid.opacity}_${grid.color || '#888888'}`;
    if (!state.isGridDirty && canvasGrid._lastGridKey === gridKey) {
        return;
    }
    state.isGridDirty = false;
    canvasGrid._lastGridKey = gridKey;

    ctxGrid.clearRect(0, 0, width, height);

    const opacity = grid.opacity !== undefined ? parseFloat(grid.opacity) : 0.3;
    const strokeColor = grid.color || '#888888';

    ctxGrid.strokeStyle = strokeColor;
    ctxGrid.globalAlpha = opacity;
    ctxGrid.lineWidth = 1;

    const size = (grid.size || 50) * (grid.scale || 1.0);
    const offX = grid.offsetX || 0;
    const offY = grid.offsetY || 0;

    if (isHexGrid(grid.type)) {
        const isVert = grid.type === 'hex-v' || grid.type === 'hex-v-even';
        const isEven = grid.type === 'hex-v-even' || grid.type === 'hex-h-even';
        const R = size / Math.sqrt(3);

        ctxGrid.beginPath();
        const drawHex = (cx, cy) => {
            for (let i = 0; i < 6; i++) {
                const angle_deg = isVert ? 60 * i - 30 : 60 * i;
                const angle_rad = (Math.PI / 180) * angle_deg;
                const hx = cx + R * Math.cos(angle_rad);
                const hy = cy + R * Math.sin(angle_rad);
                if (i === 0) ctxGrid.moveTo(hx, hy);
                else ctxGrid.lineTo(hx, hy);
            }
            const firstAngle = isVert ? (-30 * Math.PI) / 180 : 0;
            ctxGrid.lineTo(cx + R * Math.cos(firstAngle), cy + R * Math.sin(firstAngle));
        };

        if (isVert) {
            const W = Math.sqrt(3) * R;
            const ySpacing = 1.5 * R;

            let startCol = Math.floor(-offX / W) - 1;
            let endCol = Math.ceil((width - offX) / W) + 1;
            let startRow = Math.floor(-offY / ySpacing) - 1;
            let endRow = Math.ceil((height - offY) / ySpacing) + 1;

            for (let r = startRow; r <= endRow; r++) {
                const isShifted = isEven ? Math.abs(r) % 2 === 0 : Math.abs(r) % 2 === 1;
                for (let c = startCol; c <= endCol; c++) {
                    const cx = offX + c * W + (isShifted ? W / 2 : 0);
                    const cy = offY + r * ySpacing;
                    drawHex(cx, cy);
                }
            }
        } else {
            const H = Math.sqrt(3) * R;
            const xSpacing = 1.5 * R;

            let startCol = Math.floor(-offX / xSpacing) - 1;
            let endCol = Math.ceil((width - offX) / xSpacing) + 1;
            let startRow = Math.floor(-offY / H) - 1;
            let endRow = Math.ceil((height - offY) / H) + 1;

            for (let c = startCol; c <= endCol; c++) {
                const isShifted = isEven ? Math.abs(c) % 2 === 0 : Math.abs(c) % 2 === 1;
                for (let r = startRow; r <= endRow; r++) {
                    const cx = offX + c * xSpacing;
                    const cy = offY + r * H + (isShifted ? H / 2 : 0);
                    drawHex(cx, cy);
                }
            }
        }
        ctxGrid.stroke();
    } else {
        const patternKey = `${size}_${strokeColor}`;
        if (!canvasGrid._cachedPattern || canvasGrid._cachedPatternKey !== patternKey) {
            if (typeof document !== 'undefined') {
                const offCanvas = document.createElement('canvas');
                offCanvas.width = size;
                offCanvas.height = size;
                const offCtx = offCanvas.getContext('2d');
                offCtx.strokeStyle = strokeColor;
                offCtx.lineWidth = 1;
                offCtx.beginPath();
                offCtx.moveTo(0, 0);
                offCtx.lineTo(size, 0);
                offCtx.moveTo(0, 0);
                offCtx.lineTo(0, size);
                offCtx.stroke();
                canvasGrid._cachedPattern = ctxGrid.createPattern(offCanvas, 'repeat');
                canvasGrid._cachedPatternKey = patternKey;
            }
        }

        if (canvasGrid._cachedPattern) {
            let startX = offX % size;
            if (startX > 0) startX -= size;
            let startY = offY % size;
            if (startY > 0) startY -= size;

            ctxGrid.save();
            ctxGrid.globalAlpha = opacity;
            if (canvasGrid._cachedPattern.setTransform) {
                if (typeof DOMMatrix !== 'undefined') {
                    canvasGrid._cachedPattern.setTransform(new DOMMatrix().translate(startX, startY));
                }
                ctxGrid.fillStyle = canvasGrid._cachedPattern;
                ctxGrid.fillRect(0, 0, width, height);
            } else {
                ctxGrid.translate(startX, startY);
                ctxGrid.fillStyle = canvasGrid._cachedPattern;
                ctxGrid.fillRect(-startX, -startY, width, height);
            }
            ctxGrid.restore();
        } else {
            let startX = offX % size;
            if (startX > 0) startX -= size;
            for (let x = startX; x < width; x += size) {
                ctxGrid.beginPath();
                ctxGrid.moveTo(x, 0);
                ctxGrid.lineTo(x, height);
                ctxGrid.stroke();
            }

            let startY = offY % size;
            if (startY > 0) startY -= size;
            for (let y = startY; y < height; y += size) {
                ctxGrid.beginPath();
                ctxGrid.moveTo(0, y);
                ctxGrid.lineTo(width, y);
                ctxGrid.stroke();
            }
        }
    }

    ctxGrid.globalAlpha = 1.0;
}
