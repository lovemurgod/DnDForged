// DnDForged 2D Bounded Spatial QuadTree Subsystem
// Provides O(log N + K) spatial indexing for walls, doors, raycasting, and collision detection

/**
 * Checks if two Axis-Aligned Bounding Boxes (AABB) intersect.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} a
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} b
 * @returns {boolean}
 */
export function intersectsAABB(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * Checks if parent AABB completely encloses child AABB.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} parent
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} child
 * @returns {boolean}
 */
export function containsAABB(parent, child) {
    return (
        parent.minX <= child.minX && parent.maxX >= child.maxX && parent.minY <= child.minY && parent.maxY >= child.maxY
    );
}

/**
 * Computes an Axis-Aligned Bounding Box for a wall segment with optional padding.
 * @param {Object} wall - Wall object with x1, y1, x2, y2
 * @param {number} [pad=0] - Extra padding around segment
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
export function computeWallAABB(wall, pad = 0) {
    if (!wall) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const x1 = Number(wall.x1) || 0;
    const y1 = Number(wall.y1) || 0;
    const x2 = Number(wall.x2) || 0;
    const y2 = Number(wall.y2) || 0;
    return {
        minX: Math.min(x1, x2) - pad,
        minY: Math.min(y1, y2) - pad,
        maxX: Math.max(x1, x2) + pad,
        maxY: Math.max(y1, y2) + pad
    };
}

/**
 * Internal recursive node of the SpatialQuadTree.
 */
export class SpatialQuadTreeNode {
    /**
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} boundary
     * @param {number} capacity
     * @param {number} maxDepth
     * @param {number} depth
     */
    constructor(boundary, capacity = 8, maxDepth = 8, depth = 0) {
        this.boundary = boundary;
        this.capacity = capacity;
        this.maxDepth = maxDepth;
        this.depth = depth;
        /** @type {Array<{item: any, aabb: {minX: number, minY: number, maxX: number, maxY: number}}>} */
        this.items = [];
        /** @type {SpatialQuadTreeNode[]|null} */
        this.children = null;
    }

    /**
     * Subdivides this node into 4 quadrant children: NW, NE, SW, SE.
     */
    subdivide() {
        const { minX, minY, maxX, maxY } = this.boundary;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const nextDepth = this.depth + 1;

        this.children = [
            new SpatialQuadTreeNode({ minX, minY, maxX: midX, maxY: midY }, this.capacity, this.maxDepth, nextDepth), // NW
            new SpatialQuadTreeNode({ minX: midX, minY, maxX, maxY: midY }, this.capacity, this.maxDepth, nextDepth), // NE
            new SpatialQuadTreeNode({ minX, minY: midY, maxX: midX, maxY }, this.capacity, this.maxDepth, nextDepth), // SW
            new SpatialQuadTreeNode({ minX: midX, minY: midY, maxX, maxY }, this.capacity, this.maxDepth, nextDepth) // SE
        ];

        // Re-distribute existing items where possible
        const remaining = [];
        for (const entry of this.items) {
            let placed = false;
            for (const child of this.children) {
                if (containsAABB(child.boundary, entry.aabb)) {
                    child.insert(entry.item, entry.aabb);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                remaining.push(entry);
            }
        }
        this.items = remaining;
    }

    /**
     * Inserts an item into this node or its children.
     * @param {any} item - Object to store
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} aabb - Bounding box
     * @returns {boolean} True if successfully stored
     */
    insert(item, aabb) {
        if (!intersectsAABB(this.boundary, aabb)) {
            return false;
        }

        // If subdivided, attempt to place into child that fully encloses it
        if (this.children !== null) {
            for (const child of this.children) {
                if (containsAABB(child.boundary, aabb)) {
                    return child.insert(item, aabb);
                }
            }
            // Straddles quadrant split line -> store directly in this parent node
            this.items.push({ item, aabb });
            return true;
        }

        // Leaf node storage
        this.items.push({ item, aabb });

        // Check if subdivision is needed
        if (this.items.length > this.capacity && this.depth < this.maxDepth) {
            this.subdivide();
        }

        return true;
    }

    /**
     * Queries all items whose bounding box intersects rangeAABB.
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} rangeAABB
     * @param {Array<any>} results
     * @param {Set<any>} [seen]
     * @returns {Array<any>}
     */
    queryRange(rangeAABB, results = [], seen = new Set()) {
        if (!intersectsAABB(this.boundary, rangeAABB)) {
            return results;
        }

        for (const entry of this.items) {
            if (intersectsAABB(entry.aabb, rangeAABB)) {
                if (!seen.has(entry.item)) {
                    seen.add(entry.item);
                    results.push(entry.item);
                }
            }
        }

        if (this.children !== null) {
            for (const child of this.children) {
                child.queryRange(rangeAABB, results, seen);
            }
        }

        return results;
    }

    /**
     * Clears all items and collapses children.
     */
    clear() {
        this.items = [];
        if (this.children !== null) {
            for (const child of this.children) {
                child.clear();
            }
            this.children = null;
        }
    }
}

/**
 * High-level Bounded 2D Spatial QuadTree.
 */
export class SpatialQuadTree {
    /**
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} [boundary]
     * @param {number} [capacity=8]
     * @param {number} [maxDepth=8]
     */
    constructor(boundary = { minX: 0, minY: 0, maxX: 10000, maxY: 10000 }, capacity = 8, maxDepth = 8) {
        this.capacity = capacity;
        this.maxDepth = maxDepth;
        this.root = new SpatialQuadTreeNode(boundary, capacity, maxDepth, 0);
        this.size = 0;
    }

