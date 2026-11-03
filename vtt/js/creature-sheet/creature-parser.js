// ForgeDVTT Creature Sheet — Parser & Formatting Subsystem
// Handles 5e markup parsing, dice chip injection, formatting of stats, speed, defenses, senses, and math evaluation.

export const STANDARD_DAMAGE_TYPES = [
    'Slashing',
    'Piercing',
    'Bludgeoning',
    'Fire',
    'Cold',
    'Lightning',
    'Thunder',
    'Poison',
    'Acid',
    'Psychic',
    'Necrotic',
    'Radiant',
    'Force',
    'Healing'
];

export function toSpellTitleCase(str) {
    if (typeof window !== 'undefined' && window.toSpellTitleCase) {
        try {
            return window.toSpellTitleCase(typeof str === 'string' ? str : str?.name || '');
        } catch (_) {}
    }
    const rawStr = typeof str === 'string' ? str : typeof str?.name === 'string' ? str.name : '';
    if (!rawStr) return '';
    const cleanStr = rawStr.replace(/\{@spell ([^|}]+).*?\}/gi, '$1').trim();
    if (!cleanStr) return '';

    // If str ends with a bracketed tag like [PHB] or [XPHB], extract and preserve it
    const tagMatch = cleanStr.match(/\s*(\[[a-zA-Z0-9_\s-]+\])$/);
    let tag = '';
    let mainStr = cleanStr;
    if (tagMatch) {
        tag = ' ' + tagMatch[1].toUpperCase();
        mainStr = cleanStr.slice(0, tagMatch.index).trim();
    }

    const minorWords = new Set([
        'a',
        'an',
        'the',
        'and',
        'but',
        'or',
        'for',
        'nor',
        'on',
        'at',
        'to',
        'from',
        'by',
        'of',
        'in',
        'with'
    ]);
    const title = mainStr
        .split(/\s+/)
        .map((word, index, arr) => {
            let clean = word.toLowerCase();
            if (clean.includes('/')) {
                return clean
                    .split('/')
                    .map((part) => {
                        if (!part) return part;
                        return part.charAt(0).toUpperCase() + part.slice(1);
                    })
                    .join('/');
            }
            if (clean.includes('-')) {
                return clean
                    .split('-')
                    .map((part) => {
                        if (!part) return part;
                        return part.charAt(0).toUpperCase() + part.slice(1);
                    })
                    .join('-');
            }
            if (index > 0 && index < arr.length - 1 && minorWords.has(clean)) {
                return clean;
            }
            return clean.charAt(0).toUpperCase() + clean.slice(1);
        })
        .join(' ');
    return title + tag;
}

