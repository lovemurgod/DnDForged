/**
 * ForgeD VTT - Sheet Window Manager & Inter-Tab Synchronization
 * Handles popping out sheets into separate tabs/windows, smart focus switching,
 * lifecycle tracking, heartbeats with 3s TTL, and re-docking signals.
 */

class SheetWindowManagerClass {
    constructor() {
        this.channel = null;
        this.openWindows = new Map(); // sheetKey -> windowProxy
        this.remoteActiveSheets = new Map(); // sheetKey -> timestamp last seen (TTL 3000ms)
        this.dockCallbacks = [];
        this.isStandalone = false;
        this.currentSheetKey = null;
        this.heartbeatTimer = null;

        this.initChannel();
    }

    initChannel() {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.channel = new BroadcastChannel('forgedvtt_sheet_sync');
                this.channel.onmessage = (event) => this.handleBroadcastMessage(event.data);
            } catch (e) {
                console.warn('[SheetWindowManager] BroadcastChannel not supported or failed:', e);
            }
        }

        // Periodically ping to verify which windows are still alive
        if (typeof window !== 'undefined') {
            setInterval(() => this.cleanStaleSheets(), 2000);
        }
    }

    handleBroadcastMessage(data) {
        if (!data || !data.action) return;

        switch (data.action) {
            case 'SHEET_OPENED':
            case 'HEARTBEAT_PULSE':
            case 'HEARTBEAT_PONG':
                if (data.sheetKey) {
                    this.remoteActiveSheets.set(data.sheetKey, Date.now());
                }
                break;

            case 'SHEET_CLOSED':
                if (data.sheetKey) {
                    this.remoteActiveSheets.delete(data.sheetKey);
                    this.openWindows.delete(data.sheetKey);
                }
                break;

            case 'HEARTBEAT_PING':
                // If this window is a standalone sheet, reply with PONG
                if (this.isStandalone && this.currentSheetKey) {
                    this.broadcast({
                        action: 'HEARTBEAT_PONG',
                        sheetKey: this.currentSheetKey
                    });
                }
                break;

            case 'FOCUS_SHEET':
                if (this.isStandalone && data.sheetKey === this.currentSheetKey) {
                    this.highlightWindow();
                }
                break;

            case 'DOCK_SHEET':
                if (!this.isStandalone && data.sheetData) {
                    this.remoteActiveSheets.delete(data.sheetKey);
                    this.openWindows.delete(data.sheetKey);
                    this.dockCallbacks.forEach(cb => cb(data.sheetData));
                }
                break;
        }
    }

    broadcast(message) {
        if (this.channel) {
            try {
                this.channel.postMessage(message);
            } catch (e) {
                console.warn('[SheetWindowManager] Broadcast error:', e);
            }
        }
    }

    cleanStaleSheets() {
        const now = Date.now();
        for (const [key, ts] of this.remoteActiveSheets.entries()) {
            if (now - ts > 3000) {
                this.remoteActiveSheets.delete(key);
            }
        }
        // Also ping active sheets
        this.broadcast({ action: 'HEARTBEAT_PING' });
    }

    /**
     * Generate standard deterministic sheet key
     */
    getSheetKey(type, idOrName) {
        const cleanType = String(type || 'sheet').toLowerCase().trim();
        const cleanId = String(idOrName || 'unknown').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
        return `forgedvtt_${cleanType}_${cleanId}`;
    }

    /**
     * Check whether a sheet is already popped out in another tab/window
     */
    isSheetPoppedOut(sheetKey) {
        // 1. Check local window handle in this browsing context
        const win = this.openWindows.get(sheetKey);
        if (win && !win.closed) {
            return true;
        } else if (win && win.closed) {
            this.openWindows.delete(sheetKey);
            this.remoteActiveSheets.delete(sheetKey);
        }

        // 2. Check remote active sheet heartbeat timestamp (TTL 3 seconds)
        const lastSeen = this.remoteActiveSheets.get(sheetKey);
        if (lastSeen && (Date.now() - lastSeen < 3000)) {
            return true;
        } else if (lastSeen) {
            this.remoteActiveSheets.delete(sheetKey);
        }

        return false;
    }

    /**
     * Focus an already popped-out sheet tab or window
     */
    focusPoppedOut(sheetKey) {
        // Try local window handle first
        const win = this.openWindows.get(sheetKey);
        if (win && !win.closed) {
            try {
                win.focus();
            } catch (e) {}
        }

        // Also broadcast focus action so the tab can visually flash/glow and focus itself
        this.broadcast({
            action: 'FOCUS_SHEET',
            sheetKey: sheetKey
        });
    }

    /**
     * Open a sheet in a popout tab/window
     */
    openPopout(options) {
        const {
            type, // 'player', 'creature', 'companion', 'npc', 'bestiary'
            id,
            name,
            source,
            tokenId,
            characterId,
            monsterData
        } = options;

        const keyId = id || tokenId || characterId || (name ? `${name}_${source || ''}` : Date.now());
        const sheetKey = this.getSheetKey(type, keyId);

        // If already open, switch to it!
        if (this.isSheetPoppedOut(sheetKey)) {
            this.focusPoppedOut(sheetKey);
            return true;
        }

        // Build URL parameters
        const params = new URLSearchParams();
        params.set('type', type);
        if (id) params.set('id', id);
        if (tokenId) params.set('tokenId', tokenId);
        if (characterId) params.set('characterId', characterId);
        if (name) params.set('name', name);
        if (source) params.set('source', source);

        // Pass active campaign, username, and role
        const campaignId = (window.VTT && window.VTT.campaignId) || localStorage.getItem('vtt_campaign') || 'default';
        const username = (window.VTT && window.VTT.username) || localStorage.getItem('vtt_username') || 'Game Master';
        const role = (window.VTT && window.VTT.role) || localStorage.getItem('vtt_role') || 'GM';
        params.set('campaign', campaignId);
        params.set('username', username);
        params.set('role', role);

        // If monsterData is provided, cache it in localStorage for instant 0ms rendering in popout window
        if (monsterData) {
            try {
                const tempStorageKey = `forgedvtt_popout_data_${sheetKey}`;
                sessionStorage.setItem(tempStorageKey, JSON.stringify(monsterData));
                localStorage.setItem(tempStorageKey, JSON.stringify(monsterData));
                params.set('dataKey', tempStorageKey);
            } catch (e) {
                console.warn('[SheetWindowManager] Could not store monsterData in storage:', e);
            }
        }

        const url = `sheet.html?${params.toString()}`;
        const windowTarget = sheetKey;

        // Calculate window dimensions and centered position
        const width = 880;
        const height = 960;
        const left = Math.max(0, (window.screen.availWidth - width) / 2);
        const top = Math.max(0, (window.screen.availHeight - height) / 2);
        const windowFeatures = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`;

        const newWin = window.open(url, windowTarget, windowFeatures);
        if (newWin) {
            try {
                newWin.focus();
            } catch (e) {}
            this.openWindows.set(sheetKey, newWin);
            this.remoteActiveSheets.set(sheetKey, Date.now());
            this.broadcast({
                action: 'SHEET_OPENED',
                sheetKey: sheetKey
            });
            return true;
        } else {
            console.warn('[SheetWindowManager] Popup blocked or failed to open.');
            return false;
        }
    }

    /**
     * Mark this current window as a standalone sheet instance
     */
    registerStandalone(sheetKey, sheetData) {
        this.isStandalone = true;
        this.currentSheetKey = sheetKey;
        this.sheetData = sheetData;

        this.broadcast({
            action: 'SHEET_OPENED',
            sheetKey: sheetKey
        });

        // Continuous heartbeat pulse every 1.5s
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            this.broadcast({
                action: 'HEARTBEAT_PULSE',
                sheetKey: sheetKey
            });
        }, 1500);

        const notifyClose = () => {
            this.broadcast({
                action: 'SHEET_CLOSED',
                sheetKey: sheetKey
            });
        };

        window.addEventListener('beforeunload', notifyClose);
        window.addEventListener('unload', notifyClose);
        window.addEventListener('pagehide', notifyClose);
    }

    /**
     * Trigger re-docking back into the main tabletop
     */
    dockBackToMain() {
        if (!this.isStandalone || !this.currentSheetKey) return;

        this.broadcast({
            action: 'DOCK_SHEET',
            sheetKey: this.currentSheetKey,
            sheetData: this.sheetData
        });

        // Close this window after docking signal
        setTimeout(() => {
            window.close();
        }, 100);
    }

    /**
     * Visual pulse when window receives focus signal
     */
    highlightWindow() {
        try {
            window.focus();
        } catch (e) {}

        const el = document.body;
        if (el) {
            el.classList.remove('sheet-focus-pulse');
            void el.offsetWidth; // trigger reflow
            el.classList.add('sheet-focus-pulse');
            setTimeout(() => el.classList.remove('sheet-focus-pulse'), 1500);
        }
    }

    /**
     * Register a callback in the main VTT to handle docking a sheet back
     */
    onDock(callback) {
        this.dockCallbacks.push(callback);
    }
}

export const SheetWindowManager = new SheetWindowManagerClass();
if (typeof window !== 'undefined') {
    window.SheetWindowManager = SheetWindowManager;
}
