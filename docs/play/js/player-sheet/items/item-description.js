/**
 * Player Sheet Item Description & Mechanical Parsing Services
 */

export function parseItemEntry(e, itemObj, items) {
    if (!e) return '';
    if (typeof e === 'string') {
        let str = e.replace(/{@\w+ ([^|}]+)[^}]*}/g, '$1');
        str = str.replace(/{=([^}]+)}/g, (match, p1) => {
            if (itemObj && itemObj[p1] !== undefined) return itemObj[p1];
            if (itemObj && itemObj.inherits && itemObj.inherits[p1] !== undefined) return itemObj.inherits[p1];
            return match;
        });
        str = str.replace(/\{#itemEntry ([^|}]+)[^}]*\}/g, (match, p1) => {
            if (itemObj && itemObj.resist && p1.includes('Resistance')) {
                const type = p1.split(' ')[0].toLowerCase();
                return `You have resistance to ${itemObj.resist.join(' and ')} damage while you wear or use this ${type}.`;
            }
            const refItem = items ? items.find((i) => i.name === p1) : null;
            if (refItem && refItem.entries) return parseItemEntry(refItem.entries, refItem, items);
            if (refItem && refItem.inherits && refItem.inherits.entries)
                return parseItemEntry(refItem.inherits.entries, refItem, items);
            return `See *${p1}*`;
        });
        return str;
    }
    if (Array.isArray(e))
        return e
            .map((x) => parseItemEntry(x, itemObj, items))
            .filter(Boolean)
            .join('\n\n');
    if (e.type === 'list' && e.items)
        return e.items
            .map((li) => '- ' + parseItemEntry(li, itemObj, items))
            .filter(Boolean)
            .join('\n');
    if (e.entries) return (e.name ? `**${e.name}.** ` : '') + parseItemEntry(e.entries, itemObj, items);
    if (e.type === 'table') return '[Table]';
    return '';
}

export function buildItemMechanicalText(item) {
    let lines = [];
    const typeMap = {
        M: 'Melee Weapon',
        R: 'Ranged Weapon',
        LA: 'Light Armor',
        MA: 'Medium Armor',
        HA: 'Heavy Armor',
        S: 'Shield',
        W: 'Wondrous Item',
        P: 'Potion',
        RG: 'Ring',
        RD: 'Rod',
        ST: 'Staff',
        WD: 'Wand',
        SC: 'Scroll'
    };
    const propMap = {
        V: 'Versatile',
        F: 'Finesse',
        L: 'Light',
        H: 'Heavy',
        '2H': 'Two-Handed',
        T: 'Thrown',
        A: 'Ammunition',
        R: 'Reach',
        S: 'Special',
        LD: 'Loading'
    };
    const dmgTypeMap = {
        S: 'slashing',
        P: 'piercing',
        B: 'bludgeoning',
        C: 'cold',
        F: 'fire',
        L: 'lightning',
        O: 'force',
        N: 'necrotic',
        R: 'radiant',
        T: 'thunder',
        Y: 'psychic',
        A: 'acid',
        I: 'poison'
    };

    const typeName = typeMap[item.type] || item.type || item.weaponCategory || 'Item';
    const rarity = item.rarity ? `, ${item.rarity}` : '';
    const attune = item.reqAttune ? ` (requires attunement)` : '';
    lines.push(`*${typeName}${rarity}${attune}*`);

    if (item.ac) {
        let acStr = String(item.ac);
        if (item.type === 'LA') acStr += ' + Dex modifier';
        if (item.type === 'MA') acStr += ' + Dex modifier (max 2)';
        lines.push(`**Armor Class:** ${acStr}`);
    }
    if (item.dmg1) {
        const dt = dmgTypeMap[item.dmgType] || item.dmgType || '';
        let dmg = `**Damage:** ${item.dmg1} ${dt}`;
        if (item.dmg2) dmg += ` (or ${item.dmg2} ${dt} versatile)`;
        lines.push(dmg);
    }
    if (item.property && item.property.length > 0) {
        const props = item.property
            .map((p) => {
                const propStr = typeof p === 'string' ? p : p.uid || p.name || '';
                const baseProp = propStr.split('|')[0];
                const mapped = propMap[baseProp] || propMap[propStr] || baseProp;
                if (typeof p === 'object' && p.note) return `${mapped} (${p.note})`;
                return mapped;
            })
            .filter(Boolean)
            .join(', ');
        if (props) lines.push(`**Properties:** ${props}`);
    }
    if (item.resist) lines.push(`**Resistance:** ${Array.isArray(item.resist) ? item.resist.join(', ') : item.resist}`);
    if (item.immune) lines.push(`**Immunity:** ${Array.isArray(item.immune) ? item.immune.join(', ') : item.immune}`);
    if (item.conditionImmune)
        lines.push(
            `**Condition Immunity:** ${Array.isArray(item.conditionImmune) ? item.conditionImmune.join(', ') : item.conditionImmune}`
        );

    return lines.length ? lines.join('\n') + '\n---\n' : '';
}

