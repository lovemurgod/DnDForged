import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const dataDir = path.join(rootDir, '5etools-src', 'data');
const adventuresFile = path.join(dataDir, 'adventures.json');
const booksFile = path.join(dataDir, 'books.json');
const catalogOutputPath = path.join(dataDir, 'handouts-catalog.json');
const normalizedDir = path.join(dataDir, 'handouts-normalized');

// Ensure output directories exist
if (!fs.existsSync(normalizedDir)) {
    fs.mkdirSync(normalizedDir, { recursive: true });
}

/**
 * Clean tags: strip external 5etools backlinks and convert formatting into clean, self-contained HTML
 */
function cleanTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        // Strip 5etools and external backlinks
        .replace(/\{@5etools\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        // Clean text formatting
        .replace(/\{@b\s+([^}]+)\}/gi, '<strong>$1</strong>')
        .replace(/\{@i\s+([^}]+)\}/gi, '<em>$1</em>')
        .replace(/\{@u\s+([^}]+)\}/gi, '<u>$1</u>')
        .replace(/\{@s\s+([^}]+)\}/gi, '<s>$1</s>')
        .replace(/\{@note\s+([^}]+)\}/gi, '<em class="text-muted">Note: $1</em>')
        // Compendium cross-references (retained as local clean spans with no external links)
        .replace(/\{@creature\s+([^}|]+)(?:\|[^}]*)?\}/gi, '<span class="compendium-ref" data-type="creature" data-name="$1">$1</span>')
        .replace(/\{@spell\s+([^}|]+)(?:\|[^}]*)?\}/gi, '<span class="compendium-ref" data-type="spell" data-name="$1">$1</span>')
        .replace(/\{@item\s+([^}|]+)(?:\|[^}]*)?\}/gi, '<span class="compendium-ref" data-type="item" data-name="$1">$1</span>')
        .replace(/\{@condition\s+([^}|]+)(?:\|[^}]*)?\}/gi, '<span class="compendium-ref" data-type="condition" data-name="$1">$1</span>')
        .replace(/\{@skill\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@sense\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@action\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        // Keep dice rolls for local VTT roller
        .replace(/\{@(?:dice|damage|d20)\s+([^}|]+)(?:\|[^}]*)?\}/gi, '{@dice $1}')
        // Generic fallback for any other {@tag ...}
        .replace(/\{@[a-zA-Z0-9_-]+\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

function cleanTagsPlain(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\{@5etools\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@link\s+([^}|]+)(?:\|[^}]*)?\}/gi, '$1')
        .replace(/\{@[a-zA-Z0-9_-]+\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1')
        .replace(/<\/?[^>]+(>|$)/g, '');
}

/**
 * Render structured JSON entries into clean, formatted HTML
 */
function renderEntriesToHtml(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') {
        return `<p>${cleanTags(entries)}</p>`;
    }
    if (Array.isArray(entries)) {
        return entries.map(renderEntriesToHtml).filter(Boolean).join('');
    }
    if (typeof entries === 'object' && entries !== null) {
        // Inset or Readaloud
        if (entries.type === 'inset' || entries.type === 'insetReadaloud') {
            const titleHtml = entries.name ? `<h4>${cleanTags(entries.name)}</h4>` : '';
            const bodyHtml = entries.entries ? renderEntriesToHtml(entries.entries) : '';
            const cls = entries.type === 'insetReadaloud' ? 'rd__b-readaloud' : 'rd__b-inset';
            return `<div class="${cls}">${titleHtml}${bodyHtml}</div>`;
        }

        // Section or Entries
        if (entries.type === 'section' || entries.type === 'entries') {
            const heading = entries.name ? `<h4>${cleanTags(entries.name)}</h4>` : '';
            const body = entries.entries ? renderEntriesToHtml(entries.entries) : '';
            return `${heading}${body}`;
        }

        // List
        if (entries.type === 'list' && Array.isArray(entries.items)) {
            const items = entries.items.map(it => {
                if (typeof it === 'string') return `<li>${cleanTags(it)}</li>`;
                if (it && it.name && it.entry) return `<li><strong>${cleanTags(it.name)}.</strong> ${cleanTags(it.entry)}</li>`;
                return `<li>${renderEntriesToHtml(it)}</li>`;
            }).join('');
            return `<ul class="handout-list-items">${items}</ul>`;
        }

        // Table
        if (entries.type === 'table' && Array.isArray(entries.rows)) {
            let caption = entries.caption ? `<caption>${cleanTags(entries.caption)}</caption>` : '';
            let header = '';
            if (Array.isArray(entries.colLabels)) {
                header = `<thead><tr>${entries.colLabels.map(c => `<th>${cleanTags(c)}</th>`).join('')}</tr></thead>`;
            }
            let rows = entries.rows.map(r => {
                const cells = Array.isArray(r) ? r : [r];
                return `<tr>${cells.map(c => `<td>${cleanTags(String(c))}</td>`).join('')}</tr>`;
            }).join('');
            return `<table class="handout-table">${caption}${header}<tbody>${rows}</tbody></table>`;
        }

        // Image inside entries
        if (entries.type === 'image' && entries.href) {
            const pathUrl = entries.href.type === 'internal' ? `img/${entries.href.path}` : (entries.href.url || '');
            const title = entries.title ? `<div class="handout-img-caption">${cleanTags(entries.title)}</div>` : '';
            return `<div class="handout-img-box"><img src="${pathUrl}" alt="${cleanTagsPlain(entries.title || 'Image')}" class="handout-img" onerror="this.onerror=null; this.src='img/TextLogo.png';">${title}</div>`;
        }

        // Quote
        if (entries.type === 'quote' && entries.entries) {
            const by = entries.by ? `<cite>— ${cleanTags(entries.by)}</cite>` : '';
            return `<blockquote>${renderEntriesToHtml(entries.entries)}${by}</blockquote>`;
        }

        // Generic fallback for object with entries
        if (entries.entries) {
            return renderEntriesToHtml(entries.entries);
        }
    }
    return '';
}