    /**
     * Inserts an item into the QuadTree.
     * @param {any} item - Object to index
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} aabb - Bounding box
     * @returns {boolean}
     */
    insert(item, aabb) {
        const ok = this.root.insert(item, aabb);
        if (ok) this.size++;
        return ok;
    }

    /**
     * Queries all items intersecting rangeAABB.
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} rangeAABB
     * @returns {Array<any>}
     */
    queryRange(rangeAABB) {
        return this.root.queryRange(rangeAABB, [], new Set());
    }

    /**
     * Queries all items within radius distance from point (x, y).
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} [radius=0] - Search radius
     * @returns {Array<any>}
     */
    queryPoint(x, y, radius = 0) {
        const range = {
            minX: x - radius,
            minY: y - radius,
            maxX: x + radius,
            maxY: y + radius
        };
        return this.queryRange(range);
    }

    /**
     * Resets the QuadTree with optional new boundaries.
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} [newBoundary]
     */
    clear(newBoundary = null) {
        if (newBoundary) {
            this.root = new SpatialQuadTreeNode(newBoundary, this.capacity, this.maxDepth, 0);
        } else {
            this.root.clear();
        }
        this.size = 0;
    }
}

/**
 * Domain-specific Wall and Raycasting Spatial Index for ForgeDVTT.
 */
export class WallSpatialIndex {
    /**
     * @param {number} [width=10000] - Map width
     * @param {number} [height=10000] - Map height
     */
    constructor(width = 10000, height = 10000) {
        this.tree = new SpatialQuadTree({
            minX: 0,
            minY: 0,
            maxX: Math.max(1000, width),
            maxY: Math.max(1000, height)
        });
        this.wallsList = [];
    }

    /**
     * Rebuilds the index from an array of walls.
     * @param {Array<Object>} walls - Full walls array from map state
     * @param {number} [width] - Map width
     * @param {number} [height] - Map height
     */
    rebuild(walls = [], width, height) {
        const bounds = width && height ? { minX: 0, minY: 0, maxX: width, maxY: height } : null;
        this.tree.clear(bounds);
        this.wallsList = Array.isArray(walls) ? [...walls] : [];

        for (const wall of this.wallsList) {
            const aabb = computeWallAABB(wall, 10);
            this.tree.insert(wall, aabb);
        }
    }

    /**
     * Queries walls relevant to a token sight or dynamic light radius.
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Vision/light radius
     * @returns {Array<Object>} Subset of candidate walls
     */
    querySightRadius(cx, cy, radius) {
        const pad = 20;
        const range = {
            minX: cx - radius - pad,
            minY: cy - radius - pad,
            maxX: cx + radius + pad,
            maxY: cy + radius + pad
        };
        return this.tree.queryRange(range);
    }

    /**
     * Queries walls near a mouse cursor point for hit-testing and door interaction.
     * @param {number} x - Cursor X
     * @param {number} y - Cursor Y
     * @param {number} [pad=25] - Hit threshold in pixels
     * @returns {Array<Object>}
     */
    queryNearPoint(x, y, pad = 25) {
        return this.tree.queryPoint(x, y, pad);
    }

    /**
     * Returns total indexed wall count.
     * @returns {number}
     */
    get count() {
        return this.tree.size;
    }
}
