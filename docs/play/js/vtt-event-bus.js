// DnDForged VTT Unified Pub/Sub Event Bus
// Decouples cross-module communication from ambient window.* globals with namespaced topics

/**
 * Lightweight, typed pub/sub event bus supporting once, wildcard, and isolated handler dispatch.
 */
export class VttEventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.listeners = new Map();
    }

    /**
     * Subscribes a listener to an event topic.
     * @param {string} event - Event topic (e.g. 'token:update', 'layer:change')
     * @param {Function} handler - Callback function invoked on event emission
     * @returns {Function} Unsubscribe function
     */
    on(event, handler) {
        if (!event || typeof handler !== 'function') {
            return () => {};
        }
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    /**
     * Unsubscribes a listener from an event topic.
     * @param {string} event - Event topic
     * @param {Function} handler - Callback function to remove
     * @returns {boolean} True if handler was found and removed
     */
    off(event, handler) {
        if (!event || !this.listeners.has(event)) {
            return false;
        }
        const set = this.listeners.get(event);
        const removed = set.delete(handler);
        if (set.size === 0) {
            this.listeners.delete(event);
        }
        return removed;
    }

    /**
     * Subscribes a listener that will only be invoked once.
     * @param {string} event - Event topic
     * @param {Function} handler - Callback function
     * @returns {Function} Unsubscribe function
     */
    once(event, handler) {
        if (!event || typeof handler !== 'function') {
            return () => {};
        }
        const wrapper = (...args) => {
            this.off(event, wrapper);
            handler(...args);
        };
        return this.on(event, wrapper);
    }

    /**
     * Dispatches an event to all subscribed listeners with error boundary isolation.
     * @param {string} event - Event topic to dispatch
     * @param {*} [data] - Event payload
     * @returns {number} Number of listeners successfully notified
     */
    emit(event, data) {
        if (!event) return 0;
        let notified = 0;

        // Exact topic listeners
        const exactSet = this.listeners.get(event);
        if (exactSet && exactSet.size > 0) {
            const handlers = [...exactSet];
            for (const handler of handlers) {
                try {
                    handler(data);
                    notified++;
                } catch (err) {
                    console.error(`[VttEventBus] Error in listener for '${event}':`, err);
                }
            }
        }

        // Wildcard prefix listeners (e.g. 'token:*' listens to 'token:update')
        const colonIdx = event.indexOf(':');
        if (colonIdx > 0) {
            const wildcardTopic = event.substring(0, colonIdx) + ':*';
            const wildcardSet = this.listeners.get(wildcardTopic);
            if (wildcardSet && wildcardSet.size > 0) {
                const handlers = [...wildcardSet];
                for (const handler of handlers) {
                    try {
                        handler(data, event);
                        notified++;
                    } catch (err) {
                        console.error(`[VttEventBus] Error in wildcard listener for '${wildcardTopic}':`, err);
                    }
                }
            }
        }

        // Global wildcard listeners ('*')
        const allWildcardSet = this.listeners.get('*');
        if (allWildcardSet && allWildcardSet.size > 0) {
            const handlers = [...allWildcardSet];
            for (const handler of handlers) {
                try {
                    handler(data, event);
                    notified++;
                } catch (err) {
                    console.error(`[VttEventBus] Error in global wildcard listener:`, err);
                }
            }
        }

        return notified;
    }

    /**
     * Gets the number of active listeners for a topic.
     * @param {string} [event] - Event topic (if omitted, returns total count across all topics)
     * @returns {number}
     */
    listenerCount(event) {
        if (event) {
            return this.listeners.get(event)?.size || 0;
        }
        let total = 0;
        for (const set of this.listeners.values()) {
            total += set.size;
        }
        return total;
    }

    /**
     * Clears listeners for a specific event topic or all topics.
     * @param {string} [event] - Event topic to clear
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Global Singleton Instance
export const vttEventBus = new VttEventBus();

// Browser Global Facade for Backward Compatibility
if (typeof window !== 'undefined') {
    window.VTT = window.VTT || {};
    window.VTT.eventBus = vttEventBus;

    // Backward-compatible global shims
    if (!window.emitTokenUpdates) {
        window.emitTokenUpdates = (data) => vttEventBus.emit('token:update', data);
    }
    if (!window.switchActiveLayer) {
        window.switchActiveLayer = (layer) => vttEventBus.emit('layer:change', layer);
    }
    if (!window.showToast) {
        window.showToast = (msg, type = 'info') => vttEventBus.emit('toast:show', { msg, type });
    }
}