/**
 * Extract normalized handouts from a single adventure or book
 */
function extractHandoutsFromModule(moduleData, meta, type) {
    const handouts = [];
    const sourceName = meta.name || meta.id;
    const sourceKey = (meta.id || meta.source).toLowerCase();

    function walk(entry, currentChapter, depth = 0) {
        if (!entry) return;

        if (Array.isArray(entry)) {
            entry.forEach(e => walk(e, currentChapter, depth));
            return;
        }

        if (typeof entry !== 'object') return;

        let chapterName = currentChapter;
        if (entry.type === 'section' && entry.name) {
            chapterName = cleanTagsPlain(entry.name);
        }

        // 1. Image / Artwork / Handout
        if (entry.type === 'image' && entry.href) {
            let imgPath = '';
            if (entry.href.type === 'internal') {
                imgPath = `img/${entry.href.path}`;
            } else if (entry.href.url) {
                imgPath = entry.href.url;
            }

            if (imgPath) {
                const title = cleanTagsPlain(entry.title || entry.caption || `${chapterName} Illustration`);
                handouts.push({
                    id: `ho_${sourceKey}_img_${handouts.length}`,
                    title: title,
                    type: 'image',
                    url: imgPath,
                    folder: sourceName,
                    subfolder: chapterName,
                    chapter: chapterName,
                    html: entry.caption ? `<p><em>${cleanTags(entry.caption)}</em></p>` : '',
                    desc: entry.caption ? cleanTagsPlain(entry.caption) : '',
                    source: meta.id || meta.source
                });
            }
        }

        // 2. Inset / Readaloud / Player Note / Letter
        if (entry.type === 'inset' || entry.type === 'insetReadaloud') {
            const rawTitle = entry.name || (entry.type === 'insetReadaloud' ? 'Read-Aloud Note' : 'Module Inset');
            const title = cleanTagsPlain(rawTitle);
            const htmlContent = renderEntriesToHtml(entry);
            const descContent = entry.entries ? entry.entries.filter(e => typeof e === 'string').map(cleanTagsPlain).join('\n\n') : '';

            handouts.push({
                id: `ho_${sourceKey}_ins_${handouts.length}`,
                title: title,
                type: 'inset',
                url: '',
                folder: sourceName,
                subfolder: chapterName,
                chapter: chapterName,
                html: htmlContent,
                desc: descContent,
                source: meta.id || meta.source
            });
        }

        // 3. Story Section (Top narrative sections)
        if (entry.type === 'section' && entry.name && entry.entries && depth <= 1) {
            const title = cleanTagsPlain(entry.name);
            const htmlContent = renderEntriesToHtml({ type: 'section', name: entry.name, entries: entry.entries });

            handouts.push({
                id: `ho_${sourceKey}_sty_${handouts.length}`,
                title: title,
                type: 'story',
                url: '',
                folder: sourceName,
                subfolder: chapterName,
                chapter: chapterName,
                html: htmlContent,
                desc: '',
                source: meta.id || meta.source
            });
        }

        // Recurse children
        if (entry.entries) walk(entry.entries, chapterName, depth + 1);
        if (entry.items) walk(entry.items, chapterName, depth + 1);
        if (entry.tables) walk(entry.tables, chapterName, depth + 1);
    }

    if (moduleData && moduleData.data) {
        walk(moduleData.data, 'General Overview');
    }

    return handouts;
}