export function cleanTags(str) {
    if (typeof window !== 'undefined' && typeof window.cleanTags === 'function') return window.cleanTags(str);
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\{@[a-z]+\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1').replace(/\{@[a-z]+\}/gi, '');
}

export function flattenEntriesToText(entry) {
    if (typeof window !== 'undefined' && typeof window.flattenEntriesToText === 'function')
        return window.flattenEntriesToText(entry);
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (Array.isArray(entry)) return entry.map(flattenEntriesToText).join(' ');
    if (typeof entry === 'object' && entry.entries) return flattenEntriesToText(entry.entries);
    return String(entry);
}

export function parse5eMarkup(text) {
    if (!text) return '';
    let result = text;

    result = result.replace(/\{@atk\s+([^}]+)\}/gi, (match, type) => {
        const t = type.toLowerCase().trim();
        if (t === 'mw') return '<strong>Melee Weapon Attack:</strong>';
        if (t === 'rw') return '<strong>Ranged Weapon Attack:</strong>';
        if (t === 'mw,rw' || t === 'rw,mw') return '<strong>Melee or Ranged Weapon Attack:</strong>';
        if (t === 'ms') return '<strong>Melee Spell Attack:</strong>';
        if (t === 'rs') return '<strong>Ranged Spell Attack:</strong>';
        return '<strong>Attack:</strong>';
    });
    result = result.replace(/\{@atkr\s+([^}]+)\}/gi, (match, type) => {
        const t = type.toLowerCase().trim();
        if (t === 'm') return '<strong>Melee Attack:</strong>';
        if (t === 'r') return '<strong>Ranged Attack:</strong>';
        if (t === 'm,r' || t === 'r,m') return '<strong>Melee or Ranged Attack:</strong>';
        return '<strong>Attack:</strong>';
    });

    // Catch bare attack abbreviations that may have been previously stripped of tags
    result = result.replace(
        /(?:^|(?<=>)|(?<=\s))\b(mw|rw|ms|rs)\b(?:\s*[,:])?(?=[\s]+(?:reach|range|\+|-|\d|to hit))/gi,
        (match, type) => {
            const t = type.toLowerCase();
            if (t === 'mw') return '<strong>Melee Weapon Attack:</strong>';
            if (t === 'rw') return '<strong>Ranged Weapon Attack:</strong>';
            if (t === 'ms') return '<strong>Melee Spell Attack:</strong>';
            if (t === 'rs') return '<strong>Ranged Spell Attack:</strong>';
            return match;
        }
    );

    result = result.replace(/\{@hit\s+([+\-]?\d+)\}(?:\s+to\s+hit)?/gi, (match, bonus) => {
        const sign = bonus.startsWith('+') || bonus.startsWith('-') ? '' : '+';
        return `${sign}${bonus} to hit`;
    });

    result = result.replace(/\{@h\}/gi, '<strong>Hit:</strong> ');
    result = result.replace(/\{@m\}/gi, '<strong>Miss:</strong> ');
    result = result.replace(/\{@hom\}/gi, '<strong>Hit or Miss:</strong> ');

    result = result.replace(/\{@damage\s+([^}]+)\}/gi, (match, contents) => {
        const parts = contents.split('|');
        return parts[0].trim();
    });

    result = result.replace(/\{@dc\s+(\d+)\}/gi, '<strong>DC $1</strong>');

    result = result.replace(/\{@recharge\s*(\d*)\}/gi, (match, num) => {
        const val = num ? `${num}–6` : '6';
        return `<strong>(Recharge ${val})</strong>`;
    });

    result = result.replace(/\{@actSave\s+([^}]+)\}/gi, (match, stat) => {
        return `<strong>${stat.toUpperCase()} Saving Throw:</strong>`;
    });
    result = result.replace(/\{@actSaveFail\}/gi, '<em>Failure:</em>');
    result = result.replace(/\{@actSaveSuccess\}/gi, '<em>Success:</em>');
    result = result.replace(/\{@actSaveSuccessOrFail\}/gi, '<em>Success or Failure:</em>');
    result = result.replace(/\{@actTrigger\}/gi, '<strong>Trigger:</strong>');
    result = result.replace(/\{@actResponse\}/gi, '<strong>Response:</strong>');

    result = result.replace(/\{@action\s+([^}]+)\}/gi, '<strong>$1</strong>');
    result = result.replace(/\{@condition\s+([^|}]+)[^}]*\}/gi, '<strong>$1</strong>');
    result = result.replace(/\{@variantrule\s+([^|}]+)[^}]*\}/gi, '<strong>$1</strong>');

    result = result.replace(/\{@([a-z]+)\s+([^}]+)\}/gi, (match, tag, contents) => {
        if (tag === 'b') return `<strong>${contents}</strong>`;
        if (tag === 'i') return `<em>${contents}</em>`;
        if (tag === 'u') return `<u>${contents}</u>`;
        if (tag === 's') return `<s>${contents}</s>`;
        if (tag === 'note') return `<em>Note: ${contents}</em>`;
        if (tag === 'chance') return `${contents}%`;

        const parts = contents.split('|');
        let displayText = parts[0].trim();
        if (parts.length >= 3) {
            const p2 = parts[2].trim();
            if (p2 && isNaN(p2)) {
                displayText = p2;
            }
        }
        return displayText;
    });

    return result;
}

