// DnDForged Canvas Bounded LRU Image & Texture Cache
// Prevents memory creep by bounding image allocations and sweeping stale map assets on map switches

export function createImageCache(options = {}) {
    const maxEntries = options.maxEntries || 150;
    const cache = new Map();
    let hits = 0;
    let misses = 0;
    let evictions = 0;

    function get(url) {
        if (!url || !cache.has(url)) {
            misses++;
            return null;
        }
        hits++;
        const item = cache.get(url);
        // Move to most-recently used position
        cache.delete(url);
        cache.set(url, item);
        return item;
    }

    function set(url, img) {
        if (!url || !img) return;
        if (cache.has(url)) {
            cache.delete(url);
        } else if (cache.size >= maxEntries) {
            // Evict oldest entry (first item in Map)
            const oldestKey = cache.keys().next().value;
            if (oldestKey !== undefined) {
                const evicted = cache.get(oldestKey);
                // Help browser GC by detaching load handlers if present
                if (evicted && typeof evicted === 'object') {
                    evicted.onload = null;
                    evicted.onerror = null;
                }
                cache.delete(oldestKey);
                evictions++;
            }
        }
        cache.set(url, img);
    }

    function has(url) {
        return !!url && cache.has(url);
    }

    function remove(url) {
        if (!url || !cache.has(url)) return false;
        const item = cache.get(url);
        if (item && typeof item === 'object') {
            item.onload = null;
            item.onerror = null;
        }
        return cache.delete(url);
    }

    function sweep(activeUrlsSet) {
        if (!activeUrlsSet || !(activeUrlsSet instanceof Set)) {
            return 0;
        }
        let sweptCount = 0;
        for (const [url, item] of cache.entries()) {
            if (!activeUrlsSet.has(url)) {
                if (item && typeof item === 'object') {
                    item.onload = null;
                    item.onerror = null;
                }
                cache.delete(url);
                sweptCount++;
                evictions++;
            }
        }
        return sweptCount;
    }

    function clear() {
        for (const [, item] of cache.entries()) {
            if (item && typeof item === 'object') {
                item.onload = null;
                item.onerror = null;
            }
        }
        cache.clear();
        hits = 0;
        misses = 0;
        evictions = 0;
    }

    function stats() {
        return {
            size: cache.size,
            maxEntries,
            hits,
            misses,
            evictions
        };
    }

    return {
        get,
        set,
        has,
        remove,
        sweep,
        clear,
        stats
    };
}

export const vttImageCache = createImageCache({ maxEntries: 150 });
if (typeof window !== 'undefined') {
    window.vttImageCache = vttImageCache;
}
