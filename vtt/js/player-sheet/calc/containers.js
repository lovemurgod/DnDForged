/**
 * Container Weight & Encumbrance Calculation Engine
 * Supports container base (tare) weight, capacity limits, and Standard/Variant Encumbrance rules.
 */

/**
 * Calculates raw weight of items stored inside a container
 */
export function getContainerContentsWeight(container, equipment) {
    if (!container || !container.id || !Array.isArray(equipment)) return 0;
    const cItems = equipment.filter((eq) => eq && eq.containerId === container.id);
    return cItems.reduce((acc, eq) => {
        const w = parseFloat(eq.weight) || 0;
        const q = parseInt(eq.qty) || 1;
        return acc + w * q;
    }, 0);
}

/**
 * Calculates effective weight added to the character by a container
 */
export function getContainerEffectiveWeight(container, equipment) {
    if (!container) return 0;
    const rule = container.weightRule || 'standard';

    if (rule === 'weightless') {
        return 0;
    }
    if (rule === 'fixed') {
        return parseFloat(container.customWeight) || 0;
    }

    // Standard rule: Container Tare Weight + Contents Weight
    const baseWeight = parseFloat(container.baseWeight) || 0;
    const contentsWeight = getContainerContentsWeight(container, equipment);
    return baseWeight + contentsWeight;
}

/**
 * Evaluates container capacity status and percent utilization
 */
export function getContainerCapacityStatus(container, equipment) {
    if (!container) return { contentsWeight: 0, capacity: null, isOverCapacity: false, percentFull: null };
    const contentsWeight = getContainerContentsWeight(container, equipment);
    const capacity =
        container.capacity !== undefined && container.capacity !== null && container.capacity !== ''
            ? parseFloat(container.capacity)
            : null;

    const hasCapacity = capacity !== null && !isNaN(capacity) && capacity > 0;
    const isOverCapacity = hasCapacity && contentsWeight > capacity + 0.001;
    const percentFull = hasCapacity ? Math.min(100, Math.round((contentsWeight / capacity) * 100)) : null;

    return {
        contentsWeight: Math.round(contentsWeight * 100) / 100,
        capacity: hasCapacity ? capacity : null,
        isOverCapacity,
        percentFull
    };
}

/**
 * Calculates complete character inventory weight breakdown (equipment, containers, coins)
 */
export function calculateCharacterTotalWeight(char) {
    if (!char) return { totalWeight: 0, unbaggedWeight: 0, containersTotalWeight: 0, coinWeight: 0 };

    const equipment = Array.isArray(char.equipment) ? char.equipment : [];
    const containers = Array.isArray(char.containers) ? char.containers : [];
    const currency = char.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

    const coinCount =
        (parseInt(currency.cp) || 0) +
        (parseInt(currency.sp) || 0) +
        (parseInt(currency.ep) || 0) +
        (parseInt(currency.gp) || 0) +
        (parseInt(currency.pp) || 0);
    const coinWeight = coinCount * 0.02; // 50 coins per lb

    const unbaggedWeight = equipment
        .filter((eq) => !eq.containerId)
        .reduce((acc, eq) => {
            const w = parseFloat(eq.weight) || 0;
            const q = parseInt(eq.qty) || 1;
            return acc + w * q;
        }, 0);

    const containersTotalWeight = containers.reduce((acc, c) => acc + getContainerEffectiveWeight(c, equipment), 0);
    const totalWeight = unbaggedWeight + containersTotalWeight + coinWeight;

    return {
        totalWeight: Math.round(totalWeight * 100) / 100,
        unbaggedWeight: Math.round(unbaggedWeight * 100) / 100,
        containersTotalWeight: Math.round(containersTotalWeight * 100) / 100,
        coinWeight: Math.round(coinWeight * 100) / 100
    };
}

/**
 * Calculates encumbrance state against STR capacity
 */
export function calculateEncumbrance(strScore, totalWeight, rule = 'standard') {
    const str = Math.max(1, parseInt(strScore) || 10);
    const wt = parseFloat(totalWeight) || 0;

    const maxThreshold = str * 15;
    const heavyThreshold = str * 10;
    const encumberedThreshold = str * 5;

    if (rule === 'variant') {
        if (wt > maxThreshold) {
            return {
                rule,
                statusKey: 'over',
                statusText: 'Over-encumbered (0 speed)',
                statusColor: 'var(--color-danger)',
                maxThreshold,
                heavyThreshold,
                encumberedThreshold
            };
        } else if (wt > heavyThreshold) {
            return {
                rule,
                statusKey: 'heavy',
                statusText: 'Heavily Encumbered (-20 speed, Disadv. on checks)',
                statusColor: 'var(--color-danger)',
                maxThreshold,
                heavyThreshold,
                encumberedThreshold
            };
        } else if (wt > encumberedThreshold) {
            return {
                rule,
                statusKey: 'encumbered',
                statusText: 'Encumbered (-10 speed)',
                statusColor: 'var(--color-warning)',
                maxThreshold,
                heavyThreshold,
                encumberedThreshold
            };
        }
        return {
            rule,
            statusKey: 'normal',
            statusText: 'Normal',
            statusColor: 'var(--color-success)',
            maxThreshold,
            heavyThreshold,
            encumberedThreshold
        };
    }

    // Standard rule: carry up to 15x STR
    if (wt > maxThreshold) {
        return {
            rule,
            statusKey: 'over',
            statusText: 'Over-encumbered (0 speed)',
            statusColor: 'var(--color-danger)',
            maxThreshold
        };
    }
    return {
        rule,
        statusKey: 'normal',
        statusText: 'Normal',
        statusColor: 'var(--color-success)',
        maxThreshold
    };
}