export function injectDiceChips(html) {
    if (!html) return '';
    let clean = html;

    // Strip any existing dice-chips back to their inner content to prevent nested buttons
    clean = clean.replace(/<button class="dice-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/gi, '$1');
    clean = clean.replace(/<button class="dice-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/gi, '$1');

    const parts = clean.split(/(<[^>]*>)/g);
    let inButton = false;
    let inAnchor = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        if (part.startsWith('<') && part.endsWith('>')) {
            const tagLower = part.toLowerCase();
            if (tagLower.startsWith('<button')) inButton = true;
            else if (tagLower.startsWith('</button')) inButton = false;
            else if (tagLower.startsWith('<a')) inAnchor = true;
            else if (tagLower.startsWith('</a')) inAnchor = false;
            continue;
        }

        if (!inButton && !inAnchor) {
            let text = part;
            text = text.replace(/(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?/gi, (match, count, faces, sign, mod) => {
                let formula = `${count}d${faces}`;
                if (sign && mod) formula += `${sign}${mod}`;
                return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${match.trim()}</button>`;
            });
            text = text.replace(/\+(\d+)\s+to\s+hit/gi, (match, bonus) => {
                const formula = `1d20+${bonus}`;
                return `<button class="dice-chip" data-formula="${formula}" title="Roll attack: ${formula}">+${bonus} to hit</button>`;
            });
            text = text.replace(/DC\s+(\d+)/gi, (match, dcVal) => {
                return `<button class="dice-chip dc-chip" data-dc="${dcVal}" style="border-color: var(--color-gold-base);" title="Ping DC ${dcVal} to Chat">DC ${dcVal}</button>`;
            });
            parts[i] = text;
        }
    }
    return parts.join('');
}

export function calcDiceAverage(formula) {
    if (!formula) return 0;
    let avg = 0;
    const clean = formula.replace(/\s+/g, '');
    const tokens = clean.match(/([+-]?[0-9]*d[0-9]+)|([+-]?[0-9]+)/gi) || [];
    tokens.forEach((tok) => {
        if (tok.toLowerCase().includes('d')) {
            const sign = tok.startsWith('-') ? -1 : 1;
            const stripped = tok.replace(/^[+-]/, '');
            const parts = stripped.toLowerCase().split('d');
            const count = parseInt(parts[0]) || 1;
            const sides = parseInt(parts[1]) || 6;
            avg += sign * Math.floor((count * (sides + 1)) / 2);
        } else {
            avg += parseInt(tok) || 0;
        }
    });
    return Math.max(0, avg);
}

export function entryToPlainText(e) {
    if (!e) return '';
    if (typeof e === 'string') {
        const trimmed = e.trim();
        if (trimmed.startsWith('{"type":') || trimmed.startsWith('{"name":') || trimmed.startsWith('{"items":')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object') return entryToPlainText(parsed);
            } catch (err) {}
        }
        return e;
    }
    if (Array.isArray(e)) {
        return e.map((item) => entryToPlainText(item)).join('\n');
    }
    if (e.type === 'list') {
        return (e.items || [])
            .map((item) => {
                if (typeof item === 'string') return `- ${item}`;
                if (item && typeof item === 'object') {
                    const name = item.name ? `${item.name}: ` : '';
                    const text = item.entries
                        ? Array.isArray(item.entries)
                            ? item.entries.map((x) => entryToPlainText(x)).join(' ')
                            : entryToPlainText(item.entries)
                        : item.entry
                          ? entryToPlainText(item.entry)
                          : '';
                    return `- ${name}${text}`;
                }
                return `- ${item}`;
            })
            .join('\n');
    }
    if (e.type === 'item' || e.type === 'itemSub') {
        const name = e.name ? `${e.name}: ` : '';
        const text = e.entries
            ? Array.isArray(e.entries)
                ? e.entries.map((x) => entryToPlainText(x)).join('\n')
                : entryToPlainText(e.entries)
            : e.entry
              ? entryToPlainText(e.entry)
              : '';
        return `${name}${text}`;
    }
    if (e.entries) {
        return Array.isArray(e.entries)
            ? e.entries.map((x) => entryToPlainText(x)).join('\n')
            : entryToPlainText(e.entries);
    }
    if (e.entry) return entryToPlainText(e.entry);
    return '';
}

export function formatRawEntry(e) {
    if (!e) return '';
    if (typeof e === 'string') {
        const trimmed = e.trim();
        if (trimmed.startsWith('{"type":') || trimmed.startsWith('{"name":') || trimmed.startsWith('{"items":')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object') return formatRawEntry(parsed);
            } catch (err) {}
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return `<li style="margin-bottom: 4px;">${trimmed.substring(2)}</li>`;
        }
        return e;
    }
    if (Array.isArray(e)) return e.map((item) => formatRawEntry(item)).join(' ');

    if (e.type === 'list') {
        const itemsHtml = (e.items || [])
            .map((item) => {
                if (typeof item === 'string') {
                    const t = item.trim();
                    if (t.startsWith('{"type":') || t.startsWith('{"name":')) {
                        try {
                            const parsed = JSON.parse(t);
                            if (parsed && typeof parsed === 'object') return formatRawEntry(parsed);
                        } catch (err) {}
                    }
                    return `<li style="margin-bottom: 4px;">${item}</li>`;
                }
                if (item.type === 'itemSub' || item.type === 'item') {
                    const nameStr = item.name ? `<strong><em>${item.name}.</em></strong> ` : '';
                    const entryStr = item.entry
                        ? formatRawEntry(item.entry)
                        : item.entries
                          ? formatRawEntry(item.entries)
                          : '';
                    return `<li style="margin-bottom: 4px;">${nameStr}${entryStr}</li>`;
                }
                return `<li style="margin-bottom: 4px;">${formatRawEntry(item)}</li>`;
            })
            .join('');
        return `<ul style="margin: 8px 0; padding-left: 20px;">${itemsHtml}</ul>`;
    }

    if (e.type === 'itemSub' || e.type === 'item') {
        const nameStr = e.name ? `<strong><em>${e.name}.</em></strong> ` : '';
        const entryStr = e.entry ? formatRawEntry(e.entry) : e.entries ? formatRawEntry(e.entries) : '';
        return `${nameStr}${entryStr}`;
    }

    if (e.type === 'entries') {
        const nameStr = e.name ? `<strong><em>${e.name}.</em></strong> ` : '';
        const entryStr = e.entries ? formatRawEntry(e.entries) : e.entry ? formatRawEntry(e.entry) : '';
        return `<div style="margin-top: 8px;">${nameStr}${entryStr}</div>`;
    }

    if (e.type === 'inset') {
        const nameStr = e.name ? `<strong>${e.name}</strong><br>` : '';
        const entryStr = e.entries ? formatRawEntry(e.entries) : e.entry ? formatRawEntry(e.entry) : '';
        return `<div style="margin: 8px 0; padding: 8px; border-left: 3px solid var(--color-gold-base); background: rgba(0,0,0,0.2);">${nameStr}${entryStr}</div>`;
    }

    if (e.type === 'table') {
        return `<div style="margin: 8px 0; font-style: italic; color: var(--color-text-muted);">[Table: ${e.caption || 'Data table omitted'}]</div>`;
    }

    if (e.type === 'inlineBlock') {
        const entryStr = e.entries ? formatRawEntry(e.entries) : e.entry ? formatRawEntry(e.entry) : '';
        return `<span>${entryStr}</span>`;
    }

    if (e.entries) return formatRawEntry(e.entries);
    if (e.entry) return formatRawEntry(e.entry);
    return '';
}

export function isPassiveAbility(name, rawEntries, cleanText, macro) {
    if (macro) {
        if (macro.isAttack || (macro.damages && macro.damages.length > 0) || macro.save || macro.recharge) return false;
    }
    const combined = (
        name +
        ' ' +
        (typeof rawEntries === 'string' ? rawEntries : JSON.stringify(rawEntries)) +
        ' ' +
        cleanText
    ).toLowerCase();
    if (/\{@atk\s/i.test(combined) || /\{@hit\s/i.test(combined) || /\bto hit\b/i.test(combined)) return false;
    if (/\{@dc\s/i.test(combined) || /\bsaving throw\b/i.test(combined) || /\bsave dc\b/i.test(combined)) return false;
    if (/\{@damage\s/i.test(combined) || /\b\d+d\d+\b/i.test(combined)) return false;
    if (/\{@recharge/i.test(combined) || /\brecharge\s+\d/i.test(combined)) return false;
    return true;
}

export function sizeCode(s) {
    if (!s) return '';
    const raw = Array.isArray(s) ? s[0] : s;
    const letter = String(raw).trim().charAt(0).toUpperCase();
    const map = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
    return map[letter] || raw || '';
}

export function buildTypeString(m) {
    if (!m) return '';
    const size = m.size ? sizeCode(m.size) : '';
    const type = m.type ? (typeof m.type === 'object' ? m.type.type || '' : m.type) : '';
    const tags = m.type?.tags ? (Array.isArray(m.type.tags) ? m.type.tags.join(', ') : m.type.tags) : m.subtype || '';
    const subtype = tags ? ` (${tags})` : '';
    let align = '';
    if (m.alignment) {
        if (typeof Parser !== 'undefined' && Parser.alignmentListToFull) {
            try {
                align = ', ' + Parser.alignmentListToFull(m.alignment).toLowerCase();
            } catch (e) {
                align = ', ' + (Array.isArray(m.alignment) ? m.alignment.join(' ') : m.alignment);
            }
        } else {
            align = ', ' + (Array.isArray(m.alignment) ? m.alignment.join(' ') : m.alignment);
        }
    }
    return `${size} ${type}${subtype}${align}`.trim();
}

export function buildSpeedString(speed) {
    if (!speed && speed !== 0) return '—';
    if (typeof speed === 'number') return `${speed} ft.`;
    if (typeof speed === 'string') {
        const s = speed.trim();
        if (!s) return '—';
        return /ft\.?$/i.test(s) ? s : `${s} ft.`;
    }
    if (typeof speed === 'object' && speed !== null) {
        const parts = [];

        const getSpeedVal = (v) => {
            if (v === undefined || v === null || v === false) return null;
            if (typeof v === 'number') return { val: v, cond: '' };
            if (typeof v === 'object' && v !== null) {
                const num = typeof v.number === 'number' ? v.number : parseInt(v.number, 10);
                return { val: !isNaN(num) ? num : null, cond: v.condition ? ` ${v.condition}` : '' };
            }
            const parsed = parseInt(v, 10);
            return { val: !isNaN(parsed) ? parsed : null, cond: '' };
        };

        const walkObj = getSpeedVal(speed.walk);
        const flyObj = getSpeedVal(speed.fly);
        const swimObj = getSpeedVal(speed.swim);
        const burrowObj = getSpeedVal(speed.burrow);
        const climbObj = getSpeedVal(speed.climb);
        const canHover = !!(speed.canHover || (flyObj && flyObj.cond && flyObj.cond.includes('hover')));

        if (walkObj && walkObj.val !== null) {
            if (walkObj.val > 0 || (!flyObj && !swimObj && !burrowObj && !climbObj)) {
                parts.push(`${walkObj.val} ft.${walkObj.cond}`);
            } else if (walkObj.val === 0 && (flyObj || swimObj || burrowObj || climbObj)) {
                parts.push(`0 ft.${walkObj.cond}`);
            }
        }
        if (flyObj && flyObj.val !== null && flyObj.val > 0) {
            let flyStr = `Fly ${flyObj.val} ft.`;
            if (canHover && !flyObj.cond.includes('hover')) {
                flyStr += ' (hover)';
            } else if (flyObj.cond) {
                flyStr += flyObj.cond;
            }
            parts.push(flyStr);
        }
        if (swimObj && swimObj.val !== null && swimObj.val > 0) {
            parts.push(`Swim ${swimObj.val} ft.${swimObj.cond}`);
        }
        if (burrowObj && burrowObj.val !== null && burrowObj.val > 0) {
            parts.push(`Burrow ${burrowObj.val} ft.${burrowObj.cond}`);
        }
        if (climbObj && climbObj.val !== null && climbObj.val > 0) {
            parts.push(`Climb ${climbObj.val} ft.${climbObj.cond}`);
        }

        if (parts.length > 0) return parts.join(', ');
        if (speed.choose) return `Choose: ${speed.choose}`;
        return '0 ft.';
    }
    return String(speed);
}

export function formatSkillName(str) {
    if (!str) return '';
    let clean = str.replace(/([A-Z])/g, ' $1');
    return clean
        .split(/[\s_-]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export function buildSavesHtml(m) {
    if (!m) return '';
    const savesObj = m.save || m.saves;
    if (!savesObj || Object.keys(savesObj).length === 0) return '';
    return Object.entries(savesObj)
        .map(([k, v]) => {
            const ab = k.toUpperCase();
            const val = parseInt(v) || 0;
            const sign = val >= 0 ? '+' : '';
            const formula = `1d20${sign}${val}`;
            return `<button class="dice-chip" data-formula="${formula}" data-label="${ab} Saving Throw" title="Roll ${ab} Saving Throw">${ab} ${v}</button>`;
        })
        .join(' ');
}

export function buildSkillsHtml(m) {
    if (!m) return '';
    const skillsObj = m.skill || m.skills;
    if (!skillsObj || Object.keys(skillsObj).length === 0) return '';
    return Object.entries(skillsObj)
        .map(([k, v]) => {
            const skillName = formatSkillName(k);
            const val = parseInt(v) || 0;
            const sign = val >= 0 ? '+' : '';
            const formula = `1d20${sign}${val}`;
            return `<button class="dice-chip" data-formula="${formula}" data-label="${skillName} Check" title="Roll ${skillName} Check">${skillName} ${v}</button>`;
        })
        .join(' ');
}

export function formatDefenseEntry(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item !== 'object') return String(item);

    // Structured object: { types: [...], bypasses: [...], note: "..." }
    if (Array.isArray(item.types) && item.types.length > 0) {
        const typeStr = item.types.join(', ');
        const parts = [];
        if (Array.isArray(item.bypasses) && item.bypasses.length > 0) {
            const hasMagic = item.bypasses.includes('magic') || item.bypasses.includes('nonmagical');
            const hasSilver = item.bypasses.includes('silver') || item.bypasses.includes('silvered');
            const hasAdamantine = item.bypasses.includes('adamantine');

            if (hasMagic && hasSilver) {
                parts.push("from nonmagical attacks that aren't silvered");
            } else if (hasMagic && hasAdamantine) {
                parts.push("from nonmagical attacks that aren't adamantine");
            } else if (hasMagic) {
                parts.push('from nonmagical attacks');
            } else if (hasSilver) {
                parts.push("from attacks that aren't silvered");
            } else if (hasAdamantine) {
                parts.push("from attacks that aren't silvered");
            } else {
                parts.push(`except ${item.bypasses.join(', ')}`);
            }
        }
        if (item.note) {
            parts.push(item.note);
        }
        if (parts.length > 0) {
            return `${typeStr} (${parts.join('; ')})`;
        }
        return typeStr;
    }

    // Legacy 5etools object
    const innerList = item.immune || item.resist || item.vulnerable;
    const innerStr = Array.isArray(innerList) ? innerList.join(', ') : innerList || '';
    if (item.note && innerStr) {
        return `${innerStr} (${item.note})`;
    } else if (item.note) {
        return item.note;
    } else if (innerStr) {
        return innerStr;
    }
    return JSON.stringify(item);
}

export function formatDamageList(list) {
    if (!list) return '—';
    if (!Array.isArray(list)) return String(list);
    if (list.length === 0) return '—';
    return list.map(formatDefenseEntry).filter(Boolean).join('; ');
}

export function buildImmunityHtml(m) {
    if (!m) return '';
    const rows = [];
    if (m.immune && (Array.isArray(m.immune) ? m.immune.length > 0 : m.immune))
        rows.push(
            `<div class="cs-info-row"><span class="cs-info-label">Immunities</span><span class="cs-info-value">${formatDamageList(m.immune)}</span></div>`
        );
    if (m.resist && (Array.isArray(m.resist) ? m.resist.length > 0 : m.resist))
        rows.push(
            `<div class="cs-info-row"><span class="cs-info-label">Resistances</span><span class="cs-info-value">${formatDamageList(m.resist)}</span></div>`
        );
    if (m.vulnerable && (Array.isArray(m.vulnerable) ? m.vulnerable.length > 0 : m.vulnerable))
        rows.push(
            `<div class="cs-info-row"><span class="cs-info-label">Vulnerabilities</span><span class="cs-info-value">${formatDamageList(m.vulnerable)}</span></div>`
        );
    if (m.conditionImmune && (Array.isArray(m.conditionImmune) ? m.conditionImmune.length > 0 : m.conditionImmune))
        rows.push(
            `<div class="cs-info-row"><span class="cs-info-label">Cond. Immune</span><span class="cs-info-value">${formatDamageList(m.conditionImmune)}</span></div>`
        );

    let sensesFormatted = '';
    if (m.senses) {
        if (typeof m.senses === 'string') {
            sensesFormatted = m.senses;
        } else if (Array.isArray(m.senses)) {
            sensesFormatted = m.senses.join(', ');
        } else if (typeof m.senses === 'object') {
            const parts = [];
            if (m.senses.sensesString) parts.push(m.senses.sensesString);
            for (const [k, v] of Object.entries(m.senses)) {
                if (k === 'sensesString' || k === 'passivePerception' || k === 'passive') continue;
                parts.push(`${formatSkillName(k)} ${v}`);
            }
            const passive = m.senses.passivePerception || m.senses.passive || m.passive;
            if (passive) parts.push(`passive Perception ${passive}`);
            sensesFormatted = parts.join(', ');
        }
    } else if (m.passive) {
        sensesFormatted = `passive Perception ${m.passive}`;
    }
    if (sensesFormatted) {
        rows.push(
            `<div class="cs-info-row"><span class="cs-info-label">Senses</span><span class="cs-info-value">${sensesFormatted}</span></div>`
        );
    }
    if (m.languages)
        rows.push(
            `<div class="cs-info-row"><span class="cs-info-label">Languages</span><span class="cs-info-value">${Array.isArray(m.languages) ? m.languages.join(', ') : m.languages}</span></div>`
        );
    return rows.join('');
}

export function getProfBonus(crStr) {
    const cr = parseFloat(crStr) || 0;
    if (cr < 5) return 2;
    if (cr < 9) return 3;
    if (cr < 13) return 4;
    if (cr < 17) return 5;
    if (cr < 21) return 6;
    if (cr < 25) return 7;
    if (cr < 29) return 8;
    return 9;
}

export function getModifier(score) {
    const s = parseInt(score, 10);
    if (isNaN(s)) return 0;
    return Math.floor((s - 10) / 2);
}

export function formatModifier(mod) {
    const m = parseInt(mod, 10) || 0;
    return m >= 0 ? `+${m}` : `${m}`;
}

export function parseAc(m) {
    if (!m) return { value: '—', from: '', display: '—' };
    const ac = Array.isArray(m.ac) ? m.ac[0] : m.ac;
    const acValue = typeof ac === 'object' ? (ac.value ?? ac.ac ?? m.primaryAc ?? '—') : (ac ?? m.primaryAc ?? '—');
    const acFrom =
        typeof ac === 'object' && ac.from ? ` (${Array.isArray(ac.from) ? ac.from.join(', ') : ac.from})` : '';
    return { value: acValue, from: acFrom, display: `${acValue}${acFrom}` };
}

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function escapeMassRollHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function normalizeMonsterDamages(m) {
    if (!m) return;
    const norm = (type) => {
        if (!type) return 'Slashing';
        const t = type.trim();
        return (
            STANDARD_DAMAGE_TYPES.find((dt) => dt.toLowerCase() === t.toLowerCase()) ||
            t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
        );
    };
    const checkList = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((item) => {
            if (item?.macro?.damages && Array.isArray(item.macro.damages)) {
                item.macro.damages.forEach((d) => {
                    if (d.type) d.type = norm(d.type);
                });
            }
        });
    };
    checkList(m.actions);
    checkList(m.bonusActions);
    checkList(m.reactions);
    checkList(m.traits);
    if (m.legendaryActions?.entries) checkList(m.legendaryActions.entries);
    if (Array.isArray(m.lairActions)) checkList(m.lairActions);
}

export function evaluateDiceHelper(formula, isCrit = false, rollModeOverride = null) {
    if (!formula)
        return { total: 0, diceList: [], isCritSuccess: false, isCritFail: false, breakdownStr: '', formula: '' };
    if (isCrit) {
        formula = formula.replace(
            /(?:(\d+)\s*)?[dD]\s*(\d+)/gi,
            (m, count, faces) => `${(count ? parseInt(count) : 1) * 2}d${faces}`
        );
    }
    const cleanForm = formula.replace(/\s+/g, '').toLowerCase();
    let total = 0;
    let diceList = [];
    let isCritSuccess = false;
    let isCritFail = false;

    let rollMode =
        rollModeOverride || (typeof window !== 'undefined' && window.VTT ? window.VTT.currentRollMode : 'normal');
    const evt = typeof window !== 'undefined' ? window.event : null;
    if (!rollModeOverride && evt) {
        if (evt.shiftKey) rollMode = 'adv';
        else if (evt.ctrlKey) rollMode = 'dis';
    }
    const isAdvantage = rollMode === 'adv';
    const isDisadvantage = rollMode === 'dis';

    const parts = cleanForm.split(/([+-])/);
    let sign = 1;
    let bdParts = [];

    for (let p of parts) {
        if (!p) continue;
        if (p === '+') {
            sign = 1;
            bdParts.push('+');
            continue;
        }
        if (p === '-') {
            sign = -1;
            bdParts.push('-');
            continue;
        }
        if (p.includes('d')) {
            const [countStr, faceStr] = p.split('d');
            let count = parseInt(countStr) || 1;
            const faces = parseInt(faceStr) || 20;

            let partDiceList = [];

            if (faces === 20 && count === 1 && (isAdvantage || isDisadvantage) && !isCrit) {
                count = 2;
                const roll1 = Math.floor(Math.random() * 20) + 1;
                const roll2 = Math.floor(Math.random() * 20) + 1;
                let keptRoll = roll1;
                let droppedRoll = roll2;

                if (isAdvantage) {
                    if (roll2 > roll1) {
                        keptRoll = roll2;
                        droppedRoll = roll1;
                    }
                } else if (isDisadvantage) {
                    if (roll2 < roll1) {
                        keptRoll = roll2;
                        droppedRoll = roll1;
                    }
                }

                const keptObj = { val: keptRoll, type: 'd20' };
                const droppedObj = { val: droppedRoll, type: 'd20', dropped: true };

                partDiceList.push(keptObj, droppedObj);
                diceList.push(keptObj, droppedObj);

                if (keptRoll === 20) isCritSuccess = true;
                if (keptRoll === 1) isCritFail = true;
                total += sign * keptRoll;
            } else {
                for (let i = 0; i < count; i++) {
                    const roll = Math.floor(Math.random() * faces) + 1;
                    if (faces === 20 && count === 1 && !isCrit) {
                        if (roll === 20) isCritSuccess = true;
                        if (roll === 1) isCritFail = true;
                    }
                    total += sign * roll;
                    const obj = { val: roll, type: `d${faces}` };
                    partDiceList.push(obj);
                    diceList.push(obj);
                }
            }

            const partBd = partDiceList.map((d) => (d.dropped ? `(${d.val})` : d.val));
            bdParts.push(`[${partBd.join(', ')}]`);
        } else {
            const val = parseInt(p) || 0;
            total += sign * val;
            bdParts.push(val);
        }
    }

    return { total, diceList, isCritSuccess, isCritFail, breakdownStr: bdParts.join(' '), formula };
}