export function getItemFullDescription(item, itemCache) {
    if (!itemCache) return item.descriptionMarkdown || item.descriptionHtml || '';
    const { items, fluffDict, ruleDict } = itemCache;
    if (item.descriptionMarkdown) return item.descriptionMarkdown;

    let mechText = buildItemMechanicalText(item);
    let parts = [];
    const source = item.source || '';

    if (item._isVariant && item.baseName) {
        const baseKey = (item.baseName + source).toLowerCase();
        let baseEntries = null;
        const baseItem = items ? items.find((it) => it.name === item.baseName) : null;
        if (baseItem && baseItem.entries && baseItem.entries.length) {
            baseEntries = baseItem.entries;
        } else if (fluffDict && fluffDict[baseKey]) {
            baseEntries = fluffDict[baseKey];
        }
        if (baseEntries) parts.push(parseItemEntry(baseEntries, item, items));
    }

    let itemEntries = item.entries || (item.inherits ? item.inherits.entries : null);
    if (!itemEntries || itemEntries.length === 0) {
        const key = (item.name + source).toLowerCase();
        if (fluffDict && fluffDict[key]) {
            itemEntries = fluffDict[key];
        }
    }
    if (itemEntries) parts.push(parseItemEntry(itemEntries, item, items));

    if (ruleDict) {
        if (item.property && item.property.length > 0) {
            item.property.forEach((prop) => {
                const propStr = typeof prop === 'string' ? prop : prop.uid || prop.name || '';
                const baseProp = propStr.split('|')[0].toLowerCase();
                if (ruleDict.property[baseProp]) {
                    parts.push(parseItemEntry(ruleDict.property[baseProp], item, items));
                }
            });
        }
        if (item.mastery && item.mastery.length > 0) {
            item.mastery.forEach((mastery) => {
                const masteryStr = typeof mastery === 'string' ? mastery : mastery.uid || mastery.name || '';
                const baseMastery = masteryStr.split('|')[0].toLowerCase();
                if (ruleDict.mastery[baseMastery]) {
                    const masteryEntry = {
                        type: 'entries',
                        name: 'Mastery: ' + baseMastery.charAt(0).toUpperCase() + baseMastery.slice(1),
                        entries: ruleDict.mastery[baseMastery]
                    };
                    parts.push(parseItemEntry(masteryEntry, item, items));
                }
            });
        }
    }

    return mechText + parts.filter(Boolean).join('\n\n');
}

