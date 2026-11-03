const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.webContents.on('console-message', (e, level, msg, line, sourceId) => {
        console.log(`[BROWSER CONSOLE] (level ${level}): ${msg} (${sourceId}:${line})`);
    });

    win.webContents.on('render-process-gone', (e, details) => {
        console.error('[RENDER CRASHED]', details);
    });

    win.webContents.on('did-fail-load', (e, code, desc, url) => {
        console.error('[LOAD FAILED]', code, desc, url);
    });

    console.log('Navigating to http://localhost:5050/vtt.html ...');
    try {
        await win.loadURL('http://localhost:5050/vtt.html');
        console.log('Navigation promise resolved.');
    } catch (err) {
        console.error('loadURL error:', err);
    }

    // Wait 3 seconds to let modules load and log
    setTimeout(async () => {
        try {
            const vttState = await win.webContents.executeJavaScript(`
                ({
                    hasVTT: typeof window.VTT !== 'undefined',
                    vttKeys: window.VTT ? Object.keys(window.VTT) : [],
                    loginHidden: document.getElementById('login-overlay')?.classList.contains('vtt-hidden'),
                    workspaceHidden: document.getElementById('vtt-workspace')?.classList.contains('vtt-hidden'),
                    bodyHtmlLength: document.body.innerHTML.length
                })
            `);
            console.log('VTT Inspection Result:', JSON.stringify(vttState, null, 2));

            // Now let's try clicking the "Enter Tabletop" button to simulate logging in!
            console.log('Attempting to click #btn-join-game...');
            const joinResult = await win.webContents.executeJavaScript(`
                (() => {
                    const btn = document.getElementById('btn-join-game');
                    if (btn) {
                        btn.click();
                        return { clicked: true, disabled: btn.disabled };
                    }
                    return { clicked: false, notFound: true };
                })()
            `);
            console.log('Join click result:', joinResult);

            // Wait another 4 seconds to observe socket join and module loading
            setTimeout(async () => {
                const postJoinState = await win.webContents.executeJavaScript(`
                    ({
                        hasVTT: typeof window.VTT !== 'undefined',
                        role: window.VTT?.role,
                        modulesInitialized: window.VTT?._modulesInitialized,
                        hasCanvas: !!window.VTT?.canvasEngine,
                        hasChat: !!window.VTT?.chatEngine,
                        hasPlayerSheet: !!window.VTT?.playerSheet,
                        hasCreatureSheet: !!window.VTT?.creatureSheet,
                        loginHidden: document.getElementById('login-overlay')?.classList.contains('vtt-hidden'),
                        workspaceHidden: document.getElementById('vtt-workspace')?.classList.contains('vtt-hidden'),
                        bannerError: document.getElementById('login-error-text')?.textContent || null
                    })
                `);
                console.log('Post Join State:', JSON.stringify(postJoinState, null, 2));
                app.quit();
            }, 4000);

        } catch (e) {
            console.error('Eval error:', e);
            app.quit();
        }
    }, 3000);
});

