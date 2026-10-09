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
                const cleanBonus = bonus.startsWith('+') ? bonus : `+${bonus}`;
                const label = display || cleanBonus;
                return `<button class="dice-chip dice-chip--hit" data-formula="1d20${cleanBonus}" title="Attack Roll: 1d20${cleanBonus}">${label}</button>`;
            })
            // {@dc 15}
            .replace(/\{@dc ([^}]+)\}/gi, (match, dc) => {
                return `<span class="vtt-dc-badge" title="Difficulty Class">DC ${dc}</span>`;
            })
            // {@spell Fireball|PHB} or {@spell Fireball}
            .replace(/\{@spell ([^|}]+)(?:\|([^}]+))?\}/gi, (match, name) => {
                return `<span class="vtt-entity-tag vtt-entity-spell" data-entity-type="spell" data-name="${name}">✨ ${name}</span>`;
            })
            // {@item Longsword}
            .replace(/\{@item ([^|}]+)(?:\|([^}]+))?\}/gi, (match, name) => {
                return `<span class="vtt-entity-tag vtt-entity-item" data-entity-type="item" data-name="${name}">🗡️ ${name}</span>`;
            })
            // {@creature Goblin}
            .replace(/\{@creature ([^|}]+)(?:\|([^}]+))?\}/gi, (match, name) => {
                return `<span class="vtt-entity-tag vtt-entity-creature" data-entity-type="creature" data-name="${name}">👤 ${name}</span>`;
            })
            // {@condition Blinded}
            .replace(/\{@condition ([^|}]+)(?:\|([^}]+))?\}/gi, (match, name) => {
                return `<span class="vtt-entity-tag vtt-entity-condition" data-entity-type="condition" data-name="${name}">⚠️ ${name}</span>`;
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
            // {@note text}
            .replace(/\{@note ([^}]+)\}/gi, '<div class="vtt-note-box">$1</div>')
            // Catch-all for any unknown {@tag target|...} -> formatted span
            .replace(/\{@([a-zA-Z0-9]+)\s+([^|}]+)(?:\|([^}]+))?\}/gi, (match, tag, target, extra) => {
                return `<span class="vtt-tag-text">${extra || target}</span>`;
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
            } else if (type === 'list') {
                out += `<ul class="vtt-entry-list">`;
                if (Array.isArray(entry.items)) {
                    entry.items.forEach(item => {
                        out += `<li>${VTTEntryResolver.render(item)}</li>`;
                    });
                }
                out += `</ul>`;
            } else if (type === 'table') {
                out += `<table class="vtt-entry-table">`;
                if (entry.caption) out += `<caption>${VTTEntryResolver.resolveTags(entry.caption)}</caption>`;
                if (Array.isArray(entry.colLabels)) {
                    out += `<thead><tr>${entry.colLabels.map(col => `<th>${VTTEntryResolver.resolveTags(col)}</th>`).join('')}</tr></thead>`;
                }
                if (Array.isArray(entry.rows)) {
                    out += `<tbody>`;
                    entry.rows.forEach(row => {
                        out += `<tr>${row.map(cell => `<td>${VTTEntryResolver.render(cell)}</td>`).join('')}</tr>`;
                    });
                    out += `</tbody>`;
                }
                out += `</table>`;
            } else if (entry.entries) {
                out += VTTEntryResolver.render(entry.entries);
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
            const src = (m.source || 'phb').toLowerCase();
            const cleanName = (m.name || '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            return `/img/bestiary/tokens/${src.toUpperCase()}/${cleanName}.webp`;
        };
    }
}
