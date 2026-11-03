import { app, BrowserWindow } from 'electron';

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        show: false,
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'ephemeral-' + Date.now()
        }
    });
    await win.webContents.session.clearCache();

    const consoleLogs = [];
    win.webContents.on('console-message', (e, level, msg, line, sourceId) => {
        const str = `[CONSOLE ${level}] ${msg} (${sourceId}:${line})`;
        consoleLogs.push(str);
        if (level >= 2 || msg.toLowerCase().includes('error')) {
            console.log(str);
        }
    });

    try {
        await win.loadURL('http://localhost:5050/vtt.html');
        await new Promise((r) => setTimeout(r, 2000));

        // Join as GM
        await win.webContents.executeJavaScript(`
            if (document.getElementById('login-role')) document.getElementById('login-role').value = 'GM';
            if (document.getElementById('login-username')) document.getElementById('login-username').value = 'GMCosmic';
            document.getElementById('btn-join-game').click();
        `);

        await new Promise((r) => setTimeout(r, 3000));

        const results = await win.webContents.executeJavaScript(`
            (() => {
                const ce = window.VTT.canvasEngine;
                const canvasInteraction = document.getElementById('vtt-canvas-interaction');
                const viewport = document.getElementById('vtt-canvas-viewport');
                const vRect = viewport.getBoundingClientRect();
                const curPan = ce.getPan();
                const curZoom = ce.getZoom();

                const report = {};

                // --- TEST 1: Token Selection & Dragging ---
                // Find Acererak (x=1250, y=850) -> on screen: clientX = 1275 * zoom + vRect.left + panX
                const tokens = ce.getTokens();
                const acererak = Object.values(tokens).find(t => t.name === 'Acererak');
                if (acererak) {
                    const initialX = acererak.x;
                    const initialY = acererak.y;
                    const startClientX = (acererak.x + 25) * curZoom + vRect.left + curPan.panX;
                    const startClientY = (acererak.y + 25) * curZoom + vRect.top + curPan.panY;

                    // 1a. Click
                    canvasInteraction.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        clientX: startClientX,
                        clientY: startClientY,
                        button: 0
                    }));
                    report.selectedOnMouseDown = ce.getSelectedTokenIds().includes(acererak.id);

                    // 1b. Drag by 100px
                    const dragClientX = startClientX + 100;
                    const dragClientY = startClientY + 100;
                    window.dispatchEvent(new MouseEvent('mousemove', {
                        bubbles: true,
                        clientX: dragClientX,
                        clientY: dragClientY,
                        button: 0
                    }));
                    report.acererakPosDuringDrag = { x: tokens[acererak.id].x, y: tokens[acererak.id].y };

                    // 1c. MouseUp (drop)
                    window.dispatchEvent(new MouseEvent('mouseup', {
                        bubbles: true,
                        clientX: dragClientX,
                        clientY: dragClientY,
                        button: 0
                    }));
                    report.acererakPosAfterDrop = { x: tokens[acererak.id].x, y: tokens[acererak.id].y };
                    report.tokenDragMoved = report.acererakPosAfterDrop.x !== initialX || report.acererakPosAfterDrop.y !== initialY;
                }

                // --- TEST 2: Right-Click Canvas Panning ---
                const panStartPan = ce.getPan();
                const panStartX = vRect.left + 500;
                const panStartY = vRect.top + 500;

                canvasInteraction.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true,
                    clientX: panStartX,
                    clientY: panStartY,
                    button: 2
                }));
                window.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true,
                    clientX: panStartX + 80,
                    clientY: panStartY + 60,
                    button: 2
                }));
                window.dispatchEvent(new MouseEvent('mouseup', {
                    bubbles: true,
                    clientX: panStartX + 80,
                    clientY: panStartY + 60,
                    button: 2
                }));
                const panEndPan = ce.getPan();
                report.panDelta = {
                    dx: panEndPan.panX - panStartPan.panX,
                    dy: panEndPan.panY - panStartPan.panY
                };
                report.panSuccess = report.panDelta.dx === 80 && report.panDelta.dy === 60;

                // --- TEST 3: Mouse Wheel Zoom ---
                const zoomBefore = ce.getZoom();
                canvasInteraction.dispatchEvent(new WheelEvent('wheel', {
                    bubbles: true,
                    clientX: vRect.left + 500,
                    clientY: vRect.top + 500,
                    deltaY: -100 // zoom in
                }));
                const zoomAfter = ce.getZoom();
                report.zoomBefore = zoomBefore;
                report.zoomAfter = zoomAfter;
                report.zoomSuccess = zoomAfter > zoomBefore;

                // --- TEST 4: Double Click Token Edit Modal ---
                if (acererak) {
                    const clientX = (tokens[acererak.id].x + 25) * ce.getZoom() + vRect.left + ce.getPan().panX;
                    const clientY = (tokens[acererak.id].y + 25) * ce.getZoom() + vRect.top + ce.getPan().panY;

                    canvasInteraction.dispatchEvent(new MouseEvent('dblclick', {
                        bubbles: true,
                        clientX,
                        clientY,
                        button: 0
                    }));
                    const editModal = document.getElementById('modal-token-edit');
                    report.editModalOpened = editModal && !editModal.classList.contains('vtt-hidden');
                    if (report.editModalOpened) {
                        // close it
                        editModal.classList.add('vtt-hidden');
                    }
                }

                // --- TEST 5: Token Right-Click Context Menu ---
                if (acererak) {
                    const clientX = (tokens[acererak.id].x + 25) * ce.getZoom() + vRect.left + ce.getPan().panX;
                    const clientY = (tokens[acererak.id].y + 25) * ce.getZoom() + vRect.top + ce.getPan().panY;

                    canvasInteraction.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        clientX,
                        clientY,
                        button: 2
                    }));

                    canvasInteraction.dispatchEvent(new MouseEvent('contextmenu', {
                        bubbles: true,
                        clientX,
                        clientY,
                        button: 2
                    }));
                    const ctxMenu = document.getElementById('vtt-token-context-menu');
                    report.tokenContextMenuOpened = ctxMenu && !ctxMenu.classList.contains('vtt-hidden');
                    if (report.tokenContextMenuOpened) {
                        ctxMenu.classList.add('vtt-hidden');
                    }
                }

                // --- TEST 6: Measure Tool ---
                const toolMeasureBtn = document.getElementById('tool-measure');
                if (toolMeasureBtn) {
                    toolMeasureBtn.click();
                    // Click down and drag to measure
                    canvasInteraction.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        clientX: vRect.left + 200,
                        clientY: vRect.top + 200,
                        button: 0
                    }));
                    window.dispatchEvent(new MouseEvent('mousemove', {
                        bubbles: true,
                        clientX: vRect.left + 350,
                        clientY: vRect.top + 350,
                        button: 0
                    }));
                    // Check if measurement indicator or label is visible
                    const measureLabel = document.getElementById('vtt-measure-hud') || document.querySelector('.measure-indicator');
                    report.measureActive = ce.isMeasuring ? ce.isMeasuring() : 'no isMeasuring';
                    window.dispatchEvent(new MouseEvent('mouseup', {
                        bubbles: true,
                        clientX: vRect.left + 350,
                        clientY: vRect.top + 350,
                        button: 0
                    }));
                    // switch back to select
                    document.getElementById('tool-select')?.click();
                }

                // --- TEST 7: Bestiary Drag-and-Drop ---
                // Check if dragover/drop handlers exist on canvasInteraction
                const dt = new DataTransfer();
                dt.setData('text/plain', JSON.stringify({
                    type: 'bestiary',
                    name: 'Goblin',
                    size: 1,
                    hp: 7,
                    maxHp: 7,
                    img: 'img/tokens/goblin.png',
                    monsterData: { name: 'Goblin' }
                }));

                const dragOverEvt = new DragEvent('dragover', {
                    bubbles: true,
                    cancelable: true,
                    clientX: vRect.left + 500,
                    clientY: vRect.top + 500,
                    dataTransfer: dt
                });
                const defaultPreventedOnDragOver = !canvasInteraction.dispatchEvent(dragOverEvt);
                report.dragOverAccepted = defaultPreventedOnDragOver;

                const dropEvt = new DragEvent('drop', {
                    bubbles: true,
                    cancelable: true,
                    clientX: vRect.left + 500,
                    clientY: vRect.top + 500,
                    dataTransfer: dt
                });
                const tokensCountBefore = Object.keys(ce.getTokens()).length;
                canvasInteraction.dispatchEvent(dropEvt);
                const tokensCountAfter = Object.keys(ce.getTokens()).length;
                report.tokenSpawnedFromDrop = tokensCountAfter > tokensCountBefore;

                return report;
            })()
        `);

        console.log('=== FULL INTERACTION TEST RESULTS ===');
        console.log(JSON.stringify(results, null, 2));

        const errors = [];
        if (!results.selectedOnMouseDown) errors.push('Failed: Token was not selected on mousedown');
        if (!results.tokenDragMoved) errors.push('Failed: Token position did not change during drag');
        if (!results.panSuccess) errors.push('Failed: Canvas pan delta did not match mouse movement');
        if (!results.zoomSuccess) errors.push('Failed: Canvas zoom did not change on wheel');
        if (!results.editModalOpened) errors.push('Failed: Double-click token edit modal did not open');
        if (!results.tokenContextMenuOpened) errors.push('Failed: Right-click token context menu did not open');
        if (!results.tokenSpawnedFromDrop) errors.push('Failed: Monster token did not spawn from bestiary drop');

        if (errors.length > 0) {
            console.error('\nE2E Failures:\n' + errors.join('\n'));
            process.exitCode = 1;
        } else {
            console.log('\n✓ All 7 Live Electron Canvas Interactions Passed with 0 Failures!');
            process.exitCode = 0;
        }
    } catch (err) {
        console.error('Test error:', err);
        process.exitCode = 1;
    } finally {
        app.quit();
    }
});
