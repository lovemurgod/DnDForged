/**
 * ForgeDVTT Standalone Entry & Tag Resolver
 * Replaces 5etools Renderer.js for parsing rich text, entry objects,
 * and standard D&D reference tags (spells, items, creatures, conditions, dice).
 */

export class VTTEntryResolver {
    /**
     * Resolves standard D&D markdown-like tags into styled HTML elements.
     * @param {string} str
     * @returns {string}
     */
    static resolveTags(str) {
        if (!str || typeof str !== 'string') return '';

        return str
            // {@dice 1d20+5} or {@dice 1d20+5|Display Text}
            .replace(/\{@dice ([^|}]+)(?:\|([^}]+))?\}/gi, (match, formula, display) => {
                const label = display || formula;
                return `<button class="dice-chip" data-formula="${formula}" title="Roll: ${formula}">${label}</button>`;
            })
            // {@damage 2d6} or {@damage 2d6|fire}
            .replace(/\{@damage ([^|}]+)(?:\|([^}]+))?\}/gi, (match, formula, display) => {
                const label = display || formula;
                return `<button class="dice-chip dice-chip--damage" data-formula="${formula}" title="Roll Damage: ${formula}">${label}</button>`;
            })
            // {@hit +5} or {@hit 5}
            .replace(/\{@hit ([^|}]+)(?:\|([^}]+))?\}/gi, (match, bonus, display) => {
                const cleanBonus = bonus.startsWith('+') || bonus.startsWith('-') ? bonus : `+${bonus}`;
                const label = display || cleanBonus;
                return `<button class="dice-chip dice-chip--hit" data-formula="1d20${cleanBonus}" title="Attack Roll: 1d20${cleanBonus}">${label}</button>`;
            })
            // {@dc 15}
            .replace(/\{@dc ([^}]+)\}/gi, (match, dc) => {
                return `<span class="vtt-dc-badge" title="Difficulty Class">DC ${dc}</span>`;
            })
            // Attack modifiers & types: {@atk mw}, {@atk rw}, {@atk ms}, {@atk rs}, {@atkr m,r}
            .replace(/\{@atkr?\s+([^}]+)\}/gi, (match, type) => {
                const clean = type.toLowerCase().trim();
                if (clean === 'mw') return '<em>Melee Weapon Attack:</em>';
                if (clean === 'rw') return '<em>Ranged Weapon Attack:</em>';
                if (clean === 'ms') return '<em>Melee Spell Attack:</em>';
                if (clean === 'rs') return '<em>Ranged Spell Attack:</em>';
                if (clean === 'm') return '<em>Melee Attack:</em>';
                if (clean === 'r') return '<em>Ranged Attack:</em>';
                if (clean === 'm,r' || clean === 'r,m') return '<em>Melee or Ranged Attack:</em>';
                return `<em>${type} Attack:</em>`;
            })
            // Hit / Miss tags: {@h}, {@m}, {@hom}
            .replace(/\{@h\}/gi, '<em>Hit:</em> ')
            .replace(/\{@m\}/gi, '<em>Miss:</em> ')
            .replace(/\{@hom\}/gi, '<em>Hit or Miss:</em> ')
            // Recharge: {@recharge 5} or {@recharge}
            .replace(/\{@recharge\s*(\d+)?\}/gi, (match, num) => {
                return num ? `(Recharge ${num}–6)` : '(Recharge 6)';
            })
            // Chance: {@chance 50}
            .replace(/\{@chance\s+([^}]+)\}/gi, '$1%')
            // {@spell Fireball|PHB} or {@spell Fireball} or {@spell Fireball|PHB|Custom Text}
            .replace(/\{@spell ([^}]+)\}/gi, (match, content) => {
                const parts = content.split('|');
                const name = parts[0].trim();
                const display = (parts[2] || parts[0]).trim();
                return `<span class="vtt-entity-tag vtt-entity-spell" data-entity-type="spell" data-name="${name}">✨ ${display}</span>`;
            })
            // {@item Longsword} or {@item Longsword|PHB|Custom Text}
            .replace(/\{@item ([^}]+)\}/gi, (match, content) => {
                const parts = content.split('|');
                const name = parts[0].trim();
                const display = (parts[2] || parts[0]).trim();
                return `<span class="vtt-entity-tag vtt-entity-item" data-entity-type="item" data-name="${name}">🗡️ ${display}</span>`;
            })
            // {@creature Goblin} or {@creature Goblin|MM|Custom Text}
            .replace(/\{@creature ([^}]+)\}/gi, (match, content) => {
                const parts = content.split('|');
                const name = parts[0].trim();
                const display = (parts[2] || parts[0]).trim();
                return `<span class="vtt-entity-tag vtt-entity-creature" data-entity-type="creature" data-name="${name}">👤 ${display}</span>`;
            })
            // {@condition Blinded} or {@condition Blinded|PHB|Custom Text}
            .replace(/\{@condition ([^}]+)\}/gi, (match, content) => {
                const parts = content.split('|');
                const name = parts[0].trim();
                const display = (parts[2] || parts[0]).trim();
                return `<span class="vtt-entity-tag vtt-entity-condition" data-entity-type="condition" data-name="${name}">⚠️ ${display}</span>`;
            })
            // {@skill Stealth}
            .replace(/\{@skill ([^|}]+)(?:\|([^}]+))?\}/gi, (match, name) => {
                return `<strong>${name}</strong>`;
            })
            // {@sense Darkvision}
            .replace(/\{@sense ([^|}]+)(?:\|([^}]+))?\}/gi, (match, name) => {
                return `<em>${name}</em>`;
            })
            // {@b text} -> bold
            .replace(/\{@b ([^}]+)\}/gi, '<strong>$1</strong>')
            // {@i text} -> italic
            .replace(/\{@i ([^}]+)\}/gi, '<em>$1</em>')
            // {@u text} -> underline
            .replace(/\{@u ([^}]+)\}/gi, '<u>$1</u>')
            // {@s text} -> strikethrough
            .replace(/\{@s ([^}]+)\}/gi, '<s>$1</s>')
            // {@note text}
            .replace(/\{@note ([^}]+)\}/gi, '<div class="vtt-note-box">$1</div>')
            // Catch-all for any unknown {@tag target|...} -> formatted span
            .replace(/\{@([a-zA-Z0-9_-]+)\s+([^}]+)\}/gi, (match, tag, content) => {
                const parts = content.split('|');
                const display = (parts[2] || parts[0]).trim();
                return `<span class="vtt-tag-text">${display}</span>`;
            });
    }

    /**
     * Recursively renders entry structures (strings, lists, objects) into HTML.
     */
    static render(entry, stack = []) {
        if (!entry) return '';

        if (typeof entry === 'string') {
            const html = VTTEntryResolver.resolveTags(entry);
            stack.push(html);
            return html;
        }

        if (typeof entry === 'number') {
            return String(entry);
        }

        if (Array.isArray(entry)) {
            return entry.map(e => VTTEntryResolver.render(e, stack)).join('');
        }

        if (typeof entry === 'object') {
            let out = '';
            const type = entry.type || 'entries';

            if (type === 'entries') {
                if (entry.name) out += `<h5 class="vtt-entry-header">${VTTEntryResolver.resolveTags(entry.name)}</h5>`;
                if (entry.entries) {
                    out += `<div class="vtt-entry-body">${VTTEntryResolver.render(entry.entries)}</div>`;
                }
            } else if (type === 'inset') {
                const title = entry.name ? `<h4 class="vtt-inset-title" style="margin:4px 0; color:#ffd700;">${VTTEntryResolver.resolveTags(entry.name)}</h4>` : '';
                const sub = entry.entries ? VTTEntryResolver.render(entry.entries) : (entry.entry ? VTTEntryResolver.render(entry.entry) : '');
                out += `<div class="vtt-inset-box" style="padding:8px 12px; margin:8px 0; border-left:3px solid #ffd700; background:rgba(255,215,0,0.06); border-radius:4px;">${title}${sub}</div>`;
            } else if (type === 'item' || type === 'itemSub' || type === 'itemSpell') {
                const nameStr = entry.name ? `<strong><em>${VTTEntryResolver.resolveTags(entry.name)}.</em></strong> ` : '';
                const content = entry.entry !== undefined ? entry.entry : (entry.entries !== undefined ? entry.entries : '');
                out += `<div class="vtt-entry-item">${nameStr}${VTTEntryResolver.render(content)}</div>`;
            } else if (type === 'list') {
                out += `<ul class="vtt-entry-list">`;
                if (Array.isArray(entry.items)) {
                    entry.items.forEach(item => {
                        out += `<li>${VTTEntryResolver.render(item)}</li>`;
                    });
                }
                out += `</ul>`;
            } else if (type === 'table') {
                out += `<table class="vtt-entry-table" style="width:100%; border-collapse:collapse; margin:8px 0;">`;
                if (entry.caption) out += `<caption style="font-weight:bold; margin-bottom:4px;">${VTTEntryResolver.resolveTags(entry.caption)}</caption>`;
                if (Array.isArray(entry.colLabels)) {
                    out += `<thead><tr>${entry.colLabels.map(col => `<th style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.2); text-align:left;">${VTTEntryResolver.resolveTags(typeof col === 'string' ? col : (col?.name || ''))}</th>`).join('')}</tr></thead>`;
                }
                if (Array.isArray(entry.rows)) {
                    out += `<tbody>`;
                    entry.rows.forEach(row => {
                        const cells = Array.isArray(row) ? row : (Array.isArray(row?.cells) ? row.cells : []);
                        out += `<tr>${cells.map(cell => `<td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08);">${VTTEntryResolver.render(cell)}</td>`).join('')}</tr>`;
                    });
                    out += `</tbody>`;
                }
                out += `</table>`;
            } else if (entry.entries) {
                out += VTTEntryResolver.render(entry.entries);
            } else if (entry.text) {
                out += VTTEntryResolver.resolveTags(entry.text);
            } else if (entry.descriptionHtml) {
                out += entry.descriptionHtml;
            }

            stack.push(out);
            return out;
        }

        return '';
    }

    static recursiveRender(entry, stack = []) {
        return VTTEntryResolver.render(entry, stack);
    }
}

// Global hook and shim
if (typeof window !== 'undefined') {
    window.VTTEntryResolver = VTTEntryResolver;
    if (!window.Renderer) window.Renderer = {};
    if (!window.Renderer.get) {
        window.Renderer.get = () => ({
            render: (entry) => VTTEntryResolver.render(entry),
            recursiveRender: (entry, stack) => VTTEntryResolver.recursiveRender(entry, stack)
        });
    }
    // Token URL fallback shim
    if (!window.Renderer.monster) window.Renderer.monster = {};
    if (!window.Renderer.monster.getTokenUrl) {
        window.Renderer.monster.getTokenUrl = (m) => {
            if (!m) return 'favicon.svg';
            if (m.tokenUrl) return m.tokenUrl;
            if (m.tokenImg) return m.tokenImg;
            if (m.imgUrl) return m.imgUrl;
            const src = m.source || 'MM';
            const cleanName = typeof window.Parser !== 'undefined' && window.Parser?.nameToTokenName
                ? window.Parser.nameToTokenName(m.name)
                : (m.name || '').replace(/"/g, '').trim();
            return `img/bestiary/tokens/${src}/${cleanName}.webp`;
        };
    }
}