export function renderItemPreview(item, options = {}) {
    const previewPane = document.getElementById('pc-item-preview-pane');
    if (!previewPane || !item) return;

    const {
        itemCache = null,
        getNormalizedRarity = () => 'common',
        getRarityBadgeHtml = () => '',
        getDisplaySourceBadge = (s) => s,
        updateItemSelectedCount = () => {},
        setActivePreviewItem = () => {}
    } = options;

    setActivePreviewItem(item);

    const itemKey = (item.id || item.name + '::' + (item.source || '')).toLowerCase();
    document.querySelectorAll('#pc-item-tbody tr.pc-item-row').forEach((r) => {
        if (r.dataset.key === itemKey) r.classList.add('is-active');
        else r.classList.remove('is-active');
    });

    const source = item.source || '';
    const is2024 = (source || '').toUpperCase() === 'XPHB' || (source || '').toUpperCase() === 'XDMG';
    const badgeBg = is2024 ? '#059669' : (source || '').toUpperCase() === 'PHB' ? '#2563eb' : '#475569';
    const displaySrc = getDisplaySourceBadge(source) || source;

    const normRarity = getNormalizedRarity(item);
    const rarityBadge = getRarityBadgeHtml(normRarity);
    const typeName = item.type || item.weaponCategory || 'Item';
    const valStr = item.value ? item.value / 100 + ' gp' : '—';
    const weightStr = item.weight !== undefined && item.weight !== null ? `${item.weight} lb` : '—';

    const isSelected = window._vttSelectedItemMap && window._vttSelectedItemMap.has(itemKey);

    let bodyHtml = '';
    if (item.descriptionHtml) {
        bodyHtml = item.descriptionHtml;
    } else {
        const rawDesc = getItemFullDescription(item, itemCache);
        bodyHtml = rawDesc
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^---\s*$/gm, '<hr>')
            .replace(/\n\n/g, '<p></p>')
            .replace(/\n/g, '<br>');
    }

    previewPane.innerHTML = `
        <div class="pc-item-preview-header">
            <div class="pc-item-preview-title">
                <span>${item.name}</span>
                ${source ? `<span class="pc-item-source-badge" style="background:${badgeBg}; color:#fff;">${displaySrc}</span>` : ''}
            </div>
            <div class="pc-item-preview-meta">
                <span style="font-weight:600;">${typeName}</span>
                <span>•</span>
                ${rarityBadge}
                ${item.reqAttune ? '<span style="color:#d4af37;"><i class="fa-solid fa-ring"></i> Requires Attunement</span>' : ''}
            </div>
        </div>

        <div class="pc-item-preview-stats">
            <div class="pc-item-preview-stat-box">
                <span class="pc-item-preview-stat-label">Weight</span>
                <span class="pc-item-preview-stat-val">${weightStr}</span>
            </div>
            <div class="pc-item-preview-stat-box">
                <span class="pc-item-preview-stat-label">Value</span>
                <span class="pc-item-preview-stat-val">${valStr}</span>
            </div>
            ${
                item.dmg1
                    ? `
                <div class="pc-item-preview-stat-box">
                    <span class="pc-item-preview-stat-label">Damage</span>
                    <span class="pc-item-preview-stat-val">${item.dmg1} ${item.dmgType || ''}</span>
                </div>
            `
                    : ''
            }
            ${
                item.ac
                    ? `
                <div class="pc-item-preview-stat-box">
                    <span class="pc-item-preview-stat-label">Armor Class</span>
                    <span class="pc-item-preview-stat-val">${item.ac}</span>
                </div>
            `
                    : ''
            }
        </div>

        <div class="pc-item-preview-body">
            ${bodyHtml}
        </div>

        <div style="margin-top:auto; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <button type="button" id="pc-preview-select-btn" class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'} btn-sm" style="flex:1;">
                <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i> ${isSelected ? 'Selected' : 'Select Item'}
            </button>
        </div>
    `;

    document.getElementById('pc-preview-select-btn')?.addEventListener('click', () => {
        if (!window._vttSelectedItemMap) window._vttSelectedItemMap = new Map();
        const desc = getItemFullDescription(item, itemCache);
        if (window._vttSelectedItemMap.has(itemKey)) {
            window._vttSelectedItemMap.delete(itemKey);
        } else {
            window._vttSelectedItemMap.set(itemKey, {
                name: item.name,
                weight: item.weight || '0',
                desc: desc,
                source: item.source || '',
                itemId: item.id || '',
                catItem: item
            });
        }

        const rowCb = document.querySelector(`.pc-item-cb[data-key="${itemKey}"]`);
        if (rowCb) rowCb.checked = window._vttSelectedItemMap.has(itemKey);

        updateItemSelectedCount();
    });
}