// ─── Main Execution ─────────────────────────────────────────────────────────────

async function buildHandoutDatabase() {
    console.log('[Handout DB] Starting normalized handout database compilation...');

    let adventures = [];
    let books = [];

    if (fs.existsSync(adventuresFile)) {
        try {
            const raw = JSON.parse(fs.readFileSync(adventuresFile, 'utf8'));
            adventures = raw.adventure || [];
        } catch (e) {
            console.error('[Handout DB] Error reading adventures.json:', e);
        }
    }

    if (fs.existsSync(booksFile)) {
        try {
            const raw = JSON.parse(fs.readFileSync(booksFile, 'utf8'));
            books = raw.book || [];
        } catch (e) {
            console.error('[Handout DB] Error reading books.json:', e);
        }
    }

    console.log(`[Handout DB] Discovered ${adventures.length} adventures and ${books.length} books.`);

    const catalog = [];
    let totalHandouts = 0;
    let totalImages = 0;
    let totalInsets = 0;
    let totalStories = 0;

    // Process Adventures
    for (const adv of adventures) {
        const key = (adv.id || adv.source).toLowerCase();
        const filePath = path.join(dataDir, 'adventure', `adventure-${key}.json`);
        if (!fs.existsSync(filePath)) continue;

        try {
            const moduleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const handouts = extractHandoutsFromModule(moduleData, adv, 'adventure');

            if (handouts.length > 0) {
                const partitionFile = path.join(normalizedDir, `handouts-${key}.json`);
                fs.writeFileSync(partitionFile, JSON.stringify(handouts, null, 2), 'utf8');

                const imgCount = handouts.filter(h => h.type === 'image').length;
                const insCount = handouts.filter(h => h.type === 'inset').length;
                const styCount = handouts.filter(h => h.type === 'story').length;

                totalHandouts += handouts.length;
                totalImages += imgCount;
                totalInsets += insCount;
                totalStories += styCount;

                catalog.push({
                    id: adv.id || adv.source,
                    name: adv.name,
                    source: adv.source || adv.id,
                    type: 'adventure',
                    published: adv.published || '',
                    author: adv.author || '',
                    storyline: adv.storyline || '',
                    cover: adv.cover?.path ? `img/${adv.cover.path}` : '',
                    handoutCount: handouts.length,
                    imageCount: imgCount,
                    insetCount: insCount,
                    storyCount: styCount
                });
            }
        } catch (err) {
            console.warn(`[Handout DB] Failed processing adventure ${key}:`, err.message);
        }
    }

    // Process Books
    for (const book of books) {
        const key = (book.id || book.source).toLowerCase();
        const filePath = path.join(dataDir, 'book', `book-${key}.json`);
        if (!fs.existsSync(filePath)) continue;

        try {
            const moduleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const handouts = extractHandoutsFromModule(moduleData, book, 'book');

            if (handouts.length > 0) {
                const partitionFile = path.join(normalizedDir, `handouts-${key}.json`);
                fs.writeFileSync(partitionFile, JSON.stringify(handouts, null, 2), 'utf8');

                const imgCount = handouts.filter(h => h.type === 'image').length;
                const insCount = handouts.filter(h => h.type === 'inset').length;
                const styCount = handouts.filter(h => h.type === 'story').length;

                totalHandouts += handouts.length;
                totalImages += imgCount;
                totalInsets += insCount;
                totalStories += styCount;

                catalog.push({
                    id: book.id || book.source,
                    name: book.name,
                    source: book.source || book.id,
                    type: 'book',
                    published: book.published || '',
                    author: book.author || '',
                    storyline: book.group || '',
                    cover: book.cover?.path ? `img/${book.cover.path}` : '',
                    handoutCount: handouts.length,
                    imageCount: imgCount,
                    insetCount: insCount,
                    storyCount: styCount
                });
            }
        } catch (err) {
            console.warn(`[Handout DB] Failed processing book ${key}:`, err.message);
        }
    }

    // Write Master Catalog
    fs.writeFileSync(catalogOutputPath, JSON.stringify(catalog, null, 2), 'utf8');

    console.log(`\n======================================================`);
    console.log(`  Handout Database Compiled Successfully!`);
    console.log(`  Modules: ${catalog.length}`);
    console.log(`  Total Handouts: ${totalHandouts}`);
    console.log(`    - Images & Art: ${totalImages}`);
    console.log(`    - Insets & Letters: ${totalInsets}`);
    console.log(`    - Story Sections: ${totalStories}`);
    console.log(`  Catalog written to: ${catalogOutputPath}`);
    console.log(`  Partitions written to: ${normalizedDir}`);
    console.log(`======================================================\n`);
}

buildHandoutDatabase();
