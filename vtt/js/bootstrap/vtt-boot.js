/**
 * vtt-boot.js
 * Master Client Bootstrapper for ForgeDVTT.
 * Orchestrates global security initialization, concurrent module preloading,
 * authentication, resilient socket sessions, and tabletop UI lifecycle.
 */

import { initVttGlobals } from './vtt-globals.js';
import '../vtt-utils.js';
import '../vtt-event-bus.js';
import { setupLoginHandlers } from './vtt-auth.js';
import { preloadVttModules, startSocketConnection, setupAllowlistGlobals } from './vtt-session.js';
import { updateTabletopPauseUI, setupPauseAndXCardControls } from './vtt-pause.js';
import { setupSidebarTabs, setupUniversalModalDismissal } from './vtt-modals.js';

// 1. Initialize global configurations and security sanitizers
initVttGlobals();
setupAllowlistGlobals();

// 2. Preload modules concurrently and boot themes engine early
export const moduleInitPromise = preloadVttModules();
moduleInitPromise
    .then((mods) => {
        if (typeof window !== 'undefined' && mods.initVttThemes && !window.VTT?.themesEngine) {
            window.VTT.themesEngine = mods.initVttThemes(window.VTT);
        }
    })
    .catch((err) => console.error('Themes early boot error:', err));

// 3. Initialize UI event handlers and login gateway
setupLoginHandlers({
    onStartSocketConnection: (campaignId, username, role, gmPassword) => {
        startSocketConnection(campaignId, username, role, gmPassword, {
            moduleInitPromise,
            updateTabletopPauseUI
        });
    }
});

setupSidebarTabs();
setupUniversalModalDismissal();
setupPauseAndXCardControls();
